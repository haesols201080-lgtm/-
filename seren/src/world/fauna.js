// 생물 (작은·중간 크기): 세렌의 생태계와 아웬의 삶에 속한 다섯 종. 종마다 인스턴스 그리기 1회, 관절은 정점 셰이더가 움직인다.
//   톡톡이(hopper)   : 들판의 작은 세발 동물(돔 몸·눈자루의 눈 셋·감각 깃·용수철 다리). 무리 지어 풀을 뜯다 폴짝 뛰고, 빠르게 다가오면 달아나고,
//                      가만히 있으면 궁금해 다가온다. 마을에선 아이들과 노는 반려(pet).
//   노래새(bird)     : 막 날개의 작은 연(마름모 몸·눈구슬·빛 리본 꼬리). 무리로 날다 등·돛대·지붕에 앉아 지저귀고, 공명 음을 들으면 같은 음으로 따라 부른다.
//   등짐소(beast)    : 껍데기 판과 마디 다리 여섯의 순한 큰 짐승(얼굴판·덩굴 코). 들판·느린땅에서 무리로 풀을 뜯고, 마을에선 바구니를 지고 텃밭과 관문 사이를 오간다.
//   포자해파리(jelly): 공기 속을 떠다니는 해파리. 균사 숲엔 늘, 들판엔 해 질 녘부터. 마을 정원엔 줄에 매인 「살아 있는 등」.
//   유리게(crab)     : 유리 황야·바닷가의 별 모양 보석 걸음이(다리 여섯이 둘레로). 종종걸음으로 무리 지어 다니다 놀라면 모래에 숨는다.
// 자리: 야생 무리는 256 m 칸마다 해시로(지역 → 종·수), 마을·도시의 자리는 world.faunaSites(장소 빌더가 넣는다).
// 다가가 E: 쓰다듬기·살펴보기(도감), 공명 음에 반응. labSubject() 는 캐릭터 실험실(tools/lab.mjs)이 쓴다.
import * as THREE from 'three';
import { part, merge, xf, lathe, tube } from './geo-utils.js';
import { NOISE_GLSL, ATMOS_PARS, CURVE_GLSL } from './shaders.js';
import { atmosUniforms } from './atmosphere.js';
import { heightAt } from './heightfield.js';
import { mulberry32, hashStr } from '../core/noise.js';
import { audio, NOTE_COLORS } from '../core/audio.js';
import { bus } from '../core/events.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const W = 0xffffff; // 흰색 = 인스턴스 몸 색

// ── 셰이더 틀 ─────────────────────────────
const HEAD = /* glsl */ `
${CURVE_GLSL}
attribute float aPart;
attribute vec3 aPivot;
attribute vec3 color;
attribute float emit;
attribute vec4 iP;  // x, y, z, 방향
attribute vec4 iA;  // 걸음 위상, 움직임(0..1), 하는 일(+10 = 짐), 배율
attribute vec4 iB;  // 몸 앞기울기, 옆기울기, 빛(공명 반응), 씨앗
attribute vec3 iC;  // 몸 색
attribute vec3 iG;  // 빛 색
uniform float uTime;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vColor;
varying float vEmit;
varying vec3 vGlowC;
mat3 RX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
mat3 RY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
mat3 RZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }
bool is(float pt, float k) { return abs(pt - k) < 0.5; }
void rot(inout vec3 p, inout vec3 n, mat3 R, vec3 o) { p = R * (p - o) + o; n = R * n; }
void main() {
  vec3 p = position, n = normal;
  float pt = aPart;
  vec3 pv = aPivot;
  float ph = iA.x, sp = iA.y, act = iA.z;
  float load = step(9.5, act); act -= load * 10.0;
  float T = uTime + iB.w * 37.0;
  float lift = 0.0, glowK = 1.0 + iB.z * 2.5, hide = 0.0;
  float graze = clamp(1.0 - abs(act - 1.0), 0.0, 1.0);
  float alert = clamp(1.0 - abs(act - 2.0), 0.0, 1.0);
`;
const TAIL = /* glsl */ `
  if (hide > 0.5) { gl_Position = vec4(0.0, 0.0, -2.0, 1.0); return; }
  mat3 Bm = RZ(iB.y) * RX(iB.x);
  p = Bm * p; n = Bm * n;
  p.y += lift;
  p *= iA.w;
  vec3 wp = RY(iP.w) * p + iP.xyz;
  vWorld = wp;
  vNormal = RY(iP.w) * n;
  float tint = step(0.9, color.r) * step(0.9, color.g) * step(0.9, color.b);
  vColor = mix(color, iC, tint);
  vEmit = emit * glowK;
  vGlowC = mix(mix(color, iC, tint), iG, clamp(0.35 + iB.z, 0.0, 1.0));
  gl_Position = projectionMatrix * viewMatrix * vec4(curveWorld(wp), 1.0);
}`;
const FRAG = /* glsl */ `
${NOISE_GLSL}
${ATMOS_PARS}
uniform float uAlpha;
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
  float fr = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  col += mix(vGlowC, vec3(1.0), 0.5) * fr * (0.3 + 0.35 * uGlow);
  float litL = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col *= 1.0 / (1.0 + max(litL - 0.72, 0.0) * 1.15);
  col += vGlowC * vEmit * (0.55 + uGlow * 1.0);
  col = applyFog(col, vWorld);
  gl_FragColor = vec4(col, min(1.0, uAlpha + fr * (1.0 - uAlpha)));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// ── 모양 (앞 = +z, 원점 = 발밑 땅) ──────────────────
function tagged(list) {
  const out = merge(list.map((e) => e[0]));
  const n = out.attributes.position.count;
  const pa = new Float32Array(n), pv = new Float32Array(n * 3);
  let o = 0;
  for (const [g, id, piv] of list) {
    const c = g.attributes.position.count;
    pa.fill(id, o, o + c);
    for (let i = 0; i < c; i++) { pv[(o + i) * 3] = piv[0]; pv[(o + i) * 3 + 1] = piv[1]; pv[(o + i) * 3 + 2] = piv[2]; }
    o += c;
  }
  out.setAttribute('aPart', new THREE.BufferAttribute(pa, 1));
  out.setAttribute('aPivot', new THREE.BufferAttribute(pv, 3));
  return out;
}

// 톡톡이: 0 몸 1 눈자루(머리) 2·3 감각 깃 4·5 용수철 다리 6 앞 발판 7 나선 꼬리
//   지구의 토끼가 아니다: 낮은 물방울 돔 몸(허리에 빛 구멍이 고리로), 몸 앞에서 솟은 눈자루 끝에 세모로 놓인 눈 셋,
//   등에서 뒤로 휘는 감각 깃 둘(빛 끝), 뒤로 꺾인 칼날 다리 둘과 앞의 발판 하나로 선 세발 몸, 나선으로 말린 꼬리 끝의 빛 주머니
function hopperGeo() {
  const L = [];
  const add = (g, c, e, id, piv = [0, 0, 0]) => L.push([part(g, c, e), id, piv]);
  add(lathe([[0.0001, 0.16], [0.22, 0.18], [0.33, 0.3], [0.32, 0.44], [0.22, 0.58], [0.08, 0.64], [0.0001, 0.65]], 18), W, 0.05, 0);
  add(xf(new THREE.SphereGeometry(1, 12, 6), { y: 0.2, sx: 0.24, sy: 0.07, sz: 0.24 }), 0xe8e0f4, 0, 0); // 밑판
  for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU; add(new THREE.SphereGeometry(0.035, 6, 4).translate(Math.cos(a) * 0.325, 0.38, Math.sin(a) * 0.325), 0x9ff6ff, 1.8, 0); } // 허리의 빛 구멍
  for (let k = 0; k < 3; k++) { const a = (k / 3) * TAU + 0.5; add(xf(new THREE.ConeGeometry(0.035, 0.12, 5), { x: Math.cos(a) * 0.08, y: 0.68, z: Math.sin(a) * 0.08 - 0.06, rx: Math.sin(a) * 0.4, rz: -Math.cos(a) * 0.4 }), W, 0.3, 0); } // 정수리 돌기
  // 눈자루 (목 = 0, 0.55, 0.22): 끝에 세모로 놓인 눈 셋
  add(tube([[0, 0.52, 0.18], [0, 0.68, 0.24], [0, 0.8, 0.3]], 0.04, 6, 6, (t) => 1 - 0.3 * t), W, 0, 1);
  add(xf(new THREE.SphereGeometry(1, 12, 8), { y: 0.84, z: 0.32, sx: 0.11, sy: 0.09, sz: 0.09 }), W, 0.1, 1);
  for (const [ex, ey] of [[-0.055, 0.86], [0.055, 0.86], [0, 0.79]]) {
    add(new THREE.SphereGeometry(0.038, 8, 6).translate(ex, ey, 0.39), 0x1a1638, 0.3, 1);
    add(new THREE.SphereGeometry(0.014, 5, 4).translate(ex, ey + 0.005, 0.425), 0xbffcff, 2.2, 1);
  }
  // 감각 깃: 등에서 뒤로 휘는 깃대 + 빛 가시, 끝이 빛난다
  for (const [s, id] of [[-1, 2], [1, 3]]) {
    const at = { x: s * 0.12, y: 0.6, z: 0.02, rz: -s * 0.35, rx: 0.5 };
    add(xf(tube([[0, 0, 0], [0, 0.14, -0.04], [0, 0.3, -0.12]], 0.012, 4, 6), at), W, 0.2, id, [s * 0.12, 0.6, 0.02]);
    for (let k = 1; k < 6; k++) for (const q of [-1, 1]) add(xf(new THREE.BoxGeometry(0.06, 0.008, 0.01).translate(q * 0.035, 0.05 * k, -0.02 * k), at), 0xd8f0ff, 0.6 + k * 0.15, id, [s * 0.12, 0.6, 0.02]);
    add(xf(new THREE.SphereGeometry(0.03, 6, 5).translate(0, 0.31, -0.13), at), 0xffd27a, 2.2, id, [s * 0.12, 0.6, 0.02]);
  }
  // 용수철 다리: 엉덩이 → 뒤로 높이 꺾인 무릎 → 발판 (발바닥 빛)
  for (const [s, id] of [[-1, 4], [1, 5]]) {
    const hip = [s * 0.27, 0.36, -0.1];
    add(tube([hip, [s * 0.36, 0.62, -0.34], [s * 0.33, 0.3, -0.24], [s * 0.3, 0.04, -0.08]], 0.035, 5, 10, (t) => 1 - 0.4 * t), W, 0, id, hip);
    add(new THREE.SphereGeometry(0.045, 6, 5).translate(s * 0.36, 0.62, -0.34), 0xd8f0ff, 0.6, id, hip);
    add(xf(new THREE.CylinderGeometry(0.09, 0.1, 0.03, 10), { x: s * 0.3, y: 0.02, z: -0.06 }), 0xe8e0f4, 0, id, hip);
    add(xf(new THREE.CircleGeometry(0.06, 8).rotateX(Math.PI / 2), { x: s * 0.3, y: 0.004, z: -0.06 }), 0x9ff6ff, 1.2, id, hip);
  }
  // 앞 발판 하나 (세발로 선다)
  add(tube([[0, 0.24, 0.18], [0, 0.12, 0.26], [0, 0.03, 0.28]], 0.035, 5, 5), W, 0, 6, [0, 0.3, 0.2]);
  add(xf(new THREE.CylinderGeometry(0.08, 0.09, 0.03, 10), { y: 0.015, z: 0.29 }), 0xe8e0f4, 0, 6, [0, 0.3, 0.2]);
  // 나선 꼬리 + 빛 주머니
  const hp = [];
  for (let k = 0; k <= 14; k++) { const t = k / 14, a = t * TAU * 1.4; hp.push([Math.sin(a) * 0.07 * (1 - t * 0.4), 0.38 + t * 0.32 + Math.cos(a) * 0.07 * (1 - t * 0.4), -0.32 - t * 0.28]); }
  add(tube(hp, 0.022, 5, 28, (t) => 1 - 0.5 * t), W, 0.1, 7, [0, 0.42, -0.38]);
  add(new THREE.SphereGeometry(0.06, 8, 6).translate(hp[14][0], hp[14][1] + 0.03, hp[14][2]), 0xffd27a, 2.0, 7, [0, 0.42, -0.38]);
  return tagged(L);
}
const hopperAnim = /* glsl */ `
  float air = sp * sin(3.14159 * ph);
  lift = 0.42 * air;
  // 뒷다리: 밀어 내고(앞 절반) 공중에서 모았다 착지 때 받는다
  if (pt > 3.5 && pt < 5.5) { float kick = sp * (ph < 0.5 ? sin(6.2832 * ph) : -0.35 * sin(6.2832 * (ph - 0.5))); rot(p, n, RX(-0.95 * kick), pv); }
  if (is(pt, 6.0)) rot(p, n, RX(0.7 * air - 0.3 * graze), pv);
  // 귀: 날 땐 뒤로 눕고, 경계하면 곧추서고, 풀 뜯을 땐 느슨히, 가끔 쫑긋
  if (pt > 1.5 && pt < 3.5) {
    float s = pt < 2.5 ? -1.0 : 1.0;
    float back = -1.0 * air - 0.45 * graze * (1.0 - sp) + 0.25 * alert + sin(T * 2.3 + s) * 0.06 + step(0.985, sin(T * 0.9 + s * 2.0)) * 0.3;
    rot(p, n, RZ(-s * (0.12 + 0.2 * graze - 0.12 * alert)) * RX(-back), pv);
  }
  // 머리 (귀 포함): 풀 뜯기·두리번·경계
  if (pt > 0.5 && pt < 3.5) {
    float nod = graze * (1.0 - sp) * (0.6 + sin(T * 11.0) * 0.07) - alert * 0.2 - air * 0.15;
    float turn = (sin(T * 0.7) * 0.4 + sin(T * 2.9) * 0.1) * (1.0 - sp) * (1.0 - graze);
    rot(p, n, RY(turn) * RX(nod), vec3(0.0, 0.55, 0.22));
  }
  if (is(pt, 7.0)) rot(p, n, RY(sin(T * 9.0) * 0.25 * (1.0 - sp)) * RX(-0.4 * air), pv);
  // 몸: 뛸 때 앞이 들렸다 숙고, 경계하면 일어선다
  rot(p, n, RX(-0.35 * sp * cos(6.2832 * ph) * step(0.01, sp) - 0.35 * alert * (1.0 - sp) + 0.12 * graze * (1.0 - sp)), vec3(0.0, 0.2, -0.2));
