// 하늘길: 아웬의 배들이 다니는 길과 배들.
//  · 고리길(loop)  — 하모네아와 각 구역의 탑을 도는 둥근 길
//  · 노선(route)   — 수도와 지방 도시를 오가는 길 (공명탑이 깨어나야 다시 열림)
//  · 나들목(hop)   — 탑의 착륙대 사이를 오가는 작은 배
//  · 하늘대로      — 대륙 너머에서 와서 대륙 너머로 가는 큰 배들의 높은 길
//  · 궤도선        — 별항구에서 가속 고리탑을 지나 하늘로 쏘아 올려지는 왕복선
// 배 종류: 나룻배(skiff, 9 m) · 짐배(barge, 64 m) · 큰배(liner, 320 m) · 왕복선(shuttle, 42 m).
// 짐배·큰배의 갑판은 밟을 수 있는 움직이는 발판입니다(활공해서 내려앉으면 함께 실려 간다).
import * as THREE from 'three';
import { heightAt } from './heightfield.js';
import { mulberry32 } from '../core/noise.js';
import { part, merge, xf, lathe } from './geo-utils.js';
import * as A from './arch.js';
import { litMaterial } from './materials.js';
import { PointLights } from './lights.js';
import { Trail } from './particles.js';
import { PLACE } from '../data/places.js';
import { bus } from '../core/events.js';

const PAL = A.PAL;
const L_LINER = 320;

// 지방 노선: 도시 id, 깨워야 하는 공명탑, 도착 높이(지면 위)
const ROUTES = [
  { to: 'dewfold', unlock: null, above: 140 },
  { to: 'yunseul', unlock: 'glass-pylon', above: 220 },
  { to: 'gatmaeul', unlock: 'bloom-pylon', above: 260 },
  { to: 'tteodol', unlock: 'canyon-pylon', above: 220 },
  { to: 'observatory', unlock: 'frost-pylon', above: 200 },
  { to: 'mulnorae', unlock: 'sea-pylon', above: 180 },
  // 바다 건너 (큰 공명탑이 깨어나면)
  { to: 'hyeon', unlock: 'rift-pylon', above: 1050, far: true },
  { to: 'bones', unlock: 'plains-pylon', above: 420, far: true },
  { to: 'great-ear', unlock: 'ice-pylon', above: 480, far: true },
  { to: 'sky-forge', unlock: 'falls-pylon', above: 900, far: true },
];

// ── 배 모델 (앞 = +Z) ─────────────────────────
function skiffGeo() {
  const parts = [];
  const hull = lathe([[0.0001, -4.6], [1.2, -3.5], [1.6, 0.5], [0.9, 3.6], [0.0001, 4.8]], 8);
  hull.rotateX(Math.PI / 2);
  hull.scale(1, 0.62, 1);
  parts.push(part(hull, (x, y, z) => (y > 0.25 ? PAL.pearl : 0xd6d0e2), 0));
  parts.push(part(xf(new THREE.SphereGeometry(0.9, 6, 4), { z: 1.4, y: 0.55, sx: 0.9, sy: 0.55, sz: 1.6 }), 0x2a5a78, 0.25));
  parts.push(part(xf(new THREE.TorusGeometry(1.3, 0.16, 3, 10), { y: -0.75, rx: Math.PI / 2 }), PAL.teal, 1.8));
  for (const s of [-1, 1]) parts.push(part(xf(new THREE.BoxGeometry(2.2, 0.12, 1.4), { x: s * 1.8, z: -2.6, rz: s * 0.25 }), PAL.gold, 0.2));
  return merge(parts);
}

