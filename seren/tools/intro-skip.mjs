// 인트로 넘기기 회귀 검사 (v24 P0 「인트로 터치 스킵 시 검은 전환 화면 뒤 월드 노출」) — 헤드리스, 모바일 가로 화면:
//  · 우주 장면에서 빠르게 세 번 탭 → 들판, 들판에서 두 번 탭 → 본편. 매 프레임 (막 불투명도, 장면) 기록.
//  · 장면이 바뀐 첫 프레임에 막이 완전히 덮여 있어야 한다 (우주 → 들판 · 들판 → 본편).
//  · 블룸 안전장치: 착륙선 불꽃 재질이 NaN 을 내게 바꿔도 화면 가운데가 검은 판으로 덮이지 않아야 한다.
//  · 넘긴 뒤 앞 장면의 자막이 남지 않아야 한다.
//   node tools/intro-skip.mjs [shots]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = process.argv[2] === 'shots';
if (SHOTS) mkdirSync(join(root, 'shots'), { recursive: true });
const W = 852, H = 393;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto('file://' + (process.env.SEREN_HTML || join(root, 'index.html')) + '?play=intro&q=medium');
await page.waitForFunction(() => window.SEREN && SEREN.game && SEREN.game.director && SEREN.game.director.seq && SEREN.game.director.seq.t > 3, null, { timeout: 300000, polling: 300 });
await page.evaluate(() => {
  const g = SEREN.game, log = (window.__log = []);
  const A = g.approach, aseq = g.director.seq;
  const tick = () => {
    const s = g.director.seq;
    const phase = s === aseq ? (g.engine.space ? 'space' : 'field') : s ? 'wake' : 'play';
    log.push({ op: +getComputedStyle(g.ui.fadeEl).opacity, phase, cap: A.capC.classList.contains('on') ? A.capC.textContent.slice(0, 12) : '' });
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
const fails = [];
for (let k = 0; k < 3; k++) { await page.touchscreen.tap(W / 2, H / 2); await page.waitForTimeout(90); }
await page.waitForFunction(() => { const l = window.__log; return l.length && l[l.length - 1].phase === 'field' && l[l.length - 1].op < 0.05; }, null, { timeout: 60000, polling: 100 }).catch(() => fails.push('들판 장면에서 막이 걷히지 않음'));
// 블룸 안전장치: 불꽃이 NaN 을 내게
await page.evaluate(() => {
  const f = SEREN.game.approach.flames[0];
  f.material.fragmentShader = f.material.fragmentShader.replace('gl_FragColor = vec4(uC * uK * a, 1.0);', 'float zz = 0.0; gl_FragColor = vec4(uC * uK * a + vec3(zz / zz), 1.0);');
  f.material.needsUpdate = true;
});
await page.waitForTimeout(1500);
// 화면을 찍어 어두운 칸 비율을 센다 (WebGL 캔버스는 그린 뒤 읽으면 비어 있어 스크린샷으로) — 블룸이 NaN 을 퍼뜨리면 거의 1
const png = await page.screenshot({ timeout: 120000 }).catch(() => null);
const dark = !png ? 1 : await page.evaluate(async (b64) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
  const w = 96, h = 48, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const x = cv.getContext('2d'); x.drawImage(img, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h).data;
  let n = 0;
  for (let i = 0; i < w * h; i++) if (d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2] < 70) n++;
  return n / (w * h);
}, png && png.toString('base64'));
if (SHOTS) await page.screenshot({ path: join(root, 'shots', 'intro-skip-nan.png') });
if (dark > 0.2) fails.push(`NaN 한 점이 화면 ${(dark * 100).toFixed(0)}% 를 어둡게 덮음 (블룸 안전장치)`);
for (let k = 0; k < 2; k++) { await page.touchscreen.tap(W / 2, H / 2); await page.waitForTimeout(90); }
await page.waitForFunction(() => { const l = window.__log; return l.length && (l[l.length - 1].phase === 'wake' || l[l.length - 1].phase === 'play'); }, null, { timeout: 60000, polling: 100 }).catch(() => fails.push('본편으로 넘어가지 않음'));
await page.waitForTimeout(400);
const log = await page.evaluate(() => window.__log);
for (let i = 1; i < log.length; i++) {
  const a = log[i - 1], b = log[i];
  if (a.phase !== b.phase && b.op < 0.999) fails.push(`장면 ${a.phase} → ${b.phase} 첫 프레임에 막이 ${b.op.toFixed(2)} 만 덮음`);
  if (a.phase === 'space' && b.phase === 'field' && b.cap) fails.push(`들판으로 넘긴 뒤 앞 자막이 남음: ${b.cap}`);
}
const ph = [...new Set(log.map((l) => l.phase))].join(' → ');
console.log(`프레임 ${log.length} · 장면 ${ph} · 어두운 칸 ${(dark * 100).toFixed(1)}%`);
console.log(errs.length ? `페이지 오류:\n${errs.join('\n')}` : '페이지 오류 없음');
console.log(fails.length ? `실패 ${fails.length}\n${fails.join('\n')}` : '통과');
await browser.close();
process.exit(fails.length || errs.length ? 1 : 0);
