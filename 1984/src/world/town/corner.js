// Buildings on polygonal footprints: the corner buildings where two streets
// meet (L-shaped, often with the corner cut off for a pub door), and any
// other odd-shaped plot. Street-facing edges get full facades; the rest are
// plain brick backs. Flat lead roof behind a parapet, stacks on the backs.
import { Frame, TINTS } from './kit.js';
import { holesWall, windowIn, dressing, doorIn, shopfront, stack } from './house.js';

const PI = Math.PI;

// A facade along a frame from x = 0 to len: windows in bays floor by floor,
// a ground floor of shopfront, pub front or doors, bands and cornice.
export function facadeStrip(K, F, len, st, fy, o, r) {
  const top = fy[fy.length - 1];
  const wallTop = top + (st.parapetH ?? 0.85);
  const wall = st.wall, wt = st.wallTint, gfm = st.gfMat || wall, gft = st.gfTint || wt;
  const bayPitch = o.bayPitch || 2.6;
  const bays = Math.max(1, Math.round(len / bayPitch));
  const holes = [], wins = [];
  const shop = o.gf === 'shop' || o.gf === 'pub';
  for (let i = 0; i < fy.length - 1; i++) {
    if (i === 0 && shop) continue;
    const W = st.win[i] || st.win[st.win.length - 1];
    if (!W) continue;
    for (let j = 0; j < bays; j++) {
      const cx = (len * (j + 0.5)) / bays;
      if (i === 0 && o.door && j === (o.doorBay ?? 0)) {
        holes.push({ x0: cx - 0.5, x1: cx + 0.5, y0: st.raise || 0, y1: (st.raise || 0) + 2.7, door: true });
        continue;
      }
      const y0 = fy[i] + W.sill;
      const ww = Math.min(W.w, len / bays - 0.4);
      if (ww < 0.5) continue;
      const h = { x0: cx - ww / 2, x1: cx + ww / 2, y0, y1: Math.min(y0 + W.h, fy[i + 1] - 0.25), floor: i, glazing: W.glazing, head: W.head };
      holes.push(h); wins.push(h);
    }
  }
  let shopH = null;
  if (shop) { shopH = { x0: 0.02, x1: len - 0.02, y0: -0.3, y1: st.fasciaTop || 3.6 }; holes.push(shopH); }
  const gfTop = shop ? shopH.y1 : fy[1];
  const lod = K.lod;
  holesWall(K, gfm, F, 0, len, -0.4, gfTop, lod ? [] : holes, 0, gft);
  holesWall(K, wall, F, 0, len, gfTop, wallTop, lod ? [] : holes, 0, wt);
  if (lod) {
    for (const h of holes) {
      const m = h.door ? 'wood_dark' : h === shopH ? (o.gf === 'pub' ? 'frosted' : 'glass') : 'glass';
      const y0 = Math.max(0, h.y0), y1 = h === shopH ? h.y1 - 0.62 : h.y1;
      K.quad(m, F.p(h.x0, y0, 0.012), F.p(h.x1, y0, 0.012), F.p(h.x1, y1, 0.012), F.p(h.x0, y1, 0.012), null, h.door ? st.doorPaint : null);
      if (h === shopH && o.sign) { const [u, v, du, dv] = o.sign; K.quad('signs', F.p(0.3, y1, 0.1), F.p(len - 0.3, y1, 0.1), F.p(len - 0.3, h.y1 - 0.08, 0.1), F.p(0.3, h.y1 - 0.08, 0.1), [u, v, u + du, v, u + du, v + dv, u, v + dv]); }
    }
  }
  for (const h of lod ? [] : wins) {
    windowIn(K, F, { ...h, state: st.state(h, r), frame: st.frameTint, glass: st.glassMat || 'glass' }, h.floor === 0 ? gfm : wall, h.floor === 0 ? gft : wt, r);
    dressing(K, F, h, st);
  }
  for (const h of lod ? [] : holes.filter((q) => q.door)) doorIn(K, F, { ...h, fan: 'rect', paint: st.doorPaint, case: st.doorCase }, st, r);
  if (shopH && !lod) {
    shopfront(K, F, shopH.x0, shopH.x1, { h: shopH.y1, sign: o.sign, paint: st.shopPaint, state: o.shopState, doorAt: o.doorAt || 'mid', tiled: o.gf === 'pub', glass: o.gf === 'pub' ? 'frosted' : null, blind: o.blind }, r);
  }
  if (st.bands && !lod) for (let i = 1; i < fy.length - 1; i++) K.sweep(st.trimMat || 'stone_dirty', F.sub(0, fy[i] - 0.06, 0), 0, len, [[0, 0], [0.05, 0], [0.05, 0.12], [0, 0.12]], false, st.trimTint);
  if (st.cornice) K.sweep(st.trimMat || 'plaster', F.sub(0, top - 0.25, 0), 0, len, [[0, 0], [0.06, 0], [0.1, 0.08], [0.24, 0.16], [0.3, 0.24], [0.3, 0.3], [0, 0.3]], false, st.trimTint);
  K.box('stone_dirty', F, 0, len, wallTop, wallTop + 0.08, -0.32, 0.05, 'fbt');
  return { wallTop, holes };
}

