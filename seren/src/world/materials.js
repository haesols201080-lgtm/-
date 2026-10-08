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
attribute vec3 anc;   // 미터 고정 장식: x 켬, y 기준 높이에서 위로(m), z 바깥으로(m)
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
#ifdef USE_FACADE
  // 로비·차양·난간·옥상 장비는 실제 미터로: 건물이 아무리 높거나 넓어도 같은 크기
  if (anc.x > 0.5) {
    float isx = max(length(im[0].xyz), 0.01), isy = max(length(im[1].xyz), 0.01), isz = max(length(im[2].xyz), 0.01);
    p.y += anc.y / isy;
    vec2 hz = p.xz;
    if (abs(anc.z) > 1e-4 && dot(hz, hz) > 1e-8) { vec2 w = normalize(vec2(hz.x * isx, hz.y * isz)); p.xz += vec2(w.x / isx, w.y / isz) * anc.z; }
  }
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
// 불빛 색 여러 가지 (h: 0..1) — 따뜻한 등빛이 많고, 푸른 흰빛·장밋빛·라일락·박하·산호가 섞인다
vec3 lightPal(float h) {
  if (h < 0.34) return vec3(1.0, 0.78, 0.5);
  if (h < 0.52) return vec3(1.0, 0.9, 0.76);
  if (h < 0.64) return vec3(0.65, 0.88, 1.0);
  if (h < 0.74) return vec3(1.0, 0.62, 0.76);
  if (h < 0.83) return vec3(0.8, 0.68, 1.0);
  if (h < 0.92) return vec3(0.62, 1.0, 0.78);
  return vec3(1.0, 0.6, 0.46);
}
float cLineF(float d, float w, float fw) { return 1.0 - smoothstep(w - fw, w + fw, abs(d)); }
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
  float fres = pow(clamp(1.0 - dot(N, V), 0.0, 1.0), 3.0);
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
  vec3 techEm = vec3(0.0);
  float glassMaskF = 0.0;
#ifdef USE_WINDOWS
  // 고층 건물 외벽: 유리창 격자 — 낮에는 하늘을 비추고(코팅 유리, 비스듬할수록 거울), 밤에는 집집마다 불이 켜진다
  if (abs(vWin) > 0.001) {
    vec3 Nw = normalize(vNormal);
    float cc = vWin > 0.0 ? atan(Nw.z, Nw.x) * vWin : dot(vWorld.xz, normalize(vec2(-Nw.z, Nw.x) + 1e-5)) / (-vWin);
    vec2 cell = vec2(cc, vWorld.y / 4.2);
    vec2 f = fract(cell);
    vec2 id = floor(cell);
    vec2 fw = max(fwidth(cell), vec2(1e-4));
    float aa = clamp(1.6 - max(fw.x, fw.y) * 2.2, 0.0, 1.0);
    float frame = smoothstep(0.07 - fw.x, 0.07 + fw.x, f.x) * (1.0 - smoothstep(0.93 - fw.x, 0.93 + fw.x, f.x))
      * smoothstep(0.16 - fw.y, 0.16 + fw.y, f.y) * (1.0 - smoothstep(0.97 - fw.y, 0.97 + fw.y, f.y));
    float glassF = mix(0.7, frame, aa);
    float r = hash12(id + vec2(floor(vWin * 7.0), 0.0));
    float litP = mix(0.1, 0.55, clamp(uGlow, 0.0, 1.0)) * mix(0.6, 1.0, uWinGlow);
    float lit = mix(litP, step(1.0 - litP, r), aa);
    vec3 warm = lightPal(hash12(id + 3.1));
    vec3 R = reflect(-V, N);
    float frw = 0.06 + 0.94 * pow(clamp(1.0 - dot(N, V), 0.0, 1.0), 5.0);
    // 방 안: 바닥 쪽이 어둡고, 블라인드가 내려온 창이 섞인다
    vec3 inside = mix(vec3(0.05, 0.06, 0.07), vec3(0.2, 0.19, 0.18), smoothstep(0.1, 0.9, f.y) * (0.4 + 0.6 * r));
    inside = mix(inside, vec3(0.62, 0.6, 0.57), step(0.7, hash12(id + 9.3)) * step(1.0 - 0.5 * hash12(id + 4.4), f.y) * aa);
    vec3 glass = mix(inside, skyBase(normalize(vec3(R.x, abs(R.y) * 0.7 + 0.03, R.z))) * 0.9, clamp(0.38 + frw * 0.8, 0.0, 1.0)) + vec3(0.01, 0.02, 0.035);
    glass += uSunColor * pow(max(dot(R, uSunDir), 0.0), 200.0) * 0.5;
    col = mix(col * (1.0 - 0.12 * (1.0 - frame) * aa), glass, glassF * 0.92);
    em += warm * lit * glassF * (0.18 + uGlow * 1.5) * uWinGlow;
    glassMaskF = glassF;
  }
