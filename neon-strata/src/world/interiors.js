// Walk-in interiors. Rooms are real geometry behind real door openings (no loading, no teleports):
// tower lobbies with reception + lift bank, shop rooms with counters and shelves, the player's capsule home.
import { ST, PAL, WK, FLAG } from '../render/cityMaterial.js';
import { M } from './builder.js';
import * as K from './kit.js';

const IN = FLAG.INDOOR;
const im = (st, color, extra = {}) => M(st, { color, flags: IN, ...extra });
const glow = (col, i = 6) => { const e = K.emis(col, i); e.flags = 0; return e; };

// colliders for a box building with a rectangular room cut out at ground level and a door gap in the front wall.
// room: {xa, xb, zb, zf, h}; door: {a, b} in x. Everything in the pen frame.
export function hollow(ctx, cx, cz, w, d, yTop, room, door) {
  const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2; const h = room.h;
  const box = (xa, xb, za, zb, ya, yb) => { if (xb - xa > 0.05 && zb - za > 0.05 && yb - ya > 0.05) ctx.solid((xa + xb) / 2, (za + zb) / 2, xb - xa, zb - za, ya, yb); };
  box(x0, x1, z0, z1, h, yTop);                       // everything above the room
  box(x0, room.xa, z0, z1, 0, h); box(room.xb, x1, z0, z1, 0, h); // left / right of the room
  box(room.xa, room.xb, z0, room.zb, 0, h);           // behind
  box(room.xa, door.a, room.zf - 0.35, z1, 0, h); box(door.b, room.xb, room.zf - 0.35, z1, 0, h); // front wall either side of the door
  box(door.a, door.b, room.zf - 0.35, z1, door.h ?? 2.8, h);
}

// inward-facing shell of a room. returns nothing; pen frame.
function shell(ctx, room, door, mats) {
  const pen = ctx.pen; const { xa, xb, zb, zf, h } = room; const t = 0.36; const zi = zf - t;
  pen.use(mats.floor); pen.flat(xa, zb, xb, zf + 0.05, 0.03);
  pen.use(mats.ceil); pen.flat(xa, zb, xb, zi, h, false, 0.9);
  pen.use(mats.wall);
  pen.wall(xa, zi, xa, zb, 0, h, { aoB: 0.75 }); pen.wall(xb, zb, xb, zi, 0, h, { aoB: 0.75 }); pen.wall(xa, zb, xb, zb, 0, h, { aoB: 0.75 });
  // inner side of the front wall around the door + door reveals
  if (door.a - xa > 0.05) pen.wall(door.a, zi, xa, zi, 0, h, { aoB: 0.75 });
  if (xb - door.b > 0.05) pen.wall(xb, zi, door.b, zi, 0, h, { aoB: 0.75 });
  const dh = door.h ?? 2.8; if (h - dh > 0.05) pen.wall(door.b, zi, door.a, zi, dh, h, {});
  pen.use(mats.trim || K.dark(0.1)); pen.wall(door.a, zf + 0.02, door.a, zi, 0, dh, {}); pen.wall(door.b, zi, door.b, zf + 0.02, 0, dh, {}); pen.flat(door.a, zi, door.b, zf + 0.02, dh, false, 0.8);
}

