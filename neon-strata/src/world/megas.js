// Megastructures: the Spire (hollow, walk-in atrium, sky dock, lifts, Zenith deck above the clouds),
// the Bulwark sea wall + sea, cloud-piercing district giants and the outland skyline.
import { ST, PAL, WK, FLAG } from '../render/cityMaterial.js';
import { M, rectPts, scalePts, ngonPts } from './builder.js';
import * as K from './kit.js';
import { boundaryAngle, DISTRICTS, COAST_X, R_CITY, R_CORE, yawFacing } from './layout.js';
import { reserve, nearestBlock } from './plan.js';
import { megaTower, techTower, landingPad } from './buildings.js';
import { archiveSpire, farmTower } from './buildings2.js';
import { STYLES } from './districts.js';
import { Vol, facade, shopSign } from './facade.js';
import { TAU, fbm2 } from '../core/rng.js';

export const SPIRE = { R_IN: 180, GATE_HW: 23, GATE_H: 72, BASE_H: 84, DOCK_Y: 420, ATR_H: 720, ZEN_Y: 1500, ZEN_R: 560, LIFT_R: 162, TOP: 2760 };
const HULL = [[0, 352], [84, 330], [240, 288], [420, 262], [880, 222], [1250, 196], [1440, 178], [1500, 172]];
export function hullR(y) { for (let i = 0; i < HULL.length - 1; i++) { const a = HULL[i], b = HULL[i + 1]; if (y <= b[0]) return a[1] + (b[1] - a[1]) * ((y - a[0]) / (b[0] - a[0])); } return 172; }
const IN = FLAG.INDOOR;

