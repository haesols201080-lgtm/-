// 쓰임마다 건물이 돌아가는 법 (v0.9) — 실제 시설의 일을 아웬 문명에 맞게.
//  각 쓰임: setup(처음 채우기: 진열대·창고·기계·밭…) · act(시설마다 플레이어가 하는 일) · people(그 층의 사람과 일과) · tick(돌아가는 과정) · roles(일자리와 과제)
//  · 마트: 진열 칸마다 실제 재고(구역 가게 재고에서 가져온 것). 손님은 바구니를 들고 집어 계산대에서 값을 치른다. 직원은 창고에서 상자를 날라 채우고,
//    물류 창고에 주문한 짐은 하역장에 도착해 사람이 창고로 옮긴다. 플레이어도 같은 일(진열·계산·하역·재고 세기·안내)을 맡을 수 있다.
//  · 식당: 재료(서늘함 속 실제 물건)로 주문받은 음식을 짓는다 — 재료가 떨어지면 그 차림은 못 낸다.
//  · 공장: 원료 통 → 기계(공정마다 실제 재료를 쓰고 빛을 먹는다) → 완성품 선반 → 물류 창고로 실어 보냄(그때 값을 받는다).
//  · 물류: 들어온 짐을 나누고(분류), 가게 주문을 선반에서 골라(피킹) 하역장으로.
//  · 사무: 자리마다 사람이 단말로 일하고, 단말의 「일자리」 앱으로 지원 → 면접(채용 면접실) → 채용. 일은 직무마다 다른 앱.
//  · 연구: 시료 → 손질 → 장비 측정 → 분석 단말 → 연구 진척(건물마다 저장). 학교: 시간표·수업·학생. 병원: 접수 → 대기 → 진료 → 치료/약.
//  · 발전: 연료 결정을 넣고 출력을 맞춘다(구역의 빛). 교통: 표·타는 문·타는 곳. 박물관·서고·공연장·호텔·행정·농장·집·쉼터.
import { GOODS, SHELF_GOODS, RECIPES, LINES, CROPS, CATS } from '../data/goods.js';
import { ITEMS, EXHIBITS, BUFFS, ZONE_NAMES } from '../data/venues.js';
import { FIX, ROOMS } from './catalog.js';
import { audio } from '../core/audio.js';
import { hashStr, mulberry32 } from '../core/noise.js';
import { WORDS, WORD } from '../data/lexicon.js';
import { won } from '../data/money.js';
import { bookById, bookColor } from '../data/books.js';
import { stockFor, shelfTitles, subjectName, slotName, libState, readPage, SPINES } from './library.js';
import { josa } from '../core/josa.js';

// ── 도구 ─────────────────────────────────────────────────
const tod = (ops) => ops.game.world.clock.time % 1;
const open = (ops, a = 0.28, b = 0.92) => { const t = tod(ops); return t > a && t < b; };
const tagged = (out, ...tags) => out.fix.filter((F) => tags.includes(F.tag));
const typed = (out, ...ts) => out.fix.filter((F) => ts.includes(F.t));
const pick = (arr, r = Math.random) => arr[Math.floor(r() * arr.length)];
const yawTo = (F) => Math.atan2(F.x - F.ax, F.z - F.az);
const AT = (F) => [F.ax, F.az];
const BK = (F) => [F.bx ?? F.ax, F.bz ?? F.az];
const gname = (k) => (GOODS[k] || ITEMS[k] || {}).name || k;
const roomOf = (out, F) => out.L.rooms[F.room];
const ui = (ops) => ops.game.ui;
const toast = (ops, s, kind) => ops.game.ui.toast(s, kind ? { kind } : {});
const learn = (ops, w) => { const L = ops.game.lang; if (L && w && WORD[w] && !L.known(w)) L.learn(w, 'teach'); };
const buff = (ops, id) => { const V = ops.game.venues; if (V) V.buff(id); };
/** 사람이 들어오는 자리: 1층은 정문 안쪽, 다른 층은 승강기 홀 */
function arrival(ops, out) {
  const B = ops.cur.B, G = B.G, L = out.L;
  if (out.i === B.ground && L.ents.main) { const e = L.ents.main, i = e.c % G.gw, j = (e.c / G.gw) | 0; return ops.agents.freeNear(out.i, G.ox + i + 0.5 - e.dir[0] * 2, G.oz + j + 0.5 - e.dir[1] * 2); }
  const hall = L.lifthall != null ? L.rooms[L.lifthall] : L.rooms.find((R) => R.circ && R.n) || L.rooms.find((R) => R.n);
  return ops.agents.freeNear(out.i, G.ox + hall.cx + 0.5, G.oz + hall.cz + 0.5);
}
function staffSpec(ops, out, T, role, title, F, extra = {}) { const [gx, gz] = F ? BK(F) : arrival(ops, out); return { key: `${T.uid}:${out.i}:${role}:${F ? F.id : 0}`, role, title, floor: out.i, gx, gz, staff: true, ...extra }; }
/** 시설 앞에 서서 일하기 반복 (앉아·서서) */
function loopAt(F, pose, t = 6, useBack = false) { return () => [{ go: useBack ? BK(F) : AT(F) }, { face: useBack ? yawTo(F) + Math.PI : yawTo(F), act: pose, t }]; }
function spawn(ops, spec, plan, next) { const a = ops.agents.spawn({ ...spec, plan, next }); a.staff = !!spec.staff; return a; }
/** 일자리 정의 → 과제 생성 함수 모음 */
export function roleOf(op, id) { const T = TYPES[op]; return T && T.roles ? T.roles[id] : null; }

// ── 물건 칸 채우기 (구역의 가게·창고 재고에서 — 새로 만들지 않는다) ──
function fillShelves(ops, T, out, catOf) {
  const n = T.node, E = ops.econ;
  for (const [fid, slots] of out.slots) {
    const F = slots[0].fix;
    if (F.tag !== 'shelf') continue;
    const cat = catOf(F);
    slots.forEach((s, si) => {
      const key = `${fid}/${si}`;
      if (n.shelf[key]) return;
      const list = SHELF_GOODS[cat] || SHELF_GOODS.pantry;
      const g = list[(si + hashStr(fid)) % list.length];
      const cap = Math.min(40, s.n * (s.stack || 1));
      const want = Math.round(cap * 0.75);
      const got = E.take(T.zone, 'retail', g, want) + 0;
      const more = got < want ? E.take(T.zone, 'depot', g, want - got) : 0;
      n.shelf[key] = { g, n: got + more, cap, cat };
      // 창고에도 그 물건 (진열 칸의 한 배)
      if (!n.stockInit) n.stockInit = {};
      if (!n.stockInit[g]) { n.stockInit[g] = 1; n.stock[g] = (n.stock[g] || 0) + E.take(T.zone, 'depot', g, cap) + E.take(T.zone, 'retail', g, Math.round(cap / 2)); }
    });
  }
}
/** 진열대에 있는 물건 목록 (가게 고르기 카드) */
function shelfGoods(T, F, out) {
  const slots = out.slots.get(F.id) || [];
  const m = new Map();
  slots.forEach((s, si) => { const st = T.node.shelf[`${F.id}/${si}`]; if (!st) return; const e = m.get(st.g) || { g: st.g, n: 0, cap: 0, keys: [] }; e.n += st.n; e.cap += st.cap; e.keys.push(`${F.id}/${si}`); m.set(st.g, e); });
  return [...m.values()];
}
const CAT_NAME = CATS; // 진열 구역 20가지 (data/goods.js)
const catOfMart = (F) => F.cat || (F.t === 'chiller' ? 'chill' : F.t === 'produce' ? 'fresh' : F.t === 'display' ? 'bakery' : F.t === 'medshelf' ? 'med' : 'pantry');

// ════════════════════════════════════════════════════════════
// 마트 · 상가 · 백화점 · 작은 가게
// ════════════════════════════════════════════════════════════
const mart = {
  setup(ops, T, out) { fillShelves(ops, T, out, catOfMart); },
  act(ops, T, F, out) {
    if (F.tag === 'shelf') {
      const cat = catOfMart(F);
      return { label: () => `진열대 · ${CAT_NAME[cat] || cat}${ops.basket.length ? ` (바구니 ${ops.basket.length})` : ''}`, short: '고르기', use: () => mart.browse(ops, T, F, out) };
    }
    if (F.tag === 'basket') return { label: ops.basket.length ? '바구니 쌓개 · 바구니 내려놓기(물건은 제자리로)' : '바구니 쌓개 · 바구니 들기', short: '바구니', use: () => { if (ops.basket.length) ops.returnBasket(); else { toast(ops, '바구니를 들었다 · 진열대에서 E 로 담아요'); ops._basketHeld = true; ops._basketVis(); } } };
    if (F.tag === 'checkout') {
      const self = F.t === 'selfcheck';
      const job = ops.myJobHere(), sh = ops.S.shift;
      if (!self && sh && job && job.role === 'cashier') return { label: '계산대 · 손님 받기 (계산원)', short: '계산', use: () => mart.cashier(ops, T, F, out) };
      return { label: `${self ? '셀프 계산대' : '계산대'} · ${ops.basket.length ? `${ops.basket.length}개 계산하기` : '바구니가 비어 있어요'}`, short: '계산', use: () => ops.checkout(T, !self) };
    }
    if (F.tag === 'stock') return { label: () => `물품 창고 선반 · ${ops.myJobHere() ? '상자 보기' : '직원만'}`, short: '창고', use: () => mart.stockView(ops, T, F, out) };
    if (F.tag === 'clock') return clockAct(ops, T);
    if (F.tag === 'terminal' || F.tag === 'directory') return { label: F.tag === 'directory' ? '안내 빛판 · 층 안내·물건 찾기' : '울림판 단말', short: '단말', use: () => ops.apps.open(F.tag === 'directory' ? 'directory' : 'home', { T, F }) };
    if (F.tag === 'pallet' || F.tag === 'cart') return { label: '짐판 · 들어온 짐', short: '짐', use: () => mart.dockView(ops, T, F, out) };
    if (F.tag === 'locker') return { label: '보관함', short: '보관함', use: () => toast(ops, '직원들의 보관함 — 이름 노래가 새겨진 칸들') };
    return null;
  },
  /** 진열대에서 고르기 */
  browse(ops, T, F, out) {
    if (ops.game.tips && ops.game.tips.first('shop', () => mart.browse(ops, T, F, out))) return;
    const list = shelfGoods(T, F, out);
    if (!list.length) { toast(ops, '빈 진열대예요', 'muted'); return; }
    const items = list.map((e) => ({
      label: `${gname(e.g)} · ${won(ops.econ.price(e.g))}`, sub: `진열 ${e.n}/${e.cap}${GOODS[e.g] && GOODS[e.g].eat ? ' · 먹으면 기운' : ''}`, stay: true, disabled: e.n <= 0,
      onClick: (b) => {
        const key = e.keys.find((k) => T.node.shelf[k].n > 0);
        if (!key || !ops.pick(T, key, out)) return;
        e.n--;
        b.querySelector('small').textContent = `진열 ${e.n}/${e.cap} · 바구니 ${ops.basket.length}개 (${won(Math.round(ops.basketTotal() * 100) / 100)})`;
        if (e.n <= 0) b.disabled = true;
      },
    }));
    ui(ops).serviceCard(`${T.org ? T.org.name : '가게'} · 진열대`, CAT_NAME[catOfMart(F)] || '진열대', `집으면 바구니에 담겨요(진열대에서 실제로 빠져요). 계산대에서 값을 치르면 가방으로. 가진 돈 ${won(ops.game.state.inv.starseed || 0)}`, items);
  },
  stockView(ops, T, F, out) {
    const st = Object.entries(T.node.stock).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
    const job = ops.myJobHere();
    ui(ops).serviceCard('물품 창고', '창고 재고', job ? '진열 담당이면 비어 가는 진열대의 상자를 들어 채워요 (출근 단말에서 출근하면 할 일이 나와요).' : '직원만 쓰는 창고예요. 일하고 싶으면 단말의 「일자리」를 보세요.', st.slice(0, 10).map(([k, n]) => ({ label: `${gname(k)} × ${Math.floor(n)}`, sub: ' ', disabled: true })));
  },
  dockView(ops, T, F, out) {
    const d = T.node.dock || [];
    const ord = T.node.orders || [];
    ui(ops).serviceCard('하역장', d.length ? `들어온 짐 ${d.length}` : '들어온 짐 없음', `물류 창고에 주문한 짐: ${ord.map((o) => `${gname(o.g)} ${o.n}`).join(', ') || '없음'}`, d.map((c) => ({ label: `${gname(c.g)} × ${c.n}`, sub: '하역 담당이 창고로 옮긴다', disabled: true })));
  },
  /** 계산원으로 손님 받기: 손님 바구니의 물건을 하나씩 빛판에 (박자 맞추기) */
  cashier(ops, T, F, out, fin) {
    const q = ops.agents.list.find((a) => a.data.atCheckout === F.id && a.basket && a.basket.length && !a.data.served);
    if (!q) { toast(ops, '줄 선 손님이 없어요. 손님이 바구니를 들고 오면 E', 'muted'); return; }
    const V = ops.game.venues;
    const n = q.basket.length;
    V._timing('계산대 · 물건 세기', `손님 바구니에 ${n}개. 빛 표시가 가운데 칸에 들어올 때 E — 하나씩 셉니다.`, Math.min(6, n), (hits) => {
      q.data.served = true;
      ops.taskDone(T);
      toast(ops, `${n}개 계산 · 정확히 ${hits}/${Math.min(6, n)}`, 'item');
      if (fin) fin();
    });
  },
  people(ops, T, out, i) {
    if (!open(ops, 0.27, 0.95)) return;
    // 계산원 (계산대 뒤)
    for (const F of tagged(out, 'checkout').filter((F) => F.t === 'checkout')) spawn(ops, staffSpec(ops, out, T, 'cashier', '계산원', F), [{ go: BK(F) }, { face: yawTo(F) + Math.PI, act: 'scan', t: 3 }], (a) => [{ face: yawTo(F) + Math.PI, act: ops.agents.list.some((c) => c.data.atCheckout === F.id) ? 'scan' : 'wait', t: 2 }]);
    // 진열 담당: 창고 → 진열대
    const racks = tagged(out, 'stock');
    const nStock = Math.min(2, Math.max(1, Math.round(T.area / 600)));
    for (let k = 0; k < nStock && racks.length; k++) spawn(ops, { ...staffSpec(ops, out, T, 'stocker', '진열 담당', racks[k % racks.length]), key: `${T.uid}:${i}:stocker${k}` }, [], (a) => mart.stockerPlan(ops, T, out, a));
    // 손님
    const want = Math.min(10, 3 + Math.round(T.area / 150));
    for (let k = 0; k < want; k++) mart.customer(ops, T, out, k * 4 + Math.random() * 3);
  },
  /** 손님 하나: 바구니 → 진열대 몇 곳(진짜로 집는다) → 계산대 줄 → 값(가구 → 가게) → 나감 */
  customer(ops, T, out, delay = 0) {
    const shelves = tagged(out, 'shelf');
    const checks = tagged(out, 'checkout');
    if (!shelves.length || !checks.length) return;
    const [gx, gz] = arrival(ops, out);
    const basketF = tagged(out, 'basket')[0];
    const plan = [{ wait: delay }];
    if (basketF) plan.push({ go: AT(basketF) }, { face: yawTo(basketF), act: 'reach', t: 0.8, fx: (a) => { a.basket = []; } });
    const n = 2 + Math.floor(Math.random() * 3);
    for (let k = 0; k < n; k++) {
      const F = pick(shelves);
      plan.push({ go: AT(F) }, { face: yawTo(F), act: 'reach', t: 1.4, fx: (a) => {
        a.basket = a.basket || [];
        const slots = out.slots.get(F.id) || [];
        const cand = slots.map((s, si) => `${F.id}/${si}`).filter((key) => T.node.shelf[key] && T.node.shelf[key].n > 0);
        if (!cand.length) return;
        const key = pick(cand);
        T.node.shelf[key].n--;
        a.basket.push({ g: T.node.shelf[key].g, from: key });
        out.itemsDirty = true;
      } });
    }
    const C = pick(checks);
    plan.push({ go: AT(C) }, { face: yawTo(C), act: 'wait', t: 0.5, fx: (a) => { a.data.atCheckout = C.id; } });
    plan.push({ act: 'wait', until: (a) => !a.basket || !a.basket.length || a.data.served || (a.data.qt = (a.data.qt || 0) + 0.5) > 2 + a.basket.length * 0.6 });
    plan.push({ act: 'talk', t: 0.6, fx: (a) => {
      // 값: 그 구역 가구 → 이 가게 금고 (돈이 모자라면 몇 개는 제자리에)
      const E = ops.econ, hh = `z:${T.zone}:hh`;
      for (const b of a.basket || []) {
        const p = E.price(b.g);
        if (E.transfer(hh, `n:${T.uid}`, p) < p) { const st = T.node.shelf[b.from]; if (st) st.n++; out.itemsDirty = true; }
        else T.node.sales += p;
      }
      a.basket = null; a.data.atCheckout = null; a.data.served = false;
    } });
    const [ex, ez] = arrival(ops, out);
    plan.push({ go: [ex, ez] });
    spawn(ops, { key: `${T.uid}:cust${Math.random().toString(36).slice(2, 7)}`, role: 'guest', title: '손님', floor: out.i, gx, gz }, plan, () => { if (ops.cur && open(ops, 0.27, 0.95)) setTimeout(() => ops.cur && mart.customer(ops, T, out, 1), 2000); return null; });
  },
  /** 진열 담당의 일: 가장 빈 칸 → 창고에서 그 물건 상자 → 채우기 */
  stockerPlan(ops, T, out, a) {
    const low = mart.lowest(T, out);
    const racks = tagged(out, 'stock');
    if (!low || !racks.length) return [{ act: 'look', t: 4 }];
    const R = pick(racks), S = low.F;
    return [
      { go: AT(R) }, { face: yawTo(R), act: 'stock', t: 1.5, fx: () => { const v = Math.min(low.st.cap - low.st.n, Math.floor(T.node.stock[low.st.g] || 0), 8); a.carry = v > 0 ? { g: low.st.g, n: v } : null; if (v > 0) T.node.stock[low.st.g] -= v; } },
      { go: AT(S) }, { face: yawTo(S), act: 'stock', t: 2.2, fx: () => { if (a.carry) { low.st.n += a.carry.n; out.itemsDirty = true; } a.carry = null; } },
    ];
  },
  /** 가장 빈 진열 칸 */
  lowest(T, out) {
    let best = null;
    for (const [fid, slots] of out.slots) {
      slots.forEach((s, si) => {
        const st = T.node.shelf[`${fid}/${si}`];
        if (!st || st.cap <= 0) return;
        const f = st.n / st.cap;
        if ((T.node.stock[st.g] || 0) <= 0) return;
        if (!best || f < best.f) best = { f, st, key: `${fid}/${si}`, F: s.fix };
      });
    }
    return best && best.f < 0.6 ? best : null;
  },
  tick(ops, T, out, dt) {
    // 지켜보는 동안 도착한 짐(하역장)은 짐판에 보인다 — 하역 담당(사람 또는 플레이어)이 창고로
    const d = T.node.dock;
    if (d && d.length && !ops.agents.list.some((a) => a.role === 'hauler' && a.floor === out.i)) {
      const pal = tagged(out, 'pallet')[0], rack = tagged(out, 'stock')[0];
      if (pal && rack && !ops.S.shift) spawn(ops, staffSpec(ops, out, T, 'hauler', '하역 담당', pal), [], (a) => {
        const c = d.shift();
        if (!c) return null;
        return [{ go: AT(pal) }, { face: yawTo(pal), act: 'stock', t: 1.2, fx: () => { a.carry = c; } }, { go: AT(rack) }, { face: yawTo(rack), act: 'stock', t: 1.4, fx: () => { T.node.stock[c.g] = (T.node.stock[c.g] || 0) + c.n; a.carry = null; } }];
      });
    }
    void dt;
  },
  roles: {
    stocker: { title: '진열 담당', wage: 1.6, hours: [0.3, 0.62], desc: '창고에서 상자를 들어 비어 가는 진열대를 채운다',
      next(ops, T) {
        const out = ops.cur.indoor.built.get(ops.cur.indoor.cur);
        if (!out) return null;
        const low = mart.lowest(T, out);
        if (!low) { toast(ops, '진열대가 다 차 있어요 — 잠시 뒤 다시', 'muted'); return null; }
        let box = null;
        return { title: `${gname(low.st.g)} 채우기`, steps: [
          { label: '창고 선반에서 상자 들기', short: '들기', at: (o) => tagged(o, 'stock')[0], do: () => { const v = Math.min(low.st.cap - low.st.n, Math.floor(T.node.stock[low.st.g] || 0), 10); if (v <= 0) { toast(ops, '창고에도 없어요 — 물류 창고 주문을 기다려요', 'muted'); ops.cancelTask(); return false; } T.node.stock[low.st.g] -= v; box = { g: low.st.g, n: v, kind: 'box', back: (c) => { T.node.stock[c.g] = (T.node.stock[c.g] || 0) + c.n; } }; ops.takeCarry(box); return true; } },
          { label: `진열대에 채우기 (${CAT_NAME[low.st.cat] || ''})`, short: '채우기', at: () => low.F, do: () => { const c = ops.dropCarry(); if (c) low.st.n += c.n; ops.dirty(); ops.taskDone(T); ops.game.avatar && ops.game.avatar.act && ops.game.avatar.act('stock', 1.6); toast(ops, `${gname(low.st.g)} ${c ? c.n : 0}개를 채웠다`, 'item'); return true; } },
        ], next: () => roleOf('mart', 'stocker').next(ops, T) };
      } },
    cashier: { title: '계산원', wage: 1.5, hours: [0.32, 0.7], desc: '계산대에서 손님 바구니의 물건을 세고 값을 받는다',
      next(ops, T) {
        return { title: '계산대 지키기', steps: [{ label: '계산대에서 줄 선 손님 받기', short: '계산', at: (o) => tagged(o, 'checkout').find((F) => F.t === 'checkout'), do: (F, fin) => { const out = ops.cur.indoor.built.get(ops.cur.indoor.cur); mart.cashier(ops, T, F, out, fin); return false; } }], next: () => roleOf('mart', 'cashier').next(ops, T) };
      } },
    hauler: { title: '하역 담당', wage: 1.7, hours: [0.28, 0.6], desc: '하역장에 들어온 짐을 창고 선반으로 옮긴다',
      next(ops, T) {
        const d = T.node.dock || [];
        if (!d.length) { toast(ops, '들어온 짐이 없어요 — 물류 창고에서 짐이 오면 알려 줄게요', 'muted'); return null; }
        const c = d[0];
        return { title: `${gname(c.g)} ${c.n}개 옮기기`, steps: [
          { label: '하역장 짐판에서 짐 들기', short: '들기', at: (o) => tagged(o, 'pallet')[0] || tagged(o, 'cart')[0], do: () => { d.shift(); ops.takeCarry({ ...c, kind: 'crate', back: (x) => d.unshift(x) }); return true; } },
          { label: '창고 선반에 내려놓기', short: '놓기', at: (o) => tagged(o, 'stock')[0], do: () => { const x = ops.dropCarry(); if (x) T.node.stock[x.g] = (T.node.stock[x.g] || 0) + x.n; ops.taskDone(T); return true; } },
        ], next: () => roleOf('mart', 'hauler').next(ops, T) };
      } },
    guide: { title: '안내 담당', wage: 1.4, hours: [0.3, 0.75], desc: '안내 빛판 앞에서 손님의 물음을 받고 찾는 진열대까지 함께 간다',
      next(ops, T) {
        const out = ops.cur.indoor.built.get(ops.cur.indoor.cur);
        const info = tagged(out, 'directory')[0] || tagged(out, 'basket')[0];
        const sh = tagged(out, 'shelf');
        if (!info || !sh.length) { toast(ops, '이 층엔 안내할 매장이 없어요', 'muted'); return null; }
        const F = pick(sh), want = (shelfGoods(T, F, out)[0] || {}).g;
        const ask = want ? gname(want) : CAT_NAME[catOfMart(F)] || '물건';
        return { title: `손님 안내 · ${ask}`, steps: [
          { label: '안내 빛판 앞에서 손님 맞기', short: '맞기', at: () => info, do: () => { toast(ops, `손님: 「${josa(ask, '은')} 어디 있어요?」`); ops.say(T, 'chat'); return true; } },
          { label: `${ask} 진열대까지 함께 가기`, short: '안내', at: () => F, do: () => { ops.taskDone(T); learn(ops, 'find'); toast(ops, '손님이 고맙다며 바구니에 담는다', 'item'); return true; } },
        ], next: () => roleOf('mart', 'guide').next(ops, T) };
      } },
    counter: { title: '재고 담당', wage: 1.4, hours: [0.3, 0.6], desc: '진열대를 돌며 재고를 세어 장부와 맞춘다',
      next(ops, T) {
        const out = ops.cur.indoor.built.get(ops.cur.indoor.cur);
        const sh = tagged(out, 'shelf').sort(() => Math.random() - 0.5).slice(0, 3);
        if (!sh.length) return null;
        let found = 0;
        return { title: '진열대 재고 세기', steps: sh.map((F, k) => ({ label: `${k + 1}번째 진열대 세기`, short: '세기', at: () => F, do: () => { const n = shelfGoods(T, F, out).reduce((a, e) => a + e.n, 0); found += n; audio.blip && audio.blip({ hz: 1100, to: 1300, dur: 0.06, gain: 0.05 }); toast(ops, `${CAT_NAME[catOfMart(F)] || ''} ${n}개`); return true; } })), done: () => { ops.taskDone(T); T.node.counted = found; toast(ops, `재고 장부를 맞췄다 · 진열 ${found}개`, 'item'); } };
      } },
  },
};

