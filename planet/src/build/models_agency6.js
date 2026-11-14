// Third wave of the colony's hardware in the agency kit: regional
// harvesters that only pay off in their own country, automation (robots,
// printing yards, maintenance drones), heavy power (fusion, orbital
// rectenna, hydro), weather work and the town's evening places.
import * as THREE from 'three';
import { L, v, e, plinth, railing } from './modelkit.js';
import { strut } from './starkit.js';
import {
  N, hatch, vessel, tubeModule, radiatorWing, deployFrame, grating, avionics, cupola,
  tankV, sphereTank, hangar, cargoBags, geodesicDome, viewBand, derrick,
} from './nasakit.js';
import { porch, pipe, band, beacon } from './models_agency.js';

const PI = Math.PI;
const GREEN = 0x2f8f4a, BLUE = 0x2a5db0, CH4 = 0x3f8fd8, MAGENTA = 0xff5ad2;

function gStrut(g, a, b, t, color) {
  const A = v(...a), B = v(...b), d = B.clone().sub(A), len = d.length();
  const q = new THREE.Quaternion().setFromUnitVectors(v(0, 1, 0), d.normalize());
  g.add(new THREE.BoxGeometry(t, len, t), { pos: A.clone().add(B).multiplyScalar(0.5), rot: new THREE.Euler().setFromQuaternion(q), color });
}
function tub(M, x, z, h = 2.0, r = 0.8, k = 0, y0 = 0) {
  M.cyl('metal', x, y0, z, 0.4, 0.45, N.STEEL, 12);
  M.cyl('plant', x, y0 + 0.45, z, 0.06, h - 0.3, 0x5a3b26, 6);
  M.sphere('plant', x, y0 + 0.45 + h, z, r, [0x3d7f3a, 0x2f6b34, 0x4f8a3a][k % 3], 10, 0.85);
}
// slim braced mast tapering from w0 to w1
function mast(M, x, z, h, w0 = 0.5, w1 = 0.22, color = N.FRAME) {
  const at = (sx, sz, y) => { const w = w0 + (w1 - w0) * y / h; return [x + sx * w, y, z + sz * w]; };
  const C4 = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (const [sx, sz] of C4) strut(M, at(sx, sz, 0), at(sx, sz, h), 0.08, color);
  for (let y = 0; y < h - 0.4; y += 1.2) for (let k = 0; k < 4; k++) {
    const [ax, az] = C4[k], [bx, bz] = C4[(k + 1) % 4];
    strut(M, at(ax, az, y), at(bx, bz, Math.min(h, y + 1.2)), 0.035, color);
    strut(M, at(ax, az, Math.min(h, y + 1.2)), at(bx, bz, Math.min(h, y + 1.2)), 0.045, color);
  }
  M.colCyl(x, z, w0, 0, h);
}
// a small quad drone sitting at (x, y, z)
function drone(M, x, y, z, body = N.SHELL, light = L.cyan) {
  M.box('shell', x, y + 0.08, z, 0.36, 0.12, 0.36, body);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    M.box('metal', x + sx * 0.2, y + 0.1, z + sz * 0.2, 0.3, 0.03, 0.03, N.DARK, PI / 4 * sx * sz);
    M.cyl('metal', x + sx * 0.32, y + 0.12, z + sz * 0.32, 0.15, 0.01, 0x22262b, 12);
  }
  M.sphere('blink', x, y + 0.16, z + 0.18, 0.03, light, 6);
}
// a work robot standing at (x, z) facing -z
function robot(M, x, z, color = 0xffb347) {
  for (const s of [-1, 1]) M.box('metal', x + s * 0.12, 0.35, z, 0.12, 0.7, 0.14, N.DARK);
  M.box('shell', x, 0.95, z, 0.46, 0.55, 0.3, color);
  M.box('metal', x, 0.95, z - 0.16, 0.24, 0.16, 0.02, N.DARK);
  for (const s of [-1, 1]) M.box('shell', x + s * 0.3, 0.9, z, 0.1, 0.5, 0.12, 0xd9d6ce);
  M.box('shell', x, 1.38, z, 0.3, 0.24, 0.26, 0xeeece6);
  M.box('emissive', x, 1.39, z - 0.135, 0.2, 0.05, 0.01, L.cyan);
}

// ---------------------------------------------------------------- base
// rover garage (6x6): a hangar with its roll-up door, spare wheels, the
// charging post and a parts rack
export function garage(M) {
  plinth(M, 6, 6);
  hangar(M, -0.3, 0.6, 4.2, 4.6, 3.2, 0, { stripe: N.ORANGE });
  M.box('metal', -0.3, 0.02, -2.4, 3.0, 0.04, 1.2, 0x5b6168);
  for (let i = 0; i < 3; i++) M.add('metal', new THREE.TorusGeometry(0.42, 0.16, 8, 20), { pos: v(2.45, 0.18 + i * 0.32, -1.6), rot: e(PI / 2, 0, 0), color: 0x2a2d31 });
  M.colCyl(2.45, -1.6, 0.6, 0, 1.0);
  M.cyl('metal', -2.6, 0, -2.3, 0.1, 1.4, N.FRAME, 8);
  M.box('shell', -2.6, 1.3, -2.3, 0.35, 0.5, 0.25, N.SHELL);
  M.box('emissive', -2.6, 1.35, -2.44, 0.15, 0.1, 0.01, L.green);
  for (let i = 0; i < 2; i++) M.box('metal', 2.45, 0.7 + i * 0.7, 1.6, 0.9, 0.05, 1.4, N.STEEL);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) M.cyl('metal', 2.45 + sx * 0.4, 0, 1.6 + sz * 0.65, 0.03, 1.5, N.FRAME, 6);
  cargoBags(M, 2.45, 1.4, 2, 0);
  avionics(M, -1.0, 2.6, 1.8, 0.8, 0.4, 0.6);
}

