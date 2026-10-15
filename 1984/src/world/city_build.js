// Places Blender models in the city. Models used more than once become one
// InstancedMesh per mesh part per map chunk (so frustum culling still works),
// single ones are plain clones. Every placement gets colliders from a footprint
// table (or the model bounds), and small props are hidden by distance.
import * as THREE from 'three';
import { tf } from './city_util.js';

// Local footprints [cx, cz, hx, hz, height?, blocksSight?] measured from the
// Blender scripts (front is +Z). Canopies and cornices are left out so the
// player can stand under them.
const LIONS = [0, 1, 2, 3].map((k) => {
  const a = k * Math.PI / 2 + Math.PI / 4;
  return { x: Math.cos(a) * 8.6, z: -Math.sin(a) * 8.6, rot: a + Math.PI / 2 };
});

export const FOOTPRINT = {
  victory_mansions: [[0, 0, 21.05, 7.05]],
  party_block_a: [[0, 0, 15.05, 6.05]],
  party_block_b: [[0, 0, 11.05, 7.05]],
  party_block_c: [[0, 0, 24.05, 7.05]],
  inner_block: [[0, 0, 12.05, 8.05]],
  community_centre: [[0, 0, 17.05, 9.05]],
  prole_terrace: [[0, 0, 10.45, 4.05]],
  prole_terrace_b: [[0, 0, 13.05, 4.05]],
  prole_ruin: [[-5.2, 0, 5.25, 4.05], [5.2, 3.85, 5.2, 0.22, 6.2], [5.2, -0.6, 3.0, 2.4, 1.6, false]],
  shop: [[0, 0, 5.25, 4.05]],
  pub: [[0, 0, 5.25, 4.05]],
  church: [[0, 0, 11.1, 20.1], [0, 24.05, 13.5, 4.05, 1.2, false]],
  station: [[0, 3, 15.2, 33.3]],
  cafe: [[0, 0, 6.05, 5.05]],
  minitrue: [[0, 0, 85, 85], [-8.5, 85.6, 0.9, 0.6], [8.5, 85.6, 0.9, 0.6]],
  pyramid_far: [[0, 0, 85, 85]],
  guard_tower: [[0, 0, 1.75, 1.75, 11.6, false]],
  mg_nest: [[0, 0, 2.1, 2.1, 0.98, false]],
  fence_wire: [[0, -0.2, 3.0, 0.14, 3.9, false]],
  lamp_post: [[0, 0, 0.16, 0.16, 5.3, false]],
  telescreen_pole: [[0, 0, 0.15, 0.15, 5.4, false]],
  bench: [[0, 0, 1.0, 0.26, 0.9, false]],
  bin: [[0, 0, 0.3, 0.3, 0.86, false]],
  sandbags: [[0.15, 0, 1.95, 0.22, 0.66, false]],
  rubble_pile: [[0.15, -0.3, 2.1, 1.7, 1.2, false]],
  truck: [[0, 0.37, 1.26, 3.88, 2.8]],
  van: [[0, 0, 1.09, 2.62, 2.3]],
  chestnut: [[0, 0, 0.45, 0.45, 12, false]],
  elm: [[0, 0, 0.55, 0.55, 18, false]],
  dead_tree: [[0, 0, 0.28, 0.28, 6, false]],
  hedge: [[0.8, 0, 5.2, 1.1, 3]],
  monument: [[0, 0, 5.4, 5.4, 57], ...LIONS.map((l) => [l.x, l.z, 1.4, 3.0, 2.6, false, l.rot])],
};

// Draw distance per model (metres); anything not listed is always drawn.
const MAX_DIST = {
  bench: 110, bin: 90, sandbags: 130, rubble_pile: 170, lamp_post: 260, telescreen_pole: 220, telescreen_wall: 140,
  mg_nest: 160, fence_wire: 320, guard_tower: 420, van: 200, truck: 220, dead_tree: 220, hedge: 220,
  chestnut: 380, elm: 420, prole_terrace: 520, prole_terrace_b: 520, prole_ruin: 520, shop: 520, pub: 520,
};

