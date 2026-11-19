// Builds the pine-forest region from scanned (Poly Haven, CC0) assets processed in Blender:
// terrain with scanned ground layers, conifers with scanned bark/twigs + scanned pine roots, mossy boulders,
// stumps, dead trunks, rock faces, ferns and ground plants, grass cards, water + waterfall, and physics colliders.
import * as THREE from 'three';
import { mulberry32, smoothstep, distToPolyline, clamp, makeNoise2D, fbm } from './util.js';
import { WORLD, PATH, PATH2, PATH3, STREAM, POND, OUTCROP, HERO_TREES, BOULDERS, LOGS, STUMPS, START } from './layout.js';
import { Terrain } from './terrain.js';
import { patchMaterial, WIND, leafLight, conformToGround, rootLift, barkRootBlend, ensureRootAttributes } from './shaders.js';
import { TREES, SAPLINGS, SNAGS } from './assets.js';
import { WaterSim, makeWaterMaterial } from './water.js';

const rnd = mulberry32(2024);
const nzEco = makeNoise2D(4242);
const TREE_R0 = { pine_0: 0.44, pine_1: 0.31, pine_2: 0.21, pine_3: 0.13, fir_4: 0.315, fir_5: 0.263, pine_11: 0.38, pine_12: 0.25, pine_13: 0.17, fir_14: 0.28, fir_15: 0.27 };
// crown size relative to the generic pine crown (slender, suppressed stems carry small crowns)
const TREE_CROWN = { pine_0: 1.15, pine_1: 1.0, pine_2: 0.75, pine_3: 0.5, fir_4: 1, fir_5: 1, pine_11: 1.1, pine_12: 0.85, pine_13: 0.6, fir_14: 0.95, fir_15: 1.05 };
const GRASS_SPRITES = [[0.207, 0.75, 0.496, 0.904], [0.605, 0.758, 0.826, 0.863], [0.252, 0.891, 0.49, 1.0], [0.598, 0.869, 0.789, 1.0], [0.051, 0.871, 0.18, 1.0]];
const UP = new THREE.Vector3(0, 1, 0);

// tree orientation: its own yaw plus a slight lean
const _tq = new THREE.Quaternion(), _ta = new THREE.Vector3();
function treeQuat(t) {
  const q = new THREE.Quaternion().setFromAxisAngle(UP, t.rot);
  if (t.tilt) { _ta.set(Math.cos(t.tiltDir), 0, Math.sin(t.tiltDir)); _tq.setFromAxisAngle(_ta, t.tilt); q.premultiply(_tq); }
  return q;
}
function meshes(root) { const out = []; root.updateMatrixWorld(true); root.traverse((o) => { if (o.isMesh) out.push(o); }); return out; }

export class World {
  constructor(ctx) {
    this.ctx = ctx; this.scene = ctx.scene;
    this.treeSpots = []; this.grassChunks = []; this.rocks = []; this.logs = []; this.stumps = [];
    this.variantCache = {};
  }

  // normalized geometry variants of a GLB: each mesh baked to the GLB's frame, centered on xz, resting at y=0
  variants(key) {
    if (this.variantCache[key]) return this.variantCache[key];
    const g = this.ctx.assets.models[key];
    const out = meshes(g.scene).map((o) => {
      const geo = o.geometry.clone().applyMatrix4(o.matrixWorld);
      geo.computeBoundingBox();
      const bb = geo.boundingBox, c = bb.getCenter(new THREE.Vector3());
      geo.translate(-c.x, -bb.min.y, -c.z);
      geo.computeBoundingBox(); geo.computeBoundingSphere();
      const size = geo.boundingBox.getSize(new THREE.Vector3());
      return { geo, mat: o.material, size, name: o.name };
    });
    this.variantCache[key] = out;
    return out;
  }

  build() {
    const { assets } = this.ctx;
    this.terrain = new Terrain();
    this.planTrees();
    const mossSources = [
      ...BOULDERS.map(([x, z, r]) => ({ x, z, r: r * 2.2 })),
      ...this.treeSpots.filter((t) => t.hero).map((t) => ({ x: t.x, z: t.z, r: 2.4 })),
    ];
    this.scene.add(this.terrain.buildMesh(assets.tex, this.ctx.tier, mossSources));
    this.terrain.buildCollider(this.ctx.RAPIER, this.ctx.physics);
    this.buildTrees();
    this.buildRocks();
    this.buildLogsStumps();
    this.buildOutcrop();
    this.buildRockFaces();
    this.buildWater();
    this.buildGroundAO();
    this.buildPlants();
    this.buildGrass();
    this.buildShafts();
  }

