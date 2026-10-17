// Geometry kit for the generated town. Everything the street generator and the
// building types emit goes through here: quads, boxes, extruded profiles and
// flat polygons, collected per material and per 64 m chunk, with world-space
// box-mapped UVs (so brick courses run on across neighbouring houses) and a
// per-vertex tint (so one brick texture serves yellow stock, red and sooty
// brick). build() turns each chunk/material pair into one merged mesh, which
// three.js frustum-culls by its bounding sphere.
import * as THREE from 'three';

// metres covered by one texture tile (matches blender/lib.py TEX_SCALE)
export const TILE = {
  brick: 2.0, brick_dark: 2.0, plaster: 2.5, plaster_peeling: 2.5, slate: 2.0, corrugated: 2.0,
  wood: 1.5, wood_dark: 1.0, board: 1.2, cardboard: 1.2, tile_white: 1.0, rubble: 2.0,
  concrete_white: 4.0, concrete_grey: 4.0, concrete_dark: 4.0, stone_dirty: 3.0,
  metal: 2.0, metal_dark: 2.0, rust: 2.0, paving: 3.0, asphalt: 6.0, cobble: 2.5,
};

export const CHUNK = 64;

// A local frame on the ground: origin (ox, oy, oz), turned by rot about Y the
// way Object3D.rotation.y turns things. Local +x runs along a facade (to the
// right when standing in the street looking at it), +z points out of the
// facade into the street, +y is up.
export class Frame {
  constructor(ox, oy, oz, rot) {
    this.ox = ox; this.oy = oy; this.oz = oz; this.rot = rot;
    this.c = Math.cos(rot); this.s = Math.sin(rot);
  }
  p(lx, ly, lz) { return [this.ox + lx * this.c + lz * this.s, this.oy + ly, this.oz - lx * this.s + lz * this.c]; }
  x(lx, lz) { return this.ox + lx * this.c + lz * this.s; }
  z(lx, lz) { return this.oz - lx * this.s + lz * this.c; }
  // a frame moved along/out of this one and optionally turned further
  sub(lx, ly, lz, drot = 0) { const q = this.p(lx, ly, lz); return new Frame(q[0], q[1], q[2], this.rot + drot); }
  // world point -> local (x, z)
  local(x, z) { const dx = x - this.ox, dz = z - this.oz; return [dx * this.c - dz * this.s, dx * this.s + dz * this.c]; }
}

const WHITE = [1, 1, 1];

export class Kit {
  constructor() {
    this.chunks = new Map();   // "i,j" -> Map(mat -> {p, n, uv, c})
    this.tint = WHITE;
    this.tris = 0;
  }

  _buf(mat, x, z) {
    // a fixed key groups a whole building into one chunk (see town/index.js)
    const key = this.key || (Math.floor(x / CHUNK) + ',' + Math.floor(z / CHUNK));
    let ch = this.chunks.get(key);
    if (!ch) { ch = new Map(); this.chunks.set(key, ch); }
    let b = ch.get(mat);
    if (!b) { b = { p: [], n: [], uv: [], c: [] }; ch.set(mat, b); }
    return b;
  }

