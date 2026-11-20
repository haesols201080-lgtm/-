// Shared math helpers: seeded RNG, 2D simplex noise, fbm, easing.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 2D simplex noise (Gustavson), seeded permutation.
export function makeNoise2D(seed = 1) {
  const rand = mulberry32(seed);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const grad = [[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];
  const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
  return function (xin, yin) {
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s), j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const x0 = xin - (i - t), y0 = yin - (j - t);
    const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    let n0 = 0, n1 = 0, n2 = 0;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 > 0) { const g = grad[perm[ii + perm[jj]] & 7]; t0 *= t0; n0 = t0 * t0 * (g[0] * x0 + g[1] * y0); }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 > 0) { const g = grad[perm[ii + i1 + perm[jj + j1]] & 7]; t1 *= t1; n1 = t1 * t1 * (g[0] * x1 + g[1] * y1); }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 > 0) { const g = grad[perm[ii + 1 + perm[jj + 1]] & 7]; t2 *= t2; n2 = t2 * t2 * (g[0] * x2 + g[1] * y2); }
    return 70 * (n0 + n1 + n2);
  };
}

export function fbm(noise, x, y, oct = 4, lac = 2, gain = 0.5) {
  let a = 1, f = 1, s = 0, n = 0;
  for (let i = 0; i < oct; i++) { s += a * noise(x * f, y * f); n += a; a *= gain; f *= lac; }
  return s / n;
}

// 3D value noise (cheap) used for rock displacement / SDFs.
export function makeNoise3D(seed = 7) {
  const rand = mulberry32(seed);
  const N = 256, perm = new Uint8Array(N * 2), vals = new Float32Array(N);
  for (let i = 0; i < N; i++) { perm[i] = i; vals[i] = rand() * 2 - 1; }
  for (let i = N - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); const t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
  for (let i = 0; i < N; i++) perm[i + N] = perm[i];
  const h = (x, y, z) => vals[perm[perm[perm[x & 255] + (y & 255)] + (z & 255)]];
  const sm = (t) => t * t * (3 - 2 * t);
  return function (x, y, z) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = sm(x - xi), yf = sm(y - yi), zf = sm(z - zi);
    const l = (a, b, t) => a + (b - a) * t;
    return l(
      l(l(h(xi, yi, zi), h(xi + 1, yi, zi), xf), l(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), xf), yf),
      l(l(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), xf), l(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), xf), yf),
      zf);
  };
}

// Korean particle after a name: josa('세븐', '이', '가') -> '세븐이', josa('로터', '과', '와') -> '로터와'
export function josa(w, withFinal, noFinal) {
  const c = w.charCodeAt(w.length - 1), fin = c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0;
  return w + (fin ? withFinal : noFinal);
}
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export function dampAngle(a, b, lambda, dt) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * (1 - Math.exp(-lambda * dt));
}
export function angleDiff(a, b) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Distance from point to polyline segment set (2D xz), returns {d, t, i}.
// Polylines are dense (smoothed curves), so each one gets a coarse grid of candidate segments the first time it is
// queried: for a cell, a segment can only be the nearest to some point inside if its distance to the cell centre is
// within one cell diagonal of the closest segment's — the answer stays exact, queries look at a handful of segments.
const _polyGrids = new WeakMap(), PG = { min: -52, cell: 2, n: 52 };
function polyGrid(pts) {
  let G = _polyGrids.get(pts); if (G) return G;
  const { min, cell, n } = PG, diag = cell * Math.SQRT2 + 1e-6, lists = new Array(n * n), dc = new Float64Array(pts.length);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const cx = min + (i + 0.5) * cell, cz = min + (j + 0.5) * cell; let m = 1e9;
    for (let k = 0; k < pts.length - 1; k++) { dc[k] = segDist(cx, cz, pts[k], pts[k + 1]); if (dc[k] < m) m = dc[k]; }
    const L = []; for (let k = 0; k < pts.length - 1; k++) if (dc[k] <= m + diag) L.push(k);
    lists[j * n + i] = L;
  }
  G = lists; _polyGrids.set(pts, G); return G;
}
function segDist(px, pz, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1], L = dx * dx + dz * dz;
  const t = L > 0 ? clamp(((px - a[0]) * dx + (pz - a[1]) * dz) / L, 0, 1) : 0;
  return Math.hypot(a[0] + dx * t - px, a[1] + dz * t - pz);
}
export function distToPolyline(px, pz, pts) {
  let best = 1e9, bi = 0, bt = 0;
  const gi = Math.floor((px - PG.min) / PG.cell), gj = Math.floor((pz - PG.min) / PG.cell);
  const cand = pts.length > 12 && gi >= 0 && gj >= 0 && gi < PG.n && gj < PG.n ? polyGrid(pts)[gj * PG.n + gi] : null;
  const m = cand ? cand.length : pts.length - 1;
  for (let q = 0; q < m; q++) {
    const i = cand ? cand[q] : q;
    const ax = pts[i][0], az = pts[i][1], bx = pts[i + 1][0], bz = pts[i + 1][1];
    const dx = bx - ax, dz = bz - az;
    const L = dx * dx + dz * dz;
    let t = L > 0 ? ((px - ax) * dx + (pz - az) * dz) / L : 0;
    t = clamp(t, 0, 1);
    const qx = ax + dx * t - px, qz = az + dz * t - pz;
    const d = Math.sqrt(qx * qx + qz * qz);
    if (d < best) { best = d; bi = i; bt = t; }
  }
  return { d: best, i: bi, t: bt };
}

