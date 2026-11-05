// Model kit used by every building model: parts grouped by material,
// colliders, interior volumes and light points, plus reusable details
// (plinths, walls with real openings, railings, stairs, pipes, tanks,
// antennas, hazard stripes...).
import * as THREE from 'three';
import { GeoBuilder, taperTube } from '../core/geobuilder.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mulberry32 } from '../core/noise.js';

// rounded boxes are cached by size so repeated parts share geometry work
const rbCache = new Map();
export function roundedBox(w, h, d) {
  const m = Math.min(w, h, d);
  const k = w.toFixed(3) + ',' + h.toFixed(3) + ',' + d.toFixed(3);
  let g = rbCache.get(k);
  if (!g) {
    g = new RoundedBoxGeometry(w, h, d, Math.max(w, h, d) > 3 ? 2 : 1, Math.min(0.16, m * 0.22));
    rbCache.set(k, g);
  }
  return g;
}

export const C = {
  W: 0xf1f2f3, W2: 0xd3d7dc, G: 0x80868d, G2: 0x5b6168, D: 0x33373c, K: 0x18191b,
  O: 0xb65a24, REG: 0x93694f, REG2: 0x76594a, BAS: 0x6f6a66, BERM: 0x7d5440, MEM: 0xe9e6df, Y: 0xf2c22e, TEAL: 0x2bb3a6, BLUE: 0x3d76c9, RED: 0xc8382c, GREEN: 0x3fa35a,
  CONC: 0xbdb7ad, CONC2: 0x8f887d, ASPH: 0x2b2b2d, WOOD: 0x8a6a4a, CREAM: 0xefe3c8, TERRA: 0xc0683f,
  IN1: 0xe9e6df, IN2: 0x9aa3a8, FLOOR: 0x6f7378,
};
export const L = {
  warm: 0xffcc8c, cyan: 0x66e0ff, red: 0xff3322, green: 0x55ff77, orange: 0xff8a2a, white: 0xffffff, violet: 0xb07aff,
};

const e = (x, y, z) => new THREE.Euler(x, y, z);
const v = (x, y, z) => new THREE.Vector3(x, y, z);

export class ModelBuilder {
  constructor() {
    this.groups = new Map();   // key -> GeoBuilder
    this.anims = [];           // {key, gb, anim}
    this.colliders = [];       // local boxes {x,z,hx,hz,y0,y1, flags}
    this.interiors = [];       // local boxes {x0,y0,z0,x1,y1,z1}
    this.lights = [];          // {x,y,z,color,intensity,dist}
    this.doors = [];           // {key, gb, slide:[x,y,z], x,z (door center)}
    this.top = 0;
  }

  gb(key) {
    if (!this.groups.has(key)) this.groups.set(key, new GeoBuilder());
    return this.groups.get(key);
  }

  add(key, geo, opts = {}) {
    this.gb(key).add(geo, opts);
    const bb = geo.boundingBox || (geo.computeBoundingBox(), geo.boundingBox);
    const y = (opts.pos ? opts.pos.y : 0) + bb.max.y * (opts.scale ? (opts.scale.y || opts.scale) : 1);
    if (y > this.top) this.top = y;
    return this;
  }

