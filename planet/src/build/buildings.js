// Building instances: one InstancedMesh per (model, part) so a whole city is
// a few dozen draw calls. Handles colliders, footprints, doors that open as
// the player approaches, interior volumes and the pool of point lights that
// follow the camera.
import * as THREE from 'three';
import { getModel } from './models.js';
import { makeBuildingMaterials, animMaterial } from './materials.js';
import { BUILDINGS } from '../sim/data.js';
import { U } from '../core/shared.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _y = new THREE.Vector3(0, 1, 0);

class ModelBatch {
  constructor(scene, model, mats) {
    this.scene = scene;
    this.model = model;
    this.items = [];
    this.cap = 0;
    this.parts = model.parts.map((p) => {
      let mat;
      if (p.anim) mat = animMaterial(mats, p.key, p.anim);
      else mat = mats[p.key];
      return { part: p, mat, mesh: null };
    });
    this.grow(4);
  }

  grow(cap) {
    this.cap = cap;
    for (const P of this.parts) {
      const old = P.mesh;
      const g = P.part.geo.clone();
      const iData = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
      iData.setUsage(THREE.DynamicDrawUsage);
      g.setAttribute('iData', iData);
      if (P.part.door) {
        const d = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1);
        d.setUsage(THREE.DynamicDrawUsage);
        g.setAttribute('iDoor', d);
      }
      const mesh = new THREE.InstancedMesh(g, P.mat, cap);
      mesh.count = 0;
      mesh.castShadow = P.part.key !== 'window' && P.part.key !== 'emissive' && P.part.key !== 'blink';
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      if (P.part.key === 'window') mesh.renderOrder = 5;
      this.scene.add(mesh);
      if (old) { this.scene.remove(old); old.geometry.dispose(); old.dispose(); }
      P.mesh = mesh;
    }
    this.items.forEach((b, i) => this.write(b, i));
    this.sync();
  }

  add(b) {
    if (this.items.length >= this.cap) this.grow(this.cap * 2);
    b.batch = this; b.slot = this.items.length;
    this.items.push(b);
    this.write(b, b.slot);
    this.sync();
  }

  remove(b) {
    const i = b.slot, last = this.items.length - 1;
    if (i !== last) {
      const mv = this.items[last];
      this.items[i] = mv; mv.slot = i;
      this.write(mv, i);
    }
    this.items.pop();
    b.batch = null;
    this.sync();
  }

  write(b, i) {
    _m.compose(_p.set(b.x, b.y, b.z), _q.setFromAxisAngle(_y, b.rot), _s.set(1, 1, 1));
    for (const P of this.parts) {
      P.mesh.setMatrixAt(i, _m);
      const a = P.mesh.geometry.attributes.iData;
      a.array[i * 3] = b.lit; a.array[i * 3 + 1] = b.active; a.array[i * 3 + 2] = b.seed;
      if (P.part.door) P.mesh.geometry.attributes.iDoor.array[i] = b.door || 0;
    }
  }

  writeData(b) {
    for (const P of this.parts) {
      const a = P.mesh.geometry.attributes.iData;
      a.array[b.slot * 3] = b.lit; a.array[b.slot * 3 + 1] = b.active;
      a.needsUpdate = true;
      if (P.part.door) { P.mesh.geometry.attributes.iDoor.array[b.slot] = b.door || 0; P.mesh.geometry.attributes.iDoor.needsUpdate = true; }
    }
  }

  sync() {
    for (const P of this.parts) {
      P.mesh.count = this.items.length;
      P.mesh.instanceMatrix.needsUpdate = true;
      P.mesh.geometry.attributes.iData.needsUpdate = true;
      if (P.part.door) P.mesh.geometry.attributes.iDoor.needsUpdate = true;
    }
  }
}

export class Buildings {
  constructor(game) {
    this.game = game;
    this.scene = game.engine.scene;
    this.mats = makeBuildingMaterials();
    this.batches = new Map();
    this.list = [];
    this.nextId = 1;
    this.lights = [];
    for (let i = 0; i < 6; i++) {
      const l = new THREE.PointLight(0xffc890, 0, 12, 1.6);
      l.castShadow = false;
      this.scene.add(l);
      this.lights.push(l);
    }
    this._lt = 0;
  }

  batch(key) {
    let b = this.batches.get(key);
    if (!b) { b = new ModelBatch(this.scene, getModel(key), this.mats); this.batches.set(key, b); }
    return b;
  }

  modelKey(type, tier = 0) { return type === 'house' ? 'house:' + tier : type; }

  add(type, x, y, z, rot, extra = {}) {
    const def = BUILDINGS[type];
    const b = {
      id: extra.id || this.nextId++, type, def, x, y, z, rot,
      tier: extra.tier || 0, lit: 1, active: 1, seed: (def.house ? 2 : 0) + Math.random(), door: 0,
      cols: [], data: extra.data || {},
    };
    if (b.id >= this.nextId) this.nextId = b.id + 1;
    b.key = this.modelKey(type, b.tier);
    b.model = getModel(b.key);
    b.c = Math.cos(rot); b.s = Math.sin(rot);
    b.hw = def.size[0] / 2; b.hd = def.size[1] / 2;
    this.batch(b.key).add(b);
    this.addColliders(b);
    this.list.push(b);
    return b;
  }