export function buildSpire(ctx) {
  const rng = ctx.rng.fork('spire'); const B = ctx.big('spire'); const pen = ctx.pen; const S = SPIRE;
  const use = () => { ctx.cur = { main: B.main, detail: B.main, glow: B.glow }; pen.to(B.main); };
  const at = (yaw = 0, y = 0) => { use(); pen.at(0, y, 0, yaw); };
  at();
  const hull = M(ST.MEGAHULL, { color: [0.34, 0.35, 0.38], seed: 21, A: 0.55, B: PAL.MIXED });
  const hullDark = M(ST.MEGAHULL, { color: [0.24, 0.25, 0.28], seed: 44, A: 0.35, B: PAL.COOL });
  const frame = M(ST.COMPOSITE, { color: [0.2, 0.21, 0.24], seed: 3 });
  const gold = K.NEON.gold;
  const gates = []; for (let k = 0; k < 8; k++) gates.push(boundaryAngle(k, 345));
  const lifts = [0, 2, 4, 6].map((k) => (DISTRICTS[k].ang * Math.PI) / 180);
  const dO = Math.asin(S.GATE_HW / 340), dI = Math.asin(S.GATE_HW / S.R_IN);
  // lathe angle convention: point = (cos a · r, −sin a · r) → world angle θ (atan2(z,x)) = −a
  const arc = (prof, th0, th1, o = {}) => pen.lathe(0, 0, prof, Math.max(3, Math.round(((th1 - th0) / TAU) * 64)), { ...o, a0: -th1, a1: -th0, cap: false });

  // ---- base ring (y 0..GATE_H) with eight gates
  for (let k = 0; k < 8; k++) {
    const g0 = gates[k], g1 = gates[(k + 1) % 8] + (k === 7 ? TAU : 0);
    pen.use(hull); arc([[hullR(0), 0], [hullR(S.GATE_H), S.GATE_H]], g0 + dO, g1 - dO, { aoB: 0.5 });
    pen.use(M(ST.WIN_LUX, { color: [0.24, 0.24, 0.26], seed: k * 9, A: 0.75, B: PAL.WARM, cellW: 5, floorH: 6, flags: WK.COMPOSITE | IN })); arc([[S.R_IN, 0], [S.R_IN, S.GATE_H]], g0 + dI, g1 - dI, { inside: true });
  }
  // ---- gate tunnels + portal surrounds
  gates.forEach((ga, k) => {
    const yaw = yawFacing(Math.cos(ga), Math.sin(ga)); at(yaw);
    const zA = S.R_IN - 6, zB = 356, hw = S.GATE_HW, H = S.GATE_H;
    const tun = M(ST.COMPOSITE, { color: [0.3, 0.3, 0.32], seed: k, flags: IN });
    pen.use(tun); pen.wall(hw, zA, hw, zB, 0, H, {}); pen.wall(-hw, zB, -hw, zA, 0, H, {}); pen.flat(-hw, zA, hw, zB, H, false, 0.8);
    pen.use(M(ST.TILE, { color: [0.36, 0.36, 0.38], flags: IN })); pen.flat(-hw, zA, hw, zB, 0.08);
    for (let z = zA + 14; z < zB - 6; z += 22) { pen.use(K.emis(K.NEON.gold, 9)); pen.box(0, z, hw * 1.7, 1.2, H - 0.5, H - 0.2, { bottom: true }); pen.box(hw - 0.2, z, 0.3, 1.0, 3, 30, {}); pen.box(-hw + 0.2, z, 0.3, 1.0, 3, 30, {}); ctx.light(pen.wx(0, z), pen.wz(0, z), 34, gold, 0.9, 20); }
    // outer portal: jambs, lintel, light frame, district sign
    pen.use(frame); pen.box(hw + 7, zB - 4, 14, 26, 0, H + 16, { aoB: 0.5 }); pen.box(-hw - 7, zB - 4, 14, 26, 0, H + 16, { aoB: 0.5 }); pen.box(0, zB - 4, hw * 2 + 28, 26, H, H + 16, { bottom: true });
    pen.use(K.emis(gold, 8)); pen.box(hw + 0.3, zB + 9.2, 1.2, 0.6, 2, H, {}); pen.box(-hw - 0.3, zB + 9.2, 1.2, 0.6, 2, H, {}); pen.box(0, zB + 9.2, hw * 2 + 1.8, 0.6, H - 0.6, H + 0.6, {});
    const d = DISTRICTS[k]; const rect = ctx.atlas.corp.helion.word; pen.sign(0, H + 8, zB + 9.4, 0, 44, 11, rect, { intensity: 5, seed: k });
    ctx.light(pen.wx(0, zB + 20), pen.wz(0, zB + 20), 80, gold, 1.2, 30); ctx.spark(pen.wx(0, zB + 10), H + 8, pen.wz(0, zB + 10), gold, 8, 2.2);
    // inner portal frame
    pen.use(frame); pen.box(hw + 3, zA + 1, 6, 8, 0, H + 6, {}); pen.box(-hw - 3, zA + 1, 6, 8, 0, H + 6, {}); pen.box(0, zA + 1, hw * 2 + 12, 8, H, H + 6, { bottom: true });
    // colliders: wedge fillers either side of the tunnel
    for (const s of [-1, 1]) ctx.phys.addBox(pen.wx(s * (hw + 30), (zA + zB) / 2), pen.wz(s * (hw + 30), (zA + zB) / 2), 30, (zB - zA) / 2, yaw, 0, H);
    ctx.poi({ type: 'gate', id: 'gate-' + k, x: pen.wx(0, zB + 30), y: 0.2, z: pen.wz(0, zB + 30), name: '스파이어 ' + (k + 1) + '번 게이트' });
  });
  ctx.phys.addRing(0, 0, S.R_IN, 340, 0, S.GATE_H, gates.map((g) => [g - dI, g + dI]));

  // ---- hull above the gates, in bands. The dock band has four corridor openings.
  at();
  const dk0 = S.DOCK_Y, dk1 = S.DOCK_Y + 12; const cg = 0.032; // corridor half angle
  const band = (y0, y1, mat) => { pen.use(mat); pen.lathe(0, 0, [[hullR(y0), y0], [hullR(y1), y1]], 64, { cap: false }); };
  band(S.GATE_H, 240, hull); band(240, dk0, hull);
  for (let i = 0; i < 4; i++) { const a0 = lifts[i] + cg * 0.72, a1 = lifts[(i + 1) % 4] + (i === 3 ? TAU : 0) - cg * 0.72; pen.use(hullDark); arc([[hullR(dk0), dk0], [hullR(dk1), dk1]], a0, a1); pen.use(M(ST.WIN_LUX, { color: [0.24, 0.24, 0.26], seed: 5 + i, A: 0.8, B: PAL.WARM, cellW: 5, floorH: 12, flags: WK.COMPOSITE | IN })); arc([[S.R_IN, dk0], [S.R_IN, dk1]], lifts[i] + cg, lifts[(i + 1) % 4] + (i === 3 ? TAU : 0) - cg, { inside: true }); }
  band(dk1, 880, hull); band(880, 1250, hullDark); band(1250, 1440, hull); band(1440, 1500, hullDark);
  // inner atrium wall: thousands of lit rooms looking into the void
  const inner = (y0, y1, seed, lit) => { pen.use(M(ST.WIN_LUX, { color: [0.26, 0.25, 0.25], seed, A: lit, B: PAL.MIXED, cellW: 4.6, floorH: 4.5, flags: WK.COMPOSITE | IN })); pen.lathe(0, 0, [[S.R_IN, y0], [S.R_IN, y1]], 64, { cap: false, inside: true }); };
  inner(S.GATE_H, dk0, 31, 0.6); inner(dk1, S.ATR_H, 77, 0.5);
  // galleries + structural rings inside
  for (let y = 100; y < S.ATR_H; y += 80) { if (Math.abs(y - dk0) < 30) continue; pen.use(M(ST.COMPOSITE, { color: [0.28, 0.28, 0.3], flags: IN })); pen.lathe(0, 0, [[S.R_IN, y + 3], [S.R_IN - 9, y + 3], [S.R_IN - 9, y + 1.6], [S.R_IN, y - 2]], 64, { cap: false, inside: true }); pen.use(K.emis(gold, 6)); pen.lathe(0, 0, [[S.R_IN - 9.05, y + 2.9], [S.R_IN - 9.05, y + 2.5]], 64, { cap: false, inside: true }); }
  // dock-level gallery + corridors through the wall
  pen.use(M(ST.TILE, { color: [0.38, 0.38, 0.4], flags: IN })); pen.lathe(0, 0, [[S.R_IN, dk0], [S.R_IN - 11, dk0]], 64, { cap: false }); pen.use(frame); pen.lathe(0, 0, [[S.R_IN - 11, dk0], [S.R_IN - 11, dk0 - 2], [S.R_IN, dk0 - 5]], 64, { cap: false, inside: true });
  ctx.phys.addRing(0, 0, S.R_IN - 11, S.R_IN, dk0 - 2, dk0);
  lifts.forEach((la, i) => {
    at(yawFacing(Math.cos(la), Math.sin(la)));
    const z0 = S.R_IN - 2, z1 = hullR(dk0) + 4, hw = 5.2, H = 10;
    pen.use(M(ST.COMPOSITE, { color: [0.3, 0.3, 0.32], flags: IN })); pen.wall(hw, z0, hw, z1, dk0, dk0 + H, {}); pen.wall(-hw, z1, -hw, z0, dk0, dk0 + H, {}); pen.flat(-hw, z0, hw, z1, dk0 + H, false, 0.8);
    pen.use(M(ST.TILE, { color: [0.38, 0.38, 0.4], flags: IN })); pen.flat(-hw, z0, hw, z1, dk0 + 0.02);
    pen.use(K.emis(K.NEON.ice, 8)); for (let z = z0 + 6; z < z1; z += 14) pen.box(0, z, hw * 1.6, 0.6, dk0 + H - 0.3, dk0 + H - 0.1, { bottom: true });
    ctx.phys.addBox(pen.wx(0, (z0 + z1) / 2), pen.wz(0, (z0 + z1) / 2), hw, (z1 - z0) / 2 + 2, pen.yaw, dk0 - 2, dk0);
    for (const s of [-1, 1]) ctx.phys.addBox(pen.wx(s * (hw + 8), (z0 + z1) / 2), pen.wz(s * (hw + 8), (z0 + z1) / 2), 8, (z1 - z0) / 2 - 4, pen.yaw, dk0, dk1);
  });
  at();
  ctx.phys.addRing(0, 0, S.R_IN, hullR(240), S.GATE_H, dk0 - 2); ctx.phys.addRing(0, 0, S.R_IN, hullR(dk0) - 2, dk0 - 2, dk1, lifts.map((l) => [l - cg, l + cg]));
  ctx.phys.addRing(0, 0, S.R_IN, hullR(880), dk1, 880); ctx.phys.addRing(0, 0, S.R_IN, hullR(1250), 880, 1250); ctx.phys.addRing(0, 0, S.R_IN, 176, 1250, 1486);

  // ---- atrium floor, pool, light column, oculus
  pen.use(M(ST.TILE, { color: [0.4, 0.4, 0.42], flags: IN })); pen.lathe(0, 0, [[S.R_IN, 0.08], [44, 0.08]], 48, { cap: false });
  pen.use(frame); pen.lathe(0, 0, [[44, 0.08], [44, 1.0], [42, 1.0], [42, 0.5]], 32, { cap: false }); pen.use(M(ST.WATER, { color: [0.3, 0.36, 0.4], extra: 20, flags: IN })); pen.lathe(0, 0, [[42, 0.5], [0.1, 0.5]], 32, { cap: false });
  ctx.phys.addRing(0, 0, 42, 44, 0, 1.0);
  pen.use(K.emis([1, 0.92, 0.75], 14, 3)); pen.lathe(0, 0, [[2.6, 0.5], [2.2, S.ATR_H]], 10, { cap: false });
  B.glow.cone(0, S.ATR_H, 0, 0, -1, 0, S.ATR_H, 16, 30, [1, 0.9, 0.7], 0.5, { segs: 14, night: 0 });
  pen.use(K.emis([1, 0.94, 0.82], 2.4)); pen.lathe(0, 0, [[0.1, S.ATR_H], [S.R_IN, S.ATR_H]], 48, { cap: false });
  pen.use(frame); for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; pen.beam(Math.cos(a) * 20, S.ATR_H - 1.5, Math.sin(a) * 20, Math.cos(a) * S.R_IN, S.ATR_H - 1.5, Math.sin(a) * S.R_IN, 2.4, 3); } pen.lathe(0, 0, [[60, S.ATR_H - 3], [64, S.ATR_H - 3], [64, S.ATR_H - 0.5]], 32, { cap: false }); pen.lathe(0, 0, [[120, S.ATR_H - 3], [124, S.ATR_H - 3], [124, S.ATR_H - 0.5]], 48, { cap: false });
  ctx.light(0, 0, 200, [1, 0.9, 0.7], 1.6, 10);
  // lift tubes (cars are dynamic, see game/lifts)
  ctx.lifts = [];
  lifts.forEach((la, i) => { const lx = Math.cos(la) * S.LIFT_R, lz = Math.sin(la) * S.LIFT_R; at(); pen.use(K.glassDark([0.35, 0.45, 0.5])); pen.lathe(lx, lz, [[7.6, 0.1], [7.6, S.ATR_H]], 12, { cap: false }); pen.use(K.emis(K.NEON.ice, 5, 3, false, i * 9)); for (const off of [-1, 1]) { const ax = Math.cos(la + off * 0.045) * (S.LIFT_R + 7.7), az = Math.sin(la + off * 0.045) * (S.LIFT_R + 7.7); pen.beam(ax, 12, az, ax, S.ATR_H, az, 0.3, 0.3); } ctx.lifts.push({ id: i, x: lx, z: lz, ang: la, r: 7.2, stops: [{ y: 0.1, name: '아트리움' }, { y: S.DOCK_Y, name: '스카이 도크' }, { y: S.ZEN_Y, name: '제니스' }] }); ctx.poi({ type: 'lift', id: 'lift-' + i, x: Math.cos(la) * (S.LIFT_R - 12), y: 0.2, z: Math.sin(la) * (S.LIFT_R - 12), name: '고속 승강기 ' + 'ABCD'[i] }); });
  // concourse furniture: kiosks, benches, planters in rings
  for (let i = 0; i < 40; i++) { const a = (i / 40) * TAU + 0.07, r = i % 2 ? 70 : 120; if (gates.some((g) => Math.abs(((a - g + Math.PI * 3) % TAU) - Math.PI) < 0.2 && r > 100)) continue; ctx.prop(i % 4 === 0 ? 'kiosk' : i % 4 === 1 ? 'bench' : i % 4 === 2 ? 'planter' : 'lampC', Math.cos(a) * r, 0.08, Math.sin(a) * r, -a + Math.PI / 2, 1.2); }

  // ---- exterior: exoskeleton fins, belts, branding, sky dock, buttresses
  at();
  for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU + 0.196; const c = Math.cos(a), s = Math.sin(a); pen.use(frame); const ys = [S.GATE_H + 20, 240, 420, 880, 1250, 1440]; for (let j = 0; j < ys.length - 1; j++) { const r0 = hullR(ys[j]) - 1, r1 = hullR(ys[j + 1]) - 1; pen.beam(c * (r0 + 5), ys[j], s * (r0 + 5), c * (r1 + 5), ys[j + 1], s * (r1 + 5), 5, 12); } if (i % 2 === 0) { pen.use(K.emis(gold, 5, 3, true, i * 5)); pen.beam(c * (hullR(260) + 11.3), 260, s * (hullR(260) + 11.3), c * (hullR(1400) + 11.3), 1400, s * (hullR(1400) + 11.3), 0.8, 0.5); } }
  for (const y of [236, 640, 876, 1100, 1300]) { const r = hullR(y); pen.use(frame); pen.lathe(0, 0, [[r, y - 4], [r + 15, y], [r + 15, y + 12], [r, y + 18]], 64, { cap: false }); pen.use(K.emis(y === 876 ? K.NEON.red : gold, 7, 0, true)); pen.lathe(0, 0, [[r + 15.1, y + 4], [r + 15.1, y + 5.5]], 64, { cap: false }); for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; ctx.spark(Math.cos(a) * (r + 16), y + 5, Math.sin(a) * (r + 16), y === 876 ? K.NEON.red : gold, 8, 1.6); } ctx.phys.addRing(0, 0, r - 2, r + 15, y - 2, y + 16); }
  for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + 0.39; at(yawFacing(Math.cos(a), Math.sin(a))); const r = hullR(330) + 1.5; pen.sign(0, 330, r, 0, 150, 37.5, ctx.atlas.corp.helion.word, { intensity: 5, seed: i }); pen.sign(0, 560, hullR(560) + 1.5, 0, 70, 70, ctx.atlas.corp.helion.logo, { intensity: 5, seed: i }); ctx.spark(pen.wx(0, r + 6), 330, pen.wz(0, r + 6), gold, 14, 3); ctx.spark(pen.wx(0, r + 6), 560, pen.wz(0, r + 6), gold, 12, 3); }
  at();
  // sky dock ring
  { const r0 = hullR(dk0) - 1, r1 = r0 + 78; pen.use(frame); pen.lathe(0, 0, [[r0, dk0 - 26], [r1, dk0 - 6], [r1, dk0 + 1.3]], 64, { cap: false }); pen.use(M(ST.TILE, { color: [0.36, 0.37, 0.4] })); pen.lathe(0, 0, [[r1, dk0], [r0, dk0]], 64, { cap: false });
    const e = K.emis(K.NEON.cyan, 6, 0, true); e.flags |= 8; pen.use(e); pen.lathe(0, 0, [[r1 + 0.1, dk0 + 0.9], [r1 + 0.1, dk0 + 1.2]], 64, { cap: false });
    ctx.phys.addRing(0, 0, r0 - 3, r1, dk0 - 4, dk0);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + 0.39; const px = Math.cos(a) * (r1 - 22), pz = Math.sin(a) * (r1 - 22); pen.use(K.emis([1, 1, 1], 3, 0, true)); pen.lathe(px, pz, [[9, dk0 + 0.05], [8.4, dk0 + 0.05]], 12, { cap: false }); pen.lathe(px, pz, [[2, dk0 + 0.05], [1.4, dk0 + 0.05]], 8, { cap: false }); ctx.poi({ type: 'pad', x: px, y: dk0, z: pz, size: 18, name: '스카이 도크 ' + (i + 1) }); ctx.spark(px, dk0 + 1, pz, K.NEON.cyan, 6, 1.6); ctx.prop('lampC', Math.cos(a + 0.05) * (r1 - 4), dk0, Math.sin(a + 0.05) * (r1 - 4), 0, 1.4); }
    ctx.dock = { y: dk0, r0, r1 }; }
  // buttresses at the district axes
  DISTRICTS.forEach((d, k) => { const a = (d.ang * Math.PI) / 180; at(yawFacing(Math.cos(a), Math.sin(a))); const t = 15, z0 = 344, z1 = 590, zt = hullR(520) - 2, yt = 520;
    pen.use(hull); pen.quad(t, 0, z0, t, 0, z1, t, yt, zt, t, yt, zt, 0, 0, z1 - z0, yt, 0.5, 1); pen.quad(-t, 0, z1, -t, 0, z0, -t, yt, zt, -t, yt, zt, 0, 0, z1 - z0, yt, 0.5, 1);
    pen.use(hullDark); pen.quad(-t, 0, z1, t, 0, z1, t, yt, zt, -t, yt, zt, 0, 0, t * 2, 620, 0.6, 1);
    pen.use(K.emis(gold, 6, 3, true, k * 11)); pen.beam(0, 8, z1 + 0.6 - 4, 0, yt - 20, zt + 14, 1.2, 0.6);
    for (let i = 0; i < 6; i++) { const f = i / 6; const zc = z0 + (z1 - z0) * (1 - f) * 0.5; const zl = (z1 - z0) * (1 - f); ctx.phys.addBox(pen.wx(0, z0 + zl / 2), pen.wz(0, z0 + zl / 2), t, zl / 2, pen.yaw, f * yt, (f + 1 / 6) * yt); }
    ctx.spark(pen.wx(0, z1), 6, pen.wz(0, z1), K.NEON.red, 6, 1.5); });

  // ---- Zenith deck + crown tower + heliostat petals + needle
  at();
  const ZY = S.ZEN_Y, ZR = S.ZEN_R;
  pen.use(hullDark); pen.lathe(0, 0, [[172, ZY - 70], [ZR * 0.6, ZY - 36], [ZR, ZY - 12], [ZR, ZY + 1.4]], 72, { cap: false });
  pen.use(M(ST.TILE, { color: [0.62, 0.6, 0.56] })); pen.lathe(0, 0, [[ZR, ZY], [150, ZY]], 72, { cap: false });
  { const e = K.emis(gold, 6, 0, true); pen.use(e); pen.lathe(0, 0, [[ZR + 0.1, ZY + 0.8], [ZR + 0.1, ZY + 1.2]], 72, { cap: false }); }
  ctx.phys.addRing(0, 0, 176, ZR, ZY - 12, ZY); ctx.phys.addCyl(0, 0, 150, ZY - 12, ZY);
  const crown = M(ST.MEGAHULL, { color: [0.5, 0.48, 0.44], seed: 91, A: 0.5, B: PAL.GOLD });
  pen.use(crown); pen.lathe(0, 0, [[128, ZY], [118, ZY + 60], [96, ZY + 320], [70, ZY + 620], [30, ZY + 900], [12, ZY + 1060], [3, S.TOP]], 40, { cap: false });
  ctx.phys.addCyl(0, 0, 124, ZY, ZY + 60); ctx.phys.addCyl(0, 0, 100, ZY + 60, ZY + 620);
  for (const y of [ZY + 60, ZY + 320, ZY + 620]) { const r = y === ZY + 60 ? 118 : y === ZY + 320 ? 96 : 70; pen.use(frame); pen.lathe(0, 0, [[r, y - 3], [r + 9, y], [r + 9, y + 6], [r, y + 9]], 40, { cap: false }); pen.use(K.emis(gold, 8, 0, true)); pen.lathe(0, 0, [[r + 9.1, y + 2], [r + 9.1, y + 3]], 40, { cap: false }); }
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; const c = Math.cos(a), s = Math.sin(a); const y0 = ZY + 330, r0 = 100, L = 210, wP = 62; const tx = -s, tz = c;
    const p0 = [c * r0, y0, s * r0], p1 = [c * (r0 + L * 0.8), y0 + L * 0.62, s * (r0 + L * 0.8)];
    pen.use({ st: ST.MIRROR, color: [1, 1, 1] }); pen.quad(p0[0] - tx * wP * 0.25, p0[1], p0[2] - tz * wP * 0.25, p0[0] + tx * wP * 0.25, p0[1], p0[2] + tz * wP * 0.25, p1[0] + tx * wP * 0.5, p1[1], p1[2] + tz * wP * 0.5, p1[0] - tx * wP * 0.5, p1[1], p1[2] - tz * wP * 0.5, 0, 0, wP, L);
    pen.use(frame); pen.quad(p0[0] + tx * wP * 0.25, p0[1] - 0.5, p0[2] + tz * wP * 0.25, p0[0] - tx * wP * 0.25, p0[1] - 0.5, p0[2] - tz * wP * 0.25, p1[0] - tx * wP * 0.5, p1[1] - 0.5, p1[2] - tz * wP * 0.5, p1[0] + tx * wP * 0.5, p1[1] - 0.5, p1[2] + tz * wP * 0.5, 0, 0, wP, L);
    pen.beam(c * 96, y0 - 40, s * 96, p1[0], p1[1] - 1.5, p1[2], 3, 3); ctx.spark(p1[0], p1[1], p1[2], gold, 9, 2); }
  pen.use(K.emis(K.NEON.red, 24, 2, false, 3)); pen.lathe(0, 0, [[4, S.TOP], [4, S.TOP + 6], [0.3, S.TOP + 9]], 6, {});
  B.glow.cone(0, ZY + 1000, 0, 0, 1, 0, 2600, 5, 60, [1, 0.85, 0.6], 0.5, { segs: 12, night: 0 });
  for (let y = 100; y < S.TOP; y += 110) { const r = y < ZY ? hullR(y) : 60; for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + y * 0.01; ctx.spark(Math.cos(a) * r, y, Math.sin(a) * r, [1, 0.85, 0.6], 9, 1.2); } }
  ctx.spark(0, S.TOP + 6, 0, K.NEON.red, 12, 3);
  ctx.shade(0, 0, 600, 0.85);
  ctx.poi({ type: 'landmark', id: 'spire', x: 0, y: 0, z: 0, name: '스파이어' });
  buildZenith(ctx, rng, B);
}

