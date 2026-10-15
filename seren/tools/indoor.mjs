// 실내 시험 (헤드리스): 쓰임·모양으로 건물을 골라 들어가 여러 자리에서 스크린샷 + 오류·수치 보고
//   node tools/indoor.mjs <이름> '<고르기 JSON>' [스크립트들 JSON 배열]
//   고르기: { pid: 'office', minH: 40, kind: 'slab', near: [x,z] }
//   스크립트: 들어간 뒤 차례로 실행할 JS 문자열 (각 뒤에 스크린샷 name-k.png). "WAIT:ms" 는 기다리기만
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [name = 'indoor', pickJson = '{}', stepsJson = '[]', size = '960x540'] = process.argv.slice(2);
const pick = JSON.parse(pickJson), steps = JSON.parse(stepsJson);
const [w, h] = size.split('x').map(Number);
mkdirSync(join(root, 'shots'), { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await (await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })).newPage();
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning' || m.text().startsWith('[T]')) logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${(e.stack || '').split('\n').slice(0, 4).join('\n')}`));
const t0 = Date.now();
await page.goto('file://' + join(root, 'index.html') + '?play=new&nowake=1&q=low&t=0.45');
try { await page.waitForFunction(() => window.SEREN && window.SEREN.ready && window.SEREN.ready(), null, { timeout: 120000, polling: 500 }); } catch { logs.push('ready 시간 초과'); }
const found = await page.evaluate((pick) => {
  const g = SEREN.game, I = g.interiors, C = g.city;
  const P = pick.near ? { x: pick.near[0], z: pick.near[1] } : g.player.pos;
  let list = C.recs.filter((r) => r.door && (!pick.pid || I.info(r).pid === pick.pid) && (!pick.kind || r.kind === pick.kind) && (!pick.minH || r.top - r.gy >= pick.minH) && (!pick.maxH || r.top - r.gy <= pick.maxH) && (!pick.use || r.use === pick.use));
  list.sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z));
  const r = list[pick.nth || 0];
  if (!r) return null;
  C.fixDoor(r);
  g.player.teleport(r.door.x + r.door.nx * 3, undefined, r.door.z + r.door.nz * 3);
  window.__r = r;
  return { kind: r.kind, use: r.use, pid: I.info(r).pid, h: +(r.top - r.gy).toFixed(1), x: Math.round(r.x), z: Math.round(r.z), n: list.length };
}, pick);
console.log('건물:', JSON.stringify(found));
if (!found) { console.log(logs.join('\n')); await browser.close(); process.exit(1); }
await page.waitForTimeout(1500);
const t1 = Date.now();
await page.evaluate(() => { const g = SEREN.game; if (g.settings) g.settings.hints = false; if (g.tips) g.tips.show = () => false; g.ui.moa = () => {}; g.interiors.enter(window.__r); });
await page.waitForFunction(() => SEREN.game.interiors.inPocket && !SEREN.game.interiors._busy, null, { timeout: 60000, polling: 300 }).catch(() => logs.push('들어가기 시간 초과'));
console.log(`들어가기 ${Date.now() - t1} ms`);
const info = await page.evaluate(() => {
  const I = SEREN.game.interiors, cur = I.cur, B = cur.B, ind = cur.indoor;
  const fl = B.floors.map((F) => `${F.label}:${F.use}${F.reach ? '' : '(x)'}`).join(' ');
  const built = [...ind.built.values()].map((o) => `${o.i}:${o.tris}tri/${o.added.length}col/${o.fix.length}fix`);
  return { name: I.title(cur.r), floors: fl, core: B.core && B.core.types.join('+'), built, p: SEREN.game.player.pos.toArray().map((v) => Math.round(v * 10) / 10), cam: SEREN.engine.camera.position.toArray().map((v) => Math.round(v)) };
});
console.log(JSON.stringify(info, null, 1));
await page.waitForTimeout(2500);
await page.evaluate(() => SEREN.game.ui.closeCard());
await page.screenshot({ path: join(root, 'shots', `${name}-0.png`), timeout: 240000 });
let k = 1;
for (const s of steps) {
  if (s.startsWith('WAIT:')) { await page.waitForTimeout(+s.slice(5)); continue; }
  try { await page.evaluate(() => SEREN.game.ui.closeCard()); const v = await page.evaluate(s); if (v !== undefined) console.log(`[${k}]`, typeof v === 'string' ? v : JSON.stringify(v)); } catch (e) { console.log(`[${k}] 오류`, e.message); }
  await page.waitForTimeout(2200);
  await page.screenshot({ path: join(root, 'shots', `${name}-${k}.png`), timeout: 240000 });
  k++;
}
const r2 = await page.evaluate(() => { const i = SEREN.engine.renderer.info; return { calls: i.render.calls, tris: i.render.triangles }; });
console.log('그리기', JSON.stringify(r2), `총 ${Date.now() - t0} ms`);
for (const l of logs.slice(0, 40)) console.log(l);
await browser.close();
