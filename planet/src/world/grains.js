// Kicked-up material, done physically instead of as soft puffs: thousands of
// small grains thrown on ballistic arcs under the planet's gravity, with the
// thin air's drag, landing and lying still for a moment before fading. Each
// grain is drawn as a quad stretched along its screen-space motion (the
// streak a camera sees), lit by the sun. Kinds: 0 regolith grain, 1 water
// droplet, 2 fine dust mote (drifts, slow to settle).
import * as THREE from 'three';
import { U, WORLD } from '../core/shared.js';

const CAP = 5000;

export class Grains {
  constructor(game) {
    this.game = game;
    const g = new THREE.PlaneGeometry(1, 1);
    this.iPos = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 3), 3);
    this.iVel = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 3), 3);
    this.iInf = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 4), 4);   // size, alpha, tone, kind
    for (const a of [this.iPos, this.iVel, this.iInf]) a.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iPos', this.iPos); g.setAttribute('iVel', this.iVel); g.setAttribute('iInf', this.iInf);
    this.uRes = { value: new THREE.Vector2(1280, 720) };
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uSunDir: U.uSunDir, uSunColor: U.uSunColor, uNight: U.uNight, uRes: this.uRes },
      transparent: true, depthWrite: false,
      vertexShader: '#include <common>\n#include <logdepthbuf_pars_vertex>\n' + /* glsl */`
        attribute vec3 iPos, iVel; attribute vec4 iInf;
        uniform vec2 uRes;
        varying vec2 vUv; varying vec4 vInf;
        void main() {
          vInf = iInf; vUv = uv;
          vec4 c0 = projectionMatrix * viewMatrix * vec4(iPos, 1.0);
          vec4 c1 = projectionMatrix * viewMatrix * vec4(iPos - iVel * 0.03, 1.0);
          vec2 s0 = c0.xy / c0.w, s1 = c1.xy / max(c1.w, 0.001);
          vec2 d = (s0 - s1) * uRes * 0.5;
          float len = length(d);
          vec2 dir = len > 0.01 ? d / len : vec2(1.0, 0.0), perp = vec2(-dir.y, dir.x);
          float px = max(1.1, iInf.x * projectionMatrix[1][1] * uRes.y * 0.5 / c0.w);
          vec2 mid = (s0 + s1) * 0.5;
          vec2 off = dir * position.x * (len + px) + perp * position.y * px;
          gl_Position = vec4((mid + off * 2.0 / uRes) * c0.w, c0.z, c0.w);
          // a grain under one pixel shows as a fainter pixel, not a bigger one
          vInf.y *= min(1.0, iInf.x * projectionMatrix[1][1] * uRes.y * 0.5 / c0.w / 1.1 + 0.25);
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: '#include <common>\n#include <logdepthbuf_pars_fragment>\n' + /* glsl */`
        uniform vec3 uSunDir, uSunColor; uniform float uNight;
        varying vec2 vUv; varying vec4 vInf;
        void main() {
          #include <logdepthbuf_fragment>
          vec2 p = (vUv - 0.5) * 2.0;
          float r = length(vec2(p.x * 0.85, p.y));
          float a = smoothstep(1.0, 0.55, r) * vInf.y;
          if (a < 0.01) discard;
          float day = clamp(uSunDir.y * 2.2 + 0.1, 0.0, 1.0);
          vec3 lit = uSunColor * (0.18 + 0.82 * day) + vec3(0.05, 0.05, 0.06);
          vec3 col;
          if (vInf.w < 0.5) col = mix(vec3(0.2, 0.11, 0.07), vec3(0.5, 0.33, 0.22), vInf.z) * lit;
          else if (vInf.w < 1.5) col = mix(vec3(0.55, 0.62, 0.68), vec3(0.95, 0.97, 1.0), smoothstep(0.2, -0.6, p.y)) * lit, a *= 0.75;
          else col = mix(vec3(0.42, 0.3, 0.21), vec3(0.62, 0.47, 0.35), vInf.z) * lit, a *= 0.55;
          gl_FragColor = vec4(col, a);
        }`,
    });
    this.mesh = new THREE.InstancedMesh(g, this.mat, CAP);
    this.mesh.count = 0; this.mesh.frustumCulled = false; this.mesh.renderOrder = 2;
    game.engine.scene.add(this.mesh);
    // simulation state (struct of arrays)
    this.p = new Float32Array(CAP * 3); this.v = new Float32Array(CAP * 3);
    this.inf = new Float32Array(CAP * 4); this.life = new Float32Array(CAP); this.max = new Float32Array(CAP);
    this.gy = new Float32Array(CAP); this.rest = new Float32Array(CAP);
    this.n = 0;
  }

  // throw one grain; groundY is where it lands
  add(x, y, z, vx, vy, vz, size, life, kind, groundY, tone = Math.random()) {
    if (this.n >= CAP) return;
    const i = this.n++;
    this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z;
    this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz;
    this.inf[i * 4] = size; this.inf[i * 4 + 1] = 1; this.inf[i * 4 + 2] = tone; this.inf[i * 4 + 3] = kind;
    this.life[i] = 0; this.max[i] = life; this.gy[i] = groundY; this.rest[i] = 0;
  }

  // a spray from a point: n grains thrown around direction (dx, dz) with
  // horizontal speed hs, upward speed up, spread (radians), sizes in metres
  spray(x, y, z, n, { dx = 0, dz = 0, hs = 1, up = 1.5, spread = 1.2, size = [0.006, 0.02], kind = 0, life = 2.5, ground = null } = {}) {
    const T = this.game.terrain;
    const gy = ground ?? T.height(x, z);
    const base = Math.atan2(dz, dx), hasDir = dx !== 0 || dz !== 0;
    for (let k = 0; k < n; k++) {
      const a = hasDir ? base + (Math.random() - 0.5) * spread * 2 : Math.random() * 6.283;
      const s = hs * (0.4 + Math.random() * 0.9);
      const sz = size[0] + Math.pow(Math.random(), 2.2) * (size[1] - size[0]);
      this.add(x + (Math.random() - 0.5) * 0.1, y, z + (Math.random() - 0.5) * 0.1, Math.cos(a) * s, up * (0.45 + Math.random() * 0.8), Math.sin(a) * s, sz, life * (0.6 + Math.random() * 0.6), kind, gy);
    }
  }

  update(dt, cam, w, h) {
    if (w && h) this.uRes.value.set(w, h);
    const G = WORLD.GRAVITY, thick = U.uGrass.value > 0.1 || this.game.buildings.isOpen() ? 1 : 0;
    const wind = this.game.dust && this.game.dust.wind, ws = (2 + U.uWind.value * 7);
    const P = this.p, V = this.v, I = this.inf;
    let j = 0;
    for (let i = 0; i < this.n; i++) {
      this.life[i] += dt;
      if (this.life[i] > this.max[i]) continue;
      const kind = I[i * 4 + 3];
      let x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2], vx = V[i * 3], vy = V[i * 3 + 1], vz = V[i * 3 + 2];
      if (this.rest[i] === 0) {
        // drag: grains barely feel the thin air, motes and droplets more
        const drag = kind === 2 ? 2.5 + thick * 2 : kind === 1 ? 0.6 : 0.15 + thick * 0.6;
        const dk = Math.max(0, 1 - drag * dt);
        vx *= dk; vz *= dk; vy *= kind === 2 ? dk : 1;
        vy -= G * dt * (kind === 2 ? 0.08 : 1);
        if (wind && kind === 2) { vx += wind.x * ws * 0.6 * dt; vz += wind.y * ws * 0.6 * dt; }
        x += vx * dt; y += vy * dt; z += vz * dt;
        if (y <= this.gy[i]) {
          y = this.gy[i] + 0.004;
          if (kind === 0 && vy < -2.0 && Math.random() < 0.35) { vy = -vy * 0.25; vx *= 0.4; vz *= 0.4; }
          else { this.rest[i] = 1; vx = vy = vz = 0; if (kind !== 0) this.max[i] = Math.min(this.max[i], this.life[i] + 0.15); else this.max[i] = Math.min(this.max[i], this.life[i] + 0.6 + Math.random() * 0.8); }
        }
      }
      // fade in the last part of life
      const left = this.max[i] - this.life[i];
      const alpha = Math.min(1, left / 0.35);
      // compact into slot j
      P[j * 3] = x; P[j * 3 + 1] = y; P[j * 3 + 2] = z;
      V[j * 3] = vx; V[j * 3 + 1] = vy; V[j * 3 + 2] = vz;
      I[j * 4] = I[i * 4]; I[j * 4 + 1] = alpha; I[j * 4 + 2] = I[i * 4 + 2]; I[j * 4 + 3] = kind;
      this.life[j] = this.life[i]; this.max[j] = this.max[i]; this.gy[j] = this.gy[i]; this.rest[j] = this.rest[i];
      j++;
    }
    this.n = j;
    this.iPos.array.set(P.subarray(0, j * 3)); this.iVel.array.set(V.subarray(0, j * 3)); this.iInf.array.set(I.subarray(0, j * 4));
    this.iPos.clearUpdateRanges(); this.iPos.addUpdateRange(0, j * 3); this.iPos.needsUpdate = true;
    this.iVel.clearUpdateRanges(); this.iVel.addUpdateRange(0, j * 3); this.iVel.needsUpdate = true;
    this.iInf.clearUpdateRanges(); this.iInf.addUpdateRange(0, j * 4); this.iInf.needsUpdate = true;
    this.mesh.count = j;
  }
}
