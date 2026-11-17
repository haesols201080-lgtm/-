// City plan: arterials → secondary street grid (curvilinear, follows the rings + boulevards) → blocks → lots.
// Every building sits on its own lot, so structures can never overlap; blocks tile the whole city.
import { ST } from '../render/cityMaterial.js';
import { M } from './builder.js';
import { DISTRICTS, RINGS, BOULEVARD_W, R_CITY, COAST_X, boundaryAngle, ringRadius } from './layout.js';
import { ribbon } from './roads.js';
import { TAU, fbm2 } from '../core/rng.js';
import * as K from './kit.js';

const D2R = Math.PI / 180;
// per district: block width (along the street arc), depth (radial), street width, sidewalk depth
export const DPLAN = {
  meridian: { bw: 170, bd: 140, sw: 26, walk: 6.5, jit: 0.05, merge: 0.12, plaza: 0.07 },
  lumina: { bw: 140, bd: 110, sw: 20, walk: 5.5, jit: 0.1, merge: 0.06, plaza: 0.04 },
  hive: { bw: 220, bd: 170, sw: 22, walk: 5, jit: 0.06, merge: 0.1, plaza: 0.06 },
  verdant: { bw: 200, bd: 170, sw: 20, walk: 5, jit: 0.1, merge: 0.1, plaza: 0.08 },
  sump: { bw: 150, bd: 104, sw: 11, walk: 2.8, jit: 0.2, merge: 0.05, plaza: 0.03 },
  foundry: { bw: 300, bd: 220, sw: 24, walk: 4, jit: 0.08, merge: 0.15, plaza: 0 },
  port: { bw: 240, bd: 180, sw: 24, walk: 4, jit: 0.05, merge: 0.1, plaza: 0 },
  oldq: { bw: 136, bd: 104, sw: 10, walk: 3, jit: 0.22, merge: 0.04, plaza: 0.05 },
};
const MARGIN = 6.6; // arterial sidewalk

function bandEdges(j, th) {
  const inner = ringRadius(j, th) + RINGS[j].w / 2 + MARGIN;
  const outer = j === 2 ? R_CITY : ringRadius(j + 1, th) - RINGS[j + 1].w / 2 - MARGIN;
  return [inner, outer];
}
function sectorEdges(k, r) {
  let lo = boundaryAngle((k + 7) % 8, r), hi = boundaryAngle(k, r);
  if (lo > hi) lo -= TAU;
  const m = (BOULEVARD_W / 2 + MARGIN) / r;
  return [lo + m, hi - m];
}
export function planPoint(k, j, u, v) {
  let th = DISTRICTS[k].ang * D2R, r = 0;
  for (let it = 0; it < 3; it++) { const [ri, ro] = bandEdges(j, th); r = ri + (ro - ri) * v; const [lo, hi] = sectorEdges(k, r); th = lo + (hi - lo) * u; }
  return [Math.cos(th) * r, Math.sin(th) * r];
}

