/* Îles Célestes — jeu de stratégie et de construction sur une île volante. */
'use strict';
(() => {

// =====================================================================
//  Constantes et données du jeu
// =====================================================================
const TW = 64, TH = 32;          // taille d'une case en projection isométrique
const N = 24;                    // la grille fait N x N cases
const CENTER = 12;               // case centrale (le Cœur occupe 11..13)
const MAXL = 5;                  // niveau maximum
const BUILDERS = 2;              // nombre de bâtisseurs
const BATTLE_TIME = 150;         // durée d'une attaque (secondes)
const SAVE_KEY = 'iles-celestes-save-v1';

const RES = { c: { icon: '💎', name: 'cristaux' }, b: { icon: '☁️', name: 'brume' } };

// Bâtiments. Les tableaux sont indexés par niveau (index 0 inutilisé).
const B = {
  core: {
    name: "Cœur de l'île", icon: '🔮', size: 3, h: 50, color: '#7c5cff', res: 'c',
    cost: [0, 0, 1200, 4000, 12000, 30000], time: [0, 0, 60, 240, 600, 1200],
    hp: [0, 1600, 2300, 3100, 4100, 5300],
    desc: "Il fait flotter ton île. L'améliorer débloque de nouveaux bâtiments et niveaux.",
  },
  mine: {
    name: 'Mine de cristal', icon: '⛏️', size: 2, h: 24, color: '#3fb6dd', res: 'b', prod: 'c',
    cost: [0, 150, 500, 1400, 3500, 8000], time: [0, 5, 30, 120, 300, 600],
    hp: [0, 320, 380, 450, 530, 620],
    rate: [0, 900, 1800, 3000, 4500, 6600], cap: [0, 600, 1200, 2400, 4000, 6000],
    desc: 'Extrait des cristaux. Touche-la pour récolter.',
  },
  puits: {
    name: 'Puits de brume', icon: '🌫️', size: 2, h: 24, color: '#b47cff', res: 'c', prod: 'b',
    cost: [0, 150, 500, 1400, 3500, 8000], time: [0, 5, 30, 120, 300, 600],
    hp: [0, 320, 380, 450, 530, 620],
    rate: [0, 900, 1800, 3000, 4500, 6600], cap: [0, 600, 1200, 2400, 4000, 6000],
    desc: 'Condense la brume des nuages. Touche-le pour récolter.',
  },
  coffre: {
    name: 'Coffre à cristaux', icon: '🧰', size: 2, h: 30, color: '#e9a15a', res: 'b', store: 'c',
    cost: [0, 300, 900, 2500, 6000, 14000], time: [0, 10, 45, 150, 360, 720],
    hp: [0, 500, 650, 800, 1000, 1250], cap: [0, 1500, 4000, 9000, 18000, 35000],
    desc: 'Augmente la quantité de cristaux que tu peux garder.',
  },
  reservoir: {
    name: 'Réservoir de brume', icon: '🫙', size: 2, h: 30, color: '#9d5ce0', res: 'c', store: 'b',
    cost: [0, 300, 900, 2500, 6000, 14000], time: [0, 10, 45, 150, 360, 720],
    hp: [0, 500, 650, 800, 1000, 1250], cap: [0, 1500, 4000, 9000, 18000, 35000],
    desc: 'Augmente la quantité de brume que tu peux garder.',
  },
  perchoir: {
    name: 'Perchoir de guerre', icon: '🪶', size: 3, h: 34, color: '#e2674a', res: 'b',
    cost: [0, 200, 800, 2500, 6000, 15000], time: [0, 10, 60, 180, 420, 900],
    hp: [0, 500, 600, 720, 860, 1000],
    desc: 'Entraîne tes troupes. Chaque niveau débloque une nouvelle troupe.',
  },
  nid: {
    name: 'Nid des troupes', icon: '⛺', size: 3, h: 16, color: '#86b85c', res: 'b',
    cost: [0, 250, 1000, 3000, 7000, 16000], time: [0, 10, 60, 180, 420, 900],
    hp: [0, 400, 480, 560, 650, 750], cap: [0, 20, 30, 40, 50, 60],
    desc: 'Tes troupes y attendent la bataille. Plus de niveau = plus de place.',
  },
  baliste: {
    name: 'Baliste', icon: '🎯', size: 2, h: 32, color: '#a07a55', res: 'c',
    cost: [0, 250, 900, 2500, 6000, 14000], time: [0, 10, 60, 240, 600, 1200],
    hp: [0, 420, 540, 680, 840, 1020],
    def: { range: 8, dps: [0, 22, 30, 40, 52, 66], rate: 1.2, ground: true, air: false, kind: 'bolt' },
    desc: 'Tire de lourds carreaux très loin. Ne touche pas les troupes volantes.',
  },
  eclair: {
    name: 'Tour à éclairs', icon: '⚡', size: 2, h: 46, color: '#e8c21c', res: 'c',
    cost: [0, 600, 1600, 4000, 9000, 18000], time: [0, 20, 90, 300, 600, 1200],
    hp: [0, 380, 480, 600, 740, 900],
    def: { range: 6, dps: [0, 15, 21, 28, 37, 48], rate: 1, ground: true, air: true, kind: 'zap', chain: 3 },
    desc: "L'éclair rebondit sur plusieurs ennemis. Touche le sol et les airs.",
  },
  vent: {
    name: 'Canon à vent', icon: '🌀', size: 2, h: 28, color: '#6fb8d8', res: 'c',
    cost: [0, 1200, 2800, 6000, 12000, 22000], time: [0, 30, 120, 300, 720, 1500],
    hp: [0, 450, 560, 690, 840, 1000],
    def: { range: 5.5, dps: [0, 10, 14, 19, 25, 32], rate: 1.6, ground: true, air: true, kind: 'gust', knock: 1.3 },
    desc: 'Souffle une rafale qui repousse les ennemis en arrière.',
  },
  mur: {
    name: 'Mur de roc-nuage', icon: '🧱', size: 1, h: 14, color: '#b9c0cc', res: 'c', wall: true,
    cost: [0, 50, 200, 600, 1500, 4000], time: [0, 0, 0, 0, 0, 0],
    hp: [0, 300, 600, 1100, 1800, 2800],
    desc: 'Bloque les troupes au sol. Se construit instantanément.',
  },
};

// Nombre maximum de chaque bâtiment selon le niveau du Cœur.
const LIMITS = {
  core: [0, 1, 1, 1, 1, 1], mine: [0, 2, 3, 4, 5, 6], puits: [0, 2, 3, 4, 5, 6],
  coffre: [0, 1, 1, 2, 2, 3], reservoir: [0, 1, 1, 2, 2, 3], perchoir: [0, 1, 1, 1, 1, 1],
  nid: [0, 1, 1, 2, 2, 3], baliste: [0, 1, 2, 2, 3, 4], eclair: [0, 0, 1, 1, 2, 3],
  vent: [0, 0, 0, 1, 1, 2], mur: [0, 20, 40, 60, 90, 120],
};
const SHOP_ORDER = ['mine', 'puits', 'coffre', 'reservoir', 'nid', 'perchoir', 'baliste', 'eclair', 'vent', 'mur'];

const TROOPS = {
  plumeur: { name: 'Plumeur', icon: '🐦', space: 1, cost: 25, time: 3, hp: 80, dps: 14, range: 0.7, speed: 1.5,
    target: 'any', unlock: 1, desc: 'Guerrier à plumes, rapide et pas cher.' },
  archere: { name: 'Archère des vents', icon: '🏹', space: 1, cost: 50, time: 4, hp: 40, dps: 11, range: 3.5, speed: 1.6,
    target: 'any', proj: 'arrow', unlock: 2, desc: 'Tire de loin mais elle est fragile.' },
  sapeur: { name: 'Sapeur-nuage', icon: '💣', space: 2, cost: 100, time: 6, hp: 40, boom: 70, range: 0.6, speed: 2.2,
    target: 'wall', unlock: 3, desc: 'Fonce sur les murs et explose (dégâts x5 sur les murs).' },
  golem: { name: 'Golem de roc', icon: '🗿', space: 5, cost: 250, time: 12, hp: 650, dps: 24, range: 0.8, speed: 0.75,
    target: 'def', unlock: 4, desc: "Très solide. Attaque d'abord les défenses." },
  aeronef: { name: 'Aéronef', icon: '🎈', space: 8, cost: 600, time: 20, hp: 420, dps: 38, atk: 2, range: 1.6, speed: 0.9,
    air: true, proj: 'bomb', target: 'any', unlock: 5,
    desc: 'Vole au-dessus des murs et lâche des bombes. Seuls les éclairs et le vent peuvent le toucher.' },
};
const TROOP_ORDER = Object.keys(TROOPS);

// =====================================================================
//  Utilitaires
// =====================================================================
const $ = (s) => document.querySelector(s);
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const now = () => Date.now();
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = randi(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const fmt = (n) => {
  n = Math.floor(n);
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1e5) return Math.floor(n / 1000) + 'k';
  return n.toLocaleString('fr-FR');
};
const fmtTime = (s) => {
  s = Math.ceil(s);
  if (s <= 0) return 'instantané';
  if (s < 60) return s + 's';
  if (s < 3600) return Math.floor(s / 60) + 'm' + (s % 60 ? ' ' + (s % 60) + 's' : '');
  return Math.floor(s / 3600) + 'h ' + Math.floor((s % 3600) / 60) + 'm';
};
const costStr = (r, n) => `${RES[r].icon} ${fmt(n)}`;
const iso = (x, y) => ({ x: (x - y) * TW / 2, y: (x + y) * TH / 2 });
const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };

// Forme de l'île (masque des cases de terre)
const LAND = new Uint8Array(N * N);
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
  const dx = x + 0.5 - N / 2, dy = y + 0.5 - N / 2, a = Math.atan2(dy, dx);
  const r = N / 2 - 0.6 + Math.sin(a * 3 + 1) * 0.5 + Math.cos(a * 5) * 0.35;
  LAND[y * N + x] = Math.hypot(dx, dy) < r ? 1 : 0;
}
const isLand = (x, y) => x >= 0 && y >= 0 && x < N && y < N && LAND[y * N + x] === 1;

