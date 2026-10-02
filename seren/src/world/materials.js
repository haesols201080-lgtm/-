// 공용 재질: 세렌의 대기 속에서 빛을 받는 물체(구조물·인물·생물·식물).
// 하나의 셰이더를 define 으로 갈라 씁니다: 인스턴싱, 정점색, 바람 흔들림, 발광, 가장자리 빛, 반투명.
import * as THREE from 'three';
import { NOISE_GLSL, ATMOS_PARS, CURVE_GLSL } from './shaders.js';
import { atmosUniforms } from './atmosphere.js';

const vert = /* glsl */ `
${CURVE_GLSL}
uniform float uTime;
uniform float uWind;
uniform float uWindH;
uniform vec3 uPlayer;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vLocal;
#ifdef USE_VCOLOR
attribute vec3 color;
varying vec3 vColor;
#endif
#ifdef USE_VEMIT
attribute float emit;
varying float vEmit;
#endif
#ifdef USE_INSTANCING_COLOR
varying vec3 vIColor;
#endif
#ifdef USE_WINDOWS
attribute float win;
varying float vWin;
#endif
void main() {
  vec3 p = position;
#ifdef USE_WINDOWS
  vWin = win;
#endif
#ifdef USE_VEMIT
  vEmit = emit;
#endif
  vLocal = position;
#ifdef USE_INSTANCING
  mat4 im = instanceMatrix;
#else
  mat4 im = mat4(1.0);
#endif
  vec4 wp = modelMatrix * im * vec4(p, 1.0);
#ifdef USE_WIND
  float h = max(p.y, 0.0) / uWindH;
  float ph = dot(wp.xz, vec2(0.11, 0.07));
  float sway = sin(uTime * 1.7 + ph) * 0.6 + sin(uTime * 2.9 + ph * 1.7) * 0.25 + sin(uTime * 0.6 + wp.x * 0.013) * 0.5;
  wp.x += sway * uWind * h * h;
  wp.z += cos(uTime * 1.3 + ph * 1.3) * uWind * 0.45 * h * h;
#endif
#ifdef USE_PUSH
  vec2 pd = wp.xz - uPlayer.xz;
  float pl = length(pd);
  float pk = max(0.0, 1.0 - pl / 1.6) * step(abs(wp.y - uPlayer.y), 2.5);
  wp.xz += pd / max(pl, 0.01) * pk * 0.7 * clamp(p.y, 0.0, 1.5);
  wp.y -= pk * 0.35 * clamp(p.y, 0.0, 1.5);
#endif
  vWorld = wp.xyz;
  vNormal = normalize(mat3(modelMatrix) * mat3(im) * normal);
#ifdef USE_VCOLOR
  vColor = color;
#endif
#ifdef USE_INSTANCING_COLOR
  vIColor = instanceColor;
#endif
  gl_Position = projectionMatrix * viewMatrix * vec4(curveWorld(wp.xyz), 1.0);
}`;

