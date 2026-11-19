// Scene lighting model on top of three's PBR:
//  * sky-visibility field: canopy density + "roof height" (tree crowns, the cave ceiling) baked into a world-space
//    texture. Indirect sky/IBL light is occluded under canopies and inside the cave, so shade is properly darker
//    than sun patches and the tunnel is dark (direct sun is handled by the shadow map, which also gives dappled light).
//  * sun-direction fog in-scattering (atmosphere glows toward the sun, as in a hazy forest).
//  * eye adaptation: exposure follows how open the sky is around the camera.
import * as THREE from 'three';
import { clamp } from './util.js';
import { OUTCROP } from './layout.js';

const CROWN = { pine: { r: 3.4, bottom: 11, top: 20, d: 0.55 }, fir: { r: 2.8, bottom: 1.6, top: 11, d: 0.6 } };

export class Lighting {
  constructor(ctx, world) {
    this.ctx = ctx; this.world = world;
    const N = this.N = 192; this.size = 96; this.half = 48;
    this.occ = new Float32Array(N * N); this.roof = new Float32Array(N * N).fill(60);
    const cell = this.size / N;
    // canopy: union of crowns (1 - prod(1 - d))
    const keep = new Float32Array(N * N).fill(1);
    for (const t of world.treeSpots) {
      const c = t.t.startsWith('fir') ? CROWN.fir : CROWN.pine;
      const R = c.r * t.s * (t.cs || 1), bottom = t.y + c.bottom * t.s * (t.h || 1);
      const i0 = Math.max(0, Math.floor((t.x - R + this.half) / cell)), i1 = Math.min(N - 1, Math.ceil((t.x + R + this.half) / cell));
      const j0 = Math.max(0, Math.floor((t.z - R + this.half) / cell)), j1 = Math.min(N - 1, Math.ceil((t.z + R + this.half) / cell));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const x = -this.half + (i + 0.5) * cell, z = -this.half + (j + 0.5) * cell;
        const d = Math.hypot(x - t.x, z - t.z) / R; if (d >= 1) continue;
        const k = j * N + i;
        keep[k] *= 1 - c.d * (1 - d * d);
        this.roof[k] = Math.min(this.roof[k], bottom);
      }
    }
    for (let k = 0; k < N * N; k++) this.occ[k] = 1 - keep[k];
    // cave: rays upward from the tunnel floor level hitting the outcrop ceiling
    const R = ctx.RAPIER, W = ctx.physics;
    const ext = 10;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = -this.half + (i + 0.5) * cell, z = -this.half + (j + 0.5) * cell;
      if (Math.abs(x - OUTCROP.x) > ext || Math.abs(z - OUTCROP.z) > ext) continue;
      for (const y of [OUTCROP.base + 0.35, OUTCROP.base + 0.75]) {
        const hit = W.castRay(new R.Ray({ x, y, z }, { x: 0, y: 1, z: 0 }), 6, true, R.QueryFilterFlags.EXCLUDE_SENSORS, undefined, undefined, undefined,
          (c) => c.userData?.kind === 'outcrop');
        if (hit && hit.timeOfImpact > 0.05) {
          const k = j * N + i;
          this.occ[k] = Math.max(this.occ[k], 0.93);
          this.roof[k] = Math.min(this.roof[k], y + hit.timeOfImpact - 0.05);
          break;
        }
      }
    }
    // soften (one box blur pass) so occlusion fades in naturally at crown and tunnel edges
    const blur = (a) => { const b = new Float32Array(a.length);
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { let s = 0, n = 0;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= N || jj >= N) continue; s += a[jj * N + ii]; n++; }
        b[j * N + i] = s / n; } return b; };
    this.occ = blur(this.occ);
    const data = new Uint8Array(N * N * 4);
    for (let k = 0; k < N * N; k++) { data[k * 4] = clamp(this.occ[k], 0, 1) * 255; data[k * 4 + 1] = clamp(this.roof[k] / 60, 0, 1) * 255; data[k * 4 + 3] = 255; }
    this.tex = new THREE.DataTexture(data, N, N); this.tex.magFilter = THREE.LinearFilter; this.tex.minFilter = THREE.LinearFilter; this.tex.needsUpdate = true;
    this.uniforms = {
      tSkyOcc: { value: this.tex }, uOccB: { value: new THREE.Vector4(-this.half, -this.half, 1 / this.size, 1 / this.size) },
      uOccK: { value: 1 }, uSunDirW: { value: ctx.sunDir }, uScatter: { value: new THREE.Color(0.55, 0.42, 0.26) },
      uMist: { value: 0.03 }, uMistY: { value: -0.1 }, uMistColor: { value: new THREE.Color().setRGB(0.42, 0.45, 0.42, THREE.SRGBColorSpace) },
    };
    this.exposure = 1;
  }

  // CPU lookup of sky visibility at a point (0 = fully covered, 1 = open sky)
  visibility(x, y, z) {
    const N = this.N, cell = this.size / N;
    const i = clamp(Math.floor((x + this.half) / cell), 0, N - 1), j = clamp(Math.floor((z + this.half) / cell), 0, N - 1), k = j * N + i;
    const under = clamp((this.roof[k] + 0.5 - y) / 1.0, 0, 1);
    return 1 - this.occ[k] * under;
  }

  // inject into every PBR material in the scene (incl. ones already patched)
  patchScene(scene) {
    const seen = new Set();
    scene.traverse((o) => {
      if (!o.material) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (seen.has(m) || !(m.isMeshStandardMaterial)) continue;
        seen.add(m); this.patch(m);
      }
    });
  }
  patch(m) {
    if (m.userData.litPatched) return; m.userData.litPatched = true;
    // capture the material's own program key now: the default key is derived from onBeforeCompile's source,
    // which is about to be replaced (otherwise unrelated materials would share one program)
    const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey ? String(m.customProgramCacheKey()) : '';
    const U = this.uniforms;
    m.onBeforeCompile = (sh, r) => {
      if (prev) prev.call(m, sh, r);
      Object.assign(sh.uniforms, U);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          #define LIT_SKY 1
          uniform sampler2D tSkyOcc; uniform vec4 uOccB; uniform float uOccK; uniform vec3 uSunDirW; uniform vec3 uScatter; uniform float uMist, uMistY; uniform vec3 uMistColor;
          vec3 litWorldPos(){ vec3 mv = -vViewPosition; return transpose(mat3(viewMatrix)) * (mv - viewMatrix[3].xyz); }
          float skyVisibility(vec3 wp){
            vec4 o = texture2D(tSkyOcc, (wp.xz - uOccB.xy) * uOccB.zw);
            float roof = o.g * 60.0;
            float under = smoothstep(roof + 0.5, roof - 0.5, wp.y);
            return 1.0 - o.r * under * uOccK;
          }`)
        .replace('#include <lights_fragment_maps>', `#include <lights_fragment_maps>
          {
            float sv = skyVisibility(litWorldPos());
            float svd = mix(0.08, 1.0, sv);
            irradiance *= svd; iblIrradiance *= svd;
            radiance *= mix(0.12, 1.0, sv);
            #ifdef USE_CLEARCOAT
              clearcoatRadiance *= mix(0.12, 1.0, sv);
            #endif
          }`)
        .replace('#include <fog_fragment>', `#ifdef USE_FOG
          {
            #ifdef FOG_EXP2
              float fogFactor = 1.0 - exp(- fogDensity * fogDensity * vFogDepth * vFogDepth);
            #else
              float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
            #endif
            vec3 wpF = litWorldPos(); vec3 rd = wpF - cameraPosition; float rl = length(rd);
            vec3 vdir = rd / max(rl, 1e-4);
            float sd = pow(max(dot(vdir, uSunDirW), 0.0), 5.0);
            gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor + uScatter * sd, fogFactor);
            // low ground mist: exponential height fog integrated along the view ray (pools in hollows and over water)
            float hb = 1.5, h0 = cameraPosition.y - uMistY, bdy = hb * rd.y;
            float integ = abs(bdy) > 1e-3 ? (1.0 - exp(-bdy)) / bdy : 1.0;
            float mist = 1.0 - exp(-uMist * exp(-hb * h0) * integ * rl);
            gl_FragColor.rgb = mix(gl_FragColor.rgb, uMistColor + uScatter * sd * 0.6, clamp(mist, 0.0, 0.55));
          }
          #endif`);
    };
    m.customProgramCacheKey = () => prevKey + '|lit';
    m.needsUpdate = true;
  }

  // eye adaptation toward the light level around the camera / player
  update(dt, renderer, base, cam, player) {
    const v = Math.min(this.visibility(cam.x, cam.y, cam.z) * 0.5 + this.visibility(player.x, player.y + 0.2, player.z) * 0.5, 1);
    const target = base * (1 + 0.3 * (1 - v));      // the eye adapts only a little (deep shade must stay darker than sun)
    this.exposure += (target - this.exposure) * (1 - Math.exp(-dt / 1.4));
    renderer.toneMappingExposure = this.exposure;
    return v;
  }
}
