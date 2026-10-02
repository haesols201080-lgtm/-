// 건물 안: 도시의 건물 문으로 들어가면 그 건물 로비가 그 자리에서 만들어진다.
//  · 문이 뚫린 외벽(cityfabric.openShell) + 바닥·벽·천장·빛 승강기·안내대·화분·의자·홀로그램·조형물
//  · 건물마다 이름과 쓰임(주거탑·연구동·시장·학교·치유원·하늘 정원·작은 공연장) — 쓰임에 따라 가구와 사람이 다르다
//  · 가운데 빛 승강기를 타면 지붕 위에 떠 있는 「하늘 전망대」로. 거기서 뛰어내려 활공할 수 있다
//  · 충분히 멀어지면 실내를 치우고 원래의 단단한 건물로 되돌린다 (한 번에 한 건물)
import * as THREE from 'three';
import { heightAt } from '../world/heightfield.js';
import { mulberry32 } from '../core/noise.js';
import { litMaterial, glowMaterial } from '../world/materials.js';
import { hologramMaterial } from '../world/hologram.js';
import { CURVE_GLSL, ATMOS_PARS, NOISE_GLSL } from '../world/shaders.js';
import { atmosUniforms } from '../world/atmosphere.js';
import { SPEC } from '../world/city-arch.js';
import { audio } from '../core/audio.js';

const TAU = Math.PI * 2;
const PREFIX = ['새벽', '물결', '은하', '고요', '바람', '윤슬', '별빛', '노을', '이슬', '하늘', '메아리', '푸른', '은빛', '첫눈', '꽃잎', '먼별'];
const PURPOSE = {
  home: { name: '주거탑', desc: '아웬 가족들이 사는 탑. 층마다 작은 정원이 있다.', npc: 4 },
  lab: { name: '울림 연구동', desc: '물질의 노래를 듣고 설득하는 법을 연구한다.', npc: 3 },
  market: { name: '노래 시장', desc: '물건 대신 노래를 주고받는다. 좋은 노래는 오래 머문다.', npc: 7 },
  school: { name: '노래 학교', desc: '아이들이 처음으로 자기 이름을 노래하는 곳.', npc: 6, small: true },
  heal: { name: '치유원', desc: '지친 울림을 고르게 다듬어 주는 곳. 부드러운 빛 속에서 쉰다.', npc: 3 },
  garden: { name: '하늘 정원', desc: '건물 한가운데를 숲으로 채운 정원.', npc: 4 },
  hall: { name: '작은 공연장', desc: '동네 합창단이 저녁마다 노래한다.', npc: 6 },
  office: { name: '울림 사무탑', desc: '도시의 일을 노래로 나누어 맡는 곳. 층마다 작은 모임이 열린다.', npc: 5 },
  library: { name: '마을 서고', desc: '결정에 담긴 옛 노래를 빌려 가는 곳.', npc: 3 },
  factory: { name: '빚음 공방', desc: '물질을 노래로 설득해 쓸 것을 빚는다. 공정마다 다른 음이 울린다.', npc: 5 },
  depot: { name: '물류 창고', desc: '도시 곳곳으로 갈 짐을 모으고 나누는 곳.', npc: 5 },
  terminal: { name: '교통 터미널', desc: '호버 차와 하늘배를 갈아타는 곳.', npc: 7 },
};
const BY_STYLE = {
  civic: ['hall', 'lab', 'garden', 'school'],
  commerce: ['market', 'market', 'home', 'hall'],
  transit: ['market', 'lab', 'hall'],
  residential: ['home', 'home', 'school', 'garden', 'heal'],
  research: ['lab', 'lab', 'school', 'heal'],
  energy: ['lab', 'lab', 'hall'],
  bioindustry: ['garden', 'lab', 'market', 'heal'],
  capital: ['lab', 'home', 'market', 'heal', 'hall', 'garden', 'home', 'lab'],
  highrise: ['home', 'lab', 'home', 'market', 'heal', 'hall'],
  garden: ['garden', 'school', 'home', 'garden'],
  suburb: ['home', 'home', 'school', 'market', 'garden'],
  village: ['home', 'home', 'school', 'market'],
  glass: ['lab', 'home', 'market', 'hall'],
  bloom: ['garden', 'home', 'heal', 'school'],
  canyon: ['home', 'market', 'lab', 'school'],
  sea: ['home', 'market', 'heal'],
  frost: ['home', 'lab', 'heal'],
};
const PEARL = 0xf1ece4, FLOOR = 0xaaa6ba, ACC = 0x7ff3e6, GOLD = 0xe9c27c, LEAF = 0x5fbf8a;

