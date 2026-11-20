// The squad. Friends that have been found follow Nuri in a little line along the path it walked (so they go
// round obstacles the way it did). Toto and Bori can be picked up and thrown, and do their job where they land:
//   Toto (recorder) — films the spot: hidden crystals and relics within 10 m light up for 15 s, nearby squirrels
//                     startle and drop what they were carrying.
//   Bori (lamp)     — leaves a light there for 30 s; dark crystals (hidden ones) only show inside its light.
// Both also weigh enough to hold a pressure plate down. Mina is the base: with enough crystals she flies Nuri to
// any landmark already discovered.
import * as THREE from 'three';

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
  pickUp(c) { this.holding = c; c.state = 'held'; this.player.carry = { kind: 'friend', r: 0.08 }; this.audio.play('pickup'); this.player.emit('grab'); }
  throwHeld() {
    const c = this.holding; if (!c) return; this.holding = null; this.player.carry = null;
    const P = this.player, f = new THREE.Vector3(Math.sin(P.yaw), 0, Math.cos(P.yaw));
    c.state = 'fly'; c.vel = new THREE.Vector3(f.x * 3.2, 3.1, f.z * 3.2); c.spin = 9;
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
      this.ui.toast('토토: 촬영 완료. 주변에 반응 표시.');
    } else if (c.kind === 1) {
      const L = new THREE.PointLight(0xffd9a0, 2.2, 4.5, 2); L.position.copy(p).y += 0.35; this.ctx.scene.add(L);
      this.lights.push({ L, t: 30, p: p.clone() });
      this.audio.play('power', { pos: p, vol: 0.5 });
      this.ui.toast('보리: 여기 비출게. 30초.');
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
          ? '토토가 뒤따라와요. 가까이서 [행동]으로 들고, 한 번 더 누르면 던져요. 떨어진 곳을 촬영해 숨은 결정을 찾아 줘요.'
          : '보리가 뒤따라와요. 던지면 그 자리를 30초 동안 비춰요. 어두운 곳의 숨은 결정은 빛 안에서만 보여요.'), 1500);
      }
      if (!c.state || c.state === 'follow' || c.state === 'idle') c.state = 'follow';
      if (c.state === 'held') {
        // overhead, in both hands
        m.position.set(P.pos.x, P.pos.y + 0.42, P.pos.z); m.rotation.set(0, P.yaw, 0);
        return;
      }
      if (c.state === 'fly') {
        c.vel.y -= GRAV * dt; m.position.addScaledVector(c.vel, dt); m.rotation.x += c.spin * dt;
        const gy = this.gameplay.groundY(m.position.x, m.position.z);
        if (m.position.y <= gy && c.vel.y < 0) { m.position.y = gy; m.rotation.x = 0; this.land(c); }
        return;
      }
      if (c.state === 'work') {
        c.workT += dt;
        // a little celebration on the spot, then hurry back into the line
        m.rotation.y += dt * (c.kind === 0 ? 4 : 1.5);
        if (c.workT > (c.kind === 0 ? 2.2 : 1.4)) c.state = 'follow';
        return;
      }
      // follow: a point on the trail ~0.55 m per place in the line, eased; jump back in when far behind
      // walk back along the trail by the place's spacing; a jump in the trail (teleport, lift) ends it there
      const want = 0.55 + k * 0.5; let acc = 0, tgt = this.trail[0] || P.pos;
      for (let i = 1; i < this.trail.length; i++) {
        const seg = this.trail[i].distanceTo(this.trail[i - 1]);
        if (seg > 1.0) break;
        acc += seg; tgt = this.trail[i];
        if (acc >= want) break;
      }
      const d = m.position.distanceTo(tgt);
      if (d > 6) { m.position.copy(tgt); }
      else {
        const k2 = Math.min(1, dt * (d > 1 ? 6 : 3.5));
        const nx = m.position.x + (tgt.x - m.position.x) * k2, nz = m.position.z + (tgt.z - m.position.z) * k2;
        const moving = Math.hypot(nx - m.position.x, nz - m.position.z) > 0.002;
        if (moving) m.rotation.y = Math.atan2(nx - m.position.x, nz - m.position.z);
        m.position.x = nx; m.position.z = nz;
        m.position.y = this.gameplay.groundY(nx, nz) + (moving ? Math.abs(Math.sin(time * 14 + k)) * 0.012 : 0);
        if (m.userData.wheel && moving) m.userData.wheel.rotation.x += dt * 14;
      }
      c.pos.copy(m.position);
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
    if (c.mesh.position.distanceTo(this.player.pos) > 12) { this.ui.toast(`${c.name}이(가) 너무 멀리 있어요.`); return; }
    this.pickUp(c); this.audio.play('beep', { pitch: 1.3 });
  }
  // extra weight on the pressure plate from friends sitting on it
  plateWeight(pos) { let w = 0; for (const c of this.members()) if (c.state !== 'held' && c.state !== 'fly' && c.mesh.position.distanceTo(pos) < 0.42) w += 8; return w; }
}
