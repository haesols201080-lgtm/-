// Colony architecture in one sci-fi language: pressurised modules on legs,
// hexagonal towers with recessed window bands, ribbed glass domes, airlocks,
// trusses, radiators and roof machinery. Same local frame as models.js
// (origin at footprint centre, y = 0 floor, front = -Z).
import * as THREE from 'three';
import { C, L, v, e, plinth, hazard, railing, stairs, antenna, vent, tank, pipe, lightBar, room, podModule, ribDome, truss, radiator, greebleRoof, airlock, porthole } from './modelkit.js';

const PI = Math.PI;

// hexagonal floor with recessed glass band and corner mullions; a face points to -z
function hexFloor(M, y, r, fh, { body = C.W, slab = C.G2, band = true } = {}) {
  const rot = PI / 6;
  const hex = (key, y0, h, rr, color, open = false) => {
    const g = new THREE.CylinderGeometry(rr, rr, h, 6, 1, open);
    g.rotateY(rot);
    M.add(key, g, { pos: v(0, y0 + h / 2, 0), color });
  };
  if (band) {
    hex('hull', y, 0.95, r, body);
    hex('glass', y + 0.95, 1.35, r - 0.1, undefined, true);
    hex('hull', y + 2.3, fh - 2.55, r, body);
  } else hex('hull', y, fh - 0.25, r, body);
  hex('metal', y + fh - 0.25, 0.25, r + 0.18, slab);
  // mullions at the six corners
  for (let i = 0; i < 6; i++) {
    const a = rot + i * PI / 3;
    const x = Math.sin(a) * (r + 0.02), z = Math.cos(a) * (r + 0.02);
    M.box('metal', x, y + (fh - 0.25) / 2, z, 0.22, fh - 0.25, 0.22, C.G2, -a);
  }
}

// ------------------------------------------------------------------ houses
export function houseT1(M) {
  plinth(M, 8, 8, { color: C.CONC2 });
  // main pressurised pod on legs, entrance tower, rear greenhouse bubble
  podModule(M, -0.4, 1.95, 0.7, 4.0, 1.45, { ports: 3 });
  M.cyl('hull', -0.4, 0, -1.25, 0.95, 3.1, C.W, 20);
  M.cyl('metal', -0.4, 3.1, -1.25, 1.02, 0.16, C.G2, 20);
  M.cyl('hull', -0.4, 2.85, -1.25, 0.99, 0.14, C.O, 20);
  M.box('metal', -0.4, 1.12, -2.18, 0.9, 2.2, 0.12, C.G2);
  M.box('hull', -0.4, 1.1, -2.24, 0.72, 2.0, 0.06, C.W2);
  M.box('emissive', -0.4, 2.32, -2.25, 0.8, 0.05, 0.03, L.cyan);
  porthole(M, -0.4, 1.55, -2.27, 0.14, '-z');
  stairs(M, -0.4, -2.3, 1.0, 0.0, 1, -1, C.G2);
  M.cyl('concrete', 2.5, 0, 2.5, 1.35, 0.45, C.CONC, 18);
  ribDome(M, 2.5, 0.45, 2.5, 1.25, { ribs: 6 });
  for (let i = 0; i < 5; i++) M.sphere('plant', 2.5 + Math.cos(i * 1.3) * 0.6, 0.75, 2.5 + Math.sin(i * 1.3) * 0.6, 0.28, 0x3e8a3a, 8, 0.8);
  pipe(M, [[1.1, 1.4, 1.6], [1.6, 1.4, 2.0], [1.6, 0.6, 2.0]], 0.08, C.G);
  // solar wing on a mast + radiator
  M.cyl('metal', -3.2, 0, 2.8, 0.09, 3.0, C.G2, 8);
  M.add('solar', new THREE.BoxGeometry(1.5, 0.05, 1.1), { pos: v(-3.2, 3.05, 2.2), rot: e(-0.5, 0, 0) });
  M.add('solar', new THREE.BoxGeometry(1.5, 0.05, 1.1), { pos: v(-3.2, 3.05, 3.4), rot: e(0.5, 0, 0) });
  M.box('metal', -3.2, 3.0, 2.8, 0.2, 0.2, 2.4, C.G);
  radiator(M, 2.9, 0.35, -2.2, 1.6, 1.4, PI / 2);
  // cargo crates and a utility box by the door
  M.box('hull', 1.0, 0.35, -2.9, 0.8, 0.7, 0.7, C.O);
  M.box('hull', 1.75, 0.3, -3.0, 0.6, 0.6, 0.6, C.W2);
  M.box('metal', -2.2, 0.5, -2.6, 0.6, 1.0, 0.4, C.G2);
  M.box('emissive', -2.2, 0.85, -2.82, 0.3, 0.05, 0.02, L.green);
  antenna(M, -1.6, 3.4, 0.7, 1.4);
  M.col(-3.4, 0.5, -0.75, 2.6, 3.4, 2.15);
  M.colCyl(-0.4, -1.25, 0.95, 0, 3.2);
  M.colCyl(2.5, 2.5, 1.35, 0, 1.7);
  M.colCyl(-3.2, 2.8, 0.15, 0, 3.0);
  M.light(-0.4, 2.6, -2.6, L.warm, 1.5, 6);
}

