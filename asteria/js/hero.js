// 아스테리아 3D — 캐릭터 (HERO)
// actors.js의 makeRig(look, o) / animRig(root, state, dt)를 같은 이름·같은 인자로 바꾼다 (actors.js 다음에 읽는다).
// 7~7.5등신(렌 1.72 m), 보이는 목, 팔꿈치·무릎, 손(벙어리장갑 + 엄지), 깎은 머리 + 캔버스에 그린 얼굴(흰자·홍채·반사광·속눈썹·깜박임),
// 머리카락 다발(뒤처지는 움직임), 앞이 트인 A자 학자 로브(베를렛 천: 다리 캡슐과 부딪힘), 종 모양 소매(중력으로 늘어짐),
// 어깨 망토·두건, 연구자 영대(사슬 물리), 가방끈·가방, 장화, 공명봉, 등에서 펼쳐지는 활공 날개.
// 뼈는 Group 계층이다 (게임이 armL.rotation 등을 직접 만진다). 옷·피부는 그 Group들을 뼈로 쓰는 SkinnedMesh라 관절이 부드럽게 굽는다.
'use strict';
(function () {
  const T = THREE;
  const legacyAnim = typeof window.animRig === 'function' ? window.animRig : null;   // actors.js의 원래 함수
  const HERO = window.HERO = { count: 0 };

  // ===================================================================
  // 1. 작은 도구
  // ===================================================================
  const cl = (v, a, b) => v < a ? a : v > b ? b : v, lp = (a, b, t) => a + (b - a) * t;
  const ss = (a, b, v) => { const t = cl((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const gs = (d, s) => Math.exp(-d * d / (2 * s * s));
  const PI = Math.PI, TAU = PI * 2, D2R = PI / 180;
  const angW = a => { a %= TAU; return a > PI ? a - TAU : a < -PI ? a + TAU : a; };
  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let s = (seed >>> 0) || 0x9e3779b9; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  const C = h => new T.Color(h);
  function hsl(h, ds = 1, dl = 1, dh = 0) { const o = {}; C(h).getHSL(o, 'srgb'); return '#' + new T.Color().setHSL((o.h + dh + 1) % 1, cl(o.s * ds, 0, 1), cl(o.l * dl, 0, 1), 'srgb').getHexString(); }
  const HSL = h => { const o = {}; C(h).getHSL(o, 'srgb'); return o; };
  const srgb = h => { const c = C(h).convertLinearToSRGB(); return [c.r * 255, c.g * 255, c.b * 255]; };
  const pick = (R, a) => a[Math.floor(R() * a.length) % a.length];
  const _v1 = new T.Vector3(), _v2 = new T.Vector3(), _v3 = new T.Vector3(), _v4 = new T.Vector3(), _v5 = new T.Vector3(), _v6 = new T.Vector3();
  const _q1 = new T.Quaternion(), _q2 = new T.Quaternion(), _q3 = new T.Quaternion(), _q4 = new T.Quaternion(), _q5 = new T.Quaternion();
  const _m1 = new T.Matrix4(), _m2 = new T.Matrix4(), _e1 = new T.Euler(), XA = new T.Vector3(1, 0, 0);
  const CACHE = {};
  const memo = (k, f) => CACHE[k] || (CACHE[k] = f());

  // 팔레트 칸 (정점색은 칸 번호로 고른다) 과 칸마다 거칠기·금속성
  const PI_ = { SHIRT: 0, VEST: 1, TROU: 2, ROBE: 3, LINE: 4, TRIM: 5, BRASS: 6, BOOT: 7, STRAP: 8, SOLE: 9, BELT: 10, CAPE: 11, STOLE: 12, STOLE2: 13, HAT: 14, BAND: 15, WOOD: 16, IRON: 17, PAGE: 18, SAIL: 19 };
  const RM = [[0.72, 0], [0.62, 0], [0.8, 0], [0.7, 0], [0.62, 0], [0.6, 0], [0.3, 1], [0.48, 0], [0.55, 0], [0.75, 0], [0.45, 0], [0.7, 0], [0.7, 0], [0.55, 0], [0.8, 0], [0.6, 0], [0.5, 0], [0.4, 0.85], [0.9, 0], [0.62, 0]];

  // ===================================================================
  // 2. 재질과 공용 텍스처
  // ===================================================================
  const MAT = {};
  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  // 평직 천의 법선 지도 (4 cm 한 장)
  function fabricNormal() {
    return memo('fabricN', () => {
      const S = 128, cv = canvas(S, S), g = cv.getContext('2d'), img = g.createImageData(S, S), H = new Float32Array(S * S), R = rng(17);
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const tx = (x % 8 + 0.5) / 8, ty = (y % 8 + 0.5) / 8, over = ((x >> 3) + (y >> 3)) & 1;
        const warp = Math.sin(PI * tx) * Math.pow(Math.sin(PI * ty), 0.4), weft = Math.sin(PI * ty) * Math.pow(Math.sin(PI * tx), 0.4);
        H[y * S + x] = (over ? warp : weft) * 0.9 + R() * 0.12;
      }
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const dx = H[y * S + (x + 1) % S] - H[y * S + (x + S - 1) % S], dy = H[((y + 1) % S) * S + x] - H[((y + S - 1) % S) * S + x];
        const nx = -dx * 1.4, ny = dy * 1.4, l = Math.hypot(nx, ny, 1), i = (y * S + x) * 4;
        img.data[i] = (nx / l * 0.5 + 0.5) * 255; img.data[i + 1] = (ny / l * 0.5 + 0.5) * 255; img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      const t = new T.CanvasTexture(cv); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(25, 25); t.anisotropy = 4;
      return t;
    });
  }
  // 옷 재질 하나: 정점색 × 칸마다 거칠기·금속성 (rm 속성)
  function clothMat() {
    if (MAT.cloth) return MAT.cloth;
    const m = new T.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 1, normalMap: fabricNormal(), normalScale: new T.Vector2(0.45, 0.45) });
    m.onBeforeCompile = sh => {
      sh.vertexShader = 'attribute vec2 rm;\nvarying vec2 vRM;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvRM = rm;');
      sh.fragmentShader = 'varying vec2 vRM;\n' + sh.fragmentShader
        .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = roughness * vRM.x;')
        .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = metalness * vRM.y;');
    };
    m.customProgramCacheKey = () => 'heroCloth';
    return MAT.cloth = m;
  }
  // 피부: 약한 따뜻한 자체광으로 속살 산란을 흉내 낸다
  function skinMat(hex) {
    return memo('skin' + hex, () => { const c = C(hex); return new T.MeshStandardMaterial({ color: c, roughness: 0.56, emissive: c.clone().multiply(C('#ff9a80')), emissiveIntensity: 0.045 }); });
  }
  function hairMat() { return MAT.hair || (MAT.hair = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.0 })); }
  function maskMat(hex) { return memo('mask' + hex, () => new T.MeshStandardMaterial({ color: C(hex), roughness: 0.32, metalness: 0.05 })); }
  // 영대: 정점색(바탕) × 무늬, 룬은 자체광 지도 (빛나는 판이면 시안)
  function stoleTex() {
    return memo('stoleTex', () => {
      const W = 64, Hh = 256, a = canvas(W, Hh), b = canvas(W, Hh), g = a.getContext('2d'), e = b.getContext('2d'), R = rng(5);
      g.fillStyle = '#fff'; g.fillRect(0, 0, W, Hh); e.fillStyle = '#000'; e.fillRect(0, 0, W, Hh);
      for (let i = 0; i < 1800; i++) { g.fillStyle = `rgba(0,0,0,${R() * 0.06})`; g.fillRect(R() * W, R() * Hh, 1, 2); }
      for (const ctx of [g, e]) {
        ctx.strokeStyle = ctx === g ? 'rgba(40,30,20,0.35)' : '#fff'; ctx.lineWidth = ctx === g ? 2.4 : 1.6; ctx.lineCap = 'round';
        // 12눈금 룬 고리와 짧은 획 (한 장에 둘)
        for (let k = 0; k < 2; k++) {
          const cy = 64 + k * 128, cx = 32;
          ctx.beginPath(); ctx.arc(cx, cy, 15, 0, TAU); ctx.stroke();
          for (let j = 0; j < 12; j++) { const an = j / 12 * TAU, r0 = 15, r1 = j % 3 ? 19 : 22; ctx.beginPath(); ctx.moveTo(cx + Math.cos(an) * r0, cy + Math.sin(an) * r0); ctx.lineTo(cx + Math.cos(an) * r1, cy + Math.sin(an) * r1); ctx.stroke(); }
          ctx.beginPath(); ctx.moveTo(cx, cy - 8); ctx.lineTo(cx, cy + 8); ctx.moveTo(cx - 6, cy - 2); ctx.lineTo(cx + 6, cy - 2); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(cx - 9, cy + 38); ctx.lineTo(cx, cy + 30); ctx.lineTo(cx + 9, cy + 38); ctx.stroke();
          ctx.beginPath(); ctx.arc(cx, cy - 38, 3, 0, TAU); ctx.stroke();
        }
      }
      const t1 = new T.CanvasTexture(a), t2 = new T.CanvasTexture(b);
      for (const t of [t1, t2]) { t.wrapS = t.wrapT = T.RepeatWrapping; t.encoding = T.sRGBEncoding; t.anisotropy = 4; }
      return [t1, t2];
    });
  }
  function stoleMat(glow) {
    return memo('stoleMat' + glow, () => {
      const [map, em] = stoleTex();
      return new T.MeshStandardMaterial({ vertexColors: true, map, emissiveMap: em, emissive: glow ? C('#7ff0ff') : C('#c9a45c'), emissiveIntensity: glow ? 2.2 : 0.22, roughness: 0.72 });
    });
  }

  // ===================================================================
  // 3. 형상 도구: 고리를 잇는 관(loft), 정점 묶음(GB)
  // ===================================================================
  const X1 = [1, 0, 0], Z1 = [0, 0, 1];
  // 고리를 이어 관을 만든다. ring: {c:[x,y,z], ax, ay(평면 두 축), w(ax 쪽 반폭), f(ay+ 깊이), b(ay- 깊이), a0/a1(열린 호), q(각짐)}
  // 각 0 = ay+ 방향(몸의 앞), 커질수록 ax+ 쪽으로 돈다. o.cols: 0..1 사이 열 위치, o.warp: 열 위치 휘기
  function loft(R, o = {}) {
    const n = R.length, cols = o.cols || null, M = cols ? cols.length - 1 : (o.seg || 16);
    const P = [], UV = [], IJ = [];
    let vacc = 0;
    for (let i = 0; i < n; i++) {
      const r = R[i], ax = r.ax || X1, ay = r.ay || Z1, c = r.c, a0 = r.a0 || 0, a1 = r.a1 ?? (TAU - a0), q = r.q || 1;
      if (i) vacc += Math.hypot(c[0] - R[i - 1].c[0], c[1] - R[i - 1].c[1], c[2] - R[i - 1].c[2]);
      let uacc = 0, px = 0, py = 0, pz = 0;
      for (let j = 0; j <= M; j++) {
        let t = cols ? cols[j] : j / M; if (o.warp) t = o.warp(t);
        const a = a0 + (a1 - a0) * t, s = Math.sin(a), co = Math.cos(a), d = co > 0 ? r.f : r.b;
        const sx = q === 1 ? s : Math.sign(s) * Math.pow(Math.abs(s), q), cz = q === 1 ? co : Math.sign(co) * Math.pow(Math.abs(co), q);
        const x = c[0] + ax[0] * sx * r.w + ay[0] * cz * d, y = c[1] + ax[1] * sx * r.w + ay[1] * cz * d, z = c[2] + ax[2] * sx * r.w + ay[2] * cz * d;
        if (j) uacc += Math.hypot(x - px, y - py, z - pz);
        px = x; py = y; pz = z;
        P.push(x, y, z); UV.push(uacc, vacc); IJ.push(n > 1 ? i / (n - 1) : 0, cols ? cols[j] : j / M);
      }
    }
    const I = [];
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < M; j++) { const a = i * (M + 1) + j, b = a + 1, c2 = a + M + 2, d = a + M + 1; I.push(a, b, c2, a, c2, d); }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(UV, 2)); g.setIndex(I);
    g.userData.ij = new Float32Array(IJ);
    g.computeVertexNormals();
    // 바깥을 향하게
    const mi = Math.floor((n - 1) / 2), r = R[mi], pa = g.attributes.position, na = g.attributes.normal;
    let dot = 0;
    for (let j = 0; j <= M; j += Math.max(1, M >> 2)) { const k = mi * (M + 1) + j; dot += (pa.getX(k) - r.c[0]) * na.getX(k) + (pa.getY(k) - r.c[1]) * na.getY(k) + (pa.getZ(k) - r.c[2]) * na.getZ(k); }
    if ((dot < 0) !== !!o.inward) { const ix = g.index.array; for (let k = 0; k < ix.length; k += 3) { const t = ix[k + 1]; ix[k + 1] = ix[k + 2]; ix[k + 2] = t; } g.computeVertexNormals(); }
    // 닫힌 고리의 이음매 법선을 맞춘다
    for (let i = 0; i < n; i++) {
      const r2 = R[i], a0 = r2.a0 || 0, a1 = r2.a1 ?? (TAU - a0);
      if (Math.abs(a1 - a0 - TAU) > 1e-3) continue;
      const k0 = i * (M + 1), k1 = k0 + M;
      _v1.set(na.getX(k0) + na.getX(k1), na.getY(k0) + na.getY(k1), na.getZ(k0) + na.getZ(k1)).normalize();
      na.setXYZ(k0, _v1.x, _v1.y, _v1.z); na.setXYZ(k1, _v1.x, _v1.y, _v1.z);
    }
    return g;
  }
  // 경로를 따라가는 관 (단면은 원). pts: [[x,y,z],...], rad: 숫자 또는 함수(t)
  function tube(pts, rad, seg = 8, o = {}) {
    const R = [], n = pts.length;
    let prevB = null;
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      const t = _v1.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
      let up = prevB ? _v2.copy(prevB) : _v2.set(0, 1, 0);
      if (Math.abs(up.dot(t)) > 0.95) up.set(1, 0, 0);
      const ax = _v3.crossVectors(up, t).normalize(), ay = _v4.crossVectors(t, ax).normalize();
      prevB = ay.clone();
      const r = typeof rad === 'function' ? rad(i / (n - 1)) : rad;
      R.push({ c: pts[i], ax: [ax.x, ax.y, ax.z], ay: [ay.x, ay.y, ay.z], w: r, f: r * (o.flat || 1), b: r * (o.flat || 1) });
    }
    return loft(R, { seg });
  }
  // 안쪽 면 (두께만큼 안으로, 법선 뒤집고 감김 반대로)
  function innerOf(g, th) {
    const h = g.clone(), p = h.attributes.position, n = h.attributes.normal;
    for (let i = 0; i < p.count; i++) { p.setXYZ(i, p.getX(i) - n.getX(i) * th, p.getY(i) - n.getY(i) * th, p.getZ(i) - n.getZ(i) * th); n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i)); }
    const ix = h.index.array; for (let k = 0; k < ix.length; k += 3) { const t = ix[k + 1]; ix[k + 1] = ix[k + 2]; ix[k + 2] = t; }
    h.userData.ij = g.userData.ij;
    return h;
  }
  function sphereG(r, ws = 8, hs = 6) { const g = new T.SphereGeometry(r, ws, hs); g.userData.ij = null; return g; }
  // 정점 묶음: 위치·법선·uv·팔레트 칸·뼈 가중치를 모아 BufferGeometry 하나로
  class GB {
    constructor(skin) { this.P = []; this.N = []; this.U = []; this.pid = []; this.SI = []; this.SW = []; this.I = []; this.skin = skin; }
    add(g, o = {}) {
      const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv, ij = g.userData.ij, m = o.m;
      const nm = m ? new T.Matrix3().getNormalMatrix(m) : null, flip = m ? m.determinant() < 0 : false, base = this.P.length / 3;
      const v = new T.Vector3(), nn = new T.Vector3();
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i); nn.fromBufferAttribute(n, i);
        if (m) { v.applyMatrix4(m); nn.applyMatrix3(nm).normalize(); }
        this.P.push(v.x, v.y, v.z); this.N.push(nn.x, nn.y, nn.z);
        this.U.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0);
        const a = ij ? ij[i * 2] : 0, b = ij ? ij[i * 2 + 1] : 0;
        this.pid.push(typeof o.pid === 'function' ? o.pid(v, a, b) : (o.pid || 0));
        if (this.skin) {
          let w = typeof o.w === 'function' ? o.w(v, a, b) : (o.w || [[0, 1]]);
          w = w.filter(x => x[1] > 1e-4).sort((x, y) => y[1] - x[1]).slice(0, 4);
          const s = w.reduce((t, x) => t + x[1], 0) || 1;
          for (let k = 0; k < 4; k++) { this.SI.push(w[k] ? w[k][0] : 0); this.SW.push(w[k] ? w[k][1] / s : 0); }
        }
      }
      const ix = g.index ? g.index.array : null, cnt = ix ? ix.length : p.count;
      for (let k = 0; k < cnt; k += 3) {
        const a = ix ? ix[k] : k, b = ix ? ix[k + 1] : k + 1, c = ix ? ix[k + 2] : k + 2;
        if (flip) this.I.push(base + a, base + c, base + b); else this.I.push(base + a, base + b, base + c);
      }
      return this;
    }
    build() {
      const g = new T.BufferGeometry(), n = this.P.length / 3;
      g.setAttribute('position', new T.Float32BufferAttribute(this.P, 3));
      g.setAttribute('normal', new T.Float32BufferAttribute(this.N, 3));
      g.setAttribute('uv', new T.Float32BufferAttribute(this.U, 2));
      if (this.skin) { g.setAttribute('skinIndex', new T.Uint16BufferAttribute(this.SI, 4)); g.setAttribute('skinWeight', new T.Float32BufferAttribute(this.SW, 4)); }
      const rm = new Float32Array(n * 2);
      for (let i = 0; i < n; i++) { const r = RM[this.pid[i]] || RM[0]; rm[i * 2] = r[0]; rm[i * 2 + 1] = r[1]; }
      g.setAttribute('rm', new T.BufferAttribute(rm, 2));
      g.setIndex(n > 65535 ? new T.Uint32BufferAttribute(this.I, 1) : new T.Uint16BufferAttribute(this.I, 1));
      g.userData.pid = Uint8Array.from(this.pid);
      return g;
    }
  }
  // 같은 형상 + 팔레트별 정점색 (위치·법선·뼈 속성은 나눠 쓴다)
  function colorize(g, pal) {
    const key = g.uuid + pal.key;
    return memo(key, () => {
      const h = new T.BufferGeometry();
      for (const k in g.attributes) h.setAttribute(k, g.attributes[k]);
      h.setIndex(g.index);
      const pid = g.userData.pid, col = new Float32Array(pid.length * 3);
      for (let i = 0; i < pid.length; i++) { const c = pal.c[pid[i]]; col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
      h.setAttribute('color', new T.BufferAttribute(col, 3));
      h.boundingSphere = g.boundingSphere; h.boundingBox = g.boundingBox;
      return h;
    });
  }
  const M4 = (x = 0, y = 0, z = 0, sx = 1, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0) => new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(rx, ry, rz)), new T.Vector3(sx, sy, sz));
  function ringAt(R, y) {
    if (y <= R[0].c[1]) return R[0];
    for (let i = 1; i < R.length; i++) if (y <= R[i].c[1]) { const a = R[i - 1], b = R[i], t = (y - a.c[1]) / (b.c[1] - a.c[1]); return { w: lp(a.w, b.w, t), f: lp(a.f, b.f, t), b: lp(a.b, b.b, t), c: [0, y, 0] }; }
    return R[R.length - 1];
  }
  // 열 위치: 양 끝 가장자리(d)에 단을 두르는 경계를 넣는다
  function edgeCols(n, d) { const a = [0, d]; for (let i = 0; i <= n; i++) a.push(d + 0.003 + (1 - 2 * d - 0.006) * i / n); a.push(1 - d, 1); return a; }
  const frontWarp = t => t - 0.42 * Math.sin(TAU * t) / TAU;   // 앞(0, 1)에 촘촘하게

  // ===================================================================
  // 4. 생김새 해석: look → 비율·색·옷·얼굴
  // ===================================================================
  const TRIMS = ['#8E3B35', '#5D6B3A', '#B08A3A', '#4A6A8A'];
  const SKINS = ['#f1d3ba', '#ecc6a4', '#dcae88', '#c8956c', '#a87650', '#7f5338', '#5e3c28', '#f5dcc8'];
  const IRIS = ['#5a3d2a', '#6e5032', '#3f5e74', '#55663e', '#3a2a22', '#7a5c3a', '#4f6b7d', '#46362c'];
  const HAIRS = ['#2a1f18', '#3a2a20', '#5a3a22', '#7a4a2a', '#a8742e', '#c8a060', '#1a1a1e', '#8a5a3a'];
  const isLook = (name, look, key) => { try { const L = (0, eval)(name); return L === look || JSON.stringify(L) === key; } catch (e) { return false; } };
  function dims(sp) {
    const h = sp.H, lk = sp.legK, tk = sp.torK, D = { s: h };
    D.ankleY = 0.075 * h; D.shin = 0.40 * h * lk; D.thigh = 0.42 * h * lk;
    D.kneeY = D.ankleY + D.shin; D.hipY = D.kneeY + D.thigh; D.hipX = 0.088 * h * sp.hipK;
    D.waistY = D.hipY + 0.105 * h * tk; D.chestY = D.waistY + 0.2 * h * tk; D.shY = D.chestY + 0.2 * h * tk; D.neckY = D.chestY + 0.23 * h * tk;
    D.atlasY = D.neckY + 0.075 * h * sp.neckK; D.atlasZ = 0.004 * h;
    D.shX = 0.175 * h * sp.shK; D.shZ = -0.01 * h;
    D.upper = 0.29 * h; D.fore = 0.25 * h; D.hand = 0.18 * h;
    D.hk = sp.headK * h;
    D.eyeY = D.atlasY + 0.095 * D.hk; D.eyeZ = D.atlasZ + 0.012 * D.hk;
    D.top = D.eyeY + 0.122 * D.hk;
    return D;
  }
  function spec(look, o) {
    const key = JSON.stringify(look);
    const seed = (hashStr(key) ^ (look.seed !== undefined ? Math.imul((look.seed | 0) + 1, 2654435761) : 0)) >>> 0;
    const R = rng(seed), ghost = !!o.ghost;
    const ren = !!o.rod || look.cloak === '#2f7f7a';
    const mira = isLook('MIRA_LOOK', look, key), oswin = isLook('OSWIN_LOOK', look, key), kass = isLook('KASSIAN_LOOK', look, key);
    const hairHex = look.hair || '#4a3324', hh = HSL(hairHex);
    const child = (look.scale || 1) < 0.9 || look.age === 'child';
    const elder = !child && (oswin || look.age === 'elder' || (hh.l > 0.5 && hh.s < 0.2));
    const cloak = (look.cloak || '#3b6ea8').toLowerCase();
    const uniform = cloak === '#3b6ea8' || cloak === '#262a3f';
    const town = !uniform && !ren && !!look.legs && !look.trim;
    const fem = look.fem !== undefined ? (look.fem ? 1 : 0) : ren || kass || oswin ? 0 : mira ? 1 : R() < 0.5 ? 1 : 0;
    const sp = { key, seed, R, ren, ghost, child, elder, fem, town, uniform, mira, oswin, kass };
    sp.H = ren ? 1 : (fem ? 0.955 : 1) * (0.975 + R() * 0.05);
    sp.legK = child ? 0.93 : 1 + (R() - 0.5) * 0.03; sp.torK = 1; sp.neckK = child ? 0.9 : fem ? 1.04 : 1;
    sp.shK = (fem ? 0.9 : 1) * (1 + (R() - 0.5) * 0.05); sp.hipK = fem ? 1.06 : 1; sp.wK = (elder ? 1.05 : 1) * (1 + (R() - 0.5) * 0.07); sp.headK = child ? 1.08 : 1.04;
    if (ren) { sp.shK = 1; sp.wK = 1; sp.legK = 1; }
    sp.D = dims(sp);
    // 색
    const trim = look.trim || (uniform ? (ren ? '#4A6A8A' : pick(R, TRIMS)) : null);
    let robe, lining, piping;
    if (ren && cloak === '#2f7f7a') { robe = '#1F3A4A'; lining = '#5e4a30'; piping = '#E7DFCF'; }
    else if (uniform) { robe = '#262A3F'; lining = trim; piping = hsl(trim, 0.9, 1.35); }
    else { robe = hsl(cloak, town ? 0.6 : 0.72, town ? 0.92 : 0.86); lining = trim || hsl(cloak, 0.55, 0.6, 0.03); piping = trim ? hsl(trim, 0.9, 1.3) : (town ? hsl(cloak, 0.5, 0.7) : '#cfc2a4'); }
    const shirt = hsl(look.body || '#e8e0cf', 0.7, ren ? 0.95 : 0.93);
    const vest = ren ? '#2C2830' : pick(R, ['#2f2a2e', '#3a3226', '#2a3034', '#3b2b2b', '#463a2c']);
    const trou = look.legs ? hsl(look.legs, 0.8, 0.95) : ren ? '#2E2A28' : pick(R, ['#34302c', '#2c2f36', '#3d352e', '#45403a']);
    const boot = ren ? '#3E2A1E' : pick(R, ['#3a2a20', '#2a2422', '#4a3424', '#2e2a28']);
    const strap = ren ? '#5C3E26' : pick(R, ['#5c3e26', '#6a4a2e', '#4a3424']);
    // 영대
    let stole = null, stoleGlow = false, stole2 = '#c9a45c';
    if (look.scarf) { stoleGlow = /7ff0ff/i.test(look.scarf); stole = stoleGlow ? '#2C6670' : hsl(look.scarf, 0.75, 0.85); stole2 = stoleGlow ? '#9ff4ff' : '#E7DFCF'; }
    else if (ren) { stole = '#CFC2A4'; stole2 = '#1F3A4A'; }
    else if (!town && !ghost && R() < (elder ? 0.45 : 0.2)) { stole = hsl(trim || pick(R, TRIMS), 0.9, 1.05); stole2 = '#d8cbb0'; }
    sp.stole = ghost ? null : stole; sp.stoleGlow = stoleGlow;
    sp.skin = look.skin || (ren ? '#e3bb98' : oswin ? '#f0d0b0' : SKINS[Math.floor(R() * SKINS.length)]);
    sp.hairC = hsl(hairHex, 0.9, 1);
    sp.mask = look.mask ? hsl(look.mask, 0.8, 1.05) : null; sp.crack = !!look.crack;
    sp.hood = ghost || look.mask ? 'up' : ren ? 'down' : town ? (R() < 0.45 ? 'down' : null) : R() < (elder ? 0.3 : 0.42) ? 'down' : null;
    sp.cape = ghost || ren || (!town && R() < (elder ? 0.9 : 0.55));
    sp.satchel = !ghost && (ren || R() < (town ? 0.2 : 0.3));
    sp.vest = ren || R() < 0.6;
    sp.boots = ren ? 'knee' : town ? (R() < 0.5 ? 'knee' : 'shoe') : (R() < 0.4 ? 'knee' : 'shoe');
    sp.hem = ren ? 0.3 : child ? 0.32 : town ? 0.44 + R() * 0.1 : elder ? 0.12 + R() * 0.06 : 0.2 + R() * 0.14;
    sp.hemW = ren ? 0.29 : town ? 0.24 + R() * 0.03 : 0.26 + R() * 0.05;
    sp.hemGap = ren ? 0.15 : ghost ? 0.03 : town ? 0.08 + R() * 0.04 : 0.11 + R() * 0.06;
    sp.bell = ren ? 0.115 : town ? 0.08 + R() * 0.012 : elder ? 0.13 : 0.1 + R() * 0.025;
    sp.hat = look.hat || null;
    sp.hatStyle = !sp.hat ? null : HSL(sp.hat).l > 0.85 ? 'toque' : pick(R, ['tall', 'cap', 'brim', 'tall']);
    const pal = {
      [PI_.SHIRT]: shirt, [PI_.VEST]: vest, [PI_.TROU]: trou, [PI_.ROBE]: robe, [PI_.LINE]: lining, [PI_.TRIM]: piping, [PI_.BRASS]: '#C9A45C',
      [PI_.BOOT]: boot, [PI_.STRAP]: strap, [PI_.SOLE]: '#1e1814', [PI_.BELT]: '#2a1e16', [PI_.CAPE]: robe, [PI_.STOLE]: stole || '#888', [PI_.STOLE2]: stole2,
      [PI_.HAT]: sp.hat ? hsl(sp.hat, 0.75, 0.95) : '#333', [PI_.BAND]: sp.hat ? hsl(sp.hat, 0.6, 0.55) : '#222', [PI_.WOOD]: '#3a2618', [PI_.IRON]: '#3a3a40', [PI_.PAGE]: '#d8ccb0', [PI_.SAIL]: robe,
    };
    sp.pal = { key: Object.keys(pal).map(k => pal[k]).join(''), c: Object.keys(pal).map(k => C(pal[k])) };
    sp.palHex = pal;
    // 머리 모양
    const fstyles = ['long', 'pony', 'bun', 'bob', 'braid', 'curly', 'long', 'pony'], mstyles = ['crop', 'side', 'curly', 'short', 'side', 'crop'];
    sp.hair = ren ? 'crop' : mira ? 'long' : kass ? 'side' : elder ? 'elder' : child ? (fem ? pick(R, ['pony', 'bob', 'braid']) : 'crop') : fem ? pick(R, fstyles) : pick(R, mstyles);
    sp.beard = oswin || (elder && !fem && R() < 0.6) ? 'full' : (!fem && !child && !ren && R() < 0.12) ? 'short' : null;
    // 머리(두개골) 생김새
    const jit = (a, b) => lp(a, b, R());
    sp.headP = ren ? { w: 1, jaw: 0.95, chinW: 0.86, chin: 1.1, nose: 1.0, noseW: 1, brow: 1, cheek: 1, lip: 0.95, sq: 2.55 }
      : child ? { w: 1.03, jaw: 0.9, chinW: 0.95, chin: 0.8, nose: 0.72, noseW: 0.9, brow: 0.6, cheek: 1.2, lip: 1, sq: 2.3 }
        : { w: +jit(0.96, 1.03).toFixed(2), jaw: +(fem ? jit(0.86, 0.93) : jit(0.92, 1.0)).toFixed(2), chinW: +jit(0.82, 0.98).toFixed(2), chin: +jit(0.85, 1.15).toFixed(2), nose: +((fem ? 0.86 : 1) * jit(0.88, 1.15) * (elder ? 1.12 : 1)).toFixed(2), noseW: +jit(0.9, 1.15).toFixed(2), brow: +(fem ? 0.75 : jit(0.9, 1.25)).toFixed(2), cheek: +jit(0.8, 1.2).toFixed(2), lip: +((fem ? 1.12 : 0.95) * (elder ? 0.75 : 1)).toFixed(2), sq: +jit(2.35, 2.65).toFixed(2) };
    // 그린 얼굴
    const sk = srgb(sp.skin), hc = srgb(sp.hairC);
    const browC = HSL(sp.hairC).l > 0.55 ? hc.map(v => v * 0.72) : hc.map(v => v * 0.62);
    const lipC = [lp(sk[0], 190, 0.35), lp(sk[1], 92, 0.35), lp(sk[2], 88, 0.35)];
    sp.face = ren ? { ex: 0.032, ew: 0.0172, eh: 0.0084, el: 0.0049, tilt: 0.001, ir: 0.0071, iris: srgb('#6a4a2c'), by: 0.0205, ba: 0.0024, bt: 0.0046, browC: srgb('#24170f'), my: -0.066, mw: 0.022, lu: 0.0034, ll: 0.005, lipC: [lp(sk[0], 170, 0.4), lp(sk[1], 85, 0.4), lp(sk[2], 75, 0.4)], blush: 0.13, lash: 0.0017, lashC: [26, 16, 12], fem: 0, age: 0, freck: 6, stub: 0, sclera: [236, 230, 222], skin: sk, seed: 11 }
      : {
        ex: 0.0318 * (child ? 1.02 : 1), ew: +(jit(0.0158, 0.0175) * (child ? 1.1 : 1)).toFixed(4), eh: +(jit(0.0074, 0.0088) + fem * 0.0007).toFixed(4), el: +jit(0.0044, 0.0052).toFixed(4), tilt: +jit(-0.0004, 0.0016).toFixed(4),
        ir: +(jit(0.0066, 0.0072) * (child ? 1.08 : 1)).toFixed(4), iris: srgb(pick(R, IRIS)), by: +jit(0.018, 0.022).toFixed(4), ba: +jit(0.0012, 0.0036).toFixed(4), bt: +((fem ? jit(0.0028, 0.0036) : jit(0.0038, 0.005)) * (child ? 0.85 : 1)).toFixed(4),
        browC, my: -0.066, mw: +jit(0.019, 0.0235).toFixed(4), lu: +((fem ? 0.0036 : 0.0029) * (elder ? 0.7 : 1)).toFixed(4), ll: +((fem ? 0.0054 : 0.0045) * (elder ? 0.75 : 1)).toFixed(4), lipC: fem ? [lp(sk[0], 185, 0.45), lp(sk[1], 80, 0.45), lp(sk[2], 85, 0.45)] : lipC,
        blush: +((child ? 0.2 : fem ? 0.16 : 0.1) * jit(0.7, 1.2)).toFixed(3), lash: fem ? 0.0021 : 0.0016, lashC: [24, 15, 12], fem, age: elder ? 1 : 0,
        freck: R() < 0.25 ? 10 + (R() * 30 | 0) : 0, stub: !fem && !child && !elder && R() < 0.3 ? 0.12 : 0, sclera: [234, 228, 220], skin: sk, seed: seed % 997,
      };
    if (sp.beard) sp.face.stub = 0.1;
    sp.bkey = [sp.H, sp.legK, sp.shK, sp.hipK, sp.wK, sp.fem, sp.child, sp.cape, sp.hood, sp.satchel, sp.vest, sp.boots, !!sp.stole, sp.town].join('|');
    return sp;
  }

  // ===================================================================
  // 5. 몸 (옷 한 벌 = SkinnedMesh 하나)
  // ===================================================================
  const B = { hips: 0, torso: 1, chest: 2, neck: 3, head: 4, armL: 5, foreL: 6, handL: 7, armR: 8, foreR: 9, handR: 10, legL: 11, shinL: 12, footL: 13, legR: 14, shinR: 15, footR: 16 };
  function torsoRings(D, sp, off = 0) {
    const h = D.s, f = sp.fem, wk = sp.wK, sk = sp.shK;
    return [
      [D.hipY - 0.085 * h, 0.150, 0.080, 0.096], [D.hipY - 0.035 * h, 0.160 + 0.01 * f, 0.088, 0.106 + 0.008 * f], [D.hipY + 0.02 * h, 0.162 + 0.012 * f, 0.090, 0.104 + 0.006 * f],
      [D.waistY - 0.03 * h, 0.148 + 0.002 * f, 0.087, 0.092], [D.waistY + 0.02 * h, 0.139 - 0.014 * f, 0.086 - 0.004 * f, 0.086 - 0.004 * f], [D.waistY + 0.10 * h, 0.143 - 0.008 * f, 0.094 + 0.006 * f, 0.086],
      [D.chestY + 0.05 * h, 0.151 - 0.008 * f, 0.104 + 0.018 * f, 0.090], [D.chestY + 0.12 * h, 0.155 - 0.01 * f, 0.100 + 0.008 * f, 0.092],
      [D.shY - 0.035 * h, 0.165 * sk, 0.085, 0.088], [D.shY + 0.01 * h, 0.168 * sk, 0.062, 0.070], [D.neckY + 0.02 * h, 0.105, 0.052, 0.057], [D.neckY + 0.035 * h, 0.062, 0.046, 0.048],
    ].map(([y, w, ff, b]) => ({ c: [0, y, 0], w: w * h * wk + off, f: ff * h * wk + off, b: b * h * wk + off }));
  }
  function capeRings(D, sp) {
    const h = D.s, k = sp.shK, f = sp.fem * 0.012;
    return [[D.neckY + 0.05 * h, 0.071, 0.063, 0.068, 0], [D.neckY + 0.032 * h, 0.13, 0.093, 0.104, 0], [D.shY + 0.042 * h, 0.205 * k, 0.126 + f, 0.13, 0],
      [D.shY - 0.03 * h, 0.232 * k, 0.15 + f, 0.155, 0.22], [D.shY - 0.112 * h, 0.24 * k, 0.162 + f, 0.168, 0.36], [D.shY - 0.124 * h, 0.241 * k, 0.163 + f, 0.17, 0.38], [D.shY - 0.14 * h, 0.242 * k, 0.164 + f, 0.172, 0.4]]
      .map(([y, w, ff, b, a0]) => ({ c: [0, y, 0], w: w * h * sp.wK, f: ff * h * sp.wK, b: b * h * sp.wK, a0 }));
  }
  // 겉면(망토·몸판)의 단면: 영대·가방끈이 그 위에 얹힌다
  function outerAt(D, sp, y) {
    const tr = torsoRings(D, sp, 0.016 * D.s), a = ringAt(tr, y);
    if (!sp.cape) return a;
    const cr = capeRings(D, sp);
    if (y < cr[cr.length - 1].c[1] || y > cr[0].c[1]) return a;
    const c = ringAt(cr.slice().reverse(), y);
    return { w: Math.max(a.w, c.w), f: Math.max(a.f, c.f), b: Math.max(a.b, c.b) };
  }
  // 가방 자리 (몸 기준): 왼 엉덩이 옆 조금 뒤, 치마 바깥
  function satPos(D, sp) { const r = Math.max(outerAt(D, sp, D.hipY).w, sp.hemW * 0.62 * D.s) + 0.06 * D.s; return [-r * 0.93, D.hipY - 0.02 * D.s, -0.075 * D.s]; }
  function torsoW(D) {
    const h = D.s;
    return p => {
      const y = p.y, ax = Math.abs(p.x), L = p.x < 0;
      const wh = 1 - ss(D.hipY + 0.02 * h, D.waistY + 0.01 * h, y);
      let wc = ss(D.waistY + 0.07 * h, D.chestY + 0.06 * h, y);
      const wt = Math.max(0, 1 - wh - wc);
      const wn = ss(D.neckY - 0.005 * h, D.neckY + 0.045 * h, y) * 0.7;
      const wa = ss(D.shX - 0.075 * h, D.shX + 0.005 * h, ax) * ss(D.shY - 0.1 * h, D.shY - 0.01 * h, y) * 0.55;
      wc = Math.max(0, wc - wn - wa);
      return [[B.hips, wh], [B.torso, wt], [B.chest, wc], [B.neck, wn], [L ? B.armL : B.armR, wa]];
    };
  }
  function armW(D, L) {
    const a = L ? B.armL : B.armR, h = D.s;
    return p => {
      const s = D.shY - p.y;
      const we = ss(D.upper - 0.05 * h, D.upper + 0.03 * h, s), wh = ss(D.upper + D.fore - 0.01 * h, D.upper + D.fore + 0.02 * h, s);
      const wch = (1 - ss(-0.01 * h, 0.06 * h, s)) * 0.4;
      return [[B.chest, wch], [a, (1 - we) * (1 - wch)], [a + 1, we * (1 - wh)], [a + 2, wh]];
    };
  }
  function legW(D, L) {
    const b = L ? B.legL : B.legR, h = D.s;
    return p => {
      const y = p.y;
      const ws = 1 - ss(D.kneeY - 0.05 * h, D.kneeY + 0.045 * h, y), wf = (1 - ss(D.ankleY + 0.005 * h, D.ankleY + 0.05 * h, y)) * 0.6, wh = ss(D.hipY - 0.09 * h, D.hipY + 0.03 * h, y) * 0.5;
      return [[B.hips, wh], [b, (1 - ws) * (1 - wh)], [b + 1, ws * (1 - wf)], [b + 2, ws * wf]];
    };
  }
  function bodyGeo(sp) {
    return memo('body' + sp.bkey, () => {
      const D = sp.D, h = D.s, gb = new GB(true), tw = torsoW(D);
      const tr = torsoRings(D, sp);
      // 몸통: 셔츠·조끼·허리띠·바지 윗부분
      const vneck = y => ss(D.chestY + 0.02 * h, D.neckY + 0.02 * h, y) * 0.06 * h;
      gb.add(loft(tr, { seg: 20, warp: frontWarp }), { w: tw, pid: p => p.y < D.waistY - 0.034 * h ? PI_.TROU : p.y < D.waistY - 0.004 * h ? PI_.BELT : sp.vest && !(p.z > 0 && Math.abs(p.x) < vneck(p.y)) ? PI_.VEST : PI_.SHIRT });
      const front = y => ringAt(tr, y).f;
      if (sp.vest) for (let i = 0; i < 4; i++) { const y = D.waistY + (0.035 + i * 0.042) * h; gb.add(sphereG(0.0062 * h, 5, 3), { m: M4(0, y, front(y) + 0.002 * h), w: tw, pid: PI_.BRASS }); }
      gb.add(new T.BoxGeometry(0.036 * h, 0.026 * h, 0.008 * h), { m: M4(0, D.waistY - 0.019 * h, front(D.waistY - 0.019 * h) + 0.003 * h), w: tw, pid: PI_.BRASS });
      // 셔츠 깃
      const col = loft([{ c: [0, D.neckY - 0.008 * h, 0.002], w: 0.066 * h, f: 0.062 * h, b: 0.06 * h, a0: 0.42 }, { c: [0, D.neckY + 0.034 * h, 0.004], w: 0.06 * h, f: 0.058 * h, b: 0.057 * h, a0: 0.5 }], { seg: 14 });
      gb.add(col, { w: tw, pid: PI_.SHIRT }); gb.add(innerOf(col, 0.003 * h), { w: tw, pid: PI_.SHIRT });
      // 로브 몸판 (앞이 트임)
      const by = [D.waistY - 0.05 * h, D.waistY + 0.02 * h, D.waistY + 0.10 * h, D.chestY + 0.05 * h, D.chestY + 0.12 * h, D.shY - 0.035 * h, D.shY + 0.014 * h, D.neckY + 0.03 * h];
      const gap = y => lp(0.085, 0.048, ss(D.waistY, D.neckY, y)) * h * (sp.town ? 0.6 : 1);
      const br = by.map((y, i) => { const r = ringAt(tr, y), o = (0.014 + (i < 2 ? 0.006 : 0)) * h, w = r.w + o; return { c: [0, y, 0], w, f: r.f + o, b: r.b + o, a0: Math.asin(Math.min(0.92, gap(y) / w)) }; });
      const cols = edgeCols(16, 0.014), isEdge = (a, b) => b < 0.0141 || b > 0.9859;
      const bod = loft(br, { cols });
      gb.add(bod, { w: tw, pid: (p, a, b) => isEdge(a, b) ? PI_.TRIM : PI_.ROBE });
      for (const [c0, c1] of [[0, 0.2], [0.8, 1]]) gb.add(innerOf(loft(br, { cols: cols.filter(c => c >= c0 - 1e-6 && c <= c1 + 1e-6) }), 0.004 * h), { w: tw, pid: (p, a, b) => isEdge(a, b) ? PI_.TRIM : PI_.LINE });   // 안감은 앞섶 근처만 보인다
      // 위팔 소매(로브), 아래팔 셔츠
      for (const sg of [-1, 1]) {
        const L = sg < 0, x = sg * D.shX;
        const us = [[-0.047, 0.004], [-0.03, 0.043], [-0.004, 0.06], [0.06, 0.064], [0.15, 0.062], [D.upper / h - 0.02, 0.062], [D.upper / h + 0.035, 0.066]];
        gb.add(loft(us.map(([s, r]) => ({ c: [x, D.shY - s * h, D.shZ], w: r * h * sp.wK, f: r * h * sp.wK, b: r * h * sp.wK })), { seg: 10 }), { w: armW(D, L), pid: PI_.ROBE });
        const fs = [[D.upper / h - 0.03, 0.046], [D.upper / h + 0.06, 0.04], [D.upper / h + D.fore / h - 0.02, 0.031], [D.upper / h + D.fore / h - 0.005, 0.035], [D.upper / h + D.fore / h + 0.012, 0.034], [D.upper / h + D.fore / h + 0.014, 0.022]];
        gb.add(loft(fs.map(([s, r]) => ({ c: [x, D.shY - s * h, D.shZ], w: r * h, f: r * h, b: r * h })), { seg: 8 }), { w: armW(D, L), pid: PI_.SHIRT });
      }
      // 어깨 망토
      if (sp.cape) {
        const cr = capeRings(D, sp), n = cr.length;
        const cp = loft(cr, { cols: edgeCols(18, 0.012) });
        const pid = (lin) => (p, a, b) => a > (n - 2.5) / (n - 1) || (cr[Math.round(a * (n - 1))].a0 > 0 && (b < 0.0121 || b > 0.9879)) ? PI_.TRIM : lin ? PI_.LINE : PI_.CAPE;
        gb.add(cp, { w: tw, pid: pid(0) }); gb.add(innerOf(loft(cr.slice(2), { cols: edgeCols(18, 0.012) }), 0.004 * h), { w: tw, pid: (p, a, b) => a > (cr.length - 3.5) / (cr.length - 3) || b < 0.0121 || b > 0.9879 ? PI_.TRIM : PI_.LINE });
        // 망토 앞 걸쇠 (황동)
        gb.add(new T.CylinderGeometry(0.013 * h, 0.013 * h, 0.006 * h, 10).rotateX(PI / 2), { m: M4(0, D.shY + 0.0 * h, ringAt(cr.slice().reverse(), D.shY).f + 0.004 * h), w: tw, pid: PI_.BRASS });
      }
      // 두건: 내려 둔 것 (목 뒤 말림 + 등에 놓인 자루)
      if (sp.hood === 'down') {
        const yb = D.neckY + 0.05 * h, rr = [];
        for (let k = 0; k <= 10; k++) { const a = lp(1.85, TAU - 1.85, k / 10), rx = 0.098 * h, rz = 0.094 * h; rr.push({ c: [Math.sin(a) * rx, yb - 0.004 * h * Math.cos(a), Math.cos(a) * rz], ax: [Math.sin(a), 0, Math.cos(a)], ay: [0, 1, 0], w: 0.024 * h, f: 0.022 * h, b: 0.02 * h }); }
        rr[0].w = rr[0].f = rr[0].b = rr[10].w = rr[10].f = rr[10].b = 0.004 * h;
        gb.add(loft(rr, { seg: 8 }), { w: tw, pid: PI_.CAPE });
        const back = y => outerAt(D, sp, y).b + 0.012 * h, bag = [];
        const ys = [D.neckY + 0.05 * h, D.neckY + 0.0, D.shY - 0.06 * h, D.shY - 0.16 * h, D.shY - 0.22 * h, D.shY - 0.235 * h];
        const ws = [0.095, 0.105, 0.09, 0.055, 0.02, 0.004];
        ys.forEach((y, i) => bag.push({ c: [0, y, -back(y) - 0.006 * h], w: ws[i] * h, f: 0.008 * h, b: (i ? 0.018 : 0.016) * h * (1 - i / 7) }));
        const hb = loft(bag, { seg: 12 });
        gb.add(hb, { w: tw, pid: PI_.CAPE });
        gb.add(loft([{ c: [0, ys[0] - 0.004 * h, -back(ys[0]) - 0.005 * h], w: 0.1 * h, f: 0.02 * h, b: 0.02 * h, a0: 2.1, a1: TAU - 2.1 }, { c: [0, ys[1], -back(ys[1]) - 0.006 * h], w: 0.112 * h, f: 0.02 * h, b: 0.025 * h, a0: 2.1, a1: TAU - 2.1 }], { seg: 6, inward: true }), { w: tw, pid: PI_.LINE });
      }
      // 두건: 쓴 것 (머리 뼈 기준)
      if (sp.hood === 'up') {
        const hk = D.hk, ey = D.eyeY, ez = D.eyeZ, hr = [];
        const rows = [[0.152, 0.02, 0.02, 0.02, 0], [0.135, 0.085, 0.095, 0.11, 0], [0.09, 0.11, 0.115, 0.13, 0.55], [0.02, 0.118, 0.125, 0.135, 0.85], [-0.05, 0.112, 0.12, 0.13, 0.9], [-0.11, 0.1, 0.11, 0.12, 0.8], [-0.16, 0.115, 0.1, 0.12, 0.5]];
        rows.forEach(([y, w, f, b, a0]) => hr.push({ c: [0, ey + y * hk, ez - 0.012 * hk + (y > 0.12 ? -0.02 * hk : 0)], w: w * hk, f: f * hk, b: b * hk, a0 }));
        const hood = loft(hr, { cols: edgeCols(22, 0.015) });
        const hw = p => { const t = ss(D.atlasY - 0.06 * h, D.atlasY + 0.03 * h, p.y); return [[B.head, t], [B.neck, (1 - t) * 0.6], [B.chest, (1 - t) * 0.4]]; };
        gb.add(hood, { w: hw, pid: PI_.CAPE }); gb.add(innerOf(hood, 0.005 * h), { w: hw, pid: PI_.LINE });
      }
      // 영대의 목 뒤 부분 (늘어진 두 끝은 사슬 물리)
      if (sp.stole) {
        const y0 = D.neckY + 0.04 * h, y1 = D.neckY + 0.012 * h, o0 = outerAt(D, sp, y0), o1 = outerAt(D, sp, y1);
        const sb = loft([{ c: [0, y1, 0], w: o1.w + 0.008 * h, f: o1.f + 0.008 * h, b: o1.b + 0.008 * h, a0: 0.75 }, { c: [0, y0, 0], w: o0.w + 0.008 * h, f: o0.f + 0.008 * h, b: o0.b + 0.008 * h, a0: 0.75 }], { seg: 18 });
        gb.add(sb, { w: tw, pid: PI_.STOLE }); gb.add(innerOf(sb, 0.003 * h), { w: tw, pid: PI_.STOLE });
      }
      // 가방끈 (오른 어깨 → 왼 엉덩이) 과 가방
      if (sp.satchel) {
        const A = new T.Vector3(0.12 * h, D.shY + 0.03 * h, 0), Bp = new T.Vector3(-0.17 * h, D.waistY + 0.0 * h, 0), ctr = A.clone().add(Bp).multiplyScalar(0.5);
        const u = Bp.clone().sub(A).multiplyScalar(0.5), pts = [], nrm = [];
        for (let k = 0; k <= 28; k++) {
          const t = k / 28 * TAU, p = ctr.clone().addScaledVector(u, Math.cos(t)), z = Math.sin(t);
          const o = outerAt(D, sp, p.y), ang = Math.atan2(p.x, z), rx = o.w + 0.008 * h, rz = (z > 0 ? o.f : o.b) + 0.008 * h;
          const px = Math.sin(ang) * rx, pz = Math.cos(ang) * rz;
          pts.push([px, p.y, pz]); nrm.push([Math.sin(ang), 0, Math.cos(ang)]);
        }
        const P = [], I = [], wd = 0.017 * h, dir = u.clone().normalize();
        const side = new T.Vector3();
        pts.forEach((p, k) => { const n = new T.Vector3(...nrm[k]); side.crossVectors(n, new T.Vector3(...pts[(k + 1) % 28]).sub(new T.Vector3(...p))).normalize(); if (side.dot(new T.Vector3(0, 1, 0)) < 0) side.negate(); P.push(p[0] + side.x * wd, p[1] + side.y * wd, p[2] + side.z * wd, p[0] - side.x * wd, p[1] - side.y * wd, p[2] - side.z * wd); });
        for (let k = 0; k < 28; k++) { const a = k * 2; I.push(a, a + 1, a + 3, a, a + 3, a + 2); }
        const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.Float32BufferAttribute(P, 3)); sg.setIndex(I); sg.computeVertexNormals();
        let flip = 0; { const na = sg.attributes.normal; flip = na.getX(0) * nrm[0][0] + na.getZ(0) * nrm[0][2] < 0; }
        if (flip) { const ix = sg.index.array; for (let k = 0; k < ix.length; k += 3) { const t = ix[k + 1]; ix[k + 1] = ix[k + 2]; ix[k + 2] = t; } sg.computeVertexNormals(); }
        sg.setAttribute('uv', new T.Float32BufferAttribute(new Float32Array(P.length / 3 * 2), 2)); sg.userData.ij = null;
        gb.add(sg, { w: tw, pid: PI_.STRAP });
        void dir;
        // 가방: 둥근 상자 + 덮개 + 걸쇠
        const bx = new T.BoxGeometry(0.065 * h, 0.17 * h, 0.21 * h, 2, 4, 5), bp = bx.attributes.position, half = [0.0325 * h, 0.085 * h, 0.105 * h], rr = 0.018 * h;
        for (let i = 0; i < bp.count; i++) { const v = [bp.getX(i), bp.getY(i), bp.getZ(i)], q = v.map((x, k) => cl(x, -half[k] + rr, half[k] - rr)), d = v.map((x, k) => x - q[k]), l = Math.hypot(...d) || 1; bp.setXYZ(i, q[0] + d[0] / l * rr, q[1] + d[1] / l * rr, q[2] + d[2] / l * rr); }
        bx.computeVertexNormals(); bx.userData.ij = null;
        const sP = satPos(D, sp), sm = M4(sP[0], sP[1], sP[2], 1, 1, 1, 0, -0.42, 0.1);
        gb.add(bx, { m: sm, w: [[B.hips, 1]], pid: PI_.STRAP });
        const fl = new T.BoxGeometry(0.012 * h, 0.1 * h, 0.2 * h); fl.userData.ij = null;
        gb.add(fl, { m: sm.clone().multiply(M4(-0.034 * h, 0.04 * h, 0)), w: [[B.hips, 1]], pid: PI_.STRAP });
        const bk = new T.BoxGeometry(0.008 * h, 0.022 * h, 0.03 * h); bk.userData.ij = null;
        gb.add(bk, { m: sm.clone().multiply(M4(-0.041 * h, 0.0, 0)), w: [[B.hips, 1]], pid: PI_.BRASS });
      }
      // 다리: 바지, 장화/구두, 발
      for (const sg of [-1, 1]) {
        const L = sg < 0, x = sg * D.hipX, lw = legW(D, L);
        const tro = [[D.hipY + 0.05 * h, 0.09, 0.085, 0.095], [D.hipY - 0.06 * h, 0.085, 0.082, 0.088], [D.hipY - 0.2 * h, 0.075, 0.072, 0.075], [D.kneeY + 0.05 * h, 0.06, 0.06, 0.06], [D.kneeY, 0.058, 0.06, 0.058],
          [D.kneeY - 0.1 * h, 0.06, 0.058, 0.066], [D.ankleY + 0.12 * h, 0.048, 0.048, 0.05], [D.ankleY + 0.03 * h, 0.046, 0.05, 0.048]];
        gb.add(loft(tro.map(([y, w, f, b]) => ({ c: [x, y, 0], w: w * h * sp.wK, f: f * h * sp.wK, b: b * h * sp.wK })), { seg: 8 }), { w: lw, pid: PI_.TROU });
        const top = sp.boots === 'knee' ? D.kneeY - 0.025 * h : D.ankleY + 0.075 * h;
        const bt = [[top - 0.002 * h, 0.07, 0.072, 0.074], [top - 0.03 * h, 0.066, 0.066, 0.07], [Math.max(D.ankleY + 0.1 * h, top - 0.16 * h), 0.056, 0.056, 0.064], [D.ankleY + 0.04 * h, 0.05, 0.054, 0.052], [D.ankleY - 0.01 * h, 0.05, 0.06, 0.052]];
        if (top - 0.16 * h <= D.ankleY + 0.1 * h) bt.splice(2, 1);
        const boot = loft(bt.map(([y, w, f, b]) => ({ c: [x, y, 0.004 * h], w: w * h, f: f * h, b: b * h })), { seg: 10 });
        gb.add(boot, { w: lw, pid: PI_.BOOT });
        // 발 (z로 늘인 관: 뒤꿈치 → 발끝)
        const fr = [[-0.07, 0.004, -0.045], [-0.062, 0.03, -0.03], [-0.04, 0.04, 0.01], [0.0, 0.045, 0.035], [0.06, 0.049, -0.005], [0.13, 0.05, -0.03], [0.18, 0.04, -0.045], [0.208, 0.02, -0.056], [0.218, 0.003, -0.062]];
        const ft = loft(fr.map(([z, w, t]) => { const bot = -D.ankleY / h, cy = (t + bot) / 2, hh = (t - bot) / 2; return { c: [x, D.ankleY + cy * h, z * h], ax: X1, ay: [0, 1, 0], w: w * h, f: hh * h, b: hh * h, q: 0.8 }; }), { seg: 8 });
        gb.add(ft, { w: [[L ? B.footL : B.footR, 1]], pid: p => p.y < 0.012 * h ? PI_.SOLE : PI_.BOOT });
      }
      const g = gb.build();
      g.boundingSphere = new T.Sphere(new T.Vector3(0, 0.9 * h, 0), 1.6 * h);
      return g;
    });
  }
  // 손: 오른손을 만들고 왼손은 거울. 손바닥은 -x(몸 쪽), 엄지는 +z(앞)
  function handGeo(h, fist) {
    return memo('hand' + h + fist, () => {
      const gb = new GB(false), beta = fist ? 2.6 : 0.85, fl = 0.085 * h, R = [];
      const palm = [[0.012, 0.024, 0.011, 0.013], [-0.02, 0.03, 0.012, 0.015], [-0.055, 0.038, 0.011, 0.017], [-0.09, 0.041, 0.010, 0.013]];
      palm.forEach(([y, w, f, b]) => R.push({ c: [0, y * h, 0], ax: [0, 0, 1], ay: [1, 0, 0], w: w * h, f: f * h, b: b * h }));
      for (let k = 1; k <= 7; k++) {
        const s = k / 7, a = beta * s, cx = -(1 - Math.cos(a)) / beta * fl, cy = -0.09 * h - Math.sin(a) / beta * fl;
        const tip = k === 7, w = (tip ? 0.012 : lp(0.04, 0.034, s)) * h, th = (tip ? 0.004 : 0.0095) * h;
        R.push({ c: [cx, cy, 0], ax: [0, 0, 1], ay: [Math.cos(a), -Math.sin(a), 0], w, f: th, b: th * 1.05 });
      }
      gb.add(loft(R, { seg: 8 }));
      const th = fist ? [[-0.004, -0.03, 0.026], [-0.016, -0.055, 0.036], [-0.03, -0.078, 0.03], [-0.04, -0.092, 0.012], [-0.042, -0.096, 0.004]] : [[-0.004, -0.03, 0.026], [-0.012, -0.055, 0.036], [-0.02, -0.08, 0.042], [-0.027, -0.1, 0.04], [-0.029, -0.106, 0.038]];
      gb.add(tube(th.map(p => p.map(v => v * h)), t => (t > 0.95 ? 0.003 : lp(0.012, 0.0085, t)) * h, 6));
      return gb;
    });
  }
  function skinGeo(sp, fistR) {
    return memo('skinG' + sp.bkey + fistR + sp.D.hk, () => {
      const D = sp.D, h = D.s, gb = new GB(true), nk = sp.fem ? 0.88 : 1;
      const nr = [[D.neckY - 0.035 * h, 0.054, 0.05, 0.052, -0.006], [D.neckY + 0.01 * h, 0.05, 0.048, 0.05, -0.004], [D.atlasY - 0.01 * h, 0.047, 0.049, 0.047, 0.0], [D.atlasY + 0.045 * h, 0.044, 0.046, 0.042, 0.004]];
      gb.add(loft(nr.map(([y, w, f, b, z]) => ({ c: [0, y, z * h], w: w * h * nk, f: f * h * nk, b: b * h * nk })), { seg: 12 }), {
        w: p => { const a = ss(D.neckY - 0.03 * h, D.neckY + 0.02 * h, p.y), c = ss(D.atlasY - 0.025 * h, D.atlasY + 0.02 * h, p.y); return [[B.chest, 1 - a], [B.neck, a * (1 - c)], [B.head, c]]; },
      });
      for (const sg of [-1, 1]) {
        const hg = handGeo(h, sg > 0 && fistR).build(), m = M4(sg * D.shX, D.shY - D.upper - D.fore, D.shZ, sg, 1, 1);
        gb.add(hg, { m, w: [[sg < 0 ? B.handL : B.handR, 1]] });
      }
      const g = gb.build(); g.boundingSphere = new T.Sphere(new T.Vector3(0, 0.9 * h, 0), 1.6 * h);
      return g;
    });
  }

  // ===================================================================
  // 6. 머리: 깎은 두개골 + 그린 얼굴
  // ===================================================================
  // 단위 구 위의 점 → 머리 표면 (눈높이 중심, 미터)
  function headPt(sx, sy, sz, H) {
    let x = sx * 0.0735 * H.w, y = 0.008 + sy * 0.117, z = sz * 0.1;
    const r = Math.hypot(sx, sz);
    if (r > 1e-5) { const p = sz > 0 ? H.sq : 2.15, a = Math.abs(sx) / r, b = Math.abs(sz) / r, f = 1 / Math.pow(Math.pow(a, p) + Math.pow(b, p), 1 / p); x *= f; z *= f; }
    z -= 0.005;
    x *= lp(1, H.jaw, ss(-0.025, -0.085, y)) * lp(1, H.chinW, ss(-0.08, -0.112, y));
    if (sz < 0) z = lp(z, Math.max(z, -0.052), ss(-0.025, -0.085, y));
    const fw = ss(0.12, 0.5, sz), ax = Math.abs(x), sg = x < 0 ? -1 : 1;
    if (fw > 0) {
      let dz = H.brow * 0.0042 * gs(y - 0.018, 0.0065) * gs(x, 0.042) - 0.0042 * gs(y + 0.001, 0.0095) * gs(ax - 0.0315, 0.0125) + 0.0022 * gs(y + 0.0005, 0.0055) * gs(ax - 0.0315, 0.0085);
      const np = H.nose * (0.0045 * ss(0.018, 0.0, y) + 0.0115 * ss(0.0, -0.031, y) + 0.004 * gs(y + 0.033, 0.0045)) * (1 - ss(-0.035, -0.046, y));
      dz += np * gs(x, lp(0.0062, 0.0092, ss(0.0, -0.034, y)) * H.noseW);
      dz += H.nose * 0.0042 * gs(ax - 0.0105 * H.noseW, 0.0042) * gs(y + 0.0385, 0.0045);
      dz += 0.0035 * gs(x, 0.021) * gs(y + 0.058, 0.009);
      dz += H.lip * (0.0021 * gs(x, 0.015) * gs(y + 0.0625, 0.0032) + 0.0028 * gs(x, 0.013) * gs(y + 0.0725, 0.0038));
      dz -= 0.0014 * gs(ax - 0.022, 0.004) * gs(y + 0.067, 0.004) + 0.0017 * gs(x, 0.014) * gs(y + 0.0815, 0.0038);
      dz += H.chin * 0.0055 * gs(x, 0.017) * gs(y + 0.097, 0.01);
      dz += H.cheek * 0.0035 * gs(ax - 0.047, 0.013) * gs(y + 0.022, 0.012);
      z += dz * fw;
      x += sg * fw * (H.cheek * 0.0022 * gs(ax - 0.05, 0.015) * gs(y + 0.02, 0.014) + 0.0016 * H.nose * gs(ax - 0.0105, 0.004) * gs(y + 0.0385, 0.0045));
    }
    x -= sg * 0.0022 * gs(y - 0.03, 0.018) * gs(z - 0.045, 0.025);
    return [x, y, z];
  }
  function warpTable(n, dens, a0, a1) {
    const M = 720, acc = [0];
    for (let i = 1; i <= M; i++) acc.push(acc[i - 1] + dens(a0 + (a1 - a0) * (i - 0.5) / M));
    const out = []; let k = 0;
    for (let j = 0; j <= n; j++) { const tg = acc[M] * j / n; while (k < M - 1 && acc[k + 1] < tg) k++; const f = (tg - acc[k]) / Math.max(1e-9, acc[k + 1] - acc[k]); out.push(a0 + (a1 - a0) * (k + cl(f, 0, 1)) / M); }
    return out;
  }
  function headGeo(H, lo) {
    return memo('head' + JSON.stringify(H) + lo, () => {
      const NU = lo ? 16 : 28, NV = lo ? 12 : 24;
      const TH = warpTable(NV, t => 1 + 2.3 * ss(68 * D2R, 82 * D2R, t) * (1 - ss(166 * D2R, 178 * D2R, t)), 0, PI);
      const PHs = warpTable(NU, p => 1 + 2.6 * gs(p, 0.85), -PI, PI);
      const P = [], UV = [], I = [];
      for (let i = 0; i <= NV; i++) for (let j = 0; j <= NU; j++) {
        const t = TH[i], p = PHs[j], sx = Math.sin(t) * Math.sin(p), sy = Math.cos(t), sz = Math.sin(t) * Math.cos(p);
        const q = headPt(sx, sy, sz, H);
        P.push(q[0], q[1], q[2]);
        const u = sz > 0.05 ? 0.5 + q[0] / 0.19 : (q[0] < 0 ? 0.004 : 0.996);
        UV.push(cl(u, 0.004, 0.996), cl((q[1] + 0.135) / 0.21, 0.004, 0.996));
      }
      for (let i = 0; i < NV; i++) for (let j = 0; j < NU; j++) { const a = i * (NU + 1) + j, b = a + 1, c = a + NU + 2, d = a + NU + 1; I.push(a, d, c, a, c, b); }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(UV, 2)); g.setIndex(I); g.computeVertexNormals();
      const na = g.attributes.normal;
      for (let i = 0; i <= NV; i++) { const k0 = i * (NU + 1), k1 = k0 + NU; _v1.set(na.getX(k0) + na.getX(k1), na.getY(k0) + na.getY(k1), na.getZ(k0) + na.getZ(k1)).normalize(); na.setXYZ(k0, _v1.x, _v1.y, _v1.z); na.setXYZ(k1, _v1.x, _v1.y, _v1.z); }
      // 꼭대기·바닥 극점의 법선
      const gb = new GB(false); g.userData.ij = null; gb.add(g);
      // 귀
      for (const s of [-1, 1]) {
        const e = new T.SphereGeometry(1, 8, 6), ep = e.attributes.position;
        for (let i = 0; i < ep.count; i++) { let x = ep.getX(i), y = ep.getY(i), z = ep.getZ(i); const cup = x > 0 ? 1 - 0.55 * gs(y, 0.45) * gs(z, 0.5) : 1; ep.setXYZ(i, x * 0.0075 * cup, y * 0.027, z * 0.017 * (1 - 0.25 * (y > 0 ? 0 : -y))); }
        e.computeVertexNormals(); e.userData.ij = null;
        const uv = e.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, s < 0 ? 0.004 : 0.996, 0.45);
        gb.add(e, { m: M4(s * 0.0712 * H.w, -0.014, -0.014, s, 1, 1, 0.12, s * 0.38, -s * 0.08) });
      }
      return gb.build();
    });
  }
  // 얼굴 그림: 한 칸(S×S)에 한 상태. 0 뜬 눈, 1 반쯤, 2 감음, 3·4 옆 보기, 5 미소, 6 말하기, 7 눈썹 올림
  function paintFace(g, S, oy, F, st) {
    const kx = S / 0.19, ky = S / 0.21, X = x => (x / 0.19 + 0.5) * S, Y = y => oy + (0.075 - y) * ky;
    const A = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`, mul = (c, k) => [c[0] * k, c[1] * k, c[2] * k], mx = (a, b, t) => [lp(a[0], b[0], t), lp(a[1], b[1], t), lp(a[2], b[2], t)];
    const sk = F.skin, dark = mul(sk, 0.5), warm = [sk[0] * 0.8, sk[1] * 0.5, sk[2] * 0.46], rose = mx(sk, [205, 95, 95], 0.5), white = [255, 250, 244];
    g.save(); g.beginPath(); g.rect(0, oy, S, S); g.clip();
    g.fillStyle = A(sk, 1); g.fillRect(0, oy, S, S);
    const blob = (x, y, rx, ry, c, a, rot = 0) => { if (a <= 0) return; g.save(); g.translate(X(x), Y(y)); g.rotate(rot); g.scale(rx * kx, ry * ky); const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1); gr.addColorStop(0, A(c, a)); gr.addColorStop(1, A(c, 0)); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 1, 0, TAU); g.fill(); g.restore(); };
    const bz = (p, t) => { const u = 1 - t; return [u * u * u * p[0] + 3 * u * u * t * p[2] + 3 * u * t * t * p[4] + t * t * t * p[6], u * u * u * p[1] + 3 * u * u * t * p[3] + 3 * u * t * t * p[5] + t * t * t * p[7]]; };
    const R = rng(F.seed * 13 + 3);
    // 형태감: 가장자리, 이마, 턱 밑, 눈두덩, 볼, 코
    { const gr = g.createRadialGradient(X(0), Y(-0.018), 0.045 * kx, X(0), Y(-0.018), 0.095 * kx); gr.addColorStop(0, A(dark, 0)); gr.addColorStop(1, A(dark, 0.24)); g.fillStyle = gr; g.fillRect(0, oy, S, S); }
    blob(0, 0.046, 0.046, 0.022, white, 0.07);
    blob(0, -0.122, 0.07, 0.02, dark, 0.3);
    for (const s of [-1, 1]) {
      blob(s * 0.03, 0.003, 0.027, 0.017, warm, 0.3 + F.age * 0.1);
      blob(s * 0.022, 0.009, 0.012, 0.006, mul(warm, 0.8), 0.22);
      blob(s * 0.056, -0.05, 0.012, 0.022, dark, 0.13, s * 0.3);
      blob(s * 0.05, -0.034, 0.024, 0.017, rose, F.blush);
      blob(s * 0.0115, -0.016, 0.0045, 0.021, dark, 0.07);
      blob(s * 0.058, 0.012, 0.012, 0.02, dark, 0.06);
    }
    blob(0, -0.0465, 0.0135, 0.0045, dark, 0.24);
    blob(0, -0.031, 0.0045, 0.004, white, 0.12);
    blob(0, -0.005, 0.003, 0.012, white, 0.05);
    blob(0, -0.081, 0.013, 0.0038, dark, 0.24);
    blob(0, -0.097, 0.011, 0.007, white, 0.07);
    // 주근깨·수염 자국·주름
    for (let k = 0; k < F.freck; k++) { const x = (R() - 0.5) * 0.11, y = -0.01 - R() * 0.034; if (Math.abs(x) < 0.007 && y > -0.03) continue; blob(x, y, 0.0009, 0.0009, mul(sk, 0.68), 0.55); }
    if (F.stub > 0) {
      const hc = F.browC;
      for (let k = 0; k < 2600; k++) {
        const x = (R() - 0.5) * 0.13, y = -0.04 - R() * 0.085, ax = Math.abs(x);
        const inJaw = y < -0.075 + 0.25 * Math.max(0, ax - 0.03) && ax < 0.065 - 0.3 * Math.max(0, -0.09 - y), lipBand = y > -0.062 && y < -0.05 && ax < 0.024;
        if (!(inJaw || lipBand) || (y > -0.074 && y < -0.058 && ax < 0.022)) continue;
        g.fillStyle = A(hc, F.stub * (0.5 + R())); g.fillRect(X(x), Y(y), Math.max(1, S / 300), Math.max(1, S / 300));
      }
    }
    if (F.age > 0) {
      g.lineCap = 'round'; g.strokeStyle = A(mul(sk, 0.62), 0.32); g.lineWidth = 0.0007 * kx;
      for (const y of [0.034, 0.043, 0.052]) { g.beginPath(); g.moveTo(X(-0.03), Y(y)); g.quadraticCurveTo(X(0), Y(y + 0.003), X(0.03), Y(y)); g.stroke(); }
      for (const s of [-1, 1]) {
        g.beginPath(); g.moveTo(X(s * 0.013), Y(-0.037)); g.quadraticCurveTo(X(s * 0.03), Y(-0.05), X(s * 0.028), Y(-0.072)); g.stroke();
        for (const d of [-0.004, 0, 0.004]) { g.beginPath(); g.moveTo(X(s * 0.05), Y(d * 0.5)); g.lineTo(X(s * 0.058), Y(d)); g.stroke(); }
        g.beginPath(); g.moveTo(X(s * 0.02), Y(-0.009)); g.quadraticCurveTo(X(s * 0.032), Y(-0.014), X(s * 0.044), Y(-0.008)); g.stroke();
      }
    }
    // 코구멍
    for (const s of [-1, 1]) blob(s * 0.0074, -0.0405, 0.0029, 0.0016, mul(sk, 0.32), 0.55, s * 0.35);
    // 입
    {
      const smile = st === 5 ? 1 : 0, op = st === 6 ? 0.0034 : 0, my = F.my, mw = F.mw * (smile ? 1.07 : 1), cu = smile ? 0.0024 : 0, lu = F.lu, ll = F.ll, lc = F.lipC;
      g.fillStyle = A(mul(lc, 0.8), 0.95); g.beginPath();
      g.moveTo(X(-mw), Y(my + cu)); g.bezierCurveTo(X(-mw * 0.6), Y(my + lu * 0.6), X(-0.009), Y(my + lu * 1.05), X(-0.0035), Y(my + lu));
      g.quadraticCurveTo(X(0), Y(my + lu * 0.72), X(0.0035), Y(my + lu));
      g.bezierCurveTo(X(0.009), Y(my + lu * 1.05), X(mw * 0.6), Y(my + lu * 0.6), X(mw), Y(my + cu));
      g.bezierCurveTo(X(mw * 0.5), Y(my - 0.0004 + cu * 0.3), X(-mw * 0.5), Y(my - 0.0004 + cu * 0.3), X(-mw), Y(my + cu)); g.fill();
      g.fillStyle = A(lc, 0.92); g.beginPath();
      g.moveTo(X(-mw * 0.92), Y(my + cu - 0.0005)); g.bezierCurveTo(X(-mw * 0.5), Y(my - op - 0.0006), X(mw * 0.5), Y(my - op - 0.0006), X(mw * 0.92), Y(my + cu - 0.0005));
      g.bezierCurveTo(X(mw * 0.55), Y(my - op - ll * 1.2), X(-mw * 0.55), Y(my - op - ll * 1.2), X(-mw * 0.92), Y(my + cu - 0.0005)); g.fill();
      blob(0, my - op - ll * 0.5, mw * 0.45, ll * 0.32, white, 0.18);
      if (op) {
        g.fillStyle = A([60, 22, 22], 0.95); g.beginPath(); g.ellipse(X(0), Y(my - op * 0.5), mw * 0.72 * kx, op * 0.55 * ky, 0, 0, TAU); g.fill();
        g.fillStyle = A([235, 228, 215], 0.9); g.fillRect(X(-mw * 0.4), Y(my - 0.0002), mw * 0.8 * kx, 0.0011 * ky);
      }
      g.strokeStyle = A(mul(sk, 0.3), 0.78); g.lineWidth = 0.0008 * kx; g.lineCap = 'round';
      g.beginPath(); g.moveTo(X(-mw * 1.03), Y(my + cu * 1.1)); g.bezierCurveTo(X(-mw * 0.45), Y(my - 0.0007 - cu * 0.2), X(mw * 0.45), Y(my - 0.0007 - cu * 0.2), X(mw * 1.03), Y(my + cu * 1.1)); g.stroke();
      for (const s of [-1, 1]) { blob(s * mw * 1.04, my + cu, 0.0022, 0.0017, mul(sk, 0.38), 0.4); blob(s * 0.0034, my + lu + 0.006, 0.0013, 0.006, mul(sk, 0.68), 0.14); }
    }
    // 눈
    const open = [1, 0.4, 0, 1, 1, 0.78, 1, 1][st], glance = st === 3 ? -1 : st === 4 ? 1 : 0, smile = st === 5 ? 1 : 0;
    const eye = s => {
      const cx = s * F.ex, w = F.ew, xi = cx - s * w, xo = cx + s * w, yi = -0.0006, yo = F.tilt;
      const uh = F.eh * open, lo = F.el - smile * 0.0016;
      const up = [X(xi), Y(yi), X(cx - s * w * 0.42), Y(yi + uh * 1.32), X(cx + s * w * 0.5), Y(yo + uh * 1.2), X(xo), Y(yo)];
      const dn = [X(xo), Y(yo), X(cx + s * w * 0.45), Y(yo - lo * 1.25), X(cx - s * w * 0.35), Y(yi - lo * 1.3), X(xi), Y(yi)];
      const cr = 0.0038 + F.eh * 0.32 + F.age * 0.0015;
      g.lineCap = 'round';
      blob(cx, F.eh * 0.9 + 0.0015, w * 0.95, 0.004, mx(sk, [150, 80, 80], 0.25), 0.18);
      g.strokeStyle = A(mul(sk, 0.62), 0.5); g.lineWidth = 0.0007 * kx;
      g.beginPath(); g.moveTo(X(xi + s * w * 0.1), Y(yi + cr * 0.55)); g.bezierCurveTo(X(cx - s * w * 0.35), Y(F.eh * 1.3 + cr), X(cx + s * w * 0.5), Y(yo + F.eh * 1.2 + cr * 0.9), X(xo + s * 0.0012), Y(yo + cr * 0.35)); g.stroke();
      if (open > 0.05) {
        g.save(); g.beginPath(); g.moveTo(up[0], up[1]); g.bezierCurveTo(up[2], up[3], up[4], up[5], up[6], up[7]); g.bezierCurveTo(dn[2], dn[3], dn[4], dn[5], dn[6], dn[7]); g.closePath(); g.clip();
        g.fillStyle = A(F.sclera, 1); g.fillRect(X(cx - 0.03), Y(0.02), 0.06 * kx, 0.04 * ky);
        blob(xi, yi, w * 0.55, 0.006, [175, 110, 100], 0.4); blob(xo, yo, w * 0.55, 0.006, [120, 90, 88], 0.35);
        const ix = cx + glance * w * 0.38, iy = 0.0005, rr = F.ir;
        const gr = g.createRadialGradient(X(ix), Y(iy), 0, X(ix), Y(iy), rr * kx);
        gr.addColorStop(0, A(mx(F.iris, white, 0.28), 1)); gr.addColorStop(0.5, A(F.iris, 1)); gr.addColorStop(0.8, A(mul(F.iris, 0.62), 1)); gr.addColorStop(1, A(mul(F.iris, 0.2), 1));
        g.fillStyle = gr; g.beginPath(); g.arc(X(ix), Y(iy), rr * kx, 0, TAU); g.fill();
        g.lineWidth = Math.max(0.6, 0.0004 * kx);
        for (let k = 0; k < 20; k++) { const a = k / 20 * TAU; g.strokeStyle = A(k % 2 ? mx(F.iris, white, 0.45) : mul(F.iris, 0.45), 0.28); g.beginPath(); g.moveTo(X(ix + Math.cos(a) * rr * 0.45), Y(iy + Math.sin(a) * rr * 0.45)); g.lineTo(X(ix + Math.cos(a) * rr * 0.9), Y(iy + Math.sin(a) * rr * 0.9)); g.stroke(); }
        g.fillStyle = A([16, 11, 9], 1); g.beginPath(); g.arc(X(ix), Y(iy), rr * 0.42 * kx, 0, TAU); g.fill();
        const lg = g.createLinearGradient(0, Y(uh * 1.25 + 0.0008), 0, Y(-0.0015)); lg.addColorStop(0, A([45, 22, 16], 0.5)); lg.addColorStop(0.45, A([45, 22, 16], 0)); g.fillStyle = lg; g.fillRect(X(cx - 0.03), Y(0.02), 0.06 * kx, 0.04 * ky);
        g.fillStyle = A(white, 0.96); g.beginPath(); g.arc(X(ix - rr * 0.34), Y(iy + rr * 0.36), rr * 0.27 * kx, 0, TAU); g.fill();
        g.fillStyle = A(white, 0.45); g.beginPath(); g.arc(X(ix + rr * 0.38), Y(iy - rr * 0.34), rr * 0.11 * kx, 0, TAU); g.fill();
        g.restore();
        g.strokeStyle = A(mul(sk, 0.74), 0.6); g.lineWidth = 0.0006 * kx; g.beginPath(); g.moveTo(dn[0], dn[1]); g.bezierCurveTo(dn[2], dn[3], dn[4], dn[5], dn[6], dn[7]); g.stroke();
        // 위 속눈썹 선: 안쪽은 가늘게, 바깥은 굵게
        g.strokeStyle = A(F.lashC, 1);
        let prev = bz(up, 0);
        for (let k = 1; k <= 16; k++) { const t = k / 16, p = bz(up, t); g.lineWidth = F.lash * kx * lp(0.45, 1.15, Math.pow(t, 0.8)); g.beginPath(); g.moveTo(prev[0], prev[1]); g.lineTo(p[0], p[1]); g.stroke(); prev = p; }
        g.lineWidth = F.lash * kx * 0.7; g.beginPath(); g.moveTo(up[6], up[7]); g.lineTo(X(xo + s * (F.fem ? 0.0042 : 0.0022)), Y(yo + (F.fem ? 0.0024 : 0.0008))); g.stroke();
        if (F.fem) for (let k = 0; k < 5; k++) { const p = bz(dn, 0.15 + k * 0.15); g.lineWidth = 0.0004 * kx; g.strokeStyle = A(F.lashC, 0.35); g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(p[0] + s * 0.0006 * kx, p[1] + 0.0012 * ky); g.stroke(); }
        blob(xi + s * 0.0014, yi - 0.0003, 0.0018, 0.0014, [215, 135, 130], 0.7);
      } else {
        g.strokeStyle = A(F.lashC, 0.95); g.lineWidth = F.lash * kx * 0.85;
        g.beginPath(); g.moveTo(X(xi), Y(yi)); g.bezierCurveTo(X(cx - s * w * 0.4), Y(yi - 0.0028), X(cx + s * w * 0.45), Y(yo - 0.0026), X(xo), Y(yo)); g.stroke();
      }
      if (F.age > 0) { g.strokeStyle = A(mul(sk, 0.66), 0.35); g.lineWidth = 0.0006 * kx; g.beginPath(); g.moveTo(X(cx - s * w * 0.6), Y(-F.el - 0.004)); g.quadraticCurveTo(X(cx), Y(-F.el - 0.0065), X(cx + s * w * 0.7), Y(-F.el - 0.003)); g.stroke(); }
    };
    eye(-1); eye(1);
    // 눈썹: 바탕 + 털결
    for (const s of [-1, 1]) {
      const rz = st === 7 ? 0.0028 : smile ? 0.001 : 0, pts = [];
      for (let k = 0; k <= 12; k++) { const t = k / 12; pts.push([s * lp(0.0105, 0.056, t), F.by + F.ba * Math.sin(PI * Math.min(1, t * 1.2)) - 0.0035 * t * t + rz * (1 - t), F.bt * lp(1, 0.3, t * t)]); }
      g.fillStyle = A(F.browC, 0.72); g.beginPath();
      pts.forEach((p, k) => k ? g.lineTo(X(p[0]), Y(p[1] + p[2] * 0.5)) : g.moveTo(X(p[0]), Y(p[1] + p[2] * 0.5)));
      for (let k = 12; k >= 0; k--) g.lineTo(X(pts[k][0]), Y(pts[k][1] - pts[k][2] * 0.5));
      g.closePath(); g.fill();
      g.lineWidth = Math.max(0.6, 0.00038 * kx);
      for (let k = 0; k < 55; k++) {
        const t = R(), fi = t * 12, i0 = Math.min(11, Math.floor(fi)), f = fi - i0, p0 = pts[i0], p1 = pts[i0 + 1];
        const x = lp(p0[0], p1[0], f), th = lp(p0[2], p1[2], f), y = lp(p0[1], p1[1], f) + (R() - 0.5) * th * 0.8, len = 0.0028 + R() * 0.002, an = lp(1.2, 0.25, t);
        g.strokeStyle = A(mul(F.browC, 0.75 + R() * 0.5), 0.55);
        g.beginPath(); g.moveTo(X(x), Y(y - Math.sin(an) * len * 0.5)); g.lineTo(X(x + s * Math.cos(an) * len), Y(y + Math.sin(an) * len * 0.5)); g.stroke();
      }
    }
    g.restore();
  }
  function faceTex(F, S) {
    return memo('face' + S + JSON.stringify(F), () => {
      const cv = canvas(S, S * 8), g = cv.getContext('2d');
      for (let st = 0; st < 8; st++) paintFace(g, S, st * S, F, st);
      const t = new T.CanvasTexture(cv); t.encoding = T.sRGBEncoding; t.anisotropy = 4;
      return t;
    });
  }

  // ===================================================================
  // 7. 머리카락: 두피 덮개 + 가늘어지는 다발 (+ 뒤처지는 묶음)
  // ===================================================================
  const HC = [0, 0.008, -0.005];
  function scalp(th, ph, off, H) {
    const t = th * D2R, p = ph * D2R, q = headPt(Math.sin(t) * Math.sin(p), Math.cos(t), Math.sin(t) * Math.cos(p), H);
    const n = _v1.set(q[0] - HC[0], (q[1] - HC[1]) * 0.85, q[2] - HC[2]).normalize();
    return [q[0] + n.x * off, q[1] + n.y * off, q[2] + n.z * off];
  }
  class HB {   // 머리카락 정점 모음
    constructor() { this.P = []; this.Cc = []; this.I = []; }
    clump(P0, P1, P2, w0, th, col, flat = 0.42) {
      const NS = 5, NR = 4, base = this.P.length / 3, t0 = new T.Vector3(), rd = new T.Vector3(), bi = new T.Vector3(), nn = new T.Vector3();
      for (let i = 0; i <= NS; i++) {
        const t = i / NS, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t;
        const p = [a * P0[0] + b * P1[0] + c * P2[0], a * P0[1] + b * P1[1] + c * P2[1], a * P0[2] + b * P1[2] + c * P2[2]];
        t0.set(2 * (1 - t) * (P1[0] - P0[0]) + 2 * t * (P2[0] - P1[0]), 2 * (1 - t) * (P1[1] - P0[1]) + 2 * t * (P2[1] - P1[1]), 2 * (1 - t) * (P1[2] - P0[2]) + 2 * t * (P2[2] - P1[2])).normalize();
        rd.set(p[0] - HC[0], p[1] - HC[1], p[2] - HC[2]).normalize();
        bi.crossVectors(t0, rd); if (bi.lengthSq() < 1e-6) bi.set(1, 0, 0); bi.normalize(); nn.crossVectors(bi, t0).normalize();
        const w = i === NS ? 0.0004 : w0 * Math.pow(1 - t, 0.5) * (0.78 + 0.22 * Math.sin(PI * Math.min(1, t * 1.5 + 0.2))) + 0.0006, tt = w * (th || flat);
        const k = lp(0.68, 1.12, t) * col[3];
        for (let j = 0; j < NR; j++) {
          const an = j / NR * TAU;
          this.P.push(p[0] + bi.x * Math.cos(an) * w + nn.x * Math.sin(an) * tt, p[1] + bi.y * Math.cos(an) * w + nn.y * Math.sin(an) * tt, p[2] + bi.z * Math.cos(an) * w + nn.z * Math.sin(an) * tt);
          this.Cc.push(col[0] * k, col[1] * k, col[2] * k);
        }
      }
      for (let i = 0; i < NS; i++) for (let j = 0; j < NR; j++) { const a = base + i * NR + j, b = base + i * NR + (j + 1) % NR, c = b + NR, d = a + NR; this.I.push(a, d, c, a, c, b); }
    }
    blob(c, r, col, H) {   // 곱슬·쪽머리 덩어리
      const g = new T.IcosahedronGeometry(1, 1), p = g.attributes.position, base = this.P.length / 3;
      for (let i = 0; i < p.count; i++) { this.P.push(c[0] + p.getX(i) * r[0], c[1] + p.getY(i) * r[1], c[2] + p.getZ(i) * r[2]); const k = lp(0.75, 1.05, (p.getY(i) + 1) / 2) * col[3]; this.Cc.push(col[0] * k, col[1] * k, col[2] * k); }
      for (let i = 0; i < p.count; i += 3) this.I.push(base + i, base + i + 1, base + i + 2);
      void H;
    }
    cap(H, line, thick, col, NU = 20, NV = 6) {
      const base = this.P.length / 3, R = rng(9);
      for (let i = 0; i <= NV; i++) for (let j = 0; j < NU; j++) {
        const ph = -180 + j / NU * 360, lim = line(Math.abs(ph)), th = lim * Math.pow(i / NV, 0.9), e = i / NV;
        const q = scalp(Math.max(0.5, th), ph, thick * lp(1, 0.12, Math.pow(e, 3)) + (R() - 0.5) * 0.0012 * (1 - e), H);
        this.P.push(...q); const k = lp(0.78, 0.66, e) * col[3]; this.Cc.push(col[0] * k, col[1] * k, col[2] * k);
      }
      for (let i = 0; i < NV; i++) for (let j = 0; j < NU; j++) { const a = base + i * NU + j, b = base + i * NU + (j + 1) % NU, c = b + NU, d = a + NU; this.I.push(a, d, c, a, c, b); }
    }
    build() {
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(this.P, 3)); g.setAttribute('color', new T.Float32BufferAttribute(this.Cc, 3)); g.setIndex(this.I);
      g.computeVertexNormals(); return g;
    }
  }
  const lineTab = tab => a => { for (let i = 1; i < tab.length; i++) if (a <= tab[i][0]) return lp(tab[i - 1][1], tab[i][1], (a - tab[i - 1][0]) / (tab[i][0] - tab[i - 1][0])); return tab[tab.length - 1][1]; };
  function hairGeo(sp) {
    const H = sp.headP, style = sp.hair, hat = !!sp.hat;
    return memo('hair' + style + JSON.stringify(H) + sp.hairC + hat + sp.beard + (sp.seed % 5), () => {
      const R = rng(sp.seed * 7 + 5), c = C(sp.hairC), col = (k = 1) => [c.r, c.g, c.b, k * (0.92 + R() * 0.16)];
      const S = new HB(), Dy = new HB();
      let piv = [0, 0.06, -0.03], amp = 0.35;
      const sc = (a, o) => scalp(a[0], a[1], a[2] ?? o, H);
      const add = (dyn, r, m, t, w, th) => (dyn ? Dy : S).clump(sc(r, 0.001), Array.isArray(m[0]) ? m[0] : sc(m), Array.isArray(t[0]) ? t[0] : sc(t), w, th, col());
      const lineStd = lineTab([[0, 60], [30, 63], [55, 74], [70, 100], [85, 90], [110, 96], [150, 118], [180, 122]]);
      const thick = { crop: 0.009, side: 0.008, short: 0.005, curly: 0.016, elder: 0.004 }[style] || 0.008;
      if (style === 'elder') S.cap(H, lineTab([[0, 72], [40, 76], [70, 100], [110, 100], [180, 124]]), thick, col(0.95));
      else if (style === 'pony' || style === 'bun' || style === 'braid') S.cap(H, lineTab([[0, 58], [30, 62], [55, 72], [70, 98], [85, 92], [110, 98], [150, 120], [180, 124]]), 0.006, col(0.95));
      else S.cap(H, lineStd, thick, col(0.92));
      const top = !hat;
      if (style === 'crop' || style === 'short') {
        const k = style === 'short' ? 0.6 : 1;
        for (const [p0, dp] of [[-50, 22], [-34, 22], [-18, 20], [-2, 19], [14, 17], [30, 14], [44, 10]]) add(1, [22, p0 * 0.8], [50, p0 + dp * 0.5, 0.017 * k], [73 + R() * 7, p0 + dp, 0.01 * k], 0.033 * k + R() * 0.005, 0.36);
        if (top) for (const p0 of [-90, -55, -20, 15, 50, 85, 125, 165, 205, 245]) add(1, [5, p0], [32, p0 + 12, 0.02 * k], [60 + R() * 8, p0 + 24, 0.013 * k], 0.038 * k, 0.4);
        for (const s of [-1, 1]) { add(0, [46, s * 62], [66, s * 74, 0.018 * k], [90, s * 82, 0.008], 0.026 * k); add(0, [52, s * 98], [74, s * 104, 0.016 * k], [96, s * 110, 0.007], 0.028 * k); }
        for (const p0 of [125, 150, 175, 200, 225]) add(0, [36, p0], [78, p0, 0.022 * k], [116 + R() * 4, p0 + R() * 10 - 5, 0.01], 0.034 * k);
        piv = scalp(20, 0, 0.0, H); amp = 0.3;
      } else if (style === 'side') {
        for (const p0 of [-35, -10, 15, 40, 65]) add(1, [20, -30], [40, p0 + 20, 0.03], [72, p0 + 45, 0.014], 0.03, 0.4);
        if (top) for (const p0 of [-90, -60, 110, 150, 190]) add(0, [16, -30], [40, p0, 0.025], [70, p0 + 10, 0.012], 0.03, 0.42);
        for (const s of [-1, 1]) add(0, [50, s * 80], [72, s * 90, 0.016], [94, s * 98, 0.007], 0.028);
        for (const p0 of [130, 160, 190, 220]) add(0, [40, p0], [80, p0, 0.02], [114, p0, 0.01], 0.032);
        piv = scalp(20, -30, 0, H); amp = 0.3;
      } else if (style === 'curly') {
        for (let k = 0; k < 26; k++) { const th = 6 + (k < 20 ? k / 20 * 85 : 60 + R() * 50), ph = k < 20 ? -180 + ((k * 137.5) % 360) : -180 + R() * 360; if (th > lineStd(Math.abs(ph)) + 6) continue; S.blob(scalp(th, ph, thick * 0.9, H), [0.026 + R() * 0.008, 0.022 + R() * 0.006, 0.026 + R() * 0.008], col(), H); }
        for (const p0 of [-30, 0, 30]) add(1, [30, p0], [55, p0 + 5, 0.03], [74, p0 + 10, 0.02], 0.024, 0.6);
        piv = scalp(30, 0, 0, H); amp = 0.25;
      } else if (style === 'bob' || style === 'long') {
        for (const p0 of [-34, -12, 10, 32]) add(1, [26, p0 * 0.5], [55, p0, 0.02], [77, p0 * 1.1, 0.012], 0.03, 0.38);
        if (top) for (const p0 of [-120, -80, 80, 120, 160, 200]) add(0, [8, p0 * 0.3], [45, p0, 0.03], [80, p0, 0.025], 0.034, 0.4);
        if (style === 'bob') {
          for (const p0 of [-100, -70, 70, 100, 125, 150, 180, 210, 235]) add(1, [30, p0 * 0.6], [80, p0, 0.03], [128, p0, 0.03], 0.04, 0.4);
          piv = scalp(30, 180, -0.01, H); amp = 0.55;
        } else {
          for (const s of [-1, 1]) for (const [p0, dz] of [[62, 0.035], [82, 0.0]]) add(1, [36, s * p0 * 0.6], [80, s * p0, 0.03], [[s * 0.088, -0.17 - R() * 0.03, dz]], 0.038, 0.38);
          for (const [x, z0] of [[-0.07, -0.05], [-0.035, -0.07], [0, -0.075], [0.035, -0.07], [0.07, -0.05]]) Dy.clump(sc([30, x * 600]), sc([95, 180 + x * 900, 0.03]), [x * 1.3, -0.24 - R() * 0.04, z0 - 0.045], 0.042, 0.36, col());
          piv = [0, 0.03, -0.075]; amp = 1;
        }
      } else if (style === 'pony' || style === 'bun' || style === 'braid') {
        for (const s of [-1, 1]) add(0, [30, s * 20], [60, s * 60, 0.012], [92, s * 96, 0.006], 0.022, 0.4);
        for (const p0 of [-30, 0, 30]) add(0, [10, p0], [40, 180 + p0 * 0.6, 0.014], [72, 180 + p0 * 0.2, 0.006], 0.03, 0.4);
        for (const s of [-1, 1]) add(1, [55, s * 28], [72, s * 34, 0.012], [100, s * 42, 0.012], 0.01, 0.5);
        if (style === 'bun') { const b = scalp(55, 180, 0.03, H); for (let k = 0; k < 7; k++) { const a = k / 7 * TAU; S.blob([b[0] + Math.cos(a) * 0.016, b[1] + Math.sin(a) * 0.016, b[2] - 0.004], [0.017, 0.017, 0.015], col(), H); } piv = b; amp = 0.1; }
        else {
          const tie = scalp(72, 180, 0.006, H); piv = tie; amp = 1;
          S.blob(tie, [0.012, 0.012, 0.01], [0.25, 0.18, 0.12, 1], H);
          if (style === 'pony') for (const [x, l] of [[-0.012, 0.2], [0, 0.24], [0.012, 0.21]]) Dy.clump([tie[0] + x, tie[1], tie[2] - 0.005], [tie[0] + x * 2, tie[1] - 0.05, tie[2] - 0.06], [x * 3, tie[1] - l, tie[2] - 0.04], 0.026, 0.55, col());
          else for (let k = 0; k < 7; k++) Dy.blob([tie[0] + (k % 2 ? 0.004 : -0.004), tie[1] - 0.02 - k * 0.036, tie[2] - 0.012 - k * 0.004], [0.017 - k * 0.0012, 0.022, 0.015 - k * 0.001], col(), H);
        }
      } else if (style === 'elder') {
        for (const s of [-1, 1]) { add(0, [70, s * 70], [92, s * 85, 0.014], [108, s * 96, 0.008], 0.03); add(0, [80, s * 110], [100, s * 120, 0.016], [118, s * 130, 0.01], 0.032); }
        for (const p0 of [150, 180, 210]) add(1, [80, p0], [110, p0, 0.016], [128, p0, 0.012], 0.034);
        piv = scalp(90, 180, 0, H); amp = 0.4;
      }
      // 수염 (얼굴에 붙는다)
      if (sp.beard) {
        const full = sp.beard === 'full', L = full ? 0.045 : 0.012;
        for (let k = 0; k <= 8; k++) { const ph = lp(-78, 78, k / 8), th = lp(120, 168, 1 - Math.abs(ph) / 90), r = scalp(th, ph, 0.002, H); add(0, [th, ph, 0.002], [[r[0] * 0.92, r[1] - L * 0.4, r[2] + 0.006]], [[r[0] * 0.7, r[1] - L, r[2] + (full ? 0.004 : 0.002)]], full ? 0.022 : 0.016, 0.5); }
        for (const s of [-1, 1]) add(0, [118, s * 6, 0.004], [[s * 0.014, -0.052, 0.098]], [[s * 0.028, -0.064, 0.088]], 0.012, 0.5);
      }
      const st = S.build(), dy = Dy.P.length ? Dy : null;
      if (dy) for (let i = 0; i < dy.P.length; i += 3) { dy.P[i] -= piv[0]; dy.P[i + 1] -= piv[1]; dy.P[i + 2] -= piv[2]; }
      return { st, dy: dy ? dy.build() : null, piv, amp };
    });
  }

  // ===================================================================
  // 8. 모자, 가면, 공명봉
  // ===================================================================
  function hatGeo(style, h) {
    return memo('hat' + style, () => {
      const gb = new GB(false);
      const ring = (y, w, f, b, z = 0) => ({ c: [0, y, z], w, f, b });
      if (style === 'tall') {
        const cr = [ring(0.052, 0.088, 0.104, 0.108), ring(0.078, 0.086, 0.1, 0.104), ring(0.079, 0.084, 0.098, 0.102), ring(0.13, 0.068, 0.078, 0.082, -0.006), ring(0.2, 0.046, 0.05, 0.054, -0.018), ring(0.262, 0.026, 0.028, 0.03, -0.04), ring(0.3, 0.012, 0.012, 0.014, -0.07), ring(0.305, 0.002, 0.002, 0.002, -0.085)];
        gb.add(loft(cr, { seg: 16 }), { pid: (p, a) => a < 0.15 ? PI_.BAND : PI_.HAT });
        const br = loft([ring(0.054, 0.086, 0.1, 0.104), ring(0.048, 0.19, 0.2, 0.2), ring(0.036, 0.205, 0.215, 0.215)], { seg: 20 });
        gb.add(br, { pid: PI_.HAT }); gb.add(innerOf(br, 0.004), { pid: PI_.HAT });
      } else if (style === 'cap') {
        gb.add(loft([ring(0.05, 0.088, 0.104, 0.108), ring(0.062, 0.09, 0.106, 0.11), ring(0.064, 0.098, 0.116, 0.118, 0.004), ring(0.09, 0.108, 0.126, 0.124, 0.008), ring(0.112, 0.085, 0.1, 0.1, 0.01), ring(0.124, 0.04, 0.048, 0.048, 0.01), ring(0.127, 0.002, 0.002, 0.002, 0.01)], { seg: 18 }), { pid: (p, a) => a < 0.25 ? PI_.BAND : PI_.HAT });
        gb.add(sphereG(0.009, 8, 6), { m: M4(0.07, 0.085, 0.07), pid: PI_.BRASS });
      } else if (style === 'brim') {
        gb.add(loft([ring(0.052, 0.09, 0.105, 0.108), ring(0.075, 0.088, 0.103, 0.106), ring(0.076, 0.086, 0.1, 0.104), ring(0.135, 0.08, 0.094, 0.096), ring(0.15, 0.06, 0.07, 0.07), ring(0.155, 0.002, 0.002, 0.002)], { seg: 16 }), { pid: (p, a) => a < 0.22 ? PI_.BAND : PI_.HAT });
        const br = loft([ring(0.056, 0.088, 0.103, 0.106), ring(0.05, 0.2, 0.21, 0.21), ring(0.035, 0.225, 0.235, 0.235)], { seg: 22 });
        gb.add(br, { pid: PI_.HAT }); gb.add(innerOf(br, 0.004), { pid: PI_.HAT });
      } else {
        gb.add(loft([ring(0.05, 0.088, 0.104, 0.108), ring(0.085, 0.09, 0.106, 0.11), ring(0.1, 0.105, 0.118, 0.118), ring(0.18, 0.118, 0.13, 0.13), ring(0.235, 0.104, 0.114, 0.114), ring(0.25, 0.06, 0.066, 0.066), ring(0.254, 0.002, 0.002, 0.002)], { seg: 16 }), { pid: (p, a) => a < 0.18 ? PI_.BAND : PI_.HAT });
      }
      void h;
      return gb.build();
    });
  }
  function maskGeo(H) {
    return memo('mask' + JSON.stringify(H), () => {
      const NU = 22, NV = 18, P = [], I = [];
      for (let i = 0; i <= NV; i++) for (let j = 0; j <= NU; j++) {
        const th = lp(66, 168, i / NV) * D2R, ph = lp(-78, 78, j / NU) * D2R;
        const q = headPt(Math.sin(th) * Math.sin(ph), Math.cos(th), Math.sin(th) * Math.cos(ph), Object.assign({}, H, { nose: H.nose * 0.7 }));
        const n = _v1.set(q[0] - HC[0], (q[1] - HC[1]) * 0.6, q[2] - HC[2]).normalize();
        P.push(q[0] + n.x * 0.0045, q[1] + n.y * 0.0045, q[2] + n.z * 0.0045);
      }
      const eyeHole = (x, y) => { const ax = Math.abs(x); return Math.pow((ax - 0.031) / 0.016, 2) + Math.pow((y - 0.001) / 0.0075, 2) < 1; };
      for (let i = 0; i < NV; i++) for (let j = 0; j < NU; j++) {
        const a = i * (NU + 1) + j, b = a + 1, c = a + NU + 2, d = a + NU + 1;
        const cx = (P[a * 3] + P[c * 3]) / 2, cy = (P[a * 3 + 1] + P[c * 3 + 1]) / 2;
        if (eyeHole(cx, cy)) continue;
        I.push(a, d, c, a, c, b);
      }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setIndex(I); g.computeVertexNormals();
      if (g.attributes.normal.getZ((NV >> 1) * (NU + 1) + (NU >> 1)) < 0) { const ix = g.index.array; for (let k = 0; k < ix.length; k += 3) { const t = ix[k + 1]; ix[k + 1] = ix[k + 2]; ix[k + 2] = t; } g.computeVertexNormals(); }
      g.setAttribute('uv', new T.Float32BufferAttribute(new Float32Array(P.length / 3 * 2), 2));
      const gb = new GB(false); g.userData.ij = null; gb.add(g); const inn = innerOf(g, 0.003); gb.add(inn);
      return gb.build();
    });
  }
  function crackGeo(H) {
    return memo('crack' + JSON.stringify(H), () => {
      const path = [[0.004, 0.062], [0.012, 0.04], [0.006, 0.022], [0.016, 0.009], [0.011, -0.012], [0.024, -0.03], [0.02, -0.048], [0.034, -0.068]];
      const P = [], I = [], w = 0.0016;
      path.forEach(([x, y], k) => {
        const t = Math.acos(cl((y - 0.008) / 0.117, -1, 1)), p = Math.asin(cl(x / (0.0735 * Math.sin(t) || 1), -1, 1));
        const q = headPt(Math.sin(t) * Math.sin(p), Math.cos(t), Math.sin(t) * Math.cos(p), Object.assign({}, H, { nose: H.nose * 0.7 }));
        const z = q[2] + 0.0062, a = path[Math.max(0, k - 1)], b = path[Math.min(path.length - 1, k + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
        const ww = w * (k === 0 || k === path.length - 1 ? 0.3 : 1);
        P.push(x - dy / l * ww, y + dx / l * ww, z, x + dy / l * ww, y - dx / l * ww, z);
      });
      for (let k = 0; k < path.length - 1; k++) { const a = k * 2; I.push(a, a + 1, a + 3, a, a + 3, a + 2); }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setIndex(I); g.computeVertexNormals();
      return g;
    });
  }
  function rodGeo() {
    return memo('rod', () => {
      const gb = new GB(false), rr = [];
      const zs = [[-0.3, 0.003], [-0.297, 0.0115], [-0.26, 0.0125], [-0.255, 0.0118], [-0.07, 0.0115], [-0.065, 0.0135], [0.065, 0.0135], [0.07, 0.0112], [0.49, 0.0102], [0.495, 0.0128], [0.53, 0.0135], [0.545, 0.0158], [0.556, 0.012], [0.56, 0.004]].map(([z, r]) => [z, r * 1.3]);
      zs.forEach(([z, r]) => rr.push({ c: [0, 0, z], ax: X1, ay: [0, 1, 0], w: r, f: r, b: r }));
      gb.add(loft(rr, { seg: 8 }), { pid: p => p.z < -0.252 || p.z > 0.492 ? PI_.BRASS : Math.abs(p.z) < 0.067 ? PI_.STRAP : PI_.WOOD });
      for (const s of [-1, 1]) {
        const pts = []; for (let k = 0; k <= 5; k++) { const t = k / 5; pts.push([s * (0.011 + Math.sin(PI * t) * 0.024), Math.sin(PI * t) * 0.006 * s, 0.548 + t * 0.12]); }
        gb.add(tube(pts, t => lp(0.0042, 0.0024, t), 5), { pid: PI_.BRASS });
      }
      gb.add(new T.TorusGeometry(0.03, 0.0028, 4, 14), { m: M4(0, 0, 0.612), pid: PI_.BRASS });
      return gb.build();
    });
  }
  function crystalGeo() {
    return memo('crystal', () => { const g = new T.OctahedronGeometry(1, 0); g.scale(0.026, 0.026, 0.062); return g; });
  }

  // ===================================================================
  // 9. 천 물리: 로브 치마 (베를렛), 종 소매 (늘어짐), 영대 (사슬)
  // ===================================================================
  function crTaps(x, n) {
    const i = Math.min(Math.floor(x), n - 2), f = x - i, f2 = f * f, f3 = f2 * f;
    return [[i - 1, i, i + 1, i + 2].map(k => cl(k, 0, n - 1)), [(-f3 + 2 * f2 - f) / 2, (3 * f3 - 5 * f2 + 2) / 2, (-3 * f3 + 4 * f2 + f) / 2, (f3 - f2) / 2]];
  }
  const _ws = new T.Vector3(), _wa = new T.Vector3(), _wb = new T.Vector3();
  class Skirt {
    constructor(sp, D, ghost) {
      const Cn = this.C = 13, Rn = this.R = 6, n = this.n = Cn * Rn, h = D.s;
      this.D = D; this.sp = sp;
      const rest = this.rest = new Float32Array(n * 3), tr = torsoRings(D, sp), wr = ringAt(tr, D.waistY);
      const yTop = D.waistY - D.hipY + 0.004 * h, yHem = sp.hem * h - D.hipY;
      for (let r = 0; r < Rn; r++) {
        const t = r / (Rn - 1), y = lp(yTop, yHem, t), ring = ringAt(tr, y + D.hipY), pad = (0.026 - 0.008 * t) * h;
        const w = Math.max(lp(wr.w + 0.018 * h, sp.hemW * h, Math.pow(t, 0.9)), ring.w + pad), f = Math.max(lp(wr.f + 0.017 * h, sp.hemW * 0.7 * h, t), ring.f + pad), b = Math.max(lp(wr.b + 0.018 * h, sp.hemW * 0.88 * h, t), ring.b + pad);
        const gap = lp(0.083 * (sp.town ? 0.6 : 1), sp.hemGap, Math.pow(t, 0.8)) * h, a0 = Math.asin(Math.min(0.9, gap / w));
        for (let c = 0; c < Cn; c++) {
          const a = lp(a0, TAU - a0, c / (Cn - 1)), pl = c > 0 && c < Cn - 1 ? 1 + (c % 2 ? 0.055 : -0.03) * t : 1, co = Math.cos(a), i = (r * Cn + c) * 3;
          rest[i] = Math.sin(a) * w * pl; rest[i + 1] = y; rest[i + 2] = co * (co > 0 ? f : b) * pl;
        }
      }
      this.kd = [0, 0.05, 0.03, 0.02, 0.014, 0.01].map(v => v * (sp.ghost ? 1.5 : 1));
      this.md = [0, 0.1, 0.2, 0.33, 0.46, 0.58];
      this.x = new Float32Array(n * 3); this.xp = new Float32Array(n * 3); this.tg = new Float32Array(n * 3); this.pin = new Float32Array(Cn * 3); this.pin0 = new Float32Array(Cn * 3);
      this.L = new Float32Array(n * 3);
      // 그릴 격자: 앞섶·단 가장자리에 좁은 단(파이핑) 띠
      const ue = 0.12, ve = 0.13, us = [0, ue, ue + 0.02], vs = [];
      for (let k = 1; k < (Cn - 1) * 2; k++) { const u = k / 2; if (u > ue + 0.05 && u < Cn - 1 - ue - 0.05) us.push(u); }
      us.push(Cn - 1 - ue - 0.02, Cn - 1 - ue, Cn - 1);
      for (let k = 0; k <= Rn - 1; k++) { const v = k; if (v < Rn - 1 - ve - 0.05) vs.push(v); }
      vs.push(Rn - 1 - ve - 0.02, Rn - 1 - ve, Rn - 1);
      const NU = this.NU = us.length, NV = this.NV = vs.length, nv = NU * NV, layers = ghost ? 1 : 2;
      this.tapI = new Int16Array(nv * 16); this.tapW = new Float32Array(nv * 16);
      for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) {
        const [iu, wu] = crTaps(us[i], Cn), [iv, wv] = crTaps(vs[j], Rn), k = (j * NU + i) * 16;
        for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) { this.tapI[k + a * 4 + b] = iv[a] * Cn + iu[b]; this.tapW[k + a * 4 + b] = wv[a] * wu[b]; }
      }
      const pos = new Float32Array(nv * layers * 3), nor = new Float32Array(nv * layers * 3), col = new Float32Array(nv * layers * 3), uv = new Float32Array(nv * layers * 2), rm = new Float32Array(nv * layers * 2);
      const pc = sp.pal.c;
      for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) {
        const k = j * NU + i, edge = us[i] <= ue + 1e-4 || us[i] >= Cn - 1 - ue - 1e-4 || vs[j] >= Rn - 1 - ve - 1e-4, dirt = 1 - 0.14 * Math.pow(vs[j] / (Rn - 1), 4);
        for (let l = 0; l < layers; l++) {
          const c = pc[edge ? PI_.TRIM : l ? PI_.LINE : PI_.ROBE], q = (l * nv + k) * 3;
          col[q] = c.r * dirt; col[q + 1] = c.g * dirt; col[q + 2] = c.b * dirt;
          uv[(l * nv + k) * 2] = us[i] * 0.09 * h; uv[(l * nv + k) * 2 + 1] = vs[j] * 0.13 * h;
          rm[(l * nv + k) * 2] = edge ? 0.6 : 0.72; rm[(l * nv + k) * 2 + 1] = 0;
        }
      }
      const I = [];
      for (let j = 0; j < NV - 1; j++) for (let i = 0; i < NU - 1; i++) { const a = j * NU + i, b = a + 1, c = a + NU + 1, d = a + NU; I.push(a, d, c, a, c, b); if (layers > 1) I.push(nv + a, nv + b, nv + c, nv + a, nv + c, nv + d); }
      const g = this.geo = new T.BufferGeometry();
      g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('normal', new T.BufferAttribute(nor, 3)); g.setAttribute('color', new T.BufferAttribute(col, 3));
      g.setAttribute('uv', new T.BufferAttribute(uv, 2)); g.setAttribute('rm', new T.BufferAttribute(rm, 2)); g.setIndex(I);
      g.attributes.position.setUsage(T.DynamicDrawUsage); g.attributes.normal.setUsage(T.DynamicDrawUsage);
      g.boundingSphere = new T.Sphere(new T.Vector3(0, 0.6, 0), 1.8);
      this.layers = layers; this.th = 0.005 * h;
      this.mesh = new T.Mesh(g, ghost || clothMat());
      this.mesh.frustumCulled = true;
      this.ready = false; this.cons = null;
    }
    // 목표(뼈대 따라 움직이는 쉬는 모양)
    targets(rig) {
      const Mh = rig.hips.matrixWorld.elements, Mt = rig.torso.matrixWorld.elements, r = this.rest, tg = this.tg, dy = this.D.waistY - this.D.hipY;
      for (let i = 0; i < this.n; i++) {
        const k = i * 3, x = r[k], y = r[k + 1], z = r[k + 2];
        if (i < this.C) { const yy = y - dy; this.pin[k] = Mt[0] * x + Mt[4] * yy + Mt[8] * z + Mt[12]; this.pin[k + 1] = Mt[1] * x + Mt[5] * yy + Mt[9] * z + Mt[13]; this.pin[k + 2] = Mt[2] * x + Mt[6] * yy + Mt[10] * z + Mt[14]; tg[k] = this.pin[k]; tg[k + 1] = this.pin[k + 1]; tg[k + 2] = this.pin[k + 2]; }
        else { tg[k] = Mh[0] * x + Mh[4] * y + Mh[8] * z + Mh[12]; tg[k + 1] = Mh[1] * x + Mh[5] * y + Mh[9] * z + Mh[13]; tg[k + 2] = Mh[2] * x + Mh[6] * y + Mh[10] * z + Mh[14]; }
      }
    }
    reset(sc) {
      this.x.set(this.tg); this.xp.set(this.tg); this.pin0.set(this.pin);
      const Cn = this.C, Rn = this.R, x = this.x, cons = [];
      const d = (a, b) => Math.hypot(x[a * 3] - x[b * 3], x[a * 3 + 1] - x[b * 3 + 1], x[a * 3 + 2] - x[b * 3 + 2]);
      const add = (a, b, k, t) => cons.push(a, b, d(a, b), k, t);
      for (let r = 0; r < Rn; r++) for (let c = 0; c < Cn; c++) {
        const i = r * Cn + c;
        if (r < Rn - 1) add(i, i + Cn, 1, 0);
        if (c < Cn - 1 && r > 0) add(i, i + 1, 0.9, 1);
        if (r < Rn - 1 && c < Cn - 1) { add(i, i + Cn + 1, 0.25, 1); add(i + 1, i + Cn, 0.25, 1); }
        if (r < Rn - 2) add(i, i + 2 * Cn, 0.35, 2);
      }
      this.cons = Float32Array.from(cons); this.sc = sc; this.ready = true;
    }
    step(h, gy, drag, cap, ell, ground, mix) {
      const x = this.x, xp = this.xp, tg = this.tg, n = this.n, Cn = this.C, sc = this.sc;
      const dmp = Math.pow(1 - drag, h * 60), g2 = gy * h * h;
      for (let k = 0; k < Cn * 3; k++) { const v = lp(this.pin0[k], this.pin[k], mix); xp[k] = x[k]; x[k] = v; }
      for (let i = Cn; i < n; i++) {
        const k = i * 3, kd = this.kd[(i / Cn) | 0] * h * 60;
        for (let a = 0; a < 3; a++) { const v = (x[k + a] - xp[k + a]) * dmp; xp[k + a] = x[k + a]; x[k + a] += v + (tg[k + a] - x[k + a]) * kd; }
        x[k + 1] += g2;
      }
      const cs = this.cons;
      for (let it = 0; it < 3; it++) {
        for (let q = 0; q < cs.length; q += 5) {
          const a = cs[q] * 3, b = cs[q + 1] * 3, L = cs[q + 2], t = cs[q + 4];
          const dx = x[b] - x[a], dy = x[b + 1] - x[a + 1], dz = x[b + 2] - x[a + 2], l = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
          let k = cs[q + 3];
          if (t === 1 && l < L) k *= 0.12;   // 옆으로는 잘 접힌다
          if (t === 2 && l > L) continue;     // 굽힘은 짧아질 때만
          const df = (l - L) / l * 0.5 * k, wa = a < Cn * 3 ? 0 : 1, wb = 1, s = wa + wb;
          x[a] += dx * df * 2 * wa / s; x[a + 1] += dy * df * 2 * wa / s; x[a + 2] += dz * df * 2 * wa / s;
          x[b] -= dx * df * 2 * wb / s; x[b + 1] -= dy * df * 2 * wb / s; x[b + 2] -= dz * df * 2 * wb / s;
        }
        this.collide(cap, ell, ground);
      }
      for (let i = Cn; i < n; i++) {
        const k = i * 3, md = this.md[(i / Cn) | 0] * sc, dx = x[k] - tg[k], dy = x[k + 1] - tg[k + 1], dz = x[k + 2] - tg[k + 2], l = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (l > md) { const f = md / l; x[k] = tg[k] + dx * f; x[k + 1] = tg[k + 1] + dy * f; x[k + 2] = tg[k + 2] + dz * f; }
      }
    }
    collide(cap, ell, ground) {
      const x = this.x, n = this.n, Cn = this.C;
      for (let i = Cn; i < n; i++) {
        const k = i * 3;
        for (let c = 0; c < cap.length; c += 7) {
          const ax = cap[c], ay = cap[c + 1], az = cap[c + 2], bx = cap[c + 3] - ax, by = cap[c + 4] - ay, bz = cap[c + 5] - az, r = cap[c + 6];
          const px = x[k] - ax, py = x[k + 1] - ay, pz = x[k + 2] - az, bb = bx * bx + by * by + bz * bz;
          const t = bb > 1e-9 ? cl((px * bx + py * by + pz * bz) / bb, 0, 1) : 0;
          const dx = px - bx * t, dy = py - by * t, dz = pz - bz * t, l2 = dx * dx + dy * dy + dz * dz;
          if (l2 < r * r) { const l = Math.sqrt(l2) || 1e-5, f = r / l; x[k] = ax + bx * t + dx * f; x[k + 1] = ay + by * t + dy * f; x[k + 2] = az + bz * t + dz * f; }
        }
        // 골반 타원체 (엉덩이 기준)
        const e = ell.e, ie = ell.ie;
        const lx = ie[0] * x[k] + ie[4] * x[k + 1] + ie[8] * x[k + 2] + ie[12], ly = ie[1] * x[k] + ie[5] * x[k + 1] + ie[9] * x[k + 2] + ie[13], lz = ie[2] * x[k] + ie[6] * x[k + 1] + ie[10] * x[k + 2] + ie[14];
        const rz = lz > 0 ? ell.f : ell.b, q = (lx / ell.w) ** 2 + ((ly - ell.cy) / ell.h) ** 2 + (lz / rz) ** 2;
        if (q < 1) {
          const s = 1 / Math.sqrt(q), nx = lx * s, ny = ell.cy + (ly - ell.cy) * s, nz = lz * s;
          x[k] = e[0] * nx + e[4] * ny + e[8] * nz + e[12]; x[k + 1] = e[1] * nx + e[5] * ny + e[9] * nz + e[13]; x[k + 2] = e[2] * nx + e[6] * ny + e[10] * nz + e[14];
        }
        if (x[k + 1] < ground) x[k + 1] = ground;
      }
    }
    write(root) {
      const ie = _m1.copy(root.matrixWorld).invert().elements, x = this.x, L = this.L;
      for (let i = 0; i < this.n; i++) { const k = i * 3; L[k] = ie[0] * x[k] + ie[4] * x[k + 1] + ie[8] * x[k + 2] + ie[12]; L[k + 1] = ie[1] * x[k] + ie[5] * x[k + 1] + ie[9] * x[k + 2] + ie[13]; L[k + 2] = ie[2] * x[k] + ie[6] * x[k + 1] + ie[10] * x[k + 2] + ie[14]; }
      const pa = this.geo.attributes.position.array, na = this.geo.attributes.normal.array, NU = this.NU, NV = this.NV, nv = NU * NV, tI = this.tapI, tW = this.tapW;
      for (let v = 0; v < nv; v++) {
        let sx = 0, sy = 0, sz = 0; const o = v * 16;
        for (let t = 0; t < 16; t++) { const w = tW[o + t]; if (w === 0) continue; const k = tI[o + t] * 3; sx += L[k] * w; sy += L[k + 1] * w; sz += L[k + 2] * w; }
        pa[v * 3] = sx; pa[v * 3 + 1] = sy; pa[v * 3 + 2] = sz;
      }
      for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) {
        const v = j * NU + i, i0 = j * NU + Math.max(0, i - 1), i1 = j * NU + Math.min(NU - 1, i + 1), j0 = Math.max(0, j - 1) * NU + i, j1 = Math.min(NV - 1, j + 1) * NU + i;
        const ux = pa[i1 * 3] - pa[i0 * 3], uy = pa[i1 * 3 + 1] - pa[i0 * 3 + 1], uz = pa[i1 * 3 + 2] - pa[i0 * 3 + 2], vx = pa[j1 * 3] - pa[j0 * 3], vy = pa[j1 * 3 + 1] - pa[j0 * 3 + 1], vz = pa[j1 * 3 + 2] - pa[j0 * 3 + 2];
        let nx = vy * uz - vz * uy, ny = vz * ux - vx * uz, nz = vx * uy - vy * ux; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
        na[v * 3] = nx; na[v * 3 + 1] = ny; na[v * 3 + 2] = nz;
        if (this.layers > 1) { const q = (nv + v) * 3, th = this.th; pa[q] = pa[v * 3] - nx * th; pa[q + 1] = pa[v * 3 + 1] - ny * th; pa[q + 2] = pa[v * 3 + 2] - nz * th; na[q] = -nx; na[q + 1] = -ny; na[q + 2] = -nz; }
      }
      this.geo.attributes.position.needsUpdate = true; this.geo.attributes.normal.needsUpdate = true;
    }
  }
  // 종 소매: 아래팔에 붙은 관. 중력 쪽으로 늘어지고, 팔을 들면 팔꿈치 쪽으로 미끄러진다
  class Sleeve {
    constructor(sp, D, ghost) {
      const h = D.s, L = D.fore + 0.045 * h, bell = sp.bell * h, N = 12, layers = ghost ? 1 : 2;
      const sl = [-0.04 * h, 0.03 * h, 0.12 * h, D.fore - 0.01 * h, L - 0.017 * h, L - 0.0165 * h, L];
      const nr = sl.length, nv = nr * (N + 1);
      const rest = this.rest = new Float32Array(nv * layers * 3), aux = this.aux = new Float32Array(nv * layers * 3);
      const col = new Float32Array(nv * layers * 3), uv = new Float32Array(nv * layers * 2), rm = new Float32Array(nv * layers * 2), I = [], pc = sp.pal.c;
      for (let l = 0; l < layers; l++) for (let i = 0; i < nr; i++) for (let j = 0; j <= N; j++) {
        const s = sl[i], a = j / N * TAU, r = (i === 0 ? 0.068 * h : lp(0.072 * h, bell, Math.pow(ss(0, L, s), 1.3))) - l * 0.004 * h, k = l * nv + i * (N + 1) + j;
        rest[k * 3] = Math.sin(a) * r; rest[k * 3 + 1] = -s; rest[k * 3 + 2] = Math.cos(a) * r;
        aux[k * 3] = cl(s / L, 0, 1); aux[k * 3 + 1] = Math.sin(a); aux[k * 3 + 2] = Math.cos(a);
        const edge = i >= nr - 2, c = pc[edge ? PI_.TRIM : l ? PI_.LINE : PI_.ROBE];
        col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b; uv[k * 2] = a * r; uv[k * 2 + 1] = s; rm[k * 2] = 0.72; rm[k * 2 + 1] = 0;
      }
      for (let l = 0; l < layers; l++) for (let i = 0; i < nr - 1; i++) for (let j = 0; j < N; j++) {
        const a = l * nv + i * (N + 1) + j, b = a + 1, c = a + N + 2, d = a + N + 1;
        if (l) I.push(a, d, c, a, c, b); else I.push(a, b, c, a, c, d);
      }
      const g = this.geo = new T.BufferGeometry();
      g.setAttribute('position', new T.BufferAttribute(rest.slice(), 3)); g.setAttribute('color', new T.BufferAttribute(col, 3)); g.setAttribute('uv', new T.BufferAttribute(uv, 2)); g.setAttribute('rm', new T.BufferAttribute(rm, 2));
      g.setIndex(I); g.computeVertexNormals();
      // 바깥을 향하게
      const na = g.attributes.normal; if (na.getZ(2 * (N + 1)) < 0) { const ix = g.index.array; for (let k = 0; k < ix.length; k += 3) { const t = ix[k + 1]; ix[k + 1] = ix[k + 2]; ix[k + 2] = t; } g.computeVertexNormals(); }
      for (let i = 0; i < nr * layers; i++) { const k0 = i * (N + 1), k1 = k0 + N; _v1.set(na.getX(k0) + na.getX(k1), na.getY(k0) + na.getY(k1), na.getZ(k0) + na.getZ(k1)).normalize(); na.setXYZ(k0, _v1.x, _v1.y, _v1.z); na.setXYZ(k1, _v1.x, _v1.y, _v1.z); }
      g.attributes.position.setUsage(T.DynamicDrawUsage);
      g.boundingSphere = new T.Sphere(new T.Vector3(0, -0.15, 0), 0.5);
      this.mesh = new T.Mesh(g, ghost || clothMat());
      this.sag = 0.09 * h * (sp.bell / 0.115); this.slide = 0.1 * h;
      this.g = new T.Vector3(0, -1, 0); this.gv = new T.Vector3();
    }
    update(fore, dt, snap) {
      const e = _m1.extractRotation(fore.matrixWorld).elements;
      _v1.set(-e[1], -e[5], -e[9]);   // 아래팔 기준 중력 방향
      if (snap || dt <= 0) { this.g.copy(_v1); this.gv.set(0, 0, 0); }
      else { const k = 160, c = 2 * Math.sqrt(k) * 0.75; this.gv.addScaledVector(_v2.copy(_v1).sub(this.g), k * dt).addScaledVector(this.gv, -c * dt); this.g.addScaledVector(this.gv, dt); }
      const g = this.g, gp = Math.hypot(g.x, g.z), ga = -g.y, gx = gp > 1e-4 ? g.x / gp : 0, gz = gp > 1e-4 ? g.z / gp : 0;
      const pa = this.geo.attributes.position.array, r = this.rest, a = this.aux;
      for (let k = 0; k < pa.length; k += 3) {
        const s = a[k], s2 = s * s, side = a[k + 1] * gx + a[k + 2] * gz, sag = this.sag * s2 * gp * (0.3 + 0.7 * Math.max(0, side));
        pa[k] = r[k] + g.x * sag / Math.max(gp, 1e-4) * gp; pa[k + 2] = r[k + 2] + g.z * sag / Math.max(gp, 1e-4) * gp;
        pa[k + 1] = r[k + 1] + this.slide * s * Math.max(0, -ga) + (0.012 * s2 * Math.max(0, ga));
        void gx;
      }
      this.geo.attributes.position.needsUpdate = true;
    }
  }
  // 영대: 목 뒤에서 가슴 앞으로 늘어지는 두 끝 (사슬 물리, 리본으로 그린다)
  class Stole {
    constructor(sp, D) {
      const h = D.s, N = this.N = 7, len = (sp.ren ? 0.6 : 0.52) * h, seg = len / (N - 1);
      this.D = D; this.sp = sp; this.W = 0.075 * h; this.h = h;
      const y1 = D.neckY + 0.012 * h, o1 = outerAt(D, sp, y1), ax = Math.sin(0.75) * (o1.w + 0.008 * h), az = Math.cos(0.75) * (o1.f + 0.008 * h);
      this.anc = [[-ax, y1 - D.chestY, az], [ax, y1 - D.chestY, az]];
      this.rest = []; this.seg = seg;
      for (let s = 0; s < 2; s++) { const r = []; for (let k = 0; k < N; k++) r.push([this.anc[s][0] * (1 - k * 0.04), this.anc[s][1] - k * seg, this.anc[s][2] + 0.03 * h * Math.min(1, k)]); this.rest.push(r); }
      this.x = [new Float32Array(N * 3), new Float32Array(N * 3)]; this.xp = [new Float32Array(N * 3), new Float32Array(N * 3)];
      // 겉면 단면표 (가슴 기준 y → 몸 기준 단면)
      this.prof = []; for (let k = 0; k <= 24; k++) { const y = lp(D.hipY - 0.1 * h, D.neckY + 0.02 * h, k / 24), o = outerAt(D, sp, y); this.prof.push([y - D.chestY, o.w + 0.012 * h, o.f + 0.012 * h, o.b + 0.012 * h]); }
      // 리본 격자: 줄(사슬 2배) × 열(가장자리 띠)
      const us = [0, 0.1, 0.11, 0.89, 0.9, 1], NR = (N - 1) * 2 + 1, NU = us.length; this.us = us; this.NR = NR;
      const nv = NR * NU * 2, pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), I = [];
      const c1 = sp.pal.c[PI_.STOLE], c2 = sp.pal.c[PI_.STOLE2], cb = sp.pal.c[PI_.BRASS];
      for (let s = 0; s < 2; s++) for (let j = 0; j < NR; j++) for (let i = 0; i < NU; i++) {
        const k = (s * NR + j) * NU + i, tip = j >= NR - 1, c = tip ? cb : (us[i] <= 0.1 || us[i] >= 0.9) ? c2 : c1;
        col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b; uv[k * 2] = us[i]; uv[k * 2 + 1] = j * seg / 2 / (0.075 * h) * 0.5;
      }
      const back = nv / 2;
      for (let s = 0; s < 2; s++) for (let j = 0; j < NR - 1; j++) for (let i = 0; i < NU - 1; i++) {
        const a = (s * NR + j) * NU + i, b = a + 1, c = a + NU + 1, d = a + NU;
        I.push(a, b, c, a, c, d); I.push(back + a, back + c, back + b, back + a, back + d, back + c);
      }
      for (let k = 0; k < back; k++) { col[(back + k) * 3] = col[k * 3] * 0.85; col[(back + k) * 3 + 1] = col[k * 3 + 1] * 0.85; col[(back + k) * 3 + 2] = col[k * 3 + 2] * 0.85; uv[(back + k) * 2] = uv[k * 2]; uv[(back + k) * 2 + 1] = uv[k * 2 + 1]; }
      const g = this.geo = new T.BufferGeometry();
      g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('normal', new T.BufferAttribute(nor, 3)); g.setAttribute('color', new T.BufferAttribute(col, 3)); g.setAttribute('uv', new T.BufferAttribute(uv, 2)); g.setIndex(I);
      g.attributes.position.setUsage(T.DynamicDrawUsage); g.attributes.normal.setUsage(T.DynamicDrawUsage);
      g.boundingSphere = new T.Sphere(new T.Vector3(0, 1.1, 0), 1.0);
      this.mesh = new T.Mesh(g, stoleMat(sp.stoleGlow)); this.ready = false; this.L = new Float32Array(N * 3 * 2);
    }
    update(rig, dt, lod, snap) {
      const ch = rig._h.bn.chest, M = ch.matrixWorld, e = M.elements, ie = _m2.copy(M).invert().elements, N = this.N, sc = rig._h.sc;
      for (let s = 0; s < 2; s++) {
        const x = this.x[s], xp = this.xp[s], R = this.rest[s];
        const toW = (p, o) => { o[0] = e[0] * p[0] + e[4] * p[1] + e[8] * p[2] + e[12]; o[1] = e[1] * p[0] + e[5] * p[1] + e[9] * p[2] + e[13]; o[2] = e[2] * p[0] + e[6] * p[1] + e[10] * p[2] + e[14]; return o; };
        const tmp = [0, 0, 0];
        if (!this.ready || snap || lod) { for (let k = 0; k < N; k++) { toW(R[k], tmp); x[k * 3] = xp[k * 3] = tmp[0]; x[k * 3 + 1] = xp[k * 3 + 1] = tmp[1]; x[k * 3 + 2] = xp[k * 3 + 2] = tmp[2]; } if (!snap && !(!this.ready)) { /* 먼 거리: 쉬는 모양 */ } }
        const steps = lod ? 0 : snap ? 40 : Math.min(3, Math.max(1, Math.round(dt * 60)));
        const hh = snap ? 1 / 60 : dt / Math.max(1, steps);
        for (let st = 0; st < steps; st++) {
          toW(R[0], tmp); x[0] = tmp[0]; x[1] = tmp[1]; x[2] = tmp[2];
          const dmp = Math.pow(0.97, hh * 60);
          for (let k = 1; k < N; k++) for (let a = 0; a < 3; a++) { const i = k * 3 + a, v = (x[i] - xp[i]) * dmp; xp[i] = x[i]; x[i] += v + (a === 1 ? -9.8 * hh * hh : 0); }
          for (let it = 0; it < 4; it++) {
            for (let k = 1; k < N; k++) {
              const a = (k - 1) * 3, b = k * 3, dx = x[b] - x[a], dy = x[b + 1] - x[a + 1], dz = x[b + 2] - x[a + 2], l = Math.hypot(dx, dy, dz) || 1e-6, L = this.seg * sc, f = (l - L) / l;
              if (k === 1) { x[b] -= dx * f; x[b + 1] -= dy * f; x[b + 2] -= dz * f; } else { x[a] += dx * f * 0.5; x[a + 1] += dy * f * 0.5; x[a + 2] += dz * f * 0.5; x[b] -= dx * f * 0.5; x[b + 1] -= dy * f * 0.5; x[b + 2] -= dz * f * 0.5; }
            }
            for (let k = 1; k < N; k++) {   // 몸 겉면 밖으로
              const b = k * 3, lx = ie[0] * x[b] + ie[4] * x[b + 1] + ie[8] * x[b + 2] + ie[12], ly = ie[1] * x[b] + ie[5] * x[b + 1] + ie[9] * x[b + 2] + ie[13], lz = ie[2] * x[b] + ie[6] * x[b + 1] + ie[10] * x[b + 2] + ie[14];
              const P = this.prof; let pr = P[0];
              for (let q = 1; q < P.length; q++) if (ly <= P[q][0]) { const a2 = P[q - 1], b2 = P[q], t = (ly - a2[0]) / (b2[0] - a2[0]); pr = [ly, lp(a2[1], b2[1], t), lp(a2[2], b2[2], t), lp(a2[3], b2[3], t)]; break; } else pr = P[q];
              const rz = lz > 0 ? pr[2] : pr[3], q2 = (lx / pr[1]) ** 2 + (lz / rz) ** 2;
              if (q2 < 1 && ly < P[P.length - 1][0]) { const s2 = 1 / Math.sqrt(q2), nx = lx * s2, nz = lz * s2; x[b] = e[0] * nx + e[4] * ly + e[8] * nz + e[12]; x[b + 1] = e[1] * nx + e[5] * ly + e[9] * nz + e[13]; x[b + 2] = e[2] * nx + e[6] * ly + e[10] * nz + e[14]; }
            }
          }
        }
      }
      this.ready = true;
      this.write(rig, e);
    }
    write(rig, ce) {
      const ie = _m1.copy(rig.matrixWorld).invert().elements, N = this.N, NR = this.NR, us = this.us, NU = us.length, pa = this.geo.attributes.position.array, na = this.geo.attributes.normal.array, back = pa.length / 6;
      _v5.set(ce[8], ce[9], ce[10]).normalize();
      const fw = [ie[0] * _v5.x + ie[4] * _v5.y + ie[8] * _v5.z, ie[1] * _v5.x + ie[5] * _v5.y + ie[9] * _v5.z, ie[2] * _v5.x + ie[6] * _v5.y + ie[10] * _v5.z];
      const sc = Math.hypot(ie[0], ie[1], ie[2]);
      for (let s = 0; s < 2; s++) {
        const x = this.x[s], L = this.L;
        for (let k = 0; k < N; k++) { const b = k * 3; L[b] = ie[0] * x[b] + ie[4] * x[b + 1] + ie[8] * x[b + 2] + ie[12]; L[b + 1] = ie[1] * x[b] + ie[5] * x[b + 1] + ie[9] * x[b + 2] + ie[13]; L[b + 2] = ie[2] * x[b] + ie[6] * x[b + 1] + ie[10] * x[b + 2] + ie[14]; }
        for (let j = 0; j < NR; j++) {
          const [ix, w] = crTaps(j / 2, N); let px = 0, py = 0, pz = 0;
          for (let t = 0; t < 4; t++) { px += L[ix[t] * 3] * w[t]; py += L[ix[t] * 3 + 1] * w[t]; pz += L[ix[t] * 3 + 2] * w[t]; }
          const k0 = Math.max(0, Math.floor(j / 2) - (j === NR - 1 ? 1 : 0)), k1 = Math.min(N - 1, k0 + 1);
          const tx = L[k1 * 3] - L[k0 * 3], ty = L[k1 * 3 + 1] - L[k0 * 3 + 1], tz = L[k1 * 3 + 2] - L[k0 * 3 + 2];
          let sx = ty * fw[2] - tz * fw[1], sy = tz * fw[0] - tx * fw[2], sz2 = tx * fw[1] - ty * fw[0]; const sl = Math.hypot(sx, sy, sz2) || 1; sx /= sl; sy /= sl; sz2 /= sl;
          let nx = sy * tz - sz2 * ty, ny = sz2 * tx - sx * tz, nz = sx * ty - sy * tx; const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
          if (nx * fw[0] + ny * fw[1] + nz * fw[2] < 0) { nx = -nx; ny = -ny; nz = -nz; sx = -sx; sy = -sy; sz2 = -sz2; }
          const W = this.W * sc * (j === NR - 1 ? 0.75 : 1);
          for (let i = 0; i < NU; i++) {
            const k = ((s * NR + j) * NU + i) * 3, u = (us[i] - 0.5) * W;
            pa[k] = px + sx * u + nx * 0.002; pa[k + 1] = py + sy * u + ny * 0.002; pa[k + 2] = pz + sz2 * u + nz * 0.002; na[k] = nx; na[k + 1] = ny; na[k + 2] = nz;
            const q = k + back * 3; pa[q] = px + sx * u - nx * 0.001; pa[q + 1] = py + sy * u - ny * 0.001; pa[q + 2] = pz + sz2 * u - nz * 0.001; na[q] = -nx; na[q + 1] = -ny; na[q + 2] = -nz;
          }
        }
      }
      this.geo.attributes.position.needsUpdate = true; this.geo.attributes.normal.needsUpdate = true;
    }
  }

  // ===================================================================
  // 10. 활공 날개: 등에서 부채처럼 펼쳐지는 천 날개 (살 5개씩)
  // ===================================================================
  class Glider {
    constructor(sp) {
      this.group = new T.Group(); this.K = 5; this.open = 0; this.t = 0;
      const K = this.K, NA = (K - 1) * 2 + 1, NRd = 5, nv = NA * NRd * 2 * 2;   // 날개 둘 × 면 둘
      this.NA = NA; this.NRd = NRd;
      const pos = new Float32Array(nv * 3), col = new Float32Array(nv * 3), rm = new Float32Array(nv * 2), uv = new Float32Array(nv * 2), I = [], pc = sp.pal.c;
      for (let w = 0; w < 2; w++) for (let f = 0; f < 2; f++) for (let a = 0; a < NA; a++) for (let r = 0; r < NRd; r++) {
        const k = ((w * 2 + f) * NA + a) * NRd + r, edge = r === NRd - 1 || a === 0, c = edge ? pc[PI_.TRIM] : f ? pc[PI_.LINE] : pc[PI_.ROBE];
        col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b; rm[k * 2] = 0.66; uv[k * 2] = a * 0.2; uv[k * 2 + 1] = r * 0.3;
      }
      for (let w = 0; w < 2; w++) for (let f = 0; f < 2; f++) for (let a = 0; a < NA - 1; a++) for (let r = 0; r < NRd - 1; r++) {
        const base = (w * 2 + f) * NA * NRd, p = base + a * NRd + r, q = p + 1, s = p + NRd + 1, t = p + NRd;
        if ((w + f) % 2) I.push(p, q, s, p, s, t); else I.push(p, s, q, p, t, s);
      }
      const g = this.geo = new T.BufferGeometry();
      g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('color', new T.BufferAttribute(col, 3)); g.setAttribute('rm', new T.BufferAttribute(rm, 2)); g.setAttribute('uv', new T.BufferAttribute(uv, 2)); g.setIndex(I);
      g.attributes.position.setUsage(T.DynamicDrawUsage);
      g.boundingSphere = new T.Sphere(new T.Vector3(0, 0, 0), 2);
      this.sail = new T.Mesh(g, clothMat()); this.sail.castShadow = true; this.group.add(this.sail);
      // 살 (황동 관) 과 앞 가장자리의 룬 빛
      this.ribs = [];
      const rg = new T.CylinderGeometry(0.008, 0.005, 1, 6); rg.translate(0, 0.5, 0);
      const bm = new T.MeshStandardMaterial({ color: C('#C9A45C'), roughness: 0.32, metalness: 1 });
      for (let w = 0; w < 2; w++) for (let k = 0; k < K; k++) { const m = new T.Mesh(rg, bm); m.castShadow = true; this.group.add(m); this.ribs.push(m); }
      const lg = new T.CylinderGeometry(0.006, 0.006, 1, 5); lg.translate(0, 0.5, 0);
      this.glow = [0, 1].map(() => { const m = new T.Mesh(lg, GLOW_('#7ff0ff', 1.8)); this.group.add(m); return m; });
      this.hub = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 0.04, 12).rotateX(PI / 2), bm); this.group.add(this.hub);
      this.dir = []; for (let i = 0; i < 2 * K; i++) this.dir.push(new T.Vector3());
      this.group.visible = false;
    }
    // 살 방향: 접힘(등을 따라 아래) ↔ 펼침(옆·뒤로 부채꼴)
    ribDir(w, k, o, out) {
      const s = w ? 1 : -1, t = k / (this.K - 1);
      const st = cl((o - t * 0.35) / 0.65, 0, 1), e = st * st * (3 - 2 * st);
      const be = lp(-0.08, 1.25, t), dih = 0.22;
      const open = _v6.set(s * Math.cos(be), Math.sin(dih) * Math.cos(be) + 0.05, -Math.sin(be)).normalize();
      const fold = out.set(s * 0.12, -1, -0.15 - t * 0.05).normalize();
      return out.lerp(open, e).normalize();
    }
    update(dt, on, flap) {
      this.open = cl(this.open + (on ? dt / 0.4 : -dt / 0.25), 0, 1);
      if (dt <= 0 && on) this.open = 1;
      this.group.visible = this.open > 0.01;
      if (!this.group.visible) return;
      this.t += dt;
      const K = this.K, NA = this.NA, NRd = this.NRd, pa = this.geo.attributes.position.array, o = this.open;
      const len = k => (1.25 - 0.4 * Math.pow(k / (K - 1), 2)) * lp(0.35, 1, o);
      for (let w = 0; w < 2; w++) for (let k = 0; k < K; k++) {
        const d = this.ribDir(w, k, o, this.dir[w * K + k]), m = this.ribs[w * K + k];
        m.quaternion.setFromUnitVectors(_v1.set(0, 1, 0), d); m.scale.set(1, len(k), 1);
      }
      for (let w = 0; w < 2; w++) { const d = this.dir[w * K]; this.glow[w].quaternion.setFromUnitVectors(_v1.set(0, 1, 0), d); this.glow[w].scale.set(1, len(0) * 0.98, 1); this.glow[w].position.copy(d).multiplyScalar(0.02); }
      for (let w = 0; w < 2; w++) for (let a = 0; a < NA; a++) {
        const k0 = Math.floor(a / 2), k1 = Math.min(K - 1, k0 + (a % 2)), mid = a % 2 === 1;
        const d0 = this.dir[w * K + k0], d1 = this.dir[w * K + k1], L0 = len(k0), L1 = len(k1);
        for (let r = 0; r < NRd; r++) {
          const f = r / (NRd - 1), rad = lp(0.06, 1, f);
          _v2.copy(d0).multiplyScalar(L0).lerp(_v3.copy(d1).multiplyScalar(L1), mid ? 0.5 : 0);
          if (mid) _v2.multiplyScalar(1 - 0.13 * Math.pow(f, 3));   // 살 사이 뒷전은 안으로 패인다
          _v2.multiplyScalar(rad);
          const bil = (mid ? 0.05 : 0.0) * Math.sin(PI * f) * o + Math.sin(this.t * 13 + a + r) * 0.006 * f * flap;
          _v2.y += bil;
          for (let fc = 0; fc < 2; fc++) { const k = (((w * 2 + fc) * NA + a) * NRd + r) * 3; pa[k] = _v2.x; pa[k + 1] = _v2.y - fc * 0.004; pa[k + 2] = _v2.z; }
        }
      }
      this.geo.attributes.position.needsUpdate = true; this.geo.computeVertexNormals();
    }
  }
  const GLOW_ = (c, k) => (typeof GLOW === 'function' ? GLOW(c, k) : new T.MeshBasicMaterial({ color: C(c).multiplyScalar(k) }));

  // ===================================================================
  // 11. makeRig
  // ===================================================================
  const hadd = T.Object3D.prototype.add;
  function makeRig(look, o) {
    look = look || {}; o = o || {};
    const sp = spec(look, o), D = sp.D, ghost = o.ghost || null, h = D.s;
    const root = new T.Group(), body = new T.Group(); root.add(body);
    const G_ = (par, x, y, z) => { const g = new T.Group(); g.position.set(x, y, z); par.add(g); return g; };
    const hips = G_(body, 0, D.hipY, 0), torso = G_(hips, 0, D.waistY - D.hipY, 0), chest = G_(torso, 0, D.chestY - D.waistY, 0);
    const neck = G_(chest, 0, D.neckY - D.chestY, 0), head = G_(neck, 0, D.atlasY - D.neckY, D.atlasZ);
    const arm = s => { const a = G_(chest, s * D.shX, D.shY - D.chestY, D.shZ), f = G_(a, 0, -D.upper, 0), hd = G_(f, 0, -D.fore, 0); return [a, f, hd]; };
    const [armL, foreL, handL] = arm(-1), [armR, foreR, handR] = arm(1);
    const leg = s => { const l = G_(hips, s * D.hipX, 0, 0), sh = G_(l, 0, -D.thigh, 0), f = G_(sh, 0, -D.shin, 0); return [l, sh, f]; };
    const [legL, shinL, footL] = leg(-1), [legR, shinR, footR] = leg(1);
    root.updateMatrixWorld(true);
    const bones = [hips, torso, chest, neck, head, armL, foreL, handL, armR, foreR, handR, legL, shinL, footL, legR, shinR, footR];
    const skel = new T.Skeleton(bones), ident = new T.Matrix4();
    const skinned = (geo, m) => { const sm = new T.SkinnedMesh(geo, m); sm.bind(skel, ident); root.add(sm); return sm; };
    const H = { sp, D, seed: sp.seed, R: rng(sp.seed + 99), bn: { hips, torso, chest, neck, head, armL, foreL, handL, armR, foreR, handR, legL, shinL, footL, legR, shinR, footR }, t: 0, gp: 0, cp: 0, swp: 0, gv: 0, vx: 0, vy: 0, vz: 0, yr: 0, w: {}, frame: (Math.random() * 3) | 0 };
    // 옷과 피부
    const bodyM = skinned(colorize(bodyGeo(sp), sp.pal), ghost || clothMat());
    const skinM = skinned(skinGeo(sp, !!o.rod), ghost || skinMat(sp.skin));
    // 머리
    const skull = new T.Group(); skull.position.set(0, D.eyeY - D.atlasY, D.eyeZ - D.atlasZ); skull.scale.setScalar(D.hk); hadd.call(head, skull);
    let faceTex_ = null, headMat;
    if (ghost) headMat = ghost;
    else {
      const base = faceTex(sp.face, sp.ren ? 512 : 256);
      faceTex_ = base.clone(); faceTex_.version = base.version; faceTex_.repeat.set(1, 1 / 8); faceTex_.offset.set(0, 7 / 8);
      headMat = new T.MeshStandardMaterial({ map: faceTex_, emissiveMap: faceTex_, emissive: C('#ff9a80'), emissiveIntensity: 0.05, roughness: 0.52 });
    }
    const headHi = new T.Mesh(headGeo(sp.headP, false), headMat), headLo = new T.Mesh(headGeo(sp.headP, true), headMat);
    headLo.visible = false; skull.add(headHi); skull.add(headLo);
    H.headHi = headHi; H.headLo = headLo; H.face = faceTex_; H.faceSt = 0;
    if (sp.hood !== 'up') {
      const hg = hairGeo(sp);
      skull.add(new T.Mesh(hg.st, ghost || hairMat()));
      if (hg.dy) { const dg = new T.Group(); dg.position.set(...hg.piv); dg.add(new T.Mesh(hg.dy, ghost || hairMat())); skull.add(dg); H.hairDyn = dg; H.hairAmp = hg.amp; H.hx = 0; H.hz = 0; H.hvx = 0; H.hvz = 0; }
      if (sp.hat) skull.add(new T.Mesh(colorize(hatGeo(sp.hatStyle, h), sp.pal), ghost || clothMat()));
    }
    if (sp.mask) {
      H.maskM = new T.Mesh(maskGeo(sp.headP), ghost || maskMat(sp.mask)); skull.add(H.maskM);
      H.crackM = new T.Mesh(crackGeo(sp.headP), GLOW_('#7ff0ff', 2.5)); H.crackM.visible = sp.crack; skull.add(H.crackM);
    }
    // 소매, 치마, 영대
    const slL = new Sleeve(sp, D, ghost), slR = new Sleeve(sp, D, ghost);
    hadd.call(foreL, slL.mesh); hadd.call(foreR, slR.mesh); H.sleeves = [slL, slR];
    const skirt = new Skirt(sp, D, ghost); root.add(skirt.mesh); H.skirt = skirt;
    if (sp.stole && !ghost) { H.stole = new Stole(sp, D); root.add(H.stole.mesh); }
    // 공명봉
    let rod = null;
    if (o.rod) {
      rod = new T.Group(); rod.position.set(-0.03 * h, -0.092 * h, 0.0); hadd.call(handR, rod);
      const rm = new T.Mesh(colorize(rodGeo(), sp.pal), clothMat()); rod.add(rm);
      rod.tip = new T.Mesh(crystalGeo(), GLOW_('#9ff4ff', 2.6)); rod.tip.position.set(0, 0, 0.613); rod.add(rod.tip);
      H.rod = rod;
    }
    // 활공 날개
    if (o.glider) { const gl = new Glider(sp); gl.group.position.set(0, D.shY - D.chestY + 0.03 * h, -0.13 * h); hadd.call(chest, gl.group); H.glider = gl; root.glider = gl.group; }
    // 그림자
    root.traverse(m => { if (m.isMesh) { m.castShadow = !ghost; m.receiveShadow = !ghost && m !== skirt.mesh; } });
    if (rod) rod.tip.castShadow = false;
    // 예전 좌표로 붙이는 것들 (잔향의 눈, 가면 금, 손에 든 소품)
    const legH = new T.Group(); legH.position.copy(skull.position); legH.scale.set(0.42, 0.55, 0.44).multiplyScalar(D.hk); hadd.call(head, legH);
    head.add = function () {
      for (const ob of arguments) {
        if (H.crackM && ob.isMesh && ob.geometry && ob.geometry.type === 'BoxGeometry' && ob.material && ob.material.isMeshBasicMaterial) { ob.visible = false; H.crackM.visible = true; }
        hadd.call(legH, ob);
      }
      return this;
    };
    for (const [a, f] of [[armL, foreL], [armR, foreR]]) { const lg = new T.Group(); lg.position.set(0, D.upper, 0); hadd.call(f, lg); a.add = function () { for (const ob of arguments) hadd.call(lg, ob); return this; }; }
    H.sc = 1; H.pivY = D.hipY;
    Object.assign(root, { body, hips, torso, head, armL, armR, legL, legR, cape: skirt.mesh, rod, ph: Math.random() * 6, _h: H });
    root.scale.setScalar(look.scale || o.scale || 1);
    HERO.count++;
    void bodyM; void skinM;
    return root;
  }

  // ===================================================================
  // 12. 동작
  // ===================================================================
  const CHN = 'bY bZ bRx bRy bRz hY hX hZ hRx hRy hRz tRx tRy tRz cRx cRy cRz nRx nRy hdRx hdRy hdRz aLx aLy aLz fLx fLy wLx wLz aRx aRy aRz fRx fRy wRx wRz lLx lLy lLz sLx ftLx lRx lRy lRz sRx ftRx rod'.split(' ');
  const K = {}; CHN.forEach((n, i) => { K[n] = i; }); const NCH = CHN.length;
  const MODES = ['ground', 'climb', 'glide', 'swim', 'fall', 'sit', 'kneel'];
  // 두 마디 IK: d(엉덩이 기준 고관절→발목), 무릎은 pole 쪽
  function ik2(d, a, b, pole, outQ) {
    const L = d.length(), Lc = cl(L, Math.abs(a - b) + 1e-3, a + b - 1e-4);
    const dir = _v1.copy(d).multiplyScalar(1 / (L || 1));
    const A = Math.acos(cl((a * a + Lc * Lc - b * b) / (2 * a * Lc), -1, 1)), bend = PI - Math.acos(cl((a * a + b * b - Lc * Lc) / (2 * a * b), -1, 1));
    const ax = _v2.crossVectors(dir, pole); if (ax.lengthSq() < 1e-8) ax.set(1, 0, 0); ax.normalize();
    const th = _v3.copy(dir).applyAxisAngle(ax, A);
    const yA = _v4.copy(th).negate(), zA = _v5.copy(pole).addScaledVector(th, -pole.dot(th)).normalize(), xA = _v6.crossVectors(yA, zA);
    _m1.makeBasis(xA, yA, zA); outQ.setFromRotationMatrix(_m1);
    return bend;
  }
  const POLE = [new T.Vector3(-0.12, 0, 1).normalize(), new T.Vector3(0.12, 0, 1).normalize()];
  function legIK(p, side, D, fx, fy, fz, psi) {
    _e1.set(p[K.hRx], p[K.hRy], p[K.hRz]); _q1.setFromEuler(_e1);
    const j = _wa.set(side * D.hipX, 0, 0).applyQuaternion(_q1).add(_wb.set(p[K.hX], D.hipY + p[K.hY], p[K.hZ]));
    const d = _ws.set(fx, fy, fz).sub(j).applyQuaternion(_q2.copy(_q1).invert());
    const bend = ik2(d, D.thigh, D.shin, POLE[side < 0 ? 0 : 1], _q3);
    _e1.setFromQuaternion(_q3, 'XYZ');
    const o = side < 0 ? K.lLx : K.lRx;
    p[o] = _e1.x; p[o + 1] = _e1.y; p[o + 2] = _e1.z; p[o + 3] = bend;
    _q4.copy(_q1).multiply(_q3).multiply(_q5.setFromAxisAngle(XA, bend));
    const fy2 = _v1.set(0, 0, 1).applyQuaternion(_q4).y;
    p[o + 4] = Math.asin(cl(fy2, -1, 1)) - psi;
  }
  function standFoot(H, side, D) {
    const ws = H.wsv || 0, rel = side < 0 ? Math.max(0, ws) : Math.max(0, -ws);
    return [side * (D.hipX + 0.012 * D.s + 0.02 * rel * D.s), 0.012 * D.s + 0.05 * rel * D.s];
  }
  function poseGround(p, H, D, s) {
    const v = H.gv / D.s, rw = ss(2.0, 3.6, v), ga = ss(0.06, 0.45, v), Cy = cl(0.75 + 0.5 * v, 1.1, 3.8), beta = lp(0.62, 0.36, rw), ph = H.gp % 1, h = D.s;
    const idle = 1 - ga, br = Math.sin(H.t * TAU / 4.2 + H.seed % 7), ws = H.wsv || 0, look = H.look || 0, lookP = H.lookP || 0;
    // 엉덩이·몸통
    p[K.hY] = (lp(-0.02 - 0.018 * Math.cos(4 * PI * ph), -0.05 - 0.03 * Math.cos(4 * PI * (ph - 0.18)), rw) * ga + (-0.012 - 0.01 * Math.abs(ws)) * idle) * h;
    p[K.hX] = (-0.02 * Math.sin(TAU * ph) * ga * (1 - rw * 0.6) + 0.03 * ws * idle) * h;
    p[K.hRz] = -0.045 * Math.sin(TAU * ph) * ga * (1 - rw * 0.4) - 0.04 * ws * idle;
    p[K.hRy] = 0.09 * Math.cos(TAU * ph) * ga * (1 + 0.4 * rw);
    p[K.hRx] = 0.04 * rw * ga;
    p[K.tRx] = lp(0.03, 0.17, rw) * ga + cl(H.acc || 0, -2, 4) * 0.012;
    p[K.tRz] = 0.025 * ws * idle; p[K.cRz] = 0.012 * ws * idle;
    p[K.cRy] = -0.12 * Math.cos(TAU * ph) * ga + 0.08 * look * idle;
    p[K.cRx] = -0.02 * ga - 0.012 * br * idle;
    p[K.bRz] = cl(-H.yr * v * 0.035, -0.25, 0.25);
    p[K.nRx] = 0.006 * br * idle; p[K.nRy] = 0.3 * look * idle;
    p[K.hdRx] = -(p[K.tRx] + p[K.cRx] + p[K.hRx]) * 0.75 + lookP * idle;
    p[K.hdRy] = -(p[K.cRy] + p[K.hRy]) * 0.8 + 0.6 * look * idle;
    p[K.hdRz] = -0.02 * ws * idle;
    // 팔
    const A = lp(0.32, 0.62, rw) * ga, cph = Math.cos(TAU * ph);
    p[K.aLx] = A * cph + lp(0.05, -0.15, rw) * ga; p[K.aRx] = -A * cph + lp(0.05, -0.15, rw) * ga;
    p[K.aLz] = -lp(0.1, 0.2, rw) - 0.006 * br * idle; p[K.aRz] = lp(0.1, 0.2, rw) + 0.006 * br * idle;
    p[K.fLx] = -(lp(0.2, 1.3, rw) + 0.3 * Math.max(0, -p[K.aLx]) * (1 + rw)); p[K.fRx] = -(lp(0.2, 1.3, rw) + 0.3 * Math.max(0, -p[K.aRx]) * (1 + rw));
    p[K.fLy] = 0.25; p[K.fRy] = -0.25; p[K.wLx] = -0.1; p[K.wRx] = -0.1;
    if (H.rodOn) {   // 공명봉을 든 손: 지팡이처럼 세워 든다
      p[K.aRx] = lp(-0.08, -0.1 + 0.6 * A * -cph, ga) + rw * 0.3; p[K.aRz] = 0.12;
      p[K.fRx] = -lp(0.55, 1.1, rw) - 0.15 * ga; p[K.fRy] = -0.1; p[K.wRx] = -0.2;
      p[K.rod] = lp(0.95, 0.75, ga) - rw * 0.55;
    }
    // 말하기 몸짓 (무리 지어 이야기할 때)
    if (s.chat && idle > 0.5) chatPose(p, H, D, idle);
    // 다리 (발은 땅에 붙는다)
    for (const side of [-1, 1]) {
      const lph = (ph + (side < 0 ? 0 : 0.5)) % 1, S2 = beta * Cy * h / 2, lift = lp(0.075, 0.19, rw) * h;
      let z, y, psi;
      if (lph < beta) { const u = lph / beta; z = S2 * (1 - 2 * u); y = 0; psi = 0.16 * (1 - ss(0, 0.25, u)) * (1 - rw) - 0.5 * ss(0.62, 1, u); }
      else { const u = (lph - beta) / (1 - beta), e = 0.25 * u + 0.75 * u * u * (3 - 2 * u); z = -S2 + 2 * S2 * e; y = lift * Math.pow(Math.sin(PI * u), 0.85) + rw * 0.1 * h * Math.sin(PI * Math.min(1, u * 1.7)); psi = lp(-0.55, 0.2, ss(0.08, 0.8, u)); }
      const [sx, sz] = standFoot(H, side, D);
      const fx = lp(sx, side * (D.hipX + 0.006 * h - rw * 0.025 * h), ga), fz = lp(sz, z, ga), fy = y * ga; psi *= ga;
      legIK(p, side, D, fx, D.ankleY + fy + (psi < 0 ? 0.13 * h * Math.sin(-psi) : 0.05 * h * Math.sin(psi)), fz, psi);
    }
  }
  function chatPose(p, H, D, k) {
    const sp = H.speak || 0, t = H.t, g = H.gest || 0;
    const a = Math.sin(t * 2.3 + H.seed) * 0.5 + 0.5, b = Math.sin(t * 3.1 + H.seed * 2) * 0.5 + 0.5;
    const side = (H.seed & 1) ? 1 : -1, o = side < 0 ? K.aLx : K.aRx, f = side < 0 ? K.fLx : K.fRx, w = side < 0 ? K.wLx : K.wRx;
    if (!(H.rodOn && side > 0)) {
      p[o] = lp(p[o], -0.5 - 0.35 * a * sp, k * (0.4 + 0.6 * sp)); p[o + 2] += side * 0.12 * sp * b * k; p[f] = lp(p[f], -1.15 - 0.3 * b * sp, k * (0.4 + 0.6 * sp)); p[w] = lp(p[w], -0.4, k * sp);
    }
    p[K.hdRx] += (sp ? 0.04 * Math.sin(t * 4.1) : 0.06 * g) * k; p[K.hdRz] += 0.05 * Math.sin(t * 0.9 + H.seed) * k;
    p[K.cRy] += 0.06 * sp * Math.sin(t * 1.7) * k;
  }
  function poseClimb(p, H, D) {
    const c = H.cp, s1 = Math.sin(TAU * c), mv = H.climbMv || 0, h = D.s;
    p[K.bRx] = 0.12; p[K.hY] = -0.06 * h; p[K.hZ] = -0.02 * h;
    p[K.aLx] = -2.55 + 0.35 * s1 * mv; p[K.aRx] = -2.55 - 0.35 * s1 * mv; p[K.aLz] = -0.28; p[K.aRz] = 0.28;
    p[K.fLx] = -0.45 - 0.4 * Math.max(0, s1) * mv; p[K.fRx] = -0.45 - 0.4 * Math.max(0, -s1) * mv;
    p[K.wLx] = 0.3; p[K.wRx] = 0.3; p[K.hdRx] = -0.3; p[K.rod] = 0.2;
    for (const side of [-1, 1]) legIK(p, side, D, side * 0.13 * h, D.ankleY + (0.24 + 0.18 * Math.sin(TAU * c + (side < 0 ? 0 : PI)) * mv) * h, 0.26 * h, 0.35);
  }
  function poseGlide(p, H, D) {
    const t = H.t, w = Math.sin(t * 1.7) * 0.04, h = D.s;
    p[K.bRx] = 0.55; p[K.bRz] = cl(-H.yr * 0.25, -0.35, 0.35) + w; p[K.bY] = 0.05 * h;
    p[K.aLz] = -1.95; p[K.aLx] = 0.12; p[K.fLx] = -0.55; p[K.aRz] = 1.95; p[K.aRx] = 0.12; p[K.fRx] = -0.55; p[K.wLx] = 0.4; p[K.wRx] = 0.4;
    p[K.lLx] = 0.35 + w; p[K.sLx] = 0.55; p[K.ftLx] = 0.6; p[K.lRx] = 0.15 - w; p[K.sRx] = 0.35; p[K.ftRx] = 0.5;
    p[K.hdRx] = -0.55; p[K.nRx] = -0.15; p[K.rod] = 0.2;
  }
  function poseFall(p, H, D) {
    const t = H.t * 9;
    p[K.bRx] = -0.08; p[K.aLz] = -1.3 + 0.18 * Math.sin(t); p[K.aLx] = -0.5; p[K.aRz] = 1.3 - 0.18 * Math.sin(t + 1); p[K.aRx] = -0.5; p[K.fLx] = -0.5; p[K.fRx] = -0.5;
    p[K.lLx] = -0.7; p[K.sLx] = 1.0; p[K.lRx] = 0.15; p[K.sRx] = 0.55; p[K.ftLx] = 0.3; p[K.ftRx] = 0.4; p[K.hdRx] = 0.15; p[K.rod] = 0.6; void D;
  }
  function poseSwim(p, H, D) {
    const v = H.gv / D.s, mv = ss(0.3, 1.2, v), u = H.swp % 1, h = D.s;
    p[K.bRx] = lp(0.3, 1.2, mv); p[K.bY] = lp(-0.85, -0.525, mv) * h; p[K.hdRx] = -lp(0.25, 0.95, mv); p[K.nRx] = -0.15 * mv;
    // 평영: 팔을 벌려 당기고 앞으로 뻗기 / 제자리: 손을 젓기
    const out = ss(0, 0.35, u), pull = ss(0.35, 0.6, u), ext = ss(0.6, 1, u);
    const ax = lp(lp(lp(-2.9, -2.5, out), -1.3, pull), -2.9, ext), az = lp(lp(lp(-0.1, -0.9, out), -0.5, pull), -0.1, ext), fx = lp(lp(-0.2, -1.8, pull), -0.2, ext);
    const sc = Math.sin(H.t * 5);
    p[K.aLx] = lp(-0.9, ax, mv); p[K.aRx] = p[K.aLx]; p[K.aLz] = lp(-0.7 + 0.25 * sc, az, mv); p[K.aRz] = -p[K.aLz]; p[K.fLx] = lp(-0.6, fx, mv); p[K.fRx] = p[K.fLx];
    const kick = ss(0.4, 0.7, u) * (1 - ss(0.7, 0.85, u));
    p[K.lLx] = lp(-0.4 + 0.35 * Math.sin(H.t * 3), -0.4 * kick, mv); p[K.lRx] = lp(-0.4 - 0.35 * Math.sin(H.t * 3), -0.4 * kick, mv);
    p[K.lLz] = -0.35 * kick * mv; p[K.lRz] = 0.35 * kick * mv;
    p[K.sLx] = lp(0.8 + 0.3 * Math.sin(H.t * 3 + 1), 1.5 * kick, mv); p[K.sRx] = lp(0.8 - 0.3 * Math.sin(H.t * 3 + 1), 1.5 * kick, mv); p[K.ftLx] = 0.6; p[K.ftRx] = 0.6; p[K.rod] = 0.3;
  }
  function poseSit(p, H, D) {
    const br = Math.sin(H.t * TAU / 4.2 + H.seed % 7), h = D.s;
    p[K.hY] = 0.48 * h - D.hipY; p[K.hZ] = -0.05 * h; p[K.hRx] = -0.05;
    p[K.lLx] = -1.48; p[K.sLx] = 1.45; p[K.lRx] = -1.48; p[K.sRx] = 1.45; p[K.lLz] = 0.04; p[K.lRz] = -0.04;
    p[K.tRx] = 0.08; p[K.cRx] = 0.05 - 0.012 * br; p[K.hdRx] = 0.12;
    p[K.aLx] = -0.5; p[K.fLx] = -0.85; p[K.aLz] = -0.06; p[K.aRx] = -0.45; p[K.fRx] = -0.9; p[K.aRz] = 0.06; p[K.rod] = 1.2;
  }
  function poseKneel(p, H, D) {
    const h = D.s;
    p[K.hY] = 0.48 * h - D.hipY; p[K.hZ] = -0.06 * h;
    legIK(p, -1, D, -D.hipX - 0.02 * h, D.ankleY, 0.33 * h, 0);
    p[K.lRx] = 0.12; p[K.lRy] = 0; p[K.lRz] = 0; p[K.sRx] = 1.62; p[K.ftRx] = 0.6;
    p[K.tRx] = 0.18; p[K.cRx] = 0.06; p[K.hdRx] = 0.1;
    p[K.aLx] = -0.75; p[K.fLx] = -0.6; p[K.aRx] = -0.5; p[K.fRx] = -0.7; p[K.aLz] = -0.1; p[K.aRz] = 0.1; p[K.rod] = 1.0;
  }
  const POSE = { ground: poseGround, climb: poseClimb, glide: poseGlide, swim: poseSwim, fall: poseFall, sit: poseSit, kneel: poseKneel };
  // 휘두르기·주문 덧씌우기
  const ARMR = [K.aRx, K.aRy, K.aRz, K.fRx, K.fRy, K.wRx, K.wRz, K.rod, K.cRy, K.tRy];
  function overlayAtk(p, k, w) {
    const wind = ss(0, 0.22, k), strike = ss(0.2, 0.55, k);
    const o = { [K.aRx]: lp(lp(-0.3, -2.7, wind), -0.35, strike), [K.aRz]: lp(lp(0.1, 0.45, wind), -0.3, strike), [K.aRy]: lp(0, -0.3, strike), [K.fRx]: lp(lp(-0.4, -1.0, wind), -0.15, strike), [K.fRy]: -0.2,
      [K.wRx]: lp(-0.2, 0.3, strike), [K.wRz]: 0, [K.rod]: lp(lp(0.9, 1.5, wind), -0.2, strike), [K.cRy]: lp(lp(0, 0.35, wind), -0.4, strike), [K.tRy]: lp(lp(0, 0.15, wind), -0.18, strike) };
    for (const c of ARMR) p[c] = lp(p[c], o[c], w);
  }
  function overlayCast(p, c, w) {
    const o = { [K.aRx]: -1.55 - 0.45 * c, [K.aRz]: 0.1, [K.aRy]: -0.15, [K.fRx]: -0.25, [K.fRy]: -0.3, [K.wRx]: 0.2, [K.wRz]: 0, [K.rod]: -0.95, [K.cRy]: -0.16, [K.tRy]: -0.06 };
    for (const k of ARMR) p[k] = lp(p[k], o[k], w);
    p[K.aLx] = lp(p[K.aLx], -1.15, w); p[K.aLz] = lp(p[K.aLz], -0.3, w); p[K.fLx] = lp(p[K.fLx], -0.6, w); p[K.fLy] = lp(p[K.fLy], 0.9, w); p[K.wLx] = lp(p[K.wLx], -0.55, w);
    p[K.hdRx] = lp(p[K.hdRx], -0.06, w);
  }
  function applyPose(r, H, p, D) {
    const b = r.body, bn = H.bn;
    _e1.set(p[K.bRx], p[K.bRy], p[K.bRz]); b.quaternion.setFromEuler(_e1);
    _v1.set(0, H.pivY, 0); _v2.copy(_v1).applyQuaternion(b.quaternion);
    b.position.set(_v1.x - _v2.x, _v1.y - _v2.y + p[K.bY], _v1.z - _v2.z + p[K.bZ]);
    r.hips.position.set(p[K.hX], D.hipY + p[K.hY], p[K.hZ]); r.hips.rotation.set(p[K.hRx], p[K.hRy], p[K.hRz]);
    r.torso.rotation.set(p[K.tRx], p[K.tRy], p[K.tRz]); bn.chest.rotation.set(p[K.cRx], p[K.cRy], p[K.cRz]);
    bn.neck.rotation.set(p[K.nRx], p[K.nRy], 0); r.head.rotation.set(p[K.hdRx], p[K.hdRy], p[K.hdRz]);
    r.armL.rotation.set(p[K.aLx], p[K.aLy], p[K.aLz]); bn.foreL.rotation.set(p[K.fLx], p[K.fLy], 0); bn.handL.rotation.set(p[K.wLx], 0, p[K.wLz]);
    r.armR.rotation.set(p[K.aRx], p[K.aRy], p[K.aRz]); bn.foreR.rotation.set(p[K.fRx], p[K.fRy], 0); bn.handR.rotation.set(p[K.wRx], 0, p[K.wRz]);
    r.legL.rotation.set(p[K.lLx], p[K.lLy], p[K.lLz]); bn.shinL.rotation.set(p[K.sLx], 0, 0); bn.footL.rotation.set(p[K.ftLx], 0, 0);
    r.legR.rotation.set(p[K.lRx], p[K.lRy], p[K.lRz]); bn.shinR.rotation.set(p[K.sRx], 0, 0); bn.footR.rotation.set(p[K.ftRx], 0, 0);
    if (r.rod) r.rod.rotation.x = -p[K.rod];
  }
  const _wp = new T.Vector3(), _cam = new T.Vector3();
  const CAP = new Float32Array(7 * 6), ELL = { e: null, ie: new Float32Array(16), w: 0, h: 0, f: 0, b: 0, cy: 0 };
  function clothStep(r, H, dt, lod, snap) {
    const sk = H.skirt, D = H.D, sc = H.sc, h = D.s, bn = H.bn;
    sk.targets(r);
    if (!sk.ready || snap || Math.abs(sk.sc - sc) > 1e-3 || H.tele) sk.reset(sc);
    if (lod === 2) { sk.x.set(sk.tg); sk.xp.set(sk.tg); }
    // 충돌체: 허벅지·정강이 캡슐 (+ 가방), 골반 타원체
    let nc = 0;
    const capP = (a, b, rad) => { a.getWorldPosition(_v1); b.getWorldPosition(_v2); CAP[nc++] = _v1.x; CAP[nc++] = _v1.y; CAP[nc++] = _v1.z; CAP[nc++] = _v2.x; CAP[nc++] = _v2.y; CAP[nc++] = _v2.z; CAP[nc++] = rad * sc; };
    capP(bn.legL, bn.shinL, 0.1 * h); capP(bn.shinL, bn.footL, 0.078 * h); capP(bn.legR, bn.shinR, 0.1 * h); capP(bn.shinR, bn.footR, 0.078 * h);
    if (H.sp.satchel) { const q = satPos(D, H.sp); _v1.set(q[0], q[1] - D.hipY, q[2]).applyMatrix4(bn.hips.matrixWorld); for (let k = 0; k < 2; k++) { CAP[nc++] = _v1.x; CAP[nc++] = _v1.y; CAP[nc++] = _v1.z; } CAP[nc++] = 0.11 * h * sc; }
    const cap = CAP.subarray(0, nc);
    const hr = ringAt(torsoRings(D, H.sp), D.hipY - 0.02 * h);
    ELL.e = bn.hips.matrixWorld.elements; ELL.ie.set(_m2.copy(bn.hips.matrixWorld).invert().elements);
    ELL.w = hr.w + 0.022 * h; ELL.h = 0.16 * h; ELL.f = hr.f + 0.022 * h; ELL.b = hr.b + 0.024 * h; ELL.cy = -0.01 * h;
    r.getWorldPosition(_wp);
    const ground = _wp.y + (H.mode === 'swim' ? -5 : 0.015 * sc);
    if (lod === 0) {
      const n = snap ? 45 : Math.min(3, Math.max(1, Math.round(dt * 60))), hh = snap ? 1 / 60 : dt / n;
      const water = H.mode === 'swim', gy = water ? 1.2 : -9.8, drag = water ? 0.12 : 0.02;
      for (let i = 0; i < n; i++) sk.step(hh, gy, drag, cap, ELL, ground, snap ? 1 : (i + 1) / n);
    } else sk.collide(cap, ELL, ground);
    sk.pin0.set(sk.pin);
    sk.write(r);
  }
  function animRig(r, s, dt) {
    const H = r._h;
    if (!H) return legacyAnim ? legacyAnim(r, s, dt) : undefined;
    s = s || {};
    dt = dt > 0 ? Math.min(dt, 0.1) : 0;
    const D = H.D, first = !H.ready;
    H.ready = true; H.t += dt; r.ph += dt * 2; H.frame++;
    // 세계 위치·속도·회전
    _wp.copy(r.position); if (r.parent) _wp.applyMatrix4(r.parent.matrixWorld);
    const sc = H.sc = r.scale.x * (r.parent ? r.parent.matrixWorld.getMaxScaleOnAxis() : 1);
    H.tele = first;
    if (dt > 0 && !first) {
      const dx = _wp.x - H.px, dy = _wp.y - H.py, dz = _wp.z - H.pz;
      if (dx * dx + dz * dz > 9 * sc * sc || Math.abs(dy) > 3 * sc) H.tele = true;
      else { const k = Math.min(1, dt * 10), ov = Math.hypot(H.vx, H.vz); H.vx = lp(H.vx, dx / dt, k); H.vy = lp(H.vy, dy / dt, k); H.vz = lp(H.vz, dz / dt, k); H.acc = lp(H.acc || 0, (Math.hypot(H.vx, H.vz) - ov) / dt / sc, Math.min(1, dt * 4)); }
    }
    H.px = _wp.x; H.py = _wp.y; H.pz = _wp.z;
    const yaw = r.rotation.y, dyaw = dt > 0 && !first ? angW(yaw - H.yaw) / dt : 0; H.yaw = yaw; H.yr = lp(H.yr, cl(dyaw, -8, 8), Math.min(1, dt * 8));
    const hv = Math.hypot(H.vx, H.vz) / sc;
    // 상태
    const mode = s.mode || 'idle', grp = mode === 'idle' || mode === 'walk' || mode === 'run' ? 'ground' : POSE[mode] ? mode : 'ground';
    H.mode = mode;
    let gv = s.speed !== undefined ? s.speed / sc : mode === 'idle' ? 0 : hv > 0.25 ? hv : mode === 'run' ? 4.6 : mode === 'walk' ? 1.3 : hv;
    if (grp === 'swim') gv = s.speed !== undefined ? s.speed / sc : hv;
    H.gv = first || dt === 0 ? gv : lp(H.gv, gv, Math.min(1, dt * 6));
    const vb = H.gv / D.s;
    if (dt > 0) {
      H.gp += dt * vb / cl(0.75 + 0.5 * vb, 1.1, 3.8);
      H.swp += dt * Math.max(0.35, vb * 0.55);
      const vy = Math.abs(H.vy) / sc; H.climbMv = lp(H.climbMv || 0, ss(0.1, 0.6, vy + hv), Math.min(1, dt * 6)); H.cp += dt * (vy + hv) / 0.9;
    }
    // 서 있을 때의 무게 옮기기·둘러보기·말하기
    if (dt > 0) {
      H.wsT = (H.wsT ?? 2 + H.R() * 3) - dt;
      if (H.wsT <= 0) { H.wsT = 4 + H.R() * 4; H.wsTarget = (H.wsTarget || 1) > 0 ? -1 : 1; if (H.R() < 0.2) H.wsTarget = 0; }
      H.wsv = lp(H.wsv || 0, H.wsTarget || 0, Math.min(1, dt * 1.1));
      H.lkT = (H.lkT ?? 3 + H.R() * 4) - dt;
      if (H.lkT <= 0) { const away = !H.lkA; H.lkA = away; H.lkT = away ? 1.2 + H.R() * 2 : 3 + H.R() * 5; H.lkY = away ? (H.R() - 0.5) * 1.1 : 0; H.lkP = away ? (H.R() - 0.6) * 0.25 : 0; }
      const pl = H.look || 0; H.look = lp(pl, H.lkY || 0, Math.min(1, dt * 3)); H.lookP = lp(H.lookP || 0, H.lkP || 0, Math.min(1, dt * 3));
      H.glance = Math.abs((H.lkY || 0) - H.look) > 0.18 ? Math.sign((H.lkY || 0) - H.look) : 0;
      if (s.chat) { H.spT = (H.spT ?? H.R() * 4) - dt; if (H.spT <= 0) { H.spk = !H.spk; H.spT = H.spk ? 2.5 + H.R() * 3.5 : 3 + H.R() * 5; } H.speak = lp(H.speak || 0, H.spk ? 1 : 0, Math.min(1, dt * 3)); H.gest = Math.max(0, Math.sin(H.t * 1.3 + H.seed)); }
      else H.speak = 0;
    }
    H.rodOn = !!r.rod;
    // 동작별 자세를 섞는다
    if (!H.p) { H.p = new Float32Array(NCH); H.mp = {}; for (const m of MODES) { H.mp[m] = new Float32Array(NCH); H.w[m] = 0; } }
    let tw = 0;
    const P = H.p; P.fill(0);
    for (const m of MODES) {
      const tg = m === grp ? 1 : 0, rate = m === 'fall' || m === 'glide' || grp === 'fall' ? 9 : 7;
      H.w[m] = first || dt === 0 && first ? tg : tg > H.w[m] ? Math.min(tg, H.w[m] + dt * rate) : Math.max(tg, H.w[m] - dt * rate);
      if (first) H.w[m] = tg;
      if (H.w[m] < 1e-3) continue;
      const mp = H.mp[m]; mp.fill(0); POSE[m](mp, H, D, s);
      const w = H.w[m]; tw += w;
      for (let i = 0; i < NCH; i++) P[i] += mp[i] * w;
    }
    if (tw > 0) for (let i = 0; i < NCH; i++) P[i] /= tw;
    H.pivY = lp(D.hipY, D.chestY, H.w.glide || 0);
    // 휘두르기·주문
    if (s.atk > 0) { H.atkW = 1; H.atkK = cl(1 - s.atk / 0.28, 0, 1); } else H.atkW = Math.max(0, (H.atkW || 0) - dt * 6);
    if (H.atkW > 0) overlayAtk(P, H.atkK, H.atkW);
    const cw = s.cast > 0 ? 1 : 0; H.castW = first ? cw : lp(H.castW || 0, cw, Math.min(1, dt * 10)); if (s.cast > 0) H.castC = s.cast;
    if (H.castW > 0.01) overlayCast(P, H.castC || 1, H.castW);
    // 사람마다: 노인은 굽은 등
    if (H.sp.elder) { P[K.cRx] += 0.16; P[K.nRx] += 0.1; P[K.hdRx] -= 0.2; P[K.tRx] += 0.04; }
    applyPose(r, H, P, D);
    r.updateMatrixWorld(true);
    // 거리에 따른 세부 단계: 0 전부, 1 싸게(천은 쉬는 모양 + 충돌만, 3프레임마다), 2 멈춤
    let dist = 0;
    if (typeof GFX !== 'undefined' && GFX.camera) { GFX.camera.getWorldPosition(_cam); dist = _cam.distanceTo(_wp) / Math.max(1, sc); }
    const lod = dist < 25 ? 0 : dist < 70 ? 1 : 2, snap = first || H.tele;
    H.headHi.visible = dist < 18; H.headLo.visible = !H.headHi.visible;
    if (dt > 0 || snap) {
      // 머리카락 묶음: 머리 기준 중력 + 관성
      if (H.hairDyn && lod === 0) {
        const e = _m1.extractRotation(H.hairDyn.parent.matrixWorld).elements, gx = -e[1], gy = -e[5], gz = -e[9];
        H.hairDyn.getWorldPosition(_v3);
        if (H.hpp && dt > 0) { const vx = (_v3.x - H.hpp.x) / dt, vz = (_v3.z - H.hpp.z) / dt, vy = (_v3.y - H.hpp.y) / dt; const ax = (vx - (H.hvw ? H.hvw.x : vx)) / dt, ay = (vy - (H.hvw ? H.hvw.y : vy)) / dt, az = (vz - (H.hvw ? H.hvw.z : vz)) / dt; H.hvw = { x: vx, y: vy, z: vz }; H.hacc = { x: cl(ax, -30, 30) / sc, y: cl(ay, -30, 30) / sc, z: cl(az, -30, 30) / sc }; }
        H.hpp = _v3.clone();
        const a = H.hacc || { x: 0, y: 0, z: 0 }, la = [e[0] * a.x + e[1] * a.y + e[2] * a.z, e[4] * a.x + e[5] * a.y + e[6] * a.z, e[8] * a.x + e[9] * a.y + e[10] * a.z];
        const amp = H.hairAmp;
        const tx = cl(Math.atan2(-gz, -gy) * 0.7 * amp - la[2] * 0.012 * amp, -0.7, 0.7), tz = cl(Math.atan2(gx, -gy) * 0.7 * amp + la[0] * 0.012 * amp, -0.6, 0.6);
        if (snap) { H.hx = tx; H.hz = tz; H.hvx = H.hvz = 0; }
        else { const k = 110, c = 9; H.hvx += ((tx - H.hx) * k - H.hvx * c) * dt; H.hvz += ((tz - H.hz) * k - H.hvz * c) * dt; H.hx += H.hvx * dt; H.hz += H.hvz * dt; }
        H.hairDyn.rotation.set(H.hx, 0, H.hz);
      }
      // 소매
      if (lod === 0 || snap || H.frame % 4 === 0) { H.sleeves[0].update(H.bn.foreL, dt, snap); H.sleeves[1].update(H.bn.foreR, dt, snap); }
      // 치마
      if (lod === 0 || snap || (lod === 1 && H.frame % 3 === 0)) clothStep(r, H, dt, snap ? 0 : lod, snap);
      if (H.stole && (lod === 0 || snap || H.frame % 3 === 0)) H.stole.update(r, dt, lod > 0 && !snap, snap);
      // 날개
      if (H.glider) { H.glider.update(dt, grp === 'glide', 1); if (r.rod) r.rod.visible = H.glider.open < 0.5; }
      // 얼굴: 깜박임 > 옆 보기 > 말하기·표정
      if (H.face) {
        H.bT = (H.bT ?? 1 + H.R() * 3) - dt;
        if (H.bT <= 0) { H.bT = 2.2 + H.R() * 4.5; H.bS = 0; }
        let st = 0;
        if (H.bS !== undefined && H.bS < 0.14) { H.bS += dt; st = H.bS < 0.035 ? 1 : H.bS < 0.09 ? 2 : 1; }
        else if (H.glance) st = H.glance < 0 ? 3 : 4;
        else if (H.speak > 0.5) st = Math.sin(H.t * 17 + Math.sin(H.t * 5) * 2) > 0.1 ? 6 : 0;
        else if (H.expr) st = H.expr;
        if (st !== H.faceSt) { H.faceSt = st; H.face.offset.y = (7 - st) / 8; }
      }
    }
    if (H.glider && grp !== 'glide' && dt === 0) H.glider.update(0, false, 0);
  }

  // ===================================================================
  // 13. 바꿔 끼우기 + 보기 페이지용 도우미
  // ===================================================================
  window.makeRig = makeRig; window.animRig = animRig;
  HERO.makeRig = makeRig; HERO.animRig = animRig; HERO.spec = spec;
  // 무리 속 학생 생김새 (seed로 정해진다)
  HERO.student = seed => { const R = rng(seed * 31 + 7); return { cloak: '#262a3f', trim: pick(R, TRIMS), hair: pick(R, HAIRS), skin: pick(R, SKINS), body: '#e8e0cf', seed, scale: 0.95 + R() * 0.08 }; };
  HERO.expr = (r, st) => { if (r._h) r._h.expr = st; };
  HERO.breakdown = r => { const o = {}; r.traverse(m => { if (m.isMesh && m.geometry) { let n = m.name || (m.isSkinnedMesh ? 'skinned' : m.parent === r ? 'root' : 'mesh'); if (m === r._h.skirt.mesh) n = 'skirt'; else if (r._h.stole && m === r._h.stole.mesh) n = 'stole'; else if (m === r._h.headHi) n = 'head'; else if (m === r._h.headLo) return; else if (r._h.sleeves.some(x => x.mesh === m)) n = 'sleeve'; else if (r._h.glider && r._h.glider.group.children.includes(m)) n = 'glider'; else if (r.rod && (m.parent === r.rod)) n = 'rod'; else if (m.material && m.material === MAT.hair) n = 'hair'; const g = m.geometry; o[n] = (o[n] || 0) + (g.index ? g.index.count : g.attributes.position.count) / 3; } }); return o; };
  HERO.tris = r => { let t = 0; r.traverse(m => { if (m.isMesh && m.visible && m.geometry) { const g = m.geometry; t += (g.index ? g.index.count : g.attributes.position.count) / 3; } }); return t; };
})();
