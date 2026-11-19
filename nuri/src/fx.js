// Lightweight particle effects: footstep dust, splashes, water rings, sparkles, booster exhaust, dust motes.
import * as THREE from 'three';

export class FX {
  constructor(scene, max = 900) {
    this.scene = scene; this.max = max;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 4); this.size = new Float32Array(max);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 4));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uScale: { value: 600 } },
      vertexShader: `attribute float size; attribute vec4 color; varying vec4 vC; uniform float uScale;
        void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec4 vC; void main(){ vec2 d = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.0, length(d)); gl_FragColor = vec4(vC.rgb, vC.a * a);
        #include <colorspace_fragment>
      }`,
    });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.points.renderOrder = 5;
    scene.add(this.points);
    this.p = []; // particles
    // water rings
    this.rings = [];
    this.ringGeo = new THREE.RingGeometry(0.8, 1, 40); this.ringGeo.rotateX(-Math.PI / 2);
  }
  spawn(o) { if (this.p.length < this.max) this.p.push({ life: 0, ...o }); }
  dust(pos, n = 6, color = [0.55, 0.47, 0.36]) {
    for (let i = 0; i < n; i++) this.spawn({ x: pos.x + (Math.random() - 0.5) * 0.06, y: pos.y + 0.01, z: pos.z + (Math.random() - 0.5) * 0.06,
      vx: (Math.random() - 0.5) * 0.4, vy: 0.15 + Math.random() * 0.25, vz: (Math.random() - 0.5) * 0.4, g: 0.2, drag: 2.5,
      max: 0.6 + Math.random() * 0.5, s0: 0.025, s1: 0.07, c: color, a: 0.35 });
  }
  splash(pos, k = 1) {
    for (let i = 0; i < 26 * k; i++) {
      const a = Math.random() * 6.28, sp = 0.4 + Math.random() * 1.2;
      this.spawn({ x: pos.x, y: pos.y + 0.02, z: pos.z, vx: Math.cos(a) * sp * 0.6, vy: 1.2 + Math.random() * 1.5 * k, vz: Math.sin(a) * sp * 0.6, g: 9.8, drag: 0.4,
        max: 0.5 + Math.random() * 0.3, s0: 0.02, s1: 0.012, c: [0.85, 0.92, 0.95], a: 0.7 });
    }
    this.ring(pos, 0.5 * k + 0.2);
  }
  ring(pos, size = 0.4) {
    const m = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: 0xdff4f6, transparent: true, opacity: 0.5, depthWrite: false }));
    m.position.set(pos.x, pos.y + 0.004, pos.z); m.scale.setScalar(0.05); m.renderOrder = 3;
    this.scene.add(m); this.rings.push({ m, t: 0, size });
  }
  burst(pos, color = 0x7ff0ff, n = 20) {
    const c = new THREE.Color(color);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28, b = Math.random() * 3.14, sp = 0.5 + Math.random() * 0.9;
      this.spawn({ x: pos.x, y: pos.y, z: pos.z, vx: Math.cos(a) * Math.sin(b) * sp, vy: Math.cos(b) * sp + 0.4, vz: Math.sin(a) * Math.sin(b) * sp, g: 0.6, drag: 2,
        max: 0.6 + Math.random() * 0.6, s0: 0.03, s1: 0.0, c: [c.r, c.g, c.b], a: 1, add: true });
    }
  }
  exhaust(pos) {
    this.spawn({ x: pos.x + (Math.random() - 0.5) * 0.02, y: pos.y, z: pos.z + (Math.random() - 0.5) * 0.02, vx: (Math.random() - 0.5) * 0.2, vy: -1.2, vz: (Math.random() - 0.5) * 0.2,
      g: 0, drag: 3, max: 0.25, s0: 0.03, s1: 0.06, c: [0.6, 0.95, 1], a: 0.5 });
  }
  update(dt) {
    const P = this.p; let n = 0;
    for (let i = P.length - 1; i >= 0; i--) {
      const q = P[i]; q.life += dt;
      if (q.life > q.max) { P.splice(i, 1); continue; }
      q.vy -= q.g * dt; const k = Math.exp(-q.drag * dt); q.vx *= k; q.vy *= k; q.vz *= k;
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
    }
    for (const q of P) {
      const t = q.life / q.max;
      this.pos[n * 3] = q.x; this.pos[n * 3 + 1] = q.y; this.pos[n * 3 + 2] = q.z;
      this.col[n * 4] = q.c[0]; this.col[n * 4 + 1] = q.c[1]; this.col[n * 4 + 2] = q.c[2]; this.col[n * 4 + 3] = q.a * (1 - t) * Math.min(1, q.life * 10);
      this.size[n] = q.s0 + (q.s1 - q.s0) * t; n++;
    }
    this.points.geometry.setDrawRange(0, n);
    for (const a of ['position', 'color', 'size']) this.points.geometry.attributes[a].needsUpdate = true;
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i]; r.t += dt;
      const t = r.t / 1.2; r.m.scale.setScalar(0.05 + r.size * t); r.m.material.opacity = 0.45 * (1 - t);
      if (t >= 1) { this.scene.remove(r.m); r.m.material.dispose(); this.rings.splice(i, 1); }
    }
  }
  setHeight(h) { this.mat.uniforms.uScale.value = h * 0.9; }
}
