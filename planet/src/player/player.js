// Player: kinematic capsule controller (terrain heightfield + collider boxes
// and cylinders, step-up, slopes, jetpack, swimming), first/third-person
// camera rig with camera collision, oxygen/health state.
import * as THREE from 'three';
import { U, WORLD } from '../core/shared.js';
import { clamp, lerp } from '../core/noise.js';
import { Astronaut } from './astronaut.js';

const RADIUS = 0.38;
const HEIGHT = 1.8;
const EYE = 1.64;
const STEP = 0.55;

export class Player {
  constructor(game) {
    this.game = game;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.onGround = false;
    this.groundY = 0;
    this.swimming = false;
    this.view = 'third';       // 'first' | 'third'
    this.camDist = 4.2;
    this.camDistCur = 4.2;
    this.jetFuel = 1;
    this.oxygen = 1;           // fraction of tank
    this.o2Capacity = 240;     // seconds of air
    this.health = 1;
    this.flashlight = false;
    this.flyCheat = false;
    this.speedMul = 1;
    this.inside = null;        // building the player stands inside, if any
    this.lastSafe = new THREE.Vector3();
    this.model = new Astronaut();
    game.engine.scene.add(this.model.root);
    this.bob = 0;
    this.fallStart = null;
    this.camPos = new THREE.Vector3();
    this.camQuat = new THREE.Quaternion();

    // flashlight on the camera
    this.light = new THREE.SpotLight(0xfff1dd, 0, 60, 0.55, 0.45, 1.2);
    this.light.castShadow = false;
    game.engine.scene.add(this.light);
    game.engine.scene.add(this.light.target);
  }

  spawn(x, z, yaw = 0) {
    const T = this.game.terrain;
    this.pos.set(x, T.height(x, z) + 0.1, z);
    this.vel.set(0, 0, 0);
    this.yaw = yaw;
    this.pitch = -0.08;
    this.lastSafe.copy(this.pos);
  }

  forward(out = new THREE.Vector3()) { return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }

  lookDir(out = new THREE.Vector3()) {
    const cp = Math.cos(this.pitch);
    return out.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
  }

  eyePos(out = new THREE.Vector3()) { return out.set(this.pos.x, this.pos.y + EYE, this.pos.z); }

  groundHeight(x, z, feet) {
    const g = this.game;
    let h = g.terrain.height(x, z);
    const c = g.colliders.groundAt(x, z, RADIUS, feet + STEP);
    if (c > h) h = c;
    const ice = g.props.iceHeightAt(x, z);
    if (ice > h && ice <= feet + STEP) h = ice;
    return h;
  }

