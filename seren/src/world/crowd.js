// 주민 무리: 가까운 아웬 주민 수십 명을 그리기 1회로. 몸·머리·두 팔·옷자락·손에 든 것(짐 상자·고리 하프·물방울)을
// 한 지오메트리에 담고, 인스턴스마다 자세(팔 들기·머리 숙이기·무릎 꿇기·앉기·말할 때 빛)를 정점 셰이더가 만든다.
import * as THREE from 'three';
import { lathe, part, merge, xf, tube } from './geo-utils.js';
import { NOISE_GLSL, ATMOS_PARS, CURVE_GLSL } from './shaders.js';
import { atmosUniforms } from './atmosphere.js';

// 부위 번호: 0 몸 1 머리 2 왼팔 3 오른팔 4 옷자락 5 짐 상자 6 고리 하프 7 물방울 8 바구니
const PIV = { 1: [0, 2.58, 0.02], 2: [-0.27, 2.25, 0.02], 3: [0.27, 2.25, 0.02], 4: [0, 1.1, 0] };

function tag(g, partId) {
  const n = g.attributes.position.count;
  g.setAttribute('aPart', new THREE.BufferAttribute(new Float32Array(n).fill(partId), 1));
  const pv = PIV[partId] || [0, 0, 0];
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = pv[0]; a[i * 3 + 1] = pv[1]; a[i * 3 + 2] = pv[2]; }
  g.setAttribute('aPivot', new THREE.BufferAttribute(a, 3));
  return g;
}
function mergeTagged(list) {
  const out = merge(list.map(([g]) => g));
  const n = out.attributes.position.count;
  const pa = new Float32Array(n), pv = new Float32Array(n * 3);
  let o = 0;
  for (const [g, id] of list) {
    const c = g.attributes.position.count;
    pa.fill(id, o, o + c);
    const p = PIV[id] || [0, 0, 0];
    for (let i = 0; i < c; i++) { pv[(o + i) * 3] = p[0]; pv[(o + i) * 3 + 1] = p[1]; pv[(o + i) * 3 + 2] = p[2]; }
    o += c;
  }
  out.setAttribute('aPart', new THREE.BufferAttribute(pa, 1));
  out.setAttribute('aPivot', new THREE.BufferAttribute(pv, 3));
  return out;
}

