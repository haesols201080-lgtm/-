// 입자 효과: 착지 먼지, 물보라, 반짝임, 썰매 꼬리 — 하나의 Points 풀로 처리.
// 그리고 날개 끝의 빛 궤적(리본).
import * as THREE from 'three';
import { CURVE_GLSL, ATMOS_PARS, NOISE_GLSL } from './shaders.js';
import { atmosUniforms } from './atmosphere.js';

const MAX = 900;

const pVert = /* glsl */ `
${CURVE_GLSL}
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
attribute float aAdd;
uniform float uScale;
varying float vAlpha;
varying vec3 vColor;
varying float vAdd;
varying vec3 vWorld;
void main() {
  vAlpha = aAlpha; vColor = aColor; vAdd = aAdd;
  vWorld = position;
  vec4 mv = viewMatrix * vec4(curveWorld(position), 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uScale / max(0.5, -mv.z);
}`;

const pFrag = /* glsl */ `
${NOISE_GLSL}
${ATMOS_PARS}
varying float vAlpha;
varying vec3 vColor;
varying float vAdd;
varying vec3 vWorld;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  float a = smoothstep(0.5, 0.0, d) * vAlpha;
  float fog = fogAmount(cameraPosition, vWorld);
  vec3 col = vColor;
  if (vAdd < 0.5) col *= uAmbTop * 1.4 + uSunColor * 0.8 + uUrLight;
  gl_FragColor = vec4(col * (1.0 - fog), a * (1.0 - fog * 0.5));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class Particles {
  constructor(scene) {
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(MAX * 3);
    this.size = new Float32Array(MAX);
    this.alpha = new Float32Array(MAX);
    this.color = new Float32Array(MAX * 3);
    this.add = new Float32Array(MAX);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.color, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAdd', new THREE.BufferAttribute(this.add, 1).setUsage(THREE.DynamicDrawUsage));
    // 두 재질: 가산(빛) / 일반(먼지) — 같은 버퍼를 쓰되 그리기를 두 번
    this.matAdd = new THREE.ShaderMaterial({ uniforms: { ...atmosUniforms, uScale: { value: innerHeight * 0.5 } }, vertexShader: pVert, fragmentShader: pFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.points = new THREE.Points(g, this.matAdd);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
    this.parts = Array.from({ length: MAX }, () => ({ life: 0, max: 1, vx: 0, vy: 0, vz: 0, g: 0, drag: 0, s0: 1, s1: 1, a0: 1 }));
    this.next = 0;
    this._c = new THREE.Color();
  }

  /**
   * opts: pos, vel?, count, spread(속도 흩어짐), life, size[시작,끝], color, alpha, gravity, drag, add(빛인가)
   */
  emit(o) {
    const n = o.count || 1;
    this._c.set(o.color ?? 0xffffff);
    for (let k = 0; k < n; k++) {
      const i = this.next;
      this.next = (this.next + 1) % MAX;
      const p = this.parts[i];
      const sp = o.spread ?? 1;
      p.life = p.max = (o.life ?? 1) * (0.7 + Math.random() * 0.6);
      p.vx = (o.vel ? o.vel.x : 0) + (Math.random() - 0.5) * 2 * sp;
      p.vy = (o.vel ? o.vel.y : 0) + (Math.random() - 0.5) * 2 * sp * (o.flat ? 0.3 : 1) + (o.up || 0) * Math.random();
      p.vz = (o.vel ? o.vel.z : 0) + (Math.random() - 0.5) * 2 * sp;
      p.g = o.gravity ?? 0;
      p.drag = o.drag ?? 1.5;
      p.s0 = (o.size ? o.size[0] : 0.5); p.s1 = (o.size ? o.size[1] : 1.5);
      p.a0 = o.alpha ?? 0.8;
      const r = o.radius || 0;
      this.pos[i * 3] = o.pos.x + (Math.random() - 0.5) * r;
      this.pos[i * 3 + 1] = o.pos.y + (Math.random() - 0.5) * r * 0.4;
      this.pos[i * 3 + 2] = o.pos.z + (Math.random() - 0.5) * r;
      this.color[i * 3] = this._c.r; this.color[i * 3 + 1] = this._c.g; this.color[i * 3 + 2] = this._c.b;
      this.add[i] = o.add ? 1 : 0;
    }
  }

  update(dt) {
    let alive = 0;
    for (let i = 0; i < MAX; i++) {
      const p = this.parts[i];
      if (p.life <= 0) { this.alpha[i] = 0; continue; }
      alive++;
      p.life -= dt;
      const k = 1 - p.life / p.max;
      const dr = Math.exp(-p.drag * dt);
      p.vx *= dr; p.vy = p.vy * dr - p.g * dt; p.vz *= dr;
      this.pos[i * 3] += p.vx * dt; this.pos[i * 3 + 1] += p.vy * dt; this.pos[i * 3 + 2] += p.vz * dt;
      this.size[i] = p.s0 + (p.s1 - p.s0) * k;
      this.alpha[i] = p.a0 * Math.min(1, k * 6) * (1 - k);
    }
    const g = this.points.geometry;
    for (const k of ['position', 'aSize', 'aAlpha', 'aColor', 'aAdd']) g.attributes[k].needsUpdate = true;
    this.points.visible = alive > 0;
    this.matAdd.uniforms.uScale.value = innerHeight * 0.5;
  }
}

// ── 날개 끝 빛 궤적 ─────────────────────────────
const tVert = /* glsl */ `
${CURVE_GLSL}
attribute float aT;
varying float vT;
void main() {
  vT = aT;
  gl_Position = projectionMatrix * viewMatrix * vec4(curveWorld(position), 1.0);
}`;
const tFrag = /* glsl */ `
uniform vec3 uColor;
uniform float uAlpha;
varying float vT;
void main() {
  float a = (1.0 - vT) * uAlpha;
  gl_FragColor = vec4(uColor * a, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class Trail {
  constructor(scene, color = 0xbffcff, n = 40, width = 0.12) {
    this.n = n;
    this.width = width;
    this.pts = [];
    const g = new THREE.BufferGeometry();
    this.posArr = new Float32Array(n * 2 * 3);
    const t = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) { t[i * 2] = i / (n - 1); t[i * 2 + 1] = i / (n - 1); }
    g.setAttribute('position', new THREE.BufferAttribute(this.posArr, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aT', new THREE.BufferAttribute(t, 1));
    const idx = [];
    for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setIndex(idx);
    this.mat = new THREE.ShaderMaterial({ uniforms: { uColor: { value: new THREE.Color(color) }, uAlpha: { value: 0 }, uCurv: atmosUniforms.uCurv }, vertexShader: tVert, fragmentShader: tFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.alpha = 0;
    this._cam = new THREE.Vector3();
  }

  /** 매 프레임: on 이면 점 추가 */
  update(dt, point, on, camPos) {
    this.alpha += ((on ? 0.9 : 0) - this.alpha) * Math.min(1, dt * 4);
    this.mat.uniforms.uAlpha.value = this.alpha;
    if (this.alpha < 0.01) { this.pts.length = 0; this.mesh.visible = false; return; }
    this.mesh.visible = true;
    this.pts.unshift(point.clone());
    if (this.pts.length > this.n) this.pts.length = this.n;
    const a = this.posArr;
    for (let i = 0; i < this.n; i++) {
      const p = this.pts[Math.min(i, this.pts.length - 1)];
      const q = this.pts[Math.min(i + 1, this.pts.length - 1)];
      // 카메라를 향하는 폭
      const dx = q.x - p.x, dy = q.y - p.y, dz = q.z - p.z;
      const vx = p.x - camPos.x, vy = p.y - camPos.y, vz = p.z - camPos.z;
      let sx = dy * vz - dz * vy, sy = dz * vx - dx * vz, sz = dx * vy - dy * vx;
      const l = Math.hypot(sx, sy, sz) || 1;
      const w = this.width * (1 - i / this.n);
      sx = (sx / l) * w; sy = (sy / l) * w; sz = (sz / l) * w;
      a[i * 6] = p.x - sx; a[i * 6 + 1] = p.y - sy; a[i * 6 + 2] = p.z - sz;
      a[i * 6 + 3] = p.x + sx; a[i * 6 + 4] = p.y + sy; a[i * 6 + 5] = p.z + sz;
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
  }
}
