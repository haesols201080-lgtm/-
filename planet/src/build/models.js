// Procedural building models. Local frame: origin at footprint centre,
// y = 0 is the walkable floor (top of the concrete pad), the door/front faces
// -Z. Every model returns parts by material plus colliders, interior volumes
// and light points via ModelBuilder.finish().
import * as THREE from 'three';
import { ModelBuilder, C, L, v, e, plinth, hazard, railing, stairs, antenna, vent, tank, pipe, lightBar, wall, room, airlock, greebleRoof, ribbonTower } from './modelkit.js';
import { houseT1, houseT2, houseT3, houseT4, market, lounge, clinic, school, lab, comms, hqExtras } from './models_colony.js';

const PI = Math.PI;

// ------------------------------------------------------------------ base
function pod(M) {
  plinth(M, 4, 4, { color: C.CONC2 });
  // landing legs
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * PI * 2 + PI / 4;
    const x = Math.cos(a) * 1.7, z = Math.sin(a) * 1.7;
    M.add('metal', new THREE.CylinderGeometry(0.07, 0.09, 2.2, 8), { pos: v(x * 0.75, 1.0, z * 0.75), rot: e(Math.sin(a) * 0.45, 0, -Math.cos(a) * 0.45), color: C.G2 });
    M.cyl('metal', x, 0, z, 0.32, 0.12, C.D, 12);
  }
  // capsule body
  const prof = [];
  for (let i = 0; i <= 16; i++) { const t = i / 16; prof.push(new THREE.Vector2(1.55 * Math.sin(Math.min(1, t * 1.25) * PI * 0.5) * (1 - Math.pow(t, 3) * 0.55) + 0.02, 0.6 + t * 3.2)); }
  M.add('hull', new THREE.LatheGeometry(prof, 28), { color: C.W });
  M.cyl('hull', 0, 0.45, 0, 1.5, 0.2, C.O, 28);
  M.cyl('metal', 0, 0.3, 0, 1.2, 0.2, C.D, 24);
  // heat shield scorch ring
  M.cyl('metal', 0, 0.62, 0, 1.58, 0.06, C.G2, 28);
  // hatch (front, -z)
  M.box('metal', 0, 1.6, -1.42, 0.95, 1.5, 0.2, C.G2);
  M.box('hull', 0, 1.6, -1.5, 0.8, 1.35, 0.08, C.W2);
  M.box('glass', 0, 2.0, -1.55, 0.4, 0.3, 0.04);
  lightBar(M, 0, 2.45, -1.5, 0.7, 0.05, 0.05, L.cyan);
  // windows & details
  for (let i = 0; i < 3; i++) { const a = PI * 0.5 + (i - 1) * 0.9 + PI; M.box('glass', Math.cos(a) * 1.38, 2.6, Math.sin(a) * 1.38, 0.35, 0.25, 0.1, undefined); }
  M.cyl('metal', 0, 3.75, 0, 0.35, 0.3, C.G, 16);
  antenna(M, 0.15, 4.0, 0, 1.2);
  M.box('hull', 0.9, 2.2, 1.0, 0.35, 0.8, 0.35, C.O);
  // parachute housing
  M.cyl('hull', 0, 3.55, 0, 0.6, 0.2, C.O, 20);
  M.colCyl(0, 0, 1.55, 0, 3.8);
  M.light(0, 2.5, -2.0, L.cyan, 3, 6);
}

function habitat(M) {
  plinth(M, 8, 8);
  hazard(M, 0, 0.02, -3.9, 2.4, 0.04, 0.3);
  room(M, 7.4, 7.4, 3.2, { door: 1.8, winSide: 2, winBack: 2 });
  // exterior corner pillars and trims
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    M.bb('metal', sx * 3.7 - 0.18, 0, sz * 3.7 - 0.18, sx * 3.7 + 0.18, 3.5, sz * 3.7 + 0.18, C.G2);
  }
  M.bb('hull', -3.85, 2.95, -3.85, 3.85, 3.2, 3.85, C.O);
  // airlock vestibule and wall pilasters
  airlock(M, 0, -3.7, 1.8, 2.6, 0.55, C.W2);
  for (const t of [-1.85, 1.85]) {
    M.box('metal', t, 1.6, 3.82, 0.24, 3.2, 0.2, C.G2);
    M.box('metal', -3.82, 1.6, t, 0.2, 3.2, 0.24, C.G2);
    M.box('metal', 3.82, 1.6, t, 0.2, 3.2, 0.24, C.G2);
  }
  for (const x of [-2.6, 2.6]) M.box('metal', x, 1.6, -3.82, 0.24, 3.2, 0.2, C.G2);
  // roof equipment
  vent(M, -2.2, 3.5, 1.8, 1.2, 0.9, 0.5);
  tank(M, 2.4, 3.5, 2.2, 0.4, 0.9);
  tank(M, 2.4, 3.5, 1.2, 0.4, 0.9);
  M.box('solar', -1.6, 3.75, -1.4, 2.4, 0.06, 1.6);
  M.box('metal', -1.6, 3.6, -1.4, 0.15, 0.3, 0.15, C.G);
  antenna(M, 2.8, 3.5, -2.8, 2.2);
  greebleRoof(M, -3.4, -3.4, -0.4, -0.2, 3.58, 101, 3);
  pipe(M, [[3.75, 0.6, -2.5], [3.95, 0.6, -2.5], [3.95, 3.2, -2.5], [3.5, 3.5, -2.5]], 0.07, C.G2);
  // ---- interior furnishing
  // bed (back-left)
  M.bb('metal', -3.4, 0.02, 1.2, -1.6, 0.42, 3.4, C.G2);
  M.bb('interior', -3.35, 0.42, 1.25, -1.65, 0.6, 3.35, 0xd8dde3);
  M.bb('interior', -3.3, 0.6, 2.75, -1.7, 0.72, 3.3, 0xf2f2ee);
  M.bb('interior', -3.35, 0.6, 1.25, -1.65, 0.66, 2.4, C.BLUE);
  // locker (back-right)
  M.bb('metal', 2.4, 0.02, 2.9, 3.45, 2.3, 3.45, C.G);
  M.bb('metal', 2.45, 0.2, 2.86, 2.9, 2.2, 2.9, C.G2);
  M.bb('metal', 2.95, 0.2, 2.86, 3.4, 2.2, 2.9, C.G2);
  lightBar(M, 2.92, 1.2, 2.84, 0.02, 0.3, 0.02, L.green);
  // workbench (right wall)
  M.bb('metal', 2.6, 0.02, -1.6, 3.45, 0.95, 1.4, C.G2);
  M.bb('interior', 2.55, 0.95, -1.65, 3.47, 1.0, 1.45, C.IN2);
  M.bb('emissive', 3.38, 1.3, -0.8, 3.42, 1.9, 0.4, L.cyan);
  M.bb('metal', 3.4, 1.25, -0.85, 3.45, 1.95, 0.45, C.D);
  M.cyl('metal', 3.0, 1.0, 0.9, 0.08, 0.5, C.D, 8);
  M.box('metal', 3.0, 1.55, 0.75, 0.08, 0.08, 0.35, C.O);
  // table + stools (centre-left)
  M.cyl('metal', -1.5, 0.02, -1.5, 0.08, 0.72, C.G, 10);
  M.cyl('interior', -1.5, 0.74, -1.5, 0.7, 0.05, C.IN1, 20);
  for (const [dx, dz] of [[-0.9, 0], [0.9, 0], [0, 0.9]]) M.cyl('interior', -1.5 + dx, 0.02, -1.5 + dz, 0.2, 0.45, C.O, 12);
  // plant pot
  M.cyl('interior', -3.1, 0.02, -2.9, 0.25, 0.4, C.G2, 12);
  M.sphere('plant', -3.1, 0.65, -2.9, 0.32, 0x3e7a35, 10, 0.9);
  // oxygen console near door
  M.bb('metal', -3.5, 0.02, -3.0, -3.1, 1.6, -2.3, C.G2);
  M.bb('emissive', -3.08, 1.0, -2.95, -3.06, 1.4, -2.35, L.cyan);
  // furniture colliders
  M.col(-3.4, 0, 1.2, -1.6, 0.66, 3.4);
  M.col(2.4, 0, 2.85, 3.5, 2.3, 3.5);
  M.col(2.6, 0, -1.6, 3.5, 1.0, 1.4);
  M.colCyl(-1.5, -1.5, 0.7, 0, 0.78);
  M.light(-2.5, 1.2, 2.4, L.warm, 1.2, 5);
}

