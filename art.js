/* Îles Célestes — modèles dessinés : bâtiments isométriques, personnages animés, décor. */
'use strict';
window.Art = (() => {
  const SX = 32, SY = 16;            // demi-case en pixels
  const RX = 45.25, RY = 22.63;      // un cercle de rayon 1 case, vu en isométrique
  const EDGE = 'rgba(25,18,40,.38)';
  const METAL = ['#8b8f98', '#8b8f98', '#a7afbd', '#d0a640', '#e8be4c', '#b48cff'];
  let g = null, OX = 0, OY = 0;

  // ---------- Couleurs ----------
  const cache = new Map();
  function sh(col, amt) {
    const key = col + amt;
    let out = cache.get(key);
    if (out) return out;
    let r, gg, b;
    if (col[0] === '#') { const v = parseInt(col.slice(1), 16); r = (v >> 16) & 255; gg = (v >> 8) & 255; b = v & 255; }
    else [r, gg, b] = col.match(/\d+/g).map(Number);
    if (amt < 0) { r *= 1 + amt; gg *= 1 + amt; b *= 1 + amt; }
    else { r += (255 - r) * amt; gg += (255 - gg) * amt; b += (255 - b) * amt; }
    out = `rgb(${r | 0},${gg | 0},${b | 0})`;
    cache.set(key, out);
    return out;
  }
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  // ---------- Primitives 3D isométriques ----------
  // (u, v) en cases depuis le centre du bâtiment, z en pixels vers le haut
  const P = (u, v, z = 0) => [OX + (u - v) * SX, OY + (u + v) * SY - z];

  function poly(pts, fill, stroke, lw = 1) {
    g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.closePath();
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); }
  }
  function line(a, b, col, lw) { g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.strokeStyle = col; g.lineWidth = lw; g.stroke(); }
  function circle(x, y, r, fill, stroke, lw = 1) {
    g.beginPath(); g.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2);
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); }
  }
  function ellipse(x, y, rx, ry, fill, stroke, lw = 1, rot = 0) {
    g.beginPath(); g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); }
  }
  function box(u0, v0, u1, v1, z0, z1, col, top) {
    poly([P(u0, v1, z0), P(u1, v1, z0), P(u1, v1, z1), P(u0, v1, z1)], sh(col, -0.12), EDGE);
    poly([P(u1, v0, z0), P(u1, v1, z0), P(u1, v1, z1), P(u1, v0, z1)], sh(col, -0.34), EDGE);
    poly([P(u0, v0, z1), P(u1, v0, z1), P(u1, v1, z1), P(u0, v1, z1)], top || sh(col, 0.1), EDGE);
  }
  // cylindre (ou tronc de cône si r1 ≠ r0, cône si r1 = 0)
  function cyl(u, v, r0, z0, z1, col, top, r1 = r0) {
    const [cx, y0] = P(u, v, z0), y1 = y0 - (z1 - z0);
    const a0 = r0 * RX, b0 = r0 * RY, a1 = r1 * RX, b1 = r1 * RY, m = Math.max(a0, a1);
    const gr = g.createLinearGradient(cx - m, 0, cx + m, 0);
    gr.addColorStop(0, sh(col, -0.05)); gr.addColorStop(0.3, sh(col, 0.15));
    gr.addColorStop(0.7, sh(col, -0.18)); gr.addColorStop(1, sh(col, -0.45));
    g.beginPath(); g.moveTo(cx - a1, y1); g.lineTo(cx - a0, y0);
    g.ellipse(cx, y0, Math.max(0.1, a0), Math.max(0.1, b0), 0, Math.PI, 0, true);
    g.lineTo(cx + a1, y1); g.closePath();
    g.fillStyle = gr; g.fill(); g.strokeStyle = EDGE; g.lineWidth = 1; g.stroke();
    if (r1 > 0.01) ellipse(cx, y1, a1, b1, top || sh(col, 0.12), EDGE);
  }
  function ringArc(u, v, z, r, col, lw) { // moitié avant d'un anneau
    const [x, y] = P(u, v, z);
    g.beginPath(); g.ellipse(x, y, r * RX, r * RY, 0, 0, Math.PI); g.strokeStyle = col; g.lineWidth = lw; g.stroke();
  }
  function pyr(u0, v0, u1, v1, z0, h, col, au, av) {
    const A = P(au ?? (u0 + u1) / 2, av ?? (v0 + v1) / 2, z0 + h);
    poly([P(u0, v0, z0), P(u1, v0, z0), A], sh(col, 0.12), EDGE);
    poly([P(u0, v0, z0), P(u0, v1, z0), A], sh(col, 0.06), EDGE);
    poly([P(u1, v0, z0), P(u1, v1, z0), A], sh(col, -0.32), EDGE);
    poly([P(u0, v1, z0), P(u1, v1, z0), A], sh(col, -0.08), EDGE);
  }
  function gableU(u0, v0, u1, v1, z0, h, col, endCol) { // faîtage le long de u
    const vm = (v0 + v1) / 2, zt = z0 + h;
    poly([P(u0, v0, z0), P(u1, v0, z0), P(u1, vm, zt), P(u0, vm, zt)], sh(col, 0.14), EDGE);
    poly([P(u0, v1, z0), P(u1, v1, z0), P(u1, vm, zt), P(u0, vm, zt)], sh(col, -0.06), EDGE);
    poly([P(u1, v0, z0), P(u1, v1, z0), P(u1, vm, zt)], sh(endCol || col, -0.3), EDGE);
  }
  function gableV(u0, v0, u1, v1, z0, h, col, endCol) { // faîtage le long de v
    const um = (u0 + u1) / 2, zt = z0 + h;
    poly([P(u0, v0, z0), P(u0, v1, z0), P(um, v1, zt), P(um, v0, zt)], sh(col, 0.12), EDGE);
    poly([P(u1, v0, z0), P(u1, v1, z0), P(um, v1, zt), P(um, v0, zt)], sh(col, -0.3), EDGE);
    poly([P(u0, v1, z0), P(u1, v1, z0), P(um, v1, zt)], sh(endCol || col, -0.08), EDGE);
  }
  function gem(u, v, z, r, h, col, rot) { // cristal octaédrique
    const top = P(u, v, z + h), bot = P(u, v, z - h * 0.6), E = [];
    for (let i = 0; i < 4; i++) { const a = rot + i * Math.PI / 2; E.push({ p: P(u + Math.cos(a) * r, v + Math.sin(a) * r, z), a }); }
    const faces = [];
    for (let i = 0; i < 4; i++) {
      const e1 = E[i], e2 = E[(i + 1) % 4], am = e1.a + Math.PI / 4;
      const d = Math.cos(am) + Math.sin(am), lit = Math.cos(am - 2.36);
      faces.push({ d, pts: [top, e1.p, e2.p], c: sh(col, clamp(lit * 0.35 + 0.1, -0.4, 0.55)) });
      faces.push({ d: d - 0.01, pts: [bot, e1.p, e2.p], c: sh(col, clamp(lit * 0.3 - 0.3, -0.6, 0.3)) });
    }
    faces.sort((a, b) => a.d - b.d);
    for (const f of faces) poly(f.pts, f.c, 'rgba(255,255,255,.4)');
  }
  function shard(u, v, z, w, h, col, tilt = 0) { // éclat de cristal
    const [x, y] = P(u, v, z), tx = x + tilt, k = 0.72;
    poly([[x - w, y], [x - w + tilt * k, y - h * k], [tx, y - h], [x, y + w * 0.4]], sh(col, 0.25), 'rgba(255,255,255,.5)');
    poly([[x + w, y], [x + w + tilt * k, y - h * k], [tx, y - h], [x, y + w * 0.4]], sh(col, -0.2), 'rgba(255,255,255,.35)');
  }
  function glow(x, y, r, rgb, a) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  function flag(x, y, w, h, col, t) {
    const pts = [[x, y]];
    for (let i = 1; i <= 4; i++) pts.push([x + w * i / 4, y + Math.sin(t * 6 - i) * 2 * i / 4]);
    for (let i = 4; i >= 0; i--) pts.push([x + w * i / 4, y + h + Math.sin(t * 6 - i) * 2 * i / 4]);
    poly(pts, col, EDGE);
  }

  // =====================================================================
  //  Bâtiments
  // =====================================================================
  const draw = {};

  draw.core = (b, t) => {
    const L = b.l || 1;
    box(-1.38, -1.38, 1.38, 1.38, 0, 10, '#8a93a6');
    box(-1.08, -1.08, 1.08, 1.08, 10, 19, '#aab3c5', '#c9d0dd');
    box(-0.32, 1.08, 0.32, 1.32, 0, 12, '#9aa3b5'); // marches
    const ph = 30 + L * 5;
    const pillar = (u, v) => {
      cyl(u, v, 0.17, 19, 19 + ph, '#d3d8e3');
      cyl(u, v, 0.23, 19 + ph, 24 + ph, METAL[L]);
      const [x, y] = P(u, v, 30 + ph);
      glow(x, y, 10, '190,160,255', 0.8);
      circle(x, y, 2.6, '#f2e8ff');
    };
    pillar(-0.82, -0.82); pillar(0.82, -0.82); pillar(-0.82, 0.82);
    cyl(0, 0, 0.48, 19, 27, METAL[L]);
    ellipse(...P(0, 0, 27), 0.3 * RX, 0.3 * RY, '#5b3fd0');
    const zc = 58 + L * 5 + Math.sin(t * 2) * 4;
    const [cx, cy] = P(0, 0, zc);
    glow(cx, cy, 46, '170,130,255', 0.5);
    const orbit = [];
    for (let i = 0; i < L - 1; i++) {
      const a = t * 1.2 + i * Math.PI * 2 / (L - 1);
      orbit.push({ u: Math.cos(a) * 0.95, v: Math.sin(a) * 0.95 });
    }
    for (const o of orbit) if (o.u + o.v < 0) gem(o.u, o.v, zc - 6, 0.13, 9, '#ff9bf0', -t * 2);
    gem(0, 0, zc, 0.44, 28, '#9b6bff', t * 0.8);
    for (const o of orbit) if (o.u + o.v >= 0) gem(o.u, o.v, zc - 6, 0.13, 9, '#ff9bf0', -t * 2);
    pillar(0.82, 0.82);
  };

  draw.mine = (b, t) => {
    const L = b.l || 1;
    box(-0.88, -0.88, 0.88, 0.88, 0, 6, '#7d7268', '#8f8378');
    pyr(-0.86, -0.86, 0.72, 0.72, 6, 26 + L * 3, '#9a8b7b', -0.25, -0.3);
    // entrée de la mine
    const [ex, ey] = P(-0.15, 0.5, 6);
    g.beginPath(); g.moveTo(ex - 7, ey); g.lineTo(ex - 7, ey - 8); g.arc(ex, ey - 8, 7, Math.PI, 0); g.lineTo(ex + 7, ey); g.closePath();
    g.fillStyle = '#231a28'; g.fill(); g.strokeStyle = '#7a5230'; g.lineWidth = 2.5; g.stroke();
    line([ex - 8, ey - 15], [ex + 8, ey - 15], '#8a5a33', 3);
    const spots = [[-0.3, -0.45, 18, -2], [0.15, -0.55, 12, 3], [-0.6, -0.05, 12, -3], [0.35, -0.1, 10, 2], [-0.1, -0.2, 22, 0], [0.5, -0.5, 6, 4], [-0.6, -0.6, 8, -2], [0.0, 0.25, 8, 1]];
    for (let i = 0; i < Math.min(spots.length, 2 + L); i++) {
      const [u, v, z, tl] = spots[i];
      shard(u, v, z, 3 + (i % 3) * 0.8, 12 + L * 1.6 + (i % 2) * 4, '#56d6ff', tl);
    }
    // rails et wagonnet
    line(P(0.2, 0.86, 6), P(0.62, 0.2, 6), '#6b4a2e', 1.5);
    line(P(0.35, 0.92, 6), P(0.78, 0.26, 6), '#6b4a2e', 1.5);
    box(0.36, 0.3, 0.78, 0.66, 7, 15, '#6b4a2e', '#3a2a1f');
    shard(0.55, 0.48, 14, 2.5, 7, '#7fe3ff', 1); shard(0.66, 0.4, 14, 2, 6, '#7fe3ff', -1);
  };

  draw.puits = (b, t) => {
    const L = b.l || 1;
    box(-0.88, -0.88, 0.88, 0.88, 0, 4, '#8f8a80', '#a29d93');
    cyl(-0.58, 0, 0.07, 4, 50, '#7a5230');
    cyl(0, 0, 0.7, 4, 21 + L, '#a9acb8', '#696c78');
    const [lx, ly] = P(0, 0, 21 + L);
    ellipse(lx, ly, 0.56 * RX, 0.56 * RY, '#a96df0');
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1.5;
    for (let k = 0; k < 3; k++) {
      g.beginPath(); g.ellipse(lx, ly, (0.15 + k * 0.13) * RX, (0.15 + k * 0.13) * RY, 0, t * 2 + k * 2, t * 2 + k * 2 + 2.2); g.stroke();
    }
    for (let k = 1; k < Math.min(L, 4); k++) ringArc(0, 0, 4 + k * 5, 0.71, METAL[L], 2.5);
    cyl(0.58, 0, 0.07, 4, 50, '#7a5230');
    line(P(-0.58, 0, 44), P(0.58, 0, 44), '#6b4a2e', 3);
    const bz = 30 + Math.sin(t * 1.5) * 4;
    line(P(0, 0, 44), P(0, 0, bz), '#d8c8a8', 1);
    box(-0.1, -0.1, 0.1, 0.1, bz - 7, bz, '#8a5a33');
    gableU(-0.82, -0.5, 0.82, 0.5, 48, 15, '#b5523b', '#8a5a33');
    for (let k = 0; k < 3; k++) { // brume qui s'élève
      const ph = (t * 0.35 + k / 3) % 1;
      const [x, y] = P(Math.sin(t + k * 2) * 0.15, 0, 26 + ph * 60);
      g.globalAlpha = (1 - ph) * 0.55;
      circle(x, y, 5 + ph * 9, '#efe3ff');
      g.globalAlpha = 1;
    }
  };

  draw.coffre = (b, t, o) => {
    const L = b.l || 1;
    const wood = ['', '#a8743f', '#94633a', '#7d5232', '#5e3b22', '#4a2f1d'][L], metal = METAL[Math.max(2, L)];
    box(-0.9, -0.9, 0.9, 0.9, 0, 4, '#8f8a80', '#a29d93');
    const n = Math.round(1 + clamp(o.fill ?? 0.5, 0, 1) * 4);
    const pile = [[-0.7, 0.75], [0.75, -0.7], [-0.75, 0.45], [0.5, -0.78], [-0.45, 0.8]];
    for (let i = 0; i < n; i++) shard(pile[i][0], pile[i][1], 4, 3, 8 + (i % 2) * 4, '#56d6ff', (i % 2 ? 2 : -2));
    box(-0.78, -0.56, 0.78, 0.56, 4, 26, wood);
    box(-0.56, -0.6, -0.4, 0.6, 4, 27, metal); box(0.4, -0.6, 0.56, 0.6, 4, 27, metal);
    gableU(-0.84, -0.62, 0.84, 0.62, 26, 12, wood, wood);
    line(P(-0.48, 0.62, 26), P(-0.48, 0, 38), metal, 3); line(P(0.48, 0.62, 26), P(0.48, 0, 38), metal, 3);
    const [x, y] = P(0, 0.57, 22);
    poly([[x - 4, y - 5], [x + 4, y - 5], [x + 4, y + 4], [x - 4, y + 4]], '#ffd34d', '#8a5a00');
    circle(x, y - 1, 1.3, '#4a3000');
    if (L >= 3) { const [gx, gy] = P(0, 0, 40); glow(gx, gy, 14, '120,220,255', 0.35); }
  };

  draw.reservoir = (b, t, o) => {
    const L = b.l || 1, metal = METAL[Math.max(2, L)];
    const fill = clamp(o.fill ?? 0.6, 0.08, 1);
    box(-0.88, -0.88, 0.88, 0.88, 0, 4, '#8f8a80', '#a29d93');
    cyl(0, 0, 0.76, 4, 12, '#8f97a8');
    const zt = 12 + 30 + L * 3;
    cyl(0, 0, 0.56, 12, 12 + (zt - 12) * fill, '#9b5ce0', '#c99bff');
    for (let k = 0; k < 4; k++) { // bulles
      const ph = (t * 0.5 + k * 0.27) % 1;
      const [x, y] = P(Math.sin(k * 3) * 0.3, Math.cos(k * 2) * 0.2, 14 + ph * (zt - 14) * fill);
      circle(x, y, 1.6, 'rgba(255,255,255,.7)');
    }
    g.globalAlpha = 0.3; cyl(0, 0, 0.64, 12, zt, '#e6f7ff', '#ffffff'); g.globalAlpha = 1;
    const [hx, hy] = P(-0.42, 0.18, 0);
    line([hx, hy - 16], [hx, hy - zt + 6], 'rgba(255,255,255,.7)', 2.5);
    for (let k = 1; k <= 2; k++) ringArc(0, 0, 12 + (zt - 12) * k / 3, 0.65, metal, 3);
    cyl(0, 0, 0.68, zt, zt + 6, metal);
    cyl(0, 0, 0.5, zt + 6, zt + 16, metal, null, 0.1);
    const [kx, ky] = P(0, 0, zt + 18);
    circle(kx, ky, 3, sh(metal, 0.3), EDGE);
  };

  draw.perchoir = (b, t) => {
    const L = b.l || 1;
    const roof = ['', '#c0392b', '#b03a2e', '#8e2f25', '#7d3c98', '#5b2c6f'][L];
    // perchoir (derrière la maison)
    const pz = 72 + L * 4;
    cyl(1.05, -1.05, 0.08, 0, pz, '#7a5230');
    cyl(1.05, -1.05, 0.34, pz - 6, pz - 2, '#8a5a33');
    const [nx, ny] = P(1.05, -1.05, pz - 1);
    ellipse(nx, ny, 0.32 * RX, 0.32 * RY, null, '#6b4a2e', 4);
    line([nx, ny], [nx, ny - 26], '#5a3d22', 2);
    flag(nx, ny - 26, 18, 10, ['', '#ffcf33', '#ffcf33', '#4cc9f0', '#ff6b9b', '#b48cff'][L], t);
    // maison
    box(-1.25, -0.95, 0.85, 1.05, 0, 6, '#8f97a8');
    box(-1.12, -0.82, 0.72, 0.92, 6, 32, '#e2c39a');
    for (const u of [-1.12, -0.5, 0.1, 0.72]) line(P(u, 0.92, 6), P(u, 0.92, 32), '#7a5230', 2.5);
    line(P(-1.12, 0.92, 19), P(0.72, 0.92, 19), '#7a5230', 2);
    poly([P(-0.45, 0.93, 6), P(-0.15, 0.93, 6), P(-0.15, 0.93, 24), P(-0.45, 0.93, 24)], '#4a2f1d', '#2a1a10');
    for (const v of [-0.4, 0.45]) poly([P(0.73, v - 0.13, 16), P(0.73, v + 0.13, 16), P(0.73, v + 0.13, 26), P(0.73, v - 0.13, 26)], '#ffd98a', '#5a3d22');
    gableU(-1.3, -1.0, 0.9, 1.1, 32, 22, roof, '#e2c39a');
    // mannequin d'entraînement
    cyl(1.12, 1.05, 0.05, 0, 26, '#7a5230');
    line(P(0.92, 1.05, 20), P(1.32, 1.05, 20), '#7a5230', 3);
    const [dx, dy] = P(1.12, 1.05, 28);
    circle(dx, dy, 6, '#e8c872', '#8a6a2a');
  };

  draw.nid = (b, t) => {
    const L = b.l || 1;
    const [gx, gy] = P(0, 0, 0);
    ellipse(gx, gy, 1.3 * RX, 1.3 * RY, 'rgba(140,100,60,.45)');
    const tents = [[-0.75, -0.75, '#e9d8a6'], [0.75, -0.8, '#94d2bd'], [-0.85, 0.65, '#f4a261'], [0.8, 0.6, '#cdb4db']]
      .slice(0, 2 + (L >= 2 ? 1 : 0) + (L >= 4 ? 1 : 0));
    const items = tents.map(([u, v, c]) => ({ d: u + v, f: () => tent(u, v, c, L) }));
    items.push({ d: 0, f: () => fire(t, L) });
    items.sort((a, b2) => a.d - b2.d).forEach((i) => i.f());
  };
  function tent(u, v, c, L) {
    gableV(u - 0.42, v - 0.4, u + 0.42, v + 0.4, 0, 26 + L, c);
    const [x, y] = P(u, v + 0.4, 0);
    poly([[x - 5, y], [x + 5, y + 4], [x + 1, y - 14]], '#3a2a1f');
    const [px, py] = P(u, v - 0.4, 26 + L);
    line([px, py], [px, py - 14], '#5a3d22', 1.5);
    flag(px, py - 14, 9, 5, '#e63946', 0);
  }
  function fire(t, L) {
    const [x, y] = P(0, 0, 0);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; circle(x + Math.cos(a) * 12, y + Math.sin(a) * 6, 3, '#8d8f96', EDGE); }
    line([x - 9, y - 1], [x + 9, y + 3], '#6b4a2e', 4); line([x - 8, y + 4], [x + 8, y - 2], '#7a5230', 4);
    glow(x, y - 10, 30, '255,170,60', 0.45);
    const fl = (s, col, ph) => {
      const h = s * (1 + Math.sin(t * 15 + ph) * 0.15);
      poly([[x - s * 0.5, y], [x - s * 0.3, y - h * 0.6], [x + Math.sin(t * 9 + ph) * 2, y - h], [x + s * 0.35, y - h * 0.55], [x + s * 0.5, y]], col);
    };
    fl(14 + L, '#ff6b1a', 0); fl(10 + L, '#ffb52e', 1); fl(6, '#fff1a8', 2);
  }

  draw.baliste = (b, t, o) => {
    const L = b.l || 1, a = o.aim ?? 0, metal = METAL[Math.max(2, L)];
    box(-0.9, -0.9, 0.9, 0.9, 0, 4, '#8f8a80', '#a29d93');
    const z = 18 + L * 2;
    cyl(0, 0, 0.8, 4, z, '#a3a8b2', '#bfc4cc');
    for (let k = 1; k <= 2; k++) ringArc(0, 0, 4 + (z - 4) * k / 3, 0.81, 'rgba(60,60,70,.35)', 1);
    cyl(0, 0, 0.56, z, z + 5, '#7a5230', '#946640');
    const dx = Math.cos(a), dy = Math.sin(a), px = -dy, py = dx, zb = z + 15;
    const Q = (f, s, zz) => P(dx * f + px * s, dy * f + py * s, zz);
    box(-0.12, -0.12, 0.12, 0.12, z + 5, zb - 2, '#6b4a2e');
    line(Q(-0.55, 0, zb), Q(0.62, 0, zb), '#6b4a2e', 6);
    line(Q(-0.55, 0, zb), Q(0.62, 0, zb), '#8a5a33', 3);
    for (const sgn of [-1, 1]) {
      const s = Q(0.42, 0, zb), m = Q(0.5, 0.38 * sgn, zb + 2), e = Q(0.22, 0.66 * sgn, zb);
      g.beginPath(); g.moveTo(s[0], s[1]); g.quadraticCurveTo(m[0], m[1], e[0], e[1]);
      g.strokeStyle = metal; g.lineWidth = 4; g.stroke();
      line(e, Q(-0.3, 0, zb + 1), '#eeeeee', 1);
    }
    line(Q(-0.28, 0, zb + 2), Q(0.75, 0, zb + 2), '#3a2a1a', 2);
    const tip = Q(0.82, 0, zb + 2);
    circle(tip[0], tip[1], 2, '#cfd6e0');
  };

  draw.eclair = (b, t, o) => {
    const L = b.l || 1, H = 52 + L * 6;
    box(-0.9, -0.9, 0.9, 0.9, 0, 6, '#8f97a8');
    cyl(0, 0, 0.66, 6, H, '#a9a3bb', '#c7c2d6', 0.44);
    for (const k of [0.35, 0.68]) ringArc(0, 0, 6 + (H - 6) * k, 0.66 - 0.22 * k, '#d08a3a', 3.5);
    const [wx, wy] = P(0.25, 0.25, H * 0.5);
    poly([[wx - 2, wy - 7], [wx + 2, wy - 5], [wx + 2, wy + 4], [wx - 2, wy + 2]], '#2a2440');
    cyl(0, 0, 0.5, H, H + 6, '#5b5f6b');
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI * 2 / 3 + 0.5;
      line(P(Math.cos(a) * 0.4, Math.sin(a) * 0.4, H + 6), P(0, 0, H + 26), '#7c6f5a', 2);
    }
    for (let k = 0; k < 3; k++) ringArc(0, 0, H + 10 + k * 5, 0.28 - k * 0.05, '#e09a46', 2.5);
    const [ox, oy] = P(0, 0, H + 28);
    const pulse = 0.7 + Math.sin(t * 5 + (b.id || 0)) * 0.3;
    glow(ox, oy, 26 * pulse + 6, '255,240,120', 0.75);
    circle(ox, oy, 7, '#fffbe0', '#ffe066', 2);
    if (Math.sin(t * 7 + (b.id || 0) * 3) > 0.75) {
      g.strokeStyle = '#fff6a0'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(ox, oy);
      let x = ox, y = oy;
      for (let i = 0; i < 4; i++) { x += (Math.random() - 0.5) * 14; y += Math.random() * 8; g.lineTo(x, y); }
      g.stroke();
    }
  };

  draw.vent = (b, t, o) => {
    const L = b.l || 1, a = o.aim ?? 0;
    const brass = ['', '#c9973a', '#c9973a', '#d4a64a', '#e0b85a', '#9fd8ff'][L];
    box(-0.9, -0.9, 0.9, 0.9, 0, 4, '#8f8a80', '#a29d93');
    const z = 14 + L * 2;
    cyl(0, 0, 0.8, 4, z, '#9fb3c0', '#c2d3dd');
    for (let i = 0; i < 4; i++) { // petites ailes d'éolienne sur le socle
      const aa = t * 2 + i * Math.PI / 2;
      line(P(0, 0, z + 2), P(Math.cos(aa) * 0.7, Math.sin(aa) * 0.7, z + 2), 'rgba(255,255,255,.5)', 2);
    }
    cyl(0, 0, 0.4, z, z + 10, '#5c6b78');
    const dx = Math.cos(a), dy = Math.sin(a);
    const [bx, by] = P(-dx * 0.35, -dy * 0.35, z + 16), [mx, my] = P(dx * 0.85, dy * 0.85, z + 19);
    const sx = mx - bx, sy = my - by, sl = Math.hypot(sx, sy) || 1, nx = -sy / sl, ny = sx / sl;
    const r0 = 6, r1 = 14 + L;
    const away = dx + dy < 0;
    const mouth = () => {
      ellipse(mx, my, r1, r1 * 0.5, '#2b2b36', sh(brass, -0.2), 3, Math.atan2(ny, nx));
      const sw = (t * 4) % 1;
      g.globalAlpha = 0.6 * (1 - sw);
      ellipse(mx + sx / sl * sw * 10, my + sy / sl * sw * 10, r1 * (0.4 + sw * 0.6), r1 * 0.3 * (0.4 + sw * 0.6), null, '#ffffff', 2, Math.atan2(ny, nx));
      g.globalAlpha = 1;
    };
    if (away) mouth();
    const gr = g.createLinearGradient(bx + nx * r1, by + ny * r1, bx - nx * r1, by - ny * r1);
    gr.addColorStop(0, sh(brass, 0.3)); gr.addColorStop(0.5, brass); gr.addColorStop(1, sh(brass, -0.4));
    poly([[bx + nx * r0, by + ny * r0], [mx + nx * r1, my + ny * r1], [mx - nx * r1, my - ny * r1], [bx - nx * r0, by - ny * r0]], gr, EDGE);
    circle(bx, by, r0, sh(brass, -0.25), EDGE);
    if (!away) mouth();
  };

  draw.mur = (b, t, o) => {
    const L = b.l || 1;
    const col = ['', '#a8814f', '#aab0ba', '#7f8693', '#d8b86c', '#8e7cc3'][L];
    const h = 12 + L * 2;
    if (L === 1) { // palissade en bois
      if (o.nU) box(0, -0.08, 1, 0.08, 4, 10, '#7a5230');
      if (o.nV) box(-0.08, 0, 0.08, 1, 4, 10, '#7a5230');
      for (const [u, v] of [[-0.12, -0.12], [0.12, 0.12], [0.12, -0.12], [-0.12, 0.12]].sort((p, q) => p[0] + p[1] - q[0] - q[1])) {
        cyl(u, v, 0.1, 0, h - 4, col);
        cyl(u, v, 0.1, h - 4, h + 2, col, null, 0);
      }
      return;
    }
    const seg = (horiz) => {
      if (horiz) box(0, -0.2, 1, 0.2, 0, h - 3, col); else box(-0.2, 0, 0.2, 1, 0, h - 3, col);
      for (const f of [0.38, 0.62]) {
        if (horiz) box(f - 0.07, -0.2, f + 0.07, 0.2, h - 3, h + 1, col); else box(-0.2, f - 0.07, 0.2, f + 0.07, h - 3, h + 1, col);
      }
    };
    if (o.nU) seg(true);
    if (o.nV) seg(false);
    box(-0.24, -0.24, 0.24, 0.24, 0, h + 2, col);
    if (L >= 4) box(-0.27, -0.27, 0.27, 0.27, h + 2, h + 5, L === 5 ? '#d7c4ff' : '#f0d27a');
    if (L === 3) { const [x, y] = P(0.1, 0.24, 5); ellipse(x, y, 4, 2, 'rgba(90,150,60,.8)'); }
    if (L === 5) { const [x, y] = P(0, 0, h + 4); glow(x, y, 8, '200,170,255', 0.6); }
  };

  function scaffold(s, t) {
    const r = s / 2 - 0.15;
    box(-r, -r, r, r, 0, 4, '#b08968', '#c49a75');
    cyl(-r + 0.1, -r + 0.1, 0.05, 4, 36, '#8a5a33');
    cyl(r - 0.1, -r + 0.1, 0.05, 4, 36, '#8a5a33');
    cyl(-r + 0.1, r - 0.1, 0.05, 4, 36, '#8a5a33');
    box(-0.35, -0.25, 0.05, 0.15, 4, 14, '#c08a4a');
    box(0.05, -0.15, 0.3, 0.1, 4, 10, '#a8743f');
    line(P(-r, r - 0.1, 18), P(r, r - 0.1, 18), '#a8743f', 4);
    line(P(r - 0.1, -r, 30), P(r - 0.1, r, 30), '#a8743f', 4);
    line(P(-r, r - 0.1, 30), P(r, r - 0.1, 30), '#a8743f', 4);
    cyl(r - 0.1, r - 0.1, 0.05, 4, 36, '#8a5a33');
  }

  // =====================================================================
  //  Décor
  // =====================================================================
  function tree(kind, t, seed) {
    const sway = Math.sin(t * 1.5 + seed * 10) * 1.2;
    if (kind === 0) {
      cyl(0, 0, 0.08, 0, 16, '#7a5230');
      const [x, y] = P(0, 0, 26);
      const blob = (dx, dy, r, c) => { const gr = g.createRadialGradient(x + dx - r * 0.3 + sway, y + dy - r * 0.4, 1, x + dx + sway, y + dy, r); gr.addColorStop(0, sh(c, 0.25)); gr.addColorStop(1, sh(c, -0.2)); circle(x + dx + sway, y + dy, r, gr, EDGE); };
      blob(-7, 2, 9, '#4f9d3a'); blob(7, 3, 9, '#4a9436'); blob(0, -6, 11, '#5aab42');
      if (seed > 0.6) { circle(x - 3 + sway, y - 4, 1.8, '#ff5a5a'); circle(x + 5 + sway, y + 2, 1.8, '#ff5a5a'); }
    } else if (kind === 1) {
      cyl(0, 0, 0.07, 0, 10, '#6b4a2e');
      cyl(0, 0, 0.42, 8, 26, '#2f7d4a', null, 0);
      cyl(0, 0, 0.33, 18, 36, '#358a52', null, 0);
      cyl(0, 0, 0.24, 28, 46, '#3d9a5c', null, 0);
    } else {
      pyr(-0.28, -0.22, 0.26, 0.24, 0, 11, '#9c9a96', 0.02, -0.06);
      pyr(0.05, 0.1, 0.32, 0.36, 0, 6, '#8a8884');
    }
  }

  // =====================================================================
  //  Personnages (dessinés de profil, tournés vers la droite, pieds en 0,0)
  // =====================================================================
  const U = {};
  U.plumeur = (t, mv, atk) => {
    const w = mv ? Math.sin(t * 14) : 0;
    g.lineCap = 'round';
    line([-2, -6], [-2 + w * 3, 0], '#e07b00', 2.2); line([2, -6], [2 - w * 3, 0], '#e07b00', 2.2);
    poly([[-7, -14], [-14, -19], [-12, -13], [-15, -9], [-7, -9]], '#c46a1b', EDGE);
    const gr = g.createRadialGradient(-2, -17, 1, 0, -13, 10);
    gr.addColorStop(0, '#ffe37a'); gr.addColorStop(1, '#e09a17');
    circle(0, -13, 8.5, gr, EDGE);
    ellipse(2.5, -9.5, 5, 3.6, '#fff1c4');
    g.save(); g.translate(-2, -12); g.rotate(mv ? Math.sin(t * 14) * 0.35 : 0.1);
    ellipse(0, 0, 5.5, 3.5, '#d98a1f', EDGE); g.restore();
    circle(3.6, -15.5, 2.7, '#ffffff'); circle(4.5, -15.5, 1.3, '#111');
    line([1.4, -19.2], [6, -17.6], '#5a2a00', 1.5);
    poly([[7, -15], [12.5, -13], [7, -11]], '#ff8c1a', EDGE);
    g.beginPath(); g.arc(0, -14, 9, Math.PI * 1.08, Math.PI * 1.92); g.closePath(); g.fillStyle = '#9aa3b2'; g.fill(); g.strokeStyle = EDGE; g.stroke();
    poly([[-1, -22], [-6, -29], [-3, -22.5], [-8, -26], [-4, -21]], '#e63946');
    const sa = atk > 0 ? -1.5 + (1 - atk) * 2.4 : -0.6;
    g.save(); g.translate(6, -9); g.rotate(sa);
    poly([[0, -1], [12, -1], [14, 0], [12, 1], [0, 1]], '#eef3f8', '#7a8494');
    poly([[-0.5, -3], [1.5, -3], [1.5, 3], [-0.5, 3]], '#8a5a33');
    g.restore();
  };
  U.archere = (t, mv, atk) => {
    const w = mv ? Math.sin(t * 12) : 0;
    g.lineCap = 'round';
    line([-1.5, -9], [-1.5 + w * 3, 0], '#5a3d22', 2.8); line([1.5, -9], [1.5 - w * 3, 0], '#5a3d22', 2.8);
    poly([[-3, -21], [-9 + w, -6], [0, -9]], '#1d6f5f', EDGE);
    poly([[-4, -21], [4, -21], [5, -9], [-5, -9]], '#2a9d8f', EDGE);
    line([-5, -12], [5, -12], '#6b4a2e', 1.8);
    const pt = mv ? Math.sin(t * 12) * 2 : 0;
    poly([[-3, -27], [-9, -24 + pt], [-8, -20 + pt], [-3, -23]], '#8b4a1d');
    circle(0, -25.5, 4.6, '#f2c79b', EDGE);
    g.beginPath(); g.arc(0, -26, 4.9, Math.PI * 0.95, Math.PI * 2.05); g.closePath(); g.fillStyle = '#8b4a1d'; g.fill();
    circle(2.4, -25.5, 0.9, '#222');
    const pull = atk > 0 ? Math.sin(atk * Math.PI) * 5 : 0;
    line([1, -19], [7, -18], '#f2c79b', 2);
    g.beginPath(); g.moveTo(7, -28); g.quadraticCurveTo(13, -18, 7, -8); g.strokeStyle = '#7a4a1d'; g.lineWidth = 2; g.stroke();
    g.beginPath(); g.moveTo(7, -28); g.lineTo(7 - pull, -18); g.lineTo(7, -8); g.strokeStyle = '#eee'; g.lineWidth = 0.8; g.stroke();
    if (atk > 0) { line([7 - pull, -18], [16, -18], '#5a3d22', 1.4); poly([[16, -19.5], [19, -18], [16, -16.5]], '#cfd6e0'); }
  };
  U.sapeur = (t, mv, atk) => {
    const hop = mv ? Math.abs(Math.sin(t * 12)) * 3 : 0;
    g.save(); g.translate(0, -hop);
    ellipse(-3, -1, 2.5, 1.5, '#555'); ellipse(3, -1, 2.5, 1.5, '#555');
    const c = '#f4f7ff';
    for (const [x, y, r] of [[-5, -7, 5], [5, -7, 5], [0, -11, 6.5], [-2, -5, 5], [3, -5, 5]]) circle(x, y, r, c, 'rgba(120,140,180,.6)');
    for (const [x, y, r] of [[-5, -7, 4.2], [5, -7, 4.2], [0, -11, 5.7], [-2, -5, 4.2], [3, -5, 4.2]]) circle(x, y, r, c);
    circle(-1.8, -9, 1.2, '#222'); circle(2.6, -9, 1.2, '#222');
    line([-3.5, -11.5], [-0.5, -10.4], '#222', 1.2); line([4.2, -11.5], [1.4, -10.4], '#222', 1.2);
    g.lineCap = 'round';
    line([-4, -12], [-3.5, -18], '#cfd6e6', 2.2); line([4, -12], [3.5, -18], '#cfd6e6', 2.2);
    const gr = g.createRadialGradient(-2, -25, 1, 0, -23, 7);
    gr.addColorStop(0, '#666'); gr.addColorStop(1, '#1a1a22');
    circle(0, -23, 6.5, gr);
    poly([[-1.5, -30], [1.5, -30], [1.5, -28], [-1.5, -28]], '#888');
    g.beginPath(); g.moveTo(0, -30); g.quadraticCurveTo(3, -34, 5, -32); g.strokeStyle = '#c9a25a'; g.lineWidth = 1.2; g.stroke();
    const fl = 2 + Math.random() * 2;
    circle(5, -32, fl + 1, 'rgba(255,160,40,.7)'); circle(5, -32, fl * 0.5, '#fff6a0');
    g.restore();
  };
  U.golem = (t, mv, atk) => {
    const w = mv ? Math.sin(t * 6) : 0;
    const legL = Math.max(0, w) * 3, legR = Math.max(0, -w) * 3;
    const fist = (x, y, r) => { const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r); gr.addColorStop(0, '#a6a9b0'); gr.addColorStop(1, '#5f626a'); circle(x, y, r, gr, EDGE); };
    fist(-11, -17 + w * 2, 5.5);
    poly([[-8, -12 - legL], [-1, -12 - legL], [-1, -legL], [-8, -legL]], '#6f727a', EDGE);
    poly([[2, -12 - legR], [9, -12 - legR], [9, -legR], [2, -legR]], '#7d8088', EDGE);
    const bob = mv ? Math.abs(w) * 1.5 : 0;
    g.save(); g.translate(0, -bob);
    const gr = g.createLinearGradient(-12, -36, 12, -12);
    gr.addColorStop(0, '#b4b7be'); gr.addColorStop(1, '#6c6f77');
    poly([[-11, -13], [-13, -29], [-7, -37], [8, -37], [13, -29], [11, -13]], gr, EDGE, 1.2);
    line([-4, -30], [-1, -24], 'rgba(40,40,50,.5)', 1.2); line([-1, -24], [-5, -18], 'rgba(40,40,50,.5)', 1.2); line([6, -20], [9, -27], 'rgba(40,40,50,.5)', 1.2);
    ellipse(-8, -34, 5, 2.5, '#6a9a4a'); ellipse(8, -35, 4, 2, '#6a9a4a');
    poly([[-4, -44], [6, -44], [7, -36], [-5, -36]], '#8f9299', EDGE);
    poly([[0, -41.5], [2.5, -41.5], [2.5, -39.5], [0, -39.5]], '#7ff3ff'); poly([[3.8, -41.5], [6, -41.5], [6, -39.5], [3.8, -39.5]], '#7ff3ff');
    glow(3, -40, 6, '127,243,255', 0.5);
    const ang = atk > 0 ? -1.7 + (1 - atk) * 2.6 : 1.2 + w * 0.25;
    const sx = 8, sy = -31, fx = sx + Math.cos(ang) * 14, fy = sy + Math.sin(ang) * 14;
    line([sx, sy], [fx, fy], '#7d8088', 7);
    fist(fx, fy, 6.5);
    g.restore();
  };
  U.aeronef = (t, mv, atk) => {
    g.save(); g.translate(0, Math.sin(t * 2) * 2);
    line([-11, -20], [-7, -8], '#5a3d22', 1); line([11, -20], [7, -8], '#5a3d22', 1); line([0, -18], [0, -8], '#5a3d22', 1);
    poly([[-19, -28], [-27, -36], [-25, -27], [-27, -19]], '#a8dadc', EDGE);
    g.save();
    g.beginPath(); g.ellipse(0, -28, 20, 11, 0, 0, Math.PI * 2); g.clip();
    g.fillStyle = '#e63946'; g.fillRect(-21, -40, 42, 24);
    g.fillStyle = '#f1faee'; for (const x of [-12, -2, 8]) g.fillRect(x, -40, 4, 24);
    const gr = g.createRadialGradient(-6, -33, 2, 0, -28, 22);
    gr.addColorStop(0, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(0,0,0,.35)');
    g.fillStyle = gr; g.fillRect(-21, -40, 42, 24);
    g.restore();
    ellipse(0, -28, 20, 11, null, EDGE, 1.2);
    poly([[-9, -8], [9, -8], [7, 0], [-7, 0]], '#8a5a33', EDGE);
    line([-9, -8], [9, -8], '#c9973a', 2);
    circle(2, -10, 3, '#ffcc33', EDGE); circle(3.3, -10.5, 1, '#222');
    const pr = Math.abs(Math.sin(t * 30));
    ellipse(-11, -4, 1.4, 6 * pr + 0.5, '#d8dde6', EDGE);
    if (atk > 0) circle(0, 3 + (1 - atk) * 6, 3, '#222');
    g.restore();
  };

  // =====================================================================
  //  API
  // =====================================================================
  return {
    sh,
    // Dessine un bâtiment ; (x, y) = centre au sol en coordonnées monde
    building(ctx, b, x, y, t, o = {}) {
      g = ctx; OX = x; OY = y;
      if (o.scaffold) { scaffold(o.size, t); return; }
      (draw[b.t] || draw.mur)(b, t, o);
    },
    deco(ctx, kind, x, y, t, seed) { g = ctx; OX = x; OY = y; tree(kind, t, seed); },
    // Dessine un personnage ; le contexte est déjà placé à ses pieds
    unit(ctx, type, t, moving, atk) { g = ctx; OX = 0; OY = 0; (U[type] || U.plumeur)(t, moving, atk); },
    // Petite image d'aperçu (pour les menus)
    thumbs: new Map(),
    thumb(kind, type, level = 1, size = 1) {
      const key = kind + type + level;
      if (this.thumbs.has(key)) return this.thumbs.get(key);
      const c = document.createElement('canvas');
      c.width = c.height = 160;
      const cx = c.getContext('2d');
      if (kind === 'b') {
        const sc = Math.min(1.3, 118 / (size * 64 + 20));
        cx.translate(80, 160 - (size * 16 + 14) * sc); cx.scale(sc, sc);
        g = cx; OX = 0; OY = 0;
        poly([P(-size / 2 - 0.15, -size / 2 - 0.15), P(size / 2 + 0.15, -size / 2 - 0.15), P(size / 2 + 0.15, size / 2 + 0.15), P(-size / 2 - 0.15, size / 2 + 0.15)], '#79c25a', '#5fa041', 2);
        const fake = { t: type, l: level, id: 1 };
        this.building(cx, fake, 0, 0, 1.2, { aim: 0.6, fill: 0.7, nU: false, nV: false });
      } else {
        const sc = type === 'aeronef' ? 2.6 : type === 'golem' ? 2.8 : 3.6;
        cx.translate(80, type === 'aeronef' ? 130 : 148); cx.scale(sc, sc);
        g = cx;
        ellipse(0, 0, 9, 3.5, 'rgba(0,0,0,.25)');
        if (type === 'aeronef') cx.translate(0, -6);
        U[type](0.3, false, 0);
      }
      const url = c.toDataURL();
      this.thumbs.set(key, url);
      return url;
    },
  };
})();
