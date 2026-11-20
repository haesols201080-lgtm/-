// Terrain: authored height function (hills, carved stream + pond, flattened clearing/paths),
// a PBR splat material blending the Blender-baked texture sets, and a Rapier heightfield collider.
import * as THREE from 'three';
import { makeNoise2D, fbm, smoothstep, clamp, lerp, distToPolyline } from './util.js';
import { WORLD, PATH, PATH2, PATH3, STREAM, POND, START, OUTCROP, GLADE_RIDGE, ridgeEnds } from './layout.js';
import { SHADER_TRI } from './shaders.js';
import { TERRAIN_SCALES } from './assets.js';
import { CAUSTICS_GLSL } from './water.js';

const n2 = makeNoise2D(11), n3 = makeNoise2D(29), n4 = makeNoise2D(53);

export class Terrain {
  constructor() {
    const { size, res } = WORLD;
    this.size = size; this.res = res; this.cell = size / res; this.half = size / 2;
    this.waterY = WORLD.waterY;
    const N = res + 1;
    this.h = new Float32Array(N * N);
    this.water = new Float32Array(N * N); // 1 inside stream/pond
    this.pathM = new Float32Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = -this.half + i * this.cell, z = -this.half + j * this.cell;
      const r = this.heightFn(x, z);
      this.h[j * N + i] = r.h; this.water[j * N + i] = r.w; this.pathM[j * N + i] = r.p;
    }
  }

  heightFn(x, z) {
    let h = 1.25 * fbm(n2, x * 0.022, z * 0.022, 4) + 0.4 * fbm(n3, x * 0.07, z * 0.07, 3) + 0.07 * fbm(n4, x * 0.5, z * 0.5, 3) + 0.035 * fbm(n2, x * 1.1 + 31, z * 1.1, 2);
    // rising rim near the world edge (natural boundary)
    const e = Math.max(Math.abs(x), Math.abs(z));
    h += smoothstep(36, 47, e) * 5.5;
    // north ridge behind the outcrop
    h += smoothstep(-24, -40, z) * 2.2 * (0.6 + 0.4 * fbm(n3, x * 0.05, 3.3, 2));
    // the glade's rocky earth bank: a raised, uneven berm the stones sit in (it fades out into the gate boulders)
    {
      const dr = distToPolyline(x, z, GLADE_RIDGE).d + 0.45 * fbm(n4, x * 0.45, z * 0.45, 2);
      if (dr < 3.2) {
        const H = (1.0 + 0.45 * fbm(n3, x * 0.16 + 7, z * 0.16, 2)) * smoothstep(1.0, 3.0, ridgeEnds(x, z));
        h += H * Math.pow(1 - smoothstep(0.2, 2.8, dr), 1.5);
      }
    }
    // clearing: gentle bowl, flattened
    const dc = Math.hypot(x - START.x, z - (START.z - 1.5));
    h = lerp(h, 0.35 + 0.05 * fbm(n4, x * 0.3, z * 0.3, 2), smoothstep(7.5, 3.5, dc));
    // paths: flattened and very slightly sunk
    const dp = Math.min(distToPolyline(x, z, PATH).d, distToPolyline(x, z, PATH2).d, distToPolyline(x, z, PATH3).d);
    const p = smoothstep(1.1, 0.35, dp + 0.25 * fbm(n4, x * 0.4, z * 0.4, 2));
    h -= p * 0.06;
    // outcrop footprint flattened to its base height
    const dox = x - OUTCROP.x, doz = z - OUTCROP.z;
    const dO = Math.hypot(dox * 0.85, doz);
    h = lerp(h, OUTCROP.base, smoothstep(9.5, 6.0, dO));
    // keep dry land above the water line
    const wy = this.waterY;
    h = Math.max(h, wy + 0.16 + 0.05 * fbm(n4, x * 0.5, z * 0.5, 2));
    // stream channel
    const ds = distToPolyline(x, z, STREAM).d + 0.3 * fbm(n3, x * 0.3, z * 0.3, 2);
    const chan = smoothstep(1.9, 0.55, ds);
    h = lerp(h, wy - 0.34 - 0.06 * fbm(n4, x * 0.8, z * 0.8, 2), chan);
    // pond bowl
    const dpd = Math.hypot(x - POND.x, (z - POND.z) * 1.1) + 0.6 * fbm(n3, x * 0.2, z * 0.2, 2);
    const bowl = smoothstep(POND.r + 1.4, POND.r - 2.2, dpd);
    h = lerp(h, wy - 1.15, bowl);
    const w = Math.max(chan > 0.55 ? 1 : 0, bowl > 0.45 ? 1 : 0);
    return { h, w, p };
  }

  idx(i, j) { return j * (this.res + 1) + i; }

  heightAt(x, z) {
    const fx = clamp((x + this.half) / this.cell, 0, this.res - 1e-4), fz = clamp((z + this.half) / this.cell, 0, this.res - 1e-4);
    const i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j;
    const N = this.res + 1, H = this.h;
    // match Rapier's triangle split (diagonal from (i,j) to (i+1,j+1))
    const h00 = H[j * N + i], h10 = H[j * N + i + 1], h01 = H[(j + 1) * N + i], h11 = H[(j + 1) * N + i + 1];
    if (tx > tz) return h00 + (h10 - h00) * tx + (h11 - h10) * tz;
    return h00 + (h11 - h01) * tx + (h01 - h00) * tz;
  }
  normalAt(x, z) {
    const e = 0.2;
    const hx = this.heightAt(x + e, z) - this.heightAt(x - e, z), hz = this.heightAt(x, z + e) - this.heightAt(x, z - e);
    return new THREE.Vector3(-hx, 2 * e, -hz).normalize();
  }
  isWater(x, z) { return this.heightAt(x, z) < this.waterY - 0.05; }

  // surface type for footsteps: 'dirt'|'leaves'|'pebbles'|'moss'|'rock'
  surfaceAt(x, z) {
    if (this.isWater(x, z)) return 'water';
    const N = this.res + 1;
    const i = clamp(Math.round((x + this.half) / this.cell), 0, this.res), j = clamp(Math.round((z + this.half) / this.cell), 0, this.res);
    const s = this.splat ? this.splat.slice(this.idx(i, j) * 4, this.idx(i, j) * 4 + 4) : [1, 0, 0, 0];
    const k = s.indexOf(Math.max(...s));
    return ['leaves', 'dirt', 'pebbles', 'moss'][k];
  }

  // mossSources: [{x,z,r}] near rocks/trees
  buildMesh(textures, tier, mossSources = []) {
    const N = this.res + 1;
    const geo = new THREE.PlaneGeometry(this.size, this.size, this.res, this.res);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    // PlaneGeometry rotated: vertices ordered row by row along +z after rotation (j from -half to +half? verify)
    const splat = new Float32Array(N * N * 4);
    const aux = new Float32Array(N * N * 2);
    for (let v = 0; v < pos.count; v++) {
      const x = pos.getX(v), z = pos.getZ(v);
      const i = Math.round((x + this.half) / this.cell), j = Math.round((z + this.half) / this.cell);
      const k = this.idx(i, j);
      pos.setY(v, this.h[k]);
      const ds = distToPolyline(x, z, STREAM).d;
      const dpd = Math.hypot(x - POND.x, (z - POND.z) * 1.1);
      const wet = Math.max(smoothstep(2.6, 1.2, ds), smoothstep(POND.r + 2.2, POND.r + 0.4, dpd));
      const path = this.pathM[k];
      let moss = 0;
      for (const m of mossSources) { const d = Math.hypot(x - m.x, z - m.z); if (d < m.r) moss = Math.max(moss, smoothstep(m.r, m.r * 0.35, d)); }
      moss *= 0.5 + 0.5 * smoothstep(-0.2, 0.4, fbm(n3, x * 0.25, z * 0.25, 3));
      const pebbles = smoothstep(0.55, 0.95, wet);
      moss = Math.max(moss * 0.6, smoothstep(0.15, 0.6, wet) * (1 - pebbles));
      const dirt = Math.max(path, 0.25 * smoothstep(0.1, 0.5, fbm(n2, x * 0.11 + 7, z * 0.11, 3))) * (1 - pebbles);
      const litter = Math.max(0, 1 - dirt - pebbles - moss * 0.8);
      const sum = litter + dirt + pebbles + moss || 1;
      const o = v * 4;
      splat[o] = litter / sum; splat[o + 1] = dirt / sum; splat[o + 2] = pebbles / sum; splat[o + 3] = moss / sum;
      // grass coverage: open sunny clearing and path sides, none on paths/water
      const clearing = smoothstep(9, 3, Math.hypot(x - START.x, z - START.z + 1.5));
      const g = clamp((0.25 + 0.55 * smoothstep(-0.15, 0.35, fbm(n4, x * 0.08, z * 0.08, 3)) + clearing * 0.6) * (1 - path * 1.2) * (1 - wet * 1.5), 0, 1);
      aux[v * 2] = g; aux[v * 2 + 1] = wet;
    }
    geo.setAttribute('splat', new THREE.BufferAttribute(splat, 4));
    geo.setAttribute('aux', new THREE.BufferAttribute(aux, 2));
    geo.computeVertexNormals();
    // store splat in grid order for queries
    this.splat = new Float32Array(N * N * 4);
    this.grass = new Float32Array(N * N);
    for (let v = 0; v < pos.count; v++) {
      const x = pos.getX(v), z = pos.getZ(v);
      const i = Math.round((x + this.half) / this.cell), j = Math.round((z + this.half) / this.cell);
      const k = this.idx(i, j);
      for (let c = 0; c < 4; c++) this.splat[k * 4 + c] = splat[v * 4 + c];
      this.grass[k] = aux[v * 2];
    }
    const mat = makeTerrainMaterial(textures, tier);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true; mesh.name = 'terrain';
    this.mesh = mesh; this.material = mat;
    return mesh;
  }

  grassAt(x, z) {
    const i = clamp(Math.round((x + this.half) / this.cell), 0, this.res), j = clamp(Math.round((z + this.half) / this.cell), 0, this.res);
    return this.grass[this.idx(i, j)];
  }

  buildCollider(RAPIER, world) {
    const N = this.res + 1;
    const heights = new Float32Array(N * N);
    // rapier: index = row + col*(nrows+1), rows -> z, cols -> x
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) heights[j + i * N] = this.h[this.idx(i, j)];
    const desc = RAPIER.ColliderDesc.heightfield(this.res, this.res, heights, { x: this.size, y: 1, z: this.size }).setFriction(0.9);
    const c = world.createCollider(desc);
    c.userData = { kind: 'terrain' };
    return c;
  }
}

