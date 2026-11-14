// Tree models: real branching structure (trunk -> limbs -> twigs as tapered
// tubes) carrying foliage as alpha-tested leaf cards that sample a procedural
// leaf atlas. Card normals point out of the crown so crowns shade as volumes.
// Each species builds a near model and a light far model (fewer, larger cards).
import * as THREE from 'three';
import { GeoBuilder, taperTube } from '../core/geobuilder.js';
import { Simplex, mulberry32, clamp } from '../core/noise.js';
import { TREE_SPECIES } from './treespecies.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);

// ------------------------------------------------------------------ leaf atlas
// 4 x 4 cells of 256 px: 0 solid (bark / opaque parts), 1 broadleaf spray,
// 2 needle spray, 3 small round leaves, 4 palm frond, 5 willow strands,
// 6 lobed (maple) leaves, 7 fine leaflets (acacia), 8 glossy alien leaves,
// 9 daisy-like flower head, 10 grass seed head
const CELL = 256, GRID = 4;
export function atlasRect(i) {
  const cx = i % GRID, cy = Math.floor(i / GRID);
  const pad = 2 / (CELL * GRID);
  return [cx / GRID + pad, 1 - (cy + 1) / GRID + pad, (cx + 1) / GRID - pad, 1 - cy / GRID - pad];
}