#endif
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
    col *= 1.0 - engr * 0.4 * detail * (1.0 - glassMaskF);
    vec3 Rm = reflect(-V, N);
    float frm = 0.05 + 0.95 * pow(clamp(1.0 - dot(N, V), 0.0, 1.0), 5.0);
    vec3 irid = 0.5 + 0.5 * cos(6.2831853 * (frm * 1.3 + dot(N, vec3(0.3, 0.2, 0.1)) + vec3(0.0, 0.33, 0.67)));
    vec3 refl = skyBase(normalize(vec3(Rm.x, abs(Rm.y) * 0.8 + 0.05, Rm.z)));
    col = mix(col, refl * (0.55 + 0.6 * alb) + irid * 0.06, uTech.z * (0.18 + 0.82 * frm));
    col += uSunColor * pow(max(dot(Rm, uSunDir), 0.0), 140.0) * uTech.z * 0.35;
    techEm = uTechCol * tline * detail * uTech.y * (0.2 + glowT * 0.75);
  }
#endif
#ifdef USE_FACADE
  // 도시 건물 외벽: 1 커튼월 2 띠창 3 점창 4 첨탑(나선 빛) 5 발코니 집 6 유리 격자(온실·돔) 7 수직 농장
  float ftype = gl_FrontFacing ? vFac.y : 0.0; // 안쪽(뒷면)에서는 창·방을 그리지 않는다 — 실내에서 다른 층이 비쳐 보이지 않게
  {
    // 모델에 굳힌 장식 빛(지붕 띠·난간·문틀 — 대부분 청록)을 건물마다 다른 빛깔로: 셋 중 둘은 다른 색
    float hs = fract(vSeed * 5.31 + 0.17);
    vec3 alt = hs < 0.2 ? vec3(1.0, 0.78, 0.5) : hs < 0.38 ? vec3(0.8, 0.66, 1.0) : hs < 0.52 ? vec3(1.0, 0.62, 0.8) : hs < 0.64 ? vec3(0.64, 1.0, 0.74) : hs < 0.74 ? vec3(0.72, 0.84, 1.0) : vec3(0.5, 0.95, 0.9);
    float lum = dot(em, vec3(0.299, 0.587, 0.114));
    em = mix(em, alt * lum * 1.25, 0.85) * (1.0 - 0.32 * uNight); // 밤에는 장식 빛을 조금 누른다
  }
  float ao = mix(0.62, 1.0, smoothstep(1.0, 9.0, vWorld.y - vBase));
  col *= ao;
  float glowK = clamp(uGlow, 0.0, 1.0);
  vec3 Nf = normalize(vNormal);
  vec3 Vv = normalize(cameraPosition - vWorld);
  vec3 Rg = reflect(-Vv, Nf);
  vec3 skyR = skyBase(normalize(vec3(Rg.x, abs(Rg.y) * 0.7 + 0.03, Rg.z)));
  float frs = 0.06 + 0.94 * pow(clamp(1.0 - dot(Nf, Vv), 0.0, 1.0), 5.0);
  if (ftype > 5.5 && ftype < 6.5) {
    // 유리 격자: 마름모 골조 + 그 너머의 숲 (낮엔 초록·노을빛, 밤엔 생장등)
    vec2 g = vec2(vFac.x * 0.5 + vWorld.y * 0.35, vFac.x * 0.5 - vWorld.y * 0.35) / 3.2;
    vec2 gf = fract(g), gw = fwidth(g);
    float frame = 1.0 - smoothstep(0.035, 0.035 + max(gw.x, gw.y) * 1.5, min(min(gf.x, 1.0 - gf.x), min(gf.y, 1.0 - gf.y)));
    float faded = clamp(1.3 - max(gw.x, gw.y) * 2.0, 0.0, 1.0);
    float leaf = vnoise(vWorld.xz * 0.35 + vWorld.y * 0.4) * 0.6 + vnoise(vWorld.xz * 1.3 - vWorld.y) * 0.4;
    vec3 inside = mix(vec3(0.03, 0.12, 0.06), vec3(0.16, 0.42, 0.18), leaf) * (0.55 + 0.45 * smoothstep(0.0, 18.0, vWorld.y - vBase));
    inside += vec3(0.9, 0.35, 0.7) * step(0.82, hash12(floor(vWorld.xz * 0.5) + floor(vWorld.y * 0.5))) * 0.25;
    vec3 glassC = mix(inside, skyR * 0.9 + vec3(0.04, 0.08, 0.07), frs * 0.85 + 0.12);
    col = mix(glassC, vec3(0.86, 0.88, 0.9) * ao, frame * faded);
    em += (vec3(0.55, 1.0, 0.7) * leaf * 0.12 + vec3(0.9, 0.4, 0.95) * 0.06) * (1.0 - frame * faded) * (0.2 + glowK * 1.2) * uWinGlow;
    glassMaskF = 1.0 - frame;
  } else if (ftype > 6.5) {
    // 수직 농장: 층마다 재배 띠(잎·꽃) + 유리 띠(보랏빛 생장등)
    float fl = (vWorld.y - vBase - 1.35) / 4.2;
    float ff = fract(fl), fwv = fwidth(fl);
    float slab = 1.0 - smoothstep(0.06, 0.06 + fwv * 1.5, ff);
    float planted = step(0.5, ff) * (1.0 - slab);
    float leaf = vnoise(vec2(vFac.x * 0.9, vWorld.y * 0.9)) * 0.6 + vnoise(vec2(vFac.x * 3.1, vWorld.y * 2.7)) * 0.4;
    vec3 plant = mix(vec3(0.04, 0.14, 0.05), vec3(0.16, 0.38, 0.15), leaf);
    float bloom = smoothstep(0.78, 0.86, vnoise(vec2(vFac.x * 2.3, vWorld.y * 2.3) + 7.0));
    plant = mix(plant, vec3(0.8, 0.5, 0.65), bloom * 0.6);
    // 유리 띠: 안쪽 선반과 보랏빛 생장등이 비친다
    float rack = step(0.5, fract(vFac.x / 1.4)) * 0.15;
    vec3 glassC = mix(vec3(0.06, 0.05, 0.09) + vec3(0.05, 0.12, 0.05) * rack, skyR * 0.8, frs * 0.85 + 0.12);
    col = mix(mix(glassC, plant, planted), vec3(0.82, 0.82, 0.86) * ao, slab);
    em += vec3(0.7, 0.35, 0.95) * (1.0 - planted) * (1.0 - slab) * (0.015 + glowK * 0.45) * uWinGlow;
    glassMaskF = 1.0 - slab;
  } else if (ftype > 0.5) {
    bool balc = ftype > 4.5;
    float bay = ftype < 1.5 ? 1.6 : ftype < 2.5 ? 2.2 : ftype < 3.5 ? 2.6 : balc ? 3.0 : 1.4;
    float flH = ftype < 1.5 ? 3.6 : ftype < 3.5 ? 3.9 : balc ? 3.2 : 3.3;
    vec2 cell = vec2(vFac.x / bay, (vWorld.y - vBase - 1.35) / flH); // 층 띠는 1층 바닥(기초 위 1.35 m)부터 — 실내 층과 같은 높이
    vec2 f = fract(cell), id = floor(cell);
    vec2 fw = max(fwidth(cell), vec2(1e-4));
    float aa = clamp(1.3 - max(fw.x, fw.y) * 2.2, 0.0, 1.0);
    float spandH = ftype < 1.5 ? 0.18 : ftype < 2.5 ? 0.46 : ftype < 3.5 ? 0.38 : balc ? 0.12 : 0.12;
    float mullW = ftype < 1.5 ? 0.035 : ftype < 2.5 ? 0.012 : ftype < 3.5 ? 0.24 : balc ? 0.06 : 0.05;
    float gx = smoothstep(mullW - fw.x, mullW + fw.x, f.x) * (1.0 - smoothstep(1.0 - mullW - fw.x, 1.0 - mullW + fw.x, f.x));
    float gy = smoothstep(spandH - fw.y, spandH + fw.y, f.y) * (1.0 - smoothstep(1.0 - fw.y * 1.5, 1.0, f.y));
    float gm = mix((1.0 - 2.0 * mullW) * (1.0 - spandH), gx * gy, aa);
    // ── 방 들여다보기 (interior mapping): 창마다 깊이 있는 방 — 뒷벽·옆벽·바닥·천장, 가구 그림자, 블라인드 ──
    vec3 Tt = normalize(vec3(-Nf.z, 0.0, Nf.x) + 1e-5);
    vec3 dIn = -Vv;
    vec3 rd = vec3(dot(dIn, Tt), dIn.y, -dot(dIn, Nf));
    rd.z = max(rd.z, 0.04);
    float room = hash12(vec2(floor(id.x / (balc ? 1.0 : 2.0)), id.y) + vSeed * 37.0);
    float W = bay * (balc ? 1.0 : 2.0), Hh = flH, Dd = bay * 2.2;
    vec3 ro = vec3((fract(cell.x / (balc ? 1.0 : 2.0))) * W, f.y * Hh, 0.0);
    float tx = rd.x > 0.0 ? (W - ro.x) / rd.x : -ro.x / min(rd.x, -1e-4);
    float ty = rd.y > 0.0 ? (Hh - ro.y) / rd.y : -ro.y / min(rd.y, -1e-4);
    float tz = Dd / rd.z;
    // 어느 면에 닿았나 (같음 비교 대신 순서로 — 화소마다 깜빡이지 않게)
    float hitBack = step(tz, tx) * step(tz, ty);
    float hitY = (1.0 - hitBack) * step(ty, tx);
    float tt = hitBack > 0.5 ? tz : hitY > 0.5 ? ty : tx;
    vec3 hp = ro + rd * tt;
    vec3 wallC = mix(vec3(0.62, 0.58, 0.52), mix(vec3(0.45, 0.55, 0.6), vec3(0.6, 0.48, 0.55), step(0.5, room)), step(0.3, room));
    vec3 rc;
    if (hitBack > 0.5) {
      rc = wallC * 0.8;
      float shelf = step(0.3, hash12(vec2(room * 17.0, 2.0))) * step(0.15, hp.y / Hh) * step(hp.y / Hh, 0.55) * step(0.15, hp.x / W) * step(hp.x / W, 0.6);
      rc = mix(rc, vec3(0.25, 0.2, 0.18), shelf * 0.8);
      float art = step(0.6, hash12(vec2(room * 31.0, 5.0))) * step(0.5, hp.y / Hh) * step(hp.y / Hh, 0.8) * step(0.62, hp.x / W) * step(hp.x / W, 0.86);
      rc = mix(rc, vec3(0.5, 0.75, 0.85), art);
    } else if (hitY > 0.5) rc = rd.y > 0.0 ? vec3(0.78, 0.76, 0.72) : vec3(0.3, 0.26, 0.24) * (0.85 + 0.25 * hp.z / Dd);
    else rc = wallC * 0.62;
    // 방 안의 사람·화분 그림자 (뒷벽 앞)
    float fig = step(0.72, hash12(vec2(room * 7.0, 9.0))) * (1.0 - smoothstep(0.0, 0.18, abs(hp.x / W - 0.35 - 0.3 * hash12(vec2(room, 3.0))))) * step(hp.y, 1.7) * step(Dd * 0.55, hp.z);
    rc = mix(rc, vec3(0.12, 0.1, 0.12), fig * 0.7);
    float depthDim = 1.0 - 0.35 * clamp(hp.z / Dd, 0.0, 1.0);
    float floorOn = step(0.84, hash12(vec2(id.y, vSeed * 13.0))) * step(0.25, room);
    float litP = mix(0.12, 0.5, glowK) * uWinGlow;
    float lit = max(step(1.0 - litP, room), floorOn * glowK);
    vec3 warm = lightPal(hash12(id + 5.3 + vSeed * 3.0));
    // 낮: 실내는 바깥보다 어둡다 / 밤: 불 켜진 방은 따뜻하게
    float dayIn = 0.22 + 0.1 * room;
    vec3 interior = rc * depthDim * (dayIn * (1.0 - glowK * 0.85) + lit * warm * (0.25 + glowK * 0.9) * uWinGlow);
    // 블라인드: 방마다 내려온 정도가 다르다
    float blind = step(0.55, hash12(vec2(room * 13.0, 1.0))) * step(1.0 - 0.6 * hash12(vec2(room * 5.0, 4.0)), (f.y - spandH) / (1.0 - spandH));
    interior = mix(interior, mix(vec3(0.72, 0.7, 0.66), warm, lit * glowK) * (0.35 + lit * glowK * 0.5), blind * 0.85);
    vec3 tint = mix(vec3(0.025, 0.05, 0.07), vec3(0.06, 0.08, 0.09), vSeed);
    // 낮에는 하늘을 꽤 비추고(코팅 유리), 밤에는 안이 더 잘 보인다
    float refl = clamp(mix(0.34, 0.14, glowK) + frs * 0.8, 0.0, 1.0);
    vec3 glass = mix(interior + tint, skyR * 0.92 + tint, refl) + uSunColor * pow(max(dot(Rg, uSunDir), 0.0), 240.0) * 0.6;
    glass = mix(skyR * 0.55 + tint, glass, aa); // 멀리서는 반사만
    // 멀리언·층판의 깊이: 모서리 그늘
    float edgeSh = (1.0 - smoothstep(0.0, 0.12, f.y - spandH)) * 0.35 + (1.0 - smoothstep(0.0, 0.05, min(f.x - mullW, 1.0 - mullW - f.x))) * 0.2;
    col *= 1.0 - (1.0 - gm) * 0.15 * aa;
    col = mix(col, glass * mix(0.75, 1.0, ao), gm);
    col *= 1.0 - edgeSh * gm * aa;
    glassMaskF = gm;
    em += warm * lit * gm * (1.0 - blind * 0.6) * (0.02 + glowK * 0.55) * uWinGlow * depthDim;
    if (balc) {
      // 발코니: 층판 끝(밝은 띠) + 그 아래 그늘 + 유리 난간 + 난간의 화분
      float slab = 1.0 - smoothstep(0.1, 0.1 + fw.y * 1.5, f.y);
      float under = (1.0 - smoothstep(0.1, 0.3, f.y)) * (1.0 - slab);
      float rail = step(0.1, f.y) * (1.0 - smoothstep(0.42 - fw.y, 0.42 + fw.y, f.y));
      col = mix(col, vec3(0.86, 0.84, 0.88) * ao, slab * aa + slab * (1.0 - aa) * 0.5);
      col *= 1.0 - under * 0.35 * aa;
      col = mix(col, col * 0.75 + vec3(0.12, 0.22, 0.24), rail * 0.55 * aa);
      col = mix(col, vec3(0.6, 0.62, 0.66), cLineF(f.y - 0.42, 0.02, fw.y) * aa);
      float pot = step(0.7, hash12(vec2(id.x, id.y * 3.0) + vSeed)) * rail * (1.0 - smoothstep(0.0, 0.18, abs(f.x - 0.2))) * step(f.y, 0.36);
      col = mix(col, vec3(0.12, 0.38, 0.16), pot * aa);
      glassMaskF *= 1.0 - slab;
    }
    // 빛줄: 몇 칸마다 세로 빛 (건물마다 다르게) / 첨탑은 나선
    float kx = fract(cell.x / (8.0 + floor(vSeed * 8.0)));
    float dl = min(kx, 1.0 - kx) * (8.0 + floor(vSeed * 8.0));
    float vline = (1.0 - smoothstep(0.04, 0.04 + fw.x * 1.5, dl)) * step(0.5, vSeed) * (balc ? 0.0 : 1.0);
    if (ftype > 3.5 && ftype < 4.5) {
      float hq = vFac.x * 0.012 + vLocal.y * 5.0;
      float hf = fract(hq);
      float hw = fwidth(hq);
      vline = 1.0 - smoothstep(0.015, 0.015 + hw * 1.5, min(hf, 1.0 - hf));
    }
    vline *= clamp(1.6 - max(fw.x, fw.y) * 3.0, 0.0, 1.0);
    // 건물마다 다른 빛줄 색 (청록 · 호박 · 라일락 · 장밋빛 · 박하 · 푸른 흰빛)
    float as = fract(vSeed * 7.13);
    vec3 accC = as < 0.3 ? vec3(0.5, 0.95, 0.9) : as < 0.48 ? vec3(1.0, 0.8, 0.45) : as < 0.62 ? vec3(0.78, 0.66, 1.0) : as < 0.76 ? vec3(1.0, 0.6, 0.78) : as < 0.88 ? vec3(0.6, 1.0, 0.72) : vec3(0.7, 0.85, 1.0);
    em += accC * vline * (0.18 + glowK * 0.5);
    // 1층: 상점 — 넓은 유리 너머 불 켜진 가게와 간판 띠 (낮에도 은은하게)
    float hb = vWorld.y - vBase - 1.5;
    if (hb > -0.5 && hb < 6.4 && ftype < 3.5 || (balc && hb > -0.5 && hb < 4.2)) {
      vec2 sc = vec2(vFac.x / 3.4, hb / (balc ? 3.6 : 5.2));
      vec2 sf = fract(sc);
      vec2 sfw = max(fwidth(sc), vec2(1e-4));
      float saa = clamp(1.3 - max(sfw.x, sfw.y) * 2.0, 0.0, 1.0);
      float sg = smoothstep(0.035, 0.035 + sfw.x, sf.x) * (1.0 - smoothstep(0.965 - sfw.x, 0.965, sf.x)) * smoothstep(0.02, 0.05, sc.y) * (1.0 - smoothstep(0.76, 0.79, sc.y));
      sg = mix(0.62, sg, saa);
      float sh = hash12(vec2(floor(sc.x), vSeed * 17.0));
      vec3 shop = mix(vec3(1.0, 0.82, 0.6), mix(vec3(0.6, 0.9, 1.0), vec3(1.0, 0.7, 0.85), step(0.62, sh)), step(0.35, sh));
      // 가게 안: 진열대·사람 그림자
      float shelfS = step(0.4, sf.y) * step(sf.y, 0.55) * step(0.3, hash12(vec2(floor(sc.x * 3.0), 2.0)));
      vec3 shopIn = shop * (0.25 + 0.1 * shelfS) + skyR * 0.1;
      shopIn = mix(shopIn, vec3(0.1, 0.09, 0.1), step(0.8, hash12(floor(vec2(sc.x * 5.0, 1.0)) + floor(uTime * 0.2))) * step(sf.y, 0.45) * 0.6);
      col = mix(col, shopIn, sg);
      em += shop * sg * (0.2 + glowK * 0.45);
      float signB = step(0.83, sc.y) * step(sc.y, 0.96);
      em += shop * signB * step(0.45, hash12(vec2(floor(sc.x / 3.0), vSeed))) * (0.3 + glowK * 0.7) * (balc ? 0.0 : 1.0);
      glassMaskF = max(glassMaskF, sg);
    }
  }