`;

// 노래새: 0 몸 1·2 날개 3 꼬리띠 4 눈구슬(머리)
//   깃털 새가 아니다: 납작한 마름모 몸, 빛 맥이 흐르는 얇은 막 날개(끝이 물결진 연), 부리 대신 빛 테를 두른 커다란 눈구슬 하나와
//   앞으로 뻗은 수염 더듬이, 몸 밑의 갈고리 발(앉을 때 붙잡는다), 길게 나부끼는 빛 리본 꼬리 둘
function birdGeo() {
  const L = [];
  const add = (g, c, e, id, piv = [0, 0, 0]) => L.push([part(g, c, e), id, piv]);
  add(xf(new THREE.OctahedronGeometry(1, 1), { y: 0.13, sx: 0.085, sy: 0.04, sz: 0.18 }), W, 0.05, 0);
  add(xf(new THREE.BoxGeometry(0.012, 0.012, 0.3), { y: 0.17, z: -0.01 }), 0x9ff6ff, 1.6, 0); // 등줄 빛
  for (const s of [-1, 1]) add(tube([[s * 0.025, 0.1, 0.02], [s * 0.03, 0.05, 0.03], [s * 0.02, 0.03, 0.06]], 0.006, 3, 4), 0x2a2440, 0, 0); // 갈고리 발
  // 눈구슬 + 빛 테 + 수염 더듬이
  add(xf(new THREE.SphereGeometry(0.055, 12, 10), { y: 0.16, z: 0.15 }), 0x1c1a34, 0.2, 4);
  add(xf(new THREE.SphereGeometry(0.022, 6, 5), { y: 0.165, z: 0.2 }), 0xbffcff, 2.4, 4);
  add(xf(new THREE.TorusGeometry(0.062, 0.008, 4, 18), { y: 0.16, z: 0.15 }), 0xffd27a, 1.8, 4);
  for (const s of [-1, 1]) add(tube([[s * 0.03, 0.17, 0.17], [s * 0.07, 0.19, 0.25], [s * 0.1, 0.18, 0.32]], 0.004, 3, 5), 0xd8f0ff, 0.8, 4);
  // 막 날개: 뿌리는 넓고 끝은 물결진 연 (빛 맥 셋)
  for (const [s, id] of [[-1, 1], [1, 2]]) {
    const sh = new THREE.Shape();
    sh.moveTo(0, 0.07); sh.quadraticCurveTo(0.22, 0.09, 0.48, -0.02);
    sh.quadraticCurveTo(0.42, -0.05, 0.4, -0.1); sh.quadraticCurveTo(0.3, -0.08, 0.26, -0.14);
    sh.quadraticCurveTo(0.16, -0.1, 0.1, -0.15); sh.quadraticCurveTo(0.04, -0.1, 0, -0.1); sh.lineTo(0, 0.07);
    const g = new THREE.ShapeGeometry(sh, 6).rotateX(-Math.PI / 2);
    if (s < 0) g.scale(-1, 1, 1);
    add(xf(g, { x: s * 0.05, y: 0.15, z: 0.02 }), W, 0.12, id, [s * 0.05, 0.16, 0.02]);
    for (const [ex, ez] of [[0.46, -0.02], [0.4, -0.1], [0.26, -0.14]]) add(tube([[s * 0.05, 0.152, 0.03], [s * (0.05 + ex * 0.5), 0.153, 0.03 + ez * 0.4], [s * (0.05 + ex), 0.154, 0.02 + ez]], 0.004, 3, 5), 0x9ff6ff, 1.5, id, [s * 0.05, 0.16, 0.02]);
  }
  // 빛 리본 꼬리 둘 (길다)
  for (const s of [-1, 1]) {
    const g = new THREE.PlaneGeometry(0.03, 0.62, 1, 8).rotateX(-Math.PI / 2 + 0.12);
    g.translate(s * 0.025, 0.12, -0.45);
    add(g, 0xffd27a, 1.0, 3, [0, 0.13, -0.13]);
  }
  return tagged(L);
}
const birdAnim = /* glsl */ `
  float fly = clamp(act - 2.0, 0.0, 1.0);
  if (pt > 0.5 && pt < 2.5) {
    float s = pt < 1.5 ? -1.0 : 1.0;
    float flap = fly * (0.15 + 0.9 * sp * sin(ph * 6.2832));
    rot(p, n, RZ(s * flap) * RY(s * (1.0 - fly) * 1.3) * RZ(-s * (1.0 - fly) * 0.25), pv);
  }
  if (is(pt, 3.0)) rot(p, n, RX(-0.2 * fly + sin(T * 3.1) * 0.12 * (1.0 - fly)) * RY(sin(T * 1.7) * 0.18), pv);
  if (is(pt, 4.0)) {
    float peck = graze * max(0.0, sin(T * 6.0)) * 0.9;
    float look = (1.0 - fly) * sin(T * 1.3) * 0.7 * step(0.0, sin(T * 0.45));
    float sing = alert * sin(T * 14.0) * 0.12;
    rot(p, n, RY(look) * RX(peck - alert * 0.35 + sing), vec3(0.0, 0.17, 0.08));
  }
  lift = fly * sin(ph * 6.2832) * 0.025;
  glowK += alert * 0.8;
