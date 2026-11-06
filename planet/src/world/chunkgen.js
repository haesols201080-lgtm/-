// Generation jobs shared by the workers and the main thread:
//  - terrain chunk geometry data for any quadtree level
//  - deterministic prop placement (rocks, trees, crystals, ores, deposits,
//    crater ice, points of interest) per 512 m cell
//  - overview map samples
import { WorldGen, PLANET } from './worldgen.js';
import { mulberry32, hash2, clamp, smoothstep } from '../core/noise.js';
import { pickTreeSpecies } from './treespecies.js';

export const CHUNK_N = 64;          // cells per chunk side at every level
export const L0_SIZE = 128;         // metres per level-0 chunk (2 m cells)
export const PROP_CELL = 512;

export function chunkSize(L) { return L0_SIZE * (1 << L); }

export function genChunk(gen, edits, L, ix, iz) {
  const n = CHUNK_N, size = chunkSize(L), cell = size / n;
  const x0 = -PLANET.HALF + ix * size, z0 = -PLANET.HALF + iz * size;
  const B = n + 3;
  const H = new Float32Array(B * B);
  const V = n + 1;
  const surf = new Uint8Array(V * V * 8);
  const heights = new Float32Array(V * V);
  const tmp = new Float32Array(8);
  const res = { mod: 0 };
  for (let j = -1; j <= n + 1; j++) {
    const z = z0 + j * cell;
    for (let i = -1; i <= n + 1; i++) {
      const x = x0 + i * cell;
      const inner = i >= 0 && i <= n && j >= 0 && j <= n;
      let h = gen.sample(x, z, inner ? tmp : null);
      h = edits.apply(x, z, h, res);
      H[(j + 1) * B + (i + 1)] = h;
      if (inner) {
        const k = j * V + i;
        heights[k] = h;
        const o = k * 8;
        for (let c = 0; c < 7; c++) surf[o + c] = tmp[c] * 255;
        surf[o + 7] = res.mod * 255;
      }
    }
  }
  // ring of skirt vertices
  const ring = ringIndices(n);
  const count = V * V + ring.length;
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  const sv = new Uint8Array(count * 8);
  sv.set(surf);
  let p = 0;
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
    const h = H[(j + 1) * B + (i + 1)];
    pos[p * 3] = x0 + i * cell; pos[p * 3 + 1] = h; pos[p * 3 + 2] = z0 + j * cell;
    const dx = H[(j + 1) * B + i] - H[(j + 1) * B + i + 2];
    const dz = H[j * B + i + 1] - H[(j + 2) * B + i + 1];
    const l = Math.hypot(dx, 2 * cell, dz);
    nor[p * 3] = dx / l; nor[p * 3 + 1] = 2 * cell / l; nor[p * 3 + 2] = dz / l;
    p++;
  }
  const skirt = 1.5 + cell * 1.5;
  for (let k = 0; k < ring.length; k++) {
    const s = ring[k];
    pos[p * 3] = pos[s * 3]; pos[p * 3 + 1] = pos[s * 3 + 1] - skirt; pos[p * 3 + 2] = pos[s * 3 + 2];
    nor[p * 3] = nor[s * 3]; nor[p * 3 + 1] = nor[s * 3 + 1]; nor[p * 3 + 2] = nor[s * 3 + 2];
    sv.copyWithin(p * 8, s * 8, s * 8 + 8);
    p++;
  }
  let minY = Infinity, maxY = -Infinity;
  for (let k = 0; k < V * V; k++) { if (heights[k] < minY) minY = heights[k]; if (heights[k] > maxY) maxY = heights[k]; }
  return { L, ix, iz, pos, nor, surf: sv, heights, tileSurf: surf, minY, maxY };
}

const ringCache = new Map();
export function ringIndices(n) {
  if (ringCache.has(n)) return ringCache.get(n);
  const V = n + 1, ring = [];
  for (let i = 0; i < V; i++) ring.push(i);
  for (let j = 1; j < V; j++) ring.push(j * V + n);
  for (let i = n - 1; i >= 0; i--) ring.push(n * V + i);
  for (let j = n - 1; j >= 1; j--) ring.push(j * V);
  ringCache.set(n, ring);
  return ring;
}

