// Character controller for Nuri (Rapier kinematic character controller).
// Responsive platforming: acceleration curves, air control, variable jump height, jump buffer, coyote time,
// double jump + hover (after the booster upgrade), roll, slide, crawl, swim, vine climbing, ledge grab,
// pushing/pulling crates, carrying/throwing items, moving-platform riding.
import * as THREE from 'three';
import { clamp, damp, dampAngle, angleDiff, lerp } from './util.js';

const R_CAP = 0.095, HH_STAND = 0.085, HH_CROUCH = 0.012;
const G = 15.5, JUMP_V = 3.75, DJUMP_V = 3.3;
// speeds sized for a 35 cm robot with ~10 cm legs (a brisk jog is ~1.4 m/s at this scale, a walk ~0.55 m/s)
export const RUN = 1.4;
const WALK = 0.55, CRAWL = 0.3, SWIM = 0.65, CLIMB = 0.45, PUSH = 0.55, ROLL0 = 2.0, ROLL1 = 0.95;
const SWIM_DEPTH = 0.3; // deeper than this the robot floats and swims; shallower it wades on the bottom

export class Player {
  constructor(ctx, nuri, spawn) {
    this.ctx = ctx; this.nuri = nuri;
    const R = ctx.RAPIER, W = ctx.physics;
    this.body = W.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(spawn.x, spawn.y + R_CAP + HH_STAND, spawn.z));
    this.col = W.createCollider(R.ColliderDesc.capsule(HH_STAND, R_CAP).setFriction(0), this.body);
    this.col.userData = { kind: 'player' };
    this.cc = W.createCharacterController(0.012);
    this.cc.enableAutostep(0.085, 0.04, false);
    this.cc.enableSnapToGround(0.07);
    this.cc.setMaxSlopeClimbAngle(52 * Math.PI / 180);
    this.cc.setMinSlopeSlideAngle(58 * Math.PI / 180);
    this.cc.setApplyImpulsesToDynamicBodies(true);
    this.cc.setCharacterMass(2.5);
    this.cc.setSlideEnabled(true);
    this.pos = new THREE.Vector3(spawn.x, spawn.y, spawn.z); // feet position
    this.vel = new THREE.Vector3();
    this.yaw = spawn.yaw || 0; this.state = 'idle'; this.grounded = true;
    this.lastGround = 0; this.jumpBuf = -1; this.time = 0; this.jumpsUsed = 0; this.jumpCut = false;
    this.abilities = { booster: false, dash: false };
    this.hoverT = 0; this.rollT = 0; this.slideT = 0; this.landK = 0; this.actT = 0; this.act = null;
    this.crouched = false; this.hangInfo = null; this.climbInfo = null; this.climbT = 0;
    this.carry = null; this.grab = null; this.pushBody = null; this.pushT = 0;
    this.platform = null; this.platformPrev = new THREE.Vector3();
    this.idleT = 0; this.events = [];
    this.checkpoint = { x: spawn.x, y: spawn.y, z: spawn.z, yaw: this.yaw };
    this.stepPhase = 0;
    this.excludePredicate = (c) => !c.isSensor() && c.userData?.kind !== 'item-held';
  }

  emit(type, data = {}) { this.events.push({ type, ...data }); }

  setCrouch(on) {
    if (on === this.crouched) return true;
    if (!on) { // standing up needs head room
      const W = this.ctx.physics, R = this.ctx.RAPIER;
      const shape = new R.Capsule(HH_STAND, R_CAP * 0.92);
      let blocked = false;
      W.intersectionsWithShape({ x: this.pos.x, y: this.pos.y + R_CAP + HH_STAND + 0.01, z: this.pos.z }, { x: 0, y: 0, z: 0, w: 1 }, shape,
        (c) => { if (c.handle !== this.col.handle && !c.isSensor() && c.userData?.kind !== 'item-held') { blocked = true; return false; } return true; });
      if (blocked) return false;
    }
    this.crouched = on;
    this.col.setHalfHeight(on ? HH_CROUCH : HH_STAND);
    return true;
  }
  halfH() { return R_CAP + (this.crouched ? HH_CROUCH : HH_STAND); }

  ray(o, d, max, solidOnly = true) {
    const R = this.ctx.RAPIER;
    const hit = this.ctx.physics.castRayAndGetNormal(new R.Ray(o, d), max, true, undefined, undefined, this.col, this.body,
      (c) => !c.isSensor() && c.userData?.kind !== 'item-held' && (!solidOnly || c.userData?.kind !== 'item'));
    return hit ? { toi: hit.timeOfImpact, normal: hit.normal, collider: hit.collider } : null;
  }

  // world-space move direction from input relative to camera yaw
  moveDir(input, camYaw) {
    const m = input.getMove();
    const mag = Math.min(1, Math.hypot(m.x, m.y));
    if (mag < 0.05) return { dir: new THREE.Vector3(), mag: 0 };
    const sx = Math.sin(camYaw), cx = Math.cos(camYaw);
    // camera looks along (-sin yaw, -cos yaw) on xz
    const fwd = new THREE.Vector3(-sx, 0, -cx), right = new THREE.Vector3(cx, 0, -sx);
    const d = fwd.multiplyScalar(m.y).add(right.multiplyScalar(m.x)).normalize();
    return { dir: d, mag };
  }

  update(dt, input, camYaw, gameplay) {
    this.time += dt;
    const { dir, mag } = this.moveDir(input, camYaw);
    const jumpPressed = input.wasPressed('jump'), jumpHeld = input.btn.jump;
    const crouchPressed = input.wasPressed('crouch'), crouchHeld = input.btn.crouch;
    if (jumpPressed) this.jumpBuf = this.time;
    const terrain = this.ctx.terrain, waterY = terrain.waterY;
    const prevGround = this.grounded;
    let desired = new THREE.Vector3();
    const hv = new THREE.Vector3(this.vel.x, 0, this.vel.z);
    let speed = hv.length();
    let st = this.state;
    if (mag > 0.05 || jumpPressed) this.idleT = 0; else this.idleT += dt;
    // failsafe: a body that ends up inside geometry (log, rock, a platform moving into it) is lifted out to the
    // nearest free spot instead of staying wedged
    if (st !== 'climbup' && st !== 'climb') {
      this.stuckT = this.overlapping() ? (this.stuckT || 0) + dt : 0;
      if (this.stuckT > 0.2) { this.stuckT = 0; if (this.unstick()) st = this.state; }
    }

    // ---- timed action overlays
    if (this.act) { this.actT += dt / this.act.dur; if (this.actT >= 1) { this.act = null; this.actT = 0; } }

    // ---- special states ---------------------------------------------------------------
    if (st === 'hang') return this.updateHang(dt, input, dir, mag, jumpPressed, crouchPressed);
    if (st === 'climbup') return this.updateClimbUp(dt);
    if (st === 'climb') return this.updateClimb(dt, input, dir, mag, jumpPressed, camYaw);

    // swimming check
    const depthHere = waterY - terrain.heightAt(this.pos.x, this.pos.z);
    this.wadeDepth = terrain.isWater(this.pos.x, this.pos.z) ? Math.max(0, waterY - this.pos.y) : 0;
    const inWater = depthHere > SWIM_DEPTH && this.pos.y < waterY - 0.2;
    if (inWater && st !== 'swim') { this.state = 'swim'; this.vel.y *= 0.3; this.emit('splash', { strength: Math.min(1, Math.abs(this.vel.y) / 4 + 0.3) }); this.setCrouch(false); if (this.carry) gameplay.dropCarry(this); }
    if (this.state === 'swim') return this.updateSwim(dt, dir, mag, jumpPressed, waterY);

    // ---- ground / air movement
    const grounded = this.grounded;
    if (grounded) { this.lastGround = this.time; this.jumpsUsed = 0; this.hoverT = 0; }
    const coyote = this.time - this.lastGround < 0.11;

    // roll / slide / crawl
    if (grounded && crouchPressed && !this.carry && !this.grab) {
      if (speed > RUN * 0.75) { this.state = 'slide'; this.slideT = 0.55; this.setCrouch(true); this.emit('slide'); }
      else if (mag > 0.3) { this.state = 'roll'; this.rollT = 0; this.setCrouch(true); this.vel.x = dir.x * ROLL0; this.vel.z = dir.z * ROLL0; this.yaw = Math.atan2(dir.x, dir.z); this.emit('roll'); }
    }
    if (this.state === 'roll') {
      this.rollT += dt / 0.42;
      const f = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      const sp = lerp(ROLL0, ROLL1, this.rollT);
      this.vel.x = f.x * sp; this.vel.z = f.z * sp;
      if (this.rollT >= 1) { this.state = 'move'; if (!crouchHeld) this.setCrouch(false); }
    } else if (this.state === 'slide') {
      this.slideT -= dt;
      const n = terrain.normalAt(this.pos.x, this.pos.z);
      this.vel.x += n.x * 9 * dt; this.vel.z += n.z * 9 * dt;
      const k = Math.exp(-1.8 * dt); this.vel.x *= k; this.vel.z *= k;
      if (dir.lengthSq() > 0) { this.vel.x += dir.x * 2 * dt; this.vel.z += dir.z * 2 * dt; }
      if (this.slideT <= 0 || Math.hypot(this.vel.x, this.vel.z) < 0.3) { this.state = crouchHeld ? 'crawl' : 'move'; if (!crouchHeld) this.setCrouch(false); }
    } else {
      // crawl when crouch held & slow (or forced by low ceiling)
      if (grounded && crouchHeld && !this.carry) this.setCrouch(true);
      else if (this.crouched && !crouchHeld) this.setCrouch(false);
      const crawling = this.crouched && grounded;
      let maxSp = crawling ? CRAWL : (input.btn.walk ? WALK : RUN);
      // keep the take-off speed of a jump through the air (no drag back down to run speed mid-jump)
      if (grounded) this.airMax = 0; else maxSp = Math.max(maxSp, this.airMax || 0);
      if (this.carry) maxSp *= 0.8;
      if (this.wadeDepth > 0.02) maxSp *= 1 - 0.45 * Math.min(1, this.wadeDepth / 0.3);
      if (this.grab) maxSp = PUSH * 0.8;
      if (this.pushBody) maxSp = PUSH;
      const target = dir.clone().multiplyScalar(maxSp * mag);
      const accel = grounded ? (target.lengthSq() > hv.lengthSq() ? 16 : 20) : 7.5;
      // sharp turns: brake faster for snappy direction changes
      const turning = hv.lengthSq() > 0.25 && target.lengthSq() > 0.1 && hv.clone().normalize().dot(target.clone().normalize()) < -0.2;
      const a = turning && grounded ? 30 : accel;
      hv.x = damp(hv.x, target.x, a * 0.6, dt) + clamp(target.x - hv.x, -a * dt, a * dt) * 0.4;
      hv.z = damp(hv.z, target.z, a * 0.6, dt) + clamp(target.z - hv.z, -a * dt, a * dt) * 0.4;
      this.vel.x = hv.x; this.vel.z = hv.z;
      if (crawling) this.state = 'crawl';
    }

    // facing
    if (this.grab) {
      const toB = this.grab.dirToBody;
      this.yaw = dampAngle(this.yaw, Math.atan2(toB.x, toB.z), 12, dt);
    } else if (mag > 0.05 && this.state !== 'roll') {
      const tyaw = Math.atan2(dir.x, dir.z);
      this.turnRate = angleDiff(this.yaw, tyaw);
      this.yaw = dampAngle(this.yaw, tyaw, grounded ? 14 : 6, dt);
    } else this.turnRate = 0;

    // jumping
    const canJump = !this.carry || true;
    if (this.time - this.jumpBuf < 0.13 && canJump && !this.grab) {
      if ((grounded || coyote) && this.jumpsUsed === 0 && this.state !== 'swim') {
        if (this.crouched) this.setCrouch(false);
        if (!this.crouched) {
          this.vel.y = JUMP_V; this.jumpsUsed = 1; this.jumpBuf = -1; this.jumpCut = false; this.lastGround = -1;
          // a little forward push off the ground so running jumps still clear small gaps at the robot's slower pace
          if (mag > 0.3 && !this.carry) { const sp = Math.max(speed, 1.6 * mag); this.vel.x = dir.x * sp; this.vel.z = dir.z * sp; }
          this.airMax = Math.hypot(this.vel.x, this.vel.z);
          this.state = 'jump'; this.emit('jump');
          if (this.platformVel) { this.vel.x += this.platformVel.x; this.vel.z += this.platformVel.z; this.vel.y += Math.max(0, this.platformVel.y); }
        }
      } else if (!grounded && !coyote && this.abilities.booster && this.jumpsUsed < 2 && jumpPressed) {
        this.vel.y = DJUMP_V; this.jumpsUsed = 2; this.jumpBuf = -1; this.jumpCut = true; this.state = 'djump'; this.djT = 0.35;
        if (mag > 0.1) { this.vel.x = dir.x * Math.max(speed, 1.5); this.vel.z = dir.z * Math.max(speed, 1.5); }
        this.airMax = Math.max(this.airMax || 0, Math.hypot(this.vel.x, this.vel.z));
        this.emit('djump');
      }
    }
    // air dash (milestone reward): the crouch button in the air bursts forward once per jump
    if (grounded) this.dashUsed = false;
    else if (crouchPressed && this.abilities.dash && !this.dashUsed && !this.carry && !['swim', 'climb', 'hang', 'climbup'].includes(this.state)) {
      const f = mag > 0.1 ? dir : new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      this.vel.x = f.x * 3.3; this.vel.z = f.z * 3.3; this.vel.y = Math.max(this.vel.y, 0.9);
      this.airMax = 3.3; this.dashUsed = true; this.jumpCut = true; this.state = 'djump'; this.djT = 0.25;
      this.yaw = Math.atan2(f.x, f.z); this.emit('dash');
    }
    // variable jump height
    if (!grounded && this.vel.y > 0 && !jumpHeld && !this.jumpCut && this.jumpsUsed === 1) { this.vel.y *= 0.5; this.jumpCut = true; }
    // gravity / hover
    if (!grounded) {
      let g = G;
      if (this.vel.y < 0) g *= 1.25; // snappier falls
      this.vel.y -= g * dt;
      if (this.abilities.booster && jumpHeld && this.jumpsUsed >= 2 && this.vel.y < 0 && this.hoverT < 1.4) {
        this.vel.y = Math.max(this.vel.y, -0.35); this.hoverT += dt; this.state = 'hover';
      }
      this.vel.y = Math.max(this.vel.y, -14);
    } else if (this.vel.y < 0) this.vel.y = -0.5;
    if (this.djT > 0) this.djT -= dt;

    // ---- pushing crates
    this.pushBody = null;
    if (this.grab) {
      gameplay.updateGrab(this, dt);
    }

    // ---- integrate with the character controller
    desired.set(this.vel.x * dt, this.vel.y * dt, this.vel.z * dt);
    // moving platform carry
    this.platformVel = null;
    if (this.platform && grounded) {
      const t = this.platform.translation();
      const d = new THREE.Vector3(t.x - this.platformPrev.x, t.y - this.platformPrev.y, t.z - this.platformPrev.z);
      if (d.lengthSq() < 0.25) { desired.add(d); this.platformVel = d.clone().divideScalar(Math.max(dt, 1e-4)); }
    }
    this.cc.computeColliderMovement(this.col, desired, this.ctx.RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, (c) => c.userData?.kind !== 'item-held');
    const mv = this.cc.computedMovement();
    const t = this.body.translation();
    const next = { x: t.x + mv.x, y: t.y + mv.y, z: t.z + mv.z };
    this.body.setNextKinematicTranslation(next);
    this.grounded = this.cc.computedGrounded();
    // collisions: ceilings, walls, pushables
    let hitCeil = false;
    for (let i = 0; i < this.cc.numComputedCollisions(); i++) {
      const c = this.cc.computedCollision(i); if (!c) continue;
      const n = c.normal1;
      if (n.y < -0.6 && this.vel.y > 0) hitCeil = true;
      const body = c.collider?.parent();
      const ud = c.collider?.userData;
      if (ud?.kind === 'crate' && this.grounded && Math.abs(n.y) < 0.5 && mag > 0.3) {
        const pushDir = new THREE.Vector3(-n.x, 0, -n.z).normalize();
        if (pushDir.dot(dir) > 0.6) { this.pushBody = body; gameplay.pushCrate(body, dir, PUSH); }
      }
    }
    if (hitCeil) this.vel.y = Math.min(this.vel.y, 0);
    // horizontal velocity correction when blocked (prevents sticking to walls)
    if (dt > 0) {
      const ax = mv.x / dt, az = mv.z / dt;
      if (Math.abs(ax) < Math.abs(this.vel.x) * 0.5) this.vel.x = ax;
      if (Math.abs(az) < Math.abs(this.vel.z) * 0.5) this.vel.z = az;
    }
    this.pos.set(next.x, next.y - this.halfH(), next.z);

    // detect platform under feet
    const down = this.ray({ x: this.pos.x, y: this.pos.y + 0.05, z: this.pos.z }, { x: 0, y: -1, z: 0 }, 0.2);
    const pb = down?.collider?.parent();
    if (pb && pb.isKinematic && pb.isKinematic() && pb.userData?.platform) {
      if (this.platform !== pb) this.platform = pb;
      const pt = pb.translation(); this.platformPrev.set(pt.x, pt.y, pt.z);
    } else this.platform = null;
    this.groundCollider = down?.collider || null;
    this.groundDist = down ? down.toi - 0.05 : 1;

    // landing
    if (this.grounded && !prevGround) {
      const impact = -this.fallVy || 0;
      this.landK = clamp(impact / 7, 0.25, 1);
      this.emit('land', { impact });
      if (this.state !== 'roll' && this.state !== 'slide') this.state = 'land';
      this.landT = 0.16 + 0.1 * this.landK;
    }
    this.fallVy = this.vel.y;
    if (!this.grounded) {
      if (!['jump', 'djump', 'hover', 'roll'].includes(this.state) || (this.state === 'jump' && this.vel.y < -0.5) || (this.state === 'djump' && this.djT <= 0)) {
        if (this.state !== 'hover' || !jumpHeld) this.state = 'fall';
      }
      // ledge grab while falling
      if (this.vel.y < 0.5 && !this.carry) this.tryLedge(dir);
      if (!this.carry) gameplay.tryClimbStart(this, dir, mag, false);
    } else if (!['roll', 'slide', 'crawl'].includes(this.state)) {
      if (this.state === 'land' && (this.landT -= dt) > 0 && speed < 0.4) { /* keep */ }
      else {
        this.state = speed > 0.12 || mag > 0.05 ? (this.pushBody || this.grab ? 'push' : 'move') : 'idle';
        if (this.state === 'idle' && this.idleT > 22) this.state = 'sleep';
      }
      if (this.grounded && mag > 0.3) gameplay.tryClimbStart(this, dir, mag, true);
    }
    // footsteps from the gait phase
    if (this.grounded && ['move', 'push', 'crawl'].includes(this.state)) {
      const ph = this.nuri.phase;
      const step = Math.floor(ph * 2);
      if (step !== this.stepPhase) { this.stepPhase = step; this.emit('step', { speed }); }
    }
    // fell out of the world
    if (this.pos.y < -8) this.respawn();
  }

  tryLedge(dir) {
    const f = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    if (dir.lengthSq() > 0 && dir.dot(f) < 0.3) return;
    const chest = { x: this.pos.x, y: this.pos.y + 0.3, z: this.pos.z };
    const wall = this.ray(chest, { x: f.x, y: 0, z: f.z }, 0.28);
    if (!wall || Math.abs(wall.normal.y) > 0.5) return;
    const top0 = { x: this.pos.x + f.x * (wall.toi + 0.09), y: this.pos.y + 0.66, z: this.pos.z + f.z * (wall.toi + 0.09) };
    const top = this.ray(top0, { x: 0, y: -1, z: 0 }, 0.42);
    if (!top || top.normal.y < 0.75) return;
    const ledgeY = top0.y - top.toi;
    if (ledgeY - this.pos.y < 0.3 || ledgeY - this.pos.y > 0.62) return;
    // head room on top
    const clear = this.ray({ x: top0.x, y: ledgeY + 0.02, z: top0.z }, { x: 0, y: 1, z: 0 }, 0.36);
    if (clear) return;
    const wn = new THREE.Vector3(wall.normal.x, 0, wall.normal.z).normalize();
    this.hangInfo = { ledgeY, wallN: wn, top: new THREE.Vector3(top0.x, ledgeY, top0.z) };
    this.state = 'hang'; this.vel.set(0, 0, 0); this.yaw = Math.atan2(-wn.x, -wn.z);
    const hx = chest.x + f.x * (wall.toi - 0.105), hz = chest.z + f.z * (wall.toi - 0.105);
    this.teleport(hx, ledgeY - 0.36, hz);
    this.emit('grab');
  }

  updateHang(dt, input, dir, mag, jumpPressed, crouchPressed) {
    const h = this.hangInfo;
    const toward = mag > 0.3 ? dir.dot(h.wallN.clone().negate()) : 0;
    if (jumpPressed || toward > 0.6) { this.state = 'climbup'; this.climbT = 0; this.climbFrom = this.pos.clone(); this.emit('climbup'); return; }
    if (crouchPressed || toward < -0.6) { this.state = 'fall'; this.hangInfo = null; this.vel.set(h.wallN.x * 0.8, 0, h.wallN.z * 0.8); this.lastGround = -1; return; }
    // shimmy left/right along the ledge
    if (mag > 0.3 && Math.abs(toward) < 0.6) {
      const side = new THREE.Vector3(-h.wallN.z, 0, h.wallN.x);
      const s = Math.sign(dir.dot(side)) * 0.35 * dt;
      const nx = this.pos.x + side.x * s, nz = this.pos.z + side.z * s;
      const probe = this.ray({ x: nx - h.wallN.x * 0.2, y: h.ledgeY + 0.15, z: nz - h.wallN.z * 0.2 }, { x: 0, y: -1, z: 0 }, 0.3);
      if (probe && Math.abs(h.ledgeY + 0.15 - probe.toi - h.ledgeY) < 0.08) { this.teleport(nx, this.pos.y, nz); h.top.x += side.x * s; h.top.z += side.z * s; this.shimmy = s; }
    }
    this.nuriParams = null;
  }

  updateClimbUp(dt) {
    this.climbT += dt / 0.45;
    const h = this.hangInfo;
    const t = Math.min(1, this.climbT);
    if (!h.target) {
      // ledge climb: settle on a free spot just past the edge (round tops can't take the whole body at the very rim)
      let tx = h.top.x - h.wallN.x * 0.08, tz = h.top.z - h.wallN.z * 0.08, ty = h.ledgeY;
      for (const k of [0, 0.06, 0.12, -0.04]) {
        const x = tx - h.wallN.x * k, z = tz - h.wallN.z * k, y = this.standAt(x, z, h.ledgeY + 0.4);
        if (y !== null) { tx = x; tz = z; ty = y; break; }
      }
      h.target = new THREE.Vector3(tx, ty, tz);
    }
    const target = new THREE.Vector3(h.target.x, h.target.y + 0.01, h.target.z);
    const p = this.climbFrom.clone();
    // up first, then over the edge
    const up = Math.min(1, t / 0.6), over = Math.max(0, (t - 0.45) / 0.55);
    p.y = lerp(this.climbFrom.y, target.y + 0.04, up * up * (3 - 2 * up));
    p.x = lerp(this.climbFrom.x, target.x, over); p.z = lerp(this.climbFrom.z, target.z, over);
    this.teleport(p.x, p.y, p.z);
    if (t >= 1) {
      // never finish inside something: rise to the first free height, or fall back to where we started
      let y = p.y, ok = !this.blocked(p.x, y, p.z);
      for (let i = 1; !ok && i <= 12; i++) { y = p.y + i * 0.025; ok = !this.blocked(p.x, y, p.z); }
      if (ok) this.teleport(p.x, y, p.z); else this.teleport(this.climbFrom.x, this.climbFrom.y, this.climbFrom.z);
      this.state = ok ? 'idle' : 'fall'; this.hangInfo = null; this.vel.set(0, 0, 0); this.grounded = ok;
    }
  }

  updateClimb(dt, input, dir, mag, jumpPressed, camYaw) {
    const c = this.climbInfo;
    const m = input.getMove();
    // input in wall plane: up = stick forward, side = stick right relative to the wall
    const right = new THREE.Vector3(-c.normal.z, 0, c.normal.x).negate();
    const camRight = new THREE.Vector3(Math.cos(camYaw), 0, -Math.sin(camYaw));
    const sideSign = camRight.dot(right) >= 0 ? 1 : -1;
    const vx = m.x * sideSign * CLIMB, vy = m.y * CLIMB;
    this.climbSpeed = Math.hypot(vx, vy);
    if (jumpPressed) {
      this.state = 'jump'; this.climbInfo = null;
      this.vel.set(c.normal.x * 1.8, JUMP_V * 0.85, c.normal.z * 1.8); this.jumpsUsed = 1; this.yaw = Math.atan2(c.normal.x, c.normal.z);
      this.emit('jump'); return;
    }
    const nx = this.pos.x + right.x * vx * dt, nz = this.pos.z + right.z * vx * dt;
    let ny = this.pos.y + vy * dt;
    // keep inside the climbable zone
    const z = c.zone;
    const local = new THREE.Vector3(nx - z.center.x, 0, nz - z.center.z);
    const along = local.dot(right);
    if (Math.abs(along) > z.halfWidth) return this.teleport(this.pos.x, ny, this.pos.z);
    if (ny < z.bottom - 0.02) { this.state = 'fall'; this.climbInfo = null; this.lastGround = this.time; return; }
    if (ny > z.top - 0.3) {
      // reached the top: climb over
      this.hangInfo = { ledgeY: z.top, wallN: c.normal.clone(), top: new THREE.Vector3(nx - c.normal.x * 0.25, z.top, nz - c.normal.z * 0.25) };
      this.state = 'climbup'; this.climbT = 0; this.climbFrom = this.pos.clone(); this.climbInfo = null; return;
    }
    // stick to the wall surface
    const hit = this.ray({ x: nx + c.normal.x * 0.3, y: ny + 0.2, z: nz + c.normal.z * 0.3 }, { x: -c.normal.x, y: 0, z: -c.normal.z }, 0.8);
    let px = nx, pz = nz;
    if (hit) { const d = hit.toi - 0.3 - 0.1; px -= c.normal.x * d * Math.min(1, dt * 10); pz -= c.normal.z * d * Math.min(1, dt * 10); }
    this.teleport(px, ny, pz);
    this.yaw = Math.atan2(-c.normal.x, -c.normal.z);
  }

  startClimb(zone) {
    this.state = 'climb'; this.vel.set(0, 0, 0); this.climbInfo = { zone, normal: zone.normal.clone() };
    this.yaw = Math.atan2(-zone.normal.x, -zone.normal.z); this.setCrouch(false); this.emit('grab');
  }

  updateSwim(dt, dir, mag, jumpPressed, waterY) {
    const terrain = this.ctx.terrain;
    const targetY = waterY - 0.22; // head and shoulders stay above the surface
    this.vel.y = damp(this.vel.y, (targetY - this.pos.y) * 6, 6, dt);
    const tv = dir.clone().multiplyScalar(SWIM * mag);
    this.vel.x = damp(this.vel.x, tv.x, 4, dt); this.vel.z = damp(this.vel.z, tv.z, 4, dt);
    if (mag > 0.05) this.yaw = dampAngle(this.yaw, Math.atan2(dir.x, dir.z), 6, dt);
    // jump out of the water: strong kick, carries forward momentum, any time near the surface
    if (jumpPressed && this.pos.y > targetY - 0.15) {
      this.vel.y = 3.9; if (mag > 0.1) { this.vel.x += dir.x * 1.1; this.vel.z += dir.z * 1.1; }
      this.airMax = Math.hypot(this.vel.x, this.vel.z);
      this.state = 'jump'; this.jumpsUsed = 1; this.jumpCut = false; this.emit('jump', { water: true }); this.lastGround = -1; this.wetT = 1;
      return this.integrateFree(dt);
    }
    // swimming into a bank, rock or log: climb out onto it automatically
    if (mag > 0.3 && this.tryClimbOut(dir, waterY)) return;
    const desired = { x: this.vel.x * dt, y: this.vel.y * dt, z: this.vel.z * dt };
    this.cc.computeColliderMovement(this.col, desired, this.ctx.RAPIER.QueryFilterFlags.EXCLUDE_SENSORS);
    const mv = this.cc.computedMovement(), t = this.body.translation();
    const next = { x: t.x + mv.x, y: t.y + mv.y, z: t.z + mv.z };
    this.body.setNextKinematicTranslation(next);
    this.pos.set(next.x, next.y - this.halfH(), next.z);
    this.grounded = false; this.wetT = 1;
    // feet touch the bottom again: stand up and wade out
    const depth = waterY - terrain.heightAt(this.pos.x, this.pos.z);
    if (depth < SWIM_DEPTH - 0.04 || !terrain.isWater(this.pos.x, this.pos.z)) { this.state = 'move'; this.vel.y = 0; this.lastGround = this.time; }
    this.swimStroke = (this.swimStroke || 0) + dt * Math.hypot(this.vel.x, this.vel.z) * 3;
    if (this.swimStroke > 1) { this.swimStroke = 0; this.emit('swimstroke'); }
  }

  integrateFree(dt) {
    const desired = { x: this.vel.x * dt, y: this.vel.y * dt, z: this.vel.z * dt };
    this.cc.computeColliderMovement(this.col, desired, this.ctx.RAPIER.QueryFilterFlags.EXCLUDE_SENSORS);
    const mv = this.cc.computedMovement(), t = this.body.translation();
    const next = { x: t.x + mv.x, y: t.y + mv.y, z: t.z + mv.z };
    this.body.setNextKinematicTranslation(next);
    this.pos.set(next.x, next.y - this.halfH(), next.z);
    this.grounded = false;
  }

  // is the standing capsule at (x, y, z) (feet) overlapping anything solid?
  blocked(x, y, z) {
    const R = this.ctx.RAPIER;
    if (!this._fitShape) this._fitShape = new R.Capsule(HH_STAND, R_CAP);
    let hit = false;
    this.ctx.physics.intersectionsWithShape({ x, y: y + R_CAP + HH_STAND + 0.03, z }, { x: 0, y: 0, z: 0, w: 1 }, this._fitShape, () => { hit = true; return false; },
      undefined, undefined, this.col, this.body, (c) => !c.isSensor() && !['item-held', 'item', 'player', 'creature'].includes(c.userData?.kind));
    return hit;
  }
  overlapping() {
    const R = this.ctx.RAPIER, t = this.body.translation(), hh = this.crouched ? HH_CROUCH : HH_STAND;
    const key = this.crouched ? '_ovC' : '_ovS';
    if (!this[key]) this[key] = new R.Capsule(hh, R_CAP - 0.02);
    let hit = false;
    this.ctx.physics.intersectionsWithShape(t, { x: 0, y: 0, z: 0, w: 1 }, this[key], () => { hit = true; return false; },
      undefined, undefined, this.col, this.body, (c) => !c.isSensor() && !['item-held', 'item', 'player', 'creature'].includes(c.userData?.kind));
    return hit;
  }
  unstick() {
    const p = this.pos;
    const tries = [];
    for (let k = 1; k <= 10; k++) tries.push([0, k * 0.05, 0]);
    for (const r of [0.15, 0.3, 0.45]) for (let a = 0; a < 8; a++) tries.push([Math.cos(a * 0.785) * r, 0.08, Math.sin(a * 0.785) * r]);
    for (const [dx, dy, dz] of tries) {
      if (this.blocked(p.x + dx, p.y + dy, p.z + dz)) continue;
      this.setCrouch?.(false);
      this.teleport(p.x + dx, p.y + dy, p.z + dz); this.vel.set(0, 0, 0);
      if (this.state !== 'swim') this.state = 'fall';
      return true;
    }
    return false;
  }
  // a free standing spot on a fairly flat surface under (x, z), searched down from yTop
  standAt(x, z, yTop) {
    const top = this.ray({ x, y: yTop, z }, { x: 0, y: -1, z: 0 }, 1.2);
    if (!top || top.normal.y < 0.72) return null;
    const y = yTop - top.toi;
    return this.blocked(x, y, z) ? null : y;
  }

  // find a surface just above the water ahead (bank, stone, log) and vault onto it; the landing spot must be flat
  // enough and leave room for the whole body (on a round log only the crown qualifies), otherwise keep swimming
  tryClimbOut(dir, waterY) {
    const d = dir.clone().setY(0).normalize();
    const o = { x: this.pos.x, y: waterY - 0.05, z: this.pos.z };
    const wall = this.ray(o, { x: d.x, y: 0, z: d.z }, 0.42);
    const start = wall ? wall.toi : 0.14;
    for (const k of [0.2, 0.27, 0.14, 0.34, 0.42]) {
      const x = o.x + d.x * (start + k), z = o.z + d.z * (start + k);
      const y = this.standAt(x, z, waterY + 0.75);
      if (y === null || y < waterY - 0.08 || y > waterY + 0.62) continue;
      if (this.ctx.terrain.isWater(x, z) && y < waterY + 0.02) continue; // still water there
      this.hangInfo = { ledgeY: y, wallN: d.clone().negate(), top: new THREE.Vector3(x, y, z), target: new THREE.Vector3(x, y, z) };
      this.state = 'climbup'; this.climbT = 0; this.climbFrom = this.pos.clone(); this.vel.set(0, 0, 0); this.wetT = 1;
      this.emit('climbout');
      return true;
    }
    return false;
  }

  teleport(x, y, z) {
    this.body.setNextKinematicTranslation({ x, y: y + this.halfH(), z });
    this.body.setTranslation({ x, y: y + this.halfH(), z }, true);
    this.pos.set(x, y, z);
  }

  respawn() {
    const c = this.checkpoint;
    this.setCrouch(false);
    this.teleport(c.x, c.y + 0.05, c.z); this.vel.set(0, 0, 0); this.yaw = c.yaw; this.state = 'idle';
    this.hangInfo = this.climbInfo = null; this.grab = null;
    this.emit('respawn');
  }

  playAction(name, dur) { this.act = { name, dur }; this.actT = 0; }

  // parameters for the animation system
  animParams(lookDir) {
    const hs = Math.hypot(this.vel.x, this.vel.z);
    let state = this.state;
    if (this.act && !['hang', 'climbup', 'climb', 'swim', 'roll', 'slide'].includes(state)) state = this.act.name;
    const fwd = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const accel = this.prevHs !== undefined ? (hs - this.prevHs) : 0; this.prevHs = hs;
    return {
      state, speed: state === 'swim' ? hs : hs, grounded: this.grounded, vy: this.vel.y,
      rollT: this.rollT, landK: this.landK, actT: this.actT, climbT: this.climbT, climbSpeed: this.climbSpeed || 0,
      carrying: !!this.carry, pulling: this.grab && this.grab.pulling,
      accelLean: clamp(accel * 3, -0.15, 0.2), turnLean: clamp(-(this.turnRate || 0) * 0.12 * Math.min(1, hs), -0.2, 0.2),
      lookDir, groundDrop: 0,
    };
  }
}
