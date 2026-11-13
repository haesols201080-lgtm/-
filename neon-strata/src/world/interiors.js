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
  { const lx = Math.max(1, Math.round(w / 10)), lz = Math.max(1, Math.round(dep / 10)); const rg = Math.min(22, Math.max(9, h * 2.3)); for (let i = 0; i < lx; i++) for (let j = 0; j < lz; j++) { const x = room.xa + (i + 0.5) * (w / lx), z = room.zb + (j + 0.5) * ((dep - 0.4) / lz); ctx.light(pen.wx(x, z), pen.wz(x, z), rg, [1, 0.93, 0.82], 1.0, pen.oy + h - 0.4, { indoor: true, range: rg }); } }
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
  ctx.poi({ type: 'lobby', x: wp[0], y: wp[1], z: wp[2], brand: o.brand || null, name: o.name || '타워 로비', doorX: dp[0], doorZ: dp[2], big });
  return { room, door };
}

// ---------------------------------------------------------------------------------------------
// small shop behind an open shopfront. kind: 'bar' | 'store' | 'tech' | 'home'
export function shopRoom(ctx, rng, xa, xb, zFront, dep, h, door, o = {}) {
  const pen = ctx.pen; ctx.detail();
  const room = { xa, xb, zb: zFront - dep, zf: zFront, h }; const w = xb - xa; const cx = (xa + xb) / 2; const kind = o.kind || rng.weighted([[4, 'bar'], [4, 'store'], [2, 'tech']]);
  const warm = [1, 0.78, 0.5], cool = [0.7, 0.9, 1.0]; const lc = kind === 'tech' ? cool : kind === 'home' ? [1, 0.7, 0.45] : rng.pick([warm, warm, [1, 0.9, 0.75]]);
  const wallC = kind === 'tech' ? [0.3, 0.32, 0.36] : rng.pick([[0.44, 0.4, 0.34], [0.36, 0.38, 0.36], [0.46, 0.36, 0.3]]);
  shell(ctx, room, door, { floor: im(kind === 'tech' ? ST.TILE : ST.CONCRETE, [0.34, 0.33, 0.32]), ceil: im(ST.PLASTER, [0.3, 0.3, 0.3]), wall: im(ST.PLASTER, wallC), trim: K.dark(0.1) });
  const zi = zFront - 0.36;
  pen.use(glow(lc, 6)); pen.flat(cx - Math.min(1.6, w * 0.3), room.zb + dep * 0.35, cx + Math.min(1.6, w * 0.3), room.zb + dep * 0.35 + 0.5, h - 0.04, false, 1); pen.flat(cx - Math.min(1.6, w * 0.3), room.zb + dep * 0.72, cx + Math.min(1.6, w * 0.3), room.zb + dep * 0.72 + 0.5, h - 0.04, false, 1);
  { const rg = Math.min(13, Math.max(6.5, h * 2.4)); const nl = dep > 9 ? 2 : 1; for (let i = 0; i < nl; i++) { const z = room.zb + dep * (nl === 1 ? 0.5 : 0.3 + 0.42 * i); ctx.light(pen.wx(cx, z), pen.wz(cx, z), rg, lc, 1.0, pen.oy + h - 0.35, { indoor: true, range: rg }); } }
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
    for (const s of [-1, 1]) { if (s === (left ? 1 : -1) && w < 5) continue; const x = (s < 0 ? xa : xb) - s * 0.32; for (let z = room.zb + 0.9; z < zi - 2.2; z += 2.3) { ctx.propL(kind === 'tech' ? 'rack' : 'shelf', x, 0.03, z, s < 0 ? Math.PI / 2 : -Math.PI / 2); } }
    pen.box(cx - sx * (w / 2 - 1.6), room.zb + 1.2, 2.0, 0.7, 0.03, 1.0, { wall: im(ST.COMPOSITE, [0.2, 0.2, 0.22]), roof: im(ST.TILE, [0.3, 0.3, 0.3]) }); ctx.solid(cx - sx * (w / 2 - 1.6), room.zb + 1.2, 2.0, 0.7, 0, 1.0);
    pen.use(glow(kind === 'tech' ? K.NEON.cyan : lc, 5)); pen.wall(cx - sx * (w / 2 - 1.6) - 0.4, room.zb + 1.56, cx - sx * (w / 2 - 1.6) + 0.4, room.zb + 1.56, 1.05, 1.5, {});
  } else { // capsule home: bunk pods along the wall, terminal, locker
    for (let i = 0; i < 2; i++) for (let j = 0; j < Math.max(1, Math.floor((dep - 2) / 2.3)); j++) { const z = room.zb + 1.3 + j * 2.3; const y = 0.03 + i * 1.25; pen.box(wallX - sx * 0.62, z, 1.2, 2.15, y, y + 1.2, { wall: im(ST.COMPOSITE, [0.3, 0.3, 0.33]), roof: im(ST.COMPOSITE, [0.3, 0.3, 0.33]) }); pen.use(K.dark(0.03)); const xx = wallX - sx * 1.23; if (sx < 0) pen.wall(xx, z + 0.9, xx, z - 0.9, y + 0.14, y + 1.06, {}); else pen.wall(xx, z - 0.9, xx, z + 0.9, y + 0.14, y + 1.06, {}); pen.use(glow(i === 0 && j === 0 ? K.NEON.cyan : [1, 0.6, 0.3], i === 0 && j === 0 ? 5 : 1.6)); const x2 = wallX - sx * 1.235; if (sx < 0) pen.wall(x2, z + 0.9, x2, z - 0.9, y + 1.06, y + 1.12, {}); else pen.wall(x2, z - 0.9, x2, z + 0.9, y + 1.06, y + 1.12, {}); }
    ctx.solid(wallX - sx * 0.62, room.zb + dep / 2, 1.2, dep - 1.2, 0, 2.5);
    ctx.propL('kiosk', cx - sx * (w / 2 - 0.9), 0.03, room.zb + 0.8, 0, 0.9);
  }
  if (o.sign) { const sz = Math.min(1.1, h * 0.3); pen.sign(cx, h - 0.8, room.zb + 0.06, 0, sz * o.sign.aspect > w - 1 ? w - 1 : sz * o.sign.aspect, sz, o.sign, { intensity: 2.5, seed: rng.i(0, 255) }); }
  ctx.main();
  return { room, door, kind };
}
