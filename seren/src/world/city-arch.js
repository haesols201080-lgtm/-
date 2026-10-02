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
        if (hi) P.push(solid(new THREE.TorusGeometry(r * 0.7, 0.01, 3, 24).rotateX(Math.PI / 2).translate(0, y + 0.003, 0), 0xffd27a, 2.0), band(disc, y - 0.012, 0.01, r * 1.005, ACC, 1.6));
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

/** 건물 입구: 빛의 막이 드리운 문틀 + 차양 + 문턱 (로컬: x 가 벽을 따라, +z 가 바깥) */
export function doorGeo() {
  return mergeF([
    solid(new THREE.BoxGeometry(0.35, 4.0, 0.5).translate(-1.75, 2.0, 0.1), PEARL),
    solid(new THREE.BoxGeometry(0.35, 4.0, 0.5).translate(1.75, 2.0, 0.1), PEARL),
    solid(new THREE.BoxGeometry(3.85, 0.4, 0.5).translate(0, 4.2, 0.1), PEARL),
    solid(new THREE.BoxGeometry(5.2, 0.14, 2.6).translate(0, 4.55, 1.1), PEARL2),
    solid(new THREE.BoxGeometry(5.0, 0.06, 0.08).translate(0, 4.5, 2.38), ACC, 2.0),
    solid(new THREE.BoxGeometry(4.4, 0.12, 2.4).translate(0, 0.06, 1.0), 0xb8b2c4),
    solid(new THREE.PlaneGeometry(3.1, 3.95).translate(0, 2.0, 0.05), 0x5fb4c8, 0.32), // 문 유리: 밤에 눈부시지 않게
    solid(new THREE.BoxGeometry(0.08, 3.8, 0.08).translate(-1.55, 2.0, 0.38), ACC, 1.8),
    solid(new THREE.BoxGeometry(0.08, 3.8, 0.08).translate(1.55, 2.0, 0.38), ACC, 1.8),
  ]);
}

// ── 거리의 작은 것들 (단위: 미터, 인스턴스 배율 1 기준) ─────────────────
export function propArchetypes() {
  const P = {};
  const bulbs = (n, r, y, c = 0xffd27a) => Array.from({ length: n }, (_, i) => solid(new THREE.OctahedronGeometry(0.15, 0).translate(Math.cos(i * 2.4) * r, y - (i % 2) * 0.4, Math.sin(i * 2.4) * r), c, 2.4));
  // 등불 나무: 원형 틀 + 줄기 + 두 겹 수관 + 매달린 빛 방울
  P.tree = mergeF([
    solid(new THREE.CylinderGeometry(1.0, 1.0, 0.25, 8).translate(0, 0.12, 0), 0x8e8a9c),
    solid(new THREE.CylinderGeometry(0.12, 0.2, 4.4, 5).translate(0, 2.2, 0), 0x5a4a58),
    solid(new THREE.IcosahedronGeometry(2.0, 0).scale(1, 0.62, 1).translate(0, 4.8, 0), 0x3a8e70, 0.12),
    solid(new THREE.IcosahedronGeometry(1.35, 0).scale(1, 0.7, 1).translate(0.7, 5.6, -0.3), 0x55b48c, 0.18),
    ...bulbs(5, 1.5, 3.9),
  ]);
  // 결정 고사리: 분홍·보라 결정 잎이 펼쳐진 외계 식물
  P.fern = mergeF([
    solid(new THREE.CylinderGeometry(0.75, 0.6, 0.6, 8).translate(0, 0.3, 0), 0xb8b2c6),
    ...[0, 1, 2, 3, 4].map((i) => solid(new THREE.OctahedronGeometry(0.35, 0).scale(0.6, 3.2, 0.25).rotateZ(0.45 + (i % 2) * 0.2).rotateY(i * 1.26).translate(0, 1.6, 0), [0xffa8d8, 0xc8a8ff, 0x9ff0ff][i % 3], 0.7)),
  ]);
  // 가로등: 가는 기둥, 휜 팔, 빛나는 머리, 빛 고리
  P.lamp = mergeF([
    solid(new THREE.CylinderGeometry(0.22, 0.28, 0.35, 6).translate(0, 0.17, 0), 0x8e8a9c),
    solid(new THREE.CylinderGeometry(0.06, 0.1, 6.2, 5).translate(0, 3.1, 0), 0xbcb8c8),
    solid(new THREE.BoxGeometry(0.08, 0.08, 1.4).translate(0, 6.1, 0.65), 0xbcb8c8),
    solid(new THREE.CylinderGeometry(0.28, 0.12, 0.18, 8).translate(0, 5.98, 1.3), 0xfff0d8, 2.6),
    solid(new THREE.TorusGeometry(0.18, 0.03, 3, 10).rotateX(Math.PI / 2).translate(0, 2.4, 0), 0x7ff3e6, 2.0),
  ]);
  // 벤치: 휜 앉음판 + 등받이 + 빛줄
  P.bench = mergeF([
    solid(new THREE.BoxGeometry(2.2, 0.1, 0.6).translate(0, 0.46, 0), 0xc8c2d2),
    solid(new THREE.BoxGeometry(2.2, 0.5, 0.08).rotateX(-0.2).translate(0, 0.78, -0.3), 0xc8c2d2),
    solid(new THREE.BoxGeometry(0.12, 0.42, 0.5).translate(-0.9, 0.21, 0), 0x8e8a9c),
    solid(new THREE.BoxGeometry(0.12, 0.42, 0.5).translate(0.9, 0.21, 0), 0x8e8a9c),
    solid(new THREE.BoxGeometry(2.0, 0.03, 0.03).translate(0, 0.4, 0.31), 0x7ff3e6, 1.8),
  ]);
  // 화분: 둥근 화분 + 덤불 + 꽃
  P.planter = mergeF([
    solid(new THREE.CylinderGeometry(0.9, 0.75, 0.7, 10).translate(0, 0.35, 0), 0xc4bed0),
    solid(new THREE.IcosahedronGeometry(0.85, 0).scale(1, 0.6, 1).translate(0, 0.95, 0), 0x4fa07c, 0.1),
    ...[0, 1, 2].map((i) => solid(new THREE.OctahedronGeometry(0.12, 0).translate(Math.cos(i * 2.1) * 0.5, 1.3, Math.sin(i * 2.1) * 0.5), [0xff9fd0, 0xffd27a, 0xb9a6ff][i], 2)),
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
  ]);
  // 홀로 기둥: 글자 띠가 흐르는 광고 기둥
  P.pillar = mergeF([
    solid(new THREE.CylinderGeometry(0.55, 0.7, 0.4, 10).translate(0, 0.2, 0), 0x8e8a9c),
    solid(new THREE.CylinderGeometry(0.5, 0.5, 4.2, 12, 6, true).translate(0, 2.5, 0), (x, y) => (Math.floor(y * 2.2) % 2 ? 0x7ff3e6 : 0xff9fd0), (x, y) => (Math.floor(y * 2.2) % 2 ? 1.2 : 0.9)),
    solid(new THREE.TorusGeometry(0.62, 0.05, 3, 16).rotateX(Math.PI / 2).translate(0, 4.7, 0), 0xffd27a, 2.4),
    solid(new THREE.ConeGeometry(0.45, 0.6, 10).translate(0, 5.0, 0), 0xd0cad8),
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
  return P;
}
