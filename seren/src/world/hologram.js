// 홀로그램: 아웬 글자(악보 글자)를 빛으로 띄우는 표지·광고·안내판.
// 글자 줄은 Canvas 로 한 번 그려 텍스처로 쓰고, 셰이더가 흘러가는 주사선·깜박임·가장자리 빛을 더합니다.
import * as THREE from 'three';
import { CURVE_GLSL, ATMOS_PARS, NOISE_GLSL } from './shaders.js';
import { atmosUniforms } from './atmosphere.js';
import { glyphParts } from '../game/language.js';
import { WORDS } from '../data/lexicon.js';
import { mulberry32 } from '../core/noise.js';

const texCache = new Map();

/** 글자 줄 텍스처 (흰 글자 + 오선) */
export function glyphStripTexture(seed = 1, count = 24, { lines = true, height = 128 } = {}) {
  const key = `${seed}:${count}:${lines}:${height}`;
  if (texCache.has(key)) return texCache.get(key);
  const cell = height;
  const cv = document.createElement('canvas');
  cv.width = Math.min(4096, cell * count);
  cv.height = height;
  const g = cv.getContext('2d');
  g.clearRect(0, 0, cv.width, cv.height);
  g.strokeStyle = '#fff';
  g.fillStyle = '#fff';
  g.lineCap = 'round';
  g.lineJoin = 'round';
  if (lines) {
    g.globalAlpha = 0.28;
    g.lineWidth = Math.max(1, height / 90);
    for (let i = 0; i < 5; i++) { const y = height * (0.3 + i * 0.13); g.beginPath(); g.moveTo(0, y); g.lineTo(cv.width, y); g.stroke(); }
    g.globalAlpha = 1;
  }
  const rnd = mulberry32(seed * 977 + 13);
  const n = Math.floor(cv.width / cell);
  for (let i = 0; i < n; i++) {
    if (rnd() < 0.12) continue; // 쉼표
    const w = WORDS[Math.floor(rnd() * WORDS.length)];
    const p = glyphParts(w.id);
    g.save();
    g.translate(i * cell + cell * 0.08, cell * 0.06);
    g.scale((cell * 0.84) / 40, (cell * 0.84) / 40);
    g.lineWidth = 2.2;
    if (p.d) g.stroke(new Path2D(p.d));
    for (const o of p.deco) {
      if (o.d) g.stroke(new Path2D(o.d));
      else { g.beginPath(); g.arc(o.circle[0], o.circle[1], o.circle[2], 0, Math.PI * 2); g.stroke(); }
    }
    for (const [x, y] of p.dots) { g.beginPath(); g.arc(x, y, 2.8, 0, Math.PI * 2); g.fill(); }
    g.restore();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 4;
  tex.colorSpace = THREE.NoColorSpace;
  texCache.set(key, tex);
  return tex;
}

const vert = /* glsl */ `
${CURVE_GLSL}
varying vec2 vUv;
varying vec3 vWorld;
varying vec3 vNormal;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * vec4(curveWorld(wp.xyz), 1.0);
}`;

const frag = /* glsl */ `
${NOISE_GLSL}
${ATMOS_PARS}
uniform sampler2D uTex;
uniform vec3 uColor;
uniform vec3 uColor2;
uniform float uIntensity;
uniform float uScroll;
uniform vec2 uRepeat;
uniform float uSeed;
varying vec2 vUv;
varying vec3 vWorld;
varying vec3 vNormal;
void main() {
  vec2 uv = vec2(vUv.x * uRepeat.x + uTime * uScroll, vUv.y);
  float g = texture2D(uTex, uv).r;
  float scan = 0.75 + 0.25 * sin(vWorld.y * 3.0 - uTime * 6.0);
  float flick = 0.88 + 0.12 * step(0.94, vnoise(vec2(uTime * 7.0, uSeed)));
  float band = smoothstep(0.0, 0.08, vUv.y) * smoothstep(1.0, 0.92, vUv.y);
  float edge = smoothstep(0.06, 0.0, vUv.y) + smoothstep(0.94, 1.0, vUv.y);
  vec3 col = mix(uColor, uColor2, vUv.y) * (g * 1.2 * scan + 0.05) * band + uColor * edge * 0.6;
  float fog = fogAmount(cameraPosition, vWorld);
  col *= uIntensity * flick * (0.55 + 0.75 * clamp(uGlow, 0.0, 1.0)) * (1.0 - fog);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/** 가산 혼합 홀로그램 재질 */
export function hologramMaterial({ color = 0x7ff3e6, color2, intensity = 1, scroll = 0.02, repeat = [1, 1], seed = 1, tex } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...atmosUniforms,
      uTex: { value: tex || glyphStripTexture(seed) },
      uColor: { value: new THREE.Color(color) },
      uColor2: { value: new THREE.Color(color2 ?? color) },
      uIntensity: { value: intensity },
      uScroll: { value: scroll },
      uRepeat: { value: new THREE.Vector2(...repeat) },
      uSeed: { value: seed },
    },
    vertexShader: vert,
    fragmentShader: frag,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}
