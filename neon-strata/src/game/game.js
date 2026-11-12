// Game rules: the Lux economy (shards → courier work → arbitrage → businesses → stock takeovers → the Crown),
// altitude licences, objectives, pick-ups, mission markers, interactions and saving.
import * as THREE from 'three';
import { RNG } from '../core/rng.js';
import { placeAt, DISTRICT_BY_ID } from '../world/layout.js';
import { VEHICLES, CEILINGS } from './player.js';
import { CORPS } from '../render/signs.js';

export const COMMODITIES = [
  { id: 'cell', name: '광전지', base: 12 }, { id: 'air', name: '청정 공기', base: 20 }, { id: 'protein', name: '합성 단백질', base: 9 }, { id: 'alloy', name: '재생 합금', base: 32 },
  { id: 'chip', name: '기억 칩', base: 80 }, { id: 'coolant', name: '냉각제', base: 48 }, { id: 'spice', name: '뉴로 향신료', base: 150 }, { id: 'relic', name: '구시대 유물', base: 400 }];
const PM = { // price multipliers: < 1 produced here, > 1 in demand
  sump: { cell: 1.35, air: 1.5, alloy: 0.6, spice: 0.7 }, foundry: { alloy: 0.55, coolant: 0.7, protein: 1.4, cell: 1.25 }, port: { coolant: 0.75, protein: 0.85, alloy: 1.5, chip: 1.3 },
  oldq: { relic: 0.55, chip: 0.8, spice: 1.45, air: 1.3 }, meridian: { chip: 0.7, relic: 1.8, spice: 1.5, cell: 1.2 }, lumina: { spice: 1.75, protein: 1.3, relic: 1.4, coolant: 1.2 },
  hive: { protein: 1.45, air: 1.3, cell: 1.3, chip: 0.9 }, verdant: { protein: 0.5, air: 0.55, coolant: 1.5, alloy: 1.3 }, core: { cell: 0.65, relic: 2.0, spice: 1.6 }, zenith: { cell: 0.5, relic: 2.4, spice: 2.0, air: 1.7 }, sprawl: {},
};
export const BUSINESSES = [
  { id: 'stall', d: 'sump', name: '야시장 좌판', cost: 300, inc: 1.2 }, { id: 'recycle', d: 'sump', name: '고물 재생소', cost: 2500, inc: 9 }, { id: 'capsule', d: 'sump', name: '캡슐텔 지분', cost: 12000, inc: 38 },
  { id: 'noodle', d: 'hive', name: '하이브 국수 체인', cost: 6000, inc: 20 }, { id: 'hiveblock', d: 'hive', name: '주거동 임대권', cost: 90000, inc: 260 },
  { id: 'farm', d: 'verdant', name: '수경 농장', cost: 30000, inc: 95 }, { id: 'airplant', d: 'verdant', name: '공기 정화소', cost: 220000, inc: 640 },
  { id: 'smelter', d: 'foundry', name: '합금 제련 라인', cost: 55000, inc: 170 }, { id: 'coolantp', d: 'foundry', name: '냉각제 공장', cost: 400000, inc: 1150 },
  { id: 'dock', d: 'port', name: '하역 크레인 지분', cost: 150000, inc: 430 }, { id: 'fleet', d: 'port', name: '화물선 선단', cost: 1.2e6, inc: 3300 },
  { id: 'vault', d: 'oldq', name: '기억 보관소', cost: 700000, inc: 1900 }, { id: 'auction', d: 'oldq', name: '유물 경매장', cost: 3e6, inc: 7800 },
  { id: 'club', d: 'lumina', name: '홀로 클럽', cost: 2e6, inc: 5400 }, { id: 'casino', d: 'lumina', name: '빛 도박장', cost: 1.5e7, inc: 38000 },
  { id: 'bank', d: 'meridian', name: '사설 은행', cost: 8e6, inc: 20500 }, { id: 'tower', d: 'meridian', name: '메리디안 타워', cost: 9e7, inc: 220000 },
  { id: 'helio', d: 'zenith', name: '헬리오스탯 배열', cost: 6e8, inc: 1.4e6 }, { id: 'crown', d: 'zenith', name: '왕관 — 스파이어 최상층', cost: 1.2e10, inc: 2.5e7 },
];
export const LICENSES = [{ name: '무면허', cost: 0 }, { name: '고도 면허 1급', cost: 600 }, { name: '고도 면허 2급', cost: 6000 }, { name: '고도 면허 3급 (구름 위)', cost: 90000 }, { name: '무제한 항로권', cost: 2.5e6 }];
const STOCK_BASE = { verdant: 4000, hive: 6000, vanta: 15000, aether: 30000, archive: 60000, lumina: 120000, meridian: 400000, helion: 5e6 };
const CORP_DIST = { verdant: 'verdant', hive: 'hive', vanta: 'foundry', aether: 'port', archive: 'oldq', lumina: 'lumina', meridian: 'meridian', helion: 'zenith' };
export const FLOAT = 1000;
const RIVALS = [['헬리오스 3세', 2.4e10], ['마담 루미나', 4e9], ['메리디안 은행장', 9e8], ['반타 회장', 2e8], ['에테르 선주', 4e7], ['아카이브 수석', 8e6], ['버던트 농장주', 1.5e6], ['하이브 구역장', 2.5e5], ['침전층 고물왕', 3e4], ['덱 아래 전당포주', 4000], ['0번 골목 좌판상', 600]];
const EVENTS = [['air', 1.7, '스모그 폭풍 — 청정 공기 수요 급등'], ['cell', 1.6, '헬리오스탯 정비 — 광전지 품귀'], ['protein', 0.6, '버던트 대풍작 — 단백질 가격 폭락'], ['alloy', 1.6, '방벽 보수 공사 — 합금 수요 급증'], ['chip', 1.5, '아카이브 데이터 유실 — 기억 칩 급등'], ['spice', 1.5, '루미나 축제 주간 — 향신료 품절'], ['relic', 1.6, '수집가 경매 개최 — 유물 프리미엄'], ['coolant', 0.65, '주조 구역 감산 — 냉각제 재고 과잉']];
export const fmt = (n) => { const a = Math.abs(n); if (a >= 1e12) return (n / 1e12).toFixed(2) + '조'; if (a >= 1e8) return (n / 1e8).toFixed(a >= 1e10 ? 0 : 1) + '억'; if (a >= 1e4) return (n / 1e4).toFixed(a >= 1e6 ? 0 : 1) + '만'; return Math.floor(n).toLocaleString('ko-KR'); };
const SAVE_KEY = 'ns.save.v1';

