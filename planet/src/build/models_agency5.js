// The colony's newer working parts (fifth batch of the agency kit): field
// gear for explorers, science stations, more ways to make power, plants that
// push the atmosphere harder, the methane economy and what the townspeople
// spend their evenings on. Same language as the rest: shell vessels and tube
// modules, frames, tanks, radiators, avionics in gold foil.
import * as THREE from 'three';
import { L, v, e, plinth, room, airlock } from './modelkit.js';
import { strut, lattice, tankH, floodMast, pipeRack } from './starkit.js';
import {
  N, hatch, vessel, tubeModule, radiatorWing, deployFrame, grating, avionics, bottleRack, cupola,
  tankV, sphereTank, processColumn, hangar, instrumentMast, geodesicDome, viewBand, landingPad, dishAntenna,
} from './nasakit.js';
import { porch, pipe, band, beacon } from './models_agency.js';

const PI = Math.PI;
const GREEN = 0x2f8f4a, BLUE = 0x2a5db0, AMBER = 0xe2b42a, CH4 = 0x3f8fd8;

function gStrut(g, a, b, t, color) {
  const A = v(...a), B = v(...b), d = B.clone().sub(A), len = d.length();
  const q = new THREE.Quaternion().setFromUnitVectors(v(0, 1, 0), d.normalize());
  g.add(new THREE.BoxGeometry(t, len, t), { pos: A.clone().add(B).multiplyScalar(0.5), rot: new THREE.Euler().setFromQuaternion(q), color });
}
function tub(M, x, z, h = 2.0, r = 0.8, k = 0) {
  M.cyl('metal', x, 0, z, 0.45, 0.5, N.STEEL, 12);
  M.cyl('plant', x, 0.5, z, 0.42, 0.04, 0x3b2a1e, 12);
  M.cyl('plant', x, 0.5, z, 0.06, h - 0.3, 0x5a3b26, 6);
  M.sphere('plant', x, 0.5 + h, z, r, k % 2 ? 0x3d7f3a : 0x2f6b34, 10, 0.85);
  M.colCyl(x, z, 0.45, 0, 0.5);
}

