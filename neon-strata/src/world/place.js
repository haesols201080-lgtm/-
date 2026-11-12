// Placement helpers shared by district generators.
import { districtAt, R_CITY, R_CORE, DISTRICTS } from './layout.js';
import { fbm2 } from '../core/rng.js';
import { ST } from '../render/cityMaterial.js';
import { M } from './builder.js';
import * as K from './kit.js';

const boundsCache = {};
export function districtBounds(id) {
  if (boundsCache[id]) return boundsCache[id];
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  for (let x = -R_CITY; x <= R_CITY; x += 60) for (let z = -R_CITY; z <= R_CITY; z += 60) {
    if (districtAt(x, z).id === id) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (z < minZ) minZ = z; if (z > maxZ) maxZ = z; }
  }
  return (boundsCache[id] = { minX: minX - 60, maxX: maxX + 60, minZ: minZ - 60, maxZ: maxZ + 60 });
}
// jittered (optionally rotated) grid scatter restricted to a district
export function scatter(ctx, rng, id, spacing, jitter, rot, fn) {
  const b = districtBounds(id);
  const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
  const R = Math.hypot(b.maxX - b.minX, b.maxZ - b.minZ) / 2 + spacing;
  const c = Math.cos(rot), s = Math.sin(rot); const n = Math.ceil(R / spacing);
  for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) {
    const lx = (i + rng.f(-jitter, jitter)) * spacing, lz = (j + rng.f(-jitter, jitter)) * spacing;
    const x = cx + lx * c + lz * s, z = cz - lx * s + lz * c;
    if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) continue;
    if (districtAt(x, z).id !== id) continue;
    fn(x, z, i, j);
  }
}
export function tryPlace(ctx, x, z, hx, hz, yaw, pad = 1.5, mark = true) {
  if (!ctx.occ.freeRect(x, z, hx, hz, yaw, pad)) return false;
  if (mark) ctx.occ.markRect(x, z, hx, hz, yaw, 2);
  return true;
}
// polar point inside a district: t along radius (0..1 between core and city edge), a = angular offset (-1..1 of half sector)
export function polar(id, t, a) {
  const d = DISTRICTS.find((q) => q.id === id); const r = R_CORE + 80 + t * (R_CITY - R_CORE - 160);
  const ang = (d.ang + a * 19) * Math.PI / 180;
  return [Math.cos(ang) * r, Math.sin(ang) * r];
}
export const field = (x, z, f, seed) => fbm2(x * f, z * f, 3, seed);

// Rotated street grid restricted to a district. Draws lot slabs, streets, lamps; calls fn(block) to populate.
// block: {x,z,yaw,w,d,i,j, at(lx,lz)->[wx,wz]}
export function gridBlocks(ctx, rng, id, rot, bw, bd, sw, o, fn) {
  const b = districtBounds(id); const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
  const R = Math.hypot(b.maxX - b.minX, b.maxZ - b.minZ) / 2 + bw;
  const c = Math.cos(rot), s = Math.sin(rot); const px = bw + sw, pz = bd + sw;
  const lotM = o.lot || M(ST.PAVE, { color: [0.4, 0.4, 0.42] }); const roadM = M(ST.ROAD, { cellW: sw }), plainM = M(ST.ROAD, { cellW: 0 });
  const curb = K.conc(0.46);
  for (let i = -Math.ceil(R / px); i <= Math.ceil(R / px); i++) for (let j = -Math.ceil(R / pz); j <= Math.ceil(R / pz); j++) {
    const lx = i * px + (o.stagger && (j & 1) ? px / 2 : 0), lz = j * pz;
    const x = cx + lx * c + lz * s, z = cz - lx * s + lz * c;
    if (districtAt(x, z).id !== id) continue;
    if (!ctx.occ.freeRect(x, z, bw / 2, bd / 2, rot, 3)) continue;
    ctx.occ.markRect(x, z, bw / 2 + sw / 2, bd / 2 + sw / 2, rot, 1);
    const pen = ctx.penAt(x, 0, z, rot);
    // streets on the +x and +z sides (+ corner)
    const x0 = bw / 2, x1 = bw / 2 + sw, z0 = bd / 2, z1 = bd / 2 + sw, Y = 0.04;
    pen.use(roadM); pen.quad(x0, Y, bd / 2, x1, Y, bd / 2, x1, Y, -bd / 2, x0, Y, -bd / 2, 0, 0, sw, bd);
    pen.quad(bw / 2, Y, z1, bw / 2, Y, z0, -bw / 2, Y, z0, -bw / 2, Y, z1, 0, 0, sw, bw);
    pen.use(plainM); pen.flat(x0, z0, x1, z1, Y);
    // lot slab
    pen.box(0, 0, bw, bd, 0, 0.22, { wall: curb, roof: lotM });
    ctx.solid(0, 0, bw, bd, 0, 0.22);
    const at = (ax, az) => [x + ax * c + az * s, z - ax * s + az * c];
    if (o.lamps !== false) {
      const lc = o.lampColor || K.NEON.ice;
      const [l1x, l1z] = at(bw / 2 - 1, rng.f(-0.3, 0.3) * bd), [l2x, l2z] = at(rng.f(-0.3, 0.3) * bw, bd / 2 - 1);
      K.lampPost(ctx, l1x, l1z, rot + Math.PI / 2, { y: 0.22, color: lc, h: o.lampH ?? 9, radius: 22, power: 0.7 });
      K.lampPost(ctx, l2x, l2z, rot, { y: 0.22, color: lc, h: o.lampH ?? 9, radius: 22, power: 0.7 });
    }
    const m = 2.2; const ring = [at(-bw / 2 + m, -bd / 2 + m), at(bw / 2 - m, -bd / 2 + m), at(bw / 2 - m, bd / 2 - m), at(-bw / 2 + m, bd / 2 - m)];
    ctx.walkways.push({ pts: ring.map((p) => [p[0], 0.22, p[1]]), closed: true });
    fn({ x, z, yaw: rot, w: bw, d: bd, i, j, at });
  }
}
