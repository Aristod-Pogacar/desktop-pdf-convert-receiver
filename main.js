const { app, BrowserWindow } = require("electron");
const path = require("path");
const express = require("express");
const http = require("http");
const ip = require("ip");

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
