// Nuri: Tiny Explorer — boot, render pipeline, game loop, emotions, save/load, settings.
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
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
import { Quests } from './quests.js';
import { Minimap } from './minimap.js';
import { Trials } from './trials.js';
import { INTRO, LOG, CHAPTER, MEMORY } from './story.js';
import { Director } from './cutscene.js';
import { Relics, RELICS } from './relics.js';
import { Squad } from './squad.js';
import { Puzzles } from './puzzles.js';
import { MEMORY as MEM } from './story.js';
import { Creatures } from './creatures.js';
import { FX } from './fx.js';
import { Audio } from './audio.js';
import { UI, loadSave, writeSave, loadSettings, writeSettings } from './ui.js';
import { START, STREAM, POND, REGIONS } from './layout.js';
import { WIND } from './shaders.js';
import { makeDofPass, makeGradePass, makeContactShadow, makeGodRaysPass } from './post.js';
import { Lighting } from './lighting.js';
import { Prints } from './prints.js';
import { GroundMarks } from './marks.js';
import { DUST, WET, REFRACT } from './nuri.js';
import { clamp, damp, angleDiff } from './util.js';

// The sun's shadow map only covers a box around the robot. Past its edge three would light everything fully, so a
// moving boundary flipped ground between shade and sun as the robot walked or the camera turned (it read as
// flashing). Near and beyond the edge the shadow now blends into the canopy estimate (sky visibility): open ground
// stays sunny, ground under the crowns stays shaded, and there is no edge to see.
THREE.ShaderChunk.shadowmap_pars_fragment = THREE.ShaderChunk.shadowmap_pars_fragment.replace('return mix( 1.0, shadow, shadowIntensity );', `{
    float eF = min(min(shadowCoord.x, 1.0 - shadowCoord.x), min(shadowCoord.y, 1.0 - shadowCoord.y));
    float edgeK = smoothstep(0.0, 0.22, eF);
    #ifdef LIT_SKY
      float farS = mix(0.2, 1.0, smoothstep(0.35, 0.95, skyVisibility(litWorldPos())));
    #else
      float farS = 0.65;
    #endif
    shadow = mix(farS, shadow, edgeK);
  }
  return mix( 1.0, shadow, shadowIntensity );`);

