// 빛길: 하모네아를 도는 고리선과, 거기서 지방 도시로 뻗은 여섯 갈래의 유리관 철도.
// 공중에 뜬 캡슐이 관 속을 시속 2,000 km 넘게 달립니다. 역에서 타면 다른 역으로 빠르게 옮겨 갑니다.
// 갈래선은 그 지방의 공명탑이 깨어나야 다시 움직입니다(들판선은 썰매를 고친 뒤부터).
import * as THREE from 'three';
import { heightAt } from './heightfield.js';
import { part, merge, xf, lathe } from './geo-utils.js';
import * as A from './arch.js';
import { litMaterial, glowMaterial } from './materials.js';
import { hologramMaterial } from './hologram.js';
import { PointLights } from './lights.js';
import { PLACE } from '../data/places.js';
import { bus } from '../core/events.js';
import { LINES, RING_R, STATION } from '../data/transit-lines.js';

const PAL = A.PAL;
export { LINES };
const _v = new THREE.Vector3();

/** 면 뒤집기 (part 가 만든 색인 없는 기하): 삼각형 꼭짓점 차례를 바꾸고 법선을 뒤집는다 — 안에서 보는 면 */
function flipFaces(g) {
  for (const k of Object.keys(g.attributes)) {
    const a = g.attributes[k], n = a.itemSize, arr = a.array;
    for (let t = 0; t + 2 < a.count; t += 3) for (let c = 0; c < n; c++) { const i1 = (t + 1) * n + c, i2 = (t + 2) * n + c, tmp = arr[i1]; arr[i1] = arr[i2]; arr[i2] = tmp; }
  }
  const nm = g.attributes.normal;
  if (nm) for (let i = 0; i < nm.array.length; i++) nm.array[i] = -nm.array[i];
  return g;
}

/** 점 배열 + 누적 길이 */
function polyline(pts) {
  const cum = new Float32Array(pts.length);
  for (let i = 1; i < pts.length; i++) cum[i] = cum[i - 1] + pts[i].distanceTo(pts[i - 1]);
  return { pts, cum, length: cum[pts.length - 1] };
}
function sampleAt(pl, s, out, tan) {
  const { pts, cum } = pl;
  s = Math.max(0, Math.min(pl.length - 1e-3, s));
  let lo = 0, hi = pts.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; }
  const k = (s - cum[lo]) / Math.max(1e-4, cum[hi] - cum[lo]);
  out.copy(pts[lo]).lerp(pts[hi], k);
  if (tan) tan.copy(pts[hi]).sub(pts[lo]).normalize();
  return out;
}

export class Transit {
  constructor(world, quality = {}) {
    this.world = world;
    this.scene = world.scene;
    this.group = new THREE.Group();
    this.group.name = 'transit';
    this.scene.add(this.group);
    this.lights = new PointLights(this.scene, 500, { minPx: 1.8, day: 0.3 });
    this.mat = litMaterial({ vertexColors: true, vertexEmit: true, emissive: 0xffffff, emissiveIntensity: 1.4, emissiveNight: 0.7, rim: 0.5, spec: 0.8 });
    this.stations = [];
    this.supportPts = []; // 관 받침 기둥 [x, z] (도시가 비운다)
    this.lines = [];
    this.capsules = [];
    this.isOpen = () => true; // game 이 바꿔 끼움
    this.t = 0;
    this._buildRing();
    for (const L of LINES) this._buildSpoke(L);
    this._buildCapsules();
    bus.on('awaken', () => this.refresh());
    bus.on('questDone', () => this.refresh());
  }

