// Base, power, terraforming and industry hardware of the agency (fourth
// batch), in the same engineering language as the rest of the base: shell
// modules, tanks, columns, radiators, derricks, domes, frames, avionics in
// gold foil. Each machine shows its job by its working parts, and the parts
// that turned before (rotor, drill strings, dish, radar, robot arms) still do.
import * as THREE from 'three';
import { C, L, v, e, plinth, room, airlock } from './modelkit.js';
import { strut, tankH, floodMast } from './starkit.js';
import {
  N, hatch, radiatorWing, grating, avionics, tankV, processColumn, hangar, growTube,
  instrumentMast, cargoBags, geodesicDome, derrick, suitport, dishAntenna, phasedArray, heap,
} from './nasakit.js';
import { pipe, band, beacon } from './models_agency.js';

const PI = Math.PI;
const GREEN = 0x2f8f4a, BLUE = 0x2a5db0;
const striped = (a, b, k) => (x, y) => (Math.floor(y * k + 100) & 1 ? a : b);

// a strut inside an animated group (same as starkit's strut)
function gStrut(g, a, b, t, color) {
  const A = v(...a), B = v(...b), d = B.clone().sub(A), len = d.length();
  const q = new THREE.Quaternion().setFromUnitVectors(v(0, 1, 0), d.normalize());
  g.add(new THREE.BoxGeometry(t, len, t), { pos: A.clone().add(B).multiplyScalar(0.5), rot: new THREE.Euler().setFromQuaternion(q), color });
}

