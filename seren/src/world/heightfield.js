// 지형 높이 함수. 렌더링(지형 메시), 충돌, 배치, 지도 모두 이 함수 하나를 씁니다.
import { createNoise2D, fbm, ridged, smoothstep } from '../core/noise.js';
import { REGIONS, WORLD } from './regions.js';
import { FLATTEN } from '../data/places.js';

const nA = createNoise2D(1337);
const nB = createNoise2D(4242);
const nC = createNoise2D(777);
const nD = createNoise2D(9001);
const nE = createNoise2D(31337);

export const RC = REGIONS.length;
const CX = REGIONS.map((r) => r.center[0]);
const CZ = REGIONS.map((r) => r.center[1]);
const SZ = REGIONS.map((r) => r.size);
const scoreBuf = new Float32Array(RC);
const _w = new Float32Array(RC);

const BLEND_T = 520; // 지역 경계 부드러움(m)

/** 지역 가중치(합=1)를 out 배열에 채우고 지배 지역 인덱스를 반환 */
export function regionWeights(x, z, out = _w) {
  const wx = x + 2100 * fbm(nB, x / 6500, z / 6500, 3) + 450 * nE(x / 1400, z / 1400);
  const wz = z + 2100 * fbm(nB, x / 6500 + 41.3, z / 6500 - 17.9, 3) + 450 * nE(x / 1400 + 77, z / 1400 - 31);
  let minS = 1e12, best = 0;
  for (let i = 0; i < RC; i++) {
    const dx = wx - CX[i], dz = wz - CZ[i];
    const s = Math.sqrt(dx * dx + dz * dz) / SZ[i];
    scoreBuf[i] = s;
    if (s < minS) { minS = s; best = i; }
  }
  let sum = 0;
  for (let i = 0; i < RC; i++) {
    const w = Math.exp(-(scoreBuf[i] - minS) / BLEND_T);
    out[i] = w;
    sum += w;
  }
  for (let i = 0; i < RC; i++) out[i] /= sum;
  return best;
}

function terrace(h, step, sharp) {
  const t = h / step;
  const f = t - Math.floor(t);
  return (Math.floor(t) + smoothstep(0.5 - sharp, 0.5 + sharp, f)) * step;
}

