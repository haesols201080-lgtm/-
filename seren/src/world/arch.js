// 아웬 건축 키트: 진주빛 첨탑, 떠 있는 꽃잎 발판, 돔 집, 아치, 공명탑, 글자돌, 승강 기둥.
// 함수들은 "부품 배열"(part 지오메트리)을 돌려주고, structures.js 가 장소마다 합쳐 메시를 만듭니다.
import * as THREE from 'three';
import { part, merge, xf, lathe, tube, jitter } from './geo-utils.js';
import { mulberry32 } from '../core/noise.js';
import { litMaterial, glowMaterial } from './materials.js';

export const PAL = {
  pearl: 0xf3eee6, pearl2: 0xe2dbee, gold: 0xe9c27c, stone: 0x9a93a8, stoneDark: 0x5e5870,
  teal: 0x7ff3e6, amber: 0xffc46a, rose: 0xff9fd0, violet: 0xb9a6ff, crystal: 0xf4c8e2,
};

const V2 = (r, y) => [r, y];
const lerpHex = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t).getHex();

// 공용 재질 (한 번만 만들고 공유)
let _mats = null;
export function archMaterials() {
  if (_mats) return _mats;
  _mats = {
    pearl: litMaterial({ vertexColors: true, vertexEmit: true, emissive: 0xffffff, emissiveIntensity: 1.6, emissiveNight: 0.85, rim: 0.7, rimColor: 0xe0d4ff, spec: 0.45 }),
    crystal: litMaterial({ vertexColors: true, vertexEmit: true, emissive: 0xffffff, emissiveIntensity: 1.4, emissiveNight: 0.6, rim: 1.0, rimColor: 0xffe0f4, spec: 1.4, transparent: true, opacity: 0.86 }),
    stone: litMaterial({ vertexColors: true, vertexEmit: true, emissive: 0xffffff, emissiveIntensity: 1.8, emissiveNight: 0.9, rim: 0.3 }),
    glow: glowMaterial({ color: 0xffffff, intensity: 1 }),
  };
  return _mats;
}

/** 진주빛 첨탑 (원점 = 밑동) */
export function spireTower({ h = 120, r = 6, seed = 1, glow = PAL.teal, pods = 1 } = {}) {
  const rnd = mulberry32(seed);
  const p = [V2(r * 1.7, 0), V2(r * 1.25, h * 0.025), V2(r * 1.0, h * 0.08), V2(r * 0.78, h * 0.3)];
  const podY = 0.42 + rnd() * 0.15;
  const podR = 1.4 + rnd() * 0.5;
  p.push(V2(r * podR * 0.95, h * (podY + 0.02)), V2(r * podR, h * (podY + 0.06)), V2(r * podR * 0.85, h * (podY + 0.11)), V2(r * 0.55, h * (podY + 0.15)));
  if (pods > 1) {
    const y2 = podY + 0.25;
    p.push(V2(r * 0.5, h * (y2 - 0.04)), V2(r * 0.95, h * y2), V2(r * 0.85, h * (y2 + 0.05)), V2(r * 0.4, h * (y2 + 0.08)));
  }
  p.push(V2(r * 0.35, h * 0.86), V2(r * 0.16, h * 0.95), V2(0.0001, h));
  const body = lathe(p, 16);
  const winLo = h * (podY + 0.035), winHi = h * (podY + 0.085);
  const parts = [
    part(body, (x, y) => (y > winLo && y < winHi ? glow : y < h * 0.03 ? PAL.gold : lerpHex(PAL.pearl, PAL.pearl2, y / h)),
      (x, y) => (y > winLo && y < winHi ? 1.0 : y > h * 0.94 ? 0.6 : 0)),
  ];
  // 금빛 띠
  for (const t of [0.08, 0.3]) {
    const rr = t === 0.08 ? r * 1.02 : r * 0.8;
    parts.push(part(xf(new THREE.TorusGeometry(rr, r * 0.07 + 0.08, 4, 20), { y: h * t, rx: Math.PI / 2 }), PAL.gold, 0.15));
  }
  // 떠 있는 고리
  parts.push(part(xf(new THREE.TorusGeometry(r * 1.4, r * 0.06 + 0.06, 4, 28), { y: h * 0.8, rx: Math.PI / 2 + 0.15 }), glow, 0.9));
  return parts;
}

