// Agency-built surface base, after NASA's own Mars and Moon work: low printed
// regolith halls with curved walls and vaulted roofs like ICON/BIG's Mars
// Dune Alpha (built for NASA's CHAPEA), rigid hab modules with airlocks like
// the Artemis surface habitat, pressurised rovers docked at ports, and the
// working kit around them: gold-foil avionics boxes, white radiators,
// tanks, comm masts, a tracking dish, vertical solar masts, flags.
// Every building says what it is for by what is bolted to it.
import * as THREE from 'three';
import { C, L, v, e, plinth, railing } from './modelkit.js';
import { lattice, floodMast } from './starkit.js';
import { N, vessel, tubeModule, radiatorWing, deployFrame, grating, ramp, avionics, bottleRack, dishAntenna } from './nasakit.js';

const PI = Math.PI;
const PRINT = 0x9a8878;          // printed lavacrete, grey-brown
const ORANGE = 0xe0662a;         // ground-support orange

function rr(w, d, r) {
  const s = new THREE.Shape(), x0 = -w / 2, y0 = -d / 2;
  s.moveTo(x0 + r, y0); s.lineTo(x0 + w - r, y0); s.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + r);
  s.lineTo(x0 + w, y0 + d - r); s.quadraticCurveTo(x0 + w, y0 + d, x0 + w - r, y0 + d);
  s.lineTo(x0 + r, y0 + d); s.quadraticCurveTo(x0, y0 + d, x0, y0 + d - r);
  s.lineTo(x0, y0 + r); s.quadraticCurveTo(x0, y0, x0 + r, y0);
  return s;
}

// a printed hall: thick layered walls on a rounded plan, a printed barrel
// vault over it running along x, deep-set slot windows, a door opening at
// the front where an airlock or tunnel meets it
export function printedHall(M, x, z, w, d, h, { rise = 0.55, slots = 3, door = 0, y0 = 0 } = {}) {
  const t = 0.5, r = Math.min(1.4, d * 0.3);
  const ring = rr(w, d, r); ring.holes.push(rr(w - 2 * t, d - 2 * t, r - t));
  const g = new THREE.ExtrudeGeometry(ring, { depth: h, bevelEnabled: false, curveSegments: 12 });
  g.rotateX(-PI / 2);
  M.add('regolith', g, { pos: v(x, y0, z), color: PRINT });
  // vault: a flattened half cylinder along x, printed, with a thin parapet lip
  M.add('regolith', new THREE.CylinderGeometry(d / 2, d / 2, w - 0.3, 36, 1, false, 0, PI), { pos: v(x, y0 + h, z), rot: e(0, 0, PI / 2), scale: v(rise, 1, 1), color: PRINT });
  M.add('metal', new THREE.BoxGeometry(w - 0.2, 0.12, 0.3), { pos: v(x, y0 + h + 0.02, z - d / 2 + 0.2), color: 0x5b6168 });
  // slot windows, deep in the printed wall, with steel frames
  for (let i = 0; i < slots; i++) {
    const sx = x - w / 2 + (i + 1) * w / (slots + 1);
    if (Math.abs(sx - x - door) < 1.2) continue;
    for (const s of [-1, 1]) {
      const sz = z + s * (d / 2 - 0.12);
      M.box('glass', sx, y0 + 1.75, sz, 0.42, 1.1, 0.06);
      M.box('metal', sx, y0 + 2.36, sz + s * 0.12, 0.62, 0.1, 0.26, 0x3a3f45);
      M.box('metal', sx, y0 + 1.16, sz + s * 0.12, 0.56, 0.08, 0.22, 0x3a3f45);
    }
  }
  M.col(x - w / 2, y0, z - d / 2, x + w / 2, y0 + h + d / 2 * rise, z + d / 2);
  return y0 + h + d / 2 * rise;
}

// a box of avionics wrapped in gold foil, on a frame
export function foilBox(M, x, y, z, w, h, d) {
  M.box('foil', x, y + h / 2, z, w, h, d, 0xd8a640);
  M.box('metal', x, y + 0.03, z, w + 0.1, 0.06, d + 0.1, 0x3a3f45);
  for (const sx of [-1, 1]) M.box('metal', x + sx * (w / 2 + 0.03), y + h / 2, z, 0.04, h, d + 0.06, 0x3a3f45);
}

