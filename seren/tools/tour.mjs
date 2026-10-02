// 개발용: 한 번 띄운 페이지에서 여러 장소를 돌며 스크린샷
//   node tools/tour.mjs [크기=1280x720] [품질=medium] [이름필터]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [size = '1280x720', quality = 'medium', filter = ''] = process.argv.slice(2);
const [w, h] = size.split('x').map(Number);
const mobile = w < h || process.argv.includes('--mobile');

// [이름, x, z, 시각, 카메라 yaw, pitch, 줌, 추가 스크립트]
const SPOTS = [
  ['crash', 606, 8606, 0.66, 0, -0.05, 1],
  ['dewfold', -380, 7880, 0.7, 0.4, -0.1, 1.3],
  ['capital', 300, 900, 0.62, 0.3, 0.15, 1.6],
  ['yunseul', 10380, 1540, 0.6, 0, -0.05, 1.6],
  ['gatmaeul', -9850, 2780, 0.85, 0, 0.35, 1.4],
  ['tteodol', 7600, -7900, 0.55, 0, -0.15, 1.6],
  ['observatory', -9690, -6960, 0.5, -2.2, -0.1, 1.5],
  ['mulnorae', 14900, 12470, 0.7, 0, -0.1, 1.6],
  ['night-meadow', 300, 8300, 0.93, 0, 0.05, 1],
  ['district', 2600, -700, 0.62, 2.6, 0.25, 1.6],
  ['starport', 3200, 3600, 0.7, 2.4, 0.3, 1.6],
  ['hyeon', 40440, 1300, 0.9, Math.PI, -0.1, 1.4],
  ['rift-core', 39460, -2150, 0.88, Math.PI, 0.2, 1.6],
  ['plains', 2000, 38500, 0.66, Math.PI, 0.25, 1.6],
  ['great-ear', -6000, -45100, 0.86, 0, 0.3, 1.6],
  ['falls', -38800, 7600, 0.66, -1.6, 0.1, 1.6],
  ['eclipse', 300, 8300, 2.43, 0.2, 0.25, 1],
];

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !m.text().includes('ERR_CERT')) logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto('file://' + join(root, 'index.html') + `?q=${quality}&play=new&nowake=1`);
await page.waitForFunction(() => window.SEREN && window.SEREN.game && window.SEREN.game.mode === 'play', null, { timeout: 120000, polling: 300 });
for (const [name, x, z, t, yaw, pitch, zoom, extra] of SPOTS) {
  if (filter && !name.includes(filter)) continue;
  const t0 = Date.now();
  await page.evaluate(([x, z, t, yaw, pitch, zoom, extra]) => {
    const g = SEREN.game;
    g.player.state = 'ground';
    g.player.teleport(x, undefined, z);
    g.world.clock.time = t;
    g.world.clock.frozen = true;
    g.rig.yaw = yaw; g.rig.pitch = pitch; g.rig.zoom = zoom;
    g.rig._init = false;
    if (extra) new Function('g', extra)(g);
  }, [x, z, t, yaw, pitch, zoom, extra]);
  // 지형이 다 생길 때까지 프레임 진행
  await page.waitForFunction(() => SEREN.game.world.terrain.settled, null, { timeout: 90000, polling: 200 }).catch(() => {});
  await page.waitForTimeout(2500);
  await page.screenshot({ path: join(root, 'shots', `tour-${name}.png`) });
  console.log(`tour-${name}.png (${Date.now() - t0} ms)`);
}
for (const l of logs.slice(0, 20)) console.log(l);
await browser.close();
