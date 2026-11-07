// The civic basics every town needs, in the colony's building language:
// life support, sewage works, recycling, grid storage, fire and police
// stations, a nursery under glass, the city hall and the orbital trade post.
// Same local frame as models.js (origin at the footprint centre, front = -Z).
import * as THREE from 'three';
import { C, L, v, e, plinth, block, tank, pipe, vent, radiator, antenna, ribDome, habDome, linkTube, airlockTube, railing, truss, rooftopPlant } from './modelkit.js';

const PI = Math.PI;

function wheel(M, x, y, z, r, w) { M.add('metal', new THREE.CylinderGeometry(r, r, w, 16), { pos: v(x, y, z), rot: e(0, 0, PI / 2), color: C.K }); }
function smallTree(M, x, y, z, s = 1) {
  M.cyl('plant', x, y, z, 0.05 * s, 0.9 * s, 0x5a3b26, 5);
  M.sphere('plant', x, y + 1.15 * s, z, 0.45 * s, 0x3d7f3a, 8, 0.85);
}

// life support: electrolysers splitting water, oxygen spheres, CO2 scrubber hall
export function lifesupport(M) {
  plinth(M, 6, 6);
  const H = block(M, -1.2, 1.2, 3.2, 3.0, { storeys: 1, fh: 3.0, bay: 1.5, win: 0.9, plant: false, seed: 201, signColor: L.cyan, canopyW: 1.6 });
  for (const z of [1.6, 0.0]) tank(M, 1.75, 0, z, 0.55, 3.0, C.W, C.BLUE);
  // oxygen store: a sphere on legs
  M.sphere('hull', -1.7, 1.5, -1.9, 0.75, C.W, 20);
  for (let i = 0; i < 4; i++) { const a = i * PI / 2 + PI / 4; M.cyl('metal', -1.7 + Math.cos(a) * 0.55, 0, -1.9 + Math.sin(a) * 0.55, 0.05, 1.1, C.G2, 6); }
  M.cyl('hull', -1.7, 1.47, -1.9, 0.77, 0.08, C.BLUE, 20);
  pipe(M, [[1.75, 2.6, 1.6], [0.6, 2.6, 1.6], [0.4, 2.6, 1.2]], 0.07, C.G2);
  pipe(M, [[1.75, 2.2, 0.0], [0.7, 2.2, 0.0], [0.4, 2.2, 0.4]], 0.07, C.G2);
  pipe(M, [[-1.7, 1.5, -1.1], [-1.7, 1.5, -0.3]], 0.06, C.G2);
  vent(M, -1.6, H + 0.05, 1.6, 0.8, 0.6, 0.45);
  M.cyl('metal', -0.4, H, 2.2, 0.16, 1.6, C.G2, 10);
  radiator(M, 2.65, 0.3, -1.6, 0.9, 1.4, PI / 2, C.W2);
  M.box('emissive', -1.2, 2.5, -0.33, 1.2, 0.18, 0.03, L.cyan);
  M.col(-2.45, 0, -2.65, -0.95, 2.3, -1.15);
}

// sewage works: two clarifiers with turning rake bridges, a pump house, pipes
export function sewage(M) {
  plinth(M, 8, 8);
  for (const [x, z, sp] of [[-1.7, -1.5, 0.12], [1.9, 1.7, -0.09]]) {
    M.cyl('concrete', x, 0, z, 2.0, 1.0, C.CONC, 40);
    M.cyl('hull', x, 0.82, z, 1.85, 0.06, 0x2c5a52, 40);
    M.cyl('concrete', x, 0.85, z, 0.25, 0.4, C.CONC2, 12);
    const arm = M.animGroup('metal', { pivot: [x, 0, z], axis: [0, 1, 0], speed: sp });
    arm.add(new THREE.BoxGeometry(3.9, 0.12, 0.35), { pos: v(x, 1.25, z), color: C.G });
    arm.add(new THREE.BoxGeometry(0.05, 0.5, 3.6), { pos: v(x + 1.9, 1.0, z), rot: e(0, PI / 2, 0), color: C.G2 });
    M.colCyl(x, z, 2.0, 0, 1.3);
  }
  block(M, -2.3, 2.5, 2.8, 2.4, { storeys: 1, fh: 2.8, bay: 1.3, win: 0.8, plant: false, seed: 211, signColor: L.green, canopyW: 1.4 });
  pipe(M, [[-0.9, 0.5, 2.5], [0.2, 0.5, 2.5], [0.2, 0.5, 1.7]], 0.14, C.G2);
  pipe(M, [[-2.3, 0.5, 1.3], [-2.3, 0.5, 0.1]], 0.14, C.G2);
  tank(M, 3.2, 0, -2.6, 0.5, 1.6, C.W2, C.GREEN);
  vent(M, -2.3, 2.85, 3.0, 0.6, 0.5, 0.35);
}

