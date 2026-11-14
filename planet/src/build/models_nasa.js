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
import { facade, bays } from './modelkit.js';
import { N, vessel, tubeModule, radiatorWing, deployFrame, grating, ramp, avionics, bottleRack } from './nasakit.js';

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
// Medical habitat before the air is breathable, in the agency's own design
// language: a pressure vessel with a strapped fabric loft on a steel
// deployment frame, the front hatch on a grated porch with a ramp, a berthed
// medical module with a red band and the red cross, oxygen bottles in a
// rack, radiator wings behind, avionics in gold foil, a whip antenna.
export function clinic(M) {
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
  M.add('hull', new THREE.CylinderGeometry(0.975, 0.975, 0.34, 40, 1, true), { pos: v(1.6, 1.55, hz), rot: e(0, 0, PI / 2), color: 0xc8302a });
  M.box('hull', 2.55, 1.6, hz - 0.96, 0.9, 0.9, 0.04, 0xf2f2f2);
  M.box('concrete', 2.55, 1.6, hz - 0.99, 0.62, 0.18, 0.02, 0xc8262a);
  M.box('concrete', 2.55, 1.6, hz - 0.99, 0.18, 0.62, 0.02, 0xc8262a);
  // oxygen, radiators, avionics, antenna
  bottleRack(M, 2.6, -2.9, 0, 4);
  radiatorWing(M, -3.6, 3.55, 0, { w: 1.3, h: 2.4, y0: 0.5 });
  radiatorWing(M, -0.6, 3.55, 0, { w: 1.3, h: 2.4, y0: 0.5 });
  avionics(M, 3.0, 0, 3.0, 0.8, 0.7, 0.6);
  avionics(M, -3.3, 0, -2.6, 0.7, 0.6, 0.6);
  M.cyl('metal', hx + 0.6, cap - 0.25, hz + 0.4, 0.025, 1.6, N.FRAME, 6);
  M.sphere('blink', hx + 0.6, cap + 1.4, hz + 0.4, 0.05, L.red, 6);
  M.light(hx, 2.2, hz - 3.0, L.warm, 1.2, 6);
  M.entry(hx);
}

// ---------------------------------------------------------------- city hall
// Colony operations centre before the air is breathable: the main pressure
// vessel with its fabric loft on a deployment frame, a long control module
// berthed to it with the console windows, a logistics pod on the other side,
// a grated porch and ramp at the hatch, a bank of radiator wings, and the
// base's working kit: tracking antenna, comm tower, solar mast, floodlights,
// flags, the rover at its charger.
export function cityhall(M) {
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
  M.asset('dsn34', 5.4, 0, 4.6, { scale: 0.1, anim: { pivot: [5.4, 0, 4.6], axis: [0, 1, 0], speed: 0.06 }, fixed: /base/ });
  M.colCyl(5.4, 4.6, 1.0, 0, 1.8);
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
  M.entry(hx);
}

// ---------------------------------------------------------------- after the air is breathable
// Once people can breathe outside, the base becomes a town, built the way
// contemporary American civic buildings are: white precast panels, dark
// bronze aluminium mullions, glass curtain walls and ribbon windows, flat
// cantilevered roof plates, granite bases, plazas with street trees, pole
// lights, benches and flagpoles. Each building keeps the pressure vessel it
// grew from as its round chamber, so the town visibly grows out of the base.
const PRECAST = 0xe4e1d9, PRECAST2 = 0xd3cfc5, GRANITE = 0x8f8b85, BRONZE = 0x2f2b27, WHITE = 0xf2f1ee;

