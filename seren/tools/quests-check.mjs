// 퀘스트 유형·창·추적 검사 (v24 「퀘스트 시스템: 메인/사이드」 · 「목표 방향과 안내 흐름에서 빠져나오는 방법」):
//  1) 지금 있는 이야기 퀘스트는 모두 main, 새 퀘스트만 side · 새 게임은 mq0 부터 같은 순서(next 사슬)
//  2) 시작 조건이 맞으면 사이드가 저절로 열림 → 진행 → 마침 → 후속(sq_codex → sq_codex2) 열림
//  3) 추적: 사이드 고르기 → 목표 칸·표식이 그 퀘스트 · 추적 끄기 → 목표 칸·표식 없음 · 자동 → 메인 · 보류/이어 가기
//  4) 퀘스트 창: 탭(메인/사이드/지난 일)·개수·세부 단계·버튼 · J 로 열고 닫기 · 목표 칸 누르면 열림
//  5) 저장 슬롯 둘에서 퀘스트 상태가 섞이지 않음
//   node tools/quests-check.mjs
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = 'file://' + (process.env.SEREN_HTML || join(root, 'index.html'));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await (await browser.newContext({ viewport: { width: 900, height: 560 } })).newPage();
const logs = [];
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
let fails = 0;
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++; };
const ev = (f, a) => page.evaluate(f, a);
await page.goto(html + '?play=new&nowake=1&q=low&t=0.45', { timeout: 400000 });
await page.waitForFunction(() => window.SEREN && SEREN.game && SEREN.game.mode === 'play' && SEREN.game.city && SEREN.game.city.recs.length, null, { timeout: 400000, polling: 1000 });
await ev(() => { const g = SEREN.game; if (g.tips) g.tips.first = () => false; g.ui.moa = () => {}; });

// 1) 유형·순서
const r1 = await ev(() => {
  const g = SEREN.game, Q = g.quests;
  return { active: g.state.quests.active.slice(), status: { ...g.state.quests.status }, tracked: Q.tracked(), obj: Q.objectiveText() && Q.objectiveText().title };
});
ok(r1.active[0] === 'mq0' && r1.status.mq0 === 'active' && r1.tracked === 'mq0', `새 게임: mq0 진행 중·자동 추적 (${r1.obj})`);
const types = await ev(() => SEREN.questTypes());
ok(types.main.join(',') === 'mq0,mq1,mq1b,mq2,mq2b,mq3,mq4,mq5,mq6,mq7,mq8', `메인 = 지금 있는 이야기 퀘스트 (${types.main.length}개)`);
ok(types.side.includes('sq_mir') && types.side.length >= 5 && types.side.every((id) => id.startsWith('sq_')), `사이드 = 새 퀘스트만 (${types.side.join(', ')})`);
ok(types.chain.join('>') === 'mq0>mq1>mq1b>mq2>mq2b>mq3>mq4>mq5>mq6>mq7>mq8', `메인 순서(next 사슬) 그대로: ${types.chain.join('>')}`);

