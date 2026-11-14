// Service buildings of the agency base, all in the same engineering language
// as the operations centre: pressure vessels, tube modules, nodes, cupolas,
// soft-goods modules, process tanks and columns, rigid hangars, radiators,
// deployment frames, grated porches with ramps. Each one shows its job by
// the hardware bolted to it. `open` (after the air is breathable) keeps the
// hardware and adds a glass vestibule, planters, trees and benches.
import * as THREE from 'three';
import { C, L, v, e, plinth, railing } from './modelkit.js';
import { strut, lattice, tankH, floodMast, pipeRack } from './starkit.js';
import {
  N, hatch, viewport, vessel, tubeModule, radiatorWing, deployFrame, grating, ramp, avionics, bottleRack,
  cupola, inflatable, node, tankV, sphereTank, processColumn, hangar, growTube, rosa, instrumentMast, cargoBags,
} from './nasakit.js';
import { rover, flag, glazedPorch, lifeAround } from './models_nasa.js';

const PI = Math.PI;
const BLUE = 0x2a5db0, RED = 0xc8302a, GREEN = 0x2f8f4a, AMBER = 0xe2b42a;

// porch + ramp in front of a hatch at (x, zFront) whose sill is at y
function porch(M, x, zFront, y, { w = 1.6, d = 1.3, run = 0 } = {}) {
  grating(M, x, y, zFront - d / 2, w, d);
  for (const sx of [-1, 1]) railing(M, x + sx * w / 2, zFront - d, x + sx * w / 2, zFront, y, 1.0, N.YELLOW);
  ramp(M, x, zFront - d, 0, y, { w: Math.min(1.3, w - 0.2), run: run || Math.max(1.1, y * 2.4) });
}
// a pipe from a to b with a bend at height y
function pipe(M, a, b, y, r = 0.07, color = 0xb8bec4) {
  M.tube('metal', [[a[0], a[1], a[2]], [a[0], y, a[2]], [b[0], y, b[2]], [b[0], b[1], b[2]]], r, color, 6);
}
// colour band around a vertical vessel
function band(M, x, z, r, y, h, color) {
  M.add('shell', new THREE.CylinderGeometry(r + 0.012, r + 0.012, h, 48, 1, true), { pos: v(x, y, z), color });
}
function beacon(M, x, y, z, color) {
  M.cyl('metal', x, y, z, 0.07, 0.12, N.DARK, 8);
  M.sphere('blink', x, y + 0.2, z, 0.09, color, 8);
}

// ---------------------------------------------------------------- life support (6x6)
// ECLSS plant: an oxygen generation / CO2 removal module, O2 and N2 storage
// tanks, a Sabatier reactor column, a water sphere, radiators, plumbing
export function lifesupport(M, open = false) {
  plinth(M, 6, 6);
  deployFrame(M, 0.5, 0.6, 3.8, 2.2, 0.45);
  tubeModule(M, 0.6, 1.4, 0.6, 3.2, 0.9, 0, { ports: 1, ribs: 2, endHatch: false, startHatch: true });
  porch(M, -1.5, 0.6, 0.55, { w: 1.0, d: 0.9 });
  tankV(M, 2.1, -1.9, 0.45, 2.1, { y0: 0.3, band: GREEN });
  tankV(M, 1.0, -1.9, 0.45, 2.1, { y0: 0.3, band: 0x1a1a1a });
  processColumn(M, 2.3, 2.2, 0.26, 3.0, { yaw: PI });
  sphereTank(M, -1.5, 1.05, 2.0, 0.72);
  radiatorWing(M, -0.4, 2.65, 0, { w: 1.3, h: 2.2, y0: 0.5 });
  pipe(M, [2.1, 2.4, -1.9], [1.6, 1.5, -0.3], 2.7);
  pipe(M, [1.0, 2.4, -1.9], [0.8, 1.6, -0.3], 2.55, 0.06, 0x5b8ec7);
  pipe(M, [2.3, 2.6, 2.2], [1.8, 1.8, 1.3], 3.2, 0.06, 0xc9a640);
  pipe(M, [-1.5, 1.6, 2.0], [-0.6, 1.6, 1.2], 2.1, 0.06, 0x5b8ec7);
  avionics(M, -2.3, 0, -2.2, 0.7, 0.6, 0.5);
  beacon(M, 0.6, 2.3, 0.6, L.green);
  if (open) lifeAround(M, [[-2.3, -0.8]], []);
  M.entry(-1.5);
}

