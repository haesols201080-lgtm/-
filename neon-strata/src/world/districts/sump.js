// THE SUMP — the lowest stratum. Shanty stacks accreted on old tenements in the shadow of overdeck
// plates that carry the upper city. Organic alley nests, night markets, pipes, tarps and lanterns.
import { ST, PAL } from '../../render/cityMaterial.js';
import { M, rectPts } from '../builder.js';
import * as K from '../kit.js';
import { scatter, tryPlace, polar, field } from '../place.js';
import { facePt, midrise, towerSetback } from '../arch.js';
import { districtAt } from '../layout.js';

const SH_COL = [[0.36, 0.32, 0.27], [0.28, 0.32, 0.33], [0.38, 0.28, 0.25], [0.26, 0.29, 0.34], [0.34, 0.34, 0.3], [0.4, 0.36, 0.28], [0.25, 0.31, 0.29], [0.33, 0.27, 0.3]];
const CONT_COL = [[0.4, 0.24, 0.2], [0.2, 0.3, 0.36], [0.4, 0.35, 0.2], [0.24, 0.33, 0.27], [0.35, 0.35, 0.36], [0.22, 0.25, 0.36], [0.36, 0.25, 0.31]];
const TARP = [[0.2, 0.32, 0.45], [0.48, 0.25, 0.2], [0.5, 0.42, 0.2], [0.22, 0.4, 0.32], [0.45, 0.45, 0.46], [0.4, 0.22, 0.35]];
const SUMP_NEON = [K.NEON.pink, K.NEON.cyan, K.NEON.amber, K.NEON.green, K.NEON.red, K.NEON.violet, K.NEON.sodium, K.NEON.magenta];
export const SUMP_PAL = { glass: [[0.3, 0.38, 0.4]], walls: [[0.42, 0.4, 0.38], [0.36, 0.38, 0.4], [0.45, 0.4, 0.34]], lights: [PAL.WARM, PAL.WARM, PAL.MIXED, PAL.AMBER, PAL.TEAL], accents: SUMP_NEON, styles: [ST.WIN_PUNCH, ST.WIN_RIBBON], wallKinds: [0, 2, 2], litMin: 0.3, litMax: 0.7 };
const UPPER_PAL = { glass: [[0.3, 0.42, 0.5], [0.4, 0.38, 0.32], [0.25, 0.32, 0.42]], lights: [PAL.NEUTRAL, PAL.COOL, PAL.WARM], accents: [K.NEON.cyan, K.NEON.gold, K.NEON.white], styles: [ST.WIN_CURTAIN, ST.WIN_RIBBON], wallKinds: [1, 3], litMin: 0.5, litMax: 0.9 };

function groundDetails(ctx, rng, f, ox, oz, pw, pd, y, h, street) {
  const [sx, sz, ang] = facePt(f, ox, oz, pw, pd, rng.f(-0.25, 0.25));
  const sa = Math.sin(ang), ca = Math.cos(ang);
  const pen = ctx.detail();
  // lit doorway
  const dc = rng.pick([K.NEON.sodium, K.NEON.white, K.NEON.amber, K.NEON.cyan]);
  pen.use(K.emis(dc, 3.5)); pen.quad(sx - ca * 0.7 + sa * 0.05, y + 0.1, sz + sa * 0.7 + ca * 0.05, sx + ca * 0.7 + sa * 0.05, y + 0.1, sz - sa * 0.7 + ca * 0.05, sx + ca * 0.7 + sa * 0.05, y + 2.3, sz - sa * 0.7 + ca * 0.05, sx - ca * 0.7 + sa * 0.05, y + 2.3, sz + sa * 0.7 + ca * 0.05, 0, 0, 1, 1);
  ctx.light(pen.wx(sx + sa * 2, sz + ca * 2), pen.wz(sx + sa * 2, sz + ca * 2), 9, dc, 0.5);
  if (rng.chance(0.75)) K.awning(ctx, sx, y + h - 0.5, sz, ang, Math.min(pw, pd) * rng.f(0.5, 0.9), rng.f(1.6, 3), rng.pick(TARP), rng.i(0, 255));
  if (rng.chance(street ? 0.95 : 0.55)) K.wallSign(ctx, rng, sx + ca * rng.f(-1, 1), y + h + rng.f(0.2, 1.4), sz - sa * rng.f(-1, 1), ang, rng.f(3, 6.5), 'h', { lightColor: rng.pick(SUMP_NEON), power: 0.8, radius: 16 });
}

