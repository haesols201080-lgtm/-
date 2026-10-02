// 하늘: 하늘 돔(그라데이션·별·은하수·오로라·높은 구름), 가스행성 우르와 고리,
// 아웬이 만든 궤도 고리(후프)와 척추 승강줄의 윗부분.
// 하늘 장면은 카메라 위치를 원점으로 하는 별도 장면/카메라로 먼저 그리고, 그 위에 세계를 그립니다.
import * as THREE from 'three';
import { NOISE_GLSL, ATMOS_PARS } from './shaders.js';
import { atmosUniforms } from './atmosphere.js';
import { UR_DIR, UR_RADIUS } from './sky-clock.js';
import { mulberry32 } from '../core/noise.js';

const _Z = new THREE.Vector3(0, 0, 1);
const _Y = new THREE.Vector3(0, 1, 0);

const SKY_R = 3.0e6;
const UR_DIST = 1.6e6;
export const SKY_SCALE = 0.05; // 세계 1 m → 하늘 장면 0.05 단위 (궤도 고리·승강줄용)
export const PLANET_R = 2.0e6; // 세렌 반지름 (m)
export const RING_ALT = 520000; // 궤도 고리 고도 (m)

const OUT = /* glsl */ `
#include <tonemapping_fragment>
#include <colorspace_fragment>
`;

const domeVert = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;

