// Facade toolkit. A Vol is a rectangular building volume in the pen frame; faces are addressed as
// f = 0 (+z, front) · 1 (+x) · 2 (-z, back) · 3 (-x), with face coordinates s (along the wall, CCW seen
// from above), o (outward offset) and y. Everything that sticks out of or cuts into a wall goes through here.
import { ST, FLAG } from '../render/cityMaterial.js';
import { isWindowStyle } from './builder.js';
import * as K from './kit.js';

let uCounter = 3;
// What a flat roof is really covered with, seen from the air: pale membranes, black bitumen, gravel ballast, bare
// slabs, the odd planted roof and metal deck — chosen per roof (deterministic in position) instead of one grey.
const COVERS = [
  [3.0, () => ({ st: ST.CONCRETE, color: [0.6, 0.6, 0.58] })], // white / light grey single-ply membrane
  [1.6, () => ({ st: ST.CONCRETE, color: [0.47, 0.48, 0.5] })], // grey membrane
  [2.0, () => ({ st: ST.CONCRETE, color: [0.1, 0.1, 0.11] })], // bitumen / tar
  [2.0, () => ({ st: ST.PAVE, color: [0.44, 0.41, 0.37] })], // gravel ballast
  [1.6, () => ({ st: ST.CONCRETE, color: [0.31, 0.31, 0.32] })], // weathered slab
  [0.8, () => ({ st: ST.CORRUGATED, color: [0.36, 0.38, 0.4] })], // metal deck
  [0.7, () => ({ st: ST.FOLIAGE, color: [0.2, 0.3, 0.15] }), 70], // sedum / planted roof (low buildings only)
  [0.5, () => ({ st: ST.CONCRETE, color: [0.42, 0.22, 0.18] })], // red coated membrane
];
export function roofCover(x, z, y) {
  let h = Math.imul(Math.round(x * 3) | 0, 73856093) ^ Math.imul(Math.round(z * 3) | 0, 19349663) ^ Math.imul(Math.round(y * 5) | 0, 83492791); h = Math.imul(h ^ (h >>> 13), 1274126177); h = ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  const ok = COVERS.filter((c) => !c[2] || y < c[2]); let t = h * ok.reduce((a, c) => a + c[0], 0);
  for (const c of ok) { t -= c[0]; if (t <= 0) return c[1](); } return ok[0][1]();
}
export const FACE_ANG = [0, Math.PI / 2, Math.PI, -Math.PI / 2];

