// 나선 계단 걷기 모의 (v24): render.buildStair 의 나선 충돌체(디딤판·계단참·우물 벽·난간)를 실제 Colliders 에 넣고
// player._ground 의 밀기(pushOut)·발밑(ground)을 그대로 60 Hz 로 돌려 cells-check 의 경로를 걷는다. 브라우저 없이 몇 초.
//   node tools/spiral-sim.mjs            — 칸 크기 × 층 높이(2.8~8 m) × 맨 아래층/가운데층을 spiralPlan 대로 모두 걸어 보고,
//                                          디딤판마다 기둥 쪽·바깥벽 쪽·앞뒤로 걸어 들어가 발밑이 꺼지는 자리(떨어지는 구멍)를 센다
// 나선 계단 모양(spiral.js)·디딤판·난간을 바꾸면 이걸로 먼저. 브라우저 확인은 node tools/cells-check.mjs.
import { Colliders } from '../src/world/colliders.js';
import { spiralPlan, spiralRail, SPIRAL2_MAXH } from '../src/interior/spiral.js';
const RADIUS = 0.35, HEIGHT = 1.75, STEP = 0.55, Y0 = 8000, SLAB = 0.35;

/** 나선 계단 하나: along×across 칸, 층 높이 h, 바퀴 turns, opt.geo(R, mr, th, …)를 바꿔 볼 수 있게 */
function build(along, across, h, turns, opt = {}) {
  const C = new Colliders();
  const add = (x, z, hx, hz, rot, y0, y1, walk) => C.add({ type: 'box', x, z, hx, hz, rot, y0: Y0 + y0, y1: Y0 + y1, walk, sky: true });
  const zF = along / 2, xA = across / 2;
  const geo = (opt.geo || defGeo)(along, across, h, turns);
  const { R, mr, edgeLz, th, span, n, r0 = 0.2 } = geo;
  // 계단참 (이 층: 앞 띠, 맨 아래층이면 전체) + 위층 계단참 (앞 띠)
  const landD = zF - edgeLz;
  if (opt.bottom !== false) add(0, 0, xA, zF, 0, -SLAB, 0, true); else add(0, edgeLz + landD / 2, xA, landD / 2, 0, -SLAB, 0, true);
  add(0, edgeLz + landD / 2, xA, landD / 2, 0, h - SLAB, h, true);
  // 앞 띠 바깥: 문 앞 바닥 (방)
  add(0, zF + 2, xA + 2, 2, 0, -SLAB, 0, true);
  add(0, zF + 2, xA + 2, 2, 0, h - SLAB, h, true);
  // 우물 벽 (문 칸만 뚫림 — 문 폭 1 m, 가운데)
  const T = 0.07;
  add(-xA - T, 0, T, zF, 0, -1, 2 * h, false);
  add(xA + T, 0, T, zF, 0, -1, 2 * h, false);
  add(0, -zF - T, xA, T, 0, -1, 2 * h, false);
  // 앞벽: 문(폭 1 m) 양옆
  const dw = 0.5;
  if (xA - dw > 0.01) { add(-(xA + dw) / 2, zF + T, (xA - dw) / 2, T, 0, -1, 2 * h, false); add((xA + dw) / 2, zF + T, (xA - dw) / 2, T, 0, -1, 2 * h, false); }
  // 위층 계단참 뒤 난간 (떠나는 끝 −xs, 닿는 끝 +xs 만 열림, 틈 gap)
  const gap = opt.gap ?? 0.9, xs = mr * Math.sin(th);
  const rail = (yb) => {
    const x0 = -xA + 0.08, x1 = xA - 0.08, cuts = [[xs - gap / 2, xs + gap / 2], [-xs - gap / 2, -xs + gap / 2]].sort((a, b) => a[0] - b[0]);
    let a = x0;
    for (const [c0, c1] of cuts) { const b = Math.min(c0, x1); if (b - a > 0.1) add((a + b) / 2, edgeLz, (b - a) / 2, 0.05, 0, yb - 0.2, yb + 1.1, false); a = Math.max(a, c1); }
    if (x1 - a > 0.1) add((a + x1) / 2, edgeLz, (x1 - a) / 2, 0.05, 0, yb - 0.2, yb + 1.1, false);
  };
  rail(h);
  if (opt.bottom === false) rail(0);
  // 디딤판 (render 와 같은 식: 로컬 Z = 정면 → a0 = atan2(LZ.z, LZ.x) — 여기선 틀 = 로컬이라 정면 +z: a0 = π/2)
  const a0 = Math.PI / 2, da = span / n;
  const steps = [];
  for (let k = 1; k <= n; k++) {
    const a = a0 + th + (k - 0.5) * da, y = (k / n) * h;
    const cx = Math.cos(a) * ((R + r0) / 2), cz = Math.sin(a) * ((R + r0) / 2);
    const w = ((R + r0) / 2) * da * 1.25;
    add(cx, cz, (R - r0) / 2, w / 2, -a, y - (opt.thick ?? 0.35), y, true);
    steps.push([cx, cz, y]);
  }
  if (opt.pillar) C.add({ type: 'cyl', x: 0, z: 0, r: opt.pillar, y0: Y0 - 1, y1: Y0 + 2 * h, walk: false, sky: true });
  // 디딤판 둘레 유리 난간 (render 와 같은 조각): 계단 로컬 x·z 그대로 (여기선 틀 = 로컬), 조각은 반지름에 수직
  if (opt.ring) for (const [x, z, hl, a, y0, y1] of spiralRail({ ...geo, turns }, h)) add(x, z, hl, 0.03, a, y0, y1, false);
  return { C, geo, zF, edgeLz, xs, steps };
}
function defGeo(along, across, h, turns) {
  const R = Math.min(along, across) / 2 - 0.08, mr = (R + 0.2) / 2, edgeLz = along / 2 - 1;
  const th = Math.acos(Math.max(-1, Math.min(1, edgeLz / mr))) + 0.14;
  const span = Math.PI * 2 * turns - 2 * th, n = Math.max(10, Math.ceil(h / 0.21));
  return { R, mr, edgeLz, th, span, n };
}

