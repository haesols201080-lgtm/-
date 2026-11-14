// Colony buildings of the agency base (second batch), in the same
// engineering language as the operations centre and the service buildings:
// pressure vessels, tube modules, nodes, cupolas, soft-goods modules,
// geodesic greenhouses, hangars, process plant, radiators and deployment
// frames. Each shows its job by the hardware bolted to it. `open` (after the
// air is breathable) keeps the hardware and adds glass vestibules, planters,
// trees and benches.
import * as THREE from 'three';
import { L, v, e, plinth, railing } from './modelkit.js';
import { strut, lattice, tankH, floodMast, pipeRack } from './starkit.js';
import {
  N, hatch, vessel, tubeModule, radiatorWing, deployFrame, grating, ramp, avionics, bottleRack,
  cupola, inflatable, node, tankV, sphereTank, processColumn, hangar, growTube, rosa, instrumentMast, cargoBags,
  geodesicDome, viewBand, landingPad, derrick,
} from './nasakit.js';
import { rover, flag, glazedPorch, lifeAround } from './models_nasa.js';
import { porch, pipe, band, beacon } from './models_agency.js';

const PI = Math.PI;
const GREEN = 0x2f8f4a, BLUE = 0x2a5db0, PURPLE = 0x6a4fb0, TEAL = 0x2a8a8a, AMBER = 0xe2b42a;

// a sapling or fruit tree in a planter tub (inside greenhouses)
function tubTree(M, x, z, h = 2.0, r = 0.8, k = 0, fruit = false) {
  M.cyl('metal', x, 0, z, 0.45, 0.5, N.STEEL, 12);
  M.cyl('plant', x, 0.5, z, 0.42, 0.04, 0x3b2a1e, 12);
  M.cyl('plant', x, 0.5, z, 0.06, h - 0.3, 0x5a3b26, 6);
  M.sphere('plant', x, 0.5 + h, z, r, k % 2 ? 0x3d7f3a : 0x2f6b34, 10, 0.85);
  M.sphere('plant', x + r * 0.4, 0.3 + h, z - r * 0.2, r * 0.6, 0x47843d, 8, 0.85);
  if (fruit) for (let i = 0; i < 6; i++) { const a = i * 1.1 + k; M.sphere('plant', x + Math.cos(a) * r * 0.75, 0.35 + h + Math.sin(i * 2.3) * r * 0.3, z + Math.sin(a) * r * 0.75, 0.08, k % 2 ? 0xd9692a : 0xc9302a, 6); }
}

// ---------------------------------------------------------------- crew lounge (7x7)
// a pressure vessel with a panoramic window band and an observation cupola,
// a small grow tube of herbs outside the window
export function lounge(M, open = false) {
  plinth(M, 7, 7);
  const vx = -0.4, vz = 0.5;
  deployFrame(M, vx, vz, 4.2, 4.0, 0.5);
  const cap = vessel(M, vx, vz, { r: 2.1, h: 3.0, y0: 0.55, loft: 0, hatches: [PI], segs: 10 });
  viewBand(M, vx, vz, 2.1, 1.5, 1.05, { from: PI + 0.5, to: PI * 3 - 0.5, n: 16 });
  cupola(M, vx, cap - 0.05, vz, 0.75);
  porch(M, vx, vz - 2.1, 0.55, { w: 1.4, d: 1.0 });
  growTube(M, 2.55, 0.85, -1.6, 2.4, 0.55, PI / 2);
  radiatorWing(M, -2.6, 3.05, 0, { w: 1.2, h: 2.0, y0: 0.45 });
  avionics(M, 2.6, 0, 2.6, 0.7, 0.6, 0.5);
  M.light(vx, 2.0, vz - 2.6, L.warm, 1.4, 7);
  if (open) { glazedPorch(M, vx, vz - 2.6, 1.4, 1.0, 0.55); lifeAround(M, [[-2.7, -2.6]], [[1.2, -2.9, 0]]); }
  M.entry(vx);
}

