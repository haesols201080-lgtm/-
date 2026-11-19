// Interactive water: a GPU height-field wave simulation in a window that follows the player (ripples, wakes,
// splashes that reflect off the banks), a water material that refracts the bed (transmission on medium/high,
// alpha blending on low) with depth-based absorption, shore foam and crest foam, plus caustics for the bed.
import * as THREE from 'three';

const QUAD_VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const MAX_DROPS = 24;

export class WaterSim {
  constructor(renderer, terrain, { N = 256, size = 10 } = {}) {
    this.renderer = renderer; this.terrain = terrain; this.N = N; this.size = size; this.texel = size / N;
    const opt = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping };
    this.rt = [new THREE.WebGLRenderTarget(N, N, opt), new THREE.WebGLRenderTarget(N, N, opt)];
    this.cur = 0;
    // water mask of the whole world (1 = water), so waves stop and reflect at the banks
    const R = terrain.res + 1, data = new Uint8Array(R * R * 4);
    for (let j = 0; j < R; j++) for (let i = 0; i < R; i++) { const k = j * R + i; data[k * 4] = terrain.h[k] < terrain.waterY - 0.01 ? 255 : 0; data[k * 4 + 3] = 255; }
    this.mask = new THREE.DataTexture(data, R, R); this.mask.magFilter = THREE.LinearFilter; this.mask.needsUpdate = true;
    this.drops = Array.from({ length: MAX_DROPS }, () => new THREE.Vector4());
    this.pending = [];
    this.origin = new THREE.Vector2(0, 0); // world xz of the window's (0,0) corner
    this.mat = new THREE.ShaderMaterial({
      vertexShader: QUAD_VERT,
      uniforms: {
        tPrev: { value: null }, uShift: { value: new THREE.Vector2() }, uTexel: { value: 1 / N }, uDrops: { value: this.drops }, uDropN: { value: 0 },
        tMask: { value: this.mask }, uOrigin: { value: this.origin }, uSize: { value: size },
        uMaskB: { value: new THREE.Vector4(-terrain.half, -terrain.half, 1 / terrain.size, 1 / terrain.size) },
      },
      fragmentShader: /* glsl */`
        uniform sampler2D tPrev, tMask; uniform vec2 uShift, uOrigin; uniform float uTexel, uSize; uniform vec4 uDrops[${MAX_DROPS}]; uniform int uDropN; uniform vec4 uMaskB;
        varying vec2 vUv;
        vec3 S(vec2 uv){ uv += uShift; if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return vec3(0.0); return texture2D(tPrev, uv).rgb; }
        void main(){
          vec3 c = S(vUv);
          vec3 sx0 = S(vUv + vec2(uTexel, 0.0)), sx1 = S(vUv - vec2(uTexel, 0.0)), sz0 = S(vUv + vec2(0.0, uTexel)), sz1 = S(vUv - vec2(0.0, uTexel));
          float lap = sx0.r + sx1.r + sz0.r + sz1.r;
          float h = lap * 0.5 - c.g;
          h *= 0.984;
          // foam (b): whipped up by impacts and by steep, breaking ripples; it spreads a little and slowly pops
          float foam = mix(c.b, (sx0.b + sx1.b + sz0.b + sz1.b) * 0.25, 0.18) * 0.9955;
          foam += smoothstep(0.012, 0.05, abs(lap * 0.25 - c.r)) * 0.03;
          vec2 wp = uOrigin + vUv * uSize;
          for (int i = 0; i < ${MAX_DROPS}; i++) {
            if (i >= uDropN) break;
            vec4 d = uDrops[i]; vec2 q = wp - d.xy;
            float g = exp(-dot(q, q) / (d.z * d.z));
            h += d.w * g;
            foam += abs(d.w) * 9.0 * exp(-dot(q, q) / (d.z * d.z * 2.2));
          }
          float wet = step(0.5, texture2D(tMask, (wp - uMaskB.xy) * uMaskB.zw).r);
          h *= wet;
          vec2 e = min(vUv, 1.0 - vUv); float edge = smoothstep(0.0, 0.04, min(e.x, e.y)); h *= edge;
          gl_FragColor = vec4(clamp(h, -0.2, 0.2), c.r, clamp(foam, 0.0, 1.0) * wet * edge, 1.0);
        }`,
      depthTest: false, depthWrite: false,
    });
    this.scene = new THREE.Scene(); this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat); this.quad.frustumCulled = false; this.scene.add(this.quad);
    this.acc = 0;
    this.uniforms = { tSim: { value: this.rt[0].texture }, uSimOrigin: { value: this.origin.clone() }, uSimSize: { value: size }, uSimTexel: { value: 1 / N } };
    // clear both targets
    const prev = renderer.getRenderTarget();
    for (const r of this.rt) { renderer.setRenderTarget(r); renderer.setClearColor(0x000000, 1); renderer.clear(); }
    renderer.setRenderTarget(prev);
  }
  // strength > 0 raises, < 0 pushes the surface down; radius in metres
  drop(x, z, radius, strength) { if (this.pending.length < MAX_DROPS) this.pending.push([x, z, radius, strength]); }

  update(dt, center) {
    // keep the window centred on the player, snapped to whole texels so the field can be scrolled exactly
    const t = this.texel, half = this.size / 2;
    const ox = Math.round((center.x - half) / t) * t, oz = Math.round((center.z - half) / t) * t;
    let shiftX = (ox - this.origin.x) / this.size, shiftZ = (oz - this.origin.y) / this.size;
    if (Math.abs(shiftX) > 0.5 || Math.abs(shiftZ) > 0.5) { shiftX = 0; shiftZ = 0; } // teleport: start fresh-ish
    this.origin.set(ox, oz);
    this.acc += Math.min(dt, 0.1);
    const STEP = 1 / 45;
    const r = this.renderer, prevRT = r.getRenderTarget(), prevAuto = r.autoClear;
    r.autoClear = false;
    let first = true;
    while (this.acc >= STEP) {
      this.acc -= STEP;
      const n = first ? Math.min(this.pending.length, MAX_DROPS) : 0;
      for (let i = 0; i < n; i++) { const d = this.pending[i]; this.drops[i].set(d[0], d[1], d[2], d[3]); }
      this.mat.uniforms.uDropN.value = n;
      this.mat.uniforms.uShift.value.set(first ? shiftX : 0, first ? shiftZ : 0);
      this.mat.uniforms.tPrev.value = this.rt[this.cur].texture;
      const next = 1 - this.cur;
      r.setRenderTarget(this.rt[next]); r.render(this.scene, this.cam);
      this.cur = next;
      if (first) { this.pending.length = 0; first = false; }
    }
    r.setRenderTarget(prevRT); r.autoClear = prevAuto;
    this.uniforms.tSim.value = this.rt[this.cur].texture;
    this.uniforms.uSimOrigin.value.copy(this.origin);
  }
}