// ════════════════════════════════════════════════════════════
// 찻집 · 식당 · 식당가 · 급식 · 하늘 찻집
// ════════════════════════════════════════════════════════════
const DISHES = {
  tea: { name: '울림차', in: { tea: 1 }, cook: 4, price: 3, buff: 'glide' },
  meal: { name: '노래 한 상', in: { bread: 1, fruit: 1, spice: 1 }, cook: 8, price: 6, buff: 'full' },
  juice: { name: '열매즙', in: { fruit: 2 }, cook: 3, price: 3, buff: 'quick' },
  cookie: { name: '바람과자 접시', in: { cookie: 2 }, cook: 2, price: 4, buff: 'quick' },
  jelly: { name: '별젤리 그릇', in: { jelly: 1, nectar: 0 }, cook: 2, price: 3, buff: 'calm' },
  soup: { name: '빛보리 죽', in: { flour: 1, herb: 0, fruit: 1 }, cook: 6, price: 4, buff: 'full' },
};
const food = {
  setup(ops, T, out) {
    const n = T.node, E = ops.econ;
    if (!n.foodInit) {
      n.foodInit = true;
      for (const k of ['tea', 'bread', 'fruit', 'spice', 'cookie', 'jelly', 'flour']) n.stock[k] = (n.stock[k] || 0) + E.take(T.zone, 'retail', k, 12) + E.take(T.zone, 'depot', k, 6);
    }
    fillShelves(ops, T, out, () => 'bakery');
    if (!n.queue) n.queue = [];
  },
  can(T, d) { return Object.entries(DISHES[d].in).every(([k, v]) => (T.node.stock[k] || 0) >= v); },
  act(ops, T, F, out) {
    if (F.tag === 'order') return { label: () => { const o = ops._order; return o && o.T === T ? (o.ready ? `${DISHES[o.d].name} 나왔어요 · 받기` : `${DISHES[o.d].name} 짓는 중`) : '주문대 · 차림표'; }, short: '주문', use: () => food.order(ops, T, F, out) };
    if (F.tag === 'table') return { label: ops._tray ? '식탁 · 앉아서 먹기' : '식탁', short: '앉기', use: () => food.sit(ops, T, F, out) };
    if (F.tag === 'cook' || F.tag === 'prep') { const job = ops.myJobHere(); return { label: job && job.role === 'cook' ? '화덕 · 주문 짓기' : '주방 · 직원만', short: '주방', use: () => (job && job.role === 'cook' && ops.S.shift ? food.cookOne(ops, T, F, out) : toast(ops, '주방은 요리사만 들어가요', 'muted')) }; }
    if (F.tag === 'ingredients') return { label: '서늘함 · 재료', short: '재료', use: () => ui(ops).serviceCard('주방', '재료 (서늘함 속)', '여기 있는 재료로만 차림을 낼 수 있어요. 떨어지면 물류 창고에서 들어와요.', Object.entries(T.node.stock).filter(([, v]) => v > 0).map(([k, v]) => ({ label: `${gname(k)} × ${Math.floor(v)}`, disabled: true }))) };
    if (F.tag === 'shelf') return { label: '진열 유리장 · 빵·과자', short: '고르기', use: () => mart.browse(ops, T, F, out) };
    if (F.tag === 'clock') return clockAct(ops, T);
    if (F.tag === 'dishes') return { label: '그릇 씻개', short: '씻기', use: () => { if (ops.myJobHere() && ops.S.shift) { ops.game.venues._timing('설거지', '그릇이 빛 띠 가운데 올 때 E', 5, (h) => { ops.taskDone(T); toast(ops, `그릇 ${h}개를 반짝이게`, 'item'); }); } else toast(ops, '주방 일이에요', 'muted'); } };
    return null;
  },
  order(ops, T, F, out) {
    const g = ops.game, o = ops._order;
    if (o && o.T === T) {
      if (!o.ready) { toast(ops, `${DISHES[o.d].name} — 부엌에서 짓고 있어요`, 'muted'); return; }
      ui(ops).serviceCard(T.org ? T.org.name : '식당', `${DISHES[o.d].name} 나왔어요`, '쟁반을 들고 빈 식탁에 앉아 먹거나 싸 가요.', [
        { label: '쟁반 들고 식탁으로', primary: true, onClick: () => { ops._tray = o.d; ops._order = null; ops.takeCarry({ g: o.d, n: 1, kind: 'tray', label: DISHES[o.d].name }); toast(ops, '빈 식탁에서 E 로 앉아 먹어요'); } },
        { label: '싸 가기', sub: '가방에 넣는다', onClick: () => { const k = o.d === 'cookie' ? 'cookie' : o.d === 'tea' ? 'tea' : 'meal'; g.state.inv[k] = (g.state.inv[k] || 0) + 1; ops._order = null; toast(ops, `${josa(DISHES[o.d].name, '을')} 쌌다`, 'item'); } },
      ]);
      return;
    }
    const items = Object.entries(DISHES).map(([d, D]) => ({ label: `${D.name} · ${won(D.price)}`, sub: food.can(T, d) ? `${Object.keys(D.in).filter((k) => D.in[k]).map(gname).join('·')} · ${D.cook}초` : '재료가 떨어졌어요', disabled: !food.can(T, d) || (g.state.inv.starseed || 0) < D.price,
      onClick: () => {
        const paid = ops.econ.transfer('player', `n:${T.uid}`, D.price, `주문 · ${D.name}`);
        if (paid < D.price) return;
        T.node.sales += paid;
        ops._order = { T, d, ready: false, t: ops.t };
        T.node.queue.push({ d, who: 'player', t: ops.t });
        toast(ops, `${D.name} 주문 · 부엌에서 지어요`);
      } }));
    ui(ops).serviceCard(T.org ? T.org.name : '식당', '차림표', `가진 돈 ${won(g.state.inv.starseed || 0)} · 주문하면 요리사가 서늘함에서 재료를 꺼내 화덕에서 짓고 주문대에 내어 줘요.`, items);
  },
  sit(ops, T, F, out) {
    if (!ops.carry || ops.carry.kind !== 'tray') { toast(ops, '쟁반을 들고 와서 앉아요', 'muted'); return; }
    const d = ops.dropCarry().g;
    ops._tray = null;
    const D = DISHES[d];
    const g = ops.game;
    const [x, z] = ops.cur.indoor.world(F.x, F.z);
    g.player.yaw = Math.atan2(x - g.player.pos.x, z - g.player.pos.z);
    g.avatar && g.avatar.act && g.avatar.act('eat', 4);
    setTimeout(() => { buff(ops, D.buff); learn(ops, 'eat'); toast(ops, `${josa(D.name, '을')} 먹었다 · ${BUFFS[D.buff].name}`, 'item'); }, 2500);
  },
  /** 요리사(사람 또는 플레이어)가 주문 하나를 짓는다: 재료를 실제로 쓴다 */
  make(T, q) {
    const D = DISHES[q.d];
    if (!food.can(T, q.d)) return false;
    for (const [k, v] of Object.entries(D.in)) T.node.stock[k] -= v;
    return true;
  },
  cookOne(ops, T, F, out) {
    const q = T.node.queue[0];
    if (!q) { toast(ops, '들어온 주문이 없어요', 'muted'); return; }
    ops.game.venues._timing(`화덕 · ${DISHES[q.d].name}`, '불꽃이 가운데 올 때 E — 뒤집고 젓고 담는다', 4, (h) => {
      if (!food.make(T, q)) { toast(ops, '재료가 모자라요', 'muted'); return; }
      T.node.queue.shift();
      food.served(ops, T, q);
      ops.taskDone(T);
      toast(ops, `${DISHES[q.d].name} 완성 (${h}/4)`, 'item');
    });
  },
  served(ops, T, q) { if (q.who === 'player' && ops._order) ops._order.ready = true; if (q.agent) q.agent.data.ready = true; },
  people(ops, T, out, i) {
    if (!open(ops, 0.26, 0.97)) return;
    const stoves = tagged(out, 'cook');
    const ctr = tagged(out, 'order')[0];
    const cold = tagged(out, 'ingredients')[0];
    // 요리사: 주문이 있으면 서늘함 → 화덕 → 주문대
    if (stoves.length) spawn(ops, staffSpec(ops, out, T, 'cook', '요리사', stoves[0]), [], (a) => {
      const q = T.node.queue.find((x) => !x.taken);
      if (!q) return [{ go: AT(stoves[0]) }, { face: yawTo(stoves[0]), act: 'cook', t: 3 }];
      q.taken = true;
      const plan = [];
      if (cold) plan.push({ go: AT(cold) }, { face: yawTo(cold), act: 'reach', t: 1.2 });
      plan.push({ go: AT(stoves[0]) }, { face: yawTo(stoves[0]), act: 'cook', t: DISHES[q.d].cook * 0.8 });
      plan.push({ fx: () => { if (food.make(T, q)) { T.node.queue.splice(T.node.queue.indexOf(q), 1); food.served(ops, T, q); } else { T.node.queue.splice(T.node.queue.indexOf(q), 1); if (q.who === 'player' && ops._order) { ops.econ.transfer(`n:${T.uid}`, 'player', DISHES[q.d].price, '재료가 없어 돌려받음'); ops._order = null; toast(ops, '재료가 떨어져 값을 돌려받았어요', 'muted'); } } } });
      if (ctr) plan.push({ go: BK(ctr) }, { face: yawTo(ctr) + Math.PI, act: 'reach', t: 1 });
      return plan;
    });
    if (ctr) spawn(ops, staffSpec(ops, out, T, 'server', '주문 받는 이', ctr), [{ go: BK(ctr) }, { face: yawTo(ctr) + Math.PI, act: 'talk', t: 3 }], () => [{ face: yawTo(ctr) + Math.PI, act: 'wait', t: 4 }]);
    // 손님: 주문(값) → 기다림 → 받아 → 식탁에서 먹기 → 나감
    const tables = tagged(out, 'table');
    const want = Math.min(10, Math.round(tables.length * 0.8));
    for (let k = 0; k < want; k++) food.diner(ops, T, out, k * 5 + Math.random() * 4);
  },
  diner(ops, T, out, delay) {
    const ctr = tagged(out, 'order')[0], tables = tagged(out, 'table');
    if (!ctr || !tables.length) return;
    const [gx, gz] = arrival(ops, out);
    const d = Object.keys(DISHES).filter((x) => food.can(T, x))[0];
    if (!d) return;
    const tb = pick(tables);
    const plan = [{ wait: delay }, { go: AT(ctr) }, { face: yawTo(ctr), act: 'talk', t: 1.2, fx: (a) => { const p = DISHES[d].price; const v = ops.econ.transfer(`z:${T.zone}:hh`, `n:${T.uid}`, p); if (v >= p) { T.node.sales += v; T.node.queue.push({ d, agent: a, t: ops.t }); } else a.data.ready = true; } },
      { act: 'wait', until: (a) => a.data.ready }, { act: 'reach', t: 0.8, fx: (a) => { a.carry = { g: d }; } },
      { go: AT(tb) }, { face: yawTo(tb), act: 'eat', t: 14, fx: (a) => { a.carry = null; } }, { act: 'eat', t: 10 }];
    const [ex, ez] = arrival(ops, out);
    plan.push({ go: [ex, ez] });
    spawn(ops, { key: `${T.uid}:diner${Math.random().toString(36).slice(2, 7)}`, role: 'eat', title: '손님', floor: out.i, gx, gz }, plan, () => { if (ops.cur && open(ops, 0.26, 0.97)) setTimeout(() => ops.cur && food.diner(ops, T, out, 2), 3000); return null; });
  },
  tick(ops, T, out) {
    // 재료가 떨어져 가면 물류 창고에 (일하는 시간)
    const n = T.node;
    if ((ops._ft = (ops._ft || 0) + 1) % 300 === 0) for (const k of ['tea', 'bread', 'fruit', 'spice', 'cookie', 'jelly']) if ((n.stock[k] || 0) < 3 && !n.orders.some((o) => o.g === k)) { const v = ops.econ.take(T.zone, 'retail', k, 8); if (v) { ops.econ.transfer(`n:${T.uid}`, `z:${T.zone}:firms`, v * GOODS[k].base); n.orders.push({ g: k, n: v, at: ops.game.world.clock.time + 1 / 24 }); } }
    void out;
  },
  roles: {
    cook: { title: '요리사', wage: 1.7, hours: [0.3, 0.75], desc: '주문을 받아 서늘함의 재료로 화덕에서 짓는다', next(ops, T) { return { title: '주문 짓기', steps: [{ label: '화덕에서 주문 짓기', short: '짓기', at: (o) => tagged(o, 'cook')[0], do: () => { food.cookOne(ops, T); return true; } }] }; } },
    server: { title: '설거지·정리', wage: 1.3, hours: [0.35, 0.8], desc: '그릇을 씻고 식탁을 치운다', next(ops, T) { return { title: '그릇 씻기', steps: [{ label: '그릇 씻개에서 씻기', short: '씻기', at: (o) => tagged(o, 'dishes')[0], do: () => { ops.game.venues._timing('설거지', '그릇이 가운데 올 때 E', 5, () => ops.taskDone(T)); return true; } }] }; } },
  },
};