// white-and-gold villas, gardens and pools on the Zenith deck, above the clouds
function buildZenith(ctx, rng, B) {
  const S = SPIRE, pen = ctx.pen; const ZY = S.ZEN_Y;
  const use = () => { ctx.cur = { main: B.main, detail: B.main, glow: B.glow }; pen.to(B.main); };
  const white = [0.8, 0.78, 0.74]; const gold = K.NEON.gold;
  const ZS = { walls: [white, [0.74, 0.72, 0.7]], wk: [WK.PLASTER], win: ST.WIN_LUX, lights: [PAL.GOLD, PAL.WARM], lit: [0.6, 0.9], accents: [gold], floorH: 4.2 };
  const lawn = K.foliage([0.26, 0.5, 0.22]);
  // two rings of villas with gardens between, lift pavilions at r = LIFT_R
  const ring = (r, n, depth, off) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + off; if (r < 300 && ctx.lifts.some((l) => Math.abs(((a - l.ang + Math.PI * 3) % TAU) - Math.PI) < 0.16)) continue;
      const x = Math.cos(a) * r, z = Math.sin(a) * r; use(); pen.at(x, ZY, z, yawFacing(Math.cos(a), Math.sin(a)));
      const w = (TAU * r) / n - 16, k = rng.next();
      if (k < 0.62) { // villa: stacked white slabs with deep overhangs, full-height glazing, terrace pool
        const fl = rng.i(2, 4); let y = 0; let vw = w, vd = depth;
        for (let f = 0; f < fl; f++) {
          const v = new Vol(ctx, rng.f(-2, 2) * f, rng.f(-1.5, 1.5) * f, vw, vd, y, y + 4.2);
          const wm = M(ST.WIN_LUX, { color: white, seed: rng.i(0, 255), A: 0.85, B: PAL.GOLD, cellW: vw / Math.max(2, Math.round(vw / 4)), floorH: 4.2, flags: WK.PLASTER });
          for (const g of [0, 1, 2, 3]) { pen.use(wm); const L = v.len(g); const nc = Math.max(1, Math.round(L / 4)); v.wall(g, 0, L, 0, y, y + 4.2, { uv: [f * 17 + g * 5, f, f * 17 + g * 5 + nc, f + 1] }); }
          pen.use(M(ST.PLASTER, { color: [0.85, 0.83, 0.8] })); pen.box(v.cx, v.cz, vw + 3.2, vd + 3.2, y + 4.2, y + 4.7, { bottom: true });
          pen.use(K.emis(gold, 3, 0, true)); pen.box(v.cx, v.cz, vw + 3.3, vd + 3.3, y + 4.2, y + 4.3, { roof: null });
          ctx.solid(v.cx, v.cz, vw, vd, y, y + 4.7); y += 4.7; vw *= rng.f(0.6, 0.85); vd *= rng.f(0.6, 0.85);
        }
        pen.box(0, depth / 2 + 6, w * 0.5 + 1, 7, 0, 0.5, { wall: M(ST.PLASTER, { color: white }), roof: M(ST.PLASTER, { color: white }) }); pen.use(M(ST.WATER, { color: [0.25, 0.5, 0.56], extra: 12 })); pen.flat(-w * 0.25, depth / 2 + 3, w * 0.25, depth / 2 + 9, 0.52);
        ctx.light(pen.wx(0, depth / 2 + 6), pen.wz(0, depth / 2 + 6), 24, gold, 0.5, ZY + 3);
      } else if (k < 0.8) { // glass garden dome
        const R = Math.min(w, depth) * 0.48; const prof = []; for (let j = 0; j <= 6; j++) { const t = (j / 6) * Math.PI / 2; prof.push([Math.max(0.4, Math.cos(t) * R), Math.sin(t) * R * 0.85]); }
        pen.use(M(ST.WIN_GROW, { color: [0.6, 0.62, 0.6], seed: rng.i(0, 255), A: 0.2, B: PAL.GOLD, cellW: 3, floorH: 3, flags: WK.COMPOSITE })); pen.lathe(0, 0, prof, 16, { cap: false }); ctx.solidCyl(0, 0, R * 0.95, 0, R * 0.6);
        pen.use(M(ST.COMPOSITE, { color: [0.7, 0.6, 0.35] })); for (let j = 0; j < 8; j++) { const b = (j / 8) * TAU; pen.beam(Math.cos(b) * R, 0, Math.sin(b) * R, Math.cos(b) * R * 0.2, R * 0.84, Math.sin(b) * R * 0.2, 0.3, 0.3); }
      } else { // formal garden with hedges and trees
        pen.use(lawn); pen.box(0, 0, w, depth, 0, 0.35, {}); pen.box(0, depth / 2 - 1, w, 1.4, 0.35, 1.9, {}); pen.box(0, -depth / 2 + 1, w, 1.4, 0.35, 1.9, {});
        for (let j = 0; j < 5; j++) ctx.propL('tree', rng.f(-0.4, 0.4) * w, 0.35, rng.f(-0.3, 0.3) * depth, rng.f(0, 6.28), rng.f(1.1, 1.8));
        ctx.propL('bench', 0, 0.35, 0, rng.f(0, 6.28));
      }
    }
  };
  ring(290, 14, 44, 0.1); ring(450, 22, 46, 0.22);
  // promenade trees + rim light columns + pads
  for (let i = 0; i < 44; i++) { const a = (i / 44) * TAU; ctx.prop(i % 2 ? 'tree' : 'lampC', Math.cos(a) * 372, ZY, Math.sin(a) * 372, 0, i % 2 ? 1.6 : 1.3, i % 2 ? null : [1, 0.85, 0.6]); if (i % 2 === 0) ctx.light(Math.cos(a) * 372, Math.sin(a) * 372, 0, gold, 0, ZY); }
  for (let i = 0; i < 36; i++) { const a = (i / 36) * TAU + 0.04; ctx.prop('lampC', Math.cos(a) * (S.ZEN_R - 6), ZY, Math.sin(a) * (S.ZEN_R - 6), 0, 1.5, [1, 0.85, 0.6]); ctx.spark(Math.cos(a) * (S.ZEN_R - 6), ZY + 10, Math.sin(a) * (S.ZEN_R - 6), gold, 7, 1.5); }
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + 0.5; const px = Math.cos(a) * (S.ZEN_R - 34), pz = Math.sin(a) * (S.ZEN_R - 34); use(); pen.at(0, 0, 0, 0); pen.use(K.emis([1, 1, 1], 3, 0, true)); pen.lathe(px, pz, [[11, ZY + 0.06], [10.3, ZY + 0.06]], 12, { cap: false }); pen.lathe(px, pz, [[2.5, ZY + 0.06], [1.8, ZY + 0.06]], 8, { cap: false }); ctx.poi({ type: 'pad', x: px, y: ZY, z: pz, size: 22, name: '제니스 착륙장 ' + (i + 1) }); }
  // lift pavilions
  for (const l of ctx.lifts) { use(); pen.at(l.x, ZY, l.z, yawFacing(Math.cos(l.ang), Math.sin(l.ang))); pen.use(M(ST.PLASTER, { color: white })); pen.lathe(0, 0, [[13, 8], [13.6, 8.6], [0.4, 11]], 16, { cap: false }); pen.lathe(0, 0, [[0.4, 8], [13, 8]], 16, { cap: false }); for (let j = 0; j < 8; j++) { const b = (j / 8) * TAU + 0.39; pen.use(M(ST.COMPOSITE, { color: [0.7, 0.6, 0.35] })); pen.lathe(Math.cos(b) * 11.5, Math.sin(b) * 11.5, [[0.45, 0], [0.36, 8]], 6, { cap: false }); ctx.solidCyl(Math.cos(b) * 11.5, Math.sin(b) * 11.5, 0.5, 0, 8); } pen.use(K.emis(gold, 5)); pen.lathe(0, 0, [[12.6, 7.9], [9, 7.9]], 16, { cap: false }); }
  // the Crown portal (endgame property marker)
  use(); pen.at(0, ZY, 0, 0); pen.use(M(ST.COMPOSITE, { color: [0.7, 0.6, 0.35] })); for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; pen.box(Math.cos(a) * 131, Math.sin(a) * 131, 6, 6, 0, 30, {}); }
  ctx.poi({ type: 'crown', id: 'crown', x: 0, y: ZY, z: 146, name: '왕관 — 헬리오스 최상층' });
  ctx.zenith = { y: ZY, r: S.ZEN_R };
}

