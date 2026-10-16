// Cutting the blocks into plots. Each block's building line is walked edge by
// edge; edges that face a street are frontages. Corners where two frontages
// meet get an L-shaped corner building (often a pub or a shop); the straight
// and gently curving runs between are filled with runs of houses of one
// builder's design, broken by alleys into the backs and by bomb sites. Every
// footprint is tested against the ones already placed so plots never cross,
// and depth is cut back where the block is shallow.
import { Frame } from './kit.js';
import { pointInPoly, segDist, area } from './streets.js';

const PI = Math.PI;

// ---------------------------------------------------------------- oriented boxes

// OBB from a frame rectangle x0..x1 (along), z0..z1 (out; house at z < 0)
export function obb(F, x0, x1, z0, z1) {
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const p = F.p(cx, 0, cz);
  return { x: p[0], z: p[2], hx: (x1 - x0) / 2, hz: (z1 - z0) / 2, c: F.c, s: F.s };
}

function obbAxes(b) { return [[b.c, -b.s], [b.s, b.c]]; }
function obbProj(b, ax) {
  const [u, v] = obbAxes(b);
  const r = b.hx * Math.abs(u[0] * ax[0] + u[1] * ax[1]) + b.hz * Math.abs(v[0] * ax[0] + v[1] * ax[1]);
  const c = b.x * ax[0] + b.z * ax[1];
  return [c - r, c + r];
}
export function obbOverlap(a, b, pad = 0.05) {
  if (Math.hypot(a.x - b.x, a.z - b.z) > Math.hypot(a.hx, a.hz) + Math.hypot(b.hx, b.hz)) return false;
  for (const ax of [...obbAxes(a), ...obbAxes(b)]) {
    const [a0, a1] = obbProj(a, ax), [b0, b1] = obbProj(b, ax);
    if (a1 - pad <= b0 || b1 - pad <= a0) return false;
  }
  return true;
}
const polyObb = (poly) => {
  // loose OBB of a polygon: its axis-aligned box (used for reserved areas)
  let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
  for (const [x, z] of poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  return { x: (x0 + x1) / 2, z: (z0 + z1) / 2, hx: (x1 - x0) / 2, hz: (z1 - z0) / 2, c: 1, s: 0, poly };
};

// ---------------------------------------------------------------- helpers

// distance from p along direction d to the polygon boundary
function rayToPoly(px, pz, dx, dz, poly) {
  let best = 1e9;
  for (let i = 0; i < poly.length; i++) {
    const [ax, az] = poly[i], [bx, bz] = poly[(i + 1) % poly.length];
    const ex = bx - ax, ez = bz - az;
    const den = dx * ez - dz * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((ax - px) * ez - (az - pz) * ex) / den;
    const u = ((ax - px) * dz - (az - pz) * dx) / den;
    if (t > 0.05 && u >= 0 && u <= 1) best = Math.min(best, t);
  }
  return best;
}

// ---------------------------------------------------------------- the blocks

// opts: { plan, r, chooser(street, edge) -> run spec, reserved: [{ poly }],
//         onCorner(corner) -> optional custom corner, gapRate }
// returns { jobs: [...], gaps: [...], alleys: [...] }
export function cutBlocks(plan, opts) {
  const { r } = opts;
  const jobs = [], gaps = [], alleys = [], fronts = [];
  const reserved = (opts.reserved || []).map((q) => polyObb(q.poly));
  const placedAll = [];
  for (const [bi, block] of plan.blocks.entries()) {
    // walk the ring so the outside is on the left: then a frame's +x (along
    // the facade, left to right seen from the street) runs with the edge
    const ring = sharpen(area(block.outer) > 0 ? block.outer.slice().reverse() : block.outer.slice());
    const n = ring.length;
    const placed = [];
    const blocked = (b) => reserved.some((q) => obbOverlap(b, q) && polyHit(b, q.poly)) || placed.some((q) => obbOverlap(b, q));
    // edges: direction, outward normal, frontage?
    const E = [];
    for (let i = 0; i < n; i++) {
      const a = ring[i], b = ring[(i + 1) % n];
      const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
      if (L < 1e-3) { E.push(null); continue; }
      const ux = dx / L, uz = dz / L;
      // the ring runs clockwise (negative area): outside is on the left
      const nx = -uz, nz = ux;
      const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
      const front = plan.isOpen(mx + nx * 1.2, mz + nz * 1.2);
      const near = plan.nearest(mx + nx * 3, mz + nz * 3);
      E.push({ i, a, b, L, ux, uz, nx, nz, front, street: near.street });
    }
    // corners: convex vertices between two frontages turning by more than 30 degrees
    const corner = new Array(n).fill(null);
    for (let i = 0; i < n; i++) {
      const e1 = E[(i - 1 + n) % n], e2 = E[i];
      if (!e1 || !e2 || !e1.front || !e2.front) continue;
      const turn = Math.atan2(e1.ux * e2.uz - e1.uz * e2.ux, e1.ux * e2.ux + e1.uz * e2.uz);
      // convex if the turn goes towards the inside (sign relative to the outward normal)
      const inward = -(e1.nx * e2.ux + e1.nz * e2.uz) > 0;   // e2 heads away from e1's street: convex
      const ang = Math.abs(turn);
      if (ang > PI / 6 && inward) corner[i] = { ang };
    }
    // corner buildings first
    const startCut = new Array(n).fill(0), endCut = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      if (!corner[i]) continue;
      const e1 = E[(i - 1 + n) % n], e2 = E[i];
      const V = ring[i];
      const interior = PI - corner[i].ang;
      if (interior < PI * 0.3 || interior > PI * 0.85) continue;   // too sharp or too flat for an L
      const spec = opts.corner(e1.street, e2.street, r, V);
      if (!spec) continue;
      const d = spec.d;
      const a = Math.min(spec.a, e1.L * 0.48), b = Math.min(spec.b, e2.L * 0.48);
      if (a < d * 0.8 || b < d * 0.8) continue;
      // L-shaped footprint: P1 - V - P2 - Q2 - Q - Q1 (Q the inner corner)
      const in1 = [-e1.nx, -e1.nz], in2 = [-e2.nx, -e2.nz];
      const P1 = [V[0] - e1.ux * a, V[1] - e1.uz * a], P2 = [V[0] + e2.ux * b, V[1] + e2.uz * b];
      const Q1 = [P1[0] + in1[0] * d, P1[1] + in1[1] * d], Q2 = [P2[0] + in2[0] * d, P2[1] + in2[1] * d];
      // inner corner: lines Q1 + t e1 and Q2 - s e2
      const den = e1.ux * (-e2.uz) - e1.uz * (-e2.ux);
      if (Math.abs(den) < 1e-6) continue;
      const t = ((Q2[0] - Q1[0]) * (-e2.uz) - (Q2[1] - Q1[1]) * (-e2.ux)) / den;
      const Q = [Q1[0] + e1.ux * t, Q1[1] + e1.uz * t];
      const poly = [P1, V, P2, Q2, Q, Q1];
      const ob = polyObb(poly);
      if (reserved.some((q) => obbOverlap(ob, q) && polyHit(ob, q.poly))) continue;
      const b1 = obb(edgeFrame(e1, P1), 0, a, -d, 0), b2 = obb(edgeFrame(e2, V), 0, b, -d, 0);
      placed.push(b1, b2);
      jobs.push({ kind: 'corner', poly, fronts: [[0, 1], [1, 2]], style: spec.style, chamfer: spec.chamfer, block: bi, street: [e1.street, e2.street], d });
      endCut[(i - 1 + n) % n] = a;
      startCut[i] = b;
    }
    // runs along frontages
    for (let i = 0; i < n; i++) {
      const e = E[i];
      if (!e || !e.front) continue;
      const s0 = startCut[i], s1 = e.L - endCut[i];
      if (s1 - s0 < 3.2) { if (s1 - s0 > 0.5) gaps.push(gapRect(e, s0, s1, 4)); continue; }
      const F0 = edgeFrame(e, e.a);   // x from 0 at e.a to L at e.b, z out
      // depth limit: half the block across, measured at the middle of the edge
      const mid = e.L / 2;
      const across = rayToPoly(e.a[0] + e.ux * mid - e.nx * 0.2, e.a[1] + e.uz * mid - e.nz * 0.2, -e.nx, -e.nz, ring);
      let pos = s0;
      let prev = null;
      while (s1 - pos > 3.2) {
        const run = opts.chooser(e.street, e, r, s1 - pos);
        if (run.gap) {
          const gw = Math.min(run.gap, s1 - pos);
          gaps.push({ ...gapRect(e, pos, pos + gw, Math.min(14, across * 0.5)), kind: run.gapKind || 'bombsite' });
          pos += gw; prev = null;
          continue;
        }
        if (run.alley) {
          const aw = Math.min(run.alley, s1 - pos);
          alleys.push(gapRect(e, pos, pos + aw, Math.min(12, across * 0.5)));
          pos += aw; prev = null;
          continue;
        }
        const st = run.style;
        let count = run.count;
        let w = run.w;
        // a run that does not fit: squeeze one narrower house in, or stop
        if (pos + w > s1 + 0.01) {
          if (s1 - pos >= st.w[0] * 0.8) { w = s1 - pos; count = 1; } else break;
        }
        for (let k = 0; k < count; k++) {
          if (pos + w > s1 + 0.01) break;
          let d = Math.min(run.d, Math.max(4.5, across * 0.5 - 0.4));
          let F = F0.sub(pos, 0, 0);
          let box = obb(F, 0, w, -d, 0);
          while (blocked(box) && d > 4.5) { d -= 1.5; box = obb(F, 0, w, -d, 0); }
          if (blocked(box)) { prev = null; pos += w; continue; }
          placed.push(box);
          const job = { kind: 'house', F, w, d, style: st, block: bi, street: e.street, edge: i, pos, left: 'open', right: 'open' };
          if (prev && Math.abs(prev.pos + prev.w - pos) < 0.02) { prev.right = 'party'; job.left = 'party'; prev.stackR = false; }
          job.stackR = true;
          jobs.push(job);
          prev = job;
          pos += w;
        }
      }
      // the leftover at the end of a frontage is a narrow gap: a yard wall
      if (s1 - pos > 0.4) gaps.push({ ...gapRect(e, pos, s1, 4), kind: 'wall' });
      fronts.push({ e, s0, s1, F0 });
    }
    placedAll.push(...placed);
  }
  // party walls across a vertex of a curving frontage (neighbouring edges)
  linkAcrossVertices(jobs);
  return { jobs, gaps, alleys, fronts, placed: placedAll };
}

