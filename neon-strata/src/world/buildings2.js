// District-specific landmark recipes: capsule megablocks, entertainment terraces, guild houses,
// archive spires, foundry plants, port depots, farm towers and plazas.
import { ST, PAL, WK, FLAG } from '../render/cityMaterial.js';
import { M, rectPts, scalePts, ngonPts } from './builder.js';
import * as K from './kit.js';
import { Vol, facade, blindWall, shopSign, bladeSign, screenWall, FACE_ANG } from './facade.js';
import { wallMat, roofProps, landingPad, haloRing, crownSpire, liftTube, ROOF_LOW, ROOF_TECH } from './buildings.js';

const dim = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
const done = (ctx, lot, w, d, h, cz = 0) => { ctx.shade(lot.x, lot.z, Math.max(w, d) * 0.75 + h * 0.25, Math.min(0.8, h / 260 + 0.22)); ctx.footprint(0, cz, w, d, 0, h, lot.block.id); ctx.stats.buildings++; lot.h = h; return h; };
let uo = 5; const nextU = () => (uo = (uo * 41 + 13) % 863);

// ---------------------------------------------------------------------------------------------
// HIVE: twin megaframe slabs filled with plug-in capsules, sky streets, bridges, courtyard market
export function capsuleBlock(ctx, rng, lot, S, o = {}) {
  const W = lot.w - 4, Dp = lot.d - 4; const T = Math.min(48, Dp * 0.27); const zc = Dp / 2 - T / 2; const fh = 2.9; const acc = rng.pick(S.accents);
  const frameM = M(ST.CONCRETE, { color: [0.36, 0.35, 0.34], seed: rng.i(0, 255) }); const paint = M(ST.PLASTER, { color: dim(acc, 0.55), seed: rng.i(0, 255) });
  const cs = Math.cos(lot.yaw), sn = Math.sin(lot.yaw); const tops = [];
  for (const side of [1, -1]) {
    const H = Math.round((o.h * (side > 0 ? 1 : rng.f(0.6, 1.05))) / (fh * 9)) * fh * 9 + 9;
    const wx = lot.x + (side * zc) * sn, wz = lot.z + (side * zc) * cs;
    const pen = ctx.penAt(wx, 0.2, wz, lot.yaw + (side > 0 ? 0 : Math.PI));
    const v = new Vol(ctx, 0, 0, W, T, 0, H);
    // arcade of shops at the street
    const ns = Math.max(2, Math.round(W / 9)); const sw = W / ns;
    for (let i = 0; i < ns; i++) {
      ctx.main(); v.box(0, i * sw, i * sw + 0.6, 0, 0.3, 0, 9, frameM, { top: false });
      const u = nextU(); pen.use(M(ST.WIN_LUX, { color: [0.2, 0.2, 0.22], seed: rng.i(0, 255), A: 0.95, B: rng.pick([PAL.WARM, PAL.NEUTRAL, PAL.MIXED]), cellW: (sw - 0.6) / 2, floorH: 4.2, flags: WK.CONCRETE })); v.wall(0, i * sw + 0.6, (i + 1) * sw, 0, 0, 4.2, { uv: [u, 0, u + 2, 1], aoB: 0.55 });
      pen.use(frameM); v.wall(0, i * sw + 0.6, (i + 1) * sw, 0, 4.2, 9);
      shopSign(v, 0, i * sw + 0.7, (i + 1) * sw - 0.1, 5.2, rng, { maxH: 1.5, maxW: 8, intensity: S.signI });
      if (rng.chance(0.5)) shopSign(v, 0, i * sw + 0.7, (i + 1) * sw - 0.1, 7.4, rng, { maxH: 1.2, maxW: 6.5, intensity: S.signI });
      if (i % 2 === 0) { const lp = v.world(0, (i + 0.5) * sw, 3); ctx.light(lp[0], lp[1], 14, [1, 0.8, 0.55], 0.5, 3); }
    }
    ctx.main(); v.box(0, 0, W, 0, 2.2, 9, 9.5, frameM);
    // megaframe + capsule infill
    const capM = wallMat(rng, S, { st: ST.WIN_CAPSULE, cellW: 2.7, floorH: fh, wk: rng.pick([WK.PLASTER, WK.CONCRETE, WK.COMPOSITE]) });
    const cells = Math.round(W / 2.7); const bayCells = Math.max(6, Math.round(26 / (W / cells)));
    const pat = []; for (let i = 0; i < 40; i++) pat.push(rng.weighted([[5, 0], [2, 0.9], [2, -0.9], [1, 1.6]]));
    for (const f of [0, 2]) {
      const info = facade(v, f, 9.5, H, { wall: capM, cellW: 2.7, bayCells: f === 0 ? 2 : bayCells, floorH: fh, jamb: K.conc(0.24), depth: f === 0 ? (b) => pat[b % 40] : null, aoB: 0.85 });
      // megacolumns + megabeams (with accent-painted beams = sky streets)
      ctx.main(); const L = v.len(f); const nc = Math.max(2, Math.round(L / 27));
      for (let i = 0; i <= nc; i++) { const s = Math.min(L - 1.4, Math.max(1.4, (i / nc) * L)); v.box(f, s - 1.4, s + 1.4, 0, 2.6, 0, H + 3, frameM, { bottom: false }); }
      for (let y = 9.5 + fh * 9; y < H - 2; y += fh * 9) { v.box(f, 0, L, 0, 2.6, y - 1.3, y + 1.3, (Math.round(y / (fh * 9)) % 2) ? paint : frameM); const e = K.emis(acc, 4, 0, true); e.flags |= 8; pen.use(e); v.box(f, 1, L - 1, 2.6, 2.72, y + 0.2, y + 0.5, null, { ends: false, top: false, bottom: false }); }
      // extra pulled-out capsule clusters
      if (f === 0 && info) for (let i = 0; i < Math.round(L / 16); i++) { const c0 = rng.i(1, info.cells - 3), fl = rng.i(1, info.floors - 3); const s0 = c0 * info.cw, y0 = 9.5 + fl * info.floorH; const wC = rng.pick([1, 2]), hC = rng.pick([1, 1, 2]); const u = nextU(); ctx.detail(); v.box(0, s0, s0 + wC * info.cw, 1.7, 3.1, y0, y0 + hC * info.floorH, { ...capM, color: dim(rng.pick(S.walls), 1.1), seed: rng.i(0, 255) }, { uv: [u, 0, u + wC, hC], endMat: K.conc(0.3), botMat: K.dark(0.08) }); }
    }
    for (const f of [1, 3]) { blindWall(v, f, 0, H, frameM, rng, { aoB: 0.55 }); const keys = Object.keys(ctx.atlas.decal); const p = v.P(f, T / 2, 0.08); ctx.detail(); pen.sign(p[0], H - 26, p[1], FACE_ANG[f], Math.min(T * 0.6, 22), Math.min(T * 0.6, 22), ctx.atlas.decal[keys[(lot.block.id + f) % 4]], { intensity: 1.2, seed: 3 }); pen.use(K.emis(acc, 5, 3, true, rng.i(0, 255))); const q = v.P(f, T / 2, 0.15); pen.beam(q[0], 20, q[1], q[0], H - 44, q[1], 0.5, 0.2); ctx.main(); }
    v.roof(K.conc(0.25)); v.solid();
    roofProps(ctx, rng, 0, 0, W, T, H, [[4, ['solar', [1, 1.2]]], [3, ['tank', [0.9, 1.2]]], [2, ['chiller', [1, 1.3]]], [2, ['shack', [1, 1.1]]], [1, ['mast', [0.8, 1.2]]], [1, ['cooler', [0.9, 1.1]]]], 1.1, 5.4);
    for (let y = 60; y < H; y += 90) ctx.spark(pen.wx(0, T / 2), 0.2 + y, pen.wz(0, T / 2), [1, 0.7, 0.4], 7, 1.1);
    ctx.footprint(0, 0, W, T, 0, H, lot.block.id); ctx.stats.buildings++; tops.push(H);
    if (rng.chance(0.6)) landingPad(v, 0, W * rng.f(0.2, 0.8), 9.5 + fh * 9 * rng.i(2, Math.max(2, Math.floor(H / (fh * 9)) - 1)) + 1.3, 12, rng, { color: acc });
  }
  // bridges across the courtyard at sky-street levels
  const Hm = Math.min(tops[0], tops[1]);
  for (let i = 0; i < 3; i++) { const y = 9.5 + fh * 9 * rng.i(1, Math.max(1, Math.floor(Hm / (fh * 9)) - 1)) + 1.4; const lx = (rng.f(-0.35, 0.35)) * W; const a = [lot.x + lx * cs + (zc - T / 2) * sn, lot.z - lx * sn + (zc - T / 2) * cs], b = [lot.x + lx * cs - (zc - T / 2) * sn, lot.z - lx * sn - (zc - T / 2) * cs]; K.skybridge(ctx, a[0], 0.2 + y, a[1], b[0], 0.2 + y, b[1], 6, 3.4, { neon: acc, pal: PAL.WARM }); }
  // courtyard market hall + trees
  const pen = ctx.penAt(lot.x, 0.2, lot.z, lot.yaw); const cw = W * 0.5, cd = Math.max(8, (zc - T / 2) * 2 - 16);
  if (cd > 10) { const hall = new Vol(ctx, 0, 0, cw, cd, 0, 7); for (const f of [0, 1, 2, 3]) facade(hall, f, 0, 7, { wall: M(ST.WIN_LUX, { color: [0.22, 0.22, 0.24], seed: rng.i(0, 255), A: 0.95, B: PAL.WARM, cellW: 4, floorH: 7, flags: WK.CONCRETE }), cellW: 4, bayCells: 2, floorH: 7, ribs: { d: 0.4, w: 0.5, mat: frameM }, aoB: 0.55 }); hall.roof(M(ST.CORRUGATED, { color: [0.3, 0.32, 0.33] })); hall.solid(); roofProps(ctx, rng, 0, 0, cw, cd, 7, ROOF_LOW, 0.8); ctx.light(lot.x, lot.z, cw * 0.8, [1, 0.75, 0.5], 0.7, 5); }
  for (let i = 0; i < 10; i++) { const lx = rng.f(-0.46, 0.46) * W, lz = rng.sign() * (cd / 2 + rng.f(3, 6)); if (Math.abs(lz) > zc - T / 2 - 2) continue; ctx.propL(rng.pick(['tree', 'bench', 'planter', 'vending']), lx, 0, lz, rng.f(0, 6.28), rng.f(0.8, 1.2)); }
  ctx.shade(lot.x, lot.z, Math.max(W, Dp) * 0.7 + 100, 0.8); lot.h = Math.max(tops[0], tops[1]);
  ctx.poi({ type: 'megablock', x: lot.x, y: 0.2, z: lot.z, h: lot.h });
  return lot.h;
}