  // centred box
  box(key, x, y, z, w, h, d, color, rot) {
    const soft = (key === 'hull' || key === 'metal' || key === 'interior' || key === 'concrete' || key === 'printed') && Math.min(w, h, d) >= 0.12 && !this.sharp;
    return this.add(key, soft ? roundedBox(w, h, d) : new THREE.BoxGeometry(w, h, d), { pos: v(x, y, z), rot: rot ? e(0, rot, 0) : undefined, color });
  }
  // box from bounds
  bb(key, x0, y0, z0, x1, y1, z1, color) {
    return this.box(key, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), color);
  }
  // vertical cylinder standing on y
  cyl(key, x, y, z, r, h, color, seg = 16, rt) {
    return this.add(key, new THREE.CylinderGeometry(rt === undefined ? r : rt, r, h, seg), { pos: v(x, y + h / 2, z), color });
  }
  // horizontal cylinder along axis 'x' | 'z'
  hcyl(key, x, y, z, r, len, axis, color, seg = 14) {
    return this.add(key, new THREE.CylinderGeometry(r, r, len, seg), { pos: v(x, y, z), rot: axis === 'x' ? e(0, 0, Math.PI / 2) : e(Math.PI / 2, 0, 0), color });
  }
  sphere(key, x, y, z, r, color, seg = 16, sy = 1) {
    return this.add(key, new THREE.SphereGeometry(r, seg, Math.max(6, seg * 0.6 | 0)), { pos: v(x, y, z), scale: v(1, sy, 1), color });
  }
  dome(key, x, y, z, r, color, seg = 24, frac = 0.5) {
    return this.add(key, new THREE.SphereGeometry(r, seg, seg / 2 | 0, 0, Math.PI * 2, 0, Math.PI * frac), { pos: v(x, y, z), color });
  }
  tube(key, points, r, color, seg = 6) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => v(...p)), false, 'catmullrom', 0.2);
    return this.add(key, taperTube(curve, Math.max(4, points.length * 4), seg, () => r), { color });
  }

  anim(key, geo, opts, anim) {
    const gb = new GeoBuilder();
    gb.add(geo, opts);
    this.anims.push({ key, gb, anim });
    return gb;
  }
  animGroup(key, anim) {
    const gb = new GeoBuilder();
    this.anims.push({ key, gb, anim });
    return gb;
  }

  col(x0, y0, z0, x1, y1, z1, flags = {}) {
    this.colliders.push({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, hx: Math.abs(x1 - x0) / 2, hz: Math.abs(z1 - z0) / 2, y0: Math.min(y0, y1), y1: Math.max(y0, y1), ...flags });
  }
  colCyl(x, z, r, y0, y1, flags = {}) { this.colliders.push({ cyl: true, x, z, r, y0, y1, ...flags }); }
  interior(x0, y0, z0, x1, y1, z1) { this.interiors.push({ x0, y0, z0, x1, y1, z1 }); }
  light(x, y, z, color = L.warm, intensity = 6, dist = 12) { this.lights.push({ x, y, z, color, intensity, dist }); }

  finish() {
    const parts = [];
    for (const [key, gb] of this.groups) if (!gb.empty) parts.push({ key, geo: gb.build() });
    for (const a of this.anims) if (!a.gb.empty) parts.push({ key: a.key, geo: a.gb.build(), anim: a.anim });
    for (const d of this.doors) if (!d.gb.empty) parts.push({ key: d.key, geo: d.gb.build(), anim: { slide: d.slide }, door: true });
    return { parts, colliders: this.colliders, interiors: this.interiors, lights: this.lights, doors: this.doors.map((d) => ({ x: d.x, z: d.z })), height: this.top };
  }
}

// ---------------------------------------------------------------- details
// Concrete pad: walking surface at y=0, skirt buried to -1.6
export function plinth(M, w, d, { color = C.CONC, trim = C.G2, h = 0.3, collide = true } = {}) {
  M.bb('concrete', -w / 2, -1.6, -d / 2, w / 2, 0, d / 2, color);
  M.bb('metal', -w / 2 - 0.04, -0.12, -d / 2 - 0.04, w / 2 + 0.04, -0.02, d / 2 + 0.04, trim);
  if (collide) M.col(-w / 2, -1.6, -d / 2, w / 2, 0, d / 2);
}

export function hazard(M, x, y, z, w, h, d) {
  M.add('hull', new THREE.BoxGeometry(w, h, d), {
    pos: v(x, y, z),
    color: (lx, ly, lz) => (Math.floor((lx + lz + ly) * 3.2) & 1 ? [0.92, 0.7, 0.08] : [0.05, 0.05, 0.05]),
  });
}

export function railing(M, x0, z0, x1, z1, y, h = 1.0, color = C.G) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const n = Math.max(1, Math.round(len / 1.4));
  const ang = Math.atan2(x1 - x0, z1 - z0);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    M.cyl('metal', x0 + (x1 - x0) * t, y, z0 + (z1 - z0) * t, 0.03, h, color, 6);
  }
  const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
  M.add('metal', new THREE.CylinderGeometry(0.03, 0.03, len, 6), { pos: v(mx, y + h, mz), rot: e(Math.PI / 2, ang, 0), color });
  M.add('metal', new THREE.CylinderGeometry(0.02, 0.02, len, 6), { pos: v(mx, y + h * 0.5, mz), rot: e(Math.PI / 2, ang, 0), color });
}