export function shantyStack(ctx, rng, x, z, yaw, fw, fd, levels, o = {}) {
  const pen = ctx.penAt(x, o.y ?? 0, z, yaw);
  let y = 0; const seed = rng.i(0, 255);
  const pal = rng.weighted([[5, PAL.WARM], [2, PAL.MIXED], [2, PAL.AMBER], [1, PAL.TEAL]]);
  const roofM = K.rust([0.3, 0.26, 0.24]);
  let top = [0, 0, fw, fd];
  for (let i = 0; i < levels; i++) {
    const tall = i === 0 ? rng.f(3.6, 4.6) : rng.pick([2.9, 3.1, 3.3, 3.3, 6.2]);
    const pw = fw * (o.front ? rng.f(0.9, 1) : rng.f(0.72, 1)), pd = fd * (o.front ? rng.f(0.82, 1) : rng.f(0.72, 1));
    const ox = rng.f(-1, 1) * (fw - pw) * 0.6, oz = o.front ? (fd - pd) / 2 * rng.pick([1, 1, -1]) : rng.f(-1, 1) * (fd - pd) * 0.6;
    const kind = rng.next(); const col = rng.pick(SH_COL); let wall;
    const fh = tall > 5 ? tall / 2 : tall;
    if (kind < 0.55) wall = M(ST.SHANTY, { color: col, seed: seed + i * 17, A: rng.f(0.35, 0.8), B: pal, cellW: rng.f(2.6, 3.6), floorH: fh, flags: rng.i(0, 2) });
    else if (kind < 0.73) wall = M(ST.CORRUGATED, { color: rng.pick(CONT_COL) });
    else if (kind < 0.9) wall = M(ST.WIN_PUNCH, { color: [0.42, 0.4, 0.38], seed: seed + i, A: rng.f(0.3, 0.7), B: pal, cellW: 3, floorH: fh, flags: 2 });
    else wall = K.rust(col);
    ctx.main();
    pen.box(ox, oz, pw, pd, y, y + tall, { wall, roof: roofM, aoB: i === 0 ? 0.5 : 0.8, bottom: i > 0 ? K.dark(0.08) : null });
    if (rng.chance(0.5)) { pen.use(K.conc(0.3)); pen.box(ox, oz, pw + rng.f(0.6, 1.8), pd + rng.f(0.6, 1.8), y + tall - 0.22, y + tall, { bottom: true }); }
    if (i === 0) { groundDetails(ctx, rng, o.front ? 0 : rng.i(0, 3), ox, oz, pw, pd, 0, tall, o.street); if (!o.front && rng.chance(0.35)) groundDetails(ctx, rng, rng.i(0, 3), ox, oz, pw, pd, 0, tall, o.street); }
    else {
      const f = o.front ? (rng.chance(0.75) ? 0 : 2) : rng.i(0, 3); const [sx, sz, ang] = facePt(f, ox, oz, pw, pd, rng.f(-0.3, 0.3));
      const k = rng.next();
      if (k < 0.3) K.bladeSign(ctx, rng, sx, y + tall * 0.5, sz, ang, Math.min(tall * 1.6, rng.f(3, 6)), { lightColor: rng.pick(SUMP_NEON), power: 0.5 });
      else if (k < 0.55) { // balcony
        const dpn = ctx.detail(); const sa = Math.sin(ang), ca = Math.cos(ang), bw = Math.min(pw, pd) * 0.6;
        dpn.use(K.rust([0.35, 0.3, 0.28])); dpn.beam(sx - ca * bw / 2 + sa * 0.6, y + 0.05, sz + sa * bw / 2 + ca * 0.6, sx + ca * bw / 2 + sa * 0.6, y + 0.05, sz - sa * bw / 2 + ca * 0.6, 1.2, 0.12);
        dpn.beam(sx - ca * bw / 2 + sa * 1.15, y + 1.0, sz + sa * bw / 2 + ca * 1.15, sx + ca * bw / 2 + sa * 1.15, y + 1.0, sz - sa * bw / 2 + ca * 1.15, 0.06, 0.06);
        if (rng.chance(0.5)) { dpn.use(K.fabric(rng.pick(TARP), rng.i(0, 255))); dpn.quad(sx - ca * bw / 2 + sa * 1.2, y + 0.1, sz + sa * bw / 2 + ca * 1.2, sx + ca * bw / 2 + sa * 1.2, y + 0.1, sz - sa * bw / 2 + ca * 1.2, sx + ca * bw / 2 + sa * 1.2, y + 1.0, sz - sa * bw / 2 + ca * 1.2, sx - ca * bw / 2 + sa * 1.2, y + 1.0, sz + sa * bw / 2 + ca * 1.2, 0, 0, bw, 1); }
      } else if (k < 0.8) { const dpn = ctx.detail(); const sa = Math.sin(ang), ca = Math.cos(ang); dpn.use(K.MAT_AC); dpn.box(sx + sa * 0.45, sz + ca * 0.45, 1.1, 0.9, y + tall * 0.3, y + tall * 0.3 + 0.8, { bottom: true }); }
      else if (k < 0.9) K.awning(ctx, sx, y + tall - 0.3, sz, ang, Math.min(pw, pd) * 0.7, rng.f(1.2, 2.2), rng.pick(TARP), rng.i(0, 255));
    }
    y += tall; top = [ox, oz, pw, pd];
  }
  ctx.solid(0, 0, fw * 0.94, fd * 0.94, 0, y);
  K.rooftop(ctx, rng, top[0], top[1], top[2], top[3], y, { parapet: rng.chance(0.35), density: 0.8, mast: 0.14 });
  if (rng.chance(0.3)) { ctx.detail(); pen.use(K.fabric(rng.pick(TARP), seed)); const tw = top[2] * 0.8, td = top[3] * 0.8; pen.quad(top[0] - tw / 2, y + 2.2, top[1] + td / 2, top[0] + tw / 2, y + 2.4, top[1] + td / 2, top[0] + tw / 2, y + 3.0, top[1] - td / 2, top[0] - tw / 2, y + 2.7, top[1] - td / 2, 0, 0, tw, td); ctx.main(); }
  ctx.shade(x, z, Math.max(fw, fd) * 1.3 + y * 0.3, Math.min(0.55, y / 70 + 0.15));
  ctx.stats.buildings++;
  return y;
}

