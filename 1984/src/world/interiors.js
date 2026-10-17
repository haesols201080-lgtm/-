// Interiors. Each room is its own location far east of the city (x = 6000 +
// 100 * slot), built from a small description: size, surfaces, windows
// with a painted view beyond the glass, doors, recesses and chimney breasts,
// a ceiling light, props and telescreens. Rooms are seen only from inside,
// so only inner faces exist.
//
// Nothing here may z-fight or stand inside anything else: tools/zfight_scene.mjs
// measures every room (coplanar faces, crossings, door clearance, wall items,
// floating props) and should report each room clean after a change.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as P from './rooms/paint.js';

const PI = Math.PI, H = PI / 2;
const WALL_T = 0.22;
const SKIRT_H = 0.14, SKIRT_T = 0.025;

function std(G, map, o = {}) {
  const m = new THREE.MeshStandardMaterial({ map, roughness: o.rough ?? 0.92, color: o.color ?? 0xffffff, metalness: o.metal ?? 0 });
  if (o.normal) m.normalMap = o.normal;
  if (map) { map.wrapS = map.wrapT = THREE.RepeatWrapping; }
  if (o.name) m.name = o.name;
  return m;
}

// Build a quad with world-scaled UVs (tile metres per texture repeat).
function quad(a, b, c, d, tile, mat, name) {
  const g = new THREE.BufferGeometry();
  const pos = [...a, ...b, ...c, ...d];
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const e1 = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const e2 = new THREE.Vector3(d[0] - a[0], d[1] - a[1], d[2] - a[2]);
  const L1 = e1.length() / tile, L2 = e2.length() / tile;
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, L1, 0, L1, L2, 0, L2], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat);
  m.receiveShadow = true;
  if (name) m.name = name;
  return m;
}

// A vertical quad between two floor points p0 -> p1 ([x, z]) from y0 to y1,
// wound to face along n ([x, z]).
function vquad(p0, p1, y0, y1, n, tile, mat, name) {
  if ((-(p1[1] - p0[1])) * n[0] + (p1[0] - p0[0]) * n[1] < 0) [p0, p1] = [p1, p0];
  return quad([p0[0], y0, p0[1]], [p1[0], y0, p1[1]], [p1[0], y1, p1[1]], [p0[0], y1, p0[1]], tile, mat, name);
}

// A horizontal quad over four corners ([x, z]) at height y, facing up or down.
function hquad(pts, y, up, tile, mat, name) {
  let [a, b, c, d] = pts;
  const ny = (b[1] - a[1]) * (d[0] - a[0]) - (b[0] - a[0]) * (d[1] - a[1]);
  if ((ny > 0) !== up) [b, d] = [d, b];
  return quad([a[0], y, a[1]], [b[0], y, b[1]], [c[0], y, c[1]], [d[0], y, d[1]], tile, mat, name);
}

// A box whose texture keeps its scale on every face (tile metres a repeat).
function boxGeo(w, h, d, tile = 0.6) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
    const i = f * 4 + k;
    uv.setXY(i, uv.getX(i) * dims[f][0] / tile, uv.getY(i) * dims[f][1] / tile);
  }
  return g;
}
// several boxes [w, h, d, x, y, z] as one geometry
function boxesGeo(list, tile) {
  return mergeGeometries(list.map(([w, h, d, x, y, z]) => boxGeo(w, h, d, tile).translate(x, y, z)));
}
function mesh(geo, mat, name, o = {}) {
  const m = new THREE.Mesh(geo, mat);
  if (name) m.name = name;
  m.castShadow = o.cast ?? true;
  m.receiveShadow = true;
  return m;
}

// The packed models have lost their texture coordinates (the optimiser
// prunes UVs that no texture in the .glb refers to), so library textures and
// printed art would show one flat texel: the Big Brother poster came out
// blank white. Meshes without UVs get them here: a flat projection across
// the face for printed things, a box projection in metres for the rest.
const ART = /^(poster|engraving|telescreen_screen|sign|slogans|notice)/;
const uvCache = new WeakMap();
function giveUV(m) {
  const g = m.geometry;
  if (!g || !g.attributes.position || g.attributes.uv) return;
  const mats = Array.isArray(m.material) ? m.material : [m.material];
  if (!mats.some((q) => q && (q.map || q.normalMap || q.roughnessMap || q.emissiveMap))) return;
  const art = mats.some((q) => q && ART.test(q.name || ''));
  // node transform inside the model (quantised models scale their positions)
  const M = m.matrixWorld;
  const key = (art ? 'art' : 'box') + M.elements.map((v) => v.toFixed(4)).join(',');
  let cache = uvCache.get(g);
  if (!cache) uvCache.set(g, cache = new Map());
  let out = cache.get(key);
  if (!out) {
    out = g.clone();
    const pos = g.attributes.position, nrm = g.attributes.normal;
    const nm = new THREE.Matrix3().getNormalMatrix(M);
    const p = new THREE.Vector3(), n = new THREE.Vector3();
    const P3 = [], N3 = [];
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i).applyMatrix4(M); P3.push(p.clone());
      if (nrm) n.fromBufferAttribute(nrm, i).applyMatrix3(nm).normalize(); else n.set(0, 0, 1);
      N3.push(n.clone());
    }
    const uv = new Float32Array(pos.count * 2);
    if (art) {
      const avg = N3.reduce((s, q) => s.add(q), new THREE.Vector3()).normalize();
      const b = new THREE.Box3().setFromPoints(P3);
      const ax = Math.abs(avg.x), ay = Math.abs(avg.y), az = Math.abs(avg.z);
      for (let i = 0; i < P3.length; i++) {
        const q = P3[i];
        let u, v;
        if (az >= ax && az >= ay) { u = (q.x - b.min.x) / (b.max.x - b.min.x || 1); if (avg.z < 0) u = 1 - u; v = (q.y - b.min.y) / (b.max.y - b.min.y || 1); }
        else if (ax >= ay) { u = (q.z - b.min.z) / (b.max.z - b.min.z || 1); if (avg.x > 0) u = 1 - u; v = (q.y - b.min.y) / (b.max.y - b.min.y || 1); }
        else { u = (q.x - b.min.x) / (b.max.x - b.min.x || 1); v = (q.z - b.min.z) / (b.max.z - b.min.z || 1); if (avg.y > 0) v = 1 - v; }
        uv[i * 2] = u; uv[i * 2 + 1] = v;
      }
    } else {
      const T = 0.55;
      for (let i = 0; i < P3.length; i++) {
        const q = P3[i], d = N3[i];
        const ax = Math.abs(d.x), ay = Math.abs(d.y), az = Math.abs(d.z);
        let u, v;
        if (ax >= ay && ax >= az) { u = d.x > 0 ? -q.z : q.z; v = q.y; }
        else if (ay >= az) { u = q.x; v = d.y > 0 ? -q.z : q.z; }
        else { u = d.z > 0 ? q.x : -q.x; v = q.y; }
        uv[i * 2] = u / T; uv[i * 2 + 1] = v / T;
      }
    }
    out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    cache.set(key, out);
  }
  m.geometry = out;
}

const SIDES = (W, D) => ({
  n: { len: W, o: [-W / 2, -D / 2], u: [1, 0], inward: [0, 1] },
  s: { len: W, o: [W / 2, D / 2], u: [-1, 0], inward: [0, -1] },
  w: { len: D, o: [-W / 2, D / 2], u: [0, -1], inward: [1, 0] },
  e: { len: D, o: [W / 2, -D / 2], u: [0, 1], inward: [-1, 0] },
});

class Room {
  constructor(G, slot, def) {
    this.G = G;
    this.def = def;
    this.ox = 6000 + slot * 100;
    this.root = new THREE.Group();
    this.root.name = def.id;
    this.root.position.set(this.ox, 0, 0);
    this.points = {};
    this.spawns = {};
    this.screens = [];
    this.lights = [];
    this.clear = [];     // kept-free floor in front of doors and openings
    this.holes = [];     // windows, doors and gaps in room coordinates
    this.recesses = [];  // alcoves behind the wall line: [x0, x1] x [z0, z1]
    this.planes = [];    // surfaces things hang on: { side, n, d, s, t0, t1 }
  }

  w(x, z, y = 0) { return new THREE.Vector3(this.ox + x, y, z); }

