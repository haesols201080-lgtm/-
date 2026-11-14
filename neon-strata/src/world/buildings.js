// Building recipes. Every recipe fills exactly one lot (pen frame: lot centre, local +z = street front)
// and stays inside it, so neighbouring buildings abut without ever intersecting.
import { ST, PAL, WK, FLAG } from '../render/cityMaterial.js';
import { M, rectPts, scalePts, ngonPts, rotPts } from './builder.js';
import * as K from './kit.js';
import { Vol, facade, blindWall, shopSign, bladeSign, screenWall, FACE_ANG } from './facade.js';
import { hollow, lobby, shopRoom } from './interiors.js';
import { FORMS, MEGA, pickForm, roofForm } from './buildings3.js';

let uo = 11;
const nextU = () => (uo = (uo * 37 + 11) % 877);
export function wallMat(rng, S, o = {}) {
  return M(o.st ?? S.win, { color: o.color ?? rng.pick(S.walls), seed: rng.i(0, 255), A: o.lit ?? rng.f(S.lit[0], S.lit[1]), B: o.light ?? rng.pick(S.lights), cellW: o.cellW ?? S.cellW ?? 3.1, floorH: o.floorH ?? S.floorH ?? 3.2, flags: (o.wk ?? rng.pick(S.wk)) | (o.flags ?? 0) });
}
const dim = (c, k) => [c[0] * k, c[1] * k, c[2] * k];

// rooftop equipment on a slot grid (never overlaps)
export function roofProps(ctx, rng, cx, cz, w, d, y, kinds, density = 1, slot = 4.8) {
  const nx = Math.floor((w - 2.4) / slot), nz = Math.floor((d - 2.4) / slot); if (nx < 1 || nz < 1) return;
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    if (!rng.chance(Math.min(0.9, 0.27 * density))) continue;
    const [name, sc] = rng.weighted(kinds);
    const x = cx - w / 2 + 1.2 + (i + 0.5) * ((w - 2.4) / nx) + rng.f(-0.4, 0.4), z = cz - d / 2 + 1.2 + (j + 0.5) * ((d - 2.4) / nz) + rng.f(-0.4, 0.4);
    ctx.propL(name, x, y, z, rng.pick([0, 1.5708, 3.1416, -1.5708]) + rng.f(-0.06, 0.06), sc ? rng.f(sc[0], sc[1]) : 1);
  }
}
const ROOF_LOW = [[4, ['acSmall', [1, 1.3]]], [3, ['tank', [0.7, 0.9]]], [2, ['dish', [0.8, 1.2]]], [2, ['vent', [0.8, 1.1]]], [2, ['solar', [0.9, 1.1]]], [1.5, ['shack', [0.9, 1.05]]], [1, ['ventCap', [1, 1.4]]]];
const ROOF_TECH = [[4, ['chiller', [1, 1.25]]], [2, ['cooler', [0.8, 1.1]]], [2, ['dish', [1, 1.6]]], [2, ['ventCap', [1.2, 1.8]]], [1.5, ['solar', [1, 1.2]]], [1, ['duct', [0.7, 0.8]]], [0.6, ['mast', [0.7, 1.0]]]];

