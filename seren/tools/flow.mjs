// 개발용: 본편 흐름 자동 점검. 입력을 흉내 내고, 순간이동·대화 넘기기로 이야기를 끝까지 밀어 봅니다.
//   node tools/flow.mjs
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack}`));
await page.goto('file://' + join(root, 'index.html') + '?q=low&bloom=0&play=new&nowake=1');
await page.waitForFunction(() => window.SEREN && window.SEREN.game && window.SEREN.game.mode === 'play', null, { timeout: 120000, polling: 300 });

const ev = (fn, arg) => page.evaluate(fn, arg);
const q = () => ev(() => { const g = SEREN.game; return { q: g.quests.objectiveText(), mode: g.mode, tones: g.state.tones.join(','), vocab: Object.keys(g.state.vocab).length }; });
// 게임 루프를 빠르게 돌림 (렌더링 포함 update 를 직접 호출)
const run = (sec, setup) => ev(([sec, setup]) => {
  const g = SEREN.game;
  if (setup) new Function('g', setup)(g);
  const n = Math.round(sec / 0.05);
  for (let i = 0; i < n; i++) g.update(0.05);
  return true;
}, [sec, setup]);
const talkThrough = async () => {
  for (let k = 0; k < 40; k++) {
    const st = await ev(() => { const g = SEREN.game; if (g.mode !== 'dialogue') return 'done'; if (g.dialogue.active) g.dialogue.active.wait = 0; const ch = document.querySelector('.dialogue .choices button'); if (ch) ch.click(); else g.dialogue.next(); return g.mode; });
    if (st === 'done') return;
    await run(0.2);
  }
};
const step = async (label, fn) => { let r; try { r = await fn(); } catch (e) { logs.push(`[step ${label}] ${e.message}`); } console.log(label.padEnd(26), JSON.stringify(await q()), r !== undefined && r !== true ? JSON.stringify(r) : ''); };

await step('시작', async () => {});
await step('움직이기', () => run(3, "g.player.state='ground'; g.input.held.add('up')"));
await ev(() => SEREN.game.input.held.clear());
await step('이엘에게 다가감', () => run(1, "const n=g.npcs.get('iel'); g.player.teleport(n.pos.x+3, undefined, n.pos.z+3)"));
await step('이엘과 대화', async () => { await ev(() => { const g = SEREN.game; g.talkTo(g.npcs.get('iel')); }); await talkThrough(); });
await step('이슬터로', () => run(2, "const p=g.npcs.get('iel'); g.player.teleport(-420+20, undefined, 7820+30)"));
await step('이엘과 대화(마을)', async () => { await ev(() => { const g = SEREN.game; const n = g.npcs.get('iel'); g.player.teleport(n.pos.x + 3, undefined, n.pos.z + 3); g.talkTo(n); }); await talkThrough(); });
await step('글자돌 셋', () => ev(() => { const g = SEREN.game; for (const id of ['g-star', 'g-we', 'g-song']) { g.discovery.readGlyph(g.discovery.glyph(id)); g.ui.closeCard(); } }));
await run(0.5);
await step('우물 이야기', async () => { await ev(() => { const g = SEREN.game; const n = g.npcs.get('iel'); g.player.teleport(n.pos.x + 3, undefined, n.pos.z + 3); g.talkTo(n); }); await talkThrough(); });
await step('솟음 연주 @우물', () => run(0.5, "g.player.teleport(-420+5, undefined, 7820+5); g.resonance.play(0)"));
await step('이엘(우물 후)', async () => { await run(0.3); await ev(() => { const g = SEREN.game; const n = g.npcs.get('iel'); g.player.teleport(n.pos.x + 3, undefined, n.pos.z + 3); g.talkTo(n); }); await talkThrough(); });
await step('온과 대화', async () => { await ev(() => { const g = SEREN.game; const n = g.npcs.get('on'); g.player.teleport(n.pos.x + 3, undefined, n.pos.z + 3); g.talkTo(n); }); await talkThrough(); });
await step('부품 줍기', () => ev(() => { const g = SEREN.game; for (const p of g.discovery.pickups) g.discovery.take(p); }));
await run(0.3);
await step('온에게 부품', async () => { await ev(() => { const g = SEREN.game; const n = g.npcs.get('on'); g.player.teleport(n.pos.x + 3, undefined, n.pos.z + 3); g.talkTo(n); }); await talkThrough(); });
await step('썰매 타기', () => run(8, "g.player.teleport(500, undefined, 8000); g.input.down.add('skimmer'); g.input.held.add('up')"));
await ev(() => SEREN.game.input.held.clear());
await step('이엘(척추로)', async () => { await ev(() => { const g = SEREN.game; const n = g.npcs.get('iel'); g.player.state = 'ground'; g.player.teleport(n.pos.x + 3, undefined, n.pos.z + 3); g.talkTo(n); }); await talkThrough(); });
await step('척추 도착', () => run(1, "g.player.teleport(0, undefined, 150)"));
await step('하우와 대화', async () => { await ev(() => { const g = SEREN.game; const n = g.npcs.get('hau'); g.player.teleport(n.pos.x + 3, undefined, n.pos.z + 3); g.talkTo(n); }); await talkThrough(); });
await step('전망대', async () => { await ev(() => { const g = SEREN.game; g.player.teleport(0, g.structures.deckY + 1, 20); g.vista('spine-deck', { x: 0, y: g.structures.deckY, z: 0, place: { name: '척추 전망대' } }); g.director.skip(); }); });
// 이웃이 되기: 일하고, 사고, 전시를 보고, 이웃을 돕는다
await step('일·구매·전시·돕기', async () => { await ev(() => { const g = SEREN.game; g.venues._wage(3, '시험 일'); g.ui.closeCard && g.ui.closeCard(); }); await run(0.3); await ev(() => { const g = SEREN.game; g.venues._pay(1); g.state.venue.exhibits['test'] = true; }); await run(0.3); await ev(() => SEREN.game.setFlag('helpedNeighbor')); await run(0.3); });
await step('하우(이웃)', async () => { await ev(() => { const g = SEREN.game; const n = g.npcs.get('hau'); g.player.teleport(n.pos.x + 3, undefined, n.pos.z + 3); g.talkTo(n); }); await talkThrough(); });
await step('공명탑 3개', async () => { for (const id of ['glass-pylon', 'bloom-pylon', 'canyon-pylon']) { await ev((id) => { const g = SEREN.game; g.awakenPylon(id); g.director.skip(); }, id); await run(0.3); } });
await step('하우(밤)', async () => { await ev(() => { const g = SEREN.game; const n = g.npcs.get('hau'); g.player.teleport(n.pos.x + 3, undefined, n.pos.z + 3); g.talkTo(n); }); await talkThrough(); });
await step('밤 기다리기', () => run(1, "g.world.clock.skipTo(0.95)"));
await step('노래 짓기', async () => { await ev(() => { const g = SEREN.game; g.player.teleport(0, g.structures.deckY + 1, 20); g.startCompose(); for (const n of [0, 2, 4, 3, 1, 0]) { g.ui.composeNote(n); } document.querySelector('.compose [data-ok]').click(); g.director.skip(); }); await run(0.5); });
await step('하우(노래 후)', async () => { await ev(() => { const g = SEREN.game; const n = g.npcs.get('hau'); g.player.teleport(n.pos.x + 3, undefined, n.pos.z + 3); g.talkTo(n); }); await talkThrough(); });
await step('우리 집 받음?', () => ev(() => { const g = SEREN.game; const r = g.city.recs[g.state.home]; return r ? { home: g.state.home, name: g.interiors.info(r).name, d: Math.round(Math.hypot(r.x, r.z)) } : null; }));
// 건물 드나들기는 로딩 화면(실제 시간)을 거친다: 실내 공간에 들어갈 때까지 기다리고, 안내 카드는 닫고, 나와서 실내가 닫힐 때까지
await step('우리 집 들어가기', async () => {
  await ev(() => { const g = SEREN.game; g.interiors.enter(g.city.recs[g.state.home]); });
  await page.waitForFunction(() => SEREN.game.interiors.inPocket && SEREN.game.mode !== 'cinematic', null, { timeout: 120000, polling: 200 });
  const inside = await ev(() => { const g = SEREN.game; g.ui.closeCard(); return { flag: !!g.state.flags.homeVisit, y: Math.round(g.player.pos.y) }; });
  await ev(() => SEREN.game.interiors.exit());
  await page.waitForFunction(() => !SEREN.game.interiors.cur && SEREN.game.mode === 'play', null, { timeout: 120000, polling: 200 });
  return inside;
});
await step('남은 탑', async () => { for (const id of ['frost-pylon', 'sea-pylon']) { await ev((id) => { const g = SEREN.game; g.awakenPylon(id); g.director.skip(); }, id); await run(0.3); } });
await step('하우(마지막)', async () => { await ev(() => { const g = SEREN.game; const n = g.npcs.get('hau'); g.player.teleport(n.pos.x + 3, undefined, n.pos.z + 3); g.talkTo(n); }); await talkThrough(); });
// ── 2부: 바다 건너 ──
await step('하늘배·꼭대기', async () => { await ev(() => { const g = SEREN.game; g.setFlag('rodeSky'); }); await run(0.3); await ev(() => { const g = SEREN.game; g.setFlag('liftTop'); }); await run(0.3); });
await step('하우(하늘닻 이야기)', async () => { await run(0.3); await ev(() => { const g = SEREN.game; const n = g.npcs.get('hau'); g.player.teleport(n.pos.x + 3, undefined, n.pos.z + 3); g.talkTo(n); }); await talkThrough(); });
await step('승강차로 하늘닻', async () => {
  await ev(() => { const g = SEREN.game; const d = g.anchor.deckStop; g.player.teleport(d.x, d.y + 1, d.z); g.rideElevator(true); });
  await ev(() => { const g = SEREN.game; for (let i = 0; i < 900 && g.player.state === 'ride'; i++) g.updateSim(0.05); });
  await run(0.5);
});
await step('솔과 대화', async () => { await ev(() => { const g = SEREN.game; const n = g.npcs.get('sol'); g.player.teleport(n.pos.x + 3, n.pos.y + 1, n.pos.z + 3); g.talkTo(n); }); await talkThrough(); });
await step('큰 해류 열림?', () => ev(() => SEREN.game.currents.list.filter((c) => c.def.great && c.enabled).length));
await step('큰 공명탑 넷', async () => { for (const id of ['rift-pylon', 'plains-pylon', 'ice-pylon', 'falls-pylon']) { await ev((id) => { const g = SEREN.game; const P = g.structures.pylons.get(id); g.player.teleport(P.x + 30, P.y + 5, P.z + 30); g.awakenPylon(id); g.director.skip(); }, id); await run(0.3); } });
await step('솔(마지막)', async () => { await ev(() => { const g = SEREN.game; const n = g.npcs.get('sol'); g.player.teleport(n.pos.x + 3, n.pos.y + 1, n.pos.z + 3); g.talkTo(n); }); await talkThrough(); await run(0.5); });
await step('온 세계의 노래?', () => ev(() => ({ chorus: !!SEREN.game.state.flags.worldChorus, done: SEREN.game.quests.isDone('mq8'), lanes: SEREN.game.traffic.lanes.filter((l) => l.unlock && l.enabled).length })));
await step('저장', () => ev(() => { SEREN.game.save(true); return localStorage.getItem('seren.save.v1').length; }));
console.log('save bytes', await ev(() => localStorage.getItem('seren.save.v1').length));
console.log('understood iel_1?', await ev(() => SEREN.game.lang.isUnderstood(SEREN.game.lines.iel_1)));
for (const l of logs.slice(0, 30)) console.log(l);
await page.screenshot({ path: join(root, 'shots', 'flow-end.png'), timeout: 180000 }); // 도시가 무거워 헤드리스에서 느림
await browser.close();
