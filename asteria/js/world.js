// 아스테리아 1부 — 대륙: 지형 만들기, 마을과 구조물, 나무, 지맥, 떠 있는 섬, 사람과 잔향 배치
'use strict';

const T = {
  GRASS: 0, PATH: 1, DEEP: 2, SHALLOW: 3, SAND: 4, SALT: 5, TREE: 6, ROCK: 7, CLIFF: 8, HIGH: 9,
  CHASM: 10, WALL: 11, FLOOR: 12, SNOW: 13, LEY: 14, BRIDGE: 15, CRACK: 16, SHELF: 17, ROOF: 18,
  MINE: 19, DARK: 20, ICE: 21, MUD: 22, LEAF: 23, FENCE: 24, PILLAR: 25, CARPET: 26, SALTC: 27,
  RUIN: 28, FLOOD: 29, PINE: 30, FLOWER: 31, PLAZA: 32, STAIRS: 33, SALTROCK: 34, IVY: 35,
  RAVINE: 36, LAVA: 37, HOUSE: 38, POOL: 39,
};
const WS = 5.12;                     // 설계도 한 칸 = 5.12미터
const WORLD_W = 1024, WORLD_D = 768;
const M_ = (u, v) => [(u + 0.5) * WS, (v + 0.5) * WS];
const REG = [
  { name: '중앙 평원', temp: 17 }, { name: '칼리도르', temp: 18 }, { name: '마르셀라 해안', temp: 27 },
  { name: '엘름바텐 숲', temp: 13 }, { name: '그라벤호프 산지', temp: -4 }, { name: '알테라 고원', temp: -18 },
  { name: '서부 평원', temp: 12 }, { name: '바다', temp: 14 },
];
const PLACES = {
  kalidorGate: M_(100, 116), marcella: M_(34, 88), cathedral: M_(22, 81), elm: M_(158, 80), clock: M_(178, 62),
  grav: M_(100, 20), mine: M_(106, 12), camp: M_(66, 46), prima: M_(22, 9), riven: M_(72, 54),
  orta: M_(14, 50), brig: M_(28, 54), seilen: M_(46, 50),
};
const TOWERS = [
  { id: 'tw0', u: 100, v: 107, name: '칼리도르 관측탑', r: 180 },
  { id: 'tw1', u: 52, v: 90, name: '서쪽 해안 관측탑', r: 200 },
  { id: 'tw2', u: 134, v: 78, name: '동쪽 숲 관측탑', r: 210 },
  { id: 'tw3', u: 100, v: 56, name: '북쪽 산 관측탑', r: 210 },
  { id: 'tw4', u: 70, v: 41, name: '고원 관측탑', r: 220 },
];
const LABS = [[84, 100], [122, 104], [64, 74], [46, 108], [150, 102], [124, 58], [86, 46], [40, 54]];
const TOWER_H = 26;

function plateauDist(u, v) {
  const n = (fbm(u * 0.1, v * 0.1, 21) - 0.5) * 6;
  return Math.min(u - (8 + n), (62 + n) - u, v - (5 + n * 0.5), (43 + n * 0.6) - v);
}
function regionOfXY(x, y) {
  if (plateauDist(x, y) > 0) return 5;
  if (x >= 64 && x <= 142 && y < 50 + (fbm(x * 0.05, 0, 3) - 0.5) * 8) return 4;
  if (x > 138 + (fbm(0, y * 0.06, 4) - 0.5) * 8 && y > 38 && y < 118) return 3;
  if (x >= 91 && x <= 109 && y >= 116 && y <= 134) return 1;
  if (x < 60 && y > 58 && y < 122) return 2;
  if (x < 64 && y >= 43 && y <= 58) return 6;
  return 0;
}
const coastX = v => 13 + 4 * fbm(0.5, v * 0.05, 3);
function tideLevel() {
  if (!G.f.eng_marcella) return -2;
  return lerp(-1.2, 0.9, clamp((G.playT - (G.f.marcellaT || 0)) / 120, 0, 1));
}
function coastP() { return G.f.eng_marcella ? clamp((G.playT - (G.f.marcellaT || 0)) / 120, 0, 1) : 0; }

// 길, 강, 지맥 (설계도 좌표)
const ROADS = [
  [[100, 116], [100, 104], [100, 92]],
  [[100, 92], [80, 90], [60, 88], [40, 88]],
  [[100, 92], [120, 86], [136, 82], [150, 80]],
  [[100, 92], [100, 70], [100, 52]],
  [[100, 52], [104, 44], [96, 36], [104, 28], [100, 22]],
  [[100, 70], [84, 62], [72, 54], [66, 47]],
  [[158, 80], [160, 71], [166, 63], [168.5, 62]],
  [[40, 88], [34, 88], [26, 84], [22, 82.5]],
  [[66, 47], [52, 52], [40, 52], [28, 54], [14, 51]],
  [[100, 22], [105, 15], [106, 13]],
];
const RAMP = [[69, 47], [64, 45.5], [65.5, 42.5], [61.5, 41]];     // 고원 남동쪽 오르막
const RIVERS = [
  [[118, 48], [116, 62], [122, 78], [126, 94], [140, 118], [158, 147]],
  [[78, 52], [72, 64], [76, 80]],
  [[76, 86], [66, 100], [58, 118], [52, 147]],
];
const LEYS = [
  [[100, 116], [90, 100], [70, 92], [52, 84], [30, 80]],
  [[100, 116], [112, 100], [130, 90], [146, 74], [170, 64]],
  [[100, 116], [108, 96], [96, 76], [100, 58], [104, 30], [106, 16]],
  [[100, 116], [84, 104], [70, 80], [62, 60], [56, 47]],
  [[70, 92], [76, 110], [86, 130]],
];
const LAKES = [[76, 80, 6], [130, 112, 5]];

