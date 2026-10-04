// 지형 높이 함수. 렌더링(지형 메시), 충돌, 배치, 지도 모두 이 함수 하나를 씁니다.
import { createNoise2D, fbm, ridged, smoothstep } from '../core/noise.js';
import { REGIONS, WORLD } from './regions.js';
import { FLATTEN } from '../data/places.js';
import { ZONES, ZGEO, isRural, hasStreet, bandStart } from '../data/city.js';
import { zoneBlocks } from './cityplan.js';

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

  // 도시 땅 맞추기: 구역마다 높이를 맞춘다 (아래 LEVEL) — 작은 굴곡도 없앤다. 시골은 길만(_lvRoad) + 건물 집터(PADS)
  let flat = 1;
  if (LEVEL) flat = 1 - levelCity(x, z, h);
  if (flat < 1) h = _lvH;
  if (PGRID) { const pw = padAt(x, z, h, _lvRoad); if (pw > 0) { h = _lvH; flat = Math.min(flat, 1 - pw); } }
  if (detail >= 1 && flat > 0) {
    h += (2.4 * nD(x / 70, z / 70) + 1.1 * nE(x / 31, z / 31)) * flat;
    if (detail >= 2) h += 0.35 * nC(x / 9, z / 9) * flat;
  }
  return h;
}

