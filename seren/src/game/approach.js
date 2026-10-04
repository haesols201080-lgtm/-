// 오프닝: 라르크 호가 세렌에 다가가 궤도에 들고, 착륙선이 떨어져 나와 대기를 뚫고 빛 표지 옆 들판에 내려앉기까지.
//   0 ~ 8 초   다가가기   — 배 곁에서. 앞에 작은 세렌, 뒤로 고리 두른 가스행성 우르.
//   8 ~ 16 초  궤도 들기  — 커지는 세렌(아웬의 궤도 고리·승강줄·밤의 도시 불빛), 배가 돌아서 감속 분사.
//  16 ~ 27 초  분리       — 궤도 고리 위의 라르크 호. 집게가 풀리고 착륙선이 떨어져 나가 역분사. 모아의 교신.
//  27 ~ 32 초  진입       — 착륙선 배 밑이 달아오르고 흔들림 → 하얗게.
//  32 ~ 44.8 초 들판     — 세계 장면. 착륙선이 하강 분사구로 내려앉고, 먼지 고리, 착지.
// 우주 장면은 세계를 그리지 않고 따로(먼 장면 km + 가까운 장면 m, 깊이를 나눠 두 번) 그린다: engine.space.
// 넘기기: 한 번 누르면 들판 장면으로, 한 번 더 누르면 끝.
import * as THREE from 'three';
import { NOISE_GLSL } from '../world/shaders.js';
import { part, merge, xf } from '../world/geo-utils.js';
import { landerShell, THRUSTERS } from '../world/lander.js';
import { buildLark } from '../world/lark.js';
import { audio } from '../core/audio.js';
import { heightAt } from '../world/heightfield.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const Y = V(0, 1, 0);
const R = 2000; // 세렌 반지름 (km)
const RING_R = 2520; // 아웬의 궤도 고리 (km)
const SUN = V(0.82, 0.22, -0.52).normalize();
const A_DIR = V(0.18, 0.1, 1).normalize(); // 다가오는 쪽 (세렌 중심에서)
const UR_POS = A_DIR.clone().multiplyScalar(-400000).add(V(-150000, 70000, 0));
const UR_R = 58000;
const T1 = 8, T2 = 16, T3 = 27, TB = 32, TW = 12.8;
const TOTAL = TB + TW;
const OUT = '#include <tonemapping_fragment>\n#include <colorspace_fragment>';
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// ── 재질 ─────────────────────────────────────────
const sphVert = /* glsl */ `
varying vec3 vObj; varying vec3 vN; varying vec3 vW;
void main() {
  vObj = position;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

function planetMat() {
  return new THREE.ShaderMaterial({
    uniforms: { uSun: { value: SUN }, uTime: { value: 0 } },
    vertexShader: sphVert,
    fragmentShader: /* glsl */ `
${NOISE_GLSL}
uniform vec3 uSun; uniform float uTime;
varying vec3 vObj; varying vec3 vN; varying vec3 vW;
void main() {
  vec3 p = normalize(vObj);
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vW);
  float h = fbm3(p * 1.4 + vec3(4.1, 1.3, 2.2)) * 0.7 + fbm3(p * 4.2) * 0.24 + fbm3(p * 16.0) * 0.06;
  float sea = 0.5;
  float landK = smoothstep(sea, sea + 0.012, h);
  vec3 ocean = mix(vec3(0.03, 0.14, 0.24), vec3(0.08, 0.38, 0.44), smoothstep(sea - 0.09, sea, h));
  vec3 meadow = mix(vec3(0.3, 0.58, 0.42), vec3(0.56, 0.68, 0.4), fbm3(p * 9.0 + 2.0));
  vec3 landC = mix(meadow, vec3(0.44, 0.36, 0.6), smoothstep(0.5, 0.7, fbm3(p * 3.1 + 7.0)));
  landC = mix(landC, vec3(0.72, 0.66, 0.56), smoothstep(0.64, 0.76, h));
  vec3 alb = mix(ocean, landC, landK);
  alb = mix(alb, vec3(0.92, 0.95, 1.0), smoothstep(0.8, 0.9, abs(p.y) + (fbm3(p * 7.0) - 0.5) * 0.12));
  float cl = smoothstep(0.5, 0.75, fbm3(p * 3.6 + vec3(uTime * 0.003, 0.0, 0.0)) * 0.65 + fbm3(p * 11.0 - uTime * 0.002) * 0.35);
  alb = alb * alb;
  float ndl = dot(N, uSun);
  float day = smoothstep(-0.06, 0.22, ndl);
  vec3 sunC = vec3(1.0, 0.95, 0.88) * 2.2;
  vec3 col = alb * sunC * max(ndl, 0.0) * 0.9 + alb * 0.012;
  vec3 Hh = normalize(uSun + V);
  col += vec3(1.0, 0.92, 0.8) * pow(max(dot(N, Hh), 0.0), 90.0) * (1.0 - landK) * (1.0 - cl) * day * 1.5;
  col = mix(col, vec3(0.95) * sunC * max(ndl, 0.0) * 0.85 + vec3(0.02), cl * 0.85);
  // 밤의 도시 불빛
  float city = smoothstep(0.55, 0.68, fbm3(p * 34.0 + 11.0)) * smoothstep(0.44, 0.6, fbm3(p * 3.0 + 5.0));
  float spark = smoothstep(0.62, 0.95, vnoise3(p * 520.0)) * 0.8 + 0.2;
  float night = 1.0 - smoothstep(-0.12, 0.08, ndl);
  vec3 lights = mix(vec3(1.0, 0.72, 0.38), vec3(0.5, 0.95, 0.9), smoothstep(0.3, 0.7, fbm3(p * 6.0)));
  col += lights * city * spark * landK * (1.0 - cl * 0.7) * night * 0.9;
  // 대기의 테와 노을
  float fr = pow(1.0 - max(dot(N, V), 0.0), 2.6);
  vec3 sky = mix(vec3(1.0, 0.5, 0.3), vec3(0.35, 0.72, 0.95), smoothstep(-0.05, 0.3, ndl));
  col += sky * fr * smoothstep(-0.25, 0.25, ndl) * 1.3;
  col += vec3(0.04, 0.08, 0.11) * day;
  gl_FragColor = vec4(col, 1.0);
  ${OUT}
}`,
  });
}

function haloMat() {
  return new THREE.ShaderMaterial({
    uniforms: { uSun: { value: SUN } },
    vertexShader: sphVert,
    fragmentShader: /* glsl */ `