// ---------------------------------------------------------------- power
// small hydro (6x6): floats on a lake (y = 0 is the water line): a barge on
// two pontoons, the turbine house, intakes dipping into the water, the
// transformer and the line out
export function hydro(M) {
  for (const sx of [-1, 1]) {
    M.add('shell', new THREE.CylinderGeometry(0.42, 0.42, 5.2, 18), { pos: v(sx * 2.2, -0.05, 0), rot: e(PI / 2, 0, 0), color: N.SHELL });
    M.add('shell', new THREE.CylinderGeometry(0.425, 0.425, 0.4, 18, 1, true), { pos: v(sx * 2.2, -0.05, 0), rot: e(PI / 2, 0, 0), color: N.ORANGE });
  }
  M.box('metal', 0, 0.42, 0, 5.2, 0.16, 5.2, N.STEEL);
  grating(M, 0, 0.5, -1.6, 5.0, 1.6);
  M.box('shell', 0, 1.6, 0.9, 3.0, 2.2, 2.4, N.SHELL);
  M.box('shell', 0, 2.75, 0.9, 3.1, 0.1, 2.5, N.SHELL2);
  M.box('metal', 0, 1.3, -0.32, 1.4, 1.4, 0.04, 0xc9ccd0);
  for (const x of [-1.4, 1.4]) M.tube('metal', [[x, 0.9, -0.3], [x, 0.6, -1.8], [x, -0.6, -2.4], [x, -1.4, -2.5]], 0.28, 0x8a9096, 6);
  M.vent(0, 0.05, 2.7, { rate: 0.6, size: 0.8 });
  avionics(M, -1.6, 0.5, 2.2, 0.8, 0.7, 0.6);
  M.cyl('metal', 1.9, 0.5, 2.0, 0.07, 3.4, N.FRAME, 8);
  M.box('metal', 1.9, 3.85, 2.0, 1.2, 0.08, 0.08, N.FRAME);
  for (const s of [-0.5, 0.5]) for (let k = 0; k < 3; k++) M.cyl('shell', 1.9 + s, 3.5 - k * 0.12, 2.0, 0.09, 0.06, 0x9a6e44, 10);
  M.col(-2.6, -0.6, -2.6, 2.6, 0.5, 2.6);
  M.col(-1.5, 0.5, -0.3, 1.5, 2.8, 2.1);
}
// fusion plant (10x10): the reactor hall under a cryostat dome ringed with
// coil ribs and a glowing viewport band, two cooling towers, the
// transformer yard and the heavy-water extraction tank
export function fusion(M) {
  plinth(M, 10, 10);
  const cx = -0.8, cz = 0.6;
  deployFrame(M, cx, cz, 6.0, 6.0, 0.5);
  const cap = vessel(M, cx, cz, { r: 3.2, h: 3.6, y0: 0.5, loft: 0, hatches: [PI], ports: [], segs: 12 });
  M.add('shell', new THREE.SphereGeometry(3.1, 36, 12, 0, PI * 2, 0, PI / 2), { pos: v(cx, cap - 0.3, cz), scale: v(1, 0.55, 1), color: N.SHELL2 });
  for (let k = 0; k < 12; k++) { const a = k / 12 * PI * 2; M.box('metal', cx + Math.sin(a) * 3.28, 2.3, cz + Math.cos(a) * 3.28, 0.3, 3.4, 0.22, N.STEEL, a); }
  M.add('emissive', new THREE.CylinderGeometry(3.23, 3.23, 0.22, 48, 1, true), { pos: v(cx, 2.6, cz), color: L.cyan });
  for (const [x, z] of [[3.4, -2.8], [3.4, 2.6]]) {
    const prof = []; for (let i = 0; i <= 10; i++) { const t = i / 10; prof.push(new THREE.Vector2(0.95 - Math.sin(t * PI) * 0.3 + t * 0.05, t * 3.4)); }
    M.add('concrete', new THREE.LatheGeometry(prof, 24), { pos: v(x, 0, z), color: 0xbab5ad });
    M.colCyl(x, z, 0.95, 0, 3.4);
    M.vent(x, 3.6, z, { rate: 1.4, size: 1.2 });
  }
  for (let i = 0; i < 3; i++) { avionics(M, -4.2, 0, -3.6 + i * 1.3, 0.8, 1.0, 0.9); for (let k = 0; k < 3; k++) M.cyl('shell', -4.2, 1.05 + k * 0.12, -3.6 + i * 1.3, 0.08, 0.06, 0x9a6e44, 10); }
  tankV(M, 1.6, -3.8, 0.55, 2.0, { y0: 0.25, band: BLUE });
  pipe(M, [1.6, 1.8, -3.25], [cx + 1.2, 1.4, cz - 2.9], 2.2, 0.08, 0xb8bec4);
  porch(M, cx, cz - 3.2, 0.5, { w: 1.6, d: 0.6, run: 0.9 });
  M.light(cx, 3.0, cz - 3.5, L.cyan, 2, 8);
}
// orbital rectenna (12x12): rows of receiving mesh panels on posts, the
// pointing horn on its mast, the converter shelter
export function rectenna(M) {
  plinth(M, 12, 12, { collide: false });
  M.col(-6, -0.45, -6, 6, 0, 6);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
    if (r === 3 && c === 3) continue;
    const x = -4.1 + c * 2.7, z = -4.2 + r * 2.6;
    for (const sx of [-1, 1]) M.cyl('metal', x + sx * 0.9, 0, z + 0.2, 0.05, 1.0, N.FRAME, 6);
    M.add('metal', new THREE.BoxGeometry(2.4, 0.05, 1.6), { pos: v(x, 1.2, z), rot: e(-0.5, 0, 0), color: 0x30353b });
    for (let k = 0; k < 5; k++) M.add('metal', new THREE.BoxGeometry(0.02, 0.06, 1.6), { pos: v(x - 1.0 + k * 0.5, 1.22, z), rot: e(-0.5, 0, 0), color: 0x9aa0a6 });
    for (let k = 0; k < 3; k++) M.add('metal', new THREE.BoxGeometry(2.4, 0.06, 0.02), { pos: v(x, 1.22 + Math.sin(0.5) * (-0.6 + k * 0.6), z + Math.cos(0.5) * (-0.6 + k * 0.6)), rot: e(-0.5, 0, 0), color: 0x9aa0a6 });
    M.col(x - 1.2, 0, z - 0.7, x + 1.2, 1.6, z + 0.7);
  }
  const hx = 4.0, hz = 3.6;
  M.box('shell', hx, 0.9, hz, 1.8, 1.8, 1.6, N.SHELL);
  M.box('shell', hx, 1.84, hz, 1.9, 0.08, 1.7, N.SHELL2);
  M.cyl('metal', hx, 1.88, hz, 0.06, 1.6, N.FRAME, 8);
  M.add('shell', new THREE.ConeGeometry(0.45, 0.8, 4, 1, true), { pos: v(hx, 3.6, hz), rot: e(PI + 0.4, PI / 4, 0), color: N.SHELL });
  M.col(hx - 0.9, 0, hz - 0.8, hx + 0.9, 1.9, hz + 0.8);
  beacon(M, hx, 3.95, hz, L.red);
}
// high-voltage substation (4x4): the transformer with its cooling fins and
// bushings, a gantry with insulator strings, a fence
export function substation(M) {
  plinth(M, 4, 4);
  M.box('shell', -0.4, 0.9, 0.2, 1.4, 1.6, 1.0, 0x8a9096);
  for (let i = 0; i < 6; i++) M.box('metal', -1.25, 0.85, -0.25 + i * 0.18, 0.28, 1.3, 0.04, 0x6b7178);
  for (let i = 0; i < 3; i++) {
    const x = -0.85 + i * 0.45;
    M.cyl('shell', x, 1.7, 0.2, 0.08, 0.7, 0x9a6e44, 10);
    for (let k = 0; k < 4; k++) M.cyl('shell', x, 1.78 + k * 0.15, 0.2, 0.15, 0.04, 0x7a4e2c, 12);
  }
  for (const sx of [-1, 1]) M.cyl('metal', 0.6 + sx * 0.7, 0, -1.2, 0.07, 3.2, N.FRAME, 8);
  M.box('metal', 0.6, 3.2, -1.2, 1.7, 0.1, 0.1, N.FRAME);
  for (const sx of [-1, 0, 1]) { M.cyl('metal', 0.6 + sx * 0.5, 2.6, -1.2, 0.015, 0.6, N.DARK, 4); for (let k = 0; k < 3; k++) M.cyl('shell', 0.6 + sx * 0.5, 2.65 + k * 0.17, -1.2, 0.09, 0.05, 0x7a4e2c, 10); }
  for (const [x0, z0, x1, z1] of [[-1.9, -1.9, 1.9, -1.9], [1.9, -1.9, 1.9, 1.9], [-1.9, 1.9, 1.9, 1.9], [-1.9, -1.9, -1.9, 1.9]]) railing(M, x0, z0, x1, z1, 0, 1.6, 0x8a9096);
  M.col(-1.1, 0, -0.3, 0.3, 1.7, 0.7);
  M.box('metal', -0.4, 1.0, 1.95, 0.3, 0.3, 0.02, N.YELLOW);
}