let _atlas = null;
export function leafAtlas() {
  if (_atlas) return _atlas;
  const N = CELL * GRID;
  const cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const c = cv.getContext('2d');
  const rnd = mulberry32(911);
  const shade = (v) => { const k = Math.round(255 * v); return `rgb(${k},${k},${k})`; };
  const cell = (i, fn) => { c.save(); c.translate((i % GRID) * CELL, Math.floor(i / GRID) * CELL); c.beginPath(); c.rect(0, 0, CELL, CELL); c.clip(); fn(); c.restore(); };
  const leaf = (x, y, a, len, wid, v) => {
    c.save(); c.translate(x, y); c.rotate(a);
    c.fillStyle = shade(v);
    c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(wid, -len * 0.45, 0, -len); c.quadraticCurveTo(-wid, -len * 0.45, 0, 0); c.fill();
    c.strokeStyle = shade(v * 0.72); c.lineWidth = 1.2; c.beginPath(); c.moveTo(0, -1); c.lineTo(0, -len * 0.9); c.stroke();
    c.restore();
  };
  const twig = (pts, wdt, v) => { c.strokeStyle = shade(v); c.lineWidth = wdt; c.lineCap = 'round'; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) c.lineTo(p[0], p[1]); c.stroke(); };
  c.clearRect(0, 0, N, N);
  cell(0, () => { c.fillStyle = '#fff'; c.fillRect(0, 0, CELL, CELL); });
  cell(1, () => {           // broadleaf spray
    for (let b = 0; b < 5; b++) {
      const a = -Math.PI / 2 + (b - 2) * 0.42, L = 80 + rnd() * 40;
      const ex = 128 + Math.cos(a) * L, ey = 240 + Math.sin(a) * L * 1.6;
      twig([[128, 250], [ex, ey]], 3, 0.45);
      for (let k = 0; k < 9; k++) { const t = 0.3 + k / 9 * 0.75; leaf(128 + (ex - 128) * t, 250 + (ey - 250) * t, a + Math.PI / 2 + (k % 2 ? 0.9 : -0.9) + (rnd() - 0.5) * 0.5, 34 + rnd() * 12, 14, 0.62 + rnd() * 0.38); }
    }
  });
  cell(2, () => {           // needle spray
    for (let b = 0; b < 7; b++) {
      const a = -Math.PI / 2 + (b - 3) * 0.3, L = 90 + rnd() * 30;
      const ex = 128 + Math.cos(a) * L, ey = 250 + Math.sin(a) * L * 2.1;
      twig([[128, 252], [ex, ey]], 2.5, 0.5);
      for (let k = 0; k < 26; k++) {
        const t = 0.15 + k / 26 * 0.85, x = 128 + (ex - 128) * t, y = 252 + (ey - 252) * t;
        for (const sd of [-1, 1]) { const na = a + sd * (0.75 + rnd() * 0.3); c.strokeStyle = shade(0.6 + rnd() * 0.4); c.lineWidth = 1.6; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(na) * 18, y + Math.sin(na) * 18); c.stroke(); }
      }
    }
  });
  cell(3, () => {           // small round leaves (birch / aspen)
    for (let b = 0; b < 6; b++) {
      const a = -Math.PI / 2 + (b - 2.5) * 0.4, L = 70 + rnd() * 50;
      const ex = 128 + Math.cos(a) * L, ey = 248 + Math.sin(a) * L * 1.8;
      twig([[128, 250], [ex, ey]], 2, 0.45);
      for (let k = 0; k < 10; k++) { const t = 0.25 + k / 10 * 0.8; leaf(128 + (ex - 128) * t + (rnd() - 0.5) * 16, 250 + (ey - 250) * t, rnd() * 6.28, 18 + rnd() * 6, 11, 0.6 + rnd() * 0.4); }
    }
  });
  cell(4, () => {           // palm frond (rib vertical, leaflets both sides)
    twig([[128, 256], [128, 4]], 4, 0.55);
    for (let k = 0; k < 30; k++) { const y = 250 - k * 8.2; for (const sd of [-1, 1]) { c.save(); c.translate(128, y); c.rotate(sd * (1.25 - k * 0.012)); c.fillStyle = shade(0.6 + rnd() * 0.4); c.beginPath(); c.ellipse(0, -48 + k * 0.6, 4.5, 48 - k * 0.6, 0, 0, Math.PI * 2); c.fill(); c.restore(); } }
  });
  cell(5, () => {           // willow: hanging strands of narrow leaves
    for (let s = 0; s < 11; s++) {
      const x = 20 + s * 21 + (rnd() - 0.5) * 8;
      twig([[x, 0], [x + (rnd() - 0.5) * 10, 250]], 1.5, 0.5);
      for (let k = 0; k < 14; k++) leaf(x + (rnd() - 0.5) * 6, 14 + k * 17, (rnd() < 0.5 ? -1 : 1) * (2.6 + rnd() * 0.3), 22, 5, 0.6 + rnd() * 0.4);
    }
  });
  cell(6, () => {           // lobed maple leaves
    const lobe = (x, y, r, a, v) => {
      c.save(); c.translate(x, y); c.rotate(a); c.fillStyle = shade(v); c.beginPath();
      for (let i = 0; i <= 10; i++) { const t = i / 10 * Math.PI * 2, rr = r * (i % 2 ? 0.45 : 1) * (i === 5 ? 0.3 : 1); c.lineTo(Math.sin(t) * rr, -Math.cos(t) * rr); }
      c.fill(); c.restore();
    };
    for (let b = 0; b < 5; b++) { const a = -Math.PI / 2 + (b - 2) * 0.45, L = 100; const ex = 128 + Math.cos(a) * L, ey = 250 + Math.sin(a) * L * 1.7; twig([[128, 252], [ex, ey]], 2.5, 0.45); for (let k = 0; k < 6; k++) { const t = 0.35 + k / 6 * 0.7; lobe(128 + (ex - 128) * t + (rnd() - 0.5) * 20, 250 + (ey - 250) * t, 18 + rnd() * 6, rnd() * 1.2 - 0.6, 0.6 + rnd() * 0.4); } }
  });
  cell(7, () => {           // acacia: fine pinnate leaflets in feathery sprays
    for (let b = 0; b < 9; b++) {
      const a = -Math.PI / 2 + (b - 4) * 0.33, L = 90 + rnd() * 25;
      const ex = 128 + Math.cos(a) * L, ey = 240 + Math.sin(a) * L * 1.2;
      twig([[128, 245], [ex, ey]], 1.5, 0.5);
      for (let k = 0; k < 18; k++) { const t = 0.2 + k / 18 * 0.8; for (const sd of [-1, 1]) leaf(128 + (ex - 128) * t, 245 + (ey - 245) * t, a + Math.PI / 2 + sd * 1.3, 9, 3.5, 0.6 + rnd() * 0.4); }
    }
  });
  cell(8, () => {           // glossy alien leaves with pale rims
    for (let k = 0; k < 26; k++) { const x = 30 + rnd() * 196, y = 30 + rnd() * 200, r = 18 + rnd() * 14; c.fillStyle = shade(0.55 + rnd() * 0.25); c.beginPath(); c.ellipse(x, y, r, r * 0.8, rnd() * 3, 0, Math.PI * 2); c.fill(); c.strokeStyle = shade(1); c.lineWidth = 2; c.stroke(); }
  });
  cell(9, () => {           // daisy head (white petals, coloured centre drawn by vertex tint)
    for (let k = 0; k < 18; k++) { const a = k / 18 * Math.PI * 2; c.save(); c.translate(128, 128); c.rotate(a); c.fillStyle = shade(0.9 + rnd() * 0.1); c.beginPath(); c.ellipse(0, -62, 13, 50, 0, 0, Math.PI * 2); c.fill(); c.restore(); }
    c.fillStyle = shade(0.35); c.beginPath(); c.arc(128, 128, 30, 0, Math.PI * 2); c.fill();
  });
  cell(10, () => {          // grass seed head (panicle)
    twig([[128, 256], [128, 20]], 2, 0.6);
    for (let k = 0; k < 22; k++) { const y = 30 + k * 9, a = (k % 2 ? 1 : -1) * (0.5 + rnd() * 0.4); c.save(); c.translate(128, y); c.rotate(a); c.fillStyle = shade(0.7 + rnd() * 0.3); c.beginPath(); c.ellipse(0, -14, 4, 14, 0, 0, Math.PI * 2); c.fill(); c.restore(); }
  });
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  _atlas = tex;
  return tex;
}