// ── 도시 땅 맞추기 ─────────────────────────────
// 「구역별로 높이를 맞춘다」: 건물·길·소품이 모두 같은 평평한 바닥에 놓이게.
//  · 평평한 단(flat): 수도·네 구역·지방 도시 — 구역 전체(가운데 장소 포함)를 한 높이(구역 땅의 중앙값)로. 바깥 160 m 는 둑으로 원래 지형에 잇는다.
//  · 계단 단(terrace): 넓은 교외 — 블록마다 평평한 단, 길(고리 거리·골목·대로)이 이웃 단 사이의 완만한 경사로가 된다.
//    이웃 블록의 높이 차는 길 폭의 0.3 배까지로 눌러(반복 이완) 걸어 오를 수 있게 한다.
//  · 맞추지 않음(grade: false): 협곡·균열이 곧 도시의 모습인 곳 — 작은 굴곡만 없앤다.
//  · 바다·물가(원래 높이 2.5 m 아래)는 그대로. 넓은 구역부터 적용하고 그 위에 좁은 구역을 덮어, 겹치는 둑도 끊기지 않는다.
let LEVEL = null;
let _lvH = 0;
const TAU = Math.PI * 2;
const ss01 = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
/** 계단 단: 고리 띠 k 의 각 θ, 반지름 r 에서의 높이 (블록 안은 평평, 골목·대로는 이웃 블록 사이 경사) */
function bandLevel(Z, k, r, ang) {
  const B = Z.bands[k], m = B.m, SA = Z.SA, n = Z.avenues;
  const rel = ((((ang - Z.aOff) % TAU) + TAU) % TAU);
  const s = Math.min(n - 1, Math.floor(rel / SA)), fs = rel - s * SA;
  const j = Math.min(m - 1, Math.floor((fs / SA) * m));
  const half = Z.lane / 2, av = Z.avH;
  const t0 = j === 0 ? av : half, t1 = j === m - 1 ? av : half;
  const a0 = (j * SA) / m + t0 / r, a1 = ((j + 1) * SA) / m - t1 / r;
  const lv = Z.levels, o = B.off;
  let L = lv[o + s * m + j];
  if (fs < a0) {
    const prev = j > 0 ? lv[o + s * m + j - 1] : lv[o + ((s - 1 + n) % n) * m + m - 1];
    const g0 = (j * SA) / m - (j > 0 ? half : av) / r;
    L = prev + (L - prev) * ss01((fs - g0) / Math.max(1e-6, a0 - g0));
  } else if (fs > a1) {
    const next = j < m - 1 ? lv[o + s * m + j + 1] : lv[o + ((s + 1) % n) * m];
    const g1 = ((j + 1) * SA) / m + (j < m - 1 ? half : av) / r;
    L = L + (next - L) * ss01((fs - a1) / Math.max(1e-6, g1 - a1));
  }
  return L;
}
function terraceAt(Z, r, ang) {
  const nb = Z.bands.length;
  const k = Math.floor((r - Z.r0) / Z.ring);
  if (k < 0) return bandLevel(Z, 0, Math.max(r, Z.r0), ang);
  if (k >= nb) return bandLevel(Z, nb - 1, r, ang);
  const vb = r - (Z.r0 + k * Z.ring), bs = Z.bands[k].bs;
  if (vb >= bs || k === 0) return bandLevel(Z, k, r, ang);
  const lo = bandLevel(Z, k - 1, r, ang), hi = bandLevel(Z, k, r, ang);
  return lo + (hi - lo) * ss01(vb / bs);
}
// ── 시골 길 (mode 4) ─────────────────────
// 고리 길(띠마다 경계 + 바깥 가장자리)의 높이는 그 둘레를 따라 자연 높이를 재어 부드럽게 하고(±40 m) 경사를 7.5% 로 누른 줄.
// 대로·골목은 이웃한 고리 길 높이 사이를 반지름으로 잇는다 — 그래서 교차로에서 높이가 늘 맞는다. 줄은 처음 쓰일 때 만든다.
let _lvRoad = 0, _rdH = 0, _rdCore = 0;
const RD_STEP = 12, RD_SH = 7; // 줄의 표본 간격(m), 길 어깨(자연 지형으로 잇는 폭, m)
function ringProfile(Z, k) {
  let P = Z.prof[k];
  if (P) return P;
  const R = Z.ringR[k], n = Math.max(48, Math.ceil((TAU * R) / RD_STEP)), w = new Float32Array(RC);
  const a = new Float32Array(n), b = new Float32Array(n);
  // 자연 높이로 잰다 (땅 맞추기·집터를 잠시 끄고 — 자기 자신을 부르지 않게)
  const sL = LEVEL, sP = PGRID, sR = _lvRoad, sH = _lvH;
  LEVEL = null; PGRID = null;
  for (let i = 0; i < n; i++) { const t = (i / n) * TAU; a[i] = rawHeight(Z.cx + Math.cos(t) * R, Z.cz + Math.sin(t) * R, 0, w); }
  LEVEL = sL; PGRID = sP; _lvRoad = sR; _lvH = sH;
  // 부드럽게 (상자 거르기 두 번 ≈ ±40 m)
  for (let pass = 0; pass < 2; pass++) {
    const src = pass ? b : a, dst = pass ? a : b;
    for (let i = 0; i < n; i++) { let sum = 0; for (let j = -3; j <= 3; j++) sum += src[(i + j + n) % n]; dst[i] = sum / 7; }
  }
  // 경사 제한 (반복 이완)
  const mx = 0.075 * ((TAU * R) / n);
  for (let it = 0; it < 60; it++) {
    let worst = 0;
    for (let i = 0; i < n; i++) { const j = (i + 1) % n, dl = a[j] - a[i], ad = Math.abs(dl); if (ad <= mx) continue; const e = ((ad - mx) / 2) * Math.sign(dl); a[i] += e; a[j] -= e; worst = Math.max(worst, ad - mx); }
    if (worst < 0.02) break;
  }
  Z.prof[k] = a;
  return a;
}
function ringH(Z, k, ang) {
  const P = ringProfile(Z, k), n = P.length;
  const t = (((ang % TAU) + TAU) % TAU) / TAU * n, i = Math.floor(t), f = t - i;
  return P[i % n] * (1 - f) + P[(i + 1) % n] * f;
}
/** 반지름 r 에서 각 ang 의 고리 길 높이를 이어 잇기 (대로·골목) */
function radialH(Z, r, ang) {
  const R = Z.ringR, nk = R.length;
  if (r <= R[0]) return ringH(Z, 0, ang);
  if (r >= R[nk - 1]) return ringH(Z, nk - 1, ang);
  let k = Math.min(nk - 2, Math.max(0, Math.floor((r - Z.r0) / Z.ring)));
  while (k > 0 && R[k] > r) k--;
  while (k < nk - 2 && R[k + 1] < r) k++;
  const t = ss01((r - R[k]) / (R[k + 1] - R[k]));
  return ringH(Z, k, ang) * (1 - t) + ringH(Z, k + 1, ang) * t;
}
/** 시골 길: 0..1 (1 = 길 위) — 높이는 _rdH */
function ruralRoad(Z, d, ang) {
  _rdCore = 0;
  if (d < Z.r0 - Z.street - RD_SH || d > Z.rOut + Z.street + RD_SH) return 0;
  let W = 0, acc = 0, wsum = 0;
  const add = (w, h, core) => { if (w <= 0) return; acc += w * h; wsum += w; if (w > W) W = w; if (core > _rdCore) _rdCore = core; };
  // 고리 길
  const kf = Math.floor((d - Z.r0) / Z.ring);
  for (let k = Math.max(0, kf - 1); k <= Math.min(Z.ringR.length - 1, kf + 1); k++) {
    const dist = Math.abs(d - Z.ringR[k]);
    if (dist < Z.ringW[k] + RD_SH) add(1 - smoothstep(Z.ringW[k], Z.ringW[k] + RD_SH, dist), ringH(Z, k, ang), 1 - smoothstep(Z.ringW[k], Z.ringW[k] + 0.8, dist));
  }
  // 대로
  const rel = (((ang - Z.aOff) % TAU) + TAU) % TAU;
  const s = Math.round(rel / Z.SA) % Z.avenues;
  let da = Math.abs(rel - s * Z.SA); if (da > Math.PI) da = TAU - da;
  const dAv = da * d;
  if (dAv < Z.avH + RD_SH) add(1 - smoothstep(Z.avH, Z.avH + RD_SH, dAv), radialH(Z, d, Z.aOff + s * Z.SA), 1 - smoothstep(Z.avH, Z.avH + 0.8, dAv));
  // 골목 (띠 안 블록 사이)
  if (kf >= 0 && kf < Z.nb) {
    const m = Z.bandM[kf], s0 = Math.floor(rel / Z.SA), fs = rel - s0 * Z.SA, jf = Math.round(fs / (Z.SA / m));
    if (jf >= 1 && jf <= m - 1) {
      const dl = Math.abs(fs - (jf * Z.SA) / m) * d, hw = Z.lane / 2;
      if (dl < hw + RD_SH * 0.7) add(1 - smoothstep(hw, hw + RD_SH * 0.7, dl), radialH(Z, d, Z.aOff + s0 * Z.SA + (jf * Z.SA) / m), 1 - smoothstep(hw, hw + 0.8, dl));
    }
  }
  if (wsum <= 0) return 0;
  _rdH = acc / wsum;
  return W;
}

