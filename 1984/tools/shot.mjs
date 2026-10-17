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
// spawn may also be { street: name, t: 0..1, turn: radians, pitch } to stand
// on the centre line of a real street looking along it
export const SHOTS = {
  square: ['city', { x: 4, z: 34, yaw: 0.05, pitch: 0.22 }, 10 * 60, 'clear_cold'],
  monument_base: ['city', { x: -14, z: 18, yaw: -0.6, pitch: 0.1 }, 10 * 60 + 20, 'overcast'],
  charing_cross_rd: ['city', { street: 'Charing Cross Road', t: 0.35, turn: 0, pitch: 0.05 }, 11 * 60, 'overcast'],
  shaftesbury: ['city', { street: 'Shaftesbury Avenue', t: 0.5, turn: 0, pitch: 0.05 }, 8 * 60 + 30, 'clear_cold'],
  seven_dials: ['city', { street: 'Monmouth Street', t: 0.5, turn: 0, pitch: 0.03 }, 15 * 60, 'overcast'],
  prole_street: ['city', { street: 'Shelton Street', t: 0.5, turn: 0, pitch: 0.02 }, 16 * 60, 'rain'],
  minitrue: ['city', { street: 'Ministry Approach', t: 0.62, turn: 1.57, pitch: 0.38 }, 10 * 60, 'clear_cold'],
  home: ['city', 'home_door', 8 * 60, 'clear_cold'],
  square_flags: ['city', { x: -30, z: 30, yaw: -0.45, pitch: 0.18 }, 11 * 60, 'clear_cold'],
  night: ['city', { street: 'Charing Cross Road', t: 0.6, turn: 0, pitch: 0.05 }, 23 * 60 + 30, 'overcast'],
  country: ['country', 'golden', 17 * 60, 'golden'],
  flat: ['flat', 'door', 21 * 60, 'overcast'],
  hall: ['mansions_hall', 'street', 8 * 60, 'overcast'],
  records: ['records', 'entrance', 9 * 60, 'overcast'],
  flat_b: ['flat', { x: 6098.2 + 0.4, z: -1.6, yaw: -2.3, pitch: -0.1 }, 10 * 60, 'overcast'],
  parsons: ['parsons_flat', 'door', 19 * 60, 'overcast'],
  shop: ['shop', 'door', 15 * 60, 'overcast'],
  pub: ['pub', 'door', 20 * 60, 'overcast'],
  room: ['room', 'stairs', 19 * 60, 'hot_haze'],
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
// HTML=<dir>/index.html runs a private build (its own game.js) so parallel work does not collide
await page.goto('file://' + (process.env.HTML || path.join(root, 'index.html')) + `?skip&q=${q}&nostory${process.env.EXTRA || ''}`);
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
    if (spawn && spawn.street && G.world && G.world.plan) {
      const st = G.world.plan.streets.filter((q) => q.name === spawn.street).sort((a, b) => b.line.length - a.line.length)[0];
      if (st) {
        const L = st.line, i = Math.min(L.length - 2, Math.floor(spawn.t * (L.length - 1)));
        const [ax, az] = L[i], [bx, bz] = L[i + 1];
        const yaw = Math.atan2(-(bx - ax), -(bz - az)) + (spawn.turn || 0);
        spawn = { x: (ax + bx) / 2, z: (az + bz) / 2, yaw, pitch: spawn.pitch };
      }
    }
    G.enter(loc, spawn);
    if (typeof spawn === 'object' && spawn.pitch != null) G.player.pitch = spawn.pitch;
    G.setTime(minutes);
    if (G.weather) G.weather.set(weather); else G.atmos.setWeather(weather, true);
    G.atmos.w = { ...G.atmos.target };
  }, [loc, spawn, minutes, weather]);
  await page.waitForTimeout(typeof spawn === 'string' || (spawn && spawn.x > 5000) ? 4500 : 2500);
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