function bargeGeo() {
  const parts = [];
  parts.push(part(xf(new THREE.BoxGeometry(14, 6, 60, 1, 1, 4), { y: -1 }), 0xd8d2e2, 0));
  const bow = lathe([[0.0001, 0], [7, 0], [6.6, 4], [4, 9], [0.0001, 12]], 4);
  bow.rotateY(Math.PI / 4);
  bow.rotateX(Math.PI / 2);
  bow.scale(1.4, 0.6, 1);
  parts.push(part(xf(bow, { z: 30, y: -1 }), PAL.pearl, 0));
  // 짐(컨테이너)
  const cols = [0xe9c27c, 0x7fb8c8, 0xc48aa8, 0xb9a6ff, 0xe0d8c8];
  for (let i = 0; i < 6; i++) for (let j = -1; j <= 1; j += 2) parts.push(part(xf(new THREE.BoxGeometry(5.6, 4.2, 7.4), { x: j * 3.3, y: 4.2, z: -22 + i * 8.6 }), cols[(i * 2 + j + 7) % 5], 0));
  // 발광띠·공명 고리
  parts.push(part(xf(new THREE.BoxGeometry(14.4, 0.5, 60.4), { y: -2.6 }), PAL.amber, 1.4));
  for (const z of [-24, 0, 24]) parts.push(part(xf(new THREE.TorusGeometry(4.6, 0.5, 4, 20), { y: -4.8, z, rx: Math.PI / 2 }), PAL.teal, 1.8));
  parts.push(part(xf(new THREE.BoxGeometry(6, 5, 6), { y: 4.5, z: 25 }), PAL.pearl2, 0));
  parts.push(part(xf(new THREE.BoxGeometry(6.2, 1.2, 0.3), { y: 5.5, z: 28.1 }), 0xffd08a, 1.4));
  return merge(parts);
}

export function linerGeo() {
  const parts = [];
  const L = 320;
  const prof = [[0.0001, -L * 0.5], [10, -L * 0.48], [16, -L * 0.4], [24, -L * 0.15], [27, L * 0.05], [24, L * 0.25], [15, L * 0.4], [6, L * 0.48], [0.0001, L * 0.5]];
  const hull = lathe(prof, 16);
  hull.rotateX(Math.PI / 2);
  hull.scale(1.35, 0.55, 1);
  parts.push(part(hull, (x, y) => (y > 2 ? PAL.pearl : 0xd2cce0), (x, y) => (Math.abs(y - 1.0) < 1.4 ? 1.4 : 0)));
  // 창문 띠 (양옆)
  for (const s of [-1, 1]) parts.push(part(xf(new THREE.BoxGeometry(0.4, 2.4, L * 0.6), { x: s * 34.5, y: 2, z: 0 }), 0xffd8a0, 1.6));
  // 위 갑판: 산책로 + 돔 + 정원
  parts.push(part(xf(new THREE.BoxGeometry(34, 2, L * 0.62), { y: 13.6 }), 0xece6f2, 0));
  parts.push(part(xf(new THREE.BoxGeometry(30, 0.2, L * 0.6), { y: 14.7 }), 0x3f8f76, 0));
  for (const s of [-1, 1]) parts.push(part(xf(new THREE.BoxGeometry(0.4, 1.2, L * 0.62), { x: s * 16.8, y: 15.4 }), 0xbffcff, 1.5));
  for (let i = 0; i < 3; i++) {
    const z = -L * 0.2 + i * L * 0.16;
    parts.push(part(xf(lathe([[8, 0], [7.4, 4], [4.5, 8.5], [0.0001, 10]], 10), { x: (i % 2 ? 7 : -7), y: 14.6, z }), (x, y) => (y > 14.6 + 9 ? PAL.gold : PAL.pearl), (x, y) => (y < 14.6 + 2 ? 0.8 : 0)));
  }
  parts.push(part(xf(lathe([[4, 0], [2.6, 20], [1.2, 40], [0.0001, 48]], 8), { y: 14.6, z: L * 0.22 }), PAL.pearl2, (x, y) => (y > 14.6 + 44 ? 1.4 : 0)));
  parts.push(part(xf(new THREE.TorusGeometry(5, 0.4, 3, 16), { y: 14.6 + 36, z: L * 0.22, rx: Math.PI / 2 }), PAL.teal, 1.6));
  // 꼬리 엔진 고리
  for (let i = 0; i < 3; i++) parts.push(part(xf(new THREE.TorusGeometry(10 - i * 2.4, 1.1, 4, 18), { z: -L * 0.5 - 6 - i * 7 }), PAL.teal, 2.0 - i * 0.4));
  parts.push(part(xf(new THREE.BoxGeometry(2, 2, L * 0.8), { y: -14.5 }), PAL.violet, 1.6));
  // 지느러미
  for (const s of [-1, 1]) parts.push(part(xf(new THREE.BoxGeometry(46, 1.6, 30), { x: s * 46, y: 0, z: -L * 0.3, rz: s * 0.12 }), PAL.pearl2, 0));
  return merge(parts);
}

