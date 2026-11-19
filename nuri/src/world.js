// Builds the pine-forest region from scanned (Poly Haven, CC0) assets processed in Blender:
// terrain with scanned ground layers, conifers with scanned bark/twigs + scanned pine roots, mossy boulders,
// stumps, dead trunks, rock faces, ferns and ground plants, grass cards, water + waterfall, and physics colliders.
import * as THREE from 'three';
import { mulberry32, smoothstep, distToPolyline, clamp, makeNoise2D, fbm } from './util.js';
import { WORLD, PATH, PATH2, PATH3, STREAM, POND, OUTCROP, HERO_TREES, BOULDERS, LOGS, STUMPS, START } from './layout.js';
import { Terrain } from './terrain.js';
import { patchMaterial, WIND } from './shaders.js';
import { TREES, SAPLINGS, SNAGS } from './assets.js';
import { WaterSim, makeWaterMaterial } from './water.js';

const rnd = mulberry32(2024);
const nzEco = makeNoise2D(4242);
const TREE_R0 = { pine_0: 0.36, pine_1: 0.4, pine_2: 0.34, pine_3: 0.38, fir_4: 0.27, fir_5: 0.26 };
const GRASS_SPRITES = [[0.207, 0.75, 0.496, 0.904], [0.605, 0.758, 0.826, 0.863], [0.252, 0.891, 0.49, 1.0], [0.598, 0.869, 0.789, 1.0], [0.051, 0.871, 0.18, 1.0]];
const UP = new THREE.Vector3(0, 1, 0);

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
    this.buildPlants();
    this.buildGrass();
    this.buildShafts();
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
  }

  buildTrees() {
    const { assets } = this.ctx, M = assets.mats, R = this.ctx.RAPIER;
    const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();
    const byT = {};
    const roots = this.variants('pine_roots');
    for (const t of this.treeSpots) {
      t.y = this.terrain.heightAt(t.x, t.z) - 0.03;
      const r0 = TREE_R0[t.t] * t.s;
      if (t.hero) {
        const ms = meshes(assets.models[t.t].scene);
        const grp = new THREE.Group();
        for (const o of ms) {
          const isBark = o.name.includes('bark');
          const m = new THREE.Mesh(o.geometry, isBark ? M.bark : M.twig);
          m.castShadow = true; m.receiveShadow = true; grp.add(m);
        }
        grp.position.set(t.x, t.y, t.z); grp.rotation.y = t.rot; grp.scale.setScalar(t.s);
        this.scene.add(grp); grp.updateMatrixWorld(true);
        const bark = grp.children.find((c, i) => ms[i].name.includes('bark'));
        this.trimesh(bark.geometry, bark.matrixWorld, { kind: 'tree', surface: 'wood' }, t.y + 2.5);
        // scanned pine roots spreading from the base
        const rv = roots[Math.floor(rnd() * roots.length)];
        const rs = r0 / 0.32;
        for (let k = 0; k < 2; k++) {
          const rm = this.place(rv, null, new THREE.Vector3(t.x, t.y - 0.05, t.z), t.rot + k * Math.PI * 0.9 + rnd(), new THREE.Vector3(rs, rs * (0.9 + rnd() * 0.3), rs));
          this.trimesh(rv.geo, rm.matrixWorld, { kind: 'root', surface: 'wood' });
        }
      } else (byT[t.t] = byT[t.t] || []).push(t);
      this.fixed(R.ColliderDesc.cylinder(4, r0 * 0.95).setTranslation(t.x, t.y + 4, t.z), { kind: 'tree', surface: 'wood' });
    }
    for (const [key, list] of Object.entries(byT)) {
      for (const o of meshes(assets.models[key + '_lod1'].scene)) {
        const im = new THREE.InstancedMesh(o.geometry, o.name.includes('bark') ? M.barkPlain : M.twig, list.length);
        list.forEach((t, i) => { q.setFromAxisAngle(UP, t.rot); sc.setScalar(t.s); p.set(t.x, t.y, t.z); mtx.compose(p, q, sc); im.setMatrixAt(i, mtx); });
        im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere(); this.scene.add(im);
      }
    }
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
      snags++;
    }
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
        for (const o of meshes(g)) { const mm = new THREE.Mesh(o.geometry, M.bark); mm.castShadow = mm.receiveShadow = true; grp.add(mm); }
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
    this.sim = new WaterSim(this.ctx.renderer, T, { N: this.ctx.tier.post ? 256 : 192, size: 10 });
    const mat = makeWaterMaterial(this.ctx.tier, assets, this.sim);
    this.water = new THREE.Mesh(geo, mat); this.water.renderOrder = 2; this.water.receiveShadow = true; this.scene.add(this.water);
    this.waterU = mat.userData.uniforms;
    const lip = new THREE.Vector3(OUTCROP.x - 3.5, this.outcropTop - 0.6, OUTCROP.z + 5.2);
    this.waterfallPos = new THREE.Vector3(lip.x, wy, lip.z + 1.0);
    const fg = new THREE.PlaneGeometry(1.6, 1, 8, 24), fp = fg.attributes.position;
    for (let i = 0; i < fp.count; i++) {
      const x = fp.getX(i), t = fp.getY(i) + 0.5, fall = 1 - t;
      fp.setXYZ(i, lip.x + x * (1 + fall * 0.35), lip.y + (wy - lip.y) * fall, lip.z + 0.35 * Math.sqrt(fall) + 0.6 * fall * fall);
    }
    const fu = { uTime: { value: 0 } };
    const fmat = new THREE.ShaderMaterial({ uniforms: fu, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform float uTime; varying vec2 vUv;
        float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
        float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
        void main(){ vec2 p = vec2(vUv.x * 9.0, vUv.y * 3.0 + uTime * 2.4);
          float s = n(p) * 0.6 + n(p * 2.3 + 4.0) * 0.4; float streak = smoothstep(0.35, 0.85, s);
          float edge = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
          gl_FragColor = vec4(mix(vec3(0.5,0.58,0.56), vec3(0.92,0.95,0.95), streak), (0.3 + 0.6 * streak) * edge * (0.6 + 0.4 * vUv.y));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }` });
    const fall = new THREE.Mesh(fg, fmat); fall.renderOrder = 3; this.scene.add(fall); this.fallU = fu;
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
      patchMaterial(m, { ao: false, wind: `transformed += windOffset(wp0.xyz, ${amt.toFixed(3)} * smoothstep(0.0, 0.6, position.y), wp0.x + wp0.z);`, key: 'w' + amt });
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
    add('dry_branches_medium_01', { density: 0.05, scale: [0.45, 1.0], radius: 26, align: 1, sink: 0.1, rule: (x, z) => offPath(x, z, 0.5) ? 0.2 + 0.8 * shade(x, z) : 0 });
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

  update(dt, time, camPos, playerPos) {
    WIND.time.value = time;
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
