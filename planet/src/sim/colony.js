// Colony (Anno 1800-style): houses fill up as their tier's basic needs are
// met, residents form the workforce that staffs colony buildings, luxury
// needs raise happiness and taxes, and houses upgrade to the next tier when
// all basic needs are met, the house is full, the tier is researched and the
// upgrade materials are in storage. New colonists arrive by shuttle at the
// HQ landing pad. Eras advance like Civilization, from the lone outpost to a
// second home run by people born on Arke.
import { TIERS, ERAS, BUILDINGS, NEED_NAMES, ITEMS, STAGES, WAVES, SHIPS } from './data.js';

const GOOD_NEEDS = { water: 0.06, food: 0.05, goods: 0.03, textiles: 0.025, electronics: 0.015, medicine: 0.012, delicacy: 0.02 }; // per resident per minute
const zeros = () => TIERS.map(() => 0);
// schools teach the children of settler families and up, the university takes
// young adults from engineer homes and up; each turns out graduates on a cycle
const EDU = {
  school: { from: 1, share: 0.25, cap: 40, cycle: 60, rate: 0.2, yields: 'diploma' },
  university: { from: 4, share: 0.2, cap: 30, cycle: 90, rate: 0.25, yields: 'degree' },
};
const EDU_NAMES = { diploma: '학교 수료생', degree: '대학 졸업생' };
// credits per unit the orbital elevator gets for exports
const PRICE = { plate: 2, glass: 2, wire: 2, water: 1, food: 2, seeds: 2, alloy: 4, lightalloy: 4, circuit: 4, fertilizer: 3, textiles: 4, goods: 5, electronics: 7, battery: 6, medicine: 7, delicacy: 6, fuelrod: 8 };

export class Colony {
  constructor(game) {
    this.game = game;
    this.credits = 0;
    this.era = 1;
    this.t = 0;
    this.shuttleT = 30;
    this.happiness = 0.5;
    this.income = 0;
    this.pop = zeros();
    this.sick = zeros();
    this.edu = { diploma: 0, degree: 0 };   // graduates waiting for jobs that need them
    this.productivity = 1;
    this.fitness = 0;
    this.workforce = zeros();
    this.demand = zeros();
    this.lack = {};
    this.consumeAcc = {};
    this.autoUpgrade = true;
    this.arrivals = 0;
    this.calls = [];          // invitations in flight
    this.callCooldown = 0;
    this.log = [];            // transmission / reply log for the comms panel
  }

  // ---------------------------------------------------------------- invitations (comms)
  freeHousing() {
    let free = 0;
    for (const h of this.game.buildings.list) if (h.def.house) free += Math.max(0, (h.data.target ?? 0) - (h.data.res ?? 0));
    for (const c of this.calls) free -= c.n;
    return Math.max(0, free);
  }

  waveSize() {
    const st = this.game.terra.stage;
    let n = 0;
    for (const [id, k] of Object.entries(WAVES)) if (st >= STAGES.findIndex((s) => s.id === id)) n = k;
    // culture draws people (+25% a centre, up to +50%); the elevator brings them down in bulk
    const B = this.game.buildings.list;
    const culture = B.filter((b) => b.type === 'culture' && b.serviceOk).length;
    const lift = B.some((b) => b.type === 'elevator' && b.powerRatio > 0.3);
    return Math.round(n * (1 + 0.25 * Math.min(2, culture)) * (lift ? 1.5 : 1));
  }

  callStatus() {
    const g = this.game;
    const comms = g.buildings.list.find((b) => b.def.comms);
    if (!comms) return { ok: false, reason: '심우주 교신기가 없습니다' };
    if (comms.powerRatio < 0.3) return { ok: false, reason: '교신기에 전력이 부족합니다' };
    if (!g.buildings.list.some((b) => b.type === 'hq')) return { ok: false, reason: '이주선을 맞을 식민 본부가 필요합니다' };
    const need = STAGES.findIndex((s) => s.id === 'clouds');
    if (g.terra.stage < need) return { ok: false, reason: '아직 아무도 오려 하지 않습니다 — 구름 단계까지 테라포밍하세요' };
    if (this.calls.length) return { ok: false, reason: '응답을 기다리는 중입니다' };
    if (this.callCooldown > 0) return { ok: false, reason: `송신기 재충전 중 (${Math.ceil(this.callCooldown)}초)` };
    const free = this.freeHousing();
    if (free <= 0) return { ok: false, reason: '맞이할 빈 집이 없습니다 — 주거지를 짓고 필요를 채우세요' };
    return { ok: true, n: Math.min(this.waveSize(), free) };
  }

