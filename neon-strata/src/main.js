import * as THREE from 'three';
import { pickQuality } from './core/quality.js';
import { Engine } from './core/engine.js';
import { U, env } from './render/env.js';
import { buildCity } from './world/city.js';
import { GENERATORS } from './world/generators.js';
import { MATU } from './render/cityMaterial.js';

const params = new URLSearchParams(location.search);
const quality = pickQuality(params);
const bootMsg = (t, p) => { const m = document.getElementById('boot-msg'), f = document.getElementById('boot-fill'); if (m) m.textContent = t; if (f && p != null) f.style.width = (p * 100).toFixed(0) + '%'; };

async function start() {
  const canvas = document.getElementById('view');
  const engine = new Engine(canvas, quality);
  const { scene, camera, renderer } = engine;
  env.setHour(Number(params.get('hour') ?? 21.5));
  const only = params.get('only');
  const gens = only ? GENERATORS.filter((g) => only.split(',').includes(g[2])) : GENERATORS;
  const city = await buildCity(engine, { seed: Number(params.get('seed') ?? 2049), quality, onProgress: bootMsg, generators: gens });

  const setCam = (x, y, z, yaw = 0, pitch = 0) => { camera.position.set(x, y, z); camera.rotation.set(pitch, yaw, 0, 'YXZ'); };
  setCam(0, 1.7, 1700, 0, 0.1);
  const step = (dt) => { env.update(dt, camera.position); city.update(camera.position); engine.render(dt); };
  window.__dbg = {
    engine, env, U, THREE, city, MATU,
    step, cam: setCam, hour: (h) => env.setHour(h),
    look: (x, y, z, tx, ty, tz) => { camera.position.set(x, y, z); camera.lookAt(tx, ty, tz); },
    probe: () => { city.update(camera.position); engine.refreshProbe(); },
    stats: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, geos: renderer.info.memory.geometries, tex: renderer.info.memory.textures, city: city.stats }),
  };
  env.update(0, camera.position); city.update(camera.position);
  if (engine.probeOn) engine.refreshProbe();
  let last = performance.now();
  const loop = (t) => { const dt = Math.min(0.1, (t - last) / 1000); last = t; if (!window.__manual) step(dt); requestAnimationFrame(loop); };
  if (params.get('debug')) { window.__manual = true; document.getElementById('boot').style.display = 'none'; }
  requestAnimationFrame(loop);
  step(1 / 60);
  document.getElementById('boot').classList.add('hide');
  window.__ready = true;
}

start().catch((e) => { console.error(e); window.__fatal = String(e && e.stack || e); bootMsg('오류: ' + e.message); });
