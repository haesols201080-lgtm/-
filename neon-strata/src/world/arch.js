// Tower archetypes (pen frame, ground at local y=0). Each registers colliders + sky occlusion.
import { ST, PAL } from '../render/cityMaterial.js';
import { M, rectPts, ngonPts, scalePts, rotPts } from './builder.js';
import * as K from './kit.js';

// district palette: { glass:[[r,g,b]..], lights:[PAL..], accents:[[r,g,b]..], frame:[r,g,b], styles:[ST..] }
export function facadeMat(rng, pal, o = {}) {
  const st = o.st ?? rng.pick(pal.styles || [ST.WIN_CURTAIN]);
  const curtain = st === ST.WIN_CURTAIN;
  return M(st, {
    color: o.color || rng.pick(curtain ? pal.glass : (pal.walls || pal.glass)), seed: rng.i(0, 255), A: o.lit ?? rng.f(pal.litMin ?? 0.35, pal.litMax ?? 0.8), B: o.light ?? rng.pick(pal.lights),
    cellW: o.cellW ?? (curtain ? rng.f(2.6, 3.6) : rng.f(2.8, 4.2)), floorH: o.floorH ?? rng.f(3.6, 4.4), flags: o.flags ?? rng.pick(pal.wallKinds || [1, 3]),
  });
}
const done = (ctx, w, d, h) => { ctx.shade(ctx.pen.ox, ctx.pen.oz, Math.max(w, d) * 0.75 + h * 0.22, Math.min(0.78, h / 300 + 0.2)); ctx.stats.buildings++; };

export function crown(ctx, rng, kind, cx, cz, w, d, y, pal, o = {}) {
  const pen = ctx.main(); const acc = o.accent || rng.pick(pal.accents);
  const frame = K.dark(0.12);
  if (kind === 'mast') {
    pen.box(cx, cz, w * 0.5, d * 0.5, y, y + 5, { wall: frame, roof: frame });
    K.antenna(ctx, cx, cz, y + 5, o.h ?? rng.f(25, 70), { r: 0.7 });
  } else if (kind === 'halo') { // floating ring of light around the top
    const r = Math.max(w, d) * 0.62;
    pen.use(K.emis(acc, 9, 0, true)); pen.lathe(cx, cz, [[r, y - 3], [r + 0.5, y - 2.2], [r, y - 1.4]], 20, { cap: false });
    pen.use(frame); for (let i = 0; i < 4; i++) { const a = i * 1.5708 + 0.785; pen.beam(cx, y - 2.2, cz, cx + Math.cos(a) * r, y - 2.2, cz + Math.sin(a) * r, 0.3, 0.3); }
    ctx.light(pen.wx(cx, cz), pen.wz(cx, cz), r * 3.2, acc, 0.5);
    K.rooftop(ctx, rng, cx, cz, w, d, y, { mast: 0.5 });
  } else if (kind === 'slope') { // wedge roof with light slot
    const hgt = o.h ?? Math.min(w, d) * rng.f(0.5, 1.1);
    pen.use(o.wall || frame);
    pen.loft([{ y, pts: rectPts(w, d, cx, cz) }, { y: y + hgt, pts: [[cx - w / 2, cz + d / 2], [cx + w / 2, cz + d / 2], [cx + w / 2, cz + d / 2 - 0.5], [cx - w / 2, cz + d / 2 - 0.5]] }], { roof: frame });
    pen.use(K.emis(acc, 10, 0, true)); pen.box(cx, cz + d / 2 + 0.15, w * 0.96, 0.25, y + hgt - 1.2, y + hgt - 0.5, {});
  } else if (kind === 'fins') { // comb of tall blades
    const n = Math.max(3, Math.round(w / 3.5)), hgt = o.h ?? rng.f(8, 20);
    for (let i = 0; i < n; i++) { const x = cx - w / 2 + (w * (i + 0.5)) / n; pen.box(x, cz, 0.5, d, y, y + hgt * (0.6 + 0.4 * Math.sin((i / (n - 1)) * 3.14)), { wall: frame, roof: frame }); }
    pen.use(K.emis(acc, 7, 0, true)); pen.box(cx, cz, w * 0.9, d * 0.5, y + 0.2, y + 0.6, {});
  } else if (kind === 'beacon') {
    pen.box(cx, cz, w * 0.6, d * 0.6, y, y + 4, { wall: frame, roof: frame });
    pen.use(K.emis(acc, 16, 3)); pen.lathe(cx, cz, [[Math.min(w, d) * 0.16, y + 4], [Math.min(w, d) * 0.12, y + 4 + Math.min(w, d) * 0.6]], 8, {});
    ctx.light(pen.wx(cx, cz), pen.wz(cx, cz), 60, acc, 0.5);
  } else { K.rooftop(ctx, rng, cx, cz, w, d, y, { mast: 0.4 }); }
  ctx.main();
}

