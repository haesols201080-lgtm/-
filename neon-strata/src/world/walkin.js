// Every ordinary building can be walked into. At generation a building only records its plan (footprint, ground floor,
// storeys, street-front units and their doors) and keeps one solid collider. When the player comes close, the solid is
// switched off and the real building is built in its place: perimeter walls with real door openings, a ground floor
// split into its shops / hall / garage, a switchback stair to every storey, and each storey laid out as flats (or
// offices) off a corridor, all furnished and with people in it. Walking away puts the solid back and frees the geometry.
import * as THREE from 'three';
import { ST, FLAG } from '../render/cityMaterial.js';
import { M, Batch, Pen } from './builder.js';
import * as K from './kit.js';
import { PROPS } from './props.js';
import { U } from '../render/env.js';

const IN = FLAG.INDOOR;
const im = (st, color, extra = {}) => M(st, { color, flags: IN, ...extra });
const glow = (col, i = 6) => { const e = K.emis(col, i); e.flags = 0; return e; };
const SHOP_NAME = ['store', 'bar', 'tech', 'store'];
const CORR = 3.7; // depth of the service corridor along the back wall (two stair bands + a landing walkway)

// v: the building Vol (pen frame); o: { gh, fh, n, units:[{s0,s1,kind,door,dw}], office }
export function registerWalkin(ctx, rng, v, o) {
  const pen = ctx.pen; const col = ctx.solid(v.cx, v.cz, v.w, v.d, v.y0, v.y1);
  const rec = { ox: pen.ox, oy: pen.oy, oz: pen.oz, yaw: pen.yaw, x0: v.cx - v.w / 2, x1: v.cx + v.w / 2, z0: v.cz - v.d / 2, z1: v.cz + v.d / 2, gh: o.gh, fh: o.fh, n: Math.max(0, o.n | 0), top: v.y1, units: o.units || [], office: !!o.office, allOffice: !!o.allOffice, seed: rng.i(0, 1e9), col, cols: null };
  const C = Math.cos(rec.yaw), S = Math.sin(rec.yaw); const W = (lx, lz) => [rec.ox + lx * C + lz * S, rec.oz - lx * S + lz * C];
  rec.cx = (rec.x0 + rec.x1) / 2; rec.cz = (rec.z0 + rec.z1) / 2; [rec.wx, rec.wz] = W(rec.cx, rec.cz); rec.r = Math.hypot(v.w, v.d) / 2;
  // the shops trade and hire for real: a POI per shop with its work stations inside
  const deep = rec.z1 - rec.z0 > CORR + 3.2;
  for (const u of rec.units) {
    if (typeof u.kind !== 'number') continue; const xa = rec.x0 + u.s0, xb = rec.x0 + u.s1, zf = rec.z1 - 0.4, zb = deep ? rec.z0 + CORR + 0.3 : rec.z0 + 0.4, xm = (xa + xb) / 2;
    const P = (lx, lz) => { const [x, z] = W(lx, lz); return { x, y: rec.oy + 0.03, z }; };
    const work = { back: P(xm, zb + 1.3), front: P(rec.x0 + u.door, zf - 1.3), side: P(xa + 1.0, (zb + zf) / 2), upA: null, upB: P(xb - 1.0, (zb + zf) / 2) };
    const dp = P(rec.x0 + u.door, rec.z1 + 2.2);
    ctx.poi({ type: 'shop', kind: SHOP_NAME[u.kind], district: o.district, x: work.back.x, y: work.back.y, z: work.back.z, doorX: dp.x, doorZ: dp.z, work, walkin: true });
  }
  if (rec.n >= 1 && !o.allOffice) { const [fx, fz] = W(rec.x0 + 0.4 + Math.min(rec.x1 - rec.x0 - 1.4, Math.max(4.6, rec.gh * 1.25)) + 1.2, deep ? rec.z0 + 3.1 : rec.z0 + 2.9); ctx.poi({ type: 'flat', x: fx, y: rec.oy + 0.03, z: fz, name: '세대 ' + (rec.n * Math.max(1, Math.round((rec.x1 - rec.x0) / 7.5))) + '호 건물', rent: Math.round(14 + (rec.x1 - rec.x0) * 0.4 + rec.n * 0.6), district: o.district }); }
  (ctx.walkins || (ctx.walkins = [])).push(rec);
  return rec;
}

// ------------------------------------------------------------------------------------ the building, built on demand
function plan(rec) {
  const { x0, x1, z0, z1, gh, fh, n } = rec; const W = x1 - x0, D = z1 - z0; const deep = D > CORR + 3.2;
  const run = Math.min(W - 1.4, Math.max(4.6, gh * 1.25)); const lv = [0]; for (let k = 1; k <= n; k++) lv.push(gh + (k - 1) * fh);
  const band = (k) => (k % 2 ? [z0 + 0.35, z0 + 1.45] : [z0 + 1.5, z0 + 2.6]);
  return { W, D, deep, run, lv, band, sx0: x0 + 0.4, sx1: x0 + 0.4 + run };
}

