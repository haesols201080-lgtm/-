// Forest-floor species that the scanned set lacks, grown procedurally (no textures, so they cost nothing to download):
//   wavy hair-grass  (Deschampsia flexuosa)  hair-fine arching tufts with purple-silver panicles, dry ground under pines
//   wood sedge       (Carex sylvatica)        keeled bright leaves arching to the ground, drooping spikes, damp shade
//   hairy wood-rush  (Luzula pilosa)          low rosettes of broad flat leaves, pale margins, brown flower umbels
//   wood horsetail   (Equisetum sylvaticum)   jointed stems with whorls of drooping branches, wet margins
//   bilberry         (Vaccinium myrtillus)    knee-high (robot-high) shrublets of small oval leaves, a few blue berries
// Every plant is a small mesh with vertex colours (base to tip, per blade); they are instanced like the scanned plants.
import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const col = (hex) => new THREE.Color(hex);                // sRGB hex -> linear working colour
const mix = (a, b, t) => a.clone().lerp(b, t);

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

class Mesh {
  constructor() { this.p = []; this.n = []; this.c = []; this.i = []; }
  v(p, n, c) { this.p.push(p.x, p.y, p.z); this.n.push(n.x, n.y, n.z); this.c.push(c.r, c.g, c.b); return this.p.length / 3 - 1; }
  t(a, b, c) { this.i.push(a, b, c); }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setIndex(this.i);
    g.computeBoundingBox(); g.computeBoundingSphere();
    return g;
  }
}

// A leaf blade / stem as a ribbon along a drooping arc. base: start point; az: compass direction it leans to;
// tilt: start angle from vertical; bend: extra angle gained by the tip (droop); width profile tapers to a point.
// fold > 0 gives a keeled (V) cross-section; colour runs from c0 at the base to c1 at the tip, edges can be paler.
function blade(m, { base, az, tilt, bend, len, width, seg = 5, fold = 0, c0, c1, edge = null, tipDry = 0, dry = null, twist = 0, taper = 0.3 }) {
  const dir = new THREE.Vector3(Math.cos(az), 0, Math.sin(az));
  const side0 = new THREE.Vector3(-dir.z, 0, dir.x);
  const p = base.clone();
  let prev = null;
  const step = len / seg;
  for (let k = 0; k <= seg; k++) {
    const t = k / seg;
    const th = tilt + bend * Math.pow(t, 1.6);
    const tan = dir.clone().multiplyScalar(Math.sin(th)).addScaledVector(UP, Math.cos(th)).normalize();
    const tw = twist * t;
    const side = side0.clone().applyAxisAngle(tan, tw);
    const face = new THREE.Vector3().crossVectors(side, tan).normalize();
    if (face.y < 0) face.negate();
    const w = width * (t > 1 - taper ? Math.pow((1 - t) / taper, 0.8) : 1) * (0.75 + 0.25 * Math.min(1, t * 6));
    let c = mix(c0, c1, t);
    if (dry && t > 1 - tipDry) c = mix(c, dry, (t - (1 - tipDry)) / tipDry);
    const nUp = face.clone().lerp(UP, 0.55).normalize();
    let row;
    if (fold > 0) {
      const mid = p.clone().addScaledVector(face, fold * w);
      const ce = edge ? mix(c, edge, 0.6) : c;
      row = [m.v(p.clone().addScaledVector(side, -w / 2), nUp.clone().addScaledVector(side, -0.3).normalize(), ce), m.v(mid, nUp, c),
        m.v(p.clone().addScaledVector(side, w / 2), nUp.clone().addScaledVector(side, 0.3).normalize(), ce)];
    } else {
      row = [m.v(p.clone().addScaledVector(side, -w / 2), nUp, c), m.v(p.clone().addScaledVector(side, w / 2), nUp, c)];
    }
    if (prev) for (let j = 0; j < row.length - 1; j++) { m.t(prev[j], prev[j + 1], row[j + 1]); m.t(prev[j], row[j + 1], row[j]); }
    prev = row;
    p.addScaledVector(tan, step);
  }
  return p;   // the tip
}

