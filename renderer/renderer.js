const folders = {};

// window.electron.onIP((ip) => {
//     document.getElementById("ip").innerText = `Adresse IP : ${ip}`;
// });

window.electron.onUpdate((data) => {
    folders[data.matricule] = data;

    const list = document.getElementById("folders");
    list.innerHTML = "";

    Object.values(folders).forEach(f => {
        const li = document.createElement("li");
        li.innerText = `📁 ${f.matricule} → ${f.received} / ${f.total} fichiers`;
        list.appendChild(li);
    });
});
