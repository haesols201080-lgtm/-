// Colony (Anno 1800-style): houses fill up as their tier's basic needs are
// met, residents form the workforce that staffs colony buildings, luxury
// needs raise happiness and taxes, and houses upgrade to the next tier when
// all basic needs are met, the house is full, the tier is researched and the
// upgrade materials are in storage. New colonists arrive by shuttle at the
// HQ landing pad. Eras advance like Civilization: Outpost -> Settlement ->
// Town -> City -> Civilization.
import { TIERS, ERAS, BUILDINGS, NEED_NAMES, ITEMS } from './data.js';

const GOOD_NEEDS = { water: 0.06, food: 0.05, goods: 0.03, electronics: 0.015 }; // per resident per minute

export class Colony {
  constructor(game) {
    this.game = game;
    this.credits = 0;
    this.era = 1;
    this.t = 0;
    this.shuttleT = 30;
    this.happiness = 0.5;
    this.income = 0;
    this.pop = [0, 0, 0, 0];
    this.workforce = [0, 0, 0, 0];
    this.demand = [0, 0, 0, 0];
    this.lack = {};
    this.consumeAcc = {};
    this.autoUpgrade = true;
    this.arrivals = 0;
  }

  get total() { return this.pop.reduce((a, b) => a + b, 0); }

  staffing(b) { return b.staff ?? 0; }

  tierIndex(id) { return TIERS.findIndex((t) => t.id === id); }

  tick(dt) {
    this.t += dt;
    this.shuttleT -= dt;
    if (this.t < 2) return;
    const step = this.t;
    this.t = 0;
    const g = this.game, eco = g.eco;
    const B = g.buildings.list;
    const houses = B.filter((b) => b.def.house);
    const hq = B.find((b) => b.type === 'hq');

    // service coverage
    const services = {};
    for (const b of B) {
      if (!b.def.service) continue;
      const ok = (b.def.power < 0 ? b.powerRatio > 0.3 : true) && (!b.def.workers || this.staffing(b) > 0.45);
      b.serviceOk = ok;
      if (!ok) continue;
      (services[b.def.service] = services[b.def.service] || []).push(b);
    }
    const covered = (h, svc) => (services[svc] || []).some((s) => (s.x - h.x) ** 2 + (s.z - h.z) ** 2 < s.def.radius * s.def.radius);

    // totals per need for consumption
    const pop = [0, 0, 0, 0];
    const needTotals = {};
    let happySum = 0, resSum = 0;
    for (const h of houses) {
      const tier = TIERS[h.tier];
      h.data.res = h.data.res ?? 0;
      const met = {};
      const market = covered(h, 'market');
      for (const need of [...tier.basic, ...tier.luxury]) {
        if (need === 'power') met[need] = !!h.gridRoot && h.gridSupply > 0.01;
        else if (GOOD_NEEDS[need] !== undefined) met[need] = market && !this.lack[need] && hq != null;
        else met[need] = covered(h, need);
      }
      h.data.met = met;
      const nb = tier.basic.filter((n) => met[n]).length;
      const frac = nb / tier.basic.length;
      h.data.target = Math.floor(tier.base + (tier.max - tier.base) * frac);
      if (frac >= 1) h.data.target = tier.max;
      const lux = tier.luxury.length ? tier.luxury.filter((n) => met[n]).length / tier.luxury.length : 0;
      h.data.happy = 0.35 + 0.45 * frac + 0.2 * lux + (g.buildings.count('monument') ? 0.1 : 0) + (g.terra.breathable ? 0.05 : 0);
      if (h.data.res > h.data.target) h.data.res = Math.max(h.data.target, h.data.res - 1);
      pop[h.tier] += h.data.res;
      for (const need of tier.basic) if (GOOD_NEEDS[need] !== undefined && market) needTotals[need] = (needTotals[need] || 0) + h.data.res;
      happySum += h.data.happy * h.data.res; resSum += h.data.res;
    }
    this.pop = pop;
    this.happiness = resSum ? happySum / resSum : 0.5;

    // consume goods from storage
    for (const [need, residents] of Object.entries(needTotals)) {
      this.consumeAcc[need] = (this.consumeAcc[need] || 0) + residents * GOOD_NEEDS[need] * step / 60;
      const whole = Math.floor(this.consumeAcc[need]);
      if (whole > 0) {
        const got = eco.store.remove(need, whole);
        this.consumeAcc[need] -= whole;
        this.lack[need] = got < whole;
      } else if (eco.store.count(need) <= 0 && residents > 0 && this.consumeAcc[need] > 0.5) this.lack[need] = true;
      else if (eco.store.count(need) > 0) this.lack[need] = false;
    }

    // workforce & staffing (Anno: each building needs workers of a tier)
    this.workforce = pop.slice();
    const avail = pop.slice();
    const demand = [0, 0, 0, 0];
    const workplaces = B.filter((b) => b.def.workers).sort((a, b) => a.id - b.id);
    for (const b of workplaces) {
      const [tierId, n] = b.def.workers;
      const ti = this.tierIndex(tierId);
      demand[ti] += n;
      // higher tiers can fill lower-tier jobs if needed
      let need = n, got = 0;
      for (let k = ti; k < 4 && need > 0; k++) { const take = Math.min(need, avail[k]); avail[k] -= take; need -= take; got += take; }
      b.staff = b.enabled === false ? 0 : got / n;
      b.workersHave = got;
    }
    this.demand = demand;
    this.unemployed = avail;

    // credits: taxes minus upkeep
    let income = 0;
    for (const h of houses) income += h.data.res * TIERS[h.tier].tax * (0.6 + 0.8 * h.data.happy);
    let upkeep = 0;
    for (const b of B) if (b.def.cat === 'colony' && !b.def.house && b.type !== 'road') upkeep += b.type === 'hq' ? 0 : 1.2;
    this.income = income - upkeep;
    if (hq) this.credits = Math.max(0, this.credits + this.income * step / 60);

    // shuttles bring colonists to free homes
    if (hq && this.shuttleT <= 0) {
      this.shuttleT = 45;
      let free = 0;
      for (const h of houses) free += Math.max(0, h.data.target - h.data.res);
      const n = Math.min(8, free);
      if (n > 0) g.shuttle ? g.shuttle.land(hq, n) : this.arrive(n);
    }

    // house upgrades
    if (this.autoUpgrade) for (const h of houses) this.tryUpgrade(h);

    this.checkEra();
  }