// ---------------------------------------------------------------- water recovery (8x8)
// urine processor and water processor module, a vapour-compression
// distillation column, clean and brine tanks, a buffer sphere, radiators
export function sewage(M, open = false) {
  plinth(M, 8, 8);
  deployFrame(M, -0.6, 1.4, 4.4, 2.2, 0.45);
  tubeModule(M, -0.6, 1.45, 1.4, 4.0, 1.0, 0, { ports: 2, ribs: 3, endHatch: false, startHatch: true });
  porch(M, -3.3, 1.4, 0.55, { w: 1.0, d: 0.9 });
  processColumn(M, 2.6, 2.3, 0.36, 4.2, { yaw: PI });
  tankH(M, 0.4, 0.95, -1.7, 3.4, 0.62, { band: 0x3a7bd5 });
  tankH(M, 0.4, 0.85, -3.1, 3.0, 0.52, { band: 0x8a6a3a });
  sphereTank(M, 2.9, 1.1, -0.1, 0.7);
  radiatorWing(M, -2.8, 3.25, 0, { w: 1.3, h: 2.4, y0: 0.5 });
  radiatorWing(M, -1.3, 3.25, 0, { w: 1.3, h: 2.4, y0: 0.5 });
  pipe(M, [1.6, 1.4, 1.4], [2.6, 4.0, 2.3], 4.4, 0.07, 0x5b8ec7);
  pipe(M, [2.0, 1.2, -1.7], [2.9, 1.6, -0.1], 2.0, 0.07, 0x5b8ec7);
  pipe(M, [-1.1, 1.3, -1.7], [-1.1, 1.0, 0.4], 1.9, 0.06, 0xb8bec4);
  pipe(M, [-1.0, 1.1, -3.1], [-2.0, 1.0, 0.4], 1.7, 0.06, 0x8a6a3a);
  avionics(M, 3.2, 0, 3.3, 0.7, 0.6, 0.6);
  beacon(M, -0.6, 2.5, 1.4, 0x3a7bd5);
  if (open) lifeAround(M, [[-3.2, -2.8]], [[-2.6, -1.4, 0]]);
  M.entry(-3.3);
}

// ---------------------------------------------------------------- material recovery (8x8)
// a rigid hangar for the trash compactor and plastic melt, a feed hopper on
// legs with its conveyor, compacted tiles and metal bales stacked outside,
// a gasifier tank for what cannot be reused
export function recycling(M, open = false) {
  plinth(M, 8, 8);
  hangar(M, -0.9, 1.1, 4.4, 5.4, 3.6, 0, { stripe: GREEN });
  // hopper and inclined conveyor into the side wall
  const hx = 2.7, hz = 2.4;
  M.add('metal', new THREE.CylinderGeometry(0.95, 0.35, 1.2, 4, 1, true), { pos: v(hx, 3.0, hz), rot: e(0, PI / 4, 0), color: 0x9aa0a6 });
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) M.cyl('metal', hx + sx * 0.55, 0, hz + sz * 0.55, 0.05, 2.5, N.STEEL, 6);
  const a = [hx - 0.2, 2.3, hz - 0.3], b = [1.3, 1.1, 0.6];
  strut(M, a, b, 0.5, 0x3a3f45);
  strut(M, [a[0], a[1] + 0.3, a[2]], [b[0], b[1] + 0.3, b[2]], 0.05, N.YELLOW);
  M.cyl('metal', (a[0] + b[0]) / 2, 0, (a[2] + b[2]) / 2, 0.05, 1.6, N.STEEL, 6);
  // compacted tiles and bales
  const bale = [[0x8a8f94, 0], [0x5d7f9e, 1], [0xc9c0a8, 2], [0x8a8f94, 3], [0x6f8a5a, 4]];
  for (const [col, i] of bale) M.box('metal', 1.9 + (i % 3) * 0.75, 0.32 + Math.floor(i / 3) * 0.64, -2.6, 0.7, 0.62, 0.7, col);
  for (let i = 0; i < 4; i++) M.box('shell', -3.0 + (i % 2) * 0.52, 0.12 + Math.floor(i / 2) * 0.24, -3.1, 0.5, 0.22, 0.5, 0xd9d4c8);
  M.col(1.5, 0, -3.0, 4.0, 1.3, -2.2);
  tankV(M, 3.1, 0.2, 0.42, 2.2, { y0: 0.3, band: N.ORANGE });
  avionics(M, -3.4, 0, 3.4, 0.7, 0.6, 0.5);
  floodMast(M, 3.5, -1.2, 5, PI);
  if (open) lifeAround(M, [[-3.3, -2.0]], []);
  M.entry(-0.9);
}

