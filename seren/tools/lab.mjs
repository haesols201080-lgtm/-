// 캐릭터 실험실 실행: 장면 이름들을 주면 shots/lab/<이름>.png 로 접촉 시트를 저장한다.
//   node tools/lab.mjs player-walk player-run awen-move …   (목록: node tools/lab.mjs --list)
import * as esbuild from 'esbuild';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'shots', 'lab');
mkdirSync(out, { recursive: true });

// 장면 정의: subject + 매개변수 (entry.js 의 S[subject])
const P = (seg, extra = {}) => ({ subject: 'player', seg, frames: 12, every: 0.07, dist: 4.2, ...extra });
const SCENES = {
  'player-idle': P([{ dur: 99, speed: 0 }], { every: 0.6, frames: 12, view: 'three' }),
  'player-walk': P([{ dur: 99, speed: 2.4 }], { warm: 1 }),
  'player-jog': P([{ dur: 99, speed: 8.2 }], { warm: 1, every: 0.045 }),
  'player-run': P([{ dur: 99, speed: 12.5 }], { warm: 1, every: 0.035 }),
  'player-stop': P([{ dur: 1.2, speed: 8.2 }, { dur: 99, speed: 0 }], { warm: 0.8, every: 0.08 }),
  'player-start': P([{ dur: 0.4, speed: 0 }, { dur: 99, speed: 8.2 }], { every: 0.07 }),
  'player-turn': P([{ dur: 99, speed: 0, yawRate: 3 }], { warm: 0.3, every: 0.08, view: 'three' }),
  'player-curve': P([{ dur: 99, speed: 8.2, yawRate: 2 }], { warm: 1, every: 0.06, view: 'back' }),
  'player-jump': P([{ dur: 0.3, speed: 0 }, { dur: 99, speed: 0, jump: 8.5 }], { every: 0.07, view: 'side' }),
  'player-look': P([{ dur: 99, speed: 0 }], { look: true, every: 0.3, view: 'three' }),
  'awen-idle': { subject: 'awen', seg: [{ dur: 99 }], frames: 12, every: 0.5, dist: 9, view: 'three' },
  'awen-move': { subject: 'awen', seg: [{ dur: 0.6 }, { dur: 2.6, speed: 2.2 }, { dur: 99, speed: 0 }], frames: 12, every: 0.3, dist: 9, view: 'side' },
  'awen-turn': { subject: 'awen', seg: [{ dur: 99, speed: 1.6, yawRate: 1.2 }], frames: 12, every: 0.25, dist: 10, view: 'three' },
  'awen-talk': { subject: 'awen', seg: [{ dur: 99, look: true, speak: true, gesture: 0.6 }], frames: 12, every: 0.35, dist: 8, view: 'three' },
  'crowd-poses': { subject: 'crowd', people: [{}, { move: 1, turn: 0.8 }, { armR: 1.2, elbowR: 0.8 }, { kneel: 1, armL: 0.9, armR: 0.8, elbowL: 0.5, elbowR: 0.5, head: 0.35 }, { speak: 1, armL: 0.6, armR: 0.6, elbowL: 0.9, elbowR: 0.9 }, { head: 0.3, headYaw: 0.8 }, { kneel: 0.48, armL: 0.35, armR: 0.35 }, { hold: 5, armL: 0.9, armR: 0.9, elbowL: 1.1, elbowR: 1.1 }], frames: 6, every: 0.4, dist: 14, view: 'front', cols: 3 },
  'awen-start-stop': { subject: 'awen', seg: [{ dur: 0.5 }, { dur: 2.0, speed: 2.4 }, { dur: 99, speed: 0 }], frames: 12, every: 0.28, dist: 9, view: 'side' },
};
for (const sp of ['hopper', 'bird', 'beast', 'crab', 'jelly', 'strider']) {
  SCENES[`fauna-${sp}`] = { subject: 'fauna', species: sp, mode: 'move', frames: 12, every: 0.12, dist: sp === 'beast' ? 9 : sp === 'jelly' ? 6 : 3.5, view: 'three' };
  SCENES[`fauna-${sp}-idle`] = { subject: 'fauna', species: sp, mode: 'idle', frames: 12, every: 0.4, dist: sp === 'beast' ? 9 : sp === 'jelly' ? 6 : 3.5, view: 'three' };
}

if (process.argv.includes('--list')) { console.log(Object.keys(SCENES).join('\n')); process.exit(0); }
const want = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const r = await esbuild.build({ entryPoints: [join(root, 'tools/lab/entry.js')], bundle: true, format: 'iife', write: false, target: ['es2020'], logLevel: 'error' });
const html = `<!doctype html><html><head><meta charset="utf-8"></head><body><script>${r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')}</script></body></html>`;
writeFileSync(join(out, 'lab.html'), html);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on('pageerror', (e) => console.log('pageerror', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('console', m.text()); });
await page.goto('file://' + join(out, 'lab.html'));
await page.waitForFunction(() => window.LAB, null, { timeout: 60000 });
for (const name of want.length ? want : Object.keys(SCENES)) {
  const sc = SCENES[name];
  if (!sc) { console.log('없는 장면', name); continue; }
  await page.evaluate((o) => window.LAB.run(o), sc);
  await page.screenshot({ path: join(out, name + '.png') });
  console.log('lab', name);
}
await browser.close();
