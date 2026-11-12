// Player: on-foot character controller, hover skimmer flight model, third-person camera rig, Spire lifts.
import * as THREE from 'three';
import { CLIP, clipRow, buildBody, makeHumanMesh } from '../fx/human.js';
import { PROPS } from '../world/props.js';
import { Batch, Pen } from '../world/builder.js';
import { COAST_X } from '../world/layout.js';

const VEH = [null,
  { name: '고물 스키머', speed: 40, accel: 20, climb: 14, cargo: 12, price: 120, tint: [0.75, 0.6, 0.5] },
  { name: '쿠리어 MK-II', speed: 66, accel: 32, climb: 22, cargo: 30, price: 2400, tint: [0.6, 0.8, 1.0] },
  { name: '하울러 헤비', speed: 86, accel: 38, climb: 28, cargo: 120, price: 30000, tint: [1.0, 0.75, 0.4] },
  { name: '제니스 요트', speed: 130, accel: 56, climb: 44, cargo: 400, price: 800000, tint: [1.2, 1.15, 1.05] }];
export const VEHICLES = VEH;
export const CEILINGS = [140, 420, 900, 1700, 4000];
const wrap = (a) => a - Math.round(a / 6.283185) * 6.283185;

export class Player {
  constructor(game) {
    this.g = game; const { engine, city, crowd } = game; this.phys = city.phys; this.cam = engine.camera;
    this.pos = new THREE.Vector3(0, 0.2, 1750); this.vel = new THREE.Vector3(); this.yaw = 0; this.onGround = true; this.mode = 'foot';
    this.camYaw = 0; this.camPitch = -0.12; this.camDist = 3.8; this.camDistCur = 3.8; this.sens = 0.0024;
    this.clip = CLIP.idle; this.clipPrev = CLIP.idle; this.blend = 0; this.phase = 0; this.phasePrev = 0;
    // hero body (long coat, visor)
    this.body = makeHumanMesh(buildBody({ coat: 1, boots: 1, visor: 1 }), crowd.mat, 1); this.body.count = 1; this.body.frustumCulled = false; engine.scene.add(this.body);
    this.body.geometry.getAttribute('iC0').setXYZ(0, 0.14, 0.13, 0.13); this.body.geometry.getAttribute('iC1').setXYZ(0, 0.1, 0.1, 0.12); this.body.geometry.getAttribute('iC2').setXYZW(0, 0.08, 0.07, 0.07, 0.3);
    // skimmer
    const b = new Batch(512); const pen = new Pen(b); pen.at(0, 0, 0, 0); PROPS.hovercar(pen);
    this.car = new THREE.Mesh(b.build(), city.mat); this.car.scale.setScalar(1.25); this.car.frustumCulled = false; this.car.visible = false; engine.scene.add(this.car);
    this.vpos = new THREE.Vector3(0, 1.4, 1740); this.vvel = new THREE.Vector3(); this.vyaw = 0; this.vroll = 0; this.vpitch = 0; this.hasCar = false;
    this.lamp = new THREE.SpotLight(0xfff0d8, 0, 110, 0.5, 0.6, 1.2); this.lamp.castShadow = false; engine.scene.add(this.lamp); engine.scene.add(this.lamp.target);
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._v = new THREE.Vector3(); this._up = new THREE.Vector3(0, 1, 0); this._one = new THREE.Vector3(1, 1, 1);
    this.speed = 0; this.clearance = 0; this.indoor = 0; this.ceilWarn = 0; this.riding = null;
    this._buildLifts();
  }
  get p() { return this.mode === 'fly' ? this.vpos : this.pos; }
  setCar(tier) { this.hasCar = tier > 0; this.car.visible = this.hasCar; this.spec = VEH[tier] || VEH[1]; if (this.hasCar && !this._placed) { this._placed = true; this.summon(true); } }

