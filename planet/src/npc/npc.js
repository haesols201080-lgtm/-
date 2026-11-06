// Living colony: walking colonists (A* on a navigation grid that respects
// buildings and prefers roads), logistics drones that visibly carry goods
// between buildings and hubs, and the colonist shuttle that lands at the HQ.
import * as THREE from 'three';
import { TIERS, ITEMS } from '../sim/data.js';
import { U } from '../core/shared.js';
import { GeoBuilder } from '../core/geobuilder.js';
import { colonistMesh } from './colonist.js';
import { droneGeometry, SHIP, ShipRig, shipDescent, shipAscent, elevatorAt } from './craft.js';
import { buildLandingZone, zoneBlocks, zoneColliders } from './landingzone.js';

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

    // drones: carbon and white quadcopter frame, cargo pod tinted by its load
    const dg = droneGeometry();
    const craftMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.25, clearcoat: 0.5, clearcoatRoughness: 0.25 });
    const im = (geo, n, tint) => { const m = new THREE.InstancedMesh(geo, craftMat, n); m.count = 0; m.castShadow = true; m.frustumCulled = false; if (tint) m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3).fill(1), 3); scene.add(m); return m; };
    this.droneMesh = im(dg.frame, 40, false);
    this.podMesh = im(dg.pod, 40, true);
    this.drones = [];

    // shuttle
    this.shuttle = this.makeShuttle();
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
  // The colony ship: a 50 m steel lander that comes in belly-first, flips
  // upright, lands on its engines at a pad near the HQ, lowers its cargo
  // elevator to let the colonists off and launches again.
  makeShuttle() {
    const rig = new ShipRig(this.game.engine.scene);
    return { rig, group: rig.group, zone: null, state: 'idle', t: 0 };
  }

  // a naturally flat, open spot 70-150 m from the HQ for the ship's pad
  shipSite(hq) {
    const S = this.shuttle, T = this.game.terrain, B = this.game.buildings.list;
    if (S.site && S.site.hq === hq.id) return S.site;
    let best = null;
    for (let r = 90; r <= 180 && !best; r += 10) {
      for (let k = 0; k < 24; k++) {
        const a = k / 24 * Math.PI * 2 + r * 0.37, x = hq.x + Math.cos(a) * r, z = hq.z + Math.sin(a) * r;
        let lo = Infinity, hi = -Infinity;
        for (let j = 0; j < 13; j++) {
          const rr = j ? 22 * (j > 6 ? 1 : 0.55) : 0, aa = j * 1.05;
          const h = T.height(x + Math.cos(aa) * rr, z + Math.sin(aa) * rr);
          lo = Math.min(lo, h); hi = Math.max(hi, h);
        }
        if (hi - lo > 2.2 || lo < U.uWaterLevel.value + 1) continue;
        if (B.some((b) => Math.hypot(b.x - x, b.z - z) < 50 + Math.hypot(b.hw, b.hd))) continue;
        const score = hi - lo + r * 0.004;
        if (!best || score < best.score) best = { x, z, y: hi + 0.05, score };
      }
    }
    if (!best) { const [x, z] = this.game.buildings.toWorld(hq, 0, -hq.hd - 60); best = { x, z, y: T.height(x, z) + 0.05 }; }
    best.hq = hq.id;
    best.rot = Math.atan2(hq.x - best.x, hq.z - best.z);   // apron and elevator face the HQ
    S.site = best;
    this.buildZone();
    return best;
  }

  // landing zone meshes, colliders, and clearing the ground under them
  buildZone() {
    const S = this.shuttle, s = S.site, g = this.game, C = g.colliders;
    if (S.zone) { g.engine.scene.remove(S.zone); S.zone.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
    S.zone = buildLandingZone(g, s, s.rot);
    g.engine.scene.add(S.zone);
    const c = Math.cos(s.rot), sn = Math.sin(s.rot);
    const W = (lx, lz) => [s.x + lx * c + lz * sn, s.z - lx * sn + lz * c];
    const gh = (lx, lz) => { const [x, z] = W(lx, lz); return g.terrain.height(x, z) - s.y; };
    C.removeOwner('zone');
    C.addCyl(s.x, s.z, 22.1, s.y - 4, s.y + 0.07, 'zone', {});
    const { cyl, box } = zoneColliders(gh);
    for (const [lx, lz, r, y0, y1] of cyl) { const [x, z] = W(lx, lz); C.addCyl(x, z, r, s.y + y0, s.y + y1, 'zone', { noStand: true }); }
    for (const [lx, lz, hx, hz, y0, y1] of box) { const [x, z] = W(lx, lz); C.addBox(x, z, hx, hz, s.rot, s.y + y0, s.y + y1, 'zone', {}); }
    g.props && g.props.clearArea(s.x, s.z, 45);
    g.flora && g.flora.invalidate();
  }

  padBlocks(x, z, r = 0) {
    const s = this.shuttle && this.shuttle.site;
    if (!s || (x - s.x) ** 2 + (z - s.z) ** 2 > 3025) return false;
    const c = Math.cos(s.rot), sn = Math.sin(s.rot), dx = x - s.x, dz = z - s.z;
    return zoneBlocks(dx * c - dz * sn, dx * sn + dz * c, r);
  }

  land(hq, n) {
    const S = this.shuttle;
    const site = this.shipSite(hq);
    // the parked ship launches for home first, the new one lands after it
    if (S.state === 'landed' && S.spawned && S.t > 30) {
      S.state = 'ascend'; S.t = 0; S.queue = n;
      this.game.colliders.removeOwner('ship');
      this.game.audio && this.game.audio.play('shuttle');
      return;
    }
    if (S.state !== 'idle') { this.game.colony.arrive(n); return; }
    // elevator side faces the HQ
    S.rot = site.rot;
    S.from = Math.random() * Math.PI * 2;
    S.n = n; S.state = 'descend'; S.t = 0; S.spawned = false;
    S.group.visible = true;
    this.game.audio && this.game.audio.play('shuttle');
  }

  shipState() { const S = this.shuttle; return { parked: S.state === 'landed' || S.state === 'descend' }; }
  restoreShip(d) { if (d && d.parked) this.shuttle.restoreParked = true; }

  // hand over passengers still aboard (used before saving)
  flushShip() {
    const S = this.shuttle;
    if (S.state !== 'idle' && !S.spawned && S.n) { S.spawned = true; this.game.colony.arrive(S.n); }
  }

  updateShuttle(dt) {
    const S = this.shuttle;
    // the pad is laid out as soon as there is an HQ
    if (!S.site && (S.siteT = (S.siteT || 0) - dt) <= 0) {
      S.siteT = 2;
      const hq = this.game.buildings.list.find((b) => b.type === 'hq');
      if (hq) this.shipSite(hq);
    }
    if (S.restoreParked && S.site) {
      S.restoreParked = false;
      S.state = 'landed'; S.t = 60; S.spawned = true; S.rot = S.site.rot; S.from = 0; S.group.visible = true;
      this.addShipColliders();
    }
    if (S.state === 'idle') return;
    S.t += dt;
    const site = S.site;
    let p = { elev: 0 };
    if (S.state === 'descend') {
      p = shipDescent(S.t);
      if (p.done) { S.state = 'landed'; S.t = 0; this.addShipColliders(); }
    } else if (S.state === 'landed') {
      // elevator: down (4-13 s), colonists step off, back up (20-29 s); the
      // ship then stays parked, refuelling from the propellant farm, until
      // the next ship is inbound
      p.elev = elevatorAt(S.t);
      if (S.t >= 13 && !S.spawned) {
        S.spawned = true;
        const placed = this.game.colony.arrive(S.n);
        const [fx, fz] = ShipRig.toWorld(site, S.rot, 0, SHIP.R + 3.6);
        for (let i = 0; i < Math.min(placed, 6); i++) this.spawnArrival({ x: fx, z: fz }, i);
        if (placed) this.game.ui && this.game.ui.toast('이주선이 정착민 ' + placed + '명을 데려왔습니다', 'good', 3);
      }
    } else if (S.state === 'ascend') {
      // lift-off on all six engines, gravity turn after the tower is cleared
      p = shipAscent(S.t);
      if (p.done) {
        if (S.queue) { const n = S.queue; S.queue = 0; S.from = Math.random() * Math.PI * 2; S.n = n; S.state = 'descend'; S.t = 0; S.spawned = false; }
        else { S.state = 'idle'; S.group.visible = false; S.rig.dust.visible = false; return; }
      }
    }
    S.rig.pose(site, S.rot, S.from, p, S.t, S.state === 'ascend' ? S.t * 6 : 0);
  }

  addShipColliders() {
    const S = this.shuttle, C = this.game.colliders, s = S.site;
    C.removeOwner('ship');
    C.addCyl(s.x, s.z, SHIP.R + 0.1, s.y, s.y + SHIP.H, 'ship', {});
    for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + Math.PI / 6 - S.rot; C.addCyl(s.x + Math.cos(a) * 5.6, s.z + Math.sin(a) * 5.6, 0.65, s.y - 1, s.y + 0.35, 'ship', {}); }
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
    const SKIN = [0xf6dcc8, 0xf3d5bf, 0xecc7a8, 0xe8bf9c, 0xdcae88, 0xd6a07a, 0xc48c64, 0xb97f57, 0xa36e4a, 0x93603e, 0x7d5034, 0x6e4529, 0x5a3a24, 0x4f3020];
    const HAIR = [0x16110e, 0x221812, 0x2b1e16, 0x3a2719, 0x4a3222, 0x5e3d25, 0x6e4a2c, 0x8a5a30, 0x9a6a3a, 0xb8894e, 0xc9a46a, 0x7a2e1a, 0x93401f, 0x6f6c69, 0xa9a6a2];
    const TOPS = [0xeeeeea, 0xd8dade, 0x5d6b7a, 0x2f3d52, 0x6f7a55, 0xc9b48f, 0x3f6f73, 0x8a4d3c, 0x9aa3ad, 0x3b3f45, 0xa8826a, 0x4d5a3a];
    const PANTS = [0x3a3d42, 0x2d3440, 0x4a3f36, 0x56595e, 0x23262b, 0x5a5446, 0x2e3a33, 0x3d3a36, 0x26303d, 0x4b4f45, 0x6b6156, 0x1f2228];
    const style = fem ? pick([1, 1, 2, 3, 7, 7, 10, 11, 11, 12, 5, 8, 6]) : pick([0, 0, 4, 4, 9, 9, 6, 13, 5, 8, 10, 1]);
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
      this.podMesh.setMatrixAt(n, M);
      this.podMesh.setColorAt(n, d.color);
      n++;
    }
    for (const m of [this.droneMesh, this.podMesh]) { m.count = n; m.instanceMatrix.needsUpdate = true; }
    this.podMesh.instanceColor.needsUpdate = true;
  }
}
