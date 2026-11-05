// Effects: rain streaks and dust around the camera, construction sparkle
// bursts, the multitool mining beam.
import * as THREE from 'three';
import { U } from '../core/shared.js';

const LOGV = '#include <common>\n#include <logdepthbuf_pars_vertex>\n';
const LOGF = '#include <common>\n#include <logdepthbuf_pars_fragment>\n';

export class FX {
  constructor(game) {
    this.game = game;
    const scene = game.engine.scene;
    // rain
    const N = 2400;
    const pos = new Float32Array(N * 2 * 3), seed = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) {
      const x = (Math.random() - 0.5) * 60, y = Math.random() * 40, z = (Math.random() - 0.5) * 60;
      pos.set([x, y, z, x, y, z], i * 6);
      seed[i * 2] = 0; seed[i * 2 + 1] = 1;
    }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    rg.setAttribute('aEnd', new THREE.BufferAttribute(seed, 1));
    this.rainU = { uCam: { value: new THREE.Vector3() }, uTime: U.uTime, uAmt: { value: 0 }, uSunColor: U.uSunColor };
    this.rain = new THREE.LineSegments(rg, new THREE.ShaderMaterial({
      uniforms: this.rainU,
      vertexShader: LOGV + /* glsl */`
        uniform vec3 uCam; uniform float uTime;
        attribute float aEnd;
        varying float vA;
        void main() {
          vec3 p = position;
          float fall = mod(p.y - uTime * 24.0, 40.0);
          vec3 w = vec3(mod(p.x - uCam.x + 30.0, 60.0) - 30.0 + uCam.x, uCam.y - 15.0 + fall, mod(p.z - uCam.z + 30.0, 60.0) - 30.0 + uCam.z);
          w.y += aEnd * 0.7; w.x += aEnd * 0.08;
          vA = 1.0 - aEnd * 0.6;
          gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: LOGF + /* glsl */`
        uniform float uAmt; uniform vec3 uSunColor;
        varying float vA;
        void main() {
          #include <logdepthbuf_fragment>
          gl_FragColor = vec4(vec3(0.7, 0.75, 0.8) * (0.4 + 0.6 * uSunColor), 0.35 * uAmt * vA);
        }`,
      transparent: true, depthWrite: false,
    }));
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    scene.add(this.rain);

    // particle bursts (construction)
    const PN = 600;
    this.pPos = new Float32Array(PN * 3);
    this.pVel = new Float32Array(PN * 3);
    this.pLife = new Float32Array(PN);
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3));
    pg.setAttribute('aLife', new THREE.BufferAttribute(this.pLife, 1));
    this.points = new THREE.Points(pg, new THREE.ShaderMaterial({
      uniforms: {},
      vertexShader: LOGV + /* glsl */`
        attribute float aLife; varying float vL;
        void main() {
          vL = aLife;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = aLife > 0.0 ? clamp(120.0 / -mv.z, 1.5, 10.0) : 0.0;
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: LOGF + /* glsl */`
        varying float vL;
        void main() {
          #include <logdepthbuf_fragment>
          if (vL <= 0.0) discard;
          float d = length(gl_PointCoord - 0.5);
          if (d > 0.5) discard;
          gl_FragColor = vec4(vec3(0.5, 0.9, 1.4) * 2.0 * vL, smoothstep(0.5, 0.1, d) * vL);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.pNext = 0;

    // mining beam
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    this.beam = new THREE.Line(bg, new THREE.LineBasicMaterial({ color: new THREE.Color(1.5, 3.0, 4.0), transparent: true, opacity: 0.9 }));
    this.beam.frustumCulled = false;
    this.beam.visible = false;
    scene.add(this.beam);
  }

  build(x, y, z, size) {
    for (let i = 0; i < 90; i++) {
      const k = this.pNext; this.pNext = (this.pNext + 1) % this.pLife.length;
      const a = Math.random() * 6.28, r = Math.random() * size * 0.6;
      this.pPos.set([x + Math.cos(a) * r, y + Math.random() * size * 0.5, z + Math.sin(a) * r], k * 3);
      this.pVel.set([(Math.random() - 0.5) * 2, 1 + Math.random() * 3, (Math.random() - 0.5) * 2], k * 3);
      this.pLife[k] = 1;
    }
  }

  sparks(p, n = 3) {
    for (let i = 0; i < n; i++) {
      const k = this.pNext; this.pNext = (this.pNext + 1) % this.pLife.length;
      this.pPos.set([p.x, p.y, p.z], k * 3);
      this.pVel.set([(Math.random() - 0.5) * 4, Math.random() * 3, (Math.random() - 0.5) * 4], k * 3);
      this.pLife[k] = 0.6;
    }
  }

  // transmission beam from the comms dish into the sky
  skyBeam(b) {
    const [x, z] = this.game.buildings.toWorld(b, 1.2, -1.4);
    const g = new THREE.CylinderGeometry(0.25, 0.6, 1600, 10, 1, true);
    g.translate(0, 800, 0);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 3.0, 4.0), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.position.set(x, b.y + 5.5, z);
    m.frustumCulled = false;
    this.game.engine.scene.add(m);
    const t0 = performance.now();
    const fade = () => {
      const k = (performance.now() - t0) / 4000;
      if (k >= 1) { this.game.engine.scene.remove(m); g.dispose(); return; }
      m.material.opacity = 0.8 * (1 - k);
      m.scale.set(1 + k * 2, 1, 1 + k * 2);
      requestAnimationFrame(fade);
    };
    fade();
  }

  setBeam(a, b) {
    if (!a) { this.beam.visible = false; return; }
    const p = this.beam.geometry.attributes.position;
    p.setXYZ(0, a.x, a.y, a.z); p.setXYZ(1, b.x, b.y, b.z);
    p.needsUpdate = true;
    this.beam.visible = true;
  }

  update(dt, cam, storm) {
    this.rainU.uCam.value.copy(cam);
    this.rainU.uAmt.value = storm;
    this.rain.visible = storm > 0.05 && U.uWaterLevel.value > -1000;
    for (let i = 0; i < this.pLife.length; i++) {
      if (this.pLife[i] <= 0) continue;
      this.pLife[i] -= dt * 0.8;
      this.pVel[i * 3 + 1] -= dt * 2;
      this.pPos[i * 3] += this.pVel[i * 3] * dt; this.pPos[i * 3 + 1] += this.pVel[i * 3 + 1] * dt; this.pPos[i * 3 + 2] += this.pVel[i * 3 + 2] * dt;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.aLife.needsUpdate = true;
  }
}