function buildWorld() {
  const m = new TerrainField('world', WORLD_W, WORLD_D, 2);
  m.name = '아스테리아'; m.temp = 16;
  const W = m.nx + 1;
  const roadsM = ROADS.map(r => r.map(([u, v]) => [u * WS, v * WS]));
  const rampM = RAMP.map(([u, v]) => [u * WS, v * WS]);
  const riversM = RIVERS.map(r => r.map(([u, v]) => [u * WS, v * WS]));
  const leysM = LEYS.map(r => r.map(([u, v]) => [u * WS, v * WS]));
  const flatten = [
    [100, 125, 13, 4.2], [34, 88, 7, null], [158, 80, 8, null], [100, 20, 9, 30], [72, 54, 4, null],
    [14, 50, 4, null], [28, 54, 4, null], [46, 50, 4, null], [66, 46, 3.5, null], [22, 11, 5, null],
  ].concat(TOWERS.map(t => [t.u, t.v, 2.6, null])).concat(LABS.map(([u, v]) => [u, v, 2, null]));

  // 1) 높이
  for (let iz = 0; iz <= m.nz; iz++) for (let ix = 0; ix <= m.nx; ix++) {
    const x = ix * 2, z = iz * 2, u = x / WS, v = z / WS, i = iz * W + ix;
    const edge = Math.min(u, 199 - u, v, 149 - v);
    let s = edge - (3 + fbm(u * 0.06, v * 0.06, 1) * 7);
    let band = false, cx = 0;
    if (v >= 58 && v <= 120) { cx = coastX(v); s = Math.min(s, u - cx); if (s > 0 && u <= cx + 12) band = true; }
    const reg = s > 0 ? regionOfXY(u, v) : 7;
    const plains = 2.4 + fbm(u * 0.05, v * 0.05, 2) * 6 + fbm(u * 0.2, v * 0.2, 4) * 1.1;
    const forest = 3 + fbm(u * 0.07, v * 0.07, 5) * 8 + fbm(u * 0.25, v * 0.25, 6) * 1.2;
    const mtn = 8 + ridged(u * 0.045, v * 0.045, 6) * 46 + fbm(u * 0.22, v * 0.22, 8) * 3;
    const salt = 1.2 + Math.max(0, fbm(u * 0.13, v * 0.13, 5) - 0.62) * 22;
    const wF = smooth(132, 146, u) * smooth(36, 46, v) * smooth(122, 110, v);
    const wM = smooth(56, 40, v) * smooth(60, 72, u) * smooth(148, 136, u);
    const wS = smooth(64, 52, u) * smooth(54, 62, v) * smooth(124, 116, v);
    let h = plains;
    h = lerp(h, forest, wF); h = lerp(h, salt, wS); h = lerp(h, mtn, wM);
    const pd = plateauDist(u, v);
    if (pd > -3) h = lerp(h, 27 + fbm(u * 0.1, v * 0.1, 21) * 3, smooth(-1.4, 1.0, pd));
    let fl = 0;
    if (band) { h = 0.2 + (u - cx) * 0.085; fl |= FL.BAND | FL.NOGRASS; }
    else if (s < 4) { h = s < 0 ? Math.max(-10, s * 1.8 - 0.8) : lerp(s * 0.3, h, smooth(0, 4, s)); if (s < 2.5) fl |= FL.NOGRASS; }
    // 마을 터 다지기
    for (const [fu, fv, fr, fh] of flatten) {
      const d = dist(u, v, fu, fv);
      if (d < fr + 2) { const k = smooth(fr + 2, fr - 0.5, d); const target = fh ?? h; h = lerp(h, target, k); if (d < fr) fl |= FL.TOWN; }
    }
    // 호수와 강
    for (const [lu, lv, lr] of LAKES) { const d = dist(u, v, lu, lv); if (d < lr + 2) h = lerp(h, -2.6, smooth(lr + 1.5, lr - 2, d)); }
    for (const r of riversM) { const [d] = polyDist(x, z, r); if (d < 14) h = lerp(h, Math.min(h, -1.8), smooth(11, 4.5, d)); }
    // 고원의 끊어진 다리 자리 (깊은 협곡)
    if (reg === 5 || pd > -0.5) {
      const chasmA = u > 8.5 && u < 63 && v > 27 && v < 31, chasmB = u > 34 && u < 39 && v > 5.5 && v < 27.2;
      if (chasmA || chasmB) { h = -22; fl |= FL.VOID | FL.NOGRASS; }
    }
    // 엘름바텐 시계탑 섬과 협곡
    const dc = dist(u, v, 178, 62);
    if (dc < 10) { if (dc < 6.5) h = Math.max(h, 10); else { h = -22; fl |= FL.VOID; } }
    m.h[i] = h; m.fl[i] = fl; m.reg[i] = reg;
  }
  // 2) 길 다지기 (높이 윤곽을 매끈하게)
  const roadProfile = (pts, forced) => {
    const samples = [];
    let L = 0;
    for (let k = 0; k < pts.length - 1; k++) {
      const [ax, az] = pts[k], [bx, bz] = pts[k + 1], l = Math.hypot(bx - ax, bz - az);
      for (let t = 0; t < l; t += 3) samples.push([lerp(ax, bx, t / l), lerp(az, bz, t / l), L + t]);
      L += l;
    }
    samples.push([pts[pts.length - 1][0], pts[pts.length - 1][1], L]);
    let hs = samples.map(([x, z]) => Math.max(m.ground(x, z), 0.6));
    if (forced) { const a = hs[0], b = m.ground(pts[pts.length - 1][0] - 8, pts[pts.length - 1][1] - 8); hs = samples.map((s, k) => lerp(a, Math.max(b, 26), k / (samples.length - 1))); }
    for (let pass = 0; pass < 4; pass++) hs = hs.map((v, k) => (hs[Math.max(0, k - 2)] + hs[Math.max(0, k - 1)] + v + hs[Math.min(hs.length - 1, k + 1)] + hs[Math.min(hs.length - 1, k + 2)]) / 5);
    return { samples, hs };
  };
  const roadOver = [];
  for (const [idx, pts] of [...roadsM.map((p, k) => [k, p]), ['ramp', rampM]]) {
    const { samples, hs } = roadProfile(pts, idx === 'ramp');
    const wR = idx === 'ramp' ? 5 : 4.2;
    const x0 = Math.min(...pts.map(p => p[0])) - 10, x1 = Math.max(...pts.map(p => p[0])) + 10, z0 = Math.min(...pts.map(p => p[1])) - 10, z1 = Math.max(...pts.map(p => p[1])) + 10;
    for (let iz = Math.max(0, Math.floor(z0 / 2)); iz <= Math.min(m.nz, Math.ceil(z1 / 2)); iz++) for (let ix = Math.max(0, Math.floor(x0 / 2)); ix <= Math.min(m.nx, Math.ceil(x1 / 2)); ix++) {
      const x = ix * 2, z = iz * 2, i = iz * W + ix;
      let best = 1e9, bh = 0;
      for (let k = 0; k < samples.length; k++) { const d = Math.hypot(samples[k][0] - x, samples[k][1] - z); if (d < best) { best = d; bh = hs[k]; } }
      if (best > wR + 3) continue;
      if (m.fl[i] & FL.VOID) continue;
      const k = smooth(wR + 3, wR - 0.5, best);
      if (m.h[i] < -0.5 && idx !== 'ramp') { roadOver.push([x, z, bh]); continue; }
      m.h[i] = lerp(m.h[i], bh, k);
      if (best < wR) m.fl[i] |= FL.ROAD | FL.NOGRASS;
    }
  }
  m.bridges = roadOver;
  // 3) 지맥 플래그
  for (const L of leysM) {
    for (let iz = 0; iz <= m.nz; iz += 1) for (let ix = 0; ix <= m.nx; ix += 1) {
      const x = ix * 2, z = iz * 2;
      if (x < Math.min(...L.map(p => p[0])) - 6 || x > Math.max(...L.map(p => p[0])) + 6 || z < Math.min(...L.map(p => p[1])) - 6 || z > Math.max(...L.map(p => p[1])) + 6) continue;
      const [d] = polyDist(x, z, L);
      if (d < 3) m.fl[iz * W + ix] |= FL.LEY;
    }
  }
  m.leys = leysM;
  colorWorld(m);
  // 4) 장소, 구조물, 사람
  populateWorld(m);
  return m;
}

// 정점 색 (지역 · 높이 · 경사)
function colorWorld(m) {
  const W = m.nx + 1, c = new THREE.Color(), c2 = new THREE.Color();
  for (let iz = 0; iz <= m.nz; iz++) for (let ix = 0; ix <= m.nx; ix++) {
    const i = iz * W + ix, h = m.h[i], r = m.reg[i], fl = m.fl[i];
    const u = ix * 2 / WS, v = iz * 2 / WS;
    const hl = m.h[iz * W + Math.max(0, ix - 1)], hr = m.h[iz * W + Math.min(m.nx, ix + 1)], hd = m.h[Math.max(0, iz - 1) * W + ix], hu = m.h[Math.min(m.nz, iz + 1) * W + ix];
    const slope = Math.hypot(hr - hl, hu - hd) / 4;
    const n = fbm(u * 0.4, v * 0.4, 31);
    if (r === 7 || h < -0.3) c.set(h < -3 ? 0x8a8a6a : 0xd8c89a);
    else if (fl & FL.BAND) c.set(0xe8ecee).lerp(c2.set(0xcfd6da), n);
    else if (r === 2) c.set(0xf2f0ea).lerp(c2.set(0xe0dccf), n);
    else if (r === 3) c.set(G.f.elm === 'full' ? 0xeef2f7 : 0xc98a3e).lerp(c2.set(G.f.elm === 'full' ? 0xdfe6ee : 0xa86a2a), n);
    else if (r === 4) c.set(h > 13 ? 0xeef3fa : 0x8a9a7a).lerp(c2.set(h > 13 ? 0xdde6f0 : 0x7a8a6a), n);
    else if (r === 5) c.set(0xe6edf5).lerp(c2.set(0xd4dde8), n);
    else if (r === 6 && G.f.westDark) c.set(0x9aa6a0).lerp(c2.set(0xc8d0d4), n);
    else c.set(0x6fae4c).lerp(c2.set(0x94c45a), n);
    if (h > 0 && h < 1.6 && !(fl & FL.BAND) && r !== 2 && r !== 5) c.lerp(c2.set(0xe2d3a0), smooth(1.6, 0.6, h));
    if (slope > 0.75) c.lerp(c2.set(r === 4 || r === 5 ? 0x8f95a3 : 0x8a7c6a), smooth(0.75, 1.3, slope));
    if (fl & FL.VOID) c.set(h < -10 ? 0x3a3440 : 0x6a6070);
    if (fl & FL.ROAD) c.lerp(c2.set(r === 4 ? 0xb8b0a4 : r === 5 ? 0xc8c4bc : 0xc9a874), 0.85);
    if (fl & FL.TOWN && !(fl & FL.ROAD)) c.lerp(c2.set(r === 2 ? 0xe8dcc0 : r === 4 ? 0xe4e8ee : 0x9ab868), 0.3);
    if (fl & FL.LEY) c.lerp(c2.set(0x8ff0e0), 0.35);
    m.col[i * 3] = c.r; m.col[i * 3 + 1] = c.g; m.col[i * 3 + 2] = c.b;
  }
}

