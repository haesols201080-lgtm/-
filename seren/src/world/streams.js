// 흐르는 차: 도시의 거리와 지붕 위 하늘 차선을 따라 수천 대의 호버 차가 끊임없이 흐른다.
// 차선(닫힌 경로)마다 256 점을 부동소수 텍스처 한 줄에 담고, 차는 「몇 번 차선의 어디쯤, 얼마나 빨리」만 가진다.
// 위치·방향은 정점 셰이더가 매 프레임 계산 — CPU 는 시간 하나만 넘긴다. 멀리 있는 차는 조금 크게 그려
// 밤에는 빛의 강처럼 보인다. 그리기 1회.
import * as THREE from 'three';
import { heightAt } from './heightfield.js';
import { mulberry32 } from '../core/noise.js';
import { part, merge, xf } from './geo-utils.js';
import { CURVE_GLSL, ATMOS_PARS, NOISE_GLSL } from './shaders.js';
import { atmosUniforms } from './atmosphere.js';
import { DISTRICTS } from './megacity.js';

const NS = 256; // 차선당 점 수
const TAU = Math.PI * 2;

const vert = /* glsl */ `
${CURVE_GLSL}
uniform sampler2D uLanes;
uniform float uT;
uniform float uFar;
uniform float uNearHide;
uniform vec4 uAvoid; // 플레이어 (x, y, z, 켜짐) — 호버 차는 그 위로 비켜 오른다
uniform vec2 uScale; // 멀수록 크게: (거리당 배율, 최대) — 위에서 내려다봐도 흐름이 읽히게
attribute vec4 aPod;   // 차선 번호, 시작 위치(0..1), 속도(1/초), 옆 간격(m)
attribute vec3 aTint;
attribute vec3 aVCol;
attribute float aEmit;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vColor;
varying float vEmit;
void main() {
  int L = int(aPod.x + 0.5);
  float u = fract(aPod.y + uT * aPod.z);
  float fi = u * ${NS}.0;
  int i0 = int(floor(fi));
  float f = fi - float(i0);
  int i1 = i0 + 1;
  if (i1 >= ${NS}) i1 = 0;
  vec3 p0 = texelFetch(uLanes, ivec2(i0, L), 0).xyz;
  vec3 p1 = texelFetch(uLanes, ivec2(i1, L), 0).xyz;
  vec3 P = mix(p0, p1, f);
  vec3 F = p1 - p0;
  float fl = length(F);
  F = fl > 1e-3 ? F / fl : vec3(0.0, 0.0, 1.0);
  vec3 Rt = normalize(cross(F, vec3(0.0, 1.0, 0.0)) + vec3(1e-4, 0.0, 0.0));
  vec3 U = cross(Rt, F);
  P += Rt * aPod.w;
  P.y += sin(uT * 1.7 + aPod.y * 61.0) * 0.25;
  float d = distance(P, cameraPosition);
  if (d > uFar) { gl_Position = vec4(0.0, 0.0, -2.0, 1.0); return; }
#ifdef WALK
  // 걷는 사람: 크기 그대로, 걸음에 맞춰 살짝 들썩. 가까이(주민이 직접 다니는 곳)는 그리지 않는다
  if (d < uNearHide) { gl_Position = vec4(0.0, 0.0, -2.0, 1.0); return; }
  float s = clamp(d * uScale.x, 1.0, uScale.y);
  P.y += abs(sin(uT * 5.2 + aPod.y * 97.0)) * 0.07 - 0.25 * sin(uT * 1.7 + aPod.y * 61.0);
#else
  float s = clamp(d * uScale.x, 1.0, uScale.y);
  float da = length(P.xz - uAvoid.xz);
  P.y += uAvoid.w * (1.0 - smoothstep(2.0, 7.0, da)) * (1.0 - smoothstep(4.0, 9.0, abs(P.y - uAvoid.y))) * 2.6;
#endif
  vec3 wp = P + (Rt * position.x + U * position.y + F * position.z) * s;
  vWorld = wp;
  vNormal = normalize(Rt * normal.x + U * normal.y + F * normal.z);
  vColor = aVCol * mix(vec3(1.0), aTint, step(aEmit, 0.01));
  vEmit = aEmit;
  gl_Position = projectionMatrix * viewMatrix * vec4(curveWorld(wp), 1.0);
}`;

