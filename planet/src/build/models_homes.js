// Homes for the in-between tiers, and the buildings the longer tier ladder
// needs. Same language as models_colony.js: white composite pressure hulls,
// dark ribbon glazing, glass garden domes, steel trusses. The top tier is the
// exception on purpose: people born on Arke live in open-air houses with no
// airlocks, because by then the air outside is breathable.
import * as THREE from 'three';
import { C, L, v, e, plinth, block, railing, antenna, vent, radiator, pvRack, habDome, gardenDome, linkTube, airlockTube, ribbonTower, ribDome, tank, rooftopPlant } from './modelkit.js';

const PI = Math.PI;
const ang = (x0, z0, x1, z1) => Math.atan2(x1 - x0, z1 - z0);

function tree(M, x, y, z, h = 2.2, r = 0.8, seed = 0) {
  M.cyl('plant', x, y, z, 0.07, h, 0x5a3b26, 5);
  M.sphere('plant', x, y + h + r * 0.55, z, r, seed % 2 ? 0x3d7f3a : 0x2f6b34, 9, 0.85);
  M.sphere('plant', x + r * 0.4, y + h + r * 0.2, z - r * 0.2, r * 0.6, 0x447f3c, 8, 0.85);
}
function planter(M, x, y, z, w, d, seed = 0) {
  M.box('concrete', x, y + 0.25, z, w, 0.5, d, C.CONC2);
  M.box('plant', x, y + 0.52, z, w - 0.12, 0.06, d - 0.12, 0x4a3a2a);
  const n = Math.max(2, Math.round(w * d * 1.2));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, px = x - w / 2 + 0.25 + ((i * 0.618 + seed * 0.13) % 1) * (w - 0.5), pz = z - d / 2 + 0.25 + t * (d - 0.5);
    M.sphere('plant', px, y + 0.7, pz, 0.22 + ((i * 37 + seed) % 5) * 0.03, i % 3 ? 0x3d7f3a : 0x5a8f3a, 7, 0.75);
  }
}
// barrel vault along x, sitting on y
function vault(M, x, y, z, r, len, color = C.W) {
  // half cylinder (its closed ends are the half-disc gables), turned to run along x
  M.add('hull', new THREE.CylinderGeometry(r, r, len, 36, 1, false, 0, PI), { pos: v(x, y, z), rot: e(0, 0, PI / 2), color });
  M.col(x - len / 2, y, z - r, x + len / 2, y + r * 0.8, z + r);
}

// ------------------------------------------------------------------ settler (tier 1)
// two-storey round house with a garden dome: the first home with a stair
export function houseS(M) {
  plinth(M, 8, 8);
  const T = [-0.9, 0.5], G = [2.45, 2.3];
  M.entry(T[0]);
  const top = ribbonTower(M, T[0], T[1], 2.65, 6.0, { fh: 3.0, door: true, skip: [ang(...T, ...G)], rot: 0.2, balconies: [0.9] });
  gardenDome(M, G[0], G[1], 1.25, { seed: 41 });
  linkTube(M, T[0], T[1], G[0], G[1], 0.75, 0.48);
  pvRack(M, 2.5, -2.4, 2.2, 1.0, 0.25, 2);
  radiator(M, -3.6, 0.3, 2.8, 0.9, 1.2, PI / 2, C.W2);
  antenna(M, T[0] + 0.8, top - 0.3, T[1] + 0.4, 1.6);
}

// dome home with a glazed sunroom workshop on the side
export function houseSb(M) {
  plinth(M, 8, 8);
  const D = [-1.3, 0.9];
  const top = habDome(M, D[0], D[1], 2.55, { skip: [PI, PI / 2] });
  M.entry(D[0]);
  airlockTube(M, D[0], 1.2, D[1] - 1.9, -3.6, 1.1);
  // sunroom: low glazed lean-to against the dome
  const H = block(M, 2.35, 0.6, 2.9, 4.4, { storeys: 1, fh: 3.0, bay: 1.45, win: 1.15, door: false, plant: false, seed: 77, parapet: 0.3 });
  M.box('glass', 2.35, H + 0.05, 0.6, 2.6, 0.06, 4.1);
  for (let i = 0; i < 4; i++) M.box('metal', 2.35, H + 0.1, -1.0 + i * 1.07, 2.7, 0.06, 0.06, C.G2);
  vent(M, D[0] - 0.6, top - 0.45, D[1] + 0.3, 0.55, 0.5, 0.35);
  pvRack(M, -2.2, -3.0, 2.0, 0.9, 0, 2);
  tank(M, 3.2, 0, -3.1, 0.45, 1.4, C.W2, C.G2);
}