// ---------------------------------------------------------------- emergency response (10x8)
// a red-striped rigid garage for the rescue rover, the crew's pressure
// vessel beside it, extinguishant and water tanks, an alarm mast with
// strobes, the rescue rover out front
export function firestation(M, open = false) {
  plinth(M, 10, 8);
  hangar(M, -1.7, 0.7, 5.0, 6.0, 4.0, 0, { stripe: RED });
  const vx = 3.0, vz = 1.5;
  deployFrame(M, vx, vz, 3.2, 3.0, 0.45);
  vessel(M, vx, vz, { r: 1.6, h: 2.6, y0: 0.5, loft: 1.1, hatches: [PI], ports: [{ a: PI / 2 }, { a: PI * 0.72, y: 1.9 }], segs: 8 });
  band(M, vx, vz, 1.6, 2.6, 0.32, RED);
  porch(M, vx, vz - 1.6, 0.5, { w: 1.3, d: 1.0 });
  for (const z of [-2.7, -3.4]) tankV(M, 4.4, z, 0.3, 1.7, { y0: 0.25, band: RED });
  M.cyl('metal', 4.5, 0, 3.5, 0.09, 8.0, N.FRAME, 8);
  M.box('metal', 4.5, 7.3, 3.5, 0.5, 0.5, 0.5, N.DARK);
  for (let k = 0; k < 4; k++) { const a = k / 4 * PI * 2; beacon(M, 4.5 + Math.sin(a) * 0.32, 7.55, 3.5 + Math.cos(a) * 0.32, k % 2 ? RED : 0xffffff); }
  rover(M, -1.7, -3.15, 0, RED);
  floodMast(M, -4.6, -3.3, 6, PI * 0.9);
  if (open) { glazedPorch(M, vx, vz - 2.1, 1.3, 1.0, 0.5); lifeAround(M, [[1.7, -3.1]], []); }
  M.entry(-1.7);
}

// ---------------------------------------------------------------- security (8x8)
// the security office: a pressure vessel with a blue band and a watch
// cupola on top, a surveillance mast with camera pods and blue strobes,
// a covered bay with a charging post for the patrol rover
export function police(M, open = false) {
  plinth(M, 8, 8);
  const vx = -1.3, vz = 1.0;
  deployFrame(M, vx, vz, 3.8, 3.6, 0.5);
  const cap = vessel(M, vx, vz, { r: 1.9, h: 2.8, y0: 0.55, loft: 0, hatches: [PI], ports: [{ a: -PI / 2 }, { a: PI / 2 }, { a: PI * 0.74 }], segs: 8 });
  band(M, vx, vz, 1.9, 2.55, 0.36, BLUE);
  cupola(M, vx, cap - 0.05, vz, 0.8);
  porch(M, vx, vz - 1.9, 0.55, { w: 1.4, d: 1.1 });
  // surveillance mast
  M.cyl('metal', 2.9, 0, 2.9, 0.1, 8.5, N.FRAME, 8);
  M.cyl('metal', 2.9, 0, 2.9, 0.4, 0.12, N.DARK, 12);
  for (const [h, a] of [[7.6, 0], [7.6, PI], [6.4, PI / 2], [6.4, -PI / 2]]) {
    M.box('metal', 2.9 + Math.sin(a) * 0.35, h, 2.9 + Math.cos(a) * 0.35, 0.18, 0.18, 0.5, 0xe8e8e4, a);
    M.box('glass', 2.9 + Math.sin(a) * 0.62, h, 2.9 + Math.cos(a) * 0.62, 0.12, 0.12, 0.04, undefined, a);
  }
  beacon(M, 2.9, 8.5, 2.9, BLUE);
  // patrol bay: a flat canopy on posts over a charger
  M.box('shell', 2.4, 3.0, -1.8, 3.2, 0.2, 3.4, N.SHELL2);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) M.cyl('metal', 2.4 + sx * 1.45, 0, -1.8 + sz * 1.55, 0.07, 3.0, N.FRAME, 8);
  for (const sx of [-1, 1]) beacon(M, 2.4 + sx * 1.3, 3.1, -3.4, BLUE);
  M.box('metal', 3.6, 0.7, -0.4, 0.4, 1.4, 0.35, N.DARK);
  M.box('emissive', 3.6, 1.2, -0.59, 0.25, 0.08, 0.02, L.green);
  M.col(0.8, 2.9, -3.5, 4.0, 3.1, -0.1);
  avionics(M, -3.4, 0, 3.4, 0.7, 0.6, 0.5);
  radiatorWing(M, -1.0, 3.45, 0, { w: 1.3, h: 2.2, y0: 0.5 });
  if (open) { glazedPorch(M, vx, vz - 2.45, 1.4, 1.1, 0.55); lifeAround(M, [[-3.4, -2.9]], []); }
  M.entry(vx);
}

