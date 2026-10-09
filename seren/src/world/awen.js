// 아웬: 세렌의 주민. 키 3m 남짓, 땅 위에 떠서 움직이고, 얼굴 대신 빛나는 "목소리 띠"로 노래합니다.
// 몸은 주민 무리(crowd.js)와 같은 관절 셰이더를 쓰는 인스턴스 1개(그리기 1회)입니다 — 가까이 보는 인물이라 더 고운 모델.
// 바깥에서는 자리(root.position)만 옮기고 바라볼 쪽(face)·볼 것(look)·몸짓(gesture)·말하기(speak)를 알려 주면,
// 몸이 스스로: 천천히 돌아서고(머리가 먼저), 나아갈 땐 기울고 옷자락이 끌리며, 멈추면 한 번 흔들리고 선다.
// 서 있을 땐 숨 쉬고, 무게를 옮기고, 둘레를 둘러보고, 가끔 손을 모으거나 더듬띠를 턴다. 말할 땐 손짓한다.
import * as THREE from 'three';
import { awenInstances, awenMaterial, writeAwen, flushAwen, AwenMotion } from './crowd.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const L = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

export class AwenFigure {
  constructor({ hue = 0.5, scale = 1, glow = 0x7ff3e6 } = {}) {
    this.root = new THREE.Group();
    const { g, at } = awenInstances(1, 1);
    g.instanceCount = 1;
    this.at = at;
    this.mesh = new THREE.Mesh(g, awenMaterial());
    this.mesh.frustumCulled = false;
    this.root.add(this.mesh);
    this.skin = new THREE.Color().setHSL(hue, 0.35, 0.82);
    this.deep = new THREE.Color().setHSL((hue + 0.08) % 1, 0.45, 0.58);
    this.glow = new THREE.Color(glow);
    this.scale = scale;
    this.t = Math.random() * 10;
    this.seed = Math.random();
    this.speaking = 0;
    this.gesture = 0;
    this.look = null;
    this._yaw = 0;
    this.face = null;
    this.turnRate = 0;
    this.motion = new AwenMotion(this.seed);
    this.P = { armL: 0.05, armR: 0.05, elbowL: 0.15, elbowR: 0.15, outL: 0, outR: 0, head: 0, headYaw: 0, lean: 0, twist: 0, side: 0, speakGlow: 0 };
    this._idle = { lookT: 1 + Math.random() * 3, look: 0, lookP: 0, actT: 6 + Math.random() * 8, act: null, actK: 0, swayP: Math.random() * 6 };
    this._o = { x: 0, y: 0, z: 0, yaw: 0, s: scale, phase: this.seed, skin: this.skin, deep: this.deep, glow: this.glow };
  }

  /** 방향: 바로 놓기(돌아서는 과정 없이) — 자연스럽게 돌리려면 face 를 쓴다 */
  get yaw() { return this._yaw; }
  set yaw(v) { this._yaw = v; this.face = v; this.turnRate = 0; }

  speak(sec) { this.speaking = Math.max(this.speaking, sec); }

