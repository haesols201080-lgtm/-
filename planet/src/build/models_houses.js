// Homes of the colony in the agency's hardware language, two designs per
// population tier, growing from one pressure vessel shared by the first crew
// to diagrid towers, and finally to open-air homes once the air can be
// breathed. Same frame as everything else: 8x8 plot, front = -z, y = 0 at
// the plot; each home has its entrance (porch and ramp) on the front.
import * as THREE from 'three';
import { L, v, e, plinth, railing } from './modelkit.js';
import { strut } from './starkit.js';
import {
  N, hatch, vessel, tubeModule, node, inflatable, cupola, hangar, deployFrame, grating, ramp, avionics, bottleRack,
  tankV, radiatorWing, rosa, instrumentMast, cargoBags, geodesicDome, viewBand, growTube, viewport,
} from './nasakit.js';
import { porch, pipe, beacon } from './models_agency.js';
import { glazedPorch, lifeAround } from './models_nasa.js';

const PI = Math.PI;
const GREEN = 0x2f8f4a, BLUE = 0x2a5db0, TEAL = 0x2a8a8a, AMBER = 0xe2b42a, RUST = 0xb5562a;

// ---------------------------------------------------------------- shared kit
// pressurised tunnel between two points at height y, rings at both ends
function tunnel(M, ax, az, bx, bz, y, r = 0.5) {
  const len = Math.hypot(bx - ax, bz - az), yaw = Math.atan2(bz - az, bx - ax);
  M.add('shell', new THREE.CylinderGeometry(r, r, len, 24), { pos: v((ax + bx) / 2, y, (az + bz) / 2), rot: new THREE.Euler(0, -yaw, PI / 2, 'YXZ'), color: N.SHELL2 });
  for (const t of [0.12, 0.88]) M.add('metal', new THREE.TorusGeometry(r + 0.03, 0.05, 6, 24), { pos: v(ax + (bx - ax) * t, y, az + (bz - az) * t), rot: e(0, PI / 2 - yaw, 0), color: N.FRAME });
  M.col(Math.min(ax, bx) - r * Math.abs(Math.sin(yaw)), y - r, Math.min(az, bz) - r * Math.abs(Math.cos(yaw)), Math.max(ax, bx) + r * Math.abs(Math.sin(yaw)), y + r, Math.max(az, bz) + r * Math.abs(Math.cos(yaw)));
}
// path lights either side of the ramp foot
function pathLights(M, x, z, w = 1.0) {
  for (const s of [-1, 1]) { M.cyl('metal', x + s * w, 0, z, 0.045, 0.62, N.STEEL, 8); M.box('emissive', x + s * w, 0.6, z, 0.1, 0.05, 0.1, L.warm); }
}
// household number plate beside the door
function plate(M, x, y, z, color = BLUE) {
  M.box('shell', x, y, z, 0.42, 0.18, 0.03, color);
  M.box('emissive', x + 0.12, y, z - 0.016, 0.1, 0.06, 0.01, L.warm);
}
// planter box with a shrub (open-air homes)
function planter(M, x, z, w = 1.2, d = 0.5, k = 0) {
  M.box('metal', x, 0.25, z, w, 0.5, d, N.STEEL);
  M.box('plant', x, 0.52, z, w - 0.08, 0.06, d - 0.08, 0x3b2a1e);
  for (let i = 0; i < Math.max(1, Math.round(w / 0.45)); i++) M.sphere('plant', x - w / 2 + 0.25 + i * 0.45, 0.72, z, 0.24, [0x3d7f3a, 0x4f8a3a, 0xc99a2e, 0x2f6b34][(i + k) % 4], 8, 0.8);
  M.col(x - w / 2, 0, z - d / 2, x + w / 2, 0.55, z + d / 2);
}
// slatted pergola on four posts
function pergola(M, x, z, w, d, h = 2.6) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) M.cyl('metal', x + sx * (w / 2 - 0.08), 0, z + sz * (d / 2 - 0.08), 0.06, h, N.FRAME, 8);
  for (const sz of [-1, 1]) M.box('metal', x, h, z + sz * (d / 2 - 0.08), w, 0.12, 0.08, N.FRAME);
  for (let i = 0; i < Math.round(w / 0.35); i++) M.box('shell', x - w / 2 + 0.17 + i * 0.35, h + 0.1, z, 0.08, 0.08, d + 0.2, N.SHELL2);
}
// a tree in a sunken bed (open-air homes)
function tree(M, x, z, h = 2.4, r = 0.95, k = 0) {
  M.cyl('plant', x, 0, z, 0.5, 0.06, 0x3b2a1e, 14);
  M.cyl('plant', x, 0, z, 0.08, h - 0.2, 0x5a3b26, 6);
  M.sphere('plant', x, h, z, r, k % 2 ? 0x3d7f3a : 0x2f6b34, 10, 0.85);
  M.sphere('plant', x + r * 0.4, h - 0.25, z - r * 0.25, r * 0.6, 0x47843d, 8, 0.85);
  M.colCyl(x, z, 0.12, 0, h);
}
// steel diagrid tower around a composite drum with a glazed band on every
// floor; ring beams and nodes where the helices cross
function diagridTower(M, x, z, { r = 2.6, H = 26, y0 = 3.8, fh = 3.2, twist = 0.6, n = 8, seed = 0 } = {}) {
  const floors = Math.floor((H - y0) / fh);
  for (let i = 0; i < floors; i++) {
    const yy = y0 + i * fh;
    M.add('shell', new THREE.CylinderGeometry(r, r, fh * 0.36, 48, 1, true), { pos: v(x, yy + fh * 0.18, z), color: N.SHELL });
    M.add('glass', new THREE.CylinderGeometry(r - 0.06, r - 0.06, fh * 0.64, 48, 1, true), { pos: v(x, yy + fh * 0.36 + fh * 0.32, z) });
    M.add('metal', new THREE.TorusGeometry(r + 0.02, 0.06, 6, 48), { pos: v(x, yy, z), rot: e(PI / 2, 0, 0), color: N.FRAME });
    for (let k = 0; k < 12; k++) { const a = k / 12 * PI * 2 + seed; M.box('metal', x + Math.sin(a) * (r - 0.02), yy + fh * 0.68, z + Math.cos(a) * (r - 0.02), 0.06, fh * 0.64, 0.06, N.FRAME, a); }
  }
  const top = y0 + floors * fh;
  M.add('metal', new THREE.TorusGeometry(r + 0.02, 0.07, 6, 48), { pos: v(x, top, z), rot: e(PI / 2, 0, 0), color: N.FRAME });
  const R2 = r + 0.32;
  for (const dir of [1, -1]) for (let k = 0; k < n; k++) {
    const pts = [];
    for (let i = 0; i <= 14; i++) { const t = i / 14, a = k / n * PI * 2 + dir * t * PI * twist + seed; pts.push([x + Math.cos(a) * R2, y0 + t * (top - y0), z + Math.sin(a) * R2]); }
    M.tube('metal', pts, 0.11, 0x7d838a, 6);
  }
  const dt = 1 / (n * twist);
  for (let j = 0; j * dt <= 1.0001; j++) {
    const t = j * dt, yy = y0 + t * (top - y0);
    M.add('metal', new THREE.TorusGeometry(R2, 0.07, 6, 48), { pos: v(x, yy, z), rot: e(PI / 2, 0, 0), color: N.STEEL });
    for (let k = 0; k < n; k++) { const a = k / n * PI * 2 + t * PI * twist + seed; M.sphere('metal', x + Math.cos(a) * R2, yy, z + Math.sin(a) * R2, 0.19, N.DARK, 8); }
  }
  M.colCyl(x, z, R2, y0, top);
  return top;
}