// retail / lobby podium with sign band
export function podium(ctx, rng, w, d, h, pal, o = {}) {
  const pen = ctx.main();
  const base = M(ST.WIN_RIBBON, { color: o.color || [0.2, 0.2, 0.22], seed: rng.i(0, 255), A: 0.9, B: rng.pick(pal.lights), cellW: 4.5, floorH: h / Math.max(1, Math.round(h / 5)), flags: 3 });
  pen.box(0, 0, w, d, 0, h, { wall: base, roof: K.pave(0.35, true), aoB: 0.55 });
  ctx.solid(0, 0, w, d, 0, h);
  const acc = rng.pick(pal.accents);
  K.neonBand(ctx, 0, 0, w, d, h - 0.5, acc, { intensity: 8, radius: Math.max(26, Math.min(w, d) * 0.9), power: 0.55, nightOnly: true });
  if (o.signs !== false) {
    const n = rng.i(1, 3);
    for (let i = 0; i < n; i++) { const f = rng.i(0, 3); const [sx, sz, ang] = facePt(f, 0, 0, w, d, rng.f(-0.3, 0.3)); K.wallSign(ctx, rng, sx, h * 0.55, sz, ang, rng.f(6, 12), 'h', { lightColor: acc }); }
  }
  return h;
}
export function facePt(f, cx, cz, w, d, t) {
  if (f === 0) return [cx + t * w, cz + d / 2, 0];
  if (f === 1) return [cx + w / 2, cz + t * d, Math.PI / 2];
  if (f === 2) return [cx + t * w, cz - d / 2, Math.PI];
  return [cx - w / 2, cz + t * d, -Math.PI / 2];
}

