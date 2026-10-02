// 도시 건물 모양 모음 (반지름 약 1, 높이 1 단위 — 인스턴스가 늘이고 줄인다).
// 모든 면에 fac 속성 = [둘레를 따라 잰 거리, 외벽 종류] 을 넣어, 셰이더(litMaterial facade)가
// 어떤 모양에서도 곧은 멀리언·층 띠·방마다의 불빛을 그린다.
//   외벽 종류: 0 없음(지붕·장식) 1 유리 커튼월 2 띠창 3 점창 4 첨탑(나선 빛)
// 각 모양은 { hi, lo } — hi 는 가까이서(1~2 km), lo 는 멀리서(실루엣만 같게).
import * as THREE from 'three';

const GOLD = 0xe9c27c, PEARL = 0xf1ece4, PEARL2 = 0xdcd6e2, STEEL = 0xa9b4c2, GARDEN = 0x8fc89a;
const ACC = 0x7ff3e6;
const TAU = Math.PI * 2;
const _c = new THREE.Color();

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
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    _c.set(typeof color === 'function' ? color(x, y, z) : color);
    col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b;
    em[i] = typeof emit === 'function' ? emit(x, y, z) : emit;
    fac[i * 2] = fu ? fu.getX(i) : 0;
    fac[i * 2 + 1] = typeof type === 'function' ? type(x, y, z) : type;
  }
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('emit', new THREE.BufferAttribute(em, 1));
  g.setAttribute('fac', new THREE.BufferAttribute(fac, 2));
  return g;
}

/** three 기본 도형에 칠하기 (외벽 없음) */
export function solid(geo, color = PEARL, emit = 0) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (!g.attributes.normal) g.computeVertexNormals();
  return paint(g, color, emit, 0);
}

export function mergeF(parts) {
  let n = 0;
  for (const p of parts) n += p.attributes.position.count;
  const out = { position: new Float32Array(n * 3), normal: new Float32Array(n * 3), color: new Float32Array(n * 3), emit: new Float32Array(n), fac: new Float32Array(n * 2) };
  let o = 0;
  for (const p of parts) {
    const c = p.attributes.position.count;
    out.position.set(p.attributes.position.array, o * 3);
    out.normal.set(p.attributes.normal.array, o * 3);
    out.color.set(p.attributes.color.array, o * 3);
    out.emit.set(p.attributes.emit.array, o);
    out.fac.set(p.attributes.fac.array, o * 2);
    o += c;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(out.position, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(out.normal, 3));
  g.setAttribute('color', new THREE.BufferAttribute(out.color, 3));
  g.setAttribute('emit', new THREE.BufferAttribute(out.emit, 1));
  g.setAttribute('fac', new THREE.BufferAttribute(out.fac, 2));
  g.computeBoundingSphere();
  return g;
}

export const ring = (y, pts, opt = {}) => ({ y, pts, ...opt });
/** 바깥으로 살짝 튀어나온 층판(띠) */
function band(pts, y, h, out = 1.05, color = PEARL, emit = 0, base = {}) {
  return loft([ring(y, pts, { ...base, s: (base.s ?? 1) * out }), ring(y + h, pts, { ...base, s: (base.s ?? 1) * out })], { color, emit, type: 0, smooth: false });
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
        if (hi) P.push(band(pts, h - 0.01, 0.012, 1.0, ACC, 1.8, { dx: x, s: 0.92 }));
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
      if (hi) P.push(band(roofPts, 0.9, 0.012, 1.0, ACC, 1.4, { dx: 0.25, dz: 0.15, rot: 0.3 }));
      return mergeF(P);
    };
    A.villa = { hi: make(12, true), lo: make(4, false) };
  }

  // 기단: 탑 밑을 잇는 블록 (띠창 + 옥상 정원 + 빛 난간)
  {
    const make = (hi) => {
      const pts = squircle(4, Math.SQRT2, Math.SQRT2, 2, 0);
      const P = [loft([ring(0, pts), ring(1, pts)], { color: (x, y) => (y < 0.01 ? GOLD : PEARL), type: 2, smooth: false }), cap(ring(1, pts), { color: (x, y, z) => (Math.abs(x) < 0.7 && Math.abs(z) < 0.6 ? GARDEN : 0xc8c2d2) })];
      if (hi) P.push(band(pts, 0.96, 0.03, 1.005, ACC, 1.2));
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
      for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) P.push(solid(new THREE.CylinderGeometry(0.05, 0.06, 0.5, 4).translate(sx * 0.6, 0.25, sz * 0.6), GOLD));
      P.push(loft([ring(0.48, pts), ring(0.53, pts)], { color: PEARL, type: 0, smooth: false }), cap(ring(0.53, pts), { color: PEARL2 }), cap(ring(0.48, pts), { color: PEARL2, down: true }));
      P.push(loft([ring(0.53, pts, { s: 0.72 }), ring(0.82, pts, { s: 0.74 })], { color: PEARL, type: 3 }));
      P.push(loft([ring(0.82, pts, { s: 0.9 }), ring(1, pts, { s: 0.05 })], { color: (x, y) => (y > 0.97 ? GOLD : 0xd8f0f4), type: 0 }));
      if (hi) P.push(band(pts, 0.5, 0.015, 1.02, ACC, 1.6));
      return mergeF(P);
    };
    A.stilt = { hi: make(12, true), lo: make(6, false) };
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
  return A;
}

// 모양별 크기 규칙: (발 반지름 rr, 구역 높이 h, rnd) → [sx, sy, sz, 원통 충돌 반지름 배율(0 이면 상자), 지붕 높이 배율, 상자 반폭 배율]
export const SIZE = {
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

/** 건물 입구: 빛의 막이 드리운 문틀 + 차양 + 문턱 (로컬: x 가 벽을 따라, +z 가 바깥) */
export function doorGeo() {
  return mergeF([
    solid(new THREE.BoxGeometry(0.35, 4.0, 0.5).translate(-1.75, 2.0, 0.1), PEARL),
    solid(new THREE.BoxGeometry(0.35, 4.0, 0.5).translate(1.75, 2.0, 0.1), PEARL),
    solid(new THREE.BoxGeometry(3.85, 0.4, 0.5).translate(0, 4.2, 0.1), PEARL),
    solid(new THREE.BoxGeometry(5.2, 0.14, 2.6).translate(0, 4.55, 1.1), PEARL2),
    solid(new THREE.BoxGeometry(5.0, 0.06, 0.08).translate(0, 4.5, 2.38), ACC, 2.0),
    solid(new THREE.BoxGeometry(4.4, 0.12, 2.4).translate(0, 0.06, 1.0), 0xb8b2c4),
    solid(new THREE.PlaneGeometry(3.1, 3.95).translate(0, 2.0, 0.05), 0xbff8ff, 1.1),
    solid(new THREE.BoxGeometry(0.08, 3.8, 0.08).translate(-1.55, 2.0, 0.38), ACC, 1.8),
    solid(new THREE.BoxGeometry(0.08, 3.8, 0.08).translate(1.55, 2.0, 0.38), ACC, 1.8),
  ]);
}
