const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");
const { app } = require("electron");
const XLSX = require("xlsx");

const transfers = new Map();

const EXCEL_PATH = path.join(app.getPath("documents"), "PDF-Receiver", "transfers.xlsx");

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

module.exports = function startSocketServer(httpServer, notifyUI) {
    const io = new Server(httpServer, {
        maxHttpBufferSize: 1e8
    });

    io.on("connection", (socket) => {
        console.log("Client connected");
        /*
        key = socket.id + matricule
        value = { received: number, total: number }
        */
        socket.on("send-pdf", ({ matricule, fileName, fileBuffer, total }, ack) => {
            // const dir = path.join(__dirname, "..", "received", matricule);
            // const dir = path.join(BASE_DIR, matricule);
            const dir = path.join(app.getPath("documents"), "PDF-Receiver", matricule);
            // const exeDir = path.dirname(process.execPath);
            // const dir = path.join(exeDir, "received", matricule);
            console.log("DIR:", dir);
            const transferKey = `${socket.id}_${matricule}`;
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

            fs.writeFileSync(path.join(dir, fileName), Buffer.from(fileBuffer));

            const count = fs.readdirSync(dir).length;
            console.log("Fichier enregistré dans :", path.join(dir, fileName));

            const key = `${socket.id}_${matricule}`;

            if (!transfers.has(key)) {
                transfers.set(key, {
                    received: 0,
                    total
                });
            }

            const transfer = transfers.get(key);
            transfer.received += 1;

            console.log(
                `[${matricule}] ${transfer.received}/${transfer.total} → ${fileName}`
            );

            notifyUI(({
                matricule,
                received: count,
                total
            }));

            // ✅ ACK envoyé UNE SEULE FOIS
            if (transfer.received === transfer.total) {
                logTransferToExcel(matricule, transfer.total);
                ack({
                    status: "ok",
                    message: `Documents ${matricule} reçus`
                });

                transfers.delete(key); // 🔥 reset propre
                console.log(`[${matricule}] Transfert terminé`);
            }
        });
    });
};