export class Vol {
  constructor(ctx, cx, cz, w, d, y0, y1) { this.ctx = ctx; this.cx = cx; this.cz = cz; this.w = w; this.d = d; this.y0 = y0; this.y1 = y1; }
  get pen() { return this.ctx.pen; }
  len(f) { return f % 2 === 0 ? this.w : this.d; }
  P(f, s, o) {
    const { cx, cz, w, d } = this;
    if (f === 0) return [cx - w / 2 + s, cz + d / 2 + o];
    if (f === 1) return [cx + w / 2 + o, cz + d / 2 - s];
    if (f === 2) return [cx + w / 2 - s, cz - d / 2 - o];
    return [cx - w / 2 - o, cz - d / 2 + s];
  }
  world(f, s, o) { const p = this.P(f, s, o); return [this.pen.wx(p[0], p[1]), this.pen.wz(p[0], p[1])]; }
  // flat wall piece on face f from s0..s1 at offset o
  wall(f, s0, s1, o, y0, y1, opt = {}) {
    const a = this.P(f, s0, o), b = this.P(f, s1, o);
    this.pen.wall(a[0], a[1], b[0], b[1], y0, y1, opt);
  }
  // return wall (perpendicular) at s between offsets oa → ob (visible side decided by order, see facade())
  ret(f, s, oa, ob, y0, y1) { const a = this.P(f, s, oa), b = this.P(f, s, ob); this.pen.wall(a[0], a[1], b[0], b[1], y0, y1, {}); }
  cap(f, s0, s1, o0, o1, y, up) {
    const p = this.pen; const A = this.P(f, s0, o1), B = this.P(f, s1, o1), C = this.P(f, s1, o0), D = this.P(f, s0, o0);
    if (up) p.quad(A[0], y, A[1], B[0], y, B[1], C[0], y, C[1], D[0], y, D[1], 0, 0, s1 - s0, o1 - o0);
    else p.quad(D[0], y, D[1], C[0], y, C[1], B[0], y, B[1], A[0], y, A[1], 0, 0, s1 - s0, o1 - o0, 0.6, 0.6);
  }
  // box protruding from face f: spans s0..s1, offsets o0..o1 (o1 > o0), y0..y1
  box(f, s0, s1, o0, o1, y0, y1, mat, o = {}) {
    const p = this.pen; if (mat) p.use(mat);
    this.wall(f, s0, s1, o1, y0, y1, o.uv ? { uv: o.uv } : {});
    if (o.ends !== false) { if (mat && o.endMat) p.use(o.endMat); this.ret(f, s0, o0, o1, y0, y1); this.ret(f, s1, o1, o0, y0, y1); }
    if (o.top !== false) { if (o.topMat) p.use(o.topMat); this.cap(f, s0, s1, o0, o1, y1, true); }
    if (o.bottom !== false && y0 > 0.3) { if (o.botMat) p.use(o.botMat); this.cap(f, s0, s1, o0, o1, y0, false); }
  }
  roof(mat, ao = 1) { const p = this.pen; if (mat) p.use(mat && mat.st === ST.CONCRETE && !mat.keep ? roofCover(p.wx(this.cx, this.cz), p.wz(this.cx, this.cz), p.oy + this.y1) : mat); p.flat(this.cx - this.w / 2, this.cz - this.d / 2, this.cx + this.w / 2, this.cz + this.d / 2, this.y1, true, ao); }
  solid() { this.ctx.solid(this.cx, this.cz, this.w, this.d, this.y0, this.y1); }
  inset(dx, dz = dx) { return new Vol(this.ctx, this.cx, this.cz, this.w - dx * 2, this.d - dz * 2, this.y0, this.y1); }
}

/**
 * Relief facade on face f of vol between y0..y1.
 * spec: { wall, floorH, cellW, bayCells=2, depth(b, bays) -> offset per bay (0 flush, <0 recess, >0 proud),
 *         jamb (material for returns), ribs:{d,w,mat,every,detail}, belts:{every,d,h,mat,detail}, aoB }
 */
