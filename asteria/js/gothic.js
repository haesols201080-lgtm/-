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
  const BP = Builder.prototype;

  // =====================================================================
  // 창
  // =====================================================================
  const WIN = {
    lancet: { w: 1.3, h: 4.8, k: 1.5, m: 0.24, orders: 1 },
    pointed: { w: 2.0, h: 5.4, k: 1.0, m: 0.26, orders: 2, n: 2, kl: 1.0, foil: 'quatre' },
    paired: { w: 2.4, h: 6.4, k: 1.0, m: 0.3, orders: 2, n: 2, kl: 1.4, foil: 'ring' },
    triple: { w: 3.4, h: 7.8, k: 1.0, m: 0.32, orders: 2, n: 3, kl: 1.2, foil: 'ring' },
    round: { w: 1.0, h: 2.5, k: 0, m: 0.36, orders: 2 },
    roundPair: { w: 1.9, h: 3.1, k: 0, m: 0.32, orders: 2, n: 2, kl: 0, foil: 'ring' },
    square: { w: 1.7, h: 2.1, k: -1, m: 0.18, orders: 1 },
    slit: { w: 0.16, h: 1.4, k: 1.2, m: 0.2, orders: 1 },
    oculus: { w: 1.4, h: 1.4, k: -2, m: 0.22, orders: 1 },
  };
  // 불빛 세기 (해 질 녘 30~50%만, 세기 ±30%, 색은 #FFB866..#FF9A4A)
  BP._lit = function (sp) {
    const lit = sp.lit !== undefined ? sp.lit : (this.R() < (sp.litFrac ?? this.litFrac) ? 0.62 + this.R() * 0.66 : 0);
    const t = this.R();
    return { lit, col: [lit * 1.0, lit * (0.9 - 0.12 * t), lit * (0.78 - 0.3 * t)] };
  };
  // 유리 한 장 (앞면만)
  BP._glass = function (F, poly, zg, L, key) {
    const g = prism(new GB(), poly, null, zg - 0.02, zg, { ch: 0, sides: false, back: false });
    if (L.lit > 0) this.put(key || 'glassLit', g, F, { col: L.col, jit: 0.16 });
    else this.put(key || 'glassDark', g, F, { jit: 0.12 });
  };
  // 철 띠 (가로 막대)
  BP._bars = function (F, x0, x1, y0, y1, z, step = 0.62) {
    if (!this.hi) return;
    for (let y = y0 + step * 0.8; y < y1 - 0.15; y += step) this.box('iron', F, (x0 + x1) / 2, y, z, x1 - x0, 0.03, 0.03, { ch: 0, jit: false });
  };
  // 플레이트 트레이서리: 감싸는 아치 아래 n칸, 위에 원창. 원창의 자리는 수치로 찾는다
  BP._tracery = function (F, x, ys, spY, w, k, n, kl, zg, foil) {
    const div = this.div, mw = 0.15, e = 0.05, wl = (w - 2 * e - (n - 1) * mw) / n, z0 = zg - 0.06, z1 = zg + 0.14;
    const P = [[x + w / 2, spY], ...archCurve(w, spY, k, 0, div, x)], heads = [];
    for (let i = 0; i < n; i++) { const lc = x - w / 2 + e + wl / 2 + i * (wl + mw), c = archCurve(wl, spY, kl, 0, div, lc); heads.push(c); P.push(...c.slice().reverse()); }
    // 원창: 판 안에서 가장 큰 원
    const segs = []; const addS = pts => { for (let i = 0; i < pts.length - 1; i++) segs.push([pts[i], pts[i + 1]]); };
    addS(archCurve(w, spY, k, 0, div * 2, x)); heads.forEach((h, i) => addS(archCurve(wl, spY, kl, 0, div * 2, x - w / 2 + e + wl / 2 + i * (wl + mw))));
    const sd = (px, py) => { let m = 1e9; for (const [a, b] of segs) { const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy, t = l2 ? cl(((px - a[0]) * dx + (py - a[1]) * dy) / l2, 0, 1) : 0; m = Math.min(m, Math.hypot(px - a[0] - dx * t, py - a[1] - dy * t)); } return m; };
    const top = spY + archRise(w, k); let best = 0, by = 0;
    for (let i = 1; i < 24; i++) { const py = lp(spY, top, i / 24); if (py < spY + archRise(wl, kl) * (n % 2 ? 1 : 0.2)) continue; const r = sd(x, py); if (r > best) { best = r; by = py; } }
    const holes = [];
    const ro = Math.min(best - 0.07, w * 0.22);
    if (ro > 0.12) holes.push(foil === 'quatre' ? quatrefoil(x, by, ro, this.hi ? 28 : 16) : circle(x, by, ro, this.hi ? 24 : 14));
    this.slab('stoneTrim', F, P, holes, z0, z1, { ch: 0.03, back: false, rk: 0.85 });
    // 원창 안의 동심원 고리와 살 (공명)
    if (ro > 0.2 && foil === 'ring') {
      this.slab('stoneTrim', F, circle(x, by, ro * 0.56, 18), [circle(x, by, ro * 0.42, 18)], z0 + 0.03, z1 - 0.02, { ch: 0.02, back: false });
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + PI / 2, c = Math.cos(a), s = Math.sin(a), t = 0.035; const r0 = ro * 0.5, r1 = ro + 0.03; this.slab('stoneTrim', F, [[x + c * r0 - s * t, by + s * r0 + c * t], [x + c * r0 + s * t, by + s * r0 - c * t], [x + c * r1 + s * t, by + s * r1 - c * t], [x + c * r1 - s * t, by + s * r1 + c * t]], null, z0 + 0.03, z1 - 0.03, { ch: 0.01, back: false }); }
    }
    // 중간 기둥 (멀리언)
    for (let i = 1; i < n; i++) {
      const mx = x - w / 2 + e + i * (wl + mw) - mw / 2;
      if (!kl && this.hi) { this.turn('stoneTrim', sub(F, mx, zg + 0.04), [[0.11, ys], [0.08, ys + 0.14], [0.075, spY - 0.2], [0.12, spY - 0.06], [0.12, spY + 0.02]], 8); }
      else this.box('stoneTrim', F, mx, ys, zg + 0.04, mw, spY - ys + 0.02, 0.2, { ch: 0.03 });
    }
    for (let i = 0; i < n; i++) { const lc = x - w / 2 + e + wl / 2 + i * (wl + mw); this._bars(F, lc - wl / 2, lc + wl / 2, ys, spY, zg + 0.015); }
  };
  // 창 하나: 벽 틀 F(로컬 x는 벽을 따라, y는 세계 높이, 바깥면 z = T/2). 벽에 뚫을 구멍을 돌려준다
  BP._win = function (F, x, ys, T, sp = {}) {
    const type = WIN[sp.type] ? sp.type : 'lancet', D = WIN[type];
    const w = sp.w ?? D.w, h = sp.h ?? D.h, k = sp.k ?? D.k, m = sp.m ?? D.m, div = this.div, zf = T / 2;
    const q = cl((T - 0.1) / 1.1, 0.35, 1), L = this._lit(sp);
    const orders = sp.orders ?? D.orders, r0 = 0.18 * q, step = 0.16 * q, gb = 0.24 * q;
    let hole, top, zg, area;
    if (type === 'oculus' || type === 'rose') {
      const R = w / 2, cy = ys + R;
      hole = circle(x, cy, R + m, this.hi ? 32 : 20);
      for (let i = 0; i < orders; i++) { const d1 = m * (orders - i) / orders, d0 = m * (orders - i - 1) / orders, z1 = zf - r0 - i * step; this.slab('stoneTrim', F, circle(x, cy, R + d1, this.hi ? 32 : 20), [circle(x, cy, R + d0, this.hi ? 32 : 20)], z1 - 0.3 * q, z1, { ch: 0.03, back: false, rk: 0.8 }); }
      zg = zf - r0 - (orders - 1) * step - gb;
      this._glass(F, circle(x, cy, R + 0.01, this.hi ? 28 : 16), zg, L);
      if (R > 0.4) {
        this.slab('stoneTrim', F, circle(x, cy, R * 0.5, 18), [circle(x, cy, R * 0.38, 18)], zg - 0.05, zg + 0.1, { ch: 0.02, back: false });
        for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, c = Math.cos(a), s = Math.sin(a), t = 0.035; this.slab('stoneTrim', F, [[x + c * R * 0.45 - s * t, cy + s * R * 0.45 + c * t], [x + c * R * 0.45 + s * t, cy + s * R * 0.45 - c * t], [x + c * (R + 0.02) + s * t, cy + s * (R + 0.02) - c * t], [x + c * (R + 0.02) - s * t, cy + s * (R + 0.02) + c * t]], null, zg - 0.04, zg + 0.08, { ch: 0.01, back: false }); }
      }
      this.slab('stoneTrim', F, circle(x, cy, R + m + 0.22, this.hi ? 32 : 20), [circle(x, cy, R + m + 0.07, this.hi ? 32 : 20)], zf - 0.05, zf + 0.12, { ch: 0.035, back: false });
      top = cy + R + m + 0.22; area = [w, w]; ys = cy - R;
    } else if (type === 'square') {
      const W = w + 2 * m, yt = ys + h;
      hole = [[x - W / 2, ys], [x + W / 2, ys], [x + W / 2, yt + m], [x - W / 2, yt + m]];
      const z1 = zf - r0;
      this.slab('stoneTrim', F, [[x + W / 2, ys], [x + W / 2, yt + m], [x - W / 2, yt + m], [x - W / 2, ys], [x - w / 2, ys], [x - w / 2, yt], [x + w / 2, yt], [x + w / 2, ys]], null, z1 - 0.3 * q, z1, { ch: 0.03, back: false, rk: 0.8 });
      zg = z1 - gb;
      this._glass(F, [[x - w / 2, ys], [x + w / 2, ys], [x + w / 2, yt], [x - w / 2, yt]], zg, L);
      if (w > 1.1) this.box('stoneTrim', F, x, ys, zg + 0.04, 0.13, h, 0.18, { ch: 0.03 });
      this.box('stoneTrim', F, x, ys + h * 0.64, zg + 0.04, w, 0.12, 0.18, { ch: 0.03 });
      this._bars(F, x - w / 2, x + w / 2, ys, ys + h * 0.62, zg + 0.015, 0.45);
      // 네모 물끊기 (꺾여 내려오는 label)
      this.box('stoneTrim', F, x, yt + m + 0.05, zf + 0.04, W + 0.5, 0.17, 0.2, { ch: 0.035 });
      for (const s of [-1, 1]) this.box('stoneTrim', F, x + s * (W / 2 + 0.17), yt + m - 0.36, zf + 0.04, 0.16, 0.42, 0.2, { ch: 0.03 });
      top = yt + m + 0.22; area = [w, h];
    } else {
      const rise = archRise(w, k), spY = ys + h - rise;
      hole = archOpening(w, ys, spY, k, m, div, x);
      for (let i = 0; i < orders; i++) {
        const d1 = m * (orders - i) / orders, d0 = m * (orders - i - 1) / orders, z1 = zf - r0 - i * step;
        this.slab(i % 2 ? 'stoneTrim' : (sp.era === 'early' ? 'stoneEarly' : 'stoneTrim'), F, archBand(w, ys, spY, k, d0, d1, div, x), null, z1 - 0.3 * q, z1, { ch: 0.035, back: false, rk: 0.78 });
      }
      zg = zf - r0 - (orders - 1) * step - gb;
      const n = sp.n ?? D.n ?? 1;
      if (n > 1 && w > 0.9) {
        this._glass(F, archOpening(w, ys, spY, k, 0.01, div, x), zg, L);
        this._tracery(F, x, ys, spY, w, k, n, sp.kl ?? D.kl ?? 1, zg, sp.foil ?? D.foil);
      } else {
        this._glass(F, archOpening(w, ys, spY, k, 0.01, div, x), zg, L);
        if (type !== 'slit') this._bars(F, x - w / 2, x + w / 2, ys, spY, zg + 0.015);
      }
      // 물끊기 (아치를 따라 도는 띠 + 끝돌)
      if (type !== 'slit') {
        const hb = Math.min(0.3, rise * 0.3), a = m + 0.07, b = m + (sp.era === 'early' ? 0.17 : 0.22);
        this.slab('stoneTrim', F, archBand(w, spY - hb, spY, k, a, b, div, x), null, zf - 0.05, zf + 0.12, { ch: 0.035, back: false });
        if (this.hi) for (const s of [-1, 1]) this.box('stoneTrim', F, x + s * (w / 2 + (a + b) / 2 + 0.09), spY - hb - 0.15, zf + 0.03, 0.36, 0.17, 0.2, { ch: 0.03 });
        top = spY + archRise(w, k, b);
      } else top = spY + archRise(w, k, m);
      area = [w, h];
    }
    // 창턱 (바깥으로 기운 윗면)
    if (type !== 'oculus' && type !== 'rose') {
      const W = w + 2 * m, zb = zg - 0.03;
      this.profX('stoneTrim', F, [[zb, ys - 0.2], [zf + 0.13, ys - 0.2], [zf + 0.13, ys - 0.09], [zb, ys + 0.03]], x - W / 2 - 0.13, x + W / 2 + 0.13, { ch: 0.03, back: true });
    }
    const [wx, wy, wz] = wp(F, x, ys + area[1] / 2, zg);
    this.mark({ kind: 'window', x: wx, y: wy, z: wz, nx: F.s, nz: F.c, w: area[0], h: area[1], lit: L.lit });
    return { hole, top, zg };
  };
  // 공개: 벽 구멍 없이 창 조립만 (x,z = 바깥면 위 창 가운데, rot = 벽 방향, y = 창턱 높이)
  BP.window = function (x, y, z, rot, sp = {}, o = {}) {
    const T = o.thick ?? 1.2, F = sub(frame(x, z, rot), 0, -T / 2);
    return this._win(F, 0, y, T, sp);
  };

  // ---------- 장미창 (동심원 고리, 열두 살, 열두 작은 원) ----------
  BP.rose = function (F, cx, cy, R, o = {}) {
    const T = o.T ?? 1.2, zf = T / 2, n = this.hi ? 48 : 28, L = this._lit(o), div = n;
    const hole = circle(cx, cy, R + 0.42, n);
    this.slab('stoneTrim', F, circle(cx, cy, R + 0.42, n), [circle(cx, cy, R + 0.2, n)], zf - 0.42, zf - 0.12, { ch: 0.04, back: false, rk: 0.8 });
    this.slab('stoneTrim', F, circle(cx, cy, R + 0.2, n), [circle(cx, cy, R, n)], zf - 0.62, zf - 0.3, { ch: 0.04, back: false, rk: 0.78 });
    this.slab('stoneTrim', F, circle(cx, cy, R + 0.72, n), [circle(cx, cy, R + 0.52, n)], zf - 0.05, zf + 0.14, { ch: 0.04, back: false });
    const zg = zf - 0.72, z0 = zg - 0.06, z1 = zg + 0.14;
    // 유리: 가운데 호박색, 가운데 띠 쪽빛/붉은빛, 바깥 띠 번갈아
    const pal = [[1.5, 1.05, 0.45], [0.55, 0.75, 1.6], [1.5, 0.55, 0.5], [0.75, 1.3, 0.85], [1.3, 1.1, 0.6]];
    const sector = (r0, r1, a0, a1) => { const P = [], m = 4; for (let i = 0; i <= m; i++) P.push([cx + Math.cos(lp(a0, a1, i / m)) * r1, cy + Math.sin(lp(a0, a1, i / m)) * r1]); for (let i = m; i >= 0; i--) P.push([cx + Math.cos(lp(a0, a1, i / m)) * r0, cy + Math.sin(lp(a0, a1, i / m)) * r0]); return P; };
    const gput = (poly, c) => { const g = prism(new GB(), poly, null, zg - 0.02, zg, { ch: 0, sides: false, back: false }); if (L.lit > 0) this.put('glassLit', g, F, { col: [c[0] * L.lit * 0.8, c[1] * L.lit * 0.8, c[2] * L.lit * 0.8], jit: 0.1 }); else this.put('glassStained', g, F, { col: c, jit: 0.1 }); };
    gput(circle(cx, cy, R * 0.3, 20), pal[0]);
    for (let i = 0; i < 12; i++) { const a0 = i / 12 * TAU, a1 = (i + 1) / 12 * TAU; gput(sector(R * 0.29, R * 0.63, a0, a1), pal[1 + (i % 2)]); gput(sector(R * 0.62, R + 0.02, a0, a1), pal[i % 2 ? 3 : 4]); }
    // 돌 창살
    const ring = (r0, r1, zz0 = z0, zz1 = z1) => this.slab('stoneTrim', F, circle(cx, cy, r1, n), [circle(cx, cy, r0, n)], zz0, zz1, { ch: 0.025, back: false });
    ring(R * 0.94, R + 0.05); ring(R * 0.58, R * 0.66); ring(R * 0.21, R * 0.3);
    const spoke = (a, r0, r1, t) => { const c = Math.cos(a), s = Math.sin(a); this.slab('stoneTrim', F, [[cx + c * r0 - s * t, cy + s * r0 + c * t], [cx + c * r0 + s * t, cy + s * r0 - c * t], [cx + c * r1 + s * t, cy + s * r1 - c * t], [cx + c * r1 - s * t, cy + s * r1 + c * t]], null, z0, z1 - 0.02, { ch: 0.015, back: false }); };
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; spoke(a, R * 0.28, R * 0.6, 0.05); spoke(a + PI / 12, R * 0.64, R * 0.96, 0.045); }
    // 바깥 띠의 작은 원 열둘 (열두 기관)
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, px = cx + Math.cos(a) * R * 0.8, py = cy + Math.sin(a) * R * 0.8, rr = R * 0.105; this.slab('stoneTrim', F, circle(px, py, rr + 0.045, 14), [circle(px, py, rr, 14)], z0 + 0.02, z1, { ch: 0.012, back: false }); }
    // 가운데 황동 고리
    this.slab('brass', F, circle(cx, cy, R * 0.2, 20), [circle(cx, cy, R * 0.13, 20)], zg, z1 + 0.03, { ch: 0.01, back: false });
    this.slab('brass', F, circle(cx, cy, R * 0.06, 12), null, zg, z1 + 0.05, { ch: 0.01, back: false });
    const [wx, wy, wz] = wp(F, cx, cy, zg);
    this.mark({ kind: 'window', x: wx, y: wy, z: wz, nx: F.s, nz: F.c, w: 2 * R, h: 2 * R, lit: L.lit, rose: true });
    return { hole, top: cy + R + 0.72 };
  };

  // =====================================================================
  // 문 (벽 틀 F 안, at = 로컬 x, y = 문턱 높이). 여러 겹 물러나는 아치 + 작은 기둥 + 고리 쐐기돌 + 참나무 문짝
  // =====================================================================
  BP._door = function (F, at, y, T, d = {}) {
    const w = d.w ?? 2.6, h = d.h ?? 4.6, k = d.k ?? (d.era === 'early' ? 0 : 1), orders = d.orders ?? 3, div = this.div + 1, zf = T / 2;
    const rise = archRise(w, k), spY = y + h - rise, step = Math.min(0.28, (T - 0.35) / orders), ow = 0.3;
    const M = orders * ow;
    const notch = { x0: at - w / 2 - M, x1: at + w / 2 + M, path: [[at - w / 2 - M, spY], ...archCurve(w, spY, k, M, div, at).reverse(), [at + w / 2 + M, spY]], y };
    for (let i = 0; i < orders; i++) {
      const d1 = ow * (orders - i), d0 = ow * (orders - i - 1), z1 = zf - 0.03 - i * step;
      this.slab(i % 2 ? 'stone' : 'stoneTrim', F, archBand(w, y, spY, k, d0, d1, div, at), null, -T / 2, z1, { ch: 0.05, back: false, rk: 0.8 });
      // 구석의 작은 기둥 (밑동, 몸, 머리)
      if (i > 0 && this.hi) for (const s of [-1, 1]) {
        const cx = at + s * (w / 2 + d1 + 0.02), cz = zf - 0.03 - i * step + 0.11;
        this.turn('stoneTrim', sub(F, cx, cz), [[0.15, y], [0.15, y + 0.25], [0.1, y + 0.36], [0.085, y + 0.42], [0.085, spY - 0.45], [0.1, spY - 0.38], [0.16, spY - 0.16], [0.16, spY]], 8);
      }
    }
    // 고리 쐐기돌 (열두 눈금 룬 고리)
    const ap = spY + archRise(w, k, M);
    this.box('stoneTrim', F, at, ap - 0.55, zf - 0.02, 0.62, 0.8, 0.3, { ch: 0.05 });
    this.slab('brass', F, circle(at, ap - 0.17, 0.2, 18), [circle(at, ap - 0.17, 0.14, 18)], zf + 0.27, zf + 0.31, { ch: 0.008, back: false });
    if (this.hi) for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, c = Math.cos(a), s = Math.sin(a), px = at + c * 0.24, py = ap - 0.17 + s * 0.24, t = 0.012; this.slab('brass', F, [[px - s * t, py + c * t], [px + s * t, py - c * t], [px + c * 0.05 + s * t, py + s * 0.05 - c * t], [px + c * 0.05 - s * t, py + s * 0.05 + c * t]], null, zf + 0.27, zf + 0.3, { ch: 0, back: false }); }
    // 문턱과 계단
    const zd = zf - 0.03 - (orders - 1) * step - 0.25;
    this.box('stoneTrim', F, at, y - 0.3, (zd + zf + 0.7) / 2, w + 2 * M + 0.4, 0.32, zf + 0.7 - zd, { ch: 0.04 });
    const [gx, , gz] = wp(F, at, 0, zf + 1.2), gy = this.ground(gx, gz);
    for (let i = 1; y - i * 0.17 > gy - 0.05 && i < 12; i++) this.box('stoneTrim', F, at, gy - 0.4, zf + 0.7 + i * 0.32 - 0.16, w + 2 * M + 0.4 + i * 0.2, y - i * 0.17 - gy + 0.4, 0.34, { ch: 0.035 });
    // 문짝
    const lv = d.leaves ?? 'closed';
    if (lv !== 'none') this._leaves(F, at, y, spY, w, k, zd, lv);
    if (d.lantern !== false) for (const s of [-1, 1]) { const [lx, ly, lz] = wp(F, at + s * (w / 2 + M + 0.75), y + Math.min(3.4, h * 0.72), zf); this.lantern(lx, ly, lz, F.rot, {}); }
    const [mx, my, mz] = wp(F, at, y, zf);
    this.mark({ kind: 'door', x: mx, y: my, z: mz, rot: F.rot, w, h });
    return notch;
  };
  // 참나무 문짝 두 짝 (closed: 닫힘, open: 안으로 열림), 철 띠와 징, 고리 손잡이
  BP._leaves = function (F, at, y, spY, w, k, zd, mode) {
    const div = this.div + 1, cur = archCurve(w - 0.02, spY, k, 0, div, 0);
    for (const s of [-1, 1]) {
      // 경첩 틀 G: 로컬 x = 0(경첩) → -s*w/2 쪽이 가운데. 위 줄은 가운데(꼭대기)에서 경첩 쪽으로
      const xs = -s, top = cur.filter(p => p[0] * s >= -1e-4).map(p => [w / 2 - p[0] * s, p[1]]).sort((a, b) => b[0] - a[0]);
      const P = dedupe([[0, y], [w / 2 - 0.01, y], ...top, [0, spY]]).map(p => [p[0] * xs, p[1]]);
      const G = sub(F, at + s * (w / 2), zd, mode === 'open' ? -s * (HP - 0.3) : 0);
      this.slab('oak', G, P, null, -0.07, 0.07, { ch: 0.02, chB: 0.02 });
      if (!this.hi) continue;
      for (let i = 0; i < 5; i++) { const px = (w / 2) * (i + 0.5) / 5, ph = archY(w, spY, k, w / 2 - px) - y; this.box('oak', G, px * xs, y + 0.05, 0.075, w / 10 - 0.025, ph - 0.12, 0.03, { ch: 0.01 }); }
      for (const t of [0.12, 0.5, 0.84]) {
        const yy = y + (spY - y) * t;
        this.box('iron', G, (w / 4 - 0.02) * xs, yy, 0.1, w / 2 - 0.12, 0.09, 0.025, { ch: 0.005 });
        for (let j = 0; j < 4; j++) this.box('iron', G, (0.15 + j * (w / 2 - 0.3) / 3) * xs, yy + 0.025, 0.115, 0.04, 0.04, 0.02, { ch: 0 });
      }
      this.box('iron', G, (w / 2 - 0.25) * xs, y + 1.0, 0.12, 0.05, 0.16, 0.06, { ch: 0 });
      this.box('iron', G, (w / 2 - 0.25) * xs, y + 0.9, 0.14, 0.16, 0.03, 0.03, { ch: 0 });
    }
  };

  // =====================================================================
  // 작은 것들: 등불, 첨탑, 굴뚝
  // =====================================================================
  BP.lantern = function (x, y, z, rot = 0, o = {}) {
    const F = frame(x, z, rot, 0), arm = o.post ? 0 : (o.arm ?? 0.62);
    if (o.post) {
      const gy = this.ground(x, z), base = o.base ?? gy;
      this.box('stoneTrim', F, 0, base - 0.3, 0, 0.5, 0.75, 0.5, { ch: 0.05 });
      this.turn('iron', F, [[0.08, base + 0.4], [0.06, base + 0.6], [0.045, y - 0.35], [0.07, y - 0.3]], 8);
    } else {
      this.box('iron', F, 0, y + 0.24, arm / 2, 0.05, 0.05, arm, { ch: 0 });
      this.box('iron', F, 0, y - 0.25, 0.05, 0.12, 0.3, 0.1, { ch: 0.01 });
      if (this.hi) for (let i = 1; i < 4; i++) this.box('iron', F, 0, y + 0.24 - i * 0.12, i * 0.12, 0.03, 0.03, 0.03, { ch: 0 });
    }
    const L = sub(F, 0, arm), hb = o.post ? -0.3 : -0.18;
    this.box('iron', L, 0, y + hb, 0, 0.26, 0.05, 0.26, { ch: 0.01 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.box('iron', L, sx * 0.12, y + hb, sz * 0.12, 0.025, 0.4, 0.025, { ch: 0 });
    this.turn('iron', L, [[0.2, y + hb + 0.4], [0.03, y + hb + 0.62], [0.035, y + hb + 0.7], [0, y + hb + 0.72]], 4, { a0: PI / 4 });
    this.box('glow', L, 0, y + hb + 0.06, 0, 0.21, 0.32, 0.21, { ch: 0, col: 1.6, jit: 0.1 });
    const [lx, ly, lz] = wp(L, 0, y + hb + 0.22, 0);
    this.light({ x: lx, y: ly, z: lz, c: 0xffb060, k: o.k ?? 1.3, d: o.d ?? 11, flicker: true });
  };
  // 첨탑 (돌): 네모 몸 + 박공 넷 + 네모뿔 + 작은 꽃봉오리. tuning이면 소리굽쇠 쌍첨탑
  BP._pinnacle = function (F, lx, y0, lz, o = {}) {
    const s = o.s ?? 0.7, h = o.h ?? 4.2, key = o.key ?? 'stoneTrim', P = sub(F, lx, lz, o.rot ?? 0);
    if (o.tuning) {
      this.box(key, P, 0, y0, 0, s, 0.5, s, { ch: 0.04 });
      this.box(key, P, 0, y0 + 0.5, 0, s * 0.42, h * 0.22, s * 0.42, { ch: 0.03 });
      const yu = y0 + 0.5 + h * 0.22, gap = s * 0.55, t = s * 0.3;
      const U = archBand(gap, 0, 0, 0, 0, t, this.div + 1).map(p => [p[0], yu + gap / 2 + t - p[1] + 0.0]);
      this.slab(key, P, U, null, -t / 2, t / 2, { ch: 0.02, chB: 0.02 });
      for (const sx of [-1, 1]) {
        const tx = sx * (gap / 2 + t / 2);
        this.box(key, P, tx, yu + gap / 2 + t - 0.02, 0, t, h * 0.5, t, { ch: 0.025 });
        this.turn(key, sub(P, tx, 0), [[t * 0.72, yu + gap / 2 + t + h * 0.5 - 0.02], [0, yu + gap / 2 + t + h * 0.5 + 0.5]], 4, { a0: PI / 4 });
        this.turn('brass', sub(P, tx, 0), [[0, yu + gap / 2 + t + h * 0.5 + 0.44], [0.07, yu + gap / 2 + t + h * 0.5 + 0.52], [0, yu + gap / 2 + t + h * 0.5 + 0.62]], 6);
      }
      return y0 + h + 0.6;
    }
    const hs = h * 0.36, yt = y0 + hs;
    this.box(key, P, 0, y0, 0, s, hs, s, { ch: 0.04 });
    this.box(key, P, 0, yt - 0.02, 0, s + 0.08, 0.1, s + 0.08, { ch: 0.03 });
    for (const r of [0, HP]) this.slab(key, sub(P, 0, 0, r), [[-s / 2, yt], [s / 2, yt], [0, yt + s * 0.75]], null, -s / 2 - 0.04, s / 2 + 0.04, { ch: 0.02, chB: 0.02 });
    const hp = h - hs - 0.5, r0 = s * 0.4 * Math.SQRT2;
    this.turn(key, P, [[r0, yt + 0.06], [r0 * 0.12, yt + hp], [0, yt + hp + 0.02]], 4, { a0: PI / 4 });
    if (this.hi) for (let i = 1; i <= 3; i++) { const t = i / 4, rr = lp(r0, r0 * 0.12, t) / Math.SQRT2; for (const sx of SG) for (const sz of SG) this.box(key, P, sx * rr, yt + hp * t - 0.06, sz * rr, 0.11, 0.12, 0.11, { ch: 0.03 }); }
    const yf = yt + hp;
    this.box(key, P, 0, yf - 0.1, 0, 0.32, 0.08, 0.08, { ch: 0.02 }); this.box(key, P, 0, yf - 0.1, 0, 0.08, 0.08, 0.32, { ch: 0.02 });
    this.turn(o.tip ?? key, P, [[0, yf - 0.05], [0.09, yf + 0.06], [0.05, yf + 0.2], [0, yf + 0.36]], 6);
    return yf + 0.36;
  };
  BP.pinnacle = function (x, y, z, o = {}) { return this._pinnacle(frame(x, z, o.rot ?? 0), 0, y, 0, o); };
  BP._chimney = function (F, lx, y0, lz, o = {}) {
    const w = o.w ?? 1.25, d = o.d ?? 0.8, h = o.h ?? 4, key = o.key ?? 'stoneEarly', C = sub(F, lx, lz, o.rot ?? 0), yt = y0 + h;
    this.box(key, C, 0, y0, 0, w, h, d, { ch: 0.04 });
    this.box('stoneTrim', C, 0, yt - 0.62, 0, w + 0.16, 0.14, d + 0.16, { ch: 0.03 });
    this.box('stoneTrim', C, 0, yt, 0, w + 0.22, 0.18, d + 0.22, { ch: 0.04 });
    this.box(key, C, 0, yt + 0.18, 0, w - 0.1, 0.12, d - 0.1, { ch: 0.03, col: 0.6 });
    const np = w > 1 ? 2 : 1;
    for (let i = 0; i < np; i++) this.turn('stoneDark', sub(C, np > 1 ? (i - 0.5) * w * 0.5 : 0, 0), [[0.17, yt + 0.25], [0.15, yt + 0.55], [0.12, yt + 0.78], [0.15, yt + 0.86], [0.15, yt + 0.92], [0.1, yt + 0.92]], 8);
  };
  BP.chimney = function (x, y, z, o = {}) { return this._chimney(frame(x, z, o.rot ?? 0), 0, y, 0, o); };
