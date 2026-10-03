// 착륙선 「라르크 2」: 궤도의 탐사선 라르크 호에서 조종사 혼자 타고 내려온 작은 배.
// 바깥: 길쭉한 선체(외피 판 줄·주황 띠), 앞쪽 조종석 유리, 뒤의 주 엔진 둘과 자세 제어 분사구, 짧은 날개와 항법등,
//       관절 달린 착륙 다리 넷, 등의 접시 안테나(궤도의 배를 늘 겨눈다 — 모아가 말할 때 빛난다), 옆 해치와 내린 경사판, 착륙 그을음.
// 안: 걸어 들어갈 수 있는 작은 선실 — 조종석 둘, 모아 교신 단말, 별지도 탁자(다음에 갈지도 모를 별들),
//     표본함(세렌의 흙 한 칸 + 비어 있는 다른 별 칸들), 탐사 일지 화면.
// 로컬 좌표: x = 선체 길이(+x 조종석), z = 옆(+z 해치), y = 위. 놓을 때 ry 로 돌려 해치가 마중 나온 이엘 쪽을 본다.
import * as THREE from 'three';
import { part, xf, lathe, tube } from './geo-utils.js';
import { glowMaterial, litMaterial } from './materials.js';

const HULL = 0xe8e4dc, HULL2 = 0xcfcac2, DARK = 0x3c3e4a, ORANGE = 0xff8a4c, GLASS = 0x1f4a58, TEAL = 0x7ff3e6;
const FLOOR = 1.15, CEIL = 3.85;
export const THRUSTERS = [[3.4, 1.15], [3.4, -1.15], [-3.6, 1.25], [-3.6, -1.25]]; // 배 밑 하강 분사구 (로컬 x, z)

