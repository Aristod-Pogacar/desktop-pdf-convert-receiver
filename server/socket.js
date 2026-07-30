const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");
const { app } = require("electron");
const XLSX = require("xlsx");
const { PDFDocument } = require("pdf-lib");
const { execFileSync } = require("child_process");

const transfers = new Map();
const TRANSFER_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes d'inactivité = timeout

const EXCEL_PATH = path.join(app.getPath("documents"), "PDF-Receiver", "transfers.xlsx");

function getQpdfPath() {
    return path.join(app.getAppPath(), "qpdf", "qpdf.exe");
}

function protectPDF(filePath, password) {
    try {
        const qpdfPath = getQpdfPath();
        const tempPath = filePath + ".secure.pdf";
        const args = [
            "--encrypt",
            password,
            password,
            "256",
            "--",
            filePath,
            tempPath
        ];
        execFileSync(qpdfPath, args);
        fs.unlinkSync(filePath);
        fs.renameSync(tempPath, filePath);
        // console.log("🔐 PDF sécurisé :", filePath);
    } catch (err) {
        console.error("Erreur qpdf :", err);
    }
}

function logTransferToExcel(matricule, fileName) {
    const transferSheetName = "Transferts";
    const matriculeSheetName = "Matricules";

    let workbook;
    let transferSheet;
    let matriculeSheet;

    if (fs.existsSync(EXCEL_PATH)) {
        workbook = XLSX.readFile(EXCEL_PATH);

        transferSheet = workbook.Sheets[transferSheetName];
        matriculeSheet = workbook.Sheets[matriculeSheetName];

        if (!transferSheet) {
            transferSheet = XLSX.utils.aoa_to_sheet([
                ["Matricule", "Nom du fichier", "Date", "Heure"]
            ]);
            XLSX.utils.book_append_sheet(workbook, transferSheet, transferSheetName);
        }

        if (!matriculeSheet) {
            matriculeSheet = XLSX.utils.aoa_to_sheet([
                ["Matricule", "Nombre de fichiers", "Date", "Heure"]
            ]);
            XLSX.utils.book_append_sheet(workbook, matriculeSheet, matriculeSheetName);
        }

    } else {
        workbook = XLSX.utils.book_new();

        transferSheet = XLSX.utils.aoa_to_sheet([
            ["Matricule", "Nom du fichier", "Date", "Heure"]
        ]);

        matriculeSheet = XLSX.utils.aoa_to_sheet([
            ["Matricule", "Nombre de fichiers", "Date", "Heure"]
        ]);

        XLSX.utils.book_append_sheet(workbook, transferSheet, transferSheetName);
        XLSX.utils.book_append_sheet(workbook, matriculeSheet, matriculeSheetName);
    }

    const now = new Date();
    const date = now.toLocaleDateString();
    const heure = now.toLocaleTimeString();

    // =====================================================
    // FEUILLE TRANSFERTS
    // =====================================================

    const transferRows = XLSX.utils.sheet_to_json(transferSheet, {
        header: 1
    });

    let transferRowIndex = -1;

    for (let i = 1; i < transferRows.length; i++) {
        if (
            transferRows[i][0] === matricule &&
            transferRows[i][1] === fileName
        ) {
            transferRowIndex = i;
            break;
        }
    }

    let isNewFile = false;

    if (transferRowIndex === -1) {
        // Nouveau fichier
        transferRows.push([
            matricule,
            fileName,
            date,
            heure
        ]);

        isNewFile = true;
    } else {
        // Fichier déjà existant : mise à jour date/heure
        transferRows[transferRowIndex][2] = date;
        transferRows[transferRowIndex][3] = heure;
    }

    workbook.Sheets[transferSheetName] =
        XLSX.utils.aoa_to_sheet(transferRows);

    // =====================================================
    // FEUILLE MATRICULES
    // =====================================================

    const matriculeRows = XLSX.utils.sheet_to_json(matriculeSheet, {
        header: 1
    });

    let matriculeRowIndex = -1;

    for (let i = 1; i < matriculeRows.length; i++) {
        if (matriculeRows[i][0] === matricule) {
            matriculeRowIndex = i;
            break;
        }
    }

    if (matriculeRowIndex === -1) {

        // Nouveau matricule
        matriculeRows.push([
            matricule,
            1,
            date,
            heure
        ]);

    } else {

        // Nouveau fichier uniquement
        if (isNewFile) {
            matriculeRows[matriculeRowIndex][1] =
                Number(matriculeRows[matriculeRowIndex][1] || 0) + 1;
        }

        // Toujours mettre à jour la dernière date/heure
        matriculeRows[matriculeRowIndex][2] = date;
        matriculeRows[matriculeRowIndex][3] = heure;
    }

    workbook.Sheets[matriculeSheetName] =
        XLSX.utils.aoa_to_sheet(matriculeRows);

    // =====================================================
    // SAUVEGARDE
    // =====================================================

    XLSX.writeFile(workbook, EXCEL_PATH);
}

