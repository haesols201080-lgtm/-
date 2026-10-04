// 생물: 하늘고래(하늘을 도는 거대한 떠다니는 생물), 긴다리(들판을 건너는 무리), 빛나방(밤의 빛 무리).
import * as THREE from 'three';
import { litMaterial, glowMaterial } from './materials.js';
import { part, merge, xf, lathe } from './geo-utils.js';
import { heightAt } from './heightfield.js';
import { audio } from '../core/audio.js';
import { bus } from '../core/events.js';
import { mulberry32 } from '../core/noise.js';

function whaleGeo() {
  // 길이 1 (+Z 가 머리)
  const prof = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const r = 0.13 * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.8)), 0.9) * (1 - 0.35 * t) + 0.004;
    prof.push([r, t - 0.6]);
  }
  const body = lathe(prof, 18);
  body.rotateX(-Math.PI / 2); // y→-z: 머리가 −Z 쪽이 되도록 아래서 뒤집음
  body.rotateY(Math.PI);
  body.scale(1, 0.75, 1);
  const parts = [part(body, (x, y, z) => (y < -0.02 ? 0xd8c8ff : 0x7a86c0), (x, y, z) => (y < -0.04 && Math.sin(z * 120) > 0.6 ? 1.4 : 0))];
  // 등의 빛 줄
  for (let i = 0; i < 9; i++) {
    const z = -0.3 + i * 0.07;
    parts.push(part(xf(new THREE.SphereGeometry(0.008, 5, 4), { x: 0, y: 0.08 - Math.abs(z) * 0.08, z }), 0x9ff6ff, 2));
  }
  return merge(parts);
}

function finGeo() {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.1, 0.05, 0.3, 0.06, 0.42, -0.02);
  s.bezierCurveTo(0.3, -0.06, 0.12, -0.1, 0, -0.08);
  const g = new THREE.ShapeGeometry(s, 8);
  g.rotateX(-Math.PI / 2);
  return g;
}

export class Creatures {
  constructor(world, game) {
    this.world = world;
    this.game = game;
    this.scene = world.scene;
    this._initWhales();
    this._initStriders();
    this._initMoths();
    bus.on('calm', (e) => this._onCalm(e.pos));
    bus.on('tone', (e) => { if (e.n === 3) this.mothLure = 30; });
  }

