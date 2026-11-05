// Six-wheeled exploration rover for crossing the 16 km planet. Rides on the
// heightfield with per-wheel suspension, tilts to the ground, collides with
// structures and rocks, and refills the driver's oxygen in its cabin.
import * as THREE from 'three';
import { GeoBuilder } from '../core/geobuilder.js';
import { U } from '../core/shared.js';

export class Rover {
  constructor(game) {
    this.game = game;
    this.pos = new THREE.Vector3();
    this.yaw = 0;
    this.speed = 0;
    this.driving = false;
    this.present = false;
    const mats = game.buildings.mats;
    const gb = (fn) => { const b = new GeoBuilder(); fn(b); return b.build(); };
    const body = gb((b) => {
      b.add(new THREE.BoxGeometry(2.4, 0.7, 4.6), { pos: new THREE.Vector3(0, 1.0, 0), color: 0xe7e5df });
      b.add(new THREE.BoxGeometry(2.5, 0.2, 4.7), { pos: new THREE.Vector3(0, 0.62, 0), color: 0x33373c });
      b.add(new THREE.BoxGeometry(2.2, 1.0, 2.2), { pos: new THREE.Vector3(0, 1.85, -0.7), color: 0xe7e5df });
      b.add(new THREE.BoxGeometry(2.42, 0.12, 4.62), { pos: new THREE.Vector3(0, 1.34, 0), color: 0xf0761c });
      b.add(new THREE.BoxGeometry(1.8, 0.5, 1.3), { pos: new THREE.Vector3(0, 1.6, 1.5), color: 0x80868d });
      b.add(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 6), { pos: new THREE.Vector3(0.9, 2.9, 0.2), color: 0x33373c });
      b.add(new THREE.BoxGeometry(2.6, 0.12, 0.25), { pos: new THREE.Vector3(0, 0.9, -2.4), color: 0x33373c });
    });
    const glass = gb((b) => { b.add(new THREE.BoxGeometry(2.0, 0.7, 0.05), { pos: new THREE.Vector3(0, 2.0, -1.82), rot: new THREE.Euler(-0.35, 0, 0) }); b.add(new THREE.BoxGeometry(0.05, 0.6, 1.6), { pos: new THREE.Vector3(1.11, 2.0, -0.7) }); b.add(new THREE.BoxGeometry(0.05, 0.6, 1.6), { pos: new THREE.Vector3(-1.11, 2.0, -0.7) }); });
    const lights = gb((b) => { for (const x of [-0.8, 0.8]) b.add(new THREE.BoxGeometry(0.35, 0.15, 0.05), { pos: new THREE.Vector3(x, 1.1, -2.32), color: 0xfff1d0 }); b.add(new THREE.SphereGeometry(0.07, 8, 6), { pos: new THREE.Vector3(0.9, 3.72, 0.2), color: 0xff3322 }); });
    this.group = new THREE.Group();
    this.chassis = new THREE.Group();
    this.group.add(this.chassis);
    const mk = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; this.chassis.add(m); return m; };
    mk(body, mats.hull); mk(glass, mats.glass); mk(lights, mats.emissive);
    this.wheels = [];
    const wheelGeo = gb((b) => {
      b.add(new THREE.CylinderGeometry(0.55, 0.55, 0.45, 18), { rot: new THREE.Euler(0, 0, Math.PI / 2), color: 0x1d1e20 });
      b.add(new THREE.CylinderGeometry(0.3, 0.3, 0.47, 10), { rot: new THREE.Euler(0, 0, Math.PI / 2), color: 0x9aa0a6 });
    });
    for (const z of [-1.6, 0, 1.6]) for (const x of [-1.35, 1.35]) {
      const w = new THREE.Mesh(wheelGeo, mats.metal);
      w.castShadow = true;
      w.position.set(x, 0.55, z);
      this.group.add(w);
      this.wheels.push({ m: w, x, z, y: 0 });
    }
    this.headlight = new THREE.SpotLight(0xfff1dd, 0, 70, 0.6, 0.5, 1.2);
    this.group.add(this.headlight);
    this.headlight.position.set(0, 1.2, -2.4);
    this.headlight.target.position.set(0, 0, -20);
    this.group.add(this.headlight.target);
    this.group.visible = false;
    game.engine.scene.add(this.group);
    this.tilt = new THREE.Quaternion();
  }

  summon(nearPos, yaw) {
    const T = this.game.terrain;
    const x = nearPos.x + Math.cos(yaw) * 5, z = nearPos.z - Math.sin(yaw) * 5;
    this.pos.set(x, T.height(x, z), z);
    this.yaw = yaw;
    this.speed = 0;
    this.present = true;
    this.group.visible = true;
    this.updateMesh(0);
  }

  update(dt, input) {
    if (!this.present) return;
    const g = this.game, T = g.terrain;
    if (this.driving) {
      const active = input.active;
      const thr = active ? (input.down('KeyW') ? 1 : 0) - (input.down('KeyS') ? 1 : 0) : 0;
      const steer = active ? (input.down('KeyA') ? 1 : 0) - (input.down('KeyD') ? 1 : 0) : 0;
      const boost = active && input.down('ShiftLeft') ? 1.5 : 1;
      const maxV = 18 * boost;
      this.speed += thr * 9 * dt;
      if (!thr) this.speed *= 1 - Math.min(1, dt * 0.8);
      if (active && input.down('Space')) this.speed *= 1 - Math.min(1, dt * 4);
      this.speed = Math.max(-6, Math.min(maxV, this.speed));
      this.yaw += steer * dt * (0.9 + Math.min(1, Math.abs(this.speed) / 10) * 0.4) * Math.sign(this.speed || 1) * Math.min(1, Math.abs(this.speed) / 3 + 0.2);
    } else this.speed *= 1 - Math.min(1, dt * 2);
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    // slope resistance
    const ahead = T.height(this.pos.x + fx * 2, this.pos.z + fz * 2) - T.height(this.pos.x - fx * 2, this.pos.z - fz * 2);
    this.speed -= Math.sign(this.speed) * Math.max(0, ahead * Math.sign(this.speed)) * dt * 1.6;
    const nx = this.pos.x + fx * this.speed * dt, nz = this.pos.z + fz * this.speed * dt;
    // collisions with structures and big rocks
    let blocked = false;
    for (const c of g.colliders.query(nx, nz, 2.2)) {
      if (c.y1 < this.pos.y + 0.6 || c.y0 > this.pos.y + 2.5) continue;
      if (g.colliders.overlaps(c, nx, nz, 1.6)) { blocked = true; break; }
    }
    if (blocked) { this.speed *= -0.25; }
    else if (T.inWorld(nx, nz, 60)) { this.pos.x = nx; this.pos.z = nz; }
    const ground = Math.max(T.height(this.pos.x, this.pos.z), g.colliders.groundAt(this.pos.x, this.pos.z, 1.5, this.pos.y + 0.8));
    const water = U.uIce.value < 0.5 ? U.uWaterLevel.value - 1.0 : -1e9;
    this.pos.y += (Math.max(ground, water) - this.pos.y) * Math.min(1, dt * 12);
    this.updateMesh(dt);
  }

  updateMesh(dt) {
    const T = this.game.terrain;
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    const hAt = (lx, lz) => T.height(this.pos.x + lx * c + lz * s, this.pos.z - lx * s + lz * c);
    const hf = (hAt(-1.35, -1.6) + hAt(1.35, -1.6)) / 2, hb = (hAt(-1.35, 1.6) + hAt(1.35, 1.6)) / 2;
    const hl = (hAt(-1.35, -1.6) + hAt(-1.35, 1.6)) / 2, hr = (hAt(1.35, -1.6) + hAt(1.35, 1.6)) / 2;
    const pitch = Math.atan2(hf - hb, 3.2), roll = Math.atan2(hl - hr, 2.7);
    this.group.position.copy(this.pos);
    this.group.rotation.set(pitch, this.yaw, roll, 'YXZ');
    for (const w of this.wheels) {
      w.m.rotation.x += this.speed * dt / 0.55;
    }
    this.headlight.intensity = this.driving && U.uNight.value > 0.3 ? 120 : 0;
  }

  near(p, r = 4) { return this.present && Math.hypot(p.x - this.pos.x, p.z - this.pos.z) < r; }
}
