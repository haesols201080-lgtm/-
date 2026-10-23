// 아스테리아 — 실내외 소품 (PROPS)
// 칼리도르 학원의 "살아 있는 어수선함": 참나무 가구, 책, 황동 기구, 촛불, 벨벳, 양피지. 모든 형상은 코드로 만든다.
//
// ── 쓰는 법 ───────────────────────────────────────────────────────────────────────
//   PROPS.<name>(batch, x, y, z, rot, o)   형상을 Batch(js/batch.js)의 재질 통에 넣는다. y는 소품이 놓이는 바닥 높이.
//     rot = three.js rotation.y. 소품은 지역 +z가 "앞"(사람이 서는 쪽), 지역 x가 길이 방향. 벽에 붙는 것은 지역 z=0이 벽면.
//     o.seed 로 무작위 배치를 고정한다 (없으면 위치로 정한다). 반환값: 소품마다 쓸모 있는 값 (윗면 높이, 심지 위치 등).
//   움직이는 부분(혼천의 고리, 진자, 행성)은 batch.extra(Object3D) + batch.anims(t => …)로 넣는다.
//   빛: batch.light({x,y,z,c,k,d,flicker:true, fire?}) — 벽난로·촛대·벽등·샹들리에·등불만. 낱개 촛불은 빛 없이 불꽃 카드만.
//   충돌체: 큰 가구만 batch.col({x,z,hw,hd,rot,top,bot}).
//
// ── 불꽃 ───────────────────────────────────────────────────────────────────────
//   모든 불꽃·헤일로·불씨·마나 빛은 'pFlame' 통 하나(가산 혼합 ShaderMaterial)로 합쳐진다 = 그리기 호출 1개.
//   스프라이트마다 정점 6개: position=중심, normal=(모서리x, 모서리y, 종류), uv=(크기, 씨앗), color=색.
//   셰이더가 카메라를 향해 펼치고(불꽃은 세로축 고정) 시간으로 흔든다. 그림자 패스에서는 면적이 0이라 비용이 없다.
//   종류: 0 촛불 심, 1 헤일로(반지름 0.3~0.6 m, 10~20%), 2 장작불 혀, 3 불씨(올라감), 4 색 빛(마나).
//   PROPS.flame(batch, x, y, z, size, o)로 직접 넣을 수도 있다.
//
// ── 재질 ───────────────────────────────────────────────────────────────────────
//   TEX 이름(oak, oakPanel, brass, gold, iron, leather, rope, parchment, stone, stoneTrim, stoneDark, flagstone, plaster, timber)
//   + 이 파일이 batch.js의 BATCH_MATS에 등록하는 것: pBooks(책·종이 아틀라스), pLinen, pVelvet, pQuilt, pGlass, pLiquid,
//   pWax, pWaxLit, pFood, pCeramic, pClay, pPewter, pFlame, pGlowAdd, pSoot, pBanner, pTapestry, pRug, pChalk, pMap,
//   pPaint, pMemory, pClock, pPlant, pCoal, pCrystal, pFrost, pNightGlass. 정점색은 곱(틴트)이다.
//
// ── 목록 (o의 주요 값) ──────────────────────────────────────────────────────────
//   가구: longTable{len,w,h,set,runner,food,candelabra,cloth} bench{len,h} chair{seat:'leather'|'velvet'|'wood',col,cloth}
//         armchair{col,leather} sofa{len,col} desk{w,dress,hutch} roundTable{r,h,dress} lectern{book,candle}
//         bookshelf{w,h,d,bays,fill,rail,ladder,crest,items} bookStack{n,open} scrollRack{cols,rows} cardCatalog{cols,rows,open}
//         rollingLadder{h,ang} bed{w,l,curtain,quilt} trunk{open,w} wardrobe{w,h,open} nightstand{candle,light}
//         windowSeat{w,d} window{w,h,thick,arch,night} cushion{w,d,col}
//   불: fireplace{w,h,breast,clutter,over,light} candle{h,r,holder:'stick'|'dish'|'none'|'pewter',lit,melt,light,col}
//         candelabrum{arms,h,light} wallSconce{n,light,soot} chandelier{r,drop,n,light} lantern{hang,light} oilLamp{light}
//         birdcage{hang,crystal,light}
//   기구: globe{r,h} armillarySphere{r,stand:'table'|'floor',spin} orrery{r} telescope{pitch} tuningForkRack{n} bell{r,frame}
//         chalkboard{w,h,stand} mapEasel{w,h} clock{tall} magnifier{} keyring{}
//   병·음식: potionShelf{w,h,shelves} cauldron{r,fire} teaSet{} inkAndQuill{} scrolls{n,open} herbBundle{n} pottedPlant{kind}
//         goblet plate bowl pitcher bread fruitBowl bottle cup book openBook paper hourglass
//   창고: crate{s,lid} barrel{lying} sack{h}
//   천·벽: banner{w,h,wall} tapestry{w,h} rug{w,l,design,layer} painting{w,h} memoryGlass{w,h} statue{s} armorStand{}
//   흩기: PROPS.clutter(batch, area, o)  area={x,y,z,w,d,rot} (y=윗면). o.kinds, o.density, o.floor, o.avoid
//         PROPS.dress(batch, top, o)     탁자 윗면 꾸미기 (큰+중간+작은 셋 묶음, 15~25% 비틀기, 펼친 책, 녹은 초)
//   PROPS.list — 보기 페이지용 [이름, 함수, 대략 크기] 목록. PROPS.U.time — 소품 셰이더 시간(스스로 돈다).
'use strict';
(function () {
  if (window.PROPS) return;
  const T = THREE, TAU = Math.PI * 2, PI = Math.PI;
  const P = window.PROPS = {};
  const U = P.U = { time: { value: 0 } };
  (function tick() { U.time.value = performance.now() / 1000; requestAnimationFrame(tick); })();

  // =====================================================================
  // 1. 난수, 색
  // =====================================================================
  function rng(seed) {
    let a = (seed >>> 0) || 1;
    const f = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    f.r = (lo, hi) => lo + f() * (hi - lo);
    f.i = n => (f() * n) | 0;
    f.p = arr => arr[(f() * arr.length) | 0];
    f.s = () => (f() < 0.5 ? -1 : 1);
    return f;
  }
  const seedOf = (x, y, z, s) => (Math.imul(Math.round(x * 97) | 0, 73856093) ^ Math.imul(Math.round(y * 89) | 0, 19349663) ^ Math.imul(Math.round(z * 83) | 0, 83492791) ^ ((s || 0) * 2654435761)) >>> 0;
  const RNG = (x, y, z, o) => rng(o && o.seed !== undefined ? o.seed : seedOf(x, y, z));
  P.rng = rng;
  const _c = new T.Color();
  const lin = h => { _c.set(h); return [_c.r, _c.g, _c.b]; };
  const tcol = t => t === undefined || t === null ? null : Array.isArray(t) ? t : typeof t === 'number' ? (t > 16 ? lin(t) : [t, t, t]) : [t.r, t.g, t.b];
  const mul = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
  const jit = (R, c, v) => { const k = 1 + (R() * 2 - 1) * v; return mul(tcol(c), k); };
  // 칼리도르 색
  const C = {
    oak: 1, oakD: [0.72, 0.68, 0.64], oakL: [1.25, 1.18, 1.1], wax: 0xEFE3C8, waxOld: 0xE0CDA0, pewter: 0x8C8C88, linen: 0xE6D8BC,
    indigo: 0x2A2F5E, oxblood: 0x5E1E22, moss: 0x3E4A2A, ochre: 0xA8843E, cream: 0xE9DCC0, iron: 0x2E2F33, bronze: 0x9A7440,
    book: [0x6B2A22, 0x2F4A36, 0x253456, 0x9A7A4E, 0x201A17, 0xA8843E],
    glass: [0x2A4FA8, 0x9E1F2A, 0xD39A2A, 0x2F7A4A, 0x5A3A8A, 0x7FB0A0, 0x8A6A3A],
  };
  P.C = C;

  // =====================================================================
  // 2. 형상 만들기 (모두 비색인, position/normal/uv(미터)/color)
  // =====================================================================
  function GB() { return { P: [], N: [], U: [], C: [] }; }
  function geoOf(B) {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(B.P, 3));
    g.setAttribute('normal', new T.Float32BufferAttribute(B.N, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(B.U, 2));
    g.setAttribute('color', new T.Float32BufferAttribute(B.C, 3));
    return g;
  }
  function vtx(B, p, n, uv, c) { B.P.push(p[0], p[1], p[2]); B.N.push(n[0], n[1], n[2]); B.U.push(uv[0], uv[1]); B.C.push(c[0], c[1], c[2]); }
  // 삼각형 하나: 정점 법선의 합과 면 방향이 어긋나면 감는 방향을 뒤집는다. flat이면 면 법선.
  function tri(B, p0, p1, p2, n0, n1, n2, u0, u1, u2, c0, c1, c2, flat) {
    const ax = p1[0] - p0[0], ay = p1[1] - p0[1], az = p1[2] - p0[2], bx = p2[0] - p0[0], by = p2[1] - p0[1], bz = p2[2] - p0[2];
    let fx = ay * bz - az * by, fy = az * bx - ax * bz, fz = ax * by - ay * bx;
    const fl = Math.hypot(fx, fy, fz); if (fl < 1e-12) return;
    const sx = n0[0] + n1[0] + n2[0], sy = n0[1] + n1[1] + n2[1], sz = n0[2] + n1[2] + n2[2];
    const flip = fx * sx + fy * sy + fz * sz < 0;
    if (flat) { const k = (flip ? -1 : 1) / fl; n0 = n1 = n2 = [fx * k, fy * k, fz * k]; }
    if (flip) { vtx(B, p0, n0, u0, c0); vtx(B, p2, n2, u2, c2); vtx(B, p1, n1, u1, c1); }
    else { vtx(B, p0, n0, u0, c0); vtx(B, p1, n1, u1, c1); vtx(B, p2, n2, u2, c2); }
  }
  const ONE = [1, 1, 1];
  // 모따기 상자: 중심 원점, 크기 w,h,d, 모따기 c. o.ax 결 방향(0 x,1 y,2 z; 기본 가장 긴 축), o.ew 모서리 밝기(닳음),
  // o.no 'ny,nz' 처럼 뺄 면, o.fuv {pz:[u0,v0,u1,v1,rot],...} 면마다 아틀라스 칸 (주면만), o.uo/o.vo uv 밀기, o.taper 윗면 줄임 비
  function cbox(w, h, d, c, o) {
    o = o || {};
    const H = [w / 2, h / 2, d / 2], B = GB();
    c = Math.max(0, Math.min(c === undefined ? 0.012 : c, H[0] * 0.45, H[1] * 0.45, H[2] * 0.45));
    const ax = o.ax !== undefined ? o.ax : (w >= h && w >= d ? 0 : h >= d ? 1 : 2);
    const ew = o.ew === undefined ? 1.16 : o.ew, uo = o.uo || 0, vo = o.vo || 0, no = o.no || '', fuv = o.fuv, tp = o.taper || 1;
    const shp = p => tp === 1 ? p : [p[0] * (p[1] > 0 ? tp : 1), p[1], p[2] * (p[1] > 0 ? tp : 1)];
    function poly(pts, k, fk) {
      let nx = 0, ny = 0, nz = 0, cx = 0, cy = 0, cz = 0;
      for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; nx += (a[1] - b[1]) * (a[2] + b[2]); ny += (a[2] - b[2]) * (a[0] + b[0]); nz += (a[0] - b[0]) * (a[1] + b[1]); cx += a[0]; cy += a[1]; cz += a[2]; }
      if (nx * cx + ny * cy + nz * cz < 0) { pts = pts.slice().reverse(); nx = -nx; ny = -ny; nz = -nz; }
      const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      const an = [Math.abs(nx), Math.abs(ny), Math.abs(nz)];
      const dom = an[0] >= an[1] && an[0] >= an[2] ? 0 : an[1] >= an[2] ? 1 : 2;
      const oth = [0, 1, 2].filter(i => i !== dom);
      let ua, va; if (oth.includes(ax)) { va = ax; ua = oth[0] === ax ? oth[1] : oth[0]; } else { ua = oth[0]; va = oth[1]; }
      const rect = fk && fuv ? fuv[fk] : null;
      const uvOf = p => {
        if (!rect) return [p[ua] + uo, p[va] + vo];
        let s, t;
        if (fk === 'pz') { s = (p[0] + H[0]) / (2 * H[0]); t = (p[1] + H[1]) / (2 * H[1]); }
        else if (fk === 'nz') { s = (H[0] - p[0]) / (2 * H[0]); t = (p[1] + H[1]) / (2 * H[1]); }
        else if (fk === 'px') { s = (H[2] - p[2]) / (2 * H[2]); t = (p[1] + H[1]) / (2 * H[1]); }
        else if (fk === 'nx') { s = (p[2] + H[2]) / (2 * H[2]); t = (p[1] + H[1]) / (2 * H[1]); }
        else if (fk === 'py') { s = (p[0] + H[0]) / (2 * H[0]); t = (H[2] - p[2]) / (2 * H[2]); }
        else { s = (p[0] + H[0]) / (2 * H[0]); t = (p[2] + H[2]) / (2 * H[2]); }
        if (rect[4]) { const q = s; s = t; t = 1 - q; }
        return [rect[0] + s * (rect[2] - rect[0]), rect[1] + t * (rect[3] - rect[1])];
      };
      const n = [nx, ny, nz], kc = [k, k, k];
      for (let i = 1; i < pts.length - 1; i++) { vtx(B, pts[0], n, uvOf(pts[0]), kc); vtx(B, pts[i], n, uvOf(pts[i]), kc); vtx(B, pts[i + 1], n, uvOf(pts[i + 1]), kc); }
    }
    const S = [-1, 1];
    for (let a = 0; a < 3; a++) for (const sa of S) {
      const fk = (sa > 0 ? 'p' : 'n') + 'xyz'[a];
      if (no.includes(fk) || (fuv && fuv[fk] === null)) continue;
      const b = (a + 1) % 3, cc = (a + 2) % 3, pts = [];
      for (const [sb, sc] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const p = [0, 0, 0]; p[a] = sa * H[a]; p[b] = sb * (H[b] - c); p[cc] = sc * (H[cc] - c); pts.push(shp(p)); }
      poly(pts, 1, fk);
    }
    if (c > 0) {
      for (let a = 0; a < 3; a++) {
        const b = (a + 1) % 3, t = (a + 2) % 3;
        for (const sa of S) for (const sb of S) {
          const pts = [];
          for (const [st, wh] of [[-1, 0], [1, 0], [1, 1], [-1, 1]]) { const p = [0, 0, 0]; p[t] = st * (H[t] - c); if (!wh) { p[a] = sa * H[a]; p[b] = sb * (H[b] - c); } else { p[a] = sa * (H[a] - c); p[b] = sb * H[b]; } pts.push(shp(p)); }
          poly(pts, ew);
        }
      }
      for (const sx of S) for (const sy of S) for (const sz of S) {
        const Sg = [sx, sy, sz], pts = [];
        for (let a = 0; a < 3; a++) { const p = [0, 0, 0]; for (let i = 0; i < 3; i++) p[i] = Sg[i] * (i === a ? H[i] : H[i] - c); pts.push(shp(p)); }
        poly(pts, ew);
      }
    }
    return geoOf(B);
  }
  // 둥근 상자 (쿠션·매트리스·베개). o.puff: 윗면(+y) 가운데가 부푼 정도(m), o.sag 아랫면, o.side 옆면 부풂
  function rbox(w, h, d, r, seg, o) {
    o = o || {};
    const sg = (seg || 2) * 2 + 1, g = new T.BoxGeometry(1, 1, 1, sg, sg, sg).toNonIndexed();
    const p = g.attributes.position, half = 0.5 / sg, B = GB();
    r = Math.min(r, w / 2, h / 2, d / 2);
    const bx = w / 2 - r, by = h / 2 - r, bz = d / 2 - r, pf = o.puff || 0, sd = o.side || 0;
    const v = new T.Vector3(), n = new T.Vector3(), q = [];
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i); n.copy(v);
      n.x -= Math.sign(n.x) * half; n.y -= Math.sign(n.y) * half; n.z -= Math.sign(n.z) * half; n.normalize();
      const fx = 1 - 4 * v.x * v.x, fz = 1 - 4 * v.z * v.z, fy = 1 - 4 * v.y * v.y;
      let X = bx * Math.sign(v.x) + n.x * r, Y = by * Math.sign(v.y) + n.y * r, Z = bz * Math.sign(v.z) + n.z * r;
      let nx = n.x, ny = n.y, nz = n.z;
      if (pf && v.y > 0) { Y += pf * fx * fz; nx += pf * 8 * v.x * fz * 2 / Math.max(w, 0.1); nz += pf * 8 * v.z * fx * 2 / Math.max(d, 0.1); }
      if (o.sag && v.y < 0) Y += o.sag * fx * fz;
      if (sd) { X += Math.sign(v.x) * sd * fy * fz * (Math.abs(n.x) > 0.5 ? 1 : 0.3); Z += Math.sign(v.z) * sd * fy * fx * (Math.abs(n.z) > 0.5 ? 1 : 0.3); }
      const l = Math.hypot(nx, ny, nz); q.push([X, Y, Z], [nx / l, ny / l, nz / l]);
    }
    for (let i = 0; i < q.length; i += 2) {
      const pp = q[i], nn = q[i + 1], an = [Math.abs(nn[0]), Math.abs(nn[1]), Math.abs(nn[2])];
      const uv = an[1] >= an[0] && an[1] >= an[2] ? [pp[0], pp[2]] : an[0] >= an[2] ? [pp[2], pp[1]] : [pp[0], pp[1]];
      vtx(B, pp, nn, uv, ONE);
    }
    g.dispose();
    return geoOf(B);
  }
  // 회전체: prof [[r,y],...] 아래 가운데 → 바깥 → 위 순서. 같은 점을 두 번 쓰면 각진 모서리.
  // o.a0/o.a1 부분 회전, o.flat 면 법선, o.uvRect [u0,v0,u1,v1] (u=둘레, v=단면 순서), o.cf(i,j) 정점 밝기, o.wob(i,a) 반지름 흔들기
  function lathe(prof, seg, o) {
    o = o || {};
    seg = seg || 12;
    const n = prof.length, B = GB(), a0 = o.a0 || 0, a1 = o.a1 === undefined ? TAU : o.a1;
    let rmax = 0; for (const q of prof) rmax = Math.max(rmax, q[0]);
    const ur = o.ur || rmax || 0.1;
    const sn = j => { const a = prof[j], b = prof[j + 1], dr = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dr, dy); return l < 1e-7 ? null : [dy / l, -dr / l]; };
    const nr = [], vv = []; let acc = 0;
    for (let i = 0; i < n; i++) {
      if (i) acc += Math.hypot(prof[i][0] - prof[i - 1][0], prof[i][1] - prof[i - 1][1]);
      vv.push(acc);
      const A = i > 0 ? sn(i - 1) : null, Bq = i < n - 1 ? sn(i) : null;
      let x = 0, y = 0; if (A) { x += A[0]; y += A[1]; } if (Bq) { x += Bq[0]; y += Bq[1]; }
      const l = Math.hypot(x, y) || 1; nr.push([x / l, y / l]);
    }
    const G = [];
    for (let i = 0; i < n; i++) {
      const row = [];
      for (let j = 0; j <= seg; j++) {
        const a = a0 + (a1 - a0) * j / seg, sa = Math.sin(a), ca = Math.cos(a);
        let r = prof[i][0]; if (o.wob && r > 0) r *= 1 + o.wob(i, a);
        const cf = o.cf ? tcol(o.cf(i, j, a)) : ONE;
        const uv = o.uvRect ? [o.uvRect[0] + (o.uvRect[2] - o.uvRect[0]) * j / seg, o.uvRect[1] + (o.uvRect[3] - o.uvRect[1]) * i / (n - 1)] : [a * ur, vv[i]];
        row.push({ p: [r * sa, prof[i][1], r * ca], n: [nr[i][0] * sa, nr[i][1], nr[i][0] * ca], uv, c: cf });
      }
      G.push(row);
    }
    const fl = !!o.flat;
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < seg; j++) {
      const a = G[i][j], b = G[i + 1][j], c = G[i + 1][j + 1], d = G[i][j + 1];
      tri(B, a.p, b.p, c.p, a.n, b.n, c.n, a.uv, b.uv, c.uv, a.c, b.c, c.c, fl);
      tri(B, a.p, c.p, d.p, a.n, c.n, d.n, a.uv, c.uv, d.uv, a.c, c.c, d.c, fl);
    }
    return geoOf(B);
  }
  // 관: pts [[x,y,z],...], r(수 또는 t=>r), rs 둘레 조각. o.closed 고리, o.cap 끝 막기
  function tube(pts, r, rs, o) {
    o = o || {};
    rs = rs || 6;
    const n = pts.length, closed = !!o.closed, B = GB(), V = a => new T.Vector3(a[0], a[1], a[2]);
    const Pv = pts.map(V), Tg = [];
    for (let i = 0; i < n; i++) { const a = Pv[closed ? (i - 1 + n) % n : Math.max(0, i - 1)], b = Pv[closed ? (i + 1) % n : Math.min(n - 1, i + 1)]; Tg.push(b.clone().sub(a).normalize()); }
    let nv = Math.abs(Tg[0].y) < 0.9 ? new T.Vector3(0, 1, 0) : new T.Vector3(1, 0, 0);
    const Nm = [], Bn = [];
    for (let i = 0; i < n; i++) { nv = nv.sub(Tg[i].clone().multiplyScalar(nv.dot(Tg[i]))).normalize(); Nm.push(nv.clone()); Bn.push(Tg[i].clone().cross(nv).normalize()); }
    const rings = []; let acc = 0;
    for (let i = 0; i < n; i++) {
      if (i) acc += Pv[i].distanceTo(Pv[i - 1]);
      const rr = typeof r === 'function' ? r(i / Math.max(1, n - 1)) : r, row = [];
      for (let j = 0; j <= rs; j++) {
        const a = j / rs * TAU, d = Nm[i].clone().multiplyScalar(Math.cos(a)).add(Bn[i].clone().multiplyScalar(Math.sin(a)));
        row.push({ p: Pv[i].clone().addScaledVector(d, rr).toArray(), n: d.toArray(), uv: [a * Math.max(rr, 0.01), acc] });
      }
      rings.push(row);
    }
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const A = rings[i], Bq = rings[(i + 1) % n];
      for (let j = 0; j < rs; j++) {
        const a = A[j], b = Bq[j], c = Bq[j + 1], d = A[j + 1];
        tri(B, a.p, b.p, c.p, a.n, b.n, c.n, a.uv, b.uv, c.uv, ONE, ONE, ONE);
        tri(B, a.p, c.p, d.p, a.n, c.n, d.n, a.uv, c.uv, d.uv, ONE, ONE, ONE);
      }
    }
    if (o.cap && !closed) for (const [i, s] of [[0, -1], [n - 1, 1]]) {
      const ctr = pts[i], nn = Tg[i].clone().multiplyScalar(s).toArray(), R0 = rings[i];
      for (let j = 0; j < rs; j++) tri(B, ctr, R0[j].p, R0[j + 1].p, nn, nn, nn, [0, 0], [0.01, 0], [0, 0.01], ONE, ONE, ONE);
    }
    return geoOf(B);
  }
  // 고리 (원환): 반지름 R, 굵기 r, ts 둘레 조각. 지역 xz 평면에 눕는다. arc < TAU면 호
  function torus(R, r, ts, rs, arc, a0) {
    arc = arc === undefined ? TAU : arc; ts = ts || 24; a0 = a0 || 0;
    const full = arc >= TAU - 1e-6, pts = [], m = full ? ts : ts + 1;
    for (let i = 0; i < m; i++) { const a = a0 + arc * i / ts; pts.push([Math.sin(a) * R, 0, Math.cos(a) * R]); }
    return tube(pts, r, rs || 6, { closed: full, cap: !full });
  }
  // 천: f(u,v) → [x,y,z] (u,v ∈ 0..1). nx×ny 격자, 법선은 차분. o.uvRect, o.both 뒷면, o.back 뒷면 밝기, o.uvm [w,h] 미터 uv
  function sheet(nx, ny, f, o) {
    o = o || {};
    const B = GB(), Gp = [], Gn = [];
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) Gp.push(f(i / nx, j / ny));
    const at = (i, j) => Gp[Math.min(ny, Math.max(0, j)) * (nx + 1) + Math.min(nx, Math.max(0, i))];
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
      const a = at(i + 1, j), b = at(i - 1, j), c = at(i, j + 1), d = at(i, j - 1);
      const du = [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dv = [c[0] - d[0], c[1] - d[1], c[2] - d[2]];
      let n = [du[1] * dv[2] - du[2] * dv[1], du[2] * dv[0] - du[0] * dv[2], du[0] * dv[1] - du[1] * dv[0]];
      const l = Math.hypot(n[0], n[1], n[2]) || 1; Gn.push([n[0] / l, n[1] / l, n[2] / l]);
    }
    const R = o.uvRect, um = o.uvm || [1, 1];
    const uvAt = (i, j) => R ? [R[0] + (R[2] - R[0]) * i / nx, R[1] + (R[3] - R[1]) * j / ny] : [i / nx * um[0], j / ny * um[1]];
    const cA = o.cf ? (i, j) => tcol(o.cf(i / nx, j / ny)) : () => ONE;
    for (let side = 0; side < (o.both ? 2 : 1); side++) {
      const s = side ? -1 : 1, kb = side ? (o.back || 0.75) : 1;
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const id = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]].map(([a, b]) => ({ p: at(a, b), n: mul(Gn[b * (nx + 1) + a], s), uv: uvAt(a, b), c: mul(cA(a, b), kb) }));
        const [a, b, c, d] = id;
        tri(B, a.p, b.p, c.p, a.n, b.n, c.n, a.uv, b.uv, c.uv, a.c, b.c, c.c);
        tri(B, a.p, c.p, d.p, a.n, c.n, d.n, a.uv, c.uv, d.uv, a.c, c.c, d.c);
      }
    }
    return geoOf(B);
  }
  // 평면 모양을 두께 depth로 밀어낸다 (z 가운데 정렬). o.bevel 모서리, o.curve 곡선 조각
  function ext(shape, depth, o) {
    o = o || {};
    const bv = o.bevel || 0;
    let g = new T.ExtrudeGeometry(shape, { depth: Math.max(0.0005, depth - bv * 2), bevelEnabled: bv > 0, bevelThickness: bv, bevelSize: bv * 0.9, bevelSegments: 1, curveSegments: o.curve || 8 });
    g.translate(0, 0, -depth / 2 + bv);
    g = g.toNonIndexed(); g.computeVertexNormals();
    const n = g.attributes.position.count, col = new Float32Array(n * 3).fill(1);
    g.setAttribute('color', new T.BufferAttribute(col, 3));
    if (o.uvRect) { // 앞뒤 면을 아틀라스 칸에 맞춘다
      g.computeBoundingBox(); const bb = g.boundingBox, p = g.attributes.position, uv = g.attributes.uv, R = o.uvRect;
      for (let i = 0; i < n; i++) uv.setXY(i, R[0] + (R[2] - R[0]) * (p.getX(i) - bb.min.x) / (bb.max.x - bb.min.x), R[1] + (R[3] - R[1]) * (p.getY(i) - bb.min.y) / (bb.max.y - bb.min.y));
    }
    return g;
  }
  // 네모 한 장 (지역 xy, +z를 본다). uvRect 없으면 미터 uv
  function quad(w, h, uvRect, cb) {
    const B = GB(), x = w / 2, y = h / 2, n = [0, 0, 1], R = uvRect || [-x, -y, x, y], c = cb ? tcol(cb) : ONE;
    const p = [[-x, -y, 0], [x, -y, 0], [x, y, 0], [-x, y, 0]], u = [[R[0], R[1]], [R[2], R[1]], [R[2], R[3]], [R[0], R[3]]];
    for (const k of [0, 1, 2, 0, 2, 3]) vtx(B, p[k], n, u[k], c);
    return geoOf(B);
  }
  // 원판 (평면 uv 0..1, +z를 본다)
  function disc(r, seg) { const g = new T.CircleGeometry(r, seg || 24).toNonIndexed(); g.setAttribute('color', new T.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3)); return g; }
  function tintGeo(g, t) {
    const c = tcol(t); if (!c) return g;
    const a = g.attributes.color.array;
    for (let i = 0; i < a.length; i += 3) { a[i] *= c[0]; a[i + 1] *= c[1]; a[i + 2] *= c[2]; }
    return g;
  }
  P.geo = { cbox, rbox, lathe, tube, torus, sheet, ext, quad, tintGeo };

  // 소품 하나의 지역 좌표틀. k.box(재질, x,y,z, w,h,d, {c, rx,ry,rz, t:틴트, ...cbox 옵션})
  const _mm = new T.Matrix4();
  const L = (x, y, z, rx, ry, rz, s) => M4e(x || 0, y || 0, z || 0, rx || 0, ry || 0, rz || 0, s === undefined ? 1 : s);
  class K {
    constructor(b, x, y, z, r) { this.b = b; this.x = x; this.y = y; this.z = z; this.r = r || 0; this.cs = Math.cos(this.r); this.sn = Math.sin(this.r); this.m = M4(x, y, z, this.r); }
    w(lx, ly, lz) { return [this.x + lx * this.cs + lz * this.sn, this.y + ly, this.z - lx * this.sn + lz * this.cs]; }
    add(key, g, l, t) { if (t !== undefined && t !== null) tintGeo(g, t); this.b.add(key, g, l ? _mm.multiplyMatrices(this.m, l) : this.m); return this; }
    box(key, x, y, z, w, h, d, o) { o = o || {}; return this.add(key, cbox(w, h, d, o.c, o), L(x, y, z, o.rx, o.ry, o.rz), o.t); }
    rb(key, x, y, z, w, h, d, r, o) { o = o || {}; return this.add(key, rbox(w, h, d, r, o.seg || 2, o), L(x, y, z, o.rx, o.ry, o.rz), o.t); }
    lathe(key, prof, x, y, z, o) { o = o || {}; return this.add(key, lathe(prof, o.seg || 12, o), L(x, y, z, o.rx, o.ry, o.rz, o.s), o.t); }
    cyl(key, r, h, x, y, z, o) { o = o || {}; const r2 = o.r2 === undefined ? r : o.r2; return this.lathe(key, [[0, 0], [r, 0], [r, 0], [r2, h], [r2, h], [0, h]], x, y, z, o); }
    tube(key, pts, r, o) { o = o || {}; return this.add(key, tube(pts, r, o.rs || 6, o), o.l || null, o.t); }
    ring(key, R, r, x, y, z, o) { o = o || {}; return this.add(key, torus(R, r, o.ts || 24, o.rs || 6, o.arc, o.a0), L(x, y, z, o.rx, o.ry, o.rz, o.s), o.t); }
    sph(key, r, x, y, z, o) { o = o || {}; const n = o.n || 8, pr = []; for (let i = 0; i <= n; i++) { const a = -PI / 2 + PI * i / n; pr.push([Math.cos(a) * r, Math.sin(a) * r]); } pr[0][0] = 0; pr[n][0] = 0; return this.lathe(key, pr, x, y, z, Object.assign({ seg: o.seg || 12 }, o)); }
    sub(fn, lx, ly, lz, lr, o) { const p = this.w(lx, ly, lz); return fn(this.b, p[0], p[1], p[2], this.r + (lr || 0), o || {}); }
    light(lx, ly, lz, c, k, d, ex) { const p = this.w(lx, ly, lz); return this.b.light(Object.assign({ x: p[0], y: p[1], z: p[2], c, k, d, flicker: true }, ex || {})); }
    col(lx, lz, hw, hd, top, bot, ex) { const p = this.w(lx, 0, lz); return this.b.col(Object.assign({ x: p[0], z: p[2], hw, hd, rot: this.r, top: this.y + top, bot: this.y + (bot || 0) }, ex || {})); }
    fl(lx, ly, lz, size, o) { const p = this.w(lx, ly, lz); flame(this.b, p[0], p[1], p[2], size, o); }
  }
  P.K = K;

  // =====================================================================
  // 3. 캔버스 텍스처
  // =====================================================================
  function canvas(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; }
  function ctex(c, o) {
    o = o || {};
    const t = new T.CanvasTexture(c);
    t.encoding = o.lin ? T.LinearEncoding : T.sRGBEncoding; t.anisotropy = 4;
    if (o.rep !== false) t.wrapS = t.wrapT = T.RepeatWrapping;
    if (o.repeat) t.repeat.set(o.repeat, o.repeat);
    return t;
  }
  // 주기 값 노이즈 (텍스처가 이어지게)
  function pnoise(x, y, px, py, s) {
    const h = (i, j) => { i = ((i % px) + px) % px; j = ((j % py) + py) % py; let q = Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(s, 982451653) | 0; q = Math.imul(q ^ (q >>> 13), 1274126177); return ((q ^ (q >>> 16)) >>> 0) / 4294967296; };
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    return (h(xi, yi) * (1 - u) + h(xi + 1, yi) * u) * (1 - v) + (h(xi, yi + 1) * (1 - u) + h(xi + 1, yi + 1) * u) * v;
  }
  function pfbm(x, y, p, s, oct) { let a = 0, m = 1, t = 0; for (let o = 0; o < (oct || 4); o++) { a += pnoise(x * m, y * m, p * m, p * m, s + o) / m; t += 1 / m; m *= 2; } return a / t; }
  function pixels(g, w, h, f) {
    const im = g.getImageData(0, 0, w, h), d = im.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4, c = f(x, y, d[i], d[i + 1], d[i + 2], d[i + 3]); if (c) { d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; if (c.length > 3) d[i + 3] = c[3]; } }
    g.putImageData(im, 0, 0);
  }
  const hexs = (h, k) => { _c.set(h); if (k) _c.offsetHSL(0, 0, k); return '#' + _c.getHexString(); };
  const rgba = (h, a) => { _c.set(h); return `rgba(${Math.round(_c.r * 255)},${Math.round(_c.g * 255)},${Math.round(_c.b * 255)},${a})`; };
  function speck(g, x0, y0, w, h, n, R, cols, a, sz) { for (let i = 0; i < n; i++) { g.fillStyle = cols[(R() * cols.length) | 0]; g.globalAlpha = (a || 0.2) * R(); const s = (sz || 2) * (0.5 + R()); g.fillRect(x0 + R() * w, y0 + R() * h, s, s); } g.globalAlpha = 1; }
  // 고대 문자 한 줄 (획으로 그린 글리프)
  function glyphs(g, x, y, wmax, sz, R, col, lw) {
    g.strokeStyle = col; g.lineWidth = lw || 1.2; g.lineCap = 'round';
    let xx = x;
    while (xx < x + wmax - sz) {
      if (R() < 0.12) { xx += sz * 0.8; continue; }
      g.beginPath();
      const k = R();
      if (k < 0.3) { g.moveTo(xx, y + sz); g.lineTo(xx + sz * 0.5, y); g.lineTo(xx + sz * 0.8, y + sz); }
      else if (k < 0.5) { g.arc(xx + sz * 0.4, y + sz * 0.5, sz * 0.38, R() * 3, R() * 3 + 4); }
      else if (k < 0.7) { g.moveTo(xx, y); g.lineTo(xx + sz * 0.7, y); g.moveTo(xx + sz * 0.35, y); g.lineTo(xx + sz * 0.35, y + sz); }
      else if (k < 0.85) { g.moveTo(xx, y + sz * 0.5); g.lineTo(xx + sz * 0.7, y + sz * 0.5); g.moveTo(xx + sz * 0.2, y); g.lineTo(xx + sz * 0.5, y + sz); }
      else { g.moveTo(xx, y + sz); g.quadraticCurveTo(xx + sz * 0.4, y - sz * 0.3, xx + sz * 0.8, y + sz); }
      g.stroke();
      xx += sz * (0.85 + R() * 0.4);
    }
  }
  // 12눈금 룬 고리 (칼리도르 문장)
  function runeRing(g, cx, cy, r, col, lw) {
    g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.stroke();
    g.lineWidth = lw * 0.6; g.beginPath(); g.arc(cx, cy, r * 0.72, 0, TAU); g.stroke();
    g.beginPath(); g.arc(cx, cy, r * 1.12, 0, TAU); g.stroke();
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, l = i % 3 === 0 ? 0.3 : 0.18; g.lineWidth = lw * (i % 3 === 0 ? 1 : 0.7); g.beginPath(); g.moveTo(cx + Math.sin(a) * r * 0.74, cy - Math.cos(a) * r * 0.74); g.lineTo(cx + Math.sin(a) * r * (0.74 + l), cy - Math.cos(a) * r * (0.74 + l)); g.stroke(); }
    // 가운데 소리굽쇠
    g.lineWidth = lw * 0.9; g.beginPath(); g.moveTo(cx - r * 0.18, cy - r * 0.42); g.lineTo(cx - r * 0.18, cy); g.quadraticCurveTo(cx - r * 0.18, cy + r * 0.16, cx, cy + r * 0.16); g.quadraticCurveTo(cx + r * 0.18, cy + r * 0.16, cx + r * 0.18, cy); g.lineTo(cx + r * 0.18, cy - r * 0.42); g.moveTo(cx, cy + r * 0.16); g.lineTo(cx, cy + r * 0.48); g.stroke();
    g.beginPath(); g.arc(cx, cy + r * 0.52, r * 0.05, 0, TAU); g.fillStyle = col; g.fill();
  }

  // ---- 책·종이 아틀라스 (1024²) ----
  // 등: 16×2칸 (64×320), 표지 6색 (128², y 640), 책배 768, 책머리 896, 글 쪽 4칸 (256², y 768)
  const AT = {
    px: (x, y, w, h, pad) => { pad = pad === undefined ? 2 : pad; return [(x + pad) / 1024, 1 - (y + h - pad) / 1024, (x + w - pad) / 1024, 1 - (y + pad) / 1024]; },
    spine: i => AT.px((i % 16) * 64, Math.floor(i / 16) % 2 * 320, 64, 320),
    cover: f => AT.px(f * 128, 640, 128, 128, 6),
    edge: () => AT.px(768, 640, 128, 128, 4),
    top: () => AT.px(896, 640, 128, 128, 4),
    page: i => AT.px(i * 256, 768, 256, 256, 3),
  };
  P.AT = AT;
  function bookAtlas() {
    return canvas(1024, 1024, (g) => {
      const R = rng(77), gold = 'rgba(220,182,98,0.95)';
      g.fillStyle = '#2a2018'; g.fillRect(0, 0, 1024, 1024);
      for (let i = 0; i < 32; i++) {
        const x0 = (i % 16) * 64, y0 = Math.floor(i / 16) * 320, fam = i % 6;
        g.fillStyle = hexs(C.book[fam], (R() - 0.5) * 0.09); g.fillRect(x0, y0, 64, 320);
        speck(g, x0, y0, 64, 320, 500, R, ['#000', '#fff', hexs(C.book[fam], 0.1)], 0.16, 2);
        for (let k = 0; k < 6; k++) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.beginPath(); g.ellipse(x0 + R() * 64, y0 + R() * 320, 6 + R() * 14, 10 + R() * 40, 0, 0, TAU); g.fill(); }
        const gr = g.createLinearGradient(x0, 0, x0 + 64, 0);
        gr.addColorStop(0, 'rgba(0,0,0,0.5)'); gr.addColorStop(0.25, 'rgba(255,236,210,0.06)'); gr.addColorStop(0.5, 'rgba(255,236,210,0.14)'); gr.addColorStop(0.8, 'rgba(0,0,0,0.1)'); gr.addColorStop(1, 'rgba(0,0,0,0.55)');
        g.fillStyle = gr; g.fillRect(x0, y0, 64, 320);
        const st = R();
        if (st < 0.5) {
          const nb = 3 + R.i(3);
          for (let k = 0; k < nb; k++) { const y = y0 + 40 + (k + 0.5) * (250 / nb); g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(x0, y + 4, 64, 3); g.fillStyle = 'rgba(255,230,190,0.2)'; g.fillRect(x0, y - 2, 64, 5); if (fam !== 4 || R() < 0.7) { g.fillStyle = gold; g.fillRect(x0 + 2, y - 7, 60, 1.6); g.fillRect(x0 + 2, y + 9, 60, 1.6); } }
        } else {
          const nb = 1 + R.i(3);
          for (let k = 0; k < nb; k++) { g.fillStyle = gold; g.fillRect(x0 + 1, y0 + 12 + k * 9, 62, 3); g.fillRect(x0 + 1, y0 + 305 - k * 9, 62, 3); }
          if (R() < 0.5) { g.strokeStyle = gold; g.lineWidth = 1.4; g.beginPath(); g.arc(x0 + 32, y0 + 230, 12, 0, TAU); g.stroke(); }
        }
        if (R() < 0.65) {
          const ly = y0 + 64 + R() * 50, lh = 30 + R() * 22;
          g.fillStyle = R() < 0.5 ? '#16100b' : hexs(C.book[(fam + 3) % 6], -0.05); g.fillRect(x0 + 6, ly, 52, lh);
          g.strokeStyle = gold; g.lineWidth = 1.2; g.strokeRect(x0 + 8, ly + 2, 48, lh - 4);
          g.fillStyle = gold; for (let r = 0; r < 2; r++) { let xx = x0 + 12; while (xx < x0 + 50) { const lw = 2 + R() * 5; g.fillRect(xx, ly + 8 + r * 11, lw, 3.5); xx += lw + 2; } }
        }
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x0, y0, 64, 4); g.fillRect(x0, y0 + 316, 64, 4);
        g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(x0 + 63, y0, 1, 320);
      }
      // 표지 (가죽 결)
      for (let f = 0; f < 6; f++) {
        const x0 = f * 128, y0 = 640;
        g.fillStyle = hexs(C.book[f], -0.02); g.fillRect(x0, y0, 128, 128);
        speck(g, x0, y0, 128, 128, 900, R, ['#000', '#fff'], 0.12, 1.5);
        g.strokeStyle = 'rgba(214,176,96,0.6)'; g.lineWidth = 1.5; g.strokeRect(x0 + 12, y0 + 12, 104, 104);
        const gr = g.createRadialGradient(x0 + 64, y0 + 64, 20, x0 + 64, y0 + 64, 90); gr.addColorStop(0, 'rgba(255,240,220,0.06)'); gr.addColorStop(1, 'rgba(0,0,0,0.35)'); g.fillStyle = gr; g.fillRect(x0, y0, 128, 128);
      }
      // 책배 (종이 결)
      g.fillStyle = '#e2d3b0'; g.fillRect(768, 640, 128, 128);
      for (let y = 0; y < 128; y += 1.5) { g.fillStyle = `rgba(90,70,40,${0.05 + R() * 0.1})`; g.fillRect(768, 640 + y, 128, 0.7); }
      const ge = g.createLinearGradient(0, 640, 0, 768); ge.addColorStop(0, 'rgba(120,90,50,0.35)'); ge.addColorStop(0.15, 'rgba(0,0,0,0)'); ge.addColorStop(0.85, 'rgba(0,0,0,0)'); ge.addColorStop(1, 'rgba(120,90,50,0.35)'); g.fillStyle = ge; g.fillRect(768, 640, 128, 128);
      // 책머리 (선 책 위: 종이 + 표지 테두리)
      g.fillStyle = '#3a2618'; g.fillRect(896, 640, 128, 128);
      g.fillStyle = '#d9c8a2'; g.fillRect(906, 648, 112, 112);
      for (let x = 0; x < 112; x += 1.6) { g.fillStyle = `rgba(90,70,40,${0.05 + R() * 0.12})`; g.fillRect(906 + x, 648, 0.7, 112); }
      g.fillStyle = 'rgba(40,25,15,0.5)'; g.fillRect(906, 648, 112, 6);
      // 글 쪽 4칸
      const pageBase = (x0, warm) => {
        g.fillStyle = warm ? '#e3cfa2' : '#ece0c4'; g.fillRect(x0, 768, 256, 256);
        speck(g, x0, 768, 256, 256, 1400, R, ['#7a5a30', '#fff8e8'], 0.12, 1.2);
        const gr = g.createRadialGradient(x0 + 128, 896, 60, x0 + 128, 896, 190); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(120,80,40,0.35)'); g.fillStyle = gr; g.fillRect(x0, 768, 256, 256);
      };
      const lines = (x0, y0, w, n, gap, col) => { for (let r = 0; r < n; r++) { let xx = x0, end = x0 + w - (r % 7 === 6 ? w * 0.5 : R() * 8); while (xx < end) { const lw = 4 + R() * 14; g.fillStyle = col; g.globalAlpha = 0.55 + R() * 0.3; g.fillRect(xx, y0 + r * gap, Math.min(lw, end - xx), 2.2); xx += lw + 3; } } g.globalAlpha = 1; };
      // 0: 펼친 책 왼쪽 (머리글자 + 글)
      pageBase(0); g.fillStyle = '#6b2a22'; g.fillRect(24, 798, 30, 30); g.strokeStyle = '#a8843e'; g.lineWidth = 2; g.strokeRect(24, 798, 30, 30);
      lines(62, 800, 170, 3, 9, '#2b2118'); lines(24, 836, 208, 19, 9, '#2b2118');
      // 1: 오른쪽 (도해: 동심원 + 소리굽쇠 + 글)
      pageBase(256); runeRing(g, 384, 860, 46, 'rgba(43,33,24,0.85)', 1.6);
      g.strokeStyle = 'rgba(107,42,34,0.8)'; g.lineWidth = 1; g.beginPath(); for (let x = 0; x < 200; x++) g.lineTo(284 + x, 930 + Math.sin(x * 0.18) * 6 * Math.exp(-x / 120)); g.stroke();
      lines(280, 948, 208, 7, 9, '#2b2118');
      // 2: 편지 (손글씨 + 밀랍 봉인)
      pageBase(512, 1); g.strokeStyle = 'rgba(40,30,22,0.8)'; g.lineWidth = 1.1;
      for (let r = 0; r < 18; r++) { g.beginPath(); let xx = 534; g.moveTo(xx, 800 + r * 11); while (xx < 744 - (r === 17 ? 100 : 0)) { xx += 3; g.lineTo(xx, 800 + r * 11 + Math.sin(xx * 0.9 + r) * 2 * R()); } g.stroke(); }
      g.fillStyle = '#6e2320'; g.beginPath(); g.arc(700, 1000, 11, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,200,160,0.25)'; g.beginPath(); g.arc(697, 997, 5, 0, TAU); g.fill();
      // 3: 고대 문자 메모 + 스케치
      pageBase(768, 1);
      for (let r = 0; r < 9; r++) glyphs(g, 786, 790 + r * 14, 220, 8, R, 'rgba(43,33,24,0.85)', 1.1);
      g.strokeStyle = 'rgba(43,33,24,0.8)'; g.lineWidth = 1.2; for (let k = 1; k <= 4; k++) { g.beginPath(); g.arc(860, 960, k * 11, 0, TAU); g.stroke(); }
      g.beginPath(); g.moveTo(930, 1000); g.lineTo(950, 925); g.lineTo(970, 1000); g.stroke();
      glyphs(g, 990, 940, 40, 8, R, 'rgba(110,35,32,0.9)', 1.2);
    });
  }
  // ---- 천 ----
  function linenTex() {
    return canvas(256, 256, (g, w, h) => {
      g.fillStyle = '#eee6d6'; g.fillRect(0, 0, w, h);
      pixels(g, w, h, (x, y) => { const t = 0.92 + 0.05 * Math.sin(x * PI / 2) * Math.sin(y * PI / 2 + 1) + (pnoise(x / 8, y / 8, 32, 32, 3) - 0.5) * 0.08 + (pnoise(x, y * 0.05, 256, 13, 9) - 0.5) * 0.06; const v = 236 * t; return [v, v * 0.97, v * 0.92]; });
    });
  }
  function velvetTex() {
    return canvas(256, 256, (g, w, h) => {
      pixels(g, w, h, (x, y) => { const n = pfbm(x / 64, y / 64, 4, 11, 4), s = pnoise(x / 16 + n * 3, y / 64, 16, 4, 5); const v = 200 + (n - 0.5) * 70 + (s - 0.5) * 40; return [v, v, v]; });
    });
  }
  function quiltTex() {
    return canvas(512, 512, (g) => {
      const R = rng(5), cols = ['#6b2a22', '#2a2f5e', '#a8843e', '#3e4a2a', '#e6d8bc', '#5e1e22', '#7a5a3a', '#4a5a7a'];
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        const c = cols[R.i(cols.length)]; g.fillStyle = c; g.fillRect(x * 64, y * 64, 64, 64);
        if (R() < 0.4) { g.fillStyle = cols[R.i(cols.length)]; g.beginPath(); g.moveTo(x * 64, y * 64); g.lineTo(x * 64 + 64, y * 64 + 64); g.lineTo(x * 64, y * 64 + 64); g.fill(); }
        else if (R() < 0.3) { g.fillStyle = cols[R.i(cols.length)]; g.fillRect(x * 64 + 16, y * 64 + 16, 32, 32); }
      }
      g.strokeStyle = 'rgba(240,230,210,0.5)'; g.setLineDash([3, 3]); g.lineWidth = 1;
      for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(i * 64 + 3, 0); g.lineTo(i * 64 + 3, 512); g.moveTo(0, i * 64 + 3); g.lineTo(512, i * 64 + 3); g.stroke(); }
      g.setLineDash([]);
      pixels(g, 512, 512, (x, y, r, gg, b) => { const k = 0.85 + 0.2 * pnoise(x / 6, y / 6, 86, 86, 2) - 0.15 * Math.pow(Math.abs(Math.sin((x % 64) / 64 * PI) * Math.sin((y % 64) / 64 * PI)), 0.3) * 0; return [r * k, gg * k, b * k]; });
    });
  }
  // ---- 깃발: 남색 벨벳, 황동 테두리, 12눈금 룬 고리. 아래는 제비꼬리 (알파) ----
  function bannerTex() {
    return canvas(256, 640, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.save(); g.beginPath(); g.moveTo(0, 0); g.lineTo(w, 0); g.lineTo(w, h); g.lineTo(w / 2, h - 90); g.lineTo(0, h); g.closePath(); g.clip();
      const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#20244a'); gr.addColorStop(0.5, '#2c3266'); gr.addColorStop(1, '#20244a'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      pixels(g, w, h, (x, y, r, gg, b, a) => { const n = pnoise(x / 12, y / 30, 22, 22, 4) * 0.25 + 0.88; return [r * n, gg * n, b * n, a]; });
      const gold = '#c9a45c';
      g.strokeStyle = gold; g.lineWidth = 5; g.beginPath(); g.moveTo(14, 40); g.lineTo(14, h - 30); g.lineTo(w / 2, h - 112); g.lineTo(w - 14, h - 30); g.lineTo(w - 14, 40); g.stroke();
      g.lineWidth = 1.5; g.beginPath(); g.moveTo(24, 40); g.lineTo(24, h - 48); g.lineTo(w / 2, h - 124); g.lineTo(w - 24, h - 48); g.lineTo(w - 24, 40); g.stroke();
      g.fillStyle = gold; g.fillRect(0, 0, w, 34); g.fillStyle = '#8a6a2e'; g.fillRect(0, 30, w, 4);
      runeRing(g, w / 2, 250, 78, gold, 6);
      g.strokeStyle = 'rgba(30,22,10,0.35)'; g.lineWidth = 1;
      for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(w / 2, 250, 100 + i * 9, 0, TAU); g.stroke(); }
      glyphs(g, 50, 400, 160, 14, rng(9), gold, 2.5);
      g.restore();
    });
  }
  // ---- 벽걸이 융단: 학원 첨탑과 거대한 혼천의, 무늬 테두리, 아래 술 ----
  function tapestryTex() {
    return canvas(512, 384, (g, w, h) => {
      const R = rng(31);
      g.clearRect(0, 0, w, h);
      g.fillStyle = '#4a2a22'; g.fillRect(0, 0, w, h - 24);
      g.fillStyle = '#2f3550'; g.fillRect(22, 22, w - 44, h - 70);
      const sky = g.createLinearGradient(0, 22, 0, 260); sky.addColorStop(0, '#2c3458'); sky.addColorStop(1, '#7a6a5a'); g.fillStyle = sky; g.fillRect(30, 30, w - 60, 230);
      g.fillStyle = '#c9a45c'; for (let i = 0; i < 30; i++) g.fillRect(40 + R() * (w - 80), 36 + R() * 100, 2, 2);
      g.fillStyle = '#4a5a3a'; g.beginPath(); g.moveTo(30, 300); for (let x = 30; x <= w - 30; x += 10) g.lineTo(x, 250 + Math.sin(x * 0.03) * 12 + R() * 4); g.lineTo(w - 30, 306); g.lineTo(30, 306); g.fill();
      const tw = [[120, 150, 22], [170, 110, 26], [215, 70, 30], [262, 120, 22], [300, 95, 26], [350, 140, 20], [395, 160, 18]];
      for (const [x, y, ww] of tw) { g.fillStyle = '#b9965e'; g.fillRect(x - ww / 2, y, ww, 260 - y); g.fillStyle = '#3e4656'; g.beginPath(); g.moveTo(x - ww / 2 - 4, y); g.lineTo(x, y - ww * 1.8); g.lineTo(x + ww / 2 + 4, y); g.fill(); g.fillStyle = '#e8b85a'; for (let k = 0; k < 3; k++) g.fillRect(x - 3, y + 20 + k * 30, 6, 10); }
      g.strokeStyle = '#d8b25a'; g.lineWidth = 3; for (let k = 0; k < 3; k++) { g.beginPath(); g.ellipse(256, 80, 60, 60 * (0.3 + k * 0.35), k * 0.6, 0, TAU); g.stroke(); }
      g.fillStyle = '#7ff0ff'; g.beginPath(); g.arc(256, 80, 7, 0, TAU); g.fill();
      for (let x = 22; x < w - 22; x += 16) { g.fillStyle = (x / 16) % 2 ? '#a8843e' : '#6b2a22'; g.beginPath(); g.moveTo(x, 10); g.lineTo(x + 8, 18); g.lineTo(x + 16, 10); g.lineTo(x + 8, 2); g.fill(); g.beginPath(); g.moveTo(x, h - 38); g.lineTo(x + 8, h - 30); g.lineTo(x + 16, h - 38); g.lineTo(x + 8, h - 46); g.fill(); }
      pixels(g, w, h, (x, y, r, gg, b, a) => { if (y >= h - 24) { const s = (x % 6) < 3 && y < h - 24 + 18 + ((x * 7) % 5); return s ? [200, 180, 140, 255] : [0, 0, 0, 0]; } const k = 0.82 + 0.12 * ((x + (y % 2)) % 2) + (pnoise(x / 3, y / 3, 171, 128, 3) - 0.5) * 0.18; return [r * k, gg * k, b * k, a]; });
    });
  }
  // ---- 깔개 2종 (512×1024, 끝에 술 = 알파) ----
  function rugTex() {
    return canvas(1024, 1024, (g) => {
      const R = rng(41);
      g.clearRect(0, 0, 1024, 1024);
      const des = [['#5e1e22', '#2a2f5e', '#a8843e', '#e6d8bc', '#1e1612'], ['#2a2f5e', '#6b2a22', '#c9a45c', '#d8c8a8', '#141420']];
      for (let k = 0; k < 2; k++) {
        const x0 = k * 512, [field, border, acc, ivory, dark] = des[k], y0 = 32, H = 960;
        g.fillStyle = dark; g.fillRect(x0 + 8, y0, 496, H);
        g.fillStyle = border; g.fillRect(x0 + 16, y0 + 8, 480, H - 16);
        g.fillStyle = ivory; g.fillRect(x0 + 30, y0 + 22, 452, H - 44);
        g.fillStyle = border; g.fillRect(x0 + 36, y0 + 28, 440, H - 56);
        for (let i = 0; i < 26; i++) { const yy = y0 + 50 + i * 34.5; for (const xx of [x0 + 52, x0 + 460]) { g.fillStyle = i % 2 ? acc : ivory; g.beginPath(); g.moveTo(xx, yy - 10); g.lineTo(xx + 9, yy); g.lineTo(xx, yy + 10); g.lineTo(xx - 9, yy); g.fill(); } }
        for (let i = 0; i < 12; i++) { const xx = x0 + 90 + i * 30; for (const yy of [y0 + 50, y0 + H - 50]) { g.fillStyle = i % 2 ? acc : ivory; g.beginPath(); g.arc(xx, yy, 7, 0, TAU); g.fill(); } }
        g.fillStyle = dark; g.fillRect(x0 + 76, y0 + 74, 360, H - 148);
        g.fillStyle = field; g.fillRect(x0 + 82, y0 + 80, 348, H - 160);
        if (k === 0) {
          for (let yy = y0 + 110; yy < y0 + H - 100; yy += 60) for (let xx = x0 + 110; xx < x0 + 420; xx += 60) { g.strokeStyle = rgba(0xa8843e, 0.5); g.lineWidth = 2; g.beginPath(); g.moveTo(xx, yy - 18); g.lineTo(xx + 18, yy); g.lineTo(xx, yy + 18); g.lineTo(xx - 18, yy); g.closePath(); g.stroke(); }
          const cy = y0 + H / 2; g.fillStyle = border; g.beginPath(); g.ellipse(x0 + 256, cy, 120, 210, 0, 0, TAU); g.fill();
          g.fillStyle = field; g.beginPath(); g.ellipse(x0 + 256, cy, 104, 190, 0, 0, TAU); g.fill();
          runeRing(g, x0 + 256, cy, 70, acc, 5);
          for (const s of [-1, 1]) { g.fillStyle = border; g.beginPath(); g.moveTo(x0 + 82, cy + s * 380); g.quadraticCurveTo(x0 + 256, cy + s * 300, x0 + 430, cy + s * 380); g.lineTo(x0 + 430, cy + s * 400); g.lineTo(x0 + 82, cy + s * 400); g.fill(); }
        } else {
          for (let yy = y0 + 100; yy < y0 + H - 90; yy += 76) for (let xx = x0 + 120; xx < x0 + 420; xx += 92) {
            g.fillStyle = (Math.round(yy / 76) + Math.round(xx / 92)) % 2 ? border : acc; g.beginPath(); g.moveTo(xx, yy - 30); g.lineTo(xx + 30, yy); g.lineTo(xx, yy + 30); g.lineTo(xx - 30, yy); g.fill();
            g.fillStyle = ivory; g.beginPath(); g.arc(xx, yy, 7, 0, TAU); g.fill();
          }
        }
        // 술
        for (const yy of [0, 1024 - 32]) for (let xx = x0 + 12; xx < x0 + 500; xx += 5) { g.fillStyle = '#d8ccb0'; g.fillRect(xx, yy + (yy ? 0 : 4 + R() * 6), 2.5, 22 + R() * 6); }
      }
      // 닳음과 올
      pixels(g, 1024, 1024, (x, y, r, gg, b, a) => { if (!a) return null; const n = pnoise(x / 2, y / 2, 512, 512, 7), wv = pfbm(x / 128, y / 128, 8, 13, 3); const k = 0.8 + 0.22 * n - Math.max(0, wv - 0.62) * 0.9; return [r * k, gg * k, b * k, a]; });
    });
  }
  // ---- 칠판 (고대 문자 + 도해, 지운 자국) ----
  function chalkTex() {
    return canvas(1024, 512, (g, w, h) => {
      const R = rng(53);
      g.fillStyle = '#25302b'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 26; i++) { g.fillStyle = 'rgba(200,210,200,0.05)'; g.beginPath(); g.ellipse(R() * w, R() * h, 40 + R() * 120, 15 + R() * 40, R() * 3, 0, TAU); g.fill(); }
      const ch = 'rgba(232,232,220,0.85)';
      for (let r = 0; r < 7; r++) glyphs(g, 40, 40 + r * 34, 480 - R() * 120, 18, R, ch, 2.2);
      g.strokeStyle = ch; g.lineWidth = 2.2;
      for (let k = 1; k <= 4; k++) { g.beginPath(); g.arc(760, 170, k * 30, 0, TAU); g.stroke(); }
      for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; g.beginPath(); g.moveTo(760 + Math.sin(a) * 120, 170 - Math.cos(a) * 120); g.lineTo(760 + Math.sin(a) * 138, 170 - Math.cos(a) * 138); g.stroke(); }
      g.beginPath(); for (let x = 0; x < 380; x++) g.lineTo(560 + x, 400 + Math.sin(x * 0.08) * 34 * Math.exp(-x / 260)); g.stroke();
      g.beginPath(); g.moveTo(80, 330); g.lineTo(80, 420); g.quadraticCurveTo(80, 450, 110, 450); g.quadraticCurveTo(140, 450, 140, 420); g.lineTo(140, 330); g.moveTo(110, 450); g.lineTo(110, 490); g.stroke();
      glyphs(g, 180, 370, 300, 20, R, 'rgba(240,210,150,0.8)', 2.4);
      g.fillStyle = 'rgba(200,200,190,0.12)'; g.fillRect(560, 250, 140, 80);
      pixels(g, w, h, (x, y, r, gg, b) => { const n = (pnoise(x / 2, y / 2, 512, 256, 4) - 0.5) * 18; return [r + n, gg + n, b + n]; });
    });
  }
  // ---- 지도 아틀라스: 왼쪽 양피지 지도 512², 오른쪽 지구의 512² ----
  function mapTex() {
    return canvas(1024, 512, (g) => {
      const R = rng(61);
      const land = (cx, cy, r, s, ox, sc) => { g.beginPath(); for (let i = 0; i <= 64; i++) { const a = i / 64 * TAU, rr = r * (0.7 + 0.5 * pfbm(Math.cos(a) * 2 + s, Math.sin(a) * 2 + s, 64, s | 0, 3)); g.lineTo(ox + cx + Math.cos(a) * rr * sc, cy + Math.sin(a) * rr); } g.closePath(); };
      // 지도
      g.fillStyle = '#e3cfa0'; g.fillRect(0, 0, 512, 512);
      pixels(g, 1024, 512, (x, y, r, gg, b) => { if (x >= 512) return null; const n = pfbm(x / 128, y / 128, 4, 3, 4); const e = Math.min(x, y, 511 - x, 511 - y); const k = 0.82 + n * 0.25 - Math.max(0, 30 - e) / 30 * 0.25; return [r * k, gg * k, b * k]; });
      g.strokeStyle = 'rgba(110,70,40,0.25)'; g.lineWidth = 1; for (let i = 0; i < 16; i++) { const a = i / 16 * PI; g.beginPath(); g.moveTo(256 - Math.cos(a) * 360, 256 - Math.sin(a) * 360); g.lineTo(256 + Math.cos(a) * 360, 256 + Math.sin(a) * 360); g.stroke(); }
      g.fillStyle = 'rgba(160,140,90,0.55)'; land(200, 220, 140, 1.3, 0, 1); g.fill(); g.strokeStyle = '#4a3420'; g.lineWidth = 2; g.stroke();
      land(400, 380, 70, 4.1, 0, 1); g.fill(); g.stroke(); land(380, 110, 40, 7.7, 0, 1); g.fill(); g.stroke();
      g.strokeStyle = '#3a5a7a'; g.lineWidth = 2; g.beginPath(); g.moveTo(120, 140); g.bezierCurveTo(180, 200, 160, 260, 240, 330); g.stroke();
      g.strokeStyle = '#4a3420'; g.lineWidth = 1.3; for (let i = 0; i < 22; i++) { const x = 140 + R() * 140, y = 150 + R() * 120; g.beginPath(); g.moveTo(x - 7, y + 6); g.lineTo(x, y - 6); g.lineTo(x + 7, y + 6); g.stroke(); }
      g.fillStyle = '#6b2a22'; g.beginPath(); g.arc(215, 235, 6, 0, TAU); g.fill(); runeRing(g, 215, 235, 12, '#6b2a22', 1.2);
      g.save(); g.translate(430, 440); g.strokeStyle = '#4a3420'; g.fillStyle = '#a8843e'; for (let i = 0; i < 8; i++) { g.rotate(PI / 4); g.beginPath(); g.moveTo(0, 0); g.lineTo(5, -8); g.lineTo(0, i % 2 ? -22 : -36); g.lineTo(-5, -8); g.closePath(); g.fill(); g.stroke(); } g.restore();
      g.fillStyle = '#e8d8b0'; g.fillRect(30, 30, 150, 46); g.strokeStyle = '#4a3420'; g.strokeRect(34, 34, 142, 38); glyphs(g, 44, 46, 130, 12, R, '#3a2a1a', 1.5);
      // 지구의
      g.fillStyle = '#7a8f86'; g.fillRect(512, 0, 512, 512);
      g.fillStyle = '#c9b07a'; land(150, 180, 120, 2.2, 512, 1.6); g.fill(); land(330, 330, 90, 5.4, 512, 1.4); g.fill(); land(420, 140, 60, 8.8, 512, 1.6); g.fill(); land(60, 380, 50, 3.3, 512, 1.5); g.fill();
      g.strokeStyle = 'rgba(60,40,20,0.35)'; g.lineWidth = 1; for (let i = 1; i < 12; i++) { g.beginPath(); g.moveTo(512 + i * 42.6, 0); g.lineTo(512 + i * 42.6, 512); g.stroke(); } for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(512, i * 85); g.lineTo(1024, i * 85); g.stroke(); }
      pixels(g, 1024, 512, (x, y, r, gg, b) => { if (x < 512) return null; const k = 0.85 + pfbm(x / 64, y / 64, 16, 8, 3) * 0.25; return [r * k, gg * k, b * k]; });
    });
  }
  // ---- 그림 (해 질 녘 학원 풍경, 유화 붓 자국) ----
  function paintTex() {
    return canvas(512, 384, (g, w, h) => {
      const R = rng(71);
      const sk = g.createLinearGradient(0, 0, 0, h); sk.addColorStop(0, '#2f3f6a'); sk.addColorStop(0.45, '#c98a5a'); sk.addColorStop(0.6, '#e8b878'); sk.addColorStop(1, '#3a3020'); g.fillStyle = sk; g.fillRect(0, 0, w, h);
      g.fillStyle = '#3a3a4a'; g.beginPath(); g.moveTo(0, 260); for (let x = 0; x <= w; x += 8) g.lineTo(x, 230 + Math.sin(x * 0.02) * 20 + R() * 5); g.lineTo(w, h); g.lineTo(0, h); g.fill();
      for (let i = 0; i < 9; i++) { const x = 140 + i * 30 + R() * 10, hh = 60 + R() * 120; g.fillStyle = '#5a4a3a'; g.fillRect(x, 240 - hh, 18, hh); g.fillStyle = '#2e3646'; g.beginPath(); g.moveTo(x - 4, 240 - hh); g.lineTo(x + 9, 240 - hh - 40 - R() * 30); g.lineTo(x + 22, 240 - hh); g.fill(); if (R() < 0.6) { g.fillStyle = '#ffc070'; g.fillRect(x + 6, 240 - hh + 20, 5, 8); } }
      g.fillStyle = '#1e2a2a'; g.beginPath(); g.moveTo(0, 330); g.quadraticCurveTo(250, 290, w, 340); g.lineTo(w, h); g.lineTo(0, h); g.fill();
      for (let i = 0; i < 2500; i++) { const x = R() * w, y = R() * h, d = g.getImageData(x | 0, y | 0, 1, 1).data; g.fillStyle = `rgba(${d[0]},${d[1]},${d[2]},0.5)`; g.beginPath(); g.ellipse(x, y, 4 + R() * 6, 1.5 + R() * 2, R() * 0.6 - 0.3, 0, TAU); g.fill(); }
      const v = g.createRadialGradient(w / 2, h / 2, 100, w / 2, h / 2, 320); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(30,20,10,0.55)'); g.fillStyle = v; g.fillRect(0, 0, w, h);
    });
  }
  // ---- 기억 유리 (스테인드글라스 학자상: 납선 + 보석빛) ----
  function memoryTex() {
    return canvas(256, 512, (g, w, h) => {
      const R = rng(83), pane = ['#2A4FA8', '#9E1F2A', '#D39A2A', '#2F7A4A', '#5A3A8A', '#c8b890', '#3a6a9a'];
      g.fillStyle = '#141414'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 32) for (let x = 0; x < w; x += 32) { g.fillStyle = hexs(pane[(x / 32 + y / 32) % 2 ? 0 : 5], (R() - 0.5) * 0.1); g.fillRect(x + 2, y + 2, 28, 28); }
      g.fillStyle = '#141414'; g.beginPath(); g.moveTo(40, h - 30); g.lineTo(40, 170); g.quadraticCurveTo(128, 30, 216, 170); g.lineTo(216, h - 30); g.fill();
      const sky = g.createLinearGradient(0, 80, 0, h); sky.addColorStop(0, '#3a6ab8'); sky.addColorStop(1, '#5a3a8a');
      g.fillStyle = sky; g.beginPath(); g.moveTo(48, h - 38); g.lineTo(48, 172); g.quadraticCurveTo(128, 46, 208, 172); g.lineTo(208, h - 38); g.fill();
      g.fillStyle = '#9E1F2A'; g.beginPath(); g.moveTo(128, 150); g.quadraticCurveTo(80, 200, 78, h - 50); g.lineTo(178, h - 50); g.quadraticCurveTo(176, 200, 128, 150); g.fill();
      g.fillStyle = '#e8d0a8'; g.beginPath(); g.arc(128, 140, 22, 0, TAU); g.fill();
      g.fillStyle = '#D39A2A'; g.beginPath(); g.arc(128, 140, 36, PI * 1.05, PI * 1.95); g.lineTo(150, 140); g.arc(128, 140, 24, PI * 1.95, PI * 1.05, true); g.fill();
      g.fillStyle = '#efe0b8'; g.fillRect(100, 260, 56, 36);
      g.fillStyle = '#2F7A4A'; g.fillRect(48, h - 90, 160, 52);
      g.strokeStyle = '#141414'; g.lineWidth = 4;
      for (let i = 0; i < 26; i++) { g.beginPath(); const x = 48 + R() * 160, y = 60 + R() * (h - 120); g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * 70, y + (R() - 0.5) * 70); g.stroke(); }
      g.lineWidth = 6; g.beginPath(); g.moveTo(40, h - 30); g.lineTo(40, 170); g.quadraticCurveTo(128, 30, 216, 170); g.lineTo(216, h - 30); g.closePath(); g.stroke();
      g.beginPath(); g.moveTo(128, 150); g.quadraticCurveTo(80, 200, 78, h - 50); g.lineTo(178, h - 50); g.quadraticCurveTo(176, 200, 128, 150); g.stroke(); g.beginPath(); g.arc(128, 140, 22, 0, TAU); g.stroke(); g.strokeRect(100, 260, 56, 36);
      pixels(g, w, h, (x, y, r, gg, b) => { const n = 0.8 + pnoise(x / 5, y / 5, 52, 103, 6) * 0.35; return [r * n, gg * n, b * n]; });
    });
  }
  function clockTex() {
    return canvas(256, 256, (g) => {
      g.fillStyle = '#c9a45c'; g.fillRect(0, 0, 256, 256);
      g.fillStyle = '#ece0c4'; g.beginPath(); g.arc(128, 128, 112, 0, TAU); g.fill();
      runeRing(g, 128, 128, 82, '#2b2118', 3);
      g.strokeStyle = '#2b2118'; g.lineWidth = 2; for (let i = 0; i < 60; i++) { const a = i / 60 * TAU; g.beginPath(); g.moveTo(128 + Math.sin(a) * 104, 128 - Math.cos(a) * 104); g.lineTo(128 + Math.sin(a) * 110, 128 - Math.cos(a) * 110); g.stroke(); }
      const gr = g.createRadialGradient(128, 128, 60, 128, 128, 128); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(90,60,20,0.3)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    });
  }
  // ---- 잎 (알파): 왼쪽 넓은 잎, 오른쪽 마른 허브 가지 ----
  function leafTex() {
    return canvas(512, 256, (g) => {
      g.clearRect(0, 0, 512, 256);
      const lg = g.createLinearGradient(0, 0, 256, 0); lg.addColorStop(0, '#3e5a2a'); lg.addColorStop(0.5, '#6a8a44'); lg.addColorStop(1, '#3e5a2a');
      g.fillStyle = lg; g.beginPath(); g.moveTo(128, 250); g.bezierCurveTo(10, 180, 30, 40, 128, 4); g.bezierCurveTo(226, 40, 246, 180, 128, 250); g.fill();
      g.strokeStyle = 'rgba(200,220,150,0.6)'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(128, 250); g.lineTo(128, 10); g.stroke();
      g.lineWidth = 1.2; for (let i = 0; i < 9; i++) { const y = 220 - i * 23; g.beginPath(); g.moveTo(128, y); g.quadraticCurveTo(100, y - 16, 70 + i * 3, y - 34); g.moveTo(128, y); g.quadraticCurveTo(156, y - 16, 186 - i * 3, y - 34); g.stroke(); }
      g.strokeStyle = '#6a5a38'; g.lineWidth = 3; g.beginPath(); g.moveTo(384, 256); g.lineTo(384, 10); g.stroke();
      const R = rng(3);
      for (let i = 0; i < 26; i++) { const y = 240 - i * 9, s = R.s(); g.fillStyle = ['#7a7a4a', '#8a8256', '#6a6a3e', '#9a8a5a'][R.i(4)]; g.beginPath(); g.ellipse(384 + s * 14, y, 14, 5, s * 0.6, 0, TAU); g.fill(); }
      g.fillStyle = '#8a6aa8'; for (let i = 0; i < 12; i++) { g.beginPath(); g.arc(384 + (R() - 0.5) * 10, 12 + i * 6, 4, 0, TAU); g.fill(); }
    });
  }
  function radialTex() {
    return canvas(128, 128, (g) => {
      const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.45)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    });
  }
  function noiseTex(seed, base, amp, sc) {
    return canvas(256, 256, (g, w, h) => pixels(g, w, h, (x, y) => { const n = pfbm(x / (sc || 32), y / (sc || 32), 256 / (sc || 32), seed, 4); const v = base + (n - 0.5) * amp; return [v, v, v]; }));
  }
  function coalTex() {
    return canvas(256, 256, (g, w, h) => pixels(g, w, h, (x, y) => { const n = pfbm(x / 32, y / 32, 8, 21, 4), cr = Math.abs(pfbm(x / 20, y / 20, 12.8, 22, 3) - 0.5); const hot = Math.max(0, 1 - cr * 9) * (0.4 + n); return [40 + hot * 215, 22 + hot * 90, 14 + hot * 20]; }));
  }
  function leadedTex() {
    return canvas(256, 256, (g, w, h) => {
      const R = rng(97);
      pixels(g, w, h, (x, y) => { const u = (x + y) / 64, v = (x - y + 256) / 64, du = Math.abs(u - Math.round(u)), dv = Math.abs(v - Math.round(v)); const lead = Math.min(du, dv) < 0.045; if (lead) return [18, 18, 20]; const n = 0.75 + pnoise(Math.floor(u) * 3.1, Math.floor(v) * 2.7, 1000, 1000, 5) * 0.4 + (pnoise(x / 9, y / 9, 28.4, 28.4, 6) - 0.5) * 0.2; return [150 * n, 175 * n, 230 * n]; });
    });
  }

  // =====================================================================
  // 4. 재질 등록 (batch.js BATCH_MATS)
  // =====================================================================
  const lazy = f => { let v; return () => v || (v = f()); };
  const TX = {
    books: lazy(() => ctex(bookAtlas(), { rep: false })), linen: lazy(() => ctex(linenTex(), { repeat: 3 })), velvet: lazy(() => ctex(velvetTex(), { repeat: 2 })),
    quilt: lazy(() => ctex(quiltTex(), { repeat: 1.4 })), banner: lazy(() => ctex(bannerTex(), { rep: false })), tapestry: lazy(() => ctex(tapestryTex(), { rep: false })),
    rug: lazy(() => ctex(rugTex(), { rep: false })), chalk: lazy(() => ctex(chalkTex(), { rep: false })), map: lazy(() => ctex(mapTex(), { rep: false })),
    paint: lazy(() => ctex(paintTex(), { rep: false })), memory: lazy(() => ctex(memoryTex(), { rep: false })), clock: lazy(() => ctex(clockTex(), { rep: false })),
    leaf: lazy(() => ctex(leafTex(), { rep: false })), radial: lazy(() => ctex(radialTex(), { rep: false })), coal: lazy(() => ctex(coalTex(), { repeat: 2 })),
    n1: lazy(() => ctex(noiseTex(3, 200, 90, 24), { repeat: 4 })), n2: lazy(() => ctex(noiseTex(8, 210, 60, 12), { repeat: 6 })), leaded: lazy(() => ctex(leadedTex(), { repeat: 1.6 })),
  };
  P.TX = TX;
  const std = o => new T.MeshStandardMaterial(Object.assign({ vertexColors: true, roughness: 0.8, metalness: 0 }, o));
  // 발광 × 정점색, 시간 흔들기 등 셰이더 덧대기
  function patch(m, o) {
    m.onBeforeCompile = sh => {
      sh.uniforms.uT = U.time;
      if (o.frag) sh.fragmentShader = 'uniform float uT;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + o.frag);
      if (o.vert) sh.vertexShader = 'uniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + o.vert);
      if (o.nfrag) sh.fragmentShader = (o.frag ? '' : 'uniform float uT;\n') + sh.fragmentShader.replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + o.nfrag);
    };
    m.customProgramCacheKey = () => 'props-' + (o.key || '');
    return m;
  }
  const RG = (k, f) => { if (typeof BATCH_MATS !== 'undefined') BATCH_MATS[k] = () => { const m = f(); m.name = k; return m; }; };
  RG('pBooks', () => std({ map: TX.books(), roughness: 0.78 }));
  RG('pLinen', () => std({ map: TX.linen(), roughness: 0.95, side: T.DoubleSide }));
  RG('pVelvet', () => new T.MeshPhysicalMaterial({ vertexColors: true, map: TX.velvet(), roughness: 0.82, sheen: 1, sheenRoughness: 0.4, sheenColor: new T.Color(0x8a7a90), side: T.DoubleSide }));
  RG('pQuilt', () => std({ map: TX.quilt(), roughness: 0.95, side: T.DoubleSide }));
  RG('pGlass', () => { const m = std({ roughness: 0.06, metalness: 0.1, transparent: true, opacity: 0.42, depthWrite: false, envMapIntensity: 1.6 }); m.userData.noShadow = 1; return m; });
  RG('pLiquid', () => patch(std({ roughness: 0.15, emissive: 0xffffff, emissiveIntensity: 0.22 }), { key: 'liq', frag: 'totalEmissiveRadiance *= vColor;' }));
  RG('pWax', () => std({ roughness: 0.55, map: TX.n2() }));
  RG('pWaxLit', () => patch(std({ roughness: 0.5, emissive: 0xff9440, emissiveIntensity: 0.85 }), { key: 'wax', frag: 'totalEmissiveRadiance *= vColor * (0.9 + 0.1 * sin(uT * 9.0 + vViewPosition.x * 40.0));' }));
  RG('pFood', () => std({ map: TX.n1(), roughness: 0.6 }));
  RG('pCeramic', () => std({ roughness: 0.2, map: TX.n2() }));
  RG('pClay', () => std({ roughness: 0.95, map: TX.n1() }));
  RG('pPewter', () => std({ metalness: 0.85, roughness: 0.42, map: TX.n1() }));
  RG('pGlowAdd', () => { const m = new T.MeshBasicMaterial({ map: TX.radial(), transparent: true, blending: T.AdditiveBlending, depthWrite: false, vertexColors: true, toneMapped: false, fog: false, polygonOffset: true, polygonOffsetFactor: -2 }); m.userData.glow = 1; m.userData.noShadow = 1; return m; });
  RG('pSoot', () => { const m = new T.MeshBasicMaterial({ map: TX.radial(), color: 0x0c0806, transparent: true, opacity: 0.75, depthWrite: false, vertexColors: true, polygonOffset: true, polygonOffsetFactor: -1 }); m.userData.glow = 1; m.userData.noShadow = 1; return m; });
  RG('pBanner', () => patch(new T.MeshPhysicalMaterial({ vertexColors: true, map: TX.banner(), alphaTest: 0.5, side: T.DoubleSide, roughness: 0.8, sheen: 1, sheenRoughness: 0.45, sheenColor: new T.Color(0x6a70a8) }),
    { key: 'ban', vert: 'transformed += objectNormal * (sin(uT * 1.1 + position.x * 1.3 + position.z * 1.1) * 0.04 + sin(uT * 2.3 + position.y * 2.0) * 0.012) * pow(max(0.0, 1.0 - uv.y), 1.5);' }));
  RG('pTapestry', () => std({ map: TX.tapestry(), alphaTest: 0.5, side: T.DoubleSide, roughness: 0.95 }));
  RG('pRug', () => std({ map: TX.rug(), alphaTest: 0.4, roughness: 0.96 }));
  RG('pChalk', () => std({ map: TX.chalk(), roughness: 0.92 }));
  RG('pMap', () => std({ map: TX.map(), roughness: 0.82 }));
  RG('pPaint', () => std({ map: TX.paint(), roughness: 0.55 }));
  RG('pMemory', () => patch(std({ map: TX.memory(), emissiveMap: TX.memory(), emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.12, metalness: 0.1 }),
    { key: 'mem', frag: 'totalEmissiveRadiance *= 0.65 + 0.55 * smoothstep(0.55, 1.0, sin(vUv.y * 5.0 - uT * 0.5 + vUv.x * 2.0) * 0.5 + 0.5);' }));
  RG('pClock', () => std({ map: TX.clock(), roughness: 0.4 }));
  RG('pPlant', () => std({ map: TX.leaf(), alphaTest: 0.5, side: T.DoubleSide, roughness: 0.75 }));
  RG('pCoal', () => patch(std({ map: TX.coal(), emissiveMap: TX.coal(), emissive: 0xff7a30, emissiveIntensity: 2.2, roughness: 0.9 }),
    { key: 'coal', frag: 'totalEmissiveRadiance *= (0.55 + 0.45 * sin(uT * 2.3 + vViewPosition.x * 9.0 + vViewPosition.y * 7.0)) * (0.8 + 0.3 * sin(uT * 7.1 + vViewPosition.z * 13.0)) * vColor;' }));
  RG('pCrystal', () => { const m = std({ color: 0xbffaff, emissive: 0x52e4f2, emissiveIntensity: 2.4, roughness: 0.08, metalness: 0.2, flatShading: true }); m.userData.noShadow = 1; return m; });
  RG('pFrost', () => { const m = patch(std({ color: 0xfff2dc, emissive: 0xffb860, emissiveIntensity: 2.6, roughness: 0.55, transparent: true, opacity: 0.94 }), { key: 'frost', frag: 'totalEmissiveRadiance *= vColor * (0.94 + 0.06 * sin(uT * 8.0 + vViewPosition.x * 20.0));' }); m.userData.noShadow = 1; return m; });
  // 물: 동심 물결(uv가 극좌표라 원형 물결이 된다), 떨어지는 물줄기
  RG('pWater', () => { const m = patch(std({ color: 0x2c4c54, map: TX.n2(), roughness: 0.05, metalness: 0.25, transparent: true, opacity: 0.9, envMapIntensity: 1.5 }),
    { key: 'wat', nfrag: 'normal = normalize( normal + 0.09 * vec3( sin( vUv.y * 9.0 - uT * 1.4 ) * 0.7 + sin( vUv.x * 5.0 + uT * 0.8 ) * 0.3, 0.0, cos( vUv.y * 7.0 - uT * 1.1 + vUv.x * 2.0 ) * 0.6 ) );' }); m.userData.noShadow = 1; return m; });
  RG('pFall', () => { const m = new T.ShaderMaterial({ uniforms: { uT: U.time }, vertexColors: true, transparent: true, depthWrite: false, side: T.DoubleSide, fog: false,
    vertexShader: 'varying vec2 vUv; varying vec3 vC; void main() { vUv = uv; vC = color; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }',
    fragmentShader: 'uniform float uT; varying vec2 vUv; varying vec3 vC; float h( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); } float n( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f ); return mix( mix( h( i ), h( i + vec2( 1, 0 ) ), f.x ), mix( h( i + vec2( 0, 1 ) ), h( i + vec2( 1, 1 ) ), f.x ), f.y ); } void main() { float s = n( vec2( vUv.x * 30.0, vUv.y * 5.0 + uT * 3.5 ) ) * 0.6 + n( vec2( vUv.x * 80.0, vUv.y * 12.0 + uT * 6.0 ) ) * 0.4; float a = smoothstep( 0.3, 0.85, s ) * 0.5 + 0.12; gl_FragColor = vec4( vC * ( 0.6 + 0.7 * s ), a ); }' });
    m.userData.noShadow = 1; m.userData.glow = 1; return m; });
  RG('pNightGlass', () => { const m = new T.MeshBasicMaterial({ map: TX.leaded(), vertexColors: true, color: 0xffffff, fog: false }); m.userData.glow = 1; return m; });

  // =====================================================================
  // 5. 불꽃 층 (하나의 가산 ShaderMaterial)
  // =====================================================================
  const FLAME_VS = `
    uniform float uT; varying vec2 vQ; varying float vK, vA, vSd; varying vec3 vC;
    float fl( float s ) { return 1.0 + 0.09 * sin( uT * 7.3 + s * 31.0 ) + 0.06 * sin( uT * 13.1 + s * 17.0 ) + 0.05 * sin( uT * 29.3 + s * 5.0 ) * sin( uT * 0.7 + s ); }
    void main() {
      float k = normal.z; vec2 q = normal.xy; float s = uv.x, sd = uv.y; vC = color; vK = k; vSd = sd;
      vec3 c = position; float f = fl( sd ); vA = f;
      if ( k > 2.5 && k < 3.5 ) {
        float sp = 0.18 + 0.22 * fract( sd * 7.13 ), life = fract( uT * sp + sd );
        c.y += life * ( 0.5 + 0.6 * fract( sd * 3.7 ) ); c.x += sin( uT * 1.7 + sd * 20.0 ) * 0.12 * life; c.z += cos( uT * 1.3 + sd * 13.0 ) * 0.12 * life;
        vA = smoothstep( 0.0, 0.08, life ) * ( 1.0 - life ) * ( 0.6 + 0.4 * sin( uT * 11.0 + sd * 50.0 ) );
      }
      vec4 mv = modelViewMatrix * vec4( c, 1.0 );
      if ( k < 0.5 || ( k > 1.5 && k < 2.5 ) ) {
        vec3 up = normalize( ( modelViewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz ), vd = normalize( mv.xyz );
        vec3 rt = cross( vd, up ); float l = length( rt ); rt = l > 0.05 ? rt / l : vec3( 1.0, 0.0, 0.0 );
        bool fire = k > 1.5;
        float yy = q.y * 0.5 + 0.5; vQ = vec2( q.x, mix( -0.14, 1.0, yy ) );
        float hgt = s * ( fire ? 0.8 + 0.25 * sin( uT * 3.1 + sd * 9.0 ) + 0.1 * sin( uT * 7.7 + sd * 3.0 ) : f );
        float wid = s * ( fire ? 0.5 : 0.3 );
        float sway = ( fire ? 0.16 : 0.08 ) * ( sin( uT * ( fire ? 3.3 : 2.1 ) + sd * 7.0 ) + 0.5 * sin( uT * 5.3 + sd * 3.0 ) ) * vQ.y * vQ.y;
        mv.xyz += rt * ( q.x * wid + sway * s ) + up * vQ.y * hgt;
      } else {
        vQ = q;
        float r = s * ( k < 1.5 ? 0.94 + 0.06 * f : 1.0 );
        mv.xy += q * r;
        float dz = length( mv.xyz ); mv.xyz += normalize( -mv.xyz ) * min( r * 0.85, dz * 0.5 );
      }
      gl_Position = projectionMatrix * mv;
    }`;
  const FLAME_FS = `
    uniform float uT; varying vec2 vQ; varying float vK, vA, vSd; varying vec3 vC;
    float h21( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
    float vn( vec2 p ) { vec2 i = floor( p ), f = fract( p ), u = f * f * ( 3.0 - 2.0 * f ); return mix( mix( h21( i ), h21( i + vec2( 1, 0 ) ), u.x ), mix( h21( i + vec2( 0, 1 ) ), h21( i + vec2( 1, 1 ) ), u.x ), u.y ); }
    void main() {
      vec3 col; float a;
      if ( vK < 0.5 ) {
        float y = vQ.y;
        float w = y < 0.3 ? sqrt( max( 0.0, 1.0 - pow( ( 0.3 - y ) / 0.4, 2.0 ) ) ) : pow( max( 0.0, 1.0 - ( y - 0.3 ) / 0.7 ), 1.2 );
        float d = abs( vQ.x ) / max( w, 0.001 );
        a = smoothstep( 1.0, 0.55, d ) * smoothstep( -0.12, 0.0, y );
        float core = smoothstep( 0.8, 0.0, d ) * smoothstep( 0.9, 0.2, y );
        col = mix( vec3( 1.0, 0.36, 0.07 ), vec3( 1.0, 0.88, 0.6 ), core );
        col = mix( col, vec3( 0.2, 0.3, 1.0 ), smoothstep( 0.16, -0.06, y ) * 0.7 );
        col *= 6.0 * vA * vC;
      } else if ( vK < 1.5 ) {
        float r2 = dot( vQ, vQ );
        a = ( exp( -r2 * 5.0 ) * 0.14 + exp( -r2 * 30.0 ) * 0.3 ) * vA * smoothstep( 1.0, 0.75, r2 );
        col = vec3( 1.0, 0.56, 0.24 ) * vC;
      } else if ( vK < 2.5 ) {
        float y = vQ.y;
        float n = vn( vec2( vQ.x * 2.5 + vSd * 13.0, y * 3.0 - uT * 2.4 ) ) * 0.6 + vn( vec2( vQ.x * 6.0 - vSd * 7.0, y * 7.0 - uT * 4.3 ) ) * 0.4;
        float w = ( y < 0.2 ? sqrt( max( 0.0, 1.0 - pow( ( 0.2 - y ) / 0.32, 2.0 ) ) ) : pow( max( 0.0, 1.0 - ( y - 0.2 ) / 0.8 ), 0.85 ) ) * ( 0.7 + 0.6 * n );
        float d = abs( vQ.x + ( n - 0.5 ) * 0.6 * y ) / max( w, 0.001 );
        a = smoothstep( 1.0, 0.25, d + y * 0.45 * n ) * smoothstep( -0.14, 0.04, y );
        float hot = smoothstep( 0.7, 0.0, d ) * smoothstep( 0.85, 0.0, y );
        col = mix( vec3( 0.95, 0.22, 0.04 ), vec3( 1.0, 0.72, 0.32 ), hot ) * 3.4 * ( 0.65 + 0.7 * n ) * vC;
      } else if ( vK < 3.5 ) {
        float r2 = dot( vQ, vQ ); a = exp( -r2 * 5.0 ) * max( vA, 0.0 ); col = vec3( 1.0, 0.45, 0.12 ) * 5.0;
      } else {
        float r2 = dot( vQ, vQ ); a = ( exp( -r2 * 4.0 ) * 0.22 + exp( -r2 * 26.0 ) * 0.5 ) * smoothstep( 1.0, 0.75, r2 ) * ( 0.85 + 0.15 * sin( uT * 1.7 + vSd * 9.0 ) ); col = vC;
      }
      if ( a < 0.002 ) discard;
      gl_FragColor = vec4( col * a, 1.0 );
    }`;
  RG('pFlame', () => {
    const m = new T.ShaderMaterial({ uniforms: { uT: U.time }, vertexShader: FLAME_VS, fragmentShader: FLAME_FS, vertexColors: true, transparent: true, depthWrite: false,
      blending: T.CustomBlending, blendSrc: T.OneFactor, blendDst: T.OneFactor, blendEquation: T.AddEquation, fog: false, toneMapped: false });
    m.userData.glow = 1; m.userData.noShadow = 1; return m;
  });
  const FK = { flame: 0, halo: 1, fire: 2, ember: 3, glow: 4 };
  // 스프라이트 하나: kind, 크기(불꽃=높이, 나머지=반지름), 씨앗, 색
  function sprite(b, x, y, z, kind, size, seed, col) {
    const B = GB(), c = tcol(col) || ONE, uv = [size, seed], p = [x, y, z];
    for (const [cx, cy] of [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]]) vtx(B, p, [cx, cy, kind], uv, c);
    b.add('pFlame', geoOf(B));
  }
  // 불꽃 + 헤일로. o.halo 반지름(0.35), o.col 색 곱, o.hk 헤일로 세기
  function flame(b, x, y, z, size, o) {
    o = o || {};
    const sd = o.seed !== undefined ? o.seed : (seedOf(x, y, z) % 1000) / 1000;
    sprite(b, x, y - size * 0.05, z, FK.flame, size || 0.04, sd, o.col);
    if (o.halo !== 0) sprite(b, x, y + (size || 0.04) * 0.4, z, FK.halo, o.halo || 0.35, sd, o.hk ? mul(tcol(o.col) || ONE, o.hk) : o.col);
  }
  P.flame = flame; P.sprite = (b, x, y, z, kind, size, seed, col) => sprite(b, x, y, z, FK[kind] !== undefined ? FK[kind] : kind, size, seed, col);

  // =====================================================================
  // 6. 작은 물건 (탁자 위)
  // =====================================================================
  const opt = (o, k, d) => (o && o[k] !== undefined ? o[k] : d);
  // 양초: 밀랍 몸통(아래 pWax, 위 2 cm pWaxLit) + 흘러내린 촛농 + 심지 + 불꽃. 반환 {top}
  P.candle = (b, x, y, z, rot, o) => {
    o = o || {};
    const R = RNG(x, y, z, o), k = new K(b, x, y, z, rot);
    const holder = o.holder || 'stick', h = opt(o, 'h', R.r(0.1, 0.26)), r = opt(o, 'r', R.r(0.0095, 0.0125)), lit = o.lit !== false, melt = opt(o, 'melt', R.r(0.1, 0.9));
    const wax = o.col || R.p([C.wax, C.wax, C.waxOld, 0xF3ECDC, 0xE6D2A6]);
    let base = 0;
    if (holder === 'stick' || holder === 'pewter') {
      const mt = holder === 'pewter' ? 'pPewter' : 'brass', hh = opt(o, 'sh', R.r(0.08, 0.2));
      k.lathe(mt, [[0, 0], [0.052, 0], [0.056, 0.005], [0.048, 0.012], [0.026, 0.02], [0.013, 0.04], [0.011, hh * 0.42], [0.019, hh * 0.47], [0.011, hh * 0.52], [0.009, hh * 0.84], [0.02, hh * 0.9], [0.034, hh - 0.005], [0.036, hh], [0.031, hh], [0.016, hh], [0.016, hh + 0.016], [0, hh + 0.016]], 0, 0, 0, { seg: 12, t: holder === 'pewter' ? C.pewter : null });
      base = hh + 0.004;
    } else if (holder === 'dish') {
      k.lathe('brass', [[0, 0], [0.06, 0], [0.068, 0.013], [0.064, 0.015], [0.056, 0.006], [0.018, 0.006], [0.018, 0.032], [0.0155, 0.032], [0.0155, 0.01], [0, 0.01]], 0, 0, 0, { seg: 14 });
      k.ring('brass', 0.016, 0.0035, 0.074, 0.02, 0, { rz: PI / 2, ts: 12, rs: 4 });
      base = 0.01;
    }
    if (melt > 0.45 && holder !== 'none') k.lathe('pWax', [[0, 0], [r * 1.9, 0], [r * 1.6, 0.004], [r, 0.006], [0, 0.006]], 0, base - 0.002, 0, { seg: 10, t: wax });
    const hl = 0.022;
    k.lathe('pWax', [[0, 0], [r, 0], [r, 0], [r, h - hl]], 0, base, 0, { seg: 9, t: wax });
    k.lathe('pWaxLit', [[r, h - hl], [r, h - 0.01], [r * 0.97, h - 0.003], [r * 0.85, h], [r * 0.6, h - 0.004], [0, h - 0.006]], 0, base, 0, { seg: 9, t: wax });
    const nd = Math.round(melt * 4);
    for (let i = 0; i < nd; i++) {
      const a = R() * TAU, len = R.r(0.015, 0.03 + melt * 0.06), dr = R.r(0.0025, 0.004), y0 = base + h - 0.004;
      const px = Math.sin(a) * (r + dr * 0.3), pz = Math.cos(a) * (r + dr * 0.3);
      k.tube('pWax', [[px, y0, pz], [px * 1.02, y0 - len * 0.5, pz * 1.02], [px * 1.05, y0 - len, pz * 1.05]], t => dr * (0.6 + 0.6 * t), { rs: 5, cap: true, t: wax });
    }
    k.cyl('iron', 0.0012, 0.009, 0, base + h - 0.006, 0, { seg: 4, rz: R.r(-0.2, 0.2) });
    const top = base + h;
    if (lit) k.fl(0, top + 0.004, 0, o.fs || R.r(0.034, 0.046), { halo: o.halo === undefined ? 0.3 : o.halo });
    if (o.light) k.light(0, top + 0.06, 0, 0xFFA24A, o.light === true ? 0.9 : o.light, 5.5);
    return { top: y + top };
  };
  P.goblet = (b, x, y, z, rot, o) => {
    o = o || {}; const k = new K(b, x, y, z, rot), mt = o.mat || 'pPewter';
    k.lathe(mt, [[0, 0], [0.034, 0], [0.036, 0.004], [0.012, 0.012], [0.006, 0.03], [0.009, 0.05], [0.006, 0.07], [0.012, 0.082], [0.036, 0.1], [0.041, 0.16], [0.038, 0.16], [0.033, 0.1], [0, 0.09]], 0, 0, 0, { seg: 12, t: mt === 'pPewter' ? C.pewter : null });
    if (o.wine !== false && (o.wine || RNG(x, y, z, o)() < 0.6)) k.lathe('pLiquid', [[0, 0], [0.036, 0], [0, 0.001]], 0, 0.13, 0, { seg: 10, t: 0x3a0812 });
  };
  P.plate = (b, x, y, z, rot, o) => {
    o = o || {}; const k = new K(b, x, y, z, rot), r = opt(o, 'r', 0.13), mt = o.mat || 'pPewter';
    k.lathe(mt, [[0, 0], [r * 0.72, 0], [r, r * 0.12], [r * 0.97, r * 0.13], [r * 0.7, r * 0.035], [0, r * 0.035]], 0, 0, 0, { seg: 18, t: mt === 'pPewter' ? C.pewter : o.t });
  };
  P.bowl = (b, x, y, z, rot, o) => {
    o = o || {}; const k = new K(b, x, y, z, rot), r = opt(o, 'r', 0.12), h = opt(o, 'h', r * 0.55), mt = o.mat || 'pCeramic';
    k.lathe(mt, [[0, 0], [r * 0.45, 0], [r * 0.47, 0.012], [r * 0.85, h * 0.45], [r, h], [r * 0.94, h], [r * 0.8, h * 0.5], [r * 0.4, 0.016], [0, 0.016]], 0, 0, 0, { seg: 16, t: o.t || 0xD8CBB0 });
    return h;
  };
  P.pitcher = (b, x, y, z, rot, o) => {
    o = o || {}; const k = new K(b, x, y, z, rot), h = opt(o, 'h', 0.24), mt = o.mat || 'pPewter';
    k.lathe(mt, [[0, 0], [0.05, 0], [0.056, 0.01], [0.068, h * 0.35], [0.06, h * 0.7], [0.045, h * 0.85], [0.05, h], [0.046, h], [0.04, h * 0.85], [0, h * 0.8]], 0, 0, 0, { seg: 14, t: mt === 'pPewter' ? C.pewter : o.t });
    k.tube(mt, [[-0.042, h * 0.85, 0], [-0.1, h * 0.8, 0], [-0.1, h * 0.4, 0], [-0.06, h * 0.25, 0]], 0.009, { rs: 5, t: mt === 'pPewter' ? C.pewter : o.t });
    k.lathe(mt, [[0, 0], [0.022, 0], [0, 0.03]], 0.055, h - 0.012, 0, { seg: 6, rz: -PI / 2.6, t: mt === 'pPewter' ? C.pewter : o.t });
  };
  P.bread = (b, x, y, z, rot, o) => {
    o = o || {}; const R = RNG(x, y, z, o), k = new K(b, x, y, z, rot);
    if (o.round || R() < 0.35) k.lathe('pFood', [[0, 0], [0.08, 0], [0.086, 0.03], [0.062, 0.068], [0, 0.08]], 0, 0, 0, { seg: 12, t: 0xB27A38, wob: (i, a) => Math.sin(a * 5) * 0.03 });
    else { k.rb('pFood', 0, 0.045, 0, 0.26, 0.09, 0.12, 0.045, { puff: 0.015, t: 0xB0763A }); for (let i = 0; i < 3; i++) k.box('pFood', -0.06 + i * 0.06, 0.095, 0, 0.012, 0.004, 0.08, { ry: 0.6, c: 0.002, t: 0xE8C88A }); }
  };
  P.fruitBowl = (b, x, y, z, rot, o) => {
    o = o || {}; const R = RNG(x, y, z, o), k = new K(b, x, y, z, rot);
    const h = P.bowl(b, x, y, z, rot, { r: 0.14, mat: R() < 0.5 ? 'pPewter' : 'pCeramic', t: R() < 0.5 ? C.pewter : 0xCDBFA0 });
    const n = 5 + R.i(4);
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU + R() * 0.4, rr = i < n - 2 ? 0.065 : 0.02, yy = h * 0.55 + (i >= n - 2 ? 0.05 : 0);
      const kind = R();
      if (kind < 0.55) k.sph('pFood', R.r(0.03, 0.036), Math.sin(a) * rr, yy, Math.cos(a) * rr, { n: 6, seg: 10, t: R.p([0x8E2A1E, 0x9E3A22, 0x8AA040, 0xB8862A]) });
      else if (kind < 0.8) k.lathe('pFood', [[0, 0], [0.025, 0.006], [0.032, 0.03], [0.018, 0.06], [0.01, 0.075], [0, 0.08]], Math.sin(a) * rr, yy - 0.02, Math.cos(a) * rr, { seg: 9, rz: R.r(-0.5, 0.5), t: 0xA89A3A });
      else for (let j = 0; j < 7; j++) k.sph('pFood', 0.012, Math.sin(a) * rr + R.r(-0.02, 0.02), yy + R.r(-0.01, 0.02), Math.cos(a) * rr + R.r(-0.02, 0.02), { n: 4, seg: 6, t: 0x4A2440 });
    }
  };
  P.cup = (b, x, y, z, rot, o) => {
    o = o || {}; const k = new K(b, x, y, z, rot), t = o.t || 0xE8E0D0;
    if (o.saucer !== false) k.lathe('pCeramic', [[0, 0], [0.04, 0], [0.065, 0.012], [0.062, 0.013], [0.035, 0.006], [0, 0.006]], 0, 0, 0, { seg: 14, t });
    const y0 = o.saucer !== false ? 0.006 : 0;
    k.lathe('pCeramic', [[0, 0], [0.024, 0], [0.026, 0.004], [0.04, 0.05], [0.042, 0.06], [0.038, 0.06], [0.035, 0.05], [0, 0.008]], 0, y0, 0, { seg: 14, t });
    k.ring('pCeramic', 0.016, 0.004, 0.04, y0 + 0.032, 0, { rx: PI / 2, ts: 10, rs: 4, arc: PI, t });
    if (o.tea !== false) k.lathe('pLiquid', [[0, 0], [0.036, 0], [0, 0.001]], 0, y0 + 0.045, 0, { seg: 10, t: 0x5a3010 });
  };
  // 유리병 다섯 꼴: 0 둥근 플라스크, 1 길쭉, 2 네모, 3 원뿔, 4 납작 단지(코르크). o.col 유리색, o.fill 0..1
  const BOTTLES = [
    s => [[0, 0], [0.03, 0], [0.045, 0.02], [0.05, 0.05], [0.04, 0.085], [0.013, 0.1], [0.012, 0.14], [0.015, 0.145]],
    s => [[0, 0], [0.025, 0], [0.027, 0.01], [0.027, 0.15], [0.02, 0.175], [0.01, 0.19], [0.01, 0.22], [0.013, 0.225]],
    s => [[0, 0], [0.036, 0], [0.04, 0.008], [0.04, 0.11], [0.03, 0.125], [0.014, 0.13], [0.014, 0.155], [0.017, 0.16]],
    s => [[0, 0], [0.05, 0], [0.052, 0.008], [0.016, 0.1], [0.014, 0.14], [0.017, 0.145]],
    s => [[0, 0], [0.045, 0], [0.05, 0.01], [0.052, 0.06], [0.044, 0.075], [0.036, 0.078], [0.036, 0.09]],
  ];
  P.bottle = (b, x, y, z, rot, o) => {
    o = o || {}; const R = RNG(x, y, z, o), k = new K(b, x, y, z, rot);
    const sh = o.shape !== undefined ? o.shape : R.i(5), sc = opt(o, 's', R.r(0.8, 1.25)), prof = BOTTLES[sh]().map(p => [p[0] * sc, p[1] * sc]);
    const col = o.col !== undefined ? o.col : R.p(C.glass), seg = sh === 2 ? 4 : 12, top = prof[prof.length - 1][1];
    const pr = prof.concat([[prof[prof.length - 1][0] - 0.003, top], [0, top]]);
    k.lathe('pGlass', pr, 0, 0, 0, { seg, ry: sh === 2 ? PI / 4 : 0, t: col, flat: sh === 2 });
    const fill = opt(o, 'fill', R.r(0.2, 0.85));
    if (fill > 0.05) {
      const fy = top * 0.7 * fill, inner = pr.filter(p => p[1] <= fy).map(p => [p[0] * 0.9, p[1]]);
      const rr = inner.length ? inner[inner.length - 1][0] : 0.01;
      k.lathe('pLiquid', [[0, 0.002]].concat(inner.slice(1).map(p => [p[0], p[1] + 0.002])).concat([[rr * 0.98, fy], [0, fy]]), 0, 0, 0, { seg, ry: sh === 2 ? PI / 4 : 0, t: mul(tcol(col), 0.9) });
    }
    const nr = prof[prof.length - 1][0];
    if (sh === 4) k.cyl('oak', nr * 1.05, 0.02, 0, top - 0.006, 0, { seg: 10, t: [1.5, 1.2, 0.9] });
    else k.cyl('oak', nr * 0.9, 0.022, 0, top - 0.012, 0, { r2: nr * 1.05, seg: 8, t: [1.6, 1.3, 1.0] });
    if (o.label !== false && R() < 0.5) k.add('pBooks', quad(0.03 * sc, 0.035 * sc, AT.page(2 + R.i(2))), L(0, top * 0.35, prof[2][0] + 0.002 + (sh === 2 ? 0.004 : 0)), 0xF0E6D0);
    return top;
  };
  // 책 한 권 (선 꼴: 두께 t는 x, 높이 h는 y, 깊이 d는 z, 등은 +z). full이면 여섯 면 다
  function standBook(t, h, d, tile, fam, full) {
    const cv = AT.cover(fam);
    return cbox(t, h, d, 0, { fuv: { pz: AT.spine(tile), px: cv, nx: cv, py: AT.top(), nz: full ? AT.edge() : null, ny: full ? AT.top() : null } });
  }
  P.standBook = standBook;
  // 누운 책 (자세한 꼴): 길이 H는 x, 너비 W는 z, 두께 t는 y. 등은 +z. 바닥이 y=0
  function lyingBook(k, x, y, z, ry, H, W, t, tile, fam, rx) {
    const cv = AT.cover(fam), ed = AT.edge(), l = M4e(x, y, z, rx || 0, ry || 0, 0), m = new T.Matrix4();
    const put = (g, lx, ly, lz) => k.add('pBooks', g, m.multiplyMatrices(l, M4(lx, ly, lz)));
    const ct = 0.0032;
    put(cbox(H + 0.004, ct, W + 0.002, 0, { fuv: { py: cv, ny: cv, px: cv, nx: cv, nz: cv, pz: cv } }), 0, t - ct / 2, 0);
    put(cbox(H + 0.004, ct, W + 0.002, 0, { fuv: { py: cv, ny: cv, px: cv, nx: cv, nz: cv, pz: cv } }), 0, ct / 2, 0);
    put(cbox(H - 0.002, t - ct * 2, W - 0.004, 0, { fuv: { px: ed, nx: ed, nz: [ed[0], ed[1], ed[2], ed[3], 1], py: null, ny: null, pz: null } }), 0, t / 2, -0.002);
    put(cbox(H + 0.004, t, 0.005, 0, { fuv: { pz: [...AT.spine(tile), 1], py: null, ny: null, nz: null, px: cv, nx: cv } }), 0, t / 2, W / 2 - 0.0015);
  }
  P.book = (b, x, y, z, rot, o) => {
    o = o || {}; const R = RNG(x, y, z, o), k = new K(b, x, y, z, rot);
    const H = opt(o, 'H', R.r(0.2, 0.32)), W = opt(o, 'W', H * R.r(0.66, 0.78)), t = opt(o, 't', R.r(0.025, 0.07)), fam = opt(o, 'fam', R.i(6));
    lyingBook(k, 0, 0, 0, 0, H, W, t, opt(o, 'tile', fam + 6 * R.i(5)), fam, 0);
    return t;
  };
  // 펼친 책: 가운데가 꺼지고 바깥이 말린 두 쪽 + 표지
  P.openBook = (b, x, y, z, rot, o) => {
    o = o || {}; const R = RNG(x, y, z, o), k = new K(b, x, y, z, rot);
    const H = opt(o, 'H', R.r(0.24, 0.32)), W = opt(o, 'W', H * 0.72), t = opt(o, 't', R.r(0.02, 0.04)), fam = opt(o, 'fam', R.i(6)), cv = AT.cover(fam);
    for (const s of [-1, 1]) {
      k.box('pBooks', s * (W / 2 + 0.002), 0.0016, 0, W + 0.006, 0.0032, H + 0.008, { c: 0, fuv: { py: cv, ny: cv, px: cv, nx: cv, pz: cv, nz: cv }, rz: s * 0.03 });
      const lift = s < 0 ? R.r(0.6, 1) : R.r(0.4, 0.9);
      const g = sheet(10, 2, (u, v) => {
        const xx = s < 0 ? -W * (1 - u) : W * u, a = Math.abs(xx) / W;
        const yy = t * lift * (0.25 + 0.75 * Math.sqrt(Math.min(1, a / 0.3))) * (a > 0.9 ? 1 - (a - 0.9) * 2.2 : 1) + 0.004;
        return [xx, yy + (a > 0.85 ? (a - 0.85) * 0.03 : 0), (0.5 - v) * H];
      }, { uvRect: s < 0 ? AT.page(o.left !== undefined ? o.left : 0) : AT.page(o.right !== undefined ? o.right : 1) });
      k.add('pBooks', g, L(0, 0, 0, 0, s < 0 ? 0 : 0, 0));
      k.box('pBooks', s * W * 0.5, t * lift * 0.45 + 0.003, H / 2 - 0.001, W * 0.85, t * lift * 0.8, 0.002, { c: 0, fuv: { pz: AT.edge(), py: null, ny: null, px: null, nx: null, nz: null } });
      k.box('pBooks', s * W * 0.5, t * lift * 0.45 + 0.003, -H / 2 + 0.001, W * 0.85, t * lift * 0.8, 0.002, { c: 0, fuv: { nz: AT.edge(), py: null, ny: null, px: null, nx: null, pz: null } });
    }
    if (o.ribbon !== false) k.box('pVelvet', W * 0.3, 0.012, -H / 2 - 0.03, 0.006, 0.001, 0.08, { c: 0, t: 0x7a1e22, rx: 0.2 });
  };
  // 낱장 종이 (가장자리가 살짝 말림). o.tile 2 편지, 3 고대 문자, o.crumple
  P.paper = (b, x, y, z, rot, o) => {
    o = o || {}; const R = RNG(x, y, z, o), k = new K(b, x, y, z, rot);
    const w = opt(o, 'w', 0.21), h = opt(o, 'h', 0.29), cr = o.crumple ? 0.012 : 0, lift = R.r(0, 0.012);
    const g = sheet(4, 4, (u, v) => [(u - 0.5) * w, 0.0015 + Math.pow(Math.max(u, v), 6) * lift + (cr ? (pnoise(u * 4, v * 4, 99, 99, 7) - 0.5) * cr : 0), (0.5 - v) * h], { uvRect: AT.page(opt(o, 'tile', 2 + R.i(2))), both: true, back: 0.9 });
    k.add('pBooks', g, null, o.t || (o.crumple ? 0xE8DCC0 : null));
  };
  // 두루마리 묶음. o.n, o.open (펼친 한 장)
  P.scrolls = (b, x, y, z, rot, o) => {
    o = o || {}; const R = RNG(x, y, z, o), k = new K(b, x, y, z, rot);
    if (o.open) {
      const w = 0.3, h = 0.42;
      k.add('pBooks', sheet(2, 6, (u, v) => [(u - 0.5) * w, 0.002 + (v < 0.12 || v > 0.88 ? 0.006 : 0), (0.5 - v) * h], { uvRect: AT.page(3), both: true }));
      for (const s of [-1, 1]) { k.cyl('parchment', 0.016, w + 0.02, -(w + 0.02) / 2, 0.016, s * (h / 2 + 0.01), { rz: -PI / 2, seg: 10, t: 0xE6D4AE }); k.cyl('oak', 0.006, w + 0.08, -(w + 0.08) / 2, 0.016, s * (h / 2 + 0.01), { rz: -PI / 2, seg: 6 }); }
      return;
    }
    const n = opt(o, 'n', 3 + R.i(4));
    for (let i = 0; i < n; i++) {
      const len = R.r(0.22, 0.4), r = R.r(0.014, 0.026), lay = i < Math.ceil(n * 0.6) ? 0 : 1;
      const zx = (i % 3 - 1) * r * 2.1 + R.r(-0.005, 0.005), yy = r + lay * r * 1.7, ang = R.r(-0.25, 0.25);
      k.lathe('parchment', [[r * 0.3, 0], [r, 0], [r, len], [r * 0.3, len], [r * 0.3, 0.002]], -len / 2, yy, zx, { rz: -PI / 2, ry: ang, seg: 10, t: R.p([0xE6D4AE, 0xD8C49A, 0xEBDDBE]) });
      if (R() < 0.6) k.ring('pVelvet', r + 0.002, 0.0025, R.r(-0.05, 0.05), yy, zx, { rz: PI / 2, ry: ang, ts: 12, rs: 4, t: R.p([0x7a1e22, 0x2A2F5E, 0xA8843E]) });
    }
  };
  P.hourglass = (b, x, y, z, rot, o) => {
    const k = new K(b, x, y, z, rot), h = 0.16;
    for (const yy of [0, h - 0.014]) k.cyl('oak', 0.045, 0.014, 0, yy, 0, { seg: 12 });
    for (let i = 0; i < 3; i++) { const a = i / 3 * TAU; k.cyl('brass', 0.004, h - 0.028, Math.sin(a) * 0.038, 0.014, Math.cos(a) * 0.038, { seg: 5 }); }
    k.lathe('pGlass', [[0, 0], [0.03, 0.004], [0.032, 0.03], [0.006, 0.066], [0.032, 0.102], [0.03, 0.128], [0, 0.132]], 0, 0.014, 0, { seg: 12, t: 0xE8F0F0 });
    k.lathe('pFood', [[0, 0], [0.027, 0.004], [0.026, 0.02], [0, 0.03]], 0, 0.016, 0, { seg: 10, t: 0xD8B880 });
  };
  // 잉크병과 깃펜
  P.inkAndQuill = (b, x, y, z, rot, o) => {
    o = o || {}; const R = RNG(x, y, z, o), k = new K(b, x, y, z, rot);
    k.lathe(R() < 0.5 ? 'brass' : 'pGlass', [[0, 0], [0.032, 0], [0.034, 0.006], [0.034, 0.034], [0.014, 0.046], [0.013, 0.056], [0.009, 0.056], [0.009, 0.046], [0, 0.04]], 0, 0, 0, { seg: 10, t: 0x88a0a0 });
    k.lathe('pLiquid', [[0, 0], [0.03, 0.004], [0.03, 0.03], [0, 0.03]], 0, 0.004, 0, { seg: 8, t: 0x0a0c18 });
    if (o.quill !== false) P.quill(b, ...k.w(0, 0.045, 0), rot + R.r(-0.6, 0.6), { tilt: R.r(0.3, 0.5) });
  };
  // 깃펜 하나 (o.tilt 세운 각, 0이면 눕힘)
  P.quill = (b, x, y, z, rot, o) => {
    o = o || {}; const k = new K(b, x, y, z, rot), tilt = opt(o, 'tilt', 0.35), L0 = 0.28;
    const dir = [Math.sin(tilt), Math.cos(tilt)], pt = s => [dir[0] * s * L0, dir[1] * s * L0 + (tilt > 1.4 ? 0.003 : 0), 0];
    k.tube('pLinen', [pt(-0.15), pt(0.4), pt(1)], t => 0.0022 * (1 - t * 0.7), { rs: 4, t: 0xE8E0C8 });
    const sh = new T.Shape(); sh.moveTo(0, 0); sh.quadraticCurveTo(0.022, 0.05, 0.016, 0.16); sh.quadraticCurveTo(0.008, 0.2, 0, 0.21); sh.quadraticCurveTo(-0.01, 0.15, -0.012, 0.08); sh.quadraticCurveTo(-0.01, 0.03, 0, 0);
    const g = new T.ShapeGeometry(sh, 6).toNonIndexed(); g.setAttribute('color', new T.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3));
    k.add('pLinen', g, L(pt(0.25)[0], pt(0.25)[1], 0, 0, 0, -tilt), 0xF4F0E6);
  };
  P.magnifier = (b, x, y, z, rot, o) => {
    const k = new K(b, x, y, z, rot), tl = 0.06;
    k.ring('brass', 0.045, 0.005, 0, 0.008, 0, { rx: tl, ts: 20, rs: 5 });
    k.lathe('pGlass', [[0, -0.002], [0.044, 0], [0, 0.004]], 0, 0.008, 0, { seg: 16, rx: tl, t: 0xF0F4F4 });
    k.lathe('oak', [[0, 0], [0.008, 0], [0.011, 0.04], [0.009, 0.09], [0.006, 0.1], [0, 0.1]], 0, 0.012, 0.05, { rx: PI / 2 - 0.08, seg: 8 });
    k.cyl('brass', 0.008, 0.012, 0, 0.012, 0.044, { rx: PI / 2 - 0.08, seg: 8 });
  };
  P.keyring = (b, x, y, z, rot, o) => {
    o = o || {}; const R = RNG(x, y, z, o), k = new K(b, x, y, z, rot), n = 3 + R.i(3);
    k.ring('iron', 0.032, 0.003, 0, 0.003, 0, { ts: 18, rs: 4 });
    for (let i = 0; i < n; i++) {
      const a = R.r(-1.2, 1.2) + (i - n / 2) * 0.5, c = Math.sin(a), s = Math.cos(a), len = R.r(0.06, 0.1), mt = R() < 0.5 ? 'brass' : 'iron';
      const bx = c * 0.04, bz = s * 0.04;
      k.ring(mt, 0.011, 0.0025, bx, 0.003, bz, { ts: 10, rs: 4 });
      k.cyl(mt, 0.0025, len, bx + c * 0.01, 0.003, bz + s * 0.01, { rx: PI / 2, ry: a, seg: 5 });
      k.box(mt, bx + c * (0.01 + len - 0.008), 0.003, bz + s * (0.01 + len - 0.008), 0.016, 0.003, 0.012, { ry: a, c: 0.001 });
    }
  };
  P.teaSet = (b, x, y, z, rot, o) => {
    o = o || {}; const R = RNG(x, y, z, o), k = new K(b, x, y, z, rot), t = R.p([0xE8E0D0, 0xD8D4E8, 0xE4D6BC]);
    k.lathe('brass', [[0, 0], [0.2, 0], [0.205, 0.004], [0.21, 0.018], [0.204, 0.018], [0.198, 0.006], [0, 0.006]], 0, 0, 0, { seg: 24 });
    const tp = k.w(-0.05, 0.006, -0.03);
    { const q = new K(b, tp[0], tp[1], tp[2], rot + R.r(-0.5, 0.5));
      q.lathe('pCeramic', [[0, 0], [0.045, 0], [0.05, 0.005], [0.075, 0.05], [0.07, 0.09], [0.04, 0.11], [0.034, 0.11]], 0, 0, 0, { seg: 16, t });
      q.lathe('pCeramic', [[0, 0], [0.04, 0], [0.034, 0.012], [0.008, 0.02], [0.012, 0.03], [0, 0.034]], 0, 0.11, 0, { seg: 14, t });
      q.tube('pCeramic', [[0.06, 0.035, 0], [0.1, 0.06, 0], [0.12, 0.1, 0], [0.135, 0.115, 0]], s => 0.011 * (1 - s * 0.5), { rs: 6, t });
      q.ring('pCeramic', 0.032, 0.006, -0.074, 0.06, 0, { rx: PI / 2, ry: PI, ts: 12, rs: 5, arc: PI, t }); }
    for (let i = 0; i < 2 + R.i(2); i++) P.cup(b, ...k.w(0.08 + (i % 2) * 0.05, 0.006, -0.08 + i * 0.09), rot + R.r(-1, 1), { t, tea: R() < 0.7 });
    P.bowl(b, ...k.w(-0.1, 0.006, 0.1), rot, { r: 0.04, t });
  };

  // =====================================================================
  // 7. 가구
  // =====================================================================
  K.prototype.child = function (l) { const c = Object.create(K.prototype); Object.assign(c, this); c.m = this.m.clone().multiply(l); return c; };
  // 돌림 다리: 아래 돌림 부분 + 위 네모 덩어리 (가로대가 붙는 곳)
  function leg(k, key, x, z, h, r, o) {
    o = o || {};
    const H = h * (o.block === undefined ? 0.8 : 1 - o.block);
    k.lathe(key, [[0, 0], [r * 0.8, 0], [r * 0.9, 0.015], [r * 0.72, 0.035], [r * 0.68, H * 0.1], [r * 0.95, H * 0.22], [r * 0.58, H * 0.32], [r * 0.52, H * 0.55], [r * 0.9, H * 0.66], [r * 0.55, H * 0.74], [r * 0.6, H * 0.9], [r * 0.86, H * 0.95], [r * 0.86, H], [0, H]], x, 0, z, { seg: 10, t: o.t });
    if (h - H > 0.01) k.box(key, x, H + (h - H) / 2, z, r * 1.9, h - H, r * 1.9, { c: 0.006, t: o.t });
  }
  const woodT = R => [R.r(0.86, 1.08), R.r(0.84, 1.04), R.r(0.82, 1.0)];
  // 긴 식탁: 상판·앞치마·돌림 다리·가로대, 가운데 띠천, 자리마다 백랍 접시·잔, 2 m마다 촛대, 빵·과일
  P.longTable = (b, x, y, z, rot, o) => {
    o = o || {};
    const R = RNG(x, y, z, o), k = new K(b, x, y, z, rot), wt = woodT(R);
    const len = opt(o, 'len', 4), w = opt(o, 'w', 1.0), h = opt(o, 'h', 0.76), th = 0.07, ai = 0.1, ah = 0.13;
    k.box('oak', 0, h - th / 2, 0, len, th, w, { c: 0.016, t: wt, uo: R() * 5 });
    for (const s of [-1, 1]) { k.box('oak', 0, h - th - ah / 2, s * (w / 2 - ai), len - 2 * ai, ah, 0.035, { c: 0.008, t: mul(wt, 0.9) }); k.box('oak', s * (len / 2 - ai), h - th - ah / 2, 0, 0.035, ah, w - 2 * ai, { c: 0.008, t: mul(wt, 0.9) }); }
    const nl = Math.max(2, Math.round(len / 1.9) + 1);
    for (let i = 0; i < nl; i++) {
      const lx = -(len / 2 - ai) + i * (len - 2 * ai) / (nl - 1);
      for (const s of [-1, 1]) leg(k, 'oak', lx, s * (w / 2 - ai), h - th, 0.06, { t: wt });
      k.box('oak', lx, 0.15, 0, 0.05, 0.06, w - 2 * ai, { c: 0.01, t: mul(wt, 0.85) });
    }
    k.box('oak', 0, 0.15, 0, len - 2 * ai, 0.07, 0.05, { c: 0.01, t: mul(wt, 0.85) });
    if (o.cloth) {
      k.box('pLinen', 0, h + 0.002, 0, len + 0.1, 0.004, w + 0.1, { c: 0.001, t: C.linen });
      for (const s of [-1, 1]) k.add('pLinen', sheet(Math.round(len * 6), 2, (u, v) => [(u - 0.5) * (len + 0.1), h - v * 0.22, s * (w / 2 + 0.05 + Math.sin(u * len * 9) * 0.01 * v)], { uvm: [len, 0.3], both: true }), null, C.linen);
    }
    if (o.runner !== false) {
      const rw = 0.4, rl = len - 0.16, rc = o.runnerCol || C.indigo;
      k.box('pVelvet', 0, h + 0.0025, 0, rl, 0.005, rw, { c: 0.002, t: rc });
      for (const s of [-1, 1]) k.box('gold', 0, h + 0.0053, s * (rw / 2 - 0.025), rl - 0.04, 0.001, 0.01, { c: 0 });
    }
    // 자리 차림
    if (o.set !== false) {
      const sp = 0.64, n = Math.max(1, Math.floor((len - 0.3) / sp));
      for (const s of [-1, 1]) for (let i = 0; i < n; i++) {
        if (R() < 0.12) continue;
        const px = -((n - 1) * sp) / 2 + i * sp + R.r(-0.05, 0.05), pz = s * (w / 2 - 0.19 + R.r(-0.02, 0.02)), pr = R.r(-0.2, 0.2);
        k.sub(P.plate, px, h, pz, pr, {});
        const f = R();
        if (f < 0.35) k.sub(P.bread, px, h + 0.006, pz, R() * TAU, { round: true, s: 0.5 });
        else if (f < 0.55) k.sub(P.fruitBowl, px, h + 0.005, pz, 0, { seed: R.i(1e6) });
        k.sub(P.goblet, px - s * 0.17, h, pz - s * 0.1, 0, {});
        k.box('pPewter', px + s * 0.16, h + 0.003, pz, 0.016, 0.004, 0.2, { c: 0.002, t: C.pewter, ry: R.r(-0.15, 0.15) });
        if (R() < 0.4) k.rb('pLinen', px - s * 0.2, h + 0.012, pz + s * 0.02, 0.12, 0.022, 0.12, 0.008, { t: C.linen, ry: R() });
      }
    }
    // 가운데: 촛대 2 m마다, 사이에 음식
    const cand = [];
    if (o.candelabra !== false) for (let cx = -len / 2 + 1; cx <= len / 2 - 0.4; cx += 2) cand.push(cx);
    for (let j = 0; j < cand.length; j++) k.sub(P.candelabrum, cand[j], h + 0.005, R.r(-0.03, 0.03), R.r(-0.3, 0.3), { arms: R() < 0.5 ? 5 : 3, light: o.lights === undefined ? j % 2 === 0 : o.lights });
    if (o.food !== false) {
      for (let fx = -len / 2 + 0.45; fx < len / 2 - 0.3; fx += R.r(0.45, 0.7)) {
        if (cand.some(c => Math.abs(c - fx) < 0.3)) continue;
        const f = R(), fz = R.r(-0.08, 0.08);
        if (f < 0.3) { k.box('oak', fx, h + 0.012, fz, 0.36, 0.02, 0.2, { c: 0.006, t: [1.3, 1.15, 1.0], ry: R.r(-0.3, 0.3) }); k.sub(P.bread, fx, h + 0.022, fz, R.r(-0.3, 0.3), {}); }
        else if (f < 0.55) k.sub(P.fruitBowl, fx, h + 0.005, fz, R() * TAU, {});
        else if (f < 0.75) k.sub(P.pitcher, fx, h + 0.005, fz, R() * TAU, {});
        else { k.lathe('pFood', [[0, 0], [0.11, 0], [0.115, 0.05], [0.1, 0.07], [0, 0.07]], fx, h + 0.006, fz, { seg: 16, t: 0xD8B060 }); k.box('pFood', fx + 0.07, h + 0.04, fz, 0.1, 0.06, 0.006, { c: 0.002, ry: 0.4, t: 0xE8C878 }); }
      }
    }
    k.col(0, 0, len / 2, w / 2, h);
    return { top: y + h };
  };
  // 긴 의자: 두꺼운 판 + 아치 뚫린 양끝 다리판 + 쐐기 박은 가로대
  P.bench = (b, x, y, z, rot, o) => {
    o = o || {};
    const R = RNG(x, y, z, o), k = new K(b, x, y, z, rot), wt = woodT(R), len = opt(o, 'len', 1.8), h = opt(o, 'h', 0.46), w = opt(o, 'w', 0.34), th = 0.06;
    k.box('oak', 0, h - th / 2, 0, len, th, w, { c: 0.014, t: wt, uo: R() * 4 });
    const sh = new T.Shape(), a = w * 0.46, bt = w * 0.36;
    sh.moveTo(-a, 0); sh.lineTo(-bt, h - th); sh.lineTo(bt, h - th); sh.lineTo(a, 0); sh.lineTo(w * 0.17, 0); sh.quadraticCurveTo(0, 0.2, -w * 0.17, 0); sh.closePath();
    for (const s of [-1, 1]) {
      k.add('oak', ext(sh, 0.05, { bevel: 0.006 }), L(s * (len / 2 - 0.2), 0, 0, 0, PI / 2, 0), mul(wt, 0.92));
      k.box('oak', s * (len / 2 - 0.2 + 0.05), 0.2, 0, 0.022, 0.07, 0.03, { c: 0.004, t: mul(wt, 0.8) });
    }
    k.box('oak', 0, 0.2, 0, len - 0.3, 0.06, 0.045, { c: 0.01, t: mul(wt, 0.88) });
    k.col(0, 0, len / 2, w / 2, h);
    return { top: y + h };
  };
  // 참나무 의자: 앞 돌림 다리, 뒤로 젖힌 등받이(룬 고리 뚫음판), 앉판(가죽·벨벳·나무)
  P.chair = (b, x, y, z, rot, o) => {
    o = o || {};
    const R = RNG(x, y, z, o), k = new K(b, x, y, z, rot), wt = woodT(R), sh = 0.46, w = 0.46, d = 0.44, bk = opt(o, 'back', 1.02);
    for (const s of [-1, 1]) {
      leg(k, 'oak', s * (w / 2 - 0.03), d / 2 - 0.03, sh - 0.04, 0.026, { t: wt });
      k.box('oak', s * (w / 2 - 0.03), (sh - 0.02) / 2, -d / 2 + 0.03, 0.045, sh - 0.02, 0.045, { c: 0.008, t: wt });
      k.box('oak', s * (w / 2 - 0.03), 0.13, 0, 0.03, 0.035, d - 0.06, { c: 0.006, t: mul(wt, 0.9) });
    }
    k.box('oak', 0, 0.13, d / 2 - 0.03, w - 0.06, 0.035, 0.03, { c: 0.006, t: mul(wt, 0.9) });
    k.box('oak', 0, sh - 0.05, 0, w, 0.07, d, { c: 0.012, t: wt });
    const seat = o.seat || R.p(['leather', 'velvet', 'wood']);
    if (seat === 'wood') k.box('oak', 0, sh - 0.005, 0.01, w + 0.02, 0.025, d + 0.02, { c: 0.01, t: mul(wt, 1.05) });
    else k.rb(seat === 'velvet' ? 'pVelvet' : 'leather', 0, sh + 0.005, 0.005, w - 0.02, 0.05, d - 0.02, 0.02, { puff: 0.015, t: o.col || (seat === 'velvet' ? R.p([C.oxblood, C.indigo, C.moss]) : null) });
    const bkF = k.child(L(0, sh - 0.02, -d / 2 + 0.03, -0.1, 0, 0)), bh = bk - sh + 0.02;
    for (const s of [-1, 1]) { bkF.box('oak', s * (w / 2 - 0.03), bh / 2, 0, 0.045, bh, 0.045, { c: 0.008, t: wt }); bkF.lathe('oak', [[0, 0], [0.02, 0], [0.026, 0.02], [0.012, 0.04], [0, 0.05]], s * (w / 2 - 0.03), bh, 0, { seg: 8, t: wt }); }
    bkF.box('oak', 0, bh - 0.05, 0, w - 0.05, 0.09, 0.04, { c: 0.012, t: wt });
    bkF.box('oak', 0, 0.12, 0, w - 0.05, 0.05, 0.035, { c: 0.008, t: wt });
    const sp = new T.Shape(); sp.moveTo(-0.05, 0); sp.quadraticCurveTo(-0.11, 0.1, -0.07, 0.2); sp.quadraticCurveTo(-0.02, 0.3, -0.09, bh - 0.25); sp.lineTo(0.09, bh - 0.25); sp.quadraticCurveTo(0.02, 0.3, 0.07, 0.2); sp.quadraticCurveTo(0.11, 0.1, 0.05, 0); sp.closePath();
    const hole = new T.Path(); hole.absarc(0, 0.25, 0.04, 0, TAU, true); sp.holes.push(hole);
    bkF.add('oak', ext(sp, 0.022, { bevel: 0.004 }), L(0, 0.145, 0), wt);
    if (o.cloth) k.add('pLinen', sheet(4, 6, (u, v) => [(u - 0.5) * 0.3, bk - 0.02 - v * 0.45 + Math.sin(u * 9) * 0.01, -d / 2 - 0.02 + (v < 0.2 ? v * 0.3 : 0.06 + v * 0.03) - (u - 0.5) * 0.02], { both: true }), L(0, 0, 0), o.cloth === true ? 0xC8B890 : o.cloth);
    k.col(0, 0, w / 2, d / 2, sh);
    return { seat: y + sh };
  };
  // 날개 안락의자 (천 씌움): 둥근 팔걸이, 날개, 등쿠션, 황동 못 장식
  P.armchair = (b, x, y, z, rot, o) => {
    o = o || {};
    const R = RNG(x, y, z, o), k = new K(b, x, y, z, rot), W = 0.86, D = 0.84, up = o.leather ? 'leather' : 'pVelvet';
    const col = o.col || (o.leather ? [0.9, 0.75, 0.6] : R.p([C.oxblood, 0x3E4A2A, C.indigo, 0x5a3a2a]));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.lathe('oak', [[0, 0], [0.022, 0], [0.03, 0.04], [0.026, 0.09], [0.034, 0.11], [0.034, 0.12], [0, 0.12]], sx * (W / 2 - 0.08), 0, sz * (D / 2 - 0.08), { seg: 10 });
    k.rb(up, 0, 0.23, 0, W - 0.02, 0.2, D - 0.04, 0.04, { t: col, side: 0.01 });
    k.rb(up, 0, 0.39, 0.06, W - 0.28, 0.13, D - 0.22, 0.05, { puff: 0.025, t: mul(tcol(col), 1.05) });
    const bk = k.child(L(0, 0.34, -D / 2 + 0.11, -0.12, 0, 0));
    bk.rb(up, 0, 0.4, 0, W - 0.16, 0.82, 0.2, 0.06, { t: col });
    bk.rb(up, 0, 0.32, 0.12, W - 0.32, 0.5, 0.12, 0.05, { puff: 0.02, rx: -PI / 2, t: mul(tcol(col), 1.08) });
    for (const s of [-1, 1]) {
      bk.rb(up, s * (W / 2 - 0.07), 0.48, 0.17, 0.12, 0.5, 0.36, 0.05, { ry: s * 0.25, t: col });
      k.rb(up, s * (W / 2 - 0.07), 0.44, 0.02, 0.14, 0.26, D - 0.12, 0.04, { t: col });
      k.lathe(up, [[0, 0], [0.07, 0], [0.072, 0.004], [0.072, D - 0.1], [0.07, D - 0.096], [0, D - 0.096]], s * (W / 2 - 0.07), 0.57, -(D - 0.1) / 2 + 0.02, { rx: PI / 2, seg: 12, t: col });
      for (let i = 0; i < 7; i++) { const a = i / 6 * PI - PI / 2; k.sph('brass', 0.006, s * (W / 2 - 0.07) + Math.sin(a) * 0.075, 0.57 + Math.cos(a) * 0.075 * 0 + Math.cos(i / 6 * PI) * 0.075, D / 2 - 0.075, { n: 3, seg: 5 }); }
    }
    k.col(0, 0, W / 2, D / 2, 1.1);
    return { seat: y + 0.46 };
  };
  P.sofa = (b, x, y, z, rot, o) => {
    o = o || {};
    const R = RNG(x, y, z, o), k = new K(b, x, y, z, rot), Lh = opt(o, 'len', 1.9), D = 0.86, col = o.col || R.p([C.oxblood, 0x3E4A2A, C.indigo]), up = o.leather ? 'leather' : 'pVelvet';
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.lathe('oak', [[0, 0], [0.024, 0], [0.032, 0.05], [0.036, 0.11], [0, 0.11]], sx * (Lh / 2 - 0.1), 0, sz * (D / 2 - 0.1), { seg: 10 });
    k.rb(up, 0, 0.22, 0, Lh, 0.2, D - 0.04, 0.05, { t: col, side: 0.012 });
    const n = Lh > 1.6 ? 3 : 2, cw = (Lh - 0.34) / n;
    for (let i = 0; i < n; i++) {
      k.rb(up, -Lh / 2 + 0.17 + cw * (i + 0.5), 0.39, 0.07, cw - 0.01, 0.14, D - 0.24, 0.05, { puff: 0.03, t: mul(tcol(col), 1.04) });
      k.rb(up, -Lh / 2 + 0.17 + cw * (i + 0.5), 0.68, -D / 2 + 0.24, cw - 0.02, 0.44, 0.14, 0.06, { puff: 0.03, rx: -PI / 2 + 0.25, t: mul(tcol(col), 1.08) });
    }
    k.rb(up, 0, 0.62, -D / 2 + 0.1, Lh - 0.04, 0.6, 0.2, 0.07, { t: col });
    for (const s of [-1, 1]) { k.rb(up, s * (Lh / 2 - 0.08), 0.46, 0.0, 0.16, 0.3, D - 0.06, 0.05, { t: col }); k.lathe(up, [[0, 0], [0.085, 0], [0.087, 0.004], [0.087, D - 0.08], [0.085, D - 0.076], [0, D - 0.076]], s * (Lh / 2 - 0.08), 0.62, -(D - 0.08) / 2, { rx: PI / 2, seg: 12, t: col }); }
    if (R() < 0.7) k.rb('pVelvet', -Lh / 2 + 0.35, 0.56, -D / 2 + 0.3, 0.36, 0.34, 0.12, 0.05, { puff: 0.03, rx: -0.3, rz: 0.2, t: R.p([0xA8843E, C.indigo, 0x6b2a22]) });
    k.col(0, 0, Lh / 2, D / 2, 0.95);
    return { seat: y + 0.46 };
  };
  // 서랍 앞판 + 황동 손잡이
  function drawer(k, x, y, z, w, h, o) {
    o = o || {};
    k.box('oak', x, y, z + 0.008, w - 0.008, h - 0.008, 0.02, { c: 0.006, t: o.t });
    k.box('oak', x, y, z + 0.02, w - 0.06, h - 0.05, 0.006, { c: 0.004, t: o.t ? mul(o.t, 1.06) : [1.06, 1.06, 1.06] });
    if (h > 0.08 && w > 0.2 && !o.knob) { k.ring('brass', 0.028, 0.0035, x, y - 0.01, z + 0.032, { rx: -PI / 2 + 0.25, ts: 10, rs: 4, arc: PI, ry: PI / 2 * 0 }); for (const s of [-1, 1]) k.cyl('brass', 0.008, 0.008, x + s * 0.028, y - 0.01, z + 0.024, { rx: PI / 2, seg: 8 }); }
    else k.sph('brass', 0.011, x, y, z + 0.034, { n: 4, seg: 8 });
  }
  // 받침 책상: 서랍 받침 둘, 가죽 판, 선택 비둘기집 선반, 꾸밈(펼친 책·종이·잉크·초)
  P.desk = (b, x, y, z, rot, o) => {
    o = o || {};
    const R = RNG(x, y, z, o), k = new K(b, x, y, z, rot), wt = woodT(R), W = opt(o, 'w', 1.45), D = opt(o, 'd', 0.78), H = 0.77, pw = 0.42;
    k.box('oak', 0, H - 0.02, 0, W, 0.04, D, { c: 0.012, t: wt, uo: R() * 3 });
    k.box('leather', 0, H + 0.0006, 0, W - 0.16, 0.002, D - 0.16, { c: 0, t: o.leatherCol || R.p([0x2F4A36, 0x5E1E22, 0x3a2a20]) });
    k.box('oak', 0, H - 0.052, 0, W - 0.02, 0.024, D - 0.02, { c: 0.008, t: mul(wt, 0.85) });
    for (const s of [-1, 1]) {
      const px = s * (W / 2 - pw / 2 - 0.01);
      k.box('oak', px, (H - 0.06) / 2 + 0.05, 0, pw, H - 0.16, D - 0.06, { c: 0.01, t: mul(wt, 0.92) });
      k.box('oak', px, 0.04, 0, pw + 0.03, 0.08, D - 0.03, { c: 0.012, t: mul(wt, 0.75) });
      const dh = (H - 0.2) / 3;
      for (let i = 0; i < 3; i++) drawer(k, px, 0.11 + dh * (i + 0.5), D / 2 - 0.03, pw - 0.04, dh - 0.01, { t: wt });
    }
    drawer(k, 0, H - 0.1, D / 2 - 0.03, W - 2 * pw - 0.06, 0.08, { t: wt });
    k.box('oakPanel', 0, (H - 0.15) / 2 + 0.06, -D / 2 + 0.05, W - 2 * pw, H - 0.2, 0.02, { c: 0.004, t: mul(wt, 0.8) });
    let topY = H;
    if (o.hutch) {
      const hw = W - 0.1, hh = 0.36, hd = 0.22, hz = -D / 2 + hd / 2 + 0.01, cols = 6;
      k.box('oak', 0, H + hh, hz, hw + 0.02, 0.025, hd + 0.02, { c: 0.008, t: wt });
      k.box('oak', 0, H + hh / 2, hz - hd / 2 + 0.008, hw, hh, 0.016, { c: 0.003, t: mul(wt, 0.5) });
      for (let i = 0; i <= cols; i++) k.box('oak', -hw / 2 + i * hw / cols, H + hh / 2, hz, 0.016, hh, hd, { c: 0.004, t: wt });
      k.box('oak', 0, H + hh / 2, hz, hw, 0.016, hd, { c: 0.004, t: wt });
      for (let i = 0; i < cols; i++) for (let j = 0; j < 2; j++) {
        if (R() < 0.25) continue;
        const cx = -hw / 2 + (i + 0.5) * hw / cols, cy = H + j * hh / 2 + 0.01;
        if (R() < 0.5) for (let q = 0; q < 1 + R.i(3); q++) k.lathe('parchment', [[0.006, 0], [0.014, 0], [0.014, 0.16], [0.006, 0.16]], cx + R.r(-0.04, 0.04), cy + 0.016 + q * 0.02, hz + 0.1, { rx: -PI / 2, seg: 8, t: 0xE6D4AE });
        else for (let q = 0; q < 3 + R.i(5); q++) k.box('pBooks', cx, cy + 0.06, hz + R.r(-0.02, 0.04) - q * 0.01, 0.1 + R.r(0, 0.03), 0.12, 0.003, { c: 0, rz: R.r(-0.3, 0.3), fuv: { pz: AT.page(2 + R.i(2)), nz: AT.page(2), px: AT.edge(), nx: AT.edge(), py: AT.edge(), ny: null } });
      }
    }
    if (o.dress !== false) {
      const DK = k;
      DK.sub(P.openBook, R.r(-0.05, 0.05), H, 0.12, R.r(-0.15, 0.15), {});
      for (let i = 0; i < 2 + R.i(3); i++) DK.sub(P.paper, R.r(-0.5, 0.45), H + 0.0015 * i, R.r(0.02, 0.22), R.r(-0.5, 0.5), { crumple: R() < 0.2 });
      DK.sub(P.inkAndQuill, W / 2 - 0.22, H, 0.18, 0, {});
      DK.sub(P.candle, -W / 2 + 0.16, H, -0.18, 0, { holder: 'dish', light: o.light === undefined ? true : o.light, melt: 0.8 });
      DK.sub(P.bookStack, -W / 2 + 0.26, H, 0.08 - (o.hutch ? 0 : 0.14), R.r(-0.3, 0.3), { n: 3 + R.i(3) });
      if (R() < 0.6) DK.sub(P.magnifier, 0.32, H, 0.24, R() * TAU, {});
      if (!o.hutch) DK.sub(P.scrolls, 0.3, H, -0.22, R.r(-0.3, 0.3), { n: 3 });
      DK.sub(P.cup, 0.5, H, -0.12, R() * TAU, { tea: true });
    }
    k.col(0, 0, W / 2, D / 2, H);
    return { top: y + topY };
  };
  // 둥근 탁자: 기둥 + 세 발 + 둥근 판
  P.roundTable = (b, x, y, z, rot, o) => {
    o = o || {};
    const R = RNG(x, y, z, o), k = new K(b, x, y, z, rot), wt = woodT(R), r = opt(o, 'r', 0.5), h = opt(o, 'h', 0.74);
    k.lathe('oak', [[0, 0], [0.09, 0.12], [0.07, 0.16], [0.05, 0.2], [0.075, 0.3], [0.045, 0.4], [0.042, h - 0.15], [0.07, h - 0.1], [0.09, h - 0.05], [0, h - 0.05]], 0, 0, 0, { seg: 12, t: wt });
    for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + 0.5; k.tube('oak', [[0, 0.16, 0], [Math.sin(a) * 0.18, 0.1, Math.cos(a) * 0.18], [Math.sin(a) * 0.32, 0.03, Math.cos(a) * 0.32], [Math.sin(a) * 0.36, 0.02, Math.cos(a) * 0.36]], t => 0.035 - t * 0.012, { rs: 6, t: wt }); k.sph('oak', 0.025, Math.sin(a) * 0.36, 0.0, Math.cos(a) * 0.36, { n: 4, seg: 6, t: wt }); }
    k.lathe('oak', [[0, 0], [r - 0.02, 0], [r, 0.012], [r + 0.004, 0.025], [r - 0.004, 0.04], [0, 0.04]], 0, h - 0.04, 0, { seg: 32, t: wt });
    if (o.dress) P.dress(b, { x, y: y + h, z, w: r * 1.3, d: r * 1.3, rot }, o.dress === true ? {} : o.dress);
    k.col(0, 0, r * 0.75, r * 0.75, h);
    return { top: y + h };
  };
  // 독서대: 십자 발, 돌림 기둥, 기울어진 판 위의 펼친 책 (+ 촛불 팔)
  P.lectern = (b, x, y, z, rot, o) => {
    o = o || {};
    const R = RNG(x, y, z, o), k = new K(b, x, y, z, rot), wt = woodT(R), H = opt(o, 'h', 1.08);
    k.box('oak', 0, 0.04, 0, 0.62, 0.08, 0.1, { c: 0.015, t: wt }); k.box('oak', 0, 0.04, 0, 0.1, 0.08, 0.5, { c: 0.015, t: wt });
    k.lathe('oak', [[0, 0], [0.09, 0.08], [0.07, 0.12], [0.05, 0.14], [0.065, 0.3], [0.042, 0.42], [0.04, H - 0.3], [0.06, H - 0.24], [0.045, H - 0.2], [0.05, H - 0.1], [0, H - 0.1]], 0, 0, 0, { seg: 12, t: wt });
    const top = k.child(L(0, H, 0, 0.42, 0, 0));
    top.box('oak', 0, -0.05, 0, 0.3, 0.1, 0.24, { c: 0.01, t: mul(wt, 0.9) });
    top.box('oak', 0, 0.015, 0, 0.6, 0.03, 0.44, { c: 0.01, t: wt });
    top.box('oak', 0, 0.045, 0.2, 0.56, 0.035, 0.025, { c: 0.008, t: wt });
    if (o.book !== false) openBookK(top, R, { H: 0.32 }, 0, 0.032, -0.01);
    if (o.candle) { k.tube('brass', [[0.04, H - 0.18, 0], [0.18, H - 0.15, 0], [0.3, H - 0.02, 0]], 0.007, { rs: 5 }); k.sub(P.candle, 0.3, H - 0.02, 0, 0, { holder: 'dish', light: o.light }); }
    k.col(0, 0, 0.3, 0.25, H);
  };
  // 펼친 책을 아무 틀(K)에 놓는다 (기울어진 독서대용)
  function openBookK(kk, R, o, x, y, z) {
    const H = o.H || 0.3, W = H * 0.72, t = 0.03, fam = R.i(6), cv = AT.cover(fam);
    for (const s of [-1, 1]) {
      kk.box('pBooks', x + s * (W / 2 + 0.002), y + 0.0016, z, W + 0.006, 0.0032, H + 0.008, { c: 0, fuv: { py: cv, ny: cv, px: cv, nx: cv, pz: cv, nz: cv } });
      kk.add('pBooks', sheet(10, 2, (u, v) => { const xx = s < 0 ? -W * (1 - u) : W * u, a = Math.abs(xx) / W; return [x + xx, y + 0.004 + t * (0.25 + 0.75 * Math.sqrt(Math.min(1, a / 0.3))) * (a > 0.9 ? 1 - (a - 0.9) * 2.2 : 1), z + (0.5 - v) * H]; }, { uvRect: AT.page(s < 0 ? 0 : 1) }));
    }
  }
  // 책장: 칸마다 책 높이·두께·색이 다르고, 5~10% 기울거나 눕고, 빈틈과 작은 물건. o.rail 황동 사다리 난간, o.ladder 사다리 위치(x)
  P.bookshelf = (b, x, y, z, rot, o) => {
    o = o || {};
    const R = RNG(x, y, z, o), k = new K(b, x, y, z, rot), wt = woodT(R);
    const bays = opt(o, 'bays', 1), bw = opt(o, 'w', 0.9), H = opt(o, 'h', 2.5), D = opt(o, 'd', 0.36), st = 0.035, W = bays * bw + (bays + 1) * st, base = 0.1;
    k.box('oak', 0, base / 2, 0.01, W + 0.03, base, D + 0.02, { c: 0.012, t: mul(wt, 0.7) });
    for (let i = 0; i <= bays; i++) k.box('oak', -W / 2 + st / 2 + i * (bw + st), base + (H - base) / 2, 0, st, H - base, D, { c: 0.008, t: wt });
    k.box('oakPanel', 0, base + (H - base) / 2, -D / 2 + 0.008, W - 0.01, H - base, 0.016, { c: 0, t: mul(wt, 0.42) });
    k.box('oak', 0, H + 0.02, 0, W + 0.03, 0.04, D + 0.03, { c: 0.01, t: wt });
    k.box('oak', 0, H + 0.065, 0.015, W + 0.08, 0.05, D + 0.07, { c: 0.015, t: mul(wt, 0.9) });
    k.box('oak', 0, H + 0.105, 0.02, W + 0.11, 0.03, D + 0.09, { c: 0.01, t: wt });
    if (o.crest !== false) for (let i = 0; i < bays; i++) {
      const cx = -W / 2 + st + bw / 2 + i * (bw + st), sh = new T.Shape(), cw = bw * 0.42;
      sh.moveTo(-cw, 0); sh.quadraticCurveTo(-cw * 0.5, 0.02, -cw * 0.35, 0.09); sh.quadraticCurveTo(0, 0.2, cw * 0.35, 0.09); sh.quadraticCurveTo(cw * 0.5, 0.02, cw, 0); sh.closePath();
      const hl = new T.Path(); hl.absarc(0, 0.095, 0.035, 0, TAU, true); sh.holes.push(hl);
      k.add('oak', ext(sh, 0.03, { bevel: 0.004 }), L(cx, H + 0.12, D / 2 - 0.01), wt);
    }
    const ns = Math.max(3, Math.round((H - base - 0.05) / 0.34)), sp = (H - base - 0.03) / ns;
    for (let j = 0; j < ns; j++) {
      const sy = base + j * sp;
      k.box('oak', 0, sy + 0.012, 0, W - 0.02, 0.025, D - 0.02, { c: 0.006, t: mul(wt, 0.95) });
      k.box('oak', 0, sy + 0.02, D / 2 - 0.006, W - 0.02, 0.035, 0.014, { c: 0.004, t: wt });
      for (let i = 0; i < bays; i++) {
        const x0 = -W / 2 + st + i * (bw + st);
        fillShelf(k, R, x0 + 0.004, x0 + bw - 0.004, sy + 0.025, sp - 0.03, D - 0.03, D / 2 - 0.012, opt(o, 'fill', 0.92), o.items !== false);
      }
    }
    k.box('oak', 0, H - 0.012, 0, W - 0.02, 0.025, D - 0.02, { c: 0.006, t: wt });
    if (o.rail) {
      const ry = H - 0.12, rz = D / 2 + 0.07;
      k.cyl('brass', 0.012, W + 0.06, -(W + 0.06) / 2, ry, rz, { rz: -PI / 2, seg: 10 });
      for (let i = 0; i <= bays; i++) { const bx = -W / 2 + st / 2 + i * (bw + st); k.tube('brass', [[bx, ry, D / 2 - 0.01], [bx, ry - 0.03, D / 2 + 0.035], [bx, ry, rz]], 0.008, { rs: 5 }); }
      if (o.ladder !== undefined && o.ladder !== false) k.sub(P.rollingLadder, o.ladder === true ? R.r(-W / 3, W / 3) : o.ladder, 0, rz + 0.015, 0, { h: ry });
    }
    k.col(0, 0, W / 2, D / 2, H + 0.1);
    return { top: y + H + 0.12, w: W };
  };
  // 한 칸 채우기
  function fillShelf(k, R, x0, x1, y0, clear, depth, zf, fill, items) {
    let x = x0 + R.r(0, 0.015);
    const bk = (t, hb, d, cx, cy, cz, rz, fam, tile, sb) => k.add('pBooks', standBook(t, hb, d, tile, fam, !!sb), L(cx, cy, cz, 0, 0, rz), mul([1, 1, 1], R.r(0.88, 1.1)));
    while (x < x1 - 0.03) {
      const r = R();
      if (r > fill + 0.04) {
        const g = R.r(0.05, 0.16);
        if (items && R() < 0.45 && x + g < x1) {
          const cx = x + g / 2, it = R(), wpos = k.w(cx, y0, zf - depth / 2);
          if (it < 0.3) P.bottle(k.b, ...wpos, k.r + R() * TAU, { s: 0.8 });
          else if (it < 0.5) P.candle(k.b, ...wpos, k.r, { holder: 'none', h: R.r(0.04, 0.09), lit: false, melt: 1 });
          else if (it < 0.7) P.scrolls(k.b, ...k.w(cx, y0, zf - depth / 2), k.r + PI / 2 + R.r(-0.2, 0.2), { n: 2 + R.i(2) });
          else if (it < 0.82) P.hourglass(k.b, ...wpos, k.r, {});
          else k.box('oak', cx, y0 + 0.04, zf - depth / 2, Math.min(g - 0.01, 0.12), 0.08, 0.1, { c: 0.008, t: [1.2, 0.9, 0.7] });
        }
        x += g; continue;
      }
      if (r < 0.07) {
        const n = 2 + R.i(3), Lm = Math.min(R.r(0.2, 0.3), x1 - x - 0.005); if (Lm < 0.16) { x += 0.04; continue; }
        let yy = y0;
        for (let i = 0; i < n && yy < y0 + clear - 0.09; i++) { const t = R.r(0.025, 0.06), hb = Lm * R.r(0.85, 1), d = Math.min(depth - 0.02, hb * R.r(0.65, 0.8)), fam = R.i(6); bk(t, hb, d, x + Lm / 2 + R.r(-0.01, 0.01), yy + hb / 2, zf - d / 2 - R.r(0, 0.02), PI / 2, fam, fam + 6 * R.i(5), 1); yy += t; }
        x += Lm + 0.008; continue;
      }
      const runN = 3 + R.i(11), series = R() < 0.25, sf = R.i(6), sh = Math.min(clear - 0.015, R.r(0.2, 0.32)), sd = R.r(0.15, 0.24);
      let lastH = 0.25;
      for (let j = 0; j < runN; j++) {
        const t = series ? R.r(0.03, 0.045) : 0.016 + Math.pow(R(), 1.7) * 0.065;
        if (x + t > x1) break;
        const hb = series ? sh : Math.min(clear - 0.012, R.r(0.17, 0.35)), d = Math.min(depth - 0.015, series ? sd : hb * R.r(0.6, 0.82)), fam = series ? sf : R.i(6);
        bk(t, hb, d, x + t / 2, y0 + hb / 2, zf - d / 2 - (series ? 0.004 : R.r(0, 0.03)), 0, fam, series ? sf + 6 * (j % 2) : fam + 6 * R.i(5));
        x += t + R.r(0, 0.0025); lastH = hb;
      }
      if (R() < 0.3 && x < x1 - 0.14) {
        const a = R.r(0.12, 0.42), t = R.r(0.02, 0.05), hb = Math.min(clear - 0.02, R.r(0.18, 0.3), lastH / Math.cos(a)), d = Math.min(depth - 0.02, hb * 0.72), fam = R.i(6);
        const xp = x + hb * Math.sin(a), cx = xp + t / 2 * Math.cos(a) - hb / 2 * Math.sin(a), cy = y0 + t / 2 * Math.sin(a) + hb / 2 * Math.cos(a);
        if (xp + t * Math.cos(a) < x1) { bk(t, hb, d, cx, cy, zf - d / 2 - 0.01, a, fam, fam + 6 * R.i(5), 1); x = xp + t * Math.cos(a) + R.r(0.02, 0.1); }
      }
    }
  }
  // 책 더미 (누운 책 n권, 비틀어 쌓기)
  P.bookStack = (b, x, y, z, rot, o) => {
    o = o || {};
    const R = RNG(x, y, z, o), k = new K(b, x, y, z, rot), n = opt(o, 'n', 3 + R.i(5));
    let yy = 0, H0 = R.r(0.28, 0.36);
    for (let i = 0; i < n; i++) {
      const H = Math.min(H0, R.r(0.2, 0.36)), W = H * R.r(0.66, 0.78), t = R.r(0.025, 0.075), fam = R.i(6);
      lyingBook(k, R.r(-0.015, 0.015), yy, R.r(-0.015, 0.015), R.r(-0.18, 0.18) + (R() < 0.25 ? PI : 0), H, W, t, fam + 6 * R.i(5), fam, 0);
      yy += t; H0 = H + 0.02;
    }
    if (o.open) k.sub(P.openBook, 0, yy, 0, R.r(-0.2, 0.2), { H: 0.24 });
    if (o.candle) k.sub(P.candle, R.r(-0.03, 0.03), yy, R.r(-0.02, 0.02), 0, { holder: 'none', h: R.r(0.05, 0.12), melt: 1, light: o.light });
    return { top: y + yy };
  };
  // 두루마리 선반: 네모 칸 격자에 끝이 보이게 꽂힌 두루마리
  P.scrollRack = (b, x, y, z, rot, o) => {
    o = o || {};
    const R = RNG(x, y, z, o), k = new K(b, x, y, z, rot), wt = woodT(R), cols = opt(o, 'cols', 5), rows = opt(o, 'rows', 6), c = 0.17, D = 0.38, W = cols * c, H = rows * c, by = 0.12;
    k.box('oak', 0, by / 2, 0, W + 0.06, by, D + 0.02, { c: 0.012, t: mul(wt, 0.7) });
    k.box('oak', 0, by + H / 2, -D / 2 + 0.008, W, H, 0.016, { c: 0, t: mul(wt, 0.4) });
    for (let i = 0; i <= cols; i++) k.box('oak', -W / 2 + i * c, by + H / 2, 0, 0.02, H + 0.02, D, { c: 0.004, t: wt });
    for (let j = 0; j <= rows; j++) k.box('oak', 0, by + j * c, 0, W + 0.02, 0.02, D, { c: 0.004, t: wt });
    k.box('oak', 0, by + H + 0.03, 0.01, W + 0.08, 0.04, D + 0.04, { c: 0.012, t: wt });
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      if (R() < 0.15) continue;
      const cx = -W / 2 + (i + 0.5) * c, cy = by + j * c + 0.01, n = 1 + R.i(4);
      for (let q = 0; q < n; q++) {
        const r = R.r(0.018, 0.032), len = R.r(0.26, D + 0.04), px = cx + R.r(-0.04, 0.04), py = cy + r + (q > 1 ? r * 1.6 : 0);
        k.lathe('parchment', [[r * 0.35, 0], [r, 0], [r, len], [r * 0.35, len], [r * 0.35, 0.002]], px, py, D / 2 - len + 0.03, { rx: PI / 2, seg: 9, t: R.p([0xE6D4AE, 0xD4BC8E, 0xEDE0C4, 0xC9AE80]) });
        if (R() < 0.35) k.ring('pVelvet', r + 0.002, 0.003, px, py, D / 2 - 0.06, { ts: 10, rs: 4, rx: PI / 2 * 0, rz: 0, ry: 0, t: R.p([0x7a1e22, C.indigo, 0xA8843E]) , s: 1 });
      }
    }
    k.col(0, 0, W / 2, D / 2, by + H);
  };
  // 목록 상자: 작은 서랍 격자 (황동 이름표·손잡이), 한두 개 열림
  P.cardCatalog = (b, x, y, z, rot, o) => {
    o = o || {};
    const R = RNG(x, y, z, o), k = new K(b, x, y, z, rot), wt = woodT(R), cols = opt(o, 'cols', 5), rows = opt(o, 'rows', 8), dw = 0.17, dh = 0.11, D = 0.5, W = cols * dw + 0.06, H = rows * dh + 0.06, ly = 0.3;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) leg(k, 'oak', sx * (W / 2 - 0.05), sz * (D / 2 - 0.05), ly, 0.035, { block: 0.3, t: wt });
    k.box('oak', 0, ly + H / 2, 0, W, H, D, { c: 0.012, t: mul(wt, 0.9) });
    k.box('oak', 0, ly + H + 0.02, 0, W + 0.04, 0.04, D + 0.04, { c: 0.012, t: wt });
    k.box('oak', 0, ly + 0.02, 0.005, W + 0.02, 0.04, D + 0.02, { c: 0.01, t: mul(wt, 0.8) });
    const open = new Set(); for (let i = 0; i < opt(o, 'open', 2); i++) open.add(R.i(cols * rows));
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const cx = -W / 2 + 0.03 + (i + 0.5) * dw, cy = ly + 0.03 + (j + 0.5) * dh, op = open.has(i * rows + j) ? R.r(0.12, 0.3) : 0, fz = D / 2 + op;
      k.box('oak', cx, cy, fz - 0.008, dw - 0.008, dh - 0.008, 0.02, { c: 0.005, t: mul(wt, R.r(0.92, 1.08)) });
      k.box('brass', cx, cy + 0.022, fz + 0.004, 0.06, 0.03, 0.003, { c: 0.001 });
      k.box('pBooks', cx, cy + 0.022, fz + 0.0058, 0.05, 0.022, 0.001, { c: 0, fuv: { pz: AT.page(2), px: null, nx: null, py: null, ny: null, nz: null } });
      k.lathe('brass', [[0, 0], [0.012, 0], [0.012, 0.004], [0.006, 0.01], [0.009, 0.018], [0, 0.02]], cx, cy - 0.022, fz, { rx: PI / 2, seg: 8 });
      if (op) {
        for (const s of [-1, 1]) k.box('oak', cx + s * (dw / 2 - 0.012), cy - 0.01, fz - 0.17, 0.01, dh - 0.03, 0.32, { c: 0.003, t: wt });
        for (let q = 0; q < 14; q++) k.box('pBooks', cx, cy - 0.005 + R.r(-0.005, 0.005), fz - 0.04 - q * 0.018, dw - 0.04, 0.075, 0.0015, { c: 0, rx: R.r(-0.25, 0.1), fuv: { pz: AT.edge(), nz: AT.edge(), py: AT.edge(), px: null, nx: null, ny: null } });
      }
    }
    if (o.lamp !== false) k.sub(P.oilLamp, W * 0.25, ly + H + 0.04, 0, 0, { light: o.light });
    k.col(0, 0, W / 2, D / 2, ly + H);
    return { top: y + ly + H + 0.04 };
  };
  // 굴림 사다리: 위 갈고리가 난간(높이 h)에 걸리고 75°로 기댄다 (지역 -z 쪽 책장)
  P.rollingLadder = (b, x, y, z, rot, o) => {
    o = o || {};
    const k = new K(b, x, y, z, rot), h = opt(o, 'h', 2.4), ang = opt(o, 'ang', 75) * PI / 180, Lr = h / Math.sin(ang), foot = h / Math.tan(ang), wd = 0.44;
    for (const s of [-1, 1]) {
      k.box('oak', s * wd / 2, h / 2 - 0.02, foot / 2, 0.045, Lr, 0.075, { c: 0.008, rx: ang - PI / 2, ax: 1 });
      k.tube('brass', [[s * wd / 2, h - 0.06, 0.02], [s * wd / 2, h + 0.03, 0.01], [s * wd / 2, h + 0.04, -0.03], [s * wd / 2, h, -0.04]], 0.008, { rs: 5 });
      k.lathe('brass', [[0, 0], [0.032, 0], [0.032, 0.018], [0, 0.018]], s * (wd / 2 + 0.03), 0.032, foot - 0.01, { rz: -PI / 2, seg: 12 });
    }
    for (let d = 0.28; d < Lr - 0.15; d += 0.28) { const yy = d * Math.sin(ang), zz = foot - d * Math.cos(ang); k.cyl('oak', 0.017, wd, -wd / 2, yy, zz, { rz: -PI / 2, seg: 8 }); }
  };

  // 기둥 넷 침대: 돌림 기둥, 판 머리판, 매트리스·누비이불·베개, 닫집과 주름 장식, 반쯤 걷어 묶은 휘장
  P.bed = (b, x, y, z, rot, o) => {
    o = o || {};
    const R = RNG(x, y, z, o), k = new K(b, x, y, z, rot), wt = woodT(R), W = opt(o, 'w', 1.2), Lb = opt(o, 'l', 2.1), ch = opt(o, 'canopy', 2.15), hz = -Lb / 2, fz = Lb / 2;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const px = sx * W / 2, pz = sz * Lb / 2, ph = ch - 0.52;
      k.box('oak', px, 0.26, pz, 0.11, 0.52, 0.11, { c: 0.012, t: wt });
      k.lathe('oak', [[0, 0], [0.05, 0], [0.058, 0.04], [0.04, 0.1], [0.036, 0.3], [0.052, 0.42], [0.033, 0.55], [0.03, ph * 0.55], [0.046, ph * 0.6], [0.03, ph * 0.66], [0.03, ph - 0.12], [0.046, ph - 0.1], [0.046, ph], [0, ph]], px, 0.52, pz, { seg: 10, t: wt });
      k.box('oak', px, ch + 0.05, pz, 0.08, 0.1, 0.08, { c: 0.01, t: wt });
      k.lathe('oak', [[0, 0], [0.03, 0], [0.046, 0.04], [0.036, 0.08], [0.012, 0.12], [0, 0.14]], px, ch + 0.1, pz, { seg: 10, t: wt });
    }
    // 머리판 (판 셋) · 발판 (판 둘)
    const pan = (zz, y0, y1, n, th) => {
      k.box('oak', 0, y0, zz, W - 0.08, 0.08, th + 0.01, { c: 0.01, t: wt }); k.box('oak', 0, y1, zz, W - 0.08, 0.1, th + 0.02, { c: 0.014, t: wt });
      const pw = (W - 0.1) / n;
      for (let i = 0; i < n; i++) { k.box('oakPanel', -W / 2 + 0.05 + (i + 0.5) * pw, (y0 + y1) / 2, zz, pw - 0.07, y1 - y0 - 0.12, th, { c: 0.008, t: mul(wt, 1.05) }); if (i) k.box('oak', -W / 2 + 0.05 + i * pw, (y0 + y1) / 2, zz, 0.06, y1 - y0, th + 0.012, { c: 0.008, t: wt }); }
    };
    pan(hz, 0.5, 1.32, 3, 0.03); pan(fz, 0.36, 0.8, 2, 0.03);
    k.ring('oak', 0.07, 0.016, 0, 1.45, hz, { rx: PI / 2, ts: 20, rs: 5, t: wt }); k.box('oak', 0, 1.39, hz, 0.24, 0.06, 0.05, { c: 0.01, t: wt });
    for (const s of [-1, 1]) k.box('oak', s * (W / 2 - 0.01), 0.38, 0, 0.06, 0.2, Lb - 0.1, { c: 0.01, t: wt });
    // 침구
    const qc = o.quilt;
    k.rb('pLinen', 0, 0.5, 0, W - 0.1, 0.22, Lb - 0.12, 0.06, { puff: 0.012, side: 0.01, t: 0xD8CCB0 });
    const q0 = hz + 0.55, qL = fz - 0.03 - q0;
    k.rb(qc ? 'pVelvet' : 'pQuilt', 0, 0.635, q0 + qL / 2, W + 0.02, 0.05, qL, 0.025, { puff: 0.03, t: qc || null });
    k.rb('pLinen', 0, 0.665, q0 + 0.08, W + 0.01, 0.03, 0.2, 0.015, { puff: 0.008, t: C.linen });
    for (const s of [-1, 1]) k.add(qc ? 'pVelvet' : 'pQuilt', sheet(12, 3, (u, v) => [s * (W / 2 + 0.012 + v * 0.03 + Math.sin(u * qL * 7 + s) * 0.014 * v), 0.64 - v * 0.36, q0 + u * qL], { uvm: [qL, 0.4], both: true }), null, qc || null);
    k.add(qc ? 'pVelvet' : 'pQuilt', sheet(8, 3, (u, v) => [(u - 0.5) * (W + 0.02), 0.64 - v * 0.3, fz - 0.02 + v * 0.03 + Math.sin(u * 9) * 0.012 * v], { uvm: [W, 0.4], both: true }), null, qc || null);
    for (const s of [-1, 1]) k.rb('pLinen', s * 0.27, 0.7, hz + 0.24, 0.5, 0.14, 0.34, 0.06, { puff: 0.03, rx: -0.45, ry: s * 0.06, t: 0xF0EADC });
    // 닫집
    for (const s of [-1, 1]) { k.box('oak', s * W / 2, ch, 0, 0.06, 0.1, Lb, { c: 0.01, t: wt }); k.box('oak', 0, ch, s * Lb / 2, W, 0.1, 0.06, { c: 0.01, t: wt }); }
    const cc = o.curtain || R.p([C.indigo, C.oxblood, 0x2F4A36]);
    k.add('pVelvet', sheet(6, 8, (u, v) => [(u - 0.5) * W, ch + 0.04 - Math.sin(u * PI) * Math.sin(v * PI) * 0.06, (v - 0.5) * Lb], { both: true }), null, cc);
    const val = (ax, len, fixed) => k.add('pVelvet', sheet(Math.round(len * 14), 2, (u, v) => { const a = (u - 0.5) * len, f = Math.sin(u * len * 9 * TAU / 2) * 0.012 * (1 - v * 0.6) + 0.03; return ax ? [a, ch + 0.05 - v * 0.3, fixed + Math.sign(fixed) * f] : [fixed + Math.sign(fixed) * f, ch + 0.05 - v * 0.3, a]; }, { both: true, uvm: [len, 0.3] }), null, cc);
    val(1, W + 0.08, -Lb / 2); val(1, W + 0.08, Lb / 2); val(0, Lb + 0.08, -W / 2); val(0, Lb + 0.08, W / 2);
    // 휘장: 기둥마다 한 폭, 1 m 높이에서 묶임
    const curtain = (px, pz, dx, dz, wTop, tieY) => {
      const nx = -dz, nz = dx, top = ch - 0.06, bot = 0.06;
      k.add('pVelvet', sheet(14, 12, (u, v) => {
        const yy = bot + v * (top - bot);
        const wy = yy > tieY ? 0.1 + (wTop - 0.1) * Math.pow((yy - tieY) / (top - tieY), 0.6) : 0.1 + 0.24 * Math.pow((tieY - yy) / (tieY - bot), 0.8);
        const al = 0.05 + u * wy, fold = Math.sin(u * 7 * TAU / 2) * (0.02 + 0.04 * wy / wTop);
        return [px + dx * al + nx * fold, yy, pz + dz * al + nz * fold];
      }), null, cc);
      k.ring('rope', 0.06, 0.008, px + dx * 0.1, tieY, pz + dz * 0.1, { ts: 12, rs: 4, t: 0xC9A45C });
      k.lathe('gold', [[0, 0], [0.018, 0.02], [0.012, 0.07], [0, 0.08]], px + dx * 0.1 + nx * 0.06, tieY - 0.12, pz + dz * 0.1 + nz * 0.06, { seg: 6 });
    };
    const side = R.s();
    curtain(-W / 2, hz, 0, 1, 0.75, 1.05); curtain(W / 2, hz, 0, 1, 0.75, 1.05);
    curtain(-W / 2, fz, 1, 0, 0.5, 1.0); curtain(W / 2, fz, -1, 0, 0.5, 1.0);
    if (o.open !== false) curtain(side * W / 2, fz, 0, -1, 0.45, 1.1);
    k.col(0, 0, W / 2 + 0.06, Lb / 2 + 0.06, 0.75);
    return { top: y + 0.67 };
  };
  // 궤짝: 둥근 뚜껑, 쇠띠, 황동 모서리와 자물쇠, 손잡이 고리. o.open 열림(안에 천·책)
  P.trunk = (b, x, y, z, rot, o) => {
    o = o || {};
    const R = RNG(x, y, z, o), k = new K(b, x, y, z, rot), wt = woodT(R), W = opt(o, 'w', 0.9), D = 0.5, H = 0.42, Rr = 0.32, al = Math.asin(D / 2 / Rr), cy = Rr * Math.cos(al);
    const bm = o.leather ? 'leather' : 'oak';
    k.box(bm, 0, H / 2, 0, W, H, D, { c: 0.014, t: o.leather ? null : wt });
    for (const bx of [-W * 0.32, W * 0.32]) k.box('iron', bx, H / 2, 0, 0.04, H + 0.006, D + 0.012, { c: 0.004 });
    k.box('iron', 0, 0.035, 0, W + 0.012, 0.03, D + 0.012, { c: 0.004 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box('brass', sx * (W / 2 - 0.02), 0.04, sz * (D / 2 - 0.02), 0.06, 0.08, 0.06, { c: 0.006 });
    const lid = o.open ? k.child(L(0, H, -D / 2, -1.85, 0, 0)) : k.child(L(0, H, -D / 2, 0, 0, 0));
    lid.lathe(bm, [[0, -W / 2], [Rr, -W / 2], [Rr, -W / 2], [Rr, W / 2], [Rr, W / 2], [0, W / 2]], 0, -cy, D / 2, { rz: -PI / 2, a0: -PI / 2 - al, a1: -PI / 2 + al, seg: 10, t: o.leather ? null : wt });
    for (const bx of [-W * 0.32, W * 0.32]) lid.ring('iron', Rr + 0.004, 0.008, bx, -cy, D / 2, { rz: PI / 2, ts: 10, rs: 4, arc: al * 2, a0: PI / 2 - al });
    lid.box('brass', 0, -0.03, D + 0.006, 0.08, 0.1, 0.01, { c: 0.003 });
    if (!o.open) k.box('brass', 0, H - 0.06, D / 2 + 0.006, 0.07, 0.08, 0.008, { c: 0.002 });
    else { k.rb('pLinen', -0.1, H - 0.06, 0, W - 0.25, 0.1, D - 0.1, 0.03, { puff: 0.02, t: C.linen }); k.sub(P.book, 0.2, H - 0.02, 0.02, 0.4, {}); k.rb('pVelvet', 0.25, H - 0.04, -0.05, 0.3, 0.06, 0.3, 0.02, { t: C.indigo }); }
    for (const s of [-1, 1]) k.ring('iron', 0.045, 0.006, s * (W / 2 + 0.012), H * 0.62, 0, { rz: PI / 2, ry: PI / 2, ts: 10, rs: 4, arc: PI, a0: PI / 2 });
    k.col(0, 0, W / 2, D / 2, H + 0.12);
    return { top: y + H + 0.12 };
  };
  // 옷장: 문 둘(올린 판), 아래 서랍, 층진 처마, 둥근 발. o.open 한쪽 문 열림
  P.wardrobe = (b, x, y, z, rot, o) => {
    o = o || {};
    const R = RNG(x, y, z, o), k = new K(b, x, y, z, rot), wt = woodT(R), W = opt(o, 'w', 1.2), H = opt(o, 'h', 2.1), D = 0.6;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.sph('oak', 0.05, sx * (W / 2 - 0.06), 0.04, sz * (D / 2 - 0.06), { n: 5, seg: 8, t: wt });
    k.box('oak', 0, 0.14, 0.01, W + 0.04, 0.1, D + 0.03, { c: 0.012, t: mul(wt, 0.8) });
    k.box('oak', 0, (H - 0.15 + 0.19) / 2, 0, W, H - 0.15 - 0.19, D, { c: 0.01, t: mul(wt, 0.9) });
    k.box('oak', 0, H - 0.12, 0.01, W + 0.06, 0.05, D + 0.04, { c: 0.01, t: wt });
    k.box('oak', 0, H - 0.07, 0.02, W + 0.12, 0.06, D + 0.08, { c: 0.016, t: mul(wt, 0.9) });
    k.box('oak', 0, H - 0.025, 0.025, W + 0.16, 0.035, D + 0.1, { c: 0.01, t: wt });
    drawer(k, 0, 0.32, D / 2 - 0.02, W - 0.08, 0.2, { t: wt });
    const dw = (W - 0.06) / 2, dh = H - 0.2 - 0.45, dy = 0.45 + dh / 2;
    const door = (kk, cx) => {
      kk.box('oak', cx, dy, 0, dw - 0.01, dh, 0.03, { c: 0.008, t: wt });
      kk.box('oakPanel', cx, dy + dh * 0.17, 0.02, dw - 0.14, dh * 0.5, 0.02, { c: 0.01, t: mul(wt, 1.06) });
      kk.box('oakPanel', cx, dy - dh * 0.3, 0.02, dw - 0.14, dh * 0.24, 0.02, { c: 0.01, t: mul(wt, 1.06) });
    };
    door(k.child(L(0, 0, D / 2 + 0.01)), -dw / 2 - 0.005);
    if (o.open) {
      const dr = k.child(L(W / 2 - 0.02, 0, D / 2 + 0.01, 0, 0.9, 0)); door(dr, -dw / 2); dr.sph('brass', 0.016, -dw + 0.05, dy, 0.03, { n: 4, seg: 8 });
      k.cyl('brass', 0.012, W - 0.1, -(W - 0.1) / 2, H - 0.35, 0, { rz: -PI / 2, seg: 8 });
      for (let i = 0; i < 3; i++) k.rb('pVelvet', -0.1 + i * 0.18, H - 0.35 - 0.6, 0.02, 0.1, 1.15, 0.42, 0.04, { side: 0.03, t: R.p([C.indigo, C.oxblood, 0x3a3540]) });
    } else { door(k.child(L(0, 0, D / 2 + 0.01)), dw / 2 + 0.005); for (const s of [-1, 1]) k.sph('brass', 0.016, s * 0.05, dy, D / 2 + 0.04, { n: 4, seg: 8 }); k.box('brass', 0.05, dy + 0.09, D / 2 + 0.03, 0.03, 0.06, 0.004, { c: 0.002 }); }
    k.col(0, 0, W / 2, D / 2, H);
  };
  // 침대 옆 탁자: 서랍 + 아래 열린 칸, 위에 촛불·책·잔
  P.nightstand = (b, x, y, z, rot, o) => {
    o = o || {};
    const R = RNG(x, y, z, o), k = new K(b, x, y, z, rot), wt = woodT(R), W = 0.48, D = 0.4, H = 0.66;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) leg(k, 'oak', sx * (W / 2 - 0.03), sz * (D / 2 - 0.03), H - 0.03, 0.028, { block: 0.45, t: wt });
    k.box('oak', 0, H - 0.015, 0, W + 0.03, 0.03, D + 0.03, { c: 0.01, t: wt });
    k.box('oak', 0, 0.16, 0, W - 0.04, 0.02, D - 0.04, { c: 0.004, t: wt });
    drawer(k, 0, H - 0.1, D / 2 - 0.03, W - 0.08, 0.12, { t: wt, knob: 1 });
    k.sub(P.book, 0.02, 0.17, 0, R.r(-0.2, 0.2), {});
    if (o.candle !== false) k.sub(P.candle, -0.12, H, -0.05, 0, { holder: 'dish', light: o.light === undefined ? true : o.light, melt: 0.9 });
    k.sub(P.bookStack, 0.1, H, 0.02, R.r(-0.3, 0.3), { n: 2 });
    if (R() < 0.6) k.sub(P.cup, 0.12, H + 0.06, 0.04, R() * TAU, { saucer: false });
    k.col(0, 0, W / 2, D / 2, H);
    return { top: y + H };
  };
  // 방석 (벨벳 + 금색 술)
  P.cushion = (b, x, y, z, rot, o) => {
    o = o || {}; const R = RNG(x, y, z, o), k = new K(b, x, y, z, rot), w = opt(o, 'w', 0.42), d = opt(o, 'd', 0.42), h = opt(o, 'h', 0.12);
    k.rb('pVelvet', 0, h / 2, 0, w, h, d, Math.min(0.05, h * 0.45), { puff: h * 0.25, sag: -h * 0.1, rx: o.rx || 0, rz: o.rz || 0, t: o.col || R.p([C.oxblood, C.indigo, 0xA8843E, 0x3E4A2A]) });
    if (o.tassel !== false) for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.lathe('gold', [[0, 0], [0.012, 0.01], [0.006, 0.04], [0, 0.045]], sx * w / 2, h * 0.45 - 0.04, sz * d / 2, { seg: 5 });
  };
  // 창가 의자: 판벽 앞면, 긴 방석, 기댄 쿠션들, 책 한 권
  P.windowSeat = (b, x, y, z, rot, o) => {
    o = o || {};
    const R = RNG(x, y, z, o), k = new K(b, x, y, z, rot), wt = woodT(R), w = opt(o, 'w', 1.4), d = opt(o, 'd', 0.5), h = 0.44;
    k.box('oak', 0, h / 2, 0, w, h - 0.03, d, { c: 0.01, t: mul(wt, 0.85) });
    for (let i = 0; i < 3; i++) k.box('oakPanel', -w / 2 + (i + 0.5) * w / 3, h / 2 - 0.02, d / 2 + 0.008, w / 3 - 0.08, h - 0.16, 0.016, { c: 0.006, t: wt });
    k.box('oak', 0, h - 0.015, 0.01, w + 0.04, 0.03, d + 0.03, { c: 0.01, t: wt });
    const col = o.col || R.p([C.indigo, C.oxblood, 0x3E4A2A]);
    k.rb('pVelvet', 0, h + 0.05, 0, w - 0.04, 0.1, d - 0.04, 0.04, { puff: 0.02, t: col });
    for (const s of [-1, 1]) k.rb('pVelvet', s * (w / 2 - 0.12), h + 0.25, -0.02, 0.36, 0.34, 0.12, 0.05, { puff: 0.03, ry: s * PI / 2.2, rx: -0.15, t: R.p([0xA8843E, C.oxblood, 0x6a6a8a]) });
    k.rb('pVelvet', -0.1, h + 0.2, -d / 2 + 0.08, 0.34, 0.3, 0.1, 0.05, { puff: 0.03, rx: -0.25, rz: 0.15, t: 0xC9B08A });
    k.sub(P.book, 0.25, h + 0.1, 0.05, R.r(0.5, 1.2), {});
    k.col(0, 0, w / 2, d / 2, h + 0.1, 0, { stand: true });
  };
  // 뾰족 아치 모양 (창·문·판에 쓴다): 폭 w, 어깨 높이 h, 아치 높이 ah
  function archShape(w, h, ah, path) {
    const s = path ? new T.Path() : new T.Shape();
    s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h);
    s.quadraticCurveTo(w / 2, h + ah * 0.72, 0, h + ah); s.quadraticCurveTo(-w / 2, h + ah * 0.72, -w / 2, h); s.closePath();
    return s;
  }
  P.archShape = archShape;
  // 창 안채움 (벽 구멍은 방 쪽이 낸다): 지역 z=0이 방 안쪽 벽면, 벽은 -thick까지. y = 창턱 높이
  // 납 마름모 유리(pNightGlass, o.glass 색), 돌 중방·가로대, 쇠 가로살, 장식 고리, 안쪽 창턱
  P.window = (b, x, y, z, rot, o) => {
    o = o || {};
    const k = new K(b, x, y, z, rot), w = opt(o, 'w', 1.2), h = opt(o, 'h', 2.2), ah = opt(o, 'ah', w * 0.6), th = opt(o, 'thick', 0.6), gz = -th * 0.62;
    const gc = tcol(o.glass !== undefined ? o.glass : [0.38, 0.48, 0.85]);
    k.add('pNightGlass', ext(archShape(w, h, ah), 0.01), L(0, 0, gz), gc);
    k.box('stoneTrim', 0, (h + ah * 0.55) / 2, gz, 0.08, h + ah * 0.55, 0.16, { c: 0.012 });
    k.box('stoneTrim', 0, h * 0.62, gz, w, 0.07, 0.14, { c: 0.01 });
    k.ring('stoneTrim', w * 0.17, 0.025, 0, h + ah * 0.42, gz, { rx: PI / 2, ts: 20, rs: 5 });
    for (let yy = 0.32; yy < h; yy += 0.36) if (Math.abs(yy - h * 0.62) > 0.1) k.box('iron', 0, yy, gz + 0.012, w, 0.014, 0.01, { c: 0 });
    k.box('stoneTrim', 0, -0.035, -th / 2 + 0.04, w + 0.14, 0.07, th + 0.08, { c: 0.015 });
    if (o.curtain) for (const s of [-1, 1]) k.add('pVelvet', sheet(8, 8, (u, v) => [s * (w / 2 + 0.05 + u * 0.32), -0.05 + v * (h + ah * 0.5), 0.06 + Math.sin(u * 4 * TAU / 2) * 0.03], { both: true }), null, o.curtain === true ? C.oxblood : o.curtain);
  };

  // =====================================================================
  // 8. 불과 빛 (모든 빛에는 보이는 근원)
  // =====================================================================
  // 벽난로: 돌 기둥·상인방(룬 고리 쐐기돌)·참나무 선반, 그을린 화실, 받침돌, 장작 받침쇠, 장작·숯·불꽃·불씨, 깜빡이는 빛.
  // 지역 z=0이 벽면, 앞은 +z. o.breast 굴뚝 가슴 높이(천장까지), o.over 'memory'|'painting'|'none', o.clutter 선반 위 물건
  P.fireplace = (b, x, y, z, rot, o) => {
    o = o || {};
    const R = RNG(x, y, z, o), k = new K(b, x, y, z, rot), ow = opt(o, 'w', 1.3), oh = opt(o, 'h', 1.05), dep = opt(o, 'd', 0.55), jw = 0.32, W = ow + jw * 2, lh = 0.36, H = oh + lh, F = dep + 0.05;
    for (const s of [-1, 1]) {
      const jx = s * (ow / 2 + jw / 2);
      k.box('stone', jx, oh / 2, (F - 0.26) / 2, jw, oh, F - 0.26, { c: 0.01 });
      k.box('stoneTrim', jx, 0.09, F - 0.13, jw + 0.05, 0.18, 0.28, { c: 0.02 });
      k.box('stoneTrim', jx, 0.18 + (oh - 0.3) / 2, F - 0.13, jw, oh - 0.3, 0.26, { c: 0.025 });
      k.box('stoneTrim', jx, oh - 0.06, F - 0.12, jw + 0.06, 0.12, 0.3, { c: 0.02 });
      k.box('stoneDark', s * (ow / 2 - 0.04), oh / 2, dep / 2, 0.08, oh, dep, { c: 0.01, ry: s * 0.22, t: 0.5 });
    }
    k.box('stone', 0, oh + lh / 2, (F - 0.28) / 2, ow, lh, F - 0.28, { c: 0.01 });
    k.box('stoneTrim', 0, oh + lh / 2, F - 0.14, W, lh, 0.3, { c: 0.025 });
    for (let i = -2; i <= 2; i++) if (i) k.box('stoneTrim', i * ow / 5, oh + lh / 2, F + 0.012, 0.012, lh - 0.04, 0.01, { c: 0, t: 0.75 });
    k.box('stoneTrim', 0, oh + lh * 0.47, F + 0.02, 0.24, lh * 0.94, 0.06, { c: 0.015, taper: 1.15 });
    k.ring('stoneTrim', 0.07, 0.012, 0, oh + lh * 0.5, F + 0.055, { rx: PI / 2, ts: 20, rs: 5 });
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; k.box('stoneTrim', Math.sin(a) * 0.092, oh + lh * 0.5 + Math.cos(a) * 0.092, F + 0.052, 0.008, 0.022, 0.012, { c: 0, rz: -a }); }
    k.add('pSoot', quad(ow * 1.05, 0.55), L(0, oh + 0.2, F + 0.002), 0.9);
    k.box('stoneTrim', 0, H - 0.025, F - 0.12, W + 0.1, 0.05, 0.34, { c: 0.015 });
    k.box('oak', 0, H + 0.035, F - 0.1, W + 0.24, 0.07, 0.4, { c: 0.016, t: [0.9, 0.85, 0.8] });
    // 화실
    k.box('stoneDark', 0, oh / 2, 0.03, ow + 0.1, oh, 0.06, { c: 0, t: 0.35 });
    k.box('stoneDark', 0, oh - 0.02, dep / 2, ow, 0.04, dep, { c: 0, t: 0.25 });
    k.box('stoneDark', 0, 0.02, dep / 2, ow, 0.04, dep, { c: 0, t: 0.45 });
    k.add('pSoot', quad(ow * 0.9, oh * 0.9), L(0, oh * 0.55, 0.062), 1);
    k.box('stoneTrim', 0, 0.03, F + 0.3, W + 0.3, 0.06, 0.64, { c: 0.015, t: 0.9 });
    // 받침쇠와 장작
    for (const s of [-1, 1]) {
      const ax = s * ow * 0.28;
      k.cyl('iron', 0.016, 0.3, ax, 0.04, F - 0.06, { seg: 8 });
      k.sph('brass', 0.034, ax, 0.38, F - 0.06, { n: 6, seg: 10 });
      k.box('iron', ax, 0.05, F - 0.04, 0.2, 0.025, 0.03, { c: 0.004 });
      k.box('iron', ax, 0.12, F * 0.5, 0.025, 0.03, dep * 0.95, { c: 0.004 });
    }
    const logs = [[0, 0.16, 0.24, 0.07, 0.1, 'pCoal'], [0.05, 0.16, 0.42, 0.065, -0.12, 'pCoal'], [-0.04, 0.27, 0.32, 0.06, 0.25, 'timber']];
    for (const [lx, ly, lz, lr, ry, mt] of logs) k.lathe(mt, [[0, 0], [lr, 0], [lr, 0], [lr * 1.05, ow * 0.4], [lr, ow * 0.78], [lr, ow * 0.78], [0, ow * 0.78]], lx - ow * 0.39, ly, lz, { rz: -PI / 2, ry, seg: 9, t: mt === 'timber' ? [0.35, 0.28, 0.22] : 1, wob: (i, a) => Math.sin(a * 3 + i) * 0.08 });
    for (let i = 0; i < 16; i++) k.sph('pCoal', R.r(0.02, 0.045), R.r(-ow * 0.38, ow * 0.38), 0.05, R.r(0.1, dep - 0.05), { n: 3, seg: 5, s: 1, t: R.r(0.6, 1.1) });
    if (o.lit !== false) {
      for (let i = 0; i < 7; i++) { const p = k.w(R.r(-ow * 0.3, ow * 0.3), 0.17, R.r(0.22, 0.4)); sprite(b, p[0], p[1], p[2], FK.fire, R.r(0.32, 0.62), R(), [1, 1, 1]); }
      for (let i = 0; i < 30; i++) { const p = k.w(R.r(-ow * 0.35, ow * 0.35), 0.2, R.r(0.2, 0.45)); sprite(b, p[0], p[1], p[2], FK.ember, R.r(0.006, 0.012), R(), [1, 1, 1]); }
      const hp = k.w(0, 0.45, F + 0.05); sprite(b, hp[0], hp[1], hp[2], FK.halo, 1.1, 0.3, [1.4, 0.7, 0.35]);
      k.add('pGlowAdd', quad(ow * 1.3, 0.9), L(0, 0.005, F + 0.32, -PI / 2, 0, 0), [0.5, 0.2, 0.06]);
      k.light(0, 0.6, F + 0.35, 0xFF7A30, opt(o, 'light', 3.0), 14, { fire: true, type: 'fire' });
    }
    if (o.breast) k.box('stone', 0, H + 0.07 + (o.breast - H - 0.07) / 2, (F - 0.32) / 2, W - 0.06, o.breast - H - 0.07, F - 0.32, { c: 0.015 });
    const over = o.over === undefined ? 'memory' : o.over;
    if (over === 'memory') k.sub(P.memoryGlass, 0, H + 0.2, F - 0.32, 0, { w: 0.8, h: 1.1 });
    else if (over === 'painting') k.sub(P.painting, 0, H + 0.25, F - 0.32, 0, { w: 1.1, h: 0.8 });
    if (o.clutter !== false) {
      const my = H + 0.07, mz = F - 0.12;
      for (const s of [-1, 1]) k.sub(P.candle, s * (W / 2 - 0.08), my, mz, 0, { holder: 'stick', sh: 0.22, h: R.r(0.18, 0.26), light: false, halo: 0.25 });
      k.sub(P.clock, -0.25, my, mz - 0.02, R.r(-0.1, 0.1), { small: true });
      k.sub(P.bookStack, W / 2 - 0.42, my, mz, R.r(-0.4, 0.4), { n: 3 });
      k.sub(P.bottle, 0.2, my, mz + 0.05, 0, { shape: 1, s: 1.1 });
      k.sub(P.bell, -W / 2 + 0.38, my, mz, 0, { r: 0.05, frame: false });
      k.sub(P.hourglass, 0.38, my, mz - 0.05, 0, {});
    }
    k.col(0, F / 2 + 0.1, W / 2, F / 2 + 0.3, H + 0.1);
    return { mantel: y + H + 0.07, front: F };
  };
  // 촛대 (팔 3 또는 5): 황동 받침과 마디 기둥, 휜 팔, 받침 접시, 초. 빛 하나
  P.candelabrum = (b, x, y, z, rot, o) => {
    o = o || {};
    const R = RNG(x, y, z, o), k = new K(b, x, y, z, rot), arms = opt(o, 'arms', 5), H = opt(o, 'h', 0.42), ra = arms > 3 ? 0.17 : 0.15, ay = H * 0.82;
    k.lathe('brass', [[0, 0], [0.085, 0], [0.09, 0.01], [0.072, 0.02], [0.045, 0.034], [0.024, 0.06], [0.016, 0.1], [0.026, 0.13], [0.014, 0.16], [0.012, H * 0.55], [0.028, H * 0.6], [0.013, H * 0.66], [0.011, H - 0.03], [0.03, H - 0.01], [0.036, H], [0.02, H], [0.016, H + 0.012], [0, H + 0.012]], 0, 0, 0, { seg: 14 });
    const lit = o.lit !== false;
    k.sub(P.candle, 0, H + 0.004, 0, 0, { holder: 'none', h: R.r(0.18, 0.24), r: 0.012, lit, halo: 0.36 });
    const n = arms - 1;
    for (let i = 0; i < n; i++) {
      const a = (n === 2 ? i * PI : i / n * TAU) + (n === 2 ? 0 : PI / 4), ca = Math.sin(a), sa = Math.cos(a), P3 = (r, yy) => [ca * r, yy, sa * r];
      k.tube('brass', [P3(0.01, H * 0.6), P3(ra * 0.45, H * 0.55), P3(ra * 0.85, H * 0.6), P3(ra, ay - 0.04), P3(ra, ay)], 0.0065, { rs: 6 });
      const [px, , pz] = P3(ra, 0);
      k.lathe('brass', [[0, 0], [0.012, 0], [0.04, 0.008], [0.042, 0.012], [0.02, 0.012], [0.016, 0.03], [0, 0.03]], px, ay, pz, { seg: 12 });
      k.sub(P.candle, px, ay + 0.012, pz, 0, { holder: 'none', h: R.r(0.12, 0.22), r: 0.011, lit: lit && R() > 0.06, halo: 0.22 });
    }
    if (o.light !== false && lit) k.light(0, H + 0.3, 0, 0xFFA24A, o.light === true || o.light === undefined ? 1.0 : o.light, 6);
    return { top: y + H + 0.3 };
  };
  // 벽등: 방패 받침판, 휜 팔, 접시와 초. 위 벽에 그을음, 둘레에 따뜻한 빛 무늬. 지역 z=0 벽면, y=판 가운데
  P.wallSconce = (b, x, y, z, rot, o) => {
    o = o || {};
    const R = RNG(x, y, z, o), k = new K(b, x, y, z, rot), n = opt(o, 'n', 1);
    const sh = new T.Shape(); sh.moveTo(-0.06, -0.14); sh.quadraticCurveTo(0, -0.2, 0.06, -0.14); sh.lineTo(0.065, 0.08); sh.quadraticCurveTo(0.06, 0.13, 0, 0.17); sh.quadraticCurveTo(-0.06, 0.13, -0.065, 0.08); sh.closePath();
    k.add('brass', ext(sh, 0.014, { bevel: 0.004 }), L(0, 0, 0.007));
    k.ring('brass', 0.035, 0.006, 0, 0.02, 0.017, { rx: PI / 2, ts: 16, rs: 4 });
    for (let i = 0; i < n; i++) {
      const ax = n === 1 ? 0 : (i ? 0.15 : -0.15);
      k.tube('brass', [[0, -0.05, 0.014], [ax * 0.3, -0.11, 0.07], [ax * 0.8, -0.08, 0.15], [ax, -0.01, 0.18], [ax, 0.0, 0.18]], 0.0075, { rs: 6 });
      k.lathe('brass', [[0, 0], [0.01, 0], [0.05, 0.01], [0.052, 0.015], [0.018, 0.012], [0.016, 0.03], [0, 0.03]], ax, 0, 0.18, { seg: 12 });
      k.sub(P.candle, ...[ax, 0.012, 0.18], 0, { holder: 'none', h: R.r(0.14, 0.2), r: 0.012, halo: 0.34, lit: o.lit });
    }
    if (o.soot !== false) k.add('pSoot', quad(0.34 + n * 0.12, 0.6), L(0, 0.48, 0.003), 0.85);
    if (o.lit !== false) { k.add('pGlowAdd', quad(1.2 + n * 0.3, 1.2), L(0, 0.22, 0.005), [0.32, 0.17, 0.07]); k.light(0, 0.28, 0.32, 0xFFA24A, opt(o, 'light', 1.1), 7); }
  };
  // 혼천의 샹들리에: 천장 장미, 쇠사슬, 고정된 축과 고리들이 천천히 돈다 (초 고리, 자오환, 황도환), 가운데 마나 수정
  P.chandelier = (b, x, y, z, rot, o) => {
    o = o || {};
    const R = RNG(x, y, z, o), k = new K(b, x, y, z, rot), R0 = opt(o, 'r', 0.85), drop = opt(o, 'drop', 1.6), n = opt(o, 'n', 12), cy = -drop;
    k.lathe('brass', [[0, -0.08], [0.03, -0.08], [0.1, -0.035], [0.14, -0.01], [0.14, 0], [0, 0]], 0, 0, 0, { seg: 18 });
    const top = cy + R0 * 0.82;
    for (let yy = -0.1, i = 0; yy > top + 0.05; yy -= 0.07, i++) k.ring('iron', 0.026, 0.006, 0, yy - 0.035, 0, { rx: PI / 2, ry: i % 2 ? PI / 2 : 0, ts: 10, rs: 4 });
    k.lathe('brass', [[0, 0], [0.07, 0.02], [0.09, 0.06], [0.05, 0.1], [0.02, 0.14], [0.03, 0.17], [0, 0.18]], 0, top - 0.1, 0, { seg: 14 });
    k.cyl('brass', 0.014, top - 0.1 - (cy - R0 * 0.7), 0, cy - R0 * 0.7, 0, { seg: 8 });
    k.lathe('brass', [[0, 0], [0.02, 0.03], [0.05, 0.08], [0.04, 0.12], [0.015, 0.14], [0, 0.14]], 0, cy - R0 * 0.78, 0, { seg: 12 });
    k.lathe('pCrystal', [[0, -0.11], [0.06, 0], [0, 0.11]], 0, cy, 0, { seg: 6, flat: true });
    k.ring('brass', 0.08, 0.006, 0, cy, 0, { rx: PI / 2, ts: 16, rs: 4 }); k.ring('brass', 0.08, 0.006, 0, cy, 0, { ts: 16, rs: 4 });
    { const p = k.w(0, cy, 0); sprite(b, p[0], p[1], p[2], FK.glow, 0.45, 0.4, [0.25, 0.85, 0.95]); }
    // 도는 고리들 (따로 묶어 extra로)
    const W0 = k.w(0, cy, 0), groups = [];
    const mk = (fn, setup) => { const sb = new Batch(); fn(new K(sb, 0, 0, 0, 0)); const g = sb.build(); const pivot = new T.Group(); pivot.position.set(W0[0], W0[1], W0[2]); pivot.rotation.y = rot; if (setup) setup(pivot, g); else pivot.add(g); b.extra.push(pivot); groups.push(g); return g; };
    const g1 = mk(kk => {
      kk.ring('brass', R0, 0.024, 0, 0, 0, { ts: 48, rs: 6 }); kk.ring('brass', R0 - 0.06, 0.009, 0, 0, 0, { ts: 48, rs: 4 });
      for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; kk.box('brass', Math.sin(a) * (R0 - 0.03), 0.0, Math.cos(a) * (R0 - 0.03), 0.012, 0.03, i % 3 ? 0.05 : 0.08, { c: 0.002, ry: a }); }
      for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + PI / 4; kk.tube('brass', [[Math.sin(a) * 0.02, 0, Math.cos(a) * 0.02], [Math.sin(a) * R0 * 0.5, 0.06, Math.cos(a) * R0 * 0.5], [Math.sin(a) * (R0 - 0.02), 0, Math.cos(a) * (R0 - 0.02)]], 0.008, { rs: 5 }); }
      for (let i = 0; i < n; i++) {
        const a = (i + 0.5) / n * TAU, px = Math.sin(a) * R0, pz = Math.cos(a) * R0;
        kk.lathe('brass', [[0, -0.02], [0.012, -0.02], [0.045, 0.012], [0.047, 0.016], [0.018, 0.014], [0.016, 0.034], [0, 0.034]], px, 0.02, pz, { seg: 10 });
        P.candle(kk.b, px, 0.054, pz, 0, { holder: 'none', h: R.r(0.14, 0.2), r: 0.012, halo: 0.3, seed: i * 31 + 7 });
      }
    });
    const g2 = mk(kk => { kk.ring('brass', R0 * 0.8, 0.017, 0, 0, 0, { rx: PI / 2, ts: 40, rs: 5 }); for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; kk.box('brass', Math.sin(a) * R0 * 0.8, Math.cos(a) * R0 * 0.8, 0, 0.03, 0.012, 0.03, { c: 0.002, rz: -a }); } });
    const g3 = mk(kk => { kk.ring('gold', R0 * 0.66, 0.02, 0, 0, 0, { ts: 40, rs: 5 }); kk.ring('brass', R0 * 0.66, 0.006, 0, 0.03, 0, { ts: 40, rs: 3 }); kk.ring('brass', R0 * 0.66, 0.006, 0, -0.03, 0, { ts: 40, rs: 3 }); }, (pv, g) => { const tilt = new T.Group(); tilt.rotation.z = 0.41; tilt.add(g); pv.add(tilt); });
    const g4 = mk(kk => { kk.ring('brass', R0 * 0.42, 0.012, 0, 0, 0, { rz: PI / 2, ts: 32, rs: 4 }); });
    const sp = opt(o, 'speed', 1);
    b.anims.push(t => { g1.rotation.y = t * 0.035 * sp; g2.rotation.y = -t * 0.08 * sp; g3.rotation.y = t * 0.12 * sp; g4.rotation.x = t * 0.18 * sp; g4.rotation.y = t * 0.05; });
    k.light(0, cy + 0.1, 0, 0xFFB060, opt(o, 'light', 2.2), 15);
    if (o.manaLight !== false) k.light(0, cy, 0, 0x7FF0FF, 0.35, 4, { flicker: false });
  };
  // 등불 (서거나 o.hang이면 y에서 매달림): 쇠틀, 유리, 지붕, 고리, 안의 초
  P.lantern = (b, x, y, z, rot, o) => {
    o = o || {};
    const R = RNG(x, y, z, o), k = new K(b, x, y, z, rot), s = opt(o, 's', 1), w = 0.15 * s, h = 0.26 * s, by = o.hang ? -h - 0.16 * s : 0, mt = o.brass ? 'brass' : 'iron';
    k.box(mt, 0, by + 0.012 * s, 0, w + 0.03 * s, 0.024 * s, w + 0.03 * s, { c: 0.004 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(mt, sx * w / 2, by + h / 2, sz * w / 2, 0.012 * s, h, 0.012 * s, { c: 0.002 });
    k.box(mt, 0, by + h, 0, w + 0.024 * s, 0.018 * s, w + 0.024 * s, { c: 0.003 });
    k.lathe(mt, [[0, 0], [w * 0.8, 0], [w * 0.8, 0.012 * s], [0.014 * s, h * 0.36], [0.02 * s, h * 0.4], [0.02 * s, h * 0.45], [0, h * 0.45]], 0, by + h + 0.009 * s, 0, { seg: 4, ry: PI / 4, flat: true });
    k.ring(mt, 0.03 * s, 0.005 * s, 0, by + h + h * 0.45 + 0.035 * s, 0, { rx: PI / 2, ts: 12, rs: 4 });
    for (const [gx, gz, r2] of [[0, w / 2, 0], [0, -w / 2, 0], [w / 2, 0, PI / 2], [-w / 2, 0, PI / 2]]) k.box('pGlass', gx, by + h / 2, gz, w - 0.012 * s, h - 0.02 * s, 0.003, { c: 0, ry: r2, t: 0xF2E6D0 });
    for (const sx of [-1, 1]) k.box(mt, sx * w * 0.2, by + h / 2, w / 2 + 0.004, 0.005 * s, h - 0.02, 0.004, { c: 0 });
    P.candle(b, ...k.w(0, by + 0.024 * s, 0), rot, { holder: 'none', h: 0.1 * s, r: 0.014 * s, halo: 0.42 * s, melt: 0.6, seed: R.i(1e6) });
    if (o.hang) k.cyl('iron', 0.004, 0.12 * s, 0, by + h + h * 0.45 + 0.06 * s, 0, { seg: 4 });
    if (o.light) k.light(0, by + h * 0.6, 0, 0xFFB060, o.light === true ? 1.2 : o.light, 8);
  };
  // 기름 등잔: 황동 받침과 기름통, 젖빛 유리 갓(발광), 유리 굴뚝, 작은 불꽃
  P.oilLamp = (b, x, y, z, rot, o) => {
    o = o || {};
    const k = new K(b, x, y, z, rot), s = opt(o, 's', 1);
    k.lathe('brass', [[0, 0], [0.07, 0], [0.072, 0.012], [0.05, 0.025], [0.022, 0.05], [0.016, 0.12], [0.028, 0.14], [0.058, 0.17], [0.064, 0.2], [0.044, 0.235], [0.03, 0.25], [0.034, 0.27], [0, 0.27]].map(p => [p[0] * s, p[1] * s]), 0, 0, 0, { seg: 16 });
    k.lathe('pFrost', [[0.03, 0], [0.06, 0.02], [0.095, 0.07], [0.1, 0.11], [0.08, 0.16], [0.042, 0.19], [0.04, 0.195], [0.03, 0.2]].map(p => [p[0] * s, p[1] * s]), 0, 0.26 * s, 0, { seg: 18, t: o.col || 1 });
    k.lathe('pGlass', [[0.022, 0], [0.026, 0.05], [0.019, 0.1], [0.019, 0.24], [0.016, 0.24]].map(p => [p[0] * s, p[1] * s]), 0, 0.3 * s, 0, { seg: 12, t: 0xF0F0F0 });
    k.fl(0, 0.31 * s, 0, 0.04 * s, { halo: 0.55 * s, hk: 0.8 });
    if (o.light !== false) k.light(0, 0.42 * s, 0, 0xFFB869, o.light === true || o.light === undefined ? 1.0 : o.light, 6);
    return { top: y + 0.55 * s };
  };
  // 새장 등: 황동 철사 둥근 지붕, 안에 초 또는 마나 수정
  P.birdcage = (b, x, y, z, rot, o) => {
    o = o || {};
    const k = new K(b, x, y, z, rot), r = 0.15, h = 0.34, by = o.hang ? -h - 0.12 : 0;
    k.lathe('brass', [[0, 0], [r + 0.02, 0], [r + 0.02, 0.025], [r, 0.03], [0, 0.03]], 0, by, 0, { seg: 20 });
    const nw = 16;
    for (let i = 0; i < nw; i++) { const a = i / nw * TAU, pts = []; for (let j = 0; j <= 8; j++) { const t = j / 8, yy = t < 0.6 ? t / 0.6 * h * 0.62 : h * 0.62 + Math.sin((t - 0.6) / 0.4 * PI / 2) * h * 0.38, rr = t < 0.6 ? r : r * Math.cos((t - 0.6) / 0.4 * PI / 2); pts.push([Math.sin(a) * rr, by + 0.03 + yy, Math.cos(a) * rr]); } k.tube('brass', pts, 0.0028, { rs: 3 }); }
    for (const yy of [0.03, h * 0.35, h * 0.65]) k.ring('brass', r, 0.005, 0, by + yy, 0, { ts: 24, rs: 4 });
    k.lathe('brass', [[0, 0], [0.025, 0], [0.03, 0.02], [0.012, 0.05], [0, 0.06]], 0, by + h + 0.02, 0, { seg: 10 });
    k.ring('brass', 0.03, 0.005, 0, by + h + 0.11, 0, { rx: PI / 2, ts: 12, rs: 4 });
    if (o.hang) k.cyl('iron', 0.004, 0.06, 0, by + h + 0.14, 0, { seg: 4 });
    if (o.crystal) { k.lathe('pCrystal', [[0, -0.05], [0.03, 0], [0, 0.06]], 0, by + 0.12, 0, { seg: 5, flat: true }); const p = k.w(0, by + 0.12, 0); sprite(b, p[0], p[1], p[2], FK.glow, 0.35, 0.7, [0.25, 0.8, 0.9]); if (o.light) k.light(0, by + 0.15, 0, 0x7FF0FF, 0.6, 5, { flicker: false }); }
    else { P.candle(b, ...k.w(0, by + 0.03, 0), rot, { holder: 'none', h: 0.12, r: 0.014, halo: 0.4 }); if (o.light) k.light(0, by + 0.2, 0, 0xFFA24A, o.light === true ? 0.9 : o.light, 6); }
  };

  // =====================================================================
  // 9. 기구
  // =====================================================================
  // 바닥 지구의: 휜 다리 셋, 지평환(참나무), 황동 자오환, 23° 기운 구
  P.globe = (b, x, y, z, rot, o) => {
    o = o || {};
    const k = new K(b, x, y, z, rot), r = opt(o, 'r', 0.3), cy = opt(o, 'h', r + 0.55);
    for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + 0.3, A = (rr, yy) => [Math.sin(a) * rr, yy, Math.cos(a) * rr]; k.tube('oak', [A(r + 0.06, cy - 0.02), A(r + 0.1, cy - 0.25), A(r + 0.08, cy * 0.45), A(0.36, 0.12), A(0.4, 0.02)], s => 0.024 - s * 0.008, { rs: 6 }); k.sph('brass', 0.022, ...A(0.4, 0.02), { n: 4, seg: 6 }); }
    k.lathe('oak', [[0, 0], [0.05, 0.04], [0.03, 0.1], [0.04, 0.14], [0, 0.18]], 0, 0.12, 0, { seg: 10 });
    for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + 0.3; k.tube('oak', [[0, 0.17, 0], [Math.sin(a) * 0.37, 0.12, Math.cos(a) * 0.37]], 0.012, { rs: 5 }); }
    k.lathe('oak', [[r + 0.012, 0], [r + 0.075, 0], [r + 0.075, 0.022], [r + 0.012, 0.022], [r + 0.012, 0.0]], 0, cy - 0.011, 0, { seg: 36 });
    k.ring('brass', r + 0.075, 0.004, 0, cy + 0.022, 0, { ts: 36, rs: 3 });
    const gl = k.child(L(0, cy, 0, 0, 0, 0.41));
    const pr = []; for (let i = 0; i <= 12; i++) { const a = -PI / 2 + PI * i / 12; pr.push([Math.cos(a) * r, Math.sin(a) * r]); } pr[0][0] = 0; pr[12][0] = 0;
    gl.add('pMap', lathe(pr, 28, { uvRect: [0.5, 0, 1, 1] }), L(0, 0, 0, 0, o.spinA || 0, 0));
    gl.ring('brass', r + 0.025, 0.009, 0, 0, 0, { rx: PI / 2, ts: 40, rs: 5 });
    gl.cyl('brass', 0.006, 2 * r + 0.1, 0, -r - 0.05, 0, { seg: 6 });
    k.col(0, 0, r + 0.1, r + 0.1, cy + r);
  };
  // 혼천의: 지평환·자오환·적도·황도(눈금)·분지환·회귀선, 가운데 땅공. o.stand 'table'|'floor', o.spin 안쪽이 돈다
  P.armillarySphere = (b, x, y, z, rot, o) => {
    o = o || {};
    const k = new K(b, x, y, z, rot), r = opt(o, 'r', 0.22), floor = o.stand === 'floor', cy = floor ? 1.05 : r * 1.25 + 0.1;
    if (floor) { k.lathe('oak', [[0, 0], [0.22, 0], [0.22, 0.05], [0.12, 0.08], [0.05, 0.14], [0.06, 0.3], [0.035, 0.45], [0.03, cy - r * 1.2], [0.05, cy - r * 1.15], [0, cy - r * 1.15]], 0, 0, 0, { seg: 14 }); }
    else { k.lathe('brass', [[0, 0], [0.11, 0], [0.115, 0.012], [0.09, 0.025], [0.03, 0.04], [0.016, 0.07], [0.022, cy - r * 1.15], [0, cy - r * 1.1]], 0, 0, 0, { seg: 14 }); }
    k.lathe('brass', [[r * 1.08, -0.008], [r * 1.18, -0.008], [r * 1.18, 0.008], [r * 1.08, 0.008], [r * 1.08, -0.008]], 0, cy, 0, { seg: 40 });
    for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + PI / 4; k.tube('brass', [[0, cy - r * 1.12, 0], [Math.sin(a) * r * 0.9, cy - r * 0.95, Math.cos(a) * r * 0.9], [Math.sin(a) * r * 1.12, cy - 0.01, Math.cos(a) * r * 1.12]], 0.005, { rs: 4 }); }
    k.ring('brass', r * 1.05, 0.008, 0, cy, 0, { rx: PI / 2, ts: 40, rs: 5 });
    const inner = kk => {
      kk.ring('brass', r, 0.007, 0, 0, 0, { ts: 36, rs: 4 });
      kk.lathe('gold', [[r * 0.97, -0.014], [r * 1.0, -0.014], [r * 1.0, 0.014], [r * 0.97, 0.014], [r * 0.97, -0.014]], 0, 0, 0, { seg: 40, rz: 0.41 });
      for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, l = kk.child(L(0, 0, 0, 0, 0, 0.41)); l.box('brass', Math.sin(a) * r, 0, Math.cos(a) * r, 0.004, 0.034, 0.004, { c: 0 }); }
      kk.ring('brass', r * 0.99, 0.005, 0, 0, 0, { rx: PI / 2, ts: 36, rs: 4 }); kk.ring('brass', r * 0.99, 0.005, 0, 0, 0, { rx: PI / 2, ry: PI / 2, ts: 36, rs: 4 });
      for (const s of [-1, 1]) kk.ring('brass', r * Math.cos(0.41), 0.004, 0, s * r * Math.sin(0.41), 0, { ts: 30, rs: 3 });
      kk.sph('pCeramic', r * 0.18, 0, 0, 0, { n: 8, seg: 14, t: 0x4a6a8a });
      kk.cyl('brass', 0.004, r * 2.3, 0, -r * 1.15, 0, { seg: 5 });
    };
    if (o.spin) {
      const sb = new Batch(); inner(new K(sb, 0, 0, 0, 0)); const g = sb.build(), pv = new T.Group(), p = k.w(0, cy, 0);
      pv.position.set(p[0], p[1], p[2]); pv.rotation.set(0, rot, 0.38); pv.add(g); b.extra.push(pv);
      b.anims.push(t => { g.rotation.y = t * 0.15; });
    } else inner(k.child(L(0, cy, 0, 0, 0, 0.38)));
    return { top: y + cy + r * 1.2 };
  };
  // 태양계의(오러리): 황동 북, 금빛 해, 길이가 다른 팔 끝의 행성들이 저마다 돈다
  P.orrery = (b, x, y, z, rot, o) => {
    o = o || {};
    const R = RNG(x, y, z, o), k = new K(b, x, y, z, rot), s = opt(o, 'r', 0.36) / 0.36;
    for (let i = 0; i < 3; i++) { const a = i / 3 * TAU; k.sph('brass', 0.022 * s, Math.sin(a) * 0.17 * s, 0.02 * s, Math.cos(a) * 0.17 * s, { n: 4, seg: 8 }); }
    k.lathe('brass', [[0, 0], [0.2, 0], [0.21, 0.01], [0.21, 0.07], [0.19, 0.08], [0.06, 0.09], [0.03, 0.1], [0, 0.1]].map(p => [p[0] * s, p[1] * s]), 0, 0.03 * s, 0, { seg: 28 });
    k.lathe('oak', [[0.19, 0], [0.205, 0], [0.205, 0.04], [0.19, 0.04]].map(p => [p[0] * s, p[1] * s]), 0, 0.05 * s, 0, { seg: 28 });
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; k.box('gold', Math.sin(a) * 0.206 * s, 0.07 * s, Math.cos(a) * 0.206 * s, 0.01 * s, 0.03 * s, 0.004, { ry: a, c: 0 }); }
    k.cyl('brass', 0.012 * s, 0.2 * s, 0, 0.13 * s, 0, { seg: 8 });
    k.sph('gold', 0.05 * s, 0, 0.36 * s, 0, { n: 10, seg: 16 });
    const pl = [[0.1, 0.012, 'iron', null], [0.15, 0.016, 'pCeramic', 0xC0A080], [0.2, 0.02, 'pCeramic', 0x4a7aa8], [0.25, 0.015, 'pClay', 0xA84A2A], [0.31, 0.03, 'brass', null], [0.36, 0.024, 'pCeramic', 0xC8B48A]];
    pl.forEach(([ri, pr, mt, tc], i) => {
      const sb = new Batch(), kk = new K(sb, 0, 0, 0, 0), hy = (0.2 + i * 0.022) * s, py = 0.3 * s + (i % 2 ? 0.02 : -0.03) * s;
      kk.cyl('brass', 0.014 * s, 0.01 * s, 0, hy - 0.005 * s, 0, { seg: 8 });
      kk.tube('brass', [[0, hy, 0], [ri * s * 0.6, hy, 0], [ri * s, hy, 0], [ri * s, py - pr * s, 0]], 0.0035 * s, { rs: 4 });
      kk.sph(mt, pr * s, ri * s, py, 0, { n: 8, seg: 12, t: tc });
      if (i === 4) kk.ring('gold', pr * s * 1.7, 0.003 * s, ri * s, py, 0, { rx: 0.4, ts: 20, rs: 3 });
      if (i === 2) { kk.tube('brass', [[ri * s, py + pr * s, 0], [ri * s, py + pr * s + 0.02 * s, 0], [ri * s + 0.04 * s, py + pr * s + 0.02 * s, 0]], 0.002 * s, { rs: 3 }); kk.sph('pCeramic', 0.007 * s, ri * s + 0.04 * s, py + pr * s + 0.012 * s, 0, { n: 4, seg: 6, t: 0xD8D0C0 }); }
      const g = sb.build(), pv = new T.Group(), p = k.w(0, 0, 0); pv.position.set(p[0], p[1], p[2]); pv.rotation.y = rot; pv.add(g); b.extra.push(pv);
      const sp = 0.5 * Math.pow(0.1 / ri, 1.5), ph = R() * TAU; b.anims.push(t => { g.rotation.y = ph + t * sp; });
    });
    return { top: y + 0.45 * s };
  };
  // 망원경: 참나무 세발, 황동 머리, 마디진 경통(가죽 감음), 파인더. o.pitch 올려본 각
  P.telescope = (b, x, y, z, rot, o) => {
    o = o || {};
    const k = new K(b, x, y, z, rot), hy = 1.12, pitch = opt(o, 'pitch', 0.5);
    for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + PI / 6, fx = Math.sin(a) * 0.48, fz = Math.cos(a) * 0.48, len = Math.hypot(fx, hy, fz), tl = Math.atan2(Math.hypot(fx, fz), hy);
      k.box('oak', fx / 2, hy / 2, fz / 2, 0.04, len, 0.03, { c: 0.008, ry: a, rx: -tl, ax: 1 }); k.cyl('brass', 0.022, 0.05, fx, 0, fz, { seg: 8 }); }
    k.lathe('brass', [[0, -0.06], [0.05, -0.06], [0.06, -0.02], [0.04, 0.02], [0.02, 0.06], [0, 0.06]], 0, hy, 0, { seg: 12 });
    const tb = k.child(L(0, hy + 0.1, 0, 0, 0, pitch));
    tb.box('brass', 0, -0.05, 0, 0.05, 0.08, 0.14, { c: 0.01 });
    const sec = [[-0.62, -0.42, 0.022], [-0.42, -0.2, 0.034], [-0.2, 0.62, 0.052], [0.62, 0.76, 0.064]];
    for (const [a0, a1, rr] of sec) tb.lathe('brass', [[0, 0], [rr, 0], [rr, 0], [rr, a1 - a0], [rr, a1 - a0], [0, a1 - a0]], a0, 0, 0, { rz: -PI / 2, seg: 16 });
    tb.lathe('leather', [[0.054, 0], [0.054, 0.36]], -0.05, 0, 0, { rz: -PI / 2, seg: 16 });
    for (const xx of [-0.42, -0.2, 0.62, 0.3]) tb.ring('brass', xx === 0.62 ? 0.066 : xx === 0.3 ? 0.055 : xx === -0.2 ? 0.054 : 0.036, 0.006, xx, 0, 0, { rz: PI / 2, ts: 18, rs: 4 });
    tb.lathe('pGlass', [[0, 0], [0.058, 0], [0, 0.002]], 0.75, 0, 0, { rz: -PI / 2, seg: 14, t: 0x8090a0 });
    tb.cyl('brass', 0.012, 0.22, 0.1, 0.08, 0, { rz: -PI / 2, seg: 8 }); tb.box('brass', 0.2, 0.06, 0, 0.02, 0.03, 0.015, { c: 0.002 });
    k.col(0, 0, 0.3, 0.3, 1.6);
  };
  // 소리굽쇠 걸이: 크기 순서대로 선 굽쇠들, 공명 상자, 작은 망치
  P.tuningForkRack = (b, x, y, z, rot, o) => {
    o = o || {};
    const R = RNG(x, y, z, o), k = new K(b, x, y, z, rot), n = opt(o, 'n', 9), W = 0.7;
    k.box('oak', 0, 0.025, 0, W, 0.05, 0.18, { c: 0.01 });
    k.box('oak', 0, 0.12, -0.075, W, 0.19, 0.025, { c: 0.008 });
    k.box('oak', 0, 0.075, 0.03, W - 0.02, 0.04, 0.05, { c: 0.008, t: 0.9 });
    for (let i = 0; i < n; i++) {
      const L0 = 0.36 - i * (0.24 / (n - 1)), fx = -W / 2 + 0.05 + i * (W - 0.1) / (n - 1), g = L0 * 0.06 + 0.006, mt = i % 3 === 1 ? 'brass' : 'pPewter', tc = mt === 'pPewter' ? 0xD0D4D8 : null;
      k.cyl(mt, 0.0055, L0 * 0.32, fx, 0.06, 0.03, { seg: 6, t: tc });
      const pts = [[fx - g, 0.06 + L0, 0.03], [fx - g, 0.06 + L0 * 0.4, 0.03]];
      for (let j = 1; j < 6; j++) { const a = PI + j / 6 * PI; pts.push([fx + Math.cos(a) * g, 0.06 + L0 * 0.4 + Math.sin(a) * g, 0.03]); }
      pts.push([fx + g, 0.06 + L0 * 0.4, 0.03], [fx + g, 0.06 + L0, 0.03]);
      k.tube(mt, pts, 0.0045, { rs: 5, t: tc });
      k.sph(mt, 0.008, fx, 0.06 + L0 * 0.32, 0.03, { n: 3, seg: 6, t: tc });
    }
    if (o.box !== false) { k.box('oak', W / 2 + 0.2, 0.06, 0.02, 0.28, 0.12, 0.14, { c: 0.008, t: [1.25, 1.05, 0.85] }); k.cyl('oak', 0.03, 0.002, W / 2 + 0.2, 0.06, 0.091, { rx: PI / 2, seg: 12, t: 0.15 }); }
    k.cyl('oak', 0.006, 0.2, -0.1, 0.008, 0.14, { rz: -PI / 2, ry: 0.3, seg: 6 }); k.sph('pLinen', 0.018, -0.1 + 0.19, 0.012, 0.14 - 0.06, { n: 5, seg: 8, t: 0x8a3a3a });
  };
  // 공명 종 (청동): 속이 빈 종, 추, 참나무 틀. o.frame false면 종만 (y = 종 아래 테)
  P.bell = (b, x, y, z, rot, o) => {
    o = o || {};
    const k = new K(b, x, y, z, rot), r = opt(o, 'r', 0.22), h = r * 1.15, frame = o.frame !== false && !o.hang, by = frame ? 0.95 - h : o.hang ? -h - 0.08 : 0;
    k.lathe('brass', [[0, h * 0.9], [r * 0.45, h * 0.86], [r * 0.6, h * 0.6], [r * 0.7, h * 0.3], [r * 0.86, h * 0.06], [r * 0.9, 0], [r, 0], [r * 1.0, h * 0.04], [r * 0.93, h * 0.1], [r * 0.77, h * 0.35], [r * 0.66, h * 0.65], [r * 0.6, h * 0.86], [r * 0.48, h * 0.97], [0, h]], 0, by, 0, { seg: 24, t: [0.78, 0.62, 0.48] });
    k.ring('brass', r * 0.92, r * 0.025, 0, by + h * 0.12, 0, { ts: 24, rs: 4, t: [0.9, 0.7, 0.5] });
    k.ring('brass', r * 0.62, r * 0.018, 0, by + h * 0.8, 0, { ts: 24, rs: 4, t: [0.9, 0.7, 0.5] });
    k.ring('brass', r * 0.18, r * 0.04, 0, by + h + r * 0.15, 0, { rx: PI / 2, ts: 12, rs: 5, t: [0.78, 0.62, 0.48] });
    k.cyl('iron', r * 0.03, h * 0.75, 0, by + h * 0.12, 0, { seg: 5 }); k.sph('iron', r * 0.13, 0, by + h * 0.12, 0, { n: 5, seg: 8 });
    if (frame) {
      const fw = r * 2 + 0.3;
      for (const s of [-1, 1]) { k.box('oak', s * fw / 2, 0.6, 0, 0.09, 1.2, 0.09, { c: 0.012 }); k.box('oak', s * fw / 2, 0.04, 0, 0.12, 0.08, 0.5, { c: 0.012 }); k.box('oak', s * fw / 2, 0.25, s * 0, 0.05, 0.05, 0.4, { c: 0.008, rx: 0 }); }
      k.box('oak', 0, 1.18, 0, fw + 0.2, 0.12, 0.12, { c: 0.016 });
      k.box('iron', 0, by + h + r * 0.15 + 0.1, 0, 0.03, 1.12 - (by + h + r * 0.15), 0.03, { c: 0.004 });
      k.col(0, 0, fw / 2 + 0.1, 0.25, 1.25);
    } else if (o.hang) k.cyl('iron', 0.012, 0.08, 0, by + h + r * 0.2, 0, { seg: 6 });
  };
  // 칠판: 참나무 틀, 분필 글리프(번역판), 분필 받침과 지우개. 벽걸이(z=0 벽면) 또는 o.stand
  P.chalkboard = (b, x, y, z, rot, o) => {
    o = o || {};
    const k = new K(b, x, y, z, rot), w = opt(o, 'w', 1.8), h = opt(o, 'h', 1.0), stand = !!o.stand, cy = stand ? 1.25 : opt(o, 'cy', 1.4);
    const f = stand ? k.child(L(0, 0, 0.05, -0.08, 0, 0)) : k;
    f.box('oak', 0, cy, 0.012, w + 0.04, h + 0.04, 0.024, { c: 0.004, t: 0.5 });
    f.add('pChalk', quad(w, h, [0, 0, 1, 1]), L(0, cy, 0.026));
    for (const s of [-1, 1]) { f.box('oak', 0, cy + s * (h / 2 + 0.03), 0.035, w + 0.12, 0.06, 0.04, { c: 0.01 }); f.box('oak', s * (w / 2 + 0.03), cy, 0.035, 0.06, h + 0.12, 0.04, { c: 0.01 }); }
    f.box('oak', 0, cy - h / 2 - 0.05, 0.07, w * 0.9, 0.025, 0.08, { c: 0.006 });
    for (let i = 0; i < 4; i++) f.cyl('pCeramic', 0.006, 0.06 - i * 0.008, -w * 0.3 + i * 0.1, cy - h / 2 - 0.03, 0.08, { rz: -PI / 2, ry: i * 0.4, seg: 6, t: 0xF4F0E4 });
    f.box('oak', w * 0.25, cy - h / 2 - 0.02, 0.075, 0.12, 0.04, 0.05, { c: 0.006, t: [1.3, 1.1, 0.9] }); f.box('pLinen', w * 0.25, cy - h / 2 - 0.042, 0.075, 0.12, 0.012, 0.05, { c: 0.003, t: 0x6a6a68 });
    if (stand) {
      for (const s of [-1, 1]) { k.box('oak', s * (w / 2 - 0.1), cy / 2 + 0.2, 0.0, 0.05, cy + 0.6, 0.05, { c: 0.008, rx: -0.08, ax: 1 }); k.box('oak', s * (w / 2 - 0.1), (cy + 0.2) / 2, -0.25, 0.04, cy + 0.2, 0.04, { c: 0.006, rx: 0.2, ax: 1 }); }
      k.col(0, 0, w / 2, 0.3, cy + h / 2);
    }
  };
  // 지도 이젤: 세 다리 이젤 위 양피지 지도, 말린 귀퉁이, 지시봉
  P.mapEasel = (b, x, y, z, rot, o) => {
    o = o || {};
    const k = new K(b, x, y, z, rot), w = opt(o, 'w', 0.9), h = opt(o, 'h', 0.9), tl = 0.2;
    for (const s of [-1, 1]) k.box('oak', s * 0.3, 0.88, 0.02, 0.04, 1.8, 0.035, { c: 0.006, rx: -tl, rz: s * 0.08, ax: 1 });
    k.box('oak', 0, 0.75, -0.35, 0.035, 1.55, 0.035, { c: 0.006, rx: 0.32, ax: 1 });
    const f = k.child(L(0, 0, 0, -tl, 0, 0));
    f.box('oak', 0, 0.62, 0.06, 0.8, 0.04, 0.08, { c: 0.008 });
    f.box('oak', 0, 0.64 + h / 2, 0.045, w + 0.04, h + 0.02, 0.012, { c: 0.003, t: 0.7 });
    f.add('pMap', sheet(6, 6, (u, v) => [(u - 0.5) * w, 0.64 + v * h, 0.054 + (u > 0.85 && v > 0.85 ? (u - 0.85) * (v - 0.85) * 3 : 0) + (u < 0.1 && v < 0.12 ? (0.1 - u) * (0.12 - v) * 4 : 0)], { uvRect: [0, 0, 0.5, 1] }));
    for (const [px, py] of [[-w / 2 + 0.03, h - 0.03], [w / 2 - 0.03, 0.03]]) f.sph('brass', 0.008, px, 0.64 + py, 0.058, { n: 3, seg: 6 });
    k.cyl('oak', 0.006, 1.1, 0.48, 0, 0.12, { rz: 0.2, seg: 6 });
    k.col(0, 0, 0.45, 0.35, 1.7);
  };
  // 시계: 키다리 시계(진자·바늘이 움직임) 또는 o.small 벽난로 시계. 12눈금 룬 문자판
  P.clock = (b, x, y, z, rot, o) => {
    o = o || {};
    const k = new K(b, x, y, z, rot), small = !!o.small, s = small ? 0.5 : 1;
    let dy, dz, dr;
    if (small) {
      const sh = archShape(0.26, 0.2, 0.12);
      k.add('oak', ext(sh, 0.12, { bevel: 0.006 }), L(0, 0.02, 0), [0.8, 0.7, 0.6]);
      k.box('oak', 0, 0.012, 0, 0.32, 0.024, 0.15, { c: 0.006 });
      for (const sx of [-1, 1]) k.sph('brass', 0.012, sx * 0.13, 0.33, 0, { n: 3, seg: 6 });
      k.sph('brass', 0.016, 0, 0.36, 0, { n: 4, seg: 8 });
      dy = 0.17; dz = 0.062; dr = 0.085;
    } else {
      k.box('oak', 0, 0.15, 0, 0.52, 0.3, 0.32, { c: 0.012 });
      k.box('oak', 0, 0.85, 0, 0.42, 1.1, 0.26, { c: 0.01 });
      k.box('pGlass', 0, 0.9, 0.132, 0.2, 0.7, 0.004, { c: 0, t: 0xE0E8EC });
      k.box('oak', 0, 0.9, 0.126, 0.26, 0.76, 0.01, { c: 0.002, t: 0.35 });
      k.box('oak', 0, 1.42, 0.01, 0.5, 0.06, 0.32, { c: 0.01 });
      k.box('oak', 0, 1.7, 0, 0.48, 0.5, 0.3, { c: 0.012 });
      k.add('oak', ext(archShape(0.48, 0.0, 0.18), 0.3, { bevel: 0.006 }), L(0, 1.95, 0));
      for (const sx of [-1, 0, 1]) k.lathe('brass', [[0, 0], [0.025, 0], [0.03, 0.03], [0.012, 0.07], [0, 0.09]], sx * 0.2, sx ? 1.97 : 2.13, 0, { seg: 8 });
      dy = 1.7; dz = 0.152; dr = 0.2;
    }
    k.lathe('brass', [[0, 0], [dr + 0.012 * s, 0], [dr + 0.012 * s, 0.006], [0, 0.006]], 0, dy, dz - 0.006, { rx: PI / 2, seg: 24 });
    k.add('pClock', disc(dr, 32), L(0, dy, dz + 0.001));
    // 바늘·진자 (extra)
    const sb = new Batch(), kk = new K(sb, 0, 0, 0, 0);
    kk.box('iron', 0, dr * 0.3, 0.012, 0.008 * s + 0.004, dr * 0.6, 0.003, { c: 0 });
    const hh = new Batch(), hk = new K(hh, 0, 0, 0, 0); hk.box('iron', 0, dr * 0.22, 0.015, 0.012 * s + 0.004, dr * 0.44, 0.003, { c: 0 });
    const gm = sb.build(), gh = hh.build(), base = k.w(0, dy, dz), pv = new T.Group();
    pv.position.set(base[0], base[1], base[2]); pv.rotation.y = rot; pv.add(gm, gh); b.extra.push(pv);
    let pend = null;
    if (!small) {
      const pb = new Batch(), pk = new K(pb, 0, 0, 0, 0);
      pk.box('brass', 0, -0.32, 0, 0.012, 0.64, 0.006, { c: 0 }); pk.cyl('brass', 0.07, 0.012, 0, -0.66, -0.006, { rx: PI / 2, seg: 18 });
      pend = pb.build(); const pp = new T.Group(), q = k.w(0, 1.38, 0.08); pp.position.set(q[0], q[1], q[2]); pp.rotation.y = rot; pp.add(pend); b.extra.push(pp);
    }
    b.anims.push(t => { const now = new Date(), m = now.getMinutes() + now.getSeconds() / 60, h2 = (now.getHours() % 12) + m / 60; gm.rotation.z = -m / 60 * TAU; gh.rotation.z = -h2 / 12 * TAU; if (pend) pend.rotation.z = Math.sin(t * PI) * 0.09; });
    if (!small) k.col(0, 0, 0.26, 0.16, 2.1);
  };

  // =====================================================================
  // 10. 병, 솥, 식물, 창고
  // =====================================================================
  // 물약 선반: 다섯 꼴 유리병(색유리·액체·코르크·딱지), 단지, 표본병, 누운 책
  P.potionShelf = (b, x, y, z, rot, o) => {
    o = o || {};
    const R = RNG(x, y, z, o), k = new K(b, x, y, z, rot), wt = woodT(R), W = opt(o, 'w', 1.0), H = opt(o, 'h', 1.75), D = 0.32, ns = opt(o, 'shelves', 4), st = 0.03;
    for (const s of [-1, 1]) k.box('oak', s * (W / 2 - st / 2), H / 2, 0, st, H, D, { c: 0.008, t: wt });
    k.box('oakPanel', 0, H / 2, -D / 2 + 0.008, W - 0.02, H, 0.016, { c: 0, t: mul(wt, 0.45) });
    k.box('oak', 0, H + 0.02, 0.01, W + 0.06, 0.04, D + 0.04, { c: 0.012, t: wt }); k.box('oak', 0, 0.05, 0.005, W + 0.02, 0.1, D + 0.01, { c: 0.01, t: mul(wt, 0.75) });
    const sp = (H - 0.12) / ns;
    for (let j = 0; j < ns; j++) {
      const sy = 0.1 + j * sp;
      if (j) { k.box('oak', 0, sy, 0, W - 0.04, 0.022, D - 0.01, { c: 0.005, t: wt }); k.box('oak', 0, sy + 0.025, D / 2 - 0.008, W - 0.04, 0.03, 0.012, { c: 0.003, t: wt }); }
      let xx = -W / 2 + st + 0.04;
      while (xx < W / 2 - st - 0.06) {
        const r = R(), zz = R.r(-0.07, 0.06), p = k.w(xx, sy + 0.011, zz);
        if (j === 0 && r < 0.5) { const rr = R.r(0.07, 0.11); k.lathe('pClay', [[0, 0], [rr * 0.8, 0], [rr, rr * 0.9], [rr * 0.9, rr * 1.8], [rr * 0.55, rr * 2.1], [rr * 0.6, rr * 2.25], [rr * 0.5, rr * 2.25], [0, rr * 2.1]], xx + rr, sy + 0.011, zz, { seg: 14, t: R.p([0x9A6A40, 0x7a6a5a, 0xA88A5A, 0x6a5040]) }); xx += rr * 2 + 0.03; continue; }
        if (r < 0.08) { xx += R.r(0.04, 0.1); continue; }
        if (r < 0.16 && sp > 0.3) { const rr = 0.07; k.lathe('pGlass', [[0, 0], [rr, 0], [rr, 0.2], [rr * 0.8, 0.22], [0, 0.22]], xx + rr, sy + 0.011, zz, { seg: 14, t: 0xD8E8E0 }); k.lathe('pLiquid', [[0, 0.004], [rr * 0.92, 0.004], [rr * 0.92, 0.16], [0, 0.16]], xx + rr, sy + 0.011, zz, { seg: 12, t: R.p([0x5a8a3a, 0x8a6a3a, 0x3a6a7a]) }); k.lathe('pFood', [[0, 0], [0.03, 0.02], [0.04, 0.06], [0.02, 0.09], [0, 0.1]], xx + rr, sy + 0.05, zz, { seg: 8, t: 0xC8B8A0, rz: 0.4 }); k.cyl('oak', rr * 0.85, 0.02, xx + rr, sy + 0.22, zz, { seg: 12, t: [1.4, 1.2, 1] }); xx += rr * 2 + 0.03; continue; }
        if (r < 0.24) { k.box('oak', xx + 0.06, sy + 0.05, zz, 0.12, 0.08, 0.09, { c: 0.008, t: [1.2, 0.95, 0.75] }); k.box('brass', xx + 0.06, sy + 0.07, zz + 0.046, 0.02, 0.025, 0.004, { c: 0 }); xx += 0.15; continue; }
        if (r < 0.3) { k.sub(P.book, xx + 0.12, sy + 0.011, zz, R.r(-0.3, 0.3), {}); xx += 0.26; continue; }
        const top = P.bottle(b, ...p, rot + R() * TAU, { s: R.r(0.8, 1.35) });
        xx += 0.07 + R.r(0, 0.04) + (top > 0.18 ? 0.02 : 0);
      }
    }
    k.col(0, 0, W / 2, D / 2, H);
  };
  // 솥: 무쇠 몸통, 다리 셋, 손잡이, 청록 물약과 거품, 은은한 빛. o.fire 아래 불
  P.cauldron = (b, x, y, z, rot, o) => {
    o = o || {};
    const R = RNG(x, y, z, o), k = new K(b, x, y, z, rot), r = opt(o, 'r', 0.32), h = r * 1.15, ly = 0.12;
    for (let i = 0; i < 3; i++) { const a = i / 3 * TAU; k.tube('iron', [[Math.sin(a) * r * 0.6, ly + 0.04, Math.cos(a) * r * 0.6], [Math.sin(a) * r * 0.72, ly * 0.5, Math.cos(a) * r * 0.72], [Math.sin(a) * r * 0.78, 0, Math.cos(a) * r * 0.78]], 0.02, { rs: 5, cap: true }); }
    k.lathe('iron', [[0, ly], [r * 0.5, ly], [r * 0.88, ly + h * 0.12], [r, ly + h * 0.45], [r * 0.93, ly + h * 0.82], [r * 0.86, ly + h * 0.9], [r * 0.92, ly + h * 0.96], [r * 0.92, ly + h], [r * 0.85, ly + h], [r * 0.82, ly + h * 0.9], [r * 0.9, ly + h * 0.5], [0, ly + h * 0.2]], 0, 0, 0, { seg: 20 });
    const lq = ly + h * 0.8, col = o.col || [0.16, 0.6, 0.48];
    k.lathe('pLiquid', [[r * 0.86, lq], [0, lq + 0.002]], 0, 0, 0, { seg: 18, t: col });
    for (let i = 0; i < 6; i++) { const a = R() * TAU, rr = R() * r * 0.7; k.sph('pLiquid', R.r(0.01, 0.025), Math.sin(a) * rr, lq, Math.cos(a) * rr, { n: 4, seg: 8, t: mul(col, 1.3) }); }
    { const p = k.w(0, lq + 0.12, 0); sprite(b, p[0], p[1], p[2], FK.glow, r * 1.6, 0.2, mul(col, 0.8)); }
    k.ring('iron', r * 1.0, 0.011, 0, ly + h, 0, { rx: PI / 2, a0: PI / 2, arc: PI, ts: 16, rs: 5 });
    for (const s of [-1, 1]) k.ring('iron', 0.03, 0.008, s * r * 0.95, ly + h * 0.95, 0, { rx: PI / 2, ry: PI / 2, ts: 10, rs: 4 });
    k.box('oak', r * 0.4, ly + h + 0.15, 0.05, 0.035, 0.9, 0.05, { c: 0.008, rz: -0.5, rx: 0.15, ax: 1, t: [1.2, 1.05, 0.9] });
    if (o.fire) {
      for (let i = 0; i < 8; i++) k.sph('pCoal', R.r(0.03, 0.05), R.r(-r * 0.6, r * 0.6), 0.03, R.r(-r * 0.6, r * 0.6), { n: 3, seg: 5 });
      for (let i = 0; i < 4; i++) { const p = k.w(R.r(-r * 0.4, r * 0.4), 0.03, R.r(-r * 0.4, r * 0.4)); sprite(b, p[0], p[1], p[2], FK.fire, R.r(0.15, 0.25), R(), [1, 1, 1]); }
      k.light(0, 0.3, 0, 0xFF7A30, 1.2, 6, { fire: true, type: 'fire' });
    }
    if (o.light !== false) k.light(0, lq + 0.3, 0, 0x59E1C0, 0.4, 4, { flicker: false });
    k.col(0, 0, r, r, ly + h);
    return { top: y + ly + h };
  };
  // 말린 허브 다발 (y = 걸린 점). o.n개면 줄에 나란히
  P.herbBundle = (b, x, y, z, rot, o) => {
    o = o || {};
    const R = RNG(x, y, z, o), k = new K(b, x, y, z, rot), n = opt(o, 'n', 1), gap = 0.26;
    if (n > 1) k.cyl('rope', 0.006, n * gap + 0.2, -(n * gap + 0.2) / 2, 0, 0, { rz: -PI / 2, seg: 5, t: 0xB09060 });
    for (let i = 0; i < n; i++) {
      const bx = (i - (n - 1) / 2) * gap, sl = R.r(0.06, 0.14), tie = -sl, tint = R.p([[0.95, 0.95, 0.8], [0.8, 0.85, 0.6], [1.0, 0.85, 0.65], [0.7, 0.8, 0.7]]);
      k.cyl('rope', 0.003, sl, bx, tie, 0, { seg: 4, t: 0xB09060 });
      k.ring('rope', 0.018, 0.005, bx, tie - 0.015, 0, { ts: 8, rs: 4, t: 0xB09060 });
      const ns = 8 + R.i(6);
      for (let j = 0; j < ns; j++) {
        const a = R() * TAU, sp = R.r(0.02, 0.09), len = R.r(0.22, 0.34), tx = bx + Math.sin(a) * sp, tz = Math.cos(a) * sp;
        k.tube('timber', [[bx, tie, 0], [tx, tie - len, tz]], 0.0025, { rs: 3, t: [1.4, 1.2, 0.8] });
        k.add('pPlant', quad(0.07, len * 0.85, [0.56, 0.02, 0.94, 0.98]), L((bx + tx) / 2, tie - len * 0.55, tz / 2, PI + Math.atan2(sp, len) * 0, a, Math.atan2(tx - bx, len)), tint);
      }
    }
  };
  // 화분: 테라코타 화분, 흙, 휘어 처지는 잎들. o.kind 'broad'|'fern', o.s 크기
  P.pottedPlant = (b, x, y, z, rot, o) => {
    o = o || {};
    const R = RNG(x, y, z, o), k = new K(b, x, y, z, rot), s = opt(o, 's', 1), fern = o.kind === 'fern';
    k.lathe('pClay', [[0, 0], [0.1, 0], [0.1, 0.01], [0.14, 0.2], [0.16, 0.21], [0.16, 0.245], [0.13, 0.245], [0.125, 0.22], [0, 0.2]].map(p => [p[0] * s, p[1] * s]), 0, 0, 0, { seg: 16, t: o.pot || 0xB0603A });
    k.lathe('pFood', [[0.125 * s, 0.21 * s], [0, 0.215 * s]], 0, 0, 0, { seg: 12, t: 0x3a2a1e });
    const n = fern ? 16 + R.i(6) : 9 + R.i(6);
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU + R.r(-0.3, 0.3), len = (fern ? R.r(0.35, 0.55) : R.r(0.25, 0.42)) * s, el = R.r(0.5, 1.2), dr = R.r(0.6, 1.4), w = (fern ? 0.07 : R.r(0.1, 0.15)) * s, dx = Math.sin(a), dz = Math.cos(a);
      const g = sheet(2, 5, (u, v) => { const d = len * v * Math.cos(el * (1 - v * 0.5)), yy = 0.21 * s + len * (Math.sin(el) * v - dr * v * v * 0.6), ac = (u - 0.5) * w * Math.sin(PI * Math.min(1, v * 1.4 + 0.1)), cup = Math.abs(u - 0.5) * 0.25 * w; return [dx * d - dz * ac, yy + cup, dz * d + dx * ac]; }, { uvRect: fern ? [0.56, 0.02, 0.94, 0.98] : [0.02, 0.02, 0.48, 0.98] });
      k.add('pPlant', g, null, fern ? [0.75, 0.95, 0.65] : jit(R, [0.85, 1, 0.8], 0.15));
    }
    k.col(0, 0, 0.16 * s, 0.16 * s, 0.5 * s);
  };
  // 나무 상자 (판자, 모서리 덧댄 띠, 못). o.lid false면 열려서 짚과 물건
  P.crate = (b, x, y, z, rot, o) => {
    o = o || {};
    const R = RNG(x, y, z, o), k = new K(b, x, y, z, rot), s = opt(o, 's', 0.6), w = s, h = s * 0.72, d = s * 0.72, tt = jit(R, [1.35, 1.18, 0.95], 0.1), nr = 3, ph = h / nr;
    k.box('timber', 0, 0.012, 0, w, 0.024, d, { c: 0.003, t: tt });
    for (let i = 0; i < nr; i++) {
      const yy = ph * (i + 0.5), tk = mul(tt, R.r(0.85, 1.1));
      for (const sz of [-1, 1]) k.box('timber', 0, yy, sz * (d / 2 - 0.01), w, ph - 0.01, 0.02, { c: 0.004, t: tk, uo: R() * 3 });
      for (const sx of [-1, 1]) k.box('timber', sx * (w / 2 - 0.01), yy, 0, 0.02, ph - 0.01, d - 0.04, { c: 0.004, t: tk, uo: R() * 3 });
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { k.box('timber', sx * (w / 2 - 0.04), h / 2, sz * (d / 2 + 0.008), 0.06, h + 0.01, 0.018, { c: 0.004, t: mul(tt, 0.8) }); k.box('timber', sx * (w / 2 + 0.008), h / 2, sz * (d / 2 - 0.04), 0.018, h + 0.01, 0.06, { c: 0.004, t: mul(tt, 0.8) }); }
    if (o.lid !== false) for (let i = 0; i < 3; i++) k.box('timber', 0, h + 0.01, -d / 3 + i * d / 3, w + 0.01, 0.02, d / 3 - 0.008, { c: 0.004, t: mul(tt, R.r(0.85, 1.1)), ry: R.r(-0.01, 0.01) });
    else {
      k.box('pFood', 0, h - 0.04, 0, w - 0.05, 0.05, d - 0.05, { c: 0.02, t: 0xC8A860 });
      for (let i = 0; i < 6; i++) k.box('pFood', R.r(-w / 3, w / 3), h - 0.01, R.r(-d / 3, d / 3), 0.12, 0.012, 0.012, { c: 0, ry: R() * PI, rz: R.r(-0.4, 0.4), t: 0xD8B870 });
      const fill = o.fill || R.p(['bottles', 'fruit', 'books']);
      if (fill === 'bottles') for (let i = 0; i < 4; i++) P.bottle(b, ...k.w(R.r(-w / 4, w / 4), h - 0.12, R.r(-d / 4, d / 4)), R() * TAU, { shape: R.p([0, 1, 3]) });
      else if (fill === 'fruit') for (let i = 0; i < 12; i++) k.sph('pFood', 0.04, R.r(-w / 3, w / 3), h - 0.02 + R() * 0.03, R.r(-d / 3, d / 3), { n: 5, seg: 8, t: R.p([0x9E2A1E, 0x8AA040, 0xC8862A]) });
      else k.sub(P.bookStack, 0, h - 0.06, 0, R(), { n: 3 });
    }
    k.col(0, 0, w / 2, d / 2, h + 0.02);
    return { top: y + h + 0.02 };
  };
  // 통: 배부른 널 16장(널마다 색), 쇠테 넷, 오목한 뚜껑. o.lying 눕힘
  P.barrel = (b, x, y, z, rot, o) => {
    o = o || {};
    const R = RNG(x, y, z, o), h = opt(o, 'h', 0.9), r = opt(o, 'r', 0.3), re = r * 0.86, k0 = new K(b, x, y, z, rot), k = o.lying ? k0.child(L(-h / 2, r, 0, 0, 0, -PI / 2)) : k0, tt = jit(R, [1.05, 0.95, 0.8], 0.08);
    const rad = t => re + (r - re) * Math.sin(PI * t);
    const ns = 16, prof = [0, 0.15, 0.3, 0.5, 0.7, 0.85, 1].map(t => [rad(t), t * h]);
    for (let i = 0; i < ns; i++) k.lathe('timber', prof, 0, 0, 0, { a0: i / ns * TAU + 0.006, a1: (i + 1) / ns * TAU - 0.006, seg: 2, t: mul(tt, R.r(0.8, 1.12)) });
    k.lathe('timber', [[0, 0], [re * 0.97, 0], [0, 0.001]], 0, 0.02, 0, { seg: 16, t: mul(tt, 0.7) });
    k.lathe('timber', [[re, h], [re - 0.016, h], [re - 0.016, h - 0.03], [re - 0.016, h - 0.03], [0, h - 0.03]], 0, 0, 0, { seg: 16, t: mul(tt, 0.8) });
    for (const t of [0.07, 0.24, 0.76, 0.93]) { const rr = rad(t) + 0.003, yy = t * h; k.lathe('iron', [[rr, yy - 0.022], [rr + 0.004, yy - 0.02], [rr + 0.004, yy + 0.02], [rr, yy + 0.022]], 0, 0, 0, { seg: 20 }); }
    if (o.lying) { k0.cyl('oak', 0.015, 0.06, h / 2, r * 0.6, 0, { rz: -PI / 2, seg: 6 }); k0.col(0, 0, h / 2, r, 2 * r); }
    else k0.col(0, 0, r, r, h, 0, { r });
    return { top: y + (o.lying ? 2 * r : h) };
  };
  // 자루 (삼베, 울퉁불퉁, 묶은 목)
  P.sack = (b, x, y, z, rot, o) => {
    o = o || {};
    const R = RNG(x, y, z, o), k = new K(b, x, y, z, rot), h = opt(o, 'h', R.r(0.5, 0.7)), r = h * 0.4, ph = R() * 9;
    k.lathe('pLinen', [[0, 0], [r * 0.8, 0], [r, h * 0.12], [r * 1.02, h * 0.4], [r * 0.85, h * 0.68], [r * 0.4, h * 0.82], [r * 0.18, h * 0.86], [r * 0.25, h * 0.94], [r * 0.12, h], [0, h * 0.97]], 0, 0, 0, { seg: 14, rz: R.r(-0.12, 0.12), t: o.col || R.p([0x9A8058, 0xA89068, 0x8a7450]), wob: (i, a) => (pnoise(a * 1.6 + ph, i * 0.7, 99, 99, 3) - 0.5) * 0.35 });
    k.ring('rope', r * 0.2, 0.008, 0, h * 0.85, 0, { ts: 10, rs: 4, t: 0xB09060 });
    if (o.spill) for (let i = 0; i < 18; i++) k.sph('pFood', 0.01, R.r(0.15, 0.4), 0.008, R.r(-0.15, 0.15), { n: 3, seg: 5, t: 0xC8A860 });
    k.col(0, 0, r, r, h, 0, { r });
  };
  // 바구니 (엮은 결): o.fill 'bread'|'fruit'|'herbs'|'cloth'|'none', o.handle
  P.basket = (b, x, y, z, rot, o) => {
    o = o || {};
    const R = RNG(x, y, z, o), k = new K(b, x, y, z, rot), r = opt(o, 'r', 0.2), h = opt(o, 'h', r * 0.75);
    k.lathe('timber', [[0, 0], [r * 0.8, 0], [r * 0.82, 0.01], [r, h], [r * 0.94, h], [r * 0.76, 0.02], [0, 0.02]], 0, 0, 0, { seg: 20, t: [1.7, 1.35, 0.85], cf: (i, j) => ((i + j) % 2 ? 0.78 : 1.1) });
    k.ring('timber', r, 0.012, 0, h, 0, { ts: 20, rs: 4, t: [1.5, 1.2, 0.8] });
    if (o.handle) k.ring('timber', r * 0.95, 0.012, 0, h, 0, { rx: PI / 2, a0: PI / 2, arc: PI, ts: 12, rs: 4, t: [1.5, 1.2, 0.8] });
    const f = o.fill || 'fruit';
    if (f === 'fruit') for (let i = 0; i < 9; i++) { const a = R() * TAU, rr = R() * r * 0.6; k.sph('pFood', R.r(0.035, 0.045), Math.sin(a) * rr, h - 0.02 + R() * 0.03, Math.cos(a) * rr, { n: 5, seg: 8, t: R.p([0x9E2A1E, 0x8E3A22, 0x8AA040, 0xC8862A, 0xB8A030]) }); }
    else if (f === 'bread') for (let i = 0; i < 3; i++) k.rb('pFood', R.r(-0.05, 0.05), h + 0.01, R.r(-0.08, 0.08), 0.2, 0.07, 0.09, 0.035, { puff: 0.01, ry: R() * PI, rz: R.r(-0.3, 0.3), t: 0xB0763A });
    else if (f === 'herbs') for (let i = 0; i < 8; i++) { const a = R() * TAU; k.add('pPlant', quad(0.08, 0.25, [0.56, 0.02, 0.94, 0.98]), L(Math.sin(a) * 0.06, h + 0.08, Math.cos(a) * 0.06, R.r(-0.3, 0.3), a, R.r(-0.4, 0.4)), [0.8, 0.95, 0.7]); }
    else if (f === 'cloth') k.rb('pVelvet', 0, h, 0, r * 1.5, 0.06, r * 1.4, 0.03, { puff: 0.03, t: R.p([C.oxblood, C.indigo, 0xA8843E, 0x3E4A2A]) });
  };

  // =====================================================================
  // 11. 천과 벽 장식, 조각
  // =====================================================================
  // 깃발: 남색 벨벳에 황동 12눈금 룬 고리, 제비꼬리 끝, 셰이더로 흔들림. y = 막대 높이, 지역 z=0 벽면 (o.free면 벽 없이)
  P.banner = (b, x, y, z, rot, o) => {
    o = o || {};
    const k = new K(b, x, y, z, rot), w = opt(o, 'w', 0.9), h = opt(o, 'h', 2.6), zz = o.free ? 0 : 0.09, rl = w + 0.2;
    k.cyl('brass', 0.014, rl, -rl / 2, 0, zz, { rz: -PI / 2, seg: 8 });
    for (const s of [-1, 1]) { k.sph('gold', 0.03, s * rl / 2, 0, zz, { n: 5, seg: 8 }); k.lathe('gold', [[0, 0], [0.02, 0.01], [0, 0.06]], s * (rl / 2 + 0.02), 0, zz, { rz: -s * PI / 2, seg: 6 }); }
    if (!o.free) for (const s of [-1, 1]) k.tube('iron', [[s * w * 0.4, 0.06, 0.005], [s * w * 0.4, 0.02, zz * 0.6], [s * w * 0.4, 0, zz]], 0.008, { rs: 4 });
    else k.tube('rope', [[-rl / 2 + 0.03, 0, 0], [0, 0.3, 0], [rl / 2 - 0.03, 0, 0]], 0.006, { rs: 4, t: 0xC9A45C });
    k.add('pBanner', sheet(6, 14, (u, v) => [(u - 0.5) * w, -0.025 - (1 - v) * h, zz + Math.sin(u * 3 * PI + 0.4) * 0.025 * (0.4 + (1 - v) * 0.6) + (1 - v) * 0.015], { uvRect: [0, 0, 1, 1] }), null, o.col || null);
    for (let i = 0; i < 7; i++) k.ring('gold', 0.018, 0.005, (i / 6 - 0.5) * (w - 0.08), -0.01, zz, { rz: PI / 2, ry: PI / 2, ts: 8, rs: 3 });
  };
  // 벽걸이 융단: 막대 + 접힘 + 술. y = 막대 높이
  P.tapestry = (b, x, y, z, rot, o) => {
    o = o || {};
    const k = new K(b, x, y, z, rot), w = opt(o, 'w', 2.4), h = opt(o, 'h', w * 0.75), zz = 0.06;
    k.cyl('oak', 0.025, w + 0.24, -(w + 0.24) / 2, 0, zz, { rz: -PI / 2, seg: 8 });
    for (const s of [-1, 1]) { k.lathe('brass', [[0, 0], [0.035, 0.02], [0.03, 0.05], [0, 0.07]], s * (w / 2 + 0.12), 0, zz, { rz: -s * PI / 2, seg: 8 }); k.tube('iron', [[s * w * 0.42, 0.05, 0.003], [s * w * 0.42, 0, zz]], 0.01, { rs: 4 }); }
    k.add('pTapestry', sheet(14, 6, (u, v) => [(u - 0.5) * w, -0.03 - (1 - v) * h, zz + Math.sin(u * 5 * PI) * 0.018 * (0.3 + (1 - v)) + 0.008], { uvRect: [0, 0, 1, 1] }));
  };
  // 깔개: 두 무늬 (o.design 0 적갈 룬 고리 메달리온, 1 남색 마름모), 양끝 술, o.layer 겹친 작은 깔개
  P.rug = (b, x, y, z, rot, o) => {
    o = o || {};
    const R = RNG(x, y, z, o), k = new K(b, x, y, z, rot), w = opt(o, 'w', 2), l = opt(o, 'l', 3), d = opt(o, 'design', R.i(2)), th = 0.01;
    const u0 = d * 0.5 + 8 / 1024, u1 = d * 0.5 + 504 / 1024, v0 = 32 / 1024, v1 = 1 - 32 / 1024, ed = [u0, 0.1, u0 + 0.004, 0.9];
    k.box('pRug', 0, th / 2 + (o.dy || 0), 0, w, th, l, { c: 0.003, fuv: { py: [u0, v0, u1, v1], px: ed, nx: ed, pz: ed, nz: ed, ny: null }, t: o.t });
    k.add('pRug', quad(w - 0.02, 0.08, [u0, v1, u1, 1]), L(0, th * 0.3 + (o.dy || 0), -l / 2 - 0.04, -PI / 2, 0, 0), o.t);
    k.add('pRug', quad(w - 0.02, 0.08, [u0, 0, u1, v0]), L(0, th * 0.3 + (o.dy || 0), l / 2 + 0.04, -PI / 2, 0, 0), o.t);
    if (o.layer) k.sub(P.rug, R.r(-w * 0.2, w * 0.2), (o.dy || 0) + 0.011, R.r(-l * 0.15, l * 0.15), R.p([-1, 1]) * R.r(0.12, 0.35), { w: w * 0.6, l: l * 0.55, design: 1 - d, seed: R.i(1e6) });
  };
  // 금박 틀 (그림·기억 유리 공용): 지역 z=0 벽면, y = 아래 끝
  function giltFrame(k, w, h, cy, fw) {
    for (const [px, py, ww, hh] of [[0, cy + h / 2 + fw / 2, w + fw * 2, fw], [0, cy - h / 2 - fw / 2, w + fw * 2, fw], [-w / 2 - fw / 2, cy, fw, h], [w / 2 + fw / 2, cy, fw, h]]) {
      k.box('gold', px, py, 0.025, ww, hh, 0.05, { c: 0.012, t: [0.8, 0.72, 0.6] });
      k.box('gold', px, py, 0.052, ww * (ww > hh ? 0.98 : 0.4), hh * (hh > ww ? 0.98 : 0.4), 0.012, { c: 0.004 });
    }
  }
  P.painting = (b, x, y, z, rot, o) => {
    o = o || {};
    const k = new K(b, x, y, z, rot), w = opt(o, 'w', 1.0), h = opt(o, 'h', 0.75), fw = 0.07, cy = h / 2 + fw;
    giltFrame(k, w, h, cy, fw);
    k.box('oak', 0, cy, 0.01, w, h, 0.02, { c: 0, t: 0.3 });
    k.add('pPaint', quad(w, h, [0, 0, 1, 1]), L(0, cy, 0.022));
  };
  // 기억 유리: 뾰족 아치 스테인드글라스(학자상이 천천히 반짝임), 금박 아치 틀, 놋쇠 이름판. 지역 z=0 벽면, y = 아래 끝
  P.memoryGlass = (b, x, y, z, rot, o) => {
    o = o || {};
    const k = new K(b, x, y, z, rot), w = opt(o, 'w', 0.8), h = opt(o, 'h', 1.4), ah = w * 0.55, sh = h - ah, y0 = 0.08;
    k.add('oak', ext(archShape(w + 0.16, sh, ah + 0.1), 0.05), L(0, y0 - 0.06, 0.025), 0.4);
    k.add('pMemory', ext(archShape(w, sh, ah), 0.01, { uvRect: [0, 0, 1, 1] }), L(0, y0, 0.055));
    const pts = archShape(w + 0.04, sh + 0.02, ah + 0.03).getPoints(10).map(p => [p.x, y0 - 0.02 + p.y, 0.06]);
    k.tube('gold', pts, 0.022, { rs: 5, closed: true });
    k.box('stoneTrim', 0, y0 - 0.07, 0.07, w + 0.24, 0.06, 0.14, { c: 0.01 });
    k.box('brass', 0, y0 - 0.15, 0.03, 0.22, 0.07, 0.008, { c: 0.002 });
    { const p = k.w(0, y0 + h * 0.5, 0.3); sprite(b, p[0], p[1], p[2], FK.glow, w * 0.9, 0.6, [0.18, 0.22, 0.4]); }
  };
  // 학자 석상: 층진 받침, 주름진 겉옷, 두건, 수염, 펼친 책을 든 두 팔
  P.statue = (b, x, y, z, rot, o) => {
    o = o || {};
    const k = new K(b, x, y, z, rot), s = opt(o, 's', 1), mt = o.mat || 'stoneOld', pl = o.plinth !== false ? 0.86 : 0;
    if (pl) {
      k.box('stoneTrim', 0, 0.08, 0, 0.82, 0.16, 0.82, { c: 0.02, t: 0.85 });
      k.box('stoneTrim', 0, 0.47, 0, 0.62, 0.62, 0.62, { c: 0.015 });
      k.box('stoneTrim', 0, 0.82, 0, 0.74, 0.08, 0.74, { c: 0.02 });
      k.box('brass', 0, 0.5, 0.312, 0.32, 0.12, 0.006, { c: 0.002 });
    }
    const f = k.child(L(0, pl, 0, 0, 0, 0, s)), flat = a => 1 - 0.2 * Math.cos(a) * Math.cos(a);
    f.lathe(mt, [[0, 0], [0.3, 0], [0.31, 0.03], [0.27, 0.3], [0.22, 0.68], [0.18, 0.95], [0.2, 1.15], [0.22, 1.3], [0.19, 1.4], [0.09, 1.45], [0.055, 1.49], [0, 1.5]], 0, 0, 0, { seg: 30, wob: (i, a) => flat(a) - 1 + (i < 7 ? Math.sin(a * 9 + i * 0.4) * 0.07 * (1 - i / 7) : 0) });
    f.lathe(mt, [[0.235, 1.05], [0.25, 1.3], [0.2, 1.47], [0.13, 1.58], [0.115, 1.7], [0.08, 1.78], [0.03, 1.8]], 0, 0, -0.01, { seg: 12, a0: PI * 0.62, a1: PI * 1.38 });
    f.lathe(mt, [[0, 0], [0.06, 0.01], [0.092, 0.08], [0.098, 0.14], [0.083, 0.2], [0.048, 0.235], [0, 0.245]], 0, 1.47, 0.01, { seg: 14 });
    f.box(mt, 0, 1.6, 0.098, 0.03, 0.05, 0.03, { c: 0.008, rx: 0.3 });
    f.lathe(mt, [[0, 1.27], [0.03, 1.32], [0.07, 1.42], [0.075, 1.5], [0.06, 1.55], [0, 1.56]], 0, 0, 0.055, { seg: 10, a0: -PI * 0.55, a1: PI * 0.55 });
    for (const sd of [-1, 1]) {
      f.tube(mt, [[sd * 0.19, 1.32, 0], [sd * 0.24, 1.15, 0.02], [sd * 0.22, 1.02, 0.1], [sd * 0.12, 0.98, 0.21]], t => 0.055 + t * 0.03, { rs: 8 });
      f.sph(mt, 0.035, sd * 0.1, 0.99, 0.24, { n: 5, seg: 8 });
    }
    const bk = f.child(L(0, 1.0, 0.26, -0.55, 0, 0));
    for (const sd of [-1, 1]) bk.box(mt, sd * 0.085, 0.01, 0, 0.17, 0.025, 0.22, { c: 0.008, rz: -sd * 0.12 });
    k.col(0, 0, 0.42, 0.42, pl + 1.8 * s);
  };
  // 갑옷 걸이: 십자 받침, 흉갑, 허리 미늘, 어깨받이, 투구(눈구멍), 둥근 방패
  P.armorStand = (b, x, y, z, rot, o) => {
    o = o || {};
    const k = new K(b, x, y, z, rot), fl = a => 1 - 0.22 * Math.cos(a) * Math.cos(a);
    k.box('oak', 0, 0.04, 0, 0.6, 0.08, 0.1, { c: 0.012 }); k.box('oak', 0, 0.04, 0, 0.1, 0.08, 0.5, { c: 0.012 });
    k.cyl('oak', 0.03, 1.55, 0, 0.08, 0, { seg: 8 });
    k.lathe('iron', [[0.17, 0.98], [0.19, 1.04], [0.205, 1.15], [0.215, 1.3], [0.2, 1.4], [0.13, 1.47], [0.075, 1.5], [0.075, 1.5], [0, 1.49]], 0, 0, 0, { seg: 24, wob: a => 0, cf: () => 1 });
    k.ring('brass', 0.185, 0.008, 0, 0.99, 0, { ts: 24, rs: 4, s: 1 }); k.ring('brass', 0.078, 0.01, 0, 1.5, 0, { ts: 16, rs: 4 });
    for (let i = 0; i < 3; i++) k.lathe('iron', [[0.19 + i * 0.012, 0.99 - i * 0.07], [0.205 + i * 0.016, 0.92 - i * 0.07]], 0, 0, 0, { seg: 24, t: 0.9 - i * 0.05 });
    for (const sd of [-1, 1]) { const pr = [[0.12, -0.03]]; for (let i = 0; i <= 5; i++) { const a = (1 - i / 5) * PI / 2; pr.push([Math.sin(a) * 0.12 + 0.001, Math.cos(a) * 0.1]); } k.lathe('iron', pr, sd * 0.22, 1.4, 0, { seg: 14, rz: -sd * 0.55 }); }
    k.lathe('iron', [[0, 0], [0.1, 0], [0.115, 0.04], [0.12, 0.12], [0.105, 0.2], [0.065, 0.25], [0, 0.265]], 0, 1.56, 0, { seg: 18 });
    k.box('iron', 0, 1.67, 0.1, 0.13, 0.014, 0.04, { c: 0.002, t: 0.12 });
    k.box('iron', 0, 1.8, 0, 0.02, 0.06, 0.22, { c: 0.008 });
    k.lathe('pVelvet', [[0, 0], [0.03, 0.02], [0.02, 0.14], [0, 0.18]], 0, 1.82, -0.04, { seg: 8, rx: -0.5, t: C.oxblood });
    const sh = k.child(L(0.34, 0.36, 0.12, -0.25, -0.5, 0.12));
    sh.lathe('oak', [[0, 0], [0.3, 0], [0.3, 0.025], [0, 0.04]], 0, 0, 0, { rx: PI / 2, seg: 24, t: [0.9, 0.7, 0.55] });
    sh.ring('iron', 0.3, 0.012, 0, 0, 0.012, { rx: PI / 2, ts: 24, rs: 4 });
    sh.lathe('brass', [[0, 0], [0.07, 0], [0.05, 0.04], [0, 0.06]], 0, 0, 0.03, { rx: PI / 2, seg: 14 });
    k.col(0, 0, 0.3, 0.3, 1.85);
  };

  // =====================================================================
  // 12. 바깥 (정원·마을)
  // =====================================================================
  // 꽃 무더기: 잎 + 줄기 + 꽃머리 (o.r 반지름, o.n 꽃 수, o.cols)
  P.flowers = (b, x, y, z, rot, o) => {
    o = o || {};
    const R = RNG(x, y, z, o), k = new K(b, x, y, z, rot), r = opt(o, 'r', 0.25), n = opt(o, 'n', 14), cols = o.cols || [0xEDE6D6, 0xD8708A, 0xE8C040, 0x9A70C8, 0xC84040, 0xF0A060];
    for (let i = 0; i < Math.round(n * 0.7); i++) {
      const a = R() * TAU, len = R.r(0.12, 0.24), w = R.r(0.04, 0.07), dx = Math.sin(a), dz = Math.cos(a), el = R.r(0.5, 1.1), bx = Math.sin(a) * r * R() * 0.6, bz = Math.cos(a) * r * R() * 0.6;
      k.add('pPlant', sheet(1, 3, (u, v) => { const d = len * v, yy = len * (Math.sin(el) * v - v * v * 0.5), ac = (u - 0.5) * w; return [bx + dx * d - dz * ac, yy + 0.005, bz + dz * d + dx * ac]; }, { uvRect: [0.02, 0.02, 0.48, 0.98] }), null, jit(R, [0.7, 0.95, 0.6], 0.15));
    }
    for (let i = 0; i < n; i++) {
      const a = R() * TAU, rr = Math.sqrt(R()) * r, hx = Math.sin(a) * rr, hz = Math.cos(a) * rr, hh = R.r(0.12, 0.34), c = R.p(cols);
      k.tube('timber', [[hx * 0.5, 0, hz * 0.5], [hx, hh, hz]], 0.004, { rs: 3, t: [0.5, 0.9, 0.35] });
      k.lathe('pFood', [[0, -0.006], [0.028, 0.0], [0.03, 0.006], [0, 0.012]], hx, hh, hz, { seg: 5, flat: true, rx: R.r(-0.5, 0.5), rz: R.r(-0.5, 0.5), t: c });
      k.sph('pFood', 0.008, hx, hh + 0.012, hz, { n: 3, seg: 5, t: 0xE8B030 });
    }
  };
  // 돌 항아리 화분 (받침 위, 꽃과 늘어진 잎). o.mat 'stoneTrim'|'copper'|'brass', o.pedestal
  P.urn = (b, x, y, z, rot, o) => {
    o = o || {};
    const k = new K(b, x, y, z, rot), mt = o.mat || 'stoneTrim', py = o.pedestal === false ? 0 : 0.62;
    if (py) { k.box('stoneTrim', 0, 0.05, 0, 0.56, 0.1, 0.56, { c: 0.02, t: 0.85 }); k.box('stoneTrim', 0, 0.33, 0, 0.44, 0.46, 0.44, { c: 0.015 }); k.box('stoneTrim', 0, 0.59, 0, 0.52, 0.06, 0.52, { c: 0.015 }); }
    k.lathe(mt, [[0, 0], [0.14, 0], [0.15, 0.04], [0.08, 0.08], [0.07, 0.14], [0.2, 0.22], [0.3, 0.38], [0.32, 0.5], [0.37, 0.54], [0.37, 0.6], [0.31, 0.6], [0.29, 0.52], [0, 0.5]], 0, py, 0, { seg: 20, wob: (i, a) => i > 4 && i < 8 ? Math.abs(Math.sin(a * 6)) * 0.03 : 0 });
    k.lathe('pFood', [[0.3, py + 0.55], [0, py + 0.57]], 0, 0, 0, { seg: 12, t: 0x3a2a1e });
    k.sub(P.flowers, 0, py + 0.56, 0, 0, { r: 0.28, n: 18, seed: o.seed, cols: o.cols });
    const R = RNG(x, y, z, o);
    for (let i = 0; i < 6; i++) { const a = R() * TAU, len = R.r(0.25, 0.5); k.add('pPlant', sheet(1, 4, (u, v) => [Math.sin(a) * (0.33 + v * 0.08) + Math.cos(a) * (u - 0.5) * 0.06, py + 0.6 - v * len, Math.cos(a) * (0.33 + v * 0.08) - Math.sin(a) * (u - 0.5) * 0.06], { uvRect: [0.56, 0.02, 0.94, 0.98] }), null, [0.55, 0.8, 0.45]); }
    k.col(0, 0, 0.3, 0.3, py + 0.6, 0, { r: 0.35 });
  };
  // 긴 화분 상자 (돌 또는 나무)
  P.planter = (b, x, y, z, rot, o) => {
    o = o || {};
    const R = RNG(x, y, z, o), k = new K(b, x, y, z, rot), len = opt(o, 'len', 1.2), w = 0.42, h = 0.42, mt = o.wood ? 'timber' : 'stoneTrim';
    k.box(mt, 0, h / 2, 0, len, h, w, { c: 0.02, t: o.wood ? [1.1, 1.0, 0.85] : 0.9 });
    k.box(mt, 0, h + 0.025, 0, len + 0.05, 0.05, w + 0.05, { c: 0.015 });
    k.box('pFood', 0, h, 0, len - 0.06, 0.02, w - 0.06, { c: 0.005, t: 0x3a2a1e });
    for (let i = 0; i < Math.max(1, Math.round(len / 0.4)); i++) k.sub(P.flowers, -len / 2 + 0.2 + i * (len - 0.4) / Math.max(1, Math.round(len / 0.4) - 1 || 1), h + 0.01, R.r(-0.05, 0.05), 0, { r: 0.18, n: 10, seed: R.i(1e6), cols: o.cols });
    k.col(0, 0, len / 2, w / 2, h + 0.05);
  };
  // 정원 의자: o.kind 'stone'(소용돌이 끝돌 + 판석) | 'iron'(무쇠 다리 + 참나무 살)
  P.gardenBench = (b, x, y, z, rot, o) => {
    o = o || {};
    const R = RNG(x, y, z, o), k = new K(b, x, y, z, rot), len = opt(o, 'len', 1.6);
    if (o.kind === 'iron') {
      for (const s of [-1, 1]) {
        const ex = s * (len / 2 - 0.08);
        k.tube('iron', [[ex, 0, 0.22], [ex, 0.2, 0.2], [ex, 0.42, 0.22], [ex, 0.45, 0.1], [ex, 0.43, -0.15], [ex, 0.9, -0.24]], 0.018, { rs: 5 });
        k.tube('iron', [[ex, 0, -0.2], [ex, 0.25, -0.18], [ex, 0.43, -0.15]], 0.018, { rs: 5 });
        k.tube('iron', [[ex, 0.62, 0.22], [ex, 0.66, 0.1], [ex, 0.6, -0.05]], 0.015, { rs: 5 });
        k.ring('iron', 0.05, 0.008, ex, 0.3, 0.22, { rz: PI / 2, ts: 10, rs: 3 });
      }
      for (let i = 0; i < 5; i++) k.box('oak', 0, 0.45, 0.17 - i * 0.075, len, 0.025, 0.06, { c: 0.008, t: woodT(R) });
      for (let i = 0; i < 3; i++) k.box('oak', 0, 0.56 + i * 0.11, -0.18 - i * 0.02, len, 0.07, 0.022, { c: 0.008, rx: -0.2, t: woodT(R) });
    } else {
      const sh = new T.Shape(); sh.moveTo(-0.22, 0); sh.lineTo(0.22, 0); sh.lineTo(0.2, 0.1); sh.quadraticCurveTo(0.08, 0.15, 0.14, 0.32); sh.quadraticCurveTo(0.2, 0.42, 0.1, 0.42); sh.lineTo(-0.1, 0.42); sh.quadraticCurveTo(-0.2, 0.42, -0.14, 0.32); sh.quadraticCurveTo(-0.08, 0.15, -0.2, 0.1); sh.closePath();
      for (const s of [-1, 1]) k.add('stoneTrim', ext(sh, 0.16, { bevel: 0.01 }), L(s * (len / 2 - 0.15), 0, 0, 0, PI / 2, 0));
      k.box('stoneTrim', 0, 0.46, 0, len, 0.08, 0.46, { c: 0.02 });
    }
    k.col(0, 0, len / 2, 0.25, 0.48, 0, { stand: true });
  };
  // 기둥 등 (무쇠 받침, 가는 기둥, 위에 등불; o.arms 2면 양팔), 빛 하나
  P.lanternPost = (b, x, y, z, rot, o) => {
    o = o || {};
    const k = new K(b, x, y, z, rot), h = opt(o, 'h', 3.2), arms = opt(o, 'arms', 1);
    k.lathe('iron', [[0, 0], [0.2, 0], [0.2, 0.08], [0.16, 0.12], [0.12, 0.3], [0.09, 0.5], [0.11, 0.56], [0.07, 0.62], [0.055, h * 0.7], [0.07, h * 0.72], [0.05, h * 0.75], [0.045, h - 0.06], [0.07, h - 0.04], [0.07, h], [0, h]], 0, 0, 0, { seg: 12, cf: (i, j) => i > 1 && i < 6 ? (j % 2 ? 0.75 : 1.05) : 1 });
    if (arms === 1) P.lantern(b, ...k.w(0, h, 0), rot, { s: 1.6, light: false });
    else for (const s of [-1, 1]) { k.tube('iron', [[0, h - 0.25, 0], [s * 0.2, h - 0.2, 0], [s * 0.38, h - 0.05, 0], [s * 0.45, h + 0.02, 0]], 0.018, { rs: 5 }); k.ring('iron', 0.08, 0.01, s * 0.18, h - 0.32, 0, { rx: PI / 2, ts: 12, rs: 3, a0: 0, arc: PI * 1.5 }); P.lantern(b, ...k.w(s * 0.45, h + 0.02, 0), rot, { s: 1.4, hang: true, light: false }); }
    k.light(0, h + (arms === 1 ? 0.25 : -0.2), 0, 0xFFB060, opt(o, 'light', 1.4), 12);
    k.col(0, 0, 0.2, 0.2, h, 0, { r: 0.2 });
  };
  // 벽 등불: 무쇠 소용돌이 팔 + 매단 등불. 지역 z=0 벽면, y = 팔 높이
  P.wallLantern = (b, x, y, z, rot, o) => {
    o = o || {};
    const k = new K(b, x, y, z, rot), s = opt(o, 's', 1.3), reach = 0.42 * s;
    k.box('iron', 0, 0, 0.01, 0.1, 0.22, 0.02, { c: 0.004 });
    k.tube('iron', [[0, 0.05, 0.02], [0, 0.07, reach * 0.5], [0, 0.04, reach]], 0.014, { rs: 5 });
    k.tube('iron', [[0, -0.08, 0.02], [0, -0.06, reach * 0.3], [0, 0.0, reach * 0.6], [0, 0.05, reach * 0.62]], 0.01, { rs: 4 });
    k.ring('iron', 0.05, 0.008, 0, -0.01, reach * 0.35, { rz: PI / 2, ry: PI / 2, ts: 12, rs: 3, a0: PI / 2, arc: PI * 1.4 });
    P.lantern(b, ...k.w(0, 0.04, reach), rot, { s, hang: true, light: false });
    if (o.soot !== false) k.add('pSoot', quad(0.4, 0.5), L(0, 0.3, 0.003), 0.6);
    k.light(0, -0.25 * s, reach, 0xFFB060, opt(o, 'light', 1.2), 10);
  };
  // 두레박
  P.bucket = (b, x, y, z, rot, o) => {
    o = o || {};
    const k = new K(b, x, y, z, rot), r = 0.13, h = 0.24;
    k.lathe('timber', [[0, 0.01], [r * 0.85, 0.01], [r * 0.85, 0], [r, h], [r * 0.92, h], [r * 0.78, 0.03], [0, 0.03]], 0, 0, 0, { seg: 14, cf: (i, j) => (j % 2 ? 0.85 : 1.1), t: [1.1, 0.95, 0.8] });
    for (const t of [0.15, 0.85]) k.ring('iron', r * 0.86 + (r * 0.15) * t + 0.004, 0.005, 0, h * t, 0, { ts: 16, rs: 3 });
    k.ring('iron', r * 1.02, 0.005, 0, h, 0, { rx: PI / 2, a0: PI / 2, arc: PI, ts: 12, rs: 3, rz: o.tip || 0 });
    if (o.water) k.lathe('pWater', [[r * 0.9, h * 0.8], [0, h * 0.8]], 0, 0, 0, { seg: 12 });
  };
  // 우물: 돌 둘레, 머릿돌, 나무 기둥과 지붕, 도르래, 밧줄과 두레박
  P.well = (b, x, y, z, rot, o) => {
    o = o || {};
    const k = new K(b, x, y, z, rot), Rw = 0.78;
    k.lathe('stone', [[Rw - 0.16, -0.4], [Rw - 0.16, 0.0], [Rw, 0], [Rw, 0], [Rw + 0.02, 0.4], [Rw, 0.78], [Rw - 0.16, 0.78]].reverse(), 0, 0, 0, { seg: 28, flat: false });
    k.lathe('stoneTrim', [[Rw + 0.06, 0.76], [Rw + 0.06, 0.86], [Rw + 0.04, 0.88], [Rw - 0.2, 0.88], [Rw - 0.2, 0.76]], 0, 0, 0, { seg: 28 });
    k.lathe('pWater', [[Rw - 0.16, -0.3], [0, -0.3]], 0, 0, 0, { seg: 16, t: 0.4 });
    for (const s of [-1, 1]) { k.box('timber', s * (Rw + 0.0), 1.45, 0, 0.1, 1.3, 0.1, { c: 0.012, t: [0.8, 0.7, 0.6] }); k.box('timber', s * Rw, 0.82, 0, 0.18, 0.12, 0.16, { c: 0.01, t: [0.7, 0.6, 0.5] }); }
    for (const s of [-1, 1]) k.box('timber', 0, 2.22 + 0.0, s * 0.36, Rw * 2 + 0.5, 0.035, 0.82, { c: 0.008, rx: s * 0.62, t: [0.75, 0.62, 0.5] });
    k.box('timber', 0, 2.47, 0, Rw * 2 + 0.55, 0.08, 0.08, { c: 0.01, rx: PI / 4, t: [0.7, 0.6, 0.5] });
    k.box('timber', 0, 2.08, 0, Rw * 2 + 0.1, 0.1, 0.1, { c: 0.01, t: [0.8, 0.7, 0.6] });
    k.cyl('oak', 0.07, Rw * 2 - 0.06, -(Rw - 0.03), 1.55, 0, { rz: -PI / 2, seg: 10 });
    k.cyl('rope', 0.078, 0.3, -0.15, 1.55, 0, { rz: -PI / 2, seg: 10, t: 0xA08860 });
    k.tube('iron', [[Rw + 0.06, 1.55, 0], [Rw + 0.12, 1.55, 0], [Rw + 0.12, 1.35, 0.05], [Rw + 0.22, 1.35, 0.05]], 0.012, { rs: 4 });
    k.cyl('rope', 0.008, 0.55, 0, 1.0, -0.07, { seg: 4, t: 0xA08860 });
    k.sub(P.bucket, 0, 0.75, -0.07, 0.3, {});
    k.sub(P.bucket, Rw + 0.45, 0, 0.35, 1.2, { water: true });
    k.col(0, 0, Rw + 0.06, Rw + 0.06, 0.88, 0, { r: Rw + 0.06 });
  };
  // 손수레: 바퀴 둘(바퀴살 10), 판자 짐칸, 손잡이, 짐 (o.load 'sacks'|'barrels'|'crates'|'hay'|'none')
  P.cart = (b, x, y, z, rot, o) => {
    o = o || {};
    const R = RNG(x, y, z, o), k = new K(b, x, y, z, rot), wr = 0.46, by = 0.62, BL = 1.7, BW = 1.0, tt = jit(R, [1.15, 1.0, 0.85], 0.08);
    for (const s of [-1, 1]) {
      const wz = s * (BW / 2 + 0.1);
      k.lathe('oak', [[0, 0], [0.08, 0], [0.09, 0.03], [0.09, 0.12], [0.08, 0.15], [0, 0.15]], 0, wr, wz - 0.075, { rx: PI / 2, seg: 12, t: tt });
      k.ring('timber', wr - 0.03, 0.035, 0, wr, wz, { rx: PI / 2, ts: 28, rs: 5, t: tt });
      k.ring('iron', wr, 0.02, 0, wr, wz, { rx: PI / 2, ts: 28, rs: 4, s: 1 });
      for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; k.box('timber', Math.sin(a) * wr * 0.5, wr + Math.cos(a) * wr * 0.5, wz, 0.035, wr * 0.82, 0.03, { c: 0.006, rz: -a, t: tt }); }
    }
    k.cyl('iron', 0.03, BW + 0.3, 0, wr, -(BW + 0.3) / 2, { rx: PI / 2, seg: 8 });
    k.box('timber', 0, by, 0, BL, 0.04, BW, { c: 0.008, t: tt });
    for (const s of [-1, 1]) { k.box('timber', 0, by + 0.18, s * (BW / 2 - 0.015), BL, 0.3, 0.03, { c: 0.008, t: mul(tt, 0.92) }); k.box('timber', s * (BL / 2 - 0.015), by + 0.15, 0, 0.03, 0.24, BW - 0.04, { c: 0.008, t: mul(tt, 0.9) }); for (const px of [-BL / 2 + 0.1, 0, BL / 2 - 0.1]) k.box('timber', px, by + 0.2, s * (BW / 2 + 0.01), 0.05, 0.38, 0.04, { c: 0.008, t: mul(tt, 0.8) }); }
    for (const s of [-1, 1]) { k.box('timber', BL / 2 + 0.55, by - 0.05, s * 0.4, 1.3, 0.06, 0.06, { c: 0.01, rz: -0.12, t: tt }); }
    k.box('timber', BL / 2 + 1.0, 0.25, 0, 0.05, 0.5, 0.05, { c: 0.008, t: tt });
    const ld = o.load || R.p(['sacks', 'barrels', 'crates', 'hay']);
    if (ld === 'sacks') for (let i = 0; i < 4; i++) k.sub(P.sack, -0.5 + i * 0.32, by + 0.02, R.r(-0.2, 0.2), R() * TAU, { h: 0.5 });
    else if (ld === 'barrels') { k.sub(P.barrel, -0.4, by + 0.02, 0.2, 0, { h: 0.7, r: 0.24 }); k.sub(P.barrel, 0.25, by + 0.02, -0.15, 0, { h: 0.7, r: 0.24, lying: true }); }
    else if (ld === 'crates') { k.sub(P.crate, -0.35, by + 0.02, 0, R.r(-0.2, 0.2), { s: 0.55 }); k.sub(P.crate, 0.3, by + 0.02, 0.1, R.r(-0.2, 0.2), { s: 0.45, lid: false }); }
    else if (ld === 'hay') k.rb('pFood', 0, by + 0.25, 0, BL - 0.1, 0.45, BW - 0.1, 0.12, { puff: 0.1, t: 0xC8A860 });
    k.col(0.3, 0, BL / 2 + 0.5, BW / 2 + 0.15, by + 0.4);
  };
  // 깃대: 돌 받침, 무쇠 기둥, 룬 고리 꼭지, 가로대에 깃발(흔들림)
  P.flagPole = (b, x, y, z, rot, o) => {
    o = o || {};
    const k = new K(b, x, y, z, rot), h = opt(o, 'h', 6);
    k.box('stoneTrim', 0, 0.2, 0, 0.6, 0.4, 0.6, { c: 0.03 }); k.box('stoneTrim', 0, 0.44, 0, 0.45, 0.08, 0.45, { c: 0.02 });
    k.lathe('iron', [[0, 0], [0.08, 0], [0.08, 0.15], [0.06, 0.2], [0.05, h - 0.2], [0.06, h - 0.15], [0.06, h - 0.1], [0, h - 0.1]], 0, 0.48, 0, { seg: 10 });
    k.ring('gold', 0.14, 0.014, 0, h + 0.55, 0, { rx: PI / 2, ts: 24, rs: 4 });
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; k.box('gold', Math.sin(a) * 0.17, h + 0.55 + Math.cos(a) * 0.17, 0, 0.012, 0.05, 0.012, { c: 0, rz: -a }); }
    k.lathe('gold', [[0, 0], [0.04, 0.02], [0.02, 0.2], [0, 0.32]], 0, h + 0.38, 0, { seg: 8 });
    k.box('brass', 0, h - 0.2, 0, 1.15, 0.035, 0.035, { c: 0.006 });
    P.banner(b, ...k.w(0, h - 0.24, 0.0), rot, { free: true, w: opt(o, 'w', 0.95), h: opt(o, 'fh', 2.4) });
    k.col(0, 0, 0.3, 0.3, h, 0, { r: 0.3 });
  };
  // 게시판: 기둥 둘, 작은 지붕, 압정으로 꽂힌 쪽지들
  P.noticeBoard = (b, x, y, z, rot, o) => {
    o = o || {};
    const R = RNG(x, y, z, o), k = new K(b, x, y, z, rot), w = opt(o, 'w', 1.4), h = 0.95, cy = 1.45, tt = [0.85, 0.75, 0.62];
    for (const s of [-1, 1]) k.box('timber', s * (w / 2 + 0.05), (cy + h / 2 + 0.2) / 2, 0, 0.09, cy + h / 2 + 0.2, 0.09, { c: 0.01, t: tt });
    k.box('timber', 0, cy, -0.01, w, h, 0.03, { c: 0.004, t: [1.2, 1.0, 0.8] });
    for (const s of [-1, 1]) { k.box('oak', 0, cy + s * (h / 2 + 0.025), 0.01, w + 0.1, 0.05, 0.05, { c: 0.008 }); k.box('oak', s * (w / 2 + 0.0), cy, 0.01, 0.05, h, 0.05, { c: 0.008 }); }
    for (const s of [-1, 1]) k.box('slate', 0, cy + h / 2 + 0.24, s * 0.14, w + 0.4, 0.025, 0.36, { c: 0.006, rx: s * 0.5 });
    k.box('timber', 0, cy + h / 2 + 0.31, 0, w + 0.42, 0.05, 0.05, { c: 0.008, rx: PI / 4, t: tt });
    const n = opt(o, 'n', 14);
    for (let i = 0; i < n; i++) {
      const pw = R.r(0.14, 0.26), ph = pw * R.r(1.1, 1.45), px = R.r(-w / 2 + pw / 2 + 0.04, w / 2 - pw / 2 - 0.04), py = cy + R.r(-h / 2 + ph / 2 + 0.04, h / 2 - ph / 2 - 0.04);
      k.add('pBooks', quad(pw, ph, AT.page(R.p([2, 3, 2, 3, 0, 1]))), L(px, py, 0.008 + i * 0.0012, 0, 0, R.r(-0.14, 0.14)), R.p([1, [0.95, 0.9, 0.78], [1.02, 0.98, 0.9]]));
      k.sph(R() < 0.7 ? 'brass' : 'pClay', 0.008, px + R.r(-0.02, 0.02), py + ph / 2 - 0.02, 0.012 + i * 0.0012, { n: 3, seg: 5, t: R.p([0xC83A3A, 0x3a5ac8, null]) });
    }
    k.col(0, 0, w / 2 + 0.1, 0.1, cy + h / 2);
  };
  // 낮은 돌담 (지역 x 방향 길이 o.len): 다듬은 갓돌, 굽돌, 2.5 m마다 기둥(공 꼭지)
  P.lowWall = (b, x, y, z, rot, o) => {
    o = o || {};
    const R = RNG(x, y, z, o), k = new K(b, x, y, z, rot), len = opt(o, 'len', 4), h = opt(o, 'h', 0.8), t = opt(o, 't', 0.42);
    k.box('stoneTrim', 0, 0.07, 0, len + 0.02, 0.14, t + 0.08, { c: 0.02, t: 0.82 });
    k.box('stone', 0, h / 2 + 0.07, 0, len, h - 0.14, t, { c: 0.015, uo: R() * 5 });
    k.box('stoneTrim', 0, h + 0.04, 0, len + 0.06, 0.1, t + 0.1, { c: 0.03, taper: 0.88 });
    const np = Math.floor(len / 2.5);
    for (let i = 0; i <= np; i++) {
      if (o.piers === false) break;
      const px = -len / 2 + (np ? i * len / np : len / 2);
      k.box('stone', px, (h + 0.2) / 2, 0, 0.52, h + 0.2, t + 0.14, { c: 0.02 });
      k.box('stoneTrim', px, h + 0.25, 0, 0.6, 0.1, t + 0.22, { c: 0.025 });
      if (o.balls !== false) { k.box('stoneTrim', px, h + 0.33, 0, 0.3, 0.06, 0.3, { c: 0.01 }); k.sph('stoneTrim', 0.15, px, h + 0.5, 0, { n: 8, seg: 12 }); }
    }
    k.col(0, 0, len / 2, t / 2 + 0.05, h + 0.1, 0, { climb: true });
  };
  // 무쇠 난간 (지역 x 방향 o.len): 위아래 가로대, 창끝 살 0.12 m마다, 기둥과 황동 공
  P.railing = (b, x, y, z, rot, o) => {
    o = o || {};
    const k = new K(b, x, y, z, rot), len = opt(o, 'len', 3), h = opt(o, 'h', 1.0);
    for (const yy of [0.08, h - 0.06]) k.box('iron', 0, yy, 0, len, 0.035, 0.03, { c: 0.006 });
    for (let xx = -len / 2 + 0.06; xx < len / 2 - 0.03; xx += 0.12) { k.cyl('iron', 0.009, h - 0.06, xx, 0.06, 0, { seg: 4 }); k.lathe('iron', [[0, 0], [0.016, 0.01], [0, 0.06]], xx, h - 0.04, 0, { seg: 4 }); }
    const np = Math.max(1, Math.round(len / 1.5));
    for (let i = 0; i <= np; i++) { const px = -len / 2 + i * len / np; k.box('iron', px, (h + 0.08) / 2, 0, 0.06, h + 0.08, 0.06, { c: 0.008 }); k.sph('brass', 0.045, px, h + 0.12, 0, { n: 6, seg: 8 }); }
    k.col(0, 0, len / 2, 0.05, h);
  };
  // 장 가판대: 줄무늬 차양(가리비 끝단), 판자 계산대, 물건 (o.goods 'produce'|'fabric'|'bakery'|'curios'|'herbs'), 매단 등
  P.marketStall = (b, x, y, z, rot, o) => {
    o = o || {};
    const R = RNG(x, y, z, o), k = new K(b, x, y, z, rot), W = opt(o, 'w', 2.4), D = 1.3, ch = 0.9, tt = jit(R, [1.1, 0.95, 0.8], 0.1);
    const goods = o.goods || R.p(['produce', 'fabric', 'bakery', 'curios', 'herbs']);
    const cols = o.cols || R.p([[0xE6D8BC, 0x6B2A22], [0xE6D8BC, 0x2A2F5E], [0xA8843E, 0x3E4A2A], [0xE6D8BC, 0x2F4A36]]);
    for (const sx of [-1, 1]) { k.box('timber', sx * (W / 2 - 0.05), 1.2, D / 2 - 0.05, 0.09, 2.4, 0.09, { c: 0.01, t: tt }); k.box('timber', sx * (W / 2 - 0.05), 1.1, -D / 2 + 0.05, 0.09, 2.2, 0.09, { c: 0.01, t: tt }); }
    k.box('timber', 0, ch, 0.15, W - 0.04, 0.05, D * 0.62, { c: 0.01, t: mul(tt, 1.1) });
    for (let i = 0; i < 6; i++) k.box('timber', -W / 2 + 0.1 + (i + 0.5) * (W - 0.2) / 6, ch / 2, 0.15 + D * 0.31, (W - 0.2) / 6 - 0.01, ch - 0.05, 0.03, { c: 0.006, t: mul(tt, R.r(0.85, 1.05)) });
    k.box('timber', 0, 0.35, -0.2, W - 0.1, 0.04, D * 0.45, { c: 0.008, t: tt });
    k.box('timber', 0, 2.38, D / 2 - 0.05, W, 0.08, 0.08, { c: 0.01, t: tt }); k.box('timber', 0, 2.18, -D / 2 + 0.05, W, 0.08, 0.08, { c: 0.01, t: tt });
    const ns = 9, sw = (W + 0.2) / ns;
    for (let i = 0; i < ns; i++) {
      const c = cols[i % 2];
      k.add('pLinen', sheet(2, 5, (u, v) => { const xx = -(W + 0.2) / 2 + (i + u) * sw; return [xx, 2.2 + v * 0.22 + 0.04 - Math.sin(v * PI) * 0.06, -D / 2 - 0.05 + v * (D + 0.25)]; }, { both: true, back: 0.7, uvm: [sw, D] }), null, c);
      k.add('pLinen', sheet(2, 2, (u, v) => { const xx = -(W + 0.2) / 2 + (i + u) * sw; return [xx, 2.46 - (1 - v) * (0.2 + 0.06 * Math.sin(u * PI)), D / 2 + 0.2]; }, { both: true, back: 0.7, uvm: [sw, 0.3] }), null, c);
    }
    const top = ch + 0.025;
    if (goods === 'produce') { for (let i = 0; i < 4; i++) k.sub(P.basket, -W / 2 + 0.35 + i * 0.55, top, 0.2 + R.r(-0.05, 0.05), R() * TAU, { r: 0.2, fill: R.p(['fruit', 'fruit', 'bread', 'herbs']) }); k.sub(P.crate, -0.6, 0, -0.35, 0.1, { s: 0.55, lid: false, fill: 'fruit' }); k.sub(P.sack, 0.5, 0, -0.35, 0, { h: 0.55 }); k.sub(P.sack, 0.85, 0, -0.3, 0, { h: 0.45, spill: true }); }
    else if (goods === 'fabric') { for (let i = 0; i < 7; i++) k.lathe('pVelvet', [[0, 0], [0.06, 0], [0.06, 0.9], [0, 0.9]], -W / 2 + 0.3 + i * 0.28, top + 0.06, 0.32, { rx: -PI / 2, seg: 10, t: R.p([C.oxblood, C.indigo, 0xA8843E, 0x3E4A2A, 0x6a2a5a, 0xC8B890]) }); k.cyl('oak', 0.015, W - 0.1, -(W - 0.1) / 2, 1.9, 0.3, { rz: -PI / 2, seg: 6 }); for (let i = 0; i < 4; i++) k.add('pVelvet', sheet(4, 6, (u, v) => [-W / 2 + 0.25 + i * 0.5 + (u - 0.5) * 0.4, 1.9 - (1 - v) * 0.9, 0.3 + Math.sin(u * 3 * PI) * 0.03], { both: true }), null, R.p([C.oxblood, C.indigo, 0xA8843E, 0x2F4A36])); }
    else if (goods === 'bakery') { for (let i = 0; i < 5; i++) k.sub(P.bread, -W / 2 + 0.3 + i * 0.42, top, 0.25 + R.r(-0.08, 0.08), R.r(-0.5, 0.5), {}); for (let i = 0; i < 2; i++) k.sub(P.basket, -0.4 + i * 0.8, 0.37, -0.2, R() * TAU, { fill: 'bread', handle: true }); }
    else if (goods === 'herbs') { k.sub(P.herbBundle, 0, 2.3, D / 2 - 0.05, 0, { n: 7 }); for (let i = 0; i < 3; i++) k.sub(P.basket, -0.7 + i * 0.7, top, 0.2, R() * TAU, { fill: 'herbs', r: 0.18 }); for (let i = 0; i < 6; i++) k.sub(P.bottle, -0.9 + i * 0.35, top, 0.42, 0, { s: 1.1 }); }
    else { P.dress(b, { x: k.w(0, 0, 0.15)[0], y: y + top, z: k.w(0, 0, 0.15)[2], w: W - 0.2, d: D * 0.55, rot }, { kinds: ['bottle', 'book', 'candle', 'scrolls', 'hourglass', 'magnifier', 'keyring', 'bottle'], density: 1.6 }); k.sub(P.armillarySphere, W / 2 - 0.4, top, 0.2, 0, { r: 0.12 }); }
    k.sub(P.lantern, W / 2 - 0.05, 2.32, D / 2 + 0.02, 0, { hang: true, s: 1.1, light: o.light });
    k.box('oak', -W / 2 + 0.5, 2.0, D / 2 + 0.2, 0.5, 0.22, 0.02, { c: 0.006, t: 0.8 }); k.add('pBooks', quad(0.4, 0.14, AT.page(3)), L(-W / 2 + 0.5, 2.0, D / 2 + 0.212));
    k.col(0, 0, W / 2, D / 2, 2.4);
  };
  // 엔진 혼천의 분수 (대정원): 지름 ~6 m 돌 수반, 가운데 받침과 윗 수반의 물막, 네 황동 물뿜이, 위에 12개 황동 고리가 천천히 돈다.
  // o.lit = 켜진(고친) 기관 수 0..12 — 켜진 고리는 금빛 + 마나 구슬. 가운데 마나 수정.
  P.engineFountain = (b, x, y, z, rot, o) => {
    o = o || {};
    const R = RNG(x, y, z, o), k = new K(b, x, y, z, rot), Rb = opt(o, 'r', 3.0), lit = opt(o, 'lit', 4), cy = opt(o, 'cy', 3.7), r0 = 1.75, wl = 0.54;
    k.lathe('stone', [[Rb + 0.5, 0], [Rb + 0.5, 0.14], [Rb + 0.46, 0.16], [Rb - 0.05, 0.16]], 0, 0, 0, { seg: 64 });
    k.lathe('stoneTrim', [[Rb, 0.15], [Rb + 0.07, 0.2], [Rb + 0.07, 0.27], [Rb, 0.31], [Rb, 0.58], [Rb + 0.1, 0.62], [Rb + 0.1, 0.7], [Rb + 0.06, 0.72], [Rb - 0.36, 0.72], [Rb - 0.38, 0.69], [Rb - 0.38, 0.3]], 0, 0, 0, { seg: 64 });
    k.lathe('stoneDark', [[Rb - 0.37, 0.3], [0, 0.3]], 0, 0, 0, { seg: 32, t: 0.7 });
    k.lathe('pWater', [[Rb - 0.37, wl], [0, wl]], 0, 0, 0, { seg: 48 });
    for (let i = 0; i < 12; i++) { const a = (i + 0.5) / 12 * TAU, on = i < lit; k.box(on ? 'gold' : 'brass', Math.sin(a) * (Rb + 0.075), 0.44, Math.cos(a) * (Rb + 0.075), 0.26, 0.18, 0.02, { c: 0.004, ry: a }); k.ring(on ? 'gold' : 'iron', 0.05, 0.007, Math.sin(a) * (Rb + 0.088), 0.44, Math.cos(a) * (Rb + 0.088), { rx: PI / 2, ry: a, ts: 14, rs: 3 }); }
    k.lathe('stoneTrim', [[0, 0.3], [0.8, 0.3], [0.8, 0.45], [0.6, 0.55], [0.48, 0.75], [0.34, 0.95], [0.3, 1.45], [0.37, 1.52], [0.32, 1.6], [0.95, 1.78], [1.0, 1.9], [0.93, 1.92], [0.78, 1.82], [0, 1.74]], 0, 0, 0, { seg: 40 });
    k.lathe('pWater', [[0.9, 1.86], [0, 1.86]], 0, 0, 0, { seg: 24 });
    k.lathe('pFall', [[0.98, 1.9], [1.05, 1.6], [1.15, 1.1], [1.24, wl]], 0, 0, 0, { seg: 40, t: [0.45, 0.6, 0.66] });
    for (let i = 0; i < 4; i++) {
      const a = i / 4 * TAU + PI / 4, d = [Math.sin(a), Math.cos(a)];
      k.lathe('brass', [[0, 0], [0.09, 0.0], [0.07, 0.08], [0.05, 0.14], [0, 0.16]], d[0] * 0.36, 1.15, d[1] * 0.36, { rz: 0, rx: 0, seg: 10, ry: 0, s: 1 });
      const pts = []; for (let j = 0; j <= 8; j++) { const t = j / 8, rr = 0.42 + t * 1.5; pts.push([d[0] * rr, 1.2 + 0.35 * Math.sin(t * PI * 0.9) - t * t * 0.7, d[1] * rr]); }
      k.tube('pFall', pts, 0.035, { rs: 5, t: [0.5, 0.65, 0.7] });
    }
    k.cyl('brass', 0.07, cy - 1.86, 0, 1.86, 0, { seg: 12 });
    for (let i = 0; i < 4; i++) { const a = i / 4 * TAU; k.tube('brass', [[Math.sin(a) * 0.55, 1.88, Math.cos(a) * 0.55], [Math.sin(a) * 1.3, 2.4, Math.cos(a) * 1.3], [Math.sin(a) * (r0 + 0.1), cy - 0.2, Math.cos(a) * (r0 + 0.1)], [Math.sin(a) * (r0 + 0.12), cy, Math.cos(a) * (r0 + 0.12)]], 0.035, { rs: 6 }); }
    k.lathe('brass', [[r0 + 0.04, -0.03], [r0 + 0.2, -0.03], [r0 + 0.2, 0.03], [r0 + 0.04, 0.03], [r0 + 0.04, -0.03]], 0, cy, 0, { seg: 64 });
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; k.box(i < lit ? 'gold' : 'brass', Math.sin(a) * (r0 + 0.12), cy + 0.05, Math.cos(a) * (r0 + 0.12), 0.05, 0.08, 0.16, { c: 0.004, ry: a }); }
    k.sph('pCrystal', 0.17, 0, cy, 0, { n: 8, seg: 10 });
    { const p = k.w(0, cy, 0); sprite(b, p[0], p[1], p[2], FK.glow, 1.0 + lit * 0.05, 0.5, mul([0.25, 0.8, 0.95], 0.5 + lit / 12)); }
    const W0 = k.w(0, cy, 0), rings = [];
    const tilts = [0.0, 1.57, 0.41, 1.05, 0.7, 1.3, 0.22, 0.9, 1.45, 0.55, 1.18, 0.33];
    for (let i = 0; i < 12; i++) {
      const Ri = r0 - i * 0.085, on = i < lit, sb = new Batch(), kk = new K(sb, 0, 0, 0, 0);
      kk.ring(on ? 'gold' : 'brass', Ri, 0.036 - i * 0.0014, 0, 0, 0, { ts: Math.max(24, Math.round(Ri * 36)), rs: 6 });
      for (let j = 0; j < 4; j++) { const a = j / 4 * TAU + i; kk.box(on ? 'gold' : 'brass', Math.sin(a) * Ri, 0, Math.cos(a) * Ri, 0.05, 0.09, 0.05, { c: 0.008, ry: a }); }
      if (on) { kk.ring('pCrystal', Ri, 0.008, 0, 0.03, 0, { ts: Math.max(24, Math.round(Ri * 36)), rs: 3 }); for (let j = 0; j < 3; j++) { const a = j / 3 * TAU + i * 0.7; sprite(sb, Math.sin(a) * Ri, 0.0, Math.cos(a) * Ri, FK.glow, 0.16, (i * 3 + j) / 40, [0.3, 0.9, 1.0]); } }
      const g = sb.build(), pv = new T.Group(), sp = new T.Group(), tl = new T.Group();
      pv.position.set(W0[0], W0[1], W0[2]); pv.rotation.y = rot; tl.rotation.x = tilts[i]; tl.add(g); sp.add(tl); pv.add(sp); b.extra.push(pv);
      rings.push({ sp, g, ph: i * 0.52, s: (0.025 + 0.012 * (i % 4)) * (i % 2 ? -1 : 1) * (on ? 1.6 : 1), s2: 0.05 + i * 0.01 });
    }
    b.anims.push(t => { for (const r of rings) { r.sp.rotation.y = r.ph + t * r.s; r.g.rotation.y = t * r.s2; } });
    k.light(0, cy, 0, 0x7FF0FF, opt(o, 'light', 0.6 + lit * 0.08), 12, { flicker: false });
    k.col(0, 0, Rb + 0.1, Rb + 0.1, 0.72, 0, { r: Rb + 0.1 });
    return { r: Rb + 0.5 };
  };
  // @@END (이 줄 위에 이어 쓴다)
})();