export function buildPlan(ctx) {
  const rng = ctx.rng.fork('plan'); const blocks = []; const streets = [];
  const scale = 1 / Math.sqrt(ctx.density);
  for (let k = 0; k < 8; k++) {
    const dist = DISTRICTS[k]; const dp = DPLAN[dist.id];
    for (let j = 0; j < 3; j++) {
      const thc = dist.ang * D2R; const [ri, ro] = bandEdges(j, thc); const depth = ro - ri;
      const nRows = Math.max(1, Math.round(depth / ((dp.bd + dp.sw) * scale)));
      const vb = [0]; for (let i = 1; i < nRows; i++) vb.push(i / nRows + rng.f(-dp.jit, dp.jit) / nRows * 0.6); vb.push(1);
      const dv = dp.sw / 2 / depth;
      for (let row = 0; row < nRows; row++) {
        const v0 = vb[row] + (row > 0 ? dv : 0), v1 = vb[row + 1] - (row < nRows - 1 ? dv : 0);
        const rMid = ri + depth * (v0 + v1) / 2; const [lo, hi] = sectorEdges(k, rMid); const L = (hi - lo) * rMid;
        let nCols = Math.max(1, Math.round(L / ((dp.bw + dp.sw) * scale)));
        const ub = [0]; for (let i = 1; i < nCols; i++) ub.push(i / nCols + rng.f(-dp.jit, dp.jit) / nCols); ub.push(1);
        // merge some neighbours into super blocks
        for (let i = 1; i < ub.length - 1; i++) if (rng.chance(dp.merge)) { ub.splice(i, 1); }
        nCols = ub.length - 1; const du = dp.sw / 2 / L;
        for (let col = 0; col < nCols; col++) {
          const u0 = ub[col] + (col > 0 ? du : 0), u1 = ub[col + 1] - (col < nCols - 1 ? du : 0);
          const c = [planPoint(k, j, u0, v0), planPoint(k, j, u1, v0), planPoint(k, j, u1, v1), planPoint(k, j, u0, v1)];
          if (c.some((p) => p[0] < COAST_X + 70)) continue;
          const cx = (c[0][0] + c[1][0] + c[2][0] + c[3][0]) / 4, cz = (c[0][1] + c[1][1] + c[2][1] + c[3][1]) / 4;
          let X = [c[1][0] + c[2][0] - c[0][0] - c[3][0], c[1][1] + c[2][1] - c[0][1] - c[3][1]]; const xl = Math.hypot(X[0], X[1]); X = [X[0] / xl, X[1] / xl];
          const rl = Math.hypot(cx, cz); if ((-X[1]) * cx / rl + X[0] * cz / rl < 0) X = [-X[0], -X[1]];
          const Z = [-X[1], X[0]];
          let hw = 1e9, hd = 1e9;
          for (const p of c) { hw = Math.min(hw, Math.abs((p[0] - cx) * X[0] + (p[1] - cz) * X[1])); hd = Math.min(hd, Math.abs((p[0] - cx) * Z[0] + (p[1] - cz) * Z[1])); }
          if (hw < 14 || hd < 12) continue;
          blocks.push({
            id: blocks.length, district: dist.id, k, j, row, col, x: cx, z: cz, yaw: Math.atan2(-X[1], X[0]), w: hw * 2, d: hd * 2, r: rl, corners: c, walk: dp.walk, sw: dp.sw,
            edge: { inner: row === 0, outer: row === nRows - 1, left: col === 0, right: col === nCols - 1 },
            noise: fbm2(cx * 0.0011, cz * 0.0011, 3, 71), noise2: fbm2(cx * 0.004, cz * 0.004, 2, 19),
            plaza: rng.chance(dp.plaza), reserved: null, lots: [],
          });
        }
        // radial streets between columns of this row
        for (let col = 1; col < nCols; col++) { const a = planPoint(k, j, ub[col], vb[row] + (row > 0 ? dv : 0)), b = planPoint(k, j, ub[col], vb[row + 1] - (row < nRows - 1 ? dv : 0)); streets.push({ pts: [a, b], w: dp.sw, district: dist.id }); }
      }
      // arc streets between rows
      for (let row = 1; row < nRows; row++) { const pts = []; const n = 14; for (let i = 0; i <= n; i++) pts.push(planPoint(k, j, i / n, vb[row])); streets.push({ pts, w: dp.sw, district: dist.id, arc: true }); }
    }
  }
  ctx.blocks = blocks; ctx.streets = streets;

  // --- draw local streets (lane markings on wider ones) + block slabs
  // ground layer stack (no two surfaces share a height): ground 0 · unmarked streets 0.035–0.041 (arcs above radials, neighbours alternate) · marked streets 0.044–0.046
  // · zebras 0.052 · boulevards 0.06 · rings 0.1 · lots 0.2 · pavements 0.22
  let si = 0;
  for (const s of streets) {
    const fr = s.pts.map((p, i) => { const a = s.pts[Math.max(0, i - 1)], b = s.pts[Math.min(s.pts.length - 1, i + 1)]; let tx = b[0] - a[0], tz = b[1] - a[1]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l; return [tx, tz, -tz, tx]; });
    const marked = s.w >= 16;
    const sy = marked ? (s.arc ? 0.0458 : 0.0442) : (s.arc ? 0.0395 : 0.035) + (si++ % 2) * 0.0015;
    ribbon(ctx, s.pts, fr, false, s.w / 2 + 0.3, sy, -s.w / 2 - 0.3, sy, M(ST.ROAD, { cellW: marked ? s.w : 0, floorH: Math.min(25.5, s.w) }), { up: true, uA: 0, uB: s.w });
    if (marked) { ctx.lanes.push({ pts: s.pts.map((p, i) => [p[0] + fr[i][2] * s.w * 0.22, 1.1, p[1] + fr[i][3] * s.w * 0.22]), closed: false, kind: 'ground', speed: 14 }); }
  }
  // kerbside parking: cars nose-to-tail along both kerbs of the wider streets, kept clear of the corners
  { const pr = ctx.rng.fork('kerbside'); let parked = 0;
    const eg = new Map(); const ek = (x, z) => Math.floor(x / 30) * 100003 + Math.floor(z / 30); for (const q of streets) for (const e of [q.pts[0], q.pts[q.pts.length - 1]]) { const k = ek(e[0], e[1]); (eg.get(k) || eg.set(k, []).get(k)).push(e); }
    const nearEnd = (x, z) => { for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const a = eg.get(ek(x + i * 30, z + j * 30)); if (a && a.some((e) => Math.hypot(e[0] - x, e[1] - z) < 15)) return true; } return false; };
    for (const st of streets) { if (st.w < 12) continue; const off = st.w / 2 - 1.2; const dens = { sump: 0.62, hive: 0.55, oldq: 0.5, lumina: 0.42, meridian: 0.3 }[st.district] ?? 0.3;
      let acc = 0; const total = st.pts.reduce((a, p, i) => i ? a + Math.hypot(p[0] - st.pts[i - 1][0], p[1] - st.pts[i - 1][1]) : 0, 0);
      for (let i = 1; i < st.pts.length; i++) { const a = st.pts[i - 1], b = st.pts[i]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); const tx = (b[0] - a[0]) / L, tz = (b[1] - a[1]) / L;
        for (const side of [1, -1]) { let run = pr.chance(0.5); for (let t = 3; t < L - 3; t += 6.0) { const g = acc + t; if (g < 16 || g > total - 16) continue; if (pr.chance(0.12)) run = !run; if (!run || !pr.chance(dens + 0.25)) continue;
          const x = a[0] + tx * t + (-tz) * side * off, z = a[1] + tz * t + tx * side * off; if (nearEnd(x, z)) continue; const yaw = Math.atan2(tx, tz) + (side < 0 ? Math.PI : 0) + pr.f(-0.03, 0.03);
          ctx.prop('hovercar', x, st.y ?? 0.045, z, yaw, 1, null); ctx.phys.addBox(x, z, 1.0, 2.3, yaw, 0, 1.5); parked++; } }
        acc += L; } }
    ctx.parked = parked; }
  const curb = K.conc(0.44);
  const lotMat = { sump: M(ST.CONCRETE, { color: [0.36, 0.36, 0.37] }), oldq: M(ST.PAVE, { color: [0.42, 0.4, 0.37] }), meridian: M(ST.TILE, { color: [0.4, 0.41, 0.44] }), lumina: M(ST.TILE, { color: [0.3, 0.3, 0.34] }), foundry: M(ST.CONCRETE, { color: [0.38, 0.36, 0.34] }), port: M(ST.CONCRETE, { color: [0.4, 0.4, 0.4] }) };
  for (const b of blocks) {
    const pen = ctx.penAt(b.x, 0, b.z, 0); const c = b.corners.map((p) => [p[0] - b.x, p[1] - b.z]);
    // corner order must be "CCW from above" for the pen: (u0,v0),(u1,v0),(u1,v1),(u0,v1) → check signed area and flip if needed
    let area = 0; for (let i = 0; i < 4; i++) { const p = c[i], q = c[(i + 1) % 4]; area += p[0] * q[1] - q[0] * p[1]; }
    const pts = area > 0 ? [c[3], c[2], c[1], c[0]] : c;
    pen.use(curb); pen.loft([{ y: 0, pts }, { y: 0.2, pts }], { roof: lotMat[b.district] || M(ST.PAVE, { color: [0.4, 0.4, 0.42] }) });
    ctx.phys.addBox(b.x, b.z, b.w / 2 + 1.5, b.d / 2 + 1.5, b.yaw, 0, 0.2);
    // pedestrian loop around the block
    const m = Math.min(b.walk * 0.5, 2.2); const cs = Math.cos(b.yaw), sn = Math.sin(b.yaw);
    const at = (lx, lz) => [b.x + lx * cs + lz * sn, 0.2, b.z - lx * sn + lz * cs];
    b.at = (lx, lz) => { const p = at(lx, lz); return [p[0], p[2]]; };
    { const C = b.corners; let gx = 0, gz = 0; for (const p of C) { gx += p[0] / 4; gz += p[1] / 4; } const n = C.length; const pts = [];
      const ed = C.map((a, i) => { const q = C[(i + 1) % n]; let tx = q[0] - a[0], tz = q[1] - a[1]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l; let nx = tz, nz = -tx; if ((a[0] - gx) * nx + (a[1] - gz) * nz < 0) { nx = -nx; nz = -nz; } return { a, tx, tz, nx, nz }; });
      for (let i = 0; i < n; i++) { const e0 = ed[(i + n - 1) % n], e1 = ed[i]; // corner i = intersection of the two inset edge lines
        const p0 = [e0.a[0] - e0.nx * m, e0.a[1] - e0.nz * m], p1 = [e1.a[0] - e1.nx * m, e1.a[1] - e1.nz * m]; const den = e0.tx * e1.tz - e0.tz * e1.tx;
        if (Math.abs(den) < 1e-4) pts.push([p1[0], 0.2, p1[1]]); else { const t = ((p1[0] - p0[0]) * e1.tz - (p1[1] - p0[1]) * e1.tx) / den; pts.push([p0[0] + e0.tx * t, 0.2, p0[1] + e0.tz * t]); } }
      ctx.walkways.push({ pts, closed: true, district: b.district, block: b.id, latMax: Math.max(0.2, Math.min(m, b.walk - m) - 0.45) }); }
  }
  return blocks;
}

