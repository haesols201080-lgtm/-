// Builds the forest region: terrain, Blender-made trees/rocks/logs/stumps/outcrop, water + waterfall,
// grass, ferns, mushrooms, light shafts — and all their physics colliders.
import * as THREE from 'three';
import { mulberry32, makeNoise2D, fbm, smoothstep, distToPolyline, clamp } from './util.js';
import { WORLD, PATH, PATH2, PATH3, STREAM, POND, OUTCROP, HERO_TREES, BOULDERS, LOGS, STUMPS, START } from './layout.js';
import { Terrain } from './terrain.js';
import { patchMaterial, WIND } from './shaders.js';

const rnd = mulberry32(2024);
const nz = makeNoise2D(77);
const TREE_R0 = [0.62, 0.5, 0.7, 0.42, 0.58, 0.36];

function firstMesh(root, pred) { let m = null; root.traverse((o) => { if (!m && o.isMesh && (!pred || pred(o))) m = o; }); return m; }
function meshes(root) { const out = []; root.traverse((o) => { if (o.isMesh) out.push(o); }); return out; }

export class World {
  constructor(ctx) {
    this.ctx = ctx; // { scene, RAPIER, physics, assets, tier }
    this.scene = ctx.scene;
    this.colliders = [];
    this.treeSpots = [];
    this.grassChunks = [];
    this.waterAnim = [];
    this.update = this.update.bind(this);
  }

  build() {
    const { assets } = this.ctx;
    this.terrain = new Terrain();
    // placements first (moss on terrain depends on them)
    this.planTrees();
    const mossSources = [
      ...BOULDERS.map(([x, z, r]) => ({ x, z, r: r * 2.2 })),
      ...this.treeSpots.filter((t) => t.hero).map((t) => ({ x: t.x, z: t.z, r: 2.6 * t.s })),
      ...LOGS.map(([x1, z1, x2, z2]) => ({ x: (x1 + x2) / 2, z: (z1 + z2) / 2, r: 2.5 })),
    ];
    this.scene.add(this.terrain.buildMesh(assets.tex, this.ctx.tier, mossSources));
    this.terrain.buildCollider(this.ctx.RAPIER, this.ctx.physics);
    this.buildTrees();
    this.buildRocks();
    this.buildLogsStumps();
    this.buildOutcrop();
    this.buildWater();
    this.buildGrass();
    this.buildFerns();
    this.buildMushrooms();
    this.buildShafts();
  }

