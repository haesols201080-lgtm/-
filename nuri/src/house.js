// Chapter 2 — 거인의 집 (the giant's home). The stranger who took Seven from the forest drives it to New York, to a
// detached house in the outer boroughs, and leaves it shut in the picnic basket on the bedroom dresser; then goes to
// sleep. Seven gets out of the basket, down from the dresser and out of the room without waking the sleeper, down the
// stairs, through the kitchen to the back door, and out through the cat flap into the backyard - and over the fence,
// across the water, Manhattan. (The city itself is the next chapter.)
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { isTouch } from './quality.js';
import { Input } from './input.js';
import { Assets } from './assets.js';
import { Nuri } from './nuri.js';
import { Player } from './player.js';
import { OrbitCam } from './camera.js';
import { Director } from './cutscene.js';
import { FX } from './fx.js';
import { Audio } from './audio.js';
import { loadSave, writeSave, writeSettings } from './ui.js';
import { HOUSE, CAR, CHAPTER2, LOG, MEMORY } from './story.js';
import { RELICS } from './relics.js';
import { makeGradePass, makeContactShadow } from './post.js';
import { makeCarRide } from './carride.js';
import { Flat, FLAT } from './flat.js';
import { Cat } from './cat.js';
import { clamp, damp, angleDiff } from './util.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
// the robot's footsteps by what it is walking on (src/flat.js names the surface of each piece of the house), and how
// loud each is to a light sleeper: a rug or the bedding next to nothing, the washer's enamel top like a drum
const STEP = { fabric: 'cloth', glass: 'stone', rock: 'stone', moss: 'grass', leaves: 'grass', dirt: 'grass' };
const LOUD = { rug: 0.35, cloth: 0.3, grass: 0.4, paper: 0.6, lino: 0.8, floor: 1, wood: 1, tread: 1.2, stone: 1.1, plastic: 1.1, metal: 1.4, panel: 1.7 };
const rnd = (a, b) => a + Math.random() * (b - a);