  update(dt) {
    dt = Math.min(dt, 0.1);
    this.t += dt;
    const t = this.t, pos = this.root.position;
    this.speaking = Math.max(0, this.speaking - dt);
    const sp = this.speaking > 0 ? 1 : 0;
    const m = this.motion.out;
    const moving = m.speed > 0.25;

    // ── 돌아서기: 바라볼 쪽 = 볼 것 > 지시 > 나아가는 쪽. 각속도에 한계(빨리 돌지 않는다)와 가감속 ──
    let want = this.face;
    let lookYaw = null;
    if (this.look) {
      lookYaw = Math.atan2(this.look.x - pos.x, this.look.z - pos.z);
      // 머리로 볼 수 있으면 몸은 그대로, 많이 돌아가 있으면 몸도 그쪽으로
      if (!moving && Math.abs(wrap(lookYaw - this._yaw)) > 0.55) want = lookYaw;
    }
    if (moving && this.face == null) want = Math.atan2(this.motion.vx, this.motion.vz);
    if (want != null) {
      const d = wrap(want - this._yaw);
      const maxW = moving ? 2.4 : 1.8;
      const wantW = clamp(d * 3.2, -maxW, maxW);
      this.turnRate += clamp(wantW - this.turnRate, -9 * dt, 9 * dt);
      this._yaw += this.turnRate * dt;
      if (Math.abs(d) < 0.01 && Math.abs(this.turnRate) < 0.05) this.turnRate = 0;
    }
    this.motion.step(dt, pos.x, pos.z, this._yaw);

    // ── 자세 목표 ──
    const P = { armL: 0.05, armR: 0.05, elbowL: 0.15, elbowR: 0.15, outL: 0, outR: 0, head: 0, headYaw: 0, lean: 0.02, twist: 0, side: 0 };
    const I = this._idle;
    if (moving) {
      // 떠서 나아갈 때: 팔은 박자에 맞춰 엇갈려 가볍게 흔들고(빠르면 뒤로 젖힌다), 몸통은 살짝 비튼다
      const k = clamp(m.speed / 1.4, 0, 1.5);
      P.armL = 0.08 + m.swing * 0.32 - Math.max(0, k - 1) * 0.35; P.armR = 0.08 - m.swing * 0.32 - Math.max(0, k - 1) * 0.35;
      P.elbowL = 0.2 + Math.max(0, m.swing) * 0.35 * k; P.elbowR = 0.2 + Math.max(0, -m.swing) * 0.35 * k;
      P.outL = P.outR = 0.06 + Math.max(0, k - 1) * 0.15;
      P.twist = -m.swing * 0.1; P.lean = 0.05;
      P.headYaw = clamp(this.turnRate * 0.18, -0.4, 0.4); // 도는 쪽을 먼저 본다
      I.act = null; I.actK = 0;
    } else {
      // 서 있을 때: 숨·무게 옮기기·둘러보기·가끔 하는 버릇
      const br = Math.sin(t * 1.3 + this.seed * 6);
      P.lean = 0.02 + br * 0.015;
      P.side = Math.sin(t * 0.37 + I.swayP) * 0.035;
      P.armL = 0.06 + br * 0.02; P.armR = 0.06 - br * 0.02;
      P.elbowL = 0.18 + br * 0.03; P.elbowR = 0.18 - br * 0.03;
      I.lookT -= dt;
      if (I.lookT <= 0) {
        I.lookT = 2.5 + Math.random() * 4.5;
        const r = Math.random();
        I.look = r < 0.4 ? 0 : (Math.random() - 0.5) * 1.6;
        I.lookP = r < 0.75 ? 0 : Math.random() < 0.5 ? -0.35 : 0.3;
      }
      P.headYaw = I.look; P.head = I.lookP; P.twist = I.look * 0.2;
      I.actT -= dt;
      if (I.actT <= 0 && !this.look && !sp) { I.actT = 9 + Math.random() * 10; I.act = ['clasp', 'shake', 'reach', 'stretch'][Math.floor(Math.random() * 4)]; I.actK = 0; I.actE = 2.6; }
      if (I.act) {
        I.actE -= dt;
        const k = clamp(Math.min(2.6 - I.actE, I.actE) * 2, 0, 1);
        if (I.act === 'clasp') { P.armL = P.armR = 0.55 * k + P.armL * (1 - k); P.elbowL = P.elbowR = 0.18 + 1.05 * k; P.outL = P.outR = -0.12 * k; P.head += 0.15 * k; }
        else if (I.act === 'shake') { P.headYaw = Math.sin(t * 9) * 0.25 * k; P.head = -0.1 * k; }
        else if (I.act === 'reach') { P.armR = 0.06 + 1.0 * k; P.elbowR = 0.18 + 0.7 * k; P.head = 0.25 * k; P.headYaw = 0.25 * k; }
        else if (I.act === 'stretch') { P.armL = P.armR = 0.06 + 2.3 * k; P.elbowL = P.elbowR = 0.1; P.outL = P.outR = 0.35 * k; P.lean = -0.08 * k; P.head = -0.3 * k; }
        if (I.actE <= 0) I.act = null;
      }
    }
    // 바라보기: 머리가 먼저, 몸통이 조금 거든다 (올려다·내려다보기 포함)
    if (this.look) {
      const ly = wrap((lookYaw ?? 0) - this._yaw);
      if (Math.abs(ly) < 2.0) {
        P.headYaw = clamp(ly * 0.8, -1.0, 1.0); P.twist = clamp(ly * 0.2, -0.3, 0.3);
        const dy = (this.look.y ?? pos.y) + 1.4 - (pos.y + 3.0 * this.scale), dh = Math.hypot(this.look.x - pos.x, this.look.z - pos.z);
        P.head = clamp(-Math.atan2(dy, Math.max(0.5, dh)) * 0.8, -0.35, 0.55);
      }
    }
    // 몸짓(퀘스트·밤 노래): 두 팔을 펼쳐 올린다
    const g = Math.max(this.gesture, 0);
    if (g > 0) {
      P.armL += (0.4 + g * 1.3 + Math.sin(t * 2) * 0.15 * g - P.armL) * clamp(g * 1.5, 0, 1);
      P.armR += (0.4 + g * 1.3 + Math.sin(t * 2 + 1) * 0.15 * g - P.armR) * clamp(g * 1.5, 0, 1);
      P.outL += 0.35 * g; P.outR += 0.35 * g; P.elbowL += 0.25 * g; P.elbowR += 0.25 * g; P.head -= 0.2 * g;
    }
    // 말할 때: 한 손씩 번갈아 손짓하고 머리를 끄덕인다
    if (sp) {
      const beat = Math.sin(t * 3.1), alt = Math.sin(t * 0.8) > 0;
      if (alt) { P.armR = Math.max(P.armR, 0.38 + beat * 0.12); P.elbowR = Math.max(P.elbowR, 1.15 + beat * 0.3); P.outR += 0.12; }
      else { P.armL = Math.max(P.armL, 0.35 + beat * 0.12); P.elbowL = Math.max(P.elbowL, 1.1 + beat * 0.3); P.outL += 0.12; }
      P.head += Math.sin(t * 5.3) * 0.06;
    }
    // 멈춘 몸 기울기를 머리가 덜어 낸다 (시선은 수평을 지킨다)
    P.head -= (m.tilt + P.lean) * 0.7;

    // ── 따라가기 (관절마다 다른 빠르기: 팔은 조금 늦게, 머리는 빠르게) ──
    const Q = this.P;
    for (const k of ['armL', 'armR', 'elbowL', 'elbowR', 'outL', 'outR']) Q[k] = L(Q[k], P[k], moving ? 9 : 6, dt);
    Q.head = L(Q.head, P.head, 7, dt); Q.headYaw = L(Q.headYaw, P.headYaw, 6, dt);
    Q.lean = L(Q.lean, P.lean, 5, dt); Q.twist = L(Q.twist, P.twist, 5, dt); Q.side = L(Q.side, P.side, 4, dt);
    Q.speakGlow = L(Q.speakGlow, sp, 10, dt);

    const o = this._o;
    o.x = pos.x; o.y = pos.y; o.z = pos.z; o.yaw = this._yaw; o.s = this.scale;
    o.speak = Q.speakGlow; o.kneel = 0; o.hold = 0;
    o.armL = Q.armL; o.armR = Q.armR; o.elbowL = Q.elbowL; o.elbowR = Q.elbowR; o.outL = Q.outL; o.outR = Q.outR;
    o.head = Q.head; o.headYaw = Q.headYaw; o.lean = Q.lean; o.twist = Q.twist; o.side = Q.side;
    o.move = m.move; o.tilt = m.tilt; o.bank = m.bank; o.walk = m.walk;
    writeAwen(this.at, 0, o);
    flushAwen(this.at, 1);
  }
}