const frag = /* glsl */ `
${NOISE_GLSL}
${ATMOS_PARS}
varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vColor;
varying float vEmit;
void main() {
  vec3 N = normalize(vNormal);
  if (!gl_FrontFacing) N = -N;
  vec3 col = shadeLit(vColor, N, 1.0);
  vec3 V = normalize(cameraPosition - vWorld);
  col += vec3(0.85, 0.92, 1.0) * pow(clamp(1.0 - dot(N, V), 0.0, 1.0), 3.0) * 0.35;
  float litL = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col *= 1.0 / (1.0 + max(litL - 0.72, 0.0) * 1.15);
  col += vColor * vEmit * (0.7 + uGlow * 2.2);
  col = applyFog(col, vWorld);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/** 호버 차 한 대 (길이 약 4.4 m, +Z 가 앞, 삼각형 14개) */
function podGeo() {
  const g = merge([
    part(xf(new THREE.OctahedronGeometry(1, 0), { sx: 0.8, sy: 0.36, sz: 2.2 }), 0xf2eef8, 0),
    part(xf(new THREE.PlaneGeometry(1.0, 0.2), { y: 0.02, z: 1.6 }), 0xffffff, 2.4), // 앞등
    part(xf(new THREE.PlaneGeometry(1.2, 0.22), { y: 0.04, z: -1.6, ry: Math.PI }), 0xff5a6a, 2.2), // 뒷등
    part(xf(new THREE.PlaneGeometry(1.1, 2.6), { y: -0.38, rx: Math.PI / 2 }), 0x7ff3e6, 1.6), // 바닥 빛
  ]);
  // part() 의 color/emit 를 셰이더 이름으로
  g.setAttribute('aVCol', g.attributes.color);
  g.setAttribute('aEmit', g.attributes.emit);
  g.deleteAttribute('color');
  g.deleteAttribute('emit');
  return g;
}

/** 빛 궤도 전차 (길이 약 16 m): 둥근 몸통 + 양옆 창 띠 + 앞뒤 등 + 궤도 빛 */
function tramGeo() {
  const g = merge([
    part(xf(new THREE.CapsuleGeometry(1.25, 13, 3, 8), { rx: Math.PI / 2, sy: 0.9 }), 0xf2eef8, 0),
    part(xf(new THREE.BoxGeometry(0.06, 0.55, 11.5), { x: 1.16, y: 0.25 }), 0x9ff6ff, 1.3),
    part(xf(new THREE.BoxGeometry(0.06, 0.55, 11.5), { x: -1.16, y: 0.25 }), 0x9ff6ff, 1.3),
    part(xf(new THREE.PlaneGeometry(1.4, 0.3), { y: 0.1, z: 7.85 }), 0xffffff, 2.4),
    part(xf(new THREE.PlaneGeometry(1.4, 0.3), { y: 0.1, z: -7.85, ry: Math.PI }), 0xff5a6a, 2.0),
    part(xf(new THREE.PlaneGeometry(1.2, 13), { y: -1.15, rx: Math.PI / 2 }), 0x7ff3e6, 1.8),
  ]);
  g.setAttribute('aVCol', g.attributes.color); g.setAttribute('aEmit', g.attributes.emit);
  g.deleteAttribute('color'); g.deleteAttribute('emit');
  return g;
}

/** 짐 드론 (폭 약 3 m): 짐 상자 + 네 날개 고리 + 아래 빛 */
function droneGeo() {
  const parts = [
    part(xf(new THREE.BoxGeometry(1.4, 0.9, 1.8), { y: -0.5 }), 0xd8c9a8, 0),
    part(xf(new THREE.BoxGeometry(1.6, 0.25, 2.0), { y: 0.05 }), 0xeae6f0, 0),
    part(xf(new THREE.PlaneGeometry(1.0, 1.4), { y: -0.97, rx: Math.PI / 2 }), 0xffc46a, 1.8),
  ];
  for (const [x, z] of [[1.3, 1.3], [-1.3, 1.3], [1.3, -1.3], [-1.3, -1.3]]) parts.push(part(xf(new THREE.TorusGeometry(0.55, 0.06, 3, 10), { x, y: 0.12, z, rx: Math.PI / 2 }), 0x7ff3e6, 1.2));
  const g = merge(parts);
  g.setAttribute('aVCol', g.attributes.color); g.setAttribute('aEmit', g.attributes.emit);
  g.deleteAttribute('color'); g.deleteAttribute('emit');
  return g;
}

/** 멀리 다니는 아웬 (가까운 주민과 같은 키 약 3 m, 땅에서 조금 떠 있다): 긴 옷자락 몸, 어깨, 머리, 빛나는 띠 */
function walkerGeo() {
  const g = merge([
    part(new THREE.CylinderGeometry(0.13, 0.36, 1.25, 6, 1, true).translate(0, 0.62, 0), 0xf0ecf4, 0),
    part(new THREE.OctahedronGeometry(0.26, 0).scale(1.15, 0.7, 0.85).translate(0, 1.3, 0), 0xf0ecf4, 0),
    part(new THREE.OctahedronGeometry(0.17, 0).scale(0.85, 1.2, 0.9).translate(0, 1.64, 0.02), 0xf6f2f8, 0),
    part(new THREE.CylinderGeometry(0.235, 0.235, 0.06, 6, 1, true).translate(0, 1.0, 0), 0x7ff3e6, 2.2),
    part(new THREE.OctahedronGeometry(0.05, 0).translate(0, 1.95, 0.02), 0xffd27a, 2.6),
  ]);
  g.scale(1.5, 1.5, 1.5);
  g.translate(0, 0.3, 0);
  g.setAttribute('aVCol', g.attributes.color);
  g.setAttribute('aEmit', g.attributes.emit);
  g.deleteAttribute('color');
  g.deleteAttribute('emit');
  return g;
}

export class Streams {
  constructor(world, city, q = {}) {
    this.world = world;
    this.city = city;
    const f = q.flora ?? 0.9;
    this.cap = f < 0.5 ? 2500 : f < 0.7 ? 5000 : f < 1 ? 8000 : 11000; // 한 번에 그리는 차 수 상한
    this.reach = f < 0.5 ? 2600 : 4200; // 카메라에서 이 거리 안의 차선에만 차를 올린다
    this.wcap = f < 0.5 ? 500 : f < 0.7 ? 1200 : f < 1 ? 2000 : 3000; // 걷는 사람 수 상한
    this.wreach = f < 0.5 ? 260 : 420;
    this.lanes = []; // { pts: [x,y,z,1]*NS, len, kind, w(교통량), cx, cz, rad }
    this.t = 0;
    const rnd = mulberry32(4242);
    for (const Z of city.zones) {
      this._w = Z.traffic ?? (Z.id.startsWith('cap') ? 1 : Z.id.startsWith('dist') ? 0.7 : Z.id.startsWith('town') ? 0.4 : 0.28);
      if (Z.lanes) this._groundLanes(Z);
      if (Z.sky) this._skyLanes(Z, rnd);
      this._lifeLanes(Z, rnd);
    }
    this._w = 0.9;
    this._highways();
    this._build(rnd);
  }

  /** 닫힌 경로 하나 (fn(t: 0..1) → [x, y, z]) */
  _lane(fn, kind) {
    const pts = new Float32Array(NS * 4);
    let len = 0, px = 0, py = 0, pz = 0;
    for (let i = 0; i < NS; i++) {
      const [x, y, z] = fn(i / NS);
      pts[i * 4] = x; pts[i * 4 + 1] = y; pts[i * 4 + 2] = z; pts[i * 4 + 3] = 1;
      if (i) len += Math.hypot(x - px, y - py, z - pz);
      px = x; py = y; pz = z;
    }
    len += Math.hypot(pts[0] - px, pts[1] - py, pts[2] - pz);
    let cx = 0, cz = 0;
    for (let i = 0; i < NS; i++) { cx += pts[i * 4]; cz += pts[i * 4 + 2]; }
    cx /= NS; cz /= NS;
    let rad = 0;
    for (let i = 0; i < NS; i++) rad = Math.max(rad, Math.hypot(pts[i * 4] - cx, pts[i * 4 + 2] - cz));
    this.lanes.push({ pts, len, kind, w: this._w, cx, cz, rad });
  }

  /** 거리 위 1~4 m 를 떠서 달리는 차 (양방향) + 양쪽 보행로를 걷는 사람 */
  _groundLanes(Z) {
    const hov = (x, z) => Math.max(heightAt(x, z), 0) + 3.2;
    const foot = (x, z) => Math.max(heightAt(x, z), 0) + 0.5;
    const w = Z.street * 0.55, sw = Math.min(4.6, Z.street * 0.225 - 0.4), walkOff = w / 2 + 0.15 + sw / 2;
    if (Z.streetEvery) Z.streets.forEach((R, k) => {
      if (k % Z.streetEvery) return;
      for (const [side, dir] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        if (!Z.id.startsWith('cap') && !Z.id.startsWith('dist') && side !== dir) continue;
        const r = R + side * (walkOff + dir * 0.7);
        this._lane((t) => { const a = dir * t * TAU; const x = Z.cx + Math.cos(a) * r, z = Z.cz + Math.sin(a) * r; return [x, foot(x, z), z]; }, 'walk');
      }
    });
    Z.streets.forEach((R, k) => {
      if (Z.streetEvery && k % Z.streetEvery) return;
      if (!Z.streetEvery) return;
      for (const dir of [1, -1]) {
        const r = R + dir * Z.street * 0.16;
        this._lane((t) => { const a = dir * t * TAU; const x = Z.cx + Math.cos(a) * r, z = Z.cz + Math.sin(a) * r; return [x, hov(x, z), z]; }, 'ground');
      }
    });
    // 큰 대로(짝수 번째) 가운데 빛 궤도: 전차가 나갔다가 돌아온다 (지형 셰이더의 궤도와 같은 자리)
    if (Z.id.startsWith('cap') || Z.id.startsWith('dist')) Z.avA.forEach((a, i) => {
      if (i % 2) return;
      const r0 = Z.r0 - Z.street, r1 = Z.rOut, ca = Math.cos(a), sa = Math.sin(a);
      this._lane((t) => {
        const out = t < 0.5, k = out ? t * 2 : (1 - t) * 2;
        const r = r0 + (r1 - r0) * k, side = out ? 0.72 : -0.72;
        const x = Z.cx + ca * r - sa * side, z = Z.cz + sa * r + ca * side;
        return [x, Math.max(heightAt(x, z), 0) + 1.3, z];
      }, 'tram');
    });
    // 방사 대로: 나갔다가 반대편 차선으로 돌아온다
    for (const a of Z.avA) {
      const r0 = Z.r0 - Z.street, r1 = Z.rOut, ca = Math.cos(a), sa = Math.sin(a), off = Z.street * 0.22;
      this._lane((t) => {
        const out = t < 0.5, k = out ? t * 2 : (1 - t) * 2;
        const r = r0 + (r1 - r0) * k, side = out ? off : -off;
        const x = Z.cx + ca * r - sa * side, z = Z.cz + sa * r + ca * side;
        return [x, hov(x, z), z];
      }, 'ground');
    }
  }

  /**
   * 위에서 보이는 생활: 짐 드론(물류·산업·교통·인공 환경 블록 사이를 수직으로 떠서 오간다),
   * 착륙대 사이 왕복선(교통 블록의 착륙탑 꼭대기끼리), 광장의 사람 무리(광장·중심 광장·랜드마크 둘레를 도는 걸음).
   */
  _lifeLanes(Z, rnd) {
    const P = Z.P;
    if (!P) return;
    const C = this.world.colliders;
    const roof = (x, z) => { let top = Math.max(heightAt(x, z), 0); for (const c of C.near(x, z, 24)) if (!c.sky && !c.obj && c.y1 < top + 900) top = Math.max(top, c.y1); return top; };
    const big = Z.id.startsWith('cap') || Z.id.startsWith('dist');
    const W0 = this._w;
    // 짐 드론
    const work = P.blocks.filter((B) => B.type === 4 || B.type === 5 || B.type === 8 || B.type === 9 || B.type === 12);
    const hubs = P.blocks.filter((B) => B.type === 5 || B.type === 8);
    const nD = Math.min(work.length, big ? 26 : Z.mix === 'suburb' ? 30 : 8);
    for (let i = 0; i < nD; i++) {
      const A = work[Math.floor(rnd() * work.length)];
      let Bb = null, bd = 1e9;
      for (const H of hubs) { if (H === A) continue; const d = Math.hypot(H.cx - A.cx, H.cz - A.cz); if (d > 250 && d < 1800 && d < bd) { bd = d; Bb = H; } }
      if (!Bb) continue;
      const ax = A.cx, az = A.cz, bx = Bb.cx, bz = Bb.cz;
      const ga = Math.max(heightAt(ax, az), 0) + 6, gb = Math.max(heightAt(bx, bz), 0) + 6;
      const len = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / len, uz = (bz - az) / len;
      let cruise = 0;
      for (let k = 0; k <= 12; k++) cruise = Math.max(cruise, roof(ax + (bx - ax) * k / 12, az + (bz - az) * k / 12));
      cruise += 24 + rnd() * 30;
      this._w = 0.5;
      this._lane((t) => {
        const back = t >= 0.5, k = back ? (t - 0.5) * 2 : t * 2;
        const f = back ? 1 - k : k, side = back ? -7 : 7;
        const hk = k < 0.1 ? k / 0.1 : k > 0.9 ? (1 - k) / 0.1 : 1; // 수직으로 떠서 나가고 수직으로 내려앉는다
        const s = Math.min(1, Math.max(0, (k - 0.1) / 0.8)), fs = back ? 1 - s : s;
        const x = ax + (bx - ax) * fs - uz * side, z = az + (bz - az) * fs + ux * side;
        const yb = (back ? gb + (ga - gb) * s : ga + (gb - ga) * s);
        void f;
        return [x, yb + (cruise - yb) * (hk * hk * (3 - 2 * hk)), z];
      }, 'drone');
    }
    // 착륙탑 꼭대기끼리 왕복선
    if (big) {
      const tops = [];
      for (const B of P.blocks) if (B.type === 8 && B.recs) for (const r of B.recs) if (r.kind === 'padtower' || r.kind === 'branchport') tops.push([r.x, r.top + 4, r.z]);
      for (let i = 0; i + 1 < tops.length; i += 2) {
        const [ax, ay, az] = tops[i], [bx, by, bz] = tops[i + 1];
        let cruise = Math.max(ay, by);
        for (let k = 0; k <= 12; k++) cruise = Math.max(cruise, roof(ax + (bx - ax) * k / 12, az + (bz - az) * k / 12));
        cruise += 40;
        this._w = 0.25;
        this._lane((t) => {
          const back = t >= 0.5, k = back ? (t - 0.5) * 2 : t * 2;
          const hk = k < 0.15 ? k / 0.15 : k > 0.85 ? (1 - k) / 0.15 : 1;
          const s = Math.min(1, Math.max(0, (k - 0.15) / 0.7)), fs = back ? 1 - s : s;
          const yb = back ? by + (ay - by) * s : ay + (by - ay) * s;
          return [ax + (bx - ax) * fs, yb + (cruise - yb) * hk, az + (bz - az) * fs];
        }, 'sky');
      }
    }
    // 광장의 사람 무리: 둥글게 거닐며 모인다
    const circ = (x, z, R, dir) => { this._w = 1.3; this._lane((t) => { const a = dir * t * TAU; const px = x + Math.cos(a) * R, pz = z + Math.sin(a) * R; return [px, Math.max(heightAt(px, pz), 0) + 0.5, pz]; }, 'walk'); };
    for (const B of P.blocks) {
      if (!(B.type === 11 || B.landmark || (B.type === 2 && big && rnd() < 0.5))) continue;
      if (B.wet > 0.3 || B.covered) continue;
      const R = B.landmark ? 44 : 9 + rnd() * 5;
      circ(B.cx, B.cz, R, 1); if (B.type === 11) circ(B.cx, B.cz, R * 0.6, -1);
    }
    if (P.core) P.core.forEach((B, i) => { if (i % 2 === 0) circ(B.cx, B.cz, 8 + (i % 3) * 3, i % 4 ? 1 : -1); });
    this._w = W0;
  }

  /** 지붕 위 하늘 차선: 가까운 건물보다 늘 높게 */
  _skyLanes(Z, rnd) {
    const C = this.world.colliders;
    const roof = (x, z) => {
      let top = Math.max(heightAt(x, z), 0);
      for (const c of C.near(x, z, 30)) if (!c.sky && !c.obj && c.y1 < top + 900) top = Math.max(top, c.y1);
      return top;
    };
    Z.sky.forEach((alt, i) => {
      for (const frac of [0.3, 0.72]) {
        const R = Z.r0 + (Z.rOut - Z.r0) * frac + i * 23;
        const dir = (i + (frac > 0.5 ? 1 : 0)) % 2 ? 1 : -1;
        const base = heightAt(Z.cx + R, Z.cz);
        // 먼저 높이를 재고, 매끈하게
        const ys = new Float32Array(NS), xs = new Float32Array(NS), zs = new Float32Array(NS);
        for (let s = 0; s < NS; s++) {
          const a = dir * (s / NS) * TAU + i;
          xs[s] = Z.cx + Math.cos(a) * R; zs[s] = Z.cz + Math.sin(a) * R;
          ys[s] = Math.max(Math.max(heightAt(xs[s], zs[s]), 0) + alt, roof(xs[s], zs[s]) + 14, base + alt * 0.6);
        }
        const m = new Float32Array(NS);
        for (let s = 0; s < NS; s++) { let v = 0; for (let j = -4; j <= 4; j++) v = Math.max(v, ys[(s + j + NS) % NS]); m[s] = v; }
        for (let pass = 0; pass < 3; pass++) for (let s = 0; s < NS; s++) ys[s] = (m[(s + NS - 1) % NS] + m[s] * 2 + m[(s + 1) % NS]) / 4, m[s] = Math.max(m[s], ys[s]);
        this._lane((t) => { const s = Math.round(t * NS) % NS; return [xs[s], m[s], zs[s]]; }, 'sky');
      }
    });
  }

  /** 하모네아 가운데 ↔ 네 구역·별항구를 잇는 하늘 대로 */
  _highways() {
    const ends = DISTRICTS.map((D) => [D.x, D.z]);
    for (const [ex, ez] of ends) {
      const d = Math.hypot(ex, ez), ux = ex / d, uz = ez / d;
      const x0 = ux * 900, z0 = uz * 900, x1 = ex - ux * 420, z1 = ez - uz * 420;
      for (const side of [-1, 1]) {
        const off = side * 9;
        const yAt = (k) => { const x = x0 + (x1 - x0) * k, z = z0 + (z1 - z0) * k; return Math.max(heightAt(x0, z0), heightAt(x1, z1)) * (1 - Math.abs(k - 0.5)) + 260 + Math.sin(k * Math.PI) * 120; };
        this._lane((t) => {
          const out = t < 0.5, k = out ? t * 2 : (1 - t) * 2, s = out ? off : -off;
          const x = x0 + (x1 - x0) * k - uz * s, z = z0 + (z1 - z0) * k + ux * s;
          return [x, yAt(k) + side * 6, z];
        }, 'sky');
      }
    }
  }

  _build(rnd) {
    const nL = this.lanes.length;
    const tex = new Float32Array(NS * nL * 4);
    this.lanes.forEach((L, i) => tex.set(L.pts, i * NS * 4));
    this.tex = new THREE.DataTexture(tex, NS, nL, THREE.RGBAFormat, THREE.FloatType);
    this.tex.minFilter = this.tex.magFilter = THREE.NearestFilter;
    this.tex.needsUpdate = true;
    // 차선마다 차를 미리 정해 둔다 (같은 차선은 언제 다시 골라도 같은 자리에 같은 차)
    const tints = [[1, 1, 1], [0.75, 0.95, 1], [1, 0.9, 0.75], [0.95, 0.8, 1], [0.8, 1, 0.9], [1, 0.82, 0.88]];
    const people = [[0.46, 0.62, 0.8], [0.74, 0.48, 0.62], [0.84, 0.62, 0.36], [0.52, 0.46, 0.76], [0.4, 0.68, 0.6], [0.82, 0.78, 0.86], [0.66, 0.36, 0.42], [0.36, 0.5, 0.56]]; // 옷자락 색
    this.lanes.forEach((L, i) => {
      const sky = L.kind === 'sky', walk = L.kind === 'walk', tram = L.kind === 'tram', drone = L.kind === 'drone';
      const gap = walk ? 7 / L.w : (sky ? 90 : tram ? 320 : drone ? 160 : 34) / L.w;
      const n = Math.max(tram ? 1 : 2, Math.floor(L.len / gap));
      const r = mulberry32(i * 7919 + 17);
      const sp = walk ? 1.25 : sky ? 45 + r() * 40 : tram ? 13 + r() * 4 : drone ? 16 + r() * 8 : 15 + r() * 14; // m/s
      if (walk) {
        L.pod = new Float32Array(n * 4); L.tint = new Float32Array(n * 3); L.n = n;
        for (let k = 0; k < n; k++) {
          L.pod.set([i, (k + r() * 0.8) / n, (sp * (0.75 + r() * 0.5)) / L.len, (r() - 0.5) * 1.4], k * 4);
          L.tint.set(people[Math.floor(r() * people.length)], k * 3);
        }
        return;
      }
      L.pod = new Float32Array(n * 4);
      L.tint = new Float32Array(n * 3);
      L.n = n;
      for (let k = 0; k < n; k++) {
        L.pod.set([i, (k + r() * 0.7) / n, (sp * (0.85 + r() * 0.3)) / L.len, sky ? (r() - 0.5) * 8 : tram ? 0 : drone ? (r() - 0.5) * 4 : (r() - 0.5) * 2], k * 4);
        L.tint.set(tints[Math.floor(r() * tints.length)], k * 3);
      }
    });
    this.count = 0;
    this.total = this.lanes.reduce((s, L) => s + L.n, 0);
    this._at = new THREE.Vector3(1e9, 0, 1e9);
    // 무리(fleet)마다 모양 하나 · 그리기 1회: 호버 차·하늘배(차·하늘) / 전차 / 짐 드론
    const shared = { ...atmosUniforms, uLanes: { value: this.tex }, uT: { value: 0 }, uFar: { value: this.cap < 3000 ? 5000 : 8000 }, uNearHide: { value: 0 }, uAvoid: { value: new THREE.Vector4() } };
    const fleet = (kinds, geo, cap, scale) => {
      const g = new THREE.InstancedBufferGeometry();
      for (const k of ['position', 'normal', 'aVCol', 'aEmit']) g.setAttribute(k, geo.attributes[k]);
      const aPod = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage);
      const aTint = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3).setUsage(THREE.DynamicDrawUsage);
      g.setAttribute('aPod', aPod); g.setAttribute('aTint', aTint);
      g.instanceCount = 0;
      const mat = new THREE.ShaderMaterial({ uniforms: { ...shared, uScale: { value: new THREE.Vector2(...scale) } }, vertexShader: vert, fragmentShader: frag, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(g, mat);
      mesh.frustumCulled = false;
      this.world.scene.add(mesh);
      return { kinds, g, aPod, aTint, cap, mat, mesh, count: 0 };
    };
    this.fleets = [
      fleet(['ground', 'sky'], podGeo(), this.cap, [0.0014, 7]),
      fleet(['tram'], tramGeo(), 300, [0.0009, 3]),
      fleet(['drone'], droneGeo(), Math.round(this.cap / 6), [0.0016, 6]),
    ];
    this.mat = this.fleets[0].mat; this.geo = this.fleets[0].g; this.mesh = this.fleets[0].mesh;
    // 걷는 사람들 (같은 차선 텍스처, 다른 모양)
    const wb = walkerGeo();
    const wg = new THREE.InstancedBufferGeometry();
    for (const k of ['position', 'normal', 'aVCol', 'aEmit']) wg.setAttribute(k, wb.attributes[k]);
    this.wPod = new THREE.InstancedBufferAttribute(new Float32Array(this.wcap * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.wTint = new THREE.InstancedBufferAttribute(new Float32Array(this.wcap * 3), 3).setUsage(THREE.DynamicDrawUsage);
    wg.setAttribute('aPod', this.wPod);
    wg.setAttribute('aTint', this.wTint);
    wg.instanceCount = 0;
    this.wgeo = wg;
    this.wmat = new THREE.ShaderMaterial({ uniforms: this.mat.uniforms, vertexShader: vert, fragmentShader: frag, side: THREE.DoubleSide, defines: { WALK: '' } });
    this.wmat.uniforms = { ...this.mat.uniforms, uFar: { value: 1700 }, uNearHide: { value: 110 }, uScale: { value: new THREE.Vector2(0.0018, 3.5) } };
    this.wmesh = new THREE.Mesh(wg, this.wmat);
    this.wmesh.frustumCulled = false;
    this.world.scene.add(this.wmesh);
    this._wat = new THREE.Vector3(1e9, 0, 1e9);
    this._wT = 0;
    this.walkers = 0;
  }

  /** 걷는 사람: 지금 카메라 가까이 있는 사람만 고른다 (차선은 길어서 차선 단위로 고르면 낭비) */
  _fillWalk(cam) {
    this._wat.copy(cam);
    this._wT = 6;
    // 높이 올라갈수록 더 멀리까지 (위에서 내려다보면 광장의 무리가 점처럼 읽힌다)
    const reach = Math.min(1600, this.wreach + Math.max(0, cam.y - Math.max(heightAt(cam.x, cam.z), 0) - 20) * 1.6);
    const P = this.wPod.array, T = this.wTint.array, R2 = (reach + 40) ** 2;
    let k = 0;
    for (let li = 0; li < this.lanes.length && k < this.wcap; li++) {
      const L = this.lanes[li];
      if (L.kind !== 'walk' || Math.max(0, Math.hypot(cam.x - L.cx, cam.z - L.cz) - L.rad) > reach) continue;
      for (let j = 0; j < L.n && k < this.wcap; j++) {
        const u = ((L.pod[j * 4 + 1] + this.t * L.pod[j * 4 + 2]) % 1 + 1) % 1;
        const s = Math.floor(u * NS) % NS;
        const dx = L.pts[s * 4] - cam.x, dz = L.pts[s * 4 + 2] - cam.z;
        if (dx * dx + dz * dz > R2) continue;
        P.set(L.pod.subarray(j * 4, j * 4 + 4), k * 4);
        T.set(L.tint.subarray(j * 3, j * 3 + 3), k * 3);
        k++;
      }
    }
    this.walkers = this.wgeo.instanceCount = k;
    this.wPod.clearUpdateRanges(); this.wPod.addUpdateRange(0, k * 4); this.wPod.needsUpdate = true;
    this.wTint.clearUpdateRanges(); this.wTint.addUpdateRange(0, k * 3); this.wTint.needsUpdate = true;
  }

  /** 카메라 가까운 차선부터 차를 채운다 */
  _fill(cam) {
    this._at.copy(cam);
    this.count = 0;
    for (const F of this.fleets) {
      const sel = [];
      for (const L of this.lanes) {
        if (!F.kinds.includes(L.kind)) continue;
        const d = Math.max(0, Math.hypot(cam.x - L.cx, cam.z - L.cz) - L.rad);
        if (d < this.reach) sel.push([d, L]);
      }
      sel.sort((a, b) => a[0] - b[0]);
      let k = 0;
      const P = F.aPod.array, T = F.aTint.array;
      for (const [, L] of sel) {
        const n = Math.min(L.n, F.cap - k);
        if (n <= 0) break;
        P.set(L.pod.subarray(0, n * 4), k * 4);
        T.set(L.tint.subarray(0, n * 3), k * 3);
        k += n;
      }
      F.count = F.g.instanceCount = k;
      this.count += k;
      F.aPod.clearUpdateRanges(); F.aPod.addUpdateRange(0, k * 4); F.aPod.needsUpdate = true;
      F.aTint.clearUpdateRanges(); F.aTint.addUpdateRange(0, k * 3); F.aTint.needsUpdate = true;
    }
  }

  update(dt, ctx) {
    this.t += dt;
    this.mat.uniforms.uT.value = this.t;
    const cam = ctx && ctx.game ? ctx.game.engine.camera.position : null;
    const pl = ctx && ctx.game && ctx.game.player;
    if (pl) this.mat.uniforms.uAvoid.value.set(pl.pos.x, pl.pos.y, pl.pos.z, 1);
    if (cam && Math.hypot(cam.x - this._at.x, cam.z - this._at.z) > 250) this._fill(cam);
    this._wT -= dt;
    if (cam && (this._wT <= 0 || Math.hypot(cam.x - this._wat.x, cam.z - this._wat.z) > 40 || Math.abs(cam.y - this._wat.y) > 60)) this._fillWalk(cam);
  }
}