function foundation(M) {
  M.bb('concrete', -4, -1.0, -4, 4, 0, 4, C.CONC);
  M.bb('metal', -4.05, -0.18, -4.05, 4.05, -0.02, 4.05, C.G2);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    M.bb('metal', sx * 3.4 - 0.3, -14, sz * 3.4 - 0.3, sx * 3.4 + 0.3, -1.0, sz * 3.4 + 0.3, C.G2);
    M.bb('metal', sx * 3.4 - 0.45, -1.15, sz * 3.4 - 0.45, sx * 3.4 + 0.45, -1.0, sz * 3.4 + 0.45, C.D);
  }
  M.bb('metal', -3.4, -2.2, -0.15, 3.4, -1.0, 0.15, C.G);
  M.bb('metal', -0.15, -2.2, -3.4, 0.15, -1.0, 3.4, C.G);
  // edge hazard markings (painted just above the slab)
  for (const [x0, z0, x1, z1] of [[-4, -4, 4, -3.82], [-4, 3.82, 4, 4], [-4, -3.82, -3.82, 3.82], [3.82, -3.82, 4, 3.82]]) {
    M.add('hull', new THREE.BoxGeometry(Math.abs(x1 - x0), 0.012, Math.abs(z1 - z0)), {
      pos: v((x0 + x1) / 2, 0.006, (z0 + z1) / 2),
      color: (lx, ly, lz) => (Math.floor((lx + lz) * 2.2 + 50) & 1 ? [0.92, 0.7, 0.08] : [0.12, 0.12, 0.12]),
    });
  }
  M.col(-4, -1.0, -4, 4, 0, 4);
}

function storage(M) {
  M.bb('concrete', -1.0, -1.2, -0.7, 1.0, 0, 0.7, C.CONC2);
  M.bb('hull', -0.9, 0, -0.6, 0.9, 1.0, 0.6, C.O);
  M.bb('metal', -0.95, 0.0, -0.65, 0.95, 0.12, 0.65, C.D);
  M.bb('hull', -0.92, 1.0, -0.62, 0.92, 1.12, 0.62, C.W2);
  for (const x of [-0.6, 0, 0.6]) M.bb('metal', x - 0.04, 0.12, -0.63, x + 0.04, 1.0, -0.6, C.D);
  M.bb('emissive', -0.2, 0.75, -0.625, 0.2, 0.82, -0.61, L.green);
  M.bb('metal', -0.4, 1.12, -0.06, 0.4, 1.18, 0.06, C.D);
  M.col(-0.95, 0, -0.65, 0.95, 1.18, 0.65);
}

function fabricator(M) {
  plinth(M, 3, 2, { color: C.CONC2 });
  M.bb('metal', -1.4, 0, -0.9, 1.4, 0.95, 0.9, C.G2);
  M.bb('hull', -1.45, 0.95, -0.95, 1.45, 1.05, 0.95, C.W);
  hazard(M, 0, 0.5, -0.92, 2.6, 0.08, 0.02);
  // robotic arm (animated base rotation)
  M.cyl('metal', 0.6, 1.05, 0.3, 0.18, 0.15, C.D, 12);
  const arm = M.animGroup('hull', { pivot: [0.6, 0, 0.3], axis: [0, 1, 0], speed: 0.7 });
  arm.add(new THREE.CylinderGeometry(0.07, 0.08, 0.7, 8), { pos: v(0.6, 1.5, 0.3), rot: e(0, 0, 0.3), color: C.O });
  arm.add(new THREE.CylinderGeometry(0.06, 0.06, 0.6, 8), { pos: v(0.32, 1.85, 0.3), rot: e(0, 0, 1.4), color: C.O });
  arm.add(new THREE.BoxGeometry(0.12, 0.2, 0.12), { pos: v(0.05, 1.78, 0.3), color: C.D });
  // screen
  M.bb('metal', -1.3, 1.05, 0.55, -0.3, 1.75, 0.65, C.D);
  M.bb('emissive', -1.25, 1.1, 0.53, -0.35, 1.7, 0.55, L.cyan);
  // parts tray
  M.bb('metal', -0.2, 1.05, -0.7, 0.4, 1.15, -0.2, C.G);
  M.col(-1.45, 0, -0.95, 1.45, 1.05, 0.95);
}

function lamp(M) {
  M.cyl('concrete', 0, -1, 0, 0.35, 1.15, C.CONC2, 12);
  M.cyl('metal', 0, 0, 0, 0.08, 5, C.G2, 8, 0.06);
  M.box('metal', 0, 5.0, -0.4, 0.2, 0.12, 1.0, C.D);
  M.box('emissive', 0, 4.92, -0.65, 0.16, 0.04, 0.5, L.warm);
  M.colCyl(0, 0, 0.2, 0, 5);
  M.light(0, 4.6, -0.65, L.warm, 30, 22);
}

function beacon(M) {
  for (let i = 0; i < 3; i++) {
    const a = i / 3 * PI * 2;
    M.add('metal', new THREE.CylinderGeometry(0.04, 0.05, 1.6, 6), { pos: v(Math.cos(a) * 0.35, 0.7, Math.sin(a) * 0.35), rot: e(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4), color: C.G2 });
  }
  M.cyl('hull', 0, 1.3, 0, 0.18, 0.3, C.O, 12);
  M.sphere('blink', 0, 1.75, 0, 0.18, L.orange, 12);
  M.colCyl(0, 0, 0.3, 0, 1.6);
}

// ------------------------------------------------------------------ power
function solar(M) {
  plinth(M, 4, 4, { color: C.CONC2 });
  M.cyl('metal', 0, 0, 0, 0.18, 1.6, C.G2, 10);
  M.box('metal', 0, 1.65, 0, 0.5, 0.25, 0.5, C.D);
  const tilt = 0.42;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * 0.95, z = sz * 0.95;
    const y = 1.95 + z * Math.sin(tilt) * -1;
    M.add('metal', new THREE.BoxGeometry(1.85, 0.08, 1.85), { pos: v(x, y - 0.05, z * Math.cos(tilt)), rot: e(tilt, 0, 0), color: C.G });
    M.add('solar', new THREE.BoxGeometry(1.78, 0.04, 1.78), { pos: v(x, y + 0.01, z * Math.cos(tilt)), rot: e(tilt, 0, 0) });
  }
  M.box('metal', 0, 1.95, 0, 3.9, 0.1, 0.12, C.G2);
  M.box('hull', 1.6, 0.5, -1.4, 0.5, 0.8, 0.3, C.W2);
  M.box('emissive', 1.6, 0.75, -1.56, 0.2, 0.06, 0.02, L.green);
  M.col(-0.3, 0, -0.3, 0.3, 1.8, 0.3);
  M.col(-1.9, 1.5, -1.9, 1.9, 2.8, 1.9, { noStand: true });
}

function pylon(M) {
  M.cyl('concrete', 0, -1, 0, 0.6, 1.2, C.CONC2, 10);
  const H = 9;
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    M.add('metal', new THREE.CylinderGeometry(0.05, 0.07, H + 0.4, 6), { pos: v(sx * 0.3, H / 2, sz * 0.3), rot: e(sz * -0.035, 0, sx * 0.035), color: C.G });
  }
  for (let y = 1; y < H; y += 1.5) {
    const w = 0.6 * (1 - y / H * 0.6) + 0.1;
    for (const [a, b] of [[[-w, -w], [w, w]], [[w, -w], [-w, w]]]) {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      M.add('metal', new THREE.CylinderGeometry(0.025, 0.025, len * 1.1, 4), { pos: v(0, y + 0.6, 0), rot: e(PI / 2, Math.atan2(b[0] - a[0], b[1] - a[1]), 0.6), color: C.G2 });
    }
  }
  M.box('metal', 0, H, 0, 2.6, 0.18, 0.18, C.G2);
  for (const x of [-1.1, 1.1]) {
    M.cyl('hull', x, H + 0.1, 0, 0.1, 0.45, 0x9a6e44, 8);
    for (let k = 0; k < 3; k++) M.cyl('hull', x, H + 0.15 + k * 0.13, 0, 0.16, 0.04, 0x7a4e2c, 10);
  }
  M.sphere('blink', 0, H + 0.5, 0, 0.1, L.red, 8);
  M.colCyl(0, 0, 0.45, 0, H);
}