  update(dt, input) {
    const g = this.game;
    const active = input.active;
    // --- look
    if (active) {
      const sens = input.sensitivity;
      this.yaw -= input.mouse.dx * sens;
      this.pitch -= input.mouse.dy * sens * (input.invertY ? -1 : 1);
      this.pitch = clamp(this.pitch, -1.5, 1.45);
      if (input.hit('KeyV')) this.view = this.view === 'first' ? 'third' : 'first';
      if (input.hit('KeyL')) this.flashlight = !this.flashlight;
    }
    // --- move intent
    let mx = 0, mz = 0;
    if (active) {
      if (input.down('KeyW')) mz += 1;
      if (input.down('KeyS')) mz -= 1;
      if (input.down('KeyA')) mx -= 1;
      if (input.down('KeyD')) mx += 1;
    }
    const len = Math.hypot(mx, mz);
    if (len > 0) { mx /= len; mz /= len; }
    const fwd = this.forward(_f);
    const right = _r.set(-fwd.z, 0, fwd.x);
    const sprint = active && (input.down('ShiftLeft') || input.down('ShiftRight'));
    const waterLevel = U.uWaterLevel.value;
    const liquid = U.uIce.value < 0.5;
    this.swimming = liquid && this.pos.y < waterLevel - 1.1 && !this.flyCheat;
    let speed = (sprint ? 7.6 : 4.5) * this.speedMul;
    if (this.swimming) speed = sprint ? 3.6 : 2.4;
    if (this.inside) speed = Math.min(speed, sprint ? 5.5 : 3.6);
    const wish = _w.set(0, 0, 0).addScaledVector(fwd, mz).addScaledVector(right, mx).multiplyScalar(speed);

    if (this.flyCheat) {
      const up = (active && input.down('Space') ? 1 : 0) - (active && input.down('ControlLeft') ? 1 : 0);
      this.vel.lerp(_v.set(wish.x * 3, up * 14, wish.z * 3), Math.min(1, dt * 6));
      this.pos.addScaledVector(this.vel, dt);
      const gh = g.terrain.height(this.pos.x, this.pos.z);
      if (this.pos.y < gh) this.pos.y = gh;
      this.onGround = false;
      this.jetting = false;
    } else {
      // horizontal acceleration
      const accel = this.onGround ? 42 : this.swimming ? 6 : 7;
      const vx = this.vel.x, vz = this.vel.z;
      const dvx = wish.x - vx, dvz = wish.z - vz;
      const dl = Math.hypot(dvx, dvz);
      const maxd = accel * dt;
      if (dl > maxd) { this.vel.x += dvx / dl * maxd; this.vel.z += dvz / dl * maxd; } else { this.vel.x = wish.x; this.vel.z = wish.z; }

      // vertical: gravity / jump / jetpack / swim
      this.jetting = false;
      const space = active && input.down('Space');
      if (this.swimming) {
        this.vel.y += (space ? 5 : -1.2) * dt;
        this.vel.y *= 1 - Math.min(1, dt * 2.5);
        if (this.pos.y > waterLevel - 1.15 && this.vel.y > 0 && !space) this.vel.y = 0;
      } else {
        this.vel.y -= WORLD.GRAVITY * dt;
        if (this.onGround && active && input.hit('Space')) { this.vel.y = 5.4; this.onGround = false; this.jumpHeld = true; }
        if (!space) this.jumpHeld = false;
        if (!this.onGround && space && !this.jumpHeld && this.jetFuel > 0) {
          this.vel.y += 15.5 * dt;
          if (this.vel.y > 5.5) this.vel.y = 5.5;
          this.jetFuel = Math.max(0, this.jetFuel - dt * 0.28);
          this.jetting = true;
        }
      }
      if (this.onGround) this.jetFuel = Math.min(1, this.jetFuel + dt * 0.45);

      // integrate horizontal with collisions (sub-steps for speed)
      const steps = Math.max(1, Math.ceil(Math.hypot(this.vel.x, this.vel.z) * dt / 0.25));
      for (let s = 0; s < steps; s++) {
        this.pos.x += this.vel.x * dt / steps;
        this.pos.z += this.vel.z * dt / steps;
        this.resolveWalls();
        // steep terrain blocks walking uphill
        const n = g.terrain.normal(this.pos.x, this.pos.z, _n);
        if (this.onGround && n.y < 0.62) {
          const into = this.vel.x * n.x + this.vel.z * n.z;
          if (into < 0) { this.vel.x -= n.x * into; this.vel.z -= n.z * into; }
          this.pos.x += n.x * dt * 2.2; this.pos.z += n.z * dt * 2.2;
        }
      }
      // vertical
      const prevY = this.pos.y;
      this.pos.y += this.vel.y * dt;
      // ceiling
      if (this.vel.y > 0) {
        const cs = g.colliders.query(this.pos.x, this.pos.z, RADIUS, _q);
        for (const c of cs) {
          if (c.y0 > prevY + HEIGHT - 0.05 && c.y0 < this.pos.y + HEIGHT && g.colliders.overlaps(c, this.pos.x, this.pos.z, RADIUS * 0.7)) {
            this.pos.y = c.y0 - HEIGHT; this.vel.y = 0;
          }
        }
      }
      const gh = this.groundHeight(this.pos.x, this.pos.z, Math.max(prevY, this.pos.y));
      this.groundY = gh;
      if (this.pos.y <= gh + 0.02 && this.vel.y <= 0.01) {
        const landing = !this.onGround ? -this.vel.y : 0;
        // snap down onto ground (also handles walking down slopes/steps)
        this.pos.y = gh;
        this.vel.y = 0;
        if (!this.onGround && landing > 13) this.damage((landing - 13) * 0.06, '추락 충격');
        this.onGround = true;
      } else if (this.onGround && this.pos.y - gh < 0.35 && this.vel.y <= 0) {
        this.pos.y = gh;
        this.vel.y = 0;
      } else {
        this.onGround = false;
      }
      if (this.pos.y < gh - 0.5) this.pos.y = gh;
    }
    // world bounds
    const lim = WORLD.SIZE / 2 - 30;
    this.pos.x = clamp(this.pos.x, -lim, lim);
    this.pos.z = clamp(this.pos.z, -lim, lim);
    if (this.onGround) this.lastSafe.copy(this.pos);

    this.updateModel(dt, Math.hypot(this.vel.x, this.vel.z));
  }