function shuttleGeo() {
  const parts = [];
  parts.push(part(lathe([[0.0001, 0], [4.4, 0], [5.4, 4], [5.6, 18], [4.6, 30], [2.4, 38], [0.0001, 42]], 14), (x, y) => (y < 3 ? 0x3a3448 : PAL.pearl), (x, y) => (y < 1 ? 1.5 : 0)));
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    parts.push(part(xf(new THREE.BoxGeometry(0.8, 14, 6), { x: Math.cos(a) * 6.4, y: 7, z: Math.sin(a) * 6.4, ry: -a }), PAL.gold, 0.2));
  }
  parts.push(part(xf(new THREE.TorusGeometry(5.7, 0.4, 4, 24), { y: 18, rx: Math.PI / 2 }), PAL.teal, 1.8));
  parts.push(part(xf(new THREE.CylinderGeometry(4, 4.8, 1.2, 14), { y: -0.6 }), 0xffe6b0, 3));
  return merge(parts);
}

export class Traffic {
  constructor(world, megacity, quality = {}) {
    this.world = world;
    this.megacity = megacity;
    this.scene = world.scene;
    this.density = quality.flora !== undefined ? Math.max(0.45, Math.min(1, quality.flora * 1.3)) : 1;
    this.lanes = [];
    this.vessels = [];
    this.t = 0;
    this.lights = new PointLights(this.scene, 1400, { minPx: 2.2, day: 0.4 });
    const mat = litMaterial({ vertexColors: true, vertexEmit: true, emissive: 0xffffff, emissiveIntensity: 1.5, emissiveNight: 0.6, rim: 0.7, rimColor: 0xe0f0ff, spec: 1.2 });
    this.types = {
      skiff: { geo: skiffGeo(), max: 420, len: 9, lights: [[0, 0, 4.6, 0xffffff, 3], [0, -0.8, -4.4, 0, 3]] },
      barge: { geo: bargeGeo(), max: 60, len: 64, lights: [[0, 7, 28, 0xffffff, 7], [-7, -2, -30, 0xff5a4a, 6, 1], [7, -2, -30, 0x7fffb0, 6, 1], [0, -5, 0, PAL.amber, 9]] },
      liner: { geo: linerGeo(), max: 24, len: 320, lights: [[0, 0, 162, 0xffffff, 18], [-60, 0, -96, 0xff5a4a, 14, 0.7], [60, 0, -96, 0x7fffb0, 14, 0.7], [0, 0, -175, PAL.teal, 30], [0, 20, 60, 0xffd8a0, 10], [0, 20, -40, 0xffd8a0, 10]] },
    };
    for (const T of Object.values(this.types)) {
      T.mesh = new THREE.InstancedMesh(T.geo, mat, T.max);
      T.mesh.count = 0;
      T.mesh.frustumCulled = false;
      T.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.scene.add(T.mesh);
      T.n = 0;
    }
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler(0, 0, 0, 'YXZ');
    this._p = new THREE.Vector3();
    this._t = new THREE.Vector3();
    this._t2 = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this._lp = new THREE.Vector3();

    this._buildLanes();
    this._buildShuttles();
    bus.on('awaken', (e) => this.unlock(e.id));
  }

