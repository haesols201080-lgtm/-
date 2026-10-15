// 저장 슬롯 검사 (v24 「저장 슬롯과 상태 경계」):
//  1) 슬롯 둘(A·B)에 서로 다른 진행을 저장하고 번갈아 불러와 섞이지 않는지 (깃발·자리·가방·시각)
//  2) 다시 열기(새로고침) → 타이틀 「이어하기」 목록에 둘 다, 요약(자리·목표·놀이 시간·작은 그림)
//  3) 한 슬롯을 깨뜨리면 그 슬롯만 「불러오지 못했어요」, 타이틀에 머물고, 다른 슬롯은 그대로 불러와진다
//  4) 한 슬롯을 지우고 새 여정 → 남은 슬롯은 그대로
//  5) 옛 단일 저장(seren.save.v1) → 첫 슬롯으로 옮겨짐 · 설정(시점)은 슬롯과 상관없는 전역
//   node tools/slots-check.mjs
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = 'file://' + (process.env.SEREN_HTML || join(root, 'index.html'));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 640, height: 360 } });
const page = await ctx.newPage();
const logs = [];
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
let fails = 0;
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++; };
const ev = (f, a) => page.evaluate(f, a);
const ready = () => page.waitForFunction(() => window.SEREN && SEREN.game && SEREN.game.city && SEREN.game.city.recs && SEREN.game.city.recs.length > 0 && SEREN.game.mode === 'play', null, { timeout: 400000, polling: 1000 });
const titleUp = () => page.waitForFunction(() => window.SEREN && SEREN.game && SEREN.game.mode === 'title' && document.querySelector('.title-screen'), null, { timeout: 400000, polling: 1000 });

// ── 1) 슬롯 둘
await page.goto(html + '?play=new&nowake=1&q=low&t=0.45', { timeout: 400000 });
await ready();
const A = await ev(async () => {
  const g = SEREN.game;
  g.state.flags.testA = 1; g.state.inv.tea = 3;
  g.state.health.hp = 40; g.state.inv.starseed = 100; g.bank.deposit(60); g.bank.careFee('시험 치유원', 'down:A');
  g.quests.untrack();
  g.player.teleport(-2100, undefined, 5200); g.world.clock.time = 0.3;
  g.save(true);
  await new Promise((r) => setTimeout(r, 2500)); // 작은 그림은 다음 렌더 뒤에
  return g.slot;
});
ok(!!A, `슬롯 A 만들어짐 (${A})`);
await ev((A) => SEREN.slots.rename(A, 'A 여정'), A);
const B = await ev(async () => {
  const g = SEREN.game;
  g.newGame(true, { name: 'B 여정' });
  await new Promise((r) => setTimeout(r, 500));
  g.state.flags.testB = 1;
  g.state.health.hp = 90; g.state.inv.starseed = 0; g.bank.careFee('다른 치유원', 'down:B');
  g.player.teleport(-2400, undefined, 5400); g.world.clock.time = 0.7;
  g.save(true);
  await new Promise((r) => setTimeout(r, 2500));
  return g.slot;
});
ok(B && B !== A, `슬롯 B 만들어짐 (${B})`);
try { await page.waitForFunction(() => SEREN.slots.list().filter((m) => m.thumb).length >= 2, null, { timeout: 120000, polling: 1000 }); } catch { /* 아래에서 실패로 */ }
const list1 = await ev(() => SEREN.slots.list());
ok(list1.length === 2, `슬롯 목록 2개 (${list1.map((m) => m.name).join(', ')})`);
ok(list1.every((m) => m.place && m.saved > 0), `요약에 자리·저장 시각 (${list1.map((m) => m.place).join(' / ')})`);
ok(list1.every((m) => m.thumb && m.thumb.startsWith('data:image/jpeg')), `작은 그림이 붙음 (${list1.map((m) => (m.thumb || '').length).join(', ')} 글자)`);
for (const [id, mine, other, x] of [[A, 'testA', 'testB', -2100], [B, 'testB', 'testA', -2400], [A, 'testA', 'testB', -2100]]) {
  const r = await ev(({ id, mine, other }) => { const g = SEREN.game; const okL = g.continueGame(id); return { okL, slot: g.slot, mine: g.state.flags[mine], other: g.state.flags[other], x: g.player.pos.x, item: g.state.inv.tea, hp: g.state.health.hp, bal: g.state.bank.balance, debt: g.state.bank.debt, led: g.state.bank.ledger.map((e) => e.where || e.kind).join(','), tr: g.state.quests.tracked, obj: !!g.quests.objectiveText() }; }, { id, mine, other });
  ok(r.okL !== false && r.slot === id && r.mine === 1 && !r.other && Math.abs(r.x - x) < 2, `${id === A ? 'A' : 'B'} 불러오기: 자기 깃발만, 자리 ${r.x.toFixed(0)}${id === A ? `, 가방 ${r.item}` : ''}`);
  if (id === A) ok(r.hp === 40 && r.bal === 50 && r.debt === 0 && r.led === 'deposit,시험 치유원' && r.tr === 'none' && !r.obj, `A: 체력 ${r.hp} · 계좌 ${r.bal} · 부채 ${r.debt} · 원장 ${r.led} · 추적 ${r.tr}`);
  else ok(r.hp === 90 && r.bal === 0 && r.debt > 0 && r.led === '다른 치유원' && r.tr !== 'none' && r.obj, `B: 체력 ${r.hp} · 계좌 ${r.bal} · 부채 ${r.debt} · 원장 ${r.led} · 추적 ${r.tr}`);
}
// 설정은 전역
await ev(() => { const g = SEREN.game; g.toggleView(); });
const view1 = await ev(() => SEREN.game.settings.view);

