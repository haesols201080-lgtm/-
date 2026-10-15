// The city floor. Surfaces are painted into a half-metre raster (roads,
// raised pavements, squares, yards); the raster is greedy-meshed into one mesh
// per surface, kerbs are cut wherever a raised cell meets a road, and the same
// raster answers ground height and footstep surface lookups in O(1).
import * as THREE from 'three';
import { MergeBuilder, noiseTexture, srgbClone, makeCanvas, canvasTexture, rng, patchMaterial } from './city_util.js';

export const KERB_H = 0.12;

export const T = { ASPHALT: 0, PAVING: 1, COBBLE: 2, SQUARE: 3, COMPOUND: 4, GRASS: 5, YARD: 6, CONCRETE: 7 };
const RAISED = [false, true, false, true, false, true, true, true];
const SURFACE = ['asphalt', 'paving', 'cobble', 'paving', 'concrete', 'grass', 'cobble', 'concrete'];

// ---------------------------------------------------------------- materials

// Ground PBR: world-space UVs, a second rotated sample blended by noise so the
// tile grid never shows, macro colour variation, rain darkening, puddles that
// only form when wet (with ripples while it rains) and baked AO from the ORM map.
export function groundMaterial(G, name, tile, o = {}) {
  const tex = (n) => G.assets.tex(n);
  const mat = new THREE.MeshStandardMaterial({
    name: 'ground_' + name + '_' + tile,
    map: srgbClone(tex(name + '_c')), normalMap: tex(name + '_n'), roughnessMap: tex(name + '_r'),
    aoMap: tex(name + '_r'), aoMapIntensity: o.ao ?? 0.9,
    color: o.color ?? 0xffffff, roughness: 1, metalness: 0,
    normalScale: new THREE.Vector2(o.normal ?? 1, o.normal ?? 1),
  });
  if (o.offset) { mat.polygonOffset = true; mat.polygonOffsetFactor = -o.offset; mat.polygonOffsetUnits = -o.offset * 2; }
  const globals = G.mats.globals;
  const uRain = G.world && G.world._uRain ? G.world._uRain : (globals.uRain || { value: 0 });
  const uni = {
    uNoise: { value: noiseTexture() }, uTile: { value: tile }, uPud: { value: o.puddles ?? 0.8 },
    uMacro: { value: o.macro ?? 1 }, uRain,
  };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uni);
    sh.uniforms.uWet = globals.uWet;
    sh.uniforms.uTime = globals.uTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGW;\nuniform float uTile;')
      .replace('#include <uv_vertex>', `#include <uv_vertex>
        {
          vec4 gw = modelMatrix * vec4(position, 1.0);
          vGW = gw.xyz;
          vec2 g = vec2(gw.x, -gw.z) / uTile;
          #ifdef USE_MAP
            vMapUv = g;
          #endif
          #ifdef USE_NORMALMAP
            vNormalMapUv = g;
          #endif
          #ifdef USE_ROUGHNESSMAP
            vRoughnessMapUv = g;
          #endif
          #ifdef USE_AOMAP
            vAoMapUv = g;
          #endif
        }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vGW;
        uniform sampler2D uNoise;
        uniform float uWet, uPud, uMacro, uRain, uTime;`)
      .replace('#include <map_fragment>', `
        vec2 gUv = vMapUv;
        vec4 gN1 = texture2D(uNoise, vGW.xz * 0.0093);
        vec4 gN2 = texture2D(uNoise, vGW.xz * 0.041 + 0.37);
        vec2 gUv2 = mat2(0.799, -0.602, 0.602, 0.799) * gUv * 0.73 + vec2(0.31, 0.17);
        float gB = smoothstep(0.36, 0.64, gN2.r);
        vec4 gC = mix(texture2D(map, gUv), texture2D(map, gUv2), gB);
        diffuseColor *= gC;
        float gMacro = mix(0.78, 1.12, gN1.g) * mix(0.9, 1.06, gN2.b);
        diffuseColor.rgb *= mix(1.0, gMacro, uMacro);
        diffuseColor.rgb *= mix(vec3(1.0), vec3(1.06, 1.0, 0.9), smoothstep(0.55, 0.85, gN1.b) * uMacro * 0.8);
        float gWet = uWet;
        float gPudN = gN1.a * 0.62 + gN2.a * 0.38;
        float gPud = smoothstep(0.64 - gWet * 0.1, 0.69 - gWet * 0.1, gPudN) * uPud * smoothstep(0.12, 0.55, gWet);
        diffuseColor.rgb *= mix(1.0, 0.58, gWet);
        diffuseColor.rgb *= mix(1.0, 0.72, gPud);`)
      .replace('#include <roughnessmap_fragment>', `
        float roughnessFactor = roughness;
        vec4 gR = mix(texture2D(roughnessMap, gUv), texture2D(roughnessMap, gUv2), gB);
        float gRT = mix(max(gR.g, 0.6), gR.g, gWet);
        roughnessFactor *= gRT;
        roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.38, gWet);
        roughnessFactor = mix(roughnessFactor, 0.025, gPud);
        float gAO = gR.r;`)
      .replace('#include <normal_fragment_maps>', `
        vec3 gNA = texture2D(normalMap, gUv).xyz * 2.0 - 1.0;
        vec3 gNB = texture2D(normalMap, gUv2).xyz * 2.0 - 1.0;
        gNB.xy = mat2(0.799, 0.602, -0.602, 0.799) * gNB.xy;
        vec3 mapN = normalize(mix(gNA, gNB, gB));
        mapN.xy *= normalScale * (1.0 - gPud * 0.96);
        if (uRain > 0.01 && gPud > 0.01) {
          // raindrop rings on standing water
          vec2 rp = vGW.xz * 1.7;
          vec2 ci = floor(rp);
          float rh = fract(sin(dot(ci, vec2(12.99, 78.23))) * 43758.55);
          vec2 cf = fract(rp) - 0.5 - (vec2(rh, fract(rh * 7.31)) - 0.5) * 0.5;
          float rt = fract(uTime * 0.85 + rh);
          float rd = length(cf);
          float ring = exp(-pow((rd - rt * 0.42) * 26.0, 2.0)) * (1.0 - rt);
          mapN.xy += (cf / max(rd, 1e-3)) * ring * 0.9 * uRain * gPud;
        }
        normal = normalize(tbn * mapN);`)
      .replace('texture2D( aoMap, vAoMapUv ).r', 'gAO');
  };
  mat.customProgramCacheKey = () => 'cityGround' + (o.offset ? 'o' : '');
  return mat;
}

