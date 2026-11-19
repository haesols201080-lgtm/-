// Nuri: Tiny Explorer — boot, render pipeline, game loop, emotions, save/load, settings.
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { TIERS, defaultTier, isTouch } from './quality.js';
import { Input } from './input.js';
import { Assets } from './assets.js';
import { World } from './world.js';
import { Nuri } from './nuri.js';
import { Player } from './player.js';
import { OrbitCam } from './camera.js';
import { Gameplay } from './gameplay.js';
import { Creatures } from './creatures.js';
import { FX } from './fx.js';
import { Audio } from './audio.js';
import { UI, loadSave, writeSave, loadSettings, writeSettings } from './ui.js';
import { START, STREAM, POND, REGIONS } from './layout.js';
import { WIND } from './shaders.js';
import { clamp, damp, angleDiff } from './util.js';

const DEFAULTS = { master: 0.8, music: 0.45, sfx: 0.85, sens: 1, invertY: false, timeFlow: false, weather: 'clear', quality: null, padMap: null };

async function boot() {
  const ui = new UI();
  const S = { ...DEFAULTS, ...(loadSettings() || {}) };
  if (!S.quality) S.quality = defaultTier();
  const qp = new URLSearchParams(location.search).get('quality');
  if (qp && TIERS[qp]) S.quality = qp;
  const tier = TIERS[S.quality] || TIERS.medium;
  const canvas = document.getElementById('c');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !tier.post && tier.antialias, powerPreference: 'high-performance', stencil: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, tier.maxDpr));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.AgXToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.02, 220);
  // sky + sun
  const sky = new Sky(); sky.scale.setScalar(400); scene.add(sky);
  const su = sky.material.uniforms; su.turbidity.value = 5.5; su.rayleigh.value = 1.35; su.mieCoefficient.value = 0.006; su.mieDirectionalG.value = 0.82;
  const sunDir = new THREE.Vector3();
  const sun = new THREE.DirectionalLight(0xfff1dc, 3.4);
  sun.castShadow = true; sun.shadow.mapSize.set(tier.shadowMap, tier.shadowMap);
  const sr = tier.shadowRange; Object.assign(sun.shadow.camera, { left: -sr, right: sr, top: sr, bottom: -sr, near: 1, far: 90 });
  sun.shadow.bias = -0.00025; sun.shadow.normalBias = 0.025; sun.shadow.radius = 2;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x3a3020, 0.35); scene.add(hemi);
  scene.fog = new THREE.FogExp2(0x9fb3b0, 0.014);
  function setSun(elev, azim) {
    sunDir.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - elev), THREE.MathUtils.degToRad(azim));
    su.sunPosition.value.copy(sunDir);
    const warm = clamp((elev - 8) / 30, 0, 1);
    sun.color.setRGB(1, 0.78 + 0.18 * warm, 0.6 + 0.3 * warm);
  }
  setSun(42, 200);

  ui.progress(0.02, '물리 엔진');
  await RAPIER.init();
  const physics = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  physics.timestep = 1 / 60;
  const assets = new Assets(renderer, tier, (k, l) => ui.progress(0.05 + k * 0.85, l));
  await assets.loadAll();
  scene.environment = assets.tex.envMap; scene.environmentIntensity = 0.75;
  scene.environmentRotation = new THREE.Euler(0, 2.1, 0);

  const ctx = { scene, RAPIER, physics, assets, tier, sunDir, camera, terrain: null };
  ui.progress(0.92, '숲 만들기');
  await new Promise((r) => setTimeout(r, 30));
  const world = new World(ctx); world.build(); ctx.terrain = world.terrain;
  // invisible world bounds
  for (const [x, z, hx, hz] of [[0, 46, 48, 1], [0, -46, 48, 1], [46, 0, 1, 48], [-46, 0, 1, 48]]) physics.createCollider(RAPIER.ColliderDesc.cuboid(hx, 20, hz).setTranslation(x, 5, z)).userData = { kind: 'bound' };

  const nuri = new Nuri(assets.models.nuri);
  scene.add(nuri.root);
  const spawnY = world.terrain.heightAt(START.x, START.z);
  const player = new Player(ctx, nuri, { x: START.x, y: spawnY + 0.02, z: START.z, yaw: START.yaw });
  const input = new Input(canvas);
  const orbit = new OrbitCam(camera, ctx); orbit.set(START.yaw + Math.PI, 0.25);
  const fx = new FX(scene);
  const audio = new Audio();
  const gameplay = new Gameplay(ctx, world, player, ui, audio, fx);
  gameplay.build();
  const creatures = new Creatures(ctx, world, audio);

  // settings
  const applySettings = () => {
    audio.vol = { master: S.master, music: S.music, sfx: S.sfx }; audio.applyVolume();
    input.sens = S.sens; input.invertY = S.invertY;
    if (S.padMap) input.padMap = { ...input.padMap, ...S.padMap };
    writeSettings(S);
  };
  ui.bindSettings(S, applySettings, input); applySettings();

  // post-processing
  let composer = null, bloom = null;
  if (tier.post) {
    const rt = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: tier.msaa });
    composer = new EffectComposer(renderer, rt);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.addPass(new RenderPass(scene, camera));
    if (tier.ao) {
      const ao = new GTAOPass(scene, camera, innerWidth, innerHeight);
      ao.updateGtaoMaterial({ radius: 0.35, distanceExponent: 1.5, thickness: 1, scale: 1, samples: 12 });
      ao.blendIntensity = 0.85; composer.addPass(ao);
    }
    bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.32, 0.55, 0.92);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }
  const resize = () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    composer?.setSize(innerWidth, innerHeight);
    fx.setHeight(innerHeight * renderer.getPixelRatio());
  };
  addEventListener('resize', resize); resize();

  // rain
  const rain = makeRain(scene); rain.visible = false;

  // ------------------------------------------------------------ game state
  const G = { mode: 'title', paused: false, time: 0, playTime: 0, exprT: 0, exprHold: null, tod: 0.35, introT: 0, wokeUp: false, hintStep: 0, lastSaveAt: 0 };
  const save = () => {
    const data = { ...gameplay.save, pos: [player.pos.x, player.pos.y, player.pos.z], yaw: player.yaw, playTime: G.playTime, savedAt: Date.now(),
      checkpoint: player.checkpoint };
    const ok = writeSave(data); G.lastSaveAt = G.time;
    return ok;
  };
  gameplay.onSave = save;
  const startGame = (fromSave) => {
    audio.start();
    if (fromSave) {
      const sv = loadSave();
      if (sv) {
        gameplay.applySave(sv);
        if (sv.checkpoint) player.checkpoint = sv.checkpoint;
        if (sv.pos) { player.teleport(sv.pos[0], sv.pos[1] + 0.05, sv.pos[2]); player.yaw = sv.yaw || 0; }
        G.playTime = sv.playTime || 0; G.wokeUp = true;
      }
    } else {
      writeSave(null);
      G.wokeUp = false; G.introT = 0;
    }
    orbit.set(player.yaw + Math.PI, 0.25);
    G.mode = 'play'; ui.startPlay();
    ui.setShards(gameplay.save.shards.length, gameplay.totalShards); ui.setFriends(gameplay.save.companions.length, gameplay.companions.length);
    // water ambience along the stream + waterfall roar
    if (!G.waterSounds) {
      G.waterSounds = true;
      for (let i = 0; i < STREAM.length; i += 2) { const [x, z] = STREAM[i]; audio.addWaterSource({ x, y: world.terrain.waterY, z }, 0.18, 1); }
      audio.addWaterSource(world.waterfallPos, 0.9, 0.6); audio.addWaterSource({ x: POND.x, y: world.terrain.waterY, z: POND.z }, 0.2, 0.8);
    }
  };
  ui.on('continue', () => startGame(true));
  ui.on('new', () => { location.hash = 'new'; if (loadSave()) { writeSave(null); location.reload(); } else startGame(false); });
  if (location.hash === '#new') { history.replaceState(null, '', location.pathname); }
  const togglePause = () => {
    if (G.mode !== 'play') return;
    G.paused = !G.paused;
    if (G.paused) { document.exitPointerLock?.(); const sv = loadSave(); ui.showPause(sv?.savedAt ? `마지막 저장: ${new Date(sv.savedAt).toLocaleString()}` : '저장된 기록 없음'); }
    else ui.hidePause();
  };
  input.on('pause', togglePause);
  input.on('respawn', () => { if (G.mode === 'play' && !G.paused) player.respawn(); });
  ui.on('resume', togglePause);
  ui.on('save', () => { ui.setSaveInfo(save() ? `저장했어요 · ${new Date().toLocaleTimeString()}` : '저장할 수 없어요 (브라우저 저장소가 막혀 있어요)'); });
  ui.on('load', () => { if (loadSave()) location.reload(); else ui.setSaveInfo('불러올 저장 기록이 없어요'); });
  ui.on('title', () => { save(); location.reload(); });
  addEventListener('beforeunload', () => { if (G.mode === 'play') save(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && G.mode === 'play' && !G.paused) togglePause(); });

  ui.hideLoading();
  ui.showTitle(!!loadSave()?.savedAt);
  player.state = 'sleep'; nuri.setExpression('sleepy');
  if (location.hash === '#autostart' || new URLSearchParams(location.search).has('autostart')) startGame(new URLSearchParams(location.search).has('continue'));

  // ------------------------------------------------------------ emotion & look-at logic
  const setExpr = (name, hold = 0) => { nuri.setExpression(name); if (hold) { G.exprHold = name; G.exprT = hold; } };
  const moodBeep = (m) => audio.play('emote', { mood: m, pos: player.pos, vol: 0.7 });
  function handleEvents() {
    for (const e of player.events) {
      const pp = player.pos;
      switch (e.type) {
        case 'step': {
          const surf = surfaceUnder();
          audio.play('step', { surface: surf, pos: pp, vol: clamp(0.35 + e.speed * 0.25, 0.3, 1), pitch: 0.9 + Math.random() * 0.2 });
          if (e.speed > 1.4 && (surf === 'dirt' || surf === 'leaves')) fx.dust(pp, 3, surf === 'dirt' ? [0.52, 0.44, 0.33] : [0.45, 0.36, 0.24]);
          if (surf === 'water') fx.ring(pp, 0.25);
          break;
        }
        case 'jump': audio.play('jump', { pos: pp }); if (e.water) fx.splash({ x: pp.x, y: world.terrain.waterY, z: pp.z }, 0.5); else fx.dust(pp, 4); break;
        case 'djump': audio.play('djump', { pos: pp }); for (let i = 0; i < 10; i++) fx.exhaust({ x: pp.x, y: pp.y, z: pp.z }); setExpr('excited', 0.8); break;
        case 'land': if (e.impact > 3) { audio.play('land', { pos: pp, vol: clamp(e.impact / 9, 0.3, 1) }); fx.dust(pp, Math.round(clamp(e.impact, 3, 12))); if (e.impact > 8) orbit.shake = 0.6; }
          else audio.play('step', { surface: surfaceUnder(), pos: pp, vol: 0.5 }); break;
        case 'splash': audio.play('splash', { pos: pp, vol: e.strength }); fx.splash({ x: pp.x, y: world.terrain.waterY, z: pp.z }, e.strength); setExpr('surprised', 0.8); moodBeep('surprised'); break;
        case 'swimstroke': audio.play('swim', { pos: pp, vol: 0.6 }); fx.ring({ x: pp.x, y: world.terrain.waterY, z: pp.z }, 0.35); break;
        case 'roll': audio.play('roll', { pos: pp }); setExpr('focused', 0.5); break;
        case 'slide': audio.play('slide', { pos: pp }); setExpr('excited', 0.7); break;
        case 'grab': audio.play('grabledge', { pos: pp }); break;
        case 'climbup': audio.play('jump', { pos: pp, pitch: 0.8 }); break;
        case 'collect': setExpr('joy', 1.0); break;
        case 'discover': setExpr('surprised', 0.9); setTimeout(() => setExpr('excited', 1.8), 900); moodBeep('surprised'); break;
        case 'ability': setExpr('excited', 3); moodBeep('love'); break;
        case 'friend': setExpr('love', 2.2); moodBeep('love'); break;
        case 'solved': setExpr('joy', 2); moodBeep('happy'); break;
        case 'worried': setExpr('worried', 2); moodBeep('worried'); break;
        case 'curious': setExpr('curious', 2.5); moodBeep('curious'); break;
        case 'respawn': setExpr('dizzy', 2); moodBeep('sad'); break;
        case 'inspect': setExpr('curious', 1.4); moodBeep('curious'); break;
        case 'kick': setExpr('excited', 1); break;
      }
    }
    player.events.length = 0;
  }
  function surfaceUnder() {
    const c = player.groundCollider;
    if (player.state === 'swim') return 'water';
    if (c && c.userData?.surface) return c.userData.surface;
    if (c && c.userData?.kind === 'crate') return 'wood';
    const s = world.terrain.surfaceAt(player.pos.x, player.pos.z);
    return s;
  }
  function baseExpression(dt) {
    if (G.exprT > 0) { G.exprT -= dt; return; }
    const st = player.state;
    let e = 'neutral';
    if (st === 'sleep' || player.idleT > 14) e = 'sleepy';
    else if (['swim', 'push', 'climb', 'hang'].includes(st) || player.grab) e = 'focused';
    else if (st === 'hover') e = 'excited';
    else if (G.nearTarget && G.nearTarget.kind === 'creature') e = 'curious';
    else if (G.edgeDanger) e = 'worried';
    else if (Math.hypot(player.vel.x, player.vel.z) > 1.9) e = 'smile';
    nuri.setExpression(e);
  }
  const tmpV = new THREE.Vector3();
  function lookTarget() {
    const head = tmpV.set(player.pos.x, player.pos.y + 0.29, player.pos.z);
    let best = null, bd = 2.4;
    const consider = (p, kind, maxD = 2.4) => {
      const d = head.distanceTo(p); if (d > Math.min(bd, maxD) || d < 0.08) return;
      const yaw = Math.atan2(p.x - head.x, p.z - head.z);
      const dy = angleDiff(player.yaw, yaw);
      if (Math.abs(dy) > 1.7) return;
      bd = d; best = { p, kind, yaw: dy, pitch: Math.atan2(head.y - p.y, Math.hypot(p.x - head.x, p.z - head.z)) };
    };
    for (const s of gameplay.shards) if (!s.got) consider(s.mesh.position, 'shard', 1.8);
    for (const c of creatures.list) consider(c.mesh.position, 'creature', 2.6);
    for (const c of gameplay.companions) consider(c.mesh.position, 'friend', 2.6);
    G.nearTarget = best;
    if (!best) {
      // look toward where we're heading / down when near an edge
      if (G.edgeDanger) return { yaw: 0, pitch: 0.45 };
      return null;
    }
    return { yaw: best.yaw, pitch: best.pitch };
  }
  function edgeCheck() {
    G.edgeDanger = false;
    if (!player.grounded || player.state === 'swim') return;
    const f = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw));
    const o = { x: player.pos.x + f.x * 0.3, y: player.pos.y + 0.2, z: player.pos.z + f.z * 0.3 };
    const h = physics.castRay(new RAPIER.Ray(o, { x: 0, y: -1, z: 0 }), 3, true, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, player.col, player.body);
    G.edgeDanger = !h || h.timeOfImpact > 1.4;
  }
  function footOffsets() {
    if (!player.grounded || !['idle', 'move', 'land', 'push', 'sleep', 'inspect', 'wave'].includes(player.state)) return { off: null, drop: 0 };
    const off = {}; let drop = 0;
    const c = Math.cos(player.yaw), s = Math.sin(player.yaw);
    for (const [k, sx] of [['L', 0.036], ['R', -0.036]]) {
      const x = player.pos.x + sx * c + 0.012 * s, z = player.pos.z - sx * s + 0.012 * c;
      const h = physics.castRay(new RAPIER.Ray({ x, y: player.pos.y + 0.12, z }, { x: 0, y: -1, z: 0 }), 0.3, true, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, player.col, player.body);
      const gy = h ? player.pos.y + 0.12 - h.timeOfImpact : player.pos.y;
      off[k] = clamp(gy - player.pos.y, -0.035, 0.035);
      drop = Math.min(drop, off[k]);
    }
    return { off, drop };
  }

  // ------------------------------------------------------------ loop
  const clock = new THREE.Clock();
  let acc = 0, fpsT = 0, frames = 0;
  const STEP = 1 / 60;
  const hints = [[3, '이동: ' + (isTouch ? '왼쪽 화면을 드래그' : 'WASD · 카메라: 마우스')], [9, '점프: ' + (isTouch ? '점프 버튼' : 'Space (길게 누르면 더 높이)')], [16, '숙이기 버튼으로 구르기 · 낮은 곳 기어가기']];
  function frame() {
    requestAnimationFrame(frame);
    let dt = Math.min(clock.getDelta(), 0.1);
    G.time += dt;
    input.update(dt);
    const playing = G.mode === 'play' && !G.paused;
    if (playing) {
      G.playTime += dt;
      // intro: wake up on first input
      if (!G.wokeUp) {
        G.introT += dt;
        const m = input.getMove();
        if (G.introT > 1.2 && (Math.hypot(m.x, m.y) > 0.1 || input.pressed.size)) {
          G.wokeUp = true; player.state = 'idle'; player.idleT = 0;
          setExpr('surprised', 1); setTimeout(() => setExpr('curious', 2), 1000); moodBeep('surprised');
        } else { player.state = 'sleep'; }
      } else {
        for (const [t, msg] of hints) if (G.hintStep < hints.length && hints[G.hintStep] === hints.find((h) => h[1] === msg) && G.playTime > t && !loadSave()?.regions?.length) { ui.toast(msg); G.hintStep++; break; }
      }
      if (G.wokeUp) {
        if (input.wasPressed('interact')) gameplay.interact(player);
        if (input.wasPressed('emote')) { player.playAction('wave', 1.2); setExpr('smile', 1.4); moodBeep('happy'); }
      }
      acc += dt;
      let steps = 0;
      while (acc >= STEP && steps < 4) {
        if (G.wokeUp) player.update(STEP, input, orbit.yaw, gameplay);
        else { player.vel.set(0, 0, 0); }
        physics.step();
        input.pressed.clear();
        acc -= STEP; steps++;
      }
      if (steps === 4) acc = 0;
      gameplay.update(dt, G.time);
      handleEvents();
      edgeCheck();
      baseExpression(dt);
    }
    // animation + model transform
    nuri.root.position.copy(player.pos);
    nuri.root.rotation.y = player.yaw;
    const fo = footOffsets();
    const params = player.animParams(G.mode === 'play' ? lookTarget() : null);
    params.footOffset = fo.off; params.groundDrop = fo.drop;
    const windV = new THREE.Vector3(WIND.dir.value.x, 0, WIND.dir.value.y).multiplyScalar(2.2 * WIND.strength.value);
    nuri.update(dt, params, { wind: windV });
    if (player.state === 'hover' || nuri.jetPower > 0.3) for (const j of nuri.jets) fx.exhaust(j.getWorldPosition(tmpV));
    audio.setLoop('hover', player.state === 'hover' ? 0.18 : 0, player.pos);
    // camera
    if (G.mode === 'title') {
      const t = G.time * 0.08;
      camera.position.set(player.pos.x + Math.sin(t) * 1.2, player.pos.y + 0.45, player.pos.z + Math.cos(t) * 1.2);
      camera.lookAt(player.pos.x, player.pos.y + 0.2, player.pos.z);
    } else if (!G.paused) orbit.update(dt, input, player);
    // world + effects
    world.update(dt, G.time, camera.position, player.pos);
    creatures.update(dt, G.time, player, gameplay.caveCenter);
    fx.update(dt);
    audio.setListener(camera);
    const inCave = gameplay.caveCenter && player.pos.distanceTo(gameplay.caveCenter) < 2.6 && player.pos.y < gameplay.caveCenter.y + 1.2 ? 1 : 0;
    audio.updateAmbience(dt, player.pos, S.weather === 'rain' ? 1.4 : 1, inCave);
    // time of day / weather
    if (S.timeFlow) G.tod = (G.tod + dt / 900) % 1;
    const elev = S.timeFlow ? 14 + Math.sin(G.tod * Math.PI) * 46 : 42, azim = S.timeFlow ? 120 + G.tod * 140 : 200;
    setSun(elev, azim);
    const rainK = G.rainK = damp(G.rainK || 0, S.weather === 'rain' ? 1 : 0, 0.6, dt);
    sun.intensity = (1.1 + 2.5 * clamp(elev / 40, 0, 1)) * (1 - rainK * 0.75);
    hemi.intensity = 0.3 + rainK * 0.2;
    su.turbidity.value = 5.5 + rainK * 12; su.rayleigh.value = 1.35 + rainK * 2;
    scene.fog.density = 0.012 + rainK * 0.03;
    scene.fog.color.setRGB(0.6 - rainK * 0.2, 0.68 - rainK * 0.22, 0.66 - rainK * 0.2);
    scene.environmentIntensity = 0.75 - rainK * 0.35;
    world.terrain.material.userData.uniforms.uWet.value = rainK;
    world.shaftMat.uniforms.uI.value = 1 - rainK;
    WIND.strength.value = 1 + rainK * 0.8;
    rain.visible = rainK > 0.02; if (rain.visible) updateRain(rain, camera, G.time, rainK);
    // shadow camera follows the player (snapped to texels to avoid shimmering)
    const tgt = player.pos;
    const texel = (2 * sr) / tier.shadowMap;
    const sx = Math.round(tgt.x / texel) * texel, sz = Math.round(tgt.z / texel) * texel;
    sun.target.position.set(sx, tgt.y, sz);
    sun.position.set(sx + sunDir.x * 40, tgt.y + sunDir.y * 40, sz + sunDir.z * 40);
    // HUD prompt
    if (G.mode === 'play' && !G.paused) ui.setPrompt(G.wokeUp ? gameplay.prompt(player) : null, input.usingPad);
    // autosave every 60 s
    if (G.mode === 'play' && G.time - G.lastSaveAt > 60) save();
    if (composer) composer.render(); else renderer.render(scene, camera);
    frames++; fpsT += dt;
    if (fpsT > 1) { window.__fps = frames / fpsT; frames = 0; fpsT = 0; }
  }
  frame();
  // debug / test hooks
  window.__game = { player, gameplay, world, nuri, orbit, input, G, scene, camera, renderer, physics, startGame, ui, audio };
}