export function facade(vol, f, y0, y1, spec) {
  const ctx = vol.ctx, pen = vol.pen; const L = vol.len(f); if (L < 0.5 || y1 - y0 < 0.5) return null;
  const win = isWindowStyle(spec.wall.st);
  const floorH = spec.floorH ?? spec.wall.floorH ?? 3.5;
  const floors = Math.max(1, Math.round((y1 - y0) / floorH));
  const cells = Math.max(1, Math.round(L / (spec.cellW ?? spec.wall.cellW ?? 3)));
  const cw = L / cells; const bayCells = Math.min(cells, spec.bayCells ?? 2); const bays = Math.ceil(cells / bayCells);
  const wall = { ...spec.wall, cellW: cw, floorH: (y1 - y0) / floors };
  const uoff = (uCounter = (uCounter * 31 + 7) % 911); const v0 = Math.round((pen.oy + y0) / floorH) % 400;
  const offs = []; for (let b = 0; b < bays; b++) offs.push(spec.depth ? spec.depth(b, bays) : 0);
  const jamb = spec.jamb || K.conc(0.3);
  const main = !spec.detail;
  for (let b = 0; b < bays; b++) {
    const c0 = b * bayCells, c1 = Math.min(cells, c0 + bayCells); const s0 = c0 * cw, s1 = c1 * cw, o = offs[b];
    main ? ctx.main() : ctx.detail();
    pen.use(wall);
    const uv = win ? [uoff + c0, v0, uoff + c1, v0 + floors] : [s0, pen.oy + y0, s1, pen.oy + y1];
    const dr = spec.door;
    if (dr && s1 > dr.s - dr.hw && s0 < dr.s + dr.hw) { // leave a real doorway
      const dA = dr.s - dr.hw, dB = dr.s + dr.hw, dH = y0 + dr.h;
      const piece = (a, b2, ya, yb) => { if (b2 - a < 0.02 || yb - ya < 0.02) return; const uu = (q) => uv[0] + ((uv[2] - uv[0]) * (q - s0)) / (s1 - s0), vv = (q) => uv[1] + ((uv[3] - uv[1]) * (q - y0)) / (y1 - y0); vol.wall(f, a, b2, o, ya, yb, { uv: [uu(a), vv(ya), uu(b2), vv(yb)], aoB: ya === y0 ? (spec.aoB ?? 1) : 1 }); };
      piece(s0, Math.max(s0, dA), y0, y1); piece(Math.min(s1, dB), s1, y0, y1); piece(Math.max(s0, dA), Math.min(s1, dB), dH, y1);
    } else vol.wall(f, s0, s1, o, y0, y1, { uv, aoB: spec.aoB ?? 1 });
    const on = b < bays - 1 ? offs[b + 1] : 0;
    if (Math.abs(o - on) > 0.01) { pen.use(jamb); vol.ret(f, s1, o, on, y0, y1); }
    if (b === 0 && Math.abs(o) > 0.01) { pen.use(jamb); vol.ret(f, 0, 0, o, y0, y1); }
    if (o > 0.01) { pen.use(jamb); vol.cap(f, s0, s1, 0, o, y1, true); if (y0 > 0.3) vol.cap(f, s0, s1, 0, o, y0, false); }
  }
  const dt = spec.ribs && spec.ribs.detail ? () => ctx.detail() : () => ctx.main();
  if (spec.ribs) {
    const r = spec.ribs, every = r.every ?? 1; dt();
    for (let b = 0; b <= bays; b += every) {
      const s = Math.min(L, b * bayCells * cw); if (spec.door && s > spec.door.s - spec.door.hw - r.w / 2 && s < spec.door.s + spec.door.hw + r.w / 2) continue; const ob = Math.min(b < bays ? offs[b] : 0, b > 0 ? offs[b - 1] : 0, 0);
      vol.box(f, Math.max(0, s - r.w / 2), Math.min(L, s + r.w / 2), ob, r.d, y0, y1 + (r.over ?? 0), r.mat, { bottom: false });
    }
  }
  if (spec.belts) {
    const bl = spec.belts; const dtb = bl.detail ? () => ctx.detail() : () => ctx.main(); dtb();
    // belts never share a plane with the ribs (set 4 cm back, ends tucked inside the end ribs) nor with the next face's
    // belts at the corner (each face's belt a few mm higher)
    const rd = spec.ribs ? spec.ribs.d : -1; const bd = Math.abs(bl.d - rd) < 0.03 ? rd - 0.04 : bl.d; const e = spec.ribs ? 0.02 : 0; const fy = f * 0.003;
    for (let fl = bl.every; fl < floors + (bl.top ? 1 : 0); fl += bl.every) { const y = y0 + (fl * (y1 - y0)) / floors + fy; vol.box(f, e, L - e, 0, bd, y - bl.h / 2, y + bl.h / 2, bl.mat); }
  }
  ctx.main();
  const info = { cells, cw, floors, bays, bayW: bayCells * cw, offs, floorH: (y1 - y0) / floors, uoff };
  if (spec.dress && wall.st === ST.WIN_RES) dressFacade(vol, f, y0, info, wall, spec);
  return info;
}

