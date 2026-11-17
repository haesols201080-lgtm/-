// District programme: turns planned blocks into lots and lots into buildings, with a distinct
// architectural language, skyline logic and streetscape per district.
import { ST, PAL, WK } from '../render/cityMaterial.js';
import { M } from './builder.js';
import * as K from './kit.js';
import { subdivide, DPLAN } from './plan.js';
import { shopHouse, tenement, techTower, megaTower, ROOF_LOW, ROOF_TECH } from './buildings.js';
import { capsuleBlock, terrace, guildHouse, archiveSpire, factory, depot, farmTower, plaza } from './buildings2.js';
import { clamp } from '../core/rng.js';
import { civic, CIVIC } from './civic.js';

const NE = K.NEON;
const TARPS = [[0.2, 0.32, 0.45], [0.48, 0.25, 0.2], [0.5, 0.42, 0.2], [0.22, 0.4, 0.32], [0.45, 0.45, 0.46], [0.4, 0.22, 0.35]];
export const STYLES = {
  sump: { walls: [[0.36, 0.33, 0.3], [0.3, 0.32, 0.33], [0.42, 0.21, 0.16], [0.56, 0.52, 0.44], [0.4, 0.5, 0.45], [0.42, 0.48, 0.55], [0.58, 0.42, 0.36], [0.6, 0.6, 0.58], [0.5, 0.44, 0.28], [0.28, 0.3, 0.32]], wk: [WK.PLASTER, WK.CONCRETE, WK.CONCRETE, WK.PLASTER], win: ST.WIN_RES, lights: [PAL.WARM, PAL.MIXED, PAL.WARM], lit: [0.18, 0.45], accents: [NE.pink, NE.cyan, NE.amber, NE.green], floorH: 3.0, cellW: 3.0, awning: true, tarps: TARPS, balcony: 0.4, blade: 0.75, upperSigns: 0.5, signI: 5, enter: 0.4, roof: ROOF_LOW, roofDensity: 1.4, lamp: 'lampB', lampTint: [1, 0.7, 0.4], lampCol: NE.sodium, furniture: [[3, 'crates'], [2, 'barrels'], [2, 'trash'], [2, 'bin'], [1.5, 'scooter'], [1, 'utilBox'], [1.2, 'vending'], [1, 'cart']], wins: [[5, ST.WIN_RES], [1.5, ST.WIN_SLIT], [1, ST.WIN_SHANTY]], roofForms: [[4, 'flat'], [1.5, 'pent'], [1.2, 'shed'], [1.4, 'gable'], [0.8, 'vault'], [1.2, 'garden']], pitch: 0.7, dress: { ac: 0.45, flower: 0.07, laundry: 0.14, dish: 0.04 } },
  oldq: { walls: [[0.5, 0.47, 0.42], [0.62, 0.58, 0.48], [0.56, 0.42, 0.24], [0.5, 0.27, 0.18], [0.4, 0.2, 0.15], [0.66, 0.64, 0.6], [0.42, 0.46, 0.38], [0.46, 0.44, 0.4], [0.56, 0.36, 0.3]], wk: [WK.STONE, WK.STONE, WK.PLASTER], win: ST.WIN_RES, lights: [PAL.WARM, PAL.GOLD, PAL.WARM, PAL.VIOLET], lit: [0.15, 0.4], accents: [NE.violet, NE.gold, NE.amber], floorH: 3.4, cellW: 2.9, balcony: 0.15, blade: 0.35, upperSigns: 0.15, signI: 3.5, roof: ROOF_LOW, roofDensity: 0.6, lamp: 'lampC', lampTint: [1, 0.75, 0.5], lampCol: NE.gold, furniture: [[3, 'bench'], [2, 'planter'], [2, 'bollard'], [1, 'bin'], [1, 'kiosk']], wins: [[5, ST.WIN_RES], [1, ST.WIN_SLIT]], roofForms: [[1.2, 'flat'], [3, 'gable'], [2.5, 'hip'], [2.5, 'mansard'], [1, 'garden']], pitch: 2.4, dress: { ac: 0.12, flower: 0.4, laundry: 0.04, dish: 0.02 } },
  lumina: { walls: [[0.26, 0.24, 0.3], [0.3, 0.26, 0.28], [0.58, 0.58, 0.6], [0.5, 0.44, 0.36], [0.32, 0.14, 0.14], [0.16, 0.3, 0.32], [0.22, 0.24, 0.3], [0.44, 0.36, 0.44]], wk: [WK.COMPOSITE, WK.METAL, WK.PLASTER], win: ST.WIN_RES, towerWin: [ST.WIN_LUX, ST.WIN_RIBBON, ST.WIN_OFFICE], lights: [PAL.WARM, PAL.WARM, PAL.MIXED, PAL.MAGENTA], lit: [0.35, 0.6], accents: [NE.pink, NE.violet, NE.cyan], floorH: 3.6, cellW: 3.2, balcony: 0.2, blade: 0.9, upperSigns: 0.8, signI: 6, enter: 0.45, pads: 0.25, screens: 0.45, bands: 0.7, forms: { disc: 2, cyl: 1.6, aframe: 2.2, stack: 1.6, slab: 0.5, gate: 1.4 }, roof: ROOF_TECH, lamp: 'lampC', lampTint: [1, 0.4, 0.8], lampCol: NE.pink, furniture: [[3, 'vending'], [2, 'kiosk'], [2, 'bench'], [2, 'scooter'], [1, 'bin'], [1, 'cart'], [1, 'droneDock']], roofForms: [[4, 'flat'], [2, 'pent'], [2.2, 'garden'], [0.8, 'mansard']], dress: { ac: 0.2, flower: 0.12, laundry: 0.02, dish: 0.01 } },
  meridian: { walls: [[0.3, 0.38, 0.44], [0.34, 0.36, 0.4], [0.62, 0.62, 0.6], [0.52, 0.46, 0.38], [0.26, 0.32, 0.4], [0.36, 0.4, 0.42], [0.18, 0.2, 0.24]], wk: [WK.COMPOSITE, WK.METAL, WK.COMPOSITE], win: ST.WIN_OFFICE, towerWin: [ST.WIN_OFFICE, ST.WIN_OFFICE, ST.WIN_RIBBON], lights: [PAL.NEUTRAL, PAL.COOL, PAL.NEUTRAL], lit: [0.3, 0.55], accents: [NE.ice, NE.ice, NE.white, NE.cyan], floorH: 4.2, cellW: 3.0, pads: 0.55, screens: 0.1, bands: 0.15, roof: ROOF_TECH, lamp: 'lampA', lampTint: [0.75, 0.9, 1], lampCol: NE.ice, furniture: [[3, 'tree'], [2, 'bench'], [2, 'planter'], [2, 'bollard'], [1.5, 'kiosk'], [1, 'droneDock'], [1, 'bin']], roofForms: [[4, 'flat'], [2, 'pent'], [2.5, 'garden']], dress: { ac: 0.1, flower: 0.14, laundry: 0.0, dish: 0.01 } },
  hive: { walls: [[0.44, 0.4, 0.34], [0.6, 0.6, 0.58], [0.6, 0.54, 0.36], [0.4, 0.48, 0.54], [0.6, 0.44, 0.44], [0.4, 0.48, 0.4], [0.36, 0.38, 0.4], [0.46, 0.24, 0.18], [0.52, 0.5, 0.46]], wk: [WK.CONCRETE, WK.PLASTER, WK.CONCRETE], win: ST.WIN_RES, lights: [PAL.WARM, PAL.WARM, PAL.NEUTRAL, PAL.MIXED], lit: [0.25, 0.55], accents: [NE.amber, NE.sodium, NE.cyan, NE.gold], floorH: 3.0, cellW: 3.0, awning: true, tarps: TARPS, balcony: 0.7, blade: 0.5, upperSigns: 0.3, signI: 4.5, roof: ROOF_LOW, lamp: 'lampA', lampTint: [1, 0.75, 0.45], lampCol: NE.sodium, furniture: [[3, 'bench'], [2, 'vending'], [2, 'scooter'], [2, 'bin'], [1, 'cart'], [1, 'planter'], [1, 'crates']], wins: [[5, ST.WIN_RES], [1.5, ST.WIN_RIBBON], [1, ST.WIN_SLIT]], roofForms: [[4, 'flat'], [1.5, 'pent'], [1.5, 'gable'], [1.2, 'hip'], [1, 'shed'], [1.5, 'garden']], pitch: 1.0, dress: { ac: 0.4, flower: 0.1, laundry: 0.1, dish: 0.03 } },
  verdant: { walls: [[0.36, 0.42, 0.38], [0.4, 0.42, 0.4], [0.32, 0.36, 0.34]], wk: [WK.COMPOSITE, WK.CONCRETE, WK.METAL], win: ST.WIN_GROW, towerWin: [ST.WIN_GROW], lights: [PAL.MAGENTA, PAL.VIOLET, PAL.GREEN], lit: [0.6, 0.9], accents: [NE.magenta, NE.green, NE.violet], floorH: 4.5, cellW: 3.6, pads: 0.3, roof: ROOF_TECH, lamp: 'lampA', lampTint: [0.7, 1, 0.75], lampCol: NE.green, furniture: [[3, 'planter'], [3, 'tree'], [1, 'bench'], [1, 'utilBox'], [1, 'crates']] },
  foundry: { walls: [[0.34, 0.3, 0.27], [0.3, 0.29, 0.28], [0.38, 0.32, 0.26]], wk: [WK.RUST, WK.RIBBED, WK.CONCRETE], win: ST.WIN_INDUSTRIAL, towerWin: [ST.WIN_INDUSTRIAL, ST.WIN_RIBBON], lights: [PAL.AMBER, PAL.RED, PAL.WARM], lit: [0.3, 0.6], accents: [NE.red, NE.amber, NE.sodium], floorH: 5, cellW: 4, roof: ROOF_TECH, lamp: 'lampA', lampTint: [1, 0.55, 0.25], lampCol: NE.sodium, furniture: [[3, 'barrels'], [3, 'crates'], [2, 'utilBox'], [2, 'barrier'], [1, 'trash']] },
  port: { walls: [[0.34, 0.36, 0.38], [0.3, 0.33, 0.36], [0.38, 0.38, 0.36]], wk: [WK.RIBBED, WK.METAL, WK.CONCRETE], win: ST.WIN_INDUSTRIAL, towerWin: [ST.WIN_RIBBON, ST.WIN_INDUSTRIAL], lights: [PAL.COOL, PAL.NEUTRAL, PAL.AMBER], lit: [0.25, 0.5], accents: [NE.cyan, NE.blue, NE.amber], floorH: 4.5, cellW: 4, pads: 0.6, roof: ROOF_TECH, lamp: 'lampA', lampTint: [0.7, 0.9, 1], lampCol: NE.ice, furniture: [[3, 'crates'], [2, 'barrier'], [2, 'barrels'], [2, 'utilBox'], [1, 'droneDock']] },
};