// ---------------------------------------------------------------------------------------------
// LUMINA: stepped entertainment terraces wrapped in screens, neon and stacked signage
export function terrace(ctx, rng, lot, S, o = {}) {
  const pen = ctx.penAt(lot.x, 0.2, lot.z, lot.yaw);
  const side = lot.corner || o.mega ? 0.8 : 0.12; const w = lot.w - side * 2, back = 1.0, d = lot.d - back, cz = back / 2; const acc = rng.pick(S.accents), acc2 = rng.pick(S.accents);
  const H = o.h ?? 60; const n = Math.max(2, Math.min(5, Math.round(H / 22))); const gh = 5.2; let y = 0; let cw = w, cd = d, zOff = 0;
  const base = new Vol(ctx, 0, cz, w, d, 0, gh);
  const ns = Math.max(1, Math.round(w / 8)); const sw = (w - 0.4) / ns;
  for (let i = 0; i < ns; i++) { // glazed foyer / shop bays with a marquee
    ctx.main(); base.box(0, i * sw, i * sw + 0.4, 0, 0.2, 0, gh, K.dark(0.1), { top: false }); const u = nextU();
    pen.use(M(ST.WIN_LUX, { color: [0.18, 0.16, 0.2], seed: rng.i(0, 255), A: 1, B: rng.pick(S.lights), cellW: (sw - 0.4) / 2, floorH: gh - 0.8, flags: WK.COMPOSITE })); base.wall(0, i * sw + 0.4, (i + 1) * sw, 0, 0, gh - 0.8, { uv: [u, 0, u + 2, 1], aoB: 0.55 });
    pen.use(K.dark(0.08)); base.wall(0, i * sw + 0.4, (i + 1) * sw, 0, gh - 0.8, gh);
    shopSign(base, 0, i * sw + 0.5, (i + 1) * sw - 0.1, gh + 0.55, rng, { maxH: 1.5, maxW: 7.5, intensity: S.signI });
  }
  ctx.main(); base.box(0, w - 0.4, w, 0, 0.2, 0, gh, K.dark(0.1), { top: false });
  { const e = K.emis(acc, 7, 1, false, rng.i(0, 255)); e.flags |= 8; ctx.detail(); base.box(0, 0.3, w - 0.3, 0, 1.8, gh - 0.95, gh - 0.8, K.dark(0.08)); pen.use(e); base.box(0, 0.3, w - 0.3, 1.8, 1.9, gh - 0.95, gh - 0.8, null, { ends: false, top: false, bottom: false }); ctx.main(); const lp = base.world(0, w / 2, 3); ctx.light(lp[0], lp[1], Math.max(14, w), acc, 0.8, 4); }
  for (const f of [1, 3]) blindWall(base, f, 0, gh, K.dark(0.12), rng, {}); blindWall(base, 2, 0, gh, K.conc(0.3), rng, {});
  y = gh; const tiers = [];
  for (let i = 0; i < n; i++) {
    const th = Math.round(((H - gh) / n) * rng.f(0.8, 1.2) / 3.6) * 3.6;
    const v = new Vol(ctx, 0, cz + zOff, cw, cd, y, y + th);
    const wm = wallMat(rng, S, { st: rng.pick([ST.WIN_LUX, ST.WIN_RES, ST.WIN_RIBBON]), floorH: 3.6, cellW: 3.2, lit: rng.f(0.5, 0.9) });
    const kind = rng.next();
    if (kind < 0.45 && cw > 12) { // screen centre flanked by glazing
      const sW = cw * rng.f(0.45, 0.7); facade(v, 0, y, y + th, { wall: wm, bayCells: 2, floorH: 3.6, aoB: 0.9 }); screenWall(v, 0, cw / 2 - sW / 2, cw / 2 + sW / 2, y + 1.2, y + th - 1.2, rng, { intensity: 3, color: acc });
    } else facade(v, 0, y, y + th, { wall: wm, bayCells: 2, floorH: 3.6, aoB: 0.9, ribs: { d: 0.35, w: 0.3, mat: K.dark(0.1), detail: true }, depth: (b, nb) => (b % 3 === 1 ? 0.7 : 0) });
    for (const f of [1, 3]) { if (lot.corner || o.mega || i > 0) facade(v, f, y, y + th, { wall: wm, bayCells: 99, floorH: 3.6 }); else blindWall(v, f, y, y + th, M(ST.PLASTER, { color: dim(wm.color, 0.8), seed: wm.seed }), rng, { mural: rng.chance(0.3) }); }
    facade(v, 2, y, y + th, { wall: wm, bayCells: 99, floorH: 3.6 });
    v.roof(M(ST.TILE, { color: [0.24, 0.24, 0.27] })); v.solid(); tiers.push(v);
    K.neonBand(ctx, 0, cz + zOff, cw, cd, y + th - 0.3, i % 2 ? acc : acc2, { intensity: 8, radius: 26, power: 0.5, nightOnly: true, sides: lot.corner || o.mega ? 15 : 1, h: 0.25, t: 0.2 });
    if (rng.chance(0.6)) shopSign(v, 0, 1, cw * 0.45, y + 1.9, rng, { maxH: 1.6, maxW: 9, intensity: S.signI });
    if (rng.chance(0.6)) { const hgt = Math.min(th * 0.8, 9); bladeSign(v, 0, cw - 0.7, y + th / 2, hgt, rng, { intensity: S.signI, radius: 24, power: 0.7 }); }
    y += th;
    const step = rng.f(2.5, Math.min(6, cd * 0.16)); const sx = lot.corner || o.mega ? rng.f(1.5, 4) : rng.f(0, 1.5);
    if (i < n - 1) { ctx.detail(); pen.use(K.dark(0.1)); const p0 = v.P(0, 0.2, -0.15), p1 = v.P(0, cw - 0.2, -0.15); pen.beam(p0[0], y + 1.05, p0[1], p1[0], y + 1.05, p1[1], 0.06, 0.06); ctx.main(); if (rng.chance(0.5)) for (let k = 0; k < Math.floor(cw / 7); k++) ctx.propL(rng.pick(['planter', 'bench', 'kiosk']), -cw / 2 + 3 + k * 7, y, cz + zOff + cd / 2 - step * 0.5, Math.PI, 0.8); }
    cw -= sx * 2; cd -= step; zOff -= step / 2;
    if (cw < 8 || cd < 8) break;
  }
  const top = tiers[tiers.length - 1];
  const ck = rng.next();
  if (ck < 0.4) { const rect = ctx.atlas.pickBB(rng); const bw = Math.min(top.w * 0.9, 26); K.billboard(ctx, rng, 0, y, top.cz + top.d / 2 - 1.2, 0, bw, { rect, lift: 2.5, intensity: 5, lightColor: rect.glow }); }
  else if (ck < 0.7) { const r = Math.min(top.w, top.d) * 0.38; ctx.main(); pen.use(M(ST.DARKGLASS, { color: dim(acc, 0.9) })); const prof = []; for (let k = 0; k <= 5; k++) { const a = (k / 5) * Math.PI / 2; prof.push([Math.max(0.3, Math.cos(a) * r), y + Math.sin(a) * r * 0.8]); } pen.lathe(top.cx, top.cz, prof, 14, { cap: false }); pen.use(K.emis(acc, 7, 3, true, rng.i(0, 255))); for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2; pen.beam(top.cx + Math.cos(a) * r, y, top.cz + Math.sin(a) * r, top.cx + Math.cos(a) * r * 0.3, y + r * 0.76, top.cz + Math.sin(a) * r * 0.3, 0.25, 0.25); } ctx.spark(pen.wx(top.cx, top.cz), 0.2 + y + r * 0.5, pen.wz(top.cx, top.cz), acc, 7, 2); }
  else { haloRing(top, y - 2, rng, acc, 0.6); roofProps(ctx, rng, top.cx, top.cz, top.w, top.d, y, ROOF_TECH, 0.8); }
  // sky beam from show venues
  if (o.mega) ctx.glow.cone(pen.wx(top.cx, top.cz), 0.2 + y + 3, pen.wz(top.cx, top.cz), rng.f(-0.25, 0.25), 0.94, rng.f(-0.25, 0.25), 520, 1.2, 14, acc, 0.035, { segs: 10, seed: rng.i(0, 50) });
  return done(ctx, lot, w, d, y, cz);
}

