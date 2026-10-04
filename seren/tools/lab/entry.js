// 캐릭터 실험실: 플레이어·아웬·주민 무리·생물을 따로 세워, 시간에 따른 자세를 격자 한 장(접촉 시트)으로 그린다.
//   node tools/lab.mjs <장면> …   (tools/lab.mjs 가 이 파일을 묶어 브라우저에서 돌리고 PNG 로 저장)
import * as THREE from 'three';
import { Atmosphere, atmosUniforms } from '../../src/world/atmosphere.js';
import { litMaterial } from '../../src/world/materials.js';
import { Avatar } from '../../src/player/avatar.js';
import { AwenFigure } from '../../src/world/awen.js';
import { Crowd, AwenMotion } from '../../src/world/crowd.js';
import * as Fauna from '../../src/world/fauna.js';

const W = 1600, H = 900;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H);
renderer.setPixelRatio(1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.style.margin = '0';
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fb2cc);
const atmos = new Atmosphere();
const clock = { sunDir: new THREE.Vector3(0.55, 0.7, 0.45).normalize(), eclipse: 0, eclipseNear: 0, urPhase: 0.4 };
atmos.update(clock, 0, 0);
atmosUniforms.uFogDensity.value = 0;
// 바닥 + 1 m 격자 (발 미끄러짐을 보려고)
const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), litMaterial({ color: 0x9a96a8 }));
scene.add(ground);
const grid = new THREE.GridHelper(400, 400, 0x5a5670, 0x6e6a82);
grid.position.y = 0.005;
scene.add(grid);
const cam = new THREE.PerspectiveCamera(32, 1, 0.05, 2000);

// ── 장면 ─────────────────────────────
const S = {};
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

/** 플레이어: seg = [{ dur, speed, state, yawRate, vy }] 구간을 이어 움직인다 */
S.player = (o) => {
  const av = new Avatar();
  av.addTo(scene);
  const p = { state: 'ground', hspeed: 0, vel: v3(0, 0, 0), yaw: o.yaw ?? 0, turn: 0, pitch: 0, pos: v3(0, 0, 0), groundH: 0 };
  let segI = 0, segT = 0, y = 0, vy = 0;
  return {
    target: () => v3(av.root.position.x, av.root.position.y + 0.85, av.root.position.z),
    step(dt) {
      const sg = o.seg[segI];
      if (!sg) return;
      segT += dt;
      if (segT > sg.dur && segI < o.seg.length - 1) { segI++; segT = 0; }
      const g = o.seg[segI];
      // 속도는 부드럽게 (가속 14 m/s², 마찰 22)
      const want = g.speed || 0;
      const a = want > p.hspeed ? 55 : 34; // player.js TUNING 의 accel·friction
      p.hspeed += Math.sign(want - p.hspeed) * Math.min(Math.abs(want - p.hspeed), a * dt);
      const yr = g.yawRate || 0;
      p.yaw += yr * dt;
      p.turn = Math.max(-1, Math.min(1, yr / 4));
      p.state = g.state || 'ground';
      if (g.jump && segT <= dt) { vy = g.jump; }
      if (vy || y > 0) { vy -= 22 * dt; y += vy * dt; if (y <= 0) { y = 0; vy = 0; av.landSquash = 1; } p.state = y > 0 ? 'air' : p.state; }
      p.vel.set(Math.sin(p.yaw) * p.hspeed, vy, Math.cos(p.yaw) * p.hspeed);
      p.pos.x += p.vel.x * dt; p.pos.z += p.vel.z * dt; p.pos.y = y;
      if (o.look) av.lookAt = v3(p.pos.x + 3, 1.6, p.pos.z + 2);
      av.update(dt, p);
    },
  };
};

/** 아웬 하나: path = [{ dur, speed, yawRate, look, gesture, speak }] */
S.awen = (o) => {
  const f = new AwenFigure({ hue: o.hue ?? 0.48, glow: 0x7ff3e6 });
  scene.add(f.root);
  let segI = 0, segT = 0, sp = 0, yaw = 0;
  const pos = f.root.position;
  return {
    target: () => v3(pos.x, 1.6, pos.z),
    step(dt) {
      segT += dt;
      if (segT > o.seg[segI].dur && segI < o.seg.length - 1) { segI++; segT = 0; }
      const g = o.seg[segI];
      sp += Math.sign((g.speed || 0) - sp) * Math.min(Math.abs((g.speed || 0) - sp), 3 * dt);
      yaw += (g.yawRate || 0) * dt;
      pos.x += Math.sin(yaw) * sp * dt; pos.z += Math.cos(yaw) * sp * dt;
      f.face = yaw;
      f.look = g.look ? v3(pos.x + 4, 1.6, pos.z + 6) : null;
      f.gesture = g.gesture || 0;
      if (g.speak) f.speak(0.2);
      f.update(dt);
    },
  };
};