// 창 너머 바깥(하늘과 먼 도시)이 보이는 유리 — 낮에는 밝은 하늘, 밤에는 도시 불빛
const winVert = `${CURVE_GLSL}
varying vec2 vUv; varying vec3 vWorld;
void main() { vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vWorld = wp.xyz; gl_Position = projectionMatrix * viewMatrix * vec4(curveWorld(wp.xyz), 1.0); }`;
const winFrag = `${NOISE_GLSL}${ATMOS_PARS}
varying vec2 vUv; varying vec3 vWorld;
void main() {
  float mx = fract(vUv.x);
  float frame = step(0.05, mx) * step(mx, 0.95) * step(0.03, vUv.y) * step(vUv.y, 0.97);
  vec3 sky = mix(uSkyHorizon, uSkyTop, clamp(vUv.y * 0.9, 0.0, 1.0)) * 1.1 + uHorizonGlow * 0.25;
  float sk = 0.18 + 0.22 * hash12(vec2(floor(vUv.x * 2.5), 7.0));
  float skyline = step(vUv.y, sk);
  vec3 city = mix(uSkyHorizon * 0.62, vec3(0.04, 0.05, 0.09), uNight);
  vec3 c = mix(sky, city, skyline * 0.9);
  c += vec3(1.0, 0.8, 0.55) * step(0.9, hash12(floor(vec2(vUv.x * 30.0, vUv.y * 40.0)))) * skyline * uNight * 1.4;
  vec3 fc = vec3(0.86, 0.84, 0.9) * (0.35 + 0.65 * (1.0 - uNight));
  c = mix(fc, c, frame);
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class Interiors {
  constructor(game) {
    this.game = game;
    this.city = game.city;
    this.cur = null;
    this.mat = litMaterial({ vertexColors: true, vertexEmit: true, emissive: 0xffffff, emissiveIntensity: 1.3, emissiveNight: 0.45, rim: 0.15, spec: 0.8, side: THREE.DoubleSide, tech: { scale: 1.1, glow: 0.9, metal: 0.35, mode: 0 } });
    // 바닥·전망대: 가운데에서 퍼지는 동심원 문양이 새겨진 윤나는 바닥 (중심은 열 때마다 바꾼다)
    this.floorMat = litMaterial({ vertexColors: true, vertexEmit: true, emissive: 0xffffff, emissiveIntensity: 1.3, emissiveNight: 0.4, rim: 0.1, spec: 1.6, side: THREE.DoubleSide, tech: { scale: 1.7, glow: 1.1, metal: 0.6, mode: 1, color: 0x9ff6ff } });
    this.deckMat = litMaterial({ vertexColors: true, vertexEmit: true, emissive: 0xffffff, emissiveIntensity: 1.3, emissiveNight: 0.4, rim: 0.2, spec: 1.6, side: THREE.DoubleSide, tech: { scale: 1.4, glow: 1.2, metal: 0.42, mode: 1, color: 0xffd9a0 } });
    this.winMat = new THREE.ShaderMaterial({ uniforms: { ...atmosUniforms }, vertexShader: winVert, fragmentShader: winFrag, side: THREE.DoubleSide });
    this.t = 0;
    this._auto = 0;
  }

  // ── 건물 정보 ─────────────────────────────
  info(r) {
    if (r.info) return r.info;
    const rnd = mulberry32(Math.floor(r.seed * 1e9));
    const byUse = { home: ['home'], office: ['office', 'office', 'lab'], market: ['market'], school: ['school'], heal: ['heal'], library: ['library'], hall: ['hall'], factory: ['factory'], depot: ['depot'], lab: ['lab'], terminal: ['terminal'], garden: ['garden'] };
    const list = byUse[r.use] || BY_STYLE[r.style] || BY_STYLE.capital;
    const pid = list[Math.floor(rnd() * list.length)];
    const P = PURPOSE[pid];
    const floors = Math.max(2, Math.floor((r.top - r.gy) / 3.6));
    r.info = { pid, P, name: `${PREFIX[Math.floor(rnd() * PREFIX.length)]} ${P.name}`, floors, people: floors * (pid === 'home' ? 30 + Math.floor(rnd() * 40) : 8 + Math.floor(rnd() * 20)) };
    return r.info;
  }

  // ── 평면 (실내 벽이 서는 선) ─────────────────
  _plan(r) {
    const pts = [];
    let rot, sx, sz, k, A, B, n;
    if (r.kind === 'podium' || r.kind === 'midrise' || r.kind === 'warehouse') { rot = r.rot; sx = r.sx * 0.96; sz = r.sz * 0.96; k = 12; A = 1; B = 1; n = 28; }
    else {
      [k, A, B] = SPEC[r.kind].plan;
      const inset = r.kind === 'dome' ? 0.8 : r.kind === 'cap' ? 0.86 : 0.9;
      rot = r.rot; sx = r.sx * A * inset; sz = r.sz * B * inset; n = 22;
    }
    const c = Math.cos(rot), s = Math.sin(rot);
    for (let i = 0; i < n; i++) {
      const t = (i / n) * TAU + Math.PI / n;
      const ct = Math.cos(t), st = Math.sin(t);
      const lx = Math.sign(ct) * Math.pow(Math.abs(ct), 2 / k) * sx, lz = Math.sign(st) * Math.pow(Math.abs(st), 2 / k) * sz;
      pts.push([r.x + c * lx + s * lz, r.z - s * lx + c * lz]);
    }
    return pts;
  }

  _inside(x, z, pad = 0) {
    const pts = this.cur.plan;
    // 가운데 쪽으로 pad 만큼 줄인 다각형 안인가 (볼록하지 않아도 되는 짝수 규칙)
    const cx = this.cur.r.x, cz = this.cur.r.z;
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const sc = (p) => { const d = Math.hypot(p[0] - cx, p[1] - cz) || 1; const k = Math.max(0, d - pad) / d; return [cx + (p[0] - cx) * k, cz + (p[1] - cz) * k]; };
      const [xi, zi] = sc(pts[i]), [xj, zj] = sc(pts[j]);
      if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
    }
    return inside;
  }

  // ── 열기 ─────────────────────────────────
  open(r) {
    if (this.cur && this.cur.r === r) return;
    if (this.cur) this.close();
    const g = this.game, C = g.world.colliders;
    const info = this.info(r);
    const plan = this._plan(r);
    const low = SPEC[r.kind].low || r.kind === 'podium';
    const LH = Math.max(4.4, Math.min(low ? 8 : 7.5, (r.top - r.floorY) * (r.kind === 'dome' || r.kind === 'biodome' ? 0.42 : low ? 0.5 : 0.3)));
    const cur = { r, info, plan, LH, cols: [], meshes: [], npcs: [], anims: [], deck: null };
    this.cur = cur;
    const fy = r.floorY;
    const dn = [r.door.nx, r.door.nz];
    const doorIn = [r.door.x - dn[0] * 0.6, r.door.z - dn[1] * 0.6];
    // 충돌: 단단한 건물 대신 바닥·벽(문 자리 비움)·로비 위의 몸통
    for (const c of r.cols) C.remove(c);
    const add = (c) => cur.cols.push(C.add({ ...c, city: true }));
    const cx = r.x, cz = r.z;
    let maxR = 0;
    for (const [x, z] of plan) maxR = Math.max(maxR, Math.hypot(x - cx, z - cz));
    add({ type: 'cyl', x: cx, z: cz, r: maxR + 0.5, y0: fy - 8, y1: fy });
    const walls = [];
    for (let i = 0; i < plan.length; i++) {
      const [x0, z0] = plan[i], [x1, z1] = plan[(i + 1) % plan.length];
      const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
      const isDoor = Math.hypot(mx - doorIn[0], mz - doorIn[1]) < 2.6 || Math.hypot(x0 - doorIn[0], z0 - doorIn[1]) < 1.6 || Math.hypot(x1 - doorIn[0], z1 - doorIn[1]) < 1.6;
      walls.push({ x0, z0, x1, z1, isDoor });
      if (isDoor) continue;
      const L = Math.hypot(x1 - x0, z1 - z0);
      add({ type: 'box', x: mx, z: mz, hx: L / 2 + 0.25, hz: 0.35, rot: -Math.atan2(z1 - z0, x1 - x0), y0: fy - 2, y1: fy + LH, walk: false });
    }
    // 로비 위의 몸통: 겹 충돌체를 로비 천장 위로 잘라서
    for (const c of r.cols) if (c.y1 > fy + LH + 0.2) { const k2 = { ...c, y0: Math.max(c.y0, fy + LH) }; delete k2._mark; add(k2); }
    add({ type: 'cyl', x: cx, z: cz, r: 1.8, y0: fy, y1: fy + LH - 0.2, walk: false }); // 빛 승강기
    // 문 앞이 땅보다 높으면 경사로
    const ground = heightAt(r.door.x + dn[0] * 2, r.door.z + dn[1] * 2);
    if (fy - ground > 0.45) {
      const L = Math.max(3, (fy - ground) * 3);
      add({ type: 'ramp', x: r.door.x + dn[0] * (L / 2), z: r.door.z + dn[1] * (L / 2), hx: L / 2, hz: 2, rot: -Math.atan2(dn[1], dn[0]), y0: ground - 2, y1: fy, y1b: ground });
    }
    this.city.openShell(r);
    this._build(cur, walls);
    this._people(cur);
    audio.chime('soft');
  }

  /** 실내 모양 */
  _build(cur, walls) {
    const { r, info, plan, LH } = cur;
    const fy = r.floorY, cx = r.x, cz = r.z;
    const P = [], C = [], E = [], WP = [], WU = [], FP = [], FC = [], FE = [];
    const col = new THREE.Color();
    const tri = (a, b, c, color, emit) => { P.push(...a, ...b, ...c); col.set(color); for (let k = 0; k < 3; k++) { C.push(col.r, col.g, col.b); E.push(emit); } };
    const triF = (a, b, c, color, emit) => { FP.push(...a, ...b, ...c); col.set(color); for (let k = 0; k < 3; k++) { FC.push(col.r, col.g, col.b); FE.push(emit); } };
    const quad = (a, b, c, d, color, emit) => { tri(a, b, c, color, emit); tri(a, c, d, color, emit); };
    const scaleP = ([x, z], k) => [cx + (x - cx) * k, cz + (z - cz) * k];
    const n = plan.length;
    // 바닥과 무늬 (가운데로 모이는 빛 고리)
    for (let i = 0; i < n; i++) {
      const [x0, z0] = plan[i], [x1, z1] = plan[(i + 1) % n];
      triF([cx, fy, cz], [x1, fy, z1], [x0, fy, z0], FLOOR, 0);
      tri([cx, fy + LH, cz], [x0, fy + LH, z0], [x1, fy + LH, z1], PEARL, 0.05);
      for (const [ka, kb, cc, ee] of [[0.42, 0.45, ACC, 1.2], [0.72, 0.74, GOLD, 0.9]]) {
        const a0 = scaleP(plan[i], ka), a1 = scaleP(plan[(i + 1) % n], ka), b0 = scaleP(plan[i], kb), b1 = scaleP(plan[(i + 1) % n], kb);
        triF([a0[0], fy + 0.02, a0[1]], [a1[0], fy + 0.02, a1[1]], [b1[0], fy + 0.02, b1[1]], cc, ee);
        triF([a0[0], fy + 0.02, a0[1]], [b1[0], fy + 0.02, b1[1]], [b0[0], fy + 0.02, b0[1]], cc, ee);
      }
      // 천장 빛판 둘
      for (const [ka, kb] of [[0.5, 0.6], [0.8, 0.86]]) {
        const a0 = scaleP(plan[i], ka), a1 = scaleP(plan[(i + 1) % n], ka), b0 = scaleP(plan[i], kb), b1 = scaleP(plan[(i + 1) % n], kb);
        quad([a0[0], fy + LH - 0.03, a0[1]], [a1[0], fy + LH - 0.03, a1[1]], [b1[0], fy + LH - 0.03, b1[1]], [b0[0], fy + LH - 0.03, b0[1]], 0xfff4e0, 1.6);
      }
    }
    // 벽: 아래 굽도리 + 큰 창(바깥이 보이는 유리) + 위 띠. 문 자리는 비운다
    let u = 0;
    for (const w of walls) {
      const L = Math.hypot(w.x1 - w.x0, w.z1 - w.z0);
      if (w.isDoor) { u += L / 2.4; continue; }
      const y0 = fy, y1 = fy + 0.55, y2 = fy + LH - 0.7, y3 = fy + LH;
      quad([w.x0, y0, w.z0], [w.x1, y0, w.z1], [w.x1, y1, w.z1], [w.x0, y1, w.z0], 0xd8d2e0, 0);
      quad([w.x0, y2, w.z0], [w.x1, y2, w.z1], [w.x1, y3, w.z1], [w.x0, y3, w.z0], PEARL, 0);
      quad([w.x0, y2 - 0.06, w.z0], [w.x1, y2 - 0.06, w.z1], [w.x1, y2, w.z1], [w.x0, y2, w.z0], ACC, 1.4);
      const u1 = u + L / 2.4;
      WP.push(w.x0, y1, w.z0, w.x1, y1, w.z1, w.x1, y2, w.z1, w.x0, y1, w.z0, w.x1, y2, w.z1, w.x0, y2, w.z0);
      WU.push(u, 0, u1, 0, u1, 1, u, 0, u1, 1, u, 1);
      u = u1;
    }
    // 문틀 안쪽
    const dn = [r.door.nx, r.door.nz], dt = [-dn[1], dn[0]];
    const dx = r.door.x - dn[0] * 0.5, dz = r.door.z - dn[1] * 0.5;
    for (const sgn of [-1, 1]) {
      const px = dx + dt[0] * 1.75 * sgn, pz = dz + dt[1] * 1.75 * sgn;
      this._box(P, C, E, px, fy, pz, 0.35, 4.0, 0.9, Math.atan2(dt[0], dt[1]), PEARL, 0);
    }
    // 가구
    const g = new THREE.Group();
    const geoms = [];
    const put = (geo, color, emit, x, y, z, ry = 0) => { geo.rotateY(ry); geo.translate(x, y, z); geoms.push(this._paint(geo, color, emit)); };
    const rin = Math.min(...plan.map(([x, z]) => Math.hypot(x - cx, z - cz)));
    const toward = (k, ang = 0) => { const a = Math.atan2(dn[1], dn[0]) + ang; return [cx + Math.cos(a) * rin * k, cz + Math.sin(a) * rin * k]; };
    const faceDoor = Math.atan2(dn[0], dn[1]);
    // 승강기 받침·고리, 안내대
    put(new THREE.CylinderGeometry(2.2, 2.4, 0.18, 24), PEARL, 0, cx, fy + 0.09, cz);
    put(new THREE.TorusGeometry(2.0, 0.05, 4, 32).rotateX(Math.PI / 2), ACC, 1.0, cx, fy + 0.2, cz);
    put(new THREE.TorusGeometry(2.0, 0.05, 4, 32).rotateX(Math.PI / 2), ACC, 1.0, cx, fy + LH - 0.25, cz);
    const [ddx, ddz] = toward(0.52);
    if (rin > 6) {
      put(new THREE.CylinderGeometry(2.6, 2.6, 1.05, 16, 1, false, -0.7, 1.4), PEARL, 0, ddx, fy + 0.52, ddz, faceDoor + Math.PI);
      put(new THREE.CylinderGeometry(2.63, 2.63, 0.06, 16, 1, true, -0.7, 1.4), ACC, 1.6, ddx, fy + 1.06, ddz, faceDoor + Math.PI);
    }
    // 화분 나무
    const tree = (x, z, s = 1) => {
      cur.cols.push(this.game.world.colliders.add({ type: 'cyl', x, z, r: 0.7 * s, y0: fy - 1, y1: fy + 0.8 * s, city: true }));
      put(new THREE.CylinderGeometry(0.7 * s, 0.55 * s, 0.8 * s, 10), GOLD, 0, x, fy + 0.4 * s, z);
      put(new THREE.CylinderGeometry(0.08 * s, 0.12 * s, 2.2 * s, 5), 0x6a5a50, 0, x, fy + 1.6 * s, z);
      put(new THREE.IcosahedronGeometry(1.1 * s, 0).scale(1, 0.8, 1), LEAF, 0.25, x, fy + 2.9 * s, z);
      put(new THREE.IcosahedronGeometry(0.7 * s, 0), 0x7fdca0, 0.35, x + 0.5 * s, fy + 2.4 * s, z - 0.3 * s);
    };
    const pid = info.pid;
    const nTrees = pid === 'garden' ? 9 : 4;
    for (let i = 0; i < nTrees; i++) {
      const ang = Math.PI * 0.35 + (i / nTrees) * Math.PI * 1.3;
      const [x, z] = toward(pid === 'garden' ? 0.4 + (i % 3) * 0.18 : 0.78, ang);
      if (rin > 5) tree(x, z, pid === 'garden' ? 1.2 : 0.9);
    }
    // 의자
    for (let i = 0; i < 3; i++) {
      const ang = Math.PI * 0.6 + i * 0.5;
      const [x, z] = toward(0.62, ang);
      put(new THREE.BoxGeometry(2.4, 0.45, 0.7), PEARL, 0, x, fy + 0.4, z, Math.atan2(cx - x, cz - z));
      cur.cols.push(this.game.world.colliders.add({ type: 'box', x, z, hx: 1.2, hz: 0.35, rot: Math.atan2(cx - x, cz - z), y0: fy - 1, y1: fy + 0.62, city: true }));
    }
    // 쓰임별: 가구 + 그 둘레에서 사람이 하는 일 (anchors → citizens.setIndoor)
    const AN = cur.anchors = [];
    const t = this.game.world.clock.time % 1;
    const work = t > 0.27 && t < 0.76, evening = t >= 0.7 && t < 0.9, night = t >= 0.9 || t < 0.24;
    const anchor = (x, z, act, yaw, o = {}) => AN.push({ x, z, y: fy, yaw, act, ...o });
    const face = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);
    const rnd = mulberry32(Math.floor(r.seed * 3e8) + 5);
    // 가구는 단단하다 (닫을 때 함께 치운다)
    const solidC = (c) => cur.cols.push(this.game.world.colliders.add({ y0: fy - 1, city: true, ...c }));
    const sBox = (x, z, hx, hz, rot, h) => solidC({ type: 'box', x, z, hx, hz, rot, y1: fy + h });
    const sCyl = (x, z, rr, h) => solidC({ type: 'cyl', x, z, r: rr, y1: fy + h });
    const table = (x, z, R = 1.3, n = 4, act = 'eat') => {
      put(new THREE.CylinderGeometry(R, R * 0.9, 0.08, 16), PEARL, 0, x, fy + 0.85, z);
      put(new THREE.CylinderGeometry(0.15, 0.3, 0.85, 8), GOLD, 0, x, fy + 0.42, z);
      put(new THREE.TorusGeometry(R * 0.6, 0.04, 3, 18).rotateX(Math.PI / 2), ACC, 1.2, x, fy + 0.9, z);
      sCyl(x, z, R, 0.9);
      for (let i = 0; i < n; i++) { const a = (i / n) * TAU; const sx = x + Math.cos(a) * (R + 0.9), sz = z + Math.sin(a) * (R + 0.9); put(new THREE.CylinderGeometry(0.45, 0.4, 0.45, 10), 0xc8c2d2, 0, sx, fy + 0.22, sz); sCyl(sx, sz, 0.42, 0.45); if (act) anchor(sx, sz, act, face(sx, sz, x, z)); }
    };
    if (pid === 'home') {
      // 책장 · 식탁 · 부엌대 · 잠자리 셋 · 아이 놀이 자리
      const [x, z] = toward(0.9, Math.PI);
      const ry = Math.atan2(cx - x, cz - z);
      for (let a = 0; a < 6; a++) for (let b = 0; b < 4; b++) put(new THREE.BoxGeometry(0.5, 0.4, 0.06), [ACC, GOLD, 0xff9fd0][(a + b) % 3], 0.8 + ((a * 7 + b) % 3) * 0.4, x + Math.cos(ry) * (a - 2.5) * 0.65, fy + 1.2 + b * 0.55, z - Math.sin(ry) * (a - 2.5) * 0.65, ry);
      const [tx, tz] = toward(0.42, Math.PI * 0.72);
      const fam = 2 + Math.floor(rnd() * 3), kids = rnd() < 0.6 ? 1 + Math.floor(rnd() * 2) : 0;
      table(tx, tz, 1.3, 4, null);
      const [kx, kz] = toward(0.74, Math.PI * 1.3);
      const kry = face(kx, kz, cx, cz);
      put(new THREE.BoxGeometry(3.4, 0.95, 0.9), 0xd8d2e0, 0, kx, fy + 0.48, kz, kry);
      sBox(kx, kz, 1.7, 0.45, kry, 0.97);
      put(new THREE.BoxGeometry(3.42, 0.05, 0.92), ACC, 1.2, kx, fy + 0.97, kz, kry);
      put(new THREE.CylinderGeometry(0.3, 0.3, 0.25, 12), 0xffc46a, 1.6, kx + Math.sin(kry) * 0.1, fy + 1.1, kz + Math.cos(kry) * 0.1);
      for (let i = 0; i < 3; i++) { const [bx, bz] = toward(0.8, Math.PI * 0.25 + i * 0.32); put(new THREE.CapsuleGeometry(0.55, 1.6, 3, 10).rotateZ(Math.PI / 2), 0xe8e0f0, 0.3, bx, fy + 0.45, bz, face(bx, bz, cx, cz) + Math.PI / 2); sBox(bx, bz, 1.35, 0.55, face(bx, bz, cx, cz) + Math.PI / 2, 0.9); if (night) anchor(bx, bz, 'sleep', face(bx, bz, cx, cz) + Math.PI / 2); }
      if (!night) {
        if (evening || !work) { anchor(kx - Math.sin(kry) * 1.0, kz - Math.cos(kry) * 1.0, 'cook', kry); for (let i = 0; i < Math.min(4, fam - 1); i++) { const a = (i / 4) * TAU; const sx = tx + Math.cos(a) * 2.2, sz = tz + Math.sin(a) * 2.2; anchor(sx, sz, 'eat', face(sx, sz, tx, tz)); } }
        else { anchor(kx - Math.sin(kry) * 1.0, kz - Math.cos(kry) * 1.0, 'cook', kry, { age: 'elder' }); const [rx, rz] = toward(0.62, Math.PI * 0.85); anchor(rx, rz, 'read', face(rx, rz, x, z), { age: 'elder' }); }
        const [px, pz] = toward(0.3, Math.PI * 1.65);
        for (let i = 0; i < kids; i++) anchor(px, pz, 'kidplay', 0, { r: 1.6 + i * 0.5 });
      }
    } else if (pid === 'lab') {
      for (let i = 0; i < 3; i++) {
        const [x, z] = toward(0.6, Math.PI * 0.75 + i * 0.45);
        put(new THREE.CylinderGeometry(1.1, 0.9, 1.0, 14), PEARL, 0, x, fy + 0.5, z);
        sCyl(x, z, 1.1, 1.0);
        put(new THREE.OctahedronGeometry(0.4, 0), [ACC, 0xb9a6ff, 0xff9fd0][i], 2.2, x, fy + 2.0, z);
        put(new THREE.TorusGeometry(0.9, 0.03, 3, 20).rotateX(Math.PI / 2), ACC, 1.8, x, fy + 1.05, z);
        if (work || rnd() < 0.3) { const ax = x + (cx - x) * 0.3, az = z + (cz - z) * 0.3; anchor(ax, az, 'research', face(ax, az, x, z)); }
      }
    } else if (pid === 'market') {
      for (let i = 0; i < 6; i++) {
        const [x, z] = toward(0.68, Math.PI * 0.45 + i * 0.37);
        const c = [0xff9fd0, 0xffc46a, 0x7ff3e6, 0xb9a6ff][i % 4];
        put(new THREE.BoxGeometry(2.2, 0.9, 1.1), PEARL, 0, x, fy + 0.45, z, Math.atan2(cx - x, cz - z));
        sBox(x, z, 1.1, 0.55, Math.atan2(cx - x, cz - z), 0.9);
        put(new THREE.ConeGeometry(1.7, 0.7, 4).rotateY(Math.PI / 4), c, 0.4, x, fy + 2.7, z);
        put(new THREE.CylinderGeometry(0.05, 0.05, 2.3, 4), GOLD, 0, x, fy + 1.4, z);
        for (let k = 0; k < 4; k++) put(new THREE.IcosahedronGeometry(0.2, 0), [c, 0xffffff, GOLD][k % 3], 1.0, x + (k - 1.5) * 0.4, fy + 1.05, z);
        if (work || evening) {
          const bx = x + (x - cx) * 0.12, bz = z + (z - cz) * 0.12;
          anchor(bx, bz, 'shop', face(bx, bz, cx, cz));
          if (rnd() < 0.6) { const qx = x + (cx - x) * 0.28, qz = z + (cz - z) * 0.28; anchor(qx, qz, 'guest', face(qx, qz, x, z)); }
        }
      }
    } else if (pid === 'school') {
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * TAU;
        const [x, z] = [cx + Math.cos(ang) * rin * 0.55, cz + Math.sin(ang) * rin * 0.55];
        put(new THREE.BoxGeometry(1.6, 0.4, 0.6), [0xffc46a, 0x7ff3e6, 0xff9fd0, 0xb9a6ff][i % 4], 0.2, x, fy + 0.3, z, ang + Math.PI / 2);
        if (work && t < 0.62) anchor(x + Math.cos(ang) * 0.8, z + Math.sin(ang) * 0.8, 'student', face(x, z, cx, cz) + Math.PI, { age: 'child' });
      }
      put(new THREE.RingGeometry(rin * 0.3, rin * 0.32, 32).rotateX(-Math.PI / 2), 0xffd27a, 1.6, cx, fy + 0.03, cz);
      if (work) { const [x, z] = toward(0.22, Math.PI * 0.5); anchor(x, z, 'teach', face(x, z, cx, cz) + Math.PI); }
    } else if (pid === 'heal') {
      for (let i = 0; i < 4; i++) {
        const [x, z] = toward(0.66, Math.PI * 0.6 + i * 0.5);
        const ry = Math.atan2(cx - x, cz - z) + Math.PI / 2;
        put(new THREE.CapsuleGeometry(0.7, 1.8, 4, 10).rotateZ(Math.PI / 2), 0xe8f4ff, 0.5, x, fy + 0.9, z, ry);
        put(new THREE.BoxGeometry(2.8, 0.4, 1.2), PEARL, 0, x, fy + 0.2, z, ry);
        sBox(x, z, 1.4, 0.6, ry, 1.0);
        if (rnd() < 0.6) anchor(x, z, 'patient', ry);
        if (i % 2 === 0) { const hx = x + (cx - x) * 0.25, hz = z + (cz - z) * 0.25; anchor(hx, hz, 'heal', face(hx, hz, x, z)); }
      }
    } else if (pid === 'garden') {
      const [x, z] = toward(0.5, Math.PI);
      put(new THREE.CircleGeometry(Math.min(4, rin * 0.3), 24).rotateX(-Math.PI / 2), 0x3a8ab8, 0.5, x, fy + 0.05, z);
      put(new THREE.TorusGeometry(Math.min(4, rin * 0.3), 0.15, 4, 28).rotateX(Math.PI / 2), PEARL, 0, x, fy + 0.1, z);
      for (let i = 0; i < 3; i++) { const [gx, gz] = toward(0.55, Math.PI * 0.4 + i * 0.6); anchor(gx, gz, 'garden', face(gx, gz, cx, cz)); }
    } else if (pid === 'hall') {
      const [x, z] = toward(0.62, Math.PI);
      put(new THREE.CylinderGeometry(rin * 0.32, rin * 0.34, 0.6, 24, 1, false, 0, Math.PI), PEARL, 0, x, fy + 0.3, z, faceDoor + Math.PI / 2);
      for (let k = 0; k < 3; k++) put(new THREE.TorusGeometry(rin * 0.3 + k * 0.6, 0.04, 3, 24, Math.PI).rotateX(Math.PI / 2), 0xff9fd0, 1.5, x, fy + 0.65 + k * 0.02, z, faceDoor + Math.PI / 2);
      const sing = t > 0.45 && t < 0.92;
      const n = sing ? 5 : 2;
      for (let i = 0; i < n; i++) { const a = (i - (n - 1) / 2) * 0.28; const sx = x + Math.cos(Math.atan2(cz - z, cx - x) + a) * 1.6, sz = z + Math.sin(Math.atan2(cz - z, cx - x) + a) * 1.6; AN.push({ x: sx, z: sz, y: fy + 0.6, yaw: face(sx, sz, cx, cz), act: 'sing' }); }
      if (sing) for (let i = 0; i < 4; i++) { const [ax, az] = toward(0.1 + (i % 2) * 0.18, Math.PI * (0.8 + (i >> 1) * 0.4)); anchor(ax, az, 'eat', face(ax, az, x, z)); }
    } else if (pid === 'office' || pid === 'library') {
      // 책상 줄 (서고는 책장 줄)
      for (let i = 0; i < 6; i++) {
        const [x, z] = toward(0.5 + (i % 2) * 0.22, Math.PI * 0.55 + Math.floor(i / 2) * 0.45);
        const ry = face(x, z, cx, cz);
        sBox(x, z, 0.9, 0.45, ry, pid === 'office' ? 1.0 : 2.4);
        if (pid === 'office') { put(new THREE.BoxGeometry(1.8, 0.08, 0.9), 0xd8d2e0, 0, x, fy + 0.95, z, ry); put(new THREE.BoxGeometry(0.9, 0.6, 0.05), ACC, 1.4, x, fy + 1.4, z, ry); put(new THREE.BoxGeometry(0.2, 0.95, 0.2), GOLD, 0, x, fy + 0.48, z, ry); }
        else for (let b = 0; b < 4; b++) put(new THREE.BoxGeometry(1.8, 0.06, 0.5), [ACC, GOLD, 0xff9fd0, 0xb9a6ff][b], 0.9, x, fy + 0.5 + b * 0.6, z, ry);
        if (work || rnd() < 0.2) anchor(x + Math.sin(ry) * 1.0, z + Math.cos(ry) * 1.0, pid === 'office' ? 'clerk' : 'read', ry + Math.PI);
      }
    } else if (pid === 'factory' || pid === 'depot') {
      for (let i = 0; i < 4; i++) {
        const [x, z] = toward(0.6, Math.PI * 0.55 + i * 0.32);
        const ry = face(x, z, cx, cz);
        sBox(x, z, pid === 'factory' ? 1.1 : 0.75, pid === 'factory' ? 0.8 : 0.65, ry, pid === 'factory' ? 1.4 : 2.3);
        if (pid === 'factory') { put(new THREE.BoxGeometry(2.2, 1.4, 1.6), 0x9aa4b2, 0, x, fy + 0.7, z, ry); put(new THREE.TorusGeometry(0.6, 0.06, 4, 18), [ACC, 0xffc46a][i % 2], 2.0, x, fy + 1.9, z, ry); }
        else for (let k = 0; k < 2; k++) put(new THREE.BoxGeometry(1.5, 1.1, 1.3), [0x6f8fb0, 0xc89060][(i + k) % 2], 0, x, fy + 0.55 + k * 1.12, z, ry);
        if (work) anchor(x + Math.sin(ry) * 1.6, z + Math.cos(ry) * 1.6, 'work', ry + Math.PI);
      }
    } else if (pid === 'terminal') {
      for (let i = 0; i < 3; i++) { const [x, z] = toward(0.55, Math.PI * 0.6 + i * 0.4); put(new THREE.BoxGeometry(4, 0.45, 0.8), 0xc8c2d2, 0, x, fy + 0.4, z, face(x, z, cx, cz)); sBox(x, z, 2, 0.4, face(x, z, cx, cz), 0.62); anchor(x, z, 'eat', face(x, z, cx, cz) + Math.PI); }
      const [dx2, dz2] = toward(0.3, Math.PI * 1.4);
      put(new THREE.BoxGeometry(2.6, 3, 0.1), 0x7ff3e6, 1.6, dx2, fy + 2.4, dz2, face(dx2, dz2, cx, cz));
      if (work) anchor(dx2 + 1, dz2, 'clerk', face(dx2, dz2, cx, cz));
    }
    // 합치기
    const base = new THREE.BufferGeometry();
    base.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    base.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
    base.setAttribute('emit', new THREE.Float32BufferAttribute(E, 1));
    base.computeVertexNormals();
    geoms.push(base);
    const merged = this._merge(geoms);
    const m = new THREE.Mesh(merged, this.mat);
    m.frustumCulled = false;
    g.add(m);
    // 바닥 (동심원 문양)
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.Float32BufferAttribute(FP, 3));
    fg.setAttribute('color', new THREE.Float32BufferAttribute(FC, 3));
    fg.setAttribute('emit', new THREE.Float32BufferAttribute(FE, 1));
    fg.computeVertexNormals();
    this.floorMat.uniforms.uTechC.value.set(cx, fy, cz);
    const fm = new THREE.Mesh(fg, this.floorMat);
    fm.frustumCulled = false;
    g.add(fm);
    // 창 (바깥이 보이는 유리)
    if (WP.length) {
      const wg = new THREE.BufferGeometry();
      wg.setAttribute('position', new THREE.Float32BufferAttribute(WP, 3));
      wg.setAttribute('uv', new THREE.Float32BufferAttribute(WU, 2));
      const wm = new THREE.Mesh(wg, this.winMat);
      wm.frustumCulled = false;
      g.add(wm);
    }
    // 빛 승강기: 유리 관 + 빛기둥
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.75, LH - 0.3, 24, 1, true), glowMaterial({ color: 0xbff8ff, intensity: 0.18, fresnel: 0.95, side: THREE.DoubleSide }));
    tube.position.set(cx, fy + (LH - 0.3) / 2 + 0.15, cz);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, LH - 0.3, 12, 1, true), glowMaterial({ color: 0x9ff6ff, intensity: 0.45 }));
    beam.position.copy(tube.position);
    g.add(tube, beam);
    // 안내 홀로그램 (문 안쪽) + 떠 있는 조형물
    const holo = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.3), hologramMaterial({ color: 0x7ff3e6, color2: 0xffffff, intensity: 1.5, scroll: 0.03, repeat: [0.6, 1], seed: Math.floor(r.seed * 99) }));
    const [hx, hz] = [r.door.x - dn[0] * 3.2 + dt[0] * 2.6, r.door.z - dn[1] * 3.2 + dt[1] * 2.6];
    holo.position.set(hx, fy + 2.3, hz);
    holo.rotation.y = faceDoor;
    g.add(holo);
    const [ax, az] = toward(0.55, Math.PI * 0.95);
    const art = new THREE.Mesh(new THREE.TorusKnotGeometry(0.55, 0.12, 64, 6), glowMaterial({ color: [0xffd27a, 0xff9fd0, 0xb9a6ff][Math.floor(r.seed * 3)], intensity: 1.4 }));
    art.position.set(ax, fy + Math.min(LH - 1.4, 3.2), az);
    if (rin > 6 && info.pid !== 'garden') g.add(art);
    cur.anims.push((t) => { art.rotation.set(t * 0.4, t * 0.7, 0); beam.material.uniforms.uIntensity.value = 0.7 + Math.sin(t * 2) * 0.15; });
    this.game.engine.scene.add(g);
    cur.group = g;
  }

  _box(P, C, E, x, y, z, w, h, d, ry, color, emit) {
    const geo = new THREE.BoxGeometry(w, h, d).rotateY(ry).translate(x, y + h / 2, z).toNonIndexed();
    const pos = geo.attributes.position.array;
    const col = new THREE.Color(color);
    for (let i = 0; i < pos.length; i += 3) { P.push(pos[i], pos[i + 1], pos[i + 2]); C.push(col.r, col.g, col.b); E.push(emit); }
  }

  _paint(geo, color, emit) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
    const n = g.attributes.position.count;
    const c = new THREE.Color(color), cols = new Float32Array(n * 3), em = new Float32Array(n).fill(emit);
    for (let i = 0; i < n; i++) { cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    g.setAttribute('emit', new THREE.BufferAttribute(em, 1));
    g.computeVertexNormals();
    return g;
  }

  _merge(list) {
    let n = 0;
    for (const g of list) n += g.attributes.position.count;
    const P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 3), E = new Float32Array(n);
    let o = 0;
    for (const g of list) {
      const c = g.attributes.position.count;
      P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); C.set(g.attributes.color.array, o * 3); E.set(g.attributes.emit.array, o);
      o += c;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(P, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
    g.setAttribute('color', new THREE.BufferAttribute(C, 3));
    g.setAttribute('emit', new THREE.BufferAttribute(E, 1));
    return g;
  }

  /** 로비의 사람들: 안내지기(인물) + 가구 둘레에서 일하고 쉬는 주민 (citizens 가 그리고 말을 건다) */
  _people(cur) {
    const { r, plan } = cur;
    const g = this.game, N = g.npcs;
    const rnd = mulberry32(Math.floor(r.seed * 7e8));
    const cx = r.x, cz = r.z, dn = [r.door.nx, r.door.nz];
    const rin = Math.min(...plan.map(([x, z]) => Math.hypot(x - cx, z - cz)));
    if (rin > 6 && cur.info.pid !== 'home') {
      const k = rin * 0.52 + 1.2;
      const desk = N._spawn({ id: 'in-desk', name: '안내지기', service: 'lobby', indoor: true, x: cx + dn[0] * (k - 2.6), z: cz + dn[1] * (k - 2.6), y: r.floorY, hue: rnd(), glow: 0x7ff3e6, scale: 0.95, home: { x: cx, z: cz, r: 0.3 } });
      desk.fig.yaw = Math.atan2(dn[0], dn[1]);
      cur.npcs.push(desk);
    }
    // 바닥 높이로 맞춘 자리
    for (const A of cur.anchors || []) A.y = Math.max(A.y, r.floorY);
    if (g.citizens) g.citizens.setIndoor(r, cur.anchors || [], cur.info);
  }

  // ── 하늘 전망대 (지붕 위에 떠 있는 원반) ─────────
  _deck(cur) {
    if (cur.deck) return cur.deck;
    const { r } = cur;
    const g = this.game, C = g.world.colliders;
    const y = r.base + r.sy * 1.12 + 5;
    const R = Math.max(8, Math.min(15, r.sx * 0.9));
    const grp = new THREE.Group();
    const parts = [];
    parts.push(this._paint(new THREE.CylinderGeometry(R, R * 0.8, 0.8, 32).translate(r.x, y - 0.4, r.z), 0x9894aa, 0));
    parts.push(this._paint(new THREE.RingGeometry(R * 0.55, R * 0.58, 40).rotateX(-Math.PI / 2).translate(r.x, y + 0.02, r.z), ACC, 1.6));
    parts.push(this._paint(new THREE.CircleGeometry(1.4, 20).rotateX(-Math.PI / 2).translate(r.x, y + 0.03, r.z), 0xffd27a, 0.6));
    parts.push(this._paint(new THREE.TorusGeometry(R - 0.2, 0.06, 4, 48).rotateX(Math.PI / 2).translate(r.x, y + 1.05, r.z), ACC, 2.0));
    this.deckMat.uniforms.uTechC.value.set(r.x, y, r.z);
    const m = new THREE.Mesh(this._merge(parts), this.deckMat);
    m.frustumCulled = false;
    grp.add(m);
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.2, R - 0.2, 1.05, 48, 1, true), glowMaterial({ color: 0xbff8ff, intensity: 0.35, fresnel: 0.8, side: THREE.DoubleSide }));
    rail.position.set(r.x, y + 0.52, r.z);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.4, y - r.top, 12, 1, true), glowMaterial({ color: 0x9ff6ff, intensity: 0.6, fresnel: 0.5, side: THREE.DoubleSide }));
    beam.position.set(r.x, (y + r.top) / 2, r.z);
    grp.add(rail, beam);
    g.engine.scene.add(grp);
    const cols = [C.add({ type: 'cyl', x: r.x, z: r.z, r: R, y0: y - 0.8, y1: y, city: true })];
    for (let i = 0; i < 16; i++) {
      const a0 = (i / 16) * TAU, a1 = ((i + 1) / 16) * TAU;
      const x0 = r.x + Math.cos(a0) * (R - 0.2), z0 = r.z + Math.sin(a0) * (R - 0.2), x1 = r.x + Math.cos(a1) * (R - 0.2), z1 = r.z + Math.sin(a1) * (R - 0.2);
      cols.push(C.add({ type: 'box', x: (x0 + x1) / 2, z: (z0 + z1) / 2, hx: Math.hypot(x1 - x0, z1 - z0) / 2 + 0.1, hz: 0.25, rot: -Math.atan2(z1 - z0, x1 - x0), y0: y, y1: y + 1.05, walk: false, city: true }));
    }
    cur.deck = { y, R, grp, cols };
    return cur.deck;
  }

  // ── 닫기 ─────────────────────────────────
  close() {
    const cur = this.cur;
    if (!cur) return;
    const g = this.game, C = g.world.colliders;
    for (const c of cur.cols) C.remove(c);
    if (cur.deck) { for (const c of cur.deck.cols) C.remove(c); g.engine.scene.remove(cur.deck.grp); }
    for (const c of cur.r.cols) C.add(c);
    for (const n of cur.npcs) g.npcs.remove(n);
    if (g.citizens) g.citizens.clearIndoor();
    this.guest = null;
    if (cur.group) g.engine.scene.remove(cur.group);
    this.city.closeShell(cur.r);
    this.cur = null;
  }

  // ── 행동 ─────────────────────────────────
  _fade(fn, title, sub) {
    const g = this.game;
    g.setMode('cinematic');
    g.ui.fade(true);
    audio.noise({ freq: 700, q: 0.6, dur: 1.6, gain: 0.3, type: 'bandpass', sweep: 2400, attack: 0.4 });
    setTimeout(() => {
      fn();
      setTimeout(() => { g.ui.fade(false); g.setMode('play'); if (title) g.ui.regionTitle(title, sub, false); }, 500);
    }, 900);
  }

  enter(r) {
    const g = this.game, p = g.player;
    this.open(r);
    const dn = [r.door.nx, r.door.nz];
    p.teleport(r.door.x - dn[0] * 3.2, r.floorY + 1, r.door.z - dn[1] * 3.2);
    p.yaw = Math.atan2(-dn[0], -dn[1]);
    g.rig.yaw = p.yaw + Math.PI;
    g.rig.pitch = -0.05;
    const I = this.info(r);
    g.ui.regionTitle(I.name, `${I.P.desc} · ${I.floors}층`, false);
    if (!g.state.flags.moaIndoor) { g.state.flags.moaIndoor = true; setTimeout(() => g.ui.moa('안으로 들어왔어요! 가운데 빛기둥은 승강기예요. 꼭대기 위 하늘 전망대까지 올라가요.'), 2200); }
  }

  exit() {
    const cur = this.cur, g = this.game, p = g.player;
    if (!cur) return;
    const r = cur.r;
    p.teleport(r.door.x + r.door.nx * 2.5, undefined, r.door.z + r.door.nz * 2.5);
    p.yaw = Math.atan2(r.door.nx, r.door.nz);
    g.rig.yaw = p.yaw + Math.PI;
  }

  up() {
    const cur = this.cur;
    if (!cur) return;
    const d = this._deck(cur);
    const g = this.game, r = cur.r;
    this._fade(() => {
      g.player.teleport(r.x + r.door.nx * 3, d.y + 1, r.z + r.door.nz * 3);
      g.player.yaw = Math.atan2(r.door.nx, r.door.nz);
      g.rig.yaw = g.player.yaw + Math.PI;
      g.rig.pitch = -0.25;
    }, '하늘 전망대', `${Math.round(d.y - r.floorY)} m · 가장자리에서 뛰어내려 활공할 수 있어요`);
  }

  down() {
    const cur = this.cur;
    if (!cur) return;
    const g = this.game, r = cur.r;
    this._fade(() => {
      g.player.teleport(r.x + r.door.nx * 3.2, r.floorY + 1, r.z + r.door.nz * 3.2);
      g.player.yaw = Math.atan2(r.door.nx, r.door.nz);
      g.rig.yaw = g.player.yaw + Math.PI;
    }, this.info(r).name, '로비');
  }

  talk() {
    const cur = this.cur;
    if (!cur) return;
    const I = cur.info, g = this.game;
    g.ui.serviceCard('안내지기', I.name, I.P.desc, [
      { label: '하늘 전망대로', sub: '가운데 빛 승강기로 지붕 위 전망대까지', primary: true, onClick: () => this.up() },
      { label: '밖으로 나가기', sub: '문 앞으로', onClick: () => this.exit() },
    ], `<div class="svc-stat"><span>층 <b>${I.floors}</b></span><span>${I.pid === 'home' ? '사는 이' : '오가는 이'} <b>${I.people}</b></span></div>`);
  }

  // ── 매 프레임 ─────────────────────────────
  /** 상호작용할 것 (game._findTarget 이 부른다) */
  target(p) {
    const cur = this.cur;
    if (cur) {
      const r = cur.r;
      const dc = Math.hypot(p.x - r.x, p.z - r.z);
      if (dc < 3.6 && Math.abs(p.y - r.floorY) < 2.5) return { kind: 'lift', label: '빛 승강기 · 하늘 전망대로', short: '승강기' };
      if (cur.deck && dc < 2.8 && Math.abs(p.y - cur.deck.y) < 2.5) return { kind: 'liftdown', label: '빛 승강기 · 로비로 내려가기', short: '내려가기' };
      const dd = Math.hypot(p.x - r.door.x, p.z - r.door.z);
      if (dd < 3.2 && Math.abs(p.y - r.floorY) < 2.5 && this._inside(p.x, p.z)) return { kind: 'exit', label: '밖으로 나가기', short: '나가기' };
    }
    const d = this.city.nearestDoor(p.x, p.z, 3.2);
    if (d && Math.abs(p.y - d.floorY) < 3 && !(cur && cur.r === d && this._inside(p.x, p.z))) {
      const I = this.info(d);
      return { kind: 'door', o: d, label: `${I.name} · 들어가기`, short: '들어가기' };
    }
    return null;
  }

  update(dt) {
    const g = this.game, p = g.player.pos;
    this.t += dt;
    // 문 앞에 서면 저절로 열린다
    this._auto -= dt;
    if (this._auto <= 0) {
      this._auto = 0.25;
      if (g.mode === 'play' && g.player.state === 'ground') {
        const d = this.city.nearestDoor(p.x, p.z, 2.4);
        if (d && !d.open && Math.abs(p.y - d.floorY) < 2) this.open(d);
      }
    }
    const cur = this.cur;
    if (!cur) return;
    for (const f of cur.anims) f(this.t);
    // 로비 천장: 점프·활공으로 머리가 천장을 뚫지 않게 (승강기는 순간 이동이라 걸리지 않는다)
    {
      const r = cur.r, ceil = r.floorY + cur.LH;
      if (p.y > r.floorY - 1 && p.y < ceil + 1.5 && this._inside(p.x, p.z, -0.2)) {
        const maxY = ceil - 1.75 - 0.12;
        if (p.y > maxY) { p.y = maxY; if (g.player.vel.y > 0) g.player.vel.y = 0; }
      }
      // 실내 사람도 방 안·천장 아래에
      if (g.citizens) for (const q of g.citizens.indoor) {
        if (!this._inside(q.pos.x, q.pos.z, 0.5)) { q.pos.x += (r.x - q.pos.x) * 0.2; q.pos.z += (r.z - q.pos.z) * 0.2; }
        q.pos.y = Math.min(q.pos.y, ceil - 2.0 * q.scale - 0.1);
      }
    }
    // 멀어지면 닫는다
    const r = cur.r;
    const dc = Math.hypot(p.x - r.x, p.z - r.z);
    const onDeck = cur.deck && dc < cur.deck.R + 40 && Math.abs(p.y - cur.deck.y) < 60;
    if (!onDeck && dc > r.ext + 45) this.close();
  }

  /** 실내에서는 카메라가 벽·바닥·천장 밖으로 나가지 않게 (좁은 방에서 다른 층·바깥이 비쳐 보이는 것을 막는다) */
  clampCamera(cam, target) {
    const cur = this.cur;
    if (!cur) return;
    const p = this.game.player.pos, r = cur.r;
    if (p.y > r.floorY + cur.LH + 1 || p.y < r.floorY - 2 || !this._inside(p.x, p.z, -0.8)) return;
    const top = r.floorY + cur.LH - 0.45, bot = r.floorY + 0.35;
    const ok = (x, y, z) => y < top && y > bot && this._inside(x, z, 0.55);
    // 벽에 가까워도 화면 가장자리가 벽을 뚫고 보이지 않게 가까운 면을 당긴다
    if (cam.near !== 0.15) { cam.near = 0.15; cam.updateProjectionMatrix(); }
    // 안전한 기준점: 목표(머리 둘레)를 방 안으로 끌어들인 점
    const a = target.clone();
    a.y = Math.min(top - 0.05, Math.max(bot + 0.05, a.y));
    if (!this._inside(a.x, a.z, 0.55)) {
      const c = new THREE.Vector3(r.x, a.y, r.z);
      let lo = 0, hi = 1;
      for (let i = 0; i < 12; i++) { const m = (lo + hi) / 2; const q = c.clone().lerp(a, m); if (this._inside(q.x, q.z, 0.55)) lo = m; else hi = m; }
      a.copy(c.lerp(a, lo));
    }
    if (ok(cam.position.x, cam.position.y, cam.position.z)) return;
    const b = cam.position.clone();
    let lo = 0, hi = 1;
    for (let i = 0; i < 12; i++) {
      const m = (lo + hi) / 2;
      const q = a.clone().lerp(b, m);
      if (ok(q.x, q.y, q.z)) lo = m; else hi = m;
    }
    cam.position.copy(a.lerp(b, lo));
    cam.lookAt(target);
  }

  /** 저장할 자리: 실내·전망대에 있으면 문 앞으로 */
  safeSpot() {
    const cur = this.cur;
    if (!cur) return null;
    const p = this.game.player.pos, r = cur.r;
    if (Math.hypot(p.x - r.x, p.z - r.z) > r.ext + 6 && !(cur.deck && Math.abs(p.y - cur.deck.y) < 20)) return null;
    return { x: r.door.x + r.door.nx * 3, z: r.door.z + r.door.nz * 3 };
  }
}