uniform vec3 uSun;
varying vec3 vObj; varying vec3 vN; varying vec3 vW;
void main() {
  vec3 N = normalize(vN);
  vec3 Vd = normalize(cameraPosition - vW);
  float k = clamp(-dot(N, Vd) / 0.26, 0.0, 1.0);
  float a = pow(k, 1.6);
  float lit = smoothstep(-0.35, 0.3, dot(N, uSun));
  vec3 col = mix(vec3(1.0, 0.45, 0.25), vec3(0.35, 0.75, 1.0), smoothstep(-0.1, 0.35, dot(N, uSun)));
  gl_FragColor = vec4(col * a * lit * 1.6, 1.0);
}`,
    side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
}

function hoopMat() {
  return new THREE.ShaderMaterial({
    uniforms: { uSun: { value: SUN }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
varying vec2 vUv; varying vec3 vW; varying vec3 vN;
void main() { vUv = uv; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
uniform vec3 uSun; uniform float uTime;
varying vec2 vUv; varying vec3 vW; varying vec3 vN;
void main() {
  float along = vUv.x * 2400.0, across = vUv.y;
  float d = dot(vW, uSun);
  float sh = (d < 0.0 && length(vW - d * uSun) < ${R.toFixed(1)}) ? 1.0 : 0.0;
  float panels = 0.8 + 0.2 * step(0.5, fract(along * 0.5)) * step(0.15, fract(across * 5.0));
  float ndl = abs(dot(normalize(vN), uSun)) * 0.7 + 0.3;
  vec3 col = vec3(0.7, 0.74, 0.84) * panels * ndl * 1.6 * (1.0 - sh * 0.95);
  float dots = step(0.82, fract(along * 2.0)) * (smoothstep(0.08, 0.0, abs(across - 0.1)) + smoothstep(0.08, 0.0, abs(across - 0.9)));
  float station = smoothstep(0.003, 0.0, abs(fract(vUv.x * 12.0) - 0.5) - 0.004);
  float flow = step(0.985, fract(along * 0.05 - uTime * 0.4)) * smoothstep(0.1, 0.0, abs(across - 0.5));
  col += vec3(1.0, 0.85, 0.55) * dots * 1.6 + vec3(0.5, 1.0, 0.95) * (station * 2.5 + flow * 3.0);
  gl_FragColor = vec4(col, 1.0);
  ${OUT}
}`,
    side: THREE.DoubleSide,
  });
}

function urMat() {
  return new THREE.ShaderMaterial({
    uniforms: { uSun: { value: SUN }, uTime: { value: 0 } },
    vertexShader: sphVert,
    fragmentShader: /* glsl */ `
${NOISE_GLSL}
uniform vec3 uSun; uniform float uTime;
varying vec3 vObj; varying vec3 vN; varying vec3 vW;
void main() {
  vec3 p = normalize(vObj);
  float lat = p.y, lon = atan(p.z, p.x);
  float w = fbm3(p * vec3(2.5, 10.0, 2.5) + vec3(uTime * 0.0015, 0.0, 0.0));
  float b = lat * 7.5 + w * 1.4 + 0.18 * sin(lon * 4.0 + lat * 22.0);
  float band = sin(b * 3.14159) * 0.5 + 0.5;
  float fine = fbm3(p * vec3(5.0, 46.0, 5.0) + w * 2.0);
  vec3 col = mix(vec3(0.88, 0.56, 0.3), vec3(0.96, 0.86, 0.68), band);
  col = mix(col, vec3(0.6, 0.27, 0.16), smoothstep(0.55, 0.85, fine) * (1.0 - band) * 0.8);
  col *= 0.85 + 0.3 * fine;
  col = mix(col, vec3(0.42, 0.5, 0.66), smoothstep(0.62, 0.95, abs(lat)));
  col = col * col;
  vec3 N = normalize(vN);
  vec3 Vd = normalize(cameraPosition - vW);
  float ndl = dot(N, uSun);
  float lit = smoothstep(-0.1, 0.35, ndl);
  vec3 term = mix(vec3(1.0, 0.45, 0.25), vec3(1.0), smoothstep(-0.05, 0.4, ndl));
  col = col * vec3(1.0, 0.96, 0.9) * 2.0 * lit * term;
  float fres = pow(1.0 - max(dot(N, Vd), 0.0), 2.5);
  col += mix(vec3(0.9, 0.55, 0.35), vec3(1.0, 0.85, 0.6), lit) * fres * smoothstep(-0.3, 0.2, ndl) * 0.8;
  gl_FragColor = vec4(col, 1.0);
  ${OUT}
}`,
  });
}