// ---------------------------------------------------------------------------------------------
// OLD QUARTER: gabled stone guild houses, retrofitted with conduits
function gableRoof(v, y, rh, roofM, wallM, front) {
  const pen = v.pen; const { cx, cz, w, d } = v; const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2; const ov = 0.35;
  pen.use(roofM);
  if (front) { // ridge runs front-back, triangular gable faces the street
    pen.quad(x0 - ov, y, z1 + ov, cx, y + rh, z1 + ov, cx, y + rh, z0 - ov, x0 - ov, y, z0 - ov, 0, 0, d, rh * 1.4);
    pen.quad(cx, y + rh, z1 + ov, x1 + ov, y, z1 + ov, x1 + ov, y, z0 - ov, cx, y + rh, z0 - ov, 0, 0, d, rh * 1.4);
    pen.use(wallM); pen.quad(x0, y, z1, x1, y, z1, cx, y + rh, z1, cx, y + rh, z1, 0, y, w, y + rh); pen.quad(x1, y, z0, x0, y, z0, cx, y + rh, z0, cx, y + rh, z0, 0, y, w, y + rh);
  } else {
    pen.quad(x0 - ov, y, z1 + ov, x1 + ov, y, z1 + ov, x1 + ov, y + rh, cz, x0 - ov, y + rh, cz, 0, 0, w, rh * 1.4);
    pen.quad(x1 + ov, y, z0 - ov, x0 - ov, y, z0 - ov, x0 - ov, y + rh, cz, x1 + ov, y + rh, cz, 0, 0, w, rh * 1.4);
    pen.use(wallM); pen.quad(x1, y, z1, x1, y, z0, x1, y + rh, cz, x1, y + rh, cz, 0, y, d, y + rh); pen.quad(x0, y, z0, x0, y, z1, x0, y + rh, cz, x0, y + rh, cz, 0, y, d, y + rh);
  }
}
export function guildHouse(ctx, rng, lot, S, o = {}) {
  const pen = ctx.penAt(lot.x, 0.2, lot.z, lot.yaw);
  const w = lot.w - 0.24, back = 0.5, d = lot.d - back, cz = back / 2; const fh = S.floorH, gh = 4.4, floors = Math.max(1, o.floors ?? 3), h = gh + floors * fh;
  const v = new Vol(ctx, 0, cz, w, d, 0, h); const acc = rng.pick(S.accents);
  const tone = rng.pick(S.walls); const stone = M(ST.STONE, { color: dim(tone, 0.9), seed: rng.i(0, 255) });
  const wall = wallMat(rng, S, { st: rng.chance(0.3) ? ST.WIN_SLIT : ST.WIN_RES, color: tone, cellW: w / Math.max(2, Math.round(w / 2.8)), wk: rng.pick([WK.STONE, WK.STONE, WK.PLASTER]) });
  // arcaded ground floor
  const nb = Math.max(1, Math.round(w / 4.2)); const bw = w / nb;
  for (let i = 0; i < nb; i++) {
    ctx.main(); v.box(0, i * bw, i * bw + 0.55, 0, 0.3, 0, gh, stone, { top: false }); const u = nextU();
    const shop = rng.chance(0.6);
    pen.use(shop ? M(ST.WIN_LUX, { color: [0.2, 0.18, 0.16], seed: rng.i(0, 255), A: 0.9, B: rng.pick([PAL.WARM, PAL.GOLD, PAL.AMBER]), cellW: bw - 0.55, floorH: gh - 1.0, flags: WK.STONE }) : K.dark(0.07));
    v.wall(0, i * bw + 0.55, (i + 1) * bw, -0.0, 0, gh - 1.0, { uv: [u, 0, u + 1, 1], aoB: 0.5 });
    pen.use(stone); v.wall(0, i * bw + 0.55, (i + 1) * bw, 0, gh - 1.0, gh);
    if (shop && rng.chance(0.55)) shopSign(v, 0, i * bw + 0.6, (i + 1) * bw - 0.05, gh - 0.45, rng, { maxH: 0.8, maxW: bw - 1, intensity: S.signI, out: 0.34 });
    if (shop) { const lp = v.world(0, (i + 0.5) * bw, 2); ctx.light(lp[0], lp[1], 7, [1, 0.72, 0.42], 0.4, 2.2); }
  }
  ctx.main(); v.box(0, w - 0.3, w, 0, 0.3, 0, gh, stone, { top: false }); v.box(0, 0, w, 0, 0.42, gh - 0.2, gh + 0.25, stone);
  facade(v, 0, gh, h, { wall, bayCells: 1, floorH: fh, aoB: 0.9, belts: { every: 1, d: 0.2, h: 0.28, mat: stone, detail: floors > 4 }, ribs: rng.chance(0.4) ? { d: 0.3, w: 0.5, mat: stone, every: 99 } : null });
  facade(v, 2, 0, h, { wall, bayCells: 999, floorH: fh, aoB: 0.6 });
  const party = M(ST.STONE, { color: dim(tone, 0.8), seed: wall.seed });
  blindWall(v, 1, 0, h, party, rng, { aoB: 0.6 }); blindWall(v, 3, 0, h, party, rng, { aoB: 0.6 });
  // roof: steep gable (front or side) with chimney + lantern
  const front = rng.chance(0.5) && w < 14; const rh = (front ? w : d) * rng.f(0.32, 0.5);
  ctx.main(); v.box(0, 0, w, 0, 0.35, h - 0.3, h + 0.1, stone);
  gableRoof(v, h, rh, M(ST.STONE, { color: [0.2, 0.2, 0.23], seed: rng.i(0, 255) }), wall.st === ST.WIN_SLIT ? party : party, front);
  v.solid(); ctx.solid(0, cz, w * 0.6, d * 0.6, h, h + rh * 0.6);
  ctx.detail(); pen.use(stone); const chx = rng.f(-0.3, 0.3) * w; pen.box(chx, cz + rng.f(-0.2, 0.2) * d, 1.0, 1.0, h + rh * 0.35, h + rh + 1.2, {});
  // techno retrofit: glowing data conduit up the front, lantern by the door
  if (rng.chance(0.55)) { pen.use(K.emis(acc, 4, 3, true, rng.i(0, 255))); const s = rng.pick([0.28, w - 0.28]); v.box(0, s - 0.05, s + 0.05, 0.3, 0.36, 0.4, h - 0.5, null, { ends: false, top: false, bottom: false }); }
  { const p = v.P(0, rng.f(0.2, 0.8) * w, 0.5); pen.use(K.MAT_POLE); pen.beam(p[0], 3.3, p[1] - 0.5, p[0], 3.3, p[1], 0.05, 0.05); pen.use(K.emis([1, 0.62, 0.25], 9, 1, false, rng.i(0, 255))); pen.lathe(p[0], p[1], [[0.02, 3.3], [0.14, 3.15], [0.14, 2.85], [0.02, 2.75]], 6, { cap: false }); const lp = [pen.wx(p[0], p[1] + 1.5), pen.wz(p[0], p[1] + 1.5)]; ctx.light(lp[0], lp[1], 9, [1, 0.62, 0.25], 0.7, 3); }
  ctx.main();
  if (floors >= 2 && rng.chance(S.blade)) bladeSign(v, 0, 0.6, gh + fh * 0.9, Math.min(3.6, fh * 1.1), rng, { intensity: S.signI });
  if (rng.chance(0.3)) ctx.propL('dish', rng.f(-0.3, 0.3) * w, h + rh * 0.3, cz - d * 0.3, rng.f(0, 6.28), 0.8);
  return done(ctx, lot, w, d, h + rh, cz);
}

