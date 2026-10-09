// 박물관 전시품 (v24 「박물관 실제 전시품 누락」): 전시대·유리장·큰 전시물 위에 그 전시(data/venues.EXHIBITS)의 실제 모형을 놓는다.
//  · 설명 카드는 이 모형을 돕는 것 — 카드만 뜨고 받침이 비어 있지 않게.
//  · 모형은 단위 크기(높이 약 0.55, 바닥 y = 0)로 짓고, 받침의 크기에 맞춰 s 배로 놓는다(큰 전시물은 2.6 배).
//  · 같은 GB(꼭짓점 색·발광)로 지어 실내 재질 하나로 그린다 — 조명 밝기 설정(uLightScale)도 같이 따른다.
import * as THREE from 'three';
import { PAT } from './material.js';
import { EXHIBITS } from '../data/venues.js';
import { hashStr } from '../core/noise.js';

/** 그 건물·그 받침의 전시 (설명 카드와 모형이 같은 것을 고른다) */
export function exhibitFor(uid, fid) { return EXHIBITS[hashStr(`${uid}|${fid}`) % EXHIBITS.length]; }
/** 받침 윗면 높이 (props 의 모양과 같게) */
export const EXHIBIT_TOP = { plinth: 1.0, bigexhibit: 0.4, case: 0.82 };

const GOLD = 0xd8b46a, STONE = 0xb8b2a6, DARK = 0x3a3f4a, BONE = 0xeae4d4, WOOD = 0x9a7452;
let _oct = null, _tor = null, _tor2 = null;
const oct = () => _oct || (_oct = new THREE.OctahedronGeometry(1, 0)); // 다면체는 이미 색인 없는 모양
const torus = () => _tor || (_tor = new THREE.TorusGeometry(1, 0.12, 6, 20).toNonIndexed());
const ring = () => _tor2 || (_tor2 = new THREE.TorusGeometry(1, 0.05, 4, 28).toNonIndexed());
let _tor3 = null;
const ringH = () => _tor3 || (_tor3 = new THREE.TorusGeometry(1, 0.05, 4, 28).rotateX(Math.PI / 2).toNonIndexed()); // 눕힌 고리