// ---------------------------------------------------------------- tier 0: pioneers
// one rigid pressure vessel with a soft loft, shared by the first crew:
// roll-out array, radiator, gas bottles, avionics and stowed bags around it
export function house0(M) {
  plinth(M, 8, 8);
  const vx = 0.3, vz = 0.9;
  deployFrame(M, vx, vz, 4.3, 4.3, 0.62);
  vessel(M, vx, vz, { r: 2.3, h: 3.0, y0: 0.62, loft: 1.5, hatches: [PI], ports: [{ a: PI * 0.72 }, { a: PI * 1.28 }, { a: PI / 2 }, { a: -PI / 2 }, { a: 0.3 }], segs: 8 });
  porch(M, vx, vz - 2.3, 0.62, { w: 1.5, d: 0.9, run: 1.3 });
  plate(M, vx + 0.95, 2.35, vz - 2.36);
  pathLights(M, vx, -3.75);
  rosa(M, -2.75, -2.7, 4.3, 0, { span: 0.85, height: 1.4 });
  radiatorWing(M, 3.15, 3.3, PI / 2, { w: 1.5, h: 1.5, y0: 0.4 });
  bottleRack(M, -3.15, 1.8, PI / 2, 3);
  avionics(M, 3.0, 0, -2.4, 0.7, 0.6, 0.5);
  cargoBags(M, -2.95, -0.55, 2, PI / 2);
  pipe(M, [-2.9, 1.3, 1.8], [vx - 2.25, 1.3, vz + 0.5], 1.3, 0.035, 0xb8bec4);
  M.entry(vx);
}
// a soft-goods expandable module on its frame, entered through a rigid
// airlock; array, radiator, oxygen tanks
export function house0b(M) {
  plinth(M, 8, 8);
  deployFrame(M, 0.4, 1.6, 5.8, 2.8, 0.5);
  inflatable(M, 0.4, 2.0, 1.6, 5.6, 1.5, 0);
  for (const x of [-1.6, 2.3]) viewport(M, x, 2.25, 1.6 - 1.47, PI, 0.18);
  tubeModule(M, 0.4, 1.45, -0.65, 1.5, 0.85, PI / 2, { ribs: 2, ports: 0 });
  porch(M, 0.4, -1.6, 0.6, { w: 1.3, d: 0.8, run: 1.4 });
  plate(M, 1.05, 1.85, -1.55);
  pathLights(M, 0.4, -3.8, 0.9);
  rosa(M, 2.9, -2.3, 4.2, 0, { span: 0.75, height: 1.4 });
  radiatorWing(M, -3.6, -0.2, PI / 2, { w: 1.4, h: 1.5, y0: 0.3 });
  tankV(M, -2.75, -2.6, 0.3, 1.3, { y0: 0.2, band: GREEN });
  tankV(M, -2.0, -3.0, 0.26, 1.1, { y0: 0.2, band: 0x1a1a1a });
  instrumentMast(M, 3.5, 3.6, 3.6);
  avionics(M, -3.3, 0, 3.5, 0.6, 0.5, 0.4);
  M.entry(0.4);
}