function wind(M) {
  plinth(M, 3, 3, { color: C.CONC2 });
  const H = 16;
  M.cyl('hull', 0, 0, 0, 0.55, H, C.W, 16, 0.32);
  M.cyl('hull', 0, 3.0, 0, 0.5, 0.25, C.O, 16, 0.5);
  M.box('metal', 0, 0.9, -0.52, 0.7, 1.6, 0.1, C.G2);
  M.box('hull', 0, H + 0.4, 0.3, 0.9, 0.9, 2.2, C.W);
  M.box('hull', 0, H + 0.4, 1.35, 0.8, 0.8, 0.2, C.O);
  M.sphere('blink', 0, H + 0.95, 1.0, 0.08, L.red, 8);
  const rotor = M.animGroup('hull', { pivot: [0, H + 0.4, -0.95], axis: [0, 0, 1], speed: 1.2 });
  rotor.add(new THREE.SphereGeometry(0.42, 14, 10), { pos: v(0, H + 0.4, -1.0), scale: v(1, 1, 1.4), color: C.W2 });
  for (let i = 0; i < 3; i++) {
    const a = i / 3 * PI * 2;
    const blade = new THREE.BoxGeometry(0.42, 7.2, 0.08);
    blade.translate(0, 3.9, 0);
    const pos = blade.attributes.position;
    for (let k = 0; k < pos.count; k++) { const y = pos.getY(k); pos.setX(k, pos.getX(k) * (1.2 - y / 9)); }
    rotor.add(blade, { pos: v(0, H + 0.4, -1.1), rot: e(0, 0, a), color: (x, y) => (y > 6.6 ? [0.9, 0.35, 0.08] : [0.9, 0.9, 0.88]) });
  }
  M.colCyl(0, 0, 0.6, 0, H);
}

function reactor(M) {
  plinth(M, 8, 8);
  // cooling tower (hyperboloid)
  const prof = [];
  for (let i = 0; i <= 14; i++) { const t = i / 14; prof.push(new THREE.Vector2(1.9 - Math.sin(t * PI) * 0.65 + t * 0.15, t * 9)); }
  M.add('concrete', new THREE.LatheGeometry(prof, 32), { pos: v(1.6, 0, 1.4), color: C.CONC });
  M.cyl('concrete', 1.6, 8.6, 1.4, 1.95, 0.4, C.CONC2, 32);
  M.cyl('hull', 1.6, 6.5, 1.4, 1.62, 0.6, C.O, 32);
  // containment dome
  M.cyl('hull', -1.8, 0, -1.6, 1.9, 2.5, C.W, 28);
  M.dome('hull', -1.8, 2.5, -1.6, 1.9, C.W);
  M.cyl('metal', -1.8, 2.3, -1.6, 1.95, 0.25, C.G2, 28);
  hazard(M, -1.8, 0.4, -3.52, 1.4, 0.3, 0.04);
  M.box('metal', -1.8, 1.0, -3.45, 1.0, 2.0, 0.2, C.G2);
  // pipes and turbine hall
  M.bb('hull', 0.4, 0, -3.6, 3.6, 3.0, -1.0, C.W2);
  M.bb('metal', 0.3, 3.0, -3.7, 3.7, 3.2, -0.9, C.G2);
  for (let i = 0; i < 3; i++) M.box('glass', 1.0 + i, 2.2, -3.62, 0.7, 0.8, 0.04);
  pipe(M, [[-0.2, 1.5, -1.6], [0.4, 1.5, -1.6]], 0.22, C.G);
  pipe(M, [[1.6, 1.0, -0.4], [1.6, 1.0, -1.0]], 0.25, C.G);
  pipe(M, [[-1.8, 4.3, -1.6], [-1.8, 5.0, -1.6], [0.6, 5.0, 0.5], [0.6, 6.0, 1.0]], 0.15, C.O);
  vent(M, 2.8, 3.2, -2.5, 1.2, 1.0, 0.6);
  antenna(M, -3.4, 0, 3.2, 6);
  lightBar(M, -1.8, 2.15, -3.56, 1.2, 0.08, 0.04, L.green);
  M.colCyl(1.6, 1.4, 2.0, 0, 9);
  M.colCyl(-1.8, -1.6, 1.95, 0, 4.4);
  M.col(0.4, 0, -3.6, 3.6, 3.2, -1.0);
}

// ------------------------------------------------------------------ terraforming
function heater(M, big = false) {
  const s = big ? 1.35 : 1;
  plinth(M, 3 * s, 3 * s, { color: C.CONC2 });
  M.bb('hull', -1.2 * s, 0, -1.2 * s, 1.2 * s, 1.2 * s, 1.2 * s, C.W2);
  M.bb('metal', -1.25 * s, 1.2 * s, -1.25 * s, 1.25 * s, 1.35 * s, 1.25 * s, C.D);
  // glowing radiator fins
  for (let i = 0; i < 7; i++) {
    const x = (-0.9 + i * 0.3) * s;
    M.bb('metal', x - 0.04, 1.35 * s, -0.9 * s, x + 0.04, 2.3 * s, 0.9 * s, C.G2);
    M.bb('emissive', x - 0.02, 1.4 * s, -0.85 * s, x + 0.02, 2.2 * s, 0.85 * s, L.orange);
  }
  M.bb('metal', -1.1 * s, 2.3 * s, -1.0 * s, 1.1 * s, 2.4 * s, 1.0 * s, C.G2);
  hazard(M, 0, 0.6 * s, -1.21 * s, 2.0 * s, 0.2, 0.02);
  M.box('emissive', 0.7 * s, 0.95 * s, -1.22 * s, 0.25, 0.1, 0.02, L.green);
  pipe(M, [[1.2 * s, 0.4, 0.6 * s], [1.45 * s, 0.4, 0.6 * s], [1.45 * s, -0.4, 0.6 * s]], 0.09, C.G);
  if (big) {
    M.cyl('hull', -1.0 * s, 2.4 * s, 1.0 * s, 0.35, 2.0, C.W, 14);
    M.cyl('metal', -1.0 * s, 4.4 * s, 1.0 * s, 0.4, 0.2, C.D, 14);
    tank(M, 1.6 * s, 0, 1.4 * s, 0.45, 1.6);
  }
  M.light(0, 2.6 * s, 0, L.orange, big ? 10 : 6, big ? 12 : 8);
  M.col(-1.25 * s, 0, -1.25 * s, 1.25 * s, 2.4 * s, 1.25 * s);
}

function drill(M, big = false) {
  const s = big ? 1.3 : 1;
  const H = big ? 11 : 7;
  plinth(M, 3 * s, 3 * s, { color: C.CONC2 });
  M.bb('metal', -1.3 * s, 0, -1.3 * s, 1.3 * s, 0.4, 1.3 * s, C.G2);
  // tripod derrick
  // legs (explicit, correct direction)
  M.gb('metal');
  for (let i = 0; i < 3; i++) {
    const a = i / 3 * PI * 2 + PI / 6;
    const x = Math.cos(a) * 1.15 * s, z = Math.sin(a) * 1.15 * s;
    pipe(M, [[x, 0.4, z], [0, H, 0]], 0.08, C.O);
  }
  M.cyl('metal', 0, H - 0.3, 0, 0.35, 0.5, C.D, 12);
  M.sphere('blink', 0, H + 0.4, 0, 0.1, L.red, 8);
  // rotating drill string
  const bit = M.animGroup('metal', { pivot: [0, 0, 0], axis: [0, 1, 0], speed: 3.0 });
  bit.add(new THREE.CylinderGeometry(0.12, 0.12, H - 0.5, 10), { pos: v(0, (H - 0.5) / 2 + 0.2, 0), color: (x, y) => (Math.floor(y * 2) & 1 ? [0.6, 0.62, 0.65] : [0.35, 0.36, 0.38]) });
  bit.add(new THREE.BoxGeometry(0.5, 0.12, 0.12), { pos: v(0, H * 0.45, 0), color: [0.8, 0.4, 0.1] });
  // gas tanks + compressor
  tank(M, 1.5 * s, 0.4, -0.9 * s, 0.38 * s, 1.4 * s);
  tank(M, 1.5 * s, 0.4, 0.1 * s, 0.38 * s, 1.4 * s);
  M.bb('hull', -1.5 * s, 0.4, 0.4 * s, -0.6 * s, 1.5, 1.4 * s, C.W2);
  M.box('emissive', -1.05 * s, 1.1, 0.38 * s, 0.4, 0.08, 0.02, L.cyan);
  pipe(M, [[1.5 * s, 1.0, -0.4 * s], [0.4, 1.0, -0.2], [0.15, 1.0, 0]], 0.07, C.G);
  if (big) { vent(M, -1.0 * s, 0.4, -1.0 * s, 0.8, 0.7, 0.5); M.cyl('hull', -1.0 * s, 0.9, -1.0 * s, 0.22, 4.0, C.W2, 12); }
  M.col(-1.3 * s, 0, -1.3 * s, 1.3 * s, 1.5, 1.3 * s);
  M.colCyl(0, 0, 0.5, 0, H);
}

