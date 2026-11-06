// Life that arrives with terraforming: glowing pollinators near plants
// (Insects stage), flocks of gliding birds (Fauna stage, more once the
// ecosystem thrives) and herds of grazers wandering the grassland. All
// instanced; wings flap and legs step in the vertex shader.
import * as THREE from 'three';
import { U } from '../core/shared.js';
import { GeoBuilder, taperTube } from '../core/geobuilder.js';

// Gazelle-like grazer built from organic pieces: a lathed barrel body with a
// coat pattern (warm back, dark flank stripe, white belly and rump), a curved
// tapering neck, a head with muzzle, eyes, leaf ears and lyre horns, two-joint
// legs (hind legs with a hock) ending in hooves, and a tufted tail. Legs carry
// aLeg = +/-1 (diagonal pairs) for the stepping gait in the vertex shader.
function grazerGeometry() {
  const gb = new GeoBuilder(['aLeg']);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const back = [0.56, 0.36, 0.2], flank = [0.66, 0.45, 0.27], stripe = [0.17, 0.11, 0.07], white = [0.9, 0.86, 0.78], dark = [0.1, 0.08, 0.07], horn = [0.2, 0.17, 0.14];
  // body: lathe around its long axis (rump at -z, chest at +z)
  const prof = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const r = 0.29 * Math.pow(Math.sin(Math.PI * t), 0.55) * (0.9 + 0.12 * t);
    prof.push(new THREE.Vector2(Math.max(0.01, r), -0.62 + 1.24 * t));
  }
  const body = new THREE.LatheGeometry(prof, 20); body.rotateX(Math.PI / 2); body.scale(0.82, 1.0, 1.0);
  gb.add(body, { pos: V(0, 1.05, 0), attrs: { aLeg: 0 }, color: (x, y, z) => {
    // local: x side, y up (after rotation the lathe axis is z)
    if (z < -0.42 && y < 0.12) return white;                      // rump patch
    if (y < -0.1) return white;                                    // belly
    if (y < -0.02) return stripe;                                  // flank stripe
    return y > 0.14 ? back : flank;
  } });
  // neck: tapered curve from the chest up to the head
  const neckC = new THREE.CatmullRomCurve3([V(0, 1.16, 0.42), V(0, 1.42, 0.6), V(0, 1.68, 0.74)]);
  gb.add(taperTube(neckC, 10, 10, (t) => 0.12 - t * 0.055), { attrs: { aLeg: 0 }, color: (x, y, z, nx, ny, nz) => (nz > 0.35 && ny < 0.3 ? white : flank) });
  // head + muzzle
  const head = new THREE.SphereGeometry(0.1, 14, 10); head.scale(0.85, 0.9, 1.25);
  gb.add(head, { pos: V(0, 1.75, 0.78), attrs: { aLeg: 0 }, color: flank });
  const muzzle = new THREE.CylinderGeometry(0.045, 0.075, 0.2, 10); muzzle.rotateX(Math.PI / 2 + 0.55);
  gb.add(muzzle, { pos: V(0, 1.69, 0.9), attrs: { aLeg: 0 }, color: (x, y) => (y > 0.07 ? dark : white) });
  gb.add(new THREE.SphereGeometry(0.03, 8, 6), { pos: V(0, 1.64, 0.99), attrs: { aLeg: 0 }, color: dark });
  for (const sx of [-1, 1]) {
    gb.add(new THREE.SphereGeometry(0.022, 8, 6), { pos: V(sx * 0.072, 1.78, 0.82), attrs: { aLeg: 0 }, color: dark });
    const ear = new THREE.SphereGeometry(0.06, 8, 6); ear.scale(0.35, 1.4, 0.7); ear.rotateZ(sx * 0.9);
    gb.add(ear, { pos: V(sx * 0.1, 1.86, 0.72), attrs: { aLeg: 0 }, color: flank });
    const hc = new THREE.CatmullRomCurve3([V(sx * 0.035, 1.84, 0.76), V(sx * 0.07, 2.02, 0.7), V(sx * 0.05, 2.18, 0.6), V(sx * 0.07, 2.27, 0.66)]);
    gb.add(taperTube(hc, 12, 6, (t) => 0.022 * (1 - t * 0.8)), { attrs: { aLeg: 0 }, color: horn });
  }
  // tail with a dark tuft
  const tc = new THREE.CatmullRomCurve3([V(0, 1.12, -0.6), V(0, 1.02, -0.7), V(0, 0.88, -0.7)]);
  gb.add(taperTube(tc, 6, 6, (t) => 0.03 * (1 - t * 0.5)), { attrs: { aLeg: 0 }, color: (x, y) => (y < 0.95 ? dark : white) });
  // legs: hip -> knee/hock -> fetlock, hooves
  const legs = [
    { x: -0.12, z: 0.34, ph: 1, hind: false }, { x: 0.12, z: 0.34, ph: -1, hind: false },
    { x: -0.12, z: -0.38, ph: -1, hind: true }, { x: 0.12, z: -0.38, ph: 1, hind: true },
  ];
  for (const L of legs) {
    const pts = L.hind
      ? [V(L.x, 1.0, L.z), V(L.x, 0.72, L.z + 0.08), V(L.x, 0.48, L.z - 0.1), V(L.x, 0.08, L.z - 0.04)]
      : [V(L.x, 1.0, L.z), V(L.x, 0.62, L.z + 0.02), V(L.x, 0.36, L.z), V(L.x, 0.08, L.z + 0.02)];
    const c = new THREE.CatmullRomCurve3(pts);
    gb.add(taperTube(c, 14, 8, (t) => (t < 0.35 ? 0.075 - t * 0.09 : 0.044 - (t - 0.35) * 0.025)), { attrs: { aLeg: L.ph }, color: (x, y) => (y > 0.7 ? flank : y > 0.2 ? [0.62, 0.48, 0.34] : white) });
    const hoof = new THREE.CylinderGeometry(0.026, 0.034, 0.08, 8);
    gb.add(hoof, { pos: V(L.x, 0.04, pts[3].z + 0.005), attrs: { aLeg: L.ph }, color: dark });
  }
  return gb.build();
}

