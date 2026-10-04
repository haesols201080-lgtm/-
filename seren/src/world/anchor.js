// 하늘닻: 척추의 승강줄 30 km 높이에 걸린 역. 공기가 거의 없는 곳에서 세렌 전체와 먼 땅들이 내려다보인다.
// 척추 전망대의 승강차 정류장에서 오르고, 역 가장자리의 「뛰어내림 문」에서 활공해 어디로든 내려갈 수 있다.
import * as THREE from 'three';
import { mulberry32 } from '../core/noise.js';
import { part, merge, xf, lathe } from './geo-utils.js';
import * as A from './arch.js';
import { litMaterial, glowMaterial } from './materials.js';
import { hologramMaterial } from './hologram.js';
import { PointLights } from './lights.js';

const PAL = A.PAL;
export const ANCHOR_Y = 30000;
const R = 150; // 승강장 반지름

export class SkyAnchor {
  constructor(world, structures) {
    this.world = world;
    this.structures = structures;
    this.scene = world.scene;
    this.y = world.tetherTop;
    this.group = new THREE.Group();
    this.group.name = 'anchor';
    this.scene.add(this.group);
    this.mat = litMaterial({ vertexColors: true, vertexEmit: true, windows: true, emissive: 0xffffff, emissiveIntensity: 1.5, emissiveNight: 0.6, rim: 0.7, spec: 1.2, side: THREE.DoubleSide });
    this.lights = new PointLights(this.scene, 200, { minPx: 2.2, day: 0.6 });
    this.anims = [];
    this.t = 0;
    this.gates = [];
    this._build();
    // 척추 전망대의 정류장 (승강줄 바로 옆)
    const dy = structures.deckY;
    this.deckStop = { x: 46, y: dy, z: 0 };
    this.topStop = { x: 46, y: this.y, z: 0 };
    this._deckStop(dy);
    this.car = this._carMesh();
  }