// ---------------------------------------------------------------- tier 1: settlers
// the family home: the vessel, a galley module joined by a short tunnel, a
// garden tube out front
export function house1(M) {
  plinth(M, 8, 8);
  const vx = -1.2, vz = 1.1;
  deployFrame(M, vx, vz, 4.1, 4.1, 0.6);
  vessel(M, vx, vz, { r: 2.15, h: 3.0, y0: 0.6, loft: 1.4, hatches: [PI], ports: [{ a: PI * 0.7 }, { a: -PI / 2 }, { a: -PI * 0.75 }], segs: 8 });
  tubeModule(M, 2.45, 1.25, 1.4, 3.3, 0.95, -PI / 2, { endHatch: false, ribs: 3, ports: 2 });
  tunnel(M, vx + 2.0, 1.4, 1.55, 1.4, 1.25, 0.48);
  growTube(M, 2.45, 0.85, -2.05, 2.6, 0.55, 0);
  porch(M, vx, vz - 2.15, 0.6, { w: 1.4, d: 0.9, run: 1.4 });
  plate(M, vx + 0.9, 2.3, vz - 2.2, GREEN);
  pathLights(M, vx, -3.75, 0.9);
  tankV(M, -3.45, 3.45, 0.28, 1.2, { y0: 0.2, band: GREEN });
  rosa(M, -2.95, -2.6, 4.2, 0, { span: 0.7, height: 1.3 });
  avionics(M, 3.45, 0, -0.85, 0.5, 0.5, 0.4);
  radiatorWing(M, 0.6, 3.75, 0, { w: 1.3, h: 1.2, y0: 0.35 });
  M.entry(vx);
}
// two vessels of different sizes joined by a tunnel; a cupola on the small
// one, a garden tube, tanks
export function house1b(M) {
  plinth(M, 8, 8);
  const ax = -1.5, az = 0.4, bx = 2.3, bz = 2.3;
  deployFrame(M, ax, az, 3.7, 3.7, 0.6);
  deployFrame(M, bx, bz, 2.9, 2.9, 0.6);
  vessel(M, ax, az, { r: 2.0, h: 2.9, y0: 0.6, loft: 1.3, hatches: [PI], ports: [{ a: -PI / 2 }, { a: PI * 0.75 }, { a: 0 }], segs: 8 });
  const capB = vessel(M, bx, bz, { r: 1.6, h: 2.6, y0: 0.6, loft: 0, hatches: [], ports: [{ a: PI * 0.8 }, { a: PI / 2 }], segs: 6, rot: 0.3 });
  cupola(M, bx, capB - 0.05, bz, 0.7);
  const d = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / d, uz = (bz - az) / d;
  tunnel(M, ax + ux * 1.9, az + uz * 1.9, bx - ux * 1.5, bz - uz * 1.5, 1.4, 0.48);
  growTube(M, 2.25, 0.8, -2.05, 2.6, 0.55, 0);
  porch(M, ax, az - 2.0, 0.6, { w: 1.4, d: 0.9, run: 1.4 });
  plate(M, ax + 0.85, 2.2, az - 2.05, AMBER);
  pathLights(M, ax, -3.85, 0.9);
  tankV(M, 3.45, -0.35, 0.28, 1.25, { y0: 0.2, band: GREEN });
  tankV(M, 3.45, 0.45, 0.24, 1.05, { y0: 0.2, band: 0x1a1a1a });
  radiatorWing(M, -3.6, 3.6, PI / 2, { w: 1.3, h: 1.4, y0: 0.35 });
  M.entry(ax);
}

// ---------------------------------------------------------------- tier 2: technicians
// a two-storey vessel with a window band and a cupola, a workshop garage
// with a roll-up door beside it
export function house2(M) {
  plinth(M, 8, 8);
  const vx = -1.6, vz = 1.3;
  deployFrame(M, vx, vz, 3.9, 3.9, 0.6);
  const cap = vessel(M, vx, vz, { r: 2.1, h: 5.0, y0: 0.6, loft: 0, hatches: [PI], ports: [{ a: PI * 0.72 }, { a: -PI / 2 }], segs: 10 });
  viewBand(M, vx, vz, 2.1, 3.35, 0.9, { from: PI * 0.62, to: PI * 1.38, n: 8 });
  cupola(M, vx, cap - 0.05, vz, 0.72);
  hangar(M, 2.2, 0.6, 2.8, 4.6, 3.0, 0, { stripe: N.ORANGE });
  M.box('metal', 2.2, 0.02, -2.3, 2.4, 0.04, 1.2, 0x5b6168);
  porch(M, vx, vz - 2.1, 0.6, { w: 1.4, d: 0.9, run: 1.4 });
  plate(M, vx + 0.9, 2.3, vz - 2.15);
  pathLights(M, vx, -3.75, 0.9);
  tankV(M, 3.3, 3.5, 0.26, 1.2, { y0: 0.2, band: GREEN });
  radiatorWing(M, -3.65, 3.9, PI / 2, { w: 1.4, h: 1.6, y0: 0.4 });
  instrumentMast(M, vx + 1.2, vz, cap + 1.6);
  M.entry(vx);
}
// a node with an entry module to the front, a long module to the side and
// a cupola on top; array and tanks
export function house2b(M) {
  plinth(M, 8, 8);
  const nx = -0.4, nz = 1.8, y = 1.3;
  node(M, nx, y, nz, 1.15, 2.4, 0, ['z-']);
  cupola(M, nx, y + 1.05, nz, 0.68);
  tubeModule(M, nx, y, nz - 1.15 - 1.1, 2.2, 1.0, PI / 2, { ribs: 2, ports: 0 });
  tubeModule(M, 2.3, y, nz, 2.4, 1.0, 0, { endHatch: false, ribs: 3, ports: 2 });
  tubeModule(M, -2.55, y, nz, 2.0, 1.0, 0, { endHatch: false, startHatch: false, ribs: 2, ports: 1 });
  deployFrame(M, nx, nz, 7.2, 2.0, 0.32);
  porch(M, nx, nz - 1.15 - 2.2 - 0.3, 0.45, { w: 1.3, d: 0.6, run: 1.15 });
  plate(M, nx + 0.75, 1.75, nz - 3.55, TEAL);
  pathLights(M, nx, -3.85, 0.85);
  rosa(M, nx, 3.75, 4.4, 0, { span: 1.0, height: 1.3 });
  tankV(M, 2.4, -1.4, 0.28, 1.2, { y0: 0.2, band: GREEN });
  tankV(M, 3.2, -1.4, 0.28, 1.2, { y0: 0.2, band: 0x1a1a1a });
  avionics(M, -2.8, 0, -1.6, 0.7, 0.6, 0.5);
  M.entry(nx);
}

