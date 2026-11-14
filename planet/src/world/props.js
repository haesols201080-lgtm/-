// Streams everything that sits on the terrain, per 512 m cell, from the
// generation workers: rocks, trees, crystals, ore pickups, resource deposits,
// crater ice sheets and points of interest. Instances are split into a near
// set (shadows + colliders) and a far set, rebuilt when cells load or the
// player moves.
import * as THREE from 'three';
import { mergeVertices, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { Simplex, mulberry32 } from '../core/noise.js';
import { PROP_CELL } from './chunkgen.js';
import { makeRockMaterial, makeCrystalMaterial } from './materials.js';
import { makeFloraMaterial } from './flora.js';
import { treeModels, leafAtlas, TREE_FORMS } from './trees.js';
import { treeThreshold } from './treespecies.js';
import { U } from '../core/shared.js';

export const ORE_TYPES = {
  iron: { name: '철', tint: [0.5, 0.33, 0.27], glow: false },
  silicon: { name: '규소', tint: [0.52, 0.6, 0.7], glow: false },
  titanium: { name: '티타늄', tint: [0.78, 0.8, 0.84], glow: false },
  aluminium: { name: '알루미늄', tint: [0.86, 0.84, 0.78], glow: false },
  cobalt: { name: '코발트', tint: [0.12, 0.3, 1.0], glow: true },
  ice: { name: '얼음', tint: [0.55, 0.85, 1.0], glow: true },
  uranium: { name: '우라늄', tint: [0.3, 1.0, 0.35], glow: true },
  copper: { name: '구리', tint: [0.6, 0.32, 0.18], glow: false },
  nickel: { name: '니켈', tint: [0.6, 0.6, 0.54], glow: false },
  sulfur: { name: '황', tint: [0.92, 0.78, 0.16], glow: false },
  phosphate: { name: '인회석', tint: [0.34, 0.62, 0.56], glow: false },
  magnesium: { name: '마그네슘', tint: [0.88, 0.89, 0.9], glow: false },
};

export function rockGeometry(seed, detail, { sx = 1, sy = 0.8, sz = 1, cuts = 7, rough = 0.3 } = {}) {
  let g = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g);
  const S = new Simplex(seed);
  const rnd = mulberry32(seed * 7 + 1);
  const planes = [];
  // fracture planes: rock breaks along joints, so most of its shape is flat
  // faces meeting at edges, with rough weathered surface between
  const nc = cuts + 4;
  for (let i = 0; i < nc; i++) planes.push({ n: new THREE.Vector3(rnd() * 2 - 1, rnd() * 1.6 - 0.4, rnd() * 2 - 1).normalize(), d: 0.42 + rnd() * 0.38 });
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    v.multiplyScalar(1 + rough * 0.6 * S.fbm3(v.x * 1.3, v.y * 1.3, v.z * 1.3, 3) + 0.06 * S.noise3(v.x * 4, v.y * 4, v.z * 4));
    for (const pl of planes) { const d = v.dot(pl.n); if (d > pl.d) v.addScaledVector(pl.n, -(d - pl.d) * 0.96); }
    // pitted, granular faces (small amplitude, so the joints stay crisp)
    v.multiplyScalar(1 + 0.025 * S.noise3(v.x * 9, v.y * 9, v.z * 9) + 0.012 * S.noise3(v.x * 23, v.y * 23, v.z * 23));
    if (v.y < -0.35) v.y = -0.35 + (v.y + 0.35) * 0.3;
    p.setXYZ(i, v.x * sx, v.y * sy, v.z * sz);
  }
  // sharp where faces meet at an angle, smooth across a weathered face
  g = toCreasedNormals(g, 0.55);
  g.computeBoundingSphere();
  return g;
}