`;

// 등짐소: 0 몸 1 머리 2..7 다리(앞왼·앞오·가왼·가오·뒤왼·뒤오) 8 코 9 짐 10 꼬리
//   소가 아니다: 겹친 껍데기 판 셋(이음매가 빛난다)과 등에 돋은 결정, 마디진 곤충 다리 여섯(세 갈래 발), 눈 대신 빛 구멍 넷이 줄지은
//   낮은 얼굴판과 앞으로 뻗은 더듬이 둘, 끝에 빛 봉오리가 달린 긴 덩굴 코, 짐을 지면 양옆에 빛 열매 꼬투리
function beastGeo() {
  const L = [];
  const add = (g, c, e, id, piv = [0, 0, 0]) => L.push([part(g, c, e), id, piv]);
  add(xf(new THREE.SphereGeometry(1, 16, 10), { y: 1.78, sx: 0.85, sy: 0.55, sz: 1.75 }), 0xd8d0dc, 0, 0); // 배
  for (const [z, sz, sy] of [[1.05, 0.85, 0.72], [0, 1.0, 0.82], [-1.05, 0.9, 0.72]]) {
    add(xf(new THREE.SphereGeometry(1, 16, 8, 0, TAU, 0, Math.PI * 0.5), { y: 1.9, z, sx: 1.0, sy, sz }), W, 0, 0); // 껍데기 판
    add(xf(new THREE.TorusGeometry(1, 0.035, 4, 32), { y: 1.9, z: z - sz * 0.92, sx: 0.98, sy: sy * 0.95, rx: 0 }), 0x9ff6ff, 1.4, 0); // 판 이음매의 빛 (세운 고리)
  }
  const rnd = mulberry32(5);
  for (let i = 0; i < 9; i++) { const z = -1.3 + rnd() * 2.6, x = (rnd() - 0.5) * 0.7; add(xf(new THREE.ConeGeometry(0.1 + rnd() * 0.08, 0.35 + rnd() * 0.4, 5), { x, y: 2.62 - x * x * 0.4, z, rz: -x * 0.6, rx: (rnd() - 0.5) * 0.4 }), [0xbffcff, 0xd8b4ff, 0xffd0a0][i % 3], 1.2, 0); } // 등의 결정
  // 얼굴판 (목 = 0, 2.0, 1.55): 낮고 넓은 판 + 빛 구멍 넷 + 더듬이 둘
  add(xf(new THREE.SphereGeometry(1, 14, 8), { y: 1.82, z: 2.05, sx: 0.5, sy: 0.3, sz: 0.5 }), W, 0, 1);
  for (let k = 0; k < 4; k++) add(new THREE.SphereGeometry(0.06, 6, 5).translate((k - 1.5) * 0.17, 1.92, 2.5 - Math.abs(k - 1.5) * 0.06), 0xbffcff, 2.0, 1);
  for (const s of [-1, 1]) add(tube([[s * 0.3, 1.95, 2.3], [s * 0.55, 2.3, 2.7], [s * 0.7, 2.25, 3.2], [s * 0.62, 2.05, 3.45]], 0.035, 4, 10, (t) => 1 - 0.6 * t), 0xd8d0dc, 0.3, 1);
  // 다리 여섯: 엉덩이 → 바깥으로 벌어진 무릎(마디 구슬) → 세 갈래 발
  const LEG = [[-1, 1.15, 2], [1, 1.15, 3], [-1, 0, 4], [1, 0, 5], [-1, -1.15, 6], [1, -1.15, 7]];
  for (const [s, z, id] of LEG) {
    const hip = [s * 0.72, 1.7, z];
    add(tube([[s * 0.72, 1.72, z], [s * 1.25, 1.05, z + 0.05], [s * 1.32, 0.95, z + 0.06], [s * 1.38, 0.1, z + 0.1]], 0.1, 6, 12, (t) => 1 - 0.35 * t), W, 0, id, hip);
    add(new THREE.SphereGeometry(0.15, 8, 6).translate(s * 1.27, 1.0, z + 0.05), 0x9a90a8, 0.2, id, hip);
    for (let k = 0; k < 3; k++) { const a = (k - 1) * 0.7; add(xf(new THREE.ConeGeometry(0.05, 0.3, 4).rotateX(Math.PI / 2), { x: s * 1.38 + Math.sin(a) * 0.12, y: 0.05, z: z + 0.2 + Math.cos(a) * 0.08, ry: a }), 0x5a4a60, 0, id, hip); }
  }
  // 덩굴 코: 끝의 빛 봉오리
  add(tube([[0, 1.75, 2.5], [0, 1.5, 2.85], [0, 1.2, 2.95], [0, 1.02, 2.85]], 0.07, 6, 10, (t) => 1 - 0.45 * t), W, 0, 8, [0, 1.8, 2.7]);
  add(new THREE.SphereGeometry(0.09, 8, 6).translate(0, 0.98, 2.82), 0xffd27a, 1.8, 8, [0, 1.8, 2.7]);
  // 짐: 양옆 빛 열매 꼬투리
  for (const s of [-1, 1]) {
    add(xf(new THREE.CapsuleGeometry(0.3, 0.5, 4, 10).rotateX(Math.PI / 2), { x: s * 1.1, y: 2.05 }), 0xc8b090, 0.1, 9);
    for (let k = 0; k < 4; k++) add(new THREE.IcosahedronGeometry(0.1, 0).translate(s * 1.1 + (k % 2 - 0.5) * 0.2, 2.38, (k > 1 ? 0.18 : -0.18)), [0xffc46a, 0xff9fd0, 0x9ff6ff][k % 3], 1.4, 9);
  }
  add(xf(new THREE.BoxGeometry(2.3, 0.08, 0.4), { y: 2.62 }), 0xc8b090, 0, 9);
  // 꼬리: 마디진 키 + 빛 주머니
  add(tube([[0, 2.0, -1.7], [0, 1.75, -2.15], [0, 1.45, -2.35]], 0.12, 6, 8, (t) => 1 - 0.5 * t), W, 0, 10, [0, 2.1, -1.75]);
  add(xf(new THREE.SphereGeometry(0.16, 8, 6), { y: 1.4, z: -2.38, sy: 1.3 }), 0x9ff6ff, 1.2, 10, [0, 2.1, -1.75]);
  return tagged(L);
}
const beastAnim = /* glsl */ `
  float gait = 6.2832 * ph;
  if (pt > 1.5 && pt < 7.5) {
    float grp = (is(pt, 2.0) || is(pt, 5.0) || is(pt, 6.0)) ? 0.0 : 3.14159;
    float c = gait + grp;
    float swing = sp * 0.34 * sin(c);
    float knee = sp * 0.75 * max(0.0, cos(c));
    vec3 q = p - pv;
    vec3 KN = vec3(0.0, -0.75, 0.05);
    if (q.y < KN.y) { mat3 K = RX(knee); q = K * (q - KN) + KN; n = K * n; }
    mat3 S = RX(-swing);
    p = S * q + pv; n = S * n;
  }
  if (is(pt, 9.0) && load < 0.5) hide = 1.0;
  // 코: 늘 조금 말렸다 펴진다 · 풀 뜯을 땐 땅으로
  if (is(pt, 8.0)) rot(p, n, RX(-0.25 + sin(T * 1.4) * 0.25 + graze * 0.4), pv);
  if (pt > 0.5 && pt < 1.5 || is(pt, 8.0)) {
    float nod = graze * (1.0 - sp) * (0.55 + sin(T * 3.0) * 0.05) - alert * 0.2 + sin(gait * 2.0) * 0.04 * sp;
    float turn = sin(T * 0.5) * 0.3 * (1.0 - sp) * (1.0 - graze);
    rot(p, n, RY(turn) * RX(nod), vec3(0.0, 2.0, 1.55));
  }
  if (is(pt, 10.0)) rot(p, n, RY(sin(T * 1.8) * 0.35) * RX(sin(T * 1.1) * 0.1), pv);
  lift = sp * 0.07 * abs(sin(gait * 2.0)) - 0.02;
  // 몸이 걸음에 맞춰 조금 흔들린다
  rot(p, n, RZ(sin(gait) * 0.025 * sp), vec3(0.0, 1.7, 0.0));