export async function bootHouse({ ui, S, tier, renderer, RAPIER }) {
  document.body.classList.add('house');
  const sub = document.querySelector('.ld-sub'); if (sub) sub.textContent = '2장 · 거인의 집';
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.02, 520);
  renderer.toneMappingExposure = 1.05;
  const physics = new RAPIER.World({ x: 0, y: -9.81, z: 0 }); physics.timestep = 1 / 60;
  const assets = new Assets(renderer, tier, (k, l) => ui.progress(0.05 + k * 0.85, l));
  await assets.loadHouse();
  scene.environment = assets.tex.envMap; scene.environmentIntensity = 0.32;
  scene.background = new THREE.Color(0x05070d);                 // (the night sky is a dome in nyc.js; the HDRI lights and reflects)
  const ctx = { scene, RAPIER, physics, assets, tier, camera, renderer, terrain: null };
  ui.progress(0.93, '거인의 집');
  const flat = new Flat(ctx, assets).build(); ctx.terrain = flat.terrain();
  const nuri = new Nuri(assets.models.nuri); scene.add(nuri.root);
  const B = flat.basket;
  const player = new Player(ctx, nuri, { x: B.floor.x, y: B.floor.y + 0.02, z: B.floor.z, yaw: 0.3 });
  const input = new Input(renderer.domElement);
  const orbit = new OrbitCam(camera, ctx); orbit.set(Math.PI + 0.3, 0.35);
  const fx = new FX(scene), audio = new Audio({ place: 'house' }), director = new Director({ camera, ui });
  audio.setLayout(FLAT);
  // the cat, asleep on its bed by the kitchen radiator; its bolt-hole: across the kitchen, the hall, round through the
  // living room and up the cat tree by the front window
  const V3 = (x, y, z, leap) => Object.assign(new THREE.Vector3(x, y, z), leap ? { leap: true } : {});
  const cat = assets.models.h_cat ? new Cat(scene, assets.models.h_cat, { tier, audio,
    bed: { pos: V3(0.72, 0.085, 3.38), yaw: 2.3 },
    path: [V3(0.45, 0, 2.6), V3(0.95, 0, 1.35), V3(1.75, 0, 0.7), V3(2.6, 0, 0.1), V3(2.45, 0, -1.6), V3(1.2, 0, -1.8), V3(0.2, 0, -1.7), V3(0.55, 0, -2.6), V3(0.9, 1.46, -3.6, true)],
    perch: { pos: V3(0.9, 1.46, -3.6), yaw: -0.46 } }) : null;
  physics.step();
  // the robot's face screen lights its surroundings a little in the dark
  const faceLight = new THREE.PointLight(0x5fe6ff, 0.45, 1.1, 2); faceLight.position.set(0, 0.29, 0.14); nuri.root.add(faceLight);
  const contact = makeContactShadow(); scene.add(contact);
  // ---------------------------------------------------------------- post
  const makeComposer = (sc, cam) => {
    if (!tier.post) return null;
    const rt = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: tier.msaa });
    const c = new EffectComposer(renderer, rt); c.setPixelRatio(renderer.getPixelRatio());
    c.addPass(new RenderPass(sc, cam));
    if (tier.ao && sc === scene) {   // contact shadows in the corners, under the furniture, along the skirting
      const ao = new GTAOPass(sc, cam, innerWidth, innerHeight);
      ao.updateGtaoMaterial({ radius: 0.25, distanceExponent: 1.5, thickness: 0.6, scale: 1, samples: 12 });
      ao.blendIntensity = 0.9; c.addPass(ao);
    }
    if (tier.bloom) c.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.55, 0.6, 0.85));
    c.addPass(new OutputPass()); const g = makeGradePass(); c.addPass(g); c.grade = g;
    return c;
  };
  const composer = makeComposer(scene, camera);
  if (!tier.post) document.body.classList.add('css-vignette');
  let ride = null, rideComposer = null;
  const resize = () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight);
    for (const c of [composer, rideComposer]) if (c) { c.setSize(innerWidth, innerHeight); c.grade?.uniforms.uRes.value.set(innerWidth * renderer.getPixelRatio(), innerHeight * renderer.getPixelRatio()); }
    ride?.resize(); fx.setHeight(innerHeight * renderer.getPixelRatio());
  };
  addEventListener('resize', resize);

  // ---------------------------------------------------------------- state & save
  const G = { mode: 'title', paused: false, time: 0, playTime: 0, exprT: 0, noise: 0, wake: 0, lampT: 0, checkpoint: null };
  const base = loadSave() || {};
  const st = Object.assign({ lidOpen: false, flapOpen: false, done: [], arrived: false }, base.flat || {});
  player.abilities.booster = base.booster !== false;
  player.abilities.dash = (base.unlocks || []).includes('dash');
  const save = () => {
    const data = { ...(loadSave() || base), chapter: 2, flat: st, pos: [player.pos.x, player.pos.y, player.pos.z], yaw: player.yaw, playTime: G.playTime, savedAt: Date.now() };
    const ok = writeSave(data); G.lastSave = G.time; return ok;
  };
  // ---------------------------------------------------------------- what the robot can do here
  const notes = flat.notes;
  const play = {
    props: [], zones: [],
    dropCarry() {}, updateGrab(p) { p.grab = null; }, pushCrate() {}, tryClimbStart() {},
    items() {
      const L = [];
      if (!st.lidOpen) L.push({ pos: B.floor.clone().add(V(0, 0.1, 0)), r: 0.42, label: '뚜껑 밀어 올리기', act: pushLid });
      if (!st.flapOpen) L.push({ pos: flat.flap.lockPos, r: 0.5, label: '고양이 문 잠금 풀기', act: unlockFlap });
      for (const n of notes) L.push({ pos: n.at, r: n.r, label: '살펴보기', act: () => { ui.bubble('세븐', n.text); player.emit('inspect'); } });
      return L;
    },
    nearest(p) {
      let best = null, bd = 1e9;
      for (const it of this.items()) { const d = it.pos.distanceTo(p.pos); if (d < it.r && d < bd) { bd = d; best = it; } }
      return best;
    },
    interact(p) { const it = this.nearest(p); if (it) it.act(); },
    prompt(p) { return this.nearest(p)?.label || null; },
  };
  function pushLid() {
    B.pushes = (B.pushes || 0) + 1; B.jolt = 0.22 + B.pushes * 0.06;
    audio.play('wicker', { pos: B.floor, vol: 0.9 }); audio.play('thud', { pos: B.floor, vol: 0.22, pitch: 1.7 }); makeNoise(0.32);
    player.playAction('throw', 0.35);
    if (B.pushes === 1) ui.toast('뚜껑이 조금 들렸다. 무겁다.');
    if (B.pushes >= 3) { st.lidOpen = true; physics.removeCollider(flat.lidCol, true); audio.play('wickerBig', { pos: B.floor, vol: 0.9 }); makeNoise(0.28); save(); }
  }
  function unlockFlap() {
    st.flapOpen = true; physics.removeCollider(flat.flapCol, true);
    audio.play('latch', { pos: flat.flap.lockPos, vol: 0.8 }); ui.toast('잠금쇠가 미끄러졌다. 숙이면 지나갈 수 있다.'); player.emit('solved'); save();
  }
  // ---------------------------------------------------------------- the sleeper
  const inBedroom = () => player.pos.y > FLAT.U - 0.4 && player.pos.x < FLAT.part + 0.1 && player.pos.z < FLAT.kz;
  const upstairs = () => player.pos.y > FLAT.U - 0.4;
  function makeNoise(k) { G.noise += k * (inBedroom() ? 1 : upstairs() ? 0.5 : 0.15); }
  function updateSleeper(dt) {
    G.noise = Math.max(0, G.noise - dt * 0.22);
    // the snore every breath (when settled)
    G.breathT = (G.breathT || 0) + dt;
    // (heard through the bedroom door and down the stairs as the rooms let it: src/audio.js)
    if (G.breathT > 4.2) { G.breathT = rnd(-0.3, 0.3); if (G.lampT <= 0 && flat.sleeper.stir < 0.3) audio.play('snore', { pos: flat.sleeper.head, vol: 0.85, verb: 0.15, ref: 0.8 }); }
    if (G.lampT > 0) {
      G.lampT -= dt;
      flat.bedLamp.intensity = damp(flat.bedLamp.intensity, G.lampT > 0.4 ? 9 : 0, 10, dt); flat.bedLamp.castShadow = flat.bedLamp.intensity > 0.05;
      // the sleeper is looking: anything moving in the bedroom is seen
      if (G.lampT < 3.4 && G.lampT > 0.5 && inBedroom() && Math.hypot(player.vel.x, player.vel.z) > 0.12) caught();
      if (G.lampT <= 0) { audio.play('lamp', { pos: flat.bedLamp.position }); audio.play('rustle', { pos: flat.sleeper.head, vol: 0.5, at: 0.5 }); flat.bedLamp.intensity = 0; flat.bedLamp.castShadow = false; ui.bubble('낯선 사람', '…꿈인가.'); }
      return;
    }
    if (G.noise > 1.2) {
      G.noise = 0.4; G.lampT = 4.6; flat.sleeper.stir = 1;
      audio.play('rustle', { pos: flat.sleeper.head, vol: 0.8 }); audio.play('bedCreak', { pos: flat.sleeper.head, vol: 0.6 }); audio.play('lamp', { pos: flat.bedLamp.position, at: 0.7 });
      ui.bubble('낯선 사람', '…응? 뭐야?'); setExpr('worried', 4); ui.toast('불이 켜졌다! 움직이지 마.');
    } else if (G.noise > 0.65 && flat.sleeper.stir < 0.2) {
      flat.sleeper.stir = 1; audio.play('rustle', { pos: flat.sleeper.head, vol: 0.7 }); audio.play('bedCreak', { pos: flat.sleeper.head, vol: 0.5, at: 0.3 }); audio.play('mumble', { pos: flat.sleeper.head, vol: 0.8, at: 0.9 });
      ui.toast('거인이 뒤척인다…'); setExpr('worried', 2);
    }
  }
  function caught() {
    G.lampT = 0.4;
    ui.bubble('낯선 사람', '어? 너 왜 거기 있어…?');
    ui.fadeOut(1100, () => {
      const c = G.checkpoint || { x: B.floor.x, y: B.floor.y + 0.02, z: B.floor.z };
      player.teleport(c.x, c.y + 0.05, c.z); player.vel.set(0, 0, 0); G.noise = 0; flat.bedLamp.intensity = 0; G.lampT = 0;
      ui.toast('거인이 잠결에 집어서 제자리에 돌려놓았다. 더 조용히.');
    });
  }
  // ---------------------------------------------------------------- goals
  const QS = [
    { id: 'lid', title: '바구니 속', text: '뚜껑을 밀어 올리기', done: () => st.lidOpen, target: () => B.floor },
    { id: 'down', title: '서랍장 위', text: '의자를 딛고 바닥으로 내려가기', done: () => st.lidOpen && player.pos.y < FLAT.U + 0.1 && player.grounded, target: () => flat.chairSeat },
    { id: 'door', title: '잠든 거인', text: '깨우지 않게 방을 빠져나가기', done: () => player.pos.x > FLAT.part + 0.25 && upstairs(), target: () => flat.doorGap, log: 'room' },
    { id: 'stairs', title: '계단', text: '한 칸씩 계단 내려가기', done: () => player.pos.y < 0.25 && player.grounded, target: () => (player.pos.z < FLAT.stair.zTop ? flat.stairTop : flat.stairBottom), log: 'stairs' },
    { id: 'kitchen', title: '부엌', text: '부엌 뒷문 찾기', done: () => player.pos.distanceTo(flat.flap.pos) < 1.0, target: () => flat.flap.pos, log: 'living' },
    { id: 'flap', title: '고양이 문', text: '고양이 문 잠금 풀기', done: () => st.flapOpen, target: () => flat.flap.lockPos },
    { id: 'out', title: '바깥', text: '숙여서 고양이 문으로 나가기', done: () => player.pos.z > FLAT.z1 + 0.6, target: () => flat.yardLook },
  ];
  const quest = { cur: null, peekT: 9, el: document.getElementById('qmarker'), elD: document.getElementById('qmarker-d'), v: V(0, 0, 0) };
  const activeQ = () => QS.find((q) => !st.done.includes(q.id)) || null;
  function refreshQuest(isNew) {
    const q = activeQ();
    if (!q) { ui.setQuest(null); return; }
    ui.setQuest({ title: q.title, text: q.text, prog: null, step: QS.indexOf(q) + 1, total: QS.length }, isNew);
    if (isNew) { quest.peekT = 8; if (q.log && HOUSE[q.log]) setTimeout(() => ui.bubble('세븐', HOUSE[q.log]), 2400); }
  }
  function updateQuest(dt) {
    for (const q of QS) if (!st.done.includes(q.id) && q.done()) {
      st.done.push(q.id); ui.questDone(q.title); audio.play('quest');
      G.checkpoint = { x: player.pos.x, y: player.pos.y, z: player.pos.z };
      refreshQuest(true); save();
      if (q.id === 'out') { ui.bubble('세븐', HOUSE.yard); ending(); }
    }
    quest.peekT = Math.max(0, quest.peekT - dt);
    const vis = quest.peekT > 0 || player.idleT > 5;
    document.getElementById('quest').classList.toggle('tucked', !vis);
    const q = activeQ(), tgt = q && !director.active ? q.target() : null;
    if (!tgt || S.guide === false || !vis) { quest.el.classList.add('hidden'); return; }
    const d = tgt.distanceTo(player.pos);
    if (d < 0.9) { quest.el.classList.add('hidden'); return; }
    quest.el.classList.remove('hidden');
    const p = quest.v.set(tgt.x, tgt.y + 0.3, tgt.z).project(camera), W = innerWidth, H = innerHeight;
    let x = (p.x * 0.5 + 0.5) * W, y = (-p.y * 0.5 + 0.5) * H; if (p.z > 1) { x = W - x; y = H - y; }
    x = clamp(x, 46, W - 46); y = clamp(y, 86, H - 46);
    quest.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`; quest.elD.textContent = d.toFixed(1) + 'm';
  }
  // ---------------------------------------------------------------- expressions & events
  const setExpr = (name, hold = 0) => { nuri.setExpression(name); if (hold) G.exprT = hold; };
  const moodBeep = (m) => audio.play('emote', { mood: m, pos: player.pos, vol: 0.5 });
  const tmp = V(0, 0, 0);
  function handleEvents() {
    for (const e of player.events) {
      const gs = player.groundCollider?.userData?.surface || 'floor', pp = player.pos, sf = STEP[gs] || gs, loud = LOUD[sf] ?? 1;
      switch (e.type) {
        case 'step': audio.play('step', { surface: sf, pos: pp, vol: clamp(0.3 + e.speed * 0.2, 0.25, 0.8) }); if (e.speed > 1.2) makeNoise(0.03 * loud); break;
        case 'jump': audio.play('jump', { pos: pp, vol: 0.7 }); break;
        case 'djump': audio.play('djump', { pos: pp }); for (let i = 0; i < 8; i++) fx.exhaust({ x: pp.x, y: pp.y, z: pp.z }); makeNoise(0.08); break;
        case 'dash': audio.play('djump', { pos: pp, pitch: 1.25 }); makeNoise(0.1); break;
        case 'land': audio.play(e.impact > 3 ? 'land' : 'step', { surface: sf, pos: pp, vol: clamp(e.impact / 8, 0.3, 1) }); if (e.impact > 3.2) makeNoise((e.impact - 3.2) * 0.22 * loud); if (e.impact > 6) fx.dust(pp, 6, [0.5, 0.47, 0.42]); break;
        case 'roll': audio.play('roll', { pos: pp }); makeNoise(0.06); break;
        case 'solved': setExpr('joy', 2); moodBeep('happy'); break;
        case 'inspect': setExpr('curious', 1.6); moodBeep('curious'); break;
      }
    }
    player.events.length = 0;
  }
  function baseExpression(dt) {
    if (G.exprT > 0) { G.exprT -= dt; return; }
    let e = 'neutral';
    if (G.lampT > 0) e = 'worried'; else if (player.idleT > 16) e = 'sleepy'; else if (Math.hypot(player.vel.x, player.vel.z) > 1.2) e = 'focused';
    nuri.setExpression(e);
  }
  function footOffsets() {
    if (!player.grounded || !['idle', 'move', 'land', 'push', 'inspect', 'wave'].includes(player.state)) return { off: null, drop: 0 };
    const off = {}; let drop = 0; const c = Math.cos(player.yaw), s = Math.sin(player.yaw);
    for (const [k, sx] of [['L', 0.036], ['R', -0.036]]) {
      const x = player.pos.x + sx * c + 0.012 * s, z = player.pos.z - sx * s + 0.012 * c;
      const h = physics.castRay(new RAPIER.Ray({ x, y: player.pos.y + 0.12, z }, { x: 0, y: -1, z: 0 }), 0.3, true, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, player.col, player.body);
      const gy = h ? player.pos.y + 0.12 - h.timeOfImpact : player.pos.y; off[k] = clamp(gy - player.pos.y, -0.035, 0.035); drop = Math.min(drop, off[k]);
    }
    return { off, drop };
  }

  // ---------------------------------------------------------------- the ride, the arrival, the end of the chapter
  function startRide(onDone) {
    G.mode = 'ride';
    ride = makeCarRide(renderer, assets); rideComposer = makeComposer(ride.scene, ride.camera); resize();
    audio.mood = 'forest'; audio.carEngine(20, 1); audio.play('carDoor', { vol: 0.7 });
    const shown = new Set(), once = new Set(), R = { joint: 3 };
    const at = (t, f) => { if (ride.t > t && !once.has(t)) { once.add(t); f(); } };
    G.rideTick = (dt) => {
      const ph = ride.update(dt);
      // the car: its engine and tyres with the road speed, the joints in the highway and the bridge (the basket creaks
      // with each), the bridge's steel deck, the city's sirens and horns, a bus, the handbrake and the engine off
      audio.carEngine(ride.done ? 0 : ride.speed, ride.done ? 0 : 1); audio.carGrate(ph === 2);
      if ((R.joint -= dt) <= 0) { R.joint = ph === 2 ? rnd(1.1, 1.8) : rnd(2.5, 5.5); if (ph === 1 || ph === 2) { audio.play('joint', { vol: ph === 2 ? 0.55 : 0.4 }); if (Math.random() < 0.6) audio.play('wicker', { vol: 0.3, at: 0.06 }); } }
      at(22.5, () => audio.play('siren', { vol: 0.45, pitch: 1.03 })); at(25.5, () => audio.play('horn', { vol: 0.35 }));
      at(29.2, () => audio.play('airBrake', { vol: 0.3 })); at(31.0, () => audio.play('horn', { vol: 0.2 }));
      for (const [t, line] of CAR.lines) if (ride.t > t && !shown.has(t)) { shown.add(t); if (typeof line === 'string') ui.bubble('세븐', line); else ui.bubble(line[0], line[1]); }
      if (ph === 2 && Math.floor(ride.t * 1.4) % 2 === 0 && ride.t > 28 && !G.blink) { G.blink = true; audio.play('blinker', { vol: 0.6 }); setTimeout(() => { G.blink = false; }, 720); }
      if (ride.done && !G.rideEnd) { G.rideEnd = true; audio.play('handbrake', { vol: 0.5 }); audio.play('engineOff', { vol: 0.6, at: 0.6 }); ui.fadeOut(1400, () => { G.rideTick = null; audio.carEngine(0, 0); onDone(); }); }
    };
    document.body.classList.add('cutscene'); document.getElementById('hud').classList.remove('hidden');   // (lines show as bubbles over the ride)
    ui.story([CAR.title], null, { hold: 2600 });
  }
  function arrive(then) {
    // heard in the dark of the basket: the car door, footsteps up the stairs, a key, the stranger's voice, a lamp
    G.mode = 'arrive';
    document.getElementById('weave').classList.add('on');
    // (all heard from inside the basket as the stranger carries it: their door and the back door, the drive, the porch
    // steps, the keys and the deadbolt, the front door, the stairs, the bedroom, the basket set down, the lamp, the bed)
    audio.setMusic(0.25, 1.5);
    const P = (name, vol, o = {}) => () => audio.play(name, { vol, ...o });
    const walk = (name, t0, n, dt, vol) => Array.from({ length: n }, (_, i) => [t0 + i * dt + rnd(-0.03, 0.03), P(name, vol * rnd(0.85, 1))]);
    const seq = [[0.2, P('carDoor', 0.8)], [1.0, P('carDoor', 0.5)], [1.4, P('wicker', 0.9)], [1.6, P('wicker', 0.6)], [2.3, P('carDoor', 0.55)],
      ...walk('bootConcrete', 2.0, 5, 0.52, 0.55), ...walk('bootPorch', 4.7, 3, 0.5, 0.65), [5.6, P('wicker', 0.4)],
      [6.3, P('keys', 0.6)], [7.0, P('lock', 0.7)], [7.8, P('doorOpen', 0.6)],
      [8.2, () => ui.bubble(HOUSE.arrive[0][0], HOUSE.arrive[0][1])], ...walk('bootFloor', 8.6, 2, 0.5, 0.55), [9.6, P('doorShut', 0.7)],
      ...walk('bootStair', 10.2, 8, 0.38, 0.5), [13.4, P('doorOpen', 0.3)], ...walk('bootFloor', 13.9, 2, 0.5, 0.45), [14.9, P('wicker', 0.9)], [15.0, P('thud', 0.25, { pitch: 1.6 })],
      [15.6, () => ui.bubble(HOUSE.arrive[1][0], HOUSE.arrive[1][1])], [18.6, P('lamp', 0.9)], [19.3, P('rustle', 0.6)], [19.6, P('bedCreak', 0.5)],
      [20.4, () => { document.getElementById('weave').classList.remove('on'); then(); }]];
    for (const [t, f] of seq) setTimeout(f, t * 1000);
  }
  function startPlay(fromSave) {
    G.mode = 'play'; ui.startPlay(); document.body.classList.remove('cutscene');
    if (fromSave && base.pos && base.flat?.arrived) { player.teleport(base.pos[0], base.pos[1] + 0.05, base.pos[2]); player.yaw = base.yaw || 0; G.playTime = base.playTime || 0; }
    st.arrived = true;
    // the house at night: its sources and the city, the music softer (and the car's engine certainly off)
    audio.carEngine(0, 0); audio.mood = 'house';
    audio.startHouse({ fridge: V(FLAT.x0 + 0.4, 0.9, 0.66), chime: V(FLAT.x0 + 0.5, 1.3, -2.65), flap: flat.flap.pos, street: { z: -17 },
      clocks: [{ kind: 'tickMantel', pos: V(FLAT.x0 + 0.5, 1.3, -2.65), gain: 0.4 }, { kind: 'tickQuartz', pos: V(-0.85, 2.2, FLAT.z1 - 0.05), gain: 0.22 }, { kind: 'tickAlarm', pos: V(-4.5, FLAT.U + 0.62, FLAT.kz - 0.62), gain: 0.28 }],
      radiators: [V(-2.6, 0.35, FLAT.z0 + 0.12), V(-2.6, FLAT.U + 0.35, FLAT.z0 + 0.12), V(FLAT.x1 - 0.12, 0.35, -3.3), V(0.7, 0.35, FLAT.z1 - 0.12)] });
    if (st.lidOpen) { physics.removeCollider(flat.lidCol, true); B.open = 1; }
    if (st.flapOpen) physics.removeCollider(flat.flapCol, true);
    G.checkpoint = { x: player.pos.x, y: player.pos.y, z: player.pos.z };
    orbit.set(player.yaw + Math.PI, 0.3);
    ui.setShards((base.shards || []).length, 30); ui.setFriends((base.companions || []).length, 3);
    refreshQuest(false); quest.peekT = 9;
    if (!fromSave || !base.flat?.arrived) setTimeout(() => ui.bubble('세븐', HOUSE.wake), 1200);
    save();
  }
  function ending() {
    // out on the deck: the camera rises over the backyard fence, and there across the water is Manhattan
    const P = player.pos.clone(), sp = V(-16, 30, 330);                 // (the skyline is drawn at a fifth of its distance)
    director.play([
      // Seven out on the deck, its face lit by its own screen, looking out
      { dur: 4.2, from: P.clone().add(V(0.45, 0.3, 0.75)), to: P.clone().add(V(0.35, 0.27, 0.6)), lookFrom: P.clone().add(V(0, 0.27, 0)), fov: 46 },
      // behind it the camera rises over the backyard fence: across the water, Manhattan
      { dur: 7, from: P.clone().add(V(-0.25, 0.35, -0.55)), to: V(P.x - 0.3, FLAT.yard.y + 3.4, FLAT.z1 + 7.5), lookFrom: P.clone().add(V(0, 0.3, 1.0)), lookTo: sp, fov: 46 },
      { dur: 6, from: V(P.x - 0.3, FLAT.yard.y + 3.4, FLAT.z1 + 7.5), to: V(P.x - 0.6, FLAT.yard.y + 3.8, FLAT.z1 + 8.2), lookFrom: sp, lookTo: sp.clone().add(V(-120, -40, 0)), fov: 40 },
    ], { onDone: () => {
      ui.story(CHAPTER2, () => {
        st.ended = true; save();
        ui.story(['2장 끝 — 다음 장 「거인의 도시」에서 계속'], () => { const u = new URL(location.href); u.searchParams.delete('go'); location.href = u.toString(); }, { hold: 3200 });
      }, { hold: 4200 });
    } });
  }

  // ---------------------------------------------------------------- title, pause, settings
  const applySettings = () => { input.sens = S.sens; input.invertY = S.invertY; audio.vol = { master: S.master, music: S.music, sfx: S.sfx }; audio.applyVolume(); writeSettings(S); };
  ui.bindSettings(S, applySettings, input); applySettings();
  const begin = (fromSave) => {
    audio.start();
    if (fromSave && base.flat?.arrived) startPlay(true);
    else startRide(() => arrive(() => startPlay(false)));
  };
  ui.on('continue', () => begin(true));
  ui.on('new', () => { writeSave(null); const u = new URL(location.href); u.search = ''; location.href = u.toString(); });
  const togglePause = () => {
    if (G.mode !== 'play') return;
    G.paused = !G.paused;
    if (G.paused) {
      document.exitPointerLock?.(); const q = activeQ();
      ui.showPause(G.lastSave ? '자동 저장됨' : '', { quest: q ? { title: q.title, text: q.text, prog: '' } : null,
        lines: [['장소', '거인의 집 · 도시'], ['동력 결정', `${(base.shards || []).length} / 30`], ['찾은 동료', `${(base.companions || []).length} / 3`], ['탐사 시간', `${Math.floor(G.playTime / 60)}분`]] });
    } else ui.hidePause();
  };
  input.on('pause', togglePause); ui.on('resume', togglePause);
  ui.on('nbpause', () => { if (G.mode === 'play' && !G.paused && !director.active) togglePause(); });
  input.on('respawn', () => { if (G.mode === 'play' && !G.paused && G.checkpoint) { const c = G.checkpoint; player.teleport(c.x, c.y + 0.05, c.z); } });
  ui.on('save', () => ui.setSaveInfo(save() ? `저장했어요 · ${new Date().toLocaleTimeString()}` : '저장할 수 없어요'));
  ui.on('load', () => location.reload());
  ui.on('title', () => { save(); location.reload(); });
  ui.on('openmap', () => ui.toast('이곳의 지도는 아직 없다.'));
  ui.on('journal', () => {
    const got = base.relics || [];
    ui.openJournal({
      relics: RELICS.map((r) => (got.includes(r.id) ? { title: r.name, text: r.desc } : { title: '???', text: '아직 발견하지 못한 유물', unknown: true })),
      logs: [...(base.logs || []).filter((id) => LOG[id]).map((id) => ({ title: '', text: LOG[id] })), ...(base.memories || []).map((n) => ({ title: '복구된 기록', text: MEMORY[n].slice(1).join(' ') })),
        ...[['wake', 0], ['room', 3], ['stairs', 4], ['living', 5], ['yard', 7]].filter(([, n]) => st.done.length >= n).map(([k]) => ({ title: '', text: HOUSE[k] }))],
      stats: [{ title: `동력 결정 ${(base.shards || []).length} / 30` }, { title: `거인의 유물 ${got.length} / ${RELICS.length}` }, { title: `찾은 동료 ${(base.companions || []).length} / 3` }],
    });
  });
  addEventListener('beforeunload', () => { if (G.mode === 'play') save(); });
  ui.hideLoading();
  const qs = new URLSearchParams(location.search);
  if (qs.has('go') || qs.has('autostart')) begin(!!base.flat?.arrived && !qs.has('ride'));
  else ui.showTitle(true);
  player.state = 'idle';

  // ---------------------------------------------------------------- loop
  const clock = new THREE.Clock(); let acc = 0; const STEP = 1 / 60;
  const FROZEN = { getMove: () => ({ x: 0, y: 0 }), wasPressed: () => false, btn: {}, pressed: new Set() };
  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.1); G.time += dt;
    input.update(dt);
    if (G.rideTick) {
      G.rideTick(dt);
      if (rideComposer) { rideComposer.grade.uniforms.uTime.value = G.time; rideComposer.render(); } else renderer.render(ride.scene, ride.camera);
      return;
    }
    const playing = G.mode === 'play' && !G.paused;
    if (!playing) input.pressed.clear();
    if (playing) {
      G.playTime += dt;
      if (ui.dlg) { if (input.consume('interact') || input.consume('jump')) ui.dlg.next(); }
      else if (input.consume('interact')) play.interact(player);
      if (input.consume('emote')) { player.playAction('wave', 1.2); setExpr('smile', 1.4); moodBeep('happy'); }
      acc += dt; let n = 0;
      while (acc >= STEP && n < 4) { player.update(STEP, director.active ? FROZEN : input, orbit.yaw, play); physics.step(); input.pressed.clear(); acc -= STEP; n++; }
      if (n === 4) acc = 0;
      // the cat flap swings out as the robot crawls through it
      { const F = flat.flap, near = st.flapOpen && Math.abs(player.pos.x - F.x) < 0.22 && Math.abs(player.pos.z - F.z) < 0.18;
        flat.flapSwing = damp(flat.flapSwing || 0, near ? (player.pos.z > F.z ? -1.1 : 1.1) * Math.min(1, Math.abs(player.vel.z) * 2 + 0.3) : 0, near ? 9 : 4, dt);
        if (near && !G.flapSound) { G.flapSound = true; audio.play('flapSwing', { pos: V(F.x, 0.15, F.z), vol: 0.6 }); setTimeout(() => { G.flapSound = false; }, 1400); } }
      if (st.lidOpen && B.open < 1) B.open = Math.min(1, B.open + dt * 1.6);
      updateSleeper(dt); handleEvents(); updateQuest(dt); baseExpression(dt);
      if (G.time - (G.lastSave || 0) > 60) save();
    }
    flat.update(dt, G.time);
    if (G.mode === 'play') cat?.update(dt, player, G);
    nuri.root.position.copy(player.pos); nuri.root.rotation.y = player.yaw;
    const fo = footOffsets(), params = player.animParams(null); params.footOffset = fo.off; params.groundDrop = fo.drop;
    nuri.update(dt, params, { wind: tmp.set(0, 0, 0) });
    if (player.state === 'hover' || nuri.jetPower > 0.3) for (const j of nuri.jets) fx.exhaust(j.getWorldPosition(tmp));
    audio.setLoop('hover', player.state === 'hover' ? 0.15 : 0, player.pos);
    if (G.mode === 'title') {
      const t = G.time * 0.08; camera.position.set(player.pos.x + Math.sin(t) * 1.1, player.pos.y + 0.6, player.pos.z + Math.cos(t) * 1.1); camera.lookAt(player.pos.x, player.pos.y + 0.25, player.pos.z);
    } else if (director.active) director.update(dt);
    else if (!G.paused) orbit.update(dt, input, player);
    fx.update(dt); audio.setListener(camera);
    if (audio.ctx && G.mode !== 'ride') { audio.updateHouse(dt, player.pos, { flapOpen: st.flapOpen }); audio.tension = G.lampT > 0 || flat.sleeper.stir > 0.4 ? 1 : 0; }
    if (G.mode === 'play' && !G.paused) ui.setPrompt(!director.active ? play.prompt(player) : null, input.usingPad);
    // contact shadow under the robot
    {
      const gd = player.grounded ? 0 : Math.max(0, player.groundDist ?? 1), gy = player.pos.y - (player.grounded ? 0 : gd);
      contact.visible = gd < 1.5; contact.position.set(player.pos.x, gy + 0.004, player.pos.z); contact.quaternion.setFromUnitVectors(V(0, 0, 1), V(0, 1, 0));
      const k = 1 - clamp(gd / 1.5, 0, 1); contact.scale.setScalar(0.34 + (1 - k) * 0.25); contact.material.opacity = 0.7 * k;
      nuri.setGround?.(gy, 'wood', false);
    }
    if (composer) { composer.grade.uniforms.uTime.value = G.time; composer.render(); } else renderer.render(scene, camera);
  }
  resize(); frame();
  window.__game = { G, player, flat, nuri, cat, orbit, director, camera, renderer, scene, physics, ui, audio, st, play, begin, startRide, arrive, startPlay, get ride() { return ride; } };
}