// Small lake fish: spindle body with a forked tail and dorsal fin; the tail
// beats in the vertex shader (aFin = distance along the body).
function fishGeometry() {
  const gb = new GeoBuilder(['aLeg']);
  const prof = [];
  for (let i = 0; i <= 10; i++) { const t = i / 10; prof.push(new THREE.Vector2(Math.max(0.004, 0.075 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.05)), 0.8)), -0.22 + 0.44 * t)); }
  const body = new THREE.LatheGeometry(prof, 10); body.rotateX(Math.PI / 2); body.scale(0.55, 1, 1);
  gb.add(body, { color: (x, y) => (y > 0.01 ? [0.2, 0.26, 0.24] : [0.72, 0.74, 0.68]), attrs: { aLeg: (x, y, z) => Math.max(0, -z) } });
  const tail = new THREE.BufferGeometry();
  tail.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.2, 0, 0.09, -0.32, 0, 0, -0.27, 0, 0, -0.2, 0, 0, -0.27, 0, -0.09, -0.32], 3));
  tail.computeVertexNormals();
  gb.add(tail, { color: [0.24, 0.3, 0.28], attrs: { aLeg: (x, y, z) => -z } });
  const fin = new THREE.BufferGeometry();
  fin.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.05, 0.04, 0, 0.11, -0.04, 0, 0.05, -0.08], 3));
  fin.computeVertexNormals();
  gb.add(fin, { color: [0.2, 0.26, 0.24], attrs: { aLeg: 0.05 } });
  return gb.build();
}

function fishMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.3, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime; attribute float aLeg;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
        float ph = instanceMatrix[3][0] * 2.1 + instanceMatrix[3][2] * 1.7;
        #else
        float ph = 0.0;
        #endif
        transformed.x += sin(uTime * 9.0 + ph - aLeg * 8.0) * aLeg * 0.35;`);
  };
  m.customProgramCacheKey = () => 'fish-v1';
  return m;
}

function grazerMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime; attribute float aLeg;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
        float gait = length(instanceMatrix[1].xyz) / max(1e-4, length(instanceMatrix[0].xyz));   // y/x scale ratio carries walking speed (1.0 = still)
        float ph = instanceMatrix[3][0] * 0.37 + instanceMatrix[3][2] * 0.29;
        #else
        float gait = 1.0; float ph = 0.0;
        #endif
        float walk = clamp((gait - 1.0) * 40.0, 0.0, 1.0);
        if (aLeg != 0.0) {
          float sw = sin(uTime * 7.0 + ph) * aLeg * 0.45 * walk;
          float k = clamp((1.0 - position.y) / 0.92, 0.0, 1.0);
          transformed.z += sin(sw) * k * 0.92;
          transformed.y += (1.0 - cos(sw)) * k * 0.18;
        }`);
  };
  m.customProgramCacheKey = () => 'grazer-v3';
  return m;
}