// recycling centre: tipping hall, conveyor up from the hopper, sorted bales
export function recycling(M) {
  plinth(M, 8, 8);
  const H = block(M, 0.8, 1.4, 5.6, 4.6, { storeys: 1, fh: 4.2, bay: 1.8, win: 1.1, shop: true, plant: false, seed: 221, signColor: L.green, canopyW: 2.6, canopyY: 3.3 });
  // hopper and inclined conveyor into the hall
  M.box('metal', -3.0, 0.7, -1.6, 1.6, 1.4, 1.6, C.Y);
  M.add('metal', new THREE.BoxGeometry(0.8, 0.12, 4.0), { pos: v(-2.3, 2.3, 0.4), rot: e(-0.55, 0.6, 0), color: C.G2 });
  for (const [x, z, h] of [[-3.0, -0.6, 1.5], [-1.9, 1.3, 3.0]]) M.cyl('metal', x, 0, z, 0.06, h, C.G2, 6);
  // bales of sorted material
  const bale = (x, z, c, n) => { for (let i = 0; i < n; i++) M.box('hull', x + (i % 2) * 0.75, 0.32 + Math.floor(i / 2) * 0.62, z, 0.7, 0.6, 0.7, c); };
  bale(-3.3, 2.0, 0x8a9198, 4); bale(-3.3, 3.2, 0x5fb3c5, 3); bale(-1.6, 3.3, 0xc8743f, 2);
  for (const [x, c] of [[1.6, C.BLUE], [2.6, C.GREEN], [3.6, C.Y]]) M.box('metal', x, 0.5, -2.6, 0.85, 1.0, 1.0, c);
  vent(M, 2.3, H + 0.05, 2.8, 0.8, 0.6, 0.4);
}

// grid storage: battery cabinets with status lights, an inverter, a fence
export function powerbank(M) {
  plinth(M, 5, 4);
  for (let r = 0; r < 2; r++) for (let i = 0; i < 4; i++) {
    const x = -1.65 + i * 1.0, z = -0.7 + r * 1.5;
    M.box('metal', x, 1.0, z, 0.85, 2.0, 0.7, C.W2);
    M.box('metal', x, 1.0, z - 0.36, 0.7, 1.7, 0.02, C.W);
    M.box('emissive', x + 0.25, 1.7, z - 0.37, 0.08, 0.08, 0.02, L.green);
    M.box('emissive', x + 0.25, 1.55, z - 0.37, 0.08, 0.08, 0.02, i % 3 ? L.green : L.cyan);
  }
  M.box('metal', 2.05, 0.8, 0.0, 0.7, 1.6, 1.4, C.G2);
  radiator(M, 2.05, 1.6, 0.0, 1.2, 0.6, PI / 2, C.W2);
  M.box('hull', -2.3, 1.2, -1.82, 0.4, 0.4, 0.03, C.Y);
  for (const [x0, z0, x1, z1] of [[-2.4, -1.9, 2.4, -1.9], [-2.4, 1.9, 2.4, 1.9], [-2.4, -1.9, -2.4, 1.9]]) railing(M, x0, z0, x1, z1, 0, 1.2, C.G);
  M.col(-2.2, 0, -1.1, 1.6, 2.0, 1.1);
}

