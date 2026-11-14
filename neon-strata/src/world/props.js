// Instanced prop library: every model is built once (procedurally, around the origin, facing +z) and
// drawn thousands of times through InstancedMesh with per-instance tint.
import * as THREE from 'three';
import { ST } from '../render/cityMaterial.js';
import { Batch, Pen, M, ngonPts, rectPts, scalePts } from './builder.js';
import * as K from './kit.js';

const steel = K.dark(0.16), dk = K.dark(0.08), galv = K.metal([0.5, 0.52, 0.55]), conc = K.conc(0.42), rust = K.rust([0.42, 0.36, 0.32]);
const white = (i = 10, mode = 0) => K.emis([1, 1, 1], i, mode);
const M2 = (st, color) => M(st, { color });
const sphere = (pen, x, y, z, rx, ry, segs, mat, rings = 5) => { const prof = []; for (let i = 0; i <= rings; i++) { const a = -Math.PI / 2 + (i / rings) * Math.PI; prof.push([Math.max(0.001, Math.cos(a) * rx), y + Math.sin(a) * ry]); } pen.use(mat); pen.lathe(x, z, prof, segs, { cap: false }); };

export const PROPS = {
  // --- street lighting -------------------------------------------------------------------
  lampA(pen) { // arterial light pylon, 11 m, arm towards +z
    pen.use(conc); pen.lathe(0, 0, [[0.42, 0], [0.36, 0.5], [0.24, 0.62]], 8, { cap: false });
    pen.use(steel); pen.tube(0, 0.6, 0, 0, 9.4, 0, 0.2, 8, { r1: 0.12 });
    pen.tube(0, 9.4, 0, 0, 10.4, 0.9, 0.12, 6, { r1: 0.1 }); pen.tube(0, 10.4, 0.9, 0, 10.8, 2.3, 0.1, 6, { r1: 0.09 }); pen.tube(0, 10.8, 2.3, 0, 10.75, 3.3, 0.09, 6);
    pen.box(0, 3.3, 0.62, 1.7, 10.62, 10.82, { wall: steel, roof: steel, bottom: white(14) });
    pen.box(0, 0.24, 0.3, 0.24, 3.0, 3.5, { wall: galv, roof: galv, bottom: galv }); pen.box(0, 0.4, 0.12, 0.1, 3.2, 3.3, { wall: K.emis([0.2, 1, 0.6], 4, 2) });
    pen.use(steel); pen.tube(0, 6.2, 0, 0, 6.2, -0.9, 0.05, 4); pen.box(0, -1.0, 0.7, 0.08, 5.8, 6.6, { wall: K.emis([0.3, 0.8, 1.0], 2.5), roof: steel });
  },
  lampB(pen) { // utility pole with transformer, street lamp, crossarms
    pen.use(K.conc(0.36)); pen.tube(0, 0, 0, 0, 9, 0, 0.17, 7, { r1: 0.12 });
    pen.use(steel); pen.beam(-1.1, 8.4, 0, 1.1, 8.4, 0, 0.1, 0.1); pen.beam(-0.8, 7.6, 0, 0.8, 7.6, 0, 0.09, 0.09);
    for (const x of [-1.0, -0.4, 0.4, 1.0]) { pen.use(K.conc(0.55)); pen.tube(x, 8.45, 0, x, 8.7, 0, 0.06, 5); }
    pen.use(galv); pen.lathe(0.42, 0, [[0.3, 6.1], [0.33, 6.2], [0.33, 7.0], [0.28, 7.1]], 8, {}); pen.use(steel); pen.beam(0, 6.5, 0, 0.3, 6.5, 0, 0.08, 0.3);
    pen.tube(0, 7.2, 0, 0, 7.6, 1.6, 0.05, 5); pen.box(0, 1.75, 0.3, 0.7, 7.5, 7.64, { wall: steel, roof: steel, bottom: white(12) });
    pen.box(0.2, 0, 0.28, 0.2, 1.4, 1.9, { wall: galv, roof: galv, bottom: galv }); pen.box(-0.2, 0.02, 0.3, 0.16, 2.2, 2.9, { wall: rust, roof: rust, bottom: rust });
    pen.use(dk); for (let i = 0; i < 3; i++) pen.tube(-1.0 + i * 0.6, 8.6, 0, -1.0 + i * 0.6 + 0.2, 8.2, 1.2, 0.02, 3);
  },
  lampC(pen) { // slim plaza light column with glowing shaft
    pen.use(steel); pen.lathe(0, 0, [[0.3, 0], [0.16, 0.3], [0.13, 5.4]], 8, { cap: false });
    pen.use(white(9)); pen.lathe(0, 0, [[0.14, 5.4], [0.14, 7.4]], 8, { cap: false });
    pen.use(steel); pen.lathe(0, 0, [[0.16, 7.4], [0.2, 7.5], [0.02, 7.9]], 8, { cap: false });
  },
  bollard(pen) { pen.use(steel); pen.lathe(0, 0, [[0.13, 0], [0.13, 0.7], [0.11, 0.74]], 8, {}); pen.use(white(5)); pen.lathe(0, 0, [[0.135, 0.5], [0.135, 0.6]], 8, { cap: false }); },
  // --- street furniture --------------------------------------------------------------------
  bench(pen) {
    pen.box(0, 0, 1.9, 0.5, 0.4, 0.48, { wall: K.rust([0.38, 0.3, 0.24]), roof: K.rust([0.4, 0.32, 0.26]), bottom: dk });
    pen.use(steel); for (const x of [-0.8, 0.8]) { pen.box(x, 0, 0.08, 0.46, 0, 0.4, {}); pen.beam(x, 0.48, -0.22, x, 0.95, -0.32, 0.06, 0.06); }
    pen.box(0, -0.3, 1.9, 0.06, 0.62, 0.95, { wall: K.rust([0.38, 0.3, 0.24]), roof: steel });
  },
  bin(pen) { pen.use(galv); pen.lathe(0, 0, [[0.26, 0], [0.3, 0.85], [0.31, 0.9]], 8, { roof: dk }); pen.use(K.emis([0.3, 1, 0.5], 2)); pen.lathe(0, 0, [[0.305, 0.7], [0.305, 0.74]], 8, { cap: false }); },
  crates(pen) {
    const cs = [[0, 0, 0.9, 0.7, 0, 0.6, [0.36, 0.3, 0.22]], [0.1, 0.05, 0.7, 0.6, 0.6, 1.15, [0.24, 0.3, 0.34]], [0.95, 0.1, 0.8, 0.8, 0, 0.7, [0.34, 0.24, 0.2]], [-0.8, 0.2, 0.6, 0.5, 0, 0.45, [0.3, 0.32, 0.24]]];
    for (const [x, z, w, d, y0, y1, c] of cs) { pen.box(x, z, w, d, y0, y1, { wall: K.rust(c), roof: K.rust(c) }); pen.use(dk); pen.box(x, z, w + 0.03, 0.06, (y0 + y1) / 2 - 0.02, (y0 + y1) / 2 + 0.02, {}); }
  },
  barrels(pen) { for (const [x, z, c] of [[0, 0, [0.2, 0.3, 0.42]], [0.66, 0.1, [0.42, 0.24, 0.18]], [0.3, 0.6, [0.38, 0.36, 0.2]]]) { pen.use(K.rust(c)); pen.lathe(x, z, [[0.28, 0], [0.3, 0.05], [0.3, 0.86], [0.28, 0.9]], 8, {}); } },
  vending(pen) {
    pen.box(0, 0, 1.15, 0.8, 0, 1.95, { wall: K.metal([0.2, 0.22, 0.26]), roof: dk });
    pen.use({ st: ST.SCREEN, color: [1, 1, 1], seed: 77, cellW: 8, floorH: 12, extra: 22 }); pen.quad(-0.5, 0.75, 0.41, 0.5, 0.75, 0.41, 0.5, 1.85, 0.41, -0.5, 1.85, 0.41, 0, 0, 1, 1);
    pen.use(white(3)); pen.quad(-0.5, 0.2, 0.41, 0.5, 0.2, 0.41, 0.5, 0.62, 0.41, -0.5, 0.62, 0.41, 0, 0, 1, 1);
    pen.box(0, 0.42, 1.2, 0.05, 0.64, 0.72, { wall: dk, roof: dk, bottom: dk }); pen.box(0, 0.05, 1.25, 0.9, 1.95, 2.02, { wall: dk, roof: dk, bottom: dk });
  },
  kiosk(pen) { // holo information terminal
    pen.use(K.metal([0.24, 0.26, 0.3])); pen.loft([{ y: 0, pts: rectPts(0.7, 0.5) }, { y: 0.9, pts: rectPts(0.55, 0.36, 0, 0.02) }, { y: 1.15, pts: rectPts(0.62, 0.2, 0, 0.14) }], { roof: dk });
    pen.use(K.emis([0.3, 0.9, 1.0], 6)); pen.quad(-0.42, 1.2, 0.2, 0.42, 1.2, 0.2, 0.42, 1.75, 0.02, -0.42, 1.75, 0.02, 0, 0, 1, 1);
    pen.use(dk); pen.quad(0.42, 1.2, 0.19, -0.42, 1.2, 0.19, -0.42, 1.75, 0.01, 0.42, 1.75, 0.01, 0, 0, 1, 1); pen.use(K.emis([0.3, 0.9, 1.0], 3)); pen.lathe(0, 0, [[0.36, 0.02], [0.36, 0.06]], 8, { cap: false });
  },
  utilBox(pen) {
    pen.box(0, 0, 1.3, 0.5, 0.1, 1.5, { wall: K.metal([0.36, 0.38, 0.36]), roof: galv }); pen.box(0, 0, 1.4, 0.6, 0, 0.1, { wall: conc, roof: conc });
    pen.use({ st: ST.LOUVER, color: [0.3, 0.32, 0.32] }); pen.quad(-0.5, 0.9, 0.26, 0.5, 0.9, 0.26, 0.5, 1.35, 0.26, -0.5, 1.35, 0.26, 0, 0.9, 1, 1.35);
    pen.use(K.emis([1, 0.3, 0.1], 5, 2, false, 31)); pen.box(0.5, 0.27, 0.06, 0.03, 0.6, 0.66, {});
  },
  barrier(pen) { pen.use({ st: ST.METAL, color: [0.7, 0.5, 0.05], flags: 16 }); pen.box(0, 0, 1.8, 0.1, 0.5, 1.0, { roof: steel, bottom: steel }); pen.use(steel); for (const x of [-0.8, 0.8]) { pen.box(x, 0, 0.08, 0.5, 0, 0.08, {}); pen.box(x, 0, 0.06, 0.06, 0.08, 0.5, {}); } pen.use(K.emis([1, 0.5, 0.05], 12, 2, false, 5)); pen.lathe(0.8, 0, [[0.07, 1.0], [0.07, 1.12], [0.01, 1.16]], 6, {}); },
  planter(pen) { pen.box(0, 0, 1.6, 1.6, 0, 0.55, { wall: K.conc(0.4), roof: K.rust([0.2, 0.16, 0.12]) }); sphere(pen, 0, 1.15, 0, 0.85, 0.75, 8, K.foliage([0.28, 0.5, 0.24])); sphere(pen, 0.4, 0.95, 0.3, 0.5, 0.45, 6, K.foliage([0.34, 0.52, 0.2]), 4); },
  tree(pen) {
    pen.use(K.rust([0.3, 0.24, 0.2])); pen.tube(0, 0, 0, 0.15, 3.2, 0.1, 0.2, 6, { r1: 0.13 }); pen.tube(0.15, 3.2, 0.1, -0.5, 4.6, 0.3, 0.1, 5, { r1: 0.06 }); pen.tube(0.15, 3.2, 0.1, 0.9, 4.4, -0.3, 0.1, 5, { r1: 0.06 });
    sphere(pen, 0.1, 5.4, 0, 2.0, 1.6, 9, K.foliage([0.26, 0.48, 0.22])); sphere(pen, -1.1, 4.6, 0.6, 1.2, 1.0, 7, K.foliage([0.3, 0.52, 0.2]), 4); sphere(pen, 1.2, 4.5, -0.5, 1.3, 1.0, 7, K.foliage([0.22, 0.44, 0.22]), 4);
    pen.use(steel); pen.lathe(0, 0, [[0.9, 0], [0.9, 0.06], [0.3, 0.06]], 8, { cap: false });
  },
  // --- market ------------------------------------------------------------------------------
  stall(pen) {
    const w = 3.4, d = 2.2, h = 2.5;
    pen.use(steel); for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) pen.tube(a * w / 2, 0, b * d / 2, a * w / 2, h + (b < 0 ? 0.45 : 0), b * d / 2, 0.035, 4);
    pen.box(0, 0.55, w, 0.7, 0, 0.92, { wall: M2(ST.CORRUGATED, [0.3, 0.36, 0.4]), roof: K.rust([0.3, 0.25, 0.2]) });
    pen.box(0, 0.55, w + 0.1, 0.8, 0.92, 0.97, { wall: galv, roof: galv, bottom: dk });
    pen.use(K.fabric([0.3, 0.42, 0.5], 3)); pen.quad(-w / 2 - 0.3, h - 0.15, d / 2 + 1.0, w / 2 + 0.3, h - 0.15, d / 2 + 1.0, w / 2 + 0.3, h + 0.5, -d / 2 - 0.2, -w / 2 - 0.3, h + 0.5, -d / 2 - 0.2, 0, 0, w, d);
    pen.quad(w / 2 + 0.3, h - 0.15, d / 2 + 1.0, -w / 2 - 0.3, h - 0.15, d / 2 + 1.0, -w / 2 - 0.3, h + 0.5, -d / 2 - 0.2, w / 2 + 0.3, h + 0.5, -d / 2 - 0.2, 0, 0, w, d);
    pen.use(K.fabric([0.3, 0.42, 0.5], 3)); pen.quad(-w / 2 - 0.3, h - 0.5, d / 2 + 1.0, w / 2 + 0.3, h - 0.5, d / 2 + 1.0, w / 2 + 0.3, h - 0.15, d / 2 + 1.0, -w / 2 - 0.3, h - 0.15, d / 2 + 1.0, 0, 0, w, 0.35);
    for (const [x, c] of [[-1.1, [0.5, 0.2, 0.12]], [-0.3, [0.5, 0.42, 0.14]], [0.5, [0.2, 0.4, 0.2]], [1.15, [0.42, 0.26, 0.3]]]) { pen.box(x, 0.62, 0.62, 0.46, 0.97, 1.12, { wall: K.rust([0.3, 0.26, 0.2]), roof: M2(ST.FABRIC, c) }); }
    pen.use(white(9)); pen.lathe(-0.9, 0.4, [[0.02, h - 0.2], [0.12, h - 0.42], [0.1, h - 0.6], [0.02, h - 0.66]], 6, { cap: false }); pen.lathe(0.9, 0.4, [[0.02, h - 0.2], [0.12, h - 0.42], [0.1, h - 0.6], [0.02, h - 0.66]], 6, { cap: false });
    pen.use(steel); pen.lathe(-0.6, 1.7, [[0.17, 0.42], [0.17, 0.46]], 7, {}); pen.tube(-0.6, 0, 1.7, -0.6, 0.42, 1.7, 0.03, 4); pen.lathe(0.7, 1.8, [[0.17, 0.42], [0.17, 0.46]], 7, {}); pen.tube(0.7, 0, 1.8, 0.7, 0.42, 1.8, 0.03, 4);
    pen.box(0, -d / 2 + 0.2, w * 0.8, 0.3, 0.92, 1.9, { wall: K.rust([0.26, 0.24, 0.22]), roof: dk });
    pen.use(rust); pen.lathe(1.2, -0.3, [[0.22, 0.97], [0.26, 1.35], [0.2, 1.38]], 7, {}); pen.use(K.emis([1, 0.5, 0.15], 3, 1, false, 9)); pen.lathe(1.2, -0.3, [[0.18, 1.39], [0.01, 1.4]], 6, { cap: false });
  },
  cart(pen) { // hover food cart with parasol
    pen.box(0, 0, 1.7, 0.95, 0.35, 1.0, { wall: K.metal([0.42, 0.44, 0.46]), roof: galv, bottom: dk });
    pen.use(K.emis([0.2, 0.8, 1.0], 5)); pen.box(0, 0, 1.5, 0.75, 0.3, 0.35, { bottom: true });
    pen.use(steel); pen.tube(0.6, 1.0, -0.3, 0.6, 2.5, -0.3, 0.03, 4);
    pen.use(K.fabric([0.5, 0.2, 0.16], 5)); pen.lathe(0.6, -0.3, [[1.25, 2.3], [0.7, 2.55], [0.03, 2.72]], 8, { cap: false });
    pen.use(K.fabric([0.5, 0.2, 0.16], 5)); pen.lathe(0.6, -0.3, [[0.03, 2.71], [0.7, 2.54], [1.25, 2.29]], 8, { cap: false });
    pen.use(rust); pen.lathe(-0.4, 0, [[0.2, 1.0], [0.24, 1.3], [0.2, 1.33]], 7, {}); pen.lathe(0.2, 0.1, [[0.16, 1.0], [0.18, 1.2]], 7, {});
    pen.use(white(8)); pen.lathe(0.6, -0.3, [[0.02, 2.2], [0.1, 2.05], [0.02, 1.95]], 6, { cap: false });
  },
  // --- vehicles ----------------------------------------------------------------------------
  hovercar(pen) {
    const plan = (l, w, n = 12) => { const p = []; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; const c = Math.cos(a), s = Math.sin(a); p.push([Math.sign(c) * Math.pow(Math.abs(c), 0.55) * w, -Math.sign(s) * Math.pow(Math.abs(s), 0.7) * l]); } return p; };
    pen.use(K.metal([0.3, 0.32, 0.36])); pen.loft([{ y: 0.32, pts: plan(1.9, 0.7) }, { y: 0.5, pts: plan(2.3, 0.98) }, { y: 0.9, pts: plan(2.25, 0.96) }], { cap: false, capBottom: true });
    pen.use(K.glassDark([0.3, 0.4, 0.5])); pen.loft([{ y: 0.9, pts: plan(1.75, 0.9).map(([x, z]) => [x, z - 0.15]) }, { y: 1.28, pts: plan(1.05, 0.68).map(([x, z]) => [x, z - 0.3]) }], { cap: false });
    pen.use(K.metal([0.3, 0.32, 0.36])); pen.poly(plan(1.05, 0.68).map(([x, z]) => [x, z - 0.3]), 1.28, true); pen.poly(plan(2.25, 0.96), 0.9, true);
    for (const [x, z] of [[-0.95, 1.5], [0.95, 1.5], [-0.95, -1.5], [0.95, -1.5]]) { pen.use(dk); pen.lathe(x, z, [[0.2, 0.2], [0.34, 0.3], [0.34, 0.5], [0.2, 0.58]], 8, { cap: false }); pen.use(K.emis([0.3, 0.8, 1.0], 6)); pen.lathe(x, z, [[0.3, 0.26], [0.02, 0.24]], 8, { cap: false }); }
    pen.use(white(10)); pen.box(0, 2.24, 1.3, 0.06, 0.62, 0.7, {}); pen.use(K.emis([1, 0.1, 0.05], 8)); pen.box(0, -2.2, 1.5, 0.06, 0.66, 0.72, {});
  },
  scooter(pen) {
    pen.use(K.metal([0.34, 0.2, 0.18])); pen.loft([{ y: 0.3, pts: rectPts(0.3, 1.5, 0, 0, 0.1) }, { y: 0.55, pts: rectPts(0.42, 1.7, 0, 0, 0.14) }, { y: 0.72, pts: rectPts(0.32, 1.2, 0, -0.1, 0.1) }], { roof: dk, capBottom: true });
    pen.use(steel); pen.tube(0, 0.6, 0.7, 0, 1.15, 0.55, 0.035, 4); pen.beam(-0.3, 1.15, 0.55, 0.3, 1.15, 0.55, 0.05, 0.05);
    pen.use(K.emis([0.3, 0.8, 1.0], 5)); pen.box(0, 0, 0.26, 1.3, 0.24, 0.29, { bottom: true }); pen.use(white(8)); pen.box(0, 0.86, 0.2, 0.04, 0.5, 0.58, {});
  },
  droneDock(pen) { pen.use(steel); pen.tube(0, 0, 0, 0, 3.4, 0, 0.07, 5); pen.use(galv); pen.lathe(0, 0, [[0.1, 3.4], [0.6, 3.5], [0.62, 3.58], [0.1, 3.6]], 8, {}); pen.use(K.emis([0.3, 1, 0.5], 8, 2, false, 12)); pen.lathe(0, 0, [[0.63, 3.52], [0.63, 3.56]], 8, { cap: false }); pen.box(0, 0, 0.5, 0.5, 3.6, 3.85, { wall: dk, roof: dk }); for (const [x, z] of [[-0.4, -0.4], [0.4, -0.4], [0.4, 0.4], [-0.4, 0.4]]) { pen.use(dk); pen.lathe(x, z, [[0.2, 3.86], [0.2, 3.9]], 6, {}); } },
  // --- rooftop plant -----------------------------------------------------------------------
  chiller(pen) {
    pen.box(0, 0, 2.6, 1.3, 0.25, 1.6, { wall: { st: ST.LOUVER, color: [0.44, 0.46, 0.48] }, roof: galv });
    pen.use(steel); pen.box(0, 0, 2.7, 1.4, 0, 0.25, { roof: steel });
    for (const x of [-0.65, 0.65]) { pen.use(dk); pen.lathe(x, 0, [[0.52, 1.6], [0.52, 1.78], [0.46, 1.8]], 10, { cap: false }); pen.use(K.dark(0.03)); pen.lathe(x, 0, [[0.46, 1.74], [0.01, 1.72]], 10, { cap: false }); }
    pen.use(rust); pen.tube(1.3, 0.5, 0.3, 2.0, 0.5, 0.3, 0.07, 5); pen.tube(2.0, 0.5, 0.3, 2.0, 0.05, 0.3, 0.07, 5);
  },
  acSmall(pen) { pen.box(0, 0, 0.95, 0.4, 0.12, 0.8, { wall: K.metal([0.5, 0.5, 0.48]), roof: galv }); pen.use(K.dark(0.04)); pen.quad(-0.42, 0.2, 0.205, 0.12, 0.2, 0.205, 0.12, 0.72, 0.205, -0.42, 0.72, 0.205, 0, 0, 1, 1); pen.use(steel); pen.box(0, 0, 1.0, 0.45, 0, 0.12, {}); },
  tank(pen) {
    pen.use(steel); for (const [x, z] of [[-0.9, -0.9], [0.9, -0.9], [0.9, 0.9], [-0.9, 0.9]]) pen.beam(x, 0, z, x, 2.2, z, 0.12, 0.12);
    pen.beam(-0.9, 1.0, -0.9, 0.9, 1.9, -0.9, 0.06, 0.06); pen.beam(0.9, 1.0, 0.9, -0.9, 1.9, 0.9, 0.06, 0.06); pen.box(0, 0, 2.2, 2.2, 2.1, 2.25, { roof: steel, bottom: steel });
    pen.use(K.rust([0.4, 0.34, 0.28])); pen.lathe(0, 0, [[1.25, 2.25], [1.3, 2.4], [1.3, 5.0], [1.2, 5.15], [0.1, 5.6]], 12, { cap: false });
    pen.use(dk); pen.lathe(0, 0, [[1.32, 3.1], [1.32, 3.2]], 12, { cap: false }); pen.lathe(0, 0, [[1.32, 4.3], [1.32, 4.4]], 12, { cap: false });
    pen.use(steel); pen.beam(1.4, 0, -0.25, 1.4, 5.1, -0.25, 0.04, 0.04); pen.beam(1.4, 0, 0.25, 1.4, 5.1, 0.25, 0.04, 0.04); for (let y = 0.4; y < 5; y += 0.5) pen.beam(1.4, y, -0.25, 1.4, y, 0.25, 0.03, 0.03);
  },
  mast(pen) { // lattice antenna mast 18 m
    const H = 18; pen.use(steel);
    for (const a of [0, 2.094, 4.189]) { const c = Math.cos(a), s = Math.sin(a); pen.beam(c * 1.3, 0, s * 1.3, c * 0.25, H, s * 0.25, 0.1, 0.1); }
    for (let i = 1; i < 7; i++) { const y = (i / 7) * H, r = 1.3 - (1.05 * i) / 7; for (let k = 0; k < 3; k++) { const a = k * 2.094, b = a + 2.094; pen.beam(Math.cos(a) * r, y, Math.sin(a) * r, Math.cos(b) * r, y, Math.sin(b) * r, 0.05, 0.05); const r2 = 1.3 - (1.05 * (i - 1)) / 7; pen.beam(Math.cos(a) * r2, y - H / 7, Math.sin(a) * r2, Math.cos(b) * r, y, Math.sin(b) * r, 0.04, 0.04); } }
    pen.tube(0, H, 0, 0, H + 3.5, 0, 0.06, 4, { r1: 0.02 });
    for (const [y, a, r] of [[11, 0.5, 0.9], [13.5, 2.8, 0.7], [9, 4.2, 1.1]]) { const c = Math.cos(a), s = Math.sin(a); pen.use(galv); pen.tube(c * 0.5, y, s * 0.5, c * 0.9, y, s * 0.9, 0.05, 4); pen.lathe(c * 1.05, s * 1.05, [[0.02, y - 0.02], [r * 0.6, y + 0.12], [r, y + 0.38]], 9, { cap: false }); pen.lathe(c * 1.05, s * 1.05, [[r, y + 0.39], [r * 0.6, y + 0.13], [0.02, y - 0.01]], 9, { cap: false }); }
    pen.use(galv); pen.box(0.5, 0.2, 0.16, 0.5, 15, 16.6, {}); pen.box(-0.4, -0.3, 0.16, 0.5, 14.4, 16, {});
    pen.use(K.emis([1, 0.12, 0.06], 22, 2, false, 3)); pen.lathe(0, 0, [[0.14, H + 3.5], [0.14, H + 3.8], [0.02, H + 3.95]], 6, {}); pen.use(K.emis([1, 0.12, 0.06], 10, 2, false, 3)); pen.lathe(0, 0, [[0.3, H * 0.55], [0.3, H * 0.55 + 0.2]], 6, { cap: false });
  },
  dish(pen) { pen.use(steel); pen.tube(0, 0, 0, 0, 1.1, 0, 0.07, 5); pen.beam(0, 1.1, 0, 0, 1.5, 0.35, 0.1, 0.1); pen.use(galv); const r = 1.0; const prof = [[0.03, 1.5], [r * 0.5, 1.58], [r * 0.85, 1.78], [r, 2.0]]; pen.lathe(0, 0.5, prof, 10, { cap: false }); pen.lathe(0, 0.5, [...prof].reverse().map(([a, y]) => [a, y + 0.015]), 10, { cap: false }); pen.use(steel); pen.tube(0, 1.55, 0.5, 0, 2.3, 0.5, 0.025, 4); pen.box(0, 0.5, 0.12, 0.12, 2.3, 2.42, {}); },
  vent(pen) { pen.use(galv); pen.tube(0, 0, 0, 0, 1.3, 0, 0.26, 8); pen.tube(0, 1.3, 0, 0, 1.75, 0.4, 0.26, 8); pen.tube(0, 1.75, 0.4, 0, 1.75, 0.9, 0.26, 8, { r1: 0.3 }); pen.use(dk); pen.lathe(0, 0, [[0.3, 0], [0.3, 0.12]], 8, {}); },
  ventCap(pen) { pen.use(galv); pen.lathe(0, 0, [[0.3, 0], [0.3, 0.9]], 8, { cap: false }); pen.use(steel); pen.lathe(0, 0, [[0.55, 0.95], [0.5, 1.15], [0.05, 1.3]], 8, { cap: false }); pen.lathe(0, 0, [[0.3, 0.9], [0.55, 0.94]], 8, { cap: false }); },
  solar(pen) { pen.use(steel); pen.beam(-1.3, 0, -0.5, -1.3, 0.5, -0.5, 0.06, 0.06); pen.beam(1.3, 0, -0.5, 1.3, 0.5, -0.5, 0.06, 0.06); pen.beam(-1.3, 0, 0.6, -1.3, 1.3, 0.6, 0.06, 0.06); pen.beam(1.3, 0, 0.6, 1.3, 1.3, 0.6, 0.06, 0.06); pen.use({ st: ST.MIRROR, color: [0.1, 0.12, 0.25] }); pen.quad(-1.5, 0.45, -0.7, 1.5, 0.45, -0.7, 1.5, 1.4, 0.8, -1.5, 1.4, 0.8, 0, 0, 3, 1.8); pen.use(dk); pen.quad(1.5, 0.43, -0.7, -1.5, 0.43, -0.7, -1.5, 1.38, 0.8, 1.5, 1.38, 0.8, 0, 0, 3, 1.8); },
  cooler(pen) { pen.use(galv); pen.lathe(0, 0, [[1.5, 0], [1.5, 1.8], [1.2, 2.3], [1.2, 2.7]], 12, { cap: false }); pen.use(K.dark(0.03)); pen.lathe(0, 0, [[1.18, 2.55], [0.02, 2.5]], 12, { cap: false }); pen.use(steel); pen.lathe(0, 0, [[1.55, 0.5], [1.55, 0.62]], 12, { cap: false }); pen.beam(-1.2, 2.7, 0, 1.2, 2.7, 0, 0.08, 0.06); pen.beam(0, 2.7, -1.2, 0, 2.7, 1.2, 0.08, 0.06); pen.use({ st: ST.LOUVER, color: [0.3, 0.32, 0.34] }); pen.lathe(0, 0, [[1.52, 0.7], [1.52, 1.5]], 12, { cap: false }); },
  duct(pen) { pen.box(0, 0, 0.7, 5, 0.5, 1.1, { wall: galv, roof: galv, bottom: galv }); pen.box(0, 2.5, 0.7, 0.7, 0, 1.1, { wall: galv, roof: galv }); pen.use(steel); for (const z of [-1.8, 0]) { pen.box(0, z, 0.8, 0.08, 0, 0.5, {}); } pen.use(dk); for (const z of [-2, -1, 0, 1]) pen.box(0, z, 0.74, 0.05, 0.5, 1.12, {}); },
  shack(pen) { pen.box(0, 0, 3.4, 2.8, 0, 2.4, { wall: M2(ST.CORRUGATED, [0.34, 0.33, 0.3]), roof: null }); pen.use(M2(ST.CORRUGATED, [0.3, 0.26, 0.24])); pen.quad(-1.9, 2.3, 1.6, 1.9, 2.3, 1.6, 1.9, 2.75, -1.6, -1.9, 2.75, -1.6, 0, 0, 3.8, 3.2); pen.use(K.emis([1, 0.7, 0.4], 2.2)); pen.quad(-0.5, 0.9, 1.41, 0.3, 0.9, 1.41, 0.3, 1.7, 1.41, -0.5, 1.7, 1.41, 0, 0, 1, 1); pen.use(dk); pen.quad(0.7, 0, 1.41, 1.4, 0, 1.41, 1.4, 1.95, 1.41, 0.7, 1.95, 1.41, 0, 0, 1, 1); },
  sofa(pen) { const f = M(ST.FABRIC, { color: [0.2, 0.2, 0.24], flags: 8 }), d = M(ST.COMPOSITE, { color: [0.12, 0.12, 0.14], flags: 8 }); pen.box(0, 0, 1.0, 2.0, 0.12, 0.44, { wall: f, roof: f }); pen.box(-0.42, 0, 0.18, 2.0, 0.44, 0.9, { wall: f, roof: f }); pen.box(0, 0.95, 1.0, 0.14, 0.12, 0.62, { wall: f, roof: f }); pen.box(0, -0.95, 1.0, 0.14, 0.12, 0.62, { wall: f, roof: f }); pen.box(0, 0, 0.9, 1.9, 0, 0.12, { wall: d, roof: d }); },
  planterIn(pen) { pen.use(M(ST.COMPOSITE, { color: [0.16, 0.16, 0.18], flags: 8 })); pen.lathe(0, 0, [[0.34, 0], [0.42, 0.7], [0.4, 0.74]], 8, {}); sphere(pen, 0, 1.3, 0, 0.6, 0.7, 8, M(ST.FOLIAGE, { color: [0.24, 0.46, 0.22], flags: 8 })); sphere(pen, 0.2, 1.85, 0.1, 0.36, 0.4, 6, M(ST.FOLIAGE, { color: [0.3, 0.5, 0.2], flags: 8 }), 4); },
  stool(pen) { pen.use(M(ST.METAL, { color: [0.3, 0.3, 0.32], flags: 8 })); pen.tube(0, 0, 0, 0, 0.66, 0, 0.04, 5); pen.lathe(0, 0, [[0.2, 0], [0.2, 0.03]], 8, {}); pen.use(M(ST.FABRIC, { color: [0.36, 0.14, 0.1], flags: 8 })); pen.lathe(0, 0, [[0.19, 0.66], [0.2, 0.72], [0.17, 0.74]], 8, {}); },
  shelf(pen) { // faces +z, 2.2 wide, goods on four boards
    const fr = M(ST.METAL, { color: [0.3, 0.3, 0.32], flags: 8 }); pen.box(0, 0, 2.1, 0.5, 0, 0.1, { wall: fr, roof: fr }); for (const x of [-1.05, 1.05]) pen.box(x, 0, 0.05, 0.5, 0, 2.1, { wall: fr, roof: fr }); pen.box(0, -0.24, 2.1, 0.03, 0, 2.1, { wall: fr, roof: fr });
    const cols = [[0.5, 0.2, 0.14], [0.2, 0.36, 0.42], [0.46, 0.4, 0.16], [0.2, 0.4, 0.24], [0.4, 0.4, 0.42], [0.42, 0.22, 0.36]];
    for (let i = 0; i < 4; i++) { const y = 0.1 + i * 0.5; pen.box(0, 0, 2.06, 0.46, y + 0.42, y + 0.45, { wall: fr, roof: fr, bottom: fr }); for (let k = 0; k < 6; k++) { const c = cols[(i * 5 + k * 3) % 6]; pen.box(-0.86 + k * 0.345, 0.04, 0.3, 0.34, y, y + 0.2 + ((i + k) % 3) * 0.07, { wall: M(ST.FABRIC, { color: c, flags: 8 }), roof: M(ST.FABRIC, { color: c, flags: 8 }) }); } }
    pen.use(K.emis([1, 0.9, 0.75], 3)); pen.box(0, 0.2, 2.0, 0.04, 2.06, 2.09, { bottom: true });
  },
  rack(pen) { // server / parts rack with status lights
    const fr = M(ST.COMPOSITE, { color: [0.12, 0.12, 0.14], flags: 8 }); pen.box(0, 0, 2.0, 0.6, 0, 2.2, { wall: fr, roof: fr });
    for (let i = 0; i < 7; i++) { pen.use(M(ST.LOUVER, { color: [0.3, 0.3, 0.34], flags: 8 })); pen.quad(-0.9, 0.2 + i * 0.28, 0.305, 0.9, 0.2 + i * 0.28, 0.305, 0.9, 0.42 + i * 0.28, 0.305, -0.9, 0.42 + i * 0.28, 0.305, 0, i, 1.8, i + 0.22); pen.use(K.emis(i % 3 === 0 ? [0.2, 1, 0.5] : [0.2, 0.8, 1], 6, i % 2 ? 2 : 0, false, i * 13)); pen.box(0.78, 0.31, 0.12, 0.02, 0.28 + i * 0.28, 0.32 + i * 0.28, {}); }
  },
  signal(pen) { // traffic signal: mast arm over the carriageway (+z), vehicle heads, pedestrian box, push-button
    pen.use(steel); pen.tube(0, 0, 0, 0, 6.2, 0, 0.11, 6, { r1: 0.09 }); pen.tube(0, 5.9, 0, 0, 6.3, 4.6, 0.07, 5); pen.lathe(0, 0, [[0.2, 0], [0.16, 0.35]], 6, { cap: false });
    for (const z of [1.9, 4.3]) { pen.box(0, z, 0.34, 0.26, 5.35, 6.25, { wall: dk, roof: dk, bottom: dk }); pen.use(K.emis([1, 0.12, 0.06], 12, 2, false, 40)); pen.box(0, z + 0.14, 0.2, 0.02, 5.98, 6.18, {}); pen.use(K.emis([0.15, 1, 0.5], 9, 2, false, 168)); pen.box(0, z + 0.14, 0.2, 0.02, 5.42, 5.62, {}); pen.use(K.emis([1, 0.6, 0.1], 1.2)); pen.box(0, z + 0.14, 0.2, 0.02, 5.7, 5.9, {}); }
    pen.box(0.2, 0, 0.2, 0.3, 2.5, 3.1, { wall: dk, roof: dk, bottom: dk }); pen.use(K.emis([0.15, 1, 0.5], 7, 2, false, 168)); pen.box(0.31, 0, 0.02, 0.22, 2.56, 2.78, {}); pen.use(K.emis([1, 0.12, 0.06], 7, 2, false, 40)); pen.box(0.31, 0, 0.02, 0.22, 2.82, 3.04, {});
    pen.box(0, 0.13, 0.12, 0.06, 1.05, 1.25, { wall: K.metal([0.7, 0.6, 0.1]), roof: dk }); pen.box(0, -0.2, 0.5, 0.05, 3.4, 3.75, { wall: K.metal([0.15, 0.3, 0.5]), roof: dk });
  },
  shelter(pen) { // transit stop: canopy, glazed back, bench, lit ad panel and a route display (open towards +z)
    pen.use(steel); for (const x of [-2.0, 2.0]) pen.box(x, -0.55, 0.09, 0.09, 0, 2.6, {}); pen.box(0, -0.1, 4.5, 1.5, 2.6, 2.7, { wall: steel, roof: K.metal([0.3, 0.32, 0.36]), bottom: white(3) });
    pen.use(K.glassDark([0.35, 0.45, 0.5])); pen.quad(-2.0, 0.3, -0.55, 0.6, 0.3, -0.55, 0.6, 2.3, -0.55, -2.0, 2.3, -0.55, 0, 0, 1, 1);
    pen.box(1.35, -0.55, 1.3, 0.16, 0.25, 2.35, { wall: dk, roof: dk }); pen.use({ st: ST.SCREEN, color: [1, 1, 1], seed: 63, cellW: 10, floorH: 16, extra: 22 }); pen.quad(0.78, 0.4, -0.46, 1.92, 0.4, -0.46, 1.92, 2.2, -0.46, 0.78, 2.2, -0.46, 0, 0, 1, 1);
    pen.box(-0.7, -0.3, 2.2, 0.36, 0.42, 0.5, { wall: K.rust([0.36, 0.3, 0.26]), roof: K.rust([0.38, 0.32, 0.28]), bottom: dk }); pen.use(steel); for (const x of [-1.6, 0.2]) pen.box(x, -0.3, 0.06, 0.3, 0, 0.42, {});
    pen.use(steel); pen.tube(2.45, 0, 0.3, 2.45, 3.0, 0.3, 0.05, 5); pen.box(2.45, 0.3, 0.5, 0.08, 2.5, 3.2, { wall: K.emis([1, 0.75, 0.3], 3), roof: dk });
  },
  // --- shopfront clutter + street tech ------------------------------------------------------
  table(pen) { // plastic table with three stools: the pavement extension of every eatery
    pen.use(M2(ST.PLASTER, [0.62, 0.2, 0.16])); pen.lathe(0, 0, [[0.42, 0.7], [0.44, 0.72], [0.42, 0.74]], 10, {}); pen.use(steel); pen.tube(0, 0, 0, 0, 0.7, 0, 0.04, 5); pen.lathe(0, 0, [[0.26, 0], [0.24, 0.03]], 8, {});
    for (let i = 0; i < 3; i++) { const a = i * 2.094 + 0.5; pen.use(M2(ST.PLASTER, [0.2, 0.3, 0.46])); pen.lathe(Math.cos(a) * 0.74, Math.sin(a) * 0.74, [[0.15, 0], [0.13, 0.42], [0.17, 0.45], [0.15, 0.47]], 7, {}); }
    pen.use(M2(ST.METAL, [0.5, 0.5, 0.52])); pen.lathe(0.12, 0.08, [[0.05, 0.74], [0.05, 0.86]], 5, {}); pen.use(white(2)); pen.lathe(-0.14, -0.06, [[0.04, 0.74], [0.035, 0.84]], 5, {});
  },
  aboard(pen) { // A-frame pavement sign with a lit, cycling face
    pen.use(dk); pen.quad(-0.32, 0, 0.26, 0.32, 0, 0.26, 0.32, 1.05, 0.03, -0.32, 1.05, 0.03, 0, 0, 1, 1); pen.quad(0.32, 0, -0.26, -0.32, 0, -0.26, -0.32, 1.05, -0.03, 0.32, 1.05, -0.03, 0, 0, 1, 1);
    pen.use({ st: ST.SCREEN, color: [1, 1, 1], seed: 31, cellW: 6, floorH: 9, extra: 12 }); pen.quad(-0.27, 0.12, 0.248, 0.27, 0.12, 0.248, 0.27, 0.98, 0.058, -0.27, 0.98, 0.058, 0, 0, 1, 1);
  },
  rackOut(pen) { // tiered display stand of crated goods
    const fr = K.rust([0.3, 0.26, 0.22]); const cs = [[0.6, 0.2, 0.12], [0.62, 0.5, 0.14], [0.24, 0.42, 0.2], [0.5, 0.3, 0.4], [0.7, 0.62, 0.5]];
    for (let i = 0; i < 3; i++) { const y = 0.35 + i * 0.36, z = 0.2 - i * 0.2; pen.box(0, z, 1.7, 0.42, y - 0.05, y, { wall: fr, roof: fr, bottom: fr });
      for (let k = 0; k < 4; k++) { const c = cs[(i * 2 + k) % 5]; pen.box(-0.62 + k * 0.41, z, 0.36, 0.34, y, y + 0.2, { wall: M2(ST.PLASTER, c), roof: M2(ST.FABRIC, c) }); } }
    pen.use(steel); for (const x of [-0.84, 0.84]) { pen.beam(x, 0, 0.4, x, 1.15, -0.25, 0.04, 0.04); pen.beam(x, 0, -0.3, x, 1.15, -0.25, 0.04, 0.04); }
  },
  bot(pen) { // pavement delivery robot
    pen.use(K.metal([0.62, 0.64, 0.66])); pen.loft([{ y: 0.2, pts: rectPts(0.5, 0.74, 0, 0, 0.12) }, { y: 0.62, pts: rectPts(0.52, 0.76, 0, 0, 0.14) }, { y: 0.74, pts: rectPts(0.42, 0.62, 0, 0, 0.14) }], { roof: K.metal([0.3, 0.32, 0.36]), capBottom: true });
    pen.use(dk); for (const [x, z] of [[-0.28, 0.26], [0.28, 0.26], [-0.28, 0], [0.28, 0], [-0.28, -0.26], [0.28, -0.26]]) pen.box(x, z, 0.07, 0.2, 0.0, 0.2, {});
    pen.use(K.emis([0.3, 0.95, 1.0], 6)); pen.box(0, 0.385, 0.34, 0.02, 0.44, 0.52, {}); pen.use(steel); pen.tube(0.18, 0.72, -0.26, 0.18, 1.3, -0.26, 0.012, 3); pen.use(K.emis([1, 0.5, 0.1], 10, 2, false, 5)); pen.box(0.18, -0.26, 0.05, 0.05, 1.3, 1.36, {});
  },
  drone(pen) { // courier quad-rotor (flies the low lanes; see fx/traffic)
    pen.use(K.metal([0.26, 0.28, 0.32])); pen.loft([{ y: -0.08, pts: rectPts(0.34, 0.5, 0, 0, 0.1) }, { y: 0.1, pts: rectPts(0.3, 0.44, 0, 0, 0.1) }], { roof: dk, capBottom: true });
    for (const [x, z] of [[-0.5, 0.5], [0.5, 0.5], [-0.5, -0.5], [0.5, -0.5]]) { pen.use(steel); pen.beam(0, 0.04, 0, x, 0.1, z, 0.05, 0.04); pen.use(M2(ST.DARKGLASS, [0.3, 0.3, 0.34])); pen.lathe(x, z, [[0.3, 0.13], [0.02, 0.15]], 8, { cap: false }); pen.use(dk); pen.lathe(x, z, [[0.31, 0.09], [0.31, 0.15]], 8, { cap: false }); }
    const bx = M2(ST.PLASTER, [0.5, 0.4, 0.26]); pen.box(0, 0, 0.36, 0.42, -0.4, -0.1, { wall: bx, roof: bx, bottom: bx });
    pen.use(K.emis([0.2, 1, 0.4], 14, 2, false, 3)); pen.box(0, 0.27, 0.08, 0.04, 0.0, 0.06, {}); pen.use(K.emis([1, 0.1, 0.05], 14)); pen.box(0, -0.27, 0.08, 0.04, 0.0, 0.06, {});
  },
  trash(pen) { for (const [x, z, r, c] of [[0, 0, 0.42, [0.1, 0.1, 0.12]], [0.6, 0.2, 0.36, [0.14, 0.14, 0.14]], [0.2, 0.55, 0.3, [0.3, 0.3, 0.32]], [-0.5, 0.3, 0.33, [0.1, 0.12, 0.1]]]) sphere(pen, x, r * 0.7, z, r, r * 0.75, 6, M2(ST.FABRIC, c), 3); pen.box(-0.2, -0.5, 0.6, 0.4, 0, 0.35, { wall: K.rust([0.36, 0.3, 0.22]), roof: K.rust([0.36, 0.3, 0.22]) }); },
};

