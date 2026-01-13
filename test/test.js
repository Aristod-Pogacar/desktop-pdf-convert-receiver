const io = require("socket.io-client");
const fs = require("fs");

const socket = io("http://localhost:3000");

const files = ["test1.pdf", "test2.pdf"];

files.forEach((file) => {
    socket.emit("send-pdf", {
        matricule: "AMAA9000002356",
        fileName: file,
        total: files.length,
        fileBuffer: fs.readFileSync(file)
    });
});
