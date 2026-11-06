// Living colony: walking colonists (A* on a navigation grid that respects
// buildings and prefers roads), logistics drones that visibly carry goods
// between buildings and hubs, and the colonist shuttle that lands at the HQ.
import * as THREE from 'three';
import { TIERS, ITEMS } from '../sim/data.js';
import { U } from '../core/shared.js';
import { GeoBuilder } from '../core/geobuilder.js';
import { colonistMesh } from './colonist.js';

const CELL = 2;
const tmpC = new THREE.Color();

// ------------------------------------------------------------------ nav grid
class NavGrid {
  constructor(game) { this.game = game; this.dirty = true; }

  rebuild() {
    this.dirty = false;
    const B = this.game.buildings.list;
    if (!B.length) { this.w = 0; return; }
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const b of B) { x0 = Math.min(x0, b.x - 20); z0 = Math.min(z0, b.z - 20); x1 = Math.max(x1, b.x + 20); z1 = Math.max(z1, b.z + 20); }
    const maxSpan = 500;
    if (x1 - x0 > maxSpan) { const c = (x0 + x1) / 2; x0 = c - maxSpan / 2; x1 = c + maxSpan / 2; }
    if (z1 - z0 > maxSpan) { const c = (z0 + z1) / 2; z0 = c - maxSpan / 2; z1 = c + maxSpan / 2; }
    this.x0 = x0; this.z0 = z0;
    this.w = Math.ceil((x1 - x0) / CELL); this.h = Math.ceil((z1 - z0) / CELL);
    this.cost = new Float32Array(this.w * this.h).fill(1);
    const T = this.game.terrain;
    for (let j = 0; j < this.h; j++) for (let i = 0; i < this.w; i++) {
      const x = x0 + (i + 0.5) * CELL, z = z0 + (j + 0.5) * CELL;
      if (T.slope(x, z) > 0.45 || T.height(x, z) < U.uWaterLevel.value + 0.2) this.cost[j * this.w + i] = Infinity;
      else if (T.surfAt(x, z, this._sf || (this._sf = new Float32Array(8)))[7] > 0.95) this.cost[j * this.w + i] = 0.4;
    }
    for (const b of B) {
      const walk = b.def.road || b.def.foundation || b.type === 'park' || b.type === 'market';
      const r = Math.hypot(b.hw, b.hd) + 1;
      const i0 = Math.floor((b.x - r - x0) / CELL), i1 = Math.ceil((b.x + r - x0) / CELL);
      const j0 = Math.floor((b.z - r - z0) / CELL), j1 = Math.ceil((b.z + r - z0) / CELL);
      for (let j = Math.max(0, j0); j < Math.min(this.h, j1); j++) for (let i = Math.max(0, i0); i < Math.min(this.w, i1); i++) {
        const x = x0 + (i + 0.5) * CELL, z = z0 + (j + 0.5) * CELL;
        if (!this.game.buildings.footprintHit(b, x, z, walk ? -0.5 : 0.6)) continue;
        this.cost[j * this.w + i] = walk ? (b.def.road ? 0.45 : 0.8) : Infinity;
      }
    }
  }

  cellOf(x, z) { return [Math.floor((x - this.x0) / CELL), Math.floor((z - this.z0) / CELL)]; }

  path(ax, az, bx, bz) {
    if (this.dirty) this.rebuild();
    if (!this.w) return null;
    const [si, sj] = this.cellOf(ax, az), [ti, tj] = this.cellOf(bx, bz);
    const W = this.w, H = this.h;
    const inb = (i, j) => i >= 0 && j >= 0 && i < W && j < H;
    if (!inb(si, sj) || !inb(ti, tj)) return null;
    const start = sj * W + si, goal = tj * W + ti;
    const g = new Float32Array(W * H).fill(Infinity);
    const came = new Int32Array(W * H).fill(-1);
    const open = [start];
    g[start] = 0;
    const hfn = (k) => Math.hypot(k % W - ti, ((k / W) | 0) - tj) * 0.45;
    const f = new Float32Array(W * H).fill(Infinity);
    f[start] = hfn(start);
    let iter = 0;
    while (open.length && iter++ < 20000) {
      let bi = 0;
      for (let k = 1; k < open.length; k++) if (f[open[k]] < f[open[bi]]) bi = k;
      const cur = open[bi];
      open[bi] = open[open.length - 1]; open.pop();
      if (cur === goal) break;
      const ci = cur % W, cj = (cur / W) | 0;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const ni = ci + di, nj = cj + dj;
        if (!inb(ni, nj)) continue;
        const nk = nj * W + ni;
        let c = this.cost[nk];
        if (c === Infinity && nk !== goal) continue;
        if (c === Infinity) c = 1;
        if (di && dj && (this.cost[cj * W + ni] === Infinity || this.cost[nj * W + ci] === Infinity)) continue;
        const ng = g[cur] + c * (di && dj ? 1.414 : 1);
        if (ng < g[nk]) {
          g[nk] = ng; came[nk] = cur; f[nk] = ng + hfn(nk);
          if (!open.includes(nk)) open.push(nk);
        }
      }
    }
    if (came[goal] < 0 && goal !== start) return null;
    const pts = [];
    for (let k = goal; k >= 0 && k !== start; k = came[k]) pts.push([this.x0 + (k % W + 0.5) * CELL, this.z0 + (((k / W) | 0) + 0.5) * CELL]);
    pts.reverse();
    pts.push([bx, bz]);
    // string-pull: drop collinear points
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      if (i > 0 && i < pts.length - 1) {
        const a = out[out.length - 1], b = pts[i], c = pts[i + 1];
        if (Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) < 0.01) continue;
      }
      out.push(pts[i]);
    }
    return out;
  }
}