  // Quad a-b-c-d counter-clockwise seen from its front. uvs: optional explicit
  // [u0,v0, u1,v1, u2,v2, u3,v3]; otherwise world box mapping by the normal.
  quad(mat, a, b, c, d, uvs, tint) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    let l = Math.hypot(nx, ny, nz);
    if (l < 1e-9) {
      // a-b-d degenerate (triangle given as a quad): use b-c-d
      const wx = c[0] - b[0], wy = c[1] - b[1], wz = c[2] - b[2];
      nx = wy * vz - wz * vy; ny = wz * vx - wx * vz; nz = wx * vy - wy * vx;
      l = Math.hypot(nx, ny, nz);
      if (l < 1e-9) return;
    }
    nx /= l; ny /= l; nz /= l;
    const cx = (a[0] + c[0]) / 2, cz = (a[2] + c[2]) / 2;
    const g = this._buf(mat, cx, cz);
    const P = [a, b, c, d];
    const col = tint || this.tint;
    let U;
    if (uvs) U = uvs;
    else {
      const t = TILE[mat] || 2;
      U = new Array(8);
      if (Math.abs(ny) > 0.7) {
        for (let i = 0; i < 4; i++) { U[i * 2] = P[i][0] / t; U[i * 2 + 1] = -P[i][2] / t; }
      } else {
        // horizontal tangent of the face; u runs along it, v up
        const hl = Math.hypot(nx, nz) || 1;
        const tx = nz / hl, tz = -nx / hl;
        for (let i = 0; i < 4; i++) { U[i * 2] = (P[i][0] * tx + P[i][2] * tz) / t; U[i * 2 + 1] = P[i][1] / t; }
      }
    }
    for (const i of [0, 1, 2, 0, 2, 3]) {
      const p = P[i];
      g.p.push(p[0], p[1], p[2]);
      g.n.push(nx, ny, nz);
      g.uv.push(U[i * 2], U[i * 2 + 1]);
      g.c.push(col[0], col[1], col[2]);
    }
    this.tris += 2;
  }

  tri(mat, a, b, c, tint) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz);
    if (l < 1e-9) return;
    nx /= l; ny /= l; nz /= l;
    const g = this._buf(mat, (a[0] + b[0] + c[0]) / 3, (a[2] + b[2] + c[2]) / 3);
    const t = TILE[mat] || 2, col = tint || this.tint;
    const hl = Math.hypot(nx, nz) || 1, tx = nz / hl, tz = -nx / hl;
    for (const p of [a, b, c]) {
      g.p.push(p[0], p[1], p[2]);
      g.n.push(nx, ny, nz);
      if (Math.abs(ny) > 0.7) g.uv.push(p[0] / t, -p[2] / t); else g.uv.push((p[0] * tx + p[2] * tz) / t, p[1] / t);
      g.c.push(col[0], col[1], col[2]);
    }
    this.tris += 1;
  }

  // Axis-aligned box in a frame: local x0..x1 (along), y0..y1 (up), z0..z1 (out).
  // faces: any of 'f' (front, +z), 'b' (back), 'l' (-x), 'r' (+x), 't' (top), 'u' (underside).
  box(mat, F, x0, x1, y0, y1, z0, z1, faces = 'fblrt', tint) {
    const P = (x, y, z) => F.p(x, y, z);
    if (faces.includes('f')) this.quad(mat, P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1), null, tint);
    if (faces.includes('b')) this.quad(mat, P(x1, y0, z0), P(x0, y0, z0), P(x0, y1, z0), P(x1, y1, z0), null, tint);
    if (faces.includes('l')) this.quad(mat, P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1), P(x0, y1, z0), null, tint);
    if (faces.includes('r')) this.quad(mat, P(x1, y0, z1), P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), null, tint);
    if (faces.includes('t')) this.quad(mat, P(x0, y1, z1), P(x1, y1, z1), P(x1, y1, z0), P(x0, y1, z0), null, tint);
    if (faces.includes('u')) this.quad(mat, P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1), null, tint);
  }

  // A profile [[z, y], ...] (out, up; listed bottom to top) swept along local
  // x from x0 to x1: cornices, string courses, kerbs, mouldings. Ends capped
  // when caps is true.
  sweep(mat, F, x0, x1, prof, caps = true, tint) {
    for (let i = 0; i < prof.length - 1; i++) {
      const [za, ya] = prof[i], [zb, yb] = prof[i + 1];
      this.quad(mat, F.p(x0, ya, za), F.p(x1, ya, za), F.p(x1, yb, zb), F.p(x0, yb, zb), null, tint);
    }
    if (caps && prof.length > 2) {
      const pts0 = prof.map(([z, y]) => F.p(x0, y, z));
      const pts1 = prof.map(([z, y]) => F.p(x1, y, z));
      // fan from the wall-side bottom point (profiles start and end at the wall)
      for (let i = 1; i < prof.length - 1; i++) {
        this.tri(mat, pts0[0], pts0[i], pts0[i + 1], tint);
        this.tri(mat, pts1[0], pts1[i + 1], pts1[i], tint);
      }
    }
  }

  // Flat polygon [[x, z], ...] at height y (counter-clockwise seen from above
  // when up is true). Triangulated with earcut.
  poly(mat, pts, y, up = true, tint) {
    const v2 = pts.map(([x, z]) => new THREE.Vector2(x, -z));
    const tris = THREE.ShapeUtils.triangulateShape(v2, []);
    for (const [i, j, k] of tris) {
      const a = [pts[i][0], y, pts[i][1]], b = [pts[j][0], y, pts[j][1]], c = [pts[k][0], y, pts[k][1]];
      // ensure the normal points the requested way
      const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
      if ((ny > 0) === up) this.tri(mat, a, b, c, tint); else this.tri(mat, a, c, b, tint);
    }
  }

  // Vertical wall strip along a polyline [[x, z], ...] from y0 to y1, facing
  // the left side of the direction of travel unless flip.
  wall(mat, pts, y0, y1, flip = false, tint) {
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      if (!flip) this.quad(mat, [bx, y0, bz], [ax, y0, az], [ax, y1, az], [bx, y1, bz], null, tint);
      else this.quad(mat, [ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az], null, tint);
    }
  }

  // Convex polygon of world points (fan triangulated) whose normal is turned
  // to agree with the hint (nx, ny, nz). Saves thinking about winding.
  face(mat, pts, nx, ny, nz, tint) {
    if (pts.length < 3) return;
    const [a, b, c] = pts;
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    const P = cx * nx + cy * ny + cz * nz >= 0 ? pts : [...pts].reverse();
    if (P.length === 4) { this.quad(mat, P[0], P[1], P[2], P[3], null, tint); return; }
    for (let i = 1; i < P.length - 1; i++) this.tri(mat, P[0], P[i], P[i + 1], tint);
  }

  // Upright prism of n sides (chimney pots, columns, posts), centred at
  // world (x, z) from y0 to y1, radius rad; top capped.
  cyl(mat, x, z, y0, y1, rad, n = 6, top = true, tint) {
    const P = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; P.push([x + Math.cos(a) * rad, z + Math.sin(a) * rad]); }
    for (let i = 0; i < n; i++) {
      const [ax, az] = P[i], [bx, bz] = P[(i + 1) % n];
      this.quad(mat, [bx, y0, bz], [ax, y0, az], [ax, y1, az], [bx, y1, bz], null, tint);
    }
    if (top) for (let i = 1; i < n - 1; i++) this.tri(mat, [P[0][0], y1, P[0][1]], [P[i + 1][0], y1, P[i + 1][1]], [P[i][0], y1, P[i][1]], tint);
  }

  // A square-section bar between two world points (railings, shores, poles).
  bar(mat, a, b, w, tint) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-4) return;
    const d = [dx / len, dy / len, dz / len];
    const up = Math.abs(d[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    let u = [d[1] * up[2] - d[2] * up[1], d[2] * up[0] - d[0] * up[2], d[0] * up[1] - d[1] * up[0]];
    const ul = Math.hypot(...u); u = u.map((q) => (q / ul) * w / 2);
    let v = [u[1] * d[2] - u[2] * d[1], u[2] * d[0] - u[0] * d[2], u[0] * d[1] - u[1] * d[0]];
    const vl = Math.hypot(...v); v = v.map((q) => (q / vl) * w / 2);
    const C = (o, su, sv) => [o[0] + u[0] * su + v[0] * sv, o[1] + u[1] * su + v[1] * sv, o[2] + u[2] * su + v[2] * sv];
    const S = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
    for (let i = 0; i < 4; i++) {
      const [su0, sv0] = S[i], [su1, sv1] = S[(i + 1) % 4];
      this.quad(mat, C(a, su1, sv1), C(a, su0, sv0), C(b, su0, sv0), C(b, su1, sv1), null, tint);
    }
    this.quad(mat, C(b, 1, -1), C(b, -1, -1), C(b, -1, 1), C(b, 1, 1), null, tint);
  }

  // Merge into meshes under root. mats: name -> THREE.Material.
  build(root, mats, opts = {}) {
    const meshes = [];
    for (const [key, ch] of this.chunks) {
      for (const [name, g] of ch) {
        if (!g.p.length) continue;
        const mat = mats(name);
        if (!mat) { console.warn('town: no material', name); continue; }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(g.p, 3));
        geo.setAttribute('normal', new THREE.Float32BufferAttribute(g.n, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(g.uv, 2));
        geo.setAttribute('color', new THREE.Float32BufferAttribute(g.c, 3));
        geo.computeBoundingSphere();
        const m = new THREE.Mesh(geo, mat);
        m.name = (opts.name || 'town') + ':' + name + '@' + key;
        m.userData.chunk = key;
        m.castShadow = opts.cast ?? !/glass/.test(name);
        m.receiveShadow = true;
        m.matrixAutoUpdate = false;
        root.add(m);
        meshes.push(m);
      }
    }
    this.chunks.clear();
    return meshes;
  }
}

