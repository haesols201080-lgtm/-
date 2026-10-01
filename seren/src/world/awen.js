// 아웬: 세렌의 주민. 키 3m 남짓, 땅 위에 떠서 움직이고, 얼굴 대신 빛나는 "목소리 띠"로 노래합니다.
// 성능을 위해 한 명을 메시 5개(몸, 머리, 두 팔, 옷자락)로 그립니다. 빛나는 부위는 정점 발광으로 표시합니다.
import * as THREE from 'three';
import { litMaterial } from './materials.js';
import { lathe, part, merge, xf, tube } from './geo-utils.js';

const SKIN = 0xffffff; // 정점색 흰색 = 재질 색(개인별 피부색)을 그대로
let shared = null;
function sharedGeo() {
  if (shared) return shared;
  const body = lathe([[0.0001, 0.0], [0.08, 0.15], [0.26, 0.55], [0.42, 1.05], [0.4, 1.55], [0.3, 2.0], [0.26, 2.25], [0.2, 2.42], [0.1, 2.55], [0.0001, 2.58]], 14);
  const bodyParts = [
    part(body, SKIN, (x, y) => (Math.abs(x) < 0.05 && y > 1.2 && y < 2.3 ? 0.6 : 0.06)),
    part(xf(new THREE.SphereGeometry(0.07, 8, 6), { y: 1.85, z: 0.3 }), SKIN, 2.2), // 가슴의 빛
  ];
  const head = new THREE.SphereGeometry(0.2, 14, 10);
  head.scale(0.9, 1.0, 1.55);
  head.rotateX(-0.5);
  const band = new THREE.TorusGeometry(0.19, 0.022, 6, 20, Math.PI * 1.1);
  band.rotateZ(-Math.PI * 0.05);
  band.rotateY(Math.PI / 2);
  band.rotateX(Math.PI / 2 + 0.3);
  const headParts = [part(xf(head, { y: 0.16, z: 0.05 }), SKIN, 0.05), part(xf(band, { y: 0.17, z: 0.12 }), SKIN, 2.4)];
  for (let i = 0; i < 4; i++) {
    const a = (i - 1.5) * 0.25;
    headParts.push(part(xf(tube([[0, 0.12, -0.05], [Math.sin(a) * 0.1, 0.3, -0.25], [Math.sin(a) * 0.18, 0.38, -0.55 - i * 0.04]], 0.012, 3, 6), { y: 0.12, z: 0.1 }), SKIN, 2.0));
  }
  const arm = tube([[0, 0, 0], [0.05, -0.35, 0.05], [0.04, -0.8, 0.12], [0.02, -1.15, 0.2]], 0.03, 5, 8, (t) => 1.1 - 0.5 * t);
  const armParts = [part(arm, SKIN, 0.05)];
  for (let i = 0; i < 3; i++) {
    const a = (i - 1) * 0.35;
    armParts.push(part(tube([[0.02, -1.15, 0.2], [0.02 + Math.sin(a) * 0.05, -1.3, 0.24], [0.02 + Math.sin(a) * 0.08, -1.4, 0.22]], 0.008, 3, 4), SKIN, 0.8));
  }
  const ribbons = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const g = new THREE.PlaneGeometry(0.12, 1.3, 1, 4);
    g.translate(0, 0.25, 0);
    g.rotateY(a);
    g.translate(Math.sin(a) * 0.3, 0, Math.cos(a) * 0.3);
    ribbons.push(part(g, SKIN, 0.3));
  }
  shared = { body: merge(bodyParts), head: merge(headParts), arm: merge(armParts), ribbons: merge(ribbons) };
  return shared;
}

export class AwenFigure {
  constructor({ hue = 0.5, scale = 1, glow = 0x7ff3e6 } = {}) {
    const G = sharedGeo();
    this.root = new THREE.Group();
    this.inner = new THREE.Group();
    this.root.add(this.inner);
    const skin = new THREE.Color().setHSL(hue, 0.35, 0.82);
    const deep = new THREE.Color().setHSL((hue + 0.08) % 1, 0.45, 0.58);
    this.glow = new THREE.Color(glow);
    this.mat = litMaterial({ color: skin, vertexColors: true, vertexEmit: true, emissive: glow, emissiveIntensity: 1, emissiveNight: 0.5, rim: 1.0, rimColor: new THREE.Color(glow).lerp(new THREE.Color(0xffffff), 0.5), spec: 0.6 });
    this.deepMat = litMaterial({ color: deep, vertexColors: true, vertexEmit: true, emissive: glow, emissiveIntensity: 0.6, emissiveNight: 0.9, rim: 0.8, rimColor: glow, side: THREE.DoubleSide, transparent: true, opacity: 0.82 });
    this.inner.add(new THREE.Mesh(G.body, this.mat));
    this.headPivot = new THREE.Group();
    this.headPivot.position.set(0, 2.58, 0.02);
    this.inner.add(this.headPivot);
    this.headPivot.add(new THREE.Mesh(G.head, this.mat));
    this.arms = [];
    for (const s of [-1, 1]) {
      const sh = new THREE.Group();
      sh.position.set(s * 0.27, 2.25, 0.02);
      const a = new THREE.Mesh(G.arm, this.mat);
      a.scale.x = s;
      sh.add(a);
      this.inner.add(sh);
      this.arms.push(sh);
    }
    this.ribbons = new THREE.Mesh(G.ribbons, this.deepMat);
    this.ribbons.position.y = 0.65;
    this.inner.add(this.ribbons);
    this.root.scale.setScalar(scale);
    this.t = Math.random() * 10;
    this.speaking = 0;
    this.gesture = 0;
    this.look = null;
    this.yaw = 0;
  }

  speak(sec) { this.speaking = Math.max(this.speaking, sec); }

  update(dt) {
    this.t += dt;
    const t = this.t;
    this.inner.position.y = 0.45 + Math.sin(t * 1.3) * 0.08;
    this.inner.rotation.z = Math.sin(t * 0.7) * 0.03;
    this.speaking = Math.max(0, this.speaking - dt);
    const sp = this.speaking > 0 ? 1 : 0;
    const k = 1 + sp * (0.9 + Math.sin(t * 18) * 0.6);
    this.mat.uniforms.uEmissive.value.copy(this.glow).multiplyScalar(k);
    const g = Math.max(this.gesture, sp * 0.5);
    this.arms.forEach((a, i) => {
      const s = i ? 1 : -1;
      a.rotation.x = -0.15 - g * (1.2 + Math.sin(t * 2 + i) * 0.2) + Math.sin(t * 1.1 + i) * 0.06;
      a.rotation.z = s * (0.12 + g * 0.4 + Math.sin(t * 0.9 + i * 2) * 0.05);
    });
    this.ribbons.rotation.set(Math.sin(t * 1.6) * 0.12, Math.sin(t * 0.5) * 0.3, Math.cos(t * 1.2) * 0.1);
    if (this.look) {
      const p = this.root.position;
      const target = Math.atan2(this.look.x - p.x, this.look.z - p.z);
      const d = Math.atan2(Math.sin(target - this.yaw), Math.cos(target - this.yaw));
      this.yaw += d * Math.min(1, dt * 2.5);
      this.headPivot.rotation.x = -0.1;
    } else this.headPivot.rotation.x = Math.sin(t * 0.3) * 0.1;
    this.root.rotation.y = this.yaw;
    this.headPivot.rotation.y = Math.sin(t * 0.4) * 0.2;
  }
}
