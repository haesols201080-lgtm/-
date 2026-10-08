// 층 하나 그리기 (v0.9): 평면 자료 → 모양 + 충돌체. 바깥벽은 부피의 실제 곡선(행진 사각형)을 따르고, 창은 바깥 외벽의
// 층 띠·창 칸 너비와 같은 자리에. 칸막이·문틀·미닫이·계단(되돌이·나선)·승강기·난간·간판·천장 빛.
//  · 그리는 틀 = 건물 격자 틀(문 쪽 +z). 무리(group)를 건물 자리·실내 높이에 두고 θ 만큼 돌린다. 충돌체는 세계 좌표로 바꿔 넣는다.
import * as THREE from 'three';
import { GB } from './geom.js';
import { PAT, interiorMaterial, windowMaterial } from './material.js';
import { drawFixture } from './props.js';
import { FIX, ROOMS, flowRoom, PART_T } from './catalog.js';
import { sdfSpan, sdfAt, WALL } from './volume.js';
import { SLAB } from './program.js';
import { glowMaterial } from '../world/materials.js';

const FL_PAT = { plain: PAT.plain, tile: PAT.tile, strip: PAT.strip, stone: PAT.stone, carpet: PAT.carpet, grid: PAT.grid, epoxy: PAT.epoxy, wood: PAT.wood, court: PAT.court, moss: PAT.moss };
const CL_PAT = { coffer: PAT.coffer, strip: PAT.lightstrip, truss: PAT.truss, grow: PAT.grow, grid: PAT.cgrid, plain: PAT.cplain };
const SPAND = [0.12, 0.18, 0.46, 0.38, 0.12, 0.12, 0.12, 0.2];
const _c = new THREE.Color();

/** 방의 빛깔 역할 → 색 */
function toneColor(st, tone, k = 1) {
  const base = { base: st.wall, brand: st.brand2 ?? st.wall, warm: st.warm, cool: st.cool, soft: st.soft, leaf: st.leaf }[tone] ?? st.wall;
  _c.set(base);
  if (k !== 1) _c.multiplyScalar(k);
  return _c.getHex();
}
function mix(a, b, t) { const A = new THREE.Color(a), Bc = new THREE.Color(b); return A.lerp(Bc, t).getHex(); }

/**
 * ctx: { B, F, L, fix, r, V, y0(그릴 바닥 높이 = 실내 높이), next(위층 F 또는 null), mats(공용 재질 캐시) }
 * 반환: { group, cols:[충돌체 사양 (세계)], slots: Map(fixId → [{x,y,z,w,d,n,…} 틀 좌표]), anims:[f(t)], doors:[미닫이], lifts:[…], stairs:[…], signs }
 */
