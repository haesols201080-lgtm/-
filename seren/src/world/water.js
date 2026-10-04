// 바다: 카메라를 따라다니는 방사형 격자. 하늘을 비추고, 밤에는 물속 빛알갱이가 반짝입니다.
import * as THREE from 'three';
import { NOISE_GLSL, ATMOS_PARS, CURVE_GLSL } from './shaders.js';
import { atmosUniforms } from './atmosphere.js';

const vert = /* glsl */ `
${CURVE_GLSL}
varying vec3 vWorld;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * vec4(curveWorld(wp.xyz), 1.0);
  // 먼 거리에서 해안선이 깜박이지 않도록 물을 아주 조금 앞으로 당긴다
  float d = length(wp.xyz - cameraPosition);
  gl_Position.z -= 3.0 * 2.0 * 0.8 / max(d * d, 1.0) * gl_Position.w * step(300.0, d);
}`;

const frag = /* glsl */ `
${NOISE_GLSL}
${ATMOS_PARS}
uniform vec3 uWaterDeep;
uniform vec3 uWaterShallow;
varying vec3 vWorld;

vec2 waveGrad(vec2 p, float t) {
  vec2 g = vec2(0.0);
  vec2 d1 = normalize(vec2(1.0, 0.35)), d2 = normalize(vec2(-0.4, 1.0)), d3 = normalize(vec2(0.7, -0.8));
  g += d1 * cos(dot(p, d1) * 0.11 + t * 1.1) * 0.11 * 0.5;
  g += d2 * cos(dot(p, d2) * 0.23 + t * 1.6) * 0.23 * 0.22;
  g += d3 * cos(dot(p, d3) * 0.47 + t * 2.3) * 0.47 * 0.08;
  float e = 0.6;
  vec2 q = p * 0.9 + vec2(t * 0.6, t * 0.3);
  float n0 = vnoise(q), nx = vnoise(q + vec2(e, 0.0)), nz = vnoise(q + vec2(0.0, e));
  g += vec2(nx - n0, nz - n0) / e * 0.35;
  return g;
}

void main() {
  vec3 toCam = cameraPosition - vWorld;
  float dist = length(toCam);
  vec3 V = toCam / dist;
  vec2 g = waveGrad(vWorld.xz, uTime);
  float fade = smoothstep(2500.0, 50.0, dist);
  vec3 N = normalize(vec3(-g.x * fade, 1.0, -g.y * fade));
  float ndv = max(dot(N, V), 0.0);
  float fres = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
  vec3 rd = -V;
  vec3 R = reflect(rd, N);
  R.y = abs(R.y);
  vec3 refl = skyBase(R);
  vec3 body = uWaterDeep * (uAmbTop * 0.9 + uSunColor * 0.22 + uUrLight * 0.45);
  vec3 col = mix(body, refl, fres);
  float spec = pow(max(dot(R, uSunDir), 0.0), 380.0);
  col += uSunColor * spec * 9.0;
  col += uUrLight * pow(max(dot(R, uUrDir), 0.0), 40.0) * 1.5;
  // 밤바다의 빛알갱이
  float sp = smoothstep(0.93, 0.99, vnoise(vWorld.xz * 0.35 + vec2(uTime * 0.2, -uTime * 0.15)));
  col += vec3(0.3, 1.0, 0.9) * sp * uGlow * 0.9 * smoothstep(400.0, 20.0, dist);
  float alpha = mix(0.32, 1.0, fres);
  alpha = mix(alpha, 1.0, smoothstep(1500.0, 6000.0, dist));
  col = applyFog(col, vWorld);
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class Water {
  constructor(scene) {
    const segs = 96;
    const radii = [0];
    let r = 3;
    while (r < 60000) { radii.push(r); r *= 1.16; }
    radii.push(60000);
    const pos = [];
    for (const rr of radii) {
      if (rr === 0) { pos.push(0, 0, 0); continue; }
      for (let s = 0; s < segs; s++) {
        const a = (s / segs) * Math.PI * 2;
        pos.push(Math.cos(a) * rr, 0, Math.sin(a) * rr);
      }
    }
    const idx = [];
    for (let s = 0; s < segs; s++) idx.push(0, 1 + ((s + 1) % segs), 1 + s);
    for (let k = 1; k < radii.length - 1; k++) {
      const a0 = 1 + (k - 1) * segs, b0 = 1 + k * segs;
      for (let s = 0; s < segs; s++) {
        const s1 = (s + 1) % segs;
        idx.push(a0 + s, a0 + s1, b0 + s, a0 + s1, b0 + s1, b0 + s);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    this.material = new THREE.ShaderMaterial({
      uniforms: { ...atmosUniforms, uWaterDeep: { value: new THREE.Color(0x0b3d5a) }, uWaterShallow: { value: new THREE.Color(0x2fb5b0) } },
      vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: true,
    });
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    scene.add(this.mesh);
  }

  update(camPos) {
    this.mesh.position.set(camPos.x, 0, camPos.z);
    // 높이 올라가면 수평선이 멀어진다 → 바다를 넓힌다
    const horizon = Math.sqrt(2 * 1600000 * Math.max(0, camPos.y));
    const k = Math.max(1, (horizon * 1.15) / 60000);
    this.mesh.scale.set(k, 1, k);
  }
}
