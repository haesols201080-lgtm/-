// Steel support structure under buildings that stand on stilts instead of a
// levelled pad: a column under every deck support point sized to the ground
// at that exact spot, base plates, cross bracing on tall bays, and a steel
// stair from each entrance down to the ground. Geometry for every building is
// merged into one mesh per material (rebuilt when buildings or ground
// change); stair treads and columns also get colliders owned by the building.
import * as THREE from 'three';
import { GeoBuilder } from '../core/geobuilder.js';

const v = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = new THREE.Vector3(0, 1, 0);
export const DECK = 0.45;          // deck depth below the floor (plate + beams)
export const CLEAR = 0.5;          // floor height above the highest ground point

// buildings that stand on a steel deck and legs (big enough to need one)
export function onStilts(type, def) {
  return !def.foundation && !def.water && !def.road && !def.tool && type !== 'pod' && Math.min(def.size[0], def.size[1]) >= 3;
}

const COL_STEEL = 0x6f757c, COL_BRACE = 0x8a9097, COL_PLATE = 0x3d4248, COL_TREAD = 0x9aa0a6, COL_RAIL = 0x5b6168;

export class Supports {
  constructor(game) {
    this.game = game;
    this.meshes = [];
    this.dirty = false;
  }

  // local support points: perimeter loop (for bracing) + interior grid
  points(b) {
    const hw = b.hw - 0.45, hd = b.hd - 0.45;
    const nx = Math.max(1, Math.ceil(2 * hw / 3.6)), nz = Math.max(1, Math.ceil(2 * hd / 3.6));
    const loop = [];
    for (let i = 0; i <= nx; i++) loop.push([-hw + 2 * hw * i / nx, -hd]);
    for (let j = 1; j <= nz; j++) loop.push([hw, -hd + 2 * hd * j / nz]);
    for (let i = nx - 1; i >= 0; i--) loop.push([-hw + 2 * hw * i / nx, hd]);
    for (let j = nz - 1; j >= 1; j--) loop.push([-hw, -hd + 2 * hd * j / nz]);
    const inner = [];
    for (let i = 1; i < nx; i++) for (let j = 1; j < nz; j++) if ((i + j) % 2 === 0) inner.push([-hw + 2 * hw * i / nx, -hd + 2 * hd * j / nz]);
    return { loop, inner };
  }

  // stairs: local x of each entrance (front edge, going -z)
  stairs(b) {
    const T = this.game.terrain;
    const out = [];
    const ent = b.model.entries || ((b.def.house || b.def.enter || b.def.cat === 'colony') ? [0] : []);
    for (const lx of ent) {
      const at = (lz) => { const [wx, wz] = this.game.buildings.toWorld(b, lx, lz); return T.height(wx, wz); };
      let H = b.y - at(-b.hd - 0.6);
      let n = Math.max(1, Math.ceil(H / 0.19));
      H = b.y - at(-b.hd - n * 0.28);
      n = Math.max(1, Math.ceil(H / 0.19));
      if (H < 0.12) continue;
      out.push({ lx, H, n, rise: H / n, foot: b.y - H });
    }
    return out;
  }

  addColliders(b) {
    if (!b.data.stilts) return;
    const C = this.game.colliders, T = this.game.terrain;
    const { loop, inner } = this.points(b);
    for (const [lx, lz] of [...loop, ...inner]) {
      const [wx, wz] = this.game.buildings.toWorld(b, lx, lz);
      const g = T.height(wx, wz);
      if (b.y - DECK - g > 0.3) b.cols.push(C.addCyl(wx, wz, 0.16, g - 0.2, b.y - DECK, b.id, { b, noStand: true }));
    }
    for (const s of this.stairs(b)) {
      for (let k = 1; k < s.n; k++) {
        const lz = -b.hd - (k - 0.5) * 0.28;
        const [wx, wz] = this.game.buildings.toWorld(b, s.lx, lz);
        b.cols.push(C.addBox(wx, wz, 0.65, 0.14, b.rot, s.foot - 0.3, b.y - k * s.rise, b.id, { b }));
      }
    }
  }