// ---------------------------------------------------------------- field gear
// oxygen station (2x2): a pair of O2 bottles in a rack, the regulator panel
// with its hose reel, a small array and a battery for the night, a light
export function o2station(M) {
  plinth(M, 2, 2);
  grating(M, 0, 0.06, 0, 1.9, 1.9);
  bottleRack(M, -0.35, 0.55, 0, 2, GREEN);
  M.cyl('metal', 0.55, 0, -0.45, 0.05, 1.1, N.FRAME, 8);
  M.box('shell', 0.55, 1.1, -0.45, 0.62, 0.7, 0.24, N.SHELL);
  M.box('metal', 0.55, 1.22, -0.58, 0.4, 0.22, 0.02, N.DARK);
  M.box('emissive', 0.55, 1.22, -0.595, 0.3, 0.12, 0.01, L.green);
  M.add('metal', new THREE.TorusGeometry(0.17, 0.05, 6, 16), { pos: v(0.55, 0.82, -0.6), color: N.ORANGE });
  M.cyl('metal', 0.55, 0.82, -0.62, 0.06, 0.05, N.DARK, 10);
  M.box('foil', 0.55, 0.3, -0.45, 0.5, 0.42, 0.34, 0xd8a640);
  M.cyl('metal', 0.75, 0, 0.6, 0.04, 1.9, N.FRAME, 6);
  M.add('solar', new THREE.BoxGeometry(0.7, 0.03, 0.5), { pos: v(0.75, 1.95, 0.6), rot: e(-0.5, 0, 0) });
  M.sphere('blink', 0.75, 2.2, 0.6, 0.05, L.green, 6);
  M.col(0.25, 0, -0.6, 0.85, 1.45, -0.3);
}
// field shelter (5x5): a one-room pressurised module you can walk into: a
// bunk, a locker and an oxygen panel inside; frame, small airlock, radiator
export function shelter(M) {
  plinth(M, 5, 5);
  room(M, 4.0, 4.0, 2.5, { door: 1.1, doorH: 2.1, winSide: 1, winBack: 0, key: 'shell', color: N.SHELL, roofColor: N.SHELL2 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) M.bb('metal', sx * 2.0 - 0.12, 0, sz * 2.0 - 0.12, sx * 2.0 + 0.12, 2.86, sz * 2.0 + 0.12, N.FRAME);
  M.bb('metal', -2.08, 0.1, -2.12, 2.08, 0.2, -2.06, N.FRAME);
  airlock(M, 0, -2.0, 1.1, 2.2, 0.4, N.SHELL2);
  M.box('shell', -1.2, 2.15, -2.13, 0.7, 0.14, 0.02, N.STENCIL);
  radiatorWing(M, -1.6, 1.5, 0, { w: 1.4, h: 0.9, y0: 2.88 });
  tankV(M, 1.3, 1.1, 0.22, 0.9, { y0: 2.88, band: GREEN });
  M.cyl('metal', 1.6, 2.88, -1.6, 0.03, 1.4, N.FRAME, 6);
  M.sphere('blink', 1.6, 4.32, -1.6, 0.05, L.red, 6);
  // inside: bunk, locker, oxygen panel
  M.bb('metal', -1.75, 0.02, 0.3, -0.85, 0.42, 1.75, N.STEEL);
  M.bb('interior', -1.72, 0.42, 0.33, -0.88, 0.55, 1.72, 0xd8dde3);
  M.bb('interior', -1.72, 0.55, 1.3, -0.88, 0.64, 1.7, 0xf2f2ee);
  M.bb('metal', 1.2, 0.02, 1.2, 1.75, 1.9, 1.75, 0x8a9096);
  M.bb('emissive', 1.18, 1.0, 1.25, 1.2, 1.3, 1.5, L.green);
  M.bb('metal', 1.7, 0.9, -0.6, 1.78, 1.5, 0.2, N.DARK);
  M.bb('emissive', 1.69, 1.05, -0.5, 1.7, 1.35, 0.1, L.cyan);
  M.col(-1.75, 0, 0.3, -0.85, 0.55, 1.75);
  M.col(1.2, 0, 1.2, 1.75, 1.9, 1.75);
  M.entry(0);
}

// ---------------------------------------------------------------- science
// geology analyser (3x3): a sample-handling module: hopper on top, a robot
// arm feeding samples from a tray, the spectrometer window, avionics
export function analyzer(M) {
  plinth(M, 3, 3);
  deployFrame(M, -0.2, 0.2, 2.0, 1.4, 0.35);
  M.box('shell', -0.2, 0.95, 0.2, 2.0, 1.2, 1.3, N.SHELL);
  M.box('metal', -0.2, 1.62, 0.2, 2.06, 0.08, 1.36, N.FRAME);
  M.box('glass', -0.55, 1.0, -0.46, 0.8, 0.45, 0.03);
  M.box('emissive', 0.35, 1.25, -0.46, 0.35, 0.06, 0.02, L.green);
  M.add('metal', new THREE.CylinderGeometry(0.4, 0.15, 0.5, 4, 1, true), { pos: v(-0.7, 1.95, 0.3), rot: e(0, PI / 4, 0), color: 0x9aa0a6 });
  M.box('metal', 0.9, 0.55, -1.0, 0.7, 0.06, 0.5, N.STEEL);
  for (let i = 0; i < 4; i++) M.box('regolith', 0.7 + i * 0.14, 0.62, -1.0, 0.1, 0.08, 0.1, [0x7a4a36, 0x5a6a80, 0xb08a5a, 0x6a6a6a][i]);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) M.cyl('metal', 0.9 + sx * 0.3, 0, -1.0 + sz * 0.2, 0.025, 0.55, N.FRAME, 6);
  M.cyl('metal', 0.45, 1.6, 0.6, 0.12, 0.1, N.DARK, 12);
  const arm = M.animGroup('shell', { pivot: [0.45, 0, 0.6], axis: [0, 1, 0], speed: 0.6 });
  arm.add(new THREE.CylinderGeometry(0.09, 0.1, 0.14, 12), { pos: v(0.45, 1.77, 0.6), color: N.SHELL });
  gStrut(arm, [0.45, 1.8, 0.6], [0.3, 2.2, 0.25], 0.08, N.SHELL);
  gStrut(arm, [0.3, 2.2, 0.25], [0.45, 2.0, -0.15], 0.07, N.SHELL);
  arm.add(new THREE.BoxGeometry(0.1, 0.12, 0.1), { pos: v(0.45, 1.91, -0.2), color: N.ORANGE });
  avionics(M, 0.9, 0, 1.0, 0.6, 0.5, 0.5);
  M.cyl('metal', -1.2, 1.66, 0.8, 0.02, 0.9, N.FRAME, 4);
  M.col(-1.2, 0, -0.45, 0.8, 1.66, 0.85);
}
// survey radar (3x3): a lattice mast carrying a turning radar panel, the
// transmitter shelter at its foot
export function radar(M) {
  plinth(M, 3, 3);
  // slim braced mast, tapering
  const mx = 0.4, mz = 0.4, Hm = 4.4, w0 = 0.5, w1 = 0.22;
  const at = (sx, sz, y) => { const w = w0 + (w1 - w0) * y / Hm; return [mx + sx * w, y, mz + sz * w]; };
  const C4 = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (const [sx, sz] of C4) { strut(M, at(sx, sz, 0), at(sx, sz, Hm), 0.09, N.FRAME); M.cyl('metal', at(sx, sz, 0)[0], 0, at(sx, sz, 0)[2], 0.12, 0.08, N.DARK, 8); }
  for (let y = 0.0; y < Hm - 0.5; y += 1.1) for (let k = 0; k < 4; k++) {
    const [ax, az] = C4[k], [bx, bz] = C4[(k + 1) % 4];
    strut(M, at(ax, az, y), at(bx, bz, y + 1.1), 0.04, N.FRAME);
    strut(M, at(ax, az, y + 1.1), at(bx, bz, y + 1.1), 0.05, N.FRAME);
  }
  M.colCyl(mx, mz, 0.5, 0, Hm);
  M.box('metal', 0.4, 4.45, 0.4, 0.8, 0.1, 0.8, N.STEEL);
  M.cyl('metal', 0.4, 4.5, 0.4, 0.18, 0.3, N.DARK, 12);
  const g = M.animGroup('shell', { pivot: [0.4, 0, 0.4], axis: [0, 1, 0], speed: 0.9 });
  g.add(new THREE.BoxGeometry(2.4, 0.9, 0.14), { pos: v(0.4, 5.3, 0.4), rot: e(0.22, 0, 0), color: N.SHELL });
  for (let i = 0; i < 7; i++) g.add(new THREE.BoxGeometry(0.03, 0.8, 0.03), { pos: v(-0.65 + i * 0.35, 5.3, 0.31), rot: e(0.22, 0, 0), color: 0x9aa0a6 });
  g.add(new THREE.BoxGeometry(2.45, 0.05, 0.03), { pos: v(0.4, 5.3, 0.31), rot: e(0.22, 0, 0), color: 0x9aa0a6 });
  g.add(new THREE.BoxGeometry(0.3, 0.3, 0.3), { pos: v(0.4, 4.95, 0.5), color: N.DARK });
  M.box('shell', -0.75, 0.75, -0.7, 1.3, 1.5, 1.2, N.SHELL);
  M.box('shell', -0.75, 1.53, -0.7, 1.4, 0.06, 1.3, N.SHELL2);
  hatch(M, -0.75, 0.02, -1.3, PI, { w: 0.6, h: 1.2, depth: 0.08, label: false });
  avionics(M, -0.75, 1.56, -0.7, 0.7, 0.3, 0.6);
  M.col(-1.4, 0, -1.3, -0.1, 1.56, -0.1);
  M.sphere('blink', 0.4, 5.85, 0.4, 0.05, L.red, 6);
}
// observatory (6x6): a drum with a dome that turns, the slit open and the
// telescope looking out, the control module beside it
export function observatory(M) {
  plinth(M, 6, 6);
  const ox = 0.6, oz = 0.6;
  deployFrame(M, ox, oz, 3.8, 3.8, 0.45);
  const cap = vessel(M, ox, oz, { r: 2.0, h: 2.6, y0: 0.45, loft: 0, hatches: [PI], ports: [{ a: PI * 0.7 }, { a: -PI / 2 }], segs: 8 });
  const dome = M.animGroup('shell', { pivot: [ox, 0, oz], axis: [0, 1, 0], speed: 0.05 });
  dome.add(new THREE.SphereGeometry(1.95, 32, 12, 0, PI * 2, 0, PI / 2), { pos: v(ox, cap - 0.3, oz), color: 0xe9e7e1 });
  dome.add(new THREE.BoxGeometry(0.7, 1.4, 1.95), { pos: v(ox, cap + 0.75, oz - 1.0), rot: e(-0.55, 0, 0), color: N.DARK });
  const tube = new THREE.CylinderGeometry(0.32, 0.36, 2.2, 16); tube.rotateX(-0.75); tube.translate(ox, cap + 0.75, oz - 0.55);
  dome.add(tube, { color: 0xd8dce0 });
  dome.add(new THREE.TorusGeometry(1.97, 0.05, 6, 40), { pos: v(ox, cap - 0.28, oz), rot: e(PI / 2, 0, 0), color: N.FRAME });
  tubeModule(M, -1.9, 1.1, -1.0, 2.0, 0.75, PI / 2, { ribs: 2, ports: 1 });
  avionics(M, -2.2, 0, 2.1, 0.6, 0.5, 0.5);
  porch(M, ox, oz - 2.0, 0.45, { w: 1.2, d: 0.6, run: 0.9 });
  M.entry(ox);
}
// weather station (4x4): an instrument mast, a radome on a short tower, the
// louvred thermometer screen and the balloon shed with its helium bottle
export function weather(M) {
  plinth(M, 4, 4);
  instrumentMast(M, 1.4, 1.3, 5.2);
  M.cyl('metal', -1.0, 0, 1.0, 0.3, 2.0, N.FRAME, 10);
  M.sphere('shell', -1.0, 2.55, 1.0, 0.65, 0xf2f1ec, 20);
  M.cyl('metal', -1.0, 1.95, 1.0, 0.5, 0.12, N.DARK, 16);
  M.colCyl(-1.0, 1.0, 0.65, 0, 3.2);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) M.cyl('metal', 1.2 + sx * 0.22, 0, -1.2 + sz * 0.22, 0.025, 1.1, N.FRAME, 6);
  M.box('shell', 1.2, 1.35, -1.2, 0.55, 0.5, 0.55, 0xf4f4f0);
  for (let k = 0; k < 4; k++) M.box('metal', 1.2, 1.17 + k * 0.12, -1.48, 0.5, 0.02, 0.03, 0xc9c7c0);
  M.box('shell', -1.0, 0.8, -1.2, 1.6, 1.6, 1.2, N.SHELL);
  M.box('metal', -1.0, 0.75, -1.81, 1.1, 1.3, 0.03, 0xc9ccd0);
  M.col(-1.8, 0, -1.8, -0.2, 1.6, -0.6);
  M.cyl('shell', 0.25, 0, -1.55, 0.22, 1.2, 0xe8e8e4, 14);
  M.cyl('shell', 0.25, 0.9, -1.55, 0.225, 0.12, BLUE, 14);
}