// real masonry is far lighter than charcoal: lift the wall palettes into the measured range of concrete, tile and render,
// and say how much of each district is clad in small-format tile or brick
{ const lift = { sump: 1.45, oldq: 1.35, hive: 1.4, lumina: 1.25, meridian: 1.15, verdant: 1.25, foundry: 1.2, port: 1.25 }, clad = { sump: 0.5, oldq: 0.55, hive: 0.45, lumina: 0.3, meridian: 0.05, verdant: 0.1, foundry: 0.15, port: 0.1 };
  for (const k in STYLES) { STYLES[k].walls = STYLES[k].walls.map((c) => c.map((v) => Math.min(0.8, v * (lift[k] || 1.2)))); STYLES[k].clad = clad[k] ?? 0.2; } }
// skyline: metres of height for a lot in a block
function skyline(b, rng) {
  const t = clamp((b.r - 700) / 2600, 0, 1); const n = b.noise, n2 = b.noise2;
  switch (b.district) {
    case 'meridian': return (140 + 520 * Math.pow(1 - Math.abs(t - 0.35) * 1.6, 2) * (0.45 + n)) * (0.75 + 0.5 * n2);
    case 'lumina': return (50 + 200 * (1 - t) * (0.4 + n)) * (0.7 + 0.6 * n2);
    case 'hive': return (220 + 300 * (0.3 + n)) * (1 - 0.35 * t);
    case 'verdant': return 80 + 240 * n * (1 - 0.4 * t);
    case 'sump': return (14 + 60 * Math.pow(n, 1.6)) * (1.25 - 0.6 * t);
    case 'oldq': return (16 + 26 * n) * (1.1 - 0.3 * t);
    case 'foundry': return 40 + 60 * n;
    case 'port': return 30 + 50 * n;
  }
  return 40;
}

