// 공원 연못 = 실제 물 (사용자 제보 「호수는 실제 물이어야」): city-ground.js 의 계획 녹지 배치(cityBlock 의 t == 10)와
//  같은 식으로 블록의 (u, v) 가 물인지 판정한다 — 블록이 깨어날 때 그 자리에 물결 지는 물면을 깔고(cityfabric._pondMesh),
//  걸어 들어가면 물을 헤치며(game._wading), 소품·사람 자리는 물 위에 두지 않는다. GLSL 배치를 바꾸면 여기도 같이 바꿀 것.
import { blockLenAt } from './cityplan.js';

const fract = (x) => x - Math.floor(x);
/** 정원 방 칸의 쓰임 (GLSL 과 같은 식 — sin 해시 대신 정밀도에 흔들리지 않는 식) */
export const roomHash = (gx, gy, vari) => fract((gx * 7 + gy * 13 + vari * 3) * 0.137);

/** 블록 B 의 (u, v) 가 공원 물인가 */
export function parkWaterAt(B, u, v) {
  const L = blockLenAt(B, v), D = B.D, vari = B.variant, j = B.j;
  if (u < 0 || u > L || v < 0 || v > D) return false;
  const edge = Math.min(u, L - u, v, D - v);
  if (edge < 1.5) return false;
  const cu = L * 0.5, cv = D * 0.5, pr = Math.min(L, D) * 0.2;
  const r1 = fract(vari * 0.618034 + j * 0.137), r2 = fract(vari * 0.381966 + 0.17 + j * 0.291), r3 = fract(vari * 0.754878 + 0.41), r4 = fract(vari * 0.56984 + 0.33 + j * 0.53);
  const lay = Math.floor(vari + j * 3) % 5;
  const qx = r4 > 0.5 ? L - u : u, qy = v;
  if (lay === 0) { // 연못 정원
    const pcx = cu + (r1 - 0.5) * L * 0.34, pcy = cv + (r2 - 0.5) * D * 0.22;
    const rr = pr * (0.75 + r3 * 0.55);
    const ex = (qx - pcx) / rr, ey = (qy - pcy) / (rr * (0.65 + r1 * 0.3));
    const de = (Math.hypot(ex, ey) + 0.12 * Math.sin(Math.atan2(ey, ex) * 3 + r2 * 6.28)) * rr;
    if (!(de < rr)) return false;
    const yx = pcx > cu ? L * 0.2 : L * 0.8, yy = cv + (r3 - 0.5) * D * 0.3;
    return !(Math.hypot(qx - yx, qy - yy) < 6 + r1 * 2);
  }
  if (lay === 1) { // 시냇물 (돌다리 자리는 빼고)
    const yc = cv + D * (0.14 + r3 * 0.08) * Math.sin(qx * 6.2832 / L * (0.8 + r1 * 0.9) + r2 * 6.2832);
    const dw = Math.abs(v - yc), w = 1.4 + r3 * 1.3;
    if (!(dw < w)) return false;
    return !(Math.abs(qx - L * (0.25 + r1 * 0.5)) < 1.4);
  }
  if (lay === 2) { // 정원 방의 작은 연못
    if (edge < 3) return false;
    const nx = r1 > 0.5 ? 3 : 2, cx = (L - 6) / nx, cy = (D - 6) / 2;
    const gx = (qx - 3) / cx, gy = (qy - 3) / cy, gix = Math.floor(gx), giy = Math.floor(gy);
    if (gix < 0 || gix >= nx || giy < 0 || giy >= 2) return false;
    const fx = fract(gx) * cx, fy = fract(gy) * cy;
    const wall = Math.min(fx, cx - fx, fy, cy - fy);
    if (wall < 1.3) return false;
    if (wall < 2.2 && !(Math.abs(fx - cx * 0.5) < 1.2 || Math.abs(fy - cy * 0.5) < 1.2)) return false;
    const h = roomHash(gix, giy, vari);
    if (!(h >= 0.3 && h < 0.55)) return false;
    return Math.hypot(fx - cx * 0.5, fy - cy * 0.5) < Math.min(cx, cy) * 0.22;
  }
  if (lay === 3) { // 고리 산책로 안의 연못
    if (edge < 3) return false;
    const c0x = qx - cu, c0y = qy - cv, ra = L * 0.36, rb = D * 0.32;
    const k0 = Math.hypot(c0x / ra, c0y / rb) * (1 + 0.1 * Math.sin(Math.atan2(c0y, c0x) * 3 + r2 * 6.28));
    const dk = (k0 - 1) * Math.min(ra, rb);
    if (Math.abs(dk) < 1.3 || dk > 0) return false;
    return Math.hypot(c0x - (r1 - 0.5) * ra * 0.8, c0y - (r3 - 0.5) * rb * 0.6) < 4 + r2 * 3;
  }
  // 들꽃 초원의 웅덩이
  const yc = cv + D * 0.24 * Math.sin(qx * 0.075 + r1 * 6.28) + D * 0.08 * Math.sin(qx * 0.21 + r2 * 6.28);
  const pwx = L * (0.2 + r3 * 0.6), pwy = yc + (r2 > 0.5 ? 7 : -7);
  return Math.hypot(qx - pwx, (qy - pwy) / 0.75) < 3.5 + r1 * 2.5;
}