// job: { poly: [[x, z], ...] (outside on the left of each edge), fronts: [[i, j], ...]
//        indices of street edges, style, chamfer }
export function cornerBuilding(K, job, st, r, gl = 0) {
  let poly = job.poly.map((p) => p.slice());
  let fronts = job.fronts.map((f) => f.slice());
  // cut the corner off for a door (pubs do this): V = poly[1]
  if (job.chamfer) {
    const [P1, V, P2] = poly;
    const c = job.chamfer;
    const u1 = norm(V[0] - P1[0], V[1] - P1[1]), u2 = norm(P2[0] - V[0], P2[1] - V[1]);
    const V1 = [V[0] - u1[0] * c, V[1] - u1[1] * c], V2 = [V[0] + u2[0] * c, V[1] + u2[1] * c];
    poly = [P1, V1, V2, ...poly.slice(2)];
    fronts = [[0, 1], [1, 2], [2, 3]];
  }
  const fl = st.floors, raise = st.raise || 0;
  const fy = [raise];
  for (const h of fl) fy.push(fy[fy.length - 1] + h);
  const top = fy[fy.length - 1];
  const wallTop = top + (st.parapetH ?? 0.85);
  const isFront = (i) => fronts.some(([a]) => a === i);
  const out = { colliders: [], doors: [], gables: [], top: wallTop };
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 0.05) continue;
    const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L;
    // outward normal is on the left of the walk (see plots.js)
    const rot = Math.atan2(-uz, ux);
    const F = new Frame(a[0], gl, a[1], rot);
    if (isFront(i)) {
      const chamferEdge = job.chamfer && i === 1;
      const gf = chamferEdge ? 'door' : job.gf || st.gf;
      facadeStrip(K, F, L, st, fy, {
        gf: gf === 'door' ? null : gf, door: chamferEdge || (!gf && L > 4), doorBay: 0, bayPitch: chamferEdge ? L : st.bayPitch || 2.6,
        sign: job.signs ? job.signs[i] : null, shopState: job.shopState, doorAt: 'mid', blind: job.blind,
      }, r);
      if (chamferEdge || !gf) { const p = F.p(L / 2, 0, 0.6); out.doors.push({ x: p[0], z: p[2], rot }); }
      if (gf === 'shop' || gf === 'pub') { const p = F.p(L / 2, 0, 0.6); out.doors.push({ x: p[0], z: p[2], rot, shop: true }); }
    } else {
      // back or party wall: brick, a few small windows high up
      K.quad('brick', F.p(0, -0.4, 0), F.p(L, -0.4, 0), F.p(L, wallTop, 0), F.p(0, wallTop, 0), null, TINTS.stock[3]);
      if (L > 3 && r() < 0.7) for (let k = 1; k < fl.length; k++) {
        const cx = L * (0.3 + r() * 0.4);
        K.quad(r() < 0.2 ? 'board' : 'glass', F.p(cx - 0.4, fy[k] + 0.9, 0.02), F.p(cx + 0.4, fy[k] + 0.9, 0.02), F.p(cx + 0.4, fy[k] + 2.0, 0.02), F.p(cx - 0.4, fy[k] + 2.0, 0.02));
      }
    }
    // parapet back face
    K.quad(st.wall, F.p(L, top, -0.28), F.p(0, top, -0.28), F.p(0, wallTop, -0.28), F.p(L, wallTop, -0.28), null, st.wallTint);
  }
  // flat lead roof just under the parapet
  K.poly('metal_dark', poly, gl + top + 0.02, true);
  // stacks on the back walls
  const backs = poly.map((p, i) => i).filter((i) => !isFront(i));
  for (const i of backs.slice(0, 2)) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 2.5) continue;
    const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L;
    const F = new Frame(a[0], gl, a[1], Math.atan2(-uz, ux));
    stack(K, F.sub(L / 2, 0, -0.5, PI / 2), 0, -1.0, 0.6, top - 0.5, wallTop + 1.4, 4, st.stackTint || TINTS.stock[3], r);
  }
  // colliders: one OBB per front strip, as deep as the building
  for (const [i] of fronts) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L;
    const rot = Math.atan2(-uz, ux);
    const d = job.d || 8;
    const cx = (a[0] + b[0]) / 2 + uz * (d / 2) * 1, cz = (a[1] + b[1]) / 2 - ux * (d / 2) * 1;
    // inward is on the right of the walk: (uz, -ux)
    out.colliders.push([cx, cz, L / 2, d / 2, rot]);
  }
  return out;
}

function norm(x, z) { const l = Math.hypot(x, z) || 1; return [x / l, z / l]; }