const ZEBRA = M(ST.PLASTER, { color: [0.6, 0.6, 0.58], seed: 3 });
function streetscape(ctx, rng, b, S) {
  // lamps on the kerb line, arms over the carriageway; furniture in between on a slot grid along each side
  const hw = b.w / 2, hd = b.d / 2; const inset = 0.9;
  let sides = [[-hw, hd - inset, hw, hd - inset, 0], [hw - inset, hd, hw - inset, -hd, Math.PI / 2], [hw, -hd + inset, -hw, -hd + inset, Math.PI], [-hw + inset, -hd, -hw + inset, hd, -Math.PI / 2]];
  if (b.corners && b.corners.length === 4) { // the block's real outline, in block-local coordinates
    const cs = Math.cos(b.yaw), sn = Math.sin(b.yaw); const Lc = b.corners.map((p) => { const dx = p[0] - b.x, dz = p[1] - b.z; return [dx * cs - dz * sn, dx * sn + dz * cs]; }); let gx = 0, gz = 0; for (const p of Lc) { gx += p[0] / 4; gz += p[1] / 4; }
    sides = Lc.map((a, i) => { const q = Lc[(i + 1) % 4]; let tx = q[0] - a[0], tz = q[1] - a[1]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l; let nx = tz, nz = -tx; if ((a[0] - gx) * nx + (a[1] - gz) * nz < 0) { nx = -nx; nz = -nz; } return [a[0] - nx * inset + tx * 0.5, a[1] - nz * inset + tz * 0.5, q[0] - nx * inset - tx * 0.5, q[1] - nz * inset - tz * 0.5, Math.atan2(nx, nz)]; }); }
  const prime0 = b.edge && (b.edge.inner || b.edge.outer || b.edge.left || b.edge.right); const stW = (DPLAN[b.district] || {}).sw || 12; let si = -1;
  for (const [x0, z0, x1, z1, ang] of sides) {
    const L = Math.hypot(x1 - x0, z1 - z0); si++;
    // zebra crossings at the block corners (two of the four sides, so neighbouring blocks never double up)
    if (si < 2 && !prime0 && L > 34 && stW <= 22) for (const tt of [5.5 / L, 1 - 5.5 / L]) {
      const [zx, zz] = b.at(x0 + (x1 - x0) * tt + Math.sin(ang) * inset, z0 + (z1 - z0) * tt + Math.cos(ang) * inset);
      const zp = ctx.penAt(zx, 0, zz, b.yaw + ang); ctx.detail(); zp.use(ZEBRA); for (let q = 0.7; q < stW - 0.9; q += 1.0) zp.flat(-1.7, q, 1.7, q + 0.5, 0.052); ctx.main();
      (ctx.crossings || (ctx.crossings = [])).push({ x: zx, z: zz, dx: Math.sin(b.yaw + ang), dz: Math.cos(b.yaw + ang), w: stW });
      { // stop line across the lane that runs into the junction, a car length short of the zebra
        const cs = Math.cos(b.yaw), sn = Math.sin(b.yaw); const k = tt < 0.5 ? -1 : 1; const ldx = (x1 - x0) / L * k, ldz = (z1 - z0) / L * k; const Tx = ldx * cs + ldz * sn, Tz = -ldx * sn + ldz * cs;
        const Y = b.yaw + ang; const sgn = Math.sign(Tx * Math.cos(Y) - Tz * Math.sin(Y)) || 1; const far = (-Tz * Math.sin(Y) + Tx * Math.cos(Y)) > 0;
        const xa = -sgn * 2.7, xb = -sgn * 3.15, za = far ? stW / 2 + 0.15 : 0.5, zb = far ? stW - 0.5 : stW / 2 - 0.15;
        ctx.detail(); zp.use(ZEBRA); zp.flat(Math.min(xa, xb), za, Math.max(xa, xb), zb, 0.052); ctx.main(); }
    } const n = Math.max(1, Math.round(L / 34)); const slots = Math.floor(L / 5.5);
    const lampSlots = new Set(); const poles = [];
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n; const lx = x0 + (x1 - x0) * t, lz = z0 + (z1 - z0) * t; const [wx, wz] = b.at(lx, lz);
      ctx.prop(S.lamp, wx, 0.2, wz, b.yaw + ang, 1, S.lampTint);
      const reach = S.lamp === 'lampA' ? 3.3 : S.lamp === 'lampB' ? 1.75 : 0; const hgt = S.lamp === 'lampA' ? 10.6 : S.lamp === 'lampB' ? 7.5 : 6.4;
      const [gx, gz] = b.at(lx + Math.sin(ang) * reach, lz + Math.cos(ang) * reach);
      ctx.glowAt(gx, gz).cone(gx, 0.2 + hgt, gz, 0, -1, 0, hgt, 0.3, hgt * 0.62, S.lampCol, 0.13, { segs: 8, seed: (i * 7 + b.id) % 50 });
      ctx.light(gx, gz, S.lamp === 'lampA' ? 26 : 17, S.lampCol, 0.8, hgt);
      lampSlots.add(Math.floor(t * slots)); poles.push([wx, wz]);
    }
    // utility poles carry the district's wiring: sagging runs from pole to pole
    if (S.lamp === 'lampB') for (let i = 0; i + 1 < poles.length; i++) {
      const A = poles[i], Bp = poles[i + 1]; const dx = Bp[0] - A[0], dz = Bp[1] - A[1]; const L = Math.hypot(dx, dz); if (L < 6 || L > 60) continue;
      const pen = ctx.penAt(A[0], 0.2, A[1], 0); ctx.detail(); pen.use(K.dark(0.05));
      for (const [off, y0] of [[-0.95, 8.25], [0.95, 8.25], [0.1, 7.45]]) { const nx = (-dz / L) * off, nz = (dx / L) * off; const sag = 0.35 + L * 0.03 + Math.abs(off) * 0.1; let px = nx, py = y0, pz = nz; for (let k = 1; k <= 4; k++) { const t = k / 4; const x = dx * t + nx, z = dz * t + nz, y = y0 - sag * 4 * t * (1 - t); pen.tube(px, py, pz, x, y, z, 0.022, 3); px = x; py = y; pz = z; } }
      ctx.main();
    }
    // kerbside: parked hover cars on the carriageway, scooters lined up on the pavement edge
    { const pk = { sump: 0.1, oldq: 0.13, lumina: 0.17, hive: 0.11, meridian: 0.09, foundry: 0.04, port: 0.04 }[b.district] || 0; const ps = Math.floor(L / 6.4);
      for (let s = 1; s < ps - 1; s++) { const t = (s + 0.5) / ps; const bx = x0 + (x1 - x0) * t, bz = z0 + (z1 - z0) * t;
        if (rng.chance(pk)) { const [wx, wz] = b.at(bx + Math.sin(ang) * 2.35, bz + Math.cos(ang) * 2.35); const yaw = b.yaw + ang + (rng.chance(0.5) ? 1.5708 : -1.5708) + rng.f(-0.04, 0.04); ctx.prop('hovercar', wx, 0.0, wz, yaw, rng.f(0.92, 1.08), [rng.f(0.5, 1.5), rng.f(0.5, 1.4), rng.f(0.5, 1.5)]); ctx.phys.addBox(wx, wz, 1.0, 2.3, yaw, 0, 1.4); }
        else if (b.walk >= 3 && rng.chance(pk * 0.45)) { const nS = rng.i(2, 4); for (let q = 0; q < nS; q++) { const [wx, wz] = b.at(bx + Math.cos(ang) * q * 0.62 - Math.sin(ang) * 0.5, bz - Math.sin(ang) * q * 0.62 - Math.cos(ang) * 0.5); ctx.prop('scooter', wx, 0.2, wz, b.yaw + ang + 0.25 + rng.f(-0.12, 0.12), 1, [rng.f(0.6, 1.6), rng.f(0.6, 1.4), rng.f(0.6, 1.5)]); } } } }
    { const busy = { sump: 1, oldq: 0.8, lumina: 1, hive: 0.8, meridian: 0.6 }[b.district] || 0; const ox = Math.sin(ang), oz = Math.cos(ang), ax = (x1 - x0) / L, az = (z1 - z0) / L;
      const W2 = (bx, bz) => b.at(bx, bz); const spot = (bx, bz, yaw, o = {}) => { const [wx, wz] = W2(bx, bz); ctx.spots.push({ x: wx, y: 0.2, z: wz, yaw: b.yaw + yaw, ...o }); };
      if (busy && L > 30) { const [wx, wz] = W2(x0 + ax * 2.4 + ox * 0.35, z0 + az * 2.4 + oz * 0.35); ctx.prop('signal', wx, 0.2, wz, b.yaw + ang); ctx.phys.addCyl(wx, wz, 0.15, 0.2, 6);
        for (let k = 0; k < 3; k++) if (rng.chance(0.55 * busy)) spot(x0 + ax * (3.6 + k * 0.8) - ox * rng.f(0.1, 0.9), z0 + az * (3.6 + k * 0.8) - oz * rng.f(0.1, 0.9), ang + rng.f(-0.4, 0.4), { clip: rng.pick(['idle', 'phone', 'idle']) }); }
      if (busy && L > 70 && b.walk >= 2.7 && rng.chance(0.4 * busy)) { const t = rng.f(0.35, 0.65); const bx = x0 + (x1 - x0) * t - ox * 0.5, bz = z0 + (z1 - z0) * t - oz * 0.5; const [wx, wz] = W2(bx, bz); ctx.prop('shelter', wx, 0.2, wz, b.yaw + ang); ctx.phys.addBox(wx, wz, 2.2, 0.3, b.yaw + ang, 0.2, 2.6); ctx.light(wx, wz, 9, [0.9, 0.95, 1], 0.6, 2.7);
        for (let k = 0; k < 4; k++) if (rng.chance(0.65)) spot(bx + ax * rng.f(-1.8, 2.6) + ox * rng.f(0.3, 0.9), bz + az * rng.f(-1.8, 2.6) + oz * rng.f(0.3, 0.9), ang + rng.f(-0.5, 0.5), { clip: rng.pick(['idle', 'phone', 'phone', 'talk']) }); }
      if (busy && b.walk >= 2.7) { const nV = Math.floor((L / 42) * busy + rng.f(0, 1)); for (let q = 0; q < nV; q++) { const t = rng.f(0.12, 0.88); const bx = x0 + (x1 - x0) * t - ox * 0.2, bz = z0 + (z1 - z0) * t - oz * 0.2; const [wx, wz] = W2(bx, bz); const cart = rng.chance(0.5);
          ctx.prop(cart ? 'cart' : 'stall', wx, 0.2, wz, b.yaw + ang + Math.PI, 1, [rng.f(0.7, 1.4), rng.f(0.7, 1.3), rng.f(0.7, 1.3)]); ctx.phys.addCyl(wx, wz, 1.0, 0.2, 2.2); ctx.light(wx, wz, 8, rng.pick([NE.sodium, NE.amber, NE.white]), 0.8, 2.3); if (rng.chance(0.6)) ctx.steam.push({ x: wx, y: 1.8, z: wz, s: 0.5 });
          for (let k = 0; k < 3; k++) if (rng.chance(0.7)) spot(bx - ox * (1.3 + k * 0.75) + ax * rng.f(-0.3, 0.3), bz - oz * (1.3 + k * 0.75) + az * rng.f(-0.3, 0.3), ang + rng.f(-0.25, 0.25), { clip: k === 0 ? 'talk' : rng.pick(['idle', 'phone']) }); } } }
    if (b.walk < 3.4) continue; // too narrow for furniture
    for (let s = 1; s < slots - 1; s++) {
      if (lampSlots.has(s) || !rng.chance(0.2 * ctx.density)) continue;
      const t = (s + 0.5) / slots; const lx = x0 + (x1 - x0) * t - Math.sin(ang) * 0.4, lz = z0 + (z1 - z0) * t - Math.cos(ang) * 0.4;
      const name = rng.weighted(S.furniture); const [wx, wz] = b.at(lx, lz);
      ctx.prop(name, wx, 0.2, wz, b.yaw + ang + (name === 'bench' || name === 'vending' || name === 'kiosk' ? Math.PI : rng.f(0, 6.28)), name === 'tree' ? rng.f(0.8, 1.3) : 1);
      if (name === 'vending' || name === 'kiosk') ctx.light(wx, wz, 7, name === 'kiosk' ? NE.cyan : NE.white, 0.4, 1.5);
      if (name !== 'bollard' && name !== 'bin') ctx.phys.addCyl(wx, wz, name === 'tree' ? 0.3 : 0.55, 0.2, name === 'tree' ? 3 : 1.2);
    }
  }
}