/** 전시 id → 모형. gb 에 (x, y, z) 받침 윗면, ry 돌림, s 배율, col 전시 빛깔 */
export function exhibitModel(gb, id, x, y, z, ry, s, col) {
  const cs = Math.cos(ry), sn = Math.sin(ry);
  // 모형 좌표 (u 오른쪽, v 위, w 앞) → 틀 좌표
  const P = (u, w) => [x + (u * cs + w * sn) * s, z + (-u * sn + w * cs) * s];
  const box = (u, v, w, a, h, d, c, e = 0, pat = 0) => { const [px, pz] = P(u, w); gb.box(px, y + v * s, pz, a * s, h * s, d * s, ry, c, e, pat); };
  const cyl = (u, v, w, r, h, c, e = 0, seg = 12, r2 = null) => { const [px, pz] = P(u, w); gb.cyl(px, y + v * s, pz, r * s, h * s, c, e, 0, 0, seg, r2 == null ? null : r2 * s); };
  const sph = (u, v, w, r, c, e = 0) => { const [px, pz] = P(u, w); gb.sphere(px, y + v * s, pz, r * s, c, e); };
  const geo = (g, u, v, w, a, sx, sy, sz, c, e = 0) => { const [px, pz] = P(u, w); gb.geo(g, px, y + v * s, pz, ry + a, c, e, 0, 0, sx * s, sy * s, sz * s); };
  const base = (r = 0.16, h = 0.05) => cyl(0, 0, 0, r, h, DARK, 0, 16);
  switch (id) {
    case 'resonator': // 소리굽쇠: 받침 · 자루 · 두 갈래 · 끝의 빛
      base(); cyl(0, 0.05, 0, 0.025, 0.18, GOLD, 0.1, 8);
      box(0, 0.22, 0, 0.16, 0.035, 0.04, GOLD, 0.1);
      box(-0.065, 0.24, 0, 0.03, 0.3, 0.035, GOLD, 0.15); box(0.065, 0.24, 0, 0.03, 0.3, 0.035, GOLD, 0.15);
      sph(-0.065, 0.55, 0, 0.022, col, 1.4); sph(0.065, 0.55, 0, 0.022, col, 1.4);
      break;
    case 'spine-seed': // 결정 씨앗: 길쭉한 팔면체 + 받침 고리
      base(0.14); geo(ringH(), 0, 0.1, 0, 0, 0.12, 0.12, 0.12, GOLD, 0.2);
      geo(oct(), 0, 0.32, 0, 0.4, 0.09, 0.26, 0.09, col, 0.9);
      break;
    case 'first-song': // 이름 노래 결정: 크고 작은 결정 셋
      base(0.17); geo(oct(), 0, 0.22, 0, 0.2, 0.07, 0.17, 0.07, col, 0.9);
      geo(oct(), -0.08, 0.14, 0.04, 1.1, 0.045, 0.1, 0.045, col, 0.7); geo(oct(), 0.08, 0.13, -0.03, 2.2, 0.04, 0.08, 0.04, col, 0.7);
      break;
    case 'silence': // 들음의 해 기록판: 돌판 · 빛 홈 여섯 줄
      box(0, 0, 0, 0.3, 0.04, 0.12, DARK);
      box(0, 0.04, 0, 0.26, 0.42, 0.05, STONE, 0, PAT.stone || 0);
      for (let k = 0; k < 6; k++) box(0, 0.1 + k * 0.055, 0.027, 0.18 - (k % 2) * 0.05, 0.008, 0.004, col, 1.2);
      break;
    case 'ur-map': // 우르의 지도: 띠마다 빛이 다른 구 · 받침 기둥
      base(); cyl(0, 0.05, 0, 0.02, 0.18, GOLD, 0, 8);
      sph(0, 0.38, 0, 0.15, 0xffc46a, 0.25);
      for (let k = -2; k <= 2; k++) { const v = 0.38 + k * 0.05, r = Math.sqrt(Math.max(0, 0.155 * 0.155 - (k * 0.05) ** 2)); cyl(0, v - 0.008, 0, r + 0.004, 0.016, k % 2 ? 0xe08a4a : 0xffe2a8, 0.5, 20); }
      geo(ring(), 0, 0.38, 0, 0, 0.21, 0.21, 0.21, GOLD, 0.3);
      break;
    case 'whale-bone': { // 하늘고래의 뼈: 휜 마디 열한 개
      box(0, 0, 0, 0.5, 0.03, 0.12, DARK);
      for (let k = 0; k <= 10; k++) { const t = k / 10, u = -0.22 + t * 0.44, v = 0.06 + Math.sin(t * Math.PI) * 0.22; box(u, v, 0, 0.045, 0.05 - Math.abs(t - 0.5) * 0.03, 0.06, BONE, k % 3 === 0 ? 0.2 : 0); }
      box(-0.22, 0.03, 0, 0.02, 0.06, 0.02, GOLD); box(0.22, 0.03, 0, 0.02, 0.06, 0.02, GOLD);
      break;
    }
    case 'loom': // 빛 베틀: 틀 · 빛 실
      box(0, 0, 0, 0.36, 0.03, 0.14, WOOD);
      box(-0.16, 0.03, 0, 0.025, 0.42, 0.025, WOOD); box(0.16, 0.03, 0, 0.025, 0.42, 0.025, WOOD); box(0, 0.43, 0, 0.36, 0.025, 0.03, WOOD);
      for (let k = 0; k < 9; k++) box(-0.13 + k * 0.0325, 0.08, 0, 0.006, 0.34, 0.006, col, 1.3);
      box(0, 0.2, 0.004, 0.28, 0.1, 0.008, col, 0.5);
      break;
    case 'chorus-stone': // 합창돌: 둥근 돌 · 빛 고리 셋
      geo(_sphere(), 0, 0.2, 0, 0, 0.24, 0.2, 0.24, STONE);
      for (let k = 0; k < 3; k++) { const rr = 0.245 - Math.abs(k - 1) * 0.045; geo(ringH(), 0, 0.12 + k * 0.08, 0, 0, rr, 0.25, rr, col, 0.9); }
      break;
    case 'ship-model': // 첫 하늘배 모형: 받침 · 배몸 · 돛 · 용골 빛
      base(0.12); cyl(0, 0.05, 0, 0.012, 0.12, GOLD, 0, 6);
      box(0, 0.17, 0, 0.42, 0.07, 0.1, WOOD); box(0.22, 0.18, 0, 0.06, 0.05, 0.06, WOOD);
      box(0, 0.24, 0, 0.012, 0.26, 0.012, WOOD); box(0.02, 0.27, 0, 0.004, 0.2, 0.2, 0xf4efe2, 0.15);
      box(0, 0.165, 0.052, 0.38, 0.012, 0.004, col, 1.2);
      break;
    case 'healer-bowl': // 치유사의 그릇: 넓어지는 그릇 · 빛 물
      base(0.12); cyl(0, 0.05, 0, 0.09, 0.1, STONE, 0, 18, 0.17);
      cyl(0, 0.14, 0, 0.15, 0.012, col, 1.0, 18);
      break;
    case 'harvest': // 첫 빛열매: 접시 · 열매 다섯
      cyl(0, 0, 0, 0.18, 0.03, GOLD, 0, 18);
      for (let k = 0; k < 5; k++) { const a = k * 1.256; sph(Math.cos(a) * 0.08, 0.08, Math.sin(a) * 0.08, 0.055, col, 0.8); }
      sph(0, 0.15, 0, 0.06, col, 0.9);
      break;
    case 'courier-pack': // 소식꾼의 가방: 몸통 · 덮개 · 끈 · 빛 매듭
      box(0, 0, 0, 0.3, 0.26, 0.12, 0x8a6a4a); box(0, 0.2, 0.065, 0.3, 0.09, 0.01, 0x7a5a3a);
      box(-0.1, 0.26, 0, 0.03, 0.14, 0.02, 0x6a4a2a); box(0.1, 0.26, 0, 0.03, 0.14, 0.02, 0x6a4a2a); box(0, 0.4, 0, 0.23, 0.03, 0.02, 0x6a4a2a);
      sph(0, 0.22, 0.075, 0.02, col, 1.4);
      break;
    case 'star-lens': // 별 렌즈: 받침대 · 고리 · 유리 원판
      base(); cyl(0, 0.05, 0, 0.018, 0.14, GOLD, 0, 8);
      geo(torus(), 0, 0.36, 0, 0, 0.17, 0.17, 0.17, GOLD, 0.2);
      geo(_disc(), 0, 0.36, 0, 0, 0.16, 0.16, 0.16, col, 0.6);
      break;
    case 'ice-flute': // 얼음 피리: 비스듬한 받침 위 긴 관 · 구멍
      box(0, 0, 0, 0.46, 0.025, 0.1, DARK);
      box(-0.17, 0.025, 0, 0.02, 0.07, 0.04, GOLD); box(0.17, 0.025, 0, 0.02, 0.07, 0.04, GOLD);
      geo(_tube(), 0, 0.11, 0, 0, 0.022, 0.44, 0.022, 0xd8f4ff, 0.5);
      for (let k = 0; k < 6; k++) sph(-0.12 + k * 0.05, 0.132, 0, 0.008, 0x406080, 0);
      break;
    case 'colossus-key': // 거신의 열쇠: 고리 · 자루 · 이
      box(0, 0, 0, 0.18, 0.04, 0.18, DARK);
      geo(torus(), 0, 0.42, 0, Math.PI / 2, 0.09, 0.09, 0.09, GOLD, 0.2);
      box(0, 0.04, 0, 0.03, 0.3, 0.03, GOLD, 0.1); box(0.04, 0.06, 0, 0.06, 0.03, 0.03, GOLD); box(0.035, 0.12, 0, 0.05, 0.03, 0.03, GOLD);
      sph(0, 0.42, 0, 0.03, col, 1.4);
      break;
    case 'echo-jar': // 메아리 단지: 배 부른 단지 · 목 · 마개 빛
      base(0.11); cyl(0, 0.05, 0, 0.08, 0.14, 0x7a8aa0, 0.05, 16, 0.13); cyl(0, 0.19, 0, 0.13, 0.12, 0x7a8aa0, 0.05, 16, 0.06);
      cyl(0, 0.31, 0, 0.05, 0.05, 0x7a8aa0, 0, 12); sph(0, 0.37, 0, 0.045, col, 1.3);
      break;
    default: // 모르는 전시: 빛 결정 하나 (빈 받침은 두지 않는다)
      base(); geo(oct(), 0, 0.25, 0, 0, 0.1, 0.2, 0.1, col, 0.9);
  }
}
let _sph = null, _dsc = null, _tb = null;
const _sphere = () => _sph || (_sph = new THREE.SphereGeometry(1, 14, 10).toNonIndexed());
const _disc = () => _dsc || (_dsc = new THREE.CylinderGeometry(1, 1, 0.04, 20).rotateX(Math.PI / 2).toNonIndexed());
const _tube = () => _tb || (_tb = new THREE.CylinderGeometry(1, 1, 1, 10).rotateZ(Math.PI / 2).toNonIndexed());