// ------------------------------------------------------------------ builder
class TreeBuilder {
  constructor(seed, form = 1) {
    this.form = form;
    // form multipliers: height, spread, extra lean / irregularity
    this.fH = [0.78, 1.0, 1.08][form];
    this.fW = [0.7, 1.0, 1.3][form];
    this.fI = [0.6, 1.0, 1.7][form];
    this.gb = new GeoBuilder(['aSway', 'aGlow', 'aBark'], { uv: true });
    this.rnd = mulberry32(seed);
    this.S = new Simplex(seed);
    this.ends = [];
  }
  r(a = 0, b = 1) { return a + (b - a) * this.rnd(); }
  // tapered limb along a curve; returns the curve
  limb(pts, r0, r1, bark, H, segs = 8, radial = 7) {
    const curve = new THREE.CatmullRomCurve3(pts);
    this.gb.add(taperTube(curve, segs, radial, (t) => r0 + (r1 - r0) * t), {
      color: bark, uvRect: atlasRect(0),
      attrs: { aSway: (x, y, z) => Math.pow(clamp(y / H, 0, 1), 2) * 0.22, aGlow: 0, aBark: 1 },
    });
    return curve;
  }
  // one leaf card centred at p, facing f (unit), size w x h, oriented with
  // texture-up along 'up'; normals bent out of the crown centre C
  card(p, f, up, w, h, cellI, color, C, sway, H) {
    const u = new THREE.Vector3().crossVectors(up, f).normalize();
    if (u.lengthSq() < 1e-4) u.set(1, 0, 0);
    const vv = new THREE.Vector3().crossVectors(f, u).normalize();
    const n = p.clone().sub(C).normalize().multiplyScalar(0.75).add(V(0, 0.45, 0)).normalize();
    const [u0, v0, u1, v1] = atlasRect(cellI);
    const c0 = p.clone().addScaledVector(u, -w / 2).addScaledVector(vv, -h / 2);
    const c1 = p.clone().addScaledVector(u, w / 2).addScaledVector(vv, -h / 2);
    const c2 = p.clone().addScaledVector(u, w / 2).addScaledVector(vv, h / 2);
    const c3 = p.clone().addScaledVector(u, -w / 2).addScaledVector(vv, h / 2);
    const pos = [c0, c1, c2, c0, c2, c3], uv = [[u0, v0], [u1, v0], [u1, v1], [u0, v0], [u1, v1], [u0, v1]];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos.flatMap((q) => [q.x, q.y, q.z]), 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(pos.flatMap(() => [n.x, n.y, n.z]), 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv.flat(), 2));
    const k = this.r(0.82, 1.12);
    this.gb.add(g, { color: color.map((x) => x * k), uvRect: [0, 0, 1, 1], attrs: { aSway: (x, y) => sway * (0.5 + 0.5 * clamp(y / H, 0, 1)), aGlow: 0, aBark: 0 } });
  }
  // a cluster of cards around point e
  cluster(e, dir, n, rad, size, cellI, color, C, H, { flat = 0, sway = 0.5 } = {}) {
    for (let i = 0; i < n; i++) {
      const p = e.clone().add(V(this.r(-1, 1), this.r(-0.6, 1) * (1 - flat * 0.7), this.r(-1, 1)).multiplyScalar(rad));
      const f = V(this.r(-1, 1), this.r(-1, 1) * (1 - flat) + flat * 1.6, this.r(-1, 1)).normalize();
      const up = dir.clone().add(V(this.r(-0.4, 0.4), 0.3, this.r(-0.4, 0.4))).normalize();
      const s = size * this.r(0.8, 1.2);
      this.card(p, f, up, s, s, cellI, color, C, sway, H);
    }
  }
  build() { return this.gb.build(); }
}

