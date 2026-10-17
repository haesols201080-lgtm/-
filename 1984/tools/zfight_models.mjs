// Scans the game's models for faces that z-fight (see zfight_core.cjs): two
// triangles facing the same way, within 3 mm of one plane, overlapping.
//
//   node tools/zfight_models.mjs [flags] [name ...]
//     --same   also check faces that share a material. Such an overlap only
//              shows when the two faces carry different UVs or normals at the
//              spot (box-projected faces of one material look identical, so
//              they cannot flicker); those are listed apart as "same look".
//     --chars  include the skinned char_* people (posed at their bind pose)
//     --opt    scan assets/models_opt, the quantized files the game loads,
//              instead of the Blender output in assets/models
//     --all    print every pair, not only the 8 largest per model
//     --why    under each finding print its largest triangle pair (game
//              coordinates: y up, z = -Blender y) to find the faces in the source
//     --dir=D  scan the .glb files in D instead (e.g. an older copy)
//     --tol=M  plane distance counted as coplanar (default 0.003 m)
//     --min=A  smallest overlap area reported (default 0.0005 m2)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
const require = createRequire(import.meta.url);
const { findCoplanar } = require('./zfight_core.cjs');

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const num = (f, d) => { const a = args.find((s) => s.startsWith(f + '=')); return a ? +a.slice(f.length + 1) : d; };
const SAME = flag('--same'), CHARS = flag('--chars'), OPT = flag('--opt'), ALL = flag('--all'), WHY = flag('--why');
const TOL = num('--tol', 0.003), MIN = num('--min', 5e-4);

const root = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const dirArg = args.find((s) => s.startsWith('--dir='));
const dir = dirArg ? path.resolve(dirArg.slice(6)) : path.join(root, OPT ? 'assets/models_opt' : 'assets/models');
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const picked = args.filter((s) => !s.startsWith('--'));
const names = picked.length ? picked : fs.readdirSync(dir).filter((f) => f.endsWith('.glb')).map((f) => f.slice(0, -4)).sort();

// column-major 4x4 helpers (glTF layout)
const mul = (m, p) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
const mulDir = (m, p) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2], m[1] * p[0] + m[5] * p[1] + m[9] * p[2], m[2] * p[0] + m[6] * p[1] + m[10] * p[2]];
const mm = (a, b) => { const o = new Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; };
const normalMat = (m) => {   // inverse transpose of the upper 3x3, as a 4x4 without translation
  const a = m[0], b = m[4], c = m[8], d = m[1], e = m[5], f = m[9], g = m[2], h = m[6], i = m[10];
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C || 1;
  const inv = [A, -(b * i - c * h), b * f - c * e, B, a * i - c * g, -(a * f - c * d), C, -(a * h - b * g), a * e - b * d].map((v) => v / det);
  // inv is row-major inverse; its transpose in column-major is inv read row-major
  return [inv[0], inv[1], inv[2], 0, inv[3], inv[4], inv[5], 0, inv[6], inv[7], inv[8], 0, 0, 0, 0, 1];
};
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

function triangles(doc) {
  const tris = [], meta = [];
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const skin = node.getSkin();
    const W = node.getWorldMatrix();
    let jointM = null;
    if (skin) {   // bind pose: joint world * inverse bind matrix
      const ibm = skin.getInverseBindMatrices();
      jointM = skin.listJoints().map((j, k) => mm(j.getWorldMatrix(), ibm ? ibm.getElement(k, []) : [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]));
    }
    for (const prim of mesh.listPrimitives()) {
      if (prim.getMode() !== 4) continue;   // triangles only
      const pos = prim.getAttribute('POSITION');
      if (!pos) continue;
      const nrm = prim.getAttribute('NORMAL'), uv = prim.getAttribute('TEXCOORD_0');
      const jo = prim.getAttribute('JOINTS_0'), we = prim.getAttribute('WEIGHTS_0');
      const idx = prim.getIndices();
      const mat = prim.getMaterial();
      const base = node.getName() + ':' + (mat ? mat.getName() : '-');
      const cache = new Map();
      const vert = (vi) => {
        let r = cache.get(vi);
        if (r) return r;
        let M = W;
        if (jointM && jo && we) {
          const j = jo.getElement(vi, []), w = we.getElement(vi, []);
          M = new Array(16).fill(0);
          for (let k = 0; k < 4; k++) if (w[k]) { const J = jointM[j[k]]; for (let q = 0; q < 16; q++) M[q] += w[k] * J[q]; }
        }
        const p = mul(M, pos.getElement(vi, []));
        const n = nrm ? norm(mulDir(normalMat(M), nrm.getElement(vi, []))) : null;
        const t = uv ? uv.getElement(vi, []) : null;
        r = { p, n, t };
        cache.set(vi, r);
        return r;
      };
      const count = idx ? idx.getCount() : pos.getCount();
      for (let i = 0; i + 2 < count; i += 3) {
        const v = [0, 1, 2].map((k) => vert(idx ? idx.getScalar(i + k) : i + k));
        tris.push({ a: v[0].p, b: v[1].p, c: v[2].p, tag: String(tris.length), idx: tris.length });
        meta.push({ base, mat: mat ? mat.getName() : '-', v });
      }
    }
  }
  return { tris, meta };
}

