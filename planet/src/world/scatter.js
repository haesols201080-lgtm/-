// Near-field scatter: deterministic per-tile placement of small things
// (stones, moss, grass, flowers, shrubs) in a radius around the camera.
// Rebuilt only when the camera crosses a tile or the world changes.
import * as THREE from 'three';
import { mulberry32, hash2 } from '../core/noise.js';

export class Scatter {
  constructor(scene, { tile = 24, radius = 100, layers = [] }) {
    this.scene = scene;
    this.tile = tile;
    this.radius = radius;
    this.layers = layers.map((L, li) => {
      const mesh = new THREE.InstancedMesh(L.geo, L.mat, L.max);
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.castShadow = !!L.castShadow;
      if (L.mat.depthMat) mesh.customDepthMaterial = L.mat.depthMat;
      mesh.receiveShadow = true;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const extra = {};
      for (const [name, size] of Object.entries(L.attrs || {})) {
        const a = new THREE.InstancedBufferAttribute(new Float32Array(L.max * size), size);
        a.setUsage(THREE.DynamicDrawUsage);
        L.geo.setAttribute(name, a);
        extra[name] = a;
      }
      scene.add(mesh);
      return { ...L, mesh, extra, li };
    });
    this.key = '';
    this.dirty = true;
    this.densityScale = 1;
    this.m4 = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.v = new THREE.Vector3();
    this.s = new THREE.Vector3();
    this.e = new THREE.Euler();
  }

  invalidate() { this.dirty = true; }

  update(camPos) {
    const T = this.tile;
    const ci = Math.floor(camPos.x / T), cj = Math.floor(camPos.z / T);
    const key = ci + ',' + cj;
    if (key === this.key && !this.dirty) return;
    this.key = key;
    this.dirty = false;
    const R = Math.ceil(this.radius / T);
    for (const L of this.layers) {
      if (L.enabled && !L.enabled()) { L.mesh.count = 0; L.mesh.visible = false; continue; }
      L.mesh.visible = true;
      let n = 0;
      const rad = (L.radius || this.radius);
      const R2 = Math.ceil(rad / T);
      for (let dj = -R2; dj <= R2 && n < L.max; dj++) {
        for (let di = -R2; di <= R2 && n < L.max; di++) {
          const ti = ci + di, tj = cj + dj;
          const tx = ti * T, tz = tj * T;
          const dist = Math.hypot(tx + T / 2 - camPos.x, tz + T / 2 - camPos.z);
          if (dist > rad + T) continue;
          const rnd = mulberry32((hash2(ti, tj, L.li * 977 + 13) * 4294967296) >>> 0);
          const count = Math.round(L.perTile * this.densityScale * (L.densityFalloff ? Math.max(0.25, 1 - dist / (rad * 1.2)) : 1));
          for (let k = 0; k < count && n < L.max; k++) {
            const x = tx + rnd() * T, z = tz + rnd() * T;
            const r1 = rnd(), r2 = rnd(), r3 = rnd(), r4 = rnd();
            const out = L.place(x, z, r1, r2, r3, r4);
            if (!out) continue;
            this.v.set(x, out.y, z);
            if (out.q) this.q.copy(out.q); else this.q.setFromEuler(this.e.set(out.rx || 0, out.ry || 0, out.rz || 0));
            this.s.set(out.sx || out.s, out.sy || out.s, out.sz || out.s);
            this.m4.compose(this.v, this.q, this.s);
            L.mesh.setMatrixAt(n, this.m4);
            if (out.attrs) for (const name in out.attrs) {
              const a = L.extra[name];
              const val = out.attrs[name];
              if (a.itemSize === 1) a.array[n] = val; else a.array.set(val, n * a.itemSize);
            }
            n++;
          }
        }
      }
      L.mesh.count = n;
      L.mesh.instanceMatrix.needsUpdate = true;
      for (const a of Object.values(L.extra)) a.needsUpdate = true;
    }
  }
}
