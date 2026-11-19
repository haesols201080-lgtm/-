// Small forest life that reacts to the player: butterflies, ground birds that flee and fly up into the canopy,
// a squirrel that scurries up its tree, fireflies in the cave and gnat swarms over the water.
import * as THREE from 'three';
import { mulberry32, clamp, damp, dampAngle } from './util.js';
import { START, POND, STREAM } from './layout.js';
import { furredMesh } from './fur.js';

const rnd = mulberry32(31);

function wingTexture(hue) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128; const g = c.getContext('2d');
  g.translate(64, 64);
  const grd = g.createRadialGradient(0, 0, 4, 0, 0, 60);
  grd.addColorStop(0, `hsl(${hue},85%,30%)`); grd.addColorStop(0.55, `hsl(${hue},90%,55%)`); grd.addColorStop(1, `hsl(${hue + 10},70%,20%)`);
  g.fillStyle = grd;
  g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(30, -60, 64, -40, 58, -6); g.bezierCurveTo(56, 10, 30, 20, 0, 4); g.fill();
  g.beginPath(); g.moveTo(0, 4); g.bezierCurveTo(30, 18, 44, 44, 22, 52); g.bezierCurveTo(8, 56, 2, 30, 0, 8); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.85)';
  for (const [x, y, r] of [[40, -22, 5], [48, -12, 3], [26, 34, 4]]) { g.beginPath(); g.arc(x, y, r, 0, 6.28); g.fill(); }
  g.strokeStyle = 'rgba(20,10,5,0.8)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(30, -60, 64, -40, 58, -6); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class Creatures {
  constructor(ctx, world, audio) {
    this.ctx = ctx; this.world = world; this.audio = audio; this.scene = ctx.scene;
    this.list = []; this.time = 0;
    const k = ctx.tier.creatures;
    this.buildButterflies(Math.round(9 * k));
    this.buildBirds(Math.round(6 * k));
    this.buildSquirrel();
    this.buildFireflies();
    this.buildGnats();
  }
  points() { return this.list.filter((c) => c.mesh.visible).map((c) => c.mesh.position); }

  buildButterflies(n) {
    for (let i = 0; i < n; i++) {
      const g = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ map: wingTexture([28, 48, 200, 8][i % 4]), alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.7 });
      const wg = new THREE.PlaneGeometry(0.05, 0.05); wg.translate(0.025, 0, 0);
      const L = new THREE.Mesh(wg, mat), R = new THREE.Mesh(wg, mat); R.scale.x = -1;
      const lh = new THREE.Group(), rh = new THREE.Group(); lh.add(L); rh.add(R); lh.rotation.x = rh.rotation.x = -Math.PI / 2;
      const wl = new THREE.Group(), wr = new THREE.Group(); wl.add(lh); wr.add(rh);
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.003, 0.02, 2, 6), new THREE.MeshStandardMaterial({ color: 0x1a120c })); body.rotation.x = Math.PI / 2;
      g.add(wl, wr, body);
      const home = new THREE.Vector3(START.x + (rnd() - 0.5) * 12, 0, START.z - 2 + (rnd() - 0.5) * 12);
      g.position.set(home.x, this.world.terrain.heightAt(home.x, home.z) + 0.4, home.z);
      g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      this.scene.add(g);
      this.list.push({ type: 'butterfly', mesh: g, wl, wr, home, vel: new THREE.Vector3(), t: rnd() * 10, target: home.clone() });
    }
  }

  buildBirds(n) {
    // European robins modelled in Blender: plumage as short shell feathers, real feather blades for the tail and
    // the wings (folded on the ground, spread in flight), beak, eyes and thin legs
    const model = this.ctx.assets.models.robin;
    if (!model) return;
    model.scene.updateMatrixWorld(true);
    const parts = {}; model.scene.traverse((o) => { if (o.isMesh) parts[o.name.replace(/_\d+$/, '')] = o; });
    const featherM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, side: THREE.DoubleSide, envMapIntensity: 0.6 });
    const beakM = new THREE.MeshPhysicalMaterial({ color: 0x1c1712, roughness: 0.35, clearcoat: 0.5 });
    const legM = new THREE.MeshStandardMaterial({ color: 0x5a4434, roughness: 0.55 });
    const eyeM = new THREE.MeshPhysicalMaterial({ color: 0x050404, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.03 });
    const shells = this.ctx.tier.post ? 10 : 7;
    const clone = (o, mat) => { const m = new THREE.Mesh(o.geometry, mat); m.position.copy(o.position); m.quaternion.copy(o.quaternion); m.castShadow = true; return m; };
    for (let i = 0; i < n; i++) {
      const g = new THREE.Group();
      const body = furredMesh(parts.bird_body, { shells, length: 0.0028, density: 1400, rootDark: 0.72, clump: 0.08 }); body.position.copy(parts.bird_body.position); g.add(body);
      // head pivots at the neck (pecking, looking around)
      const head = new THREE.Group(); head.position.copy(parts.bird_head.position); g.add(head);
      const hf = furredMesh(parts.bird_head, { shells, length: 0.0022, density: 1600, rootDark: 0.72, clump: 0.08 }); head.add(hf);
      for (const [k, mat] of [['bird_beak', beakM], ['bird_eyes', eyeM]]) {
        const m = clone(parts[k], mat); m.position.sub(parts.bird_head.position); head.add(m);
      }
      g.add(clone(parts.bird_legs, legM), clone(parts.bird_tail, featherM));
      const fold = clone(parts.bird_wingfold, featherM); g.add(fold);
      const wings = [];
      for (const k of ['bird_wing_L', 'bird_wing_R']) { const w = clone(parts[k], featherM); w.visible = false; g.add(w); wings.push(w); }
      const furs = [body.userData.fur, hf.userData.fur];
      const spots = [[START.x + 3, START.z - 2], [START.x - 4, START.z + 1], [-1, 6], [3, 3.5], [-6, -1], [10, -2]];
      const sp = spots[i % spots.length];
      const home = new THREE.Vector3(sp[0] + (rnd() - 0.5) * 2, 0, sp[1] + (rnd() - 0.5) * 2);
      home.y = this.world.terrain.heightAt(home.x, home.z);
      g.position.copy(home); g.scale.setScalar(0.92 + rnd() * 0.16);
      this.scene.add(g);
      this.list.push({ type: 'bird', mesh: g, head, wings, fold, furs, home, state: 'ground', t: rnd() * 5, hopT: 0, vel: new THREE.Vector3(), yaw: rnd() * 6 });
    }
  }

  buildSquirrel() {
    const tree = this.world.treeSpots.find((t) => t.hero && Math.hypot(t.x - 5.5, t.z - 16) < 1);
    if (!tree) return;
    // red squirrel modelled in Blender, with shell fur (long, bushy tail and ear tufts)
    const g = new THREE.Group();
    const model = this.ctx.assets.models.squirrel;
    let tail = { rotation: { x: 0 } }, furU = null;
    if (model) {
      model.scene.updateMatrixWorld(true);
      model.scene.traverse((o) => {
        if (!o.isMesh) return;
        if (o.name.includes('body')) {
          const shells = this.ctx.tier.post ? (this.ctx.tier.ao ? 24 : 18) : 12;
          const fm = furredMesh(o, { shells, length: 0.006, density: 1250 });
          fm.applyMatrix4(o.matrixWorld); g.add(fm); furU = fm.userData.fur;
        } else {
          const glossy = o.name.includes('eye');
          const m = new THREE.Mesh(o.geometry, new THREE.MeshPhysicalMaterial({ color: glossy ? 0x050404 : 0x1d1512, roughness: glossy ? 0.08 : 0.4,
            clearcoat: glossy ? 1 : 0.3, clearcoatRoughness: 0.05 }));
          m.applyMatrix4(o.matrixWorld); g.add(m);
        }
      });
      // whiskers
      const wp = [];
      for (const s of [-1, 1]) for (let k = 0; k < 4; k++) {
        const y = 0.099 + k * 0.0022, z = 0.112 - k * 0.0018;
        wp.push(s * 0.008, y, z, s * (0.04 + k * 0.004), y + (k - 1.5) * 0.007, z - 0.016);
      }
      const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3));
      g.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0x1a1410, transparent: true, opacity: 0.55 })));
    }
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    const r0 = 0.62 * tree.s;
    const a = 0.4;
    const pos = new THREE.Vector3(tree.x + Math.cos(a) * (r0 + 1.6), 0, tree.z + Math.sin(a) * (r0 + 1.6));
    pos.y = this.world.terrain.heightAt(pos.x, pos.z);
    g.position.copy(pos); this.scene.add(g);
    this.list.push({ type: 'squirrel', mesh: g, tree, r0, state: 'ground', t: 0, home: pos.clone(), tail, climbY: 0, ang: a, furU });
  }

  buildFireflies() {
    const n = 60, g = new THREE.BufferGeometry(), pos = new Float32Array(n * 3);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0xd8ff7a, size: 0.025, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    this.fireflies = new THREE.Points(g, mat); this.fireflies.frustumCulled = false; this.scene.add(this.fireflies);
    this.ffSeeds = Array.from({ length: n }, () => [rnd() * 6.28, rnd() * 6.28, rnd()]);
  }
  buildGnats() {
    const n = 90, g = new THREE.BufferGeometry(), pos = new Float32Array(n * 3);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0x2a2620, size: 0.006, transparent: true, opacity: 0.8, depthWrite: false });
    this.gnats = new THREE.Points(g, mat); this.gnats.frustumCulled = false; this.scene.add(this.gnats);
    this.gnatCenters = [new THREE.Vector3(POND.x - 3, 0, POND.z + 2), new THREE.Vector3(-4, 0, 3), new THREE.Vector3(5, 0, 2)];
    for (const c of this.gnatCenters) c.y = this.ctx.terrain.waterY + 0.5;
  }

  update(dt, time, player, caveCenter) {
    this.time = time;
    const pp = new THREE.Vector3(player.pos.x, player.pos.y + 0.2, player.pos.z);
    const T = this.world.terrain;
    for (const c of this.list) {
      c.t += dt;
      const m = c.mesh;
      const d = m.position.distanceTo(pp);
      if (c.type === 'butterfly') {
        if (m.position.distanceTo(c.target) < 0.2 || c.t > 4) { c.t = 0; c.target.set(c.home.x + (rnd() - 0.5) * 4, 0, c.home.z + (rnd() - 0.5) * 4); c.target.y = T.heightAt(c.target.x, c.target.z) + 0.15 + rnd() * 0.8; }
        const flee = d < 0.6 ? m.position.clone().sub(pp).normalize().multiplyScalar(1.2) : new THREE.Vector3();
        const want = c.target.clone().sub(m.position).normalize().multiplyScalar(0.55).add(flee);
        want.y += Math.sin(time * 7 + c.home.x) * 0.5;
        c.vel.lerp(want, Math.min(1, dt * 2.5));
        m.position.addScaledVector(c.vel, dt);
        const gy = T.heightAt(m.position.x, m.position.z) + 0.08; if (m.position.y < gy) m.position.y = gy;
        m.rotation.y = Math.atan2(c.vel.x, c.vel.z);
        const flap = Math.sin(time * 26 + c.home.z) * 1.1;
        c.wl.rotation.z = flap; c.wr.rotation.z = -flap;
      } else if (c.type === 'bird') {
        if (c.state === 'ground') {
          c.hopT -= dt;
          if (c.hopT <= 0) { c.hopT = 0.3 + rnd() * 1.2; c.yaw += (rnd() - 0.5) * 2; c.hop = 0.18; if (rnd() < 0.3) c.peck = 0.4; }
          if (c.hop > 0) {
            c.hop -= dt; const f = new THREE.Vector3(Math.sin(c.yaw), 0, Math.cos(c.yaw));
            m.position.addScaledVector(f, dt * 0.35);
            if (m.position.distanceTo(c.home) > 1.6) c.yaw = Math.atan2(c.home.x - m.position.x, c.home.z - m.position.z);
            const gy = T.heightAt(m.position.x, m.position.z);
            m.position.y = gy + Math.sin((0.18 - c.hop) / 0.18 * Math.PI) * 0.025;
          }
          if (c.peck > 0) { c.peck -= dt; c.head.rotation.x = Math.max(0, Math.sin(c.peck * 20)) * 0.9; } else c.head.rotation.x = 0;
          c.head.rotation.y = Math.sin(c.t * 1.7 + c.hopT * 3) * 0.35 * (c.hop > 0 ? 0 : 1);
          m.rotation.y = dampAngle(m.rotation.y, c.yaw, 12, dt);
          for (const w of c.wings) { w.rotation.z = 0; w.visible = false; }
          if (c.fold) c.fold.visible = true;
          if (d < 1.0 || (player.state === 'jump' && d < 1.8)) {
            c.state = 'fly'; c.t = 0; this.audio.play('flap', { pos: m.position });
            const tr = this.world.treeSpots[Math.floor(rnd() * this.world.treeSpots.length)];
            c.dest = new THREE.Vector3(tr.x + (rnd() - 0.5) * 3, tr.y + 7 + rnd() * 4, tr.z + (rnd() - 0.5) * 3);
          }
        } else if (c.state === 'fly') {
          const want = c.dest.clone().sub(m.position); const dist = want.length();
          c.vel.lerp(want.normalize().multiplyScalar(4), Math.min(1, dt * 3));
          m.position.addScaledVector(c.vel, dt);
          m.rotation.y = Math.atan2(c.vel.x, c.vel.z);
          const flap = Math.sin(time * 40) * 1.0; c.wings[0].rotation.z = flap; c.wings[1].rotation.z = -flap;
          for (const w of c.wings) w.visible = true;
          if (c.fold) c.fold.visible = false;
          if (dist < 0.5) { c.state = 'perched'; c.t = 0; }
        } else if (c.state === 'perched') {
          for (const w of c.wings) w.rotation.z = 0.1;
          if (c.t > 10 + rnd() * 8 && pp.distanceTo(c.home) > 3) { c.state = 'return'; }
          if (rnd() < dt * 0.15) this.audio.play('bird', { pos: m.position, verb: 0.5 });
        } else if (c.state === 'return') {
          const want = c.home.clone().sub(m.position); const dist = want.length();
          c.vel.lerp(want.normalize().multiplyScalar(3), Math.min(1, dt * 3)); m.position.addScaledVector(c.vel, dt);
          m.rotation.y = Math.atan2(c.vel.x, c.vel.z);
          const flap = Math.sin(time * 40) * 1.0; c.wings[0].rotation.z = flap; c.wings[1].rotation.z = -flap;
          for (const w of c.wings) w.visible = true;
          if (c.fold) c.fold.visible = false;
          if (dist < 0.1) { c.state = 'ground'; m.position.copy(c.home); }
        }
      } else if (c.type === 'squirrel') {
        const tr = c.tree;
        if (c.state === 'ground') {
          c.ang += Math.sin(c.t * 0.7) * dt * 0.3;
          const R = c.r0 + 1.4 + Math.sin(c.t * 0.5) * 0.4;
          const nx = tr.x + Math.cos(c.ang) * R, nz = tr.z + Math.sin(c.ang) * R;
          const moving = Math.sin(c.t * 1.3) > 0.3;
          if (moving) { m.position.x = damp(m.position.x, nx, 2, dt); m.position.z = damp(m.position.z, nz, 2, dt); }
          m.position.y = T.heightAt(m.position.x, m.position.z) + (moving ? Math.abs(Math.sin(c.t * 14)) * 0.02 : 0);
          m.rotation.set(0, c.ang + Math.PI, 0);
          c.tail.rotation.x = Math.sin(c.t * 3) * 0.1;
          if (c.furU) { c.furU.uTail.value = Math.sin(c.t * 2.2) * 0.12 + (moving ? Math.sin(c.t * 14) * 0.05 : 0); c.furU.uTime.value = c.t; }
          if (d < 1.4) { c.state = 'climb'; c.climbY = 0; this.audio.play('chitter', { pos: m.position }); }
        } else if (c.state === 'climb') {
          const R = c.r0 * 0.85 + 0.06;
          const x = tr.x + Math.cos(c.ang) * R, z = tr.z + Math.sin(c.ang) * R;
          m.position.x = damp(m.position.x, x, 8, dt); m.position.z = damp(m.position.z, z, 8, dt);
          c.climbY = Math.min(6, c.climbY + dt * 2.2);
          m.position.y = tr.y + 0.3 + c.climbY;
          m.rotation.set(-Math.PI / 2, c.ang + Math.PI, 0, 'YXZ');
          if (c.climbY >= 6) { c.state = 'hide'; c.t = 0; }
        } else if (c.state === 'hide') {
          if (c.t > 12 && d > 4) { c.state = 'ground'; m.position.copy(c.home); m.rotation.set(0, 0, 0); }
        }
      }
    }
    // fireflies around the cave + pond at dusk-like darkness
    if (this.fireflies) {
      const pos = this.fireflies.geometry.attributes.position;
      const center = caveCenter || new THREE.Vector3(POND.x, T.waterY, POND.z);
      this.ffSeeds.forEach(([a, b, s], i) => {
        const r = 0.6 + s * 1.6;
        pos.setXYZ(i, center.x + Math.cos(a + time * 0.3 * (0.5 + s)) * r, center.y + 0.3 + Math.sin(b + time * 0.7) * 0.25 + s * 0.6, center.z + Math.sin(a * 1.3 + time * 0.25) * r);
      });
      pos.needsUpdate = true;
      this.fireflies.material.opacity = 0.5 + 0.4 * Math.sin(time * 3);
    }
    if (this.gnats) {
      const pos = this.gnats.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const c = this.gnatCenters[i % 3], s = i * 1.37;
        pos.setXYZ(i, c.x + Math.sin(time * 2.1 + s) * 0.3 + Math.sin(time * 7.3 + s * 3) * 0.05, c.y + Math.sin(time * 1.7 + s * 2) * 0.2, c.z + Math.cos(time * 1.9 + s) * 0.3);
      }
      pos.needsUpdate = true;
    }
  }
}
