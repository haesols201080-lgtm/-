// 탐사선 「라르크」 호 (오프닝의 우주 장면 전용 모델, 미터 단위, 로컬 +x = 앞).
// 앞의 지휘 모듈(창 띠) → 긴 등뼈 트러스 → 도는 거주 고리 → 연료 탱크 넷 → 방열판 → 주 엔진.
// 모아는 이 배의 지능이다: 지휘 모듈 위의 큰 접시 안테나로 착륙선과 이어진다.
// 등뼈 밑에는 착륙선 「라르크 2」가 집게에 물려 있다(landerShell 을 따로 붙인다).
import * as THREE from 'three';
import { part, merge, xf } from './geo-utils.js';

const HULL = 0xe8e4dc, HULL2 = 0xcfcac2, DARK = 0x3c3e4a, ORANGE = 0xff8a4c, GOLD = 0xd9a54a, STEEL = 0x9a9eaa, TEAL = 0x7ff3e6, WARM = 0xffe2b0;

/** x 축 회전체: 윤곽 [[r, x], ...] (x 가 커지는 순서) */
function hullX(prof, segs = 32) {
  const g = new THREE.LatheGeometry(prof.map(([r, x]) => new THREE.Vector2(Math.max(0.001, r), x)), segs);
  g.rotateZ(-Math.PI / 2); // 축 y → +x
  return g;
}