// ---------------------------------------------------------------- habitat module (8x8)
// the first home: a rigid module you walk into (bed, locker, workbench,
// table), outside in the agency's kit: frame posts and ring beams, the
// airlock vestibule, two suits docked to suitports on the back wall, O2/N2
// tanks, a radiator, avionics and a mast on the roof
export function habitat(M) {
  plinth(M, 8, 8);
  room(M, 7.4, 7.4, 3.2, { door: 1.8, winSide: 2, winBack: 2, key: 'shell', color: N.SHELL, roofColor: N.SHELL2 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) M.bb('metal', sx * 3.7 - 0.16, 0, sz * 3.7 - 0.16, sx * 3.7 + 0.16, 3.62, sz * 3.7 + 0.16, N.FRAME);
  for (const y of [0.12, 3.12]) {
    M.bb('metal', -3.86, y, -3.88, 3.86, y + 0.12, -3.8, N.FRAME); M.bb('metal', -3.86, y, 3.8, 3.86, y + 0.12, 3.88, N.FRAME);
    M.bb('metal', -3.88, y, -3.86, -3.8, y + 0.12, 3.86, N.FRAME); M.bb('metal', 3.8, y, -3.86, 3.88, y + 0.12, 3.86, N.FRAME);
  }
  // MMOD panel seams on the walls
  M.box('metal', 2.5, 1.62, -3.83, 0.05, 2.9, 0.02, 0xc9c7c0);
  for (const x of [-2.5, 2.5]) M.box('metal', x, 1.62, 3.83, 0.05, 2.9, 0.02, 0xc9c7c0);
  for (const z of [-2.5, 0, 2.5]) for (const sx of [-1, 1]) M.box('metal', sx * 3.83, 1.62, z, 0.02, 2.9, 0.05, 0xc9c7c0);
  airlock(M, 0, -3.7, 1.8, 2.6, 0.55, N.SHELL2);
  M.box('shell', -2.32, 2.72, -3.85, 1.0, 0.16, 0.02, N.STENCIL);
  M.box('shell', 1.75, 2.72, -3.85, 0.5, 0.16, 0.02, 0x2a5db0);
  // two suits docked to suitports beside the airlock, hatches on the inside
  suitport(M, -1.75, -3.82, PI, { stripe: true });
  suitport(M, -2.9, -3.82, PI);
  for (const x of [-1.75, -2.9]) {
    M.add('metal', new THREE.TorusGeometry(0.4, 0.05, 8, 28), { pos: v(x, 1.5, -3.56), color: N.FRAME });
    M.add('interior', new THREE.CylinderGeometry(0.38, 0.38, 0.04, 24), { pos: v(x, 1.5, -3.57), rot: e(PI / 2, 0, 0), color: 0xd8dde3 });
    M.box('metal', x + 0.18, 1.5, -3.53, 0.05, 0.3, 0.05, N.YELLOW);
  }
  // roof: tanks, radiator, avionics, comm mast
  const RT = 3.58;
  tankV(M, 2.6, -2.7, 0.32, 1.5, { y0: RT, band: GREEN });
  tankV(M, 2.6, -1.8, 0.32, 1.5, { y0: RT, band: 0x1a1a1a });
  radiatorWing(M, -3.3, 1.0, PI / 2, { w: 2.0, h: 1.4, y0: RT });
  M.box('metal', -1.0, RT + 0.04, 1.6, 2.2, 0.08, 1.6, N.STEEL);
  avionics(M, -1.0, RT + 0.08, 1.6, 1.1, 0.5, 0.7);
  avionics(M, 1.2, RT, 2.3, 0.8, 0.45, 0.6);
  M.cyl('metal', 2.8, RT, 2.8, 0.04, 2.0, N.FRAME, 6);
  M.box('metal', 2.8, RT + 1.48, 2.8, 0.5, 0.04, 0.04, N.FRAME);
  M.sphere('blink', 2.8, RT + 2.06, 2.8, 0.06, L.red, 6);
  // ---- interior furnishing
  M.bb('metal', -3.4, 0.02, 1.2, -1.6, 0.42, 3.4, C.G2);
  M.bb('interior', -3.35, 0.42, 1.25, -1.65, 0.6, 3.35, 0xd8dde3);
  M.bb('interior', -3.3, 0.6, 2.75, -1.7, 0.72, 3.3, 0xf2f2ee);
  M.bb('interior', -3.35, 0.6, 1.25, -1.65, 0.66, 2.4, C.BLUE);
  M.bb('metal', 2.4, 0.02, 2.9, 3.45, 2.3, 3.45, C.G);
  M.bb('metal', 2.45, 0.2, 2.86, 2.9, 2.2, 2.9, C.G2);
  M.bb('metal', 2.95, 0.2, 2.86, 3.4, 2.2, 2.9, C.G2);
  M.bb('emissive', 2.91, 1.05, 2.83, 2.93, 1.35, 2.85, L.green);
  M.bb('metal', 2.6, 0.02, -1.6, 3.45, 0.95, 1.4, C.G2);
  M.bb('interior', 2.55, 0.95, -1.65, 3.47, 1.0, 1.45, C.IN2);
  M.bb('emissive', 3.38, 1.3, -0.8, 3.42, 1.9, 0.4, L.cyan);
  M.bb('metal', 3.4, 1.25, -0.85, 3.45, 1.95, 0.45, C.D);
  M.cyl('metal', -1.5, 0.02, -1.5, 0.08, 0.72, C.G, 10);
  M.cyl('interior', -1.5, 0.74, -1.5, 0.7, 0.05, C.IN1, 20);
  for (const [dx, dz] of [[-0.9, 0], [0.9, 0], [0, 0.9]]) M.cyl('interior', -1.5 + dx, 0.02, -1.5 + dz, 0.2, 0.45, C.O, 12);
  M.cyl('interior', -3.1, 0.02, -2.9, 0.25, 0.4, C.G2, 12);
  M.sphere('plant', -3.1, 0.65, -2.9, 0.32, 0x3e7a35, 10, 0.9);
  M.bb('metal', -3.5, 0.02, -3.0, -3.1, 1.6, -2.3, C.G2);
  M.bb('emissive', -3.08, 1.0, -2.95, -3.06, 1.4, -2.35, L.cyan);
  M.col(-3.4, 0, 1.2, -1.6, 0.66, 3.4);
  M.col(2.4, 0, 2.85, 3.5, 2.3, 3.5);
  M.col(2.6, 0, -1.6, 3.5, 1.0, 1.4);
  M.colCyl(-1.5, -1.5, 0.7, 0, 0.78);
  M.light(-2.5, 1.2, 2.4, L.warm, 1.2, 5);
}

// ---------------------------------------------------------------- small kit
// storage (2x1.4): soft cargo bags strapped in an aluminium frame
export function storage(M) {
  plinth(M, 2, 1.4);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) M.cyl('metal', sx * 0.92, 0, sz * 0.6, 0.035, 1.62, N.FRAME, 6);
  for (const y of [0.08, 0.82, 1.58]) M.box('metal', 0, y, 0, 1.9, 0.04, 1.26, N.STEEL);
  for (let i = 0; i < 3; i++) {
    const x = -0.58 + i * 0.58;
    M.box('mli', x, 0.4, -0.12, 0.54, 0.6, 0.62, 0xece8de);
    M.box('metal', x, 0.4, -0.12, 0.56, 0.04, 0.64, 0x7f8a96);
    M.box('metal', x, 0.4, -0.12, 0.04, 0.62, 0.64, 0x7f8a96);
    M.box('shell', x, 0.55, -0.44, 0.2, 0.08, 0.01, i === 1 ? 0x2a5db0 : N.STENCIL);
  }
  M.box('mli', 0.2, 0.36, 0.4, 1.2, 0.52, 0.36, 0xe4dfd3);
  M.box('mli', 0, 1.15, 0, 1.6, 0.62, 1.0, 0xece8de);
  M.box('metal', 0, 1.15, 0, 1.62, 0.04, 1.02, 0x7f8a96);
  for (const sx of [-1, 1]) M.box('metal', sx * 0.5, 1.15, 0, 0.04, 0.64, 1.03, 0x7f8a96);
  M.col(-1, 0, -0.7, 1, 1.6, 0.7);
}
// fabricator (3x2): an additive manufacturing cell you can see into (build
// plate, a part half printed, gantry and print head), feedstock spools, a
// workbench with a robot arm that turns and a screen
export function fabricator(M) {
  plinth(M, 3, 2);
  const cx = -0.65;
  M.box('shell', cx, 0.25, 0.1, 1.5, 0.5, 1.4, N.SHELL);
  M.box('shell', cx, 1.0, 0.77, 1.5, 1.5, 0.06, N.SHELL);
  for (const sx of [-1, 1]) M.box('shell', cx + sx * 0.72, 1.0, 0.1, 0.06, 1.5, 1.4, N.SHELL);
  M.box('shell', cx, 1.78, 0.1, 1.56, 0.08, 1.46, N.SHELL2);
  M.box('window', cx, 1.12, -0.6, 1.38, 1.2, 0.03);
  for (const y of [0.52, 1.72]) M.box('metal', cx, y, -0.62, 1.5, 0.05, 0.05, N.FRAME);
  M.box('metal', cx, 0.53, 0.1, 0.95, 0.04, 0.95, N.STEEL);
  M.box('shell', cx + 0.05, 0.7, 0.15, 0.42, 0.3, 0.3, 0xd25b3a);
  M.box('metal', cx, 1.5, 0.1, 1.36, 0.05, 0.08, N.FRAME);
  M.box('metal', cx + 0.1, 1.02, 0.15, 0.14, 0.2, 0.14, N.DARK);
  M.cyl('metal', cx + 0.1, 1.12, 0.15, 0.025, 0.38, 0x9aa0a6, 6);
  M.cyl('metal', cx + 0.1, 0.86, 0.15, 0.02, 0.06, 0x9aa0a6, 6);
  M.box('emissive', cx, 1.7, -0.42, 1.2, 0.02, 0.05, 0xfff2e0);
  for (let i = 0; i < 3; i++) M.add('mli', new THREE.CylinderGeometry(0.17, 0.17, 0.12, 18), { pos: v(-1.445, 0.45 + i * 0.4, 0.1), rot: e(0, 0, PI / 2), color: [0xd25b3a, 0x2a5db0, 0xe8e3d8][i] });
  M.col(cx - 0.76, 0, -0.62, cx + 0.76, 1.82, 0.82);
  // workbench
  M.bb('metal', 0.25, 0.9, -0.8, 1.45, 0.96, 0.85, N.STEEL);
  for (const sx of [0.32, 1.38]) for (const sz of [-0.72, 0.78]) M.cyl('metal', sx, 0, sz, 0.035, 0.9, N.FRAME, 6);
  M.bb('metal', 0.3, 0.28, -0.75, 1.4, 0.32, 0.8, N.STEEL);
  avionics(M, 0.85, 0.32, 0.3, 0.8, 0.4, 0.6);
  M.box('metal', 0.85, 1.35, 0.78, 0.7, 0.45, 0.04, N.DARK);
  M.box('emissive', 0.85, 1.35, 0.755, 0.62, 0.37, 0.01, L.cyan);
  M.cyl('metal', 0.95, 0.96, -0.2, 0.15, 0.1, N.DARK, 14);
  const arm = M.animGroup('shell', { pivot: [0.95, 0, -0.2], axis: [0, 1, 0], speed: 0.7 });
  arm.add(new THREE.CylinderGeometry(0.11, 0.12, 0.16, 14), { pos: v(0.95, 1.14, -0.2), color: N.SHELL });
  gStrut(arm, [0.95, 1.18, -0.2], [0.82, 1.62, -0.2], 0.1, N.SHELL);
  arm.add(new THREE.SphereGeometry(0.08, 12, 8), { pos: v(0.82, 1.64, -0.2), color: 0x3a3f45 });
  gStrut(arm, [0.82, 1.64, -0.2], [0.5, 1.46, -0.2], 0.08, N.SHELL);
  arm.add(new THREE.BoxGeometry(0.1, 0.14, 0.1), { pos: v(0.47, 1.38, -0.2), color: 0x3a3f45 });
  for (const s of [-1, 1]) arm.add(new THREE.BoxGeometry(0.03, 0.1, 0.03), { pos: v(0.47, 1.27, -0.2 + s * 0.04), color: N.ORANGE });
  M.col(0.25, 0, -0.8, 1.45, 0.96, 0.85);
}
// research terminal (2x2): an instrument rack with a screen, a whip antenna
// and a small dish that sweeps the sky
export function terminal(M) {
  plinth(M, 2, 2);
  M.box('shell', 0, 0.75, 0.2, 1.2, 1.5, 0.7, N.SHELL);
  M.add('metal', new THREE.BoxGeometry(0.95, 0.6, 0.06), { pos: v(0, 1.18, -0.2), rot: e(-0.3, 0, 0), color: N.DARK });
  M.add('emissive', new THREE.BoxGeometry(0.85, 0.5, 0.02), { pos: v(0, 1.18, -0.235), rot: e(-0.3, 0, 0), color: L.cyan });
  avionics(M, 0, 1.5, 0.3, 0.8, 0.3, 0.5);
  M.cyl('metal', 0.62, 0, 0.62, 0.04, 2.0, N.FRAME, 6);
  const dish = M.animGroup('shell', { pivot: [0.62, 0, 0.62], axis: [0, 1, 0], speed: 0.5 });
  const prof = []; for (let i = 0; i <= 8; i++) { const t = i / 8; prof.push(new THREE.Vector2(0.03 + t * 0.42, t * t * 0.16)); }
  const dg = new THREE.LatheGeometry(prof, 20); dg.rotateX(-0.75); dg.translate(0.62, 2.12, 0.62);
  dish.add(dg, { color: 0xd8d6d0 });
  const df = new THREE.LatheGeometry(prof.slice().reverse(), 20); df.rotateX(-0.75); df.translate(0.62, 2.12, 0.62);
  dish.add(df, { color: 0xeeece6 });
  dish.add(new THREE.CylinderGeometry(0.02, 0.02, 0.34, 5), { pos: v(0.62, 2.24, 0.5), rot: e(-0.75, 0, 0), color: N.FRAME });
  dish.add(new THREE.BoxGeometry(0.06, 0.06, 0.06), { pos: v(0.62, 2.36, 0.39), color: N.DARK });
  M.cyl('metal', -0.5, 1.8, 0.5, 0.012, 1.2, N.FRAME, 4);
  M.sphere('blink', -0.5, 3.02, 0.5, 0.035, L.green, 6);
  M.col(-0.6, 0, -0.25, 0.6, 1.8, 0.55);
}

