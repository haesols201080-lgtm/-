// Life that arrives with terraforming: glowing pollinators near plants
// (Insects stage), flocks of gliding birds (Fauna stage) and fish shadows in
// the lakes. All instanced with wing-flap in the vertex shader.
import * as THREE from 'three';
import { U } from '../core/shared.js';

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
    this.birds = new THREE.InstancedMesh(bird, wingMaterial(new THREE.Color(0.85, 0.82, 0.78), false), 48);
    this.birds.count = 0; this.birds.frustumCulled = false; this.birds.castShadow = true;
    scene.add(this.birds);
    this.flocks = [];
    this.m4 = new THREE.Matrix4();
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
    const wantFlocks = s >= 11 ? 4 : s >= 10 ? 2 : 0;
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
      for (let k = 0; k < f.n && n < 48; k++) {
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
  }
}
