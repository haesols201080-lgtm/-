// 도시 건물 모양 모음 (반지름 약 1, 높이 1 단위 — 인스턴스가 늘이고 줄인다).
// 모든 면에 fac 속성 = [둘레를 따라 잰 거리, 외벽 종류] 을 넣어, 셰이더(litMaterial facade)가
// 어떤 모양에서도 곧은 멀리언·층 띠·방마다의 불빛을 그린다.
//   외벽 종류: 0 없음(지붕·장식) 1 유리 커튼월 2 띠창 3 점창 4 첨탑(나선 빛)
// 각 모양은 { hi, lo } — hi 는 가까이서(1~2 km), lo 는 멀리서(실루엣만 같게).
import * as THREE from 'three';

const GOLD = 0xc9a86c, PEARL = 0xd4cfd8, PEARL2 = 0xbfbac8, STEEL = 0xa9b4c2, GARDEN = 0x8fc89a;
const ACC = 0x7ff3e6;
const TAU = Math.PI * 2;
const _c = new THREE.Color();
/** 보조 랜드마크의 자리 정보(착륙판·데크·꼬투리) — cityArchetypes() 가 채운다 */
export let LANDMARKS = {};

// ── 모양 만들기 도구 ─────────────────────────────
/** 둥근 사각형(초타원) 둘레 n 점: k=2 원, 4 둥근 네모, 8 거의 네모 */
export function squircle(n, a = 1, b = 1, k = 4, rot = 0) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * TAU + Math.PI / n;
    const c = Math.cos(t), s = Math.sin(t);
    let x = a * Math.sign(c) * Math.pow(Math.abs(c), 2 / k), z = b * Math.sign(s) * Math.pow(Math.abs(s), 2 / k);
    const cr = Math.cos(rot), sr = Math.sin(rot);
    out.push([x * cr - z * sr, x * sr + z * cr]);
  }
  return out;
}