const shadeCache = new Map();
function shade(hex, amt) {
  const key = hex + amt;
  if (shadeCache.has(key)) return shadeCache.get(key);
  let r, g, b;
  if (hex[0] === '#') { const v = parseInt(hex.slice(1), 16); r = (v >> 16) & 255; g = (v >> 8) & 255; b = v & 255; }
  else [r, g, b] = hex.match(/\d+/g).map(Number); // format rgb(r,g,b)
  if (amt < 0) { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
  else { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
  const out = `rgb(${r | 0},${g | 0},${b | 0})`;
  shadeCache.set(key, out);
  return out;
}

// =====================================================================
//  Sauvegarde / état du joueur
// =====================================================================
let S = null;

function newGame() {
  const s = { v: 1, res: { c: 800, b: 800 }, bl: [], army: { plumeur: 15 }, queue: [], glory: 0, nextId: 1, last: now(), welcomed: false };
  const add = (t, x, y) => s.bl.push({ id: s.nextId++, t, x, y, l: 1, ue: 0, st: 0 });
  add('core', 11, 11);
  add('mine', 7, 9); add('puits', 7, 12);
  add('coffre', 15, 10); add('reservoir', 15, 13);
  add('perchoir', 10, 16); add('nid', 13, 16);
  add('baliste', 11, 7);
  return s;
}

function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || s.v !== 1 || !Array.isArray(s.bl)) return null;
    return s;
  } catch (e) { return null; }
}
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* stockage indisponible */ } }

const coreL = () => (S.bl.find((b) => b.t === 'core') || { l: 1 }).l;
const countT = (t) => S.bl.filter((b) => b.t === t).length;
const busyBuilders = () => S.bl.filter((b) => b.ue > 0).length;
const barracksL = () => S.bl.reduce((m, b) => (b.t === 'perchoir' ? Math.max(m, b.l) : m), 0);
function capOf(r) {
  let c = 1000 * coreL();
  for (const b of S.bl) { const d = B[b.t]; if (d.store === r && b.l > 0) c += d.cap[b.l]; }
  return c;
}
const armyCap = () => S.bl.reduce((a, b) => (b.t === 'nid' && b.l > 0 ? a + B.nid.cap[b.l] : a), 0);
const armyCount = () => TROOP_ORDER.reduce((a, t) => a + (S.army[t] || 0), 0);
const armySpace = () => TROOP_ORDER.reduce((a, t) => a + (S.army[t] || 0) * TROOPS[t].space, 0)
  + S.queue.reduce((a, q) => a + TROOPS[q.t].space, 0);

function spend(r, n) {
  if (S.res[r] < n) { toast(`Pas assez de ${RES[r].name} ${RES[r].icon} (il manque ${fmt(n - S.res[r])})`); return false; }
  S.res[r] -= n;
  return true;
}
function gain(r, n) {
  const add = Math.max(0, Math.min(n, capOf(r) - S.res[r]));
  S.res[r] += add;
  return add;
}

// =====================================================================
//  Économie (production, constructions, entraînement)
// =====================================================================
function econTick() {
  const t = now();
  const dt = clamp((t - S.last) / 1000, 0, 3600 * 24 * 7);
  S.last = t;
  for (const b of S.bl) {
    const d = B[b.t];
    if (b.ue && t >= b.ue) {
      b.ue = 0; b.l++;
      if (mode === 'village') {
        toast(`${d.name} ${b.l === 1 ? 'construit' : 'niveau ' + b.l} !`);
        addFx('text', b.x + d.size / 2, b.y + d.size / 2, { text: '⬆️ Niv ' + b.l, color: '#8dff8d' });
        if (sel === b) renderPanel();
      }
      save();
    }
    if (d.prod && b.l > 0) b.st = Math.min(d.cap[b.l], (b.st || 0) + d.rate[b.l] * dt / 3600);
  }
  // Entraînement des troupes
  if (barracksL() > 0) {
    let left = dt, done = false;
    while (left > 0 && S.queue.length) {
      const q = S.queue[0];
      if (q.rem > left) { q.rem -= left; left = 0; }
      else { left -= q.rem; S.army[q.t] = (S.army[q.t] || 0) + 1; S.queue.shift(); done = true; }
    }
    if (done && modalKind === 'army') renderArmy();
  }
}

function upgradeBlock(b) {
  if (b.ue) return 'Amélioration en cours';
  if (b.l >= MAXL) return 'Niveau maximum';
  if (b.t !== 'core' && b.l + 1 > coreL()) return `Cœur niveau ${b.l + 1} requis`;
  return null;
}

function startUpgrade(b) {
  const d = B[b.t], why = upgradeBlock(b);
  if (why) return toast(why);
  const time = d.time[b.l + 1];
  if (time > 0 && busyBuilders() >= BUILDERS) return toast('Tous les bâtisseurs sont occupés 🔨');
  if (!spend(d.res, d.cost[b.l + 1])) return;
  if (time > 0) b.ue = now() + time * 1000;
  else { b.l++; addFx('text', b.x + 0.5, b.y + 0.5, { text: '⬆️', color: '#8dff8d' }); }
  save(); renderPanel(); updateTopbar();
}

function speedCost(b) { return Math.max(1, Math.ceil((b.ue - now()) / 1000 * 1.5)); }
function speedUp(b) {
  if (!b.ue) return;
  if (!spend('c', speedCost(b))) return;
  b.ue = now(); econTick(); renderPanel();
}

function collect(b) {
  const d = B[b.t];
  const got = gain(d.prod, Math.floor(b.st));
  if (got <= 0) { toast(`Stockage de ${RES[d.prod].name} plein ! Construis ou améliore un ${d.prod === 'c' ? 'Coffre' : 'Réservoir'}.`); return; }
  b.st -= got;
  addFx('text', b.x + 1, b.y + 1, { text: `+${fmt(got)} ${RES[d.prod].icon}`, color: '#fff' });
  save(); updateTopbar();
}

function enqueue(t) {
  const d = TROOPS[t];
  if (barracksL() < d.unlock) return toast(`Perchoir de guerre niveau ${d.unlock} requis`);
  if (armySpace() + d.space > armyCap()) return toast("Plus de place dans le Nid ! Améliore-le ou construis-en un autre.");
  if (!spend('b', d.cost)) return;
  S.queue.push({ t, rem: d.time });
  save(); renderArmy(); updateTopbar();
}
function dequeue(i) {
  const q = S.queue[i];
  if (!q) return;
  S.res.b = Math.min(capOf('b'), S.res.b + TROOPS[q.t].cost);
  S.queue.splice(i, 1);
  save(); renderArmy(); updateTopbar();
}

// =====================================================================
//  Placement des bâtiments
// =====================================================================
function validPos(list, b) {
  const s = B[b.t].size;
  for (let y = b.y; y < b.y + s; y++) for (let x = b.x; x < b.x + s; x++) if (!isLand(x, y)) return false;
  for (const o of list) {
    if (o === b) continue;
    const os = B[o.t].size;
    if (b.x < o.x + os && b.x + s > o.x && b.y < o.y + os && b.y + s > o.y) return false;
  }
  return true;
}

function findSpot(t, cx, cy, prefer) {
  const s = B[t].size;
  const probe = { t, x: 0, y: 0 };
  if (prefer) for (const [x, y] of prefer) { probe.x = x; probe.y = y; if (validPos(S.bl, probe)) return [x, y]; }
  for (let r = 0; r < N; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    probe.x = Math.round(cx - s / 2) + dx; probe.y = Math.round(cy - s / 2) + dy;
    if (validPos(S.bl, probe)) return [probe.x, probe.y];
  }
  return null;
}

let placing = null;     // { b, lastWall }
let sel = null;         // bâtiment sélectionné

function shopBlock(t) {
  const L = coreL(), lim = LIMITS[t][L];
  if (lim === 0) { const k = LIMITS[t].findIndex((v) => v > 0); return `Cœur niveau ${k} requis`; }
  if (countT(t) >= lim) return 'Maximum atteint';
  return null;
}

function startPlacing(t, prefer) {
  const why = shopBlock(t);
  if (why) { toast(why); return false; }
  const c = s2w(W / 2, H / 2);
  const spot = findSpot(t, c.x, c.y, prefer);
  if (!spot) { toast("Plus de place sur l'île !"); return false; }
  placing = { b: { id: -1, t, x: spot[0], y: spot[1], l: 0, ue: 0, st: 0 } };
  sel = null;
  renderPanel();
  return true;
}

function confirmPlace() {
  const b = placing.b, d = B[b.t];
  if (!validPos(S.bl, b)) return toast('Emplacement occupé');
  const why = shopBlock(b.t);
  if (why) return toast(why);
  const time = d.time[1];
  if (time > 0 && busyBuilders() >= BUILDERS) return toast('Tous les bâtisseurs sont occupés 🔨');
  if (!spend(d.res, d.cost[1])) return;
  b.id = S.nextId++;
  if (time > 0) b.ue = now() + time * 1000; else b.l = 1;
  S.bl.push(b);
  save(); updateTopbar();
  placing = null;
  if (b.t === 'mur' && !shopBlock('mur') && S.res.c >= d.cost[1]) {
    // On enchaîne les murs : le suivant se place juste à côté.
    const dx = b._dx || 1, dy = b._dy || 0;
    const opts = [[dx, dy], [1, 0], [0, 1], [-1, 0], [0, -1]];
    const prefer = opts.map(([a, c]) => [b.x + a, b.y + c]);
    if (startPlacing('mur', prefer)) {
      const nb = placing.b; nb._dx = nb.x - b.x; nb._dy = nb.y - b.y;
      if (Math.abs(nb._dx) + Math.abs(nb._dy) !== 1) { nb._dx = 1; nb._dy = 0; }
    }
  } else renderPanel();
}