  addColliders(b) {
    const C = this.game.colliders;
    for (const c of b.model.colliders) {
      const [wx, wz] = this.toWorld(b, c.x, c.z);
      if (c.cyl) b.cols.push(C.addCyl(wx, wz, c.r, b.y + c.y0, b.y + c.y1, b.id, { b, noStand: c.noStand }));
      else b.cols.push(C.addBox(wx, wz, c.hx, c.hz, b.rot, b.y + c.y0, b.y + c.y1, b.id, { b, noStand: c.noStand }));
    }
  }

  remove(b) {
    if (b.batch) b.batch.remove(b);
    this.game.colliders.removeOwner(b.id);
    b.cols = [];
    const i = this.list.indexOf(b);
    if (i >= 0) this.list.splice(i, 1);
    b.removed = true;
  }

  setTier(b, tier) {
    b.batch.remove(b);
    this.game.colliders.removeOwner(b.id);
    b.cols = [];
    b.tier = tier;
    b.key = this.modelKey(b.type, tier);
    b.model = getModel(b.key);
    this.batch(b.key).add(b);
    this.addColliders(b);
  }

  setState(b, lit, active) {
    if (b.lit === lit && b.active === active) return;
    b.lit = lit; b.active = active;
    if (b.batch) b.batch.writeData(b);
  }

  // local (x,z) -> world
  toWorld(b, lx, lz) { return [b.x + lx * b.c + lz * b.s, b.z - lx * b.s + lz * b.c]; }
  toLocal(b, wx, wz) { const dx = wx - b.x, dz = wz - b.z; return [dx * b.c - dz * b.s, dx * b.s + dz * b.c]; }

  footprintHit(b, x, z, pad = 0) {
    const [lx, lz] = this.toLocal(b, x, z);
    return Math.abs(lx) < b.hw + pad && Math.abs(lz) < b.hd + pad;
  }

  isBlocked(x, z, pad = 0) {
    for (const b of this.list) {
      if (Math.abs(b.x - x) > b.hw + b.hd + pad + 1 || Math.abs(b.z - z) > b.hw + b.hd + pad + 1) continue;
      if (this.footprintHit(b, x, z, pad + 0.5)) return true;
    }
    return false;
  }

  inside(p) {
    for (const b of this.list) {
      if (!b.model.interiors.length) continue;
      if (Math.abs(b.x - p.x) > 20 || Math.abs(b.z - p.z) > 20) continue;
      const [lx, lz] = this.toLocal(b, p.x, p.z);
      const ly = p.y - b.y;
      for (const r of b.model.interiors) {
        if (lx > r.x0 && lx < r.x1 && lz > r.z0 && lz < r.z1 && ly > r.y0 - 0.3 && ly < r.y1) return b;
      }
    }
    return null;
  }

  near(x, z, r, filter) {
    const out = [];
    for (const b of this.list) {
      const d = Math.hypot(b.x - x, b.z - z);
      if (d < r && (!filter || filter(b))) out.push(b);
    }
    return out;
  }

  count(type) { let n = 0; for (const b of this.list) if (b.type === type) n++; return n; }

  update(dt, cam, player) {
    // doors
    for (const b of this.list) {
      if (!b.model.doors.length) continue;
      if (Math.abs(b.x - player.pos.x) > 30 || Math.abs(b.z - player.pos.z) > 30) { if (b.door > 0) { b.door = 0; b.batch.writeData(b); } continue; }
      let open = false;
      for (const d of b.model.doors) {
        const [wx, wz] = this.toWorld(b, d.x, d.z);
        if (Math.hypot(wx - player.pos.x, wz - player.pos.z) < 3.2 && Math.abs(player.pos.y - b.y) < 3) open = true;
        if (this.game.npcNearDoor && this.game.npcNearDoor(wx, wz)) open = true;
      }
      const target = open ? 1 : 0;
      if (b.door !== target) {
        b.door += Math.sign(target - b.door) * Math.min(Math.abs(target - b.door), dt * 3);
        b.batch.writeData(b);
      }
    }
    // light pool: nearest light points around the camera
    this._lt -= dt;
    if (this._lt <= 0) {
      this._lt = 0.25;
      const night = U.uNight.value;
      const cands = [];
      for (const b of this.list) {
        if (!b.model.lights.length || b.lit < 0.5) continue;
        const d = Math.hypot(b.x - cam.x, b.z - cam.z);
        if (d > 70) continue;
        for (const L of b.model.lights) {
          const [wx, wz] = this.toWorld(b, L.x, L.z);
          const dd = Math.hypot(wx - cam.x, b.y + L.y - cam.y, wz - cam.z);
          cands.push({ d: dd, x: wx, y: b.y + L.y, z: wz, L, interior: b.model.interiors.length > 0 });
        }
      }
      cands.sort((a, c) => a.d - c.d);
      this.lights.forEach((l, i) => {
        const c = cands[i];
        if (!c) { l.intensity = 0; return; }
        l.position.set(c.x, c.y, c.z);
        l.color.set(c.L.color);
        l.distance = c.L.dist;
        l.intensity = c.L.intensity * (c.interior ? 1 : night) * (1 - Math.min(1, c.d / 70));
      });
    }
  }

  serialize() {
    return this.list.map((b) => ({ id: b.id, type: b.type, x: b.x, y: b.y, z: b.z, rot: b.rot, tier: b.tier, data: b.data }));
  }
}