// mark every block touching a circle as reserved for a landmark
export function reserve(ctx, x, z, radius, id) {
  const out = [];
  for (const b of ctx.blocks) { if (Math.hypot(b.x - x, b.z - z) < radius + Math.max(b.w, b.d) * 0.5) { b.reserved = id; out.push(b); } }
  return out;
}
export function nearestBlock(ctx, x, z, district) {
  let best = null, bd = 1e9;
  for (const b of ctx.blocks) { if (district && b.district !== district) continue; if (b.reserved) continue; const d = Math.hypot(b.x - x, b.z - z); if (d < bd) { bd = d; best = b; } }
  return best;
}

// ---- lot subdivision (block-local coordinates; +z = away from the Spire) -------------------
// returns lots {cx, cz, w, d, face(+1 front faces +z / -1 faces -z), corner, x, z, yaw (world, front = local +z)}
export function subdivide(b, rng, o) {
  const W = b.w - 2 * b.walk, Dp = b.d - 2 * b.walk; const lots = [];
  const mk = (cx, cz, w, d, face, corner) => {
    const cs = Math.cos(b.yaw), sn = Math.sin(b.yaw);
    lots.push({ cx, cz, w, d, face, corner, block: b, x: b.x + cx * cs + cz * sn, z: b.z - cx * sn + cz * cs, yaw: b.yaw + (face < 0 ? Math.PI : 0) });
  };
  if (o.mode === 'mega' || W < o.wmin * 1.2) { mk(0, 0, W, Dp, rng.chance(0.5) ? 1 : -1, true); return lots; }
  const alley = o.alley ?? 0;
  const rowsN = o.mode === 'rows' ? Math.max(2, Math.round(Dp / (o.depth + (o.alley ?? 3) * 0.5))) : (Dp >= (o.minDepth ?? 16) * 2 + alley ? 2 : 1);
  const splitX = () => { const xs = []; let x = -W / 2; while (x < W / 2 - 1e-3) { let w = rng.f(o.wmin, o.wmax); if (W / 2 - (x + w) < o.wmin) w = W / 2 - x; xs.push([x, w]); x += w; } return xs; };
  if (o.mode === 'rows') {
    // alternating back-to-back terraces separated by alleys
    const pair = (Dp + alley) / Math.ceil(rowsN / 2); let z = -Dp / 2; let i = 0;
    while (z < Dp / 2 - 4) {
      const band = Math.min(pair - alley, Dp / 2 - z); const half = band / 2;
      for (const [x, w] of splitX()) { mk(x + w / 2, z + half / 2, w, half, -1, false); mk(x + w / 2, z + half + half / 2, w, half, 1, false); }
      z += band + alley; i++;
    }
    return lots;
  }
  if (rowsN === 1) { for (const [x, w] of splitX()) mk(x + w / 2, 0, w, Dp, rng.chance(0.5) ? 1 : -1, false); return lots; }
  const dRow = (Dp - alley) / 2;
  const a = splitX(), c = splitX();
  a.forEach(([x, w], i) => mk(x + w / 2, -Dp / 2 + dRow / 2, w, dRow, -1, i === 0 || i === a.length - 1));
  c.forEach(([x, w], i) => mk(x + w / 2, Dp / 2 - dRow / 2, w, dRow, 1, i === 0 || i === c.length - 1));
  return lots;
}