// ------------------------------------------------------------------ artisan (tier 3)
// dome house with a workshop shed and a goods canopy out front
export function houseA(M) {
  plinth(M, 8, 8);
  const D = [1.6, 1.5];
  const top = habDome(M, D[0], D[1], 2.3, { skip: [-PI / 2, PI] });
  M.entry(-1.6);
  const H = block(M, -1.6, 0.2, 3.6, 6.6, { storeys: 1, fh: 3.6, bay: 1.8, win: 1.3, shop: true, plant: false, seed: 83, signColor: L.warm, canopyW: 3.0, canopyY: 3.0 });
  // north-light roof lights on the shed
  for (let i = 0; i < 3; i++) {
    const z = -2.2 + i * 2.1;
    M.box('glass', -1.6, H + 0.55, z, 3.0, 0.05, 1.2, undefined, 0);
    M.add('glass', new THREE.BoxGeometry(3.0, 0.05, 1.25), { pos: v(-1.6, H + 0.45, z), rot: e(-0.55, 0, 0) });
    M.box('hull', -1.6, H + 0.45, z + 0.62, 3.1, 0.9, 0.12, C.W2);
  }
  linkTube(M, -1.6, 1.4, D[0], D[1], 1.0, 0.5);
  airlockTube(M, D[0], 1.1, D[1] - 1.7, -3.2, 1.0);
  antenna(M, D[0], top - 0.4, D[1], 1.4);
  radiator(M, 3.6, 0.3, -2.4, 1.0, 1.2, PI / 2, C.W2);
}

// three-storey workshop tower: flat roof, outside stair, a dome studio below
export function houseAb(M) {
  plinth(M, 8, 8);
  const T = [-1.1, 1.0], D = [2.2, -1.6];
  M.entry(T[0]);
  ribbonTower(M, T[0], T[1], 2.35, 9.0, { fh: 3.0, door: true, cap: 'flat', skip: [ang(...T, ...D)], rot: 0.45, balconies: [1.6] });
  habDome(M, D[0], D[1], 1.65, { skip: [ang(...D, ...T)], drum: 2.7, oculus: false });
  linkTube(M, T[0], T[1], D[0], D[1], 0.85, 0.5);
  // the studio's sawtooth skylight
  M.add('glass', new THREE.BoxGeometry(1.6, 0.05, 1.1), { pos: v(D[0], 4.0, D[1]), rot: e(-0.5, 0, 0) });
  pvRack(M, 2.3, 2.4, 2.0, 1.0, PI, 2);
  tank(M, -3.3, 0, -2.9, 0.4, 1.3, C.W2, C.G2);
}

// ------------------------------------------------------------------ scientist (tier 5)
// tall tower crowned by a small observatory, instruments on the roof
export function houseR(M) {
  plinth(M, 8, 8);
  const T = [-0.6, 0.6];
  M.entry(T[0]);
  const top = ribbonTower(M, T[0], T[1], 2.6, 14.4, { door: true, cap: 'flat', plant: false, rot: 0.15, balconies: [1.2, -1.4], fins: 0 });
  // observatory drum and dome with an open slit
  const ox = T[0] + 0.7, oz = T[1] + 0.5, oy = top - 0.55;
  M.cyl('hull', ox, oy, oz, 1.15, 0.85, C.W2, 32);
  M.add('hull', new THREE.SphereGeometry(1.15, 32, 12, 0, PI * 2, 0, PI / 2), { pos: v(ox, oy + 0.85, oz), color: C.W });
  M.add('metal', new THREE.TorusGeometry(1.16, 0.2, 6, 18, PI * 0.9), { pos: v(ox, oy + 0.85, oz), rot: e(0, 0.9, PI * 0.05), scale: v(1, 1, 0.5), color: C.D });
  for (let i = 0; i < 3; i++) antenna(M, T[0] - 1.6 + i * 0.5, oy, T[1] - 1.1 + i * 0.25, 1.2 + i * 0.5, i % 2 ? L.green : L.red);
  gardenDome(M, 2.5, -2.3, 1.15, { seed: 51 });
  radiator(M, 3.4, 0.3, 2.3, 1.0, 1.3, PI / 2, C.W2);
  M.colCyl(ox, oz, 1.15, oy, oy + 2.0);
}