function colliders(rec, phys) {
  const P = plan(rec); const { x0, x1, z0, z1, top } = rec; const C = Math.cos(rec.yaw), S = Math.sin(rec.yaw); const cols = [];
  const B = (xa, xb, za, zb, ya, yb) => { if (xb - xa < 0.05 || zb - za < 0.05 || yb - ya < 0.05) return; const cx = (xa + xb) / 2, cz = (za + zb) / 2; cols.push(phys.addBox(rec.ox + cx * C + cz * S, rec.oz - cx * S + cz * C, (xb - xa) / 2, (zb - za) / 2, rec.yaw, rec.oy + ya, rec.oy + yb)); };
  const BH = (ya, yb, h) => { B(x0, h[0], z0, z1, ya, yb); B(h[1], x1, z0, z1, ya, yb); B(h[0], h[1], z0, h[2], ya, yb); B(h[0], h[1], h[3], z1, ya, yb); };
  const t = 0.3;
  // perimeter: back and sides full height, front full above the ground floor and between the door openings below it
  B(x0, x1, z0, z0 + t, 0, top); B(x0, x0 + t, z0, z1, 0, top); B(x1 - t, x1, z0, z1, 0, top); B(x0, x1, z1 - t, z1, rec.gh, top);
  const gaps = rec.units.filter((u) => u.door != null).map((u) => [x0 + u.door - (u.dw || 1.2) / 2, x0 + u.door + (u.dw || 1.2) / 2]).sort((a, b) => a[0] - b[0]); let xs = x0;
  for (const g of gaps) { B(xs, g[0], z1 - t, z1, 0, rec.gh); B(g[0], g[1], z1 - t, z1, Math.min(rec.gh, 2.5), rec.gh); xs = g[1]; } B(xs, x1, z1 - t, z1, 0, rec.gh);
  // storeys: slab with the stair opening of the flight that arrives there, then the flight itself
  for (let k = 1; k <= rec.n; k++) { const y = P.lv[k], b = P.band(k); BH(y - 0.3, y, [P.sx0, P.sx1, b[0], b[1]]);
    const cz = (b[0] + b[1]) / 2, cx = (P.sx0 + P.sx1) / 2, ry = rec.yaw + (k % 2 ? Math.PI : 0); cols.push(phys.addRamp(rec.ox + cx * C + cz * S, rec.oz - cx * S + cz * C, P.run / 2, 0.55, ry, rec.oy + P.lv[k - 1] + 0.03, rec.oy + y, 0.6)); }
  for (let k = 1; k <= rec.n; k++) { const y = P.lv[k], bb = P.band(k), gx0 = k % 2 ? P.sx0 + 1.2 : P.sx0, gx1 = k % 2 ? P.sx1 : P.sx1 - 1.2; B(gx0, gx1, bb[1] - 0.02, bb[1] + 0.06, y, y + 1.05); if (!(k % 2)) B(gx0, gx1, bb[0] - 0.06, bb[0] + 0.02, y, y + 1.05); }
  B(x0, x1, z0, z1, top - 0.3, top);
  // ground floor: the corridor wall behind the street units (with a door each), partitions between units
  if (P.deep) { const zc = z0 + CORR; let xa = x0; const doors = rec.units.length ? rec.units.map((u) => [x0 + u.s0 + 0.6, x0 + u.s0 + 1.6]) : [[x0 + 0.6, x0 + 1.6]];
    for (const d of doors) { B(xa, d[0], zc - 0.06, zc + 0.06, 0, rec.gh - 0.3); B(d[0], d[1], zc - 0.06, zc + 0.06, 2.3, rec.gh - 0.3); xa = d[1]; } B(xa, x1, zc - 0.06, zc + 0.06, 0, rec.gh - 0.3);
    for (let i = 1; i < rec.units.length; i++) { const x = x0 + rec.units[i].s0; B(x - 0.06, x + 0.06, zc, z1 - t, 0, rec.gh - 0.3); } }
  // upper storeys: corridor wall and flat partitions
  for (let k = 1; k <= rec.n; k++) { const y = P.lv[k], yc = (k < rec.n ? P.lv[k + 1] : top) - 0.3; for (const w of flats(rec, P, k).walls) { const tt = 0.09; if (Math.abs(w[1] - w[3]) < 1e-3) B(Math.min(w[0], w[2]), Math.max(w[0], w[2]), w[1] - tt, w[1] + tt, y + (w[4] ?? 0), Math.min(yc, y + (w[5] ?? 9))); else B(w[0] - tt, w[0] + tt, Math.min(w[1], w[3]), Math.max(w[1], w[3]), y, yc); } }
  for (const c of cols) c._y1 = c.y1;
  return cols;
}

// flats (or an office) on storey k: front band split into dwellings, each with a door on the corridor
function flats(rec, P, k) {
  const { x0, x1, z0, z1 } = rec; const zc = z0 + CORR; const walls = [], units = [];
  if (!P.deep) { units.push({ x0: x0 + 0.3, x1: x1 - 0.3, zd: z0 + 2.7, zw: z1 - 0.3, office: false, open: true }); return { walls, units }; }
  if ((rec.office && k === 1) || rec.allOffice) { walls.push([x0, zc, x0 + 0.6, zc], [x0 + 1.8, zc, x1, zc], [x0 + 0.6, zc, x0 + 1.8, zc, 2.3, 9]); units.push({ x0: x0 + 0.3, x1: x1 - 0.3, zd: zc, zw: z1 - 0.3, office: true }); return { walls, units }; }
  const W = x1 - x0; const nF = Math.max(1, Math.round(W / 7.5)); const fw = W / nF;
  for (let i = 0; i < nF; i++) { const xa = x0 + i * fw, xb = xa + fw, dx = Math.min(xb - 1.4, xa + 0.6);
    walls.push([xa, zc, dx, zc], [dx + 1.0, zc, xb, zc], [dx, zc, dx + 1.0, zc, 2.2, 9]); if (i > 0) walls.push([xa, zc, xa, z1]);
    units.push({ x0: xa + (i ? 0.06 : 0.3), x1: xb - (i < nF - 1 ? 0.06 : 0.3), zd: zc, zw: z1 - 0.3, door: dx }); }
  return { walls, units };
}

