// Street plan geometry. Streets are centre polylines with a carriageway width
// and pavement widths; squares and yards are polygons. Polygon booleans and
// offsets (Clipper) turn them into: the carriageway (kerb corners rounded),
// the pavements, and the city blocks left between them, whose edges are the
// building lines the houses stand on.
import ClipperLib from 'clipper-lib';

const SC = 100;   // Clipper works in integers: centimetres

const toC = (pts) => pts.map(([x, z]) => ({ X: Math.round(x * SC), Y: Math.round(z * SC) }));
const fromC = (path) => path.map((p) => [p.X / SC, p.Y / SC]);

function offsetOpen(pts, delta, closed = false) {
  const co = new ClipperLib.ClipperOffset(2, 0.08 * SC);
  co.AddPath(toC(pts), ClipperLib.JoinType.jtRound, closed ? ClipperLib.EndType.etClosedPolygon : ClipperLib.EndType.etOpenRound);
  const out = new ClipperLib.Paths();
  co.Execute(out, delta * SC);
  return out;
}

function offsetPaths(paths, delta) {
  const co = new ClipperLib.ClipperOffset(2, 0.08 * SC);
  co.AddPaths(paths, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon);
  const out = new ClipperLib.Paths();
  co.Execute(out, delta * SC);
  return out;
}

