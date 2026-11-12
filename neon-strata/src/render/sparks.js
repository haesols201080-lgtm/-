// Far-field "city glitter": every emitter in the city as an additive point sprite that fades in with distance.
import * as THREE from 'three';
import { U, NS_COMMON } from './env.js';

export function createSparks(data /* [x,y,z,r,g,b,size]... */) {
  const n = data.length / 7;
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { pos[i * 3] = data[i * 7]; pos[i * 3 + 1] = data[i * 7 + 1]; pos[i * 3 + 2] = data[i * 7 + 2]; col[i * 4] = data[i * 7 + 3]; col[i * 4 + 1] = data[i * 7 + 4]; col[i * 4 + 2] = data[i * 7 + 5]; col[i * 4 + 3] = data[i * 7 + 6]; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aCol', new THREE.BufferAttribute(col, 4));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { ...U, uScale: { value: 600 }, uIntensity: { value: 1 } },
    vertexShader: /* glsl */ `
      ${NS_COMMON}
      attribute vec4 aCol; uniform float uScale; varying vec3 vC;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float d = max(-mv.z, 1.0);
        float px = aCol.a * uScale / d;
        float fade = smoothstep(140.0, 620.0, d);
        float sz = clamp(px, 1.6, 16.0);
        float k = min(1.0, px / 1.6);
        float tw = 0.8 + 0.2 * sin(uTime * (1.0 + fract(position.x * 0.37) * 3.0) + position.z);
        vC = aCol.rgb * fade * k * tw * exp(-nsFogOD(cameraPosition, position)) * mix(0.12, 1.0, uNight);
        gl_PointSize = sz; gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vC; uniform float uIntensity;
      void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; float a = max(0.0, 1.0 - r); gl_FragColor = vec4(vC * a * a * uIntensity, 1.0); }`,
  });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.renderOrder = 40; pts.matrixAutoUpdate = false;
  return pts;
}
