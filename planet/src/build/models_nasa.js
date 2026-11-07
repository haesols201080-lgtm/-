// Agency-built surface base, after NASA's own Mars and Moon work: low printed
// regolith halls with curved walls and vaulted roofs like ICON/BIG's Mars
// Dune Alpha (built for NASA's CHAPEA), rigid hab modules with airlocks like
// the Artemis surface habitat, pressurised rovers docked at ports, and the
// working kit around them: gold-foil avionics boxes, white radiators,
// tanks, comm masts, a tracking dish, vertical solar masts, flags.
// Every building says what it is for by what is bolted to it.
import * as THREE from 'three';
import { C, L, v, e, plinth, railing, antenna, radiator, airlockTube, habModule, tank, pvRack } from './modelkit.js';
import { strut, lattice, symbol, floodMast, pipeRack } from './starkit.js';

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
function foilBox(M, x, y, z, w, h, d) {
  M.box('foil', x, y + h / 2, z, w, h, d, 0xd8a640);
  M.box('metal', x, y + 0.03, z, w + 0.1, 0.06, d + 0.1, 0x3a3f45);
  for (const sx of [-1, 1]) M.box('metal', x + sx * (w / 2 + 0.03), y + h / 2, z, 0.04, h, d + 0.06, 0x3a3f45);
}