function finish(ctx, lot, w, d, h, cz = 0) {
  ctx.shade(lot.x, lot.z, Math.max(w, d) * 0.75 + h * 0.25, Math.min(0.75, h / 260 + 0.22));
  ctx.footprint(0, cz, w, d, 0, h, lot.block.id);
  ctx.stats.buildings++;
  lot.h = h;
  return h;
}
// pavement life in front of a trading shop: what stands outside says what is sold inside.
// kind: 0 store, 1 eatery, 2 tech, 3 clinic / salon. Also registers places where people linger (ctx.spots).
const SHOP_LIGHT = [[1, 0.94, 0.84], [1, 0.76, 0.5], [0.74, 0.9, 1], [0.88, 1, 0.94]];
function apron(v, rng, a, b, kind, nc, walk = 4) {
  const ctx = v.ctx, pen = v.pen; const wv = b - a; if (wv < 3 || walk < 2.6) return;
  const bayW = wv / nc; const doorS = b - bayW / 2; const f0 = a + 0.6, f1 = nc > 1 ? b - bayW - 0.4 : b - 0.6; const fs = () => rng.f(f0, Math.max(f0, f1));
  const put = (name, s, off, yaw = 0, sc = 1, tint = null) => { const p = v.P(0, s, off); ctx.propL(name, p[0], 0, p[1], yaw, sc, tint); return p; };
  const spotAt = (p, yaw, o = {}) => ctx.spots.push({ x: pen.wx(p[0], p[1]), y: pen.oy, z: pen.wz(p[0], p[1]), yaw: pen.yaw + yaw, ...o });
  let board = false;
  if (kind === 1) {
    if (walk >= 2.7 && f1 - f0 > 2.2) { const n = Math.min(2, Math.floor((f1 - f0) / 2.4)); for (let i = 0; i < n; i++) if (rng.chance(0.8)) { const p = put('table', f0 + (i + 0.5) * ((f1 - f0) / n), Math.min(1.35, walk * 0.42), 0, 1, [rng.f(0.7, 1.5), rng.f(0.7, 1.3), rng.f(0.7, 1.3)]); ctx.solidCyl(p[0], p[1], 0.42, 0, 0.75);
      for (let k = 0; k < 3; k++) if (rng.chance(0.62)) { const an = k * 2.094 + 0.5; const lx = Math.cos(an) * 0.74, lz = Math.sin(an) * 0.74; spotAt([p[0] + lx, p[1] + lz], Math.atan2(-lx, -lz), { sit: true }); } } }
    if (rng.chance(0.55)) { put('aboard', doorS - bayW * 0.5 - 0.5, 0.95, rng.f(-0.4, 0.4)); board = true; }
    if (rng.chance(0.5)) { const p = v.world(0, doorS, 0.4); ctx.steam.push({ x: p[0], y: pen.oy + 2.5, z: p[1], s: 0.4 }); }
    if (rng.chance(0.5)) spotAt(v.P(0, doorS + rng.f(-0.5, 0.5), 1.25), Math.PI + rng.f(-0.3, 0.3), { clip: 'phone' });
  } else if (kind === 0) {
    if (rng.chance(0.65)) put('rackOut', fs(), 0.6, 0);
    if (rng.chance(0.35)) put('crates', fs(), 0.75, rng.f(0, 6.28), rng.f(0.8, 1.1));
    if (rng.chance(0.18)) { const p = put('vending', a + 0.75, 0.5, 0); ctx.solid(p[0], p[1], 1.15, 0.8, 0, 2); const lp = v.world(0, a + 0.75, 1.4); ctx.light(lp[0], lp[1], 6, K.NEON.white, 0.35, pen.oy + 1.4); }
    if (rng.chance(0.4)) spotAt(v.P(0, fs(), 1.15), Math.PI + rng.f(-0.4, 0.4), { clip: 'idle' });
  } else if (kind === 2) {
    if (rng.chance(0.35)) { const p = put('kiosk', fs(), 0.7, 0); ctx.solidCyl(p[0], p[1], 0.4, 0, 1.6); }
    if (rng.chance(0.4)) put('bot', fs(), rng.f(1.3, 2.0), rng.f(0, 6.28));
    if (rng.chance(0.6) && ctx.atlas.sq && ctx.atlas.sq.length) { const lg = rng.pick(ctx.atlas.sq); const p0 = v.world(0, doorS - 0.55, 0.55), p1 = v.world(0, doorS + 0.55, 0.55); const y0 = pen.oy + 2.85; ctx.glow.quad([p0[0], y0, p0[1]], [p1[0], y0, p1[1]], [p1[0], y0 + 1.1, p1[1]], [p0[0], y0 + 1.1, p0[1]], [0.7, 0.95, 1], 0.9, 3, 1.5, { uv: [lg.u0, lg.v0, lg.u1, lg.v1], seed: rng.f(0, 9) }); }
    if (rng.chance(0.45)) spotAt(v.P(0, fs(), 1.2), Math.PI + rng.f(-0.5, 0.5), { clip: 'phone' });
  } else {
    if (rng.chance(0.6)) { put('planter', doorS - bayW * 0.5 - 0.3, 0.5, 0, 0.8); if (nc > 1) put('planter', a + 0.5, 0.5, 0, 0.8); }
    if (rng.chance(0.35) && f1 - f0 > 2.4) { const p = put('bench', (f0 + f1) / 2, 0.5, 0); ctx.solid(p[0], p[1], 1.9, 0.5, 0, 0.5); }
    if (rng.chance(0.35)) spotAt(v.P(0, doorS + rng.f(-0.6, 0.6), 1.3), rng.f(-0.6, 0.6), { clip: 'idle' });
  }
  if (!board && rng.chance(0.22)) put('aboard', doorS - bayW * 0.5 - 0.4, 0.95, rng.f(-0.4, 0.4));
  if (rng.chance(0.14)) put('scooter', fs(), 0.95, 1.5708 + rng.f(-0.25, 0.25));
  if (rng.chance(0.05)) put('trash', a + 0.3, 0.5, rng.f(0, 6.28), 0.8);
  if (walk >= 3.4 && rng.chance(0.28)) { const s = fs(); const p1 = v.P(0, s, 1.75), p2 = v.P(0, s + 0.95, 1.9); spotAt(p1, Math.atan2(p2[0] - p1[0], p2[1] - p1[1]), { clip: 'talk' }); spotAt(p2, Math.atan2(p1[0] - p2[0], p1[1] - p2[1]), { clip: rng.chance(0.5) ? 'talk' : 'idle' }); }
}
// the way in for the people who live upstairs: recessed glazed door under a canopy, intercom, letterboxes, pasted notices
function entryUnit(v, rng, S, s0, s1, gh, o = {}) {
  const ctx = v.ctx, pen = v.pen; const wv = s1 - s0, c = (s0 + s1) / 2, top = gh - 0.7; const dw = Math.min(2.0, wv - 1.4), dh = Math.min(2.6, top - 0.2), rec = 0.9;
  const x0 = v.cx - v.w / 2, zF = v.cz + v.d / 2, xa = x0 + c - dw / 2, xb = x0 + c + dw / 2, zB = zF - rec;
  ctx.main(); v.box(0, s0, s0 + 0.36, 0, 0.14, 0, gh, K.conc(0.33), { top: false });
  const wm = M(ST.TILE, { color: [0.3, 0.3, 0.33], seed: rng.i(0, 255) }); pen.use(wm);
  v.wall(0, s0 + 0.36, c - dw / 2, 0, 0, top, { aoB: 0.6 }); v.wall(0, c + dw / 2, s1, 0, 0, top, { aoB: 0.6 }); v.wall(0, c - dw / 2, c + dw / 2, 0, dh, top);
  pen.use(K.conc(0.3)); v.wall(0, s0 + 0.36, s1, 0, top, gh);
  // real recess
  pen.use(M(ST.COMPOSITE, { color: [0.24, 0.24, 0.26], flags: FLAG.INDOOR })); pen.wall(xa, zF, xa, zB, 0, dh, {}); pen.wall(xb, zB, xb, zF, 0, dh, {}); pen.flat(xa, zB, xb, zF, dh, false, 0.8);
  pen.use(M(ST.TILE, { color: [0.34, 0.34, 0.36], flags: FLAG.INDOOR })); pen.flat(xa, zB, xb, zF + 0.02, 0.03);
  const u = (nextU() % 60) * 16; pen.use(M(ST.WIN_LUX, { color: [0.2, 0.2, 0.22], seed: rng.i(0, 255), A: 1, B: PAL.WARM, cellW: dw, floorH: dh, flags: WK.METAL })); pen.wall(xa, zB, xb, zB, 0, dh, { uv: [u, 0, u + 1, 1] });
  ctx.detail(); pen.use(K.MAT_POLE); pen.box((xa + xb) / 2, zB + 0.04, 0.07, 0.07, 0, dh, {}); pen.box((xa + xb) / 2, zB + 0.05, dw, 0.06, 1.02, 1.1, {});
  v.box(0, c - dw / 2 - 0.5, c + dw / 2 + 0.5, 0, 1.25, dh + 0.24, dh + 0.42, K.dark(0.12));
  pen.use(K.emis([1, 0.86, 0.66], 5)); v.box(0, c - 0.5, c + 0.5, 0.45, 0.62, dh + 0.2, dh + 0.24, null, { ends: false, top: false });
  pen.use(K.dark(0.06)); v.box(0, c + dw / 2 + 0.22, c + dw / 2 + 0.5, 0, 0.05, 1.15, 1.6, null, {}); pen.use(K.emis([0.3, 0.9, 1], 4)); v.box(0, c + dw / 2 + 0.28, c + dw / 2 + 0.44, 0.05, 0.065, 1.38, 1.52, null, {});
  if (c - dw / 2 - s0 > 2.0) { v.box(0, s0 + 0.6, Math.min(c - dw / 2 - 0.4, s0 + 2.1), 0, 0.2, 0.95, 1.75, K.metal([0.42, 0.44, 0.46])); }
  const at = ctx.atlas; if (at.decal) { const keys = ['07', '12', 'A', 'B'].filter((k) => at.decal[k]); if (keys.length) { const p = v.P(0, c - dw / 2 - 0.4, 0.04); pen.sign(p[0], 2.1, p[1], FACE_ANG[0], 0.4, 0.4, at.decal[rng.pick(keys)], { intensity: 1.4, seed: rng.i(0, 255) }); } }
  if (at.notice && at.notice.length && s1 - (c + dw / 2) > 1.6) for (let i = 0; i < rng.i(1, 2); i++) { const p = v.P(0, c + dw / 2 + 1.0 + i * 0.1, 0.04); pen.sign(p[0], 1.5 + i * 0.36, p[1], FACE_ANG[0], 0.9, 0.225, rng.pick(at.notice), { intensity: 0.45, seed: rng.i(0, 255) }); }
  ctx.main();
  const lp = v.world(0, c, 0.8); ctx.light(lp[0], lp[1], 7, [1, 0.86, 0.66], 0.5, pen.oy + dh);
  { const m0 = v.world(0, c, 0), m1 = v.world(0, c, 3); ctx.marks.push({ type: 'entry', x: m0[0], z: m0[1], doorX: m1[0], doorZ: m1[1] }); }
  if (rng.chance(0.35)) { const p = v.P(0, c + rng.f(-1.2, 1.2), 1.3); ctx.spots.push({ x: pen.wx(p[0], p[1]), y: pen.oy, z: pen.wz(p[0], p[1]), yaw: pen.yaw + rng.f(-0.7, 0.7), clip: rng.chance(0.5) ? 'phone' : 'idle' }); }
}
// vehicle entrance: a real, lit recess with hazard jambs, a guide line on the floor, a barrier and a car parked inside
function garageUnit(v, rng, S, s0, s1, gh, o = {}) {
  const ctx = v.ctx, pen = v.pen; const wv = s1 - s0, c = (s0 + s1) / 2; const ow = Math.min(5.4, wv - 1.3), oh = Math.min(3.1, gh - 1.0), dep = Math.min(v.d - 1.5, 7.5);
  const x0 = v.cx - v.w / 2, zF = v.cz + v.d / 2, xa = x0 + c - ow / 2, xb = x0 + c + ow / 2, zB = zF - dep; const IN = FLAG.INDOOR;
  ctx.main(); v.box(0, s0, s0 + 0.36, 0, 0.14, 0, gh, K.conc(0.33), { top: false });
  pen.use(M(ST.CONCRETE, { color: [0.32, 0.32, 0.33], seed: rng.i(0, 255) })); v.wall(0, s0 + 0.36, c - ow / 2, 0, 0, gh, { aoB: 0.6 }); v.wall(0, c + ow / 2, s1, 0, 0, gh, { aoB: 0.6 }); v.wall(0, c - ow / 2, c + ow / 2, 0, oh, gh);
  const cm = M(ST.CONCRETE, { color: [0.3, 0.3, 0.31], seed: rng.i(0, 255), flags: IN }); pen.use(cm);
  pen.wall(xa, zF, xa, zB, 0, oh, { aoB: 0.6 }); pen.wall(xb, zB, xb, zF, 0, oh, { aoB: 0.6 }); pen.wall(xa, zB, xb, zB, 0, oh, { aoB: 0.6 }); pen.flat(xa, zB, xb, zF, oh, false, 0.7);
  pen.use(M(ST.ROAD, { cellW: 0, flags: IN })); pen.flat(xa, zB, xb, zF + 0.02, 0.03);
  pen.use(K.emis([0.3, 0.95, 1], 2.2)); pen.flat((xa + xb) / 2 - 0.06, zB + 0.6, (xa + xb) / 2 + 0.06, zF - 0.2, 0.045);
  pen.use(K.emis([0.9, 0.96, 1], 6)); for (const z of [zB + dep * 0.3, zB + dep * 0.72]) pen.flat(xa + 0.8, z - 0.09, xb - 0.8, z + 0.09, oh - 0.03, false);
  ctx.detail(); const hz = { st: ST.METAL, color: [0.7, 0.5, 0.05], flags: 16 };
  v.box(0, c - ow / 2 - 0.26, c - ow / 2, 0, 0.1, 0, oh + 0.26, hz, { bottom: false }); v.box(0, c + ow / 2, c + ow / 2 + 0.26, 0, 0.1, 0, oh + 0.26, hz, { bottom: false }); v.box(0, c - ow / 2, c + ow / 2, 0, 0.1, oh, oh + 0.26, hz, {});
  const at = ctx.atlas; const pd = at.decal && (at.decal.P || at.decal['주차']); if (pd) { const p = v.P(0, c, 0.12); pen.use(K.dark(0.05)); v.box(0, c - 0.62, c + 0.62, 0, 0.1, oh + 0.4, oh + 1.6, null, {}); pen.sign(p[0], oh + 1.0, p[1], FACE_ANG[0], 1.05, 1.05, pd, { intensity: 3, seed: rng.i(0, 255) }); }
  ctx.main();
  ctx.propL('hovercar', (xa + xb) / 2 + rng.f(-0.9, 0.9), 0.03, zB + dep * 0.42, rng.chance(0.5) ? 0 : Math.PI, 1, [rng.f(0.5, 1.5), rng.f(0.5, 1.4), rng.f(0.5, 1.5)]);
  { const p = v.P(0, c + ow / 2 - 1.1, 0.25); ctx.propL('barrier', p[0], 0, p[1], 0); }
  ctx.light(pen.wx((xa + xb) / 2, zB + dep * 0.5), pen.wz((xa + xb) / 2, zB + dep * 0.5), 9, [0.9, 0.96, 1], 1.0, pen.oy + oh - 0.3, { indoor: true, range: 9, gain: 3 });
  const lp = v.world(0, c, 1.2); ctx.light(lp[0], lp[1], 8, [0.85, 0.93, 1], 0.4, pen.oy + oh);
  { const m0 = v.world(0, c, 0), m1 = v.world(0, c, 3); ctx.marks.push({ type: 'garage', x: m0[0], z: m0[1], doorX: m1[0], doorZ: m1[1] }); }
}
// ground floor shop unit on a stretch of the front face
function shopUnit(v, rng, S, s0, s1, gh, o = {}) {
  const ctx = v.ctx, pen = v.pen; const pil = 0.36;
  ctx.main();
  v.box(0, s0, s0 + pil, 0, 0.14, 0, gh, K.conc(0.33), { top: false });
  const a = s0 + pil, b = s1; const wv = b - a;
  let entered = null; let signKind = null;
  if (o.enter && wv > 4.4) { // open doorway + real room behind
    const nc = Math.max(1, Math.round(wv / 3.4)); const u = nextU(); const dA = b - 2.7, dB = b - 0.35, dH = 2.7; const top = gh - 0.7;
    const uu = (q) => u + (nc * (q - a)) / wv, vv = (q) => q / top;
    pen.use(M(ST.WIN_LUX, { color: [0.2, 0.2, 0.22], seed: rng.i(0, 255), A: 0.96, B: rng.pick(S.shopLights || [PAL.WARM, PAL.NEUTRAL, PAL.COOL]), cellW: wv / nc, floorH: top, flags: WK.COMPOSITE }));
    v.wall(0, a, dA, 0, 0, top, { uv: [uu(a), 0, uu(dA), 1], aoB: 0.6 }); v.wall(0, dB, b, 0, 0, top, { uv: [uu(dB), 0, uu(b), 1], aoB: 0.6 }); v.wall(0, dA, dB, 0, dH, top, { uv: [uu(dA), vv(dH), uu(dB), 1] });
    const x0 = v.cx - v.w / 2; const zF = v.cz + v.d / 2; const dep = Math.min(v.d - 1.2, rng.f(6, 8.5));
    entered = shopRoom(ctx, rng, x0 + a, x0 + b, zF, dep, top - 0.05, { a: x0 + dA, b: x0 + dB, h: dH }, { kind: o.kind, sign: o.roomSign });
    signKind = entered.kind === 'bar' ? 1 : entered.kind === 'tech' ? 2 : entered.kind === 'store' ? 0 : null; if (signKind !== null) { ctx.main(); apron(v, rng, a, dA - 0.3, signKind, 1, o.walk); }
    const lp = v.world(0, (dA + dB) / 2, 2.2); ctx.light(lp[0], lp[1], 9, [1, 0.82, 0.6], 0.6, pen.oy + 2.4);
    ctx.main();
  } else if (rng.chance(o.shutter ?? 0.16)) {
    pen.use(M(ST.CORRUGATED, { color: [0.3, 0.31, 0.33], seed: rng.i(0, 255) })); v.wall(0, a, b, 0, 0, gh - 0.7, { aoB: 0.6 });
  } else {
    // a trading shop: you can see what it sells and who is inside (interior-mapped storefront)
    const kind = o.shopKind ?? rng.weighted(S.shopMix || [[4, 1], [4, 0], [2, 2], [1.5, 3]]); signKind = kind;
    const nc = Math.max(1, Math.min(8, Math.round(wv / 3.4))); const u = (nextU() % 60) * 16;
    pen.use(M(ST.WIN_SHOP, { color: [0.2, 0.2, 0.22], seed: rng.i(0, 255), A: 1, B: nc + 16 * kind, cellW: wv / nc, floorH: gh - 0.7, flags: WK.COMPOSITE }));
    v.wall(0, a, b, 0, 0, gh - 0.7, { uv: [u, 0, u + nc, 1], aoB: 0.6 });
    const lp = v.world(0, (a + b) / 2, 1.8); ctx.light(lp[0], lp[1], Math.max(8, wv * 1.3), SHOP_LIGHT[kind], 0.8, pen.oy + 2.2);
    apron(v, rng, a, b, kind, nc, o.walk);
  }
  pen.use(K.conc(0.3)); v.wall(0, a, b, 0, gh - 0.7, gh);
  if (S.awning && rng.chance(0.55)) { const p = v.P(0, (a + b) / 2, 0); K.awning(ctx, p[0], gh - 0.55, p[1], 0, wv * 0.92, rng.f(1.0, 1.5), rng.pick(S.tarps || [[0.3, 0.3, 0.32]]), rng.i(0, 255)); }
  else { ctx.detail(); v.box(0, a + 0.1, b - 0.1, 0, rng.f(0.7, 1.2), gh - 0.82, gh - 0.7, K.dark(0.1)); ctx.main(); }
  if (!o.noSign) shopSign(v, 0, a, b, gh + 0.5, rng, { maxH: 1.35, maxW: 8.5, intensity: S.signI ?? 4.5, rect: signKind !== null ? ctx.atlas.pickHKind(rng, signKind) : undefined });
  return entered;
}

