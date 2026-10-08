// 점광원 무리: 탑 꼭대기 표지등, 배의 항해등, 창가의 불빛처럼 "멀리서도 보이는 빛의 점".
// 하나의 Points 로 수백 개를 한 번에 그리고, 멀어져도 최소 픽셀 크기를 지켜 밤하늘의 교통이 보이게 합니다.
import * as THREE from 'three';
import { CURVE_GLSL, ATMOS_PARS, NOISE_GLSL } from './shaders.js';
import { atmosUniforms } from './atmosphere.js';

const vert = /* glsl */ `
${CURVE_GLSL}
${NOISE_GLSL}
${ATMOS_PARS}
attribute vec3 aColor;
attribute float aSize;
attribute float aBlink;
attribute float aPhase;
uniform float uScale;
uniform float uMinPx;
uniform float uDay;
varying vec3 vColor;
varying float vA;
void main() {
  vec4 mv = viewMatrix * vec4(curveWorld(position), 1.0);
  gl_Position = projectionMatrix * mv;
  float px = aSize * uScale / max(1.0, -mv.z);
  float blink = aBlink > 0.0 ? step(0.55, fract(uTime * aBlink + aPhase)) : 1.0;
  gl_PointSize = clamp(px, uMinPx, 64.0);
  float fog = fogAmount(cameraPosition, position);
  float vis = mix(uDay, 1.0, clamp(uGlow, 0.0, 1.0));
  vA = blink * vis * uLightScale * (1.0 - fog * 0.85) * clamp(px / uMinPx, 0.45, 1.0);
  vColor = aColor;
}`;

const frag = /* glsl */ `
varying vec3 vColor;
varying float vA;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5 || vA < 0.002) discard;
  float core = smoothstep(0.22, 0.0, d);
  float halo = smoothstep(0.5, 0.0, d);
  vec3 col = vColor * (core * 2.2 + halo * halo * 0.9) * vA;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class PointLights {
  /** max: 최대 개수, opts: minPx(최소 픽셀), day(낮에 보이는 정도 0..1) */
  constructor(scene, max = 512, { minPx = 2.2, day = 0.35 } = {}) {
    this.max = max;
    this.n = 0;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.blink = new Float32Array(max);
    this.phase = new Float32Array(max);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('aBlink', new THREE.BufferAttribute(this.blink, 1));
    g.setAttribute('aPhase', new THREE.BufferAttribute(this.phase, 1));
    g.setDrawRange(0, 0);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { ...atmosUniforms, uScale: { value: innerHeight * 0.6 }, uMinPx: { value: minPx }, uDay: { value: day } },
      vertexShader: vert, fragmentShader: frag,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 4;
    scene.add(this.points);
    this._c = new THREE.Color();
  }

  /** 빛 하나 추가 → 인덱스 */
  add(x, y, z, color = 0xffffff, size = 4, blink = 0, phase = Math.random()) {
    if (this.n >= this.max) return -1;
    const i = this.n++;
    this.set(i, x, y, z);
    this.color(i, color);
    this.size[i] = size;
    this.blink[i] = blink;
    this.phase[i] = phase;
    const g = this.points.geometry;
    g.attributes.aSize.needsUpdate = true;
    g.attributes.aBlink.needsUpdate = true;
    g.attributes.aPhase.needsUpdate = true;
    g.setDrawRange(0, this.n);
    return i;
  }

  set(i, x, y, z) {
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this._dirty = true;
  }

  color(i, c, k = 1) {
    this._c.set(c);
    this.col[i * 3] = this._c.r * k; this.col[i * 3 + 1] = this._c.g * k; this.col[i * 3 + 2] = this._c.b * k;
    this._cdirty = true;
  }

  update() {
    const g = this.points.geometry;
    if (this._dirty) { g.attributes.position.needsUpdate = true; this._dirty = false; }
    if (this._cdirty) { g.attributes.aColor.needsUpdate = true; this._cdirty = false; }
    this.mat.uniforms.uScale.value = innerHeight * 0.6;
  }
}