// ════════════════════════════════════════════════════════════
// 공장: 원료 통 → 기계 (공정) → 완성품 선반 → 물류 창고
// ════════════════════════════════════════════════════════════
const factory = {
  setup(ops, T, out) {
    const n = T.node, E = ops.econ;
    if (!n.line) {
      n.line = E.lineOf(ops.cur.r);
      const recs = LINES[n.line] || LINES.food;
      n.recs = recs;
      const need = {};
      for (const rk of recs) for (const [k, v] of Object.entries(RECIPES[rk].in)) need[k] = (need[k] || 0) + v * 6;
      for (const [k, v] of Object.entries(need)) n.stock[k] = (n.stock[k] || 0) + E.take(T.zone, 'depot', k, v);
      n.done = {}; // 완성품 (창고 선반)
    }
    // 기계마다 공정 (줄의 순서대로 공정을 돌려 맡긴다)
    const ms = tagged(out, 'machine').sort((a, b) => (a.line ?? 0) - (b.line ?? 0) || (a.step ?? 0) - (b.step ?? 0));
    ms.forEach((F, k) => { if (!n.mach[F.id]) n.mach[F.id] = { rec: n.recs[k % n.recs.length], prog: 0, loaded: false, run: false, broken: false, made: 0 }; });
    // 원료 통·완성품 선반의 보이는 칸
    for (const [fid, slots] of out.slots) {
      const F = slots[0].fix;
      if (F.tag === 'raw') slots.forEach((s, si) => { const ks = Object.keys(n.stock).filter((k) => GOODS[k] && GOODS[k].cat === 'raw' || ['flour', 'shard', 'panel', 'cloth'].includes(k)); n.bins = n.bins || []; if (!n.bins.find((b) => b.key === `${fid}/${si}`)) n.bins.push({ key: `${fid}/${si}`, g: ks[si % Math.max(1, ks.length)], n: 0, raw: true }); });
      if (F.tag === 'finished') slots.forEach((s, si) => { n.bins = n.bins || []; if (!n.bins.find((b) => b.key === `${fid}/${si}`)) n.bins.push({ key: `${fid}/${si}`, g: null, n: 0, done: true }); });
    }
    factory.syncBins(T);
  },
  /** 보이는 칸을 실제 재고에 맞춘다 */
  syncBins(T) {
    const n = T.node;
    for (const b of n.bins || []) {
      if (b.raw && b.g) b.n = Math.min(12, Math.floor(n.stock[b.g] || 0));
      if (b.done) { const ks = Object.keys(n.done).filter((k) => n.done[k] > 0); const g = ks[(n.bins.indexOf(b)) % Math.max(1, ks.length)]; b.g = g || null; b.n = g ? Math.min(12, Math.floor(n.done[g])) : 0; }
    }
  },
  canRun(T, m) { return Object.entries(RECIPES[m.rec].in).every(([k, v]) => (T.node.stock[k] || 0) >= v); },
  act(ops, T, F, out) {
    if (F.tag === 'machine') {
      const m = T.node.mach[F.id];
      if (!m) return null;
      const R = RECIPES[m.rec];
      return { label: () => `${FIX[F.t].name} · ${R.name} ${m.broken ? '(멈춤 — 정비 필요)' : m.run ? `${Math.round(m.prog * 100)}%` : factory.canRun(T, m) ? '(대기)' : '(원료 없음)'}`, short: '기계', use: () => factory.machineCard(ops, T, F, m) };
    }
    if (F.tag === 'raw') return { label: '원료 통 · 원료 재고', short: '원료', use: () => ui(ops).serviceCard('원료 창고', '원료 재고', '물류 창고에서 들어온 원료. 기계가 공정마다 이만큼씩 쓴다.', Object.entries(T.node.stock).filter(([, v]) => v > 0).map(([k, v]) => ({ label: `${gname(k)} × ${Math.floor(v)}`, disabled: true }))) };
    if (F.tag === 'finished') return { label: '완성품 선반', short: '완성품', use: () => ui(ops).serviceCard('완성품 창고', '실어 보낼 것', '하루 두 번 물류 창고로 실어 보내고, 그때 값을 받는다.', Object.entries(T.node.done).filter(([, v]) => v > 0).map(([k, v]) => ({ label: `${gname(k)} × ${Math.floor(v)}`, disabled: true })).concat([{ label: '지금 실어 보내기', sub: '물류 창고 → 가게로 간다 (값은 구역 회사 몫에서)', disabled: !Object.values(T.node.done).some((v) => v > 0), onClick: () => factory.ship(ops, T) }])) };
    if (F.tag === 'console') return { label: '관제 조종대 · 생산 현황', short: '관제', use: () => factory.dashboard(ops, T, out) };
    if (F.tag === 'qc') return { label: '검사대 · 완성품 검사', short: '검사', use: () => factory.qc(ops, T) };
    if (F.tag === 'tools' || F.tag === 'repair' || F.tag === 'parts') return { label: '정비 · 연장', short: '연장', use: () => toast(ops, '고장 난 기계 앞에서 E 로 정비할 수 있어요 (정비원)') };
    if (F.tag === 'clock') return clockAct(ops, T);
    if (F.tag === 'terminal') return { label: '울림판 단말', short: '단말', use: () => ops.apps.open('home', { T, F }) };
    return null;
  },
  machineCard(ops, T, F, m) {
    const R = RECIPES[m.rec];
    const job = ops.myJobHere(), on = ops.S.shift && job;
    const ins = Object.entries(R.in).map(([k, v]) => `${gname(k)} ${v} (있음 ${Math.floor(T.node.stock[k] || 0)})`).join(' · ');
    const outs = Object.entries(R.out).map(([k, v]) => `${gname(k)} ${v}`).join(' · ');
    const items = [];
    if (m.broken) items.push({ label: '정비하기', sub: '공명 결을 다시 맞춘다 (출력 맞추기)', primary: true, disabled: !on, onClick: () => ops.game.venues.powerWork({ kicker: '기계 정비', title: '공명 결 맞추기', pay: 0, onWin: () => { m.broken = false; ops.taskDone(T); toast(ops, '기계가 다시 돈다', 'item'); } }) });
    else if (!m.run) items.push({ label: '원료 넣고 돌리기', sub: factory.canRun(T, m) ? `${ins}` : '원료가 모자라요', primary: true, disabled: !on || !factory.canRun(T, m), onClick: () => { factory.load(T, m); ops.taskDone(T); ops.game.avatar && ops.game.avatar.act && ops.game.avatar.act('operate', 1.5); toast(ops, `${R.name} 시작`); } });
    ui(ops).serviceCard(FIX[F.t].name, R.name, `${ins} → ${outs} · 빛 ${R.energy} 단위${on ? '' : ' · (기계 조작은 이 공장 일꾼만 — 단말의 「일자리」)'}`, items, `<div class="svc-stat"><span>진행 <b>${Math.round(m.prog * 100)}%</b></span><span>만든 수 <b>${m.made}</b></span><span>상태 <b>${m.broken ? '멈춤' : m.run ? '도는 중' : '쉼'}</b></span></div>`);
  },
  load(T, m) { for (const [k, v] of Object.entries(RECIPES[m.rec].in)) T.node.stock[k] -= v; m.run = true; m.prog = 0; factory.syncBins(T); },
  ship(ops, T) {
    const n = T.node, E = ops.econ;
    let val = 0;
    for (const [k, v] of Object.entries(n.done)) { if (v <= 0) continue; E.give(T.zone, 'depot', k, v); val += v * (GOODS[k] ? GOODS[k].base : 1); n.done[k] = 0; }
    const paid = E.transfer(`z:${T.zone}:firms`, `n:${T.uid}`, val);
    n.sales += paid;
    factory.syncBins(T);
    toast(ops, `완성품을 물류 창고로 실어 보냈다 · 값 ${won(paid)} (공장 금고로)`, 'item');
    ops.dirtyAll();
  },
  dashboard(ops, T, out) {
    const n = T.node;
    const ms = (tagged(out, 'machine').map((F) => n.mach[F.id]).filter(Boolean));
    if (!ms.length && n.mach) ms.push(...Object.values(n.mach)); // 홀 층이 아직 그려지지 않았어도 공장의 기계 전부
    const z = ops.econ.S.Z[T.zone];
    ui(ops).serviceCard('관제실', `${T.org ? T.org.name : '공장'} · 생산 현황`, `공정 묶음: ${(n.recs || []).map((r) => RECIPES[r].name).join(' · ') || '—'}`, ms.map((m, k) => ({ label: `${k + 1}번 · ${RECIPES[m.rec].name}`, sub: m.broken ? '멈춤 (정비 필요)' : m.run ? `${Math.round(m.prog * 100)}%` : factory.canRun(T, m) ? '대기' : '원료 기다림', disabled: true })), `<div class="svc-stat"><span>금고 <b>${Math.round(n.cash)}</b></span><span>구역 빛 여유 <b>${Math.round(z ? z.energy : 0)}</b></span><span>판 값 <b>${Math.round(n.sales)}</b></span></div>`);
  },
  qc(ops, T) {
    const ks = Object.keys(T.node.done).filter((k) => T.node.done[k] > 0);
    if (!ks.length) { toast(ops, '검사할 완성품이 없어요', 'muted'); return; }
    const k = pick(ks);
    const bad = Math.random() < 0.4;
    ui(ops).serviceCard('검사대', `${gname(k)} 검사`, `빛판에 대어 결을 본다. ${bad ? '결이 한 군데 어긋나 보인다…' : '결이 고르다.'}`, [
      { label: '통과', onClick: () => { if (bad) { T.node.done[k] -= 1; toast(ops, '어긋난 것이 섞였다 — 다음엔 잘 봐요', 'muted'); } else { ops.taskDone(T); toast(ops, '통과 · 좋은 물건', 'item'); } } },
      { label: '불량으로 빼기', onClick: () => { if (bad) { T.node.done[k] -= 1; T.node.stock.shard = (T.node.stock.shard || 0); ops.taskDone(T); toast(ops, '불량을 골라냈다 (녹여서 다시 원료로)', 'item'); } else toast(ops, '멀쩡한 걸 뺐어요', 'muted'); } },
    ]);
  },
  tick(ops, T, out, dt) {
    const n = T.node, z = ops.econ.S.Z[T.zone];
    const work = open(ops, 0.28, 0.8);
    for (const F of tagged(out, 'machine')) {
      const m = n.mach[F.id];
      if (!m || !m.run || m.broken) continue;
      const R = RECIPES[m.rec];
      const e = R.energy * dt / 30;
      if (z && z.energy < e) continue; // 빛이 모자라면 멈칫
      if (z) z.energy -= e;
      m.prog += dt / (12 + R.hours * 10);
      if (m.prog >= 1) {
        m.prog = 0; m.run = false; m.made++;
        for (const [k, v] of Object.entries(R.out)) n.done[k] = (n.done[k] || 0) + v;
        if (Math.random() < 0.06) m.broken = true;
        factory.syncBins(T);
        out.itemsDirty = true;
        // 일꾼이 다시 넣는다 (플레이어가 조작원이 아닐 때)
        if (work && !(ops.S.shift && ops.myJobHere())) { if (factory.canRun(T, m)) factory.load(T, m); }
      }
    }
    // 원료가 모자라면 물류 창고에 주문 (값은 공장 금고에서)
    if ((n._oq = (n._oq || 0) + dt) > 20) {
      n._oq = 0;
      for (const rk of n.recs) for (const [k, v] of Object.entries(RECIPES[rk].in)) if ((n.stock[k] || 0) < v * 2 && !n.orders.some((o) => o.g === k)) { const got = ops.econ.take(T.zone, 'depot', k, v * 6); if (got) { ops.econ.transfer(`n:${T.uid}`, `z:${T.zone}:firms`, got * GOODS[k].base); n.orders.push({ g: k, n: got, at: ops.game.world.clock.time + 1 / 24 }); } }
      // 완성품이 쌓이면 실어 보낸다
      if (Object.values(n.done).reduce((a, b) => a + b, 0) > 24) factory.ship(ops, T);
    }
    // 도착한 원료는 하역 → 원료 통
    if (n.dock && n.dock.length) { for (const c of n.dock.splice(0)) n.stock[c.g] = (n.stock[c.g] || 0) + c.n; factory.syncBins(T); out.itemsDirty = true; }
  },
  people(ops, T, out, i) {
    if (!open(ops, 0.28, 0.8)) return;
    const ms = tagged(out, 'machine');
    ms.slice(0, 6).forEach((F, k) => spawn(ops, { ...staffSpec(ops, out, T, 'work', '기계 조작원', F), key: `${T.uid}:${i}:op${k}` }, loopAt(F, 'operate', 6)(), () => loopAt(F, Math.random() < 0.5 ? 'operate' : 'look', 5)()));
    const raw = tagged(out, 'raw')[0], fin = tagged(out, 'finished')[0];
    if (raw && ms.length) spawn(ops, staffSpec(ops, out, T, 'carry', '운반원', raw), [], (a) => { const M = pick(ms); return [{ go: AT(raw) }, { face: yawTo(raw), act: 'stock', t: 1.2, fx: () => { a.carry = { g: 'ore' }; } }, { go: AT(M) }, { face: yawTo(M), act: 'stock', t: 1.2, fx: () => { a.carry = null; } }, ...(fin ? [{ go: AT(M) }, { act: 'reach', t: 0.8, fx: () => { a.carry = { g: 'box' }; } }, { go: AT(fin) }, { face: yawTo(fin), act: 'stock', t: 1.2, fx: () => { a.carry = null; } }] : [])]; });
    const qc = tagged(out, 'qc')[0];
    if (qc) spawn(ops, staffSpec(ops, out, T, 'work', '품질 검사원', qc), loopAt(qc, 'operate', 8)(), () => loopAt(qc, 'operate', 8)());
    const con = tagged(out, 'console')[0];
    if (con) spawn(ops, staffSpec(ops, out, T, 'work', '관제원', con), loopAt(con, 'type', 8)(), () => loopAt(con, 'type', 8)());
  },
  roles: {
    operator: { title: '기계 조작원', wage: 1.9, hours: [0.3, 0.65], desc: '원료를 넣고 기계를 돌린다 (공정마다 실제 원료를 쓴다)',
      next(ops, T) { const out = ops.cur.indoor.built.get(ops.cur.indoor.cur); const M = tagged(out, 'machine').find((F) => { const m = T.node.mach[F.id]; return m && !m.run && !m.broken && factory.canRun(T, m); }); if (!M) { toast(ops, '돌릴 수 있는 기계가 없어요 (원료를 기다리거나 고장)', 'muted'); return null; } return { title: '기계 돌리기', steps: [{ label: `${FIX[M.t].name} · 원료 넣고 돌리기`, short: '돌리기', at: () => M, do: () => { factory.load(T, T.node.mach[M.id]); ops.taskDone(T); ops.game.avatar && ops.game.avatar.act && ops.game.avatar.act('operate', 1.5); return true; } }], next: () => roleOf('factory', 'operator').next(ops, T) }; } },
    mechanic: { title: '정비원', wage: 2.1, hours: [0.3, 0.7], desc: '멈춘 기계의 공명 결을 맞춰 다시 돌게 한다',
      next(ops, T) { const out = ops.cur.indoor.built.get(ops.cur.indoor.cur); const M = tagged(out, 'machine').find((F) => T.node.mach[F.id] && T.node.mach[F.id].broken); if (!M) { toast(ops, '고장 난 기계가 없어요', 'muted'); return null; } return { title: '기계 정비', steps: [{ label: '멈춘 기계 정비', short: '정비', at: () => M, do: () => { factory.machineCard(ops, T, M, T.node.mach[M.id]); return true; } }] }; } },
    inspector: { title: '품질 검사원', wage: 1.6, hours: [0.32, 0.66], desc: '완성품의 결을 보고 불량을 골라낸다', next(ops, T) { return { title: '완성품 검사', steps: [{ label: '검사대에서 검사', short: '검사', at: (o) => tagged(o, 'qc')[0], do: () => { factory.qc(ops, T); return true; } }] }; } },
  },
};

