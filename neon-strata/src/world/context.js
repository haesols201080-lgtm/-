// Shared generation context: chunked batches, occupancy grid, light-field emitters, colliders, POIs.
import * as THREE from 'three';
import { Batch, Pen } from './builder.js';
import { RNG } from '../core/rng.js';

export const CHUNK = 480;

export class Occupancy {
  constructor(extent = 5200, cell = 5) {
    this.extent = extent; this.cell = cell; this.n = Math.ceil((extent * 2) / cell);
    this.d = new Uint8Array(this.n * this.n);
  }
  _i(x, z) { const ix = Math.floor((x + this.extent) / this.cell), iz = Math.floor((z + this.extent) / this.cell); if (ix < 0 || iz < 0 || ix >= this.n || iz >= this.n) return -1; return iz * this.n + ix; }
  get(x, z) { const i = this._i(x, z); return i < 0 ? 255 : this.d[i]; }
  _rectCells(cx, cz, hx, hz, yaw, fn) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const ex = Math.abs(hx * c) + Math.abs(hz * s), ez = Math.abs(hx * s) + Math.abs(hz * c);
    const cs = this.cell, e = this.extent;
    const x0 = Math.floor((cx - ex + e) / cs), x1 = Math.floor((cx + ex + e) / cs), z0 = Math.floor((cz - ez + e) / cs), z1 = Math.floor((cz + ez + e) / cs);
    for (let iz = z0; iz <= z1; iz++) for (let ix = x0; ix <= x1; ix++) {
      if (ix < 0 || iz < 0 || ix >= this.n || iz >= this.n) { if (fn(-1)) return true; continue; }
      const wx = (ix + 0.5) * cs - e - cx, wz = (iz + 0.5) * cs - e - cz;
      const lx = wx * c - wz * s, lz = wx * s + wz * c;
      if (Math.abs(lx) <= hx + cs * 0.5 && Math.abs(lz) <= hz + cs * 0.5) { if (fn(iz * this.n + ix)) return true; }
    }
    return false;
  }
  freeRect(cx, cz, hx, hz, yaw = 0, pad = 0) { return !this._rectCells(cx, cz, hx + pad, hz + pad, yaw, (i) => i < 0 || this.d[i] !== 0); }
  markRect(cx, cz, hx, hz, yaw = 0, v = 2) { this._rectCells(cx, cz, hx, hz, yaw, (i) => { if (i >= 0 && this.d[i] < v) this.d[i] = v; return false; }); }
  freeCircle(x, z, r) { return this.freeRect(x, z, r * 0.8, r * 0.8, 0); }
  markCircle(x, z, r, v = 2) {
    const cs = this.cell, e = this.extent;
    const x0 = Math.floor((x - r + e) / cs), x1 = Math.floor((x + r + e) / cs), z0 = Math.floor((z - r + e) / cs), z1 = Math.floor((z + r + e) / cs);
    for (let iz = z0; iz <= z1; iz++) for (let ix = x0; ix <= x1; ix++) {
      if (ix < 0 || iz < 0 || ix >= this.n || iz >= this.n) continue;
      const wx = (ix + 0.5) * cs - e - x, wz = (iz + 0.5) * cs - e - z;
      if (wx * wx + wz * wz <= r * r) { const i = iz * this.n + ix; if (this.d[i] < v) this.d[i] = v; }
    }
  }
  markLine(x0, z0, x1, z1, hw, v = 1) {
    const L = Math.hypot(x1 - x0, z1 - z0); if (L < 1e-3) return;
    this.markRect((x0 + x1) / 2, (z0 + z1) / 2, L / 2, hw, -Math.atan2(z1 - z0, x1 - x0), v);
  }
}

// additive glow geometry (light cones, hologram sheets, halos)
export class GlowBatch {
  constructor() { this.pos = []; this.nrm = []; this.uv = []; this.col = []; this.glow = []; this.idx = []; this.n = 0; }
  vert(x, y, z, nx, ny, nz, u, v, r, g, b, a, mode, inten, seed, night) {
    this.pos.push(x, y, z); this.nrm.push(nx, ny, nz); this.uv.push(u, v); this.col.push(r, g, b, a); this.glow.push(mode, inten, seed, night);
    return this.n++;
  }
  get empty() { return this.idx.length === 0; }
  // light cone from apex (x,y,z) along direction (dx,dy,dz) (normalised), length L, radii r0→r1
  cone(x, y, z, dx, dy, dz, L, r0, r1, col, inten, o = {}) {
    const segs = o.segs ?? 10;
    let ux = 0, uy = 1, uz = 0; if (Math.abs(dy) > 0.9) { ux = 1; uy = 0; }
    let ax = uy * dz - uz * dy, ay = uz * dx - ux * dz, az = ux * dy - uy * dx; const l = Math.hypot(ax, ay, az); ax /= l; ay /= l; az /= l;
    const bx = dy * az - dz * ay, by = dz * ax - dx * az, bz = dx * ay - dy * ax;
    const base = this.n; const night = o.night ?? 1, seed = o.seed ?? 0;
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      const nx = ax * ca + bx * sa, ny = ay * ca + by * sa, nz = az * ca + bz * sa;
      this.vert(x + nx * r0, y + ny * r0, z + nz * r0, nx, ny, nz, (i / segs) * 4, 0, col[0], col[1], col[2], 1, 0, inten, seed, night);
      this.vert(x + dx * L + nx * r1, y + dy * L + ny * r1, z + dz * L + nz * r1, nx, ny, nz, (i / segs) * 4, 1, col[0], col[1], col[2], 1, 0, inten, seed, night);
    }
    for (let i = 0; i < segs; i++) { const q = base + i * 2; this.idx.push(q, q + 2, q + 3, q, q + 3, q + 1); }
  }
  // generic quad; mode 1 = hologram sheet, 2 = soft blob, 3 = atlas hologram (uv = atlas rect)
  quad(p0, p1, p2, p3, col, a, mode, inten, o = {}) {
    const uv = o.uv || [0, 0, 1, 1]; const night = o.night ?? 1, seed = o.seed ?? 0;
    const e1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], e2 = [p3[0] - p0[0], p3[1] - p0[1], p3[2] - p0[2]];
    let nx = e1[1] * e2[2] - e1[2] * e2[1], ny = e1[2] * e2[0] - e1[0] * e2[2], nz = e1[0] * e2[1] - e1[1] * e2[0]; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const i0 = this.vert(p0[0], p0[1], p0[2], nx, ny, nz, uv[0], uv[1], col[0], col[1], col[2], a, mode, inten, seed, night);
    const i1 = this.vert(p1[0], p1[1], p1[2], nx, ny, nz, uv[2], uv[1], col[0], col[1], col[2], a, mode, inten, seed, night);
    const i2 = this.vert(p2[0], p2[1], p2[2], nx, ny, nz, uv[2], uv[3], col[0], col[1], col[2], a, mode, inten, seed, night);
    const i3 = this.vert(p3[0], p3[1], p3[2], nx, ny, nz, uv[0], uv[3], col[0], col[1], col[2], a, mode, inten, seed, night);
    this.idx.push(i0, i1, i2, i0, i2, i3);
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('aColor', new THREE.Float32BufferAttribute(this.col, 4));
    g.setAttribute('aGlow', new THREE.Float32BufferAttribute(this.glow, 4));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    this.pos = this.nrm = this.uv = this.col = this.glow = this.idx = null;
    return g;
  }
}