/** 걷기: 점들을 차례로 (cells-check 의 __walkTo 와 같은 조향) → 결과 */
function walk(S, pts, y0 = 0) {
  const C = S.C, p = { x: pts[0][0], y: Y0 + y0, z: pts[0][1] }, v = { x: 0, z: 0 }, DT = 1 / 60, g = { h: 0, c: null };
  let fell = 0;
  const log = [];
  for (let k = 1; k < pts.length; k++) {
    const [tx, tz] = pts[k];
    let hit = false;
    for (let f = 0; f < 4 / DT; f++) {
      const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
      if (d < 0.3) { hit = true; break; }
      const mv = d < 0.6 ? 0.5 : 1, maxS = 8.2 * mv;
      const wx = dx / d * maxS, wz = dz / d * maxS;
      const ax = wx - v.x, az = wz - v.z, ad = Math.hypot(ax, az), st = 55 * DT;
      if (ad <= st) { v.x = wx; v.z = wz; } else { v.x += ax / ad * st; v.z += az / ad * st; }
      p.x += v.x * DT; p.z += v.z * DT;
      C.pushOut(p, RADIUS, HEIGHT, STEP);
      C.ground(p.x, p.z, p.y, STEP, 0.15, g);
      if (p.y - g.h > STEP + 0.05) { p.y = g.h; fell = Math.max(fell, 1); } else p.y = g.h;
    }
    log.push([k, hit ? 1 : 0, +(p.y - Y0).toFixed(2), +p.x.toFixed(2), +p.z.toFixed(2)]);
    if (!hit) return { ok: false, at: k, y: p.y - Y0, log };
  }
  return { ok: true, y: p.y - Y0, log };
}

/** (x, z, y) 에 서서 (tx, tz) 쪽으로 0.8 초 걷기 — 도중에 발밑이 STEP 보다 많이 꺼지면 true (떨어짐) */
function probeFall(S, x, z, y0, tx, tz) {
  const C = S.C, p = { x, y: Y0 + y0, z }, g = { h: 0, c: null }, DT = 1 / 60;
  C.pushOut(p, RADIUS, HEIGHT, STEP);
  C.ground(p.x, p.z, p.y + 0.3, STEP + 0.3, 0.15, g);
  if (Math.abs(g.h - p.y) > 0.6) return false; // 시작 자리에 설 수 없음 (다른 디딤판 밑) — 걸어서 올 수 없는 자리
  p.y = g.h;
  for (let f = 0; f < 0.8 / DT; f++) {
    const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
    if (d < 0.05) break;
    const sp = Math.min(4.1 * DT, d);
    p.x += (dx / d) * sp; p.z += (dz / d) * sp;
    C.pushOut(p, RADIUS, HEIGHT, STEP);
    C.ground(p.x, p.z, p.y, STEP, 0.15, g);
    if (p.y - g.h > STEP + 0.05) return true;
    p.y = g.h;
  }
  return false;
}