// ── 2) 새로고침 → 타이틀 「이어하기」 목록
await page.goto(html + '?nowake=1&q=low&t=0.45', { timeout: 400000 });
await titleUp();
const t2 = await ev(() => ({ cont: !!document.querySelector('.title-screen [data-c]'), notes: !!document.querySelector('.title-notes'), view: SEREN.game.settings.view }));
ok(t2.cont, '타이틀에 「이어하기」');
ok(t2.notes, '타이틀에 「업데이트 내역」');
ok(t2.view === view1, `설정(시점 ${t2.view})은 다시 열어도 그대로 — 슬롯과 상관없는 전역`);
await page.click('.title-screen [data-c]');
const cards = await ev(() => [...document.querySelectorAll('.title-slots .slot')].map((c) => ({ name: c.querySelector('.sl-name').textContent, sub: c.querySelector('.sl-sub').textContent, img: !!c.querySelector('.sl-thumb img') })));
ok(cards.length === 2, `이어하기 목록 카드 2장 (${cards.map((c) => `${c.name} — ${c.sub}`).join(' | ')})`);
await page.screenshot({ path: join(root, 'shots', 'slots-list.png'), timeout: 240000 });
// B 카드의 불러오기
await ev((B) => { const cs = [...document.querySelectorAll('.title-slots .slot')]; const L = SEREN.slots.list(); const i = L.findIndex((m) => m.id === B); cs[i].querySelector('[data-load]').click(); }, B);
await ready();
const r2 = await ev(() => ({ slot: SEREN.game.slot, b: SEREN.game.state.flags.testB, a: SEREN.game.state.flags.testA }));
ok(r2.slot === B && r2.b === 1 && !r2.a, '목록에서 B 불러오기');

// ── 3) A 를 깨뜨린다
await ev((A) => localStorage.setItem('seren.slot.' + A, '{"깨진'), A);
await page.goto(html + '?nowake=1&q=low&t=0.45', { timeout: 400000 });
await titleUp();
await page.click('.title-screen [data-c]');
await ev((A) => { const cs = [...document.querySelectorAll('.title-slots .slot')]; const L = SEREN.slots.list(); cs[L.findIndex((m) => m.id === A)].querySelector('[data-load]').click(); }, A);
await page.waitForTimeout(1500);
const r3 = await ev((A) => ({ mode: SEREN.game.mode, title: !!document.querySelector('.title-screen:not(.out)'), toast: [...document.querySelectorAll('.toast')].map((t) => t.textContent).join(' / '), broken: (SEREN.slots.list().find((m) => m.id === A) || {}).broken }), A);
ok(r3.mode === 'title' && r3.title, `깨진 A: 타이틀에 머묾 (${r3.mode})`);
ok(/불러오지 못했/.test(r3.toast), `알림: ${r3.toast.slice(0, 60)}`);
ok(/불러오지 못했/.test(r3.broken || ''), `목록에 표시: ${r3.broken}`);
await page.click('.title-screen [data-c]');
const dis = await ev((A) => { const cs = [...document.querySelectorAll('.title-slots .slot')]; const L = SEREN.slots.list(); return cs[L.findIndex((m) => m.id === A)].querySelector('[data-load]').disabled; }, A);
ok(dis, '깨진 슬롯의 「불러오기」는 막힘');
await ev((B) => { const cs = [...document.querySelectorAll('.title-slots .slot')]; const L = SEREN.slots.list(); cs[L.findIndex((m) => m.id === B)].querySelector('[data-load]').click(); }, B);
await ready();
ok(await ev((B) => SEREN.game.slot === B && SEREN.game.state.flags.testB === 1, B), '깨진 A 와 상관없이 B 는 그대로 불러와짐');

