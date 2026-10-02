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
#ifdef USE_CUT
uniform vec3 uCutCenter;
uniform float uNearCut;
uniform float uFarCut;
#endif
#ifdef USE_FACADE
attribute vec2 fac;   // x: 둘레를 따라 잰 거리(단위 모양 기준), y: 외벽 종류
varying vec2 vFac;
varying float vSeed;
varying float vBase;
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
#ifdef USE_CUT
  // 도시의 먼 모델: 가까운 것(자세한 모델이 대신 그림)과 너무 먼 것은 그리지 않는다
  float cutD = distance((modelMatrix * im * vec4(0.0, 0.0, 0.0, 1.0)).xyz, uCutCenter);
  if (cutD < uNearCut || cutD > uFarCut) { gl_Position = vec4(0.0, 0.0, -2.0, 1.0); return; }
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
#ifdef USE_FACADE
  vec3 ipos = (modelMatrix * im * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vFac = vec2(fac.x * 0.5 * (length(im[0].xyz) + length(im[2].xyz)), fac.y);
  vSeed = fract(sin(dot(ipos.xz, vec2(12.9898, 78.233))) * 43758.5453);
  vBase = ipos.y;
#endif
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
uniform float uWinGlow;
#ifdef USE_TECH
uniform vec4 uTech;    // x 무늬 크기(m), y 빛줄 세기, z 금속감, w 방식(0 판·회로, 1 동심원)
uniform vec3 uTechC;   // 동심원 중심
uniform vec3 uTechCol; // 빛줄 색
vec2 techUV(vec3 p, vec3 n) { vec3 a = abs(n); return a.y > max(a.x, a.z) ? p.xz : (a.x > a.z ? p.zy : p.xy); }
#endif
#ifdef USE_DOORCUT
uniform vec3 uDoorP;
uniform vec3 uDoorN;
uniform vec2 uDoorS;
#endif
#ifdef USE_FACADE
varying vec2 vFac;
varying float vSeed;
varying float vBase;
#endif
void main() {
#ifdef USE_DOORCUT
  // 들어간 건물: 문 자리의 벽을 뚫는다
  vec3 dpc = vWorld - uDoorP;
  if (abs(dot(dpc, vec3(-uDoorN.z, 0.0, uDoorN.x))) < uDoorS.x && dpc.y < uDoorS.y && dpc.y > -3.0 && abs(dot(dpc, uDoorN)) < 7.0) discard;
#endif
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
    float litP = mix(0.1, 0.55, clamp(uGlow, 0.0, 1.0)) * mix(0.6, 1.0, uWinGlow);
    float lit = mix(litP, step(1.0 - litP, r), aa);
    vec3 warm = mix(vec3(1.0, 0.76, 0.45), vec3(0.55, 0.95, 1.0), step(0.72, hash12(id + 3.1)));
    vec3 R = reflect(-V, N);
    vec3 glass = skyBase(vec3(R.x, abs(R.y), R.z)) * 0.5 + vec3(0.015, 0.03, 0.06);
    col = mix(col, glass, glassF * 0.88);
    em += warm * lit * glassF * (0.18 + uGlow * 1.5) * uWinGlow;
  }
#endif
  vec3 techEm = vec3(0.0);
  float glassMaskF = 0.0;
#ifdef USE_TECH
  {
    // 미래 문양: 새긴 판 이음매 + 흐르는 회로 빛 + 원 문양, 그리고 진주빛 금속 광택
    float glowT = clamp(uGlow, 0.0, 1.0);
    float engr = 0.0, tline = 0.0, detail = 1.0;
    if (uTech.w < 0.5) {
      vec2 q = techUV(vWorld, N) / uTech.x;
      vec2 id = floor(q), f = fract(q);
      vec2 fw = fwidth(q);
      detail = clamp(1.4 - max(fw.x, fw.y) * 3.0, 0.0, 1.0);
      if (hash12(id) > 0.55) { q *= 2.0; id = floor(q); f = fract(q); fw *= 2.0; }
      float e = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y));
      float ew = max(fw.x, fw.y);
      engr = 1.0 - smoothstep(0.014, 0.014 + ew * 1.2, e);
      float h2 = hash12(id + 7.1), h3 = hash12(id + 3.7);
      if (h2 > 0.42) {
        float yl = 0.2 + h3 * 0.6, xl = 0.15 + hash12(id + 1.3) * 0.7;
        float d1 = abs(f.y - yl) + max(0.0, f.x - xl) * 8.0;
        float d2 = abs(f.x - xl) + max(0.0, yl - f.y) * 8.0;
        float d = min(d1, d2);
        tline = 1.0 - smoothstep(0.01, 0.01 + ew * 1.5, d);
        tline = max(tline, 1.0 - smoothstep(0.025, 0.035 + ew, length(f - vec2(xl, 0.93))));
        tline *= 0.55 + 0.45 * sin(uTime * 2.2 + h3 * 31.0 - f.x * 7.0);
      }
      if (hash12(id + 9.9) > 0.85) {
        float rr = length(f - 0.5);
        tline = max(tline, ((1.0 - smoothstep(0.0, 0.012 + ew, abs(rr - 0.3))) + (1.0 - smoothstep(0.0, 0.01 + ew, abs(rr - 0.21)))) * 0.85);
      }
    } else {
      vec2 c = vWorld.xz - uTechC.xz;
      float rad = length(c) / uTech.x, ang = atan(c.y, c.x) / 6.2831853;
      float rf = fract(rad), ri = floor(rad), rw = fwidth(rad);
      detail = clamp(1.4 - rw * 3.0, 0.0, 1.0);
      engr = 1.0 - smoothstep(0.02, 0.02 + rw * 1.5, min(rf, 1.0 - rf));
      float spokes = 6.0 + ri * 6.0;
      float af = fract(ang * spokes), aw = fwidth(ang * spokes);
      engr = max(engr, (1.0 - smoothstep(0.02, 0.02 + aw * 1.5, min(af, 1.0 - af))) * step(0.5, hash12(vec2(ri, floor(ang * spokes)))) * 0.8);
      float hs = hash12(vec2(ri * 3.1, floor(ang * spokes * 2.0)));
      tline = (1.0 - smoothstep(0.018, 0.018 + rw * 1.5, abs(rf - (0.3 + hs * 0.4)))) * step(0.55, hs);
      tline *= 0.6 + 0.4 * sin(uTime * 1.6 - rad * 2.2);
    }
    col *= 1.0 - engr * 0.4 * detail;
    vec3 Rm = reflect(-V, N);
    float frm = 0.05 + 0.95 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
    vec3 irid = 0.5 + 0.5 * cos(6.2831853 * (frm * 1.3 + dot(N, vec3(0.3, 0.2, 0.1)) + vec3(0.0, 0.33, 0.67)));
    vec3 refl = skyBase(normalize(vec3(Rm.x, abs(Rm.y) * 0.8 + 0.05, Rm.z)));
    col = mix(col, refl * (0.55 + 0.6 * alb) + irid * 0.06, uTech.z * (0.18 + 0.82 * frm));
    col += uSunColor * pow(max(dot(Rm, uSunDir), 0.0), 140.0) * uTech.z * 1.4;
    techEm = uTechCol * tline * detail * uTech.y * (0.22 + glowT * 1.3);
  }