// smart-street gantries: a truss across the carriageway carrying a ticker board, downlights and signal lamps.
// They put structure over the player's head and tell you the street is managed by something.
function gantries(ctx, rng) {
  for (const s of ctx.streets || []) {
    if (!['sump', 'lumina', 'oldq', 'hive', 'meridian'].includes(s.district) || s.w < 8 || !rng.chance(0.6)) continue;
    const n = s.pts.length; const i = Math.min(n - 2, Math.floor((n - 1) * rng.f(0.25, 0.7))); const a = s.pts[i], b = s.pts[i + 1]; const t = n === 2 ? rng.f(0.25, 0.75) : 0.5;
    const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t; const dx = b[0] - a[0], dz = b[1] - a[1]; if (Math.hypot(dx, dz) < 1) continue;
    const hw = s.w / 2 + 0.7, H = s.w > 16 ? 8.2 : 6.6; const pen = ctx.penAt(x, 0.2, z, Math.atan2(dx, dz)); ctx.detail();
    { const l = Math.hypot(dx, dz); ctx.marks.push({ type: 'gantry', x: x + (dz / l) * 3, z: z - (dx / l) * 3, doorX: x, doorZ: z }); }
    pen.use(K.MAT_POLE); for (const sx of [-1, 1]) { pen.box(sx * hw, 0, 0.34, 0.34, 0, H + 0.9, {}); pen.box(sx * hw, 0, 0.62, 0.62, 0, 0.5, {}); pen.beam(sx * hw, H - 1.7, 0, sx * (hw - 1.7), H, 0, 0.12, 0.12); ctx.solidCyl(sx * hw, 0, 0.3, 0, H); }
    pen.box(0, 0, hw * 2, 0.3, H, H + 0.16, {}); pen.box(0, 0, hw * 2, 0.3, H + 0.74, H + 0.9, {}); for (let q = -hw + 0.6; q < hw - 0.6; q += 1.2) pen.beam(q, H + 0.16, 0, q + 0.6, H + 0.74, 0, 0.06, 0.06);
    const tk = ctx.atlas.tick; const bw = Math.min(hw * 1.1, 9);
    if (tk && tk.length) { const r = rng.pick(tk); const frac = Math.min(1, bw / 0.62 / (r.aspect || 40)); const u0 = r.u0 + (r.u1 - r.u0) * rng.f(0, 1 - frac); const part = { u0, v0: r.v0, u1: u0 + (r.u1 - r.u0) * frac, v1: r.v1 };
      pen.use(K.dark(0.05)); pen.box(0, 0, bw + 0.3, 0.2, H - 0.82, H - 0.04, {}); pen.sign(0, H - 0.43, 0.115, 0, bw, 0.62, part, { intensity: 3.6, seed: rng.i(0, 255) }); pen.sign(0, H - 0.43, -0.115, Math.PI, bw, 0.62, part, { intensity: 3.6, seed: rng.i(0, 255) }); }
    pen.use(K.emis([0.85, 0.95, 1], 10)); for (const q of [-hw * 0.82, hw * 0.82]) { pen.box(q, 0, 0.6, 0.24, H - 0.07, H, {}); ctx.light(pen.wx(q, 0), pen.wz(q, 0), 15, [0.85, 0.95, 1], 0.7, 0.2 + H - 0.2); }
    for (const sx of [-1, 1]) { pen.use(K.emis(sx > 0 ? [0.2, 1, 0.45] : [1, 0.25, 0.1], 9, 2, false, rng.i(0, 255))); pen.box(sx * hw, 0.2, 0.16, 0.08, 3.0, 3.16, {}); pen.box(sx * hw, -0.2, 0.16, 0.08, 3.0, 3.16, {}); }
    ctx.main();
  }
}

// A landmark never stands alone on a slab of paving: the block's street edges are built up with ordinary shop-houses
// and the big building sits in the court behind them, reached through a gap.
export function linerRows(ctx, rng, b, S, f0) {
  const F = ctx.footprints; const c = Math.cos(b.yaw), s = Math.sin(b.yaw); const W = b.w - 2 * b.walk, Dp = b.d - 2 * b.walk;
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, any = false;
  for (let i = f0; i < F.length; i++) { const f = F[i]; const dx = f[0] - b.x, dz = f[1] - b.z; const lx = dx * c - dz * s, lz = dx * s + dz * c; const r = f[4] - b.yaw; const ex = Math.abs(f[2] * Math.cos(r)) + Math.abs(f[3] * Math.sin(r)), ez = Math.abs(f[2] * Math.sin(r)) + Math.abs(f[3] * Math.cos(r)); x0 = Math.min(x0, lx - ex); x1 = Math.max(x1, lx + ex); z0 = Math.min(z0, lz - ez); z1 = Math.max(z1, lz + ez); any = true; }
  if (!any || W < 40 || Dp < 30) return;
  const dR = Math.min(12.5, Dp / 2 - 2.5);
  for (const sg of [1, -1]) {
    const zc = sg * (Dp / 2 - dR / 2), za = zc - dR / 2, zb = zc + dR / 2;
    let x = -W / 2; while (x < W / 2 - 6) { let w = rng.f(8, 15); if (W / 2 - (x + w) < 7) w = W / 2 - x; const cx = x + w / 2; const xa = x, xb = x + w; x += w;
      if (xb > x0 - 3 && xa < x1 + 3 && zb > z0 - 3 && za < z1 + 3) continue; // the landmark itself
      if (Math.abs(cx) < 7 + w / 2 && Math.abs(cx - (x0 + x1) / 2) < (x1 - x0) / 2 + 10) continue; // the way through to it
      const lot = { cx, cz: zc, w, d: dR, face: sg, corner: false, block: b, x: b.x + cx * c + zc * s, z: b.z - cx * s + zc * c, yaw: b.yaw + (sg < 0 ? Math.PI : 0) };
      shopHouse(ctx, rng, lot, S, { floors: rng.i(4, 8), shutter: 0.12 }); }
  }
}