// OLD QUARTER landmark: tapering archive monolith with buttresses, slit windows and a lantern crown
export function archiveSpire(ctx, rng, lot, S, o = {}) {
  const pen = ctx.penAt(lot.x, 0.2, lot.z, lot.yaw); const acc = K.NEON.violet;
  const W = Math.min(lot.w, lot.d, 84) - 10; const H = o.h ?? 300;
  const stone = M(ST.STONE, { color: [0.44, 0.42, 0.4], seed: rng.i(0, 255) }); const wall = M(ST.WIN_SLIT, { color: [0.42, 0.4, 0.39], seed: rng.i(0, 255), A: 0.5, B: PAL.VIOLET, cellW: 2.6, floorH: 5, flags: WK.STONE });
  // stepped plinth
  for (let i = 0; i < 3; i++) { const s = W + 22 - i * 7; pen.box(0, 0, s, s, i * 1.2, (i + 1) * 1.2, { wall: stone, roof: M(ST.PAVE, { color: [0.4, 0.38, 0.36] }), aoB: 0.6 }); ctx.solid(0, 0, s, s, i * 1.2, (i + 1) * 1.2); }
  const y0 = 3.6; const ch = W * 0.16; const rings = []; const segs = 5;
  for (let i = 0; i <= segs; i++) { const t = i / segs; const s = 1 - 0.5 * t - 0.08 * Math.sin(t * Math.PI); rings.push({ y: y0 + Math.round((H * t) / 5) * 5, pts: scalePts(rectPts(W, W, 0, 0, ch), s) }); }
  ctx.main(); pen.use(wall); pen.loft(rings, { roof: stone, aoB: 0.55 });
  for (let i = 0; i < segs; i++) { const s = 1 - 0.5 * ((i + 0.5) / segs); ctx.solid(0, 0, W * s, W * s, rings[i].y, rings[i + 1].y); }
  // buttresses on the four faces + violet data veins on the chamfers
  pen.use(stone);
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (const off of [-0.22, 0.22]) {
    const ox = dz * off * W, oz = dx * off * W; const bx = dx * W / 2, bz = dz * W / 2; const t = 3.2;
    const a = [bx + ox - dz * t, bz + oz - dx * t], b = [bx + ox + dz * t, bz + oz + dx * t]; const out = W * 0.34;
    const pts0 = [[a[0], a[1]], [a[0] + dx * out, a[1] + dz * out], [b[0] + dx * out, b[1] + dz * out], [b[0], b[1]]];
    const pts1 = [[a[0], a[1]], [a[0] + dx * 0.5, a[1] + dz * 0.5], [b[0] + dx * 0.5, b[1] + dz * 0.5], [b[0], b[1]]];
    const fix = (p) => { let ar = 0; for (let i = 0; i < 4; i++) { const q = p[i], r = p[(i + 1) % 4]; ar += q[0] * r[1] - r[0] * q[1]; } return ar > 0 ? [p[3], p[2], p[1], p[0]] : p; };
    pen.loft([{ y: y0, pts: fix(pts0) }, { y: y0 + H * 0.34, pts: fix(pts1).map(([x, z]) => [x * (1 - 0.17), z * (1 - 0.17)]) }], { cap: false, aoB: 0.5 });
  }
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { const e = K.emis(acc, 6, 3, true, rng.i(0, 255)); pen.use(e); const p0 = (W / 2 - ch / 2) * 1.0 + 0.3, p1 = (W / 2 - ch / 2) * 0.5 + 0.3; pen.beam(sx * p0, y0 + 6, sz * p0, sx * p1, y0 + H - 4, sz * p1, 0.7, 0.7); }
  // lantern crown
  const top = new Vol(ctx, 0, 0, W * 0.5, W * 0.5, y0 + H, y0 + H);
  const lr = W * 0.2; pen.use(K.emis(acc, 9, 3, false, rng.i(0, 255))); pen.lathe(0, 0, [[lr, y0 + H + 2], [lr * 1.1, y0 + H + 10], [lr * 0.6, y0 + H + 18]], 10, { cap: false });
  pen.use(stone); pen.lathe(0, 0, [[lr * 1.3, y0 + H], [lr * 1.3, y0 + H + 2]], 10, {}); pen.lathe(0, 0, [[lr * 0.7, y0 + H + 18], [lr * 0.2, y0 + H + 34], [0.3, y0 + H + 60]], 8, { cap: false });
  haloRing(top, y0 + H - 14, rng, acc, 0.75);
  ctx.glow.cone(pen.wx(0, 0), 0.2 + y0 + H + 20, pen.wz(0, 0), 0, 1, 0, 600, 3, 20, acc, 0.26, { segs: 10 });
  ctx.light(lot.x, lot.z, W * 2.2, acc, 0.9, 30); ctx.spark(lot.x, 0.2 + y0 + H + 10, lot.z, acc, 10, 3);
  if (ctx.atlas.corp.archive) { const lg = ctx.atlas.corp.archive.logo; for (const f of [0, 2]) { ctx.detail(); pen.sign(0, y0 + 26, (f === 0 ? 1 : -1) * (W / 2 * 0.93 + 0.4), FACE_ANG[f], 14, 14, lg, { intensity: 4, seed: 1 }); ctx.main(); } }
  // braziers + forecourt furniture
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { const bx = sx * (W / 2 + 8), bz = sz * (W / 2 + 8); pen.use(stone); pen.lathe(bx, bz, [[0.9, 3.6], [0.5, 4.2], [0.5, 6.2], [1.1, 6.8]], 8, {}); pen.use(K.emis([1, 0.5, 0.12], 12, 1, false, rng.i(0, 255))); pen.lathe(bx, bz, [[0.9, 6.8], [0.5, 7.6], [0.05, 8.6]], 6, { cap: false }); ctx.light(pen.wx(bx, bz), pen.wz(bx, bz), 20, [1, 0.5, 0.12], 0.9, 8); ctx.steam.push({ x: pen.wx(bx, bz), y: 9, z: pen.wz(bx, bz), s: 0.5, fire: 1 }); }
  ctx.shade(lot.x, lot.z, W * 1.2 + 60, 0.75); ctx.footprint(0, 0, W + 22, W + 22, 0, H, lot.block.id); ctx.stats.buildings++; lot.h = H;
  ctx.poi({ type: 'archive', x: lot.x, y: 0.2, z: lot.z, h: H });
  return H;
}