#endif
#ifdef USE_FACADE
  // 도시 건물 외벽: 1 커튼월(가는 멀리언·층 띠·반사 유리) 2 띠창 3 점창 4 첨탑(나선 빛)
  float ftype = vFac.y;
  float ao = mix(0.66, 1.0, smoothstep(1.0, 9.0, vWorld.y - vBase));
  col *= ao;
  if (ftype > 0.5) {
    float bay = ftype < 1.5 ? 1.6 : ftype < 2.5 ? 2.2 : ftype < 3.5 ? 2.6 : 1.4;
    float flH = ftype < 1.5 ? 3.6 : ftype < 3.5 ? 3.9 : 3.3;
    vec2 cell = vec2(vFac.x / bay, vWorld.y / flH);
    vec2 f = fract(cell), id = floor(cell);
    vec2 fw = max(fwidth(cell), vec2(1e-4));
    float aa = clamp(1.3 - max(fw.x, fw.y) * 2.2, 0.0, 1.0);
    float spandH = ftype < 1.5 ? 0.18 : ftype < 2.5 ? 0.46 : ftype < 3.5 ? 0.38 : 0.12;
    float mullW = ftype < 1.5 ? 0.035 : ftype < 2.5 ? 0.012 : ftype < 3.5 ? 0.24 : 0.05;
    float gx = smoothstep(mullW - fw.x, mullW + fw.x, f.x) * (1.0 - smoothstep(1.0 - mullW - fw.x, 1.0 - mullW + fw.x, f.x));
    float gy = smoothstep(spandH - fw.y, spandH + fw.y, f.y) * (1.0 - smoothstep(1.0 - fw.y * 1.5, 1.0, f.y));
    float gm = mix((1.0 - 2.0 * mullW) * (1.0 - spandH), gx * gy, aa);
    vec3 Rg = reflect(-V, N);
    vec3 skyR = skyBase(normalize(vec3(Rg.x, abs(Rg.y) * 0.7 + 0.03, Rg.z)));
    float frs = 0.1 + 0.9 * pow(1.0 - max(dot(N, V), 0.0), 4.0);
    vec3 tint = mix(vec3(0.025, 0.06, 0.09), vec3(0.07, 0.1, 0.12), vSeed) + hash12(vec2(id.y, vSeed * 91.0)) * 0.025;
    vec3 glass = tint + skyR * mix(0.32, 1.0, frs) + uSunColor * pow(max(dot(Rg, uSunDir), 0.0), 240.0) * 2.4;
    float room = hash12(vec2(floor(id.x / 2.0), id.y) + vSeed * 37.0);
    float floorOn = step(0.84, hash12(vec2(id.y, vSeed * 13.0))) * step(0.25, room);
    float glowK = clamp(uGlow, 0.0, 1.0);
    float litP = mix(0.1, 0.45, glowK) * uWinGlow;
    float lit = mix(litP, max(step(1.0 - litP, room), floorOn * glowK), aa);
    vec3 warm = mix(vec3(1.0, 0.76, 0.48), vec3(0.62, 0.92, 1.0), step(0.68, hash12(id + 5.3 + vSeed * 3.0)));
    col = mix(col, glass * mix(0.75, 1.0, ao), gm);
    glassMaskF = gm;
    em += warm * lit * gm * (0.06 + glowK * 0.85) * uWinGlow;
    // 빛줄: 몇 칸마다 세로 빛 (건물마다 다르게) / 첨탑은 나선
    float kx = fract(cell.x / (8.0 + floor(vSeed * 8.0)));
    float dl = min(kx, 1.0 - kx) * (8.0 + floor(vSeed * 8.0));
    float vline = (1.0 - smoothstep(0.04, 0.04 + fw.x * 1.5, dl)) * step(0.5, vSeed);
    if (ftype > 3.5) {
      float hq = vFac.x * 0.012 + vLocal.y * 5.0;
      float hf = fract(hq);
      float hw = fwidth(hq);
      vline = 1.0 - smoothstep(0.015, 0.015 + hw * 1.5, min(hf, 1.0 - hf));
    }
    vline *= clamp(1.6 - max(fw.x, fw.y) * 3.0, 0.0, 1.0);
    vec3 accC = mix(vec3(0.5, 0.95, 0.9), vec3(1.0, 0.8, 0.45), step(0.8, vSeed));
    em += accC * vline * (0.2 + glowK * 0.9);
  }
#endif
  em += techEm * (1.0 - glassMaskF); // 문양 빛은 유리 위에는 그리지 않는다
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
  if (opts.cut) defines.USE_CUT = '';
  if (opts.facade) defines.USE_FACADE = '';
  if (opts.doorCut) defines.USE_DOORCUT = '';
  if (opts.tech) defines.USE_TECH = '';
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
      uWinGlow: { value: opts.winGlow ?? 1 },
      uDoorP: { value: new THREE.Vector3(0, -1e6, 0) },
      uDoorN: { value: new THREE.Vector3(0, 0, 1) },
      uDoorS: { value: new THREE.Vector2(1.6, 4.0) },
      uTech: { value: new THREE.Vector4(...(opts.tech ? [opts.tech.scale ?? 2.4, opts.tech.glow ?? 0.6, opts.tech.metal ?? 0.35, opts.tech.mode ?? 0] : [1, 0, 0, 0])) },
      uTechC: { value: new THREE.Vector3(...(opts.tech && opts.tech.center ? opts.tech.center : [0, 0, 0])) },
      uTechCol: { value: new THREE.Color(opts.tech && opts.tech.color !== undefined ? opts.tech.color : 0x7ff3e6) },
      ...(opts.cut || {}),
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