// Real lots are used edge to edge. Whatever a building leaves free of its lot becomes a planted forecourt on the
// street side, marked parking courts down the sides and a service yard (plant, stores, a low annex) at the back.
function finishLot(ctx, rng, lot, f0, S) {
  const F = ctx.footprints; const c = Math.cos(lot.yaw), s = Math.sin(lot.yaw); const hw = lot.w / 2, hd = lot.d / 2;
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (let i = f0; i < F.length; i++) { const f = F[i]; const dx = f[0] - lot.x, dz = f[1] - lot.z; const lx = dx * c - dz * s, lz = dx * s + dz * c; if (Math.abs(lx) > hw || Math.abs(lz) > hd) continue;
    const r = f[4] - lot.yaw; const ex = Math.abs(f[2] * Math.cos(r)) + Math.abs(f[3] * Math.sin(r)), ez = Math.abs(f[2] * Math.sin(r)) + Math.abs(f[3] * Math.cos(r)); x0 = Math.min(x0, lx - ex); x1 = Math.max(x1, lx + ex); z0 = Math.min(z0, lz - ez); z1 = Math.max(z1, lz + ez); }
  if (x0 > x1) return; x0 = Math.max(x0, -hw); x1 = Math.min(x1, hw); z0 = Math.max(z0, -hd); z1 = Math.min(z1, hd);
  const front = hd - z1, back = z0 + hd; const pen = ctx.penAt(lot.x, 0.2, lot.z, lot.yaw);
  const P = (name, lx, lz, yaw = 0, sc = 1, tint = null, y = 0) => ctx.propL(name, lx, y, lz, yaw, sc, tint);
  if (front > 4.5) { // forecourt: an avenue of trees and planters either side of the way in, benches, light columns at the kerb
    const n = Math.max(2, Math.floor(lot.w / 7.5)); for (let i = 0; i < n; i++) { const x = -hw + (i + 0.5) * (lot.w / n); if (Math.abs(x) < 5.5) continue; const z = z1 + front * 0.58; const tree = i % 3 !== 1; P(tree ? 'tree' : 'planter', x, z, rng.f(0, 6.28), rng.f(0.9, 1.35)); if (tree) ctx.solidCyl(x, z, 0.3, 0, 3); if (front > 9 && i % 2 === 0) { P('bench', x, z1 + front * 0.25, Math.PI); ctx.solid(x, z1 + front * 0.25, 1.9, 0.5, 0, 0.5); } }
    for (const sx of [-1, 1]) { const lx = sx * Math.min(hw - 1.5, 6.5), lz = hd - 1.3; P('lampC', lx, lz); ctx.solidCyl(lx, lz, 0.2, 0, 7); ctx.light(pen.wx(lx, lz), pen.wz(lx, lz), 13, [1, 0.9, 0.75], 0.6, 6.8); }
  }
  for (const [gap, sx] of [[x0 + hw, -1], [hw - x1, 1]]) { // side courts: painted bays, parked cars, bollards at the street
    if (gap < 6.8) continue; const xc = sx * (hw - gap / 2); const zA = Math.max(-hd + 2.5, z0), zB = Math.min(hd - 4, z1); if (zB - zA < 6) continue;
    ctx.detail(); pen.use(ZEBRA); const bl = Math.min(2.6, gap / 2 - 0.7);
    for (let z = zA; z <= zB + 0.01; z += 2.9) { pen.flat(xc - bl, z - 0.05, xc + bl, z + 0.05, 0.025); if (z + 2.9 <= zB + 0.01 && rng.chance(0.55)) { const yaw = rng.chance(0.5) ? 1.5708 : -1.5708; P('hovercar', xc + rng.f(-0.2, 0.2), z + 1.45, yaw, rng.f(0.92, 1.06), [rng.f(0.5, 1.5), rng.f(0.5, 1.4), rng.f(0.5, 1.5)]); ctx.solid(xc, z + 1.45, 4.6, 2.0, 0, 1.4); } }
    ctx.main(); for (let x = xc - gap / 2 + 0.8; x < xc + gap / 2 - 0.5; x += 1.7) { if (Math.abs(x - xc) < 1.8) continue; P('bollard', x, hd - 0.6); }
  }
  if (back > 7) { // service yard
    const zc = -hd + back / 2; let ax0 = -hw + 1.5;
    if (back > 11 && lot.w > 26) { const aw = Math.min(lot.w * 0.45, 28), ad = Math.min(back - 3.5, 12), ah = rng.pick([4.4, 7.8]); const ax = -hw + aw / 2 + 1.5, az = -hd + ad / 2 + 1.2; ctx.main();
      pen.box(ax, az, aw, ad, 0, ah, { wall: M(ST.WIN_INDUSTRIAL, { color: rng.pick(S.walls), seed: rng.i(0, 255), A: 0.5, B: PAL.NEUTRAL, cellW: 3.2, floorH: ah > 5 ? 3.9 : 4.4, flags: WK.CONCRETE }), roof: K.conc(0.26), aoB: 0.6 });
      ctx.solid(ax, az, aw, ad, 0, ah); ctx.footprint(ax, az, aw, ad, 0, ah, lot.block.id); for (let i = 0; i < Math.floor(aw / 7); i++) P(rng.pick(['chiller', 'ventCap', 'cooler', 'acSmall']), ax - aw / 2 + 3 + i * 6.5, az + rng.f(-0.25, 0.25) * ad, rng.pick([0, 1.5708]), 1, null, ah); ax0 = -hw + aw + 3.5; }
    for (let x = ax0 + 1.5; x < hw - 2; x += rng.f(5, 9)) { const k = rng.next(); const name = k < 0.3 ? 'chiller' : k < 0.5 ? 'tank' : k < 0.7 ? 'crates' : k < 0.85 ? 'utilBox' : 'barrels'; const z = zc + rng.f(-0.25, 0.25) * back; P(name, x, z, rng.pick([0, 1.5708]), 1); ctx.solid(x, z, 1.6, 1.6, 0, 1.4); }
  }
  ctx.main();
}

// Perimeter block, the way real city blocks are built: lots line each street edge of the block's true outline
// (not its bounding box), share party walls, turn the corners pinwheel-fashion, and leave a court in the middle.
function edgeLots(ctx, b, rng, o) {
  const C = b.corners; let gx = 0, gz = 0; for (const p of C) { gx += p[0] / 4; gz += p[1] / 4; }
  const E = []; let inr = 1e9;
  for (let i = 0; i < 4; i++) { const a = C[i], q = C[(i + 1) % 4]; let tx = q[0] - a[0], tz = q[1] - a[1]; const L = Math.hypot(tx, tz); if (L < 1) continue; tx /= L; tz /= L; let nx = tz, nz = -tx; if ((a[0] - gx) * nx + (a[1] - gz) * nz < 0) { nx = -nx; nz = -nz; } inr = Math.min(inr, (a[0] - gx) * nx + (a[1] - gz) * nz - b.walk); E.push({ a, tx, tz, nx, nz, L }); }
  const dL = Math.max(6.5, Math.min((o.minDepth ?? 12) * rng.f(1.0, 1.2), inr - 1.2)); const lots = [], placed = [];
  const sep = (A, B) => { for (const [ux, uz] of [[A.c, -A.s], [A.s, A.c], [B.c, -B.s], [B.s, B.c]]) { const ra = A.hw * Math.abs(ux * A.c - uz * A.s) + A.hd * Math.abs(ux * A.s + uz * A.c), rb = B.hw * Math.abs(ux * B.c - uz * B.s) + B.hd * Math.abs(ux * B.s + uz * B.c); if (Math.abs((B.x - A.x) * ux + (B.z - A.z) * uz) > ra + rb - 0.25) return true; } return false; };
  const alley = Math.max(3.4, o.alley ?? 4); let rings = 0;
  for (let ring = 0; ring < 2; ring++) { const off = ring * (dL + alley); if (ring > 0 && inr - off < dL + 1.5) break; rings = ring + 1; const wk = ring ? 2.4 : 1.5;
  for (const e of E) {
    const L = e.L - 2 * (b.walk + off) - 0.6; let s = dL + 0.5; if (L < o.wmin + dL) continue;
    while (s < L - o.wmin * 0.6) { let w = rng.f(o.wmin, o.wmax) * wk; if (L - (s + w) < o.wmin * 0.75) w = L - s; if (w < 5) break;
      const al = b.walk + off + 0.3 + s + w / 2, dp = b.walk + off + dL / 2; const x = e.a[0] + e.tx * al - e.nx * dp, z = e.a[1] + e.tz * al - e.nz * dp; const yaw = Math.atan2(e.nx, e.nz);
      const R = { x, z, hw: w / 2 - 0.05, hd: dL / 2 - 0.05, c: Math.cos(yaw), s: Math.sin(yaw) };
      const inBlock = [[-1, -1], [1, -1], [1, 1], [-1, 1]].every(([sx2, sz2]) => { const px = R.x + sx2 * R.hw * R.c + sz2 * R.hd * R.s, pz = R.z - sx2 * R.hw * R.s + sz2 * R.hd * R.c; return E.every((q) => -((px - q.a[0]) * q.nx + (pz - q.a[1]) * q.nz) >= b.walk - 0.05); });
      if (inBlock && placed.every((P) => sep(P, R))) { placed.push(R); lots.push({ cx: 0, cz: 0, w, d: dL, face: 1, ring, corner: s < dL + 1 || s + w > L - 1, block: b, x, z, yaw }); }
      s += w; }
  } }
  // the court behind: a few trees, somewhere to leave a vehicle
  const core = inr - rings * (dL + alley) + alley;
  if (core > 7) { const r = core * 0.55; for (let k = 0; k < Math.min(6, Math.floor(r / 2.5)); k++) { const a = rng.f(0, 6.283), q = rng.f(0.2, 1) * r; const x = gx + Math.cos(a) * q, z = gz + Math.sin(a) * q; if (k % 3 === 2) ctx.prop('hovercar', x, 0.2, z, rng.f(0, 6.28), 1, [rng.f(0.5, 1.5), rng.f(0.5, 1.4), rng.f(0.5, 1.5)]); else { ctx.prop('tree', x, 0.2, z, rng.f(0, 6.28), rng.f(0.9, 1.4)); ctx.phys.addCyl(x, z, 0.3, 0.2, 3); } } }
  return lots;
}

