// 아웬의 몸 (주민 무리 + 이름 있는 인물 공용): 한 지오메트리에 아랫몸·허리 위 몸통·목과 머리·더듬띠·
// 위팔/아래팔(팔꿈치)·손가락·옷자락 띠·손에 든 것(짐 상자·고리 하프·물방울·바구니)을 담고,
// 인스턴스마다 받은 자세 값으로 정점 셰이더가 관절을 차례로 굽힌다 (아래팔 → 어깨 → 허리 → 온몸 기울기).
//   Crowd     : 주민 수십 명을 그리기 1회로 (citizens.js)
//   AwenFigure: 이름 있는 인물 한 명 (awen.js) — 같은 셰이더, 인스턴스 1개
//   AwenMotion: 위치·방향의 변화에서 속도·회전·가감속을 읽어 기울기·옷자락 끌림·떠다니는 박자를 만든다
// 아웬은 걷지 않고 땅 위 0.45 m 에 떠서 다닌다: 다리 대신 아랫몸과 옷자락 띠가 움직임을 보여 준다
// (나아갈 땐 앞으로 기울고 옷자락이 뒤로 끌리며, 멈추면 몸이 살짝 젖혀졌다 돌아오고 띠가 앞으로 흔들린다).
import * as THREE from 'three';
import { lathe, part, merge, xf, tube } from './geo-utils.js';
import { NOISE_GLSL, ATMOS_PARS, CURVE_GLSL } from './shaders.js';
import { atmosUniforms } from './atmosphere.js';

// 부위 번호: 0 아랫몸 1 머리 2 왼 위팔 3 오른 위팔 4 옷자락 5 짐 상자 6 고리 하프 7 물방울 8 바구니
//            9 몸통(허리 위) 10 왼 아래팔·손 11 오른 아래팔·손 12 더듬띠(머리 뒤)
// 관절 자리 (셰이더의 상수와 같아야 한다)
const WAIST = [0, 1.3, 0], NECK = [0, 2.6, 0.02];
const SH = (s) => [s * 0.27, 2.25, 0.02];
const EL = (s) => [s * 0.32, 1.7, 0.08];
const WR = (s) => [s * 0.3, 1.12, 0.18];
const RIB_TOP = 1.22;

function tagged(list) {
  const out = merge(list.map(([g]) => g));
  const n = out.attributes.position.count;
  const pa = new Float32Array(n);
  let o = 0;
  for (const [g, id] of list) { const c = g.attributes.position.count; pa.fill(id, o, o + c); o += c; }
  out.setAttribute('aPart', new THREE.BufferAttribute(pa, 1));
  return out;
}

