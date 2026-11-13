// Shared architectural kit: materials, street furniture, rooftop clutter, signage, structural bits.
import { ST, PAL } from '../render/cityMaterial.js';
import { M, rectPts, ngonPts, scalePts } from './builder.js';

export const NEON = {
  pink: [1.0, 0.16, 0.55], cyan: [0.15, 0.95, 0.92], amber: [1.0, 0.62, 0.14], red: [1.0, 0.14, 0.08], violet: [0.55, 0.35, 1.0],
  green: [0.4, 1.0, 0.45], white: [1.0, 0.95, 0.88], blue: [0.25, 0.55, 1.0], gold: [1.0, 0.78, 0.35], sodium: [1.0, 0.55, 0.2], ice: [0.75, 0.9, 1.0], magenta: [1.0, 0.2, 0.85],
};
export const NEON_LIST = Object.values(NEON);
// pull a colour toward warm white (k = 1 → white)
export const mixW = (c, k = 0.5) => [c[0] + (1.0 - c[0]) * k, c[1] + (0.88 - c[1]) * k, c[2] + (0.7 - c[2]) * k];

export const emis = (col, intensity = 6, mode = 0, nightOnly = false, seed = 0) => M(ST.EMISSIVE, { color: col, extra: Math.min(255, intensity * 5), flags: mode | (nightOnly ? 4 : 0), seed });
// a row of small warm fittings (soffit / parapet lamps): reads as architecture lighting, not an outline
export const lamps = (col = [1, 0.86, 0.66], intensity = 5, seed = 0) => M(ST.EMISSIVE, { color: col, extra: Math.min(255, intensity * 5), flags: 4 | 16, seed });
export const conc = (v = 0.5, tint = [1, 1, 1]) => M(ST.CONCRETE, { color: [v * tint[0], v * tint[1], v * tint[2]] });
export const metal = (c = [0.5, 0.5, 0.55]) => M(ST.METAL, { color: c });
export const rust = (c = [0.5, 0.42, 0.36]) => M(ST.RUST, { color: c });
export const dark = (v = 0.18) => M(ST.METAL, { color: [v, v, v * 1.08] });
export const stone = (c = [0.55, 0.52, 0.48]) => M(ST.STONE, { color: c });
export const pave = (v = 0.45, tile = false) => M(tile ? ST.TILE : ST.PAVE, { color: [v, v, v * 1.03] });
export const glassDark = (c = [0.3, 0.4, 0.5]) => M(ST.DARKGLASS, { color: c });
export const fabric = (c, seed = 0) => M(ST.FABRIC, { color: c, seed });
export const foliage = (c = [0.25, 0.5, 0.2]) => M(ST.FOLIAGE, { color: c });
export const win = (st, o) => M(st, o);

const MAT_POLE = dark(0.14), MAT_ROOF = conc(0.3), MAT_AC = metal([0.5, 0.52, 0.55]);

// street lamp with downward light cone + light-field emitter. Emits into detail batch. World coords.
export function lampPost(ctx, x, z, yaw, o = {}) {
  const h = o.h ?? 9, arm = o.arm ?? 2.6, col = o.color ?? NEON.sodium, y = o.y ?? 0;
  ctx.penAt(x, y, z, yaw); const pen = ctx.detail();
  pen.use(MAT_POLE); pen.tube(0, 0, 0, 0, h, 0, 0.16, 5, { r1: 0.1 });
  pen.beam(0, h - 0.1, 0, 0, h + 0.25, arm, 0.14, 0.14);
  pen.box(0, arm, 0.5, 1.1, h + 0.12, h + 0.3, { wall: MAT_POLE, roof: MAT_POLE });
  pen.use(emis(col, o.intensity ?? 14)); pen.flat(-0.2, arm - 0.45, 0.2, arm + 0.45, h + 0.11, false);
  const lx = pen.wx(0, arm), lz = pen.wz(0, arm);
  if (!o.noCone) ctx.glow.cone(lx, y + h + 0.1, lz, 0, -1, 0, h + 0.1, 0.25, h * 0.62, col, o.cone ?? 0.5, { segs: 8, seed: (x * 7 + z * 3) % 50 });
  ctx.light(lx, lz, o.radius ?? 20, col, o.power ?? 0.9, y + h);
}