// ---------------------------------------------------------------- power
// radioisotope generator (2x2): a finned converter on a cradle, keep-out
// posts and trefoil signs; it sheds its heat into the air
export function rtg(M) {
  plinth(M, 2, 2);
  M.box('metal', 0, 0.12, 0, 1.2, 0.24, 0.7, N.STEEL);
  for (const sx of [-1, 1]) M.box('metal', sx * 0.4, 0.42, 0, 0.1, 0.4, 0.6, N.STEEL);
  M.add('metal', new THREE.CylinderGeometry(0.28, 0.28, 1.1, 20), { pos: v(0, 0.75, 0), rot: e(0, 0, PI / 2), color: 0x3a3e44 });
  for (let k = 0; k < 8; k++) { const a = k / 8 * PI * 2; M.add('metal', new THREE.BoxGeometry(1.0, 0.03, 0.26), { pos: v(0, 0.75 + Math.sin(a) * 0.4, Math.cos(a) * 0.4), rot: e(a, 0, 0), color: 0x2a2d31 }); }
  for (const sx of [-1, 1]) M.add('metal', new THREE.CylinderGeometry(0.33, 0.33, 0.08, 20), { pos: v(sx * 0.58, 0.75, 0), rot: e(0, 0, PI / 2), color: N.FRAME });
  for (const [x, z] of [[-0.85, -0.85], [0.85, -0.85], [-0.85, 0.85], [0.85, 0.85]]) { M.cyl('metal', x, 0, z, 0.03, 0.9, N.YELLOW, 6); }
  M.box('metal', 0, 0.75, -0.86, 0.3, 0.3, 0.02, N.YELLOW);
  M.cyl('metal', 0, 0.75, -0.875, 0.05, 0.01, 0x1a1a1a, 10);
  M.vent(0, 1.2, 0, { rate: 0.25, size: 0.5, kind: 'heat' });
  M.col(-0.6, 0, -0.4, 0.6, 1.1, 0.4);
}
// geothermal plant (6x6): a wellhead stack over the bore, pipes to the
// turbine house, a small cooling tower letting off steam, radiators
export function geothermal(M) {
  plinth(M, 6, 6);
  const wx = -1.6, wz = -1.4;
  M.cyl('concrete', wx, 0, wz, 0.9, 0.2, 0x8f8a84, 20);
  for (let k = 0; k < 4; k++) { M.cyl('metal', wx, 0.2 + k * 0.42, wz, 0.42 - k * 0.04, 0.32, k % 2 ? 0xc9302a : 0x4a4f55, 16); M.cyl('metal', wx, 0.52 + k * 0.42, wz, 0.5 - k * 0.04, 0.08, N.FRAME, 16); }
  M.add('metal', new THREE.CylinderGeometry(0.12, 0.12, 0.7, 10), { pos: v(wx + 0.5, 1.0, wz), rot: e(0, 0, PI / 2), color: N.ORANGE });
  M.colCyl(wx, wz, 0.9, 0, 2.0);
  M.box('shell', 1.3, 1.2, 0.9, 2.8, 2.4, 2.4, N.SHELL);
  M.box('shell', 1.3, 2.45, 0.9, 2.9, 0.1, 2.5, N.SHELL2);
  M.box('metal', 1.3, 1.0, -0.32, 1.6, 1.8, 0.04, 0xc9ccd0);
  avionics(M, 0.5, 2.5, 1.5, 0.8, 0.4, 0.7);
  M.col(-0.1, 0, -0.3, 2.7, 2.5, 2.1);
  pipe(M, [wx + 0.7, 1.0, wz], [-0.1, 1.2, 0.4], 1.0, 0.14, 0xb8bec4);
  pipe(M, [wx, 1.8, wz], [-1.6, 2.2, 1.6], 2.4, 0.1, 0xb8bec4);
  const prof = []; for (let i = 0; i <= 10; i++) { const t = i / 10; prof.push(new THREE.Vector2(1.1 - Math.sin(t * PI) * 0.35 + t * 0.05, t * 3.6)); }
  M.add('concrete', new THREE.LatheGeometry(prof, 28), { pos: v(-1.6, 0, 1.6), color: 0xbab5ad });
  M.colCyl(-1.6, 1.6, 1.1, 0, 3.6);
  M.vent(-1.6, 3.8, 1.6, { rate: 1.6, size: 1.3 });
  radiatorWing(M, 2.85, -1.0, PI / 2, { w: 1.6, h: 1.4, y0: 0.3 });
}
// methane power plant (6x5): a turbine hall with its exhaust stack and two
// methane spheres feeding it
export function gasturbine(M) {
  plinth(M, 6, 5);
  hangar(M, -0.6, 0.3, 3.0, 4.2, 2.8, PI / 2, { stripe: N.ORANGE, door: false });
  M.cyl('metal', -2.5, 0, 1.6, 0.28, 5.4, N.FRAME, 14);
  M.cyl('metal', -2.5, 5.2, 1.6, 0.32, 0.2, N.DARK, 14);
  M.vent(-2.5, 5.5, 1.6, { rate: 1.2, size: 1.0, kind: 'exhaust' });
  M.colCyl(-2.5, 1.6, 0.3, 0, 5.4);
  for (const [x, z] of [[2.25, -1.4], [2.25, 0.4]]) sphereTank(M, x, 1.05, z, 0.65, {});
  band(M, 2.25, -1.4, 0.66, 1.0, 0.12, CH4); band(M, 2.25, 0.4, 0.66, 1.0, 0.12, CH4);
  pipe(M, [1.6, 1.0, -1.4], [0.9, 1.0, -0.4], 1.5, 0.07, CH4);
  avionics(M, 1.1, 0, 2.05, 0.6, 0.6, 0.4);
}
// solar power tower (8x8): heliostats in rings aimed at a receiver glowing
// at the top of the tower; hot and cold salt tanks at its foot
export function solarthermal(M) {
  plinth(M, 8, 8);
  const tx = 0.4, tz = 0.9, H = 7.2;
  M.cyl('shell', tx, 0, tz, 0.5, H, N.SHELL, 20);
  for (let y = 1.5; y < H; y += 1.5) M.add('metal', new THREE.TorusGeometry(0.51, 0.03, 4, 20), { pos: v(tx, y, tz), rot: e(PI / 2, 0, 0), color: N.FRAME });
  M.cyl('metal', tx, H, tz, 0.7, 0.2, N.DARK, 20);
  M.cyl('emissive', tx, H + 0.2, tz, 0.55, 0.9, L.orange, 20);
  M.cyl('metal', tx, H + 1.1, tz, 0.72, 0.2, N.FRAME, 20);
  M.cyl('metal', tx, H + 1.3, tz, 0.04, 0.8, N.FRAME, 6);
  M.sphere('blink', tx, H + 2.15, tz, 0.07, L.red, 6);
  M.light(tx, H + 0.6, tz, L.orange, 3, 10);
  M.colCyl(tx, tz, 0.55, 0, H + 1.3);
  const spots = [];
  for (const R of [2.4, 3.3]) for (let k = 0; k < (R < 3 ? 6 : 8); k++) { const a = k / (R < 3 ? 6 : 8) * PI * 2 + (R < 3 ? 0.3 : 0); const x = tx + Math.cos(a) * R, z = tz + Math.sin(a) * R; if (Math.abs(x) > 3.6 || Math.abs(z) > 3.6 || (x > 1.6 && z < -1.4)) continue; spots.push([x, z]); }
  for (const [x, z] of spots) {
    M.cyl('metal', x, 0, z, 0.06, 1.0, N.FRAME, 6);
    const yaw = Math.atan2(tx - x, tz - z);
    const m = new THREE.BoxGeometry(1.1, 0.04, 0.8); m.rotateX(0.62); m.rotateY(yaw); m.translate(x, 1.1, z);
    M.add('mirror', m, { color: 0xd0d8e2 });
  }
  tankV(M, 2.4, -2.6, 0.5, 1.6, { y0: 0.15, band: N.ORANGE });
  tankV(M, 3.3, -1.8, 0.45, 1.4, { y0: 0.15, band: BLUE });
}

