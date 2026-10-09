// v24 P0 기하 검사 (헤드리스): 움직이는 구조물이 다른 메시를 꿰뚫지 않는가.
//  · 착륙 지점 빛 표지: 도는 고리(반지름 R·굵기 tube)가 어느 각도·시각에서도 기둥(아래 0.6 → 위 0.35 m 원뿔대, 꼭대기 top)과 겹치지 않는다.
//   node tools/p0-geom.mjs
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await (await browser.newContext({ viewport: { width: 480, height: 270 } })).newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto('file://' + (process.env.SEREN_HTML || join(root, 'index.html')) + '?play=new&nowake=1&q=low');
await page.waitForFunction(() => window.SEREN && SEREN.game && SEREN.game.structures && SEREN.game.mode === 'play', null, { timeout: 300000, polling: 1000 });
const r = await page.evaluate(() => {
  const S = SEREN.game.structures, B = S.beaconRing;
  if (!B) return { err: '빛 표지 고리 정보 없음 (structures.beaconRing)' };
  const { halo, top, axis, pillarR, R, tube } = B;
  const pts = 64;
  let worst = 1e9, at = null;
  for (let k = 0; k <= 3000; k++) {
    const t = k * 0.05; // 150 초 (회전·흔들림 주기를 여러 번)
    for (const f of S.anims) f(t);
    halo.updateMatrixWorld(true);
    const e = halo.matrixWorld.elements;
    for (let q = 0; q < pts; q++) {
      const a = (q / pts) * Math.PI * 2, lx = Math.cos(a) * R, ly = Math.sin(a) * R; // 고리 중심선 (TorusGeometry 는 XY 평면)
      const x = e[0] * lx + e[4] * ly + e[12], y = e[1] * lx + e[5] * ly + e[13], z = e[2] * lx + e[6] * ly + e[14];
      // 기둥(원뿔대: 바닥 top-5.5 에서 반지름 0.6 → 꼭대기 top 에서 0.35)까지의 거리 − 고리 굵기
      const h = Math.min(top, Math.max(top - 5.5, y)), rr = 0.6 + (pillarR - 0.6) * ((h - (top - 5.5)) / 5.5);
      const dr = Math.max(0, Math.hypot(x - axis[0], z - axis[1]) - rr), dy = y > top ? y - top : 0;
      const d = Math.hypot(dr, dy) - tube;
      if (d < worst) { worst = d; at = { t: +t.toFixed(2), y: +(y - top).toFixed(3) }; }
    }
  }
  return { worst: +worst.toFixed(3), at };
});
console.log(JSON.stringify(r));
const fails = [];
if (r.err) fails.push(r.err);
else if (r.worst < 0.05) fails.push(`빛 표지 고리가 기둥과 ${r.worst} m (0.05 m 미만) — 겹치거나 스침`);
console.log(errs.length ? `페이지 오류:\n${errs.join('\n')}` : '페이지 오류 없음');
console.log(fails.length ? `실패 ${fails.length}\n${fails.join('\n')}` : '통과');
await browser.close();
process.exit(fails.length || errs.length ? 1 : 0);
