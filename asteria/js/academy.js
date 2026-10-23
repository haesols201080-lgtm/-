// 아스테리아 1부 — 칼리도르 학원과 그 둘레 (바깥 지도 'kalidor')
// 강 협곡이 갈라지는 석회암 언덕 위의 학원, 협곡을 건너는 고가교, 서쪽 비탈의 마을, 동쪽 들판과 호수, 협곡으로 떨어지는 폭포.
// 지형은 높이 격자(2 m), 건물은 건축 키트(KIT)로 짓는다. 건물 안은 따로 불러오는 장소다.
// 좌표: x 동쪽, z 남쪽(북쪽이 z 작은 쪽), 높이 y. 해는 저녁에 서쪽(-x)에 있다.
'use strict';

// ======================================================================
// 배치 (미터)
// ======================================================================
const ACAD = {
  W: 512, D: 512, res: 2,
  court: 42,          // 대정원 바닥 높이
  dormY: 36,          // 기숙사 단
  river: { level: 6, bed: 1.5, half: 12, wall: 22, pts: [[268, -30], [262, 40], [254, 110], [248, 170], [246, 230], [249, 280], [252, 330], [244, 390], [226, 440], [204, 490], [190, 560]] },
  // 학원이 올라앉은 언덕 꼭대기 (대정원 높이)
  plateau: [[296, 184], [334, 176], [384, 176], [420, 184], [440, 204], [448, 236], [446, 278], [438, 316], [416, 336], [380, 344], [364, 340], [362, 306], [300, 306], [292, 284], [290, 220]],
  // 기숙사 단 (한 층 낮은 남쪽 단)
  dormTerrace: [[292, 304], [362, 304], [366, 346], [340, 352], [300, 348], [288, 330]],
  // 북동쪽 호수와 그 물이 협곡으로 떨어지는 개울
  lake: { x: 430, z: 96, rx: 44, rz: 28, level: 24 },
  stream: { pts: [[392, 104], [360, 126], [330, 148], [302, 160], [282, 166]], from: 23.6, to: 22.2 },
  // 마을 (협곡 서쪽)
  townSquare: { x: 166, z: 238, r: 22, y: 36 },
  northGate: [150, 14],
  viaduct: { ax: 212, bx: 291, z: 250, y0: 37, y1: 42, w: 7 },
};
// 학원 건물 자리 (KIT 조립과 엔티티 배치가 함께 쓴다)
const ACAD_B = {
  gate: { x: 298, z: 250 },
  court: { x0: 312, x1: 366, z0: 222, z1: 278 },
  refectory: { x0: 314, x1: 356, z0: 192, z1: 214, door: [335, 214] },
  kitchen: { x0: 356, x1: 382, z0: 188, z1: 214, door: [369, 214] },
  eastRange: { x0: 366, x1: 378, z0: 222, z1: 278, arch: 250 },
  library: { x0: 314, x1: 358, z0: 284, z1: 300, door: [336, 284] },
  libTower: { x: 304, z: 294, r: 7 },
  nwTower: { x: 304, z: 200, r: 6 },
  neTower: { x: 392, z: 192, r: 5 },
  bell: { x: 372, z: 292, w: 11 },
  oswin: { x: 418, z: 236, r: 8, door: [409.5, 236] },
  cloister: { x0: 386, x1: 426, z0: 268, z1: 318 },
  dorm: { x0: 300, x1: 352, z0: 318, z1: 332, door: [326, 318] },
};
// 이름 붙은 자리 (resolveSpot이 쓴다)
const ACAD_SPOTS = {
  gate: [150, 30], townSquare: [166, 244], viaduct: [236, 250], gatehouse: [306, 250],
  court: [330, 252], fountain: [339, 250],
  hallDoor: [335, 218.5], kitchenDoor: [369, 218.5], archivesDoor: [336, 279.5], olabDoor: [405, 236], dormDoor: [326, 314],
  eastTerrace: [400, 252], cloister: [406, 293], lake: [400, 96], grounds: [470, 250],
};

// ---------- 도형 도우미 ----------
function inPoly(x, z, P) {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, zi] = P[i], [xj, zj] = P[j];
    if (((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / (zj - zi) + xi)) c = !c;
  }
  return c;
}
// 다각형까지의 부호 거리 (안이 음수)
function sdPoly(x, z, P) {
  let d = 1e9;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) d = Math.min(d, segDist(x, z, P[j][0], P[j][1], P[i][0], P[i][1])[0]);
  return inPoly(x, z, P) ? -d : d;
}
// 꺾은선까지 거리와 길이 방향 위치(0..1)
function lineDist(x, z, pts) {
  let best = 1e9, at = 0, acc = 0, tot = 0;
  const L = [];
  for (let i = 0; i < pts.length - 1; i++) { const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); L.push(l); tot += l; }
  for (let i = 0; i < pts.length - 1; i++) {
    const [d, t] = segDist(x, z, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
    if (d < best) { best = d; at = (acc + t * L[i]) / tot; }
    acc += L[i];
  }
  return [best, at];
}

// ======================================================================
// 지도: 높이 격자 + 물 + 표면 섞기
// ======================================================================
const SF = { ROAD: 1, NOGRASS: 2, NOCLIMB: 4, BUILD: 8, COURT: 16 };
class SiteField {
  constructor(id, W, D, res) {
    this.kind = 'site'; this.id = id; this.W = W; this.D = D; this.res = res;
    this.nx = Math.round(W / res); this.nz = Math.round(D / res);
    const N = (this.nx + 1) * (this.nz + 1);
    this.h = new Float32Array(N); this.wl = new Float32Array(N).fill(-99); this.fl = new Uint8Array(N);
    this.splat = new Float32Array(N * 4); this.col = new Float32Array(N * 3);
    this.ents = []; this.statics = []; this.hash = new Map(); this.outdoor = true;
  }
  vi(ix, iz) { return iz * (this.nx + 1) + ix; }
  ground(x, z) {
    const r = this.res;
    let gx = x / r, gz = z / r;
    gx = clamp(gx, 0, this.nx - 0.001); gz = clamp(gz, 0, this.nz - 0.001);
    const ix = gx | 0, iz = gz | 0, fx = gx - ix, fz = gz - iz;
    const w = this.nx + 1, i = iz * w + ix, h = this.h;
    // 바깥 경계 밖은 높은 벽
    if (x < 1 || z < 1 || x > this.W - 1 || z > this.D - 1) return 80;
    return lerp(lerp(h[i], h[i + 1], fx), lerp(h[i + w], h[i + w + 1], fx), fz);
  }
  near(x, z) { const ix = clamp(Math.round(x / this.res), 0, this.nx), iz = clamp(Math.round(z / this.res), 0, this.nz); return this.vi(ix, iz); }
  flagAt(x, z) { return this.fl[this.near(x, z)]; }
  waterAt(x, z) { const w = this.wl[this.near(x, z)]; return w > -50 ? w : null; }
  current() { return null; }
  climbable(x, z) { return !(this.flagAt(x, z) & SF.NOCLIMB); }
  grassAt(x, z) {
    if (x < 3 || z < 3 || x > this.W - 3 || z > this.D - 3) return null;
    const i = this.near(x, z);
    if (this.fl[i] & (SF.ROAD | SF.NOGRASS | SF.BUILD | SF.COURT) || this.wl[i] > -50) return null;
    const g = this.splat[i * 4];
    if (g < 0.55) return null;
    // 가파른 곳에는 풀이 없다
    const s = Math.abs(this.ground(x + 1, z) - this.ground(x - 1, z)) + Math.abs(this.ground(x, z + 1) - this.ground(x, z - 1));
    if (s > 2.2) return null;
    const c = this.col;
    return { y: this.ground(x, z), r: c[i * 3] * 1.08, g: c[i * 3 + 1] * 1.1, b: c[i * 3 + 2], d: 0.9 * g, flower: 0.03 };
  }
}

// ---------- 자연 지형 ----------
function siteNatural(x, z) {
  const n = fbm(x * 0.011, z * 0.011, 41), n2 = fbm(x * 0.035, z * 0.035, 43);
  let h = 29 + (n - 0.5) * 10 + (n2 - 0.5) * 2.5;
  // 서쪽(마을 쪽)은 서쪽으로 갈수록 높아지는 비탈
  h += smooth(250, 40, x) * (16 + (1 - z / 512) * 6);
  // 고가교 서쪽 머리 둔덕
  const db = Math.hypot(x - 204, z - 250);
  if (db < 34) h = lerp(37, h, smooth(14, 34, db));
  // 동쪽 끝은 숲 언덕
  h += smooth(450, 512, x) * 12 * (0.6 + n);
  // 남쪽 끝은 조금 낮다
  h -= smooth(380, 512, z) * 4 * smooth(260, 400, x);
  return h;
}

