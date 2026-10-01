// 주인공 모델: 크림색 탐사복, 산호빛 목도리, 어두운 바이저, 날개 팩, 스키머 보드.
// 모든 동작은 관절 각도를 직접 계산하는 절차적 애니메이션입니다.
import * as THREE from 'three';
import { litMaterial, glowMaterial } from '../world/materials.js';

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
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.1, 0.24), dark);
      boot.position.set(0, -0.43, 0.04);
      knee.add(boot);
      return { hip, knee, boot };
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

  addTo(scene) {
    scene.add(this.root);
    scene.add(this.scarf);
    scene.add(this.shadow);
  }

  playTone(color) {
    this.toneGlow = 1;
    this.toneColor.set(color);
  }

  /**
   * p: 플레이어 상태 { state, speed, vel, onGround, yaw, pitch, turn, groundH, pos }
   */
  update(dt, p) {
    this.t += dt;
    const s = p.state;
    const speed = p.hspeed;
    const L = (a, b, k) => a + (b - a) * Math.min(1, k * dt);

    this.root.position.copy(p.pos);
    this.root.rotation.set(0, p.yaw, 0);

    // 기본 자세
    let hipX = 0, spineX = 0, spineZ = 0, headX = 0;
    let lHip = 0, rHip = 0, lKnee = 0, rKnee = 0;
    let lSh = 0, rSh = 0, lShZ = 0.12, rShZ = -0.12, lEl = -0.15, rEl = -0.15;
    let bodyPitch = 0, bodyRoll = 0, hipsY = 0.93, bodyYaw = 0;
    let wingTarget = 0;

    if (s === 'ground' || s === 'swim') {
      const run = Math.min(1, speed / 9);
      this.phase += dt * (3.2 + speed * 1.15);
      const ph = this.phase;
      const amp = 0.25 + 0.65 * run;
      lHip = Math.sin(ph) * amp; rHip = -lHip;
      lKnee = Math.max(0, -Math.sin(ph + 0.6)) * (0.3 + 1.1 * run) + 0.05;
      rKnee = Math.max(0, Math.sin(ph + 0.6)) * (0.3 + 1.1 * run) + 0.05;
      lSh = lHip * 0.85; rSh = rHip * 0.85;
      lEl = -0.3 - 0.7 * run; rEl = lEl;
      spineX = 0.08 + run * 0.22;
      hipsY = 0.93 - Math.abs(Math.cos(ph)) * 0.05 * run + (speed < 0.3 ? Math.sin(this.t * 1.8) * 0.006 : 0);
      if (speed < 0.3) { // 숨쉬기 · 둘러보기
        lSh = 0.05; rSh = 0.05; lEl = -0.12; rEl = -0.12;
        headX = Math.sin(this.t * 0.4) * 0.05;
        spineX = 0.02 + Math.sin(this.t * 1.8) * 0.01;
      }
      bodyRoll = -p.turn * 0.25 * run;
      if (s === 'swim') {
        bodyPitch = 1.2; hipsY = 0.3;
        lSh = -2.2 + Math.sin(this.t * 3) * 0.6; rSh = lSh; lShZ = 0.6 + Math.cos(this.t * 3) * 0.4; rShZ = -lShZ;
        lHip = Math.sin(this.t * 4) * 0.3; rHip = -lHip;
      }
    } else if (s === 'air') {
      const up = Math.max(-1, Math.min(1, p.vel.y / 8));
      lHip = 0.5 + up * 0.2; rHip = -0.2; lKnee = 0.9; rKnee = 0.4;
      lSh = -0.6; rSh = -0.4; lShZ = 0.6; rShZ = -0.6; lEl = -0.6; rEl = -0.6;
      spineX = 0.1;
    } else if (s === 'glide' || s === 'current') {
      wingTarget = 1;
      bodyPitch = 1.25 + (p.pitch || 0) * 0.6;
      bodyRoll = -p.turn * 0.7;
      lHip = 0.05; rHip = 0.05; lKnee = 0.15; rKnee = 0.15;
      lSh = -1.3; rSh = -1.3; lShZ = 1.1; rShZ = -1.1; lEl = -0.3; rEl = -0.3;
      headX = -0.9;
      hipsY = 0.93;
      if (s === 'current') { lSh = -2.6; rSh = -2.6; lShZ = 0.25; rShZ = -0.25; wingTarget = 0.35; }
    } else if (s === 'skim') {
      bodyYaw = 0;
      hipsY = 0.78 + 0.12;
      lHip = -0.55; rHip = 0.15; lKnee = 0.9; rKnee = 0.55;
      spineX = 0.35;
      lSh = -0.4; rSh = 0.3; lShZ = 0.9; rShZ = -0.9; lEl = -0.5; rEl = -0.4;
      bodyRoll = -p.turn * 0.55;
      bodyPitch = Math.max(-0.3, Math.min(0.3, -(p.vel.y || 0) * 0.03));
      headX = -0.2;
    } else if (s === 'down') {
      // 쓰러져 누운 자세 (오프닝)
      bodyPitch = -1.45; bodyRoll = 0.15;
      lHip = 0.1; rHip = -0.05; lKnee = 0.5; rKnee = 0.1;
      lSh = 0.3; rSh = -0.2; lShZ = 0.9; rShZ = -0.5; lEl = -0.4; rEl = -0.2;
      headX = 0.3;
    } else if (s === 'lift') {
      lHip = 0.1; rHip = 0.1; lKnee = 0.3; rKnee = 0.3;
      lSh = -0.3; rSh = -0.3; lShZ = 1.0; rShZ = -1.0;
      headX = -0.4;
      spineX = -0.1;
    }

    // 공명 연주: 오른팔을 앞으로
    this.toneGlow = Math.max(0, this.toneGlow - dt * 1.6);
    if (this.toneGlow > 0 && s !== 'glide' && s !== 'skim' && s !== 'current') {
      const k = Math.min(1, this.toneGlow * 2.5);
      rSh = rSh + (-1.5 - rSh) * k; rShZ = rShZ + (-0.1 - rShZ) * k; rEl = rEl + (-0.4 - rEl) * k;
    }
    this.glowMat.uniforms.uColor.value.lerp(this.toneColor, Math.min(1, dt * 6));
    this.glowMat.uniforms.uIntensity.value = 1.4 + this.toneGlow * 4;
    if (this.toneGlow <= 0) this.glowMat.uniforms.uColor.value.lerp(_teal, Math.min(1, dt * 2));

    // 착지 눌림
    this.landSquash = Math.max(0, this.landSquash - dt * 4);
    hipsY -= this.landSquash * 0.22;
    lKnee += this.landSquash * 0.9; rKnee += this.landSquash * 0.9;

    const k = 14;
    const h = this.hips, sp = this.spine;
    h.position.y = L(h.position.y, hipsY - 0.93, k);
    sp.rotation.x = L(sp.rotation.x, spineX, k);
    sp.rotation.z = L(sp.rotation.z, spineZ, k);
    this.head.rotation.x = L(this.head.rotation.x, headX, 8);
    this.legL.hip.rotation.x = L(this.legL.hip.rotation.x, -lHip, k);
    this.legR.hip.rotation.x = L(this.legR.hip.rotation.x, -rHip, k);
    this.legL.knee.rotation.x = L(this.legL.knee.rotation.x, lKnee, k);
    this.legR.knee.rotation.x = L(this.legR.knee.rotation.x, rKnee, k);
    this.armL.sh.rotation.x = L(this.armL.sh.rotation.x, lSh, k);
    this.armR.sh.rotation.x = L(this.armR.sh.rotation.x, rSh, k);
    this.armL.sh.rotation.z = L(this.armL.sh.rotation.z, -lShZ, k);
    this.armR.sh.rotation.z = L(this.armR.sh.rotation.z, -rShZ, k);
    this.armL.el.rotation.x = L(this.armL.el.rotation.x, lEl, k);
    this.armR.el.rotation.x = L(this.armR.el.rotation.x, rEl, k);
    this.body.rotation.x = L(this.body.rotation.x, bodyPitch, s === 'down' ? 30 : 8);
    this.body.position.y = L(this.body.position.y, s === 'down' ? 0.2 : 0.93, s === 'down' ? 30 : 6);
    this.body.rotation.z = L(this.body.rotation.z, bodyRoll, 8);
    this.body.rotation.y = L(this.body.rotation.y, bodyYaw, 8);

    // 날개
    this.wingOpen = L(this.wingOpen, wingTarget, 7);
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
      this.board.rotation.set(bodyPitch * 0.5, 0, bodyRoll * 0.6);
      this.boardGlow.material.uniforms.uIntensity.value = 1.5 + Math.min(2.5, speed * 0.05);
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
    const wind = this._w.set(Math.sin(this.t * 0.7) * 1.5, 0, Math.cos(this.t * 0.5) * 1.5).addScaledVector(p.vel, -Math.min(1, 12 / Math.max(1, p.vel.length())));
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