// antenna mast with blinking beacon (pen frame)
export function antenna(ctx, x, z, y, h, o = {}) {
  const pen = ctx.detail();
  pen.use(MAT_POLE); pen.tube(x, y, z, x, y + h, z, o.r ?? 0.22, 4, { r1: 0.06 });
  if (h > 14) { pen.beam(x - 1.2, y + h * 0.55, z, x + 1.2, y + h * 0.55, z, 0.1, 0.1); pen.beam(x, y + h * 0.72, z - 0.9, x, y + h * 0.72, z + 0.9, 0.1, 0.1); }
  pen.use(emis(o.color ?? NEON.red, 20, 2, false, Math.floor(Math.abs(x * 13 + z * 7 + y)) % 255));
  pen.box(x, z, 0.5, 0.5, y + h, y + h + 0.5, {});
  if (h > 10) ctx.spark(pen.wx(x, z), pen.oy + y + h, pen.wz(x, z), o.color ?? NEON.red, 3, 1.5);
}

export function acUnit(ctx, x, z, y, s = 1) {
  const pen = ctx.detail();
  pen.box(x, z, 1.6 * s, 1.1 * s, y, y + 1.0 * s, { wall: MAT_AC, roof: MAT_AC });
  pen.use(dark(0.06)); pen.flat(x - 0.5 * s, z - 0.35 * s, x + 0.5 * s, z + 0.35 * s, y + 1.0 * s + 0.01);
}
export function waterTank(ctx, x, z, y, r = 1.8, h = 3.5, mat = null) {
  const pen = ctx.detail();
  for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { pen.use(MAT_POLE); pen.beam(x + dx * r * 0.6, y, z + dz * r * 0.6, x + dx * r * 0.6, y + 2, z + dz * r * 0.6, 0.18, 0.18); }
  pen.use(mat || rust([0.42, 0.33, 0.26])); pen.lathe(x, z, [[r, y + 2], [r, y + 2 + h], [r * 0.1, y + 2 + h + r * 0.5]], 10, { cap: false });
}

// generic rooftop clutter over a rect roof (pen frame; roof centred at cx,cz)
export function rooftop(ctx, rng, cx, cz, sx, sz, y, o = {}) {
  const pen = ctx.detail();
  const dens = (o.density ?? 1) * ctx.density;
  // parapet
  if (o.parapet !== false && sx > 6 && sz > 6) {
    const ph = o.parapetH ?? 1.1, t = 0.35, m = o.parapetMat || MAT_ROOF;
    pen.box(cx, cz + sz / 2 - t / 2, sx, t, y, y + ph, { wall: m, roof: m }); pen.box(cx, cz - sz / 2 + t / 2, sx, t, y, y + ph, { wall: m, roof: m });
    pen.box(cx + sx / 2 - t / 2, cz, t, sz - 2 * t, y, y + ph, { wall: m, roof: m }); pen.box(cx - sx / 2 + t / 2, cz, t, sz - 2 * t, y, y + ph, { wall: m, roof: m });
  }
  const n = Math.round(Math.min(10, (sx * sz) / 90) * dens);
  for (let i = 0; i < n; i++) {
    const x = cx + rng.f(-0.38, 0.38) * sx, z = cz + rng.f(-0.38, 0.38) * sz;
    const k = rng.next();
    if (k < 0.45) acUnit(ctx, x, z, y, rng.f(0.9, 1.8));
    else if (k < 0.6 && o.tanks !== false) waterTank(ctx, x, z, y, rng.f(1.2, 2.2), rng.f(2.5, 4.5));
    else if (k < 0.78) { const w = rng.f(3, 7), d = rng.f(3, 6), h = rng.f(2.4, 4.5); pen.box(x, z, w, d, y, y + h, { wall: MAT_ROOF, roof: MAT_ROOF }); if (rng.chance(0.5)) { pen.use(emis(rng.pick([NEON.sodium, NEON.white, NEON.cyan]), 8)); pen.box(x, z + d / 2 + 0.06, 0.9, 0.1, y + h - 0.7, y + h - 0.45, {}); } }
    else if (k < 0.9) { pen.use(MAT_POLE); const L = rng.f(4, Math.min(sx, sz) * 0.7); const a = rng.pick([0, 1]); pen.tube(x - (a ? 0 : L / 2), y + 0.5, z - (a ? L / 2 : 0), x + (a ? 0 : L / 2), y + 0.5, z + (a ? L / 2 : 0), 0.3, 5); }
    else antenna(ctx, x, z, y, rng.f(5, 14));
  }
  if (o.mast && rng.chance(o.mast)) antenna(ctx, cx + rng.f(-0.2, 0.2) * sx, cz + rng.f(-0.2, 0.2) * sz, y, o.mastH ?? rng.f(14, 40), { r: 0.4 });
  ctx.main();
}