// ---------------------------------------------------------------- tier 3: artisans
// the vessel and a workshop under a membrane canopy (bench, printer,
// stock in bags), a greenhouse tube along the back
export function house3(M) {
  plinth(M, 8, 8);
  const vx = -1.75, vz = 0.3;
  deployFrame(M, vx, vz, 3.9, 3.9, 0.6);
  vessel(M, vx, vz, { r: 2.05, h: 3.2, y0: 0.6, loft: 1.4, hatches: [PI], ports: [{ a: PI * 0.7 }, { a: -PI / 2 }, { a: 0 }], segs: 8 });
  porch(M, vx, vz - 2.05, 0.6, { w: 1.4, d: 0.8, run: 1.3 });
  plate(M, vx + 0.9, 2.4, vz - 2.1, RUST);
  pathLights(M, vx, -3.7, 0.9);
  // workshop canopy
  const wx = 2.1, wz = -0.6;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) M.cyl('metal', wx + sx * 1.55, 0, wz + sz * 1.45, 0.07, 2.7 + (sz > 0 ? 0.4 : 0), N.FRAME, 8);
  M.add('shell', new THREE.BoxGeometry(3.4, 0.08, 3.3), { pos: v(wx, 3.0, wz), rot: e(-0.12, 0, 0), color: N.SHELL2 });
  for (const sz of [-1, 1]) M.box('metal', wx, 2.75 + (sz > 0 ? 0.4 : 0), wz + sz * 1.45, 3.2, 0.1, 0.1, N.FRAME);
  M.bb('metal', wx - 1.3, 0.85, wz + 0.6, wx + 1.3, 0.92, wz + 1.25, N.STEEL);
  for (const sx of [-1.25, 1.25]) M.box('metal', wx + sx, 0.42, wz + 0.92, 0.06, 0.85, 0.6, N.FRAME);
  M.box('shell', wx - 0.7, 1.25, wz + 0.95, 0.6, 0.66, 0.5, N.SHELL);
  M.box('window', wx - 0.7, 1.25, wz + 0.69, 0.42, 0.4, 0.02);
  M.box('metal', wx + 0.5, 1.02, wz + 0.95, 0.5, 0.2, 0.3, RUST);
  cargoBags(M, wx + 0.9, wz - 1.0, 4, 0);
  M.col(wx - 1.3, 0, wz + 0.6, wx + 1.3, 0.92, wz + 1.25);
  M.light(wx, 2.6, wz, L.warm, 1.4, 6);
  growTube(M, 1.9, 0.85, 2.95, 3.6, 0.55, 0);
  tankV(M, -3.45, 3.3, 0.27, 1.2, { y0: 0.2, band: GREEN });
  rosa(M, -3.1, -2.6, 4.0, 0, { span: 0.55, height: 1.2 });
  M.entry(vx);
}
// an expandable module along the back, the entry vessel at the front left,
// a small geodesic garden dome and the potter's kiln
export function house3b(M) {
  plinth(M, 8, 8);
  deployFrame(M, 0.6, 2.4, 5.6, 2.4, 0.45);
  inflatable(M, 0.6, 1.75, 2.4, 5.6, 1.3, 0);
  const vx = -2.0, vz = -0.9;
  deployFrame(M, vx, vz, 3.0, 3.0, 0.5);
  vessel(M, vx, vz, { r: 1.6, h: 2.8, y0: 0.5, loft: 1.0, hatches: [PI], ports: [{ a: -PI / 2 }, { a: PI * 0.7 }], segs: 6 });
  tunnel(M, vx, vz + 1.5, vx, 2.4 - 1.2, 1.4, 0.45);
  geodesicDome(M, 1.95, -1.2, 1.55, { skirt: 0.3, detail: 1 });
  for (let i = 0; i < 6; i++) { const a = i * 1.05; M.sphere('plant', 1.95 + Math.cos(a) * 0.7, 0.45, -1.2 + Math.sin(a) * 0.7, 0.28, [0x3d7f3a, 0xc99a2e, 0x4f8a3a][i % 3], 8, 0.8); }
  tunnel(M, 1.95, -1.2 + 1.5, 1.95, 2.4 - 1.25, 0.9, 0.42);
  porch(M, vx, vz - 1.6, 0.5, { w: 1.3, d: 0.5, run: 0.95 });
  plate(M, vx + 0.75, 1.95, vz - 1.65, RUST);
  pathLights(M, vx + 1.3, -3.6, 0.0001);
  M.cyl('shell', 3.5, 0, -3.3, 0.38, 0.9, 0xd8c9b0, 14);
  M.cyl('metal', 3.5, 0.9, -3.3, 0.12, 0.6, N.DARK, 8);
  M.colCyl(3.5, -3.3, 0.38, 0, 0.9);
  radiatorWing(M, -3.7, 1.4, PI / 2, { w: 1.2, h: 1.3, y0: 0.3 });
  M.entry(vx);
}

// ---------------------------------------------------------------- tier 4: engineers
// a tall vessel with an upper window band; a module held out at the upper
// floor on a steel frame, a carport under it
export function house4(M) {
  plinth(M, 8, 8);
  const vx = -1.9, vz = 0.9;
  deployFrame(M, vx, vz, 3.6, 3.6, 0.6);
  const cap = vessel(M, vx, vz, { r: 1.95, h: 4.9, y0: 0.6, loft: 1.2, hatches: [PI], ports: [{ a: -PI / 2 }, { a: PI * 0.72 }], segs: 10 });
  viewBand(M, vx, vz, 1.95, 3.35, 0.95, { from: PI * 0.55, to: PI * 1.5, n: 8 });
  const my = 3.95;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) M.box('metal', 2.0 + sx * 1.4, (my - 0.9) / 2, 0.9 + sz * 1.0, 0.18, my - 0.9, 0.18, N.STEEL);
  for (const sz of [-1, 1]) M.box('metal', 2.0, my - 0.95, 0.9 + sz * 1.0, 3.0, 0.18, 0.2, N.STEEL);
  for (const sx of [-1, 1]) strut(M, [2.0 + sx * 1.4, 0.1, 0.9 + 1.0], [2.0 - sx * 1.4, my - 1.0, 0.9 + 1.0], 0.08, N.STEEL);
  tubeModule(M, 1.85, my, 0.9, 3.6, 0.95, 0, { saddles: false, ribs: 3, ports: 3, endHatch: false });
  M.box('metal', 2.0, 0.02, -0.6, 2.6, 0.04, 3.6, 0x5b6168);
  radiatorWing(M, 3.75, -1.0, PI / 2, { w: 1.4, h: 1.4, y0: 0.3 });
  rosa(M, 3.4, 3.4, my + 2.2, 0, { span: 0.4, height: 1.2 });
  porch(M, vx, vz - 1.95, 0.6, { w: 1.4, d: 0.8, run: 1.3 });
  plate(M, vx + 0.85, 2.4, vz - 2.0, BLUE);
  pathLights(M, vx, -3.7, 0.9);
  beacon(M, vx, cap + 0.05, vz, L.red);
  M.entry(vx);
}
// two tube modules crossed on two levels around a vertical stair core
export function house4b(M) {
  plinth(M, 8, 8);
  const cx = 0.3, cz = 1.0;
  deployFrame(M, cx, cz, 2.6, 2.6, 0.5);
  const cap = vessel(M, cx, cz, { r: 1.25, h: 4.7, y0: 0.5, loft: 0, hatches: [PI], ports: [{ a: PI * 0.75, y: 3.6 }], segs: 6 });
  tubeModule(M, cx, 1.35, cz, 6.6, 0.95, 0, { endHatch: false, ribs: 4, ports: 4 });
  tubeModule(M, cx, 3.95, cz - 0.1, 5.4, 0.95, PI / 2, { saddles: false, endHatch: false, ribs: 4, ports: 3 });
  for (const sz of [-1, 1]) {
    for (const sx of [-1, 1]) M.box('metal', cx + sx * 0.75, 1.5, cz - 0.1 + sz * 2.3, 0.16, 3.0, 0.16, N.STEEL);
    M.box('metal', cx, 2.95, cz - 0.1 + sz * 2.3, 1.7, 0.14, 0.2, N.STEEL);
  }
  cupola(M, cx, cap - 0.05, cz, 0.6);
  porch(M, cx, cz - 1.25, 0.5, { w: 1.3, d: 0.7, run: 1.2 });
  plate(M, cx + 0.8, 2.0, cz - 1.3, BLUE);
  pathLights(M, cx, -3.15, 0.85);
  radiatorWing(M, -3.7, -2.0, PI / 2, { w: 1.4, h: 1.4, y0: 0.3 });
  tankV(M, 3.1, -2.6, 0.28, 1.2, { y0: 0.2, band: GREEN });
  tankV(M, 3.1, -1.8, 0.24, 1.0, { y0: 0.2, band: 0x1a1a1a });
  M.entry(cx);
}

