const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
    onIP: (cb) => ipcRenderer.on("ip-address", (_, ip) => cb(ip)),
    onUpdate: (cb) => ipcRenderer.on("update-folder", (_, data) => cb(data))
});
