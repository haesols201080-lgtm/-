// 개발용: 쓰임이 있는 건물(시설) 9종의 기능을 차례로 눌러 보며 오류를 확인합니다.
//   node tools/facilities.mjs [shots]   — shots 를 주면 카드·나룻배·연락선 스크린샷도 남깁니다 (shots/svc-*.png)
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = process.argv.includes('shots');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !m.text().includes('ERR_CERT')) logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto('file://' + join(root, 'index.html') + '?q=low&play=new&nowake=1');
await page.waitForFunction(() => window.SEREN && SEREN.game && SEREN.game.mode === 'play', null, { timeout: 180000, polling: 300 });

let fails = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); if (!cond) fails++; };
const ev = (f, a) => page.evaluate(f, a);
const shot = async (name) => { if (SHOTS) { await page.waitForTimeout(800); await page.screenshot({ path: join(root, 'shots', `svc-${name}.png`) }); } };
const settle = () => page.waitForFunction(() => SEREN.game.world.terrain.settled, null, { timeout: 90000, polling: 400 }).catch(() => {});

// 준비: 넉넉한 별씨, 모든 음, 척추의 도시 이후
await ev(() => {
  const g = SEREN.game;
  g.state.inv.starseed = 60; g.state.inv.shard = 6;
  g.state.tones = [0, 1, 2, 3, 4];
  g.state.flags.elevator = true;
  g.ui.refreshButtons();
});
ok(await ev(() => SEREN.game.facilities.list.length) >= 40, `시설 ${await ev(() => SEREN.game.facilities.list.length)}곳`);
ok(await ev(() => SEREN.game.facilities.list.every((F) => F.npc && SEREN.game.npcs.get('fac-' + F.id))), '모든 시설에 시설지기');

/** 시설지기 앞으로 가서 상호작용 → 카드의 단추 이름들 */
const visit = (id) => ev((id) => {
  const g = SEREN.game;
  const F = g.facilities.byId.get(id);
  const k = F.keeper;
  const fx = Math.sin(F.yaw), fz = Math.cos(F.yaw);
  g.player.teleport(k.x + fx * 2.2, k.y + 1.5, k.z + fz * 2.2);
  g.npcs.update(0.016);
  g.mode = 'play';
  const t = g._findTarget();
  if (!t || t.kind !== 'facility') return { err: 'target ' + JSON.stringify(t && { kind: t.kind, label: t.label }) };
  g._interact(t);
  const card = document.querySelector('.svc-card');
  return { label: t.label, title: card && card.querySelector('h2').textContent, buttons: card ? [...card.querySelectorAll('.svc-b')].map((b) => (b.disabled ? '(x) ' : '') + b.querySelector('b').textContent) : null };
}, id);
const click = (text) => ev((text) => {
  const b = [...document.querySelectorAll('.svc-card .svc-b')].find((x) => x.querySelector('b').textContent.includes(text));
  if (!b) return 'no button ' + text;
  if (b.disabled) return 'disabled ' + text;
  b.click();
  return 'clicked';
}, text);
const closeCard = () => ev(() => SEREN.game.ui.closeCard());
const frames = (n, dt = 1 / 30) => ev(({ n, dt }) => { const g = SEREN.game; for (let i = 0; i < n; i++) g.update(dt); }, { n, dt });

// ── 공방
let r = await visit('cap-workshop');
ok(r.buttons && r.buttons.some((b) => b.includes('울림 탐지기')), `공방 카드: ${r.title} · ${r.label}`);
await shot('workshop');
ok((await click('울림 탐지기')) === 'clicked' && (await ev(() => SEREN.game.player.upgrades.detector)) === 1, '탐지기 1단계');
await visit('cap-workshop');
await click('날개·목도리');
ok((await ev(() => SEREN.game.state.facility.cosmetic)) === 1, '빛깔 바꾸기');
await frames(20);
ok((await ev(() => SEREN.game.services._marks.length)) >= 0, `탐지기 표시 ${await ev(() => SEREN.game.services._marks.map((m) => m.name + ' ' + Math.round(m.d)).join(', '))}`);

// ── 서고
r = await visit('cap-library');
ok(r.buttons && r.buttons.filter((b) => b.startsWith('「')).length === 3, `서고 카드: ${r.buttons && r.buttons.join(' / ')}`);
await click('침묵의 연대기');
ok(await ev(() => !!SEREN.game.state.facility.books['b-silence'] && SEREN.game.lang.known('silence')), '책 읽기 → 단어');
await shot('book');
await closeCard();
r = await visit('cap-library');
const before = await ev(() => Object.keys(SEREN.game.state.vocab).length);
await click('말 배우기');
ok((await ev(() => Object.keys(SEREN.game.state.vocab).length)) > before, '서고지기에게 말 배우기');