// a thin round stem between two points (n-sided prism, for horsetail and shrub twigs)
function stem(m, a, b, r0, r1, c0, c1, sides = 4) {
  const ax = b.clone().sub(a).normalize();
  const u = Math.abs(ax.y) < 0.9 ? new THREE.Vector3().crossVectors(ax, UP).normalize() : new THREE.Vector3(1, 0, 0);
  const v = new THREE.Vector3().crossVectors(ax, u);
  const ring = (p, r, c) => Array.from({ length: sides }, (_, i) => {
    const an = (i / sides) * Math.PI * 2, n = u.clone().multiplyScalar(Math.cos(an)).addScaledVector(v, Math.sin(an));
    return m.v(p.clone().addScaledVector(n, r), n, c);
  });
  const A = ring(a, r0, c0), B = ring(b, r1, c1);
  for (let i = 0; i < sides; i++) { const j = (i + 1) % sides; m.t(A[i], A[j], B[j]); m.t(A[i], B[j], B[i]); }
}

// an oval leaf on a short stalk, folded a little along the midrib
function leaf(m, at, dir, len, wid, c, rib, fold = 0.25) {
  const d = dir.clone().normalize();
  const s = new THREE.Vector3().crossVectors(d, UP); if (s.lengthSq() < 1e-6) s.set(1, 0, 0); s.normalize();
  const n = new THREE.Vector3().crossVectors(s, d).normalize(); if (n.y < 0) n.negate();
  const P = (a, b, h) => at.clone().addScaledVector(d, a * len).addScaledVector(s, b * wid).addScaledVector(n, h * wid);
  const nn = n.clone().lerp(UP, 0.3).normalize();
  const base = m.v(P(0, 0, 0), nn, rib), tip = m.v(P(1, 0, 0.05), nn, c), mid = m.v(P(0.45, 0, -fold * 0.5), nn, rib);
  const l1 = m.v(P(0.3, -0.48, fold * 0.4), nn, c), l2 = m.v(P(0.7, -0.36, fold * 0.5), nn, c);
  const r1 = m.v(P(0.3, 0.48, fold * 0.4), nn, c), r2 = m.v(P(0.7, 0.36, fold * 0.5), nn, c);
  m.t(base, l1, mid); m.t(l1, l2, mid); m.t(mid, l2, tip);
  m.t(base, mid, r1); m.t(r1, mid, r2); m.t(mid, tip, r2);
}

function hairGrass(seed) {
  const R = rng(seed), m = new Mesh();
  const base = col('#5d7a2e'), mid = col('#a3b54c'), straw = col('#c9b67e');
  const n = 52 + Math.floor(R() * 14);
  for (let i = 0; i < n; i++) {
    const az = R() * 6.283, r = R() * 0.016;
    blade(m, { base: new THREE.Vector3(Math.cos(az) * r, 0, Math.sin(az) * r), az, tilt: 0.08 + R() * 0.45, bend: 0.8 + R() * 1.1,
      len: 0.16 + R() * 0.2, width: 0.0029 + R() * 0.0014, seg: 5, c0: base, c1: mix(mid, straw, R() * 0.35), dry: straw, tipDry: 0.15 + R() * 0.3, taper: 0.5 });
  }
  // flowering culms: hair-thin, upright, with an open purple-silver panicle of tiny spikelets
  const pan = [col('#7d5f67'), col('#a7928a'), col('#8b7a5e')];
  const culms = 2 + Math.floor(R() * 4);
  for (let i = 0; i < culms; i++) {
    const az = R() * 6.283;
    const top = blade(m, { base: new THREE.Vector3(0, 0, 0), az, tilt: 0.05 + R() * 0.2, bend: 0.25 + R() * 0.3, len: 0.3 + R() * 0.22, width: 0.0013, seg: 5,
      c0: col('#5d6a34'), c1: col('#8c7c58'), taper: 0.05 });
    for (let k = 0; k < 9; k++) {
      const a2 = R() * 6.283, drop = R() * 0.07;
      const at = top.clone().add(new THREE.Vector3(0, -drop, 0));
      blade(m, { base: at, az: a2, tilt: 0.7 + R() * 0.6, bend: 0.4 + R() * 0.5, len: 0.018 + R() * 0.03, width: 0.0022, seg: 2,
        c0: pan[k % 3], c1: pan[(k + 1) % 3], taper: 0.6 });
    }
  }
  return m.geometry();
}