// ---------------------------------------------------------------- fitness centre (10x8)
// a long soft-goods module for the treadmill, cycle and resistance gear,
// berthed to a small vessel with the airlock; radiators for the heat load
export function gym(M, open = false) {
  plinth(M, 10, 8);
  const vx = -3.1, vz = 0.9;
  deployFrame(M, vx, vz, 3.4, 3.2, 0.45);
  vessel(M, vx, vz, { r: 1.6, h: 2.6, y0: 0.5, loft: 1.0, hatches: [PI], ports: [{ a: -PI / 2 }], segs: 8 });
  band(M, vx, vz, 1.6, 2.4, 0.26, TEAL);
  porch(M, vx, vz - 1.6, 0.5, { w: 1.3, d: 1.0 });
  deployFrame(M, 1.6, vz, 5.4, 2.2, 0.3);
  inflatable(M, 1.6, 1.75, vz, 5.8, 1.45, 0, { color: 0xeeebe2 });
  radiatorWing(M, -0.4, 3.35, 0, { w: 1.4, h: 2.2, y0: 0.45 });
  radiatorWing(M, 1.4, 3.35, 0, { w: 1.4, h: 2.2, y0: 0.45 });
  avionics(M, 4.2, 0, -2.6, 0.8, 0.7, 0.6);
  rosa(M, 4.1, 3.2, 5.0, 0, { span: 1.4, height: 1.8 });
  if (open) {
    glazedPorch(M, vx, vz - 2.1, 1.3, 1.0, 0.5);
    // an outdoor running loop marked on the deck
    M.add('concrete', new THREE.RingGeometry(1.4, 1.7, 40), { pos: v(1.8, 0.03, -2.4), rot: e(-PI / 2, 0, 0), scale: v(1.9, 1, 0.8), color: 0x9c4f3a });
    lifeAround(M, [[-1.0, -3.0]], []);
  }
  M.entry(vx);
}

// ---------------------------------------------------------------- textile works (8x8)
// a rigid hangar for spinning and weaving, polymer and dye tanks feeding
// it, bolts of finished fabric on a rack, bales waiting outside
export function textile(M, open = false) {
  plinth(M, 8, 8);
  hangar(M, -1.1, 0.7, 4.2, 5.6, 3.5, 0, { stripe: PURPLE });
  for (const [z, b] of [[2.6, PURPLE], [1.3, AMBER]]) tankV(M, 2.8, z, 0.42, 2.1, { y0: 0.3, band: b });
  pipe(M, [2.8, 2.6, 1.95], [1.1, 2.4, 1.2], 3.0, 0.06, 0xc9a640);
  // fabric bolts on an outdoor rack
  M.box('metal', 2.8, 0.9, -1.3, 1.6, 0.06, 1.1, N.STEEL);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) M.cyl('metal', 2.8 + sx * 0.75, 0, -1.3 + sz * 0.5, 0.04, 1.6, N.STEEL, 6);
  const cols = [0x6a4fb0, 0xc9a640, 0x2f8f4a, 0xd25b3a, 0x2a5db0, 0xe8e3d8];
  for (let i = 0; i < 6; i++) M.add('mli', new THREE.CylinderGeometry(0.17, 0.17, 1.0, 14), { pos: v(2.3 + (i % 3) * 0.48, 1.1 + Math.floor(i / 3) * 0.36, -1.3), rot: e(PI / 2, 0, 0), color: cols[i] });
  M.box('metal', 2.8, 1.62, -1.3, 1.6, 0.05, 1.1, N.STEEL);
  M.col(1.9, 0, -1.9, 3.7, 1.7, -0.7);
  cargoBags(M, -3.1, -3.0, 4, 0);
  avionics(M, 3.2, 0, 3.3, 0.6, 0.6, 0.5);
  if (open) lifeAround(M, [[2.8, -3.2]], []);
  M.entry(-1.1);
}

