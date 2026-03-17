# 🚀 Guide de déploiement — BouiSyn Exchange

## Ce dont tu as besoin
- Un compte **GitHub** (gratuit) → https://github.com
- Un compte **Railway** (gratuit) → https://railway.app

---

## Étape 1 — Mettre le projet sur GitHub

1. Va sur https://github.com/new
2. Crée un dépôt nommé `bouisyn-exchange` (privé ou public, peu importe)
3. Clique sur **"uploading an existing file"**
4. Glisse-dépose les fichiers suivants dans la fenêtre :
   - `server.js`
   - `package.json`
   - `railway.json`
   - Le dossier `public/` avec `index.html` dedans
5. Clique **"Commit changes"**

---

## Étape 2 — Déployer sur Railway

1. Va sur https://railway.app et connecte-toi avec ton compte GitHub
2. Clique **"New Project"**
3. Choisis **"Deploy from GitHub repo"**
4. Sélectionne ton dépôt `bouisyn-exchange`
5. Railway détecte automatiquement Node.js et lance le déploiement ✅

---

## Étape 3 — Obtenir ton URL publique

1. Dans ton projet Railway, clique sur le service déployé
2. Va dans l'onglet **"Settings"**
3. Dans la section **"Networking"**, clique **"Generate Domain"**
4. Tu obtiens une URL comme : `https://bouisyn-exchange.up.railway.app`

**C'est tout !** Partage cette URL avec tes joueurs. 🎮

---

## Infos importantes

- **Gratuit** : Railway offre 5$/mois de crédit gratuit, largement suffisant pour un petit jeu
- **Persistance** : Les données sont sauvegardées dans `db.json` sur le serveur
- **Marché partagé** : Tous les joueurs connectés voient les mêmes prix en temps réel
- **Reconnexion auto** : Si la connexion coupe, le client se reconnecte automatiquement

---

## Si tu veux tester en local d'abord

1. Installe Node.js sur https://nodejs.org (version 18+)
2. Ouvre un terminal dans le dossier `bouisyn-server`
3. Lance :
   ```
   npm install
   npm start
   ```
4. Ouvre http://localhost:3000 dans ton navigateur

---

## Questions fréquentes

**Les données sont-elles perdues si le serveur redémarre ?**
Non, elles sont sauvegardées dans `db.json`. Railway garde le fichier entre les redémarrages.

**Combien de joueurs peut supporter le serveur ?**
Facilement 50-100 joueurs simultanés sur le plan gratuit de Railway.

**Comment réinitialiser tous les comptes ?**
Supprime le fichier `db.json` depuis Railway (onglet Files) et redémarre.
