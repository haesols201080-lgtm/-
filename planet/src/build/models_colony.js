// Colony architecture in one sci-fi language: pressurised modules on legs,
// hexagonal towers with recessed window bands, ribbed glass domes, airlocks,
// trusses, radiators and roof machinery. Same local frame as models.js
// (origin at footprint centre, y = 0 floor, front = -Z).
import * as THREE from 'three';
import { C, L, v, e, plinth, rooftopPlant, hazard, railing, stairs, antenna, vent, tank, pipe, lightBar, room, podModule, ribDome, truss, radiator, greebleRoof, airlock, porthole, habDome, gardenDome, linkTube, ribbonTower, airlockTube, pvRack } from './modelkit.js';

const PI = Math.PI;

// ------------------------------------------------------------------ houses
// Homes follow the SpaceX Mars-city concept: clustered white composite hab
// domes, cylinder towers with dark ribbon glazing and glass garden domes,
// joined by pressurised tubes; the top tier is a glazed tower inside a steel
// diagrid with a garden crown.
export function houseT1(M) {
  plinth(M, 8, 8);
  const top = habDome(M, 0.45, 0.55, 2.75, { skip: [PI, -2.15] });
  gardenDome(M, -2.6, 2.6, 1.15, { seed: 11 });
  linkTube(M, 0.45, 0.55, -2.6, 2.6, 0.75, 0.5);
  airlockTube(M, 0.45, 1.0, -1.7, -3.75, 0.85, C.W);
  pvRack(M, 2.75, -3.05, 2.1, 1.0, 0, 2);
  radiator(M, 3.4, 0.3, 2.7, 1.2, 1.3, PI / 2, C.W2);
  vent(M, 1.2, top - 0.42, 0.2, 0.6, 0.45, 0.3);
  antenna(M, -0.6, top - 0.5, 1.2, 1.3);
  for (const x of [-0.7, 1.6]) { M.cyl('metal', x, 0, -3.9, 0.05, 0.7, C.G2, 8); M.box('emissive', x, 0.66, -3.9, 0.09, 0.05, 0.09, L.warm); }
}

export function houseT2(M) {
  plinth(M, 8, 8);
  const ta = habDome(M, -1.35, 0.95, 2.5, { skip: [PI, 1.27] });
  const tb = habDome(M, 2.2, 2.1, 1.75, { skip: [-1.87, 3.1], drum: 2.7 });
  gardenDome(M, 2.35, -1.75, 1.3, { seed: 23 });
  linkTube(M, -1.35, 0.95, 2.2, 2.1, 0.95, 0.6);
  linkTube(M, 2.2, 2.1, 2.35, -1.75, 0.8, 0.5);
  airlockTube(M, -1.35, 1.0, -1.2, -3.75, 0.85, C.W);
  antenna(M, -0.5, ta - 0.55, 1.6, 1.6);
  M.cyl('metal', 2.2, tb - 0.25, 2.1, 0.06, 1.3, C.G2, 8);
  M.add('solar', new THREE.BoxGeometry(1.6, 0.05, 0.9), { pos: v(2.2, tb + 1.1, 2.1), rot: e(0.45, 0, 0) });
  radiator(M, -3.5, 0.3, -2.7, 0.9, 1.2, PI / 2, C.W2);
}

export function houseT3(M) {
  plinth(M, 8, 8);
  const ta = ribbonTower(M, -0.85, 0.75, 2.45, 12.8, { door: true, skip: [1.15, 2.31], balconies: [4.1, 5.5], rot: 0.25 });
  ribbonTower(M, 2.4, 2.2, 1.5, 9.6, { skip: [-1.99], rot: 0.6, lobby: false });
  linkTube(M, -0.85, 0.75, 2.4, 2.2, 7.4, 0.55);
  habDome(M, 2.35, -2.15, 1.45, { skip: [-0.83], oculus: false });
  linkTube(M, 2.35, -2.15, -0.85, 0.75, 0.8, 0.5);
  antenna(M, -0.1, ta - 0.4, 1.0, 2.2);
}