// vertical solar mast: a tall boom with two blanket wings that track the sun
export function solarMast(M, x, z, h = 14) {
  M.cyl('metal', x, 0, z, 0.16, h, 0xb8bec4, 10);
  M.cyl('concrete', x, 0, z, 0.6, 0.3, 0xa09080, 16);
  for (const s of [-1, 1]) {
    M.box('solar', x + s * 0.95, h * 0.62, z, 1.7, h * 0.66, 0.04);
    M.box('metal', x + s * 0.95, h * 0.62 + h * 0.33, z, 1.8, 0.08, 0.08, 0xb8bec4);
    M.box('metal', x + s * 0.95, h * 0.62 - h * 0.33, z, 1.8, 0.08, 0.08, 0xb8bec4);
  }
  M.sphere('blink', x, h + 0.2, z, 0.1, L.red, 6);
  M.colCyl(x, z, 0.3, 0, h);
}

// pressurised rover parked at a docking port
export function rover(M, x, z, yaw = 0, stripe = ORANGE) {
  const c = Math.cos(yaw), s = Math.sin(yaw), P = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  const body = new THREE.ExtrudeGeometry(rr(4.2, 2.2, 0.7), { depth: 1.9, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 2 });
  body.rotateX(-PI / 2); body.rotateY(yaw);
  M.add('hull', body, { pos: v(x, 0.75, z), color: C.W });
  const [wx, wz] = P(-1.2, -1.11);
  M.box('glass', wx, 2.0, wz, 1.4, 0.6, 0.05, undefined, yaw);
  const [sx2, sz2] = P(0.2, -1.12);
  M.box('hull', sx2, 1.25, sz2, 3.6, 0.16, 0.03, stripe, yaw);
  for (const lx of [-1.4, 1.4]) for (const lz of [-1.05, 1.05]) { const [px, pz] = P(lx, lz); M.add('metal', new THREE.CylinderGeometry(0.45, 0.45, 0.32, 18), { pos: v(px, 0.45, pz), rot: e(0, yaw, PI / 2), color: 0x2a2c2f }); }
  const [hx, hz] = P(2.15, 0);
  M.add('metal', new THREE.TorusGeometry(0.62, 0.08, 8, 20), { pos: v(hx, 1.6, hz), rot: e(0, yaw + PI / 2, 0), color: 0x5b6168 });
  M.col(x - 2.2, 0, z - 1.2, x + 2.2, 2.7, z + 1.2);
}

// emblem of the colony agency: a blue disc with a white orbit and a red arc
export function emblem(M, x, y, z, s, face) {
  M.add('hull', new THREE.CylinderGeometry(s, s, 0.06, 32), { pos: v(x, y, z), rot: e(PI / 2, face, 0), color: 0x1f4a9a });
  M.add('hull', new THREE.TorusGeometry(s * 0.7, s * 0.06, 6, 32), { pos: v(x - Math.sin(face) * 0.04, y, z - Math.cos(face) * 0.04), rot: e(0.5, face, 0.3), color: 0xf2f2f2 });
  M.add('hull', new THREE.TorusGeometry(s * 0.82, s * 0.05, 6, 24, PI * 0.9), { pos: v(x - Math.sin(face) * 0.05, y, z - Math.cos(face) * 0.05), rot: e(0, face, 0.6), color: 0xd23a2a });
}

// flags: the colony's (deep blue, the orange disc of Arke, a white orbit
// line) and the migration agency's (white with the blue emblem)
export function flag(M, x, z, h, kind = 'colony') {
  M.cyl('metal', x, 0, z, 0.045, h, 0xc8ccd0, 8);
  const fx = x + 0.6, fy = h - 0.42;
  if (kind === 'colony') {
    M.box('hull', fx, fy, z, 1.1, 0.7, 0.02, 0x1d3166);
    M.add('hull', new THREE.CylinderGeometry(0.18, 0.18, 0.03, 20), { pos: v(fx - 0.15, fy + 0.05, z), rot: e(PI / 2, 0, 0), color: 0xe0662a });
    M.box('hull', fx, fy - 0.2, z, 1.1, 0.05, 0.03, 0xf2f2f2);
  } else {
    M.box('hull', fx, fy, z, 1.1, 0.7, 0.02, 0xf2f2f2);
    M.add('hull', new THREE.TorusGeometry(0.2, 0.05, 6, 24), { pos: v(fx, fy, z - 0.02), color: 0x1f4a9a });
  }
}

