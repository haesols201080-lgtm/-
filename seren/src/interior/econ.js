// 도시의 살림 (v0.9): 돈(별씨)과 물건이 저절로 생기지 않고 흐른다.
//  · 구역마다: 가구(주민 살림·지갑) · 회사(가게·공장·농장·물류의 몫) · 공공(학교·병원·행정·교통의 몫) 의 별씨, 그리고 물류 창고 재고·가게 재고.
//  · 한 시간(게임 시각)마다: 농장·채굴 → 원료 / 발전소 → 빛(연료를 태움) / 공장 → 공정(원료·빛을 써서 물건) / 물류 → 가게 채움 /
//    주민 → 가게에서 사서 씀(별씨는 가구 → 회사) / 일하는 시간 → 품삯(회사·공공 → 가구) / 세금(가구 → 공공).
//  · 들어가 본 건물은 「살아 있는 건물(node)」: 제 재고·진열대·금고를 가진다. 처음 열 때 구역의 몫에서 물건과 별씨를 가져온다(새로 만들지 않는다).
//  · 플레이어도 같은 장부의 한 사람: 사면 플레이어 → 가게 금고, 일하면 고용한 건물 금고 → 플레이어. 모든 별씨의 합은 늘 같다(검사 total()).
import { GOODS, RECIPES, LINES, CROPS, SHELF_GOODS, DEMAND } from '../data/goods.js';
import { hashStr } from '../core/noise.js';

const HOUR = 1 / 24;
const WORK = [0.3, 0.72]; // 일하는 시각 (하루 비율)

export class Economy {
  constructor(game) {
    this.game = game;
    this.acc = 0;
    this.watch = new Set(); // 지금 지켜보는(플레이어가 안에 있는) 건물 uid — 거기서는 주민 행동을 사람이 직접 한다
  }
  get S() {
    const s = this.game.state;
    if (!s.econ || !s.econ.Z) s.econ = this._init();
    return s.econ;
  }

  // ── 처음: 구역마다 사람·건물 수로 살림을 짓는다 ─────────────
  _init() {
    const g = this.game, C = g.city, I = g.interiors;
    const Z = {};
    for (const zone of C ? C.zones : []) Z[zone.id] = { pop: 0, hh: 0, firms: 0, commons: 0, depot: {}, retail: {}, farms: 0, mines: 0, plants: 0, factories: {}, shops: 0, energy: 0, fuelUse: 0, made: 0, sold: 0, wages: 0 };
    if (C) {
      for (const r of C.recs) {
        const z = Z[r.zone];
        if (!z) continue;
        const pid = I.info(r).pid;
        const size = Math.max(1, (r.top - r.gy) / 4) * Math.max(1, (r.sx * r.sz) / 120);
        if (pid === 'home' || pid === 'hotel') z.pop += Math.min(4000, size * 22);
        else if (pid === 'farm') z.farms += size;
        else if (pid === 'plant') z.plants += size;
        else if (pid === 'factory') { const line = this.lineOf(r); z.factories[line] = (z.factories[line] || 0) + size; }
        else if (pid === 'market' || pid === 'cafe') z.shops += size;
      }
      for (const r of C.outRecs || []) { const z = Z[r.zone]; if (z && ['tanks', 'conduit', 'cooler', 'coiltower'].includes(r.kind)) z.mines += 1 + (r.top - r.gy) / 30; }
    }
    for (const id in Z) {
      const z = Z[id];
      z.pop = Math.max(60, Math.round(z.pop));
      // 첫 살림: 사람 수에 비례한 별씨와 재고 (이것이 그 뒤로 도는 전부)
      z.hh = z.pop * 12; z.firms = z.pop * 8; z.commons = z.pop * 4;
      for (const [k, d] of Object.entries(DEMAND)) { z.retail[k] = Math.round(d * z.pop * 1.5); z.depot[k] = Math.round(d * z.pop * 2); }
      for (const k of ['grain', 'tealeaf', 'nectar', 'fiber', 'herb', 'ore', 'resin', 'fuel', 'flour', 'shard', 'panel', 'cloth']) z.depot[k] = Math.round(z.pop * 0.3);
      z.farms = Math.max(z.farms, z.pop / 300); z.mines = Math.max(z.mines, z.pop / 500); z.plants = Math.max(z.plants, z.pop / 800);
      if (!Object.keys(z.factories).length) z.factories = { food: z.pop / 400, drink: z.pop / 600 };
    }
    return { v: 1, Z, N: {}, T: 0, P: { earned: 0, spent: 0 }, log: [] };
  }