function vegetube(M) {
  plinth(M, 2.4, 2.4, { color: C.CONC2 });
  M.cyl('metal', 0, 0, 0, 1.0, 0.45, C.G2, 20);
  M.cyl('hull', 0, 0.45, 0, 0.95, 0.12, C.O, 20);
  M.add('window', new THREE.CylinderGeometry(0.85, 0.85, 2.3, 24, 1, true), { pos: v(0, 1.72, 0) });
  M.cyl('metal', 0, 2.85, 0, 0.95, 0.25, C.G2, 20);
  M.dome('hull', 0, 3.1, 0, 0.7, C.W, 16);
  // plants inside + grow lights
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4, r = 0.2 + (i % 3) * 0.2;
    M.add('plant', new THREE.ConeGeometry(0.13, 0.5 + (i % 4) * 0.25, 6), { pos: v(Math.cos(a) * r, 0.85 + (i % 4) * 0.12, Math.sin(a) * r), color: [0.25, 0.65, 0.2] });
    M.sphere('plant', Math.cos(a) * r, 0.7, Math.sin(a) * r, 0.18, 0x2f7a2a, 8, 0.7);
  }
  M.cyl('emissive', 0, 2.7, 0, 0.6, 0.06, 0xd070ff, 16);
  pipe(M, [[0.95, 0.3, 0], [1.15, 0.3, 0], [1.15, -0.5, 0]], 0.06, C.G);
  M.colCyl(0, 0, 1.0, 0, 3.2);
}

function seeder(M) {
  plinth(M, 3, 3, { color: C.CONC2 });
  M.cyl('hull', 0, 0, 0, 1.2, 1.4, C.W2, 18);
  M.cyl('metal', 0, 1.4, 0, 1.25, 0.15, C.D, 18);
  // hopper
  M.add('hull', new THREE.CylinderGeometry(0.9, 0.4, 1.2, 16), { pos: v(0, 2.15, 0), color: C.GREEN });
  M.cyl('metal', 0, 2.75, 0, 0.95, 0.1, C.G2, 16);
  M.cyl('metal', 0, 2.85, 0, 0.12, 2.6, C.G, 10);
  const spin = M.animGroup('hull', { pivot: [0, 0, 0], axis: [0, 1, 0], speed: 1.6 });
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * PI * 2;
    spin.add(new THREE.BoxGeometry(1.8, 0.08, 0.18), { pos: v(Math.cos(a) * 0.9, 5.3, Math.sin(a) * 0.9), rot: e(0, -a, 0), color: C.O });
    spin.add(new THREE.SphereGeometry(0.16, 10, 8), { pos: v(Math.cos(a) * 1.8, 5.3, Math.sin(a) * 1.8), color: [0.9, 0.9, 0.85] });
  }
  M.cyl('emissive', 0, 5.0, 0, 0.18, 0.15, L.green, 12);
  M.box('glass', 0, 0.9, -1.21, 0.8, 0.4, 0.04);
  M.colCyl(0, 0, 1.25, 0, 2.8);
}

function algae(M) {
  // floating platform (sits on the water level)
  M.bb('metal', -1.6, -0.6, -1.6, 1.6, 0.0, 1.6, C.G2);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) M.cyl('hull', sx * 1.25, -1.2, sz * 1.25, 0.35, 1.0, C.O, 12);
  M.bb('hull', -1.5, 0.0, -1.5, 1.5, 0.35, 1.5, C.W2);
  for (const sx of [-0.7, 0.7]) {
    M.bb('metal', sx - 0.6, 0.35, -1.2, sx + 0.6, 0.55, 1.2, C.G);
    M.bb('plant', sx - 0.52, 0.5, -1.12, sx + 0.52, 0.56, 1.12, 0x2f9a55);
  }
  M.add('window', new THREE.BoxGeometry(2.9, 0.9, 2.9), { pos: v(0, 1.05, 0) });
  M.bb('metal', -1.5, 1.5, -1.5, 1.5, 1.6, 1.5, C.G2);
  antenna(M, 1.3, 1.6, 1.3, 1.2);
  lightBar(M, 0, 1.45, 0, 2.4, 0.04, 0.08, 0xc070ff);
  railing(M, -1.6, -1.6, 1.6, -1.6, 0.35, 0.6);
  M.col(-1.6, -0.6, -1.6, 1.6, 1.6, 1.6);
}

function treespreader(M) {
  plinth(M, 4, 4, { color: C.CONC2 });
  M.cyl('hull', 0, 0, 0, 1.7, 1.8, C.W, 20);
  M.dome('window', 0, 1.8, 0, 1.6, undefined, 20);
  // a young tree inside the dome
  M.cyl('plant', 0, 1.8, 0, 0.1, 1.0, 0x5a3b26, 8);
  M.sphere('plant', 0, 3.0, 0, 0.75, 0x2f7a3a, 12, 0.7);
  M.cyl('metal', 0, 1.75, 0, 1.75, 0.12, C.G2, 20);
  // mast with spreading arms
  M.cyl('metal', 1.8, 0, 1.8, 0.15, 9, C.G, 10);
  const spin = M.animGroup('hull', { pivot: [1.8, 0, 1.8], axis: [0, 1, 0], speed: 0.8 });
  for (let i = 0; i < 3; i++) {
    const a = i / 3 * PI * 2;
    spin.add(new THREE.BoxGeometry(3.0, 0.1, 0.25), { pos: v(1.8 + Math.cos(a) * 1.5, 8.6, 1.8 + Math.sin(a) * 1.5), rot: e(0, -a, 0), color: C.GREEN });
  }
  M.cyl('emissive', 1.8, 9.0, 1.8, 0.2, 0.2, L.green, 10);
  hazard(M, 0, 0.5, -1.72, 1.4, 0.2, 0.04);
  M.colCyl(0, 0, 1.75, 0, 3.4);
  M.colCyl(1.8, 1.8, 0.2, 0, 9);
}

function insectdome(M) {
  plinth(M, 6, 6);
  const geo = new THREE.IcosahedronGeometry(2.8, 1);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) < 0) p.setY(i, 0);
  geo.computeVertexNormals();
  M.add('window', geo, { pos: v(0, 0.3, 0) });
  const frame = new THREE.IcosahedronGeometry(2.82, 1);
  const edges = new THREE.EdgesGeometry(frame);
  const ep = edges.attributes.position;
  for (let i = 0; i < ep.count; i += 2) {
    const a = v(ep.getX(i), Math.max(0, ep.getY(i)), ep.getZ(i)), b = v(ep.getX(i + 1), Math.max(0, ep.getY(i + 1)), ep.getZ(i + 1));
    if (a.y <= 0 && b.y <= 0) continue;
    pipe(M, [[a.x, a.y + 0.3, a.z], [b.x, b.y + 0.3, b.z]], 0.035, C.W2);
  }
  M.cyl('metal', 0, 0, 0, 2.9, 0.3, C.G2, 24);
  for (let i = 0; i < 12; i++) {
    const a = i * 2.1, r = 0.6 + (i % 4) * 0.45;
    M.sphere('plant', Math.cos(a) * r, 0.6, Math.sin(a) * r, 0.35 + (i % 3) * 0.12, [0x3f8a3a, 0x7a4fb8, 0x2f7a5a][i % 3], 8, 0.8);
  }
  M.cyl('emissive', 0, 2.95, 0, 0.3, 0.1, 0xffd070, 12);
  M.box('metal', 0, 1.0, -2.75, 1.2, 2.0, 0.3, C.G2);
  M.colCyl(0, 0, 2.85, 0, 3.0);
}

function mirror(M) {
  plinth(M, 8, 8);
  M.cyl('concrete', 0, 0, 0, 2.6, 1.0, C.CONC2, 24);
  M.cyl('hull', 0, 1.0, 0, 1.4, 2.0, C.W, 20);
  const dish = M.animGroup('hull', { pivot: [0, 0, 0], axis: [0, 1, 0], speed: 0.15 });
  const d = new THREE.SphereGeometry(3.6, 32, 8, 0, PI * 2, 0, 0.6);
  d.rotateX(PI); d.rotateX(-0.9); d.translate(0, 5.2, 0.4);
  dish.add(d, { color: C.W });
  dish.add(new THREE.CylinderGeometry(0.06, 0.06, 3.0, 6), { pos: v(0, 6.1, -0.8), rot: e(-0.6, 0, 0), color: C.G });
  dish.add(new THREE.SphereGeometry(0.25, 10, 8), { pos: v(0, 7.3, -1.7), color: C.O });
  M.bb('hull', -3.6, 0, -3.6, -1.6, 2.6, -1.4, C.W2);
  for (let i = 0; i < 3; i++) M.box('glass', -2.6, 1.7, -3.62 + 0.0001, 1.5, 0.5, 0.04);
  antenna(M, 3.2, 0, -3.2, 5);
  M.colCyl(0, 0, 2.6, 0, 3.0);
  M.col(-3.6, 0, -3.6, -1.6, 2.6, -1.4);
}

