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
        console.log("🔐 PDF sécurisé :", filePath);
    } catch (err) {
        console.error("Erreur qpdf :", err);
    }
}

function logTransferToExcel(matricule, totalFiles) {
    let workbook;
    let worksheet;
    const sheetName = "Transferts";

    if (fs.existsSync(EXCEL_PATH)) {
        workbook = XLSX.readFile(EXCEL_PATH);
        worksheet = workbook.Sheets[sheetName];
    } else {
        workbook = XLSX.utils.book_new();
        worksheet = XLSX.utils.aoa_to_sheet([
            ["Matricule", "Fichiers reçus", "Date", "Heure"]
        ]);
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    }

    const now = new Date();
    const row = [
        matricule,
        totalFiles,
        now.toLocaleDateString(),
        now.toLocaleTimeString()
    ];

    XLSX.utils.sheet_add_aoa(worksheet, [row], { origin: -1 });
    XLSX.writeFile(workbook, EXCEL_PATH);

    console.log(`📊 Excel mis à jour → ${matricule}`);
}

function checkTransferTimeouts(io, notifyTimeout) {
    const now = Date.now();
    for (const [key, transfer] of transfers.entries()) {
        if (transfer.received < transfer.total && transfer.lastActivity) {
            if (now - transfer.lastActivity > TRANSFER_TIMEOUT_MS) {
                console.log(`⏱️ Transfert timeout: ${key} (${transfer.received}/${transfer.total})`);
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
    console.log("QPDF PATH:", getQpdfPath());
    console.log("EXISTS:", fs.existsSync(getQpdfPath()));
    console.log("PASSWORD:", getPassword());

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

            if (!transfers.has(key)) {
                transfers.set(key, {
                    received: 0,
                    total,
                    receivedNames: new Set(),
                    matricule,
                    lastActivity: Date.now(),
                    timedOut: false
                });
            }

            const transfer = transfers.get(key);

            if (!transfer.receivedNames.has(fileName)) {
                transfer.receivedNames.add(fileName);
                transfer.received += 1;
            }
            transfer.lastActivity = Date.now();

            console.log(
                `[${matricule}] ${transfer.received}/${transfer.total} → ${fileName}`
            );

            notifyUI({
                matricule,
                received: count,
                total,
                files: Array.from(transfer.receivedNames),
                timedOut: transfer.timedOut
            });

            if (transfer.received === transfer.total) {
                logTransferToExcel(matricule, transfer.total);
                if (ack) {
                    ack({
                        status: "ok",
                        message: `Documents ${matricule} reçus`
                    });
                }
                transfers.delete(key);
                console.log(`[${matricule}] Transfert terminé`);
            }
        });

        socket.on("get-transfer-status", ({ matricule }, ack) => {
            let found = null;
            for (const [key, transfer] of transfers.entries()) {
                if (transfer.matricule === matricule && key.startsWith(socket.id)) {
                    found = transfer;
                    break;
                }
            }
            if (found) {
                ack({
                    status: "ok",
                    received: found.received,
                    total: found.total,
                    files: Array.from(found.receivedNames),
                    timedOut: found.timedOut
                });
            } else {
                ack({
                    status: "not_found"
                });
            }
        });

        socket.on("disconnect", () => {
            console.log("Client disconnected");
        });

        socket.on("error", (error) => {
            console.error("Socket error:", error);
        });
    });
};
