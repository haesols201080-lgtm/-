// 세렌의 식물·바위·수정 모델 (절차적). 모두 원점이 밑동이고 +Y 가 위.
import * as THREE from 'three';
import { part, merge, xf, lathe, tube, jitter } from './geo-utils.js';
import { mulberry32 } from '../core/noise.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/** 휘어진 잎/갈대 한 가닥 (띠). 법선은 위쪽으로 기울여 부드럽게 보이게 */
function blade(h, w, bend, rot, seg = 4, ox = 0, oz = 0) {
  const pos = [], nor = [];
  const pts = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    pts.push([bend * t * t, h * t, (1 - t) * w + 0.001 * t]);
  }
  const c = Math.cos(rot), s = Math.sin(rot);
  const T = (x, y, wz) => [ox + x * c - wz * s, y, oz + x * s + wz * c];
  for (let i = 0; i < seg; i++) {
    const [x0, y0, w0] = pts[i], [x1, y1, w1] = pts[i + 1];
    const a = T(x0, y0, -w0 / 2), b = T(x0, y0, w0 / 2), cc = T(x1, y1, -w1 / 2), d = T(x1, y1, w1 / 2);
    pos.push(...a, ...b, ...cc, ...b, ...d, ...cc);
    const nx = -s * 0.3, nz = c * 0.3;
    for (let k = 0; k < 6; k++) nor.push(nx, 0.95, nz);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

const lerpHex = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t).getHex();

export function reedClump(seed = 1) {
  const r = mulberry32(seed);
  const parts = [];
  for (let i = 0; i < 7; i++) {
    const h = 0.9 + r() * 0.9;
    const a = r() * Math.PI * 2;
    const ox = (r() - 0.5) * 0.4, oz = (r() - 0.5) * 0.4;
    const bend = (r() - 0.3) * 0.5;
    parts.push(part(blade(h, 0.05, bend, a, 4, ox, oz), (x, y) => lerpHex(0x1d5e5a, 0x7fd6b8, y / h), 0));
    // 끝의 빛 씨앗
    const tp = xf(new THREE.OctahedronGeometry(0.032, 0), { x: ox + Math.cos(a) * bend, y: h + 0.02, z: oz + Math.sin(a) * bend, sy: 2.2 });
    parts.push(part(tp, 0x9ffcff, 1.2));
  }
  return merge(parts);
}

export function grassClump(seed = 1, c0 = 0x3a7a5a, c1 = 0x9ccf8a, height = 0.55) {
  const r = mulberry32(seed);
  const parts = [];
  for (let i = 0; i < 6; i++) {
    const h = height * (0.6 + r() * 0.7);
    const g = blade(h, 0.07, (r() - 0.2) * 0.35, r() * Math.PI * 2, 3, (r() - 0.5) * 0.35, (r() - 0.5) * 0.35);
    parts.push(part(g, (x, y) => lerpHex(c0, c1, y / h), 0));
  }
  return merge(parts);
}

export function mossTuft(seed = 1) {
  const r = mulberry32(seed);
  const parts = [];
  for (let i = 0; i < 6; i++) {
    const h = 0.25 + r() * 0.45;
    const a = r() * Math.PI * 2;
    const ox = (r() - 0.5) * 0.5, oz = (r() - 0.5) * 0.5;
    const b = (r() - 0.5) * 0.3;
    parts.push(part(blade(h, 0.03, b, a, 3, ox, oz), (x, y) => lerpHex(0x2a2456, 0x5a4aa0, y / h), 0));
    parts.push(part(xf(new THREE.SphereGeometry(0.035, 5, 4), { x: ox + Math.cos(a) * b, y: h, z: oz + Math.sin(a) * b }), 0x7dfde0, 1.4));
  }
  return merge(parts);
}

export function shard(len = 1, rad = 0.12, color = 0xf0b8d8, emit = 0.25) {
  const prism = xf(new THREE.CylinderGeometry(rad, rad * 1.05, len * 0.78, 6, 1), { y: len * 0.39 });
  const tip = xf(new THREE.ConeGeometry(rad, len * 0.22, 6, 1), { y: len * 0.78 + len * 0.11 });
  return [part(prism, (x, y) => lerpHex(color, 0xffffff, Math.min(1, y / len * 0.6)), emit), part(tip, 0xffffff, emit * 1.6)];
}

export function crystalCluster(seed = 1, color = 0xf0b0d4) {
  const r = mulberry32(seed);
  const parts = [];
  const n = 5 + Math.floor(r() * 4);
  for (let i = 0; i < n; i++) {
    const len = 0.6 + r() * 1.6;
    const rad = 0.08 + r() * 0.12;
    const tilt = r() * 0.7;
    const a = r() * Math.PI * 2;
    for (const g of shard(len, rad, lerpHex(color, 0xb8a8ff, r() * 0.5), 0.35)) {
      parts.push(xf(g, { x: (r() - 0.5) * 0.4, z: (r() - 0.5) * 0.4, rx: Math.cos(a) * tilt, rz: Math.sin(a) * tilt }));
    }
  }
  return merge(parts);
}