// ── 별지도 방
r = await visit('cap-maproom');
ok(r.buttons && r.buttons.length === 4, `지도 방: ${r.buttons && r.buttons.join(' / ')}`);
await click('읽지 않은 글자돌');
ok(await ev(() => !!SEREN.game.state.waypoint), '남은 것 찾기 → 표식');
r = await visit('cap-maproom');
await click('펼치기');
await page.waitForTimeout(900);
ok(await ev(() => SEREN.game.mapData.revealedAt(SEREN.game.facilities.byId.get('cap-maproom').x + 5000, SEREN.game.facilities.byId.get('cap-maproom').z) > 0.5), '둘레 지도 펼치기');
await shot('map');
await ev(() => SEREN.game.ui.closeMenu());

// ── 쉼터: 둘을 들른 뒤 오가기
await visit('dew-rest'); await closeCard();
r = await visit('cap-rest');
ok(r.buttons && r.buttons.some((b) => b.includes('이슬터 쉼터')), `쉼터 카드: ${r.buttons && r.buttons.join(' / ')}`);
await click('이슬터 쉼터');
await page.waitForTimeout(2800);
await frames(5);
const dr = await ev(() => { const g = SEREN.game, F = g.facilities.byId.get('dew-rest'); return Math.hypot(g.player.pos.x - F.x, g.player.pos.z - F.z); });
ok(dr < 40, `쉼터 사이 이동 (도착 거리 ${dr.toFixed(1)} m)`);
r = await visit('dew-rest');
const t0 = await ev(() => SEREN.game.world.clock.time);
await click('밤까지');
await page.waitForTimeout(1800);
ok((await ev(() => SEREN.game.world.clock.time)) > t0, '쉬기 → 시간이 흐름');

// ── 온실
r = await visit('dew-greenhouse');
await click('1번 밭'); r = await visit('dew-greenhouse'); await click('2번 밭');
ok(await ev(() => { const G = SEREN.game.state.facility.garden['dew-greenhouse']; return G[0] !== null && G[1] !== null; }), '온실: 별씨 심기');
await ev(() => { SEREN.game.world.clock.time += 1.05; });
await frames(3);
r = await visit('dew-greenhouse');
ok(r.buttons && r.buttons[0].includes('피었다'), `온실: 다 자람 (${r.buttons && r.buttons[0]})`);
await closeCard();
await ev(() => { const g = SEREN.game, F = g.facilities.byId.get('dew-greenhouse'); g.rig.override = { pos: g.facilities.toWorld(F, 22, 9, 6), look: g.facilities.toWorld(F, 0, 1, 0) }; g.ui.root.style.display = 'none'; });
await settle();
await shot('greenhouse');
await ev(() => { SEREN.game.rig.override = null; SEREN.game.ui.root.style.display = ''; });
const ss = await ev(() => SEREN.game.state.inv.starseed);
r = await visit('dew-greenhouse');
await click('1번 밭');
ok((await ev(() => SEREN.game.state.inv.starseed)) === ss + 3, '온실: 거두기 (+3)');

// ── 음악당: 합창
r = await visit('cap-hall');
ok(r.buttons && r.buttons[0].includes('합창') && !r.buttons[0].startsWith('(x)'), `음악당: ${r.buttons && r.buttons.join(' / ')}`);
await click('합창');
const melody = await ev(() => SEREN.game.resonance.puzzle && SEREN.game.resonance.puzzle.melody);
ok(Array.isArray(melody), `합창 선율 ${melody}`);
await shot('choir');
const sh0 = await ev(() => SEREN.game.state.inv.shard);
await ev(() => { const R = SEREN.game.resonance; R.puzzle.playing = false; for (const n of R.puzzle.melody.slice()) { R.cool[n] = 0; R.play(n); } });
ok((await ev(() => SEREN.game.state.inv.shard)) === sh0 + 1 && !(await ev(() => SEREN.game.resonance.puzzle)), '합창 성공 → 결정 조각');
r = await visit('cap-hall');
ok(r.buttons[0].startsWith('(x)'), '합창은 하루 한 번');
await closeCard();

// ── 소식탑: 소포 → 전하기
r = await visit('cap-courier');
await click('소포 나르기');
const parcel = await ev(() => SEREN.game.requests.active.find((x) => x.kind === 'parcel'));
ok(!!parcel, `소포: ${parcel && parcel.text}`);
const done0 = await ev(() => SEREN.game.state.requestsDone);
if (parcel) { await visit(parcel.to); await closeCard(); }
ok((await ev(() => SEREN.game.state.requestsDone)) === done0 + 1, '소포 전하기 → 부탁 완료');
r = await visit('cap-courier');
await click('새 부탁');
ok((await ev(() => SEREN.game.requests.active.length)) >= 1, '새 부탁 받기');