// 지역별 지형 (해수면 기준 m)
function regionHeight(i, x, z, base) {
  switch (i) {
    case 0: { // 척추 고원 주변 저지
      return base * 0.8 + 18 * fbm(nC, x / 900, z / 900, 3);
    }
    case 1: { // 빛갈대 들판: 완만한 구릉
      const hills = fbm(nC, x / 1150, z / 1150, 4) * 0.5 + 0.5;
      const ridge = ridged(nA, x / 2600, z / 2600, 3);
      return base + 62 * hills * hills + 34 * ridge;
    }
    case 2: { // 유리 황야: 사구 + 계단형 메사
      const u = x * 0.82 + z * 0.57, v = -x * 0.57 + z * 0.82;
      const wob = 2.2 * fbm(nB, x / 800, z / 800, 2);
      const d = 1 - Math.abs(nD(u / 300 + wob, v / 1100));
      const dunes = 16 * d * d + 6 * fbm(nC, x / 400, z / 400, 2);
      const m = fbm(nA, x / 2300 + 7.7, z / 2300 - 3.1, 4);
      const mesa = 150 * smoothstep(0.17, 0.21, m) + 70 * smoothstep(0.34, 0.37, m);
      return base * 0.55 + dunes + mesa;
    }
    case 3: { // 균사 숲: 굽이치는 저지대
      const h = fbm(nC, x / 1300, z / 1300, 4);
      return base * 0.9 + 48 * h + 22 * ridged(nE, x / 1700, z / 1700, 3);
    }
    case 4: { // 부유 협곡: 높은 대지 + 깊은 협곡 + 지층 계단
      const wx = x + 700 * fbm(nE, x / 3000, z / 3000, 2);
      const wz = z + 700 * fbm(nE, x / 3000 + 9, z / 3000 + 4, 2);
      const c = Math.abs(fbm(nB, wx / 3400, wz / 3400, 3));
      const carve = 1 - smoothstep(0.012, 0.09, c);
      const plateau = 270 + 60 * fbm(nC, x / 1500, z / 1500, 3);
      const h = plateau - carve * 235;
      return terrace(h, 26, 0.13);
    }
    case 5: { // 서리 첨봉: 능선형 산맥
      const r = ridged(nA, x / 5600 + 3.3, z / 5600 - 1.7, 7);
      const lift = smoothstep(0.0, 0.6, r);
      return 180 + 2300 * Math.pow(r, 2.4) + 140 * lift * fbm(nE, x / 600, z / 600, 3);
    }
    case 6: { // 노래하는 바다: 섬과 여울
      const isl = fbm(nC, x / 2600 + 5, z / 2600 - 2, 4);
      return -80 + 260 * smoothstep(0.16, 0.6, isl) + 18 * fbm(nA, x / 500, z / 500, 2);
    }
    case 7: { // 깊은목: 1 km 대지를 남북으로 가르는 균열
      const cx = 40000 + 1300 * Math.sin(z / 6500) + 400 * fbm(nB, z / 3000, 3.3, 2);
      const along = Math.abs(z - 2000);
      const w = (700 + 260 * fbm(nE, z / 2500, 1.7, 3)) * (1 - smoothstep(9000, 12500, along));
      const d = Math.abs(x - cx);
      const plateau = 980 + 140 * fbm(nC, x / 2200, z / 2200, 4) + 40 * ridged(nA, x / 900, z / 900, 3);
      const carve = 1 - smoothstep(w, w + 320, d);
      const floor = 70 + 25 * fbm(nD, x / 400, z / 400, 2);
      const wall = terrace(plateau * (1 - carve) + floor * carve, 70, 0.18);
      return carve > 0.98 ? floor : wall;
    }
    case 8: { // 느린땅: 넓고 평평한 금빛 초원 + 오래된 언덕 줄기
      const sw = fbm(nC, x / 4200, z / 4200, 4);
      const ridge = Math.pow(ridged(nA, x / 7000 + 1.1, z / 7000 - 4.2, 3), 3);
      return 55 + 45 * sw + 160 * ridge + 6 * fbm(nE, x / 600, z / 600, 2);
    }
    case 9: { // 흰 숨: 얼음 평원 + 압력 능선 + 갈라진 틈 + 얼음 봉우리
      const ridgeL = Math.pow(ridged(nB, x / 1800, z / 1800, 3), 6) * 26;
      const crack = smoothstep(0.035, 0.0, Math.abs(fbm(nE, x / 2600, z / 2600, 3)));
      const nun = Math.pow(Math.max(0, fbm(nA, x / 5200 + 9.1, z / 5200 - 3.3, 4) - 0.18), 1.4) * 1900;
      return 14 + 6 * fbm(nC, x / 900, z / 900, 2) + ridgeL + nun - crack * 22;
    }
    case 10: { // 천 폭포 고원: 높은 대지 + 굽이치는 골짜기
      const v = Math.abs(fbm(nB, x / 3600 + 2.2, z / 3600 - 7.7, 3));
      const valley = 1 - smoothstep(0.02, 0.07, v);
      const top = 1620 + 120 * fbm(nC, x / 2400, z / 2400, 4);
      return terrace(top - valley * 140, 45, 0.15);
    }
  }
  return base;
}

// 먼 땅의 바다 경계: 중심에서의 거리에 노이즈를 섞은 해안선 (0 = 바다, 1 = 땅)
const FAR = REGIONS.map((r, i) => (r.far ? { i, x: r.center[0], z: r.center[1], R: r.landR, ax: r.ax || 1, az: r.az || 1 } : null)).filter(Boolean);
function farMask(x, z) {
  let m = 0;
  for (const f of FAR) {
    const dx = (x - f.x) / f.ax, dz = (z - f.z) / f.az;
    const d2 = dx * dx + dz * dz;
    const lim = f.R + 7000;
    if (d2 > lim * lim) continue;
    const d = Math.sqrt(d2) + 4200 * fbm(nE, x / 9000 + f.i * 3.1, z / 9000 - f.i * 1.7, 4) + 1400 * fbm(nD, x / 2600 - f.i, z / 2600, 3);
    m = Math.max(m, smoothstep(f.R + 1600, f.R - 900, d));
  }
  return m;
}