// ---------------------------------------------------------------- orchard (10x10)
// a geodesic greenhouse of fruit trees in planter tubs, a long grow tube of
// berries, a water sphere and its pipe, the climate control box
export function orchard(M, open = false) {
  plinth(M, 10, 10);
  const dx = -1.4, dz = 0.9, r = 3.3;
  M.cyl('plant', dx, 0.02, dz, r - 0.2, 0.06, 0x4a6b2f, 40);
  for (const [x, z, k] of [[-1.2, -0.9, 0], [1.1, -0.6, 1], [-1.6, 1.2, 1], [0.6, 1.5, 0], [0, 0.2, 0]]) tubTree(M, dx + x, dz + z, 1.4 + (k ? 0.3 : 0), 0.65, k, true);
  geodesicDome(M, dx, dz, r, { skirt: 0.45 });
  hatch(M, dx, 0.1, dz - r - 0.05, PI, { w: 0.9, h: 1.7, depth: 0.22, label: false });
  growTube(M, 3.6, 0.95, 0.4, 5.2, 0.62, PI / 2);
  sphereTank(M, 3.4, 1.2, -3.6, 0.75);
  pipe(M, [3.4, 1.2, -2.9], [3.6, 0.9, -2.2], 1.9, 0.06, 0x5b8ec7);
  avionics(M, -4.0, 0, -3.8, 0.8, 0.7, 0.6);
  if (open) lifeAround(M, [[-4.0, 3.9], [0.8, -4.0]], [[-2.2, -4.0, 0]]);
  M.entry(dx);
}

// ---------------------------------------------------------------- pharmaceutical lab (8x8)
// a clean-room vessel with an air handler on top, a process module berthed
// to it, reagent gases in a rack, cryo dewars, the green cross on the module
export function pharma(M, open = false) {
  plinth(M, 8, 8);
  const vx = -1.7, vz = 1.2;
  deployFrame(M, vx, vz, 3.4, 3.2, 0.5);
  const cap = vessel(M, vx, vz, { r: 1.65, h: 2.6, y0: 0.55, loft: 0, hatches: [PI], ports: [{ a: -PI / 2 }], segs: 8 });
  band(M, vx, vz, 1.65, 2.35, 0.22, GREEN);
  // air handler on the roof
  M.box('metal', vx, cap + 0.35, vz, 1.6, 0.7, 1.1, 0xc9ccd0);
  for (const sx of [-1, 1]) M.cyl('metal', vx + sx * 0.4, cap + 0.7, vz, 0.28, 0.06, N.DARK, 16);
  porch(M, vx, vz - 1.65, 0.55, { w: 1.3, d: 1.0 });
  tubeModule(M, 1.75, 1.55, vz, 3.2, 1.0, 0, { ports: 2, ribs: 2 });
  M.box('shell', 2.0, 1.55, vz - 1.02, 0.8, 0.8, 0.04, 0xf2f2f2);
  M.box('concrete', 2.0, 1.55, vz - 1.05, 0.56, 0.16, 0.02, GREEN);
  M.box('concrete', 2.0, 1.55, vz - 1.05, 0.16, 0.56, 0.02, GREEN);
  bottleRack(M, 2.4, -2.9, 0, 4, 0x5b8ec7);
  for (const [x, z] of [[-3.3, -2.9], [-2.7, -3.3]]) tankV(M, x, z, 0.26, 1.1, { y0: 0.2, band: 0x3a7bd5, key: 'steel', color: 0xd5d8db });
  radiatorWing(M, -0.6, 3.4, 0, { w: 1.3, h: 2.0, y0: 0.45 });
  if (open) { glazedPorch(M, vx, vz - 2.15, 1.3, 1.0, 0.55); lifeAround(M, [[0.4, -3.3]], []); }
  M.entry(vx);
}

