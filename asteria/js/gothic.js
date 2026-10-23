// 아스테리아 1부 — 고딕 건축 키트 (KIT)
// 칼리도르 학원: 꿀빛 석회암, 녹청 구리 첨탑, 슬레이트 지붕, 황동 이음새의 창백한 고대층, "공명" 모티프
// (동심원 장미창, 종이 걸린 열린 종루, 소리굽쇠 쌍첨탑, 혼천의 고리, 고리 쐐기돌).
// 모든 형상은 Batch(js/batch.js)의 재질 통에 모였다가 build()에서 통마다 메쉬 하나가 된다.
//
// ───────────────────────────── API ─────────────────────────────
// const b = new KIT.Builder({ seed:1, ground:(x,z)=>y, detail:1, lit:0.4, chamfer:0.04 })
//   detail 1 = 기본, 0.5 = 낮은 사양(곡선 나눔·둘레 조각 절반, 작은 장식 생략)
//   lit    해 질 녘에 켜질 창의 비율 (창마다 따로 lit를 주면 그것이 우선)
// 좌표: 단위 m, +y 위. rot = three.js rotation.y (물체를 로컬 +x 방향으로 만든 뒤 rot만큼 돌린다).
// 벽(ax,az → bx,bz)의 바깥면은 진행 방향의 왼쪽(로컬 +z)이다: 시계 반대 방향으로 두르면 바깥이 밖을 본다.
// era: 'ancient'(stoneOld) | 'early'(stoneEarly, 반원 아치, 작고 깊은 창) | 'high'(stone, 뾰족 아치, 큰 창살)
//
// 창 spec {type, w, h, sill, lit, k}
//   type: 'lancet' | 'pointed'(두 칸 + Y 창살) | 'paired'(두 란셋 + 동심원 원창) | 'triple'(세 칸 + 큰 원창)
//         | 'round'(초기, 반원) | 'roundPair'(초기, 두 칸 반원 + 작은 기둥) | 'square'(돌 창살 + 가로대) | 'slit' | 'oculus' | 'rose'
//   w 빛 폭(m), h 창턱에서 아치 꼭대기까지, sill 바닥(y)에서 창턱까지. lit: 0이면 꺼짐, 0..1.5면 켜진 세기
//
// b.wall(ax,az,bx,bz, {y, h, thick=1.2, era='high', ancient=0, plinth=true, courses=true, story=5,
//        windows: spec | [spec...](줄마다), bay=6, buttress=true|{d,w,pinnacle}, endButtress=false, pinnacle=true,
//        cornice=true, corbel=true, parapet:'none'|'battlement'|'balustrade'|'plain', doors:[{at, w, h, type, orders, leaves:'closed'|'open'|'none', lantern}],
//        gable:{rise} (박공 벽), inside=true(안쪽 면), extend=thick/2, flying:false, slits})   → {F, L, T, y, h, top, yb}
// b.hall(x,z, {w=36, d=14, rot, y, h=12, pitch=55, era, ancient, windows, rows, clerestory, buttress=true, flying=false,
//        rose:'+x'|'-x'|'both'|false, gableWin, ends:{'+x':true,'-x':true}, dormers=0, chimneys=0, fleche=false, tuning=true,
//        roof:'slate', doors:[{side:'+z'|'-z'|'+x'|'-x', at, w, h, orders}], cresting=true, story})   (w, d는 바깥 치수)
// b.tower(x,z, {shape:'round'|'square', r | w, h, y, rot, era, ancient, roof:'cone'|'spire'|'pyramid'|'battlement'|'belfry'|'dome'|'armillary'|'lantern'|'none',
//        roofH, roofMat, flare=true, finial=true, windows:{every, n, type}, turret:{a, r, h, roof}, corbelStage:{h, out}, belfry:{h, bells},
//        lucarnes, bartizans, clock, cornice})
// b.gatehouse(x,z, {rot, w=14, d=10, h=13, y, portal:{w,h,orders}, towers:[{h,roof},{h,roof}], portcullis=true, leaves='open', era})
// b.portal(F, at, y, {w, h, orders, k, leaves, depth})   — 벽 틀 F 안의 문 (wall이 부른다)
// b.arcade(ax,az,bx,bz, {y, span=3.2, colH=2.6, depth=3.6, back=true, backH, tracery=true, roof='slate', gaps:[i...], era})   회랑
// b.bridge(ax,az,bx,bz, {y0, y1, width=7, arches, pier=0.25, parapet:'wall'|'balustrade', lamps=true})   여러 아치 돌다리 (기울어도 된다)
// b.stairs(x,z,rot, {w=4, rise, run, y, cheeks=true})   로컬 +x로 올라간다
// b.balustrade(ax,az,bx,bz, {y, h=1.0, post=2.8}),  b.battlements(ax,az,bx,bz, {y, thick=0.5, corbel=true})
// b.curtain(pts[[x,z]...], {y, h, thick, ancient, turrets=true, ...wall 인자})   성벽 (꺾은선, 모서리 망루)
// b.terrace(pts[[x,z]...], {y, top:'flagstone', rail:'balustrade'})   평평한 단 (옹벽 + 바닥 + 난간)
// b.pinnacle(x,y,z,{s, h, rot, tuning}), b.chimney(x,y,z,{rot, h}), b.dormer(F, at, z, {...}), b.lantern(x,y,z,rot,{post})
// b.window(x,y,z,rot,spec,{thick})  — 벽 구멍 없이 창 조립만 (돌려주는 hole은 직접 벽에 뚫을 때 쓴다)
// b.rose(F, cx, cy, R, {T, lit})     — 동심원 장미창
// b.armillary(x,y,z,{r})             — 돌아가는 황동 혼천의 (extra + anims)
// b.build() → THREE.Group (재질 통마다 메쉬 하나; userData.batch = {colliders, lights, marks, anims})
//   colliders: 벽 {x,z,hw,hd,rot,top,bot,climb:true}, 탑 {x,z,r,top,bot,climb:true}, 다리·계단 {..., stand:true}
//   marks: {kind:'window', x,y,z, nx,nz, w,h, lit}, {kind:'door', x,y,z, rot, w,h}
// KIT.setLit(group, k)  창 불빛 0(낮: 어두운 유리) .. 1(해 질 녘) .. 1.5(밤).  KIT.stats(group) → {tris, calls}
// ───────────────────────────────────────────────────────────────
'use strict';
const KIT = (function () {
  const PI = Math.PI, TAU = PI * 2, HP = PI / 2, D2R = PI / 180;
  const cl = (v, a, b) => v < a ? a : v > b ? b : v;
  const lp = (a, b, t) => a + (b - a) * t;
  function rng(seed) {
    let a = (seed >>> 0) || 1;
    return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const ERA = { ancient: 'stoneOld', early: 'stoneEarly', high: 'stone' };

  // =====================================================================
  // 형상 버퍼: 위치·법선·(uv)·정점색 곱. 삼각형은 바깥 방향 힌트로 감기 방향을 맞춘다.
  // =====================================================================
  class GB {
    constructor() { this.p = []; this.n = []; this.c = []; this.u = null; this.vy = false; }
    // 평평한 삼각형, h = 바깥 방향 힌트
    tri(a, b, c, h, k = 1) {
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz);
      if (l < 1e-10) return;
      nx /= l; ny /= l; nz /= l;
      if (h && nx * h[0] + ny * h[1] + nz * h[2] < 0) { const t = b; b = c; c = t; nx = -nx; ny = -ny; nz = -nz; }
      this.p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
      this.n.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
      this.c.push(k, k, k);
      if (this.u) this.u.push(0, 0, 0, 0, 0, 0);
    }
    quad(a, b, c, d, h, k = 1) { this.tri(a, b, c, h, k); this.tri(a, c, d, h, k); }
    // 정점마다 법선·uv가 있는 삼각형 (돌림체, 지붕). 감기는 힌트(평균 법선)로 맞춘다
    triN(a, b, c, na, nb, nc, ua, ub, uc, k = 1) {
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      if (Math.hypot(nx, ny, nz) < 1e-10) return;
      if (nx * (na[0] + nb[0] + nc[0]) + ny * (na[1] + nb[1] + nc[1]) + nz * (na[2] + nb[2] + nc[2]) < 0) { let t = b; b = c; c = t; t = nb; nb = nc; nc = t; t = ub; ub = uc; uc = t; }
      this.p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
      this.n.push(na[0], na[1], na[2], nb[0], nb[1], nb[2], nc[0], nc[1], nc[2]);
      this.c.push(k, k, k);
      if (!this.u) this.u = new Array((this.p.length / 3 - 3) * 2).fill(0);
      this.u.push(ua[0], ua[1], ub[0], ub[1], uc[0], uc[1]);
    }
    // 다른 버퍼를 (u,v,w)→(x,y,z) 사상으로 붙인다 (사상은 회전이어야 한다)
    append(o, map) {
      const P = o.p, N = o.n;
      for (let i = 0; i < P.length; i += 3) {
        const a = map(P[i], P[i + 1], P[i + 2]), b = map(N[i], N[i + 1], N[i + 2]);
        this.p.push(a[0], a[1], a[2]); this.n.push(b[0], b[1], b[2]);
      }
      for (const k of o.c) this.c.push(k);
      if (this.u || o.u) { if (!this.u) this.u = new Array((this.p.length / 3 - P.length / 3) * 2).fill(0); if (o.u) for (const k of o.u) this.u.push(k); else for (let i = 0; i < P.length / 3 * 2; i++) this.u.push(0); }
      return this;
    }
  }
  const MAP_ZY = (u, v, w) => [w, v, -u];   // 옆모습 (z,y)를 x로 밀어낸다 (u = -z)
  const MAP_XZ = (u, v, w) => [u, w, -v];   // 평면 (x,z)를 y로 밀어낸다 (v = -z)

  // ---------- 2D 다각형 ----------
  function area(P) { let a = 0; for (let i = 0, j = P.length - 1; i < P.length; j = i++) a += P[j][0] * P[i][1] - P[i][0] * P[j][1]; return a / 2; }
  function dedupe(P, e = 1e-4) {
    const o = [];
    for (const p of P) { const q = o[o.length - 1]; if (!q || Math.abs(q[0] - p[0]) > e || Math.abs(q[1] - p[1]) > e) o.push(p); }
    while (o.length > 2 && Math.abs(o[0][0] - o[o.length - 1][0]) < e && Math.abs(o[0][1] - o[o.length - 1][1]) < e) o.pop();
    return o;
  }
  // 고체 쪽(진행 방향 왼쪽)으로 e만큼 들인다. 바깥 윤곽은 반시계, 구멍은 시계 방향이어야 한다
  function inset(P, e) {
    const n = P.length, out = [];
    for (let i = 0; i < n; i++) {
      const a = P[(i + n - 1) % n], b = P[i], c = P[(i + 1) % n];
      let d1x = b[0] - a[0], d1y = b[1] - a[1]; const l1 = Math.hypot(d1x, d1y) || 1; d1x /= l1; d1y /= l1;
      let d2x = c[0] - b[0], d2y = c[1] - b[1]; const l2 = Math.hypot(d2x, d2y) || 1; d2x /= l2; d2y /= l2;
      let mx = -d1y - d2y, my = d1x + d2x; const ml = Math.hypot(mx, my);
      if (ml < 1e-6) { mx = -d1y; my = d1x; } else { mx /= ml; my /= ml; }
      const k = Math.min(2.2, 1 / Math.max(0.3, -mx * d1y + my * d1x));
      out.push([b[0] + mx * e * k, b[1] + my * e * k]);
    }
    return out;
  }
  const V2 = P => P.map(p => new THREE.Vector2(p[0], p[1]));
  // 뚜껑 (구멍 있는 다각형을 삼각형으로)
  function cap(g, rings, z, h, k) {
    let faces;
    try { faces = THREE.ShapeUtils.triangulateShape(V2(rings[0]), rings.slice(1).map(V2)); } catch (e) { return; }
    const all = [].concat(...rings);
    for (const f of faces) { const a = all[f[0]], b = all[f[1]], c = all[f[2]]; if (a && b && c) g.tri([a[0], a[1], z], [b[0], b[1], z], [c[0], c[1], z], h, k); }
  }
  // 각기둥: 윤곽(구멍 포함)을 z0..z1로 밀어낸다. 앞(z1) 모서리 모따기 ch, 뒤 chB. o.rk = 구멍 옆면(창 안쪽 면) 밝기
  function prism(g, outer, holes, z0, z1, o = {}) {
    outer = dedupe(outer); if (outer.length < 3) return g;
    const d = z1 - z0, ch = Math.min(o.ch ?? 0.04, d * 0.45), chB = Math.min(o.chB ?? 0, d * 0.45);
    const O = area(outer) < 0 ? outer.slice().reverse() : outer;
    const H = (holes || []).map(h => dedupe(h)).filter(h => h.length > 2).map(h => area(h) > 0 ? h.slice().reverse() : h);
    const rings = [O, ...H], F = [], B = [];
    rings.forEach((R, ri) => {
      const k = ri ? (o.rk ?? 1) : (o.ko ?? 1), Rf = ch > 0 ? inset(R, ch) : R, Rb = chB > 0 ? inset(R, chB) : R, n = R.length;
      F.push(Rf); B.push(Rb);
      if (o.sides === false) return;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n, a = R[i], b = R[j];
        let nx = b[1] - a[1], ny = a[0] - b[0]; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
        g.quad([a[0], a[1], z0 + chB], [b[0], b[1], z0 + chB], [b[0], b[1], z1 - ch], [a[0], a[1], z1 - ch], [nx, ny, 0], k);
        if (ch > 0) g.quad([a[0], a[1], z1 - ch], [b[0], b[1], z1 - ch], [Rf[j][0], Rf[j][1], z1], [Rf[i][0], Rf[i][1], z1], [nx, ny, 1], k * 1.04);
        if (chB > 0) g.quad([a[0], a[1], z0 + chB], [b[0], b[1], z0 + chB], [Rb[j][0], Rb[j][1], z0], [Rb[i][0], Rb[i][1], z0], [nx, ny, -1], k);
      }
    });
    if (o.front !== false) cap(g, F, z1, [0, 0, 1], o.kf ?? 1);
    if (o.back !== false) cap(g, B, z0, [0, 0, -1], o.kb ?? 1);
    return g;
  }
  // 모따기 상자 (가운데 x,z, 바닥 y0): 면 6 + 모서리 12 + 꼭짓점 8
  const SG = [-1, 1];
  function cbox(g, cx, y0, cz, sx, sy, sz, ch = 0.04, k = 1) {
    ch = Math.min(ch, sx * 0.3, sy * 0.3, sz * 0.3);
    const ax = sx / 2 - ch, ay = sy / 2 - ch, az = sz / 2 - ch, cy = y0 + sy / 2;
    const P = (i, j, l, w) => [cx + i * ax + (w === 0 ? i * ch : 0), cy + j * ay + (w === 1 ? j * ch : 0), cz + l * az + (w === 2 ? l * ch : 0)];
    for (const i of SG) g.quad(P(i, -1, -1, 0), P(i, 1, -1, 0), P(i, 1, 1, 0), P(i, -1, 1, 0), [i, 0, 0], k);
    for (const j of SG) g.quad(P(-1, j, -1, 1), P(1, j, -1, 1), P(1, j, 1, 1), P(-1, j, 1, 1), [0, j, 0], k);
    for (const l of SG) g.quad(P(-1, -1, l, 2), P(1, -1, l, 2), P(1, 1, l, 2), P(-1, 1, l, 2), [0, 0, l], k);
    if (ch <= 1e-4) return g;
    for (const i of SG) for (const j of SG) g.quad(P(i, j, -1, 0), P(i, j, 1, 0), P(i, j, 1, 1), P(i, j, -1, 1), [i, j, 0], k);
    for (const i of SG) for (const l of SG) g.quad(P(i, -1, l, 0), P(i, 1, l, 0), P(i, 1, l, 2), P(i, -1, l, 2), [i, 0, l], k);
    for (const j of SG) for (const l of SG) g.quad(P(-1, j, l, 1), P(1, j, l, 1), P(1, j, l, 2), P(-1, j, l, 2), [0, j, l], k);
    for (const i of SG) for (const j of SG) for (const l of SG) g.tri(P(i, j, l, 0), P(i, j, l, 1), P(i, j, l, 2), [i, j, l], k);
    return g;
  }
  // 돌림체: prof [[r,y],...] 아래에서 위로. seg 둘레 조각, a0..a1 (rad, 0 = +z, +x 쪽으로 돈다)
  // o.v: 'y' 세계 높이 | 's' 윤곽을 따라 잰 길이(지붕). o.hard: 이 각보다 크게 꺾이면 날카로운 모서리. o.ur: u 반지름
  function lathe(g, prof, seg, o = {}) {
    const a0 = o.a0 ?? 0, a1 = o.a1 ?? TAU, n = prof.length, hard = Math.cos(o.hard ?? 0.55), k = o.k ?? 1;
    const sn = [];   // 윤곽 조각의 법선 (r,y)
    for (let i = 0; i < n - 1; i++) { const dr = prof[i + 1][0] - prof[i][0], dy = prof[i + 1][1] - prof[i][1], l = Math.hypot(dr, dy) || 1; sn.push([dy / l, -dr / l]); }
    const S = [0]; for (let i = 1; i < n; i++) S.push(S[i - 1] + Math.hypot(prof[i][0] - prof[i - 1][0], prof[i][1] - prof[i - 1][1]));
    const vn = (i, s) => { // 조각 s의 끝점 i에서의 법선
      const m = sn[s], q = i === s ? sn[s - 1] : sn[s + 1];
      if (q && m[0] * q[0] + m[1] * q[1] > hard) { const x = m[0] + q[0], y = m[1] + q[1], l = Math.hypot(x, y) || 1; return [x / l, y / l]; }
      return m;
    };
    if (!g.u) g.u = new Array(g.p.length / 3 * 2).fill(0);
    g.vy = o.v !== 's';
    for (let s = 0; s < n - 1; s++) {
      const A = prof[s], Bp = prof[s + 1], nA = vn(s, s), nB = vn(s + 1, s);
      if (Math.hypot(A[0] - Bp[0], A[1] - Bp[1]) < 1e-6) continue;
      for (let j = 0; j < seg; j++) {
        const t0 = a0 + (a1 - a0) * j / seg, t1 = a0 + (a1 - a0) * (j + 1) / seg;
        const s0 = Math.sin(t0), c0 = Math.cos(t0), s1 = Math.sin(t1), c1 = Math.cos(t1);
        const P = (p, sx, cx) => [p[0] * sx, p[1], p[0] * cx], N = (m, sx, cx) => [m[0] * sx, m[1], m[0] * cx];
        const U = (p, t, sv) => [t * (o.ur ?? Math.max(p[0], 0.05)), o.v === 's' ? (o.s0 ?? 0) + (o.flip ? S[n - 1] - sv : sv) : p[1]];
        const p00 = P(A, s0, c0), p01 = P(A, s1, c1), p10 = P(Bp, s0, c0), p11 = P(Bp, s1, c1);
        const n00 = N(nA, s0, c0), n01 = N(nA, s1, c1), n10 = N(nB, s0, c0), n11 = N(nB, s1, c1);
        const u00 = U(A, t0, S[s]), u01 = U(A, t1, S[s]), u10 = U(Bp, t0, S[s + 1]), u11 = U(Bp, t1, S[s + 1]);
        g.triN(p00, p01, p11, n00, n01, n11, u00, u01, u11, k);
        g.triN(p00, p11, p10, n00, n11, n10, u00, u11, u10, k);
      }
    }
    return g;
  }

  // ---------- 아치 ----------
  // 아치 곡선 (THREE.Path + absarc): 폭 w(빛), 스프링 높이 ys, 종류 k (0 반원, 1 정삼각 뾰족, 1.3~1.6 란셋, 0.62 납작 튜더), d 바깥으로 넓히기.
  // 오른쪽 스프링에서 꼭대기를 지나 왼쪽 스프링까지의 점들 (반시계)
  function archRise(w, k, d = 0) {
    if (!k) return w / 2 + d;
    const R = k * w, c = w / 2 - R, Rr = R + d;
    return Math.sqrt(Math.max(0, Rr * Rr - c * c));
  }
  function archCurve(w, ys, k, d = 0, div = 3, cx = 0) {
    const s = new THREE.Path(), hw = w / 2 + d;
    s.moveTo(cx + hw, ys);
    if (!k) { s.absarc(cx, ys, hw, 0, PI, false); return dedupe(s.getPoints(div * 2).map(v => [v.x, v.y])); }
    const R = k * w, c = w / 2 - R, Rr = R + d, a = Math.acos(cl(-c / Rr, -1, 1));
    s.absarc(cx + c, ys, Rr, 0, a, false);
    s.absarc(cx - c, ys, Rr, PI - a, PI, false);
    return dedupe(s.getPoints(div).map(v => [v.x, v.y]));
  }
  // 열린 아치 모양 (창·문 구멍): 아래 y0부터
  function archOpening(w, y0, ys, k, d = 0, div = 3, cx = 0) { return dedupe([[cx - w / 2 - d, y0], [cx + w / 2 + d, y0], ...archCurve(w, ys, k, d, div, cx)]); }
  // 아치 띠 (U자: 바닥 y0에서 올라가 아치를 돌아 내려온다), 안쪽 d0, 바깥 d1
  function archBand(w, y0, ys, k, d0, d1, div = 3, cx = 0) {
    const o = archCurve(w, ys, k, d1, div, cx), i = archCurve(w, ys, k, d0, div, cx).reverse();
    return dedupe([[cx + w / 2 + d1, y0], ...o, [cx - w / 2 - d1, y0], [cx - w / 2 - d0, y0], ...i, [cx + w / 2 + d0, y0]]);
  }
  function circle(cx, cy, r, n, a0 = 0) { const o = []; for (let i = 0; i < n; i++) { const a = a0 + i / n * TAU; o.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return o; }
  // 네잎 (동그라미 넷이 겹친 꼴) — 중심 cx,cy, 바깥 반지름 r
  function quatrefoil(cx, cy, r, n = 28) { const o = []; for (let i = 0; i < n; i++) { const a = i / n * TAU + PI / 4; const rr = r * (0.68 + 0.32 * Math.abs(Math.cos(2 * a))); o.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); } return o; }
  // x에서 아치 윗변 높이 (포르쿨리스 자르기 등)
  function archY(w, ys, k, x) {
    x = Math.abs(x); if (x > w / 2) return ys;
    if (!k) return ys + Math.sqrt(Math.max(0, w * w / 4 - x * x));
    const R = k * w, c = w / 2 - R; // x>0 쪽 호의 중심은 (c, ys)
    return ys + Math.sqrt(Math.max(0, R * R - (x - c) * (x - c)));
  }

  // ---------- 틀 (위치 + y축 회전) ----------
  function frame(x, z, rot = 0, y = 0) { return { x, y, z, rot, c: Math.cos(rot), s: Math.sin(rot) }; }
  function sub(F, lx, lz, lrot = 0, ly = 0) { return frame(F.x + lx * F.c + lz * F.s, F.z - lx * F.s + lz * F.c, F.rot + lrot, F.y + ly); }
  function wp(F, lx, ly, lz) { return [F.x + lx * F.c + lz * F.s, F.y + ly, F.z - lx * F.s + lz * F.c]; }

  // =====================================================================
  // 짓는 이
  // =====================================================================
  class Builder extends Batch {
    constructor(o = {}) {
      super(o);
      this.seed = o.seed ?? 1;
      this.R = rng((this.seed * 7919 + 13) >>> 0);
      this.ground = o.ground || (() => 0);
      this.detail = o.detail ?? 1;
      this.hi = this.detail >= 1;
      this.div = this.hi ? 3 : 2;
      this.segK = this.hi ? 1 : 0.5;
      this.litFrac = o.lit ?? 0.4;
      this.chamfer = o.chamfer ?? 0.04;
    }
    rnd(a = 0, b = 1) { return a + (b - a) * this.R(); }
    seg(n) { return Math.max(4, Math.round(n * this.segK)); }
    // 형상 버퍼를 틀 F에 놓아 통에 넣는다. o.col: 수 | [r,g,b], o.jit: 밝기 흔들기 (기본 ±5%)
    put(key, g, F, o = {}) {
      const n = g.p.length / 3; if (!n) return this;
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = new Float32Array(n * 3);
      const c = F.c, s = F.s, P = g.p, N = g.n, U = g.u, K = g.c;
      let cr = 1, cg = 1, cb = 1;
      if (o.col !== undefined) { if (Array.isArray(o.col)) [cr, cg, cb] = o.col; else cr = cg = cb = o.col; }
      const j = o.jit === false ? 1 : 1 + (this.R() - 0.5) * (o.jit ?? 0.1);
      const wt = o.jit === false ? 0 : (this.R() - 0.5) * 0.04;   // 따뜻함 흔들기
      cr *= j * (1 + wt); cg *= j; cb *= j * (1 - wt);
      for (let i = 0; i < n; i++) {
        const lx = P[i * 3], ly = P[i * 3 + 1], lz = P[i * 3 + 2];
        const x = F.x + lx * c + lz * s, y = F.y + ly, z = F.z - lx * s + lz * c;
        const mx = N[i * 3], my = N[i * 3 + 1], mz = N[i * 3 + 2];
        const nx = mx * c + mz * s, nz = -mx * s + mz * c;
        pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
        nor[i * 3] = nx; nor[i * 3 + 1] = my; nor[i * 3 + 2] = nz;
        if (U && !o.worldUV) { uv[i * 2] = U[i * 2] + (o.u0 || 0); uv[i * 2 + 1] = U[i * 2 + 1] + (g.vy ? F.y : 0); }
        else if (Math.abs(my) > 0.72) { uv[i * 2] = x; uv[i * 2 + 1] = -z; }
        else { const h = Math.hypot(nx, nz) || 1; uv[i * 2] = (x * nz - z * nx) / h; uv[i * 2 + 1] = y; }
        const k = K[i];
        col[i * 3] = cr * k; col[i * 3 + 1] = cg * k; col[i * 3 + 2] = cb * k;
      }
      let list = this.buckets.get(key);
      if (!list) this.buckets.set(key, list = []);
      list.push({ pos, nor, uv, col });
      return this;
    }
    // 자주 쓰는 것들 (틀 F 기준)
    box(key, F, cx, y0, cz, sx, sy, sz, o = {}) {
      const g = cbox(new GB(), 0, 0, 0, sx, sy, sz, o.ch ?? this.chamfer, o.k ?? 1);
      return this.put(key, g, o.rot ? sub(F, cx, cz, o.rot, y0) : sub(F, cx, cz, 0, y0), o);
    }
    // 벽면(XY)의 윤곽을 z0..z1로 밀어낸 것
    slab(key, F, outer, holes, z0, z1, o = {}) { return this.put(key, prism(new GB(), outer, holes, z0, z1, Object.assign({ ch: this.chamfer }, o)), F, o); }
    // 옆모습 [[z,y]...]을 x0..x1로 밀어낸 것 (몰딩, 창턱, 버팀벽)
    profX(key, F, prof, x0, x1, o = {}) {
      const t = prism(new GB(), prof.map(p => [-p[0], p[1]]), (o.holes || []).map(h => h.map(p => [-p[0], p[1]])), x0, x1, Object.assign({ ch: this.chamfer, chB: o.chB ?? (o.ch ?? this.chamfer) }, o));
      return this.put(key, new GB().append(t, MAP_ZY), F, o);
    }
    // 평면 [[x,z]...]을 y0..y1로 밀어낸 것
    plan(key, F, pts, y0, y1, o = {}) {
      const t = prism(new GB(), pts.map(p => [p[0], -p[1]]), (o.holes || []).map(h => h.map(p => [p[0], -p[1]])), y0, y1, Object.assign({ ch: this.chamfer, chB: o.chB ?? 0 }, o));
      return this.put(key, new GB().append(t, MAP_XZ), F, o);
    }
    turn(key, F, prof, seg, o = {}) { return this.put(key, lathe(new GB(), prof, this.seg(seg), o), F, o); }
    // 땅: 틀 F의 로컬 점들 중 가장 낮은 땅
    gmin(F, pts) { let m = 1e9; for (const [lx, lz] of pts) { const [x, , z] = wp(F, lx, 0, lz); m = Math.min(m, this.ground(x, z)); } return m; }
    gmax(F, pts) { let m = -1e9; for (const [lx, lz] of pts) { const [x, , z] = wp(F, lx, 0, lz); m = Math.max(m, this.ground(x, z)); } return m; }
    lineG(F, x0, x1, z0, z1, f = Math.min) { const pts = [], n = Math.max(2, Math.ceil((x1 - x0) / 2.5)); for (let i = 0; i <= n; i++) for (const z of [z0, z1]) pts.push([lp(x0, x1, i / n), z]); return f === Math.min ? this.gmin(F, pts) : this.gmax(F, pts); }
    stoneKey(era) { return ERA[era] || 'stone'; }
  }