// ---------------------------------------------------------------------------------------------
// narrow shop-house: shop below, flats above, signage, roof clutter
export function shopHouse(ctx, rng, lot, S, o = {}) {
  const pen = ctx.penAt(lot.x, 0.2, lot.z, lot.yaw);
  const w = lot.w - 0.24, back = o.backGap ?? 0.5, d = lot.d - back, cz = back / 2;
  const fh = S.floorH ?? 3.1, gh = o.gh ?? 4.0, floors = Math.max(1, o.floors ?? 3), h = gh + floors * fh, par = 0.9;
  const v = new Vol(ctx, 0, cz, w, d, 0, h);
  const wall = wallMat(rng, S, { flags: rng.chance(S.balcony ?? 0.3) ? FLAG.VAR_A : 0, cellW: w / Math.max(1, Math.round(w / (S.cellW ?? 3.1))) });
  const party = M(ST.PLASTER, { color: dim(wall.color, 0.85), seed: wall.seed });
  const ent = shopUnit(v, rng, S, 0, w - 0.36, gh, { ...o, walk: lot.block.walk, enter: o.enter ?? rng.chance(S.enter ?? 0.3) });
  ctx.main(); v.box(0, w - 0.36, w, 0, 0.14, 0, gh, K.conc(0.33), { top: false });
  // upper floors
  facade(v, 0, gh, h, { wall, bayCells: 1, floorH: fh, aoB: 0.9, belts: floors <= 4 ? { every: 1, d: 0.13, h: 0.2, mat: K.conc(0.35), detail: true } : null });
  pen.use(party); v.wall(0, 0, w, 0, h, h + par);
  v.box(0, 0, w, 0, 0.28, h + par - 0.24, h + par, K.conc(0.32));
  facade(v, 2, 0, h, { wall: { ...wall, flags: wall.flags & 7 }, bayCells: 999, floorH: fh, aoB: 0.6 });
  pen.use(party); v.wall(2, 0, w, 0, h, h + par);
  blindWall(v, 1, 0, h + par, party, rng, { mural: rng.chance(0.1), aoB: 0.6 }); blindWall(v, 3, 0, h + par, party, rng, { mural: rng.chance(0.1), aoB: 0.6 });
  v.roof(K.conc(0.26)); if (ent) hollow(ctx, 0, cz, w, d, h, ent.room, ent.door); else v.solid();
  if (ent && o.home) { const r = ent.room; ctx.poi({ type: 'home', id: 'home', x: pen.wx((r.xa + r.xb) / 2, (r.zb + r.zf) / 2), y: pen.oy + 0.03, z: pen.wz((r.xa + r.xb) / 2, (r.zb + r.zf) / 2), name: '캡슐텔 0번지', doorX: pen.wx((ent.door.a + ent.door.b) / 2, r.zf + 2.5), doorZ: pen.wz((ent.door.a + ent.door.b) / 2, r.zf + 2.5), yaw: pen.yaw }); }
  else if (ent) { const r = ent.room; ctx.poi({ type: 'shop', kind: ent.kind, district: lot.block.district, x: pen.wx((r.xa + r.xb) / 2, (r.zb + r.zf) / 2), y: pen.oy + 0.03, z: pen.wz((r.xa + r.xb) / 2, (r.zb + r.zf) / 2), doorX: pen.wx((ent.door.a + ent.door.b) / 2, r.zf + 2.5), doorZ: pen.wz((ent.door.a + ent.door.b) / 2, r.zf + 2.5) }); }
  // projecting sign + downpipe
  if (floors >= 2 && rng.chance(S.blade ?? 0.5)) { const hgt = Math.min(4.6, fh * floors * 0.5); bladeSign(v, 0, 0.55, gh + 1.9 + hgt / 2, hgt, rng, { intensity: S.signI ?? 4.5 }); }
  ctx.detail(); v.box(0, w - 0.52, w - 0.4, 0, 0.13, gh, h, K.MAT_POLE, { bottom: false, top: false }); ctx.main();
  if (o.shanty) { // informal additions: pods hung on the facade
    const n = rng.i(0, 1 + Math.floor(floors / 2));
    for (let i = 0; i < n; i++) {
      const pw = Math.min(w - 1.4, rng.f(2.2, 3.2)); const s0 = rng.f(0.9, Math.max(0.9, w - pw - 0.5)), y = gh + rng.i(1, Math.max(1, floors - 1)) * fh;
      const u = nextU(); ctx.detail();
      v.box(0, s0, s0 + pw, 0, rng.f(0.8, 1.25), y, y + fh - 0.2, M(ST.WIN_SHANTY, { color: rng.pick(S.walls), seed: rng.i(0, 255), A: 0.6, B: PAL.WARM, cellW: pw, floorH: fh - 0.2, flags: rng.pick([WK.RIBBED, WK.RUST, WK.PLASTER]) }), { uv: [u, 0, u + 1, 1], endMat: K.rust([0.3, 0.27, 0.25]), botMat: K.dark(0.08) });
      const a = v.P(0, s0 + 0.2, 0), b2 = v.P(0, s0 + 0.2, 1.0), c = v.P(0, s0 + pw - 0.2, 0), e = v.P(0, s0 + pw - 0.2, 1.0);
      pen.use(K.MAT_POLE); pen.beam(a[0], y - 1.4, a[1], b2[0], y, b2[1], 0.08, 0.08); pen.beam(c[0], y - 1.4, c[1], e[0], y, e[1], 0.08, 0.08); ctx.main();
    }
  }
  const rf = o.roof ?? rng.weighted([[5, 'flat'], [2.2, 'pent'], [1.4, 'vault'], [1.6, 'shed']]);
  if (rf === 'flat') roofProps(ctx, rng, 0, cz, w, d, h, S.roof || ROOF_LOW, S.roofDensity ?? 1); else roofForm(ctx, rng, v, h, rf, wall);
  return finish(ctx, lot, w, d, h + par, cz);
}