/** 단면들을 이어 벽을 만든다. secs: [{ y, pts:[[x,z]...], s?:배율, rot?, dx?, dz?, ys?: (x,z)=>y }] */
export function loft(secs, { color = PEARL, emit = 0, type = 1, smooth = true } = {}) {
  const n = secs[0].pts.length;
  const P = [], U = [];
  let ref = 0;
  for (const S of secs) {
    const cr = Math.cos(S.rot || 0), sr = Math.sin(S.rot || 0), k = S.s ?? 1;
    const ring = S.pts.map(([x, z]) => { const X = x * k, Z = z * k; return [X * cr - Z * sr + (S.dx || 0), X * sr + Z * cr + (S.dz || 0)]; });
    // 둘레 길이로 정규화: 가늘어지는 탑에서도 멀리언이 곧게 선다 (첫 단면의 둘레를 기준으로)
    let per = 0;
    for (let i = 1; i <= n; i++) { const [x, z] = ring[i % n], [px, pz] = ring[i - 1]; per += Math.hypot(x - px, z - pz); }
    if (!ref) ref = per || 1;
    let u = 0;
    for (let i = 0; i <= n; i++) {
      const [x, z] = ring[i % n];
      if (i) { const [px, pz] = ring[i - 1]; u += Math.hypot(x - px, z - pz); }
      P.push(x, S.ys ? S.ys(x, z) : S.y, z);
      U.push(per > 1e-6 ? (u / per) * ref : u);
    }
  }
  const idx = [];
  for (let j = 0; j < secs.length - 1; j++) {
    for (let i = 0; i < n; i++) {
      const a = j * (n + 1) + i, b = a + 1, c = a + (n + 1), d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  let g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('fu', new THREE.Float32BufferAttribute(U, 1));
  g.setIndex(idx);
  if (smooth) { g.computeVertexNormals(); g = g.toNonIndexed(); } else { g = g.toNonIndexed(); g.computeVertexNormals(); }
  return paint(g, color, emit, type);
}

/** 위(또는 아래)를 덮는 뚜껑 — 부채꼴 */
export function cap(S, { color = PEARL, emit = 0, down = false } = {}) {
  const n = S.pts.length, k = S.s ?? 1, cr = Math.cos(S.rot || 0), sr = Math.sin(S.rot || 0);
  const ring = S.pts.map(([x, z]) => { const X = x * k, Z = z * k; return [X * cr - Z * sr + (S.dx || 0), X * sr + Z * cr + (S.dz || 0)]; });
  let cx = 0, cz = 0;
  for (const [x, z] of ring) { cx += x; cz += z; }
  cx /= n; cz /= n;
  const P = [];
  for (let i = 0; i < n; i++) {
    const [x0, z0] = ring[i], [x1, z1] = ring[(i + 1) % n];
    const y0 = S.ys ? S.ys(x0, z0) : S.y, y1 = S.ys ? S.ys(x1, z1) : S.y, yc = S.ys ? S.ys(cx, cz) : S.y;
    if (down) P.push(cx, yc, cz, x0, y0, z0, x1, y1, z1);
    else P.push(cx, yc, cz, x1, y1, z1, x0, y0, z0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.computeVertexNormals();
  return paint(g, color, emit, 0);
}

/** 정점색·발광·외벽 속성 칠하기 */
function paint(g, color, emit, type) {
  const pos = g.attributes.position, n = pos.count;
  const col = new Float32Array(n * 3), em = new Float32Array(n), fac = new Float32Array(n * 2);
  const fu = g.attributes.fu;
  // 색·외벽 종류는 삼각형마다 한 값(가운데 점으로 판정): 꼭짓점마다 정하면 위아래 두 단면뿐인 벽에서
  // 종류가 바닥 0 → 꼭대기 1 로 번져 아래 절반의 창이 사라지고 색이 탑 전체에 걸쳐 섞인다.
  const tri = !g.index && n % 3 === 0;
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    let qx = x, qy = y, qz = z;
    if (tri) { const t = i - (i % 3); qx = (pos.getX(t) + pos.getX(t + 1) + pos.getX(t + 2)) / 3; qy = (pos.getY(t) + pos.getY(t + 1) + pos.getY(t + 2)) / 3; qz = (pos.getZ(t) + pos.getZ(t + 1) + pos.getZ(t + 2)) / 3; }
    _c.set(typeof color === 'function' ? color(qx, qy, qz) : color);
    col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b;
    em[i] = typeof emit === 'function' ? emit(x, y, z) : emit;
    fac[i * 2] = fu ? fu.getX(i) : 0;
    fac[i * 2 + 1] = typeof type === 'function' ? type(qx, qy, qz) : type;
  }
  const anc = g.attributes.anc ? g.attributes.anc.array.slice() : new Float32Array(n * 3);
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('emit', new THREE.BufferAttribute(em, 1));
  g.setAttribute('fac', new THREE.BufferAttribute(fac, 2));
  g.setAttribute('anc', new THREE.BufferAttribute(anc, 3));
  return g;
}

/**
 * 실제 미터에 고정: geo 의 y 는 「미터」(기준 높이에서 위로), x·z 는 단위 모양 좌표.
 * 셰이더가 y = 기준 + 미터/건물높이 로 되돌린다 → 탑이 100 m 든 400 m 든 로비·차양·난간·옥상 장비가 같은 크기.
 * out: (x, y미터, z) → 바깥으로 밀어낼 미터 (차양 깊이 등)
 */
export function pin(g, anchorY, out = null) {
  const pos = g.attributes.position, n = pos.count;
  const anc = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    anc[i * 3] = 1; anc[i * 3 + 1] = y; anc[i * 3 + 2] = out ? out(x, y, z) : 0;
    pos.setY(i, anchorY);
  }
  g.setAttribute('anc', new THREE.BufferAttribute(anc, 3));
  return g;
}

/** three 기본 도형에 칠하기 (외벽 없음) */
export function solid(geo, color = PEARL, emit = 0) {
  const anc = geo.attributes.anc;
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (anc && !g.attributes.anc) g.setAttribute('anc', anc);
  if (!g.attributes.normal) g.computeVertexNormals();
  return paint(g, color, emit, 0);
}

export function mergeF(parts) {
  let n = 0;
  for (const p of parts) n += p.attributes.position.count;
  const out = { position: new Float32Array(n * 3), normal: new Float32Array(n * 3), color: new Float32Array(n * 3), emit: new Float32Array(n), fac: new Float32Array(n * 2), anc: new Float32Array(n * 3) };
  let o = 0;
  for (const p of parts) {
    const c = p.attributes.position.count;
    out.position.set(p.attributes.position.array, o * 3);
    out.normal.set(p.attributes.normal.array, o * 3);
    out.color.set(p.attributes.color.array, o * 3);
    out.emit.set(p.attributes.emit.array, o);
    out.fac.set(p.attributes.fac.array, o * 2);
    if (p.attributes.anc) out.anc.set(p.attributes.anc.array, o * 3);
    o += c;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(out.position, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(out.normal, 3));
  g.setAttribute('color', new THREE.BufferAttribute(out.color, 3));
  g.setAttribute('emit', new THREE.BufferAttribute(out.emit, 1));
  g.setAttribute('fac', new THREE.BufferAttribute(out.fac, 2));
  g.setAttribute('anc', new THREE.BufferAttribute(out.anc, 3));
  g.computeBoundingSphere();
  return g;
}

export const ring = (y, pts, opt = {}) => ({ y, pts, ...opt });
/** 바깥으로 살짝 튀어나온 층판(띠) */
function band(pts, y, h, out = 1.05, color = PEARL, emit = 0, base = {}) {
  return loft([ring(y, pts, { ...base, s: (base.s ?? 1) * out }), ring(y + h, pts, { ...base, s: (base.s ?? 1) * out })], { color, emit, type: 0, smooth: false });
}
// ── 실제 미터 장식 (pin) ─────────────────────────
/** 단면 둘레를 따라 띠: 높이 y0m~y1m(미터, anchorY 기준), 바깥 밀기 o0~o1(미터). 세로 벽(o0=o1) 또는 가로 판(y0m=y1m) */
function aStrip(pts, base, anchorY, y0m, y1m, o0, o1, color, emit = 0, down = false) {
  const n = pts.length, k = base.s ?? 1, cr = Math.cos(base.rot || 0), sr = Math.sin(base.rot || 0);
  const R = pts.map(([x, z]) => { const X = x * k, Z = z * k; return [X * cr - Z * sr + (base.dx || 0), X * sr + Z * cr + (base.dz || 0)]; });
  const P = [], N = [], A = [];
  const flat = Math.abs(y1m - y0m) < 1e-6;
  for (let i = 0; i < n; i++) {
    const [ax, az] = R[i], [bx, bz] = R[(i + 1) % n];
    let nx = bz - az, nz = -(bx - ax); const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
    // 단면이 시계 방향이면 법선을 뒤집는다 (바깥을 향하게)
    if (nx * (ax + bx) + nz * (az + bz) < 0) { nx = -nx; nz = -nz; }
    const ny = flat ? (down ? -1 : 1) : 0;
    const v = [[ax, y0m, az, o0], [bx, y0m, bz, o0], [bx, y1m, bz, o1], [ax, y1m, az, o1]];
    const tri = down ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3];
    for (const t of tri) {
      const [x, y, z, o] = v[t];
      P.push(x, anchorY, z); A.push(1, y, o);
      if (flat) N.push(0, ny, 0); else N.push(nx, 0, nz);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('anc', new THREE.Float32BufferAttribute(A, 3));
  return paint(g, color, emit, 0);
}
/** 미터 상자: 단위 좌표 (cx, cz) 둘레 반폭 (wx, wz 단위), 높이 y0m~y1m, 바깥 밀기 o */
function aBox(cx, cz, wx, wz, anchorY, y0m, y1m, color, emit = 0, o = 0) {
  const g = new THREE.BoxGeometry(wx * 2, y1m - y0m, wz * 2).translate(cx, (y0m + y1m) / 2, cz).toNonIndexed();
  pin(g, anchorY, () => o);
  return solid(g, color, emit);
}
/** 땅 층: 차양(높이 h, 깊이 d, 두께 0.4 m, 끝에 빛줄) + 차양 끝 기둥 */
function baseKit(pts, { base = {}, h = 5.6, d = 2.8, cols = 0, color = PEARL2 } = {}) {
  const P = [aStrip(pts, base, 0, h, h, 0, d, color), aStrip(pts, base, 0, h - 0.4, h - 0.4, 0, d, color, 0, true), aStrip(pts, base, 0, h - 0.4, h, d, d, color), aStrip(pts, base, 0, h - 0.47, h - 0.4, d - 0.05, d - 0.05, ACC, 1.6)];
  if (cols) {
    const n = pts.length, step = Math.max(1, Math.floor(n / cols)), k = base.s ?? 1, cr = Math.cos(base.rot || 0), sr = Math.sin(base.rot || 0);
    for (let i = 0; i < n; i += step) {
      const [x, z] = pts[i], X = x * k, Z = z * k;
      P.push(aBox(X * cr - Z * sr + (base.dx || 0), X * sr + Z * cr + (base.dz || 0), 0.008, 0.008, 0, 0, h - 0.4, GOLD, 0, d - 0.5));
    }
  }
  return P;
}
/** 지붕 둘레: 난간벽(높이 h) + 위의 빛줄. glass 면 유리 난간 */
function parapet(pts, topY, { base = {}, h = 1.15, color = PEARL2, glass = false } = {}) {
  const P = [aStrip(pts, base, topY, 0, h, 0, 0, glass ? 0x9fd8e8 : color, glass ? 0.25 : 0)];
  P.push(aStrip(pts, base, topY, h, h + 0.08, 0, 0, glass ? ACC : GOLD, glass ? 1.4 : 0.2));
  return P;
}
/** 옥상 기계실·환기 상자·울림 집광판 (미터 크기) */
function roofGear(topY, r, rnd, { pv = true } = {}) {
  const P = [];
  P.push(aBox(-r * 0.25, r * 0.1, r * 0.22, r * 0.16, topY, 0, 3.6, STEEL));
  P.push(aBox(-r * 0.25, r * 0.1, r * 0.2, r * 0.14, topY, 3.6, 3.75, ACC, 1.2));
  for (let i = 0; i < 3; i++) P.push(aBox(r * (0.25 + i * 0.12), -r * 0.35, r * 0.04, r * 0.04, topY, 0, 1.6, 0x9aa4b2));
  if (pv) for (let i = 0; i < 4; i++) {
    const g = new THREE.BoxGeometry(r * 0.22, 0.08, r * 0.12).rotateX(-0.35).translate(r * 0.3, 0.9, r * (0.05 + i * 0.16)).toNonIndexed();
    P.push(solid(pin(g, topY), 0x24304a, 0.15));
  }
  void rnd;
  return P;
}

/** 지붕 장비: 착륙 원반 + 안테나 */
function roofKit(y, r, { pad = true, mast = 0.12, color = PEARL } = {}) {
  const P = [];
  if (pad) {
    P.push(solid(new THREE.CylinderGeometry(r, r * 0.92, 0.012, 16).translate(0, y + 0.006, 0), color));
    P.push(solid(new THREE.TorusGeometry(r * 0.7, 0.006, 3, 20).rotateX(Math.PI / 2).translate(0, y + 0.014, 0), ACC, 2.0));
  }
  if (mast) {
    P.push(solid(new THREE.CylinderGeometry(0.008, 0.02, mast, 4).translate(r * 0.4, y + mast / 2, r * 0.2), STEEL));
    P.push(solid(new THREE.OctahedronGeometry(0.018, 0).translate(r * 0.4, y + mast + 0.01, r * 0.2), 0xff6a5a, 3));
  }
  return P;
}

// ── 건물 모양들 ─────────────────────────────
export function cityArchetypes() {
  const A = {};

  // 비틀린 탑: 둥근 네모가 올라가며 돌고 가늘어진다. 층판 띠 셋, 빛나는 관, 바늘
  {
    const make = (n, steps) => {
      const pts = squircle(n, 1, 1, 4, n < 6 ? Math.PI / 4 : 0);
      const secs = [];
      for (let i = 0; i <= steps; i++) { const y = (i / steps) * 0.92; secs.push(ring(y, pts, { s: (1 - 0.24 * y) * (n < 6 ? 1.15 : 1), rot: y * 1.25 })); }
      const top = secs[secs.length - 1];
      const P = [loft(secs, { color: (x, y) => (y < 0.02 ? GOLD : PEARL), type: (x, y) => (y < 0.03 ? 0 : 1) })];
      if (n > 10) for (const y of [0.3, 0.6]) P.push(band(pts, y, 0.008, 1.04, PEARL, 0, { s: 1 - 0.24 * y, rot: y * 1.25 }));
      P.push(band(pts, 0.92, 0.012, 1.02, ACC, 1.8, { s: 1 - 0.24 * 0.92, rot: 0.92 * 1.25 }));
      P.push(loft([top, ring(0.97, pts, { s: 0.42, rot: 1.2 })], { color: PEARL2, type: 0 }));
      P.push(cap(ring(0.97, pts, { s: 0.42, rot: 1.2 })));
      if (n > 10) P.push(solid(new THREE.ConeGeometry(0.05, 0.12, 6).translate(0, 1.03, 0), PEARL, 0.3), ...roofKit(0.97, 0.3, { pad: false, mast: 0.08 }));
      else P.push(solid(new THREE.ConeGeometry(0.05, 0.12, 4).translate(0, 1.03, 0), PEARL));
      return mergeF(P);
    };
    A.twist = { hi: make(16, 7), lo: make(4, 1) };
  }

  // 칼날 탑: 길쭉한 렌즈 평면, 비스듬히 잘린 머리, 양 끝의 지느러미
  {
    const make = (n, hi) => {
      const pts = squircle(n, 1, 0.42, 2.2);
      const topY = (x) => 0.82 + 0.16 * (x + 1) / 2;
      const P = [loft([ring(0, pts), ring(0.4, pts, { s: 0.94 }), ring(0, pts, { s: 0.86, ys: (x) => topY(x / 0.86) })], { color: (x, y) => (y < 0.02 ? GOLD : PEARL), type: (x, y) => (y < 0.02 ? 0 : 1) })];
      P.push(cap(ring(0, pts, { s: 0.86, ys: (x) => topY(x / 0.86) }), { color: PEARL2 }));
      if (hi) {
        P.push(solid(new THREE.BoxGeometry(0.05, 1.04, 0.1).translate(-0.9, 0.52, 0), PEARL));
        P.push(solid(new THREE.BoxGeometry(0.03, 0.9, 0.04).translate(0.88, 0.45, 0), ACC, 1.6));
        P.push(loft([ring(0, pts, { s: 0.87, ys: (x) => topY(x / 0.87) }), ring(0, pts, { s: 0.87, ys: (x) => topY(x / 0.87) + 0.008 })], { color: ACC, emit: 1.8, type: 0 }));
      }
      return mergeF(P);
    };
    A.blade = { hi: make(18, true), lo: make(6, false) };
  }

  // 엇갈려 쌓인 탑: 둥근 상자 넷이 돌며 튀어나온다. 단마다 옥상 정원
  {
    const V = [[0, 0.34, 1, 0.78, 0, 0, 0, 1], [0.34, 0.6, 0.86, 0.72, 0.42, 0.14, 0.06, 2], [0.6, 0.84, 0.78, 0.6, -0.3, -0.12, 0.1, 1], [0.84, 0.96, 0.5, 0.42, 0.15, 0.05, -0.04, 2]];
    const make = (n, hi) => {
      const P = [];
      for (const [y0, y1, w, d, rot, dx, dz, t] of hi ? V : [V[0], [0.34, 0.86, 0.84, 0.68, 0.1, 0.02, 0.06, 1], V[3]]) {
        const pts = squircle(n, w, d, 8);
        const o = { rot, dx, dz };
        P.push(loft([ring(y0, pts, o), ring(y1, pts, o)], { color: (x, y) => (y < 0.02 ? GOLD : PEARL), type: t, smooth: n > 8 }));
        P.push(cap(ring(y1, pts, o), { color: hi ? GARDEN : PEARL2 }));
        if (hi) P.push(band(pts, y1 - 0.004, 0.01, 1.03, y1 > 0.9 ? ACC : PEARL, y1 > 0.9 ? 1.6 : 0, o));
        if (y0 > 0) P.push(cap(ring(y0, pts, o), { color: PEARL2, down: true }));
      }
      if (hi) P.push(...roofKit(0.96, 0.22, { pad: true, mast: 0.06 }));
      return mergeF(P);
    };
    A.stack = { hi: make(16, true), lo: make(4, false) };
  }

  // 첨탑: 둥글게 가늘어지며 솟는 탑, 나선으로 도는 빛
  {
    const make = (n, steps) => {
      const pts = squircle(n, 1, 1, 2);
      const secs = [];
      for (let i = 0; i <= steps; i++) { const y = (i / steps) * 0.9; secs.push(ring(y, pts, { s: Math.max(0.12, 1 - 0.88 * Math.pow(y / 0.9, 1.15)) })); }
      const P = [loft(secs, { color: (x, y) => (y < 0.02 ? GOLD : PEARL), type: (x, y) => (y < 0.02 ? 0 : 4) })];
      P.push(solid(new THREE.ConeGeometry(0.11, 0.12, n > 8 ? 8 : 4).translate(0, 0.96, 0), PEARL, 0.4));
      P.push(solid(new THREE.OctahedronGeometry(0.03, 0).translate(0, 1.03, 0), ACC, 3));
      return mergeF(P);
    };
    A.spire = { hi: make(14, 6), lo: make(4, 1) };
  }

  // 쌍둥이 탑: 두 탑을 공중다리 둘이 잇는다
  {
    const make = (n, hi) => {
      const P = [];
      for (const [x, h] of [[-0.58, 0.92], [0.58, 0.8]]) {
        const pts = squircle(n, 0.4, 0.4, 4);
        P.push(loft([ring(0, pts, { dx: x }), ring(h, pts, { dx: x, s: 0.9 })], { color: (xx, y) => (y < 0.02 ? GOLD : PEARL), type: (xx, y) => (y < 0.02 ? 0 : 1) }));
        P.push(loft([ring(h, pts, { dx: x, s: 0.9 }), ring(h + 0.05, pts, { dx: x, s: 0.4 })], { color: PEARL2, type: 0 }));
        P.push(cap(ring(h + 0.05, pts, { dx: x, s: 0.4 })));
        if (hi) P.push(band(pts, h - 0.01, 0.012, 1.0, ACC, 1.8, { dx: x, s: 0.925 }));
      }
      const br = (y, t) => { const pts = squircle(n > 8 ? 8 : 4, 0.6, 0.16, 8); P.push(loft([ring(y, pts), ring(y + t, pts)], { color: PEARL, type: 1, smooth: false }), cap(ring(y + t, pts), { color: PEARL2 }), cap(ring(y, pts), { color: PEARL2, down: true })); };
      br(0.52, 0.06);
      if (hi) br(0.72, 0.04);
      return mergeF(P);
    };
    A.twin = { hi: make(12, true), lo: make(4, false) };
  }

  // 알 탑: 부풀었다 좁아지는 유기적인 몸통 + 띠창 + 허리의 빛 고리
  {
    const prof = [[0.62, 0], [0.9, 0.12], [1, 0.32], [0.96, 0.52], [0.8, 0.72], [0.52, 0.88], [0.18, 0.97]];
    const make = (n) => {
      const pts = squircle(n, 1, 1, 2);
      const P = [loft((n > 8 ? prof : [prof[0], prof[2], prof[4], prof[6]]).map(([r, y]) => ring(y, pts, { s: r })), { color: (x, y) => (y < 0.02 ? GOLD : PEARL), type: (x, y) => (y > 0.9 ? 0 : 2) })];
      P.push(cap(ring(0.97, pts, { s: 0.18 })));
      P.push(band(pts, 0.62, 0.012, 0.92, ACC, 1.8));
      return mergeF(P);
    };
    A.ovoid = { hi: make(16), lo: make(5) };
  }

  // 아콜로지: 네 단 계단 탑, 단마다 정원과 빛나는 난간
  {
    const T = [[0, 0.3, 1], [0.3, 0.55, 0.8], [0.55, 0.78, 0.6], [0.78, 1, 0.4]];
    const make = (n, hi) => {
      const pts = squircle(n, 1, 1, 6);
      const P = [];
      for (const [y0, y1, r] of hi ? T : [[0, 0.5, 1], [0.5, 1, 0.55]]) {
        P.push(loft([ring(y0, pts, { s: r }), ring(y1, pts, { s: r })], { color: (x, y) => (y < y0 + 0.01 ? GOLD : PEARL), type: 2, smooth: n > 8 }));
        P.push(cap(ring(y1, pts, { s: r }), { color: y1 < 1 ? GARDEN : PEARL2 }));
        if (hi && y1 < 1) P.push(band(pts, y1, 0.01, r * 1.0, ACC, 1.4));
      }
      if (hi) P.push(...roofKit(1, 0.25, { pad: true, mast: 0.08 }));
      return mergeF(P);
    };
    A.arcology = { hi: make(16, true), lo: make(4, false) };
  }

  // 사무 판상: 길쭉한 둥근 네모, 커튼월, 옥상 기계실과 세로 빛 지느러미
  {
    const make = (n, hi) => {
      const pts = squircle(n, 1, 1, 10);
      const P = [loft([ring(0, pts), ring(0.88, pts)], { color: (x, y) => (y < 0.01 ? GOLD : PEARL), type: (x, y) => (y < 0.01 ? 0 : 1), smooth: n > 8 })];
      P.push(cap(ring(0.88, pts), { color: PEARL2 }));
      const p2 = squircle(n, 0.6, 0.6, 10);
      P.push(loft([ring(0.88, p2), ring(0.97, p2)], { color: STEEL, type: 0, smooth: false }), cap(ring(0.97, p2), { color: PEARL2 }));
      if (hi) {
        P.push(band(pts, 0.875, 0.012, 1.02, ACC, 1.6));
        P.push(solid(new THREE.BoxGeometry(0.05, 0.8, 0.07).translate(0, 0.44, 1.0), ACC, 1.3));
      }
      return mergeF(P);
    };
    A.slab = { hi: make(16, true), lo: make(4, false) };
  }

  // 낮은 집(교외): 두 상자가 엇갈려 얹히고 넓은 처마가 뜬다
  {
    const make = (n, hi) => {
      const a = squircle(n, 1, 0.7, 10), b = squircle(n, 0.75, 0.6, 10);
      const P = [loft([ring(0, a), ring(0.45, a)], { color: (x, y) => (y < 0.01 ? GOLD : PEARL), type: 2, smooth: false }), cap(ring(0.45, a), { color: GARDEN })];
      P.push(loft([ring(0.45, b, { dx: 0.25, dz: 0.15, rot: 0.3 }), ring(0.88, b, { dx: 0.25, dz: 0.15, rot: 0.3 })], { color: PEARL, type: 3, smooth: false }));
      const roofPts = squircle(n, 0.95, 0.78, 10);
      P.push(loft([ring(0.88, roofPts, { dx: 0.25, dz: 0.15, rot: 0.3 }), ring(0.94, roofPts, { dx: 0.25, dz: 0.15, rot: 0.3 })], { color: PEARL2, type: 0, smooth: false }));
      P.push(cap(ring(0.94, roofPts, { dx: 0.25, dz: 0.15, rot: 0.3 }), { color: PEARL2 }), cap(ring(0.88, roofPts, { dx: 0.25, dz: 0.15, rot: 0.3 }), { color: PEARL2, down: true }));
      if (hi) P.push(band(roofPts, 0.9, 0.012, 1.018, ACC, 1.4, { dx: 0.25, dz: 0.15, rot: 0.3 })); // 처마 판 옆면보다 바깥 (같은 면이면 깜박인다)
      return mergeF(P);
    };
    A.villa = { hi: make(12, true), lo: make(4, false) };
  }

  // 기단: 탑 밑을 잇는 블록 (띠창 + 옥상 정원 + 빛 난간)
  {
    const make = (hi) => {
      const pts = squircle(4, Math.SQRT2, Math.SQRT2, 2, 0);
      const P = [loft([ring(0, pts), ring(1, pts)], { color: (x, y) => (y < 0.01 ? GOLD : PEARL), type: 2, smooth: false }), cap(ring(1, pts), { color: (x, y, z) => (Math.abs(x) < 0.7 && Math.abs(z) < 0.6 ? GARDEN : 0xc8c2d2) })];
      if (hi) P.push(band(pts, 0.96, 0.03, 1.012, ACC, 1.2));
      return mergeF(P);
    };
    A.podium = { hi: make(true), lo: make(false) };
  }

  // ── 지방 양식 ──
  // 둥근 집 (들판 마을)
  {
    const make = (n, rows) => {
      const pts = squircle(n, 1, 1, 2);
      const secs = [];
      for (let i = 0; i <= rows; i++) { const t = (i / rows) * (Math.PI / 2) * 0.96; secs.push(ring(Math.sin(t), pts, { s: Math.cos(t) })); }
      const P = [loft(secs, { color: (x, y) => (y > 0.9 ? GOLD : PEARL), type: (x, y) => (y < 0.5 && y > 0.04 ? 3 : 0) }), cap(secs[secs.length - 1], { color: GOLD })];
      P.push(band(pts, 0.0, 0.05, 1.03, ACC, 1.2));
      return mergeF(P);
    };
    A.dome = { hi: make(14, 5), lo: make(6, 2) };
  }
  // 수정 탑 (윤슬): 육각 기둥 + 뾰족한 끝
  {
    const make = (hi) => {
      const pts = squircle(6, 1, 1, 2);
      const P = [loft([ring(0, pts), ring(0.8, pts, { s: 0.8 })], { color: (x, y) => (y < 0.01 ? GOLD : 0xf6dcee), emit: (x, y) => (y > 0.7 ? 0.5 : 0.08), type: 1, smooth: false })];
      P.push(loft([ring(0.8, pts, { s: 0.8 }), ring(1, pts, { s: 0.02 })], { color: 0xffe4f4, emit: 0.9, type: 0, smooth: false }));
      if (hi) P.push(band(pts, 0.79, 0.012, 0.82, 0xff9fd0, 1.8));
      return mergeF(P);
    };
    A.crystal = { hi: make(true), lo: make(false) };
  }
  // 버섯 집 (갓마을)
  {
    const make = (n, hi) => {
      const pts = squircle(n, 1, 1, 2);
      const P = [loft([ring(0, pts, { s: 0.3 }), ring(0.6, pts, { s: 0.22 })], { color: 0xe8dccc, type: 3 })];
      const capR = [[1, 0.6], [0.92, 0.75], [0.62, 0.92], [0.05, 1]];
      P.push(loft(capR.map(([r, y]) => ring(y, pts, { s: r })), { color: (x, y) => (y > 0.95 ? 0xffffff : 0xf0c8e0), emit: (x, y) => (y < 0.62 ? 0.8 : 0), type: 0 }));
      P.push(cap(ring(0.6, pts), { color: 0x7ff3e6, emit: 1.3, down: true }));
      if (hi) P.push(band(pts, 0.4, 0.02, 0.26, ACC, 1.6));
      return mergeF(P);
    };
    A.cap = { hi: make(14, true), lo: make(6, false) };
  }
  // 기둥 집 (물노래): 다리 넷 위의 둥근 집
  {
    const make = (n, hi) => {
      const pts = squircle(n, 1, 1, 2);
      const P = [];
      for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) P.push(solid(new THREE.CylinderGeometry(0.05, 0.06, 0.5, 4, 1, !hi).translate(sx * 0.6, 0.25, sz * 0.6), GOLD));
      P.push(loft([ring(0.48, pts), ring(0.53, pts)], { color: PEARL, type: 0, smooth: false }), cap(ring(0.53, pts), { color: PEARL2 }), cap(ring(0.48, pts), { color: PEARL2, down: true }));
      P.push(loft([ring(0.53, pts, { s: 0.72 }), ring(0.82, pts, { s: 0.74 })], { color: PEARL, type: 3 }));
      P.push(loft([ring(0.82, pts, { s: 0.9 }), ring(1, pts, { s: 0.05 })], { color: (x, y) => (y > 0.97 ? GOLD : 0xd8f0f4), type: 0 }));
      if (hi) P.push(band(pts, 0.5, 0.015, 1.02, ACC, 1.6));
      return mergeF(P);
    };
    A.stilt = { hi: make(12, true), lo: make(6, false) };
  }
  // ══ 구역마다 다른 실루엣 ══════════════════════════
  // 위도 단면을 이어 만든 구 (외벽 무늬가 바르게 감기도록)
  const ball = (cx, cy, cz, r, n, rows, type, ysc = 1, color = PEARL) => {
    const pts = squircle(n, 1, 1, 2), secs = [];
    for (let i = 0; i <= rows; i++) { const t = -Math.PI / 2 + (i / rows) * Math.PI; secs.push(ring(cy + Math.sin(t) * r * ysc, pts, { s: Math.max(0.0001, Math.cos(t) * r), dx: cx, dz: cz })); }
    return loft(secs, { color, type });
  };
  // [에너지] 반응로: 기단 위 세 다리가 받친 빛나는 구와 두 고리
  {
    const make = (n, hi) => {
      const pts = squircle(n, 1, 1, 2);
      const P = [loft([ring(0, pts), ring(0.14, pts, { s: 0.94 })], { color: GOLD, type: 2 }), cap(ring(0.14, pts, { s: 0.94 }), { color: PEARL2 })];
      P.push(ball(0, 0.56, 0, 0.6, n, hi ? 8 : 4, 0, 0.8, (x, y) => (Math.abs(y - 0.56) < 0.035 ? ACC : PEARL)));
      for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU; P.push(solid(new THREE.BoxGeometry(0.08, 0.5, 0.08).rotateZ(0.5).rotateY(-a).translate(Math.cos(a) * 0.62, 0.32, Math.sin(a) * 0.62), STEEL)); }
      if (hi) {
        P.push(solid(new THREE.TorusGeometry(0.82, 0.025, 4, 32).rotateX(Math.PI / 2 + 0.35).translate(0, 0.56, 0), ACC, 2.2));
        P.push(solid(new THREE.TorusGeometry(0.74, 0.02, 4, 32).rotateX(Math.PI / 2 - 0.5).rotateY(1.2).translate(0, 0.56, 0), 0xffc46a, 2.0));
        P.push(solid(new THREE.SphereGeometry(0.6 * 1.003, 16, 1, 0, TAU, Math.PI / 2 - 0.04, 0.08).scale(1, 0.8, 1).translate(0, 0.56, 0), ACC, 2.4));
      }
      P.push(solid(new THREE.ConeGeometry(0.05, 0.16, 5).translate(0, 1.0, 0), PEARL, 0.5));
      return mergeF(P);
    };
    A.reactor = { hi: make(14, true), lo: make(6, false) };
  }
  // [에너지] 전력 기둥: 네 모서리 기둥이 모이는 격자탑, 가운데 빛기둥, 꼭대기 구슬
  {
    const make = (hi) => {
      const P = [];
      const leg = (sx, sz) => { const g = new THREE.CylinderGeometry(0.03, 0.05, 1.0, hi ? 4 : 3, 1, true); const pos = g.attributes.position; for (let i = 0; i < pos.count; i++) { const y = pos.getY(i) + 0.5; pos.setX(i, pos.getX(i) + sx * (1 - y * 0.6)); pos.setZ(i, pos.getZ(i) + sz * (1 - y * 0.6)); pos.setY(i, y * 0.95); } g.computeVertexNormals(); return g; };
      for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) P.push(solid(leg(a * 0.7, b * 0.7), STEEL));
      if (hi) for (let k = 1; k < 8; k++) { const y = k * 0.115, w = 0.7 * (1 - (y / 0.95) * 0.6) * 2; P.push(solid(new THREE.BoxGeometry(w, 0.012, 0.03).translate(0, y, w / 2), STEEL), solid(new THREE.BoxGeometry(w, 0.012, 0.03).translate(0, y, -w / 2), STEEL), solid(new THREE.BoxGeometry(0.03, 0.012, w).translate(w / 2, y, 0), STEEL), solid(new THREE.BoxGeometry(0.03, 0.012, w).translate(-w / 2, y, 0), STEEL)); }
      P.push(solid(new THREE.CylinderGeometry(0.1, 0.16, 0.92, hi ? 8 : 4, 1, !hi).translate(0, 0.46, 0), ACC, 2.0));
      P.push(solid(hi ? new THREE.IcosahedronGeometry(0.16, 1).translate(0, 1.0, 0) : new THREE.OctahedronGeometry(0.18, 0).translate(0, 1.0, 0), 0xbffcff, 2.6));
      if (hi) for (const y of [0.3, 0.6, 0.86]) P.push(solid(new THREE.TorusGeometry(0.22, 0.015, 3, 16).rotateX(Math.PI / 2).translate(0, y, 0), 0xffc46a, 2.0));
      return mergeF(P);
    };
    A.conduit = { hi: make(true), lo: make(false) };
  }
  // [에너지·산업] 냉각탑: 허리가 잘록한 쌍곡면, 위로 빛 아지랑이
  {
    const make = (n, hi) => {
      const pts = squircle(n, 1, 1, 2);
      const prof = [[1, 0], [0.84, 0.3], [0.66, 0.68], [0.68, 0.9], [0.74, 1]];
      const P = [loft((hi ? prof : [prof[0], prof[2], prof[4]]).map(([r, y]) => ring(y, pts, { s: r })), { color: (x, y) => (y > 0.97 ? GOLD : PEARL2), type: 0 })];
      P.push(solid(new THREE.CircleGeometry(0.7, n).rotateX(-Math.PI / 2).translate(0, 0.94, 0), ACC, 1.4));
      if (hi) for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; P.push(solid(new THREE.BoxGeometry(0.02, 0.6, 0.02).translate(Math.cos(a) * 0.86, 0.2, Math.sin(a) * 0.86).rotateY(0), PEARL)); }
      return mergeF(P);
    };
    A.cooler = { hi: make(16, true), lo: make(6, false) };
  }
  // [연구] 관측동: 상자 기단 위 열리는 틈이 있는 돔
  {
    const make = (n, hi) => {
      const box = squircle(hi ? 12 : 4, 1, 0.85, 8);
      const P = [loft([ring(0, box), ring(0.45, box)], { color: (x, y) => (y < 0.01 ? GOLD : PEARL), type: 1, smooth: false }), cap(ring(0.45, box), { color: PEARL2 })];
      const pts = squircle(n, 1, 1, 2), secs = [];
      const rows = hi ? 5 : 2;
      for (let i = 0; i <= rows; i++) { const t = (i / rows) * (Math.PI / 2) * 0.98; secs.push(ring(0.45 + Math.sin(t) * 0.5, pts, { s: Math.cos(t) * 0.7 })); }
      P.push(loft(secs, { color: PEARL, type: 0 }));
      if (hi) {
        P.push(solid(new THREE.TorusGeometry(0.7, 0.012, 3, 24, Math.PI).rotateY(Math.PI / 2).scale(1, 0.71, 1).translate(0, 0.45, 0), ACC, 2.2));
        P.push(band(pts, 0.45, 0.02, 0.72, ACC, 1.6));
        P.push(solid(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 4).translate(0.8, 0.6, 0.5), STEEL), solid(new THREE.OctahedronGeometry(0.03, 0).translate(0.8, 0.76, 0.5), 0xff6a5a, 3));
      }
      return mergeF(P);
    };
    A.observatory = { hi: make(16, true), lo: make(6, false) };
  }
  // [연구] 안테나탑: 가는 몸통, 원반 테라스, 하늘을 향한 접시 셋, 긴 바늘
  {
    const make = (n, hi) => {
      const pts = squircle(n, 0.45, 0.45, 4);
      const P = [loft([ring(0, pts), ring(0.7, pts, { s: 0.85 })], { color: (x, y) => (y < 0.01 ? GOLD : PEARL), type: 1 })];
      const disc = squircle(n, 1, 1, 2);
      P.push(loft([ring(0.7, disc, { s: 0.95 }), ring(0.73, disc, { s: 0.95 })], { color: PEARL2, type: 0, smooth: false }), cap(ring(0.73, disc, { s: 0.95 }), { color: PEARL2 }), cap(ring(0.7, disc, { s: 0.95 }), { color: PEARL2, down: true }));
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * TAU + 0.4;
        P.push(solid(new THREE.ConeGeometry(0.28, 0.1, hi ? 14 : 6, 1, true).rotateX(Math.PI).rotateZ(0.6).rotateY(-a).translate(Math.cos(a) * 0.55, 0.84, Math.sin(a) * 0.55), PEARL));
        if (hi) P.push(solid(new THREE.OctahedronGeometry(0.03, 0).translate(Math.cos(a) * 0.6, 0.9, Math.sin(a) * 0.6), ACC, 3));
      }
      P.push(solid(new THREE.CylinderGeometry(0.012, 0.03, 0.3, 4).translate(0, 0.88, 0), STEEL), solid(new THREE.OctahedronGeometry(0.025, 0).translate(0, 1.04, 0), 0xff6a5a, 3));
      if (hi) P.push(band(disc, 0.715, 0.008, 0.96, ACC, 1.8));
      return mergeF(P);
    };
    A.antenna = { hi: make(14, true), lo: make(4, false) };
  }
  // [연구] 꼬투리 연구동: 둥근 몸통에 매달린 캡슐 실험실들
  {
    const make = (n, hi) => {
      const pts = squircle(n, 0.4, 0.4, 2);
      const P = [loft([ring(0, pts), ring(0.92, pts, { s: 0.9 })], { color: (x, y) => (y < 0.01 ? GOLD : PEARL), type: 1 })];
      P.push(loft([ring(0.92, pts, { s: 0.9 }), ring(1, pts, { s: 0.05 })], { color: PEARL2, type: 0 }));
      const pods = hi ? 7 : 3;
      for (let i = 0; i < pods; i++) {
        const a = i * 2.4, y = 0.22 + (i / pods) * 0.62;
        const g = (hi ? new THREE.CapsuleGeometry(0.13, 0.32, 3, 8) : new THREE.OctahedronGeometry(0.2, 0).scale(1.5, 0.65, 0.65).rotateZ(Math.PI / 2)).rotateZ(Math.PI / 2).translate(0.52, 0, 0).rotateY(-a).translate(0, y, 0);
        P.push(solid(g, (x, yy) => (Math.abs(yy - y) < 0.02 ? ACC : PEARL), (x, yy) => (Math.abs(yy - y) < 0.02 ? 1.8 : 0)));
      }
      return mergeF(P);
    };
    A.podlab = { hi: make(14, true), lo: make(6, false) };
  }
  // [교통] 격납고: 길쭉한 둥근 지붕 홀, 큰 문틀이 빛난다
  {
    const make = (n, hi) => {
      const vault = new THREE.CylinderGeometry(1, 1, 2, n, 1, true, 0, Math.PI).rotateZ(Math.PI / 2);
      const P = [solid(vault, PEARL)];
      const end = (x) => solid(new THREE.CircleGeometry(1, n, 0, Math.PI).rotateY(Math.PI / 2).translate(x, 0, 0), PEARL2);
      P.push(end(-1));
      P.push(solid(new THREE.TorusGeometry(0.98, 0.025, 3, n, Math.PI).rotateY(Math.PI / 2).translate(1.0, 0, 0), ACC, 2.2));
      P.push(solid(new THREE.CircleGeometry(0.9, n, 0, Math.PI).rotateY(Math.PI / 2).translate(0.99, 0, 0), 0x2a3448, 0.3));
      if (hi) for (const x of [-0.6, -0.2, 0.2, 0.6]) P.push(solid(new THREE.CylinderGeometry(1.02, 1.02, 0.03, n, 1, true, 0, Math.PI).rotateZ(Math.PI / 2).translate(x, 0, 0), ACC, 1.4));
      return mergeF(P);
    };
    A.hangar = { hi: make(14, true), lo: make(5, false) };
  }
  // [교통] 착륙대 탑: 기둥에 층층이 달린 원반 착륙대
  {
    const make = (n, hi) => {
      const pts = squircle(n, 0.26, 0.26, 2);
      const P = [loft([ring(0, pts), ring(1, pts, { s: 0.8 })], { color: PEARL, type: 1 })];
      const disc = squircle(n, 1, 1, 2);
      for (const [y, r] of [[0.42, 1], [0.7, 0.82], [0.96, 0.66]]) {
        P.push(loft([ring(y - 0.015, disc, { s: r }), ring(y, disc, { s: r })], { color: PEARL2, type: 0, smooth: false }), cap(ring(y, disc, { s: r }), { color: 0x8e8a9c }), cap(ring(y - 0.015, disc, { s: r * 0.6 }), { color: PEARL2, down: true }));
        if (hi) P.push(solid(new THREE.TorusGeometry(r * 0.7, 0.01, 3, 24).rotateX(Math.PI / 2).translate(0, y + 0.003, 0), 0xffd27a, 2.0), band(disc, y - 0.012, 0.01, r * 1.014, ACC, 1.6));
      }
      return mergeF(P);
    };
    A.padtower = { hi: make(16, true), lo: make(6, false) };
  }
  // [주거] 발코니 탑: 층마다 튀어나온 정원 발코니가 둘린 둥근 탑
  {
    const make = (n, hi) => {
      const pts = squircle(n, 0.78, 0.78, 2);
      const P = [loft([ring(0, pts), ring(0.94, pts, { s: 0.92 })], { color: (x, y) => (y < 0.01 ? GOLD : PEARL), type: 1 })];
      P.push(loft([ring(0.94, pts, { s: 0.92 }), ring(1, pts, { s: 0.3 })], { color: PEARL2, type: 0 }));
      const nb = hi ? 9 : 3;
      for (let i = 1; i <= nb; i++) {
        const y = (i / (nb + 1)) * 0.92;
        P.push(band(pts, y, 0.012, 1.18 - y * 0.12, i % 2 ? GARDEN : PEARL2, i % 2 ? 0.15 : 0));
        if (hi && i % 2 === 0) P.push(band(pts, y + 0.012, 0.004, 1.17 - y * 0.12, ACC, 1.6));
      }
      return mergeF(P);
    };
    A.balcony = { hi: make(14, true), lo: make(6, false) };
  }
  // [주거] 거품 집: 크고 작은 구가 엉겨 붙은 유기적 주거
  {
    const B = [[0, 0.3, 0, 0.55], [0.42, 0.42, 0.22, 0.38], [-0.38, 0.5, -0.18, 0.4], [0.05, 0.75, -0.08, 0.32], [0.1, 0.94, 0.06, 0.16]];
    const make = (n, rows, hi) => {
      const P = [];
      for (const [x, y, z, r] of hi ? B : [B[0], B[2], B[3]]) P.push(ball(x, y, z, r, n, rows, 3, 0.85));
      if (hi) P.push(solid(new THREE.TorusGeometry(0.56, 0.015, 3, 24).rotateX(Math.PI / 2).translate(0, 0.3, 0), ACC, 1.6));
      return mergeF(P);
    };
    A.bubbles = { hi: make(12, 6, true), lo: make(5, 3, false) };
  }
  // [생체 산업] 제조동: 톱니 지붕의 긴 공장 + 빛나는 굴뚝 둘 + 옆의 관
  {
    const make = (n, hi) => {
      const box = squircle(hi ? 12 : 4, 1, 0.62, 10);
      const P = [loft([ring(0, box), ring(0.5, box)], { color: (x, y) => (y < 0.01 ? GOLD : PEARL), type: 2, smooth: false }), cap(ring(0.5, box), { color: 0x9c98ac })];
      for (let i = 0; i < 3; i++) {
        const x = -0.6 + i * 0.6;
        const g = new THREE.CylinderGeometry(0.26, 0.26, 1.15, 3, 1).rotateX(Math.PI / 2).rotateZ(Math.PI / 6).translate(x, 0.5, 0);
        P.push(solid(g, (xx, y) => (y > 0.62 ? 0xbfe8f0 : PEARL2), (xx, y) => (y > 0.62 ? 0.6 : 0)));
      }
      for (const x of [0.75, 0.55]) {
        P.push(solid(new THREE.CylinderGeometry(0.07, 0.1, 0.62, hi ? 8 : 4, 1, !hi).translate(x, 0.81, -0.35), PEARL2));
        P.push(solid(new THREE.CylinderGeometry(0.075, 0.075, 0.04, hi ? 8 : 4, 1, !hi).translate(x, 1.12, -0.35), 0xffc46a, 2.6));
      }
      if (hi) P.push(solid(new THREE.CylinderGeometry(0.06, 0.06, 2.1, 8).rotateZ(Math.PI / 2).translate(0, 0.3, 0.66), ACC, 1.2));
      return mergeF(P);
    };
    A.fabricator = { hi: make(12, true), lo: make(4, false) };
  }
  // [생체 산업] 저장 탱크: 둥근 지붕의 탱크 셋을 관이 잇는다
  {
    const make = (n, hi) => {
      const pts = squircle(n, 0.4, 0.4, 2);
      const P = [];
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * TAU + 0.5, x = Math.cos(a) * 0.52, z = Math.sin(a) * 0.52, h = 0.75 + (i % 2) * 0.12;
        P.push(loft([ring(0, pts, { dx: x, dz: z }), ring(h, pts, { dx: x, dz: z })], { color: (xx, y) => (Math.abs(y - h * 0.6) < 0.025 ? ACC : PEARL), emit: (xx, y) => (Math.abs(y - h * 0.6) < 0.025 ? 1.6 : 0), type: 0 }));
        P.push(ball(x, h, z, 0.4, n, hi ? 3 : 2, 0, 0.5));
      }
      if (hi) P.push(solid(new THREE.TorusGeometry(0.52, 0.04, 4, 20).rotateX(Math.PI / 2).translate(0, 0.4, 0), STEEL));
      return mergeF(P);
    };
    A.tanks = { hi: make(12, true), lo: make(5, false) };
  }

  // 공중다리: 탑과 탑을 잇는 유리 통로 (x 축이 길이 방향, -1..1). 옆벽은 유리, 바닥 아래 빛줄
  {
    const make = (hi) => {
      const box = squircle(4, Math.SQRT2, Math.SQRT2, 2, 0);
      const P = [loft([ring(0, box), ring(1, box)], { color: PEARL, type: (x, y, z) => (Math.abs(z) > 0.9 ? 1 : 0), smooth: false })];
      P.push(cap(ring(1, box), { color: PEARL2 }), cap(ring(0, box), { color: PEARL2, down: true }));
      if (hi) P.push(solid(new THREE.BoxGeometry(2.0, 0.08, 0.12).translate(0, 0.02, 0), ACC, 2.0));
      return mergeF(P);
    };
    A.bridge = { hi: make(true), lo: make(false) };
  }

  // ══ 토지 이용 템플릿이 쓰는 건물 ══════════════════
  const rectPts = (nx, nz, a = 1, b = 1) => {
    // 네모 둘레를 고르게 나눈 점 (시계 반대 방향) — 차양 기둥·난간이 고르게 선다
    const out = [];
    for (let i = 0; i < nx; i++) out.push([-a + (2 * a * i) / nx, -b]);
    for (let i = 0; i < nz; i++) out.push([a, -b + (2 * b * i) / nz]);
    for (let i = 0; i < nx; i++) out.push([a - (2 * a * i) / nx, b]);
    for (let i = 0; i < nz; i++) out.push([-a, b - (2 * b * i) / nz]);
    return out;
  };
  const solidT = (geo, color, emit, type) => { const g = geo.index ? geo.toNonIndexed() : geo; if (!g.attributes.normal) g.computeVertexNormals(); return paint(g, color, emit, type); };
  // [주거] 판상 아파트: 층마다 발코니(외벽 5), 옥상 정원·유리 난간·계단실·정자, 1층 차양과 기둥
  {
    const make = (hi) => {
      const pts = hi ? rectPts(8, 3) : squircle(4, 1, 1, 30);
      const P = [loft([ring(0, pts), ring(1, pts)], { color: (x, y) => (y < 0.01 ? GOLD : PEARL), type: 5, smooth: false })];
      P.push(cap(ring(1, pts), { color: (x, y, z) => (Math.abs(x) < 0.8 && Math.abs(z) < 0.55 ? GARDEN : 0xb8b2c4) }));
      if (hi) {
        P.push(...parapet(pts, 1, { glass: true }));
        P.push(...baseKit(pts, { h: 4.6, d: 2.2, cols: 11 }));
        P.push(aBox(0.62, 0, 0.1, 0.32, 1, 0, 3.2, PEARL2), aBox(0.62, 0, 0.105, 0.325, 1, 3.2, 3.38, ACC, 1.2));
        P.push(aBox(-0.35, 0, 0.16, 0.26, 1, 0, 2.7, 0xcfeef2, 0.18), aBox(-0.35, 0, 0.2, 0.32, 1, 2.7, 2.9, PEARL));
        for (let i = 0; i < 7; i++) P.push(aBox(-0.86 + i * 0.1, 0.66, 0.03, 0.04, 1, 0, 1.0, GARDEN, 0.08));
      }
      return mergeF(P);
    };
    A.midrise = { hi: make(true), lo: make(false) };
  }
  // [공공] 회관: 유리 홀 위로 크게 휜 지붕이 떠 있고, 앞에 열주와 넓은 계단
  {
    const make = (hi) => {
      const box = hi ? rectPts(10, 6, 0.92, 0.92) : squircle(4, 0.92, 0.92, 30);
      const roofP = hi ? rectPts(12, 8, 1.08, 1.12) : squircle(4, 1.08, 1.12, 30);
      const ys = (x) => 0.74 + 0.22 * (1 - Math.min(1, x * x));
      const P = [loft([ring(0, box), ring(0, box, { ys: (x) => ys(x) - 0.035 })], { color: (x, y) => (y < 0.01 ? GOLD : PEARL), type: 1, smooth: false })];
      P.push(loft([ring(0, roofP, { ys: (x) => ys(x) - 0.035 }), ring(0, roofP, { ys })], { color: PEARL2, type: 0, smooth: false }));
      P.push(cap(ring(0, roofP, { ys }), { color: 0xe8e2ee }), cap(ring(0, roofP, { ys: (x) => ys(x) - 0.035 }), { color: PEARL, down: true }));
      if (hi) {
        for (let i = 0; i < 9; i++) { const x = -0.92 + i * 0.23; P.push(solid(new THREE.CylinderGeometry(0.014, 0.018, ys(x) - 0.035, 8).translate(x, (ys(x) - 0.035) / 2, 1.04), GOLD)); }
        P.push(loft([ring(0, roofP, { ys: (x) => ys(x) - 0.037 }), ring(0, roofP, { ys: (x) => ys(x) - 0.03, s: 1.002 })], { color: ACC, emit: 1.4, type: 0, smooth: false }));
        for (let k = 0; k < 4; k++) P.push(aBox(0, 0.97 + k * 0.035, 0.62 - k * 0.02, 0.018, 0, 0, 0.2 + (3 - k) * 0.2, 0xd8d2e0));
        P.push(...roofGear(0.96, 0.5, null, { pv: true }));
      }
      return mergeF(P);
    };
    A.hall = { hi: make(true), lo: make(false) };
  }
  // [공공] 학교: 낮은 두 동이 둥근 가운데 홀로 이어지고, 알록달록한 차양과 옥상 정원
  {
    const make = (hi) => {
      const P = [];
      const wing = hi ? rectPts(3, 6, 0.42, 0.9) : squircle(4, 0.42, 0.9, 30);
      for (const x of [-0.58, 0.58]) {
        P.push(loft([ring(0, wing, { dx: x }), ring(0.62, wing, { dx: x })], { color: (xx, y) => (y < 0.01 ? GOLD : PEARL), type: 2, smooth: false }), cap(ring(0.62, wing, { dx: x }), { color: 0x7cc0a4 }));
        if (hi) {
          P.push(...parapet(wing, 0.62, { base: { dx: x }, glass: true }));
          for (let i = 0; i < 4; i++) P.push(aBox(x + (x < 0 ? 0.43 : -0.43), -0.6 + i * 0.4, 0.012, 0.15, 0, 3.4, 3.65, [0xffc46a, 0xff9fd0, 0x7ff3e6, 0xb9a6ff][i], 0.5, 1.2));
        }
      }
      const mid = squircle(hi ? 16 : 6, 0.38, 0.38, 2);
      P.push(loft([ring(0, mid), ring(0.9, mid, { s: 0.9 })], { color: PEARL, type: 1 }), cap(ring(0.9, mid, { s: 0.9 }), { color: GOLD }));
      if (hi) { P.push(...baseKit(mid, { h: 4.2, d: 2.6, cols: 8 })); P.push(band(mid, 0.88, 0.02, 0.92, ACC, 1.6)); }
      return mergeF(P);
    };
    A.school = { hi: make(true), lo: make(false) };
  }
  // [물류] 창고: 긴 상자 + 둥근 지붕, 하역문 줄과 하역대(미터 크기)
  {
    const make = (hi) => {
      const box = hi ? rectPts(10, 2) : squircle(4, 1, 1, 30);
      const P = [loft([ring(0, box), ring(0.7, box)], { color: (x, y) => (y < 0.01 ? GOLD : y > 0.62 ? STEEL : PEARL2), type: 2, smooth: false })];
      const vault = new THREE.CylinderGeometry(1, 1, 2, hi ? 14 : 5, 1, true, 0, Math.PI).rotateZ(Math.PI / 2).scale(1, 0.3, 1).translate(0, 0.7, 0);
      P.push(solidT(vault, 0xd8d4de, 0, 0));
      for (const x of [-1, 1]) P.push(solid(new THREE.CircleGeometry(1, hi ? 14 : 5, 0, Math.PI).rotateY(x > 0 ? Math.PI / 2 : -Math.PI / 2).scale(1, 0.3, 1).translate(x, 0.7, 0), PEARL2));
      if (hi) {
        for (let i = 0; i < 8; i++) {
          const x = -0.84 + i * 0.24;
          P.push(aBox(x, 1, 0.07, 0.006, 0, 0.6, 5.2, 0x3a4458, 0.05, 0.02), aBox(x, 1, 0.075, 0.006, 0, 5.25, 5.4, 0xffc46a, 1.6, 0.04));
          P.push(solidT(new THREE.TorusGeometry(1, 0.012, 3, 14, Math.PI).scale(1, 0.3, 1).rotateY(Math.PI / 2).translate(x, 0.7, 0), STEEL, 0, 0));
        }
        P.push(aBox(0, 1, 0.98, 0.001, 0, 0, 1.2, PEARL2, 0, 1.4)); // 하역대
        P.push(aBox(0, 1, 0.98, 0.001, 0, 1.2, 1.28, ACC, 1.2, 1.4));
      }
      return mergeF(P);
    };
    A.warehouse = { hi: make(true), lo: make(false) };
  }
  // [인공 환경] 생태 돔: 기단 위 유리 격자 반구 (외벽 6: 유리 너머 숲)
  {
    const make = (hi) => {
      const pts = squircle(hi ? 24 : 8, 1, 1, 2);
      const P = [loft([ring(0, pts), ring(0.06, pts)], { color: GOLD, type: 0, smooth: false })];
      const secs = [], rows = hi ? 9 : 3;
      for (let i = 0; i <= rows; i++) { const t = (i / rows) * (Math.PI / 2) * 0.99; secs.push(ring(0.06 + Math.sin(t) * 0.94, pts, { s: Math.max(0.015, Math.cos(t)) })); }
      P.push(loft(secs, { color: 0xd8f4ec, type: 6 }));
      if (hi) { P.push(solid(new THREE.OctahedronGeometry(0.035, 0).translate(0, 1.02, 0), ACC, 2.5)); P.push(...baseKit(pts, { h: 3.6, d: 2.2 })); }
      return mergeF(P);
    };
    A.biodome = { hi: make(true), lo: make(false) };
  }
  // [인공 환경] 수직 농장: 층마다 초록 재배 띠와 보랏빛 생장등 (외벽 7), 옥상 물탱크
  {
    const make = (hi) => {
      const pts = squircle(hi ? 16 : 4, 1, 1, 6);
      const P = [loft([ring(0, pts), ring(0.94, pts, { s: 0.95 })], { color: (x, y) => (y < 0.01 ? GOLD : PEARL), type: 7 })];
      P.push(cap(ring(0.94, pts, { s: 0.95 }), { color: GARDEN }));
      if (hi) {
        P.push(...parapet(pts, 0.94, { base: { s: 0.95 }, glass: true }));
        P.push(solid(pin(new THREE.CylinderGeometry(0.2, 0.2, 4.5, 12).translate(0.35, 2.25, 0.3).toNonIndexed(), 0.94), PEARL2));
        P.push(...baseKit(pts, { h: 5, d: 2.4, cols: 8 }));
      }
      return mergeF(P);
    };
    A.vfarm = { hi: make(true), lo: make(false) };
  }
  // [인공 환경·농지] 온실: 긴 유리 둥근 지붕 (외벽 6) + 낮은 기단 + 골조
  {
    const make = (hi) => {
      const n = hi ? 12 : 5;
      const P = [];
      const vault = new THREE.CylinderGeometry(1, 1, 2, n, 1, true, 0, Math.PI).rotateZ(Math.PI / 2).scale(1, 0.86, 1).translate(0, 0.14, 0);
      P.push(solidT(vault, 0xd8f4ec, 0, 6));
      for (const x of [-1, 1]) P.push(solidT(new THREE.CircleGeometry(1, n, 0, Math.PI).rotateY(x > 0 ? Math.PI / 2 : -Math.PI / 2).scale(1, 0.86, 1).translate(x, 0.14, 0), 0xd8f4ec, 0, 6));
      const base = squircle(4, 1, 1, 30);
      P.push(loft([ring(0, base), ring(0.14, base)], { color: PEARL2, type: 0, smooth: false }));
      if (hi) for (let i = 0; i <= 8; i++) P.push(solidT(new THREE.TorusGeometry(1, 0.01, 3, 12, Math.PI).scale(1, 0.86, 1).rotateY(Math.PI / 2).translate(-1 + i * 0.25, 0.14, 0), STEEL, 0, 0));
      return mergeF(P);
    };
    A.greenhouse = { hi: make(true), lo: make(false) };
  }

  // ══ v0.6 실루엣 ══════════════════════════════════════════
  // 주거·상업은 익숙한 고층 문법(후퇴·왕관·테라스·돌출·하늘정원·세 쌍둥이)을 유지하되 머리·옆선·연결이 저마다 다르고,
  // 연구·에너지·교통·생체 산업·공공은 쓰임에서 나온 외계의 형태(관측 고리·코일 고리·가지 친 부두·나무 반응로·울림 문)를 쓴다.
  /** 미터 두께의 수평 고리(상자 단면): 단위 반지름 base.s, 높이 h m, 두께 t m (안쪽으로) */
  const aRing = (pts, base, anchorY, h, t, color, emit = 0, glow = ACC) => [
    aStrip(pts, base, anchorY, 0, h, 0, 0, color, emit),
    aStrip(pts, base, anchorY, 0, h, -t, -t, color, emit),
    aStrip(pts, base, anchorY, h, h, -t, 0, color),
    aStrip(pts, base, anchorY, 0, 0, -t, 0, color, 0, true),
    aStrip(pts, base, anchorY, h * 0.42, h * 0.58, 0.05, 0.05, glow, 1.6),
  ];
  /** 미터 굵기의 들보: 단위 (x0,z0)→(x1,z1), 폭 w(단위), 높이 y0m~y1m (anchorY 기준) */
  const aBeam = (x0, z0, x1, z1, w, anchorY, y0m, y1m, color, emit = 0) => {
    const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(z1 - z0, x1 - x0);
    const g = new THREE.BoxGeometry(len, y1m - y0m, w).translate(0, (y0m + y1m) / 2, 0).rotateY(-ang).translate((x0 + x1) / 2, 0, (z0 + z1) / 2).toNonIndexed();
    pin(g, anchorY);
    return solid(g, color, emit);
  };
  /** 단(段) 하나: 둥근 네모 벽 + 지붕 + 처마 띠 */
  const tier = (P, n, w, d, y0, y1, type, o = {}, roof = PEARL2) => {
    const pts = squircle(n, w, d, o.k || 10);
    const b = { rot: o.rot || 0, dx: o.dx || 0, dz: o.dz || 0 };
    P.push(loft([ring(y0, pts, b), ring(y1, pts, b)], { color: PEARL, type, smooth: n > 8 && (o.k || 10) < 8 }));
    P.push(cap(ring(y1, pts, b), { color: roof }));
    if (y0 > 0) P.push(cap(ring(y0, pts, b), { color: PEARL2, down: true }));
    return pts;
  };

  // [상업·사무] 후퇴 탑: 네 단으로 물러나는 고전적 마천루 + 모서리 기둥 + 첨침
  {
    const T4 = [[0, 0.42, 1, 0.8, 1], [0.42, 0.68, 0.82, 0.66, 2], [0.68, 0.86, 0.62, 0.5, 1], [0.86, 0.95, 0.4, 0.34, 3]];
    const make = (hi) => {
      const P = [];
      for (const [y0, y1, w, d, t] of hi ? T4 : [T4[0], [0.42, 0.86, 0.72, 0.58, 2], T4[3]]) {
        tier(P, hi ? 16 : 4, w, d, y0, y1, t, {}, hi && y1 < 0.9 ? GARDEN : PEARL2);
        if (hi) {
          P.push(band(squircle(16, w, d, 10), y1 - 0.006, 0.008, 1.02, y1 > 0.9 ? ACC : GOLD, y1 > 0.9 ? 1.6 : 0.2));
          for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) P.push(solid(new THREE.BoxGeometry(0.05, y1 - y0, 0.05).translate(sx * w * 0.93, (y0 + y1) / 2, sz * d * 0.93), PEARL2));
        }
      }
      P.push(solid(new THREE.CylinderGeometry(0.004, 0.03, 0.06, 4).translate(0, 0.98, 0), STEEL, 0));
      if (hi) P.push(solid(new THREE.OctahedronGeometry(0.012, 0).translate(0, 1.01, 0), 0xff6a5a, 3));
      return mergeF(P);
    };
    A.setback = { hi: make(true), lo: make(false) };
  }

  // [상업·사무] 왕관 탑: 곧은 몸통 + 하늘 로비 띠 + 위가 열린 지느러미 왕관과 빛 고리
  {
    const make = (hi) => {
      const n = hi ? 16 : 4, pts = squircle(n, 1, 0.85, 6);
      const P = [loft([ring(0, pts), ring(0.48, pts)], { color: PEARL, type: 1, smooth: hi })];
      P.push(loft([ring(0.48, pts, { s: 0.9 }), ring(0.52, pts, { s: 0.9 })], { color: PEARL2, type: 2, smooth: hi }));
      P.push(loft([ring(0.52, pts), ring(0.86, pts)], { color: PEARL, type: 1, smooth: hi }));
      P.push(cap(ring(0.48, pts), { color: GARDEN }), cap(ring(0.86, pts), { color: PEARL2 }));
      const core = squircle(hi ? 12 : 4, 0.5, 0.42, 6);
      P.push(loft([ring(0.86, core), ring(0.93, core)], { color: STEEL, type: 0, smooth: false }), cap(ring(0.93, core)));
      if (hi) {
        const nf = 14;
        for (let i = 0; i < nf; i++) {
          const [x, z] = squircle(nf, 0.98, 0.83, 6)[i];
          P.push(solid(new THREE.BoxGeometry(0.035, 0.14, 0.035).translate(x, 0.93, z), i % 2 ? PEARL : GOLD, 0));
        }
      }
      return mergeF(P);
    };
    A.crown = { hi: make(true), lo: make(false) };
  }

  // [주거] 테라스 탑: 한쪽(+z)이 층층이 물러나며 단마다 정원이 놓인다
  {
    const make = (hi) => {
      const P = [], N = hi ? 6 : 3;
      for (let i = 0; i < N; i++) {
        const y0 = i / N, y1 = (i + 1) / N, d = 1 - (i / N) * 0.62;
        tier(P, hi ? 14 : 4, 1, d, y0, y1, 5, { dz: -(1 - d), k: 8 }, GARDEN);
      }
      return mergeF(P);
    };
    A.terrace = { hi: make(true), lo: make(false) };
  }

  // [사무] 돌출 탑: 곧은 몸통 허리에서 한쪽으로 튀어나온 하늘 로비 덩어리, 비껴 돌린 머리
  {
    const make = (hi) => {
      const P = [], n = hi ? 14 : 4;
      tier(P, n, 0.72, 0.72, 0, 0.92, 1, { k: 8 });
      tier(P, n, 0.6, 0.66, 0.52, 0.68, 2, { k: 8, dx: 0.4 }, GARDEN);
      tier(P, n, 0.5, 0.46, 0.92, 1.0, 3, { k: 8, rot: 0.35, dx: -0.1 });
      if (hi) P.push(band(squircle(16, 0.6, 0.66, 8), 0.515, 0.006, 1.02, ACC, 1.6, { dx: 0.4 }));
      return mergeF(P);
    };
    A.cantilever = { hi: make(true), lo: make(false) };
  }

  // [주거·사무] 하늘정원 탑: 몸통을 두 번 끊어 기둥만 남긴 정원 층 (속이 트인 층)
  {
    const SEG = [[0, 0.36, 5], [0.41, 0.7, 1], [0.75, 0.96, 5]];
    const make = (hi) => {
      const P = [], n = hi ? 14 : 4;
      for (const [y0, y1, t] of SEG) tier(P, n, 0.9, 0.9, y0, y1, t, { k: 6 }, y1 < 0.9 ? GARDEN : PEARL2);
      for (const [g0, g1] of [[0.36, 0.41], [0.7, 0.75]]) {
        P.push(solid(new THREE.CylinderGeometry(0.3, 0.3, g1 - g0, hi ? 12 : 5).translate(0, (g0 + g1) / 2, 0), 0x9fd8e8, 0.15));
        if (hi) for (const [x, z] of squircle(8, 0.8, 0.8, 6)) P.push(solid(new THREE.CylinderGeometry(0.025, 0.025, g1 - g0, 5).translate(x, (g0 + g1) / 2, z), PEARL2));
        if (hi) for (const [x, z] of squircle(6, 0.6, 0.6, 2)) P.push(solid(new THREE.IcosahedronGeometry(0.09, 0).scale(1, 0.25, 1).translate(x, g0 + 0.015, z), 0x3f8f5a, 0.15));
      }
      return mergeF(P);
    };
    A.skygarden = { hi: make(true), lo: make(false) };
  }

  // [주거] 세 쌍둥이: 높이가 다른 가는 탑 셋이 두 층의 고리 다리로 이어진다
  {
    const TW = [[0, 1.0], [2.094, 0.84], [4.189, 0.7]];
    const make = (hi) => {
      const P = [], n = hi ? 12 : 4;
      const pos = TW.map(([a, h]) => [Math.cos(a) * 0.56, Math.sin(a) * 0.56, h]);
      for (const [x, z, h] of pos) {
        const pts = squircle(n, 0.38, 0.38, 2.6);
        P.push(loft([ring(0, pts, { dx: x, dz: z }), ring(h * 0.96, pts, { dx: x, dz: z, s: 0.9 })], { color: PEARL, type: 2, smooth: hi }));
        P.push(loft([ring(h * 0.96, pts, { dx: x, dz: z, s: 0.9 }), ring(h, pts, { dx: x, dz: z, s: 0.5 })], { color: PEARL2, type: 0 }), cap(ring(h, pts, { dx: x, dz: z, s: 0.5 })));
      }
      if (hi) for (const y of [0.34, 0.62]) for (let i = 0; i < 3; i++) {
        const [x0, z0] = pos[i], [x1, z1] = pos[(i + 1) % 3];
        P.push(aBeam(x0 * 0.8, z0 * 0.8, x1 * 0.8, z1 * 0.8, 0.12, y, 0, 4.2, 0x9fd8e8, 0.2));
        P.push(aBeam(x0 * 0.8, z0 * 0.8, x1 * 0.8, z1 * 0.8, 0.13, y, -0.5, 0, PEARL2));
        P.push(aBeam(x0 * 0.8, z0 * 0.8, x1 * 0.8, z1 * 0.8, 0.135, y, 4.2, 4.6, ACC, 1.4));
      }
      return mergeF(P);
    };
    A.triad = { hi: make(true), lo: make(false) };
  }

  // [연구] 관측 고리 탑: 가는 몸통을 높이마다 어긋난 관측 고리가 감싸고, 꼭대기에 유리 관측실
  {
    const RINGS = [[0.34, 1.0, 0.08], [0.55, 0.82, -0.1], [0.74, 1.08, 0.05]];
    const make = (hi) => {
      const P = [], n = hi ? 16 : 5;
      const sh = squircle(n, 1, 1, 2);
      P.push(loft([ring(0, sh, { s: 0.5 }), ring(0.2, sh, { s: 0.42 }), ring(0.86, sh, { s: 0.36 })], { color: PEARL, type: 2, smooth: true }));
      P.push(loft([ring(0.86, sh, { s: 0.36 }), ring(0.9, sh, { s: 0.6 }), ring(0.96, sh, { s: 0.55 }), ring(0.99, sh, { s: 0.2 })], { color: 0xcfeef4, type: 6, smooth: true }));
      for (const [y, s, dx] of RINGS) {
        if (hi) {
          P.push(...aRing(squircle(32, 1, 1, 2), { s, dx }, y, 2.6, 2.2, PEARL2, 0));
          for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU + y * 5; P.push(aBeam(Math.cos(a) * 0.3, Math.sin(a) * 0.3, Math.cos(a) * s + dx, Math.sin(a) * s, 0.04, y, 0.8, 1.8, STEEL)); }
        } else P.push(band(squircle(8, 1, 1, 2), y, 0.01, 1, PEARL2, 0.3, { s, dx }));
      }
      return mergeF(P);
    };
    A.halolab = { hi: make(true), lo: make(false) };
  }

  // [에너지] 코일 탑: 빛나는 심(心) 기둥을 층층의 공명 코일 고리가 감싼다 (고리 = 에너지를 모으는 구조)
  {
    const make = (hi) => {
      const P = [], n = hi ? 16 : 6;
      const c = squircle(n, 1, 1, 2);
      P.push(loft([ring(0, c), ring(0.08, c), ring(0.1, c, { s: 0.7 })], { color: PEARL2, type: 0, smooth: true }));
      P.push(loft([ring(0.1, c, { s: 0.2 }), ring(0.94, c, { s: 0.16 })], { color: 0x9fefff, emit: 0.95, type: 0, smooth: true }));
      P.push(loft([ring(0.94, c, { s: 0.16 }), ring(1.0, c, { s: 0.02 })], { color: GOLD, type: 0 }));
      const NC = hi ? 6 : 3;
      for (let i = 0; i < NC; i++) {
        const y = 0.16 + (i / (NC - 1)) * 0.7, s = 0.82 - i * (0.3 / (NC - 1));
        if (hi) P.push(...aRing(squircle(28, 1, 1, 2), { s }, y, 5, 3.4, i % 2 ? PEARL : STEEL, 0, i % 2 ? ACC : 0xffc46a));
        else P.push(band(squircle(8, 1, 1, 2), y, 0.02, 1, PEARL, 0.4, { s }));
        if (hi) for (let k = 0; k < 4; k++) { const a = (k / 4) * TAU + i; P.push(aBeam(Math.cos(a) * 0.16, Math.sin(a) * 0.16, Math.cos(a) * (s - 0.03), Math.sin(a) * (s - 0.03), 0.03, y, 2, 3, STEEL)); }
      }
      return mergeF(P);
    };
    A.coiltower = { hi: make(true), lo: make(false) };
  }

  // [교통] 가지 부두: 가운데 돛대에서 가지가 뻗어 높이가 다른 착륙판을 받친다 (하늘배가 내려앉는 공중 연결망)
  {
    const PADS = [[0.4, 0.0, 0.85], [0.58, 2.1, 0.8], [0.76, 4.2, 0.75], [0.5, 3.15, 0.55]];
    const make = (hi) => {
      const P = [], n = hi ? 10 : 4;
      const m = squircle(n, 1, 1, 2);
      P.push(loft([ring(0, m, { s: 0.34 }), ring(0.12, m, { s: 0.24 }), ring(1.0, m, { s: 0.14 })], { color: PEARL, type: 3, smooth: true }));
      P.push(solid(new THREE.ConeGeometry(0.06, 0.06, 6).translate(0, 1.03, 0), GOLD, 0.4));
      for (const [y, a, d] of hi ? PADS : PADS.slice(0, 3)) {
        const x = Math.cos(a) * d, z = Math.sin(a) * d;
        const arm = squircle(hi ? 6 : 4, 0.07, 0.07, 2);
        P.push(loft([ring(y - 0.16, arm, { dx: x * 0.15, dz: z * 0.15 }), ring(y - 0.05, arm, { dx: x * 0.6, dz: z * 0.6 }), ring(y - 0.012, arm, { dx: x, dz: z })], { color: PEARL2, type: 0, smooth: true }));
        if (hi) {
          const pad = squircle(20, 0.32, 0.32, 2);
          P.push(aStrip(pad, { dx: x, dz: z }, y, 0, 0, 0, 0, PEARL2), aStrip(pad, { dx: x, dz: z }, y, -0.8, 0, 0, 0, PEARL2), aStrip(pad, { dx: x, dz: z }, y, -0.8, -0.8, 0, 0, PEARL2, 0, true));
          P.push(aStrip(squircle(20, 0.24, 0.24, 2), { dx: x, dz: z }, y, 0.02, 0.02, 0, 0.35, ACC, 1.8));
        } else P.push(solid(new THREE.CylinderGeometry(0.32, 0.3, 0.012, 8).translate(x, y - 0.006, z), PEARL2));
      }
      return mergeF(P);
    };
    A.branchport = { hi: make(true), lo: make(false) };
  }

  // [생체 산업] 나무 반응로: 굵은 줄기가 셋으로 갈라져 생장 꼬투리(유리 격자)를 받친다
  {
    const BR = [[0.0, 0.92, 0.95], [2.1, 0.8, 0.88], [4.2, 0.86, 0.72]];
    const make = (hi) => {
      const P = [], n = hi ? 12 : 5;
      const c = squircle(n, 1, 1, 2);
      P.push(loft([ring(0, c, { s: 0.5 }), ring(0.08, c, { s: 0.36 }), ring(0.4, c, { s: 0.3 }), ring(0.5, c, { s: 0.36 })], { color: 0xd8d0c4, type: 0, smooth: true }));
      for (const [a, d, h] of BR) {
        const x = Math.cos(a) * d * 0.7, z = Math.sin(a) * d * 0.7;
        const b = squircle(n, 0.16, 0.16, 2);
        P.push(loft([ring(0.46, b, { dx: x * 0.15, dz: z * 0.15 }), ring(0.6, b, { dx: x * 0.55, dz: z * 0.55, s: 0.9 }), ring(h * 0.72, b, { dx: x, dz: z, s: 0.8 })], { color: 0xd8d0c4, type: 0, smooth: true }));
        const pod = new THREE.SphereGeometry(0.34, hi ? 14 : 6, hi ? 10 : 4).scale(1, 0.32 / 0.34 * 0.6, 1).translate(x, h * 0.72 + 0.12, z);
        P.push(solidT(pod, 0xcff2dc, 0.05, 6));
        P.push(band(squircle(n, 0.33, 0.33, 2), h * 0.72 + 0.005, 0.01, 1.0, ACC, 1.4, { dx: x, dz: z }));
      }
      if (hi) for (let i = 0; i < 5; i++) { const a = i * 1.3; P.push(solid(new THREE.CylinderGeometry(0.02, 0.04, 0.1, 4).translate(Math.cos(a) * 0.45, 0.05, Math.sin(a) * 0.45), 0xd8d0c4)); }
      return mergeF(P);
    };
    A.treeform = { hi: make(true), lo: make(false) };
  }

  // [공공] 울림 문: 두 다리와 위 들보로 된 속 빈 문 건물, 그 빈 곳에 떠 있는 울림 구
  {
    const make = (hi) => {
      const P = [], n = hi ? 10 : 4;
      for (const x of [-0.72, 0.72]) {
        const leg = squircle(n, 0.28, 0.8, 8);
        P.push(loft([ring(0, leg, { dx: x }), ring(0.78, leg, { dx: x, s: 0.92 })], { color: PEARL, type: 2, smooth: false }));
      }
      const top = squircle(n, 1, 0.82, 8);
      P.push(loft([ring(0.78, top), ring(1, top, { s: 0.94 })], { color: PEARL, type: 1, smooth: false }), cap(ring(1, top, { s: 0.94 }), { color: GARDEN }), cap(ring(0.78, top), { color: PEARL2, down: true }));
      P.push(solid(new THREE.IcosahedronGeometry(0.2, hi ? 2 : 0).scale(1, 0.24, 1).translate(0, 0.46, 0), 0xf6eeff, 0.9));
      if (hi) P.push(band(squircle(16, 0.3, 0.3, 2), 0.455, 0.006, 1.6, ACC, 1.8));
      return mergeF(P);
    };
    A.gate = { hi: make(true), lo: make(false) };
  }

  // ══ 기존 모양에 실제 크기 장식 (가까이서만) ══════════
  const kit = (k, parts) => { if (A[k]) A[k].hi = mergeF([A[k].hi, ...parts]); };
  kit('twist', [...baseKit(squircle(16, 1, 1, 4), { h: 5.8, d: 3, cols: 8 }), ...parapet(squircle(16, 1, 1, 4), 0.92, { base: { s: 1 - 0.24 * 0.92, rot: 0.92 * 1.25 }, glass: true }), ...roofGear(0.97, 0.3, null, { pv: false })]);
  kit('blade', baseKit(squircle(18, 1, 0.42, 2.2), { h: 5.8, d: 3, cols: 10 }));
  kit('stack', [...baseKit(squircle(16, 1, 0.78, 8), { h: 5.8, d: 3, cols: 10 }),
    ...parapet(squircle(16, 1, 0.78, 8), 0.34, { glass: true }), ...parapet(squircle(16, 0.86, 0.72, 8), 0.6, { base: { rot: 0.42, dx: 0.14, dz: 0.06 }, glass: true }), ...parapet(squircle(16, 0.78, 0.6, 8), 0.84, { base: { rot: -0.3, dx: -0.12, dz: 0.1 }, glass: true })]);
  kit('spire', [aStrip(squircle(14, 1, 1, 2), {}, 0, 0, 6.8, 4.8, 4.8, 0x9fd8e8, 0.22), aStrip(squircle(14, 1, 1, 2), {}, 0, 6.8, 6.8, 0, 5.2, PEARL2), aStrip(squircle(14, 1, 1, 2), {}, 0, 6.8, 7.3, 5.2, 5.2, ACC, 1.4)]);
  kit('twin', [...baseKit(squircle(12, 0.4, 0.4, 4), { base: { dx: -0.58 }, h: 5.4, d: 2.6, cols: 6 }), ...baseKit(squircle(12, 0.4, 0.4, 4), { base: { dx: 0.58 }, h: 5.4, d: 2.6, cols: 6 })]);
  kit('ovoid', baseKit(squircle(16, 1, 1, 2), { base: { s: 0.62 }, h: 5, d: 3.2, cols: 8 }));
  kit('arcology', [...baseKit(squircle(16, 1, 1, 6), { h: 5.4, d: 2.8, cols: 12 }), ...[[0.3, 1], [0.55, 0.8], [0.78, 0.6]].flatMap(([y, r]) => parapet(squircle(16, 1, 1, 6), y, { base: { s: r }, glass: true }))]);
  kit('slab', [...baseKit(squircle(16, 1, 1, 10), { h: 6, d: 3, cols: 14 }), ...parapet(squircle(16, 1, 1, 10), 0.88), ...roofGear(0.88, 0.9, null, { pv: true })]);
  kit('villa', parapet(squircle(12, 1, 0.7, 10), 0.45, { glass: true, h: 1.05 }));
  kit('podium', [...parapet(rectPts(8, 8, 1, 1), 1, { glass: true }), ...baseKit(rectPts(8, 8, 1, 1), { h: 5, d: 3.2, cols: 24 })]);
  kit('balcony', [...baseKit(squircle(14, 0.78, 0.78, 2), { h: 5.2, d: 3.4, cols: 10 }), ...parapet(squircle(14, 0.78, 0.78, 2), 0.94, { base: { s: 0.92 }, glass: true })]);
  kit('observatory', baseKit(squircle(12, 1, 0.85, 8), { h: 4.6, d: 2.4, cols: 8 }));
  kit('podlab', baseKit(squircle(14, 0.4, 0.4, 2), { h: 4.6, d: 2.6, cols: 6 }));
  kit('fabricator', [...[-0.6, -0.2, 0.2, 0.6].flatMap((x) => [aBox(x, 0.62, 0.12, 0.005, 0, 0.4, 6, 0x3a4458, 0.05, 0.02), aBox(x, 0.62, 0.125, 0.005, 0, 6.05, 6.2, 0xffc46a, 1.6, 0.04)]), aBox(0, 0.62, 0.96, 0.001, 0, 0, 1.2, PEARL2, 0, 1.3)]);
  kit('hangar', baseKit(squircle(14, 1, 1, 12), { h: 5, d: 2.6 }));
  kit('setback', [...baseKit(squircle(16, 1, 0.8, 10), { h: 6, d: 3.2, cols: 12 }), ...parapet(squircle(16, 0.82, 0.66, 10), 0.68, { glass: true }), ...parapet(squircle(16, 0.62, 0.5, 10), 0.86, { glass: true })]);
  kit('crown', [...baseKit(squircle(16, 1, 0.85, 6), { h: 6.4, d: 3.4, cols: 12 }), ...parapet(squircle(16, 1, 0.85, 6), 0.48, { glass: true }), aStrip(squircle(16, 1, 0.85, 6), { s: 1.0 }, 1.0, -2.2, 0, 0, 0, ACC, 1.6)]);
  kit('terrace', [...baseKit(squircle(14, 1, 1, 8), { h: 5, d: 2.8, cols: 10 }), ...[1, 2, 3, 4, 5].flatMap((i) => parapet(squircle(14, 1, 1 - (i / 6) * 0.62, 8), i / 6, { base: { dz: -(i / 6) * 0.62 }, glass: true }))]);
  kit('cantilever', [...baseKit(squircle(14, 0.72, 0.72, 8), { h: 6, d: 3, cols: 8 }), ...parapet(squircle(14, 0.6, 0.66, 8), 0.68, { base: { dx: 0.4 }, glass: true }), ...roofGear(1.0, 0.4, null, { pv: false })]);
  kit('skygarden', [...baseKit(squircle(14, 0.9, 0.9, 6), { h: 5.6, d: 3, cols: 10 }), ...parapet(squircle(14, 0.9, 0.9, 6), 0.36, { glass: true }), ...parapet(squircle(14, 0.9, 0.9, 6), 0.7, { glass: true }), ...roofGear(0.96, 0.7, null, { pv: true })]);
  kit('triad', [0, 2.094, 4.189].flatMap((a) => baseKit(squircle(12, 0.38, 0.38, 2.6), { base: { dx: Math.cos(a) * 0.56, dz: Math.sin(a) * 0.56 }, h: 5, d: 2.4, cols: 6 })));
  kit('halolab', baseKit(squircle(14, 0.5, 0.5, 2), { h: 4.6, d: 2.6, cols: 6 }));
  kit('gate', [-0.72, 0.72].flatMap((x) => baseKit(squircle(10, 0.28, 0.8, 8), { base: { dx: x }, h: 5.4, d: 2.6, cols: 4 })));
  kit('dome', [aBox(0, 1.0, 0.16, 0.02, 0, 0, 3.4, 0x9fd8e8, 0.2, 0.2), aBox(0, 1.0, 0.2, 0.02, 0, 3.4, 3.6, PEARL2, 0, 0.6)]);
  LANDMARKS = landmarkArchetypes(A);
  return A;
}

