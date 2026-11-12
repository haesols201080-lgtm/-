// Geometry batching + procedural modelling pen. Everything in the city is emitted through this
// into a handful of merged, attribute-styled buffers (one draw call per chunk).
import * as THREE from 'three';
import { ST } from '../render/cityMaterial.js';

export class Batch {
  constructor(cap = 2048) {
    this.cap = cap; this.n = 0; this.icap = cap * 2; this.ni = 0;
    this.pos = new Float32Array(cap * 3); this.nrm = new Int8Array(cap * 3); this.uv = new Float32Array(cap * 2);
    this.col = new Uint8Array(cap * 4); this.sty = new Uint8Array(cap * 4); this.sty2 = new Uint8Array(cap * 4);
    this.idx = new Uint32Array(this.icap);
    this.s = [0, 0, 0, 0]; this.s2 = [0, 0, 0, 0]; this.c = [255, 255, 255];
    this.minX = Infinity; this.minY = Infinity; this.minZ = Infinity; this.maxX = -Infinity; this.maxY = -Infinity; this.maxZ = -Infinity;
  }
  _grow(nv, ni) {
    if (this.n + nv > this.cap) {
      let c = this.cap; while (this.n + nv > c) c *= 2;
      const g = (A, k) => { const a = new A.constructor(c * k); a.set(A); return a; };
      this.pos = g(this.pos, 3); this.nrm = g(this.nrm, 3); this.uv = g(this.uv, 2); this.col = g(this.col, 4); this.sty = g(this.sty, 4); this.sty2 = g(this.sty2, 4);
      this.cap = c;
    }
    if (this.ni + ni > this.icap) { let c = this.icap; while (this.ni + ni > c) c *= 2; const a = new Uint32Array(c); a.set(this.idx); this.idx = a; this.icap = c; }
  }
  // material state: m = {st, color:[r,g,b] 0..1, seed, A (0..1), B, cellW, floorH, flags, extra}
  use(m) {
    const s = this.s, s2 = this.s2, c = this.c;
    s[0] = m.st; s[1] = (m.seed ?? 0) & 255; s[2] = Math.max(0, Math.min(255, Math.round((m.A ?? 0) * 255))); s[3] = m.B ?? 0;
    s2[0] = Math.max(0, Math.min(255, Math.round((m.cellW ?? 3) * 10))); s2[1] = Math.max(0, Math.min(255, Math.round((m.floorH ?? 3.5) * 10)));
    s2[2] = m.flags ?? 0; s2[3] = Math.max(0, Math.min(255, Math.round(m.extra ?? 0)));
    const col = m.color || [1, 1, 1];
    c[0] = Math.max(0, Math.min(255, col[0] * 255)); c[1] = Math.max(0, Math.min(255, col[1] * 255)); c[2] = Math.max(0, Math.min(255, col[2] * 255));
    this.cur = m;
    return this;
  }
  vert(x, y, z, nx, ny, nz, u, v, ao = 1) {
    if (this.n >= this.cap) this._grow(1, 0);
    const i = this.n++, i3 = i * 3, i4 = i * 4;
    this.pos[i3] = x; this.pos[i3 + 1] = y; this.pos[i3 + 2] = z;
    this.nrm[i3] = nx * 127; this.nrm[i3 + 1] = ny * 127; this.nrm[i3 + 2] = nz * 127;
    this.uv[i * 2] = u; this.uv[i * 2 + 1] = v;
    this.col[i4] = this.c[0]; this.col[i4 + 1] = this.c[1]; this.col[i4 + 2] = this.c[2]; this.col[i4 + 3] = ao * 255;
    this.sty[i4] = this.s[0]; this.sty[i4 + 1] = this.s[1]; this.sty[i4 + 2] = this.s[2]; this.sty[i4 + 3] = this.s[3];
    this.sty2[i4] = this.s2[0]; this.sty2[i4 + 1] = this.s2[1]; this.sty2[i4 + 2] = this.s2[2]; this.sty2[i4 + 3] = this.s2[3];
    if (x < this.minX) this.minX = x; if (x > this.maxX) this.maxX = x;
    if (y < this.minY) this.minY = y; if (y > this.maxY) this.maxY = y;
    if (z < this.minZ) this.minZ = z; if (z > this.maxZ) this.maxZ = z;
    return i;
  }
  tri(a, b, c) { if (this.ni + 3 > this.icap) this._grow(0, 3); this.idx[this.ni++] = a; this.idx[this.ni++] = b; this.idx[this.ni++] = c; }
  quadI(a, b, c, d) { if (this.ni + 6 > this.icap) this._grow(0, 6); const I = this.idx; let n = this.ni; I[n++] = a; I[n++] = b; I[n++] = c; I[n++] = a; I[n++] = c; I[n++] = d; this.ni = n; }
  get empty() { return this.ni === 0; }
  build() {
    const g = new THREE.BufferGeometry();
    const n = this.n;
    g.setAttribute('position', new THREE.BufferAttribute(this.pos.slice(0, n * 3), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(this.nrm.slice(0, n * 3), 3, true));
    g.setAttribute('uv', new THREE.BufferAttribute(this.uv.slice(0, n * 2), 2));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col.slice(0, n * 4), 4, true));
    g.setAttribute('aStyle', new THREE.BufferAttribute(this.sty.slice(0, n * 4), 4, false));
    g.setAttribute('aStyle2', new THREE.BufferAttribute(this.sty2.slice(0, n * 4), 4, false));
    g.setIndex(new THREE.BufferAttribute(n > 65535 ? this.idx.slice(0, this.ni) : new Uint16Array(this.idx.subarray(0, this.ni)), 1));
    const cx = (this.minX + this.maxX) / 2, cy = (this.minY + this.maxY) / 2, cz = (this.minZ + this.maxZ) / 2;
    const r = Math.hypot(this.maxX - this.minX, this.maxY - this.minY, this.maxZ - this.minZ) / 2;
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(cx, cy, cz), r);
    g.boundingBox = new THREE.Box3(new THREE.Vector3(this.minX, this.minY, this.minZ), new THREE.Vector3(this.maxX, this.maxY, this.maxZ));
    this.pos = this.nrm = this.uv = this.col = this.sty = this.sty2 = this.idx = null; // free
    return g;
  }
}

