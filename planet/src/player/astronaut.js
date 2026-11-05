// Procedural astronaut: jointed hierarchy (hips, torso, head, arms, legs)
// built from smooth primitives, with a procedural walk/run/jump/jetpack/swim
// animation. Faces -Z in local space.
import * as THREE from 'three';
import { GeoBuilder } from '../core/geobuilder.js';

const WHITE = [0.86, 0.86, 0.83];
const GREY = [0.22, 0.23, 0.25];
const DARK = [0.09, 0.09, 0.1];
const ORANGE = [0.95, 0.42, 0.1];

function capsule(r, len, seg = 12) { return new THREE.CapsuleGeometry(r, len, 6, seg); }
function rbox(w, h, d, r = 0.04) {
  // rounded box from a subdivided box pushed toward a superellipsoid
  const g = new THREE.BoxGeometry(w, h, d, 4, 4, 4);
  const p = g.attributes.position; const v = new THREE.Vector3();
  const hw = w / 2 - r, hh = h / 2 - r, hd = d / 2 - r;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const c = new THREE.Vector3(Math.max(-hw, Math.min(hw, v.x)), Math.max(-hh, Math.min(hh, v.y)), Math.max(-hd, Math.min(hd, v.z)));
    const dlt = v.clone().sub(c);
    if (dlt.lengthSq() > 1e-8) v.copy(c.add(dlt.normalize().multiplyScalar(r)));
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

export class Astronaut {
  constructor() {
    this.root = new THREE.Group();
    this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.05 });
    this.visorMat = new THREE.MeshStandardMaterial({ color: 0x3a2a10, roughness: 0.06, metalness: 0.95, envMapIntensity: 1.6 });
    this.glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 3.2, 3.6) });
    this.flameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 2.2, 0.8), transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending });
    this.build();
    this.phase = 0;
    this.blend = { run: 0, air: 0, swim: 0, jet: 0 };
    this.root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.flames.forEach((f) => { f.castShadow = false; });
  }

  part(builderFn, parent, mat = this.mat) {
    const gb = new GeoBuilder();
    builderFn(gb);
    const m = new THREE.Mesh(gb.build(), mat);
    parent.add(m);
    return m;
  }

  joint(parent, x, y, z) { const j = new THREE.Group(); j.position.set(x, y, z); parent.add(j); return j; }

  build() {
    const R = this.root;
    this.hips = this.joint(R, 0, 0.98, 0);
    // pelvis + belt
    this.part((g) => {
      g.add(rbox(0.36, 0.2, 0.25, 0.08), { color: WHITE, pos: new THREE.Vector3(0, -0.04, 0) });
      g.add(rbox(0.38, 0.06, 0.27, 0.025), { color: GREY, pos: new THREE.Vector3(0, 0.05, 0) });
      g.add(rbox(0.1, 0.07, 0.04, 0.015), { color: ORANGE, pos: new THREE.Vector3(0, 0.05, -0.14) });
      g.add(rbox(0.07, 0.1, 0.05, 0.015), { color: GREY, pos: new THREE.Vector3(0.17, -0.02, -0.04) });
      g.add(rbox(0.07, 0.1, 0.05, 0.015), { color: GREY, pos: new THREE.Vector3(-0.17, -0.02, -0.04) });
    }, this.hips);

    this.torso = this.joint(this.hips, 0, 0.08, 0);
    this.part((g) => {
      g.add(rbox(0.44, 0.5, 0.3, 0.12), { color: WHITE, pos: new THREE.Vector3(0, 0.27, 0) });
      g.add(rbox(0.3, 0.2, 0.06, 0.03), { color: GREY, pos: new THREE.Vector3(0, 0.33, -0.14) });           // chest unit
      g.add(rbox(0.08, 0.05, 0.02, 0.01), { color: ORANGE, pos: new THREE.Vector3(-0.07, 0.38, -0.175) });
      g.add(rbox(0.06, 0.03, 0.02, 0.01), { color: [0.2, 0.7, 0.9], pos: new THREE.Vector3(0.07, 0.38, -0.175) });
      g.add(rbox(0.46, 0.05, 0.32, 0.02), { color: ORANGE, pos: new THREE.Vector3(0, 0.08, 0) });            // waist stripe
      // shoulder pads
      g.add(new THREE.SphereGeometry(0.11, 14, 10), { color: WHITE, pos: new THREE.Vector3(0.24, 0.45, 0), scale: new THREE.Vector3(1, 0.75, 1) });
      g.add(new THREE.SphereGeometry(0.11, 14, 10), { color: WHITE, pos: new THREE.Vector3(-0.24, 0.45, 0), scale: new THREE.Vector3(1, 0.75, 1) });
      // neck ring
      g.add(new THREE.TorusGeometry(0.13, 0.03, 8, 20), { color: GREY, pos: new THREE.Vector3(0, 0.53, 0), rot: new THREE.Euler(Math.PI / 2, 0, 0) });
      // backpack
      g.add(rbox(0.4, 0.52, 0.2, 0.05), { color: [0.78, 0.78, 0.75], pos: new THREE.Vector3(0, 0.3, 0.24) });
      g.add(rbox(0.42, 0.06, 0.22, 0.02), { color: ORANGE, pos: new THREE.Vector3(0, 0.5, 0.24) });
      g.add(new THREE.CylinderGeometry(0.065, 0.065, 0.44, 14), { color: GREY, pos: new THREE.Vector3(0.12, 0.3, 0.36) });
      g.add(new THREE.CylinderGeometry(0.065, 0.065, 0.44, 14), { color: GREY, pos: new THREE.Vector3(-0.12, 0.3, 0.36) });
      g.add(new THREE.CylinderGeometry(0.05, 0.07, 0.1, 12), { color: DARK, pos: new THREE.Vector3(0.12, 0.03, 0.3) });
      g.add(new THREE.CylinderGeometry(0.05, 0.07, 0.1, 12), { color: DARK, pos: new THREE.Vector3(-0.12, 0.03, 0.3) });
      // hose
      g.add(new THREE.TorusGeometry(0.12, 0.018, 6, 14, Math.PI), { color: DARK, pos: new THREE.Vector3(0.17, 0.42, 0.06), rot: new THREE.Euler(0, Math.PI / 2, -0.3) });
    }, this.torso);
    // chest + backpack lights
    this.part((g) => {
      g.add(new THREE.BoxGeometry(0.03, 0.12, 0.01), { pos: new THREE.Vector3(0.19, 0.3, 0.345) });
      g.add(new THREE.BoxGeometry(0.03, 0.12, 0.01), { pos: new THREE.Vector3(-0.19, 0.3, 0.345) });
      g.add(new THREE.BoxGeometry(0.04, 0.015, 0.01), { pos: new THREE.Vector3(0.0, 0.3, -0.172) });
    }, this.torso, this.glowMat);
    // jet flames
    this.flames = [0.12, -0.12].map((x) => {
      const g = new THREE.ConeGeometry(0.06, 0.5, 10, 1, true);
      g.rotateX(Math.PI);
      g.translate(0, -0.25, 0);
      const m = new THREE.Mesh(g, this.flameMat);
      m.position.set(x, -0.02, 0.3);
      this.torso.add(m);
      m.visible = false;
      return m;
    });

    this.head = this.joint(this.torso, 0, 0.56, 0);
    this.part((g) => {
      g.add(new THREE.SphereGeometry(0.2, 24, 18), { color: WHITE, pos: new THREE.Vector3(0, 0.16, 0.01) });
      g.add(new THREE.TorusGeometry(0.205, 0.022, 8, 28), { color: GREY, pos: new THREE.Vector3(0, 0.16, -0.02), rot: new THREE.Euler(0.15, 0, 0) });
      g.add(rbox(0.05, 0.05, 0.1, 0.015), { color: GREY, pos: new THREE.Vector3(0.2, 0.2, 0.0) });       // helmet lamp housing
      g.add(new THREE.CylinderGeometry(0.008, 0.008, 0.14, 6), { color: DARK, pos: new THREE.Vector3(-0.17, 0.33, 0.06), rot: new THREE.Euler(0.2, 0, 0.3) });
    }, this.head);
    // visor (front cap of a sphere)
    const vis = new THREE.SphereGeometry(0.192, 24, 16, Math.PI * 0.18, Math.PI * 0.64, Math.PI * 0.22, Math.PI * 0.42);
    vis.rotateY(Math.PI);
    const visor = new THREE.Mesh(vis, this.visorMat);
    visor.position.set(0, 0.16, -0.022);
    this.head.add(visor);
    this.part((g) => g.add(new THREE.CircleGeometry(0.018, 10), { pos: new THREE.Vector3(0.2, 0.2, -0.051), rot: new THREE.Euler(0, Math.PI, 0) }), this.head, this.glowMat);

    const arm = (side) => {
      const sh = this.joint(this.torso, side * 0.27, 0.43, 0);
      this.part((g) => {
        g.add(capsule(0.075, 0.2), { color: WHITE, pos: new THREE.Vector3(0, -0.15, 0) });
        g.add(new THREE.TorusGeometry(0.075, 0.018, 6, 14), { color: ORANGE, pos: new THREE.Vector3(0, -0.12, 0), rot: new THREE.Euler(Math.PI / 2, 0, 0) });
      }, sh);
      const el = this.joint(sh, 0, -0.31, 0);
      this.part((g) => {
        g.add(new THREE.SphereGeometry(0.072, 10, 8), { color: GREY });
        g.add(capsule(0.066, 0.18), { color: WHITE, pos: new THREE.Vector3(0, -0.14, 0) });
        g.add(new THREE.CylinderGeometry(0.075, 0.07, 0.06, 12), { color: GREY, pos: new THREE.Vector3(0, -0.25, 0) });
        g.add(rbox(0.09, 0.11, 0.11, 0.035), { color: DARK, pos: new THREE.Vector3(0, -0.33, -0.01) });
        if (side < 0) g.add(rbox(0.05, 0.08, 0.06, 0.015), { color: [0.2, 0.55, 0.75], pos: new THREE.Vector3(-0.07, -0.16, -0.01) });
      }, el);
      return { sh, el };
    };
    this.armR = arm(1);
    this.armL = arm(-1);

    const leg = (side) => {
      const hip = this.joint(this.hips, side * 0.11, -0.08, 0);
      this.part((g) => {
        g.add(capsule(0.095, 0.28), { color: WHITE, pos: new THREE.Vector3(0, -0.2, 0) });
        g.add(rbox(0.08, 0.12, 0.05, 0.02), { color: GREY, pos: new THREE.Vector3(side * 0.09, -0.22, 0) });
      }, hip);
      const knee = this.joint(hip, 0, -0.43, 0);
      this.part((g) => {
        g.add(rbox(0.13, 0.12, 0.08, 0.04), { color: ORANGE, pos: new THREE.Vector3(0, 0.0, -0.06) });
        g.add(capsule(0.085, 0.26), { color: WHITE, pos: new THREE.Vector3(0, -0.2, 0) });
        g.add(new THREE.CylinderGeometry(0.1, 0.095, 0.08, 12), { color: GREY, pos: new THREE.Vector3(0, -0.36, 0) });
      }, knee);
      const ankle = this.joint(knee, 0, -0.42, 0);
      this.part((g) => {
        g.add(rbox(0.15, 0.13, 0.27, 0.05), { color: [0.3, 0.3, 0.32], pos: new THREE.Vector3(0, -0.02, -0.04) });
        g.add(rbox(0.16, 0.04, 0.29, 0.015), { color: DARK, pos: new THREE.Vector3(0, -0.085, -0.045) });
        g.add(rbox(0.155, 0.03, 0.08, 0.01), { color: ORANGE, pos: new THREE.Vector3(0, 0.03, -0.14) });
      }, ankle);
      return { hip, knee, ankle };
    };
    this.legR = leg(1);
    this.legL = leg(-1);
  }

  // speed: horizontal m/s; state flags
  update(dt, { speed = 0, onGround = true, jet = false, swim = false, vy = 0, aim = 0, working = false }) {
    const B = this.blend;
    const k = Math.min(1, dt * 8);
    B.run += ((onGround ? Math.min(1, speed / 7) : 0) - B.run) * k;
    B.air += ((onGround || swim ? 0 : 1) - B.air) * k;
    B.swim += ((swim ? 1 : 0) - B.swim) * k;
    B.jet += ((jet ? 1 : 0) - B.jet) * Math.min(1, dt * 12);
    const stride = onGround ? speed : swim ? 2.5 : 0;
    this.phase += dt * (stride > 0.1 ? 2.2 + stride * 1.25 : 0);
    const p = this.phase;
    const walk = onGround ? Math.min(1, speed / 2) : 0;
    const s = Math.sin(p), c = Math.cos(p);
    const amp = 0.35 + B.run * 0.35;

    // legs
    const legSwing = s * amp * walk;
    this.legR.hip.rotation.x = legSwing - B.air * 0.5 + B.swim * Math.sin(p * 1.5) * 0.4;
    this.legL.hip.rotation.x = -legSwing - B.air * 0.2 - B.swim * Math.sin(p * 1.5) * 0.4;
    this.legR.knee.rotation.x = Math.max(0, -c) * (0.4 + B.run * 0.8) * walk + B.air * 0.9 + B.swim * 0.3;
    this.legL.knee.rotation.x = Math.max(0, c) * (0.4 + B.run * 0.8) * walk + B.air * 0.4 + B.swim * 0.3;
    this.legR.ankle.rotation.x = -this.legR.hip.rotation.x * 0.3;
    this.legL.ankle.rotation.x = -this.legL.hip.rotation.x * 0.3;
    // arms
    const armSwing = s * (0.3 + B.run * 0.5) * walk;
    this.armR.sh.rotation.x = -armSwing + B.air * -0.4 - B.swim * Math.sin(p * 1.5 + 1) * 1.2 - aim * 1.2;
    this.armL.sh.rotation.x = armSwing + B.air * -0.4 + B.swim * Math.sin(p * 1.5 + 1) * 1.2;
    this.armR.sh.rotation.z = 0.12 + B.air * 0.35;
    this.armL.sh.rotation.z = -0.12 - B.air * 0.35;
    this.armR.el.rotation.x = -0.25 - B.run * 0.9 - aim * 0.2 - (working ? 0.4 : 0);
    this.armL.el.rotation.x = -0.25 - B.run * 0.9;
    // body
    const bob = Math.abs(Math.sin(p)) * 0.04 * walk * (1 + B.run);
    this.hips.position.y = 0.98 - 0.03 * walk + bob - B.air * 0.05;
    this.torso.rotation.x = -B.run * 0.18 - B.swim * 0.9 + B.air * 0.08;
    this.torso.rotation.y = s * 0.08 * walk;
    this.hips.rotation.y = -s * 0.06 * walk;
    this.head.rotation.x = B.run * 0.12 + B.swim * 0.6 + aim * -0.3;
    // breathing idle
    const idle = (1 - walk) * (1 - B.air);
    this.torso.position.y = 0.08 + Math.sin(performance.now() * 0.002) * 0.006 * idle;

    for (const f of this.flames) {
      f.visible = B.jet > 0.05;
      f.scale.set(0.8 + Math.random() * 0.4, (0.6 + Math.random() * 0.5) * B.jet, 0.8 + Math.random() * 0.4);
    }
  }
}
