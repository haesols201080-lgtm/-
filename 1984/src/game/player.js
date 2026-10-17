// Winston Smith, first person: thirty-nine, a varicose ulcer above his right
// ankle, slow on the stairs. Walks, runs (which draws attention), crouches.
import * as THREE from 'three';

export class Player {
  constructor(camera, input, colliders) {
    this.camera = camera;
    this.input = input;
    this.col = colliders;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0;
    this.radius = 0.32;
    this.eye = 1.64;
    this.crouch = 0;
    this.bob = 0;
    this.stepAcc = 0;
    this.running = false;
    this.moving = false;
    this.speed = 0;
    this.locked = false;          // cutscene: no movement
    this.lookLocked = false;      // cutscene: no mouse look
    this.lookTarget = null;
    this.stamina = 1;
    this.ground = () => 0;
    this.onStep = null;
    this.fovKick = 0;
    this.seated = 0;              // 0..1 lowers the eye for sitting
  }

  place(x, y, z, yaw = this.yaw) {
    this.pos.set(x, y, z); this.yaw = yaw; this.pitch = 0; this.vel.set(0, 0, 0);
  }

  forward(out = new THREE.Vector3()) {
    return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }

  lookDir(out = new THREE.Vector3()) {
    return out.set(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
  }

  faceTowards(x, z, smooth = 1) {
    const target = Math.atan2(-(x - this.pos.x), -(z - this.pos.z));
    let d = target - this.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.yaw += d * smooth;
  }

  update(dt) {
    const inp = this.input;
    if (!this.lookLocked) {
      const [mx, my] = inp.consumeMouse();
      this.yaw -= mx * 0.0022;
      this.pitch -= my * 0.0022;
      this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
    } else {
      inp.consumeMouse();
    }
    if (this.lookTarget) {
      const t = this.lookTarget;
      const dx = t.x - this.pos.x, dz = t.z - this.pos.z;
      const target = Math.atan2(-dx, -dz);
      let d = Math.atan2(Math.sin(target - this.yaw), Math.cos(target - this.yaw));
      this.yaw += d * Math.min(1, dt * 4);
      const dist = Math.hypot(dx, dz);
      const tp = Math.atan2(t.y - (this.pos.y + this.eye), dist);
      this.pitch += (tp - this.pitch) * Math.min(1, dt * 4);
    }

    let fx = 0, fz = 0;
    if (!this.locked) {
      if (inp.down('KeyW') || inp.down('ArrowUp')) fz += 1;
      if (inp.down('KeyS') || inp.down('ArrowDown')) fz -= 1;
      if (inp.down('KeyA') || inp.down('ArrowLeft')) fx -= 1;
      if (inp.down('KeyD') || inp.down('ArrowRight')) fx += 1;
      if (inp.axis && (inp.axis.x || inp.axis.z)) { fx += inp.axis.x; fz += inp.axis.z; }
    }
    const wantCrouch = !this.locked && (inp.down('KeyC') || inp.down('ControlLeft'));
    this.crouch += ((wantCrouch ? 1 : 0) - this.crouch) * Math.min(1, dt * 8);
    const len = Math.hypot(fx, fz);
    const amt = Math.min(1, len);    // a half-pushed stick walks slowly
    const wantRun = !this.locked && (inp.down('ShiftLeft') || inp.down('ShiftRight')) && fz > 0 && this.crouch < 0.3;
    this.running = wantRun && len > 0 && this.stamina > 0.05;
    if (this.running) this.stamina = Math.max(0, this.stamina - dt * 0.12);
    else this.stamina = Math.min(1, this.stamina + dt * 0.08);
    const maxSpeed = this.running ? 5.0 : (this.crouch > 0.5 ? 1.2 : 2.3);
    const fwd = this.forward(new THREE.Vector3());
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const wish = new THREE.Vector3();
    if (len > 0) wish.addScaledVector(fwd, fz / len).addScaledVector(right, fx / len).multiplyScalar(maxSpeed * amt);
    const accel = len > 0 ? 9 : 12;
    this.vel.x += (wish.x - this.vel.x) * Math.min(1, dt * accel);
    this.vel.z += (wish.z - this.vel.z) * Math.min(1, dt * accel);
    const nx = this.pos.x + this.vel.x * dt;
    const nz = this.pos.z + this.vel.z * dt;
    const p = { x: nx, z: nz };
    this.col.resolve(p, this.radius, this.pos.y, 1.7);
    // keep sliding velocity consistent with the collision
    if (dt > 0) { this.vel.x = (p.x - this.pos.x) / dt; this.vel.z = (p.z - this.pos.z) / dt; }
    this.pos.x = p.x; this.pos.z = p.z;
    const gy = this.ground(this.pos.x, this.pos.z);
    this.pos.y += (gy - this.pos.y) * Math.min(1, dt * 12);

    this.speed = Math.hypot(this.vel.x, this.vel.z);
    this.moving = this.speed > 0.3;
    // head bob and footsteps
    if (this.moving) {
      const f = this.running ? 2.6 : 1.8;
      this.bob += dt * f * Math.PI * 2 * (this.speed / maxSpeed);
      this.stepAcc += this.speed * dt;
      const stride = this.running ? 1.5 : 0.75;
      if (this.stepAcc > stride) { this.stepAcc = 0; if (this.onStep) this.onStep(this.running); }
    } else {
      this.bob += dt * 1.2;
    }
    const amp = this.moving ? (this.running ? 0.055 : 0.03) : 0.006;
    const bobY = Math.abs(Math.sin(this.bob)) * amp - amp * 0.5;
    const bobX = Math.cos(this.bob) * amp * 0.5;

    const eye = this.eye - this.crouch * 0.55 - this.seated * 0.5;
    const cam = this.camera;
    cam.position.set(this.pos.x + right.x * bobX, this.pos.y + eye + bobY, this.pos.z + right.z * bobX);
    cam.rotation.set(0, 0, 0);
    cam.rotation.order = 'YXZ';
    cam.rotation.y = this.yaw;
    cam.rotation.x = this.pitch;
    cam.rotation.z = -this.vel.dot(right) * 0.004;
    const fov = 72 + (this.running ? 5 : 0) + this.fovKick;
    cam.fov += (fov - cam.fov) * Math.min(1, dt * 4);
    cam.updateProjectionMatrix();
  }
}
