// Measures every interior room for faces that z-fight and for furniture that
// is badly placed. Screenshots miss both: flicker only shows while the camera
// moves, and a chair half inside a table can hide behind the table top.
//   node tools/zfight_scene.mjs [room ...] [--tol=0.0015] [--area=0.0002] [--pen=0.005] [--json=out.json]
//   HTML=<private build>/index.html runs another build of the game.
// Checks per room:
//   z-fight   faces of different objects facing the same way within --tol of
//             one plane and overlapping by more than --area (materials with
//             polygonOffset are skipped: they are meant to lie on surfaces)
//   cross     props crossing each other or the walls, doors and window frames
//             by more than --pen (flush contact is not a crossing)
//   clear     props standing in the kept-free floor before a door or opening
//   window    tall props standing in front of a window
//   support   props floating above or sunk into the floor or what they stand on
//   chair     chairs not facing the table they stand at, or too far from it
//   wall      posters, screens and pictures off the wall, sunk into it, over a
//             window or door, over each other, or hidden behind furniture
//   outside   anything beyond the room's walls
//   spawn     player spawns and story points inside furniture
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require('/opt/node22/lib/node_modules/playwright'); }

const root = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; }));
const only = args.filter((a) => !a.startsWith('--'));
const opt = {
  tol: +(flags.tol ?? 0.0015),       // m: plane distance counted as coplanar
  minArea: +(flags.area ?? 2e-4),    // m2: overlap worth reporting
  pen: +(flags.pen ?? 0.005),        // m: crossing deeper than this is real
  float: +(flags.float ?? 0.004),    // m: gap under a standing prop
  wallGap: +(flags.wallgap ?? 0.015), // m: wall items standing off further than this
};

const browser = await pw.chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 320, height: 180 } });
const logs = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type()) || /\[rooms\]/.test(m.text())) logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto('file://' + (process.env.HTML || path.join(root, 'index.html')) + '?skip&q=low&nostory&slowgpu&nocity');
try {
  await page.waitForFunction(() => window.G && window.G.location && window.G.interiors, null, { timeout: 240000 });
} catch (e) {
  console.log('game did not start'); console.log(logs.join('\n'));
  await browser.close(); process.exit(1);
}
const core = fs.readFileSync(path.join(root, 'tools/zfight_core.cjs'), 'utf8');
await page.addScriptTag({ content: `(function () { var module = { exports: {} };\n${core}\n;window.findCoplanar = module.exports.findCoplanar; })();` });
// nothing needs drawing while we measure
await page.evaluate(() => { const G = window.G; G.paused = true; G.renderer.render = () => {}; });