// Rounded corners (arcs of short edges) become one sharp vertex: each run of
// short edges is replaced by the meeting point of the long edges either side.
function sharpen(ring, minLen = 1.6) {
  let p = ring.slice();
  for (let guard = 0; guard < 400; guard++) {
    const n = p.length;
    if (n <= 4) break;
    let done = true;
    for (let i = 0; i < n; i++) {
      const a = p[i], b = p[(i + 1) % n];
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) >= minLen) continue;
      // lines through the previous and the next edge
      const pa = p[(i - 1 + n) % n], nb = p[(i + 2) % n];
      const d1 = [a[0] - pa[0], a[1] - pa[1]], d2 = [nb[0] - b[0], nb[1] - b[1]];
      const den = d1[0] * d2[1] - d1[1] * d2[0];
      let q;
      if (Math.abs(den) < 1e-6) q = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      else {
        const t = ((b[0] - pa[0]) * d2[1] - (b[1] - pa[1]) * d2[0]) / den;
        q = [pa[0] + d1[0] * t, pa[1] + d1[1] * t];
        if (Math.hypot(q[0] - a[0], q[1] - a[1]) > 4) q = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      }
      p.splice(i, 2, q);
      if (i === n - 1) p.splice(0, 1);   // wrapped: the pair was (last, first)
      done = false;
      break;
    }
    if (done) break;
  }
  return p;
}

