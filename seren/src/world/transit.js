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

const PAL = A.PAL;
const RING_R = 1600;

export const LINES = [
  { id: 'l-meadow', name: '들판선', station: '이슬터역', to: 'dewfold', off: 200, unlock: 'quest:mq2', color: 0x7ff3e6 },
  { id: 'l-glass', name: '황야선', station: '윤슬역', to: 'yunseul', off: 170, unlock: 'glass-pylon', color: 0xff9be0 },
  { id: 'l-bloom', name: '숲선', station: '갓마을역', to: 'gatmaeul', off: 500, unlock: 'bloom-pylon', color: 0x6dfcd0 },
  { id: 'l-canyon', name: '협곡선', station: '떠돌섬역', to: 'tteodol', off: 700, unlock: 'canyon-pylon', color: 0xffc86a },
  { id: 'l-frost', name: '첨봉선', station: '별듣는역', to: 'observatory', off: 40, unlock: 'frost-pylon', color: 0xa8c8ff, slope: 0.2 },
  { id: 'l-sea', name: '바다선', station: '물노래역', to: 'mulnorae', off: 420, unlock: 'sea-pylon', color: 0x7ff0ff },
];

const _v = new THREE.Vector3();

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
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2;
      let near = 0;
      for (const j of juncA) { const d = Math.abs(Math.atan2(Math.sin(a - j), Math.cos(a - j))); near = Math.max(near, 1 - Math.min(1, d / 0.12)); }
      const x = Math.cos(a) * RING_R, z = Math.sin(a) * RING_R;
      const g = heightAt(x, z);
      const k = near * near * (3 - 2 * near);
      pts.push(new THREE.Vector3(x, g + 28 * (1 - k) + 5 * k, z));
    }
    this.ring = polyline(pts);
    this.ring.closed = true;
    this._tubeMesh(pts, 0xffd27a, true, true);
    this._supports(pts, 6);
    // 갈림역(하모네아 쪽)
    LINES.forEach((L, i) => {
      const a = juncA[i];
      const x = Math.cos(a) * RING_R, z = Math.sin(a) * RING_R;
      this._station({ id: L.id + ':hub', name: `하모네아 ${L.name.replace('선', '')}문역`, line: L.id, hub: true, x, z, y: heightAt(x, z) + 5, dir: [-Math.sin(a), Math.cos(a)], color: 0xffd27a, ringS: (a < 0 ? a + Math.PI * 2 : a) / (Math.PI * 2) * this.ring.length });
    });
  }

  // ── 갈래선 ──────────────────────────────
  _buildSpoke(L) {
    const P = PLACE[L.to];
    if (!P) return;
    const [cx, cz] = P.pos;
    const d = Math.hypot(cx, cz);
    const ux = cx / d, uz = cz / d;
    const sx = cx - ux * L.off, sz = cz - uz * L.off;
    const x0 = ux * RING_R, z0 = uz * RING_R;
    const len = Math.hypot(sx - x0, sz - z0);
    const N = Math.max(30, Math.round(len / 40));
    const ds = len / N;
    const ground = [], ys = [];
    for (let i = 0; i <= N; i++) { const t = i / N; ground.push(Math.max(0, heightAt(x0 + (sx - x0) * t, z0 + (sz - z0) * t))); }
    const win = Math.max(2, Math.round(260 / ds));
    for (let i = 0; i <= N; i++) {
      let m = -1e9;
      for (let j = Math.max(0, i - win); j <= Math.min(N, i + win); j++) m = Math.max(m, ground[j]);
      ys.push(m + 36);
    }
    const g = (L.slope || 0.12) * ds;
    for (let i = 1; i <= N; i++) ys[i] = Math.max(ys[i], ys[i - 1] - g);
    for (let i = N - 1; i >= 0; i--) ys[i] = Math.max(ys[i], ys[i + 1] - g);
    // 양 끝은 역 높이로 (지면 + 5)
    const yA = heightAt(x0, z0) + 5, yB = heightAt(sx, sz) + 5;
    for (let i = 0; i <= N; i++) {
      const fromA = i * ds, fromB = (N - i) * ds;
      ys[i] = Math.min(ys[i], yA + fromA * (L.slope || 0.12) * 1.2, yB + fromB * (L.slope || 0.12) * 1.2);
      ys[i] = Math.max(ys[i], ground[i] + 4);
    }
    for (let pass = 0; pass < 3; pass++) for (let i = 1; i < N; i++) ys[i] = (ys[i - 1] + ys[i] * 2 + ys[i + 1]) / 4;
    const pts = [];
    for (let i = 0; i <= N; i++) { const t = i / N; pts.push(new THREE.Vector3(x0 + (sx - x0) * t, ys[i], z0 + (sz - z0) * t)); }
    const line = { ...L, path: polyline(pts), open: true };
    line.meshes = this._tubeMesh(pts, L.color, false, false);
    this._supports(pts, 3);
    this.lines.push(line);
    this._station({ id: L.id + ':end', name: L.station, line: L.id, x: sx, z: sz, y: yB, dir: [ux, uz], color: L.color });
  }

  _tubeMesh(pts, color, closed, bright) {
    const curve = new THREE.CatmullRomCurve3(pts, closed, 'centripetal');
    const L = curve.getLength();
    const segs = Math.min(1600, Math.max(60, Math.round(L / 30)));
    const glass = new THREE.Mesh(new THREE.TubeGeometry(curve, segs, 5.5, 10, closed), glowMaterial({ color: 0x9feaff, intensity: 0.32, fresnel: 1, side: THREE.DoubleSide }));
    const down = pts.map((p) => p.clone().add(_v.set(0, -6.4, 0)));
    const keelCurve = new THREE.CatmullRomCurve3(down, closed, 'centripetal');
    const keel = merge([part(new THREE.TubeGeometry(keelCurve, segs, 1.5, 6, closed), 0xece8f2, 0)]);
    const rail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => p.clone().add(_v.set(0, -4.6, 0))), closed, 'centripetal'), segs, 0.35, 4, closed), glowMaterial({ color, intensity: 1.4 }));
    const keelM = new THREE.Mesh(keel, this.mat);
    this.group.add(glass, keelM, rail);
    return { glass, rail, keel: keelM };
  }

  _supports(pts, every) {
    const parts = [];
    for (let i = 0; i < pts.length; i += every) {
      const p = pts[i];
      const g = heightAt(p.x, p.z);
      const h = p.y - 7.6 - g;
      if (h < 4) continue;
      const base = Math.max(g, -4);
      parts.push(part(xf(lathe([[3.2, -2], [2.4, 0], [1.6, h * 0.5], [1.3, h]], 8), { x: p.x, y: base, z: p.z }), (x, y) => (y < base + 1 ? PAL.gold : 0xe8e4ee), 0));
      // Y 자 팔
      const nx = i + 1 < pts.length ? pts[i + 1].x - p.x : p.x - pts[i - 1].x;
      const nz = i + 1 < pts.length ? pts[i + 1].z - p.z : p.z - pts[i - 1].z;
      const yaw = Math.atan2(nx, nz);
      for (const s of [-1, 1]) parts.push(part(xf(new THREE.BoxGeometry(0.9, 6.5, 0.9), { x: p.x + Math.cos(yaw) * s * 1.6, y: p.y - 9, z: p.z - Math.sin(yaw) * s * 1.6, rz: 0, ry: yaw }), 0xe8e4ee, 0));
      parts.push(part(xf(new THREE.TorusGeometry(1.7, 0.18, 4, 12), { x: p.x, y: base + h * 0.92, z: p.z, rx: Math.PI / 2 }), PAL.teal, 1.2));
    }
    if (parts.length) { const m = new THREE.Mesh(merge(parts), this.mat); m.matrixAutoUpdate = false; this.group.add(m); }
  }

  _station(S) {
    const { x, z, y } = S;
    const yaw = Math.atan2(S.dir[0], S.dir[1]);
    const parts = [];
    const g = heightAt(x, z);
    // 승강장: 관 양옆
    for (const s of [-1, 1]) {
      parts.push(part(xf(new THREE.BoxGeometry(9, 1.2, 70), { x: s * 10.5, y: y - 5.6 }), 0xe6e0ee, 0));
      parts.push(part(xf(new THREE.BoxGeometry(0.4, 0.2, 70), { x: s * 6.2, y: y - 4.95 }), S.color, 1.6));
      if (y - 6.2 - g > 0.5) parts.push(part(xf(new THREE.BoxGeometry(8, y - 6.2 - g + 2, 66), { x: s * 10.5, y: (y - 6.2 + g - 2) / 2 }), 0xd8d2e2, 0));
    }
    // 지붕: 진주빛 아치
    const roof = new THREE.CylinderGeometry(17, 17, 74, 24, 1, true, -Math.PI / 2, Math.PI);
    roof.rotateZ(Math.PI / 2);
    roof.rotateY(Math.PI / 2);
    parts.push(part(xf(roof, { y: y - 5 }), (px, py) => (py > y + 10.5 ? PAL.gold : 0xf2eef6), (px, py) => (py > y + 11.3 ? 1.0 : 0), -3.4));
    for (const zz of [-36, 36]) parts.push(part(xf(new THREE.TorusGeometry(17, 0.5, 4, 24, Math.PI), { y: y - 5, z: zz }), S.color, 1.5));
    // 계단 (승강장 → 땅)
    const plat = y - 5;
    if (plat - g > 1.5) {
      const steps = Math.ceil((plat - g) / 0.5);
      for (const s of [-1, 1]) for (let k = 0; k < Math.min(steps, 30); k++) parts.push(part(xf(new THREE.BoxGeometry(4, 0.5, 1.2), { x: s * 17, y: plat - 0.25 - k * 0.5, z: -30 + k * 1.2 }), 0xe6e0ee, 0));
    }
    const pm = new THREE.Mesh(merge(parts.map((p) => xf(p, { x, z, ry: yaw }))), this.mat);
    pm.matrixAutoUpdate = false;
    this.group.add(pm);
    // 표지 홀로그램 (역 이름 글자)
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(20, 4.2), hologramMaterial({ color: S.color, color2: 0xffffff, intensity: 1.3, scroll: 0.01, repeat: [0.4, 1], seed: Math.floor(Math.abs(x + z)) }));
    sign.position.set(x, y + 9, z);
    sign.rotation.y = yaw + Math.PI / 2;
    this.group.add(sign);
    // 충돌: 승강장 + 계단
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    for (const s of [-1, 1]) {
      const px = x + cs * s * 10.5, pz = z - sn * s * 10.5;
      this.world.colliders.add({ type: 'box', x: px, z: pz, hx: 4.5, hz: 35, rot: yaw, y0: Math.min(g, plat) - 3, y1: plat });
      if (plat - g > 1.5) {
        const sx = x + cs * s * 17, sz = z - sn * s * 17;
        const L = Math.min(30, Math.ceil((plat - g) / 0.5)) * 1.2;
        // 경사로: 로컬 x 가 길이 방향이 되도록 회전을 90° 돌림
        const rot = yaw + Math.PI / 2;
        const cx2 = sx + Math.sin(yaw) * (-30 + L / 2), cz2 = sz + Math.cos(yaw) * (-30 + L / 2);
        this.world.colliders.add({ type: 'ramp', x: cx2, z: cz2, hx: L / 2, hz: 2, rot, y0: g - 2, y1: plat - (L / 1.2) * 0.5, y1b: plat });
      }
    }
    for (let k = 0; k < 6; k++) this.lights.add(x + Math.sin(yaw) * (-30 + k * 12), plat + 0.4, z + Math.cos(yaw) * (-30 + k * 12), S.color, 4, 0, 0);
    S.platY = plat;
    S.sign = sign;
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
    const spoke = (S) => this.lines.find((l) => l.id === S.line).path.pts;
    const hubOf = (S) => this.stations.find((s) => s.id === S.line + ':hub');
    // A → 고리
    if (!A.hub) pts.push(...spoke(A).slice().reverse());
    const hA = A.hub ? A : hubOf(A), hB = B.hub ? B : hubOf(B);
    if (hA !== hB) {
      const R = this.ring, L = R.length;
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
          player.pos.set(S.x + cs * 10.5, S.platY, S.z - sn * 10.5);
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
