// Effects: rain streaks and dust around the camera, construction (ground
// dust and welding sparks with arc flashes), the multitool mining beam.
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
    this.rainU = { uCam: { value: new THREE.Vector3() }, uTime: U.uTime, uAmt: { value: 0 }, uSnow: { value: 0 }, uSunColor: U.uSunColor };
    this.rain = new THREE.LineSegments(rg, new THREE.ShaderMaterial({
      uniforms: this.rainU,
      vertexShader: LOGV + /* glsl */`
        uniform vec3 uCam; uniform float uTime, uSnow;
        attribute float aEnd;
        varying float vA;
        void main() {
          vec3 p = position;
          // rain streaks fall fast; snowflakes drift down slowly and sway
          float fall = mod(p.y - uTime * mix(24.0, 1.6, uSnow), 40.0);
          vec3 w = vec3(mod(p.x - uCam.x + 30.0, 60.0) - 30.0 + uCam.x, uCam.y - 15.0 + fall, mod(p.z - uCam.z + 30.0, 60.0) - 30.0 + uCam.z);
          w.x += uSnow * sin(uTime * 0.9 + p.z * 0.7) * 0.6; w.z += uSnow * cos(uTime * 0.7 + p.x * 0.6) * 0.6;
          w.y += aEnd * mix(0.7, 0.07, uSnow); w.x += aEnd * mix(0.08, 0.07, uSnow);
          vA = 1.0 - aEnd * 0.6;
          gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: LOGF + /* glsl */`
        uniform float uAmt, uSnow; uniform vec3 uSunColor;
        varying float vA;
        void main() {
          #include <logdepthbuf_fragment>
          vec3 c = mix(vec3(0.7, 0.75, 0.8), vec3(1.0), uSnow) * (0.4 + 0.6 * uSunColor);
          gl_FragColor = vec4(c, mix(0.35, 0.9, uSnow) * uAmt * vA);
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
          gl_PointSize = aLife > 0.0 ? clamp(55.0 / -mv.z, 1.2, 4.5) : 0.0;
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: LOGF + /* glsl */`
        varying float vL;
        void main() {
          #include <logdepthbuf_fragment>
          if (vL <= 0.0) discard;
          float d = length(gl_PointCoord - 0.5);
          if (d > 0.5) discard;
          // hot metal: white when fresh, cooling through yellow to dull orange
          vec3 hot = mix(vec3(1.4, 0.38, 0.06), vec3(2.6, 2.1, 1.5), smoothstep(0.35, 0.95, vL));
          gl_FragColor = vec4(hot * 1.6, smoothstep(0.5, 0.05, d) * smoothstep(0.0, 0.25, vL));
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.pNext = 0;
    // welding on new structures: a burst of sparks now and then, and the arc's flicker
    this.welds = [];
    this.arc = new THREE.PointLight(0xcfe4ff, 0, 9, 1.6);
    scene.add(this.arc);

    // mining beam
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    this.beam = new THREE.Line(bg, new THREE.LineBasicMaterial({ color: new THREE.Color(1.5, 3.0, 4.0), transparent: true, opacity: 0.9 }));
    this.beam.frustumCulled = false;
    this.beam.visible = false;
    scene.add(this.beam);
  }

  // a structure goes up: dust kicked out from under it, then a few seconds
  // of welding at random points on its frame
  build(x, y, z, size) {
    const D = this.game.dust;
    if (D) {
      const n = 10 + Math.round(size);
      for (let i = 0; i < n; i++) {
        const a = i / n * 6.283 + Math.random() * 0.5, r = size * (0.45 + Math.random() * 0.25);
        D.puff(x + Math.cos(a) * r, y + 0.5, z + Math.sin(a) * r, { vx: Math.cos(a) * (1.5 + Math.random() * 2), vy: 0.3 + Math.random() * 0.4, vz: Math.sin(a) * (1.5 + Math.random() * 2), s: 1.4 + size * 0.12, grow: 2.4, max: 3.5 + Math.random() * 2.5, a: 0.5, kind: 'dust', drift: 0.4 });
      }
    }
    this.welds.push({ x, y, z, size, t: 3.0 + Math.random(), next: 0 });
    if (this.welds.length > 4) this.welds.shift();
  }

  sparks(p, n = 3) {
    for (let i = 0; i < n; i++) {
      const k = this.pNext; this.pNext = (this.pNext + 1) % this.pLife.length;
      this.pPos.set([p.x, p.y, p.z], k * 3);
      this.pVel.set([(Math.random() - 0.5) * 4, Math.random() * 3, (Math.random() - 0.5) * 4], k * 3);
      this.pLife[k] = 0.6;
    }
  }
  spark(x, y, z, vx, vy, vz, life) {
    const k = this.pNext; this.pNext = (this.pNext + 1) % this.pLife.length;
    this.pPos.set([x, y, z], k * 3); this.pVel.set([vx, vy, vz], k * 3); this.pLife[k] = life;
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

  update(dt, cam, storm, snow = 0) {
    this.rainU.uCam.value.copy(cam);
    const fall = Math.max(storm, snow);
    this.rainU.uAmt.value = Math.min(1, fall);
    this.rainU.uSnow.value = snow > storm ? 1 : 0;
    this.rain.visible = (storm > 0.05 && U.uWaterLevel.value > -1000) || snow > 0.05;
    // welding: bursts of sparks at points on the frame, the arc flickering
    this.arc.intensity *= Math.max(0, 1 - dt * 25);
    for (let i = this.welds.length - 1; i >= 0; i--) {
      const W = this.welds[i];
      W.t -= dt; W.next -= dt;
      if (W.t <= 0) { this.welds.splice(i, 1); continue; }
      if (W.next <= 0) {
        W.next = 0.06 + Math.random() * 0.22;
        const px = W.x + (Math.random() - 0.5) * W.size * 0.8, py = W.y + 0.4 + Math.random() * W.size * 0.45, pz = W.z + (Math.random() - 0.5) * W.size * 0.8;
        for (let k = 0; k < 7; k++) this.spark(px, py, pz, (Math.random() - 0.5) * 3.5, Math.random() * 2.5, (Math.random() - 0.5) * 3.5, 0.6 + Math.random() * 0.5);
        this.arc.position.set(px, py, pz);
        this.arc.intensity = 3 + Math.random() * 5;
      }
    }
    for (let i = 0; i < this.pLife.length; i++) {
      if (this.pLife[i] <= 0) continue;
      this.pLife[i] -= dt * 1.1;
      this.pVel[i * 3 + 1] -= dt * 5;
      this.pPos[i * 3] += this.pVel[i * 3] * dt; this.pPos[i * 3 + 1] += this.pVel[i * 3 + 1] * dt; this.pPos[i * 3 + 2] += this.pVel[i * 3 + 2] * dt;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.aLife.needsUpdate = true;
  }
}