function makeRain(scene) {
  const N = 2200, g = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 6), seed = new Float32Array(N * 6);
  for (let i = 0; i < N; i++) {
    const x = Math.random(), y = Math.random(), z = Math.random();
    for (let k = 0; k < 2; k++) { seed.set([x, y, z], i * 6 + k * 3); pos.set([0, k ? 0 : 1, 0], i * 6 + k * 3); }
  }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('seed', new THREE.BufferAttribute(seed, 3));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uCam: { value: new THREE.Vector3() }, uTime: { value: 0 }, uK: { value: 1 } },
    vertexShader: `attribute vec3 seed; uniform vec3 uCam; uniform float uTime; varying float vA;
      void main(){ float R = 7.0; vec3 p = uCam + vec3((seed.x-0.5)*2.0*R, 0.0, (seed.z-0.5)*2.0*R);
        p.y = uCam.y + 5.0 - mod(seed.y * 10.0 + uTime * 7.0, 10.0) + position.y * 0.22;
        p.x += position.y * 0.03; vA = 0.35; gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }`,
    fragmentShader: `uniform float uK; varying float vA; void main(){ gl_FragColor = vec4(0.75,0.8,0.85, vA * uK); }`,
  });
  const l = new THREE.LineSegments(g, m); l.frustumCulled = false; scene.add(l); return l;
}
function updateRain(r, cam, t, k) { r.material.uniforms.uCam.value.copy(cam.position); r.material.uniforms.uTime.value = t; r.material.uniforms.uK.value = k; }

boot().catch((e) => {
  console.error(e);
  const t = document.getElementById('loadtxt'); if (t) t.textContent = '불러오기에 실패했어요: ' + e.message;
});
