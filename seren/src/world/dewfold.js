// 이슬터: 빛갈대 들판의 정원 마을 — 착륙한 뒤 이엘을 따라 처음 들어서는 아웬의 마을.
// 들판의 안개에서 이슬을 거두어 사는 마을이라, 모든 것이 물과 빛을 모으는 모양이다:
//   가운데 노래 우물 광장(물을 품은 연못 + 세 갈래 갈비 기둥이 받친 빛 핵 + 도는 고리) → 연못에서 뻗는 물길과 끝의 작은 못
//   → 꽃잎 지붕 집(겹친 꽃잎 사이로 속 등불이 보인다)·이슬 탑(꼭대기 깔때기가 이슬을 모은다) → 바깥의 이슬 돛(안개 거두는 돛대)
//   → 들판 쪽 관문(두 갈래 기둥 + 매달린 종 고리). 관문 앞길은 마을의 대로로 이어지고, 대로 끝에서 착륙선까지 길잡이 등이 선다.
// 뒤쪽엔 디딤 잎(줄기 위 잎 발판)을 밟고 오르는 전망 잎이 있다.
// structures.js 의 _village 가 부른다. S = Structures (땅 높이·충돌체·메시·움직임 목록).
import * as THREE from 'three';
import { part, xf, lathe, tube } from './geo-utils.js';
import { mulberry32 } from '../core/noise.js';
import * as A from './arch.js';
import { glowMaterial, litMaterial } from './materials.js';
import { ZONES, ZGEO } from '../data/city.js';
import { PLACE } from '../data/places.js';

const P = A.PAL;
const TAU = Math.PI * 2;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const mix = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), Math.max(0, Math.min(1, t))).getHex();

// ── 모양 ─────────────────────────────────
/** 꽃잎 지붕 집 (원점 = 바닥 가운데, 문 = 로컬 +z) */
function petalHouse({ r = 5, h = 7, seed = 1, glow = P.amber, petals = 7 } = {}) {
  const rnd = mulberry32(seed);
  const L = [];
  L.push(part(lathe([[r * 0.98, 0], [r * 1.05, 0.28], [r * 1.03, h * 0.2], [r, h * 0.42], [r * 0.96, h * 0.5]], 22), (x, y) => (y < 0.32 ? P.gold : mix(P.pearl, P.pearl2, y / h)), 0));
  // 둥근 창 (문 자리는 비운다) + 금빛 창틀
  const nw = 7;
  for (let i = 0; i < nw; i++) {
    const a = ((i + 0.5) / nw) * TAU;
    if (Math.abs(wrap(a)) < 0.62) continue;
    L.push(part(xf(new THREE.CircleGeometry(r * 0.12, 12), { x: Math.sin(a) * r * 1.035, z: Math.cos(a) * r * 1.035, y: h * 0.27, ry: a, sy: 1.55 }), glow, 1.1));
    L.push(part(xf(new THREE.TorusGeometry(r * 0.125, 0.045, 4, 14), { x: Math.sin(a) * r * 1.04, z: Math.cos(a) * r * 1.04, y: h * 0.27, ry: a, sy: 1.55 }), P.gold, 0.2));
  }
  L.push(part(xf(new THREE.TorusGeometry(r * 0.985, 0.09, 4, 36), { y: h * 0.48, rx: Math.PI / 2 }), P.gold, 0.3));
  // 속 등불: 꽃잎 사이로 따뜻하게 보인다
  L.push(part(lathe([[r * 0.94, h * 0.46], [r * 0.86, h * 0.7], [r * 0.5, h * 0.93], [0.0001, h * 1.01]], 18), 0xffe2bc, 0.6));
  // 꽃잎 지붕: 봉오리처럼 모인 꽃잎, 끝이 조금 젖혀진다
  const prof = [[r * 1.0, h * 0.44], [r * 1.16, h * 0.58], [r * 1.07, h * 0.77], [r * 0.74, h * 0.95], [r * 0.34, h * 1.08], [r * 0.1, h * 1.14]];
  const tw = rnd() * 0.5;
  for (let i = 0; i < petals; i++) {
    const a0 = (i / petals) * TAU + tw, w = (TAU / petals) * 0.84;
    const g = new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 7, a0, w);
    // 꽃잎 가운데가 살짝 부풀고 가장자리는 안으로 — 한 장 한 장이 읽히게
    const pos = g.attributes.position;
    for (let k = 0; k < pos.count; k++) {
      const x = pos.getX(k), z = pos.getZ(k), y = pos.getY(k);
      const ang = Math.atan2(x, z), u = Math.abs(wrap(ang - (a0 + w / 2))) / (w / 2);
      const bulge = 1 + 0.05 * (1 - u * u) * Math.sin(Math.PI * Math.min(1, (y - h * 0.44) / (h * 0.6)));
      pos.setXYZ(k, x * bulge, y + (1 - u * u) * 0.06 * h * ((y - h * 0.44) / h), z * bulge);
    }
    g.computeVertexNormals();
    L.push(part(g, (x, y) => mix(0xf7f1e8, 0xf0dcc6, (y - h * 0.44) / (h * 0.7)), (x, y) => (y < h * 0.47 ? 0.25 : 0)));
  }
  // 꼭대기: 이슬 수정과 금빛 고리
  L.push(part(xf(new THREE.OctahedronGeometry(r * 0.13, 0), { y: h * 1.23, sy: 1.8 }), glow, 1.6));
  L.push(part(xf(new THREE.TorusGeometry(r * 0.22, 0.045, 3, 18), { y: h * 1.15, rx: Math.PI / 2 }), P.gold, 0.5));
  // 문: 아치 문틀 + 빛 문 + 잎 차양 + 디딤판
  const dz = r * 1.02;
  for (const s of [-1, 1]) L.push(part(xf(new THREE.BoxGeometry(0.26, 1.95, 0.3), { x: s * 1.0, y: 0.98, z: dz + 0.06 }), P.gold, 0.15));
  L.push(part(xf(new THREE.TorusGeometry(1.0, 0.13, 6, 16, Math.PI), { y: 1.95, z: dz + 0.06 }), P.gold, 0.15));
  L.push(part(xf(new THREE.PlaneGeometry(1.75, 1.95), { y: 0.98, z: dz + 0.03 }), glow, 0.9));
  L.push(part(xf(new THREE.CircleGeometry(0.875, 14, 0, Math.PI), { y: 1.95, z: dz + 0.03 }), glow, 0.9));
  L.push(part(xf(new THREE.SphereGeometry(1.6, 12, 6, 0, Math.PI, 0, Math.PI / 2), { y: 3.15, z: dz + 0.25, sx: 1, sy: 0.22, sz: 0.85, ry: -Math.PI / 2 }), 0xf3e9da, 0.05));
  L.push(part(xf(new THREE.CylinderGeometry(1.5, 1.6, 0.16, 18), { y: 0.08, z: dz + 1.3, sz: 0.72 }), P.pearl2, 0));
  // 둘레 꽃둑 (문 앞은 비움) + 빛꽃
  const cr = r + 2.4;
  L.push(part(xf(new THREE.TorusGeometry(cr, 0.28, 4, 40, TAU - 1.2).rotateX(Math.PI / 2).rotateY(-(Math.PI / 2 + 0.6)), { y: 0.12, sy: 0.6 }), P.pearl2, 0));
  for (let i = 0; i < 22; i++) {
    const a = Math.PI / 2 + 0.75 + (i / 21) * (TAU - 1.5) + rnd() * 0.05, d = cr - 0.6 + rnd() * 1.2, hh = 0.35 + rnd() * 0.7;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    L.push(part(new THREE.CylinderGeometry(0.025, 0.035, hh, 3).translate(x, hh / 2, z), 0x2f6a58, 0));
    L.push(part(new THREE.OctahedronGeometry(0.1 + rnd() * 0.08, 0).translate(x, hh, z), [P.teal, P.rose, P.amber, P.violet][i % 4], 1.4));
  }
  return L;
}