/** 떠 있는 꽃잎 발판: 윗면이 y=0 (밟을 수 있음) */
export function petal({ r = 14, depth = 6, glow = PAL.teal, seed = 1 } = {}) {
  const g = lathe([V2(0.0001, 0.02), V2(r * 0.96, 0.02), V2(r, 0.5), V2(r * 1.03, 0.25), V2(r * 0.95, -0.6), V2(r * 0.7, -depth * 0.45), V2(r * 0.3, -depth * 0.85), V2(0.0001, -depth)], 22);
  const parts = [part(g, (x, y) => (y > 0.1 ? PAL.gold : y > -0.8 && Math.hypot(x) > 0 ? lerpHex(PAL.pearl2, PAL.pearl, -y / depth) : PAL.pearl), (x, y) => (y < -0.4 && y > -0.9 ? 0.9 : 0))];
  // 윗면 무늬: 동심원 빛
  parts.push(part(xf(new THREE.RingGeometry(r * 0.55, r * 0.58, 32), { y: 0.05, rx: -Math.PI / 2 }), glow, 0.8));
  // 아래 매달린 수정
  parts.push(part(xf(new THREE.ConeGeometry(r * 0.12, depth * 0.9, 6), { y: -depth - depth * 0.42, rx: Math.PI }), glow, 1.2));
  return parts;
}

/** 아웬의 돔 집 */
export function domeHouse({ r = 5, h = 6, seed = 1, glow = PAL.amber } = {}) {
  const rnd = mulberry32(seed);
  const g = lathe([V2(r, 0), V2(r * 1.02, h * 0.25), V2(r * 0.9, h * 0.6), V2(r * 0.55, h * 0.9), V2(r * 0.18, h * 1.02), V2(0.0001, h * 1.05)], 14);
  const parts = [part(g, (x, y) => lerpHex(PAL.pearl, PAL.pearl2, y / h), (x, y) => (y > h * 0.98 ? 0.8 : 0))];
  // 문 (빛나는 아치)
  const a = rnd() * Math.PI * 2;
  const door = xf(new THREE.CircleGeometry(r * 0.32, 12, 0, Math.PI), { sy: 1.7 });
  parts.push(part(xf(door, { x: Math.sin(a) * r * 1.01, z: Math.cos(a) * r * 1.01, y: 0.01, ry: a }), glow, 1.1));
  // 둥근 창
  for (let i = 0; i < 3; i++) {
    const b = a + 1.3 + i * 1.2;
    parts.push(part(xf(new THREE.CircleGeometry(r * 0.12, 8), { x: Math.sin(b) * r * 0.93, z: Math.cos(b) * r * 0.93, y: h * 0.5, ry: b }), glow, 1.0));
  }
  // 꼭대기 장식
  parts.push(part(xf(new THREE.OctahedronGeometry(r * 0.12, 0), { y: h * 1.12, sy: 2 }), glow, 1.4));
  return parts;
}

/** 아치 관문 */
export function archGate({ span = 30, h = 40, w = 2.5, glow = PAL.teal } = {}) {
  const g = new THREE.TorusGeometry(1, 0.06, 6, 40, Math.PI);
  const parts = [part(xf(g, { sx: span / 2, sy: h, sz: w * 8 }), (x, y) => lerpHex(PAL.pearl, PAL.gold, Math.max(0, y / h - 0.7) * 3), (x, y) => (y > h * 0.96 ? 1 : 0))];
  parts.push(part(xf(new THREE.TorusGeometry(1, 0.012, 4, 40, Math.PI), { sx: span / 2 * 0.86, sy: h * 0.88, sz: 2 }), glow, 1.2));
  return parts;
}

/** 글자돌: 어두운 석판에 빛나는 획 */
export function glyphStone({ seed = 1, glow = PAL.teal, h = 3.4 } = {}) {
  const rnd = mulberry32(seed);
  const parts = [];
  const slab = jitter(xf(new THREE.BoxGeometry(1.3, h, 0.5, 1, 3, 1), { y: h / 2 }), 0.06, seed);
  parts.push(part(slab, PAL.stoneDark, 0));
  // 획
  const strokes = 5 + Math.floor(rnd() * 4);
  for (let i = 0; i < strokes; i++) {
    const y = h * (0.25 + rnd() * 0.6);
    const x = (rnd() - 0.5) * 0.8;
    const len = 0.2 + rnd() * 0.45;
    const ang = Math.floor(rnd() * 4) * (Math.PI / 4);
    parts.push(part(xf(new THREE.BoxGeometry(len, 0.045, 0.02), { x, y, z: 0.26, rz: ang }), glow, 1.6));
    parts.push(part(xf(new THREE.BoxGeometry(len, 0.045, 0.02), { x, y, z: -0.26, rz: ang }), glow, 1.6));
  }
  parts.push(part(xf(new THREE.TorusGeometry(0.16, 0.025, 4, 16), { y: h * 0.85, z: 0.26 }), glow, 1.8));
  return parts;
}