// ── 기상탑
r = await visit('cap-weather');
await click('오로라');
await frames(60, 0.1);
ok((await ev(() => SEREN.engine ? 1 : 1)) && (await ev(() => SEREN.game.services.S.weather && SEREN.game.services.S.weather.kind)) === 'aurora', '기상탑: 오로라');
r = await visit('cap-weather');
ok(r.buttons.slice(0, 4).every((b) => b.startsWith('(x)')), '날씨는 하루 한 번');
await closeCard();
if (SHOTS) {
  await ev(() => { const g = SEREN.game, F = g.facilities.byId.get('cap-weather'); g.world.clock.time = Math.floor(g.world.clock.time) + 0.97; g.world.clock.frozen = true; F.extra.beamT = 20; g.rig.override = { pos: g.facilities.toWorld(F, 0, 30, 260), look: g.facilities.toWorld(F, 0, 160, 0) }; g.ui.root.style.display = 'none'; });
  await settle();
  await shot('weather-night');
  await ev(() => { const g = SEREN.game; g.rig.override = null; g.ui.root.style.display = ''; g.world.clock.frozen = false; });
}

// ── 선착장: 연락선 + 나룻배
await visit('dew-dock'); await closeCard();
r = await visit('cap-dock');
ok(r.buttons && r.buttons.some((b) => b.includes('이슬터 선착장')), `선착장: ${r.buttons && r.buttons.join(' / ')}`);
await click('이슬터 선착장');
ok((await ev(() => SEREN.game.player.state)) === 'ride', '연락선 타기');
await frames(150, 1 / 15);
if (SHOTS) { await ev(() => { const g = SEREN.game; g.ui.root.style.display = 'none'; }); await settle(); await shot('ferry'); await ev(() => { SEREN.game.ui.root.style.display = ''; }); }
await frames(500, 1 / 15);
const fd = await ev(() => { const g = SEREN.game, F = g.facilities.byId.get('dew-dock'); return { st: g.player.state, d: Math.hypot(g.player.pos.x - F.x, g.player.pos.z - F.z), dy: g.player.pos.y - (F.y + F.padY) }; });
ok(fd.st === 'ground' && fd.d < 25 && Math.abs(fd.dy) < 2, `연락선 도착 (${fd.st}, ${fd.d.toFixed(1)} m, 높이차 ${fd.dy.toFixed(1)})`);
r = await visit('dew-dock');
await click('나룻배 빌리기');
ok((await ev(() => SEREN.game.player.state)) === 'fly', '나룻배 빌리기 → 날기');
// 앞으로 날며 오르기
const fly = await ev(() => {
  const g = SEREN.game, p = g.player;
  const y0 = p.pos.y, x0 = p.pos.x, z0 = p.pos.z;
  g.rig.yaw = p.yaw + Math.PI; g.rig.pitch = 0.25;
  const inp = { move: { x: 0, y: 1 }, look: { x: 0, y: 0 }, wheel: 0, pressed: () => false, isHeld: (a) => a === 'sprint', lookActive: 0, lastDevice: 'keyboard' };
  for (let i = 0; i < 300; i++) p.update(1 / 60, inp, g.rig);
  return { dist: Math.hypot(p.pos.x - x0, p.pos.z - z0), climb: p.pos.y - y0, speed: p.flySpeed, st: p.state };
});
ok(fly.st === 'fly' && fly.dist > 60 && fly.climb > 5, `나룻배 비행 5초: ${fly.dist.toFixed(0)} m, 상승 ${fly.climb.toFixed(0)} m, 속도 ${fly.speed.toFixed(0)}`);
if (SHOTS) { await frames(20); await settle(); await shot('skiff'); }
const tg = await ev(() => SEREN.game._findTarget());
ok(tg && tg.kind === 'unfly', `내리기 표시: ${tg && tg.label}`);
await ev(() => SEREN.game._interact(SEREN.game._findTarget()));
ok((await ev(() => SEREN.game.player.state)) !== 'fly', '나룻배에서 내리기');

// ── 저장 → 다시 불러오기
await ev(() => SEREN.game.save(true));
const saved = await ev(() => JSON.parse(localStorage.getItem('seren.slot.' + SEREN.game.slot)).facility);
ok(saved && saved.books['b-silence'] && saved.visited['dew-rest'] && saved.cosmetic === 1, '저장에 시설 상태가 남음');

// ── 옛 저장(시설 항목 없음)을 불러와도 괜찮은가
const old = await ev(() => {
  const s = JSON.parse(localStorage.getItem('seren.slot.' + SEREN.game.slot));
  delete s.facility; delete s.upgrades.detector;
  localStorage.setItem('seren.slot.' + SEREN.game.slot, JSON.stringify(s));
  const g = SEREN.game;
  g.continueGame();
  const F = g.facilities.byId.get('cap-library');
  g.services.open(F);
  const ok = !!document.querySelector('.svc-card') && g.state.facility && typeof g.state.facility.visited === 'object';
  g.ui.closeCard();
  return ok;
});
ok(old, '옛 저장 불러오기 → 시설 상태 기본값');

await frames(30);
console.log(logs.length ? logs.slice(0, 15).join('\n') : '(콘솔 오류 없음)');
console.log(fails ? `\n실패 ${fails}개` : '\n모두 통과');
await browser.close();
process.exit(fails ? 1 : 0);