const DEFAULTS = { guide: true, master: 0.8, music: 0.45, sfx: 0.85, sens: 1, invertY: false, timeFlow: false, weather: 'clear', quality: null, padMap: null };

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
  renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 0.9;   // keeps the hue and saturation of sunlit ground (AgX bleaches it to beige)
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.02, 220);
  // sun (aligned to the sun in the forest_slope HDRI)
  const HDRI_SUN = new THREE.Vector3(0.576, 0.641, 0.506).normalize();
  const sunDir = HDRI_SUN.clone();
  const sun = new THREE.DirectionalLight(0xfff1dc, 3.4);
  sun.castShadow = true; sun.shadow.mapSize.set(tier.shadowMap, tier.shadowMap);
  const sr = tier.shadowRange; Object.assign(sun.shadow.camera, { left: -sr, right: sr, top: sr, bottom: -sr, near: 1, far: 90 });
  sun.shadow.bias = -0.00025; sun.shadow.normalBias = 0.025; sun.shadow.radius = 2;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(0xc8d8e8, 0x3b3122, 0.06); scene.add(hemi);
  scene.fog = new THREE.FogExp2(new THREE.Color().setRGB(0.44, 0.48, 0.44, THREE.SRGBColorSpace), 0.017);
  function setSun(elev, azim) {
    if (elev === null) sunDir.copy(HDRI_SUN);
    else sunDir.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - elev), THREE.MathUtils.degToRad(azim));
    const warm = clamp((Math.asin(sunDir.y) * 57.3 - 8) / 30, 0, 1);
    sun.color.setRGB(1, 0.8 + 0.16 * warm, 0.64 + 0.26 * warm);
  }
  setSun(null);

  ui.progress(0.02, '물리 엔진');
  await RAPIER.init();
  const physics = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  physics.timestep = 1 / 60;
  const assets = new Assets(renderer, tier, (k, l) => ui.progress(0.05 + k * 0.85, l));
  await assets.loadAll();
  scene.environment = assets.tex.envMap; scene.environmentIntensity = 0.95;
  scene.background = assets.tex.hdr; scene.backgroundIntensity = 0.95;

  const ctx = { scene, RAPIER, physics, assets, tier, sunDir, camera, renderer, terrain: null };
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
  physics.step(); // register the new colliders with the query pipeline before gameplay probes the world
  const gameplay = new Gameplay(ctx, world, player, ui, audio, fx);
  gameplay.build();
  world.buildMoss(gameplay.mossSources);
  const quests = new Quests(gameplay, ui, audio, camera);
  const minimap = new Minimap({ world, gameplay, player, orbit, quests, ui });
  const trials = new Trials({ ctx, gameplay, player, ui, audio, fx, quests });
  // ------------------------------------------------------------ cutscenes
  const director = new Director({ camera, ui });
  {
    const ball = new RAPIER.Ball(0.07);
    director.collide = (look, pos) => {
      const d = pos.clone().sub(look), L = d.length(); if (L < 0.05) return;
      d.divideScalar(L);
      const hit = physics.castShape(look, { x: 0, y: 0, z: 0, w: 1 }, d, ball, 0.0, L, true, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, player.col, player.body,
        (c) => !['item', 'item-held', 'creature', 'player'].includes(c.userData?.kind));
      if (hit) { const t = Math.max(0.12, (hit.time_of_impact ?? hit.timeOfImpact) - 0.02); pos.copy(look).addScaledVector(d, t); }
      const th = world.terrain.heightAt(pos.x, pos.z) + 0.06; if (pos.y < th) pos.y = th;
    };
  }
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const CS = {
    // the opening: the camera comes down through the crowns onto the robot asleep in the clearing, which wakes
    intro(done) {
      const p = player.pos.clone(), f = V(Math.sin(player.yaw), 0, Math.cos(player.yaw)), sd = V(-f.z, 0, f.x);
      player.state = 'sleep'; setExpr('sleepy');
      // crane down through a gap: of 16 directions, the one whose path is clear of trunks and has the most open sky
      let best = null, bs = -1e9;
      for (let k = 0; k < 16; k++) {
        const a = k / 16 * Math.PI * 2, dir = V(Math.cos(a), 0, Math.sin(a));
        const start = p.clone().addScaledVector(dir, 5.5).add(V(0, 8, 0)), end = p.clone().addScaledVector(dir, 1.5).add(V(0, 1.3, 0));
        let score = lighting.visibility(start.x, start.y, start.z) * 2 + lighting.visibility(end.x, end.y + 2, end.z);
        for (const q of [start, end, start.clone().lerp(end, 0.5)]) {
          const d = q.clone().sub(p).add(V(0, -0.2, 0)), L = d.length(); d.normalize();
          const h = physics.castRay(new RAPIER.Ray({ x: p.x, y: p.y + 0.2, z: p.z }, d), L, true, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, player.col, player.body);
          if (h) score -= 3;
        }
        score += dir.dot(f) * 0.4;                                     // prefer seeing the face
        if (score > bs) { bs = score; best = { start, end }; }
      }
      director.play([
        { dur: 6.5, from: best.start, to: best.end, lookFrom: p.clone().add(V(0, 3, 0)), lookTo: p.clone().add(V(0, 0.15, 0)), fov: 50 },
        { dur: 3.6, from: p.clone().addScaledVector(f, 0.62).addScaledVector(sd, 0.25).add(V(0, 0.32, 0)), to: p.clone().addScaledVector(f, 0.48).addScaledVector(sd, 0.18).add(V(0, 0.3, 0)),
          lookFrom: p.clone().add(V(0, 0.24, 0)), fov: 42 },
        { dur: 2.4, from: p.clone().addScaledVector(f, 0.5).addScaledVector(sd, 0.18).add(V(0, 0.3, 0)), to: p.clone().addScaledVector(f, 0.9).addScaledVector(sd, 0.5).add(V(0, 0.42, 0)),
          lookFrom: p.clone().add(V(0, 0.24, 0)), fov: 46,
          onStart: () => { player.state = 'idle'; player.idleT = 0; setExpr('surprised', 1.2); moodBeep('surprised'); audio.play('beep', { pitch: 1.2 }); } },
      ], { onDone: () => done?.() });
    },
    // meeting a friend: establishing two-shot, then over-the-shoulder cuts that follow who is talking
    friend(c, lines) {
      const P = player.pos.clone(), F = c.mesh.position.clone(), lift = c.kind === 2 ? 0.25 : 0;
      const d = V(F.x - P.x, 0, F.z - P.z).normalize(), sd = V(-d.z, 0, d.x), mid = P.clone().lerp(F, 0.5).add(V(0, 0.18 + lift * 0.5, 0));
      player.yaw = Math.atan2(d.x, d.z);
      // over-the-shoulder: well behind and to the side of the listener, so the speaker is framed clear of its head
      const ots = (who) => who === '세븐'
        ? { dur: Infinity, ease: 5, from: F.clone().addScaledVector(d, 0.8).addScaledVector(sd, -0.5).add(V(0, 0.34 + lift, 0)), to: F.clone().addScaledVector(d, 0.72).addScaledVector(sd, -0.44).add(V(0, 0.32 + lift, 0)), lookFrom: P.clone().add(V(0, 0.22, 0)), fov: 36 }
        : { dur: Infinity, ease: 5, from: P.clone().addScaledVector(d, -0.8).addScaledVector(sd, 0.5).add(V(0, 0.36, 0)), to: P.clone().addScaledVector(d, -0.72).addScaledVector(sd, 0.44).add(V(0, 0.34, 0)), lookFrom: F.clone().add(V(0, 0.14 + lift * 0.4, 0)), fov: 36 };
      director.play([{ dur: Infinity, ease: 2.2, from: mid.clone().addScaledVector(sd, 1.5).add(V(0, 0.5, 0)), to: mid.clone().addScaledVector(sd, 1.05).add(V(0, 0.3, 0)), lookFrom: mid, fov: 48 }],
        { onDone: (skipped) => { if (!skipped) return; if (ui.dlg) { while (ui.dlg) ui.dlg.next(); } } });
      setTimeout(() => {
        ui.on('dlgline', (who) => { if (director.active) director.cut(ots(who)); });
        ui.dialogue(lines, () => { ui.on('dlgline', null); director.finish(false); });
      }, 1700);
    },
    // something happens in the world (the gate swings open, the lift powers up): a wide shot of it, then back
    event(target, dur) {
      const P = player.pos.clone(), toP = V(P.x - target.x, 0, P.z - target.z); if (toP.lengthSq() < 1e-4) toP.set(1, 0, 0); toP.normalize();
      const sd = V(-toP.z, 0, toP.x);
      director.play([{ dur, from: target.clone().addScaledVector(toP, 3.4).addScaledVector(sd, 1.4).add(V(0, 1.1, 0)), to: target.clone().addScaledVector(toP, 2.6).addScaledVector(sd, 0.6).add(V(0, 0.8, 0)),
        lookFrom: target, fov: 50 }]);
    },
    // the booster clicks onto the robot's back: the camera circles it while the jets flare
    booster() {
      const P = player.pos.clone();
      director.play([{ dur: 3.2, from: P.clone().add(V(0.9, 0.45, 0.4)), to: P.clone().add(V(0.9, 0.3, 0.4)), lookFrom: P.clone().add(V(0, 0.2, 0)), orbit: 2.4, fov: 46,
        onStart: () => { nuri.jetPower = 1; } }]);
    },
    // the ending: Mina lifts off from the lookout and flies north over the fence
    ending(done) {
      const m = gameplay.companions.find((c) => c.kind === 2); if (!m) { done(); return; }
      const M = m.pos.clone(), P = player.pos.clone(), d = V(M.x - P.x, 0, M.z - P.z).normalize(), sd = V(-d.z, 0, d.x);
      m.flyT = 0;
      director.play([
        { dur: 4.2, from: M.clone().addScaledVector(d, -1.8).addScaledVector(sd, 0.8).add(V(0, 0.2, 0)), to: M.clone().addScaledVector(d, -1.4).addScaledVector(sd, 0.6).add(V(0, 0.15, 0)),
          lookFrom: () => m.mesh.position.clone(), track: true, fov: 52 },
        { dur: 4.5, from: M.clone().add(V(0, 0.4, 2.5)), to: M.clone().add(V(0, 0.6, 1.8)), lookFrom: () => m.mesh.position.clone(), track: true, fov: 58 },
      ], { onDone: () => done() });
    },
  };
  gameplay.onCinematic = (target, dur) => CS.event(target, dur);
  gameplay.onMeet = (c, lines) => CS.friend(c, lines);
  gameplay.onBooster = () => CS.booster();
  quests.onCharged = () => CS.ending(() => ui.story(CHAPTER, () => gameplay.openFence()));
  quests.mapOpen = () => minimap.open;
  const relics = new Relics({ ctx, gameplay, world, player, ui, audio, fx });
  const squad = new Squad({ ctx, gameplay, player, ui, audio, fx, world });
  gameplay.extraPlateWeight = (p) => squad.plateWeight(p);
  // dark crystals: under the big roots of the hero trees, and at the back of the cave — only Bori's light shows them
  {
    const ds = [];
    world.treeSpots.filter((t) => t.hero).slice(0, 5).forEach((t, i) => { const a = i * 2.3 + 0.7, x = t.x + Math.cos(a) * 1.15, z = t.z + Math.sin(a) * 1.15; ds.push([x, gameplay.groundY(x, z) + 0.12, z]); });
    if (gameplay.caveCenter) for (const [dx, dz] of [[0.5, 0.3], [-0.4, -0.5]]) { const x = gameplay.caveCenter.x + dx, z = gameplay.caveCenter.z + dz; ds.push([x, gameplay.groundY(x, z) + 0.12, z]); }
    squad.addDark(ds);
  }
  const puzzles = new Puzzles({ ctx, gameplay, world, player, ui, audio, fx, minimap });
  puzzles.onBeacon = (b) => {
    const c = b.p.clone().add(V(0, 0.3, 0));
    director.play([{ dur: 4.2, from: c.clone().add(V(2.6, 1.4, 0)), to: c.clone().add(V(2.6, 2.2, 0)), lookFrom: c, orbit: Math.PI * 1.1, fov: 55 }]);
  };
  // Mina's flights: to any discovered place (fade, fly, land with the squad)
  gameplay.onMinaFlight = () => {
    const opts = REGIONS.filter((r) => gameplay.save.regions.includes(r.id) && r.id !== 'summit').map((r) => [r.name, r]);
    ui.choose('로터 · 어디로 날아갈까?', opts, (r) => {
      if (!r) return;
      audio.play('djump', { pitch: 0.7 });
      ui.fadeOut(900, () => {
        const y = gameplay.groundY(r.x, r.z); player.teleport(r.x, y + 0.05, r.z); player.vel.set(0, 0, 0);
        for (const c of squad.members()) { c.state = 'follow'; c.mesh.position.set(r.x + 0.4, y, r.z + 0.4); }
        squad.trail.length = 0; ui.discover(r.name);
      });
    });
  };
  ui.on('journal', () => {
    const sv = gameplay.save;
    ui.openJournal({
      relics: RELICS.map((r) => sv.relics.includes(r.id) ? { title: r.name, text: r.desc } : { title: '???', text: '아직 발견하지 못한 유물', unknown: true }),
      logs: [...(sv.logs || []).map((id) => ({ title: '', text: LOG[id] })), ...(sv.memories || []).map((n) => ({ title: '복구된 기록', text: MEM[n].slice(1).join(' ') }))],
      stats: [{ title: `동력 결정 ${sv.shards.length} / ${gameplay.totalShards}` }, { title: `거인의 유물 ${sv.relics.length} / ${relics.items.length}` },
        { title: `찾은 동료 ${sv.companions.length} / 3` }, { title: `측량 비콘 ${(sv.beacons || []).length} / ${puzzles.beacons.length}` }, { title: `탐험한 숲 ${Math.round(minimap.explored() * 100)}%` },
        ...Object.entries(sv.trials || {}).map(([k, v]) => ({ title: `${k === 'trail' ? '숲길 질주' : '바람 타기'} 최고 기록 ${v.t.toFixed(2)}초` }))],
    });
  });
  gameplay.onMemory = (n) => { if (!director.active) ui.story(MEMORY[n], null, { memory: true, hold: 3800 }); };
  input.on('map', () => { if (G.mode === 'play' && !G.paused) minimap.show(!minimap.open); });
  // cut-out foliage (needles, leaves, grass, ferns) resolves its edges with MSAA alpha-to-coverage: smooth, thin
  // edges instead of jagged alpha-test stairs
  if (tier.msaa) scene.traverse((o) => { for (const m of [o.material].flat()) if (m && m.alphaTest > 0 && !m.transparent) { m.alphaToCoverage = true; m.needsUpdate = true; } });
  const creatures = new Creatures(ctx, world, audio);
  squad.creatures = creatures; gameplay.totalShards += creatures.thieves().length;
  // lighting model: sky occlusion under canopy / in the cave, sun in-scattering, eye adaptation
  const lighting = new Lighting(ctx, world);
  lighting.patchScene(scene);
  // Nuri's face screen faintly lights its surroundings in the dark
  const faceLight = new THREE.PointLight(0x5fe6ff, 0, 0.9, 2); faceLight.position.set(0, 0.29, 0.14); nuri.root.add(faceLight);

  // settings
  const applySettings = () => {
    quests.guide = S.guide !== false;
    audio.vol = { master: S.master, music: S.music, sfx: S.sfx }; audio.applyVolume();
    input.sens = S.sens; input.invertY = S.invertY;
    if (S.padMap) input.padMap = { ...input.padMap, ...S.padMap };
    writeSettings(S);
  };
  ui.bindSettings(S, applySettings, input); applySettings();

  // post-processing
  let composer = null, bloom = null, dof = null, grade = null, rays = null;
  if (tier.post) {
    const rt = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: tier.msaa });
    rt.depthTexture = new THREE.DepthTexture(innerWidth, innerHeight);
    composer = new EffectComposer(renderer, rt);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.addPass(new RenderPass(scene, camera));
    if (tier.ao) {
      const ao = new GTAOPass(scene, camera, innerWidth, innerHeight);
      ao.updateGtaoMaterial({ radius: 0.35, distanceExponent: 1.5, thickness: 1, scale: 1, samples: 12 });
      ao.blendIntensity = 0.85; composer.addPass(ao);
    }
    if (tier.bloom) { bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.32, 0.55, 0.92); composer.addPass(bloom); }
    if (tier.rays) { rays = makeGodRaysPass(rt.depthTexture); composer.addPass(rays); }
    if (tier.dof) { dof = makeDofPass(rt.depthTexture, camera, tier.dofSamples || 19); composer.addPass(dof); }
    composer.addPass(new OutputPass());
    grade = makeGradePass(); composer.addPass(grade);
  } else document.body.classList.add('css-vignette');
  // soft contact shadow under the robot (grounds it on every quality tier)
  const contact = makeContactShadow(); scene.add(contact);
  const wy = world.terrain.waterY;
  fx.setWater({ y: wy, isWater: (x, z) => world.terrain.isWater(x, z), ground: (x, z) => world.terrain.heightAt(x, z) - 0.02,
    onDrop: (x, z, r, k) => world.sim.drop(x, z, r, k) });
  const surf = (p) => ({ x: p.x, y: wy, z: p.z });
  fx.initAmbient(tier.rich ? 260 : 120);
  // footprints / skids are pressed into the terrain surface itself (lit and shaded like the scanned ground)
  const marks = new GroundMarks(renderer, tier.rich ? { N: 2048, size: 10 } : { N: 1024, size: 8 });
  const TU = world.terrain.material.userData.uniforms;
  // share the terrain material's own uniform objects (its program may already be compiled during loading)
  for (const k of Object.keys(marks.uniforms)) { TU[k].value = marks.uniforms[k].value; marks.uniforms[k] = TU[k]; }
  const prints = new Prints(scene, world, marks); world.grassTrample.value = prints.trample;
  const footWorld = (side) => { const b = nuri.b[`foot.${side}`]; const v = b.getWorldPosition(new THREE.Vector3()); v.x += Math.sin(player.yaw) * 0.012; v.z += Math.cos(player.yaw) * 0.012; return v; };
  const resize = () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    composer?.setSize(innerWidth, innerHeight);
    const pr = renderer.getPixelRatio();
    if (dof) { dof.uniforms.uRes.value.set(innerWidth * pr, innerHeight * pr); dof.uniforms.uMaxR.value = 5 * innerHeight * pr / 1080; }
    if (grade) grade.uniforms.uRes.value.set(innerWidth * pr, innerHeight * pr);
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
      G.wokeUp = false; G.introT = 0; G.newStory = true;
      // the night of the storm, told over black while the forest loads in behind it
      if (!new URLSearchParams(location.search).has('autostart')) {        // (test runs skip it)
        G.storyOpen = true;
        ui.story(INTRO, () => { G.storyOpen = false; CS.intro(() => { G.wokeUp = true; G.newStory = false; setTimeout(() => ui.bubble('세븐', LOG.first), 600); }); }, { title: '언더그로스' });
      }
    }
    orbit.set(player.yaw + Math.PI, 0.25);
    minimap.loadFog(gameplay.save.explored); quests.init();
    creatures.thieves().forEach((c, i) => { if (gameplay.save.shards.includes('q' + i)) { c.carry = false; c.loot.visible = false; } });
    G.mode = 'play'; ui.startPlay();
    ui.setShards(gameplay.save.shards.length, gameplay.totalShards); ui.setFriends(gameplay.save.companions.length, gameplay.companions.length);
    // water ambience along the stream + waterfall roar
    if (!G.waterSounds) {
      G.waterSounds = true;
      for (let i = 0; i < STREAM.ctrl.length; i += 2) { const [x, z] = STREAM[STREAM.ctrl[i]]; audio.addWaterSource({ x, y: world.terrain.waterY, z }, 0.18, 1); }
      audio.addWaterSource(world.waterfallPos, 0.9, 0.6); audio.addWaterSource({ x: POND.x, y: world.terrain.waterY, z: POND.z }, 0.2, 0.8);
    }
  };
  ui.on('continue', () => startGame(true));
  ui.on('new', () => { writeSave(null); startGame(false); });
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
          { // footprint of the planted boot (the lower one)
            const L = footWorld('L'), R = footWorld('R'), f = L.y < R.y ? L : R;
            f.y = player.pos.y; prints.step(f, player.yaw, WET.value, player.groundCollider, 1);
          }
          if (surf === 'water' || player.wadeDepth > 0.02) { const d = tmpV.set(player.vel.x, 0, player.vel.z).multiplyScalar(0.3); fx.wadeSplash({ x: pp.x, y: wy, z: pp.z }, d, 0.6); world.sim.drop(pp.x, pp.z, 0.07, -0.02); }
          break;
        }
        case 'jump': audio.play('jump', { pos: pp }); if (e.water) { fx.waterSplash(surf(pp), 0.55); world.sim.drop(pp.x, pp.z, 0.12, -0.05); audio.play('splash', { pos: pp, vol: 0.5 }); } else fx.dust(pp, 4); break;
        case 'djump': audio.play('djump', { pos: pp }); for (let i = 0; i < 10; i++) fx.exhaust({ x: pp.x, y: pp.y, z: pp.z }); setExpr('excited', 0.8); break;
        case 'dash': audio.play('djump', { pos: pp, pitch: 1.25 }); for (let i = 0; i < 16; i++) fx.exhaust({ x: pp.x, y: pp.y + 0.15, z: pp.z }); orbit.shake = Math.max(orbit.shake, 0.18); setExpr('excited', 0.8); break;
        case 'land': if (e.impact > 5.5) { orbit.shake = Math.max(orbit.shake, Math.min(0.4, (e.impact - 5.5) * 0.1)); fx.dust(pp, 10); }
          for (const sd of ['L', 'R']) { const f = footWorld(sd); f.y = player.pos.y; prints.step(f, player.yaw, WET.value, player.groundCollider, clamp(0.8 + e.impact / 10, 0.8, 1.3)); }
          if (e.impact > 3) { audio.play('land', { pos: pp, vol: clamp(e.impact / 9, 0.3, 1) }); fx.dust(pp, Math.round(clamp(e.impact, 3, 12))); if (e.impact > 8) orbit.shake = Math.max(orbit.shake, 0.45); }
          else audio.play('step', { surface: surfaceUnder(), pos: pp, vol: 0.5 }); break;
        case 'splash': audio.play('splash', { pos: pp, vol: e.strength }); fx.waterSplash(surf(pp), 0.5 + e.strength); world.sim.drop(pp.x, pp.z, 0.16, -0.06 - e.strength * 0.06); orbit.shake = 0.25 * e.strength; WET.value = 1; setExpr('surprised', 0.8); moodBeep('surprised'); break;
        case 'swimstroke': { audio.play('swim', { pos: pp, vol: 0.6 }); const f = tmpV.set(Math.sin(player.yaw), 0, Math.cos(player.yaw));
          for (const sd of [-1, 1]) { const hx = pp.x + f.z * sd * 0.09 + f.x * 0.05, hz = pp.z - f.x * sd * 0.09 + f.z * 0.05; world.sim.drop(hx, hz, 0.06, -0.025); fx.wadeSplash({ x: hx, y: wy, z: hz }, f, 0.35); }
          break; }
        case 'climbout': audio.play('swim', { pos: pp, vol: 0.8 }); audio.play('jump', { pos: pp, pitch: 0.8 }); world.sim.drop(pp.x, pp.z, 0.14, 0.04); for (let i = 0; i < 18; i++) fx.drip({ x: pp.x, y: pp.y + 0.1 + Math.random() * 0.25, z: pp.z }); setExpr('joy', 1); break;
        case 'roll': audio.play('roll', { pos: pp }); setExpr('focused', 0.5); break;
        case 'slide': audio.play('slide', { pos: pp }); setExpr('excited', 0.7); break;
        case 'grab': audio.play('grabledge', { pos: pp }); break;
        case 'climbup': audio.play('jump', { pos: pp, pitch: 0.8 }); break;
        case 'collect': setExpr('joy', 1.0); break;
        case 'discover': setExpr('surprised', 0.9); audio.lift(30); setTimeout(() => setExpr('excited', 1.8), 900); moodBeep('surprised'); break;
        case 'ability': setExpr('excited', 3); audio.lift(30); moodBeep('love'); break;
        case 'friend': setExpr('love', 2.2); audio.lift(30); moodBeep('love'); break;
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
    else if (Math.hypot(player.vel.x, player.vel.z) > 1.25) e = 'smile';
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
  const FROZEN = { getMove: () => ({ x: 0, y: 0 }), wasPressed: () => false, btn: {}, pressed: new Set() };
  const hints = [[3, '이동: ' + (isTouch ? '왼쪽 화면을 드래그' : 'WASD · 카메라: 마우스')], [9, '점프: ' + (isTouch ? '점프 버튼' : 'Space (길게 누르면 더 높이)')], [16, '숙이기 버튼으로 구르기 · 낮은 곳 기어가기']];
  function frame() {
    requestAnimationFrame(frame);
    let dt = Math.min(clock.getDelta(), 0.1);
    G.time += dt;
    input.update(dt);
    const playing = G.mode === 'play' && !G.paused && !minimap.open;
    if (!playing) input.pressed.clear();      // presses made in menus never leak into play
    if (playing) {
      G.playTime += dt;
      // intro: wake up on first input
      if (!G.wokeUp) {
        G.introT += dt;
        const m = input.getMove();
        if (!G.storyOpen && G.introT > 1.2 && (Math.hypot(m.x, m.y) > 0.1 || input.pressed.size)) {
          G.wokeUp = true; player.state = 'idle'; player.idleT = 0;
          if (G.newStory) { G.newStory = false; setTimeout(() => ui.bubble('세븐', LOG.first), 1600); }
          setExpr('surprised', 1); setTimeout(() => setExpr('curious', 2), 1000); moodBeep('surprised');
        } else { player.state = 'sleep'; }
      } else {
        for (const [t, msg] of hints) if (G.hintStep < hints.length && hints[G.hintStep] === hints.find((h) => h[1] === msg) && G.playTime > t && !loadSave()?.regions?.length) { ui.toast(msg); G.hintStep++; break; }
      }
      if (ui.dlg) { if (input.consume('interact') || input.consume('jump')) ui.dlg.next(); }
      else if (G.wokeUp) {
        if (input.consume('interact')) {
          if (squad.holding) squad.throwHeld();
          else { const fr = !player.carry && squad.near(); if (fr) squad.pickUp(fr); else gameplay.interact(player); }
        }
        if (input.consume('emote')) { player.playAction('wave', 1.2); setExpr('smile', 1.4); moodBeep('happy'); }
      }
      acc += dt;
      let steps = 0;
      while (acc >= STEP && steps < 4) {
        if (G.wokeUp) player.update(STEP, orbit.cine || ui.dlg || director.active ? FROZEN : input, orbit.yaw, gameplay);
        else { player.vel.set(0, 0, 0); }
        physics.step();
        input.pressed.clear();
        acc -= STEP; steps++;
      }
      if (steps === 4) acc = 0;
      gameplay.update(dt, G.time);
      quests.update(dt, player.pos, G.wokeUp && !orbit.cine && !director.active);
      minimap.update(dt);
      trials.update(dt, G.time);
      relics.update(dt, G.time);
      if (!director.active) squad.update(dt, G.time);
      puzzles.update(dt, G.time);
      handleEvents();
      edgeCheck();
      baseExpression(dt);
    }
    // animation + model transform
    nuri.root.position.copy(player.pos);
    {
      // boots settle a few millimetres into soft litter / dirt / moss instead of hovering on the surface
      const onT = !player.groundCollider || player.groundCollider.userData?.kind === 'terrain';
      const sf = player.grounded && onT && player.state !== 'swim' ? world.terrain.surfaceAt(player.pos.x, player.pos.z) : '';
      const target = sf === 'dirt' ? 0.007 : sf === 'moss' ? 0.006 : sf === 'leaves' ? 0.005 : sf === 'pebbles' ? 0.002 : 0;
      G.sink = damp(G.sink || 0, target, 10, dt);
      nuri.root.position.y -= G.sink;
    }
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
    } else if (director.active) director.update(dt);
    else if (!G.paused) orbit.update(dt, input, player);
    // world + effects
    world.update(dt, G.time, camera.position, player.pos);
    creatures.update(dt, G.time, player, gameplay.caveCenter);
    // waterfall: spray droplets and drifting mist at the plunge point
    if (world.waterfallPos && camera.position.distanceToSquared(world.waterfallPos) < 30 * 30) {
      const wf = world.waterfallPos;
      if (Math.random() < dt * 18) fx.droplet(wf.x + (Math.random() - 0.5) * 0.8, wy + 0.05, wf.z + (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 1.2, 1.2 + Math.random() * 1.8, (Math.random() - 0.3) * 1.2, 0.003 + Math.random() * 0.004);
      if (Math.random() < dt * 6) fx.spawn({ x: wf.x + (Math.random() - 0.5) * 0.8, y: wy + 0.1, z: wf.z + (Math.random() - 0.5) * 0.6,
        vx: (Math.random() - 0.5) * 0.3, vy: 0.25 + Math.random() * 0.3, vz: 0.2 + Math.random() * 0.3, g: -0.05, drag: 0.6,
        max: 2.5 + Math.random() * 1.5, s0: 0.25, s1: 0.9, c: [0.86, 0.9, 0.9], a: 0.09 });
    }
    fx.update(dt);
    audio.setListener(camera);
    const inCave = gameplay.caveCenter && player.pos.distanceTo(gameplay.caveCenter) < 2.6 && player.pos.y < gameplay.caveCenter.y + 1.2 ? 1 : 0;
    audio.updateAmbience(dt, player.pos, S.weather === 'rain' ? 1.4 : 1, inCave);
    // time of day / weather
    if (S.timeFlow) G.tod = (G.tod + dt / 900) % 1;
    const elev = S.timeFlow ? 14 + Math.sin(G.tod * Math.PI) * 46 : null, azim = S.timeFlow ? 120 + G.tod * 140 : 0;
    setSun(elev, azim);
    const rainK = G.rainK = damp(G.rainK || 0, S.weather === 'rain' ? 1 : 0, 0.6, dt);
    // filtered forest light: a softer sun and a stronger sky keep sunlit patches from burning out to white
    sun.intensity = (1.3 + 2.2 * clamp(Math.asin(sunDir.y) * 57.3 / 40, 0, 1)) * (1 - rainK * 0.8);
    hemi.intensity = 0.06 + rainK * 0.2;
    scene.backgroundIntensity = 0.95 - rainK * 0.5;
    scene.fog.density = 0.017 + rainK * 0.03;
    scene.fog.color.setRGB(0.38 - rainK * 0.1, 0.43 - rainK * 0.12, 0.39 - rainK * 0.08, THREE.SRGBColorSpace);
    scene.environmentIntensity = 1.15 - rainK * 0.4;
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
    // wake behind the robot in water, dripping and drying afterwards
    if (G.mode === 'play' && !G.paused) {
      const inW = player.state === 'swim' || (player.wadeDepth || 0) > 0.03;
      REFRACT.inWater.value = damp(REFRACT.inWater.value, inW || player.pos.y < wy + 0.05 && world.terrain.isWater(player.pos.x, player.pos.z) ? 1 : 0, 6, dt);
      const hs = Math.hypot(player.vel.x, player.vel.z);
      if (inW) {
        WET.value = Math.max(WET.value, player.state === 'swim' ? 1 : Math.min(1, WET.value + dt * 2 * (player.wadeDepth / 0.3)));
        if (hs > 0.05) {
          const back = tmpV.set(player.vel.x, 0, player.vel.z).normalize();
          world.sim.drop(player.pos.x - back.x * 0.12, player.pos.z - back.z * 0.12, 0.07, -0.006 * Math.min(2, hs));
          world.sim.drop(player.pos.x + back.x * 0.1, player.pos.z + back.z * 0.1, 0.06, 0.004 * Math.min(2, hs));
        } else if (Math.random() < dt * 2) world.sim.drop(player.pos.x, player.pos.z, 0.1, 0.004);
      } else {
        WET.value = Math.max(0, WET.value - dt / 28);
        if (WET.value > 0.12 && Math.random() < dt * 14 * WET.value) {
          const n = nuri.root; fx.drip({ x: n.position.x, y: n.position.y + 0.05 + Math.random() * 0.25, z: n.position.z });
        }
      }
    }
    // skid marks while rolling / sliding, drag marks behind pushed crates
    if (G.mode === 'play' && !G.paused) {
      if (player.grounded && (player.state === 'roll' || player.state === 'slide')) {
        const d = tmpV.set(player.vel.x, 0, player.vel.z); if (d.lengthSq() > 0.01) prints.skid(player.pos, d.normalize(), player.groundCollider, WET.value, player.state === 'slide' ? 1.4 : 1.1);
      }
      for (const pr of gameplay.props) if (pr.kind === 'crate') {
        const v = pr.body.linvel(), hs = Math.hypot(v.x, v.z), t = pr.body.translation();
        if (hs > 0.15 && t.y - pr.size / 2 - world.terrain.heightAt(t.x, t.z) < 0.05) prints.skid(new THREE.Vector3(t.x, 0, t.z), new THREE.Vector3(v.x, 0, v.z).normalize(), null, 0, pr.size / 0.07 * 0.9);
      }
    }
    prints.update(dt);
    marks.update(dt, player.pos);
    // contact shadow follows the ground under the robot and fades with height
    {
      const gd = player.grounded ? 0 : Math.max(0, player.groundDist ?? 1);
      const gy = player.pos.y - (player.grounded ? 0 : gd);
      // on terrain the occlusion is computed inside the terrain shader (robot body + each boot);
      // the decal is only used on rocks, logs and other props
      const onTerrain = !player.groundCollider || player.groundCollider.userData?.kind === 'terrain';
      const swim = player.state === 'swim';
      TU.uRobot.value.set(player.pos.x, gy, player.pos.z, swim ? 9 : gd);
      for (const [i, sd] of [[0, 'L'], [1, 'R']]) { const f = footWorld(sd); TU.uFeet.value[i].set(f.x, swim ? -99 : f.y - 0.012, f.z, 0); }
      nuri.setGround(gy, world.terrain.surfaceAt(player.pos.x, player.pos.z), onTerrain);
      contact.visible = gd < 1.5 && !swim && !onTerrain;
      contact.position.set(player.pos.x, gy + 0.006, player.pos.z);
      const n = world.terrain.normalAt(player.pos.x, player.pos.z);
      contact.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
      const k = 1 - clamp(gd / 1.5, 0, 1);
      contact.scale.setScalar(0.34 + (1 - k) * 0.25);
      contact.material.opacity = 0.75 * k;
    }
    // dust builds up on dirt and washes off in water
    if (player.state === 'swim') DUST.value = Math.max(0.2, DUST.value - dt * 0.25);
    else if (player.grounded && Math.hypot(player.vel.x, player.vel.z) > 0.6) DUST.value = Math.min(1, DUST.value + dt * 0.004);
    if (dof) {
      const head = tmpV.set(player.pos.x, player.pos.y + 0.22, player.pos.z);
      dof.uniforms.uFocus.value = damp(dof.uniforms.uFocus.value, camera.position.distanceTo(head), 8, dt);
      dof.uniforms.uStrength.value = G.mode === 'title' ? 1.4 : 1.0;
    }
    if (grade) grade.uniforms.uTime.value = G.time;
    fx.updateAmbient(G.time, camera.position, 0.6 + 0.6 * lighting.visibility(camera.position.x, camera.position.y, camera.position.z));
    // eye adaptation + face light + god rays
    const vis = lighting.update(dt, renderer, 0.92 * (1 + G.rainK * 0.15), camera.position, player.pos);
    faceLight.intensity = (1 - vis) * 0.35;
    if (rays) {
      const sp = tmpV.copy(camera.position).addScaledVector(sunDir, 200).project(camera);
      const inFront = sunDir.dot(camera.getWorldDirection(new THREE.Vector3())) > 0;
      const off = Math.hypot(sp.x, sp.y);
      rays.uniforms.uSun.value.set(sp.x * 0.5 + 0.5, sp.y * 0.5 + 0.5);
      rays.uniforms.uI.value = inFront ? 0.6 * clamp(1.6 - off * 0.6, 0, 1) * (1 - G.rainK) : 0;
    }
    if (composer) composer.render(); else renderer.render(scene, camera);
    frames++; fpsT += dt;
    if (fpsT > 1) { window.__fps = frames / fpsT; frames = 0; fpsT = 0; }
  }
  frame();
  // debug / test hooks
  window.__RAPIER = RAPIER; window.__THREE = THREE;
  window.__game = { WET, quests, minimap, trials, director, CS, relics, squad, puzzles, player, gameplay, world, nuri, orbit, input, G, scene, camera, renderer, physics, startGame, ui, audio, lighting, prints, marks, creatures, get dof() { return dof; }, get rays() { return rays; } };
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