// ---------------------------------------------------------------- in the page
function analyseRoom([id, opt, state]) {
  const G = window.G, THREE = G.THREE;
  const room = G.interiors.rooms[id];
  if (state === 'fallen' && G.interiors.setEngravingFallen) G.interiors.setEngravingFallen(true);
  const def = room.def;
  const W = def.w, D = def.d, Ht = def.h;
  const WALL_T = 0.22;
  room.root.updateMatrixWorld(true);
  const inv = room.root.matrixWorld.clone().invert();
  const MOUNTED = /^(poster|telescreen_wall|engraving|notice|sign|picture)/;
  const HANGING = /^(bulb|lamp_hanging|shade)/;
  const TABLE = /(^table|desk|gateleg|canteen_table)/;
  const CHAIR = /^chair$/;
  const r3 = (p) => p.map((v) => +v.toFixed(2));
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]); return l > 1e-12 ? [a[0] / l, a[1] / l, a[2] / l] : null; };

  // ---- openings and recesses in room coordinates
  const sides = {
    n: { len: W, o: [-W / 2, -D / 2], u: [1, 0], inward: [0, 1] },
    s: { len: W, o: [W / 2, D / 2], u: [-1, 0], inward: [0, -1] },
    w: { len: D, o: [-W / 2, D / 2], u: [0, -1], inward: [1, 0] },
    e: { len: D, o: [W / 2, -D / 2], u: [0, 1], inward: [-1, 0] },
  };
  const holes = room.holes || [
    ...(def.windows || []).map((h) => ({ ...h, kind: 'window' })),
    ...(def.doors || []).map((h) => ({ ...h, kind: 'door', sill: 0, height: h.height ?? 2.1, width: h.width ?? 0.9 })),
    ...(def.gaps || []).map((h) => ({ ...h, kind: 'gap', sill: 0, height: Ht })),
  ].map((h) => ({ ...h, a: h.at - h.width / 2, b: h.at + h.width / 2 }));
  const recesses = room.recesses || [];
  // wall planes: inward normal and offset, with the extent along the wall
  const planes = room.planes ? room.planes.map((p) => ({ ...p })) : [];
  if (!room.planes) for (const [k, s] of Object.entries(sides)) {
    const n = [s.inward[0], 0, s.inward[1]];
    planes.push({ side: k, n, d: dot(n, [s.o[0], 0, s.o[1]]), s });
  }
  if (!room.planes) for (const r of recesses) {
    planes.push({ side: 'recess', n: [0, 0, r.z1 > D / 2 ? -1 : 1], d: r.z1 > D / 2 ? -r.z1 : r.z0, rec: r });
    planes.push({ side: 'recess', n: [1, 0, 0], d: r.x0, rec: r });
    planes.push({ side: 'recess', n: [-1, 0, 0], d: -r.x1, rec: r });
  }
  const along = (s, p) => (p[0] - s.o[0]) * s.u[0] + (p[2] - s.o[1]) * s.u[1];

  // ---- objects and their triangles in room coordinates
  const objs = [], byNode = new Map(), counters = {}, tris = [];
  const visible = (o) => { for (let p = o; p && p !== room.root; p = p.parent) if (!p.visible) return false; return true; };
  const ownerOf = (o) => { for (let p = o; p && p !== room.root; p = p.parent) if (p.userData && p.userData.prop) return p; return null; };
  const m4 = new THREE.Matrix4(), mi = new THREE.Matrix4(), v = new THREE.Vector3();
  room.root.traverse((o) => {
    if (!o.isMesh || o.isSkinnedMesh || !visible(o)) return;
    const owner = ownerOf(o);
    const key = owner || o;
    let ob = byNode.get(key);
    if (!ob) {
      const mat0 = Array.isArray(o.material) ? o.material[0] : o.material;
      const name = owner ? owner.userData.prop : (o.userData.arch || o.name || (mat0 && mat0.name) || 'mesh');
      counters[name] = (counters[name] || 0) + 1;
      ob = { i: objs.length, id: name + '#' + counters[name], name, kind: owner ? 'prop' : 'arch', node: key, tris: [], verts: [],
        mounted: owner ? (owner.userData.mounted ?? MOUNTED.test(name)) : false, hanging: owner ? HANGING.test(name) : false,
        slid: owner && owner.userData.slid };
      objs.push(ob); byNode.set(key, ob);
    }
    const g = o.geometry, pos = g && g.attributes.position;
    if (!pos) return;
    const idx = g.index;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const total = idx ? idx.count : pos.count;
    const groups = Array.isArray(o.material) && g.groups.length ? g.groups : [{ start: 0, count: total, materialIndex: 0 }];
    const n = o.isInstancedMesh ? o.count : 1;
    for (let k = 0; k < n; k++) {
      m4.copy(o.matrixWorld);
      if (o.isInstancedMesh) { o.getMatrixAt(k, mi); m4.multiply(mi); }
      m4.premultiply(inv);
      const P = new Float64Array(pos.count * 3);
      for (let q = 0; q < pos.count; q++) {
        v.fromBufferAttribute(pos, q).applyMatrix4(m4);
        P[q * 3] = v.x; P[q * 3 + 1] = v.y; P[q * 3 + 2] = v.z;
        ob.verts.push([v.x, v.y, v.z]);
      }
      for (const gr of groups) {
        const mat = mats[gr.materialIndex ?? 0] || mats[0];
        if (!mat || mat.visible === false) continue;
        const end = Math.min(gr.start + gr.count, total);
        const decal = !!mat.polygonOffset;
        const ds = mat.side === THREE.DoubleSide;
        for (let t = gr.start; t + 2 < end; t += 3) {
          const ia = idx ? idx.getX(t) : t, ib = idx ? idx.getX(t + 1) : t + 1, ic = idx ? idx.getX(t + 2) : t + 2;
          const a = [P[ia * 3], P[ia * 3 + 1], P[ia * 3 + 2]], b = [P[ib * 3], P[ib * 3 + 1], P[ib * 3 + 2]], c = [P[ic * 3], P[ic * 3 + 1], P[ic * 3 + 2]];
          const tri = { a, b, c, tag: ob.id + '/' + (mat.name || mat.type), idx: tris.length, ob: ob.i, decal };
          const nn = norm(cross(sub(b, a), sub(c, a)));
          if (!nn) continue;
          tri.n = nn; tri.d = dot(nn, a);
          tri.bb = [Math.min(a[0], b[0], c[0]), Math.min(a[1], b[1], c[1]), Math.min(a[2], b[2], c[2]),
            Math.max(a[0], b[0], c[0]), Math.max(a[1], b[1], c[1]), Math.max(a[2], b[2], c[2])];
          ob.tris.push(tri);
          if (!decal) {
            tris.push(tri);
            if (ds) tris.push({ a, b: c, c: b, tag: tri.tag, idx: tris.length, ob: ob.i });
          }
        }
      }
    }
  });
  for (const ob of objs) {
    const bb = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (const p of ob.verts) for (let k = 0; k < 3; k++) { bb[k] = Math.min(bb[k], p[k]); bb[k + 3] = Math.max(bb[k + 3], p[k]); }
    ob.bb = bb;
    ob.thin = [0, 1, 2].findIndex((k) => bb[k + 3] - bb[k] < 0.001);   // a flat panel: its axis
  }
  const props = objs.filter((o) => o.kind === 'prop');
  const rep = { id: state ? id + ' (' + state + ')' : id, size: [W, D, Ht], objects: objs.length, props: props.length, tris: tris.length,
    zfight: [], unseen: [], internal: [], info: [], cross: [], clear: [], window: [], support: [], chair: [], wall: [], outside: [], spawn: [], slid: [] };

  // ---- 1. coplanar overlaps
  const bbHit = (p, q, e = 0) => p[0] <= q[3] + e && p[3] >= q[0] - e && p[1] <= q[4] + e && p[4] >= q[1] - e && p[2] <= q[5] + e && p[5] >= q[2] - e;
  // where an eye can be: the room and its alcoves, kept off the walls
  const eyes = [];
  const boxes = [{ x0: -W / 2, x1: W / 2, z0: -D / 2, z1: D / 2 }, ...recesses];
  for (const b of boxes) for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) for (const y of [0.4, 1.2, 1.7, Math.min(Ht - 0.3, 2.4)]) {
    const m = 0.22;
    eyes.push([b.x0 + m + (b.x1 - b.x0 - 2 * m) * i / 4, y, b.z0 + m + (b.z1 - b.z0 - 2 * m) * j / 4]);
  }
  const byTag = new Map();
  for (const t of tris) { if (!t.n) continue; let l = byTag.get(t.tag); if (!l) byTag.set(t.tag, l = []); l.push(t); }
  for (const r of window.findCoplanar(tris, { tol: opt.tol, minArea: opt.minArea, sameTag: false })) {
    const A = r.tagA.split('/')[0], B = r.tagB.split('/')[0];
    // the shared plane: a pair of triangles from the two tags facing the same way
    let pl = null;
    for (const p of byTag.get(r.tagA) || []) {
      for (const q of byTag.get(r.tagB) || []) if (dot(p.n, q.n) > 0.9994 && Math.abs(p.d - q.d) <= opt.tol && bbHit(p.bb, q.bb, 1e-4)) { pl = p; break; }
      if (pl) break;
    }
    const seen = !pl || eyes.some((e) => dot(pl.n, e) - pl.d > 0.05);
    const e = { a: r.tagA, b: r.tagB, gap: +(r.gap * 1000).toFixed(2), area: +(r.area * 1e4).toFixed(1), at: r.at, n: pl ? r3(pl.n) : null };
    if (A === B) rep.internal.push(e); else if (seen) rep.zfight.push(e); else rep.unseen.push(e);
  }

  // ---- 2. crossings
  const segOn = (T, d) => {
    const V = [T.a, T.b, T.c], pts = [];
    for (let k = 0; k < 3; k++) {
      const k2 = (k + 1) % 3, d0 = d[k], d1 = d[k2];
      if (d0 === 0) pts.push(V[k]);
      if ((d0 > 0 && d1 < 0) || (d0 < 0 && d1 > 0)) { const s = d0 / (d0 - d1); pts.push([V[k][0] + (V[k2][0] - V[k][0]) * s, V[k][1] + (V[k2][1] - V[k][1]) * s, V[k][2] + (V[k2][2] - V[k][2]) * s]); }
    }
    return pts;
  };
  const triCross = (A, B) => {
    const da = [dot(B.n, A.a) - B.d, dot(B.n, A.b) - B.d, dot(B.n, A.c) - B.d];
    if (Math.max(...da) <= 1e-6 || Math.min(...da) >= -1e-6) return 0;
    const db = [dot(A.n, B.a) - A.d, dot(A.n, B.b) - A.d, dot(A.n, B.c) - A.d];
    if (Math.max(...db) <= 1e-6 || Math.min(...db) >= -1e-6) return 0;
    const L = norm(cross(A.n, B.n));
    if (!L) return 0;
    const ta = segOn(A, da).map((p) => dot(p, L)), tb = segOn(B, db).map((p) => dot(p, L));
    if (ta.length < 2 || tb.length < 2) return 0;
    const ov = Math.min(Math.max(...ta), Math.max(...tb)) - Math.max(Math.min(...ta), Math.min(...tb));
    if (ov <= 1e-5) return 0;
    const depA = Math.min(Math.max(...da), -Math.min(...da)), depB = Math.min(Math.max(...db), -Math.min(...db));
    return Math.min(depA, depB);
  };
  // how far object A reaches through panel B (a wall, the floor) or into box B
  const reach = (A, B) => {
    if (B.thin >= 0) {
      const k = B.thin, plane = (B.bb[k] + B.bb[k + 3]) / 2;
      const sgn = Math.sign(B.tris[0].n[k]) || 1;
      const o1 = (k + 1) % 3, o2 = (k + 2) % 3;
      let m = 0;
      for (const p of A.verts) {
        if (p[o1] < B.bb[o1] || p[o1] > B.bb[o1 + 3] || p[o2] < B.bb[o2] || p[o2] > B.bb[o2 + 3]) continue;
        m = Math.max(m, sgn * (plane - p[k]));
      }
      return m;
    }
    let m = Infinity;
    for (let k = 0; k < 3; k++) m = Math.min(m, Math.min(A.bb[k + 3], B.bb[k + 3]) - Math.max(A.bb[k], B.bb[k]));
    return Math.max(0, m);
  };
  for (let i = 0; i < objs.length; i++) {
    for (let j = i + 1; j < objs.length; j++) {
      const A = objs[i], B = objs[j];
      if (A.kind === 'arch' && B.kind === 'arch') continue;
      // a screen let into the wall crosses the wall on purpose
      if ((A.node.userData.inset && B.name === 'wall') || (B.node.userData.inset && A.name === 'wall')) continue;
      if (!bbHit(A.bb, B.bb, 1e-4)) continue;
      const ob = [Math.max(A.bb[0], B.bb[0]) - 1e-4, Math.max(A.bb[1], B.bb[1]) - 1e-4, Math.max(A.bb[2], B.bb[2]) - 1e-4,
        Math.min(A.bb[3], B.bb[3]) + 1e-4, Math.min(A.bb[4], B.bb[4]) + 1e-4, Math.min(A.bb[5], B.bb[5]) + 1e-4];
      const ta = A.tris.filter((t) => bbHit(t.bb, ob)), tb = B.tris.filter((t) => bbHit(t.bb, ob));
      let best = 0, at = null, n = 0;
      for (const p of ta) for (const q of tb) {
        if (!bbHit(p.bb, q.bb)) continue;
        const d = triCross(p, q);
        if (d > opt.pen) n++;
        if (d > best) { best = d; at = p.a; }
      }
      if (best > opt.pen) {
        const pen = Math.max(B.kind === 'arch' ? reach(A, B) : 0, A.kind === 'arch' ? reach(B, A) : 0, A.kind === 'prop' && B.kind === 'prop' ? reach(A, B) : 0);
        rep.cross.push({ a: A.id, b: B.id, cross: +(best * 1000).toFixed(0), pen: +(pen * 1000).toFixed(0), tris: n, at: r3(at) });
      }
    }
  }

  // ---- 2D helpers for footprints
  const hull = (pts) => {
    const p = pts.map((q) => [q[0], q[2]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    if (p.length < 3) return p;
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    for (const q of p.slice().reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
    return lo.slice(0, -1).concat(up.slice(0, -1));
  };
  const clipRect = (poly, x0, x1, z0, z1) => {
    const clip = (P, inside, cut) => { const out = []; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; const ia = inside(a), ib = inside(b); if (ia) out.push(a); if (ia !== ib) out.push(cut(a, b)); } return out; };
    const cx = (x) => (a, b) => [x, a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0])];
    const cz = (z) => (a, b) => [a[0] + (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]), z];
    let P = poly;
    P = clip(P, (p) => p[0] >= x0, cx(x0)); if (!P.length) return 0;
    P = clip(P, (p) => p[0] <= x1, cx(x1)); if (!P.length) return 0;
    P = clip(P, (p) => p[1] >= z0, cz(z0)); if (!P.length) return 0;
    P = clip(P, (p) => p[1] <= z1, cz(z1)); if (P.length < 3) return 0;
    let s = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; s += a[0] * b[1] - b[0] * a[1]; }
    return Math.abs(s / 2);
  };
  const inHull = (H, x, z, r = 0) => {
    if (H.length < 3) return false;
    for (let i = 0; i < H.length; i++) {
      const a = H[i], b = H[(i + 1) % H.length];
      const ex = b[0] - a[0], ez = b[1] - a[1], L = Math.hypot(ex, ez) || 1;
      if ((ex * (z - a[1]) - ez * (x - a[0])) / L < -r) return false;
    }
    return true;
  };
  for (const ob of props) ob.hull = hull(ob.verts.filter((p) => p[1] < 1.9));

  // ---- 3. door and opening clearance; windows
  const floorProps = props.filter((o) => !o.mounted && !o.hanging && o.bb[1] < 0.3 && o.bb[4] - o.bb[1] > 0.03);
  for (const c of room.clear || []) {
    for (const o of floorProps) {
      const a = clipRect(o.hull, c.x0, c.x1, c.z0, c.z1);
      if (a > 0.004) rep.clear.push({ obj: o.id, zone: (c.kind || 'opening') + ' ' + c.side + '@' + (+c.mid.toFixed(2)), area: +(a * 1e4).toFixed(0) });
    }
  }
  for (const h of holes.filter((q) => q.kind === 'window')) {
    const s = sides[h.side];
    const P = (t, k) => [s.o[0] + s.u[0] * t + s.inward[0] * k, s.o[1] + s.u[1] * t + s.inward[1] * k];
    const pts = [P(h.a, 0), P(h.b, 0), P(h.a, 0.5), P(h.b, 0.5)];
    const x0 = Math.min(...pts.map((p) => p[0])), x1 = Math.max(...pts.map((p) => p[0])), z0 = Math.min(...pts.map((p) => p[1])), z1 = Math.max(...pts.map((p) => p[1]));
    for (const o of props.filter((q) => !q.mounted && !q.hanging)) {
      const a = clipRect(o.hull, x0, x1, z0, z1);
      if (a <= 0.004) continue;
      let top = 0;
      for (const p of o.verts) if (p[0] >= x0 && p[0] <= x1 && p[2] >= z0 && p[2] <= z1) top = Math.max(top, p[1]);
      if (top > h.sill + 0.25) rep.window.push({ obj: o.id, window: h.side + '@' + h.at, top: +top.toFixed(2), sill: h.sill });
    }
  }

  // ---- 4. support: floating or sunk
  const upTris = objs.flatMap((o) => o.tris.filter((t) => t.n[1] > 0.3).map((t) => Object.assign(t, { owner: o })));
  const heightAt = (x, z, below, self) => {
    let best = -Infinity, who = null;
    for (const t of upTris) {
      if (t.owner === self) continue;
      if (x < t.bb[0] || x > t.bb[3] || z < t.bb[2] || z > t.bb[5]) continue;
      const [a, b, c] = [t.a, t.b, t.c];
      const det = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
      if (Math.abs(det) < 1e-12) continue;
      const l1 = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / det;
      const l2 = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / det;
      const l3 = 1 - l1 - l2;
      if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
      const y = l1 * a[1] + l2 * b[1] + l3 * c[1];
      if (y <= below && y > best) { best = y; who = t.owner; }
    }
    return [best, who];
  };
  for (const o of props) {
    if (o.mounted) continue;
    if (o.hanging) {
      const gap = Ht - o.bb[4];
      if (Math.abs(gap) > opt.float) rep.support.push({ obj: o.id, on: 'ceiling', gap: +(gap * 1000).toFixed(0) });
      continue;
    }
    const bottom = o.bb[1];
    // the lowest points of the object: where it stands
    const feet = o.verts.filter((p) => p[1] < bottom + 0.01);
    const sample = [];
    const step = Math.max(1, Math.floor(feet.length / 24));
    for (let k = 0; k < feet.length; k += step) sample.push(feet[k]);
    let worst = null;
    for (const p of sample) {
      const [y, who] = heightAt(p[0], p[2], p[1] + 0.06, o);
      const gap = p[1] - y;
      if (!isFinite(gap)) continue;
      if (!worst || Math.abs(gap) < Math.abs(worst.gap)) worst = { gap, who };
    }
    if (!worst) { rep.support.push({ obj: o.id, on: 'nothing', gap: +(bottom * 1000).toFixed(0) }); continue; }
    if (Math.abs(worst.gap) > opt.float) rep.support.push({ obj: o.id, on: worst.who.id, gap: +(worst.gap * 1000).toFixed(0) });
  }

  // ---- 5. chairs at tables
  const tables = props.filter((o) => TABLE.test(o.name));
  for (const ch of props.filter((o) => CHAIR.test(o.name))) {
    const cx = (ch.bb[0] + ch.bb[3]) / 2, cz = (ch.bb[2] + ch.bb[5]) / 2;
    const tall = ch.verts.filter((p) => p[1] > ch.bb[1] + 0.65 * (ch.bb[4] - ch.bb[1]));
    const bx = tall.reduce((s, p) => s + p[0], 0) / tall.length - cx, bz = tall.reduce((s, p) => s + p[2], 0) / tall.length - cz;
    const L = Math.hypot(bx, bz) || 1;
    const fx = -bx / L, fz = -bz / L;   // the way a sitter faces
    let best = null;
    for (const t of tables) {
      const nx = Math.max(t.bb[0], Math.min(cx, t.bb[3])), nz = Math.max(t.bb[2], Math.min(cz, t.bb[5]));
      const d = Math.hypot(nx - cx, nz - cz);
      if (!best || d < best.d) best = { t, d, tx: (t.bb[0] + t.bb[3]) / 2, tz: (t.bb[2] + t.bb[5]) / 2 };
    }
    if (!best || best.d > 0.9) { rep.info.push(`${ch.id} stands at no table, facing [${fx.toFixed(2)}, ${fz.toFixed(2)}]`); continue; }
    const vx = best.tx - cx, vz = best.tz - cz, vl = Math.hypot(vx, vz) || 1;
    const ang = Math.acos(Math.max(-1, Math.min(1, (vx * fx + vz * fz) / vl))) * 180 / Math.PI;
    if (ang > 40) rep.chair.push({ obj: ch.id, note: `turned ${ang.toFixed(0)} deg away from ${best.t.id}`, dist: +best.d.toFixed(2) });
    else if (best.d > 0.45) rep.chair.push({ obj: ch.id, note: `${best.d.toFixed(2)} m from ${best.t.id}` });
  }

  // ---- 6. wall items
  const mounted = props.filter((o) => o.mounted);
  const rects = [];
  for (const o of mounted) {
    const q = new THREE.Vector3();
    o.node.getWorldDirection(q);
    q.transformDirection(inv);
    const f = [q.x, q.y, q.z];
    const c = [(o.bb[0] + o.bb[3]) / 2, (o.bb[1] + o.bb[4]) / 2, (o.bb[2] + o.bb[5]) / 2];
    let pl = null, pd = Infinity;
    for (const p of planes) {
      if (dot(p.n, f) < 0.9) continue;
      if (p.t0 != null && p.s) { const t = along(p.s, c); if (t < p.t0 - 0.01 || t > p.t1 + 0.01) continue; }
      const dist = dot(p.n, c) - p.d;
      if (dist > -0.3 && dist < pd) { pd = dist; pl = p; }
    }
    if (!pl) { rep.wall.push({ obj: o.id, note: 'faces no wall' }); continue; }
    let back = Infinity;
    for (const p of o.verts) back = Math.min(back, dot(pl.n, p) - pl.d);
    if (back > opt.wallGap) rep.wall.push({ obj: o.id, note: `stands ${(back * 1000).toFixed(0)} mm off the ${pl.side} wall` });
    if (back < -0.005 && !o.node.userData.inset) rep.wall.push({ obj: o.id, note: `sunk ${(-back * 1000).toFixed(0)} mm into the ${pl.side} wall` });
    if (o.bb[4] > Ht + 0.003) rep.wall.push({ obj: o.id, note: `runs ${((o.bb[4] - Ht) * 1000).toFixed(0)} mm into the ceiling` });
    if (o.bb[1] < 0.14 && !/lift/.test(o.name)) rep.wall.push({ obj: o.id, note: `comes down to ${o.bb[1].toFixed(2)} m, over the skirting` });
    if (pl.s) {
      const us = o.verts.map((p) => along(pl.s, p));
      const rc = { o, side: pl.side, u0: Math.min(...us), u1: Math.max(...us), y0: o.bb[1], y1: o.bb[4] };
      rects.push(rc);
      for (const h of holes.filter((q) => q.side === pl.side)) {
        const y0 = h.kind === 'window' ? h.sill - 0.07 : 0, y1 = h.sill + h.height + 0.08;
        const ou = Math.min(rc.u1, h.b + 0.06) - Math.max(rc.u0, h.a - 0.06), oy = Math.min(rc.y1, y1) - Math.max(rc.y0, y0);
        if (ou > 0.005 && oy > 0.005) rep.wall.push({ obj: o.id, note: `over the ${h.kind} at ${h.side}@${h.at} (${(ou * 100).toFixed(0)} x ${(oy * 100).toFixed(0)} cm)` });
      }
    }
    // hidden: rays from its face into the room
    let hit = 0, n = 0;
    for (let a = 0.1; a <= 0.91; a += 0.2) for (let b = 0.1; b <= 0.91; b += 0.2) {
      n++;
      const p0 = [o.bb[0] + (o.bb[3] - o.bb[0]) * a, o.bb[1] + (o.bb[4] - o.bb[1]) * b, o.bb[2] + (o.bb[5] - o.bb[2]) * a];
      const pp = [p0[0] + pl.n[0] * 0.15, p0[1], p0[2] + pl.n[2] * 0.15];
      let blocked = false;
      for (const ob of props) {
        if (ob === o || ob.mounted || ob.hanging || blocked) continue;
        for (const t of ob.tris) {
          // ray pp + s * n, s in (0, 1.0)
          const den = dot(t.n, pl.n);
          if (Math.abs(den) < 1e-6) continue;
          const s = (t.d - dot(t.n, pp)) / den;
          if (s <= 0 || s > 1.0) continue;
          const x = [pp[0] + pl.n[0] * s, pp[1], pp[2] + pl.n[2] * s];
          const e0 = sub(t.b, t.a), e1 = sub(t.c, t.a), e2 = sub(x, t.a);
          const d00 = dot(e0, e0), d01 = dot(e0, e1), d11 = dot(e1, e1), d20 = dot(e2, e0), d21 = dot(e2, e1);
          const dn = d00 * d11 - d01 * d01;
          if (Math.abs(dn) < 1e-14) continue;
          const vv = (d11 * d20 - d01 * d21) / dn, ww = (d00 * d21 - d01 * d20) / dn;
          if (vv >= 0 && ww >= 0 && vv + ww <= 1) { blocked = true; break; }
        }
      }
      if (blocked) hit++;
    }
    if (hit / n > 0.1) rep.wall.push({ obj: o.id, note: `${Math.round(100 * hit / n)}% hidden behind furniture within 1 m` });
  }
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
    const a = rects[i], b = rects[j];
    if (a.side !== b.side) continue;
    const ou = Math.min(a.u1, b.u1) - Math.max(a.u0, b.u0), oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
    if (ou > 0.005 && oy > 0.005) rep.wall.push({ obj: a.o.id, note: `overlaps ${b.o.id} (${(ou * 100).toFixed(0)} x ${(oy * 100).toFixed(0)} cm)` });
  }

  // ---- 7. outside the walls
  const inRecess = (p) => recesses.some((r) => p[0] >= r.x0 - 0.005 && p[0] <= r.x1 + 0.005 && p[2] >= r.z0 - 0.005 && p[2] <= r.z1 + 0.005);
  for (const o of props) {
    if (o.node.userData.inset) continue;      // let into the wall on purpose
    let m = 0, at = null;
    for (const p of o.verts) {
      const e = Math.max(p[0] - W / 2, -W / 2 - p[0], p[2] - D / 2, -D / 2 - p[2], -p[1], p[1] - Ht);
      if (e > m && !inRecess(p)) { m = e; at = p; }
    }
    if (m > 0.005) rep.outside.push({ obj: o.id, by: +(m * 1000).toFixed(0), at: r3(at) });
  }

  // ---- 8. spawns and points inside furniture
  const spots = [];
  for (const [k, s] of Object.entries(room.spawns || {})) spots.push(['spawn ' + k, s.x - room.ox, s.z]);
  for (const [k, p] of Object.entries(room.points || {})) spots.push(['point ' + k, p.x - room.ox, p.z, p.y]);
  // a spot is wrong when a table, desk or counter top covers it; a seat is
  // fine (people are put on chairs and benches); a standing spawn needs its
  // body's width clear
  for (const [name, x, z, y] of spots) {
    const isSpawn = name.startsWith('spawn');
    if (y != null && y > 0.3) continue;  // a point on a table top or a wall: something to look at
    // a point is where an actor or the player is put: a seat is fine for it
    const seated = !isSpawn || /alcove|corner|seat|chair|bench|table|cubicle/.test(name);
    const r = isSpawn && !seated ? 0.2 : 0;
    const ring = r ? [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]] : [[0, 0]];
    const hits = new Set();
    for (const [dx, dz] of ring) {
      for (const t of upTris) {
        const o = t.owner;
        if (o.kind !== 'prop' || o.mounted || o.hanging || /rug|rack|bed|cell_bench/.test(o.name)) continue;
        const px = x + dx, pz = z + dz;
        if (px < t.bb[0] || px > t.bb[3] || pz < t.bb[2] || pz > t.bb[5]) continue;
        const [a, b, c] = [t.a, t.b, t.c];
        const det = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
        if (Math.abs(det) < 1e-12) continue;
        const l1 = ((b[2] - c[2]) * (px - c[0]) + (c[0] - b[0]) * (pz - c[2])) / det;
        const l2 = ((c[2] - a[2]) * (px - c[0]) + (a[0] - c[0]) * (pz - c[2])) / det;
        if (l1 < 0 || l2 < 0 || l1 + l2 > 1) continue;
        const h = l1 * a[1] + l2 * b[1] + (1 - l1 - l2) * c[1];
        if (h > (seated ? 0.62 : 0.05) && h < 1.9) hits.add(o.id + ' (top at ' + h.toFixed(2) + ' m)');
      }
    }
    for (const hId of hits) rep.spawn.push({ spot: name, obj: hId });
    const inside = (Math.abs(x) < W / 2 - 0.2 && Math.abs(z) < D / 2 - 0.2) || recesses.some((r) => x > r.x0 + 0.2 && x < r.x1 - 0.2 && z > r.z0 && z < r.z1);
    if (isSpawn && !inside) rep.spawn.push({ spot: name, obj: 'the walls' });
  }
  for (const o of props) if (o.slid) rep.slid.push({ obj: o.id, from: o.slid.from, to: o.slid.to });
  if (state === 'fallen' && G.interiors.setEngravingFallen) G.interiors.setEngravingFallen(false);
  return rep;
}