// ---------------------------------------------------------------- tier 5: scientists
// the vessel with a telescope dome on the roof, a lab module, an
// instrument mast and sample racks
export function house5(M) {
  plinth(M, 8, 8);
  const vx = -1.3, vz = 0.8;
  deployFrame(M, vx, vz, 4.2, 4.2, 0.6);
  const cap = vessel(M, vx, vz, { r: 2.2, h: 3.8, y0: 0.6, loft: 0, hatches: [PI], ports: [{ a: PI * 0.7 }, { a: PI * 1.3 }, { a: -PI / 2 }, { a: 0 }], segs: 10 });
  M.add('shell', new THREE.SphereGeometry(1.25, 28, 12, 0, PI * 2, 0, PI / 2), { pos: v(vx, cap, vz), color: N.SHELL2 });
  M.add('metal', new THREE.TorusGeometry(1.26, 0.06, 6, 36), { pos: v(vx, cap + 0.02, vz), rot: e(PI / 2, 0, 0), color: N.FRAME });
  M.add('metal', new THREE.BoxGeometry(0.42, 1.3, 0.1), { pos: v(vx, cap + 0.75, vz - 0.85), rot: e(-0.75, 0, 0), color: N.DARK });
  M.add('metal', new THREE.CylinderGeometry(0.16, 0.2, 1.0, 12), { pos: v(vx, cap + 1.05, vz - 0.55), rot: e(-0.75, 0, 0), color: N.FRAME });
  tubeModule(M, 2.35, 1.3, 1.2, 3.0, 0.95, -PI / 2, { endHatch: false, ribs: 3, ports: 2 });
  tunnel(M, vx + 2.05, 1.2, 1.4, 1.2, 1.3, 0.46);
  instrumentMast(M, 3.3, -2.6, 4.6);
  for (let i = 0; i < 3; i++) { M.box('metal', 2.1 + i * 0.5, 0.5, -1.8, 0.4, 1.0, 0.35, N.FRAME); M.box('foil', 2.1 + i * 0.5, 0.75, -1.8, 0.3, 0.3, 0.3, 0xd8a640); }
  porch(M, vx, vz - 2.2, 0.6, { w: 1.4, d: 0.8, run: 1.3 });
  plate(M, vx + 0.9, 2.4, vz - 2.25, TEAL);
  pathLights(M, vx, -3.75, 0.9);
  radiatorWing(M, -3.7, 3.85, PI / 2, { w: 1.3, h: 1.6, y0: 0.35 });
  M.entry(vx);
}
// three small vessels around a tall central node vessel with a cupola,
// joined by tunnels
export function house5b(M) {
  plinth(M, 8, 8);
  const cx = 0.0, cz = 0.6;
  const capC = vessel(M, cx, cz, { r: 0.9, h: 4.0, y0: 0.5, loft: 0, hatches: [], ports: [{ a: 0, y: 3.2 }], segs: 6 });
  cupola(M, cx, capC - 0.05, cz, 0.55);
  const pods = [[-2.55, 0.0, 1.3, PI], [2.55, 0.0, 1.3, PI], [0.0, 2.85, 1.1, 0]];
  for (const [x, z, r, hp] of pods) {
    deployFrame(M, x, z, r * 1.75, r * 1.75, 0.5);
    vessel(M, x, z, { r, h: 2.6, y0: 0.5, loft: 0.8, hatches: x < 0 ? [hp] : [], ports: [{ a: hp + 0.9 }, { a: hp - 0.9 }], segs: 6, rot: x });
    const d = Math.hypot(x - cx, z - cz), ux = (x - cx) / d, uz = (z - cz) / d;
    tunnel(M, cx + ux * 0.8, cz + uz * 0.8, x - ux * (r - 0.1), z - uz * (r - 0.1), 1.35, 0.4);
  }
  porch(M, -2.55, -1.3, 0.5, { w: 1.3, d: 0.7, run: 1.2 });
  plate(M, -1.75, 1.9, -1.32, TEAL);
  pathLights(M, -2.55, -3.45, 0.85);
  instrumentMast(M, 3.4, 3.4, 4.2);
  radiatorWing(M, 1.2, -3.3, 0, { w: 1.4, h: 1.2, y0: 0.3 });
  tankV(M, -3.4, 2.9, 0.28, 1.2, { y0: 0.2, band: GREEN });
  M.entry(-2.55);
}