// radial concourse between the Spire foot and the first ring road
export function buildCorePlaza(ctx) {
  const rng = ctx.rng.fork('plaza'); const B = ctx.big('spire'); const pen = ctx.pen; ctx.cur = { main: B.main, detail: B.main, glow: B.glow }; pen.to(B.main).at(0, 0, 0, 0);
  pen.use(M(ST.TILE, { color: [0.34, 0.34, 0.37] })); pen.lathe(0, 0, [[R_CORE + 46, 0.12], [350, 0.12]], 72, { cap: false });
  ctx.phys.addRing(0, 0, 345, R_CORE + 46, 0, 0.12);
  const gold = K.NEON.gold;
  for (let k = 0; k < 8; k++) {
    const ga = boundaryAngle(k, 500);
    // approach avenues lined with light columns, trees between
    for (let r = 392; r < R_CORE + 30; r += 22) for (const s of [-1, 1]) { const a = ga + (s * 34) / r; const x = Math.cos(a) * r, z = Math.sin(a) * r; ctx.prop('lampC', x, 0.12, z, 0, 1.5, [1, 0.85, 0.6]); ctx.light(x, z, 18, gold, 0.7, 8); const a2 = ga + (s * 46) / r; if ((r / 22) % 2 < 1) ctx.prop('tree', Math.cos(a2) * r, 0.12, Math.sin(a2) * r, rng.f(0, 6.28), rng.f(1.2, 1.7)); }
    // pools + kiosks in the wedges between gates and buttresses
    const da = (DISTRICTS[k].ang * Math.PI) / 180; const wa = (ga + da) / 2 + (Math.abs(ga - da) > 1 ? Math.PI : 0);
    for (const [r, rr] of [[470, 20], [590, 26]]) { const x = Math.cos(wa) * r, z = Math.sin(wa) * r; pen.use(M(ST.COMPOSITE, { color: [0.3, 0.3, 0.33] })); pen.lathe(x, z, [[rr + 1.2, 0.12], [rr + 1.2, 0.7], [rr, 0.7], [rr, 0.5]], 24, { cap: false }); pen.use(M(ST.WATER, { color: [0.25, 0.32, 0.38], extra: 20 })); pen.lathe(x, z, [[rr, 0.5], [0.1, 0.5]], 24, { cap: false }); ctx.phys.addCyl(x, z, rr + 1.2, 0, 0.7); B.glow.cone(x, 0.6, z, 0, 1, 0, 60, 1.2, 9, gold, 0.3, { segs: 8 }); ctx.light(x, z, 40, gold, 0.6, 4); for (let i = 0; i < 6; i++) { const b = (i / 6) * TAU; ctx.prop(i % 2 ? 'bench' : 'planter', x + Math.cos(b) * (rr + 4), 0.12, z + Math.sin(b) * (rr + 4), -b - Math.PI / 2); } }
  }
  // service terminals (gameplay POIs) at the foot of the Spire
  const term = (id, name, ang, kind) => { const a = (ang * Math.PI) / 180; const x = Math.cos(a) * 372, z = Math.sin(a) * 372; ctx.prop('kiosk', x, 0.12, z, -a + Math.PI / 2, 2.2); ctx.light(x, z, 16, K.NEON.cyan, 0.8, 3); ctx.poi({ type: kind, id, x, y: 0.12, z, name }); };
  term('license', '고도관리국 민원 단말', 100, 'license'); term('exchange', '에테르 거래소 단말', 80, 'exchange'); term('bank', '메리디안 은행 단말', 260, 'bank');
}