// ======================================================================
// 구조물 만들기
// ======================================================================
function wy(m, x, z) { return m.ground(x, z); }
function grp(m, x, z, y) { const g = new THREE.Group(); g.position.set(x, y ?? wy(m, x, z), z); m.group.add(g); return g; }
function shadowAll(g) { g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return g; }
function house(m, x, z, o = {}) {
  const w = o.w || 7, d = o.d || 6, h = o.h || 4.5, y = o.y ?? wy(m, x, z);
  const g = grp(m, x, z, y);
  mesh(geo('box', w, h, d), mat(o.wall || 0xefe6d6), 0, h / 2, 0, g);
  mesh(geo('box', w + 0.3, 0.4, d + 0.3), mat(o.trim || 0x7a5a42), 0, 0.2, 0, g);
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, Math.hypot(w, d) * 0.5 + 0.6, o.roofH || 3, 4, 1), mat(o.roof || 0xc4665a));
  roof.rotation.y = Math.PI / 4; roof.scale.set(w / Math.hypot(w, d) * 1.42, 1, d / Math.hypot(w, d) * 1.42);
  roof.position.y = h + (o.roofH || 3) / 2; g.add(roof);
  if (o.snow) { const s = roof.clone(); s.material = mat(0xf4f8fc); s.scale.multiplyScalar(0.98); s.position.y += 0.08; g.add(s); }
  mesh(geo('box', 1.2, 2.2, 0.15), mat(0x6b4630), 0, 1.1, d / 2 + 0.05, g);
  const lit = o.dark ? null : GLOW(0xffd88a, 1.3);
  for (const sx of [-w / 3, w / 3]) mesh(geo('box', 1, 1, 0.12), lit || mat(0x5a6a7a), sx, h * 0.6, d / 2 + 0.06, g);
  mesh(geo('box', 0.7, 1.6, 0.7), mat(0x8a6a5a), w * 0.25, h + 1.6, -d * 0.15, g);
  if (o.rot) g.rotation.y = o.rot;
  shadowAll(g);
  const a = o.rot ? Math.abs(Math.sin(o.rot)) > 0.5 : false;
  addStatic(m, { x: x, z: z, hw: (a ? d : w) / 2 + 0.1, hd: (a ? w : d) / 2 + 0.1, top: y + h, climb: true, stand: true });
  if (o.windows !== false) g.userData.windows = true;
  return g;
}
function obsTower(m, t) {
  const [x, z] = M_(t.u, t.v);
  const y = wy(m, x, z), g = grp(m, x, z, y);
  const sh = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 3.2, TOWER_H, 8, 4), mat(0x8a7a9a));
  sh.position.y = TOWER_H / 2; g.add(sh);
  for (let k = 0; k < 6; k++) mesh(geo('tor', 2.7 - k * 0.1, 0.18, 6, 16), mat(0xb8913a, { metal: 0.6, rough: 0.4 }), 0, 2 + k * 4.4, 0, g).rotation.x = Math.PI / 2;
  mesh(geo('cyl', 3.6, 3.0, 1.2, 10), mat(0x5a4a6a), 0, TOWER_H + 0.6, 0, g);
  // 사다리
  for (let k = 0; k < 24; k++) mesh(geo('box', 1.1, 0.12, 0.12), mat(0xa7782f), 0, 1 + k * 1.05, 3.05 - k * 0.04, g);
  mesh(geo('box', 0.12, TOWER_H, 0.12), mat(0x8a5a2a), -0.55, TOWER_H / 2, 2.6, g); mesh(geo('box', 0.12, TOWER_H, 0.12), mat(0x8a5a2a), 0.55, TOWER_H / 2, 2.6, g);
  // 꼭대기 공명 결정
  const cr = mesh(geo('oct', 0.9), GLOW(0xff8f5a, 2.4), 0, TOWER_H + 3, 0, g);
  t.crystal = cr; t.group = g;
  shadowAll(g);
  addStatic(m, { x, z, r: 3.0, top: y + TOWER_H + 1.2, climb: true, ladder: true, stand: true, tower: t.id });
}
function shrine(m, x, z, i) {
  const y = wy(m, x, z), g = grp(m, x, z, y);
  const p = new THREE.Mesh(new THREE.ConeGeometry(4.2, 6, 4), mat(0x4c5f7a, { rough: 0.5 }));
  p.rotation.y = Math.PI / 4; p.position.y = 3; g.add(p);
  const tri = mesh(geo('cone', 1.2, 2.2, 3), GLOW(0x7ff0ff, 2.2), 0, 1.6, 2.4, g);
  tri.rotation.x = 0.4;
  mesh(geo('box', 9, 0.5, 9), mat(0x6a7a8a), 0, 0.25, 0, g);
  const rd = runeDisc(0x7ff0ff, 7, 1.4); rd.position.y = 0.55; g.add(rd);
  m.anims.push(t => { rd.rotation.z = t * 0.2; tri.material.color.setHex(isDone('lab:' + i) ? 0xffd27a : 0x7ff0ff).multiplyScalar(2.2); });
  shadowAll(g);
  addStatic(m, { x, z: z - 0.8, hw: 2.8, hd: 2.4, top: y + 4, climb: true });
}
function pillarBeam(m, x, z, color, flagFixed, flagOff, flicker) {
  const y = wy(m, x, z);
  const mt = beamMat(color);
  const b = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.6, 520, 12, 1, true), mt);
  b.position.set(x, y + 260, z);
  b.renderOrder = 8;
  m.group.add(b);
  const seed = Math.random() * 10;
  m.anims.push(t => {
    mt.uniforms.t.value = t;
    if (flagOff && G.f[flagOff]) { b.visible = false; return; }
    b.visible = true;
    const fixed = flagFixed ? G.f[flagFixed] : !flicker;
    mt.uniforms.a.value = fixed ? 0.55 : (Math.sin(t * 7 + seed) > 0.25 ? 0.55 : 0.12) * (0.7 + Math.random() * 0.3);
  });
}
function floatingIsland(m, x, z, y, s) {
  const g = new THREE.Group(); g.position.set(x, y, z); m.group.add(g);
  const rock = new THREE.Mesh(new THREE.ConeGeometry(14 * s, 22 * s, 7), mat(0x8a7a6a));
  rock.rotation.x = Math.PI; rock.position.y = -11 * s; g.add(rock);
  const top = mesh(new THREE.CylinderGeometry(14 * s, 13 * s, 3 * s, 7), mat(0x6fae4c), 0, 0, 0, g);
  for (let k = 0; k < 5; k++) { const tr = mesh(geo('ico', 3 * s, 0), mat(k % 2 ? 0x4f9a52 : 0x5fae5a), rand(-8, 8) * s, 4 * s, rand(-8, 8) * s, g); tr.scale.y = 1.3; mesh(geo('cyl', 0.4 * s, 0.6 * s, 3 * s), mat(0x6a4a2a), tr.position.x, 1.5 * s, tr.position.z, g); }
  for (let k = 0; k < 3; k++) mesh(geo('oct', 1.2 * s), GLOW(0x7ff0ff, 2), rand(-10, 10) * s, -6 * s - k * 3, rand(-10, 10) * s, g);
  const fall = mesh(geo('cyl', 0.8 * s, 1.6 * s, 40 * s, 8, 1, true), ADD(0x9ff4ff, 1.2, 0.35), 9 * s, -20 * s, 3 * s, g);
  shadowAll(g); fall.castShadow = false;
  const ph = Math.random() * 6;
  m.anims.push(t => { g.position.y = y + Math.sin(t * 0.3 + ph) * 1.5; g.rotation.y = t * 0.01 + ph; });
  m.islands.push({ g, x, z, y, s });
}
function leyRibbons(m) {
  const mt = new THREE.ShaderMaterial({
    uniforms: { t: GFX.timeU, c: { value: COL(0x7ff0ff) } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: 'uniform float t; uniform vec3 c; varying vec2 vUv; void main(){ float e = 1.0 - abs(vUv.y - 0.5) * 2.0; float p = pow(fract(vUv.x * 0.025 - t * 0.35), 6.0); float a = e * e * (0.28 + p * 0.9); gl_FragColor = vec4(c * (1.2 + p * 2.5), a); }',
  });
  for (const L of m.leys) {
    const pos = [], uv = [], idx = [];
    let d = 0;
    for (let k = 0; k < L.length - 1; k++) {
      const [ax, az] = L[k], [bx, bz] = L[k + 1], l = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / l, nz = (bx - ax) / l;
      for (let t = 0; t < l; t += 2) {
        const x = lerp(ax, bx, t / l), z = lerp(az, bz, t / l);
        // 물과 협곡 위는 건너뛴다
        const y = Math.max(m.ground(x, z), 0) + 0.08, w = 0.9 + Math.sin(d * 0.07) * 0.25;
        const b = pos.length / 3;
        pos.push(x + nx * w, m.ground(x + nx * w, z + nz * w) + 0.08, z + nz * w, x - nx * w, m.ground(x - nx * w, z - nz * w) + 0.08, z - nz * w);
        uv.push(d, 0, d, 1);
        if (b > 0) idx.push(b - 2, b, b - 1, b - 1, b, b + 1);
        d += 2;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    const me = new THREE.Mesh(g, mt); me.renderOrder = 3; m.group.add(me);
  }
}

// ---------- 나무와 바위 (인스턴스) ----------
function makeTreeGeos() {
  if (GFX.treeGeos) return GFX.treeGeos;
  const merge = parts => {
    const pos = [], nor = [], col = [], idx = [];
    for (const [g0, c, mx] of parts) {
      const g = g0.index ? g0.toNonIndexed() : g0.clone();
      g.applyMatrix4(mx);
      g.computeVertexNormals();
      const b = pos.length / 3, P = g.attributes.position.array, N = g.attributes.normal.array, cc = COL(c);
      for (let k = 0; k < P.length; k += 3) { pos.push(P[k], P[k + 1], P[k + 2]); nor.push(N[k], N[k + 1], N[k + 2]); col.push(cc.r, cc.g, cc.b); }
      for (let k = 0; k < P.length / 3; k++) idx.push(b + k);
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); out.setIndex(idx);
    return out;
  };
  const M4 = (x, y, z, s = 1, sy) => new THREE.Matrix4().compose(V3(x, y, z), new THREE.Quaternion(), V3(s, sy ?? s, s));
  const trunk = c => [new THREE.CylinderGeometry(0.22, 0.38, 3, 6), c || 0x6a4a2a, M4(0, 1.5, 0)];
  GFX.treeGeos = {
    oak: merge([trunk(), [new THREE.IcosahedronGeometry(2.2, 1), 0xffffff, M4(0, 4.2, 0, 1, 0.85)], [new THREE.IcosahedronGeometry(1.5, 1), 0xf0f0f0, M4(1.2, 3.6, 0.6)], [new THREE.IcosahedronGeometry(1.4, 1), 0xe8e8e8, M4(-1.1, 3.8, -0.5)]]),
    pine: merge([trunk(), [new THREE.ConeGeometry(2.0, 3.2, 7), 0xffffff, M4(0, 3.4, 0)], [new THREE.ConeGeometry(1.6, 2.8, 7), 0xf4f4f4, M4(0, 4.9, 0)], [new THREE.ConeGeometry(1.1, 2.2, 7), 0xeeeeee, M4(0, 6.2, 0)]]),
    dead: merge([trunk(0x8a7a6a), [new THREE.CylinderGeometry(0.06, 0.14, 1.8, 5), 0x8a7a6a, new THREE.Matrix4().makeRotationZ(0.8).setPosition(0.6, 2.8, 0)], [new THREE.CylinderGeometry(0.06, 0.14, 1.5, 5), 0x8a7a6a, new THREE.Matrix4().makeRotationZ(-0.9).setPosition(-0.5, 2.4, 0)]]),
    crystal: merge([trunk(0xd8d0e8), [new THREE.OctahedronGeometry(1.1, 0), 0xffffff, M4(0, 3.8, 0, 1, 1.8)], [new THREE.OctahedronGeometry(0.7, 0), 0xffffff, M4(0.9, 3.2, 0.3, 1, 1.6)], [new THREE.OctahedronGeometry(0.6, 0), 0xffffff, M4(-0.8, 3.4, -0.4, 1, 1.5)]]),
  };
  return GFX.treeGeos;
}
function scatterWorld(m) {
  const geos = makeTreeGeos();
  const lists = { oak: [], pine: [], dead: [], crystal: [], rock: [], salt: [], leaf: [], drop: [] };
  const exclude = [];
  for (const e of m.ents) if (['warp', 'npc', 'sign', 'fire', 'tower', 'chest', 'curtain'].includes(e.type)) exclude.push([e.x, e.z, e.type === 'warp' ? 6 : 3.5]);
  for (const b of m.statics) if (b.hw) exclude.push([b.x, b.z, Math.max(b.hw, b.hd) + 3]);
  const S = 5;
  for (let gz = 1; gz < WORLD_D / S - 1; gz++) for (let gx = 1; gx < WORLD_W / S - 1; gx++) {
    const x = (gx + hash2(gx, gz, 11)) * S, z = (gz + hash2(gx, gz, 12)) * S;
    const f = m.flagAt(x, z);
    if (f & (FL.ROAD | FL.VOID | FL.TOWN | FL.BAND)) continue;
    const y = m.ground(x, z);
    if (y < 0.6) continue;
    const r = m.regionAt(x, z), u = x / WS, v = z / WS;
    const sl = Math.abs(m.ground(x + 1.5, z) - m.ground(x - 1.5, z)) + Math.abs(m.ground(x, z + 1.5) - m.ground(x, z - 1.5));
    if (sl > 2.2) { if (hash2(gx, gz, 15) < 0.08 && r !== 5) lists.rock.push([x, y, z, rand(0.8, 2.2)]); continue; }
    let near = false;
    for (const [ex, ez, er] of exclude) if (Math.abs(ex - x) < er && Math.abs(ez - z) < er) { near = true; break; }
    if (near) continue;
    const h = hash2(gx, gz, 13), grove = fbm(u * 0.08, v * 0.08, 14);
    if (f & FL.LEY) { if (h < 0.04) lists.crystal.push([x, y, z, rand(0.8, 1.3)]); continue; }
    let sp = null;
    if (r === 0 || r === 6) { if ((grove > 0.6 && h < 0.55) || h < 0.025) sp = h < 0.15 && grove > 0.6 ? 'pine' : 'oak'; else if (h > 0.985) sp = 'rock'; }
    else if (r === 3) { if (grove > 0.4 && h < 0.6) sp = h < 0.25 ? 'pine' : 'oak'; else if (h > 0.97) sp = 'rock'; }
    else if (r === 4) { if (h < 0.1 && y < 30) sp = 'pine'; else if (h > 0.93) sp = 'rock'; }
    else if (r === 2) { if (h < 0.012) sp = 'dead'; else if (h > 0.94) sp = 'salt'; }
    else if (r === 5) { if (h > 0.97) sp = 'rock'; }
    if (!sp) continue;
    const s = sp === 'rock' ? rand(0.6, 2.4) : rand(0.8, 1.35);
    lists[sp].push([x, y, z, s, r]);
    if (sp !== 'salt') addStatic(m, { x, z, r: sp === 'rock' ? s * 0.9 : 0.45, top: y + (sp === 'rock' ? s * 1.1 : 7), climb: sp === 'rock', stand: sp === 'rock' });
  }
  // 엘름바텐: 멈춘 낙엽과 빗방울
  for (let k = 0; k < 2600; k++) {
    const x = rand(138, 196) * WS, z = rand(40, 116) * WS;
    if (m.regionAt(x, z) !== 3) continue;
    const y = m.ground(x, z);
    if (y < 1) continue;
    (k % 4 ? lists.leaf : lists.drop).push([x, y + rand(0.6, 5), z, 1]);
  }
  const mx = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
  const make = (key, g, material, list, tint) => {
    if (!list.length) return null;
    const im = new THREE.InstancedMesh(g, material, list.length);
    list.forEach(([x, y, z, s, r], k) => {
      e.set(key === 'leaf' ? rand(6) : 0, hash2(k, 3) * 6.28, key === 'leaf' ? rand(6) : 0); q.setFromEuler(e);
      mx.compose(V3(x, y - (key === 'rock' ? s * 0.3 : 0), z), q, V3(s, key === 'rock' ? s * 0.7 : s, s));
      im.setMatrixAt(k, mx);
      if (tint) { tint(c, r, k, x, z); im.setColorAt(k, c); }
    });
    im.castShadow = key !== 'leaf' && key !== 'drop'; im.receiveShadow = true;
    m.group.add(im);
    return im;
  };
  const vc = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true });
  const forestTint = (cc, r, k) => {
    if (r === 3) cc.set(G.f.elm === 'full' ? 0xe8eef4 : [0xe07a2a, 0xd8a02a, 0xc8582a, 0xe8b040][k % 4]);
    else if (r === 4) cc.set(0xdfe8f0);
    else if (r === 6 && G.f.westDark) cc.set(0x9aa8a0);
    else cc.set([0x4f9a42, 0x5fae4a, 0x3f8a3a, 0x6ab84a][k % 4]);
  };
  m.trees = {
    oak: make('oak', geos.oak, vc, lists.oak, forestTint),
    pine: make('pine', geos.pine, vc, lists.pine, (cc, r, k) => cc.set(r === 4 || (r === 3 && G.f.elm === 'full') ? 0xdfe8ee : [0x2f6a48, 0x3a7a52][k % 2])),
    dead: make('dead', geos.dead, vc, lists.dead),
    crystal: make('crystal', geos.crystal, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, emissive: COL(0x3ac8d8), emissiveIntensity: 1.4, roughness: 0.3 }), lists.crystal),
    rock: make('rock', geo('dod', 1), mat(0x9a9488), lists.rock, (cc, r) => cc.set(r === 4 || r === 5 ? 0xa8b0bc : r === 2 ? 0xf0f4f6 : 0x9a9488)),
    salt: make('salt', geo('cone', 0.7, 2.6, 5), mat(0xf6fafc, { rough: 0.3 }), lists.salt),
    leaf: make('leaf', geo('plane', 0.45, 0.3), new THREE.MeshLambertMaterial({ color: 0xe0802a, side: THREE.DoubleSide }), lists.leaf, (cc, r, k) => cc.set([0xffffff, 0xfff0a0, 0xffc080][k % 3])),
    drop: make('drop', geo('box', 0.04, 0.3, 0.04), GLOW(0xbfe6ff, 1.2), lists.drop),
  };
  m.treeLists = lists;
}
function retintWorld(m) {
  // 계절과 불빛이 바뀌면 다시 칠한다
  if (!m.group) return;
  colorWorld(m);
  if (m.terrainGroup) { m.group.remove(m.terrainGroup); }
  m.terrainGroup = new THREE.Group(); buildTerrainMeshes(m, m.terrainGroup); m.group.add(m.terrainGroup);
  for (const k of ['oak', 'pine', 'leaf', 'drop']) if (m.trees[k]) m.group.remove(m.trees[k]);
  const lists = m.treeLists, c = new THREE.Color(), geos = makeTreeGeos();
  const vc = m.trees.oak.material;
  const tintOak = (r, k) => r === 3 ? (G.f.elm === 'full' ? 0xe8eef4 : [0xe07a2a, 0xd8a02a, 0xc8582a, 0xe8b040][k % 4]) : r === 4 ? 0xdfe8f0 : (r === 6 && G.f.westDark ? 0x9aa8a0 : [0x4f9a42, 0x5fae4a, 0x3f8a3a, 0x6ab84a][k % 4]);
  for (const [key, list, fn] of [['oak', lists.oak, tintOak], ['pine', lists.pine, (r, k) => r === 4 || (r === 3 && G.f.elm === 'full') ? 0xdfe8ee : [0x2f6a48, 0x3a7a52][k % 2]]]) {
    const im = m.trees[key]; m.group.add(im);
    list.forEach(([x, y, z, s, r], k) => { c.set(fn(r, k)); im.setColorAt(k, c); });
    im.instanceColor.needsUpdate = true;
  }
  const frozen = G.f.elm !== 'full';
  if (frozen) { m.group.add(m.trees.leaf); m.group.add(m.trees.drop); }
  m.season = seasonSig();
}
const seasonSig = () => `${G.f.elm || ''}|${G.f.westDark ? 1 : 0}`;