// ---------------------------------------------------------------- tier 6: citizens
// a three-storey vessel with a window band on every floor, a railed garden
// terrace on its side, a cupola
export function house6(M) {
  plinth(M, 8, 8);
  const vx = -1.1, vz = 1.0;
  deployFrame(M, vx, vz, 4.4, 4.4, 0.6);
  const cap = vessel(M, vx, vz, { r: 2.35, h: 7.4, y0: 0.6, loft: 0, hatches: [PI], ports: [], segs: 12 });
  for (const yy of [1.45, 3.9, 6.35]) viewBand(M, vx, vz, 2.35, yy, 0.95, { from: PI * 0.45, to: PI * 1.75, n: 11 });
  for (const yy of [3.15, 5.6]) M.add('metal', new THREE.TorusGeometry(2.38, 0.06, 6, 56), { pos: v(vx, yy, vz), rot: e(PI / 2, 0, 0), color: N.FRAME });
  cupola(M, vx, cap - 0.05, vz, 0.85);
  const ty = 3.05;
  grating(M, 2.55, ty, 0.6, 2.6, 3.6);
  for (const [x0, z0, x1, z1] of [[1.25, -1.2, 3.85, -1.2], [3.85, -1.2, 3.85, 2.4], [1.25, 2.4, 3.85, 2.4]]) railing(M, x0, z0, x1, z1, ty, 1.0, N.YELLOW);
  for (const z of [-0.5, 1.5]) { M.box('metal', 3.25, ty + 0.25, z, 0.9, 0.5, 0.5, N.STEEL); M.sphere('plant', 3.25, ty + 0.62, z, 0.36, 0x3d7f3a, 9, 0.85); }
  M.box('metal', 2.2, ty + 0.42, 0.5, 1.4, 0.06, 0.45, N.FRAME);
  porch(M, vx, vz - 2.35, 0.6, { w: 1.5, d: 0.7, run: 1.2 });
  plate(M, vx + 0.95, 2.4, vz - 2.4, AMBER);
  pathLights(M, vx, -3.65, 0.95);
  radiatorWing(M, -3.75, -1.0, PI / 2, { w: 1.4, h: 1.6, y0: 0.35 });
  tankV(M, 3.3, 3.3, 0.3, 1.3, { y0: 0.2, band: GREEN });
  M.entry(vx);
}
// two tall vessels of different heights joined by a sky tunnel; ground
// entry on the taller one
export function house6b(M) {
  plinth(M, 8, 8);
  const ax = -1.7, az = 0.2, bx = 2.0, bz = 1.8;
  deployFrame(M, ax, az, 3.6, 3.6, 0.55);
  deployFrame(M, bx, bz, 3.0, 3.0, 0.55);
  const capA = vessel(M, ax, az, { r: 1.95, h: 7.2, y0: 0.55, loft: 0, hatches: [PI], ports: [], segs: 10 });
  const capB = vessel(M, bx, bz, { r: 1.6, h: 5.0, y0: 0.55, loft: 1.1, hatches: [], ports: [], segs: 8, rot: 0.4 });
  for (const yy of [1.4, 3.8, 6.2]) viewBand(M, ax, az, 1.95, yy, 0.9, { from: PI * 0.5, to: PI * 1.7, n: 9 });
  for (const yy of [1.4, 3.8]) viewBand(M, bx, bz, 1.6, yy, 0.9, { from: PI * 0.3, to: PI * 1.3, n: 8 });
  cupola(M, ax, capA - 0.05, az, 0.75);
  const d = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / d, uz = (bz - az) / d;
  tunnel(M, ax + ux * 1.85, az + uz * 1.85, bx - ux * 1.5, bz - uz * 1.5, 4.4, 0.5);
  for (const t of [0.35, 0.65]) { const x = ax + (bx - ax) * t, z = az + (bz - az) * t; M.box('metal', x, 1.95, z, 0.16, 3.9, 0.16, N.STEEL); }
  void capB;
  porch(M, ax, az - 1.95, 0.55, { w: 1.4, d: 0.7, run: 1.2 });
  plate(M, ax + 0.9, 2.3, az - 2.0, AMBER);
  pathLights(M, ax, -3.6, 0.9);
  growTube(M, 2.1, 0.8, -2.1, 3.0, 0.55, 0);
  radiatorWing(M, -3.7, 3.85, PI / 2, { w: 1.4, h: 1.5, y0: 0.35 });
  M.entry(ax);
}