// west: the Bulwark sea wall holding back a sea that stands above the city
export function buildBulwark(ctx) {
  const rng = ctx.rng.fork('bulwark'); const B = ctx.big('bulwark'); const pen = ctx.pen; ctx.cur = { main: B.main, detail: B.main, glow: B.glow }; pen.to(B.main).at(0, 0, 0, 0);
  const X = COAST_X - 20, H = 190, SEA = 150; const hull = M(ST.MEGAHULL, { color: [0.3, 0.31, 0.33], seed: 61, A: 0.15, B: PAL.COOL }); const conc = M(ST.CONCRETE, { color: [0.4, 0.4, 0.41], seed: 8 });
  const Z0 = -4200, Z1 = 4200; const segL = 140; const n = Math.round((Z1 - Z0) / segL);
  for (let i = 0; i < n; i++) {
    const z0 = Z0 + i * segL, z1 = z0 + segL;
    pen.use(hull); pen.quad(X + 90, 0, z0, X + 90, 0, z1, X + 8, H, z1, X + 8, H, z0, z0, 0, z1, 200, 0.5, 1); // city face (sloped), faces +x
    pen.use(conc); pen.quad(X + 8, H, z1, X - 30, H, z1, X - 30, H, z0, X + 8, H, z0, 0, 0, 38, segL); // crest road
    pen.quad(X - 30, SEA - 30, z1, X - 30, SEA - 30, z0, X - 30, H, z0, X - 30, H, z1, z0, 120, z1, H); // sea face
    // buttress + sluice with warning lights
    pen.use(conc); pen.quad(X + 124, 0, z0 + 8, X + 124, 0, z0 - 8, X + 30, H * 0.8, z0 - 8, X + 30, H * 0.8, z0 + 8, 0, 0, 16, 200, 0.5, 1);
    pen.quad(X + 124, 0, z0 - 8, X + 80, 0, z0 - 8, X + 30, H * 0.8, z0 - 8, X + 30, H * 0.8, z0 - 8, 0, 0, 44, H, 0.5, 1); pen.quad(X + 80, 0, z0 + 8, X + 124, 0, z0 + 8, X + 30, H * 0.8, z0 + 8, X + 30, H * 0.8, z0 + 8, 0, 0, 44, H, 0.5, 1);
    if (i % 3 === 1) { pen.use(K.dark(0.04)); pen.quad(X + 74, 6, z0 + 40, X + 74, 6, z0 + 100, X + 60, 40, z0 + 100, X + 60, 40, z0 + 40, 0, 0, 60, 34); pen.use(K.emis(K.NEON.red, 9, 2, false, i)); pen.box(X + 58, z0 + 70, 0.8, 50, 42, 43, {}); ctx.light(X + 90, z0 + 70, 60, K.NEON.red, 0.5, 30); }
    pen.use(K.emis(K.NEON.ice, 7, 0, true)); pen.box(X + 7.6, (z0 + z1) / 2, 0.4, segL - 4, H + 1, H + 1.3, {});
    ctx.spark(X, H + 2, z0, K.NEON.ice, 7, 1.3); ctx.phys.addBox(X + 30, (z0 + z1) / 2, 60, segL / 2, 0, 0, H * 0.55); ctx.phys.addBox(X - 8, (z0 + z1) / 2, 24, segL / 2, 0, 0, H);
  }
  // sea (one huge quad) + offshore rigs
  pen.use(M(ST.WATER, { color: [0.16, 0.22, 0.28], extra: 90 })); pen.quad(X - 16000, SEA, Z1 + 9000, X - 29, SEA, Z1 + 9000, X - 29, SEA, Z0 - 9000, X - 16000, SEA, Z0 - 9000, 0, 0, 1, 1);
  for (let i = 0; i < 9; i++) { const x = X - rng.f(700, 5200), z = rng.f(-4500, 4500); pen.use(M(ST.RUST, { color: [0.36, 0.33, 0.3], seed: i })); for (const [dx, dz] of [[-24, -24], [24, -24], [24, 24], [-24, 24]]) pen.lathe(x + dx, z + dz, [[5, SEA - 20], [4, SEA + 40]], 8, { cap: false }); pen.box(x, z, 70, 70, SEA + 40, SEA + 52, { wall: M(ST.MEGAHULL, { color: [0.3, 0.3, 0.32], seed: i, A: 0.5, B: PAL.AMBER }), roof: conc, bottom: conc }); pen.box(x + 10, z - 8, 30, 26, SEA + 52, SEA + 90, { wall: M(ST.WIN_INDUSTRIAL, { color: [0.3, 0.3, 0.3], seed: i, A: 0.6, B: PAL.AMBER, cellW: 4, floorH: 5, flags: WK.RUST }), roof: conc }); pen.use(M(ST.RUST, { color: [0.4, 0.3, 0.25] })); pen.lathe(x - 20, z + 18, [[2.5, SEA + 52], [1.8, SEA + 170]], 8, { cap: false }); pen.use(K.emis([1, 0.45, 0.08], 16, 1, false, i)); pen.lathe(x - 20, z + 18, [[2, SEA + 170], [3, SEA + 176], [0.2, SEA + 190]], 6, { cap: false }); ctx.spark(x - 20, SEA + 180, z + 18, [1, 0.45, 0.1], 10, 3); ctx.spark(x, SEA + 60, z, [1, 0.8, 0.5], 9, 1.5); ctx.phys.addBox(x, z, 35, 35, 0, SEA + 20, SEA + 52); ctx.steam.push({ x: x - 20, y: SEA + 186, z: z + 18, s: 3, fire: 1, big: 1 }); }
  ctx.sea = { x: X - 30, y: SEA };
  ctx.poi({ type: 'landmark', id: 'bulwark', x: X, y: H, z: 0, name: '방벽' });
}

