// 개발용 자동 점검: 페이지를 띄우고 입력을 흉내 내어 이동·상태 변화를 확인합니다.
//   node tools/check.mjs [시나리오이름]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const scenario = process.argv[2] || 'move';
const query = process.argv[3] || 'q=low&bloom=0';
mkdirSync(join(root, 'shots'), { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning' || m.text().startsWith('[check]')) logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack}`));
await page.goto('file://' + join(root, 'index.html') + '?' + query);
await page.waitForFunction(() => window.SEREN && window.SEREN.ready && window.SEREN.ready(), null, { timeout: 90000, polling: 250 }).catch(() => logs.push('ready timeout'));

const info = () => page.evaluate(() => window.SEREN.debugInfo());
const sim = (fn, ...a) => page.evaluate(fn, ...a);
// 게임 시간을 직접 진행 (헤드리스는 느리므로 고정 dt 로 여러 번 update)
const step = (sec, setup) => page.evaluate(([sec, setup]) => {
  const g = window.SEREN.game;
  if (setup) new Function('g', setup)(g);
  const n = Math.round(sec / (1 / 30));
  for (let i = 0; i < n; i++) g.updateSim ? g.updateSim(1 / 30) : g.player.update(1 / 30, g.input, g.rig);
  return window.SEREN.debugInfo();
}, [sec, setup]);

const out = [];
const log = (label, v) => out.push(`${label.padEnd(28)} ${JSON.stringify(v)}`);
log('start', await info());
if (scenario === 'move' || scenario === 'all') {
  log('walk 2s', await step(2, "g.input.held.add('up')"));
  log('sprint 2s', await step(2, "g.input.held.add('sprint')"));
  await sim(() => { const g = window.SEREN.game; g.input.held.clear(); });
  log('stop 1s', await step(1));
  log('jump', await step(0.3, "g.input.down.add('jump')"));
  log('land', await step(1.5));
  // 높은 곳에서 활공
  await sim(() => { const g = window.SEREN.game; g.player.teleport(600, 200, 8600); g.player.setState('air'); g.player.pos.y = 200; });
  log('fall 0.5s', await step(0.5));
  log('glide open', await step(0.2, "g.input.down.add('jump')"));
  log('glide 4s', await step(4, "g.input.held.add('up')"));
  log('glide dive 2s', await step(2, "g.rig.pitch=-1.0"));
  log('glide pull 1.5s', await step(1.5, "g.rig.pitch=0.4"));
  log('glide land', await step(25, "g.rig.pitch=-0.25"));
  // 스키머
  await sim(() => { const g = window.SEREN.game; g.input.held.clear(); g.player.teleport(600, undefined, 8600); });
  log('skim on', await step(0.1, "g.input.down.add('skimmer')"));
  log('skim 4s', await step(4, "g.input.held.add('up'); g.input.held.add('sprint')"));
  await sim(() => { const g = window.SEREN.game; g.input.held.clear(); });
  log('skim coast 2s', await step(2));
}
for (const l of out) console.log(l);
for (const l of logs.slice(0, 20)) console.log(l);
await page.screenshot({ path: join(root, 'shots', 'check-' + scenario + '.png') });
await browser.close();