// ---------------------------------------------------------------- childcare (8x8)
// a pressure vessel with amber bands and low viewports at child height, a
// soft-goods play module beside it, and a grow tube where children tend
// plants; after the air is breathable, a playground on the deck
export function nursery(M, open = false) {
  plinth(M, 8, 8);
  const vx = -1.6, vz = 1.4;
  deployFrame(M, vx, vz, 3.6, 3.4, 0.45);
  vessel(M, vx, vz, { r: 1.8, h: 2.6, y0: 0.5, loft: 1.1, hatches: [PI], ports: [{ a: -PI / 2, y: 1.0, r: 0.28 }, { a: PI * 0.72, y: 1.0, r: 0.28 }, { a: PI * 1.28, y: 1.0, r: 0.28 }, { a: PI / 2, y: 2.0 }], segs: 8 });
  band(M, vx, vz, 1.8, 2.3, 0.22, AMBER);
  band(M, vx, vz, 1.8, 2.75, 0.1, AMBER);
  porch(M, vx, vz - 1.8, 0.5, { w: 1.4, d: 1.1 });
  deployFrame(M, 2.1, 1.6, 2.8, 1.8, 0.3);
  inflatable(M, 2.1, 1.55, 1.6, 3.0, 1.05, 0, { color: 0xf4efe2 });
  M.add('shell', new THREE.CylinderGeometry(0.42, 0.42, 1.0, 20), { pos: v(0.25, 1.55, 1.5), rot: e(0, 0, PI / 2), color: N.SHELL2 });
  if (open) {
    // playground: climbing frame, slide, sandbox
    const px = 1.9, pz = -2.4;
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) M.cyl('metal', px + sx * 0.7, 0, pz + sz * 0.6, 0.05, 1.8, N.YELLOW, 8);
    M.box('metal', px, 1.2, pz, 1.5, 0.08, 1.3, 0x5b8ec7);
    for (let k = 0; k < 4; k++) M.box('metal', px - 0.7, 0.3 + k * 0.3, pz + 0.6, 0.05, 0.05, 1.3, N.YELLOW);
    M.add('metal', new THREE.BoxGeometry(0.6, 0.06, 2.0), { pos: v(px + 0.4, 0.62, pz - 1.15), rot: e(-0.55, 0, 0), color: RED });
    M.col(px - 0.8, 0, pz - 0.7, px + 0.8, 1.3, pz + 0.7);
    M.cyl('concrete', -0.6, 0, -2.8, 0.9, 0.2, 0xb8a27e, 20);
    M.cyl('concrete', -0.6, 0.18, -2.8, 0.8, 0.04, 0xdcc9a0, 20);
    lifeAround(M, [[-3.3, -2.8]], [[0.4, -1.3, 0]]);
    glazedPorch(M, vx, vz - 2.35, 1.4, 1.1, 0.5);
  } else {
    growTube(M, 1.9, 0.95, -2.5, 3.0, 0.62, 0);
    avionics(M, -3.4, 0, -2.9, 0.7, 0.6, 0.5);
  }
  radiatorWing(M, -3.2, 3.55, 0, { w: 1.3, h: 2.0, y0: 0.45 });
  M.entry(vx);
}

