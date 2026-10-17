// Shared helpers for the city: seeded randomness, placement maths, a tiling
// noise texture, canvas textures and the shader patches used by the city's
// own materials (ground, decals, sprites, filler buildings).
import * as THREE from 'three';

// ---------------------------------------------------------------- random

export function rng(seed = 1) {
  let a = seed >>> 0;
  const r = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  r.range = (a0, a1) => a0 + (a1 - a0) * r();
  r.int = (a0, a1) => Math.floor(a0 + (a1 - a0 + 1) * r());
  r.pick = (arr) => arr[Math.floor(r() * arr.length) % arr.length];
  r.chance = (p) => r() < p;
  return r;
}

// ---------------------------------------------------------------- placement

// Local (lx, lz) of an object at (x, z) turned by rotY to world space; matches
// Object3D.rotation.y and Colliders.add.
export function tf(x, z, rot, lx, lz, out = {}) {
  const c = Math.cos(rot), s = Math.sin(rot);
  out.x = x + lx * c + lz * s;
  out.z = z - lx * s + lz * c;
  return out;
}

// rotY that turns a model's front (+Z) towards (dx, dz).
export const yawTo = (dx, dz) => Math.atan2(dx, dz);
// Player/camera yaw looking along (dx, dz) (player forward is (-sin, -cos)).
export const lookYaw = (dx, dz) => Math.atan2(-dx, -dz);

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------- textures

// Tileable value-noise fbm, one independent field per channel. Sampled in
// world space by the ground and filler shaders to break up texture tiling.
let noiseTex = null;
export function noiseTexture() {
  if (noiseTex) return noiseTex;
  const N = 256;
  const data = new Uint8Array(N * N * 4);
  for (let ch = 0; ch < 4; ch++) {
    const r = rng(101 + ch * 977);
    const grids = [];
    for (let o = 0; o < 5; o++) {
      const g = 4 << o;
      const v = new Float32Array(g * g);
      for (let i = 0; i < v.length; i++) v[i] = r();
      grids.push([g, v]);
    }
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        let s = 0, amp = 0.5, tot = 0;
        for (const [g, v] of grids) {
          const fx = (x / N) * g, fy = (y / N) * g;
          const ix = Math.floor(fx), iy = Math.floor(fy);
          let tx = fx - ix, ty = fy - iy;
          tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
          const x0 = ix % g, x1 = (ix + 1) % g, y0 = iy % g, y1 = (iy + 1) % g;
          const a = v[y0 * g + x0], b = v[y0 * g + x1], c = v[y1 * g + x0], d = v[y1 * g + x1];
          s += amp * ((a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty);
          tot += amp; amp *= 0.5;
        }
        // stretch the contrast so thresholds in the shaders have range to work with
        const val = clamp((s / tot - 0.5) * 1.9 + 0.5, 0, 1);
        data[(y * N + x) * 4 + ch] = Math.round(val * 255);
      }
    }
  }
  const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  noiseTex = t;
  return t;
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