export const CAUSTICS_GLSL = /* glsl */`
float causticsAt(vec2 p, float t){
  vec2 q = p * 2.2; float c = 0.0;
  for (int i = 0; i < 3; i++) {
    q += vec2(sin(q.y * 1.37 + t * 0.9 + float(i)), cos(q.x * 1.21 - t * 0.7 + float(i) * 1.7)) * 0.42;
    c += pow(clamp(1.0 - abs(sin(q.x) + sin(q.y)) * 0.55, 0.0, 1.0), 7.0);
  }
  return c / 3.0;
}`;

// water surface material
export function makeWaterMaterial(tier, assets, sim) {
  const refract = tier.rich; // transmission (screen-space refraction) on medium/high
  const u = { uTime: { value: 0 }, tN: { value: assets.tex.water }, ...sim.uniforms };
  const mat = new THREE.MeshPhysicalMaterial(refract ? {
    color: 0xffffff, roughness: 0.02, metalness: 0, transmission: 1, thickness: 0.4, ior: 1.33,
    attenuationColor: new THREE.Color(0.42, 0.55, 0.42), attenuationDistance: 0.55, envMapIntensity: 1.1, specularIntensity: 1,
  } : { color: 0x15261d, roughness: 0.03, metalness: 0, transparent: true, depthWrite: false, envMapIntensity: 1.1, specularIntensity: 1 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float depth; varying float vDepth; varying vec3 vWP;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvDepth = depth; vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    // screen-space refraction never reaches far across the screen (or off its edge): limits the offset of the
    // refracted lookup, which otherwise smears into vertical streaks when the camera is close to the water
    sh.fragmentShader = sh.fragmentShader.replace('#include <transmission_pars_fragment>',
      THREE.ShaderChunk.transmission_pars_fragment.replaceAll('refractionCoords /= 2.0;', `refractionCoords /= 2.0;
        {
          vec4 p0 = projMatrix * viewMatrix * vec4(position, 1.0); vec2 uv0 = p0.xy / p0.w * 0.5 + 0.5;
          vec2 dR = refractionCoords - uv0; float lR = length(dR);
          dR *= min(1.0, 0.045 / max(lR, 1e-5));
          // a lookup that would leave the screen is mirrored back inside (clamping it, or shrinking it to the edge,
          // makes every pixel of a column read the same edge row: vertical streaks)
          vec2 tR = uv0 + dR;
          if (tR.x < 0.002 || tR.x > 0.998) dR.x = -dR.x;
          if (tR.y < 0.002 || tR.y > 0.998) dR.y = -dR.y;
          refractionCoords = clamp(uv0 + dR, vec2(0.002), vec2(0.998));
        }`));
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        uniform float uTime; uniform sampler2D tN, tSim; uniform vec2 uSimOrigin; uniform float uSimSize, uSimTexel;
        varying float vDepth; varying vec3 vWP;
        float simH(vec2 uv){ return texture2D(tSim, uv).r; }
        float WFOAM;`)
      .replace('#include <normal_fragment_maps>', `
        vec2 fl = vec2(0.05, 0.02) * uTime;
        vec3 n1 = texture2D(tN, vWP.xz * 0.45 + fl).xyz * 2.0 - 1.0;
        vec3 n2 = texture2D(tN, vWP.xz * 1.3 - fl * 1.7 + 0.37).xyz * 2.0 - 1.0;
        vec2 grad = (n1.xy + n2.xy) * 0.09;
        // interactive ripples from the simulation
        vec2 suv = (vWP.xz - uSimOrigin) / uSimSize;
        float inside = step(0.0, suv.x) * step(0.0, suv.y) * step(suv.x, 1.0) * step(suv.y, 1.0);
        vec2 e = min(suv, 1.0 - suv); float fade = inside * smoothstep(0.0, 0.08, min(e.x, e.y));
        float hc = simH(suv);
        vec2 sg = vec2(simH(suv + vec2(uSimTexel, 0.0)) - simH(suv - vec2(uSimTexel, 0.0)), simH(suv + vec2(0.0, uSimTexel)) - simH(suv - vec2(0.0, uSimTexel)));
        grad += -sg * 14.0 * fade;
        vec3 nn = normalize(vec3(grad, 1.0));
        normal = normalize((viewMatrix * vec4(nn.x, nn.z, nn.y, 0.0)).xyz);
        float simFoam = texture2D(tSim, suv).b * fade;
        float shoreF = smoothstep(0.06, 0.0, vDepth) * 0.55;
        // bubble clusters: the foam amount thresholds two scales of noise, so it breaks into lacy patches and specks
        float fn = texture2D(tN, vWP.xz * 3.1 + fl * 3.0 + sg * 0.4).r * 0.6 + texture2D(tN, vWP.xz * 9.7 - fl * 2.0).g * 0.4;
        float sF = smoothstep(1.0 - simFoam * 1.1, 1.18 - simFoam, fn + 0.12);
        float shF = smoothstep(0.4, 0.75, fn + shoreF * 0.5) * shoreF;
        WFOAM = clamp(max(sF, shF), 0.0, 1.0);`)
      .replace('#include <lights_physical_fragment>', THREE.ShaderChunk.lights_physical_fragment.replace('material.thickness = thickness;',
        // light travels further through deep water (greener, darker); shallow edges stay clear; thin right at the lens
        'material.thickness = clamp(vDepth * 1.4, 0.03, 1.6) * mix(0.35, 1.0, smoothstep(0.25, 2.2, length(vViewPosition)));'))
      .replace('#include <opaque_fragment>', refract ? `
        // foam is a white diffuse layer: light it with the same direct + ambient diffuse light as the water's white base
        outgoingLight = mix(outgoingLight, vec3(0.86, 0.9, 0.88) * (reflectedLight.directDiffuse + reflectedLight.indirectDiffuse), WFOAM * 0.92);
        #include <opaque_fragment>` : `
        float fres = pow(1.0 - clamp(abs(dot(normalize(vViewPosition), normal)), 0.0, 1.0), 4.0);
        float a = clamp(smoothstep(0.0, 0.7, vDepth) * 0.72 + 0.08 + fres * 0.5, 0.0, 0.97);
        outgoingLight = mix(outgoingLight, vec3(0.82, 0.86, 0.84), WFOAM * 0.85);
        gl_FragColor = vec4(outgoingLight, max(a, WFOAM * 0.9));`);
  };
  mat.customProgramCacheKey = () => 'water' + (refract ? 'T' : 'A');
  mat.userData.uniforms = u;
  return mat;
}
