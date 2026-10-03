// 도시 살림 검사 (브라우저 없이): 구역 살림을 며칠 돌려 보며
//  1) 돈(울) 합이 늘 같은가 (사고·팔고·품삯·세금·주문·플레이어 계산이 모두 옮기기뿐인가)
//  2) 어떤 계정·재고도 음수가 되지 않는가
//  3) 생산(농장·채굴·공장)을 끄면 물건은 줄기만 하는가 (어디서도 저절로 생기지 않는가)
//  4) 살아 있는 건물(가게 node)의 주문 → 하역 → 창고 → 진열 흐름이 도는가
//   node tools/econ-check.mjs
import { Economy } from '../src/interior/econ.js';
import { GOODS } from '../src/data/goods.js';

function mockGame(seed = 1) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const zones = [{ id: 'za', cx: 0, cz: 0, rOut: 900 }, { id: 'zb', cx: 4000, cz: 0, rOut: 900 }];
  const pids = ['home', 'home', 'home', 'home', 'office', 'market', 'cafe', 'factory', 'farm', 'plant', 'depot', 'school', 'heal', 'hotel'];
  const recs = [];
  for (let k = 0; k < 400; k++) {
    const Z = zones[k % 2];
    recs.push({ id: k, pid: pids[k % pids.length], zone: Z.id, x: Z.cx + (rnd() - 0.5) * 1200, z: Z.cz + (rnd() - 0.5) * 1200, gy: 0, top: 10 + rnd() * 80, sx: 8 + rnd() * 20, sz: 8 + rnd() * 20, kind: 'slab' });
  }
  return {
    city: { zones, recs, outRecs: [{ zone: 'za', kind: 'tanks', top: 30, gy: 0 }, { zone: 'zb', kind: 'cooler', top: 20, gy: 0 }] },
    interiors: { info: (r) => ({ pid: r.pid }) },
    state: { inv: { starseed: 25 }, econ: null },
    world: { clock: { time: 0.25 } },
    player: { pos: { x: 0, z: 0 } },
    venues: { S: { spent: 0 } },
  };
}
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); };
const goodsSum = (E) => { const t = {}; for (const k of Object.keys(GOODS)) t[k] = E.goodsTotal(k); return t; };
const negatives = (E) => {
  const bad = [];
  for (const [id, z] of Object.entries(E.S.Z)) {
    for (const k of ['hh', 'firms', 'commons']) if (z[k] < -1e-6) bad.push(`${id}.${k}=${z[k]}`);
    for (const w of ['depot', 'retail']) for (const [g, v] of Object.entries(z[w])) if (v < -1e-6) bad.push(`${id}.${w}.${g}=${v}`);
  }
  for (const n of Object.values(E.S.N)) { if (n.cash < -1e-6) bad.push(`${n.uid}.cash`); for (const [g, v] of Object.entries(n.stock)) if (v < -1e-6) bad.push(`${n.uid}.stock.${g}`); for (const s of Object.values(n.shelf)) if (s.n < 0) bad.push(`${n.uid}.shelf`); }
  if (E.get('player') < -1e-6) bad.push('player');
  return bad;
};