// 모양별 크기 규칙: (발 반지름 rr, 구역 높이 h, rnd) → [sx, sy, sz, 원통 충돌 반지름 배율(0 이면 상자), 지붕 높이 배율, 상자 반폭 배율]
export const SIZE = {
  reactor: (rr, h, r) => [rr * 0.95, rr * 0.95 * 1.25 + h * 0.05, 0, 0.75, 0.6],
  conduit: (rr, h, r) => [rr * 0.55, h * 1.05, 0, 0.45, 0.95],
  cooler: (rr, h, r) => [rr * 0.98, Math.max(30, h * 0.45), 0, 0.98, 0.98],
  observatory: (rr, h, r) => [rr * 0.95, Math.max(22, h * 0.4), 0, 0.95, 0.75],
  antenna: (rr, h, r) => [rr * 0.9, h * 0.95, 0, 0.42, 0.7],
  podlab: (rr, h, r) => [rr * 0.95, h * 0.9, 0, 0.42, 0.92],
  hangar: (rr, h, r) => [rr * 1.05, Math.max(18, rr * 0.95), rr * 0.7, 0, 0.95, 0.95],
  padtower: (rr, h, r) => [rr * 0.95, h * 0.85, 0, 0.28, 0.96],
  balcony: (rr, h, r) => [rr * 0.95, h * 0.95, 0, 0.78, 0.94],
  bubbles: (rr, h, r) => [rr * 0.95, Math.max(20, rr * 1.6 + h * 0.15), 0, 0.8, 0.85],
  fabricator: (rr, h, r) => [rr * 1.05, Math.max(14, h * 0.28), rr * 0.75, 0, 0.5, 0.62],
  tanks: (rr, h, r) => [rr * 0.95, Math.max(16, h * 0.3), 0, 0.95, 0.85],
  twist: (rr, h, r) => [rr * (0.78 + r() * 0.18), h * 1.05, 0, 0.9, 0.92],
  blade: (rr, h, r) => [rr * 0.98, h * 0.95, 0, 0, 0.82, 0.42],
  stack: (rr, h, r) => [rr * 0.95, h * 0.85, 0, 0.92, 0.84],
  spire: (rr, h, r) => [rr * 0.62, h * 1.3, 0, 0.75, 0.6],
  twin: (rr, h, r) => [rr * 1.0, h * 0.95, 0, 0, 0.6, 0.42],
  ovoid: (rr, h, r) => [rr * 0.85, Math.max(30, h * 0.7), 0, 0.85, 0.9],
  arcology: (rr, h, r) => [rr, Math.max(18, h * 0.6), 0, 0.98, 0.98],
  slab: (rr, h, r) => [rr * 0.95, h * 0.8, rr * (0.42 + r() * 0.35), 0, 0.97, 0.95],
  villa: (rr, h, r) => [rr * 0.95, Math.max(8, Math.min(h, rr * 1.2)), 0, 0, 0.94, 0.8],
  dome: (rr, h, r) => [rr * 0.95, rr * (0.75 + r() * 0.35), 0, 0.95, 0.85],
  crystal: (rr, h, r) => [rr * 0.7, h, 0, 0.9, 0.8],
  cap: (rr, h, r) => [rr, Math.max(10, rr * (1.0 + r() * 0.7)), 0, 0.95, 1.0],
  stilt: (rr, h, r) => [rr * 0.85, 8 + r() * 10, 0, 0.9, 0.92],
};