export function buildFloor(ctx) {
  const { B, F, L, fix, r, V } = ctx;
  const { gw, gh, ox, oz } = B.G;
  const Z = B.zones[F.zone] || {};
  const st = Z.style || {};
  const isMezz = !!F.mezz;
  const below = !!F.below;
  const ceilAll = F.ceil - F.y; // 이 층 천장 (로컬)
  const gb = new GB(), glass = new GB(), win = new GB(), cgb = new GB(); // cgb: 천장 (따로 — 지도·점검 때 감출 수 있게)
  const winUV = [];
  const cols = [];
  const out = { cols, slots: new Map(), anims: [], doors: [], lifts: [], stairs: [], signs: [], walls: new Set() };
  ctx.extraCols = cols;
  const N = gw * gh;
  const room = L.room, rooms = L.rooms;
  const RT = (c) => (room[c] ? rooms[room[c] - 1] : null);
  // ── 꼭짓점 거리 (안쪽 벽면 = 0, 안 < 0) ──
  const sd = new Float32Array((gw + 1) * (gh + 1));
  const span1 = F.vault ? F.y + 2.7 : F.ceil;
  // 지하층: 바깥 부피는 땅 위에만 있으니 그 층의 바닥 덮개(1층 발자국을 줄인 것)로 — 꼭짓점 둘레 네 칸 중 덮개 칸 수로 거리를 만들어
  // 벽면이 덮개 가장자리(칸 경계 바로 밖)에 서게 한다 (전에는 지하 높이에서 부피가 늘 「바깥」이라 바닥판·바닥 충돌체·바깥벽이 모두 빠졌다)
  const inMask = (i, j) => i >= 0 && j >= 0 && i < gw && j < gh && !!F.mask[j * gw + i];
  for (let j = 0; j <= gh; j++) for (let i = 0; i <= gw; i++) {
    sd[j * (gw + 1) + i] = isMezz ? 1 : below ? 0.49 - (inMask(i - 1, j - 1) + inMask(i, j - 1) + inMask(i - 1, j) + inMask(i, j)) / 4 : sdfSpan(V, ox + i, oz + j, F.y, span1) + WALL;
  }
  const S = (i, j) => sd[j * (gw + 1) + i];
  /** 칸 안의 한 점에서 거리 (네 꼭짓점 보간) */
  const sdAt = (x, z) => {
    const fx = x - ox, fz = z - oz, i = Math.max(0, Math.min(gw - 1, Math.floor(fx))), j = Math.max(0, Math.min(gh - 1, Math.floor(fz)));
    const u = fx - i, v = fz - j;
    return S(i, j) * (1 - u) * (1 - v) + S(i + 1, j) * u * (1 - v) + S(i, j + 1) * (1 - u) * v + S(i + 1, j + 1) * u * v;
  };
  // ── 둥근 천장 높이 (꼭짓점마다): 그 자리에서 바깥 부피 안쪽으로 머리 위 가장 높은 곳 ──
  let vaultH = null;
  if (F.vault && !isMezz) {
    vaultH = new Float32Array((gw + 1) * (gh + 1));
    for (let j = 0; j <= gh; j++) for (let i = 0; i <= gw; i++) {
      const x = ox + i, z = oz + j;
      let lo = F.y + 2.2, hi = F.ceil;
      if (sdfAt(V, x, z, hi) < -WALL) { vaultH[j * (gw + 1) + i] = hi - F.y; continue; }
      for (let k = 0; k < 14; k++) { const m = (lo + hi) / 2; if (sdfAt(V, x, z, m) < -WALL) lo = m; else hi = m; }
      vaultH[j * (gw + 1) + i] = Math.max(2.2, lo - F.y - 0.1);
    }
  }
  const ceilAt = (x, z) => {
    if (!vaultH) return ceilAll;
    const fx = Math.max(0, Math.min(gw, x - ox)), fz = Math.max(0, Math.min(gh, z - oz));
    const i = Math.min(gw - 1, Math.floor(fx)), j = Math.min(gh - 1, Math.floor(fz)), u = fx - i, v = fz - j;
    const H = (a, b) => vaultH[b * (gw + 1) + a];
    return H(i, j) * (1 - u) * (1 - v) + H(i + 1, j) * u * (1 - v) + H(i, j + 1) * (1 - u) * v + H(i + 1, j + 1) * u * v;
  };
  // 카메라가 쓰는 자리 검사 (interiors.clampCamera): 안쪽 벽면까지의 거리(안 < 0)와 그 자리의 천장 높이 — 그리는 것과 같은 자료
  out.sdAt = isMezz ? null : sdAt;
  out.ceilAt = ceilAt;
  // ── 칸마다 방(덮개 밖의 벽 앞 자투리도 가까운 방으로) ──
  const roomX = new Int16Array(N);
  for (let c = 0; c < N; c++) roomX[c] = room[c];
  if (!isMezz) for (let pass = 0; pass < 2; pass++) for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    const c = j * gw + i;
    if (roomX[c] || L.void[c]) continue;
    if (Math.min(S(i, j), S(i + 1, j), S(i, j + 1), S(i + 1, j + 1)) >= 0) continue;
    // 벽 안쪽(벽면에서 가장 먼) 이웃의 방으로 — 처음 찾은 이웃으로 하면 벽을 따라 옆방이 배정되어 바깥벽 바로 안쪽에 엉뚱한 칸막이가 섰다
    let best = 0, bs = Infinity;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a = i + di, b = j + dj;
      if (a < 0 || b < 0 || a >= gw || b >= gh || !roomX[b * gw + a] || ['stair', 'lift', 'cargo', 'shaft'].includes(rooms[roomX[b * gw + a] - 1].type)) continue;
      const sv = S(a, b) + S(a + 1, b) + S(a, b + 1) + S(a + 1, b + 1);
      if (sv < bs) { bs = sv; best = roomX[b * gw + a]; }
    }
    if (best) roomX[c] = best;
  }
  const RX = (c) => (roomX[c] ? rooms[roomX[c] - 1] : null);
  // 계단 칸 (층판을 계단참만 덮는다)
  const stairCells = new Map(); // c → 'land' | 'well'
  // ── 1. 수직 심: 계단·승강기·관 ──
  const core = B.core;
  if (core && !isMezz) {
    for (const p of core.parts) {
      const R = rooms.find((q) => q.part === core.parts.indexOf(p));
      if (!R) continue;
      const lk = B.links.find((k) => k.part === core.parts.indexOf(p) && k.kind !== 'roof');
      if (p.kind === 'stair' || p.kind === 'spiral') buildStair(ctx, out, gb, glass, p, lk, stairCells, st);
      else if (p.kind === 'lift' || p.kind === 'cargo') buildLift(ctx, out, gb, p, lk, R, st);
      else { // 설비 관: 막힌 기둥
        const bb = cellBox(B, p.cells);
        gb.box((bb.x0 + bb.x1) / 2, 0, (bb.z0 + bb.z1) / 2, bb.x1 - bb.x0, ceilAll, bb.z1 - bb.z0, 0, 0x8a8e98, 0, PAT.rib);
        cols.push(colBox(ctx, (bb.x0 + bb.x1) / 2, (bb.z0 + bb.z1) / 2, (bb.x1 - bb.x0) / 2, (bb.z1 - bb.z0) / 2, 0, -0.5, ceilAll, false));
      }
    }
  }
  // ── 1b. 중2층 계단 (홀 바닥 → 중2층 앞 가장자리): 디딤판·챌판·옆 유리 난간·경사 충돌체 ──
  if (L.mstair && !isMezz) buildMezzStair(ctx, out, gb, glass, L.mstair, st);
  // ── 2. 바닥 · 천장 ──
  const flCol = (R) => {
    const fl = R ? (ROOMS[R.type] || {}).fl || 'tile' : 'tile';
    const base = R && R.circ ? mix(st.floor, st.wall, 0.35) : st.floor;
    return { col: R && (R.type === 'gardenhall' || R.type === 'growhall') ? mix(base, st.leaf, 0.4) : base, pat: FL_PAT[fl] ?? PAT.tile, prm: (st.floorPat || 0) * 0.25 };
  };
  const clCol = (R) => { const cl = R ? (ROOMS[R.type] || {}).cl || 'plain' : 'plain'; return { col: mix(st.wall, 0xffffff, 0.3), pat: CL_PAT[cl] ?? PAT.cplain, prm: (st.ceilPat || 0) * 0.3 }; };
  const slabRects = []; // 충돌체용 바닥판 (칸 줄)
  const ceilRects = []; // 충돌체용 천장 (그린 천장과 같은 칸 줄)
  for (let j = 0; j < gh; j++) {
    let run = null, crun = null;
    const flush = () => { if (run) { slabRects.push(run); run = null; } };
    const cflush = () => { if (crun) { ceilRects.push(crun); crun = null; } };
    for (let i = 0; i < gw; i++) {
      const c = j * gw + i;
      const R = RX(c);
      const v = [S(i, j), S(i + 1, j), S(i + 1, j + 1), S(i, j + 1)];
      const anyIn = isMezz ? !!room[c] : Math.min(...v) < 0;
      const sc = stairCells.get(c);
      const skipFloor = !anyIn || L.void[c] || sc === 'well' || (R && (R.type === 'lift' || R.type === 'cargo' || R.type === 'shaft'));
      if (skipFloor) { flush(); }
      else {
        const full = isMezz || Math.max(...v) < 0;
        const { col, pat, prm } = flCol(R);
        if (full) gb.floorRect(ox + i, oz + j, ox + i + 1, oz + j + 1, 0, col, 0, pat, prm);
        else polyCell(gb, ox + i, oz + j, v, 0, col, pat, prm, false);
        if (run && run.i1 === i - 1) run.i1 = i; else { flush(); run = { j, i0: i, i1: i }; }
      }
      // 천장 (뚫린 곳·계단 우물 위는 다음 층 계단이 있으니 열어 둔다 — 맨 위층 계단은 덮는다)
      if (anyIn && !L.void[c] && !(R && ['lift', 'cargo', 'shaft'].includes(R.type))) {
        if (sc === 'well' && ctx.next) { cflush(); continue; }
        if (ctx.next && sc) cflush(); // 계단 칸 위는 위층 계단·계단참이 천장 노릇 (계단을 오를 머리 자리를 막지 않게)
        else if (crun && crun.i1 === i - 1) crun.i1 = i; else { cflush(); crun = { j, i0: i, i1: i }; }
        const { col, pat, prm } = clCol(R);
        if (vaultH) {
          const p00 = [ox + i, ceilAt(ox + i, oz + j), oz + j], p10 = [ox + i + 1, ceilAt(ox + i + 1, oz + j), oz + j], p11 = [ox + i + 1, ceilAt(ox + i + 1, oz + j + 1), oz + j + 1], p01 = [ox + i, ceilAt(ox + i, oz + j + 1), oz + j + 1];
          cgb.quad(p00, p10, p11, p01, col, 0, pat, prm);
        } else if (isMezz || Math.max(...v) < 0) cgb.ceilRect(ox + i, oz + j, ox + i + 1, oz + j + 1, ceilAll, col, 0, pat, prm);
        else polyCell(cgb, ox + i, oz + j, v, ceilAll, col, pat, prm, true);
      } else cflush();
    }
    flush();
    cflush();
  }
  // 바닥판 충돌체: 줄을 세로로 합쳐 사각형으로
  const merged = [];
  for (const rr of slabRects) {
    const m = merged.find((q) => q.i0 === rr.i0 && q.i1 === rr.i1 && q.j1 === rr.j - 1);
    if (m) m.j1 = rr.j; else merged.push({ i0: rr.i0, i1: rr.i1, j0: rr.j, j1: rr.j });
  }
  for (const m of merged) cols.push(colBox(ctx, ox + (m.i0 + m.i1 + 1) / 2, oz + (m.j0 + m.j1 + 1) / 2, (m.i1 - m.i0 + 1) / 2 + 0.02, (m.j1 - m.j0 + 1) / 2 + 0.02, 0, -SLAB, 0, true));
  // 천장 충돌체 (머리가 닿는 곳): 맨 위층은 바닥판 칸 그대로 (전과 같이)
  if (!ctx.next) for (const m of merged) cols.push(colBox(ctx, ox + (m.i0 + m.i1 + 1) / 2, oz + (m.j0 + m.j1 + 1) / 2, (m.i1 - m.i0 + 1) / 2, (m.j1 - m.j0 + 1) / 2, 0, ceilAll, ceilAll + 1, false));
  //   위층이 있으면: 그린 천장 칸마다 (계단 칸 빼고) — 위층 바닥판이 없는 칸(위층이 더 좁은 작은 건물·물러난 층)에서도
  //   뛰어올라 천장을 뚫고 위층 높이에 닿지 않게 (전에는 위층 바닥판만 천장이라, 층 높이가 낮은 건물에서 뛰면 위층으로 판정되어 위층 가구가 잡혔다)
  else if (!isMezz) {
    const cm = [];
    for (const rr of ceilRects) {
      const m = cm.find((q) => q.i0 === rr.i0 && q.i1 === rr.i1 && q.j1 === rr.j - 1);
      if (m) m.j1 = rr.j; else cm.push({ i0: rr.i0, i1: rr.i1, j0: rr.j, j1: rr.j });
    }
    // 위층이 있으면 그 바닥 아래까지만 (위층 바닥 위로 솟지 않게)
    const top = Math.max(ceilAll + 0.05, Math.min(ceilAll + 0.3, ctx.next.y - F.y - 0.02));
    for (const m of cm) cols.push(colBox(ctx, ox + (m.i0 + m.i1 + 1) / 2, oz + (m.j0 + m.j1 + 1) / 2, (m.i1 - m.i0 + 1) / 2, (m.j1 - m.j0 + 1) / 2, 0, ceilAll, top, false));
  }
  // ── 3. 바깥벽 (행진 사각형 윤곽) + 창 ──
  if (!isMezz) {
    const segs = [];
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
      const v = [S(i, j), S(i + 1, j), S(i + 1, j + 1), S(i, j + 1)];
      const mn = Math.min(...v), mx = Math.max(...v);
      if (mn >= 0 || mx < 0) continue;
      const P = [[ox + i, oz + j], [ox + i + 1, oz + j], [ox + i + 1, oz + j + 1], [ox + i, oz + j + 1]];
      const pts = [];
      for (let k = 0; k < 4; k++) {
        const a = v[k], b = v[(k + 1) % 4];
        if ((a < 0) !== (b < 0)) { const t = a / (a - b); pts.push([P[k][0] + (P[(k + 1) % 4][0] - P[k][0]) * t, P[k][1] + (P[(k + 1) % 4][1] - P[k][1]) * t]); }
      }
      if (pts.length === 2) segs.push([pts[0], pts[1], j * gw + i]);
      else if (pts.length === 4) { const cv = (v[0] + v[1] + v[2] + v[3]) / 4; if (cv < 0) { segs.push([pts[0], pts[3], j * gw + i]); segs.push([pts[1], pts[2], j * gw + i]); } else { segs.push([pts[0], pts[1], j * gw + i]); segs.push([pts[2], pts[3], j * gw + i]); } }
    }
    // 이 점(벽 바로 안쪽) 가까이(0.15 m)의 칸 경계를 따라 칸막이가 서는가 (partitions 와 같은 규칙: 다른 방끼리, 오가는 공간끼리·설비 관 둘레는 없음)
    const partitionMeets = (x, z) => {
      const fx = x - ox, fz = z - oz, i = Math.floor(fx), j = Math.floor(fz);
      const R = (a, b2) => (a >= 0 && b2 >= 0 && a < gw && b2 < gh ? RX(b2 * gw + a) : null);
      const wall = (A, Bq) => A && Bq && A !== Bq && A.type !== 'shaft' && Bq.type !== 'shaft' && !(flowRoom(A) && flowRoom(Bq));
      const li = Math.round(fx), lj = Math.round(fz);
      if (Math.abs(fx - li) < 0.15 && wall(R(li - 1, j), R(li, j))) return true;
      if (Math.abs(fz - lj) < 0.15 && wall(R(i, lj - 1), R(i, lj))) return true;
      return false;
    };
    // 창살 자리(벽면에서 0.1 m 안)가 가구와 겹치는가
    const fixAgainst = (x, z) => fix.some((q) => { const f = FIX[q.t]; if (!f) return false; const odd = q.rot % 2 === 1, W = (odd ? f.d : f.w) / 2 + 0.06, D = (odd ? f.w : f.d) / 2 + 0.06; return Math.abs(q.x - x) < W && Math.abs(q.z - z) < D; });
    const mod = F.mod || B.module || 3.6;
    const spand = SPAND[F.ftype || 1] ?? 0.15;
    const bay = B.bay || 2.2;
    let acc = 0;
    for (let [a, b, c] of segs) {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 1e-4) continue;
      // 안쪽 법선: 거리의 기울기 반대
      const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
      const gx = sdAt(mx + 0.05, mz) - sdAt(mx - 0.05, mz), gz = sdAt(mx, mz + 0.05) - sdAt(mx, mz - 0.05);
      const nl = Math.hypot(gx, gz) || 1;
      const nx = -gx / nl, nz = -gz / nl;
      // 벽 면은 늘 안쪽을 보게 (행진 사각형의 선분 방향은 칸마다 제각각 — 면의 앞쪽이 바깥이면 벽에 붙은 상자의 뒷면과 같은 쪽을 봐 겹친 면이 된다)
      if (-(b[1] - a[1]) * nx + (b[0] - a[0]) * nz < 0) [a, b] = [b, a];
      // 이 벽에 붙은 방 (창이 필요한 방인가)
      const ci = Math.floor(mx + nx * 0.6 - ox), cj = Math.floor(mz + nz * 0.6 - oz);
      const R = ci >= 0 && cj >= 0 && ci < gw && cj < gh ? RX(cj * gw + ci) : null;
      const wantWin = !below && R && (ROOMS[R.type] || {}).win && !tallBehind(fix, mx, mz, nx, nz);
      const h0 = ceilAt(a[0], a[1]), h1 = ceilAt(b[0], b[1]);
      const wallC = mix(st.wall, 0xffffff, 0.08);
      const wp = PAT.panel + 0, wprm = (st.wallPat || 0) * 0.2;
      if (!wantWin) {
        gb.quad([a[0], 0, a[1]], [b[0], 0, b[1]], [b[0], h1, b[1]], [a[0], h0, a[1]], wallC, 0, wp, wprm);
      } else {
        // 창 띠: 모듈마다 (아래 턱 · 유리 · 위 띠) — 두 모듈 층이면 두 줄
        let y = 0;
        const rows = Math.max(1, Math.round(Math.min(h0, h1) / mod));
        for (let k = 0; k < rows; k++) {
          // 발코니: 바닥부터 천장까지 유리 + 바깥 외벽의 난간 높이에 빛 난간
          const full = R.type === 'balcony';
          const yb = k * mod, sill = yb + (full ? 0.04 : Math.max(0.12, spand * mod)), head = Math.min(Math.min(h0, h1) - 0.15, yb + mod * 0.96);
          if (full && k === 0) { gb.box((a[0] + b[0]) / 2 + nx * 0.06, 1.0, (a[1] + b[1]) / 2 + nz * 0.06, len, 0.05, 0.06, Math.atan2(b[0] - a[0], b[1] - a[1]) + Math.PI / 2, st.glow ?? 0x7ff3e6, 1.2); }
          if (head <= sill + 0.3) continue;
          if (sill > y) gb.quad([a[0], y, a[1]], [b[0], y, b[1]], [b[0], sill, b[1]], [a[0], sill, a[1]], wallC, 0, wp, wprm);
          win.quad([a[0], sill, a[1]], [b[0], sill, b[1]], [b[0], head, b[1]], [a[0], head, a[1]], 0xffffff);
          for (let q = 0; q < 6; q++) winUV.push(0, 0);
          gb.quad([a[0] + nx * 0.02, sill - 0.03, a[1] + nz * 0.02], [b[0] + nx * 0.02, sill - 0.03, b[1] + nz * 0.02], [b[0] + nx * 0.02, sill, b[1] + nz * 0.02], [a[0] + nx * 0.02, sill, a[1] + nz * 0.02], st.tint ?? 0xe9c27c, 0.4);
          y = head;
        }
        gb.quad([a[0], y, a[1]], [b[0], y, b[1]], [b[0], h1, b[1]], [a[0], h0, a[1]], wallC, 0, wp, wprm);
        // 멀리언: 외벽의 창 칸 너비마다
        const s0 = acc, s1 = acc + len;
        for (let s = Math.ceil(s0 / bay) * bay; s < s1; s += bay) {
          const t = (s - s0) / len, px = a[0] + (b[0] - a[0]) * t, pz = a[1] + (b[1] - a[1]) * t;
          if (partitionMeets(px + nx * 0.3, pz + nz * 0.3)) continue; // 칸막이가 바깥벽에 닿는 자리에는 창살을 세우지 않는다 (칸막이 끝면과 겹친다)
          if (fixAgainst(px + nx * 0.05, pz + nz * 0.05)) continue; // 벽에 붙은 가구 뒤도 (창살이 가구 속을 지나간다 — 어차피 가려진다)
          gb.box(px + nx * 0.05, 0, pz + nz * 0.05, 0.08, Math.min(h0, h1), 0.1, Math.atan2(b[0] - a[0], b[1] - a[1]) + Math.PI / 2, 0xc8ccd4, 0, PAT.metal);
        }
      }
      acc += len;
      // 충돌체: 벽면에서 바깥으로 0.25 m 두께
      cols.push(colBox(ctx, mx - nx * 0.22, mz - nz * 0.22, len / 2 + 0.12, 0.22, -Math.atan2(b[1] - a[1], b[0] - a[0]), -1, Math.max(h0, h1) + 0.5, false));
      void c;
    }
  }
  // ── 3b. 바깥벽의 문 (테라스·공중다리): 벽 안쪽 면에 문틀 · 미닫이 · 빛 띠 · 이름판 ──
  if (!isMezz) for (const d of L.doors) {
    if (d.b >= 0 || (d.kind !== 'terrace' && d.kind !== 'bridge')) continue;
    const i = d.c % gw, j = (d.c / gw) | 0, [di, dj] = d.dir;
    const cx0 = ox + i + 0.5, cz0 = oz + j + 0.5;
    let t = 0.3;
    for (; t < 3; t += 0.05) if (sdAt(cx0 + di * t, cz0 + dj * t) >= 0) break;
    const x = cx0 + di * (t - 0.08), z = cz0 + dj * (t - 0.08);
    const dv = di !== 0; // 벽이 z 축을 따라 선다
    const dl = d.kind === 'bridge' ? 2.0 : 1.3;
    const head = Math.min(2.5, ceilAt(x, z) - 0.25);
    const frameC = mix(st.wall, st.brand ?? 0x2f8f83, 0.45);
    for (const sg of [-1, 1]) {
      const px = dv ? x : x + sg * (dl / 2 + 0.07), pz = dv ? z + sg * (dl / 2 + 0.07) : z;
      gb.box(px, 0, pz, dv ? 0.16 : 0.14, head, dv ? 0.14 : 0.16, 0, frameC, 0, PAT.metal);
    }
    gb.box(x, head, z, dv ? 0.16 : dl + 0.28, 0.14, dv ? dl + 0.28 : 0.16, 0, frameC, 0, PAT.metal);
    gb.box(x - di * 0.05, head - 0.05, z - dj * 0.05, dv ? 0.04 : dl, 0.04, dv ? dl : 0.04, 0, st.glow ?? 0x7ff3e6, 1.8);
    gb.box(x - di * 0.02, 0.005, z - dj * 0.02, dv ? 0.6 : dl, 0.012, dv ? dl : 0.6, 0, d.kind === 'bridge' ? 0x9ff6ff : st.glow ?? 0x7ff3e6, 0.9); // 문턱 빛판
    const panel = new GB();
    panel.box(0, 0.02, 0, dv ? 0.05 : dl - 0.1, head - 0.06, dv ? dl - 0.1 : 0.05, 0, mix(0xcff4ff, st.wall, 0.25), 0.15, PAT.panel);
    panel.box(0, 1.0, 0, dv ? 0.07 : 0.06, 0.25, dv ? 0.06 : 0.07, 0, st.glow ?? 0x7ff3e6, 1.5);
    out.doors.push({ geo: panel, x: x - di * 0.1, z: z - dj * 0.1, slide: dv ? [0, 1] : [1, 0], w: dl - 0.1, door: d, glassy: true });
    out.signs.push({ text: d.kind === 'bridge' ? '공중다리' : '테라스', sub: d.kind === 'bridge' ? '건너편 탑으로' : '바깥 단', x: x - di * 0.14, z: z - dj * 0.14, y: head + 0.34, ry: dv ? (-di > 0 ? Math.PI / 2 : -Math.PI / 2) : (-dj > 0 ? 0 : Math.PI), staff: false, room: d.a });
  }
  // ── 4. 칸막이 · 문 · 난간 ──
  partitions(ctx, out, gb, glass, roomX, sdAt, ceilAt, st);
  // ── 5. 가구·장비 ──
  for (const q of fix) {
    const slots = drawFixture(gb, q, st);
    if (slots.length) {
      // 로컬 → 틀 좌표
      const a = (q.rot || 0) * Math.PI / 2, cs = Math.cos(a), sn = Math.sin(a);
      out.slots.set(q.id, slots.map((s) => ({ ...s, gx: q.x + s.x * cs + s.z * sn, gz: q.z - s.x * sn + s.z * cs, rot: q.rot, fix: q })));
    }
    const f = FIX[q.t];
    if (!f || f.solid === false) continue;
    const odd = q.rot % 2 === 1, W = odd ? q.d : q.w, D = odd ? q.w : q.d;
    if (f.round) cols.push(colCyl(ctx, q.x, q.z, Math.min(W, D) / 2, f.walk ? f.h : Math.max(f.h, 0.4)));
    else cols.push(colBox(ctx, q.x, q.z, W / 2, D / 2, 0, -0.2, f.h, !!f.walk || f.h < 0.95));
  }
  // ── 6. 묶기 ──
  const group = new THREE.Group();
  const mats = ctx.mats;
  const g1 = gb.build();
  const m1 = new THREE.Mesh(g1, mats.solid);
  m1.frustumCulled = false;
  group.add(m1);
  if (cgb.count) { const mc = new THREE.Mesh(cgb.build(), mats.solid); mc.frustumCulled = false; group.add(mc); out.ceilMesh = mc; }
  if (glass.count) { const m2 = new THREE.Mesh(glass.build(), mats.glass); m2.frustumCulled = false; m2.renderOrder = 2; group.add(m2); }
  if (win.count) {
    const wg = win.build();
    const wm = new THREE.Mesh(wg, windowMaterial(Math.max(0, F.y - B.volume.floorY) + (r.floorY || 0) - (r.gy || 0)));
    wm.frustumCulled = false;
    group.add(wm);
    out.winMat = wm.material;
  }
  out.group = group;
  out.roomX = roomX;
  out.stairCells = stairCells;
  out.tris = (g1.attributes.position.count / 3) | 0;
  return out;
}