// ---------------------------------------------------------------------------------------------
// tower lobby: polished floor, stone walls with light coves, luminous ceiling grid, reception, lift bank, seating
export function lobby(ctx, rng, cx, zFront, o) {
  const pen = ctx.pen; ctx.main();
  const w = o.w, dep = o.d, h = o.h; const room = { xa: cx - w / 2, xb: cx + w / 2, zb: zFront - dep, zf: zFront, h };
  const door = { a: cx - o.doorHW, b: cx + o.doorHW, h: o.doorH };
  const acc = o.accent || K.NEON.ice; const big = w > 24;
  shell(ctx, room, door, { floor: im(ST.TILE, [0.2, 0.2, 0.22]), ceil: im(ST.COMPOSITE, [0.16, 0.16, 0.18]), wall: im(ST.STONE, [0.5, 0.48, 0.46]), trim: im(ST.COMPOSITE, [0.2, 0.2, 0.22]) });
  const zi = zFront - 0.36;
  // ceiling light panels + wall coves
  const nx = Math.max(2, Math.round(w / 6)), nz = Math.max(2, Math.round(dep / 6));
  pen.use(glow([1, 0.94, 0.84], 5)); for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { const x = room.xa + (i + 0.5) * (w / nx), z = room.zb + (j + 0.5) * ((dep - 0.4) / nz); pen.flat(x - 1.3, z - 0.5, x + 1.3, z + 0.5, h - 0.04, false, 1); }
  pen.use(glow(acc, 4)); for (let i = 0; i <= nx; i++) { const x = room.xa + 0.06 + i * ((w - 0.12) / nx); if (i === 0 || i === nx) continue; pen.wall(x - 0.08, room.zb + 0.05, x + 0.08, room.zb + 0.05, 0.4, h - 0.6, {}); }
  for (let j = 1; j < nz; j++) { const z = room.zb + j * ((dep - 0.4) / nz); pen.wall(room.xa + 0.05, z + 0.08, room.xa + 0.05, z - 0.08, 0.4, h - 0.6, {}); pen.wall(room.xb - 0.05, z - 0.08, room.xb - 0.05, z + 0.08, 0.4, h - 0.6, {}); }
  { const lx = Math.max(1, Math.round(w / 10)), lz = Math.max(1, Math.round(dep / 10)); const rg = Math.min(22, Math.max(9, h * 2.3)); for (let i = 0; i < lx; i++) for (let j = 0; j < lz; j++) { const x = room.xa + (i + 0.5) * (w / lx), z = room.zb + (j + 0.5) * ((dep - 0.4) / lz); ctx.light(pen.wx(x, z), pen.wz(x, z), rg, [1, 0.93, 0.82], 1.0, pen.oy + h - 0.4, { indoor: true, range: rg, gain: 4 }); } }
  if (ctx.atlas.bb && ctx.atlas.bb.length) for (const sx of [-1, 1]) for (let z = room.zb + 4; z < zi - 4; z += 7) { const r = rng.pick(ctx.atlas.bb); const pw = Math.min(4.2, h * 0.7), ph = pw / r.aspect; const x = cx + sx * (w / 2 - 0.06); pen.use(K.dark(0.06)); pen.box(x, z, 0.05, pw + 0.16, h * 0.5 - ph / 2 - 0.08, h * 0.5 + ph / 2 + 0.08, {}); pen.sign(x - sx * 0.04, h * 0.5, z, sx > 0 ? -Math.PI / 2 : Math.PI / 2, pw, ph, r, { intensity: 0.9, seed: rng.i(0, 255) }); }
  // floor inlay leading from the door to reception
  pen.use(glow(acc, 2)); pen.flat(cx - 0.07, room.zb + dep * 0.32, cx + 0.07, zi - 0.5, 0.045);
  // reception desk with brand wall behind
  const rz = room.zb + dep * 0.26; const rw = Math.min(9, w * 0.36);
  pen.box(cx, rz, rw, 1.1, 0.03, 1.12, { wall: im(ST.COMPOSITE, [0.14, 0.14, 0.16]), roof: im(ST.TILE, [0.3, 0.3, 0.32]) }); pen.use(glow(acc, 6)); pen.wall(cx - rw / 2, rz + 0.57, cx + rw / 2, rz + 0.57, 0.2, 0.32, {});
  ctx.solid(cx, rz, rw, 1.1, 0, 1.1);
  if (o.logo) { const sz = Math.min(h * 0.42, 4.6); pen.sign(cx, h * 0.56, room.zb + 0.1, 0, sz * o.logo.aspect, sz, o.logo, { intensity: 3, seed: rng.i(0, 255) }); }
  // lift bank on the back wall
  const nl = big ? 6 : 3; const lw = 2.3;
  for (let i = 0; i < nl; i++) {
    const s = i < nl / 2 ? -1 : 1; const k = i % (nl / 2); const x = cx + s * (rw / 2 + 2.2 + k * (lw + 0.9));
    if (Math.abs(x) > w / 2 + Math.abs(cx) - 1.6 && Math.abs(x - cx) > w / 2 - 1.6) continue;
    pen.use(im(ST.METAL, [0.5, 0.5, 0.54])); pen.wall(x - lw / 2, room.zb + 0.08, x + lw / 2, room.zb + 0.08, 0.03, 2.9, {});
    pen.use(K.dark(0.05)); pen.wall(x - 0.02, room.zb + 0.1, x + 0.02, room.zb + 0.1, 0.03, 2.9, {});
    pen.use(glow(i % 3 === 1 ? K.NEON.green : acc, 7)); pen.wall(x - 0.3, room.zb + 0.1, x + 0.3, room.zb + 0.1, 3.05, 3.2, {});
  }
  // columns
  if (big) for (const [sx, sz] of [[-1, 0.35], [1, 0.35], [-1, 0.72], [1, 0.72]]) { const x = cx + sx * w * 0.3, z = room.zb + dep * sz; pen.use(im(ST.STONE, [0.42, 0.4, 0.4])); pen.lathe(x, z, [[0.75, 0.03], [0.62, 0.5], [0.62, h - 0.5], [0.8, h]], 10, { cap: false }); ctx.solidCyl(x, z, 0.65, 0, h); }
  // seating + plants along the sides, terminal by the door
  const side = w / 2 - 2.2; let n = 0;
  for (let z = room.zb + dep * 0.45; z < zi - 2.5; z += 5.2) for (const s of [-1, 1]) { ctx.propL((n++ % 3) === 2 ? 'planterIn' : 'sofa', cx + s * side, 0.03, z, s > 0 ? -Math.PI / 2 : Math.PI / 2); ctx.solid(cx + s * side, z, 1.2, 2.2, 0, 0.8); }
  ctx.propL('kiosk', cx + (o.doorHW + 1.6), 0.03, zi - 1.4, Math.PI, 1.1);
  // floating brand hologram
  if (o.logo && big) { const c = [pen.wx(cx, room.zb + dep * 0.58), pen.wz(cx, room.zb + dep * 0.58)]; const sz = Math.min(5, h * 0.4); const dx = Math.cos(pen.yaw) * sz / 2, dz = -Math.sin(pen.yaw) * sz / 2; const y0 = pen.oy + h * 0.38; ctx.glow.quad([c[0] - dx, y0, c[1] - dz], [c[0] + dx, y0, c[1] + dz], [c[0] + dx, y0 + sz, c[1] + dz], [c[0] - dx, y0 + sz, c[1] - dz], [1, 1, 1], 0.8, 3, 1.6, { uv: [o.logo.u0, o.logo.v0, o.logo.u1, o.logo.v1], seed: rng.f(0, 9), night: 0 }); }
  // people circulate between the door and the lifts
  const P = (lx, lz) => [pen.wx(lx, lz), pen.oy + 0.03, pen.wz(lx, lz)];
  ctx.walkways.push({ pts: [P(cx - 2.2, zi + 3.5), P(cx - w * 0.2, room.zb + dep * 0.5), P(cx - w * 0.3, room.zb + 2.2), P(cx + w * 0.3, room.zb + 2.2), P(cx + w * 0.2, room.zb + dep * 0.5), P(cx + 2.2, zi + 3.5)], closed: true, district: 'core', indoor: true });
  const wp = P(cx, room.zb + dep * 0.5);
  const dp = P(cx, zFront + 7);
  const Lp = (lx, lz) => { const q = P(lx, lz); return { x: q[0], y: q[1], z: q[2] }; };
  ctx.poi({ type: 'lobby', work: { back: Lp(cx, rz + 2.0), front: Lp(cx, zi - 2.6), side: Lp(cx - w * 0.3, room.zb + 2.6), upA: null, upB: Lp(cx + w * 0.3, room.zb + 2.6) }, x: wp[0], y: wp[1], z: wp[2], brand: o.brand || null, name: o.name || '타워 로비', doorX: dp[0], doorZ: dp[2], big });
  return { room, door };
}