const WHITE1 = (() => { const t = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); t.needsUpdate = true; return t; })();
export function makeTerrainMaterial(T, tier = {}) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, envMapIntensity: 0.6 });
  const uniforms = {
    tAlb: { value: T.terrainAlb }, tNrm: { value: T.terrainNrm }, tOrm: { value: T.terrainOrm },
    tRockA: { value: T.rock.map }, tRockN: { value: T.rock.normal }, tRockO: { value: T.rock.orm },
    uWet: { value: 0 }, uTime: { value: 0 }, uScales: { value: new THREE.Vector4(...TERRAIN_SCALES) }, uWaterY: { value: WORLD.waterY },
    tMarks: { value: null }, uMarkOrigin: { value: new THREE.Vector2(-999, -999) }, uMarkSize: { value: 12 }, uMarkTexel: { value: 1 / 1024 },
    tGroundAO: { value: WHITE1 }, uGAOB: { value: new THREE.Vector4(0, 0, 0, 0) },
    uRobot: { value: new THREE.Vector4(0, -99, 0, 0) }, uFeet: { value: [new THREE.Vector4(0, -99, 0, 0), new THREE.Vector4(0, -99, 0, 0)] },
  };
  mat.userData.uniforms = uniforms;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.defines = sh.defines || {}; sh.defines.POM_STEPS = tier.pom || 0;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec4 splat; attribute vec2 aux;
        varying vec4 vSplat; varying vec2 vAux; varying vec3 vWPos; varying vec3 vWNrm;`)
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        vSplat = splat; vAux = aux;
        vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vWNrm = normalize(mat3(modelMatrix) * objectNormal);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        precision highp sampler2DArray;
        uniform sampler2DArray tAlb, tNrm, tOrm;
        uniform sampler2D tRockA, tRockN, tRockO;
        uniform float uWet, uTime, uWaterY; uniform vec4 uScales;
        uniform sampler2D tGroundAO; uniform vec4 uGAOB;
        uniform sampler2D tMarks; uniform vec2 uMarkOrigin; uniform float uMarkSize, uMarkTexel; uniform vec4 uRobot; uniform vec4 uFeet[2];
        vec4 MK; vec2 MUV; float MSOFT;
        ${CAUSTICS_GLSL}
        varying vec4 vSplat; varying vec2 vAux; varying vec3 vWPos; varying vec3 vWNrm;
        ${SHADER_TRI}
        float hash21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
        // stochastic-ish anti-tiling: two rotated/offset samples blended by low-frequency noise
        vec2 rot2(vec2 p, float a){ float c=cos(a), s=sin(a); return vec2(c*p.x - s*p.y, s*p.x + c*p.y); }
        float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
          return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x), mix(hash21(i+vec2(0,1)),hash21(i+vec2(1,1)),f.x), f.y); }
        // texture bombing without repetition (after I. Quilez): a smooth world-space noise picks, per patch, a random
        // offset into the scan; neighbouring patches blend along the texture's own contrast, so no grid shows at distance
        vec3 sampleLayer(sampler2DArray t, vec2 uv, float layer, float k){
          float l = k * 8.0, ia = floor(l), f = fract(l);
          vec2 oa = sin(vec2(3.0, 7.0) * ia + layer * 1.7), ob = sin(vec2(3.0, 7.0) * (ia + 1.0) + layer * 1.7);
          vec2 dx = dFdx(uv), dy = dFdy(uv);
          vec3 a = textureGrad(t, vec3(uv + oa, layer), dx, dy).rgb;
          vec3 b = textureGrad(t, vec3(uv + ob, layer), dx, dy).rgb;
          return mix(a, b, smoothstep(0.2, 0.8, f - 0.1 * (a.x + a.y + a.z - b.x - b.y - b.z)));
        }
        vec3 TA; vec3 TN; vec3 TO; float terrainH;
      `)
      .replace('#include <map_fragment>', `
        vec2 tuv0 = vWPos.xz;
        #if POM_STEPS > 0
        // parallax occlusion mapping: the scanned litter, stones and needles get real depth up close
        {
          vec3 V = normalize(cameraPosition - vWPos);
          float dk = 1.0 - smoothstep(5.0, 14.0, length(cameraPosition - vWPos));
          if (dk > 0.01 && V.y > 0.05) {
            vec4 sw = vSplat / max(1e-3, vSplat.x + vSplat.y + vSplat.z + vSplat.w);
            #define POMH(uv) (sw.x * texture(tOrm, vec3((uv) * uScales.x, 0.0)).b + sw.y * texture(tOrm, vec3((uv) * uScales.y, 1.0)).b + sw.z * texture(tOrm, vec3((uv) * uScales.z, 2.0)).b + sw.w * texture(tOrm, vec3((uv) * uScales.w, 3.0)).b)
            vec2 P = V.xz / max(V.y, 0.3) * 0.045 * dk;
            float stepD = 1.0 / float(POM_STEPS);
            vec2 dUV = P * stepD;
            vec2 uv = tuv0; float depth = 0.0; float hmap = 1.0 - POMH(uv); float prevH = hmap;
            for (int i = 0; i < POM_STEPS; i++) {
              if (depth >= hmap) break;
              prevH = hmap; uv -= dUV; depth += stepD; hmap = 1.0 - POMH(uv);
            }
            // refine between the last two samples
            float after = hmap - depth, before = prevH - (depth - stepD);
            float w = after / (after - before + 1e-5);
            tuv0 = mix(uv, uv + dUV, clamp(w, 0.0, 1.0));
          }
        }
        #endif
        float bl = vnoise(vWPos.xz * 0.55) * 0.65 + vnoise(vWPos.xz * 1.3 + 17.0) * 0.35;
        vec4 w = vSplat;
        // height-based blending using each layer's height (orm.b)
        float hL[4];
        vec3 albL[4]; vec3 nrmL[4]; vec3 ormL[4];
        for (int i = 0; i < 4; i++) {
          float L = float(i);
          vec2 tuv = tuv0 * uScales[i];
          albL[i] = sampleLayer(tAlb, tuv, L, bl);
          nrmL[i] = sampleLayer(tNrm, tuv, L, bl);
          ormL[i] = sampleLayer(tOrm, tuv, L, bl);
        }
        float hm = 0.0; float wts[4];
        for (int i = 0; i < 4; i++) { wts[i] = w[i] + ormL[i].b * 0.5 * step(0.001, w[i]); hm = max(hm, wts[i]); }
        float ws = 0.0;
        for (int i = 0; i < 4; i++) { wts[i] = max(wts[i] - hm + 0.18, 0.0); ws += wts[i]; }
        TA = vec3(0); TN = vec3(0); TO = vec3(0);
        for (int i = 0; i < 4; i++) { float k = wts[i] / ws; TA += albL[i] * k; TN += nrmL[i] * k; TO += ormL[i] * k; }
        // rock on steep slopes (triplanar)
        vec3 wn = normalize(vWNrm);
        float slope = 1.0 - wn.y;
        vec3 tw = triWeights(wn);
        float rockK = smoothstep(0.28, 0.45, slope + (vnoise(vWPos.xz*0.7)-0.5)*0.12);
        if (rockK > 0.001) {
          vec3 ra = triSample(tRockA, vWPos, tw, 0.37).rgb;
          vec3 ro = triSample(tRockO, vWPos, tw, 0.37).rgb;
          TA = mix(TA, ra, rockK); TO = mix(TO, ro, rockK);
        }
        // macro color variation breaks repetition at distance
        float macro = vnoise(vWPos.xz * 0.05) * 0.5 + vnoise(vWPos.xz * 0.013) * 0.5;
        TA *= mix(0.86, 1.1, macro);
        {
          // forest-floor patchwork: darker reddish needle duff around trees, greenish moss/understory patches,
          // and the sub-pixel self-shadowing of litter that a mip-mapped texture loses with distance
          float fw = vSplat.x / max(1e-3, vSplat.x + vSplat.y + vSplat.z + vSplat.w);
          float m1 = smoothstep(0.42, 0.78, vnoise(vWPos.xz * 0.11 + 7.3) * 0.7 + vnoise(vWPos.xz * 0.37 - 2.1) * 0.3);
          float m2 = smoothstep(0.52, 0.82, vnoise(vWPos.xz * 0.19 - 3.7) * 0.75 + vnoise(vWPos.xz * 0.6 + 1.3) * 0.25);
          TA = mix(TA, TA * vec3(0.86, 0.72, 0.6), m1 * 0.55 * fw * (1.0 - rockK));
          TA = mix(TA, TA * vec3(0.74, 0.86, 0.56), m2 * 0.45 * fw * (1.0 - rockK));
          float far = smoothstep(5.0, 28.0, length(cameraPosition - vWPos));
          {
            // overgrown ground seen beyond the plants' draw distance takes their colour
            float cov = texture2D(tGroundAO, (vWPos.xz - uGAOB.xy) * uGAOB.zw).g;
            // plus the general low cover (grass tussocks, sorrel, seedlings, moss) every forest floor carries,
            // which is not drawn as geometry that far out
            float fwv = vSplat.x / max(1e-3, vSplat.x + vSplat.y + vSplat.z + vSplat.w);
            cov = max(cov, fwv * (0.35 + 0.45 * smoothstep(0.3, 0.75, vnoise(vWPos.xz * 0.21) * 0.6 + vnoise(vWPos.xz * 0.9 + 3.0) * 0.4)));
            float dv = smoothstep(9.0, 24.0, length(cameraPosition - vWPos));
            vec3 veg = vec3(0.075, 0.1, 0.03) * (0.7 + 0.6 * vnoise(vWPos.xz * 1.7)) + vec3(0.03, 0.02, 0.0) * vnoise(vWPos.xz * 0.6);
            TA = mix(TA, veg, cov * dv * 0.85 * (1.0 - rockK));
          }
          // at a distance the litter's small shadows, needles and moss average into a darker, greener brown
          TA *= mix(1.0, 0.7, far * (1.0 - rockK * 0.5));
          TA = mix(TA, TA * vec3(0.88, 0.97, 0.78), far * fw * 0.6);
          // forest floor is darker and more saturated than the bare scan suggests (litter is damp, shaded by itself)
          float lum = dot(TA, vec3(0.3, 0.59, 0.11));
          TA = mix(vec3(lum), TA, 1.06) * 0.88;
        }
        // grass-covered ground is greener and darker beneath the blades
        TA = mix(TA, TA * vec3(0.85, 0.92, 0.75), vAux.x * 0.35);
        // wetness near water and when raining: darker, glossier
        float wet = clamp(vAux.y + uWet * 0.6, 0.0, 1.0);
        TA *= mix(1.0, 0.62, wet);
        // ground marks (footprints, skids) pressed into this very surface
        MUV = (vWPos.xz - uMarkOrigin) / uMarkSize; MK = vec4(0.0);
        if (MUV.x > 0.0 && MUV.y > 0.0 && MUV.x < 1.0 && MUV.y < 1.0) MK = texture2D(tMarks, MUV);
        { vec4 sw = vSplat / max(1e-3, vSplat.x + vSplat.y + vSplat.z + vSplat.w);
          MSOFT = clamp(sw.y + sw.w + sw.x * 0.3 + sw.z * 0.2, 0.0, 1.0); }
        TA *= 1.0 - (0.16 * MK.r + 0.05 * MK.a) * MSOFT;
        TA = mix(TA, TA * vec3(1.18, 1.12, 1.06), clamp(MK.b, 0.0, 1.0) * MSOFT * 0.5);
        TA *= mix(1.0, 0.6, MK.g);
        diffuseColor = vec4(TA, opacity);
        terrainH = TO.b;
      `)
      .replace('#include <roughnessmap_fragment>', `
        float roughnessFactor = clamp(TO.g * mix(1.0, 0.45, clamp(vAux.y + uWet*0.7, 0.0, 1.0)), 0.05, 1.0);
        roughnessFactor = mix(roughnessFactor, 0.14, MK.g);`)
      .replace('#include <normal_fragment_maps>', `
        {
          vec3 tn = TN * 2.0 - 1.0;
          tn.xy *= 1.15;
          vec3 wn2 = normalize(vWNrm);
          vec3 T = normalize(vec3(1.0, 0.0, 0.0) - wn2 * wn2.x);
          vec3 Bv = normalize(cross(T, wn2));
          vec3 nW = normalize(T * tn.x - Bv * tn.y + wn2 * tn.z);
          if (rockK > 0.001) {
            vec3 rn = triNormal(tRockN, vWPos, wn2, tw, 0.37);
            nW = normalize(mix(nW, rn, rockK));
          }
          if (MK.a > 0.001) {
            // pressed soil is compacted: its own small relief flattens inside the print
            nW = normalize(mix(nW, wn2, clamp(MK.r * 1.3, 0.0, 1.0) * MSOFT * 0.7));
            float e = uMarkTexel;
            float mx = texture2D(tMarks, MUV + vec2(e, 0.0)).r - texture2D(tMarks, MUV - vec2(e, 0.0)).r;
            float mz = texture2D(tMarks, MUV + vec2(0.0, e)).r - texture2D(tMarks, MUV - vec2(0.0, e)).r;
            float bx = texture2D(tMarks, MUV + vec2(e, 0.0)).b - texture2D(tMarks, MUV - vec2(e, 0.0)).b;
            float bz = texture2D(tMarks, MUV + vec2(0.0, e)).b - texture2D(tMarks, MUV - vec2(0.0, e)).b;
            // the print's relief, faded at grazing view angles where a decal-like normal tilt reads as a dark cut-out
            float graze = smoothstep(0.08, 0.45, abs(dot(normalize(cameraPosition - vWPos), wn2)));
            nW = normalize(nW + (vec3(mx, 0.0, mz) * 1.3 - vec3(bx, 0.0, bz) * 0.6) * MSOFT * graze);
          }
          normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);
        }`)
      .replace('#include <opaque_fragment>', `
        // sunlight caustics dancing on the stream / pond bed
        {
          float wd = uWaterY - vWPos.y;
          if (wd > 0.0) {
            float ck = causticsAt(vWPos.xz, uTime) * smoothstep(0.0, 0.12, wd) * (1.0 - smoothstep(0.7, 1.6, wd));
            outgoingLight += TA * vec3(1.0, 0.97, 0.85) * ck * 1.6;
            outgoingLight *= mix(vec3(1.0), vec3(0.78, 0.9, 0.86), smoothstep(0.0, 0.8, wd));
          }
        }
        #include <opaque_fragment>`)
      .replace('#include <aomap_fragment>', `
        float ambientOcclusion = mix(1.0, TO.r, 0.9);
        ambientOcclusion *= 1.0 - 0.4 * clamp(MK.r, 0.0, 1.0) * MSOFT;   // pressed hollows see less sky
        vec2 gAOs = texture2D(tGroundAO, (vWPos.xz - uGAOB.xy) * uGAOB.zw).rg; float gAO = gAOs.r;
        ambientOcclusion *= gAO;
        reflectedLight.directDiffuse *= mix(1.0, gAO, 0.25);
        // contact occlusion from the robot standing on this ground (and from each boot)
        {
          float dR = length(vWPos.xz - uRobot.xz), hR = max(0.0, uRobot.w), rr = 0.14 + hR * 0.45;
          float kR = exp(-dR * dR / (rr * rr)) * 0.62 * (1.0 - smoothstep(0.0, 1.0, hR));
          float kF = 0.0;
          for (int i = 0; i < 2; i++) { vec2 d = vWPos.xz - uFeet[i].xz; float df = length(d);
            kF = max(kF, exp(-df * df / 0.0011) * 0.55 * (1.0 - smoothstep(0.02, 0.12, abs(vWPos.y - uFeet[i].y)))); }
          float cAO = (1.0 - kR) * (1.0 - kF);
          ambientOcclusion *= cAO;
          reflectedLight.directDiffuse *= mix(1.0, cAO, 0.4);
        }
        reflectedLight.indirectDiffuse *= ambientOcclusion;
        reflectedLight.indirectSpecular *= ambientOcclusion;
        reflectedLight.directDiffuse *= mix(1.0, TO.r, 0.35);`);
  };
  return mat;
}