// ══ 구역의 보조 랜드마크 (v0.6) ══════════════════════════════
// 실제 미터로 짓는 하나뿐인 건물(배율 1). 중앙의 척추·하모네아보다 낮게(280~420 m), 저마다 구역의 쓰임을 형태로 보인다.
//  lm_coil   에너지 — 「울림 코일 탑」: 세 다리가 감싼 빛 심지를 층층의 코일 고리가 두른다
//  lm_ear    연구  — 「별귀 탑」: 세 발 위 가는 몸통, 관측 고리 둘, 꼭대기의 속 빈 구 틀(하늘을 듣는 귀)
//  lm_port   교통  — 「하늘 나루」: 돛대에서 여섯 팔이 높이마다 뻗어 하늘배 착륙판을 받치고, 위에 고리 부두
//  lm_garden 주거  — 「매달린 정원」: 서로 기댄 두 탑 사이에 층층이 매달린 정원 데크
//  lm_tree   생체 산업 — 「생명나무」: 뿌리·줄기·가지 끝의 생장 꼬투리
function landmarkArchetypes(A) {
  const solidT = (geo, color, emit, type) => { const g = geo.index ? geo.toNonIndexed() : geo; if (!g.attributes.normal) g.computeVertexNormals(); return paint(g, color, emit, type); };
  const tubeAlong = (pts, r, color, emit = 0, segs = 40, radial = 8) => solid(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), segs, r, radial, false), color, emit);
  const torus = (R, r, y, color, emit = 0, rx = Math.PI / 2, ry = 0, seg = 72) => solid(new THREE.TorusGeometry(R, r, 8, seg).rotateX(rx).rotateY(ry).translate(0, y, 0), color, emit);
  const C = (n) => squircle(n, 1, 1, 2);
  const lathe = (prof, n, color, type = 0, emit = 0) => loft(prof.map(([r, y]) => ring(y, C(n), { s: r })), { color, type, emit, smooth: true });
  const AMBER = 0xffc46a, PINK = 0xff9fd0, POD = 0xcff2dc;
  const M = {};

  // ── 에너지: 울림 코일 탑 (360 m) ──
  {
    const P = [];
    const R = (y) => 18 + 34 * Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, y / 340))), 0.9);
    P.push(lathe([[34, 0], [33, 6], [26, 10]], 48, PEARL2), cap(ring(10, C(48), { s: 26 }), { color: PEARL2 }));
    P.push(lathe([[9, 10], [7.5, 330]], 24, 0xbff8ff, 0, 1.1));
    for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; P.push(solid(new THREE.CylinderGeometry(0.45, 0.45, 320, 5).translate(Math.cos(a) * 11, 170, Math.sin(a) * 11), STEEL)); }
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * TAU + 0.3, pts = [];
      for (let y = 0; y <= 340; y += 34) { const r = Math.max(10, R(y) + 4) + (y < 30 ? 10 - y / 3 : 0); pts.push([Math.cos(a) * r, y, Math.sin(a) * r]); }
      P.push(tubeAlong(pts, 2.6, PEARL, 0, 60, 8));
      P.push(tubeAlong(pts.map(([x, y, z]) => [x * 1.06, y, z * 1.06]), 0.5, AMBER, 1.5, 60, 4));
    }
    for (let i = 0; i < 8; i++) {
      const y = 40 + i * 37, r = R(y);
      P.push(torus(r, 2.3, y, i % 2 ? PEARL : STEEL), torus(r - 2.6, 0.5, y, i % 2 ? ACC : AMBER, 1.6));
      for (let k = 0; k < 4; k++) { const a = (k / 4) * TAU + i * 0.4; const g = new THREE.BoxGeometry(r - 9, 1.2, 1.2).translate((r + 9) / 2, y, 0).rotateY(-a); P.push(solid(g, STEEL)); }
    }
    P.push(solid(new THREE.CylinderGeometry(22, 4, 14, 32, 1, true).translate(0, 340, 0), GOLD, 0.2));
    P.push(solid(new THREE.SphereGeometry(6, 16, 12).translate(0, 352, 0), 0xfff0d0, 2.0));
    P.push(torus(34, 0.4, 6.3, ACC, 1.6));
    // 전망 고리판 (300 m): 승강판이 닿는 곳
    P.push(solid(new THREE.CylinderGeometry(17, 15.5, 1.2, 40).translate(0, 299.4, 0), PEARL2), torus(17, 0.3, 300.05, ACC, 1.8), torus(16.6, 0.1, 301.1, PEARL, 0));
    for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; P.push(solid(new THREE.CylinderGeometry(0.06, 0.06, 1.1, 4).translate(Math.cos(a) * 16.6, 300.55, Math.sin(a) * 16.6), PEARL)); }
    const g = mergeF(P); M.lm_coil = { hi: g, lo: g };
  }

  // ── 연구: 별귀 탑 (420 m) ──
  {
    const P = [];
    for (let k = 0; k < 3; k++) { const a = (k / 3) * TAU; P.push(tubeAlong([[Math.cos(a) * 30, 0, Math.sin(a) * 30], [Math.cos(a) * 22, 50, Math.sin(a) * 22], [Math.cos(a) * 10, 110, Math.sin(a) * 10], [Math.cos(a) * 6, 150, Math.sin(a) * 6]], 2.4, PEARL, 0, 40, 8)); }
    P.push(lathe([[18, 0], [18, 8]], 32, PEARL, 1), cap(ring(8, C(32), { s: 18 }), { color: GARDEN }));
    P.push(lathe([[7, 120], [6, 200], [5.5, 330]], 20, PEARL, 2));
    P.push(lathe([[5.5, 330], [9, 336], [9, 342], [4, 348]], 20, PEARL2));
    P.push(solid(new THREE.CylinderGeometry(4.3, 4.3, 0.3, 20).translate(0, 348.15, 0), PEARL2), torus(4.3, 0.12, 348.32, ACC, 1.8)); // 꼭대기 전망판
    for (const [R, y, t] of [[26, 190, 0.12], [20, 250, -0.1]]) {
      P.push(torus(R, 1.6, 0, PEARL2, 0, Math.PI / 2 + t).translate(0, y, 0));
      P.push(torus(R - 1.8, 0.35, 0, ACC, 1.8, Math.PI / 2 + t).translate(0, y, 0));
      for (let k = 0; k < 3; k++) { const a = (k / 3) * TAU + y; P.push(solid(new THREE.BoxGeometry(R - 6, 0.8, 0.8).translate((R + 6) / 2, y, 0).rotateY(-a), STEEL)); }
    }
    for (let i = 0; i < 6; i++) P.push(solid(new THREE.TorusGeometry(34, 0.9, 6, 64).rotateY((i / 6) * Math.PI).translate(0, 372, 0), i % 2 ? PEARL : GOLD, 0.1));
    P.push(torus(34, 1.4, 372, GOLD, 0.2));
    P.push(solid(new THREE.SphereGeometry(9, 20, 14).translate(0, 372, 0), 0xbffcff, 1.8));
    P.push(solid(new THREE.CylinderGeometry(0.5, 1.2, 40, 6).translate(0, 420, 0), STEEL), solid(new THREE.OctahedronGeometry(1.4, 0).translate(0, 441, 0), 0xff6a5a, 3));
    const g = mergeF(P); M.lm_ear = { hi: g, lo: g };
  }

  // ── 교통: 하늘 나루 (300 m) ──
  {
    const P = [];
    P.push(lathe([[30, 0], [30, 14]], 40, PEARL, 1), cap(ring(14, C(40), { s: 30 }), { color: PEARL2 }), torus(24, 0.4, 14.2, ACC, 1.6));
    P.push(lathe([[10, 14], [8, 150], [6, 300]], 20, PEARL, 3));
    const pads = [];
    [90, 90, 150, 150, 210, 210].forEach((y, i) => {
      const a = (i % 2) * Math.PI + Math.floor(i / 2) * 1.05, d = 62 - Math.floor(i / 2) * 6;
      const ex = Math.cos(a) * d, ez = Math.sin(a) * d;
      P.push(tubeAlong([[Math.cos(a) * 7, y - 6, Math.sin(a) * 7], [Math.cos(a) * d * 0.5, y + 2, Math.sin(a) * d * 0.5], [ex, y + 10, ez]], 1.8, PEARL, 0, 24, 8));
      P.push(tubeAlong([[Math.cos(a) * 8, y - 16, Math.sin(a) * 8], [Math.cos(a) * d * 0.6, y - 4, Math.sin(a) * d * 0.6], [ex, y + 8, ez]], 0.9, STEEL, 0, 24, 5));
      P.push(solid(new THREE.CylinderGeometry(14, 12.5, 1.6, 36).translate(ex, y + 10, ez), PEARL2));
      P.push(solid(new THREE.TorusGeometry(10, 0.35, 4, 40).rotateX(Math.PI / 2).translate(ex, y + 10.85, ez), ACC, 2.0));
      pads.push([ex, y + 10.8, ez]);
    });
    P.push(torus(48, 2.4, 255, PEARL2), torus(45.4, 0.5, 255, ACC, 1.8));
    for (let k = 0; k < 4; k++) { const a = (k / 4) * TAU + 0.4; P.push(tubeAlong([[Math.cos(a) * 7, 248, Math.sin(a) * 7], [Math.cos(a) * 48, 255, Math.sin(a) * 48]], 1.2, STEEL, 0, 8, 6)); }
    P.push(solid(new THREE.ConeGeometry(3, 18, 8).translate(0, 309, 0), GOLD, 0.3), solid(new THREE.OctahedronGeometry(1.2, 0).translate(0, 320, 0), 0xff6a5a, 3));
    const g = mergeF(P); M.lm_port = { hi: g, lo: g, pads };
  }

  // ── 주거: 매달린 정원 (340 m) ──
  {
    const P = [];
    const X = (y) => 26 - 10 * Math.sin((Math.PI * y) / 340);
    for (const sd of [-1, 1]) {
      const pts = squircle(24, 12, 11, 4);
      const secs = [];
      for (let y = 0; y <= 340; y += 34) secs.push(ring(y, pts, { dx: sd * X(y), s: 1 - (y / 340) * 0.25 }));
      P.push(loft(secs, { color: PEARL, type: 5, smooth: true }), cap(secs[secs.length - 1], { color: GARDEN }));
    }
    const decks = [];
    let seed = 7;
    const rr = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (const y of [40, 85, 130, 175, 220, 265, 305]) {
      const hx = X(y) - 6;
      P.push(solid(new THREE.BoxGeometry(hx * 2, 1.4, 18).translate(0, y - 0.7, 0), PEARL2), solid(new THREE.BoxGeometry(hx * 2 - 1, 0.2, 17).translate(0, y + 0.1, 0), GARDEN));
      for (const sz of [-1, 1]) P.push(solid(new THREE.BoxGeometry(hx * 2, 1.1, 0.12).translate(0, y + 0.65, sz * 8.9), 0x9fd8e8, 0.25), solid(new THREE.BoxGeometry(hx * 2, 0.1, 0.16).translate(0, y + 1.25, sz * 8.9), ACC, 1.4));
      for (let i = 0; i < 3; i++) { const x = (rr() - 0.5) * hx * 1.4, z = (rr() - 0.5) * 10; P.push(solid(new THREE.CylinderGeometry(0.25, 0.35, 3, 5).translate(x, y + 1.6, z), 0x6a5a50), solid(new THREE.IcosahedronGeometry(2.8 + rr() * 1.2, 0).scale(1, 0.85, 1).translate(x, y + 4.4, z), 0x3f8f5a, 0.12)); }
      for (let i = 0; i < 6; i++) { const x = (rr() - 0.5) * hx * 1.8, l = 6 + rr() * 9; P.push(solid(new THREE.CylinderGeometry(0.18, 0.08, l, 4).translate(x, y - 1.4 - l / 2, (rr() < 0.5 ? -1 : 1) * 8.6), 0x4fa86a, 0.25)); }
      decks.push([y, hx]);
    }
    P.push(tubeAlong([[-X(340) * 0.75, 340, 0], [-10, 362, 0], [0, 368, 0], [10, 362, 0], [X(340) * 0.75, 340, 0]], 2.2, GOLD, 0.2, 40, 8));
    P.push(tubeAlong([[-X(340) * 0.75, 342, 0], [0, 370.5, 0], [X(340) * 0.75, 342, 0]], 0.4, ACC, 1.8, 40, 4));
    const g = mergeF(P); M.lm_garden = { hi: g, lo: g, decks, X };
  }

  // ── 생체 산업: 생명나무 (280 m) ──
  {
    const P = [];
    const BARK = 0xd8d0c4;
    for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU + 0.2; P.push(tubeAlong([[Math.cos(a) * 32, -2, Math.sin(a) * 32], [Math.cos(a) * 22, 14, Math.sin(a) * 22], [Math.cos(a) * 12, 40, Math.sin(a) * 12]], 3.2, BARK, 0, 20, 8)); }
    P.push(lathe([[16, 0], [12, 60], [14, 110], [10, 150], [8, 170]], 28, BARK));
    for (let k = 0; k < 3; k++) { const pts = []; for (let y = 0; y <= 160; y += 8) { const a = y * 0.05 + (k / 3) * TAU; const r = (y < 60 ? 16 - y / 15 : y < 110 ? 12 + (y - 60) / 25 : 14 - (y - 110) / 12) + 0.4; pts.push([Math.cos(a) * r, y, Math.sin(a) * r]); } P.push(tubeAlong(pts, 0.6, k % 2 ? PINK : ACC, 1.4, 80, 4)); }
    const pods = [];
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * TAU + 0.5, d = 52 + (k % 3) * 9, top = 205 + (k % 3) * 22;
      const ex = Math.cos(a) * d, ez = Math.sin(a) * d;
      P.push(tubeAlong([[Math.cos(a) * 6, 140, Math.sin(a) * 6], [Math.cos(a) * d * 0.45, top - 40, Math.sin(a) * d * 0.45], [ex, top - 14, ez]], 3.0, BARK, 0, 28, 8));
      const pr = 14 + (k % 2) * 4;
      P.push(solidT(new THREE.SphereGeometry(pr, 20, 14).translate(ex, top, ez), POD, 0.05, 6));
      P.push(solid(new THREE.TorusGeometry(pr * 0.85, 0.4, 4, 40).rotateX(Math.PI / 2).translate(ex, top - pr * 0.55, ez), k % 2 ? PINK : ACC, 1.6));
      const mx = Math.cos(a) * d * 0.55, mz = Math.sin(a) * d * 0.55;
      P.push(solidT(new THREE.SphereGeometry(7, 12, 10).translate(mx, top - 34, mz), POD, 0.05, 6));
      pods.push([ex, top, ez, pr], [mx, top - 34, mz, 7]);
    }
    P.push(solidT(new THREE.SphereGeometry(20, 22, 16).translate(0, 190, 0), POD, 0.05, 6), torus(17, 0.5, 178, PINK, 1.8));
    const g = mergeF(P); M.lm_tree = { hi: g, lo: g, pods };
  }

  for (const [k, v] of Object.entries(M)) A[k] = { hi: v.hi, lo: v.lo };
  return M;
}