  // ---------------------------------------------------------------- physics helpers
  fixed(desc, data) {
    const c = this.ctx.physics.createCollider(desc.setFriction(desc.friction ?? 0.9));
    c.userData = data; this.colliders.push(c); return c;
  }
  trimeshFrom(mesh, matrix, maxY = Infinity, data = { kind: 'static', surface: 'rock' }) {
    const g = mesh.geometry, pos = g.attributes.position, idx = g.index;
    const v = new THREE.Vector3();
    const verts = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(matrix); verts.set([v.x, v.y, v.z], i * 3); }
    const tris = [];
    const n = idx ? idx.count : pos.count;
    for (let i = 0; i < n; i += 3) {
      const a = idx ? idx.getX(i) : i, b = idx ? idx.getX(i + 1) : i + 1, c = idx ? idx.getX(i + 2) : i + 2;
      if (verts[a * 3 + 1] > maxY && verts[b * 3 + 1] > maxY && verts[c * 3 + 1] > maxY) continue;
      tris.push(a, b, c);
    }
    if (!tris.length) return null;
    const R = this.ctx.RAPIER;
    return this.fixed(R.ColliderDesc.trimesh(verts, new Uint32Array(tris)), data);
  }

  // ---------------------------------------------------------------- trees
  planTrees() {
    for (const [x, z, s, t] of HERO_TREES) this.treeSpots.push({ x, z, s, t, rot: rnd() * Math.PI * 2, hero: true });
    // background forest via rejection sampling
    let tries = 0;
    while (this.treeSpots.length < 150 && tries++ < 8000) {
      const x = (rnd() - 0.5) * 92, z = (rnd() - 0.5) * 92;
      if (Math.hypot(x - START.x, z - START.z) < 8) continue;
      if (Math.min(distToPolyline(x, z, PATH).d, distToPolyline(x, z, PATH2).d, distToPolyline(x, z, PATH3).d) < 2.2) continue;
      if (distToPolyline(x, z, STREAM).d < 2.6) continue;
      if (Math.hypot(x - POND.x, z - POND.z) < POND.r + 2.5) continue;
      if (Math.hypot(x - OUTCROP.x, z - OUTCROP.z) < 9) continue;
      const near = this.treeSpots.some((t) => Math.hypot(t.x - x, t.z - z) < (t.hero ? 5.5 : 3.6));
      if (near) continue;
      const inner = Math.max(Math.abs(x), Math.abs(z)) < 30;
      if (inner && rnd() < 0.45) continue;
      this.treeSpots.push({ x, z, s: 0.75 + rnd() * 0.5, t: Math.floor(rnd() * 6), rot: rnd() * Math.PI * 2, hero: false });
    }
  }

  buildTrees() {
    const { assets } = this.ctx, M = assets.mats, R = this.ctx.RAPIER;
    const tmp = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();
    const byT = [[], [], [], [], [], []];
    for (const t of this.treeSpots) {
      t.y = this.terrain.heightAt(t.x, t.z) - 0.04;
      if (t.hero) {
        const g = assets.models[`tree_${t.t}`].scene;
        const bark = firstMesh(g, (m) => m.name.includes('bark')), leaves = firstMesh(g, (m) => m.name.includes('leaves'));
        const grp = new THREE.Group();
        const b = new THREE.Mesh(bark.geometry, M.bark); b.castShadow = true; b.receiveShadow = true;
        const l = new THREE.Mesh(leaves.geometry, M.leaves); l.castShadow = true; l.receiveShadow = true;
        grp.add(b, l);
        grp.position.set(t.x, t.y, t.z); grp.rotation.y = t.rot; grp.scale.setScalar(t.s);
        this.scene.add(grp); grp.updateMatrixWorld(true);
        this.trimeshFrom(bark, b.matrixWorld, t.y + 3.2, { kind: 'tree', surface: 'wood' });
      } else byT[t.t].push(t);
      // simple trunk collider for every tree (covers trunk above 3 m for hero trees too)
      const r = TREE_R0[t.t] * t.s * 0.82;
      this.fixed(R.ColliderDesc.cylinder(4, r).setTranslation(t.x, t.y + 4, t.z), { kind: 'tree', surface: 'wood' });
    }
    // background trees: LOD1 instanced
    byT.forEach((list, ti) => {
      if (!list.length) return;
      const g = assets.models[`tree_${ti}_lod1`].scene;
      const bark = firstMesh(g, (m) => m.name.includes('bark')), leaves = firstMesh(g, (m) => m.name.includes('leaves'));
      const ib = new THREE.InstancedMesh(bark.geometry, M.bark, list.length), il = new THREE.InstancedMesh(leaves.geometry, M.leaves, list.length);
      list.forEach((t, i) => {
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.rot); sc.setScalar(t.s); p.set(t.x, t.y, t.z);
        tmp.compose(p, q, sc); ib.setMatrixAt(i, tmp); il.setMatrixAt(i, tmp);
      });
      for (const m of [ib, il]) { m.castShadow = true; m.receiveShadow = true; m.computeBoundingSphere(); this.scene.add(m); }
    });
  }

  // ---------------------------------------------------------------- rocks
  buildRocks() {
    const { assets } = this.ctx, M = assets.mats, R = this.ctx.RAPIER;
    this.rocks = [];
    const place = (x, z, radius, squash, seed, collide = true) => {
      const ti = seed % 5;
      const src = firstMesh(assets.models[`rock_${ti}`].scene);
      src.geometry.computeBoundingBox();
      const bb = src.geometry.boundingBox; const w = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z);
      const s = (radius * 2) / w;
      const m = new THREE.Mesh(src.geometry, M.rock);
      const y = this.terrain.heightAt(x, z) - radius * 0.18;
      m.position.set(x, y, z); m.rotation.y = seed * 1.7; m.scale.set(s, s * squash * 1.35, s);
      m.castShadow = true; m.receiveShadow = true; this.scene.add(m); m.updateMatrixWorld(true);
      if (collide) {
        const pos = src.geometry.attributes.position; const pts = new Float32Array(pos.count * 3); const v = new THREE.Vector3();
        for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld); pts.set([v.x, v.y, v.z], i * 3); }
        const d = R.ColliderDesc.convexHull(pts);
        if (d) this.fixed(d, { kind: 'rock', surface: 'rock' });
      }
      this.rocks.push({ x, z, r: radius, top: y + (bb.max.y) * s * squash * 1.35, mesh: m });
      return m;
    };
    for (const [x, z, r, sq, seed] of BOULDERS) place(x, z, r, sq, seed);
    // scattered stones (instanced, colliders only for the bigger ones)
    const geo = firstMesh(assets.models.rock_2.scene).geometry;
    geo.computeBoundingBox();
    const w0 = geo.boundingBox.max.x - geo.boundingBox.min.x;
    const N = 260, im = new THREE.InstancedMesh(geo, M.rock, N);
    const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler();
    let k = 0;
    for (let i = 0; i < 2000 && k < N; i++) {
      const x = (rnd() - 0.5) * 80, z = (rnd() - 0.5) * 80;
      const nearStream = distToPolyline(x, z, STREAM).d < 3;
      if (!nearStream && rnd() < 0.6) continue;
      if (Math.min(distToPolyline(x, z, PATH).d, distToPolyline(x, z, PATH3).d) < 0.8) continue;
      const r = (nearStream ? 0.08 + rnd() * 0.2 : 0.05 + rnd() * 0.16);
      const sc = (r * 2) / w0;
      p.set(x, this.terrain.heightAt(x, z) - r * 0.25, z); e.set(rnd() * 0.4, rnd() * 6.28, rnd() * 0.4); q.setFromEuler(e); s.set(sc, sc * (0.5 + rnd() * 0.4), sc);
      mtx.compose(p, q, s); im.setMatrixAt(k++, mtx);
      if (r > 0.13) this.fixed(R.ColliderDesc.ball(r * 0.7).setTranslation(x, p.y + r * 0.2, z), { kind: 'rock', surface: 'rock' });
    }
    im.count = k; im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere(); this.scene.add(im);
  }

  // ---------------------------------------------------------------- logs & stumps
  buildLogsStumps() {
    const { assets } = this.ctx, M = assets.mats, R = this.ctx.RAPIER;
    const names = ['log_bridge', 'log_hollow', 'log_small', 'log_small'];
    this.logs = [];
    LOGS.forEach(([x1, z1, x2, z2, r, hollow], i) => {
      const g = assets.models[names[i]].scene;
      const grp = new THREE.Group();
      for (const m of meshes(g)) {
        const mm = new THREE.Mesh(m.geometry, m.material?.name === 'Wood' ? M.wood : M.bark);
        mm.castShadow = mm.receiveShadow = true; grp.add(mm);
      }
      const src = firstMesh(g); src.geometry.computeBoundingBox();
      const L0 = src.geometry.boundingBox.max.x - src.geometry.boundingBox.min.x;
      const len = Math.hypot(x2 - x1, z2 - z1);
      const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
      const y1 = this.terrain.heightAt(x1, z1), y2 = this.terrain.heightAt(x2, z2);
      const yc = Math.max((y1 + y2) / 2, i === 0 ? WORLD.waterY + 0.05 : -10) + r * 0.72;
      grp.position.set(cx, yc, cz);
      grp.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
      grp.rotation.z = Math.atan2(y2 - y1, len) * 0.6;
      grp.scale.set(len / L0, r / 0.3 * (hollow ? 0.3 / 0.36 * 1.0 : 1), r / 0.3 * (hollow ? 0.3 / 0.36 : 1));
      this.scene.add(grp); grp.updateMatrixWorld(true);
      if (hollow) grp.children.forEach((c) => this.trimeshFrom(c, c.matrixWorld, Infinity, { kind: 'log', surface: 'wood' }));
      else {
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, grp.rotation.y, grp.rotation.z));
        const qa = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
        q.multiply(qa);
        this.fixed(R.ColliderDesc.capsule(len / 2 - r, r * 0.95).setTranslation(cx, yc, cz).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }), { kind: 'log', surface: 'wood' });
      }
      this.logs.push({ x1, z1, x2, z2, r, y: yc, group: grp, hollow });
    });
    this.stumps = [];
    STUMPS.forEach(([x, z, r, h], i) => {
      const g = assets.models[`stump_${i}`].scene;
      const grp = new THREE.Group();
      for (const m of meshes(g)) {
        const mm = new THREE.Mesh(m.geometry, m.material?.name === 'Wood' ? M.wood : M.bark);
        mm.castShadow = mm.receiveShadow = true; grp.add(mm);
      }
      const y = this.terrain.heightAt(x, z) - 0.05;
      grp.position.set(x, y, z); grp.rotation.y = i * 2.1;
      this.scene.add(grp); grp.updateMatrixWorld(true);
      grp.children.forEach((c) => this.trimeshFrom(c, c.matrixWorld, Infinity, { kind: 'stump', surface: 'wood' }));
      const bb = new THREE.Box3().setFromObject(grp);
      this.stumps.push({ x, z, r, top: bb.max.y });
    });
  }

  // ---------------------------------------------------------------- outcrop with tunnel
  buildOutcrop() {
    const { assets } = this.ctx, M = assets.mats;
    const src = firstMesh(assets.models.outcrop.scene);
    const m = new THREE.Mesh(src.geometry, M.rockOutcrop);
    m.position.set(OUTCROP.x, OUTCROP.base - 0.05, OUTCROP.z); m.rotation.y = OUTCROP.yaw;
    m.castShadow = true; m.receiveShadow = true; this.scene.add(m); m.updateMatrixWorld(true);
    this.trimeshFrom(src, m.matrixWorld, Infinity, { kind: 'outcrop', surface: 'rock' });
    this.outcrop = m;
    const bb = new THREE.Box3().setFromObject(m); this.outcropTop = bb.max.y;
  }

  // ---------------------------------------------------------------- water + waterfall
  buildWater() {
    const T = this.terrain, { assets } = this.ctx;
    const N = T.res + 1, wy = T.waterY;
    const pos = [], depth = [], idx = [];
    const map = new Int32Array(N * N).fill(-1);
    const vert = (i, j) => {
      const k = j * N + i;
      if (map[k] >= 0) return map[k];
      const x = -T.half + i * T.cell, z = -T.half + j * T.cell;
      map[k] = pos.length / 3; pos.push(x, wy, z); depth.push(Math.max(0, wy - T.h[k]));
      return map[k];
    };
    for (let j = 0; j < T.res; j++) for (let i = 0; i < T.res; i++) {
      const hs = [T.h[j * N + i], T.h[j * N + i + 1], T.h[(j + 1) * N + i], T.h[(j + 1) * N + i + 1]];
      if (Math.min(...hs) > wy + 0.02) continue;
      const a = vert(i, j), b = vert(i + 1, j), c = vert(i, j + 1), d = vert(i + 1, j + 1);
      idx.push(a, c, b, b, c, d);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('depth', new THREE.Float32BufferAttribute(depth, 1));
    geo.setIndex(idx); geo.computeVertexNormals();
    const u = { uTime: { value: 0 }, tN: { value: assets.tex.water } };
    const mat = new THREE.MeshPhysicalMaterial({ color: 0x0e2a22, roughness: 0.04, metalness: 0, transparent: true, opacity: 1,
      envMapIntensity: 1.0, depthWrite: false, normalMap: assets.tex.water, normalScale: new THREE.Vector2(0.35, 0.35), specularIntensity: 1 });
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, u);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float depth; varying float vDepth; varying vec3 vWP;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvDepth = depth; vWP = (modelMatrix * vec4(transformed,1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uTime; uniform sampler2D tN; varying float vDepth; varying vec3 vWP;')
        .replace('#include <normal_fragment_maps>', `
          vec2 fl = vec2(0.06, 0.02) * uTime;
          vec3 n1 = texture2D(tN, vWP.xz * 0.35 + fl).xyz * 2.0 - 1.0;
          vec3 n2 = texture2D(tN, vWP.xz * 0.9 - fl * 1.7 + 0.37).xyz * 2.0 - 1.0;
          vec3 nn = normalize(vec3((n1.xy + n2.xy) * 0.32, 1.0));
          vec3 nW = normalize(vec3(nn.x, nn.z, nn.y));
          normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);`)
        .replace('#include <opaque_fragment>', `
          float fres = pow(1.0 - clamp(dot(normalize(vViewPosition), -normal) * -1.0, 0.0, 1.0), 3.0);
          float a = clamp(smoothstep(0.0, 0.55, vDepth) * 0.78 + 0.12 + fres * 0.3, 0.0, 0.96);
          float edgeFoam = smoothstep(0.06, 0.0, vDepth) * 0.6;
          outgoingLight = mix(outgoingLight, vec3(0.75, 0.8, 0.78), edgeFoam);
          gl_FragColor = vec4(outgoingLight, max(a, edgeFoam));`);
    };
    this.water = new THREE.Mesh(geo, mat); this.water.renderOrder = 2; this.water.receiveShadow = true;
    this.scene.add(this.water);
    this.waterU = u;
    // waterfall curtain from the outcrop lip into the pond
    const lip = new THREE.Vector3(OUTCROP.x - 3.5, this.outcropTop - 0.6, OUTCROP.z + 5.2);
    const bottomY = WORLD.waterY;
    this.waterfallPos = new THREE.Vector3(lip.x, bottomY, lip.z + 1.0);
    const fg = new THREE.PlaneGeometry(1.6, 1, 8, 24);
    const fp = fg.attributes.position;
    for (let i = 0; i < fp.count; i++) {
      const x = fp.getX(i), t = fp.getY(i) + 0.5; // t: 1 top -> 0 bottom
      const fall = 1 - t;
      const y = lip.y + (bottomY - lip.y) * fall;
      const z = lip.z + 0.35 * Math.sqrt(fall) + 0.6 * fall * fall;
      fp.setXYZ(i, lip.x + x * (1 + fall * 0.35), y, z);
    }
    fg.computeVertexNormals();
    const fu = { uTime: { value: 0 } };
    const fmat = new THREE.ShaderMaterial({
      uniforms: fu, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform float uTime; varying vec2 vUv;
        float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
        float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
        void main(){
          vec2 p = vec2(vUv.x * 9.0, vUv.y * 3.0 + uTime * 2.4);
          float s = n(p) * 0.6 + n(p * 2.3 + 4.0) * 0.4;
          float streak = smoothstep(0.35, 0.85, s);
          float edge = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
          float a = (0.35 + 0.6 * streak) * edge * (0.6 + 0.4 * vUv.y);
          vec3 c = mix(vec3(0.55,0.65,0.66), vec3(0.95,0.98,1.0), streak);
          gl_FragColor = vec4(c, a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }` });
    const fall = new THREE.Mesh(fg, fmat); fall.renderOrder = 3; this.scene.add(fall);
    this.fallU = fu;
  }

  // ---------------------------------------------------------------- grass
  buildGrass() {
    const tier = this.ctx.tier;
    const geo = grassClumpGeometry();
    const mat = patchMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0, side: THREE.DoubleSide, envMapIntensity: 0.4 }), {
      ao: false,
      wind: `float flex = uv.y * uv.y;
             transformed += windOffset(wp0.xyz, 0.035 * flex, wp0.x * 2.1 + wp0.z * 1.3);
             vec3 toP = wp0.xyz - uPlayer;
             float pd = length(toP.xz);
             float push = smoothstep(0.32, 0.05, pd) * flex;
             transformed.xz += normalize(toP.xz + 1e-4) * push * 0.08;
             transformed.y -= push * 0.04;` });
    const prevCompile = mat.onBeforeCompile;
    this.grassPlayer = { value: new THREE.Vector3(0, -99, 0) };
    mat.onBeforeCompile = (sh, r) => {
      sh.uniforms.uPlayer = this.grassPlayer;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform vec3 uPlayer;');
      prevCompile(sh, r);
      // translucent tips: brighten back-lit blades a little
      sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', 'outgoingLight += diffuseColor.rgb * 0.06; \n#include <opaque_fragment>');
    };
    mat.customProgramCacheKey = () => 'grass';
    const CH = 8, density = 34 * tier.grassDensity;
    const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const col = new THREE.Color();
    for (let cz = -40; cz < 40; cz += CH) for (let cx = -40; cx < 40; cx += CH) {
      const items = [];
      const n = Math.floor(CH * CH * density);
      for (let i = 0; i < n; i++) {
        const x = cx + rnd() * CH, z = cz + rnd() * CH;
        const g = this.terrain.grassAt(x, z);
        if (rnd() > g * g * 1.2) continue;
        if (this.terrain.isWater(x, z)) continue;
        items.push([x, z, g]);
      }
      if (!items.length) continue;
      const im = new THREE.InstancedMesh(geo, mat, items.length);
      items.forEach(([x, z, g], i) => {
        q.setFromAxisAngle(up, rnd() * Math.PI * 2);
        const sc = 0.55 + rnd() * 0.6 + g * 0.35;
        s.set(sc, sc * (0.7 + rnd() * 0.6), sc);
        p.set(x, this.terrain.heightAt(x, z) - 0.005, z);
        mtx.compose(p, q, s); im.setMatrixAt(i, mtx);
        col.setHSL(0.2 + rnd() * 0.06, 0.45 + rnd() * 0.2, 0.75 + rnd() * 0.35); im.setColorAt(i, col);
      });
      im.receiveShadow = true; im.castShadow = false;
      im.frustumCulled = true; im.computeBoundingSphere();
      im.userData.center = new THREE.Vector3(cx + CH / 2, 0, cz + CH / 2); im.userData.full = items.length;
      this.scene.add(im); this.grassChunks.push(im);
    }
  }

  // ---------------------------------------------------------------- ferns / mushrooms
  buildFerns() {
    const tier = this.ctx.tier, M = this.ctx.assets.mats;
    // a fern = 6 fronds radiating from the center, each a bent card
    const g = new THREE.BufferGeometry();
    const pos = [], uv = [], idx = [];
    for (let f = 0; f < 7; f++) {
      const a = f / 7 * Math.PI * 2 + (f % 2) * 0.3;
      const L = 0.55 + (f % 3) * 0.1, W = 0.28;
      const base = pos.length / 3;
      for (let k = 0; k <= 6; k++) {
        const t = k / 6;
        const r = t * L, y = Math.sin(t * Math.PI * 0.7) * 0.32 * L - t * t * 0.12;
        for (const sd of [-1, 1]) {
          const px = Math.cos(a) * r - Math.sin(a) * sd * W * 0.5, pz = Math.sin(a) * r + Math.cos(a) * sd * W * 0.5;
          pos.push(px, y + Math.abs(sd) * 0.0, pz); uv.push(sd < 0 ? 0 : 1, t);
        }
      }
      for (let k = 0; k < 6; k++) { const o = base + k * 2; idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); }
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    const spots = [];
    for (const t of this.treeSpots) {
      if (Math.max(Math.abs(t.x), Math.abs(t.z)) > 42) continue;
      const n = Math.round((t.hero ? 7 : 3) * tier.fernDensity);
      for (let i = 0; i < n; i++) {
        const a = rnd() * 6.28, d = 1.4 + rnd() * 2.4;
        const x = t.x + Math.cos(a) * d, z = t.z + Math.sin(a) * d;
        if (distToPolyline(x, z, PATH).d < 1 || this.terrain.isWater(x, z)) continue;
        spots.push([x, z, 0.5 + rnd() * 0.7]);
      }
    }
    const im = new THREE.InstancedMesh(g, M.fern, spots.length);
    const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    spots.forEach(([x, z, sc], i) => {
      q.setFromEuler(new THREE.Euler(0, rnd() * 6.28, 0)); s.setScalar(sc); p.set(x, this.terrain.heightAt(x, z) - 0.02, z);
      mtx.compose(p, q, s); im.setMatrixAt(i, mtx);
    });
    im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere(); this.scene.add(im);
    this.ferns = spots;
  }

  buildMushrooms() {
    const { assets } = this.ctx, M = assets.mats;
    this.mushrooms = [];
    const spots = [];
    for (const l of LOGS) for (let i = 0; i < 6; i++) { const t = rnd(); spots.push([l[0] + (l[2] - l[0]) * t + (rnd() - 0.5) * 1.2, l[1] + (l[3] - l[1]) * t + (rnd() - 0.5) * 1.2]); }
    for (const t of this.treeSpots.filter((t) => t.hero)) for (let i = 0; i < 4; i++) { const a = rnd() * 6.28; spots.push([t.x + Math.cos(a) * (1.2 + rnd()), t.z + Math.sin(a) * (1.2 + rnd())]); }
    for (let k = 0; k < 3; k++) {
      const src = assets.models[`mushroom_${k}`].scene;
      const ms = meshes(src);
      const list = spots.filter((_, i) => i % 3 === k);
      for (const m of ms) {
        const mat = (m.material?.name || '').includes('Cap') ? M.mushCap : M.mushStem;
        const im = new THREE.InstancedMesh(m.geometry, mat, list.length * 3);
        let c = 0;
        const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
        const r2 = mulberry32(k * 100 + 5);
        list.forEach(([x, z]) => {
          for (let j = 0; j < 3; j++) {
            const xx = x + (r2() - 0.5) * 0.25, zz = z + (r2() - 0.5) * 0.25;
            q.setFromEuler(new THREE.Euler((r2() - 0.5) * 0.3, r2() * 6, (r2() - 0.5) * 0.3)); s.setScalar(0.6 + r2() * 0.8);
            p.set(xx, this.terrain.heightAt(xx, zz) - 0.01, zz); mtx.compose(p, q, s); im.setMatrixAt(c++, mtx);
            if (j === 0) this.mushrooms.push(new THREE.Vector3(xx, p.y + 0.1, zz));
          }
        });
        im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere(); this.scene.add(im);
      }
    }
  }

  // ---------------------------------------------------------------- light shafts in the clearing
  buildShafts() {
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uI: { value: 1 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform float uTime, uI; varying vec2 vUv;
        void main(){ float e = smoothstep(0.0,0.5,vUv.x)*smoothstep(1.0,0.5,vUv.x);
          float v = smoothstep(0.0,0.35,vUv.y) * smoothstep(1.0,0.6,vUv.y);
          float fl = 0.75 + 0.25*sin(uTime*0.4 + vUv.x*3.0);
          gl_FragColor = vec4(vec3(1.0,0.93,0.75) * e * v * 0.05 * fl * uI, 1.0); }`,
    });
    this.shaftMat = mat;
    const sun = this.ctx.sunDir.clone().normalize();
    for (let i = 0; i < 9; i++) {
      const x = START.x + (rnd() - 0.5) * 12, z = START.z - 3 + (rnd() - 0.5) * 12;
      const h = 14, w = 0.8 + rnd() * 1.6;
      const g = new THREE.PlaneGeometry(w, h);
      const m = new THREE.Mesh(g, mat);
      const base = new THREE.Vector3(x, this.terrain.heightAt(x, z) + h / 2 * sun.y, z);
      m.position.copy(base.clone().addScaledVector(sun, h / 2 * 0.5));
      m.lookAt(m.position.clone().add(new THREE.Vector3(sun.z, 0, -sun.x)));
      m.quaternion.multiply(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 1, 0)));
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), sun);
      m.quaternion.premultiply(q);
      m.renderOrder = 4; this.scene.add(m);
    }
  }

  update(dt, time, camPos, playerPos) {
    WIND.time.value = time;
    if (this.waterU) this.waterU.uTime.value = time;
    if (this.fallU) this.fallU.uTime.value = time;
    if (this.shaftMat) this.shaftMat.uniforms.uTime.value = time;
    if (playerPos) this.grassPlayer.value.copy(playerPos);
    this.terrain.material.userData.uniforms.uTime.value = time;
    // grass LOD: fewer blades with distance (instances are randomly ordered so a prefix is uniform)
    const R = this.ctx.tier.grassRadius;
    for (const im of this.grassChunks) {
      const d = Math.hypot(im.userData.center.x - camPos.x, im.userData.center.z - camPos.z);
      const k = d < R * 0.5 ? 1 : d < R ? 1 - (d - R * 0.5) / (R * 0.5) * 0.75 : d < R * 1.6 ? 0.18 * (1 - (d - R) / (R * 0.6)) : 0;
      im.count = Math.floor(im.userData.full * clamp(k, 0, 1));
      im.visible = im.count > 0;
    }
  }
}