  sendCall() {
    const st = this.callStatus();
    if (!st.ok) return st;
    const ship = SHIPS[(this.arrivals + this.log.length) % SHIPS.length];
    this.calls.push({ t: 0, n: st.n, ship, phase: 'sent' });
    this.callCooldown = 150;
    this.log.unshift({ kind: 'out', text: `정착민 ${st.n}명 초청 송신 — 행성 상태: ${STAGES[this.game.terra.stage].name}` });
    return st;
  }

  tickCalls(dt) {
    this.callCooldown = Math.max(0, this.callCooldown - dt);
    const g = this.game;
    for (const c of this.calls) {
      c.t += dt;
      if (c.phase === 'sent' && c.t > 18) {
        c.phase = 'reply';
        const msg = `${c.ship} 응답: "아르케의 하늘을 보았습니다. ${c.n}명이 출발합니다."`;
        this.log.unshift({ kind: 'in', text: msg });
        g.ui && g.ui.toast('<b>교신 응답</b>' + msg, 'good', 6, true);
        g.audio && g.audio.play('done');
      }
      if (c.phase === 'reply' && c.t > 48) {
        c.phase = 'done';
        const hq = g.buildings.list.find((b) => b.type === 'hq');
        if (hq) g.shuttle ? g.shuttle.land(hq, c.n) : this.arrive(c.n);
      }
    }
    this.calls = this.calls.filter((c) => c.phase !== 'done');
    if (this.log.length > 12) this.log.length = 12;
  }

  get total() { return this.pop.reduce((a, b) => a + b, 0); }

  staffing(b) { return b.staff ?? 0; }

  tierIndex(id) { return TIERS.findIndex((t) => t.id === id); }
  popOf(id) { return this.pop[this.tierIndex(id)] || 0; }

  tick(dt) {
    this.t += dt;
    this.tickCalls(dt);
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
    const near = (a, b, r) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2 < r * r;
    // tram network: with two or more stops, a home near any stop reaches any
    // service near any stop
    const stops = services.transit || [];
    const onNet = (p) => stops.length > 1 && stops.some((s) => near(p, s, s.def.radius));
    const reach = (h, s) => near(s, h, s.def.radius) || (onNet(h) && onNet(s));
    const covered = (h, svc) => (services[svc] || []).some((s) => reach(h, s));

    // totals per need for consumption
    const pop = zeros(), sick = zeros();
    const needTotals = {};
    let happySum = 0, resSum = 0, fitRes = 0;
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
      // illness: without a clinic many residents are laid up; a gym halves the risk
      const fit = covered(h, 'gym');
      h.data.sick = Math.round(h.data.res * (covered(h, 'clinic') ? 0.03 : 0.16) * (fit ? 0.5 : 1));
      pop[h.tier] += h.data.res;
      sick[h.tier] += h.data.sick;
      if (fit) fitRes += h.data.res;
      for (const need of tier.basic) if (GOOD_NEEDS[need] !== undefined && market) needTotals[need] = (needTotals[need] || 0) + h.data.res;
      happySum += h.data.happy * h.data.res; resSum += h.data.res;
    }
    this.pop = pop;
    this.sick = sick;
    this.happiness = resSum ? happySum / resSum : 0.5;
    this.fitness = resSum ? fitRes / resSum : 0;
    // happy, fit people work faster
    this.productivity = (0.85 + 0.3 * this.happiness) * (1 + 0.08 * this.fitness);

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

    // workforce & staffing (Anno: each building needs workers of a tier); the sick stay home
    this.workforce = pop.map((n, i) => n - sick[i]);
    const avail = this.workforce.slice();
    const demand = zeros();
    const workplaces = B.filter((b) => b.def.workers).sort((a, b) => a.id - b.id);
    for (const b of workplaces) {
      const [tierId, n] = b.def.workers;
      const ti = this.tierIndex(tierId);
      demand[ti] += n;
      // higher tiers can fill lower-tier jobs if needed
      let need = n, got = 0;
      for (let k = ti; k < TIERS.length && need > 0; k++) { const take = Math.min(need, avail[k]); avail[k] -= take; need -= take; got += take; }
      b.staff = b.enabled === false ? 0 : got / n;
      b.workersHave = got;
    }
    this.demand = demand;
    this.unemployed = avail;