// =====================================================================
//  Génération d'une île ennemie
// =====================================================================
const NAMES_A = ['Nimbus', 'Azur', 'Zéphyr', 'Aurore', 'Cirrus', 'Plume', 'Écume', 'Orage', 'Brise', 'Céleste', 'Éther', 'Opale'];
const NAMES_B = ['des Vents', 'Lointaine', "d'Argent", 'Perdue', 'du Crépuscule', 'Tonnerre', 'des Aigles', 'Brumeuse', 'Dorée'];

function genEnemy() {
  const pl = coreL();
  const L = clamp(pl + (Math.random() < 0.35 ? -1 : 0) + (Math.random() < 0.2 ? 1 : 0), 1, MAXL);
  const occ = new Array(N * N).fill(null), reserved = new Uint8Array(N * N), bl = [];
  const cheb = (x, y) => Math.max(Math.abs(x - CENTER), Math.abs(y - CENTER));
  const rings = L >= 3 ? [4, 7] : [4];
  for (const r of rings) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++)
    if (cheb(x, y) === r && isLand(x, y)) reserved[y * N + x] = 1;

  const put = (t, x, y, l) => {
    const d = B[t], b = { id: bl.length, t, x, y, l, hp: d.hp[l], max: d.hp[l], dead: false, cd: rand(0, 0.6), loot: { c: 0, b: 0 }, hit: 0 };
    bl.push(b);
    for (let j = 0; j < d.size; j++) for (let i = 0; i < d.size; i++) occ[(y + j) * N + x + i] = b;
    return b;
  };
  const fits = (x, y, s, region) => {
    for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) {
      const tx = x + i, ty = y + j;
      if (!isLand(tx, ty)) return false;
      const k = ty * N + tx;
      if (occ[k] || reserved[k]) return false;
      const c = cheb(tx, ty);
      if (region === 'in' && c > 3) return false;
      if (region === 'out' && c < 5) return false;
    }
    return true;
  };
  const place = (t, l, region) => {
    const s = B[t].size;
    for (let k = 0; k < 400; k++) {
      const x = randi(0, N - s), y = randi(0, N - s);
      if (fits(x, y, s, region)) return put(t, x, y, l);
    }
    return null;
  };
  const lv = () => clamp(L - (Math.random() < 0.4 ? 1 : 0), 1, L);

  put('core', 11, 11, L);
  const inner = [], outer = [];
  for (const t of ['baliste', 'eclair', 'vent', 'coffre', 'reservoir']) for (let k = 0; k < LIMITS[t][L]; k++) inner.push(t);
  for (const t of ['mine', 'puits']) for (let k = 0; k < Math.max(1, LIMITS[t][L] - randi(0, 1)); k++) outer.push(t);
  outer.push('perchoir');
  for (let k = 0; k < LIMITS.nid[L]; k++) outer.push('nid');
  for (const t of shuffle(inner)) { const l = lv(); place(t, l, 'in') || place(t, l, 'out') || place(t, l, 'any'); }
  for (const t of shuffle(outer)) { const l = lv(); place(t, l, 'out') || place(t, l, 'any'); }

  // Murs sur les anneaux réservés
  let walls = LIMITS.mur[L];
  const gap = 0.14 - L * 0.02;
  for (const r of rings) {
    const ring = [];
    for (let i = -r; i <= r; i++) ring.push([CENTER + i, CENTER - r]);
    for (let i = -r + 1; i <= r; i++) ring.push([CENTER + r, CENTER + i]);
    for (let i = r - 1; i >= -r; i--) ring.push([CENTER + i, CENTER + r]);
    for (let i = r - 1; i > -r; i--) ring.push([CENTER - r, CENTER + i]);
    for (const [x, y] of ring) {
      if (walls <= 0) break;
      if (!isLand(x, y) || occ[y * N + x] || Math.random() < gap) continue;
      put('mur', x, y, lv()); walls--;
    }
  }

  // Butin réparti dans les bâtiments
  const total = { c: Math.round((300 + 380 * L * L) * rand(0.8, 1.3)), b: Math.round((300 + 380 * L * L) * rand(0.8, 1.3)) };
  for (const r of ['c', 'b']) {
    const w = bl.map((b) => (b.t === 'core' ? 2 : B[b.t].store === r ? 5 : B[b.t].prod === r ? 1.5 : 0));
    const sum = w.reduce((a, v) => a + v, 0);
    bl.forEach((b, i) => { b.loot[r] = Math.floor(total[r] * w[i] / sum); });
  }

  // Zones où l'on ne peut pas déposer de troupes (autour des bâtiments)
  const forbid = new Uint8Array(N * N);
  for (const b of bl) {
    const s = B[b.t].size;
    for (let y = b.y - 1; y < b.y + s + 1; y++) for (let x = b.x - 1; x < b.x + s + 1; x++)
      if (x >= 0 && y >= 0 && x < N && y < N) forbid[y * N + x] = 1;
  }

  const a = rand(0, Math.PI * 2);
  return {
    name: `Île ${NAMES_A[randi(0, NAMES_A.length - 1)]} ${NAMES_B[randi(0, NAMES_B.length - 1)]}`,
    L, bl, occ, forbid, total, got: { c: 0, b: 0 },
    units: [], proj: [], phase: 'scout', time: BATTLE_TIME, sel: null, used: {},
    wind: { x: Math.cos(a), y: Math.sin(a) }, flash: 0, endT: 0,
    totalB: bl.filter((b) => !B[b.t].wall).length, destroyed: 0, coreDead: false, stars: 0, pct: 0,
  };
}

// =====================================================================
//  Combat
// =====================================================================
let E = null;

function distRect(x, y, b) {
  const s = B[b.t].size;
  const dx = Math.max(b.x - x, 0, x - (b.x + s)), dy = Math.max(b.y - y, 0, y - (b.y + s));
  return Math.hypot(dx, dy);
}
function wallAt(x, y) {
  const tx = Math.floor(x), ty = Math.floor(y);
  if (tx < 0 || ty < 0 || tx >= N || ty >= N) return null;
  const b = E.occ[ty * N + tx];
  return b && !b.dead && B[b.t].wall ? b : null;
}

function findTarget(u) {
  const d = TROOPS[u.t];
  const alive = E.bl.filter((b) => !b.dead);
  let list = alive.filter((b) => !B[b.t].wall);
  if (d.target === 'def') { const defs = list.filter((b) => B[b.t].def); if (defs.length) list = defs; }
  if (d.target === 'wall') { const walls = alive.filter((b) => B[b.t].wall); if (walls.length) list = walls; }
  let best = null, bd = 1e9;
  for (const b of list) { const dd = distRect(u.x, u.y, b); if (dd < bd) { bd = dd; best = b; } }
  return best;
}

function damageBuilding(b, dmg) {
  if (b.dead) return;
  b.hp -= dmg; b.hit = 0.12;
  if (b.hp > 0) return;
  b.hp = 0; b.dead = true;
  const d = B[b.t], cx = b.x + d.size / 2, cy = b.y + d.size / 2;
  addFx('boom', cx, cy, { r: d.size * 0.9 });
  if (d.wall) return;
  E.destroyed++;
  let txt = '';
  for (const r of ['c', 'b']) if (b.loot[r] > 0) { E.got[r] += b.loot[r]; txt += `+${fmt(b.loot[r])}${RES[r].icon} `; }
  if (txt) addFx('text', cx, cy, { text: txt.trim(), color: '#ffe27a' });
  if (b.t === 'core') E.coreDead = true;
  E.pct = Math.floor(E.destroyed / E.totalB * 100);
  E.stars = (E.pct >= 50 ? 1 : 0) + (E.coreDead ? 1 : 0) + (E.pct === 100 ? 1 : 0);
  updateBattleHud();
}

function damageUnit(u, dmg) {
  if (u.dead) return;
  u.hp -= dmg; u.hit = 0.12;
  if (u.hp <= 0) { u.dead = true; addFx('puff', u.x, u.y, { air: u.air }); }
}

function mkUnit(t, x, y) {
  const d = TROOPS[t];
  return { t, x, y, hp: d.hp, max: d.hp, tg: null, cd: 0.4, air: !!d.air, dead: false, hit: 0, ph: rand(0, 6), moving: false };
}

function deployAt(sx, sy) {
  if (!E || E.phase === 'end') return false;
  const t = E.sel;
  if (!t || !(S.army[t] > 0)) { toast('Choisis une troupe en bas'); return false; }
  const w = s2w(sx, sy), tx = Math.floor(w.x), ty = Math.floor(w.y);
  if (!isLand(tx, ty) || E.forbid[ty * N + tx]) { E.flash = 1.6; return false; }
  S.army[t]--;
  E.used[t] = (E.used[t] || 0) + 1;
  E.units.push(mkUnit(t, w.x, w.y));
  addFx('puff', w.x, w.y, { air: !!TROOPS[t].air, small: true });
  if (E.phase === 'scout') { E.phase = 'fight'; renderBattleActions(); }
  if (S.army[t] <= 0) E.sel = TROOP_ORDER.find((k) => S.army[k] > 0) || null;
  renderTroopbar(); updateBattleHud();
  return true;
}

