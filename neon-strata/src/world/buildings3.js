// Tower typologies: genuinely different silhouettes on the same lot/base contract.
// Each form receives the footprint (w × d centred on (0, cz)), the start height y0 (top of the base) and
// the total height H, builds its own shaft + crown, registers colliders and must stay inside the footprint.
import { ST, PAL, WK } from '../render/cityMaterial.js';
import { M, rectPts, scalePts, ngonPts, rotPts } from './builder.js';
import * as K from './kit.js';
import { Vol, facade, blindWall, FACE_ANG } from './facade.js';
import { wallMat, roofProps, landingPad, haloRing, crownSpire, crownFins, ROOF_TECH } from './buildings.js';

const dim = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
const snap = (y, fh) => Math.round(y / fh) * fh;
const wm = (rng, S, fh, o = {}) => wallMat(rng, S, { st: rng.pick(S.towerWin || [ST.WIN_OFFICE, ST.WIN_RIBBON]), floorH: fh, cellW: S.towerCell ?? 3.0, ...o });
const frameOf = (wall) => M(ST.COMPOSITE, { color: dim(wall.color, 0.7), seed: wall.seed });
const spark = (ctx, y, col = [1, 0.85, 0.65]) => ctx.spark(ctx.pen.wx(0, 0), ctx.pen.oy + y, ctx.pen.wz(0, 0), col, 5, 1);
const topVol = (ctx, cz, w, d, y) => new Vol(ctx, 0, cz, w, d, y, y);