export function stairs(M, x, z, w, rise, steps, dir = -1, color = C.G2) {
  const run = 0.3;
  for (let i = 0; i < steps; i++) {
    const y1 = rise * (i + 1) / steps;
    const zz = z + dir * (steps - i - 0.5) * run;
    M.bb('metal', x - w / 2, y1 - rise / steps, zz - run / 2, x + w / 2, y1, zz + run / 2, color);
  }
}

export function antenna(M, x, y, z, h = 3, light = L.red) {
  M.cyl('metal', x, y, z, 0.05, h, C.G, 6, 0.025);
  M.cyl('metal', x, y, z, 0.12, 0.15, C.D, 8);
  M.sphere('blink', x, y + h + 0.06, z, 0.08, light, 8);
}

export function vent(M, x, y, z, w = 1, d = 0.7, h = 0.5, rot = 0) {
  M.box('metal', x, y + h / 2, z, w, h, d, C.G2, rot);
  for (let i = 0; i < 4; i++) M.box('metal', x, y + h + 0.04, z - d / 2 + (i + 0.5) * d / 4, w * 0.92, 0.04, 0.05, C.D, rot);
}

export function tank(M, x, y, z, r, h, color = C.W2, bandColor = C.O) {
  M.cyl('hull', x, y, z, r, h, color, 18);
  M.sphere('hull', x, y + h, z, r, color, 18, 0.5);
  M.cyl('metal', x, y + h * 0.3, z, r + 0.03, 0.12, bandColor === C.O ? C.D : bandColor, 18);
  M.cyl('hull', x, y + h * 0.7, z, r + 0.02, 0.18, bandColor, 18);
}

export function pipe(M, pts, r = 0.12, color = C.G) {
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const len = Math.hypot(dx, dy, dz);
    const g = new THREE.CylinderGeometry(r, r, len, 10);
    const q = new THREE.Quaternion().setFromUnitVectors(v(0, 1, 0), v(dx / len, dy / len, dz / len));
    const m = new THREE.Matrix4().compose(v((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), q, v(1, 1, 1));
    M.gb('metal').add(g, { matrix: m, color });
    if (i > 0) M.sphere('metal', a[0], a[1], a[2], r * 1.25, color, 10);
    if (i === 0 || i === pts.length - 2) {
      const f = i === 0 ? a : b;
      M.sphere('metal', f[0], f[1], f[2], r * 1.35, C.D, 10);
    }
  }
}

export function lightBar(M, x, y, z, w, h, d, color = L.warm) { M.box('emissive', x, y, z, w, h, d, color); }