const domeFrag = /* glsl */ `
${NOISE_GLSL}
${ATMOS_PARS}
uniform float uCloudCover;
varying vec3 vDir;

vec3 stars(vec3 rd) {
  vec3 col = vec3(0.0);
  for (int layer = 0; layer < 2; layer++) {
    float sc = layer == 0 ? 150.0 : 340.0;
    vec3 p = rd * sc;
    vec3 cell = floor(p);
    vec3 f = fract(p) - 0.5;
    float h = hash13(cell + float(layer) * 31.0);
    float thr = layer == 0 ? 0.982 : 0.988;
    if (h > thr) {
      vec3 o = vec3(hash13(cell + 1.3), hash13(cell + 2.7), hash13(cell + 5.1)) - 0.5;
      float d = length(f - o * 0.5);
      float b = smoothstep(0.16, 0.0, d);
      float tw = 0.65 + 0.35 * sin(uTime * (1.5 + h * 4.0) + h * 400.0);
      vec3 tint = mix(vec3(0.65, 0.78, 1.0), vec3(1.0, 0.82, 0.62), hash13(cell + 9.0));
      col += tint * b * tw * (layer == 0 ? 2.6 : 1.1) * (h - thr) / (1.0 - thr) * 2.0;
    }
  }
  return col;
}

vec3 galaxy(vec3 rd) {
  vec3 n = normalize(vec3(0.42, 0.62, 0.66));
  float d = dot(rd, n);
  float band = exp(-d * d * 14.0);
  float detail = fbm3(rd * 7.0);
  float dust = smoothstep(0.45, 0.75, fbm3(rd * 13.0 + 3.0));
  vec3 c = mix(vec3(0.35, 0.3, 0.6), vec3(0.75, 0.5, 0.6), detail);
  return c * band * (detail * 0.9 + 0.1) * (1.0 - dust * 0.7) * 0.22;
}

vec3 aurora(vec3 rd) {
  if (rd.y < 0.02) return vec3(0.0);
  float az = atan(rd.x, -rd.z);
  float north = smoothstep(1.7, 0.3, abs(az));
  float fold = az * 2.2 + 0.5 * sin(az * 5.0 + uTime * 0.07) + 0.3 * sin(az * 11.0 - uTime * 0.05);
  float base = 0.07 + 0.05 * sin(fold * 1.7 + uTime * 0.03);
  float y = rd.y - base;
  float band = smoothstep(0.0, 0.025, y) * exp(-max(y, 0.0) * 5.0);
  float rays = 0.45 + 0.55 * vnoise(vec2(fold * 46.0, uTime * 0.35));
  float curtain = smoothstep(0.25, 0.85, vnoise(vec2(fold * 3.0, uTime * 0.04)));
  vec3 c = mix(vec3(0.15, 1.0, 0.6), vec3(0.6, 0.3, 1.0), smoothstep(0.0, 0.3, y));
  return c * band * rays * curtain * north * 0.55;
}

// 궤도를 도는 위성·거울: 밤하늘을 천천히 가로지르는 빛점 (가끔 햇빛을 반사해 번쩍인다)
vec3 satellites(vec3 rd) {
  vec3 col = vec3(0.0);
  for (int i = 0; i < 9; i++) {
    float fi = float(i);
    vec3 n = normalize(vec3(sin(fi * 2.7 + 0.3), 0.35 + 0.5 * fract(fi * 0.37), cos(fi * 1.9 + 1.1)));
    vec3 a = normalize(cross(n, vec3(0.0, 1.0, 0.0)));
    vec3 b = cross(n, a);
    float w = uTime * (0.006 + 0.004 * fract(fi * 0.61)) + fi * 1.7;
    vec3 p = a * cos(w) + b * sin(w);
    float d = 1.0 - dot(rd, p);
    float flare = pow(max(0.0, sin(uTime * 0.05 + fi * 3.1)), 40.0);
    col += vec3(0.9, 0.95, 1.0) * (smoothstep(4e-7, 0.0, d) * 1.6 + smoothstep(3e-5, 0.0, d) * flare * 3.0);
  }
  return col;
}

void main() {
  vec3 rd = normalize(vDir);
  vec3 col = skyBase(rd);

  float starVis = clamp(uNight * 1.15 + uEclipse * 0.9, 0.0, 1.0) * smoothstep(-0.02, 0.18, rd.y);
  if (starVis > 0.001) {
    col += (stars(rd) + galaxy(rd)) * starVis;
    col += aurora(rd) * uNight;
    col += satellites(rd) * starVis;
  }

  // 해
  float sd = dot(rd, uSunDir);
  float disc = smoothstep(0.99986, 0.99993, sd);
  col += uSunColor * disc * 50.0;
  col += uSunColor * pow(max(sd, 0.0), 900.0) * 5.0;

  // 높은 새털구름
  if (rd.y > 0.0) {
    vec2 uv = rd.xz / (rd.y + 0.08);
    vec2 q = uv * vec2(0.9, 2.6) + vec2(uTime * 0.004, 0.0);
    float c = fbm2(q * 1.4 + fbm2(q * 0.7) * 1.3);
    float cov = smoothstep(1.0 - uCloudCover, 1.18 - uCloudCover * 0.6, c);
    cov *= smoothstep(0.0, 0.25, rd.y);
    vec3 lit = uAmbTop * 1.6 + uSunColor * 0.75 + uHorizonGlow * 0.7 + uUrLight * 1.1;
    col = mix(col, lit, cov * 0.75);
  }

  gl_FragColor = vec4(col, 1.0);
  ${OUT}
}`;

// ── 우르 ───────────────────────────────────────────
const urVert = /* glsl */ `
varying vec3 vN;
varying vec3 vObj;
varying vec3 vWorld;
void main() {
  vObj = normalize(position);
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const urFrag = /* glsl */ `
${NOISE_GLSL}
${ATMOS_PARS}
uniform vec3 uSunObj;
varying vec3 vN;
varying vec3 vObj;
varying vec3 vWorld;