  // Walls along the room's edges with openings: {side, at, width, height, sill}
  build() {
    const { G, def } = this;
    const W = def.w, D = def.d, Ht = def.h;
    const wallMat = def.wallMat, floorMat = def.floorMat, ceilMat = def.ceilMat;
    const g = this.root;
    g.add(quad([-W / 2, 0, D / 2], [W / 2, 0, D / 2], [W / 2, 0, -D / 2], [-W / 2, 0, -D / 2], def.floorTile || 1.2, floorMat, 'floor'));
    g.add(quad([-W / 2, Ht, -D / 2], [W / 2, Ht, -D / 2], [W / 2, Ht, D / 2], [-W / 2, Ht, D / 2], 2.5, ceilMat, 'ceiling'));
    const sides = this.sides = SIDES(W, D);
    const holes = this.holes = [...(def.windows || []).map((h) => ({ ...h, kind: 'window' })),
      ...(def.doors || []).map((h) => ({ ...h, kind: 'door', sill: 0, height: h.height ?? 2.1, width: h.width ?? 0.9 })),
      ...(def.gaps || []).map((h) => ({ ...h, kind: 'gap', sill: 0, height: Ht }))]
      .map((h) => ({ ...h, a: h.at - h.width / 2, b: h.at + h.width / 2 }));
    const breasts = (def.breasts || []).map((b) => ({ ...b, a: b.at - b.width / 2, b: b.at + b.width / 2, depth: b.depth ?? 0.36 }));
    for (const [key, s] of Object.entries(sides)) {
      s.key = key;
      s.P3 = (t, y, k = 0) => [s.o[0] + s.u[0] * t + s.inward[0] * k, y, s.o[1] + s.u[1] * t + s.inward[1] * k];
      s.P = (t, k = 0) => [s.o[0] + s.u[0] * t + s.inward[0] * k, s.o[1] + s.u[1] * t + s.inward[1] * k];
      s.d = s.inward[0] * s.o[0] + s.inward[1] * s.o[1];
      this.planes.push({ side: key, kind: 'wall', n: [s.inward[0], 0, s.inward[1]], d: s.d, s, t0: 0, t1: s.len });
      const hs = holes.filter((h) => h.side === key).sort((p, q) => p.a - q.a);
      const P3 = s.P3;
      let t = 0;
      const seg = (t0, t1, y0, y1) => {
        if (t1 - t0 < 0.01 || y1 - y0 < 0.01) return;
        g.add(quad(P3(t0, y0), P3(t1, y0), P3(t1, y1), P3(t0, y1), def.wallTile || 2.0, wallMat, 'wall'));
      };
      for (const h of hs) {
        if (h.kind !== 'window' && !h.depth) {
          // nothing may stand in front of a door or an opening
          const p0 = P3(h.a - 0.25, 0), p1 = P3(h.b + 0.25, 0);
          const q0 = [p0[0] + s.inward[0] * 1.15, p0[2] + s.inward[1] * 1.15], q1 = [p1[0] + s.inward[0] * 1.15, p1[2] + s.inward[1] * 1.15];
          const xs = [p0[0], p1[0], q0[0], q1[0]], zs = [p0[2], p1[2], q0[1], q1[1]];
          this.clear.push({ x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs), u: s.u, mid: (h.a + h.b) / 2, side: key, kind: h.kind });
        }
        seg(t, h.a, 0, Ht);
        seg(h.a, h.b, 0, h.sill);
        seg(h.a, h.b, h.sill + h.height, Ht);
        if (h.depth) this.recess(s, h); else this.opening(s, h, P3);
        t = h.b;
      }
      seg(t, s.len, 0, Ht);
      // skirting board, stopping at every door and gap; the end walls butt
      // against the long walls' boards so no two boards overlap in a corner
      const cuts = hs.filter((h) => (h.sill ?? 0) < 0.15).map((h) => (h.depth ? [h.a, h.b] : [h.a - 0.04, h.b + 0.04]));
      for (const b of breasts.filter((q) => q.side === key)) cuts.push([b.a, b.b]);
      cuts.sort((p, q) => p[0] - q[0]);
      const inset = key === 'w' || key === 'e' ? SKIRT_T + 0.001 : 0;
      let t0 = inset;
      for (const [ca, cb] of [...cuts, [s.len - inset, s.len - inset]]) {
        if (ca - t0 > 0.05) this.skirt(s.P(t0), s.P(ca), s.inward);
        t0 = Math.max(t0, cb);
      }
      // collider for the wall (openings for doors are closed: doors teleport);
      // recesses are left open and closed behind
      const spans = [];
      let c0 = -WALL_T;
      for (const h of hs.filter((q) => q.depth)) { spans.push([c0, h.a]); c0 = h.b; }
      spans.push([c0, s.len + WALL_T]);
      for (const [a, b] of spans) this.wallCollider(s, a, b, 0, -WALL_T);
      for (const h of hs.filter((q) => q.depth)) {
        this.wallCollider(s, h.a, h.b, -h.depth, -h.depth - WALL_T);
        this.wallCollider(s, h.a - WALL_T, h.a, 0, -h.depth);
        this.wallCollider(s, h.b, h.b + WALL_T, 0, -h.depth);
      }
    }
    for (const b of breasts) this.breast(sides[b.side], b);
  }

  // a box collider over [t0, t1] along a wall, between k0 and k1 off it
  wallCollider(s, t0, t1, k0, k1) {
    const a = s.P((t0 + t1) / 2, (k0 + k1) / 2);
    const along = Math.abs(s.u[0]) > 0.5;
    const ht = Math.abs(t1 - t0) / 2, hk = Math.abs(k1 - k0) / 2;
    this.G.col.add(this.ox + a[0], a[1], along ? ht : hk, along ? hk : ht, 0, { y0: -1, y1: this.def.h + 1, tag: this.def.id + '_wall' });
  }

  // a skirting board along a face from p0 to p1 ([x, z]), facing n
  skirt(p0, p1, n, mat = this.def.skirtMat) {
    const dx = p1[0] - p0[0], dz = p1[1] - p0[1], len = Math.hypot(dx, dz);
    if (len < 0.03) return;
    const m = mesh(boxGeo(len, SKIRT_H, SKIRT_T, 0.6), mat, 'skirting', { cast: false });
    m.position.set((p0[0] + p1[0]) / 2 + n[0] * (SKIRT_T / 2 + 0.001), SKIRT_H / 2, (p0[1] + p1[1]) / 2 + n[1] * (SKIRT_T / 2 + 0.001));
    m.rotation.y = Math.atan2(-dz, dx);
    this.root.add(m);
  }

  // an alcove behind the wall line: back wall, sides, floor, ceiling, boards
  recess(s, h) {
    const { def } = this;
    const g = this.root, Ht = def.h, dp = h.depth, tile = def.wallTile || 2.0;
    const A = s.P(h.a), B = s.P(h.b), A1 = s.P(h.a, -dp), B1 = s.P(h.b, -dp);
    const out = [-s.inward[0], -s.inward[1]];
    g.add(vquad(A1, B1, 0, Ht, s.inward, tile, def.wallMat, 'recess_wall'));
    g.add(vquad(A, A1, 0, Ht, s.u, tile, def.wallMat, 'recess_wall'));
    g.add(vquad(B1, B, 0, Ht, [-s.u[0], -s.u[1]], tile, def.wallMat, 'recess_wall'));
    g.add(hquad([A, B, B1, A1], 0, true, def.floorTile || 1.2, def.floorMat, 'recess_floor'));
    g.add(hquad([A, B, B1, A1], Ht, false, 2.5, def.ceilMat, 'recess_ceiling'));
    this.skirt(A1, B1, s.inward);
    this.skirt(s.P(h.a, -dp + SKIRT_T + 0.001), s.P(h.a, SKIRT_T + 0.001), s.u);
    this.skirt(s.P(h.b, -dp + SKIRT_T + 0.001), s.P(h.b, SKIRT_T + 0.001), [-s.u[0], -s.u[1]]);
    const xs = [A[0], B[0], A1[0], B1[0]], zs = [A[1], B[1], A1[1], B1[1]];
    this.recesses.push({ x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs), side: s.key });
    this.planes.push({ side: s.key, kind: 'recess', n: [s.inward[0], 0, s.inward[1]], d: s.d - dp, s, t0: h.a, t1: h.b });
    void out;
  }

  // a chimney breast standing out from the wall, with a fireplace
  breast(s, b) {
    const { G, def } = this;
    const g = this.root, Ht = def.h, dp = b.depth, tile = def.wallTile || 2.0;
    const u = s.u, n = s.inward, nu = [-u[0], -u[1]];
    const P = s.P;
    const c = (b.a + b.b) / 2;
    const fw = b.fireW ?? 0.6, fh = b.fireH ?? 0.62, fd = 0.28;
    const ca = c - fw / 2, cb = c + fw / 2;
    g.add(vquad(P(b.a, dp), P(ca, dp), 0, Ht, n, tile, def.wallMat, 'breast'));
    g.add(vquad(P(cb, dp), P(b.b, dp), 0, Ht, n, tile, def.wallMat, 'breast'));
    g.add(vquad(P(ca, dp), P(cb, dp), fh, Ht, n, tile, def.wallMat, 'breast'));
    g.add(vquad(P(b.a, 0), P(b.a, dp), 0, Ht, nu, tile, def.wallMat, 'breast'));
    g.add(vquad(P(b.b, dp), P(b.b, 0), 0, Ht, u, tile, def.wallMat, 'breast'));
    // the fire opening: sooty brick inside
    const soot = this.M.soot;
    g.add(vquad(P(ca, dp - fd), P(cb, dp - fd), 0, fh, n, 0.5, soot, 'firebox'));
    g.add(vquad(P(ca, dp - fd), P(ca, dp), 0, fh, u, 0.5, soot, 'firebox'));
    g.add(vquad(P(cb, dp), P(cb, dp - fd), 0, fh, nu, 0.5, soot, 'firebox'));
    g.add(hquad([P(ca, dp - fd), P(cb, dp - fd), P(cb, dp), P(ca, dp)], fh, false, 0.5, soot, 'firebox'));
    const rot = Math.atan2(-u[1], u[0]);        // local x along the wall, local z into the room
    const put = (m, t, k, y) => { const p = P(t, k); m.position.set(p[0], y, p[1]); m.rotation.y = rot; g.add(m); return m; };
    // hearth stone, running into the opening
    const hw = fw + 0.5, hd = fd + 0.42;
    put(mesh(boxGeo(hw, 0.03, hd, 0.5), this.M.hearth, 'hearth', { cast: false }), c, dp - fd + hd / 2, 0.015);
    // the surround: jambs, frieze, mantel shelf
    const wood = def.mantelMat || G.mats.get('wood_dark');
    put(mesh(boxGeo(0.16, fh + 0.18, 0.025), wood, 'mantel'), ca - 0.08, dp + 0.0125, (fh + 0.18) / 2);
    put(mesh(boxGeo(0.16, fh + 0.18, 0.025), wood, 'mantel'), cb + 0.08, dp + 0.0125, (fh + 0.18) / 2);
    put(mesh(boxGeo(fw, 0.18, 0.025), wood, 'mantel'), c, dp + 0.0125, fh + 0.09);
    const shelfY = fh + 0.2;
    put(mesh(boxGeo(fw + 0.56, 0.04, 0.17), wood, 'mantel'), c, dp + 0.085, shelfY);
    // a low iron fender round the hearth
    const iron = G.mats.get('iron_black');
    const fy = 0.03;
    put(mesh(boxGeo(hw - 0.06, 0.09, 0.018), iron, 'fender'), c, dp + 0.4, fy + 0.045);
    put(mesh(boxGeo(0.018, 0.08, 0.37), iron, 'fender'), c - hw / 2 + 0.04, dp + 0.215, fy + 0.04);
    put(mesh(boxGeo(0.018, 0.08, 0.37), iron, 'fender'), c + hw / 2 - 0.04, dp + 0.215, fy + 0.04);
    // boards round the breast, stopping at the hearth
    this.skirt(P(b.a, SKIRT_T + 0.001), P(b.a, dp + 0.001), nu);
    this.skirt(P(b.b, dp + 0.001), P(b.b, SKIRT_T + 0.001), u);
    this.skirt(P(b.a - SKIRT_T - 0.001, dp), P(c - hw / 2, dp), n);
    this.skirt(P(c + hw / 2, dp), P(b.b + SKIRT_T + 0.001, dp), n);
    const mid = P(c, dp / 2);
    const along = Math.abs(u[0]) > 0.5;
    G.col.add(this.ox + mid[0], mid[1], along ? (b.b - b.a) / 2 : dp / 2, along ? dp / 2 : (b.b - b.a) / 2, 0, { y0: -1, y1: Ht + 1, tag: def.id + '_wall' });
    this.planes.push({ side: s.key, kind: 'breast', n: [n[0], 0, n[1]], d: s.d + dp, s, t0: b.a, t1: b.b });
    b.shelf = { t: c, k: dp + 0.085, y: shelfY + 0.02, hearth: P(c, dp + 0.2), s };
    this.breastInfo = b;
  }

  opening(s, h, P3) {
    const { G, def } = this;
    if (h.kind === 'gap') return;     // a plain opening in the wall
    const g = this.root;
    const frameMat = def.frameMat;
    const a = P3(h.a, 0), b = P3(h.b, 0);
    const cx = (a[0] + b[0]) / 2, cz = (a[2] + b[2]) / 2;
    const rot = Math.atan2(s.inward[0], s.inward[1]);
    // reveal: the thickness of the wall round the opening
    const rv = (t, y0, y1) => {
      const p = P3(t, 0);
      const m = mesh(boxGeo(0.06, y1 - y0, WALL_T, 0.6), frameMat, 'reveal');
      m.position.set(p[0] - s.inward[0] * (WALL_T / 2 - 0.012), (y0 + y1) / 2, p[2] - s.inward[1] * (WALL_T / 2 - 0.012));
      m.rotation.y = rot;
      g.add(m);
    };
    rv(h.a, h.sill, h.sill + h.height); rv(h.b, h.sill, h.sill + h.height);
    const lintel = mesh(boxGeo(h.width + 0.12, 0.08, WALL_T, 0.6), frameMat, 'lintel');
    lintel.position.set(cx - s.inward[0] * (WALL_T / 2 - 0.014), h.sill + h.height + 0.04, cz - s.inward[1] * (WALL_T / 2 - 0.014));
    lintel.rotation.y = rot;
    g.add(lintel);
    if (h.kind === 'window') {
      const sill = mesh(boxGeo(h.width + 0.12, 0.08, WALL_T * 1.25, 0.6), frameMat, 'sill');
      sill.position.set(lintel.position.x, h.sill - 0.03, lintel.position.z);
      sill.rotation.y = rot;
      g.add(sill);
      // the painted view a few metres beyond, lit like daylight or night
      const dist = h.viewDist ?? 6;
      const vw = h.width * (1 + dist * 0.9), vh = h.height * (1 + dist * 0.9);
      const views = [P.view(h.view || 'city', false, G.art), P.view(h.view || 'city', true, G.art)];
      const vm = new THREE.MeshBasicMaterial({ map: views[0], fog: false, toneMapped: true });
      const vp = new THREE.Mesh(new THREE.PlaneGeometry(vw, vh), vm);
      vp.name = 'view';
      vp.position.set(cx - s.inward[0] * (WALL_T + dist), h.sill + h.height / 2, cz - s.inward[1] * (WALL_T + dist));
      vp.rotation.y = rot;
      g.add(vp);
      this.viewMats = this.viewMats || [];
      this.viewMats.push({ mat: vm, views });
      // grimy glass with sash bars; the cross bar is a little thinner so the
      // two bars' faces never share a plane where they cross
      const gm = new THREE.MeshStandardMaterial({ map: P.dirtyGlass(h.dirty ?? 0.5), transparent: true, opacity: 0.32, roughness: 0.15, metalness: 0, depthWrite: false });
      const gp = new THREE.Mesh(new THREE.PlaneGeometry(h.width, h.height), gm);
      gp.name = 'glass';
      gp.position.set(cx - s.inward[0] * WALL_T * 0.6, h.sill + h.height / 2, cz - s.inward[1] * WALL_T * 0.6);
      gp.rotation.y = rot;
      g.add(gp);
      const bar = (w, ht, y, dz) => {
        const m = mesh(boxGeo(w, ht, dz, 0.6), frameMat, 'sash');
        m.position.set(cx - s.inward[0] * WALL_T * 0.6, y, cz - s.inward[1] * WALL_T * 0.6);
        m.rotation.y = rot;
        g.add(m);
      };
      bar(0.05, h.height, h.sill + h.height / 2, 0.04);
      bar(h.width, 0.05, h.sill + h.height * 0.55, 0.032);
      // daylight through the window
      const sun = new THREE.SpotLight(0xdfe6ee, 0, 12, 0.9, 0.8, 2);
      sun.position.set(cx - s.inward[0] * 2.5, h.sill + h.height + 0.8, cz - s.inward[1] * 2.5);
      sun.target.position.set(cx + s.inward[0] * 2.5, 0, cz + s.inward[1] * 2.5);
      g.add(sun); g.add(sun.target);
      this.windowLights = this.windowLights || [];
      this.windowLights.push(sun);
    } else {
      // door leaf and frame, the way out; the leaf's top runs up into the
      // lintel so it shares no face with the reveals
      const leaf = mesh(boxGeo(h.width, h.height + 0.02, 0.05, 0.6), h.leafMat || def.doorMat, 'door');
      leaf.position.set(cx - s.inward[0] * 0.04, (h.height + 0.02) / 2, cz - s.inward[1] * 0.04);
      leaf.rotation.y = rot;
      g.add(leaf);
      if (h.knob !== false) {
        const knob = mesh(new THREE.SphereGeometry(0.03, 10, 8), G.mats.get('brass'), 'knob');
        const kx = h.width * 0.38;
        knob.position.set(cx + s.u[0] * kx + s.inward[0] * 0.01, 1.0, cz + s.u[1] * kx + s.inward[1] * 0.01);
        g.add(knob);
      }
      if (h.notice) {
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.3), new THREE.MeshStandardMaterial({ map: P.notice(h.notice), roughness: 0.9 }));
        sign.name = 'notice';
        sign.position.set(cx - s.inward[0] * 0.012, 1.5, cz - s.inward[1] * 0.012);
        sign.rotation.y = rot;
        g.add(sign);
      }
      if (h.to) {
        const pos = this.w(cx + s.inward[0] * 0.4, cz + s.inward[1] * 0.4, 1.2);
        G.interact({
          location: def.id, pos, radius: 1.8, label: h.label || '나간다',
          enabled: () => (h.enabled ? h.enabled(G) : true),
          use: () => {
            if (h.use) return h.use(G);
            const [to, spawn] = h.to;
            if (to === 'city') G.teleport('city', spawn);
            else if (G.locations.has(to)) G.teleport(to, spawn);
          },
        });
      }
      if (h.spawn) this.spawns[h.spawn] = { x: this.ox + cx + s.inward[0] * 0.8, z: cz + s.inward[1] * 0.8, yaw: Math.atan2(-s.inward[0], -s.inward[1]) };
    }
  }

  // the box round an object in room coordinates (whatever the state of the
  // root's world matrix: it is not in the scene yet while the room is built)
  localBox(obj) {
    this.root.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(obj, true);
    return b.translate(new THREE.Vector3(-this.ox, 0, 0));
  }

  // push a wall item (poster, screen, picture) back until it sits `gap` off
  // the wall, alcove or chimney breast it faces
  mount(obj, gap = 0.002) {
    const b = this.localBox(obj);
    const f = new THREE.Vector3(0, 0, 1).applyQuaternion(obj.quaternion);
    const c = b.getCenter(new THREE.Vector3());
    let best = null;
    for (const p of this.planes) {
      if (p.n[0] * f.x + p.n[2] * f.z < 0.9) continue;
      const t = (c.x - p.s.o[0]) * p.s.u[0] + (c.z - p.s.o[1]) * p.s.u[1];
      if (t < p.t0 - 0.01 || t > p.t1 + 0.01) continue;
      const back = p.n[0] > 0.5 ? b.min.x : p.n[0] < -0.5 ? -b.max.x : p.n[2] > 0.5 ? b.min.z : -b.max.z;
      const dist = back - p.d;
      if (dist < -0.06) continue;
      if (!best || dist < best.dist) best = { p, dist };
    }
    if (!best) { console.warn('[rooms] nothing to hang', obj.userData.prop, 'on in', this.def.id); return obj; }
    obj.position.x -= best.p.n[0] * (best.dist - gap);
    obj.position.z -= best.p.n[2] * (best.dist - gap);
    obj.userData.mounted = true;
    return obj;
  }

  prop(model, x, z, rot = 0, o = {}) {
    const { G } = this;
    let obj;
    try { obj = G.assets.instance(model); } catch (e) { console.warn('[rooms]', e.message); return null; }
    G.mats.apply(obj, { cast: o.cast ?? true, receive: true, override: o.override });
    obj.updateMatrixWorld(true);
    obj.traverse((m) => { if (m.isMesh) giveUV(m); });
    return this.place(obj, model, x, z, rot, o);
  }

  // put an object (a model or something built here) into the room
  place(obj, name, x, z, rot = 0, o = {}) {
    obj.position.set(x, o.y ?? 0, z);
    if (o.tilt) { obj.rotation.order = 'YXZ'; obj.rotation.set(o.tilt, rot, 0); } else obj.rotation.y = rot;
    obj.userData.prop = o.name || name;
    if (o.scale) obj.scale.setScalar(o.scale);
    if (o.inset) obj.userData.inset = true;
    this.root.add(obj);
    if (o.mount) this.mount(obj, o.gap);
    if (o.lean) obj.userData.mounted = false;     // a frame stood against the wall
    // keep the way through doors free: slide a floor-standing prop along the
    // wall out of a door's clearance, or leave it out
    if (!o.allowDoor && (!o.mount || o.lean) && this.localBox(obj).min.y < 0.3) {
      const hit = () => {
        const b = this.localBox(obj);
        if (b.max.y - b.min.y < 0.03) return null;     // a rug may lie in a doorway
        return this.clear.find((c) => b.max.x > c.x0 && b.min.x < c.x1 && b.max.z > c.z0 && b.min.z < c.z1);
      };
      const c = hit();
      if (c) {
        const base = obj.position.clone();
        let done = false;
        for (let k = 1; k <= 12 && !done; k++) {
          for (const sg of [1, -1]) {
            obj.position.set(base.x + c.u[0] * 0.2 * k * sg, base.y, base.z + c.u[1] * 0.2 * k * sg);
            if (!hit()) { done = true; break; }
          }
        }
        if (!done) { console.warn('[rooms] left out', name, 'in', this.def.id, ': it would block a door'); this.root.remove(obj); return null; }
        obj.userData.slid = { from: [+base.x.toFixed(2), +base.z.toFixed(2)], to: [+obj.position.x.toFixed(2), +obj.position.z.toFixed(2)] };
        console.info('[rooms] moved', name, 'in', this.def.id, 'out of a doorway', JSON.stringify(obj.userData.slid));
      }
    }
    if (o.collide !== false) {
      const box = this.localBox(obj);
      box.min.x += this.ox; box.max.x += this.ox;
      if (box.max.y - box.min.y > 0.3 && o.collide !== 'none') {
        this.G.col.addBox3(box, { pad: 0.04, tag: this.def.id + '_prop', sight: o.sight ?? (box.max.y > 1.6) });
      }
    }
    return obj;
  }

  // a group of library-material boxes built here, placed like a prop
  built(name, parts, x, z, rot = 0, o = {}) {
    const grp = new THREE.Group();
    for (const [geo, mat, px = 0, py = 0, pz = 0, ry = 0] of parts) {
      const m = mesh(geo, mat, name);
      m.position.set(px, py, pz); m.rotation.y = ry;
      grp.add(m);
    }
    return this.place(grp, name, x, z, rot, o);
  }

  telescreen(x, y, z, rot, o = {}) {
    const obj = this.prop('telescreen_wall', x, z, rot, { y, collide: false, mount: true, scale: o.scale });
    const dir = new THREE.Vector3(Math.sin(rot), 0, Math.cos(rot));
    const t = { location: this.def.id, pos: this.w(obj.position.x, obj.position.z, y).addScaledVector(dir, 0.15), dir, fov: o.fov ?? 150, range: o.range ?? 12, object: obj };
    this.screens.push(t);
    return t;
  }

  light(x, y, z, o = {}) {
    const bulb = this.prop(o.model || 'bulb', x, z, 0, { y, collide: false, cast: false });
    void bulb;
    const l = new THREE.PointLight(o.color ?? 0xffc98e, o.intensity ?? 45, o.distance ?? 14, 2);
    l.position.set(x, y - 0.78, z);
    if (o.shadow !== false && !this.shadowLight) {
      l.castShadow = true;
      l.shadow.mapSize.set(1024, 1024);
      l.shadow.bias = -0.002;
      l.shadow.radius = 4;
      this.shadowLight = l;
    }
    this.root.add(l);
    this.lights.push({ light: l, base: l.intensity });
    return l;
  }

  register() {
    const { G, def } = this;
    const self = this;
    G.addLocation({
      id: def.id, root: this.root, exterior: false, spawns: this.spawns,
      fogColor: def.fog ?? 0x14110d, fogDensity: def.fogDensity ?? 0.04, exposure: def.exposure ?? 1.15,
      zone: () => def.zone || 'interior',
      onEnter: () => {
        const night = (G.atmos.day ?? 1) < 0.3;
        if (self.viewMats) for (const v of self.viewMats) v.mat.map = v.views[night ? 1 : 0];
        if (self.windowLights) for (const l of self.windowLights) l.intensity = night ? 0 : (def.daylight ?? 18) * (0.4 + 0.6 * (G.atmos.day ?? 1));
        if (def.onEnter) def.onEnter(G, self);
      },
      update: (dt) => {
        // a faint flicker in the mains, as power is rationed
        const f = 1 - (Math.random() < 0.01 ? 0.25 : 0) * (def.flicker ?? 1);
        for (const l of self.lights) l.light.intensity = l.base * f * (def.lightScale ?? 1);
        if (def.update) def.update(dt, G, self);
      },
    });
    for (const t of this.screens) {
      if (G.surv && G.surv.addTelescreen) G.surv.addTelescreen(t);
      else G.interiors.telescreens.push(t);
    }
  }
}