// ── 도구 ────────────────────────────────────────────────────
function cellBox(B, cells) {
  let i0 = 1e9, i1 = -1e9, j0 = 1e9, j1 = -1e9;
  for (const [i, j] of cells) { i0 = Math.min(i0, i); i1 = Math.max(i1, i); j0 = Math.min(j0, j); j1 = Math.max(j1, j); }
  return { x0: B.G.ox + i0, x1: B.G.ox + i1 + 1, z0: B.G.oz + j0, z1: B.G.oz + j1 + 1, i0, i1, j0, j1 };
}
/** 칸 하나의 안쪽 다각형 (경계 칸) */
function polyCell(gb, x, z, v, y, col, pat, prm, down) {
  const P = [[x, z], [x + 1, z], [x + 1, z + 1], [x, z + 1]];
  const pts = [];
  for (let k = 0; k < 4; k++) {
    const a = v[k], b = v[(k + 1) % 4];
    if (a < 0) pts.push(P[k]);
    if ((a < 0) !== (b < 0)) { const t = a / (a - b); pts.push([P[k][0] + (P[(k + 1) % 4][0] - P[k][0]) * t, P[k][1] + (P[(k + 1) % 4][1] - P[k][1]) * t]); }
  }
  for (let k = 1; k + 1 < pts.length; k++) {
    const A = [pts[0][0], y, pts[0][1]], B2 = [pts[k][0], y, pts[k][1]], C = [pts[k + 1][0], y, pts[k + 1][1]];
    if (down) gb.tri(A, B2, C, col, 0, pat, prm); else gb.tri(A, C, B2, col, 0, pat, prm);
  }
}
/** 바깥벽 앞에 키 큰 가구가 등을 대고 있나 (그 자리는 창 대신 벽) */
function tallBehind(fix, x, z, nx, nz) {
  for (const q of fix) {
    const f = FIX[q.t];
    if (!f || !f.wall || f.h < 1.3) continue;
    const dx = q.x - x, dz = q.z - z;
    if (Math.abs(dx * nx + dz * nz) < 1.2 && Math.abs(-dx * nz + dz * nx) < Math.max(q.w, q.d) / 2 + 0.2) return true;
  }
  return false;
}
/** 틀 좌표 상자 → 세계 충돌체 */
export function colBox(ctx, x, z, hx, hz, rot, y0, y1, walk) {
  const { r, V } = ctx;
  return { type: 'box', x: r.x + x * V.ex[0] + z * V.ez[0], z: r.z + x * V.ex[1] + z * V.ez[1], hx, hz, rot: rot + V.theta, y0: ctx.y0 + y0, y1: ctx.y0 + y1, walk, city: true, sky: true, stream: true };
}
export function colCyl(ctx, x, z, rr, h) {
  const { r, V } = ctx;
  return { type: 'cyl', x: r.x + x * V.ex[0] + z * V.ez[0], z: r.z + x * V.ex[1] + z * V.ez[1], r: rr, y0: ctx.y0 - 0.2, y1: ctx.y0 + h, walk: h < 0.95, city: true, sky: true, stream: true };
}
function colRamp(ctx, ax, az, bx, bz, ya, yb, hw) {
  const { r, V } = ctx;
  const A = [r.x + ax * V.ex[0] + az * V.ez[0], r.z + ax * V.ex[1] + az * V.ez[1]], Bw = [r.x + bx * V.ex[0] + bz * V.ez[0], r.z + bx * V.ex[1] + bz * V.ez[1]];
  const len = Math.hypot(Bw[0] - A[0], Bw[1] - A[1]);
  const rot = Math.atan2(-(Bw[1] - A[1]), Bw[0] - A[0]);
  return { type: 'ramp', x: (A[0] + Bw[0]) / 2, z: (A[1] + Bw[1]) / 2, hx: len / 2, hz: hw, rot, y0: ctx.y0 + Math.min(ya, yb) - 0.35, y1: ctx.y0 + ya, y1b: ctx.y0 + yb, walk: true, city: true, sky: true, stream: true };
}