  _buildLifts() {
    const { engine, city } = this.g; this.lifts = [];
    for (const l of city.ctx.lifts || []) {
      const grp = new THREE.Group(); const b = new Batch(256); const pen = new Pen(b); pen.at(0, 0, 0, 0);
      pen.use({ st: 27, color: [0.3, 0.31, 0.34], flags: 8 }); pen.lathe(0, 0, [[l.r, -0.5], [l.r, 0], [0.1, 0]], 16, { cap: false }); pen.use({ st: 4, color: [0.6, 0.9, 1], extra: 30, flags: 0 }); pen.lathe(0, 0, [[l.r - 0.5, 0.02], [l.r - 0.9, 0.02]], 16, { cap: false }); pen.lathe(0, 0, [[l.r - 0.05, 2.9], [l.r - 0.05, 3.1]], 16, { cap: false, inside: true });
      pen.use({ st: 3, color: [0.4, 0.5, 0.56], flags: 8 }); pen.lathe(0, 0, [[l.r - 0.1, 0], [l.r - 0.1, 1.1]], 16, { cap: false, inside: true, a0: 0.5, a1: 5.78 });
      const mesh = new THREE.Mesh(b.build(), city.mat); mesh.frustumCulled = false; grp.add(mesh); grp.position.set(l.x, l.stops[0].y, l.z); grp.rotation.y = -l.ang; engine.scene.add(grp);
      const col = city.phys.addDynamic({ t: 0, cx: l.x, cz: l.z, hx: l.r, hz: l.r, cs: 1, sn: 0, y0: l.stops[0].y - 0.5, y1: l.stops[0].y, tag: 9 });
      this.lifts.push({ ...l, grp, col, y: l.stops[0].y, vy: 0, at: 0, to: 0 });
    }
  }
  _updateLifts(dt, input) {
    this.riding = null; this.liftPrompt = null;
    for (const L of this.lifts) {
      const d = Math.hypot(this.pos.x - L.x, this.pos.z - L.z);
      const on = this.mode === 'foot' && d < L.r - 0.3 && Math.abs(this.pos.y - L.y) < 1.6;
      if (L.at !== L.to) {
        const ty = L.stops[L.to].y; const dy = ty - L.y; const dir = Math.sign(dy);
        const vmax = Math.min(70, Math.sqrt(2 * 16 * Math.abs(dy)) + 1.5); L.vy += (dir * vmax - L.vy) * Math.min(1, dt * 2.2); L.y += L.vy * dt;
        if (Math.abs(ty - L.y) < 0.12 || Math.sign(ty - L.y) !== dir) { L.y = ty; L.vy = 0; L.at = L.to; this.g.audio?.blip(660, 0.12); if (on) { this.pos.y = ty; this.vel.y = 0; this.onGround = true; } }
      } else if (on) {
        const up = L.at < L.stops.length - 1, dn = L.at > 0;
        this.liftPrompt = `${L.stops[L.at].name}  ·  ${up ? '[E] ▲ ' + L.stops[L.at + 1].name : ''}${up && dn ? '   ' : ''}${dn ? '[Q] ▼ ' + L.stops[L.at - 1].name : ''}`;
        let want = -1; if (up && input.hit('KeyE', 'BtnE')) want = L.at + 1; if (dn && input.hit('KeyQ', 'BtnQ')) want = L.at - 1;
        if (want >= 0) { const need = want === 2 ? 3 : want === 1 ? 1 : 0; if (this.g.state.license < need) this.g.toast(`고도 면허 ${need}급이 필요합니다`, 'bad'); else { L.to = want; this.g.audio?.blip(440, 0.2); } }
      } else if (this.mode === 'foot' && d < L.r + 5 && d >= L.r - 0.3) {
        const here = L.stops.findIndex((s) => Math.abs(s.y - this.pos.y) < 3);
        if (here >= 0 && here !== L.at && L.at === L.to) { this.liftPrompt = '[E] 승강기 호출'; if (input.hit('KeyE', 'BtnE')) L.to = here; }
      }
      L.grp.position.y = L.y; L.col.y0 = L.y - 0.5; L.col.y1 = L.y;
      if (on) { this.riding = L; if (L.at !== L.to) { this.pos.y = L.y; this.vel.y = 0; this.onGround = true; } }
    }
  }

  summon(silent) {
    if (!this.hasCar) return; const f = this._fwd(this.camYaw);
    const x = this.pos.x + f.x * 5 + f.z * 2.5, z = this.pos.z + f.z * 5 - f.x * 2.5;
    if (this.phys.ceilingAt(x, z, this.pos.y + 1, 2) < this.pos.y + 30) { if (!silent) this.g.toast('실내에서는 스키머를 부를 수 없습니다', 'bad'); return; }
    this.vpos.set(x, Math.max(this.phys.groundAt(x, z, this.pos.y + 3, 2), this.pos.y) + 1.4, z); this.vvel.set(0, 0, 0); this.vyaw = this.camYaw;
    if (!silent) { this.g.toast('스키머 호출 완료'); this.g.audio?.blip(520, 0.15); }
  }
  _fwd(yaw) { return this._v.set(-Math.sin(yaw), 0, -Math.cos(yaw)).clone(); }