// long slab block: row of shops, balconies, service core, big signs
export function tenement(ctx, rng, lot, S, o = {}) {
  const pen = ctx.penAt(lot.x, 0.2, lot.z, lot.yaw);
  const w = lot.w - 0.24, back = o.backGap ?? 1.0, d = lot.d - back, cz = back / 2;
  const fh = S.floorH ?? 3.1, gh = 4.6, floors = Math.max(3, o.floors ?? 12), h = gh + floors * fh, par = 1.1;
  const v = new Vol(ctx, 0, cz, w, d, 0, h);
  const wall = wallMat(rng, S, { flags: rng.chance(0.65) ? FLAG.VAR_A : 0, cellW: w / Math.max(2, Math.round(w / 3.2)) });
  const party = M(ST.CONCRETE, { color: dim(wall.color, 0.8), seed: wall.seed });
  const nShops = Math.max(1, Math.round(w / 7.5)); const sw = (w - 0.36) / nShops;
  const eI = rng.chance(S.enter ?? 0.3) ? rng.i(0, nShops - 1) : -1; let ent = null;
  // every block of flats needs its front door; the bigger ones also swallow vehicles
  let resI = nShops >= 2 ? Math.floor(nShops / 2) : -1; if (resI === eI) resI = (resI + 1) % nShops; let garI = -1; if (nShops >= 4 && sw >= 6.2 && d > 9 && rng.chance(0.6)) { garI = [0, nShops - 1].find((k) => k !== eI && k !== resI) ?? -1; }
  for (let i = 0; i < nShops; i++) { if (i === resI) { entryUnit(v, rng, S, i * sw, (i + 1) * sw, gh, { walk: lot.block.walk }); continue; } if (i === garI) { garageUnit(v, rng, S, i * sw, (i + 1) * sw, gh, {}); continue; } const e = shopUnit(v, rng, S, i * sw, (i + 1) * sw, gh, { ...o, walk: lot.block.walk, enter: i === eI }); if (e) ent = e; }
  ctx.main(); v.box(0, w - 0.36, w, 0, 0.14, 0, gh, K.conc(0.33), { top: false });
  const ribM = K.conc(0.34);
  facade(v, 0, gh, h, { wall, bayCells: 2, floorH: fh, aoB: 0.9, ribs: { d: 0.4, w: 0.34, mat: ribM, detail: true, over: par }, belts: { every: Math.max(2, Math.round(floors / 5)), d: 0.4, h: 0.45, mat: ribM, detail: true } });
  pen.use(party); v.wall(0, 0, w, 0, h, h + par);
  facade(v, 2, 0, h, { wall: { ...wall, flags: wall.flags & 7 }, bayCells: 999, floorH: fh, aoB: 0.6 }); pen.use(party); v.wall(2, 0, w, 0, h, h + par);
  blindWall(v, 1, 0, h + par, party, rng, { mural: rng.chance(0.4), aoB: 0.6 }); blindWall(v, 3, 0, h + par, party, rng, { mural: rng.chance(0.4), aoB: 0.6 });
  v.roof(K.conc(0.26)); if (ent) hollow(ctx, 0, cz, w, d, h, ent.room, ent.door); else v.solid();
  // roof-top service core
  const cw = Math.min(6, w * 0.3), cd = Math.min(5, d * 0.4), cx = rng.f(-0.25, 0.25) * w;
  pen.box(cx, cz, cw, cd, h, h + 4.2, { wall: M(ST.WIN_SLIT, { color: dim(wall.color, 0.8), seed: wall.seed, A: 0.7, B: PAL.COOL, cellW: 2, floorH: 4.2, flags: WK.CONCRETE }), roof: K.conc(0.25) });
  ctx.propL(rng.chance(0.5) ? 'mast' : 'tank', cx, h + 4.2, cz, rng.f(0, 6.28), rng.f(0.6, 0.9));
  // second floor tenants' signs + a tall blade
  for (let i = 0; i < nShops; i++) if (i !== garI && rng.chance(S.upperSigns ?? 0.3)) shopSign(v, 0, i * sw + 0.8, (i + 1) * sw - 0.3, gh + fh + 0.75, rng, { maxH: 1.1, maxW: 6, intensity: S.signI ?? 4 });
  if (rng.chance(S.blade ?? 0.6)) { const hgt = Math.min(13, h * 0.3); bladeSign(v, 0, 0.6, gh + fh * 2 + 1.5 + hgt / 2, hgt, rng, { intensity: S.signI ?? 4.5, radius: 26, power: 0.7 }); }
  if (o.shanty) {
    const n = rng.i(1, 5);
    for (let i = 0; i < n; i++) {
      const pw = rng.f(2.6, 4.2); const s0 = rng.f(1.2, Math.max(1.3, w - pw - 0.6)), y = gh + rng.i(2, Math.max(2, floors - 1)) * fh; const u = nextU(); ctx.detail();
      v.box(0, s0, s0 + pw, 0, rng.f(1.0, 1.6), y, y + fh * rng.pick([1, 1, 2]) - 0.2, M(ST.WIN_SHANTY, { color: rng.pick(S.walls), seed: rng.i(0, 255), A: 0.6, B: PAL.WARM, cellW: pw, floorH: fh - 0.2, flags: rng.pick([WK.RIBBED, WK.RUST]) }), { uv: [u, 0, u + 1, 1], endMat: K.rust([0.3, 0.27, 0.25]), botMat: K.dark(0.08) }); ctx.main();
    }
  }
  roofProps(ctx, rng, 0, cz, w, d, h, S.roof || ROOF_LOW, 0.8);
  return finish(ctx, lot, w, d, h + par, cz);
}

