const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");

module.exports = function startSocketServer(httpServer, notifyUI) {
    const io = new Server(httpServer, {
        maxHttpBufferSize: 1e8
    });

    io.on("connection", (socket) => {
        console.log("Client connected");
        socket.on("send-pdf", ({ matricule, fileName, fileBuffer, total }) => {
            const dir = path.join(__dirname, "..", "received", matricule);

            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

            fs.writeFileSync(path.join(dir, fileName), Buffer.from(fileBuffer));

            const count = fs.readdirSync(dir).length;

            notifyUI({
                matricule,
                received: count,
                total
            });
        });
    });
};