  // ── 길 만들기 ─────────────────────────────
  _lane(pts, opts) {
    const n = pts.length;
    const arr = new Float32Array(n * 3);
    const cum = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = pts[i].x; arr[i * 3 + 1] = pts[i].y; arr[i * 3 + 2] = pts[i].z;
      if (i) cum[i] = cum[i - 1] + pts[i].distanceTo(pts[i - 1]);
    }
    const lane = { pts: arr, cum, n, length: cum[n - 1], enabled: true, closed: true, vis: 1, ...opts };
    this.lanes.push(lane);
    return lane;
  }

  _loop(cx, cz, R, y, dir, wobble = 0, seed = 1) {
    const pts = [];
    const n = Math.max(48, Math.round((2 * Math.PI * R) / 60));
    for (let i = 0; i <= n; i++) {
      const a = dir * (i / n) * Math.PI * 2 + seed;
      const rr = R * (1 + wobble * Math.sin(a * 3 + seed));
      pts.push(new THREE.Vector3(cx + Math.cos(a) * rr, y + Math.sin(a * 2 + seed) * 25, cz + Math.sin(a) * rr));
    }
    return this._lane(pts, { kind: 'loop' });
  }

  /** A → B → A 순환 노선 (돌아오는 길은 옆으로 비켜서) */
  _route(ax, az, ay, bx, bz, by, opts = {}) {
    const dx = bx - ax, dz = bz - az;
    const L = Math.hypot(dx, dz);
    const ux = dx / L, uz = dz / L;
    const rnd = mulberry32(Math.floor(L));
    const bend = (rnd() - 0.5) * 0.35 * L * 0.25;
    const N = Math.max(24, Math.round(L / 90));
    const raw = [];
    for (let i = 0; i <= N; i++) raw.push(heightAt(ax + dx * (i / N), az + dz * (i / N)));
    const win = Math.max(2, Math.round(900 / (L / N)));
    const side = (sgn) => {
      const pts = [];
      for (let k = 0; k <= N; k++) {
        const i = sgn > 0 ? k : N - k;
        const t = i / N;
        let m = -1e9;
        for (let j = Math.max(0, i - win); j <= Math.min(N, i + win); j++) m = Math.max(m, raw[j]);
        const ends = Math.min(1, Math.min(t, 1 - t) * 8);
        const base = ay + (by - ay) * t;
        const y = Math.max(base, (Math.max(0, m) + (opts.clear ?? 320)) * ends + base * (1 - ends)) + (sgn > 0 ? 0 : 45);
        const lat = Math.sin(t * Math.PI) * bend + (sgn > 0 ? -50 : 50);
        pts.push(new THREE.Vector3(ax + dx * t - uz * lat, y, az + dz * t + ux * lat));
      }
      return pts;
    };
    const go = side(1), back = side(-1);
    // 이음: 끝에서 반 바퀴 돌아 나간다
    const pts = [...go, ...back, go[0].clone()];
    // 부드럽게
    for (let pass = 0; pass < 2; pass++) for (let i = 1; i < pts.length - 1; i++) pts[i].y = (pts[i - 1].y + pts[i].y * 2 + pts[i + 1].y) / 4;
    return this._lane(pts, { kind: 'route', ...opts });
  }

  _buildLanes() {
    const mc = this.megacity;
    const rnd = mulberry32(4242);
    const add = (lane, type, count, speed) => {
      count = Math.round(count * (type === 'skiff' ? this.density : 1));
      for (let i = 0; i < count; i++) this._vessel(type, lane, (i / count) * lane.length + rnd() * 30, speed * (0.85 + rnd() * 0.3));
    };
    // 하모네아 둘레
    const l1 = this._loop(0, 0, 2150, 720, 1, 0.08, 0.3);
    add(l1, 'skiff', 22, 70); add(l1, 'barge', 3, 40);
    const l2 = this._loop(0, 0, 3300, 1280, -1, 0.12, 1.1);
    add(l2, 'skiff', 14, 85); add(l2, 'barge', 3, 45); add(l2, 'liner', 1, 32);
    const l3 = this._loop(0, 0, 900, 1380, 1, 0.05, 2.0);
    add(l3, 'skiff', 10, 55);
    // 구역 둘레
    for (const d of mc.districts) {
      const h = d.halo;
      const lp = this._loop(h.x, h.z, h.R + 140, h.y + 70, rnd() < 0.5 ? 1 : -1, 0.1, d.seed);
      add(lp, 'skiff', 9, 55);
      // 구역 ↔ 수도
      const a = Math.atan2(h.z, h.x);
      const r = this._route(Math.cos(a) * 1600, Math.sin(a) * 1600, 1000, h.x - Math.cos(a) * (h.R + 60), h.z - Math.sin(a) * (h.R + 60), h.y + 40, { clear: 260 });
      add(r, 'skiff', 10, 80); add(r, 'barge', 1, 45);
    }
    // 지방 노선
    for (const R of ROUTES) {
      const P = PLACE[R.to];
      if (!P) continue;
      const [bx, bz] = P.pos;
      const by = heightAt(bx, bz) + R.above;
      const a = Math.atan2(bz, bx);
      const lane = this._route(Math.cos(a) * 1600, Math.sin(a) * 1600, 1000, bx, bz, by, { clear: 340, unlock: R.unlock, to: R.to });
      const L = lane.length;
      add(lane, 'skiff', R.far ? Math.min(10, Math.round(L / 3000)) : Math.round(L / 1400), R.far ? 140 : 95);
      add(lane, 'barge', Math.max(1, Math.round(L / (R.far ? 20000 : 9000))), R.far ? 70 : 50);
      if (L > 40000 || R.far) add(lane, 'liner', R.far ? 2 : 1, 45);
      lane.enabled = !R.unlock;
      lane.vis = lane.enabled ? 1 : 0;
    }
    // 하늘대로: 대륙 너머에서 와서 대륙 너머로
    const hw = [
      [-42000, 2600, 15000, 42000, 2900, -12000],
      [-15000, 3300, -42000, 18000, 3100, 42000],
    ];
    for (const [ax, ay, az, bx, by, bz] of hw) {
      const lane = this._route(ax, az, ay, bx, bz, by, { clear: 2200 });
      add(lane, 'liner', 4, 45);
      add(lane, 'barge', 6, 60);
      add(lane, 'skiff', 10, 120);
    }
    // 나들목: 착륙대 사이 (같은 구역 안)
    const docks = mc.docks.slice();
    let hops = 0;
    for (let i = 0; i < docks.length && hops < 24; i++) {
      const A0 = docks[i];
      let best = null, bd = 1e9;
      for (let j = 0; j < docks.length; j++) {
        if (j === i) continue;
        const d = Math.hypot(docks[j].x - A0.x, docks[j].z - A0.z);
        if (d > 120 && d < 1600 && d < bd) { bd = d; best = docks[j]; }
      }
      if (!best) continue;
      const top = Math.max(A0.y, best.y) + 60;
      const pts = [];
      const N = 30;
      for (let k = 0; k <= N; k++) {
        const t = k / N;
        const up = Math.min(1, t * 5, (1 - t) * 5);
        const y = A0.y + (best.y - A0.y) * t + (top - Math.max(A0.y, best.y)) * Math.sin(up * Math.PI / 2) + 2;
        pts.push(new THREE.Vector3(A0.x + (best.x - A0.x) * t, y + 1.2, A0.z + (best.z - A0.z) * t));
      }
      const lane = this._lane(pts, { kind: 'hop', closed: false });
      const v = this._vessel('skiff', lane, rnd() * lane.length, 28);
      v.pingpong = 1;
      v.dwell = rnd() * 8;
      hops++;
    }
  }

  _vessel(type, lane, s, speed) {
    const T = this.types[type];
    if (T.n >= T.max) return null;
    const v = { type, lane, s, speed, idx: T.n++, lights: [], vis: lane.vis, pos: new THREE.Vector3(), yaw: 0, pitch: 0, roll: 0, whoosh: 0 };
    T.mesh.count = T.n;
    for (const [lx, ly, lz, c, size, blink] of T.lights) {
      const col = c === 0 ? [PAL.teal, PAL.amber, PAL.rose, PAL.violet][v.idx % 4] : c;
      v.lights.push(this.lights.add(0, -1e5, 0, col, size, blink || 0, Math.random()));
    }
    // 큰 배·짐배의 갑판은 밟을 수 있다
    if (type === 'liner' || type === 'barge') {
      v.obj = new THREE.Object3D();
      const deck = type === 'liner' ? { hx: 16, hz: L_LINER * 0.31, top: 14.8, bottom: -10 } : { hx: 7, hz: 30, top: 6.3, bottom: -3 };
      v.col = this.world.colliders.add({ type: 'box', x: 0, z: 0, hx: deck.hx, hz: deck.hz, rot: 0, y0: deck.bottom, y1: deck.top, obj: v.obj });
    }
    this.vessels.push(v);
    return v;
  }

  _buildShuttles() {
    const sp = this.megacity.starport;
    this.shuttles = [];
    if (!sp) return;
    const geo = shuttleGeo();
    const mat = litMaterial({ vertexColors: true, vertexEmit: true, emissive: 0xffffff, emissiveIntensity: 1.5, emissiveNight: 0.5, rim: 0.7, spec: 1.4 });
    for (let i = 0; i < 2; i++) {
      const m = new THREE.Mesh(geo, mat);
      m.frustumCulled = false;
      this.scene.add(m);
      const trail = new Trail(this.scene, i === 0 ? 0xffe0b0 : 0xbffcff, 70, 14);
      const light = this.lights.add(0, -1e5, 0, 0xffe6b0, 40, 0, 0);
      this.shuttles.push({ m, trail, light, mode: i === 0 ? 'wait' : 'descend', t: i === 0 ? 20 : 0, y: 0, v: 0 });
    }
    this.shuttles[1].y = 18000;
  }

  /** 공명탑이 깨어나면 그 지방 노선이 다시 열린다 */
  unlock(pylonId, instant = false) {
    for (const l of this.lanes) if (l.unlock === pylonId) { l.enabled = true; if (instant) l.vis = 1; }
  }

  _sample(lane, s, outP, outT) {
    const L = lane.length;
    if (lane.closed) { s %= L; if (s < 0) s += L; } else s = Math.max(0, Math.min(L - 0.01, s));
    const c = lane.cum;
    let lo = 0, hi = lane.n - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (c[m] <= s) lo = m; else hi = m; }
    const k = (s - c[lo]) / Math.max(1e-4, c[hi] - c[lo]);
    const p = lane.pts;
    const ax = p[lo * 3], ay = p[lo * 3 + 1], az = p[lo * 3 + 2];
    const bx = p[hi * 3], by = p[hi * 3 + 1], bz = p[hi * 3 + 2];
    outP.set(ax + (bx - ax) * k, ay + (by - ay) * k, az + (bz - az) * k);
    if (outT) outT.set(bx - ax, by - ay, bz - az).normalize();
  }

  update(dt, ctx) {
    this.t += dt;
    const cam = ctx && ctx.game ? ctx.game.engine.camera.position : null;
    const audio = ctx && ctx.game ? ctx.game.audio : null;
    for (const l of this.lanes) l.vis += ((l.enabled ? 1 : 0) - l.vis) * Math.min(1, dt * 0.5);
    const m = this._m, q = this._q, e = this._e, P = this._p, Tn = this._t, T2 = this._t2, S = this._s;
    for (const v of this.vessels) {
      const T = this.types[v.type];
      const lane = v.lane;
      if (v.pingpong) {
        if (v.dwell > 0) v.dwell -= dt;
        else {
          v.s += v.speed * v.pingpong * dt;
          if (v.s >= lane.length) { v.s = lane.length; v.pingpong = -1; v.dwell = 6 + Math.random() * 10; }
          if (v.s <= 0) { v.s = 0; v.pingpong = 1; v.dwell = 6 + Math.random() * 10; }
        }
      } else v.s += v.speed * dt;
      const look = v.pingpong ? Math.max(-1, Math.min(1, v.pingpong)) : 1;
      this._sample(lane, v.s, P, Tn);
      this._sample(lane, v.s + 40 * look, this._lp, T2);
      if (look < 0) Tn.negate();
      const yaw = Math.atan2(Tn.x, Tn.z);
      const pitch = v.pingpong && v.dwell > 0 ? 0 : -Math.asin(Math.max(-0.6, Math.min(0.6, Tn.y)));
      // 회전할 때 기울기
      const turn = Math.atan2(Tn.x * T2.z - Tn.z * T2.x, Tn.x * T2.x + Tn.z * T2.z);
      const roll = Math.max(-0.5, Math.min(0.5, -turn * (v.type === 'liner' ? 3 : 6)));
      v.roll += (roll - v.roll) * Math.min(1, dt * 2);
      v.pos.copy(P);
      // 떠 있는 흔들림
      v.pos.y += Math.sin(this.t * 0.8 + v.idx) * (v.type === 'liner' ? 2 : 0.6);
      const vis = lane.vis;
      e.set(pitch, yaw, v.roll);
      q.setFromEuler(e);
      S.setScalar(vis < 0.02 ? 0.0001 : Math.min(1, vis * 1.2));
      m.compose(v.pos, q, S);
      T.mesh.setMatrixAt(v.idx, m);
      // 불빛
      for (let k = 0; k < v.lights.length; k++) {
        const L = T.lights[k];
        this._lp.set(L[0], L[1], L[2]).applyQuaternion(q).add(v.pos);
        if (vis < 0.05) this.lights.set(v.lights[k], 0, -1e5, 0);
        else this.lights.set(v.lights[k], this._lp.x, this._lp.y, this._lp.z);
      }
      if (v.obj) {
        v.obj.position.copy(v.pos);
        v.obj.rotation.set(0, yaw, 0);
        v.obj.updateMatrixWorld();
        if (vis < 0.05) v.obj.position.y = -1e5;
        this.world.colliders.updateDynamic(v.col);
      }
      // 지나가는 소리
      if (cam && audio && vis > 0.5) {
        const d = v.pos.distanceTo(cam);
        v.whoosh = Math.max(0, v.whoosh - dt);
        if (v.type === 'skiff' && d < 70 && v.whoosh <= 0) {
          v.whoosh = 4;
          audio.noise({ freq: 900, q: 0.8, dur: 1.4, gain: 0.35, type: 'bandpass', pos: v.pos, sweep: 300, attack: 0.4, maxDist: 220, wet: 0.2 });
        }
        if ((v.type === 'liner' || v.type === 'barge') && d < (v.type === 'liner' ? 900 : 260) && v.whoosh <= 0) {
          v.whoosh = 2.2;
          audio.noise({ freq: v.type === 'liner' ? 70 : 140, q: 0.7, dur: 3, gain: v.type === 'liner' ? 1.4 : 0.6, type: 'lowpass', pos: v.pos, attack: 0.8, maxDist: v.type === 'liner' ? 1600 : 500, wet: 0.4 });
        }
      }
    }
    for (const T of Object.values(this.types)) T.mesh.instanceMatrix.needsUpdate = true;
    this._shuttles(dt, cam, audio);
    this.lights.update();
  }

  _shuttles(dt, cam, audio) {
    const sp = this.megacity.starport;
    if (!sp) return;
    for (const s of this.shuttles) {
      s.t -= dt;
      let on = false;
      if (s.mode === 'wait') {
        s.y = sp.y + 1;
        s.v = 0;
        if (s.t <= 0) {
          s.mode = 'launch';
          this.megacity.pulseLaunch();
          if (audio) audio.noise({ freq: 60, q: 0.6, dur: 9, gain: 3.5, type: 'lowpass', pos: { x: sp.x, y: sp.y + 200, z: sp.z }, attack: 0.8, maxDist: 9000, wet: 0.6 });
          if (audio) audio.noise({ freq: 400, q: 0.5, dur: 5, gain: 1.2, type: 'bandpass', pos: { x: sp.x, y: sp.y + 300, z: sp.z }, sweep: 120, attack: 1.2, maxDist: 6000, wet: 0.5 });
        }
      } else if (s.mode === 'launch') {
        const a = s.y < sp.top ? 38 : 90;
        s.v += a * dt;
        s.y += s.v * dt;
        on = true;
        if (s.y > sp.y + 19000) { s.mode = 'wait'; s.t = 70 + Math.random() * 50; s.trail.update(dt, this._p, false, cam || this._p); }
      } else if (s.mode === 'descend') {
        const h = s.y - sp.y;
        const target = Math.max(6, Math.min(700, h * 0.28));
        s.v += (target - s.v) * Math.min(1, dt * 0.8);
        s.y -= s.v * dt;
        on = h < 3000;
        if (s.y <= sp.y + 1) { s.y = sp.y + 1; s.mode = 'land'; s.t = 12; }
      } else if (s.mode === 'land') {
        if (s.t <= 0) { s.mode = 'descend'; s.y = sp.y + 19000; s.v = 700; }
      }
      // 하강선은 발사대 옆 착륙장에 내려앉는다
      const off = s === this.shuttles[1] ? 90 : 0;
      s.m.position.set(sp.x + off, s.y, sp.z + (off ? 40 : 0));
      s.m.visible = s.mode !== 'land' || true;
      this._p.set(s.m.position.x, s.y - 2, s.m.position.z);
      s.trail.update(dt, this._p, on && s.mode === 'launch' && s.y < sp.y + 15000, cam || this._p);
      s.m.visible = s.y < sp.y + 18000;
      if (on || s.mode === 'wait' || s.mode === 'land') this.lights.set(s.light, this._p.x, this._p.y - 2, this._p.z);
      else this.lights.set(s.light, 0, -1e5, 0);
      this.lights.color(s.light, s.mode === 'launch' ? 0xffe6b0 : 0xbffcff, s.mode === 'launch' ? 1.6 : 0.6);
    }
  }
}

