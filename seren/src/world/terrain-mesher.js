// 지형 조각(청크) 메시 생성기. 워커와 메인 스레드 양쪽에서 쓸 수 있도록 three.js 에 의존하지 않습니다.
import { heightAt, RC } from './heightfield.js';
import { REGIONS } from './regions.js';
import { createNoise2D, hash2, smoothstep } from '../core/noise.js';
import { pavedAt } from '../data/city.js';

const nV = createNoise2D(2024);
const nS = createNoise2D(1999);

const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const hexLin = (h) => [lin(((h >> 16) & 255) / 255), lin(((h >> 8) & 255) / 255), lin((h & 255) / 255)];
const PAL = REGIONS.map((r) => ({
  grass: hexLin(r.pal.grass), grass2: hexLin(r.pal.grass2), soil: hexLin(r.pal.soil),
  rock: hexLin(r.pal.rock), rock2: hexLin(r.pal.rock2), glow: hexLin(r.pal.glow), glowAmt: r.pal.glowAmt,
}));
const SAND = hexLin(0xead6a8);
const WETSAND = hexLin(0xb59a74);
const SNOW = hexLin(0xf1f5ff);
const VIOLET = hexLin(0x7a62c0);
const PAVE1 = hexLin(0xa8a3b4), PAVE2 = hexLin(0x8e899c);
const STRATA = [hexLin(0xc0603f), hexLin(0xe0a070), hexLin(0x9a4636), hexLin(0xefc694), hexLin(0x8a4a42), hexLin(0xd27f52)];
const GSTRATA = [hexLin(0xd98f7a), hexLin(0xf0c4a8), hexLin(0xc06f78), hexLin(0xf6dcc4), hexLin(0xb46a80)];
const RSTRATA = [hexLin(0x6a4a66), hexLin(0x9a6a7a), hexLin(0x4e3a58), hexLin(0xb88a98), hexLin(0x5e4060), hexLin(0x8a5a72)];
const I_CANYON = 4, I_GLASS = 2, I_FROST = 5, I_MEADOW = 1, I_RIFT = 7, I_FALLS = 10;