const _geo = {};
/** detail 1 = 가까이 보는 인물, 0 = 무리 */
export function awenGeo(detail = 0) {
  if (_geo[detail]) return _geo[detail];
  const hi = detail > 0;
  const seg = hi ? 16 : 10, rs = hi ? 6 : 4;
  const W = 0xffffff, D = 0x808080; // 흰색 = 피부색(인스턴스), 회색 = 옷자락 색(인스턴스)
  const L = [];
  // 아랫몸: 끝이 가는 방추 — 허리 위로 조금 겹쳐 몸통이 굽어도 틈이 보이지 않게
  L.push([part(lathe([[0.0001, 0.0], [0.08, 0.15], [0.26, 0.55], [0.42, 1.05], [0.415, 1.3], [0.39, 1.44], [0.0001, 1.46]], seg), W, 0.04), 0]);
  // 허리띠 (이음매를 가리고 옷자락이 매달리는 자리)
  L.push([part(xf(new THREE.TorusGeometry(0.418, 0.04, 4, seg + 4), { y: RIB_TOP + 0.02, rx: Math.PI / 2 }), D, 0.5), 0]);
  // 몸통: 허리부터 어깨·목까지 (가운데 빛줄 + 가슴의 빛)
  L.push([part(lathe([[0.0001, 1.16], [0.37, 1.2], [0.405, 1.38], [0.4, 1.55], [0.3, 2.0], [0.26, 2.25], [0.2, 2.42], [0.1, 2.55], [0.075, 2.64], [0.0001, 2.66]], seg), W, (x, y) => (Math.abs(x) < 0.05 && y > 1.3 && y < 2.3 ? 0.6 : 0.05)), 9]);
  L.push([part(xf(new THREE.SphereGeometry(0.07, hi ? 8 : 6, hi ? 6 : 4), { y: 1.85, z: 0.3 }), W, 2.2), 9]);
  // 어깨 마디
  for (const s of [-1, 1]) L.push([part(xf(new THREE.SphereGeometry(0.062, hi ? 8 : 5, hi ? 6 : 4), { x: SH(s)[0], y: SH(s)[1], z: SH(s)[2] }), W, 0.05), 9]);
  // 머리: 길쭉한 머리 + 빛나는 목소리 띠
  const head = new THREE.SphereGeometry(0.2, hi ? 16 : 10, hi ? 12 : 7);
  head.scale(0.9, 1.0, 1.55); head.rotateX(-0.5);
  const band = new THREE.TorusGeometry(0.19, 0.022, hi ? 6 : 4, hi ? 22 : 14, Math.PI * 1.1);
  band.rotateZ(-Math.PI * 0.05); band.rotateY(Math.PI / 2); band.rotateX(Math.PI / 2 + 0.3);
  L.push([part(xf(head, { y: NECK[1] + 0.14, z: 0.07 }), W, 0.05), 1]);
  L.push([part(xf(band, { y: NECK[1] + 0.15, z: 0.14 }), W, 2.4), 1]);
  // 더듬띠 4가닥 (머리 뒤로, 움직이면 흩날린다)
  for (let i = 0; i < 4; i++) {
    const a = (i - 1.5) * 0.25;
    L.push([part(xf(tube([[0, 0.12, -0.05], [Math.sin(a) * 0.1, 0.3, -0.25], [Math.sin(a) * 0.18, 0.38, -0.55 - i * 0.04]], 0.012, 3, hi ? 8 : 5, (t) => 1.1 - 0.5 * t), { y: NECK[1] + 0.1, z: 0.12 }), W, 2.0), 12]);
  }
  // 팔: 위팔(어깨→팔꿈치) · 아래팔(팔꿈치→손목) · 손바닥 · 긴 손가락 셋
  for (const s of [-1, 1]) {
    const S = SH(s), E = EL(s), R = WR(s);
    const up = tube([S, [s * 0.3, 1.98, 0.04], E], 0.034, rs, hi ? 6 : 4, (t) => 1 - 0.22 * t);
    L.push([part(up, W, 0.05), s < 0 ? 2 : 3]);
    L.push([part(xf(new THREE.SphereGeometry(0.03, hi ? 6 : 4, hi ? 5 : 3), { x: E[0], y: E[1], z: E[2] }), W, 0.05), s < 0 ? 10 : 11]);
    const lo = tube([E, [s * 0.315, 1.4, 0.13], R], 0.027, rs, hi ? 6 : 4, (t) => 1 - 0.3 * t);
    L.push([part(lo, W, 0.05), s < 0 ? 10 : 11]);
    L.push([part(xf(new THREE.SphereGeometry(0.045, hi ? 6 : 4, hi ? 5 : 3), { x: R[0], y: R[1] - 0.04, z: R[2] + 0.01, sx: 0.55, sy: 1.25, sz: 0.95 }), W, 0.1), s < 0 ? 10 : 11]);
    for (let i = 0; i < 3; i++) {
      const a = (i - 1) * 0.35;
      const f = tube([[R[0], R[1] - 0.05, R[2]], [R[0] + s * Math.sin(a) * 0.05, R[1] - 0.18, R[2] + 0.04], [R[0] + s * Math.sin(a) * 0.08, R[1] - 0.28, R[2] + 0.02]], 0.009, 3, hi ? 4 : 3);
      L.push([part(f, W, 0.8), s < 0 ? 10 : 11]);
    }
  }
  // 옷자락: 허리띠에 매달린 띠 7가닥 — 아랫몸보다 조금 바깥에서 몸끝 아래까지 (끝이 은은히 빛난다)
  const NR = 7;
  for (let i = 0; i < NR; i++) {
    const a = (i / NR) * Math.PI * 2 + 0.2;
    const g = new THREE.PlaneGeometry(0.15, 1.32, 1, 6);
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const y = p.getY(k) + 0.66; // 0(끝) .. 1.32(위)
      const yy = RIB_TOP - (1.32 - y);
      // 몸의 윤곽을 따라 (조금 바깥), 몸끝 아래로는 술처럼 살짝 벌어진다
      const r = (yy >= 1.05 ? 0.42 : yy >= 0.55 ? 0.26 + (yy - 0.55) * 0.32 : yy >= 0.15 ? 0.08 + (yy - 0.15) * 0.45 : 0.08 + (0.15 - yy) * 0.35) + 0.04;
      const x = p.getX(k);
      p.setXYZ(k, Math.sin(a) * r + Math.cos(a) * x, yy, Math.cos(a) * r - Math.sin(a) * x);
    }
    g.computeVertexNormals();
    L.push([part(g, D, (x, y) => (y < 0.25 ? 0.9 : 0.25)), 4]);
  }
  // 손에 든 것 (몸통에 붙어 다닌다)
  L.push([part(new THREE.BoxGeometry(0.62, 0.48, 0.5).translate(0, 1.4, 0.62), 0xc89060, 0), 5]);
  L.push([part(new THREE.BoxGeometry(0.64, 0.04, 0.52).translate(0, 1.65, 0.62), 0x7ff3e6, 1.6), 5]);
  L.push([part(new THREE.TorusGeometry(0.34, 0.035, 4, 18).translate(0, 1.85, 0.52), 0xffd27a, 1.4), 6]);
  for (let i = 0; i < 5; i++) L.push([part(new THREE.CylinderGeometry(0.006, 0.006, 0.6 - Math.abs(i - 2) * 0.12, 3).translate(-0.2 + i * 0.1, 1.85, 0.52), 0xfff4d0, 2.2), 6]);
  L.push([part(new THREE.IcosahedronGeometry(0.15, 1).translate(0.3, 1.15, 0.55), 0x9ff6ff, 2.4), 7]);
  L.push([part(new THREE.CylinderGeometry(0.28, 0.2, 0.3, 8, 1, true).translate(0, 1.1, 0.55), 0xc8a070, 0), 8]);
  L.push([part(new THREE.IcosahedronGeometry(0.1, 0).translate(0.08, 1.28, 0.55), 0xffc46a, 1.4), 8]);
  L.push([part(new THREE.IcosahedronGeometry(0.1, 0).translate(-0.1, 1.27, 0.5), 0xff9fd0, 1.4), 8]);
  return (_geo[detail] = tagged(L));
}