// ---------------------------------------------------------------- terraforming
// polar melter (6x6): a dust cannon on a turret, the dark-dust silo, a
// reflector panel aimed at the ice, the control box
export function polarmelter(M) {
  plinth(M, 6, 6);
  M.cyl('metal', 0.6, 0, 0.4, 1.0, 0.6, N.STEEL, 20);
  M.cyl('shell', 0.6, 0.6, 0.4, 0.8, 0.9, N.SHELL, 20);
  const barrel = new THREE.CylinderGeometry(0.22, 0.28, 3.6, 14); barrel.translate(0, 1.8, 0); barrel.rotateX(-0.75);
  M.add('metal', barrel, { pos: v(0.6, 1.4, 0.4), color: 0x4a4f55 });
  M.add('metal', new THREE.TorusGeometry(0.3, 0.06, 6, 14), { pos: v(0.6, 1.4 + Math.cos(0.75) * 3.5, 0.4 - Math.sin(0.75) * 3.5), rot: e(PI / 2 - 0.75, 0, 0), color: N.ORANGE });
  M.colCyl(0.6, 0.4, 1.0, 0, 1.5);
  tankV(M, -1.8, 1.4, 0.65, 2.6, { y0: 0.3, band: 0x2a2d31, color: 0x5a5550 });
  pipe(M, [-1.8, 1.2, 0.75], [0.0, 1.0, 0.4], 1.2, 0.09, 0x3a3f45);
  M.cyl('metal', -1.6, 0, -1.8, 0.07, 2.2, N.FRAME, 8);
  M.add('mirror', new THREE.BoxGeometry(1.8, 0.05, 1.3), { pos: v(-1.6, 2.4, -1.8), rot: e(-0.9, 0.3, 0), color: 0xd0d8e2 });
  avionics(M, 2.2, 0, -2.0, 0.7, 0.6, 0.5);
}
// cloud seeding station (5x5): a rocket rack angled at the sky, the
// balloon shed with its helium bottle, a weather radome
export function cloudseeder(M) {
  plinth(M, 5, 5);
  M.box('metal', 0.5, 0.4, -0.4, 1.8, 0.8, 1.4, N.STEEL);
  for (let i = 0; i < 6; i++) {
    const x = -0.2 + (i % 3) * 0.7, z = -0.6 + Math.floor(i / 3) * 0.55;
    const tube = new THREE.CylinderGeometry(0.11, 0.11, 1.6, 10); tube.rotateX(-0.55);
    M.add('shell', tube, { pos: v(x, 1.45, z), color: N.SHELL });
    M.add('shell', new THREE.ConeGeometry(0.1, 0.25, 10).rotateX(-0.55), { pos: v(x, 2.15, z - 0.45), color: N.ORANGE });
  }
  M.col(-0.4, 0, -1.1, 1.4, 2.2, 0.3);
  M.box('shell', -1.3, 0.8, 1.3, 1.6, 1.6, 1.4, N.SHELL);
  M.box('metal', -1.3, 0.75, 0.59, 1.1, 1.3, 0.03, 0xc9ccd0);
  M.col(-2.1, 0, 0.6, -0.5, 1.6, 2.0);
  M.cyl('shell', 0.3, 0, 1.6, 0.22, 1.2, 0xe8e8e4, 14);
  M.cyl('shell', 0.3, 0.95, 1.6, 0.225, 0.12, BLUE, 14);
  M.cyl('metal', 1.6, 0, 1.5, 0.2, 1.4, N.FRAME, 10);
  M.sphere('shell', 1.6, 1.85, 1.5, 0.5, 0xf2f1ec, 18);
  M.colCyl(1.6, 1.5, 0.5, 0, 2.3);
}
// dune fixing station (5x5): mats of planted grass in sand fences, the seed
// hopper and a sprinkler boom that turns
export function dunefixer(M) {
  plinth(M, 5, 5);
  for (let r = 0; r < 3; r++) {
    const z = -1.7 + r * 1.0;
    M.box('plant', 0.3, 0.06, z, 3.4, 0.12, 0.6, [0x5d7f3a, 0x6a8a3e, 0x557a36][r]);
    for (let k = 0; k < 6; k++) M.sphere('plant', -1.2 + k * 0.6, 0.2, z, 0.18, 0x4f8a3a, 6, 0.6);
    for (const x of [-1.5, 2.1]) M.cyl('metal', x, 0, z + 0.4, 0.025, 0.6, N.FRAME, 4);
    M.box('metal', 0.3, 0.45, z + 0.4, 3.6, 0.3, 0.02, 0x8a9096);
  }
  tankV(M, -1.6, 1.6, 0.45, 1.4, { y0: 0.3, band: GREEN });
  M.cyl('metal', 1.4, 0, 1.4, 0.06, 2.4, N.FRAME, 8);
  const spin = M.animGroup('shell', { pivot: [1.4, 0, 1.4], axis: [0, 1, 0], speed: 0.8 });
  spin.add(new THREE.BoxGeometry(2.4, 0.06, 0.08), { pos: v(1.4, 2.35, 1.4), color: N.SHELL });
  for (const s of [-1, 1]) spin.add(new THREE.CylinderGeometry(0.04, 0.06, 0.12, 8), { pos: v(1.4 + s * 1.15, 2.26, 1.4), color: GREEN });
  M.colCyl(1.4, 1.4, 0.1, 0, 2.4);
}
// soil works (6x6): a turning mixing drum on rollers, the feed hopper, piles
// of dark finished soil, a conveyor
export function soilfactory(M) {
  plinth(M, 6, 6);
  const dz = 0.4;
  for (const x of [-1.4, 1.4]) { M.box('metal', x, 0.35, dz, 0.4, 0.7, 1.6, N.STEEL); M.cyl('metal', x, 0.7, dz, 0.18, 0.1, N.DARK, 10); }
  const drum = M.animGroup('shell', { pivot: [0, 1.3, dz], axis: [1, 0, 0], speed: 0.6 });
  drum.add(new THREE.CylinderGeometry(0.9, 0.9, 3.4, 24).rotateZ(PI / 2), { pos: v(0, 1.3, dz), color: 0xd8d4ca });
  for (const x of [-1.2, 0, 1.2]) drum.add(new THREE.TorusGeometry(0.92, 0.06, 6, 24).rotateY(PI / 2), { pos: v(x, 1.3, dz), color: N.ORANGE });
  drum.add(new THREE.BoxGeometry(3.3, 0.08, 0.1), { pos: v(0, 2.2, dz), color: N.FRAME });
  M.col(-1.7, 0, dz - 0.9, 1.7, 2.2, dz + 0.9);
  M.add('metal', new THREE.CylinderGeometry(0.75, 0.25, 0.9, 4, 1, true), { pos: v(-2.1, 2.3, dz), rot: e(0, PI / 4, 0), color: 0x9aa0a6 });
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) M.cyl('metal', -2.1 + sx * 0.45, 0, dz + sz * 0.45, 0.04, 1.9, N.STEEL, 6);
  for (const [x, z, r, h] of [[1.6, -2.0, 1.0, 0.9], [0.0, -2.2, 0.8, 0.7]]) { M.add('regolith', new THREE.ConeGeometry(r, h, 14), { pos: v(x, h / 2, z), color: 0x3b2a1e }); M.colCyl(x, z, r * 0.8, 0, h); }
  strut(M, [1.75, 0.6, dz], [2.6, 0.2, -1.4], 0.35, 0x3a3f45);
  avionics(M, 2.3, 0, 2.1, 0.6, 0.6, 0.5);
}
// apiary (5x5): two rows of hives on stands, a bed of flowers, the
// beekeepers' workshop
export function apiary(M) {
  plinth(M, 5, 5);
  for (let i = 0; i < 8; i++) {
    const x = -1.6 + (i % 4) * 0.8, z = -1.4 + Math.floor(i / 4) * 1.2;
    M.box('metal', x, 0.25, z, 0.55, 0.5, 0.45, N.STEEL);
    for (let k = 0; k < 2; k++) M.box('shell', x, 0.62 + k * 0.26, z, 0.52, 0.24, 0.42, k ? 0xf4f2ec : 0xe6dfc8);
    M.box('shell', x, 1.06, z, 0.58, 0.06, 0.48, [N.YELLOW, BLUE, 0xc94a8a, GREEN][i % 4]);
    M.box('metal', x, 0.58, z - 0.22, 0.2, 0.03, 0.02, N.DARK);
  }
  M.col(-2.0, 0, -1.7, 1.0, 1.1, 0.1);
  M.cyl('plant', -0.4, 0.02, 1.4, 1.1, 0.05, 0x587a35, 20);
  for (let i = 0; i < 10; i++) { const a = i * 2.3, r = 0.3 + (i % 3) * 0.3; M.sphere('plant', -0.4 + Math.cos(a) * r, 0.2, 1.4 + Math.sin(a) * r, 0.17, [0xd9a62a, 0xc94a8a, 0xe8e3d8, 0x7a4fb8][i % 4], 6, 0.7); }
  M.box('shell', 1.7, 0.8, 1.2, 1.4, 1.6, 1.6, N.SHELL);
  M.box('metal', 1.7, 0.75, 0.39, 0.8, 1.3, 0.03, 0xc9ccd0);
  M.col(1.0, 0, 0.4, 2.4, 1.6, 2.0);
}