// Crystal cluster: hexagonal prisms with pyramidal terminations growing
// from a shared matrix, tilted outward like a real druse; flat facets.
export function crystalGeometry(seed, count = 6, spread = 0.6, { sides = 6, tip: tipKind = 'point', rMul = 1, hMul = 1, tiltMul = 1 } = {}) {
  const rnd = mulberry32(seed);
  const pos = [];
  for (let i = 0; i < count; i++) {
    const big = i === 0 ? 1.3 : 0.55 + rnd() * 0.7;
    const r = (0.07 + rnd() * 0.08) * big * rMul, h = (0.45 + rnd() * 0.9) * big * hMul;
    const prism = new THREE.CylinderGeometry(r, r, h, sides, 1, tipKind === 'flat'); prism.translate(0, h / 2, 0);
    const tip = tipKind === 'flat' ? new THREE.CylinderGeometry(r, r, 0.001, sides) : new THREE.ConeGeometry(r, r * 1.7, sides);
    tip.translate(0, tipKind === 'flat' ? h : h + r * 0.85, 0);
    const parts = [prism, tip];
    if (tipKind === 'bi') { const t2 = new THREE.ConeGeometry(r, r * 1.7, sides); t2.rotateX(Math.PI); t2.translate(0, -r * 0.85, 0); parts.push(t2); }
    const a = rnd() * Math.PI * 2, off = rnd() * spread * 0.45;
    const tilt = (i === 0 ? rnd() * 0.15 : 0.2 + rnd() * 0.55) * tiltMul;
    const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(Math.cos(a) * tilt, rnd() * Math.PI, -Math.sin(a) * tilt));
    m.setPosition(Math.sin(a) * off, -0.18, Math.cos(a) * off);
    for (const g of parts) { const ng = g.toNonIndexed(); ng.applyMatrix4(m); pos.push(...ng.attributes.position.array); }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.computeVertexNormals();
  return out;
}

// Metal ore: faceted nodules and a vein band bulging out of the host rock
export function noduleGeometry(seed, count = 9) {
  const rnd = mulberry32(seed);
  const S = new Simplex(seed);
  const pos = [];
  for (let i = 0; i < count; i++) {
    let g = new THREE.IcosahedronGeometry(1, 0);
    const p = g.attributes.position, v = new THREE.Vector3();
    for (let k = 0; k < p.count; k++) { v.fromBufferAttribute(p, k); v.multiplyScalar(1 + 0.35 * S.noise3(v.x * 2 + i, v.y * 2, v.z * 2)); p.setXYZ(k, v.x, v.y, v.z); }
    const s = 0.07 + rnd() * 0.12, a = rnd() * Math.PI * 2, d = 0.1 + rnd() * 0.45;
    if (g.index) g = g.toNonIndexed();
    g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(Math.sin(a) * d, 0.12 + rnd() * 0.16 - d * 0.18, Math.cos(a) * d * 0.8), new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd() * 3, rnd() * 3, rnd() * 3)), new THREE.Vector3(s * (1 + rnd()), s * 0.7, s)));
    pos.push(...g.attributes.position.array);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.computeVertexNormals();
  return out;
}

// One instanced layer with a near (shadow-casting) and a far mesh.
class Layer {
  constructor(scene, geo, mat, { cap = 20000, attrs = {}, range = 1400, nearR = 220, shadow = true, visible = () => true, farGeo = null }) {
    this.range = range; this.nearR = nearR; this.visibleFn = visible;
    this.meshes = [true, false].map((near) => {
      const g = (!near && farGeo ? farGeo : geo).clone();
      const capN = near ? Math.min(cap, 4000) : cap;
      const extra = {};
      for (const [name, size] of Object.entries(attrs)) {
        const a = new THREE.InstancedBufferAttribute(new Float32Array(capN * size), size);
        a.setUsage(THREE.DynamicDrawUsage);
        g.setAttribute(name, a); extra[name] = a;
      }
      const m = new THREE.InstancedMesh(g, mat, capN);
      m.count = 0; m.frustumCulled = false;
      m.castShadow = near && shadow; m.receiveShadow = true;
      if (mat.depthMat) m.customDepthMaterial = mat.depthMat;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.extra = extra; m.cap = capN;
      scene.add(m);
      return m;
    });
  }

