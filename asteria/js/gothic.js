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
  BP._tracery = function (F, x, ys, spY, w, k, n, kl, zg, foil, open) {
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
    if (!open) for (let i = 0; i < n; i++) { const lc = x - w / 2 + e + wl / 2 + i * (wl + mw); this._bars(F, lc - wl / 2, lc + wl / 2, ys, spY, zg + 0.015); }
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
    if (d.steps !== false) this.box('stoneTrim', F, at, y - 0.3, (zd + zf + 0.7) / 2, w + 2 * M + 0.4, 0.32, zf + 0.7 - zd, { ch: 0.04 });
    const [gx, , gz] = wp(F, at, 0, zf + 1.2), gy = d.steps === false ? y : this.ground(gx, gz);
    if (d.steps !== false) for (let i = 1; y - i * 0.17 > gy - 0.05 && i < 12; i++) this.box('stoneTrim', F, at, gy - 0.4, zf + 0.7 + i * 0.32 - 0.16, w + 2 * M + 0.4 + i * 0.2, y - i * 0.17 - gy + 0.4, 0.34, { ch: 0.035 });
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
  // =====================================================================
  // 벽
  // =====================================================================
  // 띠 하나의 윤곽: 아래 notch(문·아치가 아래에서 파고듦), 위 notch(네모), gable(박공 삼각)
  function bandOutline(x0, x1, b0, b1, bot, topN, gable) {
    const P = [[x0, b0]];
    for (const n of bot.slice().sort((a, b) => a.x0 - b.x0)) { P.push([n.x0, b0]); for (const p of n.path) P.push(p); P.push([n.x1, b0]); }
    P.push([x1, b0], [x1, b1]);
    if (gable) P.push([gable.x, b1 + gable.rise]);
    else for (const n of topN.slice().sort((a, b) => b.x0 - a.x0)) P.push([n.x1, b1], [n.x1, n.y], [n.x0, n.y], [n.x0, b1]);
    P.push([x0, b1]);
    return dedupe(P);
  }
  // 창 줄 spec을 펼친다: 줄마다 {sill, ...spec}
  function rowsOf(win, era) {
    if (win === false || win === null) return [];
    const def = era === 'early' ? { type: 'round', sill: 1.6 } : { type: 'paired', sill: 1.3 };
    if (!win || win === true) return [def];
    return (Array.isArray(win) ? win : [win]).map(r => Object.assign({}, def, r));
  }
  BP.wall = function (ax, az, bx, bz, o = {}) {
    const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz);
    if (L < 0.3) return null;
    const rot = Math.atan2(-dz, dx), T = o.thick ?? 1.2, e = o.extend ?? T / 2, F = frame(ax, az, rot, 0);
    const era = o.era ?? 'high', key = this.stoneKey(era), early = era === 'early';
    const gl = this.lineG(F, -e, L + e, -T / 2 - 0.4, T / 2 + 0.8);
    const y = o.y ?? this.lineG(F, 0, L, -T / 2, T / 2, Math.max), h = o.h ?? 10, yt = y + h;
    const yb = Math.min(gl, y) - (o.found ?? 0.5);
    const bay = o.bay ?? 6, nb = Math.max(1, Math.round(L / bay)), bw = L / nb;
    const zf = T / 2, ch = this.chamfer;
    // 버팀벽 자리
    const bo = o.buttress === undefined ? (h > 5 && !o.gable) : o.buttress, bop = typeof bo === 'object' ? bo : {};
    const bxs = [];
    if (bo) { for (let i = 1; i < nb; i++) bxs.push(i * bw); if (o.endButtress) bxs.push(0, L); if (o.buttressAt) bxs.push(...o.buttressAt); }
    const bwid = bop.w ?? (early ? 1.3 : 1.0);
    // 문
    const notches = [], opens = [];
    for (const d of (o.doors || [])) {
      const at = d.at ?? L / 2, dy = y + (d.y ?? 0);
      const n = this._door(F, at, dy, T, Object.assign({ era }, d));
      n.top = dy + (d.h ?? 4.6) + (d.orders ?? 3) * 0.3; n.spY = n.path[0][1]; notches.push(n);
      opens.push({ x0: n.x0, x1: n.x1, y0: dy, y1: n.top + 0.3, door: true });
    }
    // 창 (줄마다, 칸 가운데)
    const holes = [];
    const rows = rowsOf(o.windows, era);
    rows.forEach((r, ri) => {
      const per = r.per ?? 1, every = r.every ?? 1;
      for (let i = 0; i < nb; i++) {
        if ((i + (r.offset ?? 0)) % every) continue;
        if (r.skip && r.skip.includes(i)) continue;
        for (let j = 0; j < per; j++) {
          const at = per === 1 ? (i + 0.5) * bw : i * bw + bw * (j + 0.5) / per;
          const type = r.alt && (i % 2) ? r.alt : r.type, D = WIN[type] || WIN.lancet;
          const ww = (r.w ?? D.w) + 2 * (r.m ?? D.m) + 0.6, ys = y + r.sill;
          if (opens.some(p => p.door && Math.abs((p.x0 + p.x1) / 2 - at) < (p.x1 - p.x0) / 2 + ww / 2 + 0.2 && ys < p.y1)) continue;
          if (at - ww / 2 < -e + 0.2 || at + ww / 2 > L + e - 0.2) continue;
          if (bxs.some(bx_ => Math.abs(bx_ - at) < bwid / 2 + ww / 2 - 0.3)) continue;
          const w = this._win(F, at, ys, T, Object.assign({ era }, r, { type }));
          holes.push(w.hole); opens.push({ x0: at - ww / 2, x1: at + ww / 2, y0: ys - 0.25, y1: w.top + 0.05 });
        }
      }
    });
    for (const r of (o.extraWins || [])) { const w = this._win(F, r.at, y + r.sill, T, Object.assign({ era }, r)); holes.push(w.hole); opens.push({ x0: r.at - 1.5, x1: r.at + 1.5, y0: y + r.sill - 0.25, y1: w.top }); }
    if (o.rose) { const R = o.rose.R, cy = o.rose.cy, at = o.rose.at ?? L / 2; const w = this.rose(F, at, cy, R, { T, lit: o.rose.lit }); holes.push(w.hole); opens.push({ x0: at - R - 0.8, x1: at + R + 0.8, y0: cy - R - 0.8, y1: cy + R + 0.8 }); }
    if (o.slits) for (let x = o.slits * 0.5; x < L - 0.5; x += o.slits) {
      if (bxs.some(b => Math.abs(b - x) < 1.2) || opens.some(p => x > p.x0 - 0.5 && x < p.x1 + 0.5)) continue;
      const ys = y + (o.slitY ?? Math.min(h * 0.45, 4)), w = this._win(F, x, ys, T, { type: 'slit', lit: 0 }); holes.push(w.hole); opens.push({ x0: x - 0.4, x1: x + 0.4, y0: ys, y1: w.top });
    }
    // 띠 (고대층 / 초기 / 본 시대). 경계가 창을 자르지 않게 내린다
    const anc = o.ancient ?? 0, bands = [];
    let cuts = [];
    if (anc > 0) cuts.push({ y: y + anc, key: 'stoneOld' });
    if (o.lower) cuts.push({ y: y + o.lower.h, key: this.stoneKey(o.lower.era ?? 'early') });
    for (const c of cuts) {
      for (let it = 0; it < 4; it++) for (const p of opens) if (c.y > p.y0 - 0.3 && c.y < p.y1 + 0.2 && (!p.door || c.y > (notches.find(n => n.x0 === p.x0)?.spY ?? p.y1) - 0.3)) c.y = p.y0 - 0.35;
    }
    cuts = cuts.filter(c => c.y > yb + 0.4);
    let b0 = yb;
    for (const c of cuts) { if (c.y > b0 + 0.3) { bands.push({ b0, b1: c.y, key: c.key }); b0 = c.y; } }
    bands.push({ b0, b1: yt, key, gable: o.gable });
    // 띠마다 각기둥
    for (const B of bands) {
      const bot = [], top = [], hs = [], splits = [];
      for (const n of notches) {
        if (n.y >= B.b1 - 0.01) continue;
        if (n.y <= B.b0 + 0.01) {
          if (n.spY >= B.b1 - 0.05 && !B.gable && B !== bands[bands.length - 1]) splits.push([n.x0, n.x1]);
          else bot.push(n);
        } else if (n.top < B.b1 - 0.1) hs.push(dedupe([[n.x0, n.y], [n.x1, n.y], ...n.path.slice().reverse()]));
        else top.push({ x0: n.x0, x1: n.x1, y: n.y });
      }
      // 아래 notch가 위 띠를 넘는 문은 아래 띠에서 네모 notch로
      for (const n of notches) if (n.y > B.b0 + 0.01 && n.y < B.b1 && n.spY > B.b1 && B !== bands[bands.length - 1] && !top.some(t => t.x0 === n.x0)) { const i = hs.findIndex(h => h[0][0] === n.x0); if (i >= 0) hs.splice(i, 1); top.push({ x0: n.x0, x1: n.x1, y: n.y }); }
      for (const hh of holes) { let mn = 1e9, mx = -1e9; for (const p of hh) { mn = Math.min(mn, p[1]); mx = Math.max(mx, p[1]); } if (mn > B.b0 + 0.02 && mx < B.b1 - 0.02 + (B.gable ? B.gable.rise : 0)) hs.push(hh); }
      const xs = [-e, ...splits.flat(), L + e];
      for (let i = 0; i < xs.length; i += 2) {
        const x0 = xs[i], x1 = xs[i + 1]; if (x1 - x0 < 0.05) continue;
        const inr = p => p.x0 >= x0 - 0.01 && p.x1 <= x1 + 0.01;
        const hin = hs.filter(hh => hh[0][0] > x0 && hh[0][0] < x1);
        this.slab(B.key, F, bandOutline(x0, x1, B.b0, B.b1, bot.filter(inr), top.filter(inr), B.gable && splits.length === 0 ? { x: B.gable.x ?? L / 2, rise: B.gable.rise } : null), hin, -T / 2, zf, { ch, chB: o.inside === false ? 0 : ch, back: o.inside !== false, rk: 0.6, jit: 0.06 });
      }
    }
    // 문 자리를 비운 x 구간 (몰딩을 끊는다)
    const gaps = (yy, pad = 0.08) => opens.filter(p => yy > p.y0 - 0.15 && yy < p.y1 + 0.1).map(p => [p.x0 - pad, p.x1 + pad]);
    const runs = (x0, x1, gs) => { gs = gs.slice().sort((a, b) => a[0] - b[0]); const out = []; let c = x0; for (const [g0, g1] of gs) { if (g0 > c) out.push([c, Math.min(g0, x1)]); c = Math.max(c, g1); } if (c < x1) out.push([c, x1]); return out.filter(r => r[1] - r[0] > 0.15); };
    const doorGaps = notches.map(n => [n.x0 - 0.1, n.x1 + 0.1]);
    // 고대층: 앞으로 기운 두꺼운 밑동 + 황동 이음새
    if (anc > 0 && bands[0].key === 'stoneOld') {
      const ya = bands[0].b1;
      for (const [r0, r1] of runs(-e, L + e, doorGaps)) {
        this.profX('stoneOld', F, [[zf - 0.05, yb], [zf + 0.42, yb], [zf + 0.32, ya - 0.42], [zf + 0.02, ya - 0.02], [zf - 0.05, ya - 0.02]], r0, r1, { ch: 0.03, jit: 0.04 });
        this.profX('brass', F, [[zf - 0.02, ya - 0.08], [zf + 0.07, ya - 0.08], [zf + 0.07, ya], [zf - 0.02, ya]], r0, r1, { ch: 0.01, jit: false });
        if (ya - yb > 3) this.profX('brass', F, [[zf + 0.3, ya - 1.6], [zf + 0.39, ya - 1.6], [zf + 0.39, ya - 1.54], [zf + 0.3, ya - 1.54]], r0, r1, { ch: 0.005, jit: false });
      }
    } else if (o.plinth !== false) {
      const ph = o.plinthH ?? 0.85, pk = early ? 'stoneEarly' : 'stone';
      for (const [r0, r1] of runs(-e, L + e, doorGaps)) this.profX(pk, F, [[zf - 0.05, yb], [zf + 0.24, yb], [zf + 0.24, y + ph - 0.22], [zf + 0.02, y + ph], [zf - 0.05, y + ph]], r0, r1, { ch: 0.035, col: 0.92 });
    }
    // 띠돌림 (층마다) + 창턱 띠
    const cys = [];
    if (o.courses !== false) {
      const st = o.story ?? 5;
      for (let c = y + st; c < yt - 1.4; c += st) cys.push(c);
      for (const r of rows) { const c = y + r.sill - 0.34; if (c > y + 1 && !cys.some(v => Math.abs(v - c) < 0.7)) cys.push(c); }
    }
    for (const c of cys) for (const [r0, r1] of runs(-e, L + e, gaps(c)))
      this.profX('stoneTrim', F, [[zf - 0.05, c - 0.11], [zf + 0.12, c - 0.11], [zf + 0.16, c - 0.04], [zf + 0.16, c + 0.04], [zf - 0.05, c + 0.16]], r0, r1, { ch: 0.025 });
    // 버팀벽
    const parapet = o.parapet ?? 'none';
    const bTop = yt + (parapet !== 'none' ? 1.0 : -0.25);
    const pin = (o.pinnacle ?? (era === 'high')) && !o.gable;
    for (const bx_ of (o.flying ? [] : bxs)) this._buttress(F, bx_, T, y, yb, bTop, Object.assign({ era, anc: anc > 0 ? bands[0].b1 : 0, pin, w: bwid }, bop));
    if (o.flying) for (const bx_ of bxs) this._flyer(F, bx_, T, y, yb, yt, Object.assign({ era, anc: anc > 0 ? bands[0].b1 : 0 }, typeof o.flying === 'object' ? o.flying : {}));
    // 처마 까치발 줄 + 처마돌림
    if (parapet === 'none' && o.cornice !== false && !o.gable) {
      const yc = yt - 0.3;
      if (o.corbel !== false) for (let x = -e + 0.4; x < L + e - 0.3; x += 0.78) {
        if (bxs.some(b => Math.abs(b - x) < bwid / 2 + 0.2) && !o.flying) continue;
        this.box('stoneTrim', F, x, yc - 0.42, zf + 0.1, 0.2, 0.18, 0.22, { ch: 0.03 });
        this.box('stoneTrim', F, x, yc - 0.26, zf + 0.15, 0.22, 0.26, 0.3, { ch: 0.03 });
      }
      this.profX('stoneTrim', F, [[zf - 0.05, yc], [zf + 0.3, yc], [zf + 0.38, yc + 0.1], [zf + 0.38, yc + 0.26], [zf - 0.05, yc + 0.36]], -e, L + e, { ch: 0.03 });
    }
    if (parapet === 'battlement') this._battle(F, -e, L + e, yt, T, { key, corbel: o.corbel });
    else if (parapet === 'balustrade') this._balus(F, -e, L + e, yt, zf - 0.25, {});
    else if (parapet === 'plain') { this.profX(key, F, [[zf - 0.45, yt - 0.1], [zf, yt - 0.1], [zf, yt + 0.95], [zf - 0.45, yt + 0.95]], -e, L + e); this.profX('stoneTrim', F, [[zf - 0.53, yt + 0.95], [zf + 0.08, yt + 0.95], [zf + 0.08, yt + 1.08], [zf - 0.2, yt + 1.18], [zf - 0.53, yt + 1.08]], -e, L + e, { ch: 0.03 }); }
    // 충돌체
    const [cx, , cz] = wp(F, L / 2, 0, 0);
    const top = yt + (parapet === 'battlement' ? 2.1 : parapet !== 'none' ? 1.1 : 0) + (o.gable ? o.gable.rise : 0);
    this.col({ x: cx, z: cz, hw: L / 2 + e, hd: T / 2 + 0.1, rot, top, bot: yb, climb: true });
    if (parapet !== 'none') this.col({ x: cx, z: cz, hw: L / 2 + e, hd: T / 2 - 0.05, rot, top: yt, bot: yt - 0.5, stand: true });
    return { F, L, T, y, h, yt, yb, top, rot, e };
  };
  // 버팀벽: 2~3번 물러나는 단 + 기운 갓돌 + 첨탑
  BP._buttress = function (F, x, T, y, yb, yTop, o) {
    const zf = T / 2, d = o.d ?? (o.era === 'early' ? 0.45 : 1.35), w = o.w ?? 1.0, key = this.stoneKey(o.era);
    if (o.era === 'early') {
      this.box(key, F, x, yb, zf + d / 2 - 0.05, w, yTop - yb + 0.2, d + 0.1, { ch: 0.04 });
      this.profX('stoneTrim', F, [[zf - 0.05, yTop + 0.2], [zf + d + 0.05, yTop + 0.2], [zf + d + 0.05, yTop + 0.32], [zf - 0.05, yTop + 0.55]], x - w / 2 - 0.05, x + w / 2 + 0.05);
      return;
    }
    const s1 = y + (yTop - y) * 0.36, s2 = y + (yTop - y) * 0.7, k = 0.3;
    const prof = [[zf - 0.1, yb], [zf + d, yb], [zf + d, s1], [zf + d - k, s1 + 0.42], [zf + d - k, s2], [zf + d - 2 * k, s2 + 0.42], [zf + d - 2 * k, yTop]];
    const dt = d - 2 * k;
    if (o.pin) prof.push([zf - 0.1, yTop]); else prof.push([zf - 0.1, yTop + dt * 0.9]);
    this.profX(key, F, prof, x - w / 2, x + w / 2, { ch: 0.04, jit: 0.05 });
    // 단 갓돌 (물끊기 띠)
    for (const [zz, yy] of [[zf + d, s1], [zf + d - k, s2]]) this.profX('stoneTrim', F, [[zz - k - 0.02, yy + 0.42], [zz + 0.06, yy - 0.04], [zz + 0.06, yy - 0.14], [zz - 0.02, yy - 0.14], [zz - k - 0.02, yy + 0.3]], x - w / 2 - 0.06, x + w / 2 + 0.06, { ch: 0.02 });
    // 밑동
    if (o.anc > 0) this.box('stoneOld', F, x, yb, zf + (d + 0.4) / 2 - 0.05, w + 0.5, o.anc - yb, d + 0.5, { ch: 0.03, jit: 0.04 });
    else this.profX('stone', F, [[zf - 0.05, yb], [zf + d + 0.2, yb], [zf + d + 0.2, y + 0.65], [zf + d, y + 0.85], [zf - 0.05, y + 0.85]], x - w / 2 - 0.18, x + w / 2 + 0.18, { ch: 0.035, col: 0.92 });
    // 맨 윗단 앞면의 막힌 뾰족 아치 (밋밋함 깨기)
    if (this.hi && yTop - s2 > 2.2) this.slab('stoneTrim', sub(F, x, zf + d - 2 * k), archBand(w * 0.5, s2 + 0.8, yTop - 0.9 - archRise(w * 0.5, 1.2), 1.2, 0, 0.06, 2, 0), null, -0.02, 0.06, { ch: 0.015, back: false });
    if (o.pin) this._pinnacle(F, x, yTop, zf + dt / 2 + 0.02, { s: Math.min(w * 0.72, dt + 0.05), h: o.pinH ?? 4.4 });
  };
  // 날개 버팀벽: 벽에 붙은 얕은 기둥 + 떨어진 큰 기둥(첨탑) + 경사진 반아치 (가운데 동그란 구멍)
  BP._flyer = function (F, x, T, y, yb, yt, o) {
    const zf = T / 2, key = this.stoneKey(o.era), fd = o.dist ?? 4.2, pw = o.w ?? 1.1, pd = o.d ?? 1.6;
    this.box(key, F, x, yb, zf + 0.2, pw * 0.85, yt - yb - 0.2, 0.5, { ch: 0.04 });
    const zp = zf + fd, yp = y + (yt - y) * 0.62, [px, , pz] = wp(F, x, 0, zp + pd / 2);
    const gyb = Math.min(this.ground(px, pz), yb + 0.5) - 0.5;
    this.profX(key, F, [[zp, gyb], [zp + pd, gyb], [zp + pd, yp - 3.2], [zp + pd - 0.3, yp - 2.8], [zp + pd - 0.3, yp + 1.6], [zp, yp + 1.6]], x - pw / 2, x + pw / 2, { ch: 0.04 });
    this.profX('stoneTrim', F, [[zp + pd - 0.3, yp - 2.8], [zp + pd + 0.06, yp - 3.24], [zp + pd + 0.06, yp - 3.34], [zp + pd - 0.3, yp - 3.0]], x - pw / 2 - 0.05, x + pw / 2 + 0.05, { ch: 0.02 });
    if (o.anc > 0) this.box('stoneOld', F, x, gyb, zp + pd / 2, pw + 0.45, Math.max(0.5, o.anc - gyb), pd + 0.45, { ch: 0.03 });
    else this.box('stone', F, x, gyb, zp + pd / 2, pw + 0.36, y + 0.8 - gyb, pd + 0.36, { ch: 0.04, col: 0.92 });
    this._pinnacle(F, x, yp + 1.6, zp + (pd - 0.3) / 2, { s: Math.min(pw, pd - 0.3) * 0.85, h: o.pinH ?? 5.2 });
    // 반아치: 아래는 1/4 타원, 위는 곧은 경사
    const yw = yt - 2.4, A = zp - zf, B = yw - (yp - 0.4), arc = [];
    for (let i = 0; i <= 8; i++) { const t = i / 8 * HP; arc.push([zp - A * Math.sin(t), yw - B * Math.cos(t)]); }
    const poly = [[zp + 0.15, yp - 0.4], [zp + 0.15, yp + 0.95], [zf - 0.05, yt - 0.35], [zf - 0.05, yw], ...arc.reverse()];
    const mz = lp(zp, zf, 0.45), my = lp(yp + 0.95, yt - 0.35, 0.45) - 0.95, rr = 0.42;
    this.profX(key, F, poly, x - pw * 0.35, x + pw * 0.35, { ch: 0.035, holes: this.hi ? [circle(mz, my, rr, 16)] : [], rk: 0.85 });
    this.profX('stoneTrim', F, [[zp + 0.25, yp + 0.95], [zf - 0.05, yt - 0.35], [zf - 0.05, yt - 0.15], [zp + 0.25, yp + 1.15]], x - pw * 0.4, x + pw * 0.4, { ch: 0.02 });
    const [cx, , cz] = wp(F, x, 0, zp + pd / 2);
    this.col({ x: cx, z: cz, hw: pw / 2, hd: pd / 2, rot: F.rot, top: yp + 1.6, bot: gyb, climb: true });
  };
  // 성가퀴 (로컬 x 방향, 벽 위 yt): 앞으로 내민 까치발 + 난간벽 + 총안 있는 머리돌
  BP._battle = function (F, x0, x1, yt, T, o = {}) {
    const key = o.key ?? 'stone', pt = o.pt ?? 0.55, out = o.corbel === false ? 0 : (o.out ?? 0.42), zo = T / 2 + out, zi = zo - pt;
    if (out > 0) {
      for (let x = x0 + 0.5; x <= x1 - 0.4; x += 1.3) {
        this.box(key, F, x, yt - 1.05, T / 2 + 0.1, 0.34, 0.3, 0.24, { ch: 0.03 });
        this.box(key, F, x, yt - 0.75, T / 2 + 0.17, 0.34, 0.3, 0.38, { ch: 0.03 });
        this.box(key, F, x, yt - 0.45, T / 2 + 0.24, 0.36, 0.4, 0.52, { ch: 0.03 });
      }
      this.profX('stoneTrim', F, [[T / 2 - 0.1, yt - 0.12], [zo + 0.04, yt - 0.12], [zo + 0.04, yt + 0.06], [T / 2 - 0.1, yt + 0.06]], x0, x1, { ch: 0.03 });
    }
    const yp = yt + 0.95;
    this.profX(key, F, [[zi, yt], [zo, yt], [zo, yp], [zi, yp]], x0, x1, { ch: 0.035 });
    this.profX('stoneTrim', F, [[zi - 0.04, yp], [zo + 0.05, yp], [zo + 0.05, yp + 0.08], [zi - 0.04, yp + 0.14]], x0, x1, { ch: 0.02 });
    const mw = o.mw ?? 0.95, gap = 0.58, n = Math.max(1, Math.floor((x1 - x0 + gap) / (mw + gap))), s0 = x0 + ((x1 - x0) - (n * (mw + gap) - gap)) / 2;
    for (let i = 0; i < n; i++) {
      const mx = s0 + i * (mw + gap) + mw / 2;
      this.box(key, F, mx, yp + 0.08, (zi + zo) / 2, mw, 1.0, pt, { ch: 0.04, jit: 0.08 });
      this.box('stoneTrim', F, mx, yp + 1.06, (zi + zo) / 2, mw + 0.08, 0.12, pt + 0.08, { ch: 0.03 });
      if (i % 2 && this.hi) this.box('iron', F, mx, yp + 0.3, (zi + zo) / 2, 0.08, 0.6, pt + 0.02, { ch: 0, col: 0.3 });
    }
  };
  // 난간 (로컬 x 방향, 바닥 y, 가운데 z)
  BP._balus = function (F, x0, x1, y, z, o = {}) {
    const h = o.h ?? 1.0, post = o.post ?? 2.8, key = o.key ?? 'stoneTrim', d = 0.4;
    this.box(key, F, (x0 + x1) / 2, y - 0.05, z, x1 - x0, 0.25, d, { ch: 0.03 });
    this.box(key, F, (x0 + x1) / 2, y + h - 0.16, z, x1 - x0, 0.16, d, { ch: 0.035 });
    const np = Math.max(1, Math.round((x1 - x0) / post)), pl = (x1 - x0) / np, hb = h - 0.36, sc = hb / 0.64;
    const prof = [[0.085, 0], [0.085, 0.05], [0.06, 0.1], [0.1, 0.25], [0.11, 0.32], [0.075, 0.46], [0.05, 0.54], [0.085, 0.6], [0.085, 0.64]].map(p => [p[0], y + 0.2 + p[1] * sc]);
    for (let i = 0; i <= np; i++) {
      const px = x0 + i * pl;
      this.box(key, F, px, y - 0.05, z, 0.42, h + 0.08, 0.46, { ch: 0.04 });
      this.box(key, F, px, y + h + 0.03, z, 0.52, 0.1, 0.56, { ch: 0.03 });
      if (this.hi && i % 2 === 0) this.turn(key, sub(F, px, z), [[0.1, y + h + 0.13], [0.14, y + h + 0.22], [0.1, y + h + 0.34], [0.02, y + h + 0.4]], 8);
      if (i === np) break;
      const nbal = Math.max(1, Math.floor((pl - 0.42) / 0.3));
      for (let j = 0; j < nbal; j++) this.turn(key, sub(F, px + 0.21 + (j + 0.5) * (pl - 0.42) / nbal, z), prof, this.hi ? 8 : 6, { jit: 0.04 });
    }
  };
  BP.balustrade = function (ax, az, bx, bz, o = {}) {
    const L = Math.hypot(bx - ax, bz - az), rot = Math.atan2(-(bz - az), bx - ax), F = frame(ax, az, rot);
    const y = o.y ?? this.lineG(F, 0, L, -0.2, 0.2, Math.max);
    const gy = this.lineG(F, 0, L, -0.2, 0.2) - 0.3;
    if (y - gy > 0.4) this.box('stone', F, L / 2, gy, 0, L, y - gy - 0.05, 0.46, { ch: 0.03 });
    this._balus(F, 0, L, y, 0, o);
    const [cx, , cz] = wp(F, L / 2, 0, 0);
    this.col({ x: cx, z: cz, hw: L / 2, hd: 0.25, rot, top: y + (o.h ?? 1), bot: gy, climb: true });
  };
  BP.battlements = function (ax, az, bx, bz, o = {}) {
    const L = Math.hypot(bx - ax, bz - az), rot = Math.atan2(-(bz - az), bx - ax), F = frame(ax, az, rot), T = o.thick ?? 1.2;
    this._battle(sub(F, 0, -T / 2 + (o.thick ?? 1.2) / 2), 0, L, o.y ?? 10, T, o);
  };
  // =====================================================================
  // 지붕 (박공): 틀 F의 x 방향으로 마루, z = ±half 처마. 처마 쪽 끝이 10~18° 들린다 (칼리도르 지붕)
  // =====================================================================
  function quadU(g, a, b, c, d, ua, ub, uc, ud, h, k) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz); if (l < 1e-10) return;
    nx /= l; ny /= l; nz /= l; if (nx * h[0] + ny * h[1] + nz * h[2] < 0) { nx = -nx; ny = -ny; nz = -nz; }
    const n = [nx, ny, nz];
    g.triN(a, b, c, n, n, n, ua, ub, uc, k); g.triN(a, c, d, n, n, n, ua, uc, ud, k);
  }
  // 한쪽 경사면 판: 윗면 꺾은선 prof [[z,y]...] (처마→마루), 두께 t, x0..x1. 윗면 uv: u = x, v = 경사 길이
  function slopeSlab(g, prof, x0, x1, t, sideSign, o = {}) {
    const n = prof.length, S = [0];
    for (let i = 1; i < n; i++) S.push(S[i - 1] + Math.hypot(prof[i][0] - prof[i - 1][0], prof[i][1] - prof[i - 1][1]));
    const up = [0, 1, 0], k = o.k ?? 1;
    for (let i = 0; i < n - 1; i++) {
      const [za, ya] = prof[i], [zb, yb] = prof[i + 1];
      quadU(g, [x0, ya, za], [x1, ya, za], [x1, yb, zb], [x0, yb, zb], [x0, S[i]], [x1, S[i]], [x1, S[i + 1]], [x0, S[i + 1]], up, k);
      quadU(g, [x0, ya - t, za], [x1, ya - t, za], [x1, yb - t, zb], [x0, yb - t, zb], [x0, S[i]], [x1, S[i]], [x1, S[i + 1]], [x0, S[i + 1]], [0, -1, 0], k * 0.5);
      for (const [xx, sx] of [[x0, -1], [x1, 1]]) quadU(g, [xx, ya, za], [xx, yb, zb], [xx, yb - t, zb], [xx, ya - t, za], [za, ya], [zb, yb], [zb, yb - t], [za, ya - t], [sx, 0, 0], k * 0.8);
    }
    const [ze, ye] = prof[0];
    quadU(g, [x0, ye, ze], [x1, ye, ze], [x1, ye - t, ze], [x0, ye - t, ze], [x0, 0], [x1, 0], [x1, -t], [x0, -t], [0, 0, sideSign], k * 0.8);
    return g;
  }
  // 두 경사면 + 납 마루 + (철 장식): 틀 F, 마루 높이 yR, 반폭 half(벽 바깥면), 처마 내밈 ov
  BP._gableRoof = function (F, x0, x1, half, yR, pitch, o = {}) {
    const t = o.t ?? 0.26, ov = o.ov ?? 0.5, key = o.key ?? 'slate', tp = Math.tan(pitch), kick = o.kick ?? 16 * D2R;
    const zk = Math.max(0.5, half - (o.kickL ?? 0.6)), yk = yR - zk * tp, ze = half + ov, ye = yk - (ze - zk) * Math.tan(pitch - kick);
    const prof = [[ze, ye], [zk, yk], [0, yR]];
    for (const s of [1, -1]) {
      const g = slopeSlab(new GB(), prof.map(p => [p[0] * s, p[1]]), x0, x1, t, s);
      this.put(key, g, F, { jit: 0.06, col: o.col });
    }
    // 처마 홈통 (납) 과 마루 덮개
    if (o.gutter !== false) for (const s of [1, -1]) this.profX('lead', F, [[s * (ze + 0.02), ye - t - 0.02], [s * (ze + 0.16), ye - t - 0.02], [s * (ze + 0.16), ye - 0.02], [s * (ze + 0.02), ye]], x0, x1, { ch: 0.015 });
    this.profX('lead', F, [[-0.24, yR - 0.06], [0.24, yR - 0.06], [0.17, yR + 0.1], [0, yR + 0.19], [-0.17, yR + 0.1]], x0 - 0.05, x1 + 0.05, { ch: 0.01 });
    if (o.cresting && this.hi) {
      for (let x = x0 + 0.3; x < x1 - 0.2; x += 0.55) this.box('iron', F, x, yR + 0.15, 0, 0.035, 0.42, 0.035, { ch: 0 });
      this.box('iron', F, (x0 + x1) / 2, yR + 0.52, 0, x1 - x0 - 0.4, 0.035, 0.035, { ch: 0 });
      for (let x = x0 + 1.4; x < x1 - 1; x += 2.2) this.turn('brass', sub(F, x, 0), [[0, yR + 0.5], [0.07, yR + 0.6], [0, yR + 0.72]], 6);
    }
    return { ye, ze, yk, zk, roofY: z => { z = Math.abs(z); return z <= zk ? yR - z * tp : yk - (z - zk) * Math.tan(pitch - kick); } };
  };
  // 지붕창 (경사면 위): 틀 H(지붕 틀), x 자리, side ±1, 앞면 z (|zf|), 지붕 높이 함수 roofY
  BP._dormer = function (H, xd, side, zf, roofY, pitch, o = {}) {
    const wd = o.w ?? 2.2, hd = o.h ?? 2.5, D = sub(H, xd, side * zf, side > 0 ? 0 : PI), yb = roofY(zf), dp = 55 * D2R;
    const rise = (wd / 2 + 0.05) * Math.tan(dp), apex = yb + hd + rise, key = o.key ?? 'stone';
    const Ld = Math.max(1.2, (apex + 0.3 - yb) / Math.tan(pitch));
    const Dw = sub(D, 0, -0.2);
    const sp = Object.assign({ type: o.type ?? 'lancet', w: 0.85, h: 1.75 }, o.win || {});
    const wv = this._win(Dw, 0, yb + 0.45, 0.4, sp);
    this.slab(key, Dw, [[-wd / 2, yb - 0.8], [wd / 2, yb - 0.8], [wd / 2, yb + hd], [0, apex], [-wd / 2, yb + hd]], [wv.hole], -0.2, 0.2, { ch: 0.03, rk: 0.6 });
    // 앞 박공 갓돌 + 꼭대기 꽃봉오리
    this.slab('stoneTrim', Dw, [[-wd / 2 - 0.12, yb + hd - 0.05], [0, apex - 0.05], [wd / 2 + 0.12, yb + hd - 0.05], [wd / 2 + 0.12, yb + hd + 0.2], [0, apex + 0.24], [-wd / 2 - 0.12, yb + hd + 0.2]], null, -0.3, 0.3, { ch: 0.025, chB: 0.025 });
    this.turn(o.tipKey ?? 'stoneTrim', sub(Dw, 0, 0), [[0.14, apex + 0.12], [0.12, apex + 0.4], [0.05, apex + 0.75], [0, apex + 0.95]], 4, { a0: PI / 4 });
    for (const s of [-1, 1]) this.box(key, D, s * (wd / 2 - 0.13), yb - 0.9, -Ld / 2 - 0.1, 0.26, hd + 0.9, Ld, { ch: 0.03 });
    const Dr = sub(D, 0, 0, HP);
    this._gableRoof(Dr, -0.45, Ld + 0.2, wd / 2, apex + 0.08, dp, { ov: 0.22, t: 0.16, kick: 0.12, kickL: 0.3, gutter: false, key: o.roofKey ?? 'slate' });
  };
  // 마루 위 첨탑 (플레시): 납 받침 + 기둥 여덟 + 작은 종 + 구리 바늘 + 황동 꼭지
  BP._fleche = function (H, xc, yR, o = {}) {
    const s = o.s ?? 1.0, P = sub(H, xc, 0), sh = o.h ?? 8;
    this.box('lead', P, 0, yR - 1.6, 0, 1.9 * s, 2.2 * s + 1.6 - 2.2 * s + 2.2 * s, 1.9 * s, { ch: 0.04 });
    const y1 = yR + 2.2 * s;
    this.turn('lead', P, [[1.1 * s, y1], [1.15 * s, y1 + 0.12], [0.98 * s, y1 + 0.2]], 8, { a0: PI / 8 });
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + PI / 8; this.box('lead', P, Math.sin(a) * 0.82 * s, y1 + 0.2, Math.cos(a) * 0.82 * s, 0.16 * s, 2.0 * s, 0.16 * s, { ch: 0.02 }); }
    this.turn('brass', P, [[0, y1 + 1.6 * s], [0.18 * s, y1 + 1.5 * s], [0.34 * s, y1 + 0.9 * s], [0.42 * s, y1 + 0.55 * s], [0.38 * s, y1 + 0.5 * s], [0, y1 + 0.75 * s]], 10);
    const y2 = y1 + 2.2 * s;
    this.turn('lead', P, [[1.08 * s, y2], [1.15 * s, y2 + 0.18], [1.0 * s, y2 + 0.3]], 8, { a0: PI / 8 });
    this.turn('copper', P, [[1.05 * s, y2 + 0.3], [0.7 * s, y2 + 1.0], [0.06, y2 + sh], [0, y2 + sh + 0.05]], 8, { a0: PI / 8, v: 's', flip: true });
    this._finial(P, y2 + sh - 0.1, s * 0.9);
    return y2 + sh;
  };
  // 황동 꼭지 장식 (공 + 고리 + 바늘)
  BP._finial = function (F, y0, s = 1) {
    this.turn('brass', F, [[0.05 * s, y0], [0.12 * s, y0 + 0.08 * s], [0.06 * s, y0 + 0.2 * s], [0.17 * s, y0 + 0.32 * s], [0.18 * s, y0 + 0.42 * s], [0.12 * s, y0 + 0.54 * s], [0.04 * s, y0 + 0.6 * s], [0.025 * s, y0 + 1.25 * s], [0, y0 + 1.3 * s]], 10);
    if (this.hi) this.slab('brass', sub(F, 0, 0), circle(0, y0 + 0.86 * s, 0.24 * s, 16), [circle(0, y0 + 0.86 * s, 0.19 * s, 16)], -0.015, 0.015, { ch: 0, chB: 0 });
  };

  // =====================================================================
  // 강당 한 동: 벽 넷 + 박공 + 지붕 (+ 장미창, 날개 버팀벽, 지붕창, 굴뚝, 플레시)
  // =====================================================================
  BP.hall = function (x, z, o = {}) {
    const w = o.w ?? 36, d = o.d ?? 14, rot = o.rot ?? 0, T = o.thick ?? 1.3, era = o.era ?? 'high', p = (o.pitch ?? 55) * D2R, tp = Math.tan(p);
    const H = frame(x, z, rot, 0), hw = w / 2 - T / 2, hd = d / 2 - T / 2;
    const y = o.y ?? this.gmax(H, [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2], [0, 0]]);
    const h = o.h ?? 12, yt = y + h;
    const ends = Object.assign({ '+x': true, '-x': true }, o.ends), sides = Object.assign({ '+z': true, '-z': true }, o.sides);
    const yR = yt + 0.36 + (d / 2) * tp;
    const doorsOn = (s, f) => (o.doors || []).filter(dd => (dd.side || '+z') === s).map(dd => Object.assign({}, dd, { at: f(dd.at ?? 0) }));
    const common = { y, h, thick: T, era, ancient: o.ancient, lower: o.lower, story: o.story, plinth: o.plinth, courses: o.courses };
    const win = o.windows ?? (era === 'early' ? [{ type: 'round', sill: 1.8 }, { type: 'roundPair', sill: h - 4.4 }] : [{ type: 'paired', sill: 1.6, h: Math.min(h - 3.6, 7.5) }]);
    const lw = Object.assign({}, common, { windows: win, bay: o.bay ?? 6, buttress: o.buttress ?? true, endButtress: o.cornerButtress !== false, flying: o.flying, pinnacle: o.pinnacle, extraWins: undefined });
    const W = {};
    const pt = (lx, lz) => { const q = wp(H, lx, 0, lz); return [q[0], q[2]]; };
    if (sides['+z']) { const a = pt(-hw, hd), b = pt(hw, hd); W['+z'] = this.wall(a[0], a[1], b[0], b[1], Object.assign({}, lw, { doors: doorsOn('+z', v => hw + v), windows: o.windowsZp ?? lw.windows })); }
    if (sides['-z']) { const a = pt(hw, -hd), b = pt(-hw, -hd); W['-z'] = this.wall(a[0], a[1], b[0], b[1], Object.assign({}, lw, { doors: doorsOn('-z', v => hw - v), windows: o.windowsZn ?? lw.windows })); }
    // 박공 벽: 장미창 또는 큰 창, 아래에 란셋 셋
    const gh = h + 0.6, grise = yR + 0.45 - (yt + 0.6);
    const b_ = hd + T / 2, hyp = Math.hypot(b_, grise), rin = b_ * grise / (b_ + hyp);
    for (const [s, sgn] of [['+x', 1], ['-x', -1]]) {
      if (!ends[s]) continue;
      const a = pt(sgn * hw, sgn * hd), b = pt(sgn * hw, -sgn * hd);
      const wantRose = o.rose === 'both' || o.rose === s || (o.rose === true && s === '+x');
      const R = Math.min(rin - 0.9, d * 0.2), cy = yt + 0.6 + rin * 0.85;
      const extra = [], gw = o.gableWin ?? { type: era === 'early' ? 'round' : 'lancet' };
      const topLim = wantRose ? cy - R - 1.0 : yt + 0.6 + grise * 0.45;
      const gd = doorsOn(s, v => hd - sgn * v);
      const n = gw.n ?? (d > 16 ? 3 : 2), sill = gw.sill ?? (gd.length ? 6.5 : 2.2), D = WIN[gw.type] || WIN.lancet;
      const wh = Math.min(gw.h ?? 99, topLim - (y + sill) - 0.6, (D.h / D.w) * (gw.w ?? D.w) * 1.4);
      if (wh > 1.5) for (let i = 0; i < n; i++) extra.push(Object.assign({}, gw, { at: hd + (i - (n - 1) / 2) * Math.min(3.6, (2 * hd - 3) / n), sill, h: wh }));
      if (!wantRose && grise > 6 && era !== 'early') extra.push({ type: 'triple', at: hd, sill: (yt + 0.6 + grise * 0.12) - y, w: Math.min(3.4, d * 0.24), h: Math.min(grise * 0.55, 8) });
      else if (!wantRose && grise > 4) extra.push({ type: 'oculus', at: hd, sill: (yt + 0.6 + grise * 0.25) - y, w: Math.min(2.2, d * 0.15) });
      W[s] = this.wall(a[0], a[1], b[0], b[1], Object.assign({}, common, { h: gh, windows: false, bay: 2 * hd + 1, buttress: o.buttress ?? true, endButtress: o.cornerButtress !== false, pinnacle: false, cornice: false, gable: { rise: grise, x: hd }, rose: wantRose ? { R, cy, at: hd } : null, extraWins: extra, doors: gd }));
      // 박공 갓돌, 무릎돌, 꼭대기 장식
      const G = W[s].F, x0 = -T / 2, x1 = 2 * hd + T / 2, yb0 = yt + 0.6, ya = yb0 + grise;
      this.slab('stoneTrim', G, [[x0 - 0.15, yb0 - 0.06], [hd, ya - 0.06], [x1 + 0.15, yb0 - 0.06], [x1 + 0.15, yb0 + 0.3], [hd, ya + 0.36], [x0 - 0.15, yb0 + 0.3]], null, -T / 2 - 0.12, T / 2 + 0.14, { ch: 0.035, chB: 0.035 });
      for (const kx of [x0 - 0.1, x1 + 0.1]) {
        this.box('stoneTrim', G, kx, yb0 - 0.7, 0.04, 0.95, 1.05, T + 0.4, { ch: 0.05 });
        if (o.tuning !== false && era !== 'early') this._pinnacle(G, kx, yb0 + 0.35, 0.04, { s: 0.8, h: 3.4, tuning: true });
        else this._pinnacle(G, kx, yb0 + 0.35, 0.04, { s: 0.7, h: 2.8 });
      }
      this.box('stoneTrim', G, hd, ya + 0.15, 0, 0.7, 0.55, 0.7, { ch: 0.05 });
      if (era === 'early') this._pinnacle(G, hd, ya + 0.7, 0, { s: 0.5, h: 1.8 });
      else { this.slab('brass', G, circle(hd, ya + 1.75, 0.62, 24), [circle(hd, ya + 1.75, 0.5, 24)], -0.05, 0.05, { ch: 0.01, chB: 0.01 }); this.slab('brass', G, circle(hd, ya + 1.75, 0.28, 16), [circle(hd, ya + 1.75, 0.2, 16)], -0.04, 0.04, { ch: 0.01, chB: 0.01 }); this.box('brass', G, hd, ya + 0.65, 0, 0.08, 1.75, 0.08, { ch: 0 }); }
    }
    // 지붕
    const rx0 = ends['-x'] ? -hw : -w / 2 - 0.5, rx1 = ends['+x'] ? hw : w / 2 + 0.5;
    const RF = this._gableRoof(H, rx0, rx1, d / 2, yR, p, { key: o.roof ?? 'slate', cresting: o.cresting ?? (era === 'high'), ov: o.flying ? 0.35 : 0.5 });
    // 지붕창
    const nd = o.dormers ?? 0, avoid = [];
    if (o.fleche) avoid.push(o.flecheAt ?? 0);
    const chim = [];
    for (let i = 0; i < (o.chimneys ?? 0); i++) { const cxp = lp(rx0 + 2, rx1 - 2, (i + 0.5) / o.chimneys) + (this.R() - 0.5) * 2; chim.push(cxp); avoid.push(cxp); }
    if (nd > 0) for (const s of [1, -1]) for (let i = 0; i < nd; i++) {
      const xd = lp(rx0 + 2.5, rx1 - 2.5, (i + 0.5) / nd) + (s < 0 ? (rx1 - rx0) / nd * 0.25 : 0);
      if (avoid.some(a => Math.abs(a - xd) < 2.6)) continue;
      this._dormer(H, xd, s, d / 2 - 1.3, RF.roofY, p, Object.assign({ type: o.dormerType ?? (era === 'early' ? 'round' : 'lancet') }, o.dormer || {}));
    }
    chim.forEach((cxp, i) => { const s = i % 2 ? -1 : 1, cz = s * d * 0.18; this._chimney(H, cxp, yt - 0.5, cz, { h: yR - yt + 2.6 + this.R() * 1.2 - (d * 0.18) * tp * 0.3, key: era === 'early' ? 'stoneEarly' : 'stone' }); });
    if (o.fleche) this._fleche(H, o.flecheAt ?? 0, yR, typeof o.fleche === 'object' ? o.fleche : {});
    // 지붕 위에 설 자리 (경사를 계단처럼)
    if (o.roofCol !== false) for (const s of [1, -1]) for (let i = 0; i < 3; i++) {
      const za = (i / 3) * d / 2, zb = ((i + 1) / 3) * d / 2, zc = s * (za + zb) / 2, [cx, , cz] = wp(H, (rx0 + rx1) / 2, 0, zc);
      this.col({ x: cx, z: cz, hw: (rx1 - rx0) / 2, hd: (zb - za) / 2, rot, top: RF.roofY((za + zb) / 2), bot: yt - 1, stand: true });
    }
    return { H, y, yt, yR, w, d, T, walls: W, roofY: RF.roofY };
  };
  // =====================================================================
  // 탑
  // =====================================================================
  // 원통 몸 y0..y1 (반지름 r). 창 줄마다 창 자리를 평평한 판으로 바꿔 진짜 구멍을 낸다
  BP._drum = function (F, r, y0, y1, key, rows, o = {}) {
    const seg = o.seg ?? Math.max(16, Math.round(r * 7));
    let cur = y0;
    const ring = yc => this.turn('stoneTrim', F, [[r - 0.3, yc - 0.12], [r + 0.14, yc - 0.12], [r + 0.18, yc - 0.04], [r + 0.18, yc + 0.04], [r - 0.3, yc + 0.17]], seg);
    for (const row of rows) {
      if (row.ys < cur + 0.5 || row.ys + (row.h ?? 3) > y1 - 0.5) continue;
      const n = row.n, made = []; let top = -1e9;
      for (let i = 0; i < n; i++) {
        const a = (row.a0 ?? 0) + i * TAU / n, D = WIN[row.type] || WIN.lancet;
        const Wo = (row.w ?? D.w) + 2 * (row.m ?? D.m), hwF = Wo / 2 + 0.28, Tf = 0.9;
        if (hwF > r * 0.8) continue;
        const rf = Math.sqrt(r * r - hwF * hwF), Ff = sub(F, Math.sin(a) * (rf - Tf / 2), Math.cos(a) * (rf - Tf / 2), a);
        const wv = this._win(Ff, 0, row.ys, Tf, row);
        top = Math.max(top, wv.top);
        made.push({ a, al: Math.asin(hwF / r), Ff, hole: wv.hole, hwF, Tf });
      }
      if (!made.length) continue;
      const yr0 = row.ys - 0.42, yr1 = top + 0.22, m = made.length;
      if (yr0 > cur + 0.01) this.turn(key, F, [[r, cur], [r, yr0]], seg);
      for (const q of made) this.slab(key, q.Ff, [[-q.hwF, yr0], [q.hwF, yr0], [q.hwF, yr1], [-q.hwF, yr1]], [q.hole], -q.Tf / 2, q.Tf / 2, { ch: 0.03, back: false, rk: 0.6 });
      for (let i = 0; i < m; i++) {
        const A = made[i], B = made[(i + 1) % m], a0 = A.a + A.al; let a1 = B.a - B.al; if (a1 <= a0) a1 += TAU;
        this.put(key, lathe(new GB(), [[r, yr0], [r, yr1]], Math.max(2, Math.round(this.seg(seg) * (a1 - a0) / TAU)), { a0, a1 }), F, {});
      }
      ring(yr0 + 0.02); ring(yr1);
      cur = yr1;
    }
    if (y1 > cur + 0.01) this.turn(key, F, [[r, cur], [r, y1]], seg);
  };
  // 탑의 창 줄 자동 배치
  function towerRows(y, yA, yB, r, wo, era) {
    const rows = [], every = wo.every ?? 6.5, n = wo.n ?? (r > 3.6 ? 4 : 3);
    let i = 0;
    for (let ys = yA; ys + 4 < yB; ys += every, i++) {
      const low = ys < y + 6;
      const type = wo.type ? (typeof wo.type === 'function' ? wo.type(i, ys) : wo.type) : (low ? 'slit' : era === 'early' ? 'round' : (i % 3 === 2 && r > 3.8 ? 'pointed' : 'lancet'));
      const D = WIN[type];
      const w = type === 'lancet' ? Math.min(1.25, r * 0.28) : type === 'pointed' ? Math.min(1.9, r * 0.38) : D.w;
      rows.push({ ys, type, n: type === 'slit' ? Math.max(2, n - 1) : n, a0: (wo.a0 ?? 0) + (i % 2) * PI / n, w, h: type === 'slit' ? 1.4 : Math.min(w * 3.3, every - 1.6), litFrac: low ? 0.2 : undefined });
    }
    return rows;
  }
  BP.tower = function (x, z, o = {}) {
    return (o.shape ?? (o.w ? 'square' : 'round')) === 'square' ? this._squareTower(x, z, o) : this._roundTower(x, z, o);
  };
  BP._roundTower = function (x, z, o) {
    const r = o.r ?? 4, F = frame(x, z, o.rot ?? 0), era = o.era ?? 'high', key = this.stoneKey(era);
    const ring8 = []; for (let i = 0; i < 8; i++) ring8.push([Math.sin(i / 8 * TAU) * (r + 0.6), Math.cos(i / 8 * TAU) * (r + 0.6)]);
    const y = o.y ?? this.gmax(F, [[0, 0], ...ring8.map(p => [p[0] * 0.7, p[1] * 0.7])]), yb = this.gmin(F, ring8) - 0.6;
    const h = o.h ?? 20, yt = y + h, seg = Math.max(16, Math.round(r * 7)), anc = o.ancient ?? 0;
    // 밑동
    let yBody = y + 0.9;
    if (anc > 0) {
      const ya = y + anc;
      this.turn('stoneOld', F, [[r + 0.5, yb], [r + 0.38, ya - 0.5], [r + 0.02, ya - 0.04], [r - 0.1, ya - 0.04]], seg, { jit: 0.04 });
      this.turn('brass', F, [[r + 0.03, ya - 0.1], [r + 0.09, ya - 0.1], [r + 0.09, ya - 0.02], [r + 0.03, ya - 0.02]], seg, { jit: false });
      yBody = ya - 0.05;
    } else this.turn(era === 'early' ? 'stoneEarly' : 'stone', F, [[r + 0.28, yb], [r + 0.28, y + 0.65], [r + 0.02, y + 0.92], [r - 0.1, y + 0.92]], seg, { col: 0.92 });
    // 내민 윗단
    const cs = o.corbelStage ? Object.assign({ h: 5.5, out: 0.7 }, o.corbelStage) : null;
    const r2 = cs ? r + cs.out : r, yc0 = cs ? yt - cs.h : yt;
    const wo = o.windows === false ? null : Object.assign({}, o.windows || {});
    const rows = wo ? towerRows(y, (anc > 0 ? y + anc + 1.2 : y + 2.2), yc0 - 0.6, r, wo, era) : [];
    this._drum(F, r, anc > 0 ? yb : yBody - 0.3, cs ? yc0 + 0.1 : yt, key, rows, { seg });
    if (cs) {
      const n = Math.round(TAU * r / 0.85);
      this.turn('stoneTrim', F, [[r - 0.2, yc0 - 0.95], [r + 0.12, yc0 - 0.95], [r + 0.3, yc0 - 0.55], [r2 - 0.25, yc0 - 0.25], [r2 + 0.06, yc0 - 0.05], [r2 + 0.06, yc0 + 0.12], [r2 - 0.3, yc0 + 0.2]], seg);
      for (let i = 0; i < n; i++) { const a = i / n * TAU; this.box('stoneTrim', F, Math.sin(a) * (r + 0.2), yc0 - 1.5, Math.cos(a) * (r + 0.2), 0.26, 0.6, 0.42, { rot: a, ch: 0.025 }); this.box('stoneTrim', F, Math.sin(a) * (r + cs.out * 0.45), yc0 - 0.95, Math.cos(a) * (r + cs.out * 0.45), 0.3, 0.75, cs.out + 0.2, { rot: a, ch: 0.03 }); }
      const srows = o.windows === false ? [] : [{ ys: yc0 + 0.9, type: cs.type ?? (era === 'early' ? 'roundPair' : 'pointed'), n: cs.n ?? Math.max(3, Math.round(r2 * 0.9)), w: cs.w ?? Math.min(1.8, r2 * 0.36), h: Math.min(cs.h - 2.2, 3.4), a0: PI / (cs.n ?? 4) }];
      this._drum(F, r2, yc0 + 0.1, yt, key, srows, { seg });
    }
    // 처마 까치발 + 처마 돌림
    const rt = r2, roof = o.roof ?? 'cone';
    if (roof !== 'battlement' && o.cornice !== false) {
      const n = Math.round(TAU * rt / 0.8);
      if (this.hi) for (let i = 0; i < n; i++) { const a = (i + 0.5) / n * TAU; this.box('stoneTrim', F, Math.sin(a) * (rt + 0.1), yt - 0.7, Math.cos(a) * (rt + 0.1), 0.2, 0.36, 0.3, { rot: a, ch: 0 }); }
      this.turn('stoneTrim', F, [[rt - 0.2, yt - 0.34], [rt + 0.26, yt - 0.34], [rt + 0.36, yt - 0.2], [rt + 0.36, yt - 0.02], [rt - 0.2, yt + 0.1]], seg);
    }
    if (o.turret) this._turret(F, r, y, yb, yt, o.turret, era);
    if (o.clock) for (let i = 0; i < (o.clock.n ?? 2); i++) { const a = (o.clock.a ?? 0) + i * TAU / (o.clock.n ?? 2), cy = o.clock.y ?? (yc0 - 2.4), R = o.clock.R ?? Math.min(1.5, r * 0.32); this._dial(sub(F, Math.sin(a) * (r - 0.1), Math.cos(a) * (r - 0.1), a), 0, cy, 0.25, R); }
    const top = this._roofRound(F, rt, yt, Object.assign({ era }, o, { roof }));
    this.col({ x, z, r: r + 0.15, top: yt, bot: yb, climb: true });
    return { F, y, yt, top, r: rt };
  };
  // 둥근 지붕들
  BP._roofRound = function (F, rt, yt, o) {
    const roof = o.roof, seg = Math.max(20, Math.round(rt * 8)), rm = o.roofMat ?? 'copper';
    if (roof === 'none') return yt;
    if (roof === 'cone' || roof === 'spire' || roof === 'pyramid') {
      const ratio = o.ratio ?? (roof === 'spire' ? 2.8 : 2.0), Hr = o.roofH ?? ratio * 2 * rt, ov = o.ov ?? 0.5, y0 = yt + 0.35;
      const beta = Math.atan2(Hr, rt), ye = y0 - ov * Math.tan(beta - 13 * D2R), sides = roof === 'pyramid' ? 8 : seg;
      this.turn(rm, F, [[rt - 0.3, yt + 0.12], [rt + ov, ye - 0.12], [rt + ov, ye], [rt, y0], [rt * 0.55, y0 + Hr * 0.45], [0, y0 + Hr]], sides, { v: 's', a0: roof === 'pyramid' ? PI / 8 : 0, jit: 0.05 });
      if (o.lucarnes) this._lucarnes(F, rt, y0, Hr, o.lucarnes, rm);
      // 고리 띠 (구리 지붕의 이음 띠)
      if (rm === 'copper' && this.hi) for (const t of [0.33, 0.62]) { const rr = rt * (1 - t) + 0.03, yy = y0 + Hr * t; this.turn('brass', F, [[rr + 0.02, yy - 0.06], [rr + 0.06, yy], [rr, yy + 0.06]], sides, { a0: roof === 'pyramid' ? PI / 8 : 0, jit: false }); }
      if (o.finial !== false) this._finial(F, y0 + Hr - 0.15, Math.max(0.9, rt * 0.28));
      return y0 + Hr + Math.max(0.9, rt * 0.28) * 1.3;
    }
    if (roof === 'battlement') {
      const n = Math.max(8, Math.round(TAU * (rt + 0.4) / 1.5)), ro = rt + 0.42;
      for (let i = 0; i < n * 2; i++) { const a = (i + 0.5) / (n * 2) * TAU; this.box('stone', F, Math.sin(a) * (rt + 0.1), yt - 1.05, Math.cos(a) * (rt + 0.1), 0.34, 0.3, 0.3, { rot: a, ch: 0 }); this.box('stone', F, Math.sin(a) * (rt + 0.2), yt - 0.75, Math.cos(a) * (rt + 0.2), 0.34, 0.65, 0.5, { rot: a, ch: 0.02 }); }
      this.turn('stone', F, [[rt - 0.1, yt - 0.12], [ro, yt - 0.12], [ro, yt + 0.95], [ro + 0.05, yt + 0.95], [ro + 0.05, yt + 1.05], [ro - 0.6, yt + 1.05], [ro - 0.6, yt + 0.3], [0, yt + 0.3]], seg);
      for (let i = 0; i < n; i++) { const a = i / n * TAU; this.box('stone', F, Math.sin(a) * (ro - 0.28), yt + 1.0, Math.cos(a) * (ro - 0.28), Math.min(1.0, TAU * ro / n * 0.6), 1.05, 0.56, { rot: a, ch: 0.04 }); this.box('stoneTrim', F, Math.sin(a) * (ro - 0.28), yt + 2.04, Math.cos(a) * (ro - 0.28), Math.min(1.06, TAU * ro / n * 0.6 + 0.06), 0.12, 0.62, { rot: a, ch: 0.03 }); }
      this.col({ x: F.x, z: F.z, r: rt, top: yt + 0.3, bot: yt - 1, stand: true });
      if (o.cap) { const cr = Math.min(1.6, rt * 0.4); this.turn('stone', F, [[cr, yt + 0.3], [cr, yt + 3.2]], 16); this.turn(rm, F, [[cr + 0.3, yt + 3.1], [0, yt + 3.1 + cr * 4.4]], 16, { v: 's' }); this._finial(F, yt + 3.0 + cr * 4.4, 0.7); return yt + 4 + cr * 4.4; }
      return yt + 2.1;
    }
    if (roof === 'dome' || roof === 'armillary') {
      const dr = rt + 0.25, y0 = yt + 0.3, prof = [];
      if (roof === 'dome') {
        for (let i = 0; i <= 10; i++) { const t = i / 10 * HP; prof.push([dr * Math.cos(t), y0 + dr * 1.08 * Math.sin(t)]); }
        this.turn(rm, F, [[rt - 0.2, yt], [dr + 0.1, y0 - 0.05], ...prof], seg, { v: 's' });
        for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; this.put('lead', lathe(new GB(), prof.map(p => [p[0] + 0.06, p[1] + 0.02]).slice(0, 10), 1, { a0: a - 0.02, a1: a + 0.02 }), F, {}); }
        const ly = y0 + dr * 1.08, lr = dr * 0.28;
        for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; this.box('stoneTrim', F, Math.sin(a) * lr, ly - 0.1, Math.cos(a) * lr, 0.18, 1.6, 0.18, { ch: 0.02 }); }
        this.turn('brass', F, [[0, ly + 0.2], [lr * 0.7, ly + 0.7], [lr * 0.6, ly + 1.0], [0, ly + 1.05]], 10);
        this.turn(rm, F, [[lr + 0.15, ly + 1.45], [lr + 0.2, ly + 1.6], [0, ly + 1.6 + lr * 2.4]], 12, { v: 's' });
        this._finial(F, ly + 1.5 + lr * 2.4, 0.8);
        return ly + 2.6 + lr * 2.4;
      }
      // 혼천의 관측대: 난간 두른 평평한 지붕 + 받침 + 도는 황동 고리
      this.turn('lead', F, [[rt - 0.2, yt - 0.1], [rt + 0.32, yt - 0.1], [rt + 0.32, yt + 0.2], [0, yt + 0.2]], seg);
      const nb = Math.round(TAU * rt / 0.32);
      this.turn('stoneTrim', F, [[rt + 0.05, yt + 0.2], [rt + 0.3, yt + 0.2], [rt + 0.3, yt + 0.42], [rt + 0.05, yt + 0.42]], seg);
      this.turn('stoneTrim', F, [[rt + 0.02, yt + 1.0], [rt + 0.32, yt + 1.0], [rt + 0.32, yt + 1.16], [rt + 0.02, yt + 1.16]], seg);
      if (this.hi) for (let i = 0; i < nb; i++) { const a = i / nb * TAU; this.turn('stoneTrim', sub(F, Math.sin(a) * (rt + 0.17), Math.cos(a) * (rt + 0.17)), [[0.07, yt + 0.42], [0.09, yt + 0.6], [0.05, yt + 0.85], [0.07, yt + 1.0]], 6); }
      const ar = o.armR ?? rt * 0.72, py = yt + 0.2;
      this.turn('stoneTrim', F, [[0.9, py], [0.9, py + 0.4], [0.55, py + 0.6], [0.4, py + 1.6], [0.7, py + 1.9], [0.7, py + 2.1], [0, py + 2.1]], 16);
      const [ax, ay, az] = wp(F, 0, py + 2.1 + ar + 0.1, 0);
      this.armillary(ax, ay, az, { r: ar });
      this.col({ x: F.x, z: F.z, r: rt, top: yt + 0.2, bot: yt - 1, stand: true });
      return ay + ar * 1.3;
    }
    if (roof === 'lantern' || roof === 'belfry') {
      // 둥근 열린 종루: 기둥 n, 아치, 고리 들보, 종, 그 위 원뿔
      const bh = (o.belfry && o.belfry.h) ?? 5.2, n = Math.max(6, Math.round(rt * 1.8)), y0 = yt + 0.2, y1 = y0 + bh;
      this.turn('stoneTrim', F, [[rt + 0.1, yt - 0.05], [rt + 0.1, y0 + 0.15], [0, y0 + 0.15]], seg);
      for (let i = 0; i < n; i++) {
        const a = i / n * TAU; this.box('stone', F, Math.sin(a) * (rt - 0.35), y0 + 0.1, Math.cos(a) * (rt - 0.35), 0.75, bh - 0.1, 0.7, { rot: a, ch: 0.05 });
        const am = (i + 0.5) / n * TAU, chord = 2 * (rt - 0.35) * Math.sin(PI / n) - 0.75, Fb = sub(F, Math.sin(am) * (rt - 0.35) * Math.cos(PI / n), Math.cos(am) * (rt - 0.35) * Math.cos(PI / n), am);
        const spY = y1 - 1.0 - archRise(chord, 1);
        if (spY > y0 + 1.5) this.slab('stone', Fb, [[-chord / 2 - 0.1, spY], ...archCurve(chord, spY, 1, 0, this.div).reverse().map(p => p), [chord / 2 + 0.1, spY], [chord / 2 + 0.1, y1], [-chord / 2 - 0.1, y1]].reverse(), null, -0.32, 0.32, { ch: 0.04, chB: 0.04 });
      }
      this.turn('stoneTrim', F, [[rt - 0.7, y1 - 0.05], [rt + 0.15, y1 - 0.05], [rt + 0.28, y1 + 0.15], [rt + 0.28, y1 + 0.42], [rt - 0.7, y1 + 0.5]], seg);
      this._bells(F, 0, y0 + 0.2, 0, Math.min(rt * 1.2, 4), bh, o.belfry || {});
      return this._roofRound(F, rt + 0.1, y1 + 0.45, Object.assign({}, o, { roof: 'cone', ratio: o.ratio ?? 2.2 }));
    }
    return yt;
  };
  // 원뿔 지붕 위 작은 지붕창 (뾰족한 머리)
  BP._lucarnes = function (F, rt, y0, Hr, n, rm) {
    for (let i = 0; i < n; i++) {
      const a = (i + 0.5) / n * TAU, t = 0.2, rr = rt * (1 - t), yy = y0 + Hr * t, L = sub(F, Math.sin(a) * (rr - 0.1), Math.cos(a) * (rr - 0.1), a);
      const w = Math.min(1.0, rt * 0.3), h = w * 1.3;
      this.slab('lead', L, [[-w / 2, yy - 0.5], [w / 2, yy - 0.5], [w / 2, yy + h], [0, yy + h + w * 0.8], [-w / 2, yy + h]], [archOpening(w * 0.55, yy + 0.05, yy + h - 0.25, 1.2, 0, 2)], -1.2, 0.15, { ch: 0.02 });
      this._glass(L, archOpening(w * 0.55, yy + 0.05, yy + h - 0.25, 1.2, 0.01, 2), 0.02, this._lit({ litFrac: 0.25 }));
      this.turn(rm, sub(L, 0, -0.2), [[0.06, yy + h + w * 0.7], [0, yy + h + w * 0.7 + 0.9]], 4, { a0: PI / 4 });
    }
  };
  // 종: 참나무 틀에 크기가 다른 종 3~5개 (공명)
  BP._bells = function (F, cx, y0, cz, span, bh, o = {}) {
    const n = o.n ?? 3, yb = y0 + bh - 1.3;
    this.box('oak', F, cx, yb + 0.3, cz, span, 0.32, 0.34, { ch: 0.03 });
    for (const s of [-1, 1]) { this.box('oak', F, cx + s * (span / 2 - 0.2), y0, cz, 0.3, bh - 0.7, 0.3, { ch: 0.03 }); this.box('oak', F, cx + s * (span / 2 - 0.2), y0 + 0.4, cz, 0.3, 0.25, 1.4, { ch: 0.03 }); }
    for (let i = 0; i < n; i++) {
      const t = n > 1 ? i / (n - 1) : 0.5, s = lp(1.0, 0.55, Math.abs(t - 0.5) * 2) * (o.size ?? Math.min(1.3, span * 0.22)), bx = cx + (t - 0.5) * (span - 1.2), by = yb + 0.25 - s * 1.05;
      this.box('iron', F, bx, yb + 0.25, cz, 0.14, 0.12, 0.42, { ch: 0 });
      this.turn('brass', sub(F, bx, cz), [[0, by + s * 0.82], [s * 0.22, by + s * 0.78], [s * 0.42, by + s * 0.08], [s * 0.5, by], [s * 0.54, by + s * 0.06], [s * 0.47, by + s * 0.22], [s * 0.33, by + s * 0.5], [s * 0.3, by + s * 0.78], [s * 0.24, by + s * 0.95], [s * 0.12, by + s * 1.03], [0, by + s * 1.05]], 16, { hard: 0.7, jit: 0.06, col: [0.85, 0.72, 0.55] });
      this.turn('iron', sub(F, bx, cz), [[0, by + s * 0.05], [s * 0.09, by + s * 0.1], [s * 0.04, by + s * 0.25], [s * 0.025, by + s * 0.8], [0, by + s * 0.85]], 6);
    }
  };
  // 시계/공명 문자반 (벽 틀 F, 바깥면 z = T/2)
  BP._dial = function (F, cx, cy, zf, R) {
    this.slab('stoneTrim', F, circle(cx, cy, R + 0.28, 32), null, zf - 0.2, zf + 0.12, { ch: 0.04, back: false });
    this.slab('stoneOld', F, circle(cx, cy, R, 32), null, zf - 0.2, zf + 0.16, { ch: 0.02, back: false });
    this.slab('brass', F, circle(cx, cy, R + 0.04, 32), [circle(cx, cy, R - 0.08, 32)], zf + 0.1, zf + 0.2, { ch: 0.01, back: false });
    this.slab('brass', F, circle(cx, cy, R * 0.42, 24), [circle(cx, cy, R * 0.36, 24)], zf + 0.1, zf + 0.19, { ch: 0.01, back: false });
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, c = Math.cos(a), s = Math.sin(a), t = i % 3 ? 0.03 : 0.055, r0 = R * (i % 3 ? 0.78 : 0.7), r1 = R * 0.9; this.slab('brass', F, [[cx + c * r0 - s * t, cy + s * r0 + c * t], [cx + c * r0 + s * t, cy + s * r0 - c * t], [cx + c * r1 + s * t, cy + s * r1 - c * t], [cx + c * r1 - s * t, cy + s * r1 + c * t]], null, zf + 0.12, zf + 0.2, { ch: 0, back: false }); }
    for (const [a, l, t] of [[1.1, 0.55, 0.05], [2.6, 0.82, 0.035]]) { const c = Math.cos(a), s = Math.sin(a); this.slab('iron', F, [[cx - s * t, cy + c * t], [cx + s * t, cy - c * t], [cx + c * R * l, cy + s * R * l]], null, zf + 0.2, zf + 0.25, { ch: 0, back: false }); }
  };
  // 계단 탑 (탑 옆에 붙어 더 높이 솟는 가는 탑)
  BP._turret = function (F, r, y, yb, yt, t, era) {
    const rt = t.r ?? Math.max(1.3, Math.min(1.8, r * 0.38)), a = t.a ?? 0.8, d = r + rt * 0.55, T = sub(F, Math.sin(a) * d, Math.cos(a) * d, a);
    const top = yt + (t.h ?? 4.5), key = this.stoneKey(era), seg = 16;
    this.turn(key, T, [[rt + 0.2, yb], [rt + 0.2, y + 0.7], [rt, y + 0.9], [rt, top]], seg);
    // 나선으로 오르는 좁은 창 (틀 돌 + 어두운 유리)
    if (this.hi) for (let yy = y + 2.5, i = 0; yy < top - 2; yy += 2.6, i++) {
      const aa = i * 1.1 - 0.6, S = sub(T, Math.sin(aa) * rt, Math.cos(aa) * rt, aa);
      this.box('stoneTrim', S, 0, yy - 0.15, 0.02, 0.5, 1.5, 0.3, { ch: 0.04 });
      this.slab('glassDark', S, archOpening(0.12, yy, yy + 0.95, 1.2, 0, 2), null, 0.16, 0.18, { ch: 0, sides: false, back: false });
    }
    this.turn('stoneTrim', T, [[rt - 0.2, top - 0.35], [rt + 0.24, top - 0.35], [rt + 0.3, top - 0.2], [rt + 0.3, top], [rt - 0.2, top + 0.1]], seg);
    const roof = t.roof ?? 'cone';
    this._roofRound(T, rt + 0.05, top, { roof, ratio: t.ratio ?? 2.4, roofMat: t.roofMat ?? 'copper', ov: 0.3 });
    const [cx, , cz] = wp(T, 0, 0, 0);
    this.col({ x: cx, z: cz, r: rt + 0.1, top, bot: yb, climb: true });
  };
  // 네모 탑: 네 벽 + 모서리 버팀벽 + (종루) + 지붕
  BP._squareTower = function (x, z, o) {
    const w = o.w ?? 8, rot = o.rot ?? 0, F = frame(x, z, rot), era = o.era ?? 'high', key = this.stoneKey(era), T = o.thick ?? 1.4;
    const corners = [[-w / 2, -w / 2], [w / 2, -w / 2], [w / 2, w / 2], [-w / 2, w / 2]];
    const y = o.y ?? this.gmax(F, [[0, 0], ...corners]), h = o.h ?? 30, roof = o.roof ?? 'spire';
    const bel = roof === 'belfry' ? Object.assign({ h: 9, n: 4 }, o.belfry || {}) : null;
    const yt = y + h, hb = w / 2 - T / 2;
    const P = (lx, lz) => { const q = wp(F, lx, 0, lz); return [q[0], q[2]]; };
    const sides = [[[-hb, hb], [hb, hb]], [[hb, hb], [hb, -hb]], [[hb, -hb], [-hb, -hb]], [[-hb, -hb], [-hb, hb]]];
    const wo = o.windows === false ? null : Object.assign({ every: 7 }, o.windows || {});
    const info = [];
    sides.forEach(([a, b], si) => {
      const A = P(...a), B = P(...b), rows = [];
      if (wo) { let i = 0; for (let s = (o.ancient ? o.ancient + 1.4 : 2.4); s + 5 < h - 1.5; s += wo.every, i++) { const low = s < 6, ty = wo.type ?? (low ? 'slit' : era === 'early' ? 'round' : (i % 2 ? 'lancet' : 'pointed')); rows.push({ type: ty, sill: s, w: ty === 'pointed' ? Math.min(2.0, w * 0.26) : ty === 'lancet' ? Math.min(1.3, w * 0.17) : undefined, h: ty === 'slit' ? 1.5 : Math.min(wo.every - 1.8, 5.4), litFrac: low ? 0.15 : undefined, per: (ty === 'lancet' && w > 9) ? 2 : 1 }); } }
      const doors = (o.doors || []).filter(d => (d.side ?? 0) === si);
      info.push(this.wall(A[0], A[1], B[0], B[1], { y, h, thick: T, era, ancient: o.ancient, windows: rows, bay: 2 * hb + 2, buttress: o.buttress !== false, endButtress: o.buttress !== false, pinnacle: false, cornice: roof !== 'battlement' && !bel, corbel: true, parapet: roof === 'battlement' ? 'battlement' : 'none', doors, story: o.story ?? 7, courses: o.courses, buttressD: 0.9 }));
    });
    if (o.clock) for (const si of (o.clock.sides ?? [0, 2])) { const W = info[si]; this._dial(W.F, W.L / 2, o.clock.y ?? (yt - 2.2), W.T / 2, o.clock.R ?? Math.min(1.8, w * 0.2)); }
    let top = yt;
    let ytop = yt;
    if (bel) {
      // 열린 종루 단: 네 면마다 큰 뾰족 아치 (난간), 안에 종
      const bh = bel.h, Tb = 0.9, hb2 = w / 2 - Tb / 2 - 0.15, y0 = yt;
      this.box('stoneTrim', F, 0, yt - 0.3, 0, w + 0.5, 0.4, w + 0.5, { ch: 0.05 });
      sides.forEach(([a, b]) => {
        const k = hb2 / hb, A = P(a[0] * k, a[1] * k), B = P(b[0] * k, b[1] * k), L = 2 * hb2, n = bel.arches ?? (w > 9 ? 2 : 1);
        const doors = []; const aw = (L - 0.9 * (n + 1)) / n;
        for (let i = 0; i < n; i++) doors.push({ at: Tb / 2 + 0.45 + aw / 2 + i * (aw + 0.9), w: aw - 0.6, h: bh - 1.7, orders: 1, leaves: 'none', lantern: false, steps: false, y: 0.1 });
        const W = this.wall(A[0], A[1], B[0], B[1], { y: y0 + 0.1, h: bh, thick: Tb, era, windows: false, buttress: false, plinth: false, courses: false, cornice: true, corbel: true, doors });
        for (const d of doors) this._balus(W.F, d.at - d.w / 2 - 0.3, d.at + d.w / 2 + 0.3, y0 + 0.1, 0, { h: 0.9, post: 99 });
      });
      this._bells(F, 0, y0 + 0.2, 0, w - 2.4, bh, Object.assign({ n: 3 }, bel));
      this._bells(sub(F, 0, 0, HP), 0, y0 + 0.2, 1.1, w - 3.2, bh - 1.4, { n: 2, size: 0.7 });
      ytop = y0 + 0.1 + bh;
    }
    // 모서리: 소리굽쇠 쌍첨탑 (종루) 또는 작은 첨탑
    const sr = o.roof2 ?? (roof === 'belfry' ? 'spire' : roof);
    if (sr === 'spire' || sr === 'pyramid') {
      const pc = o.cornerPins ?? true;
      if (pc) for (const [cx, cz] of corners) this._pinnacle(F, cx * 0.86, ytop - 0.1, cz * 0.86, { s: 0.95, h: 4.8, tuning: bel ? true : false, rot: 0 });
      const isSp = sr === 'spire', Hs = o.roofH ?? (isSp ? (o.ratio ?? 2.6) * w : (o.ratio ?? 1.4) * w), y0 = ytop + 0.1;
      if (isSp) {
        const r8 = (w / 2 - 0.55) / Math.cos(PI / 8);
        // 모서리 비탈 (broach)
        for (const [cx, cz] of corners) this.turn(o.roofMat ?? 'copper', sub(F, cx * 0.62, cz * 0.62), [[w * 0.2, y0], [0, y0 + Hs * 0.16]], 4, { a0: PI / 4, v: 's' });
        this.turn(o.roofMat ?? 'copper', F, [[r8 + 0.25, y0 - 0.1], [r8, y0 + 0.2], [r8 * 0.55, y0 + Hs * 0.42], [0, y0 + Hs]], 8, { a0: PI / 8, v: 's' });
        if (this.hi) for (const t of [0.3, 0.6]) { const rr = r8 * (1 - t) + 0.03; this.turn('brass', F, [[rr + 0.03, y0 + Hs * t - 0.06], [rr + 0.07, y0 + Hs * t], [rr, y0 + Hs * t + 0.06]], 8, { a0: PI / 8, jit: false }); }
        // 첨탑 지붕창 (네 방향)
        for (let i = 0; i < 4; i++) { const a = i * HP, t = 0.22, rr = r8 * (1 - t) * Math.cos(PI / 8), yy = y0 + Hs * t, L = sub(F, Math.sin(a) * (rr - 0.05), Math.cos(a) * (rr - 0.05), a), lw = Math.min(1.3, w * 0.16), lh = lw * 1.6;
          this.slab('lead', L, [[-lw / 2, yy - 0.6], [lw / 2, yy - 0.6], [lw / 2, yy + lh], [0, yy + lh + lw], [-lw / 2, yy + lh]], [archOpening(lw * 0.55, yy, yy + lh - 0.35, 1.2, 0, 2)], -1.4, 0.18, { ch: 0.02 });
          this._glass(L, archOpening(lw * 0.55, yy, yy + lh - 0.35, 1.2, 0.01, 2), 0.04, this._lit({ litFrac: 0.3 }));
          this.turn('brass', sub(L, 0, -0.1), [[0.05, yy + lh + lw - 0.1], [0, yy + lh + lw + 0.7]], 4); }
        this._finial(F, y0 + Hs - 0.2, 1.4);
        top = y0 + Hs + 1.8;
      } else {
        const r4 = (w / 2 + 0.5) * Math.SQRT2;
        this.turn(o.roofMat ?? 'slate', F, [[r4 - 0.6, ytop - 0.2], [r4, ytop - 0.1], [r4 - 0.7, ytop + 0.5], [0, y0 + Hs]], 4, { a0: PI / 4, v: 's' });
        this._finial(F, y0 + Hs - 0.2, 1.1);
        top = y0 + Hs + 1.4;
      }
    } else if (sr === 'battlement') {
      if (o.bartizans !== false) for (const [cx, cz] of corners) {
        const B = sub(F, cx * 1.02, cz * 1.02), br = 1.15;
        this.turn('stone', B, [[0.2, yt - 3.4], [br * 0.7, yt - 2.6], [br, yt - 1.6], [br, yt + 2.2]], 14);
        this.turn('stoneTrim', B, [[br - 0.1, yt + 2.1], [br + 0.15, yt + 2.1], [br + 0.15, yt + 2.3], [br - 0.1, yt + 2.35]], 14);
        this.turn(o.roofMat ?? 'copper', B, [[br + 0.25, yt + 2.25], [0, yt + 2.3 + br * 4.6]], 14, { v: 's' });
        this._finial(B, yt + 2.2 + br * 4.6, 0.6);
      }
      this.box('lead', F, 0, yt - 0.3, 0, w - 0.8, 0.32, w - 0.8, { ch: 0.02 });
      this.col({ x, z, hw: w / 2 - 0.6, hd: w / 2 - 0.6, rot, top: yt + 0.02, bot: yt - 1, stand: true });
      top = yt + 2.2;
      if (o.cap) { const cr = Math.min(2.2, w * 0.24), C = sub(F, w * 0.12, -w * 0.12); this.turn('stone', C, [[cr, yt], [cr, yt + 4]], 16); this.turn('stoneTrim', C, [[cr - 0.1, yt + 3.9], [cr + 0.2, yt + 3.9], [cr + 0.2, yt + 4.15], [cr - 0.1, yt + 4.2]], 16); this.turn(o.roofMat ?? 'copper', C, [[cr + 0.3, yt + 4.1], [0, yt + 4.1 + cr * 4.4]], 16, { v: 's' }); this._finial(C, yt + 4 + cr * 4.4, 0.8); top = yt + 5.5 + cr * 4.4; }
    } else if (sr === 'none') this.box('lead', F, 0, yt - 0.3, 0, w - 0.6, 0.35, w - 0.6, { ch: 0.02 });
    return { F, y, yt, top, w };
  };
  // 돌아가는 황동 혼천의 (extra 물체 + anims)
  BP.armillary = function (x, y, z, o = {}) {
    const r = o.r ?? 2.5, g = new THREE.Group(), M = batchMat('brass'), t = Math.max(0.04, r * 0.022), segs = this.hi ? 64 : 32;
    g.position.set(x, y, z);
    const mk = (rr, tt, rx, ry, rz) => { const m = new THREE.Mesh(new THREE.TorusGeometry(rr, tt, 6, segs), M); m.rotation.set(rx, ry, rz); m.castShadow = true; return m; };
    const outer = new THREE.Group(); g.add(outer);
    outer.add(mk(r, t * 1.4, HP, 0, 0));           // 지평 고리
    outer.add(mk(r, t * 1.4, 0, 0, 0));            // 자오 고리
    const inner = new THREE.Group(); inner.rotation.z = 23.4 * D2R; g.add(inner);
    const r1 = mk(r * 0.86, t, HP, 0, 0), r2 = mk(r * 0.86, t, 0, HP, 0), r3 = mk(r * 0.72, t, HP + 0.4, 0, 0.3), r4 = mk(r * 0.58, t * 0.9, 0.9, 0.5, 0);
    inner.add(r1, r2, r3, r4);
    const ax = new THREE.Mesh(new THREE.CylinderGeometry(t * 0.6, t * 0.6, r * 2.3, 6), M); inner.add(ax);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(r * 0.12, 16, 12), batchMat('mana')); inner.add(orb);
    this.extra.push(g);
    this.anims.push(tt => { inner.rotation.y = tt * 0.12; r3.rotation.z = 0.3 + tt * 0.21; r4.rotation.y = 0.5 - tt * 0.33; outer.rotation.y = Math.sin(tt * 0.05) * 0.2; });
    this.light({ x, y, z, c: 0x7ff0ff, k: 0.5, d: 6 });
    return g;
  };
  // =====================================================================
  // 성문: 깊은 통로 + 앞면의 여러 겹 아치 문 + 내리닫이 쇠창살 + 성가퀴 + 양옆 둥근 탑 (높이 다르게)
  // 로컬 +z가 바깥(앞)이다. rot = -PI/2 이면 서쪽(-x)을 본다
  // =====================================================================
  BP.gatehouse = function (x, z, o = {}) {
    const w = o.w ?? 14, d = o.d ?? 10, rot = o.rot ?? 0, F = frame(x, z, rot), era = o.era ?? 'high', key = this.stoneKey(era);
    const fp = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2], [0, 0], [0, d / 2 + 2]];
    const y = o.y ?? this.gmax(F, fp), yb = this.gmin(F, fp) - 0.6, h = o.h ?? 13, yt = y + h;
    const po = Object.assign({ w: 4.2, h: 7.4, orders: 4 }, o.portal || {}), k = po.k ?? 1;
    const fs = po.orders * 0.3 + 0.35, tw = po.w + 0.5, tsp = y + po.h + 0.3 - archRise(tw, k);
    const tun = { x0: -tw / 2, x1: tw / 2, path: [[-tw / 2, tsp], ...archCurve(tw, tsp, k, 0, this.div + 1).reverse(), [tw / 2, tsp]] };
    // 몸통 (통로가 뚫린 덩어리)
    this.slab(key, F, bandOutline(-w / 2, w / 2, yb, yt, [tun], []), null, -d / 2, d / 2 - fs, { ch: this.chamfer, chB: this.chamfer, rk: 0.72 });
    this.slab('stoneTrim', F, archBand(tw, tsp, tsp, k, 0, 0.45, this.div + 1), null, -d / 2 - 0.12, -d / 2 + 0.05, { ch: 0.03, back: false });
    // 앞 가림벽 + 물러나는 아치 문
    const Fs = sub(F, 0, d / 2 - fs / 2);
    const notch = this._door(Fs, 0, y, fs, { w: po.w, h: po.h, orders: po.orders, k, leaves: o.leaves ?? 'open', lantern: true });
    this.slab(key, Fs, bandOutline(-w / 2 - 0.02, w / 2 + 0.02, yb, yt, [notch], []), null, -fs / 2, fs / 2, { ch: this.chamfer, back: false, rk: 0.7 });
    const yo = y + po.h + po.orders * 0.3;
    this.profX('stoneTrim', Fs, [[fs / 2 - 0.05, yo + 0.75], [fs / 2 + 0.14, yo + 0.75], [fs / 2 + 0.18, yo + 0.83], [fs / 2 + 0.18, yo + 0.9], [fs / 2 - 0.05, yo + 1.02]], -w / 2, w / 2, { ch: 0.02 });
    if (yt - yo > 3.6) this._dial(Fs, 0, (yo + 1.1 + yt - 1.2) / 2 + 0.1, fs / 2, Math.min(1.25, (yt - yo - 2.4) / 2));
    for (const s of [-1, 1]) { const ys = y + 2.2; const wv = this._win(Fs, s * (w / 2 - 1.6), ys + 3.5, fs, { type: 'slit', lit: 0 }); this.slab(key, Fs, [[s * (w / 2 - 1.6) - 0.55, ys + 3.2], [s * (w / 2 - 1.6) + 0.55, ys + 3.2], [s * (w / 2 - 1.6) + 0.55, wv.top + 0.2], [s * (w / 2 - 1.6) - 0.55, wv.top + 0.2]], [wv.hole], fs / 2 - 0.02, fs / 2 + 0.2, { ch: 0.03, back: false, rk: 0.6 }); }
    // 내리닫이 쇠창살 (반쯤 올림)
    if (o.portcullis !== false) {
      const zp = d / 2 - fs - 0.45, yP = y + po.h * (o.portcullisAt ?? 0.62), Fp = sub(F, 0, zp);
      for (let bx = -tw / 2 + 0.25; bx <= tw / 2 - 0.2; bx += 0.32) {
        const top = archY(tw, tsp, k, bx) - 0.05; if (top <= yP + 0.2) continue;
        this.box('iron', Fp, bx, yP, 0, 0.07, top - yP, 0.07, { ch: 0 });
        this.turn('iron', sub(Fp, bx, 0), [[0.05, yP + 0.02], [0, yP - 0.28]], 4, { a0: PI / 4 });
      }
      for (let yy = yP + 0.3; yy < tsp + 0.4; yy += 0.55) this.box('iron', Fp, 0, yy, 0.05, tw - 0.3, 0.07, 0.05, { ch: 0 });
    }
    // 통로 바닥과 기초
    this.box(key, F, 0, yb, 0, tw + 0.2, y - 0.3 - yb, d + 0.2, { ch: 0.02 });
    this.box('cobble', F, 0, y - 0.32, -fs / 2, tw + 0.2, 0.32, d - fs + 0.3, { ch: 0.02 });
    // 성가퀴 (앞뒤), 옆은 낮은 난간벽, 지붕 판
    this._battle(sub(F, 0, d / 2 - 0.6), -w / 2, w / 2, yt, 1.2, { key });
    this._battle(sub(F, 0, -d / 2 + 0.6, PI), -w / 2, w / 2, yt, 1.2, { key });
    this.box('lead', F, 0, yt - 0.3, 0, w - 0.4, 0.32, d - 0.4, { ch: 0.02 });
    // 양옆 탑
    const tws = o.towers ?? [{ h: h + 8, roof: 'cone' }, { h: h + 11.5, roof: 'battlement', cap: true }];
    const tr = o.towerR ?? 3.6, out = [];
    tws.forEach((t, i) => {
      if (!t) return;
      const s = i ? 1 : -1, r = t.r ?? tr, [tx, , tz] = wp(F, s * (w / 2 + r * 0.35), 0, d / 2 - r * 0.55);
      out.push(this._roundTower(tx, tz, Object.assign({ r, y, era, ancient: o.ancient, rot: rot + s, windows: { n: 3, every: 6 } }, t)));
    });
    // 충돌체
    for (const s of [-1, 1]) { const cxl = s * (w / 2 + tw / 2) / 2, [cx, , cz] = wp(F, cxl, 0, 0); this.col({ x: cx, z: cz, hw: (w / 2 - tw / 2) / 2, hd: d / 2, rot, top: yt, bot: yb, climb: true }); }
    { const [cx, , cz] = wp(F, 0, 0, 0); this.col({ x: cx, z: cz, hw: tw / 2, hd: d / 2, rot, top: y, bot: yb, stand: true }); this.col({ x: cx, z: cz, hw: w / 2 - 0.6, hd: d / 2 - 0.6, rot, top: yt, bot: yt - 0.5, stand: true }); }
    return { F, y, yt, towers: out, door: wp(F, 0, y, d / 2 + 0.5) };
  };
  // 공개: 벽 틀에 문 하나 (wall의 doors가 쓰는 것과 같다)
  BP.portal = function (F, at, y, o = {}) { return this._door(F, at, y, o.thick ?? 1.2, o); };

  // =====================================================================
  // 회랑: 낮은 벽 위 쌍기둥, 뾰족 아치(창살), 외쪽 지붕, 뒷벽. 걷는 길은 로컬 -z 쪽
  // =====================================================================
  BP.arcade = function (ax, az, bx, bz, o = {}) {
    const L = Math.hypot(bx - ax, bz - az), rot = Math.atan2(-(bz - az), bx - ax), F = frame(ax, az, rot), era = o.era ?? 'high', key = this.stoneKey(era);
    const depth = o.depth ?? 3.6, tw = 0.7, k = o.k ?? (era === 'early' ? 0 : 1);
    const y = o.y ?? this.lineG(F, 0, L, -depth, 0.5, Math.max), yb = this.lineG(F, 0, L, -depth - 1, 0.8) - 0.5;
    const n = Math.max(1, Math.round(L / (o.span ?? 3.2))), sp = L / n, colH = o.colH ?? 2.6, dw = o.dwarf ?? 0.55;
    const clear = sp - 0.72, ys = y + dw + colH + 0.24, rise = archRise(clear, k), yt = ys + rise + 0.85;
    const gaps = o.gaps || [];
    // 낮은 벽 (입구 칸은 비운다) + 기초
    for (let j = 0; j < n; j++) {
      if (gaps.includes(j)) { this.box('stoneTrim', F, (j + 0.5) * sp, y - 0.25, 0, clear + 0.1, 0.27, tw + 0.1, { ch: 0.03 }); continue; }
      this.box(key, F, (j + 0.5) * sp, yb, 0, sp, y - yb, tw + 0.2, { ch: 0.03 });
      this.box('stoneTrim', F, (j + 0.5) * sp, y, 0, sp, dw, tw, { ch: 0.04 });
    }
    // 기둥 (끝은 네모 기둥)
    for (let i = 0; i <= n; i++) {
      const px = i * sp;
      if (i === 0 || i === n) { this.box(key, F, px, yb, 0, 0.95, ys - yb + 0.1, tw + 0.15, { ch: 0.04 }); continue; }
      for (const s of [-1, 1]) this.turn('stoneTrim', sub(F, px, s * 0.17), [[0.16, y + dw], [0.16, y + dw + 0.12], [0.11, y + dw + 0.2], [0.1, y + dw + 0.3], [0.09, ys - 0.5], [0.105, ys - 0.42], [0.18, ys - 0.2], [0.19, ys - 0.12]], 10);
      this.box('stoneTrim', F, px, ys - 0.14, 0, 0.62, 0.16, tw + 0.08, { ch: 0.03 });
      this.box('stoneTrim', F, px, y + dw - 0.02, 0, 0.55, 0.1, tw, { ch: 0.02 });
      const [cx, , cz] = wp(F, px, 0, 0); this.col({ x: cx, z: cz, r: 0.4, top: ys, bot: y });
    }
    // 아치 위 벽 (spandrel)
    const notches = [];
    for (let j = 0; j < n; j++) { const cx = (j + 0.5) * sp; notches.push({ x0: cx - clear / 2, x1: cx + clear / 2, path: archCurve(clear, ys, k, 0, this.div + 1, cx).reverse() }); }
    this.slab(key, F, bandOutline(-0.47, L + 0.47, ys - 0.02, yt, notches, []), null, -tw / 2, tw / 2, { ch: this.chamfer, chB: this.chamfer });
    for (let j = 0; j < n; j++) {
      const cx = (j + 0.5) * sp;
      this.slab('stoneTrim', F, archBand(clear, ys, ys, k, 0, 0.2, this.div + 1, cx), null, tw / 2 - 0.02, tw / 2 + 0.09, { ch: 0.025, back: false });
      this.slab('stoneTrim', sub(F, 0, 0, PI), archBand(clear, ys, ys, k, 0, 0.2, this.div + 1, -cx), null, tw / 2 - 0.02, tw / 2 + 0.09, { ch: 0.025, back: false });
      if (o.tracery !== false && !gaps.includes(j) && clear > 1.6) this._tracery(F, cx, y + dw, ys, clear - 0.04, k, 2, k ? 1.0 : 0, -0.04, 'ring', true);
    }
    this.profX('stoneTrim', F, [[tw / 2 - 0.05, yt - 0.3], [tw / 2 + 0.22, yt - 0.3], [tw / 2 + 0.28, yt - 0.18], [tw / 2 + 0.28, yt - 0.02], [-tw / 2, yt + 0.06], [-tw / 2, yt - 0.3]], -0.5, L + 0.5, { ch: 0.025 });
    // 외쪽 지붕 (뒤로 올라간다)
    const pitch = (o.pitch ?? 34) * D2R, ze = tw / 2 + 0.55, zb = -depth - 0.3, ye = yt - 0.05, yB = ye + (ze - zb) * Math.tan(pitch);
    this.put(o.roof ?? 'slate', slopeSlab(new GB(), [[ze, ye], [zb, yB]], -0.5, L + 0.5, 0.22, 1), F, { jit: 0.06 });
    this.profX('lead', F, [[ze + 0.02, ye - 0.26], [ze + 0.16, ye - 0.26], [ze + 0.16, ye - 0.02], [ze + 0.02, ye]], -0.5, L + 0.5, { ch: 0.01 });
    // 들보와 천장
    for (let i = 0; i <= n; i++) this.box('oak', F, i * sp, yt - 0.62, (-depth + tw / 2) / 2, 0.24, 0.32, depth + tw / 2 - 0.1, { ch: 0.02 });
    this.box('oak', F, L / 2, yt - 0.32, (-depth + tw / 2) / 2, L, 0.06, depth + tw / 2 - 0.1, { ch: 0, col: 0.75 });
    // 바닥
    this.box('flagstone', F, L / 2, y - 0.3, -depth / 2 + tw / 4, L + 0.4, 0.3, depth + tw / 2, { ch: 0.02 });
    this.box(key, F, L / 2, yb, -depth / 2, L, y - 0.3 - yb, depth, { ch: 0.02 });
    { const [cx, , cz] = wp(F, L / 2, 0, -depth / 2); this.col({ x: cx, z: cz, hw: L / 2, hd: depth / 2, rot, top: y, bot: yb, stand: true }); }
    // 뒷벽
    if (o.back !== false) {
      const T = 1.0, a = wp(F, 0, 0, -depth - T / 2), b = wp(F, L, 0, -depth - T / 2);
      this.wall(a[0], a[2], b[0], b[2], Object.assign({ y, h: o.backH ?? (yB + 0.9 - y), thick: T, era, windows: o.backWins ?? false, buttress: false, cornice: false, courses: false, doors: o.backDoors }, o.backWall || {}));
    }
    return { F, y, yt, ys, L };
  };

  // =====================================================================
  // 다리 (여러 반원 아치, 물가름 기둥, 난간, 등불). 기울어진 바닥도 된다
  // =====================================================================
  BP.bridge = function (ax, az, bx, bz, o = {}) {
    const L = Math.hypot(bx - ax, bz - az), rot = Math.atan2(-(bz - az), bx - ax), F = frame(ax, az, rot), W = o.width ?? 7, key = this.stoneKey(o.era ?? 'high');
    const y0 = o.y0 ?? this.ground(ax, az), y1 = o.y1 ?? this.ground(bx, bz), deck = lx => lp(y0, y1, lx / L), e = o.abut ?? 3;
    const gb = lx => Math.min(this.gmin(F, [[lx, -W / 2], [lx, 0], [lx, W / 2]]), deck(lx) - 2) - 0.6;
    const n = o.arches ?? Math.max(1, Math.round(L / 14)), bay = L / n, pw = o.pier ?? Math.max(1.6, bay * 0.24), round = o.round !== false;
    const P = [[-e, gb(-e)]], arches = [];
    for (let j = 0; j < n; j++) {
      const xl = j === 0 ? 0 : j * bay + pw / 2, xr = j === n - 1 ? L : (j + 1) * bay - pw / 2, s = xr - xl, cx = (xl + xr) / 2;
      const kk = round ? 0 : 1, sy = deck(cx) - 1.5 - archRise(s, kk);
      arches.push({ xl, xr, s, cx, sy, kk });
      P.push([xl, Math.min(gb(xl), sy - 0.3)], ...archCurve(s, sy, kk, 0, this.div + 2, cx).reverse(), [xr, Math.min(gb(xr), sy - 0.3)]);
    }
    P.push([L + e, gb(L + e)], [L + e, deck(L + e) - 0.2], [-e, deck(-e) - 0.2]);
    this.slab(key, F, P, null, -W / 2, W / 2, { ch: this.chamfer, chB: this.chamfer });
    for (const A of arches) for (const sgn of [1, -1]) this.slab('stoneTrim', sgn > 0 ? F : sub(F, 0, 0, PI), archBand(A.s, A.sy, A.sy, A.kk, 0, Math.min(0.75, A.s * 0.08 + 0.3), this.div + 2, sgn * A.cx), null, W / 2 - 0.02, W / 2 + 0.08, { ch: 0.03, back: false });
    // 물가름 + 기둥 위 얕은 버팀
    for (let i = 1; i < n; i++) {
      const px = i * bay, g = gb(px), top = Math.min(arches[i - 1].sy, arches[i].sy) - 0.2;
      for (const s of [-1, 1]) {
        const cw = pw * 0.7;
        if (top - g > 1) { this.box(key, F, px, g, s * W / 2, cw, top - g, cw, { rot: PI / 4, ch: 0.04 }); this.turn('stoneTrim', sub(F, px, s * W / 2), [[cw * 0.72, top], [0, top + cw * 0.6]], 4, { a0: 0 }); }
        this.box(key, F, px, top, s * (W / 2 + 0.15), pw * 0.62, deck(px) - 0.5 - top, 0.5, { ch: 0.04 });
      }
    }
    // 처마돌림 + 까치발, 난간벽, 바닥
    const band = (a, b) => [[-e, deck(-e) + a], [L + e, deck(L + e) + a], [L + e, deck(L + e) + b], [-e, deck(-e) + b]];
    this.slab('stoneTrim', F, band(-0.55, -0.2), null, -W / 2 - 0.25, W / 2 + 0.25, { ch: 0.03, chB: 0.03 });
    if (this.hi) for (let x = -e + 0.6; x < L + e - 0.4; x += 1.3) for (const s of [-1, 1]) this.box('stoneTrim', F, x, deck(x) - 0.95, s * (W / 2 + 0.1), 0.22, 0.4, 0.22, { ch: 0 });
    for (const s of [-1, 1]) {
      const z0 = s > 0 ? W / 2 - 0.45 : -W / 2 - 0.05, z1 = s > 0 ? W / 2 + 0.05 : -W / 2 + 0.45;
      this.slab(key, F, band(-0.2, 1.0), null, z0, z1, { ch: 0.03, chB: 0.03 });
      this.slab('stoneTrim', F, band(1.0, 1.16), null, z0 - 0.07, z1 + 0.07, { ch: 0.03, chB: 0.03 });
      for (let x = 0; x <= L; x += L / Math.max(1, Math.round(L / 9))) this.box('stoneTrim', F, x, deck(x) - 0.2, s * (W / 2 - 0.2), 0.62, 1.5, 0.62, { ch: 0.04 });
    }
    this.slab(o.deckKey ?? 'cobble', F, band(-0.25, 0), null, -W / 2 + 0.44, W / 2 - 0.44, { ch: 0, back: false });
    if (o.lamps !== false) for (let i = 0; i <= n; i++) { const px = i === 0 ? 1.5 : i === n ? L - 1.5 : i * bay, s = i % 2 ? 1 : -1, [lx, , lz] = wp(F, px, 0, s * (W / 2 - 0.2)); this.lantern(lx, deck(px) + 2.9, lz, rot, { post: true, base: deck(px) + 1.3 }); }
    // 충돌체
    const ns = Math.max(1, Math.ceil((L + 2 * e) / 4));
    for (let i = 0; i < ns; i++) { const xa = -e + i * (L + 2 * e) / ns, xb = xa + (L + 2 * e) / ns, xm = (xa + xb) / 2, [cx, , cz] = wp(F, xm, 0, 0); this.col({ x: cx, z: cz, hw: (xb - xa) / 2, hd: W / 2, rot, top: deck(xm), bot: deck(xm) - 2, stand: true }); }
    for (const s of [-1, 1]) { const [cx, , cz] = wp(F, L / 2, 0, s * (W / 2 - 0.2)); this.col({ x: cx, z: cz, hw: L / 2 + e, hd: 0.3, rot, top: Math.max(y0, y1) + 1.16, bot: Math.min(y0, y1) - 1, climb: true }); }
    for (let i = 1; i < n; i++) { const [cx, , cz] = wp(F, i * bay, 0, 0); this.col({ x: cx, z: cz, hw: pw / 2, hd: W / 2, rot, top: arches[i].sy, bot: gb(i * bay), climb: true }); }
    return { F, L, y0, y1, deck };
  };

  // =====================================================================
  // 계단 (로컬 +x로 올라간다) + 옆벽
  // =====================================================================
  BP.stairs = function (x, z, rot = 0, o = {}) {
    const F = frame(x, z, rot), w = o.w ?? 4, rise = o.rise ?? 3, run = o.run ?? rise * 2, y = o.y ?? this.ground(x, z);
    const n = Math.max(1, Math.round(rise / 0.17)), tr = run / n, rh = rise / n, key = o.key ?? 'stoneTrim';
    for (let i = 0; i < n; i++) {
      const x0 = i * tr, top = y + (i + 1) * rh, g = this.gmin(F, [[x0, -w / 2], [x0 + tr, w / 2], [x0 + tr / 2, 0]]) - 0.4;
      this.box(key, F, x0 + tr / 2 + 0.03, Math.min(g, top - 0.4), 0, tr + 0.06, top - Math.min(g, top - 0.4), w, { ch: 0.035, jit: 0.07 });
      const [cx, , cz] = wp(F, x0 + tr / 2, 0, 0); this.col({ x: cx, z: cz, hw: tr / 2, hd: w / 2, rot, top, bot: top - 1, stand: true });
    }
    if (o.cheeks !== false) for (const s of [-1, 1]) {
      const zc = s * (w / 2 + 0.3), g0 = this.gmin(F, [[0, zc], [run / 2, zc], [run, zc]]) - 0.4;
      const P = [[-0.4, g0], [run + 0.4, g0], [run + 0.4, y + rise + 0.95], [run - 0.2, y + rise + 0.95], [0.2, y + 0.95 + rh], [-0.4, y + 0.95 + rh]];
      this.slab('stone', sub(F, 0, zc), P, null, -0.3, 0.3, { ch: 0.04, chB: 0.04 });
      this.slab('stoneTrim', sub(F, 0, zc), [[run - 0.2, y + rise + 0.93], [run + 0.5, y + rise + 0.93], [run + 0.5, y + rise + 1.08], [run - 0.2, y + rise + 1.08], [0.2, y + 1.08 + rh], [-0.5, y + 1.08 + rh], [-0.5, y + 0.93 + rh], [0.2, y + 0.93 + rh]], null, -0.36, 0.36, { ch: 0.03, chB: 0.03 });
      for (const [px, py] of [[-0.05, y + rh + 1.08], [run + 0.05, y + rise + 1.08]]) { this.box('stoneTrim', sub(F, 0, zc), px, py - 1.2, 0, 0.7, 1.55, 0.7, { ch: 0.05 }); this.turn('stoneTrim', sub(F, px, zc), [[0.3, py + 0.35], [0.38, py + 0.45], [0.2, py + 0.7], [0.08, py + 0.75], [0.0, py + 0.78]], 8); }
      const [cx, , cz] = wp(F, run / 2, 0, zc); this.col({ x: cx, z: cz, hw: run / 2 + 0.4, hd: 0.3, rot, top: y + rise + 1, bot: g0, climb: true });
    }
    return { F, top: y + rise };
  };

  // =====================================================================
  // 성벽 (꺾은선) + 모서리 망루, 단 (옹벽 + 바닥 + 난간)
  // =====================================================================
  BP.curtain = function (pts, o = {}) {
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      out.push(this.wall(ax, az, bx, bz, Object.assign({ h: 9, thick: 2.0, windows: false, parapet: 'battlement', buttress: true, pinnacle: false, bay: 7, slits: 5, courses: true, story: 6 }, o)));
    }
    if (o.turrets !== false) for (let i = (o.turretEnds ? 0 : 1); i < pts.length - (o.turretEnds ? 0 : 1); i++) {
      const [tx, tz] = pts[i], W = out[Math.min(i, out.length - 1)];
      this._roundTower(tx, tz, { r: o.turretR ?? 2.8, y: W.y, h: W.h + (i % 2 ? 6.5 : 4), roof: i % 2 ? 'cone' : 'battlement', cap: false, windows: { n: 3, every: 5.5, type: 'slit' }, ancient: o.ancient, ratio: 2.3 });
    }
    return out;
  };
  BP.terrace = function (pts, o = {}) {
    const P = area(pts.map(p => [p[0], -p[1]])) < 0 ? pts.slice().reverse() : pts;
    const y = o.y ?? 0;
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length];
      if (o.skip && o.skip.includes(i)) continue;
      this.wall(a[0], a[1], b[0], b[1], { y, h: 0.06, thick: 1.0, windows: false, buttress: o.buttress ?? true, pinnacle: false, plinth: true, courses: false, cornice: false, parapet: o.rail ?? 'balustrade', bay: 6, ancient: o.ancient, era: o.era });
    }
    this.plan(o.top ?? 'flagstone', frame(0, 0, 0), P, y - 0.35, y, { ch: 0 });
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const [px, pz] of P) { x0 = Math.min(x0, px); x1 = Math.max(x1, px); z0 = Math.min(z0, pz); z1 = Math.max(z1, pz); }
    const inside = (px, pz) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, zi] = P[i], [xj, zj] = P[j]; if (((zi > pz) !== (zj > pz)) && (px < (xj - xi) * (pz - zi) / (zj - zi) + xi)) c = !c; } return c; };
    for (let gx = x0; gx < x1; gx += 4) for (let gz = z0; gz < z1; gz += 4) if (inside(gx + 2, gz + 2)) this.col({ x0: gx, x1: gx + 4, z0: gz, z1: gz + 4, top: y, bot: y - 3, stand: true });
  };
  // @@END — 이 아래는 내보내기
  function setLit(group, k) {
    const m = group.getObjectByName('glassLit'); if (!m) return;
    if (!m.userData.kitMats) m.userData.kitMats = { lit: m.material, dark: batchMat('glassDark') };
    const M = m.userData.kitMats;
    if (k < 0.05) { m.material = M.dark; return; }
    if (!M.litK) { M.litK = M.lit.clone(); M.base = M.lit.color ? M.lit.color.clone() : null; }
    m.material = M.litK;
    if (M.base) M.litK.color.copy(M.base).multiplyScalar(k);
    if (M.litK.emissiveIntensity !== undefined && M.lit.emissiveIntensity !== undefined) M.litK.emissiveIntensity = M.lit.emissiveIntensity * k;
  }
  function stats(group) { let tris = 0, calls = 0; group.traverse(o => { if (o.isMesh) { calls++; tris += o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3; } }); return { tris: Math.round(tris), calls }; }
  return { Builder, GB, prism, cbox, lathe, archCurve, archOpening, archBand, archRise, archY, circle, quatrefoil, frame, sub, wp, WIN, setLit, stats };
})();
