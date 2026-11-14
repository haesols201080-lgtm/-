// Model kit used by every building model: parts grouped by material,
// colliders, interior volumes and light points, plus reusable details
// (plinths, walls with real openings, railings, stairs, pipes, tanks,
// antennas, hazard stripes...).
import * as THREE from 'three';
import { GeoBuilder, taperTube } from '../core/geobuilder.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mulberry32 } from '../core/noise.js';
import { ASSETS } from './assets.js';

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
  O: 0x3b4046, MOD: 0xdedbd4, Y: 0xf2c22e, TEAL: 0x2bb3a6, BLUE: 0x3d76c9, RED: 0xc8382c, GREEN: 0x3fa35a,
  CONC: 0xbdb7ad, CONC2: 0x8f887d, ASPH: 0x2b2b2d, WOOD: 0x8a6a4a, CREAM: 0xefe3c8, TERRA: 0xc0683f,
  IN1: 0xe9e6df, IN2: 0x9aa3a8, FLOOR: 0x6f7378,
};
export const REGOLITH = 0x7f5d49;   // sintered regolith, the colony's ground-level material
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
    this.entries = null;       // local x of front entrances (stairs land here)
    this.assets = [];          // real hardware models: {geo, material, anim}
    this.vents = [];           // exhaust / vapour vents {x, y, z, rate, size, kind}
    this.top = 0;
  }

  gb(key) {
    if (!this.groups.has(key)) this.groups.set(key, new GeoBuilder([], { pan: true, uv: key === 'beam' }));
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
    const soft = (key === 'hull' || key === 'shell' || key === 'metal' || key === 'interior' || key === 'concrete' || key === 'stone' || key === 'brick') && Math.min(w, h, d) >= 0.12 && !this.sharp;
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
    const gb = new GeoBuilder([], { pan: true });
    gb.add(geo, opts);
    this.anims.push({ key, gb, anim });
    return gb;
  }
  animGroup(key, anim) {
    const gb = new GeoBuilder([], { pan: true });
    this.anims.push({ key, gb, anim });
    return gb;
  }

  // a real hardware model from assets.js (its own textured material), set at
  // (x, y, z), turned by rotY and scaled uniformly; anim turns it like
  // animGroup, except the parts whose material name matches `fixed`
  // `ground` sets the model's lowest point on y
  asset(name, x, y, z, { rotY = 0, scale = 1, anim = null, fixed = null, ground = false } = {}) {
    const A = ASSETS[name];
    if (!A) return this;
    if (ground) y -= A.box.min.y * scale;
    const m = new THREE.Matrix4().compose(v(x, y, z), new THREE.Quaternion().setFromAxisAngle(v(0, 1, 0), rotY), v(scale, scale, scale));
    for (const g of A.groups) {
      const geo = g.geo.clone().applyMatrix4(m);
      geo.computeBoundingBox(); geo.computeBoundingSphere();
      this.assets.push({ geo, material: g.material, anim: fixed && fixed.test(g.material.name) ? null : anim });
    }
    const top = y + A.box.max.y * scale;
    if (top > this.top) this.top = top;
    return this;
  }

  // a vent that breathes vapour or exhaust while the building runs
  vent(x, y, z, { rate = 1, size = 1, kind = 'steam' } = {}) { this.vents.push({ x, y, z, rate, size, kind }); return this; }

  col(x0, y0, z0, x1, y1, z1, flags = {}) {
    this.colliders.push({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, hx: Math.abs(x1 - x0) / 2, hz: Math.abs(z1 - z0) / 2, y0: Math.min(y0, y1), y1: Math.max(y0, y1), ...flags });
  }
  colCyl(x, z, r, y0, y1, flags = {}) { this.colliders.push({ cyl: true, x, z, r, y0, y1, ...flags }); }
  interior(x0, y0, z0, x1, y1, z1) { this.interiors.push({ x0, y0, z0, x1, y1, z1 }); }
  light(x, y, z, color = L.warm, intensity = 6, dist = 12) { this.lights.push({ x, y, z, color, intensity, dist }); }
  entry(x) { (this.entries = this.entries || []).push(x); }

  finish() {
    const parts = [];
    for (const [key, gb] of this.groups) if (!gb.empty) parts.push({ key, geo: gb.build() });
    for (const a of this.anims) if (!a.gb.empty) parts.push({ key: a.key, geo: a.gb.build(), anim: a.anim });
    for (const d of this.doors) if (!d.gb.empty) parts.push({ key: d.key, geo: d.gb.build(), anim: { slide: d.slide }, door: true });
    for (const a of this.assets) parts.push(a.anim ? { key: 'asset', geo: a.geo, material: a.material, anim: a.anim } : { key: 'asset', geo: a.geo, material: a.material });
    return { parts, colliders: this.colliders, interiors: this.interiors, lights: this.lights, doors: this.doors.map((d) => ({ x: d.x, z: d.z })), entries: this.entries, vents: this.vents, height: this.top };
  }
}