function unitUpdate(u, dt) {
  const d = TROOPS[u.t];
  if (!u.tg || u.tg.dead) u.tg = findTarget(u);
  const b = u.tg;
  u.moving = false;
  if (!b) return;
  if (distRect(u.x, u.y, b) <= d.range) {
    u.cd -= dt;
    if (u.cd > 0) return;
    u.cd = d.atk || 1;
    u.lunge = 0.15;
    if (u.t === 'sapeur') {
      for (const w of E.bl) {
        if (w.dead) continue;
        if (B[w.t].wall && distRect(u.x, u.y, w) < 1.6) damageBuilding(w, d.boom * 5);
      }
      if (!B[b.t].wall) damageBuilding(b, d.boom);
      addFx('boom', u.x, u.y, { r: 1.2 });
      u.hp = 0; u.dead = true;
      return;
    }
    const dmg = d.dps * (d.atk || 1);
    if (d.proj) {
      const s = B[b.t].size;
      E.proj.push({ x: u.x, y: u.y, z: u.air ? 36 : 12, tgt: b, isU: false, tx: b.x + s / 2, ty: b.y + s / 2, tz: B[b.t].h / 2,
        dmg, spd: d.proj === 'bomb' ? 4 : 10, kind: d.proj, d0: 0 });
    } else damageBuilding(b, dmg);
    return;
  }
  const s = B[b.t].size;
  const px = clamp(u.x, b.x, b.x + s), py = clamp(u.y, b.y, b.y + s);
  let dx = px - u.x, dy = py - u.y;
  const l = Math.hypot(dx, dy) || 1;
  dx /= l; dy /= l;
  const wf = 1 + (u.air ? 0.45 : 0.25) * (dx * E.wind.x + dy * E.wind.y); // effet du vent
  const step = d.speed * wf * dt;
  const nx = u.x + dx * step, ny = u.y + dy * step;
  if (!u.air) { const w = wallAt(nx, ny); if (w && w !== b) { u.tg = w; return; } }
  u.x = nx; u.y = ny; u.moving = true; u.face = dx - dy;
}

function defenseUpdate(b, dt) {
  const d = B[b.t], df = d.def;
  b.cd -= dt;
  if (b.cd > 0) return;
  const s = d.size, cx = b.x + s / 2, cy = b.y + s / 2;
  let best = null, bd = 1e9;
  for (const u of E.units) {
    if (u.dead || (u.air && !df.air) || (!u.air && !df.ground)) continue;
    const dd = Math.hypot(u.x - cx, u.y - cy);
    if (dd <= df.range && dd < bd) { bd = dd; best = u; }
  }
  if (!best) { b.cd = 0.15; return; }
  b.cd = df.rate;
  b.aim = Math.atan2(best.y - cy, best.x - cx);
  const dmg = df.dps[b.l] * df.rate;
  if (df.kind === 'zap') {
    const pts = [{ x: cx, y: cy, z: d.h + 6 }];
    const hit = new Set();
    let cur = best, dm = dmg;
    for (let k = 0; k < df.chain && cur; k++) {
      hit.add(cur); damageUnit(cur, dm);
      pts.push({ x: cur.x, y: cur.y, z: cur.air ? 36 : 10 });
      dm *= 0.7;
      let nxt = null, nd = 2.6;
      for (const u of E.units) {
        if (u.dead || hit.has(u)) continue;
        const dd = Math.hypot(u.x - cur.x, u.y - cur.y);
        if (dd < nd) { nd = dd; nxt = u; }
      }
      cur = nxt;
    }
    addFx('zap', cx, cy, { pts });
  } else {
    E.proj.push({ x: cx, y: cy, z: d.h, tgt: best, isU: true, dmg, spd: df.kind === 'gust' ? 8 : 13, kind: df.kind,
      knock: df.knock || 0, ox: cx, oy: cy, d0: 0 });
  }
}

function projUpdate(p, dt) {
  let tx, ty, tz;
  if (p.isU) { tx = p.tgt.x; ty = p.tgt.y; tz = p.tgt.air ? 36 : 10; } else { tx = p.tx; ty = p.ty; tz = p.tz; }
  const dx = tx - p.x, dy = ty - p.y, dist = Math.hypot(dx, dy);
  if (!p.d0) { p.d0 = Math.max(dist, 0.01); p.z0 = p.z; }
  const step = p.spd * dt;
  if (dist <= step + 0.05) {
    p.done = true;
    if (p.isU) {
      if (!p.tgt.dead) {
        damageUnit(p.tgt, p.dmg);
        if (p.knock && !p.tgt.dead) {
          const kx = p.tgt.x - p.ox, ky = p.tgt.y - p.oy, kl = Math.hypot(kx, ky) || 1;
          let nx = clamp(p.tgt.x + kx / kl * p.knock, 0.2, N - 0.2), ny = clamp(p.tgt.y + ky / kl * p.knock, 0.2, N - 0.2);
          if (!p.tgt.air && wallAt(nx, ny)) { nx = p.tgt.x; ny = p.tgt.y; }
          p.tgt.x = nx; p.tgt.y = ny; p.tgt.tg = null;
        }
      }
    } else {
      damageBuilding(p.tgt, p.dmg);
      if (p.kind === 'bomb') addFx('boom', tx, ty, { r: 0.6 });
    }
    return;
  }
  p.x += dx / dist * step; p.y += dy / dist * step;
  p.z = tz + (p.z0 - tz) * (Math.max(0, dist - step) / p.d0);
}

function battleUpdate(dt) {
  if (E.flash > 0) E.flash -= dt;
  // Maintenir le doigt appuyé = déposer des troupes en continu
  if (gest && gest.mode === 'pan' && !gest.moved && E.phase !== 'end' && E.sel) {
    gest.hold += dt;
    if (gest.hold > 0.3) {
      gest.rep -= dt;
      if (gest.rep <= 0) { gest.rep = 0.1; if (deployAt(gest.lx, gest.ly)) gest.deployed = true; }
    }
  }
  if (E.phase === 'fight') {
    E.time -= dt;
    for (const u of E.units) if (!u.dead) unitUpdate(u, dt);
    for (const b of E.bl) if (!b.dead && B[b.t].def) defenseUpdate(b, dt);
    for (const p of E.proj) projUpdate(p, dt);
    E.proj = E.proj.filter((p) => !p.done);
    for (const u of E.units) { if (u.hit > 0) u.hit -= dt; if (u.lunge > 0) u.lunge -= dt; }
    E.units = E.units.filter((u) => !u.dead);
    for (const b of E.bl) if (b.hit > 0) b.hit -= dt;

    let over = false;
    if (E.destroyed >= E.totalB) over = true;
    else if (E.time <= 0) { E.time = 0; over = true; }
    else if (E.units.length === 0 && armyCount() === 0) over = true;
    if (over) { E.endT += dt; if (E.endT > 1.2) endBattle(); } else E.endT = 0;
    $('#b-timer').textContent = fmtClock(E.time);
  }
}
const starsHtml = (n) => '<span>★</span>'.repeat(n) + '<span class="off">★</span>'.repeat(3 - n);
const fmtClock = (t) => { t = Math.ceil(t); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };

function startScout(free) {
  if (armyCount() === 0) { toast("Tu n'as pas de troupes ! Entraîne-les au Perchoir."); openArmy(); return; }
  if (!free) {
    const c = 20 * coreL();
    if (!spend('c', c)) return;
  }
  E = genEnemy();
  E.sel = TROOP_ORDER.find((k) => S.army[k] > 0) || null;
  mode = 'battle'; sel = null; placing = null; FX.length = 0;
  closeModal();
  $('#hud-village').classList.add('hidden');
  $('#hud-battle').classList.remove('hidden');
  resetCam();
  renderTroopbar(); renderBattleActions(); updateBattleHud();
  const sx = E.wind.x - E.wind.y, sy = (E.wind.x + E.wind.y) / 2;
  $('#wind-arrow').style.transform = `rotate(${Math.atan2(sy, sx)}rad)`;
  $('#b-timer').textContent = fmtClock(E.time);
}

function endBattle() {
  if (E.phase === 'end') return;
  const deployed = Object.values(E.used).reduce((a, v) => a + v, 0);
  E.phase = 'end';
  const got = { c: gain('c', E.got.c), b: gain('b', E.got.b) };
  let dg = 0;
  if (deployed > 0) { dg = E.stars > 0 ? 6 + E.stars * 8 + E.L * 2 : -Math.min(S.glory, 8); S.glory += dg; }
  save(); updateTopbar();
  const stars = starsHtml(E.stars);
  const title = deployed === 0 ? 'Retour au village' : E.stars === 3 ? 'Victoire totale !' : E.stars > 0 ? 'Victoire !' : 'Défaite…';
  openModal(`
    <h2>${title}</h2>
    <div class="result-stars">${stars}</div>
    <p style="text-align:center">Destruction : <b>${E.pct} %</b>${E.coreDead ? ' · Cœur détruit 🔮' : ''}</p>
    <div class="result-loot"><span class="pill">💎 +${fmt(got.c)}</span><span class="pill">☁️ +${fmt(got.b)}</span><span class="pill">🏆 ${dg >= 0 ? '+' : ''}${dg}</span></div>
    ${(got.c < E.got.c || got.b < E.got.b) ? '<p style="text-align:center;opacity:.8">Une partie du butin a été perdue : tes stockages sont pleins.</p>' : ''}
    <div class="pb"><button class="btn green" data-a="home">🏝️ Retour à mon île</button></div>`, 'result');
}

function goHome() {
  E = null; mode = 'village'; FX.length = 0;
  closeModal();
  $('#hud-battle').classList.add('hidden');
  $('#hud-village').classList.remove('hidden');
  resetCam(); renderPanel(); updateTopbar();
}

// =====================================================================
//  Effets visuels
// =====================================================================
const FX = [];
function addFx(k, x, y, o = {}) {
  const max = { boom: 0.5, puff: 0.45, text: 1.4, zap: 0.22 }[k] || 0.5;
  FX.push(Object.assign({ k, x, y, t: 0, max }, o));
}