// wall mounted sign (boxed) at local position, facing local angle. kind 'h' | 'v' | 'bb' | 'logo'
export function wallSign(ctx, rng, x, y, z, ang, w, kind = 'h', o = {}) {
  const pen = ctx.detail(); const at = ctx.atlas;
  const rect = o.rect || (kind === 'h' ? at.pickH(rng) : kind === 'v' ? at.pickV(rng) : kind === 'bb' ? at.pickBB(rng) : at.pickLogo(rng));
  const h = w / rect.aspect;
  const sa = Math.sin(ang), ca = Math.cos(ang);
  pen.sign(x + sa * 0.16, y, z + ca * 0.16, ang, w, h, rect, { seed: rng.i(0, 255), intensity: o.intensity ?? 7 });
  // backing box
  pen.use(dark(0.05));
  const rx = ca, rz = -sa, hw = w / 2 + 0.12, hh = h / 2 + 0.12;
  pen.quad(x + rx * hw, y - hh, z + rz * hw, x - rx * hw, y - hh, z - rz * hw, x - rx * hw, y + hh, z - rz * hw, x + rx * hw, y + hh, z + rz * hw, 0, 0, 1, 1);
  if (o.light !== false) { const c = o.lightColor || rng.pick(NEON_LIST); ctx.light(pen.wx(x + sa * 2, z + ca * 2), pen.wz(x + sa * 2, z + ca * 2), o.radius ?? Math.max(14, w * 2.2), c, o.power ?? 0.7, pen.oy + y); }
  ctx.main();
  return h;
}
// blade sign perpendicular to a wall facing `ang`, sticking out; double sided
export function bladeSign(ctx, rng, x, y, z, ang, hgt, o = {}) {
  const pen = ctx.detail(); const rect = o.rect || ctx.atlas.pickV(rng);
  const w = hgt * rect.aspect; const sa = Math.sin(ang), ca = Math.cos(ang);
  const cx = x + sa * (w / 2 + 0.4), cz = z + ca * (w / 2 + 0.4);
  pen.sign(cx, y, cz, ang + Math.PI / 2, w, hgt, rect, { seed: rng.i(0, 255), intensity: o.intensity ?? 7, double: true });
  pen.use(MAT_POLE); pen.beam(x, y + hgt * 0.4, z, cx, y + hgt * 0.4, cz, 0.08, 0.08); pen.beam(x, y - hgt * 0.4, z, cx, y - hgt * 0.4, cz, 0.08, 0.08);
  if (o.light !== false) ctx.light(pen.wx(cx + sa * 1.5, cz + ca * 1.5), pen.wz(cx + sa * 1.5, cz + ca * 1.5), o.radius ?? Math.max(12, hgt * 2.4), o.lightColor || rng.pick(NEON_LIST), o.power ?? 0.6, pen.oy + y);
  ctx.main();
}
// free standing / rooftop billboard on a truss frame, facing `ang`
export function billboard(ctx, rng, x, y, z, ang, w, o = {}) {
  const pen = ctx.detail(); const rect = o.rect || ctx.atlas.pickBB(rng); const h = w / rect.aspect;
  const lift = o.lift ?? 3; const sa = Math.sin(ang), ca = Math.cos(ang), rx = ca, rz = -sa;
  pen.sign(x, y + lift + h / 2, z, ang, w, h, rect, { seed: rng.i(0, 255), intensity: o.intensity ?? 8, holo: !!o.holo });
  pen.use(dark(0.05)); const hw = w / 2, bx = x - sa * 0.25, bz = z - ca * 0.25;
  pen.quad(bx + rx * hw, y + lift, bz + rz * hw, bx - rx * hw, y + lift, bz - rz * hw, bx - rx * hw, y + lift + h, bz - rz * hw, bx + rx * hw, y + lift + h, bz + rz * hw, 0, 0, 1, 1);
  pen.use(MAT_POLE);
  const n = Math.max(2, Math.round(w / 6));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n - 0.5; const px = x + rx * w * t - sa * 0.4, pz = z + rz * w * t - ca * 0.4;
    pen.beam(px, y, pz, px, y + lift + h, pz, 0.25, 0.25);
    pen.beam(px - sa * 2.2, y, pz - ca * 2.2, px, y + lift + h * 0.7, pz, 0.16, 0.16);
  }
  const c = o.lightColor || rng.pick(NEON_LIST);
  ctx.light(pen.wx(x + sa * w * 0.4, z + ca * w * 0.4), pen.wz(x + sa * w * 0.4, z + ca * w * 0.4), o.radius ?? Math.max(30, w * 2.6), c, o.power ?? 1.0, pen.oy + y + lift + h / 2);
  ctx.main();
  return h;
}
// neon tube band around a rectangular footprint at height y (pen frame)
export function neonBand(ctx, cx, cz, sx, sz, y, col, o = {}) {
  const pen = o.main ? ctx.main() : ctx.detail(); const t = (o.t ?? 0.25) * 0.4, h = (o.h ?? 0.3) * 0.42, off = o.off ?? 0.1;
  if (o.lamps) pen.use(lamps(mixW(col, 0.6), (o.intensity ?? 10) * 1.2, o.seed ?? 0)); else pen.use(emis(col, (o.intensity ?? 10) * 1.3, o.mode ?? 0, o.nightOnly ?? false, o.seed ?? 0));
  const sides = o.sides ?? 15;
  if (sides & 1) pen.box(cx, cz + sz / 2 + off, sx + 2 * off, t, y, y + h, {});
  if (sides & 4) pen.box(cx, cz - sz / 2 - off, sx + 2 * off, t, y, y + h, {});
  if (sides & 2) pen.box(cx + sx / 2 + off, cz, t, sz, y, y + h, {});
  if (sides & 8) pen.box(cx - sx / 2 - off, cz, t, sz, y, y + h, {});
  // light washing down (and a little up) the wall behind the tube
  const W = (x0, z0, x1, z1, nx, nz) => { if (o.lamps || !o.washI) return; const wash = o.wash ?? Math.min(9, 2.5 + Math.hypot(x1 - x0, z1 - z0) * 0.12); const P = (x, z, yy) => [pen.wx(x + nx * 0.16, z + nz * 0.16), pen.oy + yy, pen.wz(x + nx * 0.16, z + nz * 0.16)];
    ctx.glow.quad(P(x0, z0, y), P(x1, z1, y), P(x1, z1, y - wash), P(x0, z0, y - wash), col, 1, 4, o.washI ?? 0.5, { night: o.nightOnly ? 1 : 0 });
    ctx.glow.quad(P(x0, z0, y + h), P(x1, z1, y + h), P(x1, z1, y + h + wash * 0.35), P(x0, z0, y + h + wash * 0.35), col, 1, 4, (o.washI ?? 0.5) * 0.6, { night: o.nightOnly ? 1 : 0 }); };
  if (sides & 1) W(cx - sx / 2, cz + sz / 2, cx + sx / 2, cz + sz / 2, 0, 1); if (sides & 4) W(cx + sx / 2, cz - sz / 2, cx - sx / 2, cz - sz / 2, 0, -1);
  if (sides & 2) W(cx + sx / 2, cz + sz / 2, cx + sx / 2, cz - sz / 2, 1, 0); if (sides & 8) W(cx - sx / 2, cz - sz / 2, cx - sx / 2, cz + sz / 2, -1, 0);
  if (o.light !== false) {
    const P = (lx, lz) => ctx.light(pen.wx(lx, lz), pen.wz(lx, lz), o.radius ?? 26, col, o.power ?? 0.6, pen.oy + y);
    if (sides & 1) P(cx, cz + sz / 2 + 3); if (sides & 4) P(cx, cz - sz / 2 - 3); if (sides & 2) P(cx + sx / 2 + 3, cz); if (sides & 8) P(cx - sx / 2 - 3, cz);
  }
  ctx.main();
}
// vertical fins on a box facade (structure-level detail). spacing in metres
export function fins(ctx, cx, cz, sx, sz, y0, y1, spacing, depth, mat, o = {}) {
  const pen = o.detail ? ctx.detail() : ctx.main(); pen.use(mat);
  const w = o.w ?? 0.35;
  const nx = Math.max(1, Math.round(sx / spacing)), nz = Math.max(1, Math.round(sz / spacing));
  for (let i = 0; i <= nx; i++) { const x = cx - sx / 2 + (sx * i) / nx; pen.box(x, cz + sz / 2 + depth / 2, w, depth, y0, y1, { roof: undefined, sides: 1 | 2 | 8 }); pen.box(x, cz - sz / 2 - depth / 2, w, depth, y0, y1, { sides: 4 | 2 | 8 }); }
  for (let i = 1; i < nz; i++) { const z = cz - sz / 2 + (sz * i) / nz; pen.box(cx + sx / 2 + depth / 2, z, depth, w, y0, y1, { sides: 1 | 2 | 4 }); pen.box(cx - sx / 2 - depth / 2, z, depth, w, y0, y1, { sides: 1 | 4 | 8 }); }
  ctx.main();
}
// X-bracing on the +z/-z/+x/-x faces of a box
export function xBrace(ctx, cx, cz, sx, sz, y0, y1, bay, mat, t = 0.6) {
  const pen = ctx.main(); pen.use(mat);
  const n = Math.max(1, Math.round((y1 - y0) / bay)); const dh = (y1 - y0) / n, o = 0.25;
  for (let i = 0; i < n; i++) {
    const a = y0 + i * dh, b = a + dh;
    for (const s of [-1, 1]) {
      const z = cz + s * (sz / 2 + o), x = cx + s * (sx / 2 + o);
      pen.beam(cx - sx / 2, a, z, cx + sx / 2, b, z, t, t); pen.beam(cx + sx / 2, a, z, cx - sx / 2, b, z, t, t);
      pen.beam(x, a, cz - sz / 2, x, b, cz + sz / 2, t, t); pen.beam(x, a, cz + sz / 2, x, b, cz - sz / 2, t, t);
    }
  }
}
// awning: tilted fabric quad projecting from a wall (pen frame). ang = wall facing
export function awning(ctx, x, y, z, ang, w, depth, col, seed = 0) {
  const pen = ctx.detail(); const sa = Math.sin(ang), ca = Math.cos(ang), rx = ca, rz = -sa, hw = w / 2;
  pen.use(fabric(col, seed));
  const ox = sa * depth, oz = ca * depth, drop = depth * 0.35;
  pen.quad(x - rx * hw + ox, y - drop, z - rz * hw + oz, x + rx * hw + ox, y - drop, z + rz * hw + oz, x + rx * hw, y, z + rz * hw, x - rx * hw, y, z - rz * hw, 0, 0, w, depth);
  pen.quad(x + rx * hw + ox, y - drop, z + rz * hw + oz, x - rx * hw + ox, y - drop, z - rz * hw + oz, x - rx * hw, y, z - rz * hw, x + rx * hw, y, z + rz * hw, 0, 0, w, depth);
  ctx.main();
}
// exterior zig-zag fire stairs on the face of a wall (pen frame). wall plane at z = zf facing +z
export function fireStairs(ctx, x, zf, y0, y1, o = {}) {
  const pen = ctx.detail(); pen.use(MAT_POLE);
  const fh = o.floorH ?? 3.4, w = 3.2, d = 1.1; const n = Math.floor((y1 - y0) / fh);
  for (let i = 0; i <= n; i++) {
    const y = y0 + i * fh;
    pen.box(x, zf + d / 2, w, d, y - 0.08, y, { bottom: true });
    pen.beam(x - w / 2, y + 1, zf + d, x + w / 2, y + 1, zf + d, 0.05, 0.05);
    if (i < n) { const s = i % 2 ? 1 : -1; pen.beam(x - s * w * 0.4, y, zf + d * 0.5, x + s * w * 0.4, y + fh, zf + d * 0.5, 0.5, 0.06); }
  }
  pen.beam(x - w / 2, y0, zf + d, x - w / 2, y0 + n * fh + 1, zf + d, 0.07, 0.07); pen.beam(x + w / 2, y0, zf + d, x + w / 2, y0 + n * fh + 1, zf + d, 0.07, 0.07);
  ctx.main();
}
// skybridge between two world points
export function skybridge(ctx, x0, y0, z0, x1, y1, z1, w = 5, h = 3.6, o = {}) {
  const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2; const L = Math.hypot(x1 - x0, z1 - z0); if (L < 2) return;
  const yaw = Math.atan2(x1 - x0, z1 - z0);
  ctx.penAt(mx, Math.min(y0, y1), mz, yaw); const pen = ctx.main();
  const wallM = o.wall || M(ST.WIN_RIBBON, { color: [0.3, 0.32, 0.36], seed: Math.floor(mx) & 255, A: 0.8, B: o.pal ?? PAL.COOL, cellW: 3, floorH: h });
  pen.box(0, 0, w, L, 0, h, { wall: wallM, roof: MAT_ROOF, bottom: dark(0.1), sides: 2 | 8 });
  pen.use(dark(0.12)); pen.beam(-w / 2, -0.4, -L / 2, -w / 2, -0.4, L / 2, 0.5, 0.8); pen.beam(w / 2, -0.4, -L / 2, w / 2, -0.4, L / 2, 0.5, 0.8);
  if (o.neon) { pen.use(emis(o.neon, 8)); pen.beam(-w / 2 - 0.1, h * 0.1, -L / 2, -w / 2 - 0.1, h * 0.1, L / 2, 0.12, 0.2); pen.beam(w / 2 + 0.1, h * 0.1, -L / 2, w / 2 + 0.1, h * 0.1, L / 2, 0.12, 0.2); }
  ctx.phys.addBox(mx, mz, w / 2, L / 2, yaw, Math.min(y0, y1) - 0.8, Math.min(y0, y1) + h);
}
// big pipe run on stanchions between two world points at height y
export function pipeRun(ctx, x0, z0, x1, z1, y, r = 0.8, o = {}) {
  const L = Math.hypot(x1 - x0, z1 - z0); if (L < 4) return;
  const yaw = Math.atan2(x1 - x0, z1 - z0);
  ctx.penAt((x0 + x1) / 2, 0, (z0 + z1) / 2, yaw); const pen = o.main ? ctx.main() : ctx.detail();
  const n = o.count ?? 1;
  for (let i = 0; i < n; i++) { const off = (i - (n - 1) / 2) * r * 2.4; pen.use(o.mat || rust([0.4, 0.36, 0.33])); pen.tube(off, y, -L / 2, off, y, L / 2, r, o.segs ?? 8); }
  const sp = o.spacing ?? 24, ns = Math.max(1, Math.floor(L / sp));
  for (let i = 0; i <= ns; i++) {
    const z = -L / 2 + (L * i) / ns; const wdt = n * r * 2.4 + 0.6;
    if (y > 2) { pen.use(MAT_POLE); pen.beam(-wdt / 2, 0, z, -wdt / 2, y - r, z, 0.3, 0.3); pen.beam(wdt / 2, 0, z, wdt / 2, y - r, z, 0.3, 0.3); pen.beam(-wdt / 2, y - r - 0.15, z, wdt / 2, y - r - 0.15, z, 0.3, 0.3); }
  }
  ctx.main();
}
export { MAT_POLE, MAT_ROOF, MAT_AC, rectPts, ngonPts, scalePts };