// ---------------------------------------------------------------- details
// Base of every building. Small ones sit on a concrete pad (skirt buried);
// anything 3 m or more stands on a steel deck carried by legs (supports.js):
// plated deck, edge channel and a beam grid underneath. Floor at y = 0.
export function plinth(M, w, d, { color = C.CONC, trim = C.G2, collide = true } = {}) {
  if (Math.min(w, d) < 3) {
    M.bb('concrete', -w / 2, -2.4, -d / 2, w / 2, 0, d / 2, color);
    M.bb('metal', -w / 2 - 0.04, -0.12, -d / 2 - 0.04, w / 2 + 0.04, -0.02, d / 2 + 0.04, trim);
    if (collide) M.col(-w / 2, -2.4, -d / 2, w / 2, 0, d / 2);
    return;
  }
  // sintered regolith pad: the deck's top in the colour of the ground, a
  // sloped skirt running down into the terrain so the building sits in the
  // land rather than on a board, and a structural edge beam under the lip
  const r = Math.min(1.2, Math.min(w, d) * 0.15);
  const top = new THREE.ExtrudeGeometry(roundRect(w, d, r), { depth: 0.22, bevelEnabled: false, curveSegments: 8 });
  top.rotateX(-Math.PI / 2);
  M.add('regolith', top, { pos: v(0, -0.22, 0), color: 0x75594a });
  // skirt: a frustum from the deck edge down and out
  const skirt = new THREE.ExtrudeGeometry(roundRect(w, d, r), { depth: 0.01, bevelEnabled: true, bevelThickness: 1.2, bevelSize: 0.7, bevelSegments: 1, curveSegments: 8 });
  skirt.rotateX(-Math.PI / 2);
  M.add('regolith', skirt, { pos: v(0, -1.45, 0), color: 0x6a4e3e });
  const sharp = M.sharp; M.sharp = true;
  const nb = Math.max(1, Math.round(d / 2.4));
  for (let i = 1; i < nb; i++) { const z = -d / 2 + i * d / nb; M.bb('metal', -w / 2 + 0.3, -0.5, z - 0.08, w / 2 - 0.3, -0.22, z + 0.08, 0x5b6168); }
  for (const sx of [-1, 1]) M.bb('metal', sx * (w / 2 - 0.45) - 0.1, -0.5, -d / 2 + 0.3, sx * (w / 2 - 0.45) + 0.1, -0.22, d / 2 - 0.3, 0x5b6168);
  M.sharp = sharp;
  if (collide) M.col(-w / 2, -0.45, -d / 2, w / 2, 0, d / 2);
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
      const door = { key: 'hull', gb: new GeoBuilder([], { pan: true }), slide: axis === 'x' ? [-half, 0, 0] : [0, 0, -half], x: axis === 'x' ? x + mid : x, z: axis === 'x' ? z : z + mid };
      const door2 = { key: 'hull', gb: new GeoBuilder([], { pan: true }), slide: axis === 'x' ? [half, 0, 0] : [0, 0, half], x: door.x, z: door.z };
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
export function room(M, w, d, h, { t = 0.24, door = 1.8, doorH = 2.5, winFront = [], winSide = 2, winBack = 2, color = C.W, roof = true, roofColor = C.W2, inner = true, key = 'hull' } = {}) {
  const hw = w / 2, hd = d / 2;
  const fo = [{ a: hw - door / 2, b: hw + door / 2, y0: 0, y1: doorH, kind: 'door' }, ...winFront];
  wall(M, 'x', -hw, -hd, w, h, t, fo, { color, key });
  const wins = (n, len) => {
    const out = [];
    for (let i = 0; i < n; i++) { const c = len * (i + 1) / (n + 1); out.push({ a: c - 0.7, b: c + 0.7, y0: 0.95, y1: 2.15, kind: 'window' }); }
    return out;
  };
  wall(M, 'x', -hw, hd, w, h, t, wins(winBack, w), { color, key });
  wall(M, 'z', -hw, -hd + t / 2, d - t, h, t, wins(winSide, d - t), { color, key });
  wall(M, 'z', hw, -hd + t / 2, d - t, h, t, wins(winSide, d - t), { color, key });
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
  // feet down to whatever it stands on
  for (const sx of [-1, 1]) {
    const lx = sx * (w / 2 - 0.05);
    M.box('metal', x + lx * c, y - 0.17, z - lx * s, 0.1, 0.36, 0.6, C.D, rot);
  }
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
  for (const sx of [-1, 1]) M.add('hull', new THREE.BoxGeometry(0.24, h, depth), { pos: v(x + sx * (w / 2 + 0.12), h / 2, z), color });
  M.add('hull', new THREE.BoxGeometry(w + 0.78, 0.22, depth + 0.6), { pos: v(x, h + 0.11, z - 0.3), color: C.W2 });
  M.add('metal', new THREE.BoxGeometry(w + 0.82, 0.05, depth + 0.64), { pos: v(x, h + 0.245, z - 0.3), color: C.G2 });
  for (const sx of [-1, 1]) M.add('metal', new THREE.BoxGeometry(0.08, h, 0.1), { pos: v(x + sx * (w / 2 + 0.02), h / 2, zf - depth + 0.05), color: C.D });
  M.add('emissive', new THREE.BoxGeometry(0.5, 0.02, 0.2), { pos: v(x, h - 0.005, zf - depth - 0.25), color: L.warm });
  M.add('concrete', new THREE.BoxGeometry(w, 0.03, depth + 0.8), { pos: v(x, 0.015, z - 0.4), color: C.CONC2 });
  M.col(x - w / 2 - 0.24, 0, z - depth / 2, x - w / 2, h, z + depth / 2);
  M.col(x + w / 2, 0, z - depth / 2, x + w / 2 + 0.24, h, z + depth / 2);
  M.col(x - w / 2 - 0.24, h, z - depth / 2, x + w / 2 + 0.24, h + 0.4, z + depth / 2);
  M.light(x, h - 0.4, zf - depth * 0.6, L.warm, 1.2, 4);
}

// ---------------------------------------------------------------- Mars-city kit
// White composite habitat language after the SpaceX Mars city concept:
// domed hab units on drum walls, cylinder towers with dark ribbon glazing,
// glass garden domes and pressurised link tubes.
const PI2 = Math.PI / 2;
const TAU = Math.PI * 2;

// Flat window set into a round wall: pane recessed behind the face, slim
// frame and mullion, reveals (jambs), a protruding sill and a lintel.
// Faces angle a (0 = +z) from the wall centre (cx, cz).
export function wallWindow(M, cx, cz, r, a, y, w, h, { depth = 0.24, split = true, trim = C.W2 } = {}) {
  const q = new THREE.Quaternion().setFromEuler(e(0, a, 0));
  const R = e(0, a, 0);
  const add = (key, geo, lx, ly, lz, color) => M.add(key, geo, { pos: v(lx, ly, lz).applyQuaternion(q).add(v(cx, 0, cz)), rot: R, color });
  const rp = Math.sqrt(Math.max(0.01, r * r - w * w / 4)) - depth;
  const dm = r + 0.03 - rp, rm = rp + dm / 2;
  add('glass', new THREE.BoxGeometry(w, h, 0.04), 0, y + h / 2, rp);
  for (const sx of [-1, 1]) add('hull', new THREE.BoxGeometry(0.07, h + 0.02, dm), sx * (w / 2 + 0.035), y + h / 2, rm, trim);
  add('hull', new THREE.BoxGeometry(w + 0.2, 0.07, dm + 0.1), 0, y - 0.035, rm + 0.05, trim);
  add('hull', new THREE.BoxGeometry(w + 0.14, 0.1, dm), 0, y + h + 0.05, rm, trim);
  const fz = rp + 0.035;
  add('metal', new THREE.BoxGeometry(w, 0.05, 0.05), 0, y + 0.025, fz, C.D);
  add('metal', new THREE.BoxGeometry(w, 0.05, 0.05), 0, y + h - 0.025, fz, C.D);
  for (const sx of [-1, 1]) add('metal', new THREE.BoxGeometry(0.05, h, 0.05), sx * (w / 2 - 0.025), y + h / 2, fz, C.D);
  if (split) add('metal', new THREE.BoxGeometry(0.04, h, 0.045), 0, y + h / 2, fz, C.D);
}

// One storey of round wall with punched windows: solid below the sill and
// above the head, piers between openings. wins: [{a, w, y?, h?}] (y, h relative).
export function roundStorey(M, x, z, r, y0, y1, wins, { sill = 0.9, head = 2.25, color = C.W, seg = 48, trim = C.W2 } = {}) {
  const TAU2 = Math.PI * 2;
  const ws = wins.map((o) => ({ ...o, a: ((o.a % TAU2) + TAU2) % TAU2, y: o.y ?? sill, h: o.h ?? head - sill }));
  ws.sort((p, q) => p.a - q.a);
  const lo = Math.min(sill, ...ws.map((o) => o.y)), hi = Math.max(head, ...ws.map((o) => o.y + o.h));
  const cyl = (ya, yb, t0, tl) => {
    if (yb - ya < 1e-3 || tl < 1e-3) return;
    const n = Math.max(2, Math.ceil(seg * tl / TAU2));
    M.add('hull', new THREE.CylinderGeometry(r, r, yb - ya, n, 1, true, t0, tl), { pos: v(x, y0 + (ya + yb) / 2, z), color });
  };
  cyl(0, lo, 0, TAU2);
  cyl(hi, y1 - y0, 0, TAU2);
  if (!ws.length) { cyl(lo, hi, 0, TAU2); return; }
  for (let i = 0; i < ws.length; i++) {
    const o = ws[i], nx = ws[(i + 1) % ws.length];
    const ha = Math.asin(Math.min(0.95, o.w / 2 / r)), hb = Math.asin(Math.min(0.95, nx.w / 2 / r));
    let t0 = o.a + ha, t1 = nx.a - hb + (i === ws.length - 1 ? TAU2 : 0);
    cyl(lo, hi, t0, t1 - t0);
    // wall above/below windows shorter than the band
    if (o.y > lo) cyl(lo, o.y, o.a - ha, 2 * ha);
    if (o.y + o.h < hi) cyl(o.y + o.h, hi, o.a - ha, 2 * ha);
    wallWindow(M, x, z, r, o.a, y0 + o.y, o.w, o.h, { trim, split: o.w > 0.9 });
  }
}

// Continuous metal railing along a polyline of world points (at walking
// level): posts at every vertex and ~1.2 m, top and bottom rails, balusters.
export function rail(M, pts, h = 1.0, { color = C.G2, gap = 0.14 } = {}) {
  const bar = (a, b, rr) => {
    const d = b.clone().sub(a), len = d.length();
    if (len < 1e-3) return;
    const g = new THREE.CylinderGeometry(rr, rr, len, 6);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(v(0, 1, 0), d.normalize()));
    M.add('metal', g, { pos: a.clone().add(b).multiplyScalar(0.5), color });
  };
  const up = (p, dy) => v(p.x, p.y + dy, p.z);
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], len = a.distanceTo(b);
    bar(up(a, h), up(b, h), 0.028);
    bar(up(a, 0.1), up(b, 0.1), 0.018);
    const np = Math.max(1, Math.round(len / 1.2));
    for (let k = 1; k < np; k++) { const p = a.clone().lerp(b, k / np); bar(p, up(p, h), 0.022); }
    const nb = Math.max(1, Math.floor(len / gap));
    for (let k = 1; k < nb; k++) { const p = a.clone().lerp(b, k / nb); bar(up(p, 0.1), up(p, h), 0.009); }
  }
  for (const p of pts) { bar(p, up(p, h + 0.02), 0.026); M.add('metal', new THREE.SphereGeometry(0.035, 8, 6), { pos: up(p, h), color }); }
}

// Entrance vestibule built into a round wall (front faces -z, centre (cx, cz),
// wall radius r): side walls, flat roof overhanging as a canopy, recessed
// glass double doors with frame, threshold, wall light and house plate.
export function entryPortal(M, cx, cz, r, { w = 2.3, h = 2.85, out = 1.1, doorW = 1.5, doorH = 2.3, color = C.W } = {}) {
  const zf = cz - r - out, zb = cz - r + 0.9, len = zb - zf, zm = (zf + zb) / 2;
  const tw = 0.24;
  for (const sx of [-1, 1]) M.add('hull', new THREE.BoxGeometry(tw, h, len), { pos: v(cx + sx * (w / 2 - tw / 2), h / 2, zm), color });
  // front: piers either side of the door and a header
  const pw = (w - 2 * tw - doorW) / 2;
  if (pw > 0.02) for (const sx of [-1, 1]) M.add('hull', new THREE.BoxGeometry(pw, h, tw), { pos: v(cx + sx * (doorW / 2 + pw / 2), h / 2, zf + tw / 2), color });
  M.add('hull', new THREE.BoxGeometry(doorW + 0.02, h - doorH, tw), { pos: v(cx, doorH + (h - doorH) / 2, zf + tw / 2), color });
  // roof slab overhanging the front as a canopy, with coping and downlight
  M.add('hull', new THREE.BoxGeometry(w + 0.3, 0.22, len + 0.7), { pos: v(cx, h + 0.11, zm - 0.35), color: C.W2 });
  M.add('metal', new THREE.BoxGeometry(w + 0.34, 0.05, len + 0.74), { pos: v(cx, h + 0.245, zm - 0.35), color: C.G2 });
  M.add('emissive', new THREE.BoxGeometry(0.5, 0.02, 0.2), { pos: v(cx, h - 0.005, zf - 0.35), color: L.warm });
  // recessed doors
  const zd = zf + 0.2;
  M.add('glass', new THREE.BoxGeometry(doorW, doorH, 0.04), { pos: v(cx, doorH / 2, zd) });
  M.add('metal', new THREE.BoxGeometry(doorW + 0.08, 0.07, 0.08), { pos: v(cx, doorH - 0.035, zd - 0.03), color: C.D });
  for (const sx of [-1, 0, 1]) M.add('metal', new THREE.BoxGeometry(sx ? 0.07 : 0.05, doorH, 0.08), { pos: v(cx + sx * (doorW / 2 - 0.03), doorH / 2, zd - 0.03), color: C.D });
  M.add('metal', new THREE.BoxGeometry(doorW, 0.05, 0.07), { pos: v(cx, 0.025, zd - 0.03), color: C.D });
  for (const sx of [-1, 1]) M.add('metal', new THREE.BoxGeometry(0.03, 0.55, 0.04), { pos: v(cx + sx * 0.1, 1.05, zd - 0.08), color: C.G });
  // reveal lining and threshold
  for (const sx of [-1, 1]) M.add('hull', new THREE.BoxGeometry(0.03, doorH, 0.2), { pos: v(cx + sx * (doorW / 2 + 0.005), doorH / 2, zf + 0.1), color: C.W2 });
  M.add('concrete', new THREE.BoxGeometry(w + 0.6, 0.03, 1.0), { pos: v(cx, 0.015, zf - 0.45), color: C.CONC2 });
  // wall light and house number plate beside the door
  M.add('metal', new THREE.BoxGeometry(0.34, 0.24, 0.05), { pos: v(cx + doorW / 2 + pw / 2, 1.55, zf - 0.03), color: C.D });
  M.add('emissive', new THREE.BoxGeometry(0.2, 0.06, 0.02), { pos: v(cx + doorW / 2 + pw / 2, 1.55, zf - 0.06), color: L.white });
  M.col(cx - w / 2, 0, zf, cx - w / 2 + tw, h, zb);
  M.col(cx + w / 2 - tw, 0, zf, cx + w / 2, h, zb);
  M.col(cx - w / 2, 0, zf, cx + w / 2, h + 0.25, zf + tw + 0.2);
  M.light(cx, h - 0.4, zf - 0.6, L.warm, 1.5, 6);
}