// ── 계단 ────────────────────────────────────────────────────
/** 되돌이 계단(3×6) 또는 나선 계단: 이 층에서 위층(이음의 다음 층)까지. 바닥판은 계단참만 */
function buildStair(ctx, out, gb, glass, p, lk, stairCells, st) {
  const { B, F, L } = ctx;
  const bb = cellBox(B, p.cells);
  const cx = (bb.x0 + bb.x1) / 2, cz = (bb.z0 + bb.z1) / 2;
  const [fx, fz] = p.door.dir; // 정면 (틀 i,j 방향)
  const up = lk ? lk.floors.filter((i) => i > F.i).sort((a, b) => a - b)[0] : undefined;
  const Fu = up != null ? B.floors[up] : null;
  const h = Fu ? Fu.y - F.y : 0;
  const roofUp = !Fu && B.links.some((k) => k.kind === 'roof' && k.floors.includes(F.i) && k.part === B.core.parts.indexOf(p));
  const { gw } = B.G;
  const cellsOf = () => p.cells.map(([i, j]) => j * gw + i);
  const wall = mix(st.wall, 0x000000, 0.05), stepC = mix(st.floor, 0xffffff, 0.2), rail = st.glow ?? 0x7ff3e6;
  // 계단 로컬: Z = 정면, X = 옆
  const LX = [fz, -fx], LZ = [fx, fz];
  const along = Math.abs(fx) > 0 ? bb.x1 - bb.x0 : bb.z1 - bb.z0, across = Math.abs(fx) > 0 ? bb.z1 - bb.z0 : bb.x1 - bb.x0;
  const P = (lx, lz) => [cx + LX[0] * lx + LZ[0] * lz, cz + LX[1] * lx + LZ[1] * lz];
  const ry = Math.atan2(LZ[0], LZ[1]);
  const info = { part: p, h, up, roof: roofUp, kind: p.kind, cx, cz, front: [fx, fz], landing: null };
  out.stairs.push(info);
  if (p.kind === 'spiral') {
    const R = Math.min(along, across) / 2 - 0.08;
    gb.cyl(cx, 0, cz, 0.18, Math.max(h, ctx.F.ceil - ctx.F.y), st.tint ?? 0xe9c27c, 0, PAT.metal);
    for (const c of cellsOf()) stairCells.set(c, 'well');
    if (!h) { for (const c of cellsOf()) stairCells.set(c, 'land'); return; }
    const turns = h > 5 ? 2 : 1, n = Math.max(12, Math.ceil(h / 0.22)), da = (turns * Math.PI * 2) / n;
    const a0 = Math.atan2(LZ[1], LZ[0]); // 정면(문) 쪽 각
    for (let k = 1; k <= n; k++) {
      const a = a0 + k * da, y = (k / n) * h;
      const mr = (R + 0.2) / 2, ccx = cx + Math.cos(a) * mr, ccz = cz + Math.sin(a) * mr;
      const w = R * da * 1.15;
      const rot = -a;
      gb.box(ccx, y - 0.12, ccz, R - 0.2, 0.12, w, -a + Math.PI / 2 - Math.PI / 2, stepC, 0, PAT.stone);
      ctx.extraCols.push(colBox(ctx, ccx, ccz, (R - 0.2) / 2, w / 2, rot, y - 0.35, y, true));
    }
    // 바깥 난간: 빛 띠
    glass.geo(new THREE.CylinderGeometry(R + 0.05, R + 0.05, h, 20, 1, true), cx, h / 2 + 0.5, cz, 0, 0xbff8ff, 0.1);
    info.landing = P(0, R * 0.6);
    return;
  }
  // 되돌이 계단: 앞 계단참(이 층) · 1번 줄(왼쪽, 뒤로) · 뒤 계단참 · 2번 줄(오른쪽, 앞으로) → 위층 앞 계단참
  const zF = along / 2, zB = -along / 2, LAND = 1.4;
  const xL = -across / 2 + 0.08, xR = across / 2 - 0.08, xM = 0;
  // 앞 계단참 칸은 이 층 바닥판이 덮고, 나머지는 우물(다음 층 바닥판 없음)
  for (const [i, j] of p.cells) {
    const c = j * gw + i;
    const gx = B.G.ox + i + 0.5 - cx, gz = B.G.oz + j + 0.5 - cz;
    const lz = gx * LZ[0] + gz * LZ[1];
    stairCells.set(c, !h && !roofUp ? 'land' : lz > zF - LAND - 0.01 ? 'land' : 'well');
  }
  info.landing = P(0, zF - LAND / 2);
  if (!h) {
    if (roofUp) { // 옥상으로: 위로 짧은 줄 + 지붕 문
      const top = ctx.F.ceil - ctx.F.y + SLAB;
      flight(ctx, gb, P, xL, xM, zF - LAND, zB + LAND, 0, top * 0.5, stepC, ry);
      flight(ctx, gb, P, xM, xR, zB + LAND, zF - LAND, top * 0.5, top, stepC, ry);
      landing(ctx, gb, P, xL, xR, zB, zB + LAND, top * 0.5, stepC);
      info.roofDoor = P(0, zF - LAND / 2);
      info.roofY = top;
    }
    return;
  }
  const loops = h > 4.6 ? 2 : 1;
  const dh = h / (2 * loops);
  let y = 0;
  for (let k = 0; k < loops; k++) {
    flight(ctx, gb, P, xL, xM - 0.06, zF - LAND, zB + LAND, y, y + dh, stepC, ry);
    landing(ctx, gb, P, xL, xR, zB, zB + LAND, y + dh, stepC);
    flight(ctx, gb, P, xM + 0.06, xR, zB + LAND, zF - LAND, y + dh, y + 2 * dh, stepC, ry);
    if (k < loops - 1) landing(ctx, gb, P, xL, xR, zF - LAND, zF, y + 2 * dh, stepC);
    y += 2 * dh;
  }
  // 가운데 벽 (두 줄 사이) + 빛 난간
  const [mx0, mz0] = P(xM, zF - LAND), [mx1, mz1] = P(xM, zB + LAND);
  const lenM = Math.hypot(mx1 - mx0, mz1 - mz0);
  gb.box((mx0 + mx1) / 2, 0, (mz0 + mz1) / 2, 0.12, h + 1.0, lenM, ry, wall, 0, PAT.panel);
  gb.box((mx0 + mx1) / 2, h + 1.0, (mz0 + mz1) / 2, 0.14, 0.04, lenM, ry, rail, 1.6);
  ctx.extraCols.push(colBox(ctx, (mx0 + mx1) / 2, (mz0 + mz1) / 2, Math.abs(fx) ? lenM / 2 : 0.08, Math.abs(fx) ? 0.08 : lenM / 2, 0, -0.5, h + 1.0, false));
  void L;
}
/** 중2층 계단. 'z': 곧은 계단(아래 끝 J+n+1 모서리 → 위 끝 J+1 모서리). 'x': 중2층 가장자리를 따라 옆으로 올라 2×2 계단참에서 중2층으로.
 *  두 옆은 유리 난간(기울어진 판) + 막는 벽 충돌체, 계단 밑은 옆판으로 막는다 */