// ── 모양별 성질: 땅에 닿은 평면(초타원 [k, 가로, 세로]) · 겹 충돌체 · 들어갈 수 있나 · 둥근가 ──
// 충돌체(단위): ['c', x, z, r, y0, y1, dome?] 원통 / ['b', x, z, hx, hz, y0, y1, rot?] 상자.  y 는 높이 비율.
const cy = (r, y0, y1, x = 0, z = 0, dome) => ['c', x, z, r, y0, y1, dome];
const bx = (hx, hz, y0, y1, x = 0, z = 0, rot = 0) => ['b', x, z, hx, hz, y0, y1, rot];
export const SPEC = {
  twist: { plan: [4, 1, 1], round: true, enter: true, cols: [cy(1.05, 0, 0.3), cy(0.97, 0.3, 0.6), cy(0.87, 0.6, 0.92), cy(0.42, 0.92, 0.97)] },
  blade: { plan: [2.2, 1, 0.42], enter: true, cols: [bx(0.95, 0.4, 0, 0.82), bx(0.5, 0.36, 0.82, 0.95, 0.45)] },
  stack: { plan: [8, 1, 0.78], enter: true, cols: [bx(1, 0.78, 0, 0.34), bx(0.86, 0.72, 0.34, 0.6, 0.14, 0.06, 0.42), bx(0.78, 0.6, 0.6, 0.84, -0.12, 0.1, -0.3), bx(0.5, 0.42, 0.84, 0.96, 0.05, -0.04, 0.15)] },
  spire: { plan: [2, 1, 1], round: true, enter: true, cols: [cy(0.97, 0, 0.15), cy(0.82, 0.15, 0.35), cy(0.62, 0.35, 0.55), cy(0.42, 0.55, 0.75), cy(0.22, 0.75, 0.95)] },
  twin: { plan: [4, 1, 0.42], cols: [bx(0.4, 0.4, 0, 0.92, -0.58), bx(0.4, 0.4, 0, 0.8, 0.58), bx(0.6, 0.16, 0.52, 0.58), bx(0.6, 0.16, 0.72, 0.76)] },
  ovoid: { plan: [2, 0.62, 0.62], round: true, enter: true, cols: [cy(0.72, 0, 0.12), cy(0.97, 0.12, 0.52), cy(0.85, 0.52, 0.72), cy(0.62, 0.72, 0.88), cy(0.3, 0.88, 0.97)] },
  arcology: { plan: [6, 1, 1], enter: true, cols: [bx(1, 1, 0, 0.3), bx(0.8, 0.8, 0.3, 0.55), bx(0.6, 0.6, 0.55, 0.78), bx(0.4, 0.4, 0.78, 1)] },
  slab: { plan: [10, 1, 1], enter: true, cols: [bx(1, 1, 0, 0.88), bx(0.6, 0.6, 0.88, 0.97)] },
  villa: { plan: [10, 1, 0.7], enter: true, low: true, cols: [bx(1, 0.7, 0, 0.45), bx(0.95, 0.78, 0.45, 0.94, 0.25, 0.15, 0.3)] },
  podium: { plan: [12, 1, 1], enter: true, cols: [bx(1, 1, 0, 1)] },
  dome: { plan: [2, 1.03, 1.03], round: true, enter: true, low: true, cols: [cy(1, 0, 1, 0, 0, 0.6)] },
  crystal: { plan: [2, 0.88, 0.88], round: true, enter: true, cols: [cy(0.9, 0, 0.8), cy(0.45, 0.8, 0.95)] },
  cap: { plan: [2, 0.3, 0.3], round: true, enter: true, low: true, cols: [cy(0.28, 0, 0.6), cy(1, 0.6, 1, 0, 0, 0.35)] },
  stilt: { plan: [2, 0.74, 0.74], round: true, low: true, cols: [cy(1, 0.48, 0.53), cy(0.74, 0.53, 0.82), cy(0.85, 0.82, 0.9)] },
  reactor: { plan: [2, 0.94, 0.94], round: true, enter: true, low: true, cols: [cy(0.94, 0, 0.14), cy(0.62, 0.14, 1, 0, 0, 0.3)] },
  conduit: { plan: [2, 0.5, 0.5], round: true, cols: [cy(0.5, 0, 0.3), cy(0.2, 0.3, 1.05)] },
  cooler: { plan: [2, 1, 1], round: true, low: true, cols: [cy(1, 0, 0.3), cy(0.82, 0.3, 0.68), cy(0.74, 0.68, 1)] },
  observatory: { plan: [8, 1, 0.85], enter: true, low: true, cols: [bx(1, 0.85, 0, 0.45), cy(0.7, 0.45, 0.95, 0, 0, 0.45)] },
  antenna: { plan: [2, 0.45, 0.45], round: true, cols: [cy(0.45, 0, 0.7), cy(0.95, 0.7, 0.73), cy(0.05, 0.73, 1)] },
  podlab: { plan: [2, 0.4, 0.4], round: true, enter: true, cols: [cy(0.42, 0, 1)] },
  hangar: { plan: [12, 1, 1], enter: true, low: true, cols: [bx(1, 0.96, 0, 0.6), bx(1, 0.75, 0.6, 0.85), bx(1, 0.42, 0.85, 1)] },
  padtower: { plan: [2, 0.26, 0.26], round: true, cols: [cy(0.27, 0, 1), cy(1, 0.405, 0.42), cy(0.82, 0.685, 0.7), cy(0.66, 0.945, 0.96)] },
  balcony: { plan: [2, 0.78, 0.78], round: true, enter: true, cols: [cy(0.9, 0, 0.94), cy(0.5, 0.94, 1)] },
  bubbles: { plan: [2, 0.55, 0.55], round: true, enter: true, low: true, cols: [cy(0.55, 0, 0.77), cy(0.38, 0.1, 0.74, 0.42, 0.22), cy(0.4, 0.16, 0.84, -0.38, -0.18), cy(0.32, 0.48, 1.02, 0.05, -0.08), cy(0.16, 0.8, 1.08, 0.1, 0.06)] },
  fabricator: { plan: [10, 1, 0.62], enter: true, low: true, cols: [bx(1, 0.62, 0, 0.5), bx(0.9, 0.5, 0.5, 0.66)] },
  tanks: { plan: [2, 0.9, 0.9], round: true, low: true, cols: [0, 1, 2].map((i) => { const a = (i / 3) * Math.PI * 2 + 0.5; return cy(0.4, 0, 0.75 + (i % 2) * 0.12 + 0.18, Math.cos(a) * 0.52, Math.sin(a) * 0.52, 0.18); }) },
  bridge: { plan: [2, 1, 1], cols: [bx(1, 1, 0, 1)] },
  midrise: { plan: [14, 1, 1], enter: true, low: true, cols: [bx(1, 1, 0, 1)] },
  hall: { plan: [12, 0.92, 0.92], enter: true, low: true, cols: [bx(0.92, 0.92, 0, 0.72), bx(1.08, 1.12, 0.72, 0.95)] },
  school: { plan: [2, 0.38, 0.38], round: true, enter: true, low: true, cols: [bx(0.42, 0.9, 0, 0.62, -0.58), bx(0.42, 0.9, 0, 0.62, 0.58), cy(0.38, 0, 0.9)] },
  warehouse: { plan: [30, 1, 1], enter: true, low: true, cols: [bx(1, 1, 0, 0.7), bx(1, 0.8, 0.7, 0.9), bx(1, 0.45, 0.9, 1)] },
  biodome: { plan: [2, 1, 1], round: true, enter: true, low: true, cols: [cy(1, 0, 1, 0, 0, 0.92)] },
  vfarm: { plan: [6, 0.95, 0.95], enter: true, cols: [bx(0.97, 0.97, 0, 0.94)] },
  greenhouse: { plan: [30, 1, 0.9], enter: true, low: true, cols: [bx(1, 0.92, 0, 0.55), bx(1, 0.62, 0.55, 0.86), bx(1, 0.3, 0.86, 1)] },
  setback: { plan: [10, 1, 0.8], enter: true, cols: [bx(1, 0.8, 0, 0.42), bx(0.82, 0.66, 0.42, 0.68), bx(0.62, 0.5, 0.68, 0.86), bx(0.4, 0.34, 0.86, 0.95)] },
  crown: { plan: [6, 1, 0.85], enter: true, cols: [bx(1, 0.85, 0, 0.86), bx(0.5, 0.42, 0.86, 0.93)] },
  terrace: { plan: [8, 1, 1], enter: true, cols: [0, 1, 2, 3, 4, 5].map((i) => { const d = 1 - (i / 6) * 0.62; return bx(1, d, i / 6, (i + 1) / 6, 0, -(1 - d)); }) },
  cantilever: { plan: [8, 0.72, 0.72], enter: true, cols: [bx(0.72, 0.72, 0, 0.92), bx(0.6, 0.66, 0.52, 0.68, 0.4, 0), bx(0.5, 0.46, 0.92, 1, -0.1, 0, 0.35)] },
  skygarden: { plan: [6, 0.9, 0.9], enter: true, cols: [bx(0.9, 0.9, 0, 0.36), cy(0.3, 0.36, 0.41), bx(0.9, 0.9, 0.41, 0.7), cy(0.3, 0.7, 0.75), bx(0.9, 0.9, 0.75, 0.96)] },
  triad: { plan: [2.6, 0.38, 0.38], round: true, cols: [[0, 1.0], [2.094, 0.84], [4.189, 0.7]].map(([a, h]) => cy(0.36, 0, h, Math.cos(a) * 0.56, Math.sin(a) * 0.56)) },
  halolab: { plan: [2, 0.5, 0.5], round: true, enter: true, cols: [cy(0.5, 0, 0.2), cy(0.4, 0.2, 0.86), cy(0.6, 0.86, 0.97)] },
  coiltower: { plan: [2, 1, 1], round: true, cols: [cy(1, 0, 0.09), cy(0.84, 0.09, 0.9, 0, 0, 0)] },
  branchport: { plan: [2, 0.34, 0.34], round: true, cols: [cy(0.34, 0, 0.12), cy(0.22, 0.12, 1), cy(0.32, 0.4 - 0.01, 0.4, 0.85, 0), cy(0.32, 0.58 - 0.01, 0.58, Math.cos(2.1) * 0.8, Math.sin(2.1) * 0.8), cy(0.32, 0.76 - 0.01, 0.76, Math.cos(4.2) * 0.75, Math.sin(4.2) * 0.75), cy(0.32, 0.5 - 0.01, 0.5, Math.cos(3.15) * 0.55, Math.sin(3.15) * 0.55)] },
  treeform: { plan: [2, 0.5, 0.5], round: true, cols: [cy(0.5, 0, 0.08), cy(0.34, 0.08, 0.5), ...[[0, 0.92, 0.95], [2.1, 0.8, 0.88], [4.2, 0.86, 0.72]].map(([a, d, h]) => cy(0.34, h * 0.72, h * 0.72 + 0.22, Math.cos(a) * d * 0.7, Math.sin(a) * d * 0.7))] },
  // 보조 랜드마크: 실제 미터(배율 1). 충돌체도 미터
  lm_coil: { plan: [2, 34, 34], round: true, fixed: 360, cols: [cy(34, 0, 10), cy(9.5, 10, 333), cy(17, 298.8, 300), cy(5, 346, 358), ...[0, 1, 2].map((k) => { const a = (k / 3) * TAU + 0.3; return cy(3.5, 0, 60, Math.cos(a) * 34, Math.sin(a) * 34); })] },
  lm_ear: { plan: [2, 18, 18], round: true, fixed: 420, cols: [cy(18, 0, 8), cy(7, 120, 336), cy(9, 336, 342), cy(4.3, 342, 348.3), ...[0, 1, 2].map((k) => { const a = (k / 3) * TAU; return cy(3, 0, 40, Math.cos(a) * 28, Math.sin(a) * 28); })] },
  lm_port: { plan: [2, 30, 30], round: true, fixed: 300, cols: [cy(30, 0, 14), cy(10, 14, 305), ...[90, 90, 150, 150, 210, 210].map((y, i) => { const a = (i % 2) * Math.PI + Math.floor(i / 2) * 1.05, d = 62 - Math.floor(i / 2) * 6; return cy(14, y + 9.2, y + 10.8, Math.cos(a) * d, Math.sin(a) * d); })] },
  lm_garden: { plan: [4, 40, 12], fixed: 340, cols: [...[-1, 1].flatMap((sd) => [0, 120, 240].map((y) => cy(12, y, y + 120, sd * (26 - 10 * Math.sin((Math.PI * (y + 60)) / 340)), 0))), ...[40, 85, 130, 175, 220, 265, 305].map((y) => bx(26 - 10 * Math.sin((Math.PI * y) / 340) - 6, 9, y - 1.4, y + 0.2))] },
  lm_tree: { plan: [2, 16, 16], round: true, fixed: 280, cols: [cy(16, 0, 150), cy(20, 172, 210, 0, 0, 14), ...[0, 1, 2, 3, 4].map((k) => { const a = (k / 5) * TAU + 0.2; return cy(3.5, 0, 30, Math.cos(a) * 26, Math.sin(a) * 26); }), ...[0, 1, 2, 3, 4, 5].map((k) => { const a = (k / 6) * TAU + 0.5, d = 52 + (k % 3) * 9, top = 205 + (k % 3) * 22, pr = 14 + (k % 2) * 4; return cy(pr * 0.9, top - pr * 0.7, top + pr, Math.cos(a) * d, Math.sin(a) * d, pr * 0.6); })] },
  gate: { plan: [8, 1, 0.8], cols: [bx(0.28, 0.8, 0, 0.78, -0.72), bx(0.28, 0.8, 0, 0.78, 0.72), bx(1, 0.82, 0.78, 1), cy(0.2, 0.4, 0.52)] },
};