export function canvasTexture(c, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

// Albedo maps from the asset loader are not tagged sRGB; the city's own
// materials use tagged clones so the colours come out as authored.
const srgbCache = new Map();
export function srgbClone(t) {
  if (!t) return null;
  if (t.colorSpace === THREE.SRGBColorSpace) return t;
  if (srgbCache.has(t)) return srgbCache.get(t);
  const c = t.clone();
  c.colorSpace = THREE.SRGBColorSpace;
  c.needsUpdate = true;
  srgbCache.set(t, c);
  return c;
}

// ---------------------------------------------------------------- shader patches

// One patch builder for the city's materials. Options:
//   wet     0..1  darken and gloss with G.mats.globals.uWet (upward faces more)
//   grime   0..1  soot near the ground, like the library materials
//   atlas   per-instance uv rect from attribute aRect (xy offset, zw size)
//   sway    metres of wind sway at the top of a sprite (uv.y = 1)
//   fogK    multiplier on the fog distance (far pyramids read through haze)
//   facade  procedural windows on vertical faces (filler skyline)
//   night   lit windows uniform (facade only)
export function patchMaterial(mat, globals, o = {}) {
  const key = JSON.stringify(o);
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    if (prev && prev !== THREE.Material.prototype.onBeforeCompile) prev(sh, r);
    sh.uniforms.uWet = globals.uWet;
    sh.uniforms.uTime = globals.uTime;
    sh.uniforms.uNight = globals.uNight;
    if (o.facade) sh.uniforms.uNoise = { value: noiseTexture() };
    let vs = sh.vertexShader, fs = sh.fragmentShader;
    vs = vs.replace('#include <common>', `#include <common>
      varying vec3 vWPos;
      varying vec3 vWNrm;
      uniform float uTime;
      ${o.atlas ? 'attribute vec4 aRect;' : ''}
      ${o.facade ? 'varying vec2 vFac; varying float vSeed;' : ''}`);
    if (o.atlas) {
      vs = vs.replace('#include <uv_vertex>', `#include <uv_vertex>
        #ifdef USE_MAP
          vMapUv = aRect.xy + uv * aRect.zw;
        #endif`);
    }
    if (o.sway) {
      vs = vs.replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          vec3 ip = vec3(0.0);
          #ifdef USE_INSTANCING
            ip = instanceMatrix[3].xyz;
          #endif
          float ph = dot(ip.xz, vec2(0.37, 0.71));
          float gust = 0.6 + 0.4 * sin(uTime * 0.31 + ph * 0.05);
          float w = (sin(uTime * 1.9 + ph) * 0.7 + sin(uTime * 3.3 + ph * 1.7) * 0.3) * ${o.sway.toFixed(3)} * gust;
          float k = uv.y * uv.y;
          transformed.x += w * k;
          transformed.z += w * 0.55 * k;
        }`);
    }
    vs = vs.replace('#include <project_vertex>', `#include <project_vertex>
      {
        vec4 wp = vec4(transformed, 1.0);
        vec3 wn = objectNormal;
        #ifdef USE_INSTANCING
          wp = instanceMatrix * wp;
          wn = mat3(instanceMatrix) * wn;
        #endif
        vWPos = (modelMatrix * wp).xyz;
        vWNrm = normalize(mat3(modelMatrix) * wn);
        ${o.facade ? `
        // facade coordinates in metres: along the wall, and height
        vFac = abs(vWNrm.y) > 0.5 ? vWPos.xz : vec2(dot(vWPos.xz, normalize(vec2(-vWNrm.z, vWNrm.x))), vWPos.y);
        #ifdef USE_MAP
          vMapUv = vFac / ${(o.facade.tile || 4).toFixed(2)};
        #endif
        #ifdef USE_NORMALMAP
          vNormalMapUv = vMapUv;
        #endif
        #ifdef USE_ROUGHNESSMAP
          vRoughnessMapUv = vMapUv;
        #endif
        vSeed = 0.0;
        #ifdef USE_INSTANCING
          vSeed = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453);
        #endif` : ''}
      }`);
    fs = fs.replace('#include <common>', `#include <common>
      varying vec3 vWPos;
      varying vec3 vWNrm;
      uniform float uWet;
      uniform float uNight;
      ${o.facade ? 'varying vec2 vFac; varying float vSeed; uniform sampler2D uNoise;' : ''}`);
    let mapExtra = '';
    if (o.grime) {
      mapExtra += `
        float gH = 1.0 - smoothstep(0.0, 2.2, vWPos.y);
        float gN = fract(sin(dot(floor(vWPos.xz * 0.7), vec2(12.9898, 78.233))) * 43758.5453);
        diffuseColor.rgb *= mix(1.0, 0.62 + 0.12 * gN, gH * ${o.grime.toFixed(2)});`;
    }
    if (o.facade) {
      mapExtra += `
        float isWall = 1.0 - step(0.5, abs(vWNrm.y));
        vec2 cellSz = vec2(3.4, 3.1);
        vec2 cell = floor(vFac / cellSz);
        vec2 fc = fract(vFac / cellSz);
        float win = step(0.26, fc.x) * step(fc.x, 0.74) * step(0.3, fc.y) * step(fc.y, 0.82);
        win *= step(1.2, vWPos.y) * isWall;
        // soot streaks running down from the sills and roof
        float streak = texture2D(uNoise, vec2(vFac.x * 0.11, vFac.y * 0.006 + vSeed)).r;
        diffuseColor.rgb *= mix(1.0, 0.72 + 0.28 * streak, isWall);
        float h = fract(sin(dot(cell + vSeed * 37.0, vec2(41.31, 289.17))) * 43758.5453);
        float board = step(0.9, h);
        vec3 glass = mix(vec3(0.035, 0.04, 0.045), vec3(0.16, 0.12, 0.08), board);
        diffuseColor.rgb = mix(diffuseColor.rgb, glass, win);
        float lit = win * (1.0 - board) * step(h, 0.32) * uNight;
        float frame = isWall * (1.0 - win) * step(0.22, fc.x) * step(fc.x, 0.78) * step(0.26, fc.y) * step(fc.y, 0.86);
        diffuseColor.rgb *= 1.0 - frame * 0.45;`;
    }
    if (o.wet) {
      mapExtra += `
        float upF = clamp(vWNrm.y, 0.0, 1.0);
        float wetM = uWet * ${o.wet.toFixed(2)} * mix(0.45, 1.0, upF);
        diffuseColor.rgb *= mix(1.0, 0.66, wetM);`;
    }
    fs = fs.replace('#include <map_fragment>', '#include <map_fragment>\n' + mapExtra);
    if (o.wet || o.facade) {
      fs = fs.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        ${o.wet ? 'roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.3, wetM);' : ''}
        ${o.facade ? 'roughnessFactor = mix(roughnessFactor, 0.12, win);' : ''}`);
    }
    if (o.facade) {
      fs = fs.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += vec3(1.0, 0.68, 0.36) * lit * (0.9 + 0.6 * h);`);
    }
    if (o.fogK) {
      fs = fs.replace('#include <fog_fragment>', `
        #ifdef USE_FOG
          #ifdef FOG_EXP2
            float fd = vFogDepth * ${o.fogK.toFixed(3)};
            float fogFactor = 1.0 - exp(-fogDensity * fogDensity * fd * fd);
          #else
            float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
          #endif
          gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor);
        #endif`);
    }
    sh.vertexShader = vs;
    sh.fragmentShader = fs;
  };
  mat.customProgramCacheKey = () => 'city:' + key;
  return mat;
}