function rawHeight(x, z, detail, wOut) {
  regionWeights(x, z, wOut);
  const base = 34 + 26 * fbm(nA, x / 2600, z / 2600, 4);
  let h = 0;
  for (let i = 0; i < RC; i++) {
    const w = wOut[i];
    if (w < 0.003) continue;
    h += w * regionHeight(i, x, z, base);
  }

  // 대륙 경계 — 바깥은 바다
  const r = Math.sqrt(x * x + z * z);
  const rw = r + 3600 * fbm(nE, x / 9000, z / 9000, 4) + 900 * nD(x / 2600, z / 2600);
  let land = smoothstep(WORLD.landRadius + 2400, WORLD.landRadius - 1400, rw);
  land = Math.max(land, wOut[6] * smoothstep(WORLD.archRadius, WORLD.archRadius - 4000, r));
  if (r > 20000) land = Math.max(land, farMask(x, z));
  if (land < 1) {
    const isl = fbm(nD, x / 1900, z / 1900, 4);
    const floor = -170 + 30 * fbm(nB, x / 3000, z / 3000, 2) + 420 * Math.max(0, isl - 0.42);
    h = floor + (h - floor) * land;
  }

  // 척추 고원
  const pr = r + 140 * fbm(nB, x / 650, z / 650, 3);
  const p = smoothstep(WORLD.plateauRadius + 150, WORLD.plateauRadius, pr);
  if (p > 0) {
    const top = WORLD.plateauHeight + 5 * fbm(nC, x / 300, z / 300, 2);
    const h2 = h + (top - h) * p;
    const k = smoothstep(0.82, 1, p);
    h = terrace(h2, 34, 0.2) * (1 - k) + top * k;
  }

  // 해안을 완만하게 — 해수면 근처(−6..8 m)의 경사를 줄여 모래톱을 만든다
  if (h > -6 && h < 8) {
    const u = (h - 1) / 7;
    const s = 0.7;
    h = 1 + 7 * (u - (s * Math.sin(Math.PI * u)) / (2 * Math.PI) - (s * Math.sin(2 * Math.PI * u)) / (4 * Math.PI));
  }

  if (detail >= 1) h += 2.4 * nD(x / 70, z / 70) + 1.1 * nE(x / 31, z / 31);
  if (detail >= 2) h += 0.35 * nC(x / 9, z / 9);
  return h;
}

// 장소 주변 평탄화 — 목표 높이가 없으면 그 자리의 원래 높이(중심점)를 쓴다
for (const f of FLATTEN) if (f.h === undefined) f.h = rawHeight(f.x, f.z, 1, new Float32Array(RC));

/**
 * 지형 높이.
 * detail: 0 = 원경용(작은 굴곡 생략), 1 = 중간, 2 = 전체(충돌용)
 * wOut: 지역 가중치를 받을 배열(선택)
 */
export function heightAt(x, z, detail = 2, wOut = _w) {
  let h = rawHeight(x, z, detail, wOut);
  for (let i = 0; i < FLATTEN.length; i++) {
    const f = FLATTEN[i];
    const dx = x - f.x, dz = z - f.z;
    const R = f.r + f.blend;
    if (dx * dx + dz * dz > R * R) continue;
    const k = smoothstep(R, f.r, Math.sqrt(dx * dx + dz * dz));
    h += (f.h - h) * k;
  }
  return h;
}

/** 경사 계산용 법선 (중심 차분) */
export function normalAt(x, z, e = 1.5, out = [0, 1, 0]) {
  const hx = heightAt(x + e, z) - heightAt(x - e, z);
  const hz = heightAt(x, z + e) - heightAt(x, z - e);
  const nx = -hx, ny = 2 * e, nz = -hz;
  const l = Math.hypot(nx, ny, nz);
  out[0] = nx / l; out[1] = ny / l; out[2] = nz / l;
  return out;
}

export const scratchWeights = _w;
