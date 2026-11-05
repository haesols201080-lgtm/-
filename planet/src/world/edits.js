// Player-made terrain edits (building pads, terrain tool strokes), applied on
// top of the generated planet in order. Spatially hashed so a height query
// only looks at edits nearby. Shared by the main thread and the workers.
import { smoothstep, lerp } from '../core/noise.js';

const CELL = 64;

export class EditSet {
  constructor() {
    this.list = [];
    this.grid = new Map();
  }

  key(i, j) { return (i + 1000) * 4001 + (j + 1000); }

  bounds(e) {
    if (e.k === 'r') { const R = Math.hypot(e.hw, e.hd) + e.margin; return [e.cx - R, e.cz - R, e.cx + R, e.cz + R]; }
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
      for (const e of a) {
        if (e.k === 'r') {
          const dx = x - e.cx, dz = z - e.cz;
          const lx = dx * e.c - dz * e.s, lz = dx * e.s + dz * e.c;
          const ox = Math.max(0, Math.abs(lx) - e.hw), oz = Math.max(0, Math.abs(lz) - e.hd);
          const d = Math.sqrt(ox * ox + oz * oz);
          if (d > e.margin) continue;
          const t = d <= 0 ? 0 : smoothstep(0, e.margin, d);
          h = lerp(e.h, h, t);
          if (e.pack !== false) mod = Math.max(mod, 1 - t);
        } else {
          const d = Math.hypot(x - e.cx, z - e.cz) / e.radius;
          if (d >= 1) continue;
          const w = (1 - d * d) * (1 - d * d);
          if (e.mode === 0) h = lerp(h, e.target, Math.min(1, w * e.amount));
          else h += e.mode * e.amount * w;
          mod = Math.max(mod, w * 0.45);
        }
      }
    }
    if (res) res.mod = mod;
    return h;
  }

  touches(x0, z0, x1, z1, e) {
    const b = this.bounds(e);
    return !(b[2] < x0 || b[0] > x1 || b[3] < z0 || b[1] > z1);
  }
}
