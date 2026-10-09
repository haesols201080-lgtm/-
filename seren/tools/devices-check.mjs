// 기기별 화면과 울림 OS 검사 (v24 「범용 만능 UI 폐기」 · 「컴퓨터는 하나의 실제 OS로 구현」):
//  1) 안내 빛판 = 층 안내·찾기만 (탭 없음) · 공용 단말 = 건물·일자리 공고·내 지원 (살림·업무 없음) · 배차/분석 = 제어판
//  2) 남의 자리 컴퓨터 = 그 주민 계정의 잠금 화면 (들어갈 계정 없음)
//  3) 채용되면 내 자리 컴퓨터 = 내 계정 → 바탕 앱(메일·파일·일정·찾기·내 일·업무·장부·설정) → 창 열기·바꾸기·내리기·닫기 → 메일 읽기 → 로그아웃
//  4) 공용 컴퓨터(서고) = 손님 로그인, 메일·파일 없음
//  5) 메일·OS 설정은 저장 슬롯에 남는다 (저장 → 다시 불러오기)
//   node tools/devices-check.mjs
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await (await browser.newContext({ viewport: { width: 900, height: 600 } })).newPage();
const logs = [];
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
let fails = 0;
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++; };
const ev = (f, a) => page.evaluate(f, a);
await page.goto('file://' + (process.env.SEREN_HTML || join(root, 'index.html')) + '?play=new&nowake=1&q=low&t=0.45', { timeout: 400000 });
await page.waitForFunction(() => window.SEREN && SEREN.game && SEREN.game.mode === 'play' && SEREN.game.city && SEREN.game.city.recs.length, null, { timeout: 400000, polling: 1000 });
await ev(() => { const g = SEREN.game; if (g.tips) g.tips.first = () => false; g.ui.moa = () => {}; });

const enter = async (pid) => {
  if (await ev(() => SEREN.game.interiors.inPocket)) {
    await ev(() => SEREN.game.interiors.exit());
    await page.waitForFunction(() => !SEREN.game.interiors.inPocket && !SEREN.game.interiors._busy, null, { timeout: 120000, polling: 300 });
  }
  const ok2 = await ev((pid) => {
    const g = SEREN.game, I = g.interiors, C = g.city, P = { x: -2200, z: 5250 };
    const r = C.recs.filter((q) => q.door && I.info(q).pid === pid).sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z))[0];
    if (!r) return false;
    C.fixDoor(r); g.player.teleport(r.door.x + r.door.nx * 3, undefined, r.door.z + r.door.nz * 3); I.enter(r);
    return true;
  }, pid);
  if (!ok2) return false;
  await page.waitForFunction(() => SEREN.game.interiors.inPocket && !SEREN.game.interiors._busy && SEREN.game.ops && SEREN.game.ops.cur, null, { timeout: 180000, polling: 300 });
  return true;
};
// 이 건물에서 tag 를 가진 가구 하나와 그 층의 세입자 (모든 층의 짜임에서 찾는다 — 지금 셀이 아니어도)
await page.evaluate(() => {
  window.__find = (tags) => {
    const g = SEREN.game, I = g.interiors, ind = I.cur.indoor, B = I.cur.B, o = g.ops;
    for (const F of B.floors) {
      if (!F.reach || F.dead) continue;
      const pl = ind.plan(F.i);
      const q = (pl.fix || []).find((x) => tags.includes(x.tag));
      if (q) { if (ind.cur !== F.i) { ind.setFloor(F.i); o.floorChanged && o.floorChanged(F.i); } return { F: q, T: o.byFloor(F.i), floor: F.i }; }
    }
    return null;
  };
  window.__card = () => { const c = [...document.querySelectorAll('.term-screen.os-card')].pop(); return c ? { cls: c.className, tabs: [...c.querySelectorAll('.os-tab')].map((b) => b.textContent.trim()), head: (c.querySelector('.os-head b, .os2-top b') || {}).textContent, text: c.textContent.slice(0, 400) } : null; };
});

