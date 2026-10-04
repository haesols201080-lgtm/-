// 건물의 바깥 부피 → 실내가 쓸 수 있는 자리 (v0.9)
//  · 바깥 모양의 겹 충돌체(city-arch SPEC.cols — 실제 모델의 단면을 따른 원통·상자)를 그대로 읽는다.
//    높이마다 그 높이를 지나는 부피들의 합집합이 그 층의 바깥벽이다(둥근·각진·꺾인·가지 친·위로 좁아지는 모양 모두).
//  · 실내는 바깥벽 안쪽 WALL 만큼 들어온 곳까지만 — 실내가 바깥보다 클 수 없다(층의 바닥부터 천장까지 모든 높이에서 확인).
//  · 격자 틀: 건물 가운데가 원점, +z 가 정문 쪽(문 바깥 방향). 칸 = CELL m.
//  · 바깥 외벽의 층 띠(창 격자)도 모델에서 읽는다: 높이마다 외벽 종류 → 층 높이 모듈(셰이더 materials.js 와 같은 값).
import { SPEC } from '../world/city-arch.js';

export const CELL = 1; // 실내 격자 한 칸 (m)
export const WALL = 0.32; // 바깥벽 두께 (외벽 면에서 안쪽 면까지)
/** 외벽 종류 → 층 높이(m) — materials.js facade 셰이더의 flH 와 같다 (0 = 창 없는 면) */
export const FLH = [0, 3.6, 3.9, 3.9, 3.3, 3.2, 3.3, 4.2];
/** 외벽 종류 → 창 칸 너비(m) — 셰이더의 bay */
export const BAY = [0, 1.6, 2.2, 2.6, 1.4, 3.0, 3.2, 1.4];

const _prof = new Map();
/**
 * 모양(kind)의 외벽 띠: 높이 비율 20칸마다 가장 넓은 외벽 종류 (세로 면만, 넓이로 잰다).
 * geo: city.arch[kind].hi (단위 모양, y 0..1). 고정 크기 랜드마크는 쓰지 않는다.
 */
export function facadeProfile(kind, geo) {
  if (_prof.has(kind)) return _prof.get(kind);
  const out = new Array(20).fill(0);
  if (geo && geo.attributes && geo.attributes.fac) {
    const P = geo.attributes.position.array, F = geo.attributes.fac.array;
    const idx = geo.index ? geo.index.array : null;
    const nT = idx ? idx.length / 3 : P.length / 9;
    const acc = Array.from({ length: 20 }, () => new Float64Array(8));
    for (let t = 0; t < nT; t++) {
      const a = idx ? idx[t * 3] : t * 3, b = idx ? idx[t * 3 + 1] : t * 3 + 1, c = idx ? idx[t * 3 + 2] : t * 3 + 2;
      const ax = P[a * 3], ay = P[a * 3 + 1], az = P[a * 3 + 2];
      const ux = P[b * 3] - ax, uy = P[b * 3 + 1] - ay, uz = P[b * 3 + 2] - az;
      const vx = P[c * 3] - ax, vy = P[c * 3 + 1] - ay, vz = P[c * 3 + 2] - az;
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const ar = Math.hypot(nx, ny, nz);
      if (ar < 1e-9 || Math.abs(ny) / ar > 0.35) continue; // 세로 면만
      const ty = Math.round(F[a * 2 + 1]);
      if (ty < 1 || ty > 7) continue;
      const y = (ay + P[b * 3 + 1] + P[c * 3 + 1]) / 3;
      const k = Math.min(19, Math.max(0, Math.floor(y * 20)));
      acc[k][ty] += ar;
    }
    for (let k = 0; k < 20; k++) {
      let best = 0, bv = 0;
      for (let ty = 1; ty < 8; ty++) if (acc[k][ty] > bv) { bv = acc[k][ty]; best = ty; }
      out[k] = best;
    }
    // 빈 띠(지붕·장식만)는 아래·위 띠의 종류를 이어 쓴다
    for (let k = 1; k < 20; k++) if (!out[k]) out[k] = out[k - 1];
    for (let k = 18; k >= 0; k--) if (!out[k]) out[k] = out[k + 1];
  }
  _prof.set(kind, out);
  return out;
}

/**
 * 건물 기록 → 부피. 격자 틀(문 쪽 = +z)로 옮긴 원통·상자 목록.
 * 반환: { cols, base, top, floorY, R(격자 반경 m), theta(틀의 세계 회전), ex, ez(틀 축의 세계 방향) }
 */