// Wall along X (axis 'x') or Z (axis 'z') starting at (x,z), length len, with openings
// [{a, b, y0, y1, kind:'door'|'window'}] in local wall coordinates (a..b along wall).
export function wall(M, axis, x, z, len, h, t, openings = [], { key = 'hull', color = C.W, inner = C.IN1, collide = true, frameColor = C.G2 } = {}) {
  const cuts = new Set([0, len]);
  for (const o of openings) { cuts.add(o.a); cuts.add(o.b); }
  const xs = [...cuts].sort((p, q) => p - q);
  const seg = (a, b, y0, y1, solidCol) => {
    if (b - a < 1e-3 || y1 - y0 < 1e-3) return;
    const ca = a, cb = b;
    let bx0, bx1, bz0, bz1;
    if (axis === 'x') { bx0 = x + ca; bx1 = x + cb; bz0 = z - t / 2; bz1 = z + t / 2; }
    else { bz0 = z + ca; bz1 = z + cb; bx0 = x - t / 2; bx1 = x + t / 2; }
    M.bb(key, bx0, y0, bz0, bx1, y1, bz1, color);
    if (collide && solidCol) M.col(bx0, y0, bz0, bx1, y1, bz1);
  };
  for (let i = 0; i < xs.length - 1; i++) {
    const a = xs[i], b = xs[i + 1];
    const mid = (a + b) / 2;
    const o = openings.find((q) => mid > q.a && mid < q.b);
    if (!o) { seg(a, b, 0, h, true); continue; }
    seg(a, b, 0, o.y0, true);
    seg(a, b, o.y1, h, true);
    if (o.kind === 'window') {
      // invisible collider across the window + glass + frame
      if (collide) {
        if (axis === 'x') M.col(x + a, o.y0, z - t / 2, x + b, o.y1, z + t / 2);
        else M.col(x - t / 2, o.y0, z + a, x + t / 2, o.y1, z + b);
      }
      const gw = b - a, gh = o.y1 - o.y0;
      if (axis === 'x') {
        M.add('window', new THREE.PlaneGeometry(gw, gh), { pos: v(x + mid, (o.y0 + o.y1) / 2, z) });
        M.bb('metal', x + a, o.y0 - 0.05, z - t / 2 - 0.03, x + b, o.y0 + 0.02, z + t / 2 + 0.03, frameColor);
        M.bb('metal', x + mid - 0.03, o.y0, z - 0.04, x + mid + 0.03, o.y1, z + 0.04, frameColor);
      } else {
        M.add('window', new THREE.PlaneGeometry(gw, gh), { pos: v(x, (o.y0 + o.y1) / 2, z + mid), rot: e(0, Math.PI / 2, 0) });
        M.bb('metal', x - t / 2 - 0.03, o.y0 - 0.05, z + a, x + t / 2 + 0.03, o.y0 + 0.02, z + b, frameColor);
        M.bb('metal', x - 0.04, o.y0, z + mid - 0.03, x + 0.04, o.y1, z + mid + 0.03, frameColor);
      }
    } else if (o.kind === 'door') {
      // door frame
      if (axis === 'x') {
        M.bb('metal', x + a - 0.08, 0, z - t / 2 - 0.05, x + a, o.y1 + 0.08, z + t / 2 + 0.05, frameColor);
        M.bb('metal', x + b, 0, z - t / 2 - 0.05, x + b + 0.08, o.y1 + 0.08, z + t / 2 + 0.05, frameColor);
        M.bb('metal', x + a, o.y1, z - t / 2 - 0.05, x + b, o.y1 + 0.08, z + t / 2 + 0.05, frameColor);
        lightBar(M, x + mid, o.y1 + 0.16, z - t / 2 - 0.06, b - a - 0.2, 0.06, 0.04, L.cyan);
      } else {
        M.bb('metal', x - t / 2 - 0.05, 0, z + a - 0.08, x + t / 2 + 0.05, o.y1 + 0.08, z + a, frameColor);
        M.bb('metal', x - t / 2 - 0.05, 0, z + b, x + t / 2 + 0.05, o.y1 + 0.08, z + b + 0.08, frameColor);
        M.bb('metal', x - t / 2 - 0.05, o.y1, z + a, x + t / 2 + 0.05, o.y1 + 0.08, z + b, frameColor);
      }
      // sliding door leaves
      const half = (b - a) / 2;
      const door = { key: 'hull', gb: new GeoBuilder(), slide: axis === 'x' ? [-half, 0, 0] : [0, 0, -half], x: axis === 'x' ? x + mid : x, z: axis === 'x' ? z : z + mid };
      const door2 = { key: 'hull', gb: new GeoBuilder(), slide: axis === 'x' ? [half, 0, 0] : [0, 0, half], x: door.x, z: door.z };
      const dh = o.y1 - 0.02;
      const stripe = (lx, ly) => (ly > dh * 0.45 && ly < dh * 0.52 ? [0.94, 0.46, 0.1] : [0.82, 0.82, 0.8]);
      if (axis === 'x') {
        door.gb.add(new THREE.BoxGeometry(half, dh, 0.08), { pos: v(x + a + half / 2, dh / 2, z), color: (lx, ly) => stripe(lx, ly + dh / 2) });
        door2.gb.add(new THREE.BoxGeometry(half, dh, 0.08), { pos: v(x + a + half * 1.5, dh / 2, z), color: (lx, ly) => stripe(lx, ly + dh / 2) });
      } else {
        door.gb.add(new THREE.BoxGeometry(0.08, dh, half), { pos: v(x, dh / 2, z + a + half / 2), color: (lx, ly) => stripe(lx, ly + dh / 2) });
        door2.gb.add(new THREE.BoxGeometry(0.08, dh, half), { pos: v(x, dh / 2, z + a + half * 1.5), color: (lx, ly) => stripe(lx, ly + dh / 2) });
      }
      M.doors.push(door, door2);
    }
  }
  // inner face colour strip (interior panels) for enterable rooms
  if (inner && h > 2) {
    const off = t / 2 + 0.005;
    void off;
  }
}

