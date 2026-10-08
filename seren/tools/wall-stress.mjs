// 벽 관통·공허 추락 검사 (v24 P0 「실내 벽 관통 및 공허 추락」 — 걷기·달리기·점프·대각선 이동):
//  쓰임마다 건물 하나에 들어가 층마다 처음 서는 셀의 방들 가운데에서, 12 방향으로 빠르게 달리며 두 번 뛰어 벽·모서리에 부딪힌다.
//  · 끝난 자리가 지금 셀의 걸을 수 있는 칸(또는 문턱)이 아니면, 층 바닥 아래로 내려갔으면, 안전장치가 되돌렸으면(state.debug.escapes) 실패.
//   node tools/wall-stress.mjs [쓰임들|all] [층 수=2]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ALL = ['home', 'office', 'market', 'cafe', 'school', 'heal', 'hotel', 'library', 'museum', 'hall', 'factory', 'depot', 'lab', 'terminal', 'admin', 'garden', 'farm', 'plant'];
const want = process.argv[2] && process.argv[2] !== 'all' ? process.argv[2].split(',') : ALL;
const NF = +(process.argv[3] || 2) || 2;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await (await browser.newContext({ viewport: { width: 480, height: 270 } })).newPage();
const logs = [];
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto('file://' + (process.env.SEREN_HTML || join(root, 'index.html')) + '?play=new&nowake=1&q=low&t=0.45');
await page.waitForFunction(() => window.SEREN && SEREN.game && SEREN.game.city && SEREN.game.city.recs && SEREN.game.city.recs.length > 0 && SEREN.game.mode === 'play', null, { timeout: 300000, polling: 1000 });
await page.evaluate(() => {
  const g = SEREN.game;
  if (g.tips) g.tips.first = () => false;
  g.ui.moa = () => {};
  g.ui.blink = (mid, done) => { mid(); if (done) done(); };
  const DT = 1 / 60;
  let steer = null;
  const inp = g.input, poll = inp.poll.bind(inp);
  inp.poll = (dt) => { poll(dt); if (steer) { inp.move.x = 0; inp.move.y = 1; g.rig.yaw = steer.yaw; } };
  window.__frame = () => { g.updateSim(DT); g.interiors.update(DT); };
  window.__run = (tx, tz, frames, jumps) => {
    const p = g.player.pos;
    for (let f = 0; f < frames; f++) {
      steer = { yaw: Math.atan2(-(tx - p.x), -(tz - p.z)) };
      if (jumps.includes(f)) g.player.jumpBuffer = 0.14;
      window.__frame();
    }
    steer = null;
    for (let k = 0; k < 40; k++) window.__frame(); // 내려앉기
  };
  window.__esc = () => ((g.state.debug && g.state.debug.escapes) || []).length;
});
let fails = 0, runs = 0;
const ex = [];
for (const pid of want) {
  const ok = await page.evaluate((pid) => {
    const g = SEREN.game, I = g.interiors, C = g.city, P = { x: -2200, z: 5250 };
    const r = C.recs.filter((q) => q.door && I.info(q).pid === pid).sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z))[0];
    if (!r) return false;
    C.fixDoor(r); g.player.teleport(r.door.x + r.door.nx * 3, undefined, r.door.z + r.door.nz * 3); I.enter(r);
    return true;
  }, pid);
  if (!ok) continue;
  try { await page.waitForFunction(() => SEREN.game.interiors.inPocket && !SEREN.game.interiors._busy, null, { timeout: 120000, polling: 300 }); } catch { fails++; ex.push(`${pid}: 들어가기 시간 초과`); continue; }
  const r = await page.evaluate((NF) => {
    const g = SEREN.game, I = g.interiors, ind = I.cur.indoor, B = I.cur.B, G = B.G;
    try { g.ui.closeCard(); } catch {} g.mode = 'play';
    g.player.mods.speed = 1.5; // 달리기 (빠르게 부딪힌다)
    const res = { name: I.title(I.cur.r), runs: 0, fails: [] };
    const fl = [B.ground, ...B.floors.filter((F) => F.reach && !F.dead && !F.mezz && F.i !== B.ground).map((F) => F.i)].slice(0, NF);
    for (const i of fl) {
      ind.setFloor(i);
      const key = ind.homeKey(i);
      if (!key) continue;
      ind.setCell(key);
      const L = ind.plan(i).L, fy = ind.yOf(i);
      // 이 셀의 방마다 가운데 칸 (걸을 수 있는 칸)
      const starts = [];
      for (const R of L.rooms) {
        if (!R.n || ind.keyOf(i, R.id) !== key) continue;
        const cells = [];
        for (let c = 0; c < L.room.length; c++) if (L.room[c] === R.id + 1) cells.push(c);
        cells.sort((a, b) => Math.hypot(a % G.gw - R.cx, ((a / G.gw) | 0) - R.cz) - Math.hypot(b % G.gw - R.cx, ((b / G.gw) | 0) - R.cz));
        for (const c of cells.slice(0, 6)) { const [x, z] = ind.world(G.ox + (c % G.gw) + 0.5, G.oz + ((c / G.gw) | 0) + 0.5); if (ind.inside(i, x, z)) { starts.push([x, z, R.name]); break; } }
        if (starts.length >= 4) break;
      }
      for (const [sx, sz, nm] of starts) {
        for (let d = 0; d < 12; d++) {
          const a = (d / 12) * Math.PI * 2, tx = sx + Math.cos(a) * 9, tz = sz + Math.sin(a) * 9;
          ind.cur = i; ind.setCell(key);
          g.player.teleport(sx, fy + 0.3, sz, 0.1); g.player.vel.set(0, 0, 0);
          for (let k = 0; k < 6; k++) window.__frame();
          const e0 = window.__esc();
          window.__run(tx, tz, 75, [12, 44]);
          res.runs++;
          const p = g.player.pos, cur = ind.cur;
          const inOk = ind.inside(cur, p.x, p.z) || ind.stairCell || I._nearPortal(ind, p);
          const below = p.y < ind.yOf(cur) - 0.3;
          const esc = window.__esc() - e0;
          if (!inOk || below || esc) {
            const [gx, gz] = ind.grid(p.x, p.z);
            res.fails.push(`${B.floors[i].label}층 ${nm} → ${Math.round((a * 180) / Math.PI)}°: ${!inOk ? '걸을 수 있는 칸 밖' : ''}${below ? ` 바닥 아래 ${(ind.yOf(cur) - p.y).toFixed(1)} m` : ''}${esc ? ` 안전장치 ${esc}번` : ''} (칸 ${gx.toFixed(1)},${gz.toFixed(1)} · 층 ${B.floors[cur].label} · 셀 ${ind.cellKey})`);
          }
        }
      }
    }
    g.player.mods.speed = 1;
    return res;
  }, NF);
  runs += r.runs; fails += r.fails.length;
  for (const f of r.fails.slice(0, 3)) if (ex.length < 40) ex.push(`${pid} ${r.name}: ${f}`);
  console.log(JSON.stringify({ pid, name: r.name, runs: r.runs, fails: r.fails.length, ex: r.fails.slice(0, 2) }));
  await page.evaluate(() => SEREN.game.interiors.exit());
  try { await page.waitForFunction(() => !SEREN.game.interiors.inPocket && !SEREN.game.interiors._busy, null, { timeout: 60000, polling: 300 }); } catch {}
}
console.log(logs.length ? `기록:\n${[...new Set(logs)].slice(0, 6).join('\n')}` : '페이지 오류 없음');
console.log(`달려 부딪히기 ${runs} · 실패 ${fails}`);
if (ex.length) console.log(ex.join('\n'));
await browser.close();
process.exit(fails ? 1 : 0);