// overlap of two coplanar triangles: the clipped polygon in A's plane basis
// (its centroid, the projection, and the polygon with A's normal and offset)
function overlapCentroid(A, B) {
  const P = [A.a, A.b, A.c], Q = [B.a, B.b, B.c];
  const u = [P[1][0] - P[0][0], P[1][1] - P[0][1], P[1][2] - P[0][2]], w = [P[2][0] - P[0][0], P[2][1] - P[0][1], P[2][2] - P[0][2]];
  const n = norm([u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]);
  const e1 = norm(Math.abs(n[0]) < 0.9 ? [0, n[2], -n[1]] : [-n[2], 0, n[0]]);
  const e2 = [n[1] * e1[2] - n[2] * e1[1], n[2] * e1[0] - n[0] * e1[2], n[0] * e1[1] - n[1] * e1[0]];
  const pr = (p) => [p[0] * e1[0] + p[1] * e1[1] + p[2] * e1[2], p[0] * e2[0] + p[1] * e2[1] + p[2] * e2[2]];
  const ar = (t) => { let s = 0; for (let i = 0; i < t.length; i++) { const p = t[i], q = t[(i + 1) % t.length]; s += p[0] * q[1] - q[0] * p[1]; } return s / 2; };
  const ccw = (t) => (ar(t) < 0 ? [t[0], t[2], t[1]] : t);
  const a2 = ccw(P.map(pr)), b2 = ccw(Q.map(pr));
  let poly = a2;
  for (let k = 0; k < 3 && poly.length; k++) {
    const s = b2[k], t = b2[(k + 1) % 3], res = [];
    const side = (p) => (t[0] - s[0]) * (p[1] - s[1]) - (t[1] - s[1]) * (p[0] - s[0]);
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length], sp = side(p), sq = side(q);
      if (sp >= 0) res.push(p);
      if ((sp >= 0) !== (sq >= 0)) { const f = sp / (sp - sq); res.push([p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f]); }
    }
    poly = res;
  }
  if (poly.length < 3) return null;
  let cx = 0, cy = 0;
  for (const p of poly) { cx += p[0]; cy += p[1]; }
  const r = [cx / poly.length, cy / poly.length, pr];
  r.poly = poly; r.n = n; r.e = [e1, e2]; r.d = n[0] * P[0][0] + n[1] * P[0][1] + n[2] * P[0][2];
  return r;
}
// How far apart are the two planes where the triangles overlap? The core
// compares plane offsets measured at the origin, which for planes a degree or
// two apart says nothing about the overlap 10 m out; measure along A's normal
// at each corner of the overlap. Returns the smallest |distance| (0 when the
// planes cross inside the overlap).
function separation(A, B) {
  const c = overlapCentroid(A, B);
  if (!c) return Infinity;
  const u = [B.b[0] - B.a[0], B.b[1] - B.a[1], B.b[2] - B.a[2]], w = [B.c[0] - B.a[0], B.c[1] - B.a[1], B.c[2] - B.a[2]];
  const nb = norm([u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]);
  const db = nb[0] * B.a[0] + nb[1] * B.a[1] + nb[2] * B.a[2];
  const n = c.n, [e1, e2] = c.e, k = nb[0] * n[0] + nb[1] * n[1] + nb[2] * n[2];
  let lo = Infinity, hi = -Infinity;
  for (const [x, y] of c.poly) {
    const X = [0, 1, 2].map((i) => x * e1[i] + y * e2[i] + c.d * n[i]);
    const t = (db - (nb[0] * X[0] + nb[1] * X[1] + nb[2] * X[2])) / k;
    lo = Math.min(lo, t); hi = Math.max(hi, t);
  }
  return lo <= 0 && hi >= 0 ? 0 : Math.min(Math.abs(lo), Math.abs(hi));
}
// barycentric weights of a 2D point in a projected triangle
function bary(T, pr, c) {
  const [a, b, d] = [T.a, T.b, T.c].map(pr);
  const v0 = [b[0] - a[0], b[1] - a[1]], v1 = [d[0] - a[0], d[1] - a[1]], v2 = [c[0] - a[0], c[1] - a[1]];
  const den = v0[0] * v1[1] - v1[0] * v0[1] || 1e-12;
  const y = (v2[0] * v1[1] - v1[0] * v2[1]) / den, z = (v0[0] * v2[1] - v2[0] * v0[1]) / den;
  return [1 - y - z, y, z];
}
const lerp = (vs, key, wts) => {
  if (!vs[0][key]) return null;
  const n = vs[0][key].length, o = new Array(n).fill(0);
  for (let k = 0; k < 3; k++) for (let i = 0; i < n; i++) o[i] += vs[k][key][i] * wts[k];
  return o;
};
// do the two faces look the same where they overlap (same material, UV, normal)?
function sameLook(tA, mA, tB, mB) {
  if (mA.mat !== mB.mat) return false;
  const c = overlapCentroid(tA, tB);
  if (!c) return true;
  const wa = bary(tA, c[2], c), wb = bary(tB, c[2], c);
  const ua = lerp(mA.v, 't', wa), ub = lerp(mB.v, 't', wb);
  if (ua && ub && Math.hypot(ua[0] - ub[0], ua[1] - ub[1]) > 2e-3) return false;
  const na = lerp(mA.v, 'n', wa), nb = lerp(mB.v, 'n', wb);
  // within 3.6 deg the shading differs by a fraction of a percent: two faces
  // of one texture crossing that shallowly show no seam worth the name
  if (na && nb) { const x = norm(na), y = norm(nb); if (x[0] * y[0] + x[1] * y[1] + x[2] * y[2] < 0.998) return false; }
  return true;
}

