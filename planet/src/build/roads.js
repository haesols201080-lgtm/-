// Road network: roads are terrain edits (graded corridors whose ground the
// terrain shader paves with interlocking sintered-regolith tiles), so every
// junction, curve and slope joins seamlessly with no overlapping meshes.
// This module keeps the network's nodes for snapping, the edge marker posts,
// and the hologram ribbon shown while laying a road.
import * as THREE from 'three';
import { GeoBuilder } from '../core/geobuilder.js';
import { makeHologramMaterial } from './materials.js';

export const ROAD_W = 6;

export class Roads {
  constructor(game) {
    this.game = game;
    this.nodes = [];
    const scene = game.engine.scene;
    const pg = new GeoBuilder();
    pg.add(new THREE.CylinderGeometry(0.05, 0.07, 0.95, 8), { pos: new THREE.Vector3(0, 0.47, 0), color: 0x4a4f55 });
    pg.add(new THREE.BoxGeometry(0.16, 0.12, 0.05), { pos: new THREE.Vector3(0, 0.82, 0), color: 0xc85a1c });
    pg.add(new THREE.CylinderGeometry(0.1, 0.12, 0.08, 8), { pos: new THREE.Vector3(0, 0.04, 0), color: 0x2a2d31 });
    this.posts = new THREE.InstancedMesh(pg.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.4 }), 4000);
    this.posts.count = 0; this.posts.castShadow = true; this.posts.frustumCulled = false;
    this.lamps = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 1.6, 0.5) }), 4000);
    this.lamps.count = 0; this.lamps.frustumCulled = false;
    scene.add(this.posts, this.lamps);
    this.holo = makeHologramMaterial();
    this.preview = new THREE.Mesh(new THREE.BufferGeometry(), this.holo);
    this.preview.frustumCulled = false;
    this.preview.renderOrder = 30;
    this.preview.visible = false;
    scene.add(this.preview);
  }

  edits() { return this.game.terrain.edits.list.filter((e) => e.k === 'p'); }

  // rebuild nodes and marker posts from the road edits
  rebuild() {
    const T = this.game.terrain;
    this.nodes = [];
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1);
    let n = 0;
    for (const e of this.edits()) {
      const P = e.pts;
      const cnt = P.length / 3;
      this.nodes.push({ x: P[0], z: P[2], end: true }, { x: P[P.length - 3], z: P[P.length - 1], end: true });
      let acc = 0;
      for (let i = 0; i < cnt - 1; i++) {
        const ax = P[i * 3], az = P[i * 3 + 2], bx = P[i * 3 + 3], bz = P[i * 3 + 5];
        const L = Math.hypot(bx - ax, bz - az);
        if (i % 2 === 0) this.nodes.push({ x: ax, z: az, end: false });
        const nx = -(bz - az) / (L || 1), nz = (bx - ax) / (L || 1);
        for (let t = acc; t < L; t += 12) {
          const k = t / L, x = ax + (bx - ax) * k, z = az + (bz - az) * k;
          for (const sd of [-1, 1]) {
            if (n >= 4000) break;
            const px = x + nx * sd * (e.w / 2 + 0.6), pz = z + nz * sd * (e.w / 2 + 0.6);
            if (this.onRoad(px, pz, e)) continue;   // skip posts that would stand in another road
            m4.compose(new THREE.Vector3(px, T.height(px, pz), pz), q, s);
            this.posts.setMatrixAt(n, m4);
            m4.compose(new THREE.Vector3(px, T.height(px, pz) + 0.96, pz), q, s);
            this.lamps.setMatrixAt(n, m4);
            n++;
          }
        }
        acc = (acc + 12 - (L % 12)) % 12;
      }
    }
    this.posts.count = this.lamps.count = n;
    this.posts.instanceMatrix.needsUpdate = this.lamps.instanceMatrix.needsUpdate = true;
  }

  onRoad(x, z, except) {
    for (const e of this.edits()) {
      if (e === except) continue;
      const P = e.pts;
      for (let i = 0; i < P.length - 3; i += 3) {
        const ax = P[i], az = P[i + 2], bx = P[i + 3], bz = P[i + 5];
        const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
        if (Math.hypot(ax + dx * t - x, az + dz * t - z) < e.w / 2 + 0.8) return true;
      }
    }
    return false;
  }

  snap(x, z, r = 5) {
    let best = null, bd = r;
    for (const n of this.nodes) {
      const d = Math.hypot(n.x - x, n.z - z) - (n.end ? 1.5 : 0);
      if (d < bd) { bd = d; best = n; }
    }
    return best ? { x: best.x, z: best.z, snapped: true } : { x, z, snapped: false };
  }

  showPreview(a, b, valid) {
    if (!a || !b) { this.preview.visible = false; return; }
    const T = this.game.terrain;
    const L = Math.hypot(b.x - a.x, b.z - a.z);
    const n = Math.max(2, Math.ceil(L / 2));
    const nx = -(b.z - a.z) / (L || 1), nz = (b.x - a.x) / (L || 1);
    const pos = [], idx = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
      for (const sd of [-1, 1]) {
        const px = x + nx * sd * ROAD_W / 2, pz = z + nz * sd * ROAD_W / 2;
        pos.push(px, T.height(px, pz) + 0.25, pz);
      }
      if (i < n) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    this.preview.geometry.dispose();
    this.preview.geometry = g;
    this.holo.uniforms.uColor.value.setRGB(...(valid ? [0.3, 0.75, 1.0] : [1.0, 0.25, 0.18]));
    this.preview.visible = true;
  }
}