// what makes a room read as a room: skirting, a dado band, framed posters, pendant lamps, an exit sign, an extinguisher, a till
function dress(ctx, rng, room, zi, h, door, kind, lc, up) {
  const pen = ctx.pen; const { xa, xb, zb } = room; const w = xb - xa, dep = zi - zb, cx = (xa + xb) / 2; const dk = im(ST.METAL, [0.16, 0.16, 0.17]);
  pen.box(cx, zb + 0.03, w, 0.05, 0.03, 0.16, { wall: dk, roof: dk }); pen.box(xa + 0.03, (zb + zi) / 2, 0.05, dep, 0.03, 0.16, { wall: dk, roof: dk }); if (!up) pen.box(xb - 0.03, (zb + zi) / 2, 0.05, dep, 0.03, 0.16, { wall: dk, roof: dk });
  const dado = im(kind === 'bar' ? ST.RUST : ST.TILE, kind === 'bar' ? [0.4, 0.28, 0.2] : [0.36, 0.42, 0.46]); pen.box(xa + 0.02, (zb + zi) / 2, 0.035, dep - 0.1, 0.16, 1.05, { wall: dado, roof: dk }); pen.box(cx, zb + 0.02, w - 0.1, 0.035, 0.16, 1.05, { wall: dado, roof: dk });
  const at = ctx.atlas; const frame = (x, z, ang, rect, pw, y = 1.75) => { const ph = pw / rect.aspect; const nx = Math.sin(ang), nz = Math.cos(ang); pen.use(dk); pen.box(x + nx * 0.02, z + nz * 0.02, Math.abs(nz) * (pw + 0.1) + Math.abs(nx) * 0.04, Math.abs(nx) * (pw + 0.1) + Math.abs(nz) * 0.04, y - ph / 2 - 0.05, y + ph / 2 + 0.05, {}); pen.sign(x + nx * 0.045, y, z + nz * 0.045, ang, pw, ph, rect, { intensity: 0.7, seed: rng.i(0, 255) }); };
  if (at.bb && at.bb.length) { for (let z = zb + 1.4; z < zi - 1.4; z += rng.f(2.4, 3.4)) frame(xa + 0.04, z, Math.PI / 2, rng.pick(at.bb), 1.5); if (!up) for (let z = zb + 1.8; z < zi - 3.2; z += rng.f(2.6, 3.6)) frame(xb - 0.04, z, -Math.PI / 2, rng.pick(at.sq && at.sq.length && rng.chance(0.5) ? at.sq : at.bb), 1.0); }
  if (at.notice && at.notice.length) frame(cx - w * 0.25, zb + 0.04, 0, rng.pick(at.notice), 0.9, 2.05);
  // pendant lamps over the middle of the room
  const np = Math.max(2, Math.min(4, Math.round(dep / 2.6))); for (let i = 0; i < np; i++) { const z = zb + (i + 0.5) * (dep / np), x = cx + (kind === 'bar' ? -w * 0.18 : 0); pen.use(dk); pen.tube(x, h - 0.02, z, x, h - 0.62, z, 0.012, 3); pen.lathe(x, z, [[0.2, h - 0.84], [0.07, h - 0.62]], 8, { cap: false }); pen.use(glow(lc, 10)); pen.lathe(x, z, [[0.07, h - 0.86], [0.07, h - 0.76]], 6, {}); }
  // the middle of the room is used: tables with people at them, gondola shelving, benches of equipment
  { const fx = up ? Math.min(cx + w * 0.17, xb - 1.12 - 1.7) : cx + w * 0.17; if (w > (up ? 6.6 : 5.2)) for (let z = zb + 3.3; z < zi - 2.4; z += 2.5) {
      if (kind === 'bar') { ctx.propL('table', fx, 0.03, z, 0, 1, [rng.f(0.7, 1.4), rng.f(0.7, 1.3), rng.f(0.7, 1.3)]); ctx.solidCyl(fx, z, 0.42, 0, 0.75); for (let k = 0; k < 3; k++) if (rng.chance(0.6)) { const an = k * 2.094 + 0.5; const lx = Math.cos(an) * 0.74, lz = Math.sin(an) * 0.74; ctx.spots.push({ x: pen.wx(fx + lx, z + lz), y: pen.oy + 0.03, z: pen.wz(fx + lx, z + lz), yaw: pen.yaw + Math.atan2(-lx, -lz), sit: true }); } }
      else if (kind === 'home') break;
      else { ctx.propL(kind === 'tech' ? 'rack' : 'shelf', fx, 0.03, z, Math.PI / 2); ctx.solid(fx, z, 0.6, 2.1, 0, 1.9); } } }
  // exit sign over the door, extinguisher by it, a till screen on the counter side
  pen.use(glow([0.2, 1, 0.45], 5)); pen.box((door.a + door.b) / 2, zi - 0.03, 0.5, 0.04, (door.h ?? 2.7) + 0.12, (door.h ?? 2.7) + 0.3, {});
  pen.use(im(ST.PLASTER, [0.62, 0.1, 0.08])); pen.lathe(xa + 0.22, zi - 0.35, [[0.075, 0.18], [0.075, 0.6], [0.03, 0.7]], 7, {});
  pen.use(dk); pen.box(cx - w * 0.2, zb + 1.25, 0.34, 0.26, 1.02, 1.3, {}); pen.use(glow([0.5, 0.85, 1], 3)); pen.box(cx - w * 0.2, zb + 1.39, 0.28, 0.02, 1.06, 1.26, {});
}
// ---------------------------------------------------------------------------------------------
// small shop behind an open shopfront. kind: 'bar' | 'store' | 'tech' | 'home'
export function shopRoom(ctx, rng, xa, xb, zFront, dep, h, door, o = {}) {
  const pen = ctx.pen; ctx.detail();
  const w = xb - xa; const cx = (xa + xb) / 2; const kind = o.kind || rng.weighted([[4, 'bar'], [4, 'store'], [2, 'tech']]);
  const up = o.upper && kind !== 'home' && w >= 4.6 && dep >= 6.4 ? o.upper : 0; // a real second storey reached by a real stair
  const nUp = up ? Math.max(1, Math.min(12, o.upperN || 1)) : 0; const room = { xa, xb, zb: zFront - dep, zf: zFront, h: h + up * nUp };
  const warm = [1, 0.78, 0.5], cool = [0.7, 0.9, 1.0]; const lc = kind === 'tech' ? cool : kind === 'home' ? [1, 0.7, 0.45] : rng.pick([warm, warm, [1, 0.9, 0.75]]);
  const wallC = kind === 'tech' ? [0.5, 0.53, 0.58] : rng.pick([[0.7, 0.66, 0.58], [0.62, 0.65, 0.62], [0.72, 0.6, 0.5], [0.74, 0.72, 0.68]]);
  shell(ctx, room, door, { floor: im(kind === 'bar' ? ST.CONCRETE : ST.TILE, kind === 'bar' ? [0.4, 0.36, 0.32] : [0.5, 0.5, 0.5]), ceil: im(ST.TILE, [0.72, 0.72, 0.7]), wall: im(ST.PLASTER, wallC), trim: K.dark(0.1) });
  dress(ctx, rng, room, zFront - 0.36, h, door, kind, lc, up);
  const zi = zFront - 0.36;
  pen.use(glow(lc, 6)); pen.flat(cx - Math.min(1.6, w * 0.3), room.zb + dep * 0.35, cx + Math.min(1.6, w * 0.3), room.zb + dep * 0.35 + 0.5, h - 0.04, false, 1); pen.flat(cx - Math.min(1.6, w * 0.3), room.zb + dep * 0.72, cx + Math.min(1.6, w * 0.3), room.zb + dep * 0.72 + 0.5, h - 0.04, false, 1);
  { const rg = Math.min(13, Math.max(6.5, h * 2.4)); const nl = dep > 9 ? 2 : 1; for (let i = 0; i < nl; i++) { const z = room.zb + dep * (nl === 1 ? 0.5 : 0.3 + 0.42 * i); ctx.light(pen.wx(cx, z), pen.wz(cx, z), rg, lc, 1.0, pen.oy + h - 0.35, { indoor: true, range: rg, gain: 5 }); } }
  const left = door.a - xa > xb - door.b; // free side for the counter = the side away from the door
  const sx = left ? -1 : 1; const wallX = left ? xa : xb;
  if (kind === 'bar') {
    const cz = room.zb + dep * 0.5; const cl = dep - 2.4;
    pen.box(wallX - sx * 1.5, cz, 0.7, cl, 0.03, 1.08, { wall: im(ST.RUST, [0.34, 0.26, 0.2]), roof: im(ST.TILE, [0.3, 0.3, 0.3]) }); ctx.solid(wallX - sx * 1.5, cz, 0.7, cl, 0, 1.08);
    pen.use(glow(lc, 4)); pen.wall(wallX - sx * 0.06, cz + (left ? cl / 2 : -cl / 2), wallX - sx * 0.06, cz + (left ? -cl / 2 : cl / 2), 1.7, 1.82, {});
    for (let z = cz - cl / 2 + 0.6; z < cz + cl / 2; z += 1.0) ctx.propL('stool', wallX - sx * 2.35, 0.03, z, 0);
    for (let i = 0; i < 3; i++) { pen.use(im(ST.RUST, [0.3, 0.3, 0.32])); pen.lathe(wallX - sx * 0.55, cz - cl / 2 + 0.7 + i * 1.1, [[0.24, 1.1], [0.28, 1.5], [0.2, 1.54]], 7, {}); }
    if (rng.chance(0.6)) ctx.steam.push({ x: pen.wx(wallX - sx * 0.55, cz), y: pen.oy + 1.7, z: pen.wz(wallX - sx * 0.55, cz), s: 0.35 });
  } else if (kind === 'store' || kind === 'tech') {
    for (const s of [-1, 1]) { if (s === (left ? 1 : -1) && w < 5) continue; if (up && s > 0) continue; /* the stair runs along that wall */ const x = (s < 0 ? xa : xb) - s * 0.32; for (let z = room.zb + 0.9; z < zi - 2.2; z += 2.3) { ctx.propL(kind === 'tech' ? 'rack' : 'shelf', x, 0.03, z, s < 0 ? Math.PI / 2 : -Math.PI / 2); } }
    pen.box(cx - sx * (w / 2 - 1.6), room.zb + 1.2, 2.0, 0.7, 0.03, 1.0, { wall: im(ST.COMPOSITE, [0.2, 0.2, 0.22]), roof: im(ST.TILE, [0.3, 0.3, 0.3]) }); ctx.solid(cx - sx * (w / 2 - 1.6), room.zb + 1.2, 2.0, 0.7, 0, 1.0);
    pen.use(glow(kind === 'tech' ? K.NEON.cyan : lc, 5)); pen.wall(cx - sx * (w / 2 - 1.6) - 0.4, room.zb + 1.56, cx - sx * (w / 2 - 1.6) + 0.4, room.zb + 1.56, 1.05, 1.5, {});
  } else { // capsule home: bunk pods along the wall, terminal, locker
    for (let i = 0; i < 2; i++) for (let j = 0; j < Math.max(1, Math.floor((dep - 2) / 2.3)); j++) { const z = room.zb + 1.3 + j * 2.3; const y = 0.03 + i * 1.25; pen.box(wallX - sx * 0.62, z, 1.2, 2.15, y, y + 1.2, { wall: im(ST.COMPOSITE, [0.3, 0.3, 0.33]), roof: im(ST.COMPOSITE, [0.3, 0.3, 0.33]) }); pen.use(K.dark(0.03)); const xx = wallX - sx * 1.23; if (sx < 0) pen.wall(xx, z + 0.9, xx, z - 0.9, y + 0.14, y + 1.06, {}); else pen.wall(xx, z - 0.9, xx, z + 0.9, y + 0.14, y + 1.06, {}); pen.use(glow(i === 0 && j === 0 ? K.NEON.cyan : [1, 0.6, 0.3], i === 0 && j === 0 ? 5 : 1.6)); const x2 = wallX - sx * 1.235; if (sx < 0) pen.wall(x2, z + 0.9, x2, z - 0.9, y + 1.06, y + 1.12, {}); else pen.wall(x2, z - 0.9, x2, z + 0.9, y + 1.06, y + 1.12, {}); }
    ctx.solid(wallX - sx * 0.62, room.zb + dep / 2, 1.2, dep - 1.2, 0, 2.5);
    ctx.propL('kiosk', cx - sx * (w / 2 - 0.9), 0.03, room.zb + 0.8, 0, 0.9);
  }
  if (up) { const levelUp = (h, lv) => { const rise = lv ? up : h, yb = h - rise;
    const zb = room.zb, run = Math.min(dep - 1.7, 5.4), sx0 = xb - 1.12, z0 = zb + 0.25, zo = z0 + run * 0.72; const flr = im(kind === 'tech' ? ST.TILE : ST.CONCRETE, [0.36, 0.35, 0.34]), und = im(ST.PLASTER, [0.3, 0.3, 0.3]);
    // intermediate floor: everything except the stair opening along the door-side wall
    pen.use(flr); pen.flat(xa, zb, sx0, zi, h + 0.02); pen.flat(sx0, zo, xb, zi, h + 0.02); pen.use(und); pen.flat(xa, zb, sx0, zi, h - 0.02, false, 0.9); pen.flat(sx0, zo, xb, zi, h - 0.02, false, 0.9);
    ctx.solid((xa + sx0) / 2, (zb + zi) / 2, sx0 - xa, zi - zb, h - 0.22, h); ctx.solid((sx0 + xb) / 2, (zo + zi) / 2, xb - sx0, zi - zo, h - 0.22, h);
    // stair flight: low end near the shopfront, climbing towards the back wall
    const n = 9; pen.use(im(ST.METAL, [0.3, 0.3, 0.33])); for (let i = 0; i < n; i++) { const zc = z0 + run - (i + 0.5) * (run / n); pen.box((sx0 + xb) / 2 + 0.03, zc, 1.0, run / n, yb + Math.max(0, (i - 0.4) * (rise / n)), yb + (i + 1) * (rise / n), {}); }
    ctx.phys.addRamp(pen.wx((sx0 + xb) / 2, z0 + run / 2), pen.wz((sx0 + xb) / 2, z0 + run / 2), run / 2, 0.52, pen.yaw + Math.PI / 2, pen.oy + yb + 0.03, pen.oy + h, 0.6);
    // balustrade along the opening (gap at the head of the stair) and at the stair foot side
    pen.use(K.dark(0.1)); pen.box(sx0 - 0.03, (z0 + 1.0 + zo) / 2, 0.06, zo - z0 - 1.0, h, h + 1.0, {}); ctx.solid(sx0 - 0.03, (z0 + 1.0 + zo) / 2, 0.1, zo - z0 - 1.0, h, h + 1.0); pen.box((sx0 + xb) / 2, zo + 0.03, xb - sx0, 0.06, h, h + 1.0, {}); ctx.solid((sx0 + xb) / 2, zo + 0.03, xb - sx0, 0.1, h, h + 1.0);
    // upstairs: a second room with its own light and furniture
    pen.use(glow(lc, 6)); pen.flat(cx - Math.min(1.6, w * 0.3), zb + dep * 0.5, cx + Math.min(1.6, w * 0.3), zb + dep * 0.5 + 0.5, h + up - 0.04, false, 1);
    ctx.light(pen.wx(cx, zb + dep * 0.5), pen.wz(cx, zb + dep * 0.5), 8, lc, 1.0, pen.oy + h + up - 0.35, { indoor: true, range: 8, gain: 5 });
    const ux = (xa + sx0) / 2;
    if (kind === 'bar') { for (const z of [zb + dep * 0.3, zb + dep * 0.68]) { ctx.propL('table', ux, h + 0.02, z, 0, 1, [rng.f(0.7, 1.4), rng.f(0.7, 1.3), rng.f(0.7, 1.3)]); ctx.solidCyl(ux, z, 0.42, h, h + 0.75); for (let k = 0; k < 3; k++) if (rng.chance(0.6)) { const an = k * 2.094 + 0.5; const lx = Math.cos(an) * 0.74, lz = Math.sin(an) * 0.74; ctx.spots.push({ x: pen.wx(ux + lx, z + lz), y: pen.oy + h + 0.02, z: pen.wz(ux + lx, z + lz), yaw: pen.yaw + Math.atan2(-lx, -lz), sit: true }); } } }
    else { for (let z = zb + 0.9; z < zi - 1.5; z += 2.3) ctx.propL(kind === 'tech' ? 'rack' : 'shelf', xa + 0.32, h + 0.02, z, Math.PI / 2); ctx.propL('sofa', ux + 0.4, h + 0.02, zi - 1.2, Math.PI); ctx.solid(ux + 0.4, zi - 1.2, 2.2, 1.0, h, h + 0.8); ctx.propL('planterIn', xa + 0.6, h + 0.02, zi - 0.7, 0); }
  }; for (let lv = 0; lv < nUp; lv++) levelUp(h + lv * up, lv);
  }
  if (o.sign) { const sz = Math.min(1.1, h * 0.3); pen.sign(cx, h - 0.8, room.zb + 0.06, 0, sz * o.sign.aspect > w - 1 ? w - 1 : sz * o.sign.aspect, sz, o.sign, { intensity: 2.5, seed: rng.i(0, 255) }); }
  ctx.main();
  const st = up ? { foot: [pen.wx(xb - 0.56, room.zb + 0.25 + Math.min(dep - 1.7, 5.4) - 0.3), pen.wz(xb - 0.56, room.zb + 0.25 + Math.min(dep - 1.7, 5.4) - 0.3)], top: [pen.wx(xb - 0.56, room.zb + 0.5), pen.wz(xb - 0.56, room.zb + 0.5)], y: pen.oy + h } : null;
  const ux = (xa + xb - 1.12) / 2; const Wp = (lx, lz, y = 0.03) => ({ x: pen.wx(lx, lz), y: pen.oy + y, z: pen.wz(lx, lz) });
  const work = { back: Wp(cx, room.zb + 2.4), front: Wp(cx, zi - 1.5), side: Wp(xa + 1.3, room.zb + dep * 0.55), upA: up ? Wp(ux + 0.9, room.zb + dep * 0.3, h + 0.02) : null, upB: up ? Wp(ux + 0.9, room.zb + dep * 0.62, h + 0.02) : null };
  return { room, door, kind, up, stair: st, work };
}