function buildMezzStair(ctx, out, gb, glass, M, st) {
  const { B } = ctx;
  const { ox, oz } = B.G;
  const stepC = mix(st.floor, 0xffffff, 0.2), side = mix(st.wall, 0x000000, 0.08), rail = st.glow ?? 0x7ff3e6;
  // 기울어진 난간 한 줄: (a → b) 를 따라 바닥 높이 ya → yb
  const sideRail = (ax, az, bx, bz, ya, yb, under = true) => {
    if (under) { gb.tri([ax, 0, az], [bx, 0, bz], [bx, yb, bz], side, 0, PAT.panel); gb.tri([bx, 0, bz], [ax, 0, az], [bx, yb, bz], side, 0, PAT.panel); if (ya > 0.01) { gb.tri([ax, 0, az], [bx, yb, bz], [ax, ya, az], side, 0, PAT.panel); gb.tri([bx, yb, bz], [ax, 0, az], [ax, ya, az], side, 0, PAT.panel); } }
    glass.quad([ax, ya + 0.05, az], [bx, yb + 0.05, bz], [bx, yb + 1.0, bz], [ax, ya + 1.0, az], 0xcff4ff, 0.06);
    glass.quad([bx, yb + 0.05, bz], [ax, ya + 0.05, az], [ax, ya + 1.0, az], [bx, yb + 1.0, bz], 0xcff4ff, 0.06);
    const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / 0.8)), ry = Math.atan2(bx - ax, bz - az);
    for (let k = 0; k < n; k++) {
      const t0 = k / n, t1 = (k + 1) / n;
      const x = ax + (bx - ax) * (t0 + t1) / 2, z = az + (bz - az) * (t0 + t1) / 2, y = ya + (yb - ya) * (t0 + t1) / 2 + 1.0;
      gb.box(x, y - 0.02, z, 0.06, 0.05, L / n + 0.02, ry, rail, 1.4);
    }
    const m = Math.max(1, Math.ceil(L / 1.5));
    for (let k = 0; k < m; k++) {
      const t0 = k / m, t1 = (k + 1) / m;
      const x = ax + (bx - ax) * (t0 + t1) / 2, z = az + (bz - az) * (t0 + t1) / 2;
      const vert = Math.abs(bx - ax) < 1e-6;
      ctx.extraCols.push(colBox(ctx, x, z, vert ? 0.06 : L / m / 2, vert ? L / m / 2 : 0.06, 0, -0.4, ya + (yb - ya) * t1 + 1.0, false));
    }
  };
  if (M.axis !== 'x') {
    const x0 = ox + M.i0, x1 = ox + M.i1 + 1, zt = oz + M.J + 1, zb = oz + M.J + M.n + 1;
    flight(ctx, gb, (lx, lz) => [lx, lz], x0 + 0.06, x1 - 0.06, zb, zt, 0, M.h, stepC, 0);
    for (const x of [x0 + 0.03, x1 - 0.03]) sideRail(x, zb, x, zt, 0, M.h);
    out.mstair = { ...M, x0, x1, zt, zb };
    return;
  }
  // 옆 계단: 계단참(i0..i1 × J+1..J+2) 높이 h, 계단은 run0 → run0+sx*(n-1) 쪽으로 내려간다
  const z0 = oz + M.J + 1, z1 = oz + M.J + 3;
  const lx0 = ox + M.i0, lx1 = ox + M.i1 + 1;
  const xt = M.sx > 0 ? lx1 : lx0; // 계단 위 끝 (계단참 가장자리)
  const xb = xt + M.sx * M.n; // 계단 아래 끝
  // 계단: 로컬 z = 세계 x (아래 → 위), 로컬 x = 세계 z
  flight(ctx, gb, (lx, lz) => [lz, lx], z0 + 0.06, z1 - 0.06, xb, xt, 0, M.h, stepC, Math.PI / 2);
  // 계단참 (평평한 판 + 충돌체)
  gb.box((lx0 + lx1) / 2, M.h - 0.3, (z0 + z1) / 2, lx1 - lx0, 0.3, z1 - z0, 0, stepC, 0, PAT.stone);
  ctx.extraCols.push(colBox(ctx, (lx0 + lx1) / 2, (z0 + z1) / 2, (lx1 - lx0) / 2, (z1 - z0) / 2, 0, M.h - 0.4, M.h, true));
  // 계단참 밑 기둥 (막힌 벽)
  gb.box((lx0 + lx1) / 2, 0, (z0 + z1) / 2, lx1 - lx0 - 0.1, M.h - 0.3, z1 - z0 - 0.1, 0, side, 0, PAT.panel);
  ctx.extraCols.push(colBox(ctx, (lx0 + lx1) / 2, (z0 + z1) / 2, (lx1 - lx0) / 2 - 0.05, (z1 - z0) / 2 - 0.05, 0, -0.4, M.h - 0.4, false));
  // 난간: 홀 쪽(z1) 계단+계단참, 계단참 바깥 끝, 중2층 쪽(z0)은 계단만 (위는 중2층 가장자리)
  sideRail(xb, z1 - 0.03, xt, z1 - 0.03, 0, M.h);
  sideRail(xt, z1 - 0.03, xt - M.sx * (lx1 - lx0), z1 - 0.03, M.h, M.h, false);
  const xe = M.sx > 0 ? lx0 : lx1;
  sideRail(xe, z0, xe, z1, M.h, M.h, false);
  sideRail(xb, z0 + 0.03, xt, z0 + 0.03, 0, M.h);
  out.mstair = { ...M, z0, z1, xt, xb };
}
function flight(ctx, gb, P, xa, xb, za, zb, ya, yb, col, ry) {
  const n = Math.max(4, Math.round((yb - ya) / 0.18));
  const w = xb - xa;
  for (let k = 0; k < n; k++) {
    const t0 = k / n, t1 = (k + 1) / n;
    const z0 = za + (zb - za) * t0, z1 = za + (zb - za) * t1, y = ya + (yb - ya) * t1;
    const [x, z] = P((xa + xb) / 2, (z0 + z1) / 2);
    gb.box(x, y - 0.06, z, Math.abs(w), 0.06, Math.abs(z1 - z0) + 0.02, ry, col, 0, PAT.stone);
    gb.box(x, ya + (yb - ya) * t0, z, Math.abs(w), y - (ya + (yb - ya) * t0), 0.04, ry, col, 0, PAT.plain); // 챌판
  }
  // 아래 밑판 (비스듬한 판)
  // 충돌: 세 토막 경사로 (밑면이 비탈을 따라가게)
  for (let k = 0; k < 3; k++) {
    const t0 = k / 3, t1 = (k + 1) / 3;
    const [ax, az] = P((xa + xb) / 2, za + (zb - za) * t0), [bx, bz] = P((xa + xb) / 2, za + (zb - za) * t1);
    ctx.extraCols.push(colRamp(ctx, ax, az, bx, bz, ya + (yb - ya) * t0, ya + (yb - ya) * t1, Math.abs(w) / 2));
  }
}
function landing(ctx, gb, P, xa, xb, za, zb, y, col) {
  const [x, z] = P((xa + xb) / 2, (za + zb) / 2);
  const [ax, az] = P(xa, za), [bx, bz] = P(xb, zb);
  const w = Math.abs(bx - ax), d = Math.abs(bz - az);
  gb.box(x, y - 0.25, z, w, 0.25, d, 0, col, 0, PAT.stone);
  ctx.extraCols.push(colBox(ctx, x, z, w / 2, d / 2, 0, y - 0.35, y, true));
}