// visuals
function fitOut(rec, pen) {
  const P = plan(rec); const { x0, x1, z0, z1, gh, top } = rec; const C = Math.cos(rec.yaw), S = Math.sin(rec.yaw); const spots = [], walks = [];
  const solids = []; const SZ = { shelf: [2.1, 0.5, 2.1], rack: [2.0, 0.6, 2.2], desk: [1.5, 1.7, 0.78, 0, -0.35], bed: [1.7, 2.1, 0.7], bedH: [1.0, 2.1, 0.7], sofa: [1.0, 2.0, 0.9], sdesk: [0.66, 1.1, 0.72, 0, -0.25], kiosk: [0.7, 0.5, 1.2] };
  let curY = 0; let rs = rec.seed; const r = () => ((rs = (rs * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const W = (lx, lz) => [rec.ox + lx * C + lz * S, rec.oz - lx * S + lz * C]; const home = () => pen.at(rec.ox, rec.oy, rec.oz, rec.yaw);
  const prop = (name, lx, ly, lz, ry = 0) => { const [x, z] = W(lx, lz); pen.at(x, rec.oy + ly, z, rec.yaw + ry); PROPS[name](pen); home(); const q = SZ[name]; if (q) { const ox = q[3] || 0, oz = q[4] || 0; const cx = lx + ox * Math.cos(ry) + oz * Math.sin(ry), cz = lz - ox * Math.sin(ry) + oz * Math.cos(ry); solids.push([cx, cz, q[0] / 2, q[1] / 2, ry, ly, ly + q[2]]); } else if (name === 'table') solids.push([lx, lz, 0.45, 0.45, 0, ly, ly + 0.75]); };
  const block = (lx, lz, sx, sz, y0, y1) => solids.push([lx, lz, sx / 2, sz / 2, 0, y0, y1]);
  const seat = (lx, ly, lz, ry, o) => { const [x, z] = W(lx, lz); spots.push({ x, y: rec.oy + ly, z, yaw: rec.yaw + ry, indoor: true, ...o }); };
  const walk = (pts, closed) => walks.push({ pts: pts.map(([lx, ly, lz]) => { const [x, z] = W(lx, lz); return [x, rec.oy + ly + 0.03, z]; }), closed, district: 'core', indoor: true, latMax: 0.25 });
  home();
  const plate = (y, mat, up, hole) => { pen.use(mat); const R = (a, b, c, d) => { if (b - a > 0.05 && d - c > 0.05) pen.flat(a, c, b, d, y, up); }; const xa = x0 + 0.3, xb = x1 - 0.3, za = z0 + 0.3, zb = z1 - 0.3; if (!hole) return R(xa, xb, za, zb); R(xa, hole[0], za, zb); R(hole[1], xb, za, zb); R(hole[0], hole[1], za, hole[2]); R(hole[0], hole[1], hole[3], zb); };
  const wallsAround = (y, yc, mat, glazedFront, glazedBack, shopFront) => { pen.use(mat); const xa = x0 + 0.3, xb = x1 - 0.3, za = z0 + 0.3, zb = z1 - 0.3;
    pen.wall(xa, zb, xa, za, y, yc, { aoB: 0.7 }); pen.wall(xb, za, xb, zb, y, yc, { aoB: 0.7 });
    if (glazedBack) { pen.wall(xa, za, xb, za, y, y + 0.9, { aoB: 0.7 }); pen.wall(xa, za, xb, za, yc - 0.55, yc, {}); } else pen.wall(xa, za, xb, za, y, yc, { aoB: 0.7 });
    if (shopFront) pen.wall(xb, zb, xa, zb, y + gh - 0.75, yc, {}); else if (glazedFront) { pen.wall(xb, zb, xa, zb, y, y + 0.9, { aoB: 0.7 }); pen.wall(xb, zb, xa, zb, yc - 0.55, yc, {}); } else pen.wall(xb, zb, xa, zb, y, yc, { aoB: 0.7 }); };
  const panels = (y, x0a, x1a, z0a, z1a, col = [1, 0.95, 0.86], i = 4) => { pen.use(glow(col, i)); for (let x = x0a + 1.4; x < x1a - 0.8; x += 3.2) for (let z = z0a + 1.2; z < z1a - 0.6; z += 3.0) pen.flat(x - 0.5, z - 0.25, x + 0.5, z + 0.25, y - 0.02, false); };
  const twoSided = (w, y0, y1, mat) => { const t = 0.16, along = Math.abs(w[1] - w[3]) < 1e-3; const cx = (w[0] + w[2]) / 2, cz = (w[1] + w[3]) / 2, L = Math.abs(along ? w[2] - w[0] : w[3] - w[1]); if (L < 0.02) return; pen.box(cx, cz, along ? L : t, along ? t : L, y0, y1, { wall: mat, roof: mat, bottom: mat, aoB: 0.75 }); };
  const stairs = (k) => { const b = P.band(k), yA = P.lv[k - 1], yB = P.lv[k]; const n = Math.max(8, Math.round((yB - yA) / 0.18)); const sm = im(ST.CONCRETE, [0.56, 0.55, 0.53]), tr = im(ST.STONE, [0.46, 0.45, 0.43]); const up = k % 2 ? -1 : 1;
    for (let i = 0; i < n; i++) { const xa = up > 0 ? P.sx0 + (i / n) * P.run : P.sx1 - ((i + 1) / n) * P.run; pen.box(xa + P.run / n / 2, (b[0] + b[1]) / 2, P.run / n + 0.005, b[1] - b[0] - 0.04, yA, yA + (i + 1) * ((yB - yA) / n), { wall: sm, roof: tr, bottom: sm }); }
    const zr = k % 2 ? b[1] - 0.04 : b[0] + 0.04, xs = up > 0 ? P.sx0 : P.sx1, xe = up > 0 ? P.sx1 : P.sx0; pen.use(im(ST.METAL, [0.24, 0.24, 0.26])); pen.beam(xs, yA + 1.0, zr, xe, yB + 1.0, zr, 0.05, 0.05); for (let q = 0; q <= 4; q++) { const t = q / 4, x = xs + (xe - xs) * t, yy = yA + (yB - yA) * t; pen.box(x, zr, 0.04, 0.04, yy, yy + 1.0, {}); } };
  const wallCol = [[0.82, 0.8, 0.74], [0.74, 0.78, 0.8], [0.84, 0.76, 0.68], [0.7, 0.74, 0.7]];
  const zc = z0 + CORR;

  // ---- ground floor
  { const yc = (rec.n ? P.lv[1] : top) - 0.3; const shopFront = rec.units.some((u) => typeof u.kind === 'number');
    { pen.use(im(ST.TILE, [0.5, 0.5, 0.52])); const za = z0 + 0.3, zb = z1 - 0.3, zc2 = P.deep ? z0 + CORR : za; if (P.deep) pen.flat(x0 + 0.3, za, x1 - 0.3, zc2, 0.06); let xa = x0 + 0.3; const gar = rec.units.filter((u) => u.kind === 'garage').map((u) => [x0 + u.s0, x0 + u.s1]).sort((p, q) => p[0] - q[0]); for (const g of gar) { if (g[0] - xa > 0.05) pen.flat(xa, zc2, g[0], zb, 0.06); xa = g[1]; } if (x1 - 0.3 - xa > 0.05) pen.flat(xa, zc2, x1 - 0.3, zb, 0.06); } plate(yc, im(ST.TILE, [0.78, 0.78, 0.76]), false, rec.n ? [P.sx0, P.sx1, P.band(1)[0], P.band(1)[1]] : null);
    wallsAround(0, yc, im(ST.PLASTER, wallCol[rec.seed % 4]), true, false, shopFront); if (rec.n) stairs(1);
    if (P.deep) { const doors = rec.units.length ? rec.units.map((u) => [x0 + u.s0 + 0.6, x0 + u.s0 + 1.6]) : [[x0 + 0.6, x0 + 1.6]]; let xa = x0 + 0.3; const wm = im(ST.PLASTER, [0.7, 0.7, 0.68]);
      for (const d of doors) { twoSided([xa, zc, d[0], zc], 0, yc, wm); twoSided([d[0], zc, d[1], zc], 2.3, yc, wm); xa = d[1]; } twoSided([xa, zc, x1 - 0.3, zc], 0, yc, wm);
      for (let i = 1; i < rec.units.length; i++) { const x = x0 + rec.units[i].s0; twoSided([x, zc, x, z1 - 0.3], 0, yc, wm); }
      panels(yc, x0, x1, z0, zc, [0.9, 0.95, 1], 3); walk([[P.sx1 + 0.6, 0, z0 + 3.1], [x1 - 0.9, 0, z0 + 3.1]], false); }
    // door reveals: the wall has its real thickness where you walk through it
    for (const u of rec.units) { if (u.door == null) continue; const d0 = x0 + u.door - (u.dw || 1.2) / 2, d1 = x0 + u.door + (u.dw || 1.2) / 2, ht = Math.min(gh, 2.5), rv = im(ST.CONCRETE, [0.55, 0.54, 0.52]); pen.use(rv); pen.wall(d0, z1 - 0.3, d0, z1, 0.03, ht, {}); pen.wall(d1, z1, d1, z1 - 0.3, 0.03, ht, {}); pen.flat(d0, z1 - 0.3, d1, z1, ht, false); pen.use(im(ST.STONE, [0.4, 0.4, 0.4])); pen.flat(d0, z1 - 0.3, d1, z1 + 0.02, 0.07); }
    for (const u of rec.units) { const xa = x0 + u.s0 + 0.3, xb = x0 + u.s1 - 0.3, za = P.deep ? zc + 0.1 : z0 + 0.4, zb = z1 - 0.4, xm = (xa + xb) / 2, w = xb - xa; if (w < 1.8) continue;
      panels(yc, xa, xb, za, zb, typeof u.kind === 'number' ? [1, 0.96, 0.88] : [1, 0.88, 0.7], typeof u.kind === 'number' ? 6 : 4);
      if (u.kind === 0 || u.kind === 3) { // store / pharmacy: wall shelving, a gondola run, the till by the door
        for (let z = za + 1.25; z < zb - 2.3; z += 2.3) { prop('shelf', xa + 0.3, 0, z, Math.PI / 2); if (w > 4.5) prop('shelf', xb - 0.3, 0, z, -Math.PI / 2); }
        if (w > 6.4) for (let z = za + 1.25; z < zb - 2.6; z += 2.3) prop('shelf', xm, 0, z, Math.PI / 2);
        block(xb - 1.1, zb - 1.6, 1.6, 0.7, 0, 1.0); pen.box(xb - 1.1, zb - 1.6, 1.6, 0.7, 0, 1.0, { wall: im(ST.COMPOSITE, [0.24, 0.24, 0.27]), roof: im(ST.TILE, [0.75, 0.75, 0.74]) }); pen.use(glow([0.5, 0.85, 1], 3)); pen.box(xb - 1.1, zb - 1.6, 0.34, 0.06, 1.0, 1.28, {});
        seat(xb - 1.1, 0.03, zb - 2.3, 0, { clip: 'idle' }); if (r() < 0.6) seat(xm + 0.3, 0.03, (za + zb) / 2, r() * 6.28, { clip: 'idle' }); }
      else if (u.kind === 1) { // eatery: tables, a counter with the kitchen pass behind
        block(xm, za + 0.8, w - 0.4, 0.7, 0, 1.05); pen.box(xm, za + 0.8, w - 0.4, 0.7, 0, 1.05, { wall: im(ST.RUST, [0.36, 0.26, 0.2]), roof: im(ST.TILE, [0.36, 0.34, 0.32]) }); pen.use(glow([1, 0.82, 0.55], 4)); pen.wall(xa + 0.2, za + 0.12, xb - 0.2, za + 0.12, 1.5, 2.3, {});
        for (let z = za + 2.4; z < zb - 1.0; z += 2.3) for (let x = xa + 1.0; x < xb - 0.8; x += 2.2) { prop('table', x, 0, z, 0); for (let q = 0; q < 3; q++) if (r() < 0.5) { const an = q * 2.094 + 0.5; seat(x + Math.cos(an) * 0.74, 0.03, z + Math.sin(an) * 0.74, Math.atan2(-Math.cos(an), -Math.sin(an)), { sit: true }); } }
        seat(xm, 0.03, za + 0.35, 0, { clip: 'idle' }); }
      else if (u.kind === 2) { // repair shop: racks of stock, a workbench, a service counter
        for (let z = za + 1.2; z < zb - 2.2; z += 2.3) prop('rack', xa + 0.35, 0, z, Math.PI / 2); prop('desk', xm + 0.4, 0, za + 1.2, Math.PI); block(xb - 1.0, zb - 1.5, 1.6, 0.7, 0, 1.05); pen.box(xb - 1.0, zb - 1.5, 1.6, 0.7, 0, 1.05, { wall: im(ST.COMPOSITE, [0.2, 0.22, 0.26]), roof: im(ST.TILE, [0.6, 0.62, 0.66]) }); seat(xm + 0.4, 0.03, za + 1.85, 0, { sit: true }); }
      else if (u.kind === 'entry') { prop('planterIn', xa + 0.6, 0, zb - 0.7, 0); pen.box(xb - 0.3, (za + zb) / 2, 0.24, 1.6, 1.0, 1.9, { wall: im(ST.METAL, [0.5, 0.48, 0.42]), roof: im(ST.METAL, [0.5, 0.48, 0.42]) }); }
      else if (u.kind === 'res') { furnishFlat(u.s0, u.s1, za, zb); }
    }
    if (!P.deep && !rec.units.length) furnishFlat(0, rec.x1 - rec.x0, z0 + 2.8, z1 - 0.4);
  }
  // ---- storeys
  function furnishFlat(s0, s1, zd, zw) { // a dwelling: living room at the window, kitchen run on the corridor side, bedroom behind a partition
    const xa = x0 + s0 + 0.35, xb = x0 + s1 - 0.35, w = xb - xa, y = curY; if (w < 2.4 || Math.abs(zw - zd) < 2.6) return; const sg = zw > zd ? 1 : -1;
    block(xa + Math.min(w - 0.6, 2.6) / 2 + 0.05, zd + sg * 0.4, Math.min(w - 0.6, 2.6), 0.62, y, y + 0.92); pen.box(xa + Math.min(w - 0.6, 2.6) / 2 + 0.05, zd + sg * 0.4, Math.min(w - 0.6, 2.6), 0.62, y, y + 0.92, { wall: im(ST.COMPOSITE, [0.72, 0.7, 0.66]), roof: im(ST.STONE, [0.5, 0.48, 0.46]) });
    pen.box(xa + 0.3, zd + sg * 0.34, 0.6, 0.5, y + 1.45, y + 2.1, { wall: im(ST.COMPOSITE, [0.7, 0.68, 0.64]), roof: im(ST.COMPOSITE, [0.7, 0.68, 0.64]) });
    prop('sofa', xa + Math.min(1.2, w * 0.3), y, zw - sg * 1.5, sg > 0 ? Math.PI / 2 : -Math.PI / 2); prop('table', xa + Math.min(2.4, w * 0.55), y, zw - sg * 1.5, 0);
    pen.use(im(ST.METAL, [0.04, 0.04, 0.05])); const tx = Math.min(xb - 0.05, xa + w * 0.75); pen.box(tx, zw - sg * 1.5, 0.08, 1.3, y + 0.9, y + 1.65, {}); pen.use(glow([0.45, 0.6, 0.9], 2.2)); pen.box(tx - 0.05, zw - sg * 1.5, 0.02, 1.2, y + 0.95, y + 1.6, {});
    if (r() < 0.55) seat(xa + Math.min(1.2, w * 0.3) + 0.15, y + 0.03, zw - sg * 1.5, sg > 0 ? Math.PI / 2 : -Math.PI / 2, { sit: true });
    if (w > 5.2) { const px = xb - 2.6; twoSided([px, zd + sg * 0.2, px, zd + sg * (Math.abs(zw - zd) * 0.55)], y, y + 2.6, im(ST.PLASTER, [0.82, 0.8, 0.76])); prop('bed', xb - 1.25, y, zd + sg * 1.4, sg > 0 ? 0 : Math.PI); block(xb - 0.35, zd + sg * 2.9, 0.6, 1.2, y, y + 2.0); pen.box(xb - 0.35, zd + sg * 2.9, 0.6, 1.2, y, y + 2.0, { wall: im(ST.COMPOSITE, [0.46, 0.38, 0.3]), roof: im(ST.COMPOSITE, [0.46, 0.38, 0.3]) }); }
    else prop('bed', xa + w / 2, y, zd + sg * 1.4, sg > 0 ? 0 : Math.PI);
    if (r() < 0.5) prop('planterIn', xb - 0.5, y, zw - sg * 0.5, 0);
  }
  for (let k = 1; k <= rec.n; k++) {
    const y = P.lv[k], yc = (k < rec.n ? P.lv[k + 1] : top) - 0.3; curY = y; const b = P.band(k);
    plate(y + 0.02, im(k % 3 ? ST.COMPOSITE : ST.TILE, k % 3 ? [0.46, 0.36, 0.28] : [0.6, 0.6, 0.58]), true, [P.sx0, P.sx1, b[0], b[1]]); plate(yc, im(ST.TILE, [0.8, 0.8, 0.78]), false, k < rec.n ? [P.sx0, P.sx1, P.band(k + 1)[0], P.band(k + 1)[1]] : null);
    wallsAround(y, yc, im(ST.PLASTER, wallCol[(rec.seed + k) % 4]), true, true, false); if (k < rec.n) stairs(k + 1);
    { const bb = P.band(k), arrive = k % 2 ? P.sx0 : P.sx1, gx0 = k % 2 ? P.sx0 + 1.2 : P.sx0, gx1 = k % 2 ? P.sx1 : P.sx1 - 1.2; pen.use(im(ST.METAL, [0.24, 0.24, 0.26])); for (const ze of [bb[1] + 0.02].concat(k % 2 ? [] : [bb[0] - 0.02])) { pen.box((gx0 + gx1) / 2, ze, gx1 - gx0, 0.05, y + 0.98, y + 1.04, {}); for (let x = gx0; x <= gx1 + 0.01; x += (gx1 - gx0) / 5) pen.box(x, ze, 0.04, 0.04, y, y + 1.0, {}); pen.use(M(ST.DARKGLASS, { color: [0.5, 0.6, 0.62], flags: IN })); pen.box((gx0 + gx1) / 2, ze, gx1 - gx0, 0.02, y + 0.1, y + 0.95, {}); pen.use(im(ST.METAL, [0.24, 0.24, 0.26])); } void arrive; }
    const F = flats(rec, P, k); for (const w of F.walls) twoSided(w.slice(0, 4), y + (w[4] ?? 0), Math.min(yc, y + (w[5] ?? 9)), im(ST.PLASTER, [0.78, 0.77, 0.73]));
    if (P.deep) { panels(yc, x0, x1, z0, zc, [0.9, 0.95, 1], 3); pen.use(im(ST.TILE, [0.46, 0.46, 0.46])); pen.flat(P.sx1 + 0.1, z0 + 2.6, x1 - 0.3, zc, y + 0.03); walk([[P.sx1 + 0.6, y, z0 + 3.1], [x1 - 0.9, y, z0 + 3.1]], false); }
    for (const u of F.units) {
      panels(yc, u.x0, u.x1, Math.min(u.zd, u.zw), Math.max(u.zd, u.zw), u.office ? [0.95, 0.98, 1] : [1, 0.86, 0.66], u.office ? 5 : 3.5);
      if (u.office) { const zs = Math.min(u.zd, u.zw), ze = Math.max(u.zd, u.zw); officeFloor(u.x0, u.x1, zs, ze, y, prop, seat, block, r, pen, null); }
      else if (u.open) { furnishFlat(P.sx1 - x0 + 0.3, u.x1 - x0, u.zd, u.zw); }
      else furnishFlat(u.x0 - x0, u.x1 - x0, u.zd + 0.1, u.zw);
    }
  }
  home();
  return { spots, walks, solids };
}

// an office floor the way offices are planned: desk pods with aisles, a meeting table, storage, a printer and plants
export function officeFloor(x0, x1, z0, z1, y, prop, seat, block, r, pen, keep) {
  const scr = M(ST.FABRIC, { color: [0.36, 0.4, 0.44], flags: IN }); const podW = 4.8, stepX = podW + 2.0, stepZ = 5.2;
  const meet = x1 - x0 > 16 ? 6.5 : 0; const xe = x1 - meet;
  for (let zc = z0 + 2.3; zc + 2.1 < z1; zc += stepZ) for (let xc = x0 + 1.5 + podW / 2; xc + podW / 2 + 1.2 < xe; xc += stepX) {
    if (keep && keep(xc, zc, 2.7)) continue;
    for (let i = 0; i < 3; i++) { const x = xc - 1.6 + i * 1.6; prop('desk', x, y, zc - 0.5, 0); prop('desk', x, y, zc + 0.5, Math.PI); if (r() < 0.55) seat(x, y + 0.03, zc - 1.12, 0, { sit: true }); if (r() < 0.55) seat(x, y + 0.03, zc + 1.12, Math.PI, { sit: true }); }
    pen.box(xc, zc, podW, 0.05, y + 0.75, y + 1.22, { wall: scr, roof: scr }); block(xc, zc, podW, 1.8, y, y + 1.22);
  }
  if (meet) { const mx = x1 - meet / 2, mz = (z0 + z1) / 2, L = Math.min(4.2, z1 - z0 - 3); const tm = M(ST.COMPOSITE, { color: [0.34, 0.26, 0.2], flags: IN });
    pen.box(mx, mz, 1.3, L, y + 0.7, y + 0.76, { wall: tm, roof: tm }); pen.box(mx, mz, 0.4, L * 0.8, y, y + 0.7, { wall: tm, roof: tm }); block(mx, mz, 1.3, L, y, y + 0.76);
    for (let z = mz - L / 2 + 0.5; z < mz + L / 2 - 0.2; z += 1.0) for (const sd of [-1, 1]) { prop('stool', mx + sd * 1.0, y, z, 0); if (r() < 0.45) seat(mx + sd * 1.0, y + 0.03, z, sd > 0 ? -Math.PI / 2 : Math.PI / 2, { sit: true }); }
    pen.use({ st: ST.SCREEN, color: [1, 1, 1], seed: 77, cellW: 12, floorH: 7, extra: 16, flags: 8 }); pen.wall(x1 - 0.35, mz - 1.2, x1 - 0.35, mz + 1.2, y + 1.0, y + 2.3, { uv: [0, 0, 1, 1] }); }
  for (let x = x0 + 1.2; x < xe - 1.2; x += 2.3) prop('shelf', x, y, z1 - 0.3, Math.PI);
  prop('kiosk', x0 + 0.7, y, z0 + 0.8, Math.PI / 2); prop('planterIn', x0 + 0.6, y, z1 - 0.6, 0); prop('planterIn', xe - 0.6, y, z0 + 0.6, 0);
}

// ---- real doors -------------------------------------------------------------------------------------------------
// Every opening a walk-in has gets a leaf: automatic sliding glass pairs on shop fronts and office lobbies, a
// swinging street door on residential entrances, timber doors on the shop back doors and every flat / office on
// the corridors. They stand closed (and block) until someone walks up, then open and close again behind them.
function doorList(rec, P) {
  const { x0, x1, z1 } = rec; const out = []; const gh = rec.gh; const zc = rec.z0 + CORR;
  for (const u of rec.units) { if (u.door == null) continue; const w = u.dw || 1.2, h = Math.min(gh, 2.5) - 0.07; const shop = typeof u.kind === 'number' || u.kind === 'entry';
    out.push({ x: x0 + u.door, y: 0.07, z: z1 - 0.15, w, h, type: shop ? 'slide' : 'street', inward: -1 }); }
  if (P.deep) { const ds = rec.units.length ? rec.units.map((u) => x0 + u.s0 + 0.6) : [x0 + 0.6]; for (const a of ds) out.push({ x: a + 0.5, y: 0, z: zc, w: 1.0, h: 2.3, type: 'wood', inward: 1 });
    for (let k = 1; k <= rec.n; k++) { const y = P.lv[k] + 0.02; const F = flats(rec, P, k);
      for (const u of F.units) { if (u.door != null) out.push({ x: u.door + 0.5, y, z: zc, w: 1.0, h: 2.18, type: 'wood', inward: 1 }); else if (u.office) out.push({ x: x0 + 1.2, y, z: zc, w: 1.2, h: 2.28, type: 'glass', inward: 1 }); } } }
  return out;
}
const DOOR_GEO = new Map();
function leafGeo(type, w, h) { // geometry in leaf space: hinge / sliding edge at x = 0, leaf along +x, centred on z = 0
  const key = type + w.toFixed(2) + h.toFixed(2); let g = DOOR_GEO.get(key); if (g) return g;
  const b = new Batch(256); const pen = new Pen(b); pen.at(0, 0, 0, 0); const t = 0.05;
  if (type === 'slide' || type === 'glass') { pen.use(im(ST.METAL, [0.16, 0.16, 0.17])); pen.box(w / 2, 0, w, t, 0, 0.08, {}); pen.box(w / 2, 0, w, t, h - 0.08, h, {}); pen.box(0.03, 0, 0.06, t, 0.08, h - 0.08, {}); pen.box(w - 0.03, 0, 0.06, t, 0.08, h - 0.08, {});
    if (type === 'slide') { pen.use(im(ST.METAL, [0.5, 0.5, 0.52])); pen.box(w - 0.12, 0, 0.03, 0.09, 0.95, 1.15, {}); } }
  else if (type === 'street') { pen.use(im(ST.METAL, [0.12, 0.13, 0.14])); pen.box(w / 2, 0, w, t, 0, h, {}); pen.use(im(ST.DARKGLASS, [0.3, 0.32, 0.3])); pen.box(w / 2, 0, w - 0.36, t + 0.012, h * 0.45, h - 0.2, {}); pen.use(im(ST.METAL, [0.55, 0.55, 0.56])); pen.box(w - 0.1, 0, 0.03, 0.14, 0.98, 1.08, {}); }
  else { const c = [[0.36, 0.24, 0.15], [0.3, 0.3, 0.32], [0.5, 0.44, 0.36], [0.24, 0.2, 0.18]][(Math.round(w * 13 + h * 7)) % 4]; pen.use(im(ST.COMPOSITE, c)); pen.box(w / 2, 0, w, t, 0, h, {}); pen.use(im(ST.COMPOSITE, c.map((q) => q * 0.8))); pen.box(w / 2, 0, w - 0.3, t + 0.012, 0.3, h - 0.3, {}); pen.use(im(ST.METAL, [0.62, 0.6, 0.55])); pen.box(w - 0.08, 0, 0.12, 0.13, 1.0, 1.06, {}); }
  g = b.build(); DOOR_GEO.set(key, g); return g;
}
function makeDoors(rec, P, mat, phys) {
  const grp = new THREE.Group(); grp.position.set(rec.ox, rec.oy, rec.oz); grp.rotation.y = rec.yaw; grp.updateMatrixWorld(true);
  const C = Math.cos(rec.yaw), S = Math.sin(rec.yaw); const W = (lx, lz) => [rec.ox + lx * C + lz * S, rec.oz - lx * S + lz * C];
  const doors = doorList(rec, P).map((d) => {
    const leaves = []; const pair = d.type === 'slide' || (d.type === 'glass' && d.w > 1.1);
    const mk = (w, hx, flip) => { const m = new THREE.Group(); const f = new THREE.Mesh(leafGeo(d.type, w, d.h), mat); f.frustumCulled = false; m.add(f);
      if (d.type === 'slide' || d.type === 'glass') { const g = new THREE.Mesh(PANE, GLASS); g.scale.set(w - 0.12, d.h - 0.16, 1); g.position.set(w / 2, d.h / 2, 0); g.renderOrder = 60; m.add(g); }
      m.position.set(hx, d.y, d.z); if (flip) m.rotation.y = Math.PI; grp.add(m); leaves.push({ m, hx, flip }); };
    if (pair) { mk(d.w / 2, d.x - d.w / 2, false); mk(d.w / 2, d.x + d.w / 2, true); } else mk(d.w, d.x - d.w / 2, false);
    const [wx, wz] = W(d.x, d.z); const col = phys.addBox(wx, wz, d.w / 2, 0.06, rec.yaw, rec.oy + d.y, rec.oy + d.y + d.h); col._y1 = col.y1;
    return { ...d, wx, wz, wy: rec.oy + d.y, leaves, col, open: 0, pair };
  });
  // the shop windows themselves: a real pane in front of the real room (the facade's painted glass is cut away)
  for (const u of rec.units) { if (typeof u.kind !== 'number') continue; const a = rec.x0 + u.s0 + 0.05, b = rec.x0 + u.s1 - 0.05, da = u.door != null ? rec.x0 + u.door - (u.dw || 1.2) / 2 - 0.02 : b, db = u.door != null ? rec.x0 + u.door + (u.dw || 1.2) / 2 + 0.02 : b; const y0 = 0.12, y1 = rec.gh - 0.78;
    for (const [p0, p1] of [[a, da], [db, b]]) { if (p1 - p0 < 0.2) continue; const m = new THREE.Mesh(PANE, GLASS); m.scale.set(p1 - p0, y1 - y0, 1); m.position.set((p0 + p1) / 2, (y0 + y1) / 2, rec.z1 - 0.08); m.renderOrder = 60; grp.add(m); } }
  return { grp, doors };
}
const PANE = new THREE.PlaneGeometry(1, 1);
// clear glass: reflects the street, keeps the frame buffer's alpha (the SSR mask lives there)
const GLASS = new THREE.MeshStandardMaterial({ color: 0x0c1216, transparent: true, opacity: 0.2, roughness: 0.03, metalness: 0.85, depthWrite: false, side: THREE.DoubleSide, blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor });
const _doorVec = new THREE.Vector3();
function stepDoors(set, dt, p, agents) {
  for (const d of set.doors) {
    let want = 0; const near = (x, y, z, r) => Math.abs(y - d.wy) < 1.6 && (x - d.wx) * (x - d.wx) + (z - d.wz) * (z - d.wz) < r * r;
    if (near(p.x, p.y, p.z, d.type === 'slide' ? 2.6 : 1.7)) want = 1; else for (const a of agents) if (near(a.x, a.y, a.z, 1.5)) { want = 1; break; }
    const sp = d.type === 'slide' ? 2.6 : 1.9; d.open += Math.max(-dt * sp, Math.min(dt * sp, want - d.open)); const o = d.open * d.open * (3 - 2 * d.open);
    for (const L of d.leaves) {
      if (d.type === 'slide' || (d.pair && d.type === 'glass')) { const lw = d.w / 2; L.m.position.x = L.hx + (L.flip ? 1 : -1) * lw * 0.96 * o; L.m.position.z = d.z + (L.flip ? 0.07 : -0.07) * Math.min(1, o * 4); }
      else L.m.rotation.y = (L.flip ? Math.PI : 0) - d.inward * 1.45 * o;
    }
    d.col.y1 = o > 0.45 ? d.col.y0 - 100 : d.col._y1;
  }
}
export function createWalkinStream(city, scene, crowd) {
  const recs = city.ctx.walkins || []; const live = new Map(); let tick = 0; const phys = city.phys;
  const open = (rec) => {
    if (!rec.cols) rec.cols = colliders(rec, phys); else for (const c of rec.cols) c.y1 = c._y1;
    rec.col._y1 = rec._sy1 ?? (rec._sy1 = rec.col.y1); rec.col.y1 = rec.col.y0 - 100;
    const b = new Batch(8192); const pen = new Pen(b); const res = fitOut(rec, pen);
    if (!rec.fcols) { const C = Math.cos(rec.yaw), S = Math.sin(rec.yaw); rec.fcols = res.solids.map(([lx, lz, hx, hz, ry, y0, y1]) => { const c = phys.addBox(rec.ox + lx * C + lz * S, rec.oz - lx * S + lz * C, hx, hz, rec.yaw + ry, rec.oy + y0, rec.oy + y1); c._y1 = c.y1; return c; }); } else for (const c of rec.fcols) c.y1 = c._y1;
    const mesh = new THREE.Mesh(b.build(), city.mat); mesh.matrixAutoUpdate = false; mesh.frustumCulled = false; scene.add(mesh); live.set(rec, mesh);
    if (!rec.doorSet) rec.doorSet = makeDoors(rec, plan(rec), city.mat, phys); else for (const d of rec.doorSet.doors) { d.col.y1 = d.col._y1; d.open = 0; } scene.add(rec.doorSet.grp);
    if (!rec.peopled) { rec.peopled = true; crowd.addSpots(res.spots); crowd.addWalkways(res.walks); }
  };
  const close = (rec) => { const m = live.get(rec); scene.remove(m); m.geometry.dispose(); live.delete(rec); if (rec.doorSet) { scene.remove(rec.doorSet.grp); for (const d of rec.doorSet.doors) d.col.y1 = d.col.y0 - 100; } for (const c of rec.cols) c.y1 = c.y0 - 100; for (const c of rec.fcols || []) c.y1 = c.y0 - 100; rec.col.y1 = rec._sy1; };
  // tell the city shader which buildings are open, so their glass shows the real rooms and their doors stand open
  const mask = () => { let i = 0; for (const r of live.keys()) { if (i >= 8) break; U.uLiveA.value[i].set(r.ox, r.oz, r.yaw, r.oy + r.top); U.uLiveB.value[i].set(r.x0, r.x1, r.z0, r.z1); i++; } U.uLiveN.value = i; };
  return {
    recs,
    update(p, force = false) {
      { const now = performance.now(); const dt = Math.min(0.1, (now - (this._t || now)) / 1000); this._t = now; if (live.size) { const ag = crowd.agents.filter((a) => Math.abs(a.x - p.x) < 40 && Math.abs(a.z - p.z) < 40); for (const r of live.keys()) if (r.doorSet) stepDoors(r.doorSet, dt, p, ag); } }
      if (!force && (tick++ % 10)) return;
      let best = null, bd = 1e9;
      for (const r of recs) { const d = Math.hypot(r.wx - p.x, r.wz - p.z) - r.r; if (d < 14 && !live.has(r) && d < bd) { bd = d; best = r; } }
      if (best) open(best);
      if (force) for (const r of recs) if (!live.has(r) && Math.hypot(r.wx - p.x, r.wz - p.z) - r.r < 14) open(r);
      for (const r of [...live.keys()]) if (Math.hypot(r.wx - p.x, r.wz - p.z) - r.r > 34) close(r);
      while (live.size > 8) { let far = null, fd = -1; for (const r of live.keys()) { const d = Math.hypot(r.wx - p.x, r.wz - p.z); if (d > fd) { fd = d; far = r; } } close(far); }
      mask();
    },
    get count() { return live.size; },
  };
}
