// Coplanar-overlap (z-fighting) audit. Loaded in the debug page:
//   import('/tools/zaudit.js').then((m) => m.run(window.__dbg, { R: 260 }))
// Collects every opaque triangle of the visible scene within R metres of the camera (instances expanded),
// groups them by plane (same facing, |Δd| < tol) and rasterises each plane on a fine grid; a grid sample
// covered by two different triangles is a coplanar overlap, i.e. a z-fighting spot.
const STN = ['CONCRETE', 'METAL', 'CORRUGATED', 'DARKGLASS', 'EMISSIVE', 'SIGN', 'ROAD', 'PAVE', 'RUST', 'MIRROR', 'WIN_RES', 'WIN_OFFICE', 'WIN_RIBBON', 'WIN_SLIT', 'WIN_CAPSULE', 'MEGAHULL', 'WIN_SHANTY', 'WIN_LUX', 'WIN_GROW', 'WIN_INDUSTRIAL', 'WATER', 'FOLIAGE', 'STONE', 'HOLO', 'TILE', 'FABRIC', 'PLASTER', 'COMPOSITE', 'LOUVER', 'SCREEN', 'WIN_SHOP'];

export function run(dbg, o = {}) {
  const { THREE, engine } = dbg; const scene = engine.scene; const cam = engine.camera.position;
  const R = o.R || 260, cell = o.cell || 0.2, tol = o.tol || 0.0012, cx = o.x ?? cam.x, cz = o.z ?? cam.z;
  scene.updateMatrixWorld(true);
  const tris = []; const owners = []; const m4 = new THREE.Matrix4(), mi = new THREE.Matrix4(), v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const visible = (ob) => { for (let p = ob; p; p = p.parent) if (!p.visible) return false; return true; };
  const path = (ob) => { const n = []; for (let p = ob; p && p !== scene; p = p.parent) n.push(p.name || p.type[0] + (p.parent ? p.parent.children.indexOf(p) : '')); return n.reverse().join('/'); };
  scene.traverse((ob) => {
    if (!ob.isMesh || !visible(ob) || o.skip?.(ob)) return; const mat = Array.isArray(ob.material) ? ob.material[0] : ob.material;
    if (!mat || mat.depthTest === false || ob.name === 'sky') return; const g = ob.geometry; const P = g.attributes.position; if (!P) return;
    const S = g.attributes.aStyle; const idx = g.index; const nTri = (idx ? idx.count : P.count) / 3;
    const inst = ob.isInstancedMesh ? ob.count : 1; const oid = owners.length; owners.push({ path: path(ob), off: !!mat.polygonOffset, transparent: !!mat.transparent, dw: mat.depthWrite !== false });
    if (!g.boundingSphere) g.computeBoundingSphere();
    for (let k = 0; k < inst; k++) {
      m4.copy(ob.matrixWorld); if (ob.isInstancedMesh) { ob.getMatrixAt(k, mi); m4.multiply(mi); }
      const bs = g.boundingSphere.center.clone().applyMatrix4(m4); const rad = g.boundingSphere.radius * m4.getMaxScaleOnAxis();
      if (Math.hypot(bs.x - cx, bs.z - cz) > R + rad) continue;
      for (let t = 0; t < nTri; t++) {
        let ok = true;
        for (let j = 0; j < 3; j++) { const i = idx ? idx.getX(t * 3 + j) : t * 3 + j; v[j].fromBufferAttribute(P, i).applyMatrix4(m4); }
        const minx = Math.min(v[0].x, v[1].x, v[2].x), maxx = Math.max(v[0].x, v[1].x, v[2].x), minz = Math.min(v[0].z, v[1].z, v[2].z), maxz = Math.max(v[0].z, v[1].z, v[2].z);
        if (maxx < cx - R || minx > cx + R || maxz < cz - R || minz > cz + R) ok = false; if (!ok) continue;
        const e1 = v[1].clone().sub(v[0]), e2 = v[2].clone().sub(v[0]); const n = e1.cross(e2); const area = n.length() / 2; if (area < 0.004) continue; n.normalize();
        const st = S ? S.getX(idx ? idx.getX(t * 3) : t * 3) : -1;
        tris.push({ a: v[0].clone(), b: v[1].clone(), c: v[2].clone(), n, d: n.dot(v[0]), o: oid, k, st, ds: mat.side === THREE.DoubleSide });
      }
    }
  });
  // bucket by quantised normal, then chain by plane offset
  const byN = new Map();
  for (const t of tris) { const key = `${Math.round(t.n.x * 200)},${Math.round(t.n.y * 200)},${Math.round(t.n.z * 200)}`; let a = byN.get(key); if (!a) byN.set(key, (a = [])); a.push(t); }
  const pairs = new Map(); const spots = new Map(); let samples = 0;
  const inside = (px, py, A, B, C, eps) => { // 2D point-in-triangle with an inset of eps metres
    const ed = (ax, ay, bx, by) => { const ex = bx - ax, ey = by - ay; const l = Math.hypot(ex, ey) || 1; return ((px - ax) * ey - (py - ay) * ex) / l; };
    const s0 = ed(A[0], A[1], B[0], B[1]), s1 = ed(B[0], B[1], C[0], C[1]), s2 = ed(C[0], C[1], A[0], A[1]);
    return (s0 > eps && s1 > eps && s2 > eps) || (s0 < -eps && s1 < -eps && s2 < -eps);
  };
  for (const arr of byN.values()) {
    if (arr.length < 2) continue; arr.sort((p, q) => p.d - q.d);
    let i0 = 0;
    while (i0 < arr.length) {
      let i1 = i0 + 1; while (i1 < arr.length && arr[i1].d - arr[i1 - 1].d < tol) i1++;
      if (i1 - i0 >= 2) {
        const grp = arr.slice(i0, i1); const n = grp[0].n; const ax = Math.abs(n.x) > Math.abs(n.y) ? (Math.abs(n.x) > Math.abs(n.z) ? 0 : 2) : Math.abs(n.y) > Math.abs(n.z) ? 1 : 2;
        const uv = (p) => (ax === 0 ? [p.y, p.z] : ax === 1 ? [p.x, p.z] : [p.x, p.y]);
        const grid = new Map();
        for (const t of grp) {
          const A = uv(t.a), B = uv(t.b), C = uv(t.c);
          const u0 = Math.floor(Math.min(A[0], B[0], C[0]) / cell), u1 = Math.ceil(Math.max(A[0], B[0], C[0]) / cell), w0 = Math.floor(Math.min(A[1], B[1], C[1]) / cell), w1 = Math.ceil(Math.max(A[1], B[1], C[1]) / cell);
          if ((u1 - u0) * (w1 - w0) > 4e6) continue;
          for (let u = u0; u <= u1; u++) for (let w = w0; w <= w1; w++) {
            const px = (u + 0.5) * cell, py = (w + 0.5) * cell; if (!inside(px, py, A, B, C, 0.01)) continue;
            const key = u * 1e7 + w; let lst = grid.get(key); if (!lst) grid.set(key, (lst = []));
            const prev = lst.find((q) => q !== t && Math.abs(q.d - t.d) < tol); if (!lst.includes(t)) lst.push(t);
            if (!prev) continue; samples++;
            const la = `${owners[prev.o].path}:${STN[prev.st] ?? prev.st}${owners[prev.o].off ? '(off)' : ''}`, lb = `${owners[t.o].path}:${STN[t.st] ?? t.st}${owners[t.o].off ? '(off)' : ''}`;
            const pk = la < lb ? la + ' × ' + lb : lb + ' × ' + la; pairs.set(pk, (pairs.get(pk) || 0) + cell * cell);
            // world position of the sample (approx.: centroid height along the dropped axis)
            const wx = ax === 0 ? t.a.x : px, wz = ax === 2 ? t.a.z : ax === 0 ? py : py, wy = ax === 1 ? t.a.y : ax === 0 ? px : py;
            const sk = `${Math.round(wx / 4)},${Math.round(wy / 4)},${Math.round(wz / 4)}`; const sp = spots.get(sk) || { tA: prev, tB: t, x: wx, y: wy, z: wz, area: 0, pk, n: `${n.x.toFixed(2)},${n.y.toFixed(2)},${n.z.toFixed(2)}`, d: t.d.toFixed(3) }; sp.area += cell * cell; spots.set(sk, sp);
          }
        }
      }
      i0 = i1;
    }
  }
  const top = [...pairs.entries()].sort((a, b) => b[1] - a[1]).slice(0, o.top || 25).map(([k, a]) => `${a.toFixed(1)} m²  ${k}`);
  const f3 = (p) => `(${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)})`; const ft = (t) => `${STN[t.st] ?? t.st} d=${t.d.toFixed(4)} ${f3(t.a)}${f3(t.b)}${f3(t.c)}`;
  const sp = [...spots.values()].filter((s) => (!o.vertical || Math.abs(+s.n.split(",")[1]) < 0.5) && (!o.only || o.only.test(s.pk))).sort((a, b) => b.area - a.area).slice(0, o.spots || 20).map((s) => `${s.area.toFixed(1)} m² @ ${s.x.toFixed(1)},${s.y.toFixed(2)},${s.z.toFixed(1)} n=${s.n} :: ${s.pk}` + (o.tris ? `\n     A ${ft(s.tA)}\n     B ${ft(s.tB)}` : ''));
  return { tris: tris.length, owners: owners.length, overlapArea: +(samples * cell * cell).toFixed(1), pairs: top, spots: sp };
}
