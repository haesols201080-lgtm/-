// Six-wheeled pressurised exploration rover (rode down in the expedition
// ship's cargo bay) for crossing the 16 km planet. Rides on the
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
    const V = (x, y, z) => new THREE.Vector3(x, y, z), E = (x, y, z, o) => new THREE.Euler(x, y, z, o);
    const G = { hull: new GeoBuilder([], { pan: true }), metal: new GeoBuilder([], { pan: true }), glass: new GeoBuilder([], { pan: true }), emissive: new GeoBuilder([], { pan: true }), solar: new GeoBuilder([], { pan: true }), paint: new GeoBuilder([], { pan: true }), rubber: new GeoBuilder() };
    const bar = (key, a, b, r, color, seg = 8) => {
      const d = b.clone().sub(a), g = new THREE.CylinderGeometry(r, r, d.length(), seg);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize()));
      G[key].add(g, { pos: a.clone().add(b).multiplyScalar(0.5), color });
    };
    // ---- pressurised cabin: side profile extruded across, with rounded edges
    // profile inset by the 0.18 m bevel so the finished surfaces land on these lines:
    // rear (2.75), roof (3.0-3.05), windscreen (-2.45,2.0)-(-1.15,2.95), nose (-2.85), floor (1.15)
    const W = 2.3, prof = [[2.57, 1.33], [2.45, 2.67], [2.15, 2.82], [-0.6, 2.87], [-1.08, 2.78], [-2.3, 1.9], [-2.67, 1.56], [-2.52, 1.33]];
    const shape = new THREE.Shape(prof.map(([z, y]) => new THREE.Vector2(z, y)));
    const cab = new THREE.ExtrudeGeometry(shape, { depth: W, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.18, bevelSegments: 4, steps: 1, curveSegments: 4 });
    cab.rotateY(-Math.PI / 2); cab.translate(W / 2, 0, 0);
    G.hull.add(cab, { color: 0xeeefec });
    const HX = W / 2 + 0.2;                       // cabin side surface
    // windscreen (follows the slope), side windows, roof hatch
    const ws = new THREE.BoxGeometry(2.1, 0.03, 1.52);
    G.glass.add(ws, { pos: V(0, 2.49, -1.81), rot: E(-0.613, 0, 0) });
    G.metal.add(new THREE.BoxGeometry(0.06, 0.04, 1.56), { pos: V(0, 2.5, -1.81), rot: E(-0.613, 0, 0), color: 0x2c2f33 });
    for (const sx of [-1, 1]) {
      const sw = new THREE.ExtrudeGeometry(new THREE.Shape([[-1.9, 2.15], [-1.15, 2.68], [0.1, 2.68], [0.1, 2.05], [-1.78, 2.05]].map(([z, y]) => new THREE.Vector2(z, y))), { depth: 0.02, bevelEnabled: false });
      sw.rotateY(-Math.PI / 2);
      G.glass.add(sw, { pos: V(sx * (HX + 0.012) + (sx > 0 ? 0.02 : 0), 0, 0) });
      // handrail, side hatch outline, lockers, agency stripe
      bar('metal', V(sx * (HX + 0.1), 2.45, 0.4), V(sx * (HX + 0.1), 2.45, 2.2), 0.025, 0x9aa0a6, 6);
      for (const z of [0.4, 2.2]) bar('metal', V(sx * HX, 2.45, z), V(sx * (HX + 0.1), 2.45, z), 0.02, 0x9aa0a6, 6);
      for (const [z, w] of [[0.95, 0.85], [1.95, 0.85]]) G.metal.add(new THREE.BoxGeometry(0.04, 0.75, w), { pos: V(sx * (HX + 0.02), 1.65, z), color: 0xd4d7da });
      G.paint.add(new THREE.BoxGeometry(0.03, 0.12, 4.4), { pos: V(sx * (HX + 0.03), 1.6, 0.05), color: 0x2f5fa8 });
      G.paint.add(new THREE.BoxGeometry(0.03, 0.04, 4.4), { pos: V(sx * (HX + 0.03), 1.7, 0.05), color: 0xf0761c });
      // amber side markers
      G.emissive.add(new THREE.BoxGeometry(0.03, 0.06, 0.16), { pos: V(sx * (HX + 0.03), 1.6, -2.35), color: 0xffa040 });
    }
    // rear: two suitports with suits docked on them, ladder, tail lights
    for (const sx of [-0.6, 0.6]) {
      G.metal.add(new THREE.TorusGeometry(0.4, 0.06, 8, 24), { pos: V(sx, 2.05, 2.7), color: 0x6d7379 });
      G.hull.add(new THREE.BoxGeometry(0.62, 0.78, 0.26), { pos: V(sx, 2.1, 2.84), color: 0xe4e2dc });
      G.metal.add(new THREE.BoxGeometry(0.5, 0.14, 0.05), { pos: V(sx, 2.35, 2.99), color: 0x3a3d42 });
      G.hull.add(new THREE.SphereGeometry(0.17, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), { pos: V(sx, 2.49, 2.82), color: 0xe9e8e4 });
      G.emissive.add(new THREE.BoxGeometry(0.22, 0.08, 0.03), { pos: V(sx * 1.6, 1.35, 2.765), color: 0xff2a1a });
    }
    for (let i = 0; i < 3; i++) G.metal.add(new THREE.BoxGeometry(0.5, 0.04, 0.06), { pos: V(0, 1.25 + i * 0.28, 2.84), color: 0x9aa0a6 });
    // chassis frame, rocker beams, bumpers with hazard chevrons, tow hooks
    G.metal.add(new THREE.BoxGeometry(2.0, 0.32, 5.7), { pos: V(0, 0.98, 0), color: 0x3a3e44 });
    for (const sx of [-1, 1]) G.metal.add(new THREE.BoxGeometry(0.16, 0.22, 5.4), { pos: V(sx * 1.02, 0.88, 0), color: 0x4a4f55 });
    G.metal.add(new THREE.BoxGeometry(2.7, 0.26, 0.28), { pos: V(0, 1.0, -3.02), color: 0x2c2f33 });
    G.metal.add(new THREE.BoxGeometry(2.5, 0.22, 0.24), { pos: V(0, 0.9, 3.08), color: 0x2c2f33 });
    for (let i = 0; i < 8; i++) G.paint.add(new THREE.BoxGeometry(0.28, 0.2, 0.02), { pos: V(-1.05 + i * 0.3, 0.9, 3.215), rot: E(0, 0, 0.5), color: i % 2 ? 0x1c1c1e : 0xe2b03a });
    for (const sx of [-0.7, 0.7]) G.metal.add(new THREE.TorusGeometry(0.07, 0.025, 6, 12), { pos: V(sx, 0.95, -3.2), rot: E(0, Math.PI / 2, 0), color: 0xd8a531 });
    // headlights: two LED clusters and a roof light bar
    for (const sx of [-1, 1]) {
      G.metal.add(new THREE.BoxGeometry(0.62, 0.22, 0.08), { pos: V(sx * 0.75, 1.5, -2.86), rot: E(0.25, 0, 0), color: 0x1d2024 });
      for (const o of [-0.18, 0, 0.18]) G.emissive.add(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 12).rotateX(Math.PI / 2), { pos: V(sx * 0.75 + o, 1.5, -2.915), color: 0xfff4e0 });
    }
    G.metal.add(new THREE.BoxGeometry(1.6, 0.12, 0.2), { pos: V(0, 3.22, -0.75), color: 0x1d2024 });
    G.emissive.add(new THREE.BoxGeometry(1.5, 0.07, 0.03), { pos: V(0, 3.22, -0.86), color: 0xfff1d8 });
    // roof: solar array in a frame, LIDAR/camera mast, high-gain dish, whip
    G.solar.add(new THREE.BoxGeometry(1.9, 0.05, 2.5), { pos: V(0, 3.2, 1.0) });
    G.metal.add(new THREE.BoxGeometry(2.0, 0.06, 2.6), { pos: V(0, 3.15, 1.0), color: 0x6d7379 });
    for (const [x, z] of [[-0.9, -0.15], [0.9, -0.15], [-0.9, 2.15], [0.9, 2.15]]) G.metal.add(new THREE.BoxGeometry(0.06, 0.16, 0.06), { pos: V(x, 3.1, z), color: 0x6d7379 });
    bar('metal', V(0.55, 3.05, -0.35), V(0.55, 3.9, -0.35), 0.04, 0x9aa0a6);
    G.metal.add(new THREE.BoxGeometry(0.5, 0.18, 0.2), { pos: V(0.55, 3.98, -0.35), color: 0xd4d7da });
    for (const sx of [-0.15, 0.15]) G.glass.add(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 12).rotateX(Math.PI / 2), { pos: V(0.55 + sx, 3.98, -0.46) });
    G.metal.add(new THREE.CylinderGeometry(0.08, 0.08, 0.12, 14), { pos: V(0.55, 4.13, -0.35), color: 0x1d2024 });
    bar('metal', V(-0.6, 3.05, 2.3), V(-0.6, 3.55, 2.3), 0.03, 0x9aa0a6);
    const dish = new THREE.SphereGeometry(0.42, 18, 6, 0, Math.PI * 2, 0, 0.6); dish.rotateX(-1.0);
    G.hull.add(dish, { pos: V(-0.6, 3.7, 2.45), color: 0xe4e2dc });
    bar('metal', V(0.85, 3.05, 2.4), V(0.85, 4.6, 2.4), 0.012, 0x2c2f33, 4);
    G.emissive.add(new THREE.SphereGeometry(0.04, 8, 6), { pos: V(0.85, 4.62, 2.4), color: 0xff3322 });
    // fenders over each wheel pair and suspension: double wishbones + coil-overs
    for (const z of [-1.9, 0, 1.9]) for (const sx of [-1, 1]) {
      const f = new THREE.CylinderGeometry(0.72, 0.72, 0.56, 20, 1, true, -Math.PI * 0.45, Math.PI * 0.9);
      f.rotateZ(Math.PI / 2); f.rotateX(-Math.PI / 2);
      G.hull.add(f, { pos: V(sx * 1.48, 0.6, z), rot: E(0, 0, 0), color: 0xdcdedf });
      for (const [y0, y1] of [[0.98, 0.78], [0.72, 0.42]]) {
        bar('metal', V(sx * 0.95, y0, z - 0.25), V(sx * 1.22, y1, z), 0.035, 0x5b6168, 6);
        bar('metal', V(sx * 0.95, y0, z + 0.25), V(sx * 1.22, y1, z), 0.035, 0x5b6168, 6);
      }
      bar('metal', V(sx * 0.9, 1.25, z), V(sx * 1.2, 0.62, z), 0.055, 0xd8a531, 8);
      bar('metal', V(sx * 0.92, 1.18, z), V(sx * 1.14, 0.72, z), 0.08, 0x2c2f33, 8);
    }
    const tireMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
    const paintMat = mats.interior;
    this.group = new THREE.Group();
    this.chassis = new THREE.Group();
    this.group.add(this.chassis);
    const mk = (geo, mat, parent = this.chassis) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
    mk(G.hull.build(), mats.hull); mk(G.metal.build(), mats.metal); mk(G.glass.build(), mats.glass); mk(G.emissive.build(), mats.emissive); mk(G.solar.build(), mats.solar); mk(G.paint.build(), paintMat);
    // ---- wheels: rounded tyre with chevron tread blocks, machined hub
    const T = new GeoBuilder(), H = new GeoBuilder([], { pan: true });
    const tp = [[0.3, -0.21], [0.47, -0.215], [0.53, -0.18], [0.545, -0.1], [0.545, 0.1], [0.53, 0.18], [0.47, 0.215], [0.3, 0.21]];
    const tyre = new THREE.LatheGeometry(tp.map(([r, y]) => new THREE.Vector2(r, y)), 32); tyre.rotateZ(Math.PI / 2);
    T.add(tyre, { color: 0x1b1c1e });
    for (let i = 0; i < 22; i++) {
      const a = i / 22 * Math.PI * 2;
      for (const sx of [-1, 1]) {
        const blk = new THREE.BoxGeometry(0.17, 0.05, 0.085);
        blk.rotateY(sx * 0.55); blk.translate(sx * 0.085, 0.565, 0); blk.rotateX(a);
        T.add(blk, { color: 0x232426 });
      }
    }
    const hub = new THREE.CylinderGeometry(0.31, 0.31, 0.44, 24); hub.rotateZ(Math.PI / 2);
    H.add(hub, { color: 0x8d939a });
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2;
      for (const sx of [-1, 1]) H.add(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 10).rotateZ(Math.PI / 2), { pos: V(sx * 0.222, Math.sin(a) * 0.19, Math.cos(a) * 0.19), color: 0x2c2f33 });
    }
    for (const sx of [-1, 1]) H.add(new THREE.CylinderGeometry(0.09, 0.11, 0.06, 14).rotateZ(Math.PI / 2), { pos: V(sx * 0.24, 0, 0), color: 0xd8a531 });
    const tyreGeo = T.build(), hubGeo = H.build();
    this.wheels = [];
    for (const z of [-1.9, 0, 1.9]) for (const x of [-1.48, 1.48]) {
      const w = new THREE.Group();
      mk(tyreGeo, tireMat, w); mk(hubGeo, mats.metal, w);
      w.position.set(x, 0.55, z);
      this.group.add(w);
      this.wheels.push({ m: w, x, z, y: 0 });
    }
    this.headlight = new THREE.SpotLight(0xfff1dd, 0, 70, 0.6, 0.5, 1.2);
    this.group.add(this.headlight);
    this.headlight.position.set(0, 1.5, -3.1);
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
    if (!this.present || this.cinematic) return;
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
      if (c.owner === 'rover') continue;
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
    const hf = (hAt(-1.48, -1.9) + hAt(1.48, -1.9)) / 2, hb = (hAt(-1.48, 1.9) + hAt(1.48, 1.9)) / 2;
    const hl = (hAt(-1.48, -1.9) + hAt(-1.48, 1.9)) / 2, hr = (hAt(1.48, -1.9) + hAt(1.48, 1.9)) / 2;
    const pitch = Math.atan2(hf - hb, 3.8), roll = Math.atan2(hl - hr, 2.96);
    this.group.position.copy(this.pos);
    this.group.rotation.set(pitch, this.yaw, roll, 'YXZ');
    for (const w of this.wheels) {
      w.m.rotation.x += this.speed * dt / 0.55;
    }
    this.headlight.intensity = this.driving && U.uNight.value > 0.3 ? 120 : 0;
    this.updateCollider();
  }

  // the rover is solid: one box for the body, refreshed when it moves
  updateCollider() {
    const C = this.game.colliders, k = this._ck || (this._ck = { x: NaN, z: NaN, y: NaN, yaw: NaN });
    if (!this.present) { if (!isNaN(k.x)) { C.removeOwner('rover'); k.x = NaN; } return; }
    if (Math.abs(k.x - this.pos.x) < 0.05 && Math.abs(k.z - this.pos.z) < 0.05 && Math.abs(k.y - this.pos.y) < 0.05 && Math.abs(k.yaw - this.yaw) < 0.01) return;
    C.removeOwner('rover');
    C.addBox(this.pos.x, this.pos.z, 1.62, 3.1, this.yaw, this.pos.y + 0.25, this.pos.y + 3.15, 'rover', {});
    k.x = this.pos.x; k.z = this.pos.z; k.y = this.pos.y; k.yaw = this.yaw;
  }

  near(p, r = 4) { return this.present && Math.hypot(p.x - this.pos.x, p.z - this.pos.z) < r; }
}