// ---------------------------------------------------------------------------------------------
// FOUNDRY: plant = furnace hall with sawtooth roof, stacks with flares, cooling tower, tank farm, pipe racks
export function factory(ctx, rng, lot, S, o = {}) {
  const pen = ctx.penAt(lot.x, 0.2, lot.z, lot.yaw); const W = lot.w - 6, Dp = lot.d - 6; const acc = rng.pick(S.accents);
  const hw = W * rng.f(0.5, 0.62), hd = Dp * rng.f(0.42, 0.55), hh = Math.round((o.h * rng.f(0.7, 1.1)) / 5) * 5; const hx = -W / 2 + hw / 2 + 2, hz = Dp / 2 - hd / 2 - 2;
  const hall = new Vol(ctx, hx, hz, hw, hd, 0, hh);
  const wall = wallMat(rng, S, { st: ST.WIN_INDUSTRIAL, cellW: 4, floorH: 5, lit: rng.f(0.3, 0.6), wk: rng.pick([WK.RUST, WK.RIBBED, WK.CONCRETE]) });
  const steel = M(ST.RUST, { color: [0.34, 0.3, 0.27], seed: rng.i(0, 255) });
  for (const f of [0, 1, 2, 3]) facade(hall, f, 0, hh, { wall, cellW: 4, bayCells: 2, floorH: 5, aoB: 0.5, ribs: { d: 0.9, w: 0.8, mat: steel, over: 1.5 }, belts: { every: Math.max(2, Math.round(hh / 10)), d: 0.9, h: 0.7, mat: steel } });
  // furnace mouths: glowing openings along the front
  for (let i = 0; i < Math.round(hw / 22); i++) { const s = (i + 0.5) * (hw / Math.round(hw / 22)); ctx.main(); pen.use(K.emis([1, 0.32, 0.06], 9, 1, false, rng.i(0, 255))); hall.wall(0, s - 3, s + 3, 0.05, 0.3, 6); pen.use(steel); hall.box(0, s - 3.6, s - 3, 0, 0.9, 0, 7, null, { bottom: false }); hall.box(0, s + 3, s + 3.6, 0, 0.9, 0, 7, null, { bottom: false }); hall.box(0, s - 3.6, s + 3.6, 0, 0.9, 6, 7.2); const lp = hall.world(0, s, 6); ctx.light(lp[0], lp[1], 34, [1, 0.3, 0.06], 1.3, 4); }
  // sawtooth roof
  const nt = Math.max(2, Math.round(hw / 16)); const tw = hw / nt; const roofM = M(ST.CORRUGATED, { color: [0.3, 0.3, 0.31], seed: rng.i(0, 255) });
  for (let i = 0; i < nt; i++) { const x0 = hx - hw / 2 + i * tw, x1 = x0 + tw, z0 = hz - hd / 2, z1 = hz + hd / 2; pen.use(roofM); pen.quad(x0, hh, z1, x1, hh + 5.5, z1, x1, hh + 5.5, z0, x0, hh, z0, 0, 0, tw, hd); pen.use({ st: ST.WIN_INDUSTRIAL, color: [0.3, 0.3, 0.3], seed: i * 7, A: 0.7, B: PAL.AMBER, cellW: 4, floorH: 5.5, flags: WK.RIBBED }); pen.wall(x1, z1, x1, z0, hh, hh + 5.5, { uv: [i * 13, 0, i * 13 + Math.round(hd / 4), 1] }); pen.use(steel); pen.quad(x0, hh, z1, x1, hh, z1, x1, hh + 5.5, z1, x1, hh + 5.5, z1, 0, 0, tw, 5.5); pen.quad(x1, hh, z0, x0, hh, z0, x1, hh + 5.5, z0, x1, hh + 5.5, z0, 0, 0, tw, 5.5); }
  hall.solid(); ctx.solid(hx, hz, hw, hd, hh, hh + 3);
  // smokestacks with flares
  const nst = rng.i(1, 3);
  for (let i = 0; i < nst; i++) {
    const sx = hx - hw / 2 + (i + 0.6) * (hw / (nst + 0.4)), sz = hz - hd / 2 - 9; const SH = rng.f(120, 300), r0 = rng.f(5, 8);
    ctx.main(); pen.use(M(ST.CONCRETE, { color: [0.4, 0.38, 0.36], seed: rng.i(0, 255) })); pen.lathe(sx, sz, [[r0 * 1.5, 0], [r0, 14], [r0 * 0.72, SH * 0.6], [r0 * 0.62, SH]], 14, { cap: false, aoB: 0.5 });
    pen.use({ st: ST.METAL, color: [0.7, 0.5, 0.05], flags: 16 }); pen.lathe(sx, sz, [[r0 * 0.66, SH - 26], [r0 * 0.63, SH - 8]], 14, { cap: false });
    pen.use(steel); for (const y of [SH * 0.3, SH * 0.6, SH - 6]) pen.lathe(sx, sz, [[r0 + 0.6, y], [r0 + 1.4, y + 0.3], [r0 + 1.4, y + 1.2], [r0 * 0.7, y + 1.4]], 14, { cap: false });
    pen.use(K.emis(K.NEON.red, 20, 2, false, rng.i(0, 255))); for (const a of [0, 2.09, 4.19]) pen.box(sx + Math.cos(a) * (r0 * 0.64 + 0.3), sz + Math.sin(a) * (r0 * 0.64 + 0.3), 0.5, 0.5, SH - 1, SH - 0.4, {});
    const wx = pen.wx(sx, sz), wz = pen.wz(sx, sz);
    ctx.solidCyl(sx, sz, r0, 0, SH);
    if (rng.chance(0.65)) { pen.use(K.emis([1, 0.45, 0.08], 18, 1, false, rng.i(0, 255))); pen.lathe(sx, sz, [[r0 * 0.5, SH], [r0 * 0.75, SH + 6], [r0 * 0.4, SH + 15], [0.2, SH + 26]], 8, { cap: false }); ctx.glow.cone(wx, 0.2 + SH + 4, wz, 0, 1, 0, 60, r0 * 0.8, r0 * 3, [1, 0.4, 0.08], 0.9, { segs: 8 }); ctx.light(wx, wz, 150, [1, 0.38, 0.08], 1.1, SH); ctx.spark(wx, 0.2 + SH + 10, wz, [1, 0.45, 0.1], 12, 3.5); ctx.steam.push({ x: wx, y: SH + 22, z: wz, s: r0 * 0.9, fire: 1, big: 1 }); }
    else { ctx.steam.push({ x: wx, y: SH + 2, z: wz, s: r0 * 1.2, big: 1 }); ctx.spark(wx, 0.2 + SH, wz, K.NEON.red, 5, 2); }
  }
  // cooling tower
  if (W > 150 && rng.chance(0.75)) { const r = rng.f(22, 32), ch = r * rng.f(2.4, 3.2); const cx = W / 2 - r - 4, cz = -Dp / 2 + r + 4; ctx.main(); pen.use(M(ST.CONCRETE, { color: [0.42, 0.41, 0.4], seed: rng.i(0, 255) })); const prof = []; for (let i = 0; i <= 8; i++) { const t = i / 8; prof.push([r * (0.62 + 0.38 * Math.pow(Math.abs(t - 0.68) / 0.68, 1.7)), t * ch]); } pen.lathe(cx, cz, prof, 22, { cap: false, aoB: 0.5 }); pen.use(K.dark(0.05)); pen.lathe(cx, cz, [[prof[8][0] - 0.6, ch - 0.5], [0.5, ch - 4]], 22, { cap: false }); pen.use(steel); for (let i = 0; i < 22; i++) { const a = (i / 22) * 6.283; pen.beam(cx + Math.cos(a) * r * 1.06, 0, cz + Math.sin(a) * r * 1.06, cx + Math.cos(a + 0.14) * r * 0.99, 7, cz + Math.sin(a + 0.14) * r * 0.99, 0.5, 0.5); } ctx.solidCyl(cx, cz, r * 0.9, 0, ch); const wx = pen.wx(cx, cz), wz = pen.wz(cx, cz); ctx.steam.push({ x: wx, y: ch, z: wz, s: r * 0.8, big: 1 }); ctx.light(wx, wz, r * 2.4, K.NEON.sodium, 0.5, 20); ctx.footprint(cx, cz, r * 1.8, r * 1.8, 0, ch, lot.block.id); }
  // tank farm
  const tx0 = hx + hw / 2 + 14, nx = Math.floor((W / 2 - tx0 - 4) / 15), nz = Math.floor((Dp * 0.45) / 15);
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { const x = tx0 + i * 15 + 4, z = Dp / 2 - 9 - j * 15; const sph = (i + j) % 3 === 0; ctx.main(); pen.use(M(ST.RUST, { color: [0.44, 0.42, 0.4], seed: rng.i(0, 255) })); if (sph) { const r = 5.2; const prof = []; for (let k = 0; k <= 6; k++) { const a = -Math.PI / 2 + (k / 6) * Math.PI; prof.push([Math.max(0.05, Math.cos(a) * r), 7.5 + Math.sin(a) * r]); } pen.lathe(x, z, prof, 12, { cap: false }); pen.use(steel); for (const a of [0.78, 2.36, 3.93, 5.5]) pen.beam(x + Math.cos(a) * r * 0.8, 0, z + Math.sin(a) * r * 0.8, x + Math.cos(a) * r * 0.75, 6.5, z + Math.sin(a) * r * 0.75, 0.4, 0.4); ctx.solidCyl(x, z, r * 0.9, 0, 12.7); } else { const hT = rng.f(9, 16); pen.lathe(x, z, [[5.5, 0], [5.5, hT], [4.4, hT + 1.2], [0.4, hT + 1.8]], 12, { cap: false, aoB: 0.55 }); pen.use(steel); pen.lathe(x, z, [[5.6, hT * 0.5], [5.6, hT * 0.5 + 0.3]], 12, { cap: false }); ctx.solidCyl(x, z, 5.5, 0, hT + 1.5); } }
  // pipe racks around the hall, conveyor, yard clutter
  const P = (lx, lz) => [pen.wx(lx, lz), pen.wz(lx, lz)];
  { const a = P(-W / 2 + 3, hz - hd / 2 - 20), b = P(W / 2 - 3, hz - hd / 2 - 20); const c = P(hx + hw / 2 + 6, -Dp / 2 + 4), e = P(hx + hw / 2 + 6, Dp / 2 - 4); K.pipeRun(ctx, a[0], a[1], b[0], b[1], rng.f(7, 11), 0.7, { count: rng.i(2, 4), main: true, spacing: 18 }); K.pipeRun(ctx, c[0], c[1], e[0], e[1], rng.f(9, 14), 0.9, { count: 2, main: true, spacing: 18 }); }
  ctx.penAt(lot.x, 0.2, lot.z, lot.yaw);
  { ctx.main(); pen.use(steel); const x0 = -W / 2 + 8, z0 = -Dp / 2 + 10; pen.beam(x0, 1, z0, hx - hw * 0.2, hh * 0.7, hz - hd / 2, 2.4, 1.6); pen.use(K.emis(acc, 5, 0, true)); pen.beam(x0, 2, z0, hx - hw * 0.2, hh * 0.7 + 1, hz - hd / 2, 0.15, 0.15); for (let k = 0; k < 3; k++) { const t = (k + 0.5) / 3; const px = x0 + (hx - hw * 0.2 - x0) * t, pz = z0 + (hz - hd / 2 - z0) * t; pen.use(steel); pen.beam(px, 0, pz, px, 1 + (hh * 0.7 - 1) * t, pz, 0.5, 0.5); } }
  for (let i = 0; i < 14; i++) { const lx = rng.f(-0.48, 0.48) * W, lz = rng.f(-0.48, -0.1) * Dp; if (Math.abs(lx - hx) < hw / 2 + 4 && lz > hz - hd / 2 - 4) continue; ctx.propL(rng.pick(['crates', 'barrels', 'barrier', 'utilBox']), lx, 0, lz, rng.f(0, 6.28), rng.f(1, 1.6)); }
  ctx.light(lot.x, lot.z, W * 0.6, [1, 0.35, 0.1], 0.35, 10);
  return done(ctx, lot, hw, hd, hh + 5.5, hz);
}