// twin towers joined high up, with a dish on the taller one
export function houseRb(M) {
  plinth(M, 8, 8);
  const A = [-1.4, -0.4], B = [1.9, 1.7];
  M.entry(A[0]);
  const ta = ribbonTower(M, A[0], A[1], 2.15, 12.6, { door: true, skip: [ang(...A, ...B)], cap: 'flat', plant: false, rot: 0.3 });
  ribbonTower(M, B[0], B[1], 1.6, 9.6, { skip: [ang(...B, ...A)], rot: 0.7, lobby: false });
  linkTube(M, A[0], A[1], B[0], B[1], 7.6, 0.55);
  linkTube(M, A[0], A[1], B[0], B[1], 1.0, 0.5);
  // steerable dish
  M.cyl('metal', A[0], ta - 0.6, A[1], 0.18, 1.4, C.G2, 10);
  const prof = [];
  for (let i = 0; i <= 10; i++) { const t = i / 10; prof.push(new THREE.Vector2(0.05 + t * 1.25, t * t * 0.55)); }
  M.add('hull', new THREE.LatheGeometry(prof, 28), { pos: v(A[0], ta + 0.9, A[1]), rot: e(-0.7, 0.4, 0), color: C.W });
  M.cyl('metal', A[0], ta + 0.9, A[1], 0.04, 0.9, C.D, 6);
  pvRack(M, 2.4, -2.6, 2.2, 1.0, 0.2, 2);
}

// ------------------------------------------------------------------ citizen (tier 6)
// cluster of three slender towers with garden crowns, linked at two levels
export function houseC(M) {
  plinth(M, 8, 8);
  const P = [[-1.5, -0.8, 1.75, 16, 'garden'], [1.9, -1.2, 1.45, 12.8, 'dome'], [0.6, 2.2, 1.55, 9.6, 'garden']];
  M.entry(P[0][0]);
  P.forEach(([x, z, r, h, cap], i) => {
    const others = P.filter((_, j) => j !== i).map(([x2, z2]) => ang(x, z, x2, z2));
    ribbonTower(M, x, z, r, h, { door: i === 0, cap, skip: others, rot: 0.3 + i, lobby: i === 0 });
  });
  for (const [a, b, y] of [[0, 1, 9.0], [0, 2, 6.2], [1, 2, 3.4]]) linkTube(M, P[a][0], P[a][1], P[b][0], P[b][1], y, 0.45);
}

// one slim finned tower beside a garden dome
export function houseCb(M) {
  plinth(M, 8, 8);
  const T = [-1.0, 0.3], G = [2.3, -1.9];
  M.entry(T[0]);
  const top = ribbonTower(M, T[0], T[1], 2.25, 19.2, { door: true, skip: [ang(...T, ...G)], fins: 12, cap: 'flat', rot: 0.25, balconies: [0.6, 2.4] });
  gardenDome(M, G[0], G[1], 1.5, { seed: 63 });
  linkTube(M, T[0], T[1], G[0], G[1], 0.8, 0.5);
  antenna(M, T[0] + 0.6, top - 0.5, T[1], 2.6);
  pvRack(M, 2.4, 2.5, 2.2, 1.0, PI, 2);
}