export function crystalSpire(seed = 1, color = 0xf2b4d6) {
  const r = mulberry32(seed);
  const parts = [];
  for (const g of shard(6, 0.55, color, 0.3)) parts.push(xf(g, { rz: (r() - 0.5) * 0.12 }));
  const n = 4 + Math.floor(r() * 4);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const len = 1.2 + r() * 2.8;
    for (const g of shard(len, 0.18 + r() * 0.2, lerpHex(color, 0xa8b8ff, r()), 0.35)) {
      parts.push(xf(g, { x: Math.cos(a) * 0.55, z: Math.sin(a) * 0.55, rx: Math.sin(a) * 0.5, rz: -Math.cos(a) * 0.5 }));
    }
  }
  parts.push(part(jitter(xf(new THREE.IcosahedronGeometry(0.9, 0), { sy: 0.4 }), 0.2, seed), 0xc08890, 0));
  return merge(parts);
}

/** 작은 빛버섯 (1~4m) */
export function mushroomSmall(seed = 1, capColor = 0x6a4ac0, glow = 0x6dfcd0) {
  const r = mulberry32(seed);
  const parts = [];
  const n = 1 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const h = 0.7 + r() * 1.3;
    const cr = 0.3 + r() * 0.45;
    const ox = i ? (r() - 0.5) * 1.2 : 0, oz = i ? (r() - 0.5) * 1.2 : 0;
    const stalk = lathe([[0.09, 0], [0.07, h * 0.5], [0.06, h]], 6);
    parts.push(part(xf(stalk, { x: ox, z: oz }), 0xd8d0ea, 0));
    const cap = lathe([[0.02, h + cr * 0.55], [cr * 0.6, h + cr * 0.45], [cr, h + cr * 0.12], [cr * 0.95, h], [cr * 0.3, h + 0.04]], 8);
    parts.push(part(xf(cap, { x: ox, z: oz }), (x, y) => (y < h + 0.03 ? glow : capColor), (x, y) => (y < h + 0.03 ? 1.4 : 0.15)));
  }
  return merge(parts);
}

/**
 * 거대 버섯나무 (단위 높이 1). 반환: { geo, capY, capR, stalkR }
 */
export function mushroomGiant(seed = 1) {
  const r = mulberry32(seed);
  const capR = 0.32 + r() * 0.16;
  const bend = (r() - 0.5) * 0.12;
  const parts = [];
  const pts = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    pts.push(V(bend * t * t, t * 0.98, bend * 0.5 * t * t));
  }
  const stalk = tube(pts, 0.035, 9, 10, (t) => 1.6 - 0.7 * t + 1.4 * Math.max(0, 0.15 - t) * 4);
  parts.push(part(stalk, (x, y) => lerpHex(0xcfc4e8, 0x8f80c8, y), (x, y) => (Math.sin(y * 60) > 0.92 ? 0.8 : 0)));
  const top = pts[8];
  const cap = lathe([
    [0.001, 0.13], [capR * 0.35, 0.12], [capR * 0.7, 0.085], [capR, 0.02], [capR * 0.98, 0.0], [capR * 0.6, 0.012], [capR * 0.15, -0.01], [0.001, -0.012],
  ], 20);
  parts.push(part(xf(cap, { x: top.x, y: top.y, z: top.z }), (x, y) => (y - top.y < 0.008 ? 0x4dfcd0 : 0x5a3aa8), (x, y) => (y - top.y < 0.008 ? 1.6 : 0)));
  // 갓 위 빛 점
  for (let i = 0; i < 14; i++) {
    const a = r() * Math.PI * 2, d = r() * capR * 0.85;
    const yy = 0.13 * (1 - (d / capR) ** 2) * 0.9 + 0.005;
    parts.push(part(xf(new THREE.SphereGeometry(0.012 + r() * 0.01, 5, 3), { x: top.x + Math.cos(a) * d, y: top.y + yy, z: top.z + Math.sin(a) * d, sy: 0.5 }), 0xa8fff0, 1.5));
  }
  // 늘어진 빛 실
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + r() * 0.3;
    const len = 0.05 + r() * 0.12;
    parts.push(part(xf(new THREE.CylinderGeometry(0.0015, 0.0015, len, 3), { x: top.x + Math.cos(a) * capR * 0.92, y: top.y - len / 2, z: top.z + Math.sin(a) * capR * 0.92 }), 0x7dfde0, 1.6));
  }
  return { geo: merge(parts), capY: top.y + 0.12, capR: capR * 0.85, top, stalkR: 0.035 * 1.5 };
}