export class NPCs {
  constructor(game) {
    this.game = game;
    const scene = game.engine.scene;
    this.nav = new NavGrid(game);
    this.walkers = [];
    this.CAP = 64;
    // detailed bodies close to the camera, a light model for the rest
    this.NEAR = 14;
    this.people = [colonistMesh(scene, this.NEAR, 0), colonistMesh(scene, this.CAP, 1)];

    // drones
    const dg = new GeoBuilder();
    dg.add(new THREE.BoxGeometry(0.7, 0.18, 0.7), { color: 0xe7e5df });
    dg.add(new THREE.BoxGeometry(0.72, 0.05, 0.72), { pos: new THREE.Vector3(0, 0.08, 0), color: 0xf0761c });
    for (const [x, z] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) {
      dg.add(new THREE.CylinderGeometry(0.04, 0.04, 0.1, 6), { pos: new THREE.Vector3(x, 0.08, z), color: 0x333333 });
      dg.add(new THREE.CylinderGeometry(0.26, 0.26, 0.015, 14), { pos: new THREE.Vector3(x, 0.14, z), color: 0x222222 });
    }
    dg.add(new THREE.BoxGeometry(0.4, 0.3, 0.4), { pos: new THREE.Vector3(0, -0.28, 0), color: 0xffffff });
    this.droneMesh = new THREE.InstancedMesh(dg.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.3 }), 40);
    this.droneMesh.count = 0; this.droneMesh.castShadow = true; this.droneMesh.frustumCulled = false;
    this.droneMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(40 * 3).fill(1), 3);
    scene.add(this.droneMesh);
    this.drones = [];

    // shuttle
    this.shuttle = this.makeShuttle();
    scene.add(this.shuttle.group);
    this.m4 = new THREE.Matrix4();
  }

  invalidate() { this.nav.dirty = true; }

  // ---------------------------------------------------------------- drones
  carry(from, to, item) {
    if (!from || !to || from === to || this.drones.length >= 40) return;
    const fx = from.x, fz = from.z, tx = to.x, tz = to.z;
    const fy = from.y + Math.min(8, from.model.height) + 1, ty = to.y + Math.min(8, to.model.height) + 1;
    const d = Math.hypot(tx - fx, tz - fz);
    if (d < 4) return;
    this.drones.push({ a: [fx, fy, fz], b: [tx, ty, tz], h: Math.max(10, d * 0.25), t: 0, dur: d / 14 + 1.5, color: new THREE.Color(1, 1, 1).lerp(new THREE.Color(ITEMS[item]?.color || '#ffffff'), 0.35) });
  }

  // ---------------------------------------------------------------- shuttle
  makeShuttle() {
    const gb = new GeoBuilder();
    gb.add(new THREE.CapsuleGeometry(1.6, 5.0, 6, 16), { rot: new THREE.Euler(Math.PI / 2, 0, 0), color: 0xe7e5df });
    gb.add(new THREE.BoxGeometry(7.5, 0.25, 2.2), { pos: new THREE.Vector3(0, -0.3, 1.0), color: 0xcdcac2 });
    gb.add(new THREE.BoxGeometry(0.25, 2.0, 1.6), { pos: new THREE.Vector3(0, 1.3, 2.6), color: 0xf0761c });
    gb.add(new THREE.SphereGeometry(1.1, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), { pos: new THREE.Vector3(0, 0.5, -2.6), rot: new THREE.Euler(-Math.PI / 2.4, 0, 0), color: 0x1a2a33 });
    for (const x of [-2.6, 2.6]) gb.add(new THREE.CylinderGeometry(0.45, 0.55, 1.6, 12), { pos: new THREE.Vector3(x, -0.2, 2.4), rot: new THREE.Euler(Math.PI / 2, 0, 0), color: 0x5b6168 });
    for (const [x, z] of [[-1.1, -2], [1.1, -2], [-1.1, 2], [1.1, 2]]) gb.add(new THREE.CylinderGeometry(0.06, 0.08, 1.4, 6), { pos: new THREE.Vector3(x, -1.8, z), color: 0x33373c });
    const mesh = new THREE.Mesh(gb.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.25 }));
    mesh.castShadow = true;
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.6, 3.2, 12, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 2.2, 0.8), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
    flame.rotation.x = Math.PI; flame.position.y = -3.2;
    const group = new THREE.Group();
    group.add(mesh, flame);
    group.visible = false;
    return { group, flame, state: 'idle', t: 0 };
  }

  land(hq, n) {
    const S = this.shuttle;
    if (S.state !== 'idle') { this.game.colony.arrive(n); return; }
    const [px, pz] = this.game.buildings.toWorld(hq, 6.85, 0);
    S.pad = new THREE.Vector3(px, hq.y + 2.0, pz);
    S.rot = hq.rot;
    S.n = n; S.state = 'descend'; S.t = 0;
    S.group.visible = true;
    this.game.audio && this.game.audio.play('shuttle');
  }

  updateShuttle(dt) {
    const S = this.shuttle;
    if (S.state === 'idle') return;
    S.t += dt;
    const g = S.group;
    g.rotation.y = S.rot;
    if (S.state === 'descend') {
      const k = Math.min(1, S.t / 9);
      const e = 1 - Math.pow(1 - k, 3);
      g.position.set(S.pad.x, S.pad.y + (1 - e) * 380, S.pad.z);
      S.flame.scale.setScalar(0.6 + (1 - e) * 0.8);
      S.flame.visible = true;
      if (k >= 1) {
        S.state = 'landed'; S.t = 0; S.flame.visible = false;
        const placed = this.game.colony.arrive(S.n);
        for (let i = 0; i < Math.min(placed, 6); i++) this.spawnArrival(S.pad, i);
        if (placed) this.game.ui && this.game.ui.toast('셔틀이 정착민 ' + placed + '명을 데려왔습니다', 'good', 3);
      }
    } else if (S.state === 'landed') {
      if (S.t > 7) { S.state = 'ascend'; S.t = 0; }
    } else if (S.state === 'ascend') {
      const k = Math.min(1, S.t / 8);
      g.position.set(S.pad.x, S.pad.y + k * k * 420, S.pad.z);
      S.flame.visible = true; S.flame.scale.setScalar(1.2);
      if (k >= 1) { S.state = 'idle'; g.visible = false; }
    }
  }

  // ---------------------------------------------------------------- walkers
  doorOf(b) {
    const [x, z] = this.game.buildings.toWorld(b, 0, -b.hd - 1.4);
    return [x, z];
  }

  spawnArrival(pad, i) {
    const homes = this.game.buildings.list.filter((b) => b.def.house);
    if (!homes.length || this.walkers.length >= this.CAP) return;
    const home = homes[Math.floor(Math.random() * homes.length)];
    const w = this.newWalker(pad.x + (i - 3) * 0.6, pad.z - 1.5, home.tier);
    w.wait = i * 0.6;
    this.goTo(w, home);
  }

  newWalker(x, z, tier) {
    // every colonist is a person of their own: build, height, skin, hair
    // style and colour, beard, and their own work clothes (tier shows as the
    // accent piping on yoke, sleeves and badge)
    const R = Math.random, pick = (a) => a[Math.floor(R() * a.length)];
    const fem = R() < 0.5;
    const SKIN = [0xf3d5bf, 0xe8bf9c, 0xd6a07a, 0xb97f57, 0x93603e, 0x6e4529, 0x4f3020];
    const HAIR = [0x16110e, 0x2b1e16, 0x4a3222, 0x6e4a2c, 0x9a6a3a, 0xc9a46a, 0xe0cc9a, 0x7a2e1a, 0x8d8a86, 0xc8c6c2];
    const TOPS = [0xeeeeea, 0xd8dade, 0x5d6b7a, 0x2f3d52, 0x6f7a55, 0xc9b48f, 0x3f6f73, 0x8a4d3c, 0x9aa3ad, 0x3b3f45, 0xa8826a, 0x4d5a3a];
    const PANTS = [0x3a3d42, 0x2d3440, 0x4a3f36, 0x56595e, 0x23262b, 0x5a5446, 0x2e3a33];
    const style = fem ? pick([1, 1, 2, 3, 3, 0, 5, 6]) : pick([0, 0, 4, 4, 5, 6, 6, 1]);
    const look = {
      fem: fem ? 0.75 + R() * 0.25 : R() * 0.15,
      h: fem ? 0.93 + R() * 0.08 : 0.97 + R() * 0.09, w: 0.94 + R() * 0.12,
      skin: pick(SKIN), hair: pick(HAIR), style, beard: !fem && R() < 0.35 ? 1 : 0,
      top: pick(TOPS), pants: pick(PANTS), seed: R(),
    };
    const w = { x, z, y: this.game.terrain.height(x, z), yaw: 0, path: null, pi: 0, hidden: 0, tier, look, phase: Math.random() * 6, speed: (fem ? 1.08 : 1.15) + Math.random() * 0.45, wait: 0, amp: 1, pause: 0 };
    this.walkers.push(w);
    return w;
  }

  goTo(w, b) {
    const [dx, dz] = this.doorOf(b);
    w.path = this.nav.path(w.x, w.z, dx, dz) || [[dx, dz]];
    w.pi = 0; w.target = b;
  }

  pickTarget(w) {
    const B = this.game.buildings.list.filter((b) => !b.def.foundation && !b.def.road && b.type !== 'pylon' && b.type !== 'lamp' && (b.def.cat === 'colony' || b.def.workers || b.def.house));
    if (!B.length) return;
    this.goTo(w, B[Math.floor(Math.random() * B.length)]);
  }

  npcNearDoor(x, z) {
    for (const w of this.walkers) if (!w.hidden && Math.abs(w.x - x) < 2.6 && Math.abs(w.z - z) < 2.6) return true;
    return false;
  }

  update(dt, cam) {
    const g = this.game;
    this.updateShuttle(dt);
    // keep the number of ambient walkers proportional to the population
    const want = Math.min(this.CAP, Math.ceil(g.colony.total / 3));
    if (this.walkers.length < want && g.buildings.list.some((b) => b.def.house)) {
      const homes = g.buildings.list.filter((b) => b.def.house && b.data.res > 0);
      if (homes.length) {
        const h = homes[Math.floor(Math.random() * homes.length)];
        const [x, z] = this.doorOf(h);
        const w = this.newWalker(x, z, h.tier);
        w.hidden = 1 + Math.random() * 4;
      }
    } else if (this.walkers.length > want + 4) this.walkers.pop();

    const night = U.uNight.value;
    for (const w of this.walkers) {
      if (w.wait > 0) { w.wait -= dt; continue; }
      if (w.hidden > 0) { w.hidden -= dt; if (w.hidden <= 0) this.pickTarget(w); continue; }
      if (!w.path) { this.pickTarget(w); if (!w.path) { w.hidden = 5; continue; } }
      const p = w.path[w.pi];
      if (!p) { w.hidden = (night > 0.5 ? 25 : 6) + Math.random() * 12; w.path = null; continue; }
      const dx = p[0] - w.x, dz = p[1] - w.z, d = Math.hypot(dx, dz);
      if (d < 0.3) { w.pi++; continue; }
      // now and then someone stops for a moment and looks around
      if (w.pause > 0) { w.pause -= dt; w.amp = Math.max(0, w.amp - dt * 3); continue; }
      if (d > 6 && Math.random() < dt * 0.015) w.pause = 2 + Math.random() * 5;
      w.amp = Math.min(1, w.amp + dt * 3);
      const sp = w.speed * dt * (0.25 + 0.75 * w.amp);
      w.x += dx / d * Math.min(sp, d); w.z += dz / d * Math.min(sp, d);
      const ty = Math.atan2(-dx, -dz);
      let dy = ty - w.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      w.yaw += dy * Math.min(1, dt * 8);
      const ground = g.colliders.groundAt(w.x, w.z, 0.2, g.terrain.height(w.x, w.z) + 1.0);
      w.y = Math.max(g.terrain.height(w.x, w.z), ground);
      w.phase += dt * w.speed * 4.2;
    }
    this.drawWalkers(cam);
    this.updateDrones(dt);
  }

  drawWalkers(cam) {
    const M = this.m4, q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
    const col = new THREE.Color(), suit = new THREE.Color(0xe4e2dc);
    const helmet = this.game.terra.breathable ? 0 : 1;
    const nearCap = this.game.engine.qualityName === 'low' ? 6 : this.NEAR, nearD2 = 22 * 22;
    const cnt = [0, 0];
    for (const w of this.walkers) {
      if (w.hidden > 0 || w.wait > 0) continue;
      const lod = cam && cnt[0] < nearCap && (w.x - cam.x) ** 2 + (w.z - cam.z) ** 2 < nearD2 ? 0 : 1;
      if (lod && cnt[1] >= this.CAP) continue;
      const { mesh, attrs: A } = this.people[lod];
      const n = cnt[lod]++;
      const L = w.look;
      M.compose(p.set(w.x, w.y, w.z), q.setFromAxisAngle(Y, w.yaw), s.set(L.w, L.h, L.w));
      mesh.setMatrixAt(n, M);
      A.iAnim.setXYZW(n, w.phase, w.amp ?? 1, L.seed, L.fem);
      // before the air is breathable everyone wears the white surface suit
      const top = helmet ? col.copy(suit).lerp(tmpC.set(L.top), 0.12).getHex() : L.top;
      const pants = helmet ? col.copy(suit).multiplyScalar(0.92).getHex() : L.pants;
      A.iLook.setXYZW(n, L.style, L.beard, helmet, parseInt((TIERS[w.tier] || TIERS[0]).color.slice(1), 16));
      A.iCols.setXYZW(n, top, L.skin, L.hair, pants);
    }
    this.people.forEach(({ mesh, attrs }, i) => {
      mesh.count = cnt[i];
      mesh.instanceMatrix.needsUpdate = true;
      for (const a of Object.values(attrs)) a.needsUpdate = true;
    });
  }

  updateDrones(dt) {
    const M = this.m4, q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1), e = new THREE.Euler();
    let n = 0;
    this.drones = this.drones.filter((d) => (d.t += dt) < d.dur);
    for (const d of this.drones) {
      const t = d.t / d.dur;
      const k = t * t * (3 - 2 * t);
      const x = d.a[0] + (d.b[0] - d.a[0]) * k, z = d.a[2] + (d.b[2] - d.a[2]) * k;
      const y = d.a[1] + (d.b[1] - d.a[1]) * k + Math.sin(t * Math.PI) * d.h;
      const yaw = Math.atan2(d.b[0] - d.a[0], d.b[2] - d.a[2]);
      M.compose(p.set(x, y, z), q.setFromEuler(e.set(0.15 * Math.sin(t * Math.PI), yaw, 0)), s);
      this.droneMesh.setMatrixAt(n, M);
      this.droneMesh.setColorAt(n, d.color);
      n++;
    }
    this.droneMesh.count = n;
    this.droneMesh.instanceMatrix.needsUpdate = true;
    if (this.droneMesh.instanceColor) this.droneMesh.instanceColor.needsUpdate = true;
  }
}