// ---------------------------------------------------------------- raster

export class GroundMap {
  constructor(x0 = -400, z0 = -320, x1 = 400, z1 = 340, cell = 0.5) {
    this.x0 = x0; this.z0 = z0; this.x1 = x1; this.z1 = z1; this.cell = cell;
    this.nx = Math.round((x1 - x0) / cell);
    this.nz = Math.round((z1 - z0) / cell);
    this.t = new Uint8Array(this.nx * this.nz).fill(T.PAVING);
    this.steps = [];          // extra height rects: { x0, z0, x1, z1, h, rot, cx, cz }
    this.overlays = [];       // irregular surfaces: { poly, bbox, surface }
  }

  paint(x0, z0, x1, z1, type) {
    const c = this.cell;
    const i0 = Math.max(0, Math.round((Math.min(x0, x1) - this.x0) / c));
    const i1 = Math.min(this.nx, Math.round((Math.max(x0, x1) - this.x0) / c));
    const j0 = Math.max(0, Math.round((Math.min(z0, z1) - this.z0) / c));
    const j1 = Math.min(this.nz, Math.round((Math.max(z0, z1) - this.z0) / c));
    for (let j = j0; j < j1; j++) this.t.fill(type, j * this.nx + i0, j * this.nx + i1);
  }

  typeAt(x, z) {
    const i = Math.floor((x - this.x0) / this.cell), j = Math.floor((z - this.z0) / this.cell);
    if (i < 0 || j < 0 || i >= this.nx || j >= this.nz) return T.ASPHALT;
    return this.t[j * this.nx + i];
  }

  raised(x, z) { return RAISED[this.typeAt(x, z)]; }

  // Steps: axis-aligned in the local frame of (cx, cz, rot).
  addStep(cx, cz, rot, lx0, lz0, lx1, lz1, h) {
    const r = Math.hypot(Math.max(Math.abs(lx0), Math.abs(lx1)), Math.max(Math.abs(lz0), Math.abs(lz1)));
    this.steps.push({ cx, cz, c: Math.cos(rot), s: Math.sin(rot), lx0, lz0, lx1, lz1, h, r });
  }