// 2) 사이드 저절로 열림 → 진행 → 마침 → 후속
const r2 = await ev(async () => {
  const g = SEREN.game, Q = g.quests, s = g.state.quests;
  // mq0 ~ mq2b 를 마친 것으로 (메인 단계 진행 자체는 flow.mjs 가 검사)
  for (const id of ['mq0', 'mq1', 'mq1b', 'mq2', 'mq2b']) { s.active = s.active.filter((x) => x !== id); if (!s.done.includes(id)) s.done.push(id); s.status[id] = 'done'; }
  Q.start('mq3', true);
  Q._autoStart();
  const opened = Object.keys(s.status).filter((id) => id.startsWith('sq_') && s.status[id] === 'active');
  // 도감 셋 → 단계 1 · 여섯 → 마침 → sq_codex2
  const before = g.state.inv.starseed || 0;
  for (const k of ['a1', 'a2', 'a3']) g.state.codex[k] = true;
  Q.update(0.016);
  const step1 = s.step.sq_codex;
  for (const k of ['a4', 'a5', 'a6']) g.state.codex[k] = true;
  Q.update(0.016);
  Q._autoStart();
  return { opened, step1, done: s.status.sq_codex, next: s.status.sq_codex2, reward: (g.state.inv.starseed || 0) - before, mainTracked: Q.tracked() };
});
ok(['sq_codex', 'sq_echo', 'sq_reader', 'sq_shift'].every((id) => r2.opened.includes(id)) && !r2.opened.includes('sq_mir'), `조건이 맞는 사이드가 저절로 열림 (${r2.opened.join(', ')}) · 말 걸어 여는 sq_mir 는 아님`);
ok(r2.step1 === 1 && r2.done === 'done' && r2.next === 'active' && r2.reward > 0, `sq_codex 진행 → 마침(보상 +${r2.reward}) → 후속 sq_codex2 열림`);
ok(r2.mainTracked === 'mq3', `사이드가 열려도 자동 추적은 메인 (${r2.mainTracked})`);

// 3) 추적 전환·끄기·다시·보류
const r3 = await ev(() => {
  const g = SEREN.game, Q = g.quests, out = {};
  Q.track('sq_echo'); out.t1 = Q.tracked(); out.o1 = Q.objectiveText().title; out.k1 = Q.objectiveText().kind; out.hud1 = !g.ui.obj.classList.contains('hidden') && g.ui.obj.querySelector('.q').textContent;
  Q.untrack(); out.t2 = Q.tracked(); out.o2 = Q.objectiveText(); out.tg2 = Q.targets().filter((t) => !t.venue).length; out.hud2 = g.ui.obj.classList.contains('hidden');
  Q.track('sq_reader'); out.t3 = Q.tracked();
  Q.hold('sq_reader'); out.t4 = Q.tracked(); out.st4 = Q.status('sq_reader');
  Q.resume('sq_reader'); out.t5 = Q.tracked(); out.st5 = Q.status('sq_reader');
  Q.hold('mq3'); out.mainHold = Q.status('mq3');
  Q.track(null); out.t6 = Q.tracked();
  return out;
});
ok(r3.t1 === 'sq_echo' && r3.o1 === '메아리 따라가기' && r3.k1 === 'side' && r3.hud1 === '메아리 따라가기', `사이드 추적: 목표 칸 「${r3.hud1}」`);
ok(r3.t2 === null && r3.o2 === null && r3.tg2 === 0 && r3.hud2, `추적 끄기: 목표 칸 숨김 · 표식 ${r3.tg2}`);
ok(r3.t3 === 'sq_reader' && r3.t4 !== 'sq_reader' && r3.st4 === 'held' && r3.t5 === 'sq_reader' && r3.st5 === 'active', `다시 추적 → 보류(추적에서 빠짐) → 이어 가기 (${r3.t4} → ${r3.t5})`);
ok(r3.mainHold === 'active' && r3.t6 === 'mq3', `메인은 보류되지 않음 · 자동 추적 → ${r3.t6}`);