export function houseT2(M) {
  plinth(M, 8, 8, { color: C.CONC2 });
  // lower habitation block with a recessed ribbon window band
  M.box('hull', -0.3, 0.5, 0.6, 6.0, 1.0, 5.0, C.W);
  M.box('glass', -0.3, 1.65, 0.6, 5.8, 1.3, 4.8);
  M.box('hull', -0.3, 2.75, 0.6, 6.0, 0.9, 5.0, C.W);
  M.box('hull', -0.3, 3.28, 0.6, 6.2, 0.16, 5.2, C.O);
  for (const x of [-3.0, -1.5, 0, 1.5, 2.4]) { M.box('metal', x, 1.6, -1.92, 0.18, 3.2, 0.14, C.G2); M.box('metal', x, 1.6, 3.12, 0.18, 3.2, 0.14, C.G2); }
  for (const z of [-1.2, 0.6, 2.4]) { M.box('metal', -3.32, 1.6, z, 0.14, 3.2, 0.18, C.G2); M.box('metal', 2.72, 1.6, z, 0.14, 3.2, 0.18, C.G2); }
  airlock(M, -1.6, -1.9, 1.3, 2.5, 0.9, C.W2);
  // upper pressurised module across the roof, overhanging the front
  podModule(M, 0.6, 4.75, 0.2, 4.6, 1.35, { ports: 3, rot: PI / 2, legs: false });
  for (const z of [-1.4, 1.8]) { M.box('metal', 0.6, 3.6, z, 1.6, 0.5, 0.3, C.G2); }
  // roof deck with railing and stairs
  railing(M, -3.3, -1.9, -1.2, -1.9, 3.36, 0.9, C.G);
  railing(M, -3.3, -1.9, -3.3, 3.1, 3.36, 0.9, C.G);
  stairs(M, 3.15, 0.1, 0.8, 3.36, 11, 1, C.G2);
  greebleRoof(M, -3.2, 0.4, -1.4, 3.0, 3.36, 211, 4);
  radiator(M, 3.4, 0.2, 2.6, 1.4, 1.6, PI / 2);
  M.cyl('metal', -2.8, 3.36, -1.3, 0.08, 1.6, C.G2, 8);
  M.add('solar', new THREE.BoxGeometry(1.6, 0.05, 1.0), { pos: v(-2.8, 5.0, -1.3), rot: e(-0.4, 0, 0) });
  antenna(M, 2.3, 6.1, 0.2, 1.5);
  M.col(-3.3, 0, -1.9, 2.7, 3.36, 3.1);
  M.col(-0.75, 3.36, -2.3, 1.95, 6.1, 2.7);
  M.light(-1.6, 2.2, -2.5, L.warm, 1.5, 6);
}

export function houseT3(M) {
  plinth(M, 8, 8, { color: C.CONC });
  const floors = 4, fh = 3.1, r = 3.2;
  for (let f = 0; f < floors; f++) hexFloor(M, f * fh, r, fh, { body: f % 2 ? C.W2 : C.W, band: f > 0 });
  const top = floors * fh;
  // ground floor: lobby glass + airlock on the front face
  const g0 = new THREE.CylinderGeometry(r - 0.12, r - 0.12, 1.6, 6, 1, true); g0.rotateY(PI / 6);
  M.add('glass', g0, { pos: v(0, 1.45, 0) });
  airlock(M, 0, -r * 0.866, 1.6, 2.6, 1.0, C.W2);
  // cantilevered pods on alternating floors
  podModule(M, 3.4, fh * 1 + 1.6, 0.0, 2.2, 0.85, { ports: 2, rot: 0, legs: false, accent: C.O });
  podModule(M, -3.4, fh * 3 + 1.6, 0.4, 2.2, 0.85, { ports: 2, rot: 0, legs: false, accent: C.O });
  M.box('metal', 2.5, fh + 0.6, 0, 1.2, 0.3, 0.5, C.G2);
  M.box('metal', -2.5, fh * 3 + 0.6, 0.4, 1.2, 0.3, 0.5, C.G2);
  // elevator spine on the back
  truss(M, [0, 0, r + 0.45], [0, top + 1.5, r + 0.45], 0.7, C.G);
  M.box('hull', 0, fh * 2.2, r + 0.45, 0.9, 1.6, 0.9, C.O);
  // crown: greenhouse dome, radiators, machinery
  ribDome(M, 0, top, 0, 2.3, { ribs: 8 });
  for (let i = 0; i < 6; i++) M.sphere('plant', Math.cos(i) * 1.1, top + 0.45, Math.sin(i) * 1.1, 0.42, 0x3a8a3a, 8, 0.85);
  radiator(M, 2.5, top, -1.6, 1.4, 1.2, PI / 3);
  antenna(M, -2.2, top, 1.2, 2.6);
  antenna(M, -1.6, top, -1.8, 1.6, L.green);
  M.colCyl(0, 0, r + 0.1, 0, top);
  M.colCyl(0, 0, 2.3, top, top + 2.3);
  M.light(0, 2.4, -r - 0.8, L.warm, 1.5, 6);
}

