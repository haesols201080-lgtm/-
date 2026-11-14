// District programme: turns planned blocks into lots and lots into buildings, with a distinct
// architectural language, skyline logic and streetscape per district.
import { ST, PAL, WK } from '../render/cityMaterial.js';
import { M } from './builder.js';
import * as K from './kit.js';
import { subdivide, DPLAN } from './plan.js';
import { shopHouse, tenement, techTower, megaTower, ROOF_LOW, ROOF_TECH } from './buildings.js';
import { capsuleBlock, terrace, guildHouse, archiveSpire, factory, depot, farmTower, plaza } from './buildings2.js';
import { clamp } from '../core/rng.js';

const NE = K.NEON;
const TARPS = [[0.2, 0.32, 0.45], [0.48, 0.25, 0.2], [0.5, 0.42, 0.2], [0.22, 0.4, 0.32], [0.45, 0.45, 0.46], [0.4, 0.22, 0.35]];
export const STYLES = {
  sump: { walls: [[0.36, 0.33, 0.3], [0.3, 0.32, 0.33], [0.38, 0.31, 0.27], [0.33, 0.34, 0.3], [0.4, 0.36, 0.3], [0.28, 0.3, 0.32]], wk: [WK.PLASTER, WK.CONCRETE, WK.CONCRETE, WK.PLASTER], win: ST.WIN_RES, lights: [PAL.WARM, PAL.MIXED, PAL.WARM], lit: [0.18, 0.45], accents: [NE.pink, NE.cyan, NE.amber, NE.green], floorH: 3.0, cellW: 3.0, awning: true, tarps: TARPS, balcony: 0.4, blade: 0.75, upperSigns: 0.5, signI: 5, enter: 0.4, roof: ROOF_LOW, roofDensity: 1.4, lamp: 'lampB', lampTint: [1, 0.7, 0.4], lampCol: NE.sodium, furniture: [[3, 'crates'], [2, 'barrels'], [2, 'trash'], [2, 'bin'], [1.5, 'scooter'], [1, 'utilBox'], [1.2, 'vending'], [1, 'cart']] },
  oldq: { walls: [[0.5, 0.47, 0.42], [0.46, 0.44, 0.4], [0.52, 0.48, 0.41], [0.42, 0.42, 0.42]], wk: [WK.STONE, WK.STONE, WK.PLASTER], win: ST.WIN_RES, lights: [PAL.WARM, PAL.GOLD, PAL.WARM, PAL.VIOLET], lit: [0.15, 0.4], accents: [NE.violet, NE.gold, NE.amber], floorH: 3.4, cellW: 2.9, balcony: 0.15, blade: 0.35, upperSigns: 0.15, signI: 3.5, roof: ROOF_LOW, roofDensity: 0.6, lamp: 'lampC', lampTint: [1, 0.75, 0.5], lampCol: NE.gold, furniture: [[3, 'bench'], [2, 'planter'], [2, 'bollard'], [1, 'bin'], [1, 'kiosk']] },
  lumina: { walls: [[0.26, 0.24, 0.3], [0.3, 0.26, 0.28], [0.22, 0.24, 0.3], [0.32, 0.28, 0.26]], wk: [WK.COMPOSITE, WK.METAL, WK.PLASTER], win: ST.WIN_RES, towerWin: [ST.WIN_LUX, ST.WIN_RIBBON, ST.WIN_OFFICE], lights: [PAL.WARM, PAL.WARM, PAL.MIXED, PAL.MAGENTA], lit: [0.35, 0.6], accents: [NE.pink, NE.violet, NE.cyan], floorH: 3.6, cellW: 3.2, balcony: 0.2, blade: 0.9, upperSigns: 0.8, signI: 6, enter: 0.45, pads: 0.25, screens: 0.45, bands: 0.7, forms: { disc: 2, cyl: 1.6, aframe: 2.2, stack: 1.6, slab: 0.5, gate: 1.4 }, roof: ROOF_TECH, lamp: 'lampC', lampTint: [1, 0.4, 0.8], lampCol: NE.pink, furniture: [[3, 'vending'], [2, 'kiosk'], [2, 'bench'], [2, 'scooter'], [1, 'bin'], [1, 'cart'], [1, 'droneDock']] },
  meridian: { walls: [[0.3, 0.38, 0.44], [0.34, 0.36, 0.4], [0.4, 0.36, 0.3], [0.26, 0.32, 0.4], [0.36, 0.4, 0.42]], wk: [WK.COMPOSITE, WK.METAL, WK.COMPOSITE], win: ST.WIN_OFFICE, towerWin: [ST.WIN_OFFICE, ST.WIN_OFFICE, ST.WIN_RIBBON], lights: [PAL.NEUTRAL, PAL.COOL, PAL.NEUTRAL], lit: [0.3, 0.55], accents: [NE.ice, NE.ice, NE.white, NE.cyan], floorH: 4.2, cellW: 3.0, pads: 0.55, screens: 0.1, bands: 0.15, roof: ROOF_TECH, lamp: 'lampA', lampTint: [0.75, 0.9, 1], lampCol: NE.ice, furniture: [[3, 'tree'], [2, 'bench'], [2, 'planter'], [2, 'bollard'], [1.5, 'kiosk'], [1, 'droneDock'], [1, 'bin']] },
  hive: { walls: [[0.44, 0.4, 0.34], [0.4, 0.38, 0.36], [0.46, 0.38, 0.3], [0.36, 0.38, 0.4]], wk: [WK.CONCRETE, WK.PLASTER, WK.CONCRETE], win: ST.WIN_RES, lights: [PAL.WARM, PAL.WARM, PAL.NEUTRAL, PAL.MIXED], lit: [0.25, 0.55], accents: [NE.amber, NE.sodium, NE.cyan, NE.gold], floorH: 3.0, cellW: 3.0, awning: true, tarps: TARPS, balcony: 0.7, blade: 0.5, upperSigns: 0.3, signI: 4.5, roof: ROOF_LOW, lamp: 'lampA', lampTint: [1, 0.75, 0.45], lampCol: NE.sodium, furniture: [[3, 'bench'], [2, 'vending'], [2, 'scooter'], [2, 'bin'], [1, 'cart'], [1, 'planter'], [1, 'crates']] },
  verdant: { walls: [[0.36, 0.42, 0.38], [0.4, 0.42, 0.4], [0.32, 0.36, 0.34]], wk: [WK.COMPOSITE, WK.CONCRETE, WK.METAL], win: ST.WIN_GROW, towerWin: [ST.WIN_GROW], lights: [PAL.MAGENTA, PAL.VIOLET, PAL.GREEN], lit: [0.6, 0.9], accents: [NE.magenta, NE.green, NE.violet], floorH: 4.5, cellW: 3.6, pads: 0.3, roof: ROOF_TECH, lamp: 'lampA', lampTint: [0.7, 1, 0.75], lampCol: NE.green, furniture: [[3, 'planter'], [3, 'tree'], [1, 'bench'], [1, 'utilBox'], [1, 'crates']] },
  foundry: { walls: [[0.34, 0.3, 0.27], [0.3, 0.29, 0.28], [0.38, 0.32, 0.26]], wk: [WK.RUST, WK.RIBBED, WK.CONCRETE], win: ST.WIN_INDUSTRIAL, towerWin: [ST.WIN_INDUSTRIAL, ST.WIN_RIBBON], lights: [PAL.AMBER, PAL.RED, PAL.WARM], lit: [0.3, 0.6], accents: [NE.red, NE.amber, NE.sodium], floorH: 5, cellW: 4, roof: ROOF_TECH, lamp: 'lampA', lampTint: [1, 0.55, 0.25], lampCol: NE.sodium, furniture: [[3, 'barrels'], [3, 'crates'], [2, 'utilBox'], [2, 'barrier'], [1, 'trash']] },
  port: { walls: [[0.34, 0.36, 0.38], [0.3, 0.33, 0.36], [0.38, 0.38, 0.36]], wk: [WK.RIBBED, WK.METAL, WK.CONCRETE], win: ST.WIN_INDUSTRIAL, towerWin: [ST.WIN_RIBBON, ST.WIN_INDUSTRIAL], lights: [PAL.COOL, PAL.NEUTRAL, PAL.AMBER], lit: [0.25, 0.5], accents: [NE.cyan, NE.blue, NE.amber], floorH: 4.5, cellW: 4, pads: 0.6, roof: ROOF_TECH, lamp: 'lampA', lampTint: [0.7, 0.9, 1], lampCol: NE.ice, furniture: [[3, 'crates'], [2, 'barrier'], [2, 'barrels'], [2, 'utilBox'], [1, 'droneDock']] },
};

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
  const sides = [[-hw, hd - inset, hw, hd - inset, 0], [hw - inset, hd, hw - inset, -hd, Math.PI / 2], [hw, -hd + inset, -hw, -hd + inset, Math.PI], [-hw + inset, -hd, -hw + inset, hd, -Math.PI / 2]];
  const prime0 = b.edge && (b.edge.inner || b.edge.outer || b.edge.left || b.edge.right); const stW = (DPLAN[b.district] || {}).sw || 12; let si = -1;
  for (const [x0, z0, x1, z1, ang] of sides) {
    const L = Math.hypot(x1 - x0, z1 - z0); si++;
    // zebra crossings at the block corners (two of the four sides, so neighbouring blocks never double up)
    if (si < 2 && !prime0 && L > 34 && stW <= 22) for (const tt of [5.5 / L, 1 - 5.5 / L]) {
      const [zx, zz] = b.at(x0 + (x1 - x0) * tt + Math.sin(ang) * inset, z0 + (z1 - z0) * tt + Math.cos(ang) * inset);
      const zp = ctx.penAt(zx, 0, zz, b.yaw + ang); ctx.detail(); zp.use(ZEBRA); for (let q = 0.7; q < stW - 0.9; q += 1.0) zp.flat(-1.7, q, 1.7, q + 0.5, 0.03); ctx.main();
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

export function buildDistricts(ctx) {
  const rng0 = ctx.rng.fork('districts'); const ls = 1 / Math.sqrt(ctx.density);
  const sub = (b, rng, o) => subdivide(b, rng, { ...o, wmin: o.wmin * ls, wmax: o.wmax * ls });
  const tally = {}; const countV = () => { let n = 0; for (const c of ctx.chunks.values()) n += c.main.n + c.detail.n; return n; };
  for (const b of ctx.blocks) {
    if (b.reserved) continue;
    const v0 = countV(), b0 = ctx.stats.buildings;
    const rng = rng0.fork(b.id); const S = STYLES[b.district]; const H = skyline(b, rng);
    const prime = b.edge.inner || b.edge.outer || b.edge.left || b.edge.right; // faces an arterial
    streetscape(ctx, rng, b, S);
    if (b.plaza) { plaza(ctx, rng, b, S); continue; }
    switch (b.district) {
      case 'sump': {
        const dense = b.noise > 0.52 && b.j < 2;
        const lots = dense ? sub(b, rng, { mode: 'rows', wmin: 9, wmax: 17, depth: 13, alley: 3.4 }) : sub(b, rng, { mode: 'perimeter', wmin: 18, wmax: 44, alley: 6, minDepth: 12 });
        for (const lot of lots) {
          const tall = lot.w > 16 && rng.chance(0.7);
          if (tall) tenement(ctx, rng, lot, S, { floors: Math.round(clamp(H / 3 * rng.f(0.6, 1.5), 5, 26)), shanty: true });
          else { const home = !ctx.homeDone && dense && lot.w > 8 && Math.hypot(b.x, b.z - 1750) < 520; if (home) ctx.homeDone = true; shopHouse(ctx, rng, lot, S, { floors: home ? 5 : Math.round(clamp((H / 3.2) * rng.f(0.3, 1.1), 1, 9)), shanty: true, shutter: 0.22, ...(home ? { enter: true, kind: 'home', home: true } : {}) }); }
        }
        break;
      }
      case 'oldq': {
        if (b.w > 90 && b.noise2 > 0.7 && rng.chance(0.3)) { const [lot] = subdivide(b, rng, { mode: 'mega', wmin: 999 }); archiveSpire(ctx, rng, lot, S, { h: 160 + 380 * b.noise }); break; }
        for (const lot of sub(b, rng, { mode: 'perimeter', wmin: 11, wmax: 24, alley: 5, minDepth: 11 })) guildHouse(ctx, rng, lot, S, { floors: Math.round(clamp((H / 3.4) * rng.f(0.6, 1.3), 2, 9)) });
        break;
      }
      case 'lumina': {
        if (b.noise > 0.6 && rng.chance(0.45)) { const [lot] = subdivide(b, rng, { mode: 'mega', wmin: 999 }); terrace(ctx, rng, lot, S, { h: clamp(H * 1.3, 60, 320), mega: true }); break; }
        for (const lot of sub(b, rng, { mode: 'perimeter', wmin: 16, wmax: 40, alley: 4, minDepth: 16 })) {
          const k = rng.next(); const hh = clamp(H * rng.f(0.5, 1.4), 18, 300);
          if (k < 0.4) terrace(ctx, rng, lot, S, { h: Math.min(hh, 110) }); else if (k < 0.75 && lot.w > 22) techTower(ctx, rng, lot, S, { h: hh, brand: rng.chance(0.3) ? 'lumina' : null }); else shopHouse(ctx, rng, lot, S, { floors: Math.round(clamp(hh / 3.6, 3, 9)), gh: 4.6 });
        }
        break;
      }
      case 'meridian': {
        if ((b.noise > 0.5 || prime) && b.w > 100 && rng.chance(0.6)) { const [lot] = subdivide(b, rng, { mode: 'mega', wmin: 999 }); megaTower(ctx, rng, lot, S, { h: clamp(H * rng.f(0.9, 1.5), 260, 880), brand: rng.chance(0.6) ? 'meridian' : rng.pick(['helion', 'aether', 'archive']) }); break; }
        for (const lot of sub(b, rng, { mode: 'perimeter', wmin: 38, wmax: 72, alley: 8, minDepth: 30 })) techTower(ctx, rng, lot, S, { h: clamp(H * rng.f(0.45, 1.1), 60, 520), brand: rng.chance(0.4) ? rng.pick(['meridian', 'helion', 'aether']) : null });
        break;
      }
      case 'hive': {
        if (b.w > 150 && rng.chance(0.75)) { const [lot] = subdivide(b, rng, { mode: 'mega', wmin: 999 }); capsuleBlock(ctx, rng, lot, S, { h: clamp(H * rng.f(0.8, 1.3), 180, 620) }); break; }
        for (const lot of sub(b, rng, { mode: 'perimeter', wmin: 26, wmax: 60, alley: 8, minDepth: 20 })) tenement(ctx, rng, lot, S, { floors: Math.round(clamp(H / 3 * rng.f(0.15, 0.4), 8, 40)) });
        break;
      }
      case 'verdant': { const [lot] = subdivide(b, rng, { mode: 'mega', wmin: 999 }); farmTower(ctx, rng, lot, S, { h: clamp(H * rng.f(0.7, 1.4), 60, 420) }); break; }
      case 'foundry': { const [lot] = subdivide(b, rng, { mode: 'mega', wmin: 999 }); factory(ctx, rng, lot, S, { h: H }); break; }
      case 'port': { const [lot] = subdivide(b, rng, { mode: 'mega', wmin: 999 }); depot(ctx, rng, lot, S, { h: H }); break; }
    }
    const t = tally[b.district] || (tally[b.district] = { blocks: 0, bld: 0, verts: 0 }); t.blocks++; t.bld += ctx.stats.buildings - b0; t.verts += countV() - v0;
  }
  gantries(ctx, rng0.fork('gantry'));
  console.log('[NS] tally ' + Object.entries(tally).map(([k, t]) => `${k}: ${t.blocks}blk ${t.bld}bld ${(t.verts / 1e6).toFixed(2)}Mv`).join(' | '));
}