#endif
  em += techEm * (1.0 - glassMaskF); // 문양 빛은 유리 위에는 그리지 않는다
#ifdef USE_LINES
  // 아웬 건축의 빛나는 이음선
  float ln = smoothstep(0.08, 0.0, abs(fract(vLocal.y * uLines) - 0.5) - 0.42);
  float ln2 = smoothstep(0.05, 0.0, abs(fract(atan(vLocal.z, vLocal.x) * 3.0) - 0.5) - 0.46);
  em += uLineColor * max(ln, ln2 * 0.6) * (0.5 + uGlow);
#endif
#ifdef USE_RIBS
  // 척추 갈비의 외피 (가까이서 보면 민무늬 판이던 것): 판 이음(가로 9 m · 둘레 12 m), 판마다 조금씩 다른 진주빛,
  // 80 m 마다 금빛 띠, 몇 판마다 세로로 흐르는 빛줄, 밑동의 비·흙 얼룩. 둘레 좌표는 노멀 방향으로 섞는다(관을 감싸는 면)
  {
    vec2 rdir = normalize(vWorld.xz + vec2(1e-4));
    vec2 tdir = vec2(-rdir.y, rdir.x);
    vec2 Nh = N.xz;
    float wr = abs(dot(Nh, rdir)), wt = abs(dot(Nh, tdir));
    float u = (dot(vWorld.xz, tdir) * wr + length(vWorld.xz) * wt + vWorld.y * abs(N.y) * 0.6) / max(wr + wt + abs(N.y) * 0.6, 1e-3);
    float hy = vWorld.y - RIB_H0;
    vec2 pc = vec2(u / 12.0, hy / 9.0);
    vec2 pf = fract(pc), pid = floor(pc);
    vec2 pw = max(fwidth(pc), vec2(1e-4));
    float aa = clamp(1.5 - max(pw.x, pw.y) * 4.0, 0.0, 1.0);
    float seam = max(1.0 - smoothstep(0.0, 0.012 + pw.x * 1.2, min(pf.x, 1.0 - pf.x)), 1.0 - smoothstep(0.0, 0.016 + pw.y * 1.2, min(pf.y, 1.0 - pf.y))) * aa;
    float ph = hash12(pid);
    col *= (0.93 + 0.12 * ph) * (1.0 - seam * 0.28);
    // 금빛 띠 (80 m 마다 1.6 m)
    float bq = hy / 80.0, bw = fwidth(bq) * 2.0;
    float band = smoothstep(0.98 - bw * 1.5, 0.98, abs(fract(bq) - 0.5) * 2.0); // 띠 가운데 = 80 m 의 배수
    col = mix(col, col * vec3(1.25, 1.0, 0.62), band * 0.75);
    em += vec3(1.0, 0.78, 0.42) * band * (0.08 + uGlow * 0.5);
    // 세로 빛줄: 몇 판마다, 위로 흐른다
    float vl = step(0.8, hash12(vec2(pid.x, 7.0))) * (1.0 - smoothstep(0.0, 0.03 + pw.x * 1.5, abs(pf.x - 0.5))) * aa;
    em += vec3(0.45, 1.0, 0.92) * vl * (0.08 + uGlow * 0.55) * (0.6 + 0.4 * sin(uTime * 1.5 - hy * 0.08));
    // 밑동: 비·흙 얼룩과 이끼 기운
    float low = 1.0 - smoothstep(0.0, 14.0, hy);
    col *= 1.0 - low * (0.18 + 0.12 * vnoise(vWorld.xz * 0.2 + vWorld.y * 0.1));
    col = mix(col, col * vec3(0.82, 0.95, 0.86), low * 0.4 * vnoise(vWorld.xz * 0.05));
  }
#endif
  // 햇빛 받은 흰 벽이 블룸 문턱을 넘어 「빛나는」 것처럼 보이지 않게: 반사광만 부드럽게 눌러 준다 (빛은 em 으로 따로)
  float litL = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col *= 1.0 / (1.0 + max(litL - 0.72, 0.0) * 1.15);
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
  if (opts.ribs !== undefined) { defines.USE_RIBS = ''; defines.RIB_H0 = Number(opts.ribs).toFixed(1); } // 척추 갈비 외피 (값 = 밑동 높이)
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
  vec3 c = uColor * uIntensity * (1.0 - 0.24 * uNight); // 밤에는 빛을 조금 누른다 (어둠 속에서 너무 눈부시지 않게)
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