// ---------------------------------------------------------------- power
// solar array (4x4): a single-axis tracker: two posts, a torque tube and a
// framed blanket of cells; drive, junction box and conduit
export function solar(M) {
  plinth(M, 4, 4);
  const tilt = -0.5, cy = 1.72, cz = 0.2;
  for (const x of [-1.2, 1.2]) { M.cyl('metal', x, 0, cz, 0.09, cy - 0.06, N.FRAME, 10); M.cyl('metal', x, 0, cz, 0.22, 0.1, N.DARK, 12); }
  M.add('metal', new THREE.CylinderGeometry(0.07, 0.07, 3.7, 10), { pos: v(0, cy - 0.1, cz), rot: e(0, 0, PI / 2), color: N.STEEL });
  M.box('metal', -1.2, cy - 0.12, cz, 0.3, 0.28, 0.3, N.DARK);
  const T = (lx, lz, dy = 0) => v(lx, cy + dy * Math.cos(tilt) - lz * Math.sin(tilt), cz + dy * Math.sin(tilt) + lz * Math.cos(tilt));
  M.add('solar', new THREE.BoxGeometry(3.7, 0.04, 2.4), { pos: T(0, 0, 0.02), rot: e(tilt, 0, 0) });
  for (const lz of [-1.22, 1.22]) M.add('metal', new THREE.BoxGeometry(3.78, 0.07, 0.06), { pos: T(0, lz, 0), rot: e(tilt, 0, 0), color: N.FRAME });
  for (const lx of [-1.87, -0.62, 0.62, 1.87]) M.add('metal', new THREE.BoxGeometry(0.05, 0.08, 2.44), { pos: T(lx, 0, -0.03), rot: e(tilt, 0, 0), color: N.FRAME });
  avionics(M, 1.5, 0, -1.55, 0.5, 0.5, 0.36);
  pipe(M, [1.2, 1.2, cz], [1.5, 0.5, -1.55], 0.25, 0.04, 0x2a2d31);
  M.col(-1.3, 0, cz - 0.1, 1.3, cy - 0.2, cz + 0.1);
  M.col(-1.9, 0.9, cz - 1.1, 1.9, 2.4, cz + 1.1, { noStand: true });
}
// wind turbine (3x3): a tall white tapered tower, nacelle, and a big
// three-blade rotor for the thin air, tips banded for aviation
export function wind(M) {
  plinth(M, 3, 3);
  const H = 15;
  M.add('shell', new THREE.CylinderGeometry(0.3, 0.55, H, 24), { pos: v(0, H / 2, 0), color: N.SHELL });
  M.cyl('metal', 0, 0, 0, 0.75, 0.2, N.STEEL, 24);
  for (let y = 3; y < H; y += 3) M.add('metal', new THREE.TorusGeometry(0.55 - y * 0.0167 + 0.01, 0.025, 4, 24), { pos: v(0, y, 0), rot: e(PI / 2, 0, 0), color: N.FRAME });
  hatch(M, 0, 0.25, -0.55, PI, { w: 0.6, h: 1.5, depth: 0.12, label: false });
  avionics(M, 1.0, 0, 0.9, 0.5, 0.6, 0.4);
  M.box('shell', 0, H + 0.4, 0.35, 0.95, 0.9, 2.3, N.SHELL);
  M.box('metal', 0, H + 0.88, 0.8, 0.55, 0.08, 0.9, N.FRAME);
  M.cyl('metal', 0.1, H + 0.85, 1.25, 0.012, 0.5, N.FRAME, 4);
  M.sphere('blink', 0, H + 0.92, 1.3, 0.07, L.red, 6);
  const rotor = M.animGroup('shell', { pivot: [0, H + 0.4, -0.95], axis: [0, 0, 1], speed: 1.2 });
  rotor.add(new THREE.SphereGeometry(0.42, 16, 10), { pos: v(0, H + 0.4, -1.0), scale: v(1, 1, 1.45), color: N.SHELL });
  for (let k = 0; k < 3; k++) {
    const a = k / 3 * PI * 2;
    const blade = new THREE.BoxGeometry(0.42, 6.6, 0.08, 1, 6, 1);
    blade.translate(0, 3.6, 0);
    const P = blade.attributes.position;
    for (let i = 0; i < P.count; i++) { const y = P.getY(i); P.setX(i, P.getX(i) * (1.25 - y / 8.5)); P.setZ(i, P.getZ(i) * (1.3 - y / 9)); }
    const R = new THREE.Euler(0, 0.12, a, 'ZYX');
    rotor.add(blade, { pos: v(0, H + 0.4, -1.1), rot: R, color: N.SHELL });
    const tip = new THREE.BoxGeometry(0.235, 0.5, 0.06); tip.translate(0, 6.2, 0);
    rotor.add(tip, { pos: v(0, H + 0.4, -1.1), rot: R, color: N.ORANGE });
  }
  M.colCyl(0, 0, 0.6, 0, H);
}
// fission surface power (8x8): the reactor sits in a shielding berm of
// regolith; a boom above it carries the radiator panels that shed its heat;
// the power conversion unit and cable reel at the berm's edge; keep-out
// markers around it
export function reactor(M) {
  plinth(M, 8, 8);
  const rx = 0.6, rz = 1.0;
  heap(M, rx, rz, 3.05, 2.75, 1.25, 0x7a5d4a, { seed: 3, yaw: 0.4, profile: 'plateau', flat: 0.58, clods: 10 });
  M.cyl('steel', rx, 1.2, rz, 0.95, 0.6, 0xd5d8db, 28);
  M.add('steel', new THREE.SphereGeometry(0.95, 28, 8, 0, PI * 2, 0, PI / 2), { pos: v(rx, 1.8, rz), scale: v(1, 0.4, 1), color: 0xd5d8db });
  for (let k = 0; k < 8; k++) { const a = k / 8 * PI * 2; M.box('metal', rx + Math.sin(a) * 0.96, 1.5, rz + Math.cos(a) * 0.96, 0.06, 0.6, 0.12, N.FRAME, a); }
  M.cyl('metal', rx, 1.9, rz, 0.16, 7.4, N.FRAME, 12);
  // radiator panels in a cone around the boom (white, like the station's),
  // each with its heat-pipe ribs and a frame, flaring outward with height
  for (let k = 0; k < 6; k++) {
    const a = k / 6 * PI * 2 + PI / 6, W = 1.25, hh = 5.0, tilt = 0.16, y0r = 2.6;
    const mk = (geo, lx, ly) => { geo.translate(lx, ly, 0); geo.rotateZ(-tilt); geo.rotateY(a - PI / 2); geo.translate(rx + Math.sin(a) * 0.2, y0r, rz + Math.cos(a) * 0.2); return geo; };
    M.add('shell', mk(new THREE.BoxGeometry(W, hh, 0.05), W / 2, hh / 2), { color: 0xe4e4df });
    for (let i = 1; i < 5; i++) M.add('metal', mk(new THREE.BoxGeometry(0.03, hh - 0.1, 0.08), i * W / 5, hh / 2), { color: 0x8f959b });
    for (const ly of [0, hh]) M.add('metal', mk(new THREE.BoxGeometry(W, 0.07, 0.09), W / 2, ly), { color: N.FRAME });
    strut(M, [rx + Math.sin(a) * 0.16, 2.1, rz + Math.cos(a) * 0.16], [rx + Math.sin(a) * (W + 0.2), y0r + 0.15, rz + Math.cos(a) * (W + 0.2)], 0.06, N.FRAME);
  }
  // shadow shield between the core and the radiators
  M.add('steel', new THREE.CylinderGeometry(0.75, 1.1, 0.35, 28), { pos: v(rx, 2.4, rz), color: 0x9a9fa5 });
  beacon(M, rx, 9.3, rz, L.red);
  M.vent(rx, 7.9, rz, { rate: 0.8, size: 2.2, kind: 'heat' });
  M.colCyl(rx, rz, 2.9, 0, 1.3);
  M.colCyl(rx, rz, 1.0, 0, 9.3);
  // power conversion unit, cable reel, keep-out markers
  M.box('foil', -2.9, 0.75, -2.5, 1.4, 1.3, 1.1, 0xd8a640);
  M.box('metal', -2.9, 0.06, -2.5, 1.5, 0.12, 1.2, N.DARK);
  M.box('metal', -2.9, 1.43, -2.5, 1.5, 0.06, 1.2, N.FRAME);
  radiatorWing(M, -3.65, -1.85, 0, { w: 1.4, h: 1.2, y0: 0.3 });
  M.col(-3.65, 0, -3.1, -2.15, 1.5, -1.9);
  M.add('metal', new THREE.CylinderGeometry(0.6, 0.6, 0.5, 22), { pos: v(-1.2, 0.62, -3.2), rot: e(0, 0, PI / 2), color: N.ORANGE });
  for (const sx of [-1, 1]) M.box('metal', -1.2 + sx * 0.3, 0.32, -3.2, 0.06, 0.64, 0.5, N.STEEL);
  pipe(M, [-2.2, 0.35, -2.5], [rx - 1.6, 0.25, rz - 1.3], 0.18, 0.06, 0x222222);
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * PI * 2; const x = rx + Math.sin(a) * 3.25, z = rz + Math.cos(a) * 3.25;
    if (Math.abs(x) > 3.8 || Math.abs(z) > 3.8) continue;
    M.cyl('metal', x, 0, z, 0.035, 0.9, N.YELLOW, 6);
    M.box('metal', x, 0.82, z, 0.24, 0.16, 0.02, N.YELLOW, a);
  }
}
// energy storage (5x4): battery cabinets with louvres and status lights,
// the regenerative fuel cell stack in foil with its hydrogen and oxygen
// tanks, a radiator
export function powerbank(M) {
  plinth(M, 5, 4);
  M.box('metal', -0.6, 0.06, -0.95, 3.9, 0.12, 1.1, N.STEEL);
  for (let i = 0; i < 4; i++) {
    const x = -2.0 + i * 0.95;
    M.box('shell', x, 0.92, -0.95, 0.88, 1.6, 0.9, N.SHELL);
    for (let k = 0; k < 6; k++) M.box('metal', x, 0.42 + k * 0.17, -1.405, 0.6, 0.04, 0.02, 0x9a9890);
    M.box('emissive', x + 0.3, 1.55, -1.405, 0.06, 0.06, 0.02, L.green);
    M.box('emissive', x + 0.3, 1.45, -1.405, 0.06, 0.06, 0.02, i === 2 ? L.cyan : L.green);
    M.box('shell', x, 1.69, -0.95, 0.9, 0.06, 0.92, N.SHELL2);
  }
  M.col(-2.45, 0, -1.4, 1.35, 1.72, -0.5);
  tankH(M, -0.75, 0.62, 0.55, 2.8, 0.38, { band: 0xd25b3a });
  tankH(M, -0.75, 0.62, 1.4, 2.8, 0.34, { band: 0x5b8ec7 });
  M.col(-2.15, 0, 0.15, 0.65, 1.0, 1.8);
  avionics(M, 1.75, 0, 0.9, 0.9, 1.0, 1.2);
  pipe(M, [0.65, 0.62, 0.55], [1.3, 0.6, 0.55], 0.62, 0.04, 0xb8bec4);
  pipe(M, [0.65, 0.62, 1.4], [1.3, 0.6, 1.4], 0.62, 0.04, 0xb8bec4);
  radiatorWing(M, 2.2, -0.3, PI / 2, { w: 1.4, h: 1.5, y0: 0.35 });
  M.col(1.3, 0, 0.3, 2.2, 1.0, 1.5);
}