function checkTransferTimeouts(io, notifyTimeout) {
    const now = Date.now();
    for (const [key, transfer] of transfers.entries()) {
        if (transfer.received < transfer.total && transfer.lastActivity) {
            if (now - transfer.lastActivity > TRANSFER_TIMEOUT_MS) {
                // console.log(`⏱️ Transfert timeout: ${key} (${transfer.received}/${transfer.total})`);
                transfer.timedOut = true;
                const timeoutData = {
                    matricule: transfer.matricule,
                    received: transfer.received,
                    total: transfer.total,
                    files: Array.from(transfer.receivedNames)
                };
                io.to(key.split("_")[0]).emit("transfer-timeout", timeoutData);
                if (notifyTimeout) {
                    notifyTimeout(timeoutData);
                }
            }
        }
    }
}

module.exports = function startSocketServer(httpServer, notifyUI, notifyTimeout, getPassword) {
    // console.log("QPDF PATH:", getQpdfPath());
    // console.log("EXISTS:", fs.existsSync(getQpdfPath()));
    // console.log("PASSWORD:", getPassword());

    const io = new Server(httpServer, {
        maxHttpBufferSize: 1e8
    });

    setInterval(() => checkTransferTimeouts(io, notifyTimeout), 30000);

    io.on("connection", (socket) => {
        console.log("Client connected");

        socket.on("send-pdf", ({ matricule, fileName, fileBuffer, total }, ack) => {
            const dir = path.join(app.getPath("documents"), "PDF-Receiver", matricule);
            const transferKey = `${socket.id}_${matricule}`;
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

            const filePath = path.join(dir, fileName);
            let fileStatus = "ok";
            let fileError = null;

            try {
                fs.writeFileSync(filePath, Buffer.from(fileBuffer));
                try {
                    protectPDF(filePath, getPassword());
                } catch (protectErr) {
                    console.error("Erreur protection PDF:", protectErr);
                }
            } catch (err) {
                console.error("Erreur sauvegarde fichier:", err);
                fileStatus = "error";
                fileError = err.message;
            }

            const count = fs.readdirSync(dir).length;

            socket.emit("file-received", {
                matricule,
                fileName,
                count,
                total,
                fileStatus,
                fileError
            });

            const key = `${socket.id}_${matricule}`;
            const activity = Date.now()

            if (!transfers.has(key)) {
                transfers.set(key, {
                    received: 0,
                    total: total,
                    receivedNames: new Set(),
                    matricule,
                    lastActivity: activity,
                    timedOut: false,
                    times: 0,
                    socketId: socket.id,
                });
            }

            const transfer = transfers.get(key);

            if (!transfer.receivedNames.has(fileName)) {
                transfer.receivedNames.add(fileName);
                transfer.received += 1;
            }
            transfer.lastActivity = Date.now();

            notifyUI({
                matricule,
                received: transfer.received,
                total: transfer.total,
                files: Array.from(transfer.receivedNames),
                timedOut: transfer.timedOut
            });

            // if (transfer.received === transfer.total) {
            logTransferToExcel(matricule, fileName);
            if (ack) {
                ack({
                    status: "ok",
                    message: `Documents ${matricule} reçus`
                });
            }
            if (transfer.received === transfer.total) {
                transfer.completed = true;
            }
            console.log(`[${matricule}] Transfert termine`);
            // }
        });
        // socket.on("get-transfer-status", ({ matricule, fileName }, ack) => {
        // socket.on("get-transfer-status", (data, ack) => {
        //     console.log("GET-STATUS:", data);
        //     const dir = path.join(
        //         app.getPath("documents"),
        //         "PDF-Receiver",
        //         matricule
        //     );
        //     console.log("dir :", dir);

        //     const filePath = path.join(dir, fileName);
        //     console.log("filePath :", filePath);

        //     ack({
        //         status: "ok",
        //         alreadyReceived: fs.existsSync(filePath)
        //     });
        // });
        socket.on("get-transfer-status", ({ matricule, fileNames }, ack) => {
            console.log("GET-STATUS:", { matricule, fileNames });

            const dir = path.join(
                app.getPath("documents"),
                "PDF-Receiver",
                matricule
            );

            const existingFiles = [];

            if (Array.isArray(fileNames)) {
                for (const fileName of fileNames) {
                    const filePath = path.join(dir, fileName);

                    if (fs.existsSync(filePath)) {
                        existingFiles.push(fileName);
                    }
                }
            }

            ack({
                status: "ok",
                existingFiles
            });
        });
        // socket.on("get-transfer-status", ({ matricule }, ack) => {
        //     console.log("get-transfer-status", matricule);
        //     console.trace();
        //     let found = null;
        //     for (const [key, transfer] of transfers.entries()) {
        //         if (transfer.matricule === matricule && key.startsWith(socket.id)) {
        //             found = transfer;
        //             break;
        //         }
        //     }
        // if (found) {
        //     console.log(found)
        //     ack({
        //         status: "ok",
        //         received: found.received,
        //         total: found.total,
        //         files: Array.from(found.receivedNames),
        //         timedOut: found.timedOut
        //     });
        // } else {
        // ack({
        //     status: "not_found"
        // });
        // }
        // });

        socket.on("disconnect", () => {
            console.log("Client disconnected");
        });

        socket.on("error", (error) => {
            console.error("Socket error:", error);
        });
    });
};