const CHUNK = 128;
const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpS = new THREE.Vector3();
const tmpP = new THREE.Vector3();
const Y = new THREE.Vector3(0, 1, 0);

export class Placer {
  constructor(G, root) {
    this.G = G;
    this.root = root;
    this.info = new Map();
    this.list = [];
    this.overrides = {};
    this.culled = [];            // { obj, x, z, r, max }
    this.footprints = [];        // [cx, cz, hx, hz, rot] of buildings, for the map
  }

  setOverride(model, map) { this.overrides[model] = { ...(this.overrides[model] || {}), ...map }; }

  // Mesh parts, named empties and bounds of a model, measured once.
  model(name) {
    if (this.info.has(name)) return this.info.get(name);
    const g = this.G.assets.gltf ? this.G.assets.gltf(name) : null;
    if (!g) { console.warn('[city] missing model', name); this.info.set(name, null); return null; }
    const scene = g.scene;
    scene.updateMatrixWorld(true);
    const parts = [], nodes = {};
    const box = new THREE.Box3();
    scene.traverse((o) => {
      if (o.isMesh) {
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        parts.push({ geometry: o.geometry, matName: (o.material.name || '').replace(/\.\d+$/, ''), material: o.material, matrix: o.matrixWorld.clone() });
        box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));
      } else if (o !== scene && o.name) {
        nodes[o.name] = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);
      }
    });
    const inf = { name, parts, nodes, box };
    // timber shoring at a terrace's ends: block the feet of the baulks
    if (/^prole|^shop$|^pub$/.test(name)) {
      const body = FOOTPRINT[name] ? FOOTPRINT[name][0][2] : 10;
      const ends = [];
      for (const p of parts) {
        if (p.matName !== 'wood') continue;
        const pos = p.geometry.attributes.position;
        for (const side of [-1, 1]) {
          let mn = Infinity, mx = -Infinity;
          for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i), y = pos.getY(i);
            if (y < 1.5 && x * side > body + 0.3) { mn = Math.min(mn, x); mx = Math.max(mx, x); }
          }
          if (mn < mx) ends.push([(mn + mx) / 2, 0, (mx - mn) / 2 + 0.2, 2.5, 3, false]);
        }
      }
      inf.shoring = ends;
    }
    this.info.set(name, inf);
    return inf;
  }

  // Resolve a Blender slot name to the library material (with overrides).
  material(model, part, extra) {
    const key = part.matName;
    const ov = { ...(this.overrides[model] || {}), ...(extra || {}) };
    if (ov[key]) return ov[key];
    return this.G.mats.get(key) || part.material;
  }

  node(model, nodeName, x, z, rot, scale = 1, y = 0) {
    const inf = this.model(model);
    if (!inf || !inf.nodes[nodeName]) return null;
    const n = inf.nodes[nodeName];
    const p = tf(x, z, rot, n.x * scale, n.z * scale);
    return new THREE.Vector3(p.x, y + n.y * scale, p.z);
  }

  // o: { scale, y, collide (false | spec[]), tag, unique, override, cast, receive, maxDist, sight }
  add(model, x, z, rot = 0, o = {}) {
    const inf = this.model(model);
    if (!inf) return null;
    const p = { model, x, z, rot, scale: o.scale ?? 1, y: o.y ?? 0, o };
    this.list.push(p);
    if (o.collide !== false) this.collide(model, x, z, rot, p.scale, o);
    return p;
  }

  collide(model, x, z, rot, scale, o = {}) {
    const inf = this.info.get(model);
    let spec = Array.isArray(o.collide) ? o.collide : FOOTPRINT[model];
    if (!spec && inf) {
      const b = inf.box;
      spec = [[(b.min.x + b.max.x) / 2, (b.min.z + b.max.z) / 2, (b.max.x - b.min.x) / 2, (b.max.z - b.min.z) / 2, b.max.y]];
    }
    if (inf && inf.shoring) spec = spec.concat(inf.shoring);
    const big = (FOOTPRINT[model] && FOOTPRINT[model][0][2] > 4) || o.building;
    for (const s of spec) {
      const [lx, lz, hx, hz, h, sight, lrot] = s;
      const w = tf(x, z, rot, lx * scale, lz * scale);
      this.G.col.add(w.x, w.z, hx * scale, hz * scale, rot + (lrot || 0), {
        y0: -1, y1: (h ?? (inf ? inf.box.max.y : 10)) * scale, tag: o.tag || model,
        sight: o.sight ?? (sight ?? true), solid: true,
      });
      if (big && s === spec[0]) this.footprints.push([w.x, w.z, hx * scale, hz * scale, rot]);
    }
  }

  build() {
    const byModel = new Map();
    for (const p of this.list) {
      if (!byModel.has(p.model)) byModel.set(p.model, []);
      byModel.get(p.model).push(p);
    }
    for (const [model, ps] of byModel) {
      const inst = ps.filter((p) => !p.o.unique && !p.o.override);
      const single = ps.filter((p) => p.o.unique || p.o.override);
      if (inst.length === 1) single.push(inst.pop());
      for (const p of single) this.clone(p);
      if (inst.length) this.instanced(model, inst);
    }
    this.list.length = 0;
  }

  clone(p) {
    const G = this.G;
    let obj;
    try { obj = G.assets.instance(p.model); } catch (e) { console.warn('[city]', e.message); return; }
    G.mats.apply(obj, { cast: p.o.cast ?? true, receive: p.o.receive ?? true, override: { ...(this.overrides[p.model] || {}), ...(p.o.override || {}) } });
    obj.position.set(p.x, p.y, p.z);
    obj.rotation.y = p.rot;
    obj.scale.setScalar(p.scale);
    obj.updateMatrixWorld(true);
    obj.traverse((o) => { o.matrixAutoUpdate = false; });
    this.root.add(obj);
    p.object = obj;
    const max = p.o.maxDist ?? MAX_DIST[p.model];
    if (max) this.culled.push({ obj, x: p.x, z: p.z, r: 10, max });
  }

  instanced(model, ps) {
    const inf = this.info.get(model);
    const chunks = new Map();
    for (const p of ps) {
      const k = Math.floor(p.x / CHUNK) + ',' + Math.floor(p.z / CHUNK);
      if (!chunks.has(k)) chunks.set(k, []);
      chunks.get(k).push(p);
    }
    const max = MAX_DIST[model];
    for (const list of chunks.values()) {
      let cx = 0, cz = 0;
      for (const p of list) { cx += p.x; cz += p.z; }
      cx /= list.length; cz /= list.length;
      let r = 0;
      for (const p of list) r = Math.max(r, Math.hypot(p.x - cx, p.z - cz));
      const meshes = [];
      for (const part of inf.parts) {
        const mat = this.material(model, part);
        const im = new THREE.InstancedMesh(part.geometry, mat, list.length);
        list.forEach((p, i) => {
          tmpQ.setFromAxisAngle(Y, p.rot);
          tmpS.setScalar(p.scale);
          tmpP.set(p.x, p.y, p.z);
          tmpM.compose(tmpP, tmpQ, tmpS).multiply(part.matrix);
          im.setMatrixAt(i, tmpM);
        });
        im.instanceMatrix.needsUpdate = true;
        im.computeBoundingSphere();
        im.castShadow = list[0].o.cast ?? true;
        im.receiveShadow = list[0].o.receive ?? true;
        im.matrixAutoUpdate = false;
        im.name = model;
        this.root.add(im);
        meshes.push(im);
      }
      if (max) for (const m of meshes) this.culled.push({ obj: m, x: cx, z: cz, r, max });
    }
  }

  // Hide distant small things. Cheap enough to run a few times a second.
  cull(cam) {
    for (const c of this.culled) {
      const d = Math.hypot(cam.x - c.x, cam.z - c.z) - c.r;
      c.obj.visible = d < c.max;
    }
  }
}