  /** 공장의 공정 묶음 (씨앗으로 정해진다) */
  lineOf(r) { const keys = Object.keys(LINES); return keys[hashStr(`line|${r.zone}|${Math.round(r.x)}|${Math.round(r.z)}`) % keys.length]; }

  // ── 장부 ───────────────────────────────────────
  /** 계정: 'player' · 'z:구역:hh|firms|commons' · 'n:uid' */
  get(id) {
    if (id === 'player') return this.game.state.inv.starseed || 0;
    if (id.startsWith('z:')) { const [, zid, k] = id.split(':'); const z = this.S.Z[zid]; return z ? z[k] || 0 : 0; }
    if (id.startsWith('n:')) { const n = this.S.N[id.slice(2)]; return n ? n.cash : 0; }
    return 0;
  }
  _add(id, v) {
    if (id === 'player') { this.game.state.inv.starseed = Math.round(((this.game.state.inv.starseed || 0) + v) * 100) / 100; return; }
    if (id.startsWith('z:')) { const [, zid, k] = id.split(':'); const z = this.S.Z[zid]; if (z) z[k] = (z[k] || 0) + v; return; }
    if (id.startsWith('n:')) { const n = this.S.N[id.slice(2)]; if (n) n.cash += v; }
  }
  /** 옮기기 — 가진 만큼만. 반환: 옮긴 양 */
  transfer(from, to, amount, why = '') {
    const v = Math.max(0, Math.min(amount, this.get(from)));
    if (v <= 0) return 0;
    this._add(from, -v); this._add(to, v);
    if (from === 'player') this.S.P.spent += v;
    if (to === 'player') this.S.P.earned += v;
    if (why && (from === 'player' || to === 'player')) { const L = this.S.log; L.push([Math.round(this.game.world.clock.time * 100) / 100, from === 'player' ? -v : v, why]); if (L.length > 40) L.shift(); }
    return v;
  }
  /** 모든 별씨의 합 (검사용: 흐름이 닫혀 있으면 늘 같다) */
  total() {
    let t = this.get('player');
    for (const z of Object.values(this.S.Z)) t += z.hh + z.firms + z.commons;
    for (const n of Object.values(this.S.N)) t += n.cash;
    return Math.round(t * 100) / 100;
  }
  /** 물건 합 (구역 창고·가게 + 살아 있는 건물 + 플레이어 가방) */
  goodsTotal(k) {
    let t = this.game.state.inv[k] || 0;
    for (const z of Object.values(this.S.Z)) t += (z.depot[k] || 0) + (z.retail[k] || 0);
    for (const n of Object.values(this.S.N)) { t += (n.stock[k] || 0); for (const s of Object.values(n.shelf || {})) if (s.g === k) t += s.n; for (const b of n.bins || []) if (b.g === k) t += b.n; }
    return t;
  }
  zoneOf(x, z) {
    const C = this.game.city;
    if (!C) return null;
    let best = null, bd = Infinity;
    for (const Z of C.zones) { const d = Math.hypot(x - Z.cx, z - Z.cz); if (d < (Z.rOut || 1500) + 300 && d < bd) { bd = d; best = Z.id; } }
    return best || (C.zones[0] && C.zones[0].id);
  }

  // ── 살아 있는 건물 ─────────────────────────────
  /** 건물 하나의 살림을 연다 (처음이면 구역의 몫에서 가져온다). role: 건물의 주된 운영 */
  node(uid, zone, role, size = 1) {
    const S = this.S;
    let n = S.N[uid];
    if (n) return n;
    const z = S.Z[zone] || Object.values(S.Z)[0];
    n = { uid, zone, role, size, cash: 0, stock: {}, shelf: {}, bins: [], orders: [], mach: {}, crop: {}, t: S.T, sales: 0, bought: 0, wages: 0, made: 0 };
    S.N[uid] = n;
    // 금고: 회사·공공의 몫에서
    const pub = ['school', 'clinic', 'library', 'museum', 'admin', 'terminal', 'garden', 'hall'].includes(role);
    this._add(`n:${uid}`, 0);
    const want = Math.min(400, 40 + size * 6);
    const got = Math.min(want, this.get(`z:${zone}:${pub ? 'commons' : 'firms'}`) * 0.05);
    this._add(`z:${zone}:${pub ? 'commons' : 'firms'}`, -got); n.cash += got;
    return n;
  }
  /** 구역 재고에서 건물로 (있는 만큼) */
  take(zone, where, k, want) {
    const z = this.S.Z[zone];
    if (!z) return 0;
    const v = Math.max(0, Math.min(want, Math.floor(z[where][k] || 0)));
    z[where][k] = (z[where][k] || 0) - v;
    return v;
  }
  give(zone, where, k, n) { const z = this.S.Z[zone]; if (z && n > 0) z[where][k] = (z[where][k] || 0) + n; }
  price(k) { return GOODS[k] ? GOODS[k].price : 1; }