  update(dt, input) {
    const ph = this.phys; const g = this.g;
    if (input.enabled) { this.camYaw -= input.lookX * this.sens; this.camPitch = Math.max(-1.3, Math.min(1.25, this.camPitch - input.lookY * this.sens)); this.camDist = Math.max(2.2, Math.min(this.mode === 'fly' ? 26 : 8, this.camDist + input.wheel * 0.6)); }
    const f = this._fwd(this.camYaw), r = new THREE.Vector3(-f.z, 0, f.x);
    this._updateLifts(dt, input);
    // enter / exit / summon
    if (input.hit('KeyF', 'BtnF')) {
      if (this.mode === 'foot' && this.hasCar && this.pos.distanceTo(this.vpos) < 7) { this.mode = 'fly'; this.camDist = 12; g.audio?.blip(300, 0.2); }
      else if (this.mode === 'fly') {
        const gy = ph.groundAt(this.vpos.x, this.vpos.z, this.vpos.y + 0.5, 1);
        if (this.vvel.length() > 14) g.toast('속도를 줄이세요', 'bad'); else if (this.vpos.y - gy > 4.5) g.toast('착륙 후 내릴 수 있습니다', 'bad');
        else { const sx = this.vpos.x + Math.cos(this.vyaw) * 2.6, sz = this.vpos.z - Math.sin(this.vyaw) * 2.6; this.pos.set(sx, ph.groundAt(sx, sz, this.vpos.y + 1.0), sz); this.vel.set(0, 0, 0); this.mode = 'foot'; this.camDist = 3.8; this.vpos.y = gy + 1.3; this.vvel.set(0, 0, 0); }
      } else if (this.mode === 'foot' && this.hasCar) g.toast('[R] 로 스키머를 호출하세요');
    }
    if (input.hit('KeyR', 'BtnR') && this.mode === 'foot') this.summon();

    if (this.mode === 'foot') {
      const sprint = input.down('ShiftLeft', 'ShiftRight', 'BtnRun'); const mag = Math.hypot(input.move.x, input.move.y);
      const sp = mag < 0.01 ? 0 : (mag < 0.55 && input.touch ? 1.6 : sprint ? 8.2 : 4.9);
      const wx = (f.x * input.move.y + r.x * input.move.x), wz = (f.z * input.move.y + r.z * input.move.x); const wl = Math.hypot(wx, wz) || 1;
      const tx = (wx / wl) * sp, tz = (wz / wl) * sp; const acc = this.onGround ? 26 : 6;
      this.vel.x += (tx - this.vel.x) * Math.min(1, dt * acc * 0.4); this.vel.z += (tz - this.vel.z) * Math.min(1, dt * acc * 0.4);
      if (!(this.riding && this.riding.at !== this.riding.to)) {
        this.vel.y -= 24 * dt;
        if (this.onGround && input.hit('Space', 'BtnJump')) { this.vel.y = 7.4; this.onGround = false; }
        this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt; this.pos.y += this.vel.y * dt;
        const q = { x: this.pos.x, z: this.pos.z }; ph.slide(q, 0.34, this.pos.y + 0.5, this.pos.y + 1.75); this.pos.x = q.x; this.pos.z = q.z;
        const gy = ph.groundAt(this.pos.x, this.pos.z, this.pos.y + 0.55, 0.2);
        if (this.pos.y <= gy + 0.03 && this.vel.y <= 0) { this.pos.y = gy; this.vel.y = 0; this.onGround = true; }
        else if (this.onGround && this.pos.y - gy < 0.5 && this.vel.y <= 0) { this.pos.y = gy; this.vel.y = 0; } else this.onGround = false;
        if (this.vel.y > 0 && ph.ceilingAt(this.pos.x, this.pos.z, this.pos.y + 1.0, 0.2) < this.pos.y + 1.85) this.vel.y = 0;
      }
      const sh = Math.hypot(this.vel.x, this.vel.z); this.speed = sh;
      if (sh > 0.4) this.yaw += wrap(Math.atan2(this.vel.x, this.vel.z) - this.yaw) * Math.min(1, dt * 11);
      const st = g.crowd.anim.stride; let clip = !this.onGround ? CLIP.air : sh < 0.25 ? CLIP.idle : sh < 2.6 ? CLIP.walk : CLIP.run;
      if (clip !== this.clip) { this.clipPrev = this.clip; this.phasePrev = this.phase; this.clip = clip; this.blend = 1; if (clip === CLIP.idle || clip === CLIP.air) this.phase = 0; }
      this.blend = Math.max(0, this.blend - dt * 5.5);
      this.phase += clip === CLIP.walk ? (dt * sh) / Math.max(0.3, st[CLIP.walk]) : clip === CLIP.run ? (dt * sh) / Math.max(0.6, st[CLIP.run]) : dt / 7;
    } else {
      // ---- flight
      const S = this.spec; const boost = input.down('ShiftLeft', 'BtnRun') ? 1.6 : 1;
      this.vyaw += wrap(this.camYaw - this.vyaw) * Math.min(1, dt * 2.4);
      const vf = this._fwd(this.vyaw), vr = new THREE.Vector3(-vf.z, 0, vf.x);
      const ax = (vf.x * input.move.y + vr.x * input.move.x * 0.6) * S.accel * boost, az = (vf.z * input.move.y + vr.z * input.move.x * 0.6) * S.accel * boost;
      this.vvel.x += ax * dt; this.vvel.z += az * dt;
      const drag = Math.hypot(input.move.x, input.move.y) > 0.05 ? 0.35 : 1.5; const k = Math.exp(-dt * drag); this.vvel.x *= k; this.vvel.z *= k;
      const hs = Math.hypot(this.vvel.x, this.vvel.z), max = S.speed * boost; if (hs > max) { this.vvel.x *= max / hs; this.vvel.z *= max / hs; }
      let vyT = 0; if (input.down('Space', 'BtnJump')) vyT = S.climb; if (input.down('KeyC', 'ControlLeft', 'BtnDown')) vyT = -S.climb * 1.2;
      const gy = ph.groundAt(this.vpos.x, this.vpos.z, this.vpos.y + 0.5, 1.6); this.clearance = this.vpos.y - gy;
      if (vyT === 0 && this.clearance < 3.2) vyT = (1.5 - this.clearance) * 3;
      const ceil = CEILINGS[g.state.license]; if (this.vpos.y > ceil) { vyT = Math.min(vyT, -(this.vpos.y - ceil) * 0.6 - 2); this.ceilWarn = 1.5; }
      this.vvel.y += (vyT - this.vvel.y) * Math.min(1, dt * 2.6);
      this.vpos.addScaledVector(this.vvel, dt);
      if (this.vpos.y < gy + 1.0) { this.vpos.y = gy + 1.0; if (this.vvel.y < 0) this.vvel.y = 0; }
      const hit = ph.sphere(this.vpos, 2.1);
      if (hit > 0) { const N = ph.hitN; const vn = this.vvel.x * N.x + this.vvel.y * N.y + this.vvel.z * N.z; if (vn < 0) { this.vvel.x -= 1.5 * vn * N.x; this.vvel.y -= 1.5 * vn * N.y; this.vvel.z -= 1.5 * vn * N.z; this.vvel.multiplyScalar(0.72); if (vn < -9) { g.shake = Math.min(1, -vn / 40); g.audio?.thud(); } } }
      const lat = this.vvel.x * vr.x + this.vvel.z * vr.z, fwd = this.vvel.x * vf.x + this.vvel.z * vf.z;
      this.vroll += (Math.max(-0.6, Math.min(0.6, -lat * 0.02 - wrap(this.camYaw - this.vyaw) * 0.5)) - this.vroll) * Math.min(1, dt * 4);
      this.vpitch += (Math.max(-0.3, Math.min(0.3, input.move.y * 0.1 - this.vvel.y * 0.006)) - this.vpitch) * Math.min(1, dt * 3);
      this.speed = Math.hypot(hs, this.vvel.y); this.pos.copy(this.vpos);
      const R = Math.hypot(this.vpos.x, this.vpos.z); if (R > 5600) { this.vvel.x -= (this.vpos.x / R) * 60 * dt; this.vvel.z -= (this.vpos.z / R) * 60 * dt; this.ceilWarn = 1.5; }
    }
    this.ceilWarn = Math.max(0, this.ceilWarn - dt);
    // ---- transforms
    this._q.setFromAxisAngle(this._up, this.yaw); this._m.compose(this.pos, this._q, this._one); this.body.setMatrixAt(0, this._m); this.body.instanceMatrix.needsUpdate = true;
    const ia = this.body.geometry.getAttribute('iAnim'); ia.setXYZW(0, clipRow(this.clip, this.phase), 0, clipRow(this.clipPrev, this.phasePrev), this.blend); ia.needsUpdate = true;
    this.body.visible = this.mode === 'foot';
    if (this.hasCar) {
      const bob = Math.sin(performance.now() * 0.002) * 0.06; this.car.position.set(this.vpos.x, this.vpos.y - 0.45 + bob, this.vpos.z);
      this.car.rotation.set(this.vpitch, this.vyaw + Math.PI, this.vroll, 'YXZ'); const t = this.spec.tint; if (!this.car.userData.t || this.car.userData.t !== t) { this.car.userData.t = t; }
      const vf = this._fwd(this.vyaw); const night = this.g.U.uNight.value; this.lamp.intensity = this.mode === 'fly' ? 900 * (0.25 + 0.75 * night) : 0;
      this.lamp.position.set(this.vpos.x + vf.x * 2.6, this.vpos.y + 0.2, this.vpos.z + vf.z * 2.6); this.lamp.target.position.set(this.vpos.x + vf.x * 40, this.vpos.y - 6, this.vpos.z + vf.z * 40);
    }
    this._camera(dt);
  }