// =====================================================================
//  Caméra et rendu
// =====================================================================
const cv = $('#cv'), ctx = cv.getContext('2d');
let W = 0, H = 0, DPR = 1, mode = 'village', T = 0;
const cam = { x: 0, y: 0, z: 1 };
let zMin = 0.3, zMax = 2.2;

function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = innerWidth; H = innerHeight;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  zMin = Math.min(W / (N * TW), H / (N * TH + 160)) * 0.9;
  cam.z = clamp(cam.z, zMin, zMax);
}
function resetCam() {
  const c = iso(N / 2, N / 2);
  cam.x = c.x; cam.y = c.y + 30; cam.z = clamp(zMin * 2, zMin, zMax);
}
function clampCam() {
  cam.x = clamp(cam.x, -N * TW / 2, N * TW / 2);
  cam.y = clamp(cam.y, 0, N * TH + 120);
}
function s2w(sx, sy) {
  const ix = (sx - W / 2) / cam.z + cam.x, iy = (sy - H / 2) / cam.z + cam.y;
  return { x: (ix / (TW / 2) + iy / (TH / 2)) / 2, y: (iy / (TH / 2) - ix / (TW / 2)) / 2, ix, iy };
}
function zoomAt(px, py, nz) {
  const ix = (px - W / 2) / cam.z + cam.x, iy = (py - H / 2) / cam.z + cam.y;
  cam.z = clamp(nz, zMin, zMax);
  cam.x = ix - (px - W / 2) / cam.z; cam.y = iy - (py - H / 2) / cam.z;
  clampCam();
}

// ----- Île pré-dessinée -----
const ISL = { c: null, ox: N * TW / 2 + 20, oy: 20, w: N * TW + 40, h: N * TH + 220, s: 1.5 };
function renderIsland() {
  const c = document.createElement('canvas');
  c.width = ISL.w * ISL.s; c.height = ISL.h * ISL.s;
  const g = c.getContext('2d');
  g.scale(ISL.s, ISL.s); g.translate(ISL.ox, ISL.oy);
  const depth = (x, y) => 40 + hash(x, y) * 90 + (x + y > N ? 20 : 0);
  const poly = (pts, fill) => { g.beginPath(); g.moveTo(pts[0].x, pts[0].y); for (const p of pts.slice(1)) g.lineTo(p.x, p.y); g.closePath(); g.fillStyle = fill; g.fill(); };
  for (let s = 0; s < 2 * N; s++) for (let x = 0; x <= s; x++) {
    const y = s - x;
    if (!isLand(x, y)) continue;
    const top = iso(x, y), right = iso(x + 1, y), bottom = iso(x + 1, y + 1), left = iso(x, y + 1);
    if (!isLand(x + 1, y)) { // face droite
      const d1 = depth(x + 1, y), d2 = depth(x + 1, y + 1);
      const gr = g.createLinearGradient(0, right.y, 0, right.y + Math.max(d1, d2));
      gr.addColorStop(0, '#9a7452'); gr.addColorStop(0.5, '#7b5a3e'); gr.addColorStop(1, '#5a4030');
      poly([right, bottom, { x: bottom.x, y: bottom.y + d2 }, { x: right.x, y: right.y + d1 }], gr);
      poly([right, bottom, { x: bottom.x, y: bottom.y + 6 }, { x: right.x, y: right.y + 6 }], '#5fa041');
    }
    if (!isLand(x, y + 1)) { // face gauche
      const d1 = depth(x, y + 1), d2 = depth(x + 1, y + 1);
      const gr = g.createLinearGradient(0, left.y, 0, left.y + Math.max(d1, d2));
      gr.addColorStop(0, '#80603f'); gr.addColorStop(0.5, '#644830'); gr.addColorStop(1, '#463224');
      poly([left, bottom, { x: bottom.x, y: bottom.y + d2 }, { x: left.x, y: left.y + d1 }], gr);
      poly([left, bottom, { x: bottom.x, y: bottom.y + 6 }, { x: left.x, y: left.y + 6 }], '#4f8c35');
    }
    const h = hash(x, y);
    const base = (x + y) % 2 ? [124, 196, 92] : [116, 188, 84];
    const v = (h - 0.5) * 14;
    poly([top, right, bottom, left], `rgb(${base[0] + v | 0},${base[1] + v | 0},${base[2] + v | 0})`);
    if (h > 0.82) { // petites fleurs
      const p = iso(x + 0.3 + hash(y, x) * 0.4, y + 0.3 + h * 0.4);
      g.fillStyle = h > 0.92 ? '#fff6a8' : '#ffd1ec';
      g.beginPath(); g.arc(p.x, p.y, 2.2, 0, 7); g.fill();
    }
  }
  ISL.c = c;
}

// ----- Nuages en arrière-plan -----
const CLOUDS = Array.from({ length: 9 }, () => ({ x: Math.random(), y: Math.random(), s: rand(0.6, 1.4), v: rand(0.006, 0.016) }));
function drawBackground(dt) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#3d8fe0'); g.addColorStop(0.6, '#8fcaf5'); g.addColorStop(1, '#d8f0ff');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  let wx = 1, wy = 0;
  if (E) { wx = E.wind.x - E.wind.y; wy = (E.wind.x + E.wind.y) / 2; const l = Math.hypot(wx, wy) || 1; wx /= l; wy /= l; }
  const sp = E ? 3 : 1;
  for (const c of CLOUDS) {
    c.x += c.v * wx * dt * sp; c.y += c.v * wy * dt * sp;
    if (c.x > 1.25) c.x = -0.25; if (c.x < -0.25) c.x = 1.25;
    if (c.y > 1.15) c.y = -0.15; if (c.y < -0.15) c.y = 1.15;
    const x = c.x * W, y = c.y * H, r = 34 * c.s;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 7); ctx.arc(x + r * 0.9, y + r * 0.2, r * 0.75, 0, 7);
    ctx.arc(x - r * 0.9, y + r * 0.25, r * 0.65, 0, 7); ctx.arc(x + r * 0.2, y - r * 0.45, r * 0.7, 0, 7);
    ctx.fill();
  }
}