const barkFn = (S, base, dark = 0.7) => (x, y, z) => {
  const n = S.noise3(x * 3, y * 0.8, z * 3) * 0.5 + 0.5, m = S.noise3(x * 9, y * 9, z * 9) * 0.5 + 0.5;
  const k = dark + (1 - dark) * n * (0.8 + 0.2 * m);
  return base.map((c) => c * k);
};

// ------------------------------------------------------------------ species
function conifer(T, lod, { H, crownBase, spread, droop, leafColor, bark, cell = 2, dense = 1 }) {
  const S = T.S;
  H *= T.fH; spread *= T.fW; crownBase = Math.min(0.7, crownBase * (T.form === 2 ? 1.6 : T.form === 0 ? 0.6 : 1));
  const lean = V(T.r(-0.3, 0.3), 0, T.r(-0.3, 0.3)).multiplyScalar(T.fI);
  const trunk = T.limb([V(0, -0.5, 0), V(lean.x * 0.3, H * 0.4, lean.z * 0.3), V(lean.x * 0.7, H * 0.75, lean.z * 0.7), V(lean.x, H, lean.z)], H * 0.028, 0.04, barkFn(S, bark), H, 12, 8);
  const C = trunk.getPoint(0.6);
  const whorls = lod ? 6 : Math.round(12 * dense);
  for (let w = 0; w < whorls; w++) {
    const t = crownBase + (1 - crownBase) * (w + T.r(0, 0.6)) / whorls;
    const p = trunk.getPoint(Math.min(0.98, t));
    const L = spread * H * Math.pow(1 - t, 0.9) * T.r(0.8, 1.15) + 0.3;
    const nb = lod ? 3 : 5;
    for (let b = 0; b < nb; b++) {
      if (T.form === 2 && T.rnd() < 0.22) continue;        // old trees: missing limbs
      const a = (b / nb) * Math.PI * 2 + w * 1.3 + T.r(-0.3, 0.3);
      const dir = V(Math.cos(a), -droop + T.r(-0.08, 0.12), Math.sin(a)).normalize();
      const end = p.clone().addScaledVector(dir, L);
      if (!lod) T.limb([p, p.clone().addScaledVector(dir, L * 0.5).add(V(0, L * 0.06, 0)), end], 0.05 + L * 0.012, 0.012, barkFn(S, bark), H, 4, 4);
      // needle sprays along the branch: one card lying in the branch plane and
      // one standing across it, so the bough reads full from any angle
      const k = lod ? 2 : Math.max(3, Math.round(L * 2.2 * dense));
      const side = V(-dir.z, 0, dir.x).normalize();
      for (let i = 0; i < k; i++) {
        const q = p.clone().lerp(end, 0.25 + 0.75 * (i + 0.5) / k).add(V(0, T.r(-0.15, 0.1), 0));
        const s = (lod ? 2.6 : 1.7) * T.r(0.85, 1.15) * Math.min(1.25, 0.65 + L * 0.22);
        const flatF = V(T.r(-0.2, 0.2), 1, T.r(-0.2, 0.2)).normalize();
        T.card(q, flatF, dir, s, s * 1.1, cell, leafColor, C, 0.4, H);
        const outF = side.clone().multiplyScalar(T.r(-0.3, 0.3)).add(dir.clone().multiplyScalar(0.0)).add(V(0, 0, 0));
        void outF;
        const stand = new THREE.Vector3().crossVectors(dir, UP).normalize();
        if (stand.lengthSq() > 0.01) T.card(q.clone().add(V(0, -s * 0.12, 0)), stand, dir.clone().add(V(0, -0.5, 0)).normalize(), s * 0.95, s * 0.75, cell, leafColor.map((c) => c * 0.88), C, 0.4, H);
      }
    }
  }
  // inner fill along the trunk and the leader tip
  const fills = lod ? 3 : 7;
  for (let i = 0; i < fills; i++) {
    const t = crownBase + (1 - crownBase) * (i + 0.5) / fills;
    const rr = spread * H * Math.pow(1 - t, 0.9) * 0.45 + 0.2;
    T.cluster(trunk.getPoint(t), UP, lod ? 2 : 4, rr, (lod ? 2.4 : 1.7) * Math.min(1.3, 0.7 + rr * 0.4), cell, leafColor.map((c) => c * 0.8), C, H, { sway: 0.3 });
  }
  T.cluster(trunk.getPoint(1), UP, lod ? 1 : 3, 0.3, lod ? 1.6 : 1.1, cell, leafColor, C, H, { sway: 0.5 });
}

