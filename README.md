# 📥 Electron PDF Receiver

Application **Electron Desktop** servant de **serveur de réception de fichiers PDF** envoyés depuis une application mobile via **Socket.IO**.

---

## 🎯 Objectif

- Recevoir des fichiers PDF depuis une application mobile
- Regrouper les fichiers dans des dossiers nommés par **matricule**
- Afficher en temps réel :
  - l’adresse IP du PC
  - les dossiers reçus
  - le nombre de fichiers reçus par dossier (ex: `13 / 18`)

✔️ Aucun login  
✔️ Aucune conversion  
✔️ Conçu pour une digitalisation rapide et locale

---

## 🧱 Architecture du projet

```

electron-pdf-receiver/
│
├── main.js
├── preload.js
│
├── server/
│   └── socket.js
│
├── renderer/
│   ├── index.html
│   └── renderer.js
│
├── received/              # Dossiers générés automatiquement
│
├── test/
│   └── test-client.js     # Client de test Node.js
│
├── package.json
└── README.md

````

---

## 📦 Packages utilisés

### Dépendances principales
- **electron**
- **socket.io**
- **express**
- **ip**

### Dépendances de développement
- **electron-builder**
- **socket.io-client** (pour les tests)

---

## 📥 Installation

### 1️⃣ Cloner le projet
```bash
git clone <url-du-repo>
cd electron-pdf-receiver
````

### 2️⃣ Installer les dépendances

```bash
npm install
```

---

## ▶️ Démarrer l’application Electron

```bash
npm start
```

Au lancement :

* une fenêtre Electron s’ouvre
* l’adresse IP locale du PC est affichée
* le serveur Socket.IO démarre sur le port **3000**

---

## 🌐 Serveur Socket.IO

### 📍 Adresse

```
http://<IP_DU_PC>:3000
```

Exemple :

```
http://192.168.1.15:3000
```

---

## 🔌 Événements Socket.IO

### 📤 `send-pdf`

Événement utilisé pour envoyer un fichier PDF au serveur.

#### 📦 Payload attendu

```json
{
  "matricule": "AMAA2349",
  "fileName": "document1.pdf",
  "total": 18,
  "fileBuffer": "<Buffer PDF>"
}
```

#### 🧠 Comportement serveur

* création automatique du dossier `received/<matricule>`
* sauvegarde du fichier PDF
* comptage des fichiers reçus
* mise à jour de l’interface Electron en temps réel

---

## 🧪 Tester sans application mobile

### 📦 Installer le client Socket

```bash
npm install socket.io-client
```

### ▶️ Lancer le client de test

```bash
node test/test-client.js
```

Les fichiers envoyés seront stockés dans :

```
received/AMAA2349/
```

---

## 🖥️ Interface Electron

Affiche :

* l’adresse IP du PC
* la liste des dossiers reçus
* la progression par dossier

Exemple :

```
Adresse IP : 192.168.1.15

📁 AMAA2349 → 13 / 18 fichiers
📁 BETA0021 → 18 / 18 fichiers
```

---

## 📦 Générer l’exécutable `.exe`

### 1️⃣ Installer electron-builder

```bash
npm install --save-dev electron-builder
```

### 2️⃣ Générer le build

```bash
npm run build
```

### 3️⃣ Résultat

```
dist/
 └── PDF-Receiver-Setup.exe
```

---

## ✅ Avantages

* Architecture simple
* Fonctionne en réseau local
* Aucune dépendance cloud
* Adapté aux transferts en lot
* Facile à maintenir

---

## 🔒 Améliorations possibles

* Code PIN de connexion
* Barre de progression graphique
* Détection des doublons
* Logs d’activité
* Chiffrement des fichiers

---

💡 Projet conçu pour être **rapide, fiable et opérationnel en situation d’urgence**.
