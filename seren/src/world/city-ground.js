// 도시의 바닥: 지형 셰이더가 블록 계획(쓰임 표 텍스처)을 읽어 그 자리의 바닥을 그린다.
//  · 차도(아스팔트·차선·건널목) · 보도 · 연석 빛줄 · 골목(가운데 화단) · 블록마다 쓰임에 맞는 마당
//    (주거 안뜰 정원·놀이터, 상가 광장, 작업장 마당의 하역 칸, 변전 자갈·철망, 공원 길·연못·꽃밭, 농지 이랑, 집 마당·생울타리 …)
//  · cityplan.js 의 템플릿과 같은 식(u, v, 길이, 깊이)이라 건물·소품이 바닥 무늬와 맞물린다.
//  · 지오메트리를 하나도 더하지 않으므로 겹침·깜빡임이 없고, 어느 거리에서나 같은 바닥이 보인다.
import * as THREE from 'three';
import { ZGEO } from '../data/city.js';

export const CITY_NZ = 16;
export const PLAN_W = 1024;

/** 계획 → 텍스처 + uniform 값 */
export function planUniforms(plan) {
  let rows = 0;
  const rowOf = [];
  for (const P of plan.zones) { rowOf.push(rows); rows += Math.ceil(P.size / PLAN_W); }
  const H = Math.max(1, rows);
  const data = new Uint8Array(PLAN_W * H * 4);
  const put = (row0, idx, r, g, b, a) => { const x = idx % PLAN_W, y = row0 + Math.floor(idx / PLAN_W); const o = (y * PLAN_W + x) * 4; data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = a; };
  const Z0 = [], Z1 = [], Z2 = [], Z3 = [];
  plan.zones.forEach((P, i) => {
    const G = P.G, row0 = rowOf[i];
    P.rings.forEach((R, k) => put(row0, k, R.m, R.start & 255, R.start >> 8, R.street ? 1 : 0));
    for (const B of P.blocks) put(row0, B.idx, B.type, B.variant, (B.stilt ? 1 : 0) + (B.natural ? 2 : 0) + (P.Z.mix === 'suburb' ? 4 : 0), 255);
    Z0.push(new THREE.Vector4(G.cx, G.cz, G.r0, G.ring));
    Z1.push(new THREE.Vector4(G.street, G.nb, G.avenues, G.aOff));
    Z2.push(new THREE.Vector4(row0, G.every, G.lane, G.avH));
    Z3.push(new THREE.Vector4(G.rOut, P.Z.core === 'plaza' ? 1 : 0, 0, 0));
  });
  while (Z0.length < CITY_NZ) { const z = new THREE.Vector4(0, 0, 0, 0); Z0.push(z); Z1.push(z); Z2.push(z); Z3.push(z); }
  const tex = new THREE.DataTexture(data, PLAN_W, H, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return { uCityPlan: tex, uCityN: plan.zones.length, uCZ0: Z0, uCZ1: Z1, uCZ2: Z2, uCZ3: Z3 };
}

/** 지형 재질에 붙일 uniform (값은 도시가 만들어지면 채운다) */
export function cityGroundUniforms() {
  const v = () => Array.from({ length: CITY_NZ }, () => new THREE.Vector4());
  const t = new THREE.DataTexture(new Uint8Array(4), 1, 1);
  t.needsUpdate = true;
  return { uCityPlan: { value: t }, uCityN: { value: 0 }, uCZ0: { value: v() }, uCZ1: { value: v() }, uCZ2: { value: v() }, uCZ3: { value: v() } };
}
export function applyPlanUniforms(material, U) {
  for (const [k, v] of Object.entries(U)) {
    if (!material.uniforms[k]) continue;
    if (Array.isArray(v)) material.uniforms[k].value.forEach((q, i) => q.copy(v[i]));
    else material.uniforms[k].value = v;
  }
  material.uniformsNeedUpdate = true;
}

// 바닥 종류: 0 자연 1 보도판 2 광장판 3 잔디 4 꽃밭 5 길(모래) 6 물 7 작업장 8 자갈 9 철망 10 이랑 11 놀이 바닥 12 차도 13 연석 14 생울타리
export const CITY_GLSL = /* glsl */ `
#define CITY_NZ ${CITY_NZ}
uniform sampler2D uCityPlan;
uniform int uCityN;
uniform vec4 uCZ0[CITY_NZ];
uniform vec4 uCZ1[CITY_NZ];
uniform vec4 uCZ2[CITY_NZ];
uniform vec4 uCZ3[CITY_NZ];

vec4 cityTexel(float row0, float idx) {
  float x = mod(idx, ${PLAN_W}.0), y = row0 + floor(idx / ${PLAN_W}.0);
  return texelFetch(uCityPlan, ivec2(int(x), int(y)), 0) * 255.0;
}

// 선 하나의 덮임 (AA): d = 선까지 거리, w = 반폭, fw = 화소 크기
float cLine(float d, float w, float fw) { return 1.0 - smoothstep(w - fw, w + fw, abs(d)); }
// 차선 빛 징: 칠한 줄 대신 3 m 마다 마름모 빛 징 (a: 길을 따라, x: 차선 가운데로부터)
float studs(float a, float x, float fw) { float d = abs(fract(a / 3.0) - 0.5) * 3.0 * 0.55 + abs(x); return 1.0 - smoothstep(0.17, 0.19 + fw * 1.5, d); }
float cBox(vec2 p, vec2 c, vec2 h) { vec2 q = abs(p - c) - h; return max(q.x, q.y); }

struct CityS { float kind; vec2 q; float fw; float var; float line; float glow; };

// 육각 격자: xy = 칸 안 좌표, z = 가장자리까지 거리(0 = 테두리, 0.5 = 가운데), w = 칸 해시
vec4 hexCell(vec2 p) {
  const vec2 r = vec2(1.0, 1.7320508);
  vec2 h = r * 0.5;
  vec2 a = mod(p, r) - h;
  vec2 b = mod(p - h, r) - h;
  vec2 gv = dot(a, a) < dot(b, b) ? a : b;
  vec2 ag = abs(gv);
  float e = 0.5 - max(ag.x * 0.5 + ag.y * 0.8660254, ag.x);
  return vec4(gv, e, hash12(floor((p - gv) * 4.0 + 0.5)));
}

// 돌 판석 한 장의 질감: 칸마다 다른 돌빛·색조, 칸마다 방향이 다른 결과 알갱이·반점,
// 깎인 모서리(해를 향한 쪽은 밝고 반대쪽은 그늘), 오목한 이음매에 낀 흙, 오래 밟혀 닳은 자리와 얼룩.
// hx = hexCell(...), q = 무늬 좌표(m), fade = 멀어지면 잔무늬를 지운다(깜박임 방지)
vec3 paver(vec4 hx, vec2 q, float fw, float fade, vec3 cA, vec3 cB, float seamW, float scale, out float spec, out float seam) {
  float h = hx.w, h2 = fract(h * 13.7), h3 = fract(h * 71.3);
  vec3 c = mix(cA, cB, h);
  c *= vec3(1.0 + (h2 - 0.5) * 0.07, 1.0 + (h3 - 0.5) * 0.02, 1.0 + (h3 - 0.5) * 0.09);
  float ang = h * 6.2831;
  vec2 dir = vec2(cos(ang), sin(ang));
  float vein = vnoise(vec2(dot(q, dir) * 1.8, dot(q, vec2(-dir.y, dir.x)) * 0.3) + h * 17.0);
  float grain = vnoise(q * 7.0 + h * 31.0) * 0.6 + vnoise(q * 19.0) * 0.4;
  float fine = clamp(1.6 - fw * 6.0, 0.0, 1.0) * fade;
  c *= 1.0 + ((vein - 0.5) * 0.16 * fade + (grain - 0.5) * 0.18 * fine);
  vec2 sid = floor(q * 30.0);
  float speck = step(0.97, hash12(sid)) * fine;
  c *= mix(1.0, hash12(sid + 3.1) < 0.5 ? 0.62 : 1.3, speck * 0.7);
  // 깎인 모서리: 가장자리 쪽으로 기운 면 — 그 기울기가 해를 향하면 밝다
  float bev = (1.0 - smoothstep(0.0, 0.085, hx.z)) * fade;
  vec2 nrm = normalize(hx.xy + vec2(1e-4));
  float sunH = max(uSunDir.y, 0.0);
  float lit = dot(nrm, normalize(uSunDir.xz + vec2(1e-4))) * (1.0 - uNight) * smoothstep(0.0, 0.25, sunH);
  c *= 1.0 + bev * (lit * 0.32 - 0.1);
  // 오목한 이음매 + 낀 흙 (밤엔 그림자처럼 짙게)
  seam = (1.0 - smoothstep(0.0, seamW / scale + fw * 1.1 / scale, hx.z)) * fade;
  vec3 grout = vec3(0.13, 0.125, 0.14) * (0.75 + 0.5 * vnoise(q * 2.7));
  c = mix(c, grout, seam * 0.88);
  // 닳은 자리·얼룩 (큰 무늬)
  float wear = vnoise(q * 0.06) * 0.6 + vnoise(q * 0.19) * 0.4;
  c *= 0.9 + 0.17 * wear;
  float dirt = smoothstep(0.58, 0.85, vnoise(q * 0.45 + 7.0)) * 0.3 + smoothstep(0.62, 0.9, vnoise(q * 1.7 - 3.0)) * 0.15;
  c = mix(c, c * vec3(0.8, 0.79, 0.74), dirt);
  spec = mix(0.1, 0.5, h3 * wear) * (1.0 - seam);
  return c;
}

// 바닥 종류 → 색 (선형). q = 무늬 좌표(m), fw = 화소 크기(m)
// 세렌의 길은 지구의 아스팔트·페인트가 아니다: 짙은 쪽빛 합성 석판에 빛 안내줄, 육각 판석, 이끼·결정 모래
vec3 citySurface(CityS S, out vec3 em, out float spec) {
  em = vec3(0.0); spec = 0.0;
  vec2 q = S.q; float fw = S.fw;
  float fade = clamp(1.4 - fw * 2.2, 0.0, 1.0);
  vec3 c;
  int k = int(S.kind + 0.5);
  if (k == 1) { // 보도: 1.1 m 육각 판석 (돌결·깎인 모서리·이음매), 밤에 이음매에 희미한 빛
    vec4 hx = hexCell(q / 1.1);
    float seam;
    c = paver(hx, q, fw, fade, vec3(0.56, 0.54, 0.58), vec3(0.45, 0.44, 0.5), 0.035, 1.1, spec, seam);
    em += vec3(0.35, 0.85, 0.85) * seam * uGlow * 0.06;
  } else if (k == 2) { // 광장: 2.4 m 육각 + 동심 빛 새김
    vec4 hx = hexCell(q / 2.4);
    float seam, sp0;
    // 큰 판석: 밝은 석회빛과 조금 짙은 돌이 섞인다 (칸마다 다른 결)
    c = paver(hx, q, fw, fade, step(0.55, hx.w) > 0.5 ? vec3(0.5, 0.48, 0.53) : vec3(0.62, 0.6, 0.62), step(0.55, hx.w) > 0.5 ? vec3(0.44, 0.42, 0.48) : vec3(0.56, 0.54, 0.57), 0.04, 2.4, sp0, seam);
    float ringL = cLine(fract(S.line / 6.0) - 0.5, 0.025, fw / 6.0) * fade;
    c = mix(c, vec3(0.62, 0.52, 0.34), ringL * 0.7);
    em += mix(vec3(1.0, 0.75, 0.4), vec3(0.4, 0.95, 0.9), step(0.5, fract(S.line / 12.0))) * ringL * (0.08 + uGlow * 0.4);
    spec = sp0;
  } else if (k == 3) { // 이끼밭: 청록·보랏빛 낮은 이끼 + 밤에 빛나는 홀씨 점
    float n = vnoise(q * 0.35) * 0.6 + vnoise(q * 1.7) * 0.4;
    c = mix(vec3(0.05, 0.2, 0.17), vec3(0.16, 0.11, 0.24), smoothstep(0.35, 0.75, n)) * (0.9 + 0.2 * vnoise(q * 3.0));
    vec2 g = q * 1.6; vec2 id = floor(g), f = fract(g) - 0.5;
    float sp = (1.0 - smoothstep(0.05, 0.12, length(f))) * step(0.86, hash12(id)) * fade;
    vec3 sc = mix(vec3(0.5, 1.0, 0.9), vec3(1.0, 0.6, 0.9), hash12(id + 2.3));
    c = mix(c, sc * 0.6, sp * 0.5);
    em += sc * sp * (0.04 + uGlow * 0.5);
  } else if (k == 4) { // 꽃밭: 이끼 덮인 흙 + 흩어진 빛꽃 무리 (두 겹, 칸마다 자리·크기를 흔들어 격자로 보이지 않게)
    float n = vnoise(q * 0.6);
    c = mix(vec3(0.05, 0.12, 0.1), vec3(0.12, 0.07, 0.16), n) * (0.85 + 0.25 * vnoise(q * 4.0));
    for (int l = 0; l < 2; l++) {
      float fl = float(l);
      vec2 g = q * (2.6 + fl * 1.5) + fl * 7.31; vec2 id = floor(g), f = fract(g) - 0.5;
      float h = hash12(id + fl * 3.7);
      vec2 o = vec2(hash12(id + 1.7), hash12(id + 5.3)) - 0.5;
      float r = 0.12 + 0.17 * hash12(id + 9.1);
      float d = length(f - o * 0.55);
      float on = (1.0 - smoothstep(r * 0.55, r, d)) * step(0.42, hash12(id + 3.1)) * fade;
      vec3 col = h < 0.33 ? vec3(0.95, 0.4, 0.75) : h < 0.66 ? vec3(0.45, 0.95, 0.9) : vec3(0.65, 0.5, 1.0);
      c = mix(c, col * (0.55 + 0.45 * (1.0 - d / r)), on * 0.85);
      em += col * on * (0.03 + uGlow * 0.3) * step(0.4, h);
    }
  } else if (k == 5) { // 길: 빻은 결정 모래 (낮엔 반짝, 밤엔 희미한 빛)
    c = vec3(0.62, 0.58, 0.7) * (0.9 + 0.15 * vnoise(q * 3.0));
    float sp = step(0.93, hash12(floor(q * 5.0))) * fade;
    c += sp * 0.12;
    em += vec3(0.7, 0.8, 1.0) * sp * uGlow * 0.25;
    spec = 0.4;
  } else if (k == 6) { // 물: 얕은 빛물
    float w = vnoise(q * 0.8 + uTime * 0.3) * 0.5 + vnoise(q * 2.3 - uTime * 0.5) * 0.5;
    c = mix(vec3(0.02, 0.08, 0.14), vec3(0.06, 0.2, 0.28), w);
    em += vec3(0.2, 0.75, 0.85) * (0.05 + 0.12 * uGlow) * w;
    spec = 1.2;
  } else if (k == 7) { // 작업 마당: 청회색 합성판 6 m + 호박빛 빛줄 (칠한 선이 아니다)
    vec2 f = fract(q / 6.0), id = floor(q / 6.0);
    float seam = 1.0 - smoothstep(0.0, 0.01 + fw * 0.3, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)));
    c = vec3(0.3, 0.32, 0.38) * (0.9 + 0.12 * hash12(id)) * (1.0 - seam * 0.3 * fade) * (0.92 + 0.12 * vnoise(q * 0.4));
    c = mix(c, vec3(0.7, 0.5, 0.2), S.line * fade * 0.8);
    em += vec3(1.0, 0.68, 0.3) * S.line * fade * (0.15 + uGlow * 0.6) + vec3(0.4, 0.95, 0.9) * S.glow * uGlow * 0.6;
  } else if (k == 8) { // 결정 자갈
    c = vec3(0.3, 0.29, 0.36) * (0.75 + 0.4 * hash12(floor(q * 6.0)));
  } else if (k == 9) { // 격자 바닥 (빛 궤도)
    vec2 f = fract(q / 0.5);
    float g = (1.0 - smoothstep(0.0, 0.12 + fw * 3.0, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)))) * fade;
    c = mix(vec3(0.05, 0.05, 0.08), vec3(0.42, 0.44, 0.52), g * 0.8 + (1.0 - fade) * 0.4);
    c = mix(c, vec3(0.7, 0.72, 0.8), S.glow);
    em += vec3(0.4, 0.95, 0.9) * S.glow * (0.15 + uGlow * 0.65);
    spec = 0.6;
  } else if (k == 10) { // 밭: 18 m 마다 다른 세렌 작물 (청록 잎·보라 줄기·호박 열매·산호 잎), 0.9 m 이랑
    float field = floor(q.y / 18.0);
    float h = hash12(vec2(field, S.var));
    vec3 crop = h < 0.25 ? vec3(0.05, 0.28, 0.26) : h < 0.5 ? vec3(0.42, 0.3, 0.08) : h < 0.75 ? vec3(0.26, 0.1, 0.32) : vec3(0.4, 0.14, 0.18);
    float row = smoothstep(0.25, 0.45, abs(fract(q.y / 0.9) - 0.5));
    c = mix(crop, vec3(0.1, 0.08, 0.11), row * fade * 0.85 + (1.0 - fade) * 0.3);
    em += crop * (0.03 + uGlow * 0.18) * step(0.5, h);
  } else if (k == 11) { // 놀이 바닥: 말랑한 빛 젤, 동심 무늬
    c = mix(vec3(0.24, 0.12, 0.36), vec3(0.08, 0.34, 0.4), step(0.5, fract(length(q) / 2.4)));
    em += c * (0.08 + uGlow * 0.3);
  } else if (k == 12) { // 호버 차로: 짙은 쪽빛 합성 석판 + 빛 안내줄(흐른다)
    vec4 hx = hexCell(q / 2.0);
    float seam, sp0;
    c = paver(hx, q, fw, fade, vec3(0.085, 0.09, 0.125), vec3(0.065, 0.068, 0.1), 0.03, 2.0, sp0, seam);
    float flow = 0.55 + 0.45 * sin(uTime * 2.4 - (q.x + q.y) * 0.18);
    c = mix(c, vec3(0.3, 0.55, 0.6), S.line * fade * 0.6);
    em += vec3(0.35, 0.95, 0.9) * (S.line * fade * flow * (0.35 + uGlow * 0.9) + S.glow * (0.15 + uGlow * 0.6));
    spec = 0.5;
  } else if (k == 13) { // 연석 + 빛줄
    c = vec3(0.64, 0.62, 0.7);
    em += vec3(0.4, 0.95, 0.9) * S.glow * (0.1 + uGlow * 0.7);
  } else if (k == 15) { // 건널목: 육각 빛판 — 이음매가 호박빛으로 빛나고, 건너는 방향으로 빛이 흐른다 (칠한 줄무늬 대신)
    vec4 hx = hexCell(q / 0.9);
    float seam = (1.0 - smoothstep(0.0, 0.05 + fw * 1.2, hx.z)) * fade;
    float pulse = 0.5 + 0.5 * sin(uTime * 3.0 - q.x * 1.3);
    c = vec3(0.17, 0.16, 0.22) * (0.9 + 0.15 * hx.w);
    c = mix(c, vec3(0.78, 0.62, 0.36), seam * 0.75);
    em += vec3(1.0, 0.75, 0.4) * seam * (0.12 + uGlow * 0.6) * (0.55 + 0.45 * pulse);
    spec = 0.4;
  } else { // 14 생울타리: 보랏빛 덤불 + 청록 점
    c = vec3(0.12, 0.07, 0.18) * (0.8 + 0.4 * vnoise(q * 4.0));
    float sp = step(0.9, hash12(floor(q * 3.0)));
    em += vec3(0.4, 0.95, 0.85) * sp * uGlow * 0.3;
  }
  return c;
}

// 블록 안 (u: 고리 방향, v: 바깥 방향, L·D: 길이·깊이)
CityS cityBlock(float type, float vari, float stilt, float u, float v, float L, float D, float j, float m, float fw) {
  CityS S; S.q = vec2(u, v); S.fw = fw; S.var = vari; S.line = 0.0; S.glow = 0.0; S.kind = 1.0;
  int t = int(type + 0.5);
  vec2 p = vec2(u, v);
  float edge = min(min(u, L - u), min(v, D - v));
  float cu = L * 0.5, cv = D * 0.5;
  float natural = mod(floor(stilt / 2.0), 2.0), sparse = floor(stilt / 4.0);
  stilt = mod(stilt, 2.0);
  if (t == 1) { // 주거
    if (D < 58.0) {
      float hd = min(10.0, D * 0.3);
      S.kind = (v < hd * 2.0 + 4.0 || v > D - hd * 2.0 - 4.0) ? 1.0 : 3.0;
      if (length(p - vec2(cu, cv)) < 6.0) S.kind = 11.0;
      return S;
    }
    S.kind = 1.0;
    if (v > 20.0 && v < D - 20.0 && u > 28.0 && u < L - 28.0) {
      S.kind = 3.0;
      if (abs(abs(v - cv) - 7.5) < 1.25) S.kind = 5.0;
      if (abs(abs(v - cv) - 10.5) < 1.1) S.kind = 4.0;
      if (abs(v - cv) < 1.5) S.kind = 5.0;
      if (length(p - vec2(cu - 13.0, cv)) < 6.5) S.kind = 11.0;
      if (length(p - vec2(cu + 14.0, cv)) < 5.5) S.kind = 1.0;
    }
    return S;
  }
  if (t == 2) { // 상업
    float pl = (j < 0.5 || j > m - 1.5) ? 26.0 : 18.0;
    bool atStart = j < m - 1.5 || m < 1.5;
    float pc = atStart ? pl * 0.5 : L - pl * 0.5;
    S.kind = 1.0;
    if ((atStart && u < pl) || (!atStart && u > L - pl)) { S.kind = 2.0; S.q = p - vec2(pc, cv); S.line = length(S.q); }
    return S;
  }
  if (t == 3) { // 공공
    float hw = min(30.0, L * 0.32), hd = min(19.0, D * 0.27), bv = D - 4.0 - hd;
    float fv = (bv - hd) * 0.5;
    S.kind = 1.0;
    if (v < bv - hd - 1.0) { S.kind = 2.0; S.q = p - vec2(cu, fv); S.line = length(S.q); }
    else if (abs(u - cu) > hw + 4.0) S.kind = 3.0;
    if (v < bv - hd - 1.0 && abs(u - cu) > hw + 6.0) S.kind = 3.0;
    return S;
  }
  if (t == 4) { // 산업
    float hd = min(D * 0.18, 13.0);
    S.kind = 7.0;
    float l1 = cLine(v - (hd * 2.0 + 8.0), 0.12, fw) + cLine(v - (D * 0.62 - 4.5), 0.12, fw) + cLine(v - (D * 0.62 + 4.5), 0.12, fw);
    float bay = step(L * 0.36, u) * step(u, L * 0.74) * step(abs(v - D * 0.62), 4.5) * cLine(fract((u - L * 0.38 + 4.5) / 9.0) - 0.5, 0.012, fw / 9.0);
    S.line = clamp(l1 + bay, 0.0, 1.0);
    S.glow = cLine(edge - 1.0, 0.08, fw);
    if (length(p - vec2(L * 0.2, D - 14.0)) < 13.0) S.kind = 9.0;
    return S;
  }
  if (t == 5) { // 물류
    float hd = min(D * 0.2, 14.0), v0 = 2.0 * hd + 12.0;
    S.kind = 7.0;
    if (v > v0 - 4.0 && u < min(L - 30.0, 100.0) + 4.0) S.line = max(cLine(fract((u - 8.0 + 3.75) / 7.5) - 0.5, 0.008, fw / 7.5), cLine(fract((v - v0 + 4.5) / 9.0) - 0.5, 0.01, fw / 9.0)) * 0.8;
    else if (v > 2.0 * hd + 5.0) S.line = cLine(fract(u / 6.0) - 0.5, 0.04, fw / 6.0) * cLine(v - (hd * 2.0 + 8.5), 0.15, fw);
    float pd = min(length(p - vec2(L - 24.0, D - 9.0)), length(p - vec2(L - 24.0, D - 22.0)));
    if (pd < 4.5) { S.kind = 9.0; }
    S.glow = cLine(pd - 4.2, 0.12, fw) + cLine(edge - 1.0, 0.08, fw);
    return S;
  }
  if (t == 6) { // 에너지
    float rr = min(min(17.0, D * 0.28), L * 0.18);
    S.kind = 8.0;
    if (u < min(L * 0.16, 24.0) + 3.0 || u > max(L * 0.84, L - 26.0) - 3.0) S.kind = 9.0;
    if (length(p - vec2(L * 0.36, cv)) < rr + 4.0) S.kind = 7.0;
    float cr = min(11.0, D * 0.17);
    if (length(p - vec2(L * 0.68, D * 0.28)) < cr + 3.0 || length(p - vec2(L * 0.68, D * 0.72)) < cr + 3.0) S.kind = 7.0;
    S.glow = cLine(edge - 1.2, 0.1, fw);
    if (S.kind == 7.0) S.glow += cLine(length(p - vec2(L * 0.36, cv)) - rr - 3.2, 0.1, fw);
    return S;
  }
  if (t == 7) { // 연구
    S.kind = 1.0;
    vec2 qd = abs(p - vec2(cu, cv));
    if (qd.x < L * 0.22 && qd.y < D * 0.2) {
      S.kind = 3.0;
      float k1 = abs((p.x - cu) * (D * 0.2) - (p.y - cv) * (L * 0.22)) / length(vec2(D * 0.2, L * 0.22));
      float k2 = abs((p.x - cu) * (D * 0.2) + (p.y - cv) * (L * 0.22)) / length(vec2(D * 0.2, L * 0.22));
      if (min(k1, k2) < 1.3) S.kind = 5.0;
      if (length(p - vec2(cu, cv)) < 5.0) S.kind = 2.0;
    }
    return S;
  }
  if (t == 8) { // 교통
    S.kind = 2.0; S.q = p; S.line = 1000.0;
    if (v > D * 0.6 && v < D * 0.72 && u < L * 0.78) { S.kind = 7.0; S.line = cLine(fract(u / 6.0) - 0.5, 0.025, fw / 6.0) + cLine(v - D * 0.6, 0.08, fw); }
    if (v > D - 10.0) { S.kind = 1.0; }
    if (abs(v - (D - 10.0)) < 0.25) { S.kind = 13.0; S.glow = 0.7; }
    return S;
  }
  if (t == 9) { // 인공 환경
    if (mod(vari, 2.0) < 0.5) {
      float rr = min(min(28.0, D * 0.4), L * 0.34);
      float d = length(p - vec2(cu, cv));
      S.kind = d < rr + 5.0 ? 1.0 : (d < rr + 9.0 && d > rr + 7.0) ? 6.0 : 3.0;
      if (d > rr + 9.0 && d < rr + 10.5) S.kind = 4.0;
    } else {
      S.kind = 1.0;
      if (u > L * 0.3) { S.kind = 10.0; S.q = vec2(u, v * 0.5); }
      if (abs(u - L * 0.62) < L * 0.3 + 1.0) S.kind = 1.0;
    }
    return S;
  }
  if (t == 10) { // 계획 녹지
    float pr = min(L, D) * 0.2;
    if (natural > 0.5) { // 보존 공원: 자연 그대로 + 둘레 길 + 정자 마당
      S.kind = (edge > 4.0 && edge < 7.0) ? 5.0 : 0.0;
      if (length(p - vec2(cu, cv)) < 6.5) S.kind = 1.0;
      return S;
    }
    S.kind = 3.0;
    if (edge > 3.0 && edge < 6.0) S.kind = 5.0;
    float dl = length(vec2(L, D));
    float d1 = abs((p.x) * D - (p.y) * L) / dl, d2 = abs((p.x) * D + (p.y - D) * L) / dl;
    if (min(d1, d2) < 1.6) S.kind = 5.0;
    vec2 e = (p - vec2(cu, cv)) / vec2(pr, pr * 0.8);
    float de = length(e) * pr;
    if (de < pr + 4.0) S.kind = de < pr ? 6.0 : de < pr + 2.5 ? 5.0 : 4.0;
    if (length(p - vec2(cu + pr + 12.0, cv)) < 6.5) S.kind = 1.0;
    if (length(p - vec2(cu - pr - 14.0, cv)) < 7.0) S.kind = 11.0;
    if (edge < 1.5) S.kind = 1.0;
    return S;
  }
  if (t == 11) { // 광장
    float R = min(L, D) * 0.36;
    S.kind = 2.0; S.q = p - vec2(cu, cv); S.line = length(S.q);
    float d = length(S.q);
    if (d < 7.0 && d > 3.0) S.kind = 6.0;
    if (abs(d - R) < 1.0) S.kind = 4.0;
    return S;
  }
  if (t == 12) { // 농지
    S.kind = 10.0; S.q = vec2(u, v);
    if (edge < 3.0 || abs(fract(u / 40.0) - 0.5) * 40.0 > 18.5) S.kind = 5.0;
    float fk = mod(vari, 3.0);
    if (fk < 0.5 && abs(u - L * 0.5) < L * 0.36 + 1.0 && v > 10.0 && v < D - 10.0) S.kind = 1.0;
    if (fk > 0.5 && fk < 1.5 && edge > 3.0) S.kind = 3.0;
    if (u < 30.0 && v > D - 30.0) S.kind = 3.0;
    if (u > L - 26.0 && v > D - 26.0) S.kind = 8.0;
    return S;
  }
  if (t == 13) { // 주택가
    float lotW = 26.0 + mod(vari, 4.0) * 2.0;
    float n = max(1.0, floor(L / lotW)), w = L / n;
    float depth = min(D * 0.42, 34.0);
    float li = floor(u / w), lu = u - li * w;
    bool inLot = v < depth || v > D - depth;
    if (inLot) {
      bool inner = v < depth;
      float vv = inner ? v : D - v; // 거리에서 잰 깊이
      float hd = min(8.0, depth * 0.5 - 3.0), hw = min(10.0, w * 0.5 - 3.0);
      S.kind = 3.0;
      if (abs(lu - w * 0.5) < hw + 2.0 && abs(vv - (hd + 5.0)) < hd + 2.0) S.kind = 1.0;
      if (abs(lu - w * 0.22) < 1.5 && vv < hd + 5.0) S.kind = 5.0;
      if (min(lu, w - lu) < 0.45 || abs(vv - depth) < 0.45) S.kind = 14.0;
      float hp = hash12(vec2(li, inner ? 1.0 : 2.0) + vari);
      if (hp < 0.35 && cBox(vec2(lu, vv), vec2(w * 0.72, depth - 7.0), vec2(2.6, 1.8)) < 0.0) S.kind = 6.0;
      if (stilt > 0.5) S.kind = S.kind == 1.0 ? 1.0 : 0.0;
    } else {
      S.kind = abs(v - cv) < 2.0 ? 5.0 : 3.0;
      if (length(p - vec2(cu, cv)) < 6.0) S.kind = 11.0;
    }
    return S;
  }
  S.kind = 0.0;
  return S;
}

// 그 자리의 도시 바닥. cov 0 이면 자연 그대로
// 골목의 쓰임: 이웃 블록 두 쓰임(tA, tB)에 따라 — 1 작업로(산업·물류·에너지·교통) 2 녹지 산책길(녹지·광장·공공) 3 상가 거리 4 보조 도로 0 보통 골목
float laneStyle(float tA, float tB, bool mid) {
  bool iA = tA > 3.5 && tA < 6.5 || tA > 7.5 && tA < 8.5, iB = tB > 3.5 && tB < 6.5 || tB > 7.5 && tB < 8.5;
  if (iA && iB) return 1.0;
  if (mid && !(tA > 9.5 && tA < 11.5) && !(tB > 9.5 && tB < 11.5)) return 4.0;
  if (tA > 9.5 && tA < 11.5 || tB > 9.5 && tB < 11.5 || tA > 2.5 && tA < 3.5 || tB > 2.5 && tB < 3.5) return 2.0;
  if (tA > 1.5 && tA < 2.5 || tB > 1.5 && tB < 2.5) return 3.0;
  return 0.0;
}
// 골목 바닥: cx = 골목 가운데로부터(가로), al = 골목을 따라(m), w = 골목 폭
void laneSurface(inout CityS S, float st, float cx, float al, float w, float fw, float vari) {
  float acx = abs(cx);
  if (st > 3.5) { // 보조 도로: 차도 + 연석 + 좁은 보도
    if (acx < w * 0.5 - 1.6) { S.kind = 12.0; S.q = vec2(acx, al); S.line = studs(al, acx, fw); }
    else if (acx < w * 0.5 - 1.35) { S.kind = 13.0; S.glow = 0.6; }
    else { S.kind = 1.0; S.q = vec2(al, acx); }
  } else if (st > 2.5) { // 상가 거리: 큰 판석 + 가운데 빛 새김
    S.kind = 2.0; S.q = vec2(cx, al); S.line = 1000.0;
    S.glow = cLine(acx, 0.06, fw) * 0.8;
  } else if (st > 1.5) { // 녹지 산책길: 가운데 물길(가끔) + 모래 길 + 잔디 띠
    if (acx < 0.7 && vari > 0.5) { S.kind = 6.0; S.q = vec2(cx, al); }
    else if (acx < 2.4) { S.kind = 5.0; S.q = vec2(cx, al); }
    else { S.kind = 3.0; S.q = vec2(al, cx); }
  } else if (st > 0.5) { // 작업로: 콘크리트 + 노란 가운데 점선 + 짐 내리는 칸
    S.kind = 7.0; S.q = vec2(al, cx);
    S.line = cLine(acx, 0.08, fw) * step(0.45, fract(al / 5.0)) + cLine(fract(al / 12.0) - 0.5, 0.03, fw / 12.0) * step(w * 0.5 - 2.2, acx);
  } else { // 보통 골목: 가운데 화단 + 판석
    S.kind = acx < 0.8 ? 4.0 : 1.0; S.q = vec2(al, cx);
    S.glow = cLine(acx - 1.2, 0.05, fw) * 0.6;
  }
}

vec3 cityGround(vec3 wp, out float cov, out vec3 em, out float spec) {
  cov = 0.0; em = vec3(0.0); spec = 0.0;
  if (uCityN == 0 || wp.y < 0.3) return vec3(0.0);
  vec2 xz = wp.xz;
  for (int i = 0; i < CITY_NZ; i++) {
    if (i >= uCityN) break;
    vec4 A = uCZ0[i];
    vec2 d = xz - A.xy;
    float r = length(d);
    vec4 Bz = uCZ1[i]; vec4 Cz = uCZ2[i]; float rOut = uCZ3[i].x;
    float street = Bz.x;
    if (r > rOut + street) continue;
    if (r < A.z - street) {
      // 중심 광장 (수도·네 구역의 큰 탑 둘레): 풀밭 대신 동심 판석 광장 + 대로를 잇는 방사 산책로 + 둥근 화단
      if (uCZ3[i].y < 0.5) continue;
      float fwc = max(fwidth(r), 0.002);
      CityS C; C.fw = fwc; C.var = 0.0; C.line = r; C.glow = 0.0; C.kind = 2.0; C.q = d;
      float ac = atan(d.y, d.x);
      float SAc = 6.2831853 / max(Bz.z, 4.0);
      float relc = mod(ac - Bz.w, 6.2831853);
      float fsc = relc - floor(relc / SAc) * SAc;
      float dAvc = min(fsc, SAc - fsc) * r;
      float step32 = 34.0, rf = mod(r, step32);
      if (dAvc < 4.5) { C.kind = 1.0; C.q = vec2(dAvc, r); }
      else if (dAvc < 4.75) { C.kind = 13.0; C.glow = 0.8; }
      else if (abs(rf - 1.8) < 1.8 && r > 40.0) { C.kind = 1.0; C.q = vec2(ac * r, rf); }
      else {
        // 고리 띠 가운데 줄의 자리 (cityplan.layoutCore 와 같은 칸): 0·3 나무 화단, 1 물의 정원, 2 작은 시설(동심 무늬 판)
        float kr = floor(r / step32);
        float rc = (kr + 0.5) * step32 + 1.8;
        float nC = max(6.0, floor(6.2831853 * rc / 30.0));
        float nS = max(2.0, floor(nC / max(Bz.z, 4.0)));
        float sec = floor(relc / SAc);
        float slot = floor(fsc / SAc * nS);
        float ty = mod(kr * 7.0 + slot * 3.0 + sec, 4.0);
        float acc = Bz.w + sec * SAc + (slot + 0.5) / nS * SAc;
        float dc = length(xz - (A.xy + vec2(cos(acc), sin(acc)) * rc));
        if (kr > 0.5) {
          if (ty > 0.5 && ty < 1.5) { if (dc < 7.2) { C.kind = dc < 6.6 ? 6.0 : 13.0; C.glow = dc >= 6.6 ? 1.0 : 0.0; C.q = xz; } }
          else if (ty > 1.5 && ty < 2.5) { if (dc < 9.5) { C.kind = 2.0; C.q = xz - A.xy; C.line = dc * 1.5; } }
          else if (dc < 5.2) { C.kind = dc < 4.9 ? (dc < 1.6 ? 4.0 : 3.0) : 13.0; C.glow = dc >= 4.9 ? 1.0 : 0.0; C.q = xz; }
        }
      }
      cov = 1.0;
      return citySurface(C, em, spec);
    }
    float ring = A.w, r0 = A.z, nb = Bz.y, avn = Bz.z, aOff = Bz.w, row0 = Cz.x, lane = Cz.z, avH = Cz.w;
    float a = atan(d.y, d.x);
    float SA = 6.2831853 / avn;
    float rel = mod(a - aOff, 6.2831853);
    float s = floor(rel / SA);
    float fs = rel - s * SA;
    float dAv = min(fs, SA - fs) * r;
    float fw = max(fwidth(r), 0.002);
    CityS S; S.q = xz; S.fw = fw; S.var = 0.0; S.line = 0.0; S.glow = 0.0; S.kind = 0.0;
    float kf = floor((r - r0) / ring);
    float along = a * r;
    // 고리 거리 위치 (차도 가운데선까지)
    float vbS = -1.0, sw = min(4.6, street * 0.225 - 0.4), rw = street * 0.55;
    bool onStreet = false;
    if (kf >= nb) { vbS = r - rOut; onStreet = vbS < street; }
    else if (kf >= 0.0) {
      vec4 RT = cityTexel(row0, kf);
      float vb = r - (r0 + kf * ring);
      bool hasSt = RT.a > 0.5;
      float bs = hasSt ? street : lane;
      if (vb < bs) {
        if (hasSt) { vbS = vb; onStreet = true; }
        else { // 골목 (차도 없는 고리 경계): 바깥 블록과 안쪽 블록의 쓰임으로 모양이 달라진다
          float m2 = RT.r, st2 = RT.g + RT.b * 256.0;
          float j2 = min(m2 - 1.0, floor(fs / SA * m2));
          float tO = cityTexel(row0, st2 + s * m2 + j2).r;
          float tI = tO;
          if (kf > 0.5) { vec4 RI = cityTexel(row0, kf - 1.0); float mi = RI.r; float ji = min(mi - 1.0, floor(fs / SA * mi)); tI = cityTexel(row0, RI.g + RI.b * 256.0 + s * mi + ji).r; }
          laneSurface(S, laneStyle(tO, tI, false), vb - bs * 0.5, along, bs, fw, step(0.5, fract(kf * 0.37 + s * 0.21)));
        }
      } else if (dAv >= avH) {
        float m = RT.r, start = RT.g + RT.b * 256.0;
        float j = min(m - 1.0, floor(fs / SA * m));
        float threl = fs - j * SA / m;
        float t0 = j < 0.5 ? avH : lane * 0.5, t1 = j > m - 1.5 ? avH : lane * 0.5;
        float u = threl * r - t0;
        float Lr = (SA / m) * r - t0 - t1;
        float v = vb - bs, D = ring - bs;
        if (u < 0.0 || u > Lr) { // 블록 사이 골목: 양쪽 블록의 쓰임 → 작업로·녹지 산책길·상가 거리·보조 도로·보통 골목
          float x = u < 0.0 ? -u : u - Lr;
          float cx = lane * 0.5 - x;
          float jn = u < 0.0 ? j - 1.0 : j + 1.0;
          float tA = cityTexel(row0, start + s * m + j).r;
          float tB = (jn >= 0.0 && jn < m) ? cityTexel(row0, start + s * m + jn).r : tA;
          // 부채꼴 가운데 경계는 바깥 고리에서 가끔 보조 도로(방사 방향의 작은 차도)가 된다
          float jb = u < 0.0 ? j : j + 1.0;
          bool mid = m > 2.5 && abs(jb - floor(m * 0.5)) < 0.5 && mod(s + kf, 3.0) > 0.5 && kf > 1.5;
          laneSurface(S, laneStyle(tA, tB, mid), cx, vb, lane, fw, step(0.5, fract(j * 0.41 + kf * 0.23)));
        } else {
          vec4 BT = cityTexel(row0, start + s * m + j);
          if (BT.a < 0.5 || BT.r < 0.5) { cov = 0.0; return vec3(0.0); }
          S = cityBlock(BT.r, BT.g, BT.b, u, v, Lr, D, j, m, fw);
          if (S.kind < 0.5) { cov = 0.0; return vec3(0.0); }
        }
      }
    } else if (dAv >= avH) { continue; }
    // 대로 (가장 위)
    if (dAv < avH && r > r0 - street) {
      float x = dAv;
      float hw2 = street * 0.35;
      if (x < hw2) {
        S.kind = 12.0; S.q = vec2(x, r);
        S.line = cLine(x - hw2 + 0.35, 0.08, fw) + studs(r, x - hw2 * 0.5, fw);
        S.glow = cLine(x, 0.12, fw);
        if (x < 1.4) { // 가운데: 큰 대로(짝수)는 빛 궤도(전차), 작은 대로는 화단
          float avI = mod(floor((rel + SA * 0.5) / SA), avn);
          if (mod(avI, 2.0) < 0.5) { S.kind = 9.0; S.q = vec2(x, r); S.glow = cLine(x - 0.72, 0.07, fw); S.line = 0.0; }
          else { S.kind = 4.0; S.glow = 0.0; }
        }
        // 건널목: 고리 거리 바로 바깥
        float vbn = mod(r - r0, ring);
        if (vbn > street && vbn < street + 4.5 && x >= 1.4) { S.kind = 15.0; S.q = vec2(x, vbn); }
      } else if (x < hw2 + 0.25) { S.kind = 13.0; S.glow = 1.0; S.q = vec2(x, r); }
      else { S.kind = 1.0; S.q = vec2(x, r); }
      onStreet = false;
    } else if (onStreet) {
      float x = vbS - street * 0.5, ax = abs(x);
      S.q = vec2(along, x);
      if (ax < 1.1 && mod(max(kf, 0.0), 2.0) < 0.5 && street > 19.0) { S.kind = 4.0; S.q = vec2(along, x); } // 큰 고리 거리: 가운데 꽃 띠
      else if (ax < rw * 0.5) {
        S.kind = 12.0;
        S.line = cLine(ax - rw * 0.5 + 0.35, 0.08, fw) + studs(along, ax - rw * 0.25, fw);
        S.glow = cLine(ax, 0.1, fw);
        // 건널목: 대로 바로 옆
        if (dAv > avH && dAv < avH + 4.5) { S.kind = 15.0; S.q = vec2(x, dAv); }
      } else if (ax < rw * 0.5 + 0.25) { S.kind = 13.0; S.glow = 1.0; }
      else if (ax < rw * 0.5 + 0.25 + sw) { S.kind = 1.0; S.q = vec2(along, ax); }
      else S.kind = 1.0;
    }
    if (S.kind < 0.5) return vec3(0.0);
    cov = 1.0;
    return citySurface(S, em, spec);
  }
  return vec3(0.0);
}
`;