export function houseT4(M) {
  plinth(M, 8, 8);
  // glazed podium with a roof terrace
  ribbonTower(M, 0, 0, 3.45, 4.2, { fh: 4.2, cap: 'flat', door: true, plant: false, rot: 0.2 });
  // glazed core in an hourglass steel diagrid
  const H = 27, y0 = 4.5;
  const rad = (t) => 2.75 - 0.75 * Math.sin(t * PI) + 0.15 * t;
  const prof = [];
  for (let i = 0; i <= 18; i++) { const t = i / 18; prof.push(new THREE.Vector2(rad(t), y0 + t * (H - y0))); }
  M.add('glass', new THREE.LatheGeometry(prof, 40));
  for (const dir of [1, -1]) for (let k = 0; k < 7; k++) {
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16, a = k / 7 * PI * 2 + dir * t * PI * 0.62;
      const r2 = rad(t) + 0.17;
      pts.push([Math.cos(a) * r2, y0 + t * (H - y0), Math.sin(a) * r2]);
    }
    M.tube('metal', pts, 0.15, C.W2, 8);
  }
  // diagrid nodes where the two spirals cross
  for (let j = 0; j * 2 / (7 * 1.24) <= 1.0001; j++) for (let k = 0; k < 7; k++) {
    const t = j * 2 / (7 * 1.24), a = k / 7 * PI * 2 + t * PI * 0.62, r2 = rad(t) + 0.17;
    M.sphere('metal', Math.cos(a) * r2, y0 + t * (H - y0), Math.sin(a) * r2, 0.27, C.G, 10, 0.8);
  }
  // floor slabs read through the glazing
  for (let y = 6.4; y < H - 0.5; y += 3.2) {
    const t = (y - y0) / (H - y0);
    M.add('metal', new THREE.TorusGeometry(rad(t) + 0.02, 0.09, 6, 40), { pos: v(0, y, 0), rot: e(PI / 2, 0, 0), color: C.G2 });
  }
  // mid-height sky terrace
  const ty = y0 + (H - y0) * 0.5;
  M.cyl('hull', 0, ty - 0.25, 0, rad(0.5) + 1.2, 0.25, C.W, 40);
  for (let i = 0; i < 18; i++) { const a = i / 18 * PI * 2, r3 = rad(0.5) + 1.15; M.cyl('metal', Math.cos(a) * r3, ty, Math.sin(a) * r3, 0.03, 1.0, C.G, 5); }
  M.add('metal', new THREE.TorusGeometry(rad(0.5) + 1.15, 0.04, 5, 40), { pos: v(0, ty + 1.0, 0), rot: e(PI / 2, 0, 0), color: C.G });
  M.add('emissive', new THREE.TorusGeometry(rad(0.5) + 1.22, 0.03, 6, 40), { pos: v(0, ty - 0.14, 0), rot: e(PI / 2, 0, 0), color: L.warm });
  // crown: composite ring, garden under a glass dome, drone pad
  M.cyl('hull', 0, H, 0, 3.3, 0.6, C.W, 40);
  M.cyl('metal', 0, H + 0.58, 0, 3.36, 0.1, C.D, 40);
  ribDome(M, 0, H + 0.68, 0, 2.75, { ribs: 12, rib: C.W2 });
  for (let i = 0; i < 7; i++) M.sphere('plant', Math.cos(i * 0.9) * 1.5, H + 1.15, Math.sin(i * 0.9) * 1.5, 0.55, 0x3a7a36, 8, 0.85);
  M.cyl('plant', 0, H + 0.68, 0, 0.12, 1.5, 0x5a3b26, 6);
  M.sphere('plant', 0, H + 2.3, 0, 0.9, 0x2f6e36, 10, 0.8);
  M.box('metal', 3.7, H - 0.4, 0, 2.2, 0.22, 0.6, C.G2);
  M.cyl('metal', 5.0, H - 0.4, 0, 1.45, 0.2, C.G2, 28);
  M.add('emissive', new THREE.TorusGeometry(1.25, 0.035, 6, 28), { pos: v(5.0, H - 0.18, 0), rot: e(PI / 2, 0, 0), color: L.warm });
  antenna(M, 0.9, H + 2.6, 0.6, 2.6, L.red);
  M.colCyl(0, 0, 2.9, 4.4, H + 3.4);
}

