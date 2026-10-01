// 아웬: 세렌의 주민. 키 3m 남짓, 땅 위에 떠서 움직이고, 얼굴 대신 빛나는 "목소리 띠"로 노래합니다.
import * as THREE from 'three';
import { litMaterial, glowMaterial } from './materials.js';
import { lathe, part, merge, xf, tube } from './geo-utils.js';

let shared = null;
function sharedGeo() {
  if (shared) return shared;
  // 옷자락 같은 몸 (아래로 갈수록 가늘어지는 꼬리)
  const body = lathe([[0.0001, 0.0], [0.08, 0.15], [0.26, 0.55], [0.42, 1.05], [0.4, 1.55], [0.3, 2.0], [0.26, 2.25], [0.2, 2.42], [0.1, 2.55], [0.0001, 2.58]], 14);
  const head = new THREE.SphereGeometry(0.2, 14, 10);
  head.scale(0.9, 1.0, 1.55);
  head.rotateX(-0.5);
  const band = new THREE.TorusGeometry(0.19, 0.022, 6, 20, Math.PI * 1.1);
  band.rotateZ(-Math.PI * 0.05);
  band.rotateY(Math.PI / 2);
  band.rotateX(Math.PI / 2 + 0.3);
  const crest = [];
  for (let i = 0; i < 4; i++) {
    const a = (i - 1.5) * 0.25;
    crest.push(part(tube([[0, 0.12, -0.05], [Math.sin(a) * 0.1, 0.3, -0.25], [Math.sin(a) * 0.18, 0.38, -0.55 - i * 0.04]], 0.012, 3, 6), 0xffffff, 1));
  }
  const arm = tube([[0, 0, 0], [0.05, -0.35, 0.05], [0.04, -0.8, 0.12], [0.02, -1.15, 0.2]], 0.03, 5, 8, (t) => 1.1 - 0.5 * t);
  const fingers = [];
  for (let i = 0; i < 3; i++) {
    const a = (i - 1) * 0.35;
    fingers.push(part(tube([[0.02, -1.15, 0.2], [0.02 + Math.sin(a) * 0.05, -1.3, 0.24], [0.02 + Math.sin(a) * 0.08, -1.4, 0.22]], 0.008, 3, 4), 0xffffff, 0));
  }
  const ribbons = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const g = new THREE.PlaneGeometry(0.12, 1.3, 1, 6);
    g.translate(0, -0.65, 0);
    g.translate(0, 0.9, 0);
    g.rotateY(a);
    g.translate(Math.sin(a) * 0.3, 0, Math.cos(a) * 0.3);
    ribbons.push(g);
  }
  shared = {
    body, head, band, crest: merge(crest), arm: merge([part(arm, 0xffffff, 0), ...fingers]),
    ribbons: ribbons.map((g) => g),
  };
  return shared;
}

export class AwenFigure {
  constructor({ hue = 0.5, scale = 1, glow = 0x7ff3e6, seed = 1 } = {}) {
    const G = sharedGeo();
    this.root = new THREE.Group();
    this.inner = new THREE.Group();
    this.root.add(this.inner);
    const skin = new THREE.Color().setHSL(hue, 0.35, 0.82);
    const deep = new THREE.Color().setHSL((hue + 0.08) % 1, 0.45, 0.58);
    this.bodyMat = litMaterial({ color: skin, rim: 1.0, rimColor: new THREE.Color(glow).lerp(new THREE.Color(0xffffff), 0.5), spec: 0.6, emissive: glow, emissiveIntensity: 0.12, emissiveNight: 0.8 });
    this.deepMat = litMaterial({ color: deep, rim: 0.8, rimColor: glow, side: THREE.DoubleSide, transparent: true, opacity: 0.82, emissive: glow, emissiveIntensity: 0.18, emissiveNight: 0.9 });
    this.glowMat = glowMaterial({ color: glow, intensity: 1.6 });
    const body = new THREE.Mesh(G.body, this.bodyMat);
    this.inner.add(body);
    this.headPivot = new THREE.Group();
    this.headPivot.position.set(0, 2.58, 0.02);
    this.inner.add(this.headPivot);
    const head = new THREE.Mesh(G.head, this.bodyMat);
    head.position.set(0, 0.16, 0.05);
    this.headPivot.add(head);
    this.band = new THREE.Mesh(G.band, this.glowMat);
    this.band.position.set(0, 0.17, 0.12);
    this.headPivot.add(this.band);
    const crest = new THREE.Mesh(G.crest, this.glowMat);
    crest.position.set(0, 0.12, 0.1);
    this.headPivot.add(crest);
    this.arms = [];
    for (const s of [-1, 1]) {
      const sh = new THREE.Group();
      sh.position.set(s * 0.27, 2.25, 0.02);
      const a = new THREE.Mesh(G.arm, this.bodyMat);
      a.scale.x = s;
      sh.add(a);
      this.inner.add(sh);
      this.arms.push(sh);
    }
    this.ribbons = G.ribbons.map((g) => {
      const m = new THREE.Mesh(g, this.deepMat);
      this.inner.add(m);
      return m;
    });
    // 가슴의 빛 (말할 때 맥동)
    this.core = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), this.glowMat);
    this.core.position.set(0, 1.85, 0.3);
    this.inner.add(this.core);
    this.root.scale.setScalar(scale);
    this.t = Math.random() * 10;
    this.speaking = 0;
    this.gesture = 0; // 0..1 팔 들기
    this.look = null; // 바라볼 월드 좌표
    this.yaw = 0;
    this._v = new THREE.Vector3();
  }

  speak(sec) { this.speaking = Math.max(this.speaking, sec); }

  update(dt) {
    this.t += dt;
    const t = this.t;
    this.inner.position.y = 0.45 + Math.sin(t * 1.3) * 0.08;
    this.inner.rotation.z = Math.sin(t * 0.7) * 0.03;
    this.speaking = Math.max(0, this.speaking - dt);
    const sp = this.speaking > 0 ? 1 : 0;
    this.glowMat.uniforms.uIntensity.value = 1.3 + sp * (1.2 + Math.sin(t * 18) * 0.8);
    this.core.scale.setScalar(1 + sp * (0.4 + Math.sin(t * 11) * 0.3));
    const g = Math.max(this.gesture, sp * 0.5);
    this.arms.forEach((a, i) => {
      const s = i ? 1 : -1;
      a.rotation.x = -0.15 - g * (1.2 + Math.sin(t * 2 + i) * 0.2) + Math.sin(t * 1.1 + i) * 0.06;
      a.rotation.z = s * (0.12 + g * 0.4 + Math.sin(t * 0.9 + i * 2) * 0.05);
    });
    this.ribbons.forEach((r, i) => {
      r.rotation.x = Math.sin(t * 1.6 + i * 1.3) * 0.18;
      r.rotation.z = Math.cos(t * 1.2 + i) * 0.12;
    });
    // 바라보기
    if (this.look) {
      this.root.updateMatrixWorld();
      const p = this.root.position;
      const target = Math.atan2(this.look.x - p.x, this.look.z - p.z);
      let d = Math.atan2(Math.sin(target - this.yaw), Math.cos(target - this.yaw));
      this.yaw += d * Math.min(1, dt * 2.5);
      this.headPivot.rotation.x = -0.1;
    } else this.headPivot.rotation.x = Math.sin(t * 0.3) * 0.1;
    this.root.rotation.y = this.yaw;
    this.headPivot.rotation.y = Math.sin(t * 0.4) * 0.2;
  }
}
