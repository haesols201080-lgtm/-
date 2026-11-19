// Terrain: authored height function (hills, carved stream + pond, flattened clearing/paths),
// a PBR splat material blending the Blender-baked texture sets, and a Rapier heightfield collider.
import * as THREE from 'three';
import { makeNoise2D, fbm, smoothstep, clamp, lerp, distToPolyline } from './util.js';
import { WORLD, PATH, PATH2, PATH3, STREAM, POND, START, OUTCROP } from './layout.js';
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
    let h = 1.25 * fbm(n2, x * 0.022, z * 0.022, 4) + 0.4 * fbm(n3, x * 0.07, z * 0.07, 3) + 0.05 * fbm(n4, x * 0.6, z * 0.6, 2);
    // rising rim near the world edge (natural boundary)
    const e = Math.max(Math.abs(x), Math.abs(z));
    h += smoothstep(36, 47, e) * 5.5;
    // north ridge behind the outcrop
    h += smoothstep(-24, -40, z) * 2.2 * (0.6 + 0.4 * fbm(n3, x * 0.05, 3.3, 2));
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
    const mat = makeTerrainMaterial(textures);
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

export function makeTerrainMaterial(T) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, envMapIntensity: 0.6 });
  const uniforms = {
    tAlb: { value: T.terrainAlb }, tNrm: { value: T.terrainNrm }, tOrm: { value: T.terrainOrm },
    tRockA: { value: T.rock.map }, tRockN: { value: T.rock.normal }, tRockO: { value: T.rock.orm },
    uWet: { value: 0 }, uTime: { value: 0 }, uScales: { value: new THREE.Vector4(...TERRAIN_SCALES) }, uWaterY: { value: WORLD.waterY },
  };
  mat.userData.uniforms = uniforms;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
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
        ${CAUSTICS_GLSL}
        varying vec4 vSplat; varying vec2 vAux; varying vec3 vWPos; varying vec3 vWNrm;
        ${SHADER_TRI}
        float hash21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
        // stochastic-ish anti-tiling: two rotated/offset samples blended by low-frequency noise
        vec2 rot2(vec2 p, float a){ float c=cos(a), s=sin(a); return vec2(c*p.x - s*p.y, s*p.x + c*p.y); }
        float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
          return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x), mix(hash21(i+vec2(0,1)),hash21(i+vec2(1,1)),f.x), f.y); }
        vec3 sampleLayer(sampler2DArray t, vec2 uv, float layer, float blend){
          vec3 a = texture(t, vec3(uv, layer)).rgb;
          vec3 b = texture(t, vec3(rot2(uv, 1.7) * 0.83 + 0.37, layer)).rgb;
          return mix(a, b, blend);
        }
        vec3 TA; vec3 TN; vec3 TO; float terrainH;
      `)
      .replace('#include <map_fragment>', `
        vec2 tuv0 = vWPos.xz;
        float bl = smoothstep(0.35, 0.65, vnoise(vWPos.xz * 0.23));
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
        // grass-covered ground is greener and darker beneath the blades
        TA = mix(TA, TA * vec3(0.85, 0.92, 0.75), vAux.x * 0.35);
        // wetness near water and when raining: darker, glossier
        float wet = clamp(vAux.y + uWet * 0.6, 0.0, 1.0);
        TA *= mix(1.0, 0.62, wet);
        diffuseColor = vec4(TA, opacity);
        terrainH = TO.b;
      `)
      .replace('#include <roughnessmap_fragment>', `
        float roughnessFactor = clamp(TO.g * mix(1.0, 0.45, clamp(vAux.y + uWet*0.7, 0.0, 1.0)), 0.05, 1.0);`)
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
        reflectedLight.indirectDiffuse *= ambientOcclusion;
        reflectedLight.indirectSpecular *= ambientOcclusion;
        reflectedLight.directDiffuse *= mix(1.0, TO.r, 0.35);`);
  };
  return mat;
}