`;

// 포자해파리: 0 갓 1 촉수 2 속빛 (원점 = 갓 가운데)
function jellyGeo() {
  const L = [];
  const add = (g, c, e, id) => L.push([part(g, c, e), id, [0, 0, 0]]);
  add(lathe([[0.0001, 0.62], [0.35, 0.58], [0.62, 0.4], [0.8, 0.1], [0.82, -0.05], [0.7, -0.08], [0.4, 0.05], [0.0001, 0.1]], 22), W, 0.45, 0);
  for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; add(xf(new THREE.SphereGeometry(0.05, 5, 4), { x: Math.sin(a) * 0.78, y: -0.04, z: Math.cos(a) * 0.78 }), 0xffffff, 2.0, 0); }
  add(new THREE.SphereGeometry(0.22, 10, 8).translate(0, 0.2, 0), 0xffffff, 1.8, 2);
  add(lathe([[0.0001, 0.42], [0.2, 0.4], [0.32, 0.24], [0.3, 0.12]], 14), 0xffffff, 0.9, 2); // 속 갓
  { const fr = new THREE.TorusGeometry(0.8, 0.05, 4, 40); const pp = fr.attributes.position; for (let i = 0; i < pp.count; i++) { const a = Math.atan2(pp.getY(i), pp.getX(i)); pp.setZ(i, pp.getZ(i) + Math.sin(a * 12) * 0.05); } fr.computeVertexNormals(); add(xf(fr, { y: -0.06, rx: Math.PI / 2 }), W, 0.8, 0); } // 물결 치마
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU + 0.2, r = i % 3 === 0 ? 0.25 : 0.68, len = i % 3 === 0 ? 1.6 : 2.4 + (i % 2) * 0.6;
    const g = new THREE.PlaneGeometry(i % 3 === 0 ? 0.12 : 0.04, len, 1, 10);
    g.translate(0, -len / 2 - 0.05, 0); g.rotateY(a);
    g.translate(Math.sin(a) * r, 0, Math.cos(a) * r);
    add(g, W, 0.6, 1);
  }
  return tagged(L);
}
const jellyAnim = /* glsl */ `
  float pulse = pow(max(0.0, sin(ph * 6.2832)), 2.0);
  if (!is(pt, 1.0)) { p.xz *= 1.0 - 0.15 * pulse; p.y *= 1.0 + 0.1 * pulse; }
  else {
    float d = max(0.0, -p.y);
    p.x += sin(T * 1.6 - d * 2.2 + position.z * 3.0) * 0.1 * d;
    p.z += cos(T * 1.3 - d * 1.9 + position.x * 3.0) * 0.1 * d;
    p.xz *= 1.0 - 0.12 * pulse * (1.0 - min(1.0, d * 0.4));
    p.y += pulse * 0.08 * d;
  }
  glowK += pulse * 0.7;
`;

// 유리게: 0 몸 1..6 다리 7·8 더듬 수정 9 눈구슬
//   게가 아니다: 둥근 보석 돔 몸(속빛이 비친다)과 정수리의 수정 왕관, 둘레로 고르게 뻗은 유리 다리 여섯(별 모양),
//   집게 대신 앞으로 뻗은 가는 수정 더듬이 둘(끝이 빛난다), 위에 셋으로 놓인 눈구슬
function crabGeo() {
  const L = [];
  const add = (g, c, e, id, piv = [0, 0, 0]) => L.push([part(g, c, e), id, piv]);
  add(xf(new THREE.IcosahedronGeometry(1, 0), { y: 0.2, sx: 0.24, sy: 0.17, sz: 0.24 }), W, 0.45, 0); // 각진 보석 돔
  add(xf(new THREE.OctahedronGeometry(1, 0), { y: 0.28, sx: 0.1, sy: 0.07, sz: 0.1 }), 0xffe0f4, 1.6, 0);
  for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU; add(xf(new THREE.ConeGeometry(0.03, 0.16, 5), { x: Math.cos(a) * 0.09, y: 0.38, z: Math.sin(a) * 0.09, rz: -Math.cos(a) * 0.5, rx: Math.sin(a) * 0.5 }), W, 1.1, 0); } // 수정 왕관
  for (const [ex, ez] of [[-0.06, 0.12], [0.06, 0.12], [0, 0.02]]) add(xf(new THREE.SphereGeometry(0.03, 8, 6), { x: ex, y: 0.33, z: ez }), 0x101028, 0.8, 9);
  let id = 1;
  for (let k = 0; k < 6; k++) {
    const a = ((k + 0.5) / 6) * TAU, ca = Math.sin(a), sa = Math.cos(a); // a=0 → 앞(+z)
    const hip = [ca * 0.18, 0.17, sa * 0.18];
    // 다리: 거미 다리가 아니라 굵은 수정 조각 둘 (마디가 빛난다)
    const knee = [ca * 0.31, 0.22, sa * 0.31], foot = [ca * 0.38, 0.0, sa * 0.38];
    const shard = (a2, b2, w) => { const dx = b2[0] - a2[0], dy = b2[1] - a2[1], dz = b2[2] - a2[2], len = Math.hypot(dx, dy, dz); const g = new THREE.OctahedronGeometry(1, 0).scale(w, len / 2, w); const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx, dy, dz).normalize()); g.applyQuaternion(q); g.translate((a2[0] + b2[0]) / 2, (a2[1] + b2[1]) / 2, (a2[2] + b2[2]) / 2); return g; };
    add(shard(hip, knee, 0.05), 0xe8e0ff, 0.45, id, hip);
    add(shard(knee, foot, 0.04), 0xe8e0ff, 0.6, id, hip);
    add(new THREE.SphereGeometry(0.03, 6, 4).translate(...knee), 0xffe0f4, 1.8, id++, hip);
  }
  // 몸 위에 떠 있는 수정 고리 (몸빛을 따라 빛난다)
  add(xf(new THREE.TorusGeometry(0.2, 0.012, 4, 24), { y: 0.48, rx: Math.PI / 2 + 0.2 }), 0xffe0f4, 1.6, 0);
  for (const [s, cid] of [[-1, 7], [1, 8]]) {
    add(tube([[s * 0.06, 0.24, 0.2], [s * 0.1, 0.32, 0.36], [s * 0.12, 0.36, 0.5]], 0.012, 4, 6), 0xe8e0ff, 0.6, cid, [s * 0.06, 0.24, 0.2]);
    add(xf(new THREE.OctahedronGeometry(1, 0), { x: s * 0.12, y: 0.37, z: 0.52, sx: 0.025, sy: 0.025, sz: 0.05 }), W, 1.8, cid, [s * 0.06, 0.24, 0.2]);
  }
  return tagged(L);
}
const crabAnim = /* glsl */ `
  if (pt > 0.5 && pt < 6.5) {
    float side = pt < 3.5 ? -1.0 : 1.0;
    float c = 6.2832 * ph + pt * 2.1;
    rot(p, n, RZ(side * sp * 0.4 * max(0.0, sin(c))) * RY(sp * 0.3 * cos(c)), pv);
  }
  if (pt > 6.5 && pt < 8.5) {
    float s = pt < 7.5 ? -1.0 : 1.0;
    rot(p, n, RX(-0.9 * alert + sin(T * 7.0 + s) * 0.12 * (1.0 - sp)) * RY(s * 0.2 * alert), pv);
  }
  if (is(pt, 9.0)) rot(p, n, RY(sin(T * 1.7) * 0.5), vec3(0.0, 0.22, 0.16));
  lift = -0.25 * graze;  // 숨기: 모래로 가라앉는다