// Domed hab unit: one storey drum with punched windows under a shallow dome
export function habDome(M, x, z, r, { drum = 2.7, sy = 0.55, color = C.W, oculus = true, seg = 48, skip = [], rot = 0.3 } = {}) {
  M.cyl('metal', x, -0.02, z, r + 0.1, 0.22, 0x5b6168, seg);
  const n = Math.max(4, Math.round(Math.PI * 2 * r / 2.3));
  const wins = [];
  for (let i = 0; i < n; i++) {
    const a = rot + i / n * TAU;
    if (skip.some((s) => Math.abs(Math.atan2(Math.sin(a - s), Math.cos(a - s))) < 0.55)) continue;
    wins.push({ a, w: 1.1 });
  }
  roundStorey(M, x, z, r, 0, drum, wins, { sill: 0.85, head: 2.1, color, seg });
  M.cyl('hull', x, drum - 0.02, z, r + 0.08, 0.16, C.W2, seg);
  M.add('hull', new THREE.SphereGeometry(r, seg, 14, 0, TAU, 0, PI2), { pos: v(x, drum + 0.14, z), scale: v(1, sy, 1), color });
  if (oculus) {
    const ro = r * 0.3, yo = drum + 0.14 + r * sy * Math.sqrt(1 - 0.09);
    M.add('metal', new THREE.TorusGeometry(ro, 0.06, 6, 28), { pos: v(x, yo, z), rot: e(PI2, 0, 0), color: C.G2 });
    M.add('glass', new THREE.SphereGeometry(ro, 24, 8, 0, TAU, 0, PI2), { pos: v(x, yo, z), scale: v(1, 0.3, 1) });
  }
  M.colCyl(x, z, r, 0, drum);
  M.colCyl(x, z, r * 0.8, drum, drum + r * sy * 0.6);
  M.colCyl(x, z, r * 0.45, drum + r * sy * 0.6, drum + r * sy);
  return drum + 0.14 + r * sy;
}

// Glass garden dome on a low drum, framed, with trees inside
export function gardenDome(M, x, z, r, { drum = 0.55, seed = 3 } = {}) {
  const rnd = mulberry32(seed);
  M.cyl('metal', x, 0, z, r + 0.07, 0.14, C.D, 36);
  M.cyl('hull', x, 0, z, r, drum, C.W, 36);
  ribDome(M, x, drum, z, r, { ribs: 10, rib: C.W2 });
  for (const f of [0.38, 0.72]) M.add('metal', new THREE.TorusGeometry(r * Math.cos(Math.asin(f)) + 0.03, 0.035, 5, 36), { pos: v(x, drum + r * f, z), rot: e(PI2, 0, 0), color: C.W2 });
  M.cyl('plant', x, drum - 0.02, z, r - 0.1, 0.05, 0x4a3a2a, 28);
  const n = Math.max(3, Math.round(r * 3));
  for (let i = 0; i < n; i++) {
    const a = rnd() * TAU, d = (0.15 + rnd() * 0.45) * r;
    const room = Math.sqrt(r * r - d * d) - 0.15;            // clearance under the glass
    const cr = Math.min(0.2 + rnd() * r * 0.15, room * 0.35), th = Math.max(0.15, room - 2 * cr * 0.85 - 0.05);
    const tx = x + Math.sin(a) * d, tz = z + Math.cos(a) * d;
    M.cyl('plant', tx, drum, tz, 0.04, th, 0x5a3b26, 5);
    M.sphere('plant', tx, drum + th + cr * 0.8, tz, cr, rnd() < 0.5 ? 0x3d7f3a : 0x2f6b34, 9, 0.85);
  }
  M.colCyl(x, z, r, 0, drum + r * 0.55);
  M.colCyl(x, z, r * 0.6, drum + r * 0.55, drum + r);
}

// Pressurised link tube between two points at height y
export function linkTube(M, x0, z0, x1, z1, y, r = 0.6, color = C.W) {
  const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz);
  const q = new THREE.Quaternion().setFromUnitVectors(v(0, 1, 0), v(dx / len, 0, dz / len));
  const m = new THREE.Matrix4().compose(v((x0 + x1) / 2, y, (z0 + z1) / 2), q, v(1, 1, 1));
  M.gb('hull').add(new THREE.CylinderGeometry(r, r, len, 24, 1, true), { matrix: m, color });
  for (const t of [0.3, 0.5, 0.7]) {
    const ring = new THREE.TorusGeometry(r + 0.02, 0.045, 6, 24); ring.rotateX(PI2); ring.translate(0, (t - 0.5) * len, 0);
    M.gb('metal').add(ring, { matrix: m, color: C.G2 });
  }
  // saddle under the middle so an exposed span never floats
  if (y - r > 0.05) M.add('metal', new THREE.BoxGeometry(r * 1.2, y - r * 0.6, 0.25), { pos: v((x0 + x1) / 2, (y - r * 0.6) / 2, (z0 + z1) / 2), rot: e(0, Math.atan2(dx, dz), 0), color: C.G2 });
}

// Cylinder tower: punched windows on every floor, expressed floor lines,
// a glazed lobby, optional balconies (angles), entrance canopy and cap.
export function ribbonTower(M, x, z, r, h, { fh = 3.2, y0 = 0, color = C.W, seg = 48, cap = 'dome', door = false, lobby = true, rot = 0, skip = [], balconies = [], fins = 0, plant = true } = {}) {
  const floors = Math.max(1, Math.round(h / fh));
  const f = h / floors;
  const n = Math.max(4, Math.round(TAU * r / 2.1));
  const near = (a, s, k) => Math.abs(Math.atan2(Math.sin(a - s), Math.cos(a - s))) < k;
  M.cyl('metal', x, y0 - 0.02, z, r + 0.1, 0.26, 0x5b6168, seg);
  for (let i = 0; i < floors; i++) {
    const y = y0 + i * f;
    const lob = i === 0 && lobby && y0 === 0;
    const wins = [];
    for (let k = 0; k < n; k++) {
      const a = rot + (k + (i % 2) * 0.0) / n * TAU;
      if (skip.some((s) => near(a, s, 0.5))) continue;
      if (door && i === 0 && near(a, Math.PI, 0.9)) continue;
      const bal = i > 0 && balconies.some((b) => near(a, b, 0.2)) && i % 2 === 1;
      wins.push(lob ? { a, w: 1.5, y: 0.3, h: 2.3 } : bal ? { a, w: 1.1, y: 0.1, h: 2.2 } : { a, w: 1.2 });
    }
    roundStorey(M, x, z, r, y, y + f, wins, { color, seg, sill: 0.95, head: 2.3 });
    // expressed floor line
    if (i > 0) M.add('hull', new THREE.CylinderGeometry(r + 0.06, r + 0.06, 0.16, seg, 1, true), { pos: v(x, y + 0.02, z), color: C.W2 });
    if (i > 0 && i % 2 === 1) for (const b of balconies) {
      const q = e(0, b, 0), P = (lx, ly, lz) => v(lx, ly, lz).applyEuler(q).add(v(x, 0, z));
      const bw = 1.05, bd = r + 1.05, zw = Math.sqrt(r * r - bw * bw) - 0.03;   // side rails die into the curved wall
      M.add('hull', new THREE.BoxGeometry(2 * bw + 0.1, 0.16, bd - zw + 0.25), { pos: P(0, y + 0.02, (bd + zw) / 2 - 0.05), rot: q, color: C.W2 });
      rail(M, [P(-bw, y + 0.1, zw), P(-bw, y + 0.1, bd), P(bw, y + 0.1, bd), P(bw, y + 0.1, zw)], 1.0);
    }
  }
  const top = y0 + h;
  M.add('hull', new THREE.CylinderGeometry(r + 0.08, r + 0.08, 0.3, seg), { pos: v(x, top + 0.13, z), color: C.W2 });
  for (let i = 0; i < fins; i++) {
    const a = i / fins * TAU + rot + TAU / n / 2;
    M.add('metal', new THREE.BoxGeometry(0.1, h - 0.4, 0.3), { pos: v(x + Math.sin(a) * (r + 0.14), y0 + 0.2 + (h - 0.4) / 2, z + Math.cos(a) * (r + 0.14)), rot: e(0, a, 0), color: C.G2 });
  }
  let capTop = top + 0.28;
  const ct = top + 0.28;
  if (cap === 'dome') {
    M.add('hull', new THREE.SphereGeometry(r, seg, 14, 0, TAU, 0, PI2), { pos: v(x, ct, z), scale: v(1, 0.5, 1), color });
    const ro = r * 0.32, yo = ct + r * 0.5 * Math.sqrt(1 - 0.1024);
    M.add('metal', new THREE.TorusGeometry(ro, 0.06, 6, 28), { pos: v(x, yo, z), rot: e(PI2, 0, 0), color: C.G2 });
    M.add('glass', new THREE.SphereGeometry(ro, 24, 8, 0, TAU, 0, PI2), { pos: v(x, yo, z), scale: v(1, 0.3, 1) });
    capTop = ct + r * 0.5;
  } else if (cap === 'garden') {
    M.cyl('hull', x, ct, z, r, 0.4, color, seg);
    ribDome(M, x, ct + 0.4, z, r - 0.1, { ribs: 12, rib: C.W2 });
    M.cyl('plant', x, ct + 0.38, z, r - 0.2, 0.05, 0x4a3a2a, 28);
    for (let i = 0; i < 6; i++) { const a = i * 1.05, d = r * 0.5; M.cyl('plant', x + Math.sin(a) * d, ct + 0.4, z + Math.cos(a) * d, 0.07, 0.9, 0x5a3b26, 5); M.sphere('plant', x + Math.sin(a) * d, ct + 1.5, z + Math.cos(a) * d, 0.55, i % 2 ? 0x3d7f3a : 0x2f6b34, 9, 0.85); }
    capTop = ct + 0.4 + r;
  } else {
    // flat roof: parapet, plant room, condenser units, railing
    M.add('hull', new THREE.CylinderGeometry(r + 0.08, r + 0.08, 0.6, seg, 1, true), { pos: v(x, ct + 0.3, z), color: C.W2 });
    M.cyl('concrete', x, ct, z, r, 0.06, C.CONC2, seg);
    if (plant) rooftopPlant(M, x, ct + 0.06, z, r * 0.6, 17);
    capTop = ct + 0.6;
  }
  if (door) entryPortal(M, x, z, r, { w: 2.6, h: 3.0, out: 1.0, doorW: 1.8, doorH: 2.45 });
  M.colCyl(x, z, r, y0, top + 0.3);
  if (cap !== 'flat') M.colCyl(x, z, r * 0.75, top, capTop - r * 0.15);
  return capTop;
}