function broadleaf(T, lod, { H, trunkH, limbs, limbLen, rise, crownR, leafColor, bark, cell, cardSize, cardsPer, forkTwigs = 3, flat = 0 }) {
  const S = T.S;
  H *= T.fH; trunkH *= T.fH * (T.form === 0 ? 1.1 : 1); limbLen *= T.fW; crownR *= T.fW;
  limbs = Math.max(3, limbs + (T.form === 0 ? -1 : T.form === 2 ? 1 : 0));
  rise *= T.form === 0 ? 1.35 : T.form === 2 ? 0.8 : 1;
  const bk = barkFn(S, bark);
  const lean = V(T.r(-0.4, 0.4), 0, T.r(-0.4, 0.4)).multiplyScalar(T.fI);
  const top = V(lean.x, trunkH, lean.z);
  const trunk = T.limb([V(0, -0.5, 0), V(lean.x * 0.3, trunkH * 0.5, lean.z * 0.3), top], H * 0.045, H * 0.03, bk, H, 8, 9);
  void trunk;
  const C = top.clone().add(V(0, crownR * 0.7, 0));
  const nL = lod ? Math.max(3, limbs - 1) : limbs;
  for (let l = 0; l < nL; l++) {
    const a = (l / nL) * Math.PI * 2 + T.r(-0.4, 0.4);
    const dir = V(Math.cos(a), rise + T.r(-0.15, 0.2), Math.sin(a)).normalize();
    const L = limbLen * T.r(0.8, 1.15);
    const base = top.clone().add(V(0, -T.r(0, trunkH * 0.35) * (T.form === 2 ? 1 : 0.4), 0));
    const mid = base.clone().addScaledVector(dir, L * 0.5).add(V(T.r(-0.4, 0.4) * T.fI, L * 0.15, T.r(-0.4, 0.4) * T.fI));
    const end = base.clone().addScaledVector(dir, L).add(V(0, L * 0.1 * (1 - flat), 0));
    T.limb([base, mid, end], H * 0.022, H * 0.007, bk, H, lod ? 4 : 7, lod ? 4 : 6);
    const nt = lod ? 1 : forkTwigs;
    for (let k = 0; k < nt; k++) {
      const s = end.clone().lerp(mid, T.r(0, 0.6));
      const d2 = dir.clone().add(V(T.r(-0.7, 0.7), T.r(0.1, 0.6) * (1 - flat), T.r(-0.7, 0.7))).normalize();
      const e2 = s.clone().addScaledVector(d2, L * T.r(0.35, 0.55));
      if (!lod) T.limb([s, s.clone().lerp(e2, 0.5).add(V(0, 0.2, 0)), e2], H * 0.008, H * 0.003, bk, H, 3, 4);
      T.cluster(e2, d2, lod ? Math.ceil(cardsPer * 0.4) : cardsPer, crownR * 0.32, cardSize * (lod ? 1.7 : 1), cell, leafColor, C, H, { flat });
    }
    T.cluster(end, dir, lod ? 2 : Math.ceil(cardsPer * 0.6), crownR * 0.3, cardSize * (lod ? 1.7 : 1), cell, leafColor, C, H, { flat });
  }
  // fill the crown centre
  T.cluster(C, UP, lod ? 3 : Math.ceil(cardsPer * 1.2), crownR * 0.45, cardSize * (lod ? 1.8 : 1.1), cell, leafColor.map((c) => c * 0.85), C, H, { flat });
}