/** cells-check 의 나선 경로 (계단참 → 디딤판 가운데 원 → 위층 계단참) */
function route(S, turns) {
  const { mr, th } = S.geo, zF = S.zF, edgeLz = S.edgeLz, K = 16 * turns, out = [];
  const P = (lx, lz) => [lx, lz];
  out.push(P(0, (zF + edgeLz) / 2));
  for (let k = 0; k <= K; k++) { const ph = th + ((Math.PI * 2 * turns - 2 * th) * k) / K; out.push(P(-mr * Math.sin(ph), mr * Math.cos(ph))); }
  out.push(P(0, (zF + edgeLz) / 2));
  return out;
}

const PILLAR = +(process.env.PILLAR ?? 0.18); // 가운데 기둥 충돌체 반지름 (render 와 같게)
const RING = process.env.RING !== '0'; // 디딤판 둘레 유리 난간 충돌 (render 와 같게)
const geoOf = (P) => () => ({ R: P.R, mr: P.mr, edgeLz: P.edgeLz, th: P.th, span: P.span, n: P.n });
let bad = 0;
const rows = [];
// core.js 의 COMP 가 짓는 나선 계단 크기 (spiral 3×3 · spiral2 2×2) — 크기를 더하면 여기에도
for (const [al, ac] of [[2, 2], [3, 3]]) {
  for (let k = 28; k <= 80; k++) {
    const h = k / 10;
    if (al === 2 && h > SPIRAL2_MAXH + 1e-6) continue;
    const P = spiralPlan(al, ac, h);
    for (const bottom of [true, false]) {
      const S = build(al, ac, h, P.turns, { geo: geoOf(P), bottom, pillar: PILLAR, ring: RING });
      const up = walk(S, route(S, P.turns));
      const enter = walk(S, [[0, S.zF + 1.2], [0, (S.zF + S.edgeLz) / 2]]);
      // 발밑이 없는 곳: 디딤판마다 그 가운데 줄에 서서 기둥 쪽으로 · 바깥벽 쪽으로 · 앞뒤로 걸어 들어가 본다 —
      //  player._ground 처럼 발밑이 STEP 보다 많이 꺼지는 순간 = 떨어짐
      let holes = 0;
      for (let k = 2; k < P.n; k++) {
        const a = Math.PI / 2 + P.th + (k - 0.5) * P.da, y = (k / P.n) * h, cx = Math.cos(a) * P.mr, cz = Math.sin(a) * P.mr;
        const ta = [-Math.sin(a), Math.cos(a)];
        for (const [tx, tz] of [[0, 0], [Math.cos(a) * (P.R + 0.5), Math.sin(a) * (P.R + 0.5)], [cx + ta[0] * 2, cz + ta[1] * 2], [cx - ta[0] * 2, cz - ta[1] * 2]]) {
          if (probeFall(S, cx, cz, y, tx, tz)) holes++;
        }
      }
      if (up.ok && Math.abs(up.y - h) < 0.3 && enter.ok && !holes) continue;
      bad++;
      rows.push(`${al}×${ac} 층 ${h.toFixed(1)} m · ${P.turns}바퀴 · ${bottom ? '맨 아래층' : '가운데층'}: 오르기 ${up.ok ? `닿음 ${up.y.toFixed(2)} m` : `막힘 (경로점 ${up.at}, ${up.y.toFixed(2)} m)`} · 계단참 들어서기 ${enter.ok ? '됨' : '막힘'} · 발밑 없는 자리 ${holes}`);
    }
  }
}
console.log(rows.slice(0, +(process.env.N || 40)).join('\n'));
console.log(`나선 계단 걷기 모의: 실패 ${bad}`);
process.exit(bad ? 1 : 0);