export const FORMS = {
  // round tower with belt rings and a disc crown
  cyl(ctx, rng, a) {
    const { pen } = ctx; const { cz, y0, H, S, acc, fh } = a; const wall = wm(rng, S, fh); const fr = frameOf(wall);
    const R = Math.min(a.w, a.d) / 2 - 0.6; const n = rng.i(2, 4); const prof = [[R, y0]]; const belts = [];
    for (let i = 0; i < n; i++) { const y1 = y0 + snap(((H - y0) * (i + 1)) / n, fh); const r0 = prof[prof.length - 1][0]; prof.push([r0, y1 - 3]); belts.push([r0, y1 - 3]); prof.push([i === n - 1 ? r0 : R * (1 - 0.09 * (i + 1) * rng.f(0.4, 1)), y1]); }
    const segs = Math.max(16, Math.min(28, Math.round(R * 1.1)));
    ctx.main(); pen.use(wall); pen.lathe(0, cz, prof, segs, { roof: K.conc(0.24) });
    for (const [br, by] of belts) { pen.use(fr); pen.lathe(0, cz, [[br + 0.1, by], [br + 1.6, by + 0.6], [br + 1.6, by + 2.2], [br + 0.1, by + 3]], segs, { cap: false }); if (rng.chance(0.4)) { pen.use(K.emis(acc, 6, 0, true)); pen.lathe(0, cz, [[br + 1.65, by + 1.1], [br + 1.65, by + 1.6]], segs, { cap: false }); } }
    ctx.solidCyl(0, cz, R, y0, H); const rt = prof[prof.length - 1][0];
    const k = rng.next();
    if (k < 0.4) { pen.use(fr); pen.lathe(0, cz, [[rt * 0.5, H], [rt * 1.25, H + 2.5], [rt * 1.25, H + 3.4]], segs, { cap: false }); pen.use(M(ST.COMPOSITE, { color: [0.22, 0.23, 0.26] })); pen.lathe(0, cz, [[rt * 1.25, H + 3.4], [0.1, H + 3.4]], segs, { cap: false }); const e = K.emis(acc, 6, 0, true); e.flags |= 8; pen.use(e); pen.lathe(0, cz, [[rt * 1.27, H + 2.9], [rt * 1.27, H + 3.3]], segs, { cap: false }); ctx.solidCyl(0, cz, rt * 1.2, H + 2.4, H + 3.4); ctx.poi({ type: 'pad', x: pen.wx(0, cz), y: pen.oy + H + 3.4, z: pen.wz(0, cz), size: rt * 2 }); }
    else if (k < 0.7) crownSpire(topVol(ctx, cz, rt * 1.5, rt * 1.5, H), H, rng.f(20, 50), rng, acc);
    else { pen.use(M(ST.DARKGLASS, { color: dim(wall.color, 1.2) })); const dp = []; for (let i = 0; i <= 5; i++) { const t = (i / 5) * Math.PI / 2; dp.push([Math.max(0.3, Math.cos(t) * rt), H + Math.sin(t) * rt * 0.7]); } pen.lathe(0, cz, dp, segs, { cap: false }); }
    spark(ctx, H * 0.7);
  },
  // twisting rounded square
  twist(ctx, rng, a) {
    const { pen } = ctx; const { cz, y0, H, S, acc, fh } = a; const wall = wm(rng, S, fh, { st: ST.WIN_OFFICE });
    const s = Math.min(a.w, a.d) * 0.7; const tw = rng.f(0.7, 1.6) * rng.sign(); const taper = rng.f(0.72, 0.95); const segs = Math.max(6, Math.round((H - y0) / 26));
    const base = rectPts(s, s, 0, cz, s * 0.2); const rings = [];
    for (let i = 0; i <= segs; i++) { const t = i / segs; rings.push({ y: y0 + snap((H - y0) * t, fh), pts: rotPts(scalePts(base, 1 + (taper - 1) * t, 0, cz), tw * t, 0, cz) }); }
    ctx.main(); pen.use(wall); pen.loft(rings, { roof: K.conc(0.24) });
    pen.use(K.emis(acc, 5, 3, true, rng.i(0, 255))); for (const k of [0, 2, 4, 6]) { for (let i = 0; i < segs; i++) { const p = rings[i].pts[k], q = rings[i + 1].pts[k]; pen.beam(p[0], rings[i].y, p[1], q[0], rings[i + 1].y, q[1], 0.35, 0.35); } }
    ctx.solidCyl(0, cz, s * 0.6, y0, H);
    crownSpire(topVol(ctx, cz, s * taper * 0.7, s * taper * 0.7, H), H, rng.f(18, 46), rng, acc); spark(ctx, H * 0.6);
  },
  // battered obelisk with chamfered corners and a sliced top
  taper(ctx, rng, a) {
    const { pen } = ctx; const { w, d, cz, y0, H, S, acc, fh } = a; const wall = wm(rng, S, fh, { st: ST.WIN_OFFICE }); const fr = frameOf(wall);
    const ch = Math.min(w, d) * rng.f(0.14, 0.28), top = rng.f(0.42, 0.7); const bulge = rng.f(0, 0.08); const segs = 5; const rings = [];
    for (let i = 0; i <= segs; i++) { const t = i / segs; rings.push({ y: y0 + snap((H - y0) * t, fh), pts: scalePts(rectPts(w - 1, d - 1, 0, cz, ch), 1 + (top - 1) * t + bulge * Math.sin(t * Math.PI), 0, cz) }); }
    ctx.main(); pen.use(wall); pen.loft(rings, { cap: false });
    for (let i = 0; i < segs; i++) { const sc = 1 + (top - 1) * ((i + 0.5) / segs); ctx.solid(0, cz, (w - 1) * sc, (d - 1) * sc, rings[i].y, rings[i + 1].y); }
    // sliced crown: wedge rising to the back
    const tp = rings[segs].pts; const hgt = Math.min(w, d) * top * rng.f(0.5, 1.0);
    pen.use(fr); pen.loft([{ y: H, pts: tp }, { y: H + hgt, pts: tp.map(([x, z]) => [x, cz - (d - 1) * top / 2 + (z - (cz - (d - 1) * top / 2)) * 0.06]) }], { roof: fr });
    pen.use(K.emis(acc, 7, 0, true)); pen.beam(-(w - 1) * top / 2 + 1, H + 0.6, cz + (d - 1) * top / 2 - 0.4, (w - 1) * top / 2 - 1, H + 0.6, cz + (d - 1) * top / 2 - 0.4, 0.3, 0.5);
    pen.use(K.emis(acc, 5, 3, true, rng.i(0, 255))); for (const k of [1, 3, 5, 7]) { const p = rings[0].pts[k], q = rings[segs].pts[k]; pen.beam(p[0], y0 + 2, p[1], q[0], H - 1, q[1], 0.4, 0.4); }
    spark(ctx, H, acc);
  },
  // shifted cantilevered boxes
  stack(ctx, rng, a) {
    const { pen } = ctx; const { w, d, cz, y0, H, S, acc, fh } = a; const wA = wm(rng, S, fh), wB = wm(rng, S, fh, { st: ST.WIN_RIBBON }); const fr = frameOf(wA);
    const n = Math.max(3, Math.min(6, Math.round((H - y0) / 45))); let y = y0; let last = null;
    for (let i = 0; i < n; i++) {
      const th = snap(((H - y0) / n) * rng.f(0.8, 1.2), fh) - 1.6; const bw = w * rng.f(0.7, 0.86), bd = d * rng.f(0.7, 0.86); const ox = rng.f(-1, 1) * (w - bw) * 0.5, oz = cz + rng.f(-1, 1) * (d - bd) * 0.5;
      const v = new Vol(ctx, ox, oz, bw, bd, y, y + th); const wall = i % 2 ? wB : wA;
      for (const f of [0, 1, 2, 3]) facade(v, f, y, y + th, { wall, bayCells: 2, floorH: fh, ribs: f === 0 ? { d: 0.5, w: 0.4, mat: fr, every: 2, detail: true } : null });
      v.roof(K.conc(0.24)); pen.use(K.dark(0.07)); pen.flat(ox - bw / 2, oz - bd / 2, ox + bw / 2, oz + bd / 2, y, false, 0.5); v.solid();
      pen.use(K.emis(acc, 5, 0, true)); pen.box(ox, oz, bw - 0.3, bd - 0.3, y - 0.2, y, { roof: null });
      if (i < n - 1) { const jv = new Vol(ctx, ox * 0.5, cz + (oz - cz) * 0.5, Math.min(bw, w * 0.6) * 0.8, Math.min(bd, d * 0.6) * 0.8, y + th, y + th + 1.6); pen.use(K.dark(0.05)); for (const f of [0, 1, 2, 3]) jv.wall(f, 0, jv.len(f), 0, y + th, y + th + 1.6); jv.solid(); }
      y += th + 1.6; last = v;
    }
    roofProps(ctx, rng, last.cx, last.cz, last.w, last.d, last.y1, ROOF_TECH, 0.8); if (rng.chance(0.5)) landingPad(last, 0, last.w * 0.5, last.y1 - snap(last.y1 * 0.1, fh), Math.min(10, last.w * 0.4), rng, { color: acc }); spark(ctx, H * 0.8);
  },
  // twin slabs tied together by bridges
  twin(ctx, rng, a) {
    const { pen } = ctx; const { w, d, cz, y0, H, S, acc, fh } = a; const wall = wm(rng, S, fh); const fr = frameOf(wall);
    const gap = w * rng.f(0.2, 0.3), sw = (w - gap) / 2 - 0.3; const hs = [H, y0 + snap((H - y0) * rng.f(0.7, 0.95), fh)]; if (rng.chance(0.5)) hs.reverse();
    const vols = [-1, 1].map((s, i) => { const v = new Vol(ctx, s * (gap + sw) / 2, cz, sw, d - 0.6, y0, hs[i]); for (const f of [0, 1, 2, 3]) facade(v, f, y0, hs[i], { wall, bayCells: 2, floorH: fh, jamb: fr, ribs: f % 2 === 0 ? { d: 0.5, w: 0.4, mat: fr, every: 2, detail: f === 2 } : null, belts: { every: 10, d: 0.4, h: 0.6, mat: fr, detail: true } }); v.roof(K.conc(0.24)); v.solid(); return v; });
    const lo = Math.min(hs[0], hs[1]); const nb = rng.i(2, 3);
    for (let i = 0; i < nb; i++) { const by = y0 + snap((lo - y0) * ((i + 0.6) / nb), fh); const bz = cz + rng.f(-0.25, 0.25) * d; const bv = new Vol(ctx, 0, bz, gap + 0.5, Math.min(9, d * 0.3), by, by + fh * 2); ctx.main(); pen.use(M(ST.WIN_RIBBON, { color: dim(wall.color, 0.9), seed: i * 31, A: 0.9, B: wall.B, cellW: 3, floorH: fh, flags: WK.METAL })); bv.wall(0, 0, bv.w, 0, by, by + fh * 2, {}); bv.wall(2, 0, bv.w, 0, by, by + fh * 2, {}); bv.roof(K.dark(0.14)); pen.use(K.emis(acc, 5, 0, true)); pen.flat(-gap / 2, bz - bv.d / 2, gap / 2, bz + bv.d / 2, by, false, 1); bv.solid(); }
    for (let i = 0; i < 2; i++) { if (hs[i] === H) crownFins(vols[i], hs[i], rng.f(8, 16), rng, acc); else roofProps(ctx, rng, vols[i].cx, vols[i].cz, vols[i].w, vols[i].d, hs[i], ROOF_TECH, 0.9); }
    spark(ctx, H * 0.7);
  },
  // gate: two legs carrying a bridging block, open sky through the middle
  gate(ctx, rng, a) {
    const { pen } = ctx; const { w, d, cz, y0, H, S, acc, fh } = a; const wall = wm(rng, S, fh); const fr = frameOf(wall);
    const lw = w * rng.f(0.26, 0.32); const yb = y0 + snap((H - y0) * rng.f(0.62, 0.76), fh);
    for (const s of [-1, 1]) { const v = new Vol(ctx, s * (w / 2 - lw / 2 - 0.3), cz, lw, d - 0.6, y0, yb); for (const f of [0, 1, 2, 3]) facade(v, f, y0, yb, { wall, bayCells: 2, floorH: fh, jamb: fr, belts: { every: 9, d: 0.4, h: 0.6, mat: fr, detail: true } }); v.solid(); }
    const top = new Vol(ctx, 0, cz, w - 0.6, d - 0.6, yb, H); for (const f of [0, 1, 2, 3]) facade(top, f, yb, H, { wall, bayCells: 2, floorH: fh, jamb: fr, ribs: f % 2 === 0 ? { d: 0.6, w: 0.5, mat: fr, every: 2 } : null });
    top.roof(K.conc(0.24)); top.solid(); ctx.main(); pen.use(fr); pen.flat(-w / 2 + lw, cz - d / 2 + 0.3, w / 2 - lw, cz + d / 2 - 0.3, yb, false, 0.6);
    const e = K.emis(acc, 6, 0, true); pen.use(e); const gw = w - 2 * lw - 0.6; pen.box(0, cz, gw - 2, d - 3, yb - 0.3, yb - 0.05, { roof: null });
    // hanging brand hologram in the void
    const lg = ctx.atlas.pickLogo(rng); const sz = Math.min(gw * 0.7, (yb - y0) * 0.3); const c = [pen.wx(0, cz), pen.wz(0, cz)]; const dx = Math.cos(pen.yaw) * sz / 2, dz = -Math.sin(pen.yaw) * sz / 2; const hy = pen.oy + yb - sz * 1.4;
    ctx.glow.quad([c[0] - dx, hy, c[1] - dz], [c[0] + dx, hy, c[1] + dz], [c[0] + dx, hy + sz, c[1] + dz], [c[0] - dx, hy + sz, c[1] - dz], [1, 1, 1], 0.9, 3, 2.0, { uv: [lg.u0, lg.v0, lg.u1, lg.v1], seed: rng.f(0, 9) });
    ctx.spark(c[0], hy + sz / 2, c[1], lg.glow || acc, 8, 2); roofProps(ctx, rng, 0, cz, w - 2, d - 2, H, ROOF_TECH, 0.9); haloRing(topVol(ctx, cz, w * 0.5, d * 0.5, H), H - 2, rng, acc, 0.5);
  },
  // bundle of three hexagonal tubes
  hex(ctx, rng, a) {
    const { pen } = ctx; const { w, d, cz, y0, H, S, acc, fh } = a; const wall = wm(rng, S, fh, { st: ST.WIN_OFFICE }); const fr = frameOf(wall);
    const r = Math.min(w, d) * 0.265; const hs = [1, rng.f(0.72, 0.86), rng.f(0.5, 0.66)]; const ang0 = rng.f(0, 6.28);
    for (let i = 0; i < 3; i++) { const an = ang0 + i * 2.094; const cx = Math.cos(an) * r * 0.86, cc = cz + Math.sin(an) * r * 0.86; const hh = y0 + snap((H - y0) * hs[i], fh);
      ctx.main(); pen.use({ ...wall, seed: wall.seed + i * 7 }); pen.prism(ngonPts(r, 6, cx, cc, an), y0, hh, { roof: K.conc(0.24) });
      pen.use(fr); for (let k = 0; k < 6; k++) { const p = ngonPts(r + 0.15, 6, cx, cc, an)[k]; pen.beam(p[0], y0, p[1], p[0], hh + 2.5, p[1], 0.7, 0.7); }
      pen.use(K.emis(acc, 6, 0, true)); pen.lathe(cx, cc, [[r * 0.82, hh + 0.3], [r * 0.82, hh + 0.8]], 6, { cap: false, a0: -an, a1: -an + Math.PI * 2 });
      ctx.solidCyl(cx, cc, r * 0.9, y0, hh); if (i === 0) crownSpire(new Vol(ctx, cx, cc, r, r, hh, hh), hh, rng.f(16, 40), rng, acc); else if (rng.chance(0.6)) ctx.propL('mast', cx, hh, cc, rng.f(0, 6.28), rng.f(0.8, 1.3)); }
    spark(ctx, H * 0.75);
  },
  // stacked plates: floor discs with recessed glazing between
  disc(ctx, rng, a) {
    const { pen } = ctx; const { w, d, cz, y0, H, S, acc, fh } = a; const wall = wm(rng, S, fh, { st: ST.WIN_LUX, lit: rng.f(0.3, 0.6) }); const fr = M(ST.COMPOSITE, { color: [0.5, 0.5, 0.52], seed: rng.i(0, 255) });
    const per = 3; const n = Math.max(3, Math.round((H - y0) / (fh * per))); const ch = Math.min(w, d) * 0.3; const base = rectPts(w - 0.8, d - 0.8, 0, cz, ch); ctx.main();
    for (let i = 0; i < n; i++) { const y = y0 + i * fh * per; const k = 1 - 0.3 * (i / n) * (i / n) + 0.05 * Math.sin(i * 1.3);
      const plate = scalePts(base, k, 0, cz), body = scalePts(base, k * 0.86, 0, cz);
      pen.use(fr); pen.loft([{ y, pts: plate }, { y: y + 0.7, pts: plate }], { roof: fr, capBottom: true }); pen.use(wall); pen.loft([{ y: y + 0.7, pts: body }, { y: y + fh * per, pts: body }], { cap: false });
      if (i % 4 === 1) { pen.use(K.emis(acc, 5, 0, true)); pen.loft([{ y: y + 0.2, pts: scalePts(base, k * 1.005, 0, cz) }, { y: y + 0.45, pts: scalePts(base, k * 1.005, 0, cz) }], { cap: false }); } }
    const yt = y0 + n * fh * per; pen.use(fr); pen.loft([{ y: yt, pts: scalePts(base, 0.74, 0, cz) }, { y: yt + 0.8, pts: scalePts(base, 0.74, 0, cz) }], { roof: fr, capBottom: true });
    ctx.solid(0, cz, (w - 0.8) * 0.86, (d - 0.8) * 0.86, y0, yt);
    crownSpire(topVol(ctx, cz, w * 0.4, d * 0.4, yt + 0.8), yt + 0.8, rng.f(14, 36), rng, acc); spark(ctx, H * 0.7);
  },
  // flat-iron wedge
  blade(ctx, rng, a) {
    const { pen } = ctx; const { w, d, cz, y0, H, S, acc, fh } = a; const wall = wm(rng, S, fh, { st: ST.WIN_OFFICE }); const fr = frameOf(wall);
    const nw = w * rng.f(0.1, 0.2); const z1 = cz + d / 2 - 0.4, z0 = cz - d / 2 + 0.4; const pts = [[-w / 2 + 0.4, z1], [w / 2 - 0.4, z1], [nw, z0], [-nw, z0]];
    const mid = scalePts(pts, 0.94, 0, cz), topP = scalePts(pts, 0.8, 0, cz);
    ctx.main(); pen.use(wall); pen.loft([{ y: y0, pts }, { y: y0 + snap((H - y0) * 0.6, fh), pts: mid }, { y: H, pts: topP }], { roof: K.conc(0.24) });
    pen.use(fr); pen.beam(-nw * 0.8, y0, z0 - 0.2, -nw * 0.64, H + 14, z0 * 0.8 + cz * 0.2, 0.8, 1.2); pen.beam(nw * 0.8, y0, z0 - 0.2, nw * 0.64, H + 14, z0 * 0.8 + cz * 0.2, 0.8, 1.2);
    pen.use(K.emis(acc, 6, 3, true, rng.i(0, 255))); pen.beam(0, y0 + 2, z0 - 0.5, 0, H + 12, z0 * 0.8 + cz * 0.2 - 0.3, 0.4, 0.3);
    ctx.solid(0, cz + d * 0.15, w * 0.8, d * 0.6, y0, H); ctx.solid(0, cz - d * 0.3, nw * 2 + 2, d * 0.35, y0, H);
    roofProps(ctx, rng, 0, cz + d * 0.15, w * 0.6, d * 0.4, H, ROOF_TECH, 0.8); ctx.spark(pen.wx(0, z0), pen.oy + H + 14, pen.wz(0, z0), K.NEON.red, 4, 1.5);
  },
  // terraced slope: storeys step back from the street with planted decks
  aframe(ctx, rng, a) {
    const { pen } = ctx; const { w, d, cz, y0, H, S, acc, fh } = a; const wall = wm(rng, S, fh, { st: rng.pick([ST.WIN_LUX, ST.WIN_RES]) }); const fr = frameOf(wall);
    const n = Math.max(4, Math.min(9, Math.round((H - y0) / (fh * 4)))); const th = snap((H - y0) / n, fh); const step = (d * 0.62) / n;
    for (let i = 0; i < n; i++) { const dd = d - 0.6 - step * i; const v = new Vol(ctx, 0, cz - (step * i) / 2, w - 0.6, dd, y0 + i * th, y0 + (i + 1) * th);
      facade(v, 0, v.y0, v.y1, { wall, bayCells: 2, floorH: fh, jamb: fr, ribs: { d: 0.35, w: 0.35, mat: fr, every: 2, detail: true } }); for (const f of [1, 3]) facade(v, f, v.y0, v.y1, { wall, bayCells: 99, floorH: fh }); if (i === n - 1 || true) facade(v, 2, v.y0, v.y1, { wall, bayCells: 99, floorH: fh });
      v.roof(M(ST.TILE, { color: [0.3, 0.3, 0.33] })); v.solid();
      ctx.detail(); pen.use(K.foliage([0.22, 0.42, 0.2])); pen.box(0, v.cz + dd / 2 - 0.9, w - 2, 1.2, v.y1, v.y1 + 0.8, {}); pen.use(K.dark(0.1)); pen.beam(-w / 2 + 0.5, v.y1 + 1.05, v.cz + dd / 2 - 0.15, w / 2 - 0.5, v.y1 + 1.05, v.cz + dd / 2 - 0.15, 0.06, 0.06); ctx.main(); }
    pen.use(K.emis(acc, 6, 0, true)); pen.beam(-w / 2 + 0.6, H + 0.3, cz - d / 2 + 0.5, w / 2 - 0.6, H + 0.3, cz - d / 2 + 0.5, 0.3, 0.4); spark(ctx, H * 0.8);
  },
};