// ---------------------------------------------------------------- industry
// logistics relay (3x3): a slim mast with a drone pad on top, a whip and a
// beacon, the electronics box at its foot
export function relay(M) {
  plinth(M, 3, 3);
  mast(M, 0.3, 0.3, 5.6, 0.5, 0.3);
  M.cyl('shell', 0.3, 5.6, 0.3, 0.9, 0.12, N.SHELL, 20);
  M.add('concrete', new THREE.RingGeometry(0.5, 0.6, 20), { pos: v(0.3, 5.73, 0.3), rot: e(-PI / 2, 0, 0), color: 0xd9b23a });
  drone(M, 0.3, 5.72, 0.3);
  M.add('metal', new THREE.TorusGeometry(0.9, 0.025, 4, 20), { pos: v(0.3, 6.0, 0.3), rot: e(PI / 2, 0, 0), color: N.YELLOW });
  M.cyl('metal', -0.4, 5.72, 0.3, 0.015, 1.2, N.FRAME, 4);
  M.sphere('blink', -0.4, 6.95, 0.3, 0.05, L.cyan, 6);
  avionics(M, -0.8, 0, -0.8, 0.6, 0.6, 0.5);
}
// atmospheric water condenser (3x3): a tower of chilled fins in a frame, a
// fan on top, the water tank it fills
export function condenser(M) {
  plinth(M, 3, 3);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) M.cyl('metal', -0.3 + sx * 0.6, 0, -0.3 + sz * 0.6, 0.05, 3.4, N.FRAME, 6);
  for (let i = 0; i < 14; i++) M.box('metal', -0.3, 0.45 + i * 0.2, -0.3, 1.1, 0.03, 1.1, 0xb8c4cc);
  M.cyl('shell', -0.3, 3.3, -0.3, 0.65, 0.3, N.SHELL, 20);
  const fan = M.animGroup('metal', { pivot: [-0.3, 0, -0.3], axis: [0, 1, 0], speed: 3 });
  for (let k = 0; k < 4; k++) fan.add(new THREE.BoxGeometry(1.0, 0.03, 0.18), { pos: v(-0.3, 3.65, -0.3), rot: e(0.25, k * PI / 4, 0), color: N.DARK });
  M.col(-0.95, 0, -0.95, 0.35, 3.6, 0.35);
  tankV(M, 0.85, 0.85, 0.42, 1.2, { y0: 0.2, band: BLUE });
  pipe(M, [-0.3, 0.3, 0.3], [0.85, 0.5, 0.45], 0.3, 0.05, 0xb8bec4);
}
// steel mill (8x6): a direct-reduction shaft with its glowing tap, methane
// feed, a cooling bed of hot billets, the stack
export function steelmill(M) {
  plinth(M, 8, 6);
  const sx = -1.8, sz = 0.4;
  M.cyl('steel', sx, 0, sz, 1.15, 6.2, 0xb8bcc0, 24);
  for (let y = 1; y < 6; y += 1.2) M.add('metal', new THREE.TorusGeometry(1.17, 0.05, 6, 28), { pos: v(sx, y, sz), rot: e(PI / 2, 0, 0), color: N.FRAME });
  M.cyl('metal', sx, 6.2, sz, 0.9, 0.3, N.DARK, 20);
  M.cyl('metal', sx + 0.4, 6.5, sz, 0.2, 2.0, N.FRAME, 10);
  M.vent(sx + 0.4, 8.6, sz, { rate: 1.2, size: 1.0, kind: 'exhaust' });
  M.colCyl(sx, sz, 1.15, 0, 6.5);
  M.box('metal', sx + 1.3, 0.6, sz - 0.6, 0.6, 0.5, 0.5, 0x3a3f45);
  M.box('emissive', sx + 1.5, 0.6, sz - 0.6, 0.25, 0.3, 0.3, L.orange);
  M.light(sx + 1.6, 1.0, sz - 0.6, L.orange, 3, 6);
  M.box('metal', 1.6, 0.35, -0.8, 3.4, 0.2, 1.6, N.STEEL);
  for (let i = 0; i < 6; i++) M.box(i < 2 ? 'emissive' : 'metal', 0.3 + i * 0.5, 0.55, -0.8, 0.32, 0.2, 1.3, i < 2 ? 0xc84a10 : 0x6a6e74);
  for (const [sxx, szz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) M.cyl('metal', 1.6 + sxx * 1.6, 0, -0.8 + szz * 0.7, 0.05, 0.35, N.STEEL, 6);
  M.col(-0.1, 0, -1.6, 3.3, 0.7, 0.0);
  sphereTank(M, 2.6, 1.1, 1.8, 0.75, {});
  band(M, 2.6, 1.8, 0.76, 1.05, 0.12, CH4);
  pipe(M, [1.9, 1.1, 1.8], [sx + 1.1, 2.6, sz], 2.8, 0.08, CH4);
}
// robot factory (8x8): an assembly hangar, an arm on its plinth outside, a
// line of finished work robots waiting
export function robotics(M) {
  plinth(M, 8, 8);
  hangar(M, 0.6, 0.8, 5.0, 5.6, 3.4, PI / 2, { stripe: 0xffb347 });
  for (let i = 0; i < 3; i++) robot(M, -2.6 + i * 0.8, -2.8);
  M.cyl('metal', -3.0, 0, 1.2, 0.3, 0.5, N.DARK, 14);
  const arm = M.animGroup('shell', { pivot: [-3.0, 0, 1.2], axis: [0, 1, 0], speed: 0.6 });
  arm.add(new THREE.CylinderGeometry(0.22, 0.25, 0.3, 14), { pos: v(-3.0, 0.65, 1.2), color: 0xffb347 });
  gStrut(arm, [-3.0, 0.8, 1.2], [-2.8, 2.0, 1.5], 0.18, 0xffb347);
  arm.add(new THREE.SphereGeometry(0.14, 12, 8), { pos: v(-2.8, 2.05, 1.5), color: 0x3a3f45 });
  gStrut(arm, [-2.8, 2.05, 1.5], [-2.4, 1.6, 2.2], 0.14, 0xffb347);
  arm.add(new THREE.BoxGeometry(0.2, 0.2, 0.25), { pos: v(-2.35, 1.48, 2.3), color: 0x3a3f45 });
  M.colCyl(-3.0, 1.2, 0.3, 0, 0.5);
  avionics(M, 3.2, 0, -3.2, 0.7, 0.6, 0.5);
}
// mass driver (14x6): an electromagnetic launch rail on a truss rising
// toward the sky, its coils, the loading hopper, capacitor banks
export function massdriver(M) {
  plinth(M, 14, 6, { collide: false });
  M.col(-7, -0.45, -3, 7, 0, 3);
  const A = [-5.6, 0.9, 0.4], B = [6.2, 5.8, 0.4];
  const d = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], len = Math.hypot(...d);
  for (const oz of [-0.35, 0.35]) strut(M, [A[0], A[1], A[2] + oz], [B[0], B[1], B[2] + oz], 0.12, N.FRAME);
  strut(M, [A[0], A[1] - 0.4, A[2]], [B[0], B[1] - 0.4, B[2]], 0.18, N.STEEL);
  const ang = Math.atan2(d[1], d[0]);
  const n = Math.floor(len / 0.8);
  for (let i = 1; i < n; i++) {
    const t = i / n, p = [A[0] + d[0] * t, A[1] + d[1] * t - 0.1, A[2]];
    M.add('metal', new THREE.TorusGeometry(0.45, 0.07, 6, 16), { pos: v(...p), rot: new THREE.Euler(0, PI / 2, ang, 'ZYX'), color: i % 3 ? 0xb87333 : N.FRAME });
  }
  for (const t of [0.2, 0.45, 0.7, 0.92]) {
    const p = [A[0] + d[0] * t, A[1] + d[1] * t - 0.45, A[2]];
    for (const oz of [-1, 1]) strut(M, [p[0], 0, p[2] + oz * 1.2], [p[0], p[1], p[2]], 0.16, N.STEEL);
    M.colCyl(p[0], p[2], 0.4, 0, p[1]);
  }
  M.add('metal', new THREE.CylinderGeometry(0.9, 0.35, 1.0, 4, 1, true), { pos: v(-6.0, 1.9, 0.4), rot: e(0, PI / 4, 0), color: 0x9aa0a6 });
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) M.cyl('metal', -6.0 + sx * 0.5, 0, 0.4 + sz * 0.5, 0.05, 1.5, N.STEEL, 6);
  for (let i = 0; i < 4; i++) avionics(M, -3.0 + i * 1.6, 0, -2.3, 1.2, 0.9, 0.8);
  M.box('emissive', 3.4, 0.6, -2.72, 0.3, 0.05, 0.02, L.green);
  beacon(M, B[0], B[1] + 0.3, B[2], L.red);
}
// construction yard (8x8): a gantry over the printing bed with a wall half
// printed, stacks of material, a printing drone on its pad
export function constructionyard(M) {
  plinth(M, 8, 8);
  M.box('concrete', 0.4, 0.05, 0.6, 4.4, 0.1, 3.6, 0x8f8a84);
  for (let k = 0; k < 9; k++) M.add('concrete', new THREE.TorusGeometry(1.2, 0.09, 4, 28, PI * 1.3), { pos: v(0.4, 0.15 + k * 0.17, 0.8), rot: e(PI / 2, 0, 0.6), color: k % 2 ? 0xa59e94 : 0x9a938a });
  for (const sx of [-1, 1]) { M.box('metal', 0.4 + sx * 2.5, 2.0, 0.6, 0.22, 4.0, 0.22, N.ORANGE); M.col(0.4 + sx * 2.5 - 0.15, 0, 0.45, 0.4 + sx * 2.5 + 0.15, 4.0, 0.75); }
  M.box('metal', 0.4, 4.0, 0.6, 5.3, 0.25, 0.3, N.ORANGE);
  M.box('metal', 0.6, 3.75, 0.6, 0.45, 0.35, 0.4, N.DARK);
  M.cyl('metal', 0.6, 2.3, 0.6, 0.04, 1.3, 0x9aa0a6, 6);
  M.box('metal', 0.6, 2.2, 0.6, 0.18, 0.2, 0.18, N.DARK);
  for (let i = 0; i < 4; i++) M.box('metal', -2.9, 0.15 + i * 0.12, -2.8, 1.6, 0.1, 1.0, i % 2 ? 0x9aa3ab : 0x8a939b);
  cargoBags(M, 2.9, -2.7, 4, 0);
  M.col(-3.7, 0, -3.3, -2.1, 0.7, -2.3);
  M.cyl('concrete', 2.8, 0, 2.9, 0.65, 0.08, 0x8f8a84, 20);
  drone(M, 2.8, 0.08, 2.9, N.SHELL, L.orange);
}
// maintenance drone base (6x6): a drone shed with three docks on its roof,
// the parts lockers, a beacon
export function maintenance(M) {
  plinth(M, 6, 6);
  M.box('shell', 0, 1.1, 0.4, 4.4, 2.2, 3.2, N.SHELL);
  M.box('shell', 0, 2.25, 0.4, 4.5, 0.1, 3.3, N.SHELL2);
  M.box('metal', 0, 1.0, -1.22, 2.4, 1.6, 0.04, 0xc9ccd0);
  M.col(-2.2, 0, -1.2, 2.2, 2.3, 2.0);
  for (const x of [-1.4, 0, 1.4]) { M.cyl('concrete', x, 2.3, 0.6, 0.55, 0.05, 0x8f8a84, 16); drone(M, x, 2.35, 0.6, N.SHELL, L.green); }
  for (let i = 0; i < 3; i++) M.box('metal', -1.8 + i * 0.6, 0.85, -2.3, 0.5, 1.7, 0.45, [0x8a9096, N.ORANGE, 0x8a9096][i]);
  M.col(-2.1, 0, -2.55, -0.3, 1.7, -2.05);
  beacon(M, 2.0, 2.3, -0.9, L.orange);
  avionics(M, 2.3, 0, -2.4, 0.6, 0.6, 0.5);
}
// ice mine (5x5): a drill into the ice, the melt tank and heater lines, a
// stack of cut ice blocks
export function icemine(M) {
  plinth(M, 5, 5);
  derrick(M, -0.8, -0.6, 4.2, 1.4);
  tankV(M, 1.3, -0.9, 0.55, 1.8, { y0: 0.2, band: BLUE });
  pipe(M, [-0.8, 0.4, 0.1], [1.3, 1.2, -0.35], 0.6, 0.08, 0xc9302a);
  for (let i = 0; i < 6; i++) M.box('window', 0.6 + (i % 3) * 0.55, 0.25 + Math.floor(i / 3) * 0.5, 1.4, 0.5, 0.48, 0.5);
  for (let i = 0; i < 6; i++) M.box('shell', 0.6 + (i % 3) * 0.55, 0.25 + Math.floor(i / 3) * 0.5, 1.4, 0.46, 0.44, 0.46, 0xcfe8f4);
  M.col(0.3, 0, 1.15, 2.0, 1.0, 1.65);
  avionics(M, -1.6, 0, 1.6, 0.6, 0.5, 0.5);
}
// evaporation salt works (8x8): four shallow pans of brine and salt, a rake
// gantry, the brine pump and the magnesium bin
export function saltworks(M) {
  plinth(M, 8, 8);
  for (let i = 0; i < 4; i++) {
    const x = -1.9 + (i % 2) * 3.0, z = -1.6 + Math.floor(i / 2) * 3.0;
    M.box('metal', x, 0.1, z, 2.7, 0.2, 2.6, N.STEEL);
    M.box(i % 2 ? 'concrete' : 'water', x, 0.17, z, 2.5, 0.06, 2.4, i % 2 ? 0xf2f0ec : 0x7a9aa8);
  }
  for (const sz of [-1, 1]) M.box('metal', -0.4, 1.4, sz * 3.2, 6.4, 0.12, 0.12, N.ORANGE);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) M.cyl('metal', -0.4 + sx * 3.2, 0, sz * 3.2, 0.06, 1.4, N.ORANGE, 6);
  M.box('metal', 0.5, 1.1, 0, 0.2, 0.5, 6.4, N.FRAME);
  M.box('metal', 3.4, 0.6, 2.6, 0.9, 1.2, 0.9, 0xc9ccd0);
  M.box('metal', 3.4, 0.4, -2.6, 0.7, 0.8, 0.6, 0x3a6aa0);
  M.col(2.9, 0, 2.1, 3.9, 1.2, 3.1);
}
// sand glass kiln (6x6): a domed furnace with its glowing mouth, the sand
// hopper, racks of fresh glass sheets, the chimney
export function sandglass(M) {
  plinth(M, 6, 6);
  M.cyl('shell', -0.6, 0, 0.6, 1.6, 1.2, 0xd8d0c4, 24);
  M.add('shell', new THREE.SphereGeometry(1.6, 24, 10, 0, PI * 2, 0, PI / 2), { pos: v(-0.6, 1.2, 0.6), color: 0xd8d0c4 });
  M.box('metal', -0.6, 0.6, -0.95, 0.8, 0.7, 0.2, N.DARK);
  M.box('emissive', -0.6, 0.6, -1.06, 0.6, 0.5, 0.02, L.orange);
  M.light(-0.6, 0.8, -1.5, L.orange, 3, 6);
  M.colCyl(-0.6, 0.6, 1.6, 0, 2.6);
  M.cyl('metal', -1.4, 2.4, 1.3, 0.18, 2.6, N.FRAME, 10);
  M.vent(-1.4, 5.1, 1.3, { rate: 0.9, size: 0.8, kind: 'exhaust' });
  M.add('metal', new THREE.CylinderGeometry(0.8, 0.3, 1.0, 4, 1, true), { pos: v(1.6, 2.3, 1.6), rot: e(0, PI / 4, 0), color: 0x9aa0a6 });
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) M.cyl('metal', 1.6 + sx * 0.5, 0, 1.6 + sz * 0.5, 0.05, 1.9, N.STEEL, 6);
  for (let i = 0; i < 4; i++) M.box('window', 1.3 + i * 0.35, 0.75, -1.8, 0.03, 1.3, 1.0);
  M.box('metal', 1.8, 0.05, -1.8, 1.6, 0.1, 1.1, N.STEEL);
}
// fumarole sulphur collector (5x5): a hood over the vent, the condenser
// box, a pile of yellow sulphur, steam escaping
export function sulfurvent(M) {
  plinth(M, 5, 5);
  M.add('regolith', new THREE.ConeGeometry(1.2, 0.5, 16), { pos: v(-0.6, 0.25, -0.4), color: 0x6a5a4a });
  M.add('metal', new THREE.ConeGeometry(1.1, 1.3, 16, 1, true), { pos: v(-0.6, 1.25, -0.4), color: 0x8a9096 });
  M.cyl('metal', -0.6, 1.9, -0.4, 0.18, 0.9, N.FRAME, 10);
  M.vent(-0.6, 2.8, -0.4, { rate: 1.0, size: 0.9 });
  for (let k = 0; k < 3; k++) { const a = k / 3 * PI * 2; strut(M, [-0.6 + Math.cos(a) * 1.3, 0, -0.4 + Math.sin(a) * 1.3], [-0.6 + Math.cos(a) * 0.9, 1.0, -0.4 + Math.sin(a) * 0.9], 0.07, N.STEEL); }
  M.colCyl(-0.6, -0.4, 1.1, 0, 1.9);
  M.box('shell', 1.3, 0.7, -0.6, 1.0, 1.4, 1.0, N.SHELL);
  pipe(M, [-0.6, 2.2, -0.4], [1.3, 1.4, -0.6], 2.3, 0.08, 0xc9a640);
  M.add('regolith', new THREE.ConeGeometry(0.9, 0.7, 14), { pos: v(1.2, 0.35, 1.4), color: 0xe8cf3a });
  M.colCyl(1.2, 1.4, 0.7, 0, 0.7);
}
// meteorite works (6x6): an iron-nickel meteorite half dug out, a crane
// with a magnetic grab, the ore bin
export function meteorite(M) {
  plinth(M, 6, 6);
  const rock = new THREE.IcosahedronGeometry(1.2, 1);
  const P = rock.attributes.position;
  for (let i = 0; i < P.count; i++) { const k = 1 + 0.18 * Math.sin(P.getX(i) * 3.1 + P.getZ(i) * 2.3); P.setXYZ(i, P.getX(i) * k, P.getY(i) * k * 0.8, P.getZ(i) * k); }
  rock.computeVertexNormals();
  M.add('metal', rock, { pos: v(-1.0, 0.5, 0.4), color: 0x4a4440 });
  M.colCyl(-1.0, 0.4, 1.2, 0, 1.5);
  M.cyl('metal', 1.4, 0, 1.6, 0.18, 3.6, N.ORANGE, 10);
  strut(M, [1.4, 3.5, 1.6], [-0.6, 3.2, 0.6], 0.18, N.ORANGE);
  M.cyl('metal', -0.6, 2.2, 0.6, 0.015, 1.0, N.DARK, 4);
  M.cyl('metal', -0.6, 1.9, 0.6, 0.35, 0.3, 0x3a3f45, 16);
  M.colCyl(1.4, 1.6, 0.25, 0, 3.6);
  M.box('metal', 1.6, 0.45, -1.6, 1.2, 0.9, 1.0, 0x5b6168);
  for (let i = 0; i < 5; i++) M.sphere('metal', 1.3 + (i % 3) * 0.3, 0.95, -1.75 + Math.floor(i / 3) * 0.3, 0.14, 0x8a8a80, 6);
  M.col(1.0, 0, -2.1, 2.2, 1.0, -1.1);
}
// crystal harvester (5x5): a cluster of blue cobalt crystals, a laser
// cutter on a turning post, crates of cut crystal
export function crystalmine(M) {
  plinth(M, 5, 5);
  for (let i = 0; i < 7; i++) {
    const a = i * 2.1, r = i ? 0.45 + (i % 3) * 0.2 : 0, h = 1.6 - (i % 3) * 0.35;
    const g = new THREE.CylinderGeometry(0.12, 0.18, h, 6); g.translate(0, h / 2, 0); g.rotateZ(Math.cos(a) * 0.35); g.rotateX(Math.sin(a) * 0.35);
    M.add('metal', g, { pos: v(-0.8 + Math.cos(a) * r, 0, -0.5 + Math.sin(a) * r), color: [0x2f6dff, 0x4a86ff, 0x2a5ad0][i % 3] });
  }
  M.colCyl(-0.8, -0.5, 0.9, 0, 1.6);
  M.cyl('metal', 1.2, 0, -0.6, 0.2, 1.4, N.FRAME, 10);
  const head = M.animGroup('shell', { pivot: [1.2, 0, -0.6], axis: [0, 1, 0], speed: 0.4 });
  head.add(new THREE.BoxGeometry(0.4, 0.3, 1.4), { pos: v(1.2, 1.55, -0.9), color: N.SHELL });
  head.add(new THREE.CylinderGeometry(0.06, 0.06, 0.3, 8).rotateX(PI / 2), { pos: v(1.2, 1.5, -1.7), color: 0xc9302a });
  M.colCyl(1.2, -0.6, 0.25, 0, 1.4);
  for (let i = 0; i < 3; i++) { M.box('shell', 0.4 + i * 0.6, 0.25, 1.4, 0.5, 0.5, 0.5, N.SHELL2); M.box('metal', 0.4 + i * 0.6, 0.51, 1.4, 0.3, 0.02, 0.3, 0x2f6dff); }
  M.col(0.1, 0, 1.15, 1.95, 0.5, 1.65);
}