/** 한 정점의 표면 색(선형)과 발광색을 계산 */
export function surfaceColor(x, z, h, ny, w, col, glow) {
  let gr = 0, gg = 0, gb = 0, rr = 0, rg = 0, rb = 0, lr = 0, lg = 0, lb = 0, ga = 0;
  const v = nV(x / 380, z / 380) * 0.5 + 0.5;
  const v2 = nV(x / 90 + 13, z / 90 - 7) * 0.5 + 0.5;
  for (let i = 0; i < RC; i++) {
    const wi = w[i];
    if (wi < 0.002) continue;
    const p = PAL[i];
    const t = Math.min(1, Math.max(0, v * 1.3 - 0.15 + (v2 - 0.5) * 0.4));
    let g0 = p.grass[0] + (p.grass2[0] - p.grass[0]) * t;
    let g1 = p.grass[1] + (p.grass2[1] - p.grass[1]) * t;
    let g2 = p.grass[2] + (p.grass2[2] - p.grass[2]) * t;
    if (i === I_MEADOW) {
      const vi = 0.75 * smoothstep(0.7, 0.86, nV(x / 140 - 40, z / 140 + 9) * 0.5 + 0.5);
      g0 += (VIOLET[0] - g0) * vi; g1 += (VIOLET[1] - g1) * vi; g2 += (VIOLET[2] - g2) * vi;
    }
    gr += wi * g0; gg += wi * g1; gb += wi * g2;
    let r;
    if (i === I_CANYON || i === I_GLASS || i === I_RIFT) {
      const S = i === I_CANYON ? STRATA : i === I_RIFT ? RSTRATA : GSTRATA;
      const band = Math.floor(h / 6.5 + 1.2 * nS(x / 260, z / 260));
      r = S[Math.floor(hash2(band, 7) * S.length)];
    } else {
      const t2 = Math.min(1, Math.max(0, v2 * 1.4 - 0.2));
      r = [p.rock[0] + (p.rock2[0] - p.rock[0]) * t2, p.rock[1] + (p.rock2[1] - p.rock[1]) * t2, p.rock[2] + (p.rock2[2] - p.rock[2]) * t2];
    }
    rr += wi * r[0]; rg += wi * r[1]; rb += wi * r[2];
    lr += wi * p.glow[0]; lg += wi * p.glow[1]; lb += wi * p.glow[2];
    ga += wi * p.glowAmt;
  }
  const rockAmt = smoothstep(0.84, 0.64, ny);
  let c0 = gr + (rr - gr) * rockAmt;
  let c1 = gg + (rg - gg) * rockAmt;
  let c2 = gb + (rb - gb) * rockAmt;

  // 모래톱
  const sand = smoothstep(5.0, 1.6, h) * smoothstep(0.55, 0.8, ny);
  if (sand > 0) {
    const wet = smoothstep(0.8, -0.6, h);
    const s0 = SAND[0] + (WETSAND[0] - SAND[0]) * wet, s1 = SAND[1] + (WETSAND[1] - SAND[1]) * wet, s2 = SAND[2] + (WETSAND[2] - SAND[2]) * wet;
    c0 += (s0 - c0) * sand; c1 += (s1 - c1) * sand; c2 += (s2 - c2) * sand;
  }
  // 눈
  const sn = w[I_FROST] * smoothstep(880, 1180, h + 160 * nS(x / 400, z / 400)) * smoothstep(0.5, 0.72, ny);
  const snowHigh = smoothstep(1500, 1700, h) * smoothstep(0.35, 0.5, ny) * (1 - (w[I_FALLS] || 0));
  const snow = Math.max(sn, snowHigh);
  if (snow > 0) {
    c0 += (SNOW[0] - c0) * snow; c1 += (SNOW[1] - c1) * snow; c2 += (SNOW[2] - c2) * snow;
  }
  // 도시: 포장된 땅 (돌판 무늬, 군데군데 공원)
  let pave = h > 1 ? pavedAt(x, z) : 0;
  if (pave > 0) {
    pave *= smoothstep(-0.45, -0.2, nV(x / 520 + 3, z / 520 - 5)) * (1 - rockAmt * 0.6);
    const tile = 0.9 + 0.12 * hash2(Math.floor(x / 14), Math.floor(z / 14), 3);
    const t = v2;
    c0 += ((PAVE1[0] + (PAVE2[0] - PAVE1[0]) * t) * tile - c0) * pave;
    c1 += ((PAVE1[1] + (PAVE2[1] - PAVE1[1]) * t) * tile - c1) * pave;
    c2 += ((PAVE1[2] + (PAVE2[2] - PAVE1[2]) * t) * tile - c2) * pave;
  }
  col[0] = c0; col[1] = c1; col[2] = c2;

  const g = ga * (1 - rockAmt) * (1 - sand) * (1 - snow) * (1 - pave) * (h > 0.5 ? 1 : 0);
  glow[0] = lr * g; glow[1] = lg * g; glow[2] = lb * g;
}

/**
 * 청크 메시 데이터. 정점은 청크 원점(x0, z0) 기준 로컬 좌표.
 * 가장자리에는 LOD 간 틈을 가리는 치마(skirt)를 붙인다.
 */