/** 주민 무리: 셰이더 자세 (움직이는 사람은 AwenMotion 으로 기울기·옷자락) */
S.crowd = (o) => {
  const c = new Crowd(scene, 16);
  const people = o.people.map((q, i) => ({ ...q, x: (i - (o.people.length - 1) / 2) * 2.6, z: 0, yaw: q.yaw ?? 0.6, mo: new AwenMotion(i * 0.13) }));
  let t = 0;
  return {
    target: () => v3(0, 1.6, 0),
    step(dt) {
      t += dt;
      atmosUniforms.uTime.value = t;
      c.begin();
      for (const q of people) {
        const mv = q.move || 0;
        if (mv) { q.yaw += (q.turn || 0) * dt; q.x += Math.sin(q.yaw) * mv * 1.4 * dt; q.z += Math.cos(q.yaw) * mv * 1.4 * dt; }
        const m = q.mo.step(dt, q.x, q.z, q.yaw);
        c.push({ x: q.x, y: 0, z: q.z, yaw: q.yaw, s: 1, phase: q.ph || 0, speak: q.speak || 0, kneel: q.kneel || 0,
          armL: (q.armL || 0.06) + m.swing * 0.3, armR: (q.armR || 0.06) - m.swing * 0.3, head: q.head || 0, hold: q.hold || 0,
          lean: q.lean ?? 0.04, bank: m.bank, move: m.move, tilt: m.tilt, walk: m.walk, headYaw: q.headYaw || 0, elbowL: q.elbowL ?? 0.2, elbowR: q.elbowR ?? 0.2, outL: q.outL || 0, outR: q.outR || 0,
          skin: new THREE.Color().setHSL(q.hue ?? 0.5, 0.35, 0.82), deep: new THREE.Color().setHSL(((q.hue ?? 0.5) + 0.08) % 1, 0.45, 0.58), glow: new THREE.Color(0x7ff3e6) });
      }
      c.end();
    },
  };
};

/** 생물 한 종: fauna.js 의 미리보기 */
S.fauna = (o) => {
  const L = Fauna.labSubject(scene, o.species, o);
  return { target: () => L.target(), step: (dt) => L.step(dt) };
};

// ── 접촉 시트 ────────────────────────
window.LAB = {
  run(o) {
    while (scene.children.length > 2) scene.remove(scene.children[2]);
    const sub = S[o.subject](o);
    const cols = o.cols || 6, rows = Math.ceil(o.frames / cols);
    const cw = Math.floor(W / cols), ch = Math.floor(H / rows);
    const dt = 1 / 60;
    renderer.setScissorTest(true);
    renderer.setClearColor(0x8fb2cc);
    renderer.clear();
    let t = 0;
    for (let i = 0; i < (o.warm || 0) * 60; i++) { sub.step(dt); t += dt; }
    for (let f = 0; f < o.frames; f++) {
      const steps = Math.round((o.every || 0.1) * 60);
      for (let i = 0; i < steps; i++) { sub.step(dt); t += dt; atmosUniforms.uTime.value = t; }
      const tg = sub.target();
      const view = o.view || 'side';
      const d = o.dist || 5.5;
      const off = view === 'side' ? v3(d, 0.4, 0) : view === 'front' ? v3(0, 0.4, d) : view === 'back' ? v3(0, 1.0, -d) : view === 'top' ? v3(0.01, d, 0) : v3(d * 0.75, d * 0.35, d * 0.75);
      cam.position.copy(tg).add(off);
      cam.lookAt(tg);
      cam.aspect = cw / ch;
      cam.updateProjectionMatrix();
      const x = (f % cols) * cw, y = H - (Math.floor(f / cols) + 1) * ch;
      renderer.setViewport(x, y, cw - 2, ch - 2);
      renderer.setScissor(x, y, cw - 2, ch - 2);
      renderer.render(scene, cam);
    }
    renderer.setScissorTest(false);
    return true;
  },
};