// --- shared futuristic attachments -------------------------------------------------------------
// cantilevered landing pad on face f
export function landingPad(v, f, s, y, size, rng, o = {}) {
  const ctx = v.ctx, pen = v.pen; const c = v.P(f, s, size / 2 + 0.6);
  ctx.main(); pen.use(K.dark(0.14));
  const pts = ngonPts(size / 2, 8, c[0], c[1], Math.PI / 8);
  pen.loft([{ y: y - 0.6, pts: scalePts(pts, 0.8, c[0], c[1]) }, { y: y - 0.12, pts }, { y, pts }], { roof: M(ST.COMPOSITE, { color: [0.22, 0.23, 0.26] }), capBottom: true });
  const a = v.P(f, s - size * 0.3, 0), b = v.P(f, s - size * 0.3, size * 0.7), a2 = v.P(f, s + size * 0.3, 0), b2 = v.P(f, s + size * 0.3, size * 0.7);
  pen.use(K.dark(0.1)); pen.beam(a[0], y - size * 0.45, a[1], b[0], y - 0.5, b[1], 0.3, 0.3); pen.beam(a2[0], y - size * 0.45, a2[1], b2[0], y - 0.5, b2[1], 0.3, 0.3);
  const col = o.color || K.NEON.cyan; const em = K.emis(col, 7, 0, true, rng.i(0, 255)); em.flags |= 8;
  pen.use(em); pen.lathe(c[0], c[1], [[size / 2 - 0.25, y + 0.02], [size / 2 - 0.25, y + 0.1]], 8, { cap: false });
  pen.use(K.emis([1, 1, 1], 3, 0, true)); pen.flat(c[0] - size * 0.22, c[1] - 0.12, c[0] + size * 0.22, c[1] + 0.12, y + 0.02); pen.flat(c[0] - 0.12, c[1] - size * 0.22, c[0] + 0.12, c[1] + size * 0.22, y + 0.02);
  ctx.solid(c[0], c[1], size * 0.8, size * 0.8, y - 0.6, y);
  const wx = pen.wx(c[0], c[1]), wz = pen.wz(c[0], c[1]);
  ctx.spark(wx, pen.oy + y, wz, col, 3, 1.2);
  ctx.poi({ type: 'pad', x: wx, y: pen.oy + y, z: wz, size });
  if (rng.chance(o.car ?? 0.3)) ctx.propL('hovercar', c[0], y + 0.02, c[1], rng.f(0, 6.28), 1, [rng.f(0.6, 1.4), rng.f(0.6, 1.2), rng.f(0.6, 1.4)]);
}
// external glass lift tube on face f at s
export function liftTube(v, f, s, y0, y1, rng, col = K.NEON.ice) {
  const pen = v.pen; const A = FACE_ANG[f]; const an = Math.atan2(-Math.cos(A), Math.sin(A)); const c = v.P(f, s, 0); const r = 1.7;
  v.ctx.main(); pen.use(K.glassDark([0.3, 0.42, 0.5])); pen.lathe(c[0], c[1], [[r, y0], [r, y1]], 8, { a0: an - Math.PI / 2, a1: an + Math.PI / 2, cap: false });
  const e = v.P(f, s, r + 0.04); pen.use(K.emis(K.mixW(col, 0.5), 2.2, 3, false, rng.i(0, 255))); pen.beam(e[0], y0, e[1], e[0], y1, e[1], 0.16, 0.1);
  pen.use(K.dark(0.1)); for (let y = y0 + 12; y < y1; y += 24) pen.lathe(c[0], c[1], [[r + 0.12, y], [r + 0.12, y + 0.5]], 8, { a0: an - Math.PI / 2, a1: an + Math.PI / 2, cap: false });
}
// crown treatments
export function crownFins(v, y, hgt, rng, acc) {
  const pen = v.pen; const fm = K.dark(0.12); v.ctx.main();
  for (const f of [0, 2]) { const L = v.len(f); const n = Math.max(3, Math.round(L / 4.5)); for (let i = 0; i < n; i++) { const s = (i + 0.5) * (L / n); const k = 0.55 + 0.45 * Math.sin(((i + 0.5) / n) * Math.PI); v.box(f, s - 0.3, s + 0.3, -v.len(f + 1) * 0.5 + 0.2 > 0 ? 0 : -1.2, 0.4, y, y + hgt * k, fm, { bottom: false }); } }
  const wx = pen.wx(v.cx, v.cz), wz = pen.wz(v.cx, v.cz); v.ctx.spark(wx, pen.oy + y + 2, wz, acc, 5, 1.6);
}
export function crownSpire(v, y, hgt, rng, acc) {
  const pen = v.pen; v.ctx.main(); const r = Math.min(v.w, v.d) * 0.16;
  pen.use(K.dark(0.14)); pen.lathe(v.cx, v.cz, [[r * 2.2, y], [r * 1.5, y + hgt * 0.12], [r, y + hgt * 0.2], [r * 0.5, y + hgt * 0.62], [0.25, y + hgt]], 8, { cap: false });
  pen.use(K.lamps(K.mixW(acc, 0.5), 7, rng.i(0, 255))); pen.lathe(v.cx, v.cz, [[r * 1.05, y + hgt * 0.24], [r * 0.9, y + hgt * 0.3]], 8, { cap: false }); pen.lathe(v.cx, v.cz, [[r * 0.62, y + hgt * 0.52], [r * 0.56, y + hgt * 0.56]], 8, { cap: false });
  pen.use(K.emis(K.NEON.red, 22, 2, false, rng.i(0, 255))); pen.lathe(v.cx, v.cz, [[0.4, y + hgt], [0.4, y + hgt + 0.8], [0.05, y + hgt + 1.1]], 6, {});
  const wx = pen.wx(v.cx, v.cz), wz = pen.wz(v.cx, v.cz); v.ctx.spark(wx, pen.oy + y + hgt, wz, K.NEON.red, 5, 2); v.ctx.spark(wx, pen.oy + y + hgt * 0.3, wz, acc, 6, 1.6);
}
export function haloRing(v, y, rng, acc, k = 0.72) {
  const pen = v.pen; v.ctx.main(); const r = Math.max(v.w, v.d) * k;
  pen.use(K.dark(0.1)); pen.lathe(v.cx, v.cz, [[r - 0.9, y], [r + 0.7, y + 0.2], [r + 0.7, y + 1.5], [r - 0.9, y + 1.7]], 20, { cap: false });
  pen.lathe(v.cx, v.cz, [[r - 0.9, y + 1.7], [r - 0.9, y]], 20, { cap: false });
  pen.use(K.lamps(K.mixW(acc, 0.5), 7, rng.i(0, 255))); pen.lathe(v.cx, v.cz, [[r + 0.74, y + 0.6], [r + 0.74, y + 1.1]], 20, { cap: false });
  pen.use(K.dark(0.1)); for (let i = 0; i < 4; i++) { const a = i * 1.5708 + 0.785; pen.beam(v.cx + Math.cos(a) * Math.min(v.w, v.d) * 0.45, y + 0.8, v.cz + Math.sin(a) * Math.min(v.w, v.d) * 0.45, v.cx + Math.cos(a) * (r - 0.8), y + 0.8, v.cz + Math.sin(a) * (r - 0.8), 0.5, 0.5); }
  v.ctx.light(pen.wx(v.cx, v.cz), pen.wz(v.cx, v.cz), r * 3, acc, 0.35, pen.oy + y);
}