export function buildChunk(x0, z0, size, res, detail) {
  const n = res + 1;
  const step = size / res;
  const S = n + 2; // 법선용 테두리 포함
  const H = new Float32Array(S * S);
  const W = new Float32Array(n * n * RC);
  const w = new Float32Array(RC);
  let minH = 1e9, maxH = -1e9;
  for (let j = 0; j < S; j++) {
    for (let i = 0; i < S; i++) {
      const x = x0 + (i - 1) * step, z = z0 + (j - 1) * step;
      const inner = i >= 1 && j >= 1 && i <= n && j <= n;
      const h = heightAt(x, z, detail, w);
      H[j * S + i] = h;
      if (inner) {
        W.set(w, ((j - 1) * n + (i - 1)) * RC);
        if (h < minH) minH = h;
        if (h > maxH) maxH = h;
      }
    }
  }
  const vCount = n * n + 4 * n;
  const pos = new Float32Array(vCount * 3);
  const nor = new Float32Array(vCount * 3);
  const col = new Float32Array(vCount * 3);
  const glw = new Float32Array(vCount * 3);
  const c3 = [0, 0, 0], g3 = [0, 0, 0];
  let v = 0;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const hi = (j + 1) * S + (i + 1);
      const h = H[hi];
      const nx = H[hi - 1] - H[hi + 1];
      const nz = H[hi - S] - H[hi + S];
      const ny = 2 * step;
      const l = Math.hypot(nx, ny, nz);
      pos[v * 3] = i * step; pos[v * 3 + 1] = h; pos[v * 3 + 2] = j * step;
      nor[v * 3] = nx / l; nor[v * 3 + 1] = ny / l; nor[v * 3 + 2] = nz / l;
      surfaceColor(x0 + i * step, z0 + j * step, h, ny / l, W.subarray((j * n + i) * RC, (j * n + i + 1) * RC), c3, g3);
      col[v * 3] = c3[0]; col[v * 3 + 1] = c3[1]; col[v * 3 + 2] = c3[2];
      glw[v * 3] = g3[0]; glw[v * 3 + 1] = g3[1]; glw[v * 3 + 2] = g3[2];
      v++;
    }
  }
  // 치마: 네 변의 정점을 복제해 아래로 내린다
  const drop = 4 + size * 0.03;
  const edge = (i, j) => {
    const src = j * n + i;
    pos[v * 3] = pos[src * 3]; pos[v * 3 + 1] = pos[src * 3 + 1] - drop; pos[v * 3 + 2] = pos[src * 3 + 2];
    for (let k = 0; k < 3; k++) { nor[v * 3 + k] = nor[src * 3 + k]; col[v * 3 + k] = col[src * 3 + k]; glw[v * 3 + k] = glw[src * 3 + k]; }
    v++;
  };
  for (let i = 0; i < n; i++) edge(i, 0);
  for (let i = 0; i < n; i++) edge(i, n - 1);
  for (let j = 0; j < n; j++) edge(0, j);
  for (let j = 0; j < n; j++) edge(n - 1, j);
  return { pos, nor, col, glw, minH, maxH };
}

/** 같은 해상도의 모든 청크가 공유하는 인덱스 */
export function buildChunkIndex(res) {
  const n = res + 1;
  const idx = [];
  for (let j = 0; j < res; j++) {
    for (let i = 0; i < res; i++) {
      const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
      if ((i + j) & 1) idx.push(a, c, b, b, c, d);
      else idx.push(a, c, d, a, d, b);
    }
  }
  const base = n * n;
  const top = base, bot = base + n, left = base + 2 * n, right = base + 3 * n;
  // 치마 삼각형은 바깥을 향하도록 감는다
  const tri = (a, b, c) => idx.push(a, c, b);
  for (let i = 0; i < res; i++) {
    tri(i, top + i, i + 1); tri(i + 1, top + i, top + i + 1); // 북쪽 변 (j=0)
    const s = (n - 1) * n;
    tri(s + i, s + i + 1, bot + i); tri(s + i + 1, bot + i + 1, bot + i); // 남쪽 변
    tri(i * n, (i + 1) * n, left + i); tri((i + 1) * n, left + i + 1, left + i); // 서쪽 변
    const e0 = i * n + n - 1, e1 = (i + 1) * n + n - 1;
    tri(e0, right + i, e1); tri(e1, right + i, right + i + 1); // 동쪽 변
  }
  return n * n + 4 * n > 65535 ? new Uint32Array(idx) : new Uint16Array(idx);
}