export class CityContext {
  constructor({ seed, quality, physics, lightField, atlas }) {
    this.seed = seed; this.q = quality; this.density = quality.density;
    this.rng = new RNG(seed);
    this.phys = physics; this.lf = lightField; this.atlas = atlas;
    this.occ = new Occupancy(5200, 5);
    this.chunks = new Map();
    this.named = new Map(); // big standalone batches (megastructures)
    this.pen = new Pen(null);
    this.sparks = []; this.props = {}; this.footprints = []; this.pois = []; this.lanes = []; this.spawns = []; this.emitters = []; this.walkways = []; this.steam = [];
    this.stats = { buildings: 0 };
  }
  _chunk(x, z) {
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK), k = cx * 1000 + cz;
    let c = this.chunks.get(k);
    if (!c) { c = { cx, cz, main: new Batch(4096), detail: new Batch(2048), glow: new GlowBatch(), x: (cx + 0.5) * CHUNK, z: (cz + 0.5) * CHUNK }; this.chunks.set(k, c); }
    return c;
  }
  // position the pen at a world location; geometry goes to the main batch of that chunk
  penAt(x, y, z, yaw = 0) { const c = this._chunk(x, z); this.cur = c; this.pen.to(c.main).at(x, y, z, yaw); return this.pen; }
  main() { return this.pen.to(this.cur.main); }
  detail() { return this.pen.to(this.cur.detail); }
  get glow() { return this.cur.glow; }
  glowAt(x, z) { return this._chunk(x, z).glow; }
  big(name) { let b = this.named.get(name); if (!b) { b = { main: new Batch(16384), glow: new GlowBatch() }; this.named.set(name, b); } return b; }
  // neon / lamp emitter into the light field (colour sRGB-ish 0..1, radius metres)
  light(x, z, radius, col, intensity = 1, y = 7) {
    this.lf.add(x, z, radius, col[0] * col[0] * intensity, col[1] * col[1] * intensity, col[2] * col[2] * intensity);
    const k = 1.6 * Math.min(1.5, 0.5 + intensity); this.sparks.push(x, y, z, col[0] * col[0] * k, col[1] * col[1] * k, col[2] * col[2] * k, Math.min(9, 2.5 + radius * 0.06));
  }
  // far-visible point light only (beacons, crowns, window clusters)
  spark(x, y, z, col, size = 4, k = 2) { this.sparks.push(x, y, z, col[0] * col[0] * k, col[1] * col[1] * k, col[2] * col[2] * k, size); }
  shade(x, z, radius, strength) { this.lf.occlude(x, z, radius, strength); }
  // solid collider in the current pen frame
  solid(cx, cz, sx, sz, y0, y1, tag = 0) { const p = this.pen; return this.phys.addBox(p.wx(cx, cz), p.wz(cx, cz), sx / 2, sz / 2, p.yaw, p.oy + y0, p.oy + y1, tag); }
  solidCyl(cx, cz, r, y0, y1) { const p = this.pen; return this.phys.addCyl(p.wx(cx, cz), p.wz(cx, cz), r, p.oy + y0, p.oy + y1); }
  poi(o) { this.pois.push(o); return o; }
  // instanced prop (world coordinates)
  prop(name, x, y, z, yaw = 0, scale = 1, tint = null) { (this.props[name] || (this.props[name] = [])).push([x, y, z, yaw, scale, tint]); }
  // instanced prop in the current pen frame
  propL(name, lx, ly, lz, yaw = 0, scale = 1, tint = null) { const p = this.pen; this.prop(name, p.wx(lx, lz), p.oy + ly, p.wz(lx, lz), p.yaw + yaw, scale, tint); }
  // register a building footprint (pen frame) for the overlap audit
  footprint(cx, cz, w, d, y0, y1, tag) { const p = this.pen; this.footprints.push([p.wx(cx, cz), p.wz(cx, cz), w / 2, d / 2, p.yaw, p.oy + y0, p.oy + y1, tag]); }
}
