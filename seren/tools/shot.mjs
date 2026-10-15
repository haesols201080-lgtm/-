// 개발용 스크린샷 도구 (헤드리스 Chromium, 소프트웨어 WebGL)
//   node tools/shot.mjs <이름> "<쿼리스트링>" [폭x높이] [대기ms] [스크립트]
// 예) node tools/shot.mjs start "cam=0,120,9000&look=0,300,0&t=0.32"
//     스크립트 인자는 페이지 안에서 실행할 JS (예: "SEREN.clock.time=0.8")
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [name = 'shot', query = '', size = '1280x720', wait = '2500', script = ''] = process.argv.slice(2);
const [w, h] = size.split('x').map(Number);
mkdirSync(join(root, 'shots'), { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
});
const isMobile = w < h;
const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile, hasTouch: isMobile });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack || ''}`));
const url = 'file://' + join(root, 'index.html') + (query ? '?' + query : '');
const t0 = Date.now();
await page.goto(url);
// 지형이 다 만들어질 때까지 기다림
try {
  await page.waitForFunction(() => window.SEREN && window.SEREN.ready && window.SEREN.ready(), null, { timeout: 60000, polling: 250 });
} catch { logs.push('[shot] ready 대기 시간 초과'); }
if (script) await page.evaluate(script);
await page.waitForTimeout(+wait);
const out = join(root, 'shots', name + '.png');
await page.screenshot({ path: out });
const info = await page.evaluate(() => {
  const s = window.SEREN;
  if (!s || !s.engine) return null;
  const i = s.engine.renderer.info;
  return { calls: i.render.calls, tris: i.render.triangles, geos: i.memory.geometries, chunks: s.terrain?.visibleCount, extra: s.debugInfo ? s.debugInfo() : undefined };
}).catch(() => null);
console.log(`saved ${out} (${Date.now() - t0} ms)`, JSON.stringify(info));
for (const l of logs.slice(0, 30)) console.log(l);
await browser.close();