/** 착륙선의 바깥 (로컬 좌표): landed = 문 들리고 경사판 내림·그을음 / 아니면 해치 닫고 날아가는 모습 (오프닝·라르크 호에 붙은 모습) */
export function landerShell({ landed = true } = {}) {
  const parts = [], glass = [], navs = [];
  const put = (L, geo, o, col, e = 0) => L.push(part(xf(geo, o), col, e));
  // ── 선체: 길쭉한 몸을 x 축으로 (가운데 해치 자리는 비운다) ──
  const HP = [[0.0001, -5.6], [1.15, -5.35], [2.15, -4.3], [2.6, -2.2], [2.7, 0], [2.55, 2.4], [2.0, 4.1], [1.05, 5.25], [0.0001, 5.7]];
  const rAt = (y) => { for (let i = 0; i < HP.length - 1; i++) { const [r0, y0] = HP[i], [r1, y1] = HP[i + 1]; if (y <= y1) return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0); } return 0.0001; };
  /** 선체 단면 (축 a0..a1): 토막 끝이 정확히 맞물리게 경계에서 반지름을 구해 넣는다 */
  const prof = (a0, a1) => {
    const ys = [a0, a1];
    for (let i = 0; i < HP.length - 1; i++) for (let k = 0; k < 4; k++) { const y = HP[i][1] + ((HP[i + 1][1] - HP[i][1]) * k) / 4; if (y > a0 + 1e-4 && y < a1 - 1e-4) ys.push(y); }
    ys.sort((a, b) => a - b);
    return ys.map((y) => [Math.max(0.0001, rAt(y)), y]);
  };
  const hullSeg = (a0, a1, phi0 = 0, phiL = Math.PI * 2) => {
    const g = new THREE.LatheGeometry(prof(a0, a1).map(([r, y]) => new THREE.Vector2(r, y)), 28, phi0, phiL);
    g.rotateZ(-Math.PI / 2); // 축 y → x
    g.scale(1, 0.62, 1);
    g.translate(0, 2.55, 0);
    return g;
  };
  const hullCol = (x, y, z) => (y < 1.55 ? DARK : Math.abs(y - 2.2) < 0.06 || Math.abs(y - 3.45) < 0.04 ? ORANGE : (Math.floor((x + 6) / 1.4) % 2 ? HULL : HULL2));
  put(parts, hullSeg(-5.6, -1.05), {}, hullCol);
  put(parts, hullSeg(1.05, 5.7), {}, hullCol);
  put(parts, hullSeg(-1.05, 1.05, 1.0, Math.PI * 2 - 1.42), {}, hullCol); // 해치 자리(+z 옆, 아래쪽)를 비운 가운데 토막
  // 해치 둘레 테 (주황) + 문짝(위로 열린 문)
  for (const [x0, y0, x1, y1] of [[-1.05, FLOOR, -1.05, 3.25], [1.05, FLOOR, 1.05, 3.25]]) put(parts, new THREE.BoxGeometry(0.14, y1 - y0, 0.3), { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: 2.25 }, ORANGE, 0.4);
  put(parts, new THREE.BoxGeometry(2.24, 0.14, 0.3), { x: 0, y: 3.27, z: 2.2 }, ORANGE, 0.4);
  if (landed) put(parts, new THREE.BoxGeometry(2.1, 0.08, 1.2), { x: 0, y: 3.55, z: 2.75, rx: -0.5 }, HULL2); // 들린 문짝
  else put(parts, hullSeg(-1.05, 1.05, -0.42, 1.42), {}, (x, y) => (y < 1.55 ? DARK : HULL2)); // 닫힌 해치
  // 조종석 유리 (앞 위) + 틀
  {
    const g = new THREE.SphereGeometry(1, 20, 12, Math.PI / 2, Math.PI, 0, Math.PI * 0.42); // 앞(+x) 반쪽 윗부분
    g.scale(1.9, 1.05, 1.75);
    put(glass, g, { x: 3.0, y: 3.15, z: 0 }, GLASS, 0.25);
    put(parts, new THREE.TorusGeometry(1.75, 0.07, 4, 24, Math.PI).rotateX(Math.PI / 2).rotateY(Math.PI / 2), { x: 3.0, y: 3.17, z: 0, sx: 1.086 }, ORANGE, 0.6);
  }
  // 등줄기 판 + 표지 띠 + 등 위 정비 해치
  put(parts, new THREE.BoxGeometry(6.5, 0.16, 1.1), { x: -0.6, y: 4.18, z: 0 }, HULL2);
  for (const sz of [-1, 1]) put(parts, new THREE.BoxGeometry(2.2, 0.5, 0.04), { x: -2.6, y: 2.75, z: sz * 2.66, ry: 0 }, ORANGE, 0.3);
  // ── 엔진: 주 엔진 둘 + 안쪽의 은은한 빛 ──
  for (const sz of [-0.95, 0.95]) {
    put(parts, new THREE.CylinderGeometry(0.62, 0.48, 1.6, 18, 1, true).rotateZ(Math.PI / 2), { x: -6.05, y: 2.35, z: sz }, DARK);
    put(parts, new THREE.CylinderGeometry(0.66, 0.66, 0.18, 18).rotateZ(Math.PI / 2), { x: -5.3, y: 2.35, z: sz }, 0x8a8e9a);
    put(parts, new THREE.CircleGeometry(0.46, 16).rotateY(-Math.PI / 2), { x: -5.95, y: 2.35, z: sz }, 0xffb07a, 0.9);
  }
  // 자세 제어 분사구 (네 귀퉁이)
  for (const [x, z] of [[4.2, 1.6], [4.2, -1.6], [-4.4, 2.05], [-4.4, -2.05]]) {
    put(parts, new THREE.BoxGeometry(0.5, 0.32, 0.32), { x, y: 3.0, z }, 0x9a9eaa);
    put(parts, new THREE.ConeGeometry(0.11, 0.24, 8).rotateX(z > 0 ? -Math.PI / 2 : Math.PI / 2), { x, y: 3.0, z: z + Math.sign(z) * 0.26 }, DARK);
  }
  // 짧은 날개 + 항법등 (왼쪽 빨강·오른쪽 초록·끝 흰빛)
  for (const sz of [-1, 1]) {
    const g = new THREE.BoxGeometry(2.6, 0.14, 1.5);
    g.translate(-0.4, 0, sz * 0.75);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) if (pos.getZ(i) * sz > 0.75) pos.setX(i, pos.getX(i) - 0.7); // 끝을 뒤로 젖힌 날개
    g.computeVertexNormals();
    put(parts, g, { x: -2.2, y: 1.9, z: sz * 2.35 }, HULL2);
    navs.push([[-3.0, sz * 3.85], 1.9, sz < 0 ? 0xff5a4a : 0x5aff9a]);
  }
  // ── 착륙 다리 넷: 위 버팀대 + 충격 흡수 대 + 발판 ──
  for (const [lx, lz] of [[3.0, 1.7], [3.0, -1.7], [-3.3, 1.9], [-3.3, -1.9]]) {
    const fx = lx * 1.22, fz = lz * 1.55;
    put(parts, tube([[lx * 0.85, 1.55, lz * 0.75], [(lx + fx) / 2 * 1.02, 1.0, (lz + fz) / 2 * 1.06], [fx, 0.3, fz]], 0.12, 6, 8), {}, 0x9a9eaa);
    put(parts, new THREE.CylinderGeometry(0.06, 0.06, 1.4, 6).rotateZ(Math.sign(lx) * 0.6).rotateX(-Math.sign(lz) * 0.5), { x: lx * 0.98, y: 1.0, z: lz * 1.05 }, 0xd8d8e0);
    put(parts, new THREE.CylinderGeometry(0.55, 0.68, 0.16, 14), { x: fx, y: 0.08, z: fz }, DARK);
  }
  // ── 배 밑 하강 분사구 넷 (내려앉을 때 아래로 불을 뿜는다) ──
  for (const [x, z] of THRUSTERS) {
    put(parts, new THREE.CylinderGeometry(0.2, 0.34, 0.5, 12, 1, true), { x, y: 1.05, z }, DARK);
    put(parts, new THREE.CircleGeometry(0.2, 12).rotateX(Math.PI / 2), { x, y: 0.82, z }, 0xffb07a, 0.8);
  }
  // ── 경사판: 해치에서 땅으로 ──
  if (landed) {
    const len = 3.2, ang = Math.atan2(FLOOR - 0.05, len);
    put(parts, new THREE.BoxGeometry(2.0, 0.12, Math.hypot(len, FLOOR)).rotateX(ang), { x: 0, y: FLOOR / 2, z: 2.2 + len / 2 }, 0xd0ccc4);
    for (const sx of [-1, 1]) put(parts, new THREE.BoxGeometry(0.05, 0.05, Math.hypot(len, FLOOR)).rotateX(ang), { x: sx * 0.95, y: FLOOR / 2 + 0.08, z: 2.2 + len / 2 }, 0xffd27a, 1.3);
  }
  // 착륙 그을음 (땅 위 어두운 고리)
  if (landed) put(parts, new THREE.RingGeometry(3.0, 7.5, 40).rotateX(-Math.PI / 2), { y: 0.06 }, 0x3a3640);
  return { parts, glass, navs };
}


