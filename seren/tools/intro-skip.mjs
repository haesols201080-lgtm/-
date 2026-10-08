// 인트로 넘기기 회귀 검사 (v24 P0 「인트로 터치 스킵 시 검은 전환 화면 뒤 월드 노출」) — 헤드리스, 모바일 가로 화면.
// 문서가 요구한 입력 조건마다 따로 불러와서 (`?play=intro&at=초`):
//  · rapid   : 우주 장면에서 빠르게 세 번 탭 → 들판, 블룸 NaN 주입(불꽃 재질), 들판에서 두 번 탭 → 본편
//  · single  : 우주에서 한 번 탭 → 들판, 들판에서 한 번 탭 → 본편
//  · natural : 탭 없이 우주 → 들판 (흰 빛 속의 연출된 넘어감)
//  · ending  : 탭 없이 들판 → 본편 (끝나기 2 초 전부터 — 검은 막이 다 덮은 뒤 깨어남)
//  · edge    : 우주 → 들판이 저절로 바뀌기 0.35 초 전에 탭, 들판이 시작되자마자 다시 탭
// 매 프레임 (검은 막 불투명도, 흰 빛, 장면, 자막) 을 기록해:
//  · 장면이 바뀐 첫 프레임에 검은 막이 완전히 덮여 있어야 한다 (우주 → 들판을 저절로 넘을 때만 흰 빛 0.3 이상이면 된다)
//  · 넘긴 뒤 앞 장면의 자막이 남지 않아야 한다 · 본편(깨어남/플레이)까지 가야 한다
//  · rapid: NaN 한 점이 블룸을 타고 화면을 검은 판으로 덮지 않아야 한다 (스크린샷의 어두운 칸 비율)
//   node tools/intro-skip.mjs [시나리오,…] [shots]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const SHOTS = args.includes('shots');
const ONLY = (args.find((a) => a !== 'shots') || 'rapid,single,natural,ending,edge').split(',');
if (SHOTS) mkdirSync(join(root, 'shots'), { recursive: true });
const W = 852, H = 393, TB = 32;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
let allFails = 0, allErrs = 0;

async function scenario(name, at, script) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errs = [], fails = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('file://' + (process.env.SEREN_HTML || join(root, 'index.html')) + `?play=intro&q=medium${at ? `&at=${at}` : ''}`);
  await page.waitForFunction((at) => window.SEREN && SEREN.game && SEREN.game.director && SEREN.game.director.seq && SEREN.game.director.seq.t > at + 1.5, at, { timeout: 300000, polling: 200 });
  await page.evaluate(() => {
    const g = SEREN.game, log = (window.__log = []);
    const A = g.approach, aseq = g.director.seq;
    const tick = () => {
      const s = g.director.seq;
      const phase = s === aseq || A._holding ? (g.engine.space ? 'space' : 'field') : s ? 'wake' : 'play';
      log.push({ op: +getComputedStyle(g.ui.fadeEl).opacity, fl: +getComputedStyle(g.ui.flashEl).opacity, phase, t: s === aseq ? +s.t.toFixed(2) : -1, cap: A.capC.classList.contains('on') ? A.capC.textContent.slice(0, 12) : '' });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const tap = async (n = 1, gap = 90) => { for (let k = 0; k < n; k++) { await page.touchscreen.tap(W / 2, H / 2); await page.waitForTimeout(gap); } };
  const waitPhase = (ph, uncovered = true, ms = 120000) => page.waitForFunction(([ph, un]) => { const l = window.__log; const e = l[l.length - 1]; return e && ph.includes(e.phase) && (!un || e.op < 0.05); }, [ph, uncovered], { timeout: ms, polling: 100 }).then(() => true, () => false);
  let dark = 0;
  await script({ page, tap, waitPhase, fails, setDark: (d) => (dark = d) });
  if (!(await waitPhase(['wake', 'play'], false, 240000))) fails.push('본편으로 넘어가지 않음');
  await page.waitForTimeout(400);
  const log = await page.evaluate(() => window.__log);
  for (let i = 1; i < log.length; i++) {
    const a = log[i - 1], b = log[i];
    if (a.phase === b.phase) continue;
    const natural = a.phase === 'space' && b.phase === 'field' && b.fl >= 0.3;
    if (b.op < 0.999 && !natural) fails.push(`장면 ${a.phase} → ${b.phase} 첫 프레임에 검은 막 ${b.op.toFixed(2)} · 흰 빛 ${b.fl.toFixed(2)} 만 덮음`);
    if (a.phase === 'space' && b.phase === 'field' && b.cap) fails.push(`들판으로 넘어간 뒤 앞 자막이 남음: ${b.cap}`);
  }
  const ph = [...new Set(log.map((l) => l.phase))].join(' → ');
  console.log(`[${name}] 프레임 ${log.length} · 장면 ${ph}${dark ? ` · 어두운 칸 ${(dark * 100).toFixed(1)}%` : ''} · ${errs.length ? `페이지 오류 ${errs.length}: ${errs[0]}` : '페이지 오류 없음'} · ${fails.length ? `실패 ${fails.length}\n  ${fails.join('\n  ')}` : '통과'}`);
  allFails += fails.length; allErrs += errs.length;
  await ctx.close();
}

async function darkRatio(page) {
  // 화면을 찍어 어두운 칸 비율을 센다 (WebGL 캔버스는 그린 뒤 읽으면 비어 있어 스크린샷으로) — 블룸이 NaN 을 퍼뜨리면 거의 1
  const png = await page.screenshot({ timeout: 120000 }).catch(() => null);
  if (!png) return 1;
  return page.evaluate(async (b64) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const w = 96, h = 48, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const x = cv.getContext('2d'); x.drawImage(img, 0, 0, w, h);
    const d = x.getImageData(0, 0, w, h).data;
    let n = 0;
    for (let i = 0; i < w * h; i++) if (d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2] < 70) n++;
    return n / (w * h);
  }, png.toString('base64'));
}