`;

const SPECIES = {
  hopper: { geo: hopperGeo, anim: hopperAnim, max: 64, codex: 'hopper', name: '톡톡이', verb: '쓰다듬기', tint: [0xd8e8ff, 0xe8dcff, 0xffe0ec, 0xd8f4e4], glow: 0x9ff6ff, scale: [1.15, 1.5] },
  bird: { geo: birdGeo, anim: birdAnim, max: 96, codex: 'songbird', name: '노래새', tint: [0x7fd8e8, 0xb9a6ff, 0xffc4a8, 0x9fe8b8], glow: 0xffd27a, scale: [0.9, 1.15] },
  beast: { geo: beastGeo, anim: beastAnim, max: 24, codex: 'beast', name: '등짐소', verb: '쓰다듬기', tint: [0xd8c8b8, 0xc8c0d8, 0xe0d0c0], glow: 0x9ff6ff, scale: [0.85, 1.1] },
  jelly: { geo: jellyGeo, anim: jellyAnim, max: 48, codex: 'jelly', name: '포자해파리', verb: '만져 보기', tint: [0xbfe8ff, 0xffc8f0, 0xd8c8ff], glow: 0xbffcff, scale: [0.7, 1.3], alpha: 0.82 },
  crab: { geo: crabGeo, anim: crabAnim, max: 48, codex: 'crab', name: '유리게', verb: '살펴보기', tint: [0xf4c8e2, 0xc8e8ff, 0xe8d8ff], glow: 0xffe0f4, scale: [0.9, 1.3] },
};

const SLOTS = [['iP', 4], ['iA', 4], ['iB', 4], ['iC', 3], ['iG', 3]];
class Herd {
  constructor(scene, key, max) {
    const S = SPECIES[key];
    this.key = key; this.S = S; this.max = max ?? S.max;
    const base = S.geo();
    const g = new THREE.InstancedBufferGeometry();
    for (const k of ['position', 'normal', 'color', 'emit', 'aPart', 'aPivot']) g.setAttribute(k, base.attributes[k]);
    this.at = {};
    for (const [k, w] of SLOTS) { const a = new THREE.InstancedBufferAttribute(new Float32Array(this.max * w), w); a.setUsage(THREE.DynamicDrawUsage); g.setAttribute(k, a); this.at[k] = a; }
    g.instanceCount = 0;
    const alpha = S.alpha ?? 1;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { ...atmosUniforms, uAlpha: { value: alpha } }, vertexShader: HEAD + S.anim + TAIL, fragmentShader: FRAG,
      side: THREE.DoubleSide, transparent: alpha < 1, depthWrite: alpha >= 1,
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.userData.indoor = false;
    scene.add(this.mesh);
    this.g = g; this.n = 0;
    this._c = new THREE.Color(); this._g = new THREE.Color();
  }
  begin() { this.n = 0; }
  push(a) {
    if (this.n >= this.max) return;
    const i = this.n++, A = this.at;
    A.iP.array.set([a.x, a.y, a.z, a.yaw], i * 4);
    A.iA.array.set([a.ph % 1, a.sp, a.act + (a.load ? 10 : 0), a.s], i * 4);
    A.iB.array.set([a.pitch || 0, a.roll || 0, a.glowK || 0, a.seed], i * 4);
    A.iC.array.set([a.tint.r, a.tint.g, a.tint.b], i * 3);
    A.iG.array.set([a.glow.r, a.glow.g, a.glow.b], i * 3);
  }
  end() {
    this.g.instanceCount = this.n;
    for (const [k, w] of SLOTS) { const a = this.at[k]; a.clearUpdateRanges(); a.addUpdateRange(0, this.n * w); a.needsUpdate = true; }
  }
}

// 야생 자리: 지역(regions.js 순서) → [종, 확률, 최소, 최대, 조건]
const HAB = {
  0: [['bird', 0.22, 5, 9], ['hopper', 0.12, 3, 6]],
  1: [['hopper', 0.38, 4, 8], ['bird', 0.3, 6, 11], ['beast', 0.22, 3, 5], ['jelly', 0.1, 3, 6, 'dusk']],
  2: [['crab', 0.42, 4, 8], ['bird', 0.1, 4, 6]],
  3: [['jelly', 0.5, 4, 8], ['hopper', 0.14, 3, 5], ['bird', 0.16, 5, 8]],
  4: [['bird', 0.3, 6, 10], ['crab', 0.1, 3, 5]],
  5: [['bird', 0.08, 4, 6]],
  6: [['crab', 0.3, 3, 6, 'shore']],
  7: [['jelly', 0.2, 3, 5]],
  8: [['beast', 0.32, 3, 6], ['hopper', 0.26, 4, 7], ['bird', 0.3, 6, 9]],
  10: [['beast', 0.18, 3, 5], ['bird', 0.3, 6, 9], ['hopper', 0.15, 3, 5]],
};
const CELL = 190, NEAR = 400, FAR = 540;
const _w = new Float32Array(16);

export class Fauna {
  constructor(world, game) {
    this.world = world;
    this.game = game;
    this.herds = {};
    for (const k of Object.keys(SPECIES)) this.herds[k] = new Herd(world.scene, k);
    this.sites = new Map(); // 열쇠 → 자리
    this.agents = [];
    this.scanT = 0;
    this.t = 0;
    this.near = null;
    bus.on('tone', (e) => this._onTone(e));
  }

  // ── 자리 ─────────────────────────────
  _wildSite(i, j) {
    const key = `w${i},${j}`;
    if (this.sites.has(key)) return this.sites.get(key);
    const r = mulberry32(hashStr(key) ^ 0x5eed);
    const x = (i + 0.2 + r() * 0.6) * CELL, z = (j + 0.2 + r() * 0.6) * CELL;
    let site = null;
    const h = heightAt(x, z, 1, _w);
    let reg = 0, best = -1;
    for (let k = 0; k < _w.length; k++) if (_w[k] > best) { best = _w[k]; reg = k; }
    const list = HAB[reg] || [];
    const pick = r();
    let acc = 0;
    for (const [sp, p, n0, n1, cond] of list) {
      acc += p;
      if (pick >= acc) continue;
      const shore = h > 0.3 && h < 5;
      if (cond === 'shore' ? !shore : h < 1.6) break;
      const city = this.game.city;
      if (sp !== 'bird' && sp !== 'jelly' && city && city.noFlora(x, z)) break;
      if (this.world.cleared && this.world.cleared(x, z)) break;
      site = { key, sp, x, z, r: sp === 'beast' ? 60 : sp === 'bird' ? 45 : 24, n: n0 + Math.floor(r() * (n1 - n0 + 1)), mode: 'wild', cond, seed: r(), live: false };
      break;
    }
    this.sites.set(key, site);
    return site;
  }

  _scan() {
    const p = this.game.player.pos;
    const want = new Set();
    const ci = Math.floor(p.x / CELL), cj = Math.floor(p.z / CELL), R = Math.ceil(NEAR / CELL);
    for (let i = ci - R; i <= ci + R; i++) for (let j = cj - R; j <= cj + R; j++) {
      const s = this._wildSite(i, j);
      if (s && Math.hypot(s.x - p.x, s.z - p.z) < NEAR) want.add(s);
    }
    for (const s of this.world.faunaSites || []) if (Math.hypot(s.x - p.x, s.z - p.z) < NEAR + (s.r || 0)) want.add(s);
    // 도시의 반려: 노는 아이·산책하는 이 둘레의 톡톡이
    const city = this.game.city;
    if (city && city.spotsNear) {
      for (const sp of city.spotsNear(p.x, p.z, 160)) {
        if (sp.type !== 'play' && sp.type !== 'stroll' && sp.type !== 'tend') continue;
        const k = 'pet' + sp.id;
        let s = this.sites.get(k);
        if (s === undefined) {
          const r = mulberry32(hashStr(k));
          s = r() < (sp.type === 'play' ? 0.6 : 0.3) ? { key: k, sp: 'hopper', x: sp.x, z: sp.z, r: 7, n: 1 + Math.floor(r() * 2), mode: 'pet', seed: r(), live: false } : null;
          this.sites.set(k, s);
        }
        if (s) want.add(s);
      }
    }
    // 나가고 들어오기
    const keep = [];
    for (const a of this.agents) {
      if (want.has(a.site) || Math.hypot(a.x - p.x, a.z - p.z) < FAR * 0.5) keep.push(a);
      else a.site.live = false;
    }
    this.agents = keep;
    const alive = new Set(keep.map((a) => a.site));
    for (const s of alive) s.live = true;
    for (const s of want) {
      if (s.live) continue;
      const cnt = this.agents.filter((a) => a.sp === s.sp).length;
      if (cnt + s.n > SPECIES[s.sp].max) continue;
      this._spawn(s);
      s.live = true;
    }
    if (this.sites.size > 4000) for (const [k, s] of this.sites) if (!s || !s.live) this.sites.delete(k);
  }

  _spawn(s) {
    const r = mulberry32(hashStr(s.key + 'a'));
    const S = SPECIES[s.sp];
    const flock = s.sp === 'bird' ? { x: s.x, z: s.z, y: 0, mode: 'ground', t: 4 + r() * 6, perch: null } : null;
    for (let i = 0; i < s.n; i++) {
      const a = r() * TAU, d = r() * s.r * 0.6;
      const route = s.route;
      const x = route ? route[0][0] + (r() - 0.5) * 3 : s.x + Math.cos(a) * d, z = route ? route[0][1] + (r() - 0.5) * 3 : s.z + Math.sin(a) * d;
      const tc = S.tint[Math.floor(r() * S.tint.length)];
      this.agents.push({
        sp: s.sp, site: s, flock, i, x, z, y: this._ground(x, z, 99), yaw: r() * TAU, vx: 0, vz: 0,
        ph: r(), sp_: 0, act: 0, s: S.scale[0] + r() * (S.scale[1] - S.scale[0]) * (s.mode === 'pet' ? 0.8 : 1),
        tint: new THREE.Color(tc), glow: new THREE.Color(S.glow), glowK: 0, seed: r(),
        state: 'idle', t: r() * 3, tx: x, tz: z, alt: 3 + r() * 6, ri: Math.floor(r() * 100), off: [(r() - 0.5) * 6, (r() - 0.5) * 6], still: 0, follow: 0,
        load: s.mode === 'work',
      });
    }
  }

  _ground(x, z, y) {
    if (!this.world.colliders) return heightAt(x, z);
    return this.world.colliders.ground(x, z, (y ?? heightAt(x, z)) + 0.6, 0.6).h;
  }

  // ── 매 프레임 ─────────────────────────────
  update(dt) {
    const g = this.game;
    if (!g || g.mode === 'title') return;
    dt = Math.min(dt, 0.1);
    this.t += dt;
    this.scanT -= dt;
    if (this.scanT <= 0) { this.scanT = 1.0; this._scan(); }
    const pl = g.player, pp = pl.pos;
    const pspeed = pl.hspeed || 0;
    const night = g.world.atmos.state.night;
    for (const H of Object.values(this.herds)) H.begin();
    let near = null, nd = 1e9;
    for (const a of this.agents) {
      const dx = pp.x - a.x, dz = pp.z - a.z, d = Math.hypot(dx, dz);
      if (Math.abs(pp.y - a.y) > 40 && a.sp !== 'bird') { this._draw(a); continue; }
      this['_' + a.sp](a, dt, d, dx, dz, pspeed, night);
      a.glowK = Math.max(0, a.glowK - dt * 0.35);
      this._draw(a);
      // 도감: 가까이서 보면
      if (d < (a.sp === 'beast' ? 12 : 7) && !g.state.codex[SPECIES[a.sp].codex]) g.scan(SPECIES[a.sp].codex);
      if (SPECIES[a.sp].verb && d < (a.sp === 'beast' ? 4.2 : 2.6) && Math.abs(pp.y - a.y) < 3 && a.state !== 'hide' && d < nd) { nd = d; near = a; }
    }
    for (const H of Object.values(this.herds)) H.end();
    this.near = near;
  }

  _draw(a) {
    if (a.hidden) return;
    this.herds[a.sp].push({ x: a.x, y: a.y, z: a.z, yaw: a.yaw, ph: a.ph, sp: a.sp_, act: a.act, load: a.load, s: a.s, pitch: a.pitch, roll: a.roll, glowK: a.glowK, seed: a.seed, tint: a.tint, glow: a.glow });
  }

  /** 걷거나 뛰는 것: 목표 쪽으로 돌아서며 나아간다 */
  _steer(a, dt, tx, tz, speed, turn = 4) {
    const dx = tx - a.x, dz = tz - a.z, d = Math.hypot(dx, dz);
    if (d < 0.05) return d;
    const want = Math.atan2(dx, dz), dy = wrap(want - a.yaw);
    a.yaw += clamp(dy, -turn * dt, turn * dt);
    const k = Math.max(0, Math.cos(dy));
    const step = Math.min(d, speed * k * dt);
    a.x += Math.sin(a.yaw) * step; a.z += Math.cos(a.yaw) * step;
    return d;
  }

  _hopper(a, dt, d, dx, dz, pspeed) {
    const s = a.site, pet = s.mode === 'pet';
    // 겁: 빠르게 다가오면 달아난다 · 궁금: 가만히 있으면 다가온다 · 쓰다듬으면 잠시 따라온다
    if (d < 6.5 && pspeed > 3.5 && a.follow <= 0 && !pet) { a.state = 'flee'; a.t = 2.5 + Math.random(); }
    a.still = d < 7 && pspeed < 0.4 ? a.still + dt : 0;
    if (a.state !== 'flee' && a.still > 2.2 && a.state !== 'curious' && a.state !== 'hop') { a.state = 'curious'; a.t = 6; }
    a.follow = Math.max(0, a.follow - dt);
    const hopping = a.state === 'hop' || a.state === 'flee' || a.state === 'curious' || a.follow > 0;
    a.t -= dt;
    if (a.state === 'flee') {
      a.tx = a.x - (dx / (d || 1)) * 8; a.tz = a.z - (dz / (d || 1)) * 8;
      if (a.t <= 0) { a.state = 'look'; a.t = 1.5; }
    } else if (a.follow > 0) {
      const pp = this.game.player.pos, ang = a.seed * TAU + this.t * 0.3;
      a.tx = pp.x + Math.sin(ang) * 2.2; a.tz = pp.z + Math.cos(ang) * 2.2;
    } else if (a.state === 'curious') {
      const pp = this.game.player.pos;
      const k = Math.max(0, d - 2.2) / (d || 1);
      a.tx = a.x + (pp.x - a.x) * k; a.tz = a.z + (pp.z - a.z) * k;
      if (d < 2.6 || a.t <= 0) { a.state = 'look'; a.t = 3 + Math.random() * 2; a.glowK = Math.max(a.glowK, 0.6); }
    } else if (a.t <= 0) {
      const r = Math.random();
      if (a.state === 'hop' || r < 0.45) { a.state = 'graze'; a.t = 2 + Math.random() * 4; }
      else if (r < 0.7) { a.state = 'look'; a.t = 1 + Math.random() * 2; }
      else {
        a.state = 'hop'; a.t = 1.5 + Math.random() * 2.5;
        const R = s.r * (pet ? 0.9 : 1), an = Math.random() * TAU, rr = Math.sqrt(Math.random()) * R;
        const cx = pet && s.follow ? s.follow.x : s.x, cz = pet && s.follow ? s.follow.z : s.z;
        a.tx = cx + Math.cos(an) * rr; a.tz = cz + Math.sin(an) * rr;
      }
    }
    // 폴짝: 한 번 뛰는 데 0.42 s (달아날 땐 0.3 s), 뛰는 동안만 나아간다
    if (hopping || a.ph % 1 > 0.02) {
      const dur = a.state === 'flee' ? 0.3 : 0.44;
      const prev = a.ph % 1;
      a.ph += dt / dur;
      const dist = Math.hypot(a.tx - a.x, a.tz - a.z);
      if (!hopping && prev > (a.ph % 1)) a.ph = Math.floor(a.ph); // 착지하면 멈춘다
      if (dist > 0.4 || !hopping) this._steer(a, dt, a.tx, a.tz, a.state === 'flee' ? 6.5 : 2.6, 7);
      if (dist <= 0.4 && hopping && a.state === 'hop') { a.state = 'graze'; a.t = 2 + Math.random() * 3; }
      a.sp_ += ((hopping || a.ph % 1 > 0.02 ? 1 : 0) - a.sp_) * Math.min(1, dt * 12);
    } else a.sp_ += (0 - a.sp_) * Math.min(1, dt * 10);
    a.act = a.state === 'graze' ? 1 : a.state === 'look' ? 2 : 0;
    if (a.state === 'look' && d < 9) { const want = Math.atan2(dx, dz); a.yaw += clamp(wrap(want - a.yaw), -3 * dt, 3 * dt); }
    a.y += (this._ground(a.x, a.z, a.y) - a.y) * Math.min(1, dt * 12);
  }

  _beast(a, dt, d, dx, dz) {
    const s = a.site;
    a.t -= dt;
    let speed = 0;
    if (s.route) {
      // 일하는 등짐소: 길목을 오간다 (끝에서 잠시 짐을 내리고 쉰다)
      const R = s.route;
      if (a.state !== 'rest') {
        const [tx, tz] = R[a.ri % R.length];
        const dd = this._steer(a, dt, tx, tz, 1.25, 1.2);
        speed = 1.25;
        if (dd < 1.5) { a.ri++; if (a.ri % R.length === 0 || a.ri % R.length === R.length - 1) { a.state = 'rest'; a.t = 6 + Math.random() * 6; } }
      } else if (a.t <= 0) a.state = 'walk';
      if (d < 3.2) speed = 0; // 사람 앞에선 선다
    } else {
      if (a.t <= 0) {
        if (a.state === 'walk') { a.state = 'graze'; a.t = 6 + Math.random() * 10; }
        else {
          a.state = 'walk'; a.t = 8 + Math.random() * 8;
          const an = Math.random() * TAU, rr = Math.random() * s.r;
          a.tx = s.x + Math.cos(an) * rr; a.tz = s.z + Math.sin(an) * rr;
          if (heightAt(a.tx, a.tz) < 1.5) { a.tx = s.x; a.tz = s.z; }
        }
      }
      if (a.state === 'walk') { const dd = this._steer(a, dt, a.tx, a.tz, 1.1, 0.9); speed = dd > 1 ? 1.1 : 0; if (dd <= 1) { a.state = 'graze'; a.t = 5 + Math.random() * 8; } }
      if (d < 6 && a.state !== 'walk') { a.state = 'look'; a.t = Math.max(a.t, 2); }
    }
    a.sp_ += (clamp(speed / 1.2, 0, 1) - a.sp_) * Math.min(1, dt * 3);
    a.ph += dt * 0.55 * a.sp_ + dt * 0.02;
    a.act = a.state === 'graze' || a.state === 'rest' ? 1 : a.state === 'look' ? 2 : 0;
    if (a.state === 'look' && d < 12) { const want = Math.atan2(dx, dz); a.yaw += clamp(wrap(want - a.yaw), -0.6 * dt, 0.6 * dt); }
    a.y += (this._ground(a.x, a.z, a.y) - a.y) * Math.min(1, dt * 6);
  }

  _bird(a, dt, d, dx, dz, pspeed) {
    const F = a.flock, s = a.site;
    // 무리가 정한다: 땅에서 쪼기 ↔ 앉을 곳(등·돛대·지붕) ↔ 다른 풀밭 — 사람이 바짝 오면 다 같이 난다
    if (a.i === 0) {
      F.t -= dt;
      if ((d < 5.5 && pspeed > 0.5 && F.mode !== 'fly') || F.t <= 0) {
        const perches = this._perches(s.x, s.z, 70);
        const toPerch = perches.length && Math.random() < 0.55;
        F.mode = 'fly'; F.t = 14 + Math.random() * 14;
        if (toPerch) { const q = perches[Math.floor(Math.random() * perches.length)]; F.dest = { x: q[0], z: q[2], y: q[1], perch: perches }; }
        else { const an = Math.random() * TAU, rr = Math.random() * s.r; const x = s.x + Math.cos(an) * rr, z = s.z + Math.sin(an) * rr; F.dest = { x, z, y: heightAt(x, z), perch: null }; }
      }
    }
    const D = F.dest || { x: s.x, z: s.z, y: heightAt(s.x, s.z), perch: null };
    if (F.mode === 'fly') {
      // 날기: 무리 목표 + 자기 자리(흩어짐), 높이는 날아가는 동안 솟았다 내려앉는다
      let tx, tz, ty;
      if (D.perch) { const q = D.perch[(a.i * 7) % D.perch.length]; tx = q[0]; tz = q[2]; ty = q[1]; }
      else { tx = D.x + a.off[0]; tz = D.z + a.off[1]; ty = heightAt(tx, tz); }
      if (!a.fly) { a.fly = { sx: a.x, sz: a.z, sy: a.y, k: 0, len: Math.max(4, Math.hypot(tx - a.x, tz - a.z)) }; }
      const fl = a.fly;
      const v = 7 + (a.i % 3);
      fl.k = Math.min(1, fl.k + (v * dt) / fl.len);
      const k = fl.k, e = k * k * (3 - 2 * k);
      const nx = fl.sx + (tx - fl.sx) * e, nz = fl.sz + (tz - fl.sz) * e;
      const ny = fl.sy + (ty - fl.sy) * e + Math.sin(Math.PI * k) * Math.min(18, fl.len * 0.35) + Math.sin(this.t * 2 + a.i) * 0.2;
      const hd = Math.atan2(nx - a.x, nz - a.z);
      if (Math.hypot(nx - a.x, nz - a.z) > 1e-3) a.yaw += wrap(hd - a.yaw) * Math.min(1, dt * 8);
      a.pitch = clamp(-(ny - a.y) / Math.max(1e-3, v * dt) * 0.15, -0.5, 0.5);
      a.roll = clamp(wrap(hd - a.yaw) * 2, -0.6, 0.6);
      a.x = nx; a.z = nz; a.y = ny;
      a.act = 3; a.sp_ = k < 0.85 ? 1 : 0.4; a.ph += dt * (k < 0.85 ? 7 : 3);
      if (k >= 1) { a.fly = null; a.pitch = 0; a.roll = 0; a.landed = true; }
      if (a.i === 0 && k >= 1) F.mode = D.perch ? 'perch' : 'ground';
      if (a.i !== 0 && k >= 1 && F.mode === 'fly') { a.act = D.perch ? 0 : 1; }
    } else {
      a.fly = null;
      a.sp_ = 0; a.pitch = 0; a.roll = 0;
      if (F.mode === 'ground') {
        // 쪼며 조금씩 옮긴다
        a.t -= dt;
        if (a.t <= 0) { a.t = 0.6 + Math.random() * 1.6; a.tx = a.x + (Math.random() - 0.5) * 1.2; a.tz = a.z + (Math.random() - 0.5) * 1.2; }
        this._steer(a, dt, a.tx, a.tz, 0.6, 6);
        a.y = heightAt(a.x, a.z);
        a.act = 1;
      } else {
        a.act = Math.sin(this.t * 0.7 + a.i * 1.7) > 0.75 ? 2 : 0; // 가끔 지저귄다
        if (a.act === 2 && Math.random() < dt * 0.6 && d < 40) this._chirp(a);
      }
    }
  }

  _jelly(a, dt, d, dx, dz, pspeed, night) {
    const s = a.site;
    // 해 질 녘부터 나오는 들판의 해파리 (숲·마을은 늘)
    a.hidden = s.cond === 'dusk' && night < 0.35 && a.glowK < 0.1;
    a.ph += dt * (0.35 + a.seed * 0.15);
    const pulse = Math.pow(Math.max(0, Math.sin((a.ph % 1) * TAU)), 2);
    if (s.mode === 'tether') {
      // 줄에 매인 살아 있는 등: 말뚝 위에서 조금씩 흔들린다
      a.x = s.x + Math.sin(this.t * 0.4 + a.seed * 9) * 0.3; a.z = s.z + Math.cos(this.t * 0.33 + a.seed * 7) * 0.3;
      a.y = this._ground(s.x, s.z, 99) + 3.4 + pulse * 0.25;
    } else {
      a.t -= dt;
      if (a.t <= 0) { a.t = 6 + Math.random() * 8; const an = Math.random() * TAU, rr = Math.random() * s.r; a.tx = s.x + Math.cos(an) * rr; a.tz = s.z + Math.sin(an) * rr; }
      const lure = a.glowK > 0.3 && d < 30; // 노래를 들으면 다가온다
      const tx = lure ? this.game.player.pos.x + Math.sin(a.seed * 20) * 3 : a.tx, tz = lure ? this.game.player.pos.z + Math.cos(a.seed * 20) * 3 : a.tz;
      const ddx = tx - a.x, ddz = tz - a.z, dd = Math.hypot(ddx, ddz) || 1;
      const v = (0.25 + pulse * 1.2) * (lure ? 1.6 : 1);
      a.x += (ddx / dd) * Math.min(dd, v * dt); a.z += (ddz / dd) * Math.min(dd, v * dt);
      const gy = heightAt(a.x, a.z);
      a.y += (Math.max(gy, 0) + a.alt + Math.sin(this.t * 0.3 + a.seed * 5) * 1.2 + pulse * 0.4 - a.y) * Math.min(1, dt * 0.8);
    }
    a.yaw += dt * 0.1;
    a.sp_ = 0; a.act = 0;
  }

  _crab(a, dt, d, dx, dz, pspeed) {
    const s = a.site;
    a.t -= dt;
    if (a.state === 'hide') { if (a.t <= 0 && d > 6) { a.state = 'idle'; a.t = 1; } a.act = 1; a.sp_ = 0; return; }
    if (d < 4.5 && pspeed > 2) { a.state = Math.random() < 0.5 ? 'hide' : 'flee'; a.t = 4 + Math.random() * 3; }
    if (a.state === 'flee') { a.tx = a.x - (dx / (d || 1)) * 6; a.tz = a.z - (dz / (d || 1)) * 6; if (a.t <= 0) a.state = 'idle'; }
    else if (a.t <= 0) {
      if (Math.random() < 0.5) { a.state = 'idle'; a.t = 1 + Math.random() * 3; }
      else { a.state = 'walk'; a.t = 2 + Math.random() * 3; const an = Math.random() * TAU, rr = Math.random() * s.r; a.tx = s.x + Math.cos(an) * rr; a.tz = s.z + Math.sin(an) * rr; }
    }
    let speed = 0;
    if (a.state === 'walk' || a.state === 'flee') {
      // 옆걸음: 몸은 진행 방향에 가로로
      const ddx = a.tx - a.x, ddz = a.tz - a.z, dd = Math.hypot(ddx, ddz);
      if (dd > 0.3) {
        const v = a.state === 'flee' ? 3.2 : 1.1;
        a.x += (ddx / dd) * v * dt; a.z += (ddz / dd) * v * dt; speed = v;
        const side = Math.atan2(ddx, ddz) - Math.PI / 2;
        a.yaw += clamp(wrap(side - a.yaw), -3 * dt, 3 * dt);
      }
    }
    a.sp_ += (clamp(speed, 0, 1) - a.sp_) * Math.min(1, dt * 8);
    a.ph += dt * (1 + speed * 2.5);
    a.act = d < 6 && a.state === 'idle' ? 2 : 0;
    a.y += (this._ground(a.x, a.z, a.y) - a.y) * Math.min(1, dt * 10);
  }

  /** 새가 앉을 곳: 장소의 등·돛대 꼭대기 + 도시 가로등 */
  _perches(x, z, R) {
    const out = [];
    for (const q of this.world.perches || []) if (Math.hypot(q[0] - x, q[2] - z) < R) out.push(q);
    const L = this.game.city && this.game.city.plist && this.game.city.plist.lamp;
    if (L) for (let i = 0; i < L.length && out.length < 40; i += 6) if (Math.abs(L[i] - x) < R && Math.abs(L[i + 2] - z) < R) out.push([L[i], L[i + 1] + 6.25 * (L[i + 3] || 1), L[i + 2]]);
    return out;
  }

  _chirp(a, n) {
    if (!audio.ready) return;
    const base = [880, 990, 1175, 1320, 1480][n ?? Math.floor(Math.random() * 5)];
    for (let k = 0; k < 2; k++) audio.tone({ hz: base * (k ? 1.26 : 1) }, { delay: k * 0.09, gain: 0.08, pos: a, dur: 0.12, soft: true, maxDist: 60, bus: 'ambience' });
  }

  _onTone(e) {
    const c = new THREE.Color(NOTE_COLORS[e.n] ?? 0xffffff);
    for (const a of this.agents) {
      const d = Math.hypot(a.x - e.pos.x, a.z - e.pos.z);
      if (d > 28) continue;
      a.glow.copy(c); a.glowK = 1;
      if (a.sp === 'bird' && a.act !== 3) setTimeout(() => this._chirp(a, e.n), 300 + Math.random() * 900); // 따라 부른다
      if (a.sp === 'hopper' && a.state !== 'flee') { a.state = 'look'; a.t = 2.5; }
    }
  }

  // ── 다가가기 ─────────────────────────────
  target(p) {
    const a = this.near;
    if (!a) return null;
    const S = SPECIES[a.sp];
    const pet = a.site.mode === 'pet' ? ' · 아이들의 친구' : a.site.mode === 'work' ? ' · 짐을 나르는 중' : a.site.mode === 'tether' ? ' · 정원의 살아 있는 등' : '';
    return { kind: 'fauna', o: a, label: `${S.name}${pet} · ${S.verb}`, short: S.verb };
  }

  interact(a) {
    const g = this.game;
    g.scan(SPECIES[a.sp].codex);
    a.glowK = 1;
    if (a.sp === 'hopper') {
      a.state = 'look'; a.t = 1.2; a.follow = 18; a.ph = Math.floor(a.ph) + 0.01;
      audio.tone({ hz: 1046 }, { gain: 0.12, pos: a, dur: 0.15, soft: true });
      audio.tone({ hz: 1568 }, { delay: 0.12, gain: 0.12, pos: a, dur: 0.2, soft: true });
      g.ui.toast('톡톡이가 귀를 반짝이며 폴짝 뛴다', { kind: 'item', sub: '잠시 곁을 따라다녀요' });
    } else if (a.sp === 'beast') {
      a.state = 'look'; a.t = 4;
      audio.tone({ hz: 82 }, { gain: 0.35, pos: a, dur: 1.6, soft: true, wet: 0.6 });
      g.ui.toast('등짐소가 낮게 울며 머리를 기댄다', { kind: 'item' });
    } else if (a.sp === 'jelly') {
      audio.tone({ hz: 659 }, { gain: 0.16, pos: a, dur: 1.4, soft: true, wet: 0.9 });
      g.ui.toast('포자해파리가 손끝의 온기에 맞춰 빛을 바꾼다', { kind: 'item' });
    } else if (a.sp === 'crab') {
      a.state = 'hide'; a.t = 5;
      g.ui.toast('유리게가 수정 껍데기를 반짝이더니 모래 속으로 숨는다', { kind: 'item' });
    }
  }
}

// ── 캐릭터 실험실용: 한 종을 한 마리 세워 움직인다 (tools/lab) ──
export function labSubject(scene, species, o = {}) {
  const H = new Herd(scene, species, 4);
  const S = SPECIES[species];
  const a = { x: 0, y: species === 'jelly' ? 2.5 : 0, z: 0, yaw: 0.6, ph: 0, sp: 0, act: 0, load: species === 'beast', s: 1, pitch: 0, roll: 0, glowK: 0, seed: 0.3, tint: new THREE.Color(S.tint[0]), glow: new THREE.Color(S.glow) };
  let t = 0;
  return {
    target: () => new THREE.Vector3(a.x, a.y + (species === 'beast' ? 2 : species === 'jelly' ? 0 : 0.3), a.z),
    step(dt) {
      t += dt;
      atmosUniforms.uTime.value = t;
      if (o.mode === 'move') {
        if (species === 'hopper') { a.sp = 1; a.ph += dt / 0.44; }
        else if (species === 'bird') { a.act = 3; a.sp = 1; a.ph += dt * 7; a.y = 1.2; }
        else if (species === 'beast') { a.sp = 1; a.ph += dt * 0.55; }
        else if (species === 'crab') { a.sp = 1; a.ph += dt * 3.5; }
        else { a.ph += dt * 0.45; }
        const v = { hopper: 2.6, bird: 0, beast: 1.2, crab: 0, jelly: 0.3 }[species] || 0;
        a.x += Math.sin(a.yaw) * v * dt; a.z += Math.cos(a.yaw) * v * dt;
      } else {
        a.sp = 0; a.ph += dt * 0.4;
        a.act = Math.floor(t / 2.5) % 3; // 쉬기·먹기·경계를 돌아가며
      }
      H.begin(); H.push(a); H.end();
    },
  };
}