function woodSedge(seed) {
  const R = rng(seed), m = new Mesh();
  const base = col('#8c8f4e'), green = col('#5f8a2c'), fresh = col('#7ea83a');
  const n = 28 + Math.floor(R() * 8);
  for (let i = 0; i < n; i++) {
    const az = R() * 6.283, r = R() * 0.02, inner = R();
    blade(m, { base: new THREE.Vector3(Math.cos(az) * r, 0, Math.sin(az) * r), az, tilt: 0.15 + 0.4 * (1 - inner) + R() * 0.2, bend: 1.1 + R() * 0.9,
      len: 0.24 + R() * 0.22, width: 0.0045 + R() * 0.0025, seg: 6, fold: 0.28, c0: mix(base, green, 0.25), c1: mix(green, fresh, R()), edge: fresh,
      twist: (R() - 0.5) * 1.2, taper: 0.35 });
  }
  // slender stems with drooping, catkin-like female spikes and a brown male spike at the top
  const stems = 2 + Math.floor(R() * 3);
  for (let i = 0; i < stems; i++) {
    const az = R() * 6.283;
    const top = blade(m, { base: new THREE.Vector3(0, 0, 0), az, tilt: 0.25 + R() * 0.3, bend: 0.6 + R() * 0.5, len: 0.3 + R() * 0.18, width: 0.0016, seg: 5,
      c0: col('#7f8a45'), c1: col('#6f7d3a'), taper: 0.05 });
    blade(m, { base: top, az, tilt: 1.2, bend: 0.6, len: 0.035, width: 0.003, seg: 2, c0: col('#6d5a3b'), c1: col('#4f412c'), taper: 0.3 });
    for (let k = 0; k < 3; k++) {
      const at = top.clone().add(new THREE.Vector3(-Math.cos(az) * 0.02 * (k + 1), -0.012 * (k + 1), -Math.sin(az) * 0.02 * (k + 1)));
      blade(m, { base: at, az: az + (R() - 0.5) * 1.5, tilt: 2.2 + R() * 0.5, bend: 0.3, len: 0.03 + R() * 0.02, width: 0.0028, seg: 3,
        c0: col('#8f9452'), c1: col('#6f7440'), taper: 0.25 });
    }
  }
  return m.geometry();
}