// ------------------------------------------------------------------ professional (tier 7)
// stepped tower: three drums, each terrace planted and railed
export function houseP(M) {
  plinth(M, 8, 8);
  M.entry(0);
  const D = [[0, 0, 3.3, 6.4], [0.3, 0.3, 2.5, 9.6], [0.5, 0.5, 1.75, 6.4]];
  let y0 = 0, top = 0;
  D.forEach(([x, z, r, h], i) => {
    top = ribbonTower(M, x, z, r, h, { y0, door: i === 0, cap: i === 2 ? 'garden' : 'flat', plant: false, rot: 0.1 + i * 0.4, lobby: i === 0 });
    // terrace on the setback: planting ring and a guard rail at the parapet
    if (i > 0) {
      const [px, pz, pr] = D[i - 1], rr = (pr + r) / 2 + 0.1;
      for (let k = 0; k < 12; k++) { const a = k / 12 * PI * 2; M.sphere('plant', px + Math.sin(a) * rr, y0 + 0.3, pz + Math.cos(a) * rr, 0.26, k % 2 ? 0x3d7f3a : 0x4f8a3e, 7, 0.75); }
      M.add('metal', new THREE.TorusGeometry(pr - 0.05, 0.035, 5, 40), { pos: v(px, y0 + 1.0, pz), rot: e(PI / 2, 0, 0), color: C.G });
    }
    y0 = top - 0.3;
  });
  antenna(M, 0.5, top - 0.2, 0.5, 2.2);
}

// tall tower and a lower one joined by a glazed sky bridge
export function housePb(M) {
  plinth(M, 8, 8);
  const A = [-1.2, 0.2], B = [2.3, -1.9];
  M.entry(A[0]);
  const ta = ribbonTower(M, A[0], A[1], 2.3, 24, { door: true, skip: [ang(...A, ...B)], balconies: [0.4, 1.9, -1.2], cap: 'garden', rot: 0.35 });
  ribbonTower(M, B[0], B[1], 1.4, 12.8, { skip: [ang(...B, ...A)], cap: 'dome', lobby: false, rot: 0.8 });
  // sky bridge: glazed box between the two at the 10th floor
  const mx = (A[0] + B[0]) / 2, mz = (A[1] + B[1]) / 2, len = Math.hypot(B[0] - A[0], B[1] - A[1]), yaw = Math.atan2(B[0] - A[0], B[1] - A[1]);
  M.add('glass', new THREE.BoxGeometry(1.2, 1.9, len), { pos: v(mx, 10.6, mz), rot: e(0, yaw, 0) });
  M.add('hull', new THREE.BoxGeometry(1.5, 0.25, len), { pos: v(mx, 9.55, mz), rot: e(0, yaw, 0), color: C.W2 });
  M.add('hull', new THREE.BoxGeometry(1.5, 0.2, len), { pos: v(mx, 11.65, mz), rot: e(0, yaw, 0), color: C.W2 });
  antenna(M, A[0], ta - 0.5, A[1] + 0.5, 2.4);
}

// ------------------------------------------------------------------ native (tier 9)
// open-air villa: two storeys with big windows, no airlock, roof garden, trees
export function houseN(M) {
  plinth(M, 8, 8, { color: C.CONC2 });
  M.entry(-0.8);
  const H = block(M, -0.4, 0.9, 6.2, 4.8, { storeys: 2, fh: 3.2, bay: 1.55, win: 1.35, plant: false, seed: 91, parapet: 0.45, color: C.CREAM, signColor: L.warm, canopyW: 2.6 });
  // roof garden
  M.box('plant', -0.4, H + 0.08, 0.9, 5.8, 0.1, 4.4, 0x4a3a2a);
  for (let i = 0; i < 9; i++) M.sphere('plant', -2.9 + (i % 5) * 1.25, H + 0.35, -0.6 + Math.floor(i / 5) * 2.8, 0.38, i % 2 ? 0x3d7f3a : 0x5a8f3a, 8, 0.75);
  tree(M, 0.9, H + 0.1, 1.6, 1.4, 0.7, 1);
  railing(M, -3.5, -1.5, 2.7, -1.5, H, 1.0, C.G);
  // timber pergola over the front terrace
  M.box('concrete', -0.4, 0.1, -2.6, 6.2, 0.2, 2.1, C.CONC);
  for (const x of [-3.3, 2.5]) M.box('plant', x, 1.4, -3.4, 0.14, 2.8, 0.14, C.WOOD);
  for (let i = 0; i < 8; i++) M.box('plant', -3.3 + i * 0.83, 2.85, -2.6, 0.08, 0.14, 2.0, C.WOOD);
  M.box('plant', -0.4, 2.75, -3.4, 6.0, 0.14, 0.12, C.WOOD);
  tree(M, 3.1, 0, -2.6, 2.6, 0.9, 2);
  tree(M, 3.2, 0, 2.9, 3.2, 1.0, 3);
  planter(M, -3.2, 0, 3.3, 1.4, 0.8, 4);
}