// ---------------------------------------------------------------- colours

// brick, stucco and paint tints multiplied over the photographed textures
export const TINTS = {
  // multipliers over the photographed textures (linear); >1 brightens. The
  // brick scan is a brownish red: these push it to yellow-grey London stock,
  // clean to black with soot
  stock: [[1.35, 1.42, 1.22], [1.18, 1.2, 1.04], [0.98, 0.98, 0.88], [0.78, 0.76, 0.7]],
  red: [[1.3, 1.02, 0.9], [1.12, 0.9, 0.82], [0.95, 0.78, 0.72]],
  soot: [[0.62, 0.6, 0.57], [0.5, 0.49, 0.47]],
  stucco: [[1.9, 1.86, 1.7], [1.7, 1.68, 1.58], [1.45, 1.43, 1.36], [1.75, 1.6, 1.36], [1.3, 1.34, 1.38]],
  paint: [[0.16, 0.2, 0.17], [0.12, 0.12, 0.12], [0.3, 0.12, 0.1], [0.75, 0.72, 0.64], [0.2, 0.22, 0.3], [0.42, 0.36, 0.28]],
  frame: [[1.35, 1.32, 1.22], [1.15, 1.12, 1.04], [0.3, 0.28, 0.25], [0.95, 0.9, 0.8]],
};