// ------------------------------------------------------------------ industry
function extractor(M) {
  plinth(M, 5, 5, { color: C.CONC2 });
  // four legs + gantry over the deposit
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) M.bb('metal', sx * 2.0 - 0.18, 0, sz * 2.0 - 0.18, sx * 2.0 + 0.18, 4.2, sz * 2.0 + 0.18, C.O);
  M.bb('metal', -2.3, 4.2, -2.3, 2.3, 4.6, 2.3, C.G2);
  M.bb('hull', -1.3, 4.6, -1.3, 1.3, 6.0, 1.3, C.W);
  M.bb('hull', -1.35, 5.4, -1.35, 1.35, 5.6, 1.35, C.O);
  vent(M, 0.5, 6.0, 0.5, 0.8, 0.8, 0.4);
  // rotating drill head
  const drillHead = M.animGroup('metal', { pivot: [0, 0, 0], axis: [0, 1, 0], speed: 4.0 });
  drillHead.add(new THREE.CylinderGeometry(0.35, 0.35, 3.6, 12), { pos: v(0, 2.4, 0), color: (x, y) => (Math.floor(y * 2.5) & 1 ? [0.55, 0.57, 0.6] : [0.3, 0.31, 0.33]) });
  drillHead.add(new THREE.ConeGeometry(0.6, 0.9, 8), { pos: v(0, 0.35, 0), rot: e(PI, 0, 0), color: [0.75, 0.55, 0.2] });
  // ore hopper + chute
  M.bb('hull', 1.4, 0, -2.4, 2.4, 1.6, -1.4, C.W2);
  M.add('metal', new THREE.BoxGeometry(0.5, 0.1, 2.2), { pos: v(1.2, 2.8, -1.5), rot: e(0.5, 0, 0), color: C.G });
  M.box('emissive', 1.9, 1.3, -2.42, 0.4, 0.08, 0.02, L.green);
  hazard(M, 0, 0.03, 2.3, 4.2, 0.04, 0.3);
  M.sphere('blink', 2.2, 4.8, 2.2, 0.1, L.orange, 8);
  M.light(0, 3.9, 0, L.warm, 5, 9);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) M.colCyl(sx * 2.0, sz * 2.0, 0.25, 0, 4.2);
  M.col(1.4, 0, -2.4, 2.4, 1.6, -1.4);
  M.col(-2.3, 4.2, -2.3, 2.3, 6.0, 2.3);
}

function smelter(M) {
  plinth(M, 6, 5);
  M.bb('hull', -2.8, 0, -2.3, 1.4, 3.8, 2.3, C.W2);
  M.bb('metal', -2.9, 3.8, -2.4, 1.5, 4.0, 2.4, C.G2);
  M.bb('hull', -2.85, 2.9, -2.35, 1.45, 3.1, 2.35, C.O);
  // furnace mouth glow
  M.bb('metal', -1.4, 0.4, -2.36, 0.0, 1.8, -2.3, C.D);
  M.bb('emissive', -1.3, 0.5, -2.37, -0.1, 1.5, -2.35, L.orange);
  // chimneys
  M.cyl('hull', -2.0, 3.8, 1.3, 0.4, 3.4, C.W, 14);
  M.cyl('metal', -2.0, 7.2, 1.3, 0.45, 0.25, C.D, 14);
  M.cyl('hull', -2.0, 6.2, 1.3, 0.42, 0.3, C.O, 14);
  M.cyl('hull', -0.8, 3.8, 1.5, 0.3, 2.2, C.W, 12);
  // intake hoppers
  for (const z of [-1.3, 0.2]) {
    M.add('hull', new THREE.CylinderGeometry(0.7, 0.25, 1.2, 12), { pos: v(2.3, 2.6, z), color: C.O });
    M.cyl('metal', 2.3, 0, z, 0.2, 2.0, C.G2, 8);
  }
  pipe(M, [[2.3, 2.0, 0.9], [2.3, 2.0, 1.8], [1.45, 2.0, 1.8]], 0.12, C.G);
  for (let i = 0; i < 3; i++) M.box('glass', 2.0 - 0.9 * i - 1.4, 3.3, 2.32, 0.6, 0.4, 0.04);
  vent(M, 0.3, 4.0, -1.0, 1.0, 0.8, 0.4);
  M.light(-0.7, 1.2, -3.0, L.orange, 6, 8);
  M.col(-2.85, 0, -2.35, 1.45, 4.0, 2.35);
}

function assembler(M) {
  plinth(M, 6, 6);
  M.bb('hull', -2.7, 0, -2.7, 2.7, 4.2, 2.7, C.W);
  M.bb('metal', -2.8, 4.2, -2.8, 2.8, 4.4, 2.8, C.G2);
  M.bb('hull', -2.75, 0, -2.75, 2.75, 0.5, 2.75, C.D);
  // big front window showing robot arms
  M.bb('metal', -2.2, 1.0, -2.76, 2.2, 3.4, -2.7, C.G2);
  M.box('glass', 0, 2.2, -2.78, 4.2, 2.2, 0.04);
  hazard(M, 0, 0.75, -2.76, 5.2, 0.15, 0.04);
  // roof units
  vent(M, -1.2, 4.4, 1.0, 1.4, 1.2, 0.6);
  vent(M, 1.3, 4.4, 1.2, 1.0, 0.9, 0.5);
  M.cyl('metal', 1.4, 4.4, -1.5, 0.5, 0.8, C.G, 14);
  antenna(M, -2.3, 4.4, -2.3, 1.8);
  // side conveyor port
  M.bb('metal', 2.7, 0.8, -0.6, 3.0, 1.6, 0.6, C.D);
  M.bb('emissive', 2.71, 1.7, -0.5, 2.73, 1.78, 0.5, L.cyan);
  for (let i = 0; i < 3; i++) M.box('emissive', -2.0 + i * 2, 4.0, -2.72, 0.8, 0.06, 0.02, L.cyan);
  M.col(-2.75, 0, -2.75, 2.75, 4.4, 2.75);
}

function dronehub(M) {
  plinth(M, 5, 5);
  M.bb('concrete', -2.4, 0, -2.4, 2.4, 0.4, 2.4, C.CONC);
  // landing pad markings
  M.add('emissive', new THREE.RingGeometry(1.5, 1.65, 32), { pos: v(0, 0.41, 0), rot: e(-PI / 2, 0, 0), color: L.cyan });
  M.add('hull', new THREE.BoxGeometry(1.4, 0.01, 0.25), { pos: v(0, 0.408, 0), color: C.Y });
  M.add('hull', new THREE.BoxGeometry(0.25, 0.01, 1.4), { pos: v(0, 0.408, 0), color: C.Y });
  // control mast
  M.bb('hull', 1.7, 0.4, 1.7, 2.4, 3.6, 2.4, C.W);
  M.bb('glass', 1.65, 2.6, 1.65, 2.45, 3.3, 2.45, undefined);
  M.cyl('metal', 2.05, 3.6, 2.05, 0.3, 0.2, C.G2, 12);
  const radar = M.animGroup('hull', { pivot: [2.05, 0, 2.05], axis: [0, 1, 0], speed: 1.0 });
  radar.add(new THREE.BoxGeometry(1.0, 0.25, 0.06), { pos: v(2.05, 4.05, 2.05), color: C.O });
  // charging docks
  for (const [x, z] of [[-1.9, -1.9], [1.9, -1.9], [-1.9, 1.9]]) {
    M.cyl('metal', x, 0.4, z, 0.35, 0.3, C.G2, 12);
    M.cyl('emissive', x, 0.7, z, 0.25, 0.04, L.green, 12);
  }
  M.light(0, 2.0, 0, L.cyan, 5, 10);
  M.col(-2.4, 0, -2.4, 2.4, 0.4, 2.4);
  M.col(1.7, 0, 1.7, 2.4, 3.6, 2.4);
}

function depot(M) {
  plinth(M, 6, 6);
  room(M, 5.8, 5.8, 3.6, { door: 2.6, doorH: 3.0, winSide: 0, winBack: 0, color: C.W2, roofColor: C.G });
  // container stacks inside
  const cols = [C.O, C.BLUE, C.TEAL, C.W2, C.RED];
  let k = 0;
  for (const x of [-2.0, 1.9]) for (const z of [-0.6, 0.8, 2.1]) {
    const h = 0.9 + (k % 2) * 0.9;
    M.bb('hull', x - 0.55, 0.02, z - 0.55, x + 0.55, h, z + 0.55, cols[k % cols.length]);
    M.col(x - 0.55, 0, z - 0.55, x + 0.55, h, z + 0.55);
    k++;
  }
  hazard(M, 0, 3.15, -2.92, 2.6, 0.12, 0.04);
  vent(M, 0, 3.98, 1.0, 1.4, 1.0, 0.4);
}