// ---------------------------------------------------------------- terraforming
// greenhouse-gas heater: a fluorocarbon plant feeding a glowing heat
// exchanger, its column venting; the big one adds a second column and a
// feedstock tank
export function heater(M, big = false) {
  const s = big ? 1.33 : 1;
  plinth(M, 3 * s, 3 * s);
  M.box('metal', 0, 0.1, 0, 2.7 * s, 0.2, 2.7 * s, N.STEEL);
  M.box('shell', -0.1 * s, 0.65, 0.85 * s, 1.5 * s, 0.9, 0.7 * s, N.SHELL);
  M.box('emissive', 0.35 * s, 0.85, 0.85 * s - 0.36 * s, 0.25, 0.06, 0.02, L.green);
  for (let i = 0; i < 6; i++) {
    const x = (-0.95 + i * 0.38) * s;
    M.box('metal', x, 1.05 * s, -0.45 * s, 0.07, 1.5 * s, 1.3 * s, 0x9a9fa5);
    if (i < 5) M.box('emissive', x + 0.19 * s, 1.05 * s, -0.45 * s, 0.04, 1.3 * s, 1.1 * s, L.orange);
  }
  M.box('metal', 0, 1.84 * s, -0.45 * s, 2.1 * s, 0.1, 1.45 * s, N.FRAME);
  M.box('metal', 0, 0.28 * s, -0.45 * s, 2.1 * s, 0.1, 1.45 * s, N.FRAME);
  processColumn(M, 0.95 * s, 0.85 * s, 0.24 * s, 2.6 * s, { y0: 0.2, yaw: PI });
  if (big) { processColumn(M, -1.1 * s, 0.95 * s, 0.2 * s, 2.2 * s, { y0: 0.2, yaw: PI }); tankV(M, 1.22 * s, -1.25 * s, 0.2 * s, 1.3, { y0: 0.2, band: N.ORANGE }); }
  pipe(M, [0.95 * s, 0.6, 0.85 * s - 0.24 * s], [0.6 * s, 0.6, 0.1 * s], 0.6, 0.05, 0xb8bec4);
  M.vent(0, 2.0 * s, -0.45 * s, { rate: 0.5, size: 0.8, kind: 'heat' });
  M.light(0, 2.3 * s, -0.45 * s, L.orange, big ? 8 : 5, big ? 11 : 8);
  M.col(-1.2 * s, 0, -1.2 * s, 1.2 * s, 1.9 * s, 0.3 * s);
  M.col(-0.85 * s, 0, 0.5 * s, 0.65 * s, 1.1, 1.2 * s);
}
// atmosphere drill: a derrick turning a drill string into a deep borehole
// that releases trapped volatiles; compressor skid and gas receivers, the
// exhaust at the crown
export function drill(M, big = false) {
  const s = big ? 1.33 : 1, H = big ? 7.2 : 5.2;
  plinth(M, 3 * s, 3 * s);
  grating(M, 0, 0.25, 0, 2.7 * s, 2.7 * s);
  derrick(M, -0.25 * s, -0.25 * s, H, 1.5 * s);
  const bit = M.animGroup('metal', { pivot: [-0.25 * s, 0, -0.25 * s], axis: [0, 1, 0], speed: 3.0 });
  bit.add(new THREE.CylinderGeometry(0.11, 0.11, H - 0.6, 10), { pos: v(-0.25 * s, (H - 0.6) / 2 + 0.3, -0.25 * s), color: striped([0.6, 0.62, 0.65], [0.34, 0.35, 0.37], 2) });
  bit.add(new THREE.BoxGeometry(0.52, 0.12, 0.12), { pos: v(-0.25 * s, 0.55, -0.25 * s), color: [0.82, 0.42, 0.12] });
  M.box('metal', 0.85 * s, 0.6, 0.85 * s, 0.75 * s, 0.7, 0.6 * s, 0x3a6aa0);
  M.cyl('metal', 0.85 * s, 0.6, 0.55 * s, 0.14, 0.3, N.DARK, 10);
  tankV(M, 0.95 * s, -0.8 * s, 0.25 * s, 1.35 * s, { y0: 0.25, band: N.ORANGE });
  if (big) tankV(M, -1.05 * s, 0.95 * s, 0.25 * s, 1.35 * s, { y0: 0.25, band: N.ORANGE });
  pipe(M, [-0.25 * s, 0.5, -0.25 * s + 0.2], [0.85 * s, 0.8, 0.55 * s], 0.5, 0.05, 0xb8bec4);
  pipe(M, [0.85 * s, 0.9, 0.55 * s], [0.95 * s, 1.6, -0.8 * s], 1.2, 0.05, 0xb8bec4);
  M.vent(-0.25 * s, H + 0.6, -0.25 * s, { rate: big ? 1.6 : 1.0, size: big ? 1.2 : 0.9, kind: 'exhaust' });
  M.col(0.85 * s - 0.4 * s, 0, 0.85 * s - 0.35 * s, 0.85 * s + 0.4 * s, 0.95, 0.85 * s + 0.35 * s);
}
// small grow tube (2.4x2.4): plant racks under magenta light in a clear
// pressure tube, its controller and water bottle
export function vegetube(M) {
  plinth(M, 2.4, 2.4);
  growTube(M, 0, 0.78, -0.15, 2.1, 0.58, 0);
  avionics(M, 0.6, 0, 0.85, 0.5, 0.42, 0.34);
  tankV(M, -0.65, 0.85, 0.2, 0.75, { y0: 0.05, band: BLUE });
}
// moss seeder (3x3): a spore culture tank and its pump skid feeding a mast
// whose boom of atomiser nozzles turns slowly
export function seeder(M) {
  plinth(M, 3, 3);
  tankV(M, -0.75, 0.6, 0.48, 1.7, { y0: 0.25, band: GREEN });
  M.box('metal', 0.6, 0.3, 0.9, 0.8, 0.5, 0.55, 0x3a6aa0);
  M.cyl('metal', 0.6, 0.55, 0.62, 0.12, 0.25, N.DARK, 10);
  avionics(M, -0.8, 0, -0.95, 0.6, 0.55, 0.45);
  const mx = 0.55, mz = -0.45;
  M.cyl('metal', mx, 0, mz, 0.38, 0.1, N.DARK, 14);
  M.cyl('metal', mx, 0, mz, 0.09, 4.1, N.FRAME, 10);
  for (const [dx, dz] of [[0.45, 0], [-0.3, 0.35], [-0.3, -0.35]]) strut(M, [mx + dx, 0.08, mz + dz], [mx, 1.6, mz], 0.05, N.FRAME);
  pipe(M, [-0.75, 1.95, 0.6], [mx, 2.6, mz], 2.2, 0.035, GREEN);
  const spin = M.animGroup('shell', { pivot: [mx, 0, mz], axis: [0, 1, 0], speed: 1.1 });
  spin.add(new THREE.CylinderGeometry(0.16, 0.16, 0.3, 14), { pos: v(mx, 4.2, mz), color: N.SHELL });
  for (const sx of [-1, 1]) {
    spin.add(new THREE.BoxGeometry(1.1, 0.11, 0.12), { pos: v(mx + sx * 0.6, 4.18, mz), color: N.SHELL });
    gStrut(spin, [mx + sx * 0.12, 4.4, mz], [mx + sx * 1.05, 4.2, mz], 0.025, N.FRAME);
    for (const t of [0.5, 0.85, 1.12]) {
      spin.add(new THREE.CylinderGeometry(0.035, 0.05, 0.14, 8), { pos: v(mx + sx * t, 4.07, mz), color: 0x3a3f45 });
      spin.add(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 8), { pos: v(mx + sx * t, 3.99, mz), color: [0.18, 0.56, 0.29] });
    }
  }
  M.sphere('blink', mx, 4.45, mz, 0.05, L.green, 6);
  M.colCyl(mx, mz, 0.2, 0, 4.1);
}
// algae raft (3x3): floats on shallow water (y = 0 is the water line):
// clear membrane bags of green culture lie on the water in a pontoon frame,
// the pump and sensor deck at one end, a small array and a mast light
export function algae(M) {
  for (const sx of [-1, 1]) {
    M.add('shell', new THREE.CylinderGeometry(0.28, 0.28, 2.7, 18), { pos: v(sx * 1.3, -0.04, 0), rot: e(PI / 2, 0, 0), color: N.SHELL });
    for (const sz of [-1, 1]) M.add('shell', new THREE.SphereGeometry(0.28, 16, 10), { pos: v(sx * 1.3, -0.04, sz * 1.35), scale: v(1, 1, 0.7), color: N.SHELL });
    M.add('shell', new THREE.CylinderGeometry(0.285, 0.285, 0.3, 18, 1, true), { pos: v(sx * 1.3, -0.04, 0), rot: e(PI / 2, 0, 0), color: N.ORANGE });
  }
  for (const z of [-1.3, 0, 1.3]) M.box('metal', 0, 0.28, z, 2.9, 0.08, 0.1, N.STEEL);
  for (const sx of [-1, 1]) M.box('metal', sx * 1.3, 0.28, 0, 0.1, 0.08, 2.7, N.STEEL);
  for (let i = 0; i < 4; i++) {
    const x = -0.72 + i * 0.48;
    const core = new THREE.CapsuleGeometry(0.19, 1.6, 6, 14); core.rotateX(PI / 2); core.scale(1, 0.42, 1);
    M.add('plant', core, { pos: v(x, 0.03, 0.25), color: 0x2f7a35 });
    const skin = new THREE.CapsuleGeometry(0.205, 1.62, 6, 14); skin.rotateX(PI / 2); skin.scale(1, 0.46, 1);
    M.add('window', skin, { pos: v(x, 0.03, 0.25) });
    M.add('metal', new THREE.CylinderGeometry(0.02, 0.02, 0.5, 5), { pos: v(x, 0.18, -0.85), rot: e(PI / 2 - 0.3, 0, 0), color: 0x2a2d31 });
  }
  grating(M, 0, 0.36, -1.2, 2.9, 0.55);
  avionics(M, -0.75, 0.36, -1.2, 0.6, 0.45, 0.4);
  M.box('metal', 0.35, 0.58, -1.2, 0.5, 0.42, 0.38, 0x3a6aa0);
  M.cyl('metal', 0.35, 0.36, -0.98, 0.08, 0.3, N.DARK, 8);
  M.cyl('metal', 1.15, 0.36, -1.2, 0.04, 1.6, N.FRAME, 6);
  M.add('solar', new THREE.BoxGeometry(0.9, 0.04, 0.6), { pos: v(1.15, 1.5, -0.95), rot: e(-0.45, 0, 0) });
  M.sphere('blink', 1.15, 2.0, -1.2, 0.05, L.orange, 6);
  M.col(-1.6, -0.6, -1.6, 1.6, 0.36, 1.6);
}
// tree spreader (4x4): a geodesic nursery of saplings, the seed drone's pad
// with the drone parked, a weather mast
export function treespreader(M) {
  plinth(M, 4, 4);
  const gx = -0.5, gz = 0.4;
  M.cyl('plant', gx, 0.02, gz, 1.4, 0.06, 0x4a6b2f, 24);
  for (const [x, z, s] of [[-0.6, -0.1, 1], [0.5, 0.6, 0.8], [0.1, -0.7, 0.9], [-0.3, 0.8, 0.7]]) {
    M.cyl('plant', gx + x, 0.05, gz + z, 0.04, 0.7 * s, 0x5a3b26, 5);
    M.sphere('plant', gx + x, 0.05 + 0.75 * s, gz + z, 0.3 * s, 0x3d7f3a, 9, 0.95);
  }
  geodesicDome(M, gx, gz, 1.5, { skirt: 0.3, detail: 1 });
  M.box('shell', gx, 0.62, gz - 1.6, 0.9, 1.24, 0.4, N.SHELL2);
  hatch(M, gx, 0.02, gz - 1.8, PI, { w: 0.6, h: 1.05, depth: 0.1, label: false });
  M.cyl('concrete', 1.25, 0, -1.25, 0.62, 0.08, 0x8f8a84, 22);
  M.add('concrete', new THREE.RingGeometry(0.42, 0.5, 24), { pos: v(1.25, 0.09, -1.25), rot: e(-PI / 2, 0, 0), color: 0xd9b23a });
  M.box('shell', 1.25, 0.26, -1.25, 0.32, 0.12, 0.32, N.SHELL);
  M.box('mli', 1.25, 0.17, -1.25, 0.2, 0.08, 0.2, 0x3d7f3a);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    M.box('metal', 1.25 + sx * 0.16, 0.28, -1.25 + sz * 0.16, 0.26, 0.03, 0.03, N.DARK, PI / 4 * sx * sz);
    M.cyl('metal', 1.25 + sx * 0.27, 0.29, -1.25 + sz * 0.27, 0.13, 0.01, 0x22262b, 12);
  }
  instrumentMast(M, 1.5, 1.4, 3.6);
  avionics(M, 1.4, 0, 0.5, 0.5, 0.5, 0.4);
}
// insect habitat (6x6): a geodesic dome of flowering plants and hive boxes
// for the pollinators, a vestibule, its climate box
export function insectdome(M) {
  plinth(M, 6, 6);
  M.cyl('plant', 0, 0.02, 0.2, 2.5, 0.06, 0x587a35, 32);
  for (let i = 0; i < 16; i++) { const a = i * 2.4, r = 0.55 + (i % 4) * 0.45; M.sphere('plant', Math.cos(a) * r, 0.24, 0.2 + Math.sin(a) * r, 0.24, [0xd9a62a, 0xc94a8a, 0xe8e3d8, 0x3d7f3a][i % 4], 7, 0.7); }
  for (const x of [-0.5, 0.5]) { M.box('shell', x, 0.35, 0.5, 0.4, 0.5, 0.35, 0xe2b42a); M.box('metal', x, 0.63, 0.5, 0.46, 0.04, 0.4, N.FRAME); }
  geodesicDome(M, 0, 0.2, 2.6, { skirt: 0.35, detail: 2 });
  M.box('shell', 0, 0.8, 0.2 - 2.75, 1.2, 1.6, 0.6, N.SHELL2);
  hatch(M, 0, 0.02, 0.2 - 3.05, PI, { w: 0.8, h: 1.35, depth: 0.12, label: false });
  avionics(M, 2.4, 0, -2.4, 0.6, 0.6, 0.5);
  pipe(M, [2.1, 0.4, -2.4], [1.6, 0.3, -1.6], 0.4, 0.06, 0xb8bec4);
}
// orbital mirror uplink (8x8): a phased-array beam director on an alt-az
// pedestal that commands the mirrors in orbit and turns slowly to follow
// them; a control shelter with its radiator; the cable tray between
export function mirror(M) {
  plinth(M, 8, 8);
  phasedArray(M, 0, 0.4, { s: 1.0, speed: 0.1 });
  // control shelter, radiator, cable tray, masts
  M.box('shell', -2.6, 1.15, -2.7, 2.2, 2.3, 1.8, N.SHELL);
  M.box('shell', -2.6, 2.35, -2.7, 2.3, 0.1, 1.9, N.SHELL2);
  hatch(M, -2.0, 0.02, -2.7 - 0.9, PI, { w: 0.8, h: 1.75, depth: 0.12 });
  avionics(M, -3.0, 2.4, -2.7, 0.9, 0.4, 0.8);
  radiatorWing(M, -3.75, -1.6, PI / 2, { w: 1.4, h: 1.4, y0: 0.4 });
  M.col(-3.7, 0, -3.6, -1.5, 2.4, -1.8);
  M.box('metal', -0.75, 0.08, -1.25, 0.3, 0.12, 2.4, N.STEEL, 0.9);
  floodMast(M, 3.3, -3.3, 5.5, -PI * 0.75);
  instrumentMast(M, 3.3, 3.2, 4.0);
}

