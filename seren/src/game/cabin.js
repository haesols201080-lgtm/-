// 착륙선 「라르크 2」의 선실: 건물처럼 바깥과 떨어진 실내 공간(POCKET_Y)에 따로 짓는다.
// 해치(경사판 위)에서 E → 로딩 → 선실. 바깥 착륙선은 닫힌 배일 뿐 속이 비치지 않는다.
//   앞: 조종석(좌석 둘·계기판·앞 유리·머리 위 스위치판)
//   가운데: 모아 교신 단말(왼쪽 벽) · 별지도 탁자(빛 행성들) · 출입 기밀실 문(오른쪽 벽)
//   뒤: 이층 침상 · 부엌 선반 · 장비 사물함(여분의 탐사복) · 묶어 둔 짐 · 표본함 · 기관실 해치
// 로컬 좌표: u = 앞(+조종석), w = 옆(+문 쪽), y = 위. 세계에서는 축을 그대로(실내 공간이라 방향은 상관없다).
import * as THREE from 'three';
import { glowMaterial } from '../world/materials.js';

const HULL = 0xd8d4cc, PANEL = 0xc4c0bc, DARK = 0x3a3c48, FLOORC = 0x55596a, ORANGE = 0xff8a4c, TEAL = 0x7ff3e6, GOLD = 0xe9c27c, PAD = 0xb8b4c4;
export const CABIN = { U0: -5.6, U1: 5.4, W: 2.3, H: 3.0 };

