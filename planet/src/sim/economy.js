// Economy: player inventory, the colony logistics network (shared storage
// reachable by drones inside hub/HQ radius), the power grid (auto-linked
// pylons with visible sagging cables) and every production building's cycle.
import * as THREE from 'three';
import { BUILDINGS, RECIPES, ITEMS } from './data.js';
import { U } from '../core/shared.js';

export class Inventory {
  constructor(slots = 32, stack = 50) {
    this.slots = slots;
    this.stack = stack;
    this.items = new Map();
  }
  count(id) { return this.items.get(id) || 0; }
  usedSlots() { let n = 0; for (const v of this.items.values()) n += Math.ceil(v / this.stack); return n; }
  space(id) {
    const have = this.count(id);
    const free = (this.slots - this.usedSlots()) * this.stack + (have % this.stack ? this.stack - (have % this.stack) : 0);
    return Math.max(0, free);
  }
  add(id, n) {
    const k = Math.min(n, this.space(id));
    if (k > 0) this.items.set(id, this.count(id) + k);
    return k;
  }
  remove(id, n) {
    const have = this.count(id);
    const k = Math.min(have, n);
    if (have - k <= 0) this.items.delete(id); else this.items.set(id, have - k);
    return k;
  }
  toJSON() { return Object.fromEntries(this.items); }
  load(o) { this.items = new Map(Object.entries(o || {}).map(([k, v]) => [k, +v])); }
}

export class Store {
  constructor() { this.items = new Map(); this.cap = 0; }
  count(id) { return this.items.get(id) || 0; }
  total() { let n = 0; for (const v of this.items.values()) n += v; return n; }
  free() { return Math.max(0, this.cap - this.total()); }
  add(id, n) { const k = Math.min(n, this.free()); if (k > 0) this.items.set(id, this.count(id) + k); return k; }
  remove(id, n) { const have = this.count(id); const k = Math.min(have, n); if (have - k <= 0) this.items.delete(id); else this.items.set(id, have - k); return k; }
  toJSON() { return Object.fromEntries(this.items); }
  load(o) { this.items = new Map(Object.entries(o || {}).map(([k, v]) => [k, +v])); }
}

const NODE_RANGE = { pylon: 30, hq: 36, solar: 16, wind: 18, reactor: 24, dronehub: 20 };
const CONSUMER_RANGE = 16;