// 1) 사무탑: 안내 빛판 · 공용 단말
ok(await enter('office'), '사무탑에 들어감');
const r1 = await ev(() => {
  const g = SEREN.game, A = g.ops.apps, out = {};
  const d = window.__find(['directory']) || { T: g.ops.byFloor(g.interiors.cur.indoor.cur), F: { tag: 'directory' } };
  A.open('directory', { T: d.T, F: d.F }); out.board = window.__card(); A.close();
  const t = window.__find(['terminal']);
  if (t) { A.open('home', { T: t.T, F: t.F }); out.kiosk = window.__card(); A.show('jobs'); out.kioskJobs = window.__card().text.includes('일자리'); A.close(); }
  return out;
});
ok(r1.board && /dev-board/.test(r1.board.cls) && r1.board.tabs.length === 0 && /안내/.test(r1.board.head), `안내 빛판: ${r1.board && r1.board.head} · 탭 ${r1.board && r1.board.tabs.length}`);
ok(r1.kiosk && /dev-kiosk/.test(r1.kiosk.cls) && r1.kiosk.tabs.join(',') === '건물,일자리 공고,내 지원' && r1.kioskJobs, `공용 단말: 탭 ${r1.kiosk && r1.kiosk.tabs.join(' · ')} (살림·업무 없음)`);

// 2) 남의 자리
const r2 = await ev(() => {
  const g = SEREN.game, A = g.ops.apps, d = window.__find(['desk']);
  if (!d) return null;
  A.open('work', { T: d.T, F: d.F });
  const c = document.querySelector('.term-screen.dev-computer');
  const out = { comp: !!c, lock: !!(c && c.querySelector('.os2-lock')), owner: c && (c.querySelector('.os2-lock b') || {}).textContent, login: !!(c && c.querySelector('[data-acct]')), icons: c ? c.querySelectorAll('.os2-ic').length : -1 };
  A.close();
  window.__desk = d;
  return out;
});
ok(r2 && r2.comp && r2.lock && r2.owner && !r2.login && r2.icons === 0, `남의 자리 컴퓨터: 「${r2 && r2.owner}」 님 잠금 · 들어갈 계정 없음`);

// 3) 채용 → 내 자리
const r3 = await ev(async () => {
  const g = SEREN.game, A = g.ops.apps, S = g.ops.S, d = window.__desk, cur = g.interiors.cur;
  S.jobs.push({ uid: cur.uid, k: d.T.k, role: 'clerk', op: d.T.op || 'office', title: '시험 사무원', org: d.T.org ? d.T.org.name : '시험 조직', bname: g.interiors.title(cur.r), wage: 3, hours: [0.3, 0.7], x: cur.r.x, z: cur.r.z, since: 0, worked: 0, rating: 3 });
  const { osMail } = SEREN.osTools;
  osMail(g, { from: '시험 조직 사람 담당', subj: '함께 일해요 · 시험 사무원', body: '첫 줄\n둘째 줄', key: 'test-hire' });
  osMail(g, { from: '시험 조직 사람 담당', subj: '함께 일해요 · 시험 사무원', body: '같은 열쇠', key: 'test-hire' });
  A.open('work', { T: d.T, F: d.F });
  const c = () => document.querySelector('.term-screen.dev-computer');
  const out = {};
  out.icons = [...c().querySelectorAll('.os2-ic span')].map((e) => e.textContent.replace(/\s*\d+$/, '').trim());
  out.unread = A.os.unread();
  A.os.openApp('mail');
  out.mailList = [...c().querySelectorAll('.os2-win .svc-b b')].map((e) => e.textContent).join(' | ');
  c().querySelector('.os2-win .svc-b').click();
  out.mailOpen = (c().querySelector('.os2-doc') || {}).textContent;
  out.read = A.os.unread();
  A.os.openApp('files');
  out.folders = [...c().querySelectorAll('.os2-win .svc-b b')].map((e) => e.textContent).join(' | ');
  A.os.openApp('cal');
  out.cal = [...c().querySelectorAll('.os2-win .svc-b b')].map((e) => e.textContent).join(' | ');
  out.wins = [...c().querySelectorAll('.os2-tb')].map((e) => e.textContent);
  c().querySelector('.os2-tb').click(); out.switched = c().querySelector('.os2-wt b').textContent;
  c().querySelector('[data-min]').click(); out.minDesk = !c().querySelector('.os2-desk').classList.contains('hidden') && c().querySelector('.os2-win').classList.contains('hidden');
  A.os.active = 0; A.os._draw(); c().querySelector('[data-close]').click(); out.afterClose = A.os.wins.length;
  A.os.openApp('settings'); [...c().querySelectorAll('.os2-win .svc-b')].find((b) => b.textContent.includes('숲')).click(); out.wall = A.os.prefs().wall;
  c().querySelector('[data-out]').click(); out.lockedAgain = !!c().querySelector('.os2-lock') && !A.os.user;
  A.close();
  return out;
});
ok(['메일', '파일', '일정', '찾기', '내 일', '업무', '장부', '설정'].every((n) => r3.icons.includes(n)), `내 자리 바탕 앱: ${r3.icons.join(' · ')}`);
ok(r3.unread === 1 && /함께 일해요/.test(r3.mailList) && /첫 줄/.test(r3.mailOpen || '') && r3.read === 0, `메일: 같은 열쇠는 한 번만(${r3.unread}) · 열면 읽음`);
ok(/지원서/.test(r3.folders) && /근무 기록/.test(r3.folders) && /영수증/.test(r3.folders), `파일 폴더: ${r3.folders}`);
ok(/교대/.test(r3.cal), `일정: ${r3.cal}`);
ok(r3.wins.length === 3 && r3.switched === r3.wins[0] && r3.minDesk && r3.afterClose === 2, `창 ${r3.wins.join(' · ')} → 바꾸기 「${r3.switched}」 · 내리기 → 바탕 · 닫기 → ${r3.afterClose}`);
ok(r3.wall === 2 && r3.lockedAgain, `설정(바탕 숲) 저장 · 로그아웃 → 잠금`);