export class Game {
  constructor({ engine, city, crowd, env, U, audio }) {
    Object.assign(this, { engine, city, crowd, env, U, audio }); this.rng = new RNG(Date.now() & 0xffff); this.shake = 0; this.toasts = []; this.news = '카이로스-9에 오신 것을 환영합니다';
    this.state = { lux: 20, license: 0, vehicle: 0, cargo: {}, biz: {}, shares: {}, remote: false, shards: 0, deliveries: 0, visited: {}, hour: 21.5, won: false, playtime: 0, step: 0, pos: null };
    this.prices = {}; this.stock = {}; this.stockHist = {}; for (const k in STOCK_BASE) { this.stock[k] = STOCK_BASE[k]; this.stockHist[k] = []; }
    this.event = null; this.eventT = 50; this.drift = {}; for (const c of COMMODITIES) this.drift[c.id] = 1;
    this.job = null; this.offers = []; this.pickups = []; this.near = null; this.t = 0; this.saveT = 0; this.tickT = 0;
    this._pickupMesh(); this._markers();
    this.pois = city.pois; this.trade = this.pois.filter((p) => p.type === 'shop' || p.type === 'market' || p.type === 'plaza' || (p.type === 'lobby' && p.big));
    this.spots = this.pois.filter((p) => p.type === 'shop' || p.type === 'lobby' || p.type === 'pad' || p.type === 'market');
  }
  // ---------------------------------------------------------------- derived values
  cargoCap() { return this.state.vehicle ? VEHICLES[this.state.vehicle].cargo : 6; }
  cargoUsed() { let n = 0; for (const k in this.state.cargo) n += this.state.cargo[k].n; return n; }
  bizLevel(id) { return this.state.biz[id] ?? -1; }
  bizCost(b) { return Math.round(b.cost * Math.pow(1.55, this.bizLevel(b.id) + 1)); }
  bizIncome(b) { const l = this.bizLevel(b.id); if (l < 0) return 0; const corp = Object.keys(CORP_DIST).find((c) => CORP_DIST[c] === b.d); return b.inc * (1 + l) * (corp && (this.state.shares[corp] || 0) >= FLOAT * 0.51 ? 2 : 1); }
  income() { let s = 0; for (const b of BUSINESSES) s += this.bizIncome(b); for (const k in this.state.shares) s += this.state.shares[k] * this.stock[k] * 0.00006; return s; }
  netWorth() { let w = this.state.lux; for (const b of BUSINESSES) { const l = this.bizLevel(b.id); for (let i = 0; i <= l; i++) w += b.cost * Math.pow(1.55, i) * 0.8; } for (const k in this.state.shares) w += this.state.shares[k] * this.stock[k]; if (this.state.vehicle) w += VEHICLES[this.state.vehicle].price * 0.6; for (const k in this.state.cargo) w += this.state.cargo[k].n * this.state.cargo[k].avg; return w; }
  rank() { const w = this.netWorth(); let r = 1; for (const [, v] of RIVALS) if (v > w) r++; if (w < 600) return { n: Math.max(12, Math.floor(8.2e6 * Math.exp(-w / 90))), named: false }; return { n: r, named: true }; }
  rivals() { const w = this.netWorth(); const list = RIVALS.map(([name, v]) => ({ name, v, me: false })); list.push({ name: '나', v: w, me: true }); return list.sort((a, b) => b.v - a.v); }
  price(id, district) { const c = COMMODITIES.find((q) => q.id === id); const m = (PM[district] || {})[id] ?? 1; const ev = this.event && this.event[0] === id ? this.event[1] : 1; return Math.max(1, Math.round(c.base * m * this.drift[id] * ev)); }
  district() { return placeAt(this.player.p.x, this.player.p.y, this.player.p.z); }