// Simple 4-wall room: front wall (z = -d/2) has the door at centre.
export function room(M, w, d, h, { t = 0.24, door = 1.8, doorH = 2.5, winFront = [], winSide = 2, winBack = 2, color = C.W, roof = true, roofColor = C.W2, inner = true } = {}) {
  const hw = w / 2, hd = d / 2;
  const fo = [{ a: hw - door / 2, b: hw + door / 2, y0: 0, y1: doorH, kind: 'door' }, ...winFront];
  wall(M, 'x', -hw, -hd, w, h, t, fo, { color });
  const wins = (n, len) => {
    const out = [];
    for (let i = 0; i < n; i++) { const c = len * (i + 1) / (n + 1); out.push({ a: c - 0.7, b: c + 0.7, y0: 0.95, y1: 2.15, kind: 'window' }); }
    return out;
  };
  wall(M, 'x', -hw, hd, w, h, t, wins(winBack, w), { color });
  wall(M, 'z', -hw, -hd + t / 2, d - t, h, t, wins(winSide, d - t), { color });
  wall(M, 'z', hw, -hd + t / 2, d - t, h, t, wins(winSide, d - t), { color });
  if (roof) {
    M.bb('hull', -hw - 0.15, h, -hd - 0.15, hw + 0.15, h + 0.3, hd + 0.15, roofColor);
    M.col(-hw, h, -hd, hw, h + 0.3, hd);
    M.bb('metal', -hw - 0.2, h + 0.3, -hd - 0.2, hw + 0.2, h + 0.38, hd + 0.2, C.G2);
  }
  if (inner) {
    // interior lining + ceiling panel + floor finish (slightly above structure to avoid z-fighting)
    M.bb('interior', -hw + t / 2, 0.0, -hd + t / 2, hw - t / 2, 0.02, hd - t / 2, C.FLOOR);
    M.bb('interior', -hw + t / 2, h - 0.08, -hd + t / 2, hw - t / 2, h - 0.02, hd - t / 2, C.IN1);
    lightBar(M, 0, h - 0.11, 0, Math.min(w - 2, 4), 0.04, 0.25, 0xfff2e0);
    M.interior(-hw + t, 0, -hd + t, hw - t, h, hd - t);
    M.light(0, h - 0.6, 0, 0xfff0e0, 2.2, Math.max(w, d) * 1.3);
  }
}