// ---------------------------------------------------------------- report
const rooms = await page.evaluate(() => Object.keys(window.G.interiors.rooms));
const todo = [];
for (const id of rooms) {
  if (only.length && !only.includes(id)) continue;
  todo.push([id, null]);
  if (id === 'room') todo.push([id, 'fallen']);
}
const all = [];
let problems = 0;
const line = (s) => console.log('    ' + s);
for (const [id, state] of todo) {
  const t0 = Date.now();
  const r = await page.evaluate(analyseRoom, [id, opt, state]);
  all.push(r);
  const n = r.zfight.length + r.cross.length + r.clear.length + r.window.length + r.support.length + r.chair.length + r.wall.length + r.outside.length + r.spawn.length;
  problems += n;
  console.log(`\n== ${r.id}  ${r.size.join(' x ')} m  ${r.props} props, ${r.objects - r.props} room parts, ${r.tris} tris  (${((Date.now() - t0) / 1000).toFixed(1)}s)  ${n ? n + ' problem(s)' : 'clean'}`);
  if (r.zfight.length) { console.log('  z-fight:'); for (const e of r.zfight) line(`${e.a} ~ ${e.b}  gap ${e.gap} mm  area ${e.area} cm2  facing [${e.n}]  near [${e.at}]`); }
  if (r.unseen.length && flags.unseen) { console.log('  coplanar but facing away from every eye (harmless):'); for (const e of r.unseen) line(`${e.a} ~ ${e.b}  area ${e.area} cm2  facing [${e.n}]  near [${e.at}]`); }
  if (r.info.length) { console.log('  notes:'); for (const e of r.info) line(e); }
  if (r.internal.length && flags.internal) { console.log('  z-fight inside one model:'); for (const e of r.internal) line(`${e.a} ~ ${e.b}  gap ${e.gap} mm  area ${e.area} cm2`); }
  if (r.cross.length) { console.log('  crossing:'); for (const e of r.cross) line(`${e.a} x ${e.b}  crossing ${e.cross} mm (reach ${e.pen} mm, ${e.tris} tri pairs)  near [${e.at}]`); }
  if (r.clear.length) { console.log('  in a door/opening clearance:'); for (const e of r.clear) line(`${e.obj} in ${e.zone}  ${e.area} cm2`); }
  if (r.window.length) { console.log('  blocking a window:'); for (const e of r.window) line(`${e.obj} before window ${e.window}: top ${e.top} m, sill ${e.sill} m`); }
  if (r.support.length) { console.log('  floating / sunk:'); for (const e of r.support) line(`${e.obj} on ${e.on}: ${e.gap > 0 ? 'floats ' + e.gap : 'sunk ' + -e.gap} mm`); }
  if (r.chair.length) { console.log('  chairs:'); for (const e of r.chair) line(`${e.obj}: ${e.note}${e.dist != null ? ' (' + e.dist + ' m)' : ''}`); }
  if (r.wall.length) { console.log('  wall items:'); for (const e of r.wall) line(`${e.obj}: ${e.note}`); }
  if (r.outside.length) { console.log('  outside the walls:'); for (const e of r.outside) line(`${e.obj} by ${e.by} mm near [${e.at}]`); }
  if (r.spawn.length) { console.log('  spawns in furniture:'); for (const e of r.spawn) line(`${e.spot} inside ${e.obj}`); }
  if (r.slid.length) { console.log('  moved out of a doorway by Room.prop (place it there instead):'); for (const e of r.slid) line(`${e.obj} from [${e.from}] to [${e.to}]`); }
}
const roomLogs = [...new Set(logs)].filter((l) => /rooms|pageerror|error/.test(l));
if (roomLogs.length) { console.log('\n--- console ---'); console.log(roomLogs.slice(0, 40).join('\n')); }
console.log(`\n${problems} problem(s) in ${todo.length} room(s)`);
if (flags.json) fs.writeFileSync(flags.json, JSON.stringify(all, null, 1));
await browser.close();
process.exit(problems ? 2 : 0);
