// Rain that wraps around the camera and picks up neon colour from the light field, plus steam / smoke /
// flare particles rising from vents, stalls, stacks and cooling towers.
import * as THREE from 'three';
import { U, NS_COMMON } from '../render/env.js';
import { RNG } from '../core/rng.js';

export function createRain(quality) {
  const n = quality.rain; const rng = new RNG(4242);
  const base = new Float32Array(n * 2 * 4);
  for (let i = 0; i < n; i++) { const x = rng.next(), y = rng.next(), z = rng.next(), h = rng.next(); for (let k = 0; k < 2; k++) { const o = (i * 2 + k) * 4; base[o] = x; base[o + 1] = y; base[o + 2] = z; base[o + 3] = h + k * 2; } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 2 * 3), 3)); g.setAttribute('aBase', new THREE.BufferAttribute(base, 4));
  const uniforms = { ...U, uLocal: { value: 1 } };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: /* glsl */ `
      ${NS_COMMON}
      attribute vec4 aBase; uniform float uLocal; varying vec3 vC;
      void main(){
        float end = step(1.5, aBase.w); float h = aBase.w - end * 2.0;
        vec3 box = vec3(56.0, 40.0, 56.0);
        float speed = 24.0 + h * 12.0; vec3 vel = vec3(2.5 + sin(uTime * 0.2) * 2.0, -speed, 1.2);
        vec3 q = aBase.xyz * box + vel * uTime;
        vec3 rel = mod(q - cameraPosition + box * 0.5, box) - box * 0.5;
        vec3 wp = cameraPosition + rel + vel * 0.016 * end;
        float on = step(h, uRain * uLocal) * step(wp.y, uCloud.x - 20.0) * step(0.2, wp.y);
        vec3 spill = nsLightField(wp, 2.0).rgb * exp(-max(wp.y - 7.0, 0.0) / 16.0);
        float d = length(rel);
        vC = (vec3(0.55, 0.65, 0.8) * (0.02 + uAmbSky * 0.6) + spill * 0.22) * on * smoothstep(30.0, 12.0, d) * smoothstep(0.6, 2.5, d) * (0.5 + 0.5 * end);
        gl_Position = on > 0.5 ? projectionMatrix * viewMatrix * vec4(wp, 1.0) : vec4(2.0, 2.0, 2.0, 1.0);
      }`,
    fragmentShader: /* glsl */ `varying vec3 vC; void main(){ gl_FragColor = vec4(vC, 1.0); }`,
  });
  const mesh = new THREE.LineSegments(g, mat); mesh.frustumCulled = false; mesh.renderOrder = 60;
  return { mesh, uniforms };
}

export function createParticles(emitters) {
  const rng = new RNG(977); const rows = [];
  for (const e of emitters) { const n = e.big ? 9 : 4; for (let i = 0; i < n; i++) rows.push(e.x, e.y, e.z, e.s, (i + rng.next() * 0.5) / n, e.fire ? 1 : 0, e.big || 0, rng.next()); }
  const count = rows.length / 8;
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3)); g.setIndex([0, 1, 2, 0, 2, 3]);
  const ib = new THREE.InstancedInterleavedBuffer(new Float32Array(rows), 8);
  g.setAttribute('aPos', new THREE.InterleavedBufferAttribute(ib, 4, 0)); g.setAttribute('aInfo', new THREE.InterleavedBufferAttribute(ib, 4, 4)); g.instanceCount = count;
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...U }, transparent: true, depthWrite: false, fog: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    vertexShader: /* glsl */ `
      ${NS_COMMON}
      attribute vec4 aPos; attribute vec4 aInfo; varying vec2 vUv; varying vec4 vCol; varying vec3 vEm; varying float vSeed;
      void main(){
        float big = aInfo.z; float rate = big > 1.5 ? 0.018 : (big > 0.5 ? 0.035 : 0.16);
        float age = fract(uTime * rate * (0.8 + 0.4 * aInfo.w) + aInfo.x);
        float rise = big > 1.5 ? 520.0 : (big > 0.5 ? 150.0 : 9.0);
        vec3 wind = vec3(0.9 + sin(uTime * 0.05) * 0.4, 0.0, 0.35) * rise * (0.25 + 0.5 * age);
        vec3 c = aPos.xyz + vec3(0.0, rise * age * (1.0 - 0.3 * age), 0.0) + wind * age + vec3(sin(aInfo.w * 40.0 + uTime * 0.6), 0.0, cos(aInfo.w * 31.0 + uTime * 0.5)) * aPos.w * 0.5 * age;
        float size = aPos.w * (0.8 + age * (big > 0.5 ? 5.5 : 3.2));
        vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]); vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        float rot = aInfo.w * 6.28 + age * (aInfo.w - 0.5) * 2.0; vec2 pr = vec2(position.x * cos(rot) - position.y * sin(rot), position.x * sin(rot) + position.y * cos(rot));
        vec3 wp = c + (right * pr.x + up * pr.y) * size;
        vUv = position.xy; vSeed = aInfo.w;
        float fade = smoothstep(0.0, 0.12, age) * (1.0 - smoothstep(0.45, 1.0, age));
        vec3 spill = nsLightField(c, 3.0).rgb * exp(-max(c.y - 7.0, 0.0) / 30.0);
        float hi = smoothstep(uCloud.x, uCloud.y, c.y);
        vec3 lit = mix(uAmbGround, uAmbSky, 0.7) * mix(1.6, 4.0, hi) + spill * 0.9 + uSunColor * nsSunVis(c.y) * 0.12 + uFogLow * 0.8;
        float alpha = fade * (big > 0.5 ? 0.42 : 0.22);
        vCol = vec4(lit * mix(vec3(0.7), vec3(0.42, 0.4, 0.38), step(0.5, big)), alpha);
        vEm = aInfo.y > 0.5 ? vec3(1.0, 0.36, 0.06) * 5.0 * (1.0 - smoothstep(0.0, 0.16, age)) : vec3(0.0);
        float T = exp(-nsFogOD(cameraPosition, c)); vCol.a *= T; vEm *= T;
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      ${NS_COMMON}
      varying vec2 vUv; varying vec4 vCol; varying vec3 vEm; varying float vSeed;
      void main(){
        float r = length(vUv); if (r > 1.0) discard;
        float n = nsNoise(vUv * 0.35 + vSeed * 7.0).r * 0.6 + nsNoise(vUv * 0.9 + vSeed * 3.0).g * 0.4;
        float a = smoothstep(1.0, 0.25, r) * smoothstep(0.15, 0.7, n + (1.0 - r) * 0.5);
        gl_FragColor = vec4(vCol.rgb * vCol.a * a + vEm * a * a, vCol.a * a);
      }`,
  });
  const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; mesh.renderOrder = 45;
  return { mesh, count };
}