// ---------------------------------------------------------------------------------------------
// PORT: container stacks under gantry cranes, sheds with numbered doors, light towers
const CONT = [[0.42, 0.22, 0.18], [0.18, 0.3, 0.4], [0.4, 0.34, 0.16], [0.22, 0.34, 0.26], [0.36, 0.36, 0.37], [0.2, 0.22, 0.36], [0.4, 0.26, 0.14]];
export function depot(ctx, rng, lot, S, o = {}) {
  const pen = ctx.penAt(lot.x, 0.2, lot.z, lot.yaw); const W = lot.w - 6, Dp = lot.d - 6; const steel = M(ST.RUST, { color: [0.36, 0.34, 0.33], seed: rng.i(0, 255) });
  const kind = rng.next();
  if (kind < 0.55) {
    // container yard: rows along x, each stack a column of boxes
    const rows = Math.floor((Dp - 30) / 9); const cols = Math.floor(W / 13.2); let count = 0; const maxC = Math.round(260 * ctx.density);
    for (let r = 0; r < rows; r++) { if (r % 3 === 2) continue; for (let c = 0; c < cols; c++) { const hgt = rng.i(0, 5); const x = -W / 2 + 6.6 + c * 13.2, z = -Dp / 2 + 20 + r * 9; for (let k = 0; k < hgt && count < maxC; k++, count++) { ctx.main(); pen.box(x + rng.f(-0.15, 0.15), z, 12.2, 2.5, k * 2.62, k * 2.62 + 2.6, { wall: M(ST.CORRUGATED, { color: rng.pick(CONT), seed: rng.i(0, 255) }), roof: M(ST.CORRUGATED, { color: [0.3, 0.3, 0.3] }), aoB: k === 0 ? 0.6 : 0.85 }); } if (hgt) ctx.solid(x, z, 12.2, 2.5, 0, hgt * 2.62); } }
    // gantry crane straddling the yard
    const gz = rng.f(-0.2, 0.2) * Dp, span = W - 8, gh = 34;
    ctx.main(); pen.use(M(ST.METAL, { color: [0.62, 0.42, 0.08] }));
    for (const sx of [-1, 1]) { for (const dz of [-6, 6]) pen.beam(sx * span / 2, 0, gz + dz, sx * span / 2, gh, gz + dz * 0.4, 1.2, 1.2); pen.beam(sx * span / 2, 0.6, gz - 6, sx * span / 2, 0.6, gz + 6, 1.4, 1.2); pen.beam(sx * span / 2, gh * 0.5, gz - 4.2, sx * span / 2, gh * 0.5, gz + 4.2, 0.8, 0.8); ctx.solid(sx * span / 2, gz, 2, 13, 0, gh); }
    pen.beam(-span / 2 - 6, gh, gz - 2, span / 2 + 6, gh, gz - 2, 1.6, 2.4); pen.beam(-span / 2 - 6, gh, gz + 2, span / 2 + 6, gh, gz + 2, 1.6, 2.4);
    const tx = rng.f(-0.3, 0.3) * span; pen.box(tx, gz, 6, 6, gh - 3.4, gh - 1.2, { wall: M(ST.WIN_RIBBON, { color: [0.3, 0.3, 0.32], seed: 9, A: 1, B: PAL.NEUTRAL, cellW: 3, floorH: 2.2, flags: WK.METAL }), roof: steel, bottom: steel });
    pen.use(K.MAT_POLE); for (const dx of [-1.5, 1.5]) pen.beam(tx + dx, gh - 3.4, gz, tx + dx, 12, gz, 0.12, 0.12); pen.box(tx, gz, 12.4, 2.6, 9.4, 12, { wall: M(ST.CORRUGATED, { color: rng.pick(CONT) }), roof: steel, bottom: steel });
    pen.use(K.emis(K.NEON.amber, 14, 2, false, rng.i(0, 255))); pen.box(-span / 2 - 6, gz, 0.7, 0.7, gh + 1.2, gh + 1.8, {}); pen.box(span / 2 + 6, gz, 0.7, 0.7, gh + 1.2, gh + 1.8, {});
    for (const lx of [-0.3, 0, 0.3]) { const p = [pen.wx(lx * span, gz), pen.wz(lx * span, gz)]; ctx.glowAt(p[0], p[1]).cone(p[0], 0.2 + gh - 1.2, p[1], 0, -1, 0, gh - 1, 1, 15, K.NEON.ice, 0.4, { segs: 8 }); ctx.light(p[0], p[1], 40, K.NEON.ice, 0.9, gh); }
    ctx.footprint(0, 0, W, Dp - 30, 0, 14, lot.block.id);
  } else {
    // twin sheds with barrel roofs and numbered doors
    const n = rng.i(2, 3); const sw = (W - (n - 1) * 10) / n, sd = Dp - 34, sh = rng.f(12, 20);
    for (let i = 0; i < n; i++) {
      const cx = -W / 2 + sw / 2 + i * (sw + 10); const v = new Vol(ctx, cx, -8, sw, sd, 0, sh);
      const wall = M(ST.CORRUGATED, { color: dim(rng.pick(S.walls), 1.0), seed: rng.i(0, 255) });
      for (const f of [0, 1, 2, 3]) facade(v, f, 0, sh, { wall, bayCells: 2, cellW: 6, floorH: sh, aoB: 0.5, ribs: f % 2 ? { d: 0.5, w: 0.5, mat: steel, every: 1 } : null });
      // doors + numbers on the front
      const nd = Math.max(1, Math.round(sw / 16)); for (let k = 0; k < nd; k++) { const s = (k + 0.5) * (sw / nd); ctx.main(); pen.use(M(ST.CORRUGATED, { color: [0.24, 0.26, 0.3], seed: k })); v.wall(0, s - 4.5, s + 4.5, 0.08, 0, 7.5); pen.use({ st: ST.METAL, color: [0.7, 0.5, 0.05], flags: 16 }); v.box(0, s - 5, s - 4.5, 0, 0.3, 0, 7.8, null, { bottom: false }); v.box(0, s + 4.5, s + 5, 0, 0.3, 0, 7.8, null, { bottom: false }); ctx.detail(); const keys = Object.keys(ctx.atlas.decal); const p = v.P(0, s, 0.12); pen.sign(p[0], 10.2, p[1], 0, 3.6, 3.6, ctx.atlas.decal[keys[(i * 3 + k) % 4]], { intensity: 1.5, seed: k }); pen.use(K.emis(K.NEON.ice, 9)); v.box(0, s - 3, s + 3, 0.3, 0.5, 8.0, 8.25, null, { ends: false, bottom: false }); ctx.main(); const lp = v.world(0, s, 5); ctx.light(lp[0], lp[1], 20, K.NEON.ice, 0.7, 7); }
      // barrel roof
      ctx.main(); pen.use(M(ST.CORRUGATED, { color: [0.32, 0.33, 0.34], seed: i }));
      const segs = 7; for (let k = 0; k < segs; k++) { const a0 = Math.PI * (k / segs), a1 = Math.PI * ((k + 1) / segs); const x0 = cx - Math.cos(a0) * sw / 2, x1 = cx - Math.cos(a1) * sw / 2, y0 = sh + Math.sin(a0) * sw * 0.2, y1 = sh + Math.sin(a1) * sw * 0.2; pen.quad(x0, y0, -8 + sd / 2, x1, y1, -8 + sd / 2, x1, y1, -8 - sd / 2, x0, y0, -8 - sd / 2, 0, 0, sw / segs, sd); }
      v.solid(); ctx.solid(cx, -8, sw * 0.7, sd, sh, sh + sw * 0.14);
      ctx.footprint(cx, -8, sw, sd, 0, sh, lot.block.id);
    }
    for (let i = 0; i < 10; i++) ctx.propL(rng.pick(['crates', 'barrels', 'barrier']), rng.f(-0.46, 0.46) * W, 0, Dp / 2 - rng.f(2, 12), rng.f(0, 6.28), rng.f(1, 1.6));
  }
  // floodlight towers at the corners
  for (const [sx, sz] of [[1, 1], [-1, -1]]) { const x = sx * (W / 2 - 3), z = sz * (Dp / 2 - 3); ctx.propL('mast', x, 0, z, 0, 1.5); const p = [pen.wx(x, z), pen.wz(x, z)]; ctx.glowAt(p[0], p[1]).cone(p[0], 0.2 + 27, p[1], -sx * 0.35, -0.86, -sz * 0.35, 46, 1, 22, K.NEON.ice, 0.3, { segs: 8 }); ctx.light(p[0] - sx * 14, p[1] - sz * 14, 50, K.NEON.ice, 0.8, 20); }
  ctx.shade(lot.x, lot.z, Math.max(W, Dp) * 0.5, 0.3); ctx.stats.buildings++; lot.h = 30;
  return 30;
}