export function tenement(ctx, rng, x, z, yaw, w, d, floors, o = {}) {
  const pen = ctx.penAt(x, 0, z, yaw); const fh = 3.3, h = 4.6 + floors * fh; const seed = rng.i(0, 255);
  const tone = rng.f(0.34, 0.5); const col = [tone * rng.f(0.9, 1.1), tone, tone * rng.f(0.85, 1.05)];
  const wall = M(ST.WIN_PUNCH, { color: col, seed, A: rng.f(0.3, 0.65), B: rng.pick([PAL.WARM, PAL.MIXED, PAL.WARM, PAL.NEUTRAL]), cellW: rng.f(2.8, 3.6), floorH: fh, flags: rng.pick([0, 2, 2]) });
  const shop = M(ST.SHANTY, { color: rng.pick(SH_COL), seed: seed + 3, A: 0.85, B: PAL.MIXED, cellW: 4, floorH: 4.6, flags: 2 });
  pen.box(0, 0, w, d, 0, 4.6, { wall: shop, roof: null, aoB: 0.5 });
  pen.box(0, 0, w, d, 4.6, h, { wall, roof: K.conc(0.27) });
  ctx.solid(0, 0, w, d, 0, h);
  pen.use(K.conc(0.3)); pen.box(0, 0, w + 1.6, d + 1.6, 4.3, 4.7, { bottom: true });
  // stair core
  const cf = rng.i(0, 3); const [cx, cz, cang] = facePt(cf, 0, 0, w, d, rng.f(-0.25, 0.25));
  pen.box(cx + Math.sin(cang) * 1.4, cz + Math.cos(cang) * 1.4, cf % 2 ? 2.8 : 4.5, cf % 2 ? 4.5 : 2.8, 0, h + 3, { wall: M(ST.WIN_SLIT, { color: [col[0] * 0.8, col[1] * 0.8, col[2] * 0.8], seed: seed + 9, A: 0.8, B: PAL.COOL, cellW: 2.2, floorH: fh, flags: 0 }), roof: K.conc(0.25), aoB: 0.5 });
  // parasitic pods on the facade
  const np = Math.round(rng.i(2, 7) * ctx.density);
  for (let i = 0; i < np; i++) {
    const f = rng.i(0, 3); const [sx, sz, ang] = facePt(f, 0, 0, w, d, rng.f(-0.4, 0.4)); const sa = Math.sin(ang), ca = Math.cos(ang);
    const py = 4.6 + rng.i(1, Math.max(1, floors - 2)) * fh, pw = rng.f(3, 5.5), pdp = rng.f(1.8, 3.2), ph = rng.pick([fh, fh, fh * 2]);
    const pm = rng.chance(0.6) ? M(ST.SHANTY, { color: rng.pick(SH_COL), seed: seed + i * 7, A: 0.7, B: PAL.WARM, cellW: 2.8, floorH: fh, flags: 1 }) : M(ST.CORRUGATED, { color: rng.pick(CONT_COL) });
    const bx = sx + sa * pdp / 2, bz = sz + ca * pdp / 2;
    pen.box(bx, bz, f % 2 ? pdp : pw, f % 2 ? pw : pdp, py, py + ph, { wall: pm, roof: K.rust(), bottom: K.dark(0.08) });
    ctx.detail(); pen.use(K.MAT_POLE); pen.beam(sx - ca * pw * 0.4, py - 2.2, sz + sa * pw * 0.4, sx - ca * pw * 0.4 + sa * pdp, py, sz + sa * pw * 0.4 + ca * pdp, 0.12, 0.12); pen.beam(sx + ca * pw * 0.4, py - 2.2, sz - sa * pw * 0.4, sx + ca * pw * 0.4 + sa * pdp, py, sz - sa * pw * 0.4 + ca * pdp, 0.12, 0.12); ctx.main();
  }
  // shopfront signage
  const ns = rng.i(1, 3);
  for (let i = 0; i < ns; i++) groundDetails(ctx, rng, rng.i(0, 3), 0, 0, w, d, 0, 4.6, o.street);
  if (rng.chance(0.45)) { const f = rng.i(0, 3); const [sx, sz, ang] = facePt(f, 0, 0, w, d, rng.pick([-0.46, 0.46])); K.bladeSign(ctx, rng, sx, 4.6 + rng.f(0.35, 0.7) * (h - 4.6), sz, ang, Math.min(h * 0.35, rng.f(8, 16)), { lightColor: rng.pick(SUMP_NEON), radius: 34, power: 0.9 }); }
  if (rng.chance(0.5)) K.fireStairs(ctx, rng.f(-0.25, 0.25) * w, d / 2, 4.6, h - 1, { floorH: fh });
  // rooftop village
  const nr = rng.i(1, 4);
  for (let i = 0; i < nr; i++) {
    const rw = rng.f(4, 8), rd = rng.f(4, 7), rx = rng.f(-0.3, 0.3) * w, rz = rng.f(-0.3, 0.3) * d, rh = rng.pick([3, 3.2, 6.2]);
    pen.box(rx, rz, rw, rd, h, h + rh, { wall: M(ST.SHANTY, { color: rng.pick(SH_COL), seed: seed + 40 + i, A: 0.7, B: PAL.WARM, cellW: 3, floorH: rh > 5 ? rh / 2 : rh, flags: rng.i(0, 2) }), roof: K.rust() });
  }
  K.rooftop(ctx, rng, 0, 0, w, d, h, { mast: 0.3 });
  if (rng.chance(0.18)) K.billboard(ctx, rng, rng.f(-0.2, 0.2) * w, h, d / 2 - 1, 0, Math.min(w * 0.8, rng.f(12, 22)), { lift: 2 });
  ctx.shade(x, z, Math.max(w, d) * 0.9 + h * 0.3, Math.min(0.7, h / 120 + 0.25));
  ctx.stats.buildings++;
  return h;
}

