// Airborne dust, done the way it looks on a dry planet rather than as
// particles: a pale haze that hugs the ground, thick in the lows and
// thinning with height, patchy and drifting with the wind (in the composite
// pass, see engine.js); soft billowing clouds of dust that gusts lift and
// roll across the land; and dust devils, tapering whirling columns out on
// the plain. Clouds and devils are soft noise puffs that face the camera.
// Everything fades as rain wets the ground and grass binds the soil. The same
// puffs draw smoke columns and flames over buildings that are on fire.
import * as THREE from 'three';
import { U } from '../core/shared.js';

const LOGV = '#include <common>\n#include <logdepthbuf_pars_vertex>\n';
const LOGF = '#include <common>\n#include <logdepthbuf_pars_fragment>\n';
const CAP = 200;

export class Dust {
  constructor(game) {
    this.game = game;
    const scene = game.engine.scene;
    this.windA = 0.3;
    this.wind = new THREE.Vector2(Math.cos(this.windA), Math.sin(this.windA));
    this.offset = new THREE.Vector2();    // wind travel, pans the haze noise
    this.gusts = [];
    this.devils = [];
    this.gustT = 4;

    // soft puffs: camera-facing quads, flattened, with drifting noise inside
    const g = new THREE.PlaneGeometry(1, 1);
    this.iP = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 4), 4);   // centre xyz, size
    this.iA = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 4), 4);   // alpha, seed, squash, spin
    g.setAttribute('iP', this.iP); g.setAttribute('iA', this.iA);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uTime: U.uTime, tNoise: U.tNoise, uSun: U.uSunColor, uSunDir: U.uSunDir, uWind: { value: new THREE.Vector2() } },
      vertexShader: LOGV + /* glsl */`
        attribute vec4 iP, iA; varying vec2 vUv; varying vec4 vA; varying float vH;
        void main() {
          vec3 cr = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
          float c = cos(iA.w), s = sin(iA.w);
          vec2 q = vec2(c * position.x - s * position.y, s * position.x + c * position.y);
          vec3 w = iP.xyz + (cr * q.x + vec3(0.0, 1.0, 0.0) * q.y * abs(iA.z)) * iP.w;
          vUv = uv; vA = iA; vH = position.y + 0.5;
          gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: LOGF + /* glsl */`
        uniform float uTime; uniform sampler2D tNoise; uniform vec3 uSun, uSunDir; uniform vec2 uWind;
        varying vec2 vUv; varying vec4 vA; varying float vH;
        void main() {
          #include <logdepthbuf_fragment>
          vec2 p = vUv - 0.5;
          float r = length(p * vec2(1.0, 1.15));
          vec2 drift = uWind * uTime * 0.012;
          float n = texture2D(tNoise, vUv * 0.55 + vA.y * 7.3 - drift).r * 0.6 + texture2D(tNoise, vUv * 1.3 + vA.y * 3.1 - drift * 2.3).g * 0.4;
          float a = smoothstep(0.5, 0.05, r) * smoothstep(0.3, 0.75, n + 0.25 - r * 0.6);
          // lit from the sun side, darker and denser at the base
          float day = smoothstep(-0.1, 0.3, uSunDir.y);
          vec3 col = vec3(0.64, 0.48, 0.34) * (0.12 + day * (0.62 + 0.45 * uSun)) * (0.85 + 0.25 * vH);
          // smoke (negative squash): sooty grey, underlit orange by the flames
          if (vA.z < 0.0) col = vec3(0.13, 0.125, 0.12) * (0.3 + 0.7 * day) + vec3(0.35, 0.12, 0.03) * (1.0 - vH) * 0.35;
          // flame (negative alpha): hot core, deeper orange at the tips
          if (vA.x < 0.0) col = mix(vec3(3.2, 1.3, 0.3), vec3(2.0, 0.42, 0.06), vH);
          gl_FragColor = vec4(col, a * abs(vA.x));
        }`,
      transparent: true, depthWrite: false,
    });
    this.mesh = new THREE.InstancedMesh(g, this.mat, CAP);
    this.mesh.count = 0; this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  // how dusty the air is: dry, bare, windy ground lifts the most
  level() {
    const dust = this.game.sky.uniforms.uDust.value, wind = U.uWind.value, wet = U.uWet.value, grass = U.uGrass.value;
    const storm = this.game.terra.weather.storm || 0;
    const dry = (1 - wet) * (1 - storm) * (1 - grass * 0.9);
    return {
      haze: Math.min(1, 0.1 + dust * 1.4) * (1 - wet * 0.7) * (1 - grass * 0.6),
      gusts: Math.min(1, dust * 2.4) * (0.5 + wind) * dry,
      devils: dust > 0.08 && dry > 0.6 ? Math.min(1, dust * 3) : 0,
    };
  }

  update(dt, cam) {
    const g = this.game, T = g.terrain, t = U.uTime.value;
    this.windA += dt * 0.004 * Math.sin(t * 0.01);
    this.wind.set(Math.cos(this.windA), Math.sin(this.windA));
    const L = this.level(), ws = 2 + U.uWind.value * 7;
    this.offset.addScaledVector(this.wind, ws * dt);
    this.mat.uniforms.uWind.value.copy(this.wind).multiplyScalar(ws);
    // ground haze in the composite pass
    const cu = g.engine.compUniforms;
    if (cu.uDustGround) {
      cu.uDustGround.value = L.haze;
      cu.uWindO.value.copy(this.offset);
      cu.uGround.value = T.height(cam.x, cam.z);
    }

    // gusts: now and then a front of dust rolls across from upwind
    this.gustT -= dt;
    if (this.gustT <= 0) {
      this.gustT = 6 + Math.random() * 14 / Math.max(0.2, L.gusts);
      if (L.gusts > 0.05) {
        const n = 6 + Math.floor(Math.random() * 8 * L.gusts);
        const a = Math.random() * 6.283, r = 25 + Math.random() * 70;
        const cx = cam.x + Math.cos(a) * r - this.wind.x * 50, cz = cam.z + Math.sin(a) * r - this.wind.y * 50;
        for (let i = 0; i < n; i++) {
          const along = (Math.random() - 0.5) * 40, across = (Math.random() - 0.5) * 10;
          this.gusts.push({ x: cx - this.wind.y * along + this.wind.x * across, z: cz + this.wind.x * along + this.wind.y * across, s: 7 + Math.random() * 14, life: -Math.random() * 2, max: 9 + Math.random() * 8, seed: Math.random(), sp: ws * (0.8 + Math.random() * 0.5), spin: Math.random() * 6.28 });
        }
      }
    }
    // dust devils out on the plain
    if (this.devils.length < 2 && L.devils > 0 && Math.random() < dt * (this.forceDevils ? 50 : 0.04)) {
      const a = Math.random() * 6.283, r = 150 + Math.random() * 300;
      this.devils.push({ x: cam.x + Math.cos(a) * r, z: cam.z + Math.sin(a) * r, life: 0, max: 30 + Math.random() * 40, h: 30 + Math.random() * 50, dir: this.windA + (Math.random() - 0.5) * 0.8, seed: Math.random() });
    }

    let n = 0;
    const P = this.iP.array, A = this.iA.array;
    const put = (x, y, z, size, alpha, seed, squash, spin) => {
      if (n >= CAP || Math.abs(alpha) < 0.003) return;
      P[n * 4] = x; P[n * 4 + 1] = y; P[n * 4 + 2] = z; P[n * 4 + 3] = size;
      A[n * 4] = alpha; A[n * 4 + 1] = seed; A[n * 4 + 2] = squash; A[n * 4 + 3] = spin;
      n++;
    };
    for (let i = this.gusts.length - 1; i >= 0; i--) {
      const G = this.gusts[i];
      G.life += dt;
      if (G.life > G.max) { this.gusts.splice(i, 1); continue; }
      if (G.life < 0) continue;
      G.x += this.wind.x * G.sp * dt; G.z += this.wind.y * G.sp * dt;
      const k = G.life / G.max, grow = 0.6 + k * 0.8;
      const y = T.height(G.x, G.z);
      if (y < U.uWaterLevel.value) continue;
      const fade = Math.min(1, G.life / 2.5, (G.max - G.life) / 3.5);
      put(G.x, y + G.s * grow * 0.3, G.z, G.s * grow, fade * 0.42 * L.gusts, G.seed, 0.5, G.spin + G.life * 0.05);
    }
    for (let i = this.devils.length - 1; i >= 0; i--) {
      const D = this.devils[i];
      D.life += dt;
      if (D.life > D.max || L.devils <= 0) { this.devils.splice(i, 1); continue; }
      D.x += Math.cos(D.dir) * ws * 0.5 * dt; D.z += Math.sin(D.dir) * ws * 0.5 * dt;
      D.dir += (Math.random() - 0.5) * dt * 0.5;
      const gy = T.height(D.x, D.z), fade = Math.min(1, D.life / 5, (D.max - D.life) / 6) * L.devils;
      // a tapering column of puffs, twisting, leaning a little downwind
      const N = 16;
      for (let k = 0; k < N; k++) {
        const u = k / (N - 1), h = Math.pow(u, 1.25) * D.h;
        const rad = 1.2 + h * 0.16, ang = t * 2.4 - h * 0.09 + k * 2.3;
        const lean = h * 0.12;
        put(D.x + Math.cos(ang) * rad * 0.35 + this.wind.x * lean, gy + h + 1.5, D.z + Math.sin(ang) * rad * 0.35 + this.wind.y * lean, 3 + rad * 1.7, fade * (0.34 - u * 0.24), D.seed + k * 0.13, 0.75, ang * 0.3);
      }
      // the skirt of dust it raises at the ground
      put(D.x, gy + 1.8, D.z, 9, fade * 0.35, D.seed + 0.5, 0.35, t * 0.5);
    }
    // buildings on fire: flames along the roof and a column of smoke leaning downwind
    const F = g.colony && g.colony.fires;
    if (F) for (const b of F) {
      const top = b.y + (b.model ? b.model.height : 6), k = Math.min(1, b.fire / 6);
      for (let i = 0; i < 5; i++) {
        const a = t * 2.6 + i * 1.7 + b.id;
        put(b.x + Math.cos(a) * b.hw * 0.45, top - 0.6 + (i % 2) * 0.7, b.z + Math.sin(a) * b.hd * 0.45, 2.0 + Math.sin(t * 7 + i) * 0.6, -0.6 * k, b.id * 0.1 + i * 0.3, 1.3, t * 2 + i);
      }
      for (let i = 0; i < 16; i++) {
        const u = (t * 0.22 + i / 16) % 1, h = u * 28;
        put(b.x + this.wind.x * h * 0.55 + Math.sin(i * 2.3 + t) * 0.9, top + 1 + h, b.z + this.wind.y * h * 0.55 + Math.cos(i * 1.7 + t) * 0.9, 3 + u * 10, (1 - u) * 0.6 * k, b.id * 0.07 + i * 0.13, -0.9, i + t * 0.2);
      }
    }
    this.mesh.count = n;
    this.iP.needsUpdate = true; this.iA.needsUpdate = true;
  }
}