function buildSiteTerrain(m) {
  const A = ACAD, R = A.res, w = m.nx + 1;
  const rv = A.river;
  for (let iz = 0; iz <= m.nz; iz++) for (let ix = 0; ix <= m.nx; ix++) {
    const x = ix * R, z = iz * R, i = iz * w + ix;
    let h = siteNatural(x, z);
    // 학원 언덕: 꼭대기는 평평, 가장자리는 가파른 바위 비탈
    const sp = sdPoly(x, z, A.plateau);
    const rock = (fbm(x * 0.08, z * 0.08, 47) - 0.5) * 3;
    const mesa = A.court - Math.max(0, sp) * (1.25 + rock * 0.05) + (sp > 0 ? rock * smooth(0, 4, sp) : 0);
    h = Math.max(h, mesa);
    if (sp < 0) h = A.court;
    // 기숙사 단
    const sd = sdPoly(x, z, A.dormTerrace);
    if (sd < 3 && sp > -0.5) h = sd < 0 ? A.dormY : lerp(A.dormY, h, smooth(0, 3, sd));
    // 마을 광장
    const tq = A.townSquare, dq = Math.hypot(x - tq.x, z - tq.z);
    if (dq < tq.r + 10) h = lerp(tq.y, h, smooth(tq.r, tq.r + 10, dq));
    // 호수 (북동)
    const lk = A.lake, le = Math.hypot((x - lk.x) / lk.rx, (z - lk.z) / lk.rz);
    if (le < 1.6) h = lerp(lk.level - 3.2 + le * 2.4, h, smooth(0.9, 1.6, le));
    // 개울
    const [ds, ts] = lineDist(x, z, A.stream.pts);
    if (ds < 9) { const sl = lerp(A.stream.from, A.stream.to, ts); h = Math.min(h, lerp(sl - 1.1, h, smooth(2.2, 9, ds))); }
    // 강 협곡: 물 위로 가파른 절벽
    const [dr] = lineDist(x, z, rv.pts);
    const wallN = (fbm(x * 0.05, z * 0.05, 49) - 0.5) * 8 + (noise2(x * 0.3, z * 0.3, 51) - 0.5) * 1.2;
    let gorge = 1e9;
    if (dr < rv.half) gorge = rv.bed + dr / rv.half * 2.5;
    else if (dr < rv.half + rv.wall) { const t = (dr - rv.half) / rv.wall; gorge = rv.level + 1 + Math.pow(t, 0.75) * 46 + wallN * t; }
    if (gorge < h) h = gorge;
    m.h[i] = h;
    // 물
    if (dr < rv.half + 2.5) m.wl[i] = rv.level;
    if (le < 1.05) m.wl[i] = lk.level;
    if (ds < 3.2 && dr > rv.half + 6) m.wl[i] = lerp(A.stream.from, A.stream.to, ts);
    if (sp < 0) m.fl[i] |= SF.COURT;
    if (sd < 0) m.fl[i] |= SF.COURT;
  }
  // 길: 중심선 높이를 고르게 다듬어 땅을 깎고 메운다
  for (const rd of SITE_ROADS) carveRoad(m, rd);
  // 표면 섞기와 색
  paintSite(m);
}

// 길: pts, 폭, 표면(cobble|dirt), 고정 높이(선택)
const SITE_ROADS = [
  { pts: [[150, 0], [152, 40], [158, 90], [160, 140], [162, 190], [166, 238]], w: 6, s: 'cobble' },              // 북문 → 마을 광장
  { pts: [[166, 238], [190, 246], [212, 250]], w: 6, s: 'cobble', endY: 37 },                                        // 광장 → 고가교 머리
  { pts: [[166, 238], [120, 250], [80, 270], [40, 300]], w: 4, s: 'cobble' },                                         // 마을 서쪽 골목
  { pts: [[160, 140], [120, 128], [80, 120]], w: 3.5, s: 'cobble' },
  { pts: [[446, 250], [462, 252], [482, 262], [508, 270]], w: 4, s: 'dirt', startY: 38 },                            // 학원 동문 → 들판
  { pts: [[462, 252], [470, 210], [462, 160], [440, 128]], w: 3, s: 'dirt' },                                         // 들판 → 호숫가
  { pts: [[340, 352], [352, 380], [380, 420], [420, 470], [450, 512]], w: 3, s: 'dirt', startY: 36 },               // 기숙사 단 → 남쪽 숲길
];
function carveRoad(m, rd) {
  const R = m.res, w = m.nx + 1;
  // 중심선을 1 m 간격으로 짚고 높이를 평균 내 부드럽게
  const samples = [];
  for (let i = 0; i < rd.pts.length - 1; i++) {
    const [ax, az] = rd.pts[i], [bx, bz] = rd.pts[i + 1], l = Math.hypot(bx - ax, bz - az);
    for (let s = 0; s < l; s += 1) samples.push([ax + (bx - ax) * s / l, az + (bz - az) * s / l]);
  }
  samples.push(rd.pts[rd.pts.length - 1]);
  const raw = samples.map(([x, z]) => Math.max(m.ground(x, z), ACAD.river.level + 3));
  const sm = raw.map((_, i) => { let a = 0, n = 0; for (let k = -10; k <= 10; k++) { const j = clamp(i + k, 0, raw.length - 1); a += raw[j]; n++; } return a / n; });
  if (rd.startY !== undefined) for (let i = 0; i < Math.min(16, sm.length); i++) sm[i] = lerp(rd.startY, sm[i], i / 16);
  if (rd.endY !== undefined) for (let i = 0; i < Math.min(30, sm.length); i++) { const j = sm.length - 1 - i; sm[j] = lerp(rd.endY, sm[j], i / 30); }
  const half = rd.w / 2, sh = half + 4;
  // 영향 범위 안의 정점만
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (const [x, z] of rd.pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  for (let iz = Math.max(0, Math.floor((z0 - sh) / R)); iz <= Math.min(m.nz, Math.ceil((z1 + sh) / R)); iz++)
    for (let ix = Math.max(0, Math.floor((x0 - sh) / R)); ix <= Math.min(m.nx, Math.ceil((x1 + sh) / R)); ix++) {
      const x = ix * R, z = iz * R, i = iz * w + ix;
      let best = 1e9, bi = 0;
      for (let k = 0; k < samples.length; k += 2) { const d = Math.hypot(samples[k][0] - x, samples[k][1] - z); if (d < best) { best = d; bi = k; } }
      if (best > sh) continue;
      if (m.fl[i] & SF.COURT) continue;
      const t = smooth(half, sh, best);
      m.h[i] = lerp(sm[bi], m.h[i], t);
      if (best < half + 0.6) { m.fl[i] |= SF.ROAD; m.roadS = m.roadS || new Uint8Array(m.h.length); m.roadS[i] = rd.s === 'cobble' ? 2 : 1; }
      else if (best < half + 2) m.fl[i] |= SF.NOGRASS;
    }
}

// 표면 무게 (풀, 흙, 자갈길, 강자갈)와 대체 색
function paintSite(m) {
  const R = m.res, w = m.nx + 1, c = new THREE.Color();
  const grass = COL(0x7a8b4a), dry = COL(0xa8975a), heather = COL(0x7a5a6a), dirt = COL(0x8a7354), rock = COL(0x8e877a), cob = COL(0x8a8070), grav = COL(0x9a9080), courtC = COL(0xa89a84);
  for (let iz = 0; iz <= m.nz; iz++) for (let ix = 0; ix <= m.nx; ix++) {
    const x = ix * R, z = iz * R, i = iz * w + ix;
    const hl = m.h[iz * w + Math.max(0, ix - 1)], hr = m.h[iz * w + Math.min(m.nx, ix + 1)], hd = m.h[Math.max(0, iz - 1) * w + ix], hu = m.h[Math.min(m.nz, iz + 1) * w + ix];
    const slope = Math.hypot(hr - hl, hu - hd) / (2 * R);
    let g = 1, d = 0, cb = 0, gv = 0;
    const patch = fbm(x * 0.045, z * 0.045, 61);
    d = smooth(0.62, 0.78, patch) * 0.6;
    const rs = m.roadS ? m.roadS[i] : 0;
    if (rs === 2) { cb = 1; g = 0; d = 0.15; }
    else if (rs === 1) { d = 1; g = 0; }
    else if (m.fl[i] & SF.NOGRASS) { d = Math.max(d, 0.7); g = 0.3; }
    if (m.fl[i] & SF.COURT) { cb = 1; g = 0; d = 0.1; }
    const [dr] = lineDist(x, z, ACAD.river.pts);
    if (dr < ACAD.river.half + 6 && m.h[i] < ACAD.river.level + 3) { gv = 1; g = 0; d = 0.2; }
    if (m.wl[i] > -50 && m.h[i] < m.wl[i]) { gv = 1; g = 0; }
    if (slope > 0.75) { g *= 0.2; d = Math.max(d, 0.5); }
    const s = g + d + cb + gv || 1;
    m.splat[i * 4] = g / s; m.splat[i * 4 + 1] = d / s; m.splat[i * 4 + 2] = cb / s; m.splat[i * 4 + 3] = gv / s;
    // 대체 색 (TEX.terrain이 없을 때) 겸 풀 색
    c.copy(grass).lerp(dry, smooth(0.4, 0.75, fbm(x * 0.02, z * 0.02, 63)) * 0.7);
    c.lerp(heather, smooth(0.7, 0.85, fbm(x * 0.03 + 9, z * 0.03, 65)) * 0.6);
    c.lerp(dirt, m.splat[i * 4 + 1]); c.lerp(cb ? (m.fl[i] & SF.COURT ? courtC : cob) : cob, m.splat[i * 4 + 2]); c.lerp(grav, m.splat[i * 4 + 3]);
    c.lerp(rock, smooth(0.6, 1.2, slope));
    const v = 0.9 + noise2(x * 0.4, z * 0.4, 67) * 0.2;
    m.col[i * 3] = c.r * v; m.col[i * 3 + 1] = c.g * v; m.col[i * 3 + 2] = c.b * v;
  }
}

// ======================================================================
// 장면: 지형 메쉬, 물, 건물, 식물, 소품
// ======================================================================
function siteTerrainMeshes(m, group) {
  const CH = 32, w = m.nx + 1, r = m.res;
  const matl = (window.TEX && TEX.terrain) ? TEX.terrain({}) : new THREE.MeshStandardMaterial({ vertexColors: true, map: GFX.noiseTex, roughness: 0.95 });
  for (let cz = 0; cz < m.nz; cz += CH) for (let cx = 0; cx < m.nx; cx += CH) {
    const nx = Math.min(CH, m.nx - cx), nz = Math.min(CH, m.nz - cz), NV = (nx + 1) * (nz + 1);
    const pos = new Float32Array(NV * 3), nor = new Float32Array(NV * 3), col = new Float32Array(NV * 3), uv = new Float32Array(NV * 2), spl = new Float32Array(NV * 4);
    let k = 0;
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
      const ix = cx + i, iz = cz + j, vi = iz * w + ix;
      pos[k * 3] = ix * r; pos[k * 3 + 1] = m.h[vi]; pos[k * 3 + 2] = iz * r;
      const hl = m.h[iz * w + Math.max(0, ix - 1)], hr = m.h[iz * w + Math.min(m.nx, ix + 1)];
      const hd = m.h[Math.max(0, iz - 1) * w + ix], hu = m.h[Math.min(m.nz, iz + 1) * w + ix];
      const n = V3(hl - hr, 2 * r, hd - hu).normalize();
      nor[k * 3] = n.x; nor[k * 3 + 1] = n.y; nor[k * 3 + 2] = n.z;
      if (window.TEX && TEX.terrain) { col[k * 3] = col[k * 3 + 1] = col[k * 3 + 2] = 1; }
      else { col[k * 3] = m.col[vi * 3]; col[k * 3 + 1] = m.col[vi * 3 + 1]; col[k * 3 + 2] = m.col[vi * 3 + 2]; }
      for (let q = 0; q < 4; q++) spl[k * 4 + q] = m.splat[vi * 4 + q];
      uv[k * 2] = ix * r; uv[k * 2 + 1] = iz * r;
      k++;
    }
    const idx = [];
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setAttribute('uv2', g.attributes.uv);
    g.setAttribute('splat', new THREE.BufferAttribute(spl, 4));
    g.setIndex(idx);
    g.computeBoundingSphere();
    const me = new THREE.Mesh(g, matl);
    me.receiveShadow = true; me.castShadow = true;
    group.add(me);
  }
  // 땅 높이를 재질들에 알린다 (벽 아래 때)
  if (window.TEX && TEX.setGround) TEX.setGround(siteGroundTex(m));
}
// 땅 높이 텍스처 (TEX.setGround가 바라는 꼴: 문서에 맞춘다)
function siteGroundTex(m) {
  const w = m.nx + 1, d = m.nz + 1, data = new Float32Array(w * d);
  for (let i = 0; i < w * d; i++) data[i] = m.h[i];
  const t = new THREE.DataTexture(data, w, d, THREE.RedFormat, THREE.FloatType);
  t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
  return { tex: t, x0: 0, z0: 0, w: m.W, d: m.D };
}

