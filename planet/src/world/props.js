// Streams everything that sits on the terrain, per 512 m cell, from the
// generation workers: rocks, trees, crystals, ore pickups, resource deposits,
// crater ice sheets and points of interest. Instances are split into a near
// set (shadows + colliders) and a far set, rebuilt when cells load or the
// player moves.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { Simplex, mulberry32 } from '../core/noise.js';
import { PROP_CELL } from './chunkgen.js';
import { makeRockMaterial, makeCrystalMaterial } from './materials.js';
import { makeFloraMaterial, treeGeometries } from './flora.js';
import { U } from '../core/shared.js';

export const ORE_TYPES = {
  iron: { name: '철', tint: [0.42, 0.2, 0.12], glow: false },
  silicon: { name: '규소', tint: [0.52, 0.6, 0.7], glow: false },
  titanium: { name: '티타늄', tint: [0.78, 0.8, 0.84], glow: false },
  aluminium: { name: '알루미늄', tint: [0.86, 0.84, 0.78], glow: false },
  cobalt: { name: '코발트', tint: [0.12, 0.3, 1.0], glow: true },
  ice: { name: '얼음', tint: [0.55, 0.85, 1.0], glow: true },
  uranium: { name: '우라늄', tint: [0.3, 1.0, 0.35], glow: true },
};

export function rockGeometry(seed, detail, { sx = 1, sy = 0.8, sz = 1, cuts = 7, rough = 0.3 } = {}) {
  let g = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g);
  const S = new Simplex(seed);
  const rnd = mulberry32(seed * 7 + 1);
  const planes = [];
  for (let i = 0; i < cuts; i++) planes.push({ n: new THREE.Vector3(rnd() * 2 - 1, rnd() * 1.6 - 0.4, rnd() * 2 - 1).normalize(), d: 0.55 + rnd() * 0.3 });
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    v.multiplyScalar(1 + rough * S.fbm3(v.x * 1.3, v.y * 1.3, v.z * 1.3, 3) + 0.08 * S.noise3(v.x * 5, v.y * 5, v.z * 5));
    for (const pl of planes) { const d = v.dot(pl.n); if (d > pl.d) v.addScaledVector(pl.n, -(d - pl.d) * 0.92); }
    if (v.y < -0.35) v.y = -0.35 + (v.y + 0.35) * 0.3;
    p.setXYZ(i, v.x * sx, v.y * sy, v.z * sz);
  }
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

export function crystalGeometry(seed, count = 6, spread = 0.6) {
  const rnd = mulberry32(seed);
  const pos = [];
  for (let i = 0; i < count; i++) {
    const h = 0.6 + rnd() * 1.4, r = 0.08 + rnd() * 0.12;
    const c = new THREE.CylinderGeometry(r * 0.6, r, h, 6, 1); c.translate(0, h / 2, 0);
    const tip = new THREE.ConeGeometry(r * 0.6, r * 2.2, 6); tip.translate(0, h + r * 1.1, 0);
    const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler((rnd() - 0.5) * 1.1, rnd() * 6.28, (rnd() - 0.5) * 1.1));
    m.setPosition((rnd() - 0.5) * spread, -0.1, (rnd() - 0.5) * spread);
    for (const g of [c, tip]) { const ng = g.toNonIndexed(); ng.applyMatrix4(m); pos.push(...ng.attributes.position.array); }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.computeVertexNormals();
  return out;
}

// One instanced layer with a near (shadow-casting) and a far mesh.
class Layer {
  constructor(scene, geo, mat, { cap = 20000, attrs = {}, range = 1400, nearR = 220, shadow = true, visible = () => true }) {
    this.range = range; this.nearR = nearR; this.visibleFn = visible;
    this.meshes = [true, false].map((near) => {
      const g = geo.clone();
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
    this.treeMat = makeFloraMaterial({ side: THREE.FrontSide, translucent: 0.15 });
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
    ];
    this.smallRock = rockGeometry(51, 1, { sx: 1, sy: 0.6, sz: 0.85, cuts: 5 });
    this.rockLayers = protos.map((g, i) => new Layer(scene, g, this.rockMat, { cap: 9000, attrs: { iTint: 3 }, range: 1500, nearR: 200 }));
    this.crystalLayer = new Layer(scene, crystalGeometry(77, 7, 0.9), this.crystalMat, { cap: 3000, attrs: { iTint: 3 }, range: 1600, nearR: 200 });
    const trees = treeGeometries();
    this.treeLayers = trees.map((g) => new Layer(scene, g, this.treeMat, { cap: 12000, attrs: { iGrow: 2, iTint: 3 }, range: 2200, nearR: 160, visible: () => U.uGrowth.value.w > 0.001 }));
    this.treeKinds = trees.length;
    const oreBase = rockGeometry(91, 1, { sx: 0.55, sy: 0.32, sz: 0.5, cuts: 5 });
    const oreCry = crystalGeometry(81, 5, 0.35); oreCry.scale(0.45, 0.45, 0.45);
    this.oreLayers = {};
    for (const k in ORE_TYPES) {
      this.oreLayers[k] = {
        base: new Layer(scene, oreBase, this.rockMat, { cap: 600, attrs: { iTint: 3 }, range: 450, nearR: 120 }),
        cry: new Layer(scene, oreCry, ORE_TYPES[k].glow ? this.crystalMat : this.oreMetalMat, { cap: 600, attrs: { iTint: 3 }, range: 450, nearR: 120 }),
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
      const kind = Math.min(this.treeKinds - 1, Tr[i + 6] * 2 + Tr[i + 7]);
      cell.trees.push({ x, y, z, s, kind, thr: Tr[i + 5], m: mat(x, y, z, 0, Tr[i + 4], 0, s, s, s), iGrow: [Tr[i + 5], 3], iTint: Tr[i + 6] === 2 ? [0.4, 1.0, 0.85] : [1, 1, 1] });
    }
    cell.crystals = [];
    const Cr = r.crystals;
    for (let i = 0; i < Cr.length; i += 8) {
      const x = Cr[i], y = Cr[i + 1], z = Cr[i + 2], s = Cr[i + 3];
      if (blocked(x, z, s)) continue;
      cell.crystals.push({ x, y, z, s, m: mat(x, y, z, 0, Cr[i + 4], 0, s, s, s), iTint: [Cr[i + 5], Cr[i + 6], Cr[i + 7]] });
    }
    cell.ores = r.ores.filter((o) => !this.collected.has(o.id));
    for (const o of cell.ores) { o.m = mat(o.x, o.y, o.z, 0, o.rot, 0, o.s, o.s, o.s); o.iTint = ORE_TYPES[o.type].tint; o.baseTint = [0.3, 0.24, 0.2]; }
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
    this.crystalLayer.fill(all('crystals'), cam);
    const trees = all('trees');
    this.treeLayers.forEach((L, i) => L.fill(trees.filter((t) => t.kind === i), cam));
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
        const rr = s * (r.proto === 2 ? 0.45 : 0.7);
        const top = r.y + r.sy * (r.proto === 2 ? 2.2 : r.proto === 1 ? 0.35 : 0.68);
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
