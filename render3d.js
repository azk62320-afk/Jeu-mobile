/* Îles Célestes — moteur de rendu 3D (Three.js) : caméra, île, nuages, lumières,
   synchronisation des bâtiments / guerriers / projectiles, effets et étiquettes. */
'use strict';
window.R3 = (() => {
  const T3 = THREE, PI = Math.PI;
  let renderer, scene, camera, W = 1, H = 1, N = 24, isLand, hash;
  const target = new T3.Vector3(12, 0, 12);
  let dist = 26;
  const DMIN = 8, DMAX = 46, PITCH = 0.93, YAW = PI / 4, FOV = 30;
  const ray = new T3.Raycaster(), ndc = new T3.Vector2(), ground = new T3.Plane(new T3.Vector3(0, 1, 0), 0);
  let labelBox = null;

  // ---------- Initialisation ----------
  function init(canvas, opts) {
    N = opts.N; isLand = opts.isLand; hash = opts.hash;
    renderer = new T3.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T3.PCFSoftShadowMap;
    scene = new T3.Scene();
    scene.fog = new T3.Fog(0xcfe9ff, 45, 95);
    camera = new T3.PerspectiveCamera(FOV, 1, 0.5, 200);

    scene.add(new T3.HemisphereLight(0xe3f2ff, 0x5a7a35, 0.62));
    const sun = new T3.DirectionalLight(0xfff0d0, 0.78);
    sun.position.set(N / 2 - 10, 22, N / 2 - 3);
    sun.target.position.set(N / 2, 0, N / 2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -18; sc.right = 18; sc.top = 18; sc.bottom = -18; sc.near = 1; sc.far = 60;
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02;
    scene.add(sun, sun.target);

    buildIsland();
    buildClouds();
    buildDeco();
    buildGrid();
    buildSelection();

    labelBox = document.getElementById('labels');
    resetCam();
  }

  function resize(w, h) {
    W = w; H = h;
    renderer.setPixelRatio(lowQ ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < h ? FOV * 1.25 : FOV;
    camera.updateProjectionMatrix();
  }

  function updateCam() {
    const c = Math.cos(PITCH);
    camera.position.set(target.x + Math.sin(YAW) * c * dist, Math.sin(PITCH) * dist, target.z + Math.cos(YAW) * c * dist);
    camera.lookAt(target);
    camera.updateMatrixWorld();
  }
  function resetCam() { target.set(N / 2, 0, N / 2 + 0.5); dist = W < H ? 36 : 28; updateCam(); }
  function clampTarget() { target.x = Math.max(2, Math.min(N - 2, target.x)); target.z = Math.max(2, Math.min(N - 2, target.z)); }

  function groundAt(sx, sy) {
    ndc.set(sx / W * 2 - 1, -(sy / H) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const p = new T3.Vector3();
    return ray.ray.intersectPlane(ground, p) ? p : null;
  }
  function screenToTile(sx, sy) { const p = groundAt(sx, sy); return p ? { x: p.x, y: p.z } : { x: -99, y: -99 }; }
  function pan(x0, y0, x1, y1) {
    const a = groundAt(x0, y0), b = groundAt(x1, y1);
    if (!a || !b) return;
    target.add(a.sub(b)); clampTarget(); updateCam();
  }
  function zoomAt(sx, sy, f) {
    const a = groundAt(sx, sy);
    dist = Math.max(DMIN, Math.min(DMAX, dist * f));
    updateCam();
    const b = groundAt(sx, sy);
    if (a && b) { target.add(a.sub(b)); clampTarget(); updateCam(); }
  }
  function project(x, y, z) {
    const v = new T3.Vector3(x, y, z).project(camera);
    return { x: (v.x + 1) / 2 * W, y: (1 - v.y) / 2 * H, ok: v.z < 1 };
  }
  function screenAngle(wx, wy) {
    const a = project(N / 2, 0, N / 2), b = project(N / 2 + wx * 3, 0, N / 2 + wy * 3);
    return Math.atan2(b.y - a.y, b.x - a.x);
  }

  // ---------- Île flottante ----------
  function buildIsland() {
    const pos = [], col = [];
    const cTop = (x, y) => {
      const h = hash(x, y), even = (x + y) % 2 === 0;
      const c = new T3.Color(even ? 0x74c043 : 0x6bb63c);
      c.offsetHSL(0, 0, (h - 0.5) * 0.04);
      return c;
    };
    const center = N / 2;
    const depth = (x, y) => {
      if (!isLand(x, y)) return 0;
      const d = Math.hypot(x + 0.5 - center, y + 0.5 - center) / center;
      return 0.9 + Math.pow(Math.max(0, 1 - d), 1.1) * 7.5 + hash(x * 1.7, y * 2.3) * 1.3;
    };
    const sideCol = (y, dd) => {
      if (y > -0.2) return new T3.Color(0x5f9f3b);
      if (y > -0.75) return new T3.Color(0x9a6b43);
      const k = Math.min(1, (-y - 0.75) / Math.max(1, dd));
      return new T3.Color(0x7d6754).lerp(new T3.Color(0x4a3d37), k);
    };
    const push = (p, c) => { pos.push(p[0], p[1], p[2]); col.push(c.r, c.g, c.b); };
    const quad = (a, b, c, d, ca, cb, cc, cd) => { push(a, ca); push(b, cb); push(c, cc); push(a, ca); push(c, cc); push(d, cd); };
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (!isLand(x, y)) continue;
      const c = cTop(x, y);
      quad([x, 0, y], [x, 0, y + 1], [x + 1, 0, y + 1], [x + 1, 0, y], c, c, c, c);
      const d = depth(x, y);
      const sides = [[x + 1, y, [x + 1, y], [x + 1, y + 1]], [x - 1, y, [x, y + 1], [x, y]], [x, y + 1, [x + 1, y + 1], [x, y + 1]], [x, y - 1, [x, y], [x + 1, y]]];
      for (const [nx, ny, p0, p1] of sides) {
        const nd = isLand(nx, ny) ? depth(nx, ny) : 0;
        if (nd >= d) continue;
        const ys = [-nd];
        for (const v of [-0.2, -0.75]) if (v < -nd && v > -d) ys.push(v);
        ys.push(-d);
        for (let i = 0; i < ys.length - 1; i++) {
          const yt = ys[i], yb = ys[i + 1];
          const ct = sideCol(yt - 0.001, d), cb = sideCol(yb + 0.001, d);
          quad([p0[0], yt, p0[1]], [p1[0], yt, p1[1]], [p1[0], yb, p1[1]], [p0[0], yb, p0[1]], ct, ct, cb, cb);
        }
      }
      const cb = new T3.Color(0x3e332e);
      quad([x, -d, y], [x + 1, -d, y], [x + 1, -d, y + 1], [x, -d, y + 1], cb, cb, cb, cb);
    }
    const g = new T3.BufferGeometry();
    g.setAttribute('position', new T3.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new T3.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    const m = new T3.Mesh(g, new T3.MeshLambertMaterial({ vertexColors: true, side: T3.DoubleSide }));
    m.receiveShadow = true;
    scene.add(m);

    // fleurs et touffes d'herbe
    const F = new Models.Builder();
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (!isLand(x, y)) continue;
      const h = hash(x * 5.1, y * 3.7);
      if (h > 0.55) F.cone(0.05, 0.12, 0x5da83a, { x: x + 0.2 + h * 0.6, y: 0.05, z: y + 0.3 + hash(y, x) * 0.5 }, 4);
      if (h > 0.8) F.sph(0.045, [0xffffff, 0xffe066, 0xff9ecf][Math.floor(h * 30) % 3], { x: x + 0.6, y: 0.05, z: y + 0.4 + (h - 0.8) * 2 }, 6, 4);
    }
    const fm = F.mesh(undefined, false); fm.receiveShadow = true; scene.add(fm);

    // petits rochers qui flottent sous l'île
    floaters = [];
    for (let i = 0; i < 7; i++) {
      const M = new Models.Builder();
      const r = 0.35 + hash(i, 3) * 0.6;
      M.rock(r, 0x7d6754, { sy: 1.3 });
      M.cyl(r * 0.8, r * 0.8, 0.12, 0x7cc54f, { y: r * 0.9 }, 8);
      const o = M.mesh();
      const a = i / 7 * PI * 2 + 0.4, R = N / 2 + 2.5 + hash(i, 9) * 3;
      o.position.set(N / 2 + Math.cos(a) * R, -2 - hash(i, 5) * 4, N / 2 + Math.sin(a) * R);
      o.userData.base = o.position.y; o.userData.ph = i;
      scene.add(o); floaters.push(o);
    }
  }
  let floaters = [];

  // ---------- Nuages ----------
  const clouds = [];
  function buildClouds() {
    const mat = new T3.MeshLambertMaterial({ color: 0xffffff, emissive: 0x8899aa, transparent: true, opacity: 0.92 });
    for (let i = 0; i < 16; i++) {
      const M = new Models.Builder();
      const n = 4 + (i % 3);
      for (let k = 0; k < n; k++) M.ico(0.9 + hash(i, k) * 0.9, 0xffffff, { x: (k - n / 2) * 1.0, y: hash(k, i) * 0.6, z: (hash(i * 2, k) - 0.5) * 1.4 }, 1);
      const m = new T3.Mesh(M.geometry(false), mat);
      const a = hash(i, 1) * PI * 2, R = 16 + hash(i, 2) * 22;
      m.position.set(N / 2 + Math.cos(a) * R, -3 - hash(i, 4) * 10 + (i % 4 === 0 ? 8 : 0), N / 2 + Math.sin(a) * R);
      m.scale.setScalar(1 + hash(i, 7) * 1.4);
      scene.add(m); clouds.push(m);
    }
  }

  // ---------- Décor (arbres, rochers, buissons) ----------
  const deco = [];
  function buildDeco() {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (!isLand(x, y)) continue;
      const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => !isLand(x + a * 2, y + b * 2));
      const h = hash(x * 3.1, y * 7.3);
      const cheb = Math.max(Math.abs(x - 12), Math.abs(y - 12));
      if (!((edge && h > 0.45) || (cheb >= 8 && h > 0.84) || h > 0.975)) continue;
      const k = hash(y * 1.3, x * 2.9);
      const kind = k < 0.4 ? 0 : k < 0.72 ? 1 : k < 0.86 ? 3 : 2;
      const g = Models.deco(kind, hash(x, y * 2));
      g.position.set(x + 0.5, 0, y + 0.5);
      g.scale.setScalar(0.85 + h * 0.4);
      scene.add(g);
      deco.push({ x, y, g });
    }
  }

  // ---------- Grille de placement et sélection ----------
  let grid;
  function buildGrid() {
    const pts = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (!isLand(x, y)) continue;
      pts.push(x, 0.02, y, x + 1, 0.02, y, x, 0.02, y, x, 0.02, y + 1);
    }
    const g = new T3.BufferGeometry(); g.setAttribute('position', new T3.Float32BufferAttribute(pts, 3));
    grid = new T3.LineSegments(g, new T3.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22 }));
    grid.visible = false; scene.add(grid);
  }
  const selRings = {};
  let selBase;
  function buildSelection() {
    for (const s of [1, 2, 3]) {
      const M = new Models.Builder(), w = 0.07, h = s / 2 + 0.02;
      M.box(s + 0.1, 0.04, w, 0xffffff, { y: 0.03, z: -h }); M.box(s + 0.1, 0.04, w, 0xffffff, { y: 0.03, z: h });
      M.box(w, 0.04, s + 0.1, 0xffffff, { y: 0.03, x: -h }); M.box(w, 0.04, s + 0.1, 0xffffff, { y: 0.03, x: h });
      const m = new T3.Mesh(M.geometry(false), new T3.MeshBasicMaterial({ vertexColors: true }));
      m.visible = false; scene.add(m); selRings[s] = m;
    }
    selBase = new T3.Mesh(new T3.PlaneGeometry(1, 1), new T3.MeshBasicMaterial({ color: 0x55ff66, transparent: true, opacity: 0.4, depthWrite: false }));
    selBase.rotation.x = -PI / 2; selBase.position.y = 0.015; selBase.visible = false; scene.add(selBase);
  }

  // ---------- Zone interdite (combat) ----------
  let forbidMesh = null;
  function setBattle(E) {
    if (forbidMesh) { scene.remove(forbidMesh); forbidMesh.geometry.dispose(); forbidMesh = null; }
    if (!E) return;
    const pos = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (!E.forbid[y * N + x] || !isLand(x, y)) continue;
      pos.push(x, 0.03, y, x, 0.03, y + 1, x + 1, 0.03, y + 1, x, 0.03, y, x + 1, 0.03, y + 1, x + 1, 0.03, y);
    }
    const g = new T3.BufferGeometry(); g.setAttribute('position', new T3.Float32BufferAttribute(pos, 3));
    forbidMesh = new T3.Mesh(g, new T3.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.2, depthWrite: false }));
    scene.add(forbidMesh);
  }

  // ---------- Étiquettes HTML (minuteurs, barres de vie, textes) ----------
  const labels = new Map();
  let lf = 0;
  function label(key, cls, html, x, y, z, dy = 0) {
    const p = project(x, y, z);
    let e = labels.get(key);
    if (!e) { e = document.createElement('div'); e.className = 'lbl ' + cls; labelBox.appendChild(e); labels.set(key, e); }
    if (e._h !== html) { e.innerHTML = html; e._h = html; }
    e._f = lf;
    if (!p.ok) { e.style.display = 'none'; return e; }
    e.style.display = '';
    e.style.transform = `translate(${p.x.toFixed(1)}px,${(p.y + dy).toFixed(1)}px) translate(-50%,-100%)`;
    return e;
  }
  function sweepLabels() { for (const [k, e] of labels) if (e._f !== lf) { e.remove(); labels.delete(k); } }
  let uidN = 1;
  const uids = new WeakMap();
  const uid = (o) => { let v = uids.get(o); if (!v) { v = uidN++; uids.set(o, v); } return v; };

  // ---------- Synchronisation des objets ----------
  const bObjs = new Map(), uObjs = new Map(), pObjs = new Map(), fObjs = new Map();
  let frame = 0, selT = 0, lastSel = null;

  function bKey(b, st, nU, nV) {
    const s = st.size(b);
    if (st.battle && b.dead) return 'rubble' + s;
    if (!st.battle && b.l === 0) return 'scaf' + s;
    if (b.t === 'mur') return `mur${b.l}${nU ? 1 : 0}${nV ? 1 : 0}`;
    return b.t + b.l;
  }

  function syncBuildings(st, T) {
    const walls = new Set(), occ = new Set();
    for (const b of st.list) {
      const s = st.size(b);
      for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) occ.add((b.y + j) * N + b.x + i);
      if (b.t === 'mur' && b.l > 0 && !(st.battle && b.dead)) walls.add(b.y * N + b.x);
    }
    if (st.placing) { const b = st.placing, s = st.size(b); for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) occ.add((b.y + j) * N + b.x + i); }
    for (const d of deco) d.g.visible = !occ.has(d.y * N + d.x);

    const all = st.placing ? st.list.concat([st.placing]) : st.list;
    for (const b of all) {
      const s = st.size(b);
      const nU = b.x + 1 < N && walls.has(b.y * N + b.x + 1), nV = walls.has((b.y + 1) * N + b.x);
      const key = bKey(b === st.placing ? Object.assign({}, b, { l: Math.max(1, b.l) }) : b, st, nU, nV);
      let o = bObjs.get(b);
      if (!o || o.key !== key) {
        if (o) scene.remove(o.group);
        let made;
        if (key.startsWith('rubble')) made = { group: Models.rubble(s), anim: null };
        else if (key.startsWith('scaf')) made = { group: Models.scaffold(s), anim: null };
        else made = Models.building(b.t, Math.max(1, b.l), { nU, nV });
        made.group.userData.b = b;
        scene.add(made.group);
        o = { key, group: made.group, anim: made.anim };
        bObjs.set(b, o);
      }
      o.f = frame;
      const g = o.group;
      g.position.set(b.x + s / 2, 0, b.y + s / 2);
      let sy = 1, sxz = 1;
      if (b === lastSel && T - selT < 0.6) { const k = (T - selT) / 0.6; sy = 1 + Math.sin(k * PI * 3) * 0.08 * (1 - k); sxz = 1 - (sy - 1) * 0.5; }
      if (b.hit > 0) { sy *= 0.94; sxz *= 1.03; }
      if (b === st.placing) sy *= 1 + Math.sin(T * 6) * 0.03;
      g.scale.set(sxz, sy, sxz);
      if (o.anim) o.anim(T, { aim: b.aim ?? (T * 0.35 + (b.id || 0) * 1.7), fill: st.fill(b), fired: b.fired, id: b.id });
      // étiquettes
      const info = st.info(b);
      const top = st.height(b);
      if (info.hp !== null) label('h' + uid(b), 'lbl-hp', `<i style="width:${(info.hp * 100).toFixed(0)}%" class="${info.hp > 0.5 ? 'g' : info.hp > 0.25 ? 'y' : 'r'}"></i>`, b.x + s / 2, top, b.y + s / 2);
      if (info.timer) label('t' + uid(b), 'lbl-timer', `<b>${info.timer}</b><i style="width:${(info.prog * 100).toFixed(0)}%"></i>`, b.x + s / 2, top + 0.3, b.y + s / 2);
      if (info.bubble) label('c' + uid(b), 'lbl-bubble' + (info.full ? ' full' : ''), info.bubble, b.x + s / 2, top + 0.2, b.y + s / 2, Math.sin(T * 4 + (b.id || 0)) * 3);
      if (info.name) label('n' + uid(b), 'lbl-name', info.name, b.x + s / 2, top + 0.55, b.y + s / 2);
    }
    for (const [b, o] of bObjs) if (o.f !== frame) { scene.remove(o.group); bObjs.delete(b); }

    // sélection
    for (const s in selRings) selRings[s].visible = false;
    selBase.visible = false;
    const g = st.placing || st.sel;
    if (g !== lastSel) { lastSel = g; selT = T; }
    if (g) {
      const s = st.size(g), r = selRings[s];
      r.visible = true; r.position.set(g.x + s / 2, 0, g.y + s / 2);
      if (st.placing) {
        selBase.visible = true; selBase.scale.set(s, s, 1); selBase.position.set(g.x + s / 2, 0.015, g.y + s / 2);
        selBase.material.color.set(st.placingValid ? 0x55ff66 : 0xff4040);
        r.material.color.set(st.placingValid ? 0xffffff : 0xff6060);
      } else r.material.color.set(0xffffff);
    }
    grid.visible = !!st.placing;
  }

  function syncUnits(st, T, dt) {
    for (const u of st.units) {
      let o = uObjs.get(u);
      if (!o) { o = Models.unit(u.t); o.yaw = 0; scene.add(o.root); uObjs.set(u, o); }
      o.f = frame;
      const air = u.air;
      o.root.position.set(u.x, air ? 1.55 : 0, u.y);
      if (u.dx !== undefined && (u.dx || u.dy)) {
        const want = Math.atan2(u.dx, u.dy);
        let d = want - o.yaw; while (d > PI) d -= PI * 2; while (d < -PI) d += PI * 2;
        o.yaw += d * Math.min(1, dt * 10);
      }
      o.root.rotation.y = o.yaw;
      o.anim(T + (u.ph || 0), u.moving, u.lunge > 0 ? u.lunge / 0.3 : 0);
      if (u.hit > 0) o.root.scale.setScalar(0.92); else o.root.scale.setScalar(1);
      if (u.hp < u.max) label('u' + uid(u), 'lbl-hp small', `<i class="b" style="width:${(u.hp / u.max * 100).toFixed(0)}%"></i>`, u.x, (air ? 1.55 : 0) + (u.t === 'golem' ? 1.45 : 1.0), u.y);
    }
    for (const [u, o] of uObjs) if (o.f !== frame) { scene.remove(o.root); uObjs.delete(u); }
  }

  const _v = new T3.Vector3();
  function syncProj(st) {
    for (const p of st.proj) {
      let o = pObjs.get(p);
      if (!o) {
        let m;
        if (p.kind === 'bolt' || p.kind === 'arrow') {
          const M = new Models.Builder(), L = p.kind === 'bolt' ? 0.7 : 0.4;
          M.cyl(0.025, 0.025, L, p.kind === 'bolt' ? 0x5a3d22 : 0x8a5a33, { rx: PI / 2 }, 5);
          M.cone(0.05, 0.12, 0xdfe6ee, { z: L / 2 + 0.05, rx: PI / 2 }, 5);
          M.box(0.08, 0.005, 0.1, 0xffffff, { z: -L / 2 + 0.05 });
          m = new T3.Mesh(M.geometry(false), new T3.MeshLambertMaterial({ vertexColors: true }));
        } else if (p.kind === 'bomb') {
          m = new T3.Mesh(new T3.SphereGeometry(0.1, 8, 6), Models.mat(0x222222));
        } else {
          m = new T3.Mesh(new T3.TorusGeometry(0.28, 0.06, 6, 16), new T3.MeshBasicMaterial({ color: 0xeefcff, transparent: true, opacity: 0.8 }));
        }
        o = { m }; scene.add(m); pObjs.set(p, o);
      }
      o.f = frame;
      o.m.position.set(p.x, p.z / 42, p.y);
      if (p.vx !== undefined) {
        _v.set(p.x + p.vx, p.z / 42 - (p.kind === 'bomb' ? 0.3 : 0.05), p.y + p.vy);
        o.m.lookAt(_v);
      }
      if (p.kind === 'gust') o.m.rotateZ(frame * 0.3);
    }
    for (const [p, o] of pObjs) if (o.f !== frame) { scene.remove(o.m); o.m.geometry.dispose(); pObjs.delete(p); }
  }

  // ---------- Effets ----------
  function makeFx(f) {
    const g = new T3.Group();
    g.position.set(f.x, 0, f.y);
    const parts = [];
    if (f.k === 'boom') {
      const r = f.r || 1;
      const core = new T3.Mesh(new T3.SphereGeometry(0.4 * r, 12, 8), new T3.MeshBasicMaterial({ color: 0xffe08a, transparent: true }));
      const outer = new T3.Mesh(new T3.SphereGeometry(0.6 * r, 12, 8), new T3.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0.8 }));
      core.position.y = outer.position.y = 0.4;
      g.add(outer, core); parts.push({ m: core, k: 'core' }, { m: outer, k: 'outer' });
      for (let i = 0; i < 6; i++) {
        const s = new T3.Mesh(new T3.IcosahedronGeometry(0.25 * r, 0), new T3.MeshLambertMaterial({ color: 0x777777, transparent: true, flatShading: true }));
        const a = i / 6 * PI * 2;
        s.userData.v = [Math.cos(a) * 0.8, 1.2 + Math.random(), Math.sin(a) * 0.8];
        s.position.y = 0.3; g.add(s); parts.push({ m: s, k: 'smoke' });
      }
      for (let i = 0; i < 8; i++) {
        const d = new T3.Mesh(new T3.BoxGeometry(0.1, 0.1, 0.1), Models.mat(i % 2 ? 0x8a6a4a : 0x9a9488));
        const a = Math.random() * PI * 2, sp = 1.5 + Math.random() * 2;
        d.userData.v = [Math.cos(a) * sp * r, 3 + Math.random() * 2, Math.sin(a) * sp * r];
        d.position.y = 0.4; g.add(d); parts.push({ m: d, k: 'debris' });
      }
    } else if (f.k === 'puff') {
      for (let i = 0; i < 6; i++) {
        const s = new T3.Mesh(new T3.IcosahedronGeometry(0.16, 1), new T3.MeshLambertMaterial({ color: 0xffffff, transparent: true, emissive: 0x666666 }));
        const a = i / 6 * PI * 2;
        s.userData.v = [Math.cos(a), 0.5, Math.sin(a)];
        s.position.y = (f.air ? 1.55 : 0.15); g.add(s); parts.push({ m: s, k: 'puff' });
      }
    } else if (f.k === 'zap') {
      g.position.set(0, 0, 0);
      for (let i = 1; i < f.pts.length; i++) {
        const a = f.pts[i - 1], b = f.pts[i];
        let prev = new T3.Vector3(a.x, a.z / 42, a.y);
        const end = new T3.Vector3(b.x, b.z / 42, b.y);
        for (let k = 1; k <= 3; k++) {
          const q = prev.clone().lerp(end, 1 / (4 - k));
          if (k < 3) q.add(new T3.Vector3((Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5));
          for (const [w, c] of [[0.09, 0xfff27a], [0.035, 0xffffff]]) {
            const len = prev.distanceTo(q);
            const m = new T3.Mesh(new T3.BoxGeometry(w, w, len), new T3.MeshBasicMaterial({ color: c, transparent: true, blending: T3.AdditiveBlending, depthWrite: false }));
            m.position.copy(prev).lerp(q, 0.5); m.lookAt(q);
            g.add(m); parts.push({ m, k: 'zap' });
          }
          prev = q;
        }
      }
    }
    scene.add(g);
    return { g, parts };
  }

  function syncFx(st) {
    for (const f of st.fx) {
      if (f.k === 'text') {
        const k = f.t / f.max;
        const e = label('f' + uid(f), 'lbl-float', f.text, f.x, 1.2 + k * 1.2, f.y);
        e.style.opacity = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
        e.style.color = f.color || '#fff';
        continue;
      }
      let o = fObjs.get(f);
      if (!o) { o = makeFx(f); fObjs.set(f, o); }
      o.f = frame;
      const k = f.t / f.max;
      for (const p of o.parts) {
        const m = p.m, v = m.userData.v;
        if (p.k === 'core') { m.scale.setScalar(0.5 + k * 1.6); m.material.opacity = 1 - k; }
        else if (p.k === 'outer') { m.scale.setScalar(0.6 + k * 2.2); m.material.opacity = 0.85 * (1 - k); }
        else if (p.k === 'smoke') { m.position.set(v[0] * k, 0.3 + v[1] * k, v[2] * k); m.scale.setScalar(0.5 + k * 1.8); m.material.opacity = 0.75 * (1 - k); }
        else if (p.k === 'debris') { const tt = k * f.max; m.position.set(v[0] * tt, Math.max(0.05, 0.4 + v[1] * tt - 9 * tt * tt), v[2] * tt); m.rotation.set(tt * 8, tt * 6, 0); }
        else if (p.k === 'puff') { m.position.x = v[0] * k * 0.5; m.position.z = v[2] * k * 0.5; m.position.y += 0.01; m.scale.setScalar(0.6 + k * 1.6); m.material.opacity = 0.9 * (1 - k); }
        else if (p.k === 'zap') { m.material.opacity = 1 - k; }
      }
    }
    for (const [f, o] of fObjs) if (o.f !== frame) {
      scene.remove(o.g);
      o.g.traverse((c) => { if (c.isMesh) { c.geometry.dispose(); if (c.material.transparent) c.material.dispose(); } });
      fObjs.delete(f);
    }
  }

  // ---------- Image ----------
  // Qualité automatique : si l'appareil est lent, on réduit la résolution
  let perfT0 = 0, perfN = 0, lowQ = false;
  function adaptQuality() {
    const t = performance.now();
    if (!perfT0) perfT0 = t;
    perfN++;
    if (t - perfT0 > 4000) {
      const fps = perfN / ((t - perfT0) / 1000);
      if (fps < 28 && !lowQ) { lowQ = true; renderer.setPixelRatio(1); renderer.setSize(W, H, false); }
      perfT0 = t; perfN = 0;
    }
  }

  function render(dt, st) {
    frame++; lf++;
    if (!document.hidden) adaptQuality();
    const T = st.T;
    syncBuildings(st, T);
    syncUnits(st, T, dt);
    syncProj(st);
    syncFx(st);
    if (forbidMesh) { forbidMesh.material.opacity = st.forbidAlpha; forbidMesh.visible = st.forbidAlpha > 0.01; }
    const wx = st.wind ? st.wind.x : 1, wy = st.wind ? st.wind.y : 0.3, sp = st.wind ? 1.6 : 0.4;
    for (const c of clouds) {
      c.position.x += wx * sp * dt; c.position.z += wy * sp * dt;
      const dx = c.position.x - N / 2, dz = c.position.z - N / 2;
      if (Math.hypot(dx, dz) > 42) { c.position.x = N / 2 - dx * 0.95; c.position.z = N / 2 - dz * 0.95; }
    }
    for (const f of floaters) { f.position.y = f.userData.base + Math.sin(T * 0.6 + f.userData.ph) * 0.3; f.rotation.y += dt * 0.1; }
    renderer.render(scene, camera);
    sweepLabels();
  }

  // Bâtiment sous le doigt (rayon lancé depuis la caméra)
  function pick(list, sx, sy) {
    ndc.set(sx / W * 2 - 1, -(sy / H) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const groups = [];
    for (const b of list) { const o = bObjs.get(b); if (o && !(b.dead)) groups.push(o.group); }
    const hits = ray.intersectObjects(groups, true);
    for (const h of hits) {
      let o = h.object;
      while (o && !o.userData.b) o = o.parent;
      if (o && list.includes(o.userData.b)) return o.userData.b;
    }
    return null;
  }

  return { init, resize, resetCam, screenToTile, pan, zoomAt, render, pick, setBattle, screenAngle, project };
})();