const vert = /* glsl */ `
${CURVE_GLSL}
attribute float aPart;
attribute vec3 color;
attribute float emit;
attribute vec4 iA;    // x, y, z, 방향
attribute vec4 iB;    // 배율, 위상, 말빛, 무릎(0 서기 · 0.5 앉기 · 1 꿇기)
attribute vec4 iC;    // 왼팔, 오른팔(앞으로 드는 각), 머리 숙임, 든 것
attribute vec4 iD;    // 몸통 숙임, 온몸 옆기울기(돌 때), 움직임(옷자락 끌림), 머리 돌림
attribute vec4 iE;    // 왼 팔꿈치, 오른 팔꿈치, 왼팔 벌림, 오른팔 벌림
attribute vec4 iF;    // 떠다니는 박자, 몸통 비틀기, 온몸 앞기울기, 몸통 옆굽힘
attribute vec3 iSkin;
attribute vec3 iDeep;
attribute vec3 iGlow;
uniform float uTime;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vColor;
varying float vEmit;
varying vec3 vGlowC;
mat3 RX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
mat3 RY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
mat3 RZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }
const vec3 WAIST = vec3(0.0, 1.3, 0.0);
const vec3 NECK = vec3(0.0, 2.6, 0.02);
const vec3 TEND = vec3(0.0, 2.82, 0.07);
void main() {
  vec3 p = position, n = normal;
  float t = uTime + iB.y * 17.0;
  float pt = aPart;
  float mv = iD.z;
  // 손에 든 것: 그 물건일 때만
  if (pt > 4.5 && pt < 8.5 && abs(iC.w - pt) > 0.5) { gl_Position = vec4(0.0, 0.0, -2.0, 1.0); return; }
  // 팔: 아래팔(팔꿈치) → 위팔(어깨)
  if ((pt > 1.5 && pt < 3.5) || (pt > 9.5 && pt < 11.5)) {
    float s = (pt < 2.5 || pt < 10.5 && pt > 9.5) ? -1.0 : 1.0;
    float raise = s < 0.0 ? iC.x : iC.y;
    float elbow = s < 0.0 ? iE.x : iE.y;
    float outA = s < 0.0 ? iE.z : iE.w;
    vec3 SH = vec3(s * 0.27, 2.25, 0.02), EL = vec3(s * 0.32, 1.7, 0.08);
    if (pt > 9.5) { mat3 E = RX(-elbow); p = E * (p - EL) + EL; n = E * n; }
    mat3 S = RZ(s * (0.1 + outA + raise * 0.14 + sin(t * 0.9 + s) * 0.03)) * RX(-(0.12 + raise));
    p = S * (p - SH) + SH; n = S * n;
  } else if (pt > 11.5) {
    // 더듬띠: 머리를 따라가고, 움직이면 뒤로 흩날리고, 늘 조금씩 흔들린다
    float k = clamp((TEND.z - p.z) / 0.6, 0.0, 1.0);
    mat3 T = RY(sin(t * 1.7 + p.x * 9.0) * 0.12 * k) * RX(-mv * 0.35 * k + sin(t * 2.3 + p.x * 7.0) * 0.06);
    p = T * (p - TEND) + TEND; n = T * n;
    mat3 H = RY(iD.w) * RX(iC.z);
    p = H * (p - NECK) + NECK; n = H * n;
  } else if (pt > 0.5 && pt < 1.5) {
    mat3 H = RY(iD.w) * RX(iC.z);
    p = H * (p - NECK) + NECK; n = H * n;
  } else if (pt < 0.5 || (pt > 3.5 && pt < 4.5)) {
    // 아랫몸과 옷자락: 허리띠 아래는 흐르는 몸 — 끝으로 갈수록 뒤로 끌리고(움직임) 도는 바깥으로 쏠린다
    float f = clamp((${RIB_TOP.toFixed(2)} - p.y) / 1.32, 0.0, 1.0);
    if (pt > 3.5) {
      // 옷자락만: 떠다니는 박자에 맞춰 퍼졌다 모이고, 늘 조금씩 나부낀다
      vec2 rd = normalize(p.xz + 1e-4);
      float ang = atan(p.x, p.z);
      float pulse = 0.5 + 0.5 * sin(iF.x * 2.0 - f * 2.2);
      p.xz += rd * (0.025 + 0.07 * clamp(mv, 0.0, 1.4) * pulse + 0.02 * sin(t * 1.4 + ang * 2.0)) * f * f;
      p += vec3(sin(t * 2.6 + ang * 3.0 - f * 4.0), 0.0, cos(t * 2.2 + ang * 2.0 - f * 3.0)) * 0.025 * f;
    }
    p.z -= mv * 0.3 * pow(f, 1.6);
    p.y += mv * 0.12 * f * f;
    p.x += iD.y * 0.6 * f * f;
  }
  // 몸통(허리 위 전부: 몸통·머리·팔·든 것): 비틀기 → 숙임 → 옆굽힘, 숨쉬기
  bool upper = (pt > 0.5 && pt < 3.5) || (pt > 4.5);
  if (upper) {
    float br = 1.0 + sin(t * 1.3) * 0.012;
    p.xz = (p.xz) * mix(1.0, br, step(1.4, p.y) * step(p.y, 2.3));
    mat3 T = RZ(iF.w) * RX(iD.x) * RY(iF.y);
    p = T * (p - WAIST) + WAIST; n = T * n;
  }
  // 무릎(앉기·꿇기): 허리 위가 내려오고 앞으로 숙는다
  float kneel = iB.w;
  float up = smoothstep(0.5, 1.2, p.y);
  p.y -= kneel * 0.95 * up;
  p.z += kneel * 0.2 * up * smoothstep(1.2, 2.6, p.y + kneel);
  // 온몸: 나아가는 쪽으로 기울고(앞), 도는 쪽으로 눕는다(옆) — 무게중심 둘레로
  mat3 B = RZ(iD.y) * RX(iF.z);
  vec3 C = vec3(0.0, 1.25, 0.0);
  p = B * (p - C) + C; n = B * n;
  // 떠 있기: 서 있을 땐 느린 숨, 움직이면 박자에 맞춰 살짝 솟는다
  p.y += 0.45 + (sin(t * 1.3) * 0.07 * (1.0 - min(mv, 1.0)) + sin(iF.x * 2.0) * 0.05 * min(mv, 1.2)) * (1.0 - kneel);
  p *= iB.x;
  vec3 wp = RY(iA.w) * p + iA.xyz;
  vWorld = wp;
  vNormal = RY(iA.w) * n;
  vColor = mix(iDeep, iSkin, step(0.9, color.r) * step(0.9, color.g) * step(0.9, color.b));
  if (pt > 4.5 && pt < 8.5) vColor = color;
  vEmit = emit * (1.0 + iB.z * (1.2 + sin(uTime * 18.0) * 0.8));
  vGlowC = (pt > 4.5 && pt < 8.5) ? color : iGlow;
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

let _mat = null;
export function awenMaterial() {
  return _mat || (_mat = new THREE.ShaderMaterial({ uniforms: { ...atmosUniforms }, vertexShader: vert, fragmentShader: frag, side: THREE.DoubleSide }));
}

const SLOTS = [['iA', 4], ['iB', 4], ['iC', 4], ['iD', 4], ['iE', 4], ['iF', 4], ['iSkin', 3], ['iDeep', 3], ['iGlow', 3]];

/** 인스턴스 지오메트리 (max 명) */
export function awenInstances(max, detail = 0) {
  const base = awenGeo(detail);
  const g = new THREE.InstancedBufferGeometry();
  for (const k of ['position', 'normal', 'color', 'emit', 'aPart']) g.setAttribute(k, base.attributes[k]);
  const at = {};
  for (const [k, n] of SLOTS) {
    const a = new THREE.InstancedBufferAttribute(new Float32Array(max * n), n);
    a.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute(k, a);
    at[k] = a;
  }
  g.instanceCount = 0;
  return { g, at };
}

/** 한 명의 자세를 i 번째 칸에 쓴다. o: { x, y, z, yaw, s, phase, speak, kneel, armL, armR, head, hold,
 *  lean, bank, move, headYaw, elbowL, elbowR, outL, outR, walk, twist, tilt, side, skin, deep, glow } */
export function writeAwen(at, i, o) {
  at.iA.array.set([o.x, o.y, o.z, o.yaw], i * 4);
  at.iB.array.set([o.s ?? 1, o.phase || 0, o.speak || 0, o.kneel || 0], i * 4);
  at.iC.array.set([o.armL || 0, o.armR || 0, o.head || 0, o.hold || 0], i * 4);
  at.iD.array.set([o.lean || 0, o.bank || 0, o.move || 0, o.headYaw || 0], i * 4);
  at.iE.array.set([o.elbowL ?? 0.15, o.elbowR ?? 0.15, o.outL || 0, o.outR || 0], i * 4);
  at.iF.array.set([o.walk || 0, o.twist || 0, o.tilt || 0, o.side || 0], i * 4);
  at.iSkin.array.set([o.skin.r, o.skin.g, o.skin.b], i * 3);
  at.iDeep.array.set([o.deep.r, o.deep.g, o.deep.b], i * 3);
  at.iGlow.array.set([o.glow.r, o.glow.g, o.glow.b], i * 3);
}

export function flushAwen(at, n) {
  for (const [k, w] of SLOTS) { const a = at[k]; a.clearUpdateRanges(); a.addUpdateRange(0, n * w); a.needsUpdate = true; }
}

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * 움직임 읽기: 매 프레임 (자리, 방향)을 주면 속도·가속·회전을 부드럽게 재서 몸의 반응을 낸다.
 * 결과(this.out): move(옷자락 끌림 0..1.6) · tilt(온몸 앞기울기, 멈출 때 살짝 젖혀졌다 돌아옴) · bank(도는 쪽으로)
 *               walk(떠다니는 박자) · swing(팔 흔들기 -1..1) · speed(m/s) · turn(회전 속도)
 */
export class AwenMotion {
  constructor(seed = 0) {
    this.walk = seed * 6.28;
    this.vx = 0; this.vz = 0; this.spd = 0; this.acc = 0;
    this.tilt = 0; this.tiltV = 0; this.trail = 0; this.trailV = 0; this.bank = 0; this.turn = 0;
    this.px = null; this.pz = 0; this.py = 0;
    this.out = { move: 0, tilt: 0, bank: 0, walk: 0, swing: 0, speed: 0, turn: 0 };
  }

  step(dt, x, z, yaw) {
    if (dt <= 0) return this.out;
    if (this.px == null || (x - this.px) ** 2 + (z - this.pz) ** 2 > 36) { this.px = x; this.pz = z; this.py = yaw; }
    let ivx = (x - this.px) / dt, ivz = (z - this.pz) / dt;
    this.px = x; this.pz = z;
    if (ivx * ivx + ivz * ivz > 900) { ivx = 0; ivz = 0; }
    const kv = 1 - Math.exp(-dt * 7);
    this.vx += (ivx - this.vx) * kv; this.vz += (ivz - this.vz) * kv;
    const spd = Math.hypot(this.vx, this.vz);
    const fwd = this.vx * Math.sin(yaw) + this.vz * Math.cos(yaw);
    const lat = this.vx * Math.cos(yaw) - this.vz * Math.sin(yaw);
    this.acc += ((spd - this.spd) / dt - this.acc) * (1 - Math.exp(-dt * 5));
    this.spd = spd;
    const dy = wrap(yaw - this.py); this.py = yaw;
    this.turn += (dy / dt - this.turn) * (1 - Math.exp(-dt * 6));
    // 앞기울기: 빠를수록, 출발할 때 더 숙이고 멈출 땐 젖힌다 — 용수철이라 멈춘 뒤 한 번 흔들리고 선다
    const want = clamp(fwd * 0.04 + this.acc * 0.035, -0.13, 0.17);
    this.tiltV += ((want - this.tilt) * 70 - this.tiltV * 10) * dt;
    this.tilt += this.tiltV * dt;
    // 옷자락 끌림: 몸보다 늦게 따라와서, 멈추면 앞으로 흔들렸다가 내려앉는다
    const tw = clamp(spd / 2.0, 0, 1.25);
    this.trailV += ((tw - this.trail) * 26 - this.trailV * 4.2) * dt;
    this.trail += this.trailV * dt;
    // 옆기울기: 도는 쪽 안으로 눕는다 (빠르게 돌수록)
    const bw = clamp(-this.turn * spd * 0.06 - lat * 0.04, -0.22, 0.22);
    this.bank += (bw - this.bank) * (1 - Math.exp(-dt * 5));
    // 떠다니는 박자: 빠를수록 잦게 (서 있을 땐 아주 천천히)
    this.walk += dt * (0.6 + Math.min(spd, 3) * 2.1);
    const o = this.out;
    o.move = Math.max(-0.35, this.trail); o.tilt = this.tilt; o.bank = this.bank; o.walk = this.walk;
    o.swing = Math.sin(this.walk) * clamp(spd / 1.2, 0, 1); o.speed = spd; o.turn = this.turn;
    return o;
  }
}

export class Crowd {
  constructor(scene, max = 160) {
    this.max = max;
    const { g, at } = awenInstances(max, 0);
    this.at = at;
    this.mat = awenMaterial();
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.geo = g;
    this.n = 0;
  }
  begin() { this.n = 0; }
  /** 한 명 그리기 (writeAwen 의 o) */
  push(o) {
    if (this.n >= this.max) return;
    writeAwen(this.at, this.n++, o);
  }
  end() {
    this.geo.instanceCount = this.n;
    flushAwen(this.at, this.n);
  }
}
