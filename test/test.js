const io = require("socket.io-client");
const fs = require("fs");

const socket = io("http://localhost:3000");

const files1 = ["test1.pdf", "test2.pdf", "test3.pdf"];
const files2 = ["test5.pdf", "test6.pdf", "test7.pdf", "test8.pdf", "test4.pdf"];

files1.forEach((file) => {
    socket.emit("send-pdf", {
        matricule: "AMAA9000002356",
        fileName: file,
        total: files1.length,
        fileBuffer: fs.readFileSync(file)
    }, (response) => {
        if (response.status === "ok") {
            console.log(response.message);
        }
    });
});
files2.forEach((file) => {
    socket.emit("send-pdf", {
        matricule: "AMAA9000002357",
        fileName: file,
        total: files2.length,
        fileBuffer: fs.readFileSync(file)
    }, (response) => {
        if (response.status === "ok") {
            console.log(response.message);
        }
    });
});