// ════════════════════════════════════════════════════════════
// 물류 창고: 들어온 짐 나누기 · 주문 골라 담기 · 상하차
// ════════════════════════════════════════════════════════════
const depot = {
  setup(ops, T, out) {
    const n = T.node, E = ops.econ;
    // 선반의 보이는 짐: 구역 창고 재고의 일부를 맡아 둔다 (가져오지 않고 보여 주기만 — 실제 재고는 구역 창고)
    n.bins = n.bins || [];
    const z = E.S.Z[T.zone];
    const ks = Object.keys(z ? z.depot : {}).filter((k) => z.depot[k] > 1).sort((a, b) => z.depot[b] - z.depot[a]);
    let k = 0;
    for (const [fid, slots] of out.slots) {
      const F = slots[0].fix;
      if (F.tag !== 'stock' && F.tag !== 'pallet') continue;
      slots.forEach((s, si) => { const key = `${fid}/${si}`; let b = n.bins.find((q) => q.key === key); if (!b) { b = { key, g: ks[k++ % Math.max(1, ks.length)], n: 0, view: true }; n.bins.push(b); } b.n = b.g && z ? Math.min(12, Math.floor(z.depot[b.g] / 8)) : 0; });
    }
  },
  act(ops, T, F, out) {
    if (F.tag === 'sort') return { label: '분류 띠 · 짐 나누기', short: '분류', use: () => { const job = ops.myJobHere(); if (!(job && ops.S.shift)) { toast(ops, '분류는 이 창고 일꾼이 해요 — 단말의 「일자리」', 'muted'); return; } ops.game.venues.payless = performance.now() + 120000; ops.game.venues.sortWork(); ops.taskDone(T); } };
    if (F.tag === 'stock') return { label: () => { const b = (T.node.bins || []).find((q) => q.key.startsWith(F.id + '/')); return `높은 짐 선반 · ${b && b.g ? gname(b.g) : '빈 칸'}`; }, short: '선반', use: () => depot.rackCard(ops, T, F) };
    if (F.tag === 'terminal') return { label: '배차 단말 · 짐 흐름', short: '배차', use: () => ops.apps.open('dispatch', { T, F }) };
    if (F.tag === 'drone') return { label: '짐 드론 자리', short: '드론', use: () => toast(ops, '짐 드론이 가게로 날아가는 자리 — 피킹한 짐을 여기 내려놓아요') };
    if (F.tag === 'clock') return clockAct(ops, T);
    if (F.tag === 'pallet') return { label: '짐판', short: '짐판', use: () => toast(ops, '하역·상차를 기다리는 짐판') };
    return null;
  },
  rackCard(ops, T, F) {
    const z = ops.econ.S.Z[T.zone];
    const bs = (T.node.bins || []).filter((q) => q.key.startsWith(F.id + '/') && q.g);
    ui(ops).serviceCard('물류 창고 · 선반', '보관 중인 것 (구역 창고 재고)', '이 구역 가게·식당·공장으로 갈 물건이 여기 모인다. 가게가 주문하면 골라 담아 드론·뜬차로 보낸다.', bs.map((b) => ({ label: gname(b.g), sub: `구역 재고 ${Math.floor(z.depot[b.g] || 0)}`, disabled: true })));
  },
  people(ops, T, out, i) {
    if (!open(ops, 0.25, 0.85)) return;
    const racks = tagged(out, 'stock'), sorters = tagged(out, 'sort'), pads = tagged(out, 'drone', 'pallet');
    sorters.slice(0, 2).forEach((F, k) => spawn(ops, { ...staffSpec(ops, out, T, 'work', '분류원', F), key: `${T.uid}:${i}:sort${k}` }, loopAt(F, 'operate', 6)(), () => loopAt(F, 'operate', 6)()));
    for (let k = 0; k < Math.min(3, racks.length); k++) spawn(ops, { ...staffSpec(ops, out, T, 'carry', '피킹 담당', racks[k]), key: `${T.uid}:${i}:pick${k}` }, [], (a) => { const R = pick(racks), P = pads.length ? pick(pads) : null; return [{ go: AT(R) }, { face: yawTo(R), act: 'reach', t: 1.4, fx: () => { a.carry = { g: 'box' }; } }, ...(P ? [{ go: AT(P) }, { face: yawTo(P), act: 'stock', t: 1.2, fx: () => { a.carry = null; } }] : [])]; });
  },
  roles: {
    sorter: { title: '분류원', wage: 1.6, hours: [0.27, 0.6], desc: '들어온 짐의 빛 띠를 보고 구역별 칸으로', next(ops, T) { return { title: '짐 나누기', steps: [{ label: '분류 띠에서 짐 나누기', short: '분류', at: (o) => tagged(o, 'sort')[0], do: () => { ops.game.venues.payless = performance.now() + 120000; ops.game.venues.sortWork(); ops.taskDone(T); return true; } }] }; } },
    picker: { title: '피킹 담당', wage: 1.7, hours: [0.3, 0.65], desc: '가게 주문서대로 선반에서 골라 드론 자리로',
      next(ops, T) {
        const out = ops.cur.indoor.built.get(ops.cur.indoor.cur);
        const racks = tagged(out, 'stock').filter((F) => (T.node.bins || []).some((b) => b.key.startsWith(F.id + '/') && b.g && b.n > 0));
        const pad = tagged(out, 'drone')[0] || tagged(out, 'pallet')[0];
        if (!racks.length || !pad) return null;
        const R = pick(racks), b = T.node.bins.find((q) => q.key.startsWith(R.id + '/') && q.g);
        return { title: `주문 골라 담기 · ${gname(b.g)}`, steps: [
          { label: `${gname(b.g)} 선반에서 상자 들기`, short: '들기', at: () => R, do: () => { const v = ops.econ.take(T.zone, 'depot', b.g, 6); ops.takeCarry({ g: b.g, n: v, kind: 'box', back: (c) => ops.econ.give(T.zone, 'depot', c.g, c.n) }); return true; } },
          { label: '드론 자리에 내려놓기 (가게로 출발)', short: '보내기', at: () => pad, do: () => { const c = ops.dropCarry(); if (c) ops.econ.give(T.zone, 'retail', c.g, c.n); ops.taskDone(T); toast(ops, `${gname(c.g)} ${c.n}개를 가게로 보냈다`, 'item'); return true; } },
        ], next: () => roleOf('depot', 'picker').next(ops, T) };
      } },
  },
};

// ════════════════════════════════════════════════════════════
// 사무 · 행정: 자리·회의·채용 · 직무마다 다른 단말 일
// ════════════════════════════════════════════════════════════
const office = {
  act(ops, T, F, out) {
    if (F.tag === 'desk') {
      const job = ops.myJobHere();
      const mine = job && ops.S.shift && job.k === T.k;
      return { label: mine ? '내 자리 · 일하기 (단말)' : '책상 · 누군가의 자리', short: mine ? '일하기' : '자리', use: () => (mine ? ops.apps.open('work', { T, F }) : toast(ops, '다른 사람의 자리예요. 단말은 「울림판 단말」이나 내 자리에서', 'muted')) };
    }
    if (F.tag === 'terminal' || F.tag === 'directory') return { label: F.tag === 'directory' ? '안내 빛판 · 층 안내' : '울림판 단말 · 일자리·업무·안내', short: '단말', use: () => ops.apps.open(F.tag === 'directory' ? 'directory' : 'home', { T, F }) };
    if (F.tag === 'interview') return { label: () => { const a = ops.S.apps.find((x) => x.uid === ops.cur.uid && x.k === T.k && x.status === 'interview'); return a ? `채용 면접실 · 면접 보기 (${a.title})` : '채용 면접실'; }, short: '면접', use: () => ops.apps.interview(T) };
    if (F.tag === 'meeting') return { label: '회의 탁자', short: '회의', use: () => { if (ops.myJobHere() && ops.S.shift) { ops.apps.open('meeting', { T, F }); } else toast(ops, '회의 중인 자리예요', 'muted'); } };
    if (F.tag === 'printer') return { label: '빛판 찍개', short: '찍기', use: () => toast(ops, '빛판에 문서를 새긴다 — 지잉') };
    if (F.tag === 'vending') return vendingAct(ops, T, F, out);
    if (F.tag === 'cook') return { label: '탕비실 조리대 · 차 한 잔', short: '차', use: () => { buff(ops, 'calm'); toast(ops, '따뜻한 차 한 잔 · 맑은 울림'); } };
    if (F.tag === 'civic') return { label: '민원 창구', short: '창구', use: () => civic.counter(ops, T, F) };
    if (F.tag === 'queue') return { label: '번호표 기둥', short: '번호표', use: () => { ops._ticketNo = (ops._ticketNo || 40) + 1; toast(ops, `번호표 ${ops._ticketNo} · 창구에서 부르면 가요`); } };
    if (F.tag === 'records') return { label: '기록 보관함', short: '기록', use: () => toast(ops, '이 회사·구역의 결정 기록이 칸마다 잠들어 있다') };
    if (F.tag === 'council') return { label: '둥근 의회 탁자', short: '의회', use: () => civic.council(ops, T) };
    if (F.tag === 'clock') return clockAct(ops, T);
    return null;
  },
  people(ops, T, out, i) {
    const t = tod(ops);
    const desks = tagged(out, 'desk');
    const busy = t > 0.33 && t < 0.72 ? 0.8 : t > 0.28 && t < 0.8 ? 0.35 : 0.05;
    let k = 0;
    for (const F of desks) {
      if (Math.random() > busy || k > 14) continue;
      spawn(ops, { ...staffSpec(ops, out, T, 'clerk', '사무원', F), key: `${T.uid}:${i}:desk${F.id}`, gx: F.ax, gz: F.az }, [{ face: yawTo(F), act: 'sitType', t: 10 + Math.random() * 20 }], () => (Math.random() < 0.15 ? office.wander(ops, out, F) : [{ face: yawTo(F), act: 'sitType', t: 15 + Math.random() * 20 }]));
      k++;
    }
    const meet = tagged(out, 'meeting')[0];
    if (meet && busy > 0.3) for (let m = 0; m < 3; m++) spawn(ops, { ...staffSpec(ops, out, T, 'clerk', '회의 중', meet), key: `${T.uid}:${i}:meet${m}`, gx: meet.x + (m - 1) * 0.9, gz: meet.z + 1.2 }, [{ go: [meet.x + (m - 1) * 0.9, meet.z + (m % 2 ? 1.2 : -1.2)] }, { face: 0, act: m === 0 ? 'talk' : 'sit', t: 20 }], () => [{ act: Math.random() < 0.3 ? 'talk' : 'sit', t: 12 }]);
    const ctr = tagged(out, 'civic');
    ctr.forEach((F, c) => spawn(ops, { ...staffSpec(ops, out, T, 'clerk', '민원 담당', F), key: `${T.uid}:${i}:civ${c}` }, loopAt(F, 'type', 8, true)(), () => loopAt(F, 'type', 8, true)()));
    const seats = tagged(out, 'wait');
    if (ctr.length) for (let w = 0; w < Math.min(6, seats.length * 2); w++) { const S = pick(seats); spawn(ops, { key: `${T.uid}:${i}:cit${w}`, role: 'wait', title: '민원인', floor: i, gx: S.ax, gz: S.az }, [{ face: yawTo(S) + Math.PI, act: 'sit', t: 8 + Math.random() * 20 }, { go: AT(pick(ctr)) }, { act: 'talk', t: 6 }, { go: arrival(ops, out) }]); }
  },
  wander(ops, out, F) {
    const w = tagged(out, 'cook', 'vending', 'printer');
    if (!w.length) return [{ act: 'sitType', t: 20 }];
    const X = pick(w);
    return [{ go: AT(X) }, { face: yawTo(X), act: 'reach', t: 4 }, { go: AT(F) }, { face: yawTo(F), act: 'sitType', t: 20 }];
  },
  roles: {
    clerk: { title: '사무원', wage: 1.8, hours: [0.33, 0.7], desc: '장부의 들고 남을 맞춘다 (내 자리 단말 · 장부 맞추기)', app: 'ledger', next: (ops, T) => office.deskTask(ops, T, 'ledger') },
    translator: { title: '번역가', wage: 2.0, hours: [0.33, 0.7], desc: '아웬의 글자 문서를 풀어 옮긴다 (아는 말이 많을수록 잘한다)', app: 'glyph', next: (ops, T) => office.deskTask(ops, T, 'glyph') },
    dispatcher: { title: '배차 담당', wage: 1.9, hours: [0.3, 0.68], desc: '구역 가게들의 주문에 짐 드론을 맞춰 보낸다', app: 'dispatch', next: (ops, T) => office.deskTask(ops, T, 'dispatch') },
    designer: { title: '설계사', wage: 2.2, hours: [0.35, 0.72], desc: '빛판 설계: 부품을 맞춰 도면을 완성한다', app: 'design', next: (ops, T) => office.deskTask(ops, T, 'design') },
    analyst: { title: '분석가', wage: 2.1, hours: [0.35, 0.72], desc: '구역 살림의 흐름에서 어긋난 곳을 찾는다', app: 'chart', next: (ops, T) => office.deskTask(ops, T, 'chart') },
  },
  deskTask(ops, T, app) {
    return { title: '단말 일', steps: [{ label: '내 자리에서 단말 일하기', short: '일하기', at: (o) => tagged(o, 'desk')[0], do: () => { ops.apps.open('work', { T, app }); return true; } }] };
  },
};
const civic = {
  counter(ops, T, F) {
    const g = ops.game;
    const items = [
      { label: '주민 등록 확인', sub: g.state.nameSong ? '이름 노래가 등록되어 있다' : '이름 노래를 받으면 시민이 된다', onClick: () => toast(ops, g.state.nameSong ? '등록된 시민이에요. 이웃 의회에 나갈 수 있어요' : '아직 이름 노래가 없어요 — 이야기를 따라가면 받게 돼요') },
      { label: '집 주소 확인', sub: g.state.home != null ? '우리 집 기록이 있다' : '아직 집이 없다', onClick: () => toast(ops, g.state.home != null ? '우리 집 문패가 등록되어 있어요' : '집은 이웃이 되면 하모네아가 내어 줘요') },
      { label: '구역 살림 보기', sub: '이 구역의 돈·만든 것·판 것', onClick: () => ui(ops).infoCard('구역 살림', ops.econ.S.Z[T.zone] ? '이번 시간' : '', ops.econ.summary(T.zone)) },
      { label: '일 허가 받기 · 1울', sub: '공장·발전소 일자리 지원에 필요하다', disabled: g.state.flags.workPermit, onClick: () => { if (ops.econ.transfer('player', `z:${T.zone}:commons`, 1, '일 허가 수수료') >= 1) { g.state.flags.workPermit = true; toast(ops, '일 허가증을 받았다 · 공장·발전소에 지원할 수 있어요', 'item'); } } },
    ];
    ui(ops).serviceCard('민원 창구', '무엇을 도와드릴까요?', '번호표를 뽑고 차례가 오면 창구에서 처리해요.', items);
  },
  council(ops, T) {
    const g = ops.game;
    if (!g.state.nameSong) { toast(ops, '의회는 시민(이름 노래를 받은 이)만 앉을 수 있어요', 'muted'); return; }
    const z = ops.econ.S.Z[T.zone];
    ui(ops).serviceCard('이웃 의회', '오늘의 안건', '공공 몫의 돈을 어디에 쓸지 노래로 정한다.', [
      { label: '학교 수업을 늘리자', onClick: () => { ops.econ.transfer(`z:${T.zone}:commons`, `z:${T.zone}:hh`, z.commons * 0.02); toast(ops, '의회가 뜻을 모았다 · 교사 품삯이 늘었다', 'item'); learn(ops, 'together'); } },
      { label: '발전소 연료를 사 두자', onClick: () => { const v = Math.min(z.commons * 0.02, 50); ops.econ.transfer(`z:${T.zone}:commons`, `z:${T.zone}:firms`, v); z.depot.fuel = (z.depot.fuel || 0) + v / 0.8; toast(ops, '연료 결정을 들였다 · 밤에도 빛이 넉넉하다', 'item'); } },
    ]);
  },
};

// ════════════════════════════════════════════════════════════
// 연구소: 시료 → 손질 → 장비 측정 → 분석 → 진척
// ════════════════════════════════════════════════════════════
const PROJECTS = [
  { id: 'growth', name: '결정 생장 조건', inst: 'grower', word: 'grow', reward: 'shard' },
  { id: 'spectra', name: '물질의 공명 분광', inst: 'spectro', word: 'song', reward: 'part' },
  { id: 'scan', name: '생명결 스캔', inst: 'scanner', word: 'heal', reward: 'medicine' },
];
const lab = {
  st(ops) { const b = ops.bstate(ops.cur.uid); if (!b.lab) b.lab = { p: {}, samples: 0, data: 0 }; return b.lab; },
  act(ops, T, F, out) {
    const L = lab.st(ops);
    if (F.tag === 'samples') return { label: '시료 냉장고 · 시료 꺼내기', short: '시료', use: () => { if (ops.carry) return; ops.takeCarry({ g: 'sample', n: 1, kind: 'vial', label: '시료 병' }); toast(ops, '시료 병을 꺼냈다 · 실험대에서 손질해요'); } };
    if (F.tag === 'bench') return { label: ops.carry && ops.carry.kind === 'vial' ? '실험대 · 시료 손질하기' : '실험대', short: '손질', use: () => { if (!(ops.carry && ops.carry.kind === 'vial')) { toast(ops, '시료 냉장고에서 시료를 먼저', 'muted'); return; } ops.game.venues._timing('실험대 · 시료 손질', '결정 가루를 고르게 — 빛이 가운데 올 때 E', 4, (h) => { ops.carry.prepared = h >= 3; ops.carry.label = h >= 3 ? '손질한 시료' : '덜 손질한 시료'; toast(ops, h >= 3 ? '시료가 고르게 손질됐다 · 장비로' : '조금 고르지 않다… 그래도 장비로', h >= 3 ? 'item' : 'muted'); }); } };
    if (F.tag === 'instrument') {
      const P = PROJECTS.find((p) => p.inst === F.inst) || PROJECTS[1];
      return { label: `${FIX[F.t].name} · ${P.name} 측정`, short: '측정', use: () => lab.measure(ops, T, F, P) };
    }
    if (F.tag === 'analysis') return { label: () => `분석 단말 · 측정 자료 ${L.data}`, short: '분석', use: () => ops.apps.open('analysis', { T, F }) };
    if (F.tag === 'terminal') return { label: '울림판 단말', short: '단말', use: () => ops.apps.open('home', { T, F }) };
    if (F.tag === 'clock') return clockAct(ops, T);
    return null;
  },
  measure(ops, T, F, P) {
    if (!(ops.carry && ops.carry.kind === 'vial')) { toast(ops, '손질한 시료를 들고 와요', 'muted'); return; }
    const prepared = ops.carry.prepared;
    ops.dropCarry();
    // 물질의 음 맞추기 (아는 음으로)
    const V = ops.game.venues;
    const before = ops.game.state.inv.shard || 0;
    V.experiment();
    const L = lab.st(ops);
    setTimeout(() => {
      const ok = (ops.game.state.inv.shard || 0) > before;
      if (ok) { ops.game.state.inv.shard = before; ops.econ.goodsIn('shard', 1); } // 실험 보상 대신 측정 자료로 (결정 조각은 재고로 돌려놓는다)
      L.data += prepared ? 2 : 1;
      L.last = P.id;
      toast(ops, `측정 자료 +${prepared ? 2 : 1} · 분석 단말에서 풀어요`, 'item');
    }, 400);
  },
  /** 분석 앱에서 자료를 풀면 연구가 나아간다 */
  analyzed(ops, T, good) {
    const L = lab.st(ops);
    if (L.data <= 0) return;
    L.data--;
    const P = PROJECTS.find((p) => p.id === L.last) || PROJECTS[0];
    L.p[P.id] = Math.min(100, (L.p[P.id] || 0) + (good ? 12 : 5));
    ops.taskDone(T);
    if (L.p[P.id] >= 100 && !L[`done_${P.id}`]) {
      L[`done_${P.id}`] = true;
      // 성과로 받는 시제품은 연구원이 구역 창고에서 실제로 꺼내 준다 (물건은 저절로 생기지 않는다)
      const got = ops.econ.take(T.zone, 'depot', P.reward, 2);
      if (got > 0) ops.game.state.inv[P.reward] = (ops.game.state.inv[P.reward] || 0) + got;
      learn(ops, P.word);
      const paid = ops.econ.transfer(`n:${T.uid}`, 'player', 6, `연구 성과 · ${P.name}`);
      toast(ops, `연구 「${P.name}」 완성!${got ? ` · ${gname(P.reward)} ${got}` : ''}${paid ? ` · ${won(paid)}` : ''}`, 'item');
    } else toast(ops, `「${P.name}」 ${L.p[P.id]}%`, 'item');
  },
  people(ops, T, out, i) {
    if (!open(ops, 0.3, 0.82)) return;
    const spots = tagged(out, 'bench', 'instrument', 'analysis');
    spots.slice(0, 8).forEach((F, k) => spawn(ops, { ...staffSpec(ops, out, T, 'research', '연구원', F), key: `${T.uid}:${i}:res${k}`, gx: F.ax, gz: F.az }, [{ face: yawTo(F), act: F.tag === 'analysis' ? 'sitType' : 'operate', t: 10 }], () => { const X = pick(spots); return [{ go: AT(X) }, { face: yawTo(X), act: X.tag === 'analysis' ? 'sitType' : 'operate', t: 8 + Math.random() * 10 }]; }));
  },
  roles: { assistant: { title: '연구 보조', wage: 2.0, hours: [0.33, 0.72], desc: '시료를 손질하고 장비로 재고 자료를 푼다',
    next(ops, T) { return { title: '측정 한 번', steps: [
      { label: '시료 냉장고에서 시료 꺼내기', short: '꺼내기', at: (o) => tagged(o, 'samples')[0], do: () => { ops.takeCarry({ g: 'sample', n: 1, kind: 'vial', label: '시료 병' }); return true; } },
      { label: '실험대에서 손질', short: '손질', at: (o) => tagged(o, 'bench')[0], do: (F, fin) => { ops.game.venues._timing('시료 손질', '빛이 가운데 올 때 E', 4, (h) => { ops.carry && (ops.carry.prepared = h >= 3); fin(); }); return false; } },
      { label: '장비로 측정', short: '측정', at: (o) => tagged(o, 'instrument')[0], do: (F) => { lab.measure(ops, T, F, PROJECTS.find((p) => p.inst === F.inst) || PROJECTS[1]); return true; } },
      { label: '분석 단말에서 풀기', short: '분석', at: (o) => tagged(o, 'analysis')[0], do: () => { ops.apps.open('analysis', { T }); return true; } },
    ] }; } } },
};

