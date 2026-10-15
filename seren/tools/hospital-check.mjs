// 체력·쓰러짐·병원 이송 검사 (v24 「체력 0: 쓰러짐 → 병원 이송 → 치료비·의료 부채」 중간 QA):
//  1) 생활권(도시 구역)마다 입원실·침상이 있는 치유원이 있는가 · 병실 없는 진료소는 건너뛰는가
//  2) 세게 떨어지면 체력이 준다 · 쉬면/먹으면 오른다
//  3) 도시 길 · 자연(이슬터 들판) · 다른 건물 안에서 쓰러지기 → 가장 가까운 회복 가능 병원의 입원실 침상 옆에서 깨어남
//     (걸을 수 있는 칸 · 가구·벽에 끼지 않음 · 체력 다 참 · 놀이 상태) → 그 병원에서 걸어 나갈 길(승강기·계단 이음)이 있음 → 나가기
//  4) 현금만 · 예금만 · 혼합 · 0 — 정확히 절반 / 최소 응급 치료비 부채 · 원장에 병원 이름
//  5) 저장 → 다시 불러오기 뒤 같은 쓰러짐이 다시 청구되지 않음 · 가방·퀘스트 그대로
//   node tools/hospital-check.mjs
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await (await browser.newContext({ viewport: { width: 800, height: 450 } })).newPage();
const logs = [];
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
let fails = 0;
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++; };
const ev = (f, a) => page.evaluate(f, a);
await page.goto('file://' + (process.env.SEREN_HTML || join(root, 'index.html')) + '?play=new&nowake=1&q=low&t=0.45', { timeout: 400000 });
await page.waitForFunction(() => window.SEREN && SEREN.game && SEREN.game.mode === 'play' && SEREN.game.city && SEREN.game.city.recs.length, null, { timeout: 400000, polling: 1000 });
await ev(() => { const g = SEREN.game; if (g.tips) g.tips.first = () => false; g.ui.moa = () => {}; });
const settle = () => page.waitForFunction(() => { const g = SEREN.game; return !g.state.health.down && g.mode === 'play' && !g.interiors._busy; }, null, { timeout: 240000, polling: 300 });

// 1) 생활권마다 병원
const r1 = await ev(() => {
  const g = SEREN.game, Hl = g.health, C = g.city, I = g.interiors;
  const heal = C.recs.filter((r) => r.door && I.info(r).pid === 'heal');
  const zones = C.zones.filter((Z) => Z.rOut > 300);
  const out = [];
  let noWard = 0;
  for (const Z of zones) {
    const h = Hl.nearestHospital(Z.cx, Z.cz, 60);
    out.push({ z: Z.id, d: h ? Math.round(h.d) : null, skip: h ? h.skipped.length : null });
  }
  for (const r of heal.slice(0, 40)) if (!Hl.wardOf(r)) noWard++;
  return { heal: heal.length, zones: out, noWard };
});
const far = r1.zones.filter((z) => z.d == null || z.d > 2500);
ok(far.length === 0, `생활권 ${r1.zones.length}곳 모두 2.5 km 안에 병실 있는 치유원 (가장 먼 곳 ${Math.max(...r1.zones.map((z) => z.d || 0))} m · 치유원 ${r1.heal} · 앞 40 중 병실 없는 진료소 ${r1.noWard})${far.length ? ` — 없는 곳: ${far.map((z) => z.z).join(', ')}` : ''}`);