// fire station: three engine bays, a hose tower, roof siren, an engine out front
export function firestation(M) {
  plinth(M, 10, 8);
  const H = block(M, 0.5, 1.4, 8.6, 5.2, { storeys: 2, fh: 3.4, bay: 2.1, win: 1.2, door: false, plant: false, seed: 231, signColor: L.red, canopyW: 0.1 });
  for (let i = 0; i < 3; i++) {
    const x = -2.0 + i * 2.6, zf = 1.4 - 2.6 - 0.06;
    M.box('metal', x, 1.55, zf, 2.2, 3.1, 0.06, C.D);
    for (let k = 1; k < 6; k++) M.box('metal', x, 0.1 + k * 0.52, zf - 0.02, 2.1, 0.03, 0.02, C.G2);
    M.box('hull', x, 3.2, zf - 0.02, 2.4, 0.16, 0.08, C.RED);
  }
  M.box('hull', 0.5, 6.4, -1.23, 8.6, 0.3, 0.04, C.RED);
  // hose drying tower
  M.box('hull', -4.2, 5.0, 3.0, 1.3, 10.0, 1.3, C.W);
  for (let y = 2; y < 9.5; y += 2.2) M.box('glass', -4.2, y, 2.34, 0.6, 1.0, 0.03);
  M.box('hull', -4.2, 10.1, 3.0, 1.5, 0.2, 1.5, C.RED);
  M.col(-4.85, 0, 2.35, -3.55, 10.2, 3.65);
  M.sphere('blink', 2.0, H + 0.35, 1.0, 0.18, L.red, 10);
  antenna(M, 3.6, H, 3.0, 2.2);
  // the engine: cab, body with lockers, ladder on top
  const fx = 3.0, fz = -3.1;
  M.box('hull', fx - 1.4, 1.15, fz, 1.3, 1.6, 2.0, C.RED);
  M.box('glass', fx - 2.06, 1.45, fz, 0.02, 0.7, 1.7);
  M.box('hull', fx + 0.7, 1.1, fz, 3.0, 1.5, 2.1, C.RED);
  M.box('metal', fx + 0.7, 1.1, fz - 1.06, 2.8, 1.1, 0.02, 0xb02e24);
  M.box('metal', fx + 0.5, 2.0, fz, 3.4, 0.12, 0.5, C.G);
  for (const x of [fx - 1.4, fx + 0.2, fx + 1.5]) for (const z of [fz - 1.0, fz + 1.0]) wheel(M, x, 0.42, z, 0.42, 0.3);
  M.box('emissive', fx - 1.4, 2.02, fz, 0.9, 0.1, 0.3, L.red);
  M.col(fx - 2.1, 0, fz - 1.1, fx + 2.3, 2.1, fz + 1.1);
}

// police: two-storey station, blue light band, radio mast, a patrol drone pad
export function police(M) {
  plinth(M, 8, 8);
  const H = block(M, 0, 1.0, 7.0, 5.4, { storeys: 2, fh: 3.3, bay: 1.7, win: 1.1, plant: false, seed: 241, signColor: 0x5a8cff, canopyW: 2.4 });
  M.box('emissive', 0, 6.2, -1.72, 6.6, 0.12, 0.04, 0x4d7dff);
  M.cyl('metal', -2.2, H, 2.4, 0.08, 5.0, C.G2, 8);
  for (const y of [2, 3.5, 4.6]) M.box('metal', -2.2, H + y, 2.4, 0.9 - y * 0.12, 0.05, 0.05, C.G2);
  M.sphere('blink', -2.2, H + 5.05, 2.4, 0.1, L.red, 8);
  // drone pad with a parked drone
  M.cyl('metal', 1.6, H + 0.05, 1.2, 1.3, 0.1, C.D, 28);
  M.add('hull', new THREE.TorusGeometry(1.0, 0.04, 4, 28), { pos: v(1.6, H + 0.16, 1.2), rot: e(PI / 2, 0, 0), color: C.Y });
  M.box('hull', 1.6, H + 0.38, 1.2, 0.5, 0.2, 0.5, C.W);
  for (const [dx, dz] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) M.cyl('metal', 1.6 + dx, H + 0.4, 1.2 + dz, 0.22, 0.03, C.D, 12);
  // patrol rover and bollards
  M.box('hull', 2.6, 0.75, -3.2, 2.4, 0.9, 1.3, C.W);
  M.box('glass', 2.3, 1.3, -3.2, 1.2, 0.45, 1.25);
  M.box('hull', 2.6, 0.75, -3.86, 2.4, 0.2, 0.02, 0x3d76c9);
  M.box('emissive', 2.3, 1.58, -3.2, 0.6, 0.08, 0.3, 0x4d7dff);
  for (const x of [1.7, 3.5]) for (const z of [-3.75, -2.65]) wheel(M, x, 0.32, z, 0.32, 0.2);
  M.col(1.4, 0, -3.85, 3.8, 1.6, -2.55);
  for (const x of [-3.4, -2.6, -1.8]) M.cyl('metal', x, 0, -3.7, 0.1, 0.8, C.G2, 10);
}