// ----- Dessin des éléments -----
function polyPath(pts) { ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y); ctx.closePath(); }
function footprint(x, y, s, inset = 0) {
  return [iso(x + inset, y + inset), iso(x + s - inset, y + inset), iso(x + s - inset, y + s - inset), iso(x + inset, y + s - inset)];
}
function drawBox(x, y, s, h, col, inset = 0.1) {
  const [a, b, c, d] = footprint(x, y, s, inset);
  const up = (p) => ({ x: p.x, y: p.y - h });
  polyPath([d, c, up(c), up(d)]); ctx.fillStyle = shade(col, -0.38); ctx.fill();
  polyPath([c, b, up(b), up(c)]); ctx.fillStyle = shade(col, -0.2); ctx.fill();
  polyPath([up(a), up(b), up(c), up(d)]); ctx.fillStyle = col; ctx.fill();
  ctx.strokeStyle = shade(col, 0.3); ctx.lineWidth = 1.5; ctx.stroke();
}
function text(str, x, y, size, color = '#fff', stroke = true) {
  ctx.font = `bold ${size}px "Trebuchet MS", system-ui, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (stroke) { ctx.lineWidth = size / 4; ctx.strokeStyle = 'rgba(0,0,0,.65)'; ctx.strokeText(str, x, y); }
  ctx.fillStyle = color; ctx.fillText(str, x, y);
}
function emoji(str, x, y, size) {
  ctx.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#000';
  ctx.fillText(str, x, y);
}
function bar(x, y, w, frac, col) {
  ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, 6);
  ctx.fillStyle = col; ctx.fillRect(x - w / 2, y, w * clamp(frac, 0, 1), 4);
}

function drawBuilding(b, battle) {
  const d = B[b.t], s = d.size;
  const c = iso(b.x + s / 2, b.y + s / 2);
  const tf = 1 / cam.z;
  // ombre au sol
  polyPath(footprint(b.x, b.y, s, 0.02)); ctx.fillStyle = 'rgba(40,70,30,.28)'; ctx.fill();

  if (!battle && b.l === 0) { // en construction
    drawBox(b.x, b.y, s, 8, '#b08968');
    emoji('🏗️', c.x, c.y - 22, 14 + s * 8);
    text(fmtTime((b.ue - now()) / 1000), c.x, c.y - 44 - s * 4, Math.max(10, 12 * tf), '#ffe27a');
    return;
  }
  const lv = b.l || 1;
  const h = d.h + (lv - 1) * 3;
  const col = d.wall ? shade(d.color, -(lv - 1) * 0.08) : shade(d.color, (lv - 1) * 0.07);
  drawBox(b.x, b.y, s, h, col, d.wall ? 0.05 : 0.1);
  if (b.hit > 0) { polyPath(footprint(b.x, b.y, s, 0.1).map((p) => ({ x: p.x, y: p.y - h }))); ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fill(); }

  if (b.t === 'core') { // cristal lumineux
    const pulse = 0.6 + Math.sin(T * 3) * 0.2;
    ctx.fillStyle = `rgba(200,170,255,${pulse * 0.5})`;
    ctx.beginPath(); ctx.ellipse(c.x, c.y - h - 18, 30, 16, 0, 0, 7); ctx.fill();
    emoji('🔮', c.x, c.y - h - 16 + Math.sin(T * 2) * 3, 40);
  } else if (!d.wall) {
    emoji(d.icon, c.x, c.y - h - 8, 12 + s * 9);
  }
  if (d.def && battle && b.aim !== undefined) { // petit canon qui vise
    ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 4;
    const a = iso(b.x + s / 2 + Math.cos(b.aim) * 0.7, b.y + s / 2 + Math.sin(b.aim) * 0.7);
    ctx.beginPath(); ctx.moveTo(c.x, c.y - h); ctx.lineTo(a.x, a.y - h); ctx.stroke();
  }

  if (!battle) {
    if (b.ue) {
      emoji('🔨', c.x + 18, c.y - h - 26 + Math.abs(Math.sin(T * 6)) * -6, 18);
      text(fmtTime((b.ue - now()) / 1000), c.x, c.y - h - 40, Math.max(10, 12 * tf), '#ffe27a');
    }
    if (d.prod && b.st >= Math.max(10, d.cap[b.l] * 0.08)) { // bulle de récolte
      const by = c.y - h - 34 + Math.sin(T * 4 + b.id) * 3;
      ctx.fillStyle = 'rgba(255,255,255,.92)';
      ctx.beginPath(); ctx.arc(c.x, by, 14, 0, 7); ctx.fill();
      ctx.strokeStyle = b.st >= d.cap[b.l] ? '#ff5050' : '#3a62c9'; ctx.lineWidth = 2; ctx.stroke();
      emoji(RES[d.prod].icon, c.x, by + 1, 16);
    }
  } else if (b.hp < b.max) {
    bar(c.x, c.y - h - 30, 36, b.hp / b.max, b.hp / b.max > 0.5 ? '#6fe06a' : b.hp / b.max > 0.25 ? '#ffd25a' : '#ff5a4a');
  }
}

function drawRubble(b) {
  const s = B[b.t].size;
  polyPath(footprint(b.x, b.y, s, 0.12)); ctx.fillStyle = '#6b5d50'; ctx.fill();
  for (let i = 0; i < s * 3; i++) {
    const p = iso(b.x + 0.2 + hash(b.id, i) * (s - 0.4), b.y + 0.2 + hash(i, b.id) * (s - 0.4));
    ctx.fillStyle = i % 2 ? '#8a7a6a' : '#4f4339';
    ctx.beginPath(); ctx.arc(p.x, p.y - 2, 3 + hash(i, i + b.id) * 3, 0, 7); ctx.fill();
  }
}

function drawUnit(u) {
  const d = TROOPS[u.t], p = iso(u.x, u.y);
  const lift = u.air ? 36 : 6;
  const bob = u.moving ? Math.abs(Math.sin(T * 10 + u.ph)) * 3 : 0;
  const lunge = u.lunge > 0 ? 4 : 0;
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.beginPath(); ctx.ellipse(p.x, p.y, u.air ? 10 : 7, u.air ? 5 : 3.5, 0, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(80,160,255,.55)';
  ctx.beginPath(); ctx.ellipse(p.x, p.y, 6, 3, 0, 0, 7); ctx.fill();
  ctx.save();
  ctx.translate(p.x, p.y - lift - bob - lunge + (u.air ? Math.sin(T * 2 + u.ph) * 2 : 0));
  if (u.face > 0) ctx.scale(-1, 1);
  if (u.hit > 0) ctx.globalAlpha = 0.6;
  emoji(d.icon, 0, 0, Math.max(u.air ? 26 : 18, (u.air ? 17 : 13) / cam.z));
  ctx.restore();
  if (u.hp < u.max) bar(p.x, p.y - lift - 18, 18, u.hp / u.max, '#5ab0ff');
}

function drawProj(p) {
  const a = iso(p.x, p.y);
  const y = a.y - p.z;
  if (p.kind === 'bolt') { ctx.fillStyle = '#4a3420'; ctx.beginPath(); ctx.arc(a.x, y, 3.5, 0, 7); ctx.fill(); }
  else if (p.kind === 'arrow') { ctx.fillStyle = '#fff3c4'; ctx.beginPath(); ctx.arc(a.x, y, 2.2, 0, 7); ctx.fill(); }
  else if (p.kind === 'bomb') { ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(a.x, y, 4.5, 0, 7); ctx.fill(); }
  else if (p.kind === 'gust') {
    ctx.strokeStyle = 'rgba(230,250,255,.9)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(a.x, y, 7, T * 10, T * 10 + 4.5); ctx.stroke();
  }
}

function drawFx(f) {
  const k = f.t / f.max, p = iso(f.x, f.y);
  if (f.k === 'boom') {
    ctx.globalAlpha = 1 - k;
    ctx.fillStyle = '#ffb347';
    ctx.beginPath(); ctx.ellipse(p.x, p.y - 10, 10 + k * 40 * f.r, (10 + k * 40 * f.r) * 0.6, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff2b0';
    ctx.beginPath(); ctx.ellipse(p.x, p.y - 10, 4 + k * 18 * f.r, (4 + k * 18 * f.r) * 0.6, 0, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
  } else if (f.k === 'puff') {
    ctx.globalAlpha = 1 - k;
    ctx.fillStyle = '#ffffff';
    const r = (f.small ? 6 : 9) + k * 14;
    const z = f.air ? 36 : 6;
    ctx.beginPath(); ctx.arc(p.x - 5, p.y - z, r * 0.7, 0, 7); ctx.arc(p.x + 5, p.y - z - 2, r * 0.6, 0, 7); ctx.arc(p.x, p.y - z - 6, r * 0.6, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
  } else if (f.k === 'text') {
    ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    text(f.text, p.x, p.y - 50 - k * 40, Math.max(13, 15 / cam.z), f.color);
    ctx.globalAlpha = 1;
  } else if (f.k === 'zap') {
    ctx.globalAlpha = 1 - k;
    for (const [w, col] of [[7, 'rgba(255,240,120,.5)'], [2.5, '#ffffff']]) {
      ctx.strokeStyle = col; ctx.lineWidth = w;
      ctx.beginPath();
      f.pts.forEach((q, i) => {
        const a = iso(q.x, q.y);
        if (i === 0) { ctx.moveTo(a.x, a.y - q.z); return; }
        const prev = iso(f.pts[i - 1].x, f.pts[i - 1].y);
        const mx = (prev.x + a.x) / 2 + rand(-8, 8), my = (prev.y - f.pts[i - 1].z + a.y - q.z) / 2 + rand(-8, 8);
        ctx.lineTo(mx, my); ctx.lineTo(a.x, a.y - q.z);
      });
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

function draw(dt) {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  drawBackground(dt);
  ctx.setTransform(DPR * cam.z, 0, 0, DPR * cam.z, DPR * (W / 2 - cam.x * cam.z), DPR * (H / 2 - cam.y * cam.z));
  ctx.drawImage(ISL.c, -ISL.ox, -ISL.oy, ISL.w, ISL.h);

  const battle = mode === 'battle' && E;
  const list = battle ? E.bl : S.bl;

  // Zones interdites (combat)
  if (battle && E.phase !== 'end' && (E.flash > 0 || E.phase === 'scout')) {
    const a = E.flash > 0 ? Math.min(1, E.flash) * 0.45 : 0.12;
    ctx.fillStyle = `rgba(255,60,60,${a})`;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++)
      if (E.forbid[y * N + x] && isLand(x, y)) { polyPath(footprint(x, y, 1)); ctx.fill(); }
  }
  // Sélection / placement
  if (!battle) {
    const g = placing ? placing.b : sel;
    if (g) {
      const ok = !placing || validPos(S.bl, g);
      polyPath(footprint(g.x, g.y, B[g.t].size));
      ctx.fillStyle = ok ? 'rgba(120,255,120,.35)' : 'rgba(255,80,80,.45)'; ctx.fill();
      ctx.strokeStyle = ok ? '#ffffff' : '#ff4040'; ctx.lineWidth = 2; ctx.stroke();
    }
  }
  if (battle) for (const b of E.bl) if (b.dead) drawRubble(b);

  // Tri par profondeur
  const items = [];
  for (const b of list) {
    if (battle && b.dead) continue;
    const s = B[b.t].size;
    items.push({ d: b.x + b.y + s, f: () => drawBuilding(b, battle) });
  }
  if (placing) { const b = placing.b, s = B[b.t].size; items.push({ d: b.x + b.y + s, f: () => { ctx.globalAlpha = 0.8; drawBuilding(Object.assign({}, b, { l: 1, ue: 0 }), false); ctx.globalAlpha = 1; } }); }
  if (battle) for (const u of E.units) items.push({ d: u.x + u.y + (u.air ? 100 : 0), f: () => drawUnit(u) });
  items.sort((a, b) => a.d - b.d);
  for (const it of items) it.f();

  if (battle) for (const p of E.proj) drawProj(p);
  for (const f of FX) drawFx(f);
}

// =====================================================================
//  Interface (HTML)
// =====================================================================
let toastTimer = 0;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

let topCache = '';
function updateTopbar() {
  const cc = capOf('c'), cb = capOf('b');
  const key = [S.res.c | 0, S.res.b | 0, cc, cb, busyBuilders(), S.glory, armyCount()].join();
  if (key === topCache) return;
  topCache = key;
  $('#res-c b').textContent = `${fmt(S.res.c)} / ${fmt(cc)}`;
  $('#res-b b').textContent = `${fmt(S.res.b)} / ${fmt(cb)}`;
  $('#res-c .bar i').style.width = (S.res.c / cc * 100) + '%';
  $('#res-b .bar i').style.width = (S.res.b / cb * 100) + '%';
  $('#chip-builders b').textContent = `${BUILDERS - busyBuilders()}/${BUILDERS}`;
  $('#chip-glory b').textContent = S.glory;
  $('#army-badge').textContent = armyCount();
}

function statsHtml(b) {
  const d = B[b.t], l = Math.max(1, b.l), n = Math.min(MAXL, l + 1), up = b.l < MAXL && b.l > 0;
  const nx = (arr) => (up && arr[n] !== arr[l] ? ` <em>→ ${fmt(arr[n])}</em>` : '');
  const out = [`❤️ ${fmt(d.hp[l])}${nx(d.hp)}`];
  if (b.t === 'core') out.push(`📦 +${fmt(1000 * l)} de stockage`);
  if (d.prod) out.push(`${RES[d.prod].icon} ${fmt(d.rate[l])}/h${nx(d.rate)}`, `📦 ${fmt(d.cap[l])}${nx(d.cap)}`);
  if (d.store) out.push(`📦 ${RES[d.store].icon} ${fmt(d.cap[l])}${nx(d.cap)}`);
  if (b.t === 'nid') out.push(`👥 ${d.cap[l]} places${nx(d.cap)}`);
  if (b.t === 'perchoir') out.push('Troupes : ' + TROOP_ORDER.filter((t) => TROOPS[t].unlock <= l).map((t) => TROOPS[t].icon).join(' ')
    + (up ? ` <em>→ ${TROOPS[TROOP_ORDER[n - 1]].icon}</em>` : ''));
  if (d.def) out.push(`💥 ${d.def.dps[l]}/s${nx(d.def.dps)}`, `📏 ${d.def.range}`, d.def.air && d.def.ground ? '🎯 Sol + Air' : '🎯 Sol');
  return out.map((s) => `<span>${s}</span>`).join('');
}

function renderPanel() {
  const p = $('#panel');
  if (mode !== 'village' || (!sel && !placing)) { p.classList.add('hidden'); return; }
  p.classList.remove('hidden');
  if (placing) {
    const t = placing.b.t, d = B[t];
    p.innerHTML = `<div class="ph"><span class="pi">${d.icon}</span><div><b>${d.name}</b><small>Fais glisser le bâtiment pour le placer</small></div></div>
      <div class="pb"><button class="btn green" data-a="place">✔ Construire · ${costStr(d.res, d.cost[1])}</button><button class="btn grey" data-a="cancel">✖</button></div>`;
    return;
  }
  const b = sel, d = B[b.t];
  const why = upgradeBlock(b);
  let btns = '';
  if (b.ue) btns += `<button class="btn gold" data-a="speed">⚡ Finir maintenant · 💎 <span id="p-speed">${fmt(speedCost(b))}</span></button>`;
  else if (why) btns += `<button class="btn" disabled>${why}</button>`;
  else btns += `<button class="btn green" data-a="upgrade">⬆️ Niveau ${b.l + 1} · ${costStr(d.res, d.cost[b.l + 1])}${d.time[b.l + 1] ? ' · ⏱ ' + fmtTime(d.time[b.l + 1]) : ''}</button>`;
  if (d.prod && b.l > 0) btns += `<button class="btn" data-a="collect">Récolter ${RES[d.prod].icon}</button>`;
  if ((b.t === 'perchoir' || b.t === 'nid') && b.l > 0) btns += `<button class="btn" data-a="army">🐦 Armée</button>`;
  btns += `<button class="btn grey" data-a="deselect">✖</button>`;
  p.innerHTML = `<div class="ph"><span class="pi">${d.icon}</span><div><b>${d.name}</b><small>${b.l === 0 ? 'En construction' : 'Niveau ' + b.l} · ${d.desc}</small></div></div>
    <div class="stats">${b.l > 0 ? statsHtml(b) : ''}</div><div class="live" id="p-live"></div>
    <div class="pb">${btns}</div>`;
  liveUpdate();
}

function liveUpdate() {
  if (!sel || placing) return;
  const el = $('#p-live');
  if (!el) return;
  const b = sel, d = B[b.t];
  let s = '';
  if (b.ue) s = `⏱ ${b.l === 0 ? 'Construction' : 'Amélioration'} : ${fmtTime((b.ue - now()) / 1000)} restantes`;
  if (d.prod && b.l > 0) s += (s ? ' · ' : '') + `Stocké : ${fmt(b.st)} / ${fmt(d.cap[b.l])} ${RES[d.prod].icon}`;
  if (el.textContent !== s) el.textContent = s;
  const sp = $('#p-speed');
  if (sp && b.ue) sp.textContent = fmt(speedCost(b));
}

$('#panel').addEventListener('click', (e) => {
  const a = e.target.closest('[data-a]')?.dataset.a;
  if (!a) return;
  if (a === 'place') confirmPlace();
  else if (a === 'cancel') { placing = null; renderPanel(); }
  else if (a === 'upgrade') startUpgrade(sel);
  else if (a === 'speed') speedUp(sel);
  else if (a === 'collect') { collect(sel); liveUpdate(); }
  else if (a === 'army') openArmy();
  else if (a === 'deselect') { sel = null; renderPanel(); }
});

// ----- Fenêtres -----
let modalKind = null;
function openModal(html, kind) {
  modalKind = kind;
  $('#modal .content').innerHTML = html;
  $('#modal').classList.remove('hidden');
  $('#modal .close').classList.toggle('hidden', kind === 'result');
}
function closeModal() { modalKind = null; $('#modal').classList.add('hidden'); }

function openShop() {
  placing = null; sel = null; renderPanel();
  const L = coreL();
  const cards = SHOP_ORDER.map((t) => {
    const d = B[t], why = shopBlock(t);
    return `<button class="card ${why ? 'locked' : ''}" data-build="${t}">
      <span class="ci">${d.icon}</span><b>${d.name}</b>
      <small>${countT(t)} / ${LIMITS[t][L]}</small>
      <span class="cost">${costStr(d.res, d.cost[1])}${d.time[1] ? ' · ⏱ ' + fmtTime(d.time[1]) : ''}</span>
      ${why ? `<small>🔒 ${why}</small>` : ''}</button>`;
  }).join('');
  openModal(`<h2>🛠️ Construire</h2><div class="grid">${cards}</div>`, 'shop');
}

function openArmy() {
  sel = null; placing = null; renderPanel();
  modalKind = 'army';
  renderArmy();
}
function renderArmy() {
  const cap = armyCap(), used = armySpace(), bl = barracksL();
  const have = TROOP_ORDER.filter((t) => S.army[t] > 0).map((t) => `<span class="pill">${TROOPS[t].icon} × ${S.army[t]}</span>`).join('') || '<small>Aucune troupe prête.</small>';
  const cards = TROOP_ORDER.map((t) => {
    const d = TROOPS[t], locked = bl < d.unlock;
    return `<button class="card ${locked ? 'locked' : ''}" data-train="${t}">
      <span class="ci">${d.icon}</span><b>${d.name}</b>
      <small>❤️ ${d.hp} · ${d.boom ? '💥 ' + d.boom + ' (x5 murs)' : '💥 ' + d.dps + '/s'} · 👥 ${d.space}</small>
      <span class="cost">☁️ ${d.cost} · ⏱ ${d.time}s</span>
      <small>${locked ? '🔒 Perchoir niv ' + d.unlock : d.desc}</small></button>`;
  }).join('');
  const queue = S.queue.map((q, i) => `<button data-cancel="${i}">${TROOPS[q.t].icon} ${i === 0 ? `<small id="q-live">${Math.ceil(q.rem)}s</small>` : ''} ✕</button>`).join('');
  openModal(`<h2>🐦 Armée</h2>
    <div>Place dans les Nids : <b>${used} / ${cap}</b></div>
    <div class="capbar"><i style="width:${cap ? used / cap * 100 : 0}%"></i></div>
    <div class="army-row">${have}</div>
    ${S.queue.length ? `<h3>En entraînement (touche pour annuler)</h3><div class="queue">${queue}</div>` : ''}
    <h3>Entraîner</h3><div class="grid">${cards}</div>`, 'army');
}

function openSettings() {
  openModal(`<h2>⚙️ Options</h2>
    <p><b>Îles Célestes</b> — construis ton île volante, entraîne tes troupes et pille les îles voisines.</p>
    <p>💡 Astuce : regarde la flèche du <b>vent</b> pendant une attaque. Les troupes qui vont dans le sens du vent sont plus rapides !</p>
    <div class="pb"><button class="btn" data-a="help">❓ Comment jouer</button></div>
    <div class="pb"><button class="btn red" data-a="reset">🗑️ Recommencer une nouvelle partie</button></div>`, 'settings');
}

function openHelp() {
  openModal(`<h2>🏝️ Bienvenue sur ton île céleste !</h2>
    <p>Tu es le gardien d'une île qui flotte dans les nuages.</p>
    <p>⛏️ <b>Récolte</b> les cristaux 💎 et la brume ☁️ en touchant tes mines et tes puits.</p>
    <p>🛠️ <b>Construis</b> et améliore tes bâtiments. Touche un bâtiment pour le sélectionner, puis fais-le glisser pour le déplacer.</p>
    <p>🐦 <b>Entraîne</b> des troupes au Perchoir de guerre.</p>
    <p>⚔️ <b>Attaque</b> d'autres îles : choisis une troupe en bas, puis touche la carte pour la déposer (garde le doigt appuyé pour en déposer plusieurs). Tu ne peux pas déposer dans les zones rouges.</p>
    <p>🌬️ <b>Le vent</b> change à chaque attaque : les troupes qui l'ont dans le dos vont plus vite !</p>
    <p>⭐ 50 % de destruction, le Cœur détruit et 100 % : une étoile chacun.</p>
    <div class="pb"><button class="btn green" data-a="close">C'est parti !</button></div>`, 'help');
}