// ---------------------------------------------------------------- terraforming
// greenhouse-gas plant (6x6): the sulphur hopper, two reaction columns, a
// stack releasing the gas, a pipe rack
export function ghgplant(M) {
  plinth(M, 6, 6);
  tankV(M, -1.8, -1.6, 0.7, 2.4, { y0: 0.3, band: AMBER, color: 0xe8d070 });
  M.add('metal', new THREE.CylinderGeometry(0.6, 0.18, 0.7, 12), { pos: v(-1.8, 0.0 + 0.35, -1.6), color: 0x9aa0a6 });
  processColumn(M, 0.2, -1.5, 0.38, 3.6, { y0: 0.3, yaw: PI });
  processColumn(M, 1.6, -0.4, 0.3, 3.0, { y0: 0.3, yaw: PI / 2 });
  M.cyl('metal', -1.6, 0, 1.6, 0.2, 6.0, N.FRAME, 12);
  M.cyl('metal', -1.6, 5.9, 1.6, 0.26, 0.15, N.DARK, 12);
  M.vent(-1.6, 6.2, 1.6, { rate: 1.4, size: 1.2 });
  M.colCyl(-1.6, 1.6, 0.25, 0, 6.0);
  pipeRack(M, -1.0, 0.5, 2.2, 0.5, 2.0, 3);
  avionics(M, 1.6, 0, 2.0, 0.8, 0.7, 0.6);
  pipe(M, [-1.8, 2.6, -1.6], [0.2, 2.2, -1.5], 2.9, 0.08, 0xc9a640);
}
// microbe vats (5x5): four bioreactor tanks of green culture behind
// windows, on a frame, with feed and harvest piping
export function microbevat(M) {
  plinth(M, 5, 5);
  deployFrame(M, -0.2, 0.0, 3.6, 3.6, 0.35);
  for (const [x, z] of [[-1.2, -1.0], [0.8, -1.0], [-1.2, 1.0], [0.8, 1.0]]) {
    M.cyl('plant', x, 0.4, z, 0.62, 2.0, 0x3d8a35, 18);
    M.add('window', new THREE.CylinderGeometry(0.7, 0.7, 2.1, 24, 1, true), { pos: v(x, 1.4, z) });
    M.cyl('shell', x, 2.45, z, 0.72, 0.25, N.SHELL, 24);
    M.cyl('metal', x, 0.3, z, 0.74, 0.12, N.FRAME, 24);
    for (const y of [1.0, 1.8]) M.add('metal', new THREE.TorusGeometry(0.71, 0.03, 4, 24), { pos: v(x, y, z), rot: e(PI / 2, 0, 0), color: N.FRAME });
    M.colCyl(x, z, 0.72, 0, 2.7);
  }
  pipeRack(M, -1.9, -2.1, 1.9, -2.1, 1.8, 2, [0x2f8f4a, 0xb8bec4]);
  avionics(M, 2.0, 0, 1.6, 0.6, 0.6, 0.5);
  tankV(M, 2.0, -0.4, 0.3, 1.2, { y0: 0.15, band: BLUE });
}
// fish farm (6x6): floats on a lake (y = 0 is the water line): two net pens
// on float rings, a walkway, the feeding barge with its feed silo
export function fishery(M) {
  for (const [x, z] of [[-1.3, 0.9], [1.4, 0.9]]) {
    M.add('shell', new THREE.TorusGeometry(1.25, 0.14, 8, 32), { pos: v(x, 0.05, z), rot: e(PI / 2, 0, 0), color: N.ORANGE });
    M.add('metal', new THREE.TorusGeometry(1.25, 0.03, 4, 32), { pos: v(x, 0.6, z), rot: e(PI / 2, 0, 0), color: N.FRAME });
    for (let k = 0; k < 8; k++) { const a = k / 8 * PI * 2; M.cyl('metal', x + Math.cos(a) * 1.25, 0.05, z + Math.sin(a) * 1.25, 0.025, 0.55, N.FRAME, 4); }
    M.add('window', new THREE.CylinderGeometry(1.2, 1.2, 1.6, 24, 1, true), { pos: v(x, -0.6, z) });
  }
  grating(M, 0.05, 0.3, -0.75, 4.6, 0.7);
  for (const x of [-1.9, 0.05, 2.0]) M.add('shell', new THREE.CylinderGeometry(0.22, 0.22, 0.8, 12), { pos: v(x, 0.02, -0.75), rot: e(PI / 2, 0, 0), color: N.SHELL });
  M.box('metal', 0.0, 0.25, -2.0, 3.2, 0.3, 1.5, N.STEEL);
  for (const sx of [-1, 1]) M.add('shell', new THREE.CylinderGeometry(0.3, 0.3, 3.0, 14), { pos: v(sx * 1.2, -0.05, -2.0), rot: e(0, 0, PI / 2), color: N.SHELL });
  M.box('shell', -0.7, 0.95, -2.0, 1.4, 1.1, 1.2, N.SHELL);
  M.box('glass', -0.7, 1.05, -2.61, 0.9, 0.4, 0.03);
  tankV(M, 0.9, -2.0, 0.4, 1.4, { y0: 0.4, band: AMBER });
  M.cyl('metal', -1.3, 1.5, -2.0, 0.03, 1.0, N.FRAME, 4);
  M.sphere('blink', -1.3, 2.55, -2.0, 0.05, L.orange, 6);
  M.col(-1.6, -0.6, -2.75, 1.6, 0.4, -1.25);
}
// wildlife reserve (12x12): a fenced range with grass, trees and a pond, the
// ranger station, an observation tower, a feeding shelter
export function faunareserve(M) {
  plinth(M, 12, 12, { collide: false });
  M.col(-6, -0.45, -6, 6, 0, 6);
  for (let i = 0; i <= 12; i++) for (const s of [-1, 1]) {
    const t = -5.8 + i * 11.6 / 12;
    M.cyl('metal', t, 0, s * 5.8, 0.04, 1.2, N.FRAME, 6);
    M.cyl('metal', s * 5.8, 0, t, 0.04, 1.2, N.FRAME, 6);
  }
  for (const y of [0.5, 1.1]) for (const s of [-1, 1]) { M.box('metal', 0, y, s * 5.8, 11.6, 0.02, 0.02, 0x8a9096); M.box('metal', s * 5.8, y, 0, 0.02, 0.02, 11.6, 0x8a9096); }
  M.cyl('plant', 0.5, 0.0, 0.8, 4.6, 0.04, 0x5d7f3a, 32);
  M.cyl('water', 2.4, 0.02, 2.4, 1.4, 0.03, 0x2a6a7a, 24);
  for (const [x, z, h, r, k] of [[-3.6, 2.8, 2.6, 1.0, 0], [-2.2, 4.0, 2.2, 0.9, 1], [3.8, -1.2, 2.8, 1.1, 0], [-4.2, -0.8, 2.4, 0.9, 1], [1.2, 4.2, 2.0, 0.8, 0]]) {
    M.cyl('plant', x, 0, z, 0.08, h - 0.2, 0x5a3b26, 6);
    M.sphere('plant', x, h, z, r, k ? 0x3d7f3a : 0x2f6b34, 10, 0.85);
    M.colCyl(x, z, 0.12, 0, h);
  }
  const rx = -3.6, rz = -3.6;
  deployFrame(M, rx, rz, 2.6, 2.6, 0.45);
  vessel(M, rx, rz, { r: 1.45, h: 2.4, y0: 0.45, loft: 0.8, hatches: [PI], ports: [{ a: PI * 0.6 }, { a: PI / 2 }], segs: 6 });
  lattice(M, 3.8, -4.0, 1.2, 5.0, { mast: false, stairs: true });
  M.box('shell', 3.8, 5.6, -4.0, 1.8, 1.2, 1.8, N.SHELL);
  M.box('glass', 3.8, 5.7, -4.91, 1.5, 0.6, 0.03);
  M.box('shell', 3.8, 6.25, -4.0, 2.0, 0.1, 2.0, N.SHELL2);
  M.col(2.9, 5.0, -4.9, 4.7, 6.3, -3.1);
  for (const x of [-0.6, 0.6]) M.cyl('metal', x, 0, -2.0, 0.04, 1.4, N.FRAME, 6);
  M.box('shell', 0, 1.45, -2.0, 1.6, 0.06, 0.9, N.SHELL2);
  M.box('metal', 0, 0.3, -2.0, 1.2, 0.25, 0.5, 0x8a6a4a);
  M.entry(rx);
}
// magnetosphere generator (10x10): a superconducting coil standing in its
// cryostat ring, cryogen spheres, the power conditioning module, radiators
export function magshield(M) {
  plinth(M, 10, 10);
  const cz = 0.8, R = 3.4, cy = R + 0.9;
  M.add('shell', new THREE.TorusGeometry(R, 0.45, 16, 64), { pos: v(0, cy, cz), color: N.SHELL });
  M.add('metal', new THREE.TorusGeometry(R, 0.48, 6, 64, PI * 2), { pos: v(0, cy, cz), scale: v(1, 1, 0.3), color: 0xb87333 });
  for (let k = 0; k < 16; k++) { const a = k / 16 * PI * 2; M.box('metal', Math.cos(a) * R, cy + Math.sin(a) * R, cz, 0.12, 0.12, 1.0, N.FRAME, 0); }
  for (const sx of [-1, 1]) {
    strut(M, [sx * 1.6, 0, cz - 0.9], [sx * 1.4, cy - R + 0.2, cz], 0.22, N.STEEL);
    strut(M, [sx * 1.6, 0, cz + 0.9], [sx * 1.4, cy - R + 0.2, cz], 0.22, N.STEEL);
    strut(M, [sx * 3.9, 0, cz], [sx * (R - 0.2), cy - 0.6, cz], 0.2, N.STEEL);
    M.cyl('metal', sx * 1.6, 0, cz - 0.9, 0.3, 0.1, N.DARK, 12); M.cyl('metal', sx * 1.6, 0, cz + 0.9, 0.3, 0.1, N.DARK, 12);
  }
  M.box('metal', 0, 0.45, cz, 3.4, 0.9, 1.6, N.STEEL);
  M.col(-1.7, 0, cz - 0.8, 1.7, 0.9, cz + 0.8);
  for (let k = 0; k < 12; k++) { const a = k / 12 * PI * 2; M.sphere('emissive', Math.cos(a) * R, cy + Math.sin(a) * R, cz - 0.47, 0.06, L.cyan, 6); }
  for (const [x, z] of [[-3.6, -3.4], [-2.2, -3.4]]) sphereTank(M, x, 1.0, z, 0.62, {});
  band(M, -3.6, -3.4, 0.63, 0.95, 0.1, 0x5b8ec7); band(M, -2.2, -3.4, 0.63, 0.95, 0.1, 0x5b8ec7);
  tubeModule(M, 2.4, 1.1, -3.4, 3.4, 0.85, 0, { ribs: 2, ports: 2 });
  for (const x of [-3.9, 3.9]) radiatorWing(M, x, 3.6, PI / 2, { w: 1.6, h: 1.6, y0: 0.4 });
  pipe(M, [-2.2, 1.6, -3.4], [-0.6, 0.9, cz - 0.8], 1.9, 0.07, 0x5b8ec7);
}
// comet redirection control (10x10): a big tracking dish for the
// tug's deep-space link, the control vessel, methane spheres
export function comet(M) {
  plinth(M, 10, 10);
  dishAntenna(M, -1.4, 1.0, { s: 1.15, speed: 0.04 });
  deployFrame(M, 2.9, -2.6, 2.8, 2.8, 0.5);
  vessel(M, 2.9, -2.6, { r: 1.5, h: 2.6, y0: 0.5, loft: 0, hatches: [PI], ports: [{ a: -PI / 2 }, { a: PI * 0.75 }], segs: 6 });
  cupola(M, 2.9, 3.35, -2.6, 0.55);
  for (const [x, z] of [[3.2, 1.4], [3.2, 3.3]]) sphereTank(M, x, 1.1, z, 0.75, {});
  band(M, 3.2, 1.4, 0.76, 1.05, 0.12, CH4); band(M, 3.2, 3.3, 0.76, 1.05, 0.12, CH4);
  radiatorWing(M, -4.6, -2.0, 0, { w: 1.6, h: 1.4, y0: 0.4 });
  floodMast(M, -4.2, 4.2, 6, PI * 0.75);
  porch(M, 2.9, -2.6 - 1.5, 0.5, { w: 1.2, d: 0.5, run: 0.9 });
  M.entry(2.9);
}