function stall(ctx, rng, x, z, yaw) {
  const pen = ctx.penAt(x, 0, z, yaw); ctx.detail();
  const w = rng.f(2.6, 4.2), d = rng.f(1.8, 2.6), h = 2.5;
  pen.box(0, 0, w, d, 0, 0.95, { wall: M(ST.CORRUGATED, { color: rng.pick(CONT_COL) }), roof: K.rust([0.3, 0.3, 0.3]) });
  pen.use(K.MAT_POLE); for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) pen.beam(a * w / 2, 0, b * d / 2, a * w / 2, h, b * d / 2, 0.07, 0.07);
  pen.use(K.fabric(rng.pick(TARP), rng.i(0, 255))); pen.quad(-w / 2 - 0.3, h - 0.1, d / 2 + 0.9, w / 2 + 0.3, h - 0.1, d / 2 + 0.9, w / 2 + 0.3, h + 0.35, -d / 2 - 0.2, -w / 2 - 0.3, h + 0.35, -d / 2 - 0.2, 0, 0, w, d);
  pen.quad(w / 2 + 0.3, h - 0.1, d / 2 + 0.9, -w / 2 - 0.3, h - 0.1, d / 2 + 0.9, -w / 2 - 0.3, h + 0.35, -d / 2 - 0.2, w / 2 + 0.3, h + 0.35, -d / 2 - 0.2, 0, 0, w, d);
  const lc = rng.pick([K.NEON.sodium, K.NEON.amber, K.NEON.white, K.NEON.pink, K.NEON.cyan]);
  pen.use(K.emis(lc, 9)); pen.box(0, 0.2, w * 0.7, 0.12, h - 0.35, h - 0.25, {});
  // wares: glowing crates
  pen.use(K.rust(rng.pick(CONT_COL))); pen.box(rng.f(-0.3, 0.3) * w, 0, 0.8, 0.6, 0.95, 1.3, {});
  ctx.light(x, z, 11, lc, 0.75);
  ctx.phys.addBox(x, z, w / 2, d / 2, yaw, 0, 1.0);
  ctx.main();
}