function urRingMat() {
  return new THREE.ShaderMaterial({
    uniforms: { uSun: { value: SUN } },
    vertexShader: /* glsl */ `
varying float vR; varying vec3 vW;
void main() { vR = length(position.xy) / ${UR_R.toFixed(1)}; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
${NOISE_GLSL}
varying float vR; varying vec3 vW;
void main() {
  float r = vR;
  float n = vnoise(vec2(r * 55.0, 1.0)) * 0.6 + vnoise(vec2(r * 190.0, 7.0)) * 0.4;
  float a = smoothstep(1.36, 1.42, r) * smoothstep(2.4, 2.28, r);
  a *= 0.35 + 0.65 * n;
  a *= 1.0 - 0.85 * smoothstep(0.03, 0.0, abs(r - 1.93));
  vec3 col = mix(vec3(0.85, 0.78, 0.68), vec3(0.7, 0.75, 0.85), n) * 1.3;
  gl_FragColor = vec4(col, a * 0.85);
  ${OUT}
}`,
    side: THREE.DoubleSide, transparent: true, depthWrite: false,
  });
}

function moonMat(tint) {
  return new THREE.ShaderMaterial({
    uniforms: { uSun: { value: SUN }, uTint: { value: new THREE.Color(tint) } },
    vertexShader: sphVert,
    fragmentShader: /* glsl */ `
${NOISE_GLSL}
uniform vec3 uSun; uniform vec3 uTint;
varying vec3 vObj; varying vec3 vN; varying vec3 vW;
void main() {
  vec3 p = normalize(vObj);
  float c = fbm3(p * 6.0) * 0.6 + 0.4;
  vec3 col = uTint * c * max(dot(normalize(vN), uSun), 0.0) * 1.8;
  gl_FragColor = vec4(col, 1.0);
  ${OUT}
}`,
  });
}

/** 배 표면: 정점 색·빛(part 의 color/emit) + 햇빛 + 세렌에서 오는 푸른 반사광 */
function shipMat() {
  return new THREE.ShaderMaterial({
    uniforms: { uSun: { value: SUN }, uSunK: { value: 1 }, uShineDir: { value: V(0, -1, 0) }, uShine: { value: new THREE.Color(0.1, 0.2, 0.24) } },
    vertexShader: /* glsl */ `
attribute vec3 color; attribute float emit;
varying vec3 vC; varying float vE; varying vec3 vN; varying vec3 vW;
void main() { vC = color; vE = emit; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
uniform vec3 uSun; uniform float uSunK; uniform vec3 uShineDir; uniform vec3 uShine;
varying vec3 vC; varying float vE; varying vec3 vN; varying vec3 vW;
void main() {
  vec3 N = normalize(vN);
  if (!gl_FrontFacing) N = -N;
  vec3 Vd = normalize(cameraPosition - vW);
  float d = max(dot(N, uSun), 0.0) * uSunK;
  vec3 H = normalize(uSun + Vd);
  float sp = pow(max(dot(N, H), 0.0), 40.0) * 0.5 * d;
  vec3 col = vC * (vec3(1.0, 0.96, 0.9) * 1.4 * d + uShine * (0.35 + 0.65 * max(dot(N, uShineDir), 0.0)) + vec3(0.012, 0.014, 0.02));
  col += vec3(1.0) * sp + vC * vE * 2.2;
  col += uShine * pow(1.0 - max(dot(N, Vd), 0.0), 3.0) * 0.25;
  gl_FragColor = vec4(col, 1.0);
  ${OUT}
}`,
    side: THREE.DoubleSide,
  });
}

/** 불꽃: 노즐 쪽이 밝고 끝으로 갈수록 사라지는 원뿔 (가장자리는 옅게) */
function plumeMat(color, k) {
  return new THREE.ShaderMaterial({
    uniforms: { uC: { value: new THREE.Color(color) }, uK: { value: k }, uT: { value: 0 } },
    vertexShader: /* glsl */ `
varying vec2 vUv; varying float vF;
void main() { vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vec3 n = normalize(normalMatrix * normal); vF = abs(dot(n, normalize(-mv.xyz))); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `
uniform vec3 uC; uniform float uK; uniform float uT;
varying vec2 vUv; varying float vF;
void main() {
  float along = 1.0 - vUv.y;
  float a = pow(along, 1.6) * pow(vF, 1.2) * (0.85 + 0.15 * sin(uT * 40.0 + vUv.y * 30.0));
  gl_FragColor = vec4(uC * uK * a, 1.0);
}`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
}
/** 노즐 = 원점, +x 로 뻗는 불꽃 */
function plumeMesh(len, rN, rF, color, k) {
  const g = new THREE.CylinderGeometry(rF, rN, len, 20, 1, true);
  g.translate(0, len / 2, 0);
  g.rotateZ(-Math.PI / 2);
  return new THREE.Mesh(g, plumeMat(color, k));
}

function plasmaMat() {
  return new THREE.ShaderMaterial({
    uniforms: { uK: { value: 0 }, uT: { value: 0 } },
    vertexShader: /* glsl */ `
varying float vF; varying vec3 vP;
void main() { vP = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); vec3 n = normalize(normalMatrix * normal); vF = 1.0 - abs(dot(n, normalize(-mv.xyz))); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `
uniform float uK; uniform float uT;
varying float vF; varying vec3 vP;
void main() {
  float fl = 0.75 + 0.25 * sin(uT * 37.0 + vP.x * 4.0) * sin(uT * 23.0 - vP.z * 5.0);
  float a = (pow(vF, 1.3) * 1.4 + 0.3) * fl;
  vec3 col = mix(vec3(1.0, 0.42, 0.18), vec3(1.0, 0.72, 0.92), vF);
  gl_FragColor = vec4(col * a * uK, 1.0);
}`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
}

const glowBasic = (c, k) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });

