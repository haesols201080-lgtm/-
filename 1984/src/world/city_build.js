// Places Blender models in the city. A model used more than once becomes one
// InstancedMesh per mesh part for the whole city (the models are light, so
// one draw call per part beats chunking), single ones are plain clones. Every
// placement gets colliders from a footprint table (or the model bounds).
// The timber shoring at the ends of the prole terraces is cut off the models
// and instanced separately, so it only props up walls whose neighbour is gone.
import * as THREE from 'three';
import { tf, splitGeometry } from './city_util.js';

const LIONS = [0, 1, 2, 3].map((k) => {
  const a = k * Math.PI / 2 + Math.PI / 4;
  return { x: Math.cos(a) * 8.6, z: -Math.sin(a) * 8.6, rot: a + Math.PI / 2 };
});

// Local footprints [cx, cz, hx, hz, height?, blocksSight?, rotY?] measured
// from the Blender scripts (front is +Z). Canopies and cornices are left out
// so the player can stand under them.
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
  fence_wire: [[0, 0, 3.0, 0.12, 3.9, false]],
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

// Entrance door of the blocks built by party_block() in blender/buildings.py:
// local x of the door column and the front face z.
export const ENTRANCE = {
  victory_mansions: [1.5, 7], party_block_a: [1.5, 6], party_block_b: [11 / 6, 7], party_block_c: [1.5, 7],
  inner_block: [2, 8], community_centre: [2.125, 9],
};

// Half width of the house fronts of the terraces (shoring lies beyond).
const TERRACE_HALF = { prole_terrace: 10.4, prole_terrace_b: 13, prole_ruin: 10.4, shop: 5.2, pub: 5.2 };

// Draw distance per model for single clones (metres).
const MAX_DIST = { bench: 110, bin: 90, sandbags: 130, van: 220, truck: 240, mg_nest: 200 };

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpS = new THREE.Vector3();
const tmpP = new THREE.Vector3();
const Y = new THREE.Vector3(0, 1, 0);
const ID = new THREE.Matrix4();

export class Placer {
  constructor(G, root) {
    this.G = G;
    this.root = root;
    this.info = new Map();
    this.list = [];
    this.overrides = {};
    this.culled = [];            // { obj, x, z, max }
    this.footprints = [];        // [cx, cz, hx, hz, rot, model] of buildings, for the map and the filler pass
    this.meshes = new Map();     // model -> InstancedMesh[] / Object3D[]
    this.onFootprint = null;
  }

  setOverride(model, map) { this.overrides[model] = { ...(this.overrides[model] || {}), ...map }; }