export class Economy {
  constructor(game) {
    this.game = game;
    this.inv = new Inventory(32, 50);
    this.store = new Store();
    this.power = { supply: 0, demand: 0 };
    this.cableMat = new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.6, metalness: 0.4 });
    this.cables = null;
    this.gridDirty = true;
    this.t = 0;
    this.produced = new Map();
  }

  // ---------------------------------------------------------------- costs
  costOf(type) {
    const c = { ...BUILDINGS[type].cost };
    return c;
  }

  // network storage is usable when both the player and the site are inside the network
  netAccess(pos) {
    if (!pos) return false;
    return this.inNetwork(pos.x, pos.z) && this.inNetwork(this.game.player.pos.x, this.game.player.pos.z);
  }

  canAfford(cost, pos) {
    const net = this.netAccess(pos);
    for (const [id, n] of Object.entries(cost)) {
      if (id === 'credits') { if ((this.game.colony?.credits || 0) < n) return false; continue; }
      if (this.inv.count(id) + (net ? this.store.count(id) : 0) < n) return false;
    }
    return true;
  }

  missingText(cost, pos) {
    const net = this.netAccess(pos);
    const out = [];
    for (const [id, n] of Object.entries(cost)) {
      const have = id === 'credits' ? (this.game.colony?.credits || 0) : this.inv.count(id) + (net ? this.store.count(id) : 0);
      if (have < n) out.push((id === 'credits' ? '크레딧' : ITEMS[id].name) + ' ' + Math.floor(have) + '/' + n);
    }
    return out.join(', ');
  }

  pay(cost, pos) {
    const net = this.netAccess(pos);
    for (const [id, n] of Object.entries(cost)) {
      if (id === 'credits') { this.game.colony.credits -= n; continue; }
      let left = n - this.inv.remove(id, n);
      if (left > 0 && net) this.store.remove(id, left);
    }
    this.game.ui && this.game.ui.dirty();
  }

  refund(type, b) {
    const cost = this.costOf(type);
    for (const [id, n] of Object.entries(cost)) {
      if (id === 'credits') { this.game.colony.credits += Math.floor(n * 0.5); continue; }
      let left = n - this.inv.add(id, n);
      if (left > 0 && this.inNetwork(b.x, b.z)) left -= this.store.add(id, left);
      if (left > 0) this.game.ui && this.game.ui.toast(ITEMS[id].name + ' ' + left + '개는 가방이 가득 차 버려졌습니다', 'warn');
    }
  }

  give(id, n) {
    const k = this.inv.add(id, n);
    if (k < n && this.netAccess(this.game.player.pos)) this.store.add(id, n - k);
    this.game.ui && this.game.ui.dirty();
    return k;
  }

  // ---------------------------------------------------------------- network
  hubs() { return this.game.buildings.list.filter((b) => b.def.network && b.lit > 0.4); }

  inNetwork(x, z) {
    for (const h of this.game.buildings.list) {
      if (!h.def.network) continue;
      if (h.type === 'dronehub' && h.powered === false) continue;
      if ((h.x - x) ** 2 + (h.z - z) ** 2 < h.def.network * h.def.network) return h;
    }
    return null;
  }

  // ---------------------------------------------------------------- power grid
  rebuildGrid() {
    this.gridDirty = false;
    const list = this.game.buildings.list;
    const nodes = list.filter((b) => NODE_RANGE[b.type] || (b.def.power > 0));
    const parent = new Map();
    const find = (a) => { while (parent.get(a) !== a) { parent.set(a, parent.get(parent.get(a))); a = parent.get(a); } return a; };
    const union = (a, b) => { parent.set(find(a), find(b)); };
    for (const n of nodes) parent.set(n, n);
    const links = [];
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      const r = Math.max(NODE_RANGE[a.type] || 14, NODE_RANGE[b.type] || 14);
      const d = Math.hypot(a.x - b.x, a.z - b.z);
      if (d <= r) { union(a, b); if (a.type === 'pylon' || b.type === 'pylon' || d > 6) links.push([a, b]); }
    }
    for (const b of list) {
      b.gridRoot = null;
      if (parent.has(b)) { b.gridRoot = find(b); continue; }
      if (!(b.def.power < 0) && !b.def.house && !b.def.workers) continue;
      let best = null, bd = Infinity;
      for (const n of nodes) {
        const d = Math.hypot(n.x - b.x, n.z - b.z);
        const r = (NODE_RANGE[n.type] || 14) + Math.max(b.hw, b.hd);
        if (d <= r && d < bd) { bd = d; best = n; }
      }
      if (best) { b.gridRoot = find(best); if (best.type === 'pylon' || bd > 8) links.push([best, b]); }
    }
    this.buildCables(links);
  }

  buildCables(links) {
    if (this.cables) { this.game.engine.scene.remove(this.cables); this.cables.geometry.dispose(); }
    const pos = [], idx = [];
    const top = (b) => {
      if (b.type === 'pylon') return [b.x, b.y + 9.1, b.z];
      const h = Math.min(b.model.height, 6);
      return [b.x, b.y + Math.max(1.5, h * 0.7), b.z];
    };
    for (const [a, b] of links) {
      const p0 = top(a), p1 = top(b);
      const len = Math.hypot(p1[0] - p0[0], p1[2] - p0[2]);
      const sag = Math.min(2.5, len * 0.06);
      const segs = 10, rad = 0.035;
      const base = pos.length / 3;
      for (let i = 0; i <= segs; i++) {
        const t = i / segs;
        const x = p0[0] + (p1[0] - p0[0]) * t, z = p0[2] + (p1[2] - p0[2]) * t;
        const y = p0[1] + (p1[1] - p0[1]) * t - sag * 4 * t * (1 - t);
        // flat ribbon cross-section (two quads) — cheap and readable at distance
        pos.push(x, y + rad, z, x, y - rad, z, x + rad, y, z + rad * 0.3, x - rad, y, z - rad * 0.3);
      }
      for (let i = 0; i < segs; i++) {
        const a0 = base + i * 4, b0 = a0 + 4;
        idx.push(a0, b0, a0 + 1, a0 + 1, b0, b0 + 1, a0 + 2, b0 + 2, a0 + 3, a0 + 3, b0 + 2, b0 + 3);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, this.cableMat);
    this.cableMat.side = THREE.DoubleSide;
    m.frustumCulled = false;
    this.game.engine.scene.add(m);
    this.cables = m;
  }

  // ---------------------------------------------------------------- tick
  generatorOutput(b) {
    const d = b.def;
    if (!(d.power > 0)) return 0;
    if (d.solar) {
      const e = U.uSunDir.value.y;
      const sky = this.game.sky;
      return d.power * Math.max(0, Math.min(1, e * 1.8 + 0.1)) * sky.sunVis * (1 - sky.uniforms.uStorm.value * 0.6) * (1 - sky.uniforms.uDust.value * 0.25);
    }
    if (d.wind) return d.power * (0.25 + 0.75 * this.game.sky.uniforms.uAtmo.value) * (0.75 + 0.25 * Math.sin(U.uTime.value * 0.1 + b.seed * 10));
    if (d.fuel) return b.data.fuelLeft > 0 ? d.power : 0;
    return d.power;
  }

  tick(dt) {
    const g = this.game;
    const list = g.buildings.list;
    if (this.gridDirty) this.rebuildGrid();
    // storage capacity
    let cap = 0;
    for (const b of list) if (b.def.depot) cap += b.def.depot;
    this.store.cap = cap;

    // fuel for reactors
    for (const b of list) {
      if (!b.def.fuel) continue;
      b.data.fuelLeft = (b.data.fuelLeft || 0) - dt;
      if (b.data.fuelLeft <= 0 && this.inNetwork(b.x, b.z) && this.store.remove(b.def.fuel, 1)) b.data.fuelLeft = b.def.fuelTime;
    }
    // power per grid component
    const comps = new Map();
    for (const b of list) {
      const root = b.gridRoot;
      if (!root) continue;
      let c = comps.get(root);
      if (!c) { c = { supply: 0, demand: 0 }; comps.set(root, c); }
      c.supply += this.generatorOutput(b);
      if (b.def.power < 0 && b.enabled !== false) c.demand += -b.def.power * (b.idle ? 0.15 : 1);
    }
    let S = 0, D = 0;
    for (const c of comps.values()) { c.ratio = c.demand > 0 ? Math.min(1, c.supply / c.demand) : 1; S += c.supply; D += c.demand; }
    this.power.supply = S; this.power.demand = D;
    for (const b of list) {
      const c = b.gridRoot ? comps.get(b.gridRoot) : null;
      if (b.def.power < 0) b.powerRatio = c ? c.ratio : 0;
      else b.powerRatio = 1;
      b.powered = b.def.power < 0 ? b.powerRatio > 0.05 : true;
      b.gridSupply = c ? c.supply : 0;
    }

    // production
    for (const b of list) this.produce(b, dt);
  }

  workFactor(b) {
    if (!b.def.workers) return 1;
    return this.game.colony ? this.game.colony.staffing(b) : 0;
  }

  produce(b, dt) {
    const d = b.def, g = this.game;
    const net = this.inNetwork(b.x, b.z);
    b.networked = !!net;
    let rate = (d.power < 0 ? b.powerRatio : 1) * this.workFactor(b);
    if (b.enabled === false) rate = 0;
    b.rate = rate;
    let active = rate > 0.05;
    b.status = '';
    if (d.power < 0 && b.powerRatio < 0.05) b.status = '전력 없음';
    else if (d.workers && this.workFactor(b) < 0.05) b.status = '일손 부족';

    if (d.deposit) {
      b.data.t = (b.data.t || 0) + dt * rate;
      b.data.buf = b.data.buf || 0;
      if (b.data.t >= 6) {
        b.data.t -= 6;
        if (net && this.store.free() > 0) { this.store.add(b.data.ore, 1); g.drones && g.drones.carry(b, net, b.data.ore); }
        else if (b.data.buf < d.buffer) b.data.buf++;
        else { b.status = '저장 공간 가득'; }
        this.produced.set(b.data.ore, (this.produced.get(b.data.ore) || 0) + 1);
      }
      if (net && b.data.buf > 0) { const k = this.store.add(b.data.ore, b.data.buf); b.data.buf -= k; }
    } else if (d.factory || d.recipe || d.produce) {
      let rec;
      if (d.recipe) rec = RECIPES.find((r) => r.id === d.recipe);
      else if (d.factory) {
        const id = b.data.recipe || d.factory[0];
        rec = RECIPES.find((r) => r.id === id);
      } else rec = { in: d.consume || {}, out: d.produce, time: d.cycle };
      if (d.pump && this.nearWater(b)) rec = { in: {}, out: { water: 3 }, time: d.cycle };
      if (!net) { active = false; b.status = b.status || '물류망 밖 (드론 허브 필요)'; }
      else if (!rec) active = false;
      else if (!b.data.busy) {
        // try to start a cycle
        let ok = true;
        for (const [id, n] of Object.entries(rec.in)) if (this.store.count(id) < n) ok = false;
        if (ok && this.store.free() >= Object.values(rec.out).reduce((a, c) => a + c, 0)) {
          for (const [id, n] of Object.entries(rec.in)) this.store.remove(id, n);
          b.data.busy = true; b.data.t = 0;
          if (Object.keys(rec.in).length) g.drones && g.drones.carry(net, b, Object.keys(rec.in)[0]);
        } else { active = false; b.status = b.status || (ok ? '저장 공간 가득' : '재료 대기'); }
      }
      if (b.data.busy && rec) {
        b.data.t += dt * rate;
        if (b.data.t >= rec.time) {
          b.data.busy = false;
          for (const [id, n] of Object.entries(rec.out)) { this.store.add(id, n); this.produced.set(id, (this.produced.get(id) || 0) + n); }
          g.drones && g.drones.carry(b, net, Object.keys(rec.out)[0]);
        }
      }
    }
    if (d.research_rp && g.research) g.research.addPoints(d.research_rp * rate * dt, b);
    if (d.terra && g.terra) for (const [k, v] of Object.entries(d.terra)) g.terra.add(k, v * rate * dt);
    if (d.power > 0) active = this.generatorOutput(b) > 0.05;
    if (d.house) active = true;
    b.idle = !active;
    const lit = (d.power < 0 ? (b.powerRatio > 0.05 ? 1 : 0) : 1) * (d.workers && this.workFactor(b) < 0.05 ? 0.2 : 1);
    g.buildings.setState(b, lit, active ? Math.max(0.2, rate) : 0);
  }

  nearWater(b) {
    if (U.uIce.value > 0.5) return false;
    const L = U.uWaterLevel.value, T = this.game.terrain;
    for (let a = 0; a < 8; a++) {
      const x = b.x + Math.cos(a) * 9, z = b.z + Math.sin(a) * 9;
      if (T.height(x, z) < L - 0.3) return true;
    }
    return false;
  }

  serialize() { return { inv: this.inv.toJSON(), store: this.store.toJSON() }; }
  load(o) { this.inv.load(o.inv); this.store.load(o.store); }
}