// 물: 강, 호수, 개울 (2 m 칸마다 물 높이에 사각형). 정점마다 물 깊이를 넣어 얕은 곳은 맑고 가장자리는 거품
function siteWater(m, group) {
  const R = m.res, w = m.nx + 1;
  const pos = [], idx = [], dep = [], uv = [];
  for (let iz = 0; iz < m.nz; iz++) for (let ix = 0; ix < m.nx; ix++) {
    const a = iz * w + ix, ids = [a, a + 1, a + w, a + w + 1];
    let lv = -99, low = false;
    for (const i of ids) { if (m.wl[i] > lv) lv = m.wl[i]; }
    if (lv < -50) continue;
    for (const i of ids) if (m.h[i] < lv + 0.05) low = true;
    if (!low) continue;
    const b = pos.length / 3, x = ix * R, z = iz * R;
    pos.push(x, lv, z, x + R, lv, z, x, lv, z + R, x + R, lv, z + R);
    for (const i of ids) dep.push(lv - m.h[i]);
    uv.push(x * 0.11, z * 0.11, (x + R) * 0.11, z * 0.11, x * 0.11, (z + R) * 0.11, (x + R) * 0.11, (z + R) * 0.11);
    idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('depth', new THREE.Float32BufferAttribute(dep, 1));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  const me = new THREE.Mesh(g, siteWaterMat());
  me.renderOrder = 2; me.receiveShadow = true; group.add(me);
}
// 물 재질: 환경 반사(IBL) + 두 겹 물결 노멀 + 깊이에 따른 색과 투명도 + 가장자리 거품
function siteWaterMat() {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.06, metalness: 0.0, transparent: true, normalMap: GFX.waterN, normalScale: new THREE.Vector2(0.35, 0.35), depthWrite: false, envMapIntensity: 1.2 });
  m.onBeforeCompile = sh => {
    sh.uniforms.uT = GFX.timeU;
    sh.vertexShader = 'attribute float depth;\nvarying float vDep;\nvarying vec3 vWp;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vDep = depth; vec4 wq = modelMatrix * vec4(position, 1.0); vWp = wq.xyz; transformed.y += sin(wq.x * 0.31 + uT * 1.2) * 0.03 + cos(wq.z * 0.27 + uT * 0.9) * 0.03;').replace('void main() {', 'uniform float uT;\nvoid main() {');
    sh.fragmentShader = 'uniform float uT;\nvarying float vDep;\nvarying vec3 vWp;\nfloat wh(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }\nfloat wn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f); return mix(mix(wh(i),wh(i+vec2(1,0)),f.x), mix(wh(i+vec2(0,1)),wh(i+vec2(1,1)),f.x), f.y); }\n' + sh.fragmentShader
      .replace('#include <normal_fragment_maps>', `
        vec2 wuv = vWp.xz * 0.11;
        vec3 n1 = texture2D( normalMap, wuv + vec2( uT * 0.021, uT * 0.013 ) ).xyz * 2.0 - 1.0;
        vec3 n2 = texture2D( normalMap, wuv * 2.3 - vec2( uT * 0.017, -uT * 0.026 ) ).xyz * 2.0 - 1.0;
        vec3 mapN = normalize( vec3( ( n1.xy + n2.xy ) * normalScale, 1.0 ) );
        normal = perturbNormal2Arb( - vViewPosition, normal, mapN, faceDirection );`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float dk = smoothstep( 0.0, 3.5, vDep );
        diffuseColor.rgb = mix( vec3( 0.16, 0.2, 0.15 ), vec3( 0.025, 0.06, 0.075 ), dk );
        float foam = ( 1.0 - smoothstep( 0.05, 0.55, vDep ) ) * smoothstep( 0.35, 0.75, wn( vWp.xz * 1.7 + vec2( uT * 0.3, uT * 0.2 ) ) * 0.7 + wn( vWp.xz * 4.1 - uT * 0.4 ) * 0.5 );
        diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.82, 0.86, 0.86 ), foam * 0.8 );
        diffuseColor.a = mix( 0.55, 0.94, smoothstep( 0.0, 1.6, vDep ) );`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = mix( 0.06, 0.6, foam );');
  };
  m.customProgramCacheKey = () => 'siteWater';
  return m;
}

// 폭포: 개울 끝에서 협곡 강으로
function siteWaterfall(m, group) {
  const [ex, ez] = ACAD.stream.pts[ACAD.stream.pts.length - 1];
  const top = ACAD.stream.to, bot = ACAD.river.level;
  const g = new THREE.PlaneGeometry(7, top - bot, 6, 16);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i), t = 0.5 - y / (top - bot); p.setZ(i, -Math.pow(Math.max(0, t), 0.6) * 9 - Math.sin(p.getX(i) * 1.3) * 0.3); p.setX(i, p.getX(i) * (1 + t * 0.35)); }
  g.computeVertexNormals();
  const mt = new THREE.ShaderMaterial({
    uniforms: { t: GFX.timeU },
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `uniform float t; varying vec2 vU;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      void main(){ vec2 q = vec2(vU.x * 9., vU.y * 3. + t * 2.2); float s = n(q) * .6 + n(q * 2.3 + 4.) * .4;
        float edge = smoothstep(0., .18, vU.x) * smoothstep(1., .82, vU.x);
        float a = (.45 + s * .5) * edge; vec3 c = mix(vec3(.55,.66,.7), vec3(.95,.97,1.), s);
        gl_FragColor = vec4(c * 1.1, a * .85); }`,
  });
  const fall = new THREE.Mesh(g, mt);
  // 협곡 쪽을 바라보게
  const [px, pz] = ACAD.stream.pts[ACAD.stream.pts.length - 2];
  const dir = Math.atan2(ex - px, ez - pz);
  fall.position.set(ex + Math.sin(dir) * 1, (top + bot) / 2, ez + Math.cos(dir) * 1);
  fall.rotation.y = dir + Math.PI;
  fall.renderOrder = 3;
  group.add(fall);
  m.fallAt = { x: ex + Math.sin(dir) * 9, z: ez + Math.cos(dir) * 9, y: bot };
  // 폭포 아래 물보라
  m.anims.push(() => { const f = m.fallAt; if (Math.hypot(f.x - CAM.tx, f.z - CAM.tz) > 160) return; for (let k = 0; k < 2; k++) FX.spawn({ x: f.x + rand(-3, 3), y: f.y + 0.3, z: f.z + rand(-3, 3), vx: rand(-1.2, 1.2), vy: rand(1, 3), vz: rand(-1.2, 1.2), life: 2.2, size: 1.6, c: 0xdfe8ec, add: false, a: 0.22, shrink: false, drag: 0.6, grav: -0.2 }); });
}

// ======================================================================
// 지도 만들기
// ======================================================================
function buildAcademySite() {
  const A = ACAD;
  const m = new SiteField('kalidor', A.W, A.D, A.res);
  Object.assign(m, { name: '칼리도르 학원', temp: 18, region: 1, outdoor: true, spots: ACAD_SPOTS, bg: 0x8aa0c0 });
  buildSiteTerrain(m);
  populateSite(m);
  return m;
}

// 사람과 물건 (옛 2D 칼리도르의 내용을 새 자리로)
function populateSite(m) {
  const C = ACAD.court, B = ACAD_B, add = (type, x, z, p = {}) => { const e = makeEnt(type, x, z, p); m.ents.push(e); return e; };
  const S = ACAD_SPOTS;
  // 대정원: 기관 혼천의 분수
  add('fountain', S.fountain[0], S.fountain[1], { id: 'kalidor:fountain' });
  add('whale', S.fountain[0], S.fountain[1], { id: 'kalidor:whale', hy: C + 46, cr: 70 });
  // 학생과 사람들
  add('npc', 344, 262, { id: 'kalidor:npc:yul', name: '견습생 율', talk: 'student', look: { cloak: '#3b6ea8', hair: '#d8a050' }, wander: 2 });
  add('npc', 352, 240, { id: 'kalidor:npc:dorin', name: '견습생 도린', talk: 'student2', look: { cloak: '#3b6ea8', hair: '#2a2a2a' }, wander: 2 });
  add('npc', 322, 236, { id: 'kalidor:npc:sera', name: '학생 세라', talk: 'student3', look: { cloak: '#a84a4a', hair: '#7a3a2a' }, wander: 2 });
  add('npc', 326, 264, { id: 'kalidor:npc:mira', name: '미라', talk: 'mira', look: MIRA_LOOK });
  add('npc', 334, 244, { id: 'kalidor:npc:pip', name: '핍', talk: 'pip', look: { cloak: '#5aa86a', hair: '#e8c070', scale: 0.75 } });
  // 마을: 재봉사 넬과 노점
  const tq = ACAD.townSquare;
  add('npc', tq.x + 6, tq.z + 4, { id: 'kalidor:npc:nel', name: '재봉사 넬', talk: 'tailor', shop: 'tailor', look: { cloak: '#c86a8a', hair: '#3a2a2a' }, show: () => G.f.council });
  add('deco', tq.x - 8, tq.z - 7, { id: 'kalidor:stall:w', kind: 'stall', c: '#5a9ae8' });
  add('deco', tq.x + 9, tq.z - 8, { id: 'kalidor:stall:e', kind: 'stall', c: '#e8a83a' });
  add('deco', tq.x, tq.z + 12, { id: 'kalidor:statue', kind: 'statue' });
  // 미라의 부유석 셋: 정원 낮은 곳, 성문 탑 난간 위, 회랑 지붕 위
  for (const [id, x, z, hy] of [['orb1', 318, 272, C + 1.6], ['orb2', 299, 241, C + 17], ['orb3', 412, 282, C + 7.2]]) add('orb', x, z, { id, hy, show: () => G.f.miraTask && !G.f.miraDone });
  // 도망친 책: 회랑 정원 안에서 달아난다
  const cl = B.cloister;
  add('book', (cl.x0 + cl.x1) / 2, (cl.z0 + cl.z1) / 2, { id: 'kalidor:book:flee', flee: true, minx: cl.x0 + 8, maxx: cl.x1 - 8, miny: cl.z0 + 8, maxy: cl.z1 - 8, hy: C + 5.2, rad: 1.6, c: '#3a6aa8', show: () => G.f.bookTask && !G.f.bookDone });
  // 떠다니는 책 (모으는 것): 높은 곳
  add('book', 339, 250, { id: 'fb9', rad: 9, hy: C + 9, c: '#c89a3a' });
  add('book', 406, 293, { id: 'fb10', rad: 7, hy: C + 8, c: '#3a6aa8' });
  add('book', 304, 294, { id: 'fb11', rad: 4, hy: C + 30, c: '#a83a3a' });
  // 등불 (임시: 소품 모듈이 오면 벽 등과 등 기둥으로 바뀐다)
  for (const [x, z] of [[316, 226], [362, 226], [316, 274], [362, 274], [339, 226], [339, 274], [384, 252], [430, 250], [176, 232], [156, 248], [176, 250], [204, 248], [226, 247], [280, 247], [226, 253], [280, 253]]) add('deco', x, z, { kind: 'lamp', id: `kalidor:lamp:${x},${z}` });
  // 지나가는 학생과 마을 사람 (말을 걸 수 없는 배경 인물)
  const hairs = ['#2a1f18', '#3a2a20', '#5a3a22', '#7a4a2a', '#a8742e', '#d8b070', '#1a1a1e', '#8a5a3a'], skins = ['#f3d3b5', '#e8c098', '#d8a878', '#b8845a', '#8a5a3a', '#f0d8c0'];
  const trims = ['#8e3b35', '#5d6b3a', '#b08a3a', '#4a6a8a'], wool = ['#7a6a55', '#5a6a5a', '#8a5a4a', '#c9b89a', '#6a5a6a'];
  let k = 0;
  const student = (x, z, o = {}) => { k++; return add('npc', x, z, Object.assign({ id: 'kalidor:amb:' + k, look: { cloak: '#262a3f', trim: trims[k % 4], hair: hairs[k % hairs.length], skin: skins[(k * 3) % skins.length], body: '#e8e0cf', seed: k * 7, scale: 0.94 + hash2(k, 1, 91) * 0.1 } }, o)); };
  const towner = (x, z, o = {}) => { k++; return add('npc', x, z, Object.assign({ id: 'kalidor:amb:' + k, look: { cloak: wool[k % wool.length], hair: hairs[(k * 5) % hairs.length], skin: skins[(k * 2) % skins.length], body: '#d8ccb0', legs: '#4a3e30', seed: k * 11, scale: 0.92 + hash2(k, 2, 91) * 0.14 } }, o)); };
  // 둘셋씩 모여 이야기하는 무리: 서로 마주 본다
  const group = (cx, cz, n, fn) => { for (let i = 0; i < n; i++) { const a = i / n * 6.28 + hash2(k, 3, 91); const e = fn(cx + Math.cos(a) * 0.9, cz + Math.sin(a) * 0.9); e.yaw = Math.atan2(cx - e.x, cz - e.z); e.chat = true; } };
  group(322, 248, 3, student); group(356, 262, 2, student); group(348, 232, 3, student); group(392, 300, 2, student);
  for (const [x, z] of [[330, 232], [346, 270], [360, 250], [318, 262], [404, 252], [300, 250]]) student(x, z, { wander: 1.2 });
  group(tq.x - 4, tq.z + 2, 3, towner); group(tq.x + 10, tq.z - 2, 2, towner);
  for (const [x, z] of [[tq.x + 2, tq.z - 10], [158, 200], [160, 150], [190, 245], [140, 254]]) towner(x, z, { wander: 1.5 });
  // 출입
  add('warp', ACAD.northGate[0], ACAD.northGate[1], { id: 'kalidor:warp:world', look: 'none', to: 'world', tx: 'gate', rad: 3.2, cond: () => G.f.ch1ready, locked: () => G.f.coat ? '내일 아침에 떠나자. 기숙사에서 자고 가야 한다.' : '원정이 정해지기 전에는 성문이 열리지 않는다.' });
  const door = (to, at, label, tx) => add('warp', at[0], at[1], { id: 'kalidor:door:' + to, look: 'none', to, tx, label, rad: 1.4 });
  door('hall', [B.refectory.door[0], B.refectory.door[1] + 0.6], '대강당', 'door');
  door('kitchen', [B.kitchen.door[0], B.kitchen.door[1] + 0.6], '식당과 부엌', 'door');
  door('archives', [B.library.door[0], B.library.door[1] - 0.6], '도서관', 'door');
  door('olab', [B.oswin.door[0] - 0.4, B.oswin.door[1]], '오스윈 연구실', 'door');
  door('dorm', [B.dorm.door[0], B.dorm.door[1] - 0.6], '기숙사', 'door');
  // 안내판
  add('sign', 230, 246, { id: 'kalidor:sign:bridge', title: '공명교', text: '칼리도르 학원 · 이 다리 위에서는 뛰지 말 것.\n(누군가 아래에 "바람이 불면 예외"라고 적어 두었다)' });
  add('sign', tq.x - 3, tq.z + 6, { id: 'kalidor:sign:town', title: '아랫마을', text: '북쪽: 성문과 대륙 길\n동쪽: 공명교 건너 학원' });
}

// ======================================================================
// 장면 조립
// ======================================================================
// 연출용 카메라 자리 [카메라 x,y,z, 보는 곳 x,y,z]
const ACAD_CINE = {
  open1: [168, 96, 392, 352, 66, 248],     // 협곡 남서쪽 높은 곳에서 학원 전경
  open2: [222, 40.5, 246, 330, 58, 250],   // 고가교 위, 성문과 스카이라인
  open3: [326, 47, 270, 304, 62, 294],     // 도서관 탑
  open4: [318, 45, 274, 339, 84, 236],     // 대정원 위 고래
  frozen: [330, 45.5, 262, 339, 43, 250],  // 얼어붙은 분수
  hallRoof: [328, 66, 238, 335, 60, 203],  // 대강당 지붕
  rainbow: [316, 47.5, 272, 339, 50, 244], // 무지개
};
function cineSpot(name) { const c = ACAD_CINE[name]; if (c) cineShot(...c); }

function buildSiteScene(m) {
  const g = new THREE.Group();
  m.anims = [];
  siteTerrainMeshes(m, g);
  siteWater(m, g);
  siteWaterfall(m, g);
  let built = null;
  if (window.KIT && window.composeAcademy) built = composeAcademy(m);
  else built = placeholderAcademy(m);
  g.add(built);
  const ub = built.userData.batch;
  if (ub) {
    for (const c of ub.colliders) addStatic(m, c);
    for (const l of ub.lights) m.ents.push(makeEnt('deco', l.x, l.z, { kind: 'lightonly', id: `kalidor:l:${l.x.toFixed(1)},${l.z.toFixed(1)},${l.y.toFixed(1)}`, light: { c: l.c ?? 0xffc070, k: l.k ?? 1, d: l.d ?? 10, h: l.y - m.ground(l.x, l.z) } }));
    for (const a of ub.anims) m.anims.push(a);
  }
  // 아랫마을
  const tb = new Batch(); m.town = placeTown(m, tb);
  const town = tb.build(); g.add(town);
  for (const c of tb.colliders) addStatic(m, c);
  for (const l of tb.lights) m.ents.push(makeEnt('deco', l.x, l.z, { kind: 'lightonly', id: `kalidor:tl:${l.x.toFixed(1)},${l.z.toFixed(1)}`, light: { c: l.c, k: l.k, d: l.d, h: l.y - m.ground(l.x, l.z) } }));
  for (const a of tb.anims) m.anims.push(a);
  // 돌담, 선돌, 울타리
  const db = siteDressing(m); g.add(db.build());
  for (const c of db.colliders) addStatic(m, c);
  siteTrees(m, g);
  // 고가교 바닥과 난간 (충돌)
  const V = ACAD.viaduct, n = 20;
  for (let i = 0; i < n; i++) {
    const x0 = lerp(V.ax, V.bx, i / n), x1 = lerp(V.ax, V.bx, (i + 1) / n), y = lerp(V.y0, V.y1, (i + 0.5) / n);
    addStatic(m, { x0, x1, z0: V.z - V.w / 2, z1: V.z + V.w / 2, top: y, bot: y - 3, stand: true });
    for (const s of [-1, 1]) addStatic(m, { x0, x1, z0: V.z + s * (V.w / 2) - (s > 0 ? 0 : 0.5), z1: V.z + s * (V.w / 2) + (s > 0 ? 0.5 : 0), top: y + 1.1, bot: y - 3 });
  }
  return g;
}

// 나무: 숲 모듈이 있으면 그것으로, 없으면 옛 나무
function sitePlantPoints(m) {
  const pts = [], R = new THREE.Vector2();
  for (let k = 0; k < 9000 && pts.length < 2600; k++) {
    const x = 6 + hash2(k, 1, 71) * (m.W - 12), z = 6 + hash2(k, 2, 71) * (m.D - 12);
    const i = m.near(x, z);
    if (m.fl[i] & (SF.ROAD | SF.COURT | SF.NOGRASS | SF.BUILD) || m.wl[i] > -50) continue;
    // 길·건물·고가교 근처는 비운다
    if (Math.abs(z - ACAD.viaduct.z) < 14 && x > ACAD.viaduct.ax - 10 && x < ACAD.viaduct.bx) continue;
    if (sdPoly(x, z, ACAD.plateau) < 6) continue;
    if (Math.hypot(x - ACAD.townSquare.x, z - ACAD.townSquare.z) < 40) continue;
    if (m.town && m.town.some(t => Math.hypot(t[0] - x, t[1] - z) < t[2] + 3)) continue;
    const slope = Math.abs(m.ground(x + 1.5, z) - m.ground(x - 1.5, z)) + Math.abs(m.ground(x, z + 1.5) - m.ground(x, z - 1.5));
    if (slope > 4) continue;
    // 숲의 밀도: 동쪽과 남쪽 끝, 협곡 가장자리, 서쪽 언덕은 빽빽하게, 들판은 드문드문
    const f = fbm(x * 0.012, z * 0.012, 73);
    const edge = Math.max(smooth(440, 500, x), smooth(400, 490, z), smooth(70, 10, x), smooth(60, 8, z) * 0.6);
    const dense = clamp(edge * 0.9 + smooth(0.55, 0.7, f) * 0.8, 0, 1);
    if (hash2(k, 3, 71) > dense * 0.9 + 0.03) continue;
    const kind = m.ground(x, z) > 40 || x < 120 ? (hash2(k, 4, 71) < 0.6 ? 'pine' : 'oak') : (hash2(k, 4, 71) < 0.25 ? 'pine' : hash2(k, 4, 71) < 0.45 ? 'birch' : hash2(k, 4, 71) < 0.7 ? 'beech' : 'oak');
    pts.push({ x, z, y: m.ground(x, z), kind, s: 0.8 + hash2(k, 5, 71) * 0.5, rot: hash2(k, 6, 71) * 6.28 });
  }
  return pts;
}
function siteTrees(m, g) {
  const pts = sitePlantPoints(m);
  if (window.FLORA && FLORA.forest) {
    const out = FLORA.forest(g, pts, { seed: 7 });
    if (out && out.colliders) for (const c of out.colliders) addStatic(m, c);
    return;
  }
  const geos = makeTreeGeos();
  const vc = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
  const byKind = { oak: [], pine: [] };
  for (const p of pts) (p.kind === 'pine' ? byKind.pine : byKind.oak).push(p);
  const mx = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
  for (const k in byKind) {
    const list = byKind[k]; if (!list.length) continue;
    const im = new THREE.InstancedMesh(geos[k] || geos.oak, vc, list.length);
    list.forEach((p, i) => {
      q.setFromAxisAngle(V3(0, 1, 0), p.rot); mx.compose(V3(p.x, p.y, p.z), q, V3(p.s, p.s, p.s)); im.setMatrixAt(i, mx);
      im.setColorAt(i, c.setHSL(0.24 + hash2(i, 9) * 0.04, 0.3, 0.3 + hash2(i, 8) * 0.08));
      addStatic(m, { x: p.x, z: p.z, r: 0.45 * p.s, top: p.y + 7 });
    });
    im.castShadow = true; im.receiveShadow = true; g.add(im);
  }
}

// 키트가 오기 전의 덩어리 (자리 잡기와 놀이 시험용)
function placeholderAcademy(m) {
  const b = new Batch(), C = ACAD.court, B = ACAD_B;
  const box = (key, x0, x1, z0, z1, y0, y1) => { b.add(key, new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), M4((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), { worldUV: true }); };
  const hall = (r, h, key = 'stone') => {
    box(key, r.x0, r.x1, r.z0, r.z1, C - 4, C + h);
    const w = r.x1 - r.x0, d = r.z1 - r.z0, along = w > d, span = along ? d : w, rh = span / 2 * Math.tan(55 * Math.PI / 180);
    const shp = new THREE.Shape([new THREE.Vector2(-span / 2 - 0.6, 0), new THREE.Vector2(span / 2 + 0.6, 0), new THREE.Vector2(0, rh)]);
    const rg = new THREE.ExtrudeGeometry(shp, { depth: (along ? w : d) + 1.2, bevelEnabled: false });
    rg.translate(0, 0, -((along ? w : d) + 1.2) / 2);
    b.add('slate', rg, M4((r.x0 + r.x1) / 2, C + h, (r.z0 + r.z1) / 2, along ? Math.PI / 2 : 0), { worldUV: true });
    if (along) { b.col({ x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z1, top: C + h, climb: true }); }
    else b.col({ x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z1, top: C + h, climb: true });
  };
  const tower = (x, z, r, h, roofH, key = 'stone', roof = 'copper') => {
    b.add(key, new THREE.CylinderGeometry(r, r * 1.05, h + 6, 20), M4(x, C - 6 + (h + 6) / 2, z), { worldUV: true });
    b.add(roof, new THREE.ConeGeometry(r * 1.25, roofH, 20), M4(x, C + h + roofH / 2, z), { worldUV: true });
    b.col({ x, z, r, top: C + h, climb: true });
  };
  hall(B.refectory, 16); hall(B.kitchen, 12); hall(B.library, 13); hall(B.dorm, 9 - (C - ACAD.dormY));
  box('stone', B.eastRange.x0, B.eastRange.x1, B.eastRange.z0, B.eastRange.z1, C - 3, C + 10);
  b.col({ x0: B.eastRange.x0, x1: B.eastRange.x1, z0: B.eastRange.z0, z1: B.eastRange.arch - 3, top: C + 10, climb: true });
  b.col({ x0: B.eastRange.x0, x1: B.eastRange.x1, z0: B.eastRange.arch + 3, z1: B.eastRange.z1, top: C + 10, climb: true });
  tower(B.libTower.x, B.libTower.z, B.libTower.r, 34, 14); tower(B.nwTower.x, B.nwTower.z, B.nwTower.r, 24, 12); tower(B.neTower.x, B.neTower.z, B.neTower.r, 20, 10);
  tower(B.oswin.x, B.oswin.z, B.oswin.r, 30, 10, 'stone', 'copper');
  box('stone', B.bell.x - B.bell.w / 2, B.bell.x + B.bell.w / 2, B.bell.z - B.bell.w / 2, B.bell.z + B.bell.w / 2, C - 4, C + 52);
  b.add('copper', new THREE.ConeGeometry(B.bell.w * 0.75, 20, 4), M4(B.bell.x, C + 62, B.bell.z, Math.PI / 4), { worldUV: true });
  b.col({ x0: B.bell.x - B.bell.w / 2, x1: B.bell.x + B.bell.w / 2, z0: B.bell.z - B.bell.w / 2, z1: B.bell.z + B.bell.w / 2, top: C + 52, climb: true });
  // 성문: 가운데 통로를 남긴 두 덩어리
  const G_ = B.gate;
  for (const s of [-1, 1]) { box('stone', G_.x - 7, G_.x + 7, G_.z + s * 3 - (s > 0 ? 0 : 7), G_.z + s * 3 + (s > 0 ? 7 : 0), C - 6, C + 14); b.col({ x0: G_.x - 7, x1: G_.x + 7, z0: s > 0 ? G_.z + 3 : G_.z - 10, z1: s > 0 ? G_.z + 10 : G_.z - 3, top: C + 14, climb: true }); tower(G_.x - 4, G_.z + s * 11, 4.5, 18, 9); }
  box('stone', G_.x - 7, G_.x + 7, G_.z - 3, G_.z + 3, C + 6, C + 14);
  // 성벽 (서쪽 협곡 가장자리)
  const wall = (ax, az, bx, bz, h) => { const cx = (ax + bx) / 2, cz = (az + bz) / 2, L = Math.hypot(bx - ax, bz - az), rot = Math.atan2(-(bz - az), bx - ax); b.add('stone', new THREE.BoxGeometry(L, h + 8, 2), M4(cx, C + h / 2 - 4, cz, rot), { worldUV: true }); b.col({ x: cx, z: cz, hw: L / 2, hd: 1, rot, top: C + h, climb: true }); };
  wall(B.nwTower.x, B.nwTower.z + 5, G_.x - 6, G_.z - 10, 9); wall(G_.x - 6, G_.z + 10, B.libTower.x - 3, B.libTower.z - 6, 9);
  // 대정원 바닥
  b.add('flagstone', new THREE.PlaneGeometry(B.court.x1 - B.court.x0, B.court.z1 - B.court.z0).rotateX(-Math.PI / 2), M4((B.court.x0 + B.court.x1) / 2, C + 0.03, (B.court.z0 + B.court.z1) / 2), { worldUV: true });
  // 고가교
  const V = ACAD.viaduct, L = V.bx - V.ax, ang = Math.atan2(V.y1 - V.y0, L);
  b.add('stone', new THREE.BoxGeometry(Math.hypot(L, V.y1 - V.y0), 1.2, V.w), M4e((V.ax + V.bx) / 2, (V.y0 + V.y1) / 2 - 0.6, V.z, 0, 0, ang), { worldUV: true });
  for (let i = 0; i <= 6; i++) { const x = lerp(V.ax + 6, V.bx - 6, i / 6), gy = m.ground(x, V.z), top = lerp(V.y0, V.y1, (x - V.ax) / L) - 1.2; b.add('stone', new THREE.BoxGeometry(3, top - gy + 2, V.w), M4(x, (top + gy - 2) / 2, V.z), { worldUV: true }); b.col({ x0: x - 1.5, x1: x + 1.5, z0: V.z - V.w / 2, z1: V.z + V.w / 2, top: top, climb: true }); }
  return b.build();
}

// ======================================================================
// 아랫마을: 돌 바닥층 위에 목조 골조 윗층, 가파른 슬레이트 지붕
// ======================================================================
const _tmpG = {};
function tBox(b, key, w, h, d, x, y, z, rot, o) { b.add(key, new THREE.BoxGeometry(w, h, d), M4(x, y, z, rot), Object.assign({ worldUV: true }, o)); }
// 로컬 좌표(집 중심 기준, 앞면 +z)를 월드로
function townHouse(b, m, x, z, rot, o) {
  const w = o.w, d = o.d, floors = o.floors, gh = 3.1, uh = 2.7, jet = 0.4, seed = o.seed;
  const co = Math.cos(rot), si = Math.sin(rot);
  const W = (lx, lz) => [x + lx * co + lz * si, z - lx * si + lz * co];
  // 땅: 네 모서리 중 가장 낮은 곳을 바닥으로, 가장 높은 곳까지 기초
  let gmin = 1e9, gmax = -1e9;
  for (const [lx, lz] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2], [0, 0]]) { const [wx, wz] = W(lx, lz); const g = m.ground(wx, wz); gmin = Math.min(gmin, g); gmax = Math.max(gmax, g); }
  const y0 = gmax + 0.15; // 바닥
  const P = (lx, ly, lz) => { const [wx, wz] = W(lx, lz); return [wx, y0 + ly, wz]; };
  const box = (key, bw, bh, bd, lx, ly, lz, ro = 0, opt) => { const [wx, wy, wz] = P(lx, ly, lz); tBox(b, key, bw, bh, bd, wx, wy, wz, rot + ro, opt); };
  const tint = o.tint;
  // 기초와 돌 바닥층
  box('stoneEarly', w, gh + (y0 - gmin) + 0.6, d, 0, gh / 2 - (y0 - gmin) / 2 - 0.3, 0);
  box('stoneTrim', w + 0.16, 0.22, d + 0.16, 0, gh - 0.11, 0);
  // 윗층 (내민 층)
  let top = gh;
  for (let f = 0; f < floors; f++) {
    const fw = w + jet * 2 * (f + 1) * 0.6, fd = d + jet * 2 * (f + 1) * 0.6, yb = top;
    box('plaster', fw, uh, fd, 0, yb + uh / 2, 0, 0, { color: tint });
    // 층 사이 들보와 기둥, 가로대, 가새
    box('timber', fw + 0.1, 0.24, fd + 0.1, 0, yb + 0.12, 0);
    box('timber', fw + 0.1, 0.2, fd + 0.1, 0, yb + uh - 0.1, 0);
    for (const [sx, sz, len, axis] of [[0, fd / 2, fw, 'x'], [0, -fd / 2, fw, 'x'], [fw / 2, 0, fd, 'z'], [-fw / 2, 0, fd, 'z']]) {
      const n = Math.max(2, Math.round(len / 1.3));
      for (let i = 0; i <= n; i++) {
        const t = -len / 2 + len * i / n, lx = axis === 'x' ? t : sx, lz = axis === 'x' ? sz : t;
        const out = axis === 'x' ? [0, Math.sign(sz) * 0.04] : [Math.sign(sx) * 0.04, 0];
        box('timber', 0.17, uh - 0.3, 0.17, lx + out[0], yb + uh / 2, lz + out[1]);
        if (i < n && hash2(seed + i, f, 3) < 0.45) { // 가새
          const L = Math.hypot(len / n, uh - 0.4), ang = Math.atan2(uh - 0.4, len / n) * (hash2(seed, i, 4) < 0.5 ? 1 : -1);
          const mx = lx + (axis === 'x' ? len / n / 2 : 0), mz = lz + (axis === 'z' ? len / n / 2 : 0);
          const [wx, wy, wz] = P(mx + out[0], yb + uh / 2, mz + out[1]);
          b.add('timber', new THREE.BoxGeometry(L, 0.14, 0.14), M4e(wx, wy, wz, axis === 'x' ? 0 : 0, rot + (axis === 'x' ? 0 : Math.PI / 2), ang), { worldUV: true });
        }
      }
      box('timber', axis === 'x' ? len : 0.15, 0.15, axis === 'x' ? 0.15 : len, sx + (axis === 'z' ? Math.sign(sx) * 0.05 : 0), yb + uh * 0.48, sz + (axis === 'x' ? Math.sign(sz) * 0.05 : 0));
    }
    top += uh;
  }
  // 창: 앞뒤에 윗층마다 두세 개, 바닥층 앞에 하나
  const winLit = o.lit;
  const win = (lx, ly, lz, ww, wh, face) => {
    const nz = face; // +1 앞, -1 뒤
    box(winLit && hash2(seed, lx * 10 | 0, ly * 10 | 0) < 0.5 ? 'glassLit' : 'glassDark', ww, wh, 0.06, lx, ly, lz + nz * 0.02, 0, { color: [0.7 + hash2(seed, 2, lx * 7 | 0) * 0.5, 0.75, 0.7] });
    box('timber', ww + 0.24, 0.12, 0.14, lx, ly + wh / 2 + 0.06, lz + nz * 0.05);
    box('timber', ww + 0.3, 0.1, 0.24, lx, ly - wh / 2 - 0.05, lz + nz * 0.1);
    box('timber', 0.06, wh, 0.08, lx, ly, lz + nz * 0.05);
    if (hash2(seed, ly * 3 | 0, 9) < 0.6) for (const s of [-1, 1]) box('oak', ww / 2, wh + 0.05, 0.05, lx + s * (ww * 0.75 + 0.06), ly, lz + nz * 0.08, 0, { color: o.shutter });
  };
  let yb = gh;
  for (let f = 0; f < floors; f++) {
    const fd = d + jet * 2 * (f + 1) * 0.6, n = w > 6.5 ? 3 : 2;
    for (let i = 0; i < n; i++) { const lx = -w / 2 + w * (i + 0.5) / n; win(lx, yb + uh * 0.55, fd / 2 + 0.02, 0.8, 1.1, 1); win(lx, yb + uh * 0.55, -fd / 2 - 0.02, 0.8, 1.1, -1); }
    yb += uh;
  }
  win(w * 0.28, 1.7, d / 2 + 0.05, 0.9, 1.0, 1);
  // 문: 둥근 머리 참나무 문, 돌 문틀, 계단 한 단, 등 걸이
  const dx = -w * 0.22;
  box('oak', 1.1, 2.15, 0.12, dx, 1.08, d / 2 + 0.02);
  box('stoneTrim', 1.5, 0.25, 0.3, dx, 2.3, d / 2 + 0.1);
  for (const s of [-1, 1]) box('stoneTrim', 0.22, 2.3, 0.3, dx + s * 0.66, 1.15, d / 2 + 0.1);
  box('stoneTrim', 1.6, 0.18, 0.7, dx, 0.09 - 0.1, d / 2 + 0.35);
  box('iron', 0.04, 0.04, 0.5, dx + 0.95, 2.6, d / 2 + 0.25);
  const [lx_, ly_, lz_] = P(dx + 0.95, 2.35, d / 2 + 0.48);
  box('glow', 0.18, 0.26, 0.18, dx + 0.95, 2.35, d / 2 + 0.48);
  box('iron', 0.24, 0.05, 0.24, dx + 0.95, 2.51, d / 2 + 0.48);
  b.light({ x: lx_, y: ly_, z: lz_, c: 0xffb060, k: 0.9, d: 7, flicker: true });
  // 지붕: 55~60° 박공, 처마가 나온다
  const fw = w + jet * 2 * floors * 0.6 + 0.6, fd = d + jet * 2 * floors * 0.6 + 0.7, pitch = (55 + hash2(seed, 5, 5) * 5) * Math.PI / 180;
  const rh = fw / 2 * Math.tan(pitch), sl = fw / 2 / Math.cos(pitch);
  for (const s of [-1, 1]) {
    const [wx, wy, wz] = P(s * fw / 4, top + rh / 2, 0);
    b.add('slate', new THREE.BoxGeometry(sl + 0.2, 0.22, fd), M4e(wx, wy, wz, 0, rot, -s * pitch), { worldUV: true, color: o.roofTint });
  }
  { const [wx, wy, wz] = P(0, top + rh + 0.08, 0); b.add('lead', new THREE.BoxGeometry(0.34, 0.2, fd + 0.1), M4(wx, wy, wz, rot), { worldUV: true }); }
  // 박공 벽 (회반죽 삼각형 + 가운데 기둥)
  for (const s of [-1, 1]) {
    const shp = new THREE.Shape([new THREE.Vector2(-fw / 2 + 0.35, 0), new THREE.Vector2(fw / 2 - 0.35, 0), new THREE.Vector2(0, rh - 0.4)]);
    const gg = new THREE.ExtrudeGeometry(shp, { depth: 0.2, bevelEnabled: false }); gg.translate(0, 0, -0.1);
    const [wx, wy, wz] = P(0, top, s * (fd / 2 - 0.4));
    b.add('plaster', gg, M4(wx, wy, wz, rot), { worldUV: true, color: tint });
    box('timber', 0.16, rh - 0.5, 0.16, 0, top + (rh - 0.5) / 2, s * (fd / 2 - 0.28));
  }
  // 굴뚝과 연기
  const cxl = fw * 0.22 * (hash2(seed, 6, 6) < 0.5 ? -1 : 1), czl = -fd * 0.2;
  box('stoneEarly', 0.9, rh + 1.6, 0.9, cxl, top + (rh + 1.6) / 2 + 0.2, czl);
  box('stoneTrim', 1.1, 0.16, 1.1, cxl, top + rh + 1.9, czl);
  const [sx, sy, sz] = P(cxl, top + rh + 2.1, czl);
  b.anims.push(() => { if (Math.random() < 0.06) FX.spawn({ x: sx + rand(-0.2, 0.2), y: sy, z: sz + rand(-0.2, 0.2), vx: 0.5, vy: 1.0, life: 3.2, size: 0.8, c: 0xb8b0a8, add: false, a: 0.28, shrink: false, drag: 0.25 }); });
  // 간판
  if (o.sign) {
    box('iron', 0.05, 0.05, 1.1, dx - 1.0, 2.9, d / 2 + 0.55);
    box('oak', 0.06, 0.6, 0.8, dx - 1.0, 2.5, d / 2 + 0.95, 0, { color: o.sign });
  }
  // 충돌: 바닥층과 윗층
  const [cx, cz] = W(0, 0);
  b.col({ x: cx, z: cz, hw: w / 2 + 0.1, hd: d / 2 + 0.1, rot, top: y0 + top, bot: gmin - 2, climb: true });
  b.col({ x: cx, z: cz, hw: fw / 2 - 0.3, hd: fd / 2 - 0.35, rot, top: y0 + top + rh * 0.6, bot: y0 + gh, climb: true });
  return { top: y0 + top + rh };
}
// 길을 따라 양쪽에 집을 세운다
function placeTown(m, b) {
  const tints = [0xe8dfc8, 0xd9c08a, 0xc9a79a, 0xe2d6b8, 0xd4c4a0], shut = [0x3a4a3a, 0x5a2a22, 0x2a3a5a, 0x4a3a28];
  const taken = [];
  const free = (x, z, r) => taken.every(t => Math.hypot(t[0] - x, t[1] - z) > t[2] + r);
  let k = 0;
  const along = (pts, every, side, signFn) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L;
      for (let s = every * 0.6; s < L - 4; s += every + hash2(k, 1, 81) * 3) {
        for (const sd of side) {
          k++;
          const w = 5.2 + hash2(k, 2, 81) * 2.8, d = 6 + hash2(k, 3, 81) * 2.5, off = 3 + 2.4 + d / 2 + hash2(k, 4, 81) * 1.2;
          const nx = -uz * sd, nz = ux * sd, x = ax + ux * s + nx * off, z = az + uz * s + nz * off;
          if (!free(x, z, Math.max(w, d) * 0.62)) continue;
          if (x < 8 || z < 8 || x > m.W - 8 || z > m.D - 8) continue;
          const gi = m.near(x, z);
          if (m.wl[gi] > -50 || (m.fl[gi] & SF.ROAD)) continue;
          // 경사가 너무 급하면 건너뛴다
          if (Math.abs(m.ground(x + 3, z) - m.ground(x - 3, z)) + Math.abs(m.ground(x, z + 3) - m.ground(x, z - 3)) > 5) continue;
          const rot = Math.atan2(-nx, -nz) + (hash2(k, 5, 81) - 0.5) * 0.12; // 앞면이 길을 본다
          taken.push([x, z, Math.max(w, d) * 0.62]);
          townHouse(b, m, x, z, rot, { w, d, floors: hash2(k, 6, 81) < 0.55 ? 1 : 2, seed: k * 13, tint: tints[k % tints.length], shutter: shut[k % shut.length], roofTint: hash2(k, 7, 81) < 0.25 ? 0x6a6a52 : 0xffffff, lit: true, sign: signFn && signFn(k) });
          const i2 = m.near(x, z); m.fl[i2] |= SF.BUILD;
        }
      }
    }
  };
  along(SITE_ROADS[0].pts.slice(1), 9, [1, -1], k => k % 5 === 0 ? [0x8a3a2a, 0x2a4a6a, 0x5a6a3a][k % 3] : null);
  along(SITE_ROADS[1].pts, 9, [1, -1]);
  along(SITE_ROADS[2].pts, 10, [1, -1]);
  along(SITE_ROADS[3].pts, 11, [1, -1]);
  // 광장 둘레
  const tq = ACAD.townSquare;
  for (let a = 0; a < 6.28; a += 0.62) {
    k++;
    const x = tq.x + Math.cos(a) * (tq.r + 7), z = tq.z + Math.sin(a) * (tq.r + 7);
    if (!free(x, z, 4.6)) continue;
    const gi = m.near(x, z); if (m.fl[gi] & SF.ROAD) continue;
    taken.push([x, z, 4.6]);
    townHouse(b, m, x, z, Math.atan2(tq.x - x, tq.z - z), { w: 6 + hash2(k, 2, 83) * 2, d: 7, floors: 2, seed: k * 17, tint: tints[k % tints.length], shutter: shut[k % shut.length], lit: true, sign: k % 2 ? 0x6a2a22 : null });
  }
  return taken;
}

// ======================================================================
// 들판 꾸미기: 마른 돌담, 룬 띠를 두른 선돌, 나무 울타리
// ======================================================================
// 마른 돌담: 꺾은선을 따라 크고 작은 돌을 두세 줄로 쌓고 위에 세운 갓돌
function dryWall(b, m, pts, o = {}) {
  const H = o.h ?? 1.1, T = o.t ?? 0.7;
  let k = o.seed ?? 1;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L, rot = Math.atan2(-uz, ux);
    for (let row = 0, y = 0; row < 3 && y < H - 0.2; row++) {
      let s = (row % 2) * 0.25;
      const rh0 = 0.26 + hash2(k, row, 101) * 0.1;
      while (s < L) {
        k++;
        const rh = rh0 * (0.75 + hash2(k, 11, 101) * 0.5), len = 0.25 + Math.pow(hash2(k, 1, 101), 1.6) * 0.7, x = ax + ux * (s + len / 2), z = az + uz * (s + len / 2), gy = m.ground(x, z);
        const g = new THREE.BoxGeometry(len * 0.96, rh, T * (0.85 + hash2(k, 2, 101) * 0.2), 1, 1, 1);
        // 모서리를 조금씩 흔들어 다듬지 않은 돌처럼
        const p = g.attributes.position;
        for (let v = 0; v < p.count; v++) { p.setX(v, p.getX(v) * (0.9 + hash2(k, v, 103) * 0.15)); p.setY(v, p.getY(v) * (0.85 + hash2(k, v, 105) * 0.25)); p.setZ(v, p.getZ(v) * (0.9 + hash2(k, v, 107) * 0.15)); }
        g.computeVertexNormals();
        const tone = 0.78 + hash2(k, 3, 101) * 0.3;
        b.add(o.key || 'rock', g, M4e(x, gy + y + rh / 2 - 0.08, z, (hash2(k, 4, 101) - 0.5) * 0.08, rot + (hash2(k, 5, 101) - 0.5) * 0.12, (hash2(k, 6, 101) - 0.5) * 0.1), { worldUV: true, color: [tone, tone * 0.98, tone * 0.93] });
        s += len;
      }
      y += rh0 * 0.92;
    }
    // 갓돌: 세워 박은 납작한 돌
    for (let s = 0.1; s < L; s += 0.13 + hash2(k, 7, 101) * 0.08) {
      k++;
      const x = ax + ux * s, z = az + uz * s, gy = m.ground(x, z), hh = 0.16 + hash2(k, 9, 101) * 0.1;
      b.add(o.key || 'rock', new THREE.BoxGeometry(0.09, hh, T * (0.75 + hash2(k, 10, 101) * 0.25)), M4e(x, gy + H - 0.12 + hh / 2, z, 0, rot, (hash2(k, 8, 101) - 0.5) * 0.7), { worldUV: true, color: [0.8, 0.79, 0.74] });
    }
    // 충돌 (낮아서 넘어갈 수 있다: 올라설 수 있음)
    const cx = (ax + bx) / 2, cz = (az + bz) / 2;
    b.col({ x: cx, z: cz, hw: L / 2, hd: T / 2, rot, top: m.ground(cx, cz) + H, stand: true, climb: true });
  }
}
// 선돌: 고대층 돌, 가운데에 룬 띠가 희미하게 빛난다 (레이 선을 따라 줄지어 선다)
function standingStone(b, m, x, z, o = {}) {
  const k = o.seed || 1, h = 2.6 + hash2(k, 1, 111) * 1.8, w = 0.9 + hash2(k, 2, 111) * 0.4, gy = m.ground(x, z);
  const g = new THREE.CylinderGeometry(w * 0.42, w * 0.55, h, 7, 6);
  const p = g.attributes.position;
  for (let v = 0; v < p.count; v++) { const yy = p.getY(v) / h + 0.5, n = noise2(p.getX(v) * 3 + k, p.getZ(v) * 3 + yy * 4, 113); p.setX(v, p.getX(v) * (0.85 + n * 0.3) * (1 - yy * 0.25)); p.setZ(v, p.getZ(v) * (0.6 + n * 0.2)); }
  g.computeVertexNormals();
  const rot = o.rot ?? hash2(k, 3, 111) * 6.28, lean = (hash2(k, 4, 111) - 0.5) * 0.12;
  b.add('stoneOld', g, M4e(x, gy + h / 2 - 0.3, z, lean, rot, 0), { worldUV: true });
  b.add('brass', new THREE.CylinderGeometry(w * 0.44, w * 0.46, 0.12, 9, 1, true), M4e(x, gy + h * 0.55, z, lean, rot, 0), { worldUV: true });
  b.add('mana', new THREE.TorusGeometry(w * 0.45, 0.018, 4, 18).rotateX(Math.PI / 2), M4e(x, gy + h * 0.55 + 0.08, z, lean, rot, 0), { color: [0.45, 0.6, 0.62] });
  b.col({ x, z, r: w * 0.45, top: gy + h, climb: true });
}
// 나무 울타리 (기둥 + 가로대 둘)
function fence(b, m, pts, o = {}) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / 2.2));
    for (let j = 0; j <= n; j++) {
      const x = lerp(ax, bx, j / n), z = lerp(az, bz, j / n), gy = m.ground(x, z);
      b.add('timber', new THREE.BoxGeometry(0.14, 1.25, 0.14), M4e(x, gy + 0.55, z, (hash2(i, j, 115) - 0.5) * 0.08, 0, (hash2(j, i, 115) - 0.5) * 0.08), { worldUV: true });
      if (j < n) {
        const x2 = lerp(ax, bx, (j + 1) / n), z2 = lerp(az, bz, (j + 1) / n), g2 = m.ground(x2, z2), l = Math.hypot(x2 - x, z2 - z), rot = Math.atan2(-(z2 - z), x2 - x);
        for (const hh of [0.45, 0.95]) b.add('timber', new THREE.BoxGeometry(l + 0.1, 0.1, 0.07), M4e((x + x2) / 2, (gy + g2) / 2 + hh, (z + z2) / 2, 0, rot, Math.atan2(g2 - gy, l)), { worldUV: true });
      }
    }
  }
}
function siteDressing(m) {
  const b = new Batch();
  // 동쪽 들판을 나누는 돌담
  dryWall(b, m, [[452, 238], [470, 236], [494, 228], [510, 222]], { seed: 3 });
  dryWall(b, m, [[452, 264], [474, 266], [490, 276], [508, 282]], { seed: 5 });
  dryWall(b, m, [[468, 236], [472, 200], [468, 170], [456, 140]], { seed: 7 });
  dryWall(b, m, [[476, 266], [482, 300], [478, 340], [470, 380]], { seed: 9 });
  dryWall(b, m, [[380, 140], [410, 150], [440, 150], [460, 140]], { seed: 11 });
  // 남쪽 숲길 가
  dryWall(b, m, [[346, 362], [360, 384], [384, 412], [408, 440]], { seed: 13 });
  // 마을 서쪽 밭 둘레
  dryWall(b, m, [[60, 140], [100, 136], [130, 150]], { seed: 15 });
  dryWall(b, m, [[30, 220], [70, 214], [110, 226]], { seed: 17 });
  dryWall(b, m, [[50, 320], [90, 300], [120, 290]], { seed: 19 });
  fence(b, m, [[100, 160], [100, 200], [130, 204], [134, 170]]);
  fence(b, m, [[40, 250], [60, 280], [92, 268]]);
  // 학원에서 대륙 쪽으로 뻗는 레이 선을 따라 선 선돌들
  [[470, 250], [486, 218], [492, 186], [430, 160], [412, 128], [120, 60], [96, 40]].forEach(([x, z], i) => standingStone(b, m, x, z, { seed: i + 3 }));
  return b;
}