// classic stepped tower with fins and crown
export function towerSetback(ctx, rng, w, d, h, pal, o = {}) {
  const pen = ctx.main(); const wall = o.wall || facadeMat(rng, pal);
  const tiers = o.tiers ?? rng.i(2, 4); let y = o.y0 ?? 0, cw = w, cd = d;
  const roof = K.conc(0.28);
  const hs = []; let tot = 0; for (let i = 0; i < tiers; i++) { const v = rng.f(0.6, 1.4) * (i === 0 ? 1.5 : 1); hs.push(v); tot += v; }
  let ox = 0, oz = 0;
  for (let i = 0; i < tiers; i++) {
    const th = Math.round(((h - y) * 0 + h * hs[i] / tot) / wall.floorH) * wall.floorH;
    pen.box(ox, oz, cw, cd, y, y + th, { wall, roof, aoB: i === 0 && !o.y0 ? 0.55 : 0.85 });
    ctx.solid(ox, oz, cw, cd, y, y + th);
    if (o.fins !== false && rng.chance(0.55)) K.fins(ctx, ox, oz, cw, cd, y, y + th, rng.f(5, 9), rng.f(0.5, 1.1), K.dark(0.14), { detail: i > 0 });
    if (rng.chance(0.5)) K.neonBand(ctx, ox, oz, cw, cd, y + th - 0.4, rng.pick(pal.accents), { intensity: 7, light: false, nightOnly: true });
    y += th;
    if (i < tiers - 1) { const s = rng.f(0.62, 0.86); const nw = cw * s, nd = cd * rng.f(0.62, 0.86); ox += rng.f(-1, 1) * (cw - nw) * 0.4; oz += rng.f(-1, 1) * (cd - nd) * 0.4; if (i < tiers - 2 || rng.chance(0.5)) K.rooftop(ctx, rng, ox, oz, cw, cd, y, { density: 0.4, parapet: true }); cw = nw; cd = nd; }
  }
  crown(ctx, rng, o.crown || rng.pick(['mast', 'halo', 'slope', 'fins', 'roof', 'beacon']), ox, oz, cw, cd, y, pal);
  done(ctx, w, d, y); return y;
}
// tapered obelisk with chamfered corners and a sliced top
export function towerTaper(ctx, rng, w, d, h, pal, o = {}) {
  const pen = ctx.main(); const wall = o.wall || facadeMat(rng, pal, { st: ST.WIN_CURTAIN });
  const ch = Math.min(w, d) * rng.f(0.12, 0.3), top = rng.f(0.45, 0.8);
  const segs = 4, rings = [];
  const bulge = rng.f(-0.06, 0.1);
  for (let i = 0; i <= segs; i++) { const t = i / segs; const s = 1 + (top - 1) * t + bulge * Math.sin(t * 3.14); rings.push({ y: Math.round((h * t) / wall.floorH) * wall.floorH, pts: scalePts(rectPts(w, d, 0, 0, ch), s) }); }
  pen.use(wall); pen.loft(rings, { roof: K.conc(0.25), aoB: 0.55 });
  for (let i = 0; i < segs; i++) { const s = 1 + (top - 1) * ((i + 0.5) / segs); ctx.solid(0, 0, w * s, d * s, rings[i].y, rings[i + 1].y); }
  // corner light slots
  const acc = rng.pick(pal.accents);
  if (rng.chance(0.7)) {
    pen.use(K.emis(acc, 8, 0, true));
    for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) pen.beam(sx * (w / 2 - ch / 2 + 0.2), h * 0.08, sz * (d / 2 - ch / 2 + 0.2), sx * (w * top / 2 - ch * top / 2 + 0.2), h * 0.98, sz * (d * top / 2 - ch * top / 2 + 0.2), 0.5, 0.5);
  }
  crown(ctx, rng, o.crown || rng.pick(['mast', 'slope', 'beacon', 'halo']), 0, 0, w * top * 0.8, d * top * 0.8, h, pal, { accent: acc });
  done(ctx, w, d, h); return h;
}
// twisting tower
export function towerTwist(ctx, rng, w, d, h, pal, o = {}) {
  const pen = ctx.main(); const wall = o.wall || facadeMat(rng, pal, { st: ST.WIN_CURTAIN });
  const twist = rng.f(0.5, 1.4) * rng.sign(), segs = Math.max(6, Math.round(h / 28)), taper = rng.f(0.6, 0.95);
  const rings = []; const basePts = rectPts(w, d, 0, 0, Math.min(w, d) * 0.22);
  for (let i = 0; i <= segs; i++) { const t = i / segs; rings.push({ y: Math.round((h * t) / wall.floorH) * wall.floorH, pts: rotPts(scalePts(basePts, 1 + (taper - 1) * t), twist * t) }); }
  pen.use(wall); pen.loft(rings, { roof: K.conc(0.25), aoB: 0.55 });
  ctx.solidCyl(0, 0, Math.min(w, d) * 0.5, 0, h);
  crown(ctx, rng, o.crown || rng.pick(['mast', 'beacon', 'halo']), 0, 0, w * taper * 0.6, d * taper * 0.6, h, pal);
  done(ctx, w, d, h); return h;
}
// cylindrical tower with belt rings
export function towerCyl(ctx, rng, r, h, pal, o = {}) {
  const pen = ctx.main(); const wall = o.wall || facadeMat(rng, pal);
  const n = rng.i(2, 5); const prof = [[r, 0]]; let y = 0; const belts = [];
  for (let i = 0; i < n; i++) { const th = Math.round((h / n) / wall.floorH) * wall.floorH; y += th; const rr = r * (1 - 0.12 * (i + 1) / n * rng.f(0, 1.5)); prof.push([prof[prof.length - 1][0], y - 2.5]); belts.push([prof[prof.length - 1][0], y - 2.5]); prof.push([rr, y]); }
  const segs = Math.max(14, Math.min(28, Math.round(r * 0.9)));
  pen.use(wall); pen.lathe(0, 0, prof, segs, { roof: K.conc(0.25), aoB: 0.55 });
  const acc = rng.pick(pal.accents);
  for (const [br, by] of belts) { pen.use(K.dark(0.1)); pen.lathe(0, 0, [[br + 0.1, by], [br + 1.4, by + 0.6], [br + 1.4, by + 1.9], [br + 0.1, by + 2.5]], segs, { cap: false }); if (rng.chance(0.6)) { pen.use(K.emis(acc, 8, 0, true)); pen.lathe(0, 0, [[br + 1.45, by + 0.9], [br + 1.45, by + 1.5]], segs, { cap: false }); } }
  ctx.solidCyl(0, 0, r, 0, y);
  const tr = prof[prof.length - 1][0];
  crown(ctx, rng, o.crown || rng.pick(['mast', 'halo', 'beacon', 'roof']), 0, 0, tr * 1.3, tr * 1.3, y, pal, { accent: acc });
  done(ctx, r * 2, r * 2, y); return y;
}
// stack of shifted volumes
export function towerStack(ctx, rng, w, d, h, pal, o = {}) {
  const pen = ctx.main(); let y = 0; const n = rng.i(3, 6); let last = [0, 0, w, d];
  const wallA = o.wall || facadeMat(rng, pal), wallB = facadeMat(rng, pal, { floorH: wallA.floorH });
  for (let i = 0; i < n; i++) {
    const th = Math.round((h / n) * rng.f(0.7, 1.3) / wallA.floorH) * wallA.floorH; const s = rng.f(0.7, 1.0);
    const bw = w * s, bd = d * rng.f(0.7, 1.0), ox = rng.f(-1, 1) * w * 0.14, oz = rng.f(-1, 1) * d * 0.14;
    pen.box(ox, oz, bw, bd, y, y + th, { wall: i % 2 ? wallB : wallA, roof: K.conc(0.27), bottom: i > 0 ? K.dark(0.08) : null, aoB: i === 0 ? 0.55 : 0.8 });
    ctx.solid(ox, oz, bw, bd, y, y + th);
    if (i > 0 && rng.chance(0.6)) { pen.use(K.emis(rng.pick(pal.accents), 6, 0, true)); pen.box(ox, oz, bw * 0.98, bd * 0.98, y - 0.25, y, { roof: null, bottom: true }); }
    // recessed dark joint
    pen.box(ox, oz, bw * 0.8, bd * 0.8, y + th, y + th + 1.6, { wall: K.dark(0.06), roof: null });
    y += th + 1.6; last = [ox, oz, bw, bd];
  }
  y -= 1.6;
  crown(ctx, rng, o.crown || rng.pick(['mast', 'fins', 'roof', 'beacon']), last[0], last[1], last[2], last[3], y, pal);
  done(ctx, w, d, y); return y;
}
// exoskeleton tower: glass box inside a braced megaframe
export function towerExo(ctx, rng, w, d, h, pal, o = {}) {
  const pen = ctx.main(); const wall = o.wall || facadeMat(rng, pal, { st: ST.WIN_CURTAIN });
  const hh = Math.round(h / wall.floorH) * wall.floorH;
  pen.box(0, 0, w, d, 0, hh, { wall, roof: K.conc(0.26), aoB: 0.55 }); ctx.solid(0, 0, w, d, 0, hh);
  const fm = K.dark(0.11);
  K.xBrace(ctx, 0, 0, w, d, 0, hh, rng.f(28, 46), fm, rng.f(0.7, 1.3));
  pen.use(fm); for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) pen.box(sx * (w / 2 + 0.3), sz * (d / 2 + 0.3), 1.6, 1.6, 0, hh + 3, {});
  crown(ctx, rng, o.crown || rng.pick(['mast', 'fins', 'beacon']), 0, 0, w * 0.8, d * 0.8, hh, pal);
  done(ctx, w, d, hh); return hh;
}
// twin slabs joined by bridges
export function towerTwin(ctx, rng, w, d, h, pal, o = {}) {
  const pen = ctx.main(); const wall = o.wall || facadeMat(rng, pal);
  const gap = w * rng.f(0.18, 0.3), sw = (w - gap) / 2; const h2 = h * rng.f(0.75, 1.0);
  const H1 = Math.round(h / wall.floorH) * wall.floorH, H2 = Math.round(h2 / wall.floorH) * wall.floorH;
  pen.box(-(gap + sw) / 2, 0, sw, d, 0, H1, { wall, roof: K.conc(0.26), aoB: 0.55 }); ctx.solid(-(gap + sw) / 2, 0, sw, d, 0, H1);
  pen.box((gap + sw) / 2, 0, sw, d, 0, H2, { wall, roof: K.conc(0.26), aoB: 0.55 }); ctx.solid((gap + sw) / 2, 0, sw, d, 0, H2);
  const nb = rng.i(1, 3); const acc = rng.pick(pal.accents);
  for (let i = 0; i < nb; i++) {
    const by = Math.round((H2 * (0.3 + 0.55 * (i + rng.f(0, 0.6)) / nb)) / wall.floorH) * wall.floorH;
    pen.box(0, rng.f(-0.25, 0.25) * d, gap + 0.4, d * 0.3, by, by + wall.floorH * 2, { wall: M(ST.WIN_RIBBON, { color: [0.25, 0.27, 0.3], seed: i * 31, A: 0.95, B: wall.B, cellW: 3, floorH: wall.floorH, flags: 1 }), roof: K.dark(0.15), bottom: K.emis(acc, 5, 0, true), sides: 1 | 4 });
  }
  crown(ctx, rng, rng.pick(['mast', 'slope', 'halo']), -(gap + sw) / 2, 0, sw, d, H1, pal, { accent: acc });
  crown(ctx, rng, rng.pick(['roof', 'fins', 'beacon']), (gap + sw) / 2, 0, sw, d, H2, pal, { accent: acc });
  done(ctx, w, d, H1); return H1;
}
// modest mid-rise block with shopfront
export function midrise(ctx, rng, w, d, h, pal, o = {}) {
  const pen = ctx.main(); const wall = o.wall || facadeMat(rng, pal, { st: o.st });
  const hh = Math.max(wall.floorH * 2, Math.round(h / wall.floorH) * wall.floorH);
  pen.box(0, 0, w, d, 0, hh, { wall, roof: K.conc(0.27), aoB: o.y0 ? 0.85 : 0.55 }); ctx.solid(0, 0, w, d, 0, hh);
  if (o.band !== false && rng.chance(0.6)) K.neonBand(ctx, 0, 0, w, d, rng.chance(0.5) ? hh - 0.4 : 4.6, rng.pick(pal.accents), { intensity: 7, radius: 22, power: 0.4, nightOnly: true });
  K.rooftop(ctx, rng, 0, 0, w, d, hh, { mast: 0.25, density: o.roofDensity ?? 1 });
  done(ctx, w, d, hh); return hh;
}
