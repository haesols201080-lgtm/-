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
  float s = clamp(d * 0.0014, 1.0, 7.0);
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
  col += vec3(0.85, 0.92, 1.0) * pow(1.0 - max(dot(N, V), 0.0), 3.0) * 0.35;
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

export class Streams {
  constructor(world, city, q = {}) {
    this.world = world;
    this.city = city;
    const f = q.flora ?? 0.9;
    this.cap = f < 0.5 ? 2500 : f < 0.7 ? 5000 : f < 1 ? 8000 : 11000; // 한 번에 그리는 차 수 상한
    this.reach = f < 0.5 ? 2600 : 4200; // 카메라에서 이 거리 안의 차선에만 차를 올린다
    this.lanes = []; // { pts: [x,y,z,1]*NS, len, kind, w(교통량), cx, cz, rad }
    this.t = 0;
    const rnd = mulberry32(4242);
    for (const Z of city.zones) {
      this._w = Z.traffic ?? (Z.id.startsWith('cap') ? 1 : Z.id.startsWith('dist') ? 0.7 : Z.id.startsWith('town') ? 0.4 : 0.28);
      if (Z.lanes) this._groundLanes(Z);
      if (Z.sky) this._skyLanes(Z, rnd);
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

  /** 거리 위 1~4 m 를 떠서 달리는 차 (양방향) */
  _groundLanes(Z) {
    const hov = (x, z) => Math.max(heightAt(x, z), 0) + 3.2;
    Z.streets.forEach((R, k) => {
      if (Z.streetEvery && k % Z.streetEvery) return;
      if (!Z.streetEvery) return;
      for (const dir of [1, -1]) {
        const r = R + dir * Z.street * 0.16;
        this._lane((t) => { const a = dir * t * TAU; const x = Z.cx + Math.cos(a) * r, z = Z.cz + Math.sin(a) * r; return [x, hov(x, z), z]; }, 'ground');
      }
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
    this.lanes.forEach((L, i) => {
      const sky = L.kind === 'sky';
      const gap = (sky ? 90 : 34) / L.w;
      const n = Math.max(2, Math.floor(L.len / gap));
      const r = mulberry32(i * 7919 + 17);
      const sp = sky ? 45 + r() * 40 : 15 + r() * 14; // m/s
      L.pod = new Float32Array(n * 4);
      L.tint = new Float32Array(n * 3);
      L.n = n;
      for (let k = 0; k < n; k++) {
        L.pod.set([i, (k + r() * 0.7) / n, (sp * (0.85 + r() * 0.3)) / L.len, sky ? (r() - 0.5) * 8 : (r() - 0.5) * 2], k * 4);
        L.tint.set(tints[Math.floor(r() * tints.length)], k * 3);
      }
    });
    const base = podGeo();
    const g = new THREE.InstancedBufferGeometry();
    for (const k of ['position', 'normal', 'aVCol', 'aEmit']) g.setAttribute(k, base.attributes[k]);
    this.aPod = new THREE.InstancedBufferAttribute(new Float32Array(this.cap * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.aTint = new THREE.InstancedBufferAttribute(new Float32Array(this.cap * 3), 3).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aPod', this.aPod);
    g.setAttribute('aTint', this.aTint);
    g.instanceCount = 0;
    this.geo = g;
    this.count = 0;
    this.total = this.lanes.reduce((s, L) => s + L.n, 0);
    this._at = new THREE.Vector3(1e9, 0, 1e9);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { ...atmosUniforms, uLanes: { value: this.tex }, uT: { value: 0 }, uFar: { value: this.cap < 3000 ? 5000 : 8000 } },
      vertexShader: vert, fragmentShader: frag, side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.world.scene.add(this.mesh);
  }

  /** 카메라 가까운 차선부터 차를 채운다 */
  _fill(cam) {
    this._at.copy(cam);
    const sel = [];
    for (const L of this.lanes) {
      const d = Math.max(0, Math.hypot(cam.x - L.cx, cam.z - L.cz) - L.rad);
      if (d < this.reach) sel.push([d, L]);
    }
    sel.sort((a, b) => a[0] - b[0]);
    let k = 0;
    const P = this.aPod.array, T = this.aTint.array;
    for (const [, L] of sel) {
      const n = Math.min(L.n, this.cap - k);
      if (n <= 0) break;
      P.set(L.pod.subarray(0, n * 4), k * 4);
      T.set(L.tint.subarray(0, n * 3), k * 3);
      k += n;
    }
    this.count = this.geo.instanceCount = k;
    this.aPod.clearUpdateRanges(); this.aPod.addUpdateRange(0, k * 4); this.aPod.needsUpdate = true;
    this.aTint.clearUpdateRanges(); this.aTint.addUpdateRange(0, k * 3); this.aTint.needsUpdate = true;
  }

  update(dt, ctx) {
    this.t += dt;
    this.mat.uniforms.uT.value = this.t;
    const cam = ctx && ctx.game ? ctx.game.engine.camera.position : null;
    if (cam && Math.hypot(cam.x - this._at.x, cam.z - this._at.z) > 250) this._fill(cam);
  }
}