/** 이슬 탑: 가는 몸통 + 둘레 발코니 + 꼭대기 이슬 깔때기 (원점 = 바닥 가운데, 문 = +z) */
function dewTower({ r = 2.6, h = 13, glow = P.teal } = {}) {
  const L = [];
  L.push(part(lathe([[r * 0.8, 0], [r * 0.86, 0.3], [r * 0.66, h * 0.3], [r * 0.52, h * 0.7], [r * 0.46, h * 0.95], [r * 0.56, h]], 18), (x, y) => (y < 0.35 ? P.gold : mix(P.pearl, P.pearl2, y / h)), 0));
  // 세로 빛창
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + Math.PI / 4;
    for (const [y0, y1] of [[h * 0.12, h * 0.28], [h * 0.42, h * 0.58], [h * 0.7, h * 0.86]]) {
      const rr = r * (0.82 - 0.36 * ((y0 + y1) / 2 / h)) + 0.02;
      L.push(part(xf(new THREE.PlaneGeometry(0.32, y1 - y0), { x: Math.sin(a) * rr, z: Math.cos(a) * rr, y: (y0 + y1) / 2, ry: a }), glow, 1.0));
    }
  }
  // 발코니 둘
  for (const t of [0.36, 0.64]) {
    L.push(part(new THREE.CylinderGeometry(r * 1.3, r * 1.12, 0.26, 22).translate(0, h * t, 0), P.pearl2, 0));
    L.push(part(xf(new THREE.TorusGeometry(r * 1.3, 0.05, 3, 30), { y: h * t + 0.15, rx: Math.PI / 2 }), glow, 1.2));
  }
  // 이슬 깔때기 (안쪽이 빛난다) + 모인 이슬방울
  L.push(part(lathe([[r * 0.55, h], [r * 0.9, h + 0.45], [r * 1.9, h + r * 0.75], [r * 2.02, h + r * 0.82], [r * 1.9, h + r * 0.74], [r * 0.5, h + 0.3]], 26), (x, y) => (y > h + r * 0.7 ? P.gold : P.pearl), (x, y) => (y < h + r * 0.7 && Math.hypot(x) > 0 ? 0.25 : 0)));
  L.push(part(new THREE.SphereGeometry(r * 0.32, 12, 8).translate(0, h + r * 0.55, 0), 0xbffcff, 2.0));
  // 문
  L.push(part(xf(new THREE.PlaneGeometry(1.3, 2.0), { y: 1.0, z: r * 0.85 }), glow, 0.9));
  L.push(part(xf(new THREE.TorusGeometry(0.75, 0.1, 5, 14, Math.PI), { y: 2.0, z: r * 0.86 }), P.gold, 0.15));
  return L;
}

/** 이슬 돛대 (돛은 따로 — 흔들리게): 돛대·이슬받이 그릇 */
function sailMast(h) {
  const L = [];
  L.push(part(tube([[0, 0, 0], [0.25, h * 0.5, 0], [0, h, 0]], 0.24, 6, 10, (t) => 1 - 0.6 * t), (x, y) => mix(P.pearl, P.gold, y / h), 0));
  L.push(part(xf(new THREE.OctahedronGeometry(0.35, 0), { y: h + 0.4, sy: 1.8 }), P.teal, 1.6));
  // 가로대 (돛 위·아래)
  for (const t of [0.32, 0.93]) L.push(part(xf(new THREE.CylinderGeometry(0.06, 0.06, 3.6, 5), { y: h * t, x: 1.6, rz: Math.PI / 2 }), P.gold, 0.2));
  // 이슬받이: 낮은 그릇 + 빛 물
  L.push(part(lathe([[0.4, 0], [1.6, 0.15], [1.8, 0.55], [1.65, 0.6], [0.5, 0.3]], 18), P.pearl2, 0));
  L.push(part(xf(new THREE.CircleGeometry(1.55, 18), { y: 0.5, rx: -Math.PI / 2 }), 0x7fe8f0, 0.9));
  return L;
}
/** 돛: 돛대에서 옆으로 펼친, 바람을 머금은 반투명 막 (원점 = 돛대 밑, 막은 +x 쪽) */
function sailGeo(h) {
  const W = 3.4, y0 = h * 0.32, y1 = h * 0.93;
  const g = new THREE.PlaneGeometry(W, y1 - y0, 6, 10);
  const pos = g.attributes.position;
  for (let k = 0; k < pos.count; k++) {
    const u = (pos.getX(k) + W / 2) / W, v = (pos.getY(k) + (y1 - y0) / 2) / (y1 - y0);
    pos.setXYZ(k, u * W + 0.15, y0 + v * (y1 - y0), Math.sin(Math.PI * u) * 0.75 * (0.6 + 0.4 * Math.sin(Math.PI * v)));
  }
  g.computeVertexNormals();
  return part(g, (x, y) => mix(0xe9fbff, 0xc8f0ff, (y - y0) / (y1 - y0)), (x, y) => 0.25 + 0.35 * Math.max(0, Math.sin(((y - y0) / (y1 - y0)) * 18)) * 0.6);
}