// ---------------------------------------------------------------- industry
// automated mine (5x5): a drill rig right over the deposit with a turning
// drill string and cutter head, a bucket elevator up to the ore hopper, the
// ore bin under it, controls
export function extractor(M) {
  plinth(M, 5, 5);
  derrick(M, 0, 0, 5.4, 1.9);
  const head = M.animGroup('metal', { pivot: [0, 0, 0], axis: [0, 1, 0], speed: 4.0 });
  head.add(new THREE.CylinderGeometry(0.17, 0.17, 3.6, 12), { pos: v(0, 2.45, 0), color: striped([0.55, 0.57, 0.6], [0.3, 0.31, 0.33], 2.5) });
  head.add(new THREE.ConeGeometry(0.5, 0.7, 10), { pos: v(0, 0.35, 0), rot: e(PI, 0, 0), color: [0.75, 0.55, 0.2] });
  for (let k = 0; k < 4; k++) { const a = k * PI / 2; head.add(new THREE.BoxGeometry(0.08, 0.45, 0.22), { pos: v(Math.sin(a) * 0.42, 0.5, Math.cos(a) * 0.42), rot: e(0, a, 0), color: [0.88, 0.7, 0.16] }); }
  strut(M, [0.35, 0.45, 0], [1.6, 2.35, 0], 0.42, 0x3a3f45);
  strut(M, [0.35, 0.7, 0], [1.6, 2.6, 0], 0.05, N.YELLOW);
  M.add('metal', new THREE.CylinderGeometry(0.72, 0.3, 0.9, 4, 1, true), { pos: v(1.9, 2.75, 0), rot: e(0, PI / 4, 0), color: 0x9aa0a6 });
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) M.cyl('metal', 1.9 + sx * 0.52, 0, sz * 0.52, 0.05, 2.35, N.STEEL, 6);
  M.box('metal', 1.9, 0.42, 0, 0.95, 0.84, 0.95, 0x5b6168);
  M.col(1.35, 0, -0.6, 2.45, 3.2, 0.6);
  avionics(M, -1.8, 0, 1.8, 0.65, 0.65, 0.5);
  M.box('emissive', -1.8, 0.45, 1.8 - 0.26, 0.2, 0.06, 0.02, L.green);
  floodMast(M, -2.1, -2.1, 5.2, PI * 0.25);
  M.light(0, 3.9, 0, L.warm, 5, 9);
}
// regolith smelter (6x5): a molten-regolith electrolysis reactor in its
// insulated shell, glowing tap spout over the ingot moulds, the oxygen
// offtake to a receiver, exhaust stack
export function smelter(M) {
  plinth(M, 6, 5);
  const rx = -1.0, rz = 0.4;
  M.cyl('shell', rx, 0.2, rz, 1.3, 2.8, N.SHELL, 28);
  band(M, rx, rz, 1.3, 1.9, 0.3, N.ORANGE);
  for (const y of [0.4, 1.2, 2.6]) M.add('metal', new THREE.TorusGeometry(1.32, 0.05, 6, 32), { pos: v(rx, y, rz), rot: e(PI / 2, 0, 0), color: N.FRAME });
  M.cyl('metal', rx, 3.0, rz, 1.0, 0.3, N.DARK, 24);
  for (let k = 0; k < 6; k++) { const a = k / 6 * PI * 2; M.cyl('metal', rx + Math.sin(a) * 1.18, 0, rz + Math.cos(a) * 1.18, 0.06, 0.3, N.STEEL, 8); }
  M.add('metal', new THREE.BoxGeometry(0.9, 0.18, 0.3), { pos: v(rx + 1.5, 1.1, rz - 0.6), rot: e(0, 0, -0.25), color: 0x3a3f45 });
  M.box('emissive', rx + 1.75, 0.98, rz - 0.6, 0.35, 0.06, 0.18, L.orange);
  for (let i = 0; i < 3; i++) { M.box('metal', rx + 1.9 + i * 0.5, 0.25, rz - 0.6, 0.4, 0.2, 0.5, 0x3a3f45); M.box('emissive', rx + 1.9 + i * 0.5, 0.36, rz - 0.6, 0.3, 0.02, 0.38, i === 0 ? L.orange : 0x6a2a10); }
  M.light(rx + 1.8, 1.0, rz - 0.6, L.orange, 4, 6);
  pipe(M, [rx + 0.3, 3.3, rz + 0.3], [1.8, 2.3, 1.4], 3.6, 0.08, 0xb8bec4);
  tankV(M, 1.8, 1.4, 0.45, 1.8, { y0: 0.25, band: GREEN });
  M.cyl('metal', rx - 0.55, 3.3, rz + 0.55, 0.18, 2.6, N.FRAME, 10);
  M.cyl('metal', rx - 0.55, 5.9, rz + 0.55, 0.22, 0.12, N.DARK, 10);
  M.vent(rx - 0.55, 6.1, rz + 0.55, { rate: 1.4, size: 1.1, kind: 'exhaust' });
  avionics(M, 2.0, 0, -1.6, 0.6, 0.6, 0.5);
  M.colCyl(rx, rz, 1.35, 0, 3.3);
}
// robotic assembly (6x6): a hangar for the line, a robot arm on a rail
// outside that turns between the part racks and the door
export function assembler(M) {
  plinth(M, 6, 6);
  hangar(M, -0.8, 0.6, 3.6, 4.6, 3.2, 0, { stripe: BLUE });
  M.box('metal', 2.2, 0.15, 0.6, 0.4, 0.3, 4.4, N.STEEL);
  M.box('metal', 2.2, 0.42, -0.4, 0.6, 0.25, 0.6, N.DARK);
  const arm = M.animGroup('shell', { pivot: [2.2, 0, -0.4], axis: [0, 1, 0], speed: 0.55 });
  arm.add(new THREE.CylinderGeometry(0.22, 0.25, 0.3, 16), { pos: v(2.2, 0.7, -0.4), color: N.ORANGE });
  gStrut(arm, [2.2, 0.8, -0.4], [2.3, 1.95, -0.15], 0.2, N.ORANGE);
  arm.add(new THREE.SphereGeometry(0.15, 12, 8), { pos: v(2.3, 1.98, -0.15), color: 0x3a3f45 });
  gStrut(arm, [2.3, 1.98, -0.15], [2.1, 2.25, 0.45], 0.16, N.ORANGE);
  arm.add(new THREE.BoxGeometry(0.22, 0.22, 0.3), { pos: v(2.08, 2.15, 0.55), color: 0x3a3f45 });
  for (const s of [-1, 1]) arm.add(new THREE.BoxGeometry(0.04, 0.2, 0.04), { pos: v(2.08 + s * 0.07, 1.97, 0.6), color: N.FRAME });
  for (let i = 0; i < 2; i++) { M.box('metal', 2.4, 0.8 + i * 0.8, 2.3, 0.9, 0.05, 1.1, N.STEEL); M.box('foil', 2.4, 1.0 + i * 0.8, 2.3, 0.5, 0.35, 0.5, 0xd8a640); }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) M.cyl('metal', 2.4 + sx * 0.42, 0, 2.3 + sz * 0.52, 0.03, 1.7, N.FRAME, 6);
  M.col(1.9, 0, 1.7, 2.9, 1.7, 2.9);
  floodMast(M, -2.6, -2.6, 5, PI * 0.8);
}
// drone port (5x5): two landing pads, a parked quad drone, a charging
// mast, the hangar box and the traffic radar that turns on its mast
export function dronehub(M) {
  plinth(M, 5, 5);
  for (const [x, z] of [[-1.2, -1.2], [1.2, -1.2]]) {
    M.cyl('concrete', x, 0, z, 0.9, 0.06, 0x8f8a84, 24);
    M.add('concrete', new THREE.RingGeometry(0.6, 0.7, 24), { pos: v(x, 0.07, z), rot: e(-PI / 2, 0, 0), color: 0xd9b23a });
    for (let i = 0; i < 4; i++) { const a = i / 4 * PI * 2 + PI / 4; M.sphere('blink', x + Math.cos(a) * 0.85, 0.1, z + Math.sin(a) * 0.85, 0.04, L.cyan, 6); }
  }
  const dx = -1.2, dz = -1.2;
  M.box('shell', dx, 0.3, dz, 0.4, 0.14, 0.4, N.SHELL);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { M.box('metal', dx + sx * 0.22, 0.32, dz + sz * 0.22, 0.32, 0.03, 0.03, N.DARK, PI / 4 * sx * sz); M.cyl('metal', dx + sx * 0.36, 0.33, dz + sz * 0.36, 0.17, 0.01, 0x22262b, 12); }
  for (const sx of [-1, 1]) M.box('metal', dx + sx * 0.14, 0.12, dz, 0.03, 0.2, 0.36, N.DARK);
  M.box('shell', -0.2, 0.9, 1.5, 3.6, 1.8, 1.6, N.SHELL);
  M.box('shell', -0.2, 1.84, 1.5, 3.7, 0.08, 1.7, N.SHELL2);
  M.box('metal', -0.2, 0.85, 0.69, 2.4, 1.5, 0.04, 0xc9ccd0);
  for (let k = 1; k < 5; k++) M.box('metal', -0.2, k * 0.32, 0.665, 2.36, 0.025, 0.02, 0x9a9ea2);
  avionics(M, -1.2, 1.88, 1.6, 0.9, 0.35, 0.7);
  M.col(-2.0, 0, 0.7, 1.6, 1.88, 2.3);
  M.cyl('metal', 0, 0, -0.2, 0.06, 2.4, N.FRAME, 8);
  M.box('emissive', 0, 2.3, -0.2, 0.2, 0.1, 0.1, L.green);
  M.cyl('metal', 2.05, 0, 2.05, 0.1, 2.6, N.FRAME, 8);
  M.cyl('metal', 2.05, 2.55, 2.05, 0.2, 0.12, N.DARK, 12);
  const radar = M.animGroup('shell', { pivot: [2.05, 0, 2.05], axis: [0, 1, 0], speed: 1.0 });
  radar.add(new THREE.BoxGeometry(1.0, 0.3, 0.06), { pos: v(2.05, 2.95, 2.05), color: N.SHELL });
  radar.add(new THREE.BoxGeometry(0.12, 0.25, 0.12), { pos: v(2.05, 2.72, 2.05), color: N.DARK });
  M.colCyl(2.05, 2.05, 0.12, 0, 2.6);
  M.light(0, 2.0, 0, L.cyan, 3, 8);
}
// logistics depot (6x6): racks of cargo containers and bags, a light gantry
export function depot(M) {
  plinth(M, 6, 6);
  for (const z of [-1.4, 1.2]) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) M.cyl('metal', sx * 2.4, 0, z + sz * 0.7, 0.05, 2.4, N.FRAME, 6);
    for (const y of [0.1, 1.2, 2.3]) M.box('metal', 0, y, z, 5.0, 0.06, 1.5, N.STEEL);
    for (let i = 0; i < 4; i++) for (let k = 0; k < 2; k++) {
      const x = -1.8 + i * 1.2;
      if ((i + k + (z > 0 ? 1 : 0)) % 3 === 0) { if (k === 0) cargoBags(M, x, z, 4, 0); }
      else M.box(k ? 'foil' : 'shell', x, 0.6 + k * 1.1, z, 1.0, 0.9, 1.2, k ? 0xd8a640 : N.SHELL);
    }
    M.col(-2.5, 0, z - 0.75, 2.5, 2.4, z + 0.75);
  }
  for (const sx of [-1, 1]) strut(M, [sx * 2.8, 0, -2.6], [sx * 2.8, 3.6, -2.6], 0.12, N.ORANGE);
  M.box('metal', 0, 3.6, -2.6, 5.8, 0.2, 0.2, N.ORANGE);
  M.box('metal', 0.6, 3.4, -2.6, 0.5, 0.3, 0.4, N.DARK);
  M.cyl('metal', 0.6, 2.4, -2.6, 0.015, 1.0, N.STEEL, 4);
  M.box('metal', 0.6, 2.35, -2.6, 0.3, 0.1, 0.3, N.YELLOW);
  floodMast(M, 2.8, 2.8, 5, -PI * 0.75);
}

