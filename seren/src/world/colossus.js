// 거신: 느린땅을 천천히 걸어 다니는 도시 기계.
// 여섯 다리(두 마디)를 절차적으로 움직입니다 — 발은 땅에 박혀 있다가, 몸이 멀어지면 세 개씩 번갈아 들어 앞으로 내딛습니다.
// 가장 큰 거신의 등에는 마을 「걸음마을」과 느린땅의 큰 공명탑이 실려 있고, 배 밑에서 오르는 기류를 타면 올라갈 수 있습니다.
import * as THREE from 'three';
import { heightAt } from './heightfield.js';
import { mulberry32 } from '../core/noise.js';
import { part, merge, xf, lathe } from './geo-utils.js';
import * as A from './arch.js';
import { litMaterial, glowMaterial } from './materials.js';
import { PointLights } from './lights.js';

const PAL = A.PAL;
const _v = new THREE.Vector3(), _u = new THREE.Vector3(), _n = new THREE.Vector3(), _k = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

// 거신 정의: 고리 경로(중심·반지름), 크기, 속도, 마을을 싣는가
const WALKERS = [
  { id: 'walker-town', name: '걸음마을', cx: 2000, cz: 43000, R: 4200, dir: 1, scale: 1, speed: 5.2, town: true, phase: 0 },
  { id: 'walker-2', name: '짐거신', cx: -1500, cz: 45000, R: 6500, dir: -1, scale: 0.75, speed: 6, town: false, phase: 2 },
  { id: 'walker-3', name: '어린 거신', cx: 6000, cz: 40500, R: 3000, dir: 1, scale: 0.6, speed: 6.5, town: false, phase: 4 },
];

function bodyGeo(town) {
  const parts = [];
  // 껍질: 앞뒤로 긴 반타원체 (배는 어두운 판, 등은 진주빛)
  const shell = lathe([[0.0001, -150], [40, -138], [62, -100], [72, -40], [72, 30], [64, 90], [44, 132], [0.0001, 148]], 40);
  shell.rotateX(Math.PI / 2);
  shell.scale(1, 0.62, 1);
  parts.push(part(shell, (x, y) => (y > 6 ? 0xe2d8c6 : y > -10 ? 0xc8b89c : 0x5a4e48), (x, y) => (Math.abs(y + 4) < 1.5 ? 1.4 : 0)));
  // 등의 갑판
  parts.push(part(xf(new THREE.CircleGeometry(1, 48), { y: 41, rx: -Math.PI / 2, sx: 60, sy: 118 }), 0x8a9a6a, 0));
  parts.push(part(xf(new THREE.TorusGeometry(1, 0.02, 4, 64), { y: 42, rx: Math.PI / 2, sx: 60, sy: 118, sz: 60 }), PAL.amber, 1.8));
  // 배의 공명 용골과 늘어진 종
  parts.push(part(xf(new THREE.BoxGeometry(6, 4, 230), { y: -44 }), PAL.amber, 1.6));
  for (let i = 0; i < 7; i++) parts.push(part(xf(lathe([[0.0001, 0], [6, -4], [9, -18], [10, -26], [0.0001, -27]], 10), { y: -42, z: -105 + i * 35 }), 0x6a5a50, (x, y) => (y < -24 ? 1.6 : 0)));
  // 머리: 앞쪽 감지 돔과 빛나는 눈
  parts.push(part(xf(new THREE.SphereGeometry(30, 20, 14), { z: 150, y: 4, sy: 0.7 }), 0xd8ccb4, 0));
  parts.push(part(xf(new THREE.TorusGeometry(16, 3, 8, 32), { z: 176, y: 6 }), PAL.amber, 2.2));
  parts.push(part(xf(new THREE.CircleGeometry(14, 24), { z: 177, y: 6 }), 0x1a1410, 0));
  // 다리 뿌리
  for (const side of [-1, 1]) for (const z of [-80, 0, 80]) parts.push(part(xf(new THREE.SphereGeometry(16, 12, 10), { x: side * 64, y: -6, z }), 0x5a4e48, 0));
  if (town) {
    const rnd = mulberry32(777);
    for (let i = 0; i < 16; i++) {
      const a = rnd() * Math.PI * 2, d = 0.3 + rnd() * 0.6;
      const x = Math.cos(a) * 52 * d, z = Math.sin(a) * 100 * d;
      if (Math.hypot(x, z) < 26) continue;
      const k = rnd();
      if (k < 0.6) A.place(parts, A.domeHouse({ r: 5 + rnd() * 3, h: 7, seed: 50 + i, glow: i % 2 ? PAL.amber : PAL.teal }), { x, y: 41, z });
      else if (k < 0.85) A.place(parts, A.spireTower({ h: 20 + rnd() * 25, r: 2.4, seed: 90 + i, glow: PAL.amber }), { x, y: 41, z });
      else A.place(parts, A.gardenBed({ r: 5, seed: i }), { x, y: 41, z });
    }
    // 돛처럼 솟은 공명판 둘
    for (const s of [-1, 1]) parts.push(part(xf(lathe([[0.0001, 0], [10, 6], [12, 60], [6, 110], [0.0001, 130]], 10), { x: s * 40, y: 40, z: -70, sz: 0.25 }), 0xf2e8d6, (x, y) => (y > 120 ? 1.4 : 0)));
  }
  return merge(parts);
}