  resolveWalls() {
    const g = this.game;
    const feet = this.pos.y, head = this.pos.y + HEIGHT;
    const cs = g.colliders.query(this.pos.x, this.pos.z, RADIUS + 0.2, _q);
    for (let iter = 0; iter < 2; iter++) {
      for (const c of cs) {
        if (c.removed || c.ghost) continue;
        if (c.y1 <= feet + STEP || c.y0 >= head - 0.05) continue;
        const p = g.colliders.pushCircle(c, this.pos.x, this.pos.z, RADIUS);
        if (!p) continue;
        this.pos.x += p.x; this.pos.z += p.z;
        const pl = Math.hypot(p.x, p.z);
        if (pl > 1e-6) {
          const nx = p.x / pl, nz = p.z / pl;
          const into = this.vel.x * nx + this.vel.z * nz;
          if (into < 0) { this.vel.x -= nx * into; this.vel.z -= nz * into; }
        }
      }
    }
  }

  damage(amount, reason) {
    if (this.game.cheats && this.game.cheats.god) return;
    this.health = Math.max(0, this.health - amount);
    this.game.engine.hurt = Math.min(1, this.game.engine.hurt + amount * 2);
    if (reason) this.lastDamage = reason;
  }

  updateModel(dt, speed) {
    const m = this.model;
    m.root.position.copy(this.pos);
    // third person: the body turns to where it is going; while mining or
    // building it keeps facing the aim and steps sideways / backwards instead
    const vx = this.vel.x, vz = this.vel.z;
    const lock = this.working || this.game.build.active || this.view === 'first';
    const prev = m.root.rotation.y;
    let target = prev;
    if (lock) target = this.yaw;
    else if (speed > 0.6) target = Math.atan2(-vx, -vz);
    m.root.rotation.y = lerpAngle(prev, target, Math.min(1, dt * (speed > 0.6 ? 8 : 5)));
    const yaw = m.root.rotation.y;
    const turn = Math.atan2(Math.sin(yaw - prev), Math.cos(yaw - prev)) / Math.max(dt, 1e-3);
    // velocity in the body frame (the model faces -Z)
    const fwd = -vx * Math.sin(yaw) - vz * Math.cos(yaw), side = vx * Math.cos(yaw) - vz * Math.sin(yaw);
    m.update(dt, { speed, fwd, side, turn, onGround: this.onGround, jet: this.jetting, swim: this.swimming, vy: this.vel.y, aim: this.working ? 1 : 0, working: this.working });
    m.root.visible = this.view === 'third';
  }

  updateCamera(dt, camera) {
    const g = this.game;
    const eye = this.eyePos(_e);
    if (this.view === 'first') {
      const walk = this.onGround ? Math.min(1, Math.hypot(this.vel.x, this.vel.z) / 4) : 0;
      this.bob += dt * (5 + Math.hypot(this.vel.x, this.vel.z) * 1.1) * (walk > 0.05 ? 1 : 0);
      camera.position.set(eye.x, eye.y + Math.sin(this.bob * 2) * 0.03 * walk, eye.z);
      camera.rotation.set(this.pitch, this.yaw, Math.sin(this.bob) * 0.004 * walk, 'YXZ');
      this.camDistCur = 0;
    } else {
      const dir = this.lookDir(_d);
      const pivot = _p.set(this.pos.x, this.pos.y + 1.55, this.pos.z);
      const rightV = _r.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      pivot.addScaledVector(rightV, 0.55);
      let want = this.camDist;
      // collide camera boom with terrain and colliders
      const back = _b.copy(dir).multiplyScalar(-1);
      for (let t = 0.3; t <= want; t += 0.2) {
        const px = pivot.x + back.x * t, py = pivot.y + back.y * t, pz = pivot.z + back.z * t;
        if (py < g.terrain.height(px, pz) + 0.35) { want = Math.max(0.6, t - 0.25); break; }
      }
      const hit = g.colliders.raycast(pivot.x, pivot.y, pivot.z, back.x, back.y, back.z, want, (c) => !c.rock || c.r > 0.5);
      if (hit) want = Math.max(0.5, hit.t - 0.3);
      this.camDistCur = want < this.camDistCur ? want : lerp(this.camDistCur, want, Math.min(1, dt * 4));
      camera.position.copy(pivot).addScaledVector(back, this.camDistCur);
      camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
      // hide model if camera is inside it
      this.model.root.visible = this.camDistCur > 0.9;
    }
    camera.updateMatrixWorld();
    // flashlight follows the view
    this.light.intensity = this.flashlight ? 60 : 0;
    this.light.position.copy(eye).addScaledVector(this.lookDir(_d), 0.3).add(_v.set(0, -0.1, 0));
    this.light.target.position.copy(eye).addScaledVector(_d, 10);
  }
}

function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return a + d * t;
}

const _f = new THREE.Vector3(), _r = new THREE.Vector3(), _w = new THREE.Vector3(), _v = new THREE.Vector3();
const _n = new THREE.Vector3(), _e = new THREE.Vector3(), _d = new THREE.Vector3(), _p = new THREE.Vector3(), _b = new THREE.Vector3();
const _q = [];

export { RADIUS, HEIGHT, EYE };