export function chunkIndex(n) {
  const V = n + 1, idx = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const a = j * V + i, b = a + 1, c = a + V, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const ring = ringIndices(n), base = V * V;
  for (let k = 0; k < ring.length; k++) {
    const a = ring[k], b = ring[(k + 1) % ring.length];
    const sa = base + k, sb = base + ((k + 1) % ring.length);
    idx.push(a, b, sa, b, sb, sa);
  }
  return new Uint32Array(idx);
}

// ------------------------------------------------------------------ props
export const ORE_KEYS = ['iron', 'silicon', 'titanium', 'aluminium', 'cobalt', 'ice', 'uranium'];

function surfAt(gen, edits, x, z, tmp, res) {
  let h = gen.sample(x, z, tmp);
  h = edits.apply(x, z, h, res);
  return h;
}

function slopeAt(gen, x, z, h) {
  const hx = gen.sample(x + 2, z), hz = gen.sample(x, z + 2);
  const dx = hx - h, dz = hz - h;
  return 1 - 2 / Math.sqrt(dx * dx + 4 + dz * dz);
}

function pickOre(rnd, s, h, z) {
  const w = [
    1.0 + (1 - s[0]) * 0.4,                 // iron
    0.7 + s[0] * 1.2 + s[5] * 0.8,          // silicon
    0.25 + s[2] * 1.4 + s[1] * 0.4,         // titanium
    0.15 + s[0] * 0.5 + s[2] * 0.4 + s[5] * 0.6, // aluminium
    s[1] * 1.3 + s[6] * 0.4,                // cobalt
    (h < -5 ? 0.8 : 0) + s[4] * 2.5 + (Math.abs(z) > 4500 ? 0.6 : 0), // ice
    s[6] * 1.6 + s[1] * 0.15,               // uranium
  ];
  let tot = 0;
  for (const v of w) tot += v;
  let r = rnd() * tot;
  for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) return ORE_KEYS[i]; }
  return 'iron';
}

function rockTint(s, v) {
  let c = [0.46, 0.33, 0.26];
  const mix = (b, t) => { c = c.map((k, i) => k + (b[i] - k) * t); };
  mix([0.58, 0.46, 0.36], s[0] * 0.6);
  mix([0.64, 0.43, 0.3], s[2]);
  mix([0.16, 0.14, 0.14], s[1]);
  mix([0.62, 0.64, 0.68], s[4] * 0.7);
  mix([0.7, 0.68, 0.64], s[5] * 0.6);
  mix([0.38, 0.33, 0.42], s[6] * 0.7);
  return c.map((k) => k * v);
}

// Points of interest placed near the landing site so early exploration pays off.
const START_POI = [
  { kind: 'wreck', x: 260, z: -190 }, { kind: 'cache', x: -150, z: 120 }, { kind: 'ruin', x: -620, z: 540 },
  { kind: 'wreck', x: 980, z: 360 }, { kind: 'ruin', x: 1300, z: -900 }, { kind: 'cache', x: 420, z: 700 },
];
const START_DEPOSITS = [['iron', 70, -40], ['silicon', -80, 60], ['titanium', 140, 130], ['iron', -160, -110], ['silicon', 190, -150], ['aluminium', -60, -230], ['cobalt', 420, -60], ['ice', -380, 300]];
const START_ORES = [[25, 30, 'iron'], [-30, 40, 'silicon'], [45, -20, 'iron'], [-50, -25, 'silicon'], [60, 60, 'titanium'], [-70, 70, 'iron'], [80, -60, 'silicon'], [-20, -75, 'aluminium'], [100, 10, 'titanium'], [-110, 0, 'iron'], [30, 110, 'silicon'], [5, -120, 'iron'], [140, -40, 'cobalt'], [-140, 80, 'titanium']];