// ── 시골 집터 (cityfabric 이 건물을 놓은 뒤 setPads 로 받는다 — 메인과 지형 워커 모두) ──
// [x, z, 반폭x, 반폭z, 방향, 높이] × n. 건물 바닥(가장자리 +1.5 m) 은 그 높이로, 둘레 PAD_F m 는 자연 지형으로 잇는다. 길 위는 건드리지 않는다.
let PADS = null, PGRID = null;
const PCELL = 64, PAD_F = 8;
export function setPads(arr) {
  PADS = arr && arr.length ? arr : null;
  PGRID = PADS ? new Map() : null;
  if (!PADS) return;
  for (let i = 0; i < PADS.length; i += 6) {
    const R = Math.hypot(PADS[i + 2], PADS[i + 3]) + PAD_F;
    for (let cx = Math.floor((PADS[i] - R) / PCELL); cx <= Math.floor((PADS[i] + R) / PCELL); cx++) for (let cz = Math.floor((PADS[i + 1] - R) / PCELL); cz <= Math.floor((PADS[i + 1] + R) / PCELL); cz++) {
      const key = cx * 100003 + cz;
      let L = PGRID.get(key);
      if (!L) PGRID.set(key, (L = []));
      L.push(i);
    }
  }
}
/** 집터: 0..1 (1 = 건물 바닥) — 결과 높이는 _lvH */
function padAt(x, z, h, road) {
  const L = PGRID.get(Math.floor(x / PCELL) * 100003 + Math.floor(z / PCELL));
  if (!L) return 0;
  let acc = 0, wsum = 0, W = 0;
  for (const i of L) {
    const dx = x - PADS[i], dz = z - PADS[i + 1], c = Math.cos(PADS[i + 4]), sn = Math.sin(PADS[i + 4]);
    const lx = dx * c - dz * sn, lz = dx * sn + dz * c;
    const ex = Math.max(Math.abs(lx) - PADS[i + 2], 0), ez = Math.max(Math.abs(lz) - PADS[i + 3], 0);
    const dist = Math.hypot(ex, ez);
    if (dist >= PAD_F) continue;
    const w = 1 - smoothstep(0, PAD_F, dist), w4 = w * w * w * w; // 가까운 집터가 이긴다 (이웃 집터 사이는 부드럽게)
    acc += w4 * PADS[i + 5]; wsum += w4; if (w > W) W = w;
  }
  if (wsum <= 0) return 0;
  W *= 1 - road;
  _lvH = h + (acc / wsum - h) * W;
  return W;
}

