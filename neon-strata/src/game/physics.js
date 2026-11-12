// Lightweight static collision world: yaw-oriented boxes, vertical cylinders, discs and ramps in a 2D hash grid.
// Enough for a character controller (ground / step / wall slide) and flying vehicles (sphere push-out).
const BOX = 0, CYL = 1, RAMP = 2, RING = 3;

export class Physics {
  constructor(cell = 32, extent = 6200) {
    this.cell = cell; this.extent = extent; this.n = Math.ceil((extent * 2) / cell);
    this.grid = new Map();
    this.c = []; // collider records
    this.dyn = []; // dynamic colliders (elevators …) tested every query
    this._seen = new Uint32Array(1024); this._stamp = 1;
  }
  _key(ix, iz) { return ix * 4096 + iz; }
  _insert(id, minX, minZ, maxX, maxZ) {
    const c = this.cell, e = this.extent;
    const x0 = Math.max(0, Math.floor((minX + e) / c)), x1 = Math.min(this.n - 1, Math.floor((maxX + e) / c));
    const z0 = Math.max(0, Math.floor((minZ + e) / c)), z1 = Math.min(this.n - 1, Math.floor((maxZ + e) / c));
    for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) {
      const k = this._key(ix, iz); let a = this.grid.get(k); if (!a) { a = []; this.grid.set(k, a); } a.push(id);
    }
  }
  _add(o) {
    const id = this.c.length; this.c.push(o);
    if (this._seen.length <= id) { const s = new Uint32Array(this._seen.length * 2); s.set(this._seen); this._seen = s; }
    return id;
  }
  // solid oriented box. top surface walkable.
  addBox(cx, cz, hx, hz, yaw, y0, y1, tag = 0) {
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    const ex = Math.abs(hx * cs) + Math.abs(hz * sn), ez = Math.abs(hx * sn) + Math.abs(hz * cs);
    const o = { t: BOX, cx, cz, hx, hz, cs, sn, y0, y1, tag };
    const id = this._add(o); this._insert(id, cx - ex, cz - ez, cx + ex, cz + ez); return o;
  }
  addCyl(cx, cz, r, y0, y1, tag = 0) { const o = { t: CYL, cx, cz, r, y0, y1, tag }; const id = this._add(o); this._insert(id, cx - r, cz - r, cx + r, cz + r); return o; }
  // annulus (ring floor / hollow tower wall): solid between r0..r1, optional angular gap list [[a0,a1],...] (radians) left open
  addRing(cx, cz, r0, r1, y0, y1, gaps = null, tag = 0) { const o = { t: RING, cx, cz, r: r1, r0, y0, y1, gaps, tag }; const id = this._add(o); this._insert(id, cx - r1, cz - r1, cx + r1, cz + r1); return o; }
  // ramp: box whose top rises from yA (local -x end) to yB (local +x end)
  addRamp(cx, cz, hx, hz, yaw, yA, yB, thick = 1) {
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    const ex = Math.abs(hx * cs) + Math.abs(hz * sn), ez = Math.abs(hx * sn) + Math.abs(hz * cs);
    const o = { t: RAMP, cx, cz, hx, hz, cs, sn, y0: Math.min(yA, yB) - thick, y1: Math.max(yA, yB), yA, yB, thick };
    const id = this._add(o); this._insert(id, cx - ex, cz - ez, cx + ex, cz + ez); return o;
  }
  addDynamic(o) { this.dyn.push(o); return o; } // {t:BOX,...} updated by owner

  _query(x, z, r, out) {
    out.length = 0;
    const c = this.cell, e = this.extent;
    const x0 = Math.floor((x - r + e) / c), x1 = Math.floor((x + r + e) / c), z0 = Math.floor((z - r + e) / c), z1 = Math.floor((z + r + e) / c);
    const stamp = ++this._stamp;
    for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) {
      const a = this.grid.get(this._key(ix, iz)); if (!a) continue;
      for (let i = 0; i < a.length; i++) { const id = a[i]; if (this._seen[id] !== stamp) { this._seen[id] = stamp; out.push(this.c[id]); } }
    }
    for (let i = 0; i < this.dyn.length; i++) out.push(this.dyn[i]);
    return out;
  }
  // signed horizontal distance info for point vs collider; returns penetration push (px,pz) if inside expanded by r
  _inside(o, x, z, r) {
    if (o.t === CYL) { const dx = x - o.cx, dz = z - o.cz; return dx * dx + dz * dz < (o.r + r) * (o.r + r); }
    if (o.t === RING) {
      const dx = x - o.cx, dz = z - o.cz, d = Math.hypot(dx, dz);
      if (d > o.r + r || d < o.r0 - r) return false;
      if (o.gaps) { const a = Math.atan2(dz, dx); for (const g of o.gaps) { let da = a - g[0]; da -= Math.floor(da / 6.283185) * 6.283185; if (da < g[1] - g[0]) return false; } }
      return true;
    }
    const dx = x - o.cx, dz = z - o.cz;
    const lx = dx * o.cs - dz * o.sn, lz = dx * o.sn + dz * o.cs;
    return Math.abs(lx) < o.hx + r && Math.abs(lz) < o.hz + r;
  }
  _top(o, x, z) {
    if (o.t !== RAMP) return o.y1;
    const dx = x - o.cx, dz = z - o.cz; const lx = dx * o.cs - dz * o.sn;
    const t = Math.max(0, Math.min(1, (lx + o.hx) / (2 * o.hx)));
    return o.yA + (o.yB - o.yA) * t;
  }
  // highest walkable surface under (x,z) not above yMax. Returns height (base ground = 0).
  groundAt(x, z, yMax, r = 0.05) {
    const q = this._query(x, z, r + 0.01, this._q1 || (this._q1 = []));
    let best = 0; let hit = null;
    for (let i = 0; i < q.length; i++) {
      const o = q[i]; if (!this._inside(o, x, z, r)) continue;
      const top = this._top(o, x, z);
      if (top <= yMax && top > best) { best = top; hit = o; }
    }
    this.lastGround = hit;
    return best;
  }
  // lowest underside above y (head clearance); Infinity if open
  ceilingAt(x, z, y, r = 0.05) {
    const q = this._query(x, z, r + 0.01, this._q1 || (this._q1 = []));
    let best = Infinity;
    for (let i = 0; i < q.length; i++) { const o = q[i]; if (!this._inside(o, x, z, r)) continue; const bot = o.t === RAMP ? this._top(o, x, z) - o.thick : o.y0; if (bot >= y && bot < best) best = bot; }
    return best;
  }
  // resolve a vertical capsule (radius r, from yLow to yHigh) against walls; mutates p {x,z}. Returns true if touched.
  slide(p, r, yLow, yHigh) {
    const q = this._query(p.x, p.z, r + 0.5, this._q2 || (this._q2 = []));
    let touched = false;
    for (let it = 0; it < 3; it++) {
      let any = false;
      for (let i = 0; i < q.length; i++) {
        const o = q[i];
        const top = o.t === RAMP ? this._top(o, p.x, p.z) : o.y1;
        const bot = o.t === RAMP ? top - o.thick : o.y0;
        if (top <= yLow || bot >= yHigh) continue;
        if (o.t === CYL) {
          const dx = p.x - o.cx, dz = p.z - o.cz, d = Math.hypot(dx, dz), R = o.r + r;
          if (d < R) { const k = d > 1e-5 ? (R - d) / d : 0; p.x += dx * k + (d <= 1e-5 ? R : 0); p.z += dz * k; any = true; }
        } else if (o.t === RING) {
          const dx = p.x - o.cx, dz = p.z - o.cz, d = Math.hypot(dx, dz) || 1e-5;
          if (d < o.r + r && d > o.r0 - r) {
            let open = false;
            if (o.gaps) { const a = Math.atan2(dz, dx); for (const g of o.gaps) { let da = a - g[0]; da -= Math.floor(da / 6.283185) * 6.283185; if (da < g[1] - g[0]) { open = true; break; } } }
            if (!open) { const mid = (o.r + o.r0) / 2; const target = d > mid ? o.r + r : o.r0 - r; p.x = o.cx + (dx / d) * target; p.z = o.cz + (dz / d) * target; any = true; }
          }
        } else {
          const dx = p.x - o.cx, dz = p.z - o.cz;
          let lx = dx * o.cs - dz * o.sn, lz = dx * o.sn + dz * o.cs;
          const ox = o.hx + r - Math.abs(lx), oz = o.hz + r - Math.abs(lz);
          if (ox > 0 && oz > 0) {
            if (ox < oz) lx += lx > 0 ? ox : -ox; else lz += lz > 0 ? oz : -oz;
            p.x = o.cx + lx * o.cs + lz * o.sn; p.z = o.cz - lx * o.sn + lz * o.cs; any = true;
          }
        }
      }
      if (!any) break; touched = true;
    }
    return touched;
  }
  // 3D sphere push-out for vehicles. p {x,y,z}; returns hit normal-ish strength (0 if none) and writes this.hitN
  sphere(p, r) {
    const q = this._query(p.x, p.z, r + 0.5, this._q3 || (this._q3 = []));
    let hit = 0; const N = this.hitN || (this.hitN = { x: 0, y: 0, z: 0 });
    for (let i = 0; i < q.length; i++) {
      const o = q[i];
      const top = o.t === RAMP ? this._top(o, p.x, p.z) : o.y1, bot = o.t === RAMP ? top - o.thick : o.y0;
      if (p.y - r >= top || p.y + r <= bot) continue;
      if (!this._inside(o, p.x, p.z, r)) continue;
      // vertical escape distances
      const upD = top - (p.y - r), dnD = (p.y + r) - bot;
      // horizontal escape distance
      let hx = 0, hz = 0, hD = Infinity;
      if (o.t === CYL) { const dx = p.x - o.cx, dz = p.z - o.cz, d = Math.hypot(dx, dz) || 1e-5; hD = o.r + r - d; hx = dx / d; hz = dz / d; }
      else if (o.t === RING) { const dx = p.x - o.cx, dz = p.z - o.cz, d = Math.hypot(dx, dz) || 1e-5; const out = o.r + r - d, inn = d - (o.r0 - r); if (out < inn) { hD = out; hx = dx / d; hz = dz / d; } else { hD = inn; hx = -dx / d; hz = -dz / d; } }
      else {
        const dx = p.x - o.cx, dz = p.z - o.cz; const lx = dx * o.cs - dz * o.sn, lz = dx * o.sn + dz * o.cs;
        const ox = o.hx + r - Math.abs(lx), oz = o.hz + r - Math.abs(lz);
        if (ox < oz) { hD = ox; const s = lx > 0 ? 1 : -1; hx = s * o.cs; hz = -s * o.sn; } else { hD = oz; const s = lz > 0 ? 1 : -1; hx = s * o.sn; hz = s * o.cs; }
      }
      if (upD <= hD && upD <= dnD) { p.y += upD; N.x = 0; N.y = 1; N.z = 0; hit = Math.max(hit, upD); }
      else if (dnD <= hD) { p.y -= dnD; N.x = 0; N.y = -1; N.z = 0; hit = Math.max(hit, dnD); }
      else { p.x += hx * hD; p.z += hz * hD; N.x = hx; N.y = 0; N.z = hz; hit = Math.max(hit, hD); }
    }
    return hit;
  }
  // is a point inside any solid (camera collision probes)
  solidAt(x, y, z, r = 0.2) {
    const q = this._query(x, z, r + 0.01, this._q4 || (this._q4 = []));
    for (let i = 0; i < q.length; i++) { const o = q[i]; const top = o.t === RAMP ? this._top(o, x, z) : o.y1; const bot = o.t === RAMP ? top - o.thick : o.y0; if (y < top && y > bot && this._inside(o, x, z, r)) return true; }
    return false;
  }
  // march a segment; returns fraction (0..1) of free travel
  castSegment(x0, y0, z0, x1, y1, z1, r = 0.25, steps = 14) {
    for (let i = 1; i <= steps; i++) { const t = i / steps; if (y0 + (y1 - y0) * t < 0.15 || this.solidAt(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, z0 + (z1 - z0) * t, r)) return (i - 1) / steps; }
    return 1;
  }
}
export const COL = { BOX, CYL, RAMP, RING };