    // what goes on inside the service buildings
    const around = (b, f) => { let n = 0; for (const h of houses) if (reach(h, b)) n += f(h); return n; };
    for (const b of B) {
      const t = b.type, D = b.data;
      if (EDU[t]) {
        const E = EDU[t];
        if (!b.serviceOk) { D.students = 0; continue; }
        const pool = around(b, (h) => (h.tier >= E.from ? (h.data.res - (h.data.sick || 0)) * E.share : 0));
        D.students = Math.min(Math.floor(E.cap * Math.min(1, this.staffing(b)) * Math.min(1, b.powerRatio ?? 1)), Math.floor(pool));
        D.prog = (D.prog || 0) + step / E.cycle;
        if (D.prog >= 1) {
          D.prog -= 1;
          D.gacc = (D.gacc || 0) + D.students * E.rate;
          const n = Math.floor(D.gacc);
          D.gacc -= n;
          if (n > 0) { this.edu[E.yields] += n; D.grads = (D.grads || 0) + n; }
        }
        if (t === 'university' && g.research && D.students) g.research.addPoints(D.students * 0.012 * step);
      } else if (t === 'clinic') D.patients = b.serviceOk ? Math.round(around(b, (h) => h.data.res * 0.13)) : 0;
      else if (t === 'gym') D.users = b.serviceOk ? Math.round(around(b, (h) => h.data.res * 0.3)) : 0;
      else if (t === 'lounge' || t === 'park' || t === 'culture') D.visitors = b.serviceOk ? Math.round(around(b, (h) => h.data.res * 0.2)) : 0;
      else if (t === 'market') D.served = b.serviceOk ? around(b, () => 1) : 0;
      else if (t === 'transit') D.riders = b.serviceOk && stops.length > 1 ? Math.round(around(b, (h) => h.data.res * 0.25)) : 0;
    }

    // credits: taxes minus upkeep, plus visitors to the monument
    let income = 0;
    for (const h of houses) income += h.data.res * TIERS[h.tier].tax * (0.6 + 0.8 * h.data.happy);
    let upkeep = 0;
    for (const b of B) if (b.def.cat === 'colony' && !b.def.house && b.type !== 'road') upkeep += b.type === 'hq' ? 0 : 1.2;
    if (g.buildings.count('monument')) income += 20;
    this.income = income - upkeep;
    if (hq) this.credits = Math.max(0, this.credits + this.income * step / 60);

    // the orbital elevator exports surplus from the depot for credits
    const lift = B.find((b) => b.type === 'elevator' && b.powerRatio > 0.3);
    this.exportT = (this.exportT || 0) + step;
    if (lift && this.exportT >= 30) {
      this.exportT = 0;
      let earned = 0; const sent = [];
      for (const [id, have] of eco.store.items) {
        const n = Math.min(20, Math.floor((have - 150) * 0.2));
        if (n <= 0) continue;
        eco.store.remove(id, n);
        earned += n * (PRICE[id] || 2);
        sent.push([id, n]);
      }
      this.credits += earned;
      lift.data.exported = (lift.data.exported || 0) + earned;
      lift.data.last = sent;
    } else if (!lift) this.exportT = 0;

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
    if (next.upgrade.stage) {
      const si = STAGES.findIndex((s) => s.id === next.upgrade.stage);
      if (this.game.terra.stage < si) return { ok: false, reason: `「${STAGES[si].name}」 단계 이후에 가능합니다` };
    }
    const cost = next.upgrade.cost;
    for (const [id, n] of Object.entries(cost)) {
      if (id === 'credits') { if (this.credits < n) return { ok: false, reason: '크레딧 ' + n + ' 필요' }; }
      else if (EDU_NAMES[id]) { if (this.edu[id] < n) return { ok: false, reason: `${EDU_NAMES[id]} ${n}명 필요 (현재 ${this.edu[id]}명)` }; }
      else if (this.game.eco.store.count(id) < n) return { ok: false, reason: '창고에 ' + ITEMS[id].name + ' ' + n + '개 필요' };
    }
    return { ok: true };
  }

  tryUpgrade(h) {
    if (!this.canUpgrade(h).ok) return false;
    const next = TIERS[h.tier + 1];
    for (const [id, n] of Object.entries(next.upgrade.cost)) {
      if (id === 'credits') this.credits -= n; else if (EDU_NAMES[id]) this.edu[id] -= n; else this.game.eco.store.remove(id, n);
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

  serialize() { return { credits: this.credits, era: this.era, arrivals: this.arrivals, autoUpgrade: this.autoUpgrade, calls: this.calls, callCooldown: this.callCooldown, log: this.log, edu: this.edu }; }
  load(o) {
    Object.assign(this, o || {});
    for (const k of ['pop', 'workforce', 'demand', 'sick']) if (!Array.isArray(this[k]) || this[k].length !== TIERS.length) this[k] = zeros();
    this.edu = { diploma: 0, degree: 0, ...(o && o.edu) };
  }
}

export { GOOD_NEEDS, EDU, EDU_NAMES };