// 4) 공용 컴퓨터 (서고)
ok(await enter('library'), '서고에 들어감');
const r4 = await ev(() => {
  const g = SEREN.game, A = g.ops.apps, t = window.__find(['terminal']);
  if (!t) return null;
  A.open('home', { T: t.T, F: t.F });
  const c = document.querySelector('.term-screen.dev-computer');
  if (!c) return { comp: false, card: window.__card() };
  c.querySelector('[data-acct="guest"]').click();
  const icons = [...c.querySelectorAll('.os2-ic span')].map((e) => e.textContent.trim());
  A.close();
  return { comp: true, icons, who: A.os.user };
});
ok(r4 && r4.comp && r4.who === 'guest' && !r4.icons.includes('메일') && !r4.icons.includes('파일') && r4.icons.includes('찾기'), `공용 컴퓨터: 손님 · ${r4 && (r4.icons || []).join(' · ')}`);

// 5) 배차 제어판 (물류)
if (await enter('depot')) {
  const r5 = await ev(() => { const g = SEREN.game, A = g.ops.apps, t = window.__find(['terminal']); if (!t) return null; A.open('dispatch', { T: t.T, F: t.F }); const c = window.__card(); A.close(); return c; });
  ok(r5 && /dev-console/.test(r5.cls) && /배차/.test(r5.head), `배차 제어판: ${r5 && r5.head}`);
}

// 6) 슬롯에 남는가
const r6 = await ev(async () => {
  const g = SEREN.game, id = g.slot;
  if (g.interiors.inPocket) { g.interiors.exit(); for (let k = 0; k < 200 && (g.interiors.inPocket || g.interiors._busy); k++) await new Promise((r) => setTimeout(r, 300)); }
  g.save(true);
  g.continueGame(id);
  return { mail: g.state.os.mail.length, wall: (g.state.os.prefs.me || {}).wall };
});
ok(r6.mail === 1 && r6.wall === 2, `저장 → 불러오기: 메일 ${r6.mail} · 바탕 ${r6.wall}`);

console.log(logs.length ? `기록:\n${[...new Set(logs)].slice(0, 8).join('\n')}` : '페이지 오류 없음');
console.log(fails ? `실패 ${fails}` : '모두 통과');
await browser.close();
process.exit(fails ? 1 : 0);
