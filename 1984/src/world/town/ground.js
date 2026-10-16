// The floor of the town from the plan polygons: carriageways (asphalt on the
// main roads, granite setts in the old streets), raised York-stone pavements
// with granite kerbs and a grimy gutter, and the yards inside the blocks.
// The same polygons are painted into the GroundMap raster for height and
// footstep lookups.
import * as THREE from 'three';
import { groundMaterial, KERB_H, T } from '../city_ground.js';
import { srgbClone, patchMaterial } from '../city_util.js';
import { pointInPoly } from './streets.js';

function triangulate(outer, holes, y, up = true) {
  const v2 = outer.map(([x, z]) => new THREE.Vector2(x, -z));
  const h2 = holes.map((h) => h.map(([x, z]) => new THREE.Vector2(x, -z)));
  const all = [...outer, ...holes.flat()];
  const tris = THREE.ShapeUtils.triangulateShape(v2, h2);
  const p = [];
  for (const [i, j, k] of tris) {
    const a = all[i], b = all[j], c = all[k];
    const ny = (b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]);
    const tri = (ny > 0) === up ? [a, b, c] : [a, c, b];
    for (const q of tri) p.push(q[0], y, q[1]);
  }
  return p;
}

function flat(p, mat, name, root) {
  if (!p.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  const n = new Float32Array(p.length);
  for (let i = 1; i < n.length; i += 3) n[i] = 1;
  geo.setAttribute('normal', new THREE.BufferAttribute(n, 3));
  const uv = new Float32Array((p.length / 3) * 2);
  for (let i = 0, k = 0; i < p.length; i += 3, k += 2) { uv[k] = p[i]; uv[k + 1] = -p[i + 2]; }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.computeBoundingSphere();
  const m = new THREE.Mesh(geo, mat);
  m.name = name; m.receiveShadow = true; m.matrixAutoUpdate = false;
  root.add(m);
  return m;
}

// surfaces: function (x, z) -> 'asphalt' | 'setts' for the carriageway
export function buildTownGround(G, plan, map, root, o = {}) {
  const group = new THREE.Group();
  group.name = 'ground';
  root.add(group);
  const mats = {
    asphalt: groundMaterial(G, 'asphalt', 3.0, { puddles: 1 }),
    setts: groundMaterial(G, 'cobble', 1.5, { puddles: 0.95, color: 0xd2cabe }),
    paving: groundMaterial(G, 'paving', 2.4, { puddles: 0.55, color: 0xe6e0d4 }),
    square: groundMaterial(G, 'paving', 3.6, { puddles: 0.45, color: 0xefeae2 }),
    yard: groundMaterial(G, 'cobble', 1.2, { puddles: 1, color: 0xa29684 }),
    dirt: groundMaterial(G, 'dirt', 3.0, { puddles: 1, color: 0xc8bca8 }),
  };
  const roadKind = o.roadKind || (() => 'asphalt');

  // raster for lookups: everything starts as road
  map.t.fill(T.ASPHALT);
  for (const p of plan.pave) { map.paintPoly(p.outer, T.PAVING); for (const h of p.holes) map.paintPoly(h, T.ASPHALT); }
  for (const b of plan.blocks) map.paintPoly(b.outer, T.YARD);

  // carriageways, split per surface by the centroid of each triangle
  const byKind = { asphalt: [], setts: [] };
  for (const rd of plan.road) {
    const p = triangulate(rd.outer, rd.holes, 0);
    for (let i = 0; i < p.length; i += 9) {
      const cx = (p[i] + p[i + 3] + p[i + 6]) / 3, cz = (p[i + 2] + p[i + 5] + p[i + 8]) / 3;
      const k = roadKind(cx, cz);
      (byKind[k] || byKind.asphalt).push(...p.slice(i, i + 9));
      if (k === 'setts') map.paintPoly([[p[i], p[i + 2]], [p[i + 3], p[i + 5]], [p[i + 6], p[i + 8]]], T.COBBLE);
    }
  }
  flat(byKind.asphalt, mats.asphalt, 'road_asphalt', group);
  flat(byKind.setts, mats.setts, 'road_setts', group);
  // pavements and squares
  const pv = [];
  for (const p of plan.pave) pv.push(...triangulate(p.outer, p.holes, KERB_H));
  flat(pv, mats.paving, 'pavement', group);
  // yards inside the blocks (mostly hidden under the houses)
  const yd = [];
  for (const b of plan.blocks) yd.push(...triangulate(b.outer, b.holes, KERB_H - 0.004));
  flat(yd, mats.yard, 'yards', group);
  // ground beyond the plan, out to the horizon
  {
    const [x0, z0, x1, z1] = plan.bounds, E = 2200, p = [];
    for (const [a, b, c, d] of [[-E, -E, E, z0], [-E, z1, E, E], [-E, z0, x0, z1], [x1, z0, E, z1]]) p.push(a, 0, d, c, 0, d, c, 0, b, a, 0, d, c, 0, b, a, 0, b);
    flat(p, mats.asphalt, 'ground_far', group);
  }

  // kerbs along every carriageway ring, facing into the road
  const kerbMat = new THREE.MeshStandardMaterial({
    name: 'kerb', map: srgbClone(G.assets.tex('paving_c')), normalMap: G.assets.tex('paving_n'),
    roughnessMap: G.assets.tex('paving_r'), color: 0xcfc8bc, roughness: 1,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2,
  });
  patchMaterial(kerbMat, G.mats.globals, { wet: 1, grime: 0.5 });
  const gut = new THREE.MeshStandardMaterial({ name: 'gutter', color: 0x1c1a17, roughness: 0.6, transparent: true, opacity: 0.38, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  const kp = [], ku = [], kn = [], gp = [];
  const H = KERB_H, KT = 4.5;
  const [bx0, bz0, bx1, bz1] = plan.bounds;
  const onBounds = (a, b) => (Math.abs(a[0] - bx0) < 0.05 && Math.abs(b[0] - bx0) < 0.05) || (Math.abs(a[0] - bx1) < 0.05 && Math.abs(b[0] - bx1) < 0.05)
    || (Math.abs(a[1] - bz0) < 0.05 && Math.abs(b[1] - bz0) < 0.05) || (Math.abs(a[1] - bz1) < 0.05 && Math.abs(b[1] - bz1) < 0.05);
  const runs = [];
  for (const rd of plan.road) {
    for (const ring of [rd.outer, ...rd.holes]) {
      for (let i = 0; i < ring.length; i++) {
        let a = ring[i], b = ring[(i + 1) % ring.length];
        if (onBounds(a, b)) continue;
        const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (L < 0.01) continue;
        const tx = (b[0] - a[0]) / L, tz = (b[1] - a[1]) / L;
        // normal into the road
        let nx = -tz, nz = tx;
        const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
        const inRoad = (x, z) => pointInPoly(x, z, rd.outer) && !rd.holes.some((h) => pointInPoly(x, z, h));
        if (!inRoad(mx + nx * 0.15, mz + nz * 0.15)) { nx = -nx; nz = -nz; }
        // order so the vertical face's normal is (nx, nz)
        if (tx * nz - tz * nx < 0) { const t = a; a = b; b = t; }
        runs.push({ a, b, nx, nz });
        const u0 = (a[0] + a[1]) / KT, u1 = u0 + L / KT;
        const push = (p0, p1, p2, p3, uv, n) => {
          for (const k of [0, 1, 2, 0, 2, 3]) { const q = [p0, p1, p2, p3][k]; kp.push(...q); ku.push(uv[k * 2], uv[k * 2 + 1]); kn.push(...n); }
        };
        push([a[0], 0, a[1]], [b[0], 0, b[1]], [b[0], H, b[1]], [a[0], H, a[1]], [u0, 0.1, u1, 0.1, u1, 0.1 + H / KT, u0, 0.1 + H / KT], [nx, 0, nz]);
        const w = 0.3, ix = -nx * w, iz = -nz * w;
        push([a[0], H + 0.002, a[1]], [b[0], H + 0.002, b[1]], [b[0] + ix, H + 0.002, b[1] + iz], [a[0] + ix, H + 0.002, a[1] + iz], [u0, 0.03, u1, 0.03, u1, 0.03 + w / KT, u0, 0.03 + w / KT], [0, 1, 0]);
        const gw = 0.4, gx = nx * gw, gz = nz * gw;
        gp.push(a[0], 0.004, a[1], a[0] + gx, 0.004, a[1] + gz, b[0] + gx, 0.004, b[1] + gz, a[0], 0.004, a[1], b[0] + gx, 0.004, b[1] + gz, b[0], 0.004, b[1]);
      }
    }
  }
  {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(kp, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(kn, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(ku, 2));
    geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, kerbMat); m.name = 'kerbs'; m.receiveShadow = true; m.matrixAutoUpdate = false;
    group.add(m);
    const g2 = new THREE.BufferGeometry();
    g2.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3));
    g2.computeVertexNormals();
    g2.computeBoundingSphere();
    const gm = new THREE.Mesh(g2, gut); gm.name = 'gutters'; gm.renderOrder = -1; gm.matrixAutoUpdate = false;
    group.add(gm);
  }
  return { mats, group, kerbRuns: runs };
}