export function volumeOf(r) {
  const S = SPEC[r.kind];
  const dn = r.door ? [r.door.nx, r.door.nz] : [0, 1];
  const theta = Math.atan2(dn[0], dn[1]);
  const ex = [dn[1], -dn[0]], ez = [dn[0], dn[1]];
  const c = Math.cos(r.rot || 0), s = Math.sin(r.rot || 0);
  const toGrid = (dx, dz) => [dx * ex[0] + dz * ex[1], dx * ez[0] + dz * ez[1]];
  const cols = [];
  const list = S && S.cols && S.cols.length ? S.cols : [['c', 0, 0, 0.92, 0, 1, 0.45]];
  const fixed = S && S.fixed;
  const sx = fixed ? 1 : r.sx, sy = fixed ? 1 : r.sy, sz = fixed ? 1 : r.sz;
  let top = r.base, R = 0;
  for (const p of list) {
    const px = p[1] * sx, pz = p[2] * sz;
    const [gx, gz] = toGrid(px * c + pz * s, -px * s + pz * c);
    if (p[0] === 'c') {
      const rr = p[3] * Math.min(sx, sz);
      const col = { t: 'c', x: gx, z: gz, r: rr, y0: r.base + p[4] * sy, y1: r.base + p[5] * sy, dome: p[6] ? p[6] * sy : 0 };
      cols.push(col);
      R = Math.max(R, Math.hypot(gx, gz) + rr);
      top = Math.max(top, col.y1);
    } else {
      const hx = p[3] * sx, hz = p[4] * sz;
      const rot = (r.rot || 0) + (p[7] || 0) - theta;
      const col = { t: 'b', x: gx, z: gz, hx, hz, rot, cs: Math.cos(rot), sn: Math.sin(rot), y0: r.base + p[5] * sy, y1: r.base + p[6] * sy };
      cols.push(col);
      R = Math.max(R, Math.hypot(gx, gz) + Math.hypot(hx, hz));
      top = Math.max(top, col.y1);
    }
  }
  return { cols, base: r.base, top, floorY: r.floorY ?? r.gy, R: Math.ceil(R + 1), theta, ex, ez, sy };
}

/** 한 부피의 (x, z, y) 부호 거리 (안 < 0). 그 높이를 지나지 않으면 큰 값 */
function colSdf(C, x, z, y) {
  if (y < C.y0 || y > C.y1) return 1e3;
  if (C.t === 'c') {
    let rr = C.r;
    if (C.dome > 0) {
      const y2 = C.y1 - C.dome;
      // 둥근 윗면: 충돌체의 윗면(가장자리가 가운데보다 dome 만큼 낮은 포물면)을 따른다
      if (y > y2) rr = C.r * Math.sqrt(Math.max(0, (C.y1 - y) / C.dome));
    }
    return Math.hypot(x - C.x, z - C.z) - rr;
  }
  const dx = x - C.x, dz = z - C.z;
  const lx = dx * C.cs - dz * C.sn, lz = dx * C.sn + dz * C.cs;
  const qx = Math.abs(lx) - C.hx, qz = Math.abs(lz) - C.hz;
  const out = Math.hypot(Math.max(qx, 0), Math.max(qz, 0));
  return out > 0 ? out : Math.max(qx, qz);
}

/** 높이 y 에서 바깥벽 면까지의 부호 거리 (합집합 = 최소) */
export function sdfAt(V, x, z, y) {
  let d = 1e3;
  for (const C of V.cols) { const v = colSdf(C, x, z, y); if (v < d) d = v; }
  return d;
}

/** 층 하나(바닥 y0 ~ 천장 y1)가 들어갈 수 있는 거리: 그 사이 모든 높이에서 안쪽이어야 한다 (가장 나쁜 값) */
export function sdfSpan(V, x, z, y0, y1) {
  let d = -1e3;
  const n = Math.max(2, Math.ceil((y1 - y0) / 1.2));
  for (let k = 0; k <= n; k++) {
    const y = y0 + 0.05 + ((y1 - y0 - 0.1) * k) / n;
    const v = sdfAt(V, x, z, y);
    if (v > d) d = v;
  }
  // 부피의 아래·위 경계가 층 사이에 걸리면 그 바로 위아래도 (얇은 띠를 놓치지 않게)
  for (const C of V.cols) {
    for (const yb of [C.y0 + 0.02, C.y1 - 0.02]) if (yb > y0 && yb < y1) { const v = sdfAt(V, x, z, yb); if (v > d) d = v; }
  }
  return d;
}

/** 격자 크기: 부피 반경으로 (칸 수, 원점 칸) */
export function gridOf(V) {
  const n = Math.max(6, Math.ceil((2 * V.R) / CELL) + 2);
  return { gw: n, gh: n, ox: -n * CELL * 0.5, oz: -n * CELL * 0.5 };
}

/** 칸 (i, j) 가운데의 틀 좌표 */
export const cellX = (G, i) => G.ox + (i + 0.5) * CELL;
export const cellZ = (G, j) => G.oz + (j + 0.5) * CELL;

/**
 * 층의 칸 덮개: 바닥 y0 ~ 천장 y1 사이에서 바깥벽 안쪽(WALL + 여유)인 칸 = 1.
 * 둘레 칸의 가운데가 벽에 너무 붙으면 빼서, 가구·사람이 벽 속에 들어가지 않게.
 */
export function maskOf(V, G, y0, y1, margin = 0.2) {
  const m = new Uint8Array(G.gw * G.gh);
  let n = 0;
  for (let j = 0; j < G.gh; j++) for (let i = 0; i < G.gw; i++) {
    const d = sdfSpan(V, cellX(G, i), cellZ(G, j), y0, y1);
    if (d < -(WALL + margin)) { m[j * G.gw + i] = 1; n++; }
  }
  return { m, n };
}

/** 틀 좌표 → 세계 (x, z) */
export function toWorld(r, V, gx, gz) {
  return [r.x + gx * V.ex[0] + gz * V.ez[0], r.z + gx * V.ex[1] + gz * V.ez[1]];
}
/** 세계 (x, z) → 틀 좌표 */
export function toGrid(r, V, x, z) {
  const dx = x - r.x, dz = z - r.z;
  return [dx * V.ex[0] + dz * V.ex[1], dx * V.ez[0] + dz * V.ez[1]];
}
/** 틀의 방향(틀 yaw) → 세계 yaw */
export const yawToWorld = (V, a) => a + V.theta;
