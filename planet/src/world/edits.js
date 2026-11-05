// Player-made terrain edits (building pads, terrain tool strokes), applied on
// top of the generated planet in order. Spatially hashed so a height query
// only looks at edits nearby. Shared by the main thread and the workers.
import { smoothstep, lerp } from '../core/noise.js';

const CELL = 64;

// Road / path edit: graded corridor along a polyline with per-point target heights.
// Inside the half-width the ground is paved (mod = 1); the shoulders blend back.
function roadSample(e, x, z) {
  const P = e.pts;
  let best = 1e9, bt = 0, bi = 0;
  for (let i = 0; i < P.length - 3; i += 3) {
    const ax = P[i], az = P[i + 2], bx = P[i + 3], bz = P[i + 5];
    const dx = bx - ax, dz = bz - az;
    const L2 = dx * dx + dz * dz || 1;
    let t = ((x - ax) * dx + (z - az) * dz) / L2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const cx = ax + dx * t - x, cz = az + dz * t - z;
    const d = cx * cx + cz * cz;
    if (d < best) { best = d; bt = t; bi = i; }
  }
  return { d: Math.sqrt(best), y: P[bi + 1] + (P[bi + 4] - P[bi + 1]) * bt };
}

// Apply one edit to height h at (x,z); writes packed/paved value into res.mod.
export function applyEdit(e, x, z, h, res) {
  res.mod = 0;
  if (e.k === 'r') {
    const c = e.c ?? Math.cos(e.rot), s = e.s ?? Math.sin(e.rot);
    const dx = x - e.cx, dz = z - e.cz;
    const lx = dx * c - dz * s, lz = dx * s + dz * c;
    const ox = Math.max(0, Math.abs(lx) - e.hw), oz = Math.max(0, Math.abs(lz) - e.hd);
    const d = Math.sqrt(ox * ox + oz * oz);
    const m = Math.max(e.margin, Math.abs(h - e.h) * 1.8);
    if (d > m) return h;
    const t = d <= 0 ? 0 : smoothstep(0, m, d);
    if (e.pack !== false) res.mod = e.pave && d < e.pave ? 1 : (1 - smoothstep(0, e.margin, d)) * 0.9;
    return lerp(e.h, h, t);
  }
  if (e.k === 'p') {
    const r = roadSample(e, x, z);
    const hw = e.w / 2;
    // embankments widen with the cut/fill depth (about 1:2 slopes), never vertical walls
    const m = Math.max(e.margin, Math.abs(h - r.y) * 2.0);
    if (r.d > hw + m) return h;
    const t = r.d <= hw ? 0 : smoothstep(0, m, r.d - hw);
    res.mod = r.d <= hw ? 1 : 0.9 * (1 - t);
    return lerp(r.y, h, t);
  }
  const d = Math.hypot(x - e.cx, z - e.cz) / e.radius;
  if (d >= 1) return h;
  const w = (1 - d * d) * (1 - d * d);
  res.mod = w * 0.45;
  if (e.mode === 0) return lerp(h, e.target, Math.min(1, w * e.amount));
  return h + e.mode * e.amount * w;
}

export class EditSet {
  constructor() {
    this.list = [];
    this.grid = new Map();
  }

  key(i, j) { return (i + 1000) * 4001 + (j + 1000); }

  bounds(e) {
    if (e.k === 'r') { const R = Math.hypot(e.hw, e.hd) + (e.reach || e.margin); return [e.cx - R, e.cz - R, e.cx + R, e.cz + R]; }
    if (e.k === 'p') {
      let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
      for (let i = 0; i < e.pts.length; i += 3) { x0 = Math.min(x0, e.pts[i]); x1 = Math.max(x1, e.pts[i]); z0 = Math.min(z0, e.pts[i + 2]); z1 = Math.max(z1, e.pts[i + 2]); }
      const R = e.w / 2 + (e.reach || e.margin);
      return [x0 - R, z0 - R, x1 + R, z1 + R];
    }
    return [e.cx - e.radius, e.cz - e.radius, e.cx + e.radius, e.cz + e.radius];
  }

  add(e) {
    e.i = this.list.length;
    if (e.k === 'r') { e.c = Math.cos(e.rot); e.s = Math.sin(e.rot); }
    this.list.push(e);
    const [x0, z0, x1, z1] = this.bounds(e);
    for (let j = Math.floor(z0 / CELL); j <= Math.floor(z1 / CELL); j++)
      for (let i = Math.floor(x0 / CELL); i <= Math.floor(x1 / CELL); i++) {
        const k = this.key(i, j);
        let a = this.grid.get(k);
        if (!a) { a = []; this.grid.set(k, a); }
        a.push(e);
      }
    return e;
  }

  // apply to base height; returns height, writes packed-ground value into res.mod
  apply(x, z, h, res) {
    const a = this.grid.get(this.key(Math.floor(x / CELL), Math.floor(z / CELL)));
    let mod = 0;
    if (a) {
      const r = this._r || (this._r = { mod: 0 });
      for (const e of a) { h = applyEdit(e, x, z, h, r); if (r.mod > mod) mod = r.mod; }
    }
    if (res) res.mod = mod;
    return h;
  }

  touches(x0, z0, x1, z1, e) {
    const b = this.bounds(e);
    return !(b[2] < x0 || b[0] > x1 || b[3] < z0 || b[1] > z1);
  }
}
