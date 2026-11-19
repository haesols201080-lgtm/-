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
    // real water droplets: tiny glossy spheres with gravity that fall back and disturb the surface
    this.DMAX = 320;
    this.dropMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshPhysicalMaterial({ color: 0xe8f4f4, roughness: 0.04, metalness: 0,
      transparent: true, opacity: 0.38, envMapIntensity: 2.2, clearcoat: 1, depthWrite: false }), this.DMAX);
    this.dropMesh.count = 0; this.dropMesh.frustumCulled = false; this.dropMesh.renderOrder = 4; scene.add(this.dropMesh);
    this.drops = [];
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._s = new THREE.Vector3(); this._p = new THREE.Vector3(); this._v = new THREE.Vector3();
    // foam patch left on the surface after a splash
    const fc = document.createElement('canvas'); fc.width = fc.height = 128; const fg = fc.getContext('2d');
    for (let i = 0; i < 260; i++) { const a = Math.random() * 6.28, r = Math.pow(Math.random(), 0.7) * 54; fg.fillStyle = `rgba(255,255,255,${0.15 + Math.random() * 0.35})`;
      fg.beginPath(); fg.arc(64 + Math.cos(a) * r, 64 + Math.sin(a) * r, 1 + Math.random() * 4, 0, 6.28); fg.fill(); }
    this.foamTex = new THREE.CanvasTexture(fc); this.foamTex.colorSpace = THREE.SRGBColorSpace;
    this.foams = [];
    this.water = null; // { y, isWater(x,z), onDrop(x,z,radius,strength) }
  }
  setWater(w) { this.water = w; }
  // ambient life in the air around the camera: dust motes glinting in the light and slowly falling needles
  initAmbient(count = 220) {
    const mk = (n, size, color, additive) => {
      const g = new THREE.BufferGeometry(); const pos = new Float32Array(n * 3), seed = new Float32Array(n);
      for (let i = 0; i < n; i++) { pos.set([Math.random(), Math.random(), Math.random()], i * 3); seed[i] = Math.random(); }
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
      const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        uniforms: { uCam: { value: new THREE.Vector3() }, uTime: { value: 0 }, uBox: { value: new THREE.Vector3(7, 3.2, 7) }, uSize: { value: size }, uColor: { value: new THREE.Color(color) }, uScale: { value: 600 }, uFall: { value: additive ? 0.02 : 0.25 } },
        vertexShader: `attribute float seed; uniform vec3 uCam, uBox; uniform float uTime, uSize, uScale, uFall; varying float vA;
          void main(){
            vec3 p = position * uBox;
            p.y -= uTime * uFall * (0.6 + seed);
            p.x += sin(uTime * (0.3 + seed * 0.4) + seed * 30.0) * 0.25 + uTime * 0.05;
            p.z += cos(uTime * (0.25 + seed * 0.3) + seed * 17.0) * 0.25;
            vec3 o = uCam - uBox * 0.5; o.y = uCam.y - 0.6;
            p = o + mod(p - o, uBox);
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            float d = -mv.z;
            vA = smoothstep(0.15, 0.6, d) * (1.0 - smoothstep(3.0, 4.5, d)) * (0.5 + 0.5 * sin(uTime * 2.0 + seed * 40.0));
            gl_PointSize = uSize * uScale / d; gl_Position = projectionMatrix * mv; }`,
        fragmentShader: `uniform vec3 uColor; varying float vA; void main(){ vec2 c = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.0, length(c)) * vA; gl_FragColor = vec4(uColor, a);
          #include <colorspace_fragment>
        }` });
      const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 6; this.scene.add(pts); return pts;
    };
    this.motes = mk(count, 0.006, 0xfff1cf, true);
    this.needles = mk(Math.round(count * 0.25), 0.007, 0x3b2a18, false);
  }
  updateAmbient(t, cam, light = 1) {
    if (!this.motes) return;
    for (const p of [this.motes, this.needles]) { const u = p.material.uniforms; u.uCam.value.copy(cam); u.uTime.value = t; u.uScale.value = this.mat.uniforms.uScale.value; }
    this.motes.material.uniforms.uColor.value.setRGB(1.0 * light, 0.94 * light, 0.8 * light);
  }
  droplet(x, y, z, vx, vy, vz, r) { if (this.drops.length < this.DMAX) this.drops.push({ x, y, z, vx, vy, vz, r, t: 0 }); }
  foam(pos, size) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: this.foamTex, transparent: true, depthWrite: false, opacity: 0.3, color: 0xdfe8e6 }));
    m.position.set(pos.x, pos.y + 0.006, pos.z); m.scale.setScalar(size * 0.5); m.rotation.y = Math.random() * 6; m.renderOrder = 3;
    this.scene.add(m); this.foams.push({ m, t: 0, size });
  }
  // big entry splash: crown of droplets, spray mist, foam and an outgoing ring
  waterSplash(pos, k = 1) {
    const n = Math.round(30 * k);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28, sp = (0.5 + Math.random() * 1.2) * (0.6 + k * 0.5), up = (1.6 + Math.random() * 2.2) * (0.5 + k * 0.6);
      this.droplet(pos.x + Math.cos(a) * 0.06, pos.y + 0.02, pos.z + Math.sin(a) * 0.06, Math.cos(a) * sp, up, Math.sin(a) * sp, 0.0025 + Math.random() * 0.006 * k);
    }
    for (let i = 0; i < 14 * k; i++) {
      const a = Math.random() * 6.28;
      this.spawn({ x: pos.x, y: pos.y + 0.05, z: pos.z, vx: Math.cos(a) * 0.6, vy: 0.8 + Math.random() * 1.2, vz: Math.sin(a) * 0.6, g: 1.5, drag: 2.2,
        max: 0.7 + Math.random() * 0.4, s0: 0.03, s1: 0.12, c: [0.9, 0.95, 0.97], a: 0.16 });
    }
  }
  // little kick-up of water at the feet when wading or swimming
  wadeSplash(pos, dir, k = 0.5) {
    for (let i = 0; i < 8 * k + 2; i++) {
      const a = Math.random() * 6.28, sp = 0.3 + Math.random() * 0.5;
      this.droplet(pos.x, pos.y + 0.01, pos.z, Math.cos(a) * sp + dir.x * 0.6, 0.8 + Math.random() * 1.0, Math.sin(a) * sp + dir.z * 0.6, 0.002 + Math.random() * 0.004);
    }
  }
  drip(pos) { this.droplet(pos.x + (Math.random() - 0.5) * 0.12, pos.y, pos.z + (Math.random() - 0.5) * 0.12, 0, -0.2, 0, 0.0025 + Math.random() * 0.002); }
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
  ring(pos, size = 0.4, op = 0.45) {
    const m = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: 0xdff4f6, transparent: true, opacity: 0.5, depthWrite: false }));
    m.position.set(pos.x, pos.y + 0.004, pos.z); m.scale.setScalar(0.05); m.renderOrder = 3;
    this.scene.add(m); this.rings.push({ m, t: 0, size, op });
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
    // droplets
    let dn = 0;
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i]; d.t += dt;
      d.vy -= 9.8 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
      const W = this.water;
      if (W && d.vy < 0 && d.y <= W.y && W.isWater(d.x, d.z)) {
        W.onDrop(d.x, d.z, Math.max(0.03, d.r * 5), -d.r * 0.9);
        this.drops.splice(i, 1); continue;
      }
      if (d.t > 3 || d.y < (W ? W.ground(d.x, d.z) : -10)) { this.drops.splice(i, 1); continue; }
    }
    for (const d of this.drops) {
      const sp = Math.hypot(d.vx, d.vy, d.vz);
      this._v.set(d.vx, d.vy, d.vz).normalize();
      this._q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), this._v);
      this._s.set(d.r, d.r * (1 + Math.min(1.2, sp * 0.18)), d.r);
      this._m.compose(this._p.set(d.x, d.y, d.z), this._q, this._s);
      this.dropMesh.setMatrixAt(dn++, this._m);
    }
    this.dropMesh.count = dn; this.dropMesh.instanceMatrix.needsUpdate = true;
    for (let i = this.foams.length - 1; i >= 0; i--) {
      const f = this.foams[i]; f.t += dt; const t = f.t / 4;
      f.m.scale.setScalar(f.size * (0.5 + t * 0.8)); f.m.material.opacity = 0.3 * (1 - t) * (1 - t);
      if (t >= 1) { this.scene.remove(f.m); f.m.geometry.dispose(); f.m.material.dispose(); this.foams.splice(i, 1); }
    }
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
      const t = r.t / 1.2; r.m.scale.setScalar(0.05 + r.size * t); r.m.material.opacity = r.op * (1 - t);
      if (t >= 1) { this.scene.remove(r.m); r.m.material.dispose(); this.rings.splice(i, 1); }
    }
  }
  setHeight(h) { this.mat.uniforms.uScale.value = h * 0.9; }
}