// 2) 떨어짐 · 회복 — 헤드리스는 초당 1프레임 남짓이라 물리를 페이지 안에서 직접 1/60 초씩 돌린다 (게임의 걸음과 같은 순서: 이동 → 사건 → 체력)
const fall = await ev(() => {
  const g = SEREN.game, p = g.player, H = g.state.health;
  H.hp = H.max;
  p.teleport(-2210, undefined, 5255);
  p.pos.y += 120; p.vel.set(0, -50, 0); p.setState('air'); // teleport 는 땅에 붙이므로 높이를 바로
  let k = 0, impact = 0;
  while (p.state !== 'ground' && k < 3000) { p.update(1 / 60, g.input, g.rig); if (p.events.includes('land')) impact = p.impact; g._playerEvents(); g.health.update(1 / 60); k++; }
  return { state: p.state, steps: k, impact: Math.round(impact) };
});
console.log(`  (떨어짐: ${fall.steps} 걸음 · 부딪힌 속도 ${fall.impact} m/s · ${fall.state})`);
const r2 = await ev(() => {
  const g = SEREN.game, H = g.state.health;
  const afterFall = H.hp;
  g.venues.inv.meal = (g.venues.inv.meal || 0) + 1; g.venues.useItem('meal');
  return { afterFall, afterMeal: H.hp, max: H.max };
});
ok(r2.afterFall < r2.max && r2.afterFall > 0, `세게 떨어짐 → 체력 ${r2.afterFall}/${r2.max}`);
ok(r2.afterMeal > r2.afterFall, `먹으면 회복 → ${r2.afterMeal}`);