// ======================================================================
// 대륙 위의 장소들
// ======================================================================
function populateWorld(m) {
  m.group = new THREE.Group(); m.anims = []; m.islands = [];
  const A = (type, u, v, props = {}) => {
    const [x, z] = M_(u, v);
    props.id = props.id || `world:${type}:${u},${v}`;
    const e = makeEnt(type, x, z, props);
    m.ents.push(e); return e;
  };
  m.A = A;
  // 칼리도르 성벽
  {
    const [x0, z0] = [92 * WS, 117.5 * WS], [x1, z1] = [109 * WS, 133 * WS], y = 4.2, H = 11;
    const wallM = mat(0xd8cbb0), g = new THREE.Group(); m.group.add(g);
    const seg = (ax, az, bx, bz) => {
      const l = Math.hypot(bx - ax, bz - az), cx = (ax + bx) / 2, cz = (az + bz) / 2;
      const w = mesh(geo('box', l, H, 3), wallM, cx, y + H / 2, cz, g); w.rotation.y = -Math.atan2(bz - az, bx - ax);
      for (let k = 0; k < l / 3; k++) { const b = mesh(geo('box', 1.4, 1.2, 3.2), wallM, 0, 0, 0, g); b.position.set(lerp(ax, bx, (k + 0.5) / (l / 3)), y + H + 0.6, lerp(az, bz, (k + 0.5) / (l / 3))); b.rotation.y = w.rotation.y; }
      if (Math.abs(bx - ax) > Math.abs(bz - az)) addStatic(m, { x0: Math.min(ax, bx), x1: Math.max(ax, bx), z0: cz - 1.6, z1: cz + 1.6, top: y + H, climb: false });
      else addStatic(m, { x0: cx - 1.6, x1: cx + 1.6, z0: Math.min(az, bz), z1: Math.max(az, bz), top: y + H, climb: false });
    };
    const gx = 100.5 * WS;
    seg(x0, z0, gx - 5, z0); seg(gx + 5, z0, x1, z0); seg(x1, z0, x1, z1); seg(x1, z1, x0, z1); seg(x0, z1, x0, z0);
    for (const [cx, cz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1], [gx - 6, z0], [gx + 6, z0]]) {
      mesh(geo('cyl', 3.2, 3.6, H + 5, 10), wallM, cx, y + (H + 5) / 2, cz, g);
      mesh(geo('cone', 4, 5, 10), mat(0x4a5a9a), cx, y + H + 7.5, cz, g);
      addStatic(m, { x: cx, z: cz, r: 3.6, top: y + H + 5 });
    }
    // 성문 아치
    mesh(geo('box', 12, 3, 4), wallM, gx, y + H - 1.5, z0, g);
    // 안쪽 도시의 윤곽: 지붕, 돔, 학원 첨탑
    for (let k = 0; k < 26; k++) {
      const hx = rand(x0 + 8, x1 - 8), hz = rand(z0 + 10, z1 - 8), hh = rand(6, 12);
      mesh(geo('box', rand(5, 9), hh, rand(5, 9)), mat(pick([0xefe2c8, 0xe8d4b4, 0xf4ecdc])), hx, y + hh / 2, hz, g);
      mesh(geo('cone', 5, 4, 4), mat(pick([0xc4665a, 0x4a6aa8, 0xb8783a])), hx, y + hh + 2, hz, g).rotation.y = Math.PI / 4;
    }
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2 + 6;
    mesh(geo('sph', 12, 20, 12), mat(0x8aa8d8, { rough: 0.35, metal: 0.3 }), cx + 14, y + 10, cz - 10, g).scale.y = 0.7;
    mesh(geo('cyl', 3, 4, 34, 10), mat(0xefe6d6), cx - 6, y + 17, cz, g);
    mesh(geo('cone', 4.5, 10, 10), mat(0x4a5a9a), cx - 6, y + 39, cz, g);
    const crown = mesh(geo('oct', 2.2), GLOW(0x7ff0ff, 2.6), cx - 6, y + 47, cz, g);
    m.anims.push(t => { crown.rotation.y = t * 0.6; crown.position.y = y + 47 + Math.sin(t) * 0.6; });
    // 도시 안쪽은 들어갈 수 없다
    addStatic(m, { x0: x0 + 1.6, x1: x1 - 1.6, z0: z0 + 1.6, z1: z1 - 1.6, top: y + 60 });
    shadowAll(g);
  }
  A('warp', 100, 116.6, { look: 'gate', to: 'kalidor', tx: 32, ty: 3, label: '칼리도르 성문', rad: 4 });
  A('sign', 103, 112, { title: '이정표', text: '서쪽: 마르셀라 해안 · 동쪽: 엘름바텐 숲 · 북쪽: 그라벤호프 산지\n북서쪽 구름 위: 알테라 고원 (출입 금지)' });
  A('npc', 97, 113, { name: '성문지기', talk: 'gatekeeper', look: { cloak: '#6a6a7a', hair: '#3a2a1a', hat: '#4a4a5a' } });

  // 관측탑, 모닥불, 실험실
  for (const t of TOWERS) { obsTower(m, t); A('tower', t.u, t.v + 0.62, { id: t.id, tname: t.name, rad: t.r }); A('fire', t.u + 2.2, t.v + 2.2, { id: 'fire:' + t.id }); }
  LABS.forEach(([u, v], i) => { const [x, z] = M_(u, v); shrine(m, x, z, i); A('warp', u, v + 0.55, { look: 'lab', lab: i, to: 'lab' + i, tx: 8, ty: 10, label: '봉인 실험실', rad: 1.6 }); });

  // 마르셀라
  {
    const [cx, cz] = M_(22, 77.5), y = wy(m, cx, cz);
    const g = grp(m, cx, cz, y);
    mesh(geo('box', 30, 14, 22), mat(0xeef0f2, { rough: 0.6 }), 0, 7, 0, g);
    const roof = mesh(new THREE.CylinderGeometry(0.01, 20, 8, 4), mat(0x5a8ab8), 0, 18, 0, g); roof.rotation.y = Math.PI / 4; roof.scale.set(1.05, 1, 0.78);
    mesh(geo('box', 8, 30, 8), mat(0xeef0f2, { rough: 0.6 }), -11, 15, -6, g);
    mesh(geo('cone', 6, 9, 4), mat(0x5a8ab8), -11, 34.5, -6, g).rotation.y = Math.PI / 4;
    const bell = mesh(geo('cone', 2, 3, 12), mat(0xc8a04a, { metal: 0.7, rough: 0.3 }), -11, 26, -1.8, g);
    // 종루의 거대한 팔
    const arm = new THREE.Group(); arm.position.set(-11, 24, -1.6); g.add(arm);
    mesh(geo('box', 1.2, 1.2, 16), mat(0xb88a3a, { metal: 0.6, rough: 0.35 }), 0, 0, 8, arm);
    mesh(geo('tor', 2.2, 0.4, 8, 16), mat(0xb88a3a, { metal: 0.6, rough: 0.35 }), 0, 0, 0, arm);
    m.anims.push(t => { arm.rotation.x = G.f.eng_marcella ? Math.sin(t * 0.3) * 0.15 : Math.sin(t * 3.1) * 0.06 + 0.2; });
    for (let k = -2; k <= 2; k++) { const w = mesh(geo('box', 2.2, 5, 0.2), GLOW(k % 2 ? 0x9ff4ff : 0xd8b8ff, 1.5), k * 5.4, 8, 11.1, g); }
    mesh(geo('box', 5, 7, 1), mat(0xd8d0c0), 0, 3.5, 11.2, g);
    mesh(geo('box', 3.4, 5.6, 0.4), GLOW(0x9ff4ff, 1.2), 0, 2.8, 11.6, g);
    shadowAll(g);
    addStatic(m, { x: cx, z: cz, hw: 15, hd: 11, top: y + 14, climb: true, stand: true });
    addStatic(m, { x: cx - 11, z: cz - 6, hw: 4, hd: 4, top: y + 30, climb: true, stand: true });
    for (const [u, v, c] of [[30, 85, 0x5a8ab8], [38, 85, 0xc46a5a], [30, 92, 0x5aa88a], [38, 92, 0xd8a04a], [27, 89, 0x5a8ab8], [41, 89, 0xc46a5a]]) { const [x, z] = M_(u, v); house(m, x, z, { roof: c, wall: 0xf6f0e4, rot: u < 34 ? Math.PI / 2 : -Math.PI / 2 }); }
  }
  A('warp', 22, 81.2, { look: 'arch', to: 'cathedral', tx: 23, ty: 34, label: '성녀 마렌 성당', rad: 2.4 });
  A('npc', 25, 84.5, { name: '대사제 오렐리아', talk: 'priest', look: { cloak: '#f4f4f8', body: '#e8e8f0', hair: '#c8b8a8', hat: '#d8c070' } });
  A('npc', 34, 89, { name: '어부 노엘', talk: 'fisher', look: { cloak: '#3a6a8a', hair: '#5a3a2a' }, wander: 6 });
  A('npc', 36, 87.2, { name: '염전 상인', talk: 'saltshop', shop: 'salt', look: { cloak: '#e8e0cf', body: '#fff', hair: '#2a2a2a' } });
  A('npc', 32, 88.5, { name: '생선 장수', talk: 'fishshop', shop: 'fish', look: { cloak: '#5a8ab8', hair: '#8a5a3a' } });
  A('npc', 44, 84, { name: '순례자 안나', talk: 'pilgrim', look: { cloak: '#d8d0c0', hair: '#5a4a3a', hat: '#c8b898' } });
  A('npc', 48, 96, { name: '순례자', talk: 'pilgrim2', look: { cloak: '#d8d0c0', hair: '#8a6a4a' }, wander: 10 });
  A('collect', 33.4, 90.6, { key: 'chronicle' });
  A('deco', 34, 86.5, { kind: 'festival', show: () => G.f.eng_marcella });
  A('deco', 11, 90, { kind: 'boat', show: () => coastP() > 0.6 }); A('deco', 9, 96, { kind: 'boat', show: () => coastP() > 0.8 });
  A('fire', 36, 92.4, { id: 'fire:marcella' });

  // 엘름바텐 마을과 시계탑
  for (const [u, v, c] of [[153, 76, 0xa85a3a], [163, 76, 0x8a6a3a], [153, 84, 0x7a5a3a], [163, 85, 0xb8783a]]) { const [x, z] = M_(u, v); house(m, x, z, { roof: c, wall: 0xe8dcc4, trim: 0x5a3a2a }); }
  {
    const [cx, cz] = M_(178, 61), y = wy(m, cx, cz);
    const g = grp(m, cx, cz, y);
    mesh(geo('box', 10, 34, 10), mat(0x8a6a4a), 0, 17, 0, g);
    mesh(geo('box', 11, 2, 11), mat(0x5a3a2a), 0, 34, 0, g);
    mesh(geo('cone', 8, 9, 4), mat(0x6a3a2a), 0, 39.5, 0, g).rotation.y = Math.PI / 4;
    const face = mesh(geo('circle', 3.6, 32), GLOW(0xffd898, 1.6), 0, 27, 5.06, g);
    const hand = mesh(geo('box', 0.3, 3, 0.1), mat(0x3a2a1a), 0, 27, 5.12, g);
    const hand2 = mesh(geo('box', 0.25, 2.2, 0.1), mat(0x3a2a1a), 0, 27, 5.14, g);
    const gears = [];
    for (const [gx, gy, r] of [[-5.3, 12, 2.6], [5.3, 18, 2], [-5.3, 22, 1.6]]) { const ge = mesh(geo('tor', r, 0.5, 6, 12), mat(0xc8a04a, { metal: 0.6, rough: 0.4 }), gx, gy, 0, g); ge.rotation.y = Math.PI / 2; gears.push(ge); }
    m.anims.push(t => {
      const fixed = G.f.elm === 'full';
      const k = fixed ? t : (G.f.elm === 'stable' ? Math.sin(t * 0.3) * 0.1 : 0.3);
      hand.rotation.z = -k * 0.2; hand.position.set(Math.sin(k * 0.2) * 1.5, 27 + Math.cos(k * 0.2) * 1.5, 5.12);
      hand2.rotation.z = -k * 2.4;
      gears.forEach((ge, i) => ge.rotation.x = (fixed ? t : Math.sin(t * 6) * 0.03) * (i % 2 ? -0.6 : 0.6));
    });
    shadowAll(g); face.castShadow = false;
    addStatic(m, { x: cx, z: cz, hw: 5, hd: 5, top: y + 34, climb: true, stand: true });
  }
  A('npc', 157, 79, { name: '촌장 브람', talk: 'chief', look: { cloak: '#7a5a3a', hair: '#8a7a6a' } });
  A('npc', 166, 80, { name: '헤다', talk: 'hedda', look: { cloak: '#9a6a8a', hair: '#eeeeee', body: '#f0e6d0' }, show: () => !G.f.heddaGone });
  A('deco', 167, 82, { kind: 'flowerbed' }); A('deco', 165, 82, { kind: 'flowerbed' }); A('deco', 166, 83, { kind: 'grave', show: () => G.f.heddaGone });
  A('npc', 155, 83, { name: '마을 아이 테오', talk: 'teo', look: { cloak: '#c8782a', hair: '#5a3a2a', scale: 0.75 }, wander: 4 });
  A('npc', 160, 84, { name: '숲 상인', talk: 'elmshop', shop: 'elm', look: { cloak: '#5a7a3a', hair: '#3a2a1a' }, show: () => G.f.elm === 'full' });
  A('npc', 150, 80, { name: '사냥꾼 오드', talk: 'hunter', look: { cloak: '#6a5a3a', hair: '#2a2a1a', hat: '#4a3a2a' }, show: () => G.f.elm === 'full' });
  A('collect', 154, 81, { key: 'ledger' });
  A('curtain', 163, 66, { w: 18 });
  A('warp', 178, 62.2, { look: 'door', to: 'clock', tx: 21, ty: 39, label: '시계탑 기관', rad: 2.2 });
  // 협곡을 건너는 낙엽 발판 (서쪽)
  { const [x0, z0] = M_(168.6, 62), y = wy(m, x0 - 4, z0) + 0.4; [[0, 1], [3.4, 0], [6.8, 1], [10.2, 0], [13.6, 1]].forEach(([dx, fixed], k) => A('leaf', 0, 0, { id: 'leafW' + k, exactM: [x0 + dx + 1.5, z0], hy: y, fixed: !!fixed, dz: fixed ? 0 : 3.2, speed: 0.7 + k * 0.1 })); }
  A('sign', 166.5, 63.5, { text: '공중에 멈춘 낙엽은 밟을 수 있다. 흔들리는 잎은 정체 룬(2)으로 그 자리에 붙들 수 있다.\n협곡 위를 활공으로 건너는 사람도 있다고 한다.' });
  A('fire', 156, 86, { id: 'fire:elm' });

  // 그라벤호프
  for (const [u, v] of [[94, 16], [94, 24], [106, 24], [91, 20]]) { const [x, z] = M_(u, v); house(m, x, z, { roof: 0x5a5a6a, wall: 0xc8c0b8, snow: true, rot: u < 100 ? Math.PI / 2 : 0 }); }
  {
    const [x, z] = M_(108, 17), y = wy(m, x, z), g = grp(m, x, z, y);
    for (const [a, b] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) mesh(geo('box', 0.5, 16, 0.5), mat(0x6a4a2a), a, 8, b, g);
    mesh(geo('box', 5, 0.6, 5), mat(0x6a4a2a), 0, 16, 0, g);
    mesh(geo('cyl', 1.4, 1.4, 1, 12), mat(0x8a8a90, { metal: 0.6 }), 0, 16.8, 0, g).rotation.z = Math.PI / 2;
    mesh(geo('box', 3, 2.4, 3), mat(0x7a6a5a), 0, 4, 0, g);
    shadowAll(g); addStatic(m, { x, z, hw: 2.6, hd: 2.6, top: y + 16.3, climb: true, stand: true });
    // 갱 입구
    const [mx, mz] = M_(106, 11.4), my = wy(m, mx, mz), mg = grp(m, mx, mz, my);
    mesh(geo('box', 9, 8, 3), mat(0x6a6070), 0, 4, -1, mg);
    mesh(geo('box', 5, 5.4, 3.2), mat(0x141014), 0, 2.7, -0.9, mg);
    for (const sx of [-2.8, 2.8]) mesh(geo('box', 0.6, 6, 0.6), mat(0x6a4a2a), sx, 3, 0.7, mg);
    mesh(geo('box', 6.4, 0.6, 0.6), mat(0x6a4a2a), 0, 6, 0.7, mg);
    mesh(geo('sph', 0.35), GLOW(0xffb35a, 2.2), 2.8, 5, 1.1, mg);
    shadowAll(mg);
  }
  A('npc', 102, 18, { name: '감독관 하르트만', talk: 'overseer', look: { cloak: '#2a3a5a', hair: '#5a5a5a', hat: '#1a2a4a' } });
  A('npc', 104, 15, { name: '광부 가족 엘사', talk: 'elsa', look: { cloak: '#7a5a5a', hair: '#3a2a1a' } });
  for (const [u, v] of [[103, 13.5], [101.5, 14.5], [107, 15.6]]) A('npc', u, v, { name: '광부 가족', talk: 'family', look: { cloak: pick(['#6a5a4a', '#5a4a5a', '#4a5a5a']), hair: '#2a2a2a' }, show: () => !G.f.eng_grav });
  A('npc', 98, 22, { name: '대장장이 그레타', talk: 'gravshop', shop: 'grav', look: { cloak: '#5a3a2a', hair: '#c87a3a' } });
  A('npc', 96, 18, { name: '구조된 광부 요나스', talk: 'miner', look: { cloak: '#6a5a4a', hair: '#3a2a1a', hat: '#d8b030' }, show: () => G.f.rescued > 0 });
  A('warp', 106, 12, { look: 'cave', to: 'mine', tx: 4, ty: 4, label: '그라벤호프 제3갱', rad: 2.4 });
  A('fire', 99, 25, { id: 'fire:grav' });

  // 고원: 폐허, 끊긴 다리, 프리마
  {
    const ruinM = mat(0xd8d2c4), g = new THREE.Group(); m.group.add(g);
    for (let k = 0; k < 70; k++) {
      const u = rand(10, 60), v = rand(7, 41);
      if (plateauDist(u, v) < 2 || (v > 26 && v < 32) || (u > 33 && u < 40 && v < 28)) continue;
      const [x, z] = M_(u, v), y = wy(m, x, z), h = rand(3, 9), broken = Math.random() < 0.6;
      const p = mesh(geo('cyl', 0.8, 0.95, h, 8), ruinM, x, y + h / 2, z, g);
      if (broken) p.rotation.z = rand(-0.12, 0.12);
      addStatic(m, { x, z, r: 0.95, top: y + h, climb: true, stand: true });
      if (Math.random() < 0.25) { const s = mesh(geo('box', 2.4, 1.2, 2.4), ruinM, x + rand(-4, 4), 0, z + rand(-4, 4), g); s.position.y = m.ground(s.position.x, s.position.z) + rand(4, 9); s.rotation.set(rand(6), rand(6), rand(6)); const ph = rand(6), y0 = s.position.y; m.anims.push(t => { s.position.y = y0 + Math.sin(t * 0.7 + ph) * 0.6; s.rotation.y += 0.002; }); }
    }
    // 끊긴 다리 끝 (높은 받침): 활공으로 건넌다
    const stub = (u, v, w, d) => { const [x, z] = M_(u, v), y = wy(m, x, z); mesh(geo('box', w, 4, d), ruinM, x, y + 2, z, g); addStatic(m, { x, z, hw: w / 2, hd: d / 2, top: y + 4, climb: true, stand: true }); for (let k = 0; k < 3; k++) mesh(geo('box', 1, 1.4, 1), ruinM, x - w / 2 + 0.5 + k * (w - 1) / 2, y + 4.7, z + (k % 2 ? d / 2 - 0.5 : -d / 2 + 0.5), g); };
    stub(30.5, 25.4, 12, 7); stub(30.5, 32.6, 12, 7); stub(40.4, 16, 6, 12); stub(32.6, 16, 6, 12);
    // 프리마
    const [px, pz] = M_(22, 7.5), py = wy(m, px, pz);
    const pg = grp(m, px, pz, py);
    mesh(geo('cyl', 16, 18, 4, 16), ruinM, 0, 2, -4, pg);
    mesh(geo('cyl', 9, 12, 26, 12), mat(0xc8c2d8), 0, 15, -6, pg);
    mesh(geo('cone', 9, 18, 12), mat(0xb8b0d0), 0, 37, -6, pg);
    for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; mesh(geo('cyl', 0.9, 1.1, 14, 8), ruinM, Math.cos(a) * 15, 9, -4 + Math.sin(a) * 15, pg); }
    const rings = [];
    for (let k = 0; k < 3; k++) { const r = mesh(geo('tor', 14 + k * 3, 0.35, 6, 48), GLOW(0xc0b0ff, 1.8), 0, 24 + k * 5, -6, pg); r.rotation.x = Math.PI / 2 + 0.2 * k; rings.push(r); }
    const door = mesh(geo('box', 7, 10, 1), GLOW(0xc0b0ff, 0.9), 0, 5, 6, pg);
    m.anims.push(t => { rings.forEach((r, i) => { r.rotation.z = t * (0.1 + i * 0.05) * (i % 2 ? -1 : 1); r.visible = !G.f.primaStop; }); door.material = G.f.primaStop ? mat(0x4a4458) : GLOW(0xc0b0ff, 0.9 + Math.sin(t * 2) * 0.3); });
    shadowAll(pg);
    addStatic(m, { x: px, z: pz - 6, r: 13, top: py + 40 });
    shadowAll(g);
  }
  A('warp', 22, 9.6, { look: 'none', to: 'prima', tx: 19, ty: 51, label: '프리마', rad: 3, cond: () => G.f.summons, locked: '거대한 문이 굳게 닫혀 있다. 지금은 열 수 없다.' });
  A('trigger', 22, 13, { w: 30, h: 10, cond: () => G.f.kassJoined && !G.f.primaGate, onEnter: () => TALK.primaGate() });

  // 카시안의 야영지
  A('deco', 64, 45, { kind: 'tent', c: '#8a6aa8' });
  A('fire', 67, 47, { id: 'fire:camp' });
  A('npc', 65, 48, { name: '카시안', talk: 'kassianCamp', look: KASSIAN_LOOK, id: 'kassCamp', show: () => G.f.summons && !G.f.kassJoined });
  A('sign', 68, 47.5, { title: '학원 표지', text: '알테라 고원. 이 위로는 체온 관리 없이 오르지 말 것.\n남동쪽 비탈길로 오를 수 있다. 끊어진 다리는 높은 받침에서 활공하여 건넌다.' });

  // 서부 세 도시와 리벤
  for (const [k, nm] of [['orta', '오르타'], ['brig', '브리그'], ['seilen', '세일른']]) {
    const [x, z] = PLACES[k];
    house(m, x - 8, z - 3, { roof: 0x7a6a9a, wall: 0xe8dcc4 }); house(m, x + 8, z - 3, { roof: 0x9a6a5a, wall: 0xe8dcc4 });
    A('deco', 0, 0, { kind: 'cityLight', exactM: [x, z - 1], flagOff: 'dark_' + k });
    m.ents.push(makeEnt('npc', x, z + 5, { name: nm + ' 주민', talk: 'westTown', town: nm, look: { cloak: '#7a6a5a', hair: '#4a3a2a' }, id: 'westnpc:' + k }));
  }
  { const [x, z] = PLACES.riven; house(m, x - 9, z - 6, { roof: 0x6a7a5a, wall: 0xe8dcc4 }); house(m, x + 9, z - 6, { roof: 0x7a5a5a, wall: 0xe8dcc4 }); }
  A('npc', 72, 56, { name: '리벤 주민', talk: 'riven', look: { cloak: '#6a7a8a', hair: '#5a4a3a' }, show: () => !G.f.primaStop });
  A('poster', 73, 53, { talk: 'poster', show: () => G.f.primaStop });
  A('npc', 70.5, 55, { name: '???', talk: 'helper', id: 'helper', look: {}, show: () => G.f.posterRead });

  // 기관 빛기둥, 먼 기관들, 떠 있는 섬
  pillarBeam(m, ...M_(22, 76), 0x7ff0ff, 'eng_marcella');
  pillarBeam(m, ...M_(178, 59), 0xffc880, 'eng_elm');
  pillarBeam(m, ...M_(106, 6), 0xff9a5a, 'eng_grav');
  pillarBeam(m, ...M_(22, 6), 0xd8d0ff, null, 'primaStop');
  pillarBeam(m, ...M_(100, 126), 0x7ff0ff, 'ch1engine');
  for (const [u, v, f] of [[192, 18, 0], [196, 134, 1], [8, 142, 0], [150, 5, 1], [62, 146, 0], [192, 98, 1], [124, 146, 0]]) pillarBeam(m, ...M_(u, v), f ? 0xffaacc : 0xa0dcff, null, null, !!f);
  for (const [u, v, y, s] of [[86, 84, 46, 1], [118, 70, 60, 0.8], [70, 106, 38, 1.1], [140, 100, 52, 0.9], [60, 66, 70, 0.7], [114, 110, 34, 0.6], [40, 30, 64, 0.8]]) { const [x, z] = M_(u, v); floatingIsland(m, x, z, m.ground(x, z) + y, s); }
  leyRibbons(m);
  // 다리
  for (const [x, z, h] of m.bridges) {
    const b = mesh(geo('box', 2.2, 0.4, 2.2), mat(0xa87a4c), x, h - 0.1, z, m.group); b.receiveShadow = true;
    addStatic(m, { x, z, hw: 1.2, hd: 1.2, top: h + 0.1, bot: h - 0.5, stand: true });
  }

  // 채집물, 잔향, 동물
  const rr = () => [rand(4, 196), rand(4, 146)];
  const spotIn = (r, okFn) => { for (let g = 0; g < 3000; g++) { const [u, v] = rr(); const [x, z] = M_(u, v); if (m.regionAt(x, z) !== r) continue; const f = m.flagAt(x, z); if (f & (FL.VOID | FL.BAND | FL.TOWN)) continue; const y = m.ground(x, z); if (y < 0.8) continue; if (okFn && !okFn(x, z, y)) continue; if (Math.abs(m.ground(x + 2, z) - m.ground(x - 2, z)) > 2) continue; return [u, v]; } return null; };
  const forage = (r, item, n) => { for (let k = 0; k < n; k++) { const p = spotIn(r); if (p) A('forage', p[0], p[1], { item, regrow: 150, id: 'f:' + item + ':' + r + ':' + k }); } };
  forage(0, 'berry', 18); forage(0, 'apple', 12); forage(0, 'herb', 16); forage(0, 'pepper', 6); forage(0, 'manabloom', 8);
  forage(2, 'pepper', 12); forage(2, 'herb', 4);
  forage(3, 'mushroom', 18); forage(3, 'apple', 8); forage(3, 'herb', 6); forage(3, 'manabloom', 4);
  forage(4, 'mushroom', 6); forage(4, 'pepper', 10);
  forage(5, 'herb', 6); forage(5, 'pepper', 8); forage(5, 'manabloom', 6);
  forage(6, 'berry', 8); forage(6, 'apple', 6);
  const acts = ['bread', 'sweep', 'window', 'pray'];
  const foes = (r, n, fn, type = 'echo') => { for (let k = 0; k < n; k++) { const p = spotIn(r, (x, z) => dist(x, z, ...PLACES.kalidorGate) > 50); if (p) A(type, p[0], p[1], Object.assign({ id: type + ':' + r + ':' + k + ':' + Math.random().toString(36).slice(2, 6) }, fn())); } };
  foes(0, 12, () => ({ kind: 'beast' })); foes(0, 8, () => ({ kind: 'human', act: pick(acts) })); foes(0, 2, () => ({ kind: 'big' }));
  foes(0, 10, () => ({ kind: 'boar' }), 'beast'); foes(6, 4, () => ({ kind: 'boar' }), 'beast'); foes(6, 4, () => ({ kind: 'beast' }));
  foes(2, 10, () => ({ kind: Math.random() < 0.6 ? 'human' : 'beast', tint: 'salt', act: 'pray' }));
  foes(3, 9, () => ({ kind: Math.random() < 0.5 ? 'human' : 'wisp', tint: 'time', act: 'sweep' }));
  foes(3, 8, () => ({ kind: Math.random() < 0.5 ? 'human' : 'big', tint: 'time', act: 'hunt', show: () => G.f.elm === 'stable' }));
  foes(3, 7, () => ({ kind: 'deer', show: () => G.f.elm === 'full' }), 'beast');
  foes(4, 10, () => ({ kind: Math.random() < 0.6 ? 'human' : 'beast', tint: 'frost', act: 'dig' }));
  foes(5, 12, () => ({ kind: pick(['human', 'wisp', 'big', 'beast']), tint: 'ruin', act: 'window' }));
  // 하늘해파리 (마력 생물, 장식)
  for (let k = 0; k < 14; k++) { const p = spotIn(pick([0, 0, 3, 5, 6])); if (p) A('jelly', p[0], p[1], { id: 'jelly' + k }); }
  scatterWorld(m);
  m.terrainGroup = new THREE.Group(); buildTerrainMeshes(m, m.terrainGroup); m.group.add(m.terrainGroup);
  m.season = seasonSig();
}