// vertical solar mast: a tall boom with two blanket wings that track the sun
function solarMast(M, x, z, h = 14) {
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
function rover(M, x, z, yaw = 0, stripe = ORANGE) {
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
function emblem(M, x, y, z, s, face) {
  M.add('hull', new THREE.CylinderGeometry(s, s, 0.06, 32), { pos: v(x, y, z), rot: e(PI / 2, face, 0), color: 0x1f4a9a });
  M.add('hull', new THREE.TorusGeometry(s * 0.7, s * 0.06, 6, 32), { pos: v(x - Math.sin(face) * 0.04, y, z - Math.cos(face) * 0.04), rot: e(0.5, face, 0.3), color: 0xf2f2f2 });
  M.add('hull', new THREE.TorusGeometry(s * 0.82, s * 0.05, 6, 24, PI * 0.9), { pos: v(x - Math.sin(face) * 0.05, y, z - Math.cos(face) * 0.05), rot: e(0, face, 0.6), color: 0xd23a2a });
}

// flags: the colony's (deep blue, the orange disc of Arke, a white orbit
// line) and the migration agency's (white with the blue emblem)
function flag(M, x, z, h, kind = 'colony') {
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
// Medical habitat: a printed ward hall, a rigid medical module with the red
// cross on its flank and a red band, an airlock with a dust-off porch, the
// ambulance rover docked at the side port, oxygen bottles, avionics in gold
// foil, a radiator and a comm mast
export function clinic(M) {
  plinth(M, 8, 8);
  printedHall(M, -0.9, 1.6, 5.8, 4.4, 2.9, { slots: 3 });
  habModule(M, 0.3, 1.75, -1.75, 5.6, 1.3, { accent: 0xd23a2a, ports: 3, label: 0xff4040 });
  symbol(M, 'cross', 1.6, 1.85, -1.75 - 1.36, 1.1, PI, 0xff3b3b);
  // tunnel from module into the hall
  M.add('hull', new THREE.CylinderGeometry(0.7, 0.7, 1.2, 20), { pos: v(-1.0, 1.4, -0.3), rot: e(PI / 2, 0, 0), color: C.W2 });
  // airlock and dust-off porch at the west end
  airlockTube(M, -2.9, 1.25, -1.75, -3.7, 1.05);
  M.box('metal', -2.9, 0.06, -4.2, 2.0, 0.12, 1.2, 0x6f757c);
  railing(M, -3.9, -4.8, -1.9, -4.8, 0.1, 1.0, C.Y);
  // ambulance rover docked on the east port
  rover(M, 2.6, 2.4, PI / 2, 0xd23a2a);
  // oxygen bottles, avionics, radiator, mast, emblem
  for (let i = 0; i < 3; i++) tank(M, 3.5, 0, -3.3 + i * 0.8, 0.3, 1.8, C.W, C.GREEN);
  foilBox(M, -3.4, 0, 3.3, 1.0, 0.9, 0.7);
  foilBox(M, -2.2, 0, 3.4, 0.7, 0.6, 0.6);
  radiator(M, -0.9, 3.75, 1.6, 2.4, 1.0, 0, C.W2);
  antenna(M, 1.6, 3.6, 2.6, 2.6);
  emblem(M, -0.9, 2.1, 1.6 - 2.21, 0.5, PI);
  M.entry(-2.9);
}

// ---------------------------------------------------------------- city hall
// Colony operations centre (Mars mission control): printed halls stepping up
// to a raised control room with a clerestory window band, a deep-space
// tracking dish that turns, a comm tower, a vertical solar mast, the airlock
// entrance with a porch, flags and the agency emblem, a rover at its charger
export function cityhall(M) {
  plinth(M, 14, 12);
  printedHall(M, -1.4, 1.4, 8.2, 5.6, 3.0, { slots: 4 });
  // the control room: a higher printed drum with a window band on the vault
  const cx = 0.6, cz = 1.2;
  const ring = rr(4.6, 4.6, 2.2); ring.holes.push(rr(3.7, 3.7, 1.75));
  const g = new THREE.ExtrudeGeometry(ring, { depth: 5.2, bevelEnabled: false, curveSegments: 18 }); g.rotateX(-PI / 2);
  M.add('regolith', g, { pos: v(cx, 0, cz), color: PRINT });
  M.add('glass', new THREE.CylinderGeometry(2.25, 2.25, 0.9, 40, 1, true, PI * 0.6, PI * 0.8), { pos: v(cx, 5.65, cz) });
  for (let i = 0; i < 7; i++) { const a = PI * 0.6 + i * PI * 0.8 / 6; M.box('metal', cx + Math.sin(a) * 2.27, 5.65, cz + Math.cos(a) * 2.27, 0.08, 0.95, 0.08, 0x3a3f45); }
  M.add('regolith', new THREE.SphereGeometry(2.4, 32, 12, 0, PI * 2, 0, PI / 2), { pos: v(cx, 6.1, cz), scale: v(1, 0.45, 1), color: PRINT });
  M.colCyl(cx, cz, 2.3, 0, 7.2);
  // airlock entrance with porch and steps
  airlockTube(M, -3.2, 1.25, 1.4 - 2.6, -3.9, 1.1);
  M.box('metal', -3.2, 0.06, -4.4, 2.4, 0.12, 1.4, 0x6f757c);
  // local tracking antenna: the same beam-waveguide design as the deep-space
  // station, at about a ninth of its size, slowly slewing in azimuth
  M.asset('dsn34', 5.2, 0, 3.8, { scale: 0.11, anim: { pivot: [5.2, 0, 3.8], axis: [0, 1, 0], speed: 0.06 }, fixed: /base/ });
  M.colCyl(5.2, 3.8, 1.1, 0, 2.0);
  // comm tower and a vertical solar mast
  lattice(M, -5.2, 4.2, 1.6, 16, { mast: true, stairs: false });
  solarMast(M, 5.6, -1.2, 13);
  // flags, emblem, floodlights, charger and rover
  flag(M, -1.2, -5.0, 6, 'colony');
  flag(M, 0.4, -5.0, 6, 'agency');
  emblem(M, cx, 3.2, cz - 2.32, 0.7, PI);
  floodMast(M, -6.2, -4.6, 7, PI * 0.85);
  M.box('metal', 1.5, 0.7, -4.6, 0.5, 1.4, 0.4, 0x3a3f45);
  M.box('emissive', 1.5, 1.2, -4.82, 0.3, 0.1, 0.02, L.green);
  rover(M, 4.6, -4.2, 0, ORANGE);
  for (let i = 0; i < 2; i++) foilBox(M, -5.6 + i * 1.1, 0, -0.6, 0.9, 0.8, 0.7);
  pipeRack(M, 2.8, 3.6, 2.8, 5.4, 1.4, 2);
  M.entry(-3.2);
}

// ---------------------------------------------------------------- after the air is breathable
// Once people can breathe outside, the shielding and airlocks are no longer
// the point: the printed walls stay, fronts open up in glass, doors are just
// doors, and there are gardens, benches and shade outside.
function openHall(M, x, z, w, d, h, { rise = 0.5, door = 0 } = {}) {
  const t = 0.5;
  M.box('regolith', x, h / 2, z + d / 2 - t / 2, w, h, t, PRINT);
  for (const s of [-1, 1]) M.box('regolith', x + s * (w / 2 - t / 2), h / 2, z, t, h, d - 0.02, PRINT);
  M.box('glass', x, h / 2, z - d / 2 + 0.2, w - 2 * t, h - 0.25, 0.06);
  const n = Math.max(3, Math.round((w - 2 * t) / 1.3));
  for (let i = 0; i <= n; i++) M.box('metal', x - (w / 2 - t) + i * (w - 2 * t) / n, h / 2, z - d / 2 + 0.16, 0.08, h - 0.2, 0.12, 0x3a3f45);
  M.box('metal', x, h - 0.12, z - d / 2 + 0.16, w - 2 * t, 0.16, 0.14, 0x3a3f45);
  M.box('metal', x, 2.3, z - d / 2 + 0.16, w - 2 * t, 0.06, 0.1, 0x3a3f45);
  M.box('metal', x + door, 1.15, z - d / 2 + 0.13, 0.05, 2.3, 0.06, 0x3a3f45);
  M.add('regolith', new THREE.CylinderGeometry(d / 2, d / 2, w - 0.3, 36, 1, false, 0, PI), { pos: v(x, h, z), rot: e(0, 0, PI / 2), scale: v(rise, 1, 1), color: PRINT });
  // a shade canopy over the glass front on slim posts
  M.box('hull', x, h + 0.1, z - d / 2 - 0.9, w + 0.4, 0.14, 2.0, C.W);
  for (const s of [-1, 1]) M.cyl('metal', x + s * (w / 2 - 0.2), 0, z - d / 2 - 1.7, 0.06, h + 0.05, 0x3a3f45, 8);
  M.box('emissive', x, h + 0.02, z - d / 2 - 0.9, w * 0.8, 0.02, 0.08, L.warm);
  M.light(x, h - 0.4, z - d / 2 - 1.2, L.warm, 1.6, 9);
  M.col(x - w / 2, 0, z - d / 2 + 0.1, x + w / 2, h + d / 2 * rise, z + d / 2);
  M.col(x - w / 2 - 0.2, h, z - d / 2 - 1.9, x + w / 2 + 0.2, h + 0.2, z - d / 2);
}
function tree(M, x, z, h = 3, r = 1.1, k = 0) {
  M.cyl('plant', x, 0, z, 0.1, h, 0x5a3b26, 6);
  M.sphere('plant', x, h + r * 0.5, z, r, k % 2 ? 0x3d7f3a : 0x2f6b34, 10, 0.85);
  M.sphere('plant', x + r * 0.45, h + r * 0.1, z - r * 0.2, r * 0.65, 0x47843d, 8, 0.85);
  M.cyl('concrete', x, 0, z, 0.55, 0.12, 0x6d5a48, 14);
}
function bench(M, x, z, yaw = 0) {
  M.box('hull', x, 0.45, z, 1.6, 0.08, 0.45, C.W2, yaw);
  for (const s of [-0.6, 0.6]) M.box('metal', x + Math.cos(yaw) * s, 0.22, z - Math.sin(yaw) * s, 0.08, 0.44, 0.4, 0x3a3f45, yaw);
}

export function clinicOpen(M) {
  plinth(M, 8, 8);
  openHall(M, -0.4, 1.4, 6.8, 4.6, 3.3);
  // first floor in glass over part of the hall: consulting rooms
  M.box('glass', 0.6, 4.35, 2.0, 3.6, 1.7, 2.6);
  M.box('hull', 0.6, 5.3, 2.0, 3.9, 0.2, 2.9, C.W);
  M.box('hull', 0.6, 3.45, 2.0, 3.9, 0.16, 2.9, C.W);
  M.col(-1.3, 3.4, 0.7, 2.5, 5.4, 3.3);
  pvRack(M, -2.2, 2.2, 2.0, 1.0, 0, 2, 3.9);
  // ambulance bay and the ambulance
  M.box('hull', 2.7, 3.0, -2.6, 2.4, 0.14, 3.0, C.W);
  for (const [x, z] of [[1.6, -3.9], [3.8, -3.9]]) M.cyl('metal', x, 0, z, 0.06, 2.95, 0x3a3f45, 8);
  rover(M, 2.7, -2.4, PI / 2, 0xd23a2a);
  // red cross on a pylon, garden, benches
  M.box('hull', -3.4, 1.6, -3.6, 0.2, 3.2, 0.2, 0x3a3f45);
  symbol(M, 'cross', -3.4, 2.9, -3.66, 0.9, PI, 0xff3b3b);
  tree(M, -2.0, -3.4, 2.6, 0.9, 0);
  tree(M, 0.4, -3.6, 2.2, 0.8, 1);
  bench(M, -0.8, -3.9);
  for (let i = 0; i < 5; i++) M.sphere('plant', -3.6 + i * 0.4, 0.3, 3.7, 0.32, 0x3d7f3a, 7, 0.75);
  M.entry(-0.4);
}

export function cityhallOpen(M) {
  plinth(M, 14, 12);
  // the old control drum is now the council chamber, its window band opened all round
  const cx = 0.6, cz = 1.2;
  const ring = rr(4.6, 4.6, 2.2); ring.holes.push(rr(3.7, 3.7, 1.75));
  const g = new THREE.ExtrudeGeometry(ring, { depth: 4.6, bevelEnabled: false, curveSegments: 18 }); g.rotateX(-PI / 2);
  M.add('regolith', g, { pos: v(cx, 0, cz), color: PRINT });
  M.add('glass', new THREE.CylinderGeometry(2.25, 2.25, 1.6, 40, 1, true), { pos: v(cx, 5.4, cz) });
  for (let i = 0; i < 16; i++) { const a = i / 16 * PI * 2; M.box('metal', cx + Math.sin(a) * 2.27, 5.4, cz + Math.cos(a) * 2.27, 0.08, 1.65, 0.08, 0x3a3f45); }
  M.add('regolith', new THREE.SphereGeometry(2.45, 32, 12, 0, PI * 2, 0, PI / 2), { pos: v(cx, 6.2, cz), scale: v(1, 0.45, 1), color: PRINT });
  M.colCyl(cx, cz, 2.3, 0, 7.3);
  // assembly hall with a glass front
  openHall(M, -2.8, 2.4, 7.0, 5.0, 3.6);
  // the plaza: paving, trees, a fountain, benches, flags, the emblem
  M.box('concrete', 0, 0.03, -3.6, 13, 0.06, 4.2, 0xa89a88);
  for (const [x, k] of [[-5.6, 0], [-3.0, 1], [3.0, 0], [5.6, 1]]) tree(M, x, -4.6, 3.2, 1.2, k);
  M.cyl('concrete', 0.6, 0, -3.6, 1.3, 0.45, C.CONC, 28);
  M.cyl('hull', 0.6, 0.38, -3.6, 1.15, 0.04, 0x2c6a7a, 28);
  M.cyl('concrete', 0.6, 0.4, -3.6, 0.15, 0.8, C.CONC2, 10);
  M.colCyl(0.6, -3.6, 1.3, 0, 0.45);
  bench(M, -1.6, -2.4); bench(M, 2.8, -2.4);
  flag(M, -1.2, -5.4, 6.5, 'colony');
  flag(M, 2.4, -5.4, 6.5, 'agency');
  emblem(M, cx, 3.0, cz - 2.32, 0.7, PI);
  // the tracking antenna and the comm tower stay at work behind it
  M.asset('dsn34', 5.2, 0, 3.8, { scale: 0.11, anim: { pivot: [5.2, 0, 3.8], axis: [0, 1, 0], speed: 0.06 }, fixed: /base/ });
  M.colCyl(5.2, 3.8, 1.1, 0, 2.0);
  lattice(M, -5.6, 4.6, 1.6, 16, { mast: true, stairs: false });
  floodMast(M, -6.3, -2.0, 7, PI * 0.85);
  M.entry(-2.8);
}