// ------------------------------------------------------------------ services
export function market(M) {
  plinth(M, 8, 8);
  const hexAt = (key, y, h, r, color, open = false) => { const g = new THREE.CylinderGeometry(r, r, h, 6, 1, open); g.rotateY(PI / 6); M.add(key, g, { pos: v(0, y + h / 2, 0), color }); };
  // hexagonal canopy on six pillars with a skylight
  hexAt('hull', 4.0, 0.35, 4.3, C.W);
  hexAt('metal', 3.85, 0.15, 4.0, C.G2);
  hexAt('window', 4.36, 0.06, 2.4);
  hexAt('hull', 4.35, 0.12, 4.42, C.O, true);
  for (let i = 0; i < 6; i++) {
    const a = PI / 6 + i * PI / 3, x = Math.sin(a) * 3.85, z = Math.cos(a) * 3.85;
    M.cyl('metal', x, 0, z, 0.17, 3.9, C.G2, 10);
    M.cyl('metal', x, 0, z, 0.3, 0.25, C.D, 10);
    M.colCyl(x, z, 0.2, 0, 4.0);
  }
  M.col(-4.2, 3.85, -4.2, 4.2, 4.4, 4.2, { noStand: true });
  // central dispenser kiosk
  M.cyl('hull', 0, 0, 0, 1.15, 2.6, C.W, 24);
  M.cyl('hull', 0, 2.6, 0, 1.25, 0.2, C.O, 24);
  M.cyl('metal', 0, 2.8, 0, 0.5, 1.05, C.G, 14);
  for (let i = 0; i < 4; i++) {
    const a = i * PI / 2;
    M.box('metal', Math.sin(a) * 1.12, 1.3, Math.cos(a) * 1.12, 0.7, 0.9, 0.12, C.D, a);
    M.box('emissive', Math.sin(a) * 1.18, 1.45, Math.cos(a) * 1.18, 0.55, 0.5, 0.02, [L.cyan, L.green, L.orange, L.cyan][i], a);
  }
  M.colCyl(0, 0, 1.2, 0, 2.8);
  // counters with goods
  const goods = [0x9bd25a, 0xf0a65a, 0x46b4ff];
  for (let i = 0; i < 3; i++) {
    const a = PI * 0.2 + i * PI * 0.55, x = Math.sin(a) * 2.6, z = Math.cos(a) * 2.6;
    M.box('hull', x, 0.48, z, 1.6, 0.95, 0.7, C.W2, a);
    for (let k = 0; k < 3; k++) M.box('hull', x + Math.cos(a) * (k - 1) * 0.45, 1.1, z - Math.sin(a) * (k - 1) * 0.45, 0.35, 0.3, 0.35, goods[k], a);
    M.colCyl(x, z, 0.75, 0, 1.0);
  }
  // cargo pods & lifter bot
  M.box('hull', -3.0, 0.45, -2.6, 0.9, 0.9, 0.9, C.O); M.box('hull', -3.0, 1.25, -2.6, 0.7, 0.7, 0.7, C.TEAL);
  M.box('metal', 3.0, 0.3, -2.4, 0.8, 0.4, 1.0, C.G2); M.box('metal', 3.0, 0.9, -2.0, 0.12, 1.0, 0.12, C.D);
  M.add('emissive', new THREE.RingGeometry(1.9, 2.0, 6), { pos: v(0, 0.012, 0), rot: e(-PI / 2, 0, PI / 6), color: L.cyan });
  M.light(0, 3.4, 0, L.warm, 3, 12);
  M.interior(-4, 0, -4, 4, 3.8, 4);
}