export const isWindowStyle = (st) => st >= 10 && st <= 19 && st !== ST.MEGAHULL;
export const M = (st, o = {}) => ({ st, ...o });

let faceCounter = 1;

// Modelling pen: local frame (origin + yaw) → world, emits into a Batch.
export class Pen {
  constructor(batch) { this.b = batch; this.ox = 0; this.oy = 0; this.oz = 0; this.c = 1; this.s = 0; this.yaw = 0; }
  to(batch) { this.b = batch; return this; }
  at(x, y, z, yaw = 0) { this.ox = x; this.oy = y; this.oz = z; this.yaw = yaw; this.c = Math.cos(yaw); this.s = Math.sin(yaw); return this; }
  wx(x, z) { return this.ox + x * this.c + z * this.s; }
  wz(x, z) { return this.oz - x * this.s + z * this.c; }
  use(m) { this.b.use(m); return this; }

  // raw quad in local space, CCW seen from outside; uv given per corner (a=bl, b=br, c=tr, d=tl)
  quad(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, u0, v0, u1, v1, aoB = 1, aoT = 1) {
    const b = this.b, C = this.c, S = this.s, ox = this.ox, oy = this.oy, oz = this.oz;
    const AX = ox + ax * C + az * S, AZ = oz - ax * S + az * C, BX = ox + bx * C + bz * S, BZ = oz - bx * S + bz * C;
    const CX = ox + cx * C + cz * S, CZ = oz - cx * S + cz * C, DX = ox + dx * C + dz * S, DZ = oz - dx * S + dz * C;
    const AY = oy + ay, BY = oy + by, CY = oy + cy, DY = oy + dy;
    // normal from diagonals
    const e1x = CX - AX, e1y = CY - AY, e1z = CZ - AZ, e2x = DX - BX, e2y = DY - BY, e2z = DZ - BZ;
    let nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const i0 = b.vert(AX, AY, AZ, nx, ny, nz, u0, v0, aoB), i1 = b.vert(BX, BY, BZ, nx, ny, nz, u1, v0, aoB);
    const i2 = b.vert(CX, CY, CZ, nx, ny, nz, u1, v1, aoT), i3 = b.vert(DX, DY, DZ, nx, ny, nz, u0, v1, aoT);
    b.quadI(i0, i1, i2, i3);
  }

  // facade uv helper: returns [u0,v0,u1,v1] for a wall of given length/height using the current material
  _fuv(len, y0, y1, uStart = 0) {
    const m = this.b.cur;
    if (isWindowStyle(m.st)) {
      const cw = m.cellW ?? 3, fh = m.floorH ?? 3.5;
      const nx = Math.max(1, Math.round(len / cw)), ny = Math.max(1, Math.round((y1 - y0) / fh));
      const off = (faceCounter = (faceCounter * 31 + 7) % 997);
      const vo = Math.round((this.oy + y0) / fh) % 500;
      return [off, vo, off + nx, vo + ny];
    }
    return [uStart, this.oy + y0, uStart + len, this.oy + y1];
  }