// ════════════════════════════════════════════════════════════
// 학교: 시간표 · 수업 · 학생
// ════════════════════════════════════════════════════════════
const SUBJECTS = [
  { id: 'glyph', name: '글자 읽기', word: 'learn' }, { id: 'count', name: '수 세기 노래', word: 'many' }, { id: 'sky', name: '하늘 과학', word: 'star' },
  { id: 'song', name: '합창', word: 'chorus' }, { id: 'life', name: '생명결', word: 'grow' },
];
const school = {
  period(ops) { const t = tod(ops); if (t < 0.33 || t > 0.66) return null; const k = Math.floor((t - 0.33) / (1 / 24)); return { k, s: SUBJECTS[(k + Math.floor(ops.game.world.clock.time)) % SUBJECTS.length], brk: ((t - 0.33) % (1 / 24)) > (0.8 / 24) }; },
  act(ops, T, F, out) {
    const P = school.period(ops);
    const R = out.L.rooms[F.room];
    if (F.tag === 'student') return { label: P && !P.brk ? `${R.name} · ${P.s.name} 수업 듣기` : '학생 책상 · 쉬는 시간', short: '수업', use: () => school.lesson(ops, T, P) };
    if (F.tag === 'teacher') return { label: '선생님 책상', short: '선생님', use: () => { const job = ops.myJobHere(); if (job && ops.S.shift) school.assist(ops, T, out); else toast(ops, P ? `지금은 ${P.s.name} 시간` : '수업이 끝났어요', 'muted'); } };
    if (F.tag === 'board') return { label: '빛 칠판 · 시간표', short: '시간표', use: () => ui(ops).serviceCard('시간표', '오늘의 수업', '한 시간마다 바뀐다 (쉬는 시간 10분).', SUBJECTS.map((s, k) => ({ label: `${8 + k}시 · ${SUBJECTS[(k + Math.floor(ops.game.world.clock.time)) % SUBJECTS.length].name}`, disabled: true }))) };
    if (F.tag === 'order') return food.act(ops, T, F, out) || { label: '급식대', short: '급식', use: () => { if ((ops.game.state.inv.starseed || 0) >= 1 && ops.econ.transfer('player', `n:${T.uid}`, 1, '급식') >= 1) { buff(ops, 'full'); toast(ops, '오늘의 급식 · 든든함', 'item'); } } };
    if (F.tag === 'bench') return { label: '과학실 실험대', short: '실험', use: () => ops.game.venues.experiment() };
    if (F.tag === 'instrument') return { label: '노래 악기', short: '연주', use: () => { audio.sing && audio.sing([0, 2, 4, 2], { gain: 0.3 }); toast(ops, '고리 하프가 울린다'); } };
    if (F.tag === 'hoop' || F.tag === 'exercise') return { label: '뜀터 · 뛰어오르기', short: '운동', use: () => { buff(ops, 'quick'); toast(ops, '뜀 운동 · 가벼운 발', 'item'); } };
    if (F.tag === 'clock') return clockAct(ops, T);
    if (F.tag === 'terminal') return { label: '울림판 단말', short: '단말', use: () => ops.apps.open('home', { T, F }) };
    return null;
  },
  lesson(ops, T, P) {
    if (!P || P.brk) { toast(ops, '지금은 쉬는 시간이에요', 'muted'); return; }
    const S = ops.S;
    if (S.edu[`${P.s.id}:${Math.floor(ops.game.world.clock.time)}:${P.k}`]) { toast(ops, '이번 시간 수업은 들었어요', 'muted'); return; }
    S.edu[`${P.s.id}:${Math.floor(ops.game.world.clock.time)}:${P.k}`] = 1;
    if (P.s.id === 'glyph' || P.s.id === 'song') ops.game.venues.classQuiz();
    else if (P.s.id === 'count') school.countQuiz(ops);
    else school.factQuiz(ops, P.s);
    S.edu[P.s.id] = (S.edu[P.s.id] || 0) + 1;
    learn(ops, P.s.word);
  },
  countQuiz(ops) {
    const a = 2 + Math.floor(Math.random() * 6), b = 1 + Math.floor(Math.random() * 5);
    const ans = a + b;
    ui(ops).serviceCard('수 세기 노래', `빛방울 ${a} 개와 ${b} 개`, '아웬은 음의 개수로 수를 센다. 모두 몇 개일까요?', [ans - 1, ans, ans + 2].sort(() => Math.random() - 0.5).map((v) => ({ label: `${v}`, onClick: () => toast(ops, v === ans ? '맞아요!' : `${ans} 개였어요`, v === ans ? 'item' : 'muted') })));
  },
  factQuiz(ops, s) {
    const Q = s.id === 'sky' ? ['세렌이 도는 큰 별은?', ['우르', '해', '라르크'], 0] : ['빛잎이 자라려면?', ['빛과 물', '어둠', '얼음'], 0];
    ui(ops).serviceCard(s.name, Q[0], '선생님이 빛 칠판에 그림을 그린다.', Q[1].map((v, k) => ({ label: v, onClick: () => toast(ops, k === Q[2] ? '맞아요!' : `${josa(Q[1][Q[2]], '이에요')}`, k === Q[2] ? 'item' : 'muted') })));
  },
  assist(ops, T, out) {
    const st = tagged(out, 'student');
    if (!st.length) return;
    ops.startTask({ title: '학생 돕기', steps: st.sort(() => Math.random() - 0.5).slice(0, 2).map((F) => ({ label: '손 든 학생 자리에서 도와주기', short: '돕기', at: () => F, do: () => { ops.taskDone(T); learn(ops, 'learn'); toast(ops, '학생이 고개를 끄덕인다', 'item'); return true; } })) });
  },
  people(ops, T, out, i) {
    const P = school.period(ops);
    const t = tod(ops);
    if (t < 0.3 || t > 0.72) return;
    for (const R of out.L.rooms.filter((q) => q.n && (q.type === 'classroom' || q.type === 'sciroom' || q.type === 'musicroom'))) {
      const desks = out.fix.filter((F) => F.room === R.id && F.tag === 'student');
      const td = out.fix.find((F) => F.room === R.id && (F.tag === 'teacher' || F.tag === 'board'));
      if (td) spawn(ops, { ...staffSpec(ops, out, T, 'teach', '선생님', td), key: `${T.uid}:${i}:t${R.id}`, gx: td.ax, gz: td.az }, [{ face: yawTo(td) + Math.PI, act: 'teach', t: 12 }], () => [{ face: yawTo(td) + Math.PI, act: P && !P.brk ? 'teach' : 'look', t: 10 }]);
      desks.slice(0, 12).forEach((F, k) => spawn(ops, { key: `${T.uid}:${i}:s${R.id}:${k}`, role: 'student', title: '학생', age: 'child', floor: i, gx: F.ax, gz: F.az }, [{ face: yawTo(F), act: 'study', t: 15 }], () => { const p = school.period(ops); return p && p.brk ? [{ go: arrival(ops, out) }, { act: 'talk', t: 8 }, { go: AT(F) }, { face: yawTo(F), act: 'study', t: 10 }] : [{ face: yawTo(F), act: 'study', t: 15 }]; }));
    }
  },
  roles: { assistant: { title: '보조 교사', wage: 1.6, hours: [0.32, 0.66], desc: '수업 중 손 든 학생을 돕는다', next(ops, T) { const out = ops.cur.indoor.built.get(ops.cur.indoor.cur); school.assist(ops, T, out); return null; } } },
};

// ════════════════════════════════════════════════════════════
// 치유원 (병원): 접수 → 대기 → 진료 → 검사·치료 → 약
// ════════════════════════════════════════════════════════════
const clinic = {
  setup(ops, T, out) { const n = T.node; if (!n.medInit) { n.medInit = true; n.stock.medicine = (n.stock.medicine || 0) + ops.econ.take(T.zone, 'depot', 'medicine', 10) + ops.econ.take(T.zone, 'retail', 'medicine', 6); } fillShelves(ops, T, out, () => 'med'); },
  act(ops, T, F, out) {
    const V = ops.cur && ops.bstate(ops.cur.uid);
    if (F.tag === 'reception' || F.tag === 'queue' || F.tag === 'nurse') return { label: () => (V.visit ? `접수 · ${V.visit.step === 'wait' ? '대기 중' : V.visit.step === 'consult' ? '진료실로 가요' : V.visit.step === 'treat' ? '치료실로 가요' : '약제실로'}` : '접수 · 진료 받기'), short: '접수', use: () => clinic.reception(ops, T, out) };
    if (F.tag === 'wait') return { label: '대기 의자', short: '앉기', use: () => { ops.game.avatar && ops.game.avatar.act && ops.game.avatar.act('sit', 3); toast(ops, '차례를 기다린다'); } };
    if (F.tag === 'doctor') return { label: '진료 책상 · 치유사', short: '진료', use: () => clinic.consult(ops, T, out) };
    if (F.tag === 'scanner') return { label: '공명 스캐너', short: '검사', use: () => clinic.scan(ops, T) };
    if (F.tag === 'treat') return { label: '울림 치료 고치', short: '치료', use: () => clinic.treat(ops, T) };
    if (F.tag === 'pharmacy') return { label: '약제실 · 약 받기·사기', short: '약', use: () => clinic.pharmacy(ops, T) };
    if (F.tag === 'bed') return { label: '돌봄 침상', short: '침상', use: () => { const job = ops.myJobHere(); if (job && ops.S.shift) { ops.taskDone(T); toast(ops, '환자의 울림 결을 쟀다 · 고르다', 'item'); } else toast(ops, '쉬는 환자의 침상', 'muted'); } };
    if (F.tag === 'stock' || F.tag === 'shelf') return { label: '약 선반', short: '선반', use: () => toast(ops, `고른울림 약 ${Math.floor(T.node.stock.medicine || 0)}병`) };
    if (F.tag === 'clock') return clockAct(ops, T);
    if (F.tag === 'terminal') return { label: '울림판 단말', short: '단말', use: () => ops.apps.open('home', { T, F }) };
    return null;
  },
  reception(ops, T, out) {
    const V = ops.bstate(ops.cur.uid);
    if (V.visit) { toast(ops, V.visit.step === 'wait' ? '대기 의자에 앉아 부르기를 기다려요' : '안내판의 방으로 가요', 'muted'); if (V.visit.step === 'wait' && ops.t - V.visit.t > 8) { V.visit.step = 'consult'; toast(ops, '차례예요 · 진료실로'); } return; }
    ui(ops).serviceCard('치유원 · 접수', '어디가 어긋났나요?', '접수하면 대기 → 진료실(치유사) → 필요하면 검사·치료 → 약제실. 진료비 2울 (공공 몫이 반을 낸다).', [
      { label: '울림이 지쳤어요 (진료 받기 · 2울)', primary: true, disabled: (ops.game.state.inv.starseed || 0) < 2, onClick: () => { ops.econ.transfer('player', `n:${T.uid}`, 2, '진료비'); ops.econ.transfer(`z:${T.zone}:commons`, `n:${T.uid}`, 2); V.visit = { step: 'wait', t: ops.t }; toast(ops, '접수했어요 · 대기 의자에서 잠깐'); setTimeout(() => { if (V.visit && V.visit.step === 'wait') { V.visit.step = 'consult'; toast(ops, '차례예요 · 진료실(치유사)로 가요'); } }, 7000); } },
    ]);
  },
  consult(ops, T) {
    const V = ops.bstate(ops.cur.uid);
    if (!V.visit || V.visit.step !== 'consult') { toast(ops, '접수부터 해요', 'muted'); return; }
    ui(ops).serviceCard('진료실', '치유사', '「울림 결이 조금 흐트러졌네요. 스캐너로 결을 보고, 치료 고치에서 고르게 해요.」', [{ label: '검사·치료 받기', primary: true, onClick: () => { V.visit.step = 'treat'; toast(ops, '울림 검사실의 스캐너 → 치료실 고치로'); } }]);
  },
  scan(ops, T) { const V = ops.bstate(ops.cur.uid); if (V.visit) V.visit.scanned = true; audio.sing && audio.sing([0, 1, 2, 3, 4], { gain: 0.2, step: 0.2 }); toast(ops, '고리가 몸을 훑고 지나간다 · 결이 보인다', 'item'); },
  treat(ops, T) {
    const V = ops.bstate(ops.cur.uid);
    if (!V.visit || V.visit.step !== 'treat') { toast(ops, '진료를 먼저 받아요', 'muted'); return; }
    ops.game.avatar && ops.game.avatar.act && ops.game.avatar.act('lie', 3);
    audio.sing && audio.sing([4, 2, 0, 2, 4], { gain: 0.25, step: 0.35 });
    setTimeout(() => { buff(ops, 'calm'); learn(ops, 'heal'); V.visit.step = 'pharmacy'; toast(ops, '울림이 고르게 됐다 · 맑은 울림 · 약제실에서 약을 받아요', 'item'); }, 2500);
  },
  pharmacy(ops, T) {
    const V = ops.bstate(ops.cur.uid), n = T.node;
    const items = [];
    if (V.visit && V.visit.step === 'pharmacy') items.push({ label: '처방 약 받기', primary: true, disabled: (n.stock.medicine || 0) < 1, onClick: () => { n.stock.medicine--; ops.game.state.inv.medicine = (ops.game.state.inv.medicine || 0) + 1; V.visit = null; toast(ops, '고른울림 약 1 · 몸이 지치면 가방에서', 'item'); } });
    items.push({ label: '고른울림 약 사기 · 4울', disabled: (n.stock.medicine || 0) < 1 || (ops.game.state.inv.starseed || 0) < 4, onClick: () => { if (ops.econ.transfer('player', `n:${T.uid}`, 4, '약') >= 4) { n.stock.medicine--; ops.game.state.inv.medicine = (ops.game.state.inv.medicine || 0) + 1; toast(ops, '약을 샀다', 'item'); } } });
    ui(ops).serviceCard('약제실', `약 선반 ${Math.floor(n.stock.medicine || 0)}병`, '약은 약초잎·꽃꿀로 공장에서 달여 들어온다.', items);
  },
  people(ops, T, out, i) {
    const desk = tagged(out, 'reception', 'nurse')[0];
    if (desk) spawn(ops, staffSpec(ops, out, T, 'heal', '접수원', desk), loopAt(desk, 'talk', 8, true)(), () => loopAt(desk, 'type', 8, true)());
    for (const F of tagged(out, 'doctor').slice(0, 4)) spawn(ops, staffSpec(ops, out, T, 'heal', '치유사', F, { gx: F.ax, gz: F.az }), [{ face: yawTo(F), act: 'sitType', t: 12 }], () => [{ face: yawTo(F), act: Math.random() < 0.4 ? 'talk' : 'sitType', t: 10 }]);
    const seats = tagged(out, 'wait');
    for (let k = 0; k < Math.min(6, seats.length * 2); k++) { const S = pick(seats); const D = pick(tagged(out, 'doctor').concat(seats)); spawn(ops, { key: `${T.uid}:${i}:pat${k}`, role: 'patient', title: '환자', floor: i, gx: S.ax, gz: S.az }, [{ act: 'sit', t: 10 + Math.random() * 25 }, { go: AT(D) }, { face: yawTo(D), act: 'talk', t: 8 }, { go: arrival(ops, out) }]); }
    for (const B of tagged(out, 'bed').slice(0, 8)) if (Math.random() < 0.7) spawn(ops, { key: `${T.uid}:${i}:bed${B.id}`, role: 'patient', title: '입원한 이', floor: i, gx: B.x, gz: B.z }, [{ act: 'lie', t: 60 }], () => [{ act: 'lie', t: 60 }]);
  },
  roles: {
    nurse: { title: '간호 보조', wage: 1.8, hours: [0.3, 0.7], desc: '병동을 돌며 환자의 울림 결을 잰다', next(ops, T) { const out = ops.cur.indoor.built.get(ops.cur.indoor.cur); const beds = tagged(out, 'bed').slice(0, 3); if (!beds.length) { toast(ops, '이 층엔 침상이 없어요 — 병동 층으로', 'muted'); return null; } return { title: '병동 돌기', steps: beds.map((B, k) => ({ label: `${k + 1}번 침상 결 재기`, short: '재기', at: () => B, do: () => { ops.taskDone(T); return true; } })) }; } },
    pharm: { title: '약제 보조', wage: 1.7, hours: [0.32, 0.68], desc: '약 선반을 채우고 처방을 내준다', next(ops, T) { return { title: '약 채우기', steps: [{ label: '약 선반 정리', short: '정리', at: (o) => tagged(o, 'stock', 'shelf')[0], do: () => { const v = ops.econ.take(T.zone, 'depot', 'medicine', 4); T.node.stock.medicine = (T.node.stock.medicine || 0) + v; ops.taskDone(T); toast(ops, `약 ${v}병을 들였다`, 'item'); return true; } }] }; } },
  },
};