export function pickForm(rng, S, w, d, H, lot) {
  const sq = Math.min(w, d) / Math.max(w, d);
  const tbl = [[3, 'slab'], [H > 90 ? 2 : 0.5, 'taper'], [H > 80 && sq > 0.6 ? 1.6 : 0, 'twist'], [sq > 0.7 ? 1.8 : 0.2, 'cyl'], [w > 30 ? 1.6 : 0, 'twin'], [w > 34 && H > 90 ? 1.2 : 0, 'gate'], [1.4, 'stack'], [sq > 0.7 && H > 70 ? 1.2 : 0, 'hex'], [1.4, 'disc'], [d > w * 0.9 ? 1.1 : 0.4, 'blade'], [d > 26 ? 1.3 : 0, 'aframe']];
  const bias = S.forms || {}; return rng.weighted(tbl.map(([wt, n]) => [wt * (bias[n] ?? 1), n]).filter((e) => e[0] > 0));
}

// ---- megatower shafts (on the shared podium) -------------------------------------------------------
export const MEGA = {
  // one colossal tapering needle with dock rings
  needle(ctx, rng, a) {
    const { pen } = ctx; const { W, Dd, ph, H, S, acc, fh, brand } = a; const wall = wm(rng, S, fh, { st: ST.WIN_OFFICE }); const fr = frameOf(wall);
    const R = Math.min(W, Dd) * 0.36; const prof = [[R * 1.15, ph], [R, ph + 30], [R * 0.82, ph + (H - ph) * 0.45], [R * 0.6, ph + (H - ph) * 0.8], [R * 0.34, H]];
    ctx.main(); pen.use(wall); pen.lathe(0, 0, prof, 32, { roof: K.conc(0.24) });
    const rAt = (y) => { for (let i = 0; i < prof.length - 1; i++) if (y <= prof[i + 1][1]) return prof[i][0] + (prof[i + 1][0] - prof[i][0]) * ((y - prof[i][1]) / (prof[i + 1][1] - prof[i][1])); return prof[prof.length - 1][0]; };
    for (let i = 0; i < 12; i++) { const an = (i / 12) * Math.PI * 2; const c = Math.cos(an), s = Math.sin(an); pen.use(fr); for (let k = 0; k < prof.length - 1; k++) pen.beam(c * (prof[k][0] + 0.6), prof[k][1], s * (prof[k][0] + 0.6), c * (prof[k + 1][0] + 0.6), prof[k + 1][1], s * (prof[k + 1][0] + 0.6), 1.6, 2.6); }
    for (let y = ph + 90; y < H - 60; y += rng.f(110, 170)) { const r = rAt(y); pen.use(fr); pen.lathe(0, 0, [[r, y - 6], [r + 16, y], [r + 16, y + 2.4]], 32, { cap: false }); pen.use(M(ST.TILE, { color: [0.3, 0.31, 0.34] })); pen.lathe(0, 0, [[r + 16, y + 2.4], [r, y + 2.4]], 32, { cap: false }); const e = K.emis(acc, 7, 0, true); e.flags |= 8; pen.use(e); pen.lathe(0, 0, [[r + 16.1, y + 1.4], [r + 16.1, y + 2]], 32, { cap: false }); ctx.phys.addRing(pen.wx(0, 0), pen.wz(0, 0), r - 1, r + 16, pen.oy + y, pen.oy + y + 2.4); ctx.poi({ type: 'pad', x: pen.wx(r + 9, 0), y: pen.oy + y + 2.4, z: pen.wz(r + 9, 0), size: 14 }); for (let k = 0; k < 6; k++) ctx.spark(pen.wx(Math.cos(k) * (r + 16), Math.sin(k) * (r + 16)), pen.oy + y + 2, pen.wz(Math.cos(k) * (r + 16), Math.sin(k) * (r + 16)), acc, 6, 1.4); }
    for (let k = 0; k < prof.length - 1; k++) ctx.solidCyl(0, 0, (prof[k][0] + prof[k + 1][0]) / 2, prof[k][1], prof[k + 1][1]);
    crownSpire(new Vol(ctx, 0, 0, R * 0.6, R * 0.6, H, H), H, Math.min(160, H * 0.2), rng, acc);
    if (brand && ctx.atlas.corp[brand]) { const lg = ctx.atlas.corp[brand].logo; const sz = R * 0.7; for (const f of [0, 2]) { const z = (f === 0 ? 1 : -1) * (rAt(H - 60) + 1.2); pen.sign(0, H - 60, z, FACE_ANG[f], sz, sz, lg, { intensity: 6, seed: f }); ctx.spark(pen.wx(0, z), pen.oy + H - 60, pen.wz(0, z), ctx.atlas.corp[brand].color, 9, 2.6); } }
  },
  // stepped megastructure with garden terraces
  zigg(ctx, rng, a) {
    const { pen } = ctx; const { W, Dd, ph, H, S, acc, fh } = a; const wall = wm(rng, S, fh); const fr = frameOf(wall);
    const n = Math.max(5, Math.min(10, Math.round((H - ph) / 70))); const th = snap((H - ph) / n, fh); let last = null;
    for (let i = 0; i < n; i++) { const k = 0.92 - 0.72 * Math.pow(i / n, 1.25); const v = new Vol(ctx, 0, 0, W * k, Dd * k, ph + i * th, ph + (i + 1) * th);
      for (const f of [0, 1, 2, 3]) facade(v, f, v.y0, v.y1, { wall: { ...wall, seed: wall.seed + i }, bayCells: 2, floorH: fh, jamb: fr, ribs: { d: 1.0, w: 0.8, mat: fr, every: 2 }, belts: { every: 99, d: 1, h: 1, mat: fr } });
      v.roof(M(ST.TILE, { color: [0.3, 0.31, 0.34] })); v.solid(); last = v;
      ctx.main(); pen.use(K.foliage([0.22, 0.42, 0.2])); for (const f of [0, 2]) v.box(f, 2, v.len(f) - 2, -3.2, -1.2, v.y1, v.y1 + 1.1, null, { ends: true });
      K.neonBand(ctx, 0, 0, v.w, v.d, v.y1 - 0.5, acc, { intensity: 5, light: false, nightOnly: true, h: 0.3, main: true });
      if (i % 2 === 1) landingPad(v, rng.pick([0, 1, 2, 3]), v.len(0) * rng.f(0.3, 0.7), v.y0 + snap(th * 0.5, fh), 12, rng, { color: acc });
      for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) ctx.spark(pen.wx(sx * v.w / 2, sz * v.d / 2), pen.oy + v.y1, pen.wz(sx * v.w / 2, sz * v.d / 2), acc, 6, 1.2); }
    crownSpire(new Vol(ctx, 0, 0, last.w * 0.5, last.d * 0.5, last.y1, last.y1), last.y1, Math.min(120, H * 0.16), rng, acc); haloRing(new Vol(ctx, 0, 0, last.w * 0.7, last.d * 0.7, last.y1, last.y1), last.y1 + 6, rng, acc, 0.7);
  },
};