  height(x, z) {
    let h = RAISED[this.typeAt(x, z)] ? KERB_H : 0;
    for (const s of this.steps) {
      const dx = x - s.cx, dz = z - s.cz;
      if (Math.abs(dx) > s.r || Math.abs(dz) > s.r) continue;
      const lx = dx * s.c - dz * s.s, lz = dx * s.s + dz * s.c;
      if (lx >= s.lx0 && lx <= s.lx1 && lz >= s.lz0 && lz <= s.lz1 && s.h > h) h = s.h;
    }
    return h;
  }

  surface(x, z) {
    for (const o of this.overlays) {
      const b = o.bbox;
      if (x < b[0] || x > b[2] || z < b[1] || z > b[3]) continue;
      if (pointInPoly(x, z, o.poly)) return o.surface;
    }
    return SURFACE[this.typeAt(x, z)];
  }

  // Greedy rectangles of equal type: { type: [[x0, z0, x1, z1], ...] }
  rects() {
    const { nx, nz, t, cell } = this;
    const done = new Uint8Array(nx * nz);
    const out = {};
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        if (done[k]) continue;
        const ty = t[k];
        let w = 1;
        while (i + w < nx && !done[k + w] && t[k + w] === ty) w++;
        let h = 1;
        outer: while (j + h < nz) {
          const base = (j + h) * nx + i;
          for (let q = 0; q < w; q++) if (done[base + q] || t[base + q] !== ty) break outer;
          h++;
        }
        for (let jj = 0; jj < h; jj++) done.fill(1, (j + jj) * nx + i, (j + jj) * nx + i + w);
        (out[ty] ||= []).push([this.x0 + i * cell, this.z0 + j * cell, this.x0 + (i + w) * cell, this.z0 + (j + h) * cell]);
      }
    }
    return out;
  }

  // Kerb runs where raised meets not raised: { x0, z0, x1, z1, nx, nz } with
  // (nx, nz) pointing from the raised side down to the road.
  kerbs() {
    const { nx, nz, t, cell } = this;
    const R = (i, j) => (i < 0 || j < 0 || i >= nx || j >= nz) ? false : RAISED[t[j * nx + i]];
    const runs = [];
    // vertical edges between columns i-1 and i
    for (let i = 0; i <= nx; i++) {
      let start = -1, dir = 0;
      for (let j = 0; j <= nz; j++) {
        let d = 0;
        if (j < nz) { const a = R(i - 1, j), b = R(i, j); d = a && !b ? 1 : (!a && b ? -1 : 0); }
        if (d !== dir) {
          if (dir !== 0) runs.push({ x0: this.x0 + i * cell, z0: this.z0 + start * cell, x1: this.x0 + i * cell, z1: this.z0 + j * cell, nx: dir, nz: 0 });
          start = j; dir = d;
        }
      }
    }
    for (let j = 0; j <= nz; j++) {
      let start = -1, dir = 0;
      for (let i = 0; i <= nx; i++) {
        let d = 0;
        if (i < nx) { const a = R(i, j - 1), b = R(i, j); d = a && !b ? 1 : (!a && b ? -1 : 0); }
        if (d !== dir) {
          if (dir !== 0) runs.push({ x0: this.x0 + start * cell, z0: this.z0 + j * cell, x1: this.x0 + i * cell, z1: this.z0 + j * cell, nx: 0, nz: dir });
          start = i; dir = d;
        }
      }
    }
    return runs;
  }
}

export function pointInPoly(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], zi = poly[i][1], xj = poly[j][0], zj = poly[j][1];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

// A ragged blob outline around (cx, cz): bomb sites and mud never have straight edges.
export function blob(cx, cz, rx, rz, seed, n = 18, rough = 0.28) {
  const r = rng(seed);
  const pts = [];
  const ph = [r() * 6, r() * 6, r() * 6];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    const m = 1 + rough * (Math.sin(a * 2 + ph[0]) * 0.5 + Math.sin(a * 3 + ph[1]) * 0.3 + (r() - 0.5) * 0.9);
    pts.push([cx + Math.cos(a) * rx * m, cz + Math.sin(a) * rz * m]);
  }
  return pts;
}

// ---------------------------------------------------------------- meshes