// ════════════════════════════════════════════════════════════
// 발전소: 연료 결정 → 공명 핵 → 구역의 빛
// ════════════════════════════════════════════════════════════
const plant = {
  setup(ops, T) { const n = T.node; if (!n.fuelInit) { n.fuelInit = true; n.stock.fuel = (n.stock.fuel || 0) + ops.econ.take(T.zone, 'depot', 'fuel', 30); n.out = 0.6; } },
  act(ops, T, F, out) {
    const z = ops.econ.S.Z[T.zone];
    if (F.tag === 'console') return { label: () => `조종대 · 출력 ${Math.round((T.node.out || 0) * 100)}% · 구역 빛 ${Math.round(z ? z.energy : 0)}`, short: '조종', use: () => { const job = ops.myJobHere(); if (!(job && ops.S.shift)) { toast(ops, '조종은 발전소 운전원만 — 단말의 「일자리」', 'muted'); return; } ops.game.venues.powerWork({ kicker: '공명 발전소 · 조종대', title: '출력 맞추기', pay: 0, onWin: () => { T.node.out = Math.min(1, (T.node.out || 0.6) + 0.15); if (z) { z.energy += 40; } ops.taskDone(T); toast(ops, '출력이 고르다 · 구역에 빛이 더 간다', 'item'); } }); } };
    if (F.tag === 'core') return { label: '공명 핵 · 연료 넣기', short: '연료', use: () => { if (ops.carry && ops.carry.g === 'fuel') { const c = ops.dropCarry(); T.node.stock.fuelIn = (T.node.stock.fuelIn || 0) + c.n; ops.taskDone(T); toast(ops, `연료 결정 ${c.n}개를 핵에 넣었다`, 'item'); } else toast(ops, '연료 결정고에서 연료를 들고 와요', 'muted'); } };
    if (F.tag === 'fuel') return { label: () => `연료 결정 선반 · ${Math.floor(T.node.stock.fuel || 0)}`, short: '연료', use: () => { const job = ops.myJobHere(); if (!(job && ops.S.shift)) { toast(ops, '연료는 일꾼만 나른다', 'muted'); return; } const v = Math.min(4, Math.floor(T.node.stock.fuel || 0)); if (!v) { toast(ops, '연료가 바닥났어요 — 물류 창고 주문을 기다려요', 'muted'); return; } T.node.stock.fuel -= v; ops.takeCarry({ g: 'fuel', n: v, kind: 'crystal', back: (c) => { T.node.stock.fuel += c.n; } }); } };
    if (F.tag === 'coil') return { label: '공명 코일 · 점검', short: '점검', use: () => { const job = ops.myJobHere(); if (job && ops.S.shift) ops.game.venues._timing('코일 점검', '고리 빛이 가운데 올 때 E', 4, (h) => { ops.taskDone(T); toast(ops, `코일 결 ${h}/4`, 'item'); }); else toast(ops, '코일이 낮게 웅웅거린다'); } };
    if (F.tag === 'pump') return { label: '식힘 펌프', short: '펌프', use: () => toast(ops, '식힘 물이 돈다') };
    if (F.tag === 'clock') return clockAct(ops, T);
    if (F.tag === 'terminal') return { label: '울림판 단말', short: '단말', use: () => ops.apps.open('home', { T, F }) };
    return null;
  },
  tick(ops, T, out, dt) {
    const n = T.node, z = ops.econ.S.Z[T.zone];
    // 핵에 넣은 연료를 태워 구역에 빛 (보이는 동안 빠르게)
    if ((n.stock.fuelIn || 0) > 0 && z) { const b = Math.min(n.stock.fuelIn, dt / 20); n.stock.fuelIn -= b; z.energy += b * 30 * (n.out || 0.6); }
    // 일꾼이 연료를 넣는다 (플레이어가 일하지 않을 때)
    if (!(ops.S.shift && ops.myJobHere()) && (n.stock.fuelIn || 0) < 1 && (n.stock.fuel || 0) > 2) { n.stock.fuel -= 2; n.stock.fuelIn = (n.stock.fuelIn || 0) + 2; }
    if ((n._oq = (n._oq || 0) + dt) > 30) { n._oq = 0; if ((n.stock.fuel || 0) < 10) { const v = ops.econ.take(T.zone, 'depot', 'fuel', 12); if (v) { ops.econ.transfer(`n:${T.uid}`, `z:${T.zone}:firms`, v * GOODS.fuel.base); n.stock.fuel += v; } } }
    void out;
  },
  people(ops, T, out, i) {
    for (const F of tagged(out, 'console').slice(0, 3)) spawn(ops, staffSpec(ops, out, T, 'work', '운전원', F, { gx: F.ax, gz: F.az }), [{ face: yawTo(F), act: 'type', t: 10 }], () => [{ face: yawTo(F), act: 'type', t: 10 }]);
    const coils = tagged(out, 'coil');
    if (coils.length) spawn(ops, staffSpec(ops, out, T, 'work', '정비원', coils[0]), [], () => { const C = pick(coils); return [{ go: AT(C) }, { face: yawTo(C), act: 'operate', t: 6 }]; });
  },
  roles: {
    operator: { title: '운전원', wage: 2.2, hours: [0.25, 0.75], desc: '핵의 출력을 띠 안에 붙잡아 구역에 빛을 고르게 보낸다', next(ops, T) { return { title: '출력 맞추기', steps: [{ label: '조종대에서 출력 맞추기', short: '조종', at: (o) => tagged(o, 'console')[0], do: (F) => { plant.act(ops, T, F).use(); return true; } }] }; } },
    fueler: { title: '연료 담당', wage: 1.9, hours: [0.25, 0.7], desc: '연료 결정고에서 핵까지 연료를 나른다', next(ops, T) { return { title: '연료 넣기', steps: [
      { label: '연료 결정 들기', short: '들기', at: (o) => tagged(o, 'fuel')[0], do: (F) => { plant.act(ops, T, F).use(); return !!ops.carry; } },
      { label: '공명 핵에 넣기', short: '넣기', at: (o) => tagged(o, 'core')[0], do: (F) => { plant.act(ops, T, F).use(); return true; } },
    ], next: () => roleOf('plant', 'fueler').next(ops, T) }; } },
  },
};

// ════════════════════════════════════════════════════════════
// 교통 터미널: 표 → 타는 문 → 타는 곳(뜬차·하늘배) → 다른 구역
// ════════════════════════════════════════════════════════════
const terminal = {
  act(ops, T, F, out) {
    if (F.tag === 'tickets') return { label: '표 기계 · 행선지 고르기', short: '표', use: () => ops.game.venues.tickets() };
    if (F.tag === 'gate') return { label: '타는 문', short: '문', use: () => toast(ops, '표가 있으면 문이 열려요 — 표 기계에서') };
    if (F.tag === 'board') return { label: '타는 곳 · 뜬차를 기다린다', short: '타기', use: () => ops.game.venues.tickets() };
    if (F.tag === 'departures') return { label: '떠나는 판', short: '보기', use: () => terminal.board(ops, T) };
    if (F.tag === 'wait') return { label: '긴 의자', short: '앉기', use: () => { ops.game.avatar && ops.game.avatar.act && ops.game.avatar.act('sit', 4); } };
    if (F.tag === 'clock') return clockAct(ops, T);
    if (F.tag === 'terminal') return { label: '울림판 단말', short: '단말', use: () => ops.apps.open('home', { T, F }) };
    return null;
  },
  board(ops, T) {
    const g = ops.game, here = ops.cur.r;
    const by = new Map();
    for (const r of g.city.recs) { if (r.use !== 'terminal' || r.zone === here.zone) continue; const d = Math.hypot(r.x - here.x, r.z - here.z); const c = by.get(r.zone); if (!c || d < c) by.set(r.zone, d); }
    const t = g.world.clock.time % 1;
    ui(ops).serviceCard('떠나는 판', '다음 출발', '뜬차·하늘배는 15분마다.', [...by.entries()].sort((a, b) => a[1] - b[1]).slice(0, 6).map(([z, d], k) => { const m = Math.round(((t * 24 * 60) + 15 * (k + 1)) % (24 * 60)); return { label: `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')} · ${z}`, sub: `${(d / 1000).toFixed(1)} km`, disabled: true }; }));
  },
  people(ops, T, out, i) {
    const gates = tagged(out, 'gate'), bays = tagged(out, 'board'), seats = tagged(out, 'wait'), tm = tagged(out, 'tickets');
    for (let k = 0; k < 10; k++) {
      const plan = [{ wait: k * 3 }];
      if (tm.length) { const M = pick(tm); plan.push({ go: AT(M) }, { face: yawTo(M), act: 'reach', t: 2 }); }
      if (seats.length && Math.random() < 0.5) { const S = pick(seats); plan.push({ go: AT(S) }, { act: 'sit', t: 10 + Math.random() * 15 }); }
      if (gates.length) plan.push({ go: AT(pick(gates)) });
      if (bays.length) { const Bb = pick(bays); plan.push({ go: [Bb.x, Bb.z] }, { act: 'wait', t: 5 }); }
      const [gx, gz] = arrival(ops, out);
      spawn(ops, { key: `${T.uid}:${i}:trav${k}`, role: 'wait', title: '나그네', floor: i, gx, gz }, plan);
    }
  },
  roles: { attendant: { title: '역무원', wage: 1.6, hours: [0.25, 0.8], desc: '타는 문에서 길을 묻는 나그네를 돕는다', next(ops, T) { return { title: '나그네 돕기', steps: [{ label: '타는 문에서 안내', short: '안내', at: (o) => tagged(o, 'gate')[0], do: () => { ops.taskDone(T); learn(ops, 'go'); toast(ops, '나그네가 고맙다며 고개를 숙인다', 'item'); return true; } }] }; } } },
};