function frameAt(fx, fz, a) {
  const R = e(0, a, 0);
  return { R, W: (lx, ly, lz) => v(lx, ly, lz).applyEuler(R).add(v(fx, 0, fz)) };
}
// precast spandrels and continuous glass ribbons, storey by storey, on a
// face whose outward normal is local +z (a = PI faces -z, as facade())
function ribbon(M, fx, fz, a, len, y0, storeys, fh, { gh = 1.6, sill = 0.85, mull = 1.5, t = 0.3, skip = null } = {}) {
  const { R, W } = frameAt(fx, fz, a);
  const box = (k, lx, ly, lz, bw, bh, bd, col) => M.add(k, new THREE.BoxGeometry(bw, bh, bd), { pos: W(lx, ly, lz), rot: R, color: col });
  for (let st = 0; st < storeys; st++) {
    const y = y0 + st * fh;
    box('concrete', 0, y + sill / 2, -t / 2, len, sill, t, PRECAST);
    box('concrete', 0, y + sill + gh + (fh - sill - gh) / 2, -t / 2, len, fh - sill - gh, t, PRECAST);
    const gy = y + sill + gh / 2;
    if (skip && skip(st)) { box('concrete', 0, gy, -t / 2, len, gh, t, PRECAST); continue; }
    box('glass', 0, gy, -t + 0.12, len - 0.1, gh, 0.05);
    const n = Math.max(1, Math.round(len / mull));
    for (let i = 0; i <= n; i++) box('metal', -len / 2 + i * len / n, gy, -t + 0.17, 0.07, gh, 0.1, BRONZE);
    box('metal', 0, y + sill + 0.03, -t + 0.17, len, 0.06, 0.12, BRONZE);
    box('metal', 0, y + sill + gh - 0.03, -t + 0.17, len, 0.06, 0.12, BRONZE);
    box('concrete', 0, y + sill - 0.02, 0.03, len, 0.05, 0.08, PRECAST2);
  }
}
// full-height storefront curtain wall on a face (outward local +z)
function curtain(M, fx, fz, a, len, y0, h, { mull = 1.4, doors = [] } = {}) {
  const { R, W } = frameAt(fx, fz, a);
  const box = (k, lx, ly, lz, bw, bh, bd, col) => M.add(k, new THREE.BoxGeometry(bw, bh, bd), { pos: W(lx, ly, lz), rot: R, color: col });
  box('glass', 0, y0 + h / 2, 0, len, h, 0.05);
  const n = Math.max(1, Math.round(len / mull));
  for (let i = 0; i <= n; i++) box('metal', -len / 2 + i * len / n, y0 + h / 2, 0.06, 0.08, h, 0.14, BRONZE);
  for (const y of [y0 + 0.05, y0 + 2.6, y0 + h - 0.05]) if (y <= y0 + h) box('metal', 0, y, 0.06, len, 0.08, 0.14, BRONZE);
  for (const c of doors) { box('metal', c, y0 + 1.25, 0.08, 0.05, 2.5, 0.08, BRONZE); box('metal', c, y0 + 1.1, 0.12, 0.6, 0.04, 0.04, 0xb8bcc0); }
}
// the old pressure vessel as a round civic chamber: podium, clerestory, roof disc
function chamber(M, x, z, r, h, { y0 = 0.6, ports = [] } = {}) {
  M.add('stone', new THREE.CylinderGeometry(r + 0.25, r + 0.35, y0, 40), { pos: v(x, y0 / 2, z), color: GRANITE });
  vessel(M, x, z, { r, h, y0, loft: 0, hatches: [], ports, segs: 10 });
  const cy = y0 + h + 0.3;
  M.add('glass', new THREE.CylinderGeometry(r - 0.15, r - 0.15, 1.3, 40, 1, true), { pos: v(x, cy + 0.65, z) });
  for (let i = 0; i < 20; i++) { const a = i / 20 * PI * 2; M.box('metal', x + Math.sin(a) * (r - 0.12), cy + 0.65, z + Math.cos(a) * (r - 0.12), 0.06, 1.3, 0.06, BRONZE, a); }
  M.add('hull', new THREE.CylinderGeometry(r + 0.45, r + 0.45, 0.28, 48), { pos: v(x, cy + 1.44, z), color: WHITE });
  M.add('metal', new THREE.CylinderGeometry(r + 0.47, r + 0.47, 0.1, 48, 1, true), { pos: v(x, cy + 1.36, z), color: BRONZE });
  M.add('emissive', new THREE.TorusGeometry(r + 0.3, 0.025, 4, 48), { pos: v(x, cy + 1.29, z), rot: e(PI / 2, 0, 0), color: L.warm });
  M.colCyl(x, z, r + 0.45, 0, cy + 1.6);
}
function tree(M, x, z, h = 3.2, r = 1.2, k = 0) {
  M.cyl('plant', x, 0, z, 0.11, h, 0x5a3b26, 6);
  M.sphere('plant', x, h + r * 0.45, z, r, k % 2 ? 0x3d7f3a : 0x2f6b34, 10, 0.85);
  M.sphere('plant', x + r * 0.45, h + r * 0.1, z - r * 0.2, r * 0.65, 0x47843d, 8, 0.85);
  M.sphere('plant', x - r * 0.4, h + r * 0.2, z + r * 0.25, r * 0.6, 0x35753a, 8, 0.85);
  M.box('metal', x, 0.02, z, 1.2, 0.04, 1.2, 0x2a2b2c);
  M.colCyl(x, z, 0.15, 0, h);
}
function bench(M, x, z, yaw = 0) {
  for (let i = 0; i < 4; i++) M.box('hull', x, 0.45, z - 0.15 + i * 0.1, 1.8, 0.04, 0.08, 0x8a6a48, yaw);
  M.box('stone', x, 0.2, z, 1.9, 0.4, 0.5, GRANITE, yaw);
}
// slim LED area light
function poleLight(M, x, z, h = 5) {
  M.cyl('metal', x, 0, z, 0.08, h, 0x3a3d41, 8);
  M.box('metal', x, h + 0.05, z - 0.25, 0.22, 0.08, 0.7, 0x3a3d41);
  M.box('emissive', x, h, z - 0.25, 0.16, 0.02, 0.6, L.white);
  M.light(x, h - 0.2, z - 0.3, L.white, 1.0, 10);
  M.colCyl(x, z, 0.1, 0, h);
}
function flagpole(M, x, z, h, kind) {
  M.cyl('stone', x, 0, z, 0.3, 0.25, GRANITE, 12);
  flag(M, x, z, h, kind);
}
// louvered rooftop mechanical screen
function mechScreen(M, x, y, z, w, d, h = 1.4) {
  M.box('metal', x, y + h / 2, z, w, h, d, 0x9a9ea2);
  const n = Math.round(w / 0.25);
  for (let i = 0; i <= n; i++) for (const sz of [-1, 1]) M.box('metal', x - w / 2 + i * w / n, y + h / 2, z + sz * (d / 2 + 0.02), 0.04, h - 0.1, 0.04, 0x6e7276);
}