/** 건물 입구: 빛의 막이 드리운 문틀 + 차양 + 문턱 (로컬: x 가 벽을 따라, +z 가 바깥) */
// 문: 원점 = 바깥벽에서 0.17 m 앞, +z = 바깥. 벽에 거의 붙은 얇은 문틀(앞으로 0.17 m)과 빛 테두리, 두 짝 유리문,
// 가벼운 빛 차양과 문턱 판. 문틀은 벽 쪽으로 1 m 숨은 깊이가 있어 위로 들어가는 둥근 벽(돔)에도 틈이 생기지 않는다
export function doorGeo({ canopy = true } = {}) {
  return mergeF([
    solid(new THREE.BoxGeometry(0.3, 4.1, 1.12).translate(-1.75, 2.05, -0.54), PEARL),
    solid(new THREE.BoxGeometry(0.3, 4.1, 1.12).translate(1.75, 2.05, -0.54), PEARL),
    solid(new THREE.BoxGeometry(3.8, 0.32, 1.12).translate(0, 4.06, -0.54), PEARL),
    // 빛 테두리 (문틀 안쪽)
    solid(new THREE.BoxGeometry(0.05, 3.88, 0.05).translate(-1.58, 1.96, 0.0), ACC, 1.6),
    solid(new THREE.BoxGeometry(0.05, 3.88, 0.05).translate(1.58, 1.96, 0.0), ACC, 1.6),
    solid(new THREE.BoxGeometry(3.2, 0.05, 0.05).translate(0, 3.9, 0.0), ACC, 1.6),
    // 두 짝 유리문과 가운데 이음 (밤에 눈부시지 않게 은은히)
    solid(new THREE.PlaneGeometry(1.54, 3.86).translate(-0.79, 1.95, -0.06), 0x5fb4c8, 0.32),
    solid(new THREE.PlaneGeometry(1.54, 3.86).translate(0.79, 1.95, -0.06), 0x5fb4c8, 0.32),
    solid(new THREE.BoxGeometry(0.04, 3.86, 0.04).translate(0, 1.95, -0.03), PEARL2, 0.4),
    // 가벼운 빛 차양 (벽에서 1.5 m) + 앞 가장자리 빛 — 건물의 처마·아케이드 밑이면 빼고
    ...(canopy ? [
      solid(new THREE.BoxGeometry(4.4, 0.07, 1.65).translate(0, 4.38, 0.66), PEARL2),
      solid(new THREE.BoxGeometry(4.3, 0.04, 0.05).translate(0, 4.35, 1.47), ACC, 2.0),
    ] : []),
    // 문턱 판
    solid(new THREE.BoxGeometry(3.6, 0.05, 1.3).translate(0, 0.025, 0.5), 0xb8b2c4),
    solid(new THREE.BoxGeometry(3.4, 0.02, 0.06).translate(0, 0.055, 1.12), ACC, 1.2),
  ]);
}

