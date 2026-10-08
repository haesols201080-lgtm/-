// 주인공 이동: 지상(달리기·점프·미끄러짐) · 공중 · 활공 · 스키머 · 해류 · 공명 승강 · 수영
// 세렌의 중력은 지구보다 약간 약하고, 공명이 강한 곳에서는 더 가벼워집니다.
import * as THREE from 'three';

const G = 19;
/** 공기 밀도 (해수면 = 1, 8.5 km 마다 1/e) */
export const airDensity = (y) => Math.exp(-Math.max(0, y) / 8500);
const RADIUS = 0.35;
const HEIGHT = 1.75;
const STEP = 0.55;
const WATER = 0;

export const TUNING = {
  runSpeed: 8.2,
  sprintSpeed: 12.5,
  accel: 55,
  friction: 34,
  airAccel: 14,
  jump: 8.2,
  coyote: 0.13,
  buffer: 0.14,
  glideSink: 0.85,
  glideDrag: 0.0095,
  glideMin: 5,
  glideMax: 58,
  skimMax: 34,
  skimBoost: 50,
  skimAccel: 20,
  swimSpeed: 3.6,
};

export class Player {
  constructor(world) {
    this.world = world;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.state = 'ground';
    this.prevState = 'ground';
    this.stateTime = 0;
    this.onGround = true;
    this.groundH = 0;
    this.groundC = null;
    this.groundN = new THREE.Vector3(0, 1, 0);
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.airTime = 0;
    this.turn = 0; // 좌우 회전량 (기울임 연출용)
    this.pitch = 0; // 활공 비행각
    this.glideSpeed = 0;
    this.skimSpeed = 0;
    this.hspeed = 0;
    this.stumble = 0;
    this.riseCharges = 1;
    this.riseUsed = 0;
    this.canGlide = true;
    this.canSkim = true;
    this.upgrades = { glide: 0, skim: 0, rise: 0 };
    this.mods = { speed: 1, glide: 1 }; // 먹은 것·치유의 기운 (game/venues.js)
    this.current = null; // 해류 타는 중
    this.events = []; // 'land', 'jump', 'glideStart' 등 이번 프레임 사건
    this.impact = 0;
    this.lockControl = 0;
    this._g = { h: 0, c: null };
    this._wish = new THREE.Vector3();
    this._tmp = new THREE.Vector3();
  }

  setState(s) {
    if (s === this.state) return;
    this.prevState = this.state;
    this.state = s;
    this.stateTime = 0;
    this.events.push('state:' + s);
  }

  teleport(x, y, z, reach = 3) {
    // y 를 주면 그 높이(+reach m 까지)의 바닥에, 안 주면 그 자리의 맨 위 바닥에.
    // 바닥 높이를 정확히 아는 곳(실내 층·다리·테라스)은 reach 를 작게 — 층고가 3 m 남짓한 층에서 윗층 바닥판에 올라서지 않게
    const g = y === undefined ? this.world.colliders.ground(x, z, 1e5, 1e5) : this.world.colliders.ground(x, z, y, reach);
    this.pos.set(x, y ?? g.h, z);
    if (y === undefined || y < g.h) this.pos.y = g.h;
    this.vel.set(0, 0, 0);
    this.setState('ground');
    this.current = null;
  }

  /** 카메라 기준 입력 → 월드 방향 */
  wishDir(input, camYaw) {
    const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
    const rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
    const w = this._wish.set(rx * input.move.x + fx * input.move.y, 0, rz * input.move.x + fz * input.move.y);
    return w;
  }

  _gravityScale() {
    return this.world.gravityScale ? this.world.gravityScale(this.pos) : 1;
  }

  update(dt, input, cam) {
    this.events.length = 0;
    this.stateTime += dt;
    this.impact = 0;
    const ctl = this.lockControl > 0 ? null : input;
    this.lockControl = Math.max(0, this.lockControl - dt);
    this.stumble = Math.max(0, this.stumble - dt);
    const move = ctl ? input.move : { x: 0, y: 0 };
    const wish = this.wishDir({ move }, cam.yaw);
    const wishLen = Math.min(1, wish.length());
    if (wishLen > 0.001) wish.multiplyScalar(1 / wish.length());

    if (ctl && ctl.pressed('jump')) this.jumpBuffer = TUNING.buffer;
    else this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);