// deep-space communicator (8x8): a big steerable dish that talks to the
// ships on the way, the equipment shelter with its radiator, a cable trench,
// a timing mast and a floodlight
export function comms(M) {
  plinth(M, 8, 8);
  dishAntenna(M, 0.3, 0.6, { s: 1.15, speed: 0.05 });
  M.box('shell', -2.7, 1.05, -2.9, 2.0, 2.1, 1.6, N.SHELL);
  M.box('shell', -2.7, 2.15, -2.9, 2.1, 0.1, 1.7, N.SHELL2);
  hatch(M, -2.3, 0.02, -2.9 - 0.8, PI, { w: 0.8, h: 1.7, depth: 0.12 });
  avionics(M, -3.1, 2.2, -2.9, 0.8, 0.4, 0.8);
  radiatorWing(M, -3.75, -1.95, PI / 2, { w: 1.3, h: 1.3, y0: 0.35 });
  M.col(-3.7, 0, -3.7, -1.7, 2.2, -2.1);
  M.box('metal', -1.4, 0.06, -1.3, 0.4, 0.12, 2.6, N.STEEL, 0.75);
  for (let i = 0; i < 4; i++) M.box('metal', -1.95 + i * 0.4, 0.13, -2.05 + i * 0.5, 0.42, 0.02, 0.05, N.DARK, 0.75);
  instrumentMast(M, 3.4, -3.3, 4.6);
  floodMast(M, 3.4, 3.4, 5.5, -PI * 0.75);
  M.light(-2.3, 1.9, -4.2, L.white, 1.2, 6);
}