// Roof plant: stair/lift overrun, condensers with fan grilles, ducts, vents
export function rooftopPlant(M, x, y, z, rad, seed = 1) {
  const rnd = mulberry32(seed);
  M.box('hull', x - rad * 0.3, y + 1.1, z + rad * 0.2, 1.6, 2.2, 1.4, C.W2);
  M.box('metal', x - rad * 0.3, y + 2.25, z + rad * 0.2, 1.7, 0.08, 1.5, C.D);
  M.box('metal', x - rad * 0.3, y + 1.0, z + rad * 0.2 - 0.71, 0.8, 2.0, 0.04, C.G);
  for (let i = 0; i < 2; i++) {
    const ux = x + rad * 0.35, uz = z - rad * 0.5 + i * 1.1;
    M.box('metal', ux, y + 0.45, uz, 1.0, 0.9, 0.95, C.W2);
    M.cyl('metal', ux, y + 0.9, uz, 0.36, 0.05, C.D, 20);
    for (let k = 0; k < 4; k++) M.box('metal', ux, y + 0.96, uz, 0.68, 0.02, 0.03, C.G, k * Math.PI / 4);
  }
  pipe(M, [[x + rad * 0.35, y + 0.6, z - rad * 0.5 - 0.5], [x + rad * 0.35, y + 0.25, z - rad * 0.5 - 0.9], [x - rad * 0.3, y + 0.25, z - rad * 0.5 - 0.9]], 0.09, C.G2);
  vent(M, x + (rnd() - 0.5) * rad, y, z + rad * 0.6, 0.7, 0.5, 0.4);
}

// ---------------------------------------------------------------- rectilinear buildings
// Flat facade from a point on its outer face (fx, fz) facing angle a (0 = +z),
// len wide, `storeys` x fh high from y0. Openings per storey come from
// openFn(storey, len) -> [{c, w, y, h, kind: 'win' | 'shop' | 'door' | 'shutter'}]
// with c measured along the face (local x). Wall pieces around openings form
// real reveals; panes sit recessed. dado: solid base course of another key.
export function facade(M, fx, fz, a, len, y0, storeys, fh, openFn, { t = 0.3, key = 'hull', color = C.W, trim = C.W2, dado = 0, dadoKey = 'concrete', dadoColor = C.CONC2, lines = true } = {}) {
  const R = e(0, a, 0);
  const W = (lx, ly, lz) => v(lx, ly, lz).applyEuler(R).add(v(fx, 0, fz));
  const box = (k, lx, ly, lz, bw, bh, bd, col) => { if (bw > 1e-3 && bh > 1e-3) M.add(k, new THREE.BoxGeometry(bw, bh, bd), { pos: W(lx, ly, lz), rot: R, color: col }); };
  const piece = (x0, x1, ya, yb) => {
    if (yb - ya < 1e-3) return;
    const mx = (x0 + x1) / 2, bw = x1 - x0;
    if (dado > ya + 1e-3) {
      const yd = Math.min(dado, yb);
      box(dadoKey, mx, (ya + yd) / 2, -t / 2 + 0.02, bw, yd - ya, t, dadoColor);
      ya = yd;
    }
    box(key, mx, (ya + yb) / 2, -t / 2, bw, yb - ya, t, color);
  };
  for (let st = 0; st < storeys; st++) {
    const ys = y0 + st * fh;
    const ops = openFn(st, len).filter((o) => Math.abs(o.c) + o.w / 2 < len / 2 - 0.05);
    const cuts = new Set([-len / 2, len / 2]);
    for (const o of ops) { cuts.add(o.c - o.w / 2); cuts.add(o.c + o.w / 2); }
    const xs = [...cuts].sort((p, q) => p - q);
    for (let i = 0; i < xs.length - 1; i++) {
      const x0 = xs[i], x1 = xs[i + 1], mid = (x0 + x1) / 2;
      const o = ops.find((q) => mid > q.c - q.w / 2 && mid < q.c + q.w / 2);
      if (!o) { piece(x0, x1, ys, ys + fh); continue; }
      piece(x0, x1, ys, ys + o.y);
      piece(x0, x1, ys + o.y + o.h, ys + fh);
    }
    for (const o of ops) opening(M, W, R, o, ys, t, trim, key === 'brick' || key === 'stone' ? 'stone' : 'hull');
    if (lines && st > 0) box('hull', 0, ys + 0.02, 0.03, len + 0.08, 0.14, 0.06, trim);
  }
}

function opening(M, W, R, o, ys, t, trim, sillKey = 'hull') {
  const add = (key, geo, lx, ly, lz, color) => M.add(key, geo, { pos: W(lx, ly, lz), rot: R, color });
  const y = ys + o.y, h = o.h, w = o.w, c = o.c;
  if (o.kind === 'shutter') {
    add('metal', new THREE.BoxGeometry(w, h, 0.06), c, y + h / 2, -t + 0.08, C.G);
    for (let k = 0; k < Math.floor(h / 0.16); k++) add('metal', new THREE.BoxGeometry(w - 0.02, 0.02, 0.02), c, y + 0.08 + k * 0.16, -t + 0.12, C.G2);
    add('metal', new THREE.BoxGeometry(w + 0.3, 0.32, 0.36), c, y + h + 0.16, 0.12, C.G2);
    for (const sx of [-1, 1]) add('metal', new THREE.BoxGeometry(0.1, h, 0.12), c + sx * (w / 2 - 0.05), y + h / 2, -t + 0.12, C.D);
    hazard(M, W(c - w / 2 - 0.3, 0.45, 0.25).x, 0.45, W(c - w / 2 - 0.3, 0.45, 0.25).z, 0.18, 0.9, 0.18);
    hazard(M, W(c + w / 2 + 0.3, 0.45, 0.25).x, 0.45, W(c + w / 2 + 0.3, 0.45, 0.25).z, 0.18, 0.9, 0.18);
    return;
  }
  const dz = o.kind === 'shop' ? -0.14 : -0.2;
  add('glass', new THREE.BoxGeometry(w, h, 0.04), c, y + h / 2, dz);
  const fz = dz + 0.035, f = o.kind === 'win' ? 0.05 : 0.07;
  add('metal', new THREE.BoxGeometry(w, f, 0.06), c, y + f / 2, fz, C.D);
  add('metal', new THREE.BoxGeometry(w, f, 0.06), c, y + h - f / 2, fz, C.D);
  for (const sx of [-1, 1]) add('metal', new THREE.BoxGeometry(f, h, 0.06), c + sx * (w / 2 - f / 2), y + h / 2, fz, C.D);
  if (o.kind === 'win') {
    if (w > 1.0) add('metal', new THREE.BoxGeometry(0.04, h, 0.05), c, y + h / 2, fz, C.D);
    add(sillKey, new THREE.BoxGeometry(w + 0.16, 0.06, 0.3), c, y - 0.03, 0.04, trim);
  } else if (o.kind === 'shop') {
    const n = Math.max(1, Math.round(w / 1.3));
    for (let k = 1; k < n; k++) add('metal', new THREE.BoxGeometry(0.06, h, 0.06), c - w / 2 + k * w / n, y + h / 2, fz, C.D);
    add('metal', new THREE.BoxGeometry(w, 0.06, 0.06), c, y + h - 0.55, fz, C.D);
  } else if (o.kind === 'door') {
    add('metal', new THREE.BoxGeometry(0.05, h, 0.06), c, y + h / 2, fz, C.D);
    add('metal', new THREE.BoxGeometry(w, 0.05, 0.06), c, y + 2.25, fz, C.D);
    for (const sx of [-1, 1]) add('metal', new THREE.BoxGeometry(0.03, 0.5, 0.05), c + sx * 0.12, y + 1.05, fz + 0.04, C.G);
    add('concrete', new THREE.BoxGeometry(w + 0.2, 0.04, 0.5), c, 0.02, 0.05, C.CONC2);
  }
}

// openings helper: evenly spaced windows in bays, optional centred door
export function bays(len, { bay = 2.2, w = 1.3, sill = 0.95, head = 2.35, door = 0, doorW = 1.9, doorH = 2.6, shop = false, kind = 'win' } = {}) {
  const out = [];
  if (shop && door) {
    // shopfront glazing filling both sides of a centred door
    const x0 = doorW / 2 + 0.35, x1 = len / 2 - 0.45;
    if (x1 - x0 > 0.8) for (const sx of [-1, 1]) out.push({ c: sx * (x0 + x1) / 2, w: x1 - x0, y: 0.35, h: Math.min(head, 2.75), kind: 'shop' });
    out.push({ c: 0, w: doorW, y: 0, h: doorH, kind: 'door' });
    return out;
  }
  const nb = Math.max(1, Math.floor((len - 0.5) / bay));
  const m = (len - nb * bay) / 2;
  for (let k = 0; k < nb; k++) {
    const c = -len / 2 + m + (k + 0.5) * bay;
    if (door && Math.abs(c) < doorW / 2 + (shop ? bay - 0.45 : w) / 2 + 0.25) continue;
    out.push(shop ? { c, w: bay - 0.45, y: 0.35, h: Math.min(head, 2.75), kind: 'shop' } : { c, w, y: sill, h: head - sill, kind });
  }
  if (door) out.push({ c: 0, w: doorW, y: 0, h: doorH, kind: 'door' });
  return out;
}