// ---------------------------------------------------------------- transit station (10x6)
// a pressurised waiting module along a raised platform, a canopy over the
// boarding edge, signal masts and a lit departure board
export function transit(M, open = false) {
  plinth(M, 10, 6);
  tubeModule(M, 0, 1.75, 1.3, 6.4, 1.1, 0, { ports: 4, ribs: 4, endHatch: true, startHatch: true });
  for (const x of [-1.6, 1.6]) hatch(M, x, 0.85, 1.3 - 1.18, PI, { w: 0.8, h: 1.4, depth: 0.2 });
  grating(M, 0, 0.85, -1.0, 8.4, 1.8);
  railing(M, -4.2, -1.9, 4.2, -1.9, 0.85, 1.0, N.YELLOW);
  ramp(M, -4.7, -0.2, PI / 2, 0.85, { w: 1.1, run: 1.6 });
  // canopy over the platform
  for (const x of [-3.6, 0, 3.6]) M.cyl('metal', x, 0.85, -1.8, 0.07, 2.6, N.FRAME, 8);
  M.box('shell', 0, 3.5, -1.0, 8.6, 0.16, 2.2, N.SHELL2);
  M.box('emissive', 0, 3.4, -1.0, 7.6, 0.02, 0.12, L.warm);
  M.col(-4.3, 3.4, -2.1, 4.3, 3.6, 0.1);
  // departure board and signal masts
  M.box('metal', 2.4, 2.6, -1.85, 1.4, 0.5, 0.08, N.DARK);
  M.box('emissive', 2.4, 2.62, -1.9, 1.25, 0.32, 0.02, 0x7fe0a0);
  for (const [x, c] of [[-4.6, L.green], [4.6, L.red]]) { M.cyl('metal', x, 0, -2.6, 0.06, 3.0, N.FRAME, 8); M.box('metal', x, 2.8, -2.6, 0.3, 0.6, 0.25, N.DARK); M.sphere('blink', x, 2.95, -2.75, 0.08, c, 6); }
  M.light(0, 3.0, -1.0, L.warm, 1.6, 9);
  if (open) lifeAround(M, [[-4.2, 2.6], [4.2, 2.6]], []);
  M.entry(-4.7);
}

// ---------------------------------------------------------------- university (12x12)
// a library vessel with its loft, lecture modules berthed east and west, a
// laboratory module north, an observatory cupola, the campus antenna dish,
// a weather station and roll-out arrays
export function university(M, open = false) {
  plinth(M, 12, 12);
  const vx = 0, vz = 0.6;
  deployFrame(M, vx, vz, 5.0, 4.8, 0.55);
  vessel(M, vx, vz, { r: 2.4, h: 3.2, y0: 0.6, loft: 1.4, hatches: [PI], ports: [{ a: PI * 0.75 }, { a: PI * 1.25 }], segs: 10 });
  band(M, vx, vz, 2.4, 2.9, 0.22, BLUE);
  porch(M, vx, vz - 2.4, 0.6, { w: 1.6, d: 1.1 });
  tubeModule(M, 4.05, 1.75, vz, 3.6, 1.15, 0, { ports: 3, ribs: 3 });
  tubeModule(M, -4.05, 1.75, vz, 3.6, 1.15, 0, { ports: 3, ribs: 3, endHatch: false, startHatch: true });
  tubeModule(M, 0, 1.75, 4.4, 2.6, 1.1, PI / 2, { ports: 0, ribs: 2, endHatch: false });
  cupola(M, 0, 2.9, 4.4, 0.7);
  // campus dish on a pedestal
  const dx = 4.4, dz = 4.4;
  M.cyl('concrete', dx, 0, dz, 0.9, 0.5, 0x8f8a84, 20);
  M.cyl('metal', dx, 0.5, dz, 0.3, 1.6, N.FRAME, 12);
  const prof = []; for (let i = 0; i <= 12; i++) { const t = i / 12; prof.push(new THREE.Vector2(0.05 + t * 1.5, t * t * 0.55)); }
  const dg = new THREE.LatheGeometry(prof, 32); dg.rotateX(-0.6); dg.translate(dx, 2.4, dz);
  M.add('shell', dg, { color: 0xe8e6e0 });
  M.add('metal', new THREE.CylinderGeometry(0.03, 0.03, 1.4, 6).rotateX(-0.6).translate(dx, 2.9, dz - 0.4), { color: N.DARK });
  M.colCyl(dx, dz, 0.9, 0, 2.4);
  instrumentMast(M, -5.2, -5.0, 4.4);
  rosa(M, 5.0, -4.6, 5.5, 0, { span: 1.6, height: 2.0 });
  rosa(M, -5.0, 4.8, 5.5, 0, { span: 1.4, height: 1.8 });
  avionics(M, -2.6, 0, -4.8, 0.8, 0.7, 0.6);
  if (open) { glazedPorch(M, vx, vz - 2.95, 1.6, 1.1, 0.6); lifeAround(M, [[-3.0, -3.4], [3.0, -3.4]], [[-1.8, -5.0, 0], [1.8, -5.0, 0]]); }
  M.entry(vx);
}