  _camera(dt) {
    const cam = this.cam, ph = this.phys; const fly = this.mode === 'fly';
    const cp = Math.cos(this.camPitch); const dir = this._v.set(-Math.sin(this.camYaw) * cp, Math.sin(this.camPitch), -Math.cos(this.camYaw) * cp).clone();
    const right = new THREE.Vector3(Math.cos(this.camYaw), 0, -Math.sin(this.camYaw));
    const tgt = new THREE.Vector3(this.p.x, this.p.y + (fly ? 1.5 : 1.55), this.p.z);
    if (!fly) tgt.addScaledVector(right, 0.5 * Math.min(1, this.camDistCur / 3));
    const want = this.camDist * (fly ? 1 + this.speed * 0.004 : 1);
    const ex = tgt.x - dir.x * want, ey = tgt.y - dir.y * want + (fly ? 1.2 : 0), ez = tgt.z - dir.z * want;
    const t = ph.castSegment(tgt.x, tgt.y, tgt.z, ex, ey, ez, 0.28, 14);
    const allowed = Math.max(0.5, want * t - 0.2);
    this.camDistCur += (allowed - this.camDistCur) * Math.min(1, dt * (allowed < this.camDistCur ? 18 : 3.5));
    const k = this.camDistCur / want;
    cam.position.set(tgt.x - dir.x * this.camDistCur, tgt.y - dir.y * this.camDistCur + (fly ? 1.2 * k : 0), tgt.z - dir.z * this.camDistCur);
    if (this.g.shake > 0.001) { cam.position.x += (Math.random() - 0.5) * this.g.shake; cam.position.y += (Math.random() - 0.5) * this.g.shake; this.g.shake *= Math.exp(-dt * 6); }
    cam.rotation.set(this.camPitch, this.camYaw, 0, 'YXZ');
    const fov = 62 + Math.min(16, this.speed * 0.13); if (Math.abs(cam.fov - fov) > 0.05) { cam.fov += (fov - cam.fov) * Math.min(1, dt * 3); cam.updateProjectionMatrix(); }
    const near = fly ? Math.max(0.5, Math.min(3, this.clearance * 0.04)) : 0.22; if (Math.abs(cam.near - near) > 0.02) { cam.near = near; cam.updateProjectionMatrix(); }
    // indoors? (roof within 40 m above the camera)
    const c = ph.ceilingAt(cam.position.x, cam.position.z, cam.position.y, 0.3); this.indoor += ((c - cam.position.y < 45 ? 1 : 0) - this.indoor) * Math.min(1, dt * 3);
    this.body.visible = this.mode === 'foot' && this.camDistCur > 0.75;
  }
}