// Entrance canopy with hangers, downlights and a sign band, on a face
export function canopy(M, fx, fz, a, w = 3.0, dep = 1.6, y = 2.9, sign = L.white) {
  const R = e(0, a, 0);
  const W = (lx, ly, lz) => v(lx, ly, lz).applyEuler(R).add(v(fx, 0, fz));
  M.add('hull', new THREE.BoxGeometry(w, 0.16, dep), { pos: W(0, y, dep / 2), rot: R, color: C.W2 });
  M.add('metal', new THREE.BoxGeometry(w - 0.1, 0.03, dep - 0.1), { pos: W(0, y - 0.09, dep / 2), rot: R, color: C.D });
  for (const sx of [-0.3, 0.3]) M.add('emissive', new THREE.BoxGeometry(0.22, 0.02, 0.22), { pos: W(sx * w, y - 0.1, dep * 0.55), rot: R, color: L.warm });
  for (const sx of [-1, 1]) {
    const a0 = W(sx * (w / 2 - 0.2), y + 0.05, dep - 0.15), a1 = W(sx * (w / 2 - 0.2), y + 1.3, 0.02);
    const d = a1.clone().sub(a0), len = d.length();
    const g = new THREE.CylinderGeometry(0.02, 0.02, len, 5);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(v(0, 1, 0), d.normalize()));
    M.add('metal', g, { pos: a0.clone().add(a1).multiplyScalar(0.5), color: C.G2 });
  }
  if (sign) {
    M.add('metal', new THREE.BoxGeometry(w * 0.6, 0.34, 0.06), { pos: W(0, y + 0.42, 0.05), rot: R, color: C.D });
    M.add('emissive', new THREE.BoxGeometry(w * 0.5, 0.07, 0.02), { pos: W(0, y + 0.42, 0.09), rot: R, color: sign });
  }
  M.light(W(0, y - 0.3, dep * 0.5).x, y - 0.3, W(0, y - 0.3, dep * 0.5).z, L.warm, 1.5, 6);
}

// Rectilinear block: punched-window facades on four sides, roof slab with
// parapet and coping, rooftop plant. Front faces -z. Returns roof level.
// Surface facility, built the way a space agency would put one on Mars:
// rigid pressure modules (4.2 m like station modules, ellipsoidal heads)
// wrapped in white multi-layer insulation, ring frames at the segment joints,
// small portholes, handrails, sitting on saddle supports. Two-storey
// buildings stack a second row on a steel rack with a vertical node tower
// for the stairs. The back is buried in a sintered-regolith shielding berm.
// An airlock tube with a hatch is the door. A grated equipment deck on top
// carries radiators, masts and lights (and whatever the caller adds at H).
// Same signature as pavilion(); returns the deck height H.
function ringShape(w, d, r, t) {
  const s = roundRect(w, d, r);
  s.holes.push(roundRect(w - 2 * t, d - 2 * t, Math.max(0.04, r - t)));
  return s;
}
function band(M, key, cx, y, cz, h, w, d, r, t, color, seg = 10) {
  if (h <= 0.005) return;
  const g = new THREE.ExtrudeGeometry(ringShape(w, d, r, t), { depth: h, bevelEnabled: false, curveSegments: seg });
  g.rotateX(-Math.PI / 2);
  M.add(key, g, { pos: v(cx, y, cz), color });
}
function slab(M, key, cx, y, cz, h, w, d, r, color, bevel = 0) {
  const g = new THREE.ExtrudeGeometry(roundRect(w, d, r), bevel ? { depth: h, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 10 } : { depth: h, bevelEnabled: false, curveSegments: 10 });
  g.rotateX(-Math.PI / 2);
  M.add(key, g, { pos: v(cx, y, cz), color });
}

// one horizontal pressure module along x, centred at (x, y, z)
export function habModule(M, x, y, z, len, r, { accent = C.BLUE, ports = 3, portSide = -1, saddles = true, hatchEnd = 0, label = null } = {}) {
  const head = r * 0.5, body = Math.max(0.5, len - 2 * head);
  const prof = [];
  for (let i = 0; i <= 10; i++) { const a = i / 10 * Math.PI / 2; prof.push(new THREE.Vector2(Math.sin(a) * r, -body / 2 - Math.cos(a) * head)); }
  for (let i = 0; i <= 10; i++) { const a = i / 10 * Math.PI / 2; prof.push(new THREE.Vector2(Math.cos(a) * r, body / 2 + Math.sin(a) * head)); }
  const g = new THREE.LatheGeometry(prof, 40);
  g.rotateZ(-Math.PI / 2);
  M.add('mli', g, { pos: v(x, y, z), color: C.W });
  // segment rings, the end flanges darker, an identity band near the door end
  const n = Math.max(2, Math.round(body / 1.6));
  for (let i = 0; i <= n; i++) {
    const t = -body / 2 + i * body / n;
    M.add('metal', new THREE.TorusGeometry(r + 0.025, i === 0 || i === n ? 0.075 : 0.04, 6, 40), { pos: v(x + t, y, z), rot: e(0, Math.PI / 2, 0), color: i === 0 || i === n ? C.G2 : C.W2 });
  }
  M.add('hull', new THREE.CylinderGeometry(r + 0.03, r + 0.03, 0.42, 40, 1, true), { pos: v(x - body / 2 + 0.55, y, z), rot: e(0, 0, Math.PI / 2), color: accent });
  // portholes on one side: small, thick-rimmed, with a sunshade lip
  for (let i = 0; i < ports; i++) {
    const t = -body / 2 + (i + 0.5) * body / ports;
    const pz = z + portSide * (r + 0.02), py = y + 0.15;
    M.add('glass', new THREE.CylinderGeometry(0.2, 0.2, 0.06, 20), { pos: v(x + t, py, pz), rot: e(Math.PI / 2, 0, 0) });
    M.add('metal', new THREE.TorusGeometry(0.23, 0.055, 8, 22), { pos: v(x + t, py, pz + portSide * 0.02), color: C.G2 });
    M.add('metal', new THREE.BoxGeometry(0.56, 0.05, 0.16), { pos: v(x + t, py + 0.3, pz + portSide * 0.06), color: C.G2 });
  }
  // handrail along the upper flank
  const hz = z + portSide * r * 0.72, hy = y + r * 0.72;
  M.tube('metal', [[x - body / 2 + 0.3, hy, hz], [x + body / 2 - 0.3, hy, hz]], 0.025, 0xc9a640, 4);
  for (let i = 0; i <= 3; i++) M.box('metal', x - body / 2 + 0.3 + i * (body - 0.6) / 3, hy - 0.05, hz - portSide * 0.04, 0.04, 0.12, 0.08, 0xc9a640);
  // label plate with the facility code light
  if (label !== null) {
    M.box('metal', x + body * 0.22, y + 0.85, z + portSide * (r * 0.42 + 0.02), 1.4, 0.36, 0.03, C.D, 0);
    M.box('emissive', x + body * 0.22, y + 0.85, z + portSide * (r * 0.42 + 0.04), 1.1, 0.08, 0.02, label);
  }
  // hatch on an end head
  if (hatchEnd) {
    const ex = x + hatchEnd * (body / 2 + head - 0.06);
    M.box('metal', ex, y - 0.2, z, 0.12, 1.5, 1.1, C.G2);
    M.box('hull', ex + hatchEnd * 0.05, y - 0.2, z, 0.06, 1.3, 0.9, C.W2);
  }
  // saddle supports on footings
  if (saddles) for (const t of [-body * 0.32, body * 0.32]) {
    M.add('metal', new THREE.BoxGeometry(0.34, y - r * 0.55, r * 1.3), { pos: v(x + t, (y - r * 0.55) / 2, z), color: C.G2 });
    M.add('metal', new THREE.CylinderGeometry(r * 0.98, r * 0.98, 0.32, 24, 1, true, Math.PI * 0.62, Math.PI * 0.76), { pos: v(x + t, y, z), rot: e(0, 0, Math.PI / 2), color: C.G2 });
    M.box('concrete', x + t, 0.08, z, 0.7, 0.16, r * 1.6, C.CONC2);
  }
  M.col(x - len / 2, y - r, z - r, x + len / 2, y + r, z + r);
}