  rebuild() {
    this.dirty = false;
    for (const m of this.meshes) { this.game.engine.scene.remove(m); m.geometry.dispose(); }
    this.meshes = [];
    const G = { metal: new GeoBuilder([], { pan: true }) };
    const T = this.game.terrain, B = this.game.buildings;
    const bar = (a, c, r, color, seg = 8) => {
      const d = c.clone().sub(a), len = d.length();
      if (len < 0.02) return;
      const g = new THREE.CylinderGeometry(r, r, len, seg);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()));
      G.metal.add(g, { pos: a.clone().add(c).multiplyScalar(0.5), color });
    };
    const box = (x, y, z, w, h, d, rot, color) => G.metal.add(new THREE.BoxGeometry(w, h, d), { pos: v(x, y, z), rot: new THREE.Euler(0, rot, 0), color });
    for (const b of B.list) {
      if (!b.data.stilts || b.removed) continue;
      const top = b.y - DECK;
      const W = (lx, lz) => { const [wx, wz] = B.toWorld(b, lx, lz); return [wx, wz, T.height(wx, wz)]; };
      const { loop, inner } = this.points(b);
      const legs = loop.map(([lx, lz]) => W(lx, lz));
      for (const [x, z, g] of [...legs, ...inner.map(([lx, lz]) => W(lx, lz))]) {
        if (top - g < 0.05) continue;
        // column, cap plate under the deck beam, base plate with anchor bolts
        G.metal.add(new THREE.CylinderGeometry(0.14, 0.14, top - g + 0.25, 12), { pos: v(x, (top + g - 0.25) / 2, z), color: COL_STEEL });
        box(x, top - 0.03, z, 0.42, 0.06, 0.42, b.rot, COL_PLATE);
        box(x, g + 0.03, z, 0.6, 0.08, 0.6, b.rot, COL_PLATE);
        for (const [ox, oz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) {
          const c = Math.cos(b.rot), s = Math.sin(b.rot);
          G.metal.add(new THREE.CylinderGeometry(0.025, 0.025, 0.1, 6), { pos: v(x + ox * c + oz * s, g + 0.1, z - ox * s + oz * c), color: COL_PLATE });
        }
        if (top - g > 1.6) G.metal.add(new THREE.CylinderGeometry(0.17, 0.17, 0.12, 12), { pos: v(x, g + (top - g) * 0.55, z), color: COL_PLATE });
      }
      // cross bracing between neighbouring perimeter columns on tall bays
      for (let i = 0; i < legs.length; i++) {
        const A = legs[i], Bq = legs[(i + 1) % legs.length];
        const lo = Math.max(A[2], Bq[2]) + 0.35, hi = top - 0.15;
        if (hi - lo < 0.9) continue;
        bar(v(A[0], hi, A[1]), v(Bq[0], Math.max(Bq[2] + 0.35, lo), Bq[1]), 0.045, COL_BRACE, 6);
        bar(v(Bq[0], hi, Bq[1]), v(A[0], Math.max(A[2] + 0.35, lo), A[1]), 0.045, COL_BRACE, 6);
        if (hi - lo > 2.4) bar(v(A[0], (hi + lo) / 2, A[1]), v(Bq[0], (hi + lo) / 2, Bq[1]), 0.05, COL_BRACE, 6);
      }
      // steel stairs: open treads, stringers, handrails with posts
      for (const s of this.stairs(b)) {
        const half = 0.65;
        for (let k = 1; k < s.n; k++) {
          const lz = -b.hd - (k - 0.5) * 0.28, [x, z] = B.toWorld(b, s.lx, lz);
          box(x, b.y - k * s.rise - 0.03, z, 1.3, 0.06, 0.3, b.rot, COL_TREAD);
        }
        const run = (s.n - 0.5) * 0.28;
        for (const sx of [-1, 1]) {
          const [x0, z0] = B.toWorld(b, s.lx + sx * (half + 0.04), -b.hd), [x1, z1] = B.toWorld(b, s.lx + sx * (half + 0.04), -b.hd - run);
          bar(v(x0, b.y - 0.12, z0), v(x1, s.foot + 0.02, z1), 0.06, COL_STEEL, 6);
          const p0 = v(x0, b.y + 0.95, z0), p1 = v(x1, s.foot + 0.95, z1);
          bar(p0, p1, 0.025, COL_RAIL, 6);
          bar(v(x0, b.y - 0.1, z0), p0, 0.025, COL_RAIL, 6);
          bar(v(x1, s.foot, z1), p1, 0.025, COL_RAIL, 6);
          const mid = p0.clone().lerp(p1, 0.5);
          bar(v(mid.x, mid.y - 0.95 - 0.0, mid.z), mid, 0.02, COL_RAIL, 6);
        }
        const [fx, fz] = B.toWorld(b, s.lx, -b.hd - run - 0.35);
        box(fx, s.foot + 0.03, fz, 1.5, 0.08, 0.7, b.rot, COL_PLATE);
      }
    }
    const mats = this.game.buildings.mats;
    for (const [key, gb] of Object.entries(G)) {
      if (gb.empty) continue;
      const mesh = new THREE.Mesh(gb.build(), mats[key]);
      mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
      this.game.engine.scene.add(mesh);
      this.meshes.push(mesh);
    }
  }
}