// The inside of a perimeter block is not left as bare slab: the largest free rectangles become what courtyards
// really hold — a garden with trees and paths, a car park, a cluttered yard with sheds, or allotments.
const COURT = { sump: [[3, 'yard'], [2, 'parking'], [1.2, 'garden'], [1.2, 'allot']], oldq: [[3, 'garden'], [1.6, 'allot'], [1, 'parking']], hive: [[2.5, 'garden'], [2, 'parking'], [1.2, 'yard']], lumina: [[3, 'garden'], [1.2, 'parking'], [1, 'pool']], meridian: [[3, 'garden'], [1.5, 'pool'], [1, 'parking']] };
function courtyard(ctx, rng, b, S, lots, fB) {
  const g = 2, inW = b.w / 2 - (b.walk || 3) - 1, inD = b.d / 2 - (b.walk || 3) - 1; if (inW < 8 || inD < 8) return;
  const nx = Math.floor((2 * inW) / g), nz = Math.floor((2 * inD) / g); const cs = Math.cos(b.yaw), sn = Math.sin(b.yaw);
  const rects = lots.map((l) => [l.x, l.z, l.w / 2 + 1.2, l.d / 2 + 1.2, l.yaw]).concat(ctx.footprints.slice(fB).map((f) => [f[0], f[1], f[2] + 1.2, f[3] + 1.2, f[4]]));
  const C = b.corners; let gx = 0, gz = 0; if (C) for (const p of C) { gx += p[0] / C.length; gz += p[1] / C.length; }
  const inBlock = (x, z) => { if (!C) return true; for (let i = 0; i < C.length; i++) { const a = C[i], q = C[(i + 1) % C.length]; let tx = q[0] - a[0], tz = q[1] - a[1]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l; let mx = -tz, mz = tx; if ((gx - a[0]) * mx + (gz - a[1]) * mz < 0) { mx = -mx; mz = -mz; } if ((x - a[0]) * mx + (z - a[1]) * mz < (b.walk || 3) + 1.5) return false; } return true; };
  const free = new Uint8Array(nx * nz);
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const lx = -inW + (i + 0.5) * g, lz = -inD + (j + 0.5) * g; const x = b.x + lx * cs + lz * sn, z = b.z - lx * sn + lz * cs;
    if (!inBlock(x, z)) continue; let ok = true;
    for (const r of rects) { const c = Math.cos(r[4]), s2 = Math.sin(r[4]); const dx = x - r[0], dz = z - r[1]; if (Math.abs(dx * c - dz * s2) < r[2] + g * 0.5 && Math.abs(dx * s2 + dz * c) < r[3] + g * 0.5) { ok = false; break; } }
    free[j * nx + i] = ok ? 1 : 0;
  }
  const pen = ctx.penAt(b.x, 0.2, b.z, b.yaw); const kinds = COURT[b.district] || COURT.hive;
  for (let pass = 0; pass < 3; pass++) {
    // largest all-free rectangle (histogram method)
    const hgt = new Int32Array(nx); let best = null;
    for (let j = 0; j < nz; j++) { for (let i = 0; i < nx; i++) hgt[i] = free[j * nx + i] ? hgt[i] + 1 : 0;
      const st = []; for (let i = 0; i <= nx; i++) { const hh = i < nx ? hgt[i] : 0; let start = i; while (st.length && st[st.length - 1][1] >= hh) { const [si, sh] = st.pop(); const a = sh * (i - si); if (sh >= 3 && i - si >= 3 && (!best || a > best.a)) best = { a, i0: si, i1: i, j0: j - sh + 1, j1: j + 1 }; start = si; } st.push([start, hh]); } }
    if (!best || best.a * g * g < 90) break;
    for (let j = best.j0; j < best.j1; j++) for (let i = best.i0; i < best.i1; i++) free[j * nx + i] = 0;
    const x0 = -inW + best.i0 * g + 0.6, x1 = -inW + best.i1 * g - 0.6, z0 = -inD + best.j0 * g + 0.6, z1 = -inD + best.j1 * g - 0.6;
    // a big court is several things side by side (a car park next to a garden next to a yard), split by paths
    const W = x1 - x0, D = z1 - z0, alongX = W >= D, Lg = alongX ? W : D; const parts = Math.max(1, Math.min(3, Math.round((W * D) / 520), Math.floor(Lg / 16)));
    let last = null;
    for (let k = 0; k < parts; k++) { const a = k / parts, c = (k + 1) / parts, gap = parts > 1 ? 0.8 : 0; const sx0 = alongX ? x0 + W * a + (k ? gap : 0) : x0, sx1 = alongX ? x0 + W * c - (k < parts - 1 ? gap : 0) : x1, sz0 = alongX ? z0 : z0 + D * a + (k ? gap : 0), sz1 = alongX ? z1 : z0 + D * c - (k < parts - 1 ? gap : 0);
      let kind; for (let t = 0; t < 4; t++) { kind = rng.weighted(kinds); if (kind !== last && !(kind === 'yard' && (sx1 - sx0) * (sz1 - sz0) > 420)) break; } last = kind;
      fillCourt(ctx, rng, pen, kind, sx0, sz0, sx1, sz1, S); }
    if (parts > 1) { ctx.detail(); pen.use(M(ST.PAVE, { color: [0.46, 0.44, 0.41] })); for (let k = 1; k < parts; k++) { const t = alongX ? x0 + (W * k) / parts : z0 + (D * k) / parts; if (alongX) pen.flat(t - 0.8, z0, t + 0.8, z1, 0.026); else pen.flat(x0, t - 0.8, x1, t + 0.8, 0.026); } ctx.main(); }
  }
}
function fillCourt(ctx, rng, pen, kind, x0, z0, x1, z1, S) {
  const W = x1 - x0, D = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2; const P = (n, x, z, yaw = 0, sc = 1) => ctx.propL(n, x, 0, z, yaw, sc);
  const tree = (x, z) => { P('tree', x, z, rng.f(0, 6.28), rng.f(0.75, 1.25)); ctx.solidCyl(x, z, 0.3, 0, 3); };
  ctx.detail();
  if (kind === 'garden' || kind === 'pool') {
    pen.use(K.foliage(rng.pick([[0.2, 0.32, 0.14], [0.24, 0.34, 0.16], [0.18, 0.28, 0.13]]))); pen.flat(x0, z0, x1, z1, 0.018);
    const pave = M(ST.PAVE, { color: rng.pick([[0.5, 0.47, 0.42], [0.44, 0.42, 0.4]]) }); pen.use(pave);
    const alongX = W >= D; if (alongX) pen.flat(x0, cz - 1.1, x1, cz + 1.1, 0.03); else pen.flat(cx - 1.1, z0, cx + 1.1, z1, 0.03);
    if (W > 14 && D > 14) { if (alongX) pen.flat(cx - 1.1, z0, cx + 1.1, z1, 0.034); else pen.flat(x0, cz - 1.1, x1, cz + 1.1, 0.034); }
    if (kind === 'pool' && W > 12 && D > 10) { const pw = Math.min(W * 0.45, 18), pd = Math.min(D * 0.35, 8), px = cx + (alongX ? W * 0.22 : 0), pz = cz + (alongX ? 0 : D * 0.22) + (alongX ? -D * 0.25 : 0);
      pen.use(M(ST.STONE, { color: [0.6, 0.58, 0.54] })); pen.box(px, pz, pw + 1.2, pd + 1.2, 0, 0.12, {}); pen.use(M(ST.WATER, { color: [0.12, 0.3, 0.34] })); pen.flat(px - pw / 2, pz - pd / 2, px + pw / 2, pz + pd / 2, 0.13); }
    const sp = rng.f(6, 8.5); for (let x = x0 + 2; x < x1 - 1.5; x += sp) for (let z = z0 + 2; z < z1 - 1.5; z += sp) { const tx = x + rng.f(-1.2, 1.2), tz = z + rng.f(-1.2, 1.2); if (alongX ? Math.abs(tz - cz) < 2.4 : Math.abs(tx - cx) < 2.4) continue; if (W > 14 && D > 14 && (alongX ? Math.abs(tx - cx) < 2.4 : Math.abs(tz - cz) < 2.4)) continue; if (kind === 'pool' && Math.abs(tx - cx - W * 0.22) < 11 && Math.abs(tz - cz + D * 0.25) < 6) continue; if (rng.chance(0.8)) tree(tx, tz); else P('planter', tx, tz); }
    const nb = Math.max(1, Math.round((alongX ? W : D) / 9)); for (let k = 0; k < nb; k++) { const t = (k + 0.5) / nb; if (alongX) { P('bench', x0 + W * t, cz + 1.9, Math.PI); } else P('bench', cx + 1.9, z0 + D * t, -Math.PI / 2); }
    for (const t of [0.25, 0.75]) { const lx = alongX ? x0 + W * t : cx - 1.6, lz = alongX ? cz - 1.6 : z0 + D * t; P(S.lamp || 'lampC', lx, lz); ctx.light(pen.wx(lx, lz), pen.wz(lx, lz), 12, [1, 0.82, 0.6], 0.45, pen.oy + 4); }
  } else if (kind === 'parking') {
    pen.use(M(ST.ROAD, { cellW: 0, floorH: 0 })); pen.flat(x0, z0, x1, z1, 0.02);
    const alongX = W >= D; const L = alongX ? W : D, Wd = alongX ? D : W; const rows = Wd >= 17 ? 2 : 1; pen.use(M(ST.PLASTER, { color: [0.62, 0.62, 0.58] }));
    for (let r = 0; r < rows; r++) { const off = rows === 2 ? (r ? Wd / 2 - 2.8 : -Wd / 2 + 2.8) : -Wd / 2 + 2.8; const yaw = (rows === 2 && r ? Math.PI : 0) + (alongX ? 0 : Math.PI / 2);
      for (let t = 1.2; t + 2.7 < L - 1; t += 2.7) { const a = (alongX ? x0 : z0) + t; if (alongX) pen.flat(a - 0.06, cz + off - 2.5, a + 0.06, cz + off + 2.5, 0.03); else pen.flat(cx + off - 2.5, a - 0.06, cx + off + 2.5, a + 0.06, 0.03);
        if (rng.chance(0.68)) { const m = a + 1.35; if (alongX) P('hovercar', m, cz + off, yaw + Math.PI / 2 + rng.f(-0.04, 0.04)); else P('hovercar', cx + off, m, yaw + Math.PI / 2 + rng.f(-0.04, 0.04)); } } }
    for (const t of [0.2, 0.8]) { const lx = alongX ? x0 + W * t : cx, lz = alongX ? cz : z0 + D * t; if (rows === 2) { P('lampA', lx, lz); ctx.light(pen.wx(lx, lz), pen.wz(lx, lz), 16, [1, 0.85, 0.65], 0.5, pen.oy + 6); } }
    if (rng.chance(0.7)) for (const [x, z] of [[x0 + 1, z0 + 1], [x1 - 1, z1 - 1]]) tree(x, z);
  } else if (kind === 'allot') {
    pen.use(M(ST.PAVE, { color: [0.36, 0.3, 0.24] })); pen.flat(x0, z0, x1, z1, 0.02);
    const beds = Math.max(2, Math.floor(W / 3)); for (let k = 0; k < beds; k++) { const bx0 = x0 + 0.6 + k * (W - 1.2) / beds, bx1 = bx0 + (W - 1.2) / beds - 0.9; pen.use(K.foliage(rng.pick([[0.22, 0.38, 0.15], [0.3, 0.4, 0.16], [0.36, 0.3, 0.16], [0.18, 0.3, 0.12]]))); pen.box((bx0 + bx1) / 2, cz, bx1 - bx0, D - 1.6, 0, 0.32, { wall: M(ST.CONCRETE, { color: [0.3, 0.24, 0.18] }) }); }
    const sx = x1 - 2, sz = z0 + 1.8; pen.box(sx, sz, 2.6, 2.2, 0, 2.3, { wall: M(ST.CORRUGATED, { color: rng.pick([[0.3, 0.4, 0.3], [0.42, 0.24, 0.18], [0.36, 0.38, 0.4]]) }), roof: K.rust([0.32, 0.26, 0.2]) }); ctx.solid(sx, sz, 2.6, 2.2, 0, 2.3); P('barrels', sx - 2, sz);
    if (rng.chance(0.6)) tree(x0 + 1.2, z1 - 1.2);
  } else { // yard: a row of sheds and lean-tos along one edge, their clutter in front, the rest open hardstanding
    pen.use(K.conc(0.3)); pen.flat(x0, z0, x1, z1, 0.02);
    const alongX = W >= D; const L = alongX ? W : D; let t = 0.4; const dep = Math.min(4, (alongX ? D : W) * 0.4); const side = rng.sign();
    while (t < L - 2.4) { const w = Math.min(L - t - 0.4, rng.f(2.6, 4.6)), hh = rng.f(2.2, 3.0); const m = t + w / 2; const off = side * ((alongX ? D : W) / 2 - dep / 2);
      const x = alongX ? x0 + m : cx + off, z = alongX ? cz + off : z0 + m; const sx = alongX ? w - 0.15 : dep, sz = alongX ? dep : w - 0.15;
      const col = rng.pick([[0.36, 0.38, 0.4], [0.42, 0.26, 0.2], [0.3, 0.36, 0.42], [0.46, 0.42, 0.34], [0.3, 0.4, 0.32]]);
      pen.box(x, z, sx, sz, 0, hh, { wall: M(ST.CORRUGATED, { color: col, seed: rng.i(0, 255) }), roof: rng.chance(0.5) ? K.rust([0.34, 0.26, 0.2]) : M(ST.FABRIC, { color: rng.pick(S.tarps || [[0.2, 0.3, 0.5]]) }) }); ctx.solid(x, z, sx, sz, 0, hh);
      if (rng.chance(0.55)) { const fx = alongX ? x + rng.f(-w / 3, w / 3) : cx + off - side * (dep / 2 + 0.8), fz = alongX ? cz + off - side * (dep / 2 + 0.8) : z + rng.f(-w / 3, w / 3); P(rng.pick(['crates', 'barrels', 'scooter', 'trash']), fx, fz, rng.f(0, 6.28)); }
      t += w + rng.f(0.1, 0.6); }
    for (let k = 0; k < 2; k++) if (rng.chance(0.7)) tree(alongX ? x0 + 1.5 + k * (W - 3) : cx - side * (W / 2 - 1.5), alongX ? cz - side * (D / 2 - 1.5) : z0 + 1.5 + k * (D - 3));
  }
  ctx.main();
}