// ---------------------------------------------------------------- sci-fi kit
// Horizontal pressurised module (cylinder with domed caps) along X, ribs and portholes.
export function podModule(M, x, y, z, len, r, { color = C.W, rib = C.G2, accent = C.O, ports = 3, rot = 0, legs = true, axis = 'x' } = {}) {
  const prof = [];
  const cap = r * 0.55;
  for (let i = 0; i <= 8; i++) { const a = i / 8 * Math.PI / 2; prof.push(new THREE.Vector2(Math.sin(a) * r, -len / 2 - cap + (1 - Math.cos(a)) * cap)); }
  for (let i = 0; i <= 8; i++) { const a = i / 8 * Math.PI / 2; prof.push(new THREE.Vector2(Math.cos(a) * r, len / 2 + Math.sin(a) * cap)); }
  const body = new THREE.LatheGeometry(prof, 28);
  const R = axis === 'x' ? e(0, rot, Math.PI / 2) : e(Math.PI / 2, rot, 0);
  const mat = new THREE.Matrix4().compose(v(x, y, z), new THREE.Quaternion().setFromEuler(R), v(1, 1, 1));
  M.gb('hull').add(body, { matrix: mat, color });
  const n = Math.max(2, Math.round(len / 1.8));
  for (let i = 0; i <= n; i++) {
    const t = -len / 2 + i * len / n;
    const ring = new THREE.TorusGeometry(r + 0.02, 0.07, 6, 28);
    ring.rotateX(Math.PI / 2);
    ring.translate(0, t, 0);
    M.gb('metal').add(ring, { matrix: mat, color: i === 0 || i === n ? accent : rib });
  }
  // portholes on the side facing -z (local), round frames
  for (let i = 0; i < ports; i++) {
    const t = -len / 2 + (i + 0.5) * len / ports;
    const wg = new THREE.CylinderGeometry(r * 0.26, r * 0.26, 0.06, 18);
    wg.rotateX(Math.PI / 2); wg.translate(0, t, -r + 0.01);
    M.gb('glass').add(wg, { matrix: mat });
    const fr = new THREE.TorusGeometry(r * 0.27, 0.045, 6, 18);
    fr.translate(0, t, -r - 0.015);
    M.gb('metal').add(fr, { matrix: mat, color: C.G2 });
    const wg2 = wg.clone(); wg2.translate(0, 0, 2 * r - 0.02);
    M.gb('glass').add(wg2, { matrix: mat });
  }
  // belly stripe + sensor bumps
  const stripe = new THREE.BoxGeometry(r * 0.5, len * 0.9, 0.05); stripe.translate(0, 0, r - 0.01);
  M.gb('hull').add(stripe, { matrix: new THREE.Matrix4().multiplyMatrices(mat, new THREE.Matrix4().makeRotationY(Math.PI / 2)), color: accent });
  if (legs) {
    for (const t of [-len / 2 + 0.4, len / 2 - 0.4]) for (const sd of [-1, 1]) {
      const lx = axis === 'x' ? t : sd * r * 0.7, lz = axis === 'x' ? sd * r * 0.7 : t;
      const c = Math.cos(rot), s2 = Math.sin(rot);
      const wx = x + lx * c + lz * s2, wz = z - lx * s2 + lz * c;
      M.cyl('metal', wx, 0, wz, 0.1, y - r * 0.6, C.G2, 8);
      M.cyl('metal', wx, 0, wz, 0.28, 0.12, C.D, 10);
    }
  }
}

// Dome with meridian ribs and a base ring.
export function ribDome(M, x, y, z, r, { key = 'window', ribs = 8, rib = C.W2, base = C.G2, sy = 1 } = {}) {
  M.add(key, new THREE.SphereGeometry(r, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), { pos: v(x, y, z), scale: v(1, sy, 1), color: key === 'window' ? undefined : C.W });
  for (let i = 0; i < ribs; i++) {
    const g = new THREE.TorusGeometry(r + 0.03, 0.05, 5, 18, Math.PI / 2);
    g.rotateZ(0); g.scale(1, sy, 1);
    M.add('metal', g, { pos: v(x, y, z), rot: e(0, i / ribs * Math.PI * 2, 0), color: rib });
  }
  M.add('metal', new THREE.TorusGeometry(r + 0.04, 0.09, 6, 32), { pos: v(x, y + 0.04, z), rot: e(Math.PI / 2, 0, 0), color: base });
  M.cyl('metal', x, y + r * sy - 0.05, z, r * 0.12, 0.12, C.G2, 10);
}

// Round window with a chunky frame on a wall facing direction `dir` (+1: +z, -1: -z) or along x.
export function porthole(M, x, y, z, r, face = '-z') {
  const rot = face === '-z' || face === '+z' ? e(Math.PI / 2, 0, 0) : e(0, 0, Math.PI / 2);
  M.add('glass', new THREE.CylinderGeometry(r, r, 0.08, 18), { pos: v(x, y, z), rot });
  const tr = face === '-z' || face === '+z' ? e(0, 0, 0) : e(0, Math.PI / 2, 0);
  M.add('metal', new THREE.TorusGeometry(r + 0.02, 0.05, 6, 20), { pos: v(x, y, z + (face === '-z' ? -0.04 : face === '+z' ? 0.04 : 0)), rot: tr, color: C.G2 });
}