export function lounge(M) {
  plinth(M, 7, 7);
  room(M, 6, 5, 3.0, { door: 1.6, winFront: [{ a: 0.4, b: 1.9, y0: 0.6, y1: 2.5, kind: 'window' }, { a: 4.1, b: 5.6, y0: 0.6, y1: 2.5, kind: 'window' }], winSide: 1, winBack: 2, color: C.W, roof: false });
  // glass observation dome as the roof
  M.box('hull', 0, 3.1, 0, 6.3, 0.22, 5.3, C.W2);
  M.col(-3.15, 3.0, -2.65, 3.15, 3.22, 2.65);
  ribDome(M, 0, 3.2, 0, 2.45, { ribs: 8 });
  M.add('emissive', new THREE.TorusGeometry(2.5, 0.04, 6, 32), { pos: v(0, 3.25, 0), rot: e(PI / 2, 0, 0), color: 0xff7ad0 });
  airlock(M, 0, -2.5, 1.6, 2.5, 0.5, C.W2);
  // terrace with round tables and light posts
  for (const x of [-2.2, 0.0, 2.2]) {
    const z = 3.0;
    M.cyl('metal', x, 0, z, 0.06, 0.74, C.G, 8);
    M.cyl('hull', x, 0.74, z, 0.45, 0.05, C.W, 16);
    for (const dx of [-0.6, 0.6]) M.cyl('hull', x + dx, 0, z, 0.18, 0.45, C.TEAL, 12);
  }
  for (const x of [-3.0, 3.0]) { M.cyl('metal', x, 0, 3.3, 0.05, 2.4, C.G2, 6); M.sphere('emissive', x, 2.45, 3.3, 0.12, L.warm, 10); }
  // bar inside
  M.box('hull', -1.1, 0.52, 1.1, 3.0, 1.05, 0.6, C.G2);
  M.box('interior', -1.1, 1.08, 1.1, 3.1, 0.07, 0.7, C.IN2);
  M.box('metal', -1.15, 1.85, 2.25, 3.1, 1.1, 0.15, C.D);
  for (let i = 0; i < 6; i++) M.cyl('emissive', -2.4 + i * 0.5, 1.75, 2.15, 0.06, 0.25, [0xff9a40, 0x60e0ff, 0xff5080][i % 3], 8);
  for (const [x, z] of [[1.6, -0.8], [-1.0, -1.0]]) { M.cyl('metal', x, 0.02, z, 0.06, 0.72, C.G, 6); M.cyl('interior', x, 0.74, z, 0.5, 0.04, C.IN1, 14); M.colCyl(x, z, 0.5, 0, 0.78); }
  M.col(-2.65, 0, 0.75, 0.45, 1.12, 1.45);
}

export function clinic(M) {
  plinth(M, 8, 8);
  // central hub with a medical light ring and two ward modules
  M.cyl('hull', 0, 0, 0, 2.1, 4.2, C.W, 28);
  M.cyl('metal', 0, 4.2, 0, 2.2, 0.2, C.G2, 28);
  const band = new THREE.CylinderGeometry(2.05, 2.05, 1.0, 28, 1, true);
  M.add('glass', band, { pos: v(0, 2.3, 0) });
  M.add('emissive', new THREE.TorusGeometry(2.14, 0.05, 6, 36), { pos: v(0, 3.4, 0), rot: e(PI / 2, 0, 0), color: L.green });
  M.box('emissive', 0, 3.2, -2.12, 0.9, 0.26, 0.04, L.green);
  M.box('emissive', 0, 3.2, -2.12, 0.26, 0.9, 0.04, L.green);
  podModule(M, -3.0, 1.55, 0.6, 2.6, 1.15, { ports: 2, accent: C.GREEN });
  podModule(M, 3.0, 1.55, 0.6, 2.6, 1.15, { ports: 2, accent: C.GREEN });
  airlock(M, 0, -1.9, 1.5, 2.5, 0.9, C.W2);
  // rooftop medevac pad
  M.cyl('hull', 0, 4.4, 0, 2.4, 0.15, C.W2, 28);
  M.add('emissive', new THREE.RingGeometry(1.6, 1.75, 28), { pos: v(0, 4.56, 0), rot: e(-PI / 2, 0, 0), color: L.red });
  for (let i = 0; i < 4; i++) { const a = i * PI / 2 + PI / 4; M.sphere('blink', Math.cos(a) * 2.2, 4.62, Math.sin(a) * 2.2, 0.07, L.red, 6); }
  M.colCyl(0, 0, 2.15, 0, 4.6);
  M.col(-4.6, 0.4, -0.55, -1.6, 2.7, 1.75);
  M.col(1.6, 0.4, -0.55, 4.6, 2.7, 1.75);
}

