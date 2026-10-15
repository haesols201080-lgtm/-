// Telescreens, the living range, suspicion, the Thought Police and the
// police helicopter. "There was of course no way of knowing whether you
// were being watched at any given moment."
import * as THREE from 'three';

const V = new THREE.Vector3();

const LINES = {
  outside: ['6079 스미스 W! 지금 있는 곳은 당신의 생활 범위가 아니다.', '6079 스미스 W! 돌아가라. 당신이 있을 곳이 아니다.', '시민 6079, 즉시 지정된 구역으로 돌아가라.'],
  running: ['6079 스미스 W! 뛰지 마라. 서두를 이유가 무엇인가?', '거리에서 뛰는 것은 수상한 행동이다, 동무.'],
  forbidden: ['6079 스미스 W! 손에 든 것은 무엇인가?', '6079 스미스 W! 지금 무엇을 쓰고 있나?'],
  loiter: ['동무, 거기서 무엇을 기다리고 있나?'],
  hate: ['6079 스미스 W! 증오에 동참하라!', '동무, 당신의 증오는 어디 있나?'],
  curfew: ['통행금지 시간이다. 6079 스미스 W, 즉시 귀가하라.'],
};
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export function setupSurveillance(G) {
  const screens = [];
  const flags = new Set();
  const required = new Set();
  let override = null;
  let lastSeen = null;
  let voiceCD = 0;
  let watchedK = 0;
  const S = G.state;

  const surv = {
    screens, watched: false, watchers: 0, zone: 'outskirts', outside: false, inRange: true,
    addTelescreen(t) {
      t.range = t.range ?? (t.location === 'city' ? 26 : 12);
      t.fov = t.fov ?? 150;
      t.cos = Math.cos(THREE.MathUtils.degToRad(t.fov / 2));
      screens.push(t);
      return t;
    },
    flag(name, on = true) { if (on) flags.add(name); else flags.delete(name); },
    require(name, on = true) { if (on) required.add(name); else required.delete(name); },
    add(amount, reason) {
      S.suspicion = Math.min(100, Math.max(S.record || 0, S.suspicion + amount));
      if (reason && G.ui && G.ui.toast && amount >= 5) G.ui.toast(reason);
    },
    setAllowedOverride(set) { override = set; },
    voice(kind) {
      if (voiceCD > 0 || !G.ui || !G.ui.telescreen) return;
      voiceCD = 9;
      G.ui.telescreen(pick(LINES[kind] || LINES.outside));
      if (G.audio && G.audio.play) G.audio.play('telescreen_bark', { volume: 0.8 });
    },
    lastSeen: () => lastSeen,
    helicopter: null,
  };
  G.surv = surv;
  // interiors built before us left their telescreens here
  if (G.interiors && G.interiors.telescreens) for (const t of G.interiors.telescreens) surv.addTelescreen(t);

  function sees(t, eye) {
    if (t.location !== S.location || t.off) return false;
    V.subVectors(eye, t.pos);
    const d = V.length();
    let range = t.range;
    const p = G.player;
    if (p.crouch > 0.5) range *= 0.7;
    if ((G.atmos.day ?? 1) < 0.25 && G.location && G.location.exterior) range *= 0.6;
    if (d > range) return false;
    V.divideScalar(d || 1);
    if (V.x * t.dir.x + V.y * t.dir.y + V.z * t.dir.z < t.cos) return false;
    return !G.col.blocked(t.pos.x, t.pos.z, eye.x, eye.z, t.pos.y, eye.y);
  }

  function allowed() {
    if (override) return override;
    if (G.story && G.story.allowedZones) return G.story.allowedZones();
    const m = S.minutes % 1440;
    if (m < 7 * 60 || m >= 23 * 60) return new Set(['mansions']);
    return new Set(['square', 'avenue', 'mansions', 'minitrue', 'community', 'cafe']);
  }

  // the police helicopter: hovers between the roofs like a bluebottle
  function makeHelicopter() {
    let obj;
    try { obj = G.assets.instance('helicopter'); } catch (e) { return null; }
    G.mats.apply(obj, { cast: true, receive: false });
    const heli = { obj, pos: new THREE.Vector3(0, 45, 60), target: new THREE.Vector3(0, 40, 0), t: 0, rotor: null, tail: null };
    obj.traverse((o) => { if (o.name === 'rotor') heli.rotor = o; if (o.name === 'tail_rotor') heli.tail = o; });
    const spot = new THREE.SpotLight(0xe8f0ff, 0, 140, 0.18, 0.5, 1.4);
    spot.position.set(0, -0.6, -2.4);
    obj.add(spot); obj.add(spot.target);
    spot.target.position.set(0, -40, -18);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(6, 40, 24, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xcfd8e8, transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    cone.position.set(0, -20.6, -11); cone.rotation.x = -0.42;
    obj.add(cone);
    heli.spot = spot; heli.cone = cone;
    const city = G.locations.get('city');
    if (city) city.root.add(obj); else G.scene.add(obj);
    return heli;
  }

  let heliTimer = 0;
  G.onUpdate((dt) => {
    if (!surv.helicopter && G.locations.has('city')) surv.helicopter = makeHelicopter() || false;
    voiceCD = Math.max(0, voiceCD - dt);
    const eye = G.camera.position;
    let n = 0;
    let watcher = null;
    for (const t of screens) if (sees(t, eye)) { n++; watcher = t; }
    // patrols see too
    let patrolSees = false;
    if (G.npcs) {
      for (const p of G.npcs.list) {
        if (!p.patrol || p.location !== S.location || !p.root.visible) continue;
        V.subVectors(eye, p.pos); V.y = 0;
        const d = V.length();
        if (d > p.viewCone.range) continue;
        V.divideScalar(d || 1);
        const f = p.root.rotation.y;
        if (V.x * Math.sin(f) + V.z * Math.cos(f) < Math.cos(THREE.MathUtils.degToRad(p.viewCone.fov / 2))) continue;
        if (G.col.blocked(p.pos.x, p.pos.z, eye.x, eye.z, 1.6, eye.y)) continue;
        patrolSees = true; n++;
      }
    }
    // the helicopter looks down
    const h = surv.helicopter;
    if (h && S.location === 'city') {
      heliTimer -= dt;
      if (heliTimer <= 0 || h.pos.distanceTo(h.target) < 4) {
        heliTimer = 12 + Math.random() * 14;
        const near = S.suspicion > 50 ? G.player.pos : null;
        h.target.set((near ? near.x : (Math.random() - 0.5) * 500) + (Math.random() - 0.5) * 40, 32 + Math.random() * 25,
          (near ? near.z : -150 + Math.random() * 420) + (Math.random() - 0.5) * 40);
      }
      V.subVectors(h.target, h.pos);
      const d = V.length();
      const sp = Math.min(d, dt * 16);
      h.pos.addScaledVector(V.normalize(), sp);
      h.t += dt;
      h.obj.position.set(h.pos.x, h.pos.y + Math.sin(h.t * 1.3) * 0.6, h.pos.z);
      h.obj.rotation.y += (Math.atan2(-V.x, -V.z) - h.obj.rotation.y) * Math.min(1, dt * 0.8);
      h.obj.rotation.z = Math.sin(h.t * 0.7) * 0.06;
      if (h.rotor) h.rotor.rotation.y += dt * 42;
      if (h.tail) h.tail.rotation.x += dt * 60;
      const night = (G.atmos.day ?? 1) < 0.3;
      h.spot.intensity = night ? 9000 : 0;
      h.cone.visible = night;
      const dx = eye.x - h.pos.x, dz = eye.z - h.pos.z;
      if (Math.hypot(dx, dz) < (night ? 14 : 9) && !G.col.blocked(h.pos.x, h.pos.z, eye.x, eye.z, 30, eye.y)) n++;
      if (G.audio && G.audio.helicopter) G.audio.helicopter(h.obj.position);
    }
    surv.watchers = n;
    surv.watched = n > 0;
    if (surv.watched) lastSeen = G.player.pos.clone();
    watchedK += ((surv.watched ? 1 : 0) - watchedK) * Math.min(1, dt * 3);
    G.renderer.u.uWatched.value = watchedK;

    // living range
    const loc = G.location;
    const zone = loc && loc.zone ? loc.zone(G.player.pos.x, G.player.pos.z) : 'interior';
    surv.zone = zone;
    const allow = allowed();
    surv.inRange = !loc || !loc.exterior ? !allow.has('!interior') : allow.has(zone);
    surv.outside = !surv.inRange;
    if (G.cutscene > 0 || G.paused || G.debug.godMode) return;

    // suspicion rules (per second)
    let add = 0;
    if (surv.outside) {
      if (surv.watched) { add += 6; surv.voice('outside'); }
      else add += zone === 'prole' ? 0.25 : 0.6;
      if (patrolSees) add += 10;
    }
    if (G.player.running && surv.watched && loc && loc.exterior) { add += 1.5; surv.voice('running'); }
    if (flags.has('forbidden') && surv.watched) {
      if (!surv._forbiddenHit) { surv._forbiddenHit = true; S.suspicion = Math.min(100, S.suspicion + 18); }
      add += 12; surv.voice('forbidden');
    } else surv._forbiddenHit = false;
    if (required.has('shout') && !flags.has('shouting')) { add += 8; surv.voice('hate'); }
    const m = S.minutes % 1440;
    if ((m >= 23 * 60 || m < 6 * 60) && loc && loc.exterior) { add += surv.watched ? 4 : 1; surv.voice('curfew'); }
    if (add > 0) S.suspicion = Math.min(100, S.suspicion + add * dt);
    else if (!surv.watched) S.suspicion = Math.max(S.record || 0, S.suspicion - 0.35 * dt);
    G.renderer.u.uAlarm.value = THREE.MathUtils.smoothstep(S.suspicion, 55, 95);

    // responses
    if (S.suspicion >= 70 && G.npcs) {
      for (const p of G.npcs.list) {
        if (!p.patrol || p.location !== S.location || p.investigating || !lastSeen) continue;
        p.investigating = true;
        p.investigate(lastSeen).then(() => { p.investigating = false; });
        break;
      }
      for (const p of G.npcs.list) {
        if (!p.patrol || p.location !== S.location) continue;
        if (p.pos.distanceTo(G.player.pos) < 1.6) { G.events.emit('arrest', 'patrol'); break; }
      }
    }
    if (S.suspicion >= 100 && !surv.arrested) {
      surv.arrested = true;
      G.events.emit('arrest', 'suspicion');
    }
  });

  // F3: draw the telescreens' fields of view
  let debugGroup = null;
  addEventListener('keydown', (e) => {
    if (e.code !== 'F3') return;
    if (debugGroup) { G.scene.remove(debugGroup); debugGroup = null; return; }
    debugGroup = new THREE.Group();
    for (const t of screens) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(Math.tan(THREE.MathUtils.degToRad(t.fov / 2)) * t.range * 0.3, t.range, 16, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }));
      cone.position.copy(t.pos).addScaledVector(t.dir, t.range / 2);
      cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), t.dir);
      debugGroup.add(cone);
    }
    G.scene.add(debugGroup);
  });
  return surv;
}