  // ---------------------------------------------------------------- actions (called by UI)
  spend(n) { if (this.state.lux < n) { this.toast('럭스가 부족합니다', 'bad'); this.audio?.blip(160, 0.2); return false; } this.state.lux -= n; return true; }
  earn(n, why) { this.state.lux += n; if (why) this.toast(`+${fmt(n)} ℓ  ${why}`, 'good'); this.audio?.coin(); }
  buy(id, n, district) { const p = this.price(id, district); n = Math.min(n, this.cargoCap() - this.cargoUsed(), Math.floor(this.state.lux / p)); if (n <= 0) { this.toast(this.cargoUsed() >= this.cargoCap() ? '적재 공간이 없습니다' : '럭스가 부족합니다', 'bad'); return; } const c = this.state.cargo[id] || (this.state.cargo[id] = { n: 0, avg: 0 }); c.avg = (c.avg * c.n + p * n) / (c.n + n); c.n += n; this.state.lux -= p * n; this.audio?.blip(520, 0.06); }
  sell(id, n, district) { const c = this.state.cargo[id]; if (!c || c.n <= 0) return; n = Math.min(n, c.n); const p = this.price(id, district); const profit = (p - c.avg) * n; c.n -= n; this.state.lux += p * n; if (c.n <= 0) delete this.state.cargo[id]; this.toast(`${COMMODITIES.find((q) => q.id === id).name} ${n}개 매도  ${profit >= 0 ? '+' : ''}${fmt(profit)} ℓ`, profit >= 0 ? 'good' : 'bad'); this.audio?.coin(); }
  buyBiz(id) { const b = BUSINESSES.find((q) => q.id === id); if (!this.state.visited[b.d] && b.d !== 'zenith') { this.toast(`${(DISTRICT_BY_ID[b.d] || {}).name || ''} 구역을 먼저 방문하세요`, 'bad'); return; } if (b.d === 'zenith' && !this.state.visited.zenith) { this.toast('제니스에 직접 올라가야 합니다', 'bad'); return; } if (this.bizLevel(id) >= 9) return; if (!this.spend(this.bizCost(b))) return; this.state.biz[id] = this.bizLevel(id) + 1; this.toast(`${b.name} ${this.state.biz[id] === 0 ? '인수' : '확장 Lv.' + (this.state.biz[id] + 1)}`, 'good'); this.audio?.chord(); if (id === 'crown') this._checkWin(); }
  buyLicense() { const n = this.state.license + 1; if (n >= LICENSES.length) return; if (!this.spend(LICENSES[n].cost)) return; this.state.license = n; this.toast(`${LICENSES[n].name} 취득 — 비행 한도 ${n === 4 ? '무제한' : CEILINGS[n] + 'm'}`, 'good'); this.audio?.chord(); }
  buyVehicle(t) { if (t <= this.state.vehicle) return; const cost = VEHICLES[t].price - (this.state.vehicle ? VEHICLES[this.state.vehicle].price * 0.5 : 0); if (!this.spend(Math.round(cost))) return; this.state.vehicle = t; this.player.setCar(t); this.player.summon(true); this.toast(`${VEHICLES[t].name} 인도 완료 — [F] 탑승`, 'good'); this.audio?.chord(); }
  buyRemote() { if (this.state.remote || !this.spend(5000)) return; this.state.remote = true; this.toast('원격 거래 단말 설치', 'good'); }
  tradeShares(k, n) { const p = this.stock[k]; const have = this.state.shares[k] || 0; if (n > 0) { n = Math.min(n, FLOAT - have, Math.floor(this.state.lux / p)); if (n <= 0) { this.toast('매수할 수 없습니다', 'bad'); return; } this.state.lux -= n * p; this.state.shares[k] = have + n; this.stock[k] *= 1 + n * 0.0004; if (have < FLOAT * 0.51 && have + n >= FLOAT * 0.51) { this.toast(`${k.toUpperCase()} 경영권 인수! 해당 구역 사업 수익 2배`, 'good'); this.audio?.chord(); } } else { n = Math.min(-n, have); if (n <= 0) return; this.state.lux += n * p * 0.995; this.state.shares[k] = have - n; this.stock[k] *= 1 - n * 0.0003; } this.audio?.blip(600, 0.05); }
  sleep() { this.env.hour = 6.2; this.save(); this.toast('캡슐에서 눈을 붙였습니다 — 새벽 6시, 저장됨', 'good'); this.fade = 1; }
  travel(st) { if (!this.spend(8)) return; const pl = this.player; pl.mode = 'foot'; pl.pos.set(st.x, st.y, st.z); pl.vel.set(0, 0, 0); this.fade = 1; this.toast(`${st.name} 도착`); }

