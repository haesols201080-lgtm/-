// Static collision world: vertical cylinders (rocks, poles) and oriented boxes
// (building walls, floors, foundations) bucketed in a spatial hash.
const CELL = 16;

export class Colliders {
  constructor() {
    this.grid = new Map();
    this.nextId = 1;
    this.byOwner = new Map();
  }

  key(i, j) { return i * 73856093 ^ j * 19349663; }

  insert(c) {
    c.id = this.nextId++;
    const r = c.kind === 'cyl' ? c.r : Math.hypot(c.hx, c.hz);
    c.bound = r;
    const i0 = Math.floor((c.x - r) / CELL), i1 = Math.floor((c.x + r) / CELL);
    const j0 = Math.floor((c.z - r) / CELL), j1 = Math.floor((c.z + r) / CELL);
    c.cells = [];
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const k = this.key(i, j);
      let a = this.grid.get(k);
      if (!a) { a = []; this.grid.set(k, a); }
      a.push(c);
      c.cells.push(k);
    }
    if (c.owner != null) {
      let l = this.byOwner.get(c.owner);
      if (!l) { l = []; this.byOwner.set(c.owner, l); }
      l.push(c);
    }
    return c;
  }

  // Oriented box: centre (x,z), half extents hx,hz, yaw rot, vertical span y0..y1.
  addBox(x, z, hx, hz, rot, y0, y1, owner = null, flags = {}) {
    return this.insert({ kind: 'box', x, z, hx, hz, rot, c: Math.cos(rot), s: Math.sin(rot), y0, y1, owner, ...flags });
  }

  addCyl(x, z, r, y0, y1, owner = null, flags = {}) {
    return this.insert({ kind: 'cyl', x, z, r, y0, y1, owner, ...flags });
  }

  remove(c) {
    for (const k of c.cells) {
      const a = this.grid.get(k);
      if (!a) continue;
      const i = a.indexOf(c);
      if (i >= 0) a.splice(i, 1);
    }
    c.removed = true;
  }

  removeOwner(owner) {
    const l = this.byOwner.get(owner);
    if (!l) return;
    for (const c of l) this.remove(c);
    this.byOwner.delete(owner);
  }

  query(x, z, r, out = []) {
    out.length = 0;
    const seen = this._seen || (this._seen = new Set());
    seen.clear();
    const i0 = Math.floor((x - r) / CELL), i1 = Math.floor((x + r) / CELL);
    const j0 = Math.floor((z - r) / CELL), j1 = Math.floor((z + r) / CELL);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const a = this.grid.get(this.key(i, j));
      if (!a) continue;
      for (const c of a) {
        if (seen.has(c.id)) continue;
        seen.add(c.id);
        const dx = c.x - x, dz = c.z - z, rr = c.bound + r;
        if (dx * dx + dz * dz <= rr * rr) out.push(c);
      }
    }
    return out;
  }

  // Closest point on a collider's footprint to (x,z), in world space.
  // Returns penetration push vector for a circle of radius r, or null.
  pushCircle(c, x, z, r) {
    if (c.kind === 'cyl') {
      const dx = x - c.x, dz = z - c.z;
      const d = Math.hypot(dx, dz);
      const m = c.r + r;
      if (d >= m) return null;
      if (d < 1e-5) return { x: m, z: 0 };
      return { x: dx / d * (m - d), z: dz / d * (m - d) };
    }
    // to box local space
    const dx = x - c.x, dz = z - c.z;
    const lx = dx * c.c - dz * c.s, lz = dx * c.s + dz * c.c;
    const cx = Math.max(-c.hx, Math.min(c.hx, lx)), cz = Math.max(-c.hz, Math.min(c.hz, lz));
    let px = lx - cx, pz = lz - cz;
    const d = Math.hypot(px, pz);
    let ox, oz;
    if (d > 1e-6) {
      if (d >= r) return null;
      ox = px / d * (r - d); oz = pz / d * (r - d);
    } else {
      // centre inside the box: push out along the shallowest axis
      const ex = c.hx - Math.abs(lx), ez = c.hz - Math.abs(lz);
      if (ex < ez) { ox = Math.sign(lx || 1) * (ex + r); oz = 0; }
      else { ox = 0; oz = Math.sign(lz || 1) * (ez + r); }
    }
    // back to world
    return { x: ox * c.c + oz * c.s, z: -ox * c.s + oz * c.c };
  }

  // Is point (x,z) inside footprint (expanded by r)?
  overlaps(c, x, z, r) {
    if (c.kind === 'cyl') { const dx = x - c.x, dz = z - c.z; return dx * dx + dz * dz < (c.r + r) * (c.r + r); }
    const dx = x - c.x, dz = z - c.z;
    const lx = dx * c.c - dz * c.s, lz = dx * c.s + dz * c.c;
    return Math.abs(lx) < c.hx + r && Math.abs(lz) < c.hz + r;
  }

  // Highest walkable top at (x,z) that is at or below maxY.
  groundAt(x, z, r, maxY) {
    let best = -Infinity;
    for (const c of this.query(x, z, r, this._tmp || (this._tmp = []))) {
      if (c.y1 > maxY || c.noStand) continue;
      if (this.overlaps(c, x, z, c.kind === 'cyl' ? r * 0.5 : r * 0.6) && c.y1 > best) best = c.y1;
    }
    return best;
  }

  // Ray against collider boxes/cylinders (for placement & interaction).
  raycast(ox, oy, oz, dx, dy, dz, maxT, filter) {
    let best = null;
    const steps = Math.ceil(maxT / (CELL * 0.5));
    const seen = new Set();
    for (let s = 0; s <= steps; s++) {
      const t = Math.min(maxT, s * CELL * 0.5);
      const cand = this.query(ox + dx * t, oz + dz * t, CELL * 0.5, []);
      for (const c of cand) {
        if (seen.has(c.id)) continue;
        seen.add(c.id);
        if (filter && !filter(c)) continue;
        const hit = c.kind === 'box' ? rayBox(c, ox, oy, oz, dx, dy, dz) : rayCyl(c, ox, oy, oz, dx, dy, dz);
        if (hit && hit.t <= maxT && (!best || hit.t < best.t)) { best = hit; best.c = c; }
      }
      if (best && best.t < t) break;
    }
    return best;
  }
}