// ---------------------------------------------------------------- tier 7: professionals
// a broad vessel with a panoramic upper floor and a loft, an expandable
// annex and a geodesic winter garden; parking pad
export function house7(M) {
  plinth(M, 8, 8);
  const vx = -1.2, vz = 0.3;
  deployFrame(M, vx, vz, 4.8, 4.8, 0.6);
  vessel(M, vx, vz, { r: 2.6, h: 4.8, y0: 0.6, loft: 1.6, hatches: [PI], ports: [{ a: PI * 0.75 }, { a: PI * 1.25 }, { a: -PI / 2 }], segs: 12 });
  viewBand(M, vx, vz, 2.6, 3.25, 1.4, { from: PI * 0.3, to: PI * 1.8, n: 14 });
  inflatable(M, 1.6, 1.6, 2.85, 4.2, 1.1, 0);
  deployFrame(M, 1.6, 2.85, 3.6, 1.8, 0.5);
  const gx = 2.55, gz = -1.85;
  geodesicDome(M, gx, gz, 1.35, { skirt: 0.3, detail: 1 });
  for (let i = 0; i < 7; i++) { const a = i * 0.9; M.sphere('plant', gx + Math.cos(a) * 0.6, 0.5, gz + Math.sin(a) * 0.6, 0.28, [0x3d7f3a, 0xd9a62a, 0x4f8a3a, 0xc94a8a][i % 4], 8, 0.85); }
  { const d = Math.hypot(gx - vx, gz - vz), ux = (gx - vx) / d, uz = (gz - vz) / d; tunnel(M, vx + ux * 2.5, vz + uz * 2.5, gx - ux * 1.0, gz - uz * 1.0, 1.1, 0.4); }
  porch(M, vx, vz - 2.6, 0.6, { w: 1.6, d: 0.6, run: 1.15 });
  plate(M, vx + 1.05, 2.4, vz - 2.65, 0x7a2a5a);
  pathLights(M, vx, -3.75, 1.0);
  rosa(M, 3.5, 0.9, 4.6, PI / 2, { span: 0.6, height: 1.4 });
  M.entry(vx);
}
// a long two-level rigid hab: a stack of two tube modules with window rows,
// an exterior stair to the upper deck, garden tube and tanks
export function house7b(M) {
  plinth(M, 8, 8);
  const z0 = 1.4;
  deployFrame(M, 0, z0, 7.0, 2.2, 0.4);
  tubeModule(M, 0, 1.45, z0, 6.6, 1.05, 0, { endHatch: false, ribs: 5, ports: 0 });
  tubeModule(M, 0.4, 3.6, z0, 5.8, 1.05, 0, { saddles: false, endHatch: false, ribs: 4, ports: 4 });
  for (const x of [-2.2, 0.4, 2.9]) for (const sz of [-1, 1]) M.box('metal', x, 2.55, z0 + sz * 0.75, 0.16, 0.8, 0.16, N.STEEL);
  // balcony along the upper module
  grating(M, 0.4, 2.65, z0 - 1.55, 4.6, 0.9);
  railing(M, -1.9, z0 - 2.0, 2.7, z0 - 2.0, 2.65, 1.0, N.YELLOW);
  for (const x of [-1.85, 2.65]) railing(M, x, z0 - 2.0, x, z0 - 1.1, 2.65, 1.0, N.YELLOW);
  // bay window on the lower module
  M.box('shell', -1.6, 1.45, z0 - 1.0, 2.6, 1.2, 0.32, N.SHELL2);
  M.box('glass', -1.6, 1.45, z0 - 1.17, 2.4, 0.95, 0.03);
  // entry vestibule
  M.box('shell', 1.9, 1.5, z0 - 1.05, 1.5, 2.1, 0.6, N.SHELL2);
  hatch(M, 1.9, 0.45, z0 - 1.35, PI, { w: 0.9, h: 1.75, depth: 0.14 });
  M.col(1.15, 0, z0 - 1.35, 2.65, 2.55, z0 - 0.75);
  porch(M, 1.9, z0 - 1.35, 0.45, { w: 1.4, d: 0.6, run: 1.1 });
  plate(M, 2.75, 2.2, z0 - 1.37, 0x7a2a5a);
  pathLights(M, 1.9, -1.9, 0.9);
  growTube(M, -1.6, 0.8, -2.6, 3.4, 0.55, 0);
  tankV(M, 3.3, -2.9, 0.3, 1.3, { y0: 0.2, band: GREEN });
  radiatorWing(M, 3.85, 3.9, PI / 2, { w: 1.3, h: 1.4, y0: 0.3 });
  M.entry(1.9);
}

// ---------------------------------------------------------------- tier 8: notables
// a diagrid tower on a podium vessel; garden dome and mast on the crown
export function house8(M) {
  plinth(M, 8, 8);
  const cz = 0.6;
  deployFrame(M, 0, cz, 5.6, 5.6, 0.45);
  vessel(M, 0, cz, { r: 3.0, h: 3.2, y0: 0.45, loft: 0, hatches: [PI], ports: [{ a: PI * 0.65 }, { a: PI * 1.35 }, { a: PI / 2 }, { a: -PI / 2 }], segs: 12 });
  const top = diagridTower(M, 0, cz, { r: 2.4, H: 26, y0: 3.9, fh: 3.1, twist: 0.55, n: 8 });
  M.cyl('shell', 0, top, cz, 3.0, 0.35, N.SHELL2, 48);
  for (let i = 0; i < 20; i++) { const a = i / 20 * PI * 2; M.cyl('metal', Math.cos(a) * 2.9, top + 0.35, cz + Math.sin(a) * 2.9, 0.025, 1.0, N.FRAME, 4); }
  M.add('metal', new THREE.TorusGeometry(2.9, 0.035, 4, 48), { pos: v(0, top + 1.35, cz), rot: e(PI / 2, 0, 0), color: N.FRAME });
  geodesicDome(M, 0, cz, 1.9, { y0: top + 0.35, skirt: 0.35, detail: 2 });
  for (let i = 0; i < 6; i++) { const a = i * 1.05; M.sphere('plant', Math.cos(a) * 0.9, top + 0.95, cz + Math.sin(a) * 0.9, 0.42, 0x3d7f3a, 8, 0.9); }
  M.cyl('metal', 2.3, top + 0.35, cz + 1.2, 0.05, 3.2, N.FRAME, 6);
  beacon(M, 2.3, top + 3.55, cz + 1.2, L.red);
  porch(M, 0, cz - 3.0, 0.45, { w: 1.6, d: 0.55, run: 1.0 });
  plate(M, 1.0, 2.3, cz - 3.02, 0x2a6a3a);
  pathLights(M, 0, -3.95, 1.0);
  M.entry(0);
}
// a slimmer, taller tower with a stronger twist and a sky terrace ring
export function house8b(M) {
  plinth(M, 8, 8);
  const cz = 0.8;
  deployFrame(M, 0, cz, 5.0, 5.0, 0.45);
  vessel(M, 0, cz, { r: 2.7, h: 3.4, y0: 0.45, loft: 0, hatches: [PI], ports: [{ a: PI * 0.65 }, { a: PI * 1.35 }, { a: 0 }], segs: 10, rot: 0.4 });
  const top = diagridTower(M, 0, cz, { r: 2.05, H: 31, y0: 4.1, fh: 3.1, twist: 0.85, n: 7, seed: 0.3 });
  const ty = 4.1 + 3.1 * 4;
  M.cyl('shell', 0, ty - 0.3, cz, 3.25, 0.3, N.SHELL2, 48);
  for (let i = 0; i < 24; i++) { const a = i / 24 * PI * 2; M.cyl('metal', Math.cos(a) * 3.15, ty, cz + Math.sin(a) * 3.15, 0.025, 1.0, N.FRAME, 4); }
  M.add('metal', new THREE.TorusGeometry(3.15, 0.035, 4, 48), { pos: v(0, ty + 1.0, cz), rot: e(PI / 2, 0, 0), color: N.FRAME });
  for (let i = 0; i < 5; i++) { const a = i * 1.26 + 0.3; M.cyl('metal', Math.cos(a) * 2.75, ty, cz + Math.sin(a) * 2.75, 0.2, 0.35, N.STEEL, 10); M.sphere('plant', Math.cos(a) * 2.75, ty + 0.55, cz + Math.sin(a) * 2.75, 0.3, 0x3d7f3a, 8, 0.9); }
  M.cyl('shell', 0, top, cz, 2.55, 0.5, N.SHELL, 40);
  cupola(M, 0, top + 0.5, cz, 1.1);
  M.cyl('metal', 0, top + 1.4, cz, 0.08, 3.2, N.FRAME, 8);
  for (const sx of [-1, 1]) { M.box('solar', sx * 0.85, top + 3.6, cz, 1.3, 0.9, 0.04, undefined, 0); M.box('metal', sx * 0.85, top + 4.08, cz, 1.4, 0.06, 0.06, N.FRAME); }
  beacon(M, 0, top + 4.6, cz, L.red);
  porch(M, 0, cz - 2.7, 0.45, { w: 1.6, d: 0.55, run: 1.05 });
  plate(M, 1.0, 2.35, cz - 2.72, 0x2a6a3a);
  pathLights(M, 0, -3.9, 1.0);
  M.entry(0);
}