export function school(M) {
  plinth(M, 10, 8);
  // ring-shaped learning centre with a holographic projector spire
  M.cyl('hull', 0, 0, 0.6, 3.9, 0.9, C.W, 32);
  M.add('glass', new THREE.CylinderGeometry(3.8, 3.8, 1.5, 32, 1, true), { pos: v(0, 1.65, 0.6) });
  M.cyl('hull', 0, 2.4, 0.6, 3.9, 1.0, C.W2, 32);
  M.cyl('hull', 0, 3.4, 0.6, 4.05, 0.18, C.O, 32);
  for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2; M.box('metal', Math.sin(a) * 3.92, 1.7, 0.6 + Math.cos(a) * 3.92, 0.16, 3.4, 0.16, C.G2, a); }
  ribDome(M, 0, 3.58, 0.6, 2.2, { key: 'hull', ribs: 8 });
  truss(M, [0, 5.6, 0.6], [0, 9.0, 0.6], 0.5, C.G);
  const holo = M.animGroup('emissive', { pivot: [0, 0, 0.6], axis: [0, 1, 0], speed: 0.6 });
  for (let k = 0; k < 3; k++) holo.add(new THREE.TorusGeometry(0.8 + k * 0.35, 0.03, 6, 28), { pos: v(0, 9.3 + k * 0.4, 0.6), rot: e(PI / 2 + k * 0.4, 0, 0), color: L.cyan });
  airlock(M, 0, -3.25, 1.8, 2.6, 0.7, C.W2);
  // stepped seating in front
  for (let k = 0; k < 3; k++) M.box('concrete', 0, 0.12 + k * 0.24, -4.0 + k * 0.3, 6.4 - k * 1.4, 0.24, 0.6, C.CONC2);
  for (const x of [-3.8, 3.8]) { M.cyl('metal', x, 0, -3.4, 0.06, 2.4, C.G2, 6); M.sphere('emissive', x, 2.45, -3.4, 0.12, L.warm, 10); }
  M.colCyl(0, 0.6, 3.95, 0, 3.6);
}

export function lab(M) {
  plinth(M, 8, 8);
  room(M, 7, 6, 3.4, { door: 1.6, winSide: 2, winBack: 2, winFront: [{ a: 0.6, b: 2.2, y0: 1.0, y1: 2.6, kind: 'window' }, { a: 4.8, b: 6.4, y0: 1.0, y1: 2.6, kind: 'window' }], color: C.W });
  M.cyl('hull', 1.5, 3.7, 1.0, 1.6, 0.6, C.W2, 24);
  ribDome(M, 1.5, 4.3, 1.0, 1.55, { key: 'hull', ribs: 8 });
  M.box('metal', 1.5, 5.2, 0.2, 0.5, 1.4, 0.2, C.D);
  for (let i = 0; i < 3; i++) antenna(M, -2.6 + i * 0.7, 3.7, -2.2 + i * 0.3, 1.6 + i * 0.6, i % 2 ? L.green : L.red);
  greebleRoof(M, -3.2, 0.2, -0.4, 2.6, 3.72, 305, 4);
  airlock(M, 0, -3.0, 1.6, 2.6, 0.7, C.W2);
  for (const z of [-0.6, 1.6]) {
    M.bb('metal', -2.8, 0.02, z - 0.4, 0.8, 0.9, z + 0.4, C.G2);
    M.bb('interior', -2.85, 0.9, z - 0.45, 0.85, 0.96, z + 0.45, C.IN1);
    for (let i = 0; i < 4; i++) M.cyl('emissive', -2.4 + i * 0.4, 0.96, z, 0.06, 0.35, [L.green, L.cyan, L.violet][i % 3], 8);
    M.bb('emissive', -0.6, 1.1, z - 0.02, 0.6, 1.7, z + 0.02, L.cyan);
    M.col(-2.85, 0, z - 0.45, 0.85, 0.96, z + 0.45);
  }
}