// elevated plate carrying a slice of the upper city above the slum
function overdeck(ctx, rng, x, z, yaw, L, W, y) {
  const pen = ctx.penAt(x, 0, z, yaw);
  const hull = M(ST.MEGAHULL, { color: [0.3, 0.31, 0.33], seed: rng.i(0, 255), A: 0.25, B: PAL.COOL });
  const T = 16;
  pen.box(0, 0, L, W, y - T, y, { wall: hull, roof: K.pave(0.4, true), bottom: K.conc(0.2), aoBottom: 0.5 });
  ctx.solid(0, 0, L, W, y - T, y);
  // underside ribs + work lights
  const nx = Math.round(L / 60), nz = Math.round(W / 60);
  for (let i = 0; i <= nx; i++) { pen.use(K.dark(0.1)); pen.beam(-L / 2 + (L * i) / nx, y - T - 2.5, -W / 2, -L / 2 + (L * i) / nx, y - T - 2.5, W / 2, 3, 5); }
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const lx = -L / 2 + (L * (i + 0.5)) / nx, lz = -W / 2 + (W * (j + 0.5)) / nz;
    if (rng.chance(0.55)) { const c = rng.pick([K.NEON.ice, K.NEON.sodium, K.NEON.cyan]); pen.use(K.emis(c, 12)); pen.box(lx, lz, 6, 1.2, y - T - 0.5, y - T - 0.1, { bottom: true }); ctx.light(pen.wx(lx, lz), pen.wz(lx, lz), 70, c, 0.35); ctx.glowAt(x, z).cone(pen.wx(lx, lz), y - T - 0.6, pen.wz(lx, lz), 0, -1, 0, y - T - 2, 2, 26, c, 0.16, { segs: 10, seed: i * 7 + j }); }
  }
  // piers with flared capitals
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    if ((i + j) % 2 && nx * nz > 4) continue;
    const px = -L / 2 + (L * (i + 0.5)) / nx + rng.f(-6, 6), pz = -W / 2 + (W * (j + 0.5)) / nz + rng.f(-6, 6);
    const pw = rng.f(11, 16);
    pen.use(K.conc(0.36));
    pen.loft([{ y: 0, pts: rectPts(pw * 1.25, pw * 1.25, px, pz, 2) }, { y: 14, pts: rectPts(pw, pw, px, pz, 2) }, { y: y - T - 22, pts: rectPts(pw, pw, px, pz, 2) }, { y: y - T - 2, pts: rectPts(pw * 2.4, pw * 2.4, px, pz, 4) }], { cap: false, aoB: 0.45 });
    ctx.solid(px, pz, pw * 1.1, pw * 1.1, 0, y - T);
    ctx.occ.markRect(pen.wx(px, pz), pen.wz(px, pz), pw, pw, yaw, 2);
    pen.use(K.emis(K.NEON.red, 10, 2, false, i * 5 + j)); pen.box(px, pz + pw / 2 + 0.2, 1, 0.3, 30, 31, {});
  }
  // rim: parapet, hanging banners, drip pipes
  pen.use(K.dark(0.14));
  pen.box(0, W / 2 - 0.5, L, 1, y, y + 1.4, {}); pen.box(0, -W / 2 + 0.5, L, 1, y, y + 1.4, {}); pen.box(L / 2 - 0.5, 0, 1, W, y, y + 1.4, {}); pen.box(-L / 2 + 0.5, 0, 1, W, y, y + 1.4, {});
  K.neonBand(ctx, 0, 0, L, W, y - T * 0.5, rng.pick([K.NEON.cyan, K.NEON.amber]), { intensity: 5, light: false, main: true, h: 0.5, nightOnly: true });
  const nb = Math.round(L / 55);
  for (let i = 0; i < nb; i++) for (const s of [-1, 1]) {
    if (rng.chance(0.45)) continue;
    const bx = -L / 2 + (L * (i + 0.5)) / nb; const rect = ctx.atlas.pickV(rng); const bh = rng.f(26, 44), bw = bh * rect.aspect;
    ctx.detail(); pen.sign(bx, y - T - bh / 2 - 1, s * (W / 2 + 0.6), s > 0 ? 0 : Math.PI, bw, bh, rect, { intensity: 5, seed: rng.i(0, 255), double: true });
    ctx.light(pen.wx(bx, s * (W / 2 + 8)), pen.wz(bx, s * (W / 2 + 8)), 60, rng.pick(SUMP_NEON), 0.8); ctx.main();
  }
  // upper city on the deck
  const nbld = Math.round((L * W) / 5200);
  for (let i = 0; i < nbld; i++) {
    const bw = rng.f(26, 46), bd = rng.f(24, 40), bx = rng.f(-0.5, 0.5) * (L - bw - 16), bz = rng.f(-0.5, 0.5) * (W - bd - 16);
    const c = Math.cos(yaw), s = Math.sin(yaw); const wx = x + bx * c + bz * s, wz = z - bx * s + bz * c;
    if (!ctx.upperOcc) ctx.upperOcc = [];
    if (ctx.upperOcc.some((o) => Math.hypot(o[0] - wx, o[1] - wz) < o[2] + Math.max(bw, bd) * 0.75)) continue;
    ctx.upperOcc.push([wx, wz, Math.max(bw, bd) * 0.75]);
    ctx.penAt(wx, y, wz, yaw + rng.pick([0, Math.PI / 2]));
    if (rng.chance(0.6)) towerSetback(ctx, rng, bw, bd, rng.f(90, 300), UPPER_PAL, {}); else midrise(ctx, rng, bw, bd, rng.f(30, 70), UPPER_PAL, {});
  }
  ctx.shade(x, z, Math.max(L, W) * 0.62, 0.82);
  ctx.poi({ type: 'landing', x, y: y + 0.2, z, name: '오버덱 ' + (ctx.overdecks = (ctx.overdecks || 0) + 1) });
}

