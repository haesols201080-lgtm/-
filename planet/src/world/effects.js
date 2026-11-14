// Small effects that make the place feel physical:
// - vents on working buildings breathe vapour or exhaust that drifts downwind
// - boots and tyres press prints into the regolith; they fade with time, wind
//   and rain, and hardly show once grass covers the ground
// - the rover throws a dust trail on dry ground; a jetpack landing kicks up
//   a ring of dust
// - while the air is unbreathable, an airlock opening vents a puff of
//   condensation and dust
// - hoar frost forms on structures through a cold night and sublimates
//   after sunrise (U.uRime, read by the building materials)
import * as THREE from 'three';
import { U } from '../core/shared.js';

const CAP = 1600;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _n = new THREE.Vector3();
const _x = new THREE.Vector3(), _z = new THREE.Vector3(), _bm = new THREE.Matrix4();

export class Effects {
  constructor(game) {
    this.game = game;
    // prints: flat quads on the ground, one instanced mesh
    const g = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.iT = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 2), 2);   // birth time, kind (0 boot L, 1 boot R, 2 tyre)
    g.setAttribute('iT', this.iT);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uTime: U.uTime, uFade: { value: 1 } },
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      vertexShader: '#include <common>\n#include <logdepthbuf_pars_vertex>\n' + /* glsl */`
        attribute vec2 iT; varying vec2 vUv; varying vec2 vT;
        void main() {
          vUv = uv; vT = iT;
          gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: '#include <common>\n#include <logdepthbuf_pars_fragment>\n' + /* glsl */`
        uniform float uTime, uFade; varying vec2 vUv; varying vec2 vT;
        void main() {
          #include <logdepthbuf_fragment>
          float age = uTime - vT.x;
          float a;
          if (vT.y < 1.5) {
            // boot sole: forefoot and heel, lug pattern across
            vec2 p = vUv - 0.5; if (vT.y > 0.5) p.x = -p.x;
            float fore = 1.0 - smoothstep(0.42, 0.5, length((p - vec2(0.02, 0.14)) * vec2(1.45, 1.0)));
            float heel = 1.0 - smoothstep(0.36, 0.44, length((p - vec2(-0.01, -0.3)) * vec2(1.6, 1.25)));
            float lug = 0.55 + 0.45 * step(0.45, fract(vUv.y * 7.0 + abs(p.x) * 2.0));
            a = max(fore, heel) * lug * 0.5;
          } else {
            // tyre: chevron tread inside soft edges
            float edge = smoothstep(0.0, 0.14, vUv.x) * smoothstep(1.0, 0.86, vUv.x);
            float tread = step(0.42, fract(vUv.y * 2.6 + abs(vUv.x - 0.5) * 1.4));
            a = edge * (0.55 + 0.45 * tread) * 0.42;
          }
          a *= (1.0 - smoothstep(150.0, 420.0, age)) * uFade;
          if (a < 0.004) discard;
          gl_FragColor = vec4(0.14, 0.09, 0.06, a);
        }`,
    });
    this.mesh = new THREE.InstancedMesh(g, this.mat, CAP);
    this.mesh.count = 0; this.mesh.frustumCulled = false; this.mesh.renderOrder = 1;
    for (let i = 0; i < CAP; i++) this.mesh.setMatrixAt(i, _m.makeScale(0, 0, 0));
    game.engine.scene.add(this.mesh);
    this.next = 0;
    this.stepAcc = 0; this.foot = 0;
    this.tyreAcc = 0; this.dustT = 0;
    this.prevGround = true; this.prevVy = 0;
    this.ventAcc = new Map();
  }

  // a print on the terrain at (x, z), heading yaw (direction of travel), size w x l
  print(x, z, yaw, w, l, kind) {
    const T = this.game.terrain;
    const h = T.height(x, z);
    if (U.uIce.value < 0.5 && h < U.uWaterLevel.value + 0.05) return;
    // align to the ground
    const e = 0.4;
    _n.set(T.height(x - e, z) - T.height(x + e, z), 2 * e, T.height(x, z - e) - T.height(x, z + e)).normalize();
    _z.set(Math.sin(yaw), 0, Math.cos(yaw));
    _x.crossVectors(_n, _z).normalize();
    _z.crossVectors(_x, _n).normalize();
    _bm.makeBasis(_x, _n, _z);
    _q.setFromRotationMatrix(_bm);
    _m.compose(_p.set(x, h + 0.025, z), _q, _s.set(w, 1, l));
    const i = this.next; this.next = (this.next + 1) % CAP;
    this.mesh.setMatrixAt(i, _m);
    this.iT.array[i * 2] = U.uTime.value; this.iT.array[i * 2 + 1] = kind;
    this.mesh.count = Math.max(this.mesh.count, i + 1);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.iT.needsUpdate = true;
  }

  update(dt, cam) {
    const g = this.game, T = g.terrain, P = g.player, R = g.rover, D = g.dust;
    const dry = (1 - U.uWet.value) * (1 - U.uGrass.value * 0.85);
    this.mat.uniforms.uFade.value = Math.max(0.12, 1 - U.uGrass.value * 0.8);

    // ---- frost on structures: forms through the cold night, burns off after sunrise
    const cold = U.uFrost.value * (g.buildings.isOpen() ? 0.3 : 1);
    const tgt = U.uNight.value > 0.55 ? cold : 0;
    U.uRime.value += (tgt - U.uRime.value) * Math.min(1, dt * (tgt > U.uRime.value ? 0.012 : 0.03));

    // ---- light shafts thicken with dust in the air
    const mats = g.buildings.mats;
    if (mats && mats.beam && D) mats.beam.uniforms.uHaze.value = 0.35 + Math.min(1, D.level().haze) * 0.9;

    if (!g.started) return;

    // ---- footprints
    if (!g.driving() && P.onGround && !P.swimming) {
      const sp = Math.hypot(P.vel.x, P.vel.z);
      const onGround = P.pos.y - T.height(P.pos.x, P.pos.z) < 0.15;
      if (sp > 0.4 && onGround) {
        this.stepAcc += sp * dt;
        if (this.stepAcc > 0.72) {
          this.stepAcc = 0;
          const yaw = Math.atan2(P.vel.x, P.vel.z), side = this.foot ? 1 : -1;
          const ox = Math.cos(yaw) * 0.13 * side, oz = -Math.sin(yaw) * 0.13 * side;
          this.print(P.pos.x + ox, P.pos.z + oz, yaw, 0.13, 0.31, this.foot);
          this.foot ^= 1;
          if (D && dry > 0.5 && sp > 3.5 && Math.random() < 0.35) D.puff(P.pos.x, P.pos.y + 0.1, P.pos.z, { s: 0.4, grow: 1.6, max: 1.4, a: 0.22 * dry, vy: 0.3, kind: 'dust', drift: 0.5 });
        }
      }
    }
    // ---- jetpack landing dust
    if (P.onGround && !this.prevGround && this.prevVy < -3.5 && D && dry > 0.3) {
      for (let i = 0; i < 10; i++) {
        const a = i / 10 * 6.283 + Math.random() * 0.3;
        D.puff(P.pos.x + Math.cos(a) * 0.5, P.pos.y + 0.15, P.pos.z + Math.sin(a) * 0.5, { vx: Math.cos(a) * 3, vz: Math.sin(a) * 3, vy: 0.2, s: 0.7, grow: 2.2, max: 2.2, a: 0.32 * dry, kind: 'dust', drift: 0.4 });
      }
    }
    if (P.jetting && D && dry > 0.3 && P.pos.y - T.height(P.pos.x, P.pos.z) < 3.5 && Math.random() < dt * 8) {
      D.puff(P.pos.x + (Math.random() - 0.5), T.height(P.pos.x, P.pos.z) + 0.2, P.pos.z + (Math.random() - 0.5), { vx: (Math.random() - 0.5) * 4, vz: (Math.random() - 0.5) * 4, s: 0.6, grow: 2, max: 1.6, a: 0.25 * dry, kind: 'dust' });
    }
    this.prevGround = P.onGround; this.prevVy = P.vel.y;

    // ---- rover: tyre tracks and a dust trail
    if (R.present && Math.abs(R.speed) > 0.3) {
      const c = Math.cos(R.yaw), s = Math.sin(R.yaw);
      const at = (lx, lz) => [R.pos.x + lx * c + lz * s, R.pos.z - lx * s + lz * c];
      this.tyreAcc += Math.abs(R.speed) * dt;
      if (this.tyreAcc > 0.5) {
        this.tyreAcc = 0;
        for (const lx of [-1.48, 1.48]) { const [x, z] = at(lx, 1.9); this.print(x, z, R.yaw, 0.42, 0.56, 2); }
      }
      this.dustT -= dt;
      if (D && dry > 0.3 && Math.abs(R.speed) > 2.5 && this.dustT <= 0) {
        this.dustT = 0.1;
        const k = Math.min(1, Math.abs(R.speed) / 12) * dry;
        for (const lx of [-1.5, 1.5]) {
          const [x, z] = at(lx, 2.3);
          D.puff(x, R.pos.y + 0.4, z, { vx: s * R.speed * 0.15, vz: c * R.speed * 0.15, vy: 0.5, s: 0.9, grow: 3.0, max: 2.8 + k, a: 0.32 * k, kind: 'dust', drift: 0.7 });
        }
      }
    }

    // ---- vents on working buildings near the camera
    if (D) {
      const sealed = !g.buildings.isOpen();
      const vis = (sealed ? 0.85 : 0.5) * (0.75 + 0.25 * U.uNight.value);
      for (const b of g.buildings.list) {
        const V = b.model.vents;
        if (!V || !V.length || b.lit < 0.5 || (b.active !== undefined && b.active < 0.1)) continue;
        const dx = b.x - cam.x, dz = b.z - cam.z;
        if (dx * dx + dz * dz > 170 * 170) continue;
        let acc = this.ventAcc.get(b.id);
        if (!acc) this.ventAcc.set(b.id, acc = V.map(() => Math.random()));
        for (let i = 0; i < V.length; i++) {
          const v = V[i];
          acc[i] += dt * 1.8 * v.rate;
          if (acc[i] < 1) continue;
          acc[i] -= 1;
          if (acc[i] > 1) acc[i] = 0;
          const [wx, wz] = g.buildings.toWorld(b, v.x, v.z);
          if (v.kind === 'heat') {
            D.puff(wx + (Math.random() - 0.5) * 0.6, b.y + v.y, wz + (Math.random() - 0.5) * 0.6, { vy: 1.4, s: 0.6 * v.size, grow: 2.5, max: 2.2, a: 0.08, kind: 'steam', drift: 0.5 });
          } else {
            D.puff(wx, b.y + v.y, wz, { vy: 1.6 + Math.random() * 0.8, vx: (Math.random() - 0.5) * 0.3, vz: (Math.random() - 0.5) * 0.3, s: 0.55 * v.size, grow: 3.2, max: 3.2 + v.size, a: (v.kind === 'exhaust' ? 0.26 : 0.34) * vis, kind: v.kind === 'exhaust' ? 'exhaust' : 'steam', drift: 0.75 });
          }
        }
      }
    }

    // ---- airlocks venting while the air outside is unbreathable
    if (D && !g.buildings.isOpen()) {
      for (const b of g.buildings.list) {
        if (!b.model.doors.length) continue;
        const prev = b._doorPrev || 0;
        if (prev < 0.02 && b.door >= 0.02) {
          for (const d of b.model.doors) {
            const [wx, wz] = g.buildings.toWorld(b, d.x, d.z);
            for (let i = 0; i < 5; i++) D.puff(wx + (Math.random() - 0.5) * 0.8, b.y + 0.6 + Math.random() * 1.4, wz + (Math.random() - 0.5) * 0.8, { vx: (Math.random() - 0.5) * 1.5, vy: 0.6, vz: (Math.random() - 0.5) * 1.5, s: 0.5, grow: 2.6, max: 2.0, a: 0.35, kind: 'steam', drift: 0.5 });
            for (let i = 0; i < 3; i++) D.puff(wx + (Math.random() - 0.5), b.y + 0.15, wz + (Math.random() - 0.5), { vx: (Math.random() - 0.5) * 2.5, vz: (Math.random() - 0.5) * 2.5, s: 0.5, grow: 2, max: 1.6, a: 0.25 * dry, kind: 'dust' });
          }
        }
        b._doorPrev = b.door;
      }
    }
  }
}