/** 길가 등: 휘어 오른 줄기 끝에 매달린 이슬 등 (원점 = 밑, 등은 +x 쪽) */
function lantern(h = 3.2, glow = P.amber) {
  return [
    part(xf(new THREE.CylinderGeometry(0.22, 0.28, 0.18, 8), { y: 0.09 }), P.gold, 0),
    part(tube([[0, 0, 0], [0.12, h * 0.5, 0], [0.5, h * 0.92, 0], [0.85, h, 0]], 0.06, 4, 8, (t) => 1 - 0.4 * t), P.pearl2, 0),
    part(xf(new THREE.ConeGeometry(0.16, 0.14, 8), { x: 0.85, y: h - 0.08, rx: Math.PI }), P.gold, 0.2),
    part(xf(new THREE.SphereGeometry(0.17, 10, 8), { x: 0.85, y: h - 0.36, sy: 1.35 }), glow, 2.0),
  ];
}

/** 잎 발판: 휘어 오른 줄기 위의 넓은 잎 (원점 = 잎 윗면 가운데) — 줄기 밑은 (bx, -hgt, bz) */
function leafPad(r, hgt, bx, bz) {
  const L = [];
  L.push(part(lathe([[0.0001, 0.02], [r * 0.97, 0.02], [r, 0.3], [r * 1.03, 0.16], [r * 0.92, -0.28], [r * 0.45, -0.5], [0.0001, -0.55]], 24), (x, y) => (y > 0 ? 0xdcefe4 : mix(0xb9dccb, P.pearl2, -y)), 0));
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU;
    L.push(part(xf(new THREE.BoxGeometry(0.07, 0.03, r * 0.85), { x: Math.sin(a) * r * 0.45, z: Math.cos(a) * r * 0.45, y: 0.05, ry: a }), P.teal, 0.9));
  }
  L.push(part(xf(new THREE.TorusGeometry(r, 0.08, 4, 36), { y: 0.26, rx: Math.PI / 2 }), P.teal, 1.0));
  if (hgt > 0.6) L.push(part(tube([[bx, -hgt, bz], [bx * 0.6, -hgt * 0.55, bz * 0.6], [bx * 0.15, -hgt * 0.15, bz * 0.15], [0, -0.45, 0]], Math.min(0.55, 0.16 + r * 0.05), 6, 12, (t) => 1.25 - 0.5 * t), (x, y) => mix(0x6fa890, 0xbfe6cf, (y + hgt) / hgt), 0));
  return L;
}

/** 땅을 따라 깔린 띠 (길·물길): 점 [x, z] 목록, 폭 w, 땅 위 dy */
function ribbon(S, pts, w, dy, color, emit, edge = null) {
  const L = [];
  const pos = [];
  const col = new THREE.Color(color);
  const C = [], E = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, z0] = pts[i], [x1, z1] = pts[i + 1];
    const dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz) || 1, nx = -dz / l * w / 2, nz = dx / l * w / 2;
    const y0 = S._ground(x0, z0) + dy, y1 = S._ground(x1, z1) + dy;
    const a = [x0 + nx, y0, z0 + nz], b = [x0 - nx, y0, z0 - nz], c = [x1 - nx, y1, z1 - nz], d = [x1 + nx, y1, z1 + nz];
    pos.push(...a, ...c, ...b, ...a, ...d, ...c); // 위를 보는 면
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  void C; void E;
  L.push(part(g, color, emit));
  if (edge) for (const s of [-1, 1]) {
    const ep = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, z0] = pts[i], [x1, z1] = pts[i + 1];
      const dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz) || 1, ox = (-dz / l) * (w / 2 + 0.12) * s, oz = (dx / l) * (w / 2 + 0.12) * s;
      const ya = S._ground(x0, z0) + dy, yb = S._ground(x1, z1) + dy;
      const H = edge.h;
      const p0 = [x0 + ox, ya - 0.1, z0 + oz], p1 = [x1 + ox, yb - 0.1, z1 + oz], p2 = [x1 + ox, yb + H, z1 + oz], p3 = [x0 + ox, ya + H, z0 + oz];
      ep.push(...p0, ...p1, ...p2, ...p0, ...p2, ...p3);
    }
    const eg = new THREE.BufferGeometry();
    eg.setAttribute('position', new THREE.Float32BufferAttribute(ep, 3));
    eg.computeVertexNormals();
    L.push(part(eg, edge.color, edge.emit || 0));
  }
  return L;
}
const line = (x0, z0, x1, z1, step = 2.5) => {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / step)), out = [];
  for (let i = 0; i <= n; i++) out.push([x0 + ((x1 - x0) * i) / n, z0 + ((z1 - z0) * i) / n]);
  return out;
};