let flagged = 0;
for (const name of names) {
  if (name.startsWith('char_') && !CHARS && !picked.length) continue;   // layered clothes are offset on purpose
  const file = path.join(dir, name + '.glb');
  if (!fs.existsSync(file)) { console.log(`${name}: no ${path.relative(root, file)}`); continue; }
  const doc = await io.read(file);
  const { tris, meta } = triangles(doc);
  const pairs = findCoplanar(tris, { sameTag: true, tol: TOL, minArea: 1e-12 });
  const groups = new Map();
  for (const r of pairs) {
    const ia = +r.tagA, ib = +r.tagB, mA = meta[ia], mB = meta[ib];
    if (mA.base === mB.base && !SAME) continue;
    const sep = separation(tris[ia], tris[ib]);
    if (sep > TOL) continue;   // nearly parallel but never this close where they overlap
    r.gap = sep;
    if (mA.mat === mB.mat && mA.base !== mB.base && !SAME && sameLook(tris[ia], mA, tris[ib], mB)) continue;
    const look = mA.mat === mB.mat && sameLook(tris[ia], mA, tris[ib], mB);
    const bases = [mA.base, mB.base].sort();
    const key = bases.join(' | ') + (look ? ' same' : '');
    let g = groups.get(key);
    if (!g) groups.set(key, g = { tagA: bases[0], tagB: bases[1], look, gap: 1, area: 0, best: 0, at: null });
    g.area += r.area; g.gap = Math.min(g.gap, r.gap);
    if (r.area > g.best) { g.best = r.area; g.at = r.at; g.pair = [ia, ib]; }
  }
  const list = [...groups.values()].filter((g) => g.area >= MIN).sort((a, b) => a.look - b.look || b.area - a.area);
  const shown = list.filter((g) => !g.look), hidden = list.filter((g) => g.look);
  if (!shown.length && !hidden.length) continue;
  if (shown.length) flagged++;
  console.log(`${name} (${tris.length} tris)`);
  const fmt = (t) => [t.a, t.b, t.c].map((p) => '(' + p.map((v) => v.toFixed(3)).join(',') + ')').join(' ');
  for (const g of ALL ? shown : shown.slice(0, 8)) {
    console.log(`   ${g.tagA}  ~  ${g.tagB}  gap ${(g.gap * 1000).toFixed(1)}mm  area ${g.area.toFixed(3)}m2  near ${g.at}`);
    if (WHY) for (const i of g.pair) console.log(`      ${meta[i].base}  ${fmt(tris[i])}`);
  }
  if (shown.length > 8 && !ALL) console.log(`   ... ${shown.length - 8} more (--all)`);
  if (hidden.length) {
    const a = hidden.reduce((s, g) => s + g.area, 0);
    console.log(`   same look (invisible): ${hidden.map((g) => g.tagA === g.tagB ? g.tagA : g.tagA + '~' + g.tagB).join(', ')}  ${a.toFixed(3)}m2`);
  }
}
console.log(flagged ? `${flagged} model(s) with visible z-fighting` : 'no visible z-fighting');