function wingMaterial(color, glow) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.7, side: THREE.DoubleSide, emissive: glow ? color : 0x000000, emissiveIntensity: glow ? 0.6 : 0 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
        float ph = instanceMatrix[3][0] * 1.7 + instanceMatrix[3][2] * 1.3;
        #else
        float ph = 0.0;
        #endif
        float flap = sin(uTime * ${glow ? '22.0' : '6.0'} + ph) * ${glow ? '0.9' : '0.55'};
        float side = sign(position.x);
        float ax = abs(position.x);
        transformed.y += ax * sin(flap) * side * side;
        transformed.x = side * ax * cos(flap);`);
  };
  m.customProgramCacheKey = () => 'wing' + glow;
  return m;
}

export class Fauna {
  constructor(game) {
    this.game = game;
    const scene = game.engine.scene;
    // pollinator: two wing quads
    const bug = new THREE.BufferGeometry();
    bug.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0.09, 0, -0.04, 0.08, 0, 0.06, 0, 0, 0, -0.08, 0, 0.06, -0.09, 0, -0.04], 3));
    bug.computeVertexNormals();
    this.bugs = new THREE.InstancedMesh(bug, wingMaterial(new THREE.Color(1.0, 0.7, 0.25), true), 120);
    this.bugs.count = 0; this.bugs.frustumCulled = false;
    this.bugs.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(120 * 3).fill(1), 3);
    scene.add(this.bugs);
    this.bugList = [];
    // bird: body + two wings
    const bird = new THREE.BufferGeometry();
    const W = 1.4;
    bird.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.5, W, 0, 0.1, 0, 0, 0.35, 0, 0, -0.5, 0, 0, 0.35, -W, 0, 0.1, 0, 0, -0.6, 0.12, 0.05, 0.3, -0.12, 0.05, 0.3], 3));
    bird.computeVertexNormals();
    this.birds = new THREE.InstancedMesh(bird, wingMaterial(new THREE.Color(0.85, 0.82, 0.78), false), 96);
    this.birds.count = 0; this.birds.frustumCulled = false; this.birds.castShadow = true;
    scene.add(this.birds);
    this.flocks = [];
    this.m4 = new THREE.Matrix4();
    this.grazers = new THREE.InstancedMesh(grazerGeometry(), grazerMaterial(), 64);
    this.grazers.count = 0; this.grazers.frustumCulled = false; this.grazers.castShadow = true; this.grazers.receiveShadow = true;
    scene.add(this.grazers);
    this.herds = [];
    this.fish = new THREE.InstancedMesh(fishGeometry(), fishMaterial(), 80);
    this.fish.count = 0; this.fish.frustumCulled = false;
    scene.add(this.fish);
    this.schools = [];
  }

  update(dt, cam) {
    const T = this.game.terra;
    const s = T.sVis;
    const terrain = this.game.terrain;
    // pollinators near the player once insects exist
    const wantBugs = s >= 9 ? Math.min(120, Math.floor((s - 9) * 60 + 30)) : 0;
    while (this.bugList.length < wantBugs) {
      const a = Math.random() * 6.28, r = 6 + Math.random() * 45;
      const x = cam.x + Math.cos(a) * r, z = cam.z + Math.sin(a) * r;
      this.bugList.push({ x, z, y: terrain.height(x, z) + 0.6 + Math.random() * 1.6, h: Math.random() * 6.28, sp: 1 + Math.random() * 2, c: [[1, 0.7, 0.25], [0.4, 0.9, 1], [1, 0.4, 0.8]][Math.floor(Math.random() * 3)] });
    }
    this.bugList.length = Math.min(this.bugList.length, wantBugs);
    const q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1), col = new THREE.Color();
    let n = 0;
    for (const b of this.bugList) {
      b.h += (Math.random() - 0.5) * dt * 4;
      b.x += Math.cos(b.h) * b.sp * dt; b.z += Math.sin(b.h) * b.sp * dt;
      const gy = terrain.height(b.x, b.z);
      b.y += ((gy + 0.8 + Math.sin(U.uTime.value * 2 + b.h) * 0.5) - b.y) * dt * 2;
      if (Math.hypot(b.x - cam.x, b.z - cam.z) > 60) { const a = Math.random() * 6.28; b.x = cam.x + Math.cos(a) * 40; b.z = cam.z + Math.sin(a) * 40; b.y = terrain.height(b.x, b.z) + 1; }
      if (b.y < U.uWaterLevel.value + 0.5) continue;
      this.m4.compose(p.set(b.x, b.y, b.z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -b.h), sc);
      this.bugs.setMatrixAt(n, this.m4);
      this.bugs.setColorAt(n, col.setRGB(...b.c));
      n++;
    }
    this.bugs.count = n;
    this.bugs.instanceMatrix.needsUpdate = true;
    this.bugs.instanceColor.needsUpdate = true;

    // bird flocks circling at altitude
    // birds come after insects (food) and a breathable sky: Birds stage
    const wantFlocks = s >= 11.45 ? 7 : s >= 10.6 ? 4 : s >= 10.25 ? 2 : 0;
    while (this.flocks.length < wantFlocks) {
      const a = Math.random() * 6.28;
      this.flocks.push({ cx: cam.x + Math.cos(a) * 200, cz: cam.z + Math.sin(a) * 200, r: 60 + Math.random() * 80, a: Math.random() * 6.28, h: 50 + Math.random() * 40, sp: 0.08 + Math.random() * 0.06, n: 6 + Math.floor(Math.random() * 6) });
    }
    this.flocks.length = Math.min(this.flocks.length, wantFlocks);
    n = 0;
    for (const f of this.flocks) {
      f.a += f.sp * dt;
      if (Math.hypot(f.cx - cam.x, f.cz - cam.z) > 600) { f.cx = cam.x + (Math.random() - 0.5) * 400; f.cz = cam.z + (Math.random() - 0.5) * 400; }
      const base = terrain.height(f.cx, f.cz) + f.h;
      for (let k = 0; k < f.n && n < 96; k++) {
        const aa = f.a - k * 0.03 + Math.sin(k * 7.1) * 0.02;
        const rr = f.r + Math.sin(k * 3.3) * 6;
        const x = f.cx + Math.cos(aa) * rr, z = f.cz + Math.sin(aa) * rr, y = base + Math.sin(k * 1.9 + U.uTime.value * 0.5) * 3;
        const yaw = -aa;
        this.m4.compose(p.set(x, y, z), q.setFromEuler(new THREE.Euler(0, yaw, 0.25)), sc.set(1, 1, 1));
        this.birds.setMatrixAt(n++, this.m4);
      }
    }
    this.birds.count = n;
    this.birds.instanceMatrix.needsUpdate = true;
    this.updateHerds(dt, cam, s);
  }

  // herds of grazers on open grassland near the player (Fauna stage, more and
  // larger once the ecosystem thrives); they amble, stop to graze, regroup
  updateHerds(dt, cam, s) {
    const terrain = this.game.terrain;
    // herbivores last: a few small herds at the Herbivores stage, more and
    // larger once the ecosystem thrives
    const want = s >= 11.45 ? 5 : s >= 11 ? 2 : 0;
    const okGround = (x, z) => {
      if (!terrain.inWorld(x, z, 50)) return false;
      const h = terrain.height(x, z);
      return h > U.uWaterLevel.value + 1 && terrain.slope(x, z) < 0.3 && !this.game.buildings.isBlocked(x, z, 6);
    };
    while (this.herds.length < want) {
      let cx = 0, cz = 0, ok = false;
      for (let t = 0; t < 12 && !ok; t++) { const a = Math.random() * 6.28, r = 70 + Math.random() * 120; cx = cam.x + Math.cos(a) * r; cz = cam.z + Math.sin(a) * r; ok = okGround(cx, cz); }
      if (!ok) break;
      const n = s >= 11.45 ? 6 + Math.floor(Math.random() * 5) : 3 + Math.floor(Math.random() * 3);
      const herd = { cx, cz, dir: Math.random() * 6.28, t: 0, members: [] };
      for (let k = 0; k < n; k++) herd.members.push({ ox: (Math.random() - 0.5) * 14, oz: (Math.random() - 0.5) * 14, x: cx, z: cz, h: Math.random() * 6.28, sp: 0, graze: Math.random() * 4, sc: 0.85 + Math.random() * 0.35 });
      this.herds.push(herd);
    }
    this.herds.length = Math.min(this.herds.length, want);
    let n = 0;
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3();
    for (const H of this.herds) {
      H.t += dt;
      // the herd drifts; it turns away from water, steep ground and buildings
      if (H.t > 6 + Math.random() * 6) { H.t = 0; H.dir += (Math.random() - 0.5) * 1.6; }
      const nx = H.cx + Math.sin(H.dir) * 0.6 * dt * 2, nz = H.cz + Math.cos(H.dir) * 0.6 * dt * 2;
      if (okGround(nx + Math.sin(H.dir) * 10, nz + Math.cos(H.dir) * 10)) { H.cx = nx; H.cz = nz; } else H.dir += 1.3 * dt;
      if (Math.hypot(H.cx - cam.x, H.cz - cam.z) > 420) { this.herds.splice(this.herds.indexOf(H), 1); break; }
      for (const A of H.members) {
        const tx = H.cx + A.ox, tz = H.cz + A.oz;
        const dx = tx - A.x, dz = tz - A.z, d = Math.hypot(dx, dz);
        A.graze -= dt;
        const moving = d > 1.5 && A.graze < 0;
        if (A.graze < -6) A.graze = 2 + Math.random() * 6;
        const target = moving ? Math.min(1.6, d * 0.4) : 0;
        A.sp += (target - A.sp) * Math.min(1, dt * 2);
        if (A.sp > 0.05) {
          const want = Math.atan2(dx, dz);
          let dh = Math.atan2(Math.sin(want - A.h), Math.cos(want - A.h));
          A.h += dh * Math.min(1, dt * 2.5);
          A.x += Math.sin(A.h) * A.sp * dt; A.z += Math.cos(A.h) * A.sp * dt;
        }
        if (n >= 64) continue;
        const y = terrain.height(A.x, A.z);
        const grazing = A.sp < 0.1 ? 1 : 0;
        e.set(grazing * 0.12, A.h, 0, 'YXZ');
        // y scale carries the gait (read in the shader); 1.0 + tiny = still
        sc.set(A.sc, A.sc * (1 + Math.min(0.02, A.sp * 0.012)), A.sc);
        this.m4.compose(p.set(A.x, y - 0.03, A.z), q.setFromEuler(e), sc);
        this.grazers.setMatrixAt(n++, this.m4);
      }
    }
    this.grazers.count = n;
    this.grazers.instanceMatrix.needsUpdate = true;
    this.updateFish(dt, cam, s);
  }

  // schools of small fish cruising just under the surface of nearby lakes
  // (Fish stage, after algae has fed the water)
  updateFish(dt, cam, s) {
    const terrain = this.game.terrain;
    const L = U.uWaterLevel.value;
    const want = s >= 7.3 ? (s >= 9 ? 6 : 3) : 0;
    const deep = (x, z, d) => terrain.inWorld(x, z, 50) && terrain.height(x, z) < L - d;
    while (this.schools.length < want) {
      let x = 0, z = 0, ok = false;
      for (let t = 0; t < 16 && !ok; t++) { const a = Math.random() * 6.28, r = 15 + Math.random() * 110; x = cam.x + Math.cos(a) * r; z = cam.z + Math.sin(a) * r; ok = deep(x, z, 2.2); }
      if (!ok) break;
      this.schools.push({ x, z, h: Math.random() * 6.28, n: 6 + Math.floor(Math.random() * 8), t: 0, sp: 1.2 + Math.random() });
    }
    this.schools.length = Math.min(this.schools.length, want);
    let n = 0;
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(1, 1, 1);
    for (let i = this.schools.length - 1; i >= 0; i--) {
      const F = this.schools[i];
      F.t += dt;
      F.h += Math.sin(F.t * 0.7 + i) * 0.4 * dt;
      const nx = F.x + Math.sin(F.h) * F.sp * dt, nz = F.z + Math.cos(F.h) * F.sp * dt;
      if (deep(nx + Math.sin(F.h) * 3, nz + Math.cos(F.h) * 3, 1.4)) { F.x = nx; F.z = nz; } else F.h += 2.0 * dt + 0.5;
      if (Math.hypot(F.x - cam.x, F.z - cam.z) > 220) { this.schools.splice(i, 1); continue; }
      for (let k = 0; k < F.n && n < 80; k++) {
        const ox = Math.sin(k * 2.39 + F.t * 0.6) * (0.5 + (k % 4) * 0.35), oz = Math.cos(k * 1.7 + F.t * 0.5) * (0.5 + (k % 3) * 0.4) - k * 0.12;
        const c = Math.cos(F.h), sn = Math.sin(F.h);
        const x = F.x + ox * c + oz * sn, z = F.z - ox * sn + oz * c;
        e.set(0, F.h + Math.sin(F.t * 2 + k) * 0.15, 0);
        this.m4.compose(p.set(x, L - 0.45 - (k % 3) * 0.25, z), q.setFromEuler(e), sc.setScalar(0.85 + (k % 5) * 0.08));
        this.fish.setMatrixAt(n++, this.m4);
      }
    }
    this.fish.count = n;
    this.fish.instanceMatrix.needsUpdate = true;
  }
}