// ---------------------------------------------------------------- science
// gene lab (8x8): a lab vessel with a window band and a biohazard band, a
// greenhouse dome for the trials, sequencer racks in foil
export function genelab(M) {
  plinth(M, 8, 8);
  const vx = -1.0, vz = 0.6;
  deployFrame(M, vx, vz, 4.6, 4.6, 0.55);
  const cap = vessel(M, vx, vz, { r: 2.5, h: 3.4, y0: 0.55, loft: 0, hatches: [PI], ports: [], segs: 10 });
  viewBand(M, vx, vz, 2.5, 1.6, 1.0, { from: PI * 0.55, to: PI * 1.45, n: 9 });
  band(M, vx, vz, 2.5, 3.3, 0.22, N.ORANGE);
  cupola(M, vx, cap - 0.05, vz, 0.75);
  geodesicDome(M, 2.4, -1.8, 1.4, { skirt: 0.3, detail: 1 });
  for (let i = 0; i < 5; i++) M.sphere('plant', 2.4 + Math.cos(i * 1.3) * 0.5, 0.5, -1.8 + Math.sin(i * 1.3) * 0.5, 0.25, [0x3d7f3a, 0x7a4fb8, 0x2f8a6a][i % 3], 8, 0.85);
  for (let i = 0; i < 3; i++) avionics(M, 2.8, 0, 1.0 + i * 0.9, 0.6, 1.0, 0.7);
  porch(M, vx, vz - 2.5, 0.55, { w: 1.4, d: 0.7, run: 1.1 });
  M.entry(vx);
}
// data centre (8x8): two server halls side by side, a bank of radiators,
// chillers with turning fans on the roof
export function datacenter(M) {
  plinth(M, 8, 8);
  for (const z of [-1.2, 1.4]) tubeModule(M, -0.6, 1.25, z, 5.4, 1.05, 0, { endHatch: z < 0, startHatch: false, ribs: 4, ports: 0 });
  deployFrame(M, -0.6, 0.1, 5.8, 4.4, 0.3);
  for (const z of [-1.2, 1.4]) for (const x of [-2.4, -0.6, 1.2]) {
    M.cyl('shell', x, 2.2, z, 0.38, 0.35, N.SHELL2, 16);
    const fan = M.animGroup('metal', { pivot: [x, 0, z], axis: [0, 1, 0], speed: 4 });
    for (let k = 0; k < 3; k++) fan.add(new THREE.BoxGeometry(0.6, 0.02, 0.1), { pos: v(x, 2.58, z), rot: e(0.25, k * PI / 3, 0), color: N.DARK });
  }
  for (const x of [2.8, 3.6]) radiatorWing(M, x, 2.9, PI / 2, { w: 2.2, h: 2.0, y0: 0.4 });
  avionics(M, 3.0, 0, -2.6, 0.8, 1.2, 1.2);
  M.box('emissive', 3.0, 1.0, -3.22, 0.4, 0.05, 0.02, L.cyan);
}

