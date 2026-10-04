// 주인공 모델: 크림색 탐사복, 산호빛 목도리, 어두운 바이저, 날개 팩, 스키머 보드.
// 모든 동작은 관절 각도를 직접 계산하는 절차적 애니메이션입니다.
import * as THREE from 'three';
import { litMaterial, glowMaterial } from '../world/materials.js';
import { skiffGeo, boatMaterial } from '../world/boats.js';

const SUIT = 0xe9e2d4;
const SUIT_DARK = 0x6a6f80;
const ACCENT = 0xff7a52;
const SCARF = 0xff6a4a;

function capsule(r, len, mat, seg = 8) {
  const g = new THREE.CapsuleGeometry(r, len, 4, seg);
  g.translate(0, -len / 2 - r, 0); // 위쪽 끝이 원점 (관절)
  return new THREE.Mesh(g, mat);
}

export class Avatar {
  constructor() {
    this.root = new THREE.Group();
    this.root.name = 'avatar';
    this.body = new THREE.Group(); // 기울임·회전용 (골반 높이가 회전 중심)
    this.body.position.y = 0.93;
    this.root.add(this.body);

    const suit = litMaterial({ color: SUIT, rim: 0.5, rimColor: 0xffe9c8, spec: 0.25 });
    const dark = litMaterial({ color: SUIT_DARK, rim: 0.3 });
    const accent = litMaterial({ color: ACCENT, rim: 0.4, rimColor: 0xffb090 });
    const visor = litMaterial({ color: 0x1a2a3a, rim: 0.9, rimColor: 0x7ff3e6, spec: 1.6, emissive: 0x0a3a40, emissiveIntensity: 0.6 });
    this.glowMat = glowMaterial({ color: 0x7ff3e6, intensity: 1.6 });
    this.mats = { suit, dark, accent, visor };

    // 골반
    this.hips = new THREE.Group();
    this.hips.position.y = 0;
    this.body.add(this.hips);
    const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 8), dark);
    pelvis.scale.set(1.1, 0.8, 0.85);
    this.hips.add(pelvis);

    // 몸통
    this.spine = new THREE.Group();
    this.spine.position.y = 0.05;
    this.hips.add(this.spine);
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.3, 4, 12), suit);
    torso.position.y = 0.27;
    torso.scale.set(1.05, 1, 0.82);
    this.spine.add(torso);
    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.035, 6, 16), accent);
    belt.rotation.x = Math.PI / 2;
    belt.position.y = 0.06;
    belt.scale.set(1.08, 0.86, 1);
    this.spine.add(belt);
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.05), dark);
    chest.position.set(0, 0.36, 0.15);
    this.spine.add(chest);
    const chestLight = new THREE.Mesh(new THREE.CircleGeometry(0.025, 12), this.glowMat);
    chestLight.position.set(0.06, 0.37, 0.177);
    this.spine.add(chestLight);

    // 날개 팩
    this.pack = new THREE.Group();
    this.pack.position.set(0, 0.32, -0.17);
    this.spine.add(this.pack);
    const packBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.22, 4, 10), suit);
    packBody.scale.set(1.3, 1, 0.75);
    this.pack.add(packBody);
    const packStripe = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.3, 0.02), this.glowMat);
    packStripe.position.set(0, 0, -0.085);
    this.pack.add(packStripe);
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22, 6), accent);
    fin.position.set(0, 0.2, -0.04);
    this.pack.add(fin);

    // 머리
    this.neck = new THREE.Group();
    this.neck.position.y = 0.55;
    this.spine.add(this.neck);
    this.head = new THREE.Group();
    this.head.position.y = 0.14;
    this.neck.add(this.head);
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.165, 20, 14), suit);
    helmet.scale.set(0.95, 1.02, 1);
    this.head.add(helmet);
    const vis = new THREE.Mesh(new THREE.SphereGeometry(0.152, 20, 14, -Math.PI * 0.42, Math.PI * 0.84, Math.PI * 0.28, Math.PI * 0.36), visor);
    vis.position.z = 0.03;
    vis.scale.set(1, 1, 1.03);
    this.head.add(vis);
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16), dark);
    ant.position.set(0.11, 0.14, -0.03);
    ant.rotation.z = -0.3;
    this.head.add(ant);
    const antTip = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), this.glowMat);
    antTip.position.set(0.135, 0.215, -0.03);
    this.head.add(antTip);

    // 팔
    const mkArm = (side) => {
      const sh = new THREE.Group();
      sh.position.set(side * 0.24, 0.44, 0);
      this.spine.add(sh);
      const pad = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), accent);
      pad.scale.set(1, 0.8, 1);
      sh.add(pad);
      sh.add(capsule(0.058, 0.2, suit));
      const el = new THREE.Group();
      el.position.y = -0.31;
      sh.add(el);
      el.add(capsule(0.052, 0.2, suit));
      const glove = new THREE.Mesh(new THREE.SphereGeometry(0.062, 10, 8), dark);
      glove.position.y = -0.33;
      glove.scale.set(0.9, 1.1, 0.8);
      el.add(glove);
      return { sh, el, glove };
    };
    this.armL = mkArm(-1);
    this.armR = mkArm(1);
    // 공명기 (오른손목)
    this.resonator = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.018, 8, 18), this.glowMat);
    this.resonator.position.y = -0.24;
    this.resonator.rotation.x = Math.PI / 2;
    this.armR.el.add(this.resonator);

    // 다리
    const mkLeg = (side) => {
      const hip = new THREE.Group();
      hip.position.set(side * 0.1, -0.04, 0);
      this.hips.add(hip);
      hip.add(capsule(0.078, 0.3, dark));
      const knee = new THREE.Group();
      knee.position.y = -0.44;
      hip.add(knee);
      knee.add(capsule(0.068, 0.3, suit));
      const kneePad = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), accent);
      kneePad.position.set(0, -0.02, 0.04);
      knee.add(kneePad);
      // 발목: 디딘 발은 땅에 평평하게, 차고 나갈 때 뒤꿈치가 들리고, 앞으로 옮길 때 발끝이 든다
      const ankle = new THREE.Group();
      ankle.position.y = -0.4;
      knee.add(ankle);
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.1, 0.24), dark);
      boot.position.set(0, -0.03, 0.04);
      ankle.add(boot);
      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.135, 0.025, 0.25), accent);
      sole.position.set(0, -0.075, 0.04);
      ankle.add(sole);
      return { hip, knee, ankle, boot };
    };
    this.legL = mkLeg(-1);
    this.legR = mkLeg(1);

    // 날개 (활공): 등판과 같은 평면(XY)에 펼쳐진다 — 몸을 앞으로 눕히면 수평이 된다
    this.wings = new THREE.Group();
    this.wings.position.set(0, 0.04, -0.08);
    this.pack.add(this.wings);
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0.12);
    wingShape.bezierCurveTo(0.7, 0.42, 1.55, 0.36, 2.15, 0.12);
    wingShape.bezierCurveTo(1.8, -0.02, 1.5, -0.2, 1.3, -0.38);
    wingShape.bezierCurveTo(1.0, -0.26, 0.7, -0.5, 0.5, -0.6);
    wingShape.bezierCurveTo(0.35, -0.38, 0.15, -0.26, 0, -0.16);
    const wGeo = new THREE.ShapeGeometry(wingShape, 14);
    this.wingMat = litMaterial({ color: 0xd8fbff, emissive: 0x3aa8c8, emissiveIntensity: 0.9, emissiveNight: 0.6, rim: 1.0, rimColor: 0xbffff4, transparent: true, opacity: 0.78, side: THREE.DoubleSide });
    const ribMat = glowMaterial({ color: 0xbffcff, intensity: 2.2 });
    const ribPts = [[0, 0.1], [0.7, 0.36], [1.5, 0.32], [2.15, 0.12]];
    const ribGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ribPts.map(([x, y]) => new THREE.Vector3(x, y, 0.005))), 16, 0.018, 4, false);
    this.wingTips = [];
    for (const side of [-1, 1]) {
      const w = new THREE.Group();
      w.add(new THREE.Mesh(wGeo, this.wingMat));
      w.add(new THREE.Mesh(ribGeo, ribMat));
      const tip = new THREE.Object3D();
      tip.position.set(2.15, 0.12, 0);
      w.add(tip);
      this.wingTips.push(tip);
      w.scale.set(side, 1, 1);
      this.wings.add(w);
      if (side < 0) this.wingL = w; else this.wingR = w;
    }
    this.wings.visible = false;
    this.wingOpen = 0;

    // 목도리 (줄 시뮬레이션)
    this.scarfN = 9;
    this.scarfPts = [];
    this.scarfPrev = [];
    for (let i = 0; i < this.scarfN; i++) { this.scarfPts.push(new THREE.Vector3()); this.scarfPrev.push(new THREE.Vector3()); }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.scarfN * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    sg.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(this.scarfN * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    const sidx = [];
    for (let i = 0; i < this.scarfN - 1; i++) { const a = i * 2; sidx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    sg.setIndex(sidx);
    this.scarf = new THREE.Mesh(sg, litMaterial({ color: SCARF, rim: 0.6, rimColor: 0xffc0a0, side: THREE.DoubleSide }));
    this.scarf.frustumCulled = false;
    this.scarfInit = false;
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.045, 8, 16), this.scarf.material);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 0.53;
    this.spine.add(collar);
    this.scarfAnchor = new THREE.Object3D();
    this.scarfAnchor.position.set(0, 0.52, -0.12);
    this.spine.add(this.scarfAnchor);

    // 스키머
    this.board = new THREE.Group();
    const boardMat = litMaterial({ color: 0xf2efe8, rim: 0.6, spec: 0.8, rimColor: 0xbffcff });
    const deck = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), boardMat);
    deck.scale.set(0.36, 0.06, 1.05);
    this.board.add(deck);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 1.6), litMaterial({ color: ACCENT }));
    stripe.position.y = 0.05;
    this.board.add(stripe);
    this.boardGlow = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.06, 6, 28), glowMaterial({ color: 0x7ff3e6, intensity: 2.2 }));
    this.boardGlow.rotation.x = Math.PI / 2;
    this.boardGlow.scale.set(0.55, 1.5, 1);
    this.boardGlow.position.y = -0.07;
    this.board.add(this.boardGlow);
    this.board.visible = false;
    this.root.add(this.board);
    // 빌린 나룻배
    this.skiff = new THREE.Mesh(skiffGeo(), boatMaterial());
    this.skiff.visible = false;
    this.root.add(this.skiff);

    // 그림자 (원판)
    const sh = new THREE.Mesh(new THREE.CircleGeometry(0.5, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2;
    sh.renderOrder = 2;
    this.shadow = sh;

    this.phase = 0;
    this.t = 0;
    this.landSquash = 0;
    this.toneGlow = 0;
    this.toneColor = new THREE.Color(0x7ff3e6);
    this.lean = 0;
    this._v = new THREE.Vector3();
    this._w = new THREE.Vector3();
  }

  /** 하는 일의 몸짓을 sec 초 동안 (실내 운영) */
  act(pose, sec = 1.5) { this._act = { pose, t: sec }; }
  /** 손에 든 것: null | { kind: 'basket'|'box'|'crate'|'tray'|'crystal'|'vial'|'book', n, color } */
  setHeld(h) {
    this.held = h;
    if (!this._heldMeshes) this._heldMeshes = {};
    for (const m of Object.values(this._heldMeshes)) m.visible = false;
    if (!h) return;
    const k = h.kind === 'basket' ? 'basket' : ['tray', 'crystal', 'vial', 'book'].includes(h.kind) ? h.kind : 'box';
    let m = this._heldMeshes[k];
    if (!m) {
      m = new THREE.Group();
      const mat = litMaterial({ color: 0xffffff, rim: 0.4, spec: 0.5, emissive: 0x111111 });
      m.userData.mat = mat;
      if (k === 'basket') {
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.13, 0.16, 12, 1, true), litMaterial({ color: 0x7ff3e6, rim: 0.6, side: THREE.DoubleSide }));
        b.position.y = -0.2;
        const hdl = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.012, 6, 16, Math.PI), litMaterial({ color: 0xe8e2d6 }));
        hdl.position.y = -0.12;
        const fill = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.12, 0.08, 10), mat);
        fill.position.y = -0.18;
        m.add(b, hdl, fill);
        m.userData.fill = fill;
        m.position.y = -0.36;
        this.armR.el.add(m);
      } else {
        const geo = k === 'tray' ? new THREE.BoxGeometry(0.46, 0.04, 0.32) : k === 'crystal' ? new THREE.OctahedronGeometry(0.16) : k === 'vial' ? new THREE.CylinderGeometry(0.05, 0.05, 0.2, 10) : k === 'book' ? new THREE.BoxGeometry(0.26, 0.06, 0.2) : new THREE.BoxGeometry(0.42, 0.3, 0.32);
        const body = new THREE.Mesh(geo, mat);
        m.add(body);
        if (k === 'tray') { const dish = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), litMaterial({ color: 0xffc46a, emissive: 0x332200 })); dish.position.y = 0.02; m.add(dish); }
        if (k === 'box') { const band = new THREE.Mesh(new THREE.BoxGeometry(0.43, 0.05, 0.33), glowMaterial({ color: 0x7ff3e6, intensity: 1.2 })); band.position.y = 0.06; m.add(band); }
        m.position.set(0, k === 'box' ? 0.12 : 0.2, 0.36);
        this.spine.add(m);
      }
      this._heldMeshes[k] = m;
    }
    m.visible = true;
    const col = h.color ?? (k === 'box' ? 0xc8b48a : k === 'crystal' ? 0xffd9a0 : k === 'vial' ? 0x9ff6ff : k === 'book' ? 0xb9a6ff : 0xffffff);
    if (m.userData.mat.uniforms && m.userData.mat.uniforms.uColor) m.userData.mat.uniforms.uColor.value.set(col);
    else if (m.userData.mat.color) m.userData.mat.color.set(col);
    if (m.userData.fill) m.userData.fill.scale.y = Math.min(1.8, 0.3 + (h.n || 1) * 0.12);
  }

  addTo(scene) {
    this.root.userData.indoor = this.scarf.userData.indoor = this.shadow.userData.indoor = true; // 실내 공간에서도 보인다
    scene.add(this.root);
    scene.add(this.scarf);
    scene.add(this.shadow);
  }

  playTone(color) {
    this.toneGlow = 1;
    this.toneColor.set(color);
  }

  /**
   * p: 플레이어 상태 { state, hspeed, vel, yaw, pitch, turn, groundH, pos }
   * 몸짓은 「목표 자세」를 매 프레임 계산하고 부드럽게 따라간다.
   *  · 걷기·달리기: 보폭에 맞춘 박자(발이 미끄러지지 않게), 디딤(평평한 발)·차기(뒤꿈치 듦)·흔들기(무릎·발끝 듦),
   *    디딘 다리 길이로 골반 높이를 풀어 발을 땅에 붙인다, 골반·어깨의 반대 비틀림, 머리는 시선을 수평으로
   *  · 서 있기: 숨쉬기·무게 옮기기·둘러보기·손목 공명기 보기 · 제자리 돌기: 작은 걸음 · 출발·멈춤: 몸을 숙이고 젖힌다
   *  · 공중: 오를 때 무릎을 모으고, 떨어질 때 다리를 펴 착지를 준비한다 · 가까운 것을 바라본다(lookAt)
   */
  update(dt, p) {
    this.t += dt;
    const s = p.state;
    const speed = p.hspeed;
    const L = (a, b, k) => a + (b - a) * Math.min(1, k * dt);
    dt = Math.max(1e-4, dt);

    this.root.position.copy(p.pos);
    this.root.rotation.set(0, p.yaw, 0);

    // 속도 변화(가속·감속)와 도는 빠르기
    const acc = (speed - (this._lastSpeed ?? speed)) / dt;
    this._lastSpeed = speed;
    let dyaw = p.yaw - (this._lastYaw ?? p.yaw);
    dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
    this._lastYaw = p.yaw;
    this.yawRate = L(this.yawRate || 0, dyaw / dt, 10);
    this.accel = L(this.accel || 0, Math.max(-40, Math.min(40, acc)), 8);

    // 목표 자세 (각도: 다리 hip* 는 앞으로 +, 무릎 knee* 는 굽힘 +, 발 foot* 는 발끝 내림 +)
    const P = {
      hipL: 0, hipR: 0, kneeL: 0.05, kneeR: 0.05, footL: 0, footR: 0, spreadL: 0.04, spreadR: 0.04,
      shL: 0.05, shR: 0.05, shZL: 0.12, shZR: 0.12, elL: -0.15, elR: -0.15,
      spineX: 0.02, spineY: 0, spineZ: 0, pelvisY: 0, hipsX: 0,
      headX: 0, headY: 0, bodyPitch: 0, bodyRoll: 0, bodyYaw: 0, hipsY: null, wing: 0,
    };
    let kPose = 10;

    if (s === 'ground' || s === 'swim') {
      const turning = speed < 0.9 && Math.abs(this.yawRate) > 0.9;
      if (speed > 0.25 || turning) this._gait(dt, speed, turning, P);
      else this._idle(dt, P);
      // 출발할 땐 앞으로 숙이고, 세게 멈출 땐 몸을 젖히고 한 발을 앞에 버틴다
      const lean = Math.max(-0.2, Math.min(0.22, this.accel * 0.018));
      if (lean > 0) P.spineX += lean;
      this.brake = L(this.brake || 0, this.accel < -12 && speed > 1.2 ? 1 : 0, this.accel < -12 ? 12 : 4);
      if (this.brake > 0.01) {
        const b = this.brake;
        P.spineX += -0.18 * b; P.hipL += (0.5 - P.hipL) * b; P.kneeL += (0.12 - P.kneeL) * b; P.hipR += (-0.25 - P.hipR) * b; P.kneeR += (0.6 - P.kneeR) * b;
        P.shL += (-0.5 - P.shL) * b; P.shR += (-0.45 - P.shR) * b; P.elL += (-0.4 - P.elL) * b; P.elR += (-0.4 - P.elR) * b; P.footL = -0.15 * b;
      }
      P.bodyRoll = -p.turn * 0.25 * Math.min(1, speed / 9);
      kPose = speed > 0.25 || turning ? 30 : 9;
      if (s === 'swim') {
        P.bodyPitch = 1.2; P.hipsY = 0.3;
        P.shL = -2.2 + Math.sin(this.t * 3) * 0.6; P.shR = P.shL; P.shZL = 0.6 + Math.cos(this.t * 3) * 0.4; P.shZR = P.shZL;
        P.hipL = Math.sin(this.t * 4) * 0.3; P.hipR = -P.hipL; P.kneeL = P.kneeR = 0.3; P.footL = P.footR = 0.6;
        kPose = 10;
      }
    } else if (s === 'air') {
      // 오를 때: 무릎을 모아 올리고 팔을 벌린다 · 떨어질 때: 다리를 펴 땅을 찾고 팔로 균형
      //   막 뛰었을 때(빠르게 오름): 다리는 밀어 낸 채 펴지고 발끝이 아래, 팔은 앞위로 휘둘러 올린다
      //   꼭대기: 무릎을 모은다 · 내려올 때: 다리를 펴 땅을 찾고 팔을 벌려 균형
      const vy = p.vel.y;
      const push = Math.max(0, Math.min(1, (vy - 4.5) / 3.5));
      const top = Math.max(0, 1 - Math.abs(vy) / 6) * (1 - push);
      const down = Math.max(0, Math.min(1, -vy / 9));
      P.hipL = 0.1 * push + 0.85 * top + 0.35 * down; P.kneeL = 0.12 * push + 1.3 * top + 0.35 * down;
      P.hipR = -0.18 * push + 0.45 * top + 0.05 * down; P.kneeR = 0.25 * push + 0.95 * top + 0.25 * down;
      P.footL = 0.6 * push + 0.3 * top + 0.05; P.footR = 0.75 * push + 0.25 * top + 0.05;
      P.shL = -1.6 * push - 0.6 * top - 0.85 * down; P.shR = -1.4 * push - 0.45 * top - 0.95 * down;
      P.shZL = 0.2 * push + 0.6 * top + 0.75 * down; P.shZR = 0.2 * push + 0.6 * top + 0.75 * down;
      P.elL = -0.3 * push - 0.7 * top - 0.4 * down; P.elR = -0.35 * push - 0.6 * top - 0.4 * down;
      P.spineX = -0.05 * push + 0.14 * top - 0.04 * down; P.headX = -0.2 * push - 0.05 * top + 0.22 * down;
      P.hipsY = 0.93;
      kPose = 9;
    } else if (s === 'glide' || s === 'current') {
      P.wing = 1;
      P.bodyPitch = 1.25 + (p.pitch || 0) * 0.6;
      P.bodyRoll = -p.turn * 0.7;
      P.hipL = 0.05; P.hipR = -0.02; P.kneeL = 0.15; P.kneeR = 0.25; P.footL = P.footR = 0.7;
      P.shL = -1.3; P.shR = -1.3; P.shZL = 1.1; P.shZR = 1.1; P.elL = -0.3; P.elR = -0.3;
      P.headX = -0.9; P.hipsY = 0.93;
      if (s === 'current') { P.shL = -2.6; P.shR = -2.6; P.shZL = 0.25; P.shZR = 0.25; P.wing = 0.35; }
    } else if (s === 'skim') {
      P.hipsY = 0.9;
      P.hipL = 0.55; P.hipR = -0.15; P.kneeL = 0.9; P.kneeR = 0.55; P.footL = -0.35; P.footR = 0.1;
      P.spineX = 0.35; P.spineY = 0.25;
      P.shL = -0.4; P.shR = 0.3; P.shZL = 0.9; P.shZR = 0.9; P.elL = -0.5; P.elR = -0.4;
      P.bodyRoll = -p.turn * 0.55;
      P.bodyPitch = Math.max(-0.3, Math.min(0.3, -(p.vel.y || 0) * 0.03));
      P.headX = -0.2; P.headY = -0.25;
    } else if (s === 'fly') {
      // 나룻배 조종: 키 고리를 두 손으로
      P.hipL = 0.2; P.hipR = -0.15; P.kneeL = 0.3; P.kneeR = 0.25;
      P.spineX = 0.15;
      P.shL = -0.75; P.shR = -0.75; P.shZL = 0.25; P.shZR = 0.25; P.elL = -0.9; P.elR = -0.9;
      P.bodyRoll = -p.turn * 0.3; P.headX = -0.1;
    } else if (s === 'down') {
      P.bodyPitch = -1.45; P.bodyRoll = 0.15;
      P.hipL = -0.1; P.hipR = 0.05; P.kneeL = 0.5; P.kneeR = 0.1;
      P.shL = 0.3; P.shR = -0.2; P.shZL = 0.9; P.shZR = 0.5; P.elL = -0.4; P.elR = -0.2; P.headX = 0.3;
      P.hipsY = 0.2;
    } else if (s === 'lift') {
      P.hipL = -0.1; P.hipR = -0.1; P.kneeL = 0.3; P.kneeR = 0.3;
      P.shL = -0.3; P.shR = -0.3; P.shZL = 1.0; P.shZR = 1.0; P.headX = -0.4; P.spineX = -0.1;
    }

    // 공명 연주: 오른팔을 앞으로 뻗고 손목을 본다
    this.toneGlow = Math.max(0, this.toneGlow - dt * 1.6);
    if (this.toneGlow > 0 && s !== 'glide' && s !== 'skim' && s !== 'current' && s !== 'fly') {
      const k = Math.min(1, this.toneGlow * 2.5);
      P.shR += (-1.5 - P.shR) * k; P.shZR += (0.1 - P.shZR) * k; P.elR += (-0.4 - P.elR) * k;
      P.headX += (0.15 - P.headX) * k * 0.5;
    }
    this.glowMat.uniforms.uColor.value.lerp(this.toneColor, Math.min(1, dt * 6));
    this.glowMat.uniforms.uIntensity.value = 1.4 + this.toneGlow * 4;
    if (this.toneGlow <= 0) this.glowMat.uniforms.uColor.value.lerp(_teal, Math.min(1, dt * 2));

    // 손에 든 것 (실내 운영: 바구니·상자·쟁반·결정·시료·책) — 두 손으로 앞에 들거나 한 손에 건다
    const hk = this.held && this.held.kind;
    if (hk && (s === 'ground' || s === 'swim' || s === 'lift')) {
      if (hk === 'basket') { P.shR = Math.max(P.shR, -0.15) * 0.4; P.shZR = 0.22; P.elR = -0.12; }
      else { P.shL = -1.0; P.shR = -1.0; P.shZL = 0.06; P.shZR = 0.06; P.elL = -0.6; P.elR = -0.6; P.spineX -= 0.05; }
    }
    // 하는 일의 몸짓 (짧게): 집기·채우기·조작·먹기·앉기·눕기·돌보기
    if (this._act && this._act.t > 0 && s === 'ground' && speed < 0.6) {
      this._act.t -= dt;
      const w = Math.sin(this.t * 6), a = this._act.pose;
      if (a === 'reach') { P.shR = -1.75 + w * 0.1; P.elR = -0.15; P.shZR = 0.1; P.spineX += 0.08; P.headX -= 0.2; }
      else if (a === 'stock') { P.shL = P.shR = -1.25 + w * 0.15; P.elL = P.elR = -0.35; P.shZL = P.shZR = 0.08; P.spineX += 0.15; }
      else if (a === 'operate' || a === 'type' || a === 'scan') { P.shL = -0.95 + w * 0.08; P.shR = -0.95 - w * 0.08; P.elL = P.elR = -0.9; P.shZL = P.shZR = 0.1; P.headX += 0.25; }
      else if (a === 'eat' || a === 'sit') { P.hipsY = 0.55; P.hipL = P.hipR = 1.45; P.kneeL = P.kneeR = 1.5; P.footL = P.footR = -0.1; if (a === 'eat') { P.shR = -1.2 + Math.max(0, w) * 0.5; P.elR = -1.6; } }
      else if (a === 'tend') { P.hipsY = 0.5; P.hipL = P.hipR = 1.3; P.kneeL = P.kneeR = 2.1; P.footL = P.footR = 0.5; P.spineX += 0.35; P.shL = P.shR = -0.9 + w * 0.15; }
      else if (a === 'lie') { P.bodyPitch = -1.4; P.hipsY = 0.35; P.shZL = P.shZR = 0.4; }
    }

    // 바라보기: 가까운 사람·물건 쪽으로 머리를 (몸통이 조금 거든다)
    if (this.lookAt && (s === 'ground' || s === 'skim' || s === 'fly') && this.toneGlow <= 0) {
      const dx = this.lookAt.x - p.pos.x, dz = this.lookAt.z - p.pos.z, dy = this.lookAt.y - (p.pos.y + 1.6);
      let a = Math.atan2(dx, dz) - p.yaw;
      a = Math.atan2(Math.sin(a), Math.cos(a));
      if (Math.abs(a) < 2.0) {
        const yaw = Math.max(-1.1, Math.min(1.1, a));
        P.headY += yaw * 0.75; P.spineY += yaw * 0.2;
        P.headX += Math.max(-0.5, Math.min(0.4, -Math.atan2(dy, Math.hypot(dx, dz)))) * 0.8;
      }
    }

    // 착지 눌림: 무릎이 받아 낸다
    this.landSquash = Math.max(0, this.landSquash - dt * 4);
    const sq = this.landSquash;
    if (sq > 0) { P.kneeL += sq * 0.9; P.kneeR += sq * 0.9; P.hipL += sq * 0.35; P.hipR += sq * 0.35; P.spineX += sq * 0.25; P.shL -= sq * 0.3; P.shR -= sq * 0.3; P.shZL += sq * 0.3; P.shZR += sq * 0.3; }

    // 따라가기
    const Q = this.pose || (this.pose = { ...P, hipsY: 0.93 });
    for (const k in P) if (k !== 'hipsY' && k !== 'wing') Q[k] = L(Q[k], P[k], kPose);
    // 골반 높이: 땅을 디딘 쪽 다리 길이로 풀어 발바닥을 땅(0)에 붙인다 (공중·탈것은 정한 높이)
    let hy = P.hipsY;
    if (hy == null) {
      const reach = (h, k) => 0.44 * Math.cos(h) + 0.4 * Math.cos(h - k) + 0.08;
      hy = 0.04 + Math.max(reach(Q.hipL, Q.kneeL), reach(Q.hipR, Q.kneeR)) + (this.flight || 0);
    }
    Q.hipsY = L(Q.hipsY ?? 0.93, hy, s === 'ground' ? 25 : 8);

    const h = this.hips, sp = this.spine;
    h.position.y = Q.hipsY - 0.93;
    h.position.x = Q.hipsX;
    h.rotation.y = Q.pelvisY;
    sp.rotation.set(Q.spineX, Q.spineY - Q.pelvisY, Q.spineZ);
    this.head.rotation.set(Q.headX - Q.spineX * 0.6, Q.headY, 0);
    const leg = (Lg, hip, knee, foot, spread, side) => {
      Lg.hip.rotation.set(-hip, 0, side * spread);
      Lg.knee.rotation.x = knee;
      // 발: 디딘 다리는 땅에 평평하게(허벅지·정강이 각을 되돌림) + 차기·들기
      Lg.ankle.rotation.x = hip - knee + foot;
    };
    leg(this.legL, Q.hipL, Q.kneeL, Q.footL, Q.spreadL, 1);
    leg(this.legR, Q.hipR, Q.kneeR, Q.footR, Q.spreadR, -1);
    this.armL.sh.rotation.x = Q.shL; this.armR.sh.rotation.x = Q.shR;
    this.armL.sh.rotation.z = -Q.shZL; this.armR.sh.rotation.z = Q.shZR;
    this.armL.el.rotation.x = Q.elL; this.armR.el.rotation.x = Q.elR;
    this.body.rotation.x = L(this.body.rotation.x, P.bodyPitch, s === 'down' ? 30 : 8);
    this.body.position.y = L(this.body.position.y, s === 'down' ? 0.2 : 0.93, s === 'down' ? 30 : 6);
    this.body.rotation.z = L(this.body.rotation.z, P.bodyRoll, 8);
    this.body.rotation.y = L(this.body.rotation.y, P.bodyYaw, 8);

    // 날개
    this.wingOpen = L(this.wingOpen, P.wing, 7);
    const wo = this.wingOpen;
    this.wings.visible = wo > 0.02;
    if (this.wings.visible) {
      const flap = Math.sin(this.t * 2.2) * 0.05 * wo;
      // 접힌 날개는 등에 붙어 아래로, 펼치면 옆으로
      this.wingL.scale.set(-(0.15 + 0.85 * wo), 0.4 + 0.6 * wo, 1);
      this.wingR.scale.set(0.15 + 0.85 * wo, 0.4 + 0.6 * wo, 1);
      // 위로 살짝 꺾인 날개 (몸 기준 Y 축 회전 = 수평일 때 상반각)
      this.wingL.rotation.y = -(0.18 * wo + flap);
      this.wingR.rotation.y = 0.18 * wo + flap;
      this.wingL.rotation.z = (1 - wo) * 1.2;
      this.wingR.rotation.z = -(1 - wo) * 1.2;
    }

    // 보드
    this.board.visible = s === 'skim';
    if (this.board.visible) {
      this.board.position.set(0, 0.12 + Math.sin(this.t * 5) * 0.02, 0);
      this.board.rotation.set(P.bodyPitch * 0.5, 0, P.bodyRoll * 0.6);
      this.boardGlow.material.uniforms.uIntensity.value = 1.5 + Math.min(2.5, speed * 0.05);
    }

    this.skiff.visible = s === 'fly';
    if (this.skiff.visible) {
      this.skiff.position.set(0, Math.sin(this.t * 2.4) * 0.04, 0);
      this.skiff.rotation.set(Math.max(-0.3, Math.min(0.3, -(p.vel.y || 0) * 0.012)), 0, -p.turn * 0.4);
    }

    // 그림자
    const gh = p.groundH;
    const above = Math.max(0, p.pos.y - gh);
    this.shadow.position.set(p.pos.x, gh + 0.06, p.pos.z);
    const sc = Math.max(0.2, 1 - above * 0.04) * (s === 'glide' ? 1.6 : 1);
    this.shadow.scale.setScalar(sc);
    this.shadow.material.opacity = 0.32 * Math.max(0, 1 - above / 30);

    this._updateScarf(dt, p);
  }

  /** 걷기·달리기 (그리고 제자리 돌기의 작은 걸음) */
  _gait(dt, speed, turning, P) {
    const v = turning ? 0.9 : speed;
    // 한 걸음 길이(m): 천천히 0.6 → 걷기 0.85 → 달리기 1.9 → 전력 2.6
    const step = v < 2.5 ? 0.55 + 0.12 * v : 0.85 + 0.183 * (v - 2.5);
    const omega = turning ? 5.5 + Math.abs(this.yawRate) * 0.8 : (Math.PI * v) / step;
    this.phase = (this.phase + omega * dt) % (Math.PI * 2);
    const run = turning ? 0 : Math.max(0, Math.min(1, (v - 3.2) / 5));
    const beta = 0.62 - 0.27 * run; // 디딘 시간의 몫 (걷기 0.62 · 달리기 0.35)
    const amp = turning ? 0.18 : Math.max(0.2, Math.min(0.85, Math.asin(Math.min(0.95, (beta * step) / 0.88))));
    const kneeSwing = turning ? 0.55 : 0.78 + 1.15 * run; // 흔들 때 무릎 (걸을 땐 60° 남짓, 달리면 뒤꿈치를 높이 찬다)
    const leg = (u) => {
      u = ((u % 1) + 1) % 1;
      if (u < beta) {
        // 디딤: 다리가 앞에서 뒤로, 무릎은 받아 냈다가 펴지고, 끝에 뒤꿈치가 들린다
        const a = u / beta;
        const hip = amp * (1 - 2 * a);
        const knee = 0.08 + (0.12 + 0.3 * run) * Math.sin(Math.PI * a);
        const foot = a > 0.7 ? (a - 0.7) / 0.3 * (0.45 + 0.35 * run) : 0;
        return [hip, knee, foot];
      }
      // 흔들기: 뒤에서 앞으로 (부드럽게), 무릎은 일찍 접혔다가 착지 전에 펴지고, 발끝을 든다
      const b = (u - beta) / (1 - beta);
      // 허벅지는 일찍 앞으로 나가고(빨리 시작해 천천히 멈춤), 무릎은 허벅지가 몸 밑을 지날 때 가장 접힌다
      const hip = -amp + 2 * amp * Math.sin((Math.PI / 2) * Math.min(1, b * 1.08)) + 0.12 * run * Math.sin(Math.PI * b);
      const knee = 0.08 + kneeSwing * Math.pow(Math.sin(Math.PI * Math.min(1, b * 1.2)), 1.4);
      const foot = b < 0.25 ? (0.6 + 0.3 * run) * (1 - b / 0.25) : -0.25 * Math.sin(Math.PI * (b - 0.25) / 0.75);
      return [hip, knee, foot];
    };
    const u = this.phase / (Math.PI * 2);
    [P.hipL, P.kneeL, P.footL] = leg(u);
    [P.hipR, P.kneeR, P.footR] = leg(u + 0.5);
    // 달리면 디딤 사이에 잠깐 뜬다
    this.flight = run * 0.07 * Math.max(0, Math.sin(Math.PI * 2 * ((u % 0.5) / 0.5) - Math.PI * beta * 2)) ;
    // 팔: 같은 쪽 다리와 반대로, 달리면 팔꿈치를 접어 크게
    const arm = 0.55 + 0.45 * run;
    P.shL = P.hipL * arm; P.shR = P.hipR * arm;
    P.elL = -(0.3 + 1.15 * run) - Math.max(0, -P.hipL) * 0.35 * run; P.elR = -(0.3 + 1.15 * run) - Math.max(0, -P.hipR) * 0.35 * run;
    P.shZL = P.shZR = 0.1 + 0.05 * run;
    // 몸통: 앞으로 숙임, 어깨와 골반은 반대로 비틀고, 걸을 땐 디딘 다리 쪽으로 골반이 실린다
    const sw = Math.sin(this.phase);
    P.spineX = 0.05 + 0.22 * run;
    P.pelvisY = -0.12 * sw * (1 - 0.4 * run);
    P.spineY = 0.1 * sw * (0.5 + run);
    P.hipsX = 0.025 * Math.cos(this.phase) * (1 - run);
    P.spineZ = -0.03 * Math.cos(this.phase) * (1 - run);
    // 머리: 흔들림을 덜고 앞을 본다
    P.headX = -0.04 - 0.1 * run;
    if (turning) { P.spineX = 0.04; P.shL *= 0.3; P.shR *= 0.3; P.elL = P.elR = -0.2; P.headY = Math.sign(this.yawRate) * 0.35; }
    this.idleT = 0;
  }

  /** 서 있기: 숨·무게 옮기기·둘러보기·손목 보기 */
  _idle(dt, P) {
    this.flight = 0;
    this.idleT = (this.idleT || 0) + dt;
    const t = this.t;
    const br = Math.sin(t * 1.7);
    P.spineX = 0.02 + br * 0.012;
    P.shZL = P.shZR = 0.13 + br * 0.015;
    // 무게 옮기기: 몇 초마다 한쪽 다리에 기대고 다른 무릎을 살짝 푼다
    if (!this._wsT || this.idleT > this._wsT) { this._wsT = this.idleT + 4 + Math.random() * 4; this._ws = this._ws ? -this._ws : 1; }
    const ws = this._ws || 1;
    P.hipsX = 0.035 * ws; P.spineZ = -0.03 * ws;
    P.kneeL = ws > 0 ? 0.06 : 0.22; P.kneeR = ws > 0 ? 0.22 : 0.06;
    P.hipL = ws > 0 ? 0 : 0.08; P.hipR = ws > 0 ? 0.08 : 0;
    P.footL = 0; P.footR = 0;
    P.spreadL = P.spreadR = 0.07;
    // 둘러보기
    if (!this._lkT || this.idleT > this._lkT) {
      this._lkT = this.idleT + 2.5 + Math.random() * 4;
      const r = Math.random();
      this._lk = r < 0.35 ? [0, 0] : r < 0.7 ? [(Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 0.3] : [(Math.random() - 0.5) * 0.6, -0.45];
    }
    P.headY = this._lk ? this._lk[0] : 0;
    P.headX = this._lk ? this._lk[1] : 0;
    P.spineY = P.headY * 0.15;
    // 오래 서 있으면 가끔 손목의 공명기를 들여다본다
    const cyc = (this.idleT % 14);
    if (this.idleT > 6 && cyc > 10 && cyc < 12.2) {
      const k = Math.min(1, Math.min(cyc - 10, 12.2 - cyc) * 2.5);
      P.shR += (-0.75 - P.shR) * k; P.shZR += (0.35 - P.shZR) * k; P.elR += (-1.6 - P.elR) * k;
      P.headX += (0.45 - P.headX) * k; P.headY += (-0.35 - P.headY) * k;
    }
  }

  _updateScarf(dt, p) {
    this.root.updateMatrixWorld(true);
    const anchor = this.scarfAnchor.getWorldPosition(this._v);
    const pts = this.scarfPts, prev = this.scarfPrev, n = this.scarfN;
    const seg = 0.095;
    if (this.scarfInit && pts[0].distanceToSquared(anchor) > 9) this.scarfInit = false; // 순간이동
    if (!this.scarfInit) {
      for (let i = 0; i < n; i++) { pts[i].copy(anchor); pts[i].y -= i * seg; prev[i].copy(pts[i]); }
      this.scarfInit = true;
    }
    // 고정점이 움직인 만큼 모든 점을 함께 옮긴다 (빠르게 날아도 늘어나지 않게) — 대신 바람으로 뒤로 날린다
    if (this._lastAnchor) {
      const mx = anchor.x - this._lastAnchor.x, my = anchor.y - this._lastAnchor.y, mz = anchor.z - this._lastAnchor.z;
      for (let i = 0; i < n; i++) { pts[i].x += mx; pts[i].y += my; pts[i].z += mz; prev[i].x += mx; prev[i].y += my; prev[i].z += mz; }
    } else this._lastAnchor = new THREE.Vector3();
    this._lastAnchor.copy(anchor);
    const vmax = Math.min(1, p.vel.length() / 25);
    // 바람: 바깥에서만 (실내에서는 움직이는 만큼의 맞바람뿐 — 목도리가 위로 날리지 않고 늘어진다)
    const wk = p.indoor ? 0 : 1.5;
    const wind = this._w.set(Math.sin(this.t * 0.7) * wk, 0, Math.cos(this.t * 0.5) * wk).addScaledVector(p.vel, -Math.min(p.indoor ? 0.35 : 1, 12 / Math.max(1, p.vel.length())));
    const sdt = Math.min(dt, 1 / 30);
    pts[0].copy(anchor);
    for (let i = 1; i < n; i++) {
      const c = pts[i], pv = prev[i];
      const vx = (c.x - pv.x) * 0.92, vy = (c.y - pv.y) * 0.92, vz = (c.z - pv.z) * 0.92;
      pv.copy(c);
      const flutter = Math.sin(this.t * 14 + i * 1.3) * (0.6 + vmax * 6) * (i / n);
      c.x += vx + (wind.x * 3 + flutter) * sdt * sdt * 6;
      c.y += vy - 9.8 * sdt * sdt * 0.6 * (1 - vmax * 0.8) + wind.y * sdt * sdt * 8 + flutter * sdt * sdt * 5;
      c.z += vz + (wind.z * 3 - flutter * 0.5) * sdt * sdt * 6;
    }
    for (let it = 0; it < 4; it++) {
      pts[0].copy(anchor);
      for (let i = 1; i < n; i++) {
        const a = pts[i - 1], b = pts[i];
        const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
        const d = Math.hypot(dx, dy, dz) || 1e-5;
        const f = (d - seg) / d;
        if (i === 1) { b.x -= dx * f; b.y -= dy * f; b.z -= dz * f; }
        else { a.x += dx * f * 0.5; a.y += dy * f * 0.5; a.z += dz * f * 0.5; b.x -= dx * f * 0.5; b.y -= dy * f * 0.5; b.z -= dz * f * 0.5; }
      }
    }
    // 마지막으로 앞에서부터 길이를 정확히 맞춘다 (절대 늘어나지 않게)
    pts[0].copy(anchor);
    for (let i = 1; i < n; i++) {
      const a = pts[i - 1], b = pts[i];
      const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
      const d = Math.hypot(dx, dy, dz) || 1e-5;
      b.x = a.x + (dx / d) * seg; b.y = a.y + (dy / d) * seg; b.z = a.z + (dz / d) * seg;
    }
    // 띠 메시 (폭 방향 = 몸의 좌우)
    const pos = this.scarf.geometry.attributes.position.array;
    const nor = this.scarf.geometry.attributes.normal.array;
    const yaw = p.yaw;
    const sx = Math.cos(yaw), sz = -Math.sin(yaw);
    for (let i = 0; i < n; i++) {
      const w = 0.055 * (1 - i / n * 0.3);
      const c = pts[i];
      pos[i * 6] = c.x - sx * w; pos[i * 6 + 1] = c.y; pos[i * 6 + 2] = c.z - sz * w;
      pos[i * 6 + 3] = c.x + sx * w; pos[i * 6 + 4] = c.y; pos[i * 6 + 5] = c.z + sz * w;
      for (let k = 0; k < 2; k++) { nor[i * 6 + k * 3] = 0; nor[i * 6 + k * 3 + 1] = 1; nor[i * 6 + k * 3 + 2] = 0; }
    }
    this.scarf.geometry.attributes.position.needsUpdate = true;
    this.scarf.geometry.attributes.normal.needsUpdate = true;
  }
}

const _teal = new THREE.Color(0x7ff3e6);
