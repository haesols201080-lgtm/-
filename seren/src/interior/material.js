// 실내 재질 (v0.9): 한 셰이더가 바닥·벽·천장·가구의 무늬를 모두 그린다 (정점마다 무늬 번호와 값).
//  · 빛은 천장에서: 방마다 천장 빛판의 색·세기(층의 빛깔 묶음) + 창가의 바깥빛(낮엔 밝고 밤엔 도시 불빛) + 가장자리 빛.
//  · 무늬(바닥): 판석·타일·띠판·카펫·기술 격자·에폭시(공장 안전선)·결나무·코트 선·이끼 · (벽) 판넬·갈비·물결·타일 · (천장) 우물반자·빛줄·트러스·생장등·격자
//  · 같은 무늬도 방마다 다른 크기·방향·색 — 건물의 씨앗이 정한다(정점 값).
import * as THREE from 'three';
import { NOISE_GLSL, ATMOS_PARS, CURVE_GLSL } from '../world/shaders.js';
import { atmosUniforms } from '../world/atmosphere.js';

export const PAT = {
  plain: 0, tile: 1, strip: 2, stone: 3, carpet: 4, grid: 5, epoxy: 6, wood: 7, court: 8, moss: 9,
  panel: 20, rib: 21, wave: 22, wtile: 23, glassfrost: 24,
  coffer: 40, lightstrip: 41, truss: 42, grow: 43, cgrid: 44, cplain: 45,
  metal: 60, fabric: 61, crystal: 62, leafy: 63, screen: 64,
};

const vert = /* glsl */ `
${CURVE_GLSL}
attribute vec3 color;
attribute float emit;
attribute vec2 pat;
varying vec3 vColor; varying float vEmit; varying vec2 vPat;
varying vec3 vWorld; varying vec3 vLocal; varying vec3 vNormal;
void main() {
  vColor = color; vEmit = emit; vPat = pat; vLocal = position;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * vec4(curveWorld(wp.xyz), 1.0);
}`;