function willow(T, lod) {
  const S = T.S, H = (9 + T.r(0, 2)) * T.fH;
  const bark = [0.34, 0.29, 0.23], leaf = [0.6, 0.7, 0.3];
  const top = V(T.r(-0.3, 0.3), 3.2, T.r(-0.3, 0.3));
  T.limb([V(0, -0.5, 0), V(0, 1.6, 0), top], 0.45, 0.32, barkFn(S, bark), H, 6, 9);
  const C = top.clone().add(V(0, 3, 0));
  const n = lod ? 5 : 8;
  for (let l = 0; l < n; l++) {
    const a = l / n * Math.PI * 2 + T.r(-0.3, 0.3);
    const dir = V(Math.cos(a), 1.1, Math.sin(a)).normalize();
    const end = top.clone().addScaledVector(dir, T.r(4, 5.5) * T.fW);
    if (!lod) T.limb([top, top.clone().lerp(end, 0.5).add(V(0, 0.3, 0)), end], 0.2, 0.05, barkFn(S, bark), H, 5, 5);
    // hanging curtains of strands from the arching limbs
    const k = lod ? 3 : 7;
    for (let i = 0; i < k; i++) {
      const q = top.clone().lerp(end, 0.4 + 0.6 * i / k).add(V(T.r(-0.6, 0.6), 0, T.r(-0.6, 0.6)));
      const out = V(q.x - C.x, 0, q.z - C.z).normalize();
      const len = T.r(3.5, 5.5);
      T.card(q.clone().add(V(0, -len / 2 + 0.3, 0)), out, UP, lod ? 2.6 : 1.8, len, 5, leaf, C, 0.9, H);
      if (!lod) T.card(q.clone().add(V(0, -len / 2 + 0.3, 0)), V(-out.z, 0, out.x), UP, 1.6, len * 0.9, 5, leaf, C, 0.9, H);
    }
  }
}

