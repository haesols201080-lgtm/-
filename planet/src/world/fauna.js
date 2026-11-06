// Life that arrives with terraforming: glowing pollinators near plants
// (Insects stage), flocks of gliding birds (Fauna stage, more once the
// ecosystem thrives) and herds of grazers wandering the grassland. All
// instanced; wings flap and legs step in the vertex shader.
import * as THREE from 'three';
import { U } from '../core/shared.js';
import { GeoBuilder } from '../core/geobuilder.js';

// Long-legged grazer (antelope-like): body, neck, head, ears, tail and four
// legs whose swing is driven in the vertex shader by a per-instance gait phase.
function grazerGeometry() {
  const gb = new GeoBuilder(['aLeg']);
  const hide = [0.4, 0.26, 0.16], belly = [0.78, 0.7, 0.58], dark = [0.14, 0.1, 0.08];
  const body = new THREE.SphereGeometry(0.5, 16, 12); body.scale(0.5, 0.56, 1.3);
  gb.add(body, { pos: new THREE.Vector3(0, 1.05, 0), color: (x, y) => (y < -0.33 ? belly : y > 0.38 ? [0.32, 0.2, 0.12] : hide), attrs: { aLeg: 0 } });
  const neck = new THREE.CylinderGeometry(0.085, 0.14, 0.72, 8); neck.rotateX(-0.55);
  gb.add(neck, { pos: new THREE.Vector3(0, 1.45, 0.56), color: hide, attrs: { aLeg: 0 } });
  const head = new THREE.SphereGeometry(0.13, 10, 8); head.scale(0.8, 0.85, 1.7);
  gb.add(head, { pos: new THREE.Vector3(0, 1.8, 0.8), color: hide, attrs: { aLeg: 0 } });
  gb.add(new THREE.SphereGeometry(0.045, 6, 4), { pos: new THREE.Vector3(0, 1.76, 1.0), color: dark, attrs: { aLeg: 0 } });
  for (const sx of [-1, 1]) {
    const ear = new THREE.ConeGeometry(0.05, 0.18, 5); ear.rotateZ(sx * 0.6);
    gb.add(ear, { pos: new THREE.Vector3(sx * 0.09, 1.93, 0.72), color: hide, attrs: { aLeg: 0 } });
    const horn = new THREE.CylinderGeometry(0.012, 0.025, 0.36, 5); horn.rotateX(-0.5); horn.rotateZ(sx * 0.15);
    gb.add(horn, { pos: new THREE.Vector3(sx * 0.05, 2.04, 0.68), color: dark, attrs: { aLeg: 0 } });
  }
  const tail = new THREE.CylinderGeometry(0.03, 0.05, 0.3, 5); tail.rotateX(0.5);
  gb.add(tail, { pos: new THREE.Vector3(0, 1.12, -0.66), color: dark, attrs: { aLeg: 0 } });
  // legs: aLeg = +1 / -1 picks the gait phase (diagonal pairs move together)
  for (const [lx, lz, ph] of [[-0.17, 0.42, 1], [0.17, 0.42, -1], [-0.17, -0.42, -1], [0.17, -0.42, 1]]) {
    const leg = new THREE.CylinderGeometry(0.03, 0.055, 0.86, 6);
    gb.add(leg, { pos: new THREE.Vector3(lx, 0.45, lz), color: (x, y) => (y < -0.3 ? dark : hide), attrs: { aLeg: ph } });
  }
  return gb.build();
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
          float k = clamp((0.88 - position.y) / 0.88, 0.0, 1.0);
          transformed.z += sin(sw) * k * 0.86;
          transformed.y += (1.0 - cos(sw)) * k * 0.2;
        }`);
  };
  m.customProgramCacheKey = () => 'grazer-v2';
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
    const wantFlocks = s >= 11.5 ? 7 : s >= 11 ? 4 : s >= 10 ? 2 : 0;
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
    const want = s >= 11.5 ? 5 : s >= 11 ? 2 : 0;
    const okGround = (x, z) => {
      if (!terrain.inWorld(x, z, 50)) return false;
      const h = terrain.height(x, z);
      return h > U.uWaterLevel.value + 1 && terrain.slope(x, z) < 0.3 && !this.game.buildings.isBlocked(x, z, 6);
    };
    while (this.herds.length < want) {
      let cx = 0, cz = 0, ok = false;
      for (let t = 0; t < 12 && !ok; t++) { const a = Math.random() * 6.28, r = 70 + Math.random() * 120; cx = cam.x + Math.cos(a) * r; cz = cam.z + Math.sin(a) * r; ok = okGround(cx, cz); }
      if (!ok) break;
      const n = (s >= 11.5 ? 6 : 4) + Math.floor(Math.random() * 5);
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
  }
}