/** 공명탑 본체 (고리는 따로 움직이므로 별도) */
export function pylonBody({ h = 90, seed = 1 } = {}) {
  const parts = [];
  // 계단식 받침
  parts.push(part(new THREE.CylinderGeometry(15, 17, 2.5, 8).translate(0, 1.25, 0), PAL.stone, 0));
  parts.push(part(new THREE.CylinderGeometry(11, 12.5, 2.5, 8).translate(0, 3.75, 0), PAL.stone, 0));
  parts.push(part(new THREE.CylinderGeometry(9.2, 9.4, 0.3, 8).translate(0, 5.1, 0), PAL.gold, 0.4));
  // 수정 기둥
  const shaft = new THREE.CylinderGeometry(2.6, 4.2, h * 0.82, 6, 6).translate(0, 5 + h * 0.41, 0);
  parts.push(part(shaft, (x, y) => lerpHex(0xd8d0f0, 0xffffff, (y - 5) / h), (x, y) => 0.25 + 0.5 * Math.max(0, Math.sin(y * 0.35))));
  parts.push(part(new THREE.ConeGeometry(2.6, h * 0.18, 6).translate(0, 5 + h * 0.82 + h * 0.09, 0), 0xffffff, 0.6));
  return parts;
}

export function pylonRing(r, seed = 1, glow = PAL.teal, base = PAL.stone, thick = 0.09) {
  const rnd = mulberry32(seed);
  const parts = [part(new THREE.TorusGeometry(r, r * thick, 6, 48), base, 0)];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + rnd() * 0.2;
    parts.push(part(xf(new THREE.BoxGeometry(r * 0.12, r * 0.04, r * 0.2), { x: Math.cos(a) * r, z: 0, y: Math.sin(a) * r, rz: a }), glow, 1.5));
  }
  return parts;
}

/** 승강 기둥 받침 */
export function liftBase({ r = 6, glow = PAL.teal } = {}) {
  return [
    part(new THREE.CylinderGeometry(r + 1.5, r + 2.5, 1.2, 16).translate(0, 0.6, 0), PAL.pearl, 0),
    part(xf(new THREE.TorusGeometry(r, 0.35, 6, 32), { y: 1.25, rx: Math.PI / 2 }), glow, 1.6),
    part(xf(new THREE.RingGeometry(r * 0.3, r * 0.9, 24), { y: 1.22, rx: -Math.PI / 2 }), glow, 0.6),
  ];
}

/** 정원 화단 (빛나는 꽃) */
export function gardenBed({ r = 6, seed = 1, colors = [PAL.teal, PAL.rose, PAL.amber] } = {}) {
  const rnd = mulberry32(seed);
  const parts = [part(new THREE.CylinderGeometry(r, r * 1.05, 0.5, 16).translate(0, 0.25, 0), PAL.pearl2, 0)];
  parts.push(part(new THREE.CircleGeometry(r * 0.95, 16).rotateX(-Math.PI / 2).translate(0, 0.52, 0), 0x2f6a58, 0));
  for (let i = 0; i < 14; i++) {
    const a = rnd() * Math.PI * 2, d = rnd() * r * 0.85;
    const hh = 0.4 + rnd() * 0.9;
    const c = colors[Math.floor(rnd() * colors.length)];
    parts.push(part(new THREE.CylinderGeometry(0.03, 0.04, hh, 3).translate(Math.cos(a) * d, 0.5 + hh / 2, Math.sin(a) * d), 0x2f6a58, 0));
    parts.push(part(new THREE.OctahedronGeometry(0.12 + rnd() * 0.1, 0).translate(Math.cos(a) * d, 0.5 + hh, Math.sin(a) * d), c, 1.3));
  }
  return parts;
}

/** 떠 있는 바위섬 (윗면 y=0 근처, 아래로 뾰족) */
export function floatingIsland({ r = 30, seed = 1 } = {}) {
  const rnd = mulberry32(seed);
  const parts = [];
  const top = jitter(xf(new THREE.CylinderGeometry(r, r * 0.92, 4, 12, 1), { y: -2 }), r * 0.05, seed);
  parts.push(part(top, (x, y) => (y > -0.5 ? 0x8fae6a : 0xc0603f), 0));
  const under = jitter(xf(new THREE.ConeGeometry(r * 0.92, r * 1.4, 10, 3), { y: -4 - r * 0.7, rx: Math.PI }), r * 0.12, seed + 1);
  parts.push(part(under, (x, y) => {
    const band = Math.floor((y + 4) / 5);
    return [0xc0603f, 0xe0a070, 0xa84a3a, 0xd27f52][(band % 4 + 4) % 4];
  }, 0));
  // 밑에 매달린 빛 수정
  for (let i = 0; i < 4; i++) {
    const a = rnd() * Math.PI * 2, d = rnd() * r * 0.5;
    parts.push(part(xf(new THREE.ConeGeometry(r * 0.06, r * 0.35, 5), { x: Math.cos(a) * d, z: Math.sin(a) * d, y: -4 - r * 0.6 - rnd() * r * 0.4, rx: Math.PI }), PAL.amber, 1.4));
  }
  return parts;
}

/** 합친 부품 → 메시 */
export function meshFrom(parts, mat) {
  const g = merge(parts);
  const m = new THREE.Mesh(g, mat);
  return m;
}

/** 부품 배열을 위치/회전과 함께 다른 배열에 옮겨 담기 */
export function place(target, parts, opts) {
  for (const p of parts) target.push(xf(p, opts));
  return target;
}
