// Builds the pine-forest region from scanned (Poly Haven, CC0) assets processed in Blender:
// terrain with scanned ground layers, conifers with scanned bark/twigs + scanned pine roots, mossy boulders,
// stumps, dead trunks, rock faces, ferns and ground plants, grass cards, water + waterfall, and physics colliders.
import * as THREE from 'three';
import { mulberry32, smoothstep, distToPolyline, clamp } from './util.js';
import { WORLD, PATH, PATH2, PATH3, STREAM, POND, OUTCROP, HERO_TREES, BOULDERS, LOGS, STUMPS, START } from './layout.js';
import { Terrain } from './terrain.js';
import { patchMaterial, WIND } from './shaders.js';
import { TREES, SAPLINGS } from './assets.js';
import { WaterSim, makeWaterMaterial } from './water.js';

const rnd = mulberry32(2024);
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
    this.buildGrass();
    this.buildPlants();
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
    M.grass.onBeforeCompile = (sh, r) => {
      sh.uniforms.uPlayer = this.grassPlayer;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform vec3 uPlayer;');
      prev(sh, r);
    };
    const geos = GRASS_SPRITES.map((spr) => grassCardGeometry(spr));
    const CH = 8, density = 7 * tier.grassDensity;
    const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    for (let cz = -40; cz < 40; cz += CH) for (let cx = -40; cx < 40; cx += CH) {
      const items = [[], [], [], [], []];
      const n = Math.floor(CH * CH * density);
      for (let i = 0; i < n; i++) {
        const x = cx + rnd() * CH, z = cz + rnd() * CH;
        const g = this.terrain.grassAt(x, z);
        if (rnd() > g * g * 1.3 || this.terrain.isWater(x, z)) continue;
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
  buildPlants() {
    const tier = this.ctx.tier;
    const windMats = new Map();
    const windy = (mat, amt) => {
      if (windMats.has(mat)) return windMats.get(mat);
      const m = mat.clone();
      patchMaterial(m, { ao: false, wind: `transformed += windOffset(wp0.xyz, ${amt.toFixed(3)} * smoothstep(0.0, 0.6, position.y), wp0.x + wp0.z);` });
      windMats.set(mat, m); return m;
    };
    const scatter = (key, count, rule, scaleR, wind = 0, cast = true) => {
      const vars = this.variants(key);
      const per = vars.map(() => []);
      let tries = 0, placed = 0;
      while (placed < count && tries++ < count * 30) {
        const r = rule(); if (!r) continue;
        const [x, z] = r;
        per[Math.floor(rnd() * vars.length)].push([x, z, scaleR[0] + rnd() * (scaleR[1] - scaleR[0])]); placed++;
      }
      const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler();
      vars.forEach((v, k) => {
        const list = per[k]; if (!list.length) return;
        const im = new THREE.InstancedMesh(v.geo, wind ? windy(v.mat, wind) : v.mat, list.length);
        list.forEach(([x, z, sc], i) => {
          const n = this.terrain.normalAt(x, z);
          q.setFromUnitVectors(UP, n.lerp(UP, 0.5).normalize()).multiply(new THREE.Quaternion().setFromAxisAngle(UP, rnd() * 6.28));
          s.setScalar(sc); p.set(x, this.terrain.heightAt(x, z) - 0.015, z); mtx.compose(p, q, s); im.setMatrixAt(i, mtx);
        });
        im.castShadow = cast; im.receiveShadow = true; im.computeBoundingSphere(); this.scene.add(im);
      });
    };
    const k = tier.fernDensity;
    const nearTree = (minD, maxD) => () => {
      const t = this.treeSpots[Math.floor(rnd() * this.treeSpots.length)];
      if (Math.max(Math.abs(t.x), Math.abs(t.z)) > 44) return null;
      const a = rnd() * 6.28, d = minD + rnd() * (maxD - minD), x = t.x + Math.cos(a) * d, z = t.z + Math.sin(a) * d;
      return this.okSpot(x, z, 0.9) ? [x, z] : null;
    };
    const anywhere = (clear = 0.8) => () => { const x = (rnd() - 0.5) * 86, z = (rnd() - 0.5) * 86; return this.okSpot(x, z, clear) ? [x, z] : null; };
    const nearWater = () => { const i = Math.floor(rnd() * (STREAM.length - 1)), t = rnd(); const [ax, az] = STREAM[i], [bx, bz] = STREAM[i + 1];
      const a = rnd() * 6.28, d = 1.8 + rnd() * 1.6; const x = ax + (bx - ax) * t + Math.cos(a) * d, z = az + (bz - az) * t + Math.sin(a) * d;
      return this.okSpot(x, z, 0.6) ? [x, z] : null; };
    const clearing = () => { const a = rnd() * 6.28, d = 1.5 + rnd() * 6; const x = START.x + Math.cos(a) * d, z = START.z - 1.5 + Math.sin(a) * d;
      return distToPolyline(x, z, PATH).d > 0.7 && Math.hypot(x - START.x, z - START.z) > 1.2 ? [x, z] : null; };
    scatter('fern_02', Math.round(420 * k), () => (rnd() < 0.7 ? nearTree(1.2, 4.5)() : nearWater()), [0.45, 0.9], 0.03);
    scatter('nettle_plant', Math.round(260 * k), () => (rnd() < 0.5 ? nearWater() : anywhere(0.7)()), [0.9, 1.6], 0.02);
    scatter('periwinkle_plant', Math.round(180 * k), () => (rnd() < 0.5 ? nearTree(0.8, 3)() : clearing()), [0.7, 1.2], 0.02);
    scatter('dandelion_01', Math.round(160 * k), clearing, [0.8, 1.3], 0.01, false);
    scatter('weed_plant_02', Math.round(200 * k), anywhere(0.5), [0.8, 1.4], 0.01, false);
    scatter('shrub_03', Math.round(120 * k), () => (rnd() < 0.6 ? nearTree(1.5, 5)() : nearWater()), [1.0, 1.8], 0.03);
    scatter('shrub_04', Math.round(40 * k), nearTree(2, 5), [0.9, 1.5], 0.02);
    scatter('moss_01', Math.round(500 * k), () => (rnd() < 0.6 ? nearTree(0.4, 1.4)() : (() => { const r = this.rocks[Math.floor(rnd() * this.rocks.length)]; const a = rnd() * 6.28, d = r.r * (0.9 + rnd() * 0.4); return [r.x + Math.cos(a) * d, r.z + Math.sin(a) * d]; })()), [2, 4], 0, false);
    scatter('dry_branches_medium_01', Math.round(90 * k), anywhere(0.6), [0.5, 1.0], 0, true);
    scatter('root_cluster_02', Math.round(40 * k), nearTree(0.6, 2.2), [0.8, 1.3], 0, true);
    scatter('single_root', Math.round(20 * k), nearTree(0.5, 1.5), [0.8, 1.2], 0, true);
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