// ---------------------------------------------------------------- colony
// supermarket (12x10): a long hall with a glazed front, the loading dock
// with bags and reefer units, a sign
export function supermarket(M) {
  plinth(M, 12, 10);
  hangar(M, -0.8, 1.0, 8.4, 5.4, 3.8, 0, { stripe: GREEN, door: false });
  M.box('glass', -0.8, 1.3, -1.73, 5.0, 2.0, 0.05);
  M.box('metal', -0.8, 1.3, -1.76, 5.2, 2.2, 0.02, N.FRAME);
  M.box('emissive', -0.8, 2.75, -1.78, 3.0, 0.3, 0.03, L.green);
  M.box('shell', -0.8, 2.45, -2.3, 2.6, 0.1, 1.2, N.SHELL2);
  for (const x of [-2.0, 0.4]) M.cyl('metal', x, 0, -2.8, 0.05, 2.45, N.FRAME, 6);
  M.box('metal', 4.6, 0.6, 2.0, 1.8, 1.2, 3.6, N.STEEL);
  cargoBags(M, 4.6, 1.4, 4, PI / 2);
  for (let i = 0; i < 2; i++) { M.box('shell', 4.8, 0.5, -1.6 + i * 1.4, 1.2, 1.0, 1.0, N.SHELL); M.cyl('metal', 4.8, 1.0, -1.6 + i * 1.4, 0.3, 0.08, N.DARK, 14); }
  M.col(4.2, 0, -2.1, 5.4, 1.0, 0.3);
  M.col(3.7, 0, 0.2, 5.5, 1.2, 3.8);
  M.entry(-0.8);
}
// vertical farm (8x8): a tall vessel of grow floors, each floor's band
// glowing magenta through the windows, the nutrient tanks
export function verticalfarm(M) {
  plinth(M, 8, 8);
  const vx = -0.6, vz = 0.4;
  deployFrame(M, vx, vz, 4.6, 4.6, 0.55);
  const cap = vessel(M, vx, vz, { r: 2.4, h: 8.2, y0: 0.55, loft: 0, hatches: [PI], ports: [], segs: 12 });
  for (let f = 0; f < 4; f++) {
    const y = 1.2 + f * 1.9;
    M.add('window', new THREE.CylinderGeometry(2.42, 2.42, 0.9, 48, 1, true), { pos: v(vx, y + 0.45, vz) });
    M.add('emissive', new THREE.CylinderGeometry(2.3, 2.3, 0.7, 48, 1, true), { pos: v(vx, y + 0.45, vz), color: MAGENTA });
    M.add('plant', new THREE.CylinderGeometry(2.28, 2.28, 0.25, 48, 1, true), { pos: v(vx, y + 0.15, vz), color: 0x3f8a3a });
  }
  cupola(M, vx, cap - 0.05, vz, 0.8);
  tankV(M, 2.9, -2.4, 0.45, 1.6, { y0: 0.2, band: BLUE });
  tankV(M, 2.9, -1.2, 0.4, 1.4, { y0: 0.2, band: 0xb9a46a });
  porch(M, vx, vz - 2.4, 0.55, { w: 1.4, d: 0.7, run: 1.1 });
  M.entry(vx);
}
// security drone base (6x6): the drone shed, four patrol drones on pads, a
// camera mast
export function securitybase(M) {
  plinth(M, 6, 6);
  M.box('shell', -1.2, 1.0, 1.0, 3.0, 2.0, 2.6, N.SHELL);
  M.box('shell', -1.2, 2.05, 1.0, 3.1, 0.1, 2.7, 0x2a5db0);
  M.box('metal', -1.2, 0.9, -0.32, 1.8, 1.5, 0.04, 0xc9ccd0);
  M.col(-2.7, 0, -0.3, 0.3, 2.1, 2.3);
  for (const [x, z] of [[1.4, -1.8], [2.4, -0.4], [1.4, 1.0], [2.4, 2.4]]) { M.cyl('concrete', x, 0, z, 0.55, 0.06, 0x8f8a84, 16); drone(M, x, 0.06, z, 0x2a2d31, L.red); }
  M.cyl('metal', -2.4, 2.1, -0.6, 0.05, 2.2, N.FRAME, 6);
  M.box('shell', -2.4, 4.2, -0.75, 0.25, 0.2, 0.4, N.SHELL);
  M.sphere('blink', -2.4, 4.45, -0.6, 0.05, L.red, 6);
}