    const prevY = this.vel.y;
    switch (this.state) {
      case 'ground': this._ground(dt, ctl, wish, wishLen); break;
      case 'air': this._air(dt, ctl, wish, wishLen); break;
      case 'glide': this._glide(dt, ctl, wish, wishLen, cam); break;
      case 'skim': this._skim(dt, ctl, wish, wishLen); break;
      case 'swim': this._swim(dt, ctl, wish, wishLen); break;
      case 'current': this._current(dt, ctl, wish, wishLen); break;
      case 'lift': this._lift(dt, ctl, wish, wishLen); break;
      case 'ride': this._ride(dt); break;
      case 'fly': this._fly(dt, ctl, wish, wishLen, cam); break;
    }

    // 세계 경계 — 장막
    const r = Math.hypot(this.pos.x, this.pos.z);
    const lim = this.world.limitRadius || 26000;
    if (r > lim) {
      const k = (r - lim) / r;
      this.pos.x -= this.pos.x * k; this.pos.z -= this.pos.z * k;
      if (!this._warnedEdge) { this.events.push('edge'); this._warnedEdge = true; }
    } else if (r < lim - 500) this._warnedEdge = false;

    this.hspeed = Math.hypot(this.vel.x, this.vel.z);
    this.groundH = this._groundBelow();
  }

  _groundBelow() {
    const g = this.world.colliders.ground(this.pos.x, this.pos.z, this.pos.y + 0.1, 0.1, 0.05, this._g);
    return Math.max(g.h, WATER);
  }

  _faceToward(dx, dz, rate, dt) {
    if (Math.abs(dx) + Math.abs(dz) < 1e-4) return 0;
    const target = Math.atan2(dx, dz);
    let d = target - this.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    const step = Math.max(-rate * dt, Math.min(rate * dt, d));
    this.yaw += step;
    return d;
  }

  _carry(dt) {
    // 움직이는 발판 위에 서 있으면 함께 이동
    const c = this.groundC;
    if (c && c.obj && c.px !== undefined) {
      // 한 번 움직인 만큼은 한 번만 (프레임을 나눠 계산해도 두 번 실어 나르지 않게)
      if (c._ax === c.x && c._az === c.z && c._ay === c.y1) return;
      c._ax = c.x; c._az = c.z; c._ay = c.y1;
      const dx = c.x - c.px, dz = c.z - c.pz, dy = c.y1 - c.py;
      this.pos.x += dx; this.pos.z += dz; this.pos.y += dy;
      if (c.dyaw) {
        const ox = this.pos.x - c.x, oz = this.pos.z - c.z;
        const cs = Math.cos(c.dyaw), sn = Math.sin(c.dyaw);
        this.pos.x = c.x + ox * cs + oz * sn;
        this.pos.z = c.z - ox * sn + oz * cs;
        this.yaw += c.dyaw;
      }
    }
  }

  _ground(dt, ctl, wish, wishLen) {
    this._carry(dt);
    const sprint = ctl && (ctl.isHeld('sprint') || (ctl.lastDevice === 'touch' && wishLen > 0.95 && this._fullTilt > 1.0));
    this._fullTilt = wishLen > 0.95 ? (this._fullTilt || 0) + dt : 0;
    let maxS = (sprint ? TUNING.sprintSpeed : TUNING.runSpeed) * wishLen * this.mods.speed * (this.carrySlow || 1);
    if (this.stumble > 0) maxS *= 0.3;
    if (this.wade) maxS *= 1 - 0.42 * this.wade; // 분수 연못 속: 물을 헤치며 걷는다

    // 경사
    const n = this._groundNormal();
    const steep = n.y < 0.7 && !this.groundC;
    const v = this.vel;
    if (steep) {
      // 가파른 비탈은 미끄러진다
      const gx = n.x, gz = n.z;
      v.x += gx * G * 0.9 * dt; v.z += gz * G * 0.9 * dt;
      v.x += wish.x * TUNING.airAccel * 0.5 * dt * wishLen;
      v.z += wish.z * TUNING.airAccel * 0.5 * dt * wishLen;
      const sp = Math.hypot(v.x, v.z);
      if (sp > 20) { v.x *= 20 / sp; v.z *= 20 / sp; }
    } else {
      const tx = wish.x * maxS, tz = wish.z * maxS;
      const a = wishLen > 0.05 ? TUNING.accel : TUNING.friction;
      const dx = tx - v.x, dz = tz - v.z;
      const d = Math.hypot(dx, dz);
      const step = a * dt;
      if (d <= step) { v.x = tx; v.z = tz; } else { v.x += (dx / d) * step; v.z += (dz / d) * step; }
      // 너무 가파른 곳으로는 올라가지 못함
      const ahead = this.world.heightAt(this.pos.x + v.x * 0.15, this.pos.z + v.z * 0.15);
      const rise = (ahead - this.pos.y) / Math.max(0.01, Math.hypot(v.x, v.z) * 0.15);
      if (rise > 1.25 && !this.groundC) { v.x *= 0.2; v.z *= 0.2; }
    }
    this.turn = this._faceToward(v.x, v.z, 12, dt) * 0.5;
    this.pos.x += v.x * dt;
    this.pos.z += v.z * dt;
    this.world.colliders.pushOut(this.pos, RADIUS, HEIGHT, STEP);

    const g = this.world.colliders.ground(this.pos.x, this.pos.z, this.pos.y, STEP, 0.15, this._g);
    if (this.pos.y - g.h > STEP + 0.05 && !(steep)) {
      // 발밑이 꺼짐 → 낙하
      this.coyote = TUNING.coyote;
      v.y = 0;
      this.setState('air');
    } else {
      this.pos.y = g.h;
      v.y = 0;
      this.groundC = g.c;
      this.coyote = TUNING.coyote;
    }
    this.riseUsed = 0;

    if (this.pos.y < WATER - 1.05 && !this.groundC) { this.setState('swim'); return; }

    if (this.jumpBuffer > 0 && this.stumble <= 0) {
      this.jumpBuffer = 0;
      v.y = TUNING.jump;
      this.pos.y += 0.05;
      this.groundC = null;
      this.events.push('jump');
      this.setState('air');
      this.airTime = 0;
    }
    if (ctl && ctl.pressed('skimmer') && this.canSkim) this.mountSkimmer();
  }

  _groundNormal() {
    if (this.groundC) return this.groundN.set(0, 1, 0);
    const e = 1.2, x = this.pos.x, z = this.pos.z, H = this.world.heightAt;
    const hx = H(x + e, z) - H(x - e, z);
    const hz = H(x, z + e) - H(x, z - e);
    return this.groundN.set(-hx, 2 * e, -hz).normalize();
  }

  _air(dt, ctl, wish, wishLen) {
    const v = this.vel;
    this.airTime += dt;
    this.coyote = Math.max(0, this.coyote - dt);
    if (this.jumpBuffer > 0 && this.coyote > 0 && v.y <= 0.5) {
      this.jumpBuffer = 0; v.y = TUNING.jump; this.coyote = 0; this.events.push('jump');
    }
    const gs = this._gravityScale();
    v.y -= G * gs * dt;
    // 공기 저항: 높을수록 공기가 옅어 더 빨리 떨어진다 (해수면 끝속도 ≈ 55 m/s, 30 km ≈ 320 m/s)
    const sp3 = v.length();
    if (sp3 > 20) {
      const k = 0.0063 * airDensity(this.pos.y) * sp3 * dt;
      v.multiplyScalar(1 / (1 + k));
    }
    // 공중 조작
    const maxS = Math.max(TUNING.runSpeed, Math.hypot(v.x, v.z));
    v.x += wish.x * TUNING.airAccel * dt * wishLen;
    v.z += wish.z * TUNING.airAccel * dt * wishLen;
    const sp = Math.hypot(v.x, v.z);
    if (sp > maxS) { v.x *= maxS / sp; v.z *= maxS / sp; }
    this.turn = this._faceToward(v.x, v.z, 6, dt) * 0.3;
    this.pos.addScaledVector(v, dt);
    this._updraft(dt, false);
    this.world.colliders.pushOut(this.pos, RADIUS, HEIGHT, 0.2);
    const ceil = this.world.colliders.ceiling(this.pos.x, this.pos.z, this.pos.y, HEIGHT);
    if (this.pos.y + HEIGHT > ceil && v.y > 0) { this.pos.y = ceil - HEIGHT; v.y = 0; }

    // 활공 펼치기
    if (ctl && this.jumpBuffer > 0 && this.canGlide && this.airTime > 0.12 && this.coyote <= 0) {
      this.jumpBuffer = 0;
      this.startGlide();
      return;
    }
    this._checkLanding(dt);
  }

  _checkLanding() {
    const v = this.vel;
    const g = this.world.colliders.ground(this.pos.x, this.pos.z, this.pos.y, 0.3, 0.15, this._g);
    if (this.pos.y <= g.h && v.y <= 0.01) {
      const fall = -v.y;
      this.pos.y = g.h;
      this.groundC = g.c;
      this.impact = fall;
      if (fall > 26) { this.stumble = 0.55; this.events.push('hardland'); }
      v.y = 0;
      this.events.push('land');
      this.setState('ground');
      return true;
    }
    if (this.pos.y < WATER - 1.0) {
      this.impact = -v.y;
      this.events.push('splash');
      v.y *= 0.2;
      this.setState('swim');
      return true;
    }
    return false;
  }

  startGlide() {
    if (this.indoor) return; // 실내에서는 날개를 펴지 않는다
    const v = this.vel;
    const hs = Math.hypot(v.x, v.z);
    this.glideSpeed = Math.max(11, hs, Math.hypot(hs, v.y) * 0.8);
    this.pitch = Math.max(-0.6, Math.min(0.2, Math.atan2(v.y, Math.max(hs, 1))));
    if (hs > 0.5) this.yaw = Math.atan2(v.x, v.z);
    this.events.push('glideStart');
    this.setState('glide');
  }

  _glide(dt, ctl, wish, wishLen, cam) {
    const v = this.vel;
    const T = TUNING;
    const up = this.upgrades.glide;
    // 비행각: 카메라를 아래로 내려 보면 강하, 위로 올리면 상승(속도를 잃음)
    let target = -0.15 + (cam.pitch + 0.28) * 1.35;
    if (ctl && ctl.move.y < -0.4) target = Math.max(target, 0.35); // 뒤로 당기면 기수 들기
    if (ctl && ctl.isHeld('sprint')) target = Math.min(target, -0.75); // 급강하
    target = Math.max(-1.15, Math.min(0.5, target));
    if (this.glideSpeed < 8) target = Math.min(target, -0.35 * (1 - (this.glideSpeed - 5) / 3)); // 실속
    this.pitch += (target - this.pitch) * Math.min(1, dt * 2.6);
    const gs = this._gravityScale();
    // 높은 곳: 공기가 옅어 저항이 줄고, 최고 속도가 올라간다 (궤도 낙하)
    const rho = airDensity(this.pos.y);
    const vmax = Math.min(620, T.glideMax / Math.sqrt(rho));
    const a = -G * gs * Math.sin(this.pitch) - (T.glideDrag * (1 - up * 0.15) / this.mods.glide) * rho * this.glideSpeed * this.glideSpeed;
    this.glideSpeed = Math.max(T.glideMin, Math.min(vmax, this.glideSpeed + a * dt));
    if (this.glideSpeed > T.glideMax * 1.2 && rho > 0.5) this.glideSpeed -= (this.glideSpeed - T.glideMax) * Math.min(1, dt * 0.6);

    // 방향: 입력 방향으로 선회
    let turn = 0;
    if (wishLen > 0.1) {
      const target = Math.atan2(wish.x, wish.z);
      let d = Math.atan2(Math.sin(target - this.yaw), Math.cos(target - this.yaw));
      const rate = 1.9 * wishLen;
      turn = Math.max(-rate * dt, Math.min(rate * dt, d));
      this.yaw += turn;
    }
    this.turn += ((turn / Math.max(dt, 1e-4)) * 0.45 - this.turn) * Math.min(1, dt * 5);
    const s = this.glideSpeed;
    const cp = Math.cos(this.pitch);
    v.x = Math.sin(this.yaw) * s * cp;
    v.z = Math.cos(this.yaw) * s * cp;
    v.y = s * Math.sin(this.pitch) - T.glideSink * (1 - up * 0.2) * gs;
    this.pos.addScaledVector(v, dt);
    const lift = this._updraft(dt, true);
    if (lift > 0) this.glideSpeed = Math.max(this.glideSpeed, 10);

    const hit = this.world.colliders.pushOut(this.pos, RADIUS + 0.3, 1.0, 0.1);
    if (hit) this.glideSpeed *= 0.94;
    // 천장 (머리 위에 걸친 판은 pushOut 이 옆으로 밀지 않는다 — 여기서 위로 못 오르게)
    const ceil = this.world.colliders.ceiling(this.pos.x, this.pos.z, this.pos.y, HEIGHT);
    if (this.pos.y + HEIGHT > ceil) { this.pos.y = ceil - HEIGHT; if (this.pitch > 0) this.pitch *= 0.5; }

    if (ctl && this.jumpBuffer > 0 && this.stateTime > 0.15) {
      this.jumpBuffer = 0;
      this.events.push('glideEnd');
      this.setState('air');
      return;
    }
    if (ctl && ctl.pressed('skimmer') && this.canSkim) { this.mountSkimmer(); return; }
    this._checkLanding(dt);
  }

  /** 상승 기류: 활공 중이면 강하게, 그냥 공중이면 약하게 떠오름 */
  _updraft(dt, gliding) {
    const lift = this.world.updraftAt ? this.world.updraftAt(this.pos) : 0;
    if (lift > 0) {
      const v = this.vel;
      if (gliding) {
        this._liftV = Math.min(14, (this._liftV || 0) + lift * dt * 1.6);
        this.pos.y += this._liftV * dt;
      } else {
        v.y = Math.min(v.y + lift * 0.9 * dt, 9);
      }
      this.events.push('updraft');
    } else this._liftV = Math.max(0, (this._liftV || 0) - dt * 10);
    if (gliding && this._liftV > 0 && lift <= 0) this.pos.y += this._liftV * dt;
    return lift;
  }

  /** 공명 '솟음' — 공중에서 한 번 더 솟아오름 */
  rise() {
    if (this.state === 'ground') {
      this.vel.y = TUNING.jump * 1.45;
      this.setState('air');
      this.airTime = 0;
      this.groundC = null;
      this.events.push('rise');
      return true;
    }
    if (this.state === 'air' || this.state === 'glide') {
      if (this.riseUsed >= this.riseCharges + this.upgrades.rise) return false;
      this.riseUsed++;
      if (this.state === 'glide') {
        this.pos.y += 0.2;
        this._liftV = 12;
        this.glideSpeed = Math.max(this.glideSpeed, 16);
      } else this.vel.y = Math.max(this.vel.y, 0) + 11;
      this.events.push('rise');
      return true;
    }
    if (this.state === 'skim') { this.vel.y = 12; this._skimAir = true; this.events.push('rise'); return true; }
    return false;
  }

  mountSkimmer() {
    if (this.state === 'skim' || this.indoor) return;
    const hs = Math.hypot(this.vel.x, this.vel.z);
    this.skimSpeed = Math.max(hs, this.state === 'glide' ? this.glideSpeed * 0.9 : 0);
    if (this.state === 'glide' || this.state === 'air') this._skimAir = true;
    else this._skimAir = false;
    this.events.push('skimOn');
    this.setState('skim');
  }

  _skim(dt, ctl, wish, wishLen) {
    const v = this.vel;
    const T = TUNING;
    this._carry(dt);
    const boost = ctl && ctl.isHeld('sprint');
    const maxS = (boost ? T.skimBoost : T.skimMax) * (1 + this.upgrades.skim * 0.12);
    // 조향: 원하는 방향으로 회전 (빠를수록 크게 돈다)
    let turn = 0;
    if (wishLen > 0.1) {
      const target = Math.atan2(wish.x, wish.z);
      let d = Math.atan2(Math.sin(target - this.yaw), Math.cos(target - this.yaw));
      if (Math.abs(d) > 2.6 && this.skimSpeed > 6) {
        // 반대 방향: 브레이크
        this.skimSpeed = Math.max(0, this.skimSpeed - 30 * dt);
      } else {
        const rate = 3.0 / (1 + this.skimSpeed / 22);
        turn = Math.max(-rate * dt, Math.min(rate * dt, d));
        this.yaw += turn;
        this.skimSpeed += T.skimAccel * (boost ? 1.6 : 1) * wishLen * Math.max(0, Math.cos(d)) * dt;
      }
    }
    this.turn += ((turn / Math.max(dt, 1e-4)) * 0.4 - this.turn) * Math.min(1, dt * 6);
    // 경사: 내리막 가속, 오르막 감속
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const H = this.world.heightAt;
    const h0 = Math.max(H(this.pos.x, this.pos.z), WATER);
    const h1 = Math.max(H(this.pos.x + fx * 2, this.pos.z + fz * 2), WATER);
    const slope = (h1 - h0) / 2;
    if (!this._skimAir) this.skimSpeed -= G * Math.max(-0.9, Math.min(0.9, slope)) * 0.85 * dt;
    this.skimSpeed -= (0.004 * this.skimSpeed * this.skimSpeed + (wishLen < 0.1 ? 2.5 : 0.4)) * dt;
    if (slope > 0.8 && !this._skimAir) this.skimSpeed = Math.min(this.skimSpeed, 4);
    this.skimSpeed = Math.max(0, Math.min(maxS + 4, this.skimSpeed));

    v.x = fx * this.skimSpeed;
    v.z = fz * this.skimSpeed;
    this.pos.x += v.x * dt;
    this.pos.z += v.z * dt;
    const hit = this.world.colliders.pushOut(this.pos, RADIUS + 0.25, HEIGHT, STEP);
    if (hit) {
      const into = -(fx * hit.x + fz * hit.z);
      if (into > 0.5 && this.skimSpeed > 15) this.events.push('bump');
      this.skimSpeed *= 1 - Math.max(0, into) * 0.6;
    }

    // 높이: 지면을 따라 뜨거나, 낭떠러지에서는 날아오름
    const g = this.world.colliders.ground(this.pos.x, this.pos.z, this.pos.y + 0.6, STEP + 0.6, 0.2, this._g);
    const surf = Math.max(g.h, WATER);
    const hover = surf + 0.45;
    if (this._skimAir) {
      v.y -= G * this._gravityScale() * dt;
      this.pos.y += v.y * dt;
      if (this.pos.y <= hover) {
        this.pos.y = hover;
        if (-v.y > 8) this.events.push('land');
        this.impact = -v.y;
        v.y = 0;
        this._skimAir = false;
      }
      if (ctl && this.jumpBuffer > 0 && this.canGlide) {
        this.jumpBuffer = 0;
        this.vel.y = Math.max(v.y, 2);
        this.startGlide();
        this.glideSpeed = Math.max(this.glideSpeed, this.skimSpeed * 0.95);
        return;
      }
    } else {
      const drop = this.pos.y - hover;
      if (drop > 1.4 && this.skimSpeed > 8) {
        // 지면이 갑자기 꺼짐 → 공중으로
        this._skimAir = true;
        v.y = Math.max(0, slope) * this.skimSpeed * 0.5;
      } else {
        const ny = this.pos.y + (hover - this.pos.y) * Math.min(1, dt * 14);
        v.y = (ny - this.pos.y) / Math.max(dt, 1e-4);
        this.pos.y = ny;
      }
      this.groundC = g.c;
      if (ctl && this.jumpBuffer > 0) {
        this.jumpBuffer = 0;
        v.y = 9.5;
        this._skimAir = true;
        this.events.push('jump');
      }
    }
    this.riseUsed = this._skimAir ? this.riseUsed : 0;
    if (ctl && ctl.pressed('skimmer')) {
      this.events.push('skimOff');
      if (this._skimAir) { this.setState('air'); this.airTime = 1; }
      else { this.pos.y = g.h; this.setState(this.pos.y < WATER - 1 ? 'swim' : 'ground'); }
    }
  }

  _swim(dt, ctl, wish, wishLen) {
    const v = this.vel;
    const target = WATER - 1.15;
    const sp = TUNING.swimSpeed * wishLen;
    v.x += (wish.x * sp - v.x) * Math.min(1, dt * 3);
    v.z += (wish.z * sp - v.z) * Math.min(1, dt * 3);
    this.turn = this._faceToward(v.x, v.z, 5, dt) * 0.3;
    this.pos.x += v.x * dt;
    this.pos.z += v.z * dt;
    v.y += (target - this.pos.y) * 8 * dt - v.y * 4 * dt;
    this.pos.y += v.y * dt;
    this.world.colliders.pushOut(this.pos, RADIUS, HEIGHT, STEP);
    const g = this.world.colliders.ground(this.pos.x, this.pos.z, this.pos.y + 1, STEP + 1, 0.15, this._g);
    if (g.h > this.pos.y - 0.05) {
      this.pos.y = g.h;
      if (g.h > WATER - 1.0) { this.setState('ground'); return; }
    }
    if (ctl && this.jumpBuffer > 0) {
      this.jumpBuffer = 0;
      v.y = TUNING.jump * 0.9;
      this.pos.y = Math.max(this.pos.y, WATER - 0.6);
      this.setState('air');
      this.airTime = 0;
    }
    if (ctl && ctl.pressed('skimmer') && this.canSkim) { this.pos.y = WATER + 0.45; this.mountSkimmer(); }
  }

  /** 해류에 올라탐 — currents 시스템이 매 프레임 위치를 정해 준다 */
  enterCurrent(cur) {
    this.current = cur;
    this.events.push('currentIn');
    this.setState('current');
  }

  _current(dt, ctl, wish, wishLen) {
    const cur = this.current;
    if (!cur) { this.setState('air'); return; }
    const res = cur.carry(this, dt, ctl ? wish : null, wishLen);
    this.turn = res.turn || 0;
    if (res.done || (ctl && this.jumpBuffer > 0 && this.stateTime > 0.3)) {
      this.jumpBuffer = 0;
      this.current = null;
      this.events.push('currentOut');
      this.vel.copy(res.exitVel);
      if (this.canGlide) this.startGlide(); else this.setState('air');
      this.glideSpeed = Math.max(this.glideSpeed, Math.hypot(res.exitVel.x, res.exitVel.z) * 0.8);
    }
  }

  /** 탈것(빛길 캡슐 등)에 실려 감 — ride.step(dt, player) 이 위치를 정한다 */
  enterRide(ride) {
    this.ride = ride;
    this.current = null;
    this.events.push('rideIn');
    this.setState('ride');
  }

  _ride(dt) {
    const r = this.ride;
    if (!r) { this.setState('air'); return; }
    r.step(dt, this);
    if (r.done) {
      this.ride = null;
      this.vel.set(0, 0, 0);
      this.events.push('rideOut');
      this.setState('ground');
    }
  }

  /** 빌린 나룻배로 날기 — 카메라가 보는 쪽으로, 위를 보면 오르고 아래를 보면 내려간다 */
  startFly() {
    this.flySpeed = Math.hypot(this.vel.x, this.vel.z);
    this.flyVy = 0;
    this.current = null;
    this.events.push('flyOn');
    this.setState('fly');
  }

  stopFly() {
    if (this.state !== 'fly') return;
    this.events.push('flyOff');
    const above = this.pos.y - this._groundBelow();
    if (above < 1.6) { this.vel.set(0, 0, 0); this.setState(this.pos.y < WATER - 1 ? 'swim' : 'ground'); }
    else { this.setState('air'); this.airTime = 0.3; this.riseUsed = 0; }
  }

  _fly(dt, ctl, wish, wishLen, cam) {
    const v = this.vel;
    const boost = ctl && ctl.isHeld('sprint');
    const vmax = boost ? 115 : 62;
    const target = wishLen * vmax;
    const acc = target > this.flySpeed ? (boost ? 36 : 24) : 30;
    this.flySpeed += Math.max(-acc * dt, Math.min(acc * dt, target - this.flySpeed));
    let turn = 0;
    if (wishLen > 0.1) {
      const tgt = Math.atan2(wish.x, wish.z);
      const d = Math.atan2(Math.sin(tgt - this.yaw), Math.cos(tgt - this.yaw));
      const rate = 1.5 + 1.4 * (1 - Math.min(1, this.flySpeed / 90));
      turn = Math.max(-rate * dt, Math.min(rate * dt, d));
      this.yaw += turn;
    }
    this.turn += ((turn / Math.max(dt, 1e-4)) * 0.45 - this.turn) * Math.min(1, dt * 5);
    // 높이: 시선의 기울기 + Space 로 곧장 오르기
    const climb = Math.max(-0.8, Math.min(0.8, (cam.pitch + 0.22) * 1.7));
    let vy = this.flySpeed * climb * 0.85;
    if (ctl && ctl.isHeld('jump')) vy = Math.max(vy, 16);
    const ceil = 5200; // 공기가 옅어 고리가 더 밀어내지 못한다
    if (this.pos.y > ceil - 400) vy = Math.min(vy, (ceil - this.pos.y) * 0.5);
    this.flyVy += (vy - this.flyVy) * Math.min(1, dt * 3);
    v.set(Math.sin(this.yaw) * this.flySpeed, this.flyVy, Math.cos(this.yaw) * this.flySpeed);
    this.pos.addScaledVector(v, dt);
    const hit = this.world.colliders.pushOut(this.pos, RADIUS + 1.1, 1.2, 0.1);
    if (hit && this.flySpeed > 20) { this.flySpeed *= 0.6; this.events.push('bump'); }
    // 땅과 물 위로 떠 있기
    const g = this.world.colliders.ground(this.pos.x, this.pos.z, this.pos.y + 1.0, 1.0, 0.05, this._g);
    const floor = Math.max(g.h, WATER) + 1.0;
    if (this.pos.y < floor) { this.pos.y += (floor - this.pos.y) * Math.min(1, dt * 12); if (this.flyVy < 0) this.flyVy = 0; }
  }

  /** 공명 승강 기둥: 아래에서 위로 실어 올림 */
  enterLift(lift) {
    this.lift = lift;
    this.events.push('liftIn');
    this.setState('lift');
  }

  _lift(dt, ctl, wish) {
    const L = this.lift;
    if (!L) { this.setState('air'); return; }
    const v = this.vel;
    const top = L.top;
    if (this.pos.y < top) {
      // 남은 높이에 맞춰 부드럽게 늦추되 초속 4 m 아래로는 늦추지 않는다
      // (전에는 92 % 위에서 매 프레임 0.7 을 곱해 초속 1 m 남짓으로 기어올라, 꼭대기 앞에서 멈춘 것처럼 보였다)
      const want = Math.min(34, Math.max(4, (top - this.pos.y) * 1.4));
      v.y += Math.max(-30 * dt, Math.min(30 * dt, want - v.y));
      v.x = 0; v.z = 0;
      this.pos.x += (L.x - this.pos.x) * Math.min(1, dt * 2);
      this.pos.z += (L.z - this.pos.z) * Math.min(1, dt * 2);
      this.pos.y = Math.min(top, this.pos.y + v.y * dt);
      if (this.pos.y >= top && !L.topPos) this._liftRelease(L);
      return;
    }
    // 꼭대기: 고원 안쪽 착지점까지 실어 나름
    const tx = L.topPos[0], tz = L.topPos[1];
    const dx = tx - this.pos.x, dz = tz - this.pos.z;
    const d = Math.hypot(dx, dz);
    const sp = Math.min(26, 6 + d);
    if (d < 2) { this._liftRelease(L); return; }
    v.set((dx / d) * sp, 0, (dz / d) * sp);
    this.pos.x += v.x * dt; this.pos.z += v.z * dt;
    this.pos.y = top + Math.sin(Math.min(1, d / 60) * Math.PI) * 4;
    this.yaw = Math.atan2(dx, dz);
  }

  _liftRelease(L) {
    this.lift = null;
    this.vel.set(L.exit[0] * 5, 5, L.exit[1] * 5);
    this.yaw = Math.atan2(L.exit[0], L.exit[1]);
    this.events.push('liftOut');
    this.setState('air');
    this.airTime = 0.5;
  }
}
