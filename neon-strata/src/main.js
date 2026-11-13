import * as THREE from 'three';
import { pickQuality } from './core/quality.js';
import { Engine } from './core/engine.js';
import { U, env } from './render/env.js';
import { buildCity } from './world/city.js';
import { GENERATORS } from './world/generators.js';
import { MATU } from './render/cityMaterial.js';
import { createTraffic } from './fx/traffic.js';
import { createRain, createParticles } from './fx/weather.js';
import { Crowd } from './fx/crowd.js';
import { Input } from './game/input.js';
import { Player } from './game/player.js';
import { Game, INTERACT } from './game/game.js';
import { GameAudio } from './game/audio.js';
import { HUD } from './ui/hud.js';
import { loadFonts } from './render/signs.js';

const params = new URLSearchParams(location.search);
const quality = pickQuality(params);
const debug = !!params.get('debug');
const bootMsg = (t, p) => { const m = document.getElementById('boot-msg'), f = document.getElementById('boot-fill'); if (m) m.textContent = t; if (f && p != null) f.style.width = (p * 100).toFixed(0) + '%'; };

async function start() {
  const canvas = document.getElementById('view');
  await loadFonts();
  const engine = new Engine(canvas, quality);
  const { scene, camera, renderer } = engine;
  env.setHour(Number(params.get('hour') ?? 21.5));
  const only = params.get('only');
  const gens = only ? GENERATORS.filter((g) => only.split(',').includes(g[2])) : GENERATORS;
  const city = await buildCity(engine, { seed: Number(params.get('seed') ?? 2049), quality, onProgress: bootMsg, generators: gens });
  bootMsg('교통 · 군중 · 날씨 기동', 0.97);
  const traffic = createTraffic(city.ctx, quality); scene.add(traffic.group);
  const rain = createRain(quality); scene.add(rain.mesh);
  const parts = createParticles(city.ctx.steam); scene.add(parts.mesh);
  const crowd = new Crowd(city, quality, scene);
  const audio = new GameAudio();
  const game = new Game({ engine, city, crowd, env, U, audio });
  const input = new Input(canvas, null);
  const player = new Player(game); game.player = player;
  const hud = new HUD(game, input); input.ui = hud; game.hud = hud;
  const tm = (e) => {}; void tm;
  // touch stick visual hookup
  const _ts = input; _ts.uiStick = hud;
  canvas.addEventListener('touchstart', () => {}, { passive: true });

  // ---- load save or place the player at the capsule home door
  const loaded = !debug && game.load();
  const home = city.pois.find((p) => p.type === 'home');
  if (loaded && game.state.pos) { player.pos.set(game.state.pos[0], game.state.pos[1] + 0.3, game.state.pos[2]); player.camYaw = game.state.pos[3] || 0; env.hour = game.state.hour ?? 21.5; }
  else if (home) { player.pos.set(home.doorX, 0.2, home.doorZ); player.camYaw = Math.atan2(home.doorX - home.x, home.doorZ - home.z) + Math.PI; }
  player.vpos.set(player.pos.x + 4, player.pos.y + 1.4, player.pos.z + 3); player.setCar(game.state.vehicle);
  try { const s = localStorage.getItem('ns.sens'); if (s) player.sens = +s; } catch (e) { /* ignore */ }
  game._objective();

  let started = debug; let noRender = false;
  const step = (dt) => {
    input.frame();
    if (started) {
      if (input.hit('Tab', 'KeyM', 'Escape') && (hud.open || !input.hit('Escape'))) hud.toggle();
      if (input.hit('KeyE', 'BtnE') && game.near && !player.liftPrompt && !hud.open) {
        const t = game.near.type;
        if (t === 'home') game.sleep(); else if (t === 'license') hud.toggle('garage'); else if (t === 'exchange') hud.toggle('stock'); else if (t === 'bank') hud.toggle('rank'); else if (t === 'station') hud.toggle('sys'); else if (t === 'crown') hud.toggle('biz'); else if (t === 'lobby') hud.toggle('biz'); else hud.toggle('trade');
      }
      player.update(dt, hud.open ? { ...input, move: { x: 0, y: 0 }, lookX: 0, lookY: 0, wheel: 0, hit: () => false, down: () => false, enabled: false, touch: input.touch } : input);
      game.update(dt, input);
    } else { // title: slow orbit around the start area
      const t = performance.now() * 0.00004; const c = player.pos; camera.position.set(c.x + Math.cos(t) * 150, 90 + Math.sin(t * 2) * 30, c.z + Math.sin(t) * 150); camera.lookAt(0, 420, 0);
    }
    env.update(dt, camera.position); city.update(camera.position); traffic.update(engine); crowd.update(dt, started ? player.p : camera.position, env.weather.rain);
    rain.uniforms.uLocal.value = 1 - player.indoor; engine.post.settings.bloom = 1 + env.weather.rain * 0.35;
    engine.post.mFinal.uniforms.uSpeedFx.value = Math.min(1, player.speed / 110); engine.post.mFinal.uniforms.uFade.value = 1 - (game.fade || 0);
    audio.update(env.weather.rain, player.indoor, player.mode === 'fly', player.speed, player.p.y);
    if (!noRender) engine.render(dt);
    if (started) hud.update(dt);
    input.endFrame();
  };

  // ---- title screen
  const title = document.createElement('div'); title.id = 'title';
  title.innerHTML = `<div class="boot-logo">NEON<span>STRATA</span></div><div class="t-sub">빛의 제국 · KAIROS-9</div>
    <div class="t-lore">하늘이 닫힌 뒤, 햇빛은 화폐가 되었다. 구름 아래 침전층의 캡슐 한 칸에서 시작해 — 광편을 줍고, 하늘길을 달리고, 구역의 시세를 읽고, 기업을 삼켜 — 구름 위 왕관까지 올라가라.</div>
    <button id="t-start">${loaded ? '이어하기' : '시작'}</button>
    <div class="t-keys">WASD 이동 · 마우스 시점 · Shift 달리기/부스트 · Space 점프/상승 · C 하강 · F 탑승 · R 호출 · E 상호작용 · Tab 메뉴 &nbsp;|&nbsp; 모바일: 왼쪽 스틱 · 오른쪽 드래그 시점</div>`;
  document.body.appendChild(title);
  if (debug) title.classList.add('hide');
  document.getElementById('t-start').addEventListener('click', () => { started = true; title.classList.add('hide'); audio.start(); if (!input.touch) canvas.requestPointerLock?.(); engine.refreshProbe && engine.probeOn && engine.refreshProbe(); });
  document.getElementById('ui').style.visibility = debug ? 'visible' : 'hidden';
  document.getElementById('t-start').addEventListener('click', () => { document.getElementById('ui').style.visibility = 'visible'; });

  const setCam = (x, y, z, yaw = 0, pitch = 0) => { camera.position.set(x, y, z); camera.rotation.set(pitch, yaw, 0, 'YXZ'); };
  window.__dbg = {
    engine, env, U, THREE, city, MATU, crowd, traffic, game, player, hud, input,
    step, cam: setCam, hour: (h) => env.setHour(h),
    sim: (n, dt = 1 / 30) => { noRender = true; for (let i = 0; i < n; i++) step(dt); noRender = false; },
    look: (x, y, z, tx, ty, tz) => { camera.position.set(x, y, z); camera.lookAt(tx, ty, tz); },
    // render one frame from a free camera (bypasses the player rig)
    free: (dt = 1 / 30) => { env.update(dt, camera.position); city.update(camera.position); traffic.update(engine); crowd.update(dt, camera.position, env.weather.rain); engine.render(dt); },
    probe: () => { city.update(camera.position); engine.refreshProbe(); engine.render(0); engine.render(0); },
    // park the free camera on the pavement in front of a shop / lobby door in the district at `ang` degrees
    street: (ang, idx = 0, o = {}) => { const A = (ang * Math.PI) / 180; const c = city.pois.filter((p) => p.doorX !== undefined && p.type !== 'home' && (!o.type || p.type === o.type) && Math.hypot(p.x, p.z) > (o.rmin ?? 800) && Math.hypot(p.x, p.z) < (o.rmax ?? 3200) && Math.abs(((Math.atan2(p.z, p.x) - A + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.22); const p = c[idx % Math.max(1, c.length)]; if (!p) return null; let nx = p.doorX - p.x, nz = p.doorZ - p.z; const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l; const d = o.dir ?? 1; const tx = -nz * d, tz = nx * d; const b = o.back ?? 6; camera.position.set(p.doorX + nx * b - tx * 3, o.h ?? 1.7, p.doorZ + nz * b - tz * 3); camera.lookAt(p.doorX + nx * (b - (o.turn ?? 1)) + tx * 40, o.ty ?? 5, p.doorZ + nz * (b - (o.turn ?? 1)) + tz * 40); return [p.type, p.name, Math.round(p.doorX), Math.round(p.doorZ), c.length]; },
    tp: (x, y, z) => { player.mode = 'foot'; player.pos.set(x, y, z); player.vel.set(0, 0, 0); },
    stats: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, geos: renderer.info.memory.geometries, tex: renderer.info.memory.textures, city: city.stats }),
  };
  env.update(0, camera.position); city.update(camera.position);
  if (engine.probeOn) engine.refreshProbe();
  let last = performance.now();
  const loop = (t) => { const dt = Math.min(0.05, (t - last) / 1000); last = t; if (!window.__manual) step(dt); requestAnimationFrame(loop); };
  if (debug) { window.__manual = true; document.getElementById('boot').style.display = 'none'; }
  requestAnimationFrame(loop);
  step(1 / 60);
  document.getElementById('boot').classList.add('hide');
  window.addEventListener('beforeunload', () => { if (started && !debug) game.save(); });
  window.__ready = true;
}

start().catch((e) => { console.error(e); window.__fatal = String(e && e.stack || e); bootMsg('오류: ' + e.message); });