function bool(type, subj, clip) {
  const c = new ClipperLib.Clipper();
  c.AddPaths(subj, ClipperLib.PolyType.ptSubject, true);
  if (clip) c.AddPaths(clip, ClipperLib.PolyType.ptClip, true);
  const out = new ClipperLib.Paths();
  c.Execute(type, out, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  return out;
}

function boolTree(type, subj, clip) {
  const c = new ClipperLib.Clipper();
  c.AddPaths(subj, ClipperLib.PolyType.ptSubject, true);
  if (clip) c.AddPaths(clip, ClipperLib.PolyType.ptClip, true);
  const tree = new ClipperLib.PolyTree();
  c.Execute(type, tree, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  return ClipperLib.JS.PolyTreeToExPolygons(tree).map((e) => ({ outer: fromC(e.outer), holes: e.holes.map(fromC) }));
}

const U = ClipperLib.ClipType.ctUnion, D = ClipperLib.ClipType.ctDifference, I = ClipperLib.ClipType.ctIntersection;

// Smooth a polyline with Chaikin corner cutting (keeps the ends).
export function smoothLine(pts, iters = 2) {
  let p = pts;
  for (let k = 0; k < iters; k++) {
    const q = [p[0]];
    for (let i = 0; i < p.length - 1; i++) {
      const [ax, az] = p[i], [bx, bz] = p[i + 1];
      if (i > 0) q.push([ax * 0.75 + bx * 0.25, az * 0.75 + bz * 0.25]);
      if (i < p.length - 2) q.push([ax * 0.25 + bx * 0.75, az * 0.25 + bz * 0.75]);
    }
    q.push(p[p.length - 1]);
    p = q;
  }
  return p;
}

// Remove points closer than tol to the line through their neighbours.
export function simplify(pts, tol = 0.25, closed = true) {
  let p = pts.slice();
  let changed = true;
  while (changed && p.length > 3) {
    changed = false;
    for (let i = 0; i < p.length; i++) {
      if (!closed && (i === 0 || i === p.length - 1)) continue;
      const a = p[(i - 1 + p.length) % p.length], b = p[i], c = p[(i + 1) % p.length];
      const dx = c[0] - a[0], dz = c[1] - a[1];
      const L = Math.hypot(dx, dz) || 1;
      const d = Math.abs((b[0] - a[0]) * dz - (b[1] - a[1]) * dx) / L;
      const near = Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.4;
      if (d < tol || near) { p.splice(i, 1); changed = true; break; }
    }
  }
  return p;
}

export const area = (pts) => {
  let s = 0;
  for (let i = 0; i < pts.length; i++) { const [ax, az] = pts[i], [bx, bz] = pts[(i + 1) % pts.length]; s += ax * bz - bx * az; }
  return s / 2;
};

export function pointInPoly(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], zi = poly[i][1], xj = poly[j][0], zj = poly[j][1];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

export const inEx = (x, z, ex) => pointInPoly(x, z, ex.outer) && !ex.holes.some((h) => pointInPoly(x, z, h));

// distance from point to segment
export function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const L2 = dx * dx + dz * dz || 1;
  let t = ((px - ax) * dx + (pz - az) * dz) / L2;
  t = Math.max(0, Math.min(1, t));
  return [Math.hypot(px - (ax + dx * t), pz - (az + dz * t)), t];
}

// plan: { bounds: [x0, z0, x1, z1], streets: [{ id, pts, w, pave: [l, r] | n, surface, kind, district, smooth }],
//         squares: [{ id, poly, surface, kerb }], open: [{ poly }] (unbuilt ground: parks, bomb sites, yards kept open) }
export function buildPlan(plan) {
  const [bx0, bz0, bx1, bz1] = plan.bounds;
  const bounds = [toC([[bx0, bz0], [bx1, bz0], [bx1, bz1], [bx0, bz1]])];
  const streets = plan.streets.map((s) => ({ ...s, line: s.smooth === false ? s.pts : smoothLine(s.pts, s.smooth ?? 2) }));
  // carriageways: ribbons, unioned, kerb corners rounded by a closing
  // ribbons grouped by width so each group is one offset call, then unioned
  const byW = new Map(), byO = new Map();
  for (const s of streets) {
    const pv = Array.isArray(s.pave) ? s.pave : [s.pave ?? 2.4, s.pave ?? 2.4];
    const rw = s.w / 2, ow = s.w / 2 + Math.max(pv[0], pv[1]);
    if (!byW.has(rw)) byW.set(rw, []);
    if (!byO.has(ow)) byO.set(ow, []);
    byW.get(rw).push(s.line); byO.get(ow).push(s.line);
  }
  const ribbons = (groups) => {
    const all = [];
    for (const [d, lines] of groups) {
      const co = new ClipperLib.ClipperOffset(2, 0.08 * SC);
      for (const l of lines) co.AddPath(toC(l), ClipperLib.JoinType.jtRound, ClipperLib.EndType.etOpenRound);
      const o = new ClipperLib.Paths();
      co.Execute(o, d * SC);
      all.push(...o);
    }
    return bool(U, all, null);
  };
  let road = ribbons(byW);
  let open = ribbons(byO);
  for (const q of plan.squares || []) {
    if (q.road) road = bool(U, road, [toC(q.poly)]);
    open = bool(U, open, [toC(q.poly)]);
  }
  const gardens = (plan.gardens || []).map((g) => toC(g.poly));
  const R = plan.kerbRadius ?? 2.2;
  road = offsetPaths(offsetPaths(road, R), -R);
  road = bool(I, road, bounds);
  open = offsetPaths(offsetPaths(open, 0.6), -0.6);
  open = bool(U, open, road);
  open = bool(I, open, bounds);
  const pave = boolTree(D, open, road);
  const roadEx = boolTree(U, road, null);
  // blocks: what is left; tiny slivers dropped
  const gardenEx = gardens.length ? boolTree(D, bool(U, gardens, null), open) : [];
  const blocks = boolTree(D, bounds, gardens.length ? bool(U, open, gardens) : open)
    .map((b) => ({ outer: simplify(b.outer, 0.18), holes: b.holes.map((h) => simplify(h, 0.18)) }))
    .filter((b) => Math.abs(area(b.outer)) > 30);
  for (const b of blocks) if (area(b.outer) < 0) b.outer.reverse();
  // the nearest street to a point (for districts and frontage styles), via a
  // grid of segments
  const GC = 40, grid = new Map();
  const gk = (i, j) => i * 100003 + j;
  for (const s of streets) {
    for (let i = 0; i < s.line.length - 1; i++) {
      const [ax, az] = s.line[i], [bx, bz] = s.line[i + 1];
      const seg = [ax, az, bx, bz, s];
      for (let gi = Math.floor(Math.min(ax, bx) / GC); gi <= Math.floor(Math.max(ax, bx) / GC); gi++) {
        for (let gj = Math.floor(Math.min(az, bz) / GC); gj <= Math.floor(Math.max(az, bz) / GC); gj++) {
          const k = gk(gi, gj);
          if (!grid.has(k)) grid.set(k, []);
          grid.get(k).push(seg);
        }
      }
    }
  }
  const nearest = (x, z) => {
    for (const q of plan.squares || []) if (pointInPoly(x, z, q.poly)) return { street: q, d: 0, square: true };
    let best = null, bd = 1e9;
    const gi = Math.floor(x / GC), gj = Math.floor(z / GC);
    for (let ring = 0; ring <= 3 && !best; ring++) {
      for (let i = gi - ring; i <= gi + ring; i++) {
        for (let j = gj - ring; j <= gj + ring; j++) {
          const l = grid.get(gk(i, j));
          if (!l) continue;
          for (const [ax, az, bx, bz, st] of l) {
            const [d] = segDist(x, z, ax, az, bx, bz);
            if (d < bd) { bd = d; best = st; }
          }
        }
      }
    }
    return { street: best, d: bd };
  };
  const isOpen = (x, z) => {
    const ex = pave.concat(roadEx);
    return ex.some((e) => inEx(x, z, e));
  };
  return { streets, road: roadEx, pave, blocks, gardens: gardenEx, nearest, isOpen, bounds: plan.bounds };
}