export function houseT4(M) {
  plinth(M, 8, 8, { color: C.CONC });
  hexFloor(M, 0, 3.7, 3.8, { body: C.W, band: true });
  const g0 = new THREE.CylinderGeometry(3.58, 3.58, 2.6, 6, 1, true); g0.rotateY(PI / 6);
  M.add('glass', g0, { pos: v(0, 1.75, 0) });
  airlock(M, 0, -3.7 * 0.866, 2.0, 2.9, 1.0, C.W2);
  // hourglass shaft
  const H = 27, y0 = 3.8;
  const rad = (t) => 2.85 - 0.75 * Math.sin(t * PI) + 0.15 * t;
  const prof = [];
  for (let i = 0; i <= 16; i++) { const t = i / 16; prof.push(new THREE.Vector2(rad(t), y0 + t * (H - y0))); }
  M.add('glass', new THREE.LatheGeometry(prof, 36));
  // helical structural ribs
  for (let k = 0; k < 6; k++) {
    const pts = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14, a = k / 6 * PI * 2 + t * PI * 0.7;
      const rr = rad(t) + 0.12;
      pts.push([Math.cos(a) * rr, y0 + t * (H - y0), Math.sin(a) * rr]);
    }
    M.tube('hull', pts, 0.15, C.W, 6);
  }
  // floor rings
  for (let i = 1; i < 8; i++) {
    const t = i / 8;
    M.add('metal', new THREE.TorusGeometry(rad(t) + 0.05, 0.07, 6, 36), { pos: v(0, y0 + t * (H - y0), 0), rot: e(PI / 2, 0, 0), color: C.W2 });
  }
  // mid-height sky terrace
  const ty = y0 + (H - y0) * 0.5;
  M.cyl('hull', 0, ty - 0.25, 0, rad(0.5) + 1.2, 0.25, C.W2, 36);
  M.add('emissive', new THREE.TorusGeometry(rad(0.5) + 1.2, 0.04, 6, 40), { pos: v(0, ty - 0.12, 0), rot: e(PI / 2, 0, 0), color: L.warm });
  for (let i = 0; i < 16; i++) { const a = i / 16 * PI * 2, rr = rad(0.5) + 1.15; M.cyl('metal', Math.cos(a) * rr, ty, Math.sin(a) * rr, 0.03, 0.9, C.G, 5); }
  M.add('metal', new THREE.TorusGeometry(rad(0.5) + 1.15, 0.035, 5, 40), { pos: v(0, ty + 0.9, 0), rot: e(PI / 2, 0, 0), color: C.G });
  // crown sky garden + landing pad
  M.cyl('hull', 0, H, 0, 3.3, 0.45, C.W, 36);
  M.add('metal', new THREE.TorusGeometry(3.32, 0.12, 6, 40), { pos: v(0, H + 0.2, 0), rot: e(PI / 2, 0, 0), color: C.O });
  ribDome(M, 0, H + 0.45, 0, 2.7, { ribs: 10 });
  for (let i = 0; i < 7; i++) M.sphere('plant', Math.cos(i * 0.9) * 1.4, H + 1.0, Math.sin(i * 0.9) * 1.4, 0.55, 0x3a8a3a, 8, 0.85);
  M.cyl('plant', 0, H + 0.45, 0, 0.12, 1.5, 0x5a3b26, 6);
  M.sphere('plant', 0, H + 2.1, 0, 0.9, 0x2f7a3a, 10, 0.8);
  M.box('metal', 3.6, H - 0.6, 0, 2.2, 0.2, 0.5, C.G2);
  M.cyl('hull', 4.9, H - 0.6, 0, 1.4, 0.18, C.W2, 24);
  M.add('emissive', new THREE.TorusGeometry(1.25, 0.04, 6, 28), { pos: v(4.9, H - 0.4, 0), rot: e(PI / 2, 0, 0), color: L.cyan });
  antenna(M, 0, H + 3.1, 0, 3, L.red);
  M.colCyl(0, 0, 3.8, 0, 3.8);
  M.colCyl(0, 0, 2.9, 3.8, H + 3.2);
  M.light(0, 2.6, -3.9, L.warm, 1.5, 6);
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
