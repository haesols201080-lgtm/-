// Colony architecture in one sci-fi language: pressurised modules on legs,
// hexagonal towers with recessed window bands, ribbed glass domes, airlocks,
// trusses, radiators and roof machinery. Same local frame as models.js
// (origin at footprint centre, y = 0 floor, front = -Z).
import * as THREE from 'three';
import { futureTower, stackTower, facility } from './modelkit.js';
import { C, L, v, e, plinth, rooftopPlant, block, shed, canopy, facade, bays, hazard, railing, stairs, antenna, vent, tank, pipe, lightBar, room, podModule, ribDome, truss, radiator, greebleRoof, airlock, porthole, habDome, gardenDome, linkTube, ribbonTower, entryPortal, airlockTube, pvRack } from './modelkit.js';

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
  airlockTube(M, 0.45, 1.2, -1.7, -3.5, 1.15);
  M.entry(0.45);
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
  airlockTube(M, -1.35, 1.2, -1.2, -3.5, 1.15);
  M.entry(-1.35);
  antenna(M, -0.5, ta - 0.55, 1.6, 1.6);
  M.cyl('metal', 2.2, tb - 0.25, 2.1, 0.06, 1.3, C.G2, 8);
  M.add('solar', new THREE.BoxGeometry(1.6, 0.05, 0.9), { pos: v(2.2, tb + 1.1, 2.1), rot: e(0.45, 0, 0) });
  radiator(M, -3.5, 0.3, -2.7, 0.9, 1.2, PI / 2, C.W2);
}

export function houseT3(M) {
  plinth(M, 8, 8);
  M.entry(-0.85);
  const ta = ribbonTower(M, -0.85, 0.75, 2.45, 12.8, { door: true, skip: [1.15, 2.31], balconies: [4.1, 5.5], rot: 0.25 });
  ribbonTower(M, 2.4, 2.2, 1.5, 9.6, { skip: [-1.99], rot: 0.6, lobby: false });
  linkTube(M, -0.85, 0.75, 2.4, 2.2, 7.4, 0.55);
  habDome(M, 2.35, -2.15, 1.45, { skip: [-0.83], oculus: false });
  linkTube(M, 2.35, -2.15, -0.85, 0.75, 0.8, 0.5);
  antenna(M, -0.1, ta - 0.4, 1.0, 2.2);
}

// ---- second designs per tier, so a street of homes is not one model repeated
// T1b: twin pods - two small domes joined by a tube, entry on the larger one
export function houseT1b(M) {
  plinth(M, 8, 8);
  const ta = habDome(M, -1.25, 0.2, 2.15, { skip: [PI, 1.57], rot: 0.6 });
  const tb = habDome(M, 2.05, 1.7, 1.6, { skip: [-1.98], drum: 2.7, oculus: false });
  linkTube(M, -1.25, 0.2, 2.05, 1.7, 0.85, 0.5);
  airlockTube(M, -1.25, 1.2, -1.3, -3.5, 1.1);
  M.entry(-1.25);
  pvRack(M, 2.2, -2.6, 2.4, 1.0, 0.3, 2);
  M.hcyl('hull', -3.2, 0.62, 2.9, 0.42, 1.4, 'z', C.MOD, 18);
  for (const dz of [-0.5, 0.5]) M.box('metal', -3.2, 0.2, 2.9 + dz, 0.8, 0.4, 0.12, C.G2);
  antenna(M, 2.05, tb - 0.3, 1.7, 1.5);
  vent(M, -1.6, ta - 0.4, 0.5, 0.5, 0.4, 0.3);
}

// T2b: L-shaped cluster of three domes around a garden court
export function houseT2b(M) {
  plinth(M, 8, 8);
  const ta = habDome(M, -1.6, -1.2, 2.2, { skip: [PI, 0.9, 1.9] });
  habDome(M, -1.8, 2.4, 1.5, { skip: [-0.3, PI], drum: 2.7, oculus: false });
  habDome(M, 2.2, -1.6, 1.6, { skip: [-1.6, 0.3], drum: 2.7, oculus: false });
  gardenDome(M, 1.9, 2.0, 1.45, { seed: 29 });
  linkTube(M, -1.6, -1.2, -1.8, 2.4, 0.8, 0.5);
  linkTube(M, -1.6, -1.2, 2.2, -1.6, 0.8, 0.5);
  linkTube(M, -1.6, -1.2, 1.9, 2.0, 0.75, 0.45);
  airlockTube(M, -1.6, 1.2, -2.6, -3.7, 1.0);
  M.entry(-1.6);
  M.cyl('metal', -1.6, ta - 0.25, -1.2, 0.06, 1.4, C.G2, 8);
  M.add('solar', new THREE.BoxGeometry(1.8, 0.05, 1.0), { pos: v(-1.6, ta + 1.2, -1.2), rot: e(0.45, 0.5, 0) });
  radiator(M, 3.4, 0.3, 2.0, 1.0, 1.2, PI / 2, C.W2);
}