// ── 승강기 ──────────────────────────────────────────────────
function buildLift(ctx, out, gb, p, lk, R, st) {
  const { B, F } = ctx;
  const bb = cellBox(B, p.cells);
  const cx = (bb.x0 + bb.x1) / 2, cz = (bb.z0 + bb.z1) / 2;
  const W = bb.x1 - bb.x0, D = bb.z1 - bb.z0;
  const ceil = F.ceil - F.y;
  const stops = !!(lk && lk.floors.includes(F.i));
  const [fx, fz] = p.door.dir;
  // 승강기 칸: 안쪽(문이 열리면 보이는 칸) — 바닥·뒷벽·천장 빛
  const cab = p.kind === 'cargo' ? 0x9aa0aa : mix(st.wall, st.tint ?? 0xe9c27c, 0.15);
  gb.floorRect(bb.x0 + 0.15, bb.z0 + 0.15, bb.x1 - 0.15, bb.z1 - 0.15, 0.02, p.kind === 'cargo' ? 0x6a6e78 : st.floor, 0, PAT.grid);
  gb.ceilRect(bb.x0 + 0.15, bb.z0 + 0.15, bb.x1 - 0.15, bb.z1 - 0.15, 2.6, 0xffffff, 1.4, PAT.lightstrip);
  // 막는 기둥 (사람은 문 앞에서 E 로 탄다)
  ctx.extraCols.push(colBox(ctx, cx, cz, W / 2 - 0.05, D / 2 - 0.05, 0, -0.5, ceil, false));
  const [dx, dz] = [cx + fx * (Math.abs(fx) ? W / 2 : 0), cz + fz * (Math.abs(fz) ? D / 2 : 0)];
  const lift = { part: p, link: lk ? lk.id : null, stops, x: dx, z: dz, front: [fx, fz], cargo: p.kind === 'cargo', bank: lk ? lk.bank : null, open: 0 };
  out.lifts.push(lift);
  // 층 표시 (문 위)
  if (stops) gb.box(dx + fx * 0.08, 2.55, dz + fz * 0.08, Math.abs(fz) ? 0.9 : 0.04, 0.28, Math.abs(fx) ? 0.9 : 0.04, 0, 0x101820, 0);
  void cab;
}