function woodRush(seed) {
  const R = rng(seed), m = new Mesh();
  const red = col('#7b4b37'), green = col('#58742f'), light = col('#6f8c38'), margin = col('#b3b68a');
  const n = 17 + Math.floor(R() * 6);
  for (let i = 0; i < n; i++) {
    const az = (i / n) * 6.283 + R() * 0.4, inner = i % 3 === 0;
    blade(m, { base: new THREE.Vector3(0, 0, 0), az, tilt: (inner ? 0.45 : 0.85) + R() * 0.35, bend: 0.25 + R() * 0.4, len: (inner ? 0.07 : 0.1) + R() * 0.07, width: 0.009 + R() * 0.004,
      seg: 4, fold: 0.12, c0: mix(red, green, 0.35), c1: mix(green, light, R()), edge: margin, taper: 0.3 });
  }
  // flowering stems: an umbel of thin rays, each ending in a small dark-brown flower cluster (rays droop after flowering)
  const st = 1 + Math.floor(R() * 3);
  for (let i = 0; i < st; i++) {
    const az = R() * 6.283;
    const top = blade(m, { base: new THREE.Vector3(0, 0, 0), az, tilt: 0.1 + R() * 0.25, bend: 0.2, len: 0.13 + R() * 0.1, width: 0.0016, seg: 4,
      c0: mix(red, green, 0.5), c1: col('#6a7036'), taper: 0.05 });
    for (let k = 0; k < 7; k++) {
      const a2 = R() * 6.283;
      const tip = blade(m, { base: top, az: a2, tilt: 0.6 + R() * 0.9, bend: 0.6 + R() * 0.6, len: 0.02 + R() * 0.025, width: 0.0009, seg: 2,
        c0: col('#6a7036'), c1: col('#5e5a33'), taper: 0.05 });
      blade(m, { base: tip, az: a2, tilt: 1.4, bend: 0.2, len: 0.007, width: 0.004, seg: 1, c0: col('#4a3627'), c1: col('#3b2b1f'), taper: 0.5 });
    }
  }
  return m.geometry();
}

function horsetail(seed) {
  const R = rng(seed), m = new Mesh();
  const green = col('#5f7f32'), pale = col('#86a14a'), sheath = col('#3c3324'), branchC = col('#6f9038');
  const H = 0.3 + R() * 0.2, nodes = 10 + Math.floor(R() * 3);
  const lean = new THREE.Vector3((R() - 0.5) * 0.12, 1, (R() - 0.5) * 0.12).normalize();
  let p = new THREE.Vector3(0, -0.01, 0);
  for (let k = 0; k < nodes; k++) {
    const t = k / nodes, seg = H / nodes * (k === 0 ? 1.6 : 1);
    const q = p.clone().addScaledVector(lean.clone().lerp(UP, t * 0.3).normalize(), seg);
    const r = 0.0026 * (1 - 0.6 * t);
    stem(m, p, q, r, r * 0.95, mix(green, pale, t), mix(green, pale, t + 0.05));
    stem(m, q.clone().addScaledVector(lean, -0.004), q, r * 1.25, r * 1.2, sheath, sheath);      // dark node sheath
    // whorl of thin, arching branches: longest in the middle, short near the top (a soft pyramid)
    if (k >= 2 && k < nodes - 1) {
      const nb = 12 + Math.floor(R() * 3), L = 0.06 + 0.09 * Math.sin(Math.PI * Math.min(1, (k - 1) / (nodes - 1)) ** 0.8) * (1 - 0.4 * t);
      const off = R() * 6.283;
      for (let b = 0; b < nb; b++) {
        const az = off + (b / nb) * 6.283;
        const tip = blade(m, { base: q, az, tilt: 1.05 + R() * 0.25, bend: 0.7 + R() * 0.5, len: L * (0.8 + R() * 0.4), width: 0.0014, seg: 3,
          c0: branchC, c1: mix(branchC, pale, 0.4), taper: 0.1 });
        // secondary branchlets make the wood horsetail look feathery
        if (L > 0.12 && b % 3 === 0) blade(m, { base: tip.clone().lerp(q, 0.45), az: az + (R() - 0.5) * 1.2, tilt: 1.6, bend: 0.6, len: L * 0.25, width: 0.0008, seg: 2,
          c0: branchC, c1: pale, taper: 0.2 });
      }
    }
    p = q;
  }
  blade(m, { base: p, az: R() * 6.283, tilt: 0.1, bend: 0.1, len: 0.012, width: 0.003, seg: 1, c0: green, c1: pale, taper: 0.8 });
  return m.geometry();
}

