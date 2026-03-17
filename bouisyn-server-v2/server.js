const express = require('express');
const { WebSocketServer } = require('ws');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const http = require('http');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ═══════════════════════════════════════════
//  PERSISTENCE (fichier JSON simple)
// ═══════════════════════════════════════════
const DB_FILE = path.join(__dirname, 'db.json');

function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch(e) {}
  return { accounts: {}, sessions: {} };
}

function saveDB() {
  try { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); } catch(e) {}
}

let db = loadDB();
setInterval(saveDB, 10000); // auto-save toutes les 10s

// ═══════════════════════════════════════════
//  PRIX PARTAGÉS (même marché pour tous)
// ═══════════════════════════════════════════
const INITIAL_WALLET = 2000;
const ASSETS = ['energy', 'genetics', 'syn', 'dia'];

let market = {
  prices: { energy: 284, genetics: 512, syn: 38, dia: 290 },
  opens:  { energy: 284, genetics: 512, syn: 38, dia: 290 },
  history: { energy: [], genetics: [], syn: [], dia: [] }
};

// Générer historique initial
ASSETS.forEach(id => {
  let p = market.prices[id];
  for (let i = 0; i < 60; i++) {
    p = Math.max(5, p + (Math.random() - 0.49) * p * 0.015);
    market.history[id].unshift(Math.round(p * 100) / 100);
  }
  market.history[id].push(market.prices[id]);
  market.opens[id] = market.history[id][0];
});

// Tick des prix toutes les 3.5s — diffusé à TOUS les clients
setInterval(() => {
  ASSETS.forEach(id => {
    const vol = id === 'dia' ? 0.012 : id === 'genetics' ? 0.009 : 0.007;
    const delta = (Math.random() - 0.49) * market.prices[id] * vol;
    market.prices[id] = Math.max(5, Math.round((market.prices[id] + delta) * 100) / 100);
    market.history[id].push(market.prices[id]);
    if (market.history[id].length > 200) market.history[id].shift();
  });
  broadcast({ type: 'price_update', prices: market.prices, history: market.history });
}, 3500);

// ═══════════════════════════════════════════
//  WEBSOCKET
// ═══════════════════════════════════════════
const clients = new Map(); // ws -> { username }

function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(ws => {
    if (ws.readyState === 1) ws.send(msg);
  });
}

function broadcastLeaderboard() {
  const lb = buildLeaderboard();
  broadcast({ type: 'leaderboard', data: lb });
}

function buildLeaderboard() {
  return Object.values(db.accounts)
    .map(acc => ({
      username: acc.username,
      avatarColor: acc.avatarColor,
      total: Math.round(acc.wallet
        + (acc.portfolio?.energy || 0) * market.prices.energy
        + (acc.portfolio?.genetics || 0) * market.prices.genetics
        + (acc.resources?.syn || 0) * market.prices.syn
        + (acc.resources?.dia || 0) * market.prices.dia),
      pnl: Math.round(acc.wallet
        + (acc.portfolio?.energy || 0) * market.prices.energy
        + (acc.portfolio?.genetics || 0) * market.prices.genetics
        + (acc.resources?.syn || 0) * market.prices.syn
        + (acc.resources?.dia || 0) * market.prices.dia
        - INITIAL_WALLET),
      updatedAt: acc.updatedAt || Date.now()
    }))
    .sort((a, b) => b.total - a.total);
}

wss.on('connection', (ws) => {
  clients.set(ws, { username: null });

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch(e) { return; }

    switch (msg.type) {

      case 'auth': {
        const { token } = msg;
        const session = db.sessions[token];
        if (!session) { ws.send(JSON.stringify({ type: 'auth_error', error: 'Session invalide' })); return; }
        clients.set(ws, { username: session.username });
        const acc = db.accounts[session.username];
        ws.send(JSON.stringify({
          type: 'auth_ok',
          user: { username: acc.username, avatarColor: acc.avatarColor, wallet: acc.wallet, portfolio: acc.portfolio, resources: acc.resources, tradeHistory: acc.tradeHistory },
          market: { prices: market.prices, opens: market.opens, history: market.history }
        }));
        ws.send(JSON.stringify({ type: 'leaderboard', data: buildLeaderboard() }));
        break;
      }

      case 'save': {
        const info = clients.get(ws);
        if (!info?.username) return;
        const acc = db.accounts[info.username];
        if (!acc) return;
        acc.wallet = msg.wallet;
        acc.portfolio = msg.portfolio;
        acc.resources = msg.resources;
        acc.tradeHistory = msg.tradeHistory;
        acc.updatedAt = Date.now();
        broadcastLeaderboard();
        break;
      }

      case 'get_leaderboard': {
        ws.send(JSON.stringify({ type: 'leaderboard', data: buildLeaderboard() }));
        break;
      }
    }
  });

  ws.on('close', () => clients.delete(ws));
});

// ═══════════════════════════════════════════
//  REST API — Auth
// ═══════════════════════════════════════════
const AVATARS = ['#2a8fd4','#2ac48a','#8a5ad4','#d4a020','#d44a4a','#20c4d4','#e07030','#c040a0'];

app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Champs manquants' });
  if (username.length < 3) return res.status(400).json({ error: 'Pseudo trop court (3 min)' });
  if (password.length < 4) return res.status(400).json({ error: 'Mot de passe trop court (4 min)' });
  const key = username.toLowerCase();
  if (db.accounts[key]) return res.status(409).json({ error: 'Pseudo déjà pris' });

  const hash = await bcrypt.hash(password, 10);
  const avatarColor = AVATARS[Object.keys(db.accounts).length % AVATARS.length];
  db.accounts[key] = {
    username,
    password: hash,
    avatarColor,
    wallet: INITIAL_WALLET,
    portfolio: { energy: 0, genetics: 0 },
    resources: { syn: 0, dia: 0 },
    tradeHistory: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  const token = uuidv4();
  db.sessions[token] = { username: key, createdAt: Date.now() };
  saveDB();
  broadcastLeaderboard();
  res.json({ token, username, avatarColor });
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Champs manquants' });
  const key = username.toLowerCase();
  const acc = db.accounts[key];
  if (!acc) return res.status(401).json({ error: 'Compte introuvable' });
  const ok = await bcrypt.compare(password, acc.password);
  if (!ok) return res.status(401).json({ error: 'Mot de passe incorrect' });

  const token = uuidv4();
  db.sessions[token] = { username: key, createdAt: Date.now() };
  saveDB();
  res.json({ token, username: acc.username, avatarColor: acc.avatarColor });
});

// ═══════════════════════════════════════════
//  START
// ═══════════════════════════════════════════
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ BouiSyn Exchange serveur démarré sur le port ${PORT}`);
});