// ── 마을 짓기 ─────────────────────────────
export function buildDewfold(S, p) {
  const [cx, cz] = p.pos;
  const y0 = S._ground(cx, cz);
  const rnd = mulberry32(123);
  const parts = [], glass = [], flat = []; // flat: 땅에 깔리는 것(길·물길) — 지형과 겹쳐 깜박이지 않게 따로
  const at = (x, z) => S._ground(cx + x, cz + z);
  const put = (list, x, z, ry = 0, dy = 0, target = parts) => A.place(target, list, { x: cx + x, y: at(x, z) + dy, z: cz + z, ry });
  const perches = []; // 새가 앉을 곳 [x, y, z] (세계)
  const lamp = (h, glow, x, z, ry) => { put(lantern(h, glow), x, z, ry); perches.push([cx + x + Math.cos(ry) * 0.6, at(x, z) + h + 0.02, cz + z - Math.sin(ry) * 0.6]); };
  // 마을 대로(구역 town-dew 의 대로 가운데 착륙지 쪽에 가까운 것)를 따라 관문·길을 낸다
  const zi = ZONES.findIndex((Z) => Z.id === 'town-dew'), G = zi >= 0 ? ZGEO[zi] : null;
  const crash = PLACE.crash ? PLACE.crash.pos : [cx + 1000, cz + 800];
  const toCrash = Math.atan2(crash[1] - cz, crash[0] - cx);
  let ga = toCrash;
  if (G) { let best = 9; for (let s = 0; s < G.avenues; s++) { const a = G.aOff + (s * TAU) / G.avenues, d = Math.abs(wrap(a - toCrash)); if (d < best) { best = d; ga = a; } } }
  const dirG = [Math.cos(ga), Math.sin(ga)];
  const R0 = G ? G.r0 - G.street - 4 : 190; // 마을 안쪽 고리 거리 바로 앞까지

  // 비워 둘 자리 (인물·시설·메아리·글자돌) [x, z, r]
  const keep = [[0, 0, 23], [8, 14, 3], [30, 22, 4], [40, 34, 11], [-80, -6, 11], [70, -60, 13], [-30, -60, 4], [70, 30, 4], [-60, 50, 4], [-20, 95, 4], [110, -40, 4]];
  const occ = keep.map(([x, z, r]) => ({ x, z, r }));
  const segs = []; // 길·물길 [x0, z0, x1, z1, 반폭]
  const segD = (x, z, s) => { const [ax, az, bx, bz] = s, dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1))); return Math.hypot(x - ax - dx * t, z - az - dz * t); };
  const free = (x, z, r, pad = 3) => occ.every((o) => Math.hypot(o.x - x, o.z - z) > o.r + r + pad) && segs.every((s) => segD(x, z, s) > s[4] + r + pad);
  const claim = (x, z, r) => occ.push({ x, z, r });

  // ── 노래 우물 광장 ──
  parts.push(part(new THREE.CylinderGeometry(22, 22.6, 0.4, 56).translate(cx, y0 + 0.1, cz), P.pearl2, 0));
  for (const [rr, c, e] of [[12.2, P.gold, 0.4], [18, P.teal, 0.7], [21.7, P.gold, 0.3]]) parts.push(part(xf(new THREE.RingGeometry(rr - 0.12, rr + 0.12, 64), { x: cx, y: y0 + 0.31, z: cz, rx: -Math.PI / 2 }), c, e));
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU + Math.PI / 16;
    parts.push(part(xf(new THREE.BoxGeometry(0.16, 0.03, 5.2), { x: cx + Math.cos(a) * 15.1, y: y0 + 0.31, z: cz + Math.sin(a) * 15.1, ry: -a + Math.PI / 2 }), P.teal, 0.5));
  }
  // 연못: 낮은 담 + 금빛 테 + 물 (빛 물결은 따로 움직인다)
  parts.push(part(lathe([[9.0, 0], [9.6, 0.05], [9.7, 0.85], [9.3, 0.95], [8.9, 0.8]], 48).translate(cx, y0 + 0.3, cz), P.pearl, 0));
  parts.push(part(xf(new THREE.TorusGeometry(9.5, 0.1, 4, 48), { x: cx, y: y0 + 1.25, z: cz, rx: Math.PI / 2 }), P.gold, 0.5));
  parts.push(part(xf(new THREE.CircleGeometry(8.95, 48), { x: cx, y: y0 + 0.95, z: cz, rx: -Math.PI / 2 }), 0x2fa8b8, 0.75));
  S._col({ type: 'cyl', x: cx, z: cz, r: 9.6, y0: y0 - 1, y1: y0 + 1.25 });
  S._col({ type: 'cyl', x: cx, z: cz, r: 22, y0: y0 - 1, y1: y0 + 0.3 });
  // 세 갈래 갈비 기둥: 물가에서 솟아 휘어 들며 빛 핵을 받친다
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * TAU + 0.35, c = Math.cos(a), s = Math.sin(a);
    const pts = [[8.3, 0.9], [8.6, 4.2], [6.4, 8.6], [3.2, 11.6], [1.3, 12.9]].map(([r, y]) => [cx + c * r, y0 + 0.3 + y, cz + s * r]);
    parts.push(part(tube(pts, 0.42, 7, 22, (t) => 1 - 0.68 * t), (x, y) => mix(P.pearl, P.gold, (y - y0) / 14), (x, y) => (y - y0 > 12.4 ? 0.9 : 0)));
    parts.push(part(xf(new THREE.CylinderGeometry(0.75, 0.95, 0.5, 10), { x: cx + c * 8.3, y: y0 + 1.2, z: cz + s * 8.3 }), P.gold, 0.2));
    S._col({ type: 'cyl', x: cx + c * 8.4, z: cz + s * 8.4, r: 0.75, y0: y0, y1: y0 + 4.5, walk: false });
  }
  // 빛 핵 + 도는 고리 둘 (움직임)
  const coreY = y0 + 9.4;
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.25, 1), glowMaterial({ color: 0xbffcff, intensity: 2.2 }));
  core.position.set(cx, coreY, cz);
  const rings = [[2.3, 0x7ff3e6], [3.05, 0xffc46a]].map(([rr, c]) => { const m = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.06, 4, 48), glowMaterial({ color: c, intensity: 1.6 })); m.position.copy(core.position); S.group.add(m); return m; });
  S.group.add(core);
  // 물결: 핵 아래 물 위로 퍼지는 빛 고리
  const ripples = [0, 1, 2].map(() => { const m = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 48).rotateX(-Math.PI / 2), glowMaterial({ color: 0x9ff6ff, intensity: 0.8 })); m.position.set(cx, y0 + 0.97, cz); S.group.add(m); return m; });
  S.anims.push((t) => {
    core.position.y = coreY + Math.sin(t * 0.9) * 0.25;
    core.rotation.set(t * 0.2, t * 0.35, 0);
    rings[0].position.y = rings[1].position.y = core.position.y;
    rings[0].rotation.set(Math.PI / 2 + Math.sin(t * 0.5) * 0.4, t * 0.6, 0);
    rings[1].rotation.set(Math.PI / 2 + Math.cos(t * 0.4) * 0.35, -t * 0.45, 0.3);
    ripples.forEach((m, i) => { const k = (t * 0.22 + i / 3) % 1; m.scale.setScalar(1 + k * 7.5); m.material.uniforms.uIntensity.value = 0.7 * (1 - k) * (1 - k); });
  });
  S.resonators.push({ x: cx, y: y0 + 7, z: cz });
  // 광장 둘레 긴 의자 (길이 드는 쪽은 비움)
  for (let i = 0; i < 6; i++) {
    const a = ga + Math.PI / 6 + (i * Math.PI) / 3;
    for (let k = -1; k <= 1; k++) {
      const b = a + k * 0.13, x = cx + Math.cos(b) * 16.6, z = cz + Math.sin(b) * 16.6;
      parts.push(part(xf(new THREE.BoxGeometry(2.15, 0.48, 0.75), { x, y: y0 + 0.54, z, ry: -b + Math.PI / 2 }), P.pearl, 0));
      parts.push(part(xf(new THREE.BoxGeometry(2.15, 0.05, 0.08), { x: x - Math.cos(b) * 0.3, y: y0 + 0.8, z: z - Math.sin(b) * 0.3, ry: -b + Math.PI / 2 }), P.teal, 0.8));
      S._col({ type: 'box', x, z, hx: 1.05, hz: 0.36, rot: -b + Math.PI / 2, y0: y0, y1: y0 + 0.78 });
    }
  }

  // ── 큰길: 광장 → 관문 → 마을 대로 ──
  const gR = 104, gx = dirG[0] * gR, gz = dirG[1] * gR;
  const pathPts = line(dirG[0] * 22, dirG[1] * 22, dirG[0] * R0, dirG[1] * R0, 2.5).map(([x, z]) => [cx + x, cz + z]);
  flat.push(...ribbon(S, pathPts, 4.2, 0.1, 0xece6f2, 0, { h: 0.12, color: P.gold, emit: 0.3 }));
  for (let d = 26; d < R0; d += 4.5) flat.push(part(xf(new THREE.CircleGeometry(0.22, 8), { x: cx + dirG[0] * d, y: at(dirG[0] * d, dirG[1] * d) + 0.13, z: cz + dirG[1] * d, rx: -Math.PI / 2 }), P.teal, 1.4));
  segs.push([dirG[0] * 22, dirG[1] * 22, dirG[0] * (gR + 20), dirG[1] * (gR + 20), 2.6]);
  // 관문: 두 갈래 기둥이 마주 휘어 오르고, 그 사이에 종 고리가 매달려 있다
  {
    const L = [];
    for (const s of [-1, 1]) {
      L.push(part(tube([[s * 6.8, 0, 0], [s * 7.1, 5, 0], [s * 6.1, 10, 0], [s * 4.1, 13.4, 0], [s * 2.5, 14.2, 0]], 0.8, 8, 20, (t) => 1 - 0.68 * t), (x, y) => mix(P.pearl, P.gold, y / 14), (x, y) => (y > 13.6 ? 0.9 : 0)));
      L.push(part(xf(new THREE.CylinderGeometry(1.5, 1.8, 0.7, 12), { x: s * 6.8, y: 0.35 }), P.pearl2, 0));
      L.push(part(xf(new THREE.TorusGeometry(1.25, 0.07, 3, 20), { x: s * 6.8, y: 0.75, rx: Math.PI / 2 }), P.amber, 1.4));
      L.push(...lantern(3.4).map((g) => xf(g, { x: s * 9.6, ry: s > 0 ? 0 : Math.PI })));
    }
    L.push(part(xf(new THREE.TorusGeometry(1.8, 0.09, 5, 40), { y: 11.9 }), P.amber, 1.6));
    for (let i = 0; i < 7; i++) { const x = -1.1 + i * (2.2 / 6), len = 0.6 + Math.sin(i * 1.3) * 0.25 + (3 - Math.abs(i - 3)) * 0.15; L.push(part(new THREE.CylinderGeometry(0.035, 0.035, len, 4).translate(x, 11.9 - Math.sqrt(Math.max(0, 1.8 * 1.8 - x * x)) - len / 2, 0), 0xfff4d0, 1.8)); }
    L.push(part(xf(new THREE.OctahedronGeometry(0.4, 0), { y: 11.9, sy: 1.6 }), P.amber, 2.0));
    // 관문은 길을 가로질러 선다 (기둥이 길 양옆)
    A.place(parts, L, { x: cx + gx, y: at(gx, gz) - 0.05, z: cz + gz, ry: -(ga + Math.PI / 2) });
    for (const s of [-1, 1]) {
      const px = gx + Math.cos(ga + Math.PI / 2) * 6.8 * s, pz = gz + Math.sin(ga + Math.PI / 2) * 6.8 * s;
      S._col({ type: 'cyl', x: cx + px, z: cz + pz, r: 1.0, y0: at(px, pz) - 1, y1: at(px, pz) + 6, walk: false });
      claim(px, pz, 2);
    }
  }
  // 큰길 양옆 등 (12 m 마다)
  for (let d = 30; d < R0 - 4; d += 12) for (const s of [-1, 1]) {
    if (Math.abs(d - gR) < 6) continue;
    const ox = Math.cos(ga + Math.PI / 2) * 3.2 * s, oz = Math.sin(ga + Math.PI / 2) * 3.2 * s;
    lamp(3.1, d % 24 < 12 ? P.amber : P.teal, dirG[0] * d + ox, dirG[1] * d + oz, -(ga + Math.PI / 2 + (s > 0 ? Math.PI : 0))); // 등이 길 쪽으로 기운다
  }

  // ── 이엘의 집 (북쪽): 큰 꽃잎 집 + 온실 날개 + 앞 텃밭 ──
  const ih = { x: -8, z: -46 };
  {
    const face = Math.atan2(-ih.x, -ih.z); // 광장 쪽
    put(petalHouse({ r: 8.4, h: 12, seed: 7, glow: P.teal, petals: 9 }), ih.x, ih.z, face, -0.2);
    S._col({ type: 'cyl', x: cx + ih.x, z: cz + ih.z, r: 8.6, y0: y0 - 1, y1: at(ih.x, ih.z) + 13, dome: 7 });
    claim(ih.x, ih.z, 11);
    // 온실 날개: 유리 반구 + 안의 빛 식물
    const wx = ih.x + Math.cos(face + Math.PI / 2 - Math.PI / 2) * 0, side = [Math.cos(-face), Math.sin(-face)];
    const gxo = ih.x + side[0] * 12.5, gzo = ih.z + side[1] * 12.5;
    void wx;
    glass.push(...A.place([], [part(new THREE.SphereGeometry(5.2, 18, 10, 0, TAU, 0, Math.PI / 2), 0xdff6ff, 0.12)], { x: cx + gxo, y: at(gxo, gzo) - 0.1, z: cz + gzo }));
    const gl = [part(xf(new THREE.TorusGeometry(5.2, 0.12, 4, 36), { y: 0.1, rx: Math.PI / 2 }), P.gold, 0.2)];
    for (let i = 0; i < 4; i++) gl.push(part(xf(new THREE.TorusGeometry(5.2, 0.06, 3, 24, Math.PI), { ry: (i / 4) * Math.PI, y: 0 }), P.gold, 0.1));
    for (let i = 0; i < 9; i++) { const a = rnd() * TAU, d = rnd() * 3.6, hh = 0.8 + rnd() * 1.6; gl.push(part(new THREE.ConeGeometry(0.12, hh, 4).translate(Math.cos(a) * d, hh / 2, Math.sin(a) * d), 0x8fe0a0, 0.5), part(new THREE.SphereGeometry(0.22, 8, 6).translate(Math.cos(a) * d, hh + 0.1, Math.sin(a) * d), [P.teal, P.rose, P.amber][i % 3], 1.8)); }
    put(gl, gxo, gzo, 0, -0.1);
    S._col({ type: 'cyl', x: cx + gxo, z: cz + gzo, r: 5.2, y0: y0 - 1, y1: at(gxo, gzo) + 5, dome: 4.2 });
    claim(gxo, gzo, 6);
    S.ielHouse = { x: cx + ih.x, z: cz + ih.z + 12, y: y0 };
  }

  // ── 디딤 잎과 전망 잎 (마을 뒤, 관문 반대쪽) ──
  {
    const pa = ga + Math.PI + 0.25;
    const steps = [[28, 1.6, 2.2], [31.5, 3.2, 2.2], [35, 4.9, 2.3], [38.5, 6.7, 2.4], [45, 9, 7.5], [58, 16.5, 6.5]];
    steps.forEach(([d, hgt, r], i) => {
      const a = pa + (i < 4 ? i * 0.06 : i === 4 ? 0.12 : -0.08);
      const x = Math.cos(a) * d, z = Math.sin(a) * d, y = at(x, z) + hgt;
      const bx = -Math.cos(a) * Math.min(3, r * 0.4), bz = -Math.sin(a) * Math.min(3, r * 0.4);
      A.place(parts, leafPad(r, hgt, bx, bz), { x: cx + x, y, z: cz + z });
      S._col({ type: 'cyl', x: cx + x, z: cz + z, r: r * 0.98, y0: y - 0.6, y1: y + 0.02 });
      claim(x, z, i < 4 ? 1.2 : r * 0.6);
      if (i === steps.length - 1) S._dewLookout = [x - Math.cos(a) * (r + 2), z - Math.sin(a) * (r + 2), a];
    });
  }

  // ── 물길: 연못에서 뻗어 작은 못에서 끝난다 (집·인물 자리 앞에서 멈춤) ──
  for (let k = 0; k < 4; k++) {
    const a = ga + Math.PI / 4 + (k * Math.PI) / 2, c = Math.cos(a), s = Math.sin(a);
    let end = 22.5;
    for (let d = 24; d <= 64; d += 1) { if (!free(c * d, s * d, 1.2, 0.5)) break; end = d; }
    if (end < 34) continue;
    const pts = line(c * 22.5, s * 22.5, c * (end - 3), s * (end - 3), 2).map(([x, z]) => [cx + x, cz + z]);
    flat.push(...ribbon(S, pts, 1.3, 0.1, 0x3ab8c8, 0.85, { h: 0.2, color: P.pearl2 }));
    put([part(xf(new THREE.CircleGeometry(2.6, 24), { y: 0.08, rx: -Math.PI / 2 }), 0x3ab8c8, 0.9), part(xf(new THREE.TorusGeometry(2.7, 0.18, 4, 28), { y: 0.12, rx: Math.PI / 2, sy: 0.7 }), P.pearl2, 0)], c * end, s * end);
    lamp(2.8, P.teal, c * end + s * 3.4, s * end - c * 3.4, -a);
    segs.push([c * 22.5, s * 22.5, c * end, s * end, 1.0]);
    claim(c * end, s * end, 3);
  }

  // ── 집들: 꽃잎 집 여덟 + 이슬 탑 셋 (광장을 보고, 문 앞으로 작은 길) ──
  const homes = [];
  const want = [...Array(8).fill('petal'), 'tower', 'tower', 'tower'];
  for (let tries = 0, i = 0; i < want.length && tries < 600; tries++) {
    const kind = want[i];
    const a = rnd() * TAU, d = 36 + rnd() * 52;
    const r = kind === 'petal' ? 4.2 + rnd() * 1.8 : 2.4 + rnd() * 0.6;
    const foot = kind === 'petal' ? r + 2.6 : r * 1.4;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (!free(x, z, foot, 3.5)) continue;
    claim(x, z, foot);
    segs.push([(x / d) * 22.6, (z / d) * 22.6, x - (x / d) * foot, z - (z / d) * foot, 1.0]); // 문 앞 작은 길
    homes.push({ kind, x, z, r, a, d });
    i++;
  }
  homes.forEach((H, i) => {
    const face = Math.atan2(-H.x, -H.z), gy = at(H.x, H.z);
    if (H.kind === 'petal') {
      const h = H.r * (1.35 + rnd() * 0.25);
      put(petalHouse({ r: H.r, h, seed: 20 + i, glow: [P.amber, P.teal, P.rose, P.amber][i % 4], petals: 6 + (i % 3) }), H.x, H.z, face, -0.15);
      perches.push([cx + H.x, gy + h * 1.16, cz + H.z]);
      S._col({ type: 'cyl', x: cx + H.x, z: cz + H.z, r: H.r * 1.03, y0: gy - 1, y1: gy + h * 1.12, dome: h * 0.62 });
    } else {
      const h = 11 + rnd() * 5;
      put(dewTower({ r: H.r, h, glow: i % 2 ? P.teal : P.amber }), H.x, H.z, face, -0.1);
      S._col({ type: 'cyl', x: cx + H.x, z: cz + H.z, r: H.r * 0.82, y0: gy - 1, y1: gy + h, walk: false });
      for (const t of [0.36, 0.64]) S._col({ type: 'cyl', x: cx + H.x, z: cz + H.z, r: H.r * 1.3, y0: gy + h * t - 0.3, y1: gy + h * t + 0.13 });
    }
    // 문 앞에서 광장까지 작은 길 + 문 옆 등
    const dr = H.kind === 'petal' ? H.r + 2.2 : H.r + 0.8;
    const ux = -H.x / H.d, uz = -H.z / H.d;
    const sx = H.x + ux * dr, sz = H.z + uz * dr;
    const ex = (-ux) * 22.6, ez = (-uz) * 22.6;
    if (Math.hypot(sx - ex, sz - ez) > 2) flat.push(...ribbon(S, line(sx, sz, ex, ez, 2).map(([x, z]) => [cx + x, cz + z]), 1.9, 0.08, 0xe4dcec, 0));
    lamp(2.6, P.amber, sx - uz * 1.8, sz + ux * 1.8, face - Math.PI / 2);
  });

  // ── 이슬 돛: 마을 가장자리에서 안개를 거둔다 (관문 쪽은 비움) ──
  const sails = [];
  const sailMat = A.archMaterials().crystal;
  for (let i = 0; i < 9; i++) {
    const a = ga + 0.45 + (i / 9) * (TAU - 0.9) + (rnd() - 0.5) * 0.12, d = 92 + rnd() * 18;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (!free(x, z, 2.2, 2)) continue;
    claim(x, z, 2.2);
    const h = 13 + rnd() * 6, gy = at(x, z);
    put(sailMast(h), x, z, 0, -0.05);
    perches.push([cx + x, gy + h + 0.05, cz + z], [cx + x + 3.2, gy + h * 0.93 + 0.08, cz + z]);
    const m = new THREE.Mesh(A.meshFrom([sailGeo(h)]).geometry, sailMat);
    m.position.set(cx + x, gy - 0.05, cz + z);
    S.group.add(m);
    sails.push({ m, base: 0.6 + rnd() * 0.3, ph: rnd() * TAU });
    S._col({ type: 'cyl', x: cx + x, z: cz + z, r: 1.8, y0: gy - 1, y1: gy + 0.6 });
    S._col({ type: 'cyl', x: cx + x, z: cz + z, r: 0.3, y0: gy, y1: gy + h, walk: false });
  }
  S.anims.push((t) => { for (const s of sails) s.m.rotation.y = s.base + Math.sin(t * 0.35 + s.ph) * 0.22 + Math.sin(t * 1.1 + s.ph * 2) * 0.05; });

  // ── 텃밭: 빛갈대 묘판 (낮은 둑 + 줄 맞춘 싹) ──
  const plots = [];
  for (let i = 0, made = 0; i < 40 && made < 6; i++) {
    const a = rnd() * TAU, d = 50 + rnd() * 40, x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (!free(x, z, 5, 2)) continue;
    claim(x, z, 5); made++;
    plots.push({ x, z, a });
    // 묘판 옆 말뚝에 매인 포자해파리 등 (해파리는 생물 쪽이 그린다)
    const kx = x + Math.cos(a + Math.PI / 2) * 5.6, kz = z + Math.sin(a + Math.PI / 2) * 5.6;
    put([part(xf(new THREE.CylinderGeometry(0.07, 0.1, 1.4, 6), { y: 0.7 }), P.gold, 0.2), part(xf(new THREE.TorusGeometry(0.16, 0.03, 3, 10), { y: 1.42, rx: Math.PI / 2 }), P.teal, 1.2), part(xf(new THREE.CylinderGeometry(0.008, 0.008, 2.0, 3), { y: 2.4 }), 0xbffcff, 1.0)], kx, kz);
    plots[plots.length - 1].stake = [kx, kz];
    const ry = -a, L = [part(xf(new THREE.BoxGeometry(8.4, 0.3, 5.4), { y: 0.15 }), P.pearl2, 0), part(xf(new THREE.BoxGeometry(8, 0.05, 5), { y: 0.31 }), 0x2a4a3c, 0)];
    for (let row = 0; row < 4; row++) for (let c = 0; c < 9; c++) {
      const sx = -3.6 + c * 0.9, sz = -1.8 + row * 1.2, hh = 0.4 + ((c * 7 + row * 3) % 5) * 0.12;
      L.push(part(new THREE.ConeGeometry(0.05, hh, 3).translate(sx, 0.33 + hh / 2, sz), 0x6fd8a8, 0.3));
      L.push(part(new THREE.OctahedronGeometry(0.09, 0).translate(sx, 0.36 + hh, sz), row % 2 ? P.teal : P.amber, 1.5));
    }
    put(L, x, z, ry, -0.05);
  }

  // ── 광장 둘레 등 ──
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU + 0.13;
    if (Math.abs(wrap(a - ga)) < 0.25) continue;
    lamp(3.4, i % 2 ? P.amber : P.teal, Math.cos(a) * 23.6, Math.sin(a) * 23.6, -a + Math.PI);
  }

  // ── 착륙지 → 마을 대로 끝: 길잡이 등 (아웬이 착륙선을 위해 밝혀 둔 빛 표지) ──
  const guides = [];
  if (G) {
    const rEnd = G.rOut + G.street + 18;
    const ex = cx + dirG[0] * rEnd, ez = cz + dirG[1] * rEnd;
    const sx = crash[0] + Math.cos(Math.atan2(ez - crash[1], ex - crash[0])) * 26, sz = crash[1] + Math.sin(Math.atan2(ez - crash[1], ex - crash[0])) * 26;
    const n = Math.max(2, Math.floor(Math.hypot(ex - sx, ez - sz) / 24));
    const gl = [];
    for (let i = 0; i <= n; i++) {
      const x = sx + ((ex - sx) * i) / n, z = sz + ((ez - sz) * i) / n, gy = S._ground(x, z);
      if (gy < 0.5) continue;
      const side = i % 2 ? 1 : -1, nx = -(ez - sz), nz = ex - sx, l = Math.hypot(nx, nz) || 1;
      const px = x + (nx / l) * 2.2 * side, pz = z + (nz / l) * 2.2 * side;
      A.place(gl, [
        part(xf(new THREE.CylinderGeometry(0.16, 0.26, 1.6, 6), { y: 0.8 }), P.pearl2, 0),
        part(xf(new THREE.OctahedronGeometry(0.28, 0), { y: 1.95, sy: 1.6 }), P.teal, 2.2),
        part(xf(new THREE.TorusGeometry(0.38, 0.04, 3, 14), { y: 1.95, rx: Math.PI / 2 }), P.gold, 0.6),
      ], { x: px, y: S._ground(px, pz) - 0.05, z: pz });
      guides.push([px, pz]);
    }
    S._mesh(gl);
    // 대로 끝 → 마을 안쪽 고리 거리 → 관문 → 우물: 인물이 착륙지에서 마을로 올 때 따라가는 길
    S.dewRoute = [[ex, ez], [cx + dirG[0] * (G.r0 - 6), cz + dirG[1] * (G.r0 - 6)], [cx + gx * 0.98, cz + gz * 0.98], [cx + dirG[0] * 28, cz + dirG[1] * 28]];
  }

  // ── 생물과 주민의 자리 ──
  const W = (x, z) => [cx + x, cz + z];
  const sites = S.world.faunaSites = S.world.faunaSites || [];
  sites.push({ key: 'dew-birds', sp: 'bird', x: cx, z: cz, r: 70, n: 10, mode: 'wild', seed: 0.3 });
  for (const [k, a] of [[0, ga + Math.PI * 0.55], [1, ga - Math.PI * 0.55]]) { const [x, z] = W(Math.cos(a) * 30, Math.sin(a) * 30); sites.push({ key: 'dew-pet' + k, sp: 'hopper', x, z, r: 9, n: 3, mode: 'pet', seed: 0.5 + k * 0.1 }); }
  plots.forEach((pl, i) => {
    sites.push({ key: 'dew-jelly' + i, sp: 'jelly', x: cx + pl.stake[0], z: cz + pl.stake[1], r: 0, n: 1, mode: 'tether', seed: i * 0.17 });
    if (i < 2) { const [x, z] = W(pl.x, pl.z); sites.push({ key: 'dew-garden-pet' + i, sp: 'hopper', x, z, r: 7, n: 2, mode: 'pet', seed: 0.7 + i * 0.1 }); }
  });
  if (plots.length) {
    // 일하는 등짐소 둘: 텃밭 → 광장 가장자리 → 큰길 → 관문 밖 → 돌아오기
    const pl = plots[0], ang = Math.atan2(pl.z, pl.x);
    const route = [W(pl.x * 0.9, pl.z * 0.9), W(Math.cos(ang) * 30, Math.sin(ang) * 30), W(dirG[0] * 30 + Math.cos(ga + 1.2) * 6, dirG[1] * 30 + Math.sin(ga + 1.2) * 6), W(dirG[0] * (gR + 25) + Math.cos(ga + Math.PI / 2) * 2, dirG[1] * (gR + 25) + Math.sin(ga + Math.PI / 2) * 2), W(dirG[0] * 30 - Math.cos(ga + 1.2) * 6, dirG[1] * 30 - Math.sin(ga + 1.2) * 6)];
    sites.push({ key: 'dew-work', sp: 'beast', x: route[0][0], z: route[0][1], r: 4, n: 2, mode: 'work', route, seed: 0.9 });
  }
  // 착륙지 둘레의 들판: 내리자마자 보이는 생물 (톡톡이 무리 둘, 노래새 떼, 풀 뜯는 등짐소, 해 질 녘 해파리)
  if (PLACE.crash) {
    const [kx, kz] = PLACE.crash.pos, toV = Math.atan2(cz - kz, cx - kx);
    const at2 = (a, d) => [kx + Math.cos(toV + a) * d, kz + Math.sin(toV + a) * d];
    for (const [k, sp, a, d, n, r] of [[0, 'hopper', 0.5, 55, 6, 18], [1, 'hopper', -0.9, 95, 5, 20], [2, 'bird', 0.2, 70, 9, 40], [3, 'beast', -0.4, 210, 4, 55], [4, 'beast', 1.3, 260, 3, 50], [5, 'jelly', 0.9, 120, 5, 40]]) {
      const [x, z] = at2(a, d);
      sites.push({ key: 'crash-' + k, sp, x, z, r, n, mode: 'wild', cond: sp === 'jelly' ? 'dusk' : undefined, seed: k * 0.13 });
    }
  }
  S.world.perches = (S.world.perches || []).concat(perches);
  // 마을 사람들 (citizens 가 그린다): 광장의 이야기 모둠·악사, 텃밭의 정원지기, 의자의 쉬는 이, 광장을 도는 산책, 짐꾼, 돛 기술자, 전망 잎의 별 관측자
  const spots = S.world.placeSpots = S.world.placeSpots || [];
  let sn = 0;
  const spot = (type, x, z, yaw, o = {}) => spots.push({ type, x: cx + x, z: cz + z, y: at(x, z) + (o.dy || 0), yaw, r: o.r || 0, id: `dew:${sn++}`, ...(o.loop ? { loop: o.loop.map(([lx, lz]) => ({ x: cx + lx, z: cz + lz })) } : {}), ...(o.to ? { to: { x: cx + o.to[0], z: cz + o.to[1] } } : {}) });
  for (const a of [ga + 2.3, ga - 2.0]) spot('chat', Math.cos(a) * 19.5, Math.sin(a) * 19.5, -a);
  { const a = ga + Math.PI; spot('music', Math.cos(a) * 12.4, Math.sin(a) * 12.4, Math.atan2(-Math.cos(a), -Math.sin(a)) + Math.PI, { dy: 0.3 }); }
  spot('play', Math.cos(ga + 1.4) * 34, Math.sin(ga + 1.4) * 34, 0, { r: 6 });
  plots.forEach((pl) => spot('tend', pl.x, pl.z, Math.atan2(-pl.x, -pl.z), { r: 4 }));
  for (let i = 0; i < 6; i += 2) { const b = ga + Math.PI / 6 + (i * Math.PI) / 3; spot('sit', Math.cos(b) * 16.6, Math.sin(b) * 16.6, Math.atan2(-Math.cos(b), -Math.sin(b)), { dy: 0.3 }); }
  const ring = []; for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; ring.push([Math.cos(a) * 27, Math.sin(a) * 27]); }
  spot('stroll', ring[0][0], ring[0][1], 0, { loop: ring });
  if (plots[1]) spot('carry', plots[1].x * 0.85, plots[1].z * 0.85, 0, { to: [dirG[0] * 26, dirG[1] * 26] });
  if (sails.length) { const m = sails[0].m.position; spot('console', m.x - cx + 1.6, m.z - cz + 1.6, 0); }
  if (S._dewLookout) { const [x, z, a] = S._dewLookout; spot('observe', x, z, Math.atan2(Math.cos(a), Math.sin(a))); } // 전망 잎 아래에서 별을 본다

  S._mesh(parts);
  if (glass.length) S._mesh(glass, A.archMaterials().crystal);
  if (flat.length) {
    const fm = litMaterial({ vertexColors: true, vertexEmit: true, emissive: 0xffffff, emissiveIntensity: 1.6, emissiveNight: 0.85, rim: 0.2, spec: 0.6 });
    fm.polygonOffset = true; fm.polygonOffsetFactor = -3; fm.polygonOffsetUnits = -6; fm.side = THREE.DoubleSide;
    S._mesh(flat, fm);
  }
  // 식물이 길·광장·집 위로 자라지 않게
  S.world.clearZones = S.world.clearZones || [];
  S.world.clearZones.push({ x: cx, z: cz, r: 26 });
  for (const o of occ) if (o.r > 1.5) S.world.clearZones.push({ x: cx + o.x, z: cz + o.z, r: o.r + 1 });
  for (const s of segs) S.world.clearZones.push({ seg: [cx + s[0], cz + s[1], cx + s[2], cz + s[3]], r: s[4] + 1.2 });
  S.world.clearZones.push({ seg: [cx + dirG[0] * 22, cz + dirG[1] * 22, cx + dirG[0] * R0, cz + dirG[1] * R0], r: 3.4 });
  for (const H of homes) S.world.clearZones.push({ seg: [cx + H.x, cz + H.z, cx - (H.x / H.d) * 22, cz - (H.z / H.d) * 22], r: 1.6 });
  S.markers.push({ id: 'dewfold', x: cx, y: y0, z: cz });
  return { y0, ga };
}