// ---------------------------------------------------------------- fabrication plant (10x8)
// a big rigid hangar for the fabrication line, feedstock tanks and process
// columns venting, a pipe rack into the hall, material bags at the door
export function factory(M, open = false) {
  plinth(M, 10, 8);
  hangar(M, -1.4, 0.6, 5.6, 6.0, 4.4, 0, { stripe: N.ORANGE });
  processColumn(M, 3.2, 2.6, 0.38, 4.6, { yaw: PI });
  processColumn(M, 3.6, 0.8, 0.28, 3.4, { yaw: PI });
  tankV(M, 3.5, -1.4, 0.5, 2.2, { y0: 0.3, band: N.ORANGE });
  pipeRack(M, 1.4, 2.6, 3.2, 2.6, 2.6, 3);
  pipe(M, [3.5, 2.5, -1.4], [1.4, 2.0, -0.6], 3.0, 0.07, 0xc9a640);
  cargoBags(M, -4.3, -3.2, 6, 0);
  floodMast(M, 4.4, -3.3, 6, PI * 0.85);
  if (open) lifeAround(M, [[2.4, -3.2]], []);
  M.entry(-1.4);
}

// ---------------------------------------------------------------- high-tech plant (10x10)
// two clean-room modules on a deployment frame, a bank of radiators for
// their heat, gas cabinets, an ultra-pure water column, a node joining them
export function techplant(M, open = false) {
  plinth(M, 10, 10);
  deployFrame(M, -0.6, 0.4, 7.2, 5.0, 0.45);
  for (const z of [-0.9, 1.7]) tubeModule(M, -0.6, 1.6, z, 6.4, 1.15, 0, { ports: 3, ribs: 4, endHatch: z < 0, startHatch: false });
  node(M, -4.4, 1.6, 0.4, 1.2, 1.4, PI / 2, []);
  hatch(M, -4.4, 0.75, 0.4 - 1.25, PI, { w: 0.8, h: 1.4, depth: 0.2 });
  porch(M, -4.4, 0.4 - 1.3, 0.75, { w: 1.2, d: 0.9, run: 1.6 });
  for (const x of [-2.6, -1.0, 0.6, 2.2]) radiatorWing(M, x, 3.6, 0, { w: 1.4, h: 2.6, y0: 0.5 });
  bottleRack(M, 2.6, -3.6, 0, 4, 0x8a8f94);
  processColumn(M, 4.0, -0.8, 0.3, 4.0, { yaw: PI / 2 });
  pipe(M, [4.0, 3.0, -0.8], [2.6, 1.8, -0.9], 3.6, 0.06, 0x5b8ec7);
  avionics(M, -4.2, 0, -4.0, 0.8, 0.7, 0.6);
  if (open) lifeAround(M, [[0.6, -4.0]], []);
  M.entry(-4.4);
}