const frag = /* glsl */ `
${NOISE_GLSL}
${ATMOS_PARS}
uniform vec3 uLight;     // 천장 빛 색 × 세기
uniform vec3 uAccent;    // 무늬 빛줄 색
uniform float uWarm;     // 창가 바깥빛 세기
varying vec3 vColor; varying float vEmit; varying vec2 vPat;
varying vec3 vWorld; varying vec3 vLocal; varying vec3 vNormal;
float lineF(float v, float w) { float f = fract(v); float d = min(f, 1.0 - f); float fw = fwidth(v); return 1.0 - smoothstep(w, w + fw * 1.5, d); }
void main() {
  vec3 N = normalize(vNormal);
  if (!gl_FrontFacing) N = -N;
  vec3 alb = vColor;
  vec3 em = vec3(0.0);
  float id = floor(vPat.x + 0.5), prm = vPat.y;
  vec2 q = abs(N.y) > 0.6 ? vLocal.xz : (abs(N.x) > abs(N.z) ? vLocal.zy : vLocal.xy);
  float sc = 1.0 + prm;
  // ── 바닥 ──
  if (id == 1.0) { // 타일: 줄눈 + 타일마다 살짝 다른 결
    vec2 t = q / (0.6 * sc); vec2 tid = floor(t);
    alb *= 0.92 + 0.12 * hash12(tid);
    alb = mix(alb, alb * 0.55, max(lineF(t.x, 0.02), lineF(t.y, 0.02)));
  } else if (id == 2.0) { // 띠판: 길게 이어진 판, 엇갈린 이음
    vec2 t = vec2(q.x / (0.25 * sc), q.y / (2.4 * sc)); t.y += hash12(vec2(floor(t.x), 3.0)) * 3.0;
    alb *= 0.9 + 0.14 * hash12(floor(t));
    alb = mix(alb, alb * 0.6, max(lineF(t.x, 0.03), lineF(t.y, 0.01)));
  } else if (id == 3.0) { // 판석: 큰 판 + 결
    vec2 t = q / (1.6 * sc); vec2 tid = floor(t);
    float vein = smoothstep(0.62, 0.7, vnoise(q * 1.7 + tid * 7.0)) * 0.25;
    alb *= 0.9 + 0.1 * hash12(tid) + vein;
    alb = mix(alb, alb * 0.6, max(lineF(t.x, 0.008), lineF(t.y, 0.008)));
  } else if (id == 4.0) { // 카펫: 고운 결 + 큰 무늬
    float n = vnoise(q * 9.0) * 0.5 + vnoise(q * 23.0) * 0.5;
    alb *= 0.86 + 0.18 * n;
    alb = mix(alb, alb * 1.12, smoothstep(0.45, 0.55, vnoise(q * 0.35 + prm)) * 0.5);
  } else if (id == 5.0) { // 기술 격자: 빛나는 이음매
    vec2 t = q / (0.6 * sc);
    float l = max(lineF(t.x, 0.02), lineF(t.y, 0.02));
    alb = mix(alb, alb * 0.5, l); em += uAccent * l * 0.35;
  } else if (id == 6.0) { // 에폭시: 점무늬 + 노란 안전선
    alb *= 0.92 + 0.16 * hash12(floor(q * 9.0));
    float sl = lineF(q.x / (4.0 * sc), 0.012) + lineF(q.y / (4.0 * sc), 0.012);
    alb = mix(alb, vec3(0.95, 0.75, 0.25), min(1.0, sl) * 0.75);
  } else if (id == 7.0) { // 결나무 (세렌의 판나무: 물결진 나이테)
    vec2 t = vec2(q.x / (0.18 * sc), q.y / (1.8 * sc)); t.y += hash12(vec2(floor(t.x), 1.0)) * 4.0;
    float ring = sin((q.y + vnoise(q * 0.8) * 1.5) * 9.0) * 0.5 + 0.5;
    alb *= 0.82 + 0.12 * ring + 0.1 * hash12(floor(t));
    alb = mix(alb, alb * 0.62, lineF(t.x, 0.04));
  } else if (id == 8.0) { // 코트 선
    alb *= 0.95 + 0.05 * vnoise(q * 3.0);
    float cl = lineF(q.x / 9.0, 0.006) + lineF(q.y / 6.0, 0.008) + (1.0 - smoothstep(0.03, 0.06, abs(length(fract(q / 9.0) - 0.5) * 9.0 - 1.8)));
    alb = mix(alb, uAccent, min(1.0, cl) * 0.8);
  } else if (id == 9.0) { // 이끼
    float n = vnoise(q * 2.2) * 0.6 + vnoise(q * 7.0) * 0.4;
    alb *= 0.7 + 0.5 * n;
  }
  // ── 벽 ──
  else if (id == 20.0) { // 판넬
    float l = lineF(q.x / (1.2 * sc), 0.006); alb = mix(alb, alb * 0.75, l);
    alb *= 0.96 + 0.06 * hash12(vec2(floor(q.x / (1.2 * sc)), 2.0));
  } else if (id == 21.0) { // 갈비: 가로 홈
    float l = lineF(q.y / (0.35 * sc), 0.08); alb = mix(alb, alb * 0.82, l);
  } else if (id == 22.0) { // 물결 (아웬의 노래 결)
    float w = sin(q.x * 2.2 + sin(q.y * 1.3) * 1.6) * 0.5 + 0.5; alb *= 0.9 + 0.12 * w;
    em += uAccent * lineF(q.x * 0.35 + sin(q.y * 0.9) * 0.4, 0.01) * 0.15;
  } else if (id == 23.0) { // 벽 타일
    vec2 t = q / vec2(0.3, 0.6); alb = mix(alb, alb * 0.7, max(lineF(t.x, 0.03), lineF(t.y, 0.02)));
  } else if (id == 24.0) { // 서리 유리 띠
    alb = mix(alb, vec3(0.85, 0.93, 0.98), 0.5);
  }
  // ── 천장 ──
  else if (id == 40.0) { // 우물반자: 칸마다 가운데 빛
    vec2 t = q / (2.4 * sc); vec2 f = fract(t) - 0.5;
    float lamp = 1.0 - smoothstep(0.12, 0.16, max(abs(f.x), abs(f.y)));
    alb = mix(alb, alb * 0.7, max(lineF(t.x, 0.03), lineF(t.y, 0.03)));
    em += uLight * lamp * 0.9;
  } else if (id == 41.0) { // 빛줄
    float l = 1.0 - smoothstep(0.04, 0.07, abs(fract(q.x / (2.0 * sc)) - 0.5));
    em += uLight * l * 1.0;
  } else if (id == 42.0) { // 트러스 (공장·창고): 보 그림자 + 매달린 등
    float b = lineF(q.x / (3.0 * sc), 0.04) + lineF(q.y / (6.0 * sc), 0.03);
    alb = mix(alb, alb * 0.45, min(1.0, b));
    vec2 f = fract(q / vec2(3.0 * sc, 6.0 * sc)) - 0.5;
    em += uLight * (1.0 - smoothstep(0.03, 0.06, length(f * vec2(1.0, 0.5)))) * 1.2;
  } else if (id == 43.0) { // 생장등 (보랏빛)
    float l = 1.0 - smoothstep(0.05, 0.09, abs(fract(q.x / 1.4) - 0.5));
    em += vec3(0.85, 0.35, 1.0) * l * 0.9 + uLight * 0.05;
  } else if (id == 44.0) { // 격자 천장
    vec2 t = q / 0.6; alb = mix(alb, alb * 0.7, max(lineF(t.x, 0.02), lineF(t.y, 0.02)));
    vec2 f = fract(q / 3.6) - 0.5; em += uLight * (1.0 - smoothstep(0.2, 0.24, max(abs(f.x), abs(f.y)))) * 0.6;
  }
  // ── 가구 ──
  else if (id == 60.0) { // 금속: 결 + 반사
    alb *= 0.9 + 0.1 * vnoise(vec2(q.x * 30.0, q.y * 2.0));
  } else if (id == 61.0) { // 천
    alb *= 0.88 + 0.12 * vnoise(q * 30.0);
  } else if (id == 62.0) { // 결정
    em += alb * 0.25 * (0.5 + 0.5 * sin(uTime * 1.3 + vWorld.y * 3.0));
  } else if (id == 63.0) { // 잎
    alb *= 0.75 + 0.35 * vnoise(q * 6.0);
  } else if (id == 64.0) { // 화면: 흐르는 빛 글자 줄
    float rows = step(0.55, hash12(vec2(floor(q.y * 14.0), floor(q.x * 6.0 + uTime * 0.6))));
    em += vColor * (0.5 + 0.5 * rows) * 0.9; alb *= 0.2;
  }
  // 빛: 천장 빛(위에서) + 바닥 반사 + 가장자리
  float up = N.y * 0.5 + 0.5;
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 light = uLight * (0.5 + 0.5 * up) + vec3(0.1, 0.105, 0.12);
  // 창가: 낮엔 하늘빛이 벽·바닥을 데운다
  light += mix(uSkyHorizon, uSkyTop, 0.5) * uWarm * (1.0 - uNight) * 0.25;
  vec3 col = alb * light;
  float fres = pow(clamp(1.0 - dot(N, V), 0.0, 1.0), 3.0);
  col += uLight * fres * 0.08;
  col += (em + vColor * vEmit) * uLightScale; // 조명 밝기 설정
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/** 실내 재질 하나 (층마다 빛 색이 달라서 층마다 하나) */
export function interiorMaterial(o = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...atmosUniforms,
      uLight: { value: new THREE.Color(o.light ?? 0xfff2de).multiplyScalar(o.lux ?? 1) },
      uAccent: { value: new THREE.Color(o.accent ?? 0x7ff3e6) },
      uWarm: { value: o.warm ?? 0.6 },
    },
    vertexShader: vert, fragmentShader: frag,
    side: o.side ?? THREE.FrontSide,
  });
}

// 창 너머: 하늘 + 이 층 높이에서 내려다본 도시 (높은 층일수록 지평선 아래로 도시가 깔린다)
const winVert = /* glsl */ `${CURVE_GLSL}
varying vec2 vUv; varying vec3 vWorld; varying vec3 vN;
void main() { vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vWorld = wp.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * vec4(curveWorld(wp.xyz), 1.0); }`;
const winFrag = /* glsl */ `${NOISE_GLSL}${ATMOS_PARS}
uniform float uFloorH; // 땅에서 이 층까지 (m)
varying vec2 vUv; varying vec3 vWorld; varying vec3 vN;
void main() {
  vec3 V = normalize(vWorld - cameraPosition);
  // 보는 방향의 고도각: 위는 하늘, 아래는 도시
  float el = V.y;
  float horizon = -clamp(uFloorH / 900.0, 0.0, 0.35);
  vec3 sky = mix(uSkyHorizon, uSkyTop, clamp((el - horizon) * 2.2, 0.0, 1.0)) * 1.05 + uHorizonGlow * 0.2 * (1.0 - clamp(abs(el - horizon) * 4.0, 0.0, 1.0));
  float az = atan(V.z, V.x);
  // 먼 도시의 윤곽 (높은 층에선 아래로 내려다본다)
  float skyl = horizon + 0.04 + 0.11 * vnoise(vec2(az * 9.0, 1.0)) * (1.0 - clamp(uFloorH / 600.0, 0.0, 0.8));
  float city = step(el, skyl);
  vec3 cityC = mix(uSkyHorizon * 0.55, vec3(0.03, 0.04, 0.08), uNight);
  vec2 wid = floor(vec2(az * 260.0, el * 300.0));
  cityC += vec3(1.0, 0.82, 0.58) * step(0.86, hash12(wid)) * uNight * 1.3 * city;
  vec3 c = mix(sky, cityC, city);
  // 유리의 살짝 비침
  c = mix(c, vec3(0.85, 0.92, 1.0), 0.06);
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
export function windowMaterial(floorH = 0) {
  return new THREE.ShaderMaterial({ uniforms: { ...atmosUniforms, uFloorH: { value: floorH } }, vertexShader: winVert, fragmentShader: winFrag, side: THREE.DoubleSide });
}
