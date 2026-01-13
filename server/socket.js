const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");
const { app } = require("electron");

// const BASE_DIR = path.join(app.getPath("documents"), "PDF-Receiver");

const BASE_DIR = "C:/PDF-Reception";
const transfers = new Map();

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
            // // ✅ Tous les fichiers reçus → on répond AU téléphone
            // if (count === total && !completedTransfers.has(transferKey)) {
            //     completedTransfers.add(transferKey);

            //     ack({
            //         status: "ok",
            //         message: `Documents ${matricule} reçus avec succès`
            //     });
            // }

            // ✅ ACK envoyé UNE SEULE FOIS
            if (transfer.received === transfer.total) {
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
