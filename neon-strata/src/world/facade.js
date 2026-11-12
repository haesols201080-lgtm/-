// Facade toolkit. A Vol is a rectangular building volume in the pen frame; faces are addressed as
// f = 0 (+z, front) · 1 (+x) · 2 (-z, back) · 3 (-x), with face coordinates s (along the wall, CCW seen
// from above), o (outward offset) and y. Everything that sticks out of or cuts into a wall goes through here.
import { ST } from '../render/cityMaterial.js';
import { isWindowStyle } from './builder.js';
import * as K from './kit.js';

let uCounter = 3;
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
  roof(mat, ao = 1) { const p = this.pen; if (mat) p.use(mat); p.flat(this.cx - this.w / 2, this.cz - this.d / 2, this.cx + this.w / 2, this.cz + this.d / 2, this.y1, true, ao); }
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
    vol.wall(f, s0, s1, o, y0, y1, { uv, aoB: spec.aoB ?? 1 });
    const on = b < bays - 1 ? offs[b + 1] : 0;
    if (Math.abs(o - on) > 0.01) { pen.use(jamb); vol.ret(f, s1, o, on, y0, y1); }
    if (b === 0 && Math.abs(o) > 0.01) { pen.use(jamb); vol.ret(f, 0, 0, o, y0, y1); }
    if (o > 0.01) { pen.use(jamb); vol.cap(f, s0, s1, 0, o, y1, true); if (y0 > 0.3) vol.cap(f, s0, s1, 0, o, y0, false); }
  }
  const dt = spec.ribs && spec.ribs.detail ? () => ctx.detail() : () => ctx.main();
  if (spec.ribs) {
    const r = spec.ribs, every = r.every ?? 1; dt();
    for (let b = 0; b <= bays; b += every) {
      const s = Math.min(L, b * bayCells * cw); const ob = Math.min(b < bays ? offs[b] : 0, b > 0 ? offs[b - 1] : 0, 0);
      vol.box(f, Math.max(0, s - r.w / 2), Math.min(L, s + r.w / 2), ob, r.d, y0, y1 + (r.over ?? 0), r.mat, { bottom: false });
    }
  }
  if (spec.belts) {
    const bl = spec.belts; const dtb = bl.detail ? () => ctx.detail() : () => ctx.main(); dtb();
    for (let fl = bl.every; fl < floors + (bl.top ? 1 : 0); fl += bl.every) { const y = y0 + (fl * (y1 - y0)) / floors; vol.box(f, 0, L, 0, bl.d, y - bl.h / 2, y + bl.h / 2, bl.mat); }
  }
  ctx.main();
  return { cells, cw, floors, bays, bayW: bayCells * cw, offs, floorH: (y1 - y0) / floors };
}

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
  ctx.main();
  return h;
}
// projecting blade sign at position s on face f
export function bladeSign(vol, f, s, y, hgt, rng, o = {}) {
  const ctx = vol.ctx; const rect = o.rect || ctx.atlas.pickV(rng); const w = hgt * rect.aspect;
  const a = vol.P(f, s, 0), c = vol.P(f, s, w / 2 + 0.35);
  ctx.detail(); const pen = vol.pen;
  pen.use(K.dark(0.07)); vol.box(f, s - 0.09, s + 0.09, 0.3, w + 0.42, y - hgt / 2 - 0.06, y + hgt / 2 + 0.06, null, {});
  // the two faces sit just outside the backing box
  const n = [Math.sin(FACE_ANG[f] + Math.PI / 2), Math.cos(FACE_ANG[f] + Math.PI / 2)];
  pen.sign(c[0] + n[0] * 0.1, y, c[1] + n[1] * 0.1, FACE_ANG[f] + Math.PI / 2, w, hgt, rect, { seed: rng.i(0, 255), intensity: o.intensity ?? 4.5 });
  pen.sign(c[0] - n[0] * 0.1, y, c[1] - n[1] * 0.1, FACE_ANG[f] - Math.PI / 2, w, hgt, rect, { seed: rng.i(0, 255), intensity: o.intensity ?? 4.5 });
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
