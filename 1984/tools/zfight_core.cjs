// Finds faces that z-fight: pairs of triangles facing the same way, lying in
// (nearly) the same plane and overlapping. Screenshots miss these because the
// flicker only shows as the camera moves, so we measure the geometry instead.
// tris: flat array of { a:[x,y,z], b, c, tag } in world space.
// Returns [{ tagA, tagB, gap, area, at:[x,y,z] }] merged per tag pair.
function findCoplanar(tris, opt) {
  opt = opt || {};
  const TOL = opt.tol || 0.004;          // plane distance counted as coplanar (m)
  const MIN = opt.minArea || 2e-4;       // overlap area worth reporting (m^2)
  const sameTag = !!opt.sameTag;         // also report overlaps inside one tag
  const P = [];
  for (let i = 0; i < tris.length; i++) {
    const t = tris[i];
    const ux = t.b[0] - t.a[0], uy = t.b[1] - t.a[1], uz = t.b[2] - t.a[2];
    const vx = t.c[0] - t.a[0], vy = t.c[1] - t.a[1], vz = t.c[2] - t.a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const L = Math.hypot(nx, ny, nz);
    if (L < 2e-5) continue;
    nx /= L; ny /= L; nz /= L;
    P.push({ t, n: [nx, ny, nz], d: nx * t.a[0] + ny * t.a[1] + nz * t.a[2], area: L / 2,
      key: Math.round(nx * 40) + ',' + Math.round(ny * 40) + ',' + Math.round(nz * 40) });
  }
  const groups = new Map();
  for (const p of P) { let g = groups.get(p.key); if (!g) groups.set(p.key, g = []); g.push(p); }
  const out = new Map();
  const basis = (n) => {
    const a = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    let e1 = [n[1] * a[2] - n[2] * a[1], n[2] * a[0] - n[0] * a[2], n[0] * a[1] - n[1] * a[0]];
    const l = Math.hypot(...e1); e1 = e1.map((v) => v / l);
    const e2 = [n[1] * e1[2] - n[2] * e1[1], n[2] * e1[0] - n[0] * e1[2], n[0] * e1[1] - n[1] * e1[0]];
    return [e1, e2];
  };
  const proj = (p, e) => [p[0] * e[0][0] + p[1] * e[0][1] + p[2] * e[0][2], p[0] * e[1][0] + p[1] * e[1][1] + p[2] * e[1][2]];
  const clip = (poly, a, b) => {   // keep the left of a->b
    const res = [];
    const side = (p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length];
      const sp = side(p), sq = side(q);
      if (sp >= 0) res.push(p);
      if ((sp >= 0) !== (sq >= 0)) { const k = sp / (sp - sq); res.push([p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k]); }
    }
    return res;
  };
  const area2 = (poly) => { let s = 0; for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; s += p[0] * q[1] - q[0] * p[1]; } return s / 2; };
  const ccw = (tri) => (area2(tri) < 0 ? [tri[0], tri[2], tri[1]] : tri);
  // neighbouring normal buckets too, so a plane near a bucket edge still meets its twin
  const keys = [...groups.keys()];
  for (const key of keys) {
    const [kx, ky, kz] = key.split(',').map(Number);
    let list = [];
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      const g = groups.get((kx + dx) + ',' + (ky + dy) + ',' + (kz + dz));
      if (g) list = list.concat(dx || dy || dz ? g.map((p) => Object.assign({ far: true }, p)) : g);
    }
    const own = groups.get(key);
    const e = basis(own[0].n);
    list.sort((p, q) => p.d - q.d);
    for (const p of own) {
      // binary search the d window
      let lo = 0, hi = list.length;
      while (lo < hi) { const m = (lo + hi) >> 1; if (list[m].d < p.d - TOL) lo = m + 1; else hi = m; }
      for (let j = lo; j < list.length && list[j].d <= p.d + TOL; j++) {
        const q = list[j];
        if (q === p || (!q.far && q.t.idx < p.t.idx) || (q.far && q.key < p.key)) continue;
        if (p.n[0] * q.n[0] + p.n[1] * q.n[1] + p.n[2] * q.n[2] < 0.9994) continue;
        if (!sameTag && p.t.tag === q.t.tag) continue;
        const A = ccw([proj(p.t.a, e), proj(p.t.b, e), proj(p.t.c, e)]);
        const B = ccw([proj(q.t.a, e), proj(q.t.b, e), proj(q.t.c, e)]);
        if (Math.max(A[0][0], A[1][0], A[2][0]) < Math.min(B[0][0], B[1][0], B[2][0]) ||
            Math.min(A[0][0], A[1][0], A[2][0]) > Math.max(B[0][0], B[1][0], B[2][0]) ||
            Math.max(A[0][1], A[1][1], A[2][1]) < Math.min(B[0][1], B[1][1], B[2][1]) ||
            Math.min(A[0][1], A[1][1], A[2][1]) > Math.max(B[0][1], B[1][1], B[2][1])) continue;
        let poly = A;
        for (let k = 0; k < 3 && poly.length; k++) poly = clip(poly, B[k], B[(k + 1) % 3]);
        if (poly.length < 3) continue;
        const ar = Math.abs(area2(poly));
        if (ar < 1e-6) continue;
        const tags = [p.t.tag, q.t.tag].sort();
        const k2 = tags.join(' | ');
        let o = out.get(k2);
        if (!o) out.set(k2, o = { tagA: tags[0], tagB: tags[1], gap: 1, area: 0, at: p.t.a.map((v) => +v.toFixed(2)) });
        o.area += ar; o.gap = Math.min(o.gap, Math.abs(p.d - q.d));
      }
    }
  }
  return [...out.values()].filter((o) => o.area >= MIN).sort((a, b) => b.area - a.area);
}
if (typeof module !== 'undefined') module.exports = { findCoplanar };