function crowdGeo() {
  const W = 0xffffff, D = 0x808080; // 흰색 = 피부색(인스턴스), 회색 = 옷자락 색(인스턴스)
  const L = [];
  const body = lathe([[0.0001, 0.0], [0.08, 0.15], [0.26, 0.55], [0.42, 1.05], [0.4, 1.55], [0.3, 2.0], [0.26, 2.25], [0.2, 2.42], [0.1, 2.55], [0.0001, 2.58]], 10);
  L.push([part(body, W, (x, y) => (Math.abs(x) < 0.05 && y > 1.2 && y < 2.3 ? 0.6 : 0.04)), 0]);
  L.push([part(xf(new THREE.SphereGeometry(0.07, 6, 4), { y: 1.85, z: 0.3 }), W, 2.2), 0]);
  // 머리 (목 기준점 위)
  const head = new THREE.SphereGeometry(0.2, 10, 7);
  head.scale(0.9, 1.0, 1.55); head.rotateX(-0.5);
  const band = new THREE.TorusGeometry(0.19, 0.022, 4, 14, Math.PI * 1.1);
  band.rotateZ(-Math.PI * 0.05); band.rotateY(Math.PI / 2); band.rotateX(Math.PI / 2 + 0.3);
  L.push([part(xf(head, { x: 0, y: 2.58 + 0.16, z: 0.07 }), W, 0.05), 1]);
  L.push([part(xf(band, { y: 2.58 + 0.17, z: 0.14 }), W, 2.4), 1]);
  for (let i = 0; i < 4; i++) {
    const a = (i - 1.5) * 0.25;
    L.push([part(xf(tube([[0, 0.12, -0.05], [Math.sin(a) * 0.1, 0.3, -0.25], [Math.sin(a) * 0.18, 0.38, -0.55 - i * 0.04]], 0.012, 3, 5), { y: 2.58 + 0.12, z: 0.12 }), W, 2.0), 1]);
  }
  // 팔 (어깨 기준점)
  for (const [id, s] of [[2, -1], [3, 1]]) {
    const arm = tube([[0, 0, 0], [0.05, -0.35, 0.05], [0.04, -0.8, 0.12], [0.02, -1.15, 0.2]], 0.03, 4, 6, (t) => 1.1 - 0.5 * t);
    arm.scale(s, 1, 1);
    L.push([part(xf(arm, { x: PIV[id][0], y: PIV[id][1], z: PIV[id][2] }), W, 0.05), id]);
    for (let i = 0; i < 3; i++) {
      const a = (i - 1) * 0.35;
      const f = tube([[0.02, -1.15, 0.2], [0.02 + Math.sin(a) * 0.05, -1.3, 0.24], [0.02 + Math.sin(a) * 0.08, -1.4, 0.22]], 0.008, 3, 3);
      f.scale(s, 1, 1);
      L.push([part(xf(f, { x: PIV[id][0], y: PIV[id][1], z: PIV[id][2] }), W, 0.8), id]);
    }
  }
  // 옷자락
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const g = new THREE.PlaneGeometry(0.13, 1.3, 1, 3);
    g.translate(0, 0.25, 0); g.rotateY(a); g.translate(Math.sin(a) * 0.3, 0.65, Math.cos(a) * 0.3);
    L.push([part(g, D, 0.3), 4]);
  }
  // 손에 든 것
  L.push([part(new THREE.BoxGeometry(0.62, 0.48, 0.5).translate(0, 1.15, 0.62), 0xc89060, 0), 5]);
  L.push([part(new THREE.BoxGeometry(0.64, 0.04, 0.52).translate(0, 1.4, 0.62), 0x7ff3e6, 1.6), 5]);
  L.push([part(new THREE.TorusGeometry(0.34, 0.035, 4, 18).translate(0, 1.85, 0.52), 0xffd27a, 1.4), 6]);
  for (let i = 0; i < 5; i++) L.push([part(new THREE.CylinderGeometry(0.006, 0.006, 0.6 - Math.abs(i - 2) * 0.12, 3).translate(-0.2 + i * 0.1, 1.85, 0.52), 0xfff4d0, 2.2), 6]);
  L.push([part(new THREE.IcosahedronGeometry(0.15, 1).translate(0.3, 1.15, 0.55), 0x9ff6ff, 2.4), 7]);
  L.push([part(new THREE.CylinderGeometry(0.28, 0.2, 0.3, 8, 1, true).translate(0, 1.1, 0.55), 0xc8a070, 0), 8]);
  L.push([part(new THREE.IcosahedronGeometry(0.1, 0).translate(0.08, 1.28, 0.55), 0xffc46a, 1.4), 8]);
  L.push([part(new THREE.IcosahedronGeometry(0.1, 0).translate(-0.1, 1.27, 0.5), 0xff9fd0, 1.4), 8]);
  return mergeTagged(L);
}

const vert = /* glsl */ `
${CURVE_GLSL}
attribute float aPart;
attribute vec3 aPivot;
attribute vec3 color;
attribute float emit;
attribute vec4 iA;    // x, y, z, yaw
attribute vec4 iB;    // 배율, 위상, 말빛, 무릎(0 서기 · 0.5 앉기 · 1 꿇기)
attribute vec4 iC;    // 왼팔, 오른팔(앞으로 드는 각), 머리 숙임, 든 것
attribute vec3 iSkin;
attribute vec3 iDeep;
attribute vec3 iGlow;
uniform float uTime;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vColor;
varying float vEmit;
varying vec3 vGlowC;
vec3 rotX(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(p.x, p.y * c - p.z * s, p.y * s + p.z * c); }
vec3 rotY(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(p.x * c + p.z * s, p.y, -p.x * s + p.z * c); }
vec3 rotZ(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(p.x * c - p.y * s, p.x * s + p.y * c, p.z); }
void main() {
  vec3 p = position, n = normal;
  float t = uTime + iB.y * 17.0;
  float pt = aPart;
  if (pt > 4.5) {
    // 손에 든 것: 그 물건일 때만
    if (abs(iC.w - pt) > 0.5) { gl_Position = vec4(0.0, 0.0, -2.0, 1.0); return; }
  } else if (pt > 3.5) {
    vec3 q = rotX(p - aPivot, sin(t * 1.6) * 0.12);
    q = rotZ(q, cos(t * 1.2) * 0.08);
    q.xz *= 1.0 + iB.w * 0.35;
    p = q + aPivot; n = rotX(n, sin(t * 1.6) * 0.12);
  } else if (pt > 1.5) {
    float s = pt < 2.5 ? -1.0 : 1.0;
    float a = pt < 2.5 ? iC.x : iC.y;
    vec3 q = rotX(p - aPivot, -(0.15 + a));
    q = rotZ(q, s * (0.12 + a * 0.18 + sin(t * 0.9 + pt) * 0.04));
    p = q + aPivot; n = rotZ(rotX(n, -(0.15 + a)), s * 0.12);
  } else if (pt > 0.5) {
    vec3 q = rotX(p - aPivot, iC.z);
    q = rotY(q, sin(t * 0.4) * 0.2);
    p = q + aPivot; n = rotY(rotX(n, iC.z), sin(t * 0.4) * 0.2);
  }
  // 무릎: 엉덩이 위가 내려오고 앞으로 숙는다
  float kneel = iB.w;
  float up = smoothstep(0.5, 1.2, p.y);
  p.y -= kneel * 0.95 * up;
  p.z += kneel * 0.2 * up * smoothstep(1.2, 2.6, p.y + kneel);
  p.y += 0.45 + sin(t * 1.3) * 0.08 * (1.0 - kneel);
  p *= iB.x;
  vec3 wp = rotY(p, iA.w) + iA.xyz;
  vWorld = wp;
  vNormal = rotY(n, iA.w);
  vColor = mix(iDeep, iSkin, step(0.9, color.r) * step(0.9, color.g) * step(0.9, color.b));
  if (pt > 4.5) vColor = color;
  vEmit = emit * (1.0 + iB.z * (1.2 + sin(uTime * 18.0) * 0.8));
  vGlowC = pt > 4.5 ? color : iGlow;
  gl_Position = projectionMatrix * viewMatrix * vec4(curveWorld(wp), 1.0);
}`;