// ---------------------------------------------------------------- industry
// Sabatier reactor (5x4): the catalyst reactor on its skid, the electrolyser
// box, the water and methane tanks, a cooling radiator
export function sabatier(M) {
  plinth(M, 5, 4);
  M.box('metal', -0.3, 0.12, 0, 3.4, 0.24, 1.6, N.STEEL);
  tankH(M, -0.6, 0.85, -0.3, 2.4, 0.42, { band: N.ORANGE });
  M.box('shell', 0.95, 0.7, 0.5, 1.1, 0.9, 0.8, N.SHELL);
  M.box('emissive', 0.95, 0.9, 0.09, 0.3, 0.05, 0.02, L.green);
  tankV(M, 1.9, -1.1, 0.35, 1.4, { y0: 0.2, band: BLUE });
  tankV(M, 1.9, 0.9, 0.42, 1.6, { y0: 0.2, band: CH4 });
  pipe(M, [0.6, 0.85, -0.3], [1.9, 1.5, 0.9], 1.4, 0.06, CH4);
  pipe(M, [1.9, 1.6, -1.1], [0.95, 1.15, 0.5], 1.7, 0.05, 0xb8bec4);
  radiatorWing(M, -2.3, 1.7, 0, { w: 1.5, h: 1.2, y0: 0.3 });
  M.col(-2.0, 0, -0.8, 1.5, 1.3, 0.9);
}
// ore dressing plant (6x6): the crusher house under its feed hopper, a
// conveyor up from the crushed-ore pile, the vibrating screen, a floodlight
export function crusher(M) {
  plinth(M, 6, 6);
  M.box('shell', -1.0, 1.1, 0.6, 2.4, 2.2, 2.2, N.SHELL);
  M.box('shell', -1.0, 2.25, 0.6, 2.5, 0.1, 2.3, N.SHELL2);
  M.add('metal', new THREE.CylinderGeometry(1.0, 0.4, 1.0, 4, 1, true), { pos: v(-1.0, 2.8, 0.6), rot: e(0, PI / 4, 0), color: 0x9aa0a6 });
  M.box('metal', -1.0, 0.9, -0.52, 1.4, 1.4, 0.04, 0xc9ccd0);
  M.col(-2.2, 0, -0.5, 0.2, 2.3, 1.7);
  M.add('regolith', new THREE.ConeGeometry(1.2, 1.1, 14), { pos: v(1.6, 0.55, -1.8), color: 0x6f4a3a });
  M.add('regolith', new THREE.ConeGeometry(0.8, 0.7, 12), { pos: v(2.5, 0.35, -0.7), color: 0x5a5a5a });
  M.colCyl(1.6, -1.8, 1.0, 0, 1.0);
  strut(M, [0.4, 0.3, -1.4], [-0.3, 2.9, 0.2], 0.45, 0x3a3f45);
  strut(M, [0.4, 0.55, -1.4], [-0.3, 3.15, 0.2], 0.05, N.YELLOW);
  M.box('metal', 1.6, 1.0, 1.6, 1.8, 0.12, 1.2, N.STEEL);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) M.cyl('metal', 1.6 + sx * 0.8, 0, 1.6 + sz * 0.5, 0.05, 1.0, N.FRAME, 6);
  M.box('metal', 1.6, 1.12, 1.6, 1.7, 0.03, 1.1, 0x5a5f66);
  M.col(0.7, 0, 1.0, 2.5, 1.1, 2.2);
  floodMast(M, -2.6, -2.6, 5, PI * 0.25);
}
// chemical plant (8x8): reaction columns, a cracker vessel, three spheres
// of product, the pipe rack and a flare
export function chemplant(M) {
  plinth(M, 8, 8);
  processColumn(M, -2.4, -2.2, 0.45, 4.6, { y0: 0.3, yaw: PI });
  processColumn(M, -0.9, -2.4, 0.35, 3.6, { y0: 0.3, yaw: PI });
  tankH(M, 1.4, 0.9, -2.2, 3.0, 0.55, { band: AMBER });
  for (const [x, z] of [[-2.2, 1.6], [-0.4, 2.2], [1.4, 1.6]]) sphereTank(M, x, 1.15, z, 0.8, {});
  band(M, -2.2, 1.6, 0.81, 1.1, 0.12, 0xe8e0c8); band(M, -0.4, 2.2, 0.81, 1.1, 0.12, CH4); band(M, 1.4, 1.6, 0.81, 1.1, 0.12, 0xe8e0c8);
  pipeRack(M, -3.4, -0.2, 3.4, -0.2, 2.6, 3, [0xb8bec4, CH4, 0xe8e0c8]);
  M.cyl('metal', 3.3, 0, 3.0, 0.15, 6.5, N.FRAME, 10);
  M.cyl('metal', 3.3, 6.4, 3.0, 0.2, 0.12, N.DARK, 10);
  M.vent(3.3, 6.7, 3.0, { rate: 0.6, size: 0.8, kind: 'exhaust' });
  M.colCyl(3.3, 3.0, 0.2, 0, 6.5);
  avionics(M, 3.0, 0, -3.2, 0.8, 0.7, 0.6);
}
// spaceport (12x12): a methane rocket standing on the sintered pad, the
// service tower with its swing arm, methane spheres, a blast wall
export function spaceport(M) {
  plinth(M, 12, 12, { collide: false });
  M.col(-6, -0.45, -6, 6, 0, 6);
  landingPad(M, 0, 0.6, 4.4);
  const rx = 0, rz = 0.6, H = 10.5, R = 0.9;
  M.cyl('shell', rx, 1.2, rz, R, H, 0xf0eee8, 28);
  M.cyl('shell', rx, 1.2 + H * 0.42, rz, R + 0.01, 0.5, 0x1e2226, 28);
  M.cyl('shell', rx, 1.2 + H * 0.82, rz, R + 0.01, 0.15, 0x1e2226, 28);
  const prof = []; for (let i = 0; i <= 10; i++) { const t = i / 10; prof.push(new THREE.Vector2(Math.max(0.02, R * Math.sqrt(1 - t * t) ** 0.8), t * 2.6)); }
  M.add('shell', new THREE.LatheGeometry(prof, 28), { pos: v(rx, 1.2 + H, rz), color: 0xf0eee8 });
  M.add('metal', new THREE.CylinderGeometry(0.45, 0.75, 1.1, 20, 1, true), { pos: v(rx, 0.75, rz), color: 0x2a2d31 });
  for (let k = 0; k < 4; k++) {
    const a = k / 4 * PI * 2 + PI / 4;
    strut(M, [rx + Math.cos(a) * R * 0.9, 2.8, rz + Math.sin(a) * R * 0.9], [rx + Math.cos(a) * 2.2, 0.15, rz + Math.sin(a) * 2.2], 0.14, 0x3a3f45);
    M.cyl('metal', rx + Math.cos(a) * 2.2, 0.0, rz + Math.sin(a) * 2.2, 0.32, 0.15, N.DARK, 12);
    M.add('shell', new THREE.BoxGeometry(0.8, 1.2, 0.06), { pos: v(rx + Math.cos(a) * (R + 0.3), 2.0, rz + Math.sin(a) * (R + 0.3)), rot: e(0, -a, 0), color: 0x1e2226 });
  }
  M.colCyl(rx, rz, R, 0, 1.2 + H + 2.6);
  lattice(M, 3.6, 3.4, 1.4, 12.5, { mast: false, stairs: true });
  M.box('metal', 2.2, 10.5, 2.4, 2.6, 0.3, 0.3, N.ORANGE, -0.6);
  M.box('metal', 1.25, 10.2, 1.7, 0.5, 0.5, 0.5, N.DARK);
  for (const [x, z] of [[-4.3, 3.6], [-4.3, 1.6]]) sphereTank(M, x, 1.2, z, 0.85, {});
  band(M, -4.3, 3.6, 0.86, 1.15, 0.14, CH4); band(M, -4.3, 1.6, 0.86, 1.15, 0.14, CH4);
  M.box('concrete', -1.6, 1.2, -4.8, 6.0, 2.4, 0.5, 0x9a948c);
  M.col(-4.6, 0, -5.05, 1.4, 2.4, -4.55);
  deployFrame(M, 4.3, -3.6, 2.4, 2.4, 0.45);
  vessel(M, 4.3, -3.6, { r: 1.3, h: 2.4, y0: 0.45, loft: 0, hatches: [PI * 1.5], ports: [{ a: PI }, { a: PI * 0.75 }], segs: 6 });
  floodMast(M, -5.3, -5.3, 7, PI * 0.25);
}

