// 구름층: 높이 700~1600m 에 떠 있는 구름 무리. 바람을 따라 천천히 흘러가고, 높은 곳에서는 발아래 구름바다가 됩니다.
// 카메라를 향하는 판(빌보드)을 인스턴스로 그리고, 셰이더에서 부드러운 노이즈로 모양을 만듭니다.
import * as THREE from 'three';
import { NOISE_GLSL, ATMOS_PARS, CURVE_GLSL } from './shaders.js';
import { atmosUniforms } from './atmosphere.js';
import { mulberry32 } from '../core/noise.js';

const vert = /* glsl */ `
${CURVE_GLSL}
attribute vec4 aCloud; // xyz = 무리 중심 기준 오프셋 방향, w = 씨앗
uniform vec2 uDrift;
uniform float uWrap;
varying vec2 vUv;
varying vec3 vWorld;
varying float vSeed;
varying float vShade;
void main() {
  vUv = uv;
  vSeed = aCloud.w;
  vec3 center = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
  float size = length(vec3(instanceMatrix[0][0], instanceMatrix[0][1], instanceMatrix[0][2]));
  center.xz += uDrift;
  // 세계를 넘어가면 반대편으로
  center.xz = mod(center.xz + uWrap, uWrap * 2.0) - uWrap;
  vec3 camR = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 camU = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 wp = center + (camR * position.x + camU * position.y) * size;
  vWorld = wp;
  vShade = aCloud.y; // 무리 안에서의 높이(위쪽일수록 밝음)
  gl_Position = projectionMatrix * viewMatrix * vec4(curveWorld(wp), 1.0);
}`;

const frag = /* glsl */ `
${NOISE_GLSL}
${ATMOS_PARS}
uniform float uCover;
varying vec2 vUv;
varying vec3 vWorld;
varying float vSeed;
varying float vShade;
void main() {
  vec2 p = vUv - 0.5;
  float r = length(p) * 2.0;
  float n = vnoise(p * 3.2 + vSeed * 13.0) * 0.65 + vnoise(p * 7.0 - vSeed * 7.0 + uTime * 0.01) * 0.35;
  float a = smoothstep(1.0, 0.25, r + (n - 0.5) * 0.7) * uCover;
  if (a < 0.01) discard;
  vec3 V = normalize(vWorld - cameraPosition);
  float fwd = pow(max(dot(V, uSunDir), 0.0), 6.0);
  float top = clamp(vShade * 0.5 + 0.5 + (0.5 - vUv.y) * -0.3, 0.0, 1.0);
  vec3 lit = uAmbTop * 1.5 + uSunColor * (0.55 + 1.2 * fwd) * (0.6 + 0.4 * top) + uUrLight * 1.2 + uHorizonGlow * 0.4;
  vec3 shade = mix(uAmbBottom * 1.4 + uUrLight * 0.5, lit, 0.35 + 0.65 * top);
  vec3 col = shade * (0.85 + 0.15 * n);
  float fog = fogAmount(cameraPosition, vWorld);
  col = mix(col, fogColorFor(V), clamp(fog, 0.0, 1.0));
  gl_FragColor = vec4(col, a * 0.85);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class Clouds {
  constructor(world, q) {
    const amount = q.clouds ?? 1;
    const clusters = Math.round(90 * amount);
    const per = 12;
    const rnd = mulberry32(2718);
    const total = clusters * per;
    const geo = new THREE.PlaneGeometry(1, 1);
    const inst = new THREE.InstancedBufferGeometry().copy(geo);
    const aCloud = new Float32Array(total * 4);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { ...atmosUniforms, uDrift: { value: new THREE.Vector2() }, uWrap: { value: 26000 }, uCover: { value: 1 } },
      vertexShader: vert, fragmentShader: frag,
      transparent: true, depthWrite: false,
    });
    const mesh = new THREE.InstancedMesh(inst, this.mat, total);
    const m = new THREE.Matrix4();
    let k = 0;
    for (let c = 0; c < clusters; c++) {
      const cx = (rnd() - 0.5) * 48000, cz = (rnd() - 0.5) * 48000;
      const cy = 760 + rnd() * 820;
      const R = 300 + rnd() * 700;
      const flat = 0.22 + rnd() * 0.15;
      for (let i = 0; i < per; i++) {
        const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * R;
        const h = (rnd() - 0.5) * 2;
        const size = (220 + rnd() * 320) * (1 - d / R * 0.45);
        m.makeScale(size, size, size);
        m.setPosition(cx + Math.cos(a) * d, cy + h * R * flat, cz + Math.sin(a) * d * 0.8);
        mesh.setMatrixAt(k, m);
        aCloud[k * 4] = 0; aCloud[k * 4 + 1] = h; aCloud[k * 4 + 2] = 0; aCloud[k * 4 + 3] = rnd();
        k++;
      }
    }
    inst.setAttribute('aCloud', new THREE.InstancedBufferAttribute(aCloud, 4));
    mesh.frustumCulled = false;
    mesh.renderOrder = 4;
    this.mesh = mesh;
    world.scene.add(mesh);
    this.drift = new THREE.Vector2();
    this.wind = new THREE.Vector2(3.2, 1.4);
  }

  update(dt) {
    this.drift.addScaledVector(this.wind, dt);
    this.mat.uniforms.uDrift.value.copy(this.drift);
  }
}