// courtyard house: an L of two wings around a garden with a pool
export function houseNb(M) {
  plinth(M, 8, 8, { color: C.CONC2 });
  M.entry(1.6);
  const Ha = block(M, -1.9, 0.9, 3.4, 5.8, { storeys: 2, fh: 3.1, bay: 1.6, win: 1.3, plant: false, seed: 97, parapet: 0.4, color: C.CREAM, door: false });
  const Hb = block(M, 1.75, 2.35, 3.9, 2.9, { storeys: 1, fh: 3.3, bay: 1.6, win: 1.4, plant: false, seed: 101, parapet: 0.4, color: C.CREAM, door: false });
  // garden court: lawn, pool, tree
  M.box('plant', 1.75, 0.03, -1.2, 3.9, 0.06, 4.2, 0x4f7a34);
  M.box('concrete', 1.4, 0.06, -0.6, 2.2, 0.12, 1.6, C.CONC);
  M.box('glass', 1.4, 0.13, -0.6, 2.0, 0.04, 1.4);
  tree(M, 2.9, 0, -2.8, 3.4, 1.1, 5);
  // shade sails on posts and a front gate
  M.add('hull', new THREE.BoxGeometry(3.4, 0.04, 2.0), { pos: v(1.6, 2.9, -2.6), rot: e(0.12, 0, 0.05), color: C.W });
  for (const [x, z] of [[0.0, -3.5], [3.3, -3.5]]) M.cyl('metal', x, 0, z, 0.06, 3.0, C.G2, 8);
  M.box('emissive', -1.9, Ha - 0.2, -2.05, 1.2, 0.08, 0.04, L.warm);
  M.box('plant', 1.75, Hb + 0.08, 2.35, 3.6, 0.1, 2.6, 0x4a3a2a);
  for (let i = 0; i < 5; i++) M.sphere('plant', 0.3 + i * 0.75, Hb + 0.3, 2.35, 0.32, 0x3d7f3a, 7, 0.75);
}

// ------------------------------------------------------------------ new colony buildings
// gym: barrel-vaulted hall, glazed ends, a court marked out in front
export function gym(M) {
  plinth(M, 10, 8);
  const H = block(M, 0, 1.4, 9.2, 4.8, { storeys: 1, fh: 3.4, bay: 2.3, win: 1.7, shop: true, plant: false, seed: 111, signColor: L.cyan, canopyW: 3.4, parapet: 0.2 });
  vault(M, 0, H, 1.4, 2.4, 9.0);
  M.add('glass', new THREE.BoxGeometry(8.6, 0.06, 0.9), { pos: v(0, H + 2.38, 1.4) });
  for (let i = 0; i < 6; i++) M.add('metal', new THREE.TorusGeometry(2.42, 0.05, 5, 24, PI), { pos: v(-3.8 + i * 1.52, H, 1.4), rot: e(0, PI / 2, 0), color: C.G2 });
  // court lines on the forecourt
  M.box('concrete', 0, 0.02, -2.6, 8.6, 0.04, 2.0, 0x5d7f8a);
  for (const [x, w, d] of [[0, 8.4, 0.05], [0, 0.05, 1.8], [-4.2, 0.05, 1.8], [4.2, 0.05, 1.8]]) M.box('concrete', x, 0.045, -2.6, w, 0.01, d, C.W);
  for (const x of [-3.9, 3.9]) { M.cyl('metal', x, 0, -2.6, 0.05, 2.4, C.G2, 8); M.box('hull', x, 2.4, -2.6, 0.08, 0.6, 0.9, C.W); }
}

