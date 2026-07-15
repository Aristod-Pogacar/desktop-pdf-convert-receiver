const fs = require("fs");
const path = require("path");
const { app } = require("electron");
const XLSX = require("xlsx");

class TransferLogger {
    constructor() {
        this.excelPath = path.join(app.getPath("documents"), "PDF-Receiver", "transfers.xlsx");
        this.sheetName = "Fail";
    }

    logFailure(fileName, matricule, errorDetails) {
        let workbook;
        let worksheet;
        let sheetExists = false;

        if (fs.existsSync(this.excelPath)) {
            workbook = XLSX.readFile(this.excelPath);
            worksheet = workbook.Sheets[this.sheetName];
            if (worksheet) {
                sheetExists = true;
            }
        } else {
            workbook = XLSX.utils.book_new();
        }

        if (!sheetExists) {
            worksheet = XLSX.utils.aoa_to_sheet([
                ["Nom du fichier", "Matricule", "Date", "Détails (Raison de l'échec)"]
            ]);
            XLSX.utils.book_append_sheet(workbook, worksheet, this.sheetName);
        }

        const now = new Date();
        const pad = (n) => String(n).padStart(2, "0");
        const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

        const row = [fileName, matricule, dateStr, errorDetails];

        XLSX.utils.sheet_add_aoa(worksheet, [row], { origin: -1 });
        XLSX.writeFile(workbook, this.excelPath);

        console.log(`❌ Échec enregistré dans Excel → ${fileName} (${matricule})`);
    }
}

module.exports = TransferLogger;