// ════════════════════════════════════════════════════════════
// 박물관 · 서고 · 공연장
// ════════════════════════════════════════════════════════════
const museum = {
  act(ops, T, F, out) {
    if (F.tag === 'exhibit') {
      const E = museum.exhibitOf(ops, F);
      return { label: () => `전시 · ${E.title}${ops.game.venues.S.exhibits[E.id] ? ' ✓' : ''}`, short: '살펴보기', use: () => { const V = ops.game.venues; V.museum = museum.list(ops, out); V.museumKey = ops.cur.uid; V.exhibit(E); } };
    }
    if (F.tag === 'restore') return { label: '보존 작업대', short: '보존', use: () => { const job = ops.myJobHere(); if (job && ops.S.shift) ops.game.venues._timing('보존 처리', '결정 먼지를 걷어 낸다 — 빛이 가운데 올 때 E', 5, (h) => { ops.taskDone(T); toast(ops, `유물 하나가 맑아졌다 (${h}/5)`, 'item'); }); else toast(ops, '보존 처리사의 작업대', 'muted'); } };
    if (F.tag === 'shelf') return mart.act(ops, T, F, out);
    if (F.tag === 'checkout') return mart.act(ops, T, F, out);
    if (F.tag === 'directory') return { label: '안내 빛판 · 해설사와 둘러보기', short: '안내', use: () => {
      // 해설사 안내: 이 층의 서로 다른 전시 여섯을 가까운 차례로 비춘다 (박물관 전체 목록은 기념품 셈에 그대로)
      const V = ops.game.venues, p = ops.game.player.pos, ind = ops.cur.indoor;
      const all = museum.list(ops, out);
      const seen = new Set(), near = [];
      for (const m of all.slice().sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))) { if (seen.has(m.e.id)) continue; seen.add(m.e.id); near.push(m); if (near.length >= 6) break; }
      V.museum = near; V.museumKey = ops.cur.uid;
      V.K = { cx: p.x, cz: p.z, fy: ind.yOf(out.i), group: out.group };
      V.tour && V.tour();
      setTimeout(() => { V.museum = all; }, 100);
    } };
    if (F.tag === 'clock') return clockAct(ops, T);
    return null;
  },
  exhibitOf(ops, F) { const k = hashStr(`${ops.cur.uid}|${F.id}`) % EXHIBITS.length; return EXHIBITS[k]; },
  list(ops, out) {
    return tagged(out, 'exhibit').map((F) => { const [x, z] = ops.cur.indoor.world(F.x, F.z); return { e: museum.exhibitOf(ops, F), x, z }; });
  },
  setup(ops, T, out) { fillShelves(ops, T, out, () => 'gift'); },
  people(ops, T, out, i) {
    const ex = tagged(out, 'exhibit');
    if (!ex.length || !open(ops, 0.3, 0.85)) return;
    for (let k = 0; k < Math.min(8, ex.length); k++) {
      const [gx, gz] = arrival(ops, out);
      spawn(ops, { key: `${T.uid}:${i}:vis${k}`, role: 'guest', title: '관람객', floor: i, gx, gz }, [{ wait: k * 2 }], () => { const X = pick(ex); return [{ go: AT(X) }, { face: yawTo(X), act: 'look', t: 6 + Math.random() * 8 }]; });
    }
  },
  roles: { conservator: { title: '보존 처리사', wage: 1.9, hours: [0.33, 0.7], desc: '유물의 결정 먼지를 걷어 낸다', next(ops, T) { return { title: '유물 보존', steps: [{ label: '보존 작업대', short: '보존', at: (o) => tagged(o, 'restore')[0], do: (F) => { museum.act(ops, T, F).use(); return true; } }] }; } } },
};
const library = {
  // 서가마다 실제 책 (library.js) — 칸마다 책등, 고르면 쪽마다 읽고, 들고 가서 열람 탁자·대출대로
  setup(ops, T, out) { out.books = stockFor(ops.cur, T.zone, out.i, out.fix); ops.dirty(out.i); },
  carried(ops) { const c = ops.carry; return c && c.book ? c : null; },
  zoneName(ops, T) { return ZONE_NAMES[T.zone] || '이 구역'; },
  /** 서가: 꽂힌 책들 → 고르기 */
  browse(ops, T, out, F) {
    const en = out.books && out.books.get(F.id);
    if (!en) return;
    const g = ops.game;
    if (g.tips && g.tips.first('books', () => library.browse(ops, T, out, F))) return;
    const S = libState(g), gone = ops.booksGone(out.i);
    const xs = shelfTitles(en, (si, e) => gone.has(`${F.id}/${si}/${e}`));
    const list = xs.map((x) => { const b = bookById(x.id); return b && { ...x, title: b.title, author: b.author, color: bookColor(x.id), read: S.read[x.id] || 0, pages: b.pages.length, done: !!S.done[x.id] }; }).filter(Boolean);
    const total = xs.reduce((a, x) => a + x.n, 0);
    const name = en.annal ? `${library.zoneName(ops, T)} 연대 기록` : subjectName(en.subject);
    const fl = ops.cur.B.floors[out.i];
    ui(ops).bookShelf(`서가 · ${fl ? fl.label : ''}층`, name, `${list.length}가지 · ${total}권이 꽂혀 있어요. 고르면 펼쳐 읽고, 들고 가서 열람 탁자에서 앉아 읽거나 대출대에서 빌려요.${en.annal ? ' 권마다 그 구역의 한 해가 적혀 있어요.' : ''}`, list, (id) => library.open(ops, T, out, F, list.find((x) => x.id === id)));
  },
  /** 서가 앞에서 펼쳐 읽기 */
  open(ops, T, out, F, x) {
    const b = x && bookById(x.id);
    if (!b) return;
    const S = libState(ops.game);
    const page = S.done[x.id] ? 0 : Math.min(Math.max(0, (S.read[x.id] || 1) - 1), b.pages.length - 1);
    ui(ops).reader(b, { kicker: `${subjectName(b.subject)} · ${slotName(x.si, F)}`, page, onPage: (p) => readPage(ops.game, x.id, p), actions: [
      { label: '들고 가기', sub: '열람 탁자에 앉아 읽거나, 대출대에서 빌려 가방에 넣는다', primary: true, onClick: () => library.take(ops, out, F, x) },
      { label: '서가로 돌아가기', sub: '다른 책 고르기', onClick: () => library.browse(ops, T, out, F) },
    ] });
  },
  take(ops, out, F, x) {
    const b = bookById(x.id);
    const ok = ops.takeCarry({ kind: 'book', g: 'book', label: b.title, color: bookColor(x.id), book: { id: x.id, uid: ops.cur.uid, floor: out.i, fid: F.id, si: x.si, e: x.e }, back: () => { toast(ops, `「${b.title}」 — 서가 제자리에 돌려놓았다`, 'muted'); ops.dirty(out.i); } });
    if (ok) { ops.dirty(out.i); toast(ops, `「${b.title}」 · 열람 탁자에서 앉아 읽거나 대출대에서 빌려요`, 'item'); }
  },
  /** 손에 든 책 / 빌린 책 읽기 */
  read(ops, id, kicker) {
    const b = bookById(id);
    if (!b) return;
    const S = libState(ops.game);
    const page = S.done[id] ? 0 : Math.min(Math.max(0, (S.read[id] || 1) - 1), b.pages.length - 1);
    ui(ops).reader(b, { kicker, page, onPage: (p) => readPage(ops.game, id, p) });
  },
  /** 대출대: 들고 온 책 빌리기 · 빌린 책 돌려주기 (어느 서고에 돌려줘도 된다) */
  desk(ops, T, out) {
    const g = ops.game, S = libState(g), c = library.carried(ops), day = g.world.clock.day;
    if (c) {
      if (S.borrowed.length >= 6) { toast(ops, '한 번에 여섯 권까지 빌릴 수 있어요 — 먼저 돌려줘요', 'muted'); return; }
      S.borrowed.push({ ...c.book, title: c.label, day });
      ops.dropCarry();
      ops.dirty(c.book.floor);
      audio.blip && audio.blip({ hz: 900, to: 1200, dur: 0.07, gain: 0.05 });
      toast(ops, `${josa(`「${c.label}」`, '을')} 빌렸다 · 일지 → 가방에서 읽어요 · 이레 안에 아무 서고 대출대에 돌려줘요`, 'item');
      g.scan && g.scan('c_library');
      return;
    }
    const back = (b) => { const k = S.borrowed.indexOf(b); if (k >= 0) S.borrowed.splice(k, 1); if (b.uid === ops.cur.uid) ops.dirty(b.floor); };
    const items = S.borrowed.map((b) => { const late = day - b.day > 7; return { label: `「${b.title}」 돌려주기`, sub: `${day - b.day}일째 빌림${late ? ' · 돌려줄 날이 지났어요' : ''}${b.uid === ops.cur.uid ? '' : ' · 다른 서고의 책 (이 대출대에서 받아 줘요)'}`, onClick: () => { back(b); toast(ops, `${josa(`「${b.title}」`, '을')} 돌려주었다`); library.desk(ops, T, out); } }; });
    if (S.borrowed.length > 1) items.push({ label: '모두 돌려주기', onClick: () => { for (const b of S.borrowed.slice()) back(b); toast(ops, '빌린 책을 모두 돌려주었다'); } });
    ui(ops).serviceCard('대출대', S.borrowed.length ? `빌린 책 ${S.borrowed.length}권` : '빌리기·돌려주기', S.borrowed.length ? '빌린 책은 어느 서고 대출대에 돌려줘도 돼요.' : '서가에서 책을 골라 「들고 가기」로 들고 오면 여기서 빌려 줘요. 한 번에 여섯 권, 이레 동안. 값은 받지 않아요.', items, `<div class="svc-stat"><span>읽은 책 ${Object.keys(S.done).length}권</span><span>펼쳐 본 책 ${Object.keys(S.read).length}권</span></div>`);
  },
  act(ops, T, F, out) {
    if (F.tag === 'books' || F.tag === 'archive') {
      const en = out.books && out.books.get(F.id);
      if (!en) return null;
      const c = library.carried(ops);
      if (c && c.book.uid === ops.cur.uid) return { label: `서가 · 「${c.label}」 제자리에 꽂기`, short: '꽂기', use: () => { const fl = c.book.floor; ops.dropCarry(); ops.dirty(fl); toast(ops, `${josa(`「${c.label}」`, '을')} 서가에 꽂았다`, 'muted'); } };
      return { label: `서가 · ${en.annal ? `${library.zoneName(ops, T)} 연대 기록` : subjectName(en.subject)}`, short: '책 고르기', use: () => library.browse(ops, T, out, F) };
    }
    if (F.tag === 'catalog') return { label: '찾기 단말 · 책 찾기', short: '찾기', use: () => ops.apps.open('catalog', { T, F }) };
    if (F.tag === 'read') {
      const c = library.carried(ops), S = libState(ops.game);
      return { label: c ? `열람 탁자 · 「${c.label}」 앉아 읽기` : S.borrowed.length ? '열람 탁자 · 빌린 책 읽기' : '열람 탁자', short: '읽기', use: () => {
        const av = ops.game.avatar;
        if (c) { av && av.act && av.act('sit', 3); library.read(ops, c.book.id, '열람 탁자'); }
        else if (S.borrowed.length) ui(ops).serviceCard('열람 탁자', '빌린 책', '', S.borrowed.map((b) => ({ label: b.title, onClick: () => { av && av.act && av.act('sit', 3); library.read(ops, b.id, '열람 탁자 · 빌린 책'); } })));
        else toast(ops, '서가에서 책을 골라 「들고 가기」로 들고 와요', 'muted');
      } };
    }
    if (F.tag === 'circulation') { const c = library.carried(ops); return { label: c ? `대출대 · 「${c.label}」 빌리기` : '대출대 · 빌리기·돌려주기', short: '대출', use: () => library.desk(ops, T, out) }; }
    if (F.tag === 'clock') return clockAct(ops, T);
    return null;
  },
  people(ops, T, out, i) {
    const tables = tagged(out, 'read'), shelves = tagged(out, 'books');
    const desk = tagged(out, 'circulation')[0];
    if (desk) spawn(ops, staffSpec(ops, out, T, 'read', '사서', desk), loopAt(desk, 'type', 8, true)(), () => loopAt(desk, 'type', 8, true)());
    for (let k = 0; k < Math.min(8, tables.length * 2 + 2); k++) {
      const [gx, gz] = arrival(ops, out);
      spawn(ops, { key: `${T.uid}:${i}:rd${k}`, role: 'read', title: '읽는 이', floor: i, gx, gz }, [{ wait: k * 2 }], () => library.readerPlan(ops, T, out, shelves, tables));
    }
  },
  /** 읽는 이 (주민): 서가에서 실제 책 한 권을 꺼내(그 자리가 빈다) 열람 탁자에서 읽고 제자리에 꽂는다 */
  readerPlan(ops, T, out, shelves, tables) {
    const S = shelves.filter((F) => out.books && out.books.get(F.id));
    if (!S.length) return [{ act: 'look', t: 10 }];
    const F = pick(S), Tb = tables.length ? pick(tables) : null;
    let key = null;
    return [
      { go: AT(F) },
      { face: yawTo(F), act: 'reach', t: 2, fx: () => {
        const en = out.books.get(F.id), gone = ops.booksGone(out.i);
        for (let k = 0; k < 12 && !key; k++) { const si = Math.floor(Math.random() * en.spines.length), e = Math.floor(Math.random() * SPINES); const q = `${F.id}/${si}/${e}`; if (en.spines[si][e] && !gone.has(q)) key = q; }
        if (key) { ops.agentBook(out.i, key, 120); ops.dirty(out.i); }
      } },
      ...(Tb ? [{ go: AT(Tb) }, { act: 'sit', t: 20 + Math.random() * 20 }] : [{ act: 'look', t: 15 }]),
      { go: AT(F) },
      { face: yawTo(F), act: 'reach', t: 1.5, fx: () => { if (key) { ops.agentBook(out.i, key, 0); ops.dirty(out.i); } } },
    ];
  },
  roles: { shelver: { title: '서가 정리', wage: 1.4, hours: [0.33, 0.75], desc: '돌아온 책을 제 서가 제 칸에 꽂는다', next(ops, T) {
    const out = ops.cur.indoor.built.get(ops.cur.indoor.cur);
    const sh = tagged(out, 'books', 'archive').filter((F) => out.books && out.books.get(F.id));
    if (!sh.length) return null;
    const S = pick(sh), en = out.books.get(S.id), si = Math.floor(Math.random() * en.spines.length), id = pick(en.spines[si].filter(Boolean)), b = bookById(id);
    if (!b) return null;
    const where = `${en.annal ? '연대 기록' : subjectName(en.subject)} 서가 ${slotName(si, S)}`;
    return { title: `「${b.title}」 꽂기`, steps: [
      { label: '대출대에서 돌아온 책 들기', short: '들기', at: (o) => tagged(o, 'circulation')[0] || tagged(o, 'catalog')[0], do: () => { ops.takeCarry({ g: 'book', n: 1, kind: 'book', label: b.title, color: bookColor(id) }); return true; } },
      { label: `「${b.title}」 — ${where}`, short: '꽂기', at: () => S, do: () => { ops.dropCarry(); ops.taskDone(T); learn(ops, b.word); return true; } },
    ], next: () => roleOf('library', 'shelver').next(ops, T) };
  } } },
};
const hall = {
  act(ops, T, F, out) {
    if (F.tag === 'tickets') return { label: '표 파는 창구', short: '표', use: () => { if (ops._showTicket) { toast(ops, '이미 표가 있어요 · 객석으로', 'muted'); return; } if (ops.econ.transfer('player', `n:${T.uid}`, 2, '공연 표') >= 2) { ops._showTicket = true; toast(ops, '공연 표 · 객석 아무 줄에서 E', 'item'); } } };
    if (F.tag === 'seat') return { label: ops._showTicket ? '객석 · 앉아서 공연 보기' : '객석 (표가 필요해요)', short: '앉기', use: () => { if (!ops._showTicket) { toast(ops, '표 파는 창구에서 표를 사요', 'muted'); return; } ops.game.avatar && ops.game.avatar.act && ops.game.avatar.act('sit', 6); ops.game.venues.concert(); ops._showTicket = false; } };
    if (F.tag === 'lights') return { label: '빛 조종대', short: '조명', use: () => { const job = ops.myJobHere(); if (job && ops.S.shift) ops.game.venues._timing('무대 조명', '노래가 바뀔 때마다 빛을 바꾼다 — 가운데에서 E', 6, (h) => { ops.taskDone(T); toast(ops, `조명 신호 ${h}/6`, 'item'); }); else toast(ops, '조명 담당의 자리', 'muted'); } };
    if (F.tag === 'stage') return { label: '무대', short: '무대', use: () => toast(ops, '합창단이 서는 무대') };
    if (F.tag === 'instrument') return school.act(ops, T, F, out);
    if (F.tag === 'clock') return clockAct(ops, T);
    if (F.tag === 'council') return office.act(ops, T, F, out);
    return null;
  },
  people(ops, T, out, i) {
    const show = tod(ops) > 0.45 && tod(ops) < 0.92;
    const st = tagged(out, 'stage')[0];
    if (st && show) for (let k = 0; k < 6; k++) spawn(ops, { key: `${T.uid}:${i}:sing${k}`, role: 'sing', title: '합창단', floor: i, gx: st.x + (k - 2.5) * 1.1, gz: st.z }, [{ face: 0, act: 'sing', t: 30 }], () => [{ act: 'sing', t: 30 }]);
    const seats = tagged(out, 'seat');
    if (show) for (let k = 0; k < Math.min(16, seats.length * 2); k++) { const S = pick(seats); spawn(ops, { key: `${T.uid}:${i}:aud${k}`, role: 'listen', title: '관객', floor: i, gx: S.x + (Math.random() - 0.5) * 4, gz: S.z }, [{ act: 'sit', t: 60 }], () => [{ act: 'sit', t: 60 }]); }
  },
  roles: { lights: { title: '무대 조명', wage: 1.7, hours: [0.45, 0.9], desc: '공연에 맞춰 빛 신호를 보낸다', next(ops, T) { return { title: '조명 신호', steps: [{ label: '빛 조종대', short: '조명', at: (o) => tagged(o, 'lights')[0], do: (F) => { hall.act(ops, T, F).use(); return true; } }] }; } } },
};