// T3b: one taller tower with stacked balconies beside a low lobby dome
export function houseT3b(M) {
  plinth(M, 8, 8);
  M.entry(1.6);
  const ta = ribbonTower(M, -1.0, 0.9, 2.3, 16, { skip: [0.7], balconies: [3.6, 2.0, 5.2], rot: 0.5, cap: 'garden', lobby: false });
  habDome(M, 1.6, -1.6, 1.9, { skip: [PI, -0.75], oculus: false });
  airlockTube(M, 1.6, 1.2, -1.0, -3.6, 0.95);
  linkTube(M, 1.6, -1.6, -1.0, 0.9, 0.9, 0.55);
  pvRack(M, 2.4, 2.6, 2.2, 1.0, PI, 2);
  antenna(M, -1.6, ta - 0.6, 1.4, 2.0);
}
export function houseT4b(M) { houseT4(M, true); }

export function houseT4(M, alt = false) {
  plinth(M, 8, 8);
  // glazed podium with a roof terrace
  ribbonTower(M, 0, 0, 3.45, 4.2, { fh: 4.2, cap: 'flat', door: true, plant: false, rot: alt ? 0.9 : 0.2 });
  // glazed core in an hourglass steel diagrid (variant: taller, slimmer, flared crown)
  const H = alt ? 32 : 27, y0 = 4.5;
  const rad = alt ? (t) => 2.35 - 0.55 * Math.sin(t * PI * 0.85) + 0.55 * t * t : (t) => 2.75 - 0.75 * Math.sin(t * PI) + 0.15 * t;
  const prof = [];
  for (let i = 0; i <= 18; i++) { const t = i / 18; prof.push(new THREE.Vector2(rad(t), y0 + t * (H - y0))); }
  M.add('glass', new THREE.LatheGeometry(prof, 40));
  for (const dir of [1, -1]) for (let k = 0; k < 7; k++) {
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16, a = k / 7 * PI * 2 + dir * t * PI * (alt ? 0.85 : 0.62);
      const r2 = rad(t) + 0.17;
      pts.push([Math.cos(a) * r2, y0 + t * (H - y0), Math.sin(a) * r2]);
    }
    M.tube('metal', pts, 0.15, C.W2, 8);
  }
  // diagrid nodes where the two spirals cross
  for (let j = 0; j * 2 / (7 * 1.24) <= 1.0001; j++) for (let k = 0; k < 7; k++) {
    const t = j * 2 / (7 * 1.24), a = k / 7 * PI * 2 + t * PI * (alt ? 0.85 : 0.62), r2 = rad(t) + 0.17;
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
  // ration store: glazed shopfront hall with a deep canopy and a forecourt
  block(M, 0, 0.7, 7.4, 6.0, { storeys: 1, fh: 4.3, shop: true, bay: 2.35, seed: 31, signColor: L.warm, canopyW: 6.8, canopyY: 3.4 });
  for (const x of [-2.6, 2.6]) {
    M.box('concrete', x, 0.3, -3.3, 1.4, 0.6, 0.7, C.CONC);
    M.box('plant', x, 0.66, -3.3, 1.25, 0.12, 0.55, 0x4a3a2a);
    for (let k = 0; k < 3; k++) M.sphere('plant', x - 0.4 + k * 0.4, 0.85, -3.3, 0.22, 0x3d7f3a, 8, 0.8);
  }
  for (const x of [-0.9, 0.9]) { M.box('metal', x, 0.42, -3.55, 1.2, 0.06, 0.4, C.G2); for (const sx of [-0.5, 0.5]) M.box('metal', x + sx, 0.2, -3.55, 0.06, 0.4, 0.35, C.D); }
  M.box('metal', 3.55, 0.9, -3.2, 0.6, 1.8, 0.7, C.D);
  M.box('emissive', 3.55, 1.25, -3.56, 0.4, 0.5, 0.02, L.cyan);
  M.col(3.25, 0, -3.55, 3.85, 1.8, -2.85);
  for (const x of [-3.6]) { M.cyl('metal', x, 0, -3.8, 0.06, 0.8, C.G2, 8); M.box('emissive', x, 0.76, -3.8, 0.1, 0.05, 0.1, L.warm); }
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

// clinic: an elliptical blade tower with a rooftop helipad and a green cross,
// standing on a low treatment podium with an ambulance bay
export function clinic(M) {
  plinth(M, 8, 8);
  const H = block(M, 0, 0.4, 7.2, 6.4, { storeys: 1, fh: 3.8, seed: 41, plant: false, signColor: L.green });
  const top = futureTower(M, 0.4, 1.2, { y0: H, h: 13, w: 5.4, d: 3.8, form: 'blade', taper: 0.82, crown: 'pad', accent: L.green, rot: 0.15 });
  M.box('metal', 0.4, H + 8.5, 1.2 - 1.95, 1.4, 1.4, 0.08, C.D);
  M.box('emissive', 0.4, H + 8.5, 1.2 - 2.0, 1.0, 0.3, 0.02, L.green);
  M.box('emissive', 0.4, H + 8.5, 1.2 - 2.0, 0.3, 1.0, 0.02, L.green);
  for (const z of [-3.6, -2.6]) M.cyl('metal', -3.7, 0, z, 0.08, 0.9, C.Y, 10);
  vent(M, -2.6, H + 0.06, 2.4, 0.7, 0.5, 0.4);
}

// school: classroom plates stacked and sliding past each other, planted
// terraces on every overhang, solar on the roof, seating on the forecourt
export function school(M) {
  plinth(M, 10, 8);
  const top = stackTower(M, 0, 1.0, { w: 8.4, d: 5.0, plates: 4, ph: 3.4, shift: 1.2, accent: L.white });
  pvRack(M, -1.6, 1.0, 3.0, 1.1, 0, 2, top);
  pvRack(M, 2.0, 1.0, 3.0, 1.1, 0, 2, top);
  M.entry(0);
  for (let k = 0; k < 3; k++) M.box('concrete', -2.8, 0.12 + k * 0.24, -3.4 + k * 0.3, 3.0 - k * 0.6, 0.24, 0.6, C.CONC2);
  for (const x of [-4.6, 4.6]) { M.cyl('metal', x, 0, -3.6, 0.06, 3.0, C.G2, 8); M.box('emissive', x, 2.97, -3.4, 0.14, 0.02, 0.5, L.warm); }
  M.col(-4.3, 0, -3.9, -1.3, 0.72, -2.7);
}

// lab: a faceted crystal tower crowned by an observatory, instruments around it
export function lab(M) {
  plinth(M, 8, 8);
  const H = block(M, 0, 0.5, 7.0, 6.0, { storeys: 1, fh: 3.6, bay: 1.75, win: 0.95, plant: false, seed: 61, signColor: L.cyan });
  const top = futureTower(M, 0.6, 1.0, { y0: H, h: 14, w: 5.0, d: 5.0, form: 'crystal', taper: 0.62, crown: 'none', accent: L.cyan, rot: 0.25 });
  const r = 1.45;
  M.cyl('hull', 0.6, top, 1.0, r, 0.7, C.W2, 32);
  M.add('hull', new THREE.SphereGeometry(r, 32, 12, 0, PI * 2, 0, PI / 2), { pos: v(0.6, top + 0.7, 1.0), color: C.W });
  M.add('metal', new THREE.TorusGeometry(r + 0.01, 0.22, 6, 20, PI * 0.9), { pos: v(0.6, top + 0.7, 1.0), rot: e(0, 0.6, PI * 0.05), scale: v(1, 1, 0.5), color: C.D });
  M.colCyl(0.6, 1.0, r, top, top + 2.2);
  for (let i = 0; i < 3; i++) antenna(M, -2.6 + i * 0.7, H + 0.05, -1.6 + i * 0.3, 1.6 + i * 0.6, i % 2 ? L.green : L.red);
}

// deep-space comms: equipment building, steerable dish on a pedestal, masts
export function comms(M) {
  plinth(M, 8, 8);
  block(M, -2.0, 2.2, 3.6, 3.4, { storeys: 1, fh: 3.2, bay: 1.7, win: 1.0, seed: 71, plant: false, signColor: L.cyan, canopyW: 2.0 });
  vent(M, -2.4, 3.26, 2.8, 0.8, 0.6, 0.4);
  M.cyl('concrete', 1.2, 0, -0.6, 1.4, 0.6, C.CONC, 24);
  M.cyl('hull', 1.2, 0.6, -0.6, 0.8, 2.2, C.W2, 24);
  M.cyl('metal', 1.2, 2.8, -0.6, 0.95, 0.16, C.G2, 24);
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
  for (let i = 0; i < 3; i++) {
    const x = 3.0 + (i % 2) * 0.5, z = 1.4 + i * 0.9;
    M.cyl('metal', x, 0, z, 0.05, 4 + i * 0.8, C.G2, 6);
    for (let k = 0; k < 3; k++) M.box('metal', x, 1.4 + k * 1.1 + i * 0.3, z, 0.7, 0.04, 0.04, C.G);
    M.sphere('blink', x, 4.05 + i * 0.8, z, 0.07, i % 2 ? L.red : L.green, 6);
  }
  M.colCyl(1.2, -0.6, 1.4, 0, 3.0);
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