// ── 시골 블록 단 (cityfabric 이 쓰임을 정한 뒤 setRuralBlocks 로 받는다 — 메인과 지형 워커 모두) ──
// 집·가게·광장·공방처럼 바닥을 까는 블록은 둘레 길 높이를 이은 매끈한 면(radialH)으로 고른다 — 길과 늘 높이가 맞는다.
// 논밭·녹지·비탈은 자연 지형 그대로 두되, 고른 블록과 맞닿은 가장자리 RB_FALL m 는 그 면으로 완만하게 잇는다(길가 절벽 대신).
const RB_FALL = 18;
export function setRuralBlocks(map) {
  if (!LEVEL || !map) return;
  for (const L of LEVEL) if (L.mode === 4) L.hard = map[L.zi] || null;
}
function hardIdx(Z, k, s, j) {
  const n = Z.avenues;
  return Z.hard[Z.bStart[k] + (((s % n) + n) % n) * Z.bandM[k] + j] || 0;
}
/** 블록 (k, 각) 의 s, j */
function blockOf(Z, k, rel) {
  const s = Math.min(Z.avenues - 1, Math.floor(rel / Z.SA)), m = Z.bandM[k];
  return [s, Math.min(m - 1, Math.floor(((rel - s * Z.SA) / Z.SA) * m))];
}
/** 0..1: 고른 블록 면을 얼마나 따를까 */
function hardAt(Z, d, ang) {
  const k = Math.floor((d - Z.r0) / Z.ring);
  if (k < 0 || k >= Z.nb) return 0;
  const rel = (((ang - Z.aOff) % TAU) + TAU) % TAU;
  const [s, j] = blockOf(Z, k, rel), m = Z.bandM[k];
  if (hardIdx(Z, k, s, j)) return 1;
  let w = 0;
  const fall = (dist, hard) => { if (hard && dist < RB_FALL) w = Math.max(w, 1 - ss01(Math.max(0, dist) / RB_FALL)); };
  const dIn = d - (Z.r0 + k * Z.ring + Z.bs[k]), dOut = Z.r0 + (k + 1) * Z.ring - d;
  if (k > 0 && dIn < RB_FALL) { const [s2, j2] = blockOf(Z, k - 1, rel); fall(dIn, hardIdx(Z, k - 1, s2, j2)); }
  if (k < Z.nb - 1 && dOut < RB_FALL) { const [s2, j2] = blockOf(Z, k + 1, rel); fall(dOut, hardIdx(Z, k + 1, s2, j2)); }
  const fs = rel - s * Z.SA, a0 = (j * Z.SA) / m, a1 = ((j + 1) * Z.SA) / m;
  const dL = (fs - a0) * d - (j === 0 ? Z.avH : Z.lane / 2), dR = (a1 - fs) * d - (j === m - 1 ? Z.avH : Z.lane / 2);
  if (dL < RB_FALL) fall(dL, j > 0 ? hardIdx(Z, k, s, j - 1) : hardIdx(Z, k, s - 1, m - 1));
  if (dR < RB_FALL) fall(dR, j < m - 1 ? hardIdx(Z, k, s, j + 1) : hardIdx(Z, k, s + 1, 0));
  return w;
}