export function clinicOpen(M) {
  plinth(M, 8, 8, { color: GRANITE });
  // sidewalk and curb
  M.box('stone', 0, 0.04, -3.2, 8, 0.08, 1.6, 0xc4c0b8);
  M.box('stone', 0, 0.07, -3.95, 8, 0.14, 0.15, 0xa5a19a);
  // two-storey medical office bar: precast spandrels and ribbon windows
  const x0 = -0.6, x1 = 3.8, z0 = -0.8, z1 = 3.8, fh = 3.4, H = 2 * fh, t = 0.3;
  const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  ribbon(M, cx, z0, PI, w, 0, 2, fh, { t });
  ribbon(M, cx, z1, 0, w, 0, 2, fh, { t });
  ribbon(M, x1, cz, PI / 2, d - 2 * t, 0, 2, fh, { t, skip: (st) => st === 0 });
  ribbon(M, x0, cz, -PI / 2, d - 2 * t, 0, 2, fh, { t });
  // ambulance bay door on the east side
  M.box('metal', x1 + 0.02, 1.35, cz + 0.6, 0.06, 2.7, 2.6, 0xc9ccd0);
  for (let k = 0; k < 8; k++) M.box('metal', x1 + 0.06, 0.2 + k * 0.33, cz + 0.6, 0.03, 0.03, 2.5, 0x9a9ea2);
  M.box('concrete', x1 + 0.02, 2.85, cz + 0.6, 0.08, 0.3, 3.0, PRECAST2);
  M.bb('stone', x0 - 0.04, 0, z0 - 0.04, x1 + 0.04, 0.4, z1 + 0.04, GRANITE);
  // roof plate with a thin bronze fascia, mechanical screen
  M.bb('hull', x0 - 0.5, H, z0 - 0.7, x1 + 0.4, H + 0.3, z1 + 0.4, WHITE);
  M.bb('metal', x0 - 0.52, H - 0.05, z0 - 0.72, x1 + 0.42, H + 0.02, z1 + 0.42, BRONZE);
  mechScreen(M, cx + 0.6, H + 0.3, cz + 0.8, 2.2, 1.6, 1.2);
  M.col(x0, 0, z0, x1, H + 0.3, z1);
  // the old pressure vessel is the round waiting room, with a glass vestibule
  chamber(M, -2.0, 0.6, 1.8, 2.6, { y0: 0.45, ports: [{ a: -PI / 2, y: 1.6, r: 0.35 }, { a: PI * 0.75, y: 1.6, r: 0.35 }] });
  M.box('glass', -2.0, 1.3, -1.55, 1.9, 2.5, 0.05);
  for (const sx of [-1, 0, 1]) M.box('metal', -2.0 + sx * 0.93, 1.3, -1.6, 0.07, 2.5, 0.1, BRONZE);
  M.box('metal', -2.0, 2.6, -1.6, 1.95, 0.1, 0.1, BRONZE);
  M.box('hull', -2.0, 2.7, -1.0, 2.2, 0.12, 1.4, WHITE);
  for (const sx of [-1, 1]) M.box('glass', -2.0 + sx * 0.97, 1.3, -1.0, 0.05, 2.5, 1.1);
  // cantilevered drop-off canopy with the red cross on its edge
  M.box('hull', -1.6, 3.3, -2.5, 4.4, 0.24, 2.2, WHITE);
  M.box('metal', -1.6, 3.18, -2.5, 4.42, 0.03, 2.22, BRONZE);
  M.box('emissive', -1.6, 3.165, -2.5, 3.6, 0.02, 0.06, L.white);
  for (const sx of [-1, 1]) M.cyl('metal', -1.6 + sx * 1.9, 0, -3.35, 0.08, 3.2, 0x3a3d41, 10);
  M.box('concrete', -0.3, 3.3, -3.62, 0.36, 0.11, 0.03, 0xc8262a);
  M.box('concrete', -0.3, 3.3, -3.62, 0.11, 0.36, 0.03, 0xc8262a);
  M.col(-3.8, 3.15, -3.6, 0.6, 3.45, -1.4);
  // blade sign at the corner: white fin with the red cross
  M.box('hull', 3.55, 2.6, -1.45, 0.16, 5.2, 0.9, WHITE);
  for (const sx of [-1, 1]) {
    M.box('concrete', 3.55 + sx * 0.085, 4.4, -1.45, 0.02, 0.56, 0.17, 0xc8262a);
    M.box('concrete', 3.55 + sx * 0.085, 4.4, -1.45, 0.02, 0.17, 0.56, 0xc8262a);
  }
  M.col(3.45, 0, -1.9, 3.65, 5.2, -1.0);
  // street furniture
  tree(M, 1.2, -3.3, 2.8, 1.0, 0);
  bench(M, 2.7, -2.4, 0);
  poleLight(M, -3.6, -3.6, 4.6);
  M.entry(-2.0);
}