export function facility(M, cx, cz, w, d, { storeys = 2, fh = 3.3, y0 = 0, color = C.W, bay = 2.2, win = 1.3, door = true, shop = false, parapet = 0.75, plant = true, seed = 1, sides = true, signColor = L.white, canopyW = 3.2, canopyY = 2.95 } = {}) {
  const levels = Math.min(2, storeys);
  const R = Math.min(2.1, d / 2 - 0.9);
  const node = levels > 1 && w > 7;
  const L = w - (node ? 3.4 : 1.2), mx = cx - (node ? 1.1 : 0);
  const yc = y0 + R + 0.55;
  const ports = Math.max(2, Math.round(L / 2.2));
  habModule(M, mx, yc, cz, L, R, { accent: signColor, ports: shop ? ports + 1 : ports, label: signColor });
  let top = yc + R;
  if (levels > 1) {
    // steel rack carrying the upper module, grated floor between them
    const yd = yc + R + 0.5, L2 = L - 1.2, yc2 = yd + R + 0.5;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) M.box('metal', mx + sx * (L2 / 2 - 0.4), yd / 2, cz + sz * (R + 0.25), 0.22, yd, 0.22, C.G2);
    for (const sz of [-1, 1]) M.box('metal', mx, yd - 0.12, cz + sz * (R + 0.25), L2, 0.24, 0.2, C.G2);
    M.box('metal', mx, yd, cz, L2, 0.08, 2 * R + 0.5, 0x6f757c);
    for (let i = 0; i < 4; i++) M.box('metal', mx - L2 / 2 + (i + 0.5) * L2 / 4, yd - 0.16, cz, 0.12, 0.2, 2 * R + 0.5, C.G2);
    habModule(M, mx + 0.4, yc2, cz, L2, R, { accent: signColor, ports: Math.max(2, ports - 1), saddles: false });
    for (const t of [-L2 * 0.3, L2 * 0.3]) M.box('metal', mx + 0.4 + t, yd + 0.3, cz, 0.3, 0.6, R * 1.2, C.G2);
    top = yc2 + R;
  }
  if (node) {
    // vertical node: stairs and lift between the levels, a cupola on top
    const nx = cx + w / 2 - 1.35, nr = 1.2;
    M.cyl('mli', nx, 0.3, cz, nr, top - 0.3, C.W, 32);
    for (let y = 1.5; y < top - 0.5; y += 1.6) M.add('metal', new THREE.TorusGeometry(nr + 0.02, 0.04, 6, 32), { pos: v(nx, y, cz), rot: e(Math.PI / 2, 0, 0), color: C.W2 });
    for (const y of [2.2, top - 2.0]) porthole(M, nx, y, cz - nr - 0.01, 0.2, '-z');
    M.add('glass', new THREE.SphereGeometry(nr * 0.8, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), { pos: v(nx, top + 0.1, cz) });
    M.add('metal', new THREE.TorusGeometry(nr * 0.82, 0.07, 6, 28), { pos: v(nx, top + 0.1, cz), rot: e(Math.PI / 2, 0, 0), color: C.G2 });
    M.colCyl(nx, cz, nr, 0, top);
  }
  // shielding berm of sintered regolith burying the back of the ground level
  if (y0 === 0) {
    const bh = Math.min(yc + R * 0.55, 3.6), sh = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(2.4, 0), new THREE.Vector2(0.5, bh), new THREE.Vector2(-0.2, bh)]);
    const berm = new THREE.ExtrudeGeometry(sh, { depth: L * 0.92, bevelEnabled: true, bevelThickness: 0.6, bevelSize: 0.4, bevelSegments: 2, curveSegments: 4 });
    berm.rotateY(-Math.PI / 2);
    M.add('regolith', berm, { pos: v(mx + L * 0.46, 0, cz + R * 0.55), color: REGOLITH });
    M.col(mx - L / 2, 0, cz + R * 0.5, mx + L / 2, bh, Math.min(cz + d / 2, cz + R + 2.2));
  }
  // equipment deck on top: grating, rails, radiators, a mast, floodlights
  const H = top + 0.55;
  const dw = Math.min(L - 0.6, w - 1.2), dd = Math.min(2 * R - 0.4, d - 1.0);
  M.box('metal', mx, H - 0.06, cz, dw, 0.1, dd, 0x6f757c);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) M.box('metal', mx + sx * (dw / 2 - 0.3), H - 0.32, cz + sz * (dd / 2 - 0.3), 0.14, 0.5, 0.14, C.G2);
  railing(M, mx - dw / 2, cz - dd / 2, mx + dw / 2, cz - dd / 2, H, 0.9, C.G);
  railing(M, mx - dw / 2, cz + dd / 2, mx + dw / 2, cz + dd / 2, H, 0.9, C.G);
  if (plant) {
    radiator(M, mx + dw * 0.18, H, cz + dd * 0.15, Math.min(2.6, dw * 0.35), 1.2, 0, C.W2);
    antenna(M, mx - dw / 2 + 0.5, H, cz + dd / 2 - 0.4, 2.2 + (seed % 3) * 0.7);
    vent(M, mx - dw * 0.22, H, cz - dd * 0.2, 0.7, 0.55, 0.4);
  }
  for (const sx of [-1, 1]) {
    M.cyl('metal', mx + sx * (dw / 2 - 0.2), H, cz - dd / 2 + 0.2, 0.04, 1.3, C.G2, 6);
    M.box('emissive', mx + sx * (dw / 2 - 0.2), H + 1.32, cz - dd / 2 + 0.05, 0.3, 0.12, 0.08, L.white);
    M.light(mx + sx * (dw / 2 - 0.2), H + 1.2, cz - dd / 2 - 0.5, L.white, 1.2, 9);
  }
  // utilities at ground level: a cable tray along the front, a pair of tanks
  if (y0 === 0) {
    M.box('metal', mx, 0.45, cz - R - 0.35, L * 0.8, 0.12, 0.3, C.G2);
    for (let i = 0; i < 4; i++) M.box('metal', mx - L * 0.36 + i * L * 0.24, 0.22, cz - R - 0.35, 0.06, 0.45, 0.06, C.G2);
    if (w - L > 0.9 && !node) {
      tank(M, cx + w / 2 - 0.45, 0, cz + R * 0.3, 0.38, 1.6, C.W2, C.Y);
    }
  }
  // the door: an airlock tube with a hatch, a lit sign over it
  if (door && y0 === 0) {
    const ax = mx - L * 0.12;
    airlockTube(M, ax, 1.3, cz - R * 0.55, cz - d / 2 + 0.25, 1.12);
    M.box('emissive', ax, 2.75, cz - d / 2 + 0.35, 1.0, 0.12, 0.04, signColor);
  }
  return H;
}

// Low-rise pressurised pavilion: rounded shell, ribbon glazing, regolith
// base, airlock porch. Homes and low civic buildings.
export function pavilion(M, cx, cz, w, d, { storeys = 2, fh = 3.3, y0 = 0, color = C.W, bay = 2.2, win = 1.3, door = true, shop = false, parapet = 0.75, plant = true, seed = 1, sides = true, signColor = L.white, canopyW = 3.2, canopyY = 2.95 } = {}) {
  const H = y0 + storeys * fh;
  const r = Math.min(1.5, Math.min(w, d) * 0.24);
  const T = 0.3;
  const mullion = Math.max(1.05, Math.min(1.8, bay * 0.62));
  const ground = y0 === 0;
  for (let st = 0; st < storeys; st++) {
    const ys = y0 + st * fh;
    const big = shop && st === 0;
    const sill = big ? 0.35 : Math.max(0.8, 1.15 - (win - 1.0) * 0.4), head = fh - (big ? 0.5 : 0.6);
    band(M, 'hull', cx, ys, cz, sill, w, d, r, T, color);
    // ribbon glazing, set back from the face, with dark frames top and bottom
    band(M, 'glass', cx, ys + sill, cz, head - sill, w - 0.22, d - 0.22, r - 0.11, 0.05);
    band(M, 'metal', cx, ys + sill - 0.02, cz, 0.07, w - 0.16, d - 0.16, r - 0.08, 0.1, C.D);
    band(M, 'metal', cx, ys + head - 0.05, cz, 0.07, w - 0.16, d - 0.16, r - 0.08, 0.1, C.D);
    band(M, 'hull', cx, ys + head, cz, fh - head, w, d, r, T, color);
    // mullions on the straight runs; the corners stay as curved glass
    const my = ys + (sill + head) / 2, mh = head - sill;
    const runs = [[w - 2 * r, (x) => [cx + x, cz - d / 2 + 0.14]], [w - 2 * r, (x) => [cx + x, cz + d / 2 - 0.14]], [d - 2 * r, (z) => [cx - w / 2 + 0.14, cz + z]], [d - 2 * r, (z) => [cx + w / 2 - 0.14, cz + z]]];
    runs.forEach(([len, at], i) => {
      const n = Math.max(1, Math.round(len / mullion));
      for (let k = 0; k <= n; k++) {
        const u = -len / 2 + k * len / n, [x, z] = at(u);
        if (i < 2) M.box('metal', x, my, z, 0.07, mh, 0.1, C.D); else M.box('metal', x, my, z, 0.1, mh, 0.07, C.D);
      }
    });
    // slab edge standing proud at each floor
    if (st > 0) band(M, 'hull', cx, ys - 0.07, cz, 0.16, w + 0.26, d + 0.26, r + 0.13, 0.32, C.W2);
  }
  // two dark fins frame the front run full height; one carries the building's
  // identity colour as a light line (blue police, green clinic, ...)
  const fz = cz - d / 2 - 0.18;
  for (const sx of [-1, 1]) {
    const fx = cx + sx * (w / 2 - r - 0.1);
    M.box('metal', fx, (y0 + H) / 2 + 0.2, fz + 0.1, 0.16, H - y0 + 0.6, 0.5, C.D);
    if (sx < 0) M.box('emissive', fx, (y0 + H) / 2 + 0.2, fz - 0.16, 0.05, H - y0 - 0.4, 0.02, signColor);
  }
  // printed regolith base the shell stands in: layered, warm, part of the ground
  if (ground) {
    band(M, 'regolith', cx, -0.3, cz, 1.25, w + 0.5, d + 0.5, r + 0.25, 0.42, REGOLITH);
    slab(M, 'regolith', cx, 0.93, cz, 0.04, w + 0.52, d + 0.52, r + 0.26, 0x8c6a55);
  }
  // roof: cap, parapet with coping, and a shielding berm of sintered regolith
  slab(M, 'hull', cx, H - 0.12, cz, 0.24, w - 0.05, d - 0.05, r - 0.02, C.W2);
  if (parapet > 0) {
    band(M, 'hull', cx, H, cz, parapet * 0.7, w, d, r, 0.22, color);
    band(M, 'metal', cx, H + parapet * 0.7, cz, 0.05, w + 0.04, d + 0.04, r + 0.02, 0.28, C.G2);
  }
  const bw = w - 0.9, bd = d - 0.9;
  // (only on plain roofs; buildings with their own roof kit keep the roof clear)
  if (plant && bw > 1.2 && bd > 1.2) slab(M, 'regolith', cx, H + 0.12, cz, 0.12, bw - 0.5, bd - 0.5, Math.max(0.1, r - 0.7), REGOLITH, 0.3);
  if (plant) {
    rooftopPlant(M, cx, H + 0.5, cz, Math.min(w, d) * 0.28, seed);
    // heat-rejection panels and a mast give the roof a working silhouette
    if (w > 5) radiator(M, cx + w / 2 - r - 0.9, H + 0.6, cz + d / 2 - r - 0.4, Math.min(2.4, w * 0.28), 1.1, 0, C.W2);
    antenna(M, cx - w / 2 + r + 0.2, H + 0.5, cz + d / 2 - r, 1.6 + (seed % 3) * 0.6);
  }
  // airlock vestibule at the door: rounded glass porch with a steel frame
  if (door && ground) {
    const vw = Math.min(canopyW, w * 0.5, 3.4), vd = 1.8, vz = cz - d / 2 - vd / 2 + 0.25, vh = Math.min(canopyY, 2.9);
    band(M, 'glass', cx, 0.0, vz, vh, vw, vd, 0.55, 0.05);
    slab(M, 'hull', cx, vh, vz, 0.28, vw + 0.3, vd + 0.25, 0.68, C.W);
    band(M, 'metal', cx, vh - 0.04, vz, 0.08, vw + 0.06, vd + 0.06, 0.58, 0.12, C.D);
    for (const sx of [-1, 1]) M.box('metal', cx + sx * (vw / 2 - 0.05), vh / 2, vz - vd / 2 + 0.05, 0.1, vh, 0.1, C.D);
    M.box('metal', cx, vh / 2, vz - vd / 2 + 0.02, 0.06, vh, 0.06, C.D);
    M.box('metal', cx, 2.25, vz - vd / 2 + 0.02, vw - 0.1, 0.06, 0.06, C.D);
    M.box('emissive', cx, vh + 0.14, vz - vd / 2 - 0.13, Math.min(1.6, vw * 0.6), 0.14, 0.03, signColor);
    M.box('emissive', cx, vh - 0.06, vz, vw * 0.5, 0.03, 0.4, L.warm);
    M.box('concrete', cx, 0.03, vz - vd / 2 - 0.45, vw + 0.4, 0.06, 0.9, C.CONC2);
    M.light(cx, vh - 0.3, vz - vd / 2 - 0.5, L.warm, 1.6, 7);
    M.col(cx - vw / 2, 0, vz - vd / 2, cx + vw / 2, vh + 0.3, vz + vd / 2);
  }
  M.col(cx - w / 2, y0, cz - d / 2, cx + w / 2, H + parapet, cz + d / 2);
  return H;
}

