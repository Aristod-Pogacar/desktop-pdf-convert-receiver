const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const express = require("express");
const http = require("http");
const ip = require("ip");

const EXCEL_PATH = path.join(app.getPath("documents"), "PDF-Receiver", "transfers.xlsx");
const SAVE_PATH = path.join(app.getPath("documents"), "PDF-Receiver");

let win;

function createWindow() {
    win = new BrowserWindow({
        width: 600,
        height: 700,
        webPreferences: {
            preload: path.join(__dirname, "preload.js")
        }
    });

    win.loadFile("renderer/index.html");
}
ipcMain.handle("open-excel", async () => {
    if (fs.existsSync(EXCEL_PATH)) {
        await shell.openPath(EXCEL_PATH);
        return { ok: true };
    }
    return { ok: false, error: "Fichier Excel introuvable" };
});

ipcMain.handle("open-pdf-folder", async () => {
    if (fs.existsSync(SAVE_PATH)) {
        await shell.openPath(SAVE_PATH);
        return { ok: true };
    }
    return { ok: false, error: "Dossier PDF introuvable" };
});

let globalPassword = "";

ipcMain.on("set-password", (event, password) => {
    globalPassword = password;
    console.log("Password mis à jour");
});

// fonction pour récupérer le password
function getPassword() {
    return globalPassword;
}

app.whenReady().then(() => {
    createWindow();

    const expressApp = express();
    const server = http.createServer(expressApp);

    const startSocket = require("./server/socket");

    startSocket(server, (data) => {
        win.webContents.send("update-folder", data);
    }, (timeoutData) => {
        win.webContents.send("transfer-timeout", timeoutData);
    }, getPassword);

    server.listen(3000, () => {
        win.webContents.once("did-finish-load", () => {

            // Premier envoi
            win.webContents.send("ip-address", ip.address());

            // Puis toutes les 5 secondes
            setInterval(() => {
                if (win && !win.isDestroyed()) {
                    win.webContents.send("ip-address", ip.address());
                }
            }, 5000);

        });
    });
    // 🔹 Resume transfer: ask server for status then send remaining files
    ipcMain.handle("resume-transfer", async (event, matricule, currentCount) => {
        return { ok: true, matricule, currentCount };
    });

    // 🔹 Clear transfer from UI
    ipcMain.handle("clear-transfer", async (event, matricule) => {
        return { ok: true };
    });
});