vec3 urAlbedo(vec3 p) {
  float lat = p.y;
  float lon = atan(p.z, p.x);
  float w = fbm3(p * vec3(2.5, 10.0, 2.5) + vec3(uTime * 0.0015, 0.0, 0.0));
  float b = lat * 7.5 + w * 1.4 + 0.18 * sin(lon * 4.0 + lat * 22.0 + uTime * 0.01);
  float band = sin(b * 3.14159) * 0.5 + 0.5;
  float fine = fbm3(p * vec3(5.0, 46.0, 5.0) + w * 2.0);
  vec3 cream = vec3(0.96, 0.86, 0.68);
  vec3 amber = vec3(0.88, 0.56, 0.3);
  vec3 rust = vec3(0.6, 0.27, 0.16);
  vec3 polar = vec3(0.42, 0.5, 0.66);
  vec3 col = mix(amber, cream, band);
  col = mix(col, rust, smoothstep(0.55, 0.85, fine) * (1.0 - band) * 0.8);
  col *= 0.85 + 0.3 * fine;
  // 대폭풍의 눈
  vec3 eye = normalize(vec3(cos(1.1) * 0.93, -0.36, sin(1.1) * 0.93));
  float de = distance(p, eye);
  float sw = sin(de * 90.0 - atan(p.y - eye.y, p.x - eye.x) * 2.0);
  float storm = smoothstep(0.16, 0.0, de);
  col = mix(col, mix(vec3(0.75, 0.3, 0.18), vec3(1.0, 0.75, 0.55), sw * 0.5 + 0.5), storm * 0.9);
  col = mix(col, polar, smoothstep(0.62, 0.95, abs(lat)));
  return col * col; // 대략 선형화
}