// ════════════════════════════════════════════════════════════
// 호텔 · 집 · 쉼터 · 전망대 · 정원 · 농장 · 주차 · 설비 · 로비
// ════════════════════════════════════════════════════════════
const hotel = {
  act(ops, T, F, out) {
    const H = ops.S.hotel;
    if (F.tag === 'reception') return { label: H && H.uid === ops.cur.uid ? `안내대 · 묵는 방 ${H.room}` : '안내대 · 방 잡기 (하룻밤 5울)', short: '안내', use: () => hotel.checkin(ops, T, out) };
    if (F.tag === 'sleep') { const R = out.L.rooms[F.room]; const mine = H && H.uid === ops.cur.uid && H.floor === out.i && H.roomId === (R.unit ?? R.id); return { label: mine ? '잠 고치 · 아침까지 쉬기 (저장)' : '객실의 잠 고치', short: '쉬기', use: () => { if (mine) { ops.game.venues.buff('full'); ops.game.rest(0.27); ops.game.save(true); toast(ops, '푹 쉬었다 · 저장했어요', 'item'); } else toast(ops, '다른 손님의 방이에요', 'muted'); } }; }
    if (F.tag === 'cart' || F.tag === 'laundry') return { label: F.tag === 'cart' ? '정돈 수레' : '세탁 고치', short: '정돈', use: () => { const job = ops.myJobHere(); if (job && ops.S.shift) { ops.startTask(roleOf('hotel', 'keeper').next(ops, T)); } else toast(ops, '객실 관리 직원의 것', 'muted'); } };
    if (F.tag === 'order') return food.act(ops, T, F, out);
    if (F.tag === 'table') return food.act(ops, T, F, out);
    if (F.tag === 'clock') return clockAct(ops, T);
    if (F.tag === 'terminal' || F.tag === 'directory') return office.act(ops, T, F, out);
    return null;
  },
  checkin(ops, T, out) {
    const H = ops.S.hotel;
    if (H && H.uid === ops.cur.uid) { toast(ops, `${H.label}에 묵고 있어요 · 승강기로 ${H.floorLabel}층`); return; }
    const B = ops.cur.B;
    const fl = B.floors.filter((F) => F.use === 'hotel' && F.reach);
    if (!fl.length) { toast(ops, '빈 방이 없어요', 'muted'); return; }
    const F = fl[Math.floor(Math.random() * fl.length)];
    const pl = ops.cur.indoor.plan(F.i);
    const rooms = pl.L.rooms.filter((R) => R.type === 'guestroom' && R.n);
    if (!rooms.length) { toast(ops, '빈 방이 없어요', 'muted'); return; }
    const R = pick(rooms);
    ui(ops).serviceCard(T.org ? T.org.name : '호텔', '방 잡기', `${F.label}층 ${R.id + 1}호 · 하룻밤 5울 · 잠 고치에서 쉬면 아침이 되고 저장돼요.`, [{ label: '방 잡기 · 5울', primary: true, disabled: (ops.game.state.inv.starseed || 0) < 5, onClick: () => { if (ops.econ.transfer('player', `n:${T.uid}`, 5, '호텔 방') < 5) return; ops.S.hotel = { uid: ops.cur.uid, x: ops.cur.r.door ? ops.cur.r.door.x : ops.cur.r.x, z: ops.cur.r.door ? ops.cur.r.door.z : ops.cur.r.z, bname: ops.game.interiors.title(ops.cur.r), floor: F.i, floorLabel: F.label, roomId: R.id, room: `${F.label}층 ${R.id + 1}호`, label: `${F.label}층 ${R.id + 1}호` }; toast(ops, `${F.label}층 ${R.id + 1}호 · 지도에 표시했어요`, 'item'); ops.guide && ops.guide.toRoom(F.i, R.id); } }]);
  },
  people(ops, T, out, i) {
    const desk = tagged(out, 'reception')[0];
    if (desk) spawn(ops, staffSpec(ops, out, T, 'clerk', '안내원', desk), loopAt(desk, 'talk', 8, true)(), () => loopAt(desk, 'type', 8, true)());
    // 로비: 짐을 든 손님이 와서 안내대에서 방을 받고 승강기로 · 소파에서 기다리는 이
    if (desk && out.i === ops.cur.B.ground) {
      const sofas = out.fix.filter((F) => ['sofa', 'armchair', 'bench'].includes(F.t));
      const hallR = out.L.lifthall != null ? out.L.rooms[out.L.lifthall] : null;
      for (let k = 0; k < 5; k++) {
        const [gx, gz] = arrival(ops, out);
        const plan = [{ wait: k * 6 + Math.random() * 3, fx: (a) => { if (k % 2 === 0) a.carry = { g: 'box' }; } }, { go: AT(desk) }, { face: yawTo(desk), act: 'talk', t: 3 }];
        if (sofas.length && k % 2) { const S = pick(sofas); plan.push({ go: AT(S) }, { act: 'sit', t: 10 + Math.random() * 10 }); }
        if (hallR) plan.push({ go: [ops.cur.B.G.ox + hallR.cx + 0.5, ops.cur.B.G.oz + hallR.cz + 0.5] }, { act: 'wait', t: 3 });
        spawn(ops, { key: `${T.uid}:${i}:arr${k}`, role: 'guest', title: '묵을 손님', floor: i, gx, gz }, plan);
      }
    }
    const sleeps = tagged(out, 'sleep');
    const night = tod(ops) > 0.88 || tod(ops) < 0.27;
    for (const S of sleeps.slice(0, 10)) if (Math.random() < (night ? 0.7 : 0.15)) spawn(ops, { key: `${T.uid}:${i}:g${S.id}`, role: 'sleep', title: '손님', floor: i, gx: S.x, gz: S.z }, [{ act: 'lie', t: 120 }], () => [{ act: 'lie', t: 120 }]);
    const cart = tagged(out, 'cart')[0];
    if (cart && !night && sleeps.length) spawn(ops, staffSpec(ops, out, T, 'carry', '객실 정돈', cart), [], () => { const S = pick(sleeps); return [{ go: AT(cart) }, { act: 'reach', t: 1 }, { go: AT(S) }, { face: yawTo(S), act: 'stock', t: 6 }]; });
  },
  roles: {
    front: { title: '안내원', wage: 1.6, hours: [0.3, 0.8], desc: '안내대에서 손님을 맞는다', next(ops, T) { return { title: '손님 맞기', steps: [{ label: '안내대', short: '맞기', at: (o) => tagged(o, 'reception')[0], do: () => { ops.taskDone(T); toast(ops, '먼 구역에서 온 손님을 방으로 안내했다', 'item'); return true; } }] }; } },
    keeper: { title: '객실 정돈', wage: 1.5, hours: [0.35, 0.7], desc: '손님이 떠난 방의 잠 고치를 정돈한다', next(ops, T) { const out = ops.cur.indoor.built.get(ops.cur.indoor.cur); const S = tagged(out, 'sleep'); if (!S.length) { toast(ops, '객실 층으로 가요', 'muted'); return null; } const pickS = S.sort(() => Math.random() - 0.5).slice(0, 2); return { title: '객실 정돈', steps: pickS.map((x, k) => ({ label: `${k + 1}번째 방 잠 고치 정돈`, short: '정돈', at: () => x, do: () => { ops.taskDone(T); return true; } })) }; } },
  },
};
const home = {
  act(ops, T, F, out) {
    const g = ops.game;
    const R = out.L.rooms[F.room];
    const unit = R ? (R.unit ?? (R.unitRoot ? R.id : null)) : null;
    const mineHouse = g.state.home != null && ops.cur.r.id === g.state.home;
    const mine = mineHouse && (unit == null || home.myUnit(ops) === `${out.i}:${unit}`);
    const priv = R && ROOMS[R.type] && ROOMS[R.type].acc === 'private';
    if (priv && !mine && !R.house) return F.tag === 'sleep' || F.tag === 'cook' ? { label: '남의 집', short: '…', use: () => toast(ops, '이웃의 집이에요. 친해지면 초대받을 수 있어요', 'muted') } : null;
    if (F.tag === 'sleep') return { label: mine ? '잠 고치 · 아침까지 자기 (저장)' : '잠 고치', short: '자기', use: () => (mine || R.house ? g.venues.sleep() : toast(ops, '남의 잠 고치예요', 'muted')) };
    if (F.tag === 'cook') return { label: mine ? '부엌 · 가방의 재료로 요리' : '부엌 조리대', short: '요리', use: () => home.cook(ops) };
    if (F.tag === 'eat') return { label: '식탁', short: '앉기', use: () => g.avatar && g.avatar.act && g.avatar.act('sit', 3) };
    if (F.tag === 'storage') return { label: mine ? '옷 고치 · 물건 맡기기' : '옷 고치', short: '보관', use: () => (mine ? home.stash(ops) : null) };
    if (F.tag === 'mail' || F.tag === 'parcel') return { label: '우편함 · 우리 집 칸', short: '우편', use: () => home.mail(ops) };
    if (F.tag === 'vending') return vendingAct(ops, T, F, out);
    if (F.tag === 'directory' || F.tag === 'terminal') return office.act(ops, T, F, out);
    if (F.tag === 'laundry') return { label: '공용 세탁 고치', short: '세탁', use: () => toast(ops, '옷이 빛 속에서 돈다 — 상쾌하다') };
    return null;
  },
  myUnit(ops) { const b = ops.bstate(ops.cur.uid); if (!b.myUnit) { const B = ops.cur.B; const fl = B.floors.find((F) => (F.use === 'residential' || F.use === 'house') && F.reach); if (fl) { const pl = ops.cur.indoor.plan(fl.i); const U = pl.L.rooms.find((R) => R.unitRoot || R.house); b.myUnit = U ? `${fl.i}:${U.unitRoot ? U.id : 'h'}` : `${fl.i}:h`; b.myFloor = fl.i; } } return b.myUnit; },
  cook(ops) {
    const g = ops.game, inv = g.state.inv;
    const opts = [['meal', { bread: 1, fruit: 1 }], ['juice', { fruit: 2 }], ['tea', { tealeaf: 2 }]].filter(([, need]) => Object.entries(need).every(([k, v]) => (inv[k] || 0) >= v));
    if (!opts.length) { toast(ops, '재료가 없어요 (빵·빛열매·찻잎은 마트에서)', 'muted'); return; }
    ui(ops).serviceCard('우리 집 부엌', '무엇을 지을까요?', '가방의 재료를 실제로 쓴다.', opts.map(([k, need]) => ({ label: gname(k), sub: Object.entries(need).map(([a, v]) => `${gname(a)} ${v}`).join(' · '), onClick: () => { for (const [a, v] of Object.entries(need)) inv[a] -= v; inv[k] = (inv[k] || 0) + 1; learn(ops, 'eat'); toast(ops, `${josa(gname(k), '을')} 지었다`, 'item'); } })));
  },
  stash(ops) {
    const g = ops.game, inv = g.state.inv, b = ops.bstate(ops.cur.uid);
    b.stash = b.stash || {};
    const ks = Object.keys(inv).filter((k) => k !== 'starseed' && inv[k] > 0);
    ui(ops).serviceCard('옷 고치', '집에 맡겨 둔 것', Object.entries(b.stash).filter(([, v]) => v > 0).map(([k, v]) => `${gname(k)} ${v}`).join(', ') || '비어 있다', [
      ...ks.slice(0, 6).map((k) => ({ label: `${gname(k)} 맡기기`, stay: true, onClick: () => { inv[k]--; b.stash[k] = (b.stash[k] || 0) + 1; toast(ops, `${josa(gname(k), '을')} 맡겼다`); } })),
      ...Object.keys(b.stash).filter((k) => b.stash[k] > 0).slice(0, 4).map((k) => ({ label: `${gname(k)} 꺼내기`, stay: true, onClick: () => { b.stash[k]--; inv[k] = (inv[k] || 0) + 1; toast(ops, `${josa(gname(k), '을')} 꺼냈다`); } })),
    ]);
  },
  mail(ops) {
    const g = ops.game, b = ops.bstate(ops.cur.uid);
    const day = Math.floor(g.world.clock.time);
    if (g.state.home == null || ops.cur.r.id !== g.state.home) { toast(ops, '주민들의 우편함', 'muted'); return; }
    if (b.mailDay === day) { toast(ops, '오늘 우편은 받았어요', 'muted'); return; }
    b.mailDay = day;
    // 이웃이 보낸 작은 꾸러미 (공공 몫의 고마움 · 물건은 구역 가게 재고에서)
    const k = pick(['fruit', 'cookie', 'flower', 'tea']);
    const got = ops.econ.take(ops.cur.r.zone, 'retail', k, 1);
    if (got) { g.state.inv[k] = (g.state.inv[k] || 0) + got; toast(ops, `이웃이 보낸 꾸러미 · ${gname(k)}`, 'item'); } else toast(ops, '오늘은 빈 우편함', 'muted');
  },
  people(ops, T, out, i) {
    const night = tod(ops) > 0.85 || tod(ops) < 0.26, eve = tod(ops) > 0.7 && tod(ops) <= 0.85;
    const sleeps = tagged(out, 'sleep'), cooks = tagged(out, 'cook'), eats = tagged(out, 'eat');
    let k = 0;
    for (const S of sleeps) { if (k > 12) break; if (Math.random() < (night ? 0.75 : 0.1)) { spawn(ops, { key: `${T.uid}:${i}:z${S.id}`, role: 'sleep', title: '주민', floor: i, gx: S.x, gz: S.z }, [{ act: 'lie', t: 120 }], () => [{ act: 'lie', t: 120 }]); k++; } }
    if (eve || (!night && Math.random() < 0.5)) for (const C of cooks.slice(0, 6)) { spawn(ops, { key: `${T.uid}:${i}:c${C.id}`, role: 'cook', title: '주민', floor: i, gx: C.ax, gz: C.az }, [{ face: yawTo(C), act: 'cook', t: 20 }], () => (eats.length ? [{ go: AT(pick(eats)) }, { act: 'eat', t: 20 }] : [{ act: 'cook', t: 20 }])); k++; }
    // 아침: 일하러 나간다 · 저녁: 돌아온다 (승강기 홀을 거쳐)
    if (tod(ops) > 0.27 && tod(ops) < 0.34) for (let m = 0; m < 4; m++) { const S = sleeps.length ? pick(sleeps) : null; if (!S) break; spawn(ops, { key: `${T.uid}:${i}:go${m}`, role: 'carry', title: '출근하는 주민', floor: i, gx: S.ax, gz: S.az }, [{ go: arrival(ops, out) }]); }
  },
  roles: {},
};
const farm = {
  setup(ops, T, out) {
    const n = T.node;
    n.bins = n.bins || [];
    const crops = [CROPS[hashStr(T.uid) % CROPS.length], CROPS[(hashStr(T.uid) >> 3) % CROPS.length]];
    for (const [fid, slots] of out.slots) {
      const F = slots[0].fix;
      if (F.tag !== 'crop') continue;
      slots.forEach((s, si) => { const key = `${fid}/${si}`; if (!n.crop[key]) n.crop[key] = { g: crops[si % 2], stage: Math.random() * 0.8, water: 0.6 }; let b = n.bins.find((q) => q.key === key); if (!b) { b = { key, g: n.crop[key].g, n: 0 }; n.bins.push(b); } });
    }
    farm.sync(T);
  },
  sync(T) { for (const b of T.node.bins || []) { const c = T.node.crop[b.key]; if (c) { b.g = c.g; b.n = Math.floor(c.stage * 8); } } },
  act(ops, T, F, out) {
    if (F.tag === 'crop') {
      const slots = out.slots.get(F.id) || [];
      const cs = slots.map((s, si) => T.node.crop[`${F.id}/${si}`]).filter(Boolean);
      const ripe = cs.filter((c) => c.stage >= 1).length, dry = cs.filter((c) => c.water < 0.4).length;
      return { label: () => `${F.t === 'growrack' ? '재배 선반' : F.t === 'growbox' ? '재배 상자' : '재배 이랑'} · ${gname(cs[0] ? cs[0].g : 'grain')} ${ripe ? `· 거둘 것 ${ripe}` : dry ? '· 목말라요' : '· 자라는 중'}`, short: ripe ? '거두기' : '돌보기', use: () => farm.tend(ops, T, F, out) };
    }
    if (F.tag === 'nutrient') return { label: '양분 탱크', short: '양분', use: () => toast(ops, '빛물에 양분이 녹아 이랑으로 흐른다') };
    if (F.tag === 'pack') return { label: '포장 탁자', short: '포장', use: () => farm.pack(ops, T) };
    if (F.tag === 'produce' || F.tag === 'stock') return { label: '거둔 것 상자', short: '상자', use: () => ui(ops).serviceCard('재배원 창고', '거둔 것', '포장해서 물류 창고로 실어 보낸다.', Object.entries(T.node.stock).filter(([, v]) => v > 0).map(([k, v]) => ({ label: `${gname(k)} × ${Math.floor(v)}`, disabled: true }))) };
    if (F.tag === 'clock') return clockAct(ops, T);
    if (F.tag === 'shelf' || F.tag === 'checkout') return mart.act(ops, T, F, out);
    return null;
  },
  tend(ops, T, F, out) {
    const slots = out.slots.get(F.id) || [];
    let got = 0, watered = 0;
    slots.forEach((s, si) => {
      const c = T.node.crop[`${F.id}/${si}`];
      if (!c) return;
      if (c.stage >= 1) { const v = 3 + Math.floor(Math.random() * 3); T.node.stock[c.g] = (T.node.stock[c.g] || 0) + v; got += v; c.stage = 0; }
      else if (c.water < 0.7) { c.water = 1; watered++; }
    });
    farm.sync(T);
    out.itemsDirty = true;
    ops.game.avatar && ops.game.avatar.act && ops.game.avatar.act('tend', 2);
    if (got) { toast(ops, `${got}개를 거두었다 · 포장 탁자로`, 'item'); if (ops.myJobHere() && ops.S.shift) ops.taskDone(T); learn(ops, 'grow'); }
    else if (watered) { toast(ops, `${watered}칸에 빛물을 주었다`); if (ops.myJobHere() && ops.S.shift) ops.taskDone(T); }
    else toast(ops, '아직 자라는 중', 'muted');
  },
  pack(ops, T) {
    const n = T.node;
    const ks = Object.keys(n.stock).filter((k) => n.stock[k] >= 4 && CROPS.includes(k));
    if (!ks.length) { toast(ops, '포장할 만큼 거둔 것이 없어요', 'muted'); return; }
    ops.game.venues._timing('포장', '상자 뚜껑이 가운데 올 때 E', 4, () => {
      let val = 0;
      for (const k of ks) { const v = Math.floor(n.stock[k]); ops.econ.give(T.zone, 'depot', k, v); val += v * GOODS[k].base; n.stock[k] -= v; }
      const paid = ops.econ.transfer(`z:${T.zone}:firms`, `n:${T.uid}`, val);
      n.sales += paid;
      ops.taskDone(T);
      toast(ops, `포장해서 물류 창고로 · 값 ${won(paid)} (재배원 금고)`, 'item');
    });
  },
  tick(ops, T, out, dt) {
    for (const c of Object.values(T.node.crop)) { if (c.stage < 1) c.stage = Math.min(1, c.stage + dt * 0.004 * (0.4 + c.water)); c.water = Math.max(0, c.water - dt * 0.002); }
    if ((T._fs = (T._fs || 0) + dt) > 3) { T._fs = 0; farm.sync(T); out.itemsDirty = true; }
  },
  people(ops, T, out, i) {
    if (!open(ops, 0.26, 0.78)) return;
    const cr = tagged(out, 'crop');
    for (let k = 0; k < Math.min(5, cr.length); k++) spawn(ops, { ...staffSpec(ops, out, T, 'tend', '재배원', cr[k]), key: `${T.uid}:${i}:gr${k}` }, [], () => { const C = pick(cr); return [{ go: AT(C) }, { face: yawTo(C), act: 'tend', t: 8 }]; });
    const pk = tagged(out, 'pack')[0];
    if (pk) spawn(ops, staffSpec(ops, out, T, 'work', '포장원', pk), loopAt(pk, 'operate', 8)(), () => loopAt(pk, 'operate', 8)());
  },
  roles: {
    grower: { title: '재배원', wage: 1.5, hours: [0.26, 0.6], desc: '빛물을 주고 익은 것을 거둔다', next(ops, T) { const out = ops.cur.indoor.built.get(ops.cur.indoor.cur); const cr = tagged(out, 'crop').sort(() => Math.random() - 0.5).slice(0, 3); if (!cr.length) return null; return { title: '이랑 돌보기', steps: cr.map((C, k) => ({ label: `${k + 1}번째 이랑 돌보기`, short: '돌보기', at: () => C, do: () => { farm.tend(ops, T, C, out); return true; } })) }; } },
    packer: { title: '포장원', wage: 1.5, hours: [0.3, 0.65], desc: '거둔 것을 상자에 담아 물류 창고로', next(ops, T) { return { title: '포장', steps: [{ label: '포장 탁자', short: '포장', at: (o) => tagged(o, 'pack')[0], do: () => { farm.pack(ops, T); return true; } }] }; } },
  },
};
const generic = {
  act(ops, T, F, out) {
    if (F.tag === 'directory' || F.tag === 'terminal') return { label: F.tag === 'directory' ? '안내 빛판 · 층 안내' : '울림판 단말', short: '단말', use: () => ops.apps.open(F.tag === 'directory' ? 'directory' : 'home', { T, F }) };
    if (F.tag === 'vending') return vendingAct(ops, T, F, out);
    if (F.tag === 'exercise') return { label: '뜀 운동판', short: '운동', use: () => { buff(ops, 'quick'); toast(ops, '몸이 가볍다 · 가벼운 발', 'item'); } };
    if (F.tag === 'scope') return { label: '별 망원기', short: '보기', use: () => { learn(ops, 'star'); toast(ops, '먼 탑들과 우르의 고리가 가까이 보인다'); } };
    if (F.tag === 'order') return food.act(ops, T, F, out);
    if (F.tag === 'table') return food.act(ops, T, F, out);
    if (F.tag === 'reception') return { label: '안내대 · 이 건물 안내', short: '안내', use: () => ops.apps.open('directory', { T, F }) };
    if (F.tag === 'mail' || F.tag === 'parcel') return home.act(ops, T, F, out);
    if (F.tag === 'crop') return farm.act(ops, T, F, out);
    if (F.tag === 'car') return { label: '뜬차', short: '뜬차', use: () => toast(ops, '주민들의 뜬차 — 공명 고리로 떠 있다') };
    if (F.tag === 'mech') return { label: '공명 설비', short: '설비', use: () => toast(ops, '건물의 물·빛·공기를 고르게 하는 설비') };
    if (F.tag === 'clock') return clockAct(ops, T);
    return null;
  },
  people(ops, T, out, i) {
    const spots = out.fix.filter((F) => ['bench', 'sofa', 'armchair', 'scope', 'floatpad', 'table4', 'table2', 'lowtable'].includes(F.t));
    const desk = tagged(out, 'reception')[0];
    if (desk) spawn(ops, staffSpec(ops, out, T, 'clerk', '안내지기', desk), loopAt(desk, 'talk', 8, true)(), () => loopAt(desk, 'look', 8, true)());
    for (let k = 0; k < Math.min(6, spots.length); k++) { const [gx, gz] = arrival(ops, out); spawn(ops, { key: `${T.uid}:${i}:v${k}`, role: 'guest', title: '쉬는 이', floor: i, gx, gz }, [{ wait: k * 3 }], () => { const S = pick(spots); return [{ go: AT(S) }, { face: yawTo(S), act: ['bench', 'sofa', 'armchair'].includes(S.t) ? 'sit' : 'look', t: 15 + Math.random() * 20 }]; }); }
  },
  roles: {},
};
function vendingAct(ops, T, F, out) {
  return { label: '나눔 기계 · 마실 것', short: '나눔', use: () => {
    const ks = ['juice', 'tea', 'jelly'];
    ui(ops).serviceCard('나눔 기계', '골라요', '안의 물건은 가까운 가게 재고에서 채운다.', ks.map((k) => ({ label: `${gname(k)} · ${won(ops.econ.price(k))}`, disabled: (ops.game.state.inv.starseed || 0) < ops.econ.price(k), onClick: () => { const v = ops.econ.take(T.zone, 'retail', k, 1); if (!v) { toast(ops, '다 떨어졌어요', 'muted'); return; } if (ops.econ.transfer('player', `n:${T.uid}`, ops.econ.price(k), `나눔 기계 · ${gname(k)}`) < ops.econ.price(k)) { ops.econ.give(T.zone, 'retail', k, 1); return; } ops.game.state.inv[k] = (ops.game.state.inv[k] || 0) + 1; toast(ops, `${gname(k)} 1`, 'item'); } })));
  } };
}
/** 출근 단말: 이 건물에 일자리가 있으면 출근·퇴근 */
function clockAct(ops, T) {
  return { label: () => { const job = ops.S.jobs.find((j) => j.uid === ops.cur.uid && j.k === T.k); return job ? (ops.S.shift ? '출근 단말 · 퇴근하기' : `출근 단말 · 출근 (${job.title})`) : '출근 단말 · 직원만'; }, short: '출근', use: () => {
    const job = ops.S.jobs.find((j) => j.uid === ops.cur.uid && j.k === T.k);
    if (!job) { toast(ops, '이 건물 직원만 — 단말의 「일자리」에서 지원할 수 있어요', 'muted'); return; }
    if (ops.S.shift) ops.clockOut(); else ops.clockIn(job);
  } };
}

export const TYPES = {
  mart, food, factory, depot, office, admin: office, lab, school, clinic, plant, terminal, museum, library, hall, hotel, home, farm,
  lobby: generic, generic, garden: generic, amenity: generic, observation: generic, parking: generic, tech: generic,
  // 중2층(관제·사무·대기)은 아래 홀(공장·창고·발전동·대합실·공연장)의 한 부분: 관제 조종대·출근 단말 같은 것은 그 홀의 운영(세입자·살림·기계)으로,
  // 그 밖의 책상·회의는 사무처럼. (전에는 중2층을 따로 된 세입자로 공장 동작에 넘겨 생산 자료가 없어 「생산 현황」이 멈췄다)
  mezz: {
    act: (o, T, F, out) => {
      const hb = o.cur && o.cur.indoor.built.get(out.i - 1), P = o.byFloor(out.i - 1);
      const h = P && P !== T && P.type && P.type.act ? P.type.act(o, P, F, hb || out) : null;
      return h || office.act(o, T, F, out);
    },
    people: generic.people,
  },
};
export { DISHES, PROJECTS, SUBJECTS, gname };