/** 기준 축: 앞(f)·위(u)·옆(s = f×u) → 회전 행렬 */
function basis(fwd, up) {
  const f = fwd.clone().normalize();
  const s = V().crossVectors(f, up).normalize();
  const u = V().crossVectors(s, f).normalize();
  return { f, u, s, q: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(f, u, s)) };
}
const at = (B, x, y, z, o = V()) => o.clone().addScaledVector(B.f, x).addScaledVector(B.u, y).addScaledVector(B.s, z);

// ── 우주 장면 ─────────────────────────────────────
class Space {
  constructor() {
    this.far = new THREE.Scene();
    this.near = new THREE.Scene();
    this.camFar = new THREE.PerspectiveCamera(50, 1, 10, 2.5e7);
    this.camNear = new THREE.PerspectiveCamera(50, 1, 0.3, 40000);
    this.anchor = V(); // 가까운 장면의 원점이 먼 장면(km)의 어디인가
    this.mats = [];
    this._sky();
    this._seren();
    this._ur();
    this._ships();
  }

  _sky() {
    const g = new THREE.Group();
    // 은하수 띠 (검은 바탕 + 옅은 띠)
    const band = new THREE.Mesh(new THREE.SphereGeometry(1.2e7, 32, 16), new THREE.ShaderMaterial({
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `${NOISE_GLSL}
varying vec3 vD;
void main(){
  vec3 n = normalize(vec3(0.3, 0.85, 0.42));
  float b = exp(-pow(dot(vD, n) / 0.2, 2.0)) * (0.45 + 0.55 * fbm3(vD * 7.0));
  vec3 col = vec3(0.004, 0.005, 0.012) + vec3(0.05, 0.05, 0.08) * b + vec3(0.06, 0.03, 0.05) * b * fbm3(vD * 13.0 + 3.0);
  gl_FragColor = vec4(col, 1.0);
}`,
      side: THREE.BackSide, depthWrite: false,
    }));
    band.renderOrder = -11;
    g.add(band);
    // 별
    const N = 3200, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), size = new Float32Array(N);
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < N; i++) {
      const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, r = Math.sqrt(1 - u * u);
      pos.set([Math.cos(a) * r * 1e7, u * 1e7, Math.sin(a) * r * 1e7], i * 3);
      const m = Math.pow(rnd(), 3);
      const t = rnd();
      const c = t < 0.2 ? [1.0, 0.8, 0.6] : t < 0.4 ? [0.7, 0.8, 1.0] : [1, 1, 1];
      const k = 0.4 + m * 2.6;
      col.set([c[0] * k, c[1] * k, c[2] * k], i * 3);
      size[i] = 1.2 + m * 3.2;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    sg.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
    sg.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    const stars = new THREE.Points(sg, new THREE.ShaderMaterial({
      vertexShader: 'attribute vec3 aCol; attribute float aSize; varying vec3 vC; void main(){ vC = aCol; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize; }',
      fragmentShader: 'varying vec3 vC; void main(){ float a = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5)); gl_FragColor = vec4(vC * a, 1.0); }',
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    stars.renderOrder = -10;
    g.add(stars);
    // 해
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const cx = cv.getContext('2d');
    const gr = cx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.12, 'rgba(255,244,220,0.9)'); gr.addColorStop(0.35, 'rgba(255,200,140,0.18)'); gr.addColorStop(1, 'rgba(255,180,120,0)');
    cx.fillStyle = gr; cx.fillRect(0, 0, 128, 128);
    const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), color: new THREE.Color(3, 2.8, 2.5), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    sun.position.copy(SUN).multiplyScalar(9e6);
    sun.scale.setScalar(9e6 * 0.12);
    g.add(sun);
    this.skyG = g;
    this.far.add(g);
  }

  _seren() {
    this.planetMat = planetMat();
    this.far.add(new THREE.Mesh(new THREE.SphereGeometry(R, 256, 160), this.planetMat));
    this.far.add(new THREE.Mesh(new THREE.SphereGeometry(R * 1.035, 160, 100), haloMat()));
    // 아웬의 궤도 고리 (적도면) + 멀리서도 보이게 빛 선
    this.hoopMat = hoopMat();
    this.far.add(new THREE.Mesh(new THREE.CylinderGeometry(RING_R, RING_R, 30, 720, 1, true), this.hoopMat));
    const lp = [];
    for (let i = 0; i <= 720; i++) { const a = (i / 720) * Math.PI * 2; lp.push(V(Math.cos(a) * RING_R, 0, Math.sin(a) * RING_R)); }
    const ringLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(lp), new THREE.LineBasicMaterial({ color: new THREE.Color(0.55, 0.75, 0.8), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.far.add(ringLine);
    // 승강줄: 적도의 땅에서 고리까지
    const tp = [];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.3;
      tp.push(V(Math.cos(a) * R, 0, Math.sin(a) * R), V(Math.cos(a) * RING_R, 0, Math.sin(a) * RING_R));
    }
    this.far.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(tp), new THREE.LineBasicMaterial({ color: new THREE.Color(0.9, 1.6, 1.5), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })));
  }

  _ur() {
    this.urMat = urMat();
    const ur = new THREE.Mesh(new THREE.SphereGeometry(UR_R, 96, 64), this.urMat);
    ur.position.copy(UR_POS);
    this.far.add(ur);
    const ring = new THREE.Mesh(new THREE.RingGeometry(UR_R * 1.36, UR_R * 2.42, 192, 1), urRingMat());
    ring.position.copy(UR_POS);
    ring.rotation.set(-Math.PI / 2 + 0.32, 0, 0.25);
    this.far.add(ring);
    for (const [d, r, tint] of [[V(1.9, 0.3, 1.2), 1400, 0xb8b0a8], [V(-2.6, -0.4, 0.6), 900, 0xc8d0dc]]) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), moonMat(tint));
      m.position.copy(UR_POS).addScaledVector(d, UR_R);
      this.far.add(m);
    }
  }

  _ships() {
    this.shipMat = shipMat();
    const lark = buildLark(this.shipMat, glowBasic);
    this.lark = lark;
    this.near.add(lark.root);
    // 라르크 호 엔진 불꽃
    const p1 = plumeMesh(46, 3.2, 7.5, 0x8fc8ff, 1.2), p2 = plumeMesh(20, 1.4, 2.2, 0xe8f4ff, 2.6);
    p1.rotation.y = p2.rotation.y = Math.PI; // −x 로
    lark.plume.add(p1, p2);
    this.larkPlumes = [p1, p2];
    // 착륙선 (닫힌 해치)
    const sh = landerShell({ landed: false });
    const lg = new THREE.Group();
    lg.add(new THREE.Mesh(merge([...sh.parts, ...sh.glass]), this.shipMat));
    for (const [[lx, lz], y, c] of sh.navs) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), glowBasic(c, 4)); m.position.set(lx, y, lz); lg.add(m); }
    // 주 엔진 불꽃 둘 (뒤로)
    this.landerPlumes = [];
    for (const sz of [-0.95, 0.95]) {
      const p = plumeMesh(14, 0.45, 1.4, 0x9fd0ff, 1.8);
      p.position.set(-6.0, 2.35, sz);
      p.rotation.y = Math.PI;
      p.visible = false;
      lg.add(p);
      this.landerPlumes.push(p);
    }
    // 자세 제어 분사 (윗면 넷, 위로 뿜어 아래로 민다)
    this.rcs = [];
    for (const [x, z] of [[4.2, 1.6], [4.2, -1.6], [-4.4, 2.05], [-4.4, -2.05]]) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), glowBasic(0xdfe8ff, 1.4));
      m.position.set(x, 3.4, z);
      m.visible = false;
      lg.add(m);
      this.rcs.push(m);
    }
    // 진입할 때 배 밑의 불덩이 + 꼬리
    { // 공기가 부딪는 앞·아래쪽에 씌운 반구 (충격파 껍질)
      const cap = new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.5);
      cap.rotateZ(-Math.PI / 2 - 0.5); // 극(+y) → 앞·아래
      this.plasma = new THREE.Mesh(cap, plasmaMat());
    }
    this.plasma.scale.set(7.0, 4.2, 4.4);
    this.plasma.position.set(0.8, 2.0, 0);
    this.plasma.visible = false;
    lg.add(this.plasma);
    this.trail = plumeMesh(40, 3.2, 9, 0xff8a5a, 0);
    this.trail.rotation.y = Math.PI;
    this.trail.position.set(-4, 1.2, 0);
    this.trail.visible = false;
    lg.add(this.trail);
    this.landerG = lg;
    this.near.add(lg);
  }

  /** 가까운 장면의 빛: 그림자 속인지, 세렌 쪽 반사광 */
  light() {
    const a = this.anchor;
    const d = a.dot(SUN);
    const perp = Math.sqrt(Math.max(0, a.lengthSq() - d * d));
    this.shipMat.uniforms.uSunK.value = d < 0 ? ss(R * 0.97, R * 1.03, perp) : 1;
    const dist = a.length();
    this.shipMat.uniforms.uShineDir.value.copy(a).multiplyScalar(-1 / dist);
    const k = Math.min(0.55, (R / dist) ** 2 * 2.5) * Math.max(0.15, ss(-0.5, 0.6, a.clone().normalize().dot(SUN)));
    this.shipMat.uniforms.uShine.value.setRGB(0.1 * k + 0.01, 0.22 * k + 0.012, 0.26 * k + 0.02);
  }

  /** camPos·look (가까운 장면 m), up, fov */
  view(camPos, look, up, fov, aspect) {
    const c = this.camNear;
    c.position.copy(camPos);
    c.up.copy(up);
    c.lookAt(look);
    c.fov = fov; c.aspect = aspect;
    c.updateProjectionMatrix();
    const f = this.camFar;
    f.position.copy(this.anchor).addScaledVector(camPos, 0.001);
    f.quaternion.copy(c.quaternion);
    f.fov = fov; f.aspect = aspect;
    f.updateProjectionMatrix();
    this.skyG.position.copy(f.position);
  }

  draw(renderer) {
    renderer.render(this.far, this.camFar);
    renderer.clearDepth();
    renderer.render(this.near, this.camNear);
  }

  dispose() {
    for (const sc of [this.far, this.near]) sc.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } });
  }
}

