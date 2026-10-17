// 2D oriented boxes on the ground plane, hashed in a grid. Used for walking
// into walls and for telescreen line of sight.
const CELL = 16;

export class Colliders {
  constructor() {
    this.boxes = [];
    this.grid = new Map();
  }

  key(i, j) { return i * 73856093 ^ j * 19349663; }

  add(cx, cz, hx, hz, rot = 0, opts = {}) {
    const b = { cx, cz, hx, hz, c: Math.cos(rot), s: Math.sin(rot), y0: opts.y0 ?? -10, y1: opts.y1 ?? 500,
      tag: opts.tag || '', sight: opts.sight ?? true, solid: opts.solid ?? true };
    const r = Math.hypot(hx, hz);
    b.r = r;
    this.boxes.push(b);
    for (let i = Math.floor((cx - r) / CELL); i <= Math.floor((cx + r) / CELL); i++) {
      for (let j = Math.floor((cz - r) / CELL); j <= Math.floor((cz + r) / CELL); j++) {
        const k = this.key(i, j);
        if (!this.grid.has(k)) this.grid.set(k, []);
        this.grid.get(k).push(b);
      }
    }
    return b;
  }

  // Box from a world-space Box3 (axis aligned), optionally shrunk.
  addBox3(box, opts = {}) {
    const pad = opts.pad ?? 0;
    return this.add((box.min.x + box.max.x) / 2, (box.min.z + box.max.z) / 2,
      (box.max.x - box.min.x) / 2 - pad, (box.max.z - box.min.z) / 2 - pad, 0,
      { ...opts, y0: box.min.y, y1: box.max.y });
  }

  near(x, z, r) {
    const out = new Set();
    for (let i = Math.floor((x - r) / CELL); i <= Math.floor((x + r) / CELL); i++) {
      for (let j = Math.floor((z - r) / CELL); j <= Math.floor((z + r) / CELL); j++) {
        const l = this.grid.get(this.key(i, j));
        if (l) for (const b of l) out.add(b);
      }
    }
    return out;
  }

  // Push a circle (x, z, radius) out of every box it overlaps. Mutates p.
  resolve(p, radius, y = 0, height = 1.7) {
    for (let it = 0; it < 3; it++) {
      let moved = false;
      for (const b of this.near(p.x, p.z, radius + 2)) {
        if (!b.solid || y + height < b.y0 || y > b.y1 - 0.4) continue;
        const dx = p.x - b.cx, dz = p.z - b.cz;
        const lx = dx * b.c - dz * b.s;
        const lz = dx * b.s + dz * b.c;
        const qx = Math.max(-b.hx, Math.min(b.hx, lx));
        const qz = Math.max(-b.hz, Math.min(b.hz, lz));
        let ox = lx - qx, oz = lz - qz;
        const d = Math.hypot(ox, oz);
        if (d >= radius) continue;
        let nx, nz, push;
        if (d > 1e-5) { nx = ox / d; nz = oz / d; push = radius - d; }
        else {
          const px = b.hx - Math.abs(lx), pz = b.hz - Math.abs(lz);
          if (px < pz) { nx = Math.sign(lx) || 1; nz = 0; push = px + radius; }
          else { nx = 0; nz = Math.sign(lz) || 1; push = pz + radius; }
        }
        // back to world space
        const wx = nx * b.c + nz * b.s;
        const wz = -nx * b.s + nz * b.c;
        p.x += wx * push; p.z += wz * push;
        moved = true;
      }
      if (!moved) break;
    }
    return p;
  }

  // Is the segment a->b blocked by any sight-blocking box between heights?
  blocked(ax, az, bx, bz, ay = 1.5, by = 1.5, ignore = null) {
    const minx = Math.min(ax, bx), maxx = Math.max(ax, bx), minz = Math.min(az, bz), maxz = Math.max(az, bz);
    const seen = new Set();
    for (let i = Math.floor(minx / CELL); i <= Math.floor(maxx / CELL); i++) {
      for (let j = Math.floor(minz / CELL); j <= Math.floor(maxz / CELL); j++) {
        const l = this.grid.get(this.key(i, j));
        if (!l) continue;
        for (const b of l) {
          if (seen.has(b) || !b.sight || b === ignore) continue;
          seen.add(b);
          if (Math.max(ay, by) < b.y0 || Math.min(ay, by) > b.y1) continue;
          if (segBox(ax, az, bx, bz, b)) return true;
        }
      }
    }
    return false;
  }

  inside(x, z, tag) {
    for (const b of this.near(x, z, 1)) {
      if (tag && b.tag !== tag) continue;
      const dx = x - b.cx, dz = z - b.cz;
      const lx = dx * b.c - dz * b.s, lz = dx * b.s + dz * b.c;
      if (Math.abs(lx) <= b.hx && Math.abs(lz) <= b.hz) return b;
    }
    return null;
  }
}

function segBox(ax, az, bx, bz, b) {
  const tx = (x, z) => [(x - b.cx) * b.c - (z - b.cz) * b.s, (x - b.cx) * b.s + (z - b.cz) * b.c];
  const [x0, z0] = tx(ax, az);
  const [x1, z1] = tx(bx, bz);
  // the endpoints themselves may sit just inside a wall; shrink slightly
  const hx = b.hx - 0.05, hz = b.hz - 0.05;
  let t0 = 0, t1 = 1;
  const dx = x1 - x0, dz = z1 - z0;
  const clip = (p, q) => {
    if (Math.abs(p) < 1e-9) return q >= 0;
    const r = q / p;
    if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
    else { if (r < t0) return false; if (r < t1) t1 = r; }
    return true;
  };
  if (clip(-dx, x0 + hx) && clip(dx, hx - x0) && clip(-dz, z0 + hz) && clip(dz, hz - z0)) {
    return t0 < t1 && t1 > 0.02 && t0 < 0.98;
  }
  return false;
}
