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
        height: 400,
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

app.whenReady().then(() => {
    createWindow();

    const expressApp = express();
    const server = http.createServer(expressApp);

    const startSocket = require("./server/socket");

    startSocket(server, (data) => {
        win.webContents.send("update-folder", data);
    });

    server.listen(3000, () => {
        win.webContents.once("did-finish-load", () => {
            win.webContents.send("ip-address", ip.address());
        });
    });
});