// ── 연출 ─────────────────────────────────────────
export class Approach {
  constructor(game, onEnd) {
    this.game = game;
    this.onEnd = onEnd;
    this.space = new Space();
    this.sfx = {};
    const L = game.structures.lander;
    this.L = L;
    const c = Math.cos(L.ry), s = Math.sin(L.ry);
    this.fwdW = V(c, 0, -s); // 착륙선 앞(+x)의 세계 방향
    this.F = V(L.X, L.Y, L.Z);
    const g = (lx, lz, up) => { const [x, z] = L.W(lx, lz); return V(x, heightAt(x, z) + up, z); };
    this.P1 = g(30, 46, 4.5);
    this.P2 = g(-20, 30, 2.4);
    // 궤도 장면의 자리
    const Q = V().crossVectors(SUN, Y).normalize();
    this.n3 = V().addScaledVector(SUN, 0.12).addScaledVector(Q, 0.99).addScaledVector(Y, -0.07).normalize();
    this.v3 = V().crossVectors(Y, this.n3).normalize();
    this.nB = V().addScaledVector(SUN, 0.45).addScaledVector(Q, 0.86).addScaledVector(Y, 0.1).normalize();
    this.vB = V().crossVectors(Y, this.nB).normalize();
    this._caption();
    this.lines = [
      [0.8, 4.8, '신호를 따라 312일.'],
      [5.4, 9.8, '배에는 둘이 있었다.<br>조종사, 그리고 배의 지능 「모아」.'],
      [10.4, 14.8, '가스행성 「우르」를 도는 위성에서,<br>우리는 노래를 들었다.'],
      [15.4, 19.8, '궤도에서 내려다본 그 별에는<br>고리와 탑과, 밤새 빛나는 도시가 있었다.'],
      [20.3, 24.6, '<span class="cm-h">모아 · 라르크 호 → 착륙선</span>「분리 확인. 저는 여기 궤도의 배에 남아요.<br>착륙선 안테나로 계속 이어져 있을게요 — 다녀오세요, 조종사님.」', 'moa-line'],
      [25.0, 29.6, '모아는 궤도의 배에 남고,<br>조종사 혼자 착륙선을 타고 내려갔다.'],
      [TB + 1.2, TB + 6.8, '누군가 들판에 빛을 밝혀 두었다.<br>— 내려와도 좋다고.'],
    ];
    this.cur = -1;
    game.engine.space = this.space;
    game._hideAvatar = true;
    setTimeout(() => game.ui.fade(false), 350);
  }