/** 등불나무: 가는 줄기, 늘어진 가지 끝마다 빛 열매 (단위 높이 ~1) */
export function lanternTree(seed = 1) {
  const r = mulberry32(seed);
  const parts = [];
  const lean = (r() - 0.5) * 0.15;
  const trunkPts = [V(0, 0, 0), V(lean * 0.3, 0.35, 0), V(lean, 0.7, lean * 0.4), V(lean * 1.2, 1.0, lean * 0.5)];
  parts.push(part(tube(trunkPts, 0.025, 5, 6, (t) => 1.3 - 0.8 * t), 0x6a5a7a, 0));
  const nb = 5 + Math.floor(r() * 3);
  for (let i = 0; i < nb; i++) {
    const a = (i / nb) * Math.PI * 2 + r() * 0.5;
    const y0 = 0.62 + r() * 0.35;
    const o = trunkPts[2];
    const L = 0.22 + r() * 0.18;
    const p0 = V(o.x, y0, o.z);
    const p1 = V(o.x + Math.cos(a) * L * 0.6, y0 + 0.1, o.z + Math.sin(a) * L * 0.6);
    const p2 = V(o.x + Math.cos(a) * L, y0 - 0.05, o.z + Math.sin(a) * L);
    const p3 = V(o.x + Math.cos(a) * L * 1.1, y0 - 0.2 - r() * 0.1, o.z + Math.sin(a) * L * 1.1);
    parts.push(part(tube([p0, p1, p2, p3], 0.008, 3, 4), 0x7a6a8a, 0));
    const pod = xf(new THREE.OctahedronGeometry(0.035, 0), { x: p3.x, y: p3.y - 0.03, z: p3.z, sy: 1.6 });
    parts.push(part(pod, 0xffd27a, 1.8));
    // 잎 술
    for (let k = 0; k < 2; k++) {
      const leaf = blade(0.12, 0.05, 0.04, a + (k - 0.5) * 0.8, 2, p2.x, p2.z);
      parts.push(part(xf(leaf, { y: p2.y - 0.02 }), 0x3d9a8a, 0));
    }
  }
  return merge(parts);
}

/** 빛방울 풀: 줄기 끝 둥근 빛 */
export function glowBulbs(seed = 1, color = 0x8ff7ff) {
  const r = mulberry32(seed);
  const parts = [];
  for (let i = 0; i < 4; i++) {
    const h = 0.4 + r() * 0.7;
    const a = r() * Math.PI * 2, d = r() * 0.25;
    const top = V(Math.cos(a) * d + (r() - 0.5) * 0.2, h, Math.sin(a) * d);
    parts.push(part(tube([V(Math.cos(a) * d * 0.3, 0, Math.sin(a) * d * 0.3), V(top.x * 0.6, h * 0.6, top.z * 0.6), top], 0.012, 3, 3), 0x2f6a6a, 0));
    parts.push(part(xf(new THREE.SphereGeometry(0.07 + r() * 0.05, 6, 4), { x: top.x, y: top.y + 0.05, z: top.z }), color, 1.5));
  }
  // 넓은 잎
  for (let i = 0; i < 4; i++) parts.push(part(blade(0.5, 0.18, 0.25, r() * 6.28, 3), (x, y) => lerpHex(0x1e5a50, 0x5fb89a, y / 0.5), 0));
  return merge(parts);
}

export function boulder(seed = 1, c0 = 0x8a86a0, c1 = 0x6a6680) {
  const r = mulberry32(seed);
  const g = jitter(new THREE.IcosahedronGeometry(1, 1), 0.35, seed);
  const s = xf(g, { sx: 1 + r() * 0.5, sy: 0.6 + r() * 0.4, sz: 1 + r() * 0.4, y: 0.25 });
  return merge([part(s, (x, y) => lerpHex(c1, c0, Math.min(1, Math.max(0, y))), 0)]);
}

/** 협곡의 후두 바위기둥 (단위 높이 1) */
export function hoodoo(seed = 1) {
  const r = mulberry32(seed);
  const parts = [];
  const cols = [0xc0603f, 0xe0a070, 0xa84a3a, 0xefc694, 0xd27f52];
  let y = 0;
  const n = 5 + Math.floor(r() * 4);
  for (let i = 0; i < n; i++) {
    const h = (1 / n) * (0.8 + r() * 0.4);
    const rad = 0.09 * (1 - i / n * 0.5) * (0.7 + r() * 0.5);
    const g = jitter(xf(new THREE.CylinderGeometry(rad * 0.85, rad, h, 7, 1), { y: y + h / 2 }), rad * 0.25, seed + i);
    parts.push(part(g, cols[Math.floor(r() * cols.length)], 0));
    y += h * 0.92;
  }
  const cap = jitter(xf(new THREE.IcosahedronGeometry(0.13, 0), { y: y + 0.03, sy: 0.45 }), 0.03, seed);
  parts.push(part(cap, 0x8a4a42, 0));
  return { geo: merge(parts), height: y + 0.08 };
}