/** 받침 종류 → 모형 배율 (전시대 0.5 m 칸 · 유리장 · 큰 전시물) */
export function exhibitScale(F, slot) {
  // 아웬(3 m 넘는 키) 관람객 눈높이에 맞춰: 전시대 위 모형은 1.6 배(약 0.9 m), 유리장 안은 유리 높이에 들어가게, 큰 전시물은 3.2 배
  if (F.t === 'bigexhibit') return 3.2;
  if (F.t === 'case') return Math.min(1.3, Math.max(0.8, slot.w * 0.9));
  return 1.6;
}

// ── 우리 집 꾸미기 (v24 「구매한 물품의 실제 사용」): 가방의 물건을 집 바닥에 놓는다 — 놓인 모양 ──
export const DECOR = { potplant: '빛꽃 화분', lantern: '손등불', lightorb: '빛방울 등', trinket: '노래 장신구', kite: '바람연', toyorb: '노래 구슬', giftbox: '선물 꾸러미', flower: '울림꽃', storybook: '이야기책' };
export function decorModel(gb, k, x, y, z, ry, col) {
  const cs = Math.cos(ry), sn = Math.sin(ry);
  const P = (u, w) => [x + u * cs + w * sn, z - u * sn + w * cs];
  const box = (u, v, w, a, h, d, c, e = 0) => { const [px, pz] = P(u, w); gb.box(px, y + v, pz, a, h, d, ry, c, e); };
  const cyl = (u, v, w, r, h, c, e = 0, seg = 12, r2 = null) => { const [px, pz] = P(u, w); gb.cyl(px, y + v, pz, r, h, c, e, 0, 0, seg, r2); };
  const sph = (u, v, w, r, c, e = 0) => { const [px, pz] = P(u, w); gb.sphere(px, y + v, pz, r, c, e); };
  const geo = (g, u, v, w, a, sx, sy, sz, c, e = 0) => { const [px, pz] = P(u, w); gb.geo(g, px, y + v, pz, ry + a, c, e, 0, 0, sx, sy, sz); };
  switch (k) {
    case 'potplant': cyl(0, 0, 0, 0.16, 0.26, 0xb8805a, 0, 14, 0.2); for (let i = 0; i < 5; i++) { const a = i * 1.256; geo(oct(), Math.cos(a) * 0.08, 0.42, Math.sin(a) * 0.08, a, 0.05, 0.16, 0.05, 0x7fd890, 0.2); } sph(0, 0.6, 0, 0.07, col, 1.2); break;
    case 'lantern': cyl(0, 0, 0, 0.12, 0.04, DARK, 0, 12); cyl(0, 0.04, 0, 0.09, 0.3, col, 1.4, 12); cyl(0, 0.34, 0, 0.11, 0.03, DARK); break;
    case 'lightorb': cyl(0, 0, 0, 0.14, 0.03, DARK, 0, 14); cyl(0, 0.03, 0, 0.012, 0.8, 0x9aa4b0, 0, 6); sph(0, 0.95, 0, 0.13, col, 1.6); break;
    case 'trinket': cyl(0, 0, 0, 0.1, 0.06, DARK); geo(oct(), 0, 0.2, 0, 0.3, 0.06, 0.13, 0.06, col, 1.0); break;
    case 'kite': cyl(0, 0, 0, 0.12, 0.03, DARK); cyl(0, 0.03, 0, 0.01, 0.9, 0x9aa4b0, 0, 6); box(0, 0.75, 0, 0.5, 0.5, 0.01, col, 0.25); break;
    case 'toyorb': sph(0, 0.11, 0, 0.11, col, 0.6); break;
    case 'giftbox': box(0, 0, 0, 0.32, 0.24, 0.32, col); box(0, 0, 0, 0.34, 0.25, 0.05, 0xff6a4a); box(0, 0, 0, 0.05, 0.25, 0.34, 0xff6a4a); break;
    case 'flower': cyl(0, 0, 0, 0.08, 0.3, 0x9fd8e8, 0.1, 12, 0.11); for (let i = 0; i < 3; i++) { cyl(-0.04 + i * 0.04, 0.3, 0, 0.006, 0.25, 0x5aa86a, 0, 4); sph(-0.04 + i * 0.04, 0.58, 0, 0.045, col, 1.1); } break;
    case 'storybook': box(0, 0, 0, 0.3, 0.06, 0.22, col); box(0.01, 0.06, 0, 0.28, 0.005, 0.2, 0xf1ece4); break;
    default: sph(0, 0.1, 0, 0.1, col, 0.5);
  }
}