// textile workshop: sawtooth north-light roof, spool store, dye tanks
export function textile(M) {
  plinth(M, 8, 8);
  const H = block(M, 0, 0.6, 7.2, 6.2, { storeys: 1, fh: 4.0, bay: 1.8, win: 1.2, shop: true, plant: false, seed: 121, signColor: L.violet, canopyW: 3.0, canopyY: 3.4 });
  for (let i = 0; i < 4; i++) {
    const z = -1.9 + i * 1.55;
    M.add('glass', new THREE.BoxGeometry(6.8, 0.05, 1.6), { pos: v(0, H + 0.6, z), rot: e(-0.72, 0, 0) });
    M.box('hull', 0, H + 0.6, z + 0.6, 7.0, 1.2, 0.12, C.W2);
  }
  M.col(-3.6, H, -2.5, 3.6, H + 1.3, 3.7);
  for (const x of [-3.3, -2.4]) tank(M, x, 0, -3.4, 0.38, 1.6, x < -3 ? 0x7a8cff : 0xd96a8a, C.G2);
  vent(M, 2.6, H + 0.05, 3.3, 0.7, 0.5, 0.4);
}

// dome orchard: a big glass dome of fruit trees and a service block
export function orchard(M) {
  plinth(M, 10, 10);
  gardenDome(M, 0.4, 1.0, 3.9, { seed: 131, drum: 0.7 });
  gardenDome(M, -3.4, -2.6, 1.3, { seed: 137 });
  // fruit among the leaves
  for (let i = 0; i < 26; i++) { const a = i * 2.4, d = 0.8 + (i % 6) * 0.45; M.sphere('emissive', 0.4 + Math.sin(a) * d, 2.0 + (i % 4) * 0.35, 1.0 + Math.cos(a) * d, 0.09, 0xff8a2a, 6); }
  block(M, 2.6, -3.4, 4.4, 2.6, { storeys: 1, fh: 3.0, bay: 1.6, win: 1.0, plant: false, seed: 139, signColor: L.green, canopyW: 2.2 });
  tank(M, -1.0, 0, -4.0, 0.5, 1.8, C.W2, C.GREEN);
  linkTube(M, 0.4, 1.0, 2.6, -3.4, 0.9, 0.45);
}

// pharmaceutical plant: clean-room block, exhaust stacks, process tanks
export function pharma(M) {
  plinth(M, 8, 8);
  const H = block(M, -0.6, 0.8, 6.2, 5.8, { storeys: 2, fh: 3.3, bay: 1.7, win: 1.0, plant: false, seed: 141, signColor: L.cyan, canopyW: 2.6 });
  M.box('metal', -1.9, 5.3, -2.13, 1.0, 1.0, 0.08, C.D);
  M.box('emissive', -1.9, 5.3, -2.18, 0.7, 0.2, 0.02, L.cyan);
  M.box('emissive', -1.9, 5.3, -2.18, 0.2, 0.7, 0.02, L.cyan);
  for (const [x, z, h] of [[0.6, 2.2, 3.2], [1.4, 2.2, 2.4]]) { M.cyl('hull', x, H, z, 0.22, h, C.W2, 12); M.cyl('metal', x, H + h, z, 0.26, 0.15, C.G2, 12); }
  for (const z of [-2.6, -1.2, 0.2]) tank(M, 3.35, 0, z, 0.42, 2.0, C.W, C.TEAL);
  M.box('metal', 3.35, 2.3, -1.2, 0.2, 0.12, 3.4, C.G2);
  vent(M, -2.6, H + 0.05, 2.6, 0.8, 0.6, 0.4);
}