// deep-space comms array: where colonists are invited from
export function comms(M) {
  plinth(M, 8, 8);
  podModule(M, -1.2, 1.35, 2.4, 3.6, 1.05, { ports: 2, rot: 0 });
  M.cyl('concrete', 1.2, 0, -0.6, 1.3, 0.5, C.CONC, 20);
  M.cyl('hull', 1.2, 0.5, -0.6, 0.75, 2.4, C.W, 18);
  M.cyl('hull', 1.2, 2.6, -0.6, 0.85, 0.18, C.O, 18);
  const dish = M.animGroup('hull', { pivot: [1.2, 0, -0.6], axis: [0, 1, 0], speed: 0.12 });
  const prof = [];
  for (let i = 0; i <= 10; i++) { const r = i / 10 * 3.2; prof.push(new THREE.Vector2(r, r * r * 0.09)); }
  const g = new THREE.LatheGeometry(prof, 40);
  g.rotateX(-0.75); g.translate(1.2, 4.1, -0.6);
  dish.add(g, { color: C.W });
  const back = new THREE.LatheGeometry(prof.map((p) => new THREE.Vector2(p.x, p.y - 0.12)).reverse(), 40);
  back.rotateX(-0.75); back.translate(1.2, 4.1, -0.6);
  dish.add(back, { color: C.G2 });
  for (let k = 0; k < 3; k++) {
    const a = k / 3 * PI * 2;
    const rim = new THREE.Vector3(Math.cos(a) * 3.0, 0.8, Math.sin(a) * 3.0).applyEuler(e(-0.75, 0, 0)).add(v(1.2, 4.1, -0.6));
    const focus = new THREE.Vector3(0, 2.4, 0).applyEuler(e(-0.75, 0, 0)).add(v(1.2, 4.1, -0.6));
    const dir = focus.clone().sub(rim), len = dir.length();
    const c = new THREE.CylinderGeometry(0.04, 0.04, len, 6);
    const q = new THREE.Quaternion().setFromUnitVectors(v(0, 1, 0), dir.normalize());
    c.applyQuaternion(q); c.translate((rim.x + focus.x) / 2, (rim.y + focus.y) / 2, (rim.z + focus.z) / 2);
    dish.add(c, { color: C.G });
  }
  const f = new THREE.Vector3(0, 2.4, 0).applyEuler(e(-0.75, 0, 0)).add(v(1.2, 4.1, -0.6));
  dish.add(new THREE.CylinderGeometry(0.18, 0.28, 0.5, 12), { pos: f, rot: e(-0.75, 0, 0), color: C.D });
  M.box('metal', 1.2, 3.3, -0.6, 1.0, 1.3, 0.5, C.G2);
  for (let i = 0; i < 4; i++) {
    const x = -3.4 + i * 0.6, z = -3.0 + (i % 2) * 0.5;
    M.cyl('metal', x, 0, z, 0.05, 4 + i * 0.8, C.G2, 6);
    for (let k = 0; k < 3; k++) M.box('metal', x, 1.4 + k * 1.1 + i * 0.3, z, 0.7, 0.04, 0.04, C.G);
    M.sphere('blink', x, 4.05 + i * 0.8, z, 0.07, i % 2 ? L.red : L.green, 6);
  }
  radiator(M, 3.2, 0.3, 2.4, 1.6, 1.5, PI / 2);
  M.box('emissive', -1.2, 1.4, 1.3, 1.6, 0.06, 0.03, L.cyan);
  M.colCyl(1.2, -0.6, 1.3, 0, 3.0);
  M.col(-3.6, 0.3, 1.35, 1.2, 2.4, 3.45);
  M.light(1.2, 3.0, -2.0, L.cyan, 1.5, 6);
}

// HQ exterior upgrade: airlock, mullions, roof modules (interior from models.js)
export function hqExtras(M) {
  airlock(M, 0, -4.5, 2.6, 3.1, 1.2, C.W2);
  for (const x of [-5.5, -2.75, 2.75, 5.5]) { M.box('metal', x, 2.3, -4.62, 0.3, 4.6, 0.3, C.G2); M.box('metal', x, 2.3, 4.62, 0.3, 4.6, 0.3, C.G2); }
  for (const z of [-2.25, 0, 2.25]) { M.box('metal', -5.62, 2.3, z, 0.3, 4.6, 0.3, C.G2); M.box('metal', 5.62, 2.3, z, 0.3, 4.6, 0.3, C.G2); }
  podModule(M, -6.7, 2.0, 4.2, 4.0, 1.0, { ports: 2, rot: PI / 2 });
  greebleRoof(M, -5.4, -4.3, -4.6, -3.4, 4.98, 401, 3);
  greebleRoof(M, 4.6, -4.3, 5.4, -3.4, 4.98, 402, 3);
  truss(M, [4.0, 7.9, 2.0], [4.0, 13.2, 2.0], 0.6, C.G);
  radiator(M, -3.2, 7.9, 0, 2.2, 1.2, PI / 2);
  // landing pad markings and edge lights
  M.add('emissive', new THREE.RingGeometry(1.6, 1.75, 32), { pos: v(6.85, 0.16, 0), rot: e(-PI / 2, 0, 0), color: L.cyan });
  for (let i = 0; i < 8; i++) M.sphere('blink', i < 4 ? 5.9 : 7.8, 0.2, -7 + (i % 4) * 4.6, 0.07, L.orange, 6);
}