function palm(T, lod) {
  const S = T.S, H = (9 + T.r(0, 3)) * T.fH;
  const bend = V(T.r(-1.5, 1.5), 0, T.r(-1.5, 1.5)).multiplyScalar(T.fI);
  const curve = new THREE.CatmullRomCurve3([V(0, -0.5, 0), V(bend.x * 0.2, H * 0.4, bend.z * 0.2), V(bend.x * 0.65, H * 0.8, bend.z * 0.65), V(bend.x, H, bend.z)]);
  T.gb.add(taperTube(curve, lod ? 8 : 18, 8, (t) => 0.28 - t * 0.1), {
    uvRect: atlasRect(0),
    color: (x, y) => { const ring = Math.abs(Math.sin(y * 9)) ; const v = 0.75 + 0.25 * ring; return [0.42 * v, 0.34 * v, 0.24 * v]; },
    attrs: { aSway: (x, y) => Math.pow(clamp(y / H, 0, 1), 2) * 0.3, aGlow: 0, aBark: 1 },
  });
  const top = curve.getPoint(1), C = top.clone();
  const nf = lod ? 6 : 11;
  for (let f = 0; f < nf; f++) {
    const a = f / nf * Math.PI * 2 + T.r(-0.2, 0.2);
    const out = V(Math.cos(a), 0, Math.sin(a));
    const L = T.r(3.6, 4.6), segs = lod ? 2 : 4;
    // arching frond: a chain of cards along a drooping curve
    for (let i = 0; i < segs; i++) {
      const t0 = i / segs, t1 = (i + 1) / segs;
      const y = (t) => 0.8 * t - 1.9 * t * t;
      const p0 = top.clone().addScaledVector(out, L * t0).add(V(0, y(t0) * L * 0.5, 0)), p1 = top.clone().addScaledVector(out, L * t1).add(V(0, y(t1) * L * 0.5, 0));
      const mid = p0.clone().lerp(p1, 0.5), along = p1.clone().sub(p0).normalize();
      const face = new THREE.Vector3().crossVectors(along, V(-out.z, 0, out.x)).normalize();
      T.card(mid, face.y < 0 ? face.negate() : face, along, 2.2, p0.distanceTo(p1) * 1.15, 4, [0.46, 0.66, 0.24], C, 0.8, H);
    }
  }
  if (!lod) for (let k = 0; k < 6; k++) T.gb.add(new THREE.SphereGeometry(0.13, 8, 6), { pos: top.clone().add(V(T.r(-0.3, 0.3), -0.35, T.r(-0.3, 0.3))), color: [0.36, 0.25, 0.12], uvRect: atlasRect(0), attrs: { aSway: 0.2, aGlow: 0, aBark: 1 } });
}

function bloomTree(T, lod) {
  const S = T.S, H = (7 + T.r(0, 2)) * T.fH;
  const prof = [];
  for (let i = 0; i <= 10; i++) { const t = i / 10; prof.push(new THREE.Vector2(0.22 + 0.4 * Math.sin(t * Math.PI * 0.85) * (1 - t * 0.6), t * H * 0.6 - 0.4)); }
  T.gb.add(new THREE.LatheGeometry(prof, lod ? 7 : 12), { uvRect: atlasRect(0), color: (x, y, z) => { const n = S.noise3(x * 3, y * 2, z * 3) * 0.5 + 0.5; return [0.36 + 0.1 * n, 0.3 + 0.06 * n, 0.36 + 0.08 * n]; }, attrs: { aSway: 0, aGlow: 0, aBark: 1 } });
  const top = V(0, H * 0.6 - 0.4, 0), C = top.clone().add(V(0, 1.6, 0));
  const n = lod ? 4 : 6;
  for (let b = 0; b < n; b++) {
    const a = b / n * Math.PI * 2 + T.r(-0.3, 0.3);
    const end = top.clone().add(V(Math.cos(a) * T.r(2, 3), T.r(1, 2.2), Math.sin(a) * T.r(2, 3)));
    T.limb([top, top.clone().lerp(end, 0.5).add(V(0, 0.8, 0)), end], 0.14, 0.04, [0.36, 0.3, 0.36], H, lod ? 3 : 6, 5);
    T.cluster(end, UP, lod ? 3 : 7, 1.1, lod ? 2.2 : 1.5, 8, [0.95, 0.42, 0.78], C, H, { sway: 0.5 });
    if (!lod) for (let k = 0; k < 2; k++) T.gb.add(new THREE.SphereGeometry(0.14, 8, 6), { pos: end.clone().add(V(T.r(-0.5, 0.5), -0.6, T.r(-0.5, 0.5))), color: [1, 1, 1], uvRect: atlasRect(0), attrs: { aSway: 0.5, aGlow: 1, aBark: 1 } });
  }
}