// ---------------------------------------------------------------------------------------------
// futuristic mid/high-rise: colonnaded base, louvred plant floor, ribbed shaft with light slots, setback, crown
export function techTower(ctx, rng, lot, S, o = {}) {
  const pen = ctx.penAt(lot.x, 0.2, lot.z, lot.yaw);
  const side = lot.corner || o.free ? 0.6 : 0.12; const w = lot.w - side * 2, back = o.backGap ?? 1.2, d = lot.d - back, cz = back / 2;
  const fh = S.floorH ?? 4.0; const H = o.h ?? 120; const acc = o.brand && ctx.atlas.corp[o.brand] ? ctx.atlas.corp[o.brand].color : rng.pick(S.accents);
  const bh = rng.pick([9, 12, 14]); const mh = 3.6;
  const allFaces = lot.corner || o.free || H > 160;
  // --- base with colonnade + portal
  const base = new Vol(ctx, 0, cz, w, d, 0, bh);
  const baseM = M(ST.WIN_LUX, { color: [0.18, 0.19, 0.22], seed: rng.i(0, 255), A: 0.95, B: rng.pick(S.lights), cellW: 4.2, floorH: bh / Math.round(bh / 4.5), flags: WK.COMPOSITE });
  const colM = M(ST.COMPOSITE, { color: dim(rng.pick(S.walls), 0.8), seed: rng.i(0, 255) });
  const cellsB = Math.max(1, Math.round(w / 4.2)), bayWB = (w / cellsB) * Math.min(cellsB, 2), baysB = Math.ceil(cellsB / 2); const sC = (Math.floor(baysB / 2) + 0.5) * bayWB;
  const hasLobby = w >= 15 && d >= 16 && sC > 5 && w - sC > 5; const doorHW = Math.min(2.4, bayWB / 2 - 1.0);
  const bi = facade(base, 0, 0, bh, { wall: baseM, cellW: 4.2, bayCells: 2, floorH: bh / Math.round(bh / 4.5), aoB: 0.55, ribs: { d: 0.9, w: 1.0, mat: colM }, door: hasLobby ? { s: sC, hw: doorHW, h: 4.6 } : null });
  for (const f of [1, 2, 3]) { if (f !== 2 && !allFaces) blindWall(base, f, 0, bh, colM, rng, { aoB: 0.55 }); else facade(base, f, 0, bh, { wall: baseM, cellW: 4.2, bayCells: 99, floorH: bh / Math.round(bh / 4.5), aoB: 0.55 }); }
  // entrance portal: glowing frame around the centre bay
  { const s0 = Math.floor(bi.bays / 2) * bi.bayW + 0.6, s1 = s0 + bi.bayW - 1.2; ctx.main(); const em = K.emis(acc, 6, 0, false);
    base.box(0, s0 - 0.25, s0, 0, 0.5, 0, 6.2, em, { bottom: false }); base.box(0, s1, s1 + 0.25, 0, 0.5, 0, 6.2, em, { bottom: false }); base.box(0, s0 - 0.25, s1 + 0.25, 0, 0.5, 6.2, 6.5, em);
    ctx.detail(); base.box(0, s0 - 1.5, s1 + 1.5, 0, 2.6, 6.6, 6.85, K.dark(0.1)); ctx.main();
    const lp = base.world(0, (s0 + s1) / 2, 3); ctx.light(lp[0], lp[1], 22, acc, 0.7, 4);
    const rect = o.brand && ctx.atlas.corp[o.brand] ? ctx.atlas.corp[o.brand].word : null;
    shopSign(base, 0, s0 - 2, s1 + 2, bh - 1.6, rng, { rect: rect || undefined, maxH: 1.8, maxW: 11, intensity: 4 }); }
  if (hasLobby) { const lw = Math.min(20, 2 * Math.min(sC - 1.2, w - sC - 1.2)); const lb = lobby(ctx, rng, -w / 2 + sC, cz + d / 2, { w: lw, d: Math.min(d * 0.55, 15), h: bh - 0.8, doorHW, doorH: 4.6, accent: acc, logo: o.brand && ctx.atlas.corp[o.brand] ? ctx.atlas.corp[o.brand].logo : null, brand: o.brand }); hollow(ctx, 0, cz, w, d, bh, lb.room, lb.door); ctx.main(); } else base.solid();
  if (rng.chance(S.bands ?? 0.25)) K.neonBand(ctx, 0, cz, w, d, bh - 0.35, acc, { intensity: 5, light: false, lamps: true, seed: rng.i(0, 255), sides: allFaces ? 15 : 1, h: 0.45 });
  // --- plant floor (louvres)
  const lv = { st: ST.LOUVER, color: [0.26, 0.27, 0.29] };
  const plant = new Vol(ctx, 0, cz, w - 1.2, d - 1.2, bh, bh + mh);
  pen.use(lv); for (const f of [0, 1, 2, 3]) plant.wall(f, 0, plant.len(f), 0, bh, bh + mh);
  const form = o.form ?? pickForm(rng, S, w, d, H, lot);
  if (form !== 'slab' && FORMS[form]) { // a different typology on the same base
    plant.y1 = bh + mh; plant.roof(K.conc(0.24)); ctx.solid(0, cz, w - 1.2, d - 1.2, bh, bh + mh);
    FORMS[form](ctx, rng, { w: w - 1.2, d: d - 1.2, cz, y0: bh + mh, H, S, acc, fh, lot, o }); ctx.main();
    return finish(ctx, lot, w, d, H, cz);
  }
  // --- shaft (with optional setback)
  const setY = bh + mh + Math.round((H - bh - mh) * rng.f(0.55, 0.8) / fh) * fh; const hasSet = H > 70 && rng.chance(0.7);
  const wallA = wallMat(rng, S, { st: rng.pick(S.towerWin || [ST.WIN_RIBBON, ST.WIN_OFFICE]), floorH: fh, cellW: S.towerCell ?? 3.0 });
  const ribM = M(ST.COMPOSITE, { color: dim(wallA.color, 0.7), seed: wallA.seed });
  const slots = new Set(); const nb = Math.max(2, Math.round(w / (wallA.cellW * 2))); if (nb >= 4 && rng.chance(0.75)) { slots.add(rng.i(1, nb - 2)); if (nb > 6) slots.add(rng.i(1, nb - 2)); }
  const drawShaft = (vol, y0, y1, withSlots) => {
    for (const f of [0, 1, 2, 3]) {
      const rich = f === 0 || allFaces;
      if (!rich && f !== 2) { blindWall(vol, f, y0, y1, M(ST.COMPOSITE, { color: dim(wallA.color, 0.75), seed: wallA.seed }), rng, { mural: rng.chance(0.25) }); continue; }
      const info = facade(vol, f, y0, y1, {
        wall: wallA, bayCells: 2, floorH: fh, depth: f === 0 && withSlots ? (b) => (slots.has(b) ? -1.6 : 0) : null, jamb: ribM,
        ribs: rich && f !== 2 ? { d: rng.f(0.45, 1.0), w: 0.5, mat: ribM, every: f === 0 ? 1 : 2, detail: f !== 0 } : null,
        belts: rich ? { every: Math.max(4, Math.round(8 * rng.f(0.7, 1.3))), d: 0.5, h: 0.7, mat: ribM, detail: true } : null,
      });
      if (f === 0 && withSlots && info) for (const b of slots) { const s = (b + 0.5) * info.bayW; const p = vol.P(0, s, -1.45); pen.use(K.emis(K.mixW(acc, 0.65), 1.6, 3, true, rng.i(0, 255))); pen.beam(p[0], y0 + 1, p[1], p[0], y1 - 1, p[1], 0.3, 0.1); }
    }
  };
  const shaft = new Vol(ctx, 0, cz, w, d, bh + mh, hasSet ? setY : H);
  drawShaft(shaft, bh + mh, hasSet ? setY : H, true); shaft.solid();
  let top = shaft, topY = hasSet ? setY : H;
  if (hasSet) {
    shaft.roof(K.conc(0.25));
    const inset = rng.f(2.5, Math.min(7, w * 0.14));
    const up = new Vol(ctx, 0, cz + rng.f(-1, 1) * inset * 0.4, w - inset * 2, d - inset * 2, setY, H);
    drawShaft(up, setY, H, false); up.solid(); top = up; topY = H;
    if (rng.chance(0.5)) { ctx.detail(); pen.use(K.foliage([0.24, 0.44, 0.22])); pen.box(0, cz + d / 2 - inset * 0.5, w - 1, inset * 0.6, setY, setY + 0.9, {}); ctx.main(); }
    else roofProps(ctx, rng, 0, cz + d / 2 - inset / 2, w, inset, setY, ROOF_TECH, 0.6, 4.2);
    if (rng.chance(S.bands ?? 0.25)) K.neonBand(ctx, 0, cz, w, d, setY - 0.3, acc, { intensity: 5, light: false, lamps: true, seed: rng.i(0, 255), sides: allFaces ? 15 : 1, h: 0.45 });
  }
  top.y1 = topY; top.roof(K.conc(0.24));
  // --- crown
  const ck = rng.next();
  if (ck < 0.18) crownFins(top, topY, rng.f(6, 16), rng, acc);
  else if (ck < 0.36 && H > 140) crownSpire(top, topY, rng.f(22, 60), rng, acc);
  else if (ck < 0.42 && (lot.corner || o.free)) { haloRing(top, topY - 3, rng, acc, 0.6); roofProps(ctx, rng, top.cx, top.cz, top.w, top.d, topY, ROOF_TECH, 0.7); }
  else { roofProps(ctx, rng, top.cx, top.cz, top.w, top.d, topY, ROOF_TECH, 1); pen.use(K.lamps(K.mixW(acc, 0.55), 6, rng.i(0, 255))); const f0 = top.P(0, 0, 0.05); for (const f of allFaces ? [0, 1, 2, 3] : [0]) top.box(f, 0.5, top.len(f) - 0.5, 0, 0.12, topY - 0.9, topY - 0.6, null, { ends: false, top: false, bottom: false }); }
  // --- attachments on the front
  if (H > 60 && rng.chance(S.pads ?? 0.3)) landingPad(shaft, 0, rng.f(0.25, 0.75) * w, bh + mh + Math.round(rng.f(0.25, 0.7) * (shaft.y1 - bh - mh) / fh) * fh, Math.min(11, lot.block.sw * 0.4, w * 0.4), rng, { color: acc });
  if (H > 80 && rng.chance(0.3) && !slots.size) liftTube(shaft, 0, w * rng.pick([0.2, 0.8]), bh, shaft.y1, rng, acc);
  if (rng.chance(S.screens ?? 0.2) && w > 20) { const sw2 = Math.min(w * 0.5, 22), sh = sw2 * rng.f(0.5, 1.4); const y0 = bh + mh + 6; screenWall(shaft, 0, w / 2 - sw2 / 2, w / 2 + sw2 / 2, y0, Math.min(shaft.y1 - 4, y0 + sh), rng); }
  if (H > 90 && o.brand && ctx.atlas.corp[o.brand] && rng.chance(0.7)) { // skyline branding near the top
    const lg = ctx.atlas.corp[o.brand].logo; const sz = Math.min(top.w * 0.5, 16); const p = top.P(0, top.w / 2, 0.6); ctx.main(); pen.sign(p[0], topY - sz * 0.75, p[1], 0, sz, sz, lg, { intensity: 5, seed: rng.i(0, 255) });
    const wp = top.world(0, top.w / 2, 3); ctx.spark(wp[0], pen.oy + topY - sz * 0.75, wp[1], ctx.atlas.corp[o.brand].color, 7, 2.2);
  }
  ctx.spark(pen.wx(0, cz), pen.oy + H * 0.6, pen.wz(0, cz), [1, 0.8, 0.6], 4, 0.8);
  return finish(ctx, lot, w, d, H, cz);
}