// ------------------------------------------------------------------ colony
function hq(M) {
  plinth(M, 16, 16);
  // central hall: enterable lobby (12 x 10 x 5)
  room(M, 11, 9, 4.6, { door: 2.4, doorH: 3.0, winSide: 3, winBack: 3, winFront: [{ a: 1.0, b: 3.4, y0: 1.0, y1: 3.6, kind: 'window' }, { a: 7.6, b: 10.0, y0: 1.0, y1: 3.6, kind: 'window' }], color: C.W });
  // second floor block + glass crown
  M.bb('hull', -4.5, 4.9, -3.2, 4.5, 7.6, 3.2, C.W2);
  M.col(-4.5, 4.9, -3.2, 4.5, 7.6, 3.2);
  for (let i = 0; i < 6; i++) M.box('glass', -3.6 + i * 1.45, 6.3, -3.22, 1.1, 1.6, 0.04);
  for (let i = 0; i < 6; i++) M.box('glass', -3.6 + i * 1.45, 6.3, 3.22, 1.1, 1.6, 0.04);
  M.bb('hull', -4.6, 7.6, -3.3, 4.6, 7.9, 3.3, C.O);
  // central tower rising from the roof
  ribbonTower(M, 0, -0.2, 2.3, 9.6, { y0: 7.9, lobby: false, fins: 6 });
  // comms tower
  M.cyl('hull', 4.0, 7.9, 2.0, 0.35, 6, C.W, 12, 0.22);
  const dish = M.animGroup('hull', { pivot: [4.0, 0, 2.0], axis: [0, 1, 0], speed: 0.3 });
  const d = new THREE.SphereGeometry(1.1, 18, 6, 0, PI * 2, 0, 0.7); d.rotateX(PI * 0.62); d.translate(4.0, 13.4, 2.0);
  dish.add(d, { color: C.W2 });
  M.sphere('blink', 4.0, 14.2, 2.0, 0.15, L.red, 8);
  // landing pad on the east wing
  M.bb('concrete', 5.8, 0, -7.6, 7.9, 0.15, 7.6, C.CONC2);
  // west wing: storage silos
  for (const z of [-5.5, -3.3]) tank(M, -6.6, 0, z, 0.9, 3.4, C.W2, C.O);
  M.bb('hull', -7.6, 0, 1.0, -5.8, 2.6, 7.4, C.W2);
  M.col(-7.6, 0, 1.0, -5.8, 2.6, 7.4);
  M.colCyl(-6.6, -5.5, 0.95, 0, 4.3); M.colCyl(-6.6, -3.3, 0.95, 0, 4.3);
  for (let i = 0; i < 4; i++) M.box('glass', -5.78, 1.6, 1.8 + i * 1.5, 0.04, 0.8, 1.0);
  // front plaza details
  hazard(M, 0, 0.02, -5.2, 3.0, 0.04, 0.4);
  for (const x of [-3, 3]) { M.cyl('metal', x, 0, -6.6, 0.08, 3.4, C.G2, 8); M.box('metal', x, 3.42, -6.45, 0.22, 0.1, 0.7, C.D); M.box('emissive', x, 3.36, -6.4, 0.14, 0.03, 0.55, L.warm); }
  lightBar(M, 0, 4.0, -4.62, 3.0, 0.12, 0.06, L.cyan);
  // lobby interior: reception desk, holo table, benches
  M.bb('metal', -1.8, 0.02, -1.6, 1.8, 1.05, -0.9, C.G2);
  M.bb('interior', -1.85, 1.05, -1.65, 1.85, 1.12, -0.85, C.IN1);
  M.bb('emissive', -1.5, 1.15, -1.05, 1.5, 1.6, -1.02, L.cyan);
  M.cyl('metal', 2.8, 0.02, 1.8, 0.9, 0.8, C.D, 20);
  M.cyl('emissive', 2.8, 0.82, 1.8, 0.8, 0.03, L.cyan, 20);
  M.cyl('emissive', 2.8, 1.4, 1.8, 0.04, 1.0, L.cyan, 6);
  for (const x of [-3.8, -2.0]) { M.bb('interior', x - 0.7, 0.02, 3.3, x + 0.7, 0.45, 3.9, C.O); }
  M.col(-1.85, 0, -1.65, 1.85, 1.12, -0.85);
  M.colCyl(2.8, 1.8, 0.9, 0, 0.85);
  M.light(-2.5, 3.6, 1.5, L.warm, 6, 10);
  M.light(2.8, 2.0, 1.8, L.cyan, 3, 6);
}

function farm(M) {
  plinth(M, 8, 12);
  const w = 7.4, d = 11.4, h = 2.4;
  // low walls + arched glass roof
  wall(M, 'x', -w / 2, -d / 2, w, 1.0, 0.2, [{ a: w / 2 - 0.9, b: w / 2 + 0.9, y0: 0, y1: 2.3, kind: 'door' }], { color: C.W2 });
  wall(M, 'x', -w / 2, d / 2, w, 1.0, 0.2, [], { color: C.W2 });
  wall(M, 'z', -w / 2, -d / 2 + 0.1, d - 0.2, 1.0, 0.2, [], { color: C.W2 });
  wall(M, 'z', w / 2, -d / 2 + 0.1, d - 0.2, 1.0, 0.2, [], { color: C.W2 });
  const arch = new THREE.CylinderGeometry(w / 2, w / 2, d, 24, 1, true, -PI / 2, PI);
  arch.rotateX(PI / 2); arch.rotateY(PI / 2); arch.rotateZ(0);
  const ap = arch.attributes.position;
  for (let i = 0; i < ap.count; i++) ap.setY(i, ap.getY(i) * 0.55);
  arch.rotateX(0);
  M.add('window', arch, { pos: v(0, h - 1.4 + 1.0, 0), rot: e(0, PI / 2, 0) });
  for (let i = 0; i <= 6; i++) {
    const z = -d / 2 + i * d / 6;
    const rib = new THREE.TorusGeometry(w / 2, 0.06, 6, 24, PI);
    const rp = rib.attributes.position;
    for (let k = 0; k < rp.count; k++) rp.setY(k, rp.getY(k) * 0.55);
    M.add('metal', rib, { pos: v(0, 2.0, z), color: C.W2 });
  }
  // glass end caps of the arch
  for (const zz of [-d / 2, d / 2]) {
    const cap = new THREE.CircleGeometry(w / 2, 24, 0, Math.PI);
    const cp = cap.attributes.position;
    for (let k = 0; k < cp.count; k++) cp.setY(k, cp.getY(k) * 0.55);
    M.add('window', cap, { pos: v(0, 2.0, zz) });
  }
  // colliders: roof above head height, curved sides and end walls around the door
  M.col(-w / 2, 3.7, -d / 2, w / 2, 4.1, d / 2);
  M.col(-w / 2, 1.0, -d / 2, -w / 2 + 0.6, 3.0, d / 2);
  M.col(w / 2 - 0.6, 1.0, -d / 2, w / 2, 3.0, d / 2);
  M.col(-w / 2, 1.0, d / 2 - 0.2, w / 2, 3.0, d / 2);
  M.col(-w / 2, 1.0, -d / 2, -0.9, 3.0, -d / 2 + 0.2);
  M.col(0.9, 1.0, -d / 2, w / 2, 3.0, -d / 2 + 0.2);
  M.col(-0.9, 2.3, -d / 2, 0.9, 3.0, -d / 2 + 0.2);
  // end gable framing for door
  M.bb('metal', -1.0, 1.0, -d / 2 - 0.05, -0.9, 2.3, -d / 2 + 0.05, C.G2);
  M.bb('metal', 0.9, 1.0, -d / 2 - 0.05, 1.0, 2.3, -d / 2 + 0.05, C.G2);
  // interior: hydroponic racks with plants & grow lights
  M.bb('interior', -w / 2 + 0.2, 0.0, -d / 2 + 0.2, w / 2 - 0.2, 0.02, d / 2 - 0.2, C.FLOOR);
  for (const x of [-2.4, 2.4]) {
    M.bb('metal', x - 0.6, 0.02, -4.4, x + 0.6, 0.9, 4.6, C.G2);
    M.bb('water', x - 0.55, 0.9, -4.35, x + 0.55, 0.95, 4.55);
    for (let k = 0; k < 16; k++) {
      const z = -4.1 + k * 0.56;
      M.sphere('plant', x - 0.25, 1.15, z, 0.24, k % 3 ? 0x3e8f2f : 0x5aa83a, 8, 0.9);
      M.sphere('plant', x + 0.25, 1.1, z + 0.28, 0.22, 0x4a9a35, 8, 0.9);
    }
    M.bb('metal', x - 0.05, 0.9, -4.4, x + 0.05, 2.6, -4.3, C.G);
    M.bb('metal', x - 0.05, 0.9, 4.5, x + 0.05, 2.6, 4.6, C.G);
    M.bb('emissive', x - 0.4, 2.55, -4.3, x + 0.4, 2.6, 4.5, 0xff70d0);
    M.col(x - 0.6, 0, -4.4, x + 0.6, 1.3, 4.6);
  }
  tank(M, 0, 0, 4.9, 0.4, 1.2, C.W2, C.TEAL);
  M.interior(-w / 2 + 0.2, 0, -d / 2 + 0.2, w / 2 - 0.2, 3.5, d / 2 - 0.2);
  M.light(0, 2.5, -2, 0xff80d8, 5, 10);
  M.light(0, 2.5, 2.5, 0xff80d8, 5, 10);
}