// cloud-piercing giants, one per district, on reserved blocks
export function reserveGiants(ctx) {
  const sites = [['meridian', 0.3, -0.35, 'trident'], ['meridian', 0.42, 0.3, 'trident'], ['meridian', 0.6, -0.05, 'trident'], ['oldq', 0.42, 0.1, 'archive'], ['verdant', 0.45, -0.1, 'seed'], ['foundry', 0.5, 0.15, 'stack'], ['foundry', 0.72, -0.4, 'stack'], ['lumina', 0.4, 0.0, 'needle'], ['hive', 0.5, 0.05, 'monolith']];
  ctx.giants = [];
  for (const [id, t, a, kind] of sites) { const d = DISTRICTS.find((q) => q.id === id); const r = R_CORE + 120 + t * (R_CITY - R_CORE - 300); const ang = ((d.ang + a * 19) * Math.PI) / 180; const b = nearestBlock(ctx, Math.cos(ang) * r, Math.sin(ang) * r, id); if (!b) continue; b.reserved = kind; ctx.giants.push({ kind, b }); }
}
export function buildGiants(ctx) {
  const rng = ctx.rng.fork('giants');
  for (const { kind, b } of ctx.giants) {
    const lot = { cx: 0, cz: 0, w: b.w - 2 * b.walk, d: b.d - 2 * b.walk, face: 1, corner: true, block: b, x: b.x, z: b.z, yaw: b.yaw };
    const S = STYLES[b.district];
    if (kind === 'trident') megaTower(ctx, rng, lot, S, { h: rng.f(1250, 1700), brand: rng.pick(['meridian', 'helion', 'aether']) });
    else if (kind === 'archive') archiveSpire(ctx, rng, lot, S, { h: 1180 });
    else if (kind === 'seed') farmTower(ctx, rng, lot, S, { h: 1150 });
    else if (kind === 'needle') megaTower(ctx, rng, lot, STYLES.lumina, { h: 1400, brand: 'lumina' });
    else if (kind === 'monolith') megaTower(ctx, rng, lot, { ...STYLES.hive, towerWin: [ST.WIN_CAPSULE], accents: [K.NEON.amber, K.NEON.sodium] }, { h: 1300, brand: 'hive' });
    else if (kind === 'stack') {
      const pen = ctx.penAt(b.x, 0.2, b.z, b.yaw); const H = rng.f(1300, 1480), r0 = Math.min(lot.w, lot.d) * 0.3;
      pen.use(M(ST.MEGAHULL, { color: [0.36, 0.33, 0.3], seed: rng.i(0, 255), A: 0.2, B: PAL.RED })); pen.lathe(0, 0, [[r0 * 1.5, 0], [r0, 90], [r0 * 0.62, H * 0.5], [r0 * 0.5, H]], 28, { cap: false, aoB: 0.5 });
      pen.use(M(ST.RUST, { color: [0.3, 0.27, 0.25] })); for (const y of [90, H * 0.25, H * 0.5, H * 0.75, H - 20]) { const r = y < 90 ? r0 : r0 * (y < H * 0.5 ? 1 - 0.38 * ((y - 90) / (H * 0.5 - 90)) : 0.62 - 0.12 * ((y - H * 0.5) / (H * 0.5))); pen.lathe(0, 0, [[r, y - 3], [r + 7, y], [r + 7, y + 6], [r, y + 9]], 28, { cap: false }); pen.use(K.emis(K.NEON.red, 9, 2, false, rng.i(0, 255))); pen.lathe(0, 0, [[r + 7.1, y + 2.4], [r + 7.1, y + 3.4]], 28, { cap: false }); pen.use(M(ST.RUST, { color: [0.3, 0.27, 0.25] })); for (let i = 0; i < 6; i++) ctx.spark(b.x + Math.cos(i) * (r + 8), y + 3, b.z + Math.sin(i) * (r + 8), K.NEON.red, 9, 1.8); }
      ctx.phys.addCyl(b.x, b.z, r0, 0, H * 0.5); ctx.phys.addCyl(b.x, b.z, r0 * 0.62, H * 0.5, H);
      ctx.steam.push({ x: b.x, y: H + 10, z: b.z, s: r0 * 0.8, big: 2 }); ctx.light(b.x, b.z, 260, [1, 0.35, 0.1], 1.0, 60); ctx.shade(b.x, b.z, r0 * 3, 0.8);
      ctx.footprint(0, 0, r0 * 2, r0 * 2, 0, H, b.id); ctx.stats.buildings++;
    }
    ctx.poi({ type: 'landmark', id: kind + b.id, x: b.x, y: 0, z: b.z, name: { trident: '트라이던트 타워', archive: '대기록원', seed: '종자탑', stack: '주조 굴뚝', needle: '루미나 니들', monolith: '하이브 모놀리스' }[kind] });
  }
}