  fill(items, cam) {
    const [near, far] = this.meshes;
    let nn = 0, nf = 0;
    const show = this.visibleFn();
    near.visible = far.visible = show;
    if (!show) { near.count = far.count = 0; return; }
    const r2 = this.range * this.range, n2 = this.nearR * this.nearR;
    for (const it of items) {
      if (it.dead) continue;
      const dx = it.x - cam.x, dz = it.z - cam.z, d2 = dx * dx + dz * dz;
      if (d2 > r2) continue;
      const isNear = d2 < n2;
      const m = isNear ? near : far;
      const i = isNear ? nn : nf;
      if (i >= m.cap) continue;
      m.instanceMatrix.array.set(it.m, i * 16);
      for (const name in m.extra) {
        const a = m.extra[name];
        const v = it[name];
        if (a.itemSize === 1) a.array[i] = v; else a.array.set(v, i * a.itemSize);
      }
      if (isNear) nn++; else nf++;
    }
    near.count = nn; far.count = nf;
    for (const m of this.meshes) {
      m.instanceMatrix.needsUpdate = true;
      for (const a of Object.values(m.extra)) a.needsUpdate = true;
    }
  }
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
function mat(x, y, z, rx, ry, rz, sx, sy, sz) {
  _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
  return Float32Array.from(_m.elements);
}

export class Props {
  constructor(game) {
    this.game = game;
    const scene = game.engine.scene;
    this.scene = scene;
    this.cells = new Map();
    this.collected = new Set();     // ore ids picked up
    this.searched = new Set();      // POI ids searched
    this.rockMat = makeRockMaterial();
    this.crystalMat = makeCrystalMaterial();
    this.treeMat = makeFloraMaterial({ side: THREE.DoubleSide, translucent: 0.35, map: leafAtlas(), alphaTest: 0.45 });
    this.oreMetalMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.75 });
    this.oreMetalMat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 iTint; varying vec3 vTint;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\nvTint = iTint;\n#else\nvTint = vec3(1.0);\n#endif');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vTint;').replace('#include <map_fragment>', 'diffuseColor.rgb = pow(vTint, vec3(2.2));');
    };
    this.oreMetalMat.customProgramCacheKey = () => 'oremetal';

    const protos = [
      rockGeometry(11, 2, { sx: 1.0, sy: 0.75, sz: 0.9, cuts: 7 }),
      rockGeometry(23, 2, { sx: 1.3, sy: 0.42, sz: 1.0, cuts: 6 }),
      rockGeometry(37, 3, { sx: 0.55, sy: 2.4, sz: 0.6, cuts: 9, rough: 0.22 }),
      rockGeometry(41, 3, { sx: 1.0, sy: 0.9, sz: 1.1, cuts: 11, rough: 0.35 }),
      rockGeometry(57, 3, { sx: 1.7, sy: 1.35, sz: 0.5, cuts: 12, rough: 0.16 }),   // fin / slab
      rockGeometry(63, 3, { sx: 1.1, sy: 0.85, sz: 0.95, cuts: 14, rough: 0.12 }),  // angular block
      rockGeometry(67, 3, { sx: 1.0, sy: 0.82, sz: 0.95, cuts: 2, rough: 0.07 }),    // rounded erratic boulder
      rockGeometry(71, 2, { sx: 0.6, sy: 1.9, sz: 0.6, cuts: 6, rough: 0.05 }),      // basalt column
      rockGeometry(73, 3, { sx: 1.4, sy: 1.0, sz: 0.8, cuts: 16, rough: 0.2 }),      // split wedge
      rockGeometry(79, 3, { sx: 1.3, sy: 0.6, sz: 1.2, cuts: 10, rough: 0.1 }),      // flat-topped block
      rockGeometry(83, 3, { sx: 1.0, sy: 0.9, sz: 1.0, cuts: 8, rough: 0.45 }),      // pitted volcanic
      rockGeometry(89, 2, { sx: 0.45, sy: 1.6, sz: 1.25, cuts: 9, rough: 0.14 }),    // leaning slab
    ];
    this.smallRock = rockGeometry(51, 1, { sx: 1, sy: 0.6, sz: 0.85, cuts: 5 });
    this.slateRock = rockGeometry(53, 2, { sx: 1.4, sy: 0.22, sz: 1.0, cuts: 8, rough: 0.12 });
    this.pebbleRock = rockGeometry(59, 2, { sx: 0.9, sy: 0.7, sz: 0.8, cuts: 1, rough: 0.12 });
    this.rockLayers = protos.map((g, i) => new Layer(scene, g, this.rockMat, { cap: 9000, attrs: { iTint: 3 }, range: 1500, nearR: 200 }));
    // crystal outcrops in three habits: a broad druse, a tall spire cluster, a low scatter
    // ten crystal habits
    const sc = (g, x, y, z) => { g.scale(x, y, z); return g; };
    const habits = [
      crystalGeometry(77, 7, 0.9),                                                   // druse
      sc(crystalGeometry(79, 4, 0.4), 0.8, 1.7, 0.8),                                 // tall spires
      sc(crystalGeometry(83, 12, 1.6), 1.1, 0.55, 1.1),                               // low bed
      sc(crystalGeometry(85, 1, 0), 1.6, 2.3, 1.6),                                   // single giant point
      crystalGeometry(87, 9, 0.3, { tiltMul: 1.8 }),                                  // fan
      crystalGeometry(89, 6, 0.8, { sides: 4, tip: 'flat', rMul: 2.2, hMul: 0.45 }),  // cubic
      crystalGeometry(91, 3, 0.7, { tip: 'bi', tiltMul: 2.4 }),                       // double-terminated
      crystalGeometry(93, 26, 0.9, { rMul: 0.35, hMul: 0.8 }),                        // needles
      crystalGeometry(95, 6, 0.8, { sides: 3 }),                                      // trigonal
      crystalGeometry(97, 5, 0.7, { rMul: 1.8, hMul: 0.5 }),                          // stubby
    ];
    this.crystalLayers = habits.map((g) => new Layer(scene, g, this.crystalMat, { cap: 700, attrs: { iTint: 3 }, range: 1600, nearR: 200 }));
    const trees = treeModels();
    this.treeLayers = trees.map((m) => new Layer(scene, m.near, this.treeMat, { farGeo: m.far, cap: 12000, attrs: { iGrow: 2, iTint: 3 }, range: 2200, nearR: 150, visible: () => U.uGrowth.value.w > 0.001 }));
    this.treeKinds = trees.length;
    // ore outcrops: an angular, half-buried host rock with either a small
    // crystal druse (glowing ores) or metallic nodules (metal ores)
    const oreBase = rockGeometry(91, 2, { sx: 0.7, sy: 0.4, sz: 0.62, cuts: 9, rough: 0.22 });
    oreBase.translate(0, -0.06, 0);
    const oreCry = crystalGeometry(81, 9, 0.5); oreCry.scale(0.42, 0.42, 0.42); oreCry.translate(0, 0.14, 0);
    const oreNod = noduleGeometry(83, 10);
    this.oreLayers = {};
    for (const k in ORE_TYPES) {
      this.oreLayers[k] = {
        base: new Layer(scene, oreBase, this.rockMat, { cap: 600, attrs: { iTint: 3 }, range: 450, nearR: 120 }),
        cry: new Layer(scene, ORE_TYPES[k].glow ? oreCry : oreNod, ORE_TYPES[k].glow ? this.crystalMat : this.oreMetalMat, { cap: 600, attrs: { iTint: 3 }, range: 450, nearR: 120 }),
      };
    }
    this.depositLayer = new Layer(scene, crystalGeometry(78, 7, 0.9), this.crystalMat, { cap: 3000, attrs: { iTint: 3 }, range: 1800, nearR: 200 });
    this.iceMat = new THREE.MeshStandardMaterial({ color: 0xd6e6f0, roughness: 0.16, metalness: 0.0, transparent: true, opacity: 1 });
    this.melt = 0;
    this.lastFill = new THREE.Vector3(1e9, 0, 0);
    this.dirty = true;
    this.cols = [];
  }

  cellKey(ci, cj) { return ci + ':' + cj; }

  update(cam) {
    const T = this.game.terrain;
    const R = 2300;
    const c0 = Math.floor((cam.x - R) / PROP_CELL), c1 = Math.floor((cam.x + R) / PROP_CELL);
    const r0 = Math.floor((cam.z - R) / PROP_CELL), r1 = Math.floor((cam.z + R) / PROP_CELL);
    const want = new Set();
    for (let cj = r0; cj <= r1; cj++) for (let ci = c0; ci <= c1; ci++) {
      const cx = (ci + 0.5) * PROP_CELL, cz = (cj + 0.5) * PROP_CELL;
      const d = Math.hypot(cx - cam.x, cz - cam.z);
      if (d > R + PROP_CELL * 0.7) continue;
      if (!T.inWorld(cx, cz, -PROP_CELL)) continue;
      const k = this.cellKey(ci, cj);
      want.add(k);
      if (!this.cells.has(k)) {
        const cell = { ci, cj, ready: false };
        this.cells.set(k, cell);
        T.requestProps(ci, cj, (r) => this.onCell(cell, r), d * 2 + 50);
      }
    }
    for (const [k, c] of this.cells) {
      if (!want.has(k) && c.ready) {
        const d = Math.hypot((c.ci + 0.5) * PROP_CELL - cam.x, (c.cj + 0.5) * PROP_CELL - cam.z);
        if (d > R + PROP_CELL * 2) { this.unloadCell(c); this.cells.delete(k); this.dirty = true; }
      }
    }
    const moved = Math.hypot(cam.x - this.lastFill.x, cam.z - this.lastFill.z);
    if (this.dirty || moved > 40) this.refill(cam);
    this.updateColliders(cam);
  }

  onCell(cell, r) {
    if (!this.cells.has(this.cellKey(cell.ci, cell.cj))) return;
    const blocked = this.game.isBlocked ? this.game.isBlocked : () => false;
    cell.rocks = [];
    const R = r.rocks;
    for (let i = 0; i < R.length; i += 13) {
      const x = R[i], y = R[i + 1], z = R[i + 2];
      if (blocked(x, z, R[i + 3])) continue;
      cell.rocks.push({ x, y, z, proto: R[i + 9], sx: R[i + 3], sy: R[i + 4], sz: R[i + 5], m: mat(x, y, z, R[i + 7], R[i + 6], R[i + 8], R[i + 3], R[i + 4], R[i + 5]), iTint: [R[i + 10], R[i + 11], R[i + 12]] });
    }
    cell.trees = [];
    const Tr = r.trees;
    for (let i = 0; i < Tr.length; i += 8) {
      const x = Tr[i], y = Tr[i + 1], z = Tr[i + 2], s = Tr[i + 3];
      if (blocked(x, z, 2)) continue;
      const kind = Tr[i + 6];
      // form (young / mature / old) and per-tree proportions and lean
      const v = Tr[i + 7], h1 = ((x * 12.9898 + z * 78.233) % 1 + 1) % 1, h2 = ((x * 39.346 + z * 11.135) % 1 + 1) % 1;
      const form = Math.min(TREE_FORMS - 1, Math.floor(((v * 3.7) % 1) * TREE_FORMS));
      const layer = kind * TREE_FORMS + form;
      const sx = s * (0.86 + h1 * 0.28), sy = s * (0.84 + h2 * 0.34), sz = s * (0.86 + ((h1 + h2) % 1) * 0.28);
      const lx = (h2 - 0.5) * 0.12, lz = (h1 - 0.5) * 0.12;
      // seed plants in order: conifers first, broadleaf one stage later,
      // the alien bloom tree last
      const thr = treeThreshold(kind, Tr[i + 5]);
      // per-tree leaf colour variation; some maples and birches turn autumnal
      const tv = 0.88 + h1 * 0.24;
      const autumn = (kind === 5 && v > 0.62) ? [1.55, 0.72, 0.42] : (kind === 4 && v > 0.8) ? [1.35, 1.1, 0.5] : [tv, tv * (0.97 + v * 0.06), tv];
      cell.trees.push({ x, y, z, s, kind, layer, thr, m: mat(x, y, z, lx, Tr[i + 4], lz, sx, sy, sz), iGrow: [thr, 3], iTint: autumn });
    }
    cell.crystals = [];
    const Cr = r.crystals;
    for (let i = 0; i < Cr.length; i += 8) {
      const x = Cr[i], y = Cr[i + 1], z = Cr[i + 2], s = Cr[i + 3];
      if (blocked(x, z, s)) continue;
      cell.crystals.push({ x, y, z, s, m: mat(x, y, z, 0, Cr[i + 4], 0, s, s, s), iTint: [Cr[i + 5], Cr[i + 6], Cr[i + 7]] });
    }
    cell.ores = r.ores.filter((o) => !this.collected.has(o.id));
    for (const o of cell.ores) { o.m = mat(o.x, o.y, o.z, 0, o.rot, 0, o.s, o.s, o.s); o.iTint = ORE_TYPES[o.type].tint; o.baseTint = [0.54, 0.47, 0.41]; }
    cell.deposits = r.deposits;
    cell.depCrystals = [];
    const rnd = mulberry32((cell.ci * 7919 + cell.cj * 104729) >>> 0);
    for (const d of r.deposits) {
      for (let k = 0; k < 7; k++) {
        const a = k / 7 * Math.PI * 2 + rnd() * 0.5, rr = 3.8 + rnd() * 1.4;
        const x = d.x + Math.cos(a) * rr, z = d.z + Math.sin(a) * rr;
        const y = this.game.terrain.gen.sample(x, z) - 0.2;
        const s = 0.9 + rnd() * 0.9;
        cell.depCrystals.push({ x, y, z, s, m: mat(x, y, z, 0.15, rnd() * 6.28, 0, s, s * 1.2, s), iTint: ORE_TYPES[d.type].tint.map((v) => v * 0.9) });
      }
    }
    cell.ice = r.ice.map((ic) => {
      const geo = new THREE.CircleGeometry(ic.r, 48); geo.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(geo, this.iceMat);
      m.position.set(ic.x, ic.level, ic.z);
      m.receiveShadow = true;
      m.renderOrder = 2;
      this.scene.add(m);
      return { ...ic, mesh: m };
    });
    cell.pois = r.pois;
    if (this.game.pois) for (const p of cell.pois) this.game.pois.spawn(p);
    cell.ready = true;
    this.dirty = true;
  }

  unloadCell(c) {
    if (c.ice) for (const ic of c.ice) { this.scene.remove(ic.mesh); ic.mesh.geometry.dispose(); }
    if (c.pois && this.game.pois) for (const p of c.pois) this.game.pois.despawn(p);
  }

  refill(cam) {
    this.dirty = false;
    this.lastFill.copy(cam);
    const all = (key) => { const out = []; for (const c of this.cells.values()) if (c.ready && c[key]) for (const it of c[key]) out.push(it); return out; };
    const rocks = all('rocks');
    this.rockLayers.forEach((L, i) => L.fill(rocks.filter((r) => r.proto === i), cam));
    const cr = all('crystals');
    const NH = this.crystalLayers.length;
    this.crystalLayers.forEach((L, i) => L.fill(cr.filter((c) => ((Math.floor(c.x * 3.1 + c.z * 7.7) % NH) + NH) % NH === i), cam));
    const trees = all('trees');
    this.treeLayers.forEach((L, i) => L.fill(trees.filter((t) => t.layer === i), cam));
    const ores = all('ores').filter((o) => !o.dead);
    for (const k in this.oreLayers) {
      const list = ores.filter((o) => o.type === k);
      this.oreLayers[k].cry.fill(list, cam);
      this.oreLayers[k].base.fill(list.map((o) => ({ x: o.x, z: o.z, m: o.m, iTint: o.baseTint })), cam);
    }
    this.depositLayer.fill(all('depCrystals'), cam);
  }

  // colliders for big rocks / crystals / grown trees near the player
  updateColliders(cam) {
    if (this._colPos && Math.hypot(cam.x - this._colPos.x, cam.z - this._colPos.z) < 25 && !this.dirtyCols) return;
    this._colPos = cam.clone();
    this.dirtyCols = false;
    const C = this.game.colliders;
    for (const c of this.cols) C.remove(c);
    this.cols.length = 0;
    const R2 = 160 * 160;
    const g = U.uGrowth.value.w;
    for (const cell of this.cells.values()) {
      if (!cell.ready) continue;
      for (const r of cell.rocks) {
        if (r.dead) continue;
        const s = Math.max(r.sx, r.sz);
        if (s < 1.1 || (r.x - cam.x) ** 2 + (r.z - cam.z) ** 2 > R2) continue;
        const rr = s * (r.proto === 2 ? 0.45 : r.proto === 4 ? 0.55 : 0.7);
        const top = r.y + r.sy * (r.proto === 2 ? 2.2 : r.proto === 1 ? 0.35 : r.proto === 4 ? 1.2 : 0.68);
        this.cols.push(C.addCyl(r.x, r.z, rr, r.y - 2, top, null, { rock: true }));
      }
      for (const c of cell.crystals) {
        if (c.s < 1.4 || (c.x - cam.x) ** 2 + (c.z - cam.z) ** 2 > R2) continue;
        this.cols.push(C.addCyl(c.x, c.z, c.s * 0.45, c.y, c.y + c.s * 1.6, null, { rock: true }));
      }
      if (g > 0.01) for (const t of cell.trees) {
        if (t.dead || g < t.thr + 0.08 || (t.x - cam.x) ** 2 + (t.z - cam.z) ** 2 > R2) continue;
        this.cols.push(C.addCyl(t.x, t.z, 0.42 * t.s, t.y, t.y + 6 * t.s, null, { noStand: true }));
      }
    }
  }

  setMelt(m) {
    this.melt = m;
    this.iceMat.opacity = 1 - m;
    this.iceMat.visible = m < 0.999;
    for (const c of this.cells.values()) if (c.ice) for (const ic of c.ice) ic.mesh.position.y = ic.level - m * 1.5;
  }

  iceHeightAt(x, z) {
    if (!this.iceMat.visible) return -Infinity;
    for (const c of this.cells.values()) if (c.ice) for (const ic of c.ice) {
      const dx = x - ic.x, dz = z - ic.z;
      if (dx * dx + dz * dz < (ic.r - 1) * (ic.r - 1)) return ic.mesh.position.y;
    }
    return -Infinity;
  }

  // ---- ores
  nearestOre(type, pos, maxR = 200) {
    let best = null, bd = maxR * maxR;
    for (const c of this.cells.values()) {
      if (!c.ready) continue;
      for (const o of c.ores) {
        if (o.dead || o.type !== type) continue;
        const d = (o.x - pos.x) ** 2 + (o.z - pos.z) ** 2;
        if (d < bd) { bd = d; best = o; }
      }
    }
    return best;
  }

  pickOre(origin, dir, maxT = 6) {
    let best = null, bt = maxT;
    for (const c of this.cells.values()) {
      if (!c.ready) continue;
      for (const o of c.ores) {
        if (o.dead) continue;
        const cy = o.y + 0.25 * o.s;
        const ox = o.x - origin.x, oy = cy - origin.y, oz = o.z - origin.z;
        if (ox * ox + oz * oz > 100) continue;
        const tc = ox * dir.x + oy * dir.y + oz * dir.z;
        if (tc < 0 || tc > bt) continue;
        const d2 = ox * ox + oy * oy + oz * oz - tc * tc;
        const rr = 0.6 * o.s;
        if (d2 < rr * rr) { bt = tc; best = o; }
      }
    }
    return best;
  }

  removeOre(o) {
    o.dead = true;
    this.collected.add(o.id);
    this.dirty = true;
  }

  // ---- deposits
  nearestDeposit(x, z, r = 6) {
    let best = null, bd = r * r;
    for (const c of this.cells.values()) {
      if (!c.ready) continue;
      for (const d of c.deposits) {
        const dd = (d.x - x) ** 2 + (d.z - z) ** 2;
        if (dd < bd) { bd = dd; best = d; }
      }
    }
    return best;
  }

  allDeposits() {
    const out = [];
    for (const c of this.cells.values()) if (c.ready) out.push(...c.deposits);
    return out;
  }

  // remove rocks/trees/crystals/ores inside a building footprint
  clearArea(x, z, r) {
    for (const c of this.cells.values()) {
      if (!c.ready) continue;
      for (const key of ['rocks', 'trees', 'crystals']) for (const it of c[key]) {
        const rr = r + (it.sx || it.s || 1) * 0.6;
        if ((it.x - x) ** 2 + (it.z - z) ** 2 < rr * rr) it.dead = true;
      }
      for (const o of c.ores) if ((o.x - x) ** 2 + (o.z - z) ** 2 < r * r) o.dead = true;
    }
    this.dirty = true;
    this.dirtyCols = true;
  }

  allPOIs() {
    const out = [];
    for (const c of this.cells.values()) if (c.ready) out.push(...c.pois);
    return out;
  }
}