function gutterTexture() {
  const [c, ctx] = makeCanvas(512, 64);
  const r = rng(77);
  const img = ctx.createImageData(512, 64);
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 512; x++) {
      const k = (y * 512 + x) * 4;
      const fall = Math.pow(1 - y / 64, 1.6);
      const n = 0.55 + 0.45 * Math.sin(x * 0.05 + Math.sin(x * 0.013) * 4) * Math.sin(x * 0.11 + 1.3);
      const a = Math.min(1, fall * (0.55 + 0.45 * n) + (r() - 0.5) * 0.12);
      img.data[k] = 22 + r() * 10; img.data[k + 1] = 20 + r() * 8; img.data[k + 2] = 16 + r() * 6;
      img.data[k + 3] = Math.max(0, a) * 235;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = canvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

export function buildGround(G, map, root) {
  const mats = {};
  mats[T.ASPHALT] = groundMaterial(G, 'asphalt', 3.0, { puddles: 1 });
  mats[T.PAVING] = groundMaterial(G, 'paving', 2.4, { puddles: 0.55, color: 0xe9e4da });
  mats[T.COBBLE] = groundMaterial(G, 'cobble', 1.6, { puddles: 0.95, color: 0xd8d0c4 });
  mats[T.SQUARE] = groundMaterial(G, 'paving', 3.6, { puddles: 0.45, color: 0xf2eee6 });
  mats[T.COMPOUND] = groundMaterial(G, 'concrete_grey', 4.0, { puddles: 0.7, color: 0xb8b6b0 });
  mats[T.GRASS] = groundMaterial(G, 'grass', 2.2, { puddles: 0, color: 0xa8b090, normal: 0.6 });
  mats[T.YARD] = groundMaterial(G, 'cobble', 1.2, { puddles: 1, color: 0xa69a8c });
  mats[T.CONCRETE] = groundMaterial(G, 'concrete_grey', 4.0, { puddles: 0.8, color: 0xa29e96 });

  const group = new THREE.Group();
  group.name = 'ground';
  root.add(group);

  const rects = map.rects();
  for (const ty in rects) {
    const y = RAISED[ty] ? KERB_H : 0;
    const p = [];
    for (const [x0, z0, x1, z1] of rects[ty]) {
      p.push(x0, y, z1, x1, y, z1, x1, y, z0, x0, y, z1, x1, y, z0, x0, y, z0);
    }
    group.add(flatMesh(p, mats[ty], 'ground_' + ty));
  }

  // asphalt beyond the raster, out to the horizon
  {
    const E = 1400, p = [];
    const R = [[-E, -E, E, map.z0], [-E, map.z1, E, E], [-E, map.z0, map.x0, map.z1], [map.x1, map.z0, E, map.z1]];
    for (const [x0, z0, x1, z1] of R) p.push(x0, 0, z1, x1, 0, z1, x1, 0, z0, x0, 0, z1, x1, 0, z0, x0, 0, z0);
    const m = flatMesh(p, mats[T.ASPHALT], 'ground_far');
    group.add(m);
  }

  // kerbs: granite stones 0.9 m long (paving joints), 0.3 m wide on top
  const kerbMat = new THREE.MeshStandardMaterial({
    name: 'kerb', map: srgbClone(G.assets.tex('paving_c')), normalMap: G.assets.tex('paving_n'),
    roughnessMap: G.assets.tex('paving_r'), color: 0xcfc8bc, roughness: 1,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2,
  });
  patchMaterial(kerbMat, G.mats.globals, { wet: 1, grime: 0.5 });
  const gutMat = new THREE.MeshStandardMaterial({
    name: 'gutter', map: gutterTexture(), color: 0xffffff, roughness: 0.75, transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
  });
  const mb = new MergeBuilder();
  const KT = 4.5;            // 5 slabs per paving tile: 0.9 m kerb stones
  const H = KERB_H;
  const kerbRuns = map.kerbs();
  for (const k of kerbRuns) {
    const len = Math.hypot(k.x1 - k.x0, k.z1 - k.z0);
    if (len < 0.01) continue;
    // order the run so the face points along (nx, nz)
    let a = [k.x0, k.z0], b = [k.x1, k.z1];
    const tx = (b[0] - a[0]) / len, tz = (b[1] - a[1]) / len;
    if (tx * k.nz - tz * k.nx < 0) { const t = a; a = b; b = t; }
    const u0 = (a[0] + a[1]) / KT, u1 = u0 + len / KT;
    // vertical face
    mb.quad(kerbMat, [a[0], 0, a[1]], [b[0], 0, b[1]], [b[0], H, b[1]], [a[0], H, a[1]],
      [u0, 0.1, u1, 0.1, u1, 0.1 + H / KT, u0, 0.1 + H / KT]);
    // top strip on the raised side
    const w = 0.3, ix = -k.nx * w, iz = -k.nz * w;
    mb.quad(kerbMat, [a[0], H + 0.002, a[1]], [b[0], H + 0.002, b[1]], [b[0] + ix, H + 0.002, b[1] + iz], [a[0] + ix, H + 0.002, a[1] + iz],
      [u0, 0.03, u1, 0.03, u1, 0.03 + w / KT, u0, 0.03 + w / KT]);
    // grime in the gutter on the road side
    const gw = 0.45, gx = k.nx * gw, gz = k.nz * gw;
    const gu0 = (a[0] + a[1]) / 3, gu1 = gu0 + len / 3;
    mb.quad(gutMat, [a[0], 0.004, a[1]], [a[0] + gx, 0.004, a[1] + gz], [b[0] + gx, 0.004, b[1] + gz], [b[0], 0.004, b[1]],
      [gu0, 1, gu0, 0, gu1, 0, gu1, 1]);
  }
  for (const { mat, geometry } of mb.build()) {
    const m = new THREE.Mesh(geometry, mat);
    m.receiveShadow = true;
    m.castShadow = false;
    m.name = mat.name;
    m.matrixAutoUpdate = false;
    if (mat === gutMat) m.renderOrder = -1;
    group.add(m);
  }

  return { mats, kerbRuns, group };
}

function flatMesh(p, mat, name) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  const n = new Float32Array(p.length);
  for (let i = 1; i < n.length; i += 3) n[i] = 1;
  geo.setAttribute('normal', new THREE.BufferAttribute(n, 3));
  const uv = new Float32Array((p.length / 3) * 2);
  for (let i = 0, k = 0; i < p.length; i += 3, k += 2) { uv[k] = p[i]; uv[k + 1] = -p[i + 2]; }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.computeBoundingSphere();
  const m = new THREE.Mesh(geo, mat);
  m.name = name;
  m.receiveShadow = true;
  m.matrixAutoUpdate = false;
  return m;
}