$('#modal').addEventListener('click', (e) => {
  const el = e.target.closest('[data-a],[data-build],[data-train],[data-cancel]');
  if (!el) { if (e.target === $('#modal') && modalKind !== 'result') closeModal(); return; }
  const ds = el.dataset;
  if (ds.build) { closeModal(); startPlacing(ds.build); return; }
  if (ds.train) { enqueue(ds.train); return; }
  if (ds.cancel !== undefined) { dequeue(+ds.cancel); return; }
  const a = ds.a;
  if (a === 'close') { closeModal(); if (!S.welcomed) { S.welcomed = true; save(); } }
  else if (a === 'home') goHome();
  else if (a === 'help') openHelp();
  else if (a === 'reset') {
    openModal(`<h2>🗑️ Recommencer ?</h2><p>Toute ta partie sera effacée : bâtiments, ressources, troupes et trophées.</p>
      <div class="pb"><button class="btn red" data-a="reset-yes">Oui, tout effacer</button><button class="btn" data-a="close">Non</button></div>`, 'settings');
  } else if (a === 'reset-yes') {
    S = newGame(); S.welcomed = true; save(); closeModal(); sel = null; placing = null; renderPanel(); topCache = ''; updateTopbar();
  }
});

$('#btn-shop').addEventListener('click', openShop);
$('#btn-army').addEventListener('click', openArmy);
$('#btn-attack').addEventListener('click', () => startScout(true));
$('#btn-settings').addEventListener('click', openSettings);

