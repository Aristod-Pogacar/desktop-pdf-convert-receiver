const ipElement = document.getElementById("ip");
const transferList = document.getElementById("transferList");
const passwordInput = document.getElementById("pdfPassword");

// Charger le mot de passe sauvegardé
const savedPassword = localStorage.getItem("pdfPassword");

if (savedPassword && passwordInput) {
    passwordInput.value = savedPassword;
}
// Sauvegarder automatiquement quand ça change
if (passwordInput) {
    passwordInput.addEventListener("input", () => {
        console.log("PASSWORD:", passwordInput.value);
        localStorage.setItem("pdfPassword", passwordInput.value);
    });
}

function getPassword() {
    return localStorage.getItem("pdfPassword") || "";
}

// envoyer au main
function sendPasswordToMain() {
    const password = getPassword();
    window.api.setPassword(password);
}

// envoyer au démarrage
sendPasswordToMain();

// envoyer à chaque changement
passwordInput.addEventListener("input", () => {
    localStorage.setItem("pdfPassword", passwordInput.value);
    sendPasswordToMain();
});
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
    data.password = getPassword(); // 🔐 ajout ici
    transfers[data.matricule] = data;
    renderTransfers();
});// window.electron.onUpdate((data) => {
//     transfers[data.matricule] = data;
//     renderTransfers();
// });

// ⏱️ Timeout signalé par le serveur (via main.js -> IPC transfer-timeout)
window.electron.onTransferTimeout((data) => {
    if (transfers[data.matricule]) {
        transfers[data.matricule].timedOut = true;
        transfers[data.matricule].received = data.received;
        transfers[data.matricule].total = data.total;
        if (Array.isArray(data.files)) {
            transfers[data.matricule].files = data.files;
        }
        renderTransfers();
    }
});

function renderTransfers() {
    if (!transferList) return;

    transferList.innerHTML = "";

    const entries = Object.values(transfers);
    console.log("Liste des transferts :", transfers);

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
        } else if (t.timedOut) {
            progress.classList.add("timed-out");
            progress.innerText += " (TIMEOUT)";
        }

        if (Array.isArray(t.files) && t.files.length > 0) {
            const details = document.createElement("div");
            details.className = "file-list";
            const ul = document.createElement("ul");
            t.files.forEach((f) => {
                const liFile = document.createElement("li");
                liFile.className = "file-item";
                liFile.innerText = f;
                ul.appendChild(liFile);
            });
            details.appendChild(ul);
            li.appendChild(details);
        }

        li.appendChild(name);
        li.appendChild(progress);
        transferList.appendChild(li);
    });
}

console.log("Renderer chargé à", new Date().toISOString());

document.getElementById("openExcel").addEventListener("click", async () => {
    const res = await window.api.openExcel();
    if (!res.ok) alert(res.error);
});

document.getElementById("openFolder").addEventListener("click", async () => {
    const res = await window.api.openPdfFolder();
    if (!res.ok) alert(res.error);
});
