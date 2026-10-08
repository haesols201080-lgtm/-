// 통로 양끝 검사 (v24 P0 「메인 도시 진입 승강기·연결 통로」): 빛길 역마다 양 끝·양쪽 승강장으로
// 바깥 땅에서 걸어 들어가 승강장에 서고(뛰지 않고), 다시 걸어 나온다. 실패 = 못 닿음 · 높이차(턱) · 떨어짐 · 안전장치 없이 끼임.
//   node tools/passage-check.mjs [역 id들(쉼표)|all] [shots]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const want = process.argv[2] && process.argv[2] !== 'all' ? process.argv[2].split(',') : null;
const SHOTS = process.argv.includes('shots');
if (SHOTS) mkdirSync(join(root, 'shots'), { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto('file://' + (process.env.SEREN_HTML || join(root, 'index.html')) + '?play=new&nowake=1&q=low');
await page.waitForFunction(() => window.SEREN && SEREN.game && SEREN.game.transit && SEREN.game.mode === 'play', null, { timeout: 300000, polling: 1000 });
const ids = await page.evaluate((want) => SEREN.game.transit.stations.map((S) => S.id).filter((id) => !want || want.includes(id)), want);
await page.evaluate(() => {
  const g = SEREN.game;
  if (g.tips) g.tips.first = () => false;
  g.ui.moa = () => {};
  const DT = 1 / 60;
  let steer = null;
  const inp = g.input, poll = inp.poll.bind(inp);
  inp.poll = (dt) => { poll(dt); if (steer) { inp.move.x = 0; inp.move.y = steer.move; g.rig.yaw = steer.yaw; } };
  window.__walk = (x, z, secs = 24) => {
    const p = g.player.pos;
    let lowest = 1e9, highest = -1e9, air = 0;
    for (let f = 0; f < secs / DT; f++) {
      const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
      if (d < 0.5) { steer = null; for (let k = 0; k < 10; k++) g.updateSim(DT); return { ok: true, lowest, highest, air }; }
      steer = { move: 1, yaw: Math.atan2(-dx, -dz) };
      g.updateSim(DT);
      lowest = Math.min(lowest, p.y); highest = Math.max(highest, p.y);
      if (g.player.state === 'air' || g.player.state === 'fall') air++;
    }
    steer = null;
    return { ok: false, lowest, highest, air, at: [+p.x.toFixed(1), +p.z.toFixed(1), +p.y.toFixed(2)] };
  };
});
const fails = [];
let runs = 0;
for (const id of ids) {
  const r = await page.evaluate((id) => {
    const g = SEREN.game, S = g.transit.station(id), W = S.W, hl = 37, out = [];
    for (const e of [-1, 1]) for (const s of [-1, 1]) {
      const [ox, oz] = W(s * 11, e * (hl + 30)), [ix, iz] = W(s * 11, e * (hl - 6)); // 앞마당 너머 비탈 아래(30 m 밖)에서 걸어 들어온다
      g.player.state = 'ground';
      g.player.teleport(ox, undefined, oz);
      for (let k = 0; k < 20; k++) g.updateSim(1 / 60);
      const g0 = g.player.pos.y;
      const inn = window.__walk(ix, iz);
      const onPlat = Math.abs(g.player.pos.y - S.platY) < 0.35;
      const back = window.__walk(ox, oz);
      const [tx, tz] = W(s * 11, e * (hl + 1)), edge = g.world.groundAt(tx, tz, S.platY + 3) - S.platY; // 받침 끝 바로 밖 땅 (턱)
      out.push({ e, s, ground: +(g0 - S.platY).toFixed(2), edge: +edge.toFixed(2), in: inn.ok && onPlat, inAt: inn.at, air: inn.air + back.air, out: back.ok, y: +(g.player.pos.y - S.platY).toFixed(2) });
    }
    return { id, name: S.name, platY: +S.platY.toFixed(2), out };
  }, id);
  for (const q of r.out) {
    runs++;
    const tag = `${r.name} ${q.e > 0 ? '앞' : '뒤'}끝·${q.s > 0 ? '오른' : '왼'}쪽 승강장`;
    if (!q.in) fails.push(`${tag}: 걸어서 승강장에 못 닿음 (바깥 땅 ${q.ground} m${q.inAt ? ` · 멈춘 곳 ${q.inAt}` : ''})`);
    else if (!q.out) fails.push(`${tag}: 다시 걸어 나오지 못함`);
    else if (q.air > 12) fails.push(`${tag}: 떨어지거나 뛰어야 함 (공중 ${q.air} 프레임)`);
    else if (Math.abs(q.edge) > 0.3) fails.push(`${tag}: 승강장 끝과 바깥 땅의 턱 ${q.edge} m`);
  }
  console.log(JSON.stringify(r));
  if (SHOTS) {
    await page.evaluate((id) => { const g = SEREN.game, S = g.transit.station(id), V = g.engine.camera.position.constructor, [x, z] = S.W(30, -60), [lx, lz] = S.W(0, 0); g.rig.override = { pos: new V(x, S.platY + 12, z), look: new V(lx, S.platY + 4, lz) }; }, id);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: join(root, 'shots', `station-${id.replace(':', '_')}.png`), timeout: 180000 });
    await page.evaluate(() => { SEREN.game.rig.override = null; });
  }
}
console.log(errs.length ? `페이지 오류:\n${errs.join('\n')}` : '페이지 오류 없음');
console.log(`역 ${ids.length} · 드나들기 ${runs} · 실패 ${fails.length}`);
if (fails.length) console.log(fails.join('\n'));
await browser.close();
process.exit(fails.length || errs.length ? 1 : 0);