  // vertical (or sloped: top inset) wall from (x0,z0) to (x1,z1); outward normal = cross(dir, up)
  wall(x0, z0, x1, z1, y0, y1, o = {}) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    if (len < 1e-4 || y1 - y0 < 1e-4) return;
    const uv = o.uv || this._fuv(len, y0, y1, o.u0 || 0);
    const tx0 = o.tx0 ?? x0, tz0 = o.tz0 ?? z0, tx1 = o.tx1 ?? x1, tz1 = o.tz1 ?? z1;
    this.quad(x0, y0, z0, x1, y0, z1, tx1, y1, tz1, tx0, y1, tz0, uv[0], uv[1], uv[2], uv[3], o.aoB ?? 1, o.aoT ?? 1);
  }
  // horizontal quad (facing up or down), uv in local metres
  flat(x0, z0, x1, z1, y, up = true, ao = 1) {
    const ux0 = this.wx(x0, z0), uz0 = this.wz(x0, z0);
    if (up) this.quad(x0, y, z1, x1, y, z1, x1, y, z0, x0, y, z0, x0, z1, x1, z0, ao, ao);
    else this.quad(x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1, x0, z0, x1, z1, ao, ao);
    return ux0 + uz0;
  }
  // axis-aligned (in pen frame) box. o: {wall, roof, bottom, sides (bitmask 1:+z 2:+x 4:-z 8:-x), aoB, taper}
  box(cx, cz, sx, sz, y0, y1, o = {}) {
    const hx = sx / 2, hz = sz / 2, x0 = cx - hx, x1 = cx + hx, z0 = cz - hz, z1 = cz + hz;
    const sides = o.sides ?? 15, aoB = o.aoB ?? 1, t = o.taper ?? 0;
    const tx0 = x0 + t, tx1 = x1 - t, tz0 = z0 + t, tz1 = z1 - t;
    if (o.wall) this.use(o.wall);
    if (sides & 1) this.wall(x0, z1, x1, z1, y0, y1, { aoB, tx0, tz0: tz1, tx1, tz1 });
    if (sides & 2) this.wall(x1, z1, x1, z0, y0, y1, { aoB, tx0: tx1, tz0: tz1, tx1, tz1: tz0 });
    if (sides & 4) this.wall(x1, z0, x0, z0, y0, y1, { aoB, tx0: tx1, tz0, tx1: tx0, tz1: tz0 });
    if (sides & 8) this.wall(x0, z0, x0, z1, y0, y1, { aoB, tx0, tz0, tx1: tx0, tz1 });
    if (o.roof !== null) { if (o.roof) this.use(o.roof); this.flat(tx0, tz0, tx1, tz1, y1, true, o.aoRoof ?? 1); }
    if (o.bottom) { this.use(o.bottom === true ? this.b.cur : o.bottom); this.flat(x0, z0, x1, z1, y0, false, o.aoBottom ?? 0.6); }
  }
  // loft through rings: rings = [{y, pts:[[x,z],...]}], all with the same point count (CCW seen from above = outward walls)
  loft(rings, o = {}) {
    const n = rings[0].pts.length;
    if (o.wall) this.use(o.wall);
    const m = this.b.cur, win = isWindowStyle(m.st);
    // perimeter (ring 0) for uv
    const segLen = []; let per = 0;
    for (let i = 0; i < n; i++) { const a = rings[0].pts[i], b = rings[0].pts[(i + 1) % n]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]); segLen.push(l); per += l; }
    const cw = m.cellW ?? 3, fh = m.floorH ?? 3.5;
    const uoff = win ? (faceCounter = (faceCounter * 31 + 7) % 997) : 0;
    const smoothN = !!o.smooth;
    for (let r = 0; r < rings.length - 1; r++) {
      const A = rings[r], B = rings[r + 1];
      if (B.y - A.y < 1e-4) continue;
      let u = 0;
      const v0 = win ? Math.round(A.y / fh) : this.oy + A.y, v1 = win ? Math.max(v0 + 1, Math.round(B.y / fh)) : this.oy + B.y;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const a = A.pts[i], b = A.pts[j], c = B.pts[j], d = B.pts[i];
        let u0, u1;
        if (win) { const cells = Math.max(1, Math.round(segLen[i] / cw)); u0 = uoff + i * 53; u1 = u0 + cells; }
        else { u0 = u; u1 = u + segLen[i]; }
        u += segLen[i];
        if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 1e-4 && Math.hypot(c[0] - d[0], c[1] - d[1]) < 1e-4) continue;
        if (smoothN) this._smoothQuad(a, b, c, d, A, B, u0, v0, u1, v1, o);
        else this.quad(a[0], A.y, a[1], b[0], A.y, b[1], c[0], B.y, c[1], d[0], B.y, d[1], u0, v0, u1, v1, r === 0 ? (o.aoB ?? 1) : 1, 1);
      }
    }
    if (o.cap !== false) {
      const top = rings[rings.length - 1];
      if (o.roof) this.use(o.roof);
      this.poly(top.pts, top.y, true);
    }
    if (o.capBottom) this.poly(rings[0].pts, rings[0].y, false);
  }
  _smoothQuad(a, b, c, d, A, B, u0, v0, u1, v1, o) {
    // radial normals around ring centroid (cx,cz given in o.center or 0,0)
    const cx = o.center ? o.center[0] : 0, cz = o.center ? o.center[1] : 0;
    const bt = this.b, C = this.c, S = this.s;
    const P = (p, y, u, v, ao) => {
      let nx = p[0] - cx, nz = p[1] - cz; const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
      const slope = o.slopeN || 0; const nl = Math.hypot(1, slope);
      const lx = nx / nl, ly = slope / nl, lz = nz / nl;
      return bt.vert(this.ox + p[0] * C + p[1] * S, this.oy + y, this.oz - p[0] * S + p[1] * C, lx * C + lz * S, ly, -lx * S + lz * C, u, v, ao);
    };
    bt.quadI(P(a, A.y, u0, v0, 1), P(b, A.y, u1, v0, 1), P(c, B.y, u1, v1, 1), P(d, B.y, u0, v1, 1));
  }
  // horizontal polygon cap (triangulated); pts CCW seen from above
  poly(pts, y, up = true, ao = 1) {
    const b = this.b, n = pts.length;
    if (n < 3) return;
    const base = b.n;
    for (let i = 0; i < n; i++) { const p = pts[i]; b.vert(this.wx(p[0], p[1]), this.oy + y, this.wz(p[0], p[1]), 0, up ? 1 : -1, 0, p[0], p[1], ao); }
    let convex = true;
    for (let i = 0; i < n && convex; i++) {
      const a = pts[i], c = pts[(i + 1) % n], d = pts[(i + 2) % n];
      if ((c[0] - a[0]) * (d[1] - c[1]) - (c[1] - a[1]) * (d[0] - c[0]) > 1e-6) convex = false; // CCW from above = clockwise in xz math
    }
    if (convex) { for (let i = 1; i < n - 1; i++) up ? b.tri(base, base + i, base + i + 1) : b.tri(base, base + i + 1, base + i); }
    else {
      const tris = THREE.ShapeUtils.triangulateShape(pts.map((p) => new THREE.Vector2(p[0], p[1])), []);
      for (const t of tris) {
        // orientation check
        const a = pts[t[0]], c = pts[t[1]], d = pts[t[2]];
        const cr = (c[0] - a[0]) * (d[1] - a[1]) - (c[1] - a[1]) * (d[0] - a[0]);
        const flip = (cr > 0) === up;
        flip ? b.tri(base + t[0], base + t[2], base + t[1]) : b.tri(base + t[0], base + t[1], base + t[2]);
      }
    }
  }
  // extruded polygon prism (pts CCW from above)
  prism(pts, y0, y1, o = {}) { this.loft([{ y: y0, pts }, { y: y1, pts: o.topPts || pts }], o); }

  // cylinder / cone / lathe with smooth normals. profile: [[r, y], ...] bottom→top
  lathe(cx, cz, profile, segs = 16, o = {}) {
    const b = this.b; if (o.wall) this.use(o.wall);
    const C = this.c, S = this.s;
    const a0 = o.a0 ?? 0, a1 = o.a1 ?? Math.PI * 2, full = Math.abs(a1 - a0 - Math.PI * 2) < 1e-4;
    let vAcc = this.oy + profile[0][1];
    for (let k = 0; k < profile.length - 1; k++) {
      const [r0, y0] = profile[k], [r1, y1] = profile[k + 1];
      const dl = Math.hypot(r1 - r0, y1 - y0); if (dl < 1e-5) continue;
      const ny = -(r1 - r0) / dl, nr = (y1 - y0) / dl;
      const base = b.n;
      const circ = Math.PI * (r0 + r1);
      const m = b.cur; const win = isWindowStyle(m.st);
      const uTot = win ? Math.max(segs, Math.round(circ / (m.cellW ?? 3))) : circ;
      const v0 = win ? Math.round(y0 / (m.floorH ?? 3.5)) : vAcc, v1 = win ? Math.max(v0 + 1, Math.round(y1 / (m.floorH ?? 3.5))) : vAcc + dl;
      vAcc += dl;
      for (let i = 0; i <= segs; i++) {
        const t = i / segs, a = a0 + (a1 - a0) * t, ca = Math.cos(a), sa = Math.sin(a);
        const lx = ca * nr, lz = -sa * nr;
        const nxw = lx * C + lz * S, nzw = -lx * S + lz * C;
        const px0 = cx + ca * r0, pz0 = cz - sa * r0, px1 = cx + ca * r1, pz1 = cz - sa * r1;
        b.vert(this.wx(px0, pz0), this.oy + y0, this.wz(px0, pz0), nxw, ny, nzw, t * uTot, v0, k === 0 ? (o.aoB ?? 1) : 1);
        b.vert(this.wx(px1, pz1), this.oy + y1, this.wz(px1, pz1), nxw, ny, nzw, t * uTot, v1, 1);
      }
      for (let i = 0; i < segs; i++) { const q = base + i * 2; b.quadI(q, q + 2, q + 3, q + 1); }
    }
    if (o.cap !== false && full) {
      const [r, y] = profile[profile.length - 1];
      if (r > 1e-3) { if (o.roof) this.use(o.roof); const pts = []; for (let i = 0; i < segs; i++) { const a = (i / segs) * Math.PI * 2; pts.push([cx + Math.cos(a) * r, cz - Math.sin(a) * r]); } this.poly(pts, y, true); }
    }
  }
  cyl(cx, cz, r, y0, y1, segs = 12, o = {}) { this.lathe(cx, cz, [[r, y0], [o.r1 ?? r, y1]], segs, o); }

  // tube between two arbitrary local points
  tube(x0, y0, z0, x1, y1, z1, r, segs = 6, o = {}) {
    const b = this.b; if (o.wall) this.use(o.wall);
    const C = this.c, S = this.s;
    let dx = x1 - x0, dy = y1 - y0, dz = z1 - z0; const L = Math.hypot(dx, dy, dz); if (L < 1e-5) return; dx /= L; dy /= L; dz /= L;
    // orthonormal frame
    let ux = 0, uy = 1, uz = 0; if (Math.abs(dy) > 0.95) { ux = 1; uy = 0; }
    let ax = uy * dz - uz * dy, ay = uz * dx - ux * dz, az = ux * dy - uy * dx; let l = Math.hypot(ax, ay, az); ax /= l; ay /= l; az /= l;
    const bx = dy * az - dz * ay, by = dz * ax - dx * az, bz = dx * ay - dy * ax;
    const base = b.n; const r1 = o.r1 ?? r;
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      const nx = ax * ca + bx * sa, ny = ay * ca + by * sa, nz = az * ca + bz * sa;
      const nxw = nx * C + nz * S, nzw = -nx * S + nz * C;
      const p0x = x0 + nx * r, p0z = z0 + nz * r, p1x = x1 + nx * r1, p1z = z1 + nz * r1;
      b.vert(this.wx(p0x, p0z), this.oy + y0 + ny * r, this.wz(p0x, p0z), nxw, ny, nzw, (i / segs) * 6.283 * r, 0, o.ao ?? 1);
      b.vert(this.wx(p1x, p1z), this.oy + y1 + ny * r1, this.wz(p1x, p1z), nxw, ny, nzw, (i / segs) * 6.283 * r, L, o.ao ?? 1);
    }
    for (let i = 0; i < segs; i++) { const q = base + i * 2; b.quadI(q, q + 2, q + 3, q + 1); }
  }
  // rectangular beam between two points (w horizontal thickness, h vertical thickness)
  beam(x0, y0, z0, x1, y1, z1, w, h, o = {}) {
    if (o.wall) this.use(o.wall);
    let dx = x1 - x0, dy = y1 - y0, dz = z1 - z0; const L = Math.hypot(dx, dy, dz); if (L < 1e-5) return;
    let sx, sz; const hl = Math.hypot(dx, dz);
    if (hl < 1e-4) { sx = 1; sz = 0; } else { sx = -dz / hl; sz = dx / hl; } // side vector (horizontal, perpendicular)
    // up vector perpendicular to dir and side
    let ux = (dy / L) * -(dx / (hl || 1)), uy = hl / L, uz = (dy / L) * -(dz / (hl || 1)); // up = side × dir
    if (hl < 1e-4) { ux = 0; uy = 0; uz = 1; }
    const hw = w / 2, hh = h / 2;
    const P = (ex, ey, ez, a, b2) => [ex + sx * a * hw + ux * b2 * hh, ey + uy * b2 * hh, ez + sz * a * hw + uz * b2 * hh];
    const a0 = P(x0, y0, z0, -1, -1), a1 = P(x0, y0, z0, 1, -1), a2 = P(x0, y0, z0, 1, 1), a3 = P(x0, y0, z0, -1, 1);
    const b0 = P(x1, y1, z1, -1, -1), b1 = P(x1, y1, z1, 1, -1), b2 = P(x1, y1, z1, 1, 1), b3 = P(x1, y1, z1, -1, 1);
    const Q = (p, q, r, s, uu, vv) => this.quad(p[0], p[1], p[2], q[0], q[1], q[2], r[0], r[1], r[2], s[0], s[1], s[2], 0, 0, uu, vv, o.ao ?? 1, o.ao ?? 1);
    Q(a1, b1, b2, a2, L, h); Q(b0, a0, a3, b3, L, h); Q(a3, a2, b2, b3, w, L); Q(a1, a0, b0, b1, w, L);
    if (o.caps) { Q(a0, a1, a2, a3, w, h); Q(b1, b0, b3, b2, w, h); }
  }
  // textured sign quad on a vertical plane: centre (x,y,z), facing local angle `ang` (0 = +z), size w×h, atlas rect {u0,v0,u1,v1}
  sign(x, y, z, ang, w, h, rect, o = {}) {
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const rx = ca, rz = -sa; // right vector for a quad facing (sa, 0, ca)
    const hw = w / 2, hh = h / 2;
    const m = { st: o.holo ? ST.HOLO : ST.SIGN, color: [1, 1, 1], seed: o.seed ?? 0, extra: (o.intensity ?? 6) * 10 };
    this.use(m);
    this.quad(x - rx * hw, y - hh, z - rz * hw, x + rx * hw, y - hh, z + rz * hw, x + rx * hw, y + hh, z + rz * hw, x - rx * hw, y + hh, z - rz * hw, rect.u0, rect.v0, rect.u1, rect.v1);
    if (o.double) this.quad(x + rx * hw, y - hh, z + rz * hw, x - rx * hw, y - hh, z - rz * hw, x - rx * hw, y + hh, z - rz * hw, x + rx * hw, y + hh, z + rz * hw, rect.u0, rect.v0, rect.u1, rect.v1);
  }
}