/** I = Interiors (재질·도우미), at = { x, z, fy } 선실 가운데 바닥 */
export function buildCabin(I, game, at) {
  const { U0, U1, W, H } = CABIN;
  const { x: cx, z: cz, fy } = at;
  const C = game.world.colliders;
  const geoms = [];
  const put = (geo, color, emit, u, y, w, ry = 0) => { geo.rotateY(ry); geo.translate(cx + u, fy + y, cz + w); geoms.push(I._paint(geo, color, emit)); };
  const box = (sx, sy, sz, color, emit, u, y, w, ry = 0) => put(new THREE.BoxGeometry(sx, sy, sz), color, emit, u, y + sy / 2, w, ry);
  const cols = [];
  const col = (c) => cols.push(C.add({ city: true, sky: true, ...c }));
  const solid = (u, w, hu, hw, y1, ry = 0) => col({ type: 'box', x: cx + u, z: cz + w, hx: hu, hz: hw, rot: ry, y0: fy - 1, y1: fy + y1 });
  const group = new THREE.Group();
  const anims = [];

  // ── 바닥: 격자 판 + 가운데 빛 안내줄 ──
  box(U1 - U0, 0.1, 2 * W, FLOORC, 0, (U0 + U1) / 2, -0.1, 0);
  for (let u = U0 + 0.6; u < U1; u += 0.6) box(0.04, 0.012, 2 * W - 0.2, 0x40434f, 0, u, 0, 0);
  box(U1 - U0 - 1.2, 0.015, 0.06, TEAL, 1.2, (U0 + U1) / 2, 0.005, 0.0);
  col({ type: 'box', x: cx + (U0 + U1) / 2, z: cz, hx: (U1 - U0) / 2 + 0.3, hz: W + 0.3, y0: fy - 3, y1: fy });
  // ── 천장: 갈비 + 빛판 ──
  box(U1 - U0, 0.12, 2 * W, 0xdcd8d0, 0.05, (U0 + U1) / 2, H, 0);
  for (let u = U0 + 0.55; u < U1 - 0.2; u += 1.1) {
    box(0.14, 0.2, 2 * W, GOLD, 0.05, u, H - 0.2, 0);
    if (u + 0.55 < U1 - 0.3) box(0.8, 0.03, 0.5, 0xfff4e0, 1.5, u + 0.55, H - 0.03, 0);
  }
  col({ type: 'box', x: cx + (U0 + U1) / 2, z: cz, hx: (U1 - U0) / 2 + 0.3, hz: W + 0.3, y0: fy + H, y1: fy + H + 2, walk: false });
  // ── 벽: 아래는 누빈 판, 위는 관·전선 받침 ──
  for (const s of [-1, 1]) {
    box(U1 - U0, H, 0.1, HULL, 0, (U0 + U1) / 2, 0, s * (W + 0.05));
    for (let u = U0 + 0.45; u < U1 - 0.3; u += 0.62) for (let y = 0.25; y < 1.7; y += 0.55) {
      if (s > 0 && u > -1.3 && u < 0.9) continue; // 문 자리
      box(0.56, 0.5, 0.05, PAD, 0, u, y, s * (W - 0.02));
    }
    for (const y of [2.15, 2.35]) put(new THREE.CylinderGeometry(0.05, 0.05, U1 - U0 - 0.4, 6).rotateZ(Math.PI / 2), y > 2.2 ? ORANGE : 0x8a8e9a, y > 2.2 ? 0.25 : 0, (U0 + U1) / 2, y, s * (W - 0.12));
    box(U1 - U0 - 0.4, 0.04, 0.22, 0x8a8e9a, 0, (U0 + U1) / 2, 2.55, s * (W - 0.15));
    col({ type: 'box', x: cx + (U0 + U1) / 2, z: cz + s * (W + 0.2), hx: (U1 - U0) / 2 + 0.3, hz: 0.2, y0: fy - 1, y1: fy + H + 1, walk: false });
  }
  // 둥근 창 (바깥 하늘) 셋
  const winP = [], winU = [];
  const porthole = (u, w, y, r, nrm) => {
    const g = new THREE.CircleGeometry(r, 20);
    if (nrm < 0) g.rotateY(0); else g.rotateY(Math.PI);
    g.translate(cx + u, fy + y, cz + w);
    const p = g.toNonIndexed().attributes.position.array;
    for (let i = 0; i < p.length; i += 3) { winP.push(p[i], p[i + 1], p[i + 2]); winU.push(0.5 + (p[i] - cx - u) / (2 * r) * 0.9, 0.5 + (p[i + 1] - fy - y) / (2 * r)); }
    put(new THREE.TorusGeometry(r + 0.04, 0.05, 4, 20), GOLD, 0.2, u, y, w + (nrm < 0 ? 0.02 : -0.02));
  };
  porthole(-1.9, -W + 0.02, 1.75, 0.32, -1);
  porthole(-3.4, -W + 0.02, 1.75, 0.32, -1);
  porthole(1.9, W - 0.02, 1.75, 0.32, 1);
  // 앞·뒤 벽
  box(0.1, H, 2 * W, HULL, 0, U0 - 0.05, 0, 0);
  col({ type: 'box', x: cx + U0 - 0.2, z: cz, hx: 0.2, hz: W + 0.3, y0: fy - 1, y1: fy + H + 1, walk: false });
  col({ type: 'box', x: cx + U1 + 0.2, z: cz, hx: 0.2, hz: W + 0.3, y0: fy - 1, y1: fy + H + 1, walk: false });

  // ── 기관실 해치 (뒤 벽): 둥근 문 + 손잡이 바퀴 ──
  put(new THREE.CylinderGeometry(0.75, 0.75, 0.08, 24).rotateZ(Math.PI / 2), 0x8a8e9a, 0, U0 + 0.05, 1.15, -0.9);
  put(new THREE.TorusGeometry(0.75, 0.06, 4, 24).rotateY(Math.PI / 2), ORANGE, 0.4, U0 + 0.1, 1.15, -0.9);
  put(new THREE.TorusGeometry(0.22, 0.03, 4, 16).rotateY(Math.PI / 2), 0xd8d8e0, 0, U0 + 0.14, 1.15, -0.9);
  for (let k = 0; k < 3; k++) box(0.03, 0.44, 0.03, 0xd8d8e0, 0, U0 + 0.14, 0.93, -0.9, (k / 3) * Math.PI);
  // ── 표본함 (뒤 벽 오른쪽): 여섯 칸, 첫 칸만 세렌의 흙이 빛난다 ──
  box(0.5, 1.0, 1.2, 0x5a5e6c, 0, U0 + 0.3, 0, 1.3);
  for (let i = 0; i < 6; i++) {
    const w = 1.3 - 0.38 + (i % 3) * 0.38, y = 0.6 + Math.floor(i / 3) * 0.28;
    put(new THREE.CylinderGeometry(0.09, 0.09, 0.14, 12).rotateZ(Math.PI / 2), i === 0 ? 0x9ff6c8 : 0x2a2c38, i === 0 ? 1.8 : 0.1, U0 + 0.56, y, w);
  }
  solid(U0 + 0.3, 1.3, 0.25, 0.6, 1.0);
  // ── 이층 침상 (뒤 왼쪽) ──
  for (const y of [0.35, 1.45]) {
    box(2.2, 0.12, 0.85, 0x6a6e7c, 0, -4.2, y, -W + 0.5);
    box(2.1, 0.16, 0.8, 0xe8e0f0, 0.05, -4.2, y + 0.12, -W + 0.5);
    put(new THREE.CapsuleGeometry(0.12, 0.4, 3, 8).rotateX(Math.PI / 2), 0xffffff, 0.05, -5.0, y + 0.34, -W + 0.5);
    box(2.2, 0.05, 0.05, TEAL, 0.9, -4.2, y + 0.02, -W + 0.94);
  }
  for (const u of [-5.25, -3.15]) box(0.08, 2.2, 0.08, 0x8a8e9a, 0, u, 0, -W + 0.93);
  box(0.4, 0.06, 0.3, 0xffd27a, 1.6, -3.5, 2.35, -W + 0.3); // 침상 등
  solid(-4.2, -W + 0.5, 1.15, 0.48, 1.7);
  // ── 부엌 선반 (뒤 오른쪽): 조리대 · 물병 · 식량 꾸러미 ──
  box(1.9, 0.92, 0.7, 0xd0ccc4, 0, -3.1, 0, W - 0.4);
  box(1.95, 0.05, 0.75, ORANGE, 0.3, -3.1, 0.92, W - 0.4);
  put(new THREE.CylinderGeometry(0.12, 0.12, 0.34, 10), 0x9fdcff, 0.4, -3.6, 1.12, W - 0.35);
  put(new THREE.CylinderGeometry(0.08, 0.07, 0.12, 10), 0xe8e4dc, 0, -2.9, 1.0, W - 0.45);
  for (let k = 0; k < 4; k++) box(0.22, 0.12, 0.16, [0xffc46a, 0x9ff6c8, 0xff9fd0, 0xd8e0ff][k], 0.15, -2.5 + (k % 2) * 0.26, 0.95 + Math.floor(k / 2) * 0.12, W - 0.5);
  box(1.9, 0.7, 0.35, 0xc4c0bc, 0, -3.1, 1.75, W - 0.25); // 위 찬장
  solid(-3.1, W - 0.4, 0.95, 0.38, 0.95);
  // ── 장비 사물함 (왼쪽 가운데): 유리 너머 여분의 탐사복 ──
  box(1.2, 2.3, 0.7, 0x6a6e7c, 0, -1.4, 0, -W + 0.38);
  put(new THREE.CapsuleGeometry(0.22, 0.75, 4, 10), 0xe8e4dc, 0.05, -1.4, 1.1, -W + 0.4);
  put(new THREE.SphereGeometry(0.2, 12, 10), 0xe8e4dc, 0.05, -1.4, 1.75, -W + 0.4);
  put(new THREE.CircleGeometry(0.12, 12).rotateY(Math.PI / 2 - Math.PI / 2), 0x2a4a58, 0.4, -1.4, 1.78, -W + 0.6);
  box(0.4, 0.06, 0.3, ORANGE, 0.5, -1.4, 1.3, -W + 0.42);
  put(new THREE.PlaneGeometry(1.0, 2.0), 0x9fdcff, 0.08, -1.4, 1.15, -W + 0.74);
  solid(-1.4, -W + 0.38, 0.6, 0.36, 2.3);
  // ── 묶어 둔 짐 (뒤 가운데) ──
  for (const [u, w, s] of [[-4.6, 0.6, 0.55], [-4.0, 0.9, 0.42], [-4.55, 1.0, 0.36]]) {
    box(s, s, s, 0x8a7a6a, 0, u, 0, w);
    box(s + 0.02, 0.04, 0.06, ORANGE, 0.3, u, s * 0.6, w);
  }
  solid(-4.3, 0.8, 0.55, 0.45, 0.6);

  // ── 출입 기밀실 문 (오른쪽 벽 가운데): 문틀 + 빛 이음매 + 나가는 등 ──
  const doorU = -0.2;
  for (const s of [-1, 1]) box(0.16, 2.4, 0.2, ORANGE, 0.4, doorU + s * 1.0, 0, W - 0.08);
  box(2.16, 0.18, 0.2, ORANGE, 0.4, doorU, 2.4, W - 0.08);
  box(1.84, 2.36, 0.06, 0x9aa0ac, 0.05, doorU, 0, W - 0.03);
  box(0.03, 2.3, 0.07, TEAL, 1.4, doorU, 0.03, W - 0.05);
  box(0.5, 0.14, 0.04, 0x7fff9a, 1.8, doorU, 2.62, W - 0.06); // 나가는 등
  box(0.18, 0.3, 0.06, 0x2a2c38, 0, doorU + 1.25, 1.1, W - 0.06);
  box(0.12, 0.1, 0.07, TEAL, 1.6, doorU + 1.25, 1.18, W - 0.07);

  // ── 모아 교신 단말 (왼쪽 벽, 조종석 가까이): 화면 + 빛 구슬 + 받침 ──
  const termU = 1.5;
  box(1.4, 0.95, 0.08, 0x2a2c38, 0, termU, 1.0, -W + 0.06);
  put(new THREE.PlaneGeometry(1.24, 0.78), 0x123848, 1.0, termU, 1.475, -W + 0.12);
  for (let k = 0; k < 5; k++) box(0.9 - k * 0.12, 0.02, 0.01, TEAL, 1.4, termU - 0.12, 1.25 + k * 0.1, -W + 0.13);
  box(1.1, 0.06, 0.45, 0x4a4e5c, 0, termU, 0.92, -W + 0.3);
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), glowMaterial({ color: TEAL, intensity: 2.4 }));
  orb.position.set(cx + termU, fy + 1.55, cz - W + 0.32);
  group.add(orb);
  const orbRing = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.012, 4, 24), glowMaterial({ color: TEAL, intensity: 1.6 }));
  orbRing.position.copy(orb.position);
  group.add(orbRing);
  solid(termU, -W + 0.3, 0.6, 0.25, 0.95);

  // ── 별지도 탁자 (가운데): 둥근 탁자 + 빛 행성들 ──
  const mapU = -0.4, mapW = -0.55;
  put(new THREE.CylinderGeometry(0.62, 0.5, 0.1, 24), 0x3c3e4a, 0, mapU, 0.86, mapW);
  put(new THREE.CylinderGeometry(0.12, 0.22, 0.85, 10), 0x8a8e9a, 0, mapU, 0.42, mapW);
  put(new THREE.RingGeometry(0.46, 0.56, 36).rotateX(-Math.PI / 2), TEAL, 1.2, mapU, 0.92, mapW);
  col({ type: 'cyl', x: cx + mapU, z: cz + mapW, r: 0.62, y0: fy - 1, y1: fy + 0.92 });
  const holo = new THREE.Group();
  holo.position.set(cx + mapU, fy + 1.3, cz + mapW);
  holo.add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), glowMaterial({ color: 0xffe0a0, intensity: 2.5 })));
  const orbs = [];
  for (const [r, sz, c, mark] of [[0.16, 0.03, 0x9fdcff, 0], [0.26, 0.05, 0xffb070, 1], [0.36, 0.035, 0xb9a6ff, 2], [0.46, 0.04, 0x9ff6c8, 3], [0.55, 0.03, 0xff9fd0, 2]]) {
    holo.add(new THREE.Mesh(new THREE.RingGeometry(r - 0.004, r + 0.004, 48).rotateX(-Math.PI / 2), glowMaterial({ color: TEAL, intensity: 0.5 })));
    const pl = new THREE.Mesh(new THREE.SphereGeometry(sz, 10, 8), glowMaterial({ color: c, intensity: 1.8 }));
    holo.add(pl);
    let tag = null;
    if (mark) { tag = new THREE.Mesh(new THREE.TorusGeometry(sz * 2.2, 0.006, 3, 18), glowMaterial({ color: mark === 1 ? TEAL : 0xffd27a, intensity: 2 })); holo.add(tag); }
    orbs.push({ r, pl, tag, sp: 0.6 / Math.sqrt(r), a: r * 17 });
  }
  group.add(holo);

  // ── 조종석 (앞): 좌석 둘 · 기울어진 계기판 · 앞 유리 · 머리 위 스위치판 ──
  for (const s of [-0.75, 0.75]) {
    box(0.66, 0.12, 0.62, 0x4a4e5c, 0, 3.4, 0.46, s);
    box(0.12, 0.85, 0.6, 0x4a4e5c, 0, 3.05, 0.55, s, 0);
    box(0.14, 0.25, 0.4, 0x5a5e6c, 0, 3.0, 1.4, s);
    for (const t of [-1, 1]) box(0.5, 0.06, 0.08, ORANGE, 0.2, 3.35, 0.82, s + t * 0.32);
    put(new THREE.CylinderGeometry(0.1, 0.15, 0.45, 8), 0x8a8e9a, 0, 3.4, 0.22, s);
    col({ type: 'cyl', x: cx + 3.35, z: cz + s, r: 0.36, y0: fy - 1, y1: fy + 0.58 });
  }
  box(0.6, 0.85, 2 * W - 0.4, 0x3c3e4a, 0, 4.55, 0, 0, 0);
  put(new THREE.BoxGeometry(0.9, 0.08, 2 * W - 0.4).rotateZ(0.5), 0x2c2e3a, 0, 4.3, 1.02, 0);
  for (let k = 0; k < 6; k++) put(new THREE.PlaneGeometry(0.42, 0.26).rotateY(-Math.PI / 2).rotateZ(0.5), [TEAL, 0xffd27a, 0xff9fd0, 0x9fdcff, TEAL, 0xffd27a][k], 1.3, 4.12, 1.12, -1.6 + k * 0.64);
  for (const s of [-0.75, 0.75]) { put(new THREE.CylinderGeometry(0.025, 0.025, 0.3, 6), 0xd8d8e0, 0, 3.95, 1.05, s * 0.4); put(new THREE.SphereGeometry(0.05, 8, 6), ORANGE, 0.6, 3.95, 1.2, s * 0.4); }
  solid(4.5, 0, 0.42, W - 0.2, 1.1);
  box(1.2, 0.12, 2 * W - 0.6, 0x3c3e4a, 0, 3.6, H - 0.32, 0); // 머리 위 스위치판
  for (let k = 0; k < 14; k++) box(0.05, 0.03, 0.05, [TEAL, 0xffd27a, 0xff6a5a][k % 3], 1.6, 3.2 + (k % 7) * 0.13, H - 0.34, -0.6 + Math.floor(k / 7) * 1.2);
  // 앞 유리: 바깥 하늘이 보인다 (실내 창 재질)
  {
    const wy0 = 1.15, wy1 = 2.75;
    const g = new THREE.PlaneGeometry(2 * W - 0.3, wy1 - wy0).rotateY(-Math.PI / 2);
    g.translate(cx + U1 - 0.02, fy + (wy0 + wy1) / 2, cz);
    const p = g.toNonIndexed().attributes.position.array;
    for (let i = 0; i < p.length; i += 3) { winP.push(p[i], p[i + 1], p[i + 2]); winU.push(1.6 * (0.5 - (p[i + 2] - cz) / (2 * W)), (p[i + 1] - fy - wy0) / (wy1 - wy0)); }
    for (const s of [-1, 1]) box(0.08, wy1 - wy0, 0.12, GOLD, 0.15, U1 - 0.05, wy0, s * (W - 0.18));
    box(0.1, 0.1, 2 * W - 0.2, GOLD, 0.15, U1 - 0.05, wy1, 0);
    box(0.1, 0.06, 2 * W - 0.2, GOLD, 0.15, U1 - 0.05, wy0 - 0.06, 0);
    box(0.08, wy1 - wy0, 0.08, GOLD, 0.15, U1 - 0.05, wy0, 0);
  }
  box(0.1, 1.15, 2 * W, HULL, 0, U1 + 0.05, 0, 0);
  box(0.1, H - 2.75, 2 * W, HULL, 0, U1 + 0.05, 2.75, 0);
  // ── 탐사 일지 화면 (오른쪽 벽, 문과 조종석 사이) ──
  const logU = 2.2;
  box(0.95, 0.62, 0.06, 0x2a2c38, 0, logU, 1.3, W - 0.04);
  put(new THREE.PlaneGeometry(0.85, 0.52).rotateY(Math.PI), 0x1c3a48, 0.9, logU, 1.61, W - 0.08);
  for (let k = 0; k < 4; k++) box(0.6 - k * 0.1, 0.018, 0.01, 0xffd27a, 1.3, logU, 1.45 + k * 0.08, W - 0.09);

  // ── 합치기 ──
  const m = new THREE.Mesh(I._merge(geoms), I.mat);
  m.frustumCulled = false;
  group.add(m);
  if (winP.length) {
    const wg = new THREE.BufferGeometry();
    wg.setAttribute('position', new THREE.Float32BufferAttribute(winP, 3));
    wg.setAttribute('uv', new THREE.Float32BufferAttribute(winU, 2));
    const wm = new THREE.Mesh(wg, I.winMat);
    wm.frustumCulled = false;
    group.add(wm);
  }
  anims.push((t) => {
    for (const o of orbs) { const a = o.a + t * o.sp; o.pl.position.set(Math.cos(a) * o.r, 0, Math.sin(a) * o.r); if (o.tag) { o.tag.position.copy(o.pl.position); o.tag.rotation.y = t; } }
    holo.rotation.y = t * 0.05;
    const pk = game.comm ? game.comm.pulseK : 0;
    orb.material.uniforms.uIntensity.value = 2.0 + Math.sin(t * 2.2) * 0.3 + pk * 3;
    orbRing.rotation.set(t * 0.7, t * 0.5, 0);
  });
  group.userData.indoor = true;
  game.engine.scene.add(group);

  const W2 = (u, w) => [cx + u, cz + w];
  const plan = [W2(U0, -W), W2(U1, -W), W2(U1, W), W2(U0, W)];
  const stations = [
    { at: W2(termU, -W + 1.05), r: 1.1, kind: 'term', label: '모아 교신 단말 · 라르크 호와 이야기하기', short: '교신' },
    { at: W2(mapU + 0.7, mapW + 0.3), r: 1.0, kind: 'map', label: '별지도 · 라르크 호의 항로', short: '별지도' },
    { at: W2(U0 + 0.95, 1.3), r: 0.9, kind: 'samples', label: '표본함 · 다른 별의 칸', short: '표본함' },
    { at: W2(logU, W - 0.9), r: 0.9, kind: 'log', label: '탐사 일지 화면', short: '일지' },
  ];
  // 안의 문 (밖으로): 문 앞 1 m
  const door = { x: cx + doorU, z: cz + W, nx: 0, nz: 1 };
  return { group, cols, anims, plan, stations, door, LH: H };
}
