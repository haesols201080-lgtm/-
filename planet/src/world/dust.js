// Airborne dust on a dry planet: motes drifting in the light around the
// camera, sand streaming low over the ground in the wind (saltation), and
// dust devils wandering across the plains in the distance. All of it fades
// as rain wets the ground and grass binds the soil.
import * as THREE from 'three';
import { U } from '../core/shared.js';

const LOGV = '#include <common>\n#include <logdepthbuf_pars_vertex>\n';
const LOGF = '#include <common>\n#include <logdepthbuf_pars_fragment>\n';
const DUST_C = new THREE.Color(0.78, 0.6, 0.45);

export class Dust {
  constructor(game) {
    this.game = game;
    const scene = game.engine.scene;
    this.wind = new THREE.Vector2(1, 0.3).normalize();
    this.windA = 0.3;
    this.U = { uTime: U.uTime, uCam: { value: new THREE.Vector3() }, uAmt: { value: 0 }, uWindV: { value: new THREE.Vector2() }, uSun: U.uSunColor, uDustC: { value: DUST_C } };

    // ---- motes: a box of specks that wraps around the camera
    const N = 1800, mp = new Float32Array(N * 3), ms = new Float32Array(N);
    for (let i = 0; i < N; i++) { mp.set([(Math.random() - 0.5) * 60, Math.random() * 22, (Math.random() - 0.5) * 60], i * 3); ms[i] = Math.random(); }
    const mg = new THREE.BufferGeometry();
    mg.setAttribute('position', new THREE.Float32BufferAttribute(mp, 3));
    mg.setAttribute('aSeed', new THREE.Float32BufferAttribute(ms, 1));
    this.motes = new THREE.Points(mg, new THREE.ShaderMaterial({
      uniforms: this.U,
      vertexShader: LOGV + /* glsl */`
        uniform float uTime, uAmt; uniform vec3 uCam; uniform vec2 uWindV;
        attribute float aSeed; varying float vA; varying float vPuff;
        void main() {
          vec3 p = position;
          p.xz += uWindV * uTime * (0.6 + aSeed);
          p.x += sin(uTime * 0.7 + aSeed * 40.0) * 0.6; p.z += cos(uTime * 0.6 + aSeed * 31.0) * 0.6;
          p.y += sin(uTime * 0.4 + aSeed * 17.0) * 0.8;
          vec3 w = vec3(mod(p.x - uCam.x + 30.0, 60.0) - 30.0 + uCam.x, uCam.y - 6.0 + mod(p.y - uCam.y + 6.0, 22.0), mod(p.z - uCam.z + 30.0, 60.0) - 30.0 + uCam.z);
          vec4 mv = viewMatrix * vec4(w, 1.0);
          float d = length(w - uCam);
          // most are specks of grit a pixel or two across; a few are faint,
          // large puffs of haze drifting further out
          float puff = step(0.82, aSeed);
          vPuff = puff;
          vA = uAmt * smoothstep(30.0, 14.0, d) * mix(smoothstep(0.6, 2.0, d) * (0.45 + 0.55 * fract(aSeed * 7.3)), smoothstep(8.0, 16.0, d) * 0.12, puff);
          gl_PointSize = mix(clamp((0.9 + 1.6 * fract(aSeed * 13.1)) * 6.0 / max(1.0, -mv.z) + 0.9, 0.9, 2.8), (6.0 + 10.0 * fract(aSeed * 5.7)) * 120.0 / max(1.0, -mv.z), puff);
          gl_Position = projectionMatrix * mv;
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: LOGF + /* glsl */`
        uniform vec3 uSun, uDustC; varying float vA; varying float vPuff;
        void main() {
          #include <logdepthbuf_fragment>
          float r = length(gl_PointCoord - 0.5);
          float a = mix(smoothstep(0.5, 0.2, r), smoothstep(0.5, 0.0, r), vPuff);
          gl_FragColor = vec4(uDustC * (0.35 + 0.9 * uSun), a * vA * mix(0.8, 1.0, vPuff));
        }`,
      transparent: true, depthWrite: false,
    }));
    this.motes.frustumCulled = false;
    scene.add(this.motes);

    // ---- saltation: thin sheets of sand skimming the ground downwind
    const S = this.SN = 520;
    const sg = new THREE.PlaneGeometry(1, 1, 4, 1);
    sg.translate(0.5, 0.5, 0);
    this.sA = new THREE.InstancedBufferAttribute(new Float32Array(S), 1);
    sg.setAttribute('iA', this.sA);
    this.sheets = new THREE.InstancedMesh(sg, new THREE.ShaderMaterial({
      uniforms: this.U,
      vertexShader: LOGV + /* glsl */`
        attribute float iA; varying float vA; varying vec2 vUv;
        void main() {
          vUv = uv; vA = iA;
          gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: LOGF + /* glsl */`
        uniform vec3 uSun, uDustC; uniform float uTime; varying float vA; varying vec2 vUv;
        void main() {
          #include <logdepthbuf_fragment>
          float streak = 0.6 + 0.4 * sin(vUv.x * 18.0 - uTime * 9.0 + vA * 50.0);
          float a = smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.55, vUv.x) * smoothstep(1.0, 0.0, vUv.y) * streak * vA;
          gl_FragColor = vec4(uDustC * (0.4 + 0.8 * uSun), a * 0.22);
        }`,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
    }), S);
    this.sheets.frustumCulled = false;
    this.sheets.count = 0;
    scene.add(this.sheets);
    this.grains = Array.from({ length: S }, () => ({ x: 0, z: 0, y: 0, life: 0, max: 1, len: 1, h: 0.3, sp: 8 }));

    // ---- dust devils: helices of grit around a wandering centre
    this.devils = [];
    for (let k = 0; k < 3; k++) {
      const DN = 420, dp = new Float32Array(DN * 3);
      for (let i = 0; i < DN; i++) dp.set([Math.random(), Math.random(), Math.random()], i * 3);
      const dg = new THREE.BufferGeometry();
      dg.setAttribute('position', new THREE.Float32BufferAttribute(dp, 3));
      const du = { uTime: U.uTime, uC: { value: new THREE.Vector3() }, uH: { value: 40 }, uK: { value: 0 }, uSun: U.uSunColor, uDustC: { value: DUST_C } };
      const pts = new THREE.Points(dg, new THREE.ShaderMaterial({
        uniforms: du,
        vertexShader: LOGV + /* glsl */`
          uniform float uTime, uH, uK; uniform vec3 uC; varying float vA;
          void main() {
            float h = pow(position.y, 1.4) * uH;
            float r = 0.6 + h * 0.18 + position.z * (1.0 + h * 0.06);
            float a = position.x * 6.2832 + uTime * (3.2 - h * 0.03) + h * 0.12;
            vec3 w = uC + vec3(cos(a) * r + sin(h * 0.15 + uTime * 0.4) * h * 0.08, h, sin(a) * r);
            vec4 mv = viewMatrix * vec4(w, 1.0);
            vA = uK * (1.0 - position.y) * smoothstep(0.0, 0.05, position.y);
            gl_PointSize = (2.0 + 5.0 * position.y + 3.0 * position.z) * 260.0 / max(1.0, -mv.z);
            gl_Position = projectionMatrix * mv;
            #include <logdepthbuf_vertex>
          }`,
        fragmentShader: LOGF + /* glsl */`
          uniform vec3 uSun, uDustC; varying float vA;
          void main() {
            #include <logdepthbuf_fragment>
            float r = length(gl_PointCoord - 0.5);
            gl_FragColor = vec4(uDustC * (0.4 + 0.8 * uSun), smoothstep(0.5, 0.0, r) * vA * 0.22);
          }`,
        transparent: true, depthWrite: false,
      }));
      pts.frustumCulled = false; pts.visible = false;
      scene.add(pts);
      this.devils.push({ pts, u: du, x: 0, z: 0, life: 0, max: 1, dir: 0, h: 40 });
    }
  }

  // how dusty the air is right now: dry, bare, windy ground kicks up the most
  level() {
    const sky = this.game.sky.uniforms;
    const dust = sky.uDust.value, wind = U.uWind.value, wet = U.uWet.value, grass = U.uGrass.value;
    const storm = this.game.terra.weather.storm || 0;
    return { motes: Math.min(1, 0.12 + dust * 1.6) * (1 - wet * 0.75) * (1 - storm * 0.8), salt: Math.min(1, dust * 2.2) * (0.4 + wind) * (1 - grass) * (1 - wet) * (1 - storm), devils: dust > 0.08 && wet < 0.2 && storm < 0.1 && grass < 0.3 ? Math.min(1, dust * 3) : 0 };
  }

  update(dt, cam) {
    const g = this.game, T = g.terrain;
    // wind veers slowly
    this.windA += dt * 0.004 * Math.sin(U.uTime.value * 0.01);
    this.wind.set(Math.cos(this.windA), Math.sin(this.windA));
    const L = this.level(), ws = 1.5 + U.uWind.value * 6;
    this.U.uCam.value.copy(cam);
    this.U.uAmt.value = L.motes;
    this.U.uWindV.value.copy(this.wind).multiplyScalar(ws * 0.35);
    this.motes.visible = L.motes > 0.02;

    // saltation sheets
    const want = Math.round(this.SN * L.salt);
    const m4 = this._m || (this._m = new THREE.Matrix4()), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
    const yaw = Math.atan2(-this.wind.y, this.wind.x);
    let n = 0;
    for (let i = 0; i < want; i++) {
      const G = this.grains[i];
      G.life += dt;
      if (G.life > G.max) {
        // respawn somewhere around the camera, mostly upwind
        const a = Math.random() * 6.283, r = 4 + Math.random() * 38;
        G.x = cam.x + Math.cos(a) * r - this.wind.x * 12; G.z = cam.z + Math.sin(a) * r - this.wind.y * 12;
        G.life = 0; G.max = 1.2 + Math.random() * 2.2; G.len = 1.5 + Math.random() * 3.5; G.h = 0.12 + Math.random() * 0.45; G.sp = ws * (0.8 + Math.random() * 0.6);
      }
      G.x += this.wind.x * G.sp * dt; G.z += this.wind.y * G.sp * dt;
      const gy = T.height(G.x, G.z);
      if (gy < U.uWaterLevel.value + 0.2) { G.life = G.max; continue; }
      const k = Math.sin(Math.PI * G.life / G.max);
      m4.compose(p.set(G.x, gy + 0.02, G.z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), s.set(G.len, G.h, 1));
      this.sheets.setMatrixAt(n, m4);
      this.sA.array[n] = k;
      n++;
    }
    this.sheets.count = n;
    this.sheets.instanceMatrix.needsUpdate = true;
    this.sA.needsUpdate = true;

    // dust devils out on the plain
    for (const D of this.devils) {
      D.life += dt;
      if (D.pts.visible && D.life > D.max) D.pts.visible = false;
      if (!D.pts.visible) {
        if (!(L.devils > 0 && Math.random() < dt * (this.forceDevils ? 50 : 0.05))) { D.u.uK.value = 0; continue; }
        const a = Math.random() * 6.283, r = 140 + Math.random() * 320;
        D.x = cam.x + Math.cos(a) * r; D.z = cam.z + Math.sin(a) * r;
        D.life = 0; D.max = 25 + Math.random() * 35; D.dir = this.windA + (Math.random() - 0.5) * 0.8; D.h = 25 + Math.random() * 45;
        D.pts.visible = true;
      }
      D.x += Math.cos(D.dir) * ws * 0.6 * dt; D.z += Math.sin(D.dir) * ws * 0.6 * dt;
      D.dir += (Math.random() - 0.5) * dt * 0.6;
      const gy = T.height(D.x, D.z);
      D.u.uC.value.set(D.x, gy, D.z);
      D.u.uH.value = D.h;
      const fade = Math.min(1, D.life / 4, (D.max - D.life) / 5);
      D.u.uK.value = Math.max(0, fade) * L.devils;
    }
  }
}