// Depth material for alpha-tested sprites so their shadows match the cut-out.
export function spriteDepthMaterial(map, globals, o = {}) {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: 0.5 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = globals.uTime;
    let vs = sh.vertexShader;
    vs = vs.replace('#include <common>', `#include <common>\nuniform float uTime;\n${o.atlas ? 'attribute vec4 aRect;' : ''}`);
    if (o.atlas) vs = vs.replace('#include <uv_vertex>', `#include <uv_vertex>
      #ifdef USE_MAP
        vMapUv = aRect.xy + uv * aRect.zw;
      #endif`);
    if (o.sway) vs = vs.replace('#include <begin_vertex>', `#include <begin_vertex>
      {
        vec3 ip = vec3(0.0);
        #ifdef USE_INSTANCING
          ip = instanceMatrix[3].xyz;
        #endif
        float ph = dot(ip.xz, vec2(0.37, 0.71));
        float gust = 0.6 + 0.4 * sin(uTime * 0.31 + ph * 0.05);
        float w = (sin(uTime * 1.9 + ph) * 0.7 + sin(uTime * 3.3 + ph * 1.7) * 0.3) * ${o.sway.toFixed(3)} * gust;
        float k = uv.y * uv.y;
        transformed.x += w * k;
        transformed.z += w * 0.55 * k;
      }`);
    sh.vertexShader = vs;
  };
  m.customProgramCacheKey = () => 'cityDepth:' + JSON.stringify(o);
  return m;
}

// ---------------------------------------------------------------- merged boxes

// Collects oriented boxes and quads into one BufferGeometry per material with
// metre-based UVs, so walls, beams and crates cost one draw call per material.
export class MergeBuilder {
  constructor() { this.groups = new Map(); }

  buf(mat) {
    if (!this.groups.has(mat)) this.groups.set(mat, { p: [], n: [], uv: [] });
    return this.groups.get(mat);
  }

  // quad from 4 world points (counter-clockwise seen from the front), uvs given
  quad(mat, a, b, c, d, uvs) {
    const g = this.buf(mat);
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    for (const i of [0, 1, 2, 0, 2, 3]) {
      const p = [a, b, c, d][i];
      g.p.push(p[0], p[1], p[2]);
      g.n.push(nx, ny, nz);
      g.uv.push(uvs[i * 2], uvs[i * 2 + 1]);
    }
  }