// roof toppers for low-rise shop-houses so a terrace doesn't read as a row of identical boxes
export function roofForm(ctx, rng, v, h, kind, wallM) {
  const pen = ctx.pen; const { cx, cz, w, d } = v; const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2; ctx.main();
  if (kind === 'pent') { // set-back penthouse storey
    const pw = w * rng.f(0.6, 0.85), pd = d * rng.f(0.5, 0.75); const pv = new Vol(ctx, cx + rng.f(-1, 1) * (w - pw) * 0.3, cz - (d - pd) * 0.35, pw, pd, h, h + 3.2);
    facade(pv, 0, h, h + 3.2, { wall: { ...wallM, flags: wallM.flags & 7 }, bayCells: 99, floorH: 3.2 }); for (const f of [1, 2, 3]) blindWall(pv, f, h, h + 3.2, K.conc(0.3), rng, {}); pv.roof(K.conc(0.25)); pv.solid(); return 3.2;
  }
  if (kind === 'vault') { const segs = 6; const rise = w * 0.22; pen.use(M(ST.CORRUGATED, { color: [0.3, 0.31, 0.33], seed: rng.i(0, 255) })); for (let k = 0; k < segs; k++) { const a0 = Math.PI * (k / segs), a1 = Math.PI * ((k + 1) / segs); pen.quad(cx - Math.cos(a0) * w / 2, h + Math.sin(a0) * rise, z1, cx - Math.cos(a1) * w / 2, h + Math.sin(a1) * rise, z1, cx - Math.cos(a1) * w / 2, h + Math.sin(a1) * rise, z0, cx - Math.cos(a0) * w / 2, h + Math.sin(a0) * rise, z0, 0, 0, w / segs, d); } pen.use(K.conc(0.3)); for (const z of [z1, z0]) { const pts = []; for (let k = 0; k <= segs; k++) { const an = Math.PI * (k / segs); pts.push([cx - Math.cos(an) * w / 2, h + Math.sin(an) * rise]); } for (let k = 1; k < segs; k++) { const p = pts[0], q = pts[k], r = pts[k + 1]; z === z1 ? pen.quad(p[0], p[1], z, q[0], q[1], z, r[0], r[1], z, r[0], r[1], z, 0, 0, 1, 1) : pen.quad(p[0], p[1], z, r[0], r[1], z, q[0], q[1], z, q[0], q[1], z, 0, 0, 1, 1); } } ctx.solid(cx, cz, w * 0.7, d, h, h + rise * 0.8); return rise; }
  // shed: mono-pitch falling to the back
  const rise = Math.min(3.2, d * 0.25); pen.use(M(ST.CORRUGATED, { color: [0.32, 0.3, 0.28], seed: rng.i(0, 255) })); pen.quad(x0, h + rise, z1, x1, h + rise, z1, x1, h, z0, x0, h, z0, 0, 0, w, d);
  pen.use(wallM.st ? K.conc(0.32) : K.conc(0.32)); pen.quad(x0, h, z1, x1, h, z1, x1, h + rise, z1, x0, h + rise, z1, 0, h, w, h + rise); pen.quad(x1, h, z1, x1, h, z0, x1, h + rise, z1, x1, h + rise, z1, 0, 0, d, rise); pen.quad(x0, h, z0, x0, h, z1, x0, h + rise, z1, x0, h + rise, z1, 0, 0, d, rise);
  ctx.solid(cx, cz + d * 0.2, w, d * 0.5, h, h + rise * 0.7); return rise;
}
