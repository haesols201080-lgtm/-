// 공중다리 시험 (헤드리스): 다리 위에 서서 → 탑 A 의 다리 층으로 들어가고 → 다리 문으로 다시 나와
// → 유리 통로를 실제로 걸어 건너 → 탑 B 의 다리 층으로 들어간다. 층 바닥 높이 = 다리 바닥 높이인지, 모아·지도 찾기가 되는지.
//   node tools/bridge-flow.mjs [몇 개] [shots]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const N = +(process.argv[2] || 2) || 2;
const shots = process.argv.includes('shots');
mkdirSync(join(root, 'shots'), { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await (await browser.newContext({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 })).newPage();
const logs = [];
page.on('console', (m) => { if (m.type() === 'error') logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${(e.stack || '').split('\n').slice(0, 5).join('\n')}`));
page.on('crash', () => logs.push('[crash]'));
await page.goto('file://' + join(root, 'index.html') + '?play=new&nowake=1&q=low&t=0.45');
try { await page.waitForFunction(() => window.SEREN && window.SEREN.ready && window.SEREN.ready(), null, { timeout: 240000, polling: 1000 }); } catch { console.log('ready 시간 초과 (계속)'); }
await page.waitForFunction(() => window.SEREN && SEREN.game && SEREN.game.city && SEREN.game.city.recs && SEREN.game.city.recs.length > 0, null, { timeout: 120000, polling: 1000 });
await page.evaluate(() => { const g = SEREN.game; if (g.settings) g.settings.hints = false; if (g.tips) g.tips.first = () => false; g.ui.moa = () => {}; });
const total = await page.evaluate(() => SEREN.game.city.bridgeList.length);
console.log(`공중다리 ${total}개`);
const waitIn = () => page.waitForFunction(() => SEREN.game.interiors.inPocket && !SEREN.game.interiors._busy, null, { timeout: 90000, polling: 300 });
const waitOut = () => page.waitForFunction(() => !SEREN.game.interiors.inPocket && !SEREN.game.interiors._busy, null, { timeout: 90000, polling: 300 });
const shot = async (name) => { if (shots) await page.screenshot({ path: join(root, 'shots', `${name}.png`), timeout: 300000 }); };
let fail = 0;
for (let k = 0; k < Math.min(N, total); k++) {
  const bi = Math.floor((k * total) / Math.max(1, N));
  const res = { bi };
  try {
    // 1) 다리 위, 탑 A 끝 가까이
    Object.assign(res, await page.evaluate((bi) => {
      const g = SEREN.game, I = g.interiors, BL = g.city.bridgeList[bi];
      const along = -(BL.half - I._faceIn(BL.a, BL) - 2.2);
      g.player.teleport(BL.mx + BL.ux * along, BL.y + 0.6, BL.mz + BL.uz * along);
      g.player.state = 'ground';
      for (let i = 0; i < 40; i++) g.updateSim(0.05);
      const p = g.player.pos, t = I.target(p);
      window.__BL = BL;
      return { a: I.title(BL.a), b: I.title(BL.b), y: Math.round(BL.y * 10) / 10, len: Math.round(BL.half * 2), standY: Math.round((p.y - BL.y) * 100) / 100, targetA: t && t.kind, labelA: t && t.label };
    }, bi));
    if (res.targetA !== 'bridgein') throw new Error(`탑 A 끝에서 문이 안 잡힘 (${res.targetA})`);
    await shot(`bridge-${k}-deck`);
    // 2) 탑 A 로 들어가기
    await page.evaluate(() => { const g = SEREN.game, I = g.interiors; I.use(I.target(g.player.pos)); });
    await waitIn();
    await page.waitForTimeout(800);
    Object.assign(res, await page.evaluate(() => {
      const g = SEREN.game, I = g.interiors, BL = window.__BL, cur = I.cur, F = cur.B.floors[cur.indoor.cur];
      const t = I.target(g.player.pos);
      return { inA: cur.r === BL.a, floorA: F.label, useA: F.use, dyA: Math.round((F.y - BL.y) * 100) / 100, doorA: t && t.kind, labelDoorA: t && t.label };
    }));
    if (!res.inA || res.doorA !== 'bridge' || Math.abs(res.dyA) > 0.05) throw new Error('탑 A 다리 층이 맞지 않음');
    await shot(`bridge-${k}-inA`);
    // 3) 다리 문으로 나가기 → 통로 위
    await page.evaluate(() => { const g = SEREN.game, I = g.interiors; I.use(I.target(g.player.pos)); });
    await waitOut();
    await page.waitForTimeout(600);
    // 4) 걸어서 건너기 (앞으로 키를 누른 채 시뮬레이션) — 다리에서 떨어지지 않고 건너편 문이 잡힐 때까지
    Object.assign(res, await page.evaluate(() => {
      const g = SEREN.game, I = g.interiors, BL = window.__BL;
      g.player.state = 'ground';
      g.input.held.add('up');
      let minY = 1e9, maxY = -1e9, steps = 0, got = null, maxPerp = 0;
      for (; steps < 1600; steps++) {
        g.updateSim(0.05);
        const p = g.player.pos;
        minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
        maxPerp = Math.max(maxPerp, Math.abs(-(p.x - BL.mx) * BL.uz + (p.z - BL.mz) * BL.ux));
        const t = I.target(p);
        if (t && t.kind === 'bridgein' && t.o.r === BL.b) { got = t; break; }
      }
      g.input.held.clear();
      return { walk: Math.round(steps * 0.05), minDy: Math.round((minY - BL.y) * 100) / 100, maxDy: Math.round((maxY - BL.y) * 100) / 100, maxPerp: Math.round(maxPerp * 10) / 10, targetB: got && got.kind, labelB: got && got.label };
    }));
    if (res.targetB !== 'bridgein' || res.minDy < -0.5) throw new Error('건너지 못함');
    await shot(`bridge-${k}-cross`);
    // 5) 탑 B 로
    await page.evaluate(() => { const g = SEREN.game, I = g.interiors; I.use(I.target(g.player.pos)); });
    await waitIn();
    await page.waitForTimeout(800);
    Object.assign(res, await page.evaluate(() => {
      const g = SEREN.game, I = g.interiors, BL = window.__BL, cur = I.cur, F = cur.B.floors[cur.indoor.cur];
      const t = I.target(g.player.pos);
      // 모아에게 「공중다리」를 물으면 이 건물의 실제 다리 문 · 지도 찾기도 같은 자료
      const m = g.moaAI.find('공중다리 어디야');
      return { inB: cur.r === BL.b, floorB: F.label, useB: F.use, dyB: Math.round((F.y - BL.y) * 100) / 100, doorB: t && t.kind, moa: m ? `${m.name}${m.inside ? ` [${m.inside.kind} ${m.floor}층]` : ''}` : null };
    }));
    if (!res.inB || Math.abs(res.dyB) > 0.05) throw new Error('탑 B 다리 층이 맞지 않음');
    if (!res.moa || !/공중다리/.test(res.moa)) throw new Error('모아가 공중다리 문을 못 찾음');
    await shot(`bridge-${k}-inB`);
    await page.evaluate(() => { SEREN.game.interiors.exit(); });
    await waitOut();
  } catch (e) { res.err = e.message; fail++; try { await page.evaluate(() => { const I = SEREN.game.interiors; if (I.inPocket) I.exit(); }); await waitOut(); } catch {} }
  console.log(JSON.stringify(res));
}
console.log(logs.length ? `기록:\n${[...new Set(logs)].slice(0, 20).join('\n')}` : '오류 없음');
console.log(fail ? `실패 ${fail}` : '모두 통과');
await browser.close();
process.exit(fail ? 1 : 0);
