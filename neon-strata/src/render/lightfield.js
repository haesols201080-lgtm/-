// "Light field": a top-down HDR texture of every neon / street emitter in the city (rgb) plus a sky
// openness term (a). Sampled by all world shaders for coloured light spill, fog glow and cloud under-lighting.
import * as THREE from 'three';
import { U, WORLD_EXTENT } from './env.js';

export class LightField {
  constructor(size = 2048) {
    this.size = size;
    this.lights = []; // x, z, radius, r, g, b
    this.occ = [];    // x, z, radius, strength
    this.rt = new THREE.WebGLRenderTarget(size, size, {
      type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: false,
      minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: true,
      wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping,
    });
    U.uLightMap.value = this.rt.texture;
  }
  // colour as linear rgb * intensity; radius in metres
  add(x, z, radius, r, g, b) { this.lights.push(x, z, radius, r, g, b); }
  occlude(x, z, radius, strength) { this.occ.push(x, z, radius, strength); }

  _mesh(data, stride, isLight) {
    const n = data.length / stride;
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    const arr = new Float32Array(data);
    const ib = new THREE.InstancedInterleavedBuffer(arr, stride);
    g.setAttribute('aXZR', new THREE.InterleavedBufferAttribute(ib, 3, 0));
    g.setAttribute('aCol', new THREE.InterleavedBufferAttribute(ib, isLight ? 3 : 1, 3));
    g.instanceCount = n;
    const mat = new THREE.ShaderMaterial({
      depthTest: false, depthWrite: false, transparent: true, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
      blendSrc: isLight ? THREE.OneFactor : THREE.ZeroFactor, blendDst: THREE.OneFactor,
      blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: isLight ? THREE.OneFactor : THREE.SrcAlphaFactor,
      uniforms: { uScale: { value: 2 / WORLD_EXTENT } },
      vertexShader: /* glsl */ `
        attribute vec3 aXZR; attribute ${isLight ? 'vec3' : 'float'} aCol; uniform float uScale;
        varying vec2 vP; varying vec3 vC;
        void main(){ vP = position.xy; vC = vec3(aCol);
          vec2 p = (aXZR.xy + position.xy * aXZR.z) * uScale; gl_Position = vec4(p.x, p.y, 0.0, 1.0); }`,
      fragmentShader: isLight ? /* glsl */ `
        varying vec2 vP; varying vec3 vC;
        void main(){ float d = dot(vP, vP); float f = max(0.0, 1.0 - d); f = f * f / (1.0 + d * 6.0); gl_FragColor = vec4(vC * f, 1.0); }` : /* glsl */ `
        varying vec2 vP; varying vec3 vC;
        void main(){ float d = length(vP); float f = smoothstep(1.0, 0.25, d); gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0 - vC.x * f); }`,
    });
    const m = new THREE.Mesh(g, mat); m.frustumCulled = false;
    return m;
  }

  bake(renderer) {
    const scene = new THREE.Scene();
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const meshes = [];
    if (this.occ.length) meshes.push(this._mesh(this.occ, 4, false));
    if (this.lights.length) meshes.push(this._mesh(this.lights, 6, true));
    for (const m of meshes) scene.add(m);
    const prev = renderer.getRenderTarget();
    const pc = renderer.getClearColor(new THREE.Color()), pa = renderer.getClearAlpha();
    renderer.setRenderTarget(this.rt);
    renderer.setClearColor(0x000000, 1); renderer.clear();
    renderer.render(scene, cam);
    renderer.setRenderTarget(prev); renderer.setClearColor(pc, pa);
    for (const m of meshes) { m.geometry.dispose(); m.material.dispose(); }
    this.count = this.lights.length / 6;
  }
}