// ---------------------------------------------------------------------------------------------
// VERDANT: stacked grow decks around a core, planted rims, greenhouses and algae silos at the foot
export function farmTower(ctx, rng, lot, S, o = {}) {
  const pen = ctx.penAt(lot.x, 0.2, lot.z, lot.yaw); const W = lot.w - 8, Dp = lot.d - 8; const acc = rng.pick(S.accents);
  const R = Math.min(W, Dp) * rng.f(0.22, 0.3); const H = o.h ?? 200; const dk = 11; const n = Math.max(4, Math.round(H / dk));
  const cx = rng.f(-0.15, 0.15) * W, cz = rng.f(-0.12, 0.12) * Dp;
  const grow = M(ST.WIN_GROW, { color: [0.3, 0.34, 0.32], seed: rng.i(0, 255), A: 0.95, B: PAL.MAGENTA, cellW: 3.4, floorH: 5.4, flags: WK.COMPOSITE });
  const rim = M(ST.COMPOSITE, { color: [0.4, 0.42, 0.42], seed: rng.i(0, 255) }); const fol = K.foliage([0.22, 0.46, 0.2]);
  ctx.main(); pen.use(M(ST.CONCRETE, { color: [0.4, 0.41, 0.4], seed: 3 })); pen.lathe(cx, cz, [[R * 0.42, 0], [R * 0.34, 12], [R * 0.3, H + 6]], 12, { aoB: 0.5 });
  const helix = rng.f(0.2, 0.5) * rng.sign();
  for (let i = 0; i < n; i++) {
    const y = 10 + i * dk; const t = i / (n - 1); const r = R * (0.72 + 0.28 * Math.sin(t * Math.PI) + 0.12 * Math.sin(i * 1.7)) * (1 - 0.25 * t);
    const ox = Math.cos(i * helix) * R * 0.14, oz = Math.sin(i * helix) * R * 0.14;
    pen.use(rim); pen.lathe(cx + ox, cz + oz, [[r * 0.3, y - 0.9], [r + 1.4, y - 0.5], [r + 1.4, y + 0.5]], 14, { cap: false });
    pen.use(grow); pen.lathe(cx + ox, cz + oz, [[r, y + 0.5], [r, y + 5.9]], 14, { cap: false });
    pen.use(rim); pen.lathe(cx + ox, cz + oz, [[r + 0.5, y + 5.9], [r + 0.5, y + 6.4], [r * 0.3, y + 6.9]], 14, { cap: false });
    if (i % 2 === 0) { pen.use(fol); pen.lathe(cx + ox, cz + oz, [[r + 0.3, y + 0.5], [r + 1.5, y + 0.7], [r + 1.7, y + 1.5], [r + 0.05, y + 1.4]], 14, { cap: false }); }
    if (i % 3 === 1) ctx.spark(pen.wx(cx + ox + r, cz + oz), 0.2 + y + 3, pen.wz(cx + ox + r, cz + oz), K.NEON.magenta, 7, 1.8);
  }
  ctx.solidCyl(cx, cz, R * 0.9, 0, H + 6);
  // crown: collector dish + beacon
  { const y = 10 + n * dk; pen.use(rim); pen.lathe(cx, cz, [[R * 0.3, y - 2], [R * 0.8, y + 3], [R * 0.95, y + 9]], 16, { cap: false }); pen.use({ st: ST.MIRROR, color: [1, 1, 1] }); pen.lathe(cx, cz, [[R * 0.93, y + 8.9], [R * 0.78, y + 3.2], [R * 0.3, y - 1.6], [0.3, y - 1.9]], 16, { cap: false }); pen.use(K.MAT_POLE); pen.tube(cx, y - 2, cz, cx, y + 26, cz, 0.5, 6, { r1: 0.15 }); pen.use(K.emis(acc, 16, 2, false, rng.i(0, 255))); pen.lathe(cx, cz, [[0.6, y + 26], [0.6, y + 27], [0.05, y + 27.6]], 6, {}); ctx.spark(pen.wx(cx, cz), 0.2 + y + 27, pen.wz(cx, cz), acc, 7, 2.2); }
  ctx.light(pen.wx(cx, cz), pen.wz(cx, cz), R * 3.2, K.NEON.magenta, 1.0, 20);
  ctx.footprint(cx, cz, R * 2, R * 2, 0, H, lot.block.id);
  // greenhouse vaults along the front + algae silos at the back
  const nv = Math.max(1, Math.floor(W / 30)); const vl = Math.min(60, Dp * 0.3);
  for (let i = 0; i < nv; i++) {
    const gx = -W / 2 + 15 + i * (W - 30) / Math.max(1, nv - 1 || 1), gz = Dp / 2 - vl / 2 - 3; if (Math.hypot(gx - cx, gz - cz) < R + 18) continue;
    const gr = 9; ctx.main(); pen.use(M(ST.CONCRETE, { color: [0.38, 0.38, 0.38] })); pen.box(gx, gz, gr * 2 + 1, vl, 0, 1.2, {});
    const segs = 8; pen.use({ ...grow, cellW: 3.2, floorH: 3.2 });
    for (let k = 0; k < segs; k++) { const a0 = Math.PI * (k / segs), a1 = Math.PI * ((k + 1) / segs); const x0 = gx - Math.cos(a0) * gr, x1 = gx - Math.cos(a1) * gr, y0 = 1.2 + Math.sin(a0) * gr, y1 = 1.2 + Math.sin(a1) * gr; pen.quad(x0, y0, gz + vl / 2, x1, y1, gz + vl / 2, x1, y1, gz - vl / 2, x0, y0, gz - vl / 2, k * 3, 0, k * 3 + 1, Math.round(vl / 3.2)); }
    pen.use(rim); for (let k = 0; k <= 4; k++) { const z = gz - vl / 2 + (vl * k) / 4; for (let s = 0; s < segs; s++) { const a0 = Math.PI * (s / segs), a1 = Math.PI * ((s + 1) / segs); pen.beam(gx - Math.cos(a0) * (gr + 0.1), 1.2 + Math.sin(a0) * (gr + 0.1), z, gx - Math.cos(a1) * (gr + 0.1), 1.2 + Math.sin(a1) * (gr + 0.1), z, 0.3, 0.3); } }
    ctx.solid(gx, gz, gr * 2, vl, 0, gr * 0.9); ctx.footprint(gx, gz, gr * 2 + 1, vl, 0, gr + 1.2, lot.block.id);
    const lp = [pen.wx(gx, gz), pen.wz(gx, gz)]; ctx.light(lp[0], lp[1], 30, K.NEON.magenta, 0.9, 6);
  }
  const ns = Math.floor(W / 14);
  for (let i = 0; i < ns; i++) { const sx = -W / 2 + 7 + i * 14, sz = -Dp / 2 + 8; if (Math.hypot(sx - cx, sz - cz) < R + 10) continue; const sh = rng.f(16, 34); ctx.main(); pen.use(M(ST.METAL, { color: [0.42, 0.46, 0.44], seed: i })); pen.lathe(sx, sz, [[4.6, 0], [4.6, sh], [3.6, sh + 2], [0.6, sh + 3]], 12, { cap: false, aoB: 0.55 }); pen.use(K.emis(K.NEON.green, 5, 3, false, i * 13)); for (const yy of [sh * 0.3, sh * 0.6, sh * 0.9]) pen.lathe(sx, sz, [[4.66, yy], [4.66, yy + 0.5]], 12, { cap: false }); ctx.solidCyl(sx, sz, 4.6, 0, sh + 2); if (i % 2 === 0) ctx.light(pen.wx(sx, sz), pen.wz(sx, sz), 18, K.NEON.green, 0.6, 8); }
  for (let i = 0; i < 12; i++) { const lx = rng.f(-0.48, 0.48) * W, lz = rng.f(-0.3, 0.2) * Dp; if (Math.hypot(lx - cx, lz - cz) < R + 6) continue; ctx.propL(rng.pick(['tree', 'planter', 'tree']), lx, 0, lz, rng.f(0, 6.28), rng.f(0.9, 1.6)); }
  ctx.shade(lot.x, lot.z, R * 2.2 + H * 0.2, 0.6); ctx.stats.buildings++; lot.h = H;
  return H;
}