// ---- what people hang on their windows -------------------------------------------------------------------------
// The shader decides where the windows are (one composition per building). This mirrors that decision exactly
// (same hash, same pattern maths) so the things people add land on real windows: an outdoor AC unit under a
// window, a flower box on a sill, a drying rack, a small dish beside the frame — chosen per flat, not per window.
const fr = (v) => v - Math.floor(v);
const gHash = (x, y) => { const F = Math.fround; let px = F(fr(F(x * 123.34))), py = F(fr(F(y * 456.21))); const d = F(px * F(px + 45.32) + py * F(py + 45.32)); px = F(px + d); py = F(py + d); return fr(F(px * py)); };
const jHash = (a, b, c) => { let h = Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663) ^ Math.imul(c | 0, 83492791); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const FLOWERS = [[0.62, 0.12, 0.16], [0.7, 0.42, 0.55], [0.75, 0.62, 0.15], [0.24, 0.42, 0.18], [0.85, 0.82, 0.8]];
const CLOTH = [[0.72, 0.72, 0.74], [0.56, 0.2, 0.2], [0.2, 0.3, 0.52], [0.7, 0.62, 0.4], [0.3, 0.46, 0.36], [0.12, 0.12, 0.14]];
function dressFacade(vol, f, y0, info, wall, spec) {
  const ctx = vol.ctx, pen = vol.pen, D = spec.dress; const seed = (wall.seed ?? 0) & 255; const hb = gHash(seed, 17.0);
  const pat = Math.floor(fr(hb * 13.7) * 5.0), off = Math.floor(fr(hb * 3.1) * 3.0), per = pat < 1.5 ? 2 : 3;
  const pierN = Math.floor(4.0 + hb * 5.0) * (fr(hb * 7.3) >= 0.35 ? 1 : 0), stairOn = fr(hb * 2.9) >= 0.4, uw = 2 + (fr(hb * 7.7) >= 0.5 ? 1 : 0);
  const varA = !!(wall.flags & FLAG.VAR_A); const { cw, floorH: fh, cells, floors, uoff } = info; const csx = cw;
  const baseW = Math.min(csx - 1.0, 1.15 + 0.45 * hb), baseH = Math.min(fh - 1.4, 1.3 + 0.2 * fr(hb * 5.3));
  ctx.detail();
  for (let fl = 0; fl < floors; fl++) {
    if (spec.dressSkip0 && fl === 0) continue; const fy = y0 + fl * fh; const belt = spec.belts && fl > 0 && fl % spec.belts.every === 0;
    for (let c = 0; c < cells; c++) {
      const X = uoff + c; if (pierN > 0 && (X + seed) % pierN === 0) continue; if (stairOn && (X + Math.floor(seed * 0.7)) % 9 === 0) continue;
      const m = (X + off) % per; let has = true, big = false, small = false;
      if (pat === 1) big = m === 0; else if (pat === 2) has = m < 2; else if (pat === 3) { big = m === 0; small = m === 2; } else if (pat === 4) { big = m === 0; has = m < 2; }
      if (!has) continue;
      const unit = Math.floor((X + seed) / uw), hU = jHash(unit, fl, seed + f * 31), hW = jHash(X, fl, seed + 7);
      const sc = (c + 0.5) * cw; const ww = big ? Math.min(csx - 0.6, baseW * 1.35) : small ? 0.62 : baseW; const sill = big ? 0.6 : small ? Math.min(1.6, fh - 0.68 - 0.55) : 0.95;
      const firstOfUnit = (X + seed) % uw === 0 || c === 0;
      // outdoor AC unit under one normal window of the flat
      if (!big && !small && !varA && !belt && firstOfUnit && hU < D.ac) { const p = vol.P(f, sc + (hW - 0.5) * 0.4, 0.2); ctx.propL('acSmall', p[0], fy + 0.06, p[1], FACE_ANG[f], 0.75); }
      // flower boxes along the sills of the flats that keep them
      else if (!small && !varA && fr(hU * 7.3) < D.flower) { const a = sc - ww / 2 - 0.05, b = sc + ww / 2 + 0.05, sy = fy + sill; vol.box(f, a, b, 0, 0.26, sy - 0.26, sy - 0.04, M_POT[Math.floor(hW * 3)], {}); const fl2 = K.foliage(FLOWERS[Math.floor(hW * 5)]); vol.box(f, a + 0.06, b - 0.06, 0.04, 0.3, sy - 0.04, sy + 0.16 + 0.1 * fr(hW * 9.1), fl2, { endMat: fl2 }); }
      // drying rack: two arms out of the wall at the sill, a rail, the washing
      else if (!small && !belt && fr(hU * 3.7) < D.laundry && firstOfUnit) { const a = vol.P(f, sc - 0.6, 0), b = vol.P(f, sc + 0.6, 0), a2 = vol.P(f, sc - 0.6, 0.65), b2 = vol.P(f, sc + 0.6, 0.65), y = fy + sill - 0.05;
        pen.use(K.MAT_POLE); pen.beam(a[0], y, a[1], a2[0], y, a2[1], 0.025, 0.025); pen.beam(b[0], y, b[1], b2[0], y, b2[1], 0.025, 0.025); pen.beam(a2[0], y, a2[1], b2[0], y, b2[1], 0.02, 0.02);
        const n = 2 + Math.floor(hW * 3); for (let k = 0; k < n; k++) { const t0 = (k + 0.1) / n, t1 = (k + 0.85) / n, hh = 0.35 + 0.4 * fr(hW * (k + 3.1)); const q0 = [a2[0] + (b2[0] - a2[0]) * t0, a2[1] + (b2[1] - a2[1]) * t0], q1 = [a2[0] + (b2[0] - a2[0]) * t1, a2[1] + (b2[1] - a2[1]) * t1];
          pen.use(M_CLOTH(CLOTH[Math.floor(fr(hW * (k + 1.7)) * CLOTH.length)], k)); pen.quad(q0[0], y - hh, q0[1], q1[0], y - hh, q1[1], q1[0], y, q1[1], q0[0], y, q0[1], 0, 0, 1, 1); pen.quad(q1[0], y - hh, q1[1], q0[0], y - hh, q0[1], q0[0], y, q0[1], q1[0], y, q1[1], 0, 0, 1, 1); } }
      // a small dish on a bracket beside the frame
      if (!belt && fr(hU * 11.9) < D.dish && firstOfUnit && sc - ww / 2 > 0.55) { const p = vol.P(f, sc - ww / 2 - 0.35, 0.3); ctx.propL('dish', p[0], fy + 1.5, p[1], FACE_ANG[f] + Math.PI, 0.26); }
    }
  }
  ctx.main();
}
const M_CLOTH = (c, k) => ({ st: ST.FABRIC, color: c, seed: k });
const M_POT = [{ st: ST.CONCRETE, color: [0.5, 0.28, 0.18] }, { st: ST.METAL, color: [0.2, 0.22, 0.2] }, { st: ST.CONCRETE, color: [0.62, 0.6, 0.56] }];