  // ── 한 시간마다 ─────────────────────────────────
  update(dt) {
    const g = this.game;
    const T = g.world.clock.time; // 날 단위 (하루 = 1)
    const S = this.S;
    if (S.T === 0) S.T = T;
    // 따라잡기: 쉬었다 오면 여러 시간을 한꺼번에 (최대 이틀)
    let steps = 0;
    while (T - S.T >= HOUR && steps < 48) { S.T += HOUR; this._hour(S.T); steps++; }
    if (T - S.T > 2) S.T = T;
    void dt;
  }
  _hour(T) {
    const S = this.S, tod = T % 1;
    const work = tod > WORK[0] && tod < WORK[1];
    for (const [zid, z] of Object.entries(S.Z)) {
      const hh = `z:${zid}:hh`, firms = `z:${zid}:firms`, commons = `z:${zid}:commons`;
      // 1. 농장·채굴 (낮에만 거둔다)
      if (work) {
        for (const k of CROPS) z.depot[k] = (z.depot[k] || 0) + z.farms * 0.35 / CROPS.length * 8;
        for (const k of ['ore', 'resin', 'fuel']) z.depot[k] = (z.depot[k] || 0) + z.mines * 0.5;
      }
      // 2. 발전: 빛을 내려면 연료를 태운다
      const fuelNeed = z.plants * 0.4;
      const fuel = Math.min(fuelNeed, z.depot.fuel || 0);
      z.depot.fuel = (z.depot.fuel || 0) - fuel;
      z.energy = fuel * 30; // 이번 시간에 쓸 수 있는 빛
      // 3. 공장: 공정마다 재료·빛이 있는 만큼 (일하는 시간에만)
      let made = 0;
      if (work) for (const [line, cap] of Object.entries(z.factories)) {
        for (const rk of LINES[line] || []) {
          const R = RECIPES[rk];
          let runs = Math.floor(cap * 0.6);
          for (const [k, n] of Object.entries(R.in)) runs = Math.min(runs, Math.floor((z.depot[k] || 0) / n));
          runs = Math.min(runs, Math.floor(z.energy / R.energy));
          if (runs <= 0) continue;
          for (const [k, n] of Object.entries(R.in)) z.depot[k] -= n * runs;
          for (const [k, n] of Object.entries(R.out)) { z.depot[k] = (z.depot[k] || 0) + n * runs; made += n * runs; }
          z.energy -= R.energy * runs;
        }
      }
      z.made = made;
      // 4. 물류: 창고 → 가게 (가게가 이틀치보다 적으면 채운다)
      for (const [k, d] of Object.entries(DEMAND)) {
        const want = d * z.pop * 2 - (z.retail[k] || 0);
        if (want > 0) { const v = Math.min(want, Math.floor(z.depot[k] || 0)); z.depot[k] -= v; z.retail[k] = (z.retail[k] || 0) + v; }
      }
      // 5. 주민이 산다 (살아 있는 가게 몫은 그 가게에서 — node 쪽에서 따로)
      let sold = 0;
      const nodeShare = this._shopShare(zid);
      for (const [k, d] of Object.entries(DEMAND)) {
        const want = d * z.pop * HOUR * (1 - nodeShare);
        const have = z.retail[k] || 0;
        const v = Math.min(want, have);
        const pay = this.transfer(hh, firms, v * this.price(k));
        const got = Math.min(v, pay / this.price(k));
        z.retail[k] = have - got;
        sold += got;
      }
      z.sold = sold;
      // 6. 품삯 (일하는 시간): 회사·공공 → 가구 · 세금 (가구 → 공공)
      if (work) {
        const wf = Math.min(z.firms * 0.04, z.pop * 0.55 * 0.62 / 10), wc = Math.min(z.commons * 0.04, z.pop * 0.15 * 0.62 / 10);
        this.transfer(firms, hh, wf); this.transfer(commons, hh, wc);
        z.wages = wf + wc;
        this.transfer(hh, commons, (wf + wc) * 0.12);
        // 회사가 창고 물건을 사 오는 값 (회사 사이 — 같은 계정이라 그대로)
      }
    }
    // 살아 있는 건물마다
    for (const n of Object.values(S.N)) this._nodeHour(n, T, work);
  }
  /** 구역의 가게 수요 가운데 살아 있는 가게가 맡는 몫 */
  _shopShare(zid) {
    let s = 0;
    for (const n of Object.values(this.S.N)) if (n.zone === zid && (n.role === 'mart' || n.role === 'food')) s += 0.04 * Math.min(3, n.size / 20);
    return Math.min(0.6, s);
  }
  /** 살아 있는 건물의 한 시간 — 지켜보는 동안에는 사람(agents·플레이어)이 직접 하므로 손님 사기·채우기는 건너뛴다 */
  _nodeHour(n, T, work) {
    const z = this.S.Z[n.zone];
    if (!z) return;
    const watched = this.watch.has(n.uid);
    const me = `n:${n.uid}`, hh = `z:${n.zone}:hh`, firms = `z:${n.zone}:firms`;
    // 주문한 짐이 왔나 (물류 창고 → 하역장)
    for (const o of n.orders.slice()) {
      if (T < o.at) continue;
      n.orders.splice(n.orders.indexOf(o), 1);
      if (watched) { n.dock = n.dock || []; n.dock.push({ g: o.g, n: o.n }); } // 보는 동안엔 하역장에 짐으로 (사람이 나른다)
      else n.stock[o.g] = (n.stock[o.g] || 0) + o.n;
    }
    if (n.role === 'mart' || n.role === 'food') {
      // 손님이 산다 (보이지 않을 때만 — 보이면 손님이 진짜로 집어 계산한다)
      if (!watched) {
        const rate = 0.04 * Math.min(3, n.size / 20) * z.pop * HOUR;
        for (const [fid, s] of Object.entries(n.shelf)) {
          if (!s.g || s.n <= 0) continue;
          const d = (DEMAND[s.g] || 0.02) * rate * 0.6;
          const v = Math.min(s.n, Math.floor(d + Math.random()));
          if (v <= 0) continue;
          const paid = this.transfer(hh, me, v * this.price(s.g));
          const got = Math.min(v, Math.floor(paid / this.price(s.g) + 1e-6));
          s.n -= got; n.sales += paid;
          void fid;
        }
        // 직원이 창고에서 진열대를 채운다
        for (const s of Object.values(n.shelf)) {
          if (!s.g || s.n >= s.cap * 0.5) continue;
          const v = Math.min(s.cap - s.n, n.stock[s.g] || 0);
          n.stock[s.g] = (n.stock[s.g] || 0) - v; s.n += v;
        }
      }
      // 창고가 비면 물류 창고에 주문 (값은 회사 몫으로, 두 시간 뒤 도착)
      if (work) for (const s of Object.values(n.shelf)) {
        if (!s.g) continue;
        const have = (n.stock[s.g] || 0) + s.n + n.orders.filter((o) => o.g === s.g).reduce((a, o) => a + o.n, 0);
        if (have >= s.cap * 1.2) continue;
        const want = Math.ceil(s.cap * 1.5);
        const v = this.take(n.zone, 'retail', s.g, want) || this.take(n.zone, 'depot', s.g, want);
        if (!v) continue;
        const cost = v * (GOODS[s.g] ? GOODS[s.g].base : 0.5);
        const paid = this.transfer(me, firms, cost);
        if (paid < cost * 0.99) { this.give(n.zone, 'depot', s.g, v); this.transfer(firms, me, paid); continue; }
        n.orders.push({ g: s.g, n: v, at: T + 2 / 24 });
        n.bought += paid;
      }
    }
    // 일하는 건물은 일하는 시간에 일꾼 품삯을 낸다 (가게 몫 → 가구)
    if (work && n.staff) this.transfer(me, hh, n.staff * 0.06);
  }

  /** 지금 살림 한 줄 (지도·모아·장부 앱) */
  summary(zid) {
    const z = this.S.Z[zid];
    if (!z) return '';
    return `주민 ${z.pop} · 가구 별씨 ${Math.round(z.hh)} · 회사 ${Math.round(z.firms)} · 공공 ${Math.round(z.commons)} · 이번 시간 만든 것 ${Math.round(z.made)} · 판 것 ${Math.round(z.sold)}`;
  }
  /** 가게 진열대 구역 → 놓을 물건 */
  shelfGood(cat, k) { const L = SHELF_GOODS[cat] || SHELF_GOODS.pantry; return L[k % L.length]; }
}