// ---------------------------------------------------------------- trade depot (10x10)
// cargo carriers on cradles under a gantry crane, soft cargo bags, a weigh
// platform, and a small office vessel with a cupola looking over the yard
export function tradepost(M, open = false) {
  plinth(M, 10, 10);
  // gantry crane spanning the yard
  for (const sx of [-1, 1]) {
    const x = sx * 4.4;
    strut(M, [x, 0, -0.3], [x, 5.6, 1.2], 0.22, N.ORANGE);
    strut(M, [x, 0, 2.7], [x, 5.6, 1.2], 0.22, N.ORANGE);
    strut(M, [x, 1.8, 0.2], [x, 1.8, 2.2], 0.14, N.ORANGE);
    M.box('metal', x, 0.1, 1.2, 0.5, 0.2, 3.6, N.DARK);
  }
  M.box('metal', 0, 5.75, 1.2, 9.2, 0.4, 0.5, N.ORANGE);
  M.box('metal', 0.9, 5.4, 1.2, 0.9, 0.5, 0.9, N.DARK);
  M.cyl('metal', 0.9, 3.4, 1.2, 0.025, 2.0, 0x222222, 4);
  M.box('metal', 0.9, 3.3, 1.2, 0.5, 0.18, 0.4, N.YELLOW);
  // cargo carriers on cradles
  for (const [z, band2] of [[0.0, null], [2.5, N.ORANGE]]) {
    tubeModule(M, -0.6, 1.15, z, 3.4, 0.85, 0, { endHatch: true, ribs: 2, saddles: true });
    if (band2) M.add('shell', new THREE.CylinderGeometry(0.875, 0.875, 0.3, 32, 1, true), { pos: v(-0.6, 1.15, z), rot: e(0, 0, PI / 2), color: band2 });
  }
  // office vessel with a cupola
  const vx = -3.3, vz = -2.9;
  const cap = vessel(M, vx, vz, { r: 1.3, h: 2.3, y0: 0.45, loft: 0, hatches: [PI], ports: [{ a: PI / 2, y: 1.8 }, { a: PI * 0.7, y: 1.8 }], segs: 6 });
  cupola(M, vx, cap - 0.05, vz, 0.6);
  porch(M, vx, vz - 1.3, 0.45, { w: 1.2, d: 0.6, run: 0.9 });
  // weigh platform and bags
  grating(M, 2.6, 0.12, -2.6, 2.4, 2.0);
  cargoBags(M, 2.2, -2.8, 6, 0);
  cargoBags(M, 3.6, 3.8, 4, 0);
  floodMast(M, 4.6, -4.4, 6, PI * 0.8);
  if (open) lifeAround(M, [[-1.2, -4.0]], [[0.6, -4.0, 0]]);
  M.entry(vx);
}

// ---------------------------------------------------------------- learning habitat (10x8)
// two classroom modules berthed to a node with an observation cupola on
// top, a roll-out solar array and a weather station the classes run
export function school(M, open = false) {
  plinth(M, 10, 8);
  const y = 1.65, z = 1.0, r = 1.15;
  deployFrame(M, 0, z, 9.2, 2.4, 0.5);
  node(M, 0, y, z, r, 2.2, 0, ['z-', 'z+']);
  tubeModule(M, -2.95, y, z, 3.5, r, 0, { endHatch: false, startHatch: true, ports: 2, ribs: 3 });
  tubeModule(M, 2.95, y, z, 3.5, r, 0, { endHatch: true, ports: 2, ribs: 3 });
  cupola(M, 0, y + r - 0.08, z, 0.72);
  hatch(M, 0, 0.95, z - r - 0.08, PI, { w: 0.8, h: 1.4, depth: 0.22 });
  porch(M, 0, z - r - 0.2, 0.95, { w: 1.6, d: 1.0, run: 2.0 });
  rosa(M, 4.2, -2.4, 5.5, 0, { span: 1.6, height: 2.0 });
  instrumentMast(M, -4.3, -2.6, 4.2);
  radiatorWing(M, -2.0, 3.3, 0, { w: 1.3, h: 2.0, y0: 0.5 });
  radiatorWing(M, 0.8, 3.3, 0, { w: 1.3, h: 2.0, y0: 0.5 });
  avionics(M, -4.3, 0, 3.2, 0.7, 0.6, 0.5);
  if (open) lifeAround(M, [[-2.4, -2.8], [2.2, -2.8]], [[-1.2, -3.2, 0], [1.2, -3.2, 0]]);
  M.entry(0);
}