// ---------------------------------------------------------------- tier 9: natives (open air)
// the agency vessel opened up: no airlock, a glazed entrance, big windows,
// a deck under a pergola, planters, a tree and a bench
export function house9(M) {
  plinth(M, 8, 8);
  const vx = -1.3, vz = 1.4;
  deployFrame(M, vx, vz, 4.2, 4.2, 0.5);
  vessel(M, vx, vz, { r: 2.2, h: 3.6, y0: 0.5, loft: 1.3, hatches: [], ports: [], segs: 10 });
  viewBand(M, vx, vz, 2.2, 0.95, 1.9, { from: PI * 0.55, to: PI * 1.45, n: 9 });
  viewBand(M, vx, vz, 2.2, 1.2, 1.5, { from: -PI * 0.35, to: PI * 0.25, n: 5 });
  glazedPorch(M, vx, vz - 2.2 - 0.55, 1.8, 1.1, 0.5);
  grating(M, vx, 0.5, vz - 2.2 - 0.55, 1.9, 1.2);
  ramp(M, vx, vz - 2.2 - 1.15, 0, 0.5, { w: 1.4, run: 1.1 });
  ramp(M, 2.6, -2.0, 0, 0.5, { w: 1.2, run: 1.0 });
  grating(M, 1.9, 0.5, -0.2, 3.6, 3.6);
  for (const [x0, z0, x1, z1] of [[3.7, -2.0, 3.7, 1.6], [0.1, 1.6, 3.7, 1.6]]) railing(M, x0, z0, x1, z1, 0.5, 1.0, N.FRAME);
  pergola(M, 1.9, -0.2, 3.4, 3.4, 3.0);
  M.box('metal', 1.6, 0.92, 0.3, 1.2, 0.05, 0.8, N.SHELL2);
  M.cyl('metal', 1.6, 0.5, 0.3, 0.05, 0.42, N.STEEL, 6);
  for (const s of [-1, 1]) M.box('metal', 1.6 + s * 0.85, 0.74, 0.3, 0.45, 0.04, 0.45, N.FRAME);
  planter(M, -3.2, -1.6, 1.2, 0.5, 0);
  planter(M, 2.9, -3.3, 1.6, 0.5, 2);
  tree(M, -3.1, -3.0, 2.5, 0.95, 1);
  lifeAround(M, [], [[0.9, -3.3, 0]]);
  pathLights(M, vx, -3.75, 1.1);
  M.light(1.9, 2.8, -0.2, L.warm, 1.2, 6);
  M.entry(vx);
}
// a long open-air module home on a deck: glazed entrance, a veranda under
// a membrane canopy along the front, garden beds and trees
export function house9b(M) {
  plinth(M, 8, 8);
  const z0 = 1.9;
  deployFrame(M, 0, z0, 7.0, 2.4, 0.45);
  tubeModule(M, 0, 1.75, z0, 6.6, 1.3, 0, { endHatch: false, ribs: 5, ports: 0 });
  M.box('shell', -1.2, 1.75, z0 - 1.1, 3.9, 1.6, 0.36, N.SHELL2);
  M.box('glass', -1.2, 1.75, z0 - 1.29, 3.6, 1.3, 0.04);
  for (const x of [-2.4, -1.2, 0.0]) M.box('metal', x, 1.75, z0 - 1.32, 0.05, 1.3, 0.04, N.FRAME);
  glazedPorch(M, 2.2, z0 - 1.3 - 0.5, 1.6, 1.0, 0.45);
  grating(M, 0, 0.45, z0 - 2.0, 7.0, 1.2);
  for (const x of [-3.3, -0.9, 1.0, 3.3]) M.cyl('metal', x, 0, z0 - 2.5, 0.06, 2.9, N.FRAME, 8);
  M.add('shell', new THREE.BoxGeometry(7.2, 0.07, 1.8), { pos: v(0, 3.05, z0 - 2.0), rot: e(-0.1, 0, 0), color: N.SHELL2 });
  M.box('metal', 0, 2.9, z0 - 2.55, 7.0, 0.1, 0.1, N.FRAME);
  M.box('metal', 0, 2.95, z0 - 1.15, 7.0, 0.1, 0.12, N.FRAME);
  ramp(M, 2.2, z0 - 2.6, 0, 0.45, { w: 1.3, run: 1.0 });
  railing(M, -3.45, z0 - 2.55, 1.2, z0 - 2.55, 0.45, 1.0, N.FRAME);
  planter(M, -2.4, -2.6, 2.2, 0.6, 1);
  planter(M, 0.2, -3.35, 1.6, 0.5, 3);
  tree(M, -3.3, -3.4, 2.3, 0.85, 0);
  tree(M, 3.3, -3.2, 2.6, 1.0, 1);
  lifeAround(M, [], [[-2.3, -1.2, 0]]);
  pathLights(M, 2.2, -3.75, 0.95);
  M.light(-1.0, 2.6, z0 - 2.0, L.warm, 1.2, 7);
  M.entry(2.2);
}