// Lattice truss between two points (two rails + zig-zag)
export function truss(M, a, b, w = 0.4, color = C.G) {
  const A = v(...a), B = v(...b);
  const dir = B.clone().sub(A); const len = dir.length(); dir.normalize();
  const side = Math.abs(dir.y) > 0.9 ? v(1, 0, 0) : v(0, 1, 0).cross(dir).normalize().multiplyScalar(w / 2);
  const up = dir.clone().cross(side).normalize().multiplyScalar(w / 2);
  const rails = [side.clone().add(up), side.clone().sub(up), side.clone().negate().add(up), side.clone().negate().sub(up)];
  for (const o of rails) pipe(M, [[A.x + o.x, A.y + o.y, A.z + o.z], [B.x + o.x, B.y + o.y, B.z + o.z]], 0.035, color);
  const n = Math.max(2, Math.round(len / (w * 1.4)));
  for (let i = 0; i < n; i++) {
    const p0 = A.clone().addScaledVector(dir, len * i / n), p1 = A.clone().addScaledVector(dir, len * (i + 1) / n);
    const o0 = rails[i % 2 ? 0 : 1], o1 = rails[i % 2 ? 1 : 0];
    pipe(M, [[p0.x + o0.x, p0.y + o0.y, p0.z + o0.z], [p1.x + o1.x, p1.y + o1.y, p1.z + o1.z]], 0.02, color);
  }
}

// Radiator / heat-rejection panel: thin fins with a frame
export function radiator(M, x, y, z, w, h, rot = 0, color = C.W2) {
  const c = Math.cos(rot), s = Math.sin(rot);
  const n = Math.max(3, Math.round(w / 0.28));
  for (let i = 0; i < n; i++) {
    const lx = -w / 2 + (i + 0.5) * w / n;
    M.box('metal', x + lx * c, y + h / 2, z - lx * s, 0.05, h, 0.6, color, rot);
  }
  M.box('metal', x, y + h, z, w + 0.1, 0.08, 0.66, C.G2, rot);
  M.box('metal', x, y, z, w + 0.1, 0.08, 0.66, C.G2, rot);
}

// Scatter small machinery details on a horizontal roof rectangle
export function greebleRoof(M, x0, z0, x1, z1, y, seed, n = 6) {
  const rnd = mulberry32(seed);
  for (let i = 0; i < n; i++) {
    const w = 0.4 + rnd() * 1.0, d = 0.4 + rnd() * 0.9, h = 0.2 + rnd() * 0.5;
    const x = x0 + w / 2 + rnd() * Math.max(0.01, x1 - x0 - w), z = z0 + d / 2 + rnd() * Math.max(0.01, z1 - z0 - d);
    const k = rnd();
    if (k < 0.35) vent(M, x, y, z, w, d, h * 0.7);
    else if (k < 0.6) { M.cyl('metal', x, y, z, Math.min(w, d) * 0.4, h * 1.4, C.G, 12); M.cyl('metal', x, y + h * 1.4, z, Math.min(w, d) * 0.45, 0.06, C.D, 12); }
    else if (k < 0.8) { M.box('hull', x, y + h / 2, z, w, h, d, C.W2); M.box('emissive', x, y + h * 0.6, z - d / 2 - 0.01, w * 0.5, 0.05, 0.02, L.cyan); }
    else antenna(M, x, y, z, 0.8 + rnd() * 1.6, rnd() < 0.5 ? L.red : L.green);
  }
}