  // Box centred at (cx, cz) with its base at y0, size (sx along local x, sy up,
  // sz along local z), turned by rot. UVs in metres / tile. Bottom face skipped.
  box(mat, cx, y0, cz, sx, sy, sz, rot = 0, tile = 1, opt = {}) {
    const c = Math.cos(rot), s = Math.sin(rot);
    const hx = sx / 2, hz = sz / 2;
    const P = (lx, y, lz) => [cx + lx * c + lz * s, y, cz - lx * s + lz * c];
    const y1 = y0 + sy;
    const t = tile;
    const faces = opt.faces || 'nsewt';
    // +z face
    if (faces.includes('s')) this.quad(mat, P(-hx, y0, hz), P(hx, y0, hz), P(hx, y1, hz), P(-hx, y1, hz), [0, y0 / t, sx / t, y0 / t, sx / t, y1 / t, 0, y1 / t]);
    if (faces.includes('n')) this.quad(mat, P(hx, y0, -hz), P(-hx, y0, -hz), P(-hx, y1, -hz), P(hx, y1, -hz), [0, y0 / t, sx / t, y0 / t, sx / t, y1 / t, 0, y1 / t]);
    if (faces.includes('e')) this.quad(mat, P(hx, y0, hz), P(hx, y0, -hz), P(hx, y1, -hz), P(hx, y1, hz), [0, y0 / t, sz / t, y0 / t, sz / t, y1 / t, 0, y1 / t]);
    if (faces.includes('w')) this.quad(mat, P(-hx, y0, -hz), P(-hx, y0, hz), P(-hx, y1, hz), P(-hx, y1, -hz), [0, y0 / t, sz / t, y0 / t, sz / t, y1 / t, 0, y1 / t]);
    if (faces.includes('t')) this.quad(mat, P(-hx, y1, hz), P(hx, y1, hz), P(hx, y1, -hz), P(-hx, y1, -hz), [0, 0, sx / t, 0, sx / t, sz / t, 0, sz / t]);
    if (opt.bottom) this.quad(mat, P(-hx, y0, -hz), P(hx, y0, -hz), P(hx, y0, hz), P(-hx, y0, hz), [0, 0, sx / t, 0, sx / t, sz / t, 0, sz / t]);
  }

  // A beam between two 3D points with a square section of width w.
  beam(mat, a, b, w, tile = 1.5) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-4) return;
    const d = new THREE.Vector3(dx / len, dy / len, dz / len);
    const up = Math.abs(d.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const u = new THREE.Vector3().crossVectors(d, up).normalize().multiplyScalar(w / 2);
    const v = new THREE.Vector3().crossVectors(u, d).normalize().multiplyScalar(w / 2);
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
    const corner = (base, su, sv) => base.clone().addScaledVector(u, su).addScaledVector(v, sv).toArray();
    const L = len / tile, W = w / tile;
    const sides = [[1, 1, -1, 1], [-1, 1, -1, -1], [-1, -1, 1, -1], [1, -1, 1, 1]];
    for (const [su0, sv0, su1, sv1] of sides) {
      this.quad(mat, corner(A, su1, sv1), corner(A, su0, sv0), corner(B, su0, sv0), corner(B, su1, sv1), [0, 0, W, 0, W, L, 0, L]);
    }
    this.quad(mat, corner(B, 1, -1), corner(B, -1, -1), corner(B, -1, 1), corner(B, 1, 1), [0, 0, W, 0, W, W, 0, W]);
  }

  // Returns [{ mat, geometry }] and clears.
  build() {
    const out = [];
    for (const [mat, g] of this.groups) {
      if (!g.p.length) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(g.p, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(g.n, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(g.uv, 2));
      geo.computeBoundingSphere();
      geo.computeBoundingBox();
      out.push({ mat, geometry: geo });
    }
    this.groups.clear();
    return out;
  }
}

// ---------------------------------------------------------------- geometry

// Bake a (possibly quantized, indexed) model part into plain float arrays in
// model space and split its triangles by a predicate on the centroid. Used to
// cut the timber shoring off the ends of the prole terraces so it can be put
// back only where the neighbouring house is missing.
export function splitGeometry(geometry, matrix, pred) {
  const pos = geometry.attributes.position, nrm = geometry.attributes.normal, uv = geometry.attributes.uv;
  const idx = geometry.index;
  const nm = new THREE.Matrix3().getNormalMatrix(matrix);
  const v = new THREE.Vector3(), n = new THREE.Vector3();
  const out = [{ p: [], n: [], uv: [] }, { p: [], n: [], uv: [] }];
  const tri = [0, 0, 0];
  const count = idx ? idx.count : pos.count;
  const P = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  for (let t = 0; t < count; t += 3) {
    for (let k = 0; k < 3; k++) {
      tri[k] = idx ? idx.getX(t + k) : t + k;
      P[k].fromBufferAttribute(pos, tri[k]).applyMatrix4(matrix);
    }
    const cx = (P[0].x + P[1].x + P[2].x) / 3, cy = (P[0].y + P[1].y + P[2].y) / 3, cz = (P[0].z + P[1].z + P[2].z) / 3;
    const o = out[pred(cx, cy, cz) ? 1 : 0];
    for (let k = 0; k < 3; k++) {
      v.copy(P[k]);
      o.p.push(v.x, v.y, v.z);
      if (nrm) { n.fromBufferAttribute(nrm, tri[k]).applyMatrix3(nm).normalize(); o.n.push(n.x, n.y, n.z); }
      if (uv) o.uv.push(uv.getX(tri[k]), uv.getY(tri[k]));
    }
  }
  return out.map((o) => {
    if (!o.p.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(o.p, 3));
    if (o.n.length) g.setAttribute('normal', new THREE.Float32BufferAttribute(o.n, 3));
    else g.computeVertexNormals();
    if (o.uv.length) g.setAttribute('uv', new THREE.Float32BufferAttribute(o.uv, 2));
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  });
}

