// Light-ring time trials. A glowing start pad by the trail starts a run: 3-2-1 countdown, then a chain of rings to
// pass through in order against the clock (the next ring burns bright and is the objective marker; passed rings
// burst and fade). Medals by time, best times saved. A course can require an ability (the booster's double jump).
import * as THREE from 'three';
import { PATH, PATH2 } from './layout.js';

function along(poly, s) {
  let acc = 0;
  for (let i = 0; i + 1 < poly.length; i++) {
    const [x0, z0] = poly[i], [x1, z1] = poly[i + 1], L = Math.hypot(x1 - x0, z1 - z0);
    if (acc + L >= s) { const f = (s - acc) / L; return { x: x0 + (x1 - x0) * f, z: z0 + (z1 - z0) * f, tx: (x1 - x0) / L, tz: (z1 - z0) / L }; }
    acc += L;
  }
  const n = poly.length - 1, [x0, z0] = poly[n - 1], [x1, z1] = poly[n], L = Math.hypot(x1 - x0, z1 - z0);
  return { x: x1, z: z1, tx: (x1 - x0) / L, tz: (z1 - z0) / L };
}

export const COURSES = [
  { id: 'trail', name: '숲길 질주', poly: PATH.slice(PATH.ctrl[1]), s0: 1.6, step: 2.05, heights: [0.26, 0.28, 0.5, 0.28, 0.3, 0.55, 0.3, 0.32], side: [0, 0.35, 0, -0.35, 0.3, 0, -0.3, 0],
    medals: [14, 18, 24], limit: 32 },
  { id: 'wind', name: '바람 타기', poly: PATH2, s0: 1.4, step: 2.5, heights: [0.45, 0.75, 0.6, 0.9, 0.7, 1.0, 0.75], side: [0, 0.4, -0.4, 0.3, -0.3, 0.4, 0],
    medals: [13, 17, 23], limit: 30, needs: 'booster', needsText: '하늘을 나는 부스터가 있어야 해요' },
];
const MEDAL = ['금', '은', '동'];

export class Trials {
  constructor({ ctx, gameplay, player, ui, audio, fx, quests }) {
    Object.assign(this, { ctx, gameplay, player, ui, audio, fx, quests });
    this.scene = ctx.scene; this.T = gameplay.T; this.active = null; this.courses = [];
    this.v = new THREE.Vector3(); this.prev = new THREE.Vector3();
    const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
      const r = g.createRadialGradient(64, 64, 20, 64, 64, 64); r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(0.55, 'rgba(255,255,255,.65)'); r.addColorStop(0.68, 'rgba(255,255,255,.25)'); r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
    this.glowTex = glowTex;
    for (const C of COURSES) this.courses.push(this.build(C));
    gameplay.save.trials = gameplay.save.trials || {};
  }