void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 rd = -V;
  vec3 alb = urAlbedo(vObj);

  float ndl = dot(N, uSunDir);
  float lit = smoothstep(-0.12, 0.4, ndl);
  vec3 term = mix(vec3(1.0, 0.45, 0.25), vec3(1.0), smoothstep(-0.05, 0.4, ndl));
  // 고리 그림자
  float ringSh = 1.0;
  if (uSunObj.y * vObj.y < 0.0) {
    float t = -vObj.y / uSunObj.y;
    vec2 q = vObj.xz + uSunObj.xz * t;
    float r = length(q);
    float band = smoothstep(1.35, 1.45, r) * smoothstep(2.4, 2.3, r) * (0.55 + 0.45 * vnoise(vec2(r * 40.0, 0.0)));
    ringSh = 1.0 - band * 0.75;
  }
  vec3 sunC = vec3(1.0, 0.96, 0.9) * 2.4;
  vec3 col = alb * sunC * lit * term * ringSh;

  float fres = pow(1.0 - max(dot(N, V), 0.0), 2.5);
  vec3 limbC = mix(vec3(0.9, 0.55, 0.35), vec3(1.0, 0.85, 0.6), lit);
  col += limbC * fres * smoothstep(-0.3, 0.2, ndl) * 0.9;
  // 일식 때 뒤에서 비치는 빛의 테
  float fwd = pow(max(dot(rd, uSunDir), 0.0), 6.0);
  col += vec3(1.0, 0.7, 0.45) * pow(fres, 1.3) * fwd * 6.0;
  // 밤면의 희미한 번개
  float flash = step(0.985, vnoise(vec2(floor(uTime * 3.0), 3.0))) * smoothstep(0.08, 0.0, distance(vObj, normalize(vec3(sin(floor(uTime * 3.0)), 0.2, cos(floor(uTime * 3.0))))));
  col += vec3(0.6, 0.7, 1.0) * flash * (1.0 - lit) * 0.6;

  float T = mix(0.5, 0.95, smoothstep(0.0, 0.7, rd.y));
  vec3 sky = skyBase(rd);
  col = col * T + sky * mix(0.32, 0.06, uNight);
  gl_FragColor = vec4(col, 1.0);
  ${OUT}
}`;

const ringVert = /* glsl */ `
varying vec3 vN;
varying vec3 vObj;
varying vec3 vWorld;
void main() {
  vObj = position;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const ringFrag = /* glsl */ `
${NOISE_GLSL}
${ATMOS_PARS}
uniform vec3 uSunObj;
varying vec3 vObj;
varying vec3 vWorld;
varying vec3 vN;
void main() {
  float r = length(vObj.xz);
  float n = vnoise(vec2(r * 55.0, 1.0)) * 0.6 + vnoise(vec2(r * 190.0, 7.0)) * 0.4;
  float a = smoothstep(1.36, 1.42, r) * smoothstep(2.4, 2.28, r);
  a *= 0.35 + 0.65 * n;
  a *= 1.0 - 0.85 * smoothstep(0.03, 0.0, abs(r - 1.93));
  a *= 1.0 - 0.5 * smoothstep(0.02, 0.0, abs(r - 2.15));
  if (a < 0.01) discard;
  // 우르 그림자
  vec3 L = uSunObj;
  vec3 Q = vec3(vObj.x, 0.0, vObj.z);
  float b = dot(Q, L);
  float c = dot(Q, Q) - 1.0;
  float shadow = (b < 0.0 && b * b - c > 0.0) ? 0.08 : 1.0;
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 rd = -V;
  float fwd = pow(max(dot(rd, uSunDir), 0.0), 4.0);
  vec3 col = mix(vec3(0.85, 0.78, 0.68), vec3(0.7, 0.75, 0.85), n) * 1.6 * shadow * (0.55 + 1.5 * fwd);
  float T = mix(0.5, 0.95, smoothstep(0.0, 0.7, rd.y));
  col = col * T + skyBase(rd) * 0.25;
  gl_FragColor = vec4(col, a * mix(0.8, 0.95, uNight));
  ${OUT}
}`;

// ── 궤도 고리(아웬의 후프) ─────────────────────────────
const hoopVert = /* glsl */ `
varying vec3 vRel;   // 행성 중심 기준 위치 (하늘 단위)
varying vec3 vWorld;
varying vec3 vN;
varying vec2 vUv;
uniform vec3 uCenter;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vRel = wp.xyz - uCenter;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const hoopFrag = /* glsl */ `
${NOISE_GLSL}
${ATMOS_PARS}
uniform float uPlanetR;
uniform float uLights;
varying vec3 vRel;
varying vec3 vWorld;
varying vec3 vN;
varying vec2 vUv;
void main() {
  vec3 rd = normalize(vWorld - cameraPosition);
  float along = vUv.x * 720.0;
  float across = vUv.y;
  // 행성 그림자
  float d = dot(vRel, uSunDir);
  float perp = length(vRel - d * uSunDir);
  float inShadow = (d < 0.0 && perp < uPlanetR) ? 1.0 : 0.0;
  float edge = smoothstep(0.0, 0.08, across) * smoothstep(1.0, 0.92, across);
  float panels = 0.82 + 0.18 * step(0.5, fract(along * 0.5)) * step(0.15, fract(across * 6.0));
  float seam = smoothstep(0.04, 0.0, abs(across - 0.5));
  vec3 base = vec3(0.72, 0.76, 0.86) * panels;
  float ndl = abs(dot(normalize(vN), uSunDir)) * 0.6 + 0.4;
  vec3 col = base * ndl * 0.85 * (1.0 - inShadow * 0.94);
  // 불빛: 가장자리를 따라 이어지는 점등과 정거장
  float dots = step(0.86, fract(along * 3.0)) * (smoothstep(0.1, 0.0, abs(across - 0.12)) + smoothstep(0.1, 0.0, abs(across - 0.88)));
  float station = smoothstep(0.004, 0.0, abs(fract(vUv.x * 12.0) - 0.5) - 0.006);
  // 고리를 따라 흐르는 배들 (두 줄, 반대 방향)
  float lane1 = smoothstep(0.03, 0.0, abs(across - 0.32)) * step(0.985, fract(along * 0.7 - uTime * 0.0035));
  float lane2 = smoothstep(0.03, 0.0, abs(across - 0.68)) * step(0.985, fract(along * 0.55 + uTime * 0.0028 + 0.37));
  vec3 lights = vec3(1.0, 0.85, 0.55) * dots * 3.0 + vec3(0.6, 0.95, 1.0) * (seam * 1.2 + station * 2.5) + vec3(1.0, 0.95, 0.85) * (lane1 + lane2) * 4.0;
  col += lights * uLights * mix(0.25, 1.0, max(uNight, inShadow));
  float T = mix(0.35, 0.95, smoothstep(0.0, 0.6, rd.y));
  float alpha = edge * mix(0.32, 0.9, max(uNight, inShadow * 0.5));
  col = col * T + skyBase(rd) * 0.25 * (1.0 - uNight);
  gl_FragColor = vec4(col, alpha);
  ${OUT}
}`;

const tetherVert = /* glsl */ `
uniform vec3 uA;
uniform vec3 uB;
uniform float uPix;
varying float vT;
varying vec3 vWorld;
void main() {
  vT = position.y;
  vec3 axis = mix(uA, uB, position.y);
  vec3 dir = normalize(uB - uA);
  vec3 side = normalize(cross(dir, normalize(axis - cameraPosition)));
  float w = max(1.5, length(axis - cameraPosition) * uPix);
  vec3 wp = axis + side * position.x * w;
  vWorld = wp;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`;

const tetherFrag = /* glsl */ `
${NOISE_GLSL}
${ATMOS_PARS}
varying float vT;
varying vec3 vWorld;
void main() {
  vec3 rd = normalize(vWorld - cameraPosition);
  vec3 col = vec3(0.75, 0.78, 0.85) * (uSunColor * 0.6 + uAmbTop * 1.0);
  float pulse = smoothstep(0.02, 0.0, abs(fract(vT * 6.0 - uTime * 0.05) - 0.5) - 0.48);
  col += vec3(0.6, 0.95, 1.0) * (0.25 + pulse * 1.5) * (0.4 + uNight);
  col = mix(col, skyBase(rd), 0.35 * (1.0 - uNight));
  gl_FragColor = vec4(col, smoothstep(1.0, 0.92, vT) * 0.9);
  ${OUT}
}`;

export class Sky {
  constructor(quality) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 10, 6e6);
    const u = atmosUniforms;

    // 돔
    this.domeMat = new THREE.ShaderMaterial({
      uniforms: { ...u, uCloudCover: { value: 0.42 } },
      vertexShader: domeVert, fragmentShader: domeFrag,
      side: THREE.BackSide, depthWrite: false, depthTest: false,
    });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(SKY_R, 48, 24), this.domeMat);
    dome.renderOrder = -10;
    dome.frustumCulled = false;
    this.scene.add(dome);

    // 우르
    const urR = UR_DIST * Math.sin(UR_RADIUS);
    this.urGroup = new THREE.Group();
    this.urGroup.position.copy(UR_DIR).multiplyScalar(UR_DIST);
    this.urGroup.lookAt(0, 0, 0);
    this.urGroup.rotateZ(0.42);
    this.urGroup.rotateX(0.3);
    this.urGroup.scale.setScalar(urR);
    this.sunObj = new THREE.Vector3();
    const urU = { ...u, uSunObj: { value: this.sunObj } };
    this.urMat = new THREE.ShaderMaterial({ uniforms: urU, vertexShader: urVert, fragmentShader: urFrag });
    const ur = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), this.urMat);
    ur.renderOrder = -5;
    this.urGroup.add(ur);
    const ringGeo = new THREE.RingGeometry(1.34, 2.42, 192, 1);
    ringGeo.rotateX(-Math.PI / 2);
    this.ringMat = new THREE.ShaderMaterial({
      uniforms: urU, vertexShader: ringVert, fragmentShader: ringFrag,
      transparent: true, side: THREE.DoubleSide, depthWrite: false,
    });
    const ring = new THREE.Mesh(ringGeo, this.ringMat);
    ring.renderOrder = -4;
    this.urGroup.add(ring);
    this.scene.add(this.urGroup);

    // 궤도 고리 (남북 방향 축의 원통 띠 — 아래에서 보면 동서로 하늘을 가로지르는 띠)
    const hoopR = (PLANET_R + RING_ALT) * SKY_SCALE;
    const hoopW = 26000 * SKY_SCALE;
    const hoopGeo = new THREE.CylinderGeometry(hoopR, hoopR, hoopW, 720, 1, true);
    hoopGeo.rotateX(Math.PI / 2);
    hoopGeo.rotateZ(Math.PI / 2);
    this.hoopCenter = new THREE.Vector3();
    this.hoopMat = new THREE.ShaderMaterial({
      uniforms: { ...u, uCenter: { value: this.hoopCenter }, uPlanetR: { value: PLANET_R * SKY_SCALE }, uLights: { value: 1 } },
      vertexShader: hoopVert, fragmentShader: hoopFrag,
      transparent: true, side: THREE.DoubleSide, depthWrite: false,
    });
    this.hoop = new THREE.Mesh(hoopGeo, this.hoopMat);
    this.hoop.rotation.y = 0.04;
    this.hoop.renderOrder = -3;
    this.hoop.frustumCulled = false;
    this.scene.add(this.hoop);

    // 척추 승강줄의 윗부분(30 km 위 → 고리)
    const tGeo = new THREE.PlaneGeometry(1, 1, 1, 64);
    tGeo.translate(0, 0.5, 0);
    this.tetherA = new THREE.Vector3();
    this.tetherB = new THREE.Vector3();
    this.tetherMat = new THREE.ShaderMaterial({
      uniforms: { ...u, uA: { value: this.tetherA }, uB: { value: this.tetherB }, uPix: { value: 0.002 } },
      vertexShader: tetherVert, fragmentShader: tetherFrag,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
    const tether = new THREE.Mesh(tGeo, this.tetherMat);
    tether.frustumCulled = false;
    tether.renderOrder = -2;
    this.scene.add(tether);

    // 다른 척추들: 고리를 따라 동서로 늘어선 승강줄 (지평선 너머에서 솟아 고리에 닿는다)
    this.farTethers = [];
    for (const deg of [-31, -19, -9, 11, 22, 34]) {
      const th = (deg * Math.PI) / 180;
      const A = new THREE.Vector3(), B = new THREE.Vector3();
      const mat = new THREE.ShaderMaterial({
        uniforms: { ...u, uA: { value: A }, uB: { value: B }, uPix: { value: 0.002 } },
        vertexShader: tetherVert, fragmentShader: tetherFrag,
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
      });
      const m = new THREE.Mesh(tGeo, mat);
      m.frustumCulled = false;
      m.renderOrder = -2;
      this.scene.add(m);
      this.farTethers.push({ th, A, B, mat });
    }
    // 고리 위의 정거장 (각 척추가 닿는 곳 + 그 사이)
    const stG = new THREE.CylinderGeometry(1, 1, 1, 16);
    stG.rotateX(Math.PI / 2);
    this.stationMat = new THREE.ShaderMaterial({
      uniforms: { ...u },
      vertexShader: `varying vec3 vN; varying vec3 vWorld; void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 wp = modelMatrix * instanceMatrix * vec4(position,1.0); vWorld = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
      fragmentShader: `${ATMOS_PARS}
        varying vec3 vN; varying vec3 vWorld;
        void main(){ vec3 rd = normalize(vWorld - cameraPosition);
          float ndl = abs(dot(normalize(vN), uSunDir)) * 0.6 + 0.4;
          vec3 col = vec3(0.85, 0.86, 0.92) * ndl + vec3(0.6, 0.95, 1.0) * (0.4 + 1.6 * uNight);
          float T = mix(0.4, 0.95, smoothstep(0.0, 0.6, rd.y));
          col = col * T + skyBase(rd) * 0.3 * (1.0 - uNight);
          gl_FragColor = vec4(col, 1.0); ${OUT} }`,
    });
    this.stationAngles = [-31, -25, -19, -14, -9, -4, 0, 5, 11, 16, 22, 28, 34].map((d) => (d * Math.PI) / 180);
    this.stations = new THREE.InstancedMesh(stG, this.stationMat, this.stationAngles.length);
    this.stations.frustumCulled = false;
    this.stations.renderOrder = -2.5;
    this.scene.add(this.stations);

    // 우르 둘레의 거주 궤도: 우르를 도는 작은 빛들
    const habN = 60;
    const hp = new Float32Array(habN * 3);
    const hr = mulberry32(5);
    for (let i = 0; i < habN; i++) {
      const a = hr() * Math.PI * 2, r = 1.25 + hr() * 1.6;
      hp[i * 3] = Math.cos(a) * r; hp[i * 3 + 1] = (hr() - 0.5) * 0.04 * r; hp[i * 3 + 2] = Math.sin(a) * r;
    }
    const hg = new THREE.BufferGeometry();
    hg.setAttribute('position', new THREE.BufferAttribute(hp, 3));
    this.habMat = new THREE.PointsMaterial({ color: 0xffe6c0, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    this.habitats = new THREE.Points(hg, this.habMat);
    this.habitats.renderOrder = -3.5;
    this.urGroup.add(this.habitats);

    this._inv = new THREE.Matrix4();
    this._qz = new THREE.Quaternion();
    this._m3 = new THREE.Matrix3();
  }

  /** 세계 카메라와 방향을 맞추고 하늘 물체를 갱신 */
  update(worldCam, tetherTopY) {
    const c = this.camera;
    c.quaternion.copy(worldCam.quaternion);
    if (c.fov !== worldCam.fov || c.aspect !== worldCam.aspect) {
      c.fov = worldCam.fov;
      c.aspect = worldCam.aspect;
      c.updateProjectionMatrix();
    }
    c.updateMatrixWorld();
    const cp = worldCam.position;
    // 행성 중심 기준의 궤도 고리
    this.hoopCenter.set(-cp.x * SKY_SCALE, -PLANET_R * SKY_SCALE - cp.y * SKY_SCALE, -cp.z * SKY_SCALE);
    this.hoop.position.copy(this.hoopCenter);
    // 승강줄
    this.tetherA.set(-cp.x, tetherTopY - cp.y, -cp.z).multiplyScalar(SKY_SCALE);
    this.tetherB.set(-cp.x, RING_ALT - cp.y, -cp.z).multiplyScalar(SKY_SCALE);
    const pix = (Math.tan((c.fov * Math.PI) / 360) * 2) / Math.max(400, innerHeight) * 1.4;
    this.tetherMat.uniforms.uPix.value = pix;
    // 행성 중심 (하늘 단위, 카메라 기준)
    const Cx = -cp.x * SKY_SCALE, Cy = -PLANET_R * SKY_SCALE - cp.y * SKY_SCALE, Cz = -cp.z * SKY_SCALE;
    const Rs = PLANET_R * SKY_SCALE, Rt = (PLANET_R + RING_ALT) * SKY_SCALE;
    const ry = this.hoop.rotation.y, cr = Math.cos(ry), sr = Math.sin(ry);
    for (const f of this.farTethers) {
      const sx = Math.sin(f.th), cy = Math.cos(f.th);
      f.A.set(Cx + sx * cr * Rs, Cy + cy * Rs, Cz - sx * sr * Rs);
      f.B.set(Cx + sx * cr * Rt, Cy + cy * Rt, Cz - sx * sr * Rt);
      f.mat.uniforms.uPix.value = pix * 0.8;
    }
    const m4 = this._m4 || (this._m4 = new THREE.Matrix4());
    const q = this._q || (this._q = new THREE.Quaternion());
    const sc = this._sc || (this._sc = new THREE.Vector3());
    const ps = this._ps || (this._ps = new THREE.Vector3());
    this.stationAngles.forEach((th, i) => {
      const big = this.farTethers.some((f) => Math.abs(f.th - th) < 1e-3) || th === 0;
      const rr = Rt - 600 * SKY_SCALE;
      ps.set(Cx + Math.sin(th) * cr * rr, Cy + Math.cos(th) * rr, Cz - Math.sin(th) * sr * rr);
      q.setFromAxisAngle(_Y, ry).multiply(this._qz.setFromAxisAngle(_Z, -th));
      sc.set((big ? 9000 : 5000) * SKY_SCALE, (big ? 7000 : 3600) * SKY_SCALE, (big ? 34000 : 22000) * SKY_SCALE);
      m4.compose(ps, q, sc);
      this.stations.setMatrixAt(i, m4);
    });
    this.stations.instanceMatrix.needsUpdate = true;
    this.habitats.rotation.y = atmosUniforms.uTime.value * 0.002;
    this.habMat.opacity = 0.35 + 0.65 * atmosUniforms.uNight.value;
    // 해 방향을 우르 좌표계로
    this.urGroup.updateMatrixWorld();
    this._m3.setFromMatrix4(this.urGroup.matrixWorld).invert();
    this.sunObj.copy(atmosUniforms.uSunDir.value).applyMatrix3(this._m3).normalize();
  }
}
