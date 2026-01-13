const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");

const BASE_DIR = "C:/PDF-Reception";
const completedTransfers = new Set();

module.exports = function startSocketServer(httpServer, notifyUI) {
    const io = new Server(httpServer, {
        maxHttpBufferSize: 1e8
    });

    io.on("connection", (socket) => {
        console.log("Client connected");
        socket.on("send-pdf", ({ matricule, fileName, fileBuffer, total }, ack) => {
            const dir = path.join(BASE_DIR, matricule);
            const transferKey = `${socket.id}_${matricule}`;
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

            fs.writeFileSync(path.join(dir, fileName), Buffer.from(fileBuffer));

            const count = fs.readdirSync(dir).length;

            notifyUI(({
                matricule,
                received: count,
                total
            }));
            // ✅ Tous les fichiers reçus → on répond AU téléphone
            if (count === total && !completedTransfers.has(transferKey)) {
                completedTransfers.add(transferKey);

                ack({
                    status: "ok",
                    message: `Documents ${matricule} reçus avec succès`
                });
            }
        });
    });
};