export function genProps(gen, edits, ci, cj) {
  const x0 = ci * PROP_CELL, z0 = cj * PROP_CELL;
  const rnd = mulberry32(((hash2(ci, cj, 777) * 4294967296) >>> 0) || 1);
  const tmp = new Float32Array(8);
  const res = { mod: 0 };
  const S = gen.S;
  const out = { ci, cj, rocks: [], trees: [], crystals: [], ores: [], deposits: [], ice: [], pois: [] };
  const inWorld = (x, z) => Math.abs(x) < PLANET.HALF - 200 && Math.abs(z) < PLANET.HALF - 200;
  const nearStart = (x, z, r) => x * x + z * z < r * r;

  // rocks
  const RS = 10;
  for (let z = z0; z < z0 + PROP_CELL; z += RS) for (let x = x0; x < x0 + PROP_CELL; x += RS) {
    const r0 = rnd();
    const px = x + rnd() * RS, pz = z + rnd() * RS;
    const r1 = rnd(), r2 = rnd(), r3 = rnd(), r4 = rnd(), r5 = rnd();
    if (r0 > 0.3 || !inWorld(px, pz)) continue;
    const h = surfAt(gen, edits, px, pz, tmp, res);
    if (res.mod > 0.3) continue;
    const cl = S.fbm2(px / 160, pz / 160, 2) * 0.5 + 0.5;
    let p = 0.02 + 0.07 * tmp[2] + 0.08 * tmp[1] + 0.04 * (1 - tmp[0]) + 0.04 * tmp[4] + 0.06 * tmp[6] - 0.03 * tmp[5];
    p *= 0.35 + 1.6 * cl * cl;
    if (nearStart(px, pz, 22)) p *= 0.2;
    if (r0 > p) continue;
    const sl = slopeAt(gen, px, pz, h);
    let proto = r1 < 0.3 ? 1 : r1 < 0.65 ? 0 : 3;
    let s = 0.6 + 4.2 * Math.pow(r2, 3.0) + sl * 3;
    if ((tmp[2] > 0.4 || tmp[6] > 0.4) && r3 < 0.015) { proto = 2; s = 1.5 + r4 * 3.5; }
    if (tmp[1] > 0.5 && r3 > 0.85) s *= 1.6;
    const tint = rockTint(tmp, 0.85 + r5 * 0.3);
    out.rocks.push(px, h - s * (proto === 2 ? 0.1 : 0.25), pz, s * (0.8 + r3 * 0.4), s * (0.7 + r4 * 0.6), s * (0.8 + r5 * 0.4), r4 * 6.28, (r5 - 0.5) * 0.35, (r3 - 0.5) * 0.35, proto, tint[0], tint[1], tint[2]);
  }

  // trees (grow with terraforming; placed now, revealed by growth threshold)
  const TS = 12;
  for (let z = z0; z < z0 + PROP_CELL; z += TS) for (let x = x0; x < x0 + PROP_CELL; x += TS) {
    const r0 = rnd();
    const px = x + rnd() * TS, pz = z + rnd() * TS;
    const r1 = rnd(), r2 = rnd(), r3 = rnd();
    if (r0 > 0.55 || !inWorld(px, pz)) continue;
    const forest = S.fbm2(px / 260 + 9, pz / 260, 3) * 0.5 + 0.5;
    if (forest < 0.38) continue;
    const h = surfAt(gen, edits, px, pz, tmp, res);
    if (h < 1.5 || res.mod > 0.2 || tmp[4] > 0.5 || tmp[5] > 0.6) continue;
    if (nearStart(px, pz, 70)) continue;
    const f = tmp[3];
    const p = smoothstep(0.35, 0.85, f * 0.6 + forest * 0.6) * 0.7;
    if (r0 > p) continue;
    const sl = slopeAt(gen, px, pz, h);
    if (sl > 0.28) continue;
    // species from the site; neighbours share a species often (groves)
    const grove = S.fbm2(px / 90 - 3, pz / 90 + 5, 2) * 0.5 + 0.5;
    const si = pickTreeSpecies((r1 * 0.55 + grove * 0.45) % 1, h, pz / PLANET.HALF, tmp);
    const thr = clamp(1 - f * 0.8 - forest * 0.3 + (r2 - 0.5) * 0.3 + 0.15, 0.02, 1);
    out.trees.push(px, h - 0.1, pz, 0.7 + r3 * 0.55, r2 * 6.28, thr, si, rnd());
  }

  // crystals
  for (let k = 0; k < 40; k++) {
    const px = x0 + rnd() * PROP_CELL, pz = z0 + rnd() * PROP_CELL;
    const r1 = rnd(), r2 = rnd();
    if (!inWorld(px, pz)) continue;
    const h = surfAt(gen, edits, px, pz, tmp, res);
    const pc = tmp[6] * 0.9 + tmp[1] * 0.08;
    if (r1 > pc) continue;
    const warm = tmp[1] > tmp[6];
    const c = warm ? [1.0, 0.45, 0.15] : r2 < 0.6 ? [0.25, 0.85, 1.0] : [0.75, 0.35, 1.0];
    out.crystals.push(px, h - 0.3, pz, 0.8 + Math.pow(r2, 2) * 4.5, r1 * 6.28, c[0], c[1], c[2]);
  }

  // ore pickup clusters
  const clusters = 7;
  let oid = 0;
  const addCluster = (cx, cz, type, n) => {
    for (let k = 0; k < n; k++) {
      const px = cx + (rnd() - 0.5) * 12, pz = cz + (rnd() - 0.5) * 12;
      const s1 = rnd(), s2 = rnd();
      if (!inWorld(px, pz)) continue;
      const h = surfAt(gen, edits, px, pz, tmp, res);
      if (h < -400 || slopeAt(gen, px, pz, h) > 0.45) continue;
      out.ores.push({ id: ci + ':' + cj + ':' + (oid++), type, x: px, y: h, z: pz, s: 0.8 + s1 * 0.5, rot: s2 * 6.28 });
    }
  };
  for (let c = 0; c < clusters; c++) {
    const cx = x0 + rnd() * PROP_CELL, cz = z0 + rnd() * PROP_CELL;
    const n = 3 + Math.floor(rnd() * 5);
    if (!inWorld(cx, cz)) continue;
    const h = surfAt(gen, edits, cx, cz, tmp, res);
    addCluster(cx, cz, pickOre(rnd, tmp, h, cz), n);
  }
  for (const [sx, sz, type] of START_ORES) if (sx >= x0 && sx < x0 + PROP_CELL && sz >= z0 && sz < z0 + PROP_CELL) addCluster(sx, sz, type, 4);

  // resource deposits for extractors
  const flatSpot = (bx, bz, spread) => {
    let best = null, bs = 9;
    for (let k = 0; k < 14; k++) {
      const x = bx + (rnd() - 0.5) * spread, z = bz + (rnd() - 0.5) * spread;
      const h = gen.sample(x, z);
      const s = slopeAt(gen, x, z, h) + Math.abs(gen.sample(x - 3, z) - h) * 0.02;
      if (s < bs) { bs = s; best = [x, z]; }
    }
    return best;
  };
  const dn = rnd() < 0.5 ? 1 : 2;
  for (let d = 0; d < dn; d++) {
    const sp = flatSpot(x0 + 60 + rnd() * (PROP_CELL - 120), z0 + 60 + rnd() * (PROP_CELL - 120), 60);
    if (!sp || !inWorld(sp[0], sp[1])) continue;
    const h = surfAt(gen, edits, sp[0], sp[1], tmp, res);
    if (h < -300) continue;
    out.deposits.push({ id: 'd:' + ci + ':' + cj + ':' + d, type: pickOre(rnd, tmp, h, sp[1]), x: sp[0], y: h, z: sp[1] });
  }
  START_DEPOSITS.forEach(([type, sx, sz], k) => {
    if (sx >= x0 && sx < x0 + PROP_CELL && sz >= z0 && sz < z0 + PROP_CELL) {
      const sp = flatSpot(sx, sz, 30);
      out.deposits.push({ id: 's:' + k, type, x: sp[0], y: gen.sample(sp[0], sp[1]), z: sp[1] });
    }
  });

  // rock formations: tors, fins and boulder piles on crests, slopes and
  // escarpment edges (never on flats, sand, salt, roads or the landing site)
  const FS = 44;
  for (let z = z0; z < z0 + PROP_CELL; z += FS) for (let x = x0; x < x0 + PROP_CELL; x += FS) {
    const r0 = rnd(), px = x + rnd() * FS, pz = z + rnd() * FS, r1 = rnd(), r2 = rnd(), r3 = rnd();
    if (!inWorld(px, pz)) continue;
    const fn = S.fbm2(px / 420 - 7, pz / 420 + 3, 2) * 0.5 + 0.5;
    if (r0 > 0.1 + 0.55 * smoothstep(0.5, 0.82, fn)) continue;
    if (nearStart(px, pz, 140)) continue;
    const h = surfAt(gen, edits, px, pz, tmp, res);
    if (res.mod > 0.15 || h < -2 || tmp[0] > 0.45 || tmp[5] > 0.4) continue;
    const sl = slopeAt(gen, px, pz, h);
    if (sl < 0.07 || sl > 1.6) continue;
    const n = 2 + Math.floor(r1 * 5);
    const big = 2.8 + r2 * r2 * 8 + Math.min(sl, 0.8) * 4;
    const tint = rockTint(tmp, 0.8 + r3 * 0.25);
    for (let k = 0; k < n; k++) {
      const a = rnd() * 6.283, d = k === 0 ? 0 : big * (0.45 + rnd() * 0.85);
      const qx = px + Math.cos(a) * d, qz = pz + Math.sin(a) * d;
      const qh = surfAt(gen, edits, qx, qz, tmp, res);
      if (res.mod > 0.15) continue;
      const sz = big * (k === 0 ? 1 : 0.3 + rnd() * 0.45);
      const proto = k === 0 ? (r3 < 0.5 ? 5 : 3) : (rnd() < 0.55 ? 5 : 0);
      out.rocks.push(qx, qh - sz * 0.3, qz, sz * (0.85 + rnd() * 0.3), sz * (0.75 + rnd() * 0.45), sz * (0.85 + rnd() * 0.3), rnd() * 6.28, (rnd() - 0.5) * 0.35, (rnd() - 0.5) * 0.35, proto, tint[0], tint[1], tint[2]);
    }
  }

  // giant rock masses (15-35 m): weathered buttes and boulders that frame the
  // view, mostly at the foot of escarpments and in rough country
  const GS = 128;
  for (let z = z0; z < z0 + PROP_CELL; z += GS) for (let x = x0; x < x0 + PROP_CELL; x += GS) {
    const r0 = rnd(), px = x + rnd() * GS, pz = z + rnd() * GS, r1 = rnd(), r2 = rnd(), r3 = rnd();
    if (!inWorld(px, pz) || nearStart(px, pz, 260)) continue;
    const h = surfAt(gen, edits, px, pz, tmp, res);
    if (res.mod > 0.1 || h < -4 || tmp[0] > 0.5 || tmp[5] > 0.3 || tmp[4] > 0.6) continue;
    const sl = slopeAt(gen, px, pz, h);
    const want = 0.12 + 0.5 * tmp[2] + 0.3 * smoothstep(0.15, 0.6, sl);
    if (r0 > want * 0.55) continue;
    const big = 13 + r1 * r1 * 24;
    const tint = rockTint(tmp, 0.85 + r3 * 0.2);
    const proto = r2 < 0.45 ? 3 : r2 < 0.75 ? 5 : 0;
    out.rocks.push(px, h - big * 0.32, pz, big * (0.9 + r3 * 0.4), big * (0.55 + r2 * 0.45), big * (0.85 + r1 * 0.35), r3 * 6.28, (r2 - 0.5) * 0.2, (r1 - 0.5) * 0.2, proto, tint[0], tint[1], tint[2]);
  }

  // crater ice sheets
  const CC = 520;
  for (let b = Math.floor(z0 / CC) - 1; b <= Math.floor((z0 + PROP_CELL) / CC) + 1; b++)
    for (let a = Math.floor(x0 / CC) - 1; a <= Math.floor((x0 + PROP_CELL) / CC) + 1; a++) {
      const c = gen.craterCell(a, b);
      if (!c || !c.ice || c.R < 45) continue;
      if (c.x < x0 || c.x >= x0 + PROP_CELL || c.z < z0 || c.z >= z0 + PROP_CELL) continue;
      let minH = Infinity;
      for (let k = 0; k < 12; k++) { const an = k / 12 * 6.283; minH = Math.min(minH, gen.sample(c.x + Math.cos(an) * c.R * 0.12, c.z + Math.sin(an) * c.R * 0.12)); }
      minH = Math.min(minH, gen.sample(c.x, c.z));
      const level = minH + Math.min(2.5, c.D * 0.08 + 0.6);
      let rad = 0;
      for (let r = 2; r < c.R; r += Math.max(1, c.R / 60)) {
        let under = true;
        for (let k = 0; k < 12; k++) { const an = k / 12 * 6.283; if (gen.sample(c.x + Math.cos(an) * r, c.z + Math.sin(an) * r) > level) { under = false; break; } }
        if (!under) break;
        rad = r;
      }
      if (rad > 6) out.ice.push({ x: c.x, z: c.z, level, r: rad + Math.max(2, c.R * 0.04) });
    }

  // points of interest: wrecks, supply caches, alien ruins
  if (rnd() < 0.16 && !(Math.abs(ci) <= 1 && Math.abs(cj) <= 1)) {
    const sp = flatSpot(x0 + 100 + rnd() * 300, z0 + 100 + rnd() * 300, 80);
    if (sp && inWorld(sp[0], sp[1])) {
      const h = gen.sample(sp[0], sp[1]);
      if (h > -250) {
        const kinds = ['wreck', 'wreck', 'cache', 'ruin', 'probe', 'geode'];
        out.pois.push({ id: 'p:' + ci + ':' + cj, kind: kinds[Math.floor(rnd() * kinds.length)], x: sp[0], y: h, z: sp[1], rot: rnd() * 6.28 });
      }
    }
  }
  START_POI.forEach((p, k) => {
    if (p.x >= x0 && p.x < x0 + PROP_CELL && p.z >= z0 && p.z < z0 + PROP_CELL) {
      const sp = flatSpot(p.x, p.z, 40);
      out.pois.push({ id: 'sp:' + k, kind: p.kind, x: sp[0], y: gen.sample(sp[0], sp[1]), z: sp[1], rot: k * 1.3 });
    }
  });
  out.rocks = new Float32Array(out.rocks);
  out.trees = new Float32Array(out.trees);
  out.crystals = new Float32Array(out.crystals);
  return out;
}

// overview map: heights + dominant province on a grid
export function genMap(gen, size, row0, row1) {
  const H = new Float32Array(size * (row1 - row0));
  const P = new Uint8Array(size * (row1 - row0) * 4);
  const tmp = new Float32Array(8);
  const step = PLANET.HALF * 2 / size;
  for (let j = row0; j < row1; j++) for (let i = 0; i < size; i++) {
    const x = -PLANET.HALF + (i + 0.5) * step, z = -PLANET.HALF + (j + 0.5) * step;
    const k = (j - row0) * size + i;
    H[k] = gen.sample(x, z, tmp);
    P[k * 4] = tmp[0] * 255; P[k * 4 + 1] = tmp[1] * 255; P[k * 4 + 2] = Math.max(tmp[2], tmp[6]) * 255; P[k * 4 + 3] = Math.max(tmp[4], tmp[5]) * 255;
  }
  return { H, P, row0, row1 };
}

export { WorldGen };