  // Mesh parts, named empties and bounds of a model, measured once.
  model(name) {
    if (this.info.has(name)) return this.info.get(name);
    const g = this.G.assets.gltf ? this.G.assets.gltf(name) : null;
    if (!g) { console.warn('[city] missing model', name); this.info.set(name, null); return null; }
    const scene = g.scene;
    scene.updateMatrixWorld(true);
    let parts = [];
    const nodes = {};
    const box = new THREE.Box3();
    scene.traverse((o) => {
      if (o.isMesh) {
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        parts.push({ geometry: o.geometry, matName: (o.material.name || '').replace(/\.\d+$/, ''), material: o.material, matrix: o.matrixWorld.clone() });
        box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));
      } else if (o !== scene && o.name && !o.children.some((c) => c.isMesh)) {
        nodes[o.name] = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);
      }
    });
    const inf = { name, parts, nodes, box, shore: null };
    const half = TERRACE_HALF[name];
    if (half) {
      // timber baulks at the gable ends: low wood triangles beyond the fronts
      const body = [], L = [], R = [];
      for (const p of parts) {
        if (p.matName !== 'wood') { body.push(p); continue; }
        const [keepL, cutL] = splitGeometry(p.geometry, p.matrix, (x, y) => y < 6 && x < -half - 0.15);
        if (cutL) L.push({ ...p, geometry: cutL, matrix: ID });
        if (!keepL) continue;
        const [keep, cutR] = splitGeometry(keepL, ID, (x, y) => y < 6 && x > half + 0.15);
        if (cutR) R.push({ ...p, geometry: cutR, matrix: ID });
        if (keep) body.push({ ...p, geometry: keep, matrix: ID });
      }
      parts = body;
      inf.parts = body;
      inf.shore = { L, R, half };
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

  // World position of a named empty of a model placed at (x, z, rot).
  node(model, nodeName, x, z, rot, scale = 1, y = 0) {
    const inf = this.model(model);
    if (!inf || !inf.nodes[nodeName]) return null;
    const n = inf.nodes[nodeName];
    const p = tf(x, z, rot, n.x * scale, n.z * scale);
    return new THREE.Vector3(p.x, y + n.y * scale, p.z);
  }

  // Door of a block placed at (x, z, rot): { door, front, out, yaw } in world space.
  entrance(model, x, z, rot, step = 1.6) {
    const e = ENTRANCE[model];
    if (!e) return null;
    const d = tf(x, z, rot, e[0], e[1]);
    const f = tf(x, z, rot, e[0], e[1] + step);
    const out = new THREE.Vector3(Math.sin(rot), 0, Math.cos(rot));
    return { door: new THREE.Vector3(d.x, 0, d.z), front: new THREE.Vector3(f.x, 0, f.z), out, lx: e[0], lz: e[1] };
  }

  // o: { scale, y, collide (false | spec[]), tag, unique, override, cast, receive, maxDist, sight, shoreL, shoreR }
  add(model, x, z, rot = 0, o = {}) {
    const inf = this.model(model);
    if (!inf) return null;
    const p = { model, x, z, rot, scale: o.scale ?? 1, y: o.y ?? 0, o };
    this.list.push(p);
    if (o.collide !== false) this.collide(model, x, z, rot, p.scale, o);
    if (inf.shore) {
      for (const side of ['L', 'R']) {
        const want = o['shore' + side] ?? true;
        if (!want || !inf.shore[side].length) continue;
        this.list.push({ model: model + '#' + side, x, z, rot, scale: p.scale, y: p.y, o: { cast: o.cast, receive: o.receive }, parts: inf.shore[side], base: model });
        if (o.collide !== false) {
          const sx = side === 'L' ? -1 : 1;
          const w = tf(x, z, rot, sx * (inf.shore.half + 1.7) * p.scale, 0);
          this.G.col.add(w.x, w.z, 1.6 * p.scale, 2.45 * p.scale, rot, { y0: -1, y1: 2.4, tag: 'shoring', sight: false });
        }
      }
    }
    return p;
  }

  collide(model, x, z, rot, scale, o = {}) {
    const inf = this.info.get(model);
    let spec = Array.isArray(o.collide) ? o.collide : FOOTPRINT[model];
    if (!spec && inf) {
      const b = inf.box;
      spec = [[(b.min.x + b.max.x) / 2, (b.min.z + b.max.z) / 2, (b.max.x - b.min.x) / 2, (b.max.z - b.min.z) / 2, b.max.y]];
    }
    const big = (FOOTPRINT[model] && FOOTPRINT[model][0][2] > 4) || o.building;
    spec.forEach((s, k) => {
      const [lx, lz, hx, hz, h, sight, lrot] = s;
      const w = tf(x, z, rot, lx * scale, lz * scale);
      this.G.col.add(w.x, w.z, hx * scale, hz * scale, rot + (lrot || 0), {
        y0: -1, y1: (h ?? (inf ? inf.box.max.y : 10)) * scale, tag: o.tag || model,
        sight: o.sight ?? (sight ?? true), solid: true,
      });
      if (big && k === 0) {
        this.footprints.push([w.x, w.z, hx * scale, hz * scale, rot, model]);
        if (this.onFootprint) this.onFootprint(w.x, w.z, hx * scale, hz * scale, rot);
      }
    });
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
      if (inst.length === 1 && !inst[0].parts) single.push(inst.pop());
      for (const p of single) this.clone(p);
      if (inst.length) this.instanced(model, inst);
    }
    this.list.length = 0;
  }

  clone(p) {
    const G = this.G;
    let obj;
    try { obj = G.assets.instance(p.model); } catch (e) { console.warn('[city]', e.message); return; }
    const inf = this.info.get(p.model);
    if (inf && inf.shore) {
      // rebuild from the cut parts so the shoring stays separate
      obj = new THREE.Group();
      for (const part of inf.parts) {
        const m = new THREE.Mesh(part.geometry, this.material(p.model, part, p.o.override));
        m.matrix.copy(part.matrix); m.matrixAutoUpdate = false;
        obj.add(m);
      }
      obj.traverse((o) => { if (o.isMesh) { o.castShadow = p.o.cast ?? true; o.receiveShadow = p.o.receive ?? true; } });
    } else {
      G.mats.apply(obj, { cast: p.o.cast ?? true, receive: p.o.receive ?? true, override: { ...(this.overrides[p.model] || {}), ...(p.o.override || {}) } });
    }
    obj.position.set(p.x, p.y, p.z);
    obj.rotation.y = p.rot;
    obj.scale.setScalar(p.scale);
    obj.updateMatrix();
    obj.updateMatrixWorld(true);
    obj.matrixAutoUpdate = false;
    obj.traverse((o) => { o.matrixAutoUpdate = false; });
    obj.name = p.model;
    this.root.add(obj);
    p.object = obj;
    if (!this.meshes.has(p.model)) this.meshes.set(p.model, []);
    this.meshes.get(p.model).push(obj);
    const max = p.o.maxDist ?? MAX_DIST[p.model];
    if (max) this.culled.push({ obj, x: p.x, z: p.z, max });
  }

  instanced(model, list) {
    const base = list[0].base || model;
    const inf = this.info.get(base);
    const parts = list[0].parts || inf.parts;
    const out = [];
    for (const part of parts) {
      const mat = this.material(base, part);
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
      im.name = model + ':' + part.matName;
      this.root.add(im);
      out.push(im);
    }
    this.meshes.set(model, out);
  }

  // Hide distant small things. Cheap enough to run a few times a second.
  cull(cam) {
    for (const c of this.culled) {
      const d = Math.hypot(cam.x - c.x, cam.z - c.z);
      c.obj.visible = d < c.max;
    }
  }
}