function rayBox(c, ox, oy, oz, dx, dy, dz) {
  const rx = ox - c.x, rz = oz - c.z;
  const lox = rx * c.c - rz * c.s, loz = rx * c.s + rz * c.c;
  const ldx = dx * c.c - dz * c.s, ldz = dx * c.s + dz * c.c;
  const ymid = (c.y0 + c.y1) / 2, hy = (c.y1 - c.y0) / 2;
  const lo = [lox, oy - ymid, loz], ld = [ldx, dy, ldz], he = [c.hx, hy, c.hz];
  let tmin = -Infinity, tmax = Infinity, axis = -1, sign = 1;
  for (let a = 0; a < 3; a++) {
    if (Math.abs(ld[a]) < 1e-9) { if (Math.abs(lo[a]) > he[a]) return null; continue; }
    let t1 = (-he[a] - lo[a]) / ld[a], t2 = (he[a] - lo[a]) / ld[a];
    let sg = -1;
    if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; sg = 1; }
    if (t1 > tmin) { tmin = t1; axis = a; sign = sg; }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }
  if (tmax < 0) return null;
  const t = tmin >= 0 ? tmin : 0;
  // normal in world space
  let nx = 0, ny = 0, nz = 0;
  if (axis === 1) ny = sign;
  else if (axis === 0) { nx = sign * c.c; nz = -sign * c.s; }
  else if (axis === 2) { nx = sign * c.s; nz = sign * c.c; }
  return { t, nx, ny, nz };
}

function rayCyl(c, ox, oy, oz, dx, dy, dz) {
  const fx = ox - c.x, fz = oz - c.z;
  const a = dx * dx + dz * dz;
  let t = Infinity, nx = 0, ny = 0, nz = 0;
  if (a > 1e-9) {
    const b = 2 * (fx * dx + fz * dz), cc = fx * fx + fz * fz - c.r * c.r;
    const disc = b * b - 4 * a * cc;
    if (disc >= 0) {
      const t0 = (-b - Math.sqrt(disc)) / (2 * a);
      const y = oy + dy * t0;
      if (t0 >= 0 && y >= c.y0 && y <= c.y1) { t = t0; nx = (fx + dx * t0) / c.r; nz = (fz + dz * t0) / c.r; }
    }
  }
  if (Math.abs(dy) > 1e-9) {
    const tt = (c.y1 - oy) / dy;
    if (tt >= 0 && tt < t) {
      const px = fx + dx * tt, pz = fz + dz * tt;
      if (px * px + pz * pz <= c.r * c.r) { t = tt; nx = 0; ny = 1; nz = 0; }
    }
  }
  return t < Infinity ? { t, nx, ny, nz } : null;
}