// nursery: a dome home for the children and a play garden under glass
export function nursery(M) {
  plinth(M, 8, 8);
  const D = [-1.6, 1.4];
  M.entry(D[0]);
  const top = habDome(M, D[0], D[1], 2.3, { skip: [PI, 1.0] });
  airlockTube(M, D[0], 1.15, D[1] - 1.7, -3.4, 1.05);
  // play garden: soft floor, slide, swings, sandpit, trees, all under a ribbed dome
  const P = [1.7, -0.8], R = 2.25;
  M.cyl('concrete', P[0], 0, P[1], R, 0.08, 0x6fae8f, 32);
  M.add('metal', new THREE.BoxGeometry(0.5, 0.06, 1.8), { pos: v(P[0] + 0.9, 0.7, P[1] - 0.2), rot: e(0.55, 0, 0), color: C.Y });
  M.box('metal', P[0] + 0.9, 0.7, P[1] + 0.75, 0.6, 1.4, 0.4, 0x5aa0e0);
  for (const sx of [-0.7, 0.3]) { M.cyl('metal', P[0] + sx, 0, P[1] + 1.1, 0.04, 1.5, C.G2, 6); }
  M.box('metal', P[0] - 0.2, 1.5, P[1] + 1.1, 1.1, 0.06, 0.06, C.G2);
  M.box('hull', P[0] - 0.2, 0.55, P[1] + 1.1, 0.4, 0.05, 0.2, C.RED);
  M.box('concrete', P[0] - 1.0, 0.1, P[1] - 0.9, 1.1, 0.12, 0.9, 0xd8c08a);
  smallTree(M, P[0] - 1.2, 0.08, P[1] + 0.2, 0.9);
  ribDome(M, P[0], 0.08, P[1], R, { ribs: 10, rib: C.W2 });
  M.colCyl(P[0], P[1], R, 0, R);
  linkTube(M, D[0], D[1], P[0], P[1], 0.8, 0.5);
  M.box('emissive', D[0], 2.3, D[1] - 2.33, 1.2, 0.18, 0.03, 0xffc85a);
  antenna(M, D[0] + 0.5, top - 0.3, D[1], 1.2);
}

// city hall: three storeys behind a colonnade, a glazed rotunda, flags, steps
export function cityhall(M) {
  plinth(M, 14, 12);
  const H = block(M, 0, 2.0, 12.0, 6.0, { storeys: 3, fh: 3.4, bay: 2.2, win: 1.3, plant: false, seed: 251, signColor: L.white, canopyW: 0.1 });
  // colonnade and its canopy
  for (let i = 0; i < 8; i++) M.cyl('hull', -5.25 + i * 1.5, 0.3, -2.0, 0.22, 6.6, C.W, 16);
  M.box('hull', 0, 7.05, -1.6, 12.2, 0.4, 1.9, C.W);
  M.box('emissive', 0, 6.83, -2.5, 11.8, 0.05, 0.05, L.warm);
  M.col(-6.0, 6.85, -2.55, 6.0, 7.25, -0.65);
  // rotunda: glazed drum and ribbed dome over the council chamber
  M.cyl('hull', 0, H, 2.0, 3.0, 1.6, C.W2, 40);
  for (let i = 0; i < 16; i++) { const a = i / 16 * PI * 2; M.box('glass', Math.sin(a) * 3.02, H + 0.8, 2.0 + Math.cos(a) * 3.02, 0.9, 1.1, 0.04, undefined, a); }
  ribDome(M, 0, H + 1.6, 2.0, 2.9, { ribs: 14, rib: C.W2 });
  M.colCyl(0, 2.0, 3.0, H, H + 4.5);
  // broad steps and the plaza with flags and a fountain
  for (let k = 0; k < 3; k++) M.box('concrete', 0, 0.1 + k * 0.1, -2.9 - k * 0.45, 9 - k * 0.6, 0.2 + k * 0.2, 0.6, C.CONC2);
  for (const [x, c] of [[-4.5, C.BLUE], [-3.6, 0xf2f2f2], [-2.7, C.TEAL]]) {
    M.cyl('metal', x, 0, -5.0, 0.05, 7.0, C.G, 8);
    M.box('hull', x + 0.55, 6.4, -5.0, 1.0, 0.6, 0.02, c);
  }
  M.cyl('concrete', 3.6, 0, -4.6, 1.2, 0.45, C.CONC, 28);
  M.cyl('hull', 3.6, 0.38, -4.6, 1.05, 0.04, 0x2c6a7a, 28);
  M.cyl('concrete', 3.6, 0.4, -4.6, 0.15, 0.7, C.CONC2, 10);
  M.colCyl(3.6, -4.6, 1.2, 0, 0.45);
  rooftopPlant(M, 4.0, H + 0.04, 3.4, 1.6, 31);
}

