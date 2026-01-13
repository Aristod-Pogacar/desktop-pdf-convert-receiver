const ipElement = document.getElementById("ip");
const transferList = document.getElementById("transferList");

// Stockage en mémoire des transferts
const transfers = {};

// Affichage de l'adresse IP
window.electron.onIP((ip) => {
    if (ipElement) {
        ipElement.innerText = ip;
    }
});

// Mise à jour des transferts
window.electron.onUpdate((data) => {
    transfers[data.matricule] = data;
    renderTransfers();
});

function renderTransfers() {
    if (!transferList) return;

    transferList.innerHTML = "";

    const entries = Object.values(transfers);

    if (entries.length === 0) {
        const li = document.createElement("li");
        li.className = "empty";
        li.innerText = "Aucun transfert pour le moment";
        transferList.appendChild(li);
        return;
    }

    entries.forEach((t) => {
        const li = document.createElement("li");
        li.className = "transfer-item";

        const name = document.createElement("div");
        name.className = "folder-name";
        name.innerText = t.matricule;

        const progress = document.createElement("div");
        progress.className = "progress";
        progress.innerText = `${t.received} / ${t.total}`;

        if (t.received >= t.total) {
            progress.classList.add("completed");
            progress.innerText += " ✓";
        }

        li.appendChild(name);
        li.appendChild(progress);
        transferList.appendChild(li);
    });
}

console.log("Renderer chargé à", new Date().toISOString());