export const block = pavilion;

// ---------------------------------------------------------------- future towers
// Lofted glass towers for the civic skyline (references: NEOM's mirrored
// facades, twisting diagrid towers that rotate a little each floor, faceted
// crystalline towers). A section function gives the plan at height t (0..1);
// the loft is skinned in mirror glass, with dark floor bands, corner mullions
// that follow the twist, a light line in the building's colour and a crown.
function loft(section, levels, h, y0, flat = false) {
  const n = section(0).length, pos = [], uv = [], idx = [];
  for (let j = 0; j <= levels; j++) {
    const t = j / levels, pts = section(t), y = y0 + t * h;
    for (let i = 0; i <= n; i++) { const q = pts[i % n]; pos.push(q[0], y, q[1]); uv.push(i / n, t); }
  }
  for (let j = 0; j < levels; j++) for (let i = 0; i < n; i++) {
    const a = j * (n + 1) + i, b = a + n + 1;
    idx.push(a, a + 1, b, b, a + 1, b + 1);
  }
  let g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  // make sure faces point outward
  g.computeVertexNormals();
  const P = g.attributes.position, N = g.attributes.normal, k = Math.floor(n / 2);
  if (P.getX(k) * N.getX(k) + P.getZ(k) * N.getZ(k) < 0) { const ix = g.index.array; for (let q = 0; q < ix.length; q += 3) { const tmp = ix[q + 1]; ix[q + 1] = ix[q + 2]; ix[q + 2] = tmp; } g.computeVertexNormals(); }
  if (flat) { g = g.toNonIndexed(); g.computeVertexNormals(); }
  return g;
}
function rrectPts(hw, hd, rr, rot, seg = 6) {
  const out = [], cs = [[hw - rr, hd - rr, 0], [-hw + rr, hd - rr, 1], [-hw + rr, -hd + rr, 2], [hw - rr, -hd + rr, 3]];
  for (const [cx, cz, k] of cs) for (let i = 0; i < seg; i++) { const a = (k + i / seg) * Math.PI / 2; out.push([cx + Math.cos(a) * rr, cz + Math.sin(a) * rr]); }
  const c = Math.cos(rot), s = Math.sin(rot);
  return out.map(([x, z]) => [x * c - z * s, x * s + z * c]);
}
function ellPts(rx, rz, rot, n = 32) {
  const c = Math.cos(rot), s = Math.sin(rot), out = [];
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, x = Math.cos(a) * rx, z = Math.sin(a) * rz; out.push([x * c - z * s, x * s + z * c]); }
  return out;
}
export function futureTower(M, x, z, { y0 = 0, h = 24, w = 5, d = 5, form = 'twist', twist = 1.0, taper = 0.78, crown = 'spire', accent = L.cyan, seed = 1, rot = 0 } = {}) {
  const lerp = (a, b, t) => a + (b - a) * t;
  let section, flat = false;
  if (form === 'twist') section = (t) => rrectPts(w / 2 * lerp(1, taper, t), d / 2 * lerp(1, taper, t), Math.min(w, d) * 0.2 * lerp(1, taper, t), rot + t * twist);
  else if (form === 'blade') section = (t) => ellPts(w / 2 * lerp(1, taper, t * t), d / 2 * lerp(1, 0.55, t * t), rot);
  else if (form === 'crystal') {
    flat = true;
    section = (t) => { const k = Math.floor(t * 5 + 1e-6), off = (k % 2) * Math.PI / 6, rr = Math.min(w, d) / 2 * lerp(1, taper, t); const out = []; for (let i = 0; i < 6; i++) { const a = rot + off + i * Math.PI / 3; out.push([Math.cos(a) * rr * (i % 2 ? 1.0 : 0.86) * (w / Math.min(w, d)), Math.sin(a) * rr * (d / Math.min(w, d))]); } return out; };
  }
  const levels = form === 'crystal' ? 5 : Math.max(10, Math.round(h / 1.2));
  M.add('mirror', loft(section, levels, h, y0, flat), { pos: v(x, 0, z), color: 0xffffff });
  // dark floor bands every 3.6 m, standing just proud of the glass
  if (form !== 'crystal') for (let y = 3.6; y < h - 0.5; y += 3.6) {
    const t = y / h, sec = section(t).map(([a, b]) => [a * 1.012, b * 1.012]);
    M.add('metal', loft(() => sec, 1, 0.14, y0 + y - 0.07), { pos: v(x, 0, z), color: C.D });
  }
  // corner mullions following the twist, one of them a light line in the building's colour
  const n0 = section(0).length, step = Math.max(1, Math.round(n0 / 4));
  for (let i = 0; i < n0; i += step) {
    const pts = [];
    for (let j = 0; j <= 8; j++) { const t = j / 8, q = section(t)[i]; pts.push([x + q[0] * 1.02, y0 + t * h, z + q[1] * 1.02]); }
    M.tube(i === 0 ? 'emissive' : 'metal', pts, i === 0 ? 0.05 : 0.08, i === 0 ? accent : C.G2, 5);
  }
  // crown
  const top = y0 + h, tw = Math.min(w, d) * taper;
  if (crown === 'spire') {
    M.cyl('metal', x, top, z, tw * 0.14, h * 0.32, C.W2, 10, 0.02);
    M.sphere('blink', x, top + h * 0.32, z, 0.16, L.red, 8);
  } else if (crown === 'ring') {
    M.add('emissive', new THREE.TorusGeometry(tw * 0.48, 0.07, 6, 40), { pos: v(x, top + 0.9, z), rot: e(Math.PI / 2, 0, 0), color: accent });
    M.add('glass', new THREE.SphereGeometry(tw * 0.38, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), { pos: v(x, top, z) });
    M.cyl('metal', x, top + tw * 0.36, z, 0.05, 3.0, C.G2, 6);
    M.sphere('blink', x, top + tw * 0.36 + 3.0, z, 0.12, L.red, 8);
  } else if (crown === 'pad') {
    M.cyl('metal', x, top, z, tw * 0.62, 0.22, C.D, 32);
    M.add('hull', new THREE.TorusGeometry(tw * 0.45, 0.05, 4, 32), { pos: v(x, top + 0.24, z), rot: e(Math.PI / 2, 0, 0), color: C.Y });
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; M.sphere('blink', x + Math.cos(a) * tw * 0.58, top + 0.26, z + Math.sin(a) * tw * 0.58, 0.06, accent, 6); }
  }
  M.colCyl(x, z, Math.min(w, d) * 0.45, y0, top);
  return top;
}

// a stack of glass floor plates sliding past each other, with planted terraces
export function stackTower(M, x, z, { y0 = 0, w = 7, d = 5.5, plates = 4, ph = 3.4, shift = 1.1, accent = L.cyan } = {}) {
  let y = y0;
  for (let i = 0; i < plates; i++) {
    const ox = (i % 2 ? 1 : -1) * shift * 0.5, oz = (i % 3 - 1) * shift * 0.35, pw = w - (i % 2) * 0.8;
    const g = new THREE.ExtrudeGeometry(roundRect(pw, d, 0.9), { depth: ph - 0.3, bevelEnabled: false, curveSegments: 8 });
    g.rotateX(-Math.PI / 2);
    M.add('mirror', g, { pos: v(x + ox, y + 0.15, z + oz), color: 0xffffff });
    const sl = new THREE.ExtrudeGeometry(roundRect(pw + 0.5, d + 0.5, 1.1), { depth: 0.3, bevelEnabled: false, curveSegments: 8 });
    sl.rotateX(-Math.PI / 2);
    M.add('hull', sl, { pos: v(x + ox, y - 0.15, z + oz), color: C.W });
    // terrace planting along the overhang
    for (let k = 0; k < 5; k++) M.sphere('plant', x + ox + (k - 2) * pw / 5, y + 0.4, z + oz - d / 2 - 0.05, 0.3, k % 2 ? 0x3d7f3a : 0x4f8a3e, 7, 0.75);
    M.add('emissive', new THREE.BoxGeometry(pw * 0.8, 0.04, 0.04), { pos: v(x + ox, y + 0.02, z + oz - d / 2 - 0.26), color: accent });
    y += ph;
  }
  const roof = new THREE.ExtrudeGeometry(roundRect(w, d, 0.9), { depth: 0.3, bevelEnabled: false, curveSegments: 8 });
  roof.rotateX(-Math.PI / 2);
  M.add('hull', roof, { pos: v(x, y - 0.15, z), color: C.W });
  M.col(x - w / 2 - shift, y0, z - d / 2 - shift, x + w / 2 + shift, y, z + d / 2 + shift);
  return y + 0.15;
}

