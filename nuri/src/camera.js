// Third-person orbit camera tuned for a 35 cm robot: smooth follow, free orbit (mouse / right stick / touch),
// zoom, collision against the world (sphere cast), occlusion handling, auto-pull-in in tight spaces,
// vertical lag on jumps and speed-based FOV.
import * as THREE from 'three';
import { clamp, damp, dampAngle } from './util.js';

export class OrbitCam {
  constructor(camera, ctx) {
    this.cam = camera; this.ctx = ctx;
    this.yaw = Math.PI; this.pitch = 0.22; this.dist = 1.25; this.distT = 1.25; this.cur = 1.25;
    this.pivot = new THREE.Vector3(); this.pivotY = 0; this.init = false;
    this.idleInput = 0; this.fov = 58; this.shake = 0;
    this.shape = null;
  }
  set(yaw, pitch) { this.yaw = yaw; this.pitch = pitch; }
  // short cinematic: swing the camera to show something happening (a gate opening), then hand back
  focus(target, dur = 2.6) { this.cine = { target: target.clone(), t: 0, dur }; this.shake = Math.max(this.shake, 0.35); }

  update(dt, input, player) {
    const R = this.ctx.RAPIER, W = this.ctx.physics;
    const look = input.consumeLook();
    const z = input.consumeZoom();
    if (z) this.distT = clamp(this.distT + z, 0.55, 3.2);
    if (Math.abs(look.x) + Math.abs(look.y) > 1e-5) this.idleInput = 0; else this.idleInput += dt;
    this.yaw -= look.x; this.pitch = clamp(this.pitch + look.y, -0.55, 1.25);
    const hs = Math.hypot(player.vel.x, player.vel.z);
    // gentle auto-follow behind the robot when moving without camera input
    if (this.idleInput > 1.6 && hs > 0.5 && player.state !== 'climb') {
      const behind = player.yaw + Math.PI;
      this.yaw = dampAngle(this.yaw, behind, 0.9 * Math.min(1, hs / 1.4), dt);
    }
    if (player.state === 'swim') this.pitch = damp(this.pitch, Math.max(this.pitch, 0.18), 2, dt);
    // pivot follows the head; vertical motion lags while airborne (keeps jumps readable)
    const target = new THREE.Vector3(player.pos.x, player.pos.y + 0.32, player.pos.z);
    if (!this.init) { this.pivot.copy(target); this.pivotY = target.y; this.init = true; }
    this.pivot.x = damp(this.pivot.x, target.x, 18, dt); this.pivot.z = damp(this.pivot.z, target.z, 18, dt);
    const airborne = !player.grounded && !['swim', 'climb', 'hang', 'climbup'].includes(player.state);
    const below = target.y < this.pivotY - 0.4;
    this.pivotY = damp(this.pivotY, target.y, airborne && !below ? 3.5 : 12, dt);
    this.pivot.y = this.pivotY;
    // tight-space auto pull-in: probe around the pivot
    let tight = 0;
    const dirs = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0]];
    for (const d of dirs) {
      const h = W.castRay(new R.Ray(this.pivot, { x: d[0], y: d[1], z: d[2] }), 0.9, true, R.QueryFilterFlags.EXCLUDE_SENSORS, undefined, player.col, player.body,
        (c) => c.userData?.kind !== 'item-held' && c.userData?.kind !== 'item');
      if (h) tight += 1 - h.timeOfImpact / 0.9;
    }
    const tightK = clamp(tight / 2.2, 0, 1);
    this.dist = damp(this.dist, this.distT * (1 - tightK * 0.45) + hs * 0.1, 4, dt);
    const dir = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
    // sphere cast from pivot to the desired camera position
    if (!this.shape) this.shape = new R.Ball(0.06);
    const hit = W.castShape(this.pivot, { x: 0, y: 0, z: 0, w: 1 }, dir, this.shape, 0.0, this.dist, true, R.QueryFilterFlags.EXCLUDE_SENSORS, undefined, player.col, player.body,
      (c) => c.userData?.kind !== 'item-held' && c.userData?.kind !== 'item' && c.userData?.kind !== 'creature');
    let d = this.dist;
    if (hit) d = Math.max(0.18, hit.time_of_impact ?? hit.timeOfImpact ?? this.dist);
    // pull in fast, ease out slowly
    this.cur = d < this.cur ? d : damp(this.cur, d, 3, dt);
    const pos = this.pivot.clone().addScaledVector(dir, this.cur);
    // never below the terrain
    const th = this.ctx.terrain.heightAt(pos.x, pos.z) + 0.08;
    if (pos.y < th) pos.y = th;
    if (this.shake > 0) { this.shake = Math.max(0, this.shake - dt * 3); pos.x += (Math.random() - 0.5) * this.shake * 0.02; pos.y += (Math.random() - 0.5) * this.shake * 0.02; }
    this.cam.position.copy(pos);
    this.cam.lookAt(this.pivot.x, this.pivot.y - 0.04, this.pivot.z);
    if (this.cine) {
      const c = this.cine; c.t += dt; const k = c.t / c.dur;
      if (k >= 1) this.cine = null;
      else {
        const sm = (x) => x * x * (3 - 2 * x);
        const e = k < 0.22 ? sm(k / 0.22) : k > 0.8 ? 1 - sm((k - 0.8) / 0.2) : 1;
        const toP = new THREE.Vector3(player.pos.x - c.target.x, 0, player.pos.z - c.target.z);
        if (toP.lengthSq() < 1e-4) toP.set(1, 0, 0); toP.normalize();
        const side = new THREE.Vector3(-toP.z, 0, toP.x);
        const vp = c.target.clone().addScaledVector(toP, 2.6).addScaledVector(side, 0.9 + k * 0.4).add(new THREE.Vector3(0, 0.9, 0));
        this.cam.position.lerp(vp, e);
        const look = this.pivot.clone().lerp(c.target, e);
        this.cam.lookAt(look);
      }
    }
    const fovT = 58 + clamp(hs - 1.0, 0, 1.0) * 4;
    this.fov = damp(this.fov, fovT, 3, dt);
    if (Math.abs(this.cam.fov - this.fov) > 0.01) { this.cam.fov = this.fov; this.cam.updateProjectionMatrix(); }
  }
}
