import { createRequire } from 'node:module'; import path from 'node:path'; import fs from 'node:fs';
const require = createRequire(import.meta.url);
const pw = require('/opt/node22/lib/node_modules/playwright');
const dir = path.dirname(new URL(import.meta.url).pathname);
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
const shots = JSON.parse(process.argv[3]);
const b = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
const logs = []; page.on('console', (m) => logs.push(m.type() + ': ' + m.text())); page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
await page.goto('file://' + path.join(dir, process.env.PAGE || 'index.html') + '?q=' + (process.env.Q || 'medium') + (process.env.EXTRA || ''));
await page.waitForFunction(() => window.ready, null, { timeout: 300000 }).catch(() => {});
for (const [name, s] of Object.entries(shots)) {
  await page.evaluate((s) => { const G = window.G; G.player.place(s.x, s.y || 0, s.z, s.yaw); G.player.pitch = s.pitch || 0; G.setTime(s.t || 600); G.atmos.setWeather(s.w || 'overcast', true); G.atmos.w = { ...G.atmos.target }; }, s);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(out, name + '.png'), timeout: 240000 });
}
console.log([...new Set(logs)].filter((l) => !/willReadFrequently/.test(l)).slice(0, 30).join('\n'));
await b.close();