// ── 4) A 지우고 새 여정 (UI: 새 여정 → 새 슬롯에 시작)
await page.goto(html + '?nowake=1&q=low&t=0.45', { timeout: 400000 });
await titleUp();
await ev((A) => SEREN.slots.remove(A), A);
await page.click('.title-screen [data-n]');
const nw = await ev(() => ({ newCard: !!document.querySelector('.title-slots .slot.new [data-start]'), n: document.querySelectorAll('.title-slots .slot:not(.new)').length }));
ok(nw.newCard && nw.n === 1, `새 여정 목록: 새 슬롯 칸 + 남은 슬롯 ${nw.n}`);
await page.fill('.title-slots .slot.new input', 'C 여정');
await page.click('.title-slots .slot.new [data-start]');
await page.waitForFunction(() => SEREN.game.mode === 'intro' || SEREN.game.mode === 'play', null, { timeout: 60000, polling: 500 });
const r4 = await ev((B) => { const L = SEREN.slots.list(); return { names: L.map((m) => m.name), slot: SEREN.game.slot, bKept: !!localStorage.getItem('seren.slot.' + B) }; }, B);
ok(r4.names.includes('C 여정') && r4.names.includes('B 여정') && r4.names.length === 2 && r4.slot !== B && r4.bKept, `새 여정 C 시작, B 는 그대로 (${r4.names.join(', ')})`);

// ── 5) 옛 단일 저장 옮기기 (새 문맥)
const ctx2 = await browser.newContext({ viewport: { width: 640, height: 360 } });
const p2 = await ctx2.newPage();
p2.on('pageerror', (e) => logs.push(`[pageerror2] ${e.message}`));
await p2.goto(html + '?nowake=1&q=low&t=0.45', { timeout: 400000 });
await p2.waitForFunction(() => window.SEREN && SEREN.game && SEREN.game.mode === 'title', null, { timeout: 400000, polling: 1000 });
const r5 = await p2.evaluate(() => {
  const s = SEREN.defaultState(); s.flags.legacy = 7; s.saved = Date.now();
  s.version = 1; delete s.health; delete s.bank; delete s.quests.status; delete s.quests.tracked; delete s.quests.log;
  s.quests.active = ['mq1']; s.quests.done = ['mq0']; s.quests.step = { mq1: 1 }; s.quests.data = { mq1: {} };
  localStorage.setItem('seren.save.v1', JSON.stringify(s));
  const L = SEREN.slots.list();
  const g = SEREN.game, okL = L.length === 1 && g.continueGame(L[0].id) !== false;
  const q = g.state.quests;
  return { n: L.length, name: L[0] && L[0].name, legacyGone: !localStorage.getItem('seren.save.v1'), flag: g.state.flags.legacy, okL, st: JSON.stringify(q.status), step: q.step.mq1, tr: g.quests.tracked(), hp: g.state.health && g.state.health.hp, bank: !!g.state.bank, ver: g.state.version };
});
ok(r5.n === 1 && r5.legacyGone && r5.flag === 7 && r5.okL, `옛 저장 → 「${r5.name}」 슬롯 (옛 열쇠 지움, 깃발 ${r5.flag})`);
ok(r5.st === '{"mq0":"done","mq1":"active"}' && r5.step === 1 && r5.tr === 'mq1' && r5.hp === 100 && r5.bank && r5.ver === 2, `판 1 → 2 옮기기: 퀘스트 상태 ${r5.st} · 단계 ${r5.step} 그대로 · 추적 ${r5.tr} · 체력 ${r5.hp} · 은행 ${r5.bank}`);

console.log(logs.length ? `기록:\n${[...new Set(logs)].slice(0, 8).join('\n')}` : '페이지 오류 없음');
console.log(fails ? `실패 ${fails}` : '모두 통과');
await browser.close();
process.exit(fails ? 1 : 0);