export function buildDistricts(ctx) {
  const rng0 = ctx.rng.fork('districts'); const ls = 1 / Math.sqrt(ctx.density);
  let cur = []; const subdivideT = (b, rng, o) => { const l = subdivide(b, rng, o); cur.push(...l); return l; };
  const sub = (b, rng, o) => { const oo = { ...o, wmin: o.wmin * ls, wmax: o.wmax * ls }; if ((o.mode === 'perimeter' || o.mode === 'rows') && b.corners && b.corners.length === 4) { if (o.mode === 'rows') oo.minDepth = o.depth ?? 13; const l = edgeLots(ctx, b, rng, oo); if (l.length) { cur.push(...l); return l; } } return subdivideT(b, rng, oo); };
  const tally = {}; const countV = () => { let n = 0; for (const c of ctx.chunks.values()) n += c.main.n + c.detail.n; return n; };
  // a share of the larger street-front lots goes to the institutions every district needs, in rotation so each kind appears
  const civN = {}; const civPick = (b, lot, rng) => { if (lot.ring || lot.w < 19 || lot.d < 9 || !rng.chance(0.17)) return null; const k = (civN[b.district] = (civN[b.district] || 0) + 1); return CIVIC[(k + b.district.length) % CIVIC.length]; };
  for (const b of ctx.blocks) {
    if (b.reserved) continue;
    const v0 = countV(), b0 = ctx.stats.buildings;
    const rng = rng0.fork(b.id); const S = STYLES[b.district]; const H = skyline(b, rng);
    const prime = b.edge.inner || b.edge.outer || b.edge.left || b.edge.right; // faces an arterial
    streetscape(ctx, rng, b, S);
    if (b.plaza) { plaza(ctx, rng, b, S);
      if (b.district === 'oldq') { // a square is framed by lawns and avenues of trees outside the colonnade
        const W = b.w - b.walk * 2, Dp = b.d - b.walk * 2, R = Math.min(W, Dp) * 0.36 + 3.5, e = Math.min(16, Math.min(W, Dp) / 2 - R - 2); const pen = ctx.penAt(b.x, 0.2, b.z, b.yaw); const fr = rng.fork(51);
        if (e >= 6) { const hw = W / 2 - 2, hd = Dp / 2 - 2; fillCourt(ctx, fr, pen, 'garden', -hw, hd - e, hw, hd, S); fillCourt(ctx, fr, pen, 'garden', -hw, -hd, hw, -hd + e, S);
          if (hd - e - 1.6 > -hd + e + 1.6) { fillCourt(ctx, fr, pen, 'garden', hw - e, -hd + e + 1.6, hw, hd - e - 1.6, S); fillCourt(ctx, fr, pen, 'garden', -hw, -hd + e + 1.6, -hw + e, hd - e - 1.6, S); } } }
      continue; }
    cur = []; const fB = ctx.footprints.length;
    switch (b.district) {
      case 'sump': {
        const dense = b.noise > 0.52 && b.j < 2;
        const lots = dense ? sub(b, rng, { mode: 'rows', wmin: 9, wmax: 17, depth: 13, alley: 3.4 }) : sub(b, rng, { mode: 'perimeter', wmin: 18, wmax: 44, alley: 6, minDepth: 12 });
        for (const lot of lots) {
          { const ck = civPick(b, lot, rng); if (ck) { civic(ctx, rng, lot, S, ck); continue; } }
          const tall = lot.w > 16 && rng.chance(0.7);
          const res = lot.ring ? rng.chance(0.9) : rng.chance(prime ? 0.15 : 0.45);
          if (tall) tenement(ctx, rng, lot, S, { floors: Math.round(clamp(H / 3 * rng.f(0.6, 1.5), 5, 26)), shanty: true, res });
          else { const home = !ctx.homeDone && dense && lot.w > 8 && Math.hypot(b.x, b.z - 1750) < 520; if (home) ctx.homeDone = true; shopHouse(ctx, rng, lot, S, { floors: home ? 5 : Math.round(clamp((H / 3.2) * rng.f(0.55, 1.35), 4, 12)), shanty: true, shutter: 0.22, res: res && !home, ...(home ? { enter: true, kind: 'home', home: true } : {}) }); }
        }
        break;
      }
      case 'oldq': {
        if (b.w > 90 && b.noise2 > 0.7 && rng.chance(0.3)) { const [lot] = subdivideT(b, rng, { mode: 'mega', wmin: 999 }); archiveSpire(ctx, rng, lot, S, { h: 160 + 380 * b.noise }); break; }
        for (const lot of sub(b, rng, { mode: 'perimeter', wmin: 11, wmax: 24, alley: 5, minDepth: 11 })) { { const ck = civPick(b, lot, rng); if (ck) { civic(ctx, rng, lot, S, ck); continue; } } const fl = Math.round(clamp((H / 3.4) * rng.f(0.6, 1.3), 4, 10)); if (lot.ring || (!lot.corner && !prime && rng.chance(0.62))) shopHouse(ctx, rng, lot, S, { floors: Math.min(fl + 1, 8), res: lot.ring ? true : rng.chance(0.75) }); else guildHouse(ctx, rng, lot, S, { floors: fl }); }
        break;
      }
      case 'lumina': {
        if (b.noise > 0.6 && rng.chance(0.45)) { const [lot] = subdivideT(b, rng, { mode: 'mega', wmin: 999 }); terrace(ctx, rng, lot, S, { h: clamp(H * 1.3, 60, 320), mega: true }); break; }
        for (const lot of sub(b, rng, { mode: 'perimeter', wmin: 16, wmax: 40, alley: 4, minDepth: 16 })) {
          { const ck = civPick(b, lot, rng); if (ck) { civic(ctx, rng, lot, S, ck); continue; } }
          const k = rng.next(); const hh = clamp(H * rng.f(0.5, 1.4), 18, 300);
          if (k < 0.4) terrace(ctx, rng, lot, S, { h: Math.min(hh, 110) }); else if (k < 0.75 && lot.w > 22) techTower(ctx, rng, lot, S, { h: hh, brand: rng.chance(0.3) ? 'lumina' : null }); else shopHouse(ctx, rng, lot, S, { floors: Math.round(clamp(hh / 3.6, 4, 10)), gh: 4.6, res: lot.ring ? true : rng.chance(0.2) });
        }
        break;
      }
      case 'meridian': {
        if ((b.noise > 0.5 || prime) && b.w > 100 && rng.chance(0.6)) { const [lot] = subdivideT(b, rng, { mode: 'mega', wmin: 999 }); megaTower(ctx, rng, lot, S, { h: clamp(H * rng.f(0.9, 1.5), 260, 880), brand: rng.chance(0.6) ? 'meridian' : rng.pick(['helion', 'aether', 'archive']) }); break; }
        for (const lot of sub(b, rng, { mode: 'perimeter', wmin: 38, wmax: 72, alley: 8, minDepth: 30 })) techTower(ctx, rng, lot, S, { h: clamp(H * rng.f(0.45, 1.1), 60, 520), brand: rng.chance(0.4) ? rng.pick(['meridian', 'helion', 'aether']) : null });
        break;
      }
      case 'hive': {
        if (b.w > 150 && rng.chance(0.75)) { const [lot] = subdivideT(b, rng, { mode: 'mega', wmin: 999 }); capsuleBlock(ctx, rng, lot, S, { h: clamp(H * rng.f(0.8, 1.3), 180, 620) }); break; }
        for (const lot of sub(b, rng, { mode: 'perimeter', wmin: 26, wmax: 60, alley: 8, minDepth: 20 })) if (civPick(b, lot, rng)) civic(ctx, rng, lot, S, CIVIC[(civN[b.district] + 4) % CIVIC.length]); else tenement(ctx, rng, lot, S, { floors: Math.round(clamp(H / 3 * rng.f(0.15, 0.4), 8, 40)), res: lot.ring ? true : rng.chance(prime ? 0.2 : 0.6) });
        break;
      }
      case 'verdant': { const [lot] = subdivideT(b, rng, { mode: 'mega', wmin: 999 }); farmTower(ctx, rng, lot, S, { h: clamp(H * rng.f(0.7, 1.4), 60, 420) }); break; }
      case 'foundry': { const [lot] = subdivideT(b, rng, { mode: 'mega', wmin: 999 }); factory(ctx, rng, lot, S, { h: H }); break; }
      case 'port': { const [lot] = subdivideT(b, rng, { mode: 'mega', wmin: 999 }); depot(ctx, rng, lot, S, { h: H }); break; }
    }
    if (cur.length > 1 && COURT[b.district]) courtyard(ctx, rng.fork(733), b, S, cur, fB);
    if (cur.length === 1 && ['oldq', 'lumina', 'meridian', 'hive', 'verdant'].includes(b.district)) linerRows(ctx, rng.fork(455), b, STYLES[b.district === 'verdant' || b.district === 'meridian' ? 'lumina' : b.district], fB);
    if (b.district === 'lumina' || b.district === 'meridian' || b.district === 'hive') { const fr = rng.fork(977); for (const lot of cur) finishLot(ctx, fr, lot, fB, S); }
    const t = tally[b.district] || (tally[b.district] = { blocks: 0, bld: 0, verts: 0 }); t.blocks++; t.bld += ctx.stats.buildings - b0; t.verts += countV() - v0;
  }
  gantries(ctx, rng0.fork('gantry'));
  console.log('[NS] tally ' + Object.entries(tally).map(([k, t]) => `${k}: ${t.blocks}blk ${t.bld}bld ${(t.verts / 1e6).toFixed(2)}Mv`).join(' | '));
}