// plain (blind) wall on a face, optionally with a faded painted mural / number
export function blindWall(vol, f, y0, y1, mat, rng, o = {}) {
  const pen = vol.pen; pen.use(mat); vol.wall(f, 0, vol.len(f), 0, y0, y1, { aoB: o.aoB ?? 1 });
  if (o.mural && y1 - y0 > 14 && vol.len(f) > 9) {
    const at = vol.ctx.atlas; const L = vol.len(f);
    vol.ctx.detail();
    if (rng.chance(0.5)) { const rect = at.pickBB(rng); const w = Math.min(L * 0.8, 26), h = w / rect.aspect; const p = vol.P(f, L / 2, 0.06); pen.sign(p[0], y0 + (y1 - y0) * rng.f(0.55, 0.8), p[1], FACE_ANG[f], w, h, rect, { intensity: 0.5, seed: rng.i(0, 255) }); }
    else { const keys = Object.keys(at.decal); const rect = at.decal[rng.pick(keys)]; const w = Math.min(L * 0.5, 10); const p = vol.P(f, L / 2, 0.06); pen.sign(p[0], y0 + (y1 - y0) * rng.f(0.6, 0.85), p[1], FACE_ANG[f], w, w, rect, { intensity: 0.25, seed: rng.i(0, 255) }); }
    vol.ctx.main();
  }
}