// ---------------------------------------------------------------- colony
// hospital (12x10): a large vessel with two ward modules, a red cross panel,
// an ambulance pad, oxygen bottles
export function hospital(M) {
  plinth(M, 12, 10);
  const hx = -0.6, hz = 0.8;
  deployFrame(M, hx, hz, 5.2, 5.2, 0.6);
  const cap = vessel(M, hx, hz, { r: 2.7, h: 3.8, y0: 0.6, loft: 1.4, hatches: [PI], ports: [{ a: PI * 0.72 }, { a: PI * 1.28 }], segs: 12 });
  viewBand(M, hx, hz, 2.7, 2.35, 0.9, { from: PI * 0.6, to: PI * 1.4, n: 9 });
  for (const sx of [-1, 1]) tubeModule(M, hx + sx * 3.8, 1.5, hz, 2.4, 1.05, 0, { endHatch: sx > 0, startHatch: false, ribs: 2, ports: 2 });
  M.box('concrete', hx, 3.92, hz - 2.72, 1.0, 1.0, 0.04, 0xf4f4f0);
  M.box('concrete', hx, 3.92, hz - 2.75, 0.75, 0.22, 0.03, 0xc9302a);
  M.box('concrete', hx, 3.92, hz - 2.75, 0.22, 0.75, 0.03, 0xc9302a);
  landingPad(M, 4.0, -3.0, 1.9);
  bottleRack(M, -4.6, -2.6, 0, 3, GREEN);
  M.cyl('metal', hx, cap - 0.1, hz, 0.04, 2.0, N.FRAME, 6);
  beacon(M, hx, cap + 1.9, hz, L.red);
  porch(M, hx, hz - 2.7, 0.6, { w: 1.8, d: 0.9, run: 1.2 });
  M.entry(hx);
}
// library (8x8): a reading room vessel with a window band all round, a
// geodesic reading dome, the archive module
export function library(M) {
  plinth(M, 8, 8);
  const vx = -1.2, vz = 0.4;
  deployFrame(M, vx, vz, 4.4, 4.4, 0.55);
  const cap = vessel(M, vx, vz, { r: 2.3, h: 3.4, y0: 0.55, loft: 0, hatches: [PI], ports: [], segs: 10 });
  viewBand(M, vx, vz, 2.3, 1.5, 1.4, { from: PI * 0.3, to: PI * 1.7, n: 14 });
  cupola(M, vx, cap - 0.05, vz, 0.8);
  geodesicDome(M, 2.2, 1.8, 1.6, { skirt: 0.35, detail: 1 });
  for (let i = 0; i < 3; i++) M.box('interior', 1.6 + i * 0.6, 0.65, 1.9, 0.08, 1.2, 0.8, [0x7a4a2a, 0x2a4a7a, 0x4a6a3a][i]);
  tubeModule(M, 2.3, 1.1, -1.6, 2.4, 0.8, 0, { endHatch: false, ribs: 2, ports: 1 });
  porch(M, vx, vz - 2.3, 0.55, { w: 1.5, d: 0.8, run: 1.1 });
  M.entry(vx);
}
// shopping arcade (12x10): two halls under faceted roofs joined by a glazed
// entrance, shop signs, planters, a parking pad
export function mall(M) {
  plinth(M, 12, 10);
  for (const x of [-3.2, 3.2]) hangar(M, x, 1.2, 4.4, 6.6, 3.6, 0, { stripe: x < 0 ? 0xc94a8a : BLUE, door: false });
  M.box('glass', 0, 1.5, -1.0, 2.0, 2.4, 0.05);
  M.box('shell', 0, 1.5, 1.2, 2.0, 3.0, 4.4, N.SHELL2);
  M.box('shell', 0, 3.1, -0.4, 2.4, 0.2, 2.0, N.SHELL);
  for (const x of [-5.0, -1.4, 1.4, 5.0]) M.box('emissive', x, 2.3, -2.15, 1.1, 0.22, 0.04, [L.warm, L.cyan, L.green, L.warm][Math.round((x + 5) / 3.4) % 4]);
  for (const x of [-4.4, -2.0, 2.0, 4.4]) M.box('glass', x, 1.2, -2.13, 1.4, 1.6, 0.04);
  for (const x of [-1.5, 1.5]) { M.box('metal', x, 0.25, -3.2, 1.2, 0.5, 0.5, N.STEEL); M.sphere('plant', x, 0.7, -3.2, 0.35, 0x3d7f3a, 8, 0.8); }
  M.col(-1.0, 0, -1.0, 1.0, 3.2, 3.4);
  M.entry(0);
}
// colony bank (8x8): a vessel with a heavy frame, the round vault door, a
// gold band, a beacon
export function bank(M) {
  plinth(M, 8, 8);
  const vx = -0.4, vz = 0.6;
  deployFrame(M, vx, vz, 4.6, 4.6, 0.55);
  const cap = vessel(M, vx, vz, { r: 2.5, h: 3.6, y0: 0.55, loft: 0, hatches: [PI], ports: [{ a: PI * 0.7 }, { a: PI * 1.3 }], segs: 10 });
  band(M, vx, vz, 2.5, 3.9, 0.25, 0xc9a640);
  M.box('shell', 2.6, 1.2, 0.6, 1.4, 2.4, 2.4, N.SHELL2);
  M.add('metal', new THREE.CylinderGeometry(0.75, 0.75, 0.2, 28), { pos: v(3.32, 1.25, 0.6), rot: e(0, 0, PI / 2), color: 0x9aa0a6 });
  M.add('metal', new THREE.TorusGeometry(0.75, 0.08, 6, 28), { pos: v(3.42, 1.25, 0.6), rot: e(0, PI / 2, 0), color: 0xc9a640 });
  for (let k = 0; k < 6; k++) { const a = k / 6 * PI * 2; M.add('metal', new THREE.BoxGeometry(0.06, 0.5, 0.06), { pos: v(3.45, 1.25 + Math.sin(a) * 0.25, 0.6 + Math.cos(a) * 0.25), rot: e(a, 0, 0), color: N.DARK }); }
  M.col(1.9, 0, -0.6, 3.3, 2.4, 1.8);
  beacon(M, vx, cap + 0.05, vz, L.warm);
  porch(M, vx, vz - 2.5, 0.55, { w: 1.5, d: 0.8, run: 1.1 });
  M.entry(vx);
}
// spa (8x8): a geodesic dome over a warm pool, steam lifting off it, the
// changing room module with its vestibule
export function spa(M) {
  plinth(M, 8, 8);
  const dx = 0.6, dz = 0.8;
  M.cyl('shell', dx, 0, dz, 2.6, 0.5, N.SHELL2, 32);
  M.cyl('water', dx, 0.42, dz, 2.3, 0.06, 0x3a8a9a, 32);
  for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2; M.box('metal', dx + Math.cos(a) * 2.45, 0.55, dz + Math.sin(a) * 2.45, 0.6, 0.1, 0.3, N.FRAME, -a); }
  geodesicDome(M, dx, dz, 3.0, { y0: 0, skirt: 0.5, detail: 2 });
  M.vent(dx - 0.8, 0.8, dz, { rate: 0.6, size: 0.9 });
  M.vent(dx + 0.9, 0.8, dz + 0.6, { rate: 0.5, size: 0.8 });
  tubeModule(M, -2.4, 1.2, -2.4, 2.4, 0.85, 0, { endHatch: false, startHatch: false, ribs: 2, ports: 1 });
  M.box('shell', dx, 1.0, dz - 3.25, 1.4, 2.0, 0.8, N.SHELL);
  hatch(M, dx, 0.02, dz - 3.65, PI, { w: 0.9, h: 1.75, depth: 0.12 });
  tankV(M, -3.0, 2.6, 0.35, 1.4, { y0: 0.2, band: BLUE });
  M.entry(dx);
}
// stadium (16x16): a bowl of stepped stands round a green field, a ring of
// membrane canopy on struts, floodlight masts at the corners
export function stadium(M) {
  plinth(M, 16, 16, { collide: false });
  M.col(-8, -0.45, -8, 8, 0, 8);
  const prof = [];
  const steps = 7, r0 = 4.4;
  prof.push(new THREE.Vector2(r0 - 0.2, 0));
  for (let i = 0; i < steps; i++) { const r = r0 + i * 0.42, y = 0.35 + i * 0.42; prof.push(new THREE.Vector2(r, y)); prof.push(new THREE.Vector2(r + 0.42, y)); }
  prof.push(new THREE.Vector2(r0 + steps * 0.42 + 0.2, 0.35 + steps * 0.42));
  prof.push(new THREE.Vector2(r0 + steps * 0.42 + 0.25, 0));
  // listed from the outer foot inward so treads face up and risers face the field
  const bowl = new THREE.LatheGeometry(prof.reverse(), 56); bowl.scale(1, 1, 0.82);
  M.add('shell', bowl, { color: 0xe4e2dc });
  const field = new THREE.CylinderGeometry(r0 - 0.2, r0 - 0.2, 0.06, 48); field.scale(1, 1, 0.82);
  M.add('plant', field, { pos: v(0, 0.03, 0), color: 0x4f8a3a });
  M.box('concrete', 0, 0.065, 0, 0.08, 0.01, (r0 - 0.4) * 1.64, 0xf4f4f0);
  M.add('concrete', new THREE.RingGeometry(0.8, 0.88, 32), { pos: v(0, 0.066, 0), rot: e(-PI / 2, 0, 0), color: 0xf4f4f0 });
  const Rr = r0 + steps * 0.42;
  for (let k = 0; k < 20; k++) {
    const a = k / 20 * PI * 2, x = Math.cos(a) * Rr, z = Math.sin(a) * Rr * 0.82;
    M.cyl('metal', x, 0, z, 0.1, 5.2, N.FRAME, 8);
    M.colCyl(x, z, 0.12, 0, 5.2);
  }
  const roof = new THREE.CylinderGeometry(Rr + 0.4, Rr - 1.6, 0.6, 56, 1, true); roof.scale(1, 1, 0.82);
  M.add('shell', roof, { pos: v(0, 5.3, 0), color: N.SHELL });
  const ring = new THREE.TorusGeometry(Rr + 0.4, 0.08, 6, 56); ring.rotateX(PI / 2); ring.scale(1, 1, 0.82);
  M.add('metal', ring, { pos: v(0, 5.6, 0), color: N.FRAME });
  for (const [x, z] of [[-7.2, -7.2], [7.2, -7.2], [-7.2, 7.2], [7.2, 7.2]]) floodMast(M, x, z, 9, Math.atan2(-x, -z));
  for (const s of [-1, 1]) { const gz = s * (Rr * 0.82 + 0.2); M.box('shell', 0, 1.3, gz, 2.6, 2.6, 0.6, N.SHELL2); M.box('emissive', 0, 2.3, gz - s * 0.31, 1.6, 0.25, 0.02, L.warm); }
  for (let k = 0; k < 28; k++) { const a = k / 28 * PI * 2; M.colCyl(Math.cos(a) * 5.9, Math.sin(a) * 5.9 * 0.82, 0.95, 0, 2.6); }
  M.entry(0);
}
// tourist hotel (10x8): a tall vessel with window bands on every floor, the
// lobby module, a roof cupola and a sign
export function hotel(M) {
  plinth(M, 10, 8);
  const vx = 1.6, vz = 0.8;
  deployFrame(M, vx, vz, 4.8, 4.8, 0.6);
  const cap = vessel(M, vx, vz, { r: 2.5, h: 8.6, y0: 0.6, loft: 0, hatches: [], ports: [], segs: 12 });
  for (const y of [1.3, 3.8, 6.3]) viewBand(M, vx, vz, 2.5, y, 1.2, { from: PI * 0.35, to: PI * 1.65, n: 12 });
  for (const y of [3.2, 5.7]) M.add('metal', new THREE.TorusGeometry(2.53, 0.06, 6, 48), { pos: v(vx, y, vz), rot: e(PI / 2, 0, 0), color: N.FRAME });
  cupola(M, vx, cap - 0.05, vz, 1.0);
  tubeModule(M, -2.6, 1.3, 0.2, 3.6, 1.1, 0, { endHatch: false, startHatch: false, ribs: 3, ports: 3 });
  M.box('shell', -2.6, 1.3, -1.25, 1.6, 2.2, 1.0, N.SHELL2);
  M.box('glass', -2.6, 1.25, -1.76, 1.2, 1.7, 0.03);
  M.box('emissive', -2.6, 2.55, -1.76, 1.3, 0.2, 0.02, L.warm);
  M.col(-3.4, 0, -1.75, -1.8, 2.4, -0.75);
  porch(M, -2.6, -1.75, 0.3, { w: 1.6, d: 0.6, run: 0.8 });
  M.entry(-2.6);
}