// ---------------------------------------------------------------- colony headquarters (16x16)
// the colony's command vessel with its loft and comm mast, a command module
// east, a crew module west, a long soft-goods module north, a shuttle pad,
// the comm tower, solar arrays, radiators, flags and floodlights
export function hq(M, open = false) {
  plinth(M, 16, 16);
  const vx = -0.6, vz = 0.4;
  deployFrame(M, vx, vz, 6.4, 6.2, 0.6);
  const cap = vessel(M, vx, vz, { r: 3.0, h: 3.6, y0: 0.65, loft: 1.8, hatches: [PI], ports: [{ a: PI * 0.72 }, { a: PI * 1.28 }, { a: -PI / 2 }, { a: PI / 2 }], segs: 12 });
  band(M, vx, vz, 3.0, 3.4, 0.3, N.ORANGE);
  M.cyl('metal', vx, cap - 0.2, vz, 0.05, 3.2, N.FRAME, 8);
  for (let i = 0; i < 3; i++) M.box('metal', vx, cap + 1.0 + i * 0.7, vz, 0.9 - i * 0.2, 0.04, 0.04, N.FRAME);
  beacon(M, vx, cap + 3.0, vz, L.red);
  porch(M, vx, vz - 3.0, 0.65, { w: 1.8, d: 1.2 });
  tubeModule(M, 4.6, 2.0, vz, 4.4, 1.3, 0, { ports: 3, ribs: 3 });
  tubeModule(M, -5.8, 2.0, vz, 3.6, 1.3, 0, { ports: 2, ribs: 2, endHatch: false, startHatch: true });
  deployFrame(M, vx, 5.4, 2.6, 4.2, 0.35);
  inflatable(M, vx, 1.9, 5.5, 4.2, 1.5, PI / 2);
  for (const x of [3.6, 5.2]) radiatorWing(M, x, 3.0, 0, { w: 1.4, h: 2.6, y0: 0.55 });
  for (const x of [-6.6, -5.0]) radiatorWing(M, x, 3.0, 0, { w: 1.4, h: 2.6, y0: 0.55 });
  landingPad(M, 4.8, -4.8, 2.6);
  lattice(M, 6.6, 6.6, 1.3, 15, { mast: true, stairs: false });
  rosa(M, -6.6, -6.0, 6.0, 0, { span: 1.8, height: 2.4 });
  rosa(M, -6.6, 6.4, 6.0, 0, { span: 1.8, height: 2.4 });
  flag(M, -2.6, -6.8, 7, 'colony');
  flag(M, -1.2, -6.8, 7, 'agency');
  floodMast(M, 7.2, -1.2, 7, -PI / 2);
  floodMast(M, -7.4, 0.4, 7, PI / 2);
  rover(M, 1.8, -6.0, 0, N.ORANGE);
  for (let i = 0; i < 2; i++) avionics(M, 6.6, 0, 1.6 + i * 1.0, 0.8, 0.7, 0.6, PI / 2);
  if (open) { glazedPorch(M, vx, vz - 3.6, 1.8, 1.2, 0.65); lifeAround(M, [[-4.6, -4.2], [-6.8, -2.6]], [[-3.6, -5.6, 0]]); }
  M.entry(vx);
}

// ---------------------------------------------------------------- hydroponic farm (8x12)
// three long grow tubes of lettuce, wheat and tomato under magenta light,
// a small control vessel at the back, the nutrient tanks out front
export function farm(M, open = false) {
  plinth(M, 8, 12);
  for (const x of [-2.5, 0, 2.5]) growTube(M, x, 1.05, -0.3, 7.0, 0.95, PI / 2);
  const cap = vessel(M, 0, 4.6, { r: 1.25, h: 2.2, y0: 0.4, loft: 0, hatches: [PI / 2], segs: 6 });
  cupola(M, 0, cap - 0.05, 4.6, 0.55);
  hatch(M, 0, 0.5, -3.95, PI, { w: 0.8, h: 1.3, depth: 0.2, label: false });
  porch(M, 0, -4.0, 0.5, { w: 1.2, d: 0.8, run: 1.0 });
  sphereTank(M, -2.7, 1.1, -4.9, 0.7);
  tankV(M, 2.7, -4.9, 0.45, 1.6, { y0: 0.25, band: GREEN });
  pipe(M, [-2.7, 1.1, -4.2], [-2.5, 1.0, -3.7], 1.8, 0.06, 0x5b8ec7);
  pipe(M, [2.7, 1.9, -4.9], [2.5, 1.0, -3.7], 2.2, 0.06, 0x2f8f4a);
  avionics(M, 2.6, 0, 4.8, 0.7, 0.6, 0.5);
  if (open) lifeAround(M, [[-3.3, 5.2]], []);
  M.entry(0);
}