// ---------------------------------------------------------------------------------------------
// Floors above a lobby: a lift core rising from the lobby's back corner to every served floor, and each floor a real
// plate laid out the way that kind of building works (open office / wards / guest rooms / classrooms off a corridor).
// Colliders, the lift and the floor plan are made here; the visible fit-out is built on demand (see interiorStream).
// o: { room, door, foot:{x0,x1,z0,z1}, fp:{x0,x1,z0,z1}, y1, fh, n, top, use, win:[front, back, sides], name }
export function upperFloors(ctx, rng, o) {
  const pen = ctx.pen; const { room, fp, fh, foot: F } = o; const n = Math.max(0, Math.min(15, o.n | 0));
  if (n < 1) { hollow(ctx, (F.x0 + F.x1) / 2, (F.z0 + F.z1) / 2, F.x1 - F.x0, F.z1 - F.z0, o.top, room, o.door); return null; }
  const hs = 1.45, sx = Math.min(room.xa + 1.85, room.xb - 1.85), sz = room.zb + 1.85; const hole = [sx - hs, sx + hs, sz - hs, sz + hs];
  const B = (xa, xb, za, zb, ya, yb) => (xb - xa > 0.05 && zb - za > 0.05 && yb - ya > 0.05 ? ctx.solid((xa + xb) / 2, (za + zb) / 2, xb - xa, zb - za, ya, yb) : null);
  const BH = (xa, xb, za, zb, ya, yb) => { const [h0, h1, k0, k1] = hole; B(xa, h0, za, zb, ya, yb); B(h1, xb, za, zb, ya, yb); B(Math.max(xa, h0), Math.min(xb, h1), za, k0, ya, yb); B(Math.max(xa, h0), Math.min(xb, h1), k1, zb, ya, yb); };
  hollow(ctx, (F.x0 + F.x1) / 2, (F.z0 + F.z1) / 2, F.x1 - F.x0, F.z1 - F.z0, room.h, room, o.door); // ground floor as before; the shaft column stays open above it
  BH(F.x0, F.x1, F.z0, F.z1, room.h, o.y1);
  const ys = []; for (let k = 0; k < n; k++) ys.push(o.y1 + k * fh);
  const floors = [], doors = [];
  for (let k = 0; k < n; k++) {
    const y = ys[k], yc = y + fh - 0.3;
    B(F.x0, fp.x0, F.z0, F.z1, y, y + fh); B(fp.x1, F.x1, F.z0, F.z1, y, y + fh); B(fp.x0, fp.x1, F.z0, fp.z0, y, y + fh); B(fp.x0, fp.x1, fp.z1, F.z1, y, y + fh);
    if (k < n - 1) BH(F.x0, F.x1, F.z0, F.z1, yc, y + fh); else B(F.x0, F.x1, F.z0, F.z1, yc, Math.max(yc + 0.3, o.top));
    // lift core: three walls and a front with a door that the car opens
    B(hole[0] - 0.15, hole[0], hole[2] - 0.15, hole[3] + 0.15, y, yc); B(hole[1], hole[1] + 0.15, hole[2] - 0.15, hole[3] + 0.15, y, yc); B(hole[0], hole[1], hole[2] - 0.15, hole[2], y, yc);
    B(hole[0], sx - 0.7, hole[3], hole[3] + 0.15, y, yc); B(sx + 0.7, hole[1], hole[3], hole[3] + 0.15, y, yc); B(sx - 0.7, sx + 0.7, hole[3], hole[3] + 0.15, 2.3 + y, yc);
    doors.push(B(sx - 0.7, sx + 0.7, hole[3], hole[3] + 0.15, y, y + 2.3));
    // the plan of this floor
    const use = o.use === 'office' ? (k === n - 1 ? 'lounge' : rng.weighted([[7, 'open'], [1.6, 'meet'], [1.4, 'lounge']])) : o.use;
    const band = use === 'ward' || use === 'rooms' || use === 'class' ? bandPlan(fp, hole, use === 'ward' ? 6.4 : use === 'rooms' ? 4.6 : 8.8) : null;
    if (band) for (const w of band.walls) { const t = 0.06; if (Math.abs(w[1] - w[3]) < 1e-3) B(Math.min(w[0], w[2]), Math.max(w[0], w[2]), w[1] - t, w[1] + t, y + (w[4] ?? 0), Math.min(yc, y + (w[5] ?? 9))); else B(w[0] - t, w[0] + t, Math.min(w[1], w[3]), Math.max(w[1], w[3]), y + (w[4] ?? 0), Math.min(yc, y + (w[5] ?? 9))); }
    floors.push({ y, use, band, seed: rng.i(0, 1e6) });
  }
  const stops = [{ y: pen.oy + 0.03, name: o.name ? `${o.name} 로비` : '로비' }, ...ys.map((y, k) => ({ y: pen.oy + y + 0.02, name: `${k + 2}층 · ${USE_NAME[floors[k].use]}` }))];
  const yaw = pen.yaw; const L = { id: 'b' + (ctx.lifts ? ctx.lifts.length : 0), bld: true, x: pen.wx(sx, sz), z: pen.wz(sx, sz), ang: Math.atan2(Math.cos(yaw), Math.sin(yaw)), r: 1.2, stops, doors };
  (ctx.lifts || (ctx.lifts = [])).push(L);
  const spec = { ox: pen.ox, oy: pen.oy, oz: pen.oz, yaw, fp, hole, sx, sz, fh, floors, win: o.win || [1, 1, 0], room: { xa: room.xa, xb: room.xb, zb: room.zb, h: room.h }, wx: L.x, wz: L.z, kind: o.use };
  (ctx.towers || (ctx.towers = [])).push(spec);
  return spec;
}
export const USE_NAME = { open: '사무실', meet: '회의실', lounge: '라운지', ward: '병동', rooms: '객실', class: '교실' };
// rooms off a corridor that runs past the lift door: front band split into rooms, each with its own door
function bandPlan(fp, hole, roomW) {
  const zc0 = hole[3] + 0.2, zc1 = zc0 + 2.3; if (fp.z1 - zc1 < 3.4) return null;
  const n = Math.max(1, Math.floor((fp.x1 - fp.x0) / roomW)); const rw = (fp.x1 - fp.x0) / n; const rooms = [], walls = [];
  const row = (zd, zw, skipCore) => { let prev = null;
    for (let i = 0; i < n; i++) { const xa = fp.x0 + i * rw, xb = xa + rw; if (skipCore && xa < hole[1] + 3.6 && xb > hole[0] - 0.3) { prev = null; continue; } const dx = xa + 0.45;
      rooms.push({ x0: xa, x1: xb, zd, zw, d0: dx, d1: dx + 1.0 }); walls.push([xa, zd, dx, zd], [dx + 1.0, zd, xb, zd], [dx, zd, dx + 1.0, zd, 2.2, 9]);
      if (prev !== null || i > 0) walls.push([xa, zd, xa, zw]); if (i === n - 1 || (skipCore && xb + rw > hole[0] - 0.3 && xb < hole[1] + 3.6)) walls.push([xb, zd, xb, zw]); prev = i; } };
  row(zc1, fp.z1, false); if (zc0 - fp.z0 >= 3.4) row(zc0, fp.z0, true);
  return { zc0, zc1, rooms, walls };
}