// tram stop: rails across the lot, a sheltered platform, a car at the stop
export function transit(M) {
  plinth(M, 10, 6);
  for (const z of [0.85, 2.05]) M.box('metal', 0, 0.05, z, 10, 0.1, 0.12, C.G);
  for (let i = 0; i < 12; i++) M.box('concrete', -4.6 + i * 0.84, 0.03, 1.45, 0.3, 0.06, 1.8, C.CONC2);
  // platform and canopy
  M.box('concrete', 0, 0.25, -1.4, 8.4, 0.5, 2.4, C.CONC);
  M.col(-4.2, 0, -2.6, 4.2, 0.5, -0.2);
  for (const x of [-3.6, 0, 3.6]) M.cyl('metal', x, 0.5, -2.2, 0.09, 2.8, C.G2, 10);
  M.add('hull', new THREE.BoxGeometry(8.8, 0.14, 2.9), { pos: v(0, 3.35, -1.4), rot: e(0.06, 0, 0), color: C.W });
  M.box('emissive', 0, 3.25, -0.9, 8.0, 0.04, 0.1, L.cyan);
  M.box('glass', -2.0, 1.6, -2.45, 3.0, 2.1, 0.05);
  M.box('metal', -2.0, 0.95, -2.2, 2.4, 0.08, 0.35, C.D);
  M.box('emissive', 2.6, 2.2, -2.45, 1.4, 0.5, 0.04, L.warm);
  // overhead line on poles
  for (const x of [-4.6, 4.6]) { M.cyl('metal', x, 0, 2.7, 0.07, 4.6, C.G2, 8); M.box('metal', x, 4.5, 1.9, 0.08, 0.08, 1.7, C.G2); }
  M.box('metal', 0, 4.35, 1.45, 9.4, 0.03, 0.03, C.D);
  // the tram: rounded white body, ribbon glazing, pantograph
  const car = new THREE.Shape();
  const w = 7.2, h = 2.6, r = 0.9;
  car.moveTo(-w / 2 + r, 0); car.lineTo(w / 2 - r, 0); car.quadraticCurveTo(w / 2, 0, w / 2, r); car.lineTo(w / 2, h - r); car.quadraticCurveTo(w / 2, h, w / 2 - r, h);
  car.lineTo(-w / 2 + r, h); car.quadraticCurveTo(-w / 2, h, -w / 2, h - r); car.lineTo(-w / 2, r); car.quadraticCurveTo(-w / 2, 0, -w / 2 + r, 0);
  const body = new THREE.ExtrudeGeometry(car, { depth: 2.2, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 2, curveSegments: 8 });
  body.translate(0, 0, -1.1);
  M.add('hull', body, { pos: v(0, 0.45, 1.45), color: C.W });
  M.box('glass', 0, 2.05, 1.45, 6.6, 0.9, 2.42);
  M.box('hull', 0, 1.5, 0.3, 6.8, 0.12, 0.05, C.TEAL);
  M.box('metal', 0, 3.1, 1.45, 1.2, 0.08, 0.6, C.D);
  M.add('metal', new THREE.BoxGeometry(0.05, 1.3, 0.05), { pos: v(0, 3.7, 1.45), rot: e(0, 0, 0.5), color: C.D });
  M.col(-3.6, 0.45, 0.35, 3.6, 3.1, 2.55);
}

// university: three-storey teaching block, a library dome and a slender tower
export function university(M) {
  plinth(M, 12, 12);
  const H = block(M, -1.0, 2.2, 9.6, 5.6, { storeys: 3, fh: 3.4, bay: 2.0, win: 1.5, plant: false, seed: 151, signColor: L.white, canopyW: 3.6 });
  pvRack(M, -3.2, 2.2, 3.4, 1.1, 0, 2, H + 0.05);
  rooftopPlant(M, 1.4, H + 0.04, 2.6, 1.6, 23);
  // library: glazed drum under a ribbed dome
  M.cyl('hull', 3.6, 0, -3.2, 2.1, 3.6, C.W, 40);
  for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2; M.box('glass', 3.6 + Math.sin(a) * 2.12, 1.9, -3.2 + Math.cos(a) * 2.12, 0.8, 2.4, 0.05, undefined, a); }
  ribDome(M, 3.6, 3.6, -3.2, 2.1, { ribs: 10, rib: C.W2 });
  M.colCyl(3.6, -3.2, 2.1, 0, 5.4);
  // the tower
  const top = ribbonTower(M, -4.3, -3.6, 1.15, 15, { cap: 'dome', lobby: false, rot: 0.3 });
  antenna(M, -4.3, top - 0.1, -3.6, 2.0);
  // forecourt steps and lamps
  for (let k = 0; k < 3; k++) M.box('concrete', -1.0, 0.12 + k * 0.24, -1.2 - k * 0.32, 4.2 - k * 0.8, 0.24, 0.6, C.CONC2);
  for (const x of [-5.4, 1.2]) { M.cyl('metal', x, 0, -5.2, 0.06, 3.0, C.G2, 8); M.box('emissive', x, 2.97, -5.05, 0.14, 0.02, 0.5, L.warm); }
}