  _build() {
    const Y = this.y;
    const parts = [];
    // 아래로 볼록한 원반 (밑면은 빛나는 공명 용골)
    parts.push(part(lathe([[0.0001, -60], [24, -58], [60, -44], [110, -22], [R, -6], [R + 3, 0], [R, 1.2], [36, 1.2]], 64), (x, y) => (y > -1 ? 0xb8b4c6 : y < -40 ? PAL.teal : 0xa8a4b8), (x, y) => (y < -50 ? 1.8 : y < -40 ? 0.8 : 0), 0));
    parts.push(part(xf(new THREE.RingGeometry(36, R, 64, 2), { y: 1.25, rx: -Math.PI / 2 }), 0x9a96aa, 0));
    for (const rr of [60, 100, R - 6]) parts.push(part(xf(new THREE.RingGeometry(rr - 0.6, rr + 0.6, 96), { y: 1.3, rx: -Math.PI / 2 }), rr === R - 6 ? PAL.amber : PAL.teal, 1.6));
    // 가운데 관(승강줄을 감싸는 원통 건물) + 유리 띠
    parts.push(part(lathe([[38, 0], [36, 30], [30, 60], [26, 120], [22, 160]], 48), (x, y) => (y > 150 ? PAL.gold : 0xb9c9d6), (x, y) => (y > 155 ? 1 : 0), 36 / 3.4));
    for (const y of [30, 60, 90, 120]) parts.push(part(xf(new THREE.TorusGeometry(30 + (120 - y) * 0.06 + 4, 0.8, 4, 48), { y, rx: Math.PI / 2 }), PAL.gold, 0.8));
    // 바깥 난간(유리)와 기둥
    const n = 48;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      if (i % 12 === 0) continue; // 뛰어내림 문 자리
      parts.push(part(xf(new THREE.BoxGeometry(0.5, 1.4, 0.5), { x: Math.cos(a) * (R - 1), y: 2, z: Math.sin(a) * (R - 1) }), 0xf2eef6, 0));
    }
    parts.push(part(xf(new THREE.TorusGeometry(R - 1, 0.15, 3, 128), { y: 2.6, rx: Math.PI / 2 }), 0xbffcff, 1.5));
    // 관측 정원과 집
    const rnd = mulberry32(30000);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.3, d = 70 + rnd() * 50;
      if (i % 2) A.place(parts, A.gardenBed({ r: 7 + rnd() * 3, seed: i }), { x: Math.cos(a) * d, y: 1.2, z: Math.sin(a) * d });
      else A.place(parts, A.domeHouse({ r: 6 + rnd() * 3, h: 8, seed: 900 + i, glow: i % 4 ? PAL.teal : PAL.amber }), { x: Math.cos(a) * d, y: 1.2, z: Math.sin(a) * d });
    }
    // 뛰어내림 문 (네 방향, 먼 땅을 향해)
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2;
      const gx = Math.cos(a) * (R - 4), gz = Math.sin(a) * (R - 4);
      A.place(parts, A.archGate({ span: 22, h: 18, glow: PAL.amber }), { x: gx, y: 1.2, z: gz, ry: -a + Math.PI / 2 });
      this.gates.push({ x: gx, z: gz, a });
      this.lights.add(gx, Y + 20, gz, PAL.amber, 10, 0.8, k * 0.25);
    }
    const m = new THREE.Mesh(merge(parts.map((p) => xf(p, { y: Y }))), this.mat);
    m.matrixAutoUpdate = false;
    this.group.add(m);
    // 충돌
    this.world.colliders.add({ type: 'cyl', x: 0, z: 0, r: R, y0: Y - 20, y1: Y + 1.25, sky: true });
    this.world.colliders.add({ type: 'cyl', x: 0, z: 0, r: 38, y0: Y, y1: Y + 160, walk: false, sky: true });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.3;
      if (i % 2 === 0) this.world.colliders.add({ type: 'cyl', x: Math.cos(a) * 95, z: Math.sin(a) * 95, r: 7, y0: Y, y1: Y + 8, dome: 4, sky: true });
    }
    // 위아래로 이어지는 빛, 세계 지도 홀로그램
    const holo = new THREE.Mesh(new THREE.CylinderGeometry(48, 48, 20, 64, 1, true), hologramMaterial({ color: PAL.teal, color2: 0xffffff, intensity: 1.2, scroll: 0.01, repeat: [5, 1], seed: 30 }));
    holo.position.set(0, Y + 40, 0);
    this.group.add(holo);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(R + 24, 1.6, 6, 128), glowMaterial({ color: PAL.teal, intensity: 1.4 }));
    ring.position.set(0, Y - 10, 0);
    ring.rotation.x = Math.PI / 2;
    this.group.add(ring);
    this.anims.push((t) => { ring.rotation.z = t * 0.02; });
    for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; this.lights.add(Math.cos(a) * (R + 24), Y - 10, Math.sin(a) * (R + 24), PAL.teal, 12, 0, 0); }
    this.lights.add(0, Y + 168, 0, 0xff5a4a, 30, 0.5, 0);
    this.structures.resonators.push({ x: 0, y: Y + 10, z: 0 });
  }

  _deckStop(dy) {
    const parts = [];
    const { x, z } = this.deckStop;
    parts.push(part(new THREE.CylinderGeometry(9, 10, 1, 24).translate(x, dy + 0.5, z), PAL.pearl2, 0));
    parts.push(part(xf(new THREE.TorusGeometry(8, 0.35, 6, 32), { x, y: dy + 1.1, z, rx: Math.PI / 2 }), PAL.amber, 1.6));
    const m = new THREE.Mesh(merge(parts), this.mat);
    m.matrixAutoUpdate = false;
    this.group.add(m);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(6, 8, 60, 20, 1, true).translate(0, 30, 0), glowMaterial({ color: PAL.amber, intensity: 0.4, fresnel: 1, side: THREE.DoubleSide }));
    beam.position.set(x, dy + 1, z);
    this.group.add(beam);
    this.world.colliders.add({ type: 'cyl', x, z, r: 9.5, y0: dy - 2, y1: dy + 1 });
  }

  _carMesh() {
    const parts = [];
    parts.push(part(lathe([[0.0001, -9], [6, -8], [8, -3], [8, 6], [6.5, 10], [0.0001, 11]], 20), (x, y) => (y > 0 && y < 6 ? 0x2c4c66 : PAL.pearl), (x, y) => (y > 1 && y < 5 ? 1.2 : 0)));
    parts.push(part(xf(new THREE.TorusGeometry(8.3, 0.5, 4, 28), { y: -1, rx: Math.PI / 2 }), PAL.amber, 1.8));
    parts.push(part(xf(new THREE.CylinderGeometry(3, 4, 1.2, 14), { y: -9.4 }), 0xffe6b0, 2.5));
    const m = new THREE.Mesh(merge(parts), this.mat);
    m.visible = false;
    this.scene.add(m);
    return m;
  }

  /** 정류장 근처인가 (위·아래) */
  stopNear(pos) {
    for (const [s, up] of [[this.deckStop, true], [this.topStop, false]]) {
      if (Math.hypot(pos.x - s.x, pos.z - s.z) < 9 && Math.abs(pos.y - s.y) < 4) return { stop: s, up };
    }
    return null;
  }

  /** 승강차 타기: up = 오르기 */
  makeRide(up, onArrive) {
    const y0 = up ? this.deckStop.y + 9 : this.topStop.y + 9;
    const y1 = up ? this.topStop.y + 9 : this.deckStop.y + 9;
    const L = Math.abs(y1 - y0);
    const car = this.car;
    car.visible = true;
    const x = this.deckStop.x, z = this.deckStop.z;
    const ride = {
      s: 0, v: 0, done: false, cam: { pos: new THREE.Vector3(), look: new THREE.Vector3() },
      step: (dt, player) => {
        const remain = L - ride.s;
        const acc = 70;
        ride.v = Math.min(1600, ride.v + acc * dt, Math.sqrt(Math.max(0, 2 * acc * remain)) + 3);
        ride.s = Math.min(L, ride.s + ride.v * dt);
        const y = y0 + Math.sign(y1 - y0) * ride.s;
        car.position.set(x, y, z);
        player.pos.set(x, y - 7, z);
        player.vel.set(0, (y1 > y0 ? 1 : -1) * ride.v, 0);
        // 카메라: 처음엔 가까이, 오를수록 멀어지며 아래 세상을 함께 담는다
        const k = Math.min(1, ride.s / 6000);
        const back = 30 + k * 90;
        const ang = ride.s * 0.00012 + 0.6;
        ride.cam.pos.set(x + Math.cos(ang) * back, y + (up ? 14 + k * 40 : -10 - k * 30), z + Math.sin(ang) * back);
        ride.cam.look.set(x, y + (up ? -20 - k * 400 : 30), z);
        if (ride.s >= L - 0.5) {
          ride.done = true;
          car.visible = false;
          const s = up ? this.topStop : this.deckStop;
          player.pos.set(s.x + 12, s.y + 1.3, s.z);
          player.vel.set(0, 0, 0);
          onArrive && onArrive(up);
        }
      },
      skip: () => { ride.s = Math.max(ride.s, L - 400); ride.v = Math.min(ride.v, 120); },
    };
    return ride;
  }

  update(dt) {
    this.t += dt;
    for (const f of this.anims) f(this.t, dt);
    this.lights.update();
  }
}