  // ambient occlusion on the ground around everything that stands on it (trunks, boulders, logs, stumps):
  // a world-space texture the terrain shader multiplies into its indirect light, so objects sit in the soil
  buildGroundAO() {
    const T = this.terrain, N = 1024, size = T.size, cell = size / N, half = size / 2;
    const ao = new Float32Array(N * N).fill(1);
    const stamp = (x0, z0, x1, z1, R, f) => {
      const i0 = Math.max(0, Math.floor((Math.min(x0, x1) - R + half) / cell)), i1 = Math.min(N - 1, Math.ceil((Math.max(x0, x1) + R + half) / cell));
      const j0 = Math.max(0, Math.floor((Math.min(z0, z1) - R + half) / cell)), j1 = Math.min(N - 1, Math.ceil((Math.max(z0, z1) + R + half) / cell));
      const dx = x1 - x0, dz = z1 - z0, L2 = dx * dx + dz * dz + 1e-9;
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const x = -half + (i + 0.5) * cell, z = -half + (j + 0.5) * cell;
        const t = Math.max(0, Math.min(1, ((x - x0) * dx + (z - z0) * dz) / L2));
        const d = Math.hypot(x - (x0 + dx * t), z - (z0 + dz * t));
        const v = f(d); if (v < 1) ao[j * N + i] *= v;
      }
    };
    for (const t of this.treeSpots) {
      const r0 = (TREE_R0[t.t] || 0.3) * t.s * (t.w || 1);
      stamp(t.x, t.z, t.x, t.z, r0 * 5 + 0.6, (d) => 1 - 0.6 * Math.exp(-Math.max(0, d - r0) / (r0 * 1.1 + 0.15)));
    }
    for (const r of this.rocks) stamp(r.x, r.z, r.x, r.z, r.r * 2 + 0.6, (d) => 1 - 0.55 * Math.exp(-Math.max(0, d - r.r * 0.8) / (0.2 + r.r * 0.3)));
    for (const l of this.logs) stamp(l.x1, l.z1, l.x2, l.z2, l.r * 3 + 0.4, (d) => 1 - 0.55 * Math.exp(-Math.max(0, d - l.r * 0.6) / (0.12 + l.r * 0.5)));
    for (const st of this.stumps) stamp(st.x, st.z, st.x, st.z, st.r * 3 + 0.4, (d) => 1 - 0.5 * Math.exp(-Math.max(0, d - st.r) / (0.15 + st.r * 0.4)));
    const data = new Uint8Array(N * N);
    for (let k = 0; k < N * N; k++) data[k] = Math.max(0, Math.min(255, ao[k] * 255));
    const tex = new THREE.DataTexture(data, N, N, THREE.RedFormat); tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
    const U = T.material.userData.uniforms;
    U.tGroundAO.value = tex; U.uGAOB.value.set(-half, -half, 1 / size, 1 / size);
  }

  // Waterfall: a stream runs over the top of the outcrop, leaves the edge and falls in a parabola; wherever the rock
  // face bulges out the sheet clings to it. Lit, fogged water (white where it is full of air), with a churning foam
  // patch where it hits the pool. Mist and spray are spawned from main.js (fx).
  buildWaterfall(wy) {
    const O = this.outcrop, rc = new THREE.Raycaster();
    const cx = OUTCROP.x - 3.5, cz = OUTCROP.z + 5.2;
    const out = new THREE.Vector3(cx - OUTCROP.x, 0, cz - OUTCROP.z).normalize();
    // lip: walk outward along the top until the rock ends
    let lip = null;
    for (let k = -1.5; k < 3; k += 0.05) {
      const px = cx + out.x * k, pz = cz + out.z * k;
      rc.set(new THREE.Vector3(px, this.outcropTop + 2, pz), new THREE.Vector3(0, -1, 0));
      const h = rc.intersectObject(O)[0];
      if (h && h.point.y > wy + 1.2) lip = h.point.clone(); else if (lip) break;
    }
    if (!lip) lip = new THREE.Vector3(cx, this.outcropTop - 0.6, cz);
    this.waterfallLip = lip.clone();
    const side = new THREE.Vector3(-out.z, 0, out.x);
    // centre line: 0.7 m of stream on the top, then the fall (free parabola or hugging the face)
    const pts = [];
    for (let k = 0; k <= 6; k++) {
      const d = -0.7 + k * 0.1167, px = lip.x + out.x * d, pz = lip.z + out.z * d;
      rc.set(new THREE.Vector3(px, lip.y + 1.5, pz), new THREE.Vector3(0, -1, 0));
      const h = rc.intersectObject(O)[0]; pts.push(new THREE.Vector3(px, (h ? h.point.y : lip.y) + 0.035, pz));
    }
    const H = lip.y - wy, v0 = 1.1, g = 9.8, steps = 36;
    for (let k = 1; k <= steps; k++) {
      const y = lip.y - H * (k / steps) ** 1.15;
      const t = Math.sqrt(2 * (lip.y - y) / g);
      let d = v0 * t;                                        // free fall outward from the lip
      rc.set(new THREE.Vector3(lip.x + out.x * 4, y, lip.z + out.z * 4), out.clone().negate());
      const h = rc.intersectObject(O)[0];
      if (h) d = Math.max(d, 4 - h.distance + 0.04);         // cling to a bulging face
      pts.push(new THREE.Vector3(lip.x + out.x * d, y, lip.z + out.z * d));
    }
    pts.push(new THREE.Vector3(pts[pts.length - 1].x, wy - 0.05, pts[pts.length - 1].z));
    // ribbon geometry, widening as it falls; v = metres along the flow
    const W0 = 0.55, W1 = 1.05, cols = 10, pos = [], uv = [], idx = [], nrm = [];
    let acc = 0;
    pts.forEach((p, i) => {
      if (i) acc += p.distanceTo(pts[i - 1]);
      const f = Math.max(0, (i - 6) / (pts.length - 7)), w = W0 + (W1 - W0) * Math.sqrt(f);
      const tg = (pts[Math.min(pts.length - 1, i + 1)].clone().sub(pts[Math.max(0, i - 1)])).normalize();
      const n = side.clone().cross(tg).normalize();
      for (let c = 0; c <= cols; c++) {
        const u = c / cols, o = (u - 0.5) * w;
        const bow = Math.cos((u - 0.5) * Math.PI) * 0.025 * (1 - f * 0.5);      // the sheet is thicker in the middle
        const q = p.clone().addScaledVector(side, o).addScaledVector(n, bow);
        if (i < 7) { rc.set(new THREE.Vector3(q.x, lip.y + 1.5, q.z), new THREE.Vector3(0, -1, 0)); const hh = rc.intersectObject(O)[0]; if (hh) q.y = Math.max(q.y, hh.point.y + 0.03); }
        pos.push(q.x, q.y, q.z); uv.push(u * w, acc); nrm.push(n.x, n.y, n.z);
      }
      if (i) for (let c = 0; c < cols; c++) { const a = (i - 1) * (cols + 1) + c, b = a + cols + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); geo.setIndex(idx);
    const fu = { uTime: { value: 0 }, uLen: { value: acc }, uTopLen: { value: pts[6].distanceTo(pts[0]) } };
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.18, metalness: 0, transparent: true, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.1 });
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, fu);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
          uniform float uTime, uLen, uTopLen;
          float wh(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
          float wn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
            return mix(mix(wh(i), wh(i + vec2(1, 0)), f.x), mix(wh(i + vec2(0, 1)), wh(i + vec2(1, 1)), f.x), f.y); }
          float WF_A; float WF_AIR;`)
        .replace('#include <map_fragment>', `#include <map_fragment>
          {
            vec2 q = vUv;                                   // x: metres across, y: metres along the flow
            float fall = smoothstep(uTopLen - 0.1, uTopLen + 0.4, q.y);
            float spd = mix(0.6, 3.2, fall);
            float s1 = wn(vec2(q.x * 22.0, q.y * 1.4 - uTime * spd));
            float s2 = wn(vec2(q.x * 55.0 + 3.0, q.y * 3.5 - uTime * spd * 1.3));
            float s3 = wn(vec2(q.x * 9.0 - 7.0, q.y * 0.6 - uTime * spd * 0.8));
            float streak = s1 * 0.5 + s2 * 0.3 + s3 * 0.2;
            float w = 0.55 + 0.5 * fall;                       // sheet width in uv metres (approx.)
            float edge = smoothstep(0.0, 0.12, q.x) * smoothstep(0.0, 0.12, w - q.x);
            // aeration: white, opaque streaks; between them clear, thin water
            WF_AIR = smoothstep(0.42, 0.75, streak + fall * 0.15 + smoothstep(uLen - 0.6, uLen, q.y) * 0.4);
            WF_A = clamp((0.25 + 0.75 * WF_AIR) * edge * (1.0 - fall * 0.15) * mix(0.55, 1.0, fall), 0.0, 0.95);
            // broken edges: strands peel off the sides
            WF_A *= smoothstep(0.15, 0.45, wn(vec2(q.x * 30.0, q.y * 2.0 - uTime * spd)) + edge * 0.7);
            diffuseColor.rgb = mix(vec3(0.42, 0.5, 0.48), vec3(0.95, 0.97, 0.97), WF_AIR);
            diffuseColor.a = WF_A;
          }`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
          roughnessFactor = mix(0.08, 0.6, WF_AIR);`);
    };
    mat.defines = { USE_UV: '' }; mat.customProgramCacheKey = () => 'waterfall2';
    const fall = new THREE.Mesh(geo, mat); fall.renderOrder = 3; fall.receiveShadow = true; this.scene.add(fall);
    // churning foam where it lands
    const base = pts[pts.length - 2];
    this.waterfallPos = new THREE.Vector3(base.x, wy, base.z);
    const fmat = new THREE.MeshStandardMaterial({ color: 0xf2f6f5, roughness: 0.6, transparent: true, depthWrite: false });
    fmat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, fu);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
          uniform float uTime;
          float fh(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
          float fn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
            return mix(mix(fh(i), fh(i + vec2(1, 0)), f.x), mix(fh(i + vec2(0, 1)), fh(i + vec2(1, 1)), f.x), f.y); }`)
        .replace('#include <map_fragment>', `#include <map_fragment>
          {
            vec2 p = vUv - 0.5; float r = length(p) * 2.0;
            float a = atan(p.y, p.x);
            float bub = fn(vec2(a * 6.0, r * 9.0 - uTime * 1.6)) * 0.6 + fn(p * 40.0 + uTime * 0.7) * 0.4;
            diffuseColor.a = smoothstep(1.0, 0.35, r) * smoothstep(0.3, 0.7, bub + (1.0 - r) * 0.35) * 0.85;
          }`);
    };
    const fg = new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2);
    const foam = new THREE.Mesh(fg, fmat); foam.position.set(base.x, wy + 0.01, base.z); foam.scale.set(1.0, 1, 0.75); foam.renderOrder = 3; this.scene.add(foam);
    fmat.defines = { USE_UV: '' }; fmat.customProgramCacheKey = () => 'wfFoam';
    this.fallU = fu;
  }

  // ---------------------------------------------------------------- physics helpers
  fixed(desc, data) { const c = this.ctx.physics.createCollider(desc.setFriction(0.9)); c.userData = data; return c; }
  trimesh(geo, matrix, data, maxY = Infinity) {
    const pos = geo.attributes.position, idx = geo.index, v = new THREE.Vector3();
    const verts = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(matrix); verts[i * 3] = v.x; verts[i * 3 + 1] = v.y; verts[i * 3 + 2] = v.z; }
    const tris = [], n = idx ? idx.count : pos.count;
    for (let i = 0; i < n; i += 3) {
      const a = idx ? idx.getX(i) : i, b = idx ? idx.getX(i + 1) : i + 1, c = idx ? idx.getX(i + 2) : i + 2;
      if (verts[a * 3 + 1] > maxY && verts[b * 3 + 1] > maxY && verts[c * 3 + 1] > maxY) continue;
      tris.push(a, b, c);
    }
    if (!tris.length) return null;
    return this.fixed(this.ctx.RAPIER.ColliderDesc.trimesh(verts, new Uint32Array(tris)), data);
  }
  hull(geo, matrix, data) {
    const pos = geo.attributes.position, v = new THREE.Vector3();
    const step = Math.max(1, Math.floor(pos.count / 600));
    const pts = [];
    for (let i = 0; i < pos.count; i += step) { v.fromBufferAttribute(pos, i).applyMatrix4(matrix); pts.push(v.x, v.y, v.z); }
    const d = this.ctx.RAPIER.ColliderDesc.convexHull(new Float32Array(pts));
    return d ? this.fixed(d, data) : null;
  }
  place(variant, mat, pos, rotY, scale, opts = {}) {
    const m = new THREE.Mesh(variant.geo, mat || variant.mat);
    m.position.copy(pos); m.rotation.y = rotY;
    if (typeof scale === 'number') m.scale.setScalar(scale); else m.scale.copy(scale);
    m.castShadow = opts.cast !== false; m.receiveShadow = true;
    this.scene.add(m); m.updateMatrixWorld(true);
    return m;
  }
  okSpot(x, z, clear = 1) {
    if (Math.hypot(x - START.x, z - START.z) < 3) return false;
    if (Math.min(distToPolyline(x, z, PATH).d, distToPolyline(x, z, PATH2).d, distToPolyline(x, z, PATH3).d) < clear) return false;
    if (this.terrain.isWater(x, z)) return false;
    if (Math.hypot(x - OUTCROP.x, z - OUTCROP.z) < 7) return false;
    return true;
  }

  // ---------------------------------------------------------------- trees
  planTrees() {
    HERO_TREES.forEach(([x, z, s], i) => this.treeSpots.push({ x, z, s: 0.85 + (s - 1) * 0.6, t: TREES[i % TREES.length], rot: rnd() * 6.28, hero: true }));
    let tries = 0;
    while (this.treeSpots.length < 230 && tries++ < 12000) {
      const x = (rnd() - 0.5) * 94, z = (rnd() - 0.5) * 94;
      if (Math.hypot(x - START.x, z - START.z) < 8.5) continue;
      if (Math.min(distToPolyline(x, z, PATH).d, distToPolyline(x, z, PATH2).d, distToPolyline(x, z, PATH3).d) < 2.4) continue;
      if (distToPolyline(x, z, STREAM).d < 2.6 || Math.hypot(x - POND.x, z - POND.z) < POND.r + 2.5 || Math.hypot(x - OUTCROP.x, z - OUTCROP.z) < 9) continue;
      if (this.treeSpots.some((t) => Math.hypot(t.x - x, t.z - z) < (t.hero ? 5 : 3.2))) continue;
      const inner = Math.max(Math.abs(x), Math.abs(z)) < 28;
      if (inner && rnd() < 0.35) continue;
      this.treeSpots.push({ x, z, s: 0.8 + rnd() * 0.45, t: TREES[Math.floor(rnd() * TREES.length)], rot: rnd() * 6.28, hero: false });
    }
    // a real stand mixes thick dominant trees with many slender suppressed poles squeezed in between them
    const extra = Math.round(110 * Math.min(1, this.ctx.tier.fernDensity + 0.2));
    for (let n = 0, k = 0; n < extra && k < 8000; k++) {
      const x = (rnd() - 0.5) * 92, z = (rnd() - 0.5) * 92;
      if (Math.hypot(x - START.x, z - START.z) < 7.5) continue;
      if (Math.min(distToPolyline(x, z, PATH).d, distToPolyline(x, z, PATH2).d, distToPolyline(x, z, PATH3).d) < 2.0) continue;
      if (distToPolyline(x, z, STREAM).d < 2.2 || Math.hypot(x - POND.x, z - POND.z) < POND.r + 2.0 || Math.hypot(x - OUTCROP.x, z - OUTCROP.z) < 8.5) continue;
      if (this.treeSpots.some((t) => Math.hypot(t.x - x, t.z - z) < (t.hero ? 4 : 1.7))) continue;
      { const u = rnd(); this.treeSpots.push({ x, z, s: 0.75 + rnd() * 0.4, t: u < 0.4 ? 'pine_3' : u < 0.7 ? 'pine_13' : 'pine_2', rot: rnd() * 6.28, hero: false }); }
      n++;
    }
    // a stand is not a plantation: heights vary independently of girth, trees in the shadow of a bigger
    // neighbour stay smaller, and stems lean a little in different directions
    const hsh = (x, z, k) => { const v = Math.sin(x * 12.9898 + z * 78.233 + k * 37.719) * 43758.5453; return v - Math.floor(v); };
    for (const t of this.treeSpots) {
      t.h = 0.78 + 0.44 * hsh(t.x, t.z, 1);
      let sup = 0;
      for (const o of this.treeSpots) { if (o === t) continue; const d = Math.hypot(o.x - t.x, o.z - t.z); if (d < 4 && o.s * (o.h || 1) > t.s * t.h * 1.05) sup = Math.max(sup, 1 - d / 4); }
      t.h *= 1 - 0.3 * sup;
      t.tilt = (0.01 + 0.035 * hsh(t.x, t.z, 2)) * (hsh(t.x, t.z, 4) < 0.15 ? 2.2 : 1); t.tiltDir = hsh(t.x, t.z, 3) * Math.PI * 2;
    }
    for (const t of this.treeSpots) t.cs = TREE_CROWN[t.t] || 1;
  }

  // terrain height as a texture (half float, linearly filtered) for shaders that need the ground under a vertex
  groundTexture() {
    if (this.ground) return this.ground;
    const T = this.terrain, N = T.res + 1, data = new Uint16Array(N * N);
    for (let k = 0; k < N * N; k++) data[k] = THREE.DataUtils.toHalfFloat(T.h[k]);
    const tex = new THREE.DataTexture(data, N, N, THREE.RedFormat, THREE.HalfFloatType);
    tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
    // texel centres sit on the grid vertices
    const span = T.size + T.cell;
    this.ground = { tex: { value: tex }, bounds: { value: new THREE.Vector4(-T.half - T.cell / 2, -T.half - T.cell / 2, 1 / span, 1 / span) } };
    return this.ground;
  }

  // colliders along the exported centre lines of a tree's surface roots (only where they stand above the soil)
  rootColliders(roots, t, kind) {
    const R = this.ctx.RAPIER, T = this.terrain, sxz = t.s * (t.w || 1), sy = t.s * (t.h || 1);
    const c = Math.cos(t.rot), sn = Math.sin(t.rot), h0 = t.y + 0.03;
    const world = (p) => {
      const x = t.x + (p[0] * c + p[2] * sn) * sxz, z = t.z + (-p[0] * sn + p[2] * c) * sxz;
      const y = t.y + p[1] * sy + rootLift(p[1], Math.hypot(p[0], p[2]), T.heightAt(x, z) - h0);
      return new THREE.Vector3(x, y, z);
    };
    let n = 0;
    for (const line of roots) {
      for (let i = 0; i + 1 < line.length; i++) {
        const a = world(line[i]), b = world(line[i + 1]), r = (line[i][3] + line[i + 1][3]) * 0.5 * sxz;
        if (r < 0.02) continue;
        const mid = a.clone().add(b).multiplyScalar(0.5);
        if (mid.y + r - T.heightAt(mid.x, mid.z) < 0.03) continue; // buried here
        const d = b.clone().sub(a), len = d.length(); if (len < 1e-3) continue;
        const q = new THREE.Quaternion().setFromUnitVectors(UP, d.normalize());
        this.fixed(R.ColliderDesc.capsule(len / 2, r * 0.9).setTranslation(mid.x, mid.y, mid.z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }), { kind, surface: 'wood' });
        n++;
      }
    }
    return n;
  }

  buildTrees() {
    const { assets } = this.ctx, M = assets.mats, R = this.ctx.RAPIER;
    const ground = this.groundTexture();
    for (const m of [M.bark, M.barkPlain, M.barkSnag, M.barkSnagPlain]) if (!m.userData.conformed) { conformToGround(m, ground); barkRootBlend(m); m.userData.conformed = true; }
    for (const k of [...TREES, ...TREES.map((t) => t + '_lod1'), ...SAPLINGS, ...SNAGS, ...SNAGS.map((t) => t + '_lod1')]) {
      const g = assets.models[k]; if (g) g.scene.traverse((o) => { if (o.isMesh) ensureRootAttributes(o.geometry); });
    }
    // root centre lines are glTF extras on the bark node (a group when the mesh has several primitives)
    const rootsOf = (key) => { let data = null; assets.models[key].scene.traverse((o) => { if (!data && o.userData && o.userData.roots) data = o.userData.roots; });
      try { return data ? JSON.parse(data) : null; } catch (e) { return null; } };
    let rootCols = 0;
    const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();
    const byT = {};
    for (const t of this.treeSpots) {
      // on a slope the stem stands at the downhill edge of its base (soil banks up against the uphill side);
      // roots are then only pulled down to follow the falling ground, never stretched up the slope
      {
        const rr = (TREE_R0[t.t] || 0.3) * t.s * 1.2; let lo = this.terrain.heightAt(t.x, t.z);
        for (let k = 0; k < 8; k++) lo = Math.min(lo, this.terrain.heightAt(t.x + Math.cos(k * 0.785) * rr, t.z + Math.sin(k * 0.785) * rr));
        t.y = lo - 0.03;
      }
      // girth varies independently of height (suppressed thin stems next to dominant thick ones)
      t.w = 0.82 + 0.4 * (Math.sin(t.x * 12.9898 + t.z * 78.233) * 43758.5453 % 1 + 1) % 1;
      const r0 = TREE_R0[t.t] * t.s * t.w;
      if (t.hero) {
        const ms = meshes(assets.models[t.t].scene);
        const grp = new THREE.Group();
        for (const o of ms) {
          const isBark = o.name.includes('bark');
          const m = new THREE.Mesh(o.geometry, isBark ? M.bark : M.twig);
          m.castShadow = true; m.receiveShadow = true; grp.add(m);
        }
        grp.position.set(t.x, t.y, t.z); grp.quaternion.copy(treeQuat(t)); grp.scale.set(t.s * t.w, t.s * t.h, t.s * t.w);
        this.scene.add(grp); grp.updateMatrixWorld(true);
      } else (byT[t.t] = byT[t.t] || []).push(t);
      this.fixed(R.ColliderDesc.cylinder(4, r0 * 0.95).setTranslation(t.x, t.y + 4, t.z), { kind: 'tree', surface: 'wood' });
      const rl = rootsOf(t.t); if (rl) rootCols += this.rootColliders(rl, t, 'root');
    }
    // instanced trees with a distance LOD: the detailed model (roots, dead branches, dense twigs) near the camera,
    // the light one further away; instances are re-sorted between the two a few times per second
    this.treeLods = [];
    for (const [key, list] of Object.entries(byT)) {
      const mats = new Float32Array(list.length * 16);
      list.forEach((t, i) => { q.copy(treeQuat(t)); sc.set(t.s * t.w, t.s * t.h, t.s * t.w); p.set(t.x, t.y, t.z); mtx.compose(p, q, sc); mtx.toArray(mats, i * 16); });
      const mk = (k, mat0) => meshes(assets.models[k].scene).map((o) => {
        const im = new THREE.InstancedMesh(o.geometry, o.name.includes('bark') ? mat0 : M.twig, list.length);
        im.instanceMatrix.array.set(mats); im.instanceMatrix.needsUpdate = true;
        im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere(); this.scene.add(im); return im;
      });
      this.treeLods.push({ list, mats, lod0: mk(key, M.bark), lod1: mk(key + '_lod1', M.barkPlain) });
    }
    this.lodT = 1e9;
    // standing dead snags scattered through the stand
    let snags = 0;
    for (let i = 0; i < 400 && snags < 12; i++) {
      const x = (rnd() - 0.5) * 84, z = (rnd() - 0.5) * 84;
      if (!this.okSpot(x, z, 2.2) || Math.hypot(x - START.x, z - START.z) < 9 || this.treeSpots.some((t) => Math.hypot(t.x - x, t.z - z) < 3)) continue;
      const key = SNAGS[snags % SNAGS.length], near = Math.max(Math.abs(x), Math.abs(z)) < 30;
      const src = meshes(assets.models[key + (near ? '' : '_lod1')].scene)[0];
      const m = new THREE.Mesh(src.geometry, near ? M.barkSnag : M.barkSnagPlain);
      const y = this.terrain.heightAt(x, z) - 0.05, sc = 0.8 + rnd() * 0.5;
      m.position.set(x, y, z); m.rotation.set((rnd() - 0.5) * 0.08, rnd() * 6.28, (rnd() - 0.5) * 0.08); m.scale.setScalar(sc);
      m.castShadow = m.receiveShadow = true; this.scene.add(m);
      this.fixed(R.ColliderDesc.cylinder(3, 0.27 * sc).setTranslation(x, y + 3, z), { kind: 'tree', surface: 'wood' });
      const rl = rootsOf(key); if (rl) rootCols += this.rootColliders(rl, { x, y, z, rot: m.rotation.y, s: sc, w: 1 }, 'root');
      snags++;
    }
    this.rootColliderCount = rootCols;
    // understory saplings (very visible at robot height)
    const sap = [];
    for (let i = 0; i < 900 && sap.length < 140 * this.ctx.tier.fernDensity + 30; i++) {
      const x = (rnd() - 0.5) * 84, z = (rnd() - 0.5) * 84;
      if (!this.okSpot(x, z, 1.4) || Math.hypot(x - START.x, z - START.z) < 6) continue;
      sap.push([x, z, 0.5 + rnd() * 0.9, Math.floor(rnd() * 3)]);
    }
    SAPLINGS.forEach((key, k) => {
      const list = sap.filter((s) => s[3] === k);
      for (const o of meshes(assets.models[key].scene)) {
        const im = new THREE.InstancedMesh(o.geometry, o.name.includes('bark') ? M.barkPlain : M.twig, list.length);
        list.forEach(([x, z, s], i) => { q.setFromAxisAngle(UP, rnd() * 6.28); sc.setScalar(s); p.set(x, this.terrain.heightAt(x, z) - 0.02, z); mtx.compose(p, q, sc); im.setMatrixAt(i, mtx); });
        im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere(); this.scene.add(im);
      }
      for (const [x, z, s] of list) if (s > 0.9) this.fixed(R.ColliderDesc.cylinder(0.4 * s, 0.03).setTranslation(x, this.terrain.heightAt(x, z) + 0.4 * s, z), { kind: 'tree', surface: 'wood' });
    });
  }

  // ---------------------------------------------------------------- rocks
  buildRocks() {
    const rockVars = [...this.variants('rock_moss_set_01'), ...this.variants('rock_moss_set_02')];
    const boulder = this.variants('boulder_01')[0];
    BOULDERS.forEach(([x, z, r, squash, seed], i) => {
      const v = r > 1.25 ? boulder : rockVars[seed % rockVars.length];
      const w = Math.max(v.size.x, v.size.z);
      const s = (r * 2) / w;
      const y = this.terrain.heightAt(x, z) - 0.06 * r;
      const m = this.place(v, null, new THREE.Vector3(x, y, z), seed * 1.7, new THREE.Vector3(s, s * squash * 1.1, s));
      this.hull(v.geo, m.matrixWorld, { kind: 'rock', surface: 'rock' });
      this.rocks.push({ x, z, r, top: y + v.size.y * s * squash * 1.1, mesh: m });
    });
    // scattered stones (instanced)
    const small = [...this.variants('rock_07'), ...this.variants('rock_09'), ...this.variants('stone_01')];
    const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), sv = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler();
    small.forEach((v) => {
      const items = [];
      for (let i = 0; i < 700 && items.length < 70; i++) {
        const x = (rnd() - 0.5) * 80, z = (rnd() - 0.5) * 80;
        const near = distToPolyline(x, z, STREAM).d < 3.2;
        if (!near && rnd() < 0.55) continue;
        if (Math.min(distToPolyline(x, z, PATH).d, distToPolyline(x, z, PATH3).d) < 0.5) continue;
        items.push([x, z, 0.6 + rnd() * (near ? 2.2 : 1.4)]);
      }
      const im = new THREE.InstancedMesh(v.geo, v.mat, items.length);
      items.forEach(([x, z, s], i) => {
        p.set(x, this.terrain.heightAt(x, z) - v.size.y * s * 0.25, z); e.set((rnd() - 0.5) * 0.4, rnd() * 6.28, (rnd() - 0.5) * 0.4); q.setFromEuler(e); sv.setScalar(s);
        mtx.compose(p, q, sv); im.setMatrixAt(i, mtx);
        if (v.size.x * s > 0.22) this.fixed(this.ctx.RAPIER.ColliderDesc.ball(v.size.y * s * 0.45).setTranslation(x, p.y + v.size.y * s * 0.4, z), { kind: 'rock', surface: 'rock' });
      });
      im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere(); this.scene.add(im);
    });
  }

  buildRockFaces() {
    const faces = [...this.variants('rock_face_01'), ...this.variants('rock_face_02')];
    const spots = [];
    // a broken rocky ridge along the north and east edges, plus a few around the outcrop
    for (let i = 0; i < 18; i++) { const x = -38 + i * 4.4 + (rnd() - 0.5) * 2, z = -40 + (rnd() - 0.5) * 3; spots.push([x, z, 1.2 + rnd() * 0.8]); }
    for (let i = 0; i < 10; i++) { const z = -30 + i * 6 + (rnd() - 0.5) * 2; spots.push([40 + (rnd() - 0.5) * 3, z, 1.0 + rnd() * 0.8]); }
    for (let i = 0; i < 5; i++) { const a = 0.6 + i * 1.1; spots.push([OUTCROP.x + Math.cos(a) * 8.5, OUTCROP.z + Math.sin(a) * 8.5, 0.6 + rnd() * 0.3]); }
    for (const [x, z, s] of spots) {
      if (this.terrain.isWater(x, z) || Math.hypot(x - PATH3[PATH3.length - 1][0], z - PATH3[PATH3.length - 1][1]) < 4) continue;
      const v = faces[Math.floor(rnd() * faces.length)];
      const m = this.place(v, null, new THREE.Vector3(x, this.terrain.heightAt(x, z) - 0.4 * s, z), rnd() * 6.28, s);
      this.hull(v.geo, m.matrixWorld, { kind: 'rock', surface: 'rock' });
    }
  }

  // ---------------------------------------------------------------- logs & stumps
  buildLogsStumps() {
    const { assets } = this.ctx, M = assets.mats, R = this.ctx.RAPIER;
    const trunk1 = this.variants('dead_tree_trunk')[0], trunk2 = this.variants('dead_tree_trunk_02')[0];
    LOGS.forEach(([x1, z1, x2, z2, r, hollow], i) => {
      const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2, len = Math.hypot(x2 - x1, z2 - z1);
      const yaw = -Math.atan2(z2 - z1, x2 - x1);
      if (hollow) {
        const g = assets.models.log_hollow.scene; const grp = new THREE.Group();
        for (const o of meshes(g)) { const mm = new THREE.Mesh(o.geometry, M.barkLog); mm.castShadow = mm.receiveShadow = true; grp.add(mm); }
        const y = Math.max(this.terrain.heightAt(x1, z1), this.terrain.heightAt(x2, z2)) + r * 0.7;
        grp.position.set(cx, y, cz); grp.rotation.y = yaw; grp.scale.set(len / 5.2, r / 0.36, r / 0.36);
        this.scene.add(grp); grp.updateMatrixWorld(true);
        grp.children.forEach((c) => this.trimesh(c.geometry, c.matrixWorld, { kind: 'log', surface: 'wood' }));
        this.logs.push({ x1, z1, x2, z2, r, y, group: grp, hollow });
        return;
      }
      const v = i === 0 ? trunk1 : trunk2;
      const along = v.size.x >= v.size.z ? 'x' : 'z';
      const L0 = along === 'x' ? v.size.x : v.size.z;
      const s = i === 0 ? 1.45 : (len / L0) * 0.9;
      const yb = i === 0 ? WORLD.waterY + 0.02 : Math.min(this.terrain.heightAt(x1, z1), this.terrain.heightAt(x2, z2)) - 0.05;
      const m = this.place(v, null, new THREE.Vector3(cx, yb, cz), yaw + (along === 'z' ? Math.PI / 2 : 0), s);
      this.trimesh(v.geo, m.matrixWorld, { kind: 'log', surface: 'wood' });
      this.logs.push({ x1, z1, x2, z2, r: v.size.y * s / 2, y: yb + v.size.y * s / 2, mesh: m });
    });
    const sv = [this.variants('tree_stump_01')[0], this.variants('tree_stump_02')[0]];
    STUMPS.forEach(([x, z, r, h], i) => {
      const v = sv[i % 2];
      const s = i === 0 ? 0.9 / v.size.y : Math.max(0.55, (r * 2.6) / Math.max(v.size.x, v.size.z));
      const y = this.terrain.heightAt(x, z) - 0.04;
      const m = this.place(v, null, new THREE.Vector3(x, y, z), i * 2.1, s);
      this.trimesh(v.geo, m.matrixWorld, { kind: 'stump', surface: 'wood' });
      this.stumps.push({ x, z, r, top: y + v.size.y * s });
    });
  }

  buildOutcrop() {
    const { assets } = this.ctx, M = assets.mats;
    const src = meshes(assets.models.outcrop.scene)[0];
    const m = new THREE.Mesh(src.geometry, M.rockOutcrop);
    m.position.set(OUTCROP.x, OUTCROP.base - 0.05, OUTCROP.z); m.rotation.y = OUTCROP.yaw;
    m.castShadow = true; m.receiveShadow = true; this.scene.add(m); m.updateMatrixWorld(true);
    this.trimesh(src.geometry, m.matrixWorld, { kind: 'outcrop', surface: 'rock' });
    this.outcrop = m; this.outcropTop = new THREE.Box3().setFromObject(m).max.y;
  }

  // ---------------------------------------------------------------- water + waterfall
  buildWater() {
    const T = this.terrain, { assets } = this.ctx;
    const N = T.res + 1, wy = T.waterY;
    const pos = [], depth = [], idx = [], map = new Int32Array(N * N).fill(-1);
    const vert = (i, j) => {
      const k = j * N + i; if (map[k] >= 0) return map[k];
      map[k] = pos.length / 3; pos.push(-T.half + i * T.cell, wy, -T.half + j * T.cell); depth.push(Math.max(0, wy - T.h[k])); return map[k];
    };
    for (let j = 0; j < T.res; j++) for (let i = 0; i < T.res; i++) {
      const hs = [T.h[j * N + i], T.h[j * N + i + 1], T.h[(j + 1) * N + i], T.h[(j + 1) * N + i + 1]];
      if (Math.min(...hs) > wy + 0.02) continue;
      const a = vert(i, j), b = vert(i + 1, j), c = vert(i, j + 1), d = vert(i + 1, j + 1);
      idx.push(a, c, b, b, c, d);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('depth', new THREE.Float32BufferAttribute(depth, 1));
    geo.setIndex(idx); geo.computeVertexNormals();
    this.sim = new WaterSim(this.ctx.renderer, T, { N: this.ctx.tier.rich ? 256 : 192, size: 10 });
    const mat = makeWaterMaterial(this.ctx.tier, assets, this.sim);
    this.water = new THREE.Mesh(geo, mat); this.water.renderOrder = 2; this.water.receiveShadow = true; this.scene.add(this.water);
    this.waterU = mat.userData.uniforms;
    this.buildWaterfall(wy);
  }

  // ---------------------------------------------------------------- grass: scanned clump cards
  buildGrass() {
    const tier = this.ctx.tier, M = this.ctx.assets.mats;
    this.grassPlayer = { value: new THREE.Vector3(0, -99, 0) };
    const prev = M.grass.onBeforeCompile;
    this.grassTrample = { value: Array.from({ length: 24 }, () => new THREE.Vector4(0, -99, 0, 0)) };
    M.grass.onBeforeCompile = (sh, r) => {
      sh.uniforms.uPlayer = this.grassPlayer; sh.uniforms.uTrample = this.grassTrample;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform vec3 uPlayer; uniform vec4 uTrample[24];');
      prev(sh, r);
      leafLight(sh, 0.8);
      // grass stays flattened where the robot has stepped, slowly springing back
      sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>', `
        {
          vec4 wq = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            wq = instanceMatrix * wq;
          #endif
          wq = modelMatrix * wq;
          float flatK = 0.0; vec2 away = vec2(0.0);
          for (int i = 0; i < 24; i++) {
            vec2 d = wq.xz - uTrample[i].xz; float dl = length(d);
            float f = uTrample[i].w * smoothstep(0.11, 0.03, dl);
            if (f > flatK) { flatK = f; away = d / max(dl, 1e-3); }
          }
          float hgt = uv.y;
          transformed.y *= 1.0 - 0.8 * flatK;
          transformed.xz += away * flatK * hgt * 0.06;
        }
        #include <project_vertex>`);
    };
    M.grass.customProgramCacheKey = () => 'grassTrample';
    const geos = GRASS_SPRITES.map((spr) => grassCardGeometry(spr));
    const CH = 8, density = 7 * tier.grassDensity;
    const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    for (let cz = -40; cz < 40; cz += CH) for (let cx = -40; cx < 40; cx += CH) {
      const items = [[], [], [], [], []];
      const n = Math.floor(CH * CH * density);
      for (let i = 0; i < n; i++) {
        const x = cx + rnd() * CH, z = cz + rnd() * CH;
        const g = this.terrain.grassAt(x, z) * (1 - 0.85 * smoothstep(0.2, 0.7, this.canopy(x, z))) * (0.35 + 0.65 * this.patch(x, z, 0.11, 11));
        if (rnd() > g * g * 1.6 || this.terrain.isWater(x, z)) continue;
        items[Math.floor(rnd() * 5)].push([x, z, g]);
      }
      items.forEach((list, k) => {
        if (!list.length) return;
        const im = new THREE.InstancedMesh(geos[k], M.grass, list.length);
        list.forEach(([x, z, g], i) => {
          q.setFromAxisAngle(UP, rnd() * 6.28); const sc = 0.12 + rnd() * 0.16 + g * 0.08;
          s.set(sc, sc * (0.8 + rnd() * 0.5), sc); p.set(x, this.terrain.heightAt(x, z) - 0.01, z);
          mtx.compose(p, q, s); im.setMatrixAt(i, mtx);
        });
        im.receiveShadow = true; im.castShadow = false; im.computeBoundingSphere();
        im.userData.center = new THREE.Vector3(cx + CH / 2, 0, cz + CH / 2); im.userData.full = list.length;
        this.scene.add(im); this.grassChunks.push(im);
      });
    }
  }

  // ---------------------------------------------------------------- ferns + ground plants + debris (scanned)
  // ---------------------------------------------------------------- ecology
  // canopy cover (0 open sky .. 1 dense crowns) on a 1 m grid, from the planted trees
  buildCanopy() {
    const N = 96; this.canopyN = N; const keep = new Float32Array(N * N).fill(1);
    for (const t of this.treeSpots) {
      const R = (t.t.startsWith('fir') ? 2.8 : 3.4) * t.s, dens = t.t.startsWith('fir') ? 0.6 : 0.5;
      for (let j = Math.max(0, Math.floor(t.z + 48 - R)); j <= Math.min(N - 1, Math.ceil(t.z + 48 + R)); j++)
        for (let i = Math.max(0, Math.floor(t.x + 48 - R)); i <= Math.min(N - 1, Math.ceil(t.x + 48 + R)); i++) {
          const d = Math.hypot(i - 48 + 0.5 - t.x, j - 48 + 0.5 - t.z) / R; if (d < 1) keep[j * N + i] *= 1 - dens * (1 - d * d);
        }
    }
    this.canopyGrid = keep.map((k) => 1 - k);
  }
  canopy(x, z) {
    const N = this.canopyN, i = clamp(Math.floor(x + 48), 0, N - 1), j = clamp(Math.floor(z + 48), 0, N - 1);
    return this.canopyGrid[j * N + i];
  }
  // clustered patches: plants of a kind grow in groups rather than evenly
  patch(x, z, freq, seed) { return smoothstep(-0.15, 0.45, fbm(nzEco, x * freq + seed * 17.1, z * freq - seed * 9.3, 3)); }
  waterDist(x, z) { return Math.min(distToPolyline(x, z, STREAM).d, Math.max(0, Math.hypot(x - POND.x, (z - POND.z) * 1.1) - POND.r)); }
  nearestTrunk(x, z) {
    let best = 1e9, bt = null;
    for (const t of this.treeSpots) { const d = (t.x - x) ** 2 + (t.z - z) ** 2; if (d < best) { best = d; bt = t; } }
    return { d: Math.sqrt(best), t: bt };
  }
  onRock(x, z) { for (const r of this.rocks) if ((r.x - x) ** 2 + (r.z - z) ** 2 < (r.r * 0.85) ** 2) return true; return false; }

  buildPlants() {
    const tier = this.ctx.tier, M = this.ctx.assets.mats, T = this.terrain;
    this.buildCanopy();
    this.scatters = [];
    const windMats = new Map();
    const windy = (mat, amt) => {
      const key = mat.uuid + amt; if (windMats.has(key)) return windMats.get(key);
      const m = mat.clone();
      patchMaterial(m, { ao: false, wind: `transformed += windOffset(wp0.xyz, ${amt.toFixed(3)} * smoothstep(0.0, 0.6, position.y), wp0.x + wp0.z);`, key: 'w' + amt + 'leaf',
        extraFrag: (sh) => leafLight(sh, 1) });
      windMats.set(key, m); return m;
    };
    const k = tier.fernDensity;
    // generic ecological scatter: density per m^2 * rule(x,z) probability, variants chosen at random
    const add = (vars, { density, rule, scale, wind = 0, cast = true, align = 0.5, sink = 0.015, radius = 30, area = 84, mat = null, tilt = 0 }) => {
      if (!Array.isArray(vars)) vars = this.variants(vars);
      const lists = vars.map(() => []);
      const n = Math.round(area * area * density * k);
      for (let i = 0; i < n; i++) {
        const x = (rnd() - 0.5) * area, z = (rnd() - 0.5) * area;
        const pr = rule(x, z); if (pr <= 0 || rnd() > pr) continue;
        if (T.isWater(x, z) || this.onRock(x, z)) continue;
        lists[Math.floor(rnd() * vars.length)].push([x, z, scale[0] + rnd() * (scale[1] - scale[0])]);
      }
      vars.forEach((v, vi) => {
        const L = lists[vi]; if (!L.length) return;
        const data = new Float32Array(L.length * 8);
        L.forEach(([x, z, sc], i) => {
          data.set([x, T.heightAt(x, z) - sink * sc, z, rnd() * 6.283, sc, (rnd() - 0.5) * tilt, (rnd() - 0.5) * tilt, rnd()], i * 8);
        });
        const material = mat || (wind ? windy(v.mat, wind) : v.mat);
        this.scatters.push(new Scatter(this.scene, v.geo, material, data, { radius, cast, align, terrain: T }));
      });
    };
    const shade = (x, z) => this.canopy(x, z);
    const offPath = (x, z, c = 0.6) => Math.min(distToPolyline(x, z, PATH).d, distToPolyline(x, z, PATH2).d, distToPolyline(x, z, PATH3).d) > c && Math.hypot(x - START.x, z - START.z) > 1.4;
    const pines = this.treeSpots.filter((t) => t.t.startsWith('pine'));
    const nearPine = (x, z, R) => { let best = 1e9; for (const t of pines) { const d = (t.x - x) ** 2 + (t.z - z) ** 2; if (d < best) best = d; } return Math.sqrt(best) < R ? 1 - Math.sqrt(best) / R : 0; };

    // ---- plants (scanned)
    add('fern_02', { density: 0.32, scale: [0.4, 0.95], wind: 0.03, radius: 38, align: 0.35,
      rule: (x, z) => offPath(x, z, 0.9) ? smoothstep(0.25, 0.65, shade(x, z)) * this.patch(x, z, 0.09, 1) * 1.4 : 0 });
    // bracken and fern on the open, sunny slopes too (otherwise the hillsides read as bare sand)
    add('fern_02', { density: 0.16, scale: [0.55, 1.1], wind: 0.03, radius: 42, align: 0.35,
      rule: (x, z) => offPath(x, z, 1.2) ? smoothstep(0.4, 0.08, shade(x, z)) * this.patch(x, z, 0.08, 11) * 1.3 : 0 });
    add('nettle_plant', { density: 0.22, scale: [0.8, 1.6], wind: 0.02, radius: 26, align: 0.3,
      rule: (x, z) => { const w = this.waterDist(x, z); return offPath(x, z, 0.6) ? (smoothstep(5, 1.2, w) * 0.9 + 0.15 * smoothstep(0.4, 0.1, shade(x, z))) * this.patch(x, z, 0.15, 2) : 0; } });
    add('periwinkle_plant', { density: 0.1, scale: [0.6, 1.1], wind: 0.02, radius: 24, align: 0.4,
      rule: (x, z) => offPath(x, z, 0.6) ? smoothstep(0.1, 0.4, shade(x, z)) * (1 - smoothstep(0.55, 0.8, shade(x, z))) * this.patch(x, z, 0.12, 3) : 0 });
    add('dandelion_01', { density: 0.08, scale: [0.8, 1.3], wind: 0.01, radius: 20, cast: false, align: 0.6,
      rule: (x, z) => offPath(x, z, 0.5) ? smoothstep(0.35, 0.05, shade(x, z)) * this.patch(x, z, 0.2, 4) : 0 });
    add('weed_plant_02', { density: 0.06, scale: [0.8, 1.4], wind: 0.01, radius: 18, cast: false, align: 0.7,
      rule: (x, z) => offPath(x, z, 0.4) ? 0.3 + 0.7 * this.patch(x, z, 0.25, 5) : 0 });
    add('shrub_03', { density: 0.06, scale: [1.0, 1.9], wind: 0.03, radius: 34, align: 0.3,
      rule: (x, z) => offPath(x, z, 1) ? smoothstep(0.15, 0.45, shade(x, z)) * this.patch(x, z, 0.07, 6) : 0 });
    add('shrub_04', { density: 0.01, scale: [0.9, 1.5], wind: 0.02, radius: 34, align: 0.3, rule: (x, z) => offPath(x, z, 1.2) ? this.patch(x, z, 0.06, 7) : 0 });

    // ---- forest floor detail (dense near the camera; this is what a 35 cm robot sees)
    add([this.variants('pinecone_0')[0], this.variants('pinecone_1')[0], this.variants('pinecone_2')[0]], { density: 1.4, scale: [0.85, 1.25], radius: 12, align: 1, sink: 0.05, tilt: 0.8,
      rule: (x, z) => offPath(x, z, 0.35) ? nearPine(x, z, 4.5) * (0.4 + 0.6 * this.patch(x, z, 0.5, 8)) : 0 });
    add('dry_branches_medium_01', { density: 0.08, scale: [0.45, 1.0], radius: 26, align: 1, sink: 0.1, rule: (x, z) => offPath(x, z, 0.5) ? 0.2 + 0.8 * shade(x, z) : 0 });
    add('bark_debris_01', { density: 0.12, scale: [0.7, 1.3], radius: 14, align: 1, sink: 0.05, cast: false, rule: (x, z) => offPath(x, z, 0.4) ? nearPine(x, z, 2.6) : 0 });
    add('moss_01', { density: 0.9, scale: [1.2, 2.2], radius: 14, align: 1, sink: 0.1, cast: false,
      rule: (x, z) => { const n = this.nearestTrunk(x, z); return (n.d < 1.6 ? 1 - n.d / 1.6 : 0) * 0.8 + smoothstep(3, 0.8, this.waterDist(x, z)) * 0.3 * shade(x, z); } });
    add([...this.variants('namaqualand_stones_01'), ...this.variants('rock_09')], { density: 0.06, scale: [0.6, 1.5], radius: 16, align: 1, sink: 0.25, cast: false,
      rule: (x, z) => (distToPolyline(x, z, PATH).d < 1.3 ? 0.9 : 0.15) + smoothstep(3, 1, this.waterDist(x, z)) * 0.8 });
    add('root_cluster_01', { density: 0.004, scale: [0.6, 1.0], radius: 30, align: 1, sink: 0.05, rule: (x, z) => { const n = this.nearestTrunk(x, z); return n.d < 2.2 && n.d > 0.5 ? 1 : 0; } });
    // fallen fir twigs: brown needle sprays lying on the litter under the crowns
    const twigCards = [[0.31, 0.41, 0.64, 0.78], [0.64, 0.46, 0.95, 0.83], [0.65, 0.04, 0.94, 0.37], [0.19, 0.05, 0.42, 0.31]].map((r) => ({ geo: lyingCard(r), mat: null }));
    const deadTwig = new THREE.MeshStandardMaterial({ map: this.ctx.assets.tex.twig.map, normalMap: this.ctx.assets.tex.twig.normal, alphaTest: 0.45, side: THREE.DoubleSide,
      color: new THREE.Color(0.62, 0.42, 0.24), roughness: 0.9, metalness: 0 });
    add(twigCards, { density: 2.2, scale: [0.12, 0.3], radius: 11, align: 1, sink: -0.004, cast: false, mat: deadTwig,
      rule: (x, z) => offPath(x, z, 0.3) ? smoothstep(0.15, 0.6, shade(x, z)) : 0 });
    // mushrooms: shady, damp spots in small clusters; shelf fungus on logs and stumps
    add('mush_amanita', { density: 0.02, scale: [0.7, 1.25], radius: 18, align: 0.6, sink: 0.01,
      rule: (x, z) => offPath(x, z, 0.6) ? nearPine(x, z, 5) * smoothstep(0.35, 0.7, shade(x, z)) * smoothstep(0.55, 0.8, this.patch(x, z, 0.3, 9)) * 3 : 0 });
    add('mush_bolete', { density: 0.02, scale: [0.6, 1.2], radius: 16, align: 0.6, sink: 0.01,
      rule: (x, z) => offPath(x, z, 0.6) ? smoothstep(0.4, 0.75, shade(x, z)) * smoothstep(0.55, 0.8, this.patch(x, z, 0.3, 10)) * 3 : 0 });
    this.placeLogFungi();
  }

  placeLogFungi() {
    const cl = this.variants('mush_cluster')[0], br = this.variants('mush_bracket')[0];
    const spots = [];
    for (const s of this.stumps) for (let i = 0; i < 3; i++) { const a = rnd() * 6.28; spots.push({ v: i ? cl : br, x: s.x + Math.cos(a) * s.r * 1.25, z: s.z + Math.sin(a) * s.r * 1.25, y: null, rot: a }); }
    for (const l of this.logs) for (let i = 0; i < 5; i++) {
      const t = 0.15 + rnd() * 0.7, x = l.x1 + (l.x2 - l.x1) * t, z = l.z1 + (l.z2 - l.z1) * t;
      const side = rnd() < 0.5 ? 1 : -1, nx = -(l.z2 - l.z1), nz = l.x2 - l.x1, nl = Math.hypot(nx, nz) || 1;
      spots.push({ v: rnd() < 0.5 ? br : cl, x: x + nx / nl * side * (l.r + 0.03), z: z + nz / nl * side * (l.r + 0.03), y: l.y - l.r * 0.2, rot: Math.atan2(nx * side, nz * side) });
    }
    for (const sp of spots) {
      if (this.terrain.isWater(sp.x, sp.z)) continue;
      const m = this.place(sp.v, null, new THREE.Vector3(sp.x, sp.y ?? this.terrain.heightAt(sp.x, sp.z) - 0.01, sp.z), sp.rot, 0.8 + rnd() * 0.6);
      m.castShadow = true;
    }
  }

  buildShafts() {
    const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uI: { value: 1 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform float uTime, uI; varying vec2 vUv;
        void main(){ float e = smoothstep(0.0,0.5,vUv.x)*smoothstep(1.0,0.5,vUv.x); float v = smoothstep(0.0,0.35,vUv.y) * smoothstep(1.0,0.6,vUv.y);
          float fl = 0.75 + 0.25*sin(uTime*0.4 + vUv.x*3.0); gl_FragColor = vec4(vec3(1.0,0.93,0.78) * e * v * 0.035 * fl * uI, 1.0); }` });
    this.shaftMat = mat;
    const sun = this.ctx.sunDir.clone().normalize();
    for (let i = 0; i < 7; i++) {
      const x = START.x + (rnd() - 0.5) * 12, z = START.z - 3 + (rnd() - 0.5) * 12, h = 16, w = 0.8 + rnd() * 1.4;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      m.position.set(x, this.terrain.heightAt(x, z), z).addScaledVector(sun, h * 0.5);
      m.quaternion.setFromUnitVectors(UP, sun); m.rotateY(rnd() * 3);
      m.renderOrder = 4; this.scene.add(m);
    }
  }

  updateTreeLods(camPos) {
    const R = this.ctx.tier.treeLod0Dist, R2 = R * R;
    for (const g of this.treeLods) {
      let n0 = 0, n1 = 0;
      const a0 = g.lod0.map((m) => m.instanceMatrix.array), a1 = g.lod1.map((m) => m.instanceMatrix.array);
      g.list.forEach((t, i) => {
        const near = (t.x - camPos.x) ** 2 + (t.z - camPos.z) ** 2 < R2;
        const src = g.mats.subarray(i * 16, i * 16 + 16);
        if (near) { for (const a of a0) a.set(src, n0 * 16); n0++; } else { for (const a of a1) a.set(src, n1 * 16); n1++; }
      });
      for (const m of g.lod0) { m.count = n0; m.instanceMatrix.needsUpdate = true; }
      for (const m of g.lod1) { m.count = n1; m.instanceMatrix.needsUpdate = true; }
    }
  }

  update(dt, time, camPos, playerPos) {
    WIND.time.value = time;
    if (this.treeLods && camPos) {
      this.lodT += dt;
      if (this.lodT > 0.3 || !this.lodCam || this.lodCam.distanceToSquared(camPos) > 4) { this.lodT = 0; this.lodCam = (this.lodCam || new THREE.Vector3()).copy(camPos); this.updateTreeLods(camPos); }
    }
    if (this.waterU) this.waterU.uTime.value = time;
    if (this.sim && playerPos) {
      // the waterfall keeps churning the pool when it is inside the simulated window
      const wf = this.waterfallPos;
      if (Math.abs(wf.x - playerPos.x) < 6 && Math.abs(wf.z - playerPos.z) < 6) for (let i = 0; i < 2; i++) this.sim.drop(wf.x + (Math.random() - 0.5) * 1.4, wf.z + (Math.random() - 0.5) * 0.6, 0.12, (Math.random() - 0.5) * 0.05);
      this.sim.update(dt, playerPos);
    }
    if (this.fallU) this.fallU.uTime.value = time;
    this.shaftMat.uniforms.uTime.value = time;
    if (playerPos) this.grassPlayer.value.copy(playerPos);
    if (this.scatters) for (const sc of this.scatters) sc.update(camPos);
    const R = this.ctx.tier.grassRadius;
    for (const im of this.grassChunks) {
      const d = Math.hypot(im.userData.center.x - camPos.x, im.userData.center.z - camPos.z);
      const k = d < R * 0.5 ? 1 : d < R ? 1 - (d - R * 0.5) / (R * 0.5) * 0.7 : d < R * 1.6 ? 0.25 * (1 - (d - R) / (R * 0.6)) : 0;
      im.count = Math.floor(im.userData.full * clamp(k, 0, 1)); im.visible = im.count > 0;
    }
  }
}

// three crossed vertical cards showing one scanned grass clump sprite
function grassCardGeometry([x0, y0, x1, y1]) {
  const aspect = (x1 - x0) / (y1 - y0);
  const w = aspect, h = 1;
  const pos = [], uv = [], idx = [];
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI, c = Math.cos(a) * w / 2, s = Math.sin(a) * w / 2, b = pos.length / 3;
    pos.push(-c, 0, -s, c, 0, s, c, h, s, -c, h, -s);
    // atlas textures keep the image top at v=0, so v equals the image y coordinate
    uv.push(x0, y1, x1, y1, x1, y0, x0, y0);
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  const n = g.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0); // soft, even lighting like real grass
  return g;
}

// Instanced scatter whose visible set follows the camera: dense near, thinned with distance, none beyond `radius`.
class Scatter {
  constructor(scene, geo, mat, data, { radius = 30, cast = true, align = 0.5, terrain }) {
    this.data = data; this.n = data.length / 8; this.radius = radius; this.align = align; this.terrain = terrain;
    const est = Math.min(this.n, Math.max(64, Math.ceil(this.n * Math.min(1, (Math.PI * radius * radius) / (84 * 84)) * 2.2)));
    this.mesh = new THREE.InstancedMesh(geo, mat, est); this.cap = est;
    this.mesh.castShadow = cast; this.mesh.receiveShadow = true; this.mesh.count = 0; this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.last = new THREE.Vector3(1e9, 0, 0);
    this.normals = new Float32Array(this.n * 3);
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < this.n; i++) {
      const nrm = terrain.normalAt(data[i * 8], data[i * 8 + 2]).lerp(up, 1 - align).normalize();
      this.normals.set([nrm.x, nrm.y, nrm.z], i * 3);
    }
  }
  update(cam) {
    if (cam.distanceToSquared(this.last) < 2.25) return;
    this.last.copy(cam);
    const d = this.data, R = this.radius, R2 = R * R, m = new THREE.Matrix4(), q = new THREE.Quaternion(), q2 = new THREE.Quaternion(),
      e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3(), nv = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    let c = 0;
    for (let i = 0; i < this.n && c < this.cap; i++) {
      const o = i * 8, dx = d[o] - cam.x, dz = d[o + 2] - cam.z, dd = dx * dx + dz * dz;
      if (dd > R2) continue;
      const keep = dd < R2 * 0.3 ? 1 : 1 - (Math.sqrt(dd) - R * 0.55) / (R * 0.45);
      if (d[o + 7] > keep) continue;
      nv.set(this.normals[i * 3], this.normals[i * 3 + 1], this.normals[i * 3 + 2]);
      q.setFromUnitVectors(up, nv); e.set(d[o + 5], d[o + 3], d[o + 6]); q2.setFromEuler(e); q.multiply(q2);
      s.setScalar(d[o + 4]); p.set(d[o], d[o + 1], d[o + 2]);
      m.compose(p, q, s); this.mesh.setMatrixAt(c++, m);
    }
    this.mesh.count = c; this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// a twig sprite lying flat on the ground with a slight arch
function lyingCard([x0, y0, x1, y1]) {
  const asp = (x1 - x0) / (y1 - y0), g = new THREE.PlaneGeometry(asp, 1, 2, 4);
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i), py = pos.getY(i);
    pos.setXYZ(i, px, 0.012 * Math.cos(py * Math.PI) + 0.006 * Math.abs(px), -py);
    uv.setXY(i, x0 + (uv.getX(i)) * (x1 - x0), y1 - uv.getY(i) * (y1 - y0));
  }
  g.computeVertexNormals();
  const n = g.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
  return g;
}