  // ── 고리선 ──────────────────────────────
  _buildRing() {
    const juncA = LINES.map((L) => { const p = PLACE[L.to].pos; return Math.atan2(p[1], p[0]); });
    this.juncAngles = juncA;
    const pts = [];
    const N = 220;
    /** 고리 관 높이 (각 a): 갈림역 둘레에서는 땅 + 5 m (역), 그 밖은 땅 + 28 m */
    this.ringY = (a) => {
      let near = 0;
      for (const j of juncA) { const d = Math.abs(Math.atan2(Math.sin(a - j), Math.cos(a - j))); near = Math.max(near, 1 - Math.min(1, d / 0.12)); }
      const k = near * near * (3 - 2 * near);
      return heightAt(Math.cos(a) * RING_R, Math.sin(a) * RING_R) + 28 * (1 - k) + 5 * k;
    };
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * RING_R, this.ringY(a), Math.sin(a) * RING_R));
    }
    this.ring = polyline(pts);
    this.ringSOf = (a) => ((((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2)) * this.ring.length;
    this.ring.closed = true;
    this._tubeMesh(pts, 0xffd27a, true, true);
    this._supports(pts, 8);
    this._tubeCols(pts);
    // 갈림역(하모네아 쪽)
    LINES.forEach((L, i) => {
      const a = juncA[i];
      const x = Math.cos(a) * RING_R, z = Math.sin(a) * RING_R;
      this._station({ id: L.id + ':hub', name: `하모네아 ${L.name.replace('선', '')}문역`, line: L.id, hub: true, x, z, y: heightAt(x, z) + 5, dir: [-Math.sin(a), Math.cos(a)], color: 0xffd27a, ringS: this.ringSOf(a) });
    });
  }

  // ── 갈래선 ──────────────────────────────
  /**
   * 갈래선: 고리선에서 갈림역(하모네아 쪽 역) 끝을 지나 (STATION.hl + 70 m 뒤) 공중에서 바깥으로 갈라져 나와
   * 지방 역으로 간다 — 예전처럼 갈림역 옆구리를 뚫고 나가지 않는다 (v24). 끝 역에는 역의 축을 따라 곧게 들어간다.
   */
  _buildSpoke(L) {
    const P = PLACE[L.to];
    if (!P) return;
    const [cx, cz] = P.pos;
    const d = Math.hypot(cx, cz);
    const ux = cx / d, uz = cz / d;
    const sx = cx - ux * L.off, sz = cz - uz * L.off;
    const aj = Math.atan2(cz, cx) + (STATION.hl + 70) / RING_R; // 갈라지는 각 (역 끝 너머)
    const jx = Math.cos(aj) * RING_R, jz = Math.sin(aj) * RING_R, tx = -Math.sin(aj), tz = Math.cos(aj);
    // 평면 길: 갈라지는 자리에서 바깥으로 휘는 곡선 → 끝 역 160 m 앞 → 역 축을 따라 역으로
    const ex = sx - ux * 160, ez = sz - uz * 160;
    let vx = ex - jx, vz = ez - jz;
    const vl = Math.hypot(vx, vz); vx /= vl; vz /= vl;
    const c1 = [jx + Math.cos(aj) * 80, jz + Math.sin(aj) * 80], p2 = [jx + vx * 220, jz + vz * 220]; // 바깥(지름 방향)으로 떠난다 — 고리의 어느 쪽에서 와도 되돌아가지 않게
    const plan = [];
    for (let k = 0; k <= 16; k++) { const t = k / 16, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t; plan.push([a * jx + b * c1[0] + c * p2[0], a * jz + b * c1[1] + c * p2[1]]); }
    plan.push([ex, ez], [sx, sz]);
    // 고르게 30 m 마다
    const cum = [0];
    for (let i = 1; i < plan.length; i++) cum.push(cum[i - 1] + Math.hypot(plan[i][0] - plan[i - 1][0], plan[i][1] - plan[i - 1][1]));
    const len = cum[cum.length - 1];
    const N = Math.max(30, Math.round(len / 30));
    const ds = len / N;
    const xz = [];
    for (let i = 0, q = 0; i <= N; i++) {
      const s = (i / N) * len;
      while (q < cum.length - 2 && cum[q + 1] < s) q++;
      const t = (s - cum[q]) / Math.max(1e-6, cum[q + 1] - cum[q]);
      xz.push([plan[q][0] + (plan[q + 1][0] - plan[q][0]) * t, plan[q][1] + (plan[q + 1][1] - plan[q][1]) * t]);
    }
    const ground = xz.map(([x, z]) => Math.max(0, heightAt(x, z))), ys = [];
    const win = Math.max(2, Math.round(260 / ds));
    for (let i = 0; i <= N; i++) {
      let m = -1e9;
      for (let j = Math.max(0, i - win); j <= Math.min(N, i + win); j++) m = Math.max(m, ground[j]);
      ys.push(m + 36);
    }
    const sl = L.slope || 0.12, g = sl * ds;
    for (let i = 1; i <= N; i++) ys[i] = Math.max(ys[i], ys[i - 1] - g);
    for (let i = N - 1; i >= 0; i--) ys[i] = Math.max(ys[i], ys[i + 1] - g);
    // 양 끝: 갈라지는 자리는 그 자리 고리 관 높이, 끝 역은 땅 + 5
    const yA = this.ringY(aj), yB = heightAt(sx, sz) + 5;
    for (let i = 0; i <= N; i++) {
      const fromA = i * ds, fromB = (N - i) * ds;
      ys[i] = Math.min(ys[i], yA + fromA * sl * 1.2, yB + fromB * sl * 1.2);
      ys[i] = Math.max(ys[i], ground[i] + 4);
    }
    ys[0] = yA;
    for (let pass = 0; pass < 3; pass++) for (let i = 1; i < N; i++) ys[i] = (ys[i - 1] + ys[i] * 2 + ys[i + 1]) / 4;
    const pts = xz.map(([x, z], i) => new THREE.Vector3(x, ys[i], z));
    const line = { ...L, path: polyline(pts), open: true, jS: this.ringSOf(aj) };
    line.meshes = this._tubeMesh(pts, L.color, false, false);
    this._supports(pts, 5);
    this._tubeCols(pts);
    this.lines.push(line);
    this._station({ id: L.id + ':end', name: L.station, line: L.id, x: sx, z: sz, y: yB, dir: [ux, uz], color: L.color });
  }

  _tubeMesh(pts, color, closed, bright) {
    const curve = new THREE.CatmullRomCurve3(pts, closed, 'centripetal');
    const L = curve.getLength();
    const segs = Math.min(420, Math.max(40, Math.round(L / 70)));
    const glass = new THREE.Mesh(new THREE.TubeGeometry(curve, segs, 5.5, 8, closed), glowMaterial({ color: 0x9feaff, intensity: 0.32, fresnel: 1, side: THREE.DoubleSide }));
    const down = pts.map((p) => p.clone().add(_v.set(0, -6.4, 0)));
    const keelCurve = new THREE.CatmullRomCurve3(down, closed, 'centripetal');
    const keel = merge([part(new THREE.TubeGeometry(keelCurve, segs, 1.5, 4, closed), 0xece8f2, 0)]);
    const rail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => p.clone().add(_v.set(0, -4.6, 0))), closed, 'centripetal'), segs, 0.35, 3, closed), glowMaterial({ color, intensity: 1.4 }));
    const keelM = new THREE.Mesh(keel, this.mat);
    this.group.add(glass, keelM, rail);
    return { glass, rail, keel: keelM };
  }

  /** 관이 땅 가까이(밑면이 땅에서 2.4 m 안) 지나는 마디는 단단하다 — 유리관을 걸어서 뚫고 지나가지 않게 (10 m 조각마다, 그 밖은 관 밑으로 지나간다) */
  _tubeCols(pts) {
    const C = this.world.colliders;
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i], b = pts[i + 1];
      const L = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(L / 10));
      const rot = Math.atan2(-(b.z - a.z), b.x - a.x);
      for (let k = 0; k < n; k++) {
        const t0 = k / n, t1 = (k + 1) / n;
        const ax = a.x + (b.x - a.x) * t0, az = a.z + (b.z - a.z) * t0, bx = a.x + (b.x - a.x) * t1, bz = a.z + (b.z - a.z) * t1;
        const y0 = a.y + (b.y - a.y) * t0, y1 = a.y + (b.y - a.y) * t1;
        const g = Math.max(heightAt(ax, az), heightAt(bx, bz), heightAt((ax + bx) / 2, (az + bz) / 2));
        if (Math.min(y0, y1) - 5.5 > g + 2.4) continue;
        C.add({ type: 'box', x: (ax + bx) / 2, z: (az + bz) / 2, hx: L / n / 2 + 0.3, hz: 5.2, rot, y0: g - 2, y1: Math.max(y0, y1) + 5.2 });
      }
    }
  }

  _supports(pts, every) {
    const parts = [];
    for (let i = 0; i < pts.length; i += every) {
      const p = pts[i];
      const g = heightAt(p.x, p.z);
      const h = p.y - 7.6 - g;
      if (h < 4) continue;
      const base = Math.max(g, -4);
      parts.push(part(xf(lathe([[3.2, -2], [2.4, 0], [1.6, h * 0.5], [1.3, h]], 6), { x: p.x, y: base, z: p.z }), (x, y) => (y < base + 1 ? PAL.gold : 0xe8e4ee), 0));
      // 기둥은 단단하다 + 도시가 그 자리를 비운다 (cityfabric 의 피할 곳 — 건물이 기둥을 품지 않게)
      this.world.colliders.add({ type: 'cyl', x: p.x, z: p.z, r: 2.6, y0: base - 2, y1: base + 1 });
      this.world.colliders.add({ type: 'cyl', x: p.x, z: p.z, r: 1.7, y0: base + 1, y1: base + h });
      this.supportPts.push([p.x, p.z]);
      // Y 자 팔
      const nx = i + 1 < pts.length ? pts[i + 1].x - p.x : p.x - pts[i - 1].x;
      const nz = i + 1 < pts.length ? pts[i + 1].z - p.z : p.z - pts[i - 1].z;
      const yaw = Math.atan2(nx, nz);
      for (const s of [-1, 1]) parts.push(part(xf(new THREE.BoxGeometry(0.9, 6.5, 0.9), { x: p.x + Math.cos(yaw) * s * 1.6, y: p.y - 9, z: p.z - Math.sin(yaw) * s * 1.6, rz: 0, ry: yaw }), 0xe8e4ee, 0));
      parts.push(part(xf(new THREE.TorusGeometry(1.7, 0.18, 3, 8), { x: p.x, y: base + h * 0.92, z: p.z, rx: Math.PI / 2 }), PAL.teal, 1.2));
    }
    if (parts.length) { const m = new THREE.Mesh(merge(parts), this.mat); m.matrixAutoUpdate = false; this.group.add(m); }
  }

  /**
   * 역 (v24 「메인 도시 진입 통로」): 역 자리 땅은 heightfield 가 한 높이로 고른다(받침 + 앞마당 3 m). 승강장 = 그 높이.
   *  · 받침: 양쪽 승강장(옆 x 6~17 m)이 땅 속 3 m 까지 이어진 단단한 단 — 떠 있는 얇은 판이 아니다. 가운데는 관이 지나는 도랑.
   *  · 승강장 끝: 도랑 쪽에 유리 막(난간 높이)과 빛 띠, 지붕 밑동을 따라 낮은 벽(지붕 껍데기를 걸어 나가지 않게).
   *  · 지붕: 바깥·안 두 겹(안에서 올려다봐도 지붕이 보인다) + 안쪽 갈비 아치 다섯 + 양 끝 빛 아치.
   *  · 드나들기: 양 끝(노선 방향 ±37 m)이 앞마당 땅과 같은 높이 — 걸어서 들어오고 나간다. 갈래선은 역 끝 너머에서 고리와 갈라진다(역을 뚫지 않는다).
   */
  _station(S) {
    const { x, z, y } = S;
    const yaw = Math.atan2(S.dir[0], S.dir[1]);
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    const W = (lx, lz) => [x + cs * lx + sn * lz, z - sn * lx + cs * lz];
    const { hw, hl } = STATION;
    const plat = y - 5;
    const D = 3;
    const parts = [];
    const pale = 0xe6e0ee, stone = 0xd8d2e2;
    // 받침 (승강장 둘) + 앞 가장자리 돌림띠
    for (const s of [-1, 1]) {
      parts.push(part(xf(new THREE.BoxGeometry(hw - 6, D, hl * 2), { x: s * (6 + (hw - 6) / 2), y: plat - D / 2 }), pale, 0));
      parts.push(part(xf(new THREE.BoxGeometry(0.35, 0.03, hl * 2 - 3), { x: s * 6.7, y: plat + 0.015 }), S.color, 1.6));
      // 도랑 쪽 유리 막 + 빛 손잡이 (양 끝 1.5 m 는 비움 — 승강장 끝으로 걸어 들어오는 자리)
      parts.push(part(xf(new THREE.BoxGeometry(0.08, 1.2, hl * 2 - 3), { x: s * 6.08, y: plat + 0.6 }), 0xcff4ff, 0.25));
      parts.push(part(xf(new THREE.BoxGeometry(0.12, 0.08, hl * 2 - 3), { x: s * 6.08, y: plat + 1.24 }), S.color, 1.4));
      // 지붕 밑동: 낮은 벽 (받침 가장자리)
      parts.push(part(xf(new THREE.BoxGeometry(0.6, 1.1, hl * 2), { x: s * (hw - 0.3), y: plat + 0.55 }), stone, 0));
    }
    // 관 도랑 바닥
    parts.push(part(xf(new THREE.BoxGeometry(12, 0.5, hl * 2), { y: plat - 0.7 }), 0x9a96aa, 0)); // 윗면 plat − 0.45 (보통 걸음으로 오르내리는 높이)
    // 지붕: 바깥 껍데기 + 안쪽 껍데기(뒤집은 면) + 갈비 아치 + 양 끝 빛 아치
    // (예전 지붕은 옆으로 누운 반원통이라 반은 땅에 묻히고 한쪽 옆만 덮었다 — 축을 노선 방향(z)으로, 호는 위로)
    const roof = new THREE.CylinderGeometry(hw, hw, hl * 2, 28, 1, true, Math.PI / 2, Math.PI).rotateX(Math.PI / 2);
    parts.push(part(xf(roof, { y: plat }), (px, py) => (py > y + 10.5 ? PAL.gold : 0xf2eef6), (px, py) => (py > y + 11.3 ? 1.0 : 0), -3.4));
    const inner = new THREE.CylinderGeometry(hw - 0.25, hw - 0.25, hl * 2, 28, 1, true, Math.PI / 2, Math.PI).rotateX(Math.PI / 2);
    parts.push(flipFaces(part(xf(inner, { y: plat }), 0xe9e4f0, 0)));
    for (const zz of [-27, -13.5, 0, 13.5, 27]) parts.push(part(xf(new THREE.TorusGeometry(hw - 0.4, 0.22, 4, 28, Math.PI), { y: plat, z: zz }), 0xd8d2e4, 0.05));
    for (const zz of [-(hl - 1), hl - 1]) {
      parts.push(part(xf(new THREE.TorusGeometry(hw, 0.55, 5, 28, Math.PI), { y: plat, z: zz }), S.color, 1.5));
      for (const s of [-1, 1]) parts.push(part(xf(new THREE.BoxGeometry(1.6, 0.5, 1.6), { x: s * (hw - 0.3), y: plat + 0.25, z: zz }), stone, 0)); // 아치 발
    }
    const pm = new THREE.Mesh(merge(parts.map((p) => xf(p, { x, z, ry: yaw }))), this.mat);
    pm.matrixAutoUpdate = false;
    this.group.add(pm);
    // 표지 홀로그램 (역 이름 글자)
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(20, 4.2), hologramMaterial({ color: S.color, color2: 0xffffff, intensity: 1.3, scroll: 0.01, repeat: [0.4, 1], seed: Math.floor(Math.abs(x + z)) }));
    sign.position.set(x, y + 9, z);
    sign.rotation.y = yaw + Math.PI / 2;
    this.group.add(sign);
    // 충돌: 받침(걷는 면) · 유리 막 · 지붕 밑동 벽 · 도랑 바닥
    const C = this.world.colliders;
    for (const s of [-1, 1]) {
      const [px, pz] = W(s * (6 + (hw - 6) / 2), 0);
      C.add({ type: 'box', x: px, z: pz, hx: (hw - 6) / 2, hz: hl, rot: yaw, y0: plat - D, y1: plat, walk: true });
      const [gx, gz] = W(s * 6.08, 0);
      C.add({ type: 'box', x: gx, z: gz, hx: 0.06, hz: hl - 1.5, rot: yaw, y0: plat - 0.3, y1: plat + 1.28 });
      const [wx, wz] = W(s * (hw - 0.3), 0);
      C.add({ type: 'box', x: wx, z: wz, hx: 0.3, hz: hl, rot: yaw, y0: plat - 0.3, y1: plat + 6 });
    }
    C.add({ type: 'box', x, z, hx: 6, hz: hl, rot: yaw, y0: plat - 1.1, y1: plat - 0.45, walk: true });
    // 식물이 받침·앞마당을 뚫고 자라지 않게
    this.world.clearZones.push({ x, z, r: Math.hypot(hw, hl) + STATION.apron });
    for (let k = 0; k < 6; k++) { const [lx, lz] = W(10.5, -30 + k * 12); this.lights.add(lx, plat + 0.4, lz, S.color, 4, 0, 0); }
    S.platY = plat;
    S.sign = sign;
    S.ends = [-1, 1].map((e) => ({ e, sides: [-1, 1].map((s) => W(s * 11, e * (hl + STATION.apron + 2))) })); // 드나드는 자리 (검사 도구)
    S.W = W;
    this.stations.push(S);
  }

  // ── 캡슐 ──────────────────────────────
  _buildCapsules() {
    const parts = [];
    const body = lathe([[0.0001, -9], [1.8, -8.2], [2.6, -6], [2.8, 0], [2.6, 6], [1.6, 8.6], [0.0001, 9.4]], 12);
    body.rotateX(Math.PI / 2);
    parts.push(part(body, (x, y) => (y > 1.2 ? 0x2c4c66 : PAL.pearl), (x, y) => (Math.abs(y - 0.6) < 0.5 ? 1.5 : 0)));
    for (const z of [-6, 6]) parts.push(part(xf(new THREE.TorusGeometry(2.9, 0.22, 4, 16), { z }), PAL.teal, 1.8));
    this.capGeo = merge(parts);
    const max = 24;
    this.capMesh = new THREE.InstancedMesh(this.capGeo, this.mat, max);
    this.capMesh.frustumCulled = false;
    this.capMesh.count = 0;
    this.scene.add(this.capMesh);
    const add = (path, closed, s, speed, line) => {
      const c = { path, closed, s, speed, v: 0, dir: 1, dwell: 0, idx: this.capMesh.count++, line, light: this.lights.add(0, -1e5, 0, 0xffffff, 6, 0, 0) };
      this.capsules.push(c);
    };
    for (let i = 0; i < 4; i++) add(this.ring, true, (i / 4) * this.ring.length, 160, null);
    for (const L of this.lines) for (let i = 0; i < 2; i++) add(L.path, false, i ? L.path.length : 0, 420, L);
    // 탈 때 쓰는 캡슐 (따로)
    this.rideCap = new THREE.Mesh(this.capGeo, this.mat);
    this.rideCap.visible = false;
    this.scene.add(this.rideCap);
  }

  /** 노선 열림 상태 다시 계산 */
  refresh() {
    for (const L of this.lines) {
      L.open = this.isOpen(L.unlock);
      L.meshes.glass.material.uniforms.uIntensity.value = L.open ? 0.32 : 0.12;
      L.meshes.rail.material.uniforms.uIntensity.value = L.open ? 1.4 : 0.15;
    }
    for (const S of this.stations) {
      const L = this.lines.find((l) => l.id === S.line);
      S.open = S.hub || !L || L.open;
      S.sign.visible = S.open;
    }
  }

  station(id) { return this.stations.find((s) => s.id === id); }

  /** 가까운 역 (승강장 위) */
  nearest(pos, r = 14) {
    let best = null, bd = r * r;
    for (const S of this.stations) {
      const d = (S.x - pos.x) ** 2 + (S.z - pos.z) ** 2;
      if (d < bd && Math.abs(pos.y - S.platY) < 4) { bd = d; best = S; }
    }
    return best;
  }

  /** 역 A → 역 B 의 경로 (점 배열) */
  routeBetween(A, B) {
    const pts = [];
    const lineOf = (S) => this.lines.find((l) => l.id === S.line);
    const spoke = (S) => lineOf(S).path.pts;
    // A → 고리: 갈래선 끝 역이면 갈래를 거꾸로 타고 갈라지는 자리(jS)까지, 갈림역이면 그 역 자리에서 고리를 탄다
    if (!A.hub) pts.push(...spoke(A).slice().reverse());
    const sA = A.hub ? A.ringS : lineOf(A).jS, sB = B.hub ? B.ringS : lineOf(B).jS;
    if (Math.abs(sA - sB) > 1) {
      const R = this.ring, L = R.length;
      const hA = { ringS: sA }, hB = { ringS: sB };
      let d = hB.ringS - hA.ringS;
      if (d > L / 2) d -= L; if (d < -L / 2) d += L;
      const n = Math.max(2, Math.round(Math.abs(d) / 40));
      for (let i = 0; i <= n; i++) {
        let s = hA.ringS + (d * i) / n;
        s = ((s % L) + L) % L;
        pts.push(sampleAt(R, s, new THREE.Vector3()));
      }
    }
    if (!B.hub) pts.push(...spoke(B));
    // 너무 가까운 점 정리
    const out = [pts[0]];
    for (const p of pts) if (p.distanceTo(out[out.length - 1]) > 4) out.push(p);
    return polyline(out);
  }

  /** 타기: 플레이어를 실어 나르는 ride 객체를 돌려준다 */
  makeRide(A, B, onArrive) {
    const path = this.routeBetween(A, B);
    const cap = this.rideCap;
    cap.visible = true;
    const P = new THREE.Vector3(), T = new THREE.Vector3();
    const ride = {
      s: 0, v: 0, path, done: false, cam: { pos: new THREE.Vector3(), look: new THREE.Vector3() }, from: A, to: B,
      step: (dt, player) => {
        const L = path.length;
        const remain = L - ride.s;
        const vmax = 650;
        const brake = Math.sqrt(Math.max(0, 2 * 55 * remain));
        ride.v = Math.min(vmax, ride.v + 55 * dt, brake + 4);
        ride.s = Math.min(L, ride.s + ride.v * dt);
        sampleAt(path, ride.s, P, T);
        cap.position.copy(P);
        cap.lookAt(_v.copy(P).add(T));
        player.pos.set(P.x, P.y - 1.2, P.z);
        player.yaw = Math.atan2(T.x, T.z);
        player.vel.copy(T).multiplyScalar(ride.v);
        // 따라가는 카메라: 캡슐 뒤 위에서
        // 관 밖 비스듬히 위에서 (안에서 보면 유리가 화면을 뿌옇게 가린다)
        const back = Math.min(34, 20 + ride.v * 0.02);
        const sx = -T.z, sz = T.x;
        ride.cam.pos.set(P.x - T.x * back + sx * 7, P.y + 11 - T.y * back, P.z - T.z * back + sz * 7);
        ride.cam.look.set(P.x + T.x * 60, P.y + T.y * 60 - 2, P.z + T.z * 60);
        if (ride.s >= L - 0.5) {
          ride.done = true;
          cap.visible = false;
          // 승강장 옆에 내린다
          const S = B;
          const cs = Math.cos(Math.atan2(S.dir[0], S.dir[1]));
          const sn = Math.sin(Math.atan2(S.dir[0], S.dir[1]));
          player.pos.set(S.x - cs * 10.5, S.platY, S.z + sn * 10.5); // 승강장 −x 쪽 (갈림역의 +x 쪽은 갈래 관이 가운데를 지난다)
          player.vel.set(0, 0, 0);
          onArrive && onArrive(S);
        }
        return ride;
      },
      skip: () => { ride.s = Math.max(ride.s, path.length - 600); ride.v = Math.min(ride.v, 200); },
    };
    return ride;
  }

  update(dt, ctx) {
    this.t += dt;
    const m4 = this._m4 || (this._m4 = new THREE.Matrix4());
    const q = this._q || (this._q = new THREE.Quaternion());
    const one = this._one || (this._one = new THREE.Vector3(1, 1, 1));
    const P = this._P || (this._P = new THREE.Vector3());
    const T = this._T || (this._T = new THREE.Vector3());
    const fwd = this._F || (this._F = new THREE.Vector3(0, 0, 1));
    for (const c of this.capsules) {
      const L = c.path.length;
      const open = !c.line || c.line.open;
      if (!open) { m4.makeScale(0, 0, 0); this.capMesh.setMatrixAt(c.idx, m4); this.lights.set(c.light, 0, -1e5, 0); continue; }
      if (c.closed) { c.s = (c.s + c.speed * dt) % L; sampleAt(c.path, c.s, P, T); }
      else {
        if (c.dwell > 0) { c.dwell -= dt; c.v = 0; }
        else {
          const remain = c.dir > 0 ? L - c.s : c.s;
          const brake = Math.sqrt(Math.max(0, 2 * 45 * remain));
          c.v = Math.min(c.speed, c.v + 45 * dt, brake + 3);
          c.s += c.v * c.dir * dt;
          if (c.s >= L) { c.s = L; c.dir = -1; c.dwell = 8; }
          if (c.s <= 0) { c.s = 0; c.dir = 1; c.dwell = 8; }
        }
        sampleAt(c.path, c.s, P, T);
        if (c.dir < 0) T.negate();
      }
      q.setFromUnitVectors(fwd, T);
      m4.compose(P, q, one);
      this.capMesh.setMatrixAt(c.idx, m4);
      this.lights.set(c.light, P.x + T.x * 9, P.y, P.z + T.z * 9);
    }
    this.capMesh.instanceMatrix.needsUpdate = true;
    this.lights.update();
  }
}