export function buildLander(S, p, ry) {
  const [X, Z] = p.pos;
  const Y = S._ground(X, Z);
  const c = Math.cos(ry), s = Math.sin(ry);
  // 로컬 → 세계
  const W = (lx, lz) => [X + lx * c + lz * s, Z - lx * s + lz * c];
  const { parts, glass, navs } = landerShell({ landed: true });
  const inner = [];
  const put = (L, geo, o, col, e = 0) => L.push(part(xf(geo, o), col, e));

  // ── 선실 안 (안쪽을 보는 판들) ──
  const x0 = -2.6, x1 = 2.45, zw = 1.95;
  put(inner, new THREE.PlaneGeometry(x1 - x0, 2 * zw).rotateX(-Math.PI / 2), { x: (x0 + x1) / 2, y: FLOOR + 0.01, z: 0 }, 0x6a6e7c);
  for (let i = 0; i < 5; i++) put(inner, new THREE.BoxGeometry(0.04, 0.01, 2 * zw), { x: x0 + 0.5 + i * 1.0, y: FLOOR + 0.02, z: 0 }, TEAL, 0.6);
  put(inner, new THREE.PlaneGeometry(x1 - x0, 2 * zw).rotateX(Math.PI / 2), { x: (x0 + x1) / 2, y: CEIL, z: 0 }, 0xdcd8d0);
  put(inner, new THREE.BoxGeometry(x1 - x0 - 0.6, 0.03, 0.22), { x: (x0 + x1) / 2, y: CEIL - 0.03, z: 0 }, 0xfff4e0, 1.6); // 천장 등
  put(inner, new THREE.PlaneGeometry(2 * zw, CEIL - FLOOR).rotateY(Math.PI / 2), { x: x0, y: (FLOOR + CEIL) / 2, z: 0 }, 0xcfcac2); // 뒤 칸막이
  put(inner, new THREE.PlaneGeometry(1.0, 2.1).rotateY(Math.PI / 2), { x: x0 + 0.01, y: FLOOR + 1.05, z: -0.9 }, 0x8a8e9a); // 기관실 문
  put(inner, new THREE.PlaneGeometry(2 * zw, CEIL - FLOOR).rotateY(Math.PI / 2), { x: x1, y: (FLOOR + CEIL) / 2, z: 0, ry: Math.PI }, 0xcfcac2); // 앞 칸막이(조종석 쪽은 유리)
  put(inner, new THREE.PlaneGeometry(x1 - x0, CEIL - FLOOR), { x: (x0 + x1) / 2, y: (FLOOR + CEIL) / 2, z: -zw }, 0xd8d4cc);
  for (const [a, b] of [[x0, -1.05], [1.05, x1]]) put(inner, new THREE.PlaneGeometry(b - a, CEIL - FLOOR).rotateY(Math.PI), { x: (a + b) / 2, y: (FLOOR + CEIL) / 2, z: zw }, 0xd8d4cc);
  put(inner, new THREE.PlaneGeometry(2.1, CEIL - 3.25).rotateY(Math.PI), { x: 0, y: (3.25 + CEIL) / 2, z: zw }, 0xd8d4cc);
  // 앞 창 (조종석 너머 들판이 보인다)
  put(glass, new THREE.PlaneGeometry(2.6, 1.1).rotateY(-Math.PI / 2), { x: x1 - 0.02, y: 2.85, z: 0 }, 0x9fdcff, 0.15);
  // 조종석 둘 + 계기판
  for (const sz of [-0.65, 0.65]) {
    put(inner, new THREE.BoxGeometry(0.62, 0.12, 0.6), { x: 1.55, y: FLOOR + 0.5, z: sz }, 0x4a4e5c);
    put(inner, new THREE.BoxGeometry(0.12, 0.8, 0.6), { x: 1.22, y: FLOOR + 0.95, z: sz }, 0x4a4e5c);
    put(inner, new THREE.CylinderGeometry(0.1, 0.14, 0.45, 8), { x: 1.55, y: FLOOR + 0.22, z: sz }, 0x8a8e9a);
  }
  put(inner, new THREE.BoxGeometry(0.5, 0.75, 2.4), { x: 2.2, y: FLOOR + 0.55, z: 0, rz: 0.25 }, 0x3c3e4a);
  for (let i = 0; i < 6; i++) put(inner, new THREE.PlaneGeometry(0.3, 0.2).rotateY(-Math.PI / 2).rotateZ(0.25), { x: 1.94 + 0.06, y: FLOOR + 0.92, z: -1.0 + i * 0.4 }, [TEAL, 0xffd27a, 0xff9fd0][i % 3], 1.4);
  // 모아 교신 단말 (왼쪽 벽): 화면 + 빛 구슬
  const termL = [-0.2, -zw + 0.05];
  put(inner, new THREE.BoxGeometry(1.3, 0.85, 0.08), { x: termL[0], y: FLOOR + 1.45, z: termL[1] + 0.04 }, 0x2a2c38);
  put(inner, new THREE.PlaneGeometry(1.15, 0.7), { x: termL[0], y: FLOOR + 1.45, z: termL[1] + 0.09 }, 0x123848, 0.9);
  put(inner, new THREE.SphereGeometry(0.12, 12, 8), { x: termL[0], y: FLOOR + 1.5, z: termL[1] + 0.16 }, TEAL, 2.2);
  put(inner, new THREE.BoxGeometry(1.0, 0.06, 0.4), { x: termL[0], y: FLOOR + 0.95, z: termL[1] + 0.25 }, 0x4a4e5c);
  // 별지도 탁자 (가운데 뒤쪽): 둥근 탁자 + 별 홀로그램(움직임은 따로)
  const mapL = [-1.55, 0.35];
  put(inner, new THREE.CylinderGeometry(0.62, 0.5, 0.12, 20), { x: mapL[0], y: FLOOR + 0.85, z: mapL[1] }, 0x3c3e4a);
  put(inner, new THREE.CylinderGeometry(0.12, 0.2, 0.85, 8), { x: mapL[0], y: FLOOR + 0.42, z: mapL[1] }, 0x8a8e9a);
  put(inner, new THREE.RingGeometry(0.45, 0.55, 32).rotateX(-Math.PI / 2), { x: mapL[0], y: FLOOR + 0.92, z: mapL[1] }, TEAL, 1.2);
  // 표본함 (뒤 칸막이 옆): 여섯 칸 — 첫 칸만 세렌의 흙이 빛난다
  const boxL = [x0 + 0.35, -1.3];
  put(inner, new THREE.BoxGeometry(0.5, 0.9, 1.1), { x: boxL[0], y: FLOOR + 0.45, z: boxL[1] }, 0x5a5e6c);
  for (let i = 0; i < 6; i++) {
    const zz = boxL[1] - 0.35 + (i % 3) * 0.35, yy = FLOOR + 0.6 + Math.floor(i / 3) * 0.25;
    put(inner, new THREE.CylinderGeometry(0.08, 0.08, 0.16, 10).rotateZ(Math.PI / 2), { x: boxL[0] + 0.25, y: yy, z: zz }, i === 0 ? 0x9ff6c8 : 0x2a2c38, i === 0 ? 1.8 : 0.1);
  }
  // 탐사 일지 화면 (오른쪽 벽, 해치 옆)
  put(inner, new THREE.PlaneGeometry(0.9, 0.55).rotateY(Math.PI), { x: -1.8, y: FLOOR + 1.6, z: zw - 0.03 }, 0x1c3a48, 0.8);

  // ── 메시 (로컬 → 세계) ──
  const toWorld = (L) => L.map((g) => { g.rotateY(ry); g.translate(X, Y, Z); return g; });
  const grp = new THREE.Group(); // 착륙선 전체 (오프닝에서 내려앉는 동안 숨긴다)
  S.group.add(grp);
  S._mesh(toWorld(parts), S.mats.stone, grp);
  const innerMat = litMaterial({ vertexColors: true, vertexEmit: true, emissive: 0xffffff, emissiveIntensity: 1.3, emissiveNight: 0.9, rim: 0.1, spec: 0.6, side: THREE.DoubleSide });
  S._mesh(toWorld(inner), innerMat, grp);
  S._mesh(toWorld(glass), S.mats.crystal, grp);

  // ── 충돌체: 바닥·벽·지붕·앞뒤 덩어리 (해치 자리만 비운다) + 경사판 ──
  const box = (lx, lz, hx, hz, y0, y1, o = {}) => { const [x, z] = W(lx, lz); S._col({ type: 'box', x, z, hx, hz, rot: ry, y0: Y + y0, y1: Y + y1, ...o }); };
  box((x0 + x1) / 2, 0, (x1 - x0) / 2, zw, -1, FLOOR);                 // 선실 바닥
  box(x0 - 0.15, 0, 0.15, zw + 0.3, FLOOR, 4.3, { walk: false });     // 뒤 칸막이
  box(x1 + 0.15, 0, 0.15, zw + 0.3, FLOOR, 4.3, { walk: false });     // 앞 칸막이
  box((x0 + x1) / 2, -zw - 0.15, (x1 - x0) / 2, 0.15, FLOOR, 4.3, { walk: false });
  box((x0 - 1.05) / 2, zw + 0.15, (-1.05 - x0) / 2, 0.15, FLOOR, 4.3, { walk: false });
  box((1.05 + x1) / 2, zw + 0.15, (x1 - 1.05) / 2, 0.15, FLOOR, 4.3, { walk: false });
  box(0, zw + 0.15, 1.05, 0.15, 3.25, 4.3);                            // 해치 위 인방
  box((x0 + x1) / 2, 0, (x1 - x0) / 2 + 0.3, zw + 0.3, CEIL, 4.35);    // 지붕 (밟을 수 있다)
  box(-4.1, 0, 1.5, 1.9, 0, 3.9);                                      // 뒤 (기관부·엔진)
  box(4.05, 0, 1.6, 1.65, 0, 3.5);                                     // 앞 (조종석 코)
  { // 경사판: 해치(바닥 높이) → 땅
    const [x, z] = W(0, 2.2 + 1.6);
    S._col({ type: 'ramp', x, z, hx: 1.6, hz: 1.0, rot: ry - Math.PI / 2, y0: Y - 1, y1: Y + FLOOR, y1b: Y + 0.06 });
  }
  // 선실 가구 (단단하다)
  { const [x, z] = W(mapL[0], mapL[1]); S._col({ type: 'cyl', x, z, r: 0.6, y0: Y + FLOOR, y1: Y + FLOOR + 0.92 }); }
  for (const sz of [-0.65, 0.65]) { const [x, z] = W(1.55, sz); S._col({ type: 'cyl', x, z, r: 0.32, y0: Y + FLOOR, y1: Y + FLOOR + 0.56 }); }
  box(2.2, 0, 0.3, 1.2, FLOOR, FLOOR + 0.95);
  box(boxL[0], boxL[1], 0.25, 0.55, FLOOR, FLOOR + 0.9);

  // ── 움직이는 것: 접시 안테나(배를 겨눈다)·꼭대기 빛·항법등·별지도 홀로그램 ──
  const ant = new THREE.Group();
  { const [x, z] = W(-1.6, -0.6); ant.position.set(x, Y + 4.25, z); }
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 1.1, 8).translate(0, 0.55, 0), S.mats.stone);
  ant.add(mast);
  const head = new THREE.Group(); head.position.y = 1.15; ant.add(head);
  const dishG = new THREE.LatheGeometry([new THREE.Vector2(0.0001, 0), new THREE.Vector2(0.35, 0.04), new THREE.Vector2(0.7, 0.16), new THREE.Vector2(0.95, 0.32)], 20);
  dishG.rotateX(Math.PI / 2); // 접시가 +z 를 본다
  const dish = new THREE.Mesh(dishG, litMaterial({ color: 0xe8e4dc, rim: 0.4, spec: 0.8, side: THREE.DoubleSide }));
  head.add(dish);
  const feed = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6).translate(0, 0, 0.62), glowMaterial({ color: 0x9ff6ff, intensity: 2 }));
  head.add(feed);
  head.add(new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.62, 4).rotateX(Math.PI / 2).translate(0, 0, 0.31), S.mats.stone));
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), glowMaterial({ color: 0xffd27a, intensity: 2.5 }));
  beacon.position.y = 1.2;
  ant.add(beacon);
  grp.add(ant);
  const navM = navs.map(([[lx, lz], y, col]) => { const [x, z] = W(lx, lz); const m = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), glowMaterial({ color: col, intensity: 3 })); m.position.set(x, Y + y, z); grp.add(m); return m; });
  // 별지도: 가운데 노란 별 둘레를 도는 행성들, 그중 셋에 「?」 표식 (아직 가 보지 않은 별)
  const holo = new THREE.Group();
  { const [x, z] = W(mapL[0], mapL[1]); holo.position.set(x, Y + FLOOR + 1.25, z); }
  holo.add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), glowMaterial({ color: 0xffe0a0, intensity: 2.5 })));
  const orbs = [];
  for (const [r, sz, col, mark] of [[0.16, 0.03, 0x9fdcff, 0], [0.26, 0.05, 0xffb070, 1], [0.36, 0.035, 0xb9a6ff, 2], [0.46, 0.04, 0x9ff6c8, 3], [0.55, 0.03, 0xff9fd0, 2]]) {
    const ringM = new THREE.Mesh(new THREE.RingGeometry(r - 0.004, r + 0.004, 48).rotateX(-Math.PI / 2), glowMaterial({ color: 0x7ff3e6, intensity: 0.5 }));
    holo.add(ringM);
    const pl = new THREE.Mesh(new THREE.SphereGeometry(sz, 10, 8), glowMaterial({ color: col, intensity: 1.8 }));
    holo.add(pl);
    let tag = null;
    if (mark) { tag = new THREE.Mesh(new THREE.TorusGeometry(sz * 2.2, 0.006, 3, 18), glowMaterial({ color: mark === 1 ? 0x7ff3e6 : 0xffd27a, intensity: 2 })); holo.add(tag); }
    orbs.push({ r, pl, tag, sp: 0.6 / Math.sqrt(r), a: r * 17 });
  }
  grp.add(holo);
  S.anims.push((t, dt) => {
    for (const o of orbs) { const a = o.a + t * o.sp; o.pl.position.set(Math.cos(a) * o.r, 0, Math.sin(a) * o.r); if (o.tag) { o.tag.position.copy(o.pl.position); o.tag.rotation.y = t; } }
    holo.rotation.y = t * 0.05;
    navM.forEach((m, i) => (m.visible = Math.sin(t * 2.2 + i * 1.7) > 0.2));
  });
  return {
    X, Y, Z, W, ry, ant, head, beacon, feed, group: grp,
    stations: [
      { at: W(termL[0], termL[1] + 0.8), y: Y + FLOOR, r: 1.3, kind: 'term', label: '모아 교신 단말 · 라르크 호와 이야기하기', short: '교신' },
      { at: W(mapL[0], mapL[1]), y: Y + FLOOR, r: 1.5, kind: 'map', label: '별지도 · 라르크 호의 항로', short: '별지도' },
      { at: W(boxL[0] + 0.6, boxL[1]), y: Y + FLOOR, r: 1.2, kind: 'samples', label: '표본함 · 다른 별의 칸', short: '표본함' },
      { at: W(-1.8, zw - 0.6), y: Y + FLOOR, r: 1.1, kind: 'log', label: '탐사 일지 화면', short: '일지' },
    ],
  };
}