  _caption() {
    const el = document.createElement('div');
    el.className = 'caption cine';
    el.innerHTML = '<div class="c"></div><div class="skip">눌러서 넘기기</div>';
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); this.game.director.skip(); });
    this.game.ui.root.appendChild(el);
    this.capEl = el;
    this.capC = el.querySelector('.c');
  }

  _lines(t) {
    let idx = -1;
    this.lines.forEach((l, i) => { if (t >= l[0] && t < l[1]) idx = i; });
    if (idx === this.cur) return;
    this.cur = idx;
    const c = this.capC;
    if (idx < 0) { c.classList.remove('on'); return; }
    const l = this.lines[idx];
    c.innerHTML = l[2];
    c.className = 'c ' + (l[3] || '');
    void c.offsetWidth;
    c.classList.add('on');
    if (l[3] === 'moa-line' && this.game.comm) this.game.comm.pulse();
  }

  /** 한 번만 나는 소리 */
  _once(key, fn) { if (!this.sfx[key]) { this.sfx[key] = true; fn(); } }

  frame(t, dt) {
    const g = this.game;
    this._lines(t);
    if (t < TB) this._space(t, dt);
    else this._world(t - TB, dt);
  }

  // ── 우주 ──
  _space(t, dt) {
    const S = this.space, g = this.game, lark = S.lark;
    // 세계 카메라는 들판 첫 장면 자리에 (지형이 미리 만들어지게)
    g.rig.override = { pos: this.P1, look: this.F.clone().setY(this.F.y + 80) };
    for (const m of [S.planetMat, S.hoopMat, S.urMat]) m.uniforms.uTime.value = t;
    lark.ring.rotation.x = t * 0.12;
    lark.navs.forEach((m, i) => (m.visible = i < 2 || Math.sin(t * 6 + i) > 0.7));
    for (const p of [...S.larkPlumes, ...S.landerPlumes, S.trail]) p.material.uniforms.uT.value = t;
    S.plasma.material.uniforms.uT.value = t;
    const aspect = g.engine.camera.aspect;
    let cam, look, up, fov = 50;

    if (t < T3) {
      // 라르크 호 기준
      let B;
      if (t < T2) {
        const D = 70000 * Math.pow(5600 / 70000, ss(0, 1, t / T2) * 0.35 + (t / T2) * 0.65);
        S.anchor.copy(A_DIR).multiplyScalar(D);
        const B0 = basis(A_DIR.clone().negate(), Y);
        // 돌아서기 (9.5~12 초) → 엔진이 세렌 쪽
        const turn = ss(9.5, 12, t) * Math.PI;
        const f = B0.f.clone().multiplyScalar(Math.cos(turn)).addScaledVector(B0.s, Math.sin(turn));
        B = basis(f, B0.u);
        const burn = ss(12, 12.8, t) * (1 - ss(15.4, 16, t));
        lark.plume.visible = burn > 0.01;
        S.larkPlumes[0].material.uniforms.uK.value = 1.2 * burn;
        S.larkPlumes[1].material.uniforms.uK.value = 2.6 * burn;
        if (burn > 0.01) this._once('burn', () => audio.noise({ freq: 150, q: 0.5, dur: 4.2, gain: 0.12, type: 'lowpass', attack: 0.6 }));
        if (t > 9.5) this._once('rcs1', () => audio.noise({ freq: 2600, q: 0.8, dur: 0.35, gain: 0.05 }));
        if (t < T1) {
          // 1: 배 곁에서 — 앞에 세렌, 뒤로 우르
          const k = t / T1;
          cam = at(B0, lerp(-78, -58, k), lerp(16, 10, k), lerp(-40, -30, k));
          look = at(B0, lerp(40, 70, k), -4, 0);
          up = B0.u;
          this._once('hum', () => audio.noise({ freq: 90, q: 0.4, dur: 9, gain: 0.05, type: 'lowpass', attack: 2 }));
        } else {
          // 2: 배 뒤 아래에서 — 커지는 세렌과 고리, 돌아서서 감속
          const k = (t - T1) / (T2 - T1);
          cam = at(B0, lerp(-190, -165, k), lerp(-30, -22, k), lerp(70, 58, k));
          look = at(B0, 300, lerp(-20, -50, k), lerp(-20, -30, k));
          up = B0.u;
          fov = 52;
        }
      } else {
        // 3: 궤도 고리 위 — 분리
        const u = t - T2;
        S.anchor.copy(this.n3).multiplyScalar(R + 650).addScaledVector(this.v3, 7.5 * u);
        B = basis(this.v3, this.n3);
        lark.plume.visible = false;
      }
      lark.root.position.set(0, 0, 0);
      lark.root.quaternion.copy(B.q);
      lark.root.updateMatrixWorld(true);
      // 착륙선: 집게에 물려 있다가(18 초) 떨어져 내려가고, 돌아서(20.5~22.5) 역분사
      const LG = S.landerG;
      const rel = Math.max(0, t - 18);
      let lx = -4, ly = -6.5, lz = 0, yaw = 0;
      if (t >= 18) {
        ly -= 0.45 * rel * rel * (rel < 3 ? 1 : 0) + (rel >= 3 ? 4.05 + 2.7 * (rel - 3) : 0);
        yaw = ss(20.5, 22.5, t) * Math.PI;
        const bt = Math.max(0, t - 22.5);
        lx -= 3.2 * bt * bt;
        ly -= 0.6 * bt * bt;
      }
      const Bl = basis(B.f.clone().multiplyScalar(Math.cos(yaw)).addScaledVector(B.s, -Math.sin(yaw)), B.u);
      LG.position.copy(at(B, lx, ly, lz));
      LG.quaternion.copy(Bl.q);
      S.rcs.forEach((m, i) => { m.visible = (t > 18 && t < 18.7 && i % 1 === 0) || (t > 20.5 && t < 22.5 && Math.sin(t * 9 + i * 2) > 0.6); m.scale.setScalar(0.6 + Math.random() * 0.6); });
      const lburn = ss(22.5, 23.1, t);
      S.landerPlumes.forEach((p) => { p.visible = lburn > 0.01; p.material.uniforms.uK.value = 1.8 * lburn; });
      if (t > 18) this._once('clamp', () => { audio.blip({ hz: 160, to: 70, dur: 0.3, gain: 0.18, type: 'triangle' }); audio.noise({ freq: 2400, q: 0.8, dur: 0.6, gain: 0.06 }); });
      if (lburn > 0.01) this._once('lburn', () => audio.noise({ freq: 220, q: 0.5, dur: 4.6, gain: 0.1, type: 'lowpass', attack: 0.4 }));
      // 모아의 접시가 착륙선을 겨눈다 (분리 뒤)
      const dishTo = t > 18 ? LG.position.clone() : at(B, 40, 30, 0);
      lark.dish.lookAt(dishTo);
      lark.dish.userData.feed.material.color.setRGB(0.5, 1, 0.92).multiplyScalar(t > 20.2 && t < 24.6 ? 5 + Math.sin(t * 14) * 2 : 3);
      if (t >= T2) {
        const k = (t - T2) / (T3 - T2);
        const w = ss(21.5, 26, t);
        cam = at(B, lerp(-6, -26, k), lerp(20, 12, k), lerp(34, 42, k));
        look = at(B, -4, -10, 0).lerp(LG.position.clone().addScaledVector(B.u, -6), w * 0.85);
        up = B.u;
        fov = 54;
      }
      S.landerG.visible = true;
      S.plasma.visible = S.trail.visible = false;
    } else {
      // 진입: 착륙선 기준. 배 밑이 달아오르고 흔들린다
      const u = (t - T3) / (TB - T3);
      const h = lerp(240, 95, u);
      S.anchor.copy(this.nB).multiplyScalar(R + h);
      const pitch = 0.5;
      const f = this.vB.clone().multiplyScalar(Math.cos(pitch)).addScaledVector(this.nB, Math.sin(pitch));
      const B = basis(f, this.nB);
      S.lark.root.visible = false;
      const LG = S.landerG;
      LG.position.set(0, 0, 0);
      LG.quaternion.copy(B.q);
      S.landerPlumes.forEach((p) => (p.visible = false));
      S.rcs.forEach((m) => (m.visible = false));
      const heat = ss(T3 + 0.4, T3 + 3.6, t);
      S.plasma.visible = S.trail.visible = heat > 0.01;
      S.plasma.material.uniforms.uK.value = heat * 1.6;
      S.trail.material.uniforms.uK.value = heat * 0.6;
      const sh = heat * 0.35;
      const j = V((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh);
      const Bv = basis(this.vB, this.nB);
      cam = at(Bv, -24, 8, 9).add(j);
      look = at(Bv, 18, -9, 0);
      up = this.nB;
      fov = 55;
      this._once('entry', () => audio.noise({ freq: 300, q: 0.6, dur: 5, gain: 0.2, type: 'bandpass', sweep: 1500, attack: 1.6 }));
      if (t > TB - 0.9) this._once('white', () => g.ui.flash('#fff1dc', 2600));
    }
    S.light();
    S.view(cam, look, up, fov, aspect);
  }

  // ── 들판: 착륙선이 하강 분사로 내려앉는다 ──
  _enterWorld() {
    if (this.worldOn) return;
    this.worldOn = true;
    const g = this.game;
    g.engine.space = null;
    this.space.dispose();
    this.L.group.visible = false;
    // 내려앉는 착륙선 (닫힌 해치) + 하강 불꽃 + 먼지
    const sh = landerShell({ landed: false });
    const P = new THREE.Group();
    const mats = g.structures.mats;
    P.add(new THREE.Mesh(merge(sh.parts), mats.stone));
    P.add(new THREE.Mesh(merge(sh.glass), mats.crystal));
    this.flames = THRUSTERS.map(([x, z]) => {
      const f = plumeMesh(9, 0.34, 1.3, 0xbfe0ff, 2.6);
      f.position.set(x, 0.8, z);
      f.rotation.z = -Math.PI / 2; // 아래로
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), glowBasic(0xe8f4ff, 3));
      core.position.set(x, 0.7, z);
      core.scale.y = 0.6;
      P.add(f, core);
      f.userData.core = core;
      return f;
    });
    for (const [[lx, lz], y, c] of sh.navs) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), glowBasic(c, 4)); m.position.set(lx, y, lz); P.add(m); }
    P.rotation.order = 'YZX';
    g.engine.scene.add(P);
    this.proxy = P;
    this.dust = [];
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(new THREE.RingGeometry(0.6, 1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xd8dccb, transparent: true, opacity: 0, depthWrite: false }));
      m.position.copy(this.F).y += 0.25 + i * 0.12;
      g.engine.scene.add(m);
      this.dust.push(m);
    }
    this._camLook = null;
    audio.noise({ freq: 240, q: 0.5, dur: 10.2, gain: 0.16, type: 'lowpass', attack: 1.2 });
  }

  _world(w, dt) {
    const g = this.game;
    this._enterWorld();
    const s = Math.min(1, w / 10);
    const hoff = 440 * Math.pow(1 - s, 2.6);
    const alt = 300 * Math.pow(1 - s, 1.8);
    const P = this.proxy;
    P.position.copy(this.F).addScaledVector(this.fwdW, -hoff).y += alt;
    P.rotation.set(0, this.L.ry, 0.38 * Math.pow(1 - s, 0.7) * (1 - ss(0.75, 0.95, s)) + Math.sin(w * 1.3) * 0.02 * (1 - s));
    const down = w >= 10;
    const thr = down ? Math.max(0, 1 - (w - 10) / 0.35) : 0.45 + 0.55 * ss(0.5, 0.92, s);
    for (const f of this.flames) { f.visible = f.userData.core.visible = thr > 0.01; f.material.uniforms.uK.value = 2.6 * thr; f.material.uniforms.uT.value = w; f.scale.set(0.7 + thr * 0.5, 1, 1); f.userData.core.scale.setScalar(0.6 + thr * 0.7 + Math.random() * 0.15); }
    // 먼지 고리
    const near = ss(30, 4, alt);
    this.dust.forEach((m, i) => {
      const ph = (w * 0.55 + i / 3) % 1;
      const burst = down ? ss(10, 10.4, w) * (1 - ss(10.6, 13, w)) : 0;
      const r = 3 + ph * (9 + burst * 10);
      m.scale.set(r, 1, r);
      m.material.opacity = (near * thr * 0.5 + burst * 0.6) * (1 - ph) * 0.8;
    });
    if (down) this._once('touch', () => { audio.blip({ hz: 90, to: 38, dur: 0.6, gain: 0.35, type: 'sine' }); audio.noise({ freq: 400, q: 0.4, dur: 1.4, gain: 0.12, type: 'lowpass' }); g.rig.shake(0.5); });
    // 카메라: 빛 표지 곁에서 올려다보다가, 가까이 낮게
    const pos = w < 6 ? this.P1.clone().lerp(this.P1.clone().add(V(0, -1.5, 0)), w / 6) : this.P2.clone().lerp(this.P2.clone().addScaledVector(this.fwdW, 3), ss(6, 12, w));
    const want = this.F.clone().add(V(0, 6, 0)).lerp(P.position.clone().add(V(0, 2.4, 0)), w < 6 ? 0.9 : 0.6);
    if (!this._camLook || (w >= 6 && !this._cut2)) { this._camLook = want.clone(); if (w >= 6) this._cut2 = true; }
    this._camLook.lerp(want, 1 - Math.exp(-dt * 4));
    g.rig.override = { pos, look: this._camLook.clone(), fov: w < 6 ? lerp(30, 40, ss(0, 6, w)) : 56 };
    if (w > TW - 1.2) this._once('fade', () => g.ui.fade(true));
  }

  /** 넘기기: 우주 → 들판, 들판 → 끝 */
  skip(seq) {
    if (seq.t < TB) { seq.t = TB; this.cur = -1; return true; }
    return false;
  }

  finish() {
    const g = this.game;
    if (g.engine.space === this.space) { g.engine.space = null; this.space.dispose(); }
    if (this.proxy) {
      g.engine.scene.remove(this.proxy);
      this.proxy.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material && !Object.values(g.structures.mats).includes(o.material)) o.material.dispose(); });
    }
    for (const m of this.dust || []) { g.engine.scene.remove(m); m.geometry.dispose(); m.material.dispose(); }
    this.L.group.visible = true;
    g._hideAvatar = false;
    this.capEl.remove();
    g.ui.fade(true, true);
    this.onEnd && this.onEnd();
  }
}

/** 오프닝 시작 (?at=초 로 중간부터) */
export function playApproach(game, onEnd) {
  const A = new Approach(game, onEnd);
  game.director.run(TOTAL, (k, t, dt) => A.frame(t, dt), () => A.finish());
  game.director.seq.onSkip = (seq) => A.skip(seq);
  const at0 = +(game.params.get('at') || 0);
  if (at0 > 0) game.director.seq.t = at0;
  game.approach = A;
  return A;
}