// ----- Interface de combat -----
function renderTroopbar() {
  const bar = $('#troopbar');
  bar.innerHTML = TROOP_ORDER.filter((t) => S.army[t] > 0 || E.used[t]).map((t) => {
    const n = S.army[t] || 0;
    return `<button class="troop ${E.sel === t ? 'sel' : ''} ${n ? '' : 'empty'}" data-t="${t}"><span class="n">×${n}</span><span class="e">${TROOPS[t].icon}</span><small>${TROOPS[t].name}</small></button>`;
  }).join('');
}
$('#troopbar').addEventListener('click', (e) => {
  const el = e.target.closest('[data-t]');
  if (!el || !E) return;
  if (!(S.army[el.dataset.t] > 0)) return toast('Plus de troupes de ce type');
  E.sel = el.dataset.t; renderTroopbar();
});

function renderBattleActions() {
  const box = $('#b-actions');
  if (E.phase === 'scout') {
    box.innerHTML = `<button class="btn gold" data-a="next">⏭ Île suivante · 💎 ${20 * coreL()}</button><button class="btn red" data-a="leave">🏝️ Rentrer</button>`;
    $('#b-hint').textContent = 'Touche une zone verte pour déposer une troupe';
    $('#b-hint').classList.remove('hidden');
  } else {
    box.innerHTML = `<button class="btn red" data-a="surrender">🏳️ Terminer</button>`;
    $('#b-hint').classList.add('hidden');
  }
}
$('#b-actions').addEventListener('click', (e) => {
  const a = e.target.closest('[data-a]')?.dataset.a;
  if (!a || !E) return;
  if (a === 'next') startScout(false);
  else if (a === 'leave') goHome();
  else if (a === 'surrender') endBattle();
});

function updateBattleHud() {
  if (!E) return;
  const rem = { c: E.total.c - E.got.c, b: E.total.b - E.got.b };
  $('#b-info').innerHTML = `<div class="nm">${E.name} · niv ${E.L}</div>
    <div class="lt">Butin : 💎 ${fmt(rem.c)} · ☁️ ${fmt(rem.b)}</div>
    <div class="lt">Gagné : 💎 ${fmt(E.got.c)} · ☁️ ${fmt(E.got.b)}</div>`;
  $('#b-stars').innerHTML = starsHtml(E.stars);
  $('#b-pct').textContent = E.pct + ' %';
}

// =====================================================================
//  Contrôles tactiles et souris
// =====================================================================
const ptrs = new Map();
let gest = null;

function pickBuilding(list, sx, sy) {
  const w = s2w(sx, sy);
  const sorted = list.slice().sort((a, b) => (b.x + b.y + B[b.t].size) - (a.x + a.y + B[a.t].size));
  for (const b of sorted) {
    if (b.dead) continue;
    const d = B[b.t], s = d.size, h = (b.l === 0 ? 8 : d.h + 10);
    const [A, Bp, C, D] = footprint(b.x, b.y, s);
    const poly = [{ x: A.x, y: A.y - h }, { x: Bp.x, y: Bp.y - h }, Bp, C, D, { x: D.x, y: D.y - h }];
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const pi = poly[i], pj = poly[j];
      if ((pi.y > w.iy) !== (pj.y > w.iy) && w.ix < (pj.x - pi.x) * (w.iy - pi.y) / (pj.y - pi.y) + pi.x) inside = !inside;
    }
    if (inside) return b;
  }
  return null;
}

cv.addEventListener('pointerdown', (e) => {
  cv.setPointerCapture(e.pointerId);
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 1) {
    gest = { mode: 'pan', id: e.pointerId, sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, t0: performance.now(), moved: false, hold: 0, rep: 0, deployed: false };
    if (mode === 'village') {
      const g = placing ? placing.b : sel;
      if (g && pickBuilding([g], e.clientX, e.clientY)) {
        const w = s2w(e.clientX, e.clientY);
        gest.mode = 'drag'; gest.b = g;
        gest.ox = Math.floor(w.x) - g.x; gest.oy = Math.floor(w.y) - g.y;
        gest.orig = { x: g.x, y: g.y };
      }
    }
  } else if (ptrs.size === 2) {
    if (gest && gest.mode === 'drag' && gest.orig && !placing) { gest.b.x = gest.orig.x; gest.b.y = gest.orig.y; }
    const [a, b] = [...ptrs.values()];
    gest = { mode: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y), z0: cam.z, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, moved: true };
  }
});

cv.addEventListener('pointermove', (e) => {
  if (!ptrs.has(e.pointerId)) return;
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (!gest) return;
  if (gest.mode === 'pinch') {
    if (ptrs.size < 2) return;
    const [a, b] = [...ptrs.values()];
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    cam.x -= (mx - gest.mx) / cam.z; cam.y -= (my - gest.my) / cam.z;
    gest.mx = mx; gest.my = my;
    zoomAt(mx, my, gest.z0 * Math.hypot(a.x - b.x, a.y - b.y) / gest.d0);
    return;
  }
  if (e.pointerId !== gest.id) return;
  const dx = e.clientX - gest.lx, dy = e.clientY - gest.ly;
  gest.lx = e.clientX; gest.ly = e.clientY;
  if (!gest.moved && Math.hypot(e.clientX - gest.sx, e.clientY - gest.sy) > 9) gest.moved = true;
  if (!gest.moved) return;
  if (gest.mode === 'pan') { cam.x -= dx / cam.z; cam.y -= dy / cam.z; clampCam(); }
  else if (gest.mode === 'drag') {
    const w = s2w(e.clientX, e.clientY), s = B[gest.b.t].size;
    gest.b.x = clamp(Math.floor(w.x) - gest.ox, 0, N - s);
    gest.b.y = clamp(Math.floor(w.y) - gest.oy, 0, N - s);
  }
});

function pointerEnd(e) {
  ptrs.delete(e.pointerId);
  if (!gest) return;
  if (gest.mode === 'pinch') { if (ptrs.size === 0) gest = null; return; }
  if (e.pointerId !== gest.id) return;
  const g = gest; gest = null;
  if (e.type === 'pointercancel') { if (g.mode === 'drag' && !placing) { g.b.x = g.orig.x; g.b.y = g.orig.y; } return; }
  if (!g.moved && performance.now() - g.t0 < 400) { onTap(g.sx, g.sy, g); return; }
  if (g.mode === 'drag' && g.moved && !placing) {
    if (!validPos(S.bl, g.b)) { g.b.x = g.orig.x; g.b.y = g.orig.y; toast('Emplacement occupé'); }
    else save();
  }
}
cv.addEventListener('pointerup', pointerEnd);
cv.addEventListener('pointercancel', pointerEnd);
cv.addEventListener('wheel', (e) => { e.preventDefault(); zoomAt(e.clientX, e.clientY, cam.z * (e.deltaY < 0 ? 1.12 : 0.89)); }, { passive: false });
document.addEventListener('contextmenu', (e) => e.preventDefault());

function onTap(sx, sy, g) {
  if (mode === 'battle') { if (!g.deployed) deployAt(sx, sy); return; }
  if (placing) {
    const w = s2w(sx, sy), s = B[placing.b.t].size;
    placing.b.x = clamp(Math.round(w.x - s / 2), 0, N - s);
    placing.b.y = clamp(Math.round(w.y - s / 2), 0, N - s);
    return;
  }
  const b = pickBuilding(S.bl, sx, sy);
  if (b && B[b.t].prod && b.l > 0 && b.st >= 1 && sel !== b) { collect(b); return; }
  sel = b || null;
  renderPanel();
}

// =====================================================================
//  Boucle principale
// =====================================================================
let lastT = performance.now(), saveTimer = 0, liveTimer = 0;
function frame(t) {
  const dt = Math.min(0.05, (t - lastT) / 1000);
  lastT = t; T += dt;
  econTick();
  if (mode === 'battle' && E) battleUpdate(dt);
  for (const f of FX) f.t += dt;
  for (let i = FX.length - 1; i >= 0; i--) if (FX[i].t >= FX[i].max) FX.splice(i, 1);
  draw(dt);
  updateTopbar();
  liveTimer += dt;
  if (liveTimer > 0.25) {
    liveTimer = 0; liveUpdate();
    if (modalKind === 'army' && S.queue.length) { const q = $('#q-live'); if (q) q.textContent = Math.ceil(S.queue[0].rem) + 's'; }
  }
  saveTimer += dt;
  if (saveTimer > 3) { saveTimer = 0; save(); }
  requestAnimationFrame(frame);
}

document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
window.addEventListener('pagehide', save);
window.addEventListener('resize', () => { resize(); clampCam(); });

// Démarrage
S = load() || newGame();
resize(); resetCam(); renderIsland();
econTick(); updateTopbar();
if (!S.welcomed) openHelp();
requestAnimationFrame(frame);

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// Accès pour les tests / le débogage
window.__game = { get S() { return S; }, get E() { return E; }, B, TROOPS, startScout, endBattle, deployAt, s2w, iso, cam, get W() { return W; }, get H() { return H; } };
})();