  build(C) {
    const rings = [], grp = new THREE.Group(); grp.visible = false; this.scene.add(grp);
    const n = C.heights.length;
    for (let i = 0; i < n; i++) {
      const a = along(C.poly, C.s0 + (i + 1) * C.step), nx = -a.tz, nz = a.tx, off = C.side[i] || 0;
      const x = a.x + nx * off, z = a.z + nz * off, y = this.T.heightAt(x, z) + C.heights[i];
      const mat = new THREE.MeshStandardMaterial({ color: 0x10282c, emissive: 0x5fe6ff, emissiveIntensity: 0.4, roughness: 0.3, metalness: 0.2, transparent: true, opacity: 0.6 });
      const torus = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.022, 10, 48), mat);
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.95), new THREE.MeshBasicMaterial({ map: this.glowTex, color: 0x5fe6ff, transparent: true, opacity: 0.0,
        blending: THREE.AdditiveBlending, depthWrite: false }));
      const ring = new THREE.Group(); ring.add(torus, glow); ring.position.set(x, y, z);
      ring.lookAt(x + a.tx, y, z + a.tz);
      grp.add(ring);
      rings.push({ ring, torus, glow, mat, c: new THREE.Vector3(x, y, z), n: new THREE.Vector3(a.tx, 0, a.tz), passT: -1 });
    }
    // start pad: a lit disc on the trail just before the first ring
    const s = along(C.poly, C.s0), pad = new THREE.Vector3(s.x, this.T.heightAt(s.x, s.z), s.z);
    const padM = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.34, 48), new THREE.MeshBasicMaterial({ color: 0x5fe6ff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    padM.rotation.x = -Math.PI / 2; padM.position.copy(pad).y += 0.02; this.scene.add(padM);
    const padIn = new THREE.Mesh(new THREE.CircleGeometry(0.2, 32), new THREE.MeshBasicMaterial({ map: this.glowTex, color: 0x5fe6ff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
    padIn.rotation.x = -Math.PI / 2; padIn.position.copy(pad).y += 0.021; this.scene.add(padIn);
    const course = { C, rings, grp, pad, padM, padIn };
    this.gameplay.interactables.push({ pos: pad, r: 0.55, label: () => this.label(course), act: () => this.start(course) });
    return course;
  }
  best(C) { return this.gameplay.save.trials[C.id]; }
  label(course) {
    const C = course.C, b = this.best(C);
    if (this.active) return '도전 중…';
    if (C.needs && !this.gameplay.save[C.needs]) return `도전: ${C.name} (${C.needsText})`;
    return `도전: ${C.name}` + (b ? ` · 최고 ${b.t.toFixed(2)}초 ${b.m >= 0 ? MEDAL[b.m] + '메달' : ''}` : '');
  }
  start(course) {
    const C = course.C;
    if (this.active) return;
    if (C.needs && !this.gameplay.save[C.needs]) { this.audio.play('deny'); this.ui.toast(C.needsText); return; }
    this.active = { course, i: 0, t: -3, started: false, beep: 3 };
    course.grp.visible = true;
    for (const r of course.rings) { r.passT = -1; r.ring.scale.setScalar(1); r.ring.visible = true; }
    this.ui.trialShow(C.name, course.rings.length);
    this.quests.override = () => (this.active ? this.active.course.rings[this.active.i]?.c : null);
  }
  end(ok) {
    const A = this.active; if (!A) return;
    const C = A.course.C;
    if (ok) {
      const t = A.t, m = C.medals.findIndex((lim) => t <= lim);
      const prev = this.best(C), isBest = !prev || t < prev.t;
      if (isBest) this.gameplay.save.trials[C.id] = { t, m: m < 0 ? (prev ? prev.m : -1) : Math.min(m, prev && prev.m >= 0 ? prev.m : 9) };
      this.ui.trialResult(C.name, t, m, isBest, prev ? prev.t : null);
      this.audio.play(m === 0 ? 'ability' : 'quest');
      this.player.emit(m >= 0 ? 'solved' : 'curious');
      this.gameplay.persist();
    } else { this.ui.trialFail(C.name); this.audio.play('deny'); this.player.emit('worried'); }
    A.course.grp.visible = false;
    this.active = null; this.quests.override = null;
    this.ui.trialHide();
  }
  update(dt, time) {
    for (const k of this.courses) {
      // the start pads breathe; a locked course shows dim
      const locked = k.C.needs && !this.gameplay.save[k.C.needs];
      k.padM.material.opacity = (locked ? 0.18 : 0.4 + 0.25 * Math.sin(time * 2.4)) * (this.active ? 0.3 : 1);
      k.padIn.material.opacity = locked ? 0.1 : 0.25 + 0.15 * Math.sin(time * 2.4 + 1);
    }
    const A = this.active; if (!A) return;
    const P = this.player, R = A.course.rings, C = A.course.C;
    const body = this.v.set(P.pos.x, P.pos.y + 0.18, P.pos.z);
    if (A.t < 0) {
      // countdown: the robot can line up but the clock has not started
      A.t += dt;
      const sec = Math.ceil(-A.t);
      if (sec !== A.beep && sec > 0) { A.beep = sec; this.ui.countdown(sec); this.audio.play('beep', { pitch: 0.8 }); }
      if (A.t >= 0) { A.t = 0; this.ui.countdown('출발!'); this.audio.play('beep', { pitch: 1.4 }); }
      this.prev.copy(body); this.ui.trialTime(0, 0);
      return;
    }
    A.t += dt;
    // rings: the next one burns bright, the rest wait dim; passed ones burst outward and fade
    R.forEach((r, j) => {
      const next = j === A.i;
      if (r.passT >= 0) { r.passT += dt; const k = r.passT / 0.5; r.ring.scale.setScalar(1 + k * 0.8); r.mat.opacity = Math.max(0, 0.9 * (1 - k)); r.glow.material.opacity = Math.max(0, 0.8 * (1 - k)); if (k >= 1) r.ring.visible = false; return; }
      r.mat.emissiveIntensity = next ? 2.6 + Math.sin(time * 8) * 0.6 : 0.5;
      r.mat.opacity = next ? 1 : j === A.i + 1 ? 0.55 : 0.3;
      r.glow.material.opacity = next ? 0.55 + 0.2 * Math.sin(time * 8) : 0.0;
      r.glow.lookAt(this.ctx.camera.position);
    });
    const r = R[A.i];
    if (r) {
      // passed if the body crossed the ring's plane inside the ring this frame, or sits inside it
      const d0 = this.prev.clone().sub(r.c).dot(r.n), d1 = body.clone().sub(r.c).dot(r.n);
      let hit = body.distanceTo(r.c) < 0.22;
      if (!hit && d0 < 0 && d1 >= 0) { const ip = this.prev.clone().lerp(body, d0 / (d0 - d1)); hit = ip.distanceTo(r.c) < 0.33; }
      if (hit) {
        r.passT = 0; A.i++;
        this.audio.play('collect', { pitch: 0.9 + A.i * 0.06 });
        this.fx.burst(r.c, 0x7ff0ff, 24);
        if (A.i >= R.length) { this.ui.trialTime(A.t, A.i); this.end(true); return; }
      }
    }
    this.prev.copy(body);
    this.ui.trialTime(A.t, A.i);
    if (A.t > C.limit || P.state === 'swim') this.end(false);
  }
}