function polyHit(b, poly) {
  // does any corner of the OBB, or its centre, lie in poly, or poly's centroid in the OBB
  const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0]].map(([sx, sz]) => [b.x + (sx * b.hx * b.c + sz * b.hz * b.s), b.z + (-sx * b.hx * b.s + sz * b.hz * b.c)]);
  if (pts.some(([x, z]) => pointInPoly(x, z, poly))) return true;
  let cx = 0, cz = 0; for (const [x, z] of poly) { cx += x; cz += z; } cx /= poly.length; cz /= poly.length;
  const dx = cx - b.x, dz = cz - b.z;
  const lx = dx * b.c - dz * b.s, lz = dx * b.s + dz * b.c;
  return Math.abs(lx) < b.hx && Math.abs(lz) < b.hz;
}

// frame on an edge: origin at p, +x along the edge, +z the outward normal
export function edgeFrame(e, p, y = 0) {
  const rot = Math.atan2(e.nx, e.nz);
  const F = new Frame(p[0], y, p[1], rot);
  // the frame's +x must run along the edge; if the normal convention flips it, mirror by starting at the other end
  const xw = [Math.cos(rot), -Math.sin(rot)];
  if (xw[0] * e.ux + xw[1] * e.uz < 0) throw new Error('edge frame orientation');
  return F;
}

function gapRect(e, s0, s1, depth) {
  const F = edgeFrame(e, e.a);
  return { F: F.sub(s0, 0, 0), w: s1 - s0, d: depth, street: e.street };
}

function linkAcrossVertices(jobs) {
  const houses = jobs.filter((j) => j.kind === 'house');
  const key = (x, z) => `${Math.round(x * 4)},${Math.round(z * 4)}`;
  const lefts = new Map();
  for (const h of houses) { const p = h.F.p(0, 0, 0); lefts.set(key(p[0], p[2]), h); }
  for (const h of houses) {
    if (h.right === 'party') continue;
    const p = h.F.p(h.w, 0, 0);
    const n = lefts.get(key(p[0], p[2]));
    if (n && n !== h && n.left === 'open' && Math.abs(Math.atan2(Math.sin(n.F.rot - h.F.rot), Math.cos(n.F.rot - h.F.rot))) < 0.5) {
      h.right = 'party'; n.left = 'party'; h.stackR = false;
    }
  }
}

export { segDist };