export function setupInteriors(G) {
  G.interiors = { points: {}, telescreens: [], rooms: {} };
  const tex = {
    paper: P.paperUtility(), victorian: P.paperVictorian(), stripe: P.paperStripe(),
    lino: P.linoPlain(), linoRed: P.linoPlain([110, 52, 40]), carpet: P.carpet(), plaster: P.paintNeutral(3),
  };
  const lib = (n) => G.mats.get(n);
  const M = {
    paper: std(G, tex.paper), victorian: std(G, tex.victorian), stripe: std(G, tex.stripe),
    lino: std(G, tex.lino, { rough: 0.6 }), linoRed: std(G, tex.linoRed, { rough: 0.55 }), carpet: std(G, tex.carpet, { rough: 1 }),
    plaster: std(G, tex.plaster, { color: 0xd8d2c4 }), ministry: std(G, tex.plaster, { color: 0xbfc4c0 }),
    wood: lib('wood'), woodDark: lib('wood_dark'), tile: lib('tile_white'), concrete: lib('concrete_grey'),
    wallpaper: lib('wallpaper'), peeling: lib('plaster_peeling'), brick: lib('brick'),
    metal: lib('metal'), metalDark: lib('metal_dark'), brass: lib('brass'), iron: lib('iron_black'),
    soot: std(G, null, { color: 0x17130f, rough: 1, name: 'soot' }),
    hearth: std(G, P.quarry(), { rough: 0.85, name: 'hearth' }),
    rag: std(G, P.ragRug(2), { rough: 1, name: 'rag_rug' }),
    runner: std(G, P.runner(), { rough: 1, name: 'runner' }),
    shade: new THREE.MeshStandardMaterial({ name: 'lamp_shade', color: 0x1f5a2c, emissive: 0x0d2a12, roughness: 0.5, side: THREE.DoubleSide }),
    clock: new THREE.MeshStandardMaterial({ name: 'clock_face', map: P.clockFace(12), roughness: 0.4 }),
    dart: new THREE.MeshStandardMaterial({ name: 'dartboard', map: P.dartboard(), roughness: 0.95 }),
  };
  const base = { skirtMat: M.woodDark, frameMat: M.woodDark, doorMat: M.woodDark, ceilMat: M.plaster };
  let slot = 0;
  const make = (def) => {
    const room = new Room(G, slot++, { ...base, ...def });
    room.M = M;
    room.build();
    if (def.furnish) def.furnish(room);
    room.register();
    G.interiors.rooms[def.id] = room;
    G.interiors.points[def.id] = room.points;
    return room;
  };
  const pt = (room, name, x, z, y = 0) => { room.points[name] = room.w(x, z, y); };

  // ---- things built from boxes, placed like props (local +z faces the room)
  // a counter: body, overhanging top, a kick plinth set back
  const counter = (w, h, d, body, top, o = {}) => [
    [boxGeo(w, h - 0.04 - 0.1, d - 0.02, 0.6), body, 0, 0.1 + (h - 0.14) / 2, -0.01],
    [boxGeo(w - 0.06, 0.1, d - 0.08, 0.6), o.plinth || M.iron, 0, 0.05, -0.03],
    [boxGeo(w + 0.04, 0.04, d + 0.06, 0.6), top, 0, h - 0.02, 0.03],
  ];
  // wall shelves on iron brackets (back at z = 0)
  const shelves = (w, ys, d = 0.2) => {
    const parts = ys.map((y) => [boxGeo(w, 0.025, d, 0.6), M.woodDark, 0, y, d / 2]);
    const br = [];
    for (const y of ys) for (const x of [-w / 2 + 0.12, w / 2 - 0.12]) br.push([0.02, 0.14, d - 0.03, x, y - 0.0825, (d - 0.03) / 2]);
    parts.push([boxesGeo(br, 0.3), M.iron]);
    return parts;
  };
  // a rag rug or a strip of carpet lying on the floor
  const rug = (r, x, z, w, d, mat = M.rag, rot = 0) => r.built('rug', [[boxGeo(w, 0.008, d, Math.max(w, d)), mat, 0, 0.004, 0]], x, z, rot, { collide: false });
  // a stack of loose papers
  const papers = (n, sd = 0) => {
    const list = [];
    for (let i = 0; i < n; i++) list.push([0.21, 0.004, 0.297, Math.sin(sd + i * 2.1) * 0.012, 0.002 + i * 0.0045, Math.cos(sd + i * 1.7) * 0.01]);
    return [[boxesGeo(list, 0.3), lib('paper')]];
  };

  // ---- Victory Mansions: the hallway smelling of boiled cabbage and old rag
  // mats. At one end the poster too large for indoor display; beside it the
  // lift that never works.
  make({
    id: 'mansions_hall', w: 6, d: 9, h: 3.4, wallMat: M.peeling, floorMat: M.linoRed, floorTile: 1.6, fog: 0x18150f,
    windows: [{ side: 's', at: 1.4, width: 1.6, height: 2.2, sill: 0.4, view: 'street', dirty: 0.8 }],
    doors: [
      { side: 's', at: 4.6, width: 1.4, to: ['city', 'home_door'], label: '거리로 나간다', spawn: 'street' },
      { side: 'n', at: 4.8, to: ['flat', 'door'], label: '계단으로 7층까지 올라간다', spawn: 'stairs' },
      { side: 'n', at: 1.4, width: 1.2, height: 2.2, leafMat: M.metalDark, knob: false, notice: ['OUT OF ORDER'] },
    ],
    furnish(r) {
      r.prop('poster', 0.12, -4.4, 0, { collide: false, scale: 1.5, y: 0.72, mount: true });
      r.prop('poster', 2.9, -1.2, -H, { collide: false, y: 1.0, mount: true, override: { poster_bb: G.mats.get('poster_ingsoc') } });
      r.telescreen(-2.9, 1.8, 1.5, H, { range: 10 });
      rug(r, -1.6, 3.55, 1.3, 0.75);
      r.light(0, 3.4, -1.0, { intensity: 22 });
      pt(r, 'poster', 0.12, -4.3, 1.8);
    },
  });

  // ---- Winston's flat, seven flights up. The telescreen is in the long wall
  // opposite the window; beside it a shallow alcove, out of its sight.
  make({
    id: 'flat', w: 5.2, d: 4.2, h: 2.7, wallMat: M.wallpaper, wallTile: 1.6, floorMat: M.wood, floorTile: 1.5, fog: 0x15120e, exposure: 1.2,
    windows: [{ side: 'n', at: 2.6, width: 1.3, height: 1.4, sill: 0.9, view: 'city', viewDist: 8 }],
    // the alcove: a recess 1.2 m wide, 0.62 m deep in the south wall, west of the telescreen
    gaps: [{ side: 's', at: 3.8, width: 1.2, depth: 0.62 }],
    doors: [{ side: 'w', at: 3.4, to: ['mansions_hall', 'stairs'], label: '아래층으로 내려간다', spawn: 'door' }],
    furnish(r) {
      const ax = -1.2, ad = 0.62, D = 2.1;
      // telescreen on the long south wall, facing north into the room
      r.telescreen(0.6, 1.6, D - 0.02, PI, { range: 9, fov: 150, scale: 0.8 });
      // he sits well back in the alcove, the chair against its back wall and
      // facing the room; the table stands in front of him, half in the recess
      r.prop('chair', ax, D + ad - 0.27, PI, { collide: 'none' });
      r.prop('table', ax, D - 0.08, 0, { collide: 'none' });
      r.prop('diary', ax + 0.08, D + 0.02, PI + 0.12, { y: 0.762, collide: false });
      r.prop('gin', ax - 0.34, D - 0.22, 0, { y: 0.76, collide: false });
      // iron bed along the east wall, its head to the window wall
      r.prop('bed', 2.08, -1.04, PI);
      r.prop('cupboard', 2.3, 1.55, -H);
      r.prop('sink', -2.3, 0.3, H);
      rug(r, 1.2, -0.9, 0.7, 1.1, M.rag);
      r.light(0.2, 2.7, 0, { intensity: 30 });
      pt(r, 'alcove_seat', ax, D + ad - 0.3);
      pt(r, 'bed', 2.08, -1.04, 0.6);
      pt(r, 'window', 0, -1.6);
      pt(r, 'telescreen', 0.6, D, 1.6);
      r.spawns.alcove = { x: r.ox + ax, z: D + ad - 0.3, yaw: 0 };
      r.spawns.bed = { x: r.ox + 1.3, z: -0.9, yaw: -H };
    },
  });

  // ---- the Parsons' flat next door: scarlet banners of the Youth League and
  // the Spies, a full-sized poster of Big Brother
  make({
    id: 'parsons_flat', w: 6, d: 5, h: 2.7, wallMat: M.wallpaper, wallTile: 1.6, floorMat: M.lino, fog: 0x15120e,
    windows: [{ side: 'n', at: 3, width: 1.3, height: 1.4, sill: 0.9, view: 'city' }],
    doors: [{ side: 'w', at: 4, to: ['mansions_hall', 'stairs'], label: '복도로 나간다', spawn: 'door' }],
    furnish(r) {
      r.prop('table', 0, 0, 0); r.prop('chair', 0.62, 0, -H); r.prop('chair', -0.62, 0, H);
      r.prop('sink', 2.7, 1.5, -H); r.prop('cupboard', 2.7, -1.2, -H);
      r.prop('bed', -2.49, 1.44, 0);
      r.prop('poster', -1.9, -2.45, 0, { collide: false, y: 0.85, mount: true });
      const flag = (title, sub, x, z, rot) => {
        const m = new THREE.MeshStandardMaterial({ map: P.banner(title, sub), roughness: 0.95, name: 'banner' });
        r.built('banner', [[boxGeo(0.5, 0.995, 0.004, 1), m, 0, -0.5025, 0.012], [boxGeo(0.62, 0.024, 0.024, 0.3), M.iron, 0, 0, 0.012]], x, z, rot, { y: 2.35, collide: false, mount: true });
      };
      flag('YOUTH LEAGUE', 'ANTI-SEX', 2.95, -0.05, -H);
      flag('SPIES', 'INGSOC', 2.95, 0.6, -H);
      r.telescreen(-1, 1.6, 2.48, PI, { scale: 0.8 });
      rug(r, -1.55, 1.45, 0.7, 1.2, M.rag);
      r.light(0, 2.7, 0, { intensity: 30 });
      pt(r, 'sink', 2.4, 1.5);
    },
  });

  // ---- the Records Department: a long hall of cubicles, the big telescreen
  // at the end where the chairs are dragged together for the Hate
  make({
    id: 'records', w: 14, d: 30, h: 4.2, wallMat: M.ministry, floorMat: M.lino, floorTile: 1.8, fog: 0x1a1c1c, exposure: 1.05,
    flicker: 0.4, daylight: 0,
    doors: [
      { side: 's', at: 7, width: 1.6, to: ['city', 'minitrue_door'], label: '진리부를 나선다', spawn: 'entrance' },
      { side: 'e', at: 26, to: ['canteen', 'door'], label: '지하 식당으로 내려간다', spawn: 'corridor' },
    ],
    furnish(r) {
      // two rows of cubicles facing the aisle, clear of the Hate's chairs
      for (let i = 0; i < 5; i++) {
        const z = 8 - i * 3.2;
        r.prop('cubicle', -4.6, z, H, { collide: true });
        r.prop('cubicle', 4.6, z, -H, { collide: true });
      }
      // the end of the hall: the big telescreen and the chairs for the Hate
      const big = r.prop('telescreen_wall', 0, -14.9, 0, { y: 2.3, collide: false, scale: 2.6, mount: true });
      const t = { location: 'records', pos: r.w(0, -14.4, 2.3), dir: new THREE.Vector3(0, 0, 1), fov: 160, range: 30, object: big };
      r.screens.push(t);
      for (let row = 0; row < 3; row++) r.prop('chair_row', 0, -10 + row * 1.4, PI, { collide: 'none' });
      // a ragged fourth row of chairs dragged out of the cubicles
      for (let c = 0; c < 6; c++) r.prop('chair', -2.5 + c, -5.8 + (c % 2 ? 0.05 : -0.04), PI + (c % 3 - 1) * 0.06, { collide: 'none' });
      for (let i = 0; i < 4; i++) r.light(0, 4.2, 10 - i * 7, { intensity: 55, model: 'bulb', shadow: i === 1 });
      pt(r, 'cubicle_seat', -4.6 + 0.45, 8 - 2 * 3.2);
      pt(r, 'hate_seat', -0.5, -7.2);
      pt(r, 'julia_seat', -0.5, -5.8);
      pt(r, 'obrien_seat', 1.5, -7.2);
      pt(r, 'screen', 0, -14.6, 2.3);
      pt(r, 'corridor', 6, 12);
      r.spawns.cubicle = { x: r.ox - 3.45, z: 8 - 2 * 3.2, yaw: H };
      r.spawns.hate_seat = { x: r.ox - 0.5, z: -7.2, yaw: 0 };
      r.spawns.corridor = { x: r.ox + 5.5, z: 12, yaw: 0 };
    },
  });

  // ---- the canteen, low-ceilinged, deep underground; the grille at the counter
  make({
    id: 'canteen', w: 16, d: 12, h: 2.6, wallMat: M.tile, wallTile: 1.0, floorMat: M.lino, fog: 0x1e1d18, fogDensity: 0.06,
    doors: [{ side: 'w', at: 2, to: ['records', 'corridor'], label: '기록국으로 올라간다', spawn: 'door' }],
    furnish(r) {
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) r.prop('canteen_table', -3 + i * 4, -1 + j * 3.4, 0);
      const bars = [];
      for (let x = -2.9; x <= 2.91; x += 0.16) bars.push([0.012, 0.55, 0.012, x, 1.275, 0.2]);
      bars.push([5.9, 0.03, 0.03, 0, 1.565, 0.2]);
      r.built('counter', [...counter(6, 1.0, 0.6, M.metal, M.metalDark), [boxesGeo(bars, 0.3), M.iron]], 1, -4.6, 0);
      // the kitchen side: a steel shelf of tins along the back wall
      r.built('shelf', shelves(4, [1.2, 1.6], 0.25), 1, -6, 0, { y: 0, collide: false, mount: true });
      for (let i = 0; i < 9; i++) r.prop('tin', -0.6 + i * 0.4, -5.86, 0, { y: 1.2125, collide: false });
      r.telescreen(7.9, 1.8, 0, -H, { range: 14 });
      for (let i = 0; i < 3; i++) r.light(-4 + i * 4, 2.6, 0, { intensity: 35, shadow: i === 1 });
      pt(r, 'table', -3, -1.8);
      pt(r, 'counter', 1, -3.8);
      r.spawns.table = { x: r.ox - 3, z: -2.2, yaw: 0 };
    },
  });

  // ---- Mr Charrington's junk shop: dusty picture-frames stacked round the
  // walls, rubbish in the window, odds and ends on a small table in the
  // corner, the glass paperweight among them
  make({
    id: 'shop', w: 6, d: 7, h: 2.8, wallMat: M.victorian, floorMat: M.woodDark, floorTile: 1.2, fog: 0x17120c, exposure: 1.25,
    windows: [{ side: 's', at: 2.0, width: 2.6, height: 1.6, sill: 0.6, view: 'prole', dirty: 0.9 }],
    doors: [
      { side: 's', at: 4.8, to: ['city', 'shop_door'], label: '가게를 나선다', spawn: 'door' },
      { side: 'n', at: 4.6, to: ['room', 'door'], label: '2층 방으로 올라간다', spawn: 'stairs' },
    ],
    furnish(r) {
      // the counter along the west side, the old man's cupboard behind it
      r.built('counter', counter(2.6, 0.95, 0.5, M.woodDark, M.woodDark, { plinth: M.woodDark }), -1.45, -1.2, H);
      r.prop('cupboard', -2.7, -1.6, H);
      r.prop('tin', -1.4, -1.9, 0, { y: 0.95, collide: false });
      r.prop('tin', -1.5, -1.75, 0.5, { y: 0.95, collide: false });
      r.prop('cupboard', 2.7, -2.0, -H);
      r.prop('armchair', 2.2, -0.75, -H);
      // picture-frames leaning against the east wall
      const dusty = [0x2c2a26, 0x36322a, 0x24221f, 0x3a3630].map((c) => new THREE.MeshStandardMaterial({ name: 'dusty_glass', color: c, roughness: 0.5, metalness: 0.1 }));
      const frame = (x, z, rot, sc, i) => r.prop('engraving', x, z, rot, { name: 'frame', y: 0.237 * sc + 0.001, scale: sc, tilt: -0.15, mount: true, lean: true, gap: 0.001, collide: false, override: { engraving: dusty[i % 4] } });
      [[0.2, 1.25], [0.7, 0.9], [1.2, 1.4], [1.75, 1.0]].forEach(([z, sc], i) => frame(2.9, z, -H, sc, i));
      [[-1.05, 1.0], [-0.3, 1.3], [0.45, 0.85]].forEach(([x, sc], i) => frame(x, -3.4, 0, sc, i + 1));
      [[-0.75, 1.0]].forEach(([x, sc], i) => frame(x, 3.4, PI, sc, i + 2));
      // a board in the window with trays of rubbish
      r.built('window_board', [[boxGeo(2.3, 0.03, 0.42, 0.6), M.woodDark, 0, 0.4, 0.21], [boxesGeo([[0.03, 0.385, 0.03, -1.0, 0.1925, 0.3], [0.03, 0.385, 0.03, 1.0, 0.1925, 0.3]], 0.3), M.woodDark]],
        0.95, 3.474, PI, { collide: false });
      for (const [x, k] of [[0.3, 0], [0.8, 1], [1.4, 2], [1.9, 3]]) r.prop('tin', x, 3.2 - (k % 2) * 0.1, k, { y: 0.415, collide: false });
      // the small table in the corner by the window
      r.prop('table', 2.45, 2.75, H);
      r.prop('paperweight', 2.4, 2.6, 0, { y: 0.76, collide: false });
      r.prop('chess', 2.5, 2.95, 0.4, { y: 0.76, collide: false });
      rug(r, 0.6, -0.4, 1.4, 0.8, M.rag, 0.1);
      r.light(0, 2.8, 0, { intensity: 18 });
      pt(r, 'paperweight', 2.4, 2.6, 0.8);
    },
  });

  // ---- the room above the shop: the bed under the window, an arm-chair
  // drawn up to the fireplace, the clock on the mantelpiece, the gateleg
  // table in the corner, and on the other side of the fireplace, opposite
  // the bed, the engraving of St Clement Danes with what is behind it
  make({
    id: 'room', w: 4.6, d: 4.2, h: 2.6, wallMat: M.wallpaper, floorMat: M.woodDark, fog: 0x17110b, exposure: 1.25,
    windows: [{ side: 's', at: 1.4, width: 1.2, height: 1.3, sill: 0.8, view: 'yard' }],
    doors: [{ side: 'w', at: 3.0, to: ['shop', 'stairs'], label: '가게로 내려간다', spawn: 'door' }],
    breasts: [{ side: 'n', at: 2.85, width: 1.3, depth: 0.36 }],
    furnish(r) {
      r.prop('bed_old', 1.17, 1.25, -H);
      r.prop('gateleg', -1.7, 1.45, 0);
      r.prop('chair', -1.7, 0.72, 0, { collide: 'none' });
      r.prop('armchair', 1.45, -0.95, -2.33);
      const fire = r.breastInfo.shelf;
      r.prop('oil_stove', fire.hearth[0], fire.hearth[1], 0, { y: 0.03, collide: 'none' });
      r.built('clock', [[boxGeo(0.22, 0.24, 0.09, 0.3), M.woodDark, 0, 0.12, 0], [new THREE.CircleGeometry(0.075, 28), M.clock, 0, 0.14, 0.048]],
        fire.t - 2.3 + 0.15, -2.1 + fire.k, 0, { y: fire.y, collide: false });
      rug(r, 0.3, -0.45, 1.5, 0.9, M.runner, H);
      // the picture hangs over the hidden screen, which is let into the wall
      r.hidden = r.prop('telescreen_wall', -1.0, -2.08, 0, { y: 1.55, collide: false, scale: 0.3, inset: true });
      r.hidden.position.z = -2.1 + 0.004 - 0.08 * 0.3;
      r.hidden.visible = false;
      r.engraving = r.prop('engraving', -1.0, -2.0, 0, { y: 1.55, collide: false, mount: true, gap: 0.014 });
      r.light(0, 2.6, 0, { intensity: 16 });
      pt(r, 'bed', 1.17, 1.25, 0.6); pt(r, 'window', 0.9, 1.9, 1.4); pt(r, 'engraving', -1.0, -2.0, 1.55);
      pt(r, 'fire', fire.hearth[0], fire.hearth[1], 0.6); pt(r, 'gateleg', -1.7, 1.45, 0.8);
      r.spawns.bed = { x: r.ox + 0.55, z: 0.05, yaw: PI };
      r.spawns.window = { x: r.ox + 0.9, z: -0.25, yaw: PI };
      r.spawns.stairs = r.spawns.door;      // the top of the stairs from the shop
    },
  });

  // ---- the prole pub: the bar and the barman, darts at the other end, a
  // deal table under the window; no telescreen
  make({
    id: 'pub', w: 9, d: 7, h: 3.0, wallMat: M.victorian, floorMat: M.woodDark, fog: 0x1c140c, fogDensity: 0.07, exposure: 1.2,
    windows: [{ side: 's', at: 2.5, width: 2.0, height: 1.5, sill: 0.8, view: 'prole', dirty: 1 }],
    doors: [{ side: 's', at: 6.5, to: ['city', 'pub_door'], label: '선술집을 나선다', spawn: 'door' }],
    furnish(r) {
      // the bar, its pumps and foot rail
      const pumps = [];
      for (const x of [-1.2, -0.4, 0.4]) pumps.push([0.05, 0.08, 0.05, x, 1.08, 0.12]);
      r.built('bar', [
        ...counter(5, 1.05, 0.62, M.woodDark, M.woodDark, { plinth: M.woodDark }),
        [boxesGeo(pumps, 0.3), M.brass],
        [boxesGeo([[0.024, 0.3, 0.024, -1.2, 1.27, 0.12], [0.024, 0.3, 0.024, -0.4, 1.27, 0.12], [0.024, 0.3, 0.024, 0.4, 1.27, 0.12]], 0.3), M.woodDark],
        [boxesGeo([[4.6, 0.04, 0.04, 0, 0.16, 0.42], [0.03, 0.14, 0.12, -2.0, 0.09, 0.36], [0.03, 0.14, 0.12, 0, 0.09, 0.36], [0.03, 0.14, 0.12, 2.0, 0.09, 0.36]], 0.3), M.brass],
      ], -0.5, -1.85, 0);
      // the back bar: a low cupboard and shelves of bottles
      r.built('back_bar', counter(3.6, 0.9, 0.45, M.woodDark, M.woodDark, { plinth: M.woodDark }), -0.8, -3.24, 0);
      r.built('shelf', shelves(3.4, [1.35, 1.75]), -0.8, -3.47, 0, { collide: false, mount: true });
      for (let i = 0; i < 8; i++) r.prop('gin', -2.3 + i * 0.42, -3.38, 0, { y: (i % 2 ? 1.7625 : 1.3625), collide: false });
      for (let i = 0; i < 5; i++) r.prop('gin', -2.2 + i * 0.6, -3.15, 0, { y: 0.9, collide: false });
      // tables: the deal table under the window, two more
      for (const [x, z] of [[2.0, 2.75], [-2.6, 0.9], [0.6, 0.7]]) { r.prop('table', x, z, 0); r.prop('chair', x + 0.62, z, -H); r.prop('chair', x - 0.62, z, H); }
      r.prop('gin', 2.1, 2.7, 0, { y: 0.76, collide: false });
      // the darts board on the end wall
      const board = new THREE.CylinderGeometry(0.225, 0.225, 0.035, 40);
      board.rotateX(H);
      r.built('dartboard', [[boxGeo(0.62, 0.62, 0.02, 0.4), M.woodDark, 0, 0, 0.01], [board, [M.iron, M.dart, M.iron], 0, 0, 0.0375]],
        4.45, 0.4, -H, { y: 1.73, collide: false, mount: true });
      rug(r, -2.0, 2.6, 1.2, 0.7);
      r.light(-1, 3, 0, { intensity: 26 }); r.light(2.5, 3, 1, { intensity: 14, shadow: false });
      pt(r, 'bar', -0.5, -1.2); pt(r, 'oldman', 2.62, 2.75); pt(r, 'window_table', 2.0, 2.75, 0.8); pt(r, 'darts', 2.2, 0.4);
    },
  });

  // ---- O'Brien's flat: long and softly lit, dark-blue carpet; at the far end
  // the writing-table under a green-shaded lamp, papers either side; the
  // telescreen by the door, which he can turn off
  make({
    id: 'obrien', w: 7, d: 6, h: 3.0, wallMat: std(G, tex.stripe, { color: 0x5a6a90 }), floorMat: M.carpet, fog: 0x0e1018, exposure: 1.15,
    windows: [{ side: 'n', at: 3.5, width: 1.6, height: 1.8, sill: 0.7, view: 'inner', dirty: 0.1 }],
    doors: [{ side: 'w', at: 4.5, to: ['city', 'obrien_door'], label: '오브라이언의 집을 나선다', spawn: 'door' }],
    furnish(r) {
      r.prop('table', 2.55, 0, H);
      r.prop('chair', 3.0, 0, -H, { collide: 'none' });
      const lampShade = new THREE.CylinderGeometry(0.07, 0.16, 0.14, 24, 1, true);
      r.built('desk_lamp', [
        [new THREE.CylinderGeometry(0.07, 0.08, 0.02, 20), M.brass, 0, 0.01, 0],
        [new THREE.CylinderGeometry(0.008, 0.008, 0.34, 8), M.brass, 0, 0.19, 0],
        [lampShade, M.shade, 0, 0.36, 0],
      ], 2.55, -0.3, 0, { y: 0.76, collide: false });
      const glow = new THREE.PointLight(0xffd9a0, 6, 4, 2);
      glow.position.set(2.55, 0.95, -0.3);
      r.root.add(glow);
      r.built('papers', papers(6, 1), 2.4, 0.05, 0.1, { y: 0.76, collide: false });
      r.built('papers', papers(4, 3), 2.7, 0.27, -0.15, { y: 0.76, collide: false });
      // the round table for the drinks, its chairs
      r.prop('gateleg', 0.0, 1.0, 0);
      for (const [dx, dz, rot] of [[0, -0.66, 0], [0, 0.66, PI], [-0.66, 0, H], [0.66, 0, -H]]) r.prop('chair', dx, 1.0 + dz, rot, { collide: 'none' });
      r.prop('gin', 0.1, 0.95, 0, { y: 0.76, collide: false });
      r.prop('armchair', -1.6, -2.2, 0.6);
      r.prop('cupboard', 2.3, 2.72, PI);
      r.screen = r.telescreen(-3.4, 1.6, 0.8, H, { range: 9 });
      r.light(1.0, 3, 0.2, { intensity: 22, color: 0xffe0b8 });
      pt(r, 'desk', 2.55, 0, 0.8); pt(r, 'screen', -3.45, 0.8, 1.6); pt(r, 'round_table', 0, 1.0, 0.8);
    },
  });

  // ---- the Chestnut Tree Café: his usual corner, the chessboard and the
  // gin; the vast face on the opposite wall; the telescreens
  make({
    id: 'cafe', w: 9, d: 7, h: 3.0, wallMat: M.victorian, floorMat: M.lino, fog: 0x15120d, fogDensity: 0.06,
    windows: [{ side: 's', at: 2, width: 2.6, height: 1.6, sill: 0.7, view: 'square' }],
    doors: [{ side: 's', at: 6.5, to: ['city', 'cafe_door'], label: '카페를 나선다', spawn: 'door' }],
    furnish(r) {
      r.prop('table', -3.45, -2.75, H);
      r.prop('chair', -3.92, -2.75, H, { collide: 'none' });
      r.prop('chess', -3.42, -2.85, 0.3, { y: 0.76, collide: false });
      r.prop('gin', -3.5, -2.45, 0, { y: 0.76, collide: false });
      r.prop('poster', 4.45, -1.15, -H, { collide: false, scale: 1.6, y: 0.45, mount: true });
      for (const [x, z] of [[-1.0, -2.3], [1.0, 0.1], [-1.4, 1.4], [2.6, 2.55]]) { r.prop('table', x, z, 0); r.prop('chair', x + 0.62, z, -H); r.prop('chair', x - 0.62, z, H); }
      // the counter and the waiter's bottles
      r.built('counter', counter(2.4, 1.0, 0.55, M.woodDark, M.woodDark, { plinth: M.woodDark }), 2.6, -2.6, 0);
      r.built('shelf', shelves(2.2, [1.4, 1.75]), 2.6, -3.47, 0, { collide: false, mount: true });
      for (let i = 0; i < 6; i++) r.prop('gin', 1.75 + i * 0.34, -3.38, 0, { y: i % 2 ? 1.7625 : 1.4125, collide: false });
      r.prop('gin', 2.1, -2.6, 0, { y: 1.0, collide: false });
      r.telescreen(0.15, 1.9, -3.45, 0, { range: 12 });
      r.telescreen(-0.35, 1.9, 3.45, PI, { range: 12 });
      r.light(-1, 3, -1, { intensity: 20 }); r.light(2.5, 3, 0.5, { intensity: 12, shadow: false });
      pt(r, 'corner', -3.92, -2.75);
      r.spawns.corner = { x: r.ox - 3.92, z: -2.75, yaw: -H };
    },
  });

  // ---- the Ministry of Love: the white cell, the interrogation room, Room 101
  make({
    id: 'cell', w: 6, d: 6, h: 4.5, wallMat: M.tile, wallTile: 1.0, floorMat: M.tile, ceilMat: M.tile, fog: 0xd8dcd8, fogDensity: 0.01,
    exposure: 0.95, flicker: 0,
    doors: [{ side: 's', at: 3, to: null, label: '' }],
    furnish(r) {
      r.prop('cell_bench', 0, -2.75, 0); r.prop('cell_bench', -2.75, 0, H); r.prop('cell_bench', 2.75, 0, -H);
      for (const [x, z, rot] of [[0, -2.98, 0], [-2.98, 0, H], [2.98, 0, -H], [0, 2.98, PI]]) r.telescreen(x, 3.2, z, rot, { range: 8 });
      r.light(0, 4.5, 0, { intensity: 140, color: 0xf4f6ff, shadow: false });
      pt(r, 'bench', 0, -2.4);
      r.spawns.bench = { x: r.ox, z: -2.3, yaw: PI };
    },
  });
  make({
    id: 'interrogation', w: 6, d: 7, h: 3.5, wallMat: M.concrete, floorMat: M.concrete, fog: 0x101010, flicker: 0,
    furnish(r) {
      r.prop('rack', 0, 0, 0);
      r.light(0, 3.5, 0, { intensity: 90, color: 0xf8f8ff });
      pt(r, 'rack', 0, 0); pt(r, 'obrien', 1.2, 1.4);
      r.spawns.rack = { x: r.ox, z: 0.2, yaw: PI };
    },
  });
  make({
    id: 'room101', w: 5, d: 5, h: 3.2, wallMat: M.concrete, floorMat: M.concrete, fog: 0x0a0a0a, flicker: 0,
    furnish(r) {
      r.prop('table', 0, -1.2, 0);
      // the cage's tray stands on the table top (its base sits 1 cm below the model's origin)
      r.prop('cage', 0, -1.2, 0, { y: 0.77, collide: false });
      r.prop('chair', 0, 0.2, PI);
      r.light(0, 3.2, -0.5, { intensity: 50 });
      pt(r, 'chair', 0, 0.2); pt(r, 'cage', 0, -1.2, 0.9);
      r.spawns.chair = { x: r.ox, z: 0.3, yaw: 0 };
    },
  });

  // the picture falls face up on the floor in front of the wall, uncovering
  // the telescreen behind it
  G.interiors.setEngravingFallen = (on) => {
    const r = G.interiors.rooms.room;
    if (!r || !r.engraving) return;
    const e = r.engraving;
    if (!r.engravingHome) r.engravingHome = e.position.clone();
    if (on) { e.rotation.set(-H, 0, 0); e.position.set(r.engravingHome.x, 0.0005, r.engravingHome.z + 0.4); e.userData.mounted = false; }
    else { e.rotation.set(0, 0, 0); e.position.copy(r.engravingHome); e.userData.mounted = true; }
    if (r.hidden) r.hidden.visible = on;
    if (on && !r.hiddenScreen && G.surv && G.surv.addTelescreen) {
      r.hiddenScreen = { location: 'room', pos: r.w(r.hidden.position.x, r.hidden.position.z + 0.1, 1.55), dir: new THREE.Vector3(0, 0, 1), fov: 160, range: 8 };
      G.surv.addTelescreen(r.hiddenScreen);
    }
  };
  return G.interiors;
}