// ── 1·2·4: 살림을 사흘 돌린다 (가게 둘을 「살아 있는 건물」로, 플레이어가 사고 일한다) ──
{
  const g = mockGame(7), E = new Economy(g);
  const T0 = E.total();
  const shop = E.node('za/test/mart', 'za', 'mart', 40);
  const cafe = E.node('zb/test/cafe', 'zb', 'food', 20);
  // 진열 칸: 구역 가게 재고에서 가져온다 (ops.fillShelves 와 같은 규칙)
  for (const [k, g2] of [['bread', 0], ['fruit', 1], ['tea', 2], ['jelly', 3]].map(([k], i) => [k, i])) { const v = E.take('za', 'retail', k, 20); shop.shelf[`0:${g2}/0`] = { g: k, n: v, cap: 30, cat: 'x' }; }
  shop.staff = 4; cafe.staff = 2;
  let hours = 0, orders = 0, docked = 0;
  for (let h = 0; h < 72; h++) {
    g.world.clock.time += 1 / 24;
    E.update(1);
    hours++;
    orders += shop.orders.length;
    // 플레이어: 매 시간 하나 사고(진열 칸에서), 가끔 일해서 품삯
    const st = Object.values(shop.shelf).find((q) => q.n > 0);
    if (st && E.get('player') >= E.price(st.g)) { E.transfer('player', `n:${shop.uid}`, E.price(st.g), '시험 구매'); st.n--; g.state.inv[st.g] = (g.state.inv[st.g] || 0) + 1; }
    if (h % 8 === 3) E.transfer(`n:${shop.uid}`, 'player', 3, '시험 품삯');
    const T = E.total();
    check(Math.abs(T - T0) < 0.05, `${h}시간: 돈(울) 합이 달라짐 ${T0} → ${T}`);
    const bad = negatives(E);
    check(!bad.length, `${h}시간: 음수 ${bad.slice(0, 4).join(', ')}`);
    if (h === 30) { E.watch.add(shop.uid); } // 플레이어가 들어간 동안: 주문은 하역장에 짐으로
    docked += (shop.dock || []).length;
    if (shop.dock && shop.dock.length) for (const c of shop.dock.splice(0)) shop.stock[c.g] = (shop.stock[c.g] || 0) + c.n; // 하역 담당이 창고로
  }
  console.log(`살림 ${hours}시간: 돈(울) 합 ${T0} → ${E.total()} · 플레이어 받은 ${E.S.P.earned.toFixed(1)} 쓴 ${E.S.P.spent.toFixed(1)} · 가게 주문(시간 합) ${orders} · 하역장 도착 ${docked} · 가게 판 값 ${shop.sales.toFixed(1)}`);
  for (const [id, z] of Object.entries(E.S.Z)) console.log(`  ${id}: 주민 ${z.pop} 가구 ${Math.round(z.hh)} 회사 ${Math.round(z.firms)} 공공 ${Math.round(z.commons)} · 이번 시간 만든 것 ${Math.round(z.made)} 판 것 ${Math.round(z.sold)} 품삯 ${Math.round(z.wages)}`);
  check(orders > 0, '가게가 물류 창고에 주문하지 않음');
  check(docked > 0, '들어가 있는 동안 하역장에 짐이 오지 않음');
}

// ── 3: 생산을 끄면 물건은 줄기만 ──
{
  const g = mockGame(11), E = new Economy(g);
  for (const z of Object.values(E.S.Z)) { z.farms = 0; z.mines = 0; z.factories = {}; z.plants = 0; }
  const G0 = goodsSum(E);
  for (let h = 0; h < 48; h++) { g.world.clock.time += 1 / 24; E.update(1); }
  const G1 = goodsSum(E);
  const grew = Object.keys(G0).filter((k) => G1[k] > G0[k] + 1e-6);
  check(!grew.length, `생산 없이 늘어난 물건: ${grew.map((k) => `${k} ${G0[k]}→${G1[k]}`).join(', ')}`);
  const used = Object.keys(G0).reduce((a, k) => a + (G0[k] - G1[k]), 0);
  console.log(`생산 끈 이틀: 물건이 늘어난 것 ${grew.length}가지 · 주민이 쓴 물건 ${Math.round(used)}`);
}

// ── 생산을 켜면: 원료 → 공장 → 가게 (빛이 있어야 공장이 돈다) ──
{
  const g = mockGame(13), E = new Economy(g);
  const z = E.S.Z.za;
  const f0 = z.depot.flour || 0;
  let made = 0;
  for (let h = 0; h < 24; h++) { g.world.clock.time += 1 / 24; E.update(1); made += z.made; }
  console.log(`생산 하루 (za): 공장이 만든 것 ${Math.round(made)} · 빛보리 가루 ${Math.round(f0)} → ${Math.round(z.depot.flour || 0)}`);
  check(made > 0, '공장이 아무것도 만들지 않음');
  // 빛이 없으면 공장이 멈춘다
  z.plants = 0; z.depot.fuel = 0;
  let made2 = 0;
  for (let h = 0; h < 12; h++) { g.world.clock.time += 1 / 24; E.update(1); made2 += z.made; }
  check(made2 === 0, `빛(연료) 없이 공장이 돌았음 ${made2}`);
  console.log(`연료가 없으면: 공장이 만든 것 ${made2}`);
}

console.log(fails.length ? `실패 ${fails.length}\n${[...new Set(fails)].slice(0, 20).join('\n')}` : '모두 통과');
process.exit(fails.length ? 1 : 0);