const frag = /* glsl */ `
${NOISE_GLSL}
${ATMOS_PARS}
uniform vec3 uColor;
uniform vec3 uEmissive;
uniform float uEmissiveNight;
uniform float uRim;
uniform vec3 uRimColor;
uniform float uSpec;
uniform float uOpacity;
uniform float uLines;
uniform vec3 uLineColor;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vLocal;
#ifdef USE_VCOLOR
varying vec3 vColor;
#endif
#ifdef USE_VEMIT
varying float vEmit;
#endif
#ifdef USE_INSTANCING_COLOR
varying vec3 vIColor;
#endif
#ifdef USE_WINDOWS
varying float vWin;
#endif
void main() {
  vec3 N = normalize(vNormal);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 alb = uColor;
#ifdef USE_VCOLOR
  alb *= vColor;
#endif
#ifdef USE_INSTANCING_COLOR
  alb *= vIColor;
#endif
  vec3 col = shadeLit(alb, N, 1.0);
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  col += uRimColor * fres * uRim * (0.4 + 0.6 * (uAmbTop.g + uUrLight.r));
  if (uSpec > 0.0) {
    vec3 H = normalize(uSunDir + V);
    col += uSunColor * pow(max(dot(N, H), 0.0), 60.0) * uSpec;
  }
  vec3 em = uEmissive * mix(1.0, uGlow * 1.7 + 0.1, uEmissiveNight);
#ifdef USE_VEMIT
  em *= vEmit;
#ifdef USE_VCOLOR
  em *= vColor;
#endif
#endif
#ifdef USE_WINDOWS
  // 고층 건물 외벽: 유리창 격자 — 낮에는 하늘을 비추고, 밤에는 집집마다 불이 켜진다
  if (abs(vWin) > 0.001) {
    vec3 Nw = normalize(vNormal);
    float cc = vWin > 0.0 ? atan(Nw.z, Nw.x) * vWin : dot(vWorld.xz, normalize(vec2(-Nw.z, Nw.x) + 1e-5)) / (-vWin);
    vec2 cell = vec2(cc, vWorld.y / 4.2);
    vec2 f = fract(cell);
    vec2 id = floor(cell);
    float frame = step(0.16, f.x) * step(f.x, 0.84) * step(0.22, f.y) * step(f.y, 0.8);
    vec2 fw = fwidth(cell);
    float aa = clamp(1.6 - max(fw.x, fw.y) * 2.2, 0.0, 1.0);
    float glassF = mix(0.45, frame, aa);
    float r = hash12(id + vec2(floor(vWin * 7.0), 0.0));
    float litP = mix(0.1, 0.55, clamp(uGlow, 0.0, 1.0));
    float lit = mix(litP, step(1.0 - litP, r), aa);
    vec3 warm = mix(vec3(1.0, 0.76, 0.45), vec3(0.55, 0.95, 1.0), step(0.72, hash12(id + 3.1)));
    vec3 R = reflect(-V, N);
    vec3 glass = skyBase(vec3(R.x, abs(R.y), R.z)) * 0.5 + vec3(0.015, 0.03, 0.06);
    col = mix(col, glass, glassF * 0.88);
    em += warm * lit * glassF * (0.18 + uGlow * 1.5);
  }
#endif
#ifdef USE_LINES
  // 아웬 건축의 빛나는 이음선
  float ln = smoothstep(0.08, 0.0, abs(fract(vLocal.y * uLines) - 0.5) - 0.42);
  float ln2 = smoothstep(0.05, 0.0, abs(fract(atan(vLocal.z, vLocal.x) * 3.0) - 0.5) - 0.46);
  em += uLineColor * max(ln, ln2 * 0.6) * (0.5 + uGlow);
#endif
  col += em;
  col = applySilence(col, silenceAt(vWorld.xz));
  col = applyFog(col, vWorld);
  gl_FragColor = vec4(col, uOpacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// 풀이 플레이어를 피해 눕도록 모든 식물 재질이 공유하는 플레이어 위치
export const playerUniform = { value: new THREE.Vector3(0, -1e4, 0) };

/**
 * opts: color, emissive, emissiveNight(0..1: 밤에 더 빛남), rim, rimColor, spec,
 *       vertexColors, wind(흔들림 m), windH(흔들림 기준 높이), lines(이음선 빈도), lineColor,
 *       vertexEmit(정점 emit 속성으로 발광 부위 지정), windows(정점 win 속성으로 창문 격자),
 *       transparent, opacity, side, depthWrite, blending
 */
export function litMaterial(opts = {}) {
  const defines = {};
  if (opts.vertexColors) defines.USE_VCOLOR = '';
  if (opts.wind) defines.USE_WIND = '';
  if (opts.lines) defines.USE_LINES = '';
  if (opts.vertexEmit) defines.USE_VEMIT = '';
  if (opts.push) defines.USE_PUSH = '';
  if (opts.windows) defines.USE_WINDOWS = '';
  const m = new THREE.ShaderMaterial({
    uniforms: {
      ...atmosUniforms,
      uColor: { value: new THREE.Color(opts.color ?? 0xffffff) },
      uEmissive: { value: new THREE.Color(opts.emissive ?? 0x000000).multiplyScalar(opts.emissiveIntensity ?? 1) },
      uEmissiveNight: { value: opts.emissiveNight ?? 0 },
      uRim: { value: opts.rim ?? 0.25 },
      uRimColor: { value: new THREE.Color(opts.rimColor ?? 0xcfe8ff) },
      uSpec: { value: opts.spec ?? 0 },
      uOpacity: { value: opts.opacity ?? 1 },
      uWind: { value: opts.wind ?? 0 },
      uWindH: { value: opts.windH ?? 1 },
      uLines: { value: opts.lines ?? 0 },
      uLineColor: { value: new THREE.Color(opts.lineColor ?? 0x9ff6ff) },
      uPlayer: playerUniform,
    },
    defines,
    vertexShader: vert,
    fragmentShader: frag,
    transparent: !!opts.transparent,
    side: opts.side ?? THREE.FrontSide,
    depthWrite: opts.depthWrite ?? !opts.transparent,
    blending: opts.blending ?? THREE.NormalBlending,
  });
  return m;
}

// 발광체(빛나는 띠·입자·후광): 조명 없이 색만, 가산 혼합
const glowVert = /* glsl */ `
${CURVE_GLSL}
varying vec3 vWorld;
varying vec2 vUv;
varying vec3 vNormal;
#ifdef USE_INSTANCING_COLOR
varying vec3 vIColor;
#endif
void main() {
  vUv = uv;
#ifdef USE_INSTANCING
  mat4 im = instanceMatrix;
#else
  mat4 im = mat4(1.0);
#endif
  vec4 wp = modelMatrix * im * vec4(position, 1.0);
  vWorld = wp.xyz;
  vNormal = normalize(mat3(modelMatrix) * mat3(im) * normal);
#ifdef USE_INSTANCING_COLOR
  vIColor = instanceColor;
#endif
  gl_Position = projectionMatrix * viewMatrix * vec4(curveWorld(wp.xyz), 1.0);
}`;

const glowFrag = /* glsl */ `
${NOISE_GLSL}
${ATMOS_PARS}
uniform vec3 uColor;
uniform float uIntensity;
uniform float uFresnel;
varying vec3 vWorld;
varying vec2 vUv;
varying vec3 vNormal;
#ifdef USE_INSTANCING_COLOR
varying vec3 vIColor;
#endif
void main() {
  vec3 c = uColor * uIntensity;
#ifdef USE_INSTANCING_COLOR
  c *= vIColor;
#endif
  float a = 1.0;
  if (uFresnel > 0.0) {
    vec3 V = normalize(cameraPosition - vWorld);
    float f = abs(dot(normalize(vNormal), V));
    a = mix(1.0, pow(1.0 - f, 2.0), uFresnel);
  }
  float fog = fogAmount(cameraPosition, vWorld);
  gl_FragColor = vec4(c * a * (1.0 - fog), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function glowMaterial(opts = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...atmosUniforms,
      uColor: { value: new THREE.Color(opts.color ?? 0xffffff) },
      uIntensity: { value: opts.intensity ?? 1 },
      uFresnel: { value: opts.fresnel ?? 0 },
    },
    vertexShader: glowVert,
    fragmentShader: glowFrag,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: opts.side ?? THREE.FrontSide,
  });
}