function grassClumpGeometry() {
  const pos = [], uv = [], col = [], idx = [];
  const r = mulberry32(5);
  const blades = 7, segs = 4;
  for (let b = 0; b < blades; b++) {
    const a = r() * Math.PI * 2, off = r() * 0.025;
    const bx = Math.cos(a) * off, bz = Math.sin(a) * off;
    const h = 0.07 + r() * 0.13, w = 0.006 + r() * 0.005;
    const lean = 0.25 + r() * 0.5, la = r() * Math.PI * 2;
    const base = pos.length / 3;
    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const bend = lean * t * t * h;
      const cx = bx + Math.cos(la) * bend, cz = bz + Math.sin(la) * bend;
      const ww = w * (1 - t * 0.9);
      const px = -Math.sin(la) * ww, pz = Math.cos(la) * ww;
      pos.push(cx - px, t * h, cz - pz, cx + px, t * h, cz + pz);
      uv.push(0, t, 1, t);
      const c0 = [0.035, 0.06, 0.012], c1 = [0.22, 0.3, 0.07], dry = [0.4, 0.36, 0.16];
      const isDry = b % 5 === 0;
      for (let k = 0; k < 2; k++) col.push(...c0.map((v, i) => v + ((isDry ? dry : c1)[i] - v) * Math.pow(t, 0.8)));
    }
    for (let s = 0; s < segs; s++) { const o = base + s * 2; idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  // grass normals point mostly up for soft, even lighting
  const n = g.attributes.normal;
  for (let i = 0; i < n.count; i++) { const v = new THREE.Vector3(n.getX(i) * 0.35, 1, n.getZ(i) * 0.35).normalize(); n.setXYZ(i, v.x, v.y, v.z); }
  return g;
}