const frag = /* glsl */ `
${NOISE_GLSL}
${ATMOS_PARS}
varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vColor;
varying float vEmit;
varying vec3 vGlowC;
void main() {
  vec3 N = normalize(vNormal);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 col = shadeLit(vColor, N, 1.0);
  col += mix(vGlowC, vec3(1.0), 0.5) * pow(1.0 - max(dot(N, V), 0.0), 3.0) * (0.35 + 0.4 * uGlow);
  float litL = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col *= 1.0 / (1.0 + max(litL - 0.72, 0.0) * 1.15);
  col += vGlowC * vEmit * (0.5 + uGlow * 1.0);
  col = applyFog(col, vWorld);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class Crowd {
  constructor(scene, max = 160) {
    this.max = max;
    const base = crowdGeo();
    const g = new THREE.InstancedBufferGeometry();
    for (const k of ['position', 'normal', 'color', 'emit', 'aPart', 'aPivot']) g.setAttribute(k, base.attributes[k]);
    const mk = (n) => { const a = new THREE.InstancedBufferAttribute(new Float32Array(max * n), n); a.setUsage(THREE.DynamicDrawUsage); return a; };
    this.iA = mk(4); this.iB = mk(4); this.iC = mk(4); this.iSkin = mk(3); this.iDeep = mk(3); this.iGlow = mk(3);
    g.setAttribute('iA', this.iA); g.setAttribute('iB', this.iB); g.setAttribute('iC', this.iC);
    g.setAttribute('iSkin', this.iSkin); g.setAttribute('iDeep', this.iDeep); g.setAttribute('iGlow', this.iGlow);
    g.instanceCount = 0;
    this.mat = new THREE.ShaderMaterial({ uniforms: { ...atmosUniforms }, vertexShader: vert, fragmentShader: frag, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.geo = g;
    this.n = 0;
  }
  begin() { this.n = 0; }
  /** 한 명 그리기. o: { x, y, z, yaw, s, phase, speak, kneel, armL, armR, head, hold, skin:Color, deep:Color, glow:Color } */
  push(o) {
    if (this.n >= this.max) return;
    const i = this.n++;
    this.iA.array.set([o.x, o.y, o.z, o.yaw], i * 4);
    this.iB.array.set([o.s, o.phase, o.speak || 0, o.kneel || 0], i * 4);
    this.iC.array.set([o.armL || 0, o.armR || 0, o.head || 0, o.hold || 0], i * 4);
    this.iSkin.array.set([o.skin.r, o.skin.g, o.skin.b], i * 3);
    this.iDeep.array.set([o.deep.r, o.deep.g, o.deep.b], i * 3);
    this.iGlow.array.set([o.glow.r, o.glow.g, o.glow.b], i * 3);
  }
  end() {
    this.geo.instanceCount = this.n;
    for (const a of [this.iA, this.iB, this.iC]) { a.clearUpdateRanges(); a.addUpdateRange(0, this.n * 4); a.needsUpdate = true; }
    for (const a of [this.iSkin, this.iDeep, this.iGlow]) { a.clearUpdateRanges(); a.addUpdateRange(0, this.n * 3); a.needsUpdate = true; }
  }
}