// one terrace unit of a nest row: front faces local +z of the pen
function rowUnit(ctx, rng, x, z, yaw, w, d, levels, street) {
  return shantyStack(ctx, rng, x, z, yaw, w, d, levels, { street, front: true });
}

export function buildSump(ctx) {
  const rng = ctx.rng.fork('sump');
  // --- overdeck plates near the core side
  const decks = [[0.14, -0.45, 300, 190, 150, 0.2], [0.26, 0.55, 260, 170, 128, -0.5], [0.42, -0.15, 220, 150, 112, 0.9]];
  for (const [t, a, L, W, y, rot] of decks) {
    const [x, z] = polar('sump', t, a); const yaw = Math.atan2(x, z) + rot;
    overdeck(ctx, rng.fork('deck' + t), x, z, yaw, L, W, y);
  }
  // --- nests: terraced rows of touching stacks separated by narrow alleys (real slum fabric)
  const nests = [{ p: polar('sump', 0.385, -0.12), r: 165, name: '0번 골목' }, { p: polar('sump', 0.13, 0.4), r: 125, name: '덱 아래 시장' }, { p: polar('sump', 0.66, 0.42), r: 140, name: '녹슨 둥지' }, { p: polar('sump', 0.82, -0.5), r: 115, name: '끝물 마을' }, { p: polar('sump', 0.56, -0.62), r: 105, name: '배수로 거리' }];
  ctx.sumpNests = nests;
  for (let ni = 0; ni < nests.length; ni++) {
    const N = nests[ni]; const [nx, nz] = N.p; const r2 = rng.fork('nest' + ni);
    const rot = r2.f(0, Math.PI); const c = Math.cos(rot), s = Math.sin(rot);
    const W = (lx, lz) => [nx + lx * c + lz * s, nz - lx * s + lz * c];
    const SL = N.r * 0.92, SW = 4.6; // market street half length / half width
    N.street = { x0: nx - c * SL, z0: nz + s * SL, x1: nx + c * SL, z1: nz - s * SL, rot };
    ctx.occ.markRect(nx, nz, N.r + 6, N.r + 6, rot, 1);
    ctx.walkways.push({ pts: [[nx - c * SL, 0.05, nz + s * SL], [nx + c * SL, 0.05, nz - s * SL]], closed: false, dense: true });
    // stalls + lantern strings along the market street
    for (let t = -SL + 6; t < SL - 6; t += r2.f(6, 10)) { const side = r2.sign(); const [wx, wz] = W(t, side * (SW - 1.4)); if (r2.chance(0.7)) stall(ctx, r2, wx, wz, rot + (side > 0 ? Math.PI : 0)); }
    for (let t = -SL + 10; t < SL - 10; t += r2.f(9, 16)) {
      const [wx, wz] = W(t, 0); ctx.penAt(wx, 0, wz, rot); ctx.detail();
      const hh = r2.f(6, 9.5); const lm = K.emis(r2.pick([K.NEON.sodium, K.NEON.amber, K.NEON.pink, K.NEON.cyan, K.NEON.white]), 7, 0, false, r2.i(0, 255)); lm.flags |= 8; ctx.pen.use(lm);
      ctx.pen.beam(0, hh, -SW - 3, 0, hh - 0.6, SW + 3, 0.14, 0.14); ctx.main();
      ctx.steam.push({ x: wx + r2.f(-3, 3), y: 0.2, z: wz + r2.f(-3, 3), s: r2.f(0.6, 1.4) });
    }
    // rows: z bands. band k occupies [zk, zk + depth]; alternate facing so rows sit back-to-back
    const scaleW = 1 / Math.sqrt(ctx.density);
    let zc = SW; let k = 0;
    const bands = [];
    while (zc < N.r) { const d = r2.f(9.5, 12.5); bands.push([zc, d, 1]); zc += d; if (k % 2 === 0) { const d2 = r2.f(9, 12); bands.push([zc, d2, -1]); zc += d2; } zc += r2.f(3.6, 5.2); k++; }
    const all = []; for (const b of bands) { all.push(b); all.push([-(b[0] + b[1]), b[1], -b[2]]); }
    for (const [z0, depth, facing] of all) {
      // facing: +1 → front towards -z (the street / alley below), -1 → front towards +z
      const zMid = z0 + depth / 2;
      const half = Math.sqrt(Math.max(0, N.r * N.r - zMid * zMid)); if (half < 20) continue;
      let x = -half + r2.f(0, 6);
      const isStreet = Math.abs(z0) < SW + 1 || Math.abs(z0 + depth) < SW + 1;
      while (x < half - 6) {
        if (r2.chance(0.06)) { x += r2.f(3.5, 5); continue; } // cross alley
        const big = r2.chance(0.07) && !isStreet;
        const w = (big ? r2.f(18, 30) : r2.f(6.5, 13)) * scaleW;
        const [wx, wz] = W(x + w / 2, zMid);
        if (districtAt(wx, wz).id !== 'sump' || ctx.occ.get(wx, wz) >= 2) { x += w; continue; }
        const dist = Math.hypot(x + w / 2, zMid) / N.r;
        const hN = field(wx, wz, 0.012, 913);
        const yaw = rot + (facing > 0 ? Math.PI : 0) + r2.f(-0.025, 0.025);
        const levels = Math.max(2, Math.round(2 + (1 - dist) * 5 + (hN - 0.45) * 12 + r2.f(-1.5, 2.5)));
        if (big) tenement(ctx, r2, wx, wz, yaw, w - 0.4, depth, r2.i(7, 18), { street: isStreet });
        else rowUnit(ctx, r2, wx, wz, yaw, w - r2.f(0, 0.5), depth - r2.f(0, 1.2), Math.min(levels, 13), isStreet);
        x += w;
      }
    }
    ctx.light(nx, nz, N.r * 0.9, [0.2, 0.9, 0.7], 0.1);
    ctx.poi({ type: 'nest', name: N.name, x: nx, y: 0, z: nz, district: 'sump' });
  }
  // --- everything else: superblocks of old tenements around yards + low shed carpet
  scatter(ctx, rng, 'sump', 118 / Math.sqrt(ctx.density), 0.3, 0.3, (x, z) => {
    const r = Math.hypot(x, z); const f = field(x, z, 0.0016, 31);
    const yaw0 = Math.atan2(x, z) + rng.pick([0, Math.PI / 2]) + rng.f(-0.2, 0.2);
    if (!ctx.occ.freeRect(x, z, 40, 34, yaw0, 3)) return;
    const hK = Math.max(0.35, 1.3 - r / 3300 + (f - 0.5) * 1.6);
    const cy = Math.cos(yaw0), sy = Math.sin(yaw0);
    const P = (lx, lz) => [x + lx * cy + lz * sy, z - lx * sy + lz * cy];
    // 2-4 slabs framing a yard
    const layout = rng.pick([[[-26, 0, 1.5708, 60, 20], [26, 0, 1.5708, 60, 20], [0, -24, 0, 30, 18]], [[0, -22, 0, 76, 20], [0, 22, 0, 76, 20]], [[-24, -8, 1.5708, 46, 22], [14, 20, 0, 50, 20], [22, -18, 0, 34, 22]], [[0, 0, 0, 72, 26]]]);
    for (const [lx, lz, ry, w, d] of layout) {
      const [wx, wz] = P(lx, lz);
      if (!tryPlace(ctx, wx, wz, w / 2, d / 2, yaw0 + ry, 1.5)) continue;
      tenement(ctx, rng, wx, wz, yaw0 + ry, w, d, Math.max(4, Math.round(rng.f(7, 24) * hK)));
    }
    // yard clutter: low sheds
    const ns = rng.i(3, 7);
    for (let i = 0; i < ns; i++) {
      const [wx, wz] = P(rng.f(-44, 44), rng.f(-38, 38)); const w = rng.f(7, 16), d = rng.f(6, 12);
      if (!tryPlace(ctx, wx, wz, w / 2, d / 2, yaw0, 0.5)) continue;
      shantyStack(ctx, rng, wx, wz, yaw0 + rng.pick([0, Math.PI / 2]), w, d, rng.i(1, 4));
    }
    if (rng.chance(0.6)) K.lampPost(ctx, x + rng.f(-10, 10), z + rng.f(-10, 10), yaw0, { color: rng.pick([K.NEON.sodium, K.NEON.cyan, K.NEON.green]), h: 8, radius: 26 });
  });
  // --- trunk pipes on stanchions crossing the district (the city's waste arteries)
  for (let i = 0; i < 5; i++) {
    const [x0, z0] = polar('sump', rng.f(0.05, 0.3), rng.f(-0.9, 0.9)), [x1, z1] = polar('sump', rng.f(0.6, 0.98), rng.f(-0.9, 0.9));
    const y = rng.f(40, 70), r = rng.f(1.8, 3.4);
    const steps = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 240);
    for (let k = 0; k < steps; k++) { const a = k / steps, b = (k + 1) / steps; K.pipeRun(ctx, x0 + (x1 - x0) * a, z0 + (z1 - z0) * a, x0 + (x1 - x0) * b, z0 + (z1 - z0) * b, y, r, { count: rng.i(1, 3), main: true, spacing: 60, mat: K.rust([0.36, 0.33, 0.3]) }); }
  }
}