// ---------------------------------------------------------------- occupancy

// Coarse grid of taken ground (buildings, kept-open places) so the filler
// pass never drops a block on top of something.
export class Occupancy {
  constructor(x0, z0, x1, z1, cell = 2) {
    this.x0 = x0; this.z0 = z0; this.cell = cell;
    this.nx = Math.ceil((x1 - x0) / cell); this.nz = Math.ceil((z1 - z0) / cell);
    this.g = new Uint8Array(this.nx * this.nz);
  }

  // Calls f(i, j) for each cell under an oriented box (centre, half extents, rotY).
  cells(cx, cz, hx, hz, rot, f) {
    const c = Math.cos(rot), s = Math.sin(rot);
    const ex = Math.abs(hx * c) + Math.abs(hz * s), ez = Math.abs(hx * s) + Math.abs(hz * c);
    const i0 = Math.max(0, Math.floor((cx - ex - this.x0) / this.cell)), i1 = Math.min(this.nx - 1, Math.floor((cx + ex - this.x0) / this.cell));
    const j0 = Math.max(0, Math.floor((cz - ez - this.z0) / this.cell)), j1 = Math.min(this.nz - 1, Math.floor((cz + ez - this.z0) / this.cell));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const x = this.x0 + (i + 0.5) * this.cell - cx, z = this.z0 + (j + 0.5) * this.cell - cz;
        const lx = x * c - z * s, lz = x * s + z * c;
        if (Math.abs(lx) <= hx + this.cell * 0.5 && Math.abs(lz) <= hz + this.cell * 0.5) if (f(i, j) === false) return false;
      }
    }
    return true;
  }

  mark(cx, cz, hx, hz, rot = 0) { this.cells(cx, cz, hx, hz, rot, (i, j) => { this.g[j * this.nx + i] = 1; }); }

  free(cx, cz, hx, hz, rot = 0) { return this.cells(cx, cz, hx, hz, rot, (i, j) => this.g[j * this.nx + i] === 0); }

  outside(x, z) {
    return x < this.x0 || z < this.z0 || x >= this.x0 + this.nx * this.cell || z >= this.z0 + this.nz * this.cell;
  }
}

// ---------------------------------------------------------------- misc

// Point list helper for paths: [[x, z], ...] -> Vector3[] on the ground.
export function polyline(pts, ground) {
  return pts.map(([x, z]) => new THREE.Vector3(x, ground ? ground(x, z) : 0, z));
}

// A unit quad standing on its base, facing +Z (posters, washing, signs).
export function standingQuad(w = 1, h = 1, z = 0) {
  const g = new THREE.PlaneGeometry(w, h);
  g.translate(0, h / 2, z);
  return g;
}

// Two crossed quads (a plant clump), base at y = 0, uv.y = 1 at the top so the
// sway patch bends only the tips. Normals lean upwards so the backs are not black.
export function crossQuads(w = 1, h = 1) {
  const p = [], n = [], uv = [], idx = [];
  for (let k = 0; k < 2; k++) {
    const a = k * Math.PI / 2 + 0.3;
    const dx = Math.cos(a) * w / 2, dz = Math.sin(a) * w / 2;
    const nx = -Math.sin(a) * 0.35, nz = Math.cos(a) * 0.35;
    const b = p.length / 3;
    p.push(-dx, 0, -dz, dx, 0, dz, dx, h, dz, -dx, h, -dz);
    for (let q = 0; q < 4; q++) n.push(nx, 0.94, nz);
    uv.push(0, 0, 1, 0, 1, 1, 0, 1);
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}