  // ---------------------------------------------------------------- courier jobs
  rollOffers() {
    const p = this.player.p; const tier = this.state.vehicle; const maxD = [260, 1500, 3200, 5000, 7000][tier]; const mult = [1, 2.6, 8, 30, 130][tier];
    const cand = this.spots.filter((s) => { const d = Math.hypot(s.x - p.x, s.z - p.z); return d < maxD && Math.abs(s.y - p.y) < (tier ? CEILINGS[this.state.license] : 6) && (tier > 0 || s.type !== 'pad'); });
    this.offers = [];
    for (let i = 0; i < 4 && cand.length > 2; i++) { const a = this.rng.pick(cand); let b = this.rng.pick(cand), tries = 0; while ((b === a || Math.hypot(a.x - b.x, a.z - b.z) < 60) && tries++ < 20) b = this.rng.pick(cand); const d = Math.hypot(a.x - b.x, a.z - b.z, a.y - b.y); const c = this.rng.pick(COMMODITIES); this.offers.push({ a, b, d, item: c.name, pay: Math.round((16 + d * 0.11) * mult * this.rng.f(0.85, 1.3)), time: Math.round(d / [3.6, 22, 36, 48, 70][tier] + 45) }); }
  }
  accept(i) { const o = this.offers[i]; if (!o || this.job) return; this.job = { ...o, stage: 0, left: o.time * 1.6 }; this.offers = []; this.toast(`의뢰 수락 — ${o.item} 수령지로 이동`, 'good'); this.audio?.blip(700, 0.1); }
  cancelJob() { this.job = null; }