// build geometries; returns { name: BufferGeometry }
export function buildPropGeometries() {
  const out = {};
  for (const name in PROPS) { const b = new Batch(512); const pen = new Pen(b); pen.at(0, 0, 0, 0); PROPS[name](pen); out[name] = b.build(); }
  return out;
}

// turn recorded instances into InstancedMeshes grouped by coarse cell for culling
export function instanceProps(ctx, material, group, cell = 720) {
  const geos = buildPropGeometries(); const cells = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
  let total = 0;
  for (const name in ctx.props) {
    const list = ctx.props[name]; if (!geos[name] || !list.length) continue;
    const buckets = new Map();
    for (const it of list) { const k = Math.floor(it[0] / cell) * 1000 + Math.floor(it[2] / cell); let a = buckets.get(k); if (!a) { a = []; buckets.set(k, a); } a.push(it); }
    for (const [, arr] of buckets) {
      const im = new THREE.InstancedMesh(geos[name], material, arr.length); im.matrixAutoUpdate = false;
      let cx = 0, cz = 0, cy = 0;
      arr.forEach((it, i) => { p.set(it[0], it[1], it[2]); q.setFromAxisAngle(up, it[3]); s.setScalar(it[4]); m4.compose(p, q, s); im.setMatrixAt(i, m4); const t = it[5]; col.setRGB(t ? t[0] : 1, t ? t[1] : 1, t ? t[2] : 1); im.setColorAt(i, col); cx += it[0]; cy += it[1]; cz += it[2]; });
      im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.computeBoundingSphere(); group.add(im); total += arr.length;
      cells.push({ mesh: im, x: cx / arr.length, y: cy / arr.length, z: cz / arr.length, r: im.boundingSphere ? im.boundingSphere.radius : cell });
    }
  }
  return { cells, total, geos };
}
