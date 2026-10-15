// 개발용: 한 번 띄운 페이지에서 카메라를 여러 자리에 두고 스크린샷 (연출 카메라 override 사용)
//   node tools/views.mjs '<JSON 배열>' [폭x높이] [품질]
//   항목: { "name": "이름", "pos": [x,y,z], "look": [x,y,z], "t": 시각(0~1, 생략 가능), "js": "추가 스크립트", "wait": ms,
//          "rel": true(카메라 높이를 지면 기준으로), "lookRel": true(바라볼 점도), "after": "지형이 다 그려진 뒤 실행할 스크립트", "ui": true(HUD 보이기) }
// 예) node tools/views.mjs '[{"name":"city","pos":[0,900,6000],"look":[0,500,0],"t":0.7}]'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = process.argv[2] || '[]';
const views = JSON.parse(existsSync(arg) ? readFileSync(arg, 'utf8') : arg);
const [w, h] = (process.argv[3] || '1280x720').split('x').map(Number);
const quality = process.argv[4] || 'medium';

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: w, height: h } });
const logs = [];
page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !m.text().includes('ERR_CERT')) logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto('file://' + join(root, 'index.html') + `?q=${quality}&play=new&nowake=1`);
await page.waitForFunction(() => window.SEREN && SEREN.game && SEREN.game.mode === 'play', null, { timeout: 180000, polling: 300 });
for (const v of views) {
  const t0 = Date.now();
  await page.evaluate((v) => {
    const g = SEREN.game;
    const [x, y, z] = v.pos;
    g.player.state = 'ground';
    g.player.teleport(v.player ? v.player[0] : x, undefined, v.player ? v.player[1] : z);
    if (v.t !== undefined) { g.world.clock.time = Math.floor(g.world.clock.time) + v.t; g.world.clock.frozen = true; }
    const gy = v.rel ? SEREN.heightAt(x, z) : 0;
    const lk = v.look.slice();
    if (v.lookRel) lk[1] += SEREN.heightAt(lk[0], lk[2]);
    g.rig.override = { pos: new SEREN.THREE.Vector3(x, y + gy, z), look: new SEREN.THREE.Vector3(...lk) };
    g.ui.root.style.display = v.ui ? '' : 'none';
    if (v.js) (0, eval)(v.js);
  }, v);
  // 지형이 따라올 때까지 몇 프레임
  await page.waitForFunction(() => SEREN.game.world.terrain.settled, null, { timeout: 90000, polling: 400 }).catch(() => logs.push('[views] settle timeout ' + v.name));
  if (v.after) await page.evaluate(v.after);
  await page.waitForTimeout(v.wait ?? 1500);
  await page.screenshot({ path: join(root, 'shots', v.name + '.png'), timeout: 120000 });
  const info = await page.evaluate(() => { const i = SEREN.engine.renderer.info; return `calls ${i.render.calls} tris ${(i.render.triangles / 1000).toFixed(0)}k`; });
  console.log(`${v.name}: ${info} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
}
if (logs.length) console.log(logs.slice(0, 12).join('\n'));
await browser.close();