// ── 칸막이·문·난간 ──────────────────────────────────────────
function partitions(ctx, out, gb, glass, roomX, sdAt, ceilAt, st) {
  const { B, F, L } = ctx;
  const { gw, gh, ox, oz } = B.G;
  const rooms = L.rooms;
  const isMezz = !!F.mezz;
  // 문 자리 (모서리 열쇠 → 문)
  const doorAt = new Map();
  for (const d of L.doors) {
    const i = d.c % gw, j = (d.c / gw) | 0, [di, dj] = d.dir;
    const w = Math.max(1, d.w), o0 = -Math.floor((w - 1) / 2), o1 = Math.ceil((w - 1) / 2);
    for (let o = o0; o <= o1; o++) {
      const ci = i + (dj ? o : 0), cj = j + (di ? o : 0);
      const key = di ? `v${di > 0 ? ci + 1 : ci},${cj}` : `h${ci},${dj > 0 ? cj + 1 : cj}`;
      doorAt.set(key, d);
    }
  }
  const glassType = (a, b) => (a && ROOMS[a.type] && ROOMS[a.type].glass) || (b && ROOMS[b.type] && ROOMS[b.type].glass);
  const wallH = (x, z) => (F.vault ? Math.min(4.2, ceilAt(x, z)) : ceilAt(x, z));
  const wallC = mix(st.wall, 0xffffff, 0.12);
  const doorC = st.brand ?? 0x2f8f83;
  const T = PART_T;
  /** 한 모서리 선분: (x0,z0)→(x1,z1), 종류 */
  const runs = [];
  const edge = (x0, z0, x1, z1, kind, a, b, door, key) => { runs.push({ x0, z0, x1, z1, kind, a, b, door }); if (key && (kind === 'solid' || kind === 'glass' || kind === 'rail')) out.walls.add(key); };
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    const c = j * gw + i;
    const A = roomX[c] ? rooms[roomX[c] - 1] : null;
    // 오른쪽 이웃 (세로 모서리 x = i+1), 위 이웃 (가로 모서리 z = j+1)
    for (const [di, dj] of [[1, 0], [0, 1]]) {
      const a = i + di, b = j + dj;
      if (a >= gw || b >= gh) continue;
      const e = b * gw + a;
      const Bq = roomX[e] ? rooms[roomX[e] - 1] : null;
      const voidA = L.void[c] === 1, voidB = L.void[e] === 1;
      const x0 = di ? ox + i + 1 : ox + i, z0 = di ? oz + j : oz + j + 1, x1 = di ? ox + i + 1 : ox + i + 1, z1 = di ? oz + j + 1 : oz + j + 1;
      const key = di ? `v${i + 1},${j}` : `h${i},${j + 1}`;
      // 뚫린 곳 가장자리 = 난간
      // 중2층 계단이 닿는 곳은 난간 없이 열어 둔다
      if (isMezz && L.mstair && dj === 1 && j === L.mstair.J && i >= L.mstair.i0 && i <= L.mstair.i1) continue;
      if ((A && voidB) || (Bq && voidA) || (isMezz && (!!A !== !!Bq) && L.void[A ? e : c] !== 2)) { edge(x0, z0, x1, z1, 'rail', A, Bq, null, key); continue; }
      if (!A || !Bq || A === Bq) continue;
      // 설비 관은 그 자체가 막힌 상자(벽) — 둘레에 칸막이를 또 세우면 칸막이 끝면이 관의 면과 겹친다
      if (A.type === 'shaft' || Bq.type === 'shaft') continue;
      // 복도·승강기 홀·로비·넓은 홀끼리는 벽 없이 이어진다
      if (flowRoom(A) && flowRoom(Bq)) continue;
      // 같은 세대의 열린 방(거실-부엌) · 열린 문은 벽 없이
      const d = doorAt.get(key);
      if (d && d.kind === 'open') { edge(x0, z0, x1, z1, 'opening', A, Bq, d); continue; }
      if (d) { edge(x0, z0, x1, z1, 'door', A, Bq, d); continue; }
      edge(x0, z0, x1, z1, glassType(A, Bq) ? 'glass' : 'solid', A, Bq, null, key);
    }
  }
  // 바깥 윤곽 밖으로 나간 끝은 자른다
  const clip = (x0, z0, x1, z1) => {
    const a = sdAt(x0, z0), b = sdAt(x1, z1);
    if (isMezz) return [x0, z0, x1, z1];
    if (a >= 0 && b >= 0) return null;
    if (a < 0 && b < 0) return [x0, z0, x1, z1];
    let lo = 0, hi = 1;
    for (let k = 0; k < 12; k++) { const m = (lo + hi) / 2; const v = sdAt(x0 + (x1 - x0) * m, z0 + (z1 - z0) * m); if ((v < 0) === (a < 0)) lo = m; else hi = m; }
    const t = (lo + hi) / 2;
    return a < 0 ? [x0, z0, x0 + (x1 - x0) * t, z0 + (z1 - z0) * t] : [x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, x1, z1];
  };
  // 같은 줄의 같은 종류를 이어 붙인다
  runs.sort((p, q) => (p.x0 === p.x1 ? 0 : 1) - (q.x0 === q.x1 ? 0 : 1) || p.x0 - q.x0 || p.z0 - q.z0);
  const merged = [];
  for (const e of runs) {
    const last = merged[merged.length - 1];
    if (last && last.kind === e.kind && e.kind !== 'door' && e.kind !== 'opening' && last.x1 === e.x0 && last.z1 === e.z0 && (last.x0 === last.x1) === (e.x0 === e.x1)) { last.x1 = e.x1; last.z1 = e.z1; continue; }
    merged.push({ ...e });
  }
  const doneDoors = new Set();
  for (const e of merged) {
    const cl = clip(e.x0, e.z0, e.x1, e.z1);
    if (!cl) continue;
    const [x0, z0, x1, z1] = cl;
    const len = Math.hypot(x1 - x0, z1 - z0);
    if (len < 0.05) continue;
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    const vert = x0 === x1;
    const ry = vert ? 0 : Math.PI / 2;
    const H = Math.min(wallH(x0, z0), wallH(x1, z1));
    const hx = vert ? T / 2 : len / 2, hz = vert ? len / 2 : T / 2;
    if (e.kind === 'solid') {
      gb.box(mx, 0, mz, vert ? T : len, H, vert ? len : T, 0, wallC, 0, PAT.panel, (ctx.style && ctx.style.wallPat) || 0);
      gb.box(mx, 0, mz, (vert ? T : len) + 0.02, 0.1, (vert ? len : T) + 0.02, 0, mix(st.floor, 0x000000, 0.2), 0); // 걸레받이
      ctx.extraCols.push(colBox(ctx, mx, mz, hx + (vert ? 0.02 : 0.04), hz + (vert ? 0.04 : 0.02), 0, -0.3, H, false));
    } else if (e.kind === 'glass') {
      glass.box(mx, 0.05, mz, vert ? 0.04 : len, H - 0.1, vert ? len : 0.04, 0, 0xcff4ff, 0.05);
      gb.box(mx, 0, mz, vert ? 0.1 : len, 0.08, vert ? len : 0.1, 0, 0x9aa4b0, 0, PAT.metal);
      gb.box(mx, H - 0.08, mz, vert ? 0.1 : len, 0.08, vert ? len : 0.1, 0, 0x9aa4b0, 0, PAT.metal);
      gb.box(mx, 1.05, mz, vert ? 0.05 : len, 0.03, vert ? len : 0.05, 0, st.glow ?? 0x7ff3e6, 1.0);
      ctx.extraCols.push(colBox(ctx, mx, mz, hx + 0.02, hz + 0.02, 0, -0.3, H, false));
    } else if (e.kind === 'rail') {
      glass.box(mx, 0.05, mz, vert ? 0.03 : len, 1.0, vert ? len : 0.03, 0, 0xcff4ff, 0.06);
      gb.box(mx, 1.05, mz, vert ? 0.07 : len, 0.05, vert ? len : 0.07, 0, st.glow ?? 0x7ff3e6, 1.4);
      ctx.extraCols.push(colBox(ctx, mx, mz, hx + 0.02, hz + 0.02, 0, -0.2, 1.1, false));
    } else if (e.kind === 'door' || e.kind === 'opening') {
      // 문 하나를 한 번만: 문 너비 전체에 문틀(기둥·인방) + 미닫이
      const d = e.door;
      if (doneDoors.has(d)) continue;
      doneDoors.add(d);
      const i = d.c % gw, j = (d.c / gw) | 0, [di, dj] = d.dir;
      const w = Math.max(1, d.w), o0 = -Math.floor((w - 1) / 2);
      const ex0 = di ? ox + (di > 0 ? i + 1 : i) : ox + i + o0, ez0 = di ? oz + j + o0 : oz + (dj > 0 ? j + 1 : j);
      const ex1 = di ? ex0 : ex0 + w, ez1 = di ? ez0 + w : ez0;
      const dc = clip(ex0, ez0, ex1, ez1) || [ex0, ez0, ex1, ez1];
      const dmx = (dc[0] + dc[2]) / 2, dmz = (dc[1] + dc[3]) / 2, dlen = Math.hypot(dc[2] - dc[0], dc[3] - dc[1]);
      const dv = dc[0] === dc[2];
      const head = e.kind === 'opening' ? Math.min(H, 2.9) : Math.min(H, 2.4);
      const openW = Math.max(0.9, dlen - 0.26); // 문틀 기둥 안쪽 면과 1 cm 띄운다 (닫힌 문의 끝면이 기둥 면과 겹치지 않게)
      // 기둥 둘 + 인방 + 인방 위 벽
      for (const sgn of [-1, 1]) {
        const px = dv ? dmx : dmx + sgn * (dlen / 2 - 0.06), pz = dv ? dmz + sgn * (dlen / 2 - 0.06) : dmz;
        gb.box(px, 0, pz, dv ? 0.2 : 0.12, head, dv ? 0.12 : 0.2, 0, mix(wallC, doorC, 0.3), 0, PAT.metal);
        ctx.extraCols.push(colBox(ctx, px, pz, dv ? 0.1 : 0.06, dv ? 0.06 : 0.1, 0, -0.3, head, false));
      }
      gb.box(dmx, head, dmz, dv ? 0.2 : dlen, 0.12, dv ? dlen : 0.2, 0, mix(wallC, doorC, 0.3), 0, PAT.metal);
      gb.box(dmx, head - 0.04, dmz, dv ? 0.22 : dlen - 0.1, 0.03, dv ? dlen - 0.1 : 0.22, 0, d.kind === 'staff' ? 0xffc46a : st.glow ?? 0x7ff3e6, 1.5);
      if (H > head + 0.12) gb.box(dmx, head + 0.12, dmz, dv ? T : dlen, H - head - 0.12, dv ? dlen : T, 0, wallC, 0, PAT.panel);
      if (e.kind === 'door' && !['lift', 'cargo'].includes(d.kind)) {
        // 미닫이: 사람이 다가가면 옆으로 미끄러져 열린다 (주머니 벽 쪽으로)
        const panel = new GB();
        panel.box(0, 0.02, 0, dv ? 0.05 : openW, head - 0.06, dv ? openW : 0.05, 0, d.kind === 'staff' ? mix(doorC, 0x404040, 0.4) : d.kind === 'stair' ? 0xd8dce4 : mix(st.brand2 ?? 0xf1ece4, doorC, 0.25), 0, PAT.panel);
        panel.box(0, 1.0, 0, dv ? 0.07 : 0.06, 0.25, dv ? 0.06 : 0.07, 0, st.glow ?? 0x7ff3e6, 1.5);
        out.doors.push({ geo: panel, x: dmx, z: dmz, slide: dv ? [0, 1] : [1, 0], w: openW, door: d, glassy: ROOMS[rooms[d.a].type]?.glass });
      }
      // 방 이름판 (문 위, 복도 쪽)
      const A = rooms[d.a], Bq = d.b >= 0 ? rooms[d.b] : null;
      const sideRoom = A && !A.circ ? A : Bq;
      if (sideRoom && !sideRoom.circ && !['lift', 'cargo'].includes(d.kind)) {
        const outward = A === sideRoom ? 1 : -1; // 표지판은 방 밖(복도) 쪽
        out.signs.push({ text: d.kind === 'stair' ? '계단' : signName(sideRoom, L), sub: d.kind === 'staff' ? '직원만' : '', x: dmx + (dv ? di * outward * 0.12 : 0), z: dmz + (dv ? 0 : dj * outward * 0.12), y: head + 0.32, ry: dv ? (di * outward > 0 ? Math.PI / 2 : -Math.PI / 2) : (dj * outward > 0 ? 0 : Math.PI), staff: d.kind === 'staff', room: sideRoom.id });
      }
    }
  }
}

/** 방 이름판의 글 (세대·객실은 번호) */
export function signName(R, L) {
  if (R.unitNo) return R.unitNo;
  return R.label || R.name;
}

/** 공용 재질 (층마다 빛 색) */
export function floorMaterials(st) {
  const light = st.light === 'cool' ? 0xe8f2ff : st.light === 'warm' ? 0xffe6c8 : 0xfff4e6;
  return {
    solid: interiorMaterial({ light, lux: 1.32, accent: st.glow ?? 0x7ff3e6, side: THREE.DoubleSide }),
    glass: glowMaterial({ color: 0xcff4ff, intensity: 0.16, fresnel: 0.85, side: THREE.DoubleSide }),
  };
}