// ---------------------------------------------------------------- laboratory (8x8)
// a vessel with a cupola and a berthed lab module, a glovebox airlock for
// samples, cryogen dewars, the weather and dust instrument mast
export function lab(M, open = false) {
  plinth(M, 8, 8);
  const vx = -1.7, vz = 1.3;
  deployFrame(M, vx, vz, 3.6, 3.4, 0.5);
  const cap = vessel(M, vx, vz, { r: 1.75, h: 2.7, y0: 0.55, loft: 0, hatches: [PI], ports: [{ a: -PI / 2 }, { a: PI * 0.74 }], segs: 8 });
  cupola(M, vx, cap - 0.05, vz, 0.7);
  porch(M, vx, vz - 1.75, 0.55, { w: 1.4, d: 1.0 });
  tubeModule(M, 1.65, 1.6, vz, 3.0, 1.0, 0, { ports: 2, ribs: 2 });
  // sample glovebox airlock on the module's flank
  M.box('shell', 1.4, 1.45, vz - 1.1, 1.2, 0.8, 0.5, N.SHELL2);
  for (const sx of [-1, 1]) {
    M.add('metal', new THREE.TorusGeometry(0.14, 0.04, 6, 16), { pos: v(1.4 + sx * 0.3, 1.45, vz - 1.37), color: N.DARK });
    M.add('mli', new THREE.CylinderGeometry(0.13, 0.11, 0.3, 12), { pos: v(1.4 + sx * 0.3, 1.45, vz - 1.52), rot: e(PI / 2, 0, 0), color: 0x2a2d31 });
  }
  for (const [x, z] of [[2.6, -2.6], [3.2, -2.0]]) { tankV(M, x, z, 0.28, 1.2, { y0: 0.2, band: 0x3a7bd5, key: 'steel' }); }
  instrumentMast(M, 3.3, 3.3, 5.0);
  radiatorWing(M, -3.2, 3.45, 0, { w: 1.3, h: 2.2, y0: 0.5 });
  avionics(M, 0.6, 0, 3.3, 0.8, 0.7, 0.6);
  if (open) { glazedPorch(M, vx, vz - 2.25, 1.4, 1.0, 0.55); lifeAround(M, [[-3.4, -2.6]], [[0.4, -2.8, 0]]); }
  M.entry(vx);
}

// ---------------------------------------------------------------- distribution centre (8x8)
// the store is a soft-goods expandable module on a deployment frame; outside,
// a pickup counter under a canopy with cargo bags waiting
export function market(M, open = false) {
  plinth(M, 8, 8);
  deployFrame(M, 0.6, 1.4, 4.6, 2.4, 0.3);
  inflatable(M, 0.6, 1.85, 1.4, 4.8, 1.45, 0);
  hatch(M, -1.95, 0.75, 1.4, -PI / 2, { w: 0.9, h: 1.5, depth: 0.22 });
  grating(M, -2.65, 0.75, 1.4, 1.1, 1.4, PI / 2);
  ramp(M, -2.65, 0.7, 0, 0.75, { w: 1.0, run: 1.6 });
  // pickup counter under a canopy
  M.box('shell', 1.4, 2.7, -2.4, 4.4, 0.16, 2.4, N.SHELL2);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) M.cyl('metal', 1.4 + sx * 2.05, 0, -2.4 + sz * 1.05, 0.06, 2.7, N.FRAME, 8);
  M.box('emissive', 1.4, 2.6, -2.4, 3.6, 0.02, 0.1, L.warm);
  M.box('shell', 1.4, 0.55, -1.6, 3.4, 1.1, 0.6, N.SHELL);
  M.box('metal', 1.4, 1.12, -1.6, 3.5, 0.05, 0.7, N.FRAME);
  M.col(-0.3, 0, -1.9, 3.1, 1.1, -1.3);
  M.col(-0.8, 2.6, -3.6, 3.6, 2.8, -1.2);
  cargoBags(M, 0.5, -3.1, 4, 0);
  cargoBags(M, 2.4, -3.1, 3, 0);
  avionics(M, 3.4, 0, 3.3, 0.7, 0.6, 0.5);
  radiatorWing(M, -2.6, 3.2, 0, { w: 1.3, h: 2.0, y0: 0.4 });
  if (open) lifeAround(M, [[-3.3, -2.6]], [[-1.4, -3.3, 0]]);
  M.entry(-2.65);
}