// Industrial shed: concrete dado, ribbed metal cladding, high window strip,
// shutter door, sawtooth north-light roof (teeth along x), gutter.
export function shed(M, cx, cz, w, d, h, { teeth = 4, rise = 1.4, door = 3.0, color = C.W2 } = {}) {
  const t = 0.3;
  const hi = (st, len) => bays(len, { bay: 2.0, w: 1.6, sill: h - 1.45, head: h - 0.55 });
  const front = (st, len) => [...hi(st, len).filter((o) => Math.abs(o.c) > door / 2 + 1.0), { c: 0, w: door, y: 0, h: Math.min(3.4, h - 1.0), kind: 'shutter' }];
  const opt = { key: 'rib', color: 0xd9dde1, dado: 0.9, dadoKey: 'metal', dadoColor: 0x6f757c };
  facade(M, cx, cz - d / 2, Math.PI, w, 0, 1, h, front, { ...opt, lines: false });
  facade(M, cx, cz + d / 2, 0, w, 0, 1, h, hi, { ...opt, lines: false });
  facade(M, cx - w / 2, cz, -Math.PI / 2, d - 2 * t, 0, 1, h, hi, { ...opt, lines: false });
  facade(M, cx + w / 2, cz, Math.PI / 2, d - 2 * t, 0, 1, h, hi, { ...opt, lines: false });
  const tw = w / teeth, sl = Math.hypot(tw, rise), ang = Math.atan2(rise, tw);
  for (let i = 0; i < teeth; i++) {
    const x0 = cx - w / 2 + i * tw;
    M.add('rib', new THREE.BoxGeometry(sl, 0.12, d + 0.2), { pos: v(x0 + tw / 2, h + rise / 2, cz), rot: e(0, 0, ang), color: C.G });
    M.add('glass', new THREE.BoxGeometry(0.05, rise - 0.1, d - 0.3), { pos: v(x0 + tw - 0.03, h + rise / 2, cz) });
    for (let k = 0; k <= Math.round(d / 1.5); k++) M.add('metal', new THREE.BoxGeometry(0.07, rise, 0.06), { pos: v(x0 + tw - 0.01, h + rise / 2, cz - d / 2 + 0.15 + k * (d - 0.3) / Math.round(d / 1.5)), color: C.D });
    // gable triangles closing each tooth at both ends
    const tri = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(tw, 0), new THREE.Vector2(tw, rise)]);
    for (const zz of [cz - d / 2 - 0.05, cz + d / 2 - 0.1]) M.add('rib', new THREE.ExtrudeGeometry(tri, { depth: 0.15, bevelEnabled: false }), { pos: v(x0, h, zz), color });
  }
  M.add('metal', new THREE.BoxGeometry(w + 0.3, 0.2, 0.25), { pos: v(cx, h - 0.1, cz - d / 2 - 0.1), color: C.G2 });
  M.add('metal', new THREE.BoxGeometry(w + 0.3, 0.2, 0.25), { pos: v(cx, h - 0.1, cz + d / 2 + 0.1), color: C.G2 });
  for (const sx of [-1, 1]) M.add('metal', new THREE.CylinderGeometry(0.06, 0.06, h, 8), { pos: v(cx + sx * (w / 2 + 0.05), h / 2, cz - d / 2 - 0.12), color: C.G2 });
  canopy(M, cx, cz - d / 2, Math.PI, door + 1.2, 1.8, Math.min(3.4, h - 1.0) + 0.45, null);
  M.col(cx - w / 2, 0, cz - d / 2, cx + w / 2, h + rise, cz + d / 2);
}

// Tubular pressurised entry module along -z from z0 (inside the hab) to its
// end at z1: flanged end with a recessed bulkhead and a rounded pressure
// hatch that sits inside the tube's circle (frame, leaf, viewport, lever,
// hinges), status light, lamp, saddles and a step.
function roundRect(w, h, rr) {
  const s = new THREE.Shape();
  const x0 = -w / 2, y0 = -h / 2;
  s.moveTo(x0 + rr, y0);
  s.lineTo(x0 + w - rr, y0); s.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + rr);
  s.lineTo(x0 + w, y0 + h - rr); s.quadraticCurveTo(x0 + w, y0 + h, x0 + w - rr, y0 + h);
  s.lineTo(x0 + rr, y0 + h); s.quadraticCurveTo(x0, y0 + h, x0, y0 + h - rr);
  s.lineTo(x0, y0 + rr); s.quadraticCurveTo(x0, y0, x0 + rr, y0);
  return s;
}
export function airlockTube(M, x, y, z0, z1, r = 1.15, color = C.W) {
  const len = z0 - z1;
  M.add('hull', new THREE.CylinderGeometry(r, r, len, 40, 1, true), { pos: v(x, y, (z0 + z1) / 2), rot: e(PI2, 0, 0), color });
  M.add('metal', new THREE.TorusGeometry(r + 0.02, 0.07, 8, 40), { pos: v(x, y, z1 + 0.03), color: C.G2 });
  M.add('metal', new THREE.TorusGeometry(r + 0.02, 0.045, 6, 40), { pos: v(x, y, z1 + len * 0.55), color: C.G2 });
  M.add('hull', new THREE.CylinderGeometry(r - 0.01, r - 0.01, 0.06, 40), { pos: v(x, y, z1 + 0.16), rot: e(PI2, 0, 0), color: C.W2 });
  // hatch: frame proud of the bulkhead, leaf set into it
  const dw = 0.95, dh = Math.min(1.95, 2 * r - 0.4), dc = y - r + 0.2 + dh / 2;
  const ring = roundRect(dw + 0.24, dh + 0.24, 0.42);
  ring.holes.push(roundRect(dw, dh, 0.32));
  const fr = new THREE.ExtrudeGeometry(ring, { depth: 0.12, bevelEnabled: false, curveSegments: 6 }); fr.rotateY(Math.PI);
  M.add('metal', fr, { pos: v(x, dc, z1 + 0.04 + 0.12), color: C.G2 });
  const leaf = new THREE.ExtrudeGeometry(roundRect(dw - 0.03, dh - 0.03, 0.3), { depth: 0.06, bevelEnabled: false, curveSegments: 6 }); leaf.rotateY(Math.PI);
  M.add('hull', leaf, { pos: v(x, dc, z1 + 0.1 + 0.06), color: C.W2 });
  const vy = dc + dh * 0.22;
  M.add('glass', new THREE.CylinderGeometry(0.14, 0.14, 0.04, 20), { pos: v(x, vy, z1 + 0.085), rot: e(PI2, 0, 0) });
  M.add('metal', new THREE.TorusGeometry(0.15, 0.03, 6, 20), { pos: v(x, vy, z1 + 0.08), color: C.D });
  M.add('metal', new THREE.CylinderGeometry(0.06, 0.06, 0.06, 12), { pos: v(x + dw * 0.3, dc - 0.05, z1 + 0.07), rot: e(PI2, 0, 0), color: C.D });
  M.add('metal', new THREE.BoxGeometry(0.26, 0.045, 0.04), { pos: v(x + dw * 0.3 - 0.1, dc - 0.05, z1 + 0.04), color: C.D });
  for (const sy of [-1, 1]) M.add('metal', new THREE.BoxGeometry(0.09, 0.22, 0.1), { pos: v(x - dw / 2 - 0.13, dc + sy * dh * 0.3, z1 + 0.07), color: C.D });
  M.add('metal', new THREE.BoxGeometry(0.12, 0.2, 0.05), { pos: v(x + dw / 2 + 0.32, dc + 0.35, z1 + 0.12), color: C.D });
  M.add('emissive', new THREE.BoxGeometry(0.06, 0.06, 0.02), { pos: v(x + dw / 2 + 0.32, dc + 0.4, z1 + 0.09), color: L.green });
  // lamp on the crown of the tube, saddles, step
  M.add('metal', new THREE.BoxGeometry(0.3, 0.1, 0.22), { pos: v(x, y + r + 0.03, z1 + 0.35), color: C.D });
  M.add('emissive', new THREE.BoxGeometry(0.22, 0.02, 0.14), { pos: v(x, y + r - 0.02, z1 + 0.35), color: L.warm });
  for (const t of [0.3, 0.75]) M.add('metal', new THREE.BoxGeometry(r * 1.3, Math.max(0.05, y - r * 0.6), 0.24), { pos: v(x, Math.max(0.05, y - r * 0.6) / 2, z1 + len * t), color: C.G2 });
  const sill = dc - dh / 2;
  if (sill > 0.08) M.add('concrete', new THREE.BoxGeometry(1.2, sill, 0.5), { pos: v(x, sill / 2, z1 - 0.25), color: C.CONC });
  M.col(x - r, 0, z1, x + r, y + r, z0);
  M.light(x, y + r - 0.2, z1 - 0.6, L.warm, 1.4, 6);
}

// Ground-mounted photovoltaic rack, tilted to the sun (south = +z here)
export function pvRack(M, x, z, w, d, rot = 0, n = 2, y0 = 0) {
  const c = Math.cos(rot), s = Math.sin(rot);
  const P = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  for (let i = 0; i < n; i++) {
    const lx = -w / 2 + (i + 0.5) * w / n;
    const [px, pz] = P(lx, 0);
    M.add('solar', new THREE.BoxGeometry(w / n - 0.08, 0.05, d), { pos: v(px, y0 + 1.05, pz), rot: new THREE.Euler(0.5, rot, 0, 'YXZ') });
    for (const lz of [-d * 0.35, d * 0.35]) { const [qx, qz] = P(lx, lz); M.cyl('metal', qx, y0, qz, 0.05, 1.05 - lz * 0.5, C.G2, 6); }
  }
  const [bx, bz] = P(0, 0);
  M.box('metal', bx, y0 + 1.0, bz, w, 0.08, 0.08, C.G, rot);
}

export { v, e };