// Airlock vestibule in front of a door on the -z face at z=zf
export function airlock(M, x, zf, w = 2.4, h = 2.9, depth = 1.6, color = C.W2) {
  const z = zf - depth / 2;
  M.box('hull', x - w / 2 - 0.12, h / 2, z, 0.24, h, depth, color);
  M.box('hull', x + w / 2 + 0.12, h / 2, z, 0.24, h, depth, color);
  M.box('hull', x, h + 0.14, z, w + 0.48, 0.28, depth + 0.1, color);
  M.box('hull', x, h + 0.32, z - depth / 2 + 0.1, w + 0.6, 0.1, 0.25, C.O);
  for (const sx of [-1, 1]) M.box('metal', x + sx * (w / 2 + 0.26), h / 2, zf - depth + 0.05, 0.12, h + 0.2, 0.18, C.G2);
  M.box('emissive', x, h - 0.08, zf - depth + 0.02, w * 0.7, 0.06, 0.03, L.cyan);
  hazard(M, x, 0.02, zf - depth / 2, w, 0.04, depth * 0.6);
  M.col(x - w / 2 - 0.24, 0, z - depth / 2, x - w / 2, h, z + depth / 2);
  M.col(x + w / 2, 0, z - depth / 2, x + w / 2 + 0.24, h, z + depth / 2);
  M.col(x - w / 2 - 0.24, h, z - depth / 2, x + w / 2 + 0.24, h + 0.4, z + depth / 2);
  M.light(x, h - 0.4, zf - depth * 0.6, L.cyan, 1.2, 4);
}

// ---------------------------------------------------------------- printed-regolith architecture
// Catenary dome (Foster + Partners / ESA lunar base): lathe of an inverted catenary
export function catenaryDome(M, x, y, z, r, h, { key = 'printed', color = C.REG, seg = 40 } = {}) {
  const prof = [];
  const k = 1.7, ch = Math.cosh(k) - 1;
  for (let i = 0; i <= 18; i++) {
    const t = i / 18;
    const rr = r * (1 - t);
    prof.push(new THREE.Vector2(Math.max(0.001, rr), y + h * (1 - (Math.cosh(k * (1 - t)) - 1) / ch)));
  }
  prof.reverse();
  // build from apex down so the lathe faces outward
  M.add(key, new THREE.LatheGeometry(prof.slice().reverse().map((p) => p).reverse(), seg), { pos: v(x, 0, z), color });
  return (t) => y + h * (1 - (Math.cosh(k * t) - 1) / ch);
}

// MARSHA-like egg tower: printed outer shell profile (radius by height)
export function eggProfile(rMax, H, rTop = 0.25) {
  return (y) => { const t = Math.min(1, Math.max(0, y / H)); return rMax * Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.82 + 0.18)), 0.75) * (1 - t * 0.25) + rTop * t; };
}
export function lathe(M, key, fn, H, color, seg = 40, steps = 24, y0 = 0) {
  const prof = [];
  for (let i = 0; i <= steps; i++) { const y = y0 + (H - y0) * i / steps; prof.push(new THREE.Vector2(Math.max(0.02, fn(y)), y)); }
  M.add(key, new THREE.LatheGeometry(prof, seg), { color });
}

// regolith berm ring hugging a structure's base (radiation / thermal mass)
export function berm(M, x, z, r, h = 0.9, color = C.BERM) {
  const g = new THREE.TorusGeometry(r, h, 8, 48);
  g.rotateX(Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const yy = p.getY(i);
    p.setY(i, Math.max(-0.4, yy) * 0.75);
    const a = Math.atan2(p.getZ(i), p.getX(i));
    const k = 1 + 0.08 * Math.sin(a * 7) + 0.05 * Math.sin(a * 17 + 1.3);
    p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k);
  }
  g.computeVertexNormals();
  M.add('berm', g, { pos: v(x, 0, z), color });
}

// deep-set window on a curved shell: dark reveal + glass + thin frame, facing angle a (0 = +z)
export function recessedWindow(M, x, y, z, a, w, h) {
  const R = e(0, a, 0);
  const off = (d) => v(x + Math.sin(a) * d, y, z + Math.cos(a) * d);
  M.add('metal', new THREE.BoxGeometry(w + 0.16, h + 0.16, 0.5), { pos: off(-0.05), rot: R, color: C.D });
  M.add('glass', new THREE.BoxGeometry(w, h, 0.04), { pos: off(0.12), rot: R });
  M.add('metal', new THREE.BoxGeometry(w + 0.24, 0.07, 0.22), { pos: v(x + Math.sin(a) * 0.2, y - h / 2 - 0.08, z + Math.cos(a) * 0.2), rot: R, color: C.G2 });
}

export { v, e };
