// Headless screenshots for checking the look of the game.
//   node tools/shot.mjs [outDir] [shotName ...]
// Opens index.html from disk (assets.js makes that work), skips the menu, then
// for each shot moves the player, sets the time and weather and captures.
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require('/opt/node22/lib/node_modules/playwright'); }

const root = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const out = process.argv[2] || path.join(root, 'shots');
const only = process.argv.slice(3);
fs.mkdirSync(out, { recursive: true });

// name: [location, spawn {x,z,yaw,pitch}, minutes, weather]
export const SHOTS = {
  square: ['city', { x: 2, z: 40, yaw: 0, pitch: 0.12 }, 10 * 60, 'clear_cold'],
  charing_cross_rd: ['city', { x: -40, z: -260, yaw: 0.2, pitch: 0.04 }, 11 * 60, 'overcast'],
  seven_dials: ['city', { x: 60, z: -660, yaw: 1.0, pitch: 0.04 }, 15 * 60, 'overcast'],
  prole_street: ['city', { x: 200, z: -760, yaw: -0.5, pitch: 0.02 }, 16 * 60, 'rain'],
  minitrue: ['city', { x: -44, z: -1310, yaw: 0, pitch: 0.42 }, 10 * 60, 'clear_cold'],
  home: ['city', 'home_door', 8 * 60, 'clear_cold'],
  night: ['city', { x: -40, z: -420, yaw: 0, pitch: 0.05 }, 23 * 60 + 30, 'overcast'],
  country: ['country', 'golden', 17 * 60, 'golden'],
  flat: ['flat', 'door', 21 * 60, 'overcast'],
  records: ['records', 'entrance', 9 * 60, 'overcast'],
};

const browser = await pw.chromium.launch({
  executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? undefined : undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack || ''}`));
const q = process.env.Q || 'medium';
await page.goto('file://' + path.join(root, 'index.html') + `?skip&q=${q}&nostory${process.env.EXTRA || ''}`);
try {
  await page.waitForFunction(() => window.G && window.G.location, null, { timeout: 240000 });
} catch (e) {
  console.log('game did not start'); console.log(logs.join('\n'));
  await page.screenshot({ path: path.join(out, 'boot_fail.png') });
  await browser.close(); process.exit(1);
}
await page.waitForTimeout(3000);
for (const [name, [loc, spawn, minutes, weather]] of Object.entries(SHOTS)) {
  if (only.length && !only.includes(name)) continue;
  const t0 = Date.now();
  await page.evaluate(([loc, spawn, minutes, weather]) => {
    const G = window.G;
    G.cutscene = 0; G.modal = false;
    if (G.ui && G.ui.closeAll) G.ui.closeAll();
    G.enter(loc, spawn);
    if (typeof spawn === 'object' && spawn.pitch != null) G.player.pitch = spawn.pitch;
    G.setTime(minutes);
    if (G.weather) G.weather.set(weather); else G.atmos.setWeather(weather, true);
    G.atmos.w = { ...G.atmos.target };
  }, [loc, spawn, minutes, weather]);
  await page.waitForTimeout(2500);
  const fps = await page.evaluate(() => new Promise((res) => {
    let n = 0; const t = performance.now();
    const f = () => { n++; if (performance.now() - t < 2000) requestAnimationFrame(f); else res(n / 2); };
    requestAnimationFrame(f);
  }));
  const info = await page.evaluate(() => {
    const r = window.G.renderer.gl.info.render;
    return { calls: r.calls, tris: r.triangles };
  });
  await page.screenshot({ path: path.join(out, name + '.png'), timeout: 240000 });
  console.log(`${name}: fps ${fps.toFixed(1)} (swiftshader) calls ${info.calls} tris ${info.tris} ${(Date.now() - t0) / 1000}s`);
}
console.log('--- console ---');
console.log([...new Set(logs)].slice(0, 60).join('\n'));
await browser.close();