// ---------------------------------------------------------------- clinic
// Medical habitat before the air is breathable, in the agency's own design
// language: a pressure vessel with a strapped fabric loft on a steel
// deployment frame, the front hatch on a grated porch with a ramp, a berthed
// medical module with a red band and the red cross, oxygen bottles in a
// rack, radiator wings behind, avionics in gold foil, a whip antenna.
export function clinic(M, open = false) {
  plinth(M, 8, 8);
  const hx = -0.9, hz = 1.0;
  deployFrame(M, hx, hz, 4.6, 4.4, 0.6);
  const cap = vessel(M, hx, hz, { r: 2.0, h: 2.7, y0: 0.6, loft: 1.3, hatches: [PI], ports: [{ a: -PI / 2 }, { a: PI * 0.72 }, { a: PI * 1.28 }], segs: 8 });
  // front porch and ramp
  grating(M, hx, 0.6, hz - 2.75, 1.8, 1.5);
  for (const sx of [-1, 1]) railing(M, hx + sx * 0.9, hz - 3.45, hx + sx * 0.9, hz - 2.05, 0.6, 1.0, N.YELLOW);
  ramp(M, hx, hz - 3.5, 0, 0.6, { w: 1.2, run: 1.3 });
  // berthed medical module: red band, red cross on its flank, end hatch
  tubeModule(M, 2.25, 1.55, hz, 2.7, 0.95, 0, { ports: 1, ribs: 2 });
  M.add('shell', new THREE.CylinderGeometry(0.975, 0.975, 0.34, 40, 1, true), { pos: v(1.6, 1.55, hz), rot: e(0, 0, PI / 2), color: 0xc8302a });
  M.box('hull', 2.55, 1.6, hz - 0.96, 0.9, 0.9, 0.04, 0xf2f2f2);
  M.box('concrete', 2.55, 1.6, hz - 0.99, 0.62, 0.18, 0.02, 0xc8262a);
  M.box('concrete', 2.55, 1.6, hz - 0.99, 0.18, 0.62, 0.02, 0xc8262a);
  // oxygen, radiators, avionics, antenna
  if (open) lifeAround(M, [[2.6, -2.9]], [[3.2, -2.0, 0]]);
  else bottleRack(M, 2.6, -2.9, 0, 4);
  radiatorWing(M, -3.6, 3.55, 0, { w: 1.3, h: 2.4, y0: 0.5 });
  radiatorWing(M, -0.6, 3.55, 0, { w: 1.3, h: 2.4, y0: 0.5 });
  avionics(M, 3.0, 0, 3.0, 0.8, 0.7, 0.6);
  avionics(M, -3.3, 0, -2.6, 0.7, 0.6, 0.6);
  M.cyl('metal', hx + 0.6, cap - 0.25, hz + 0.4, 0.025, 1.6, N.FRAME, 6);
  M.sphere('blink', hx + 0.6, cap + 1.4, hz + 0.4, 0.05, L.red, 6);
  M.light(hx, 2.2, hz - 3.0, L.warm, 1.2, 6);
  if (open) glazedPorch(M, hx, hz - 2.75, 1.8, 1.5, 0.6);
  M.entry(hx);
}