// ── 거리의 작은 것들 (단위: 미터, 인스턴스 배율 1 기준) ─────────────────
export function propArchetypes() {
  const P = {};
  const bulbs = (n, r, y, c = 0xffd27a) => Array.from({ length: n }, (_, i) => solid(new THREE.OctahedronGeometry(0.15, 0).translate(Math.cos(i * 2.4) * r, y - (i % 2) * 0.4, Math.sin(i * 2.4) * r), c, 2.4));
  // ── 세렌의 나무 (지구 나무가 아니다 — 셋 중 하나가 자리마다 고정으로 정해진다) ──
  // 울림나무: 세 가닥이 꼬여 오른 줄기, 위로 열린 빛 종 셋 (바람이 지나면 우는 종), 늘어진 빛 구슬
  {
    const parts = [
      solid(new THREE.CylinderGeometry(0.8, 0.95, 0.26, 8).translate(0, 0.13, 0), 0x8e8a9c),
      solid(new THREE.TorusGeometry(0.82, 0.035, 3, 16).rotateX(Math.PI / 2).translate(0, 0.28, 0), ACC, 1.5),
    ];
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU;
      parts.push(solid(new THREE.CylinderGeometry(0.06, 0.11, 4.9, 4).translate(0, 2.45, 0).rotateZ(0.09).rotateY(a + 0.6).translate(Math.cos(a) * 0.12, 0.2, Math.sin(a) * 0.12), 0x6f6a8a, 0.04));
    }
    const bell = (x, y, z, r, tilt, ry, c) => [
      solid(new THREE.ConeGeometry(r, r * 1.25, 6, 1, true).rotateX(Math.PI).rotateZ(tilt).rotateY(ry).translate(x, y, z), c, 0.55),
      solid(new THREE.OctahedronGeometry(r * 0.16, 0).translate(x, y - r * 0.2, z), 0xfff4d8, 2.4),
    ];
    parts.push(...bell(0, 5.75, 0, 1.15, 0, 0, 0x8ff0e0), ...bell(0.95, 4.85, 0.2, 0.8, 0.5, 0, 0xc8a8ff), ...bell(-0.7, 5.0, -0.7, 0.75, -0.45, 0.8, 0x9ff6ff));
    for (let i = 0; i < 4; i++) { const a = i * 1.7 + 0.4; parts.push(solid(new THREE.OctahedronGeometry(0.09, 0).translate(Math.cos(a) * 1.1, 3.9 - (i % 2) * 0.5, Math.sin(a) * 1.1), 0xffd27a, 2.4)); }
    P.tree = mergeF(parts);
  }
  // 빛갓나무: 가는 대 위에 층층이 놓인 빛 갓 — 갓 아래가 분홍·청록으로 빛난다, 떠도는 홀씨
  {
    const parts = [
      solid(new THREE.CylinderGeometry(0.75, 0.85, 0.24, 7).translate(0, 0.12, 0), 0x8e8a9c),
      solid(new THREE.CylinderGeometry(0.11, 0.2, 5.6, 5).translate(0, 2.9, 0), 0xd8d0e4, 0.03),
    ];
    [[2.3, 3.3, 0xff9fd0], [1.7, 4.45, 0x7ff3e6], [1.05, 5.45, 0xb9a6ff]].forEach(([r, y, c]) => {
      parts.push(solid(new THREE.CylinderGeometry(r * 0.82, r, 0.2, 7).translate(0, y, 0), 0xe8e2f0));
      parts.push(solid(new THREE.CircleGeometry(r * 0.96, 7).rotateX(Math.PI / 2).translate(0, y - 0.11, 0), c, 1.5));
    });
    for (let i = 0; i < 3; i++) { const a = i * 2.2; parts.push(solid(new THREE.OctahedronGeometry(0.1, 0).translate(Math.cos(a) * 1.6, 2.4 + i * 0.6, Math.sin(a) * 1.6), 0xfff0ff, 2.6)); }
    P.treeB = mergeF(parts);
  }
  // 결정 깃 나무: 둥근 뿌리혹에서 휘어 오르는 결정 깃 일곱, 위에 떠 있는 씨앗 구슬
  {
    const parts = [
      solid(new THREE.CylinderGeometry(0.8, 0.9, 0.24, 7).translate(0, 0.12, 0), 0x8e8a9c),
      solid(new THREE.IcosahedronGeometry(0.62, 0).scale(1, 0.75, 1).translate(0, 0.62, 0), 0x6a5a8a, 0.15),
    ];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU, tilt = 0.32 + (i % 3) * 0.14, h = 2.6 + (i % 2) * 0.9;
      parts.push(solid(new THREE.OctahedronGeometry(0.3, 0).scale(0.38, h, 0.13).translate(0, h * 0.3, 0).rotateZ(-tilt).rotateY(-a).translate(0, 0.7, 0), [0x8ff0ff, 0xc8a8ff, 0xff9fd0][i % 3], 0.75));
    }
    parts.push(solid(new THREE.IcosahedronGeometry(0.26, 0).translate(0.2, 4.6, 0.1), 0xbffcff, 2.6), solid(new THREE.IcosahedronGeometry(0.18, 0).translate(-0.4, 5.3, -0.2), 0xffd27a, 2.6));
    P.treeC = mergeF(parts);
  }
  // 결정 고사리: 분홍·보라 결정 잎이 펼쳐진 외계 식물
  P.fern = mergeF([
    solid(new THREE.CylinderGeometry(0.75, 0.6, 0.6, 8).translate(0, 0.3, 0), 0xb8b2c6),
    ...[0, 1, 2, 3, 4].map((i) => solid(new THREE.OctahedronGeometry(0.35, 0).scale(0.6, 3.2, 0.25).rotateZ(0.45 + (i % 2) * 0.2).rotateY(i * 1.26).translate(0, 1.6, 0), [0xffa8d8, 0xc8a8ff, 0x9ff0ff][i % 3], 0.7)),
  ]);
  // 빛 방울 등: 갈대처럼 휘어 오른 줄기(빛 실이 감아 오름) 끝 위에, 닿지 않고 떠 있는 빛 씨앗과 그 둘레를 도는 고리 둘
  {
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const curve = new THREE.CatmullRomCurve3([V(0, 0.2, 0), V(0.03, 1.8, -0.06), V(0, 3.5, 0.04), V(-0.05, 4.7, 0.32), V(0, 5.35, 0.95)]);
    const fil = [];
    for (let i = 0; i <= 24; i++) { const t = i / 24, p = curve.getPoint(t), a = t * 14; fil.push(p.add(V(Math.cos(a) * 0.1, 0, Math.sin(a) * 0.1))); }
    P.lamp = mergeF([
      solid(new THREE.CylinderGeometry(0.24, 0.34, 0.24, 6).translate(0, 0.12, 0), 0x8e8a9c),
      solid(new THREE.TorusGeometry(0.3, 0.025, 3, 12).rotateX(Math.PI / 2).translate(0, 0.25, 0), ACC, 1.6),
      solid(new THREE.TubeGeometry(curve, 16, 0.075, 5, false), 0xd8d0e4, 0.03),
      solid(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(fil), 30, 0.022, 3, false), ACC, 1.8),
      ...[0, 1, 2].map((i) => solid(new THREE.ConeGeometry(0.06, 0.95, 3).translate(0, 0.47, 0).rotateZ(0.5).rotateY(i * 2.1 + 0.4).translate(0, 0.2, 0), 0x8ff0e0, 0.3)),
      solid(new THREE.OctahedronGeometry(0.28, 1).scale(1, 1.45, 1).translate(0, 6.05, 1.25), 0xfff0d8, 2.6),
      solid(new THREE.TorusGeometry(0.56, 0.022, 3, 16).rotateX(1.25).translate(0, 6.05, 1.25), ACC, 2.0),
      solid(new THREE.TorusGeometry(0.42, 0.018, 3, 14).rotateX(1.9).rotateY(0.8).translate(0, 6.05, 1.25), 0xff9fd0, 1.8),
    ]);
  }
  // 떠 있는 쉼돌: 빛나는 받침 위에 떠 있는 매끈한 조약돌 앉음판 + 휜 등 지느러미
  P.bench = mergeF([
    solid(new THREE.CylinderGeometry(1.0, 1.05, 0.08, 8).scale(1.15, 1, 0.45).translate(0, 0.04, 0), 0x9a96aa),
    solid(new THREE.TorusGeometry(1.0, 0.03, 3, 14).rotateX(Math.PI / 2).scale(1.15, 1, 0.45).translate(0, 0.1, 0), ACC, 1.6),
    solid(new THREE.SphereGeometry(1, 8, 4).scale(1.12, 0.15, 0.36).translate(0, 0.5, 0), 0xe6e0ee),
    solid(new THREE.CylinderGeometry(1.2, 1.2, 0.5, 8, 1, true, -0.62, 1.24).rotateY(Math.PI / 2).scale(0.95, 1, 0.3).translate(0, 0.86, 0.1), 0xd0cad8),
    solid(new THREE.BoxGeometry(1.7, 0.03, 0.03).translate(0, 0.34, 0.3), 0xff9fd0, 1.6),
  ]);
  // 빛 웅덩이 화분: 빛나는 물을 담은 그릇에서 나선 새싹 셋이 오르고 끝이 빛난다
  P.planter = mergeF([
    solid(new THREE.CylinderGeometry(0.95, 0.62, 0.55, 8).translate(0, 0.28, 0), 0xc4bed0),
    solid(new THREE.CircleGeometry(0.86, 8).rotateX(-Math.PI / 2).translate(0, 0.5, 0), 0x5fd8d0, 0.9),
    ...[0, 1, 2].map((i) => solid(new THREE.ConeGeometry(0.07, 1.3, 4).translate(0, 0.65, 0).rotateZ(0.35).rotateY(i * 2.1).translate(Math.cos(i * 2.1) * 0.25, 0.5, Math.sin(i * 2.1) * 0.25), [0x9fd8a8, 0xc8a8ff, 0x8ff0ff][i], 0.3)),
    ...[0, 1, 2].map((i) => solid(new THREE.OctahedronGeometry(0.09, 0).translate(Math.cos(i * 2.1) * 0.65, 1.68, Math.sin(i * 2.1) * 0.65), [0xff9fd0, 0xffd27a, 0xb9a6ff][i], 2.2)),
  ]);
  // 정거장: 휜 지붕, 빛나는 뒷유리, 홀로 표지, 의자
  P.shelter = mergeF([
    solid(new THREE.CylinderGeometry(4.2, 4.2, 3.4, 12, 1, true, -0.5, 1.0).scale(1, 1, 0.45).rotateX(Math.PI / 2).rotateZ(Math.PI / 2).translate(0, 3.0, 0.6), 0xd0cad8),
    solid(new THREE.BoxGeometry(3.6, 2.4, 0.08).translate(0, 1.5, -0.8), 0xbfeff8, 0.55),
    solid(new THREE.BoxGeometry(0.12, 3.0, 0.12).translate(-1.9, 1.5, -0.8), 0x8e8a9c),
    solid(new THREE.BoxGeometry(0.12, 3.0, 0.12).translate(1.9, 1.5, -0.8), 0x8e8a9c),
    solid(new THREE.BoxGeometry(3.0, 0.1, 0.5).translate(0, 0.5, -0.5), 0xc8c2d2),
    solid(new THREE.BoxGeometry(0.9, 0.9, 0.06).translate(2.4, 2.6, 0.2), 0x7ff3e6, 2.2),
    solid(new THREE.CylinderGeometry(0.05, 0.05, 2.8, 4).translate(2.4, 1.4, 0.2), 0x8e8a9c),
    solid(new THREE.BoxGeometry(3.8, 0.04, 0.04).translate(0, 3.5, 1.4), 0x7ff3e6, 2.0),
  ]);
  // 키오스크: 둥근 유리 가게, 지붕 고리
  P.kiosk = mergeF([
    solid(new THREE.CylinderGeometry(2.4, 2.4, 0.2, 14).translate(0, 0.1, 0), 0xb8b2c6),
    solid(new THREE.CylinderGeometry(2.0, 2.0, 2.6, 14, 1, true).translate(0, 1.5, 0), 0xffe2b8, 0.9),
    solid(new THREE.CylinderGeometry(2.6, 2.2, 0.35, 14).translate(0, 2.95, 0), 0xd0cad8),
    solid(new THREE.SphereGeometry(1.6, 12, 4, 0, TAU, 0, Math.PI / 2).scale(1, 0.5, 1).translate(0, 3.1, 0), 0xd8d2e0),
    solid(new THREE.TorusGeometry(2.62, 0.05, 3, 24).rotateX(Math.PI / 2).translate(0, 2.8, 0), 0xff9fd0, 2.2),
    solid(new THREE.BoxGeometry(1.6, 1.0, 0.6).translate(0, 0.9, 2.1), 0xc8c2d2),
    solid(new THREE.TorusGeometry(1.1, 0.04, 3, 16).rotateX(1.3).translate(0, 4.2, 0), ACC, 2.2),
    solid(new THREE.OctahedronGeometry(0.28, 0).translate(0, 4.2, 0), 0xffd27a, 2.4),
  ]);
  // 홀로 기둥: 글자 띠가 흐르는 광고 기둥
  P.pillar = mergeF([
    solid(new THREE.CylinderGeometry(0.55, 0.7, 0.4, 10).translate(0, 0.2, 0), 0x8e8a9c),
    solid(new THREE.CylinderGeometry(0.5, 0.5, 4.2, 12, 6, true).translate(0, 2.5, 0), (x, y) => (Math.floor(y * 2.2) % 2 ? 0x7ff3e6 : 0xff9fd0), (x, y) => (Math.floor(y * 2.2) % 2 ? 1.2 : 0.9)),
    solid(new THREE.TorusGeometry(0.62, 0.05, 3, 16).rotateX(Math.PI / 2).translate(0, 4.7, 0), 0xffd27a, 2.4),
    solid(new THREE.ConeGeometry(0.45, 0.6, 10).translate(0, 5.0, 0), 0xd0cad8),
  ]);
  // 울림 등대: 육각 받침 위 세모 기둥, 떠서 도는 두 빛 고리와 꼭대기 결정 (대로 가운데·상가 거리)
  P.beacon = mergeF([
    solid(new THREE.CylinderGeometry(0.55, 0.62, 0.22, 6).translate(0, 0.11, 0), 0x8e8a9c),
    solid(new THREE.CylinderGeometry(0.12, 0.32, 5.2, 3).translate(0, 2.8, 0), 0xd8d2e4, 0.04),
    solid(new THREE.CylinderGeometry(0.035, 0.035, 4.8, 3).translate(0.2, 2.7, 0), ACC, 1.6),
    solid(new THREE.TorusGeometry(0.62, 0.035, 3, 12).rotateX(Math.PI / 2 + 0.25).translate(0, 3.4, 0), ACC, 2.0),
    solid(new THREE.TorusGeometry(0.45, 0.03, 3, 10).rotateX(Math.PI / 2 - 0.3).translate(0, 4.6, 0), 0xff9fd0, 2.0),
    solid(new THREE.OctahedronGeometry(0.3, 0).scale(1, 1.6, 1).translate(0, 5.9, 0), 0xbffcff, 2.6),
  ]);
  // 볼라드
  P.bollard = mergeF([
    solid(new THREE.CylinderGeometry(0.14, 0.18, 0.9, 6).translate(0, 0.45, 0), 0xa8a4b6),
    solid(new THREE.CylinderGeometry(0.15, 0.15, 0.08, 6).translate(0, 0.86, 0), 0x7ff3e6, 2.4),
  ]);
  // 분수: 둥근 연못 + 겹친 고리 조형 + 빛나는 물
  P.fountain = mergeF([
    solid(new THREE.CylinderGeometry(5.2, 5.4, 0.7, 24, 1, true).translate(0, 0.35, 0), 0xc8c2d2),
    solid(new THREE.TorusGeometry(5.3, 0.25, 4, 28).rotateX(Math.PI / 2).translate(0, 0.72, 0), 0xd8d2e0),
    solid(new THREE.CircleGeometry(5.1, 24).rotateX(-Math.PI / 2).translate(0, 0.5, 0), 0x3f9cc8, 0.8),
    solid(new THREE.CylinderGeometry(0.5, 0.8, 2.4, 10).translate(0, 1.2, 0), 0xd8d2e0),
    ...[0, 1, 2].map((i) => solid(new THREE.TorusGeometry(1.4 - i * 0.35, 0.09, 4, 24).rotateX(Math.PI / 2 + i * 0.35).rotateY(i * 1.1).translate(0, 2.9 + i * 0.7, 0), [0xffd27a, 0x7ff3e6, 0xff9fd0][i], 1.8)),
    solid(new THREE.IcosahedronGeometry(0.35, 1).translate(0, 4.8, 0), 0xbffcff, 2.8),
  ]);
  // 조형물: 받침 위에 서로 꿰인 고리들
  P.sculpt = mergeF([
    solid(new THREE.CylinderGeometry(1.6, 1.9, 0.9, 8).translate(0, 0.45, 0), 0xb8b2c6),
    ...[0, 1, 2].map((i) => solid(new THREE.TorusGeometry(1.6, 0.18, 6, 24).rotateY(i * 1.05).rotateX(0.35).translate(0, 3.0, 0), [0xc9a86c, 0xd8d2e0, 0x7ff3e6][i], i === 2 ? 1.6 : 0.1)),
    solid(new THREE.OctahedronGeometry(0.45, 0).translate(0, 3.0, 0), 0xffd27a, 2.6),
  ]);
  // 정자: 기둥 여섯 + 원반 지붕 + 빛 고리 (공원)
  P.pavilion = mergeF([
    solid(new THREE.CylinderGeometry(5, 5.2, 0.3, 16).translate(0, 0.15, 0), 0xc4bed0),
    ...[0, 1, 2, 3, 4, 5].map((i) => solid(new THREE.CylinderGeometry(0.16, 0.2, 3.6, 6).translate(Math.cos(i * 1.047) * 4.2, 2.1, Math.sin(i * 1.047) * 4.2), 0xc9a86c)),
    solid(new THREE.CylinderGeometry(5.6, 4.8, 0.4, 16).translate(0, 4.1, 0), 0xd8d2e0),
    solid(new THREE.SphereGeometry(3.4, 14, 4, 0, TAU, 0, Math.PI / 2).scale(1, 0.4, 1).translate(0, 4.3, 0), 0xe0dae6),
    solid(new THREE.TorusGeometry(5.62, 0.06, 3, 32).rotateX(Math.PI / 2).translate(0, 3.9, 0), 0x7ff3e6, 2.0),
  ]);
  // 잔디 마당 (공원 바닥): 반지름 1 원판 + 낮은 테 — 옆으로만 키운다(높이 0.3 m 그대로)
  P.lawn = mergeF([
    solid(new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2).translate(0, 0.22, 0), 0x5aa878),
    solid(new THREE.CylinderGeometry(1.0, 1.02, 0.3, 20, 1, true).translate(0, 0.08, 0), 0xc4bed0),
    solid(new THREE.RingGeometry(1.0, 1.06, 20).rotateX(-Math.PI / 2).translate(0, 0.26, 0), 0xd0cad8),
  ]);
  // 광장 바닥: 팔각 포장 + 동심 빛 고리 + 방사 줄눈 (옆으로만 키운다)
  P.plaza = mergeF([
    solid(new THREE.CircleGeometry(1, 8).rotateX(-Math.PI / 2).translate(0, 0.16, 0), 0xc8c2d0),
    solid(new THREE.CylinderGeometry(1.0, 1.02, 0.22, 8, 1, true).translate(0, 0.05, 0), 0xa8a2b6),
    solid(new THREE.RingGeometry(0.8, 0.98, 8).rotateX(-Math.PI / 2).translate(0, 0.2, 0), 0xa9a3b8),
    solid(new THREE.RingGeometry(0.6, 0.615, 32).rotateX(-Math.PI / 2).translate(0, 0.22, 0), 0x7ff3e6, 1.6),
    solid(new THREE.RingGeometry(0.34, 0.35, 24).rotateX(-Math.PI / 2).translate(0, 0.22, 0), 0xffd27a, 1.4),
    ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => solid(new THREE.PlaneGeometry(0.012, 0.42).rotateX(-Math.PI / 2).translate(0, 0.21, 0.57).rotateY(i * 0.785 + 0.39), 0x8e889c)),
  ]);
  // ── 블록 템플릿 소품 ──
  // 놀이터: 빛 격자 돔(오르기) + 미끄럼틀 + 도는 원판 + 고무 바닥
  P.play = mergeF([
    solid(new THREE.CylinderGeometry(4.2, 4.2, 0.08, 20).translate(0, 0.04, 0), 0xc86a5a),
    ...[0, 1, 2, 3].map((i) => solid(new THREE.TorusGeometry(2.4, 0.07, 4, 18, Math.PI).rotateY(i * 0.785).translate(0, 0.05, 0), [0xffc46a, 0x7ff3e6, 0xff9fd0, 0xb9a6ff][i], 0.5)),
    solid(new THREE.TorusGeometry(1.7, 0.06, 4, 18).rotateX(Math.PI / 2).translate(0, 1.6, 0), 0xffffff, 0.3),
    solid(new THREE.BoxGeometry(0.9, 0.06, 3.2).rotateX(0.55).translate(3.0, 0.95, 0), 0xffc46a, 0.2),
    solid(new THREE.BoxGeometry(0.9, 1.9, 0.9).translate(3.0, 0.95, -1.75), 0xd8d2e0),
    solid(new THREE.CylinderGeometry(1.1, 1.1, 0.12, 14).translate(-2.9, 0.5, 1.6), 0x7ff3e6, 0.6),
    solid(new THREE.CylinderGeometry(0.08, 0.08, 0.5, 6).translate(-2.9, 0.25, 1.6), STEEL),
  ]);
  // 빛 기둥(가로등보다 높은 광장 조명)
  P.mast = mergeF([
    solid(new THREE.CylinderGeometry(0.28, 0.36, 0.5, 8).translate(0, 0.25, 0), 0x8e8a9c),
    solid(new THREE.CylinderGeometry(0.1, 0.16, 8.6, 6).translate(0, 4.5, 0), 0xc8c2d4),
    solid(new THREE.OctahedronGeometry(0.42, 0).scale(1, 1.6, 1).translate(0, 9.0, 0), 0xfff0d8, 2.4),
    solid(new THREE.TorusGeometry(0.5, 0.04, 3, 14).rotateX(Math.PI / 2).translate(0, 8.2, 0), ACC, 2.0),
  ]);
  // 기념탑: 돌 받침 + 꼬인 세 기둥 + 떠 있는 빛 고리
  P.monument = mergeF([
    solid(new THREE.CylinderGeometry(2.6, 3.0, 1.0, 12).translate(0, 0.5, 0), 0xb8b2c6),
    ...[0, 1, 2].map((i) => solid(new THREE.CylinderGeometry(0.22, 0.5, 13, 6).translate(0.9, 7.5, 0).rotateY((i * Math.PI * 2) / 3).rotateY(0), 0xd8d2e0)),
    solid(new THREE.TorusGeometry(1.6, 0.1, 4, 28).rotateX(Math.PI / 2 - 0.2).translate(0, 11.5, 0), 0xffd27a, 2.0),
    solid(new THREE.TorusGeometry(1.1, 0.07, 4, 24).rotateX(Math.PI / 2 + 0.3).translate(0, 9.5, 0), ACC, 2.0),
    solid(new THREE.OctahedronGeometry(0.6, 0).translate(0, 14.6, 0), 0xbffcff, 2.8),
  ]);
  // 장터 노점: 판매대 + 네 기둥 + 색 천막 + 진열된 빛 열매
  P.stall = mergeF([
    solid(new THREE.BoxGeometry(2.8, 0.95, 1.1).translate(0, 0.48, 0), 0xc8c2d2),
    solid(new THREE.BoxGeometry(2.9, 0.06, 1.2).translate(0, 0.98, 0), GOLD),
    ...[[-1.35, -0.5], [1.35, -0.5], [-1.35, 0.5], [1.35, 0.5]].map(([x, z]) => solid(new THREE.CylinderGeometry(0.05, 0.05, 2.5, 4).translate(x, 1.25, z), STEEL)),
    solid(new THREE.CylinderGeometry(1.0, 1.0, 3.1, 8, 1, true, -Math.PI / 2, Math.PI).rotateZ(Math.PI / 2).scale(1, 0.4, 0.8).translate(0, 2.5, 0), 0xff9fd0, 0.35),
    ...[0, 1, 2, 3, 4].map((i) => solid(new THREE.IcosahedronGeometry(0.16, 0).translate(-1 + i * 0.5, 1.14, 0.2), [0xffc46a, 0x7ff3e6, 0xff9fd0, 0xb9a6ff, 0xffffff][i], 1.2)),
  ]);
  // 짐 상자 더미 (물류·산업): 색 다른 상자 셋이 쌓인다
  P.crates = mergeF([
    solid(new THREE.BoxGeometry(2.9, 1.25, 2.3).translate(0, 0.63, 0), 0x6f8fb0),
    solid(new THREE.BoxGeometry(2.9, 1.25, 2.3).translate(0.05, 1.9, 0), 0xc89060),
    solid(new THREE.BoxGeometry(2.92, 0.06, 2.32).translate(0, 1.27, 0), ACC, 1.0),
    solid(new THREE.BoxGeometry(2.92, 0.06, 2.32).translate(0.05, 2.54, 0), 0xffc46a, 0.8),
  ]);
  // 짐 호버차 (세워 둔 것): 긴 몸통 + 짐칸 + 아래 빛
  P.cargo = mergeF([
    solid(new THREE.BoxGeometry(2.2, 1.6, 5.0).translate(0, 1.3, 0), 0xd0cad8),
    solid(new THREE.BoxGeometry(2.0, 0.9, 1.4).translate(0, 1.0, 3.0), 0xe8e4ee),
    solid(new THREE.BoxGeometry(1.8, 0.4, 0.06).translate(0, 1.2, 3.72), 0x3a4458, 0.4),
    solid(new THREE.BoxGeometry(2.0, 0.05, 4.6).translate(0, 0.45, 0), ACC, 1.4),
    ...[[-0.9, -1.8], [0.9, -1.8], [-0.9, 1.8], [0.9, 1.8]].map(([x, z]) => solid(new THREE.CylinderGeometry(0.1, 0.18, 0.5, 5).translate(x, 0.25, z), STEEL)),
  ]);
  // 관 다리: 두 받침대 위로 굵은 관 셋 (x 로 늘인다)
  P.piperack = mergeF([
    ...[-4.6, 4.6].map((x) => solid(new THREE.BoxGeometry(0.4, 6.2, 0.4).translate(x, 3.1, 0), STEEL)),
    ...[-4.6, 4.6].map((x) => solid(new THREE.BoxGeometry(0.4, 0.3, 2.0).translate(x, 6.0, 0), STEEL)),
    ...[[-0.6, 0x9aa4b2, 0], [0, 0xc89060, 0], [0.6, ACC, 1.0]].map(([z, c, e]) => solid(new THREE.CylinderGeometry(0.22, 0.22, 10, 8).rotateZ(Math.PI / 2).translate(0, 6.4, z), c, e)),
  ]);
  // 드론 착륙판
  P.pad = mergeF([
    solid(new THREE.CylinderGeometry(4.0, 4.2, 0.18, 24).translate(0, 0.09, 0), 0x5a5868),
    solid(new THREE.TorusGeometry(3.4, 0.08, 3, 32).rotateX(Math.PI / 2).translate(0, 0.2, 0), ACC, 2.0),
    solid(new THREE.BoxGeometry(2.4, 0.03, 0.3).translate(0, 0.2, 0), 0xffc46a, 1.2),
    solid(new THREE.BoxGeometry(0.3, 0.03, 2.4).translate(0, 0.2, 0), 0xffc46a, 1.2),
  ]);
  // 변전 장치: 상자 + 냉각 날개 + 위의 절연 고리
  P.transformer = mergeF([
    solid(new THREE.BoxGeometry(2.2, 2.2, 1.6).translate(0, 1.1, 0), 0x8e98a8),
    ...[-0.8, -0.4, 0, 0.4, 0.8].map((x) => solid(new THREE.BoxGeometry(0.06, 1.8, 2.0).translate(x, 1.1, 0), 0x6e7888)),
    ...[-0.6, 0, 0.6].map((x) => solid(new THREE.CylinderGeometry(0.12, 0.12, 0.9, 6).translate(x, 2.65, 0), 0xd8d2e0)),
    ...[-0.6, 0, 0.6].map((x) => solid(new THREE.TorusGeometry(0.16, 0.04, 3, 8).rotateX(Math.PI / 2).translate(x, 3.05, 0), ACC, 1.8)),
  ]);
  // 울림 집광판: 기둥 위 기울어진 판 (빛 결)
  P.collector = mergeF([
    solid(new THREE.CylinderGeometry(0.1, 0.16, 1.4, 5).translate(0, 0.7, 0), STEEL),
    solid(new THREE.BoxGeometry(2.2, 0.08, 1.3).rotateX(-0.5).translate(0, 1.6, 0), 0x22304a, 0.25),
    solid(new THREE.BoxGeometry(2.24, 0.03, 0.05).rotateX(-0.5).translate(0, 1.66, -0.3), ACC, 1.4),
  ]);
  // 관측 접시
  P.dish = mergeF([
    solid(new THREE.CylinderGeometry(0.9, 1.1, 1.2, 10).translate(0, 0.6, 0), 0xc8c2d2),
    solid(new THREE.CylinderGeometry(0.15, 0.15, 1.2, 6).translate(0, 1.8, 0), STEEL),
    solid(new THREE.SphereGeometry(2.2, 14, 4, 0, TAU, 0, 0.9).scale(1, 0.45, 1).rotateX(Math.PI).rotateX(-0.7).translate(0, 2.8, 0.2), 0xe8e4ee),
    solid(new THREE.OctahedronGeometry(0.16, 0).translate(0, 3.4, 1.2), ACC, 2.4),
  ]);
  // 정류장 지붕 (교통 블록): 긴 지붕 + 기둥 + 의자 + 노선 빛판
  P.platform = mergeF([
    solid(new THREE.BoxGeometry(8.4, 0.2, 3.0).translate(0, 3.2, 0), 0xd0cad8),
    solid(new THREE.BoxGeometry(8.4, 0.05, 0.08).translate(0, 3.08, 1.5), ACC, 1.8),
    ...[-3.9, 3.9].map((x) => solid(new THREE.CylinderGeometry(0.1, 0.12, 3.2, 6).translate(x, 1.6, -1.0), STEEL)),
    solid(new THREE.BoxGeometry(6, 0.1, 0.5).translate(0, 0.5, -1.0), 0xc8c2d2),
    solid(new THREE.BoxGeometry(1.2, 0.9, 0.06).translate(3.0, 2.2, -1.2), 0x7ff3e6, 1.6),
  ]);
  // 바깥 조작대: 들어갈 수 없는 건물 발치의 빛 기둥 (육각 받침 + 기운 화면 + 떠 있는 결정). 앞이 +z
  P.console = mergeF([
    solid(new THREE.CylinderGeometry(0.46, 0.55, 0.16, 6).translate(0, 0.08, 0), 0x8e8a9c),
    solid(new THREE.TorusGeometry(0.5, 0.03, 3, 18).rotateX(Math.PI / 2).translate(0, 0.17, 0), ACC, 1.8),
    solid(new THREE.CylinderGeometry(0.1, 0.2, 1.05, 6).translate(0, 0.68, -0.05), 0xe8e2f0),
    solid(new THREE.BoxGeometry(0.86, 0.56, 0.07).rotateX(-0.62).translate(0, 1.22, 0.06), 0x2a2838),
    solid(new THREE.PlaneGeometry(0.74, 0.44).rotateX(-0.62).translate(0, 1.23, 0.105), 0x7ff3e6, 1.5),
    solid(new THREE.BoxGeometry(0.9, 0.04, 0.04).translate(0, 1.0, 0.24), 0xffd27a, 2.0),
    solid(new THREE.OctahedronGeometry(0.15, 0).scale(1, 1.5, 1).translate(0, 1.95, 0), 0xffd27a, 2.6),
    solid(new THREE.TorusGeometry(0.24, 0.02, 3, 14).rotateX(Math.PI / 2 - 0.3).translate(0, 1.95, 0), ACC, 2.0),
  ]);
  // 세워 둔 호버 차 (길이 4.4 m)
  P.pod = mergeF([
    solid(new THREE.OctahedronGeometry(1, 1).scale(0.95, 0.5, 2.3).translate(0, 0.85, 0), 0xe6e0ee),
    solid(new THREE.OctahedronGeometry(1, 1).scale(0.7, 0.32, 1.1).translate(0, 1.2, -0.2), 0x2a3448, 0.3),
    solid(new THREE.BoxGeometry(1.0, 0.12, 0.05).translate(0, 0.9, 2.2), 0xffffff, 1.2),
    solid(new THREE.BoxGeometry(1.6, 0.04, 3.6).translate(0, 0.32, 0), ACC, 1.2),
  ]);
  return P;
}