export function cityhallOpen(M) {
  plinth(M, 14, 12, { color: GRANITE });
  // civic plaza: light paving with granite bands
  M.box('stone', 0, 0.03, -3.6, 14, 0.06, 4.8, 0xcdc8be);
  for (const x of [-4.5, -1.5, 1.5, 4.5]) M.box('stone', x, 0.065, -3.6, 0.25, 0.02, 4.8, 0x9c978f);
  // three-storey office bar: a glazed ground floor recessed behind square
  // piers, two upper storeys of precast with vertical slot windows
  const x0 = -6.4, x1 = 2.6, z0 = 0.2, z1 = 5.6, fh = 3.7, H = 3 * fh;
  const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, t = 0.34;
  const slots = (st, len) => bays(len, { bay: 1.5, w: 0.75, sill: 0.25, head: 3.35 });
  const opt = { key: 'concrete', color: PRECAST, trim: PRECAST2, t, lines: false };
  facade(M, cx, z0, PI, w, fh, 2, fh, slots, opt);
  facade(M, cx, z1, 0, w, fh, 2, fh, slots, opt);
  facade(M, x0, cz, -PI / 2, d - 2 * t, fh, 2, fh, slots, opt);
  facade(M, x1, cz, PI / 2, d - 2 * t, fh, 2, fh, slots, opt);
  for (let st = 1; st < 3; st++) M.bb('concrete', x0 - 0.04, st * fh - 0.06, z0 - 0.06, x1 + 0.04, st * fh + 0.06, z1 + 0.04, PRECAST2);
  // ground floor: curtain wall set back 1.2 m behind the piers
  const gz = z0 + 1.2;
  curtain(M, cx, gz, PI, w - 0.8, 0, fh, { doors: [-2.7, -0.9].map((X) => cx - X) });
  curtain(M, x0 + 0.4, (gz + z1) / 2, -PI / 2, z1 - gz - 0.3, 0, fh);
  M.bb('concrete', x0, 0, z1 - 0.34, x1, fh, z1, PRECAST);
  M.bb('hull', x0, fh - 0.3, z0, x1, fh, gz, WHITE);
  for (let i = 0; i < 6; i++) M.box('emissive', x0 + 0.8 + i * (w - 1.6) / 5, fh - 0.31, (z0 + gz) / 2, 0.3, 0.02, 0.3, L.warm);
  for (let i = 0; i <= 5; i++) { const px = x0 + 0.25 + i * (w - 0.5) / 5; M.box('concrete', px, fh / 2, z0 + 0.25, 0.5, fh, 0.5, PRECAST); M.colCyl(px, z0 + 0.25, 0.28, 0, fh); }
  M.bb('stone', x0 - 0.04, 0, gz - 0.02, x1 + 0.04, 0.35, z1 + 0.04, GRANITE);
  // cantilevered roof plate, bronze fascia, rooftop screen
  M.bb('hull', x0 - 0.6, H, z0 - 1.1, x1 + 0.3, H + 0.35, z1 + 0.5, WHITE);
  M.bb('metal', x0 - 0.62, H - 0.06, z0 - 1.12, x1 + 0.32, H + 0.02, z1 + 0.52, BRONZE);
  mechScreen(M, cx - 1.0, H + 0.35, cz + 1.0, 3.6, 2.0, 1.6);
  M.col(x0, fh, z0, x1, H + 0.4, z1);
  M.col(x0, 0, gz, x1, fh, z1);
  // council chamber: the colony's first pressure vessel, kept as the round
  // chamber under a clerestory and a roof disc
  chamber(M, 4.5, 2.3, 2.3, 3.1, { y0: 0.6, ports: [{ a: -PI / 2, y: 2.0, r: 0.42 }, { a: PI * 0.8, y: 2.0, r: 0.42 }, { a: PI * 0.55, y: 2.0, r: 0.42 }, { a: PI / 2 + 0.2, y: 2.0, r: 0.42 }] });
  // glass link between the bar and the chamber
  M.bb('glass', x1, 0.4, 1.6, x1 + 0.35, 3.4, 3.0);
  M.bb('hull', x1 - 0.1, 3.4, 1.5, x1 + 0.45, 3.6, 3.1, WHITE);
  // entrance canopy: a glass plate on steel fins
  M.box('glass', -1.8, 3.2, -0.9, 4.0, 0.05, 2.2);
  for (const sx of [-1, 0, 1]) M.box('metal', -1.8 + sx * 1.8, 3.28, -0.9, 0.06, 0.18, 2.2, BRONZE);
  // the plaza: name monolith, flagpoles, street trees, benches, pole lights
  M.box('stone', -1.8, 0.55, -4.9, 3.4, 1.1, 0.5, GRANITE);
  M.box('metal', -1.8, 0.7, -5.16, 2.6, 0.22, 0.02, 0xc9b27a);
  M.box('emissive', -1.8, 0.12, -5.17, 3.2, 0.03, 0.02, L.warm);
  M.col(-3.5, 0, -5.15, -0.1, 1.1, -4.65);
  flagpole(M, -5.6, -4.8, 9, 'colony');
  flagpole(M, -4.6, -4.8, 9, 'agency');
  for (const [x, k] of [[1.4, 0], [3.4, 1], [5.4, 0]]) tree(M, x, -4.6, 3.2, 1.2, k);
  bench(M, 2.4, -2.6, 0); bench(M, 4.6, -2.6, 0);
  poleLight(M, -6.2, -2.6); poleLight(M, 6.3, -2.6);
  M.entry(-1.8);
}