// ---------------------------------------------------------------------------------------------
// open blocks: night market (Sump/Hive), forecourt with pool + holo sculpture (Meridian/Lumina), stone square (Old Quarter)
export function plaza(ctx, rng, b, S) {
  const pen = ctx.penAt(b.x, 0.2, b.z, b.yaw); const W = b.w - b.walk * 2, Dp = b.d - b.walk * 2; const acc = rng.pick(S.accents);
  if (b.district === 'sump' || b.district === 'hive') {
    const rows = Math.max(1, Math.floor(Dp / 9)), cols = Math.max(2, Math.floor(W / 5.2));
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { if (rng.chance(0.2)) continue; const x = -W / 2 + 2.6 + c * (W - 5.2) / (cols - 1), z = -Dp / 2 + 4.5 + r * 9; const kind = rng.chance(0.8) ? 'stall' : 'cart'; ctx.propL(kind, x, 0, z, r % 2 ? Math.PI : 0, 1, [rng.f(0.6, 1.5), rng.f(0.6, 1.3), rng.f(0.6, 1.4)]); ctx.solid(x, z, 3, 2, 0, 1); const lp = [pen.wx(x, z), pen.wz(x, z)]; ctx.light(lp[0], lp[1], 9, rng.pick([K.NEON.sodium, K.NEON.amber, K.NEON.white]), 0.7, 2.4); if (rng.chance(0.25)) ctx.steam.push({ x: lp[0], y: 1.6, z: lp[1], s: 0.5 }); }
    // lantern strings across the aisles
    ctx.detail(); for (let i = 0; i < Math.floor(W / 14); i++) { const x = -W / 2 + 7 + i * 14; const e = K.emis(rng.pick([K.NEON.sodium, K.NEON.amber, K.NEON.pink, K.NEON.cyan]), 6, 0, false, rng.i(0, 255)); e.flags |= 8; pen.use(K.MAT_POLE); pen.tube(x, 0, -Dp / 2 + 0.5, x, 5.4, -Dp / 2 + 0.5, 0.06, 4); pen.tube(x, 0, Dp / 2 - 0.5, x, 5.4, Dp / 2 - 0.5, 0.06, 4); pen.use(e); pen.beam(x, 5.3, -Dp / 2 + 0.5, x, 5.3, Dp / 2 - 0.5, 0.12, 0.12); }
    ctx.main(); ctx.light(b.x, b.z, Math.max(W, Dp) * 0.6, K.NEON.sodium, 0.35, 4);
    ctx.poi({ type: 'market', x: b.x, y: 0.2, z: b.z, district: b.district });
  } else if (b.district === 'oldq') {
    pen.use(M(ST.STONE, { color: [0.46, 0.44, 0.42] })); pen.lathe(0, 0, [[5, 0], [4.2, 1.2], [1.6, 1.6], [1.2, 22], [0.1, 27]], 4, { cap: false }); ctx.solidCyl(0, 0, 3, 0, 22);
    pen.use(K.emis(acc, 5, 3, true, 7)); pen.lathe(0, 0, [[1.5, 6], [1.4, 6.4]], 4, { cap: false }); pen.lathe(0, 0, [[1.34, 14], [1.3, 14.4]], 4, { cap: false });
    const n = 10; for (let i = 0; i < n; i++) { const a = (i / n) * 6.283, r = Math.min(W, Dp) * 0.36; pen.use(M(ST.STONE, { color: [0.48, 0.46, 0.43], seed: i })); pen.lathe(Math.cos(a) * r, Math.sin(a) * r, [[0.75, 0], [0.6, 0.5], [0.52, 7], [0.75, 7.4]], 8, {}); ctx.solidCyl(Math.cos(a) * r, Math.sin(a) * r, 0.7, 0, 7.4); const a2 = ((i + 1) / n) * 6.283; pen.beam(Math.cos(a) * r, 7.8, Math.sin(a) * r, Math.cos(a2) * r, 7.8, Math.sin(a2) * r, 1.0, 0.8); }
    for (let i = 0; i < 8; i++) ctx.propL(rng.pick(['bench', 'planter', 'lampC']), rng.f(-0.4, 0.4) * W, 0, rng.f(-0.4, 0.4) * Dp, rng.f(0, 6.28));
    ctx.light(b.x, b.z, 40, acc, 0.6, 6);
  } else {
    // reflecting pool + holographic sculpture + trees
    const pw = W * 0.5, pd = Dp * 0.4; ctx.main();
    pen.box(0, 0, pw + 1.2, pd + 1.2, 0, 0.45, { wall: M(ST.COMPOSITE, { color: [0.3, 0.3, 0.33] }), roof: M(ST.COMPOSITE, { color: [0.3, 0.3, 0.33] }) }); pen.use(M(ST.WATER, { color: [0.2, 0.3, 0.36], extra: 30 })); pen.flat(-pw / 2, -pd / 2, pw / 2, pd / 2, 0.47);
    ctx.solid(0, 0, pw + 1.2, pd + 1.2, 0, 0.45);
    const lg = b.district === 'meridian' ? ctx.atlas.corp.meridian : b.district === 'lumina' ? ctx.atlas.corp.lumina : ctx.atlas.corp.helion; const sz = Math.min(pw, 26);
    const g = ctx.glow; const c = [pen.wx(0, 0), pen.wz(0, 0)]; const col = lg.color;
    for (const yaw of [0, Math.PI / 2]) { const dx = Math.cos(b.yaw + yaw) * sz / 2, dz = -Math.sin(b.yaw + yaw) * sz / 2; g.quad([c[0] - dx, 6, c[1] - dz], [c[0] + dx, 6, c[1] + dz], [c[0] + dx, 6 + sz, c[1] + dz], [c[0] - dx, 6 + sz, c[1] - dz], [1, 1, 1], 0.9, 3, 2.2, { uv: [lg.logo.u0, lg.logo.v0, lg.logo.u1, lg.logo.v1], seed: rng.f(0, 9) }); }
    g.cone(c[0], 0.7, c[1], 0, 1, 0, 8 + sz, 2.5, sz * 0.5, col, 0.35, { segs: 10 });
    ctx.light(c[0], c[1], sz * 2.4, col, 1.1, 10); ctx.spark(c[0], 6 + sz / 2, c[1], col, 9, 2.5);
    for (let i = 0; i < Math.floor(W / 9); i++) for (const sgn of [-1, 1]) { const x = -W / 2 + 4.5 + i * 9, z = sgn * (Dp / 2 - 4); ctx.propL(i % 3 === 1 ? 'bench' : 'tree', x, 0, z, sgn > 0 ? Math.PI : 0, rng.f(0.9, 1.3)); if (i % 3 !== 1) ctx.solidCyl(x, z, 0.3, 0, 3); }
    for (const [sx, sz2] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { ctx.propL('lampC', sx * (pw / 2 + 3), 0, sz2 * (pd / 2 + 3), 0, 1, [col[0] + 0.3, col[1] + 0.3, col[2] + 0.3]); ctx.light(pen.wx(sx * (pw / 2 + 3), sz2 * (pd / 2 + 3)), pen.wz(sx * (pw / 2 + 3), sz2 * (pd / 2 + 3)), 14, col, 0.6, 6); }
    ctx.poi({ type: 'plaza', x: b.x, y: 0.2, z: b.z, district: b.district });
  }
}