// Irregular overlays (bomb-site earth, rubble, mud) as triangle fans lying just
// above whatever surface is beneath them.
export function buildOverlays(G, map, list, root) {
  const dirt = groundMaterial(G, 'dirt', 3.0, { puddles: 1, offset: 2, color: 0xd6ccbc });
  const rubble = groundMaterial(G, 'rubble', 2.2, { puddles: 0.3, offset: 3, color: 0xcfc6ba, normal: 1.2 });
  const byMat = new Map([['dirt', []], ['rubble', []]]);
  for (const o of list) {
    const poly = o.poly;
    let cx = 0, cz = 0;
    for (const [x, z] of poly) { cx += x; cz += z; }
    cx /= poly.length; cz /= poly.length;
    const y = map.height(cx, cz) + 0.012 + (o.kind === 'rubble' ? 0.006 : 0);
    const arr = byMat.get(o.kind);
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      // a slight mound in the middle so it reads as soil, not paint
      arr.push(cx, y + (o.mound || 0), cz, b[0], y, b[1], a[0], y, a[1]);
    }
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const [x, z] of poly) { x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x); z1 = Math.max(z1, z); }
    map.overlays.push({ poly, bbox: [x0, z0, x1, z1], surface: o.kind === 'rubble' ? 'rubble' : 'dirt' });
  }
  for (const [kind, p] of byMat) {
    if (!p.length) continue;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    geo.computeVertexNormals();
    const uv = new Float32Array((p.length / 3) * 2);
    for (let i = 0, k = 0; i < p.length; i += 3, k += 2) { uv[k] = p[i]; uv[k + 1] = -p[i + 2]; }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const m = new THREE.Mesh(geo, kind === 'dirt' ? dirt : rubble);
    m.receiveShadow = true;
    m.name = 'overlay_' + kind;
    m.matrixAutoUpdate = false;
    root.add(m);
  }
}
