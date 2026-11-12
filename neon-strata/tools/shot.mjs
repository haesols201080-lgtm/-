// Headless capture / verification harness.
//   node tools/shot.mjs --out shot.png [--q high] [--w 1280 --h 720] [--query "a=b&c=d"]
//                       [--eval "js run after ready"] [--frames 4] [--mobile] [--seq "js1;;js2"]
// Renders with SwiftShader (software GL) so it works without a GPU.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node-tools/node_modules/playwright'); }
const { chromium, devices } = pw;

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith('--')) {
    const k = a.slice(2);
    const v = process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[++i] : '1';
    args[k] = v;
  }
}
const port = args.port || 8765;
const w = Number(args.w || 1280), h = Number(args.h || 720);
const out = args.out || 'shot.png';
const frames = Number(args.frames || 3);
const q = args.q || 'high';
const url = `http://localhost:${port}/?debug=1&q=${q}${args.query ? '&' + args.query : ''}`;

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
    '--enable-webgl', '--disable-gpu-vsync', '--autoplay-policy=no-user-gesture-required'],
});
const ctxOpts = args.mobile
  ? { ...devices['iPhone 13 landscape'], deviceScaleFactor: 1 }
  : { viewport: { width: w, height: h }, deviceScaleFactor: 1 };
const ctx = await browser.newContext(ctxOpts);
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => {
  const t = m.text();
  if (m.type() === 'error' || m.type() === 'warning') { errors.push(`[${m.type()}] ${t}`); }
  else if (args.verbose || t.startsWith('[NS]')) console.log('  console:', t);
});
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message + '\n' + (e.stack || '')));

const t0 = Date.now();
await page.goto(url, { waitUntil: 'load' });
try {
  await page.waitForFunction(() => window.__ready === true || window.__fatal, null, { timeout: Number(args.timeout || 180000) });
} catch (e) { errors.push('ready timeout'); }
const fatal = await page.evaluate(() => window.__fatal || null);
if (fatal) errors.push('[fatal] ' + fatal);
console.log(`ready in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

async function settle(n) {
  // render n frames synchronously through the debug hook (deterministic, independent of rAF speed)
  await page.evaluate(async (n) => {
    if (window.__dbg && window.__dbg.step) { for (let i = 0; i < n; i++) window.__dbg.step(1 / 30); }
    else await new Promise((r) => setTimeout(r, 500));
  }, n);
}

const seq = args.seq ? args.seq.split(';;') : [args.eval || ''];
let idx = 0;
for (const js of seq) {
  if (js.trim()) {
    try { const r = await page.evaluate(js); if (r !== undefined && r !== null) console.log('  eval →', typeof r === 'string' ? r : JSON.stringify(r)); }
    catch (e) { errors.push('[eval] ' + e.message); }
  }
  const ts = Date.now();
  await settle(frames);
  const file = seq.length > 1 ? out.replace(/\.png$/, `_${idx}.png`) : out;
  try { await page.screenshot({ path: file, timeout: 120000 }); console.log('saved', file, `(${((Date.now() - ts) / 1000).toFixed(1)}s)`); }
  catch (e) { errors.push('[screenshot] ' + e.message.split('\n')[0]); }
  idx++;
}
if (args.stats) console.log('  stats:', JSON.stringify(await page.evaluate(() => window.__dbg && window.__dbg.stats && window.__dbg.stats())));
if (errors.length) { console.log('--- ERRORS/WARNINGS ---'); for (const e of errors.slice(0, 40)) console.log(e); }
await browser.close();
