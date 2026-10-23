// 아스테리아 1부 — 식물과 바위 (FLORA)
// 나무 7종(oak 참나무, beech 너도밤나무, pine 층진 가문비형 침엽수, birch 자작나무, yew 어두운 주목, willow 버드나무, dead 죽은 나무),
// 덤불, 고사리, 갈대, 꽃 무리, 산울타리, 담쟁이, 꽃밭, 바위. 텍스처는 모두 코드로 그린다 (잎 아틀라스 1장 + 나무껍질 종류마다 1장).
// - 나무: 재귀로 자라는 가늘어지는 관 가지 + 가지 끝의 잎 카드 덩어리(알파 테스트, 굽은 법선, 역광 투과, 바람).
// - 심기(forest): 인스턴싱. 종류·변형마다 LOD0(전체, ~60 m) / LOD1(줄인 형상, ~130 m) / 임포스터(멀리, 모든 종류가 그리기 호출 1개).
//   LOD 경계는 화면 디더로 섞는다. 카메라가 3 m 움직이거나 10° 돌면 인스턴스를 다시 나눈다 (그리기 끝에 스스로 부른다).
// - 바람: GFX.timeU(게임 시간)와 FLORA.windU(방향 xz, 세기)로 꼭짓점 셰이더에서 흔든다. 그림자도 같이 흔들린다.
'use strict';
(function () {
  if (window.FLORA) return;
  const T = THREE;
  const F = window.FLORA = { sets: [] };
  const TAU = Math.PI * 2;
  const cl = (v, a, b) => v < a ? a : v > b ? b : v;
  const lp = (a, b, t) => a + (b - a) * t;
  const sm = (a, b, v) => { const t = cl((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
  const UP = V(0, 1, 0);
  const isMob = () => !!(window.GFX && GFX.mobile);
  F.timeU = (window.GFX && GFX.timeU) || { value: 0 };
  F.windU = { value: new T.Vector4(0.8, 0.6, 1, 0) };
  F.sunW = { value: V(0.3, 0.5, 0.2).normalize() };
  // 바람: 방향(xz)과 세기 (0 고요 ~ 1 산들바람 ~ 2.5 강풍)
  F.setWind = (x, z, k = 1) => { const l = Math.hypot(x, z) || 1; F.windU.value.set(x / l, z / l, k, 0); };

  // =====================================================================
  // 1. 난수와 노이즈
  // =====================================================================
  function rng(seed) {
    let a = (seed >>> 0) || 0x9e3779b9;
    const f = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    f.r = (x, y) => x + (y - x) * f();
    f.i = (x, y) => Math.floor(x + (y - x + 1) * f());
    f.s = () => f() * 2 - 1;
    f.p = arr => arr[Math.floor(f() * arr.length)];
    return f;
  }
  function ih(x, y, z, s) {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(z | 0, 1440662683) + Math.imul(s | 0, 982451653)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  const fd = t => t * t * (3 - 2 * t);
  function vn3(x, y, z, s = 0) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), u = fd(x - xi), v = fd(y - yi), w = fd(z - zi);
    const a = lp(lp(ih(xi, yi, zi, s), ih(xi + 1, yi, zi, s), u), lp(ih(xi, yi + 1, zi, s), ih(xi + 1, yi + 1, zi, s), u), v);
    const b = lp(lp(ih(xi, yi, zi + 1, s), ih(xi + 1, yi, zi + 1, s), u), lp(ih(xi, yi + 1, zi + 1, s), ih(xi + 1, yi + 1, zi + 1, s), u), v);
    return lp(a, b, w);
  }
  function fbm3(x, y, z, s = 0, o = 3) { let a = 0, k = 0.5, n = 0; for (let i = 0; i < o; i++) { a += vn3(x, y, z, s + i * 17) * k; n += k; x *= 2.03; y *= 2.03; z *= 2.03; k *= 0.5; } return a / n; }
  // 주기 노이즈 (텍스처 이음매 없음): x는 px, y는 py 마다 되풀이 (정수)
  function pv(x, y, px, py, s) {
    const xi = Math.floor(x), yi = Math.floor(y), u = fd(x - xi), v = fd(y - yi);
    const x0 = ((xi % px) + px) % px, x1 = (x0 + 1) % px, y0 = ((yi % py) + py) % py, y1 = (y0 + 1) % py;
    return lp(lp(ih(x0, y0, 0, s), ih(x1, y0, 0, s), u), lp(ih(x0, y1, 0, s), ih(x1, y1, 0, s), u), v);
  }
  function pf(x, y, px, py, s, oct = 4) { let a = 0, k = 0.5, n = 0; for (let i = 0; i < oct; i++) { a += pv(x, y, px, py, s + i * 31) * k; n += k; x *= 2; y *= 2; px *= 2; py *= 2; k *= 0.5; } return a / n; }
  const lin = hex => new T.Color(hex);   // sRGB 16진수 → 선형

  // =====================================================================
  // 2. 형상 모으기 (위치, 법선, uv, 색, fw = [줄기 굽힘 m, 가지 흔들림 m, 위상 0..1])
  // =====================================================================
  class GB {
    constructor() { this.P = []; this.N = []; this.U = []; this.C = []; this.W = []; this.I = []; }
    get n() { return this.P.length / 3; }
    v(p, n, u, v, c, w) { this.P.push(p.x, p.y, p.z); this.N.push(n.x, n.y, n.z); this.U.push(u, v); this.C.push(c[0], c[1], c[2]); this.W.push(w[0], w[1], w[2]); return this.P.length / 3 - 1; }
    t(a, b, c) { this.I.push(a, b, c); }
    q(a, b, c, d) { this.I.push(a, b, c, a, c, d); }
    build() {
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(this.P, 3));
      g.setAttribute('normal', new T.Float32BufferAttribute(this.N, 3));
      g.setAttribute('uv', new T.Float32BufferAttribute(this.U, 2));
      g.setAttribute('color', new T.Float32BufferAttribute(this.C, 3));
      g.setAttribute('fw', new T.Float32BufferAttribute(this.W, 3));
      g.setIndex(this.n > 65535 ? new T.Uint32BufferAttribute(this.I, 1) : new T.Uint16BufferAttribute(this.I, 1));
      g.computeBoundingSphere(); g.computeBoundingBox();
      return g;
    }
  }
  const tris = g => g ? (g.index ? g.index.count : g.attributes.position.count) / 3 : 0;

  // =====================================================================
  // 3. 잎 아틀라스 (4×4 칸): 캔버스로 그리고, 투명한 곳에도 이웃 색을 채워 밉맵 테두리가 검게 되지 않게 한다
  // =====================================================================
  const TL = { oak: 0, beech: 1, birch: 2, willow: 3, pine: 4, yew: 5, bush: 6, hedge: 7, ivy: 8, fern: 9, leafy: 10, spike: 11, clump: 12, oak2: 13, pine2: 14, solid: 15 };
  const SOLID = [0.875, 0.125];   // 불투명 흰 칸 한가운데 (단색 형상용)
  function tileUV(t) { const c = t % 4, r = (t / 4) | 0, e = 0.003; return [c / 4 + e, 1 - (r + 1) / 4 + e, (c + 1) / 4 - e, 1 - r / 4 - e]; }
  const HSL = (h, s, l, a = 1) => `hsla(${h.toFixed(1)},${cl(s, 0, 100).toFixed(1)}%,${cl(l, 0, 100).toFixed(1)}%,${a})`;
  function leafPoly(shape, L, W) {
    const n = shape === 'oak' ? 30 : 16, R = [];
    for (let i = 0; i <= n; i++) {
      const s = i / n; let w;
      if (shape === 'oak') w = Math.sin(Math.PI * Math.pow(s, 0.8)) * (0.55 + 0.45 * Math.abs(Math.sin(s * Math.PI * 4.5 + 0.5)));
      else if (shape === 'birch') w = Math.pow(Math.sin(Math.PI * Math.pow(s, 0.55)), 0.9) * (i % 2 ? 1.06 : 0.97);
      else if (shape === 'lance') w = Math.pow(Math.sin(Math.PI * s), 0.8);
      else if (shape === 'round') w = Math.pow(Math.sin(Math.PI * s), 0.6);
      else w = Math.pow(Math.sin(Math.PI * Math.pow(s, 0.7)), 0.9);
      R.push([W * w, -L * s]);
    }
    return R.concat(R.slice(1, -1).reverse().map(([x, y]) => [-x * 0.94, y]));
  }
  function drawLeaf(g, x, y, ang, L, W, shape, c, k) {
    const pts = leafPoly(shape, L, W);
    g.save(); g.translate(x, y); g.rotate(ang);
    g.beginPath(); g.moveTo(0, 0); for (const p of pts) g.lineTo(p[0], p[1]); g.closePath();
    const gr = g.createLinearGradient(-W, 0, W, -L * 0.35);
    gr.addColorStop(0, HSL(c[0], c[1], c[2] * k * 0.8)); gr.addColorStop(0.5, HSL(c[0], c[1], c[2] * k)); gr.addColorStop(1, HSL(c[0] - 4, c[1] * 0.95, c[2] * k * 1.22));
    g.fillStyle = gr; g.fill();
    g.lineWidth = Math.max(0.6, W * 0.1); g.strokeStyle = HSL(c[0], c[1], c[2] * k * 0.55, 0.5); g.stroke();
    if (L > 6) { g.lineWidth = Math.max(0.5, W * 0.08); g.strokeStyle = HSL(c[0] + 6, c[1] * 0.7, c[2] * k * 1.5, 0.45); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -L * 0.88); g.stroke(); }
    g.restore();
  }
  function curvePts(x0, y0, x1, y1, R, n, bend) {
    const pts = [], dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
    for (let i = 0; i <= n; i++) { const t = i / n, b = Math.sin(t * Math.PI) * bend + (i && i < n ? R.s() * l * 0.02 : 0); pts.push([x0 + dx * t + nx * b, y0 + dy * t + ny * b]); }
    return pts;
  }
  function along(pts, t) {
    const n = pts.length - 1, x = cl(t, 0, 1) * n, i = Math.min(n - 1, Math.floor(x)), f = x - i, a = pts[i], b = pts[i + 1];
    return [lp(a[0], b[0], f), lp(a[1], b[1], f), Math.atan2(b[1] - a[1], b[0] - a[0])];
  }
  function strokePts(g, pts, w0, w1, col) {
    g.strokeStyle = col; g.lineCap = 'round';
    for (let i = 1; i < pts.length; i++) { g.lineWidth = lp(w0, w1, i / pts.length); g.beginPath(); g.moveTo(pts[i - 1][0], pts[i - 1][1]); g.lineTo(pts[i][0], pts[i][1]); g.stroke(); }
  }
  function shuffle(a, R) { for (let i = a.length - 1; i > 0; i--) { const j = (R() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }
  // 넓은 잎 가지 묶음 (아래 가운데가 잎자루 쪽)
  function broadSpray(g, S, R, o) {
    const cx = S / 2, cy = S / 2, rad = S * 0.47, segs = [];
    const main = curvePts(cx, S * 0.995, cx + R.s() * S * 0.08, S * (0.1 + R() * 0.06), R, 6, R.s() * S * 0.05);
    segs.push({ pts: main, w: S * 0.013 });
    const ns = o.side || R.i(4, 6);
    for (let i = 0; i < ns; i++) {
      const t = lp(0.16, 0.82, (i + R() * 0.7) / ns), [px, py, a] = along(main, t), sg = i % 2 ? 1 : -1;
      const aa = a + sg * R.r(0.55, 1.05), len = S * R.r(0.22, 0.36) * (1.05 - t * 0.4);
      segs.push({ pts: curvePts(px, py, px + Math.cos(aa) * len, py + Math.sin(aa) * len, R, 4, sg * S * 0.02), w: S * 0.007 });
    }
    for (const s of segs) strokePts(g, s.pts, s.w, s.w * 0.4, o.twig);
    const L = [];
    for (const s of segs) {
      let t = R.r(0.1, 0.22), sd = R() < 0.5 ? 1 : -1;
      while (t < 0.97) { const [x, y, a] = along(s.pts, t); L.push([x, y, a + sd * R.r(o.la[0], o.la[1]), S * o.L * R.r(0.75, 1.12)]); sd = -sd; t += o.step * R.r(0.75, 1.25); }
      const [x, y, a] = along(s.pts, 1); L.push([x, y, a + R.s() * 0.2, S * o.L * R.r(0.85, 1.15)]);
    }
    shuffle(L, R);
    L.forEach(([x, y, a, l], i) => {
      let ll = l; const ex = x + Math.cos(a) * ll, ey = y + Math.sin(a) * ll, de = Math.hypot(ex - cx, ey - cy);
      if (de > rad) ll *= Math.max(0.35, 1 - (de - rad) / ll);
      drawLeaf(g, x, y, a + Math.PI / 2, ll, ll * o.W, o.shape, R.p(o.col), i < L.length * 0.45 ? R.r(0.68, 0.84) : R.r(0.92, 1.12));
    });
  }
  // 바늘잎 가지 (색 묶음마다 한 번에 긋는다)
  function needleSpray(g, S, R, o) {
    const cx = S / 2, tw = [];
    const main = curvePts(cx, S * 0.995, cx + R.s() * S * 0.05, S * 0.06, R, 6, R.s() * S * 0.04);
    tw.push({ pts: main, w: S * 0.011 });
    const ns = o.side || 7;
    for (let i = 0; i < ns; i++) {
      const t = lp(0.1, 0.85, (i + R() * 0.6) / ns), [px, py, a] = along(main, t), sg = i % 2 ? 1 : -1;
      const aa = a + sg * R.r(o.sa[0], o.sa[1]), len = S * R.r(0.24, 0.36) * (1.05 - t * 0.55);
      const pts = curvePts(px, py, px + Math.cos(aa) * len, py + Math.sin(aa) * len, R, 4, sg * S * 0.015);
      tw.push({ pts, w: S * 0.006 });
      if (o.sub) for (let j = 0; j < 2; j++) { const [qx, qy, qa] = along(pts, R.r(0.3, 0.7)), ab = qa + (j ? 1 : -1) * R.r(0.6, 0.9), l2 = len * R.r(0.3, 0.45); tw.push({ pts: curvePts(qx, qy, qx + Math.cos(ab) * l2, qy + Math.sin(ab) * l2, R, 3, 0), w: S * 0.004 }); }
    }
    for (const s of tw) strokePts(g, s.pts, s.w, s.w * 0.5, o.twig);
    const B = o.col.map(() => new Path2D());
    for (const s of tw) {
      let len = 0; const cum = [0];
      for (let i = 1; i < s.pts.length; i++) { len += Math.hypot(s.pts[i][0] - s.pts[i - 1][0], s.pts[i][1] - s.pts[i - 1][1]); cum.push(len); }
      for (let d = 0; d < len; d += S * o.ds * R.r(0.7, 1.3)) {
        const [x, y, a] = along(s.pts, d / len), tp = 1 - 0.45 * (d / len);
        for (const sg of [-1, 1]) {
          const na = a + sg * R.r(o.na[0], o.na[1]), nl = S * o.nl * R.r(0.75, 1.2) * tp, b = B[(R() * B.length) | 0];
          b.moveTo(x, y); b.lineTo(x + Math.cos(na) * nl, y + Math.sin(na) * nl);
        }
      }
    }
    g.lineCap = 'round'; g.lineWidth = S * o.nw;
    o.col.forEach((c, i) => { g.strokeStyle = HSL(c[0], c[1], c[2]); g.stroke(B[i]); });
  }
  const TWIG = '#4a3b2b';
  const DRAW = [
    (g, S, R) => broadSpray(g, S, R, { shape: 'oak', L: 0.17, W: 0.37, step: 0.15, la: [0.6, 1.1], twig: TWIG, col: [[78, 36, 27], [73, 38, 30], [83, 34, 23], [70, 30, 26], [86, 38, 31]] }),
    (g, S, R) => broadSpray(g, S, R, { shape: 'ovate', L: 0.14, W: 0.34, step: 0.12, la: [0.7, 1.15], twig: '#5a4a3a', col: [[80, 40, 30], [76, 42, 34], [84, 38, 26], [72, 36, 31]] }),
    (g, S, R) => broadSpray(g, S, R, { shape: 'birch', L: 0.1, W: 0.4, step: 0.085, la: [0.6, 1.1], twig: '#3a2e26', side: R.i(5, 7), col: [[74, 44, 35], [70, 42, 39], [79, 40, 31], [67, 38, 34]] }),
    (g, S, R) => { // 버드나무: 늘어진 줄기 (카드가 세로로 4배 늘어나므로 잎을 납작하게 그린다)
      for (let k = 0; k < 6; k++) {
        const x0 = S * lp(0.18, 0.82, (k + R()) / 6), pts = curvePts(x0, S * 0.995, x0 + R.s() * S * 0.12, S * 0.01, R, 8, R.s() * S * 0.06);
        strokePts(g, pts, S * 0.006, S * 0.003, '#5a5a3a');
        let sd = 1;
        for (let t = 0.02; t < 1; t += R.r(0.01, 0.018)) {
          const [x, y, a] = along(pts, t), la = a + sd * R.r(0.15, 0.45);
          drawLeaf(g, x, y, la + Math.PI / 2, S * R.r(0.045, 0.06), S * 0.013, 'lance', R.p([[82, 20, 40], [78, 22, 36], [86, 18, 46], [90, 14, 52]]), R.r(0.8, 1.12)); sd = -sd;
        }
      }
    },
    (g, S, R) => needleSpray(g, S, R, { side: 7, sa: [0.75, 1.05], sub: true, ds: 0.0045, na: [0.45, 0.85], nl: 0.055, nw: 0.0045, twig: '#4a3626', col: [[118, 24, 18], [112, 22, 22], [124, 26, 15], [106, 20, 25]] }),
    (g, S, R) => needleSpray(g, S, R, { side: 7, sa: [0.8, 1.1], sub: true, ds: 0.006, na: [1.15, 1.45], nl: 0.045, nw: 0.0075, twig: '#4a2e22', col: [[112, 30, 13], [106, 28, 17], [118, 30, 11], [100, 26, 20]] }),
    (g, S, R) => broadSpray(g, S, R, { shape: 'round', L: 0.085, W: 0.42, step: 0.07, la: [0.6, 1.2], twig: '#3e3226', side: 6, col: [[86, 32, 26], [80, 34, 30], [92, 30, 22], [76, 30, 24]] }),
    (g, S, R) => { // 산울타리: 작은 잎이 빽빽하게, 가장자리는 들쭉날쭉
      const cx = S / 2, cy = S / 2;
      g.fillStyle = HSL(95, 30, 13); g.beginPath();
      for (let i = 0; i <= 48; i++) { const a = i / 48 * TAU, r = S * (0.36 + 0.05 * Math.sin(a * 5 + 1) + 0.02 * R.s()); i ? g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r) : g.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
      g.fill();
      const n = Math.round(S * 1.5);
      for (let i = 0; i < n; i++) { const a = R() * TAU, r = S * 0.46 * Math.sqrt(R()), L = S * R.r(0.045, 0.075); drawLeaf(g, cx + Math.cos(a) * r, cy + Math.sin(a) * r, R() * TAU, L, L * 0.42, 'ovate', R.p([[92, 32, 22], [98, 30, 19], [86, 34, 25], [100, 28, 16]]), i < n * 0.4 ? R.r(0.62, 0.82) : R.r(0.9, 1.15)); }
    },
    (g, S, R) => { // 담쟁이: 줄기를 따라 손바닥 모양 잎
      const pts = curvePts(S * 0.5, S * 0.995, S * (0.5 + R.s() * 0.15), S * 0.04, R, 7, S * 0.12);
      strokePts(g, pts, S * 0.012, S * 0.006, '#4a4030');
      let sd = 1;
      for (let t = 0.08; t < 0.98; t += R.r(0.13, 0.18)) {
        const [x, y, a] = along(pts, t), pa = a + sd * R.r(0.7, 1.1), pl = S * R.r(0.04, 0.07), lx = x + Math.cos(pa) * pl, ly = y + Math.sin(pa) * pl;
        strokePts(g, [[x, y], [lx, ly]], S * 0.006, S * 0.005, '#4a5030');
        const L = S * R.r(0.13, 0.19), c = R.p([[100, 34, 19], [95, 32, 23], [106, 30, 16], [92, 30, 21]]), k = R.r(0.85, 1.12), la = pa + R.s() * 0.4 + Math.PI / 2;
        for (const [da, f] of [[-0.95, 0.66], [0.95, 0.66], [0, 1]]) drawLeaf(g, lx, ly, la + da, L * f, L * f * 0.5, 'ovate', c, k);
        sd = -sd;
      }
    },
    (g, S, R) => { // 고사리 잎 (카드가 세로로 3배 늘어난다)
      const rach = curvePts(S * 0.5, S * 0.995, S * (0.5 + R.s() * 0.03), S * 0.02, R, 6, S * 0.02);
      strokePts(g, rach, S * 0.012, S * 0.004, '#5a5a32');
      const np = 18;
      for (let i = 0; i < np; i++) {
        const t = (i + 0.6) / np, [x, y, a] = along(rach, t), Lp = S * 0.46 * Math.pow(Math.sin(Math.PI * (0.1 + 0.9 * t)), 0.75) * (1 - 0.35 * t);
        for (const sg of [-1, 1]) {
          const pa = a + sg * R.r(1.25, 1.42), c = R.p([[82, 40, 30], [78, 42, 34], [86, 38, 26], [74, 38, 28]]), k = R.r(0.82, 1.1), np2 = 9;
          for (let j = 0; j < np2; j++) {
            const s = (j + 0.5) / np2, px = x + Math.cos(pa) * Lp * s, py = y + Math.sin(pa) * Lp * s, rx = Lp / np2 * 0.85 * (1.1 - s * 0.6);
            g.fillStyle = HSL(c[0], c[1], c[2] * k * (0.85 + 0.25 * s)); g.beginPath(); g.ellipse(px, py, rx, rx * 0.42, pa + 1.2, 0, TAU); g.fill();
          }
        }
      }
    },
    (g, S, R) => { // 꽃밭 바닥 잎
      for (let i = 0; i < 10; i++) { const L = S * R.r(0.45, 0.85); drawLeaf(g, S * (0.5 + R.s() * 0.08), S * 0.995, R.s() * 1.0, L, L * 0.13, 'lance', R.p([[88, 34, 28], [84, 36, 32], [92, 30, 24]]), R.r(0.8, 1.1)); }
    },
    (g, S, R) => { // 이삭 꽃 (라벤더·히스·루핀): 회백색으로 그리고 정점색으로 물들인다
      for (let k = 0; k < 7; k++) {
        const x0 = S * (0.5 + R.s() * 0.12), a = -Math.PI / 2 + R.s() * 0.35, len = S * R.r(0.65, 0.95), x1 = x0 + Math.cos(a) * len, y1 = S + Math.sin(a) * len;
        const pts = curvePts(x0, S * 0.995, x1, y1, R, 5, R.s() * S * 0.03);
        strokePts(g, pts, S * 0.008, S * 0.004, HSL(90, 14, 52));
        for (let t = 0.42; t < 1; t += 0.035) { const [x, y] = along(pts, t), r = S * 0.017 * (1.25 - t * 0.6); for (const sg of [-1, 1]) { g.fillStyle = HSL(0, 0, R.r(76, 92)); g.beginPath(); g.ellipse(x + sg * r * 0.9, y, r, r * 0.8, 0, 0, TAU); g.fill(); } }
      }
    },
    (g, S, R) => { // 풀 포기
      for (let i = 0; i < 34; i++) {
        const x0 = S * (0.5 + R.s() * 0.1), a = -Math.PI / 2 + R.s() * 0.9, len = S * R.r(0.5, 0.95), x1 = x0 + Math.cos(a) * len, y1 = S + Math.sin(a) * len, w = S * R.r(0.008, 0.014);
        const gr = g.createLinearGradient(x0, S, x1, y1); gr.addColorStop(0, HSL(80, 35, 14)); gr.addColorStop(1, HSL(R.r(62, 80), 38, R.r(38, 50)));
        g.fillStyle = gr; g.beginPath(); g.moveTo(x0 - w, S); g.quadraticCurveTo((x0 + x1) / 2 + R.s() * S * 0.05, (S + y1) / 2, x1, y1); g.quadraticCurveTo((x0 + x1) / 2, (S + y1) / 2, x0 + w, S); g.fill();
      }
    },
    (g, S, R) => broadSpray(g, S, R, { shape: 'oak', L: 0.15, W: 0.36, step: 0.13, la: [0.6, 1.1], twig: TWIG, side: 6, col: [[76, 34, 25], [80, 38, 29], [72, 32, 23], [84, 36, 28]] }),
    (g, S, R) => needleSpray(g, S, R, { side: 5, sa: [0.35, 0.6], sub: false, ds: 0.005, na: [0.5, 0.9], nl: 0.06, nw: 0.0045, twig: '#4a3626', col: [[116, 22, 17], [110, 20, 21], [122, 24, 14]] }),
    (g, S) => { g.fillStyle = '#fff'; g.fillRect(0, 0, S, S); },
  ];
  let ATL = null;
  function atlas() {
    if (ATL) return ATL;
    const N = isMob() ? 1024 : 2048, S = N / 4;
    const cv = document.createElement('canvas'); cv.width = cv.height = N;
    const g = cv.getContext('2d', { willReadFrequently: true });
    F._atlasMs = [];
    for (let t = 0; t < 16; t++) { const t0 = performance.now(); g.save(); g.translate((t % 4) * S, ((t / 4) | 0) * S); g.beginPath(); g.rect(0, 0, S, S); g.clip(); DRAW[t](g, S, rng(1000 + t * 77)); g.restore(); F._atlasMs.push(Math.round(performance.now() - t0)); }
    const d = g.getImageData(0, 0, N, N).data;
    bleed(d, N, S);
    const out = new Uint8Array(N * N * 4);
    for (let y = 0; y < N; y++) out.set(d.subarray((N - 1 - y) * N * 4, (N - y) * N * 4), y * N * 4);
    const tex = new T.DataTexture(out, N, N, T.RGBAFormat);
    tex.encoding = T.sRGBEncoding; tex.generateMipmaps = true; tex.minFilter = T.LinearMipmapLinearFilter; tex.magFilter = T.LinearFilter; tex.anisotropy = 4; tex.needsUpdate = true;
    return (ATL = { tex, N, S });
  }
  // 투명한 칸에 가까운 잎 색을 채운다 (8×8 블록 평균, 칸 경계는 넘지 않는다)
  function bleed(d, N, S) {
    const B = 8, nb = N / B, tb = S / B, acc = new Float32Array(nb * nb * 4);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = (y * N + x) * 4; if (d[i + 3] < 120) continue;
      const k = (((y / B) | 0) * nb + ((x / B) | 0)) * 4; acc[k] += d[i]; acc[k + 1] += d[i + 1]; acc[k + 2] += d[i + 2]; acc[k + 3]++;
    }
    for (let k = 0; k < acc.length; k += 4) if (acc[k + 3]) { acc[k] /= acc[k + 3]; acc[k + 1] /= acc[k + 3]; acc[k + 2] /= acc[k + 3]; acc[k + 3] = 1; }
    for (let pass = 0; pass < 24; pass++) {
      const nx = acc.slice(); let any = false;
      for (let by = 0; by < nb; by++) for (let bx = 0; bx < nb; bx++) {
        const k = (by * nb + bx) * 4; if (acc[k + 3]) continue;
        let r = 0, gg = 0, b = 0, c = 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ax = bx + dx, ay = by + dy;
          if (ax < 0 || ay < 0 || ax >= nb || ay >= nb || ((ax / tb) | 0) !== ((bx / tb) | 0) || ((ay / tb) | 0) !== ((by / tb) | 0)) continue;
          const j = (ay * nb + ax) * 4; if (acc[j + 3]) { r += acc[j]; gg += acc[j + 1]; b += acc[j + 2]; c++; }
        }
        if (c) { nx[k] = r / c; nx[k + 1] = gg / c; nx[k + 2] = b / c; nx[k + 3] = 1; any = true; }
      }
      acc.set(nx); if (!any) break;
    }
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = (y * N + x) * 4; if (d[i + 3] >= 120) continue;
      const k = (((y / B) | 0) * nb + ((x / B) | 0)) * 4; if (!acc[k + 3]) continue;
      d[i] = acc[k]; d[i + 1] = acc[k + 1]; d[i + 2] = acc[k + 2];
    }
  }

  // =====================================================================
  // 4. 나무껍질 텍스처 (0.7 m 둘레 × 1.4 m 길이, 이음매 없음) + 노멀
  // =====================================================================
  const BU = 0.7, BV = 1.4, BARKT = {};
  const mixc = (a, b, t) => [lp(a[0], b[0], t), lp(a[1], b[1], t), lp(a[2], b[2], t)];
  function barkTex(kind) {
    if (BARKT[kind]) return BARKT[kind];
    const W = 128, H = 256, hh = new Float32Array(W * H), col = new Uint8Array(W * H * 4);
    const sd = { oak: 11, beech: 23, birch: 37, willow: 41, pine: 53, yew: 61, dead: 71 }[kind] || 11;
    let nk = 2.2;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const u = x / W, v = y / H, i = y * W + x;
      let h, c;
      if (kind === 'beech') {
        const n = pf(u * 4, v * 2, 4, 2, sd, 4), e = pf(u * 5, v * 14, 5, 14, sd + 2, 2), eye = sm(0.66, 0.72, e) * sm(0.4, 0.6, pf(u * 3, v * 3, 3, 3, sd + 3, 2));
        h = 0.5 + (n - 0.5) * 0.3 - eye * 0.25 + (pf(u * 16, v * 8, 16, 8, sd + 1, 2) - 0.5) * 0.08;
        c = mixc([96, 96, 88], [160, 156, 142], sm(0.3, 0.7, n)); c = mixc(c, [70, 68, 62], eye * 0.8);
        c = mixc(c, [92, 108, 70], sm(0.62, 0.78, pf(u * 2, v * 2, 2, 2, sd + 5, 3)) * 0.6); nk = 1.2;
      } else if (kind === 'birch') {
        const n = pf(u * 3, v * 2, 3, 2, sd, 3), len = pf(u * 6, v * 48, 6, 48, sd + 1, 2), lent = sm(0.66, 0.72, len) * sm(0.35, 0.55, pf(u * 12, v * 4, 12, 4, sd + 2, 2));
        const blot = sm(0.7, 0.8, pf(u * 2, v * 3, 2, 3, sd + 3, 4));
        c = mixc([226, 220, 206], [186, 180, 166], sm(0.3, 0.8, n)); c = mixc(c, [210, 168, 130], sm(0.72, 0.85, pf(u * 3, v * 5, 3, 5, sd + 4, 2)) * 0.4);
        c = mixc(c, [48, 42, 38], Math.max(lent, blot * 0.9)); h = 0.6 + n * 0.1 - lent * 0.4 - blot * 0.25; nk = 1.4;
      } else if (kind === 'pine' || kind === 'yew') {
        const w = pf(u * 3, v * 2, 3, 2, sd, 2) - 0.5, pl = pf(u * 5 + w, v * 4, 5, 4, sd + 1, 3), edge = 1 - Math.abs(pl * 2 - 1), gap = sm(0.78, 0.96, edge), n = pf(u * 12, v * 12, 12, 12, sd + 2, 2);
        h = (1 - gap) * (0.6 + 0.4 * n);
        c = kind === 'pine' ? mixc([112, 68, 46], [150, 98, 66], n) : mixc([104, 58, 44], [146, 92, 70], n);
        if (kind === 'yew') c = mixc(c, [112, 98, 90], sm(0.6, 0.75, pf(u * 3, v * 3, 3, 3, sd + 6, 3)) * 0.6);
        c = mixc(c, [40, 28, 22], gap);
      } else if (kind === 'willow' || kind === 'dead' || kind === 'oak') {
        const w = pf(u * 3, v * 2, 3, 2, sd, 2) - 0.5;
        const r1 = pf(u * (kind === 'willow' ? 7 : 8) + w * 1.8, v * 2 + (kind === 'willow' ? w : 0), kind === 'willow' ? 7 : 8, 2, sd + 1, 3);
        let rid = Math.pow(1 - Math.abs(r1 * 2 - 1), 0.75);
        const blk = pf(u * 6, v * 10, 6, 10, sd + 2, 2), crack = sm(0.44, 0.5, blk) * sm(0.56, 0.5, blk);
        h = rid * (1 - crack * 0.6) * 0.85 + pf(u * 32, v * 32, 32, 32, sd + 3, 2) * 0.15;
        if (kind === 'dead') { c = mixc([62, 58, 52], [158, 152, 140], h); }
        else if (kind === 'willow') { c = mixc([40, 35, 29], [104, 96, 80], h); }
        else { c = mixc([40, 31, 24], [102, 88, 70], h); c = mixc(c, [134, 140, 108], sm(0.62, 0.76, pf(u * 4, v * 4, 4, 4, sd + 4, 3)) * sm(0.3, 0.7, h) * 0.6); }
        nk = 3;
      } else { h = 0.5; c = [80, 70, 60]; }
      const j = (pf(u * 24, v * 24, 24, 24, sd + 9, 1) - 0.5) * 16;
      hh[i] = h; col[i * 4] = cl(c[0] + j, 0, 255); col[i * 4 + 1] = cl(c[1] + j, 0, 255); col[i * 4 + 2] = cl(c[2] + j, 0, 255); col[i * 4 + 3] = 255;
    }
    const nm = new Uint8Array(W * H * 4);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = (hh[y * W + (x + W - 1) % W] - hh[y * W + (x + 1) % W]) * nk, dy = (hh[((y + H - 1) % H) * W + x] - hh[((y + 1) % H) * W + x]) * nk, l = Math.hypot(dx, dy, 1), i = (y * W + x) * 4;
      nm[i] = (dx / l * 0.5 + 0.5) * 255; nm[i + 1] = (dy / l * 0.5 + 0.5) * 255; nm[i + 2] = (1 / l * 0.5 + 0.5) * 255; nm[i + 3] = 255;
    }
    const mk = (data, srgb) => { const t = new T.DataTexture(data, W, H, T.RGBAFormat); t.wrapS = t.wrapT = T.RepeatWrapping; t.generateMipmaps = true; t.minFilter = T.LinearMipmapLinearFilter; t.magFilter = T.LinearFilter; t.anisotropy = 4; t.encoding = srgb ? T.sRGBEncoding : T.LinearEncoding; t.repeat.set(1 / BU, 1 / BV); t.needsUpdate = true; return t; };
    return (BARKT[kind] = { map: mk(col, true), nrm: mk(nm, false) });
  }
  let ROCKT = null;
  function rockTex() {
    if (ROCKT) return ROCKT;
    const W = 128, d = new Uint8Array(W * W * 4);
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
      const u = x / W, v = y / W, n = pf(u * 4, v * 4, 4, 4, 3, 5), cr = 1 - Math.abs(pf(u * 5, v * 5, 5, 5, 5, 3) * 2 - 1), crack = sm(0.9, 0.97, cr);
      const val = cl(0.42 + (n - 0.5) * 0.9 - crack * 0.3 + (pf(u * 32, v * 32, 32, 32, 7, 1) - 0.5) * 0.12, 0, 1) * 255, i = (y * W + x) * 4;
      d[i] = d[i + 1] = d[i + 2] = val; d[i + 3] = 255;
    }
    const t = new T.DataTexture(d, W, W, T.RGBAFormat); t.wrapS = t.wrapT = T.RepeatWrapping; t.generateMipmaps = true; t.minFilter = T.LinearMipmapLinearFilter; t.magFilter = T.LinearFilter; t.needsUpdate = true;
    return (ROCKT = t);
  }

  // =====================================================================
  // 5. 셰이더 조각 (MeshStandardMaterial을 고쳐 쓴다: 안개·그림자·환경광은 그대로)
  // =====================================================================
  const GLV = `
uniform float uT;
uniform vec4 floraWind;
vec3 floraToLocal( vec3 w ) {
#ifdef USE_INSTANCING
	mat3 fm = mat3( instanceMatrix );
	return vec3( dot( fm[ 0 ], w ) / dot( fm[ 0 ], fm[ 0 ] ), dot( fm[ 1 ], w ) / dot( fm[ 1 ], fm[ 1 ] ), dot( fm[ 2 ], w ) / dot( fm[ 2 ], fm[ 2 ] ) );
#else
	return w;
#endif
}
vec3 floraSway( vec3 ip, vec3 lp, vec3 f, float leaf ) {
	vec2 wd = floraWind.xy; float ws = floraWind.z;
	float ph = dot( ip.xz, vec2( 0.073, 0.051 ) );
	float gust = 0.5 + 0.5 * sin( uT * 0.45 - dot( ip.xz, wd ) * 0.04 ) * sin( uT * 0.19 + ph * 0.7 );
	float s = ws * ( 0.3 + 0.7 * gust );
	vec3 w3 = vec3( wd.x, 0.0, wd.y );
	vec3 o = w3 * f.x * s * ( 0.75 + 0.25 * sin( uT * 1.05 + ph * 2.0 ) );
	float q = f.z * 6.2831 + ph * 3.0;
	o += ( vec3( sin( uT * 1.9 + q ), 0.5 * sin( uT * 2.4 + q * 1.7 ), sin( uT * 1.6 + q * 1.3 ) ) + w3 * 0.9 ) * f.y * s;
	if ( leaf > 0.5 ) {
		float lq = dot( lp, vec3( 2.1, 2.7, 1.9 ) ) + q;
		o += vec3( sin( uT * 7.1 + lq ), sin( uT * 6.3 + lq * 1.3 ), cos( uT * 6.7 + lq * 0.7 ) ) * s * ( 0.01 + f.y * 0.12 );
	}
	return o;
}
`;
  const swayV = (leaf, fade) => `#include <begin_vertex>
{
#ifdef USE_INSTANCING
	vec3 fIp = ( modelMatrix * vec4( instanceMatrix[ 3 ].xyz, 1.0 ) ).xyz;
#else
	vec3 fIp = ( modelMatrix * vec4( position, 1.0 ) ).xyz;
#endif
${fade ? '	vFloraD = length( fIp.xz - cameraPosition.xz );' : ''}
	transformed += floraToLocal( floraSway( fIp, position, fw, ${leaf ? '1.0' : '0.0'} ) );
}`;
  const IMP_V = f => `
	vec3 fIp = ( modelMatrix * vec4( instanceMatrix[ 3 ].xyz, 1.0 ) ).xyz;
	vec3 iTc = cameraPosition - fIp; iTc.y = 0.0; iTc = normalize( iTc + vec3( 1e-4, 0.0, 0.0 ) );
	vec3 iRt = vec3( iTc.z, 0.0, - iTc.x );
	float iSx = length( instanceMatrix[ 0 ].xyz ), iSy = length( instanceMatrix[ 1 ].xyz );
	float iY = ( position.y - 0.02 ) * imp.w * iSy;
	vec3 iW = iRt * ( position.x * imp.z * iSx ) + vec3( 0.0, iY, 0.0 );
	iW += floraSway( fIp, iW, vec3( 0.02 * iY * iY / max( imp.w * iSy, 1.0 ), 0.0, 0.0 ), 0.0 );
	vec3 transformed = floraToLocal( iW );
#ifdef USE_UV
	vUv = ( vec2( mod( imp.x, 4.0 ), floor( imp.x * 0.25 + 0.01 ) ) + vec2( imp.y < 0.0 ? 1.0 - uv.x : uv.x, uv.y ) ) * 0.25;
#endif
${f.depth ? '' : '	vImpR = iRt * sign( imp.y ); vImpF = iTc;'}
${f.fade ? '	vFloraD = length( fIp.xz - cameraPosition.xz );' : ''}`;
  const FADE_F = `{
	float fh = fract( 52.9829189 * fract( dot( gl_FragCoord.xy, vec2( 0.06711056, 0.00583715 ) ) ) );
	float fi = smoothstep( floraFade.x, floraFade.y, vFloraD ), fo = 1.0 - smoothstep( floraFade.z, floraFade.w, vFloraD );
	if ( 1.0 - fh > fi || fh >= fo ) discard;
}
#include <clipping_planes_fragment>`;
  // 밉 단계가 깊을수록 알파를 키워 멀리서 잎이 얇아지지 않게 한다
  const ALPHA_F = ts => `#ifdef USE_ALPHATEST
#if defined( USE_MAP ) && ( __VERSION__ >= 300 || defined( GL_OES_standard_derivatives ) )
	{ vec2 fdx = dFdx( vUv * ${ts.toFixed(1)} ), fdy = dFdy( vUv * ${ts.toFixed(1)} ); diffuseColor.a *= 1.0 + max( 0.0, 0.5 * log2( max( dot( fdx, fdx ), dot( fdy, fdy ) ) ) ) * 0.3; }
#endif
	if ( diffuseColor.a < alphaTest ) discard;
#endif`;
  // 해(방향광 0)의 그림자 먹은 색과 방향을 붙잡아 두었다가 역광 투과에 쓴다
  function sunCapture(src) {
    const a = src.indexOf('NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )'), key = 'RE_Direct( directLight, geometry, material, reflectedLight );';
    const b = a < 0 ? -1 : src.indexOf(key, a), head = 'vec3 floraSunC = vec3( 0.0 ); vec3 floraSunL = vec3( 0.0, 1.0, 0.0 );\n';
    if (b < 0) return head + src;
    const e = b + key.length;
    return head + src.slice(0, e) + '\n\t\t#if ( UNROLLED_LOOP_INDEX == 0 )\n\t\tfloraSunC = directLight.color; floraSunL = directLight.direction;\n\t\t#endif\n' + src.slice(e);
  }
  const TRANS_F = k => `
{
	float fb = saturate( - dot( geometry.viewDir, floraSunL ) );
	float ftr = pow( fb, 6.0 ) * 2.2 + fb * fb * 0.4 + saturate( - dot( geometry.normal, floraSunL ) ) * 0.35;
	reflectedLight.directDiffuse += floraSunC * BRDF_Lambert( material.diffuseColor ) * ftr * ${k} * vec3( 1.0, 0.95, 0.6 );
}`;
  const IMP_MAP = `#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vUv );
	sampledDiffuseColor.rgb *= sampledDiffuseColor.rgb;
	diffuseColor *= sampledDiffuseColor;
#endif`;
  const IMP_NRM = `float faceDirection = 1.0;
	vec4 fIn = texture2D( impN, vUv );
	vec3 fNl = fIn.xyz * 2.0 - 1.0;
	vec3 normal = normalize( ( viewMatrix * vec4( normalize( vImpR * fNl.x + vec3( 0.0, fNl.y, 0.0 ) + vImpF * fNl.z + 1e-5 ), 0.0 ) ).xyz );
	vec3 geometryNormal = normal;
	float floraLeafK = fIn.a;`;
  const BUMP = `
vec3 floraBump( vec3 sp, vec3 sn, vec2 dH ) {
#if __VERSION__ >= 300 || defined( GL_OES_standard_derivatives )
	vec3 sx = dFdx( sp ), sy = dFdy( sp ), r1 = cross( sy, sn ), r2 = cross( sn, sx );
	float det = dot( sx, r1 );
	return normalize( abs( det ) * sn - sign( det ) * ( dH.x * r1 + dH.y * r2 ) );
#else
	return sn;
#endif
}`;
  function patch(m, f) {
    const ts = f.imp ? IMP.N : atlas().N;
    const key = 'flora' + (f.leaf ? 'L' : '') + (f.fade ? 'F' : '') + (f.imp ? 'I' : '') + (f.depth ? 'D' : '') + (f.rock ? 'R' : '') + ts;
    m.customProgramCacheKey = () => key;
    m.onBeforeCompile = sh => {
      sh.uniforms.uT = F.timeU; sh.uniforms.floraWind = F.windU;
      if (f.fade) sh.uniforms.floraFade = m.userData.fade;
      if (f.imp) { sh.uniforms.impN = IMP.nU; sh.uniforms.floraSunW = F.sunW; }
      if (f.rock) sh.uniforms.rockD = { value: rockTex() };
      let vs = sh.vertexShader, fs = sh.fragmentShader;
      vs = vs.replace('#include <common>', '#include <common>\n' + GLV + (f.imp ? 'attribute vec4 imp;\nuniform vec3 floraSunW;\n' + (f.depth ? '' : 'varying vec3 vImpR;\nvarying vec3 vImpF;\n') : f.rock ? 'varying vec3 vRkP;\nvarying vec3 vRkN;\n' : 'attribute vec3 fw;\n') + (f.fade ? 'varying float vFloraD;\n' : ''));
      if (f.imp) {
        vs = vs.replace('#include <begin_vertex>', IMP_V(f));
        if (!f.depth) vs = vs.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n\tworldPosition.xyz += floraSunW * imp.z * 0.45;');
      } else if (f.rock) {
        vs = vs.replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef USE_INSTANCING
	vRkP = ( modelMatrix * instanceMatrix * vec4( position, 1.0 ) ).xyz; vRkN = normalize( mat3( modelMatrix ) * mat3( instanceMatrix ) * normal );
#else
	vRkP = ( modelMatrix * vec4( position, 1.0 ) ).xyz; vRkN = normalize( mat3( modelMatrix ) * normal );
#endif
${f.fade ? '#ifdef USE_INSTANCING\n\tvFloraD = length( ( modelMatrix * vec4( instanceMatrix[ 3 ].xyz, 1.0 ) ).xz - cameraPosition.xz );\n#else\n\tvFloraD = 0.0;\n#endif' : ''}`);
      } else vs = vs.replace('#include <begin_vertex>', swayV(f.leaf, f.fade));
      if (!f.depth) {
        fs = fs.replace('#include <common>', '#include <common>\n' + (f.fade ? 'uniform vec4 floraFade;\nvarying float vFloraD;\n' : '') + (f.imp ? 'uniform sampler2D impN;\nvarying vec3 vImpR;\nvarying vec3 vImpF;\n' : '') + (f.rock ? 'uniform sampler2D rockD;\nvarying vec3 vRkP;\nvarying vec3 vRkN;\n' + BUMP : ''));
        if (f.fade) fs = fs.replace('#include <clipping_planes_fragment>', FADE_F);
        if (f.leaf || f.imp) fs = fs.replace('#include <alphatest_fragment>', ALPHA_F(ts));
        if (f.imp) { fs = fs.replace('#include <map_fragment>', IMP_MAP); fs = fs.replace('#include <normal_fragment_begin>', IMP_NRM); }
        else if (f.leaf) fs = fs.replace('#include <normal_fragment_begin>', T.ShaderChunk.normal_fragment_begin.replace('normal = normal * faceDirection;', ''));
        if (f.leaf || f.imp) fs = fs.replace('#include <lights_fragment_begin>', sunCapture(T.ShaderChunk.lights_fragment_begin) + TRANS_F(f.imp ? 'floraLeafK' : '1.0'));
        if (f.rock) {
          fs = fs.replace('#include <color_fragment>', `#include <color_fragment>
	vec3 rkB = pow( abs( normalize( vRkN ) ), vec3( 4.0 ) ); rkB /= dot( rkB, vec3( 1.0 ) );
	float rkH = texture2D( rockD, vRkP.zy * 0.42 ).r * rkB.x + texture2D( rockD, vRkP.xz * 0.42 ).r * rkB.y + texture2D( rockD, vRkP.xy * 0.42 ).r * rkB.z;
	rkH = rkH * 0.7 + 0.3 * ( texture2D( rockD, vRkP.zy * 1.7 ).r * rkB.x + texture2D( rockD, vRkP.xz * 1.7 ).r * rkB.y + texture2D( rockD, vRkP.xy * 1.7 ).r * rkB.z );
	diffuseColor.rgb *= 0.55 + 1.05 * rkH;`);
          fs = fs.replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n\tnormal = floraBump( - vViewPosition, normal, vec2( dFdx( rkH ), dFdy( rkH ) ) * 1.6 );');
        }
      }
      sh.vertexShader = vs; sh.fragmentShader = fs;
    };
    return m;
  }
  // 재질 (같은 종류·같은 LOD 경계는 공유)
  const MATS = new Map();
  const fadeKey = fv => fv ? fv.join(',') : '-';
  function fadeU(fv) { return { value: fv ? new T.Vector4(...fv) : new T.Vector4(-2, -1, 1e7, 1e7 + 1) }; }
  function leafMat(fv) {
    const k = 'leaf|' + fadeKey(fv); let m = MATS.get(k); if (m) return m;
    m = new T.MeshStandardMaterial({ map: atlas().tex, alphaTest: 0.42, side: T.DoubleSide, vertexColors: true, roughness: 0.8, metalness: 0, envMapIntensity: 0.85 });
    m.userData.fade = fadeU(fv); patch(m, { leaf: 1, fade: !!fv }); MATS.set(k, m); return m;
  }
  function barkMat(kind, fv) {
    const k = 'bark|' + kind + '|' + fadeKey(fv); let m = MATS.get(k); if (m) return m;
    const bt = barkTex(kind);
    m = new T.MeshStandardMaterial({ map: bt.map, normalMap: bt.nrm, normalScale: new T.Vector2(1, 1), vertexColors: true, roughness: 0.92, metalness: 0 });
    m.userData.fade = fadeU(fv); patch(m, { fade: !!fv }); MATS.set(k, m); return m;
  }
  function rockMat(fv) {
    const k = 'rock|' + fadeKey(fv); let m = MATS.get(k); if (m) return m;
    m = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 });
    m.userData.fade = fadeU(fv); patch(m, { rock: 1, fade: !!fv }); MATS.set(k, m); return m;
  }
  function depthMat(kind) {
    const k = 'depth|' + kind; let m = MATS.get(k); if (m) return m;
    m = new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking });
    patch(m, { depth: 1, leaf: kind === 'leaf' ? 1 : 0, imp: kind === 'imp' ? 1 : 0 }); MATS.set(k, m); return m;
  }
  F.materials = { leaf: leafMat, bark: barkMat, rock: rockMat, atlas: () => atlas().tex, bark_tex: barkTex };

  // =====================================================================
  // 6. 나무 뼈대 (재귀로 자라는 가지) → 관 형상 + 잎 카드
  // =====================================================================
  function perpTo(d) { return V().crossVectors(d, Math.abs(d.y) < 0.95 ? UP : V(1, 0, 0)).normalize(); }
  function spread(d, a, az) { const s = perpTo(d).applyAxisAngle(d, az); return d.clone().applyAxisAngle(s, a); }
  function branch(S, p0, dir, len, r0, r1, depth, o, R) {
    const n = Math.max(2, Math.ceil(len / (o.seg || 0.6))), dl = len / n;
    const br = { p: [p0.clone()], r: [r0], f: [o.f0 || 0], depth, ph: o.ph ?? R(), len, root: !!o.root };
    const d = dir.clone().normalize(), p = p0.clone(), w = V(), out = V();
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      if (o.wob) { w.set(R.s(), R.s() * 0.5, R.s()).multiplyScalar(o.wob); d.add(w).normalize(); }
      if (o.trop) { d.y += o.trop * dl; d.normalize(); }
      if (o.out) { out.set(p.x, 0, p.z); const l = out.length(); if (l > 0.01) { d.addScaledVector(out, o.out * dl / l); d.normalize(); } }
      p.addScaledVector(d, dl);
      br.p.push(p.clone()); br.r.push(lp(r0, r1, Math.pow(t, o.rp || 1))); br.f.push(lp(o.f0 || 0, o.f1 ?? (o.f0 || 0), t));
    }
    S.br.push(br);
    return br;
  }
  function at(br, t) {
    const n = br.p.length - 1, x = cl(t, 0, 1) * n, i = Math.min(n - 1, Math.floor(x)), f = x - i;
    return { p: br.p[i].clone().lerp(br.p[i + 1], f), d: br.p[i + 1].clone().sub(br.p[i]).normalize(), r: lp(br.r[i], br.r[i + 1], f), f: lp(br.f[i], br.f[i + 1], f) };
  }
  // 넓은잎 나무 (참나무·너도밤나무·죽은 나무): 줄기 → 큰 가지 3~7(덩어리) → 가지 → 잔가지 + 잎
  function broad(S, R, P) {
    const H = S.H = R.r(P.H[0], P.H[1]), r0 = S.trunkR = H * P.r0 * R.r(0.9, 1.1), tl = H * R.r(P.tl[0], P.tl[1]);
    const trunk = branch(S, V(0, -0.3, 0), V(R.s() * 0.07, 1, R.s() * 0.07), tl + 0.3, r0 * 1.05, r0 * 0.75, 0, { seg: 0.7, wob: P.wob[0], root: true, f1: 0.01 }, R);
    S.crown = { c: V(0, tl + (H - tl) * 0.5, 0), r: (H - tl) * 0.55 }; S.yr = [tl, H];
    const nL = R.i(P.limbs[0], P.limbs[1]), az0 = R() * TAU;
    for (let k = 0; k < nL; k++) {
      const a = at(trunk, R.r(0.8, 1.0)), az = az0 + k / nL * TAU + R.s() * 0.4;
      const el = k === 0 ? R.r(P.el0[0], P.el0[1]) : R.r(P.el[0], P.el[1]);
      const dir = V(Math.sin(el) * Math.cos(az), Math.cos(el), Math.sin(el) * Math.sin(az));
      let len = H * R.r(P.ll[0], P.ll[1]) * (k === 0 ? 0.9 : 1);
      if (P.trunc && R() < P.trunc) len *= R.r(0.35, 0.7);
      const limb = branch(S, a.p, dir, len, a.r * R.r(0.6, 0.72), a.r * 0.16, 1, { seg: 0.7, wob: P.wob[1], trop: P.trop[1], f0: a.f, f1: a.f + 0.06, ph: R() }, R);
      const lc = at(limb, 0.8).p.lerp(S.crown.c, 0.2); lc.y += H * 0.04;
      const lobe = { c: lc, r: len * 0.5 + 1 };
      const n2 = R.i(P.n2[0], P.n2[1]);
      for (let j = 0; j < n2; j++) {
        const t2 = lp(0.25, 0.98, (j + R()) / n2), b = at(limb, t2);
        const d2 = spread(b.d, R.r(P.a2[0], P.a2[1]), j * 2.4 + R() * 1.2); d2.y += P.up2; d2.normalize();
        let l2 = len * R.r(P.l2[0], P.l2[1]) * (1.15 - t2 * 0.45);
        if (P.trunc && R() < P.trunc * 0.6) l2 *= R.r(0.3, 0.6);
        const b2 = branch(S, b.p, d2, l2, Math.max(0.02, b.r * 0.58), 0.012, 2, { seg: 0.55, wob: P.wob[2], trop: P.trop[2], f0: b.f, f1: b.f + 0.08, ph: limb.ph }, R);
        const n3 = R.i(P.n3[0], P.n3[1]);
        for (let i = 0; i < n3; i++) {
          const t3 = lp(0.3, 1.0, (i + R()) / n3), c = at(b2, t3);
          const d3 = spread(c.d, R.r(P.a3[0], P.a3[1]), i * 2.4 + R() * 6); d3.y += P.up3 ?? 0.1; d3.normalize();
          const l3 = l2 * R.r(P.l3[0], P.l3[1]) * (1.1 - t3 * 0.4);
          const tw = branch(S, c.p, d3, l3, Math.max(0.01, c.r * 0.6), 0.006, 3, { seg: 0.45, wob: P.wob[3], trop: P.trop[3], f0: c.f, f1: c.f + 0.07, ph: limb.ph }, R);
          if (P.leaves) { addCl(S, R, tw, 1.0, lobe, P); if (R() < P.mid) addCl(S, R, tw, 0.5, lobe, P); }
        }
        if (P.leaves) addCl(S, R, b2, 1.0, lobe, P);
      }
    }
  }
  function addCl(S, R, br, t, lobe, P) {
    const a = at(br, t);
    if (Math.hypot(a.p.x, a.p.z) < S.crown.r * 0.2 && a.p.y < S.crown.c.y + S.crown.r * 0.25 && R() < 0.7) return;   // 속은 비운다
    const d = a.d.clone(); d.y += P.lup ?? 0.35; d.normalize();
    S.cl.push({ p: a.p, d, s: R.r(P.ls[0], P.ls[1]), n: P.ln || 2, tile: R.p(P.tile), c: lobe.c, cr: lobe.r, f: a.f + 0.04, ph: R(), roll: R() * TAU });
  }
  const SPEC = {
    oak: (S, R) => broad(S, R, { H: [11.5, 15], r0: 0.034, tl: [0.24, 0.32], limbs: [4, 6], el: [0.6, 1.1], el0: [0.12, 0.35], ll: [0.42, 0.58], n2: [5, 8], a2: [0.5, 0.95], l2: [0.36, 0.52], n3: [3, 5], a3: [0.45, 0.9], l3: [0.3, 0.5], up2: 0.12, wob: [0.05, 0.17, 0.22, 0.26], trop: [0, 0.04, 0.06, 0.1], ls: [1.15, 1.6], ln: 2, tile: [TL.oak, TL.oak2], mid: 0.6, leaves: true }),
    beech: (S, R) => broad(S, R, { H: [14, 18], r0: 0.026, tl: [0.3, 0.38], limbs: [5, 7], el: [0.35, 0.75], el0: [0.05, 0.2], ll: [0.38, 0.52], n2: [6, 9], a2: [0.45, 0.85], l2: [0.34, 0.5], n3: [3, 5], a3: [0.45, 0.85], l3: [0.3, 0.5], up2: 0.18, wob: [0.03, 0.1, 0.16, 0.22], trop: [0, 0.05, 0.06, 0.05], ls: [1.0, 1.4], ln: 2, tile: [TL.beech], mid: 0.7, leaves: true, lup: 0.2 }),
    dead: (S, R) => broad(S, R, { H: [8.5, 12.5], r0: 0.034, tl: [0.25, 0.35], limbs: [3, 5], el: [0.6, 1.25], el0: [0.2, 0.45], ll: [0.38, 0.55], n2: [3, 6], a2: [0.5, 1.0], l2: [0.35, 0.55], n3: [1, 3], a3: [0.5, 1.0], l3: [0.3, 0.5], up2: 0.05, wob: [0.06, 0.26, 0.32, 0.36], trop: [0, 0.03, 0.02, 0.02], trunc: 0.45, leaves: false }),
    birch(S, R) {
      const H = S.H = R.r(11, 15), r0 = S.trunkR = H * 0.016 * R.r(0.9, 1.1);
      const trunk = branch(S, V(0, -0.3, 0), V(R.s() * 0.05, 1, R.s() * 0.05), H + 0.3, r0, 0.025, 0, { seg: 0.8, wob: 0.035, root: true, f1: 0.14 }, R);
      S.crown = { c: V(0, H * 0.62, 0), r: H * 0.32 }; S.yr = [H * 0.3, H];
      const n1 = R.i(15, 21);
      for (let j = 0; j < n1; j++) {
        const t = lp(0.33, 0.95, (j + R()) / n1), b = at(trunk, t), dir = spread(b.d, R.r(0.65, 1.0), j * 2.4 + R.s() * 0.4);
        const l = (H * 0.3 * Math.pow(1 - t, 0.6) + 0.8) * R.r(0.8, 1.15);
        const br = branch(S, b.p, dir, l, Math.max(0.018, b.r * 0.42), 0.008, 1, { seg: 0.5, wob: 0.12, trop: -0.04, f0: b.f, f1: b.f + 0.1, ph: R() }, R);
        const lobe = { c: at(br, 0.7).p.lerp(S.crown.c, 0.5), r: l * 0.6 + 0.8 };
        const n2 = R.i(3, 5);
        for (let i = 0; i < n2; i++) {
          const c = at(br, lp(0.25, 1.0, (i + R()) / n2)), d2 = spread(c.d, R.r(0.5, 0.9), i * 2.4 + R() * 3);
          const tw = branch(S, c.p, d2, R.r(0.7, 1.4), Math.max(0.008, c.r * 0.6), 0.004, 2, { seg: 0.35, wob: 0.15, trop: -0.55, f0: c.f, f1: c.f + 0.1, ph: br.ph }, R);
          for (const tt of [0.45, 1.0]) { const a = at(tw, tt); S.cl.push({ p: a.p, d: a.d.clone().lerp(UP, 0.15).normalize(), s: R.r(0.75, 1.0), n: 2, tile: TL.birch, c: lobe.c, cr: lobe.r, f: a.f + 0.05, ph: R(), roll: R() * TAU }); }
        }
      }
    },
    willow(S, R) {
      const H = S.H = R.r(9, 12), r0 = S.trunkR = H * 0.042, tl = R.r(1.8, 2.8);
      const trunk = branch(S, V(0, -0.3, 0), V(R.s() * 0.2, 1, R.s() * 0.2), tl + 0.3, r0 * 1.1, r0 * 0.8, 0, { seg: 0.6, wob: 0.06, root: true }, R);
      S.crown = { c: V(0, H * 0.55, 0), r: H * 0.55 }; S.yr = [0.5, H];
      const nL = R.i(4, 6), az0 = R() * TAU;
      for (let k = 0; k < nL; k++) {
        const a = at(trunk, R.r(0.75, 1)), az = az0 + k / nL * TAU + R.s() * 0.4, el = R.r(0.3, 0.75);
        const len = H * R.r(0.5, 0.65), limb = branch(S, a.p, V(Math.sin(el) * Math.cos(az), Math.cos(el), Math.sin(el) * Math.sin(az)), len, a.r * 0.62, a.r * 0.2, 1, { seg: 0.6, wob: 0.1, trop: 0.03, f0: a.f, f1: 0.06, ph: R() }, R);
        const n2 = R.i(5, 8);
        for (let j = 0; j < n2; j++) {
          const b = at(limb, lp(0.35, 1, (j + R()) / n2)), d2 = spread(b.d, R.r(0.6, 1.1), j * 2.4 + R() * 2); d2.y += 0.25; d2.normalize();
          const b2 = branch(S, b.p, d2, R.r(2.2, 3.8), Math.max(0.015, b.r * 0.5), 0.008, 2, { seg: 0.4, wob: 0.08, trop: -0.32, out: 0.15, f0: b.f, f1: b.f + 0.12, ph: limb.ph }, R);
          for (let tt = 0.25; tt <= 1.0; tt += R.r(0.12, 0.2)) {
            const c = at(b2, tt), hang = R.r(1.5, 3.4) * Math.min(1, (c.p.y - 0.3) / 3.4);
            if (hang < 0.6) continue;
            S.cl.push({ p: c.p, d: V(R.s() * 0.08, -1, R.s() * 0.08).normalize(), s: hang, w: 0.6 / hang, n: 2, tile: TL.willow, c: V(0, c.p.y, 0), cr: S.crown.r, f: c.f, ph: R(), roll: R() * TAU, rows: 3, hf: 0.35, back: 0.03, hang: 1 });
          }
        }
      }
    },
    pine(S, R) {
      const H = S.H = R.r(14, 19), r0 = S.trunkR = H * 0.021, Rc = H * R.r(0.19, 0.25), y0 = R.r(1.0, 2.2);
      const trunk = branch(S, V(0, -0.3, 0), V(R.s() * 0.02, 1, R.s() * 0.02), H + 0.3, r0 * 1.1, 0.02, 0, { seg: 1.0, wob: 0.012, root: true, f1: 0.16 }, R);
      S.crown = { c: V(0, H * 0.45, 0), r: Rc }; S.yr = [y0, H];
      let y = y0;
      while (y < H - 0.5) {
        const rel = cl((H - y) / (H - y0), 0, 1), b = at(trunk, (y + 0.3) / (H + 0.3));
        const Lb = (Rc * Math.pow(rel, 0.85) + 0.3) * R.r(0.85, 1.15), nW = R.i(4, 6), az0 = R() * TAU;
        for (let k = 0; k < nW; k++) {
          const az = az0 + k / nW * TAU + R.s() * 0.35, pitch = -lp(0.08, 0.6, rel) + R.s() * 0.08;
          const br = branch(S, b.p, V(Math.cos(pitch) * Math.cos(az), Math.sin(pitch), Math.cos(pitch) * Math.sin(az)), Lb, Math.max(0.012, b.r * 0.32), 0.006, 1, { seg: 0.7, wob: 0.05, trop: lp(0.04, 0.15, rel), f0: b.f, f1: b.f + 0.1 + Lb * 0.02, ph: R() }, R);
          for (let s = 0.12; s < Lb; s += 0.5 * R.r(0.8, 1.2)) {
            const c = at(br, s / Lb), side = V().crossVectors(c.d, UP).normalize(), cc = V(0, c.p.y + 0.8, 0), wf = (0.95 + 0.4 * (1 - s / Lb)) * R.r(0.85, 1.1);
            S.cl.push({ p: c.p, d: c.d, s: R.r(0.65, 0.9), w: wf, n: 2, tile: TL.pine, c: cc, cr: Rc + 1, f: c.f + 0.03, ph: R(), side, rolls: [R.s() * 0.25, 1.0 + R.s() * 0.3], back: 0.45 });
            if (rel > 0.2 && R() < 0.4) S.cl.push({ p: c.p.clone().addScaledVector(side, R.s() * 0.25), d: V(c.d.x * 0.35, -1, c.d.z * 0.35).normalize(), s: R.r(0.45, 0.8), w: 0.9, n: 1, tile: TL.pine2, c: cc, cr: Rc + 1, f: c.f + 0.05, ph: R(), side: V(-side.z, 0, side.x).normalize(), rolls: [0], back: 0.1 });
          }
        }
        y += lp(0.42, 0.75, rel) * R.r(0.85, 1.2);
      }
      const top = at(trunk, 0.97);
      S.cl.push({ p: top.p, d: UP.clone(), s: 1.4, n: 3, tile: TL.pine, c: V(0, top.p.y - 0.8, 0), cr: 1.5, f: top.f, ph: R(), roll: R() * TAU, back: 0.6 });
    },
    yew(S, R) {
      const H = S.H = R.r(7, 10.5), Rm = H * R.r(0.2, 0.27), r0 = S.trunkR = 0.22;
      S.crown = { c: V(0, H * 0.5, 0), r: Rm }; S.yr = [0, H];
      branch(S, V(0, -0.3, 0), UP, 1.2, r0 * 1.1, r0 * 0.85, 0, { seg: 0.6, root: true }, R);
      const nl = R.i(3, 5), leads = [];
      for (let k = 0; k < nl; k++) { const az = k / nl * TAU + R.s() * 0.5, el = R.r(0.05, 0.22); leads.push(branch(S, V(Math.cos(az) * 0.08, 0.6, Math.sin(az) * 0.08), V(Math.sin(el) * Math.cos(az), Math.cos(el), Math.sin(el) * Math.sin(az)), H * R.r(0.8, 0.97) - 0.6, r0 * 0.6, 0.02, 1, { seg: 0.8, wob: 0.04, trop: 0.02, f0: 0, f1: 0.1, ph: R() }, R)); }
      const env = y => Rm * Math.pow(Math.sin(Math.PI * Math.pow(cl(y / H, 0.001, 1), 0.8)), 0.55), s0 = (S.seed % 97) * 3.1;
      const ncl = Math.round(H * Rm * 10);
      for (let i = 0; i < ncl; i++) {
        const y = lp(0.5, H * 0.99, Math.pow(R(), 0.85)), az = R() * TAU;
        let rr = env(y) * (0.72 + 0.5 * fbm3(Math.cos(az) * 1.3 + s0, y * 0.32, Math.sin(az) * 1.3, 5, 3));
        if (rr < 0.25) continue;
        rr *= R.r(0.85, 1.02);
        const p = V(Math.cos(az) * rr, y, Math.sin(az) * rr), ny = y > H * 0.75 ? (y / H - 0.75) * 3.5 : y < H * 0.15 ? -0.6 : 0;
        const nrm = V(Math.cos(az), ny, Math.sin(az)).normalize();
        S.cl.push({ p, d: nrm.clone().multiplyScalar(0.55).add(V(0, 0.85, 0)).normalize(), s: R.r(0.75, 1.1), n: 2, tile: TL.yew, c: V(0, y, 0), cr: rr + 0.1, f: 0.03 + 0.08 * y / H, ph: R(), roll: R() * TAU, back: 0.45 });
        if (i % 3 === 0) { const L = leads[i % nl], a = at(L, cl(y / H, 0.05, 0.95)); branch(S, a.p, p.clone().sub(a.p), a.p.distanceTo(p) * 0.9, 0.035, 0.012, 2, { seg: 0.8, f0: a.f, f1: a.f + 0.03, ph: L.ph }, R); }
      }
    },
    bush(S, R) {
      const H = S.H = R.r(1.0, 1.7), W = H * R.r(0.75, 1.1);
      S.trunkR = 0.06; S.crown = { c: V(0, H * 0.5, 0), r: W }; S.yr = [0, H];
      const ns = R.i(5, 8), til = [TL.bush, TL.bush, TL.oak2];
      for (let k = 0; k < ns; k++) {
        const az = k / ns * TAU + R.s() * 0.5, el = R.r(0.25, 0.75);
        const st = branch(S, V(R.s() * 0.12, -0.1, R.s() * 0.12), V(Math.sin(el) * Math.cos(az), Math.cos(el), Math.sin(el) * Math.sin(az)), H * R.r(0.75, 1.05), 0.03, 0.008, 1, { seg: 0.3, wob: 0.2, trop: 0.1, f0: 0, f1: 0.05, ph: R() }, R);
        const lobe = { c: at(st, 0.7).p.lerp(S.crown.c, 0.5), r: W * 0.7 };
        for (let j = 0, n2 = R.i(2, 4); j < n2; j++) {
          const c = at(st, R.r(0.35, 0.95)), tw = branch(S, c.p, spread(c.d, R.r(0.5, 0.9), j * 2.4 + R() * 3), H * R.r(0.3, 0.5), 0.012, 0.005, 2, { seg: 0.25, wob: 0.25, trop: 0.1, f0: c.f, f1: c.f + 0.04, ph: st.ph }, R);
          for (const tt of [0.55, 1]) { const a = at(tw, tt); S.cl.push({ p: a.p, d: a.d.clone().lerp(UP, 0.3).normalize(), s: R.r(0.45, 0.7), n: 3, tile: R.p(til), c: lobe.c, cr: lobe.r, f: a.f + 0.03, ph: R(), roll: R() * TAU }); }
        }
        const e = at(st, 1); S.cl.push({ p: e.p, d: e.d.clone().lerp(UP, 0.3).normalize(), s: R.r(0.5, 0.7), n: 3, tile: TL.bush, c: lobe.c, cr: lobe.r, f: e.f + 0.03, ph: R(), roll: R() * TAU });
      }
      const nf = Math.round(16 * W * H);
      for (let i = 0; i < nf; i++) {
        const az = R() * TAU, y = H * lp(0.1, 1, Math.pow(R(), 0.8)), q = (y - H * 0.45) / (H * 0.62), rr = W * Math.sqrt(Math.max(0, 1 - q * q)) * R.r(0.72, 1.05);
        const p = V(Math.cos(az) * rr, y, Math.sin(az) * rr), out = V(Math.cos(az), q, Math.sin(az)).normalize();
        S.cl.push({ p, d: out.multiplyScalar(0.5).add(V(0, 0.8, 0)).normalize(), s: R.r(0.45, 0.65), n: 2, tile: TL.bush, c: S.crown.c, cr: W, f: 0.04, ph: R(), roll: R() * TAU, back: 0.45 });
      }
    },
    fern(S, R) {
      S.H = 0.9; S.trunkR = 0; S.crown = { c: V(0, 0.25, 0), r: 0.8 }; S.yr = [0, 1]; S.fronds = [];
      const n = R.i(8, 13), az0 = R() * TAU;
      for (let k = 0; k < n; k++) S.fronds.push({ az: az0 + k / n * TAU + R.s() * 0.3, len: R.r(0.55, 1.05), el: R.r(0.55, 1.15), w: R.r(0.26, 0.34), ph: R(), tw: R.s() * 0.4 });
    },
    reeds(S, R) {
      S.H = 2; S.trunkR = 0; S.crown = { c: V(0, 1, 0), r: 0.5 }; S.yr = [0, 2]; S.blades = []; S.tails = [];
      for (let k = 0, n = R.i(22, 32); k < n; k++) S.blades.push({ x: R.s() * 0.25, z: R.s() * 0.25, h: R.r(1.0, 2.1), az: R() * TAU, lean: R.r(0.08, 0.35), w: R.r(0.022, 0.034), rot: R() * TAU, ph: R() });
      for (let k = 0, n = R.i(2, 5); k < n; k++) S.tails.push({ x: R.s() * 0.18, z: R.s() * 0.18, h: R.r(1.3, 2.1), lx: R.s() * 0.08, lz: R.s() * 0.08, ph: R() });
    },
    flowers(S, R) {
      // 꽃 무리 한 덩이 (지름 ~1.4 m): 바닥 잎 + 꽃대. 색은 변형(seed)마다 하나 (팔레트)
      S.H = 0.6; S.trunkR = 0; S.crown = { c: V(0, 0.2, 0), r: 0.8 }; S.yr = [0, 0.6];
      S.fcol = FLOWER_PAL[S.seed % FLOWER_PAL.length]; S.fspike = ((S.seed / FLOWER_PAL.length) | 0) % 2 === 1;
    },
  };
  // 꽃 색 (차분한 자연색, sRGB)
  const FLOWER_PAL = [0xe8e2d0, 0xd9c25a, 0xa48cb8, 0xc98e9c, 0x7088b8, 0xe6d6a2, 0xb8687a, 0x8e7aa8];
  // 잎 덩어리 AO: 위·바깥은 밝고 아래·안쪽은 어둡다
  function finishAO(S) {
    const [y0, y1] = S.yr;
    for (const c of S.cl) c.ao = lp(0.5, 1.0, sm(y0, y1, c.p.y) * 0.6 + cl(c.p.distanceTo(c.c) / (c.cr || 1), 0, 1) * 0.4);
  }
  const bendW = (y, H) => 0.02 * H * Math.pow(Math.max(0, y) / H, 2);
  function barkCol(kind, y, depth) {
    const ao = lp(0.6, 1.0, sm(-0.3, 1.8, y)) * (depth >= 2 ? 0.92 : 1);
    if (kind === 'birch') { const k = sm(1.6, 0.0, y) * 0.55; return [ao * (1 - k), ao * (1 - k), ao * (1 - k * 0.95)]; }
    if (kind === 'dead' || kind === 'pine') return [ao, ao, ao];
    const m = sm(1.5, 0.2, y) * 0.6;
    return [ao * (1 - 0.32 * m), ao * (1 - 0.12 * m), ao * (1 - 0.48 * m)];
  }
  function tube(gb, br, rad, S, step) {
    const pts = [], rs = [], fl = [], np = br.p.length;
    for (let i = 0; i < np; i += step) { pts.push(br.p[i]); rs.push(br.r[i]); fl.push(br.f[i]); }
    if ((np - 1) % step) { pts.push(br.p[np - 1]); rs.push(br.r[np - 1]); fl.push(br.f[np - 1]); }
    const n = pts.length; if (n < 2) return;
    const C = Math.max(BU, Math.round(TAU * rs[0] / BU) * BU), tg = V(), bn = V(), dir = V(), p = V();
    let N0 = null, vv = 0;
    const base = gb.n;
    for (let i = 0; i < n; i++) {
      if (i === 0) tg.subVectors(pts[1], pts[0]); else if (i === n - 1) tg.subVectors(pts[i], pts[i - 1]); else tg.subVectors(pts[i + 1], pts[i - 1]);
      tg.normalize();
      if (!N0) N0 = perpTo(tg); else N0.addScaledVector(tg, -N0.dot(tg)).normalize();
      bn.crossVectors(tg, N0);
      if (i) vv += pts[i].distanceTo(pts[i - 1]);
      const y = pts[i].y, col = barkCol(S.bark, y, br.depth);
      for (let k = 0; k <= rad; k++) {
        const a = k / rad * TAU;
        dir.copy(N0).multiplyScalar(Math.cos(a)).addScaledVector(bn, Math.sin(a));
        let r = rs[i];
        if (br.root && y < 1.3) r *= 1 + Math.pow(1 - Math.max(0, y) / 1.3, 2.2) * (0.3 + 0.6 * Math.pow(Math.abs(Math.sin(a * 2.5 + br.ph * 6)), 3));
        p.copy(pts[i]).addScaledVector(dir, r);
        gb.v(p, dir, k / rad * C, vv, col, [bendW(p.y, S.H), fl[i], br.ph]);
      }
      if (i) { const a0 = base + (i - 1) * (rad + 1), a1 = base + i * (rad + 1); for (let k = 0; k < rad; k++) gb.q(a0 + k, a0 + k + 1, a1 + k + 1, a1 + k); }
    }
  }
  const _o = V();
  function cards(gb, c, R, S) {
    const [u0, v0, u1, v1] = tileUV(c.tile), d = c.d, n = c.n || 2, rows = c.rows || 1;
    const s0 = c.side ? c.side.clone() : perpTo(d).applyAxisAngle(d, c.roll || 0);
    const jit = 1 + (R() - 0.5) * 0.16, warm = (R() - 0.5) * 0.1;
    const col = [c.ao * jit * (1 + warm), c.ao * jit, c.ao * jit * (1 - warm * 1.5)];
    for (let k = 0; k < n; k++) {
      const roll = c.rolls ? c.rolls[k] : k / n * Math.PI + R.s() * 0.3;
      const ax = s0.clone().applyAxisAngle(d, roll), ay = d.clone();
      if (!c.hang) ay.applyAxisAngle(ax, R.s() * 0.3);
      const s = c.s * (c.hang ? 1 : R.r(0.85, 1.12)), hw = s * 0.5 * (c.w || 1);
      ax.multiplyScalar(hw); ay.multiplyScalar(s);
      const base = c.p.clone().addScaledVector(ay, -(c.back ?? 0.3)), fn = V().crossVectors(ax, ay).normalize(), i0 = gb.n;
      for (let r = 0; r <= rows; r++) {
        const t = r / rows, m = base.clone().addScaledVector(ay, t);
        for (const sg of [-1, 1]) {
          const p = m.clone().addScaledVector(ax, sg);
          _o.subVectors(p, c.c); const ol = _o.length() || 1; _o.divideScalar(ol);
          const nn = fn.clone(); if (nn.dot(_o) < 0) nn.negate();
          nn.lerp(_o, c.bend ?? 0.72).normalize();
          gb.v(p, nn, sg < 0 ? u0 : u1, lp(v0, v1, t), col, [bendW(p.y, S.H), c.f + (c.hf || 0) * t, c.ph]);
        }
        if (r) { const a = i0 + (r - 1) * 2; gb.q(a, a + 1, a + 3, a + 2); }
      }
    }
  }
  // LOD 설정: 관의 둘레 분할(깊이별), LOD1에 남길 가지 깊이, 잎 덩어리를 남길 비율과 키울 배수
  const LODC = {
    oak: { r0: [10, 7, 5, 3], r1: [6, 4, 3], d1: 2, keep: 0.4, grow: 1.5 }, beech: { r0: [10, 7, 5, 3], r1: [6, 4, 3], d1: 2, keep: 0.4, grow: 1.5 },
    dead: { r0: [10, 7, 5, 3], r1: [6, 4, 3], d1: 2, keep: 1, grow: 1 }, birch: { r0: [8, 5, 3], r1: [5, 3], d1: 1, keep: 0.45, grow: 1.45 },
    willow: { r0: [10, 7, 4], r1: [6, 4], d1: 1, keep: 0.55, grow: 1.4 }, pine: { r0: [8, 3], r1: [5], d1: 0, keep: 0.38, grow: 1.55 },
    yew: { r0: [7, 5, 3], r1: [5, 3], d1: 1, keep: 0.45, grow: 1.45 }, bush: { r0: [5, 3, 3], r1: [3], d1: 1, keep: 0.5, grow: 1.4 },
  };
  const BARK_OF = { oak: 'oak', beech: 'beech', dead: 'dead', birch: 'birch', willow: 'willow', pine: 'pine', yew: 'yew', bush: 'oak' };
  function meshTree(S, lod) {
    const L = LODC[S.kind], R = rng(S.seed * 31 + 7 + lod * 1013);
    const gbB = new GB(), gbL = new GB(), rads = lod ? L.r1 : L.r0;
    for (const br of S.br) { if (lod && br.depth > L.d1) continue; tube(gbB, br, rads[Math.min(br.depth, rads.length - 1)], S, lod ? 2 : 1); }
    for (const c of S.cl) {
      if (lod) {
        if (R() > L.keep) continue;
        cards(gbL, c.hang ? Object.assign({}, c, { w: c.w * L.grow }) : Object.assign({}, c, { s: c.s * L.grow, n: Math.min(c.n || 2, 2) }), R, S);
      } else cards(gbL, c, R, S);
    }
    return { bark: gbB.n ? gbB.build() : null, leaf: gbL.n ? gbL.build() : null };
  }
  function meshFern(S) {
    const gb = new GB(), [u0, v0, u1, v1] = tileUV(TL.fern), R = rng(S.seed + 5);
    for (const fr of S.fronds) {
      const d = V(Math.cos(fr.el) * Math.cos(fr.az), Math.sin(fr.el), Math.cos(fr.el) * Math.sin(fr.az)), p = V(0, 0.02, 0), segs = 5, dl = fr.len / segs, i0 = gb.n;
      const k = R.r(0.8, 1.05);
      for (let i = 0; i <= segs; i++) {
        const t = i / segs, side = V().crossVectors(d, UP).normalize().applyAxisAngle(d, fr.tw), fnn = V().crossVectors(side, d).normalize();
        if (fnn.y < 0) fnn.negate();
        const nn = fnn.lerp(UP, 0.45).normalize(), w = fr.len * fr.w * 0.5, ao = lp(0.45, 1, t) * k;
        for (const sg of [-1, 1]) gb.v(p.clone().addScaledVector(side, sg * w), nn, sg < 0 ? u0 : u1, lp(v0, v1, t), [ao, ao, ao * 0.95], [0, 0.015 + 0.09 * t * fr.len, fr.ph]);
        if (i) { const a = i0 + (i - 1) * 2; gb.q(a, a + 1, a + 3, a + 2); }
        p.addScaledVector(d, dl); d.y -= 0.55 / segs; d.normalize();
      }
    }
    return { bark: null, leaf: gb.build() };
  }
  function strip(gb, pts, w0, w1, rotY, cols, fws, nrmUp) {
    // 세로로 선 띠 (갈대 잎, 꽃대): pts 아래→위
    const side = V(Math.cos(rotY), 0, Math.sin(rotY)), i0 = gb.n, n = pts.length;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1), w = lp(w0, w1, t), nn = V(-side.z, nrmUp, side.x).normalize();
      for (const sg of [-1, 1]) gb.v(pts[i].clone().addScaledVector(side, sg * w * 0.5), nn, SOLID[0], SOLID[1], cols(t), fws(t));
      if (i) { const a = i0 + (i - 1) * 2; gb.q(a, a + 1, a + 3, a + 2); }
    }
  }
  function meshReeds(S) {
    const gb = new GB(), cb = lin(0x2a3a1c), cm = lin(0x5a6e34), ct = lin(0xa89a62);
    const colAt = t => { const c = t < 0.6 ? cb.clone().lerp(cm, t / 0.6) : cm.clone().lerp(ct, (t - 0.6) / 0.4); return [c.r, c.g, c.b]; };
    for (const b of S.blades) {
      const pts = [];
      for (let i = 0; i <= 4; i++) { const t = i / 4; pts.push(V(b.x + Math.cos(b.az) * b.lean * b.h * t * t, b.h * t * (1 - 0.06 * t * t), b.z + Math.sin(b.az) * b.lean * b.h * t * t)); }
      strip(gb, pts, b.w, 0.002, b.rot, colAt, t => [0, 0.02 + 0.14 * t * t * b.h, b.ph], 0.35);
    }
    const brown = lin(0x4a3020), stem = lin(0x5a6a38);
    for (const tl of S.tails) {
      const top = V(tl.x + tl.lx, tl.h, tl.z + tl.lz), pts = [V(tl.x, 0, tl.z), V(tl.x + tl.lx * 0.5, tl.h * 0.5, tl.z + tl.lz * 0.5), top];
      for (const r of [0, Math.PI / 2]) strip(gb, pts, 0.012, 0.008, r, () => [stem.r, stem.g, stem.b], t => [0, 0.02 + 0.1 * t * t, tl.ph], 0.2);
      // 부들 이삭
      const i0 = gb.n, h0 = tl.h - 0.32, h1 = tl.h - 0.06;
      for (let j = 0; j <= 1; j++) for (let k = 0; k <= 6; k++) {
        const a = k / 6 * TAU, nn = V(Math.cos(a), 0, Math.sin(a));
        gb.v(V(top.x + nn.x * 0.024, j ? h1 : h0, top.z + nn.z * 0.024), nn, SOLID[0], SOLID[1], [brown.r * (0.8 + 0.2 * j), brown.g, brown.b], [0, 0.12, tl.ph]);
      }
      for (let k = 0; k < 6; k++) gb.q(i0 + k, i0 + k + 1, i0 + 7 + k + 1, i0 + 7 + k);
    }
    return { bark: null, leaf: gb.build() };
  }
  // 꽃 머리: 꽃잎 부채 (단색 칸)
  function flowerHead(gb, c, nrm, r, pc, cc, fw) {
    const s = perpTo(nrm), t = V().crossVectors(nrm, s), i0 = gb.v(c, nrm, SOLID[0], SOLID[1], cc, fw);
    for (let k = 0; k <= 10; k++) { const a = k / 10 * TAU, rr = r * (k % 2 ? 0.55 : 1); gb.v(c.clone().addScaledVector(s, Math.cos(a) * rr).addScaledVector(t, Math.sin(a) * rr).addScaledVector(nrm, -rr * 0.15), nrm, SOLID[0], SOLID[1], pc, fw); }
    for (let k = 0; k < 10; k++) gb.t(i0, i0 + 1 + k, i0 + 2 + k);
  }
  function flowerPlant(gb, R, x, y, z, col, spike, scale = 1) {
    const [lu0, lv0, lu1, lv1] = tileUV(TL.leafy), base = V(x, y, z), green = [0.85, 0.85, 0.8];
    // 바닥 잎 (엇갈린 카드 2장)
    const sz = R.r(0.28, 0.42) * scale, a0 = R() * Math.PI;
    for (let k = 0; k < 2; k++) {
      const ax = V(Math.cos(a0 + k * 1.57), 0, Math.sin(a0 + k * 1.57)).multiplyScalar(sz * 0.5), ay = V(R.s() * 0.08, 1, R.s() * 0.08).normalize().multiplyScalar(sz), i0 = gb.n;
      for (let r = 0; r <= 1; r++) for (const sg of [-1, 1]) gb.v(base.clone().addScaledVector(ay, r).addScaledVector(ax, sg), V(0, 1, 0).lerp(V(ax.x, 0, ax.z).normalize().multiplyScalar(sg), 0.25).normalize(), sg < 0 ? lu0 : lu1, r ? lv1 : lv0, r ? green : [0.4, 0.42, 0.36], [0, 0.02 * r, R()]);
      gb.q(i0, i0 + 1, i0 + 3, i0 + 2);
    }
    const pc = [col.r, col.g, col.b], cc = [col.r * 0.55 + 0.12, col.g * 0.5 + 0.1, col.b * 0.3];
    if (spike) {
      const [u0, v0, u1, v1] = tileUV(TL.spike), h = R.r(0.4, 0.65) * scale, a1 = R() * Math.PI;
      for (let k = 0; k < 2; k++) {
        const ax = V(Math.cos(a1 + k * 1.57), 0, Math.sin(a1 + k * 1.57)).multiplyScalar(h * 0.35), i0 = gb.n;
        for (let r = 0; r <= 1; r++) for (const sg of [-1, 1]) gb.v(base.clone().add(V(0, r * h, 0)).addScaledVector(ax, sg), V(0, 0.6, 0).add(V(-ax.z, 0, ax.x).normalize()).normalize(), sg < 0 ? u0 : u1, r ? v1 : v0, r ? pc : [col.r * 0.5, col.g * 0.55, col.b * 0.45], [0, 0.03 * r, R()]);
        gb.q(i0, i0 + 1, i0 + 3, i0 + 2);
      }
    } else {
      const stemC = lin(0x56683a), nh = R.i(3, 6);
      for (let k = 0; k < nh; k++) {
        const h = R.r(0.22, 0.55) * scale, lx = R.s() * 0.08, lz = R.s() * 0.08, top = V(x + lx, y + h, z + lz), ph = R();
        strip(gb, [base.clone().add(V(R.s() * 0.04, 0, R.s() * 0.04)), V(x + lx * 0.5, y + h * 0.5, z + lz * 0.5), top], 0.008, 0.005, R() * TAU, () => [stemC.r, stemC.g, stemC.b], t => [0, 0.05 * t, ph], 0.3);
        const nrm = V(lx * 3 + R.s() * 0.3, 1, lz * 3 + R.s() * 0.3).normalize(), j = R.r(0.88, 1.08);
        flowerHead(gb, top, nrm, R.r(0.022, 0.04) * scale, pc.map(v => v * j), cc, [0, 0.05, ph]);
      }
    }
  }
  function meshFlowers(S) {
    const gb = new GB(), R = rng(S.seed * 13 + 1), col = lin(S.fcol), n = R.i(6, 10);
    for (let i = 0; i < n; i++) { const a = R() * TAU, d = 0.65 * Math.sqrt(R()); flowerPlant(gb, R, Math.cos(a) * d, 0, Math.sin(a) * d, col, S.fspike); }
    return { bark: null, leaf: gb.build() };
  }

  // =====================================================================
  // 7. 자산 (종류 + seed): LOD0/LOD1 형상, 키, 반지름. 같은 것은 한 번만 만든다
  // =====================================================================
  const ASSETS = new Map();
  function grow(kind, seed) {
    const R = rng((seed * 2654435761) >>> 0 ^ kind.length * 7919);
    const S = { br: [], cl: [], seed, kind, bark: BARK_OF[kind] || 'oak', H: 1, trunkR: 0.2, crown: { c: V(), r: 1 }, yr: [0, 1] };
    SPEC[kind](S, R);
    finishAO(S);
    return S;
  }
  function extent(lods) {
    let r = 0.3, h = 0.5;
    for (const g of [lods.bark, lods.leaf, lods.rock]) { if (!g) continue; const p = g.attributes.position.array; for (let i = 0; i < p.length; i += 3) { r = Math.max(r, Math.hypot(p[i], p[i + 2])); h = Math.max(h, p[i + 1]); } }
    return { r, h };
  }
  function asset(kind, seed) {
    const key = kind + ':' + seed; let a = ASSETS.get(key); if (a) return a;
    if (kind === 'rock') {
      const r0 = F.rock(seed), r1 = F.rock(seed, { detail: 1 });
      a = { kind, seed, lods: [{ rock: r0.geo }, { rock: r1.geo }], h: r0.h, r: r0.r, trunkR: r0.r * 0.8 };
    } else {
      const S = grow(kind, seed);
      let lods;
      if (kind === 'fern') lods = [meshFern(S)];
      else if (kind === 'reeds') lods = [meshReeds(S)];
      else if (kind === 'flowers') lods = [meshFlowers(S)];
      else lods = [meshTree(S, 0), meshTree(S, 1)];
      const e = extent(lods[0]);
      a = { kind, seed, lods, h: e.h, r: e.r, H: S.H, trunkR: S.trunkR };
    }
    ASSETS.set(key, a); return a;
  }
  // 공개: 나무 하나의 형상 (인스턴싱·Batch용). fw 속성(바람)과 color(AO)가 들어 있다.
  F.tree = function (kind = 'oak', seed = 1) {
    if (!SPEC[kind] || !LODC[kind]) kind = 'oak';
    const a = asset(kind, seed);
    return { bark: a.lods[0].bark, leaf: a.lods[0].leaf, lod1: a.lods[1], h: a.h, r: a.r, trunkR: a.trunkR, kind, seed, barkMat: barkMat(BARK_OF[kind]), leafMat: leafMat(null) };
  };

  // =====================================================================
  // 8. 바위: 노이즈로 부푼 둥근 돌, 층리, 위쪽 이끼
  // =====================================================================
  function weld(g) {
    const p = g.attributes.position, map = new Map(), pos = [], idx = [];
    for (let i = 0; i < p.count; i++) {
      const k = Math.round(p.getX(i) * 1e4) + ',' + Math.round(p.getY(i) * 1e4) + ',' + Math.round(p.getZ(i) * 1e4);
      let j = map.get(k); if (j === undefined) { j = pos.length / 3; map.set(k, j); pos.push(p.getX(i), p.getY(i), p.getZ(i)); }
      idx.push(j);
    }
    const o = new T.BufferGeometry(); o.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); o.setIndex(idx); return o;
  }
  const ROCKS = new Map();
  F.rock = function (seed = 1, o = {}) {
    const det = o.detail ?? (isMob() ? 2 : 3), key = seed + ':' + det;
    if (ROCKS.has(key)) return ROCKS.get(key);
    const R = rng(seed * 92821 + 7), g = weld(new T.IcosahedronGeometry(1, det)), P = g.attributes.position, n = P.count;
    const sx = R.r(1.0, 1.5), sy = R.r(0.55, 0.85), sz = R.r(0.75, 1.15), bed = V(R.s() * 0.35, 1, R.s() * 0.35).normalize(), s0 = R.i(1, 9999), sh = R.r(0, 100);
    const dsp = new Float32Array(n), q = V();
    for (let i = 0; i < n; i++) {
      q.fromBufferAttribute(P, i);
      let r = 1 + (fbm3(q.x * 1.3 + sh, q.y * 1.3, q.z * 1.3, s0, 4) - 0.5) * 0.75 + (fbm3(q.x * 4 + sh, q.y * 4, q.z * 4, s0 + 5, 2) - 0.5) * 0.12;
      const b = q.dot(bed) * 5 + fbm3(q.x * 2, q.y * 2, q.z * 2, s0 + 9, 2) * 1.5, fr = b - Math.floor(b);
      r += (sm(0.0, 0.3, fr) - 0.5) * 0.06;
      dsp[i] = r;
      let x = q.x * r * sx, y = q.y * r * sy, z = q.z * r * sz;
      if (y < -0.3 * sy) y = -0.3 * sy + (y + 0.3 * sy) * 0.25;
      P.setXYZ(i, x, y, z);
    }
    g.computeVertexNormals();
    let minY = 1e9, maxY = -1e9, rr = 0;
    for (let i = 0; i < n; i++) { minY = Math.min(minY, P.getY(i)); maxY = Math.max(maxY, P.getY(i)); rr = Math.max(rr, Math.hypot(P.getX(i), P.getZ(i))); }
    const lift = -minY - (maxY - minY) * 0.12;
    const Nn = g.attributes.normal, col = new Float32Array(n * 3), base = lin(0x7e786e), band1 = lin(0x8e8070), band2 = lin(0x6a665e), moss = lin(0x5e6b34), moss2 = lin(0x6f7a3a), lich = lin(0xa8a48c), c = new T.Color();
    for (let i = 0; i < n; i++) {
      P.setY(i, P.getY(i) + lift);
      q.fromBufferAttribute(P, i);
      const ny = Nn.getY(i), b = q.dot(bed) * 3.2;
      c.copy(base).lerp(Math.sin(b * 2.1 + fbm3(q.x, q.y, q.z, s0 + 2, 2) * 3) > 0 ? band1 : band2, 0.5);
      c.multiplyScalar(lp(0.55, 1.08, sm(0.85, 1.12, dsp[i])));
      const m = sm(0.38, 0.75, ny + (fbm3(q.x * 2.5, q.y * 2.5, q.z * 2.5, s0 + 3, 3) - 0.5) * 0.9) * (o.moss ?? 1);
      c.lerp(moss.clone().lerp(moss2, fbm3(q.x * 6, q.y * 6, q.z * 6, s0 + 4, 2)), m);
      c.lerp(lich, sm(0.68, 0.76, fbm3(q.x * 7, q.y * 7, q.z * 7, s0 + 6, 2)) * (1 - m) * 0.45);
      c.multiplyScalar(lp(0.6, 1, sm(0, 0.5 * (maxY - minY), q.y)));
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new T.BufferAttribute(col, 3));
    g.computeBoundingSphere(); g.computeBoundingBox();
    const out = { geo: g, r: rr, h: maxY + lift, mat: rockMat(null) };
    ROCKS.set(key, out); return out;
  };

  // =====================================================================
  // 9. 임포스터: 나무마다 두 방향(변형 0과 1)을 아틀라스에 굽는다 (색 = sqrt(선형), 법선 + 잎 표시)
  // =====================================================================
  const IMP = { ready: false, N: isMob() ? 512 : 1024, nU: { value: null }, ext: [], aTex: null };
  const IMP_KINDS = ['oak', 'beech', 'birch', 'willow', 'pine', 'yew', 'dead'];
  const CANON = [101, 202];   // 숲의 기본 변형 seed (임포스터와 같은 나무)
  const CAP_V = 'uniform vec2 uvS; varying vec2 vUv; varying vec3 vC; varying vec3 vN; void main() { vUv = uv * uvS; vC = color; vN = normalize( mat3( modelMatrix ) * normal ); gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }';
  const CAP_FA = 'uniform sampler2D map; varying vec2 vUv; varying vec3 vC; varying vec3 vN; void main() { vec4 t = texture2D( map, vUv );\n#ifdef LEAF\n if ( t.a < 0.5 ) discard;\n#endif\n gl_FragColor = vec4( sqrt( max( t.rgb * vC, 0.0 ) ), 1.0 ); }';
  const CAP_FN = 'uniform sampler2D map; varying vec2 vUv; varying vec3 vC; varying vec3 vN; void main() { vec4 t = texture2D( map, vUv );\n#ifdef LEAF\n if ( t.a < 0.5 ) discard; gl_FragColor = vec4( normalize( vN ) * 0.5 + 0.5, 1.0 );\n#else\n gl_FragColor = vec4( normalize( vN ) * ( gl_FrontFacing ? 0.5 : -0.5 ) + 0.5, 0.2 );\n#endif\n }';
  function impostors() {
    if (IMP.ready) return IMP;
    const r = window.GFX && GFX.renderer; if (!r) return null;
    const N = IMP.N, TS = N / 4;
    const mk = () => new T.WebGLRenderTarget(N, N, { minFilter: T.LinearMipmapLinearFilter, magFilter: T.LinearFilter, generateMipmaps: false, depthBuffer: true, stencilBuffer: false });
    const A = mk(), Nr = mk();
    const scene = new T.Scene(), cam = new T.OrthographicCamera(-1, 1, 1, -1, 1, 400);
    cam.position.set(0, 0, 200); cam.updateMatrixWorld();
    const capC = new Map(), capM = (map, leaf, nrm, uvS) => { const k = map.uuid + leaf + nrm; let m = capC.get(k); if (!m) capC.set(k, m = new T.ShaderMaterial({ uniforms: { map: { value: map }, uvS: { value: uvS || new T.Vector2(1, 1) } }, vertexColors: true, side: T.DoubleSide, vertexShader: CAP_V, fragmentShader: nrm ? CAP_FN : CAP_FA, defines: leaf ? { LEAF: 1 } : {} })); return m; };
    const prevRT = r.getRenderTarget(), prevAC = r.autoClear, cc = r.getClearColor(new T.Color()), ca = r.getClearAlpha(), prevSh = r.shadowMap.enabled;
    r.shadowMap.enabled = false;
    for (const [rt, c] of [[A, new T.Color(0.17, 0.21, 0.13)], [Nr, new T.Color(0.5, 0.5, 1.0)]]) {
      rt.scissorTest = false; rt.viewport.set(0, 0, N, N); r.setRenderTarget(rt); r.setClearColor(c, 0); r.clear(true, true, false);
    }
    r.autoClear = false;
    IMP_KINDS.forEach((kind, ki) => {
      for (let view = 0; view < 2; view++) {
        const a = asset(kind, CANON[view]), L = a.lods[0], t = ki * 2 + view;
        const w = a.r * 2 * 1.06, h = (a.h + 0.2) * 1.03 / 0.98;
        cam.left = -w / 2; cam.right = w / 2; cam.bottom = -0.02 * h; cam.top = 0.98 * h; cam.updateProjectionMatrix();
        IMP.ext[t] = { w, h };
        const bt = barkTex(BARK_OF[kind]);
        const parts = [];
        if (L.bark) parts.push([L.bark, bt.map, false, new T.Vector2(1 / BU, 1 / BV)]);
        if (L.leaf) parts.push([L.leaf, atlas().tex, true, null]);
        for (const [rt, nrm] of [[A, false], [Nr, true]]) {
          scene.clear();
          for (const [g, map, leaf, uvS] of parts) { const me = new T.Mesh(g, capM(map, leaf, nrm, uvS)); me.rotation.y = view ? Math.PI / 2 : 0; scene.add(me); }
          const vx = (t % 4) * TS, vy = ((t / 4) | 0) * TS;
          rt.viewport.set(vx, vy, TS, TS); rt.scissor.set(vx, vy, TS, TS); rt.scissorTest = true;
          r.setRenderTarget(rt); r.clearDepth(); r.render(scene, cam);
        }
      }
    });
    // 밉맵은 마지막에 한 번만 (칸마다 만들면 소프트웨어 GL에서 매우 느리다): 빈 장면을 1픽셀만 그려 만들게 한다
    scene.clear();
    for (const rt of [A, Nr]) { rt.texture.generateMipmaps = true; rt.viewport.set(0, 0, 1, 1); rt.scissor.set(0, 0, 1, 1); rt.scissorTest = true; r.setRenderTarget(rt); r.render(scene, cam); }
    A.scissorTest = Nr.scissorTest = false; A.viewport.set(0, 0, N, N); Nr.viewport.set(0, 0, N, N);
    for (const m of capC.values()) m.dispose();
    r.setRenderTarget(prevRT); r.autoClear = prevAC; r.setClearColor(cc, ca); r.shadowMap.enabled = prevSh;
    IMP.aTex = A.texture; IMP.nU.value = Nr.texture; IMP.rts = [A, Nr]; IMP.ready = true;
    return IMP;
  }
  function impMat(fv) {
    const k = 'imp|' + fadeKey(fv); let m = MATS.get(k); if (m) return m;
    m = new T.MeshStandardMaterial({ map: IMP.aTex, alphaTest: 0.45, roughness: 0.85, metalness: 0, envMapIntensity: 0.85 });
    m.userData.fade = fadeU(fv); patch(m, { imp: 1, fade: !!fv }); MATS.set(k, m); return m;
  }

  // =====================================================================
  // 10. 심기 (인스턴싱 + LOD + 디더 섞기 + 충돌체)
  // =====================================================================
  //  종류: 기본 LOD 거리 [LOD0 끝, LOD1 끝(없으면 사라짐)], 임포스터 칸, 기본 크기 범위, 대표 잎색(색 흔들기 기준)
  const KIND = {
    oak: { tree: 1, imp: 0, lod: [60, 130], sc: [0.85, 1.2], col: 0x4f5e2c },
    beech: { tree: 1, imp: 1, lod: [60, 130], sc: [0.85, 1.15], col: 0x5a6a30 },
    birch: { tree: 1, imp: 2, lod: [60, 130], sc: [0.85, 1.15], col: 0x66763a },
    willow: { tree: 1, imp: 3, lod: [60, 130], sc: [0.9, 1.15], col: 0x7a8a5a },
    pine: { tree: 1, imp: 4, lod: [60, 130], sc: [0.8, 1.25], col: 0x2e4228 },
    yew: { tree: 1, imp: 5, lod: [60, 130], sc: [0.85, 1.2], col: 0x223020 },
    dead: { tree: 1, imp: 6, lod: [60, 130], sc: [0.85, 1.15], col: 0x888070 },
    bush: { imp: -1, lod: [35, 95], sc: [0.7, 1.3], col: 0x4a5a2c, var: 3 },
    fern: { imp: -1, lod: [42], sc: [0.7, 1.3], col: 0x5a7032, var: 3 },
    reeds: { imp: -1, lod: [55], sc: [0.8, 1.2], col: 0x6a7a40, var: 2 },
    flowers: { imp: -1, lod: [55], sc: [0.75, 1.25], col: 0x808080, var: 8 },
    rock: { imp: -1, lod: [70, 320], sc: [0.6, 2.2], rock: 1, var: 4 },
  };
  F.KINDS = Object.keys(KIND);
  const BAND = 8, MARGIN = 4;
  const DRV_GEO = new T.BufferGeometry(); DRV_GEO.setAttribute('position', new T.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0], 3));
  const DRV_MAT = new T.MeshBasicMaterial({ colorWrite: false, depthWrite: false, depthTest: false });
  const _q = new T.Quaternion(), _p = V(), _s = V(), _m = new T.Matrix4(), _fw = V(), _cp = V();
  const isBatch = p => p && p.buckets instanceof Map && Array.isArray(p.extra);
  class PlantSet {
    constructor(parent, points, o = {}) {
      this.o = o; this.group = new T.Group(); this.group.name = 'flora';
      this.colliders = []; this.kinds = []; this.last = V(1e9, 0, 1e9); this.lastDir = V(0, 0, 0); this.far = o.far ?? 1200;
      const R = rng((o.seed ?? 1) * 7349 + 3), mix = o.mix || { [o.kind || 'oak']: 1 };
      const keys = Object.keys(mix), tot = keys.reduce((a, k) => a + mix[k], 0), lists = {};
      for (const pt of points) {
        let x, y, z, kind, s, rot;
        if (Array.isArray(pt)) [x, y, z, kind, s, rot] = pt; else ({ x, y, z, kind, s, rot } = pt);
        if (typeof kind !== 'string') { let u = R() * tot; kind = keys[0]; for (const k of keys) { u -= mix[k]; if (u <= 0) { kind = k; break; } } }
        if (!KIND[kind]) continue;
        if (y === undefined || y === null) y = o.ground ? o.ground(x, z) : 0;
        (lists[kind] || (lists[kind] = [])).push({ x, y, z, s, rot });
      }
      for (const kind in lists) this.addKind(kind, lists[kind], R);
      if (this.kinds.some(k => k.hasImp)) this.makeImp();
      const drv = new T.Mesh(DRV_GEO, DRV_MAT); drv.frustumCulled = false; drv.renderOrder = 1e9;
      drv.onAfterRender = (r, s, cam) => { if (cam.isPerspectiveCamera) this.update(cam); };
      this.group.add(drv);
      this.group.colliders = this.colliders; this.group.userData.colliders = this.colliders; this.group.userData.flora = this;
      if (isBatch(parent)) { parent.extra.push(this.group); parent.colliders.push(...this.colliders); }
      else if (parent && parent.isObject3D) parent.add(this.group);
      F.sets.push(this);
      if (window.GFX && GFX.camera) { GFX.camera.updateMatrixWorld(); this.update(GFX.camera, true); }
    }
    addKind(kind, list, R) {
      const K = KIND[kind], o = this.o;
      const nv = K.tree ? (o.variants ?? 2) : (o.variants ?? K.var ?? 2);
      const seeds = []; for (let v = 0; v < nv; v++) seeds.push(o.seeds ? o.seeds[v % o.seeds.length] : K.tree ? (v < 2 ? CANON[v] : 101 * (v + 1)) : 301 + v * 97 + (kind === 'flowers' ? -301 + v : 0));
      const assets = seeds.map(s => asset(kind, s));
      const lod = (K.tree && o.lod) || (!K.tree && o.lodSmall && o.lodSmall[kind]) || K.lod;
      const l0 = lod[0], l1 = lod[1] ?? null, hasImp = K.imp >= 0 && l1 !== null && o.impostors !== false && !!(window.GFX && GFX.renderer);
      const f0 = [-2, -1, l0, l0 + BAND], f1 = l1 !== null ? [l0, l0 + BAND, l1, l1 + BAND] : null;
      const base = lin(K.col), hue = (o.hue ?? 6) / 360, val = o.val ?? 0.12, c = new T.Color();
      const kk = { kind, K, l0, l1, hasImp, insts: [], meshes: [] };
      const sc = o.scale || K.sc;
      for (const p of list) {
        const v = (R() * nv) | 0, a = assets[v];
        const s = (p.s ?? R.r(sc[0], sc[1])) * (o.size ?? 1), sy = 1 + R.s() * 0.08, rot = p.rot ?? R() * TAU;
        _m.compose(_p.set(p.x, p.y, p.z), _q.setFromAxisAngle(UP, rot), _s.set(s, s * sy, s));
        c.copy(base); c.offsetHSL(R.s() * hue, R.s() * 0.04, 0); c.multiplyScalar(1 + R.s() * val);
        if (o.autumn && K.tree && kind !== 'pine' && kind !== 'yew' && R() < o.autumn) { c.offsetHSL(-R.r(0.05, 0.11), 0.1, 0.02); }
        const bv = 1 + R.s() * 0.1;
        const it = { x: p.x, y: p.y, z: p.z, v, m: _m.toArray(new Float32Array(16)), lc: [c.r / base.r, c.g / base.g, c.b / base.b], bc: [bv, bv, bv], s, sy, flip: R() < 0.5 ? -1 : 1 };
        if (kind === 'rock') it.lc = it.bc = [bv, bv * 0.99, bv * 0.97];
        kk.insts.push(it);
        if (o.colliders !== false && (K.tree || kind === 'rock' || (kind === 'bush' && o.bushColliders))) {
          if (kind === 'rock') this.colliders.push({ x: p.x, z: p.z, r: a.r * s * 0.8, top: p.y + a.h * s * sy, bot: p.y - 1, climb: true, stand: true });
          else this.colliders.push({ x: p.x, z: p.z, r: Math.max(0.2, a.trunkR * s * (kind === 'bush' ? 8 : 1.15)), top: p.y + a.h * s * sy, bot: p.y - 0.5 });
        }
      }
      const cnt = new Array(nv).fill(0); for (const it of kk.insts) cnt[it.v]++;
      for (let v = 0; v < nv; v++) {
        kk.meshes[v] = [];
        if (!cnt[v]) continue;
        for (let li = 0; li < (l1 !== null ? 2 : 1); li++) {
          const L = assets[v].lods[li]; if (!L) continue;
          const fv = li ? f1 : (l1 !== null || !hasImp ? f0 : f0);
          const slot = { n: 0, parts: [] };
          for (const part of ['bark', 'leaf', 'rock']) {
            const g = L[part]; if (!g) continue;
            const mat = part === 'leaf' ? leafMat(fv) : part === 'bark' ? barkMat(BARK_OF[kind], fv) : rockMat(fv);
            const im = new T.InstancedMesh(g, mat, cnt[v]);
            im.instanceColor = new T.InstancedBufferAttribute(new Float32Array(cnt[v] * 3), 3);
            im.instanceMatrix.setUsage(T.DynamicDrawUsage); im.instanceColor.setUsage(T.DynamicDrawUsage);
            im.count = 0; im.frustumCulled = false;
            im.castShadow = o.shadows !== false && (kind !== 'flowers' && !(kind === 'fern' && li)); im.receiveShadow = true;
            if (part !== 'rock') im.customDepthMaterial = depthMat(part === 'leaf' ? 'leaf' : 'bark');
            im.name = kind + ':' + part + ':' + v + ':L' + li;
            this.group.add(im); slot.parts.push({ im, leaf: part !== 'bark' });
          }
          kk.meshes[v][li] = slot;
        }
      }
      this.kinds.push(kk);
    }
    makeImp() {
      if (!impostors()) { for (const k of this.kinds) k.hasImp = false; return; }
      let n = 0; for (const k of this.kinds) if (k.hasImp) n += k.insts.length;
      const l1 = Math.min(...this.kinds.filter(k => k.hasImp).map(k => k.l1));
      const g = new T.PlaneGeometry(1, 1).translate(0, 0.5, 0);
      g.setAttribute('imp', new T.InstancedBufferAttribute(new Float32Array(n * 4), 4).setUsage(T.DynamicDrawUsage));
      const im = new T.InstancedMesh(g, impMat([l1, l1 + BAND, 1e7, 1e7 + 1]), n);
      im.instanceColor = new T.InstancedBufferAttribute(new Float32Array(n * 3), 3).setUsage(T.DynamicDrawUsage);
      im.instanceMatrix.setUsage(T.DynamicDrawUsage);
      im.count = 0; im.frustumCulled = false; im.castShadow = this.o.shadows !== false; im.receiveShadow = true;
      im.customDepthMaterial = depthMat('imp'); im.name = 'impostors';
      this.imp = im; this.group.add(im);
    }
    // 카메라 기준으로 인스턴스를 LOD 통에 나눈다 (3 m 움직이거나 10° 돌 때만)
    update(cam, force) {
      cam.matrixWorld.decompose(_cp, _q, _s);
      cam.getWorldDirection(_fw);
      const moved = Math.hypot(_cp.x - this.last.x, _cp.z - this.last.z), turn = this.lastDir.dot(_fw);
      if (window.GFX && GFX.sun) F.sunW.value.subVectors(GFX.sun.position, GFX.sun.target.position).normalize();
      if (!force && moved < 3 && turn > 0.985) return;
      this.last.copy(_cp); this.lastDir.copy(_fw);
      const fx = _fw.x, fz = _fw.z, fl = Math.hypot(fx, fz) || 1;
      const cosL = Math.cos(Math.min(Math.PI, Math.atan(Math.tan((cam.fov || 60) * Math.PI / 360) * (cam.aspect || 1.8)) + 0.5));
      const steep = Math.abs(_fw.y) > 0.75;
      let ni = 0; const imp = this.imp, ia = imp && imp.geometry.attributes.imp;
      for (const k of this.kinds) {
        for (const vm of k.meshes) if (vm) for (const s of vm) if (s) s.n = 0;
        const lEnd = k.l1 ?? k.l0;
        for (const it of k.insts) {
          const dx = it.x - _cp.x, dz = it.z - _cp.z, d = Math.hypot(dx, dz);
          const inView = steep || d < 30 || (dx * fx + dz * fz) / (d * fl) > cosL;
          if (d < k.l0 + BAND + MARGIN) this.put(k.meshes[it.v][0], it);
          if (k.l1 !== null && d > k.l0 - MARGIN && d < k.l1 + BAND + MARGIN && inView) this.put(k.meshes[it.v][1], it);
          if (k.hasImp && d > lEnd - MARGIN && d < this.far && inView) {
            const t = k.K.imp * 2 + (it.v % 2), e = IMP.ext[t];
            imp.instanceMatrix.array.set(it.m, ni * 16); imp.instanceColor.array.set(it.lc, ni * 3);
            ia.array[ni * 4] = t; ia.array[ni * 4 + 1] = it.flip; ia.array[ni * 4 + 2] = e.w; ia.array[ni * 4 + 3] = e.h; ni++;
          }
        }
        for (const vm of k.meshes) if (vm) for (const s of vm) if (s) for (const p of s.parts) {
          p.im.count = s.n;
          p.im.instanceMatrix.needsUpdate = true; p.im.instanceMatrix.updateRange.count = s.n * 16;
          p.im.instanceColor.needsUpdate = true; p.im.instanceColor.updateRange.count = s.n * 3;
        }
      }
      if (imp) {
        imp.count = ni; imp.instanceMatrix.needsUpdate = true; imp.instanceColor.needsUpdate = true; ia.needsUpdate = true;
        imp.instanceMatrix.updateRange.count = ni * 16; imp.instanceColor.updateRange.count = ni * 3; ia.updateRange.count = ni * 4;
      }
    }
    put(slot, it) {
      if (!slot) return;
      const i = slot.n++;
      for (const p of slot.parts) { p.im.instanceMatrix.array.set(it.m, i * 16); p.im.instanceColor.array.set(p.leaf ? it.lc : it.bc, i * 3); }
    }
    // 지금 그려지는 양 (인스턴스, 삼각형, 그리기 호출)
    stats() {
      const out = { inst: [0, 0, 0], tris: [0, 0, 0], draws: 0 };
      for (const k of this.kinds) k.meshes.forEach(vm => vm && vm.forEach((s, li) => { if (!s) return; out.inst[li] += s.n; for (const p of s.parts) { out.tris[li] += s.n * tris(p.im.geometry); if (s.n) out.draws++; } }));
      if (this.imp) { out.inst[2] = this.imp.count; out.tris[2] = this.imp.count * 2; if (this.imp.count) out.draws++; }
      return out;
    }
    dispose() { const i = F.sets.indexOf(this); if (i >= 0) F.sets.splice(i, 1); if (this.group.parent) this.group.parent.remove(this.group); for (const c of this.group.children) if (c.isInstancedMesh) c.dispose(); }
  }
  // 공개: 숲 심기. points: [{x,y,z,kind,s,rot}] 또는 [x,y,z,kind,s,rot]. 돌려주는 Group에 .colliders 가 있다.
  F.forest = function (parent, points, o = {}) { return new PlantSet(parent, points || [], o).group; };
  F.update = function (cam) { for (const s of F.sets) s.update(cam || GFX.camera); };
  F.stats = function () {
    const t = { inst: [0, 0, 0], tris: [0, 0, 0], draws: 0, sets: F.sets.length };
    for (const s of F.sets) { const a = s.stats(); for (let i = 0; i < 3; i++) { t.inst[i] += a.inst[i]; t.tris[i] += a.tris[i]; } t.draws += a.draws; }
    return t;
  };
  // 덤불·고사리·갈대: 숫자(seed)를 주면 형상, 아니면 심기 (parent, points, o)
  function plantOr(kind) { return (a, b, c) => (typeof a === 'number' || a === undefined) ? (() => { const s = asset(kind, a ?? 1); return { bark: s.lods[0].bark, leaf: s.lods[0].leaf, lod1: s.lods[1], h: s.h, r: s.r }; })() : F.forest(a, b, Object.assign({}, c, { kind, mix: null })); }
  F.bush = plantOr('bush'); F.fern = plantOr('fern'); F.reeds = plantOr('reeds');
  F.bushes = (p, pts, o) => F.forest(p, pts, Object.assign({}, o, { kind: 'bush' }));
  F.ferns = (p, pts, o) => F.forest(p, pts, Object.assign({}, o, { kind: 'fern' }));
  F.rocks = (p, pts, o) => F.forest(p, pts, Object.assign({}, o, { kind: 'rock' }));

  // 땅에 뿌리기: 덤불·고사리·바위·꽃 무리·갈대를 밀도 함수로 흩는다.
  // m: { ground(x,z), grassAt?(x,z), W?, D? }. o.density(x, z, kind) → 0..1 (기본: 풀이 나는 곳이면 1, 바위는 0.6)
  // o.per: 100 m² 당 기본 개수 { bush, fern, rock, flowers, reeds }. o.area: {x0,z0,x1,z1}. o.cell: 표본 간격(m)
  F.scatterGround = function (parent, m, o = {}) {
    const per = Object.assign({ bush: 1.1, fern: 1.6, rock: 0.3, flowers: 0.9, reeds: 0 }, o.per);
    const A = o.area || { x0: 0, z0: 0, x1: m.W || 256, z1: m.D || 256 }, cell = o.cell ?? 2, sd = (o.seed ?? 3) * 977;
    const dens = o.density || ((x, z, kind) => { const g = m.grassAt ? m.grassAt(x, z) : { d: 1 }; return g ? (kind === 'rock' ? 0.6 : 1) : (kind === 'rock' ? 0.35 : 0); });
    const pts = [], cnt = {};
    const kinds = Object.keys(per).filter(k => per[k] > 0 && KIND[k]);
    const nx = Math.ceil((A.x1 - A.x0) / cell), nz = Math.ceil((A.z1 - A.z0) / cell);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      for (let ki = 0; ki < kinds.length; ki++) {
        const kind = kinds[ki], p = per[kind] / 100 * cell * cell;
        // 무리 짓기: 낮은 주파수 노이즈로 밀도를 0~2배 흔든다
        const x = A.x0 + (i + ih(i, j, ki, sd + 1)) * cell, z = A.z0 + (j + ih(i, j, ki, sd + 2)) * cell;
        const clump = kind === 'rock' ? 1 : sm(0.35, 0.75, vn3(x * 0.05, ki * 3.7, z * 0.05, sd + ki)) * 2;
        if (ih(i, j, ki, sd) > p * clump) continue;
        const d = dens(x, z, kind); if (!(d > 0) || ih(i, j, ki, sd + 3) > d) continue;
        const y = m.ground(x, z);
        if (!isFinite(y)) continue;
        pts.push({ x, y, z, kind }); cnt[kind] = (cnt[kind] || 0) + 1;
      }
    }
    const g = F.forest(parent, pts, Object.assign({ seed: o.seed ?? 3 }, o.forest, { lodSmall: o.lodSmall }));
    g.userData.counts = cnt;
    return g;
  };

  // =====================================================================
  // 11. 산울타리 (다듬은 울타리): 둥근 상자 겉면에 작은 잎 카드를 빽빽하게
  // =====================================================================
  F.hedge = function (ax, az, bx, bz, o = {}) {
    const R = rng((o.seed ?? 1) * 4801 + 17), L = Math.hypot(bx - ax, bz - az) || 1, rot = Math.atan2(-(bz - az), bx - ax);
    const h = o.h ?? 1.5, w = o.w ?? 1.0, y0 = o.y ?? (o.ground ? Math.min(o.ground(ax, az), o.ground(bx, bz), o.ground((ax + bx) / 2, (az + bz) / 2)) : 0);
    const ux = (bx - ax) / L, uz = (bz - az) / L, nx = -uz, nz = ux;
    const toW = (x, y, z) => V(ax + ux * x + nx * z, y0 + y, az + uz * x + nz * z);
    const dirW = (x, y, z) => V(ux * x + nx * z, y, uz * x + nz * z);
    const rr = Math.min(o.round ?? 0.2, w * 0.4, h * 0.4), lo = V(rr, rr, -w / 2 + rr), hi = V(L - rr, h - rr, w / 2 - rr);
    const gb = new GB(), [u0, v0, u1, v1] = tileUV(TL.hedge), dens = o.density ?? (isMob() ? 18 : 30);
    const faces = [[L * w, () => V(R() * L, h, (R() - 0.5) * w)], [L * h, () => V(R() * L, R() * h, w / 2)], [L * h, () => V(R() * L, R() * h, -w / 2)]];
    if (o.ends !== false) faces.push([w * h, () => V(0, R() * h, (R() - 0.5) * w)], [w * h, () => V(L, R() * h, (R() - 0.5) * w)]);
    const tot = faces.reduce((a, f) => a + f[0], 0), n = Math.round(tot * dens), q = V(), nn = V();
    for (let i = 0; i < n; i++) {
      let u = R() * tot, f = faces[0]; for (const ff of faces) { u -= ff[0]; if (u <= 0) { f = ff; break; } }
      const p = f[1](); q.copy(p).clamp(lo, hi); nn.subVectors(p, q); if (nn.lengthSq() < 1e-6) nn.set(0, 1, 0); nn.normalize();
      p.copy(q).addScaledVector(nn, rr * R.r(0.9, 1.08) + R.r(-0.04, 0.05));
      if (p.y < 0.02) continue;
      const nw = dirW(nn.x, nn.y, nn.z).normalize(), tilt = nw.clone().add(V(R.s(), R.s(), R.s()).multiplyScalar(0.45)).normalize();
      const ay = perpTo(tilt).applyAxisAngle(tilt, R() * TAU), axv = V().crossVectors(ay, tilt), s = R.r(0.3, 0.48);
      const ctr = toW(p.x, p.y, p.z), base = ctr.clone().addScaledVector(ay, -s * 0.5), ao = lp(0.45, 1.0, sm(0, h, p.y)) * R.r(0.85, 1.1), col = [ao, ao * R.r(0.97, 1.03), ao * 0.95];
      const ph = R(), i0 = gb.n, ln = nw.clone().lerp(tilt, 0.2).normalize();
      for (let r = 0; r <= 1; r++) for (const sg of [-1, 1]) gb.v(base.clone().addScaledVector(ay, r * s).addScaledVector(axv, sg * s * 0.5), ln, sg < 0 ? u0 : u1, r ? v1 : v0, col, [0, 0.012, ph]);
      gb.q(i0, i0 + 1, i0 + 3, i0 + 2);
    }
    // 속 (어두운 잎 덩어리): 모서리가 겉면을 뚫지 않게 안으로 넣는다
    const ins = rr * 0.5 + 0.05, core = new T.BoxGeometry(L - 2 * ins, h - ins, w - 2 * ins).toNonIndexed(), cp = core.attributes.position, cn = core.attributes.normal, i0 = gb.n;
    for (let i = 0; i < cp.count; i++) {
      const x = cp.getX(i) + L / 2, y = cp.getY(i) + (h - ins) / 2, z = cp.getZ(i), k = lp(0.18, 0.32, y / h);
      gb.v(toW(x, y, z), dirW(cn.getX(i), cn.getY(i), cn.getZ(i)), SOLID[0], SOLID[1], [k * 0.16, k * 0.22, k * 0.1], [0, 0, 0]);
    }
    for (let i = 0; i < cp.count; i += 3) gb.t(i0 + i, i0 + i + 1, i0 + i + 2);
    const me = new T.Mesh(gb.build(), leafMat(null)); me.castShadow = me.receiveShadow = true; me.customDepthMaterial = depthMat('leaf'); me.name = 'hedge';
    const grp = new T.Group(); grp.add(me);
    const col = { x: (ax + bx) / 2, z: (az + bz) / 2, hw: L / 2, hd: w / 2, rot, top: y0 + h, bot: y0 - 0.5 };
    grp.colliders = grp.userData.colliders = [col];
    if (isBatch(o.batch)) { o.batch.extra.push(grp); o.batch.colliders.push(col); } else if (o.parent) o.parent.add(grp);
    return grp;
  };

  // =====================================================================
  // 12. 담쟁이: 벽 아래에서 줄기가 굽이쳐 올라가고 잎이 돌을 덮는다
  //  anchor: 벽 구간 {ax,az,bx,bz, y, h, thick, side(+1: 왼쪽 법선 (-uz,ux))} 또는 표시 {x,y,z,nx,nz,w,h}
  // =====================================================================
  F.ivy = function (batch, anchor, o = {}) {
    const R = rng((o.seed ?? 1) * 6007 + 3), s0 = R.i(1, 999);
    let O, U, Nn, W, Hh;
    if (anchor.ax !== undefined) {
      const L = Math.hypot(anchor.bx - anchor.ax, anchor.bz - anchor.az) || 1;
      U = V((anchor.bx - anchor.ax) / L, 0, (anchor.bz - anchor.az) / L); Nn = V(-U.z, 0, U.x).multiplyScalar(anchor.side ?? 1);
      O = V(anchor.ax, anchor.y ?? 0, anchor.az).addScaledVector(Nn, (anchor.thick ?? 0) / 2); W = L; Hh = anchor.h ?? 6;
    } else {
      Nn = V(anchor.nx ?? 0, 0, anchor.nz ?? 1).normalize(); U = V(Nn.z, 0, -Nn.x); W = anchor.w ?? o.w ?? 4; Hh = o.h ?? anchor.h ?? 5;
      O = V(anchor.x, anchor.y0 ?? anchor.y ?? 0, anchor.z).addScaledVector(U, -W / 2);
    }
    const u0 = o.u0 ?? 0, u1 = o.u1 ?? W, cover = o.cover ?? 0.85;
    const toW = (u, v, off) => O.clone().addScaledVector(U, u).add(V(0, v, 0)).addScaledVector(Nn, off);
    const top = u => Hh * cover * (0.45 + 0.55 * fbm3(u * 0.45, 0.5, 0.5, s0, 3));
    const stems = [], nS = o.stems ?? Math.max(2, Math.round((u1 - u0) * (o.density ?? 0.9)));
    const grow = (u, v, a, lim, depth) => {
      const pts = [[u, v]];
      for (let k = 0; k < 160 && v < lim; k++) {
        a += R.s() * 0.38 + (Math.PI / 2 - a) * 0.1;
        u += Math.cos(a) * 0.12; v += Math.sin(a) * 0.12;
        if (u < u0 + 0.05 || u > u1 - 0.05) { a = Math.PI - a; u = cl(u, u0 + 0.05, u1 - 0.05); }
        pts.push([u, v]);
        if (depth < 2 && v > 0.3 && R() < 0.05) grow(u, v, a + (R() < 0.5 ? 1 : -1) * R.r(0.7, 1.1), Math.min(lim, v + R.r(0.8, 2.2)), depth + 1);
      }
      stems.push({ pts, depth });
    };
    for (let s = 0; s < nS; s++) { const u = lp(u0, u1, (s + R()) / nS); grow(u, 0, Math.PI / 2 + R.s() * 0.3, top(u) * R.r(0.6, 1.05), 0); }
    // 줄기 (나무껍질)
    const gbS = new GB();
    for (const st of stems) {
      const br = { p: st.pts.map(([u, v]) => toW(u, v, 0.03)), r: [], f: [], depth: 3, ph: R(), root: false };
      const n = br.p.length; if (n < 2) continue;
      for (let i = 0; i < n; i++) { br.r.push(lp(st.depth ? 0.012 : 0.022, 0.006, i / n)); br.f.push(0); }
      tube(gbS, br, 3, { H: 10, bark: 'dead' }, 1);
    }
    // 잎 카드
    const gb = new GB(), [lu0, lv0, lu1, lv1] = tileUV(TL.ivy);
    let nc = 0;
    for (const st of stems) for (let i = 1; i < st.pts.length; i++) {
      const [u, v] = st.pts[i], pr = (1 - 0.45 * v / Hh) * (o.leaf ?? 1);
      if (R() > pr * 0.9) continue;
      for (let k = 0; k < (v < 1.2 ? 2 : 1); k++) {
        const off = R.r(0.03, 0.16), s = R.r(0.24, 0.36), nr = Nn.clone().add(V(R.s(), R.s(), R.s()).multiplyScalar(0.55)).normalize();
        const ay = V(0, 1, 0).addScaledVector(nr, -nr.y).normalize().applyAxisAngle(nr, R.s() * 0.7), axv = V().crossVectors(ay, nr);
        const ctr = toW(u + R.s() * 0.1, v + R.s() * 0.1, off), base = ctr.clone().addScaledVector(ay, -s * 0.5), ao = lp(0.55, 1.0, sm(0.02, 0.17, off)) * R.r(0.85, 1.1);
        const ln = Nn.clone().lerp(nr, 0.45).normalize(), ph = R(), i0 = gb.n;
        for (let r = 0; r <= 1; r++) for (const sg of [-1, 1]) gb.v(base.clone().addScaledVector(ay, r * s).addScaledVector(axv, sg * s * 0.5), ln, sg < 0 ? lu0 : lu1, r ? lv1 : lv0, [ao, ao, ao * 0.95], [0, 0.01 + 0.015 * r, ph]);
        gb.q(i0, i0 + 1, i0 + 3, i0 + 2); nc++;
      }
    }
    const leaves = new T.Mesh(gb.build(), leafMat(null)); leaves.castShadow = leaves.receiveShadow = true; leaves.customDepthMaterial = depthMat('leaf'); leaves.name = 'ivy';
    const stemsG = gbS.n ? gbS.build() : null;
    if (isBatch(batch)) { batch.extra.push(leaves); if (stemsG) batch.add('bark', stemsG); }
    else if (batch && batch.isObject3D) { batch.add(leaves); if (stemsG) { const sm_ = new T.Mesh(stemsG, barkMat('dead')); sm_.castShadow = sm_.receiveShadow = true; batch.add(sm_); } }
    return { leaves, stems: stemsG, cards: nc };
  };

  // =====================================================================
  // 13. 꽃밭: 점마다 한 색의 무리 (바닥 잎 + 꽃대). 한 메쉬로 합친다
  // =====================================================================
  F.FLOWER_COLORS = FLOWER_PAL;
  F.flowers = function (points, o = {}) {
    const R = rng((o.seed ?? 1) * 3301 + 5), pal = o.colors || FLOWER_PAL, gb = new GB();
    for (const pt of points) {
      const [cx, cy, cz] = Array.isArray(pt) ? pt : [pt.x, pt.y, pt.z];
      const col = lin(pt.color ?? pal[(R() * pal.length) | 0]), spike = o.kind ? o.kind === 'spike' : R() < 0.4, n = o.n ?? 9, r = o.r ?? 0.6;
      for (let i = 0; i < n; i++) {
        const a = R() * TAU, d = r * Math.sqrt(R()), x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
        flowerPlant(gb, R, x, o.ground ? o.ground(x, z) : (cy ?? 0), z, col, spike, o.scale ?? 1);
      }
    }
    const me = new T.Mesh(gb.build(), leafMat(null)); me.castShadow = false; me.receiveShadow = true; me.customDepthMaterial = depthMat('leaf'); me.name = 'flowers';
    if (o.parent) o.parent.add(me); else if (isBatch(o.batch)) o.batch.extra.push(me);
    return me;
  };
  F._rng = rng; F._asset = asset; F._imp = IMP;
})();
