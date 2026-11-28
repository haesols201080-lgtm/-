// The squad. Friends that have been found follow Nuri in a little line along the path it walked (so they go
// round obstacles the way it did). Toto and Bori can be picked up and thrown, and do their job where they land:
//   Toto (recorder) — films the spot: hidden crystals and relics within 10 m light up for 15 s, nearby squirrels
//                     startle and drop what they were carrying.
//   Bori (lamp)     — leaves a light there for 30 s; dark crystals (hidden ones) only show inside its light.
// Both also weigh enough to hold a pressure plate down. Mina is the base: with enough crystals she flies Nuri to
// any landmark already discovered.
import * as THREE from 'three';
import { josa } from './util.js';
import { isTouch } from './quality.js';

const GRAV = 9.8;

export class Squad {
  constructor({ ctx, gameplay, player, ui, audio, fx, world }) {
    Object.assign(this, { ctx, gameplay, player, ui, audio, fx, world });
    this.trail = []; this.trailStep = 0.08; this.holding = null; this.lights = []; this.reveals = [];
    this.v = new THREE.Vector3();
    // hidden crystals that only show in Bori's light: in the cave and under a few big roots
    this.dark = [];
  }
  members() { return this.gameplay.companions.filter((c) => c.found && c.kind !== 2); }
  addDark(spots) {
    const geo = this.gameplay.shards[0]?.mesh.geometry;
    for (const [x, y, z] of spots) {
      const m = new THREE.Mesh(geo, this.gameplay.mats.shard.clone()); m.material.transparent = true; m.material.opacity = 0;
      m.position.set(x, y, z); m.visible = false; this.ctx.scene.add(m);
      const s = { id: 'd' + this.gameplay.shards.length, mesh: m, base: y, got: false, dark: true };
      this.gameplay.shards.push(s); this.dark.push(s);
    }
    this.gameplay.totalShards = this.gameplay.shards.length;
  }
  // ---------------------------------------------------------------- pick up / throw
  near(maxD = 0.55) {
    const P = this.player.pos; let best = null, bd = maxD;
    for (const c of this.members()) { if (c.state === 'fly' || c.state === 'work') continue; const d = c.mesh.position.distanceTo(P); if (d < bd) { bd = d; best = c; } }
    return best;
  }
  // the friend button (G, the pad's RT): throw the one in the hands, else call the nearest into them
  friendButton() {
    if (this.holding) { this.throwHeld(); return; }
    const P = this.player.pos; let best = null, bd = 1e9;
    for (const c of this.members()) { if (c.state === 'fly') continue; const d = c.mesh.position.distanceTo(P); if (d < bd) { bd = d; best = c; } }
    if (best) this.callOrThrow(best);
  }
  // its prompt (keyboard and pad only: on touch the portraits are the buttons)
  prompt() {
    if (isTouch) return null;
    if (this.holding) return `${josa(this.holding.name, '을', '를')} 던지기`;
    if (this.player.carry) return null;
    const c = this.near(0.9); return c ? `${josa(c.name, '을', '를')} 들기` : null;
  }
  pickUp(c) { this.holding = c; c.state = 'held'; this.player.carry = { kind: 'friend', r: 0.08 }; this.audio.play('pickup'); this.player.emit('grab'); }
  throwHeld() {
    const c = this.holding; if (!c) return; this.holding = null; this.player.carry = null;
    const P = this.player, f = new THREE.Vector3(Math.sin(P.yaw), 0, Math.cos(P.yaw));
    c.state = 'fly'; c.flyT = 0; c.vel = new THREE.Vector3(f.x * 3.2, 3.1, f.z * 3.2); c.spin = 9; c.col?.setEnabled(true);
    this.audio.play('throw'); P.playAction('wave', 0.4);
  }
  land(c) {
    c.state = 'work'; c.workT = 0;
    const p = c.mesh.position.clone();
    this.audio.play('clack', { pos: p });
    if (c.kind === 0) {
      // Toto films: reveal what is hidden around, and startle squirrels
      this.fx.ring?.(p.clone().setY(p.y + 0.05), 1.8, 0.6);
      this.audio.play('beep', { pos: p, pitch: 1.4 });
      const R = 10;
      for (const s of this.gameplay.shards) if (!s.got && s.mesh.position.distanceTo(p) < R) this.reveals.push({ s, t: 15 });
      this.onReveal?.(p, R);
      this.creatures?.startle(p, 4.5, (id, at) => this.gameplay.dropShard(id, at));
      this.ui.toast('셔터: 촬영 완료. 주변 반응을 표시했어.');
    } else if (c.kind === 1) {
      const L = new THREE.PointLight(0xffd9a0, 2.2, 4.5, 2); L.position.copy(p).y += 0.35; this.ctx.scene.add(L);
      this.lights.push({ L, t: 30, p: p.clone() });
      this.audio.play('power', { pos: p, vol: 0.5 });
      this.ui.toast('랜턴: 여기를 30초 동안 비춘다.');
    }
  }
  // ---------------------------------------------------------------- per frame
  update(dt, time) {
    const P = this.player;
    // breadcrumb trail of where the robot walked
    const last = this.trail[0];
    if (!last || last.distanceTo(P.pos) > this.trailStep) { this.trail.unshift(P.pos.clone()); if (this.trail.length > 80) this.trail.length = 80; }
    const mem = this.members();
    this.portraits();
    mem.forEach((c, k) => {
      const m = c.mesh;
      if (!c.joined) {
        c.joined = true;
        setTimeout(() => this.ui.toast(c.kind === 0
          ? `셔터가 뒤따라와요. ${isTouch ? '왼쪽의 셔터 버튼' : 'G 키 (또는 1)'}로 불러 들고, 한 번 더 누르면 던져요. 떨어진 곳을 촬영해 숨은 결정을 찾아 줘요.`
          : '랜턴이 뒤따라와요. 던지면 그 자리를 30초 동안 비춰요. 어두운 곳의 숨은 결정은 빛 안에서만 보여요.'), 1500);
      }
      if (!c.state || c.state === 'follow' || c.state === 'idle') c.state = 'follow';
      // moved from outside (a flight with Mina, a cutscene): the body goes where the model was put
      if (c._set && m.position.distanceToSquared(c._set) > 0.0025 && c.state !== 'held') this.place(c, m.position.x, m.position.y, m.position.z);
      if (c.state === 'held') {
        // overhead, in both hands
        m.position.set(P.pos.x, P.pos.y + 0.42, P.pos.z); m.rotation.set(0, P.yaw, 0);
        (c._set ||= new THREE.Vector3()).copy(m.position);
        return;
      }
      const t = c.body.translation();
      if (c.state === 'fly') {
        m.position.set(t.x, t.y - c.cy, t.z); m.rotation.x += c.spin * dt;
        (c._set ||= new THREE.Vector3()).copy(m.position); c.pos.copy(m.position);
        return;
      }
      if (c.state === 'work') {
        c.workT += dt;
        // a little celebration on the spot, then hurry back into the line
        m.rotation.y += dt * (c.kind === 0 ? 4 : 1.5);
        if (c.workT > (c.kind === 0 ? 2.2 : 1.4)) c.state = 'follow';
      } else {
        // follow: a point on the trail ~0.55 m per place in the line (step() walks it there, round what is in the way)
        // walk back along the trail by the place's spacing; a jump in the trail (teleport, lift) ends it there
        const want = 0.55 + k * 0.5; let acc = 0, tgt = this.trail[0] || P.pos;
        for (let i = 1; i < this.trail.length; i++) {
          const seg = this.trail[i].distanceTo(this.trail[i - 1]);
          if (seg > 1.0) break;
          acc += seg; tgt = this.trail[i];
          if (acc >= want) break;
        }
        // (never closer than its place in the line: with a short trail, just after a jump or a lift, it stands off)
        const gap = 0.42 + k * 0.32, ox = m.position.x - P.pos.x, oz = m.position.z - P.pos.z, od = Math.hypot(ox, oz) || 1;
        if (Math.hypot(tgt.x - P.pos.x, tgt.z - P.pos.z) < gap) tgt = new THREE.Vector3(P.pos.x + ox / od * gap, tgt.y, P.pos.z + oz / od * gap);
        c.tgt = tgt;
        const moving = (c.speed || 0) > 0.04;
        if (moving) { const dy = (((c.dir - m.rotation.y) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI; m.rotation.y += dy * Math.min(1, dt * 12); }
        if (m.userData.wheel && moving) m.userData.wheel.rotation.x += dt * 14 * Math.min(2, c.speed / 0.5);
        m.position.set(t.x, t.y - c.cy + (moving ? Math.abs(Math.sin(time * 14 + k)) * 0.012 : 0), t.z);
      }
      if (c.state === 'work') m.position.set(t.x, t.y - c.cy, t.z);
      (c._set ||= new THREE.Vector3()).copy(m.position);
      c.pos.set(t.x, t.y - c.cy, t.z);
    });
    // Toto's reveals: revealed crystals pulse brighter and show on the minimap scan
    for (let i = this.reveals.length - 1; i >= 0; i--) {
      const r = this.reveals[i]; r.t -= dt;
      if (r.s.got || r.t <= 0) { this.reveals.splice(i, 1); continue; }
      if (Math.random() < dt * 3) this.fx.spawn({ x: r.s.mesh.position.x, y: r.s.mesh.position.y + 0.05, z: r.s.mesh.position.z, vx: 0, vy: 0.5, vz: 0, g: 0, drag: 0.5, max: 1.2, s0: 0.02, s1: 0, c: [0.5, 0.95, 1], a: 1, add: true });
    }
    // Bori's lights: fade out; dark crystals show inside any light (Bori in the line counts, with a smaller radius)
    for (let i = this.lights.length - 1; i >= 0; i--) {
      const l = this.lights[i]; l.t -= dt; l.L.intensity = 2.2 * Math.min(1, l.t / 4);
      if (l.t <= 0) { this.ctx.scene.remove(l.L); this.lights.splice(i, 1); }
    }
    const bori = mem.find((c) => c.kind === 1);
    for (const s of this.dark) {
      if (s.got) continue;
      let lit = 0;
      for (const l of this.lights) lit = Math.max(lit, 1 - s.mesh.position.distanceTo(l.p) / 3.2);
      if (bori && bori.state === 'follow') lit = Math.max(lit, 1 - s.mesh.position.distanceTo(bori.mesh.position) / 1.6);
      const o = Math.max(0, Math.min(1, lit * 2));
      s.mesh.visible = o > 0.02; s.mesh.material.opacity = o; s.mesh.material.transparent = o < 1;
      s.hidden = o < 0.3;                         // can only be picked up once it is lit
    }
  }
  // ---------------------------------------------------------------- physics (each fixed step, before the world steps)
  // The found friends walk with a character controller of their own: round rocks and roots, up small steps, never
  // through a wall, a crate or the robot. They make way when the robot walks back into them; one that is pinned
  // against it lets it through for a moment (so a friend can never wall the robot into a tunnel). Thrown, they fly
  // until they hit something: a wall knocks them back, the ground (or a crate, a plate) is where they land.
  place(c, x, y, z) { const p = { x, y: y + c.cy, z }; c.body.setTranslation(p, true); c.body.setNextKinematicTranslation(p); c.vy = 0; }
  ccOf(c) {
    if (c.cc) return c.cc;
    const cc = c.cc = this.ctx.physics.createCharacterController(0.006);
    cc.enableAutostep(0.05, 0.03, false); cc.enableSnapToGround(0.05);
    cc.setMaxSlopeClimbAngle(55 * Math.PI / 180); cc.setMinSlopeSlideAngle(60 * Math.PI / 180);
    cc.setSlideEnabled(true); cc.setApplyImpulsesToDynamicBodies(true); cc.setCharacterMass(0.8);
    return cc;
  }
  step(dt) {
    const R = this.ctx.RAPIER, P = this.player, pc = P.col;
    for (const c of this.gameplay.companions) {
      if (!c.body) continue;
      if (c.kind === 2) { c.body.setNextKinematicTranslation(c.mesh.position); continue; }
      if (!c.found || !c.state) continue;                       // asleep where it was found: it stays where it is
      const col = c.col, t = c.body.translation();
      if (c.state === 'held') {
        if (col.isEnabled()) col.setEnabled(false);
        c.body.setNextKinematicTranslation({ x: P.pos.x, y: P.pos.y + 0.42 + c.cy, z: P.pos.z }); continue;
      }
      const cc = this.ccOf(c), filter = (o) => o.handle !== col.handle && !o.isSensor() && o.userData?.kind !== 'item-held' && !(o.handle === pc.handle && c.state === 'fly' && c.flyT < 0.3);
      if (c.state === 'fly') {
        if (!col.isEnabled()) col.setEnabled(true);
        c.flyT += dt; c.vel.y -= GRAV * dt;
        const want = { x: c.vel.x * dt, y: c.vel.y * dt, z: c.vel.z * dt };
        cc.disableSnapToGround(); cc.computeColliderMovement(col, want, R.QueryFilterFlags.EXCLUDE_SENSORS, undefined, filter); cc.enableSnapToGround(0.05);
        const mv = cc.computedMovement(), wh = Math.hypot(want.x, want.z);
        if (wh > 1e-4 && Math.hypot(mv.x, mv.z) < wh * 0.4) { c.vel.x *= -0.3; c.vel.z *= -0.3; this.audio.play('clack', { pos: c.mesh.position, vol: 0.4 }); }
        if (want.y > 0 && mv.y < want.y * 0.3) c.vel.y = Math.min(c.vel.y, 0);       // a branch overhead
        const nx = t.x + mv.x, ny = t.y + mv.y, nz = t.z + mv.z, gy = this.gameplay.groundY(nx, nz);
        c.body.setNextKinematicTranslation({ x: nx, y: Math.max(ny, gy + c.cy - 0.02), z: nz });
        if ((cc.computedGrounded() && c.vel.y < 0) || ny - c.cy <= gy) { c.mesh.position.set(nx, Math.max(ny, gy + c.cy) - c.cy, nz); c.mesh.rotation.x = 0; c.vy = 0; this.land(c); }
        continue;
      }
      // follow / work: toward its place in the line, falling under gravity, snapped to the ground
      let mx = 0, mz = 0;
      const tg = c.state === 'follow' ? c.tgt : null;
      if (tg) {
        const dx = tg.x - t.x, dz = tg.z - t.z, d = Math.hypot(dx, dz);
        if (d > 6) { this.place(c, tg.x, this.gameplay.groundY(tg.x, tg.z), tg.z); c.ghostT = 0.5; col.setEnabled(false); continue; }
        const k = Math.min(1, dt * (d > 1 ? 6 : 3.5)); mx = dx * k; mz = dz * k;
      }
      // make way for the robot
      const px = t.x - P.pos.x, pz = t.z - P.pos.z, pd = Math.hypot(px, pz), level = Math.abs(t.y - c.cy - P.pos.y) < 0.35;
      if (level && pd < 0.32) { const s = (0.32 - pd) * 7 * dt / Math.max(pd, 1e-3); mx += px * s; mz += pz * s; }
      c.vy = Math.max(-6, (c.vy || 0) - GRAV * dt);
      if (c.ghostT > 0) {
        // passing through: no collisions until clear of the robot again
        c.ghostT -= dt;
        const nx = t.x + mx, nz = t.z + mz;
        c.body.setNextKinematicTranslation({ x: nx, y: this.gameplay.groundY(nx, nz) + c.cy, z: nz });
        if (c.ghostT <= 0 && !(level && pd < 0.24)) col.setEnabled(true); else if (c.ghostT <= 0) c.ghostT = 0.1;
        c.speed = Math.hypot(mx, mz) / dt; if (c.speed > 0.04) c.dir = Math.atan2(mx, mz); c.vy = 0;
        continue;
      }
      if (!col.isEnabled()) col.setEnabled(true);
      cc.computeColliderMovement(col, { x: mx, y: c.vy * dt, z: mz }, R.QueryFilterFlags.EXCLUDE_SENSORS, undefined, filter);
      const mv = cc.computedMovement();
      if (cc.computedGrounded() && c.vy < 0) c.vy = 0;
      let nx = t.x + mv.x, ny = t.y + mv.y, nz = t.z + mv.z;
      const gy = this.gameplay.groundY(nx, nz);
      if (ny - c.cy < gy - 0.25) { ny = gy + c.cy; c.vy = 0; }               // fell through something: back on the ground
      c.body.setNextKinematicTranslation({ x: nx, y: ny, z: nz });
      c.speed = Math.hypot(mv.x, mv.z) / dt; if (c.speed > 0.04) c.dir = Math.atan2(mv.x, mv.z);
      // pinned against the robot (it walks into it and it cannot get out of the way): let it through
      if (level && pd < 0.19) { c.pressT = (c.pressT || 0) + dt; if (c.pressT > 0.3) { c.pressT = 0; c.ghostT = 0.8; col.setEnabled(false); } } else c.pressT = 0;
    }
  }
  // portraits: tap (or 1 / 2) to call a friend into Nuri's hands; tap again to throw it
  portraits() {
    const box = document.getElementById('squad'); if (!box) return;
    const mem = this.members(), key = mem.map((c) => c.id + (this.holding === c ? '*' : '')).join(',');
    if (key === this._pkey) return; this._pkey = key;
    box.innerHTML = '';
    mem.forEach((c, i) => {
      const b = document.createElement('button'); b.className = this.holding === c ? 'on' : '';
      const ic = document.createElement('i'); ic.style.background = ['#d9a04a', '#6f8797'][c.kind]; b.appendChild(ic);
      const sp = document.createElement('span'); sp.textContent = (this.holding === c ? '던지기' : c.name); b.appendChild(sp);
      const go = (e) => { e.preventDefault(); e.stopPropagation(); this.callOrThrow(c); };
      b.addEventListener('click', go); b.addEventListener('touchstart', go, { passive: false });
      box.appendChild(b);
    });
    if (!this._keys) { this._keys = true; addEventListener('keydown', (e) => { const k = { Digit1: 0, Digit2: 1 }[e.code]; const c = this.members()[k]; if (c !== undefined && c) this.callOrThrow(c); }); }
  }
  callOrThrow(c) {
    if (this.holding === c) { this.throwHeld(); return; }
    if (this.holding || this.player.carry || c.state === 'fly') return;
    // the friend hops straight back into Nuri's hands (from anywhere nearby)
    if (c.mesh.position.distanceTo(this.player.pos) > 12) { this.ui.toast(`${josa(c.name, '이', '가')} 너무 멀리 있어요.`); return; }
    this.pickUp(c); this.audio.play('beep', { pitch: 1.3 });
  }
  // extra weight on the pressure plate from friends sitting on it
  plateWeight(pos) { let w = 0; for (const c of this.members()) if (c.state !== 'held' && c.state !== 'fly' && c.mesh.position.distanceTo(pos) < 0.42) w += 8; return w; }
}