function pump(M) {
  plinth(M, 4, 4, { color: C.CONC2 });
  M.bb('hull', -1.8, 0, -1.8, 0.6, 2.6, 1.0, C.W);
  M.bb('metal', -1.9, 2.6, -1.9, 0.7, 2.8, 1.1, C.G2);
  M.box('glass', -0.6, 1.6, -1.82, 1.4, 0.8, 0.04);
  tank(M, 1.2, 0, 1.0, 0.65, 2.4, C.W2, C.BLUE);
  pipe(M, [[0.6, 1.0, 0.4], [1.2, 1.0, 0.4]], 0.14, C.BLUE);
  pipe(M, [[-1.0, 0.5, 1.0], [-1.0, 0.5, 1.9], [-1.0, -0.8, 1.9]], 0.16, C.G);
  const wheel = M.animGroup('metal', { pivot: [-1.82, 1.2, -0.6], axis: [1, 0, 0], speed: 2.0 });
  wheel.add(new THREE.TorusGeometry(0.4, 0.05, 6, 16), { pos: v(-1.9, 1.2, -0.6), rot: e(0, PI / 2, 0), color: C.RED });
  M.box('emissive', -1.0, 2.2, -1.82, 0.5, 0.06, 0.02, L.cyan);
  M.col(-1.9, 0, -1.9, 0.7, 2.8, 1.1);
  M.colCyl(1.2, 1.0, 0.7, 0, 3.0);
}

function factory(M) {
  plinth(M, 10, 8);
  M.bb('hull', -4.8, 0, -3.8, 4.8, 4.2, 3.8, C.W2);
  // saw-tooth roof
  for (let i = 0; i < 4; i++) {
    const x0 = -4.8 + i * 2.4;
    // sloped panel (as a thin box rotated)
    M.add('hull', new THREE.BoxGeometry(2.75, 0.1, 7.7), { pos: v(x0 + 1.2, 4.9, 0), rot: e(0, 0, 0.53), color: C.G });
    M.box('glass', x0 + 2.38, 4.9, 0, 0.04, 1.3, 7.4);
  }
  M.bb('hull', -4.9, 4.0, -3.9, 4.9, 4.25, 3.9, C.O);
  for (const x of [-3.4, -1.1, 1.2, 3.5]) M.box('glass', x, 2.6, -3.82, 1.5, 1.2, 0.04);
  // loading door
  M.bb('metal', -1.4, 0, -3.84, 1.4, 2.8, -3.78, C.G2);
  for (let i = 0; i < 9; i++) M.bb('metal', -1.35, 0.15 + i * 0.3, -3.86, 1.35, 0.25 + i * 0.3, -3.84, C.G);
  hazard(M, 0, 2.95, -3.84, 2.8, 0.15, 0.03);
  // chimneys
  M.cyl('hull', 3.8, 4.2, 2.8, 0.35, 4.5, C.W, 12);
  M.cyl('hull', 3.8, 7.6, 2.8, 0.37, 0.3, C.RED, 12);
  M.cyl('hull', 2.9, 4.2, 2.8, 0.3, 3.5, C.W, 12);
  tank(M, -4.2, 4.2, 2.6, 0.6, 1.4);
  pipe(M, [[4.8, 2.5, -2.0], [5.3, 2.5, -2.0], [5.3, 2.5, 2.0], [4.8, 2.5, 2.0]], 0.15, C.G);
  M.col(-4.8, 0, -3.8, 4.8, 5.6, 3.8);
}

function techplant(M) {
  plinth(M, 10, 10);
  M.bb('hull', -4.6, 0, -4.6, 4.6, 5.2, 4.6, C.W);
  M.bb('hull', -4.7, 5.2, -4.7, 4.7, 5.5, 4.7, C.TEAL);
  for (let f = 0; f < 2; f++) {
    for (let i = 0; i < 6; i++) {
      M.box('glass', -3.75 + i * 1.5, 1.5 + f * 2.3, -4.62, 1.2, 1.4, 0.04);
      M.box('glass', -3.75 + i * 1.5, 1.5 + f * 2.3, 4.62, 1.2, 1.4, 0.04);
    }
  }
  for (let i = 0; i < 5; i++) M.box('emissive', -4.62, 0.8 + i * 0.9, 0, 0.04, 0.12, 8.0, L.cyan);
  // clean-room domes on roof
  M.dome('hull', -2.0, 5.5, -1.5, 1.6, C.W2, 18);
  M.dome('hull', 2.0, 5.5, -1.5, 1.6, C.W2, 18);
  M.cyl('metal', 0, 5.5, 2.4, 0.8, 1.6, C.G, 14);
  M.cyl('emissive', 0, 7.1, 2.4, 0.82, 0.08, L.cyan, 14);
  antenna(M, 3.8, 5.5, 3.8, 3);
  M.col(-4.6, 0, -4.6, 4.6, 5.5, 4.6);
}

function terminal(M) {
  M.bb('concrete', -1, -1.2, -1, 1, 0, 1, C.CONC2);
  M.bb('metal', -0.6, 0, -0.4, 0.6, 1.0, 0.4, C.G2);
  M.add('metal', new THREE.BoxGeometry(1.1, 0.7, 0.08), { pos: v(0, 1.35, -0.1), rot: e(-0.4, 0, 0), color: C.D });
  M.add('emissive', new THREE.BoxGeometry(1.0, 0.6, 0.02), { pos: v(0, 1.36, -0.15), rot: e(-0.4, 0, 0), color: L.cyan });
  M.cyl('metal', 0.6, 0, 0.6, 0.05, 2.2, C.G, 6);
  const dish = M.animGroup('hull', { pivot: [0.6, 0, 0.6], axis: [0, 1, 0], speed: 0.5 });
  const d = new THREE.SphereGeometry(0.45, 14, 5, 0, PI * 2, 0, 0.8); d.rotateX(PI * 0.6); d.translate(0.6, 2.35, 0.6);
  dish.add(d, { color: C.W });
  M.col(-0.6, 0, -0.4, 0.6, 1.6, 0.4);
}

function park(M) {
  M.bb('concrete', -5, -1.2, -5, 5, -0.05, 5, C.CONC2);
  // lawn
  M.add('plant', new THREE.BoxGeometry(9.6, 0.1, 9.6, 1, 1, 1), { pos: v(0, -0.02, 0), color: 0x3d7a2c });
  // paths (cross)
  M.bb('concrete', -0.8, 0.0, -5, 0.8, 0.06, 5, C.W2);
  M.bb('concrete', -5, 0.0, -0.8, 5, 0.06, 0.8, C.W2);
  // fountain
  M.cyl('concrete', 0, 0, 0, 1.4, 0.5, C.CONC, 24);
  M.cyl('water', 0, 0.45, 0, 1.25, 0.06, undefined, 24);
  M.cyl('concrete', 0, 0.5, 0, 0.2, 1.0, C.CONC, 10);
  M.cyl('emissive', 0, 1.5, 0, 0.12, 0.3, L.cyan, 10);
  // trees, benches, lamps
  for (const [x, z] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) {
    M.cyl('plant', x, 0, z, 0.15, 2.2, 0x5a3b26, 8);
    M.sphere('plant', x, 2.8, z, 1.3, 0x3a7a35, 12, 0.85);
    M.sphere('plant', x + 0.5, 2.3, z + 0.3, 0.8, 0x4a8a3a, 10, 0.85);
    M.colCyl(x, z, 0.2, 0, 2.2);
  }
  for (const [x, z, r] of [[-1.8, -3.6, 0], [1.8, 3.6, 0]]) { M.box('interior', x, 0.4, z, 1.6, 0.08, 0.5, C.G2, r); M.box('metal', x, 0.2, z, 1.4, 0.4, 0.1, C.G, r); }
  for (const [x, z] of [[-4.4, 0], [4.4, 0]]) { M.cyl('metal', x, 0, z, 0.05, 3.2, C.G2, 6); M.sphere('emissive', x, 3.3, z, 0.18, L.warm, 10); M.light(x, 3.2, z, L.warm, 6, 10); }
  M.colCyl(0, 0, 1.4, 0, 0.5);
  M.col(-5, -1.2, -5, 5, 0.04, 5);
}