// 4) 퀘스트 창
// 헤드리스는 초당 1프레임 남짓이라 짧게 누르면 프레임 사이로 빠진다 — 프레임이 지나도록 누르고 있다가 뗀다
const tap = async (key, until) => { await page.keyboard.down(key); try { await page.waitForFunction(until, null, { timeout: 30000, polling: 200 }); } catch { /* 아래에서 실패로 */ } await page.keyboard.up(key); };
await tap('KeyJ', () => !!document.querySelector('.menu .qlog'));
const r4 = await ev(() => {
  const m = document.querySelector('.menu .qlog');
  if (!m) return { open: false };
  const tabs = [...m.querySelectorAll('[data-tab]')].map((b) => b.textContent.trim());
  return { open: true, tab: SEREN.game.ui.menuTab, tabs, items: m.querySelectorAll('.ql-item').length, det: !!m.querySelector('.ql-det .ql-steps li.now'), off: !!m.querySelector('[data-off]') };
});
ok(r4.open && r4.tab === 'quests', `J → 퀘스트 창 (${r4.tab})`);
ok(r4.tabs && r4.tabs[0].startsWith('메인 퀘스트') && r4.tabs[1].startsWith('사이드 퀘스트') && r4.tabs[2].startsWith('지난 일'), `탭: ${r4.tabs && r4.tabs.join(' | ')}`);
ok(r4.items >= 1 && r4.det && r4.off, `목록 ${r4.items} · 세부 단계(지금 ▶) · 「추적 끄기」 단추`);
await page.click('.qlog [data-tab="side"]');
const r4b = await ev(() => ({ items: [...document.querySelectorAll('.qlog .ql-item .qt')].map((e) => e.textContent.trim().slice(0, 14)), btn: !!document.querySelector('.qlog .ql-det [data-track], .qlog .ql-det [data-untrack]') }));
ok(r4b.items.length >= 4 && r4b.btn, `사이드 탭: ${r4b.items.join(' / ')}`);
await page.click('.qlog .ql-det [data-track], .qlog .ql-det [data-untrack]');
const r4c = await ev(() => SEREN.game.quests.tracked());
ok(!!r4c, `창에서 추적 단추 → ${r4c}`);
await page.click('.qlog [data-tab="past"]');
const r4d = await ev(() => [...document.querySelectorAll('.qlog .ql-item .qt')].map((e) => e.textContent.trim().slice(0, 12)));
ok(r4d.some((t) => t.startsWith('세렌 도감 첫 장')) && r4d.some((t) => t.startsWith('착륙')), `지난 일: ${r4d.join(' / ')}`);
await page.screenshot({ path: join(root, 'shots', 'quest-window.png'), timeout: 240000 });
await tap('KeyJ', () => !SEREN.game.ui.menuEl);
await page.waitForTimeout(500);
ok(await ev(() => !SEREN.game.ui.menuEl && SEREN.game.mode === 'play'), 'J 로 닫힘 → 놀이로');
await ev(() => SEREN.game.ui.obj.click());
ok(await ev(() => SEREN.game.ui.menuTab === 'quests' && !!SEREN.game.ui.menuEl), '목표 칸 누르면 퀘스트 창');
await ev(() => SEREN.game.ui.closeMenu());

// 5) 슬롯 분리
const r5 = await ev(async () => {
  const g = SEREN.game, A = g.slot;
  g.quests.track('sq_shift'); g.save(true);
  g.newGame(true, { name: '퀘스트 B' });
  await new Promise((r) => setTimeout(r, 300));
  const B = g.slot, bStatus = JSON.stringify(g.state.quests.status), bTr = g.quests.tracked();
  g.save(true);
  g.continueGame(A);
  const a = { tr: g.quests.tracked(), codex2: g.quests.status('sq_codex2'), mq3: g.quests.status('mq3') };
  g.continueGame(B);
  const b = { tr: g.quests.tracked(), codex2: g.quests.status('sq_codex2') };
  return { bStatus, bTr, a, b };
});
ok(r5.bStatus === '{"mq0":"active"}' && r5.bTr === 'mq0', `새 슬롯 B: 퀘스트 처음부터 (${r5.bStatus})`);
ok(r5.a.tr === 'sq_shift' && r5.a.codex2 === 'active' && r5.a.mq3 === 'active', `슬롯 A 다시: 추적 ${r5.a.tr} · sq_codex2 ${r5.a.codex2}`);
ok(r5.b.tr === 'mq0' && r5.b.codex2 === null, `슬롯 B 다시: 추적 ${r5.b.tr} · sq_codex2 ${r5.b.codex2}`);

console.log(logs.length ? `기록:\n${[...new Set(logs)].slice(0, 8).join('\n')}` : '페이지 오류 없음');
console.log(fails ? `실패 ${fails}` : '모두 통과');
await browser.close();
process.exit(fails ? 1 : 0);