/** 구역들을 차례로 덮어 높이를 맞춘다. 결과는 _lvH, 돌려주는 값은 맞춘 정도(0..1, 가장 큰 것) */
function levelCity(x, z, hNat) {
  let h = hNat, mMax = 0;
  _lvRoad = 0;
  for (const Z of LEVEL) {
    const dx = x - Z.cx, dz = z - Z.cz, d2 = dx * dx + dz * dz;
    if (d2 > Z.R2) continue;
    const d = Math.sqrt(d2);
    let m = smoothstep(Z.hi + Z.E, Z.hi, d);
    if (Z.lo > 0) m *= smoothstep(Z.lo - Z.Ein, Z.lo, d);
    if (m <= 0) continue;
    if (Z.mode === 4) {
      // 시골: 자연 지형 그대로 — 길(고리 길·대로·골목)만 가로로 평평하고 세로로 완만하게, 둘레는 자연스럽게 잇는다
      //       바닥을 까는 블록(집·가게·광장…)은 둘레 길을 이은 매끈한 면으로 (논밭·녹지는 그대로)
      const ang = Math.atan2(dz, dx);
      if (Z.hard) {
        let wb = hardAt(Z, d, ang) * m;
        if (wb > 0) {
          // 물가: 물은 메우지 않고, 면이 물가보다 한참 높으면 바닷가 쪽으로 비탈지게 내려 둑 벽이 서지 않게
          const S = radialH(Z, d, ang);
          if (hNat < 6) wb *= smoothstep(0.5, Math.min(6, 2.5 + 0.6 * Math.max(0, S - hNat)), hNat);
          if (wb > 0) { h += (S - h) * wb; if (wb > mMax) mMax = wb; }
        }
      }
      let w = ruralRoad(Z, d, ang);
      if (w <= 0) continue;
      w *= m * smoothstep(0.5, 2.5, hNat); // 물 위로는 길을 돋우지 않는다
      if (w <= 0) continue;
      h += (_rdH - h) * w;
      if (w > mMax) mMax = w;
      const core = _rdCore * smoothstep(0.5, 2.5, hNat);
      if (core > _lvRoad) _lvRoad = core; // 집터는 길 어깨는 덮고 차도·보도는 건드리지 않는다
      continue;
    }
    if (m > mMax) mMax = m;
    if (Z.mode === 0) continue;
    const target = Z.mode === 2 ? terraceAt(Z, d, Math.atan2(dz, dx)) : Z.level;
    if (Z.water || target < 12) m *= smoothstep(0.5, 2.5, hNat); // 물가 도시·낮은 땅: 바다·물은 그대로 (높은 단은 좁은 물길을 메운다)
    if (Z.mode === 3) m *= smoothstep(Z.level + 60, Z.level + 35, hNat) * smoothstep(Z.level - 60, Z.level - 35, hNat); // 협곡 도시: 바닥 높이 둘레만 고르고 절벽·골은 그대로
    if (m <= 0) continue;
    h += (target - h) * m;
  }
  _lvH = h;
  return mMax;
}
{
  const w = new Float32Array(RC);
  const nat = (x, z) => rawHeight(x, z, 0, w);
  const list = ZGEO.map((G, i) => {
    const Z = ZONES[i];
    // 물가 도시(water)는 물 바로 위 낮은 단만 고르고 언덕·바다는 그대로 (협곡 도시처럼 높이 창으로)
    // 시골(교외 농장·마을)은 통째로 고르지 않는다(4: 길만) · 협곡·물가 도시는 높이 창(3) · 나머지 도시는 평평한 단(1)
    const mode = isRural(Z) ? 4 : Z.grade === false || Z.water ? 3 : Z.mix === 'suburb' ? 2 : 1;
    const hi = G.rOut + G.street;
    // 교외의 안쪽 가장자리는 가운데 구역(수도)의 단 끝에 바로 붙인다 — 그 사이로 원래 지형(고원 벼랑의 계단)이 새지 않게
    let lo = 0, Ein = 120, E = mode === 2 ? 200 : 160;
    if (mode === 2) {
      const inner = ZGEO.find((H, j) => j !== i && H.cx === G.cx && H.cz === G.cz && H.rOut + H.street < G.r0);
      lo = inner ? inner.rOut + inner.street + 8 : G.r0 - G.street;
      Ein = inner ? 40 : 120;
    } else {
      // 이 구역을 둘러싼 교외가 있으면 둑이 교외 첫 블록에 닿지 않게
      const outer = ZGEO.find((H, j) => j !== i && H.cx === G.cx && H.cz === G.cz && H.r0 > G.rOut);
      if (outer) E = Math.max(60, outer.r0 - outer.street - hi - 6);
    }
    const L = { mode, water: !!Z.water, cx: G.cx, cz: G.cz, lo, hi, E, Ein, R2: (hi + E) * (hi + E), prio: mode === 2 || mode === 4 ? 0 : 1 };
    if (mode === 4) {
      // 고리 길: 띠마다 시작 경계(차도 또는 골목) + 바깥 가장자리 차도. 줄(높이)은 처음 쓸 때 만든다
      const zb = zoneBlocks(i);
      Object.assign(L, { r0: G.r0, ring: G.ring, nb: G.nb, rOut: G.rOut, street: G.street, avenues: G.avenues, SA: TAU / G.avenues, aOff: G.aOff, avH: G.avH, lane: G.lane, prof: [], lo: 0, E: 0, R2: (G.rOut + G.street + RD_SH + 2) ** 2 });
      L.hi = G.rOut + G.street + RD_SH + 1; L.E = 1;
      L.ringR = []; L.ringW = [];
      for (let k = 0; k < G.nb; k++) { const bs = bandStart(G, k); L.ringR.push(G.r0 + k * G.ring + bs / 2); L.ringW.push(bs / 2); }
      L.ringR.push(G.rOut + G.street / 2); L.ringW.push(G.street / 2);
      L.bandM = zb.rings.map((R) => R.m);
      L.bStart = zb.rings.map((R) => R.start);
      L.bs = zb.rings.map((R, k) => bandStart(G, k));
      L.zi = i; L.hard = null;
      void hasStreet;
    }
    if (mode === 1 || mode === 3) {
      // 구역 땅(가운데 포함)의 높이 중앙값 — 물(2.5 m 아래)은 빼고
      const hs = [];
      for (let r = 20; r <= hi; r += 50) {
        const na = Math.max(6, Math.round((TAU * r) / 60));
        for (let a = 0; a < na; a++) { const t = (a / na) * TAU; const v = nat(G.cx + Math.cos(t) * r, G.cz + Math.sin(t) * r); if (v >= 2.5) hs.push(v); }
      }
      hs.sort((p, q) => p - q);
      L.level = hs.length ? Math.max(3.5, hs[Math.floor(hs.length * (Z.water ? 0.2 : 0.5))]) : 3.5;
      if (Z.water) L.level = Math.min(12, L.level);
    } else if (mode === 2) {
      const zb = zoneBlocks(i);
      Object.assign(L, { r0: G.r0, ring: G.ring, avenues: G.avenues, SA: TAU / G.avenues, aOff: G.aOff, avH: G.avH, lane: G.lane });
      L.bands = zb.rings.map((R, k) => ({ m: R.m, bs: R.street ? G.street : G.lane, off: 0 }));
      let off = 0;
      for (const b of L.bands) { b.off = off; off += b.m * G.avenues; }
      const lv = new Float32Array(off);
      const at = (B, fu, fv) => { const r = B.R0 + B.D * fv, a = B.th0 + (B.L * fu + B.t0) / r; return nat(G.cx + Math.cos(a) * r, G.cz + Math.sin(a) * r); };
      const idxOf = (k, s, j) => L.bands[k].off + s * L.bands[k].m + j;
      for (const B of zb.blocks) {
        let sum = 0, n = 0;
        for (const fu of [0.2, 0.5, 0.8]) for (const fv of [0.2, 0.5, 0.8]) { sum += at(B, fu, fv); n++; }
        lv[idxOf(B.k, B.s, B.j)] = sum / n;
      }
      // 이웃: 같은 띠의 옆 블록(골목·대로), 안쪽 띠에서 각이 겹치는 블록(고리 거리·골목)
      const edges = [];
      for (const B of zb.blocks) {
        const m = L.bands[B.k].m, me = idxOf(B.k, B.s, B.j);
        const nj = B.j + 1 < m ? idxOf(B.k, B.s, B.j + 1) : idxOf(B.k, (B.s + 1) % G.avenues, 0);
        edges.push([me, nj, (B.j + 1 < m ? G.lane : 2 * G.avH) * 0.3]);
        if (B.k > 0) {
          const mi = L.bands[B.k - 1].m, bsK = L.bands[B.k].bs;
          const j0 = Math.floor((B.j / m) * mi), j1 = Math.min(mi - 1, Math.floor(((B.j + 1) / m) * mi - 1e-6));
          for (let jj = j0; jj <= j1; jj++) edges.push([me, idxOf(B.k - 1, B.s, jj), bsK * 0.3]);
        }
      }
      // 한 번 고르게 한 뒤, 이웃 차가 경사로 한도를 넘지 않게 반복 이완
      for (let it = 0; it < 80; it++) {
        let worst = 0;
        for (const [a, b, mx] of edges) {
          const dlt = lv[a] - lv[b], ad = Math.abs(dlt);
          if (ad <= mx) continue;
          const e = ((ad - mx) / 2) * Math.sign(dlt);
          lv[a] -= e; lv[b] += e;
          worst = Math.max(worst, ad - mx);
        }
        if (worst < 0.05) break;
      }
      L.levels = lv;
    }
    return L;
  });
  // 넓은 구역(교외)부터, 그 위에 좁은 구역
  LEVEL = list.filter((L) => L.mode !== 0 || true).sort((a, b) => a.prio - b.prio);
}
/** 0..1: 도시 땅 맞추기가 얼마나 걸린 자리인가 */
export function cityMask(x, z) { return LEVEL ? levelCity(x, z, rawHeight(x, z, 0, new Float32Array(RC))) : 0; }

// 장소 주변 평탄화 — 목표 높이가 없으면 그 자리의 원래 높이(중심점)를 쓴다 (도시 안이면 고른 바닥 높이)
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