// megatower on a whole block: cruciform bundle of shafts on a podium, megabraces, sky lobbies, spire
export function megaTower(ctx, rng, lot, S, o = {}) {
  const pen = ctx.penAt(lot.x, 0.2, lot.z, lot.yaw);
  const W = Math.min(lot.w, 150) - 6, Dd = Math.min(lot.d, 130) - 6; const H = o.h ?? 500; const fh = 4.2; const acc = o.brand && ctx.atlas.corp[o.brand] ? ctx.atlas.corp[o.brand].color : rng.pick(S.accents);
  const ph = rng.f(22, 34);
  // podium
  const pod = new Vol(ctx, 0, 0, W, Dd, 0, ph);
  const podM = M(ST.WIN_LUX, { color: [0.16, 0.17, 0.2], seed: rng.i(0, 255), A: 0.9, B: rng.pick(S.lights), cellW: 5, floorH: ph / Math.round(ph / 5.5), flags: WK.COMPOSITE });
  const frameM = M(ST.COMPOSITE, { color: dim(rng.pick(S.walls), 0.7), seed: rng.i(0, 255) });
  for (const f of [0, 1, 2, 3]) facade(pod, f, 0, ph, { wall: podM, cellW: 5, bayCells: 2, floorH: ph / Math.round(ph / 5.5), aoB: 0.5, ribs: { d: 1.4, w: 1.4, mat: frameM }, belts: { every: 99, d: 1, h: 1, mat: frameM }, door: f === 0 ? { s: W / 2, hw: 6.4, h: 12.6 } : null });
  pod.roof(M(ST.TILE, { color: [0.3, 0.31, 0.34] }));
  { const lb = lobby(ctx, rng, 0, Dd / 2, { w: Math.min(46, W - 20), d: Math.min(36, Dd * 0.4), h: Math.min(16, ph - 3), doorHW: 6.4, doorH: 12.6, accent: acc, logo: o.brand && ctx.atlas.corp[o.brand] ? ctx.atlas.corp[o.brand].logo : null, brand: o.brand, name: (o.brand ? o.brand.toUpperCase() + ' ' : '') + '타워 로비' }); hollow(ctx, 0, 0, W, Dd, ph, lb.room, lb.door); ctx.main(); }
  K.neonBand(ctx, 0, 0, W, Dd, ph - 0.6, acc, { intensity: 7, radius: 40, power: 0.5, lamps: true, h: 0.8, main: true });
  for (const f of [0, 2]) { const L = pod.len(f); const em = K.emis(acc, 7, 0, false); ctx.main(); pod.box(f, L / 2 - 7, L / 2 - 6.5, 0, 1.6, 0, 13, em, { bottom: false }); pod.box(f, L / 2 + 6.5, L / 2 + 7, 0, 1.6, 0, 13, em, { bottom: false }); pod.box(f, L / 2 - 7, L / 2 + 7, 0, 1.6, 13, 13.6, em); const lp = pod.world(f, L / 2, 6); ctx.light(lp[0], lp[1], 46, acc, 1.0, 8); }
  if (o.brand && ctx.atlas.corp[o.brand]) { const r = ctx.atlas.corp[o.brand].word; for (const f of [0, 2]) shopSign(pod, f, pod.len(f) / 2 - 12, pod.len(f) / 2 + 12, ph - 5, rng, { rect: r, maxH: 4.5, maxW: 22, intensity: 5, out: 1.7, radius: 50 }); }
  if (rng.chance(0.6)) screenWall(pod, rng.pick([1, 3]), 8, pod.len(1) - 8, 6, ph - 6, rng, { intensity: 3 });
  const kind = o.kind ?? rng.weighted([[5, 'bundle'], [2.5, 'needle'], [2.5, 'zigg']]);
  if (kind !== 'bundle') {
    MEGA[kind](ctx, rng, { W, Dd, ph, H, S, acc, fh, brand: o.brand }); ctx.main();
    ctx.shade(lot.x, lot.z, Math.max(W, Dd) * 0.8 + 90, 0.82); ctx.footprint(0, 0, W, Dd, 0, H, lot.block.id); ctx.stats.buildings++; lot.h = H;
    ctx.poi({ type: 'tower', x: lot.x, y: 0.2, z: lot.z, h: H, brand: o.brand }); return H;
  }
  // core + wings
  const cw = W * rng.f(0.42, 0.52), cd = Dd * rng.f(0.42, 0.52);
  const wallA = wallMat(rng, S, { st: rng.pick(S.towerWin || [ST.WIN_OFFICE]), floorH: fh, cellW: 3.2 });
  const wallB = { ...wallA, st: rng.pick([ST.WIN_RIBBON, ST.WIN_OFFICE]), color: dim(rng.pick(S.walls), 0.9), seed: rng.i(0, 255) };
  const coreY1 = ph + Math.round((H - ph) / fh) * fh;
  const core = new Vol(ctx, 0, 0, cw, cd, ph, coreY1);
  const lobbies = []; for (let y = ph + 26 * fh; y < coreY1 - 12 * fh; y += Math.round(rng.f(22, 34)) * fh) lobbies.push(y);
  const seg = (vol, wm, y0, y1, ribEvery) => { for (const f of [0, 1, 2, 3]) facade(vol, f, y0, y1, { wall: wm, bayCells: 2, floorH: fh, jamb: frameM, ribs: { d: 0.9, w: 0.7, mat: frameM, every: ribEvery }, belts: { every: 10, d: 0.6, h: 0.9, mat: frameM, detail: true } }); };
  // core segments separated by dark sky-lobby bands
  { let y = ph; const ys = [...lobbies, coreY1];
    for (const ly of ys) { seg(core, wallA, y, ly, 2); if (ly < coreY1) { const lob = new Vol(ctx, 0, 0, cw - 2.4, cd - 2.4, ly, ly + fh * 2); pen.use(K.glassDark([0.2, 0.25, 0.3])); for (const f of [0, 1, 2, 3]) lob.wall(f, 0, lob.len(f), 0, ly, ly + fh * 2); pen.use(K.emis(acc, 5, 0, true)); for (const f of [0, 1, 2, 3]) lob.box(f, 0, lob.len(f), 0, 0.1, ly + fh * 2 - 0.5, ly + fh * 2 - 0.2, null, { ends: false, top: false, bottom: false }); pen.use(frameM); pen.flat(-cw / 2, -cd / 2, cw / 2, cd / 2, ly, false, 0.5); pen.flat(-cw / 2, -cd / 2, cw / 2, cd / 2, ly + fh * 2, true); ctx.spark(pen.wx(0, 0), pen.oy + ly + fh, pen.wz(0, 0), acc, 6, 1.4); y = ly + fh * 2; } }
  }
  core.solid(); core.roof(K.conc(0.24));
  // four wings of different heights
  const wings = [];
  for (const f of [0, 1, 2, 3]) {
    const along = f % 2 === 0 ? cw * rng.f(0.55, 0.8) : cd * rng.f(0.55, 0.8); const out = (f % 2 === 0 ? (Dd - cd) / 2 : (W - cw) / 2) - rng.f(2, 6);
    if (out < 6) continue;
    const wh = ph + Math.round(((H - ph) * rng.f(0.4, 0.88)) / fh) * fh;
    const c = core.P(f, core.len(f) / 2, out / 2);
    const wv = f % 2 === 0 ? new Vol(ctx, c[0], c[1], along, out, ph, wh) : new Vol(ctx, c[0], c[1], out, along, ph, wh);
    for (const g of [0, 1, 2, 3]) { if (g === (f + 2) % 4) continue; facade(wv, g, ph, wh, { wall: wallB, bayCells: 2, floorH: fh, jamb: frameM, ribs: g === f ? { d: 0.8, w: 0.6, mat: frameM } : null, belts: { every: 12, d: 0.5, h: 0.8, mat: frameM, detail: true } }); }
    wv.roof(K.conc(0.24)); wv.solid(); wings.push({ f, wv, wh });
    // megabrace on the outer face + light slots in the re-entrant corners
    { const L = wv.len(f); const n = Math.max(1, Math.round((wh - ph) / 70)); const dh = (wh - ph) / n; pen.use(frameM); for (let i = 0; i < n; i++) { const a = wv.P(f, 0.3, 0.7), b = wv.P(f, L - 0.3, 0.7); pen.beam(a[0], ph + i * dh, a[1], b[0], ph + (i + 1) * dh, b[1], 1.3, 1.3); pen.beam(b[0], ph + i * dh, b[1], a[0], ph + (i + 1) * dh, a[1], 1.3, 1.3); } }
    { const e = K.emis(acc, 5, 3, true, rng.i(0, 255)); pen.use(e); const p1 = core.P(f, core.len(f) / 2 - along / 2 - 0.5, 0.3), p2 = core.P(f, core.len(f) / 2 + along / 2 + 0.5, 0.3); void e; void p1; void p2; }
    if (rng.chance(0.75)) landingPad(wv, f, wv.len(f) * rng.pick([0.3, 0.7]), ph + Math.round(((wh - ph) * rng.f(0.35, 0.8)) / fh) * fh, 12, rng, { color: acc, car: 0.5 });
    roofProps(ctx, rng, wv.cx, wv.cz, wv.w, wv.d, wh, ROOF_TECH, 0.8, 5.2);
    if (rng.chance(0.5)) { ctx.detail(); pen.use(K.foliage([0.22, 0.42, 0.2])); const q = wv.P(f, wv.len(f) / 2, -1.2); pen.box(q[0], q[1], f % 2 === 0 ? along - 2 : 1.6, f % 2 === 0 ? 1.6 : along - 2, wh, wh + 1.0, {}); ctx.main(); }
  }
  // crown
  haloRing(core, coreY1 - 10, rng, acc, 0.62);
  crownSpire(core, coreY1, Math.min(140, H * rng.f(0.12, 0.22)), rng, acc);
  if (o.brand && ctx.atlas.corp[o.brand]) { const lg = ctx.atlas.corp[o.brand].logo; const sz = Math.min(cw * 0.6, 26); for (const f of [0, 2]) { const p = core.P(f, cw / 2, 1.0); pen.sign(p[0], coreY1 - 18 - sz / 2, p[1], FACE_ANG[f], sz, sz, lg, { intensity: 6, seed: rng.i(0, 255) }); const wp = core.world(f, cw / 2, 4); ctx.spark(wp[0], pen.oy + coreY1 - 20 - sz / 2, wp[1], ctx.atlas.corp[o.brand].color, 9, 2.6); } }
  // vertical light pillar from the crown
  ctx.glow.cone(pen.wx(0, 0), pen.oy + coreY1 + 4, pen.wz(0, 0), 0, 1, 0, 420, 1.2, 7, [1, 0.95, 0.9], 0.03, { segs: 10, seed: rng.i(0, 50) });
  for (let y = ph + 60; y < coreY1; y += 110) ctx.spark(pen.wx(0, 0), pen.oy + y, pen.wz(0, 0), [1, 0.85, 0.65], 6, 1.0);
  ctx.shade(lot.x, lot.z, Math.max(W, Dd) * 0.8 + 90, 0.82); ctx.footprint(0, 0, W, Dd, 0, H, lot.block.id); ctx.stats.buildings++; lot.h = H;
  ctx.poi({ type: 'tower', x: lot.x, y: 0.2, z: lot.z, h: H, brand: o.brand });
  return H;
}
export { ROOF_LOW, ROOF_TECH };