function bilberry(seed) {
  const R = rng(seed), m = new Mesh();
  const stemC = col('#4f7a2b'), stemOld = col('#6b5a39'), leafA = col('#5c8b2c'), leafB = col('#7aa63a'), rib = col('#9bb45a'), red = col('#9a4a2c');
  const berries = [];
  // green, angular twigs that zig-zag a little at each leaf; side shoots spread outward and up
  const grow = (from, dir, len, depth) => {
    const segs = 3; let p = from.clone(); const d = dir.clone();
    let az0 = R() * 6.283;
    for (let s = 0; s < segs; s++) {
      d.add(new THREE.Vector3((R() - 0.5) * 0.35, 0.03, (R() - 0.5) * 0.35)).normalize();
      const q = p.clone().addScaledVector(d, len / segs);
      stem(m, p, q, 0.0026 * (1 - depth * 0.3), 0.0021 * (1 - depth * 0.3), depth ? stemC : mix(stemOld, stemC, s / segs), stemC, 3);
      if (!(depth === 0 && s === 0)) {
        const nl = 2;
        for (let l = 0; l < nl; l++) {
          az0 += 2.4 + R() * 0.5;                                    // alternate, spiralling round the twig
          const at = p.clone().lerp(q, (l + 0.6) / nl);
          const ld = new THREE.Vector3(Math.cos(az0), 0.05 + R() * 0.3, Math.sin(az0)).addScaledVector(d, 0.35);
          const big = 0.016 + R() * 0.013;
          leaf(m, at.clone().addScaledVector(ld.clone().normalize(), 0.003), ld, big, big * 0.6, R() < 0.05 ? red : mix(leafA, leafB, R()), rib);
        }
      }
      if (depth < 2 && s >= 1) {
        const nb = depth === 0 ? 1 + (R() < 0.3 ? 1 : 0) : (R() < 0.22 ? 1 : 0);
        for (let k = 0; k < nb; k++) {
          const a = R() * 6.283, side = new THREE.Vector3(Math.cos(a), 0.6 + R() * 0.4, Math.sin(a)).normalize().lerp(d, 0.3).normalize();
          grow(q, side, len * (0.5 + R() * 0.2), depth + 1);
        }
      }
      if (depth >= 1 && s === segs - 1 && R() < 0.3) berries.push(q.clone().add(new THREE.Vector3(0, -0.009, 0)));
      p = q;
    }
  };
  const stems = 4 + Math.floor(R() * 2);
  for (let i = 0; i < stems; i++) {
    const az = R() * 6.283, lean = 0.35 + R() * 0.45;
    grow(new THREE.Vector3(Math.cos(az) * 0.025, -0.01, Math.sin(az) * 0.025), new THREE.Vector3(Math.cos(az) * Math.sin(lean), Math.cos(lean), Math.sin(az) * Math.sin(lean)), 0.15 + R() * 0.1, 0);
  }
  // blue-black berries with a dusty bloom
  const berryC = col('#2e3352');
  for (const b of berries.slice(0, 4)) {
    const g = new THREE.IcosahedronGeometry(0.0042, 0), pos = g.attributes.position;
    const base = m.p.length / 3;
    for (let i = 0; i < pos.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(pos, i);
      m.v(v.clone().add(b), v.clone().normalize(), mix(berryC, col('#56607e'), Math.max(0, v.y / 0.0042) * 0.5));
    }
    for (let i = 0; i < pos.count; i += 3) m.t(base + i, base + i + 1, base + i + 2);
  }
  return m.geometry();
}

const SPECIES = { hairGrass, woodSedge, woodRush, horsetail, bilberry };

// variants in the shape World.variants() returns ({ geo, mat, size }), several seeds per species
export function floraVariants(kind, count = 3, seed = 1) {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.78, metalness: 0, envMapIntensity: 0.8 });
  mat.name = 'flora_' + kind; mat.userData.thinBlades = true;
  return Array.from({ length: count }, (_, i) => {
    const geo = SPECIES[kind](seed * 977 + i * 131 + 7);
    const size = geo.boundingBox.getSize(new THREE.Vector3());
    return { geo, mat, size, name: kind + i };
  });
}