// ---------------------------------------------------------------- city hall
// Colony operations centre before the air is breathable: the main pressure
// vessel with its fabric loft on a deployment frame, a long control module
// berthed to it with the console windows, a logistics pod on the other side,
// a grated porch and ramp at the hatch, a bank of radiator wings, and the
// base's working kit: tracking antenna, comm tower, solar mast, floodlights,
// flags, the rover at its charger.
export function cityhall(M, open = false) {
  plinth(M, 14, 12);
  const hx = -2.2, hz = 1.2;
  deployFrame(M, hx, hz, 5.8, 5.4, 0.7);
  const cap = vessel(M, hx, hz, { r: 2.6, h: 3.0, y0: 0.7, loft: 1.8, hatches: [PI], ports: [{ a: -PI / 2 }, { a: PI * 0.74 }, { a: PI * 1.26 }, { a: 0.3 }], segs: 10 });
  // control module berthed on the east, console windows facing the front
  tubeModule(M, 2.5, 2.05, hz, 4.4, 1.25, 0, { ports: 3, ribs: 3 });
  // logistics pod on the west
  tubeModule(M, -5.95, 1.55, hz, 1.6, 0.85, 0, { endHatch: false, startHatch: true, ribs: 1 });
  // porch and ramp at the front hatch
  grating(M, hx, 0.7, hz - 3.4, 2.2, 1.6);
  for (const sx of [-1, 1]) railing(M, hx + sx * 1.1, hz - 4.2, hx + sx * 1.1, hz - 2.6, 0.7, 1.0, N.YELLOW);
  ramp(M, hx, hz - 4.2, 0, 0.7, { w: 1.4, run: 1.5 });
  // radiator wings: a bank behind the vessel and two behind the module
  for (const x of [-5.3, -3.8, -2.3]) radiatorWing(M, x, 4.7, 0, { w: 1.4, h: 3.0, y0: 0.6 });
  for (const x of [1.0, 2.6]) radiatorWing(M, x, 3.2, 0, { w: 1.4, h: 2.6, y0: 0.6 });
  // local tracking antenna (the deep-space station's design, ~1:10)
  dishAntenna(M, 5.4, 4.6, { s: 0.5, speed: 0.06 });
  // comm tower, solar mast, floodlights, flags
  lattice(M, -6.1, 5.0, 1.3, 14, { mast: true, stairs: false });
  solarMast(M, 6.2, -1.6, 12);
  floodMast(M, -6.3, -2.0, 7, -PI * 0.75);
  floodMast(M, 6.4, -5.2, 7, PI * 0.8);
  flag(M, -4.4, -5.2, 6, 'colony');
  flag(M, -3.2, -5.2, 6, 'agency');
  // rover at its charger, avionics
  rover(M, 3.4, -3.8, 0, ORANGE);
  M.box('metal', 0.6, 0.7, -4.4, 0.5, 1.4, 0.4, N.DARK);
  M.box('emissive', 0.6, 1.2, -4.62, 0.3, 0.1, 0.02, L.green);
  avionics(M, 5.9, 0, -0.2, 0.9, 0.8, 0.7);
  avionics(M, 5.9, 0, 0.8, 0.9, 0.8, 0.7);
  M.cyl('metal', hx + 0.8, cap - 0.3, hz + 0.6, 0.03, 2.0, N.FRAME, 6);
  M.sphere('blink', hx + 0.8, cap + 1.75, hz + 0.6, 0.06, L.red, 6);
  M.light(hx, 2.4, hz - 3.6, L.warm, 1.4, 7);
  if (open) { glazedPorch(M, hx, hz - 3.4, 2.2, 1.6, 0.7); lifeAround(M, [[-5.6, -3.4], [-0.2, -5.2], [5.8, -3.0]], [[-0.9, -3.9, 0], [5.0, 2.4, PI / 2]]); }
  M.entry(hx);
}

// ---------------------------------------------------------------- after the air is breathable
// The base stays the base: the same agency hardware, but the airlock porch
// is closed in with glass as a plain vestibule, and the deck gets planters,
// young trees and benches. Same complex, visibly lived in.
export function glazedPorch(M, x, z, w, d, y) {
  const h = 2.5;
  M.box('glass', x, y + h / 2, z - d / 2 + 0.03, w - 0.1, h, 0.05);
  for (const sx of [-1, 1]) M.box('glass', x + sx * (w / 2 - 0.03), y + h / 2, z, 0.05, h, d - 0.1);
  for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) M.box('metal', x + px * (w / 2 - 0.04), y + h / 2, z + pz * (d / 2 - 0.04), 0.08, h, 0.08, N.FRAME);
  M.box('metal', x, y + h, z - d / 2 + 0.04, w, 0.1, 0.1, N.FRAME);
  M.box('hull', x, y + h + 0.08, z, w + 0.2, 0.12, d + 0.2, N.SHELL2);
  M.box('metal', x, y + 1.15, z - d / 2 + 0.01, 0.05, 2.3, 0.08, N.FRAME);
  M.light(x, y + h - 0.3, z, L.warm, 1.0, 5);
}
export function lifeAround(M, trees, benches) {
  for (const [x, z] of trees) {
    M.box('metal', x, 0.25, z, 1.1, 0.5, 1.1, N.STEEL);
    M.box('plant', x, 0.52, z, 1.0, 0.06, 1.0, 0x3b2a1e);
    M.cyl('plant', x, 0.5, z, 0.07, 1.9, 0x5a3b26, 6);
    M.sphere('plant', x, 2.6, z, 0.8, 0x3d7f3a, 10, 0.9);
    M.sphere('plant', x + 0.3, 2.3, z - 0.2, 0.5, 0x47843d, 8, 0.9);
    M.col(x - 0.55, 0, z - 0.55, x + 0.55, 0.55, z + 0.55);
  }
  for (const [x, z, yaw] of benches) {
    M.box('metal', x, 0.42, z, 1.6, 0.06, 0.45, N.FRAME, yaw);
    for (const s of [-0.65, 0.65]) M.box('metal', x + Math.cos(yaw) * s, 0.21, z - Math.sin(yaw) * s, 0.06, 0.42, 0.42, N.DARK, yaw);
  }
}
export const clinicOpen = (M) => clinic(M, true);
export const cityhallOpen = (M) => cityhall(M, true);
