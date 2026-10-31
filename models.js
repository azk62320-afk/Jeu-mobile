/* Îles Célestes — modèles 3D (bâtiments, guerriers, décor), construits avec Three.js.
   Chaque modèle est assemblé à partir de formes simples, puis fusionné en un seul
   maillage coloré pour rester rapide sur téléphone. Les parties animées restent séparées. */
'use strict';
window.Models = (() => {
  const T3 = THREE;
  const PI = Math.PI;

  // ---------- Matériaux partagés ----------
  const LIT = new T3.MeshLambertMaterial({ vertexColors: true });
  const GLOW = new T3.MeshBasicMaterial({ vertexColors: true });
  const matCache = new Map();
  function mat(color, o = {}) {
    const key = color + JSON.stringify(o);
    if (!matCache.has(key)) {
      const m = o.basic ? new T3.MeshBasicMaterial({ color }) : new T3.MeshLambertMaterial({ color });
      if (o.emissive) m.emissive = new T3.Color(o.emissive);
      if (o.opacity !== undefined) { m.transparent = true; m.opacity = o.opacity; m.depthWrite = o.opacity > 0.9; }
      if (o.additive) { m.transparent = true; m.blending = T3.AdditiveBlending; m.depthWrite = false; }
      if (o.double) m.side = T3.DoubleSide;
      if (o.flat) m.flatShading = true;
      matCache.set(key, m);
    }
    return matCache.get(key);
  }

  // Texture de halo lumineux
  let glowTex = null;
  function glowTexture() {
    if (glowTex) return glowTex;
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    glowTex = new T3.CanvasTexture(c);
    return glowTex;
  }
  function halo(color, size, opacity = 0.8) {
    const s = new T3.Sprite(new T3.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity, blending: T3.AdditiveBlending, depthWrite: false }));
    s.scale.set(size, size, 1);
    return s;
  }

  // ---------- Assembleur de géométrie ----------
  const _m = new T3.Matrix4(), _q = new T3.Quaternion(), _e = new T3.Euler(), _p = new T3.Vector3(), _s = new T3.Vector3(), _c = new T3.Color();
  class Builder {
    constructor() { this.pos = []; this.nor = []; this.col = []; }
    add(geo, color, t = {}) {
      let g = geo.index ? geo.toNonIndexed() : geo;
      if (t.flat) g.computeVertexNormals();
      _e.set(t.rx || 0, t.ry || 0, t.rz || 0, t.order || 'XYZ');
      _q.setFromEuler(_e);
      _p.set(t.x || 0, t.y || 0, t.z || 0);
      const s = t.s ?? 1;
      _s.set(t.sx ?? s, t.sy ?? s, t.sz ?? s);
      _m.compose(_p, _q, _s);
      g.applyMatrix4(_m);
      const p = g.attributes.position.array, n = g.attributes.normal.array;
      _c.set(color);
      const cr = _c.r, cg = _c.g, cb = _c.b;
      for (let i = 0; i < p.length; i += 3) {
        this.pos.push(p[i], p[i + 1], p[i + 2]);
        this.nor.push(n[i], n[i + 1], n[i + 2]);
        if (t.cf) { const k = t.cf(p[i], p[i + 1], p[i + 2]); this.col.push(k.r, k.g, k.b); }
        else this.col.push(cr, cg, cb);
      }
      if (g !== geo) g.dispose();
      geo.dispose();
      return this;
    }
    box(w, h, d, c, t) { return this.add(new T3.BoxGeometry(w, h, d), c, t); }
    cyl(rt, rb, h, c, t, seg = 14) { return this.add(new T3.CylinderGeometry(rt, rb, h, seg), c, t); }
    cone(r, h, c, t, seg = 10) { return this.add(new T3.ConeGeometry(r, h, seg), c, t); }
    sph(r, c, t, ws = 14, hs = 10) { return this.add(new T3.SphereGeometry(r, ws, hs), c, t); }
    hemi(r, c, t) { return this.add(new T3.SphereGeometry(r, 14, 6, 0, PI * 2, 0, PI / 2), c, t); }
    rock(r, c, t) { return this.add(new T3.DodecahedronGeometry(r, 0), c, Object.assign({ flat: true }, t)); }
    ico(r, c, t, d = 1) { return this.add(new T3.IcosahedronGeometry(r, d), c, t); }
    oct(r, c, t) { return this.add(new T3.OctahedronGeometry(r, 0), c, t); }
    torus(r, tube, c, t, arc = PI * 2) { return this.add(new T3.TorusGeometry(r, tube, 6, 20, arc), c, t); }
    roof(w, d, h, c, t) { return this.add(roofGeo(w, d, h), c, t); }
    empty() { return this.pos.length === 0; }
    geometry(ao = true) {
      const col = this.col;
      if (ao) for (let i = 0; i < this.pos.length; i += 3) { // ombre douce au pied des objets
        const y = this.pos[i + 1];
        if (y < 0.22) { const f = 0.7 + 0.3 * Math.max(0, y) / 0.22; col[i] *= f; col[i + 1] *= f; col[i + 2] *= f; }
      }
      const g = new T3.BufferGeometry();
      g.setAttribute('position', new T3.Float32BufferAttribute(this.pos, 3));
      g.setAttribute('normal', new T3.Float32BufferAttribute(this.nor, 3));
      g.setAttribute('color', new T3.Float32BufferAttribute(col, 3));
      g.computeBoundingSphere();
      return g;
    }
    mesh(material = LIT, shadow = true) {
      const m = new T3.Mesh(this.geometry(material === LIT), material);
      m.castShadow = shadow; m.receiveShadow = true;
      return m;
    }
  }

  function roofGeo(w, d, h) { // toit à deux pans, faîtage le long de x
    const x0 = -w / 2, x1 = w / 2, z0 = -d / 2, z1 = d / 2, v = [];
    const A = [x0, 0, z0], Bp = [x1, 0, z0], C = [x1, 0, z1], D = [x0, 0, z1], E = [x0, h, 0], F = [x1, h, 0];
    const tri = (a, b, c) => v.push(...a, ...b, ...c);
    tri(D, C, F); tri(D, F, E); tri(Bp, A, E); tri(Bp, E, F); tri(C, Bp, F); tri(A, D, E); tri(A, Bp, C); tri(A, C, D);
    const g = new T3.BufferGeometry();
    g.setAttribute('position', new T3.Float32BufferAttribute(v, 3));
    g.computeVertexNormals();
    return g;
  }

  // ---------- Palette ----------
  const C = {
    stone: 0xc2b9a8, stoneD: 0x9d9485, stoneL: 0xe2dccf, wood: 0xa0682f, woodD: 0x6e4422, woodL: 0xc58a4a,
    roof: 0xd9452e, gold: 0xf5c331, iron: 0x8f98a6, crystal: 0x5fdcff, purple: 0xb556ec, purpleD: 0x7a2fb0,
    grass: 0x7cc950, dirt: 0xa88b5e, cream: 0xf0dfb8, white: 0xffffff, dark: 0x2a2026, copper: 0xdc8d3e,
  };
  const METAL = [C.iron, C.iron, 0xb7c0cc, C.gold, 0xffd34a, 0xc79bff];
  const plate = (M, s, c = C.stoneD) => M.box(s - 0.12, 0.1, s - 0.12, c, { y: 0.05 });

  // =====================================================================
  //  Bâtiments : s = partie fixe (fusionnée), d = parties animées
  // =====================================================================
  const DEF = {};

  DEF.core = {
    s(M, G, L) {
      M.box(2.8, 0.26, 2.8, C.stone, { y: 0.13 });
      M.box(2.25, 0.26, 2.25, C.stoneL, { y: 0.39 });
      if (L >= 3) M.box(2.3, 0.06, 2.3, C.gold, { y: 0.53 });
      M.box(0.8, 0.13, 0.35, C.stone, { y: 0.065, z: 1.45 });
      M.box(0.8, 0.13, 0.35, C.stone, { y: 0.065, x: 1.45, ry: PI / 2 });
      const ph = 0.85 + L * 0.13;
      for (const [x, z] of [[-0.85, -0.85], [0.85, -0.85], [-0.85, 0.85], [0.85, 0.85]]) {
        M.cyl(0.2, 0.22, 0.12, METAL[L], { x, z, y: 0.58 });
        M.cyl(0.13, 0.15, ph, 0xeee9df, { x, z, y: 0.52 + ph / 2 });
        M.cyl(0.2, 0.16, 0.12, METAL[L], { x, z, y: 0.58 + ph });
        G.sph(0.1, 0xd8b8ff, { x, z, y: 0.72 + ph });
      }
      M.cyl(0.42, 0.55, 0.32, METAL[L], { y: 0.68 });
      G.cyl(0.3, 0.3, 0.02, 0xc89bff, { y: 0.85 });
      if (L >= 5) M.torus(1.15, 0.05, C.gold, { y: 0.56, rx: PI / 2 });
    },
    d(grp, L) {
      const cm = new T3.Mesh(new T3.OctahedronGeometry(0.5, 0), mat(0xa877ff, { emissive: 0x4d1f9a, flat: true }));
      cm.scale.set(1, 1.55, 1); cm.castShadow = true;
      const h = halo(0xb58cff, 2.6, 0.75);
      grp.add(cm, h);
      const orb = [];
      for (let i = 0; i < L - 1; i++) {
        const o = new T3.Mesh(new T3.OctahedronGeometry(0.13, 0), mat(0xff9bf0, { emissive: 0x7a2266, flat: true }));
        o.scale.y = 1.5; grp.add(o); orb.push(o);
      }
      const base = 1.95 + L * 0.13;
      return (t) => {
        const y = base + Math.sin(t * 2) * 0.1;
        cm.position.y = y; cm.rotation.y = t * 0.8; h.position.y = y;
        h.material.opacity = 0.6 + Math.sin(t * 3) * 0.15;
        orb.forEach((o, i) => {
          const a = t * 1.2 + i * PI * 2 / orb.length;
          o.position.set(Math.cos(a) * 1.0, y - 0.2 + Math.sin(t * 3 + i) * 0.08, Math.sin(a) * 1.0);
          o.rotation.y = -t * 2;
        });
      };
    },
  };

  DEF.mine = {
    s(M, G, L) {
      plate(M, 2, C.dirt);
      M.rock(0.78, 0x938a7c, { x: -0.15, y: 0.3, z: -0.2, sx: 1.15, sy: 0.8, sz: 1.0 });
      M.rock(0.42, 0x857c70, { x: 0.5, y: 0.2, z: -0.5 });
      M.rock(0.3, 0x9a9184, { x: -0.62, y: 0.15, z: 0.45 });
      M.box(0.46, 0.5, 0.12, 0x21171a, { x: -0.12, y: 0.32, z: 0.6 });
      M.box(0.09, 0.6, 0.1, C.wood, { x: -0.39, y: 0.36, z: 0.64 });
      M.box(0.09, 0.6, 0.1, C.wood, { x: 0.15, y: 0.36, z: 0.64 });
      M.box(0.68, 0.1, 0.12, C.woodL, { x: -0.12, y: 0.68, z: 0.64 });
      const spots = [[-0.35, 0.75, -0.35, 0.3, 0.2], [0.1, 0.62, -0.55, -0.3, 0.3], [-0.6, 0.5, -0.05, 0.4, -0.2], [0.3, 0.55, -0.15, -0.4, -0.2],
        [-0.05, 0.85, -0.15, 0, 0.1], [0.55, 0.45, -0.55, -0.5, 0.3], [-0.7, 0.35, -0.6, 0.4, 0.4], [0.15, 0.35, 0.3, -0.3, -0.4]];
      for (let i = 0; i < Math.min(spots.length, 2 + L); i++) {
        const [x, y, z, rz, rx] = spots[i];
        const h = 0.4 + (i % 3) * 0.1 + L * 0.04;
        M.cone(0.1 + (i % 2) * 0.04, h, C.crystal, { x, y: y + h * 0.3, z, rz, rx }, 5);
      }
      M.box(0.06, 0.04, 1.0, C.woodD, { x: 0.45, y: 0.12, z: 0.35 });
      M.box(0.06, 0.04, 1.0, C.woodD, { x: 0.75, y: 0.12, z: 0.35 });
      M.box(0.42, 0.24, 0.34, C.woodD, { x: 0.6, y: 0.3, z: 0.42 });
      M.box(0.44, 0.04, 0.36, METAL[Math.max(2, L)], { x: 0.6, y: 0.43, z: 0.42 });
      for (const [x, z] of [[0.42, 0.3], [0.78, 0.3], [0.42, 0.55], [0.78, 0.55]]) M.cyl(0.06, 0.06, 0.04, 0x333333, { x, y: 0.18, z, rz: PI / 2 }, 8);
      M.cone(0.07, 0.22, C.crystal, { x: 0.55, y: 0.52, z: 0.42 }, 5);
      M.cone(0.06, 0.18, C.crystal, { x: 0.68, y: 0.5, z: 0.38, rz: -0.4 }, 5);
    },
    d(grp) {
      const h = halo(0x7fe3ff, 1.4, 0.35); h.position.set(-0.1, 0.9, -0.2); grp.add(h);
      return (t) => { h.material.opacity = 0.3 + Math.sin(t * 2) * 0.1; };
    },
  };

  DEF.puits = {
    s(M, G, L) {
      plate(M, 2);
      M.cyl(0.62, 0.66, 0.46, C.stone, { y: 0.33 }, 18);
      M.cyl(0.5, 0.5, 0.02, 0x3a2140, { y: 0.565 }, 18);
      for (let k = 1; k < Math.min(L, 4); k++) M.torus(0.64, 0.035, METAL[L], { y: 0.12 + k * 0.12, rx: PI / 2 });
      M.box(0.1, 1.0, 0.1, C.wood, { x: -0.6, y: 0.6 });
      M.box(0.1, 1.0, 0.1, C.wood, { x: 0.6, y: 0.6 });
      M.cyl(0.04, 0.04, 1.3, C.woodD, { y: 1.02, rz: PI / 2 }, 8);
      M.roof(1.55, 1.0, 0.42, C.roof, { y: 1.1 });
      M.box(1.6, 0.04, 1.06, C.woodD, { y: 1.1 });
    },
    d(grp, L) {
      const liquid = new T3.Mesh(new T3.CylinderGeometry(0.5, 0.5, 0.03, 20), mat(0xc77dff, { emissive: 0x6a1fa0 }));
      liquid.position.y = 0.56; grp.add(liquid);
      const swirl = new T3.Mesh(new T3.TorusGeometry(0.25, 0.03, 4, 16, PI * 1.3), mat(0xf0d8ff, { basic: true }));
      swirl.rotation.x = -PI / 2; swirl.position.y = 0.58; grp.add(swirl);
      const rope = new T3.Mesh(new T3.CylinderGeometry(0.012, 0.012, 1, 4), mat(0xe8d8b0));
      const bucket = new T3.Mesh(new T3.CylinderGeometry(0.11, 0.08, 0.16, 10), mat(C.woodD));
      grp.add(rope, bucket);
      const puffs = [];
      for (let i = 0; i < 3; i++) { const p = new T3.Mesh(new T3.SphereGeometry(0.16, 10, 8), new T3.MeshLambertMaterial({ color: 0xf2e6ff, transparent: true, opacity: 0.5, depthWrite: false })); grp.add(p); puffs.push(p); }
      return (t) => {
        swirl.rotation.z = t * 2;
        const by = 0.75 + Math.sin(t * 1.4) * 0.15;
        bucket.position.y = by; rope.scale.y = 1.02 - by; rope.position.y = (1.02 + by) / 2 + 0.08;
        puffs.forEach((p, i) => {
          const ph = (t * 0.3 + i / 3) % 1;
          p.position.set(Math.sin(t + i * 2) * 0.15, 0.6 + ph * 1.8, Math.cos(t + i) * 0.1);
          p.scale.setScalar(0.6 + ph * 1.4); p.material.opacity = (1 - ph) * 0.55;
        });
      };
    },
  };

  DEF.coffre = {
    s(M, G, L) {
      plate(M, 2);
      const wood = [0, 0xb0723a, 0xa0682f, 0x8a5a2a, 0x6e4422, 0x5a361b][L], metal = METAL[Math.max(2, L)];
      M.box(1.4, 0.6, 1.0, wood, { y: 0.4 });
      for (const y of [0.25, 0.45]) M.box(1.41, 0.02, 1.01, 0x000000, { y, cf: () => _c.set(wood).multiplyScalar(0.7) });
      M.cyl(0.5, 0.5, 1.4, wood, { y: 0.7, rz: PI / 2, sz: 1.0, sx: 0.62 }, 18);
      for (const x of [-0.45, 0.45]) {
        M.box(0.13, 0.62, 1.03, metal, { x, y: 0.4 });
        M.cyl(0.52, 0.52, 0.13, metal, { x, y: 0.7, rz: PI / 2, sx: 0.64 }, 18);
      }
      M.box(0.18, 0.22, 0.06, C.gold, { y: 0.62, z: 0.53 });
      M.box(0.06, 0.08, 0.02, 0x3a2a00, { y: 0.6, z: 0.565 });
      if (L >= 4) M.box(1.44, 0.05, 1.04, C.gold, { y: 0.12 });
    },
    d(grp) {
      const pile = [];
      const spots = [[-0.82, 0.62], [0.82, -0.62], [-0.82, -0.3], [0.85, 0.65], [-0.5, 0.82], [0.4, 0.82]];
      for (const [x, z] of spots) {
        const g = new T3.Group();
        for (let i = 0; i < 3; i++) {
          const c = new T3.Mesh(new T3.ConeGeometry(0.07, 0.25 + i * 0.05, 5), mat(C.crystal, { emissive: 0x0a4a66 }));
          c.position.set((i - 1) * 0.08, 0.2, (i % 2) * 0.06); c.rotation.z = (i - 1) * 0.35; g.add(c);
        }
        g.position.set(x, 0.05, z); grp.add(g); pile.push(g);
      }
      return (t, o) => { const n = Math.round(1 + (o.fill ?? 0.5) * 5); pile.forEach((p, i) => (p.visible = i < n)); };
    },
  };

  DEF.reservoir = {
    s(M, G, L) {
      plate(M, 2);
      const metal = METAL[Math.max(2, L)], h = 1.0 + L * 0.1;
      M.cyl(0.72, 0.78, 0.26, C.stone, { y: 0.23 }, 18);
      for (const [x, z] of [[0.58, 0], [-0.58, 0], [0, 0.58], [0, -0.58]]) M.box(0.08, h, 0.08, metal, { x, z, y: 0.36 + h / 2 });
      M.torus(0.6, 0.04, metal, { y: 0.36 + h * 0.35, rx: PI / 2 });
      M.torus(0.6, 0.04, metal, { y: 0.36 + h * 0.7, rx: PI / 2 });
      M.cyl(0.66, 0.66, 0.14, metal, { y: 0.43 + h }, 18);
      M.hemi(0.5, metal, { y: 0.5 + h, sy: 0.6 });
      M.sph(0.08, C.gold, { y: 0.84 + h });
    },
    d(grp, L) {
      const h = 1.0 + L * 0.1;
      const liquid = new T3.Mesh(new T3.CylinderGeometry(0.5, 0.5, 1, 18), mat(0xc070ff, { emissive: 0x5a1590 }));
      const glass = new T3.Mesh(new T3.CylinderGeometry(0.56, 0.56, h, 18, 1, true), mat(0xdff6ff, { opacity: 0.32, double: true }));
      glass.position.y = 0.36 + h / 2;
      grp.add(liquid, glass);
      const bub = [];
      for (let i = 0; i < 4; i++) { const b = new T3.Mesh(new T3.SphereGeometry(0.04, 6, 5), mat(0xffffff, { basic: true })); grp.add(b); bub.push(b); }
      return (t, o) => {
        const f = Math.max(0.08, Math.min(1, o.fill ?? 0.6));
        liquid.scale.y = h * f; liquid.position.y = 0.36 + h * f / 2;
        bub.forEach((b, i) => { const ph = (t * 0.4 + i * 0.27) % 1; b.position.set(Math.sin(i * 3) * 0.28, 0.4 + ph * h * f * 0.95, Math.cos(i * 2) * 0.25); });
      };
    },
  };

  DEF.perchoir = {
    s(M, G, L) {
      plate(M, 3);
      const roof = [0, C.roof, 0xc93d2a, 0xa8322a, 0x8e44ad, 0x6c2f8a][L];
      M.box(1.95, 0.16, 1.65, C.stoneD, { x: -0.25, y: 0.18, z: 0.05 });
      M.box(1.8, 0.8, 1.5, C.cream, { x: -0.25, y: 0.66, z: 0.05 });
      for (const x of [-1.13, -0.55, 0.05, 0.63]) M.box(0.08, 0.8, 0.06, C.woodD, { x, y: 0.66, z: 0.81 });
      for (const z of [-0.68, 0.05, 0.78]) M.box(0.06, 0.8, 0.08, C.woodD, { x: 0.66, y: 0.66, z });
      M.box(1.82, 0.07, 1.52, C.woodD, { x: -0.25, y: 0.66, z: 0.05 });
      M.box(0.36, 0.52, 0.05, 0x5a361b, { x: -0.3, y: 0.52, z: 0.82 });
      M.sph(0.03, C.gold, { x: -0.18, y: 0.52, z: 0.85 });
      G.box(0.05, 0.22, 0.24, 0xffe39a, { x: 0.67, y: 0.85, z: -0.35 });
      G.box(0.05, 0.22, 0.24, 0xffe39a, { x: 0.67, y: 0.85, z: 0.45 });
      M.roof(2.15, 1.85, 0.75, roof, { x: -0.25, y: 1.06, z: 0.05 });
      M.box(0.22, 0.45, 0.22, C.stoneD, { x: -0.8, y: 1.55, z: -0.35 });
      const ph = 2.3 + L * 0.12;
      M.cyl(0.07, 0.09, ph, C.wood, { x: 1.05, y: ph / 2, z: -0.95 }, 8);
      M.cyl(0.34, 0.3, 0.08, C.woodL, { x: 1.05, y: ph - 0.1, z: -0.95 });
      M.torus(0.26, 0.08, 0x8a5a2a, { x: 1.05, y: ph, z: -0.95, rx: PI / 2 });
      M.cyl(0.04, 0.05, 0.6, C.wood, { x: 1.0, y: 0.3, z: 0.95 }, 8);
      M.box(0.5, 0.05, 0.05, C.wood, { x: 1.0, y: 0.45, z: 0.95 });
      M.sph(0.13, 0xe8c872, { x: 1.0, y: 0.68, z: 0.95 });
      M.cyl(0.03, 0.03, 0.7, C.woodD, { x: 1.15, y: 0.35, z: 0.45, rz: 0.3 }, 6);
      M.cyl(0.03, 0.03, 0.7, C.woodD, { x: 1.2, y: 0.35, z: 0.3, rz: 0.4 }, 6);
    },
    d(grp, L) {
      const ph = 2.3 + L * 0.12;
      const pole = new T3.Mesh(new T3.CylinderGeometry(0.025, 0.025, 0.7, 6), mat(C.woodD));
      pole.position.set(1.05, ph + 0.35, -0.95);
      const flag = new T3.Mesh(new T3.PlaneGeometry(0.55, 0.32, 6, 1), mat([0, 0xffcf33, 0xffcf33, 0x4cc9f0, 0xff6b9b, 0xb48cff][L], { double: true }));
      flag.geometry.translate(0.275, 0, 0);
      flag.position.set(1.05, ph + 0.55, -0.95);
      grp.add(pole, flag);
      const base = flag.geometry.attributes.position.array.slice();
      return (t) => {
        const a = flag.geometry.attributes.position;
        for (let i = 0; i < a.count; i++) { const x = base[i * 3]; a.array[i * 3 + 2] = Math.sin(t * 6 - x * 8) * 0.07 * x * 2; }
        a.needsUpdate = true;
        flag.rotation.y = 0.6 + Math.sin(t * 0.7) * 0.2;
      };
    },
  };

  DEF.nid = {
    s(M, G, L) {
      M.cyl(1.38, 1.4, 0.04, C.dirt, { y: 0.02 }, 24);
      for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2; M.rock(0.09, 0x8d8f96, { x: Math.cos(a) * 0.32, y: 0.07, z: Math.sin(a) * 0.32 }); }
      M.cyl(0.05, 0.05, 0.5, C.woodD, { y: 0.08, rz: PI / 2, ry: 0.5 }, 6);
      M.cyl(0.05, 0.05, 0.5, C.woodD, { y: 0.1, rz: PI / 2, ry: -0.6 }, 6);
      const tents = [[-0.75, -0.75, 0xe9d8a6, 0.6], [0.8, -0.75, 0x94d2bd, -0.4], [-0.85, 0.7, 0xf4a261, 0.3], [0.78, 0.72, 0xcdb4db, -0.7]];
      const n = 2 + (L >= 2 ? 1 : 0) + (L >= 4 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const [x, z, c, ry] = tents[i];
        M.roof(0.85, 0.8, 0.7 + L * 0.03, c, { x, z, ry, y: 0.02 });
        M.roof(0.2, 0.3, 0.35, 0x3a2a1f, { x: x + Math.cos(ry) * 0.42, z: z - Math.sin(ry) * 0.42, ry: ry + PI / 2, y: 0.02, sx: 0.4 });
        M.cyl(0.02, 0.02, 0.4, C.woodD, { x, z, y: 0.9 + L * 0.03 }, 5);
        M.box(0.18, 0.11, 0.01, 0xe63946, { x: x + 0.09, z, y: 1.03 + L * 0.03 });
      }
      for (const [x, z, ry] of [[0.0, 0.85, 0], [0.85, 0.0, PI / 2]]) M.cyl(0.08, 0.08, 0.6, C.wood, { x, z, y: 0.1, rz: PI / 2, ry }, 8);
    },
    d(grp, L) {
      const fl = [0xff5a1a, 0xffaa2a, 0xfff0a0].map((c, i) => {
        const m = new T3.Mesh(new T3.ConeGeometry(0.17 - i * 0.04, 0.5 - i * 0.12, 7), mat(c, { basic: true }));
        m.position.y = 0.25 - i * 0.04; grp.add(m); return m;
      });
      const h = halo(0xffa040, 1.6, 0.7); h.position.y = 0.35; grp.add(h);
      return (t) => {
        fl.forEach((m, i) => { const k = 1 + Math.sin(t * 14 + i * 2) * 0.15; m.scale.set(1, k, 1); m.rotation.y = t * (i + 1); m.position.y = 0.06 + (0.5 - i * 0.12) * k / 2; });
        h.material.opacity = 0.55 + Math.sin(t * 11) * 0.12;
      };
    },
  };

  DEF.baliste = {
    s(M, G, L) {
      plate(M, 2);
      M.cyl(0.72, 0.8, 0.55, C.stone, { y: 0.37 }, 18);
      M.torus(0.73, 0.05, C.stoneD, { y: 0.64, rx: PI / 2 });
      for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2; M.box(0.16, 0.14, 0.12, C.stoneL, { x: Math.cos(a) * 0.68, y: 0.71, z: Math.sin(a) * 0.68, ry: -a }); }
      if (L >= 3) M.torus(0.81, 0.04, C.gold, { y: 0.15, rx: PI / 2 });
      M.cyl(0.5, 0.5, 0.1, C.woodL, { y: 0.69 });
    },
    d(grp, L) {
      const metal = METAL[Math.max(2, L)];
      const head = new T3.Group(); head.position.y = 0.74; grp.add(head);
      const B = new Builder();
      B.box(0.25, 0.25, 0.25, C.woodD, { y: 0.12 });
      B.box(1.25, 0.12, 0.17, C.wood, { x: 0.05, y: 0.3 });
      B.torus(0.55, 0.045, metal, { y: 0.32, rx: -PI / 2, rz: -PI * 0.375 }, PI * 0.75);
      B.box(0.02, 0.02, 1.02, 0xeeeeee, { x: 0.21, y: 0.32 });
      B.cyl(0.03, 0.03, 0.75, 0x5a3a1a, { x: 0.45, y: 0.38, rz: PI / 2 }, 6);
      B.cone(0.06, 0.14, 0xd8dee8, { x: 0.86, y: 0.38, rz: -PI / 2 }, 6);
      const hm = B.mesh(); head.add(hm);
      let kick = 0;
      return (t, o) => {
        head.rotation.y = -(o.aim ?? 0);
        if (o.fired && o.fired !== head.userData.f) { head.userData.f = o.fired; kick = 1; }
        kick = Math.max(0, kick - 0.08);
        hm.position.x = -kick * 0.12;
      };
    },
  };

  DEF.eclair = {
    s(M, G, L) {
      plate(M, 2);
      const h = 1.55 + L * 0.12;
      M.cyl(0.44, 0.66, h, 0xb1a9c4, { y: 0.1 + h / 2 }, 16);
      for (const k of [0.25, 0.55, 0.85]) { const r = 0.66 - 0.22 * k + 0.02; M.torus(r, 0.04, C.copper, { y: 0.1 + h * k, rx: PI / 2 }); }
      for (const a of [0.8, 2.3]) M.box(0.06, 0.22, 0.06, 0x2a2440, { x: Math.cos(a) * 0.55, z: Math.sin(a) * 0.55, y: 0.1 + h * 0.4 });
      M.cyl(0.55, 0.48, 0.14, 0x5b5f6b, { y: 0.17 + h });
      for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2; M.box(0.1, 0.12, 0.1, 0x6b6f7c, { x: Math.cos(a) * 0.48, z: Math.sin(a) * 0.48, y: 0.3 + h }); }
      for (let i = 0; i < 3; i++) { const a = i / 3 * PI * 2; M.cyl(0.025, 0.025, 0.6, 0x8a7a5a, { x: Math.cos(a) * 0.15, z: Math.sin(a) * 0.15, y: 0.55 + h, rx: Math.sin(a) * 0.25, rz: -Math.cos(a) * 0.25 }, 5); }
      for (let k = 0; k < 3; k++) M.torus(0.18 - k * 0.03, 0.025, C.copper, { y: 0.42 + h + k * 0.12, rx: PI / 2 });
    },
    d(grp, L) {
      const h = 1.55 + L * 0.12;
      const orb = new T3.Mesh(new T3.SphereGeometry(0.17, 14, 10), mat(0xfff8c0, { basic: true }));
      orb.position.y = 0.95 + h;
      const hl = halo(0xfff07a, 1.6, 0.9); hl.position.y = orb.position.y;
      grp.add(orb, hl);
      return (t, o) => {
        const p = 1 + Math.sin(t * 5 + (o.id || 0)) * 0.15;
        orb.scale.setScalar(p); hl.scale.setScalar(1.4 * p + (o.fired && t - o.fired < 0.2 ? 1.2 : 0));
      };
    },
  };

  DEF.vent = {
    s(M, G, L) {
      plate(M, 2);
      M.cyl(0.7, 0.8, 0.45, 0xa9c2cf, { y: 0.32 }, 18);
      M.torus(0.72, 0.05, 0x7d98a8, { y: 0.55, rx: PI / 2 });
      if (L >= 3) M.torus(0.81, 0.04, C.gold, { y: 0.12, rx: PI / 2 });
      M.cyl(0.38, 0.42, 0.22, 0x5c6b78, { y: 0.66 });
    },
    d(grp, L) {
      const brass = [0, 0xd4a23a, 0xd4a23a, 0xe0b04a, 0xf0c45a, 0x9fd8ff][L];
      const head = new T3.Group(); head.position.y = 0.95; grp.add(head);
      const B = new Builder();
      B.box(0.3, 0.3, 0.3, 0x4a5662, { y: -0.12 });
      B.cyl(0.46 + L * 0.02, 0.15, 1.05, brass, { x: 0.2, rz: -PI / 2 }, 16);
      B.cyl(0.4 + L * 0.02, 0.4 + L * 0.02, 0.02, 0x20202a, { x: 0.73, rz: -PI / 2 }, 16);
      B.torus(0.47 + L * 0.02, 0.04, 0xb07a20, { x: 0.71, ry: PI / 2 });
      B.torus(0.3, 0.035, 0xb07a20, { x: 0.25, ry: PI / 2 });
      head.add(B.mesh());
      const rotor = new T3.Group(); rotor.position.set(-0.45, 0, 0); head.add(rotor);
      for (let i = 0; i < 4; i++) { const v = new T3.Mesh(new T3.BoxGeometry(0.03, 0.42, 0.1), mat(0xf2f2f2)); v.position.y = 0.21; const p = new T3.Group(); p.rotation.x = i * PI / 2; p.add(v); rotor.add(p); }
      const gust = new T3.Mesh(new T3.TorusGeometry(0.35, 0.03, 4, 16), mat(0xffffff, { opacity: 0.6 }));
      gust.rotation.y = PI / 2; head.add(gust);
      return (t, o) => {
        head.rotation.y = -(o.aim ?? 0);
        rotor.rotation.x = t * 8;
        const ph = (t * 1.5) % 1;
        gust.position.x = 0.8 + ph * 0.8; gust.scale.setScalar(0.6 + ph); gust.material.opacity = 0.6 * (1 - ph);
      };
    },
  };

  const sh3 = (c) => new T3.Color(c).multiplyScalar(1.12).getHex();
  const WALL = [0, 0xa8814f, 0xbdb7ab, 0x8d8b93, 0xd9bc84, 0x9d72e6];
  DEF.mur = {
    key: (L, o) => `mur${L}${o.nU ? 1 : 0}${o.nV ? 1 : 0}`,
    s(M, G, L, o) {
      const col = WALL[L], h = 0.42 + L * 0.05;
      if (L === 1) {
        const stakes = [[0, 0]];
        if (o.nU) stakes.push([0.33, 0], [0.66, 0]);
        if (o.nV) stakes.push([0, 0.33], [0, 0.66]);
        for (const [x, z] of stakes) { M.cyl(0.13, 0.14, h, col, { x, z, y: h / 2 }, 7); M.cone(0.13, 0.18, col, { x, z, y: h + 0.09 }, 7); }
        if (o.nU) M.box(0.9, 0.06, 0.06, C.woodD, { x: 0.45, y: h * 0.6, z: 0.12 });
        if (o.nV) M.box(0.06, 0.06, 0.9, C.woodD, { x: 0.12, y: h * 0.6, z: 0.45 });
        return;
      }
      const top = L === 5 ? 0xe2d0ff : L === 4 ? 0xe0b13c : sh3(col);
      if (o.nU) { M.box(1, h - 0.04, 0.42, col, { x: 0.5, y: (h - 0.04) / 2 }); M.box(1, 0.06, 0.46, top, { x: 0.5, y: h - 0.04 }); }
      if (o.nV) { M.box(0.42, h - 0.04, 1, col, { z: 0.5, y: (h - 0.04) / 2 }); M.box(0.46, 0.06, 1, top, { z: 0.5, y: h - 0.04 }); }
      M.box(0.5, h + 0.06, 0.5, col, { y: (h + 0.06) / 2 });
      M.box(0.56, 0.08, 0.56, top, { y: h + 0.08 });
      if (L === 3) { M.sph(0.12, 0x6a9a4a, { x: 0.15, y: h + 0.1, z: 0.1, sy: 0.4 }); }
      if (L === 5) G.sph(0.07, 0xf2e6ff, { y: h + 0.16 });
    },
  };

  // Échafaudage (construction en cours)
  function scaffold(s) {
    const M = new Builder(), r = s / 2 - 0.2;
    plate(M, s, C.dirt);
    for (const [x, z] of [[-r, -r], [r, -r], [-r, r], [r, r]]) M.cyl(0.04, 0.04, 1.1, C.wood, { x, z, y: 0.55 }, 6);
    for (const y of [0.45, 0.95]) { M.box(s - 0.3, 0.05, 0.14, C.woodL, { y, z: r }); M.box(0.14, 0.05, s - 0.3, C.woodL, { y, x: r }); }
    M.box(0.45, 0.3, 0.4, 0xc08a4a, { x: -0.2, y: 0.25 });
    M.box(0.3, 0.2, 0.3, 0xa8743f, { x: 0.25, y: 0.2, z: -0.1, ry: 0.5 });
    M.cyl(0.12, 0.12, 0.5, C.stoneD, { x: 0.1, y: 0.15, z: 0.3, rz: PI / 2 }, 10);
    const g = new T3.Group(); g.add(M.mesh());
    return g;
  }

  // Décombres
  function rubble(s) {
    const M = new Builder();
    M.cyl(s * 0.45, s * 0.48, 0.04, 0x5e5248, { y: 0.02 }, 16);
    for (let i = 0; i < 6 + s * 3; i++) {
      const a = i * 2.4, r = (i % 4) / 4 * s * 0.35;
      M.rock(0.1 + (i % 3) * 0.06, i % 2 ? 0x8a7e72 : 0x6a5f55, { x: Math.cos(a) * r, y: 0.08, z: Math.sin(a) * r, ry: i });
    }
    M.box(0.6, 0.06, 0.08, C.woodD, { y: 0.12, ry: 0.7 });
    const g = new T3.Group(); g.add(M.mesh());
    return g;
  }

  // Décor
  function deco(kind, seed) {
    const M = new Builder();
    if (kind === 0) {
      M.cyl(0.07, 0.1, 0.4, 0x7a5230, { y: 0.2 }, 7);
      M.ico(0.32, 0x4f9d3a, { y: 0.62, x: -0.12 });
      M.ico(0.3, 0x4a9436, { y: 0.6, x: 0.16, z: 0.08 });
      M.ico(0.34, 0x5fb046, { y: 0.82, z: -0.05 });
      if (seed > 0.6) for (const [x, y, z] of [[0.2, 0.75, 0.22], [-0.25, 0.7, 0.15], [0.05, 0.95, 0.25]]) M.sph(0.05, 0xff4d4d, { x, y, z }, 6, 5);
    } else if (kind === 1) {
      M.cyl(0.06, 0.08, 0.3, 0x6b4a2e, { y: 0.15 }, 6);
      M.cone(0.42, 0.6, 0x2f7d4a, { y: 0.5 }, 8);
      M.cone(0.33, 0.55, 0x358a52, { y: 0.8 }, 8);
      M.cone(0.23, 0.45, 0x3d9a5c, { y: 1.08 }, 8);
    } else if (kind === 2) {
      M.rock(0.24, 0x9c9a96, { y: 0.12, sy: 0.7 });
      M.rock(0.14, 0x8a8884, { x: 0.25, y: 0.07, z: 0.1, sy: 0.7 });
    } else {
      M.ico(0.2, 0x5aa83e, { y: 0.14, x: -0.08 }, 1);
      M.ico(0.17, 0x4f9d3a, { y: 0.13, x: 0.13, z: 0.06 }, 1);
      M.sph(0.04, 0xffe066, { y: 0.32, x: 0.02 }, 6, 5);
    }
    const g = new T3.Group(); g.add(M.mesh());
    g.rotation.y = seed * 6;
    return g;
  }

  // Cache des parties fixes
  const geoCache = new Map();
  function building(type, L, o = {}) {
    const def = DEF[type];
    const key = def.key ? def.key(L, o) : type + L;
    let cached = geoCache.get(key);
    if (!cached) {
      const M = new Builder(), G = new Builder();
      def.s(M, G, L, o);
      cached = { lit: M.empty() ? null : M.geometry(true), glow: G.empty() ? null : G.geometry(false) };
      geoCache.set(key, cached);
    }
    const grp = new T3.Group();
    if (cached.lit) { const m = new T3.Mesh(cached.lit, LIT); m.castShadow = true; m.receiveShadow = true; grp.add(m); }
    if (cached.glow) grp.add(new T3.Mesh(cached.glow, GLOW));
    const anim = def.d ? def.d(grp, L) : null;
    grp.traverse((c) => { if (c.isMesh && c.material !== GLOW && !c.material.transparent) { c.castShadow = true; } });
    return { group: grp, anim, key };
  }

  // =====================================================================
  //  Guerriers : chaque membre est un groupe pivotant
  // =====================================================================
  function limb(build, pivot) {
    const M = new Builder();
    build(M);
    const g = new T3.Group();
    g.position.set(...pivot);
    const m = M.mesh(); g.add(m);
    return g;
  }
  const SKIN = 0xf6c8a0;

  const UNITS = {};
  UNITS.plumeur = () => {
    const root = new T3.Group();
    const legL = limb((M) => { M.cyl(0.025, 0.025, 0.16, 0xf08a10, { y: -0.08 }, 6); M.box(0.08, 0.03, 0.1, 0xf08a10, { y: -0.16, z: 0.03 }); }, [-0.08, 0.17, 0]);
    const legR = limb((M) => { M.cyl(0.025, 0.025, 0.16, 0xf08a10, { y: -0.08 }, 6); M.box(0.08, 0.03, 0.1, 0xf08a10, { y: -0.16, z: 0.03 }); }, [0.08, 0.17, 0]);
    const body = limb((M) => {
      M.sph(0.21, 0xffc53a, { y: 0.17, sz: 0.95 });
      M.sph(0.15, 0xfff0c0, { y: 0.13, z: 0.09, sx: 1.05, sz: 0.7 });
      M.cone(0.08, 0.22, 0xd9821f, { y: 0.15, z: -0.22, rx: -PI / 2 - 0.4 }, 6);
      M.cone(0.06, 0.2, 0xe63946, { y: 0.2, z: -0.2, rx: -PI / 2 - 0.9, x: 0.05 }, 6);
      M.sph(0.15, 0xffcf4d, { y: 0.4 });
      M.cone(0.06, 0.16, 0xff8c1a, { y: 0.38, z: 0.19, rx: PI / 2 }, 8);
      for (const x of [-0.065, 0.065]) { M.sph(0.045, 0xffffff, { x, y: 0.44, z: 0.12 }, 8, 6); M.sph(0.022, 0x111111, { x: x * 1.05, y: 0.44, z: 0.16 }, 6, 5); M.box(0.07, 0.015, 0.02, 0x4a2500, { x, y: 0.5, z: 0.15, rz: x > 0 ? 0.4 : -0.4 }); }
      M.hemi(0.165, 0xaab4c4, { y: 0.43 });
      M.box(0.34, 0.03, 0.04, 0x8a94a4, { y: 0.44, z: 0.1 });
      for (let i = 0; i < 3; i++) M.cone(0.035, 0.18, 0xe63946, { y: 0.62 + i * 0.01, z: -0.05 - i * 0.06, rx: -0.4 - i * 0.3 }, 5);
    }, [0, 0.16, 0]);
    const armL = limb((M) => { M.sph(0.11, 0xe39b2a, { y: -0.08, sx: 0.4, sz: 0.8 }); }, [-0.2, 0.36, 0]);
    const armR = limb((M) => {
      M.sph(0.11, 0xe39b2a, { y: -0.08, sx: 0.4, sz: 0.8 });
      M.box(0.04, 0.1, 0.04, 0x6e4422, { y: -0.17, z: 0.05 });
      M.box(0.16, 0.035, 0.04, C.gold, { y: -0.12, z: 0.05 });
      M.box(0.035, 0.4, 0.02, 0xe8eef5, { y: 0.08, z: 0.05 });
      M.cone(0.025, 0.06, 0xe8eef5, { y: 0.31, z: 0.05 }, 4);
    }, [0.2, 0.36, 0]);
    armR.children[0].rotation.x = 0;
    body.add(armL, armR); armL.position.y -= 0.16; armR.position.y -= 0.16;
    root.add(legL, legR, body);
    return {
      root,
      anim(t, mv, atk) {
        const w = mv ? Math.sin(t * 14) : 0;
        legL.rotation.x = w * 0.7; legR.rotation.x = -w * 0.7;
        body.position.y = 0.16 + (mv ? Math.abs(w) * 0.03 : Math.sin(t * 2) * 0.008);
        armL.rotation.z = -0.3 - (mv ? Math.abs(w) * 0.6 : 0);
        armR.rotation.x = atk > 0 ? -2.4 + (1 - atk) * 3.2 : -0.6 + w * 0.3;
      },
    };
  };

  UNITS.archere = () => {
    const root = new T3.Group();
    const leg = (x) => limb((M) => { M.box(0.08, 0.17, 0.09, 0x6b4a2e, { y: -0.09 }); M.box(0.09, 0.06, 0.12, 0x3a2a1f, { y: -0.18, z: 0.02 }); }, [x, 0.21, 0]);
    const legL = leg(-0.055), legR = leg(0.055);
    const body = limb((M) => {
      M.cyl(0.11, 0.15, 0.25, 0x2aa198, { y: 0.12 }, 10);
      M.torus(0.13, 0.025, 0x6b4a2e, { y: 0.04, rx: PI / 2 });
      M.box(0.26, 0.3, 0.03, 0x1b6e5a, { y: 0.12, z: -0.13, rx: 0.15 });
      M.sph(0.16, SKIN, { y: 0.42 });
      M.sph(0.17, 0x8b4a1d, { y: 0.47, z: -0.03, sy: 0.85 });
      M.sph(0.08, 0x8b4a1d, { y: 0.4, z: -0.2 });
      M.sph(0.06, 0x8b4a1d, { y: 0.3, z: -0.24 });
      M.torus(0.15, 0.02, 0xe63946, { y: 0.48, rx: PI / 2 + 0.2 });
      for (const x of [-0.055, 0.055]) M.sph(0.026, 0x222222, { x, y: 0.42, z: 0.145 }, 6, 5);
      M.sph(0.02, 0xe08a70, { y: 0.38, z: 0.155 }, 6, 5);
      M.cyl(0.05, 0.05, 0.28, 0x8a5a33, { x: 0.08, y: 0.22, z: -0.14, rx: -0.3, rz: -0.2 }, 6);
    }, [0, 0.2, 0]);
    const armL = limb((M) => {
      M.cyl(0.035, 0.03, 0.2, 0x2aa198, { y: -0.08 }, 6); M.sph(0.035, SKIN, { y: -0.19 }, 6, 5);
      M.torus(0.2, 0.018, 0x7a4a1d, { y: -0.19, z: 0.02, ry: PI / 2, rz: -PI * 0.45 }, PI * 0.9);
      M.cyl(0.005, 0.005, 0.38, 0xeeeeee, { y: -0.19, z: -0.01 }, 3);
    }, [-0.15, 0.32, 0]);
    const armR = limb((M) => { M.cyl(0.035, 0.03, 0.2, 0x2aa198, { y: -0.08 }, 6); M.sph(0.035, SKIN, { y: -0.19 }, 6, 5); }, [0.15, 0.32, 0]);
    const arrow = new T3.Mesh(new T3.CylinderGeometry(0.01, 0.01, 0.4, 4), mat(0x7a4a1d));
    arrow.rotation.x = PI / 2; arrow.position.set(0, -0.19, 0.1); armR.add(arrow);
    body.add(armL, armR); armL.position.y -= 0.2; armR.position.y -= 0.2;
    root.add(legL, legR, body);
    return {
      root,
      anim(t, mv, atk) {
        const w = mv ? Math.sin(t * 12) : 0;
        legL.rotation.x = w * 0.7; legR.rotation.x = -w * 0.7;
        body.position.y = 0.2 + (mv ? Math.abs(w) * 0.02 : 0);
        const aim = atk > 0 || !mv;
        armL.rotation.x = aim ? -1.5 : w * 0.5;
        armR.rotation.x = aim ? -1.5 : -w * 0.5;
        armR.rotation.y = atk > 0 ? -0.6 * Math.sin(atk * PI) : 0;
        arrow.visible = atk > 0.2;
      },
    };
  };

  UNITS.sapeur = () => {
    const root = new T3.Group();
    const body = limb((M) => {
      for (const [x, y, z, r] of [[-0.12, 0.17, 0, 0.13], [0.12, 0.17, 0, 0.13], [0, 0.24, 0, 0.16], [-0.05, 0.12, 0.06, 0.12], [0.06, 0.12, -0.06, 0.12], [0, 0.18, 0.1, 0.11]]) M.sph(r, 0xf4f7ff, { x, y, z }, 10, 8);
      for (const x of [-0.06, 0.06]) { M.sph(0.03, 0x222222, { x, y: 0.24, z: 0.17 }, 6, 5); M.box(0.07, 0.015, 0.02, 0x222222, { x, y: 0.29, z: 0.17, rz: x > 0 ? 0.5 : -0.5 }); }
      M.box(0.08, 0.012, 0.02, 0x8a3030, { y: 0.17, z: 0.19 });
      for (const x of [-0.08, 0.08]) M.sph(0.05, 0x666a75, { x, y: 0.03, z: 0.02, sy: 0.6 }, 6, 5);
      M.cyl(0.03, 0.03, 0.2, 0xdde4f2, { x: -0.1, y: 0.4, z: 0.02 }, 6); M.cyl(0.03, 0.03, 0.2, 0xdde4f2, { x: 0.1, y: 0.4, z: 0.02 }, 6);
      M.sph(0.15, 0x26262e, { y: 0.58 });
      M.sph(0.04, 0x8a8a96, { x: -0.06, y: 0.65, z: 0.08 }, 6, 5);
      M.cyl(0.035, 0.035, 0.05, 0x888888, { y: 0.74 }, 8);
      M.cyl(0.012, 0.012, 0.12, 0xc9a25a, { y: 0.8, x: 0.03, rz: -0.5 }, 4);
    }, [0, 0, 0]);
    const spark = new T3.Mesh(new T3.SphereGeometry(0.035, 6, 5), mat(0xfff2a0, { basic: true }));
    spark.position.set(0.07, 0.86, 0);
    const h = halo(0xffaa30, 0.35, 0.9); h.position.copy(spark.position);
    body.add(spark, h);
    root.add(body);
    return {
      root,
      anim(t, mv) {
        const hop = mv ? Math.abs(Math.sin(t * 12)) * 0.08 : 0;
        body.position.y = hop;
        body.scale.set(1 + (mv ? (0.08 - hop) * 0.6 : 0), 1 - (mv ? (0.08 - hop) * 0.6 : 0), 1);
        const f = 0.7 + Math.random() * 0.6;
        spark.scale.setScalar(f); h.scale.setScalar(0.35 * f + 0.1);
      },
    };
  };

  UNITS.golem = () => {
    const root = new T3.Group();
    const leg = (x) => limb((M) => { M.box(0.22, 0.3, 0.24, 0x7e8188, { y: -0.15, flat: true }); M.box(0.26, 0.08, 0.3, 0x6c6f77, { y: -0.3, z: 0.03 }); }, [x, 0.34, 0]);
    const legL = leg(-0.15), legR = leg(0.15);
    const body = limb((M) => {
      M.rock(0.4, 0x9a9ca3, { y: 0.3, sx: 1.15, sy: 1.0, sz: 0.85 });
      M.rock(0.16, 0x8a8c93, { y: 0.72, z: 0.08, sx: 1.2 });
      M.sph(0.14, 0x6a9a4a, { x: -0.3, y: 0.55, sy: 0.4 }); M.sph(0.12, 0x6a9a4a, { x: 0.28, y: 0.6, z: -0.05, sy: 0.4 });
      M.cone(0.07, 0.3, C.crystal, { y: 0.55, z: -0.3, rx: -0.6 }, 5); M.cone(0.06, 0.25, C.crystal, { x: 0.15, y: 0.5, z: -0.3, rx: -0.7, rz: -0.3 }, 5);
    }, [0, 0.34, 0]);
    const eyes = new T3.Group();
    for (const x of [-0.06, 0.06]) { const e = new T3.Mesh(new T3.BoxGeometry(0.06, 0.035, 0.02), mat(0x8ff8ff, { basic: true })); e.position.set(x, 0.74, 0.25); eyes.add(e); }
    body.add(eyes);
    const arm = (x) => limb((M) => { M.cyl(0.08, 0.07, 0.3, 0x8a8d95, { y: -0.12 }, 8); M.rock(0.17, 0x7a7d85, { y: -0.33 }); }, [x, 0.55, 0]);
    const armL = arm(-0.46), armR = arm(0.46);
    body.add(armL, armR);
    root.add(legL, legR, body);
    root.scale.setScalar(1.1);
    return {
      root,
      anim(t, mv, atk) {
        const w = mv ? Math.sin(t * 6) : 0;
        legL.rotation.x = w * 0.5; legR.rotation.x = -w * 0.5;
        body.position.y = 0.34 + (mv ? Math.abs(w) * 0.03 : 0);
        body.rotation.z = w * 0.06;
        const a = atk > 0 ? -2.6 + (1 - atk) * 3.0 : 0;
        armL.rotation.x = atk > 0 ? a : -w * 0.5; armR.rotation.x = atk > 0 ? a : w * 0.5;
      },
    };
  };

  UNITS.aeronef = () => {
    const root = new T3.Group();
    const ship = new T3.Group(); root.add(ship);
    const M = new Builder();
    const red = new T3.Color(0xe63946), white = new T3.Color(0xf6f1e6);
    M.add(new T3.SphereGeometry(0.42, 20, 12), 0xffffff, { y: 0.55, sz: 1.5, cf: (x, y, z) => (Math.floor((Math.atan2(z, x) + PI) / (PI / 5)) % 2 ? red : white) });
    M.cone(0.12, 0.2, 0xf6f1e6, { y: 0.55, z: -0.7, rx: -PI / 2 }, 8);
    M.box(0.02, 0.3, 0.25, 0xa8dadc, { y: 0.62, z: -0.62 }); M.box(0.3, 0.02, 0.25, 0xa8dadc, { y: 0.55, z: -0.62 });
    for (const [x, z] of [[-0.15, -0.18], [0.15, -0.18], [-0.15, 0.18], [0.15, 0.18]]) M.cyl(0.006, 0.006, 0.36, 0x5a3d22, { x, z, y: 0.07 }, 3);
    M.box(0.36, 0.16, 0.5, 0x8a5a33, { y: -0.17 });
    M.box(0.38, 0.03, 0.52, C.gold, { y: -0.08 });
    M.sph(0.08, 0xffcc33, { y: -0.02, z: 0.1 }, 8, 6);
    M.box(0.12, 0.03, 0.03, 0x333333, { y: 0.0, z: 0.17 });
    M.cone(0.025, 0.06, 0xff8c1a, { y: -0.03, z: 0.2, rx: PI / 2 }, 5);
    ship.add(M.mesh());
    const prop = new T3.Group(); prop.position.set(0, -0.17, -0.3); ship.add(prop);
    for (let i = 0; i < 3; i++) { const b = new T3.Mesh(new T3.BoxGeometry(0.03, 0.2, 0.01), mat(0xd8dde6)); b.position.y = 0.1; const p = new T3.Group(); p.rotation.z = i * PI * 2 / 3; p.add(b); prop.add(p); }
    const bomb = new T3.Mesh(new T3.SphereGeometry(0.06, 8, 6), mat(0x222222));
    bomb.position.y = -0.3; ship.add(bomb);
    return {
      root,
      anim(t, mv, atk) {
        ship.position.y = Math.sin(t * 2) * 0.05;
        ship.rotation.z = Math.sin(t * 1.3) * 0.05;
        prop.rotation.z = t * 25;
        bomb.visible = atk > 0.5;
      },
    };
  };

  function unit(type) {
    const u = (UNITS[type] || UNITS.plumeur)();
    u.root.traverse((c) => { if (c.isMesh) { c.castShadow = true; } });
    return u;
  }

  // =====================================================================
  //  Aperçus (images pour les menus)
  // =====================================================================
  let thR = null, thS = null, thC = null;
  const thumbs = new Map();
  function thumb(kind, type, L = 1) {
    const key = kind + type + L;
    if (thumbs.has(key)) return thumbs.get(key);
    try {
      if (!thR) {
        thR = new T3.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
        thR.setPixelRatio(1); thR.setSize(180, 180);
        thS = new T3.Scene();
        thS.add(new T3.HemisphereLight(0xeaf6ff, 0x7a8a50, 0.85));
        const d = new T3.DirectionalLight(0xfff2dc, 0.8); d.position.set(-3, 6, 4); thS.add(d);
        thC = new T3.PerspectiveCamera(28, 1, 0.1, 100);
      }
      let obj;
      if (kind === 'b') {
        const b = building(type, L, { nU: type === 'mur', nV: false });
        if (b.anim) b.anim(1.3, { aim: -0.6, fill: 0.7, id: 1 });
        obj = b.group;
      } else {
        const u = unit(type);
        u.anim(0.35, false, 0);
        obj = u.root;
        if (type === 'aeronef') obj.position.y = 0.2;
      }
      thS.add(obj);
      const box = new T3.Box3().setFromObject(obj);
      const ctr = box.getCenter(new T3.Vector3()), size = box.getSize(new T3.Vector3()).length();
      const dir = new T3.Vector3(1, 0.85, 1.25).normalize();
      thC.position.copy(ctr).addScaledVector(dir, size * 1.9);
      thC.lookAt(ctr);
      thR.render(thS, thC);
      const url = thR.domElement.toDataURL();
      thS.remove(obj);
      thumbs.set(key, url);
      return url;
    } catch (e) {
      return '';
    }
  }

  return { building, scaffold, rubble, deco, unit, thumb, halo, mat, Builder, roofGeo };
})();