/** 라르크 호: mat = 배 표면 재질, glow(색, 세기) = 빛 재질 만들기 */
export function buildLark(mat, glow) {
  const root = new THREE.Group();
  const parts = [];
  const put = (geo, o, col, e = 0) => parts.push(part(xf(geo, o), col, e));

  // ── 지휘 모듈 (x 2 → 17.5): 창 띠·주황 띠·외피 판 ──
  const cmCol = (x) => (x > 13.2 && x < 14.0 ? WARM : x > 6.0 && x < 6.6 ? ORANGE : Math.floor(x / 1.8) % 2 ? HULL : HULL2);
  const cmEmit = (x) => (x > 13.2 && x < 14.0 ? 1.4 : 0);
  put(hullX([[2.2, 2.0], [4.4, 2.6], [5.2, 5], [5.2, 10], [4.6, 13.2], [3.4, 15.6], [1.6, 17.1], [0.001, 17.5]]), {}, cmCol, cmEmit);
  // 지휘 모듈 옆 띠 표지 + 작은 창들
  for (const s of [-1, 1]) put(new THREE.BoxGeometry(3.6, 0.7, 0.05), { x: 8.2, y: 0.9, z: s * 5.22 }, ORANGE, 0.2);
  for (let i = 0; i < 5; i++) for (const s of [-1, 1]) put(new THREE.BoxGeometry(0.5, 0.36, 0.05), { x: 4.0 + i * 0.9, y: 2.2, z: s * 5.0 }, WARM, 1.5);

  // ── 등뼈 트러스 (x −46 → 2) ──
  put(new THREE.BoxGeometry(48, 1.6, 1.6), { x: -22 }, 0x8a8e9a);
  for (const [y, z] of [[1.6, 1.6], [1.6, -1.6], [-1.6, 1.6], [-1.6, -1.6]]) put(new THREE.CylinderGeometry(0.18, 0.18, 48, 6).rotateZ(Math.PI / 2), { x: -22, y, z }, 0xb8bcc6);
  for (let x = -44; x <= 0; x += 4) put(new THREE.TorusGeometry(2.26, 0.12, 4, 4).rotateZ(Math.PI / 4).rotateY(Math.PI / 2), { x }, STEEL);

  // ── 연료 탱크 넷 (x −28) ──
  for (const [y, z, c] of [[3.6, 0, GOLD], [-3.6, 0, GOLD], [0, 3.6, HULL], [0, -3.6, HULL]]) {
    put(new THREE.CapsuleGeometry(2.0, 8, 6, 18).rotateZ(Math.PI / 2), { x: -28, y, z }, c);
    put(new THREE.CylinderGeometry(2.05, 2.05, 0.4, 18).rotateZ(Math.PI / 2), { x: -28, y, z }, ORANGE, 0.15);
  }

  // ── 방열판 (x −37, 양옆으로 펼침): 뜨거운 줄이 은은히 ──
  for (const s of [-1, 1]) {
    put(new THREE.CylinderGeometry(0.25, 0.25, 4.5, 6).rotateX(Math.PI / 2), { x: -37, z: s * 3.6 }, STEEL);
    put(new THREE.BoxGeometry(9, 0.16, 8.5), { x: -37, z: s * 10.0 }, 0x585c6a);
    for (let i = 0; i < 6; i++) put(new THREE.BoxGeometry(8.6, 0.2, 0.12), { x: -37, z: s * (6.3 + i * 1.45) }, 0xff7a50, 0.35);
  }

  // ── 주 엔진 (x −46 → −55) ──
  put(new THREE.CylinderGeometry(3.2, 3.6, 3, 24).rotateZ(Math.PI / 2), { x: -47.5 }, DARK);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; put(new THREE.CylinderGeometry(0.14, 0.14, 4.2, 5).rotateZ(Math.PI / 2), { x: -50.8, y: Math.sin(a) * 1.9, z: Math.cos(a) * 1.9 }, STEEL); }
  {
    const g = new THREE.LatheGeometry([[1.2, 0], [1.6, 0.8], [2.4, 2.4], [3.2, 4.4], [3.7, 6.0]].map(([r, y]) => new THREE.Vector2(r, y)), 28, 0, Math.PI * 2);
    g.rotateZ(Math.PI / 2); // 축 y → −x (종이 뒤로 벌어진다)
    put(g, { x: -49.0 }, 0x4a4c58);
  }
  put(new THREE.CircleGeometry(1.15, 20).rotateY(-Math.PI / 2), { x: -49.1 }, 0xffb07a, 1.2);

  // ── 착륙선 집게 둘 (등뼈 밑 → 착륙선 등) ──
  for (const x of [-6.5, -1.5]) {
    put(new THREE.BoxGeometry(0.5, 1.4, 0.5), { x, y: -1.4 }, STEEL);
    put(new THREE.BoxGeometry(1.4, 0.25, 1.4), { x, y: -2.1 }, ORANGE, 0.3);
  }

  const body = new THREE.Mesh(merge(parts), mat);
  root.add(body);

  // ── 도는 거주 고리 (x −14) ──
  const ring = new THREE.Group();
  ring.position.x = -14;
  {
    const rp = [];
    const tor = new THREE.TorusGeometry(13, 1.9, 10, 96).rotateY(Math.PI / 2);
    const winE = (x, y, z) => { const a = Math.atan2(z, y), rho = Math.hypot(y, z); return rho > 13.8 && Math.abs(x) < 0.7 && ((a / (Math.PI * 2)) * 48 % 1 + 1) % 1 < 0.35 ? 0.9 : 0; };
    rp.push(part(tor, (x, y, z) => (winE(x, y, z) ? WARM : HULL), winE));
    rp.push(part(new THREE.CylinderGeometry(2.6, 2.6, 5, 20).rotateZ(Math.PI / 2), HULL2));
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      rp.push(part(xf(new THREE.CylinderGeometry(0.45, 0.45, 10.5, 8), { y: Math.cos(a) * 7.6, z: Math.sin(a) * 7.6, rx: a }), STEEL));
    }
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + 0.2; rp.push(part(xf(new THREE.BoxGeometry(0.9, 0.6, 2.6), { y: Math.cos(a) * 14.6, z: Math.sin(a) * 14.6, rx: a }), ORANGE, 0.2)); }
    ring.add(new THREE.Mesh(merge(rp), mat));
  }
  root.add(ring);

  // ── 모아의 접시 안테나 (지휘 모듈 위) ──
  const dishBase = new THREE.Group();
  dishBase.position.set(7.5, 5.1, 0);
  {
    const mp = [part(new THREE.CylinderGeometry(0.35, 0.5, 2.8, 8).translate(0, 1.4, 0), STEEL)];
    dishBase.add(new THREE.Mesh(merge(mp), mat));
  }
  const dish = new THREE.Group();
  dish.position.y = 3.0;
  {
    const dg = new THREE.LatheGeometry([[0.001, 0], [1.2, 0.12], [2.4, 0.5], [3.3, 1.05]].map(([r, y]) => new THREE.Vector2(r, y)), 28);
    dg.rotateX(Math.PI / 2); // 접시가 +z 를 본다
    const dp = [part(dg, HULL), part(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 5).rotateX(Math.PI / 2).translate(0, 0, 1.1), STEEL)];
    dish.add(new THREE.Mesh(merge(dp), mat));
    const feed = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), glow(TEAL, 3));
    feed.position.z = 2.2;
    dish.add(feed);
    dish.userData.feed = feed;
  }
  dishBase.add(dish);
  root.add(dishBase);

  // ── 항법등 (왼쪽 빨강·오른쪽 초록·코와 꼬리의 흰 섬광) ──
  const navs = [];
  for (const [x, y, z, c] of [[-37, 0, -14.3, 0xff5a4a], [-37, 0, 14.3, 0x5aff9a], [17.6, 0, 0, 0xffffff], [-44, 2.6, 0, 0xffffff]]) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), glow(c, 4));
    m.position.set(x, y, z);
    root.add(m);
    navs.push(m);
  }

  // ── 엔진 불꽃 붙일 자리 (불꽃은 approach.js 가 붙인다) ──
  const plume = new THREE.Group();
  plume.position.x = -54.5;
  plume.visible = false;
  root.add(plume);

  return { root, ring, dishBase, dish, plume, navs, dock: new THREE.Vector3(-4, -6.5, 0) };
}