// one horizontal shop sign centred on a stretch of face f (no overlaps: caller owns the stretch)
export function shopSign(vol, f, s0, s1, y, rng, o = {}) {
  const ctx = vol.ctx, at = ctx.atlas; const rect = o.rect || at.pickH(rng); const maxW = (s1 - s0) - 0.4; if (maxW < 1.6) return 0;
  const w = Math.min(maxW, o.maxW ?? 9, Math.max(2.4, maxW * rng.f(0.8, 1))); const h = Math.min(w / rect.aspect, o.maxH ?? 2.2); const ww = h * rect.aspect;
  const p = vol.P(f, (s0 + s1) / 2, o.out ?? 0.22);
  ctx.detail();
  vol.box(f, (s0 + s1) / 2 - ww / 2 - 0.08, (s0 + s1) / 2 + ww / 2 + 0.08, 0, (o.out ?? 0.22) - 0.02, y - h / 2 - 0.08, y + h / 2 + 0.08, K.dark(0.07));
  vol.pen.sign(p[0], y, p[1], FACE_ANG[f], ww, h, rect, { seed: rng.i(0, 255), intensity: o.intensity ?? 4.5 });
  const lp = vol.world(f, (s0 + s1) / 2, 2.5); ctx.light(lp[0], lp[1], o.radius ?? Math.max(10, ww * 2), rect.glow || [1, 0.8, 0.6], o.power ?? 0.55, vol.pen.oy + y);
  { const gc = rect.glow || [1, 0.8, 0.6]; const oo = (o.out ?? 0.22) + 0.06; const a = vol.world(f, (s0 + s1) / 2 - ww / 2 - 0.5, oo), b = vol.world(f, (s0 + s1) / 2 + ww / 2 + 0.5, oo); const y0 = vol.pen.oy + y - h / 2, y1 = vol.pen.oy + y + h / 2;
    void gc; void a; void b; void y0; void y1; }
  ctx.main();
  return h;
}
// projecting blade sign at position s on face f
export function bladeSign(vol, f, s, y, hgt, rng, o = {}) {
  const ctx = vol.ctx; const rect = o.rect || ctx.atlas.pickV(rng); const w = hgt * rect.aspect;
  const a = vol.P(f, s, 0), c = vol.P(f, s, w / 2 + 0.35);
  ctx.detail(); const pen = vol.pen;
  pen.use(K.dark(0.07)); vol.box(f, s - 0.08, s + 0.08, 0.3, w + 0.42, y - hgt / 2 - 0.06, y + hgt / 2 + 0.06, null, {});
  // the two faces sit just outside the backing box
  const n = [Math.sin(FACE_ANG[f] + Math.PI / 2), Math.cos(FACE_ANG[f] + Math.PI / 2)];
  pen.sign(c[0] + n[0] * 0.125, y, c[1] + n[1] * 0.125, FACE_ANG[f] + Math.PI / 2, w, hgt, rect, { seed: rng.i(0, 255), intensity: o.intensity ?? 4.5 });
  pen.sign(c[0] - n[0] * 0.125, y, c[1] - n[1] * 0.125, FACE_ANG[f] - Math.PI / 2, w, hgt, rect, { seed: rng.i(0, 255), intensity: o.intensity ?? 4.5 });
  pen.use(K.MAT_POLE); pen.beam(a[0], y + hgt * 0.4, a[1], c[0], y + hgt * 0.4, c[1], 0.07, 0.07); pen.beam(a[0], y - hgt * 0.4, a[1], c[0], y - hgt * 0.4, c[1], 0.07, 0.07);
  const lp = vol.world(f, s, w + 2); ctx.light(lp[0], lp[1], o.radius ?? Math.max(9, hgt * 2), rect.glow || [1, 0.6, 0.4], o.power ?? 0.45, pen.oy + y);
  ctx.main();
}
// big LED video wall on a stretch of a face
export function screenWall(vol, f, s0, s1, y0, y1, rng, o = {}) {
  const ctx = vol.ctx; const w = s1 - s0, h = y1 - y0; if (w < 3 || h < 2) return;
  ctx.main(); const pen = vol.pen;
  vol.box(f, s0 - 0.4, s1 + 0.4, 0, 0.5, y0 - 0.4, y1 + 0.4, K.dark(0.06));
  pen.use({ st: ST.SCREEN, color: [1, 1, 1], seed: rng.i(0, 255), cellW: Math.min(25, w), floorH: Math.min(25, h), extra: (o.intensity ?? 3.2) * 10 });
  vol.wall(f, s0, s1, 0.56, y0, y1, { uv: [0, 0, 1, 1] });
  const lp = vol.world(f, (s0 + s1) / 2, 6); ctx.light(lp[0], lp[1], Math.max(30, w * 2.2), o.color || rng.pick(K.NEON_LIST), 0.9, pen.oy + (y0 + y1) / 2);
}