function culture(M) {
  plinth(M, 12, 12);
  // curved shells (opera-like)
  for (let i = 0; i < 3; i++) {
    const r = 5.2 - i * 1.2;
    const shell = new THREE.SphereGeometry(r, 28, 10, 0, PI, 0, PI / 2);
    shell.scale(1, 1.25 - i * 0.12, 1);
    M.add('hull', shell, { pos: v(0, 0, -1.5 + i * 1.6), rot: e(0, -PI / 2, 0), color: i === 1 ? C.W2 : C.W });
  }
  M.box('glass', 0, 2.2, -1.6, 9.5, 4.2, 0.04);
  M.bb('concrete', -5.8, 0, -5.8, 5.8, 0.3, -2.0, C.W2);
  for (let i = 0; i < 6; i++) M.cyl('metal', -4.5 + i * 1.8, 0.3, -5.2, 0.12, 3.6, C.W2, 10);
  M.bb('hull', -5.4, 3.9, -5.6, 5.4, 4.15, -4.6, C.W);
  lightBar(M, 0, 3.85, -5.1, 9.5, 0.06, 0.6, L.warm);
  M.cyl('emissive', 0, 6.1, 0.2, 0.25, 1.4, L.violet, 10);
  M.colCyl(0, -0.2, 5.0, 0, 6.0);
}

function road(M) {
  M.bb('concrete', -2, -1.0, -4, 2, -0.02, 4, C.CONC2);
  M.add('concrete', new THREE.BoxGeometry(3.6, 0.04, 8), { pos: v(0, 0.0, 0), color: C.ASPH });
  M.bb('concrete', -2.0, -0.02, -4, -1.8, 0.12, 4, C.CONC);
  M.bb('concrete', 1.8, -0.02, -4, 2.0, 0.12, 4, C.CONC);
  for (let i = 0; i < 4; i++) M.bb('hull', -0.06, 0.02, -3.5 + i * 2, 0.06, 0.03, -2.6 + i * 2, C.Y);
  M.col(-2, -1.0, -4, 2, 0.02, 4);
}

function monument(M) {
  plinth(M, 10, 10, { color: C.W2 });
  for (let i = 0; i < 3; i++) M.bb('concrete', -4 + i * 0.8, 0, -4 + i * 0.8, 4 - i * 0.8, 0.4 + i * 0.4, 4 - i * 0.8, C.W2);
  const prof = [];
  for (let i = 0; i <= 12; i++) { const t = i / 12; prof.push(new THREE.Vector2(1.4 * (1 - t) + 0.12, 1.2 + t * 22)); }
  M.add('hull', new THREE.LatheGeometry(prof, 4), { rot: e(0, PI / 4, 0), color: C.W });
  M.add('hull', new THREE.TorusGeometry(3.0, 0.25, 10, 40), { pos: v(0, 11, 0), rot: e(PI / 2.4, 0, 0), color: C.O });
  M.add('emissive', new THREE.TorusGeometry(3.0, 0.08, 6, 40), { pos: v(0, 11, 0), rot: e(PI / 2.4, 0, 0), color: L.warm });
  M.sphere('emissive', 0, 23.5, 0, 0.5, L.warm, 14);
  for (let i = 0; i < 4; i++) { const a = i / 4 * PI * 2; M.box('metal', Math.cos(a) * 3.2, 0.9, Math.sin(a) * 3.2, 0.9, 0.9, 0.2, C.G, -a); }
  M.colCyl(0, 0, 1.6, 0, 23);
  M.col(-4, 0, -4, 4, 1.2, 4);
}

function elevator(M) {
  plinth(M, 16, 16);
  M.cyl('hull', 0, 0, 0, 7.2, 3.0, C.W2, 36);
  M.cyl('hull', 0, 3.0, 0, 7.4, 0.4, C.O, 36);
  M.cyl('hull', 0, 3.4, 0, 5.6, 6.0, C.W, 32);
  for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2; M.box('glass', Math.cos(a) * 5.62, 6.0, Math.sin(a) * 5.62, 0.04, 3.4, 2.2, -a); }
  M.cyl('metal', 0, 9.4, 0, 4.0, 1.0, C.G2, 28);
  // tether: tall tapering spire going up to the sky
  M.cyl('hull', 0, 10.4, 0, 1.6, 120, C.W, 16, 0.6);
  M.cyl('emissive', 0, 10.4, 0, 0.62, 1200, L.cyan, 8, 0.4);
  for (let i = 0; i < 8; i++) M.cyl('hull', 0, 20 + i * 14, 0, 2.2 - i * 0.12, 0.6, C.O, 16);
  // climber car
  const car = M.animGroup('hull', { pivot: [0, 0, 0], axis: [0, 1, 0], speed: 0.4 });
  car.add(new THREE.CylinderGeometry(2.4, 2.4, 2.4, 16), { pos: v(0, 40, 0), color: C.W2 });
  for (const [x, z] of [[-6.6, -6.6], [6.6, -6.6], [-6.6, 6.6], [6.6, 6.6]]) antenna(M, x, 0, z, 5);
  M.colCyl(0, 0, 7.3, 0, 9.4);
  M.colCyl(0, 0, 1.7, 9.4, 130);
}

// ------------------------------------------------------------------ registry
const BUILDERS = {
  pod, habitat, foundation, storage, fabricator, lamp, beacon,
  solar, pylon, wind, reactor,
  heater: (M) => heater(M, false), heater2: (M) => heater(M, true), drill: (M) => drill(M, false), drill2: (M) => drill(M, true),
  vegetube, seeder, algae, treespreader, insectdome, mirror,
  extractor, smelter, assembler, dronehub, depot,
  hq: (M) => { hq(M); hqExtras(M); }, farm, pump, market, lounge, clinic, factory, techplant, school, lab, terminal, park, culture, road, monument, elevator, comms,
  'house:0': houseT1, 'house:1': houseT2, 'house:2': houseT3, 'house:3': houseT4,
};

const cache = new Map();
// mirrored variant (key suffix ':m'): flips X, fixes triangle winding, colliders, lights, doors
function mirrorModel(src) {
  const parts = src.parts.map((p) => {
    const g = p.geo.clone();
    const P = g.attributes.position, N = g.attributes.normal;
    for (let i = 0; i < P.count; i++) { P.setX(i, -P.getX(i)); N.setX(i, -N.getX(i)); }
    for (let i = 0; i < P.count; i += 3) {
      for (const name of Object.keys(g.attributes)) {
        const a = g.attributes[name], k = a.itemSize;
        for (let c = 0; c < k; c++) { const t = a.array[(i + 1) * k + c]; a.array[(i + 1) * k + c] = a.array[(i + 2) * k + c]; a.array[(i + 2) * k + c] = t; }
      }
    }
    let anim = p.anim;
    if (anim && anim.pivot) anim = { ...anim, pivot: [-anim.pivot[0], anim.pivot[1], anim.pivot[2]], axis: [anim.axis[0], -anim.axis[1], -anim.axis[2]] };
    if (anim && anim.slide) anim = { slide: [-anim.slide[0], anim.slide[1], anim.slide[2]] };
    g.computeBoundingBox(); g.computeBoundingSphere();
    return { ...p, geo: g, anim };
  });
  return {
    parts,
    colliders: src.colliders.map((c) => ({ ...c, x: -c.x })),
    interiors: src.interiors.map((r) => ({ ...r, x0: -r.x1, x1: -r.x0 })),
    lights: src.lights.map((l) => ({ ...l, x: -l.x })),
    doors: src.doors.map((d) => ({ ...d, x: -d.x })),
    height: src.height,
  };
}

export function getModel(key) {
  if (cache.has(key)) return cache.get(key);
  if (key.endsWith(':m')) {
    const model = mirrorModel(getModel(key.slice(0, -2)));
    model.key = key;
    cache.set(key, model);
    return model;
  }
  const fn = BUILDERS[key];
  if (!fn) throw new Error('no model ' + key);
  const M = new ModelBuilder();
  fn(M);
  const model = M.finish();
  model.key = key;
  cache.set(key, model);
  return model;
}

export function modelKeys() { return Object.keys(BUILDERS); }