// ---------------------------------------------------------------- water extraction (4x4)
// a drilling derrick over the ice well, the pump skid, a water tank
export function pump(M, open = false) {
  plinth(M, 4, 4);
  grating(M, -0.5, 0.3, -0.4, 2.0, 2.0);
  derrick(M, -0.5, -0.4, 4.6, 1.5);
  M.box('metal', -0.5, 0.65, -0.4, 0.8, 0.7, 0.8, 0x3a6aa0);
  tankV(M, 1.2, 1.1, 0.5, 1.8, { y0: 0.25, band: 0x3a7bd5 });
  pipe(M, [-0.5, 0.9, 0.0], [1.2, 1.3, 1.1], 1.4, 0.06, 0x5b8ec7);
  avionics(M, 1.3, 0, -1.4, 0.5, 0.5, 0.4);
  if (open) lifeAround(M, [[-1.3, 1.3]], []);
  M.entry(-0.5);
}

// ---------------------------------------------------------------- park (10x10)
// before the air is breathable: a geodesic garden dome over grass, trees and
// benches; after: the same garden open to the sky inside a low ring wall
export function park(M, open = false) {
  plinth(M, 10, 10);
  const r = 4.3;
  M.cyl('plant', 0, 0.02, 0, r - 0.2, 0.06, 0x4f7a34, 48);
  M.box('concrete', 0, 0.07, -1.6, 0.9, 0.04, 5.0, 0xb8b2a8);
  M.cyl('concrete', 0, 0.07, 0.8, 1.0, 0.05, 0xb8b2a8, 24);
  for (const [x, z, k] of [[-2.2, -1.0, 0], [2.0, -1.4, 1], [-1.8, 2.0, 1], [2.2, 1.8, 0], [0, 2.9, 0]]) tubTree(M, x, z, 1.8 + k * 0.4, 0.85, k);
  for (const [x, z] of [[-1.0, -2.6], [1.0, -2.6]]) { M.box('metal', x, 0.42, z, 0.5, 0.06, 1.4, N.FRAME); M.box('metal', x, 0.21, z, 0.06, 0.42, 1.2, N.DARK); }
  if (open) {
    M.cyl('shell', 0, 0, 0, r, 0.5, N.SHELL2, 48);
    M.cyl('plant', 0, 0.48, 0, r - 0.15, 0.04, 0x4f7a34, 48);
    lifeAround(M, [[-3.9, -3.9], [3.9, -3.9]], []);
  } else {
    geodesicDome(M, 0, 0, r, { skirt: 0.5 });
    hatch(M, 0, 0.1, -r - 0.05, PI, { w: 0.9, h: 1.7, depth: 0.22, label: false });
    avionics(M, 3.9, 0, -4.0, 0.7, 0.6, 0.5);
  }
  M.entry(0);
}