// ---- fit-out (geometry), built when the player comes close
export function furnishFloors(spec, pen, PROPS) {
  const { fp, hole, sx, fh } = spec; const C = Math.cos(spec.yaw), S = Math.sin(spec.yaw); const spots = [], walks = [];
  const W = (lx, lz) => [spec.ox + lx * C + lz * S, spec.oz - lx * S + lz * C];
  const home = () => pen.at(spec.ox, spec.oy, spec.oz, spec.yaw);
  const prop = (name, lx, ly, lz, ry = 0, sc = 1) => { const [x, z] = W(lx, lz); pen.at(x, spec.oy + ly, z, spec.yaw + ry); if (sc !== 1) { const b = pen.b; const n0 = b.n; PROPS[name](pen); scaleFrom(b, n0, x, spec.oy + ly, z, sc); } else PROPS[name](pen); home(); };
  const seat = (lx, ly, lz, ry, o = {}) => { const [x, z] = W(lx, lz); spots.push({ x, y: spec.oy + ly, z, yaw: spec.yaw + ry, indoor: true, ...o }); };
  const keep = (x, z, m = 0) => x > hole[0] - 1.2 - m && x < hole[1] + 1.2 + m && z > hole[2] - 1.2 - m && z < hole[3] + 2.6 + m;
  home();
  // lobby part of the core
  core(pen, hole, sx, 0.03, spec.room.h, true);
  for (const f of spec.floors) {
    const y = f.y, yc = y + fh - 0.3; let rs = f.seed; const r = () => ((rs = (rs * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const flo = f.use === 'ward' || f.use === 'class' ? im(ST.TILE, [0.62, 0.64, 0.62]) : f.use === 'rooms' ? im(ST.FABRIC, [0.32, 0.26, 0.24]) : f.use === 'lounge' ? im(ST.COMPOSITE, [0.5, 0.42, 0.34]) : im(ST.FABRIC, [0.3, 0.32, 0.36]);
    holeFlat(pen, fp, hole, y + 0.02, flo, true); holeFlat(pen, fp, hole, yc, im(ST.TILE, [0.8, 0.8, 0.78]), false);
    // perimeter: glazing where the facade has windows (sill + head band), solid wall elsewhere
    const wallM = im(ST.PLASTER, f.use === 'ward' ? [0.78, 0.82, 0.8] : f.use === 'class' ? [0.8, 0.76, 0.66] : [0.76, 0.75, 0.72]);
    const side = (x0, z0, x1, z1, glazed) => { pen.use(wallM); if (glazed) { pen.wall(x0, z0, x1, z1, y, y + 0.92, { aoB: 0.7 }); pen.wall(x0, z0, x1, z1, yc - 0.5, yc, {}); pen.use(K.dark(0.12)); pen.wall(x0, z0, x1, z1, y + 0.92, y + 0.98, {}); } else pen.wall(x0, z0, x1, z1, y, yc, { aoB: 0.7 }); };
    side(fp.x0, fp.z1, fp.x0, fp.z0, spec.win[2]); side(fp.x0, fp.z0, fp.x1, fp.z0, spec.win[1]); side(fp.x1, fp.z0, fp.x1, fp.z1, spec.win[2]); side(fp.x1, fp.z1, fp.x0, fp.z1, spec.win[0]);
    core(pen, hole, sx, y, yc, false);
    // ceiling light panels
    pen.use(glow([1, 0.96, 0.9], f.use === 'rooms' ? 3 : 5)); for (let x = fp.x0 + 2; x < fp.x1 - 1.5; x += 3.6) for (let z = fp.z0 + 1.8; z < fp.z1 - 1.2; z += 3.2) if (!keep(x, z, -1)) pen.flat(x - 0.6, z - 0.3, x + 0.6, z + 0.3, yc - 0.02, false);
    const B = f.band;
    if (B) { // corridor and rooms
      for (const w of B.walls) { const y0 = y + (w[4] ?? 0), y1 = Math.min(yc, y + (w[5] ?? 9)); pen.use(wallM); pen.wall(w[0], w[1], w[2], w[3], y0, y1, {}); pen.wall(w[2], w[3], w[0], w[1], y0, y1, {}); }
      pen.use(im(ST.TILE, [0.5, 0.5, 0.5])); pen.flat(fp.x0, B.zc0, fp.x1, B.zc1, y + 0.03);
      walks.push({ pts: [[fp.x0 + 1, y, (B.zc0 + B.zc1) / 2], [fp.x1 - 1, y, (B.zc0 + B.zc1) / 2]].map(([lx, ly, lz]) => { const [x, z] = W(lx, lz); return [x, spec.oy + ly + 0.03, z]; }), closed: false, district: 'core', indoor: true });
      for (const rm of B.rooms) {
        const zd = rm.zd, zw = rm.zw, sg = zw > zd ? 1 : -1, rf = sg > 0 ? 0 : Math.PI, w = rm.x1 - rm.x0, cx = (rm.x0 + rm.x1) / 2, zm = (zd + zw) / 2;
        pen.use(K.dark(0.14)); pen.wall(rm.d0, zd - 0.07, rm.d0 - 0.02, zd + 0.07, y, y + 2.2, {});
        if (f.use === 'rooms') { prop('bed', cx + 0.3, y, zd + sg * 1.25, rf); prop('desk', rm.x1 - 0.55, y, zw - sg * 1.4, -Math.PI / 2, 0.85); prop('sofa', rm.x0 + 0.7, y, zw - sg * 1.0, Math.PI / 2); if (r() < 0.35) seat(rm.x0 + 1.0, y + 0.03, zw - sg * 1.0, Math.PI / 2, { sit: true }); }
        else if (f.use === 'ward') { const nb = w > 5.6 ? 2 : 1; for (let i = 0; i < nb; i++) { const bx = nb === 1 ? cx : (i ? rm.x1 - 1.0 : rm.x0 + 1.0); for (const bz of [zd + sg * 1.4, zw - sg * 1.4]) { if (Math.abs(bz - zd) < 1.3 || Math.abs(zw - bz) < 1.3) continue; prop('bedH', bx, y, bz, i ? Math.PI / 2 : -Math.PI / 2); if (r() < 0.4) seat(bx + (i ? -1.5 : 1.5), y + 0.03, bz + 0.6, i ? Math.PI / 2 : -Math.PI / 2, { sit: true }); } }
          pen.use(im(ST.FABRIC, [0.6, 0.72, 0.74])); pen.wall(cx - 0.6, zd + sg * 0.6, cx - 0.6, zw - sg * 0.6, y + 0.25, y + 2.1, {}); pen.wall(cx - 0.6, zw - sg * 0.6, cx - 0.6, zd + sg * 0.6, y + 0.25, y + 2.1, {}); }
        else { pen.use(im(ST.METAL, [0.08, 0.14, 0.12])); pen.wall(rm.x0 + 0.08, Math.max(zd, zw) - 0.8, rm.x0 + 0.08, Math.min(zd, zw) + 0.8, y + 0.9, y + 2.3, {});
          prop('desk', rm.x0 + 1.4, y, zm, Math.PI / 2, 0.9);
          for (let x = rm.x0 + 2.8; x < rm.x1 - 0.7; x += 1.05) for (let z = Math.min(zd, zw) + 0.8; z < Math.max(zd, zw) - 0.6; z += 1.15) { prop('sdesk', x, y, z, -Math.PI / 2); if (r() < 0.55) seat(x + 0.5, y + 0.03, z, -Math.PI / 2, { sit: true }); } }
      }
      // back-of-house behind the corridor: station counter, trolleys or stores
      const bx = hole[1] + 0.4; if (bx < fp.x1 - 3.5 && fp.z0 + 1.2 < B.zc0 - 1.2) { pen.use(im(ST.COMPOSITE, [0.6, 0.62, 0.64])); pen.box(bx + 1.6, (fp.z0 + B.zc0) / 2, 3.2, 0.7, y, y + 1.05, { wall: im(ST.COMPOSITE, [0.55, 0.57, 0.6]), roof: im(ST.TILE, [0.7, 0.7, 0.7]) }); if (r() < 0.8) seat(bx + 1.6, y + 0.03, (fp.z0 + B.zc0) / 2 - 0.8, 0, { clip: 'phone' }); }
    } else if (f.use === 'open') {
      for (let z = fp.z0 + 1.5; z < fp.z1 - 2.0; z += 3.6) for (let x = fp.x0 + 1.2; x < fp.x1 - 1.0; x += 1.75) { if (keep(x, z) || keep(x, z + 0.9)) continue; prop('desk', x, y, z, Math.PI); prop('desk', x, y, z + 0.9, 0); if (r() < 0.45) seat(x, y + 0.03, z + 0.9 - 0.62, 0, { sit: true }); if (r() < 0.45) seat(x, y + 0.03, z + 0.62, Math.PI, { sit: true }); }
      for (let x = fp.x0 + 0.8; x < fp.x1 - 0.5; x += 5.4) if (!keep(x, fp.z0 + 0.6)) prop('planterIn', x, y, fp.z0 + 0.6, 0);
    } else if (f.use === 'meet') {
      const cx = (fp.x0 + fp.x1) / 2 + (keep((fp.x0 + fp.x1) / 2, (fp.z0 + fp.z1) / 2, 3) ? (fp.x1 - fp.x0) / 4 : 0), cz = (fp.z0 + fp.z1) / 2, L = Math.min(7, (fp.x1 - fp.x0) * 0.4);
      pen.box(cx, cz, L, 1.3, y + 0.7, y + 0.76, { wall: im(ST.COMPOSITE, [0.3, 0.24, 0.18]), roof: im(ST.COMPOSITE, [0.34, 0.27, 0.2]) }); pen.use(im(ST.METAL, [0.2, 0.2, 0.22])); pen.box(cx, cz, L * 0.8, 0.4, y, y + 0.7, {});
      for (let x = cx - L / 2 + 0.6; x < cx + L / 2 - 0.3; x += 1.1) for (const sd of [-1, 1]) { prop('stool', x, y, cz + sd * 1.0, 0); if (r() < 0.6) seat(x, y + 0.03, cz + sd * 1.0, sd > 0 ? Math.PI : 0, { sit: true }); }
      pen.use(im(ST.SCREEN, [1, 1, 1])); pen.use({ st: ST.SCREEN, color: [1, 1, 1], seed: f.seed & 255, cellW: 12, floorH: 7, extra: 18, flags: 8 }); pen.wall(fp.x0 + 0.05, cz + 1.8, fp.x0 + 0.05, cz - 1.8, y + 0.9, y + 2.9, { uv: [0, 0, 1, 1] });
    } else { // lounge / pantry
      pen.box((fp.x0 + fp.x1) / 2, fp.z0 + 0.4, Math.min(8, fp.x1 - fp.x0 - 4), 0.7, y, y + 1.0, { wall: im(ST.COMPOSITE, [0.24, 0.26, 0.3]), roof: im(ST.TILE, [0.8, 0.8, 0.78]) });
      for (let x = fp.x0 + 2.2; x < fp.x1 - 2; x += 4.6) for (let z = fp.z0 + 3.2; z < fp.z1 - 2; z += 4.2) { if (keep(x, z, 0.5)) continue; prop('sofa', x - 1.0, y, z, Math.PI / 2); prop('sofa', x + 1.0, y, z, -Math.PI / 2); prop('table', x, y, z, 0, 0.8); if (r() < 0.5) seat(x - 0.9, y + 0.03, z, Math.PI / 2, { sit: true }); if (r() < 0.4) seat(x + 0.9, y + 0.03, z, -Math.PI / 2, { sit: true }); }
      for (let x = fp.x0 + 1; x < fp.x1 - 1; x += 3.3) if (!keep(x, fp.z1 - 0.7)) prop('planterIn', x, y, fp.z1 - 0.7, 0);
    }
    if (!B) { const pts = [[fp.x0 + 1, fp.z0 + 1], [fp.x1 - 1, fp.z0 + 1], [fp.x1 - 1, fp.z1 - 1], [fp.x0 + 1, fp.z1 - 1]]; walks.push({ pts: pts.map(([lx, lz]) => { const [x, z] = W(lx, lz); return [x, spec.oy + y + 0.03, z]; }), closed: true, district: 'core', indoor: true }); }
  }
  home();
  return { spots, walks };
}
function scaleFrom(b, n0, x, y, z, k) { const P = b.pos; for (let i = n0; i < b.n; i++) { P[i * 3] = x + (P[i * 3] - x) * k; P[i * 3 + 1] = y + (P[i * 3 + 1] - y) * k; P[i * 3 + 2] = z + (P[i * 3 + 2] - z) * k; } }
// floor / ceiling plate with the shaft cut out (pen frame)
function holeFlat(pen, fp, hole, y, mat, up) { pen.use(mat); const [h0, h1, k0, k1] = hole; const R = (a, b, c, d) => { if (b - a > 0.05 && d - c > 0.05) pen.flat(a, c, b, d, y, up); }; R(fp.x0, h0, fp.z0, fp.z1); R(h1, fp.x1, fp.z0, fp.z1); R(h0, h1, fp.z0, k0); R(h0, h1, k1, fp.z1); }
// the lift core seen from the floor: three walls, a framed door with a lit floor indicator
function core(pen, hole, sx, y0, y1, ground) {
  const [h0, h1, k0, k1] = hole; const m = im(ST.STONE, [0.42, 0.41, 0.4]);
  pen.use(m); pen.wall(h1 + 0.15, k0 - 0.15, h0 - 0.15, k0 - 0.15, y0, y1, { aoB: 0.7 }); pen.wall(h0 - 0.15, k0 - 0.15, h0 - 0.15, k1 + 0.15, y0, y1, { aoB: 0.7 }); pen.wall(h1 + 0.15, k1 + 0.15, h1 + 0.15, k0 - 0.15, y0, y1, { aoB: 0.7 });
  pen.wall(h0 - 0.15, k1 + 0.15, sx - 0.7, k1 + 0.15, y0, y1, { aoB: 0.7 }); pen.wall(sx + 0.7, k1 + 0.15, h1 + 0.15, k1 + 0.15, y0, y1, { aoB: 0.7 }); pen.wall(sx - 0.7, k1 + 0.15, sx + 0.7, k1 + 0.15, y0 + 2.3, y1, {});
  pen.use(im(ST.METAL, [0.62, 0.62, 0.64])); pen.wall(sx - 0.82, k1 + 0.17, sx - 0.7, k1 + 0.17, y0, y0 + 2.42, {}); pen.wall(sx + 0.7, k1 + 0.17, sx + 0.82, k1 + 0.17, y0, y0 + 2.42, {}); pen.wall(sx - 0.82, k1 + 0.17, sx + 0.82, k1 + 0.17, y0 + 2.3, y0 + 2.42, {});
  pen.use(glow([1, 0.7, 0.3], 5)); pen.wall(sx - 0.25, k1 + 0.18, sx + 0.25, k1 + 0.18, y0 + 2.5, y0 + 2.62, {}); pen.use(glow([0.6, 0.9, 1], 4)); pen.wall(sx + 0.95, k1 + 0.18, sx + 1.07, k1 + 0.18, y0 + 1.1, y0 + 1.3, {});
  void ground;
}