  // ── 하늘고래 ─────────────────────────────
  _initWhales() {
    const bodyMat = litMaterial({ vertexColors: true, vertexEmit: true, emissive: 0xffffff, emissiveIntensity: 1.2, emissiveNight: 1, rim: 1.0, rimColor: 0xc8d8ff, spec: 0.4 });
    const finMat = litMaterial({ color: 0xb8c8ff, emissive: 0x6080ff, emissiveIntensity: 0.4, emissiveNight: 1, rim: 1.2, rimColor: 0xd8f0ff, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
    const bg = whaleGeo(), fg = finGeo();
    const defs = [
      { cx: 0, cz: 5000, R: 6500, y: 520, len: 190, sp: 11, ph: 0 },
      { cx: -6000, cz: -2000, R: 5200, y: 760, len: 240, sp: 9, ph: 2 },
      { cx: 7000, cz: 3000, R: 5800, y: 620, len: 160, sp: 12, ph: 4 },
      { cx: 4000, cz: -9000, R: 4500, y: 900, len: 210, sp: 10, ph: 1 },
    ];
    this.whales = defs.map((d, i) => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(bg, bodyMat);
      g.add(body);
      const fins = [];
      for (const s of [-1, 1]) {
        const f = new THREE.Mesh(fg, finMat);
        f.position.set(s * 0.09, -0.02, -0.12);
        f.scale.set(s, 1, 1);
        g.add(f);
        fins.push(f);
      }
      const tail = new THREE.Mesh(fg, finMat);
      tail.position.set(0, 0, 0.38);
      tail.rotation.set(0, Math.PI / 2, Math.PI / 2);
      tail.scale.set(0.6, 1, 0.6);
      g.add(tail);
      g.scale.setScalar(d.len);
      this.scene.add(g);
      return { ...d, g, fins, tail, a: d.ph, x: 0, y: d.y, z: 0, calm: 0, callT: 5 + i * 7, i, heading: 0 };
    });
  }

  nearestWhale(p) {
    let best = null, bd = Infinity;
    for (const w of this.whales) {
      const d = (w.x - p.x) ** 2 + (w.z - p.z) ** 2;
      if (d < bd) { bd = d; best = w; }
    }
    return best;
  }

  _onCalm(pos) {
    for (const w of this.whales) {
      const d = Math.hypot(w.x - pos.x, w.y - pos.y, w.z - pos.z);
      if (d < 1400) {
        w.calm = 45;
        w.calmTarget = pos.clone();
        this.game.ui.moa('고래가… 노래를 들었어요. 이쪽으로 와요.');
        audio.tone(4, { gain: 0.3, pos: w, octave: -2, dur: 5, wet: 0.9, maxDist: 3000 });
      }
    }
  }

  _updateWhales(dt, t) {
    const pp = this.game.player.pos;
    for (const w of this.whales) {
      let tx, ty, tz;
      if (w.calm > 0) {
        w.calm -= dt;
        const c = w.calmTarget;
        const a = t * 0.05 + w.i;
        tx = c.x + Math.cos(a) * 90; tz = c.z + Math.sin(a) * 90;
        ty = Math.max(heightAt(tx, tz) + 60, c.y + 45);
      } else {
        w.a += (w.sp / w.R) * dt;
        tx = w.cx + Math.cos(w.a) * w.R;
        tz = w.cz + Math.sin(w.a * 1.0) * w.R * 0.7;
        ty = w.y + Math.sin(w.a * 3) * 60;
        const gh = heightAt(tx, tz, 0);
        ty = Math.max(ty, gh + 220);
      }
      if (!w.init) { w.x = tx; w.y = ty; w.z = tz; w.init = true; }
      const dx = tx - w.x, dy = ty - w.y, dz = tz - w.z;
      const d = Math.hypot(dx, dy, dz);
      const sp = Math.min(w.calm > 0 ? 18 : w.sp, d);
      if (d > 0.1) {
        w.x += (dx / d) * sp * dt; w.y += (dy / d) * sp * dt * 0.6; w.z += (dz / d) * sp * dt;
        const target = Math.atan2(dx, dz);
        let dh = Math.atan2(Math.sin(target - w.heading), Math.cos(target - w.heading));
        w.heading += dh * Math.min(1, dt * 0.3);
      }
      w.g.position.set(w.x, w.y, w.z);
      w.g.rotation.set(Math.sin(t * 0.3 + w.i) * 0.05, w.heading + Math.PI, Math.sin(t * 0.2 + w.i) * 0.06);
      const flap = Math.sin(t * 0.8 + w.i) * 0.35;
      w.fins[0].rotation.z = flap; w.fins[1].rotation.z = -flap;
      w.tail.rotation.x = Math.sin(t * 0.8 + w.i + 1) * 0.3;
      // 노래
      w.callT -= dt;
      if (w.callT <= 0) {
        w.callT = 18 + Math.random() * 20;
        const dist = Math.hypot(w.x - pp.x, w.y - pp.y, w.z - pp.z);
        if (dist < 3500) this._whaleCall(w);
      }
      // 관찰 (도감)
      if (!this.game.state.codex.skywhale && Math.hypot(w.x - pp.x, w.y - pp.y, w.z - pp.z) < 140 + w.len * 0.5) this.game.scan('skywhale');
    }
  }

  _whaleCall(w) {
    if (!audio.ready) return;
    const base = 70 + Math.random() * 40;
    for (let k = 0; k < 3; k++) {
      audio.tone({ hz: base * (1 + k * 0.5) }, { delay: k * 0.9, gain: 0.5, pos: w, dur: 5.5, soft: true, wet: 0.95, maxDist: 4000, bus: 'ambience' });
    }
  }

  // ── 긴다리 ──────────────────────────────
  _initStriders() {
    const mat = litMaterial({ color: 0xd8c8b0, rim: 0.8, rimColor: 0xffe8c8, emissive: 0xffc46a, emissiveIntensity: 0.15, emissiveNight: 1 });
    const legMat = litMaterial({ color: 0x5a4a5a, rim: 0.4 });
    const bodyG = new THREE.SphereGeometry(1, 14, 10);
    bodyG.scale(2.2, 1.6, 3.6);
    const legG = new THREE.CylinderGeometry(0.18, 0.12, 1, 6);
    legG.translate(0, -0.5, 0);
    const neckG = new THREE.CylinderGeometry(0.35, 0.6, 7, 8);
    neckG.translate(0, 3.5, 0);
    const headG = new THREE.SphereGeometry(1, 10, 8);
    headG.scale(0.7, 0.6, 1.4);
    const herds = [
      { x: 2200, z: 7600, n: 5 }, { x: -2600, z: 9600, n: 4 }, { x: 6400, z: -5200, n: 4 }, { x: -5000, z: 5200, n: 3 },
    ];
    this.striders = [];
    const rnd = mulberry32(77);
    for (const h of herds) {
      for (let i = 0; i < h.n; i++) {
        const g = new THREE.Group();
        const body = new THREE.Mesh(bodyG, mat);
        g.add(body);
        const neck = new THREE.Mesh(neckG, mat);
        neck.position.set(0, 0.6, 2.6);
        neck.rotation.x = 0.7;
        g.add(neck);
        const head = new THREE.Mesh(headG, mat);
        head.position.set(0, 6.4, 7.2);
        g.add(head);
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.25, 6, 4), glowMaterial({ color: 0xffd27a, intensity: 2 }));
        eye.position.set(0, 6.5, 8.1);
        g.add(eye);
        const legs = [];
        for (let k = 0; k < 4; k++) {
          const hip = new THREE.Group();
          hip.position.set(k % 2 ? 1.6 : -1.6, -0.6, k < 2 ? 2 : -2);
          const up = new THREE.Mesh(legG, legMat);
          up.scale.set(1, 9, 1);
          hip.add(up);
          const knee = new THREE.Group();
          knee.position.y = -9;
          hip.add(knee);
          const lo = new THREE.Mesh(legG, legMat);
          lo.scale.set(1, 9, 1);
          knee.add(lo);
          g.add(hip);
          legs.push({ hip, knee, ph: k * Math.PI * 0.5 + (k % 2) * Math.PI });
        }
        this.scene.add(g);
        const sc = 0.8 + rnd() * 0.4;
        g.scale.setScalar(sc);
        this.striders.push({ g, legs, herd: h, x: h.x + (rnd() - 0.5) * 80, z: h.z + (rnd() - 0.5) * 80, heading: rnd() * 6, ph: rnd() * 6, sc, speed: 2.4 });
      }
    }
    this.herdT = 0;
  }

  _updateStriders(dt, t) {
    const pp = this.game.player.pos;
    this.herdT -= dt;
    if (this.herdT <= 0) {
      this.herdT = 30;
      for (const s of this.striders) {
        const h = s.herd;
        if (!h.tx || Math.random() < 0.5) { h.tx = h.x + (Math.random() - 0.5) * 2400; h.tz = h.z + (Math.random() - 0.5) * 2400; }
      }
    }
    for (const s of this.striders) {
      const near = (s.x - pp.x) ** 2 + (s.z - pp.z) ** 2 < 2500 * 2500;
      s.g.visible = near;
      const h = s.herd;
      const tx = (h.tx ?? h.x) + Math.sin(s.ph) * 40, tz = (h.tz ?? h.z) + Math.cos(s.ph) * 40;
      const dx = tx - s.x, dz = tz - s.z;
      const d = Math.hypot(dx, dz);
      const moving = d > 6;
      if (moving) {
        const target = Math.atan2(dx, dz);
        let dh = Math.atan2(Math.sin(target - s.heading), Math.cos(target - s.heading));
        s.heading += dh * Math.min(1, dt * 0.4);
        s.x += Math.sin(s.heading) * s.speed * dt;
        s.z += Math.cos(s.heading) * s.speed * dt;
        // 물로는 들어가지 않음
        if (heightAt(s.x, s.z, 1) < 2) { s.heading += Math.PI; h.tx = h.x; h.tz = h.z; }
      }
      if (!near) continue;
      const gy = heightAt(s.x, s.z, 1);
      s.walk = (s.walk || 0) + (moving ? dt * 1.6 : 0);
      s.g.position.set(s.x, gy + 16.5 * s.sc + Math.sin(s.walk * 2) * 0.3, s.z);
      s.g.rotation.y = s.heading;
      for (const L of s.legs) {
        const p = s.walk + L.ph;
        L.hip.rotation.x = Math.sin(p) * 0.35;
        L.knee.rotation.x = -0.25 + Math.max(0, Math.cos(p)) * 0.5;
      }
      if (!this.game.state.codex.strider && Math.hypot(s.x - pp.x, s.z - pp.z) < 70) this.game.scan('strider');
    }
  }

  // ── 빛나방 ──────────────────────────────
  _initMoths() {
    const n = 140;
    const g = new THREE.BufferGeometry();
    this.mothPos = new Float32Array(n * 3);
    this.mothVel = new Float32Array(n * 3);
    g.setAttribute('position', new THREE.BufferAttribute(this.mothPos, 3));
    this.moths = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffe4a8, size: 0.35, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.moths.frustumCulled = false;
    this.scene.add(this.moths);
    this.mothN = n;
    this.mothLure = 0;
    this.mothInit = false;
  }

  _updateMoths(dt, t) {
    const night = this.world.atmos.state.night;
    const vis = night > 0.4 || this.mothLure > 0;
    this.moths.visible = vis;
    this.moths.material.opacity = Math.min(1, night * 1.4 + (this.mothLure > 0 ? 0.6 : 0));
    if (!vis) return;
    const pp = this.game.player.pos;
    const P = this.mothPos, Vv = this.mothVel;
    this.mothLure = Math.max(0, this.mothLure - dt);
    const lure = this.mothLure > 0;
    for (let i = 0; i < this.mothN; i++) {
      const o = i * 3;
      if (!this.mothInit || Math.hypot(P[o] - pp.x, P[o + 2] - pp.z) > 80) {
        const a = Math.random() * 6.28, r = 10 + Math.random() * 60;
        P[o] = pp.x + Math.cos(a) * r; P[o + 2] = pp.z + Math.sin(a) * r;
        P[o + 1] = heightAt(P[o], P[o + 2]) + 1 + Math.random() * 5;
      }
      // 무작위 떨림 + 유인
      Vv[o] += (Math.random() - 0.5) * 6 * dt; Vv[o + 1] += (Math.random() - 0.5) * 4 * dt; Vv[o + 2] += (Math.random() - 0.5) * 6 * dt;
      if (lure) {
        const tx = pp.x + Math.sin(t + i) * 3, ty = pp.y + 2 + Math.cos(t * 1.3 + i) * 1.5, tz = pp.z + Math.cos(t + i * 0.7) * 3;
        Vv[o] += (tx - P[o]) * dt * 0.8; Vv[o + 1] += (ty - P[o + 1]) * dt * 0.8; Vv[o + 2] += (tz - P[o + 2]) * dt * 0.8;
      }
      for (let k = 0; k < 3; k++) { Vv[o + k] *= 1 - dt * 1.2; P[o + k] += Vv[o + k] * dt; }
    }
    this.mothInit = true;
    this.moths.geometry.attributes.position.needsUpdate = true;
    if (lure && night > 0.4 && !this.game.state.codex.moth) this.game.scan('moth');
  }

  update(dt, ctx) {
    const t = this.world.elapsed;
    this._updateWhales(dt, t);
    this._updateStriders(dt, t);
    this._updateMoths(dt, t);
  }
}