const BUILD = {
  pine: (T, lod) => conifer(T, lod, { H: 15 + T.r(0, 4), crownBase: 0.48, spread: 0.16, droop: 0.05, leafColor: [0.36, 0.5, 0.24], bark: [0.46, 0.3, 0.22], dense: 0.8 }),
  spruce: (T, lod) => conifer(T, lod, { H: 13 + T.r(0, 4), crownBase: 0.08, spread: 0.24, droop: 0.22, leafColor: [0.26, 0.45, 0.3], bark: [0.34, 0.27, 0.22], dense: 1.1 }),
  fir: (T, lod) => conifer(T, lod, { H: 12 + T.r(0, 3), crownBase: 0.06, spread: 0.22, droop: 0.12, leafColor: [0.42, 0.58, 0.64], bark: [0.34, 0.3, 0.28], dense: 1.1 }),
  oak: (T, lod) => broadleaf(T, lod, { H: 11, trunkH: 3 + T.r(0, 1), limbs: 6, limbLen: 4.5, rise: 0.55, crownR: 4.6, leafColor: [0.44, 0.6, 0.2], bark: [0.36, 0.3, 0.24], cell: 1, cardSize: 1.9, cardsPer: 7 }),
  birch: (T, lod) => broadleaf(T, lod, { H: 13, trunkH: 6.5 + T.r(0, 1.5), limbs: 5, limbLen: 3.2, rise: 1.4, crownR: 2.6, leafColor: [0.6, 0.72, 0.26], bark: [0.88, 0.86, 0.82], cell: 3, cardSize: 1.4, cardsPer: 6 }),
  maple: (T, lod) => broadleaf(T, lod, { H: 11, trunkH: 3.5 + T.r(0, 1), limbs: 6, limbLen: 3.6, rise: 0.9, crownR: 3.8, leafColor: [0.5, 0.64, 0.2], bark: [0.38, 0.32, 0.27], cell: 6, cardSize: 1.7, cardsPer: 8 }),
  acacia: (T, lod) => broadleaf(T, lod, { H: 8, trunkH: 2.6 + T.r(0, 1), limbs: 4, limbLen: 4.4, rise: 0.7, crownR: 4.2, leafColor: [0.54, 0.6, 0.24], bark: [0.44, 0.36, 0.28], cell: 7, cardSize: 2.2, cardsPer: 7, forkTwigs: 3, flat: 0.85 }),
  willow: (T, lod) => willow(T, lod),
  palm: (T, lod) => palm(T, lod),
  bloom: (T, lod) => bloomTree(T, lod),
};

// birch bark: white with dark lenticels
function birchFix(geo) {
  const P = geo.attributes.position, Cc = geo.attributes.color, B = geo.attributes.aBark;
  for (let i = 0; i < P.count; i++) {
    if (B.getX(i) < 0.5) continue;
    const y = P.getY(i), a = Math.atan2(P.getZ(i), P.getX(i));
    const mark = Math.sin(y * 7 + Math.sin(a * 3) * 2) > 0.85 ? 0.25 : 1;
    Cc.setXYZ(i, Cc.getX(i) * mark, Cc.getY(i) * mark, Cc.getZ(i) * mark);
  }
  return geo;
}

export const TREE_FORMS = 3;
// every species in three forms (young / mature / old), each grown from its own
// seed so branch layouts differ, not just their size
export function treeModels() {
  const out = [];
  TREE_SPECIES.forEach((sp, i) => {
    for (let f = 0; f < TREE_FORMS; f++) {
      const seed = 101 + i * 17 + f * 1009;
      const Tn = new TreeBuilder(seed, f); BUILD[sp.id](Tn, 0);
      const Tf = new TreeBuilder(seed, f); BUILD[sp.id](Tf, 1);
      let gn = Tn.build(), gf = Tf.build();
      if (sp.id === 'birch') { gn = birchFix(gn); gf = birchFix(gf); }
      out.push({ species: i, form: f, near: gn, far: gf });
    }
  });
  return out;
}