// orbital trade post: a lander on its pad, a crane over stacked containers, a warehouse
export function tradepost(M) {
  plinth(M, 10, 10);
  const Px = -2.2, Pz = -1.8;
  M.cyl('concrete', Px, 0, Pz, 3.0, 0.12, C.CONC2, 40);
  M.add('hull', new THREE.TorusGeometry(2.6, 0.06, 4, 40), { pos: v(Px, 0.14, Pz), rot: e(PI / 2, 0, 0), color: C.Y });
  for (let i = 0; i < 8; i++) { const a = i * PI / 4; M.sphere('blink', Px + Math.cos(a) * 2.9, 0.16, Pz + Math.sin(a) * 2.9, 0.06, L.orange, 6); }
  // cargo lander: squat hull, nose, four legs
  M.cyl('hull', Px, 1.0, Pz, 1.1, 2.4, C.W, 24);
  M.add('hull', new THREE.ConeGeometry(1.1, 1.2, 24), { pos: v(Px, 4.0, Pz), color: C.W });
  M.cyl('metal', Px, 0.75, Pz, 0.7, 0.3, C.D, 20);
  for (let i = 0; i < 4; i++) { const a = i * PI / 2 + PI / 4; M.add('metal', new THREE.CylinderGeometry(0.06, 0.06, 1.6, 6), { pos: v(Px + Math.cos(a) * 1.35, 0.7, Pz + Math.sin(a) * 1.35), rot: e(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5), color: C.G2 }); }
  M.box('emissive', Px, 2.6, Pz - 1.11, 0.6, 0.08, 0.02, L.cyan);
  M.colCyl(Px, Pz, 1.15, 0, 4.6);
  block(M, 2.8, 2.6, 4.0, 4.2, { storeys: 1, fh: 3.6, bay: 1.9, win: 1.3, shop: true, plant: false, seed: 261, signColor: L.orange, canopyW: 2.4 });
  // containers and a gantry crane over them
  const cont = [[0.6, 3.6, 0x3d76c9], [0.6, 2.2, C.RED], [-1.6, 3.6, C.Y], [0.6, 3.6, 0x7a8cff, 1]];
  for (const [x, z, c, up] of cont) M.box('hull', x, 0.62 + (up ? 1.24 : 0), z, 2.4, 1.2, 1.2, c);
  M.col(-2.8, 0, 1.6, 1.8, 2.5, 4.2);
  truss(M, [-3.2, 0, 4.5], [-3.2, 4.2, 4.5], 0.4, C.Y);
  truss(M, [1.9, 0, 4.5], [1.9, 4.2, 4.5], 0.4, C.Y);
  truss(M, [-3.2, 4.2, 4.5], [1.9, 4.2, 4.5], 0.45, C.Y);
  M.box('metal', -0.5, 3.9, 4.5, 0.7, 0.4, 0.7, C.D);
  M.cyl('metal', -0.5, 2.0, 4.5, 0.02, 1.9, C.D, 4);
  antenna(M, 4.4, 3.65, 0.8, 1.8);
}