export function iceSpike(seed = 1) {
  const r = mulberry32(seed);
  const parts = [];
  const n = 3 + Math.floor(r() * 4);
  for (let i = 0; i < n; i++) {
    const h = 0.5 + r() * 1.0;
    const a = r() * Math.PI * 2;
    const g = xf(new THREE.ConeGeometry(0.12 + r() * 0.12, h, 5, 1), { x: (r() - 0.5) * 0.4, y: h / 2, z: (r() - 0.5) * 0.4, rx: Math.cos(a) * 0.4 * r(), rz: Math.sin(a) * 0.4 * r() });
    parts.push(part(g, (x, y) => lerpHex(0x8fb8e8, 0xf0faff, y / h), 0.25));
  }
  return merge(parts);
}

/** 서리 소나무: 비틀린 원뿔 층 (단위 높이 1) */
export function frostPine(seed = 1) {
  const r = mulberry32(seed);
  const parts = [];
  parts.push(part(xf(new THREE.CylinderGeometry(0.015, 0.03, 0.35, 5), { y: 0.17 }), 0x4a3a40, 0));
  const layers = 5;
  for (let i = 0; i < layers; i++) {
    const t = i / layers;
    const rad = 0.24 * (1 - t * 0.75);
    const h = 0.26 * (1 - t * 0.3);
    const g = xf(new THREE.ConeGeometry(rad, h, 6, 1, true), { y: 0.18 + t * 0.72 + h / 2, ry: i * 0.7 + r() });
    parts.push(part(g, (x, y) => (y > 0.18 + t * 0.72 + h * 0.7 ? 0xe8f2ff : lerpHex(0x1f4a52, 0x2f6a6a, t)), 0));
  }
  return merge(parts);
}

/** 바닷가 채찍나무: 휘어진 줄기 끝 리본 잎 (단위 높이 1) */
export function whipTree(seed = 1) {
  const r = mulberry32(seed);
  const parts = [];
  const bx = (r() - 0.5) * 0.4, bz = (r() - 0.5) * 0.4;
  const pts = [V(0, 0, 0), V(bx * 0.2, 0.4, bz * 0.2), V(bx * 0.6, 0.75, bz * 0.6), V(bx, 1, bz)];
  parts.push(part(tube(pts, 0.02, 5, 7, (t) => 1.2 - 0.6 * t), (x, y) => (Math.sin(y * 50) > 0.6 ? 0x8a6a5a : 0x6a5048), 0));
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + r() * 0.3;
    const L = 0.3 + r() * 0.15;
    const leaf = blade(L, 0.06, L * 0.6, a, 3);
    parts.push(part(xf(leaf, { x: bx, y: 1, z: bz, rx: Math.sin(a) * 1.2, rz: -Math.cos(a) * 1.2 }), (x, y) => lerpHex(0x2f8f70, 0xa0e0a0, r()), 0));
  }
  parts.push(part(xf(new THREE.SphereGeometry(0.035, 6, 5), { x: bx, y: 0.98, z: bz }), 0xffb070, 1.2));
  return merge(parts);
}

/** 바다부채 산호 */
export function seaFan(seed = 1) {
  const r = mulberry32(seed);
  const parts = [];
  for (let i = 0; i < 3; i++) {
    const shape = new THREE.Shape();
    const w = 0.4 + r() * 0.4, h = 0.6 + r() * 0.6;
    shape.moveTo(0, 0);
    shape.bezierCurveTo(-w, h * 0.4, -w * 0.9, h, 0, h);
    shape.bezierCurveTo(w * 0.9, h, w, h * 0.4, 0, 0);
    const g = new THREE.ShapeGeometry(shape, 6);
    parts.push(part(xf(g, { ry: r() * Math.PI, rx: (r() - 0.5) * 0.4 }), (x, y) => lerpHex(0xff8a8a, 0xffd0a0, y / h), (x, y) => (y > h * 0.8 ? 0.6 : 0.05)));
  }
  return merge(parts);
}

/** 넓은 돛양치: 말린 큰 잎 */
export function sailFern(seed = 1) {
  const r = mulberry32(seed);
  const parts = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + r();
    const L = 0.9 + r() * 0.6;
    parts.push(part(blade(L, 0.32, L * 0.7, a, 5), (x, y) => lerpHex(0x1d6a5a, 0x7ac8a8, y / L), (x, y) => (y > L * 0.85 ? 0.4 : 0)));
  }
  return merge(parts);
}