  // colonists step off the shuttle into homes with room
  arrive(n) {
    const houses = this.game.buildings.list.filter((b) => b.def.house).sort((a, b) => (b.data.target - b.data.res) - (a.data.target - a.data.res));
    let placed = 0;
    for (const h of houses) {
      while (n > 0 && h.data.res < (h.data.target ?? 0)) { h.data.res++; n--; placed++; }
    }
    this.arrivals += placed;
    return placed;
  }

  canUpgrade(h) {
    const next = TIERS[h.tier + 1];
    if (!next) return { ok: false, reason: '최고 계층' };
    const tier = TIERS[h.tier];
    if (!h.data.met || !tier.basic.every((n) => h.data.met[n])) return { ok: false, reason: '기본 필요가 모두 채워져야 합니다' };
    if (h.data.res < tier.max) return { ok: false, reason: '집이 가득 차야 합니다' };
    if (next.upgrade.research && !this.game.research.has(next.upgrade.research)) return { ok: false, reason: '연구 필요: ' + this.game.research.name(next.upgrade.research) };
    const cost = next.upgrade.cost;
    for (const [id, n] of Object.entries(cost)) {
      if (id === 'credits') { if (this.credits < n) return { ok: false, reason: '크레딧 ' + n + ' 필요' }; }
      else if (this.game.eco.store.count(id) < n) return { ok: false, reason: '창고에 ' + ITEMS[id].name + ' ' + n + '개 필요' };
    }
    return { ok: true };
  }

  tryUpgrade(h) {
    if (!this.canUpgrade(h).ok) return false;
    const next = TIERS[h.tier + 1];
    for (const [id, n] of Object.entries(next.upgrade.cost)) {
      if (id === 'credits') this.credits -= n; else this.game.eco.store.remove(id, n);
    }
    this.game.buildings.setTier(h, h.tier + 1);
    h.data.res = TIERS[h.tier].base;
    this.game.fx && this.game.fx.build(h.x, h.y, h.z, 8);
    this.game.ui && this.game.ui.toast('주거지가 ' + next.name + ' 계층으로 업그레이드되었습니다', 'good', 3);
    return true;
  }

  checkEra() {
    const next = ERAS[this.era];
    if (!next) return;
    const r = next.req;
    const g = this.game;
    if (r.building && !g.buildings.count(r.building)) return;
    if (r.pop && this.total < r.pop) return;
    if (r.tier && this.pop[this.tierIndex(r.tier[0])] < r.tier[1]) return;
    this.era++;
    g.onEra && g.onEra(this.era, next);
  }

  needReport(h) {
    const tier = TIERS[h.tier];
    return {
      basic: tier.basic.map((n) => ({ id: n, name: NEED_NAMES[n], ok: !!(h.data.met && h.data.met[n]) })),
      luxury: tier.luxury.map((n) => ({ id: n, name: NEED_NAMES[n], ok: !!(h.data.met && h.data.met[n]) })),
    };
  }

  serialize() { return { credits: this.credits, era: this.era, shuttleT: this.shuttleT, arrivals: this.arrivals, autoUpgrade: this.autoUpgrade }; }
  load(o) { Object.assign(this, o || {}); }
}

export { GOOD_NEEDS };