// outlands: cheap low sprawl to the horizon + far megastructure silhouettes
export function buildSprawl(ctx) {
  const rng = ctx.rng.fork('sprawl'); const pen = ctx.pen;
  for (let ring = 0; ring < 14; ring++) {
    const r = R_CITY + 70 + ring * 125; const n = Math.round((TAU * r) / 150);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + ring * 0.37 + rng.f(-0.01, 0.01); const x = Math.cos(a) * (r + rng.f(-30, 30)), z = Math.sin(a) * (r + rng.f(-30, 30));
      if (x < COAST_X + 120) continue; const nz = fbm2(x * 0.0012, z * 0.0012, 3, 5); if (nz < 0.36) continue;
      ctx.penAt(x, 0, z, yawFacing(Math.cos(a), Math.sin(a)) + rng.pick([0, 1.5708])); ctx.main();
      const w = rng.f(50, 110), d = rng.f(40, 90), h = rng.f(12, 90) * (0.4 + nz) * (1 - ring / 22);
      pen.box(0, 0, w, d, 0, h, { wall: M(rng.pick([ST.WIN_RES, ST.WIN_RIBBON, ST.WIN_INDUSTRIAL]), { color: [rng.f(0.3, 0.42), rng.f(0.3, 0.4), rng.f(0.3, 0.4)], seed: rng.i(0, 255), A: rng.f(0.1, 0.4), B: rng.pick([PAL.WARM, PAL.MIXED, PAL.AMBER]), cellW: 3.4, floorH: 3.4, flags: rng.pick([0, 2, 5]) }), roof: K.conc(0.25), aoB: 0.5 });
      if (h > 50 && rng.chance(0.4)) pen.box(rng.f(-10, 10), rng.f(-10, 10), w * 0.4, d * 0.4, h, h * rng.f(1.3, 2.2), { wall: M(ST.WIN_OFFICE, { color: [0.3, 0.34, 0.4], seed: rng.i(0, 255), A: 0.4, B: PAL.NEUTRAL, cellW: 3, floorH: 4, flags: 3 }), roof: K.conc(0.25) });
      ctx.solid(0, 0, w, d, 0, h); if (rng.chance(0.5)) ctx.light(x, z, 60, rng.pick([K.NEON.sodium, K.NEON.sodium, K.NEON.cyan, K.NEON.pink]), 0.5, 10); ctx.shade(x, z, 80, 0.4);
      if (rng.chance(0.25)) ctx.spark(x, h + 4, z, K.NEON.red, 4, 1.2);
    }
  }
  // far megastructure silhouettes
  const B = ctx.big('far'); ctx.cur = { main: B.main, detail: B.main, glow: B.glow };
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU + rng.f(-0.12, 0.12); const r = rng.f(6200, 9800); const x = Math.cos(a) * r, z = Math.sin(a) * r; if (x < COAST_X - 200) continue;
    pen.to(B.main).at(x, 0, z, rng.f(0, 6.28)); const H = rng.f(900, 2600), w = rng.f(180, 420); const kind = rng.i(0, 2);
    const m = M(ST.MEGAHULL, { color: [rng.f(0.28, 0.4), rng.f(0.28, 0.38), rng.f(0.3, 0.4)], seed: rng.i(0, 255), A: rng.f(0.3, 0.6), B: rng.pick([PAL.MIXED, PAL.WARM, PAL.COOL]) });
    pen.use(m);
    if (kind === 0) pen.lathe(0, 0, [[w * 0.7, 0], [w * 0.45, H * 0.3], [w * 0.36, H * 0.8], [w * 0.1, H]], 14, { cap: false });
    else if (kind === 1) { const rings = []; for (let k = 0; k <= 4; k++) rings.push({ y: (H * k) / 4, pts: scalePts(rectPts(w, w * 0.6, 0, 0, w * 0.1), 1 - 0.14 * k) }); pen.loft(rings, {}); }
    else { pen.box(-w * 0.4, 0, w * 0.5, w * 0.5, 0, H, {}); pen.box(w * 0.4, 0, w * 0.5, w * 0.5, 0, H * 0.8, {}); pen.box(0, 0, w * 0.5, w * 0.3, H * 0.5, H * 0.56, { bottom: true }); }
    ctx.phys.addCyl(x, z, w * 0.5, 0, H);
    for (let y = 80; y < H; y += 160) ctx.spark(x + rng.f(-w, w) * 0.3, y, z + rng.f(-w, w) * 0.3, rng.pick([[1, 0.8, 0.5], [0.6, 0.8, 1], K.NEON.red]), 16, 1.6);
  }
}
