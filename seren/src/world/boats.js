// 작은 하늘배 모델: 빌려 타는 나룻배(1인)와 선착장 사이를 오가는 연락선.
// 하늘배의 바닥에는 고리가 셋 있다 — 고리가 세렌의 울림을 조금 밀어내는 만큼 배가 뜬다 (노래 서고의 「하늘배의 뼈」).
import * as THREE from 'three';
import { part, merge, xf, lathe } from './geo-utils.js';
import { litMaterial } from './materials.js';

const GOLD = 0xe8c27a;
let _skiff = null, _ferry = null, _mat = null;

export function boatMaterial() {
  return _mat || (_mat = litMaterial({ vertexColors: true, vertexEmit: true, emissive: 0xffffff, emissiveIntensity: 1.4, emissiveNight: 0.8, rim: 0.7, rimColor: 0xd8f8ff, spec: 1.2, side: THREE.DoubleSide }));
}

/** 1인 나룻배 (길이 약 4.4 m). 원점 = 갑판 위 (발 디딤) */
export function skiffGeo() {
  if (_skiff) return _skiff;
  const P = [];
  // 선체: 길쭉한 물방울
  P.push(part(xf(lathe([[0.0001, -0.42], [0.42, -0.36], [0.68, -0.18], [0.74, 0], [0.7, 0.06]], 18), { sz: 3.0, sx: 1.0 }), (x, y) => (y > 0.02 ? 0xf6f2fa : 0xe2dcec), 0));
  P.push(part(xf(new THREE.TorusGeometry(0.71, 0.04, 4, 32), { y: 0.05, rx: Math.PI / 2, sz: 3.0 }), GOLD, 0.6));
  P.push(part(xf(new THREE.CircleGeometry(0.66, 24), { y: 0.0, rx: -Math.PI / 2, sy: 2.9 }), 0xd8d2e2, 0));
  // 바닥 고리 셋
  for (let i = 0; i < 3; i++) P.push(part(xf(new THREE.TorusGeometry(0.34, 0.07, 5, 20), { y: -0.46, z: (i - 1) * 0.9, rx: Math.PI / 2 }), 0x7ff3e6, 2.2));
  // 앞 유리 바람막이와 조종 고리
  P.push(part(xf(new THREE.CylinderGeometry(0.62, 0.62, 0.55, 18, 1, true, -Math.PI * 0.35, Math.PI * 0.7), { y: 0.32, z: 0.55, sx: 0.9 }), 0xbfeaff, 0.25));
  P.push(part(xf(new THREE.TorusGeometry(0.22, 0.03, 4, 16), { y: 0.95, z: 0.55, rx: 0.4 }), GOLD, 0.8));
  P.push(part(xf(new THREE.CylinderGeometry(0.03, 0.04, 0.9, 5), { y: 0.48, z: 0.62, rx: 0.4 }), 0xbfb2a4, 0));
  // 꼬리 지느러미
  for (const s of [-1, 1]) P.push(part(xf(new THREE.BoxGeometry(0.04, 0.5, 0.7), { x: s * 0.42, y: 0.18, z: -1.75, rz: s * 0.5, rx: -0.3 }), 0xf2eef6, (x, y) => (y > 0.3 ? 1.6 : 0)));
  // 뱃머리 등
  P.push(part(xf(new THREE.OctahedronGeometry(0.1, 0), { y: 0.08, z: 2.18 }), 0xffd27a, 3));
  _skiff = merge(P);
  return _skiff;
}

/** 선착장 연락선 (길이 약 15 m). 원점 = 갑판 높이 */
export function ferryGeo() {
  if (_ferry) return _ferry;
  const P = [];
  P.push(part(xf(lathe([[0.0001, -1.6], [1.6, -1.3], [2.6, -0.6], [2.9, 0], [2.8, 0.25]], 22), { sz: 2.6 }), (x, y) => (y > 0.1 ? 0xf6f2fa : 0xdcd6e6), (x, y) => (Math.abs(y + 0.35) < 0.08 ? 1.4 : 0)));
  P.push(part(xf(new THREE.CircleGeometry(2.7, 28), { y: 0.02, rx: -Math.PI / 2, sy: 2.55 }), 0xe0d8e8, 0));
  P.push(part(xf(new THREE.TorusGeometry(2.82, 0.08, 4, 40), { y: 0.3, rx: Math.PI / 2, sz: 2.6 }), GOLD, 0.6));
  // 바닥 고리 셋 (빛나는)
  for (let i = 0; i < 3; i++) P.push(part(xf(new THREE.TorusGeometry(1.1, 0.16, 6, 28), { y: -1.75, z: (i - 1) * 3.4, rx: Math.PI / 2 }), 0x7ff3e6, 2.4));
  // 지붕 차양 (기둥 넷 위)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.push(part(xf(new THREE.CylinderGeometry(0.07, 0.07, 2.6, 6), { x: sx * 1.9, y: 1.3, z: sz * 2.6 }), GOLD, 0));
  P.push(part(xf(new THREE.SphereGeometry(3.0, 22, 6, 0, Math.PI * 2, 0, Math.PI * 0.32), { y: 1.2, sz: 1.6 }), 0xf2eaf6, (x, y) => (y < 1.9 ? 1.0 : 0)));
  // 앉는 자리
  for (const sz of [-1.6, 0, 1.6]) P.push(part(xf(new THREE.BoxGeometry(3.0, 0.45, 0.6), { y: 0.22, z: sz }), 0xc8a0b8, 0.1));
  // 뱃머리 키와 등, 꼬리 돛
  P.push(part(xf(lathe([[0.25, 0], [0.12, 1.2], [0.0001, 1.5]], 8), { y: 0.1, z: 6.2 }), 0xe8e4ee, (x, y) => (y > 1.2 ? 3 : 0)));
  P.push(part(xf(new THREE.BoxGeometry(0.08, 2.6, 2.4), { y: 1.0, z: -6.6, rx: -0.35 }), 0xf2eef6, (x, y) => (y > 1.8 ? 1.4 : 0)));
  for (const s of [-1, 1]) P.push(part(xf(new THREE.BoxGeometry(2.2, 0.08, 1.2), { x: s * 3.4, y: -0.1, z: -4.8, rz: s * -0.25 }), 0xf2eef6, 0.2));
  _ferry = merge(P);
  return _ferry;
}