// 3) 세 자리에서 쓰러지기
const spots = [
  ['도시 길', async () => ev(() => { const g = SEREN.game, Z = g.city.zones.find((z) => z.rOut > 600) || g.city.zones[0]; g.player.teleport(Z.cx + 40, undefined, Z.cz + 25); return [Z.cx, Z.cz]; })],
  ['자연 (이슬터 들판)', async () => ev(() => { const g = SEREN.game; g.player.teleport(-2600, undefined, 5600); return [-2600, 5600]; })],
  ['다른 건물 안', async () => {
    await ev(() => { const g = SEREN.game, I = g.interiors, C = g.city, P = g.player.pos; const r = C.recs.filter((q) => q.door && I.info(q).pid === 'office').sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z))[0]; C.fixDoor(r); g.player.teleport(r.door.x + r.door.nx * 3, undefined, r.door.z + r.door.nz * 3); I.enter(r); window.__off = r; });
    await page.waitForFunction(() => SEREN.game.interiors.inPocket && !SEREN.game.interiors._busy, null, { timeout: 180000, polling: 300 });
    return ev(() => [window.__off.x, window.__off.z]);
  }],
];
const money = [[60, 0], [0, 80], [20, 30], [0, 0]];
for (let k = 0; k < spots.length + 1; k++) {
  const [label, go] = spots[k % spots.length];
  const [cash, bal] = money[k];
  await settle();
  if (await ev(() => SEREN.game.interiors.inPocket)) { await ev(() => SEREN.game.interiors.exit()); await page.waitForFunction(() => !SEREN.game.interiors.inPocket && !SEREN.game.interiors._busy, null, { timeout: 120000, polling: 300 }); }
  const at = await go();
  const r = await ev(async ({ cash, bal, at }) => {
    const g = SEREN.game, H = g.state.health, B = g.state.bank;
    g.state.inv.starseed = cash; B.balance = bal; const debt0 = B.debt, led0 = B.ledger.length;
    const want = g.health.nearestHospital(at[0], at[1]);
    g.health.hurt(H.hp + 5, '시험');
    return { down: !!H.down, want: want ? g.interiors.title(want.r) : null, wantFloor: want && want.floor, skipped: want ? want.skipped.length : 0, debt0, led0 };
  }, { cash, bal, at });
  ok(r.down, `${label}: 쓰러짐 (병원 ${r.want}${r.skipped ? ` · 병실 없는 곳 ${r.skipped}곳 건너뜀` : ''})`);
  await settle();
  const w = await ev(({ want, wantFloor }) => {
    const g = SEREN.game, I = g.interiors, cur = I.cur, ind = cur && cur.indoor, p = g.player.pos, H = g.state.health, B = g.state.bank;
    if (!ind) return { inside: false };
    const pl = ind.plan(ind.cur), G = ind.B.G, [gx, gz] = ind.grid(p.x, p.z), c = Math.floor(gz - G.oz) * G.gw + Math.floor(gx - G.ox), R = pl.L.rooms[pl.L.room[c] - 1];
    const beds = (pl.fix || []).filter((q) => q.tag === 'bed'), bd = Math.min(...beds.map((q) => Math.hypot(q.x - gx, q.z - gz)));
    const q = p.clone(); g.world.colliders.pushOut(q, 0.38, 1.75, 0.2); const stuck = Math.hypot(q.x - p.x, q.z - p.z);
    const links = (ind.B.links || []).filter((L) => (L.floors || []).includes(ind.cur) || L.a === ind.cur || L.b === ind.cur).length;
    const e = B.ledger.at(-1);
    return { inside: true, name: I.title(cur.r), same: I.title(cur.r) === want, floor: ind.cur, wantFloor, room: R && R.type, walk: ind.inside(ind.cur, p.x, p.z), bed: bd, stuck, hp: H.hp, max: H.max, mode: g.mode, links, cash: g.state.inv.starseed, bal: B.balance, debt: B.debt, e: e && { where: e.where, total: e.total, kind: e.kind }, mail: g.state.os.mail.at(-1) && g.state.os.mail.at(-1).subj };
  }, { want: r.want, wantFloor: r.wantFloor });
  ok(w.inside && w.same && w.floor === w.wantFloor && w.room === 'wardroom', `  → ${w.name} ${w.floor}층 ${w.room} (고른 병원과 같음 ${w.same})`);
  ok(w.walk && w.bed < 3 && w.stuck < 0.05 && w.hp === w.max && w.mode === 'play', `  → 침상 ${w.bed && w.bed.toFixed(1)} m 옆 · 걸을 수 있는 칸 ${w.walk} · 끼임 ${w.stuck.toFixed(2)} · 체력 ${w.hp} · ${w.mode}`);
  ok(w.links > 0, `  → 층을 잇는 승강기·계단 ${w.links}`);
  const L = cash + bal;
  if (L > 0) ok(Math.abs(w.cash + w.bal - L / 2) < 0.011 && w.e && w.e.kind === 'care' && Math.abs(w.e.total - L / 2) < 0.011 && w.e.where === w.name, `  → 유동 자산 ${L} (가방 ${cash} · 계좌 ${bal}) → 치료비 ${w.e && w.e.total} · 남은 ${(w.cash + w.bal).toFixed(2)} · 원장 「${w.e && w.e.where}」 · 메일 「${w.mail}」`);
  else ok(w.debt === r.debt0 + 40 && w.e && w.e.kind === 'debt', `  → 가진 돈 0 → 의료 부채 ${w.debt} (+40) · 메일 「${w.mail}」`);
}

// 5) 저장 → 다시 불러오기 뒤 같은 사건이 다시 청구되지 않음 · 나가기
const r5 = await ev(async () => {
  const g = SEREN.game, id = g.slot, B = g.state.bank;
  g.state.inv.tea = 5; const n0 = B.ledger.length, d0 = B.debt, q0 = JSON.stringify(g.state.quests.status);
  g.save(true);
  g.continueGame(id);
  await new Promise((r) => setTimeout(r, 2500));
  const B2 = g.state.bank;
  return { n: B2.ledger.length === n0, d: B2.debt === d0, tea: g.state.inv.tea, q: JSON.stringify(g.state.quests.status) === q0, down: g.state.health.down, hp: g.state.health.hp };
});
ok(r5.n && r5.d && r5.tea === 5 && r5.q && !r5.down, `저장 → 불러오기: 원장·부채 그대로(두 번 청구 없음) · 가방 차 ${r5.tea} · 퀘스트 그대로 · 체력 ${r5.hp}`);

console.log(logs.length ? `기록:\n${[...new Set(logs)].slice(0, 8).join('\n')}` : '페이지 오류 없음');
console.log(fails ? `실패 ${fails}` : '모두 통과');
await browser.close();
process.exit(fails ? 1 : 0);
