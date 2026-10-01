// 모든 세계 셰이더가 공유하는 GLSL 조각.
// 대기(안개·하늘색), 행성 곡률, 조명, 노이즈를 한곳에 모아 두어 모든 물체가 같은 공기 속에 있도록 합니다.

export const NOISE_GLSL = /* glsl */ `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash12(i), b = hash12(i + vec2(1, 0)), c = hash12(i + vec2(0, 1)), d = hash12(i + vec2(1, 1));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float vnoise3(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  float n000 = hash13(i), n100 = hash13(i + vec3(1,0,0)), n010 = hash13(i + vec3(0,1,0)), n110 = hash13(i + vec3(1,1,0));
  float n001 = hash13(i + vec3(0,0,1)), n101 = hash13(i + vec3(1,0,1)), n011 = hash13(i + vec3(0,1,1)), n111 = hash13(i + vec3(1,1,1));
  return mix(mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y), mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y), u.z);
}
float fbm2(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return s / 0.9375;
}
float fbm3(vec3 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * vnoise3(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return s / 0.9375;
}
`;

export const ATMOS_PARS = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSkyTop;
uniform vec3 uSkyHorizon;
uniform vec3 uHorizonGlow;
uniform vec3 uAmbTop;
uniform vec3 uAmbBottom;
uniform vec3 uUrDir;
uniform vec3 uUrLight;
uniform float uNight;
uniform float uEclipse;
uniform float uGlow;
uniform float uTime;
uniform float uFogDensity;
uniform float uFogFalloff;
#ifndef CURV_DECL
#define CURV_DECL
uniform float uCurv;
#endif
uniform vec4 uSilence[6];

vec3 skyBase(vec3 rd) {
  float y = rd.y;
  float t = pow(clamp(y, 0.0, 1.0), 0.42);
  vec3 col = mix(uSkyHorizon, uSkyTop, t);
  col *= mix(1.0, 0.82, smoothstep(0.0, -0.3, y));
  float sd = max(dot(rd, uSunDir), 0.0);
  float hor = 1.0 - clamp(abs(y), 0.0, 1.0);
  col += uSunColor * (0.09 * pow(sd, 6.0) + 0.4 * pow(sd, 48.0)) * (0.35 + 0.65 * hor);
  vec2 sxz = normalize(uSunDir.xz + vec2(1e-5));
  vec2 rxz = normalize(rd.xz + vec2(1e-5));
  float az = dot(sxz, rxz) * 0.5 + 0.5;
  col += uHorizonGlow * (pow(az, 3.0) * 0.8 + 0.2) * pow(hor, 7.0);
  float ud = max(dot(rd, uUrDir), 0.0);
  col += uUrLight * (0.07 * pow(ud, 4.0) + 0.14 * pow(ud, 30.0));
  return col;
}

vec3 fogColorFor(vec3 rd) {
  vec3 c = skyBase(vec3(rd.x, max(rd.y, 0.0), rd.z));
  // 높은 곳에서 내려다보면 공기층이 푸르스름하게
  return c * mix(vec3(1.0), vec3(0.74, 0.84, 1.0), smoothstep(0.0, -0.45, rd.y));
}

float fogAmount(vec3 ro, vec3 wpos) {
  vec3 d = wpos - ro;
  float dist = length(d);
  vec3 rd = d / max(dist, 1e-3);
  float a = uFogDensity, b = uFogFalloff;
  float h0 = max(ro.y, -20.0);
  float k = rd.y * b;
  float f = abs(k) < 1e-5 ? a * exp(-h0 * b) * dist : (a / b) * exp(-h0 * b) * (1.0 - exp(-dist * k)) / rd.y;
  return 1.0 - exp(-max(f, 0.0));
}

vec3 applyFog(vec3 col, vec3 wpos) {
  vec3 rd = normalize(wpos - cameraPosition);
  float f = fogAmount(cameraPosition, wpos);
  return mix(col, fogColorFor(rd), clamp(f, 0.0, 1.0));
}

// 공명이 멈춘 지역(침묵 구역): 채도·밝기를 낮춘다
float silenceAt(vec2 xz) {
  float s = 0.0;
  for (int i = 0; i < 6; i++) {
    vec4 z = uSilence[i];
    if (z.w <= 0.0) continue;
    float d = length(xz - z.xy);
    s = max(s, z.w * smoothstep(z.z, z.z * 0.6, d));
  }
  return s;
}
vec3 applySilence(vec3 col, float s) {
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  return mix(col, vec3(l) * vec3(0.82, 0.84, 0.9), s * 0.85);
}

vec3 shadeLit(vec3 albedo, vec3 N, float ao) {
  float ndl = dot(N, uSunDir);
  float diff = clamp((ndl + 0.18) / 1.18, 0.0, 1.0);
  float hemi = N.y * 0.5 + 0.5;
  vec3 amb = mix(uAmbBottom, uAmbTop, hemi);
  float ur = clamp(dot(N, uUrDir) * 0.6 + 0.4, 0.0, 1.0);
  return albedo * (uSunColor * diff + (amb + uUrLight * ur) * ao);
}
`;

// 정점 셰이더용: 월드 좌표에 행성 곡률을 적용
export const CURVE_GLSL = /* glsl */ `
#ifndef CURV_DECL
#define CURV_DECL
uniform float uCurv;
#endif
vec3 curveWorld(vec3 wp) {
  vec2 d = wp.xz - cameraPosition.xz;
  wp.y -= dot(d, d) * uCurv;
  return wp;
}
`;