// ---- footprint helpers ----------------------------------------------------------------------
export function rectPts(sx, sz, cx = 0, cz = 0, chamfer = 0, rot = 0) {
  const hx = sx / 2, hz = sz / 2; let p;
  if (chamfer > 0.01) {
    const c = Math.min(chamfer, hx * 0.9, hz * 0.9);
    p = [[-hx + c, hz], [hx - c, hz], [hx, hz - c], [hx, -hz + c], [hx - c, -hz], [-hx + c, -hz], [-hx, -hz + c], [-hx, hz - c]];
  } else p = [[-hx, hz], [hx, hz], [hx, -hz], [-hx, -hz]];
  const c = Math.cos(rot), s = Math.sin(rot);
  return p.map(([x, z]) => [cx + x * c + z * s, cz - x * s + z * c]);
}
export function ngonPts(r, n, cx = 0, cz = 0, rot = 0, rz = r) {
  const p = [];
  for (let i = 0; i < n; i++) { const a = rot + (i / n) * Math.PI * 2; p.push([cx + Math.cos(a) * r, cz - Math.sin(a) * rz]); }
  return p;
}
export const scalePts = (pts, s, cx = 0, cz = 0, sz = s) => pts.map(([x, z]) => [cx + (x - cx) * s, cz + (z - cz) * sz]);
export const rotPts = (pts, a, cx = 0, cz = 0) => { const c = Math.cos(a), s = Math.sin(a); return pts.map(([x, z]) => [cx + (x - cx) * c + (z - cz) * s, cz - (x - cx) * s + (z - cz) * c]); };