// 소품 충돌 (미터, 배율 1): ['c', x, z, r, y0, y1] / ['b', x, z, hx, hz, y0, y1]. walk: 위에 설 수 있나
export const PROPCOL = {
  tree: [['c', 0, 0, 0.32, 0, 4.2], ['c', 0, 0, 0.95, 0, 0.26]],
  treeB: [['c', 0, 0, 0.3, 0, 5.4], ['c', 0, 0, 0.85, 0, 0.24]],
  treeC: [['c', 0, 0, 0.7, 0, 1.2], ['c', 0, 0, 0.9, 0, 0.24]],
  fern: [['c', 0, 0, 0.7, 0, 0.6]],
  lamp: [['c', 0, 0, 0.22, 0, 6.2]],
  bench: [['b', 0, 0, 1.1, 0.32, 0, 0.5]],
  planter: [['c', 0, 0, 0.9, 0, 0.75]],
  shelter: [['b', 0, -0.8, 1.9, 0.12, 0, 3.4], ['b', 0, 0.5, 2.1, 1.6, 2.9, 3.4], ['b', 0, 0.5, 1.9, 1.2, 3.4, 4.7]], // 휜 지붕까지
  kiosk: [['c', 0, 0, 2.1, 0, 2.8], ['c', 0, 0, 2.6, 2.8, 3.12], ['c', 0, 0, 1.6, 3.1, 3.9, 0.8]], // 몸통 · 지붕 판 · 지붕의 둥근 꼭지
  pillar: [['c', 0, 0, 0.62, 0, 5.2]],
  bollard: [['c', 0, 0, 0.18, 0, 0.9]],
  beacon: [['c', 0, 0, 0.5, 0, 6.2]],
  fountain: [['c', 0, 0, 5.4, 0, 0.75], ['c', 0, 0, 0.8, 0, 2.6], ['c', 0, 0, 1.4, 2.6, 4.4]], // 떠 있는 고리 조형까지
  sculpt: [['c', 0, 0, 1.9, 0, 0.9], ['c', 0, 0, 0.5, 0.9, 3.5], ['c', 0, 0, 1.6, 2.3, 3.7]], // 꿰인 고리들
  pavilion: [...[0, 1, 2, 3, 4, 5].map((i) => ['c', Math.cos(i * 1.047) * 4.2, Math.sin(i * 1.047) * 4.2, 0.2, 0, 3.9]), ['c', 0, 0, 5.6, 3.9, 4.4], ['c', 0, 0, 3.4, 4.3, 5.66, 1.36]],
  play: [['c', 0, 0, 2.5, 0, 1.7], ['b', 3.0, -1.75, 0.45, 0.45, 0, 1.9]],
  mast: [['c', 0, 0, 0.3, 0, 9]],
  monument: [['c', 0, 0, 3.0, 0, 1.0], ['c', 0, 0, 1.4, 1.0, 14]],
  stall: [['b', 0, 0, 1.45, 0.58, 0, 1.0], ['b', 0, 0, 1.55, 0.7, 2.3, 2.95]], // 판매대 · 천막
  crates: [['b', 0, 0, 1.5, 1.2, 0, 2.6]],
  cargo: [['b', 0, 0.5, 1.15, 3.1, 0, 2.1]],
  piperack: [['b', -4.6, 0, 0.25, 0.25, 0, 6.6], ['b', 4.6, 0, 0.25, 0.25, 0, 6.6], ['b', 0, 0, 5, 0.9, 6.15, 6.65]],
  pad: [],
  transformer: [['b', 0, 0, 1.1, 1.0, 0, 3.1]],
  collector: [['c', 0, 0, 0.18, 0, 1.4], ['b', 0, 0, 1.1, 0.6, 1.3, 1.9]],
  dish: [['c', 0, 0, 1.1, 0, 1.8], ['c', 0, 0, 2.0, 2.4, 3.2]],
  platform: [['c', -3.9, -1.0, 0.13, 0, 3.2], ['c', 3.9, -1.0, 0.13, 0, 3.2], ['b', 0, 0, 4.2, 1.5, 3.1, 3.3], ['b', 0, -1.0, 3.0, 0.25, 0, 0.55]],
  pod: [['b', 0, 0, 0.95, 2.2, 0, 1.4]],
  console: [['c', 0, 0, 0.42, 0, 1.5]],
};