// ---------------------------------------------------------------- cultural centre (12x12)
// an auditorium in a large soft-goods module on a frame, a lobby vessel with
// a window band at the front, banner masts, floodlights
export function culture(M, open = false) {
  plinth(M, 12, 12);
  deployFrame(M, 0, 2.2, 3.4, 8.2, 0.4);
  inflatable(M, 0, 2.6, 2.2, 8.2, 2.1, PI / 2, { color: 0xefeadf });
  const vx = 0, vz = -3.0;
  deployFrame(M, vx, vz, 3.6, 3.4, 0.5);
  vessel(M, vx, vz, { r: 1.8, h: 2.8, y0: 0.55, loft: 0, hatches: [PI], segs: 8 });
  viewBand(M, vx, vz, 1.8, 1.4, 0.9, { from: PI + 0.45, to: PI * 2 + 0.6, n: 10 });
  band(M, vx, vz, 1.8, 2.75, 0.26, PURPLE);
  M.add('shell', new THREE.CylinderGeometry(0.9, 0.9, 1.2, 24), { pos: v(0, 1.75, -0.9), rot: e(PI / 2, 0, 0), color: N.SHELL2 });
  porch(M, vx, vz - 1.8, 0.55, { w: 1.4, d: 0.9, run: 1.2 });
  const cols = [PURPLE, AMBER, TEAL, 0xd25b3a];
  for (let i = 0; i < 4; i++) {
    const x = -4.8 + i * 3.2;
    M.cyl('metal', x, 0, -5.4, 0.05, 5.2, N.FRAME, 8);
    M.box('mli', x + 0.35, 4.0, -5.4, 0.6, 1.8, 0.02, cols[i]);
  }
  floodMast(M, -5.2, 5.0, 7, PI * 0.8);
  floodMast(M, 5.2, 5.0, 7, -PI * 0.8);
  avionics(M, 4.4, 0, -2.0, 0.8, 0.7, 0.6);
  if (open) { glazedPorch(M, vx, vz - 2.25, 1.4, 0.9, 0.55); lifeAround(M, [[-3.6, -2.6], [3.6, -3.8]], [[-2.8, -4.6, 0], [2.6, -4.6, 0]]); }
  M.entry(vx);
}

// ---------------------------------------------------------------- memorial (10x10)
// the colony's memorial: a leg of the first lander kept where it stood, a
// steel orbit ring, a granite plaque, the colony flag
export function monument(M, open = false) {
  plinth(M, 10, 10);
  M.cyl('concrete', 0, 0, 0.6, 3.6, 0.25, 0x8f8a84, 48);
  M.cyl('concrete', 0, 0.25, 0.6, 3.2, 0.05, 0x9a948c, 48);
  // the lander leg: strut, footpad, shock absorber
  strut(M, [0.4, 0.3, 0.9], [-0.6, 3.6, 0.2], 0.22, 0xd9dcdf);
  strut(M, [0.4, 0.3, 0.9], [0.9, 2.8, 0.0], 0.12, 0x9aa0a6);
  M.cyl('steel', 0.4, 0.25, 0.9, 0.55, 0.16, 0xd9dcdf, 24);
  M.add('foil', new THREE.BoxGeometry(0.5, 0.5, 0.5), { pos: v(-0.6, 3.7, 0.2), color: 0xd8a640 });
  // steel orbit ring around it
  M.add('steel', new THREE.TorusGeometry(2.3, 0.07, 8, 64), { pos: v(0, 2.2, 0.6), rot: e(PI / 2 - 0.35, 0.3, 0), color: 0xe0e3e6 });
  for (const a of [0.4, 2.5, 4.6]) M.cyl('metal', Math.sin(a) * 2.2, 0.25, 0.6 + Math.cos(a) * 2.2, 0.04, 1.6 + Math.sin(a) * 0.6, N.FRAME, 6);
  // granite plaque and the flag
  M.add('stone', new THREE.BoxGeometry(2.2, 1.0, 0.3), { pos: v(0, 0.75, -2.9), rot: e(-0.3, 0, 0), color: 0x4a4744 });
  M.box('metal', 0, 0.85, -3.06, 1.8, 0.5, 0.02, 0xc9b27a);
  flag(M, 2.8, -2.6, 6, 'colony');
  M.light(0, 1.0, -3.6, L.warm, 1.2, 6);
  if (open) lifeAround(M, [[-3.8, -3.8], [3.8, -3.8], [-3.8, 3.8], [3.8, 3.8]], [[-2.0, -4.2, 0]]);
  M.entry(0);
}