const S = {
  rapid: [0, async ({ page, tap, waitPhase, fails, setDark }) => {
    await tap(3);
    if (!(await waitPhase(['field']))) fails.push('들판 장면에서 막이 걷히지 않음');
    await page.evaluate(() => {
      const f = SEREN.game.approach.flames[0];
      f.material.fragmentShader = f.material.fragmentShader.replace('gl_FragColor = vec4(uC * uK * a, 1.0);', 'float zz = 0.0; gl_FragColor = vec4(uC * uK * a + vec3(zz / zz), 1.0);');
      f.material.needsUpdate = true;
    });
    await page.waitForTimeout(1500);
    const d = await darkRatio(page);
    setDark(d);
    if (SHOTS) await page.screenshot({ path: join(root, 'shots', 'intro-skip-nan.png') });
    if (d > 0.2) fails.push(`NaN 한 점이 화면 ${(d * 100).toFixed(0)}% 를 어둡게 덮음 (블룸 안전장치)`);
    await tap(2);
  }],
  single: [0, async ({ page, tap, waitPhase, fails }) => {
    await tap(1);
    if (!(await waitPhase(['field']))) fails.push('한 번 탭: 들판 장면에서 막이 걷히지 않음');
    await page.waitForTimeout(1200);
    await tap(1);
  }],
  // 탭 없이: 우주 → 들판 (흰 빛 속) — 들판 장면이 시작된 뒤 한 번 탭해 끝낸다 (헤드리스는 초당 한 프레임 남짓이라 들판 12.8 초를 다 보면 너무 길다)
  natural: [TB - 4, async ({ page, tap, waitPhase, fails }) => {
    if (!(await waitPhase(['field'], false, 120000))) fails.push('저절로 들판으로 넘어가지 않음');
    await page.waitForTimeout(1500);
    await tap(1);
  }],
  // 탭 없이: 들판 → 본편 (끝나기 2 초 전부터 — 들판 마지막 장면을 붙든 채 검은 막이 다 덮인 뒤 깨어남)
  ending: [TB + 12.8 - 2, async () => {}],
  edge: [TB - 2.5, async ({ page, tap, fails }) => {
    // 저절로 바뀌기 0.35 초 전
    await page.waitForFunction((TB) => { const s = SEREN.game.director.seq; return s && s.t >= TB - 0.35; }, TB, { timeout: 120000, polling: 16 });
    await tap(1, 10);
    // 들판이 시작되자마자 (막이 아직 덮여 있거나 걷히는 중) 다시 탭
    const ok = await page.waitForFunction(() => { const l = window.__log; const e = l[l.length - 1]; return e && e.phase === 'field'; }, null, { timeout: 120000, polling: 16 }).then(() => true, () => false);
    if (!ok) fails.push('전환 직전 탭: 들판으로 넘어가지 않음');
    await tap(1, 10);
  }],
};
for (const name of ONLY) await scenario(name, ...S[name]);
await browser.close();
console.log(allFails || allErrs ? `실패 ${allFails} · 페이지 오류 ${allErrs}` : '통과');
process.exit(allFails || allErrs ? 1 : 0);