export class Colossi {
  constructor(world, structures, game) {
    this.world = world;
    this.structures = structures;
    this.game = game;
    this.scene = world.scene;
    this.mat = litMaterial({ vertexColors: true, vertexEmit: true, emissive: 0xffffff, emissiveIntensity: 1.4, emissiveNight: 0.7, rim: 0.5, rimColor: 0xffe8c8, spec: 0.6 });
    this.lights = new PointLights(this.scene, 200, { minPx: 2.2, day: 0.35 });
    const legMat = litMaterial({ color: 0xcfc4b0, emissive: 0x000000, rim: 0.4, rimColor: 0xffe8c8, spec: 0.4 });
    const n = WALKERS.length * 6;
    const seg = new THREE.CylinderGeometry(1, 0.8, 1, 10, 1);
    seg.translate(0, 0.5, 0);
    this.thighs = new THREE.InstancedMesh(seg, legMat, n);
    this.shins = new THREE.InstancedMesh(seg, legMat, n);
    this.joints = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), glowMaterial({ color: PAL.amber, intensity: 0.8 }), n * 2);
    this.feet = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1.3, 1, 14).translate(0, 0.5, 0), legMat, n);
    for (const m of [this.thighs, this.shins, this.joints, this.feet]) { m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.scene.add(m); }
    const cTh = new THREE.Color(0x9a8a74), cSh = new THREE.Color(0x5a4e48);
    for (let i = 0; i < n; i++) { this.thighs.setColorAt(i, cTh); this.shins.setColorAt(i, cSh); this.feet.setColorAt(i, cSh); }
    this.list = [];
    this.t = 0;
    const townGeo = bodyGeo(true), plainGeo = bodyGeo(false);
    WALKERS.forEach((W, wi) => {
      const body = new THREE.Mesh(W.town ? townGeo : plainGeo, this.mat);
      body.scale.setScalar(W.scale);
      this.scene.add(body);
      const deck = new THREE.Object3D(); // 갑판 충돌용 (yaw 만 따라감)
      this.scene.add(deck);
      const S = W.scale;
      const w = {
        ...W, body, deck, s: W.phase * 1000, yaw: 0, pos: new THREE.Vector3(), bob: 0, legs: [],
        L1: 205 * S, L2: 245 * S, hipY: -6 * S, deckY: 41 * S, height: 150 * S,
        updraft: { x: 0, z: 0, r: 40 * S, y0: 0, y1: 0, strength: 30, enabled: true },
      };
      this.world.updrafts.push(w.updraft);
      // 갑판: 타원을 상자 셋으로 근사
      for (const [hx, hz, z] of [[44, 50, 0], [32, 30, 64], [32, 30, -64]]) this.world.colliders.add({ type: 'box', x: 0, z: z * S, hx: hx * S, hz: hz * S, rot: 0, y0: -40 * S, y1: w.deckY, obj: deck });
      let li = 0;
      for (const side of [-1, 1]) for (const z of [-80, 0, 80]) {
        const leg = { side, hz: z, idx: wi * 6 + li, group: (li + (side > 0 ? 1 : 0)) % 2, foot: new THREE.Vector3(), from: new THREE.Vector3(), to: new THREE.Vector3(), t: 1, planted: true };
        w.legs.push(leg);
        li++;
      }
      if (W.town) {
        // 갑판 위 큰 공명탑 받침 (움직이는 충돌체)
        this.world.colliders.add({ type: 'cyl', x: 0, z: 30 * S, r: 38, y0: w.deckY - 2, y1: w.deckY + 6, obj: deck });
        this.world.colliders.add({ type: 'cyl', x: 0, z: 30 * S, r: 10, y0: w.deckY + 6, y1: w.deckY + 190, walk: false, obj: deck });
      }
      this._place(w, 0, true);
      for (let i = 0; i < 6; i++) this.lights.add(0, -1e5, 0, i < 2 ? PAL.amber : 0xffe0b0, (i < 2 ? 18 : 8) * S, i < 2 ? 0 : 0.4, i * 0.2);
      w.lightBase = wi * 6;
      this.list.push(w);
    });
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3();
  }

  /** 경로 위 위치 (원을 조금 일그러뜨린 고리) */
  _pathAt(w, s, out) {
    const L = 2 * Math.PI * w.R;
    const a = w.dir * (s / L) * Math.PI * 2;
    const r = w.R * (1 + 0.15 * Math.sin(a * 3 + w.phase));
    out.set(w.cx + Math.cos(a) * r, 0, w.cz + Math.sin(a) * r);
    return out;
  }

  _place(w, dt, init = false) {
    w.s += w.speed * dt;
    const p = this._pathAt(w, w.s, _v);
    const ahead = this._pathAt(w, w.s + 30, _u);
    const yaw = Math.atan2(ahead.x - p.x, ahead.z - p.z);
    const S = w.scale;
    // 몸 높이: 다리 아래 땅의 평균 + 보폭에 따른 출렁임
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    const g = (heightAt(p.x + fx * 90 * S, p.z + fz * 90 * S) + heightAt(p.x - fx * 90 * S, p.z - fz * 90 * S) + heightAt(p.x, p.z) * 2) / 4;
    const y = Math.max(g, 0) + w.height + Math.sin(this.t * 1.0 + w.phase) * 2.5 * S;
    w.pos.set(p.x, y, p.z);
    w.yaw = yaw;
    w.body.position.copy(w.pos);
    w.body.rotation.set(0, yaw, Math.sin(this.t * 0.5 + w.phase) * 0.012);
    w.deck.position.copy(w.pos);
    w.deck.rotation.set(0, yaw, 0);
    w.deck.updateMatrixWorld();
    w.updraft.x = w.pos.x; w.updraft.z = w.pos.z;
    w.updraft.y0 = Math.max(g, 0) - 5; w.updraft.y1 = w.pos.y + w.deckY + 30;
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    // 다리
    for (const leg of w.legs) {
      const hx = leg.side * 64 * S, hz = leg.hz * S;
      leg.hip = leg.hip || new THREE.Vector3();
      leg.hip.set(w.pos.x + hx * cs + hz * sn, w.pos.y + w.hipY, w.pos.z - hx * sn + hz * cs);
      // 이상적인 발 자리: 바깥쪽 + 조금 앞
      const ox = leg.side * 320 * S, oz = hz + 45 * S;
      const ix = w.pos.x + ox * cs + oz * sn, iz = w.pos.z - ox * sn + oz * cs;
      const iy = Math.max(heightAt(ix, iz), 0);
      if (init) { leg.foot.set(ix, iy, iz); leg.t = 1; continue; }
      if (leg.t < 1) {
        leg.t = Math.min(1, leg.t + dt / 1.8);
        const k = leg.t * leg.t * (3 - 2 * leg.t);
        leg.foot.lerpVectors(leg.from, leg.to, k);
        leg.foot.y += Math.sin(Math.PI * leg.t) * 55 * S;
        if (leg.t >= 1) this._footfall(w, leg);
      } else {
        const d = Math.hypot(leg.foot.x - ix, leg.foot.z - iz);
        const myTurn = Math.floor(this.t / 2.2 + w.phase) % 2 === leg.group;
        if (d > 70 * S && myTurn) {
          leg.from.copy(leg.foot);
          // 다음 자리를 조금 더 앞으로
          const ax = ox, az = oz + 60 * S;
          const tx = w.pos.x + ax * cs + az * sn, tz = w.pos.z - ax * sn + az * cs;
          leg.to.set(tx, Math.max(heightAt(tx, tz), 0), tz);
          leg.t = 0;
        }
      }
    }
  }

  _footfall(w, leg) {
    const g = this.game;
    if (!g || !g.audio) return;
    const cam = g.engine.camera.position;
    const d = cam.distanceTo(leg.foot);
    if (d < 4000) {
      g.audio.noise({ freq: 55, q: 0.7, dur: 1.8, gain: 3.2 * w.scale, type: 'lowpass', pos: leg.foot, attack: 0.02, maxDist: 5000, wet: 0.6 });
      if (d < 600) g.rig.shake(Math.max(0, 0.6 - d / 1000) * w.scale);
      if (d < 1500 && g.particles) g.particles.emit({ pos: leg.foot, count: 18, spread: 18, flat: true, up: 6, life: 3, size: [6, 26], color: 0xb8a070, alpha: 0.4, drag: 1.2, gravity: 0.5, radius: 20 });
    }
  }

  /** 두 마디 다리 (역기구학) */
  _solve(w, leg) {
    const H = leg.hip, F = leg.foot;
    const L1 = w.L1, L2 = w.L2;
    _u.subVectors(F, H);
    let d = _u.length();
    d = Math.min(d, (L1 + L2) * 0.995);
    _u.normalize();
    // 무릎은 바깥 위로
    const cs = Math.cos(w.yaw), sn = Math.sin(w.yaw);
    _n.set(leg.side * cs * 0.4, 1.0, -leg.side * sn * 0.4).normalize();
    _n.addScaledVector(_u, -_n.dot(_u)).normalize();
    const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
    _k.copy(H).addScaledVector(_u, a).addScaledVector(_n, h);
    return _k;
  }

  _seg(mesh, i, a, b, r) {
    _v.subVectors(b, a);
    const len = _v.length();
    this._q.setFromUnitVectors(UP, _v.multiplyScalar(1 / Math.max(len, 1e-4)));
    this._s.set(r, len, r);
    this._m.compose(a, this._q, this._s);
    mesh.setMatrixAt(i, this._m);
  }

  update(dt) {
    this.t += dt;
    const knee = new THREE.Vector3();
    for (const w of this.list) {
      this._place(w, dt);
      const S = w.scale;
      for (const leg of w.legs) {
        knee.copy(this._solve(w, leg));
        this._seg(this.thighs, leg.idx, leg.hip, knee, 11 * S);
        this._seg(this.shins, leg.idx, knee, leg.foot, 8 * S);
        this._m.compose(knee, this._q.identity(), this._s.setScalar(13 * S));
        this.joints.setMatrixAt(leg.idx * 2, this._m);
        this._m.compose(leg.hip, this._q.identity(), this._s.setScalar(9 * S));
        this.joints.setMatrixAt(leg.idx * 2 + 1, this._m);
        this._m.compose(leg.foot, this._q.identity(), this._s.set(18 * S, 6 * S, 18 * S));
        this.feet.setMatrixAt(leg.idx, this._m);
      }
      // 불빛: 눈 둘 + 갑판 가장자리
      const cs = Math.cos(w.yaw), sn = Math.sin(w.yaw);
      const L = (lx, ly, lz, i) => this.lights.set(w.lightBase + i, w.pos.x + (lx * cs + lz * sn) * S, w.pos.y + ly * S, w.pos.z + (-lx * sn + lz * cs) * S);
      L(-8, 6, 178, 0); L(8, 6, 178, 1); L(-60, 42, 0, 2); L(60, 42, 0, 3); L(0, 42, -118, 4); L(0, 160, -70, 5);
    }
    for (const m of [this.thighs, this.shins, this.joints, this.feet]) m.instanceMatrix.needsUpdate = true;
    // 등에 실린 큰 공명탑을 따라 옮긴다
    const P = this.structures.pylons.get('plains-pylon');
    const tw = this.town;
    if (P && tw) {
      this.deckPoint(tw, 0, 30, _v);
      P.x = _v.x; P.y = _v.y; P.z = _v.z;
      P.group.position.copy(_v);
      P.group.rotation.y = tw.yaw;
      P.updraft.x = P.x; P.updraft.z = P.z; P.updraft.y0 = P.y; P.updraft.y1 = P.y + 260 * P.S;
      P.well.x = P.x; P.well.z = P.z;
      if (P.slot >= 0) this.world.atmos.setSilence(P.slot, P.x, P.z, P.silenceR, (1 - P.k) * P.silenceMax);
    }
    for (const w of this.list) for (const c of this.world.colliders.dynamic) if (c.obj === w.deck) this.world.colliders.updateDynamic(c);
    this.lights.update();
  }

  /** 갑판 위의 한 점 (지역 좌표 → 세계) */
  deckPoint(w, lx, lz, out = new THREE.Vector3()) {
    const cs = Math.cos(w.yaw), sn = Math.sin(w.yaw), S = w.scale;
    return out.set(w.pos.x + (lx * cs + lz * sn) * S, w.pos.y + w.deckY, w.pos.z + (-lx * sn + lz * cs) * S);
  }

  get town() { return this.list.find((w) => w.town); }
}