// ---------------------------------------------------------------- civic
// canteen (8x6): a dining module with a window row, the kitchen with its
// steaming vent, the entrance and a lit menu
export function canteen(M) {
  plinth(M, 8, 6);
  tubeModule(M, -0.6, 1.35, 0.6, 5.4, 1.15, 0, { endHatch: false, startHatch: false, ribs: 4, ports: 4 });
  deployFrame(M, -0.6, 0.6, 5.6, 2.2, 0.3);
  M.box('shell', 3.0, 1.2, 0.6, 1.6, 2.4, 2.2, N.SHELL);
  M.cyl('metal', 3.3, 2.4, 1.1, 0.16, 1.0, N.FRAME, 10);
  M.vent(3.3, 3.5, 1.1, { rate: 0.8, size: 0.6 });
  M.col(2.2, 0, -0.5, 3.8, 2.4, 1.7);
  M.box('shell', -0.6, 1.1, -0.9, 1.6, 2.0, 0.8, N.SHELL2);
  hatch(M, -0.6, 0.02, -1.3, PI, { w: 0.9, h: 1.7, depth: 0.12, label: false });
  M.box('emissive', 0.6, 1.9, -0.6, 0.9, 0.3, 0.02, L.warm);
  M.entry(-0.6);
}
// playground (6x6): a geodesic dome over a slide, swings and a sandpit
export function playground(M) {
  plinth(M, 6, 6);
  const cx = 0, cz = 0.3;
  M.cyl('plant', cx, 0.02, cz, 2.5, 0.05, 0x5d8f3a, 28);
  strut(M, [cx - 1.4, 1.3, cz], [cx - 0.2, 0.1, cz + 0.4], 0.5, 0xd9b23a);
  M.box('metal', cx - 1.6, 0.65, cz - 0.2, 0.5, 1.3, 0.5, N.ORANGE);
  for (const s of [-1, 1]) strut(M, [cx + 1.0 + s * 0.6, 0, cz - 0.8], [cx + 1.0, 1.6, cz - 0.8], 0.06, BLUE);
  M.box('metal', cx + 1.0, 1.6, cz - 0.8, 1.6, 0.06, 0.06, BLUE);
  for (const s of [-0.35, 0.35]) { M.cyl('metal', cx + 1.0 + s, 0.55, cz - 0.8, 0.01, 1.05, N.DARK, 4); M.box('shell', cx + 1.0 + s, 0.5, cz - 0.8, 0.3, 0.04, 0.16, 0xc94a8a); }
  M.cyl('regolith', cx + 0.6, 0.02, cz + 1.3, 0.7, 0.08, 0xd8c08a, 16);
  for (let i = 0; i < 4; i++) M.sphere('shell', cx - 0.8 + i * 0.5, 0.15, cz + 1.6, 0.14, [N.ORANGE, BLUE, GREEN, N.YELLOW][i], 8);
  geodesicDome(M, cx, cz, 2.7, { skirt: 0.35, detail: 2 });
  M.box('shell', cx, 0.9, cz - 2.85, 1.2, 1.8, 0.6, N.SHELL2);
  hatch(M, cx, 0.02, cz - 3.15, PI, { w: 0.8, h: 1.5, depth: 0.1, label: false });
}
// theatre (10x8): the auditorium vessel, the fly tower behind it, a
// marquee of lights, the entrance canopy
export function theatre(M) {
  plinth(M, 10, 8);
  const vx = -0.6, vz = 0.3;
  deployFrame(M, vx, vz, 5.4, 5.4, 0.4);
  const cap = vessel(M, vx, vz, { r: 2.9, h: 3.8, y0: 0.4, loft: 1.2, hatches: [PI], ports: [{ a: PI * 0.7 }, { a: PI * 1.3 }], segs: 12 });
  M.box('shell', vx, 3.6, vz + 3.0, 4.2, 7.2, 1.4, N.SHELL2);
  M.box('metal', vx, 7.25, vz + 3.0, 4.3, 0.1, 1.5, N.FRAME);
  M.col(vx - 2.1, 0, vz + 2.3, vx + 2.1, 7.2, vz + 3.7);
  for (let i = 0; i < 9; i++) M.sphere('emissive', vx - 1.6 + i * 0.4, 3.3, vz - 2.93, 0.06, L.warm, 6);
  M.box('emissive', vx, 3.65, vz - 2.95, 2.4, 0.3, 0.02, 0xffd28a);
  M.box('shell', vx, 2.6, vz - 3.3, 2.8, 0.12, 0.8, N.SHELL2);
  for (const s of [-1, 1]) M.cyl('metal', vx + s * 1.3, 0, vz - 3.65, 0.05, 2.6, N.FRAME, 6);
  porch(M, vx, vz - 2.9, 0.4, { w: 1.6, d: 0.5, run: 0.85 });
  void cap;
  M.entry(vx);
}
// broadcast station (6x6): a tall tapering mast with antenna panels and
// warning lights, the studio module and an uplink dish
export function broadcast(M) {
  plinth(M, 6, 6);
  mast(M, 1.2, 1.2, 14, 0.8, 0.3);
  for (let k = 0; k < 4; k++) { const a = k * PI / 2; M.box('shell', 1.2 + Math.sin(a) * 0.45, 12.5, 1.2 + Math.cos(a) * 0.45, 0.4, 1.4, 0.08, N.SHELL, a); }
  for (const y of [5, 9.5, 14.1]) M.sphere('blink', 1.2, y, 1.2, 0.08, L.red, 6);
  tubeModule(M, -1.4, 1.1, -1.4, 3.0, 0.9, 0, { endHatch: true, startHatch: false, ribs: 2, ports: 2 });
  const prof = []; for (let i = 0; i <= 8; i++) { const t = i / 8; prof.push(new THREE.Vector2(0.04 + t * 0.6, t * t * 0.2)); }
  for (const rev of [false, true]) { const dg = new THREE.LatheGeometry(rev ? prof.slice().reverse() : prof, 20); dg.rotateX(-0.6); M.add('shell', dg, { pos: v(-2.2, 2.4, 1.6), color: rev ? 0xeeece6 : 0xd8d6d0 }); }
  M.cyl('metal', -2.2, 0, 1.6, 0.05, 2.4, N.FRAME, 6);
}
// botanical garden (12x12): two geodesic glasshouses of trees and flowers
// joined by a tunnel, the entrance vestibule
export function botanical(M) {
  plinth(M, 12, 12);
  const A = [-1.8, 1.2, 3.4], B = [3.0, -2.2, 2.4];
  for (const [x, z, r] of [A, B]) {
    M.cyl('plant', x, 0.02, z, r * 0.95, 0.05, 0x587a35, 28);
    for (let i = 0; i < Math.round(r * 2); i++) { const a = i * 2.4, rr = r * 0.25 + (i % 3) * r * 0.18; tub(M, x + Math.cos(a) * rr, z + Math.sin(a) * rr, 1.2 + (i % 3) * 0.5, 0.5 + (i % 2) * 0.2, i); }
    for (let i = 0; i < 10; i++) { const a = i * 1.9, rr = r * 0.7; M.sphere('plant', x + Math.cos(a) * rr, 0.2, z + Math.sin(a) * rr, 0.22, [0xd9a62a, 0xc94a8a, 0xe8e3d8, 0x7a4fb8][i % 4], 6, 0.7); }
    geodesicDome(M, x, z, r, { skirt: 0.4, detail: 2 });
  }
  const d = Math.hypot(B[0] - A[0], B[1] - A[1]), ux = (B[0] - A[0]) / d, uz = (B[1] - A[1]) / d;
  const p0 = [A[0] + ux * A[2] * 0.95, A[1] + uz * A[2] * 0.95], p1 = [B[0] - ux * B[2] * 0.95, B[1] - uz * B[2] * 0.95];
  const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), yaw = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
  M.add('shell', new THREE.CylinderGeometry(0.75, 0.75, len, 20), { pos: v((p0[0] + p1[0]) / 2, 0.9, (p0[1] + p1[1]) / 2), rot: new THREE.Euler(0, -yaw, PI / 2, 'YXZ'), color: N.SHELL2 });
  M.box('shell', A[0], 1.0, A[1] - A[2] - 0.2, 1.4, 2.0, 0.8, N.SHELL2);
  hatch(M, A[0], 0.02, A[1] - A[2] - 0.6, PI, { w: 0.9, h: 1.7, depth: 0.12, label: false });
  M.entry(A[0]);
}
// planetary museum (10x8): the hall vessel with its window band, a replica
// of the first lander on a plinth and an old rover outside
export function museum(M) {
  plinth(M, 10, 8);
  const vx = -1.6, vz = 0.6;
  deployFrame(M, vx, vz, 5.0, 5.0, 0.55);
  const cap = vessel(M, vx, vz, { r: 2.7, h: 3.4, y0: 0.55, loft: 1.2, hatches: [PI], ports: [], segs: 12 });
  viewBand(M, vx, vz, 2.7, 1.5, 1.3, { from: PI * 0.4, to: PI * 1.6, n: 12 });
  void cap;
  const px = 3.0, pz = -1.6;
  M.cyl('concrete', px, 0, pz, 1.2, 0.4, 0x9a948c, 6);
  M.cyl('shell', px, 1.2, pz, 0.6, 0.5, 0xd8c08a, 6);
  for (let k = 0; k < 3; k++) { const a = k / 3 * PI * 2; strut(M, [px + Math.cos(a) * 0.5, 1.25, pz + Math.sin(a) * 0.5], [px + Math.cos(a) * 1.0, 0.42, pz + Math.sin(a) * 1.0], 0.06, N.FRAME); }
  M.cyl('metal', px, 1.7, pz, 0.03, 0.6, N.FRAME, 4);
  const prof = []; for (let i = 0; i <= 6; i++) { const t = i / 6; prof.push(new THREE.Vector2(0.03 + t * 0.35, t * t * 0.12)); }
  for (const rev of [false, true]) M.add('shell', new THREE.LatheGeometry(rev ? prof.slice().reverse() : prof, 14).rotateX(-0.5), { pos: v(px, 2.3, pz), color: 0xe8e6e0 });
  M.colCyl(px, pz, 1.2, 0, 1.7);
  const rx = 3.2, rz = 1.8;
  M.box('shell', rx, 0.55, rz, 0.9, 0.35, 1.3, 0xe8e6e0);
  for (const sx of [-1, 1]) for (const sz of [-1, 0, 1]) M.add('metal', new THREE.CylinderGeometry(0.17, 0.17, 0.12, 12), { pos: v(rx + sx * 0.52, 0.18, rz + sz * 0.5), rot: e(0, 0, PI / 2), color: 0x3a3f45 });
  M.add('solar', new THREE.BoxGeometry(1.1, 0.03, 1.4), { pos: v(rx, 0.78, rz) });
  M.cyl('metal', rx - 0.3, 0.78, rz - 0.5, 0.025, 0.5, N.FRAME, 4);
  M.box('metal', rx - 0.3, 1.32, rz - 0.5, 0.14, 0.1, 0.14, N.DARK);
  M.col(rx - 0.6, 0, rz - 0.75, rx + 0.6, 0.9, rz + 0.75);
  porch(M, vx, vz - 2.7, 0.55, { w: 1.6, d: 0.6, run: 0.9 });
  M.entry(vx);
}
// biosphere ark (16x16): a great geodesic dome over a forest and a pond,
// four service modules round it, the entrance
export function ark(M) {
  plinth(M, 16, 16);
  const R = 6.6;
  M.cyl('plant', 0, 0.02, 0, R * 0.96, 0.06, 0x4f7a35, 40);
  M.cyl('water', 1.6, 0.04, 1.8, 1.8, 0.04, 0x2a6a7a, 28);
  for (let i = 0; i < 16; i++) {
    const a = i * 2.39996, rr = 1.5 + (i % 4) * 1.1;
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    if (Math.hypot(x - 1.6, z - 1.8) < 2.2) continue;
    M.cyl('plant', x, 0, z, 0.1, 1.6 + (i % 3) * 0.8, 0x5a3b26, 6);
    M.sphere('plant', x, 2.0 + (i % 3) * 0.8, z, 0.8 + (i % 2) * 0.35, [0x3d7f3a, 0x2f6b34, 0x4f8a3a, 0x2a6a3a][i % 4], 10, 0.85);
  }
  geodesicDome(M, 0, 0, R, { skirt: 0.6, detail: 3 });
  for (let k = 0; k < 4; k++) {
    const a = k * PI / 2 + PI / 4, x = Math.cos(a) * (R + 0.6), z = Math.sin(a) * (R + 0.6);
    tubeModule(M, x, 1.1, z, 1.6, 0.85, -a, { endHatch: false, startHatch: false, ribs: 1, ports: 0 });
  }
  M.box('shell', 0, 1.2, -R - 0.4, 2.0, 2.4, 1.4, N.SHELL2);
  hatch(M, 0, 0.02, -R - 1.1, PI, { w: 1.1, h: 2.0, depth: 0.14 });
  M.light(0, 5.0, 0, L.warm, 2, 14);
  M.entry(0);
}