  // ---------------------------------------------------------------- world bits
  _pickupMesh() {
    const g = new THREE.OctahedronGeometry(0.26); const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.5, 0.8) });
    this.pmesh = new THREE.InstancedMesh(g, m, 40); this.pmesh.frustumCulled = false; this.pmesh.count = 0; this.engine.scene.add(this.pmesh);
    this.pglow = new THREE.PointLight(0xffc860, 0, 9, 2); this.engine.scene.add(this.pglow);
  }
  _markers() {
    const mk = (col) => { const grp = new THREE.Group(); const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 300, 10, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); beam.position.y = 150; const ring = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.12, 6, 28), new THREE.MeshBasicMaterial({ color: col })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.25; grp.add(beam, ring); grp.visible = false; this.engine.scene.add(grp); return grp; };
    this.mkA = mk(new THREE.Color(0.4, 2.2, 2.6)); this.mkB = mk(new THREE.Color(2.8, 1.6, 0.3));
  }
  _spawnPickup() {
    const p = this.player.p; const ws = this.crowd._near(p.x, p.y, p.z, 110); if (!ws.length) return;
    const w = this.rng.pick(ws); const n = w.pts.length; const i = this.rng.i(0, n - 1); const a = w.pts[i], b = w.pts[(i + 1) % n]; const t = this.rng.next();
    const x = a[0] + (b[0] - a[0]) * t + this.rng.f(-1, 1), z = a[2] + (b[2] - a[2]) * t + this.rng.f(-1, 1); if (Math.hypot(x - p.x, z - p.z) < 10) return;
    const d = placeAt(x, a[1], z).id; const tierV = { sump: 1, hive: 1.5, foundry: 2, port: 2, verdant: 2, oldq: 3, lumina: 5, meridian: 8, core: 12, zenith: 400 }[d] || 1;
    this.pickups.push({ x, y: a[1] + 1.0, z, v: Math.round(this.rng.f(3, 8) * tierV), ph: this.rng.f(0, 6) });
  }
  toast(text, kind = '') { this.toasts.push({ text, kind, t: 4.5 }); if (this.toasts.length > 5) this.toasts.shift(); }

  // ---------------------------------------------------------------- frame update
  update(dt, input) {
    const s = this.state, pl = this.player, p = pl.p; this.t += dt; s.playtime += dt;
    const d = this.district(); if (!s.visited[d.id]) { s.visited[d.id] = true; if (this.t > 3) this.toast(`${d.name} 첫 방문 — 새 사업 기회가 열렸습니다`, 'good'); }
    // passive income + market simulation (1 Hz)
    s.lux += this.income() * dt; this.tickT -= dt;
    if (this.tickT <= 0) {
      this.tickT = 1;
      for (const c of COMMODITIES) this.drift[c.id] = Math.max(0.7, Math.min(1.4, this.drift[c.id] + (this.rng.next() - 0.5) * 0.03 + (1 - this.drift[c.id]) * 0.02));
      for (const k in this.stock) { const ev = this.event && this.eventCorp === k ? 0.004 : 0; this.stock[k] = Math.max(STOCK_BASE[k] * 0.25, this.stock[k] * Math.exp((this.rng.next() - 0.5) * 0.035 + 0.0006 + ev + (STOCK_BASE[k] * 1.6 - this.stock[k]) / STOCK_BASE[k] * 0.0015)); const h = this.stockHist[k]; h.push(this.stock[k]); if (h.length > 60) h.shift(); }
      this.eventT -= 1; if (this.eventT <= 0) { this.eventT = this.rng.f(70, 140); this.event = this.rng.chance(0.8) ? this.rng.pick(EVENTS) : null; this.eventCorp = this.rng.pick(Object.keys(STOCK_BASE)); this.news = this.event ? '속보 · ' + this.event[2] : '시장 안정 — 큰 변동 없음'; if (this.event) this.toast(this.news); }
      for (const r of RIVALS) r[1] *= 1.00004;
      if (!this.job && this.offers.length === 0) this.rollOffers();
      this._objective();
    }
    // pick-ups
    if (this.pickups.length < 22 && this.rng.chance(dt * 4)) this._spawnPickup();
    const m4 = this._m4 || (this._m4 = new THREE.Matrix4()); const q = this._q || (this._q = new THREE.Quaternion()); const e = this._e || (this._e = new THREE.Euler()); const v = this._v || (this._v = new THREE.Vector3()); const one = this._o || (this._o = new THREE.Vector3(1, 1, 1));
    let k = 0, nearD = 1e9, nearP = null; const reach = pl.mode === 'fly' ? 5 : 1.5;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const c = this.pickups[i]; const dd = Math.hypot(c.x - p.x, c.y - 0.4 - p.y, c.z - p.z);
      if (dd < reach) { s.lux += c.v; s.shards++; this.pickups.splice(i, 1); this.toast(`광편 +${c.v} ℓ`, 'good'); this.audio?.coin(); continue; }
      if (dd > 180) { this.pickups.splice(i, 1); continue; }
      if (dd < nearD) { nearD = dd; nearP = c; }
      e.set(0, this.t * 1.6 + c.ph, 0.6); q.setFromEuler(e); m4.compose(v.set(c.x, c.y + Math.sin(this.t * 2 + c.ph) * 0.15, c.z), q, one); this.pmesh.setMatrixAt(k++, m4);
    }
    this.pmesh.count = k; this.pmesh.instanceMatrix.needsUpdate = true;
    if (nearP && nearD < 30) { this.pglow.position.set(nearP.x, nearP.y, nearP.z); this.pglow.intensity = 30; } else this.pglow.intensity = 0;
    // courier job
    const J = this.job;
    if (J) {
      J.left -= dt; const tgt = J.stage === 0 ? J.a : J.b; const dd = Math.hypot(tgt.x - p.x, tgt.z - p.z); const dy = Math.abs(tgt.y - p.y);
      if (dd < (pl.mode === 'fly' ? 9 : 4) && dy < 6) { if (J.stage === 0) { J.stage = 1; this.toast(`${J.item} 수령 — 배송지로!`, 'good'); this.audio?.blip(880, 0.1); } else { const bonus = J.left > 0 ? Math.round(J.pay * 0.25) : 0; this.earn(J.pay + bonus, bonus ? '배송 완료 (신속 보너스)' : '배송 완료'); s.deliveries++; this.job = null; } }
      else if (J.left < -J.time) { this.toast('의뢰 기한 초과 — 계약 파기', 'bad'); this.job = null; }
      this.mkA.visible = !!this.job && J.stage === 0; this.mkB.visible = !!this.job && J.stage === 1;
      if (this.job) { const mk = J.stage === 0 ? this.mkA : this.mkB; mk.position.set(tgt.x, tgt.y, tgt.z); mk.children[1].rotation.z = this.t; }
    } else { this.mkA.visible = this.mkB.visible = false; }
    // nearest interactable
    this.near = null; let best = 1e9;
    if (pl.mode === 'foot') for (const o of this.pois) { if (!INTERACT[o.type]) continue; const dd = Math.hypot(o.x - p.x, o.z - p.z); const r = o.type === 'lobby' && o.big ? 9 : o.type === 'market' || o.type === 'plaza' ? 22 : o.type === 'station' ? 5 : 3.6; if (dd < r && Math.abs(o.y - p.y) < 4 && dd < best) { best = dd; this.near = o; } }
    // toasts, autosave
    for (const t of this.toasts) t.t -= dt; while (this.toasts.length && this.toasts[0].t <= 0) this.toasts.shift();
    this.fade = Math.max(0, (this.fade || 0) - dt * 0.8);
    this.saveT += dt; if (this.saveT > 25) { this.saveT = 0; this.save(); }
  }
  _objective() {
    const s = this.state; const steps = [
      [() => s.shards >= 5, '골목의 빛나는 광편을 5개 주우세요', '광편은 굳은 빛 — 이 도시의 화폐입니다'], [() => s.deliveries >= 1 || s.vehicle > 0, '[Tab] 일감에서 배달 의뢰를 하나 완수하세요', '도보 의뢰로 첫 럭스를 법니다'],
      [() => s.vehicle >= 1, '120 ℓ를 모아 [Tab] 차고에서 고물 스키머를 사세요', '하늘이 열리면 도시가 달라집니다'], [() => Object.keys(s.cargo).length > 0 || s.lux > 400 || s.license > 0, '상점 안에서 [E] 거래 — 싸게 사서 다른 구역에 파세요', '구역마다 시세가 다릅니다'],
      [() => s.license >= 1, '고도 면허 1급 (600 ℓ)을 취득하세요', '고도는 곧 계급입니다'], [() => Object.keys(s.biz).length >= 1, '첫 사업체를 인수하세요 — [Tab] 사업', '자는 동안에도 럭스가 들어옵니다'],
      [() => s.license >= 2, '고도 면허 2급으로 구름 아래 전 구역을 누비세요', ''], [() => Object.keys(s.biz).length >= 5, '사업체 5곳을 거느리세요', ''], [() => s.license >= 3, '고도 면허 3급 — 구름을 뚫고 제니스로', '스파이어 승강기 또는 직접 비행'],
      [() => Object.values(s.shares).some((n) => n >= FLOAT * 0.51), '에테르 거래소에서 기업 하나의 경영권(51%)을 인수하세요', ''], [() => this.rank().n <= 3 && this.rank().named, '광휘 서열 3위 안에 드세요', ''], [() => s.biz.crown >= 0, '왕관을 손에 넣으세요 — 스파이어 최상층', '120억 ℓ'], [() => s.won, '서열 1위에 오르세요', '']];
    while (s.step < steps.length && steps[s.step][0]()) { s.step++; if (s.step < steps.length) { this.toast('목표 달성!', 'good'); this.audio?.chord(); } }
    this.objective = s.step < steps.length ? { text: steps[s.step][1], sub: steps[s.step][2], i: s.step, n: steps.length } : { text: '당신은 빛의 제국의 주인입니다', sub: '', i: steps.length, n: steps.length };
    this._checkWin();
  }
  _checkWin() { const s = this.state; if (!s.won && s.biz.crown >= 0 && this.rank().n === 1) { s.won = true; this.won = 12; this.audio?.chord(); this.toast('광휘 서열 1위 — 카이로스-9의 정상에 섰습니다', 'good'); } }

  // ---------------------------------------------------------------- persistence
  save() { try { const pl = this.player; this.state.pos = [pl.pos.x, pl.pos.y, pl.pos.z, pl.camYaw]; this.state.hour = this.env.hour; this.state.savedAt = Date.now(); this.state.stock = this.stock; localStorage.setItem(SAVE_KEY, JSON.stringify(this.state)); } catch (e) { /* storage unavailable */ } }
  load() {
    try { const raw = localStorage.getItem(SAVE_KEY); if (!raw) return false; const d = JSON.parse(raw); Object.assign(this.state, d); if (d.stock) Object.assign(this.stock, d.stock);
      const away = Math.min(8 * 3600, (Date.now() - (d.savedAt || Date.now())) / 1000); const gain = this.income() * away * 0.5; if (gain > 1) { this.state.lux += gain; this.toast(`부재 중 수익 +${fmt(gain)} ℓ`, 'good'); }
      return true; } catch (e) { return false; }
  }
  reset() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } location.reload(); }
}
export const INTERACT = { shop: '[E] 거래', market: '[E] 시장 거래', plaza: '[E] 광장 거래소', lobby: '[E] 사업 · 거래', license: '[E] 고도 면허', exchange: '[E] 에테르 거래소', bank: '[E] 광휘 서열', home: '[E] 휴식 · 저장', station: '[E] 마그레브 탑승 (8 ℓ)', crown: '[E] 왕관 인수' };
export { STOCK_BASE, CORP_DIST, PM, RIVALS };