// A hand-placed polyline made into a natural curve: every leg gets a gentle sideways bend (seeded, so the world
// is the same every time; legs listed in `keep` stay straight because something is built across them), then a
// centripetal Catmull-Rom spline runs through all of it, sampled about every `step` metres. The control points
// are kept on the curve; `ctrl[k]` is the index of control point k in the result.
export function naturalCurve(ctrl, { bend = 0.07, maxBend = 0.7, keep = [], seed = 1, step = 0.45 } = {}) {
  let s = seed * 9301 + 49297;
  const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const P = [ctrl[0]], isCtrl = [true];
  for (let k = 0; k + 1 < ctrl.length; k++) {
    const [ax, az] = ctrl[k], [bx, bz] = ctrl[k + 1], L = Math.hypot(bx - ax, bz - az);
    const off = keep.includes(k) ? 0 : (rand() * 2 - 1) * Math.min(maxBend, L * bend), f = 0.4 + rand() * 0.2;
    if (L > 2.5 && off) { P.push([ax + (bx - ax) * f - (bz - az) / L * off, az + (bz - az) * f + (bx - ax) / L * off]); isCtrl.push(false); }
    P.push(ctrl[k + 1]); isCtrl.push(true);
  }
  const out = [], idx = [];
  const ext = [[2 * P[0][0] - P[1][0], 2 * P[0][1] - P[1][1]], ...P, [2 * P[P.length - 1][0] - P[P.length - 2][0], 2 * P[P.length - 1][1] - P[P.length - 2][1]]];
  for (let k = 0; k + 1 < P.length; k++) {
    const p0 = ext[k], p1 = ext[k + 1], p2 = ext[k + 2], p3 = ext[k + 3];
    const kt = (a, b) => Math.max(1e-4, Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1])));
    const t0 = 0, t1 = t0 + kt(p0, p1), t2 = t1 + kt(p1, p2), t3 = t2 + kt(p2, p3);
    const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    if (isCtrl[k]) idx.push(out.length);
    for (let q = 0; q < n; q++) {
      const t = t1 + (t2 - t1) * (q / n), r = [];
      for (let c = 0; c < 2; c++) {
        const A1 = ((t1 - t) * p0[c] + (t - t0) * p1[c]) / (t1 - t0), A2 = ((t2 - t) * p1[c] + (t - t1) * p2[c]) / (t2 - t1), A3 = ((t3 - t) * p2[c] + (t - t2) * p3[c]) / (t3 - t2);
        const B1 = ((t2 - t) * A1 + (t - t0) * A2) / (t2 - t0), B2 = ((t3 - t) * A2 + (t - t1) * A3) / (t3 - t1);
        r.push(((t2 - t) * B1 + (t - t1) * B2) / (t2 - t1));
      }
      out.push(r);
    }
  }
  idx.push(out.length); out.push(P[P.length - 1].slice());
  out.ctrl = idx;
  return out;
}
