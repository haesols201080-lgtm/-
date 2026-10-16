// The generated town: plan -> plots -> buildings, ground, gap fillers,
// street furniture spots, colliders, and the spots the city life module
// decorates (doorsteps, gables, yards, bomb sites, alleys).
import * as THREE from 'three';
import { Kit, Frame, TINTS, CHUNK } from './kit.js';
import { house, holesWall } from './house.js';
import { cornerBuilding } from './corner.js';
import { resolve } from './styles.js';
import { cutBlocks } from './plots.js';
import { townMaterials } from './mats.js';
import { signAtlas, SHOPS, PUBS } from './signs.js';
import { buildTownGround } from './ground.js';
import { fillGap } from './gaps.js';
import { rng } from '../city_util.js';

const PI = Math.PI;

// frames in the old city_life convention: f.w(lx, lz) -> { x, z }
const legacy = (F) => ({ w: (lx, lz) => ({ x: F.x(lx, lz), z: F.z(lx, lz) }), rot: F.rot, F });

// district rules: which types line which streets
export const DISTRICTS = {
  westend: { decay: 0.28, gap: 0.05, alley: 0.04, mix: [['shop', 40], ['office', 22], ['stucco', 14], ['georgian', 12], ['interwar', 4], ['victorian', 8]], corner: [['pub', 35], ['shop', 40], ['office', 25]] },
  bloomsbury: { decay: 0.38, gap: 0.08, alley: 0.04, mix: [['georgian', 62], ['stucco', 14], ['shop', 10], ['tenement', 6], ['office', 4], ['victorian', 4]], corner: [['shop', 50], ['pub', 35], ['georgian', 15]] },
  slum: { decay: 0.68, gap: 0.17, alley: 0.12, mix: [['cottage', 38], ['victorian', 20], ['shop', 14], ['tenement', 10], ['warehouse', 8], ['georgian', 10]], corner: [['pub', 45], ['shop', 55]] },
  railway: { decay: 0.6, gap: 0.12, alley: 0.08, mix: [['warehouse', 45], ['cottage', 25], ['tenement', 15], ['victorian', 15]], corner: [['pub', 50], ['shop', 50]] },
  inner: { decay: 0.04, gap: 0.0, alley: 0.0, mix: [['stucco', 65], ['georgian', 35]], corner: [['stucco', 100]] },
  mansions: { decay: 0.45, gap: 0.08, alley: 0.06, mix: [['victorian', 30], ['tenement', 20], ['shop', 18], ['interwar', 12], ['georgian', 20]], corner: [['pub', 40], ['shop', 60]] },
};

const RUN = { georgian: [4, 11], stucco: [4, 9], victorian: [4, 10], cottage: [6, 16], shop: [1, 4], pub: [1, 1], office: [1, 1], tenement: [1, 1], interwar: [1, 1], warehouse: [1, 1] };

function weighted(r, list) {
  const t = list.reduce((s, [, w]) => s + w, 0);
  let u = r() * t;
  for (const [k, w] of list) { u -= w; if (u <= 0) return k; }
  return list[0][0];
}

// plan: from streets.js buildPlan, plus plan.districtAt(x, z) and plan.special
export function buildTown(G, root, plan, map, o = {}) {
  const r = o.r;
  const atlas = signAtlas();
  const K = new Kit();
  const out = {
    colliders: [],
    spots: { entrances: [], doorsteps: [], gables: [], yards: [], bombsites: [], alleys: [], shopDoors: [], fronts: [] },
    houses: [],
  };
  const districtOf = (street, x, z) => DISTRICTS[(street && street.district) || plan.districtAt(x, z) || 'slum'] || DISTRICTS.slum;
  const shopName = () => SHOPS[Math.floor(r() * SHOPS.length)];
  const pubName = () => PUBS[Math.floor(r() * PUBS.length)];

  const chooser = (street, e, rr, remaining) => {
    const mx = e.a[0] + e.ux * e.L * 0.5, mz = e.a[1] + e.uz * e.L * 0.5;
    const D = districtOf(street, mx, mz);
    if (rr() < D.gap) return { gap: 5 + rr() * 12, gapKind: rr() < 0.15 && D.decay > 0.5 ? 'shanties' : 'bombsite' };
    if (rr() < D.alley) return { alley: 1.6 + rr() * 1.2 };
    let type = weighted(rr, D.mix);
    if (street && street.kind === 'main' && rr() < 0.55 && D !== DISTRICTS.inner) type = 'shop';
    if (street && street.kind === 'lane' && (type === 'office' || type === 'interwar')) type = 'cottage';
    const st = resolve(type, rr, { decay: Math.min(0.95, D.decay * (0.7 + rr() * 0.6)) });
    const w = st.w[0] + rr() * (st.w[1] - st.w[0]);
    const d = st.d[0] + rr() * (st.d[1] - st.d[0]);
    const [c0, c1] = RUN[type];
    const count = Math.max(1, Math.min(Math.floor(remaining / w), c0 + Math.floor(rr() * (c1 - c0 + 1))));
    return { style: st, w, d, count, type };
  };
  const corner = (s1, s2, rr, V) => {
    const D = districtOf(s1, V[0], V[1]);
    const type = weighted(rr, D.corner);
    const st = resolve(type === 'georgian' || type === 'stucco' ? type : type === 'office' ? 'office' : 'shop', rr, { decay: D.decay });
    st.gf = type === 'pub' ? 'pub' : type === 'shop' ? 'shop' : null;
    if (type === 'pub') { st.wall = rr() < 0.5 ? 'brick' : 'plaster'; st.wallTint = rr() < 0.5 ? TINTS.red[1] : TINTS.stucco[1]; st.cornice = true; st.shopPaint = [[0.12, 0.2, 0.14], [0.28, 0.08, 0.06], [0.1, 0.1, 0.12]][Math.floor(rr() * 3)]; }
    const d = Math.min(12, st.d[0] + rr() * 2);
    const a = 7 + rr() * 5, b = 7 + rr() * 5;
    return { style: st, d, a: Math.max(a, d + 1), b: Math.max(b, d + 1), chamfer: type === 'pub' && rr() < 0.7 ? 1.6 : 0, type };
  };

  const cut = cutBlocks(plan, { r, chooser, corner, reserved: plan.reserved || [] });
  const gl = 0.12;   // pavement level
  // the story's own buildings are chosen among the plots and restyled
  if (o.adjust) o.adjust(cut, { resolve, r });
  // ---- decide everything random about each building once, so the far and
  // the near versions agree; each job gets its own seed for the details
  const keyOf = (x, z) => Math.floor(x / CHUNK) + ',' + Math.floor(z / CHUNK);
  for (const j of cut.jobs) {
    j.seed = Math.floor(r() * 2147483647);
    const st = j.style;
    if (j.kind === 'house') {
      j.F = new Frame(j.F.ox, gl, j.F.oz, j.F.rot);
      j.sign = j.signName ? atlas.rect(j.signName) : st.gf === 'shop' ? atlas.rect(shopName()) : st.gf === 'pub' ? atlas.rect(pubName()) : null;
      j.doorPaint = TINTS.paint[Math.floor(r() * TINTS.paint.length)];
      j.shopState = st.decay > 0.5 && r() < 0.35 ? (r() < 0.5 ? 'boarded' : 'dead') : 'ok';
      j.blind = r() < 0.25;
      j.bombL = j.left === 'open' && r() < st.decay * 0.6;
      j.bombR = j.right === 'open' && r() < st.decay * 0.6;
      j.shoreL = j.bombL && r() < 0.7; j.shoreR = j.bombR && r() < 0.7;
      j.key = keyOf(j.F.ox, j.F.oz);
    } else {
      j.signs = {};
      if (j.signName) { const n = atlas.rect(j.signName); j.signs[0] = n; j.signs[1] = n; j.signs[2] = n; }
      else if (st.gf === 'pub') { const n = atlas.rect(pubName()); j.signs[0] = n; j.signs[1] = n; j.signs[2] = n; }
      else if (st.gf === 'shop') { j.signs[0] = atlas.rect(shopName()); j.signs[1] = atlas.rect(shopName()); j.signs[2] = j.signs[1]; }
      j.shopState = st.decay > 0.55 && r() < 0.3 ? 'boarded' : 'ok';
      j.key = keyOf(j.poly[1][0], j.poly[1][1]);
    }
  }
  for (const g of cut.gaps) { g.seed = Math.floor(r() * 2147483647); g.F = new Frame(g.F.ox, gl, g.F.oz, g.F.rot); g.key = keyOf(g.F.ox, g.F.oz); }

  // one building into a kit; returns what it reports (doors, gables, colliders)
  const emit = (K, j) => {
    const jr = rng(j.seed);
    K.key = j.key;
    const st = j.style;
    if (j.kind === 'house') {
      st.sign = j.sign; st.doorPaint = j.doorPaint; st.shopState = j.shopState; st.blind = j.blind;
      return house(K, { F: j.F, w: j.w, d: j.d, left: j.left, right: j.right, stackR: j.stackR, leftBombed: j.bombL, rightBombed: j.bombR, leftShore: j.shoreL, rightShore: j.shoreR }, st, jr);
    }
    return cornerBuilding(K, { ...j, gf: st.gf }, st, jr, gl);
  };
  const emitGap = (K, g) => { K.key = g.key; return fillGap(K, g, rng(g.seed), plan); };

  // ---- the far version of everything, built now; it also reports the spots
  const far = new Kit();
  far.lod = true;
  for (const j of cut.jobs) {
    const res = emit(far, j);
    j.doors = res.doors; j.top = res.top;
    out.colliders.push(...res.colliders.map((c) => [...c, res.top]));
    const st = j.style;
    for (const dd of res.doors) {
      const p = { x: dd.x, z: dd.z, ox: dd.x + Math.sin(dd.rot) * 0.6, oz: dd.z + Math.cos(dd.rot) * 0.6, rot: dd.rot, shop: !!dd.shop, pub: st.gf === 'pub', district: j.street && j.street.district, type: st.type };
      out.spots.doorsteps.push(p);
      if (dd.shop) out.spots.shopDoors.push(p);
    }
    if (j.kind === 'house') {
      for (const g of res.gables) out.spots.gables.push({ ...g, shored: j.shoreL || j.shoreR });
      out.spots.yards.push({ f: legacy(j.F), x0: 0, x1: j.w, z0: -j.d - 8, z1: -j.d, houses: 1, ruin: false, model: st.type, top: res.top });
      out.houses.push({ F: j.F, w: j.w, d: j.d, type: st.type, top: res.top, street: j.street });
      if (st.type === 'office' || st.type === 'interwar' || st.type === 'tenement') out.spots.entrances.push({ model: st.type, x: j.F.ox, z: j.F.oz, rot: j.F.rot, lx: j.w / 2, lz: 0, w: j.w, top: res.top });
    }
  }
  for (const g of cut.gaps) {
    const res = emitGap(far, g);
    out.colliders.push(...res.colliders.map((c) => [...c, 2.6]));
    if (g.kind === 'bombsite' || g.kind === 'shanties') out.spots.bombsites.push({ f: legacy(g.F), x0: 0.3, x1: g.w - 0.3, z0: -g.d, z1: -0.3, front: true, pad0: 0.3, pad1: 0.3, kind: g.kind, hoarding: !!res.hoarding });
  }
  for (const a of cut.alleys) {
    const F = new Frame(a.F.ox, gl, a.F.oz, a.F.rot);
    out.spots.alleys.push({ f: legacy(F), x0: 0, x1: a.w, z0: -a.d, z1: 0 });
  }
  out.spots.fronts = cut.fronts;
  const mats = townMaterials(G);
  const farMeshes = far.build(root, mats, { name: 'town_far', cast: false });
  out.tris = far.tris;

  // ---- near detail, built per chunk as the player comes close
  const chunks = new Map();   // key -> { jobs, gaps, far: [], near: null, cx, cz }
  const chunkOf = (key) => {
    let c = chunks.get(key);
    if (!c) { const [i, k] = key.split(',').map(Number); c = { jobs: [], gaps: [], far: [], near: null, cx: (i + 0.5) * CHUNK, cz: (k + 0.5) * CHUNK }; chunks.set(key, c); }
    return c;
  };
  for (const j of cut.jobs) chunkOf(j.key).jobs.push(j);
  for (const g of cut.gaps) chunkOf(g.key).gaps.push(g);
  for (const m of farMeshes) chunkOf(m.userData.chunk).far.push(m);
  const NEAR = o.near || 150, DROP = NEAR + 70;
  const buildNear = (c) => {
    const K = new Kit();
    for (const j of c.jobs) emit(K, j);
    for (const g of c.gaps) emitGap(K, g);
    c.near = K.build(root, mats, { name: 'town' });
    c.nearTris = K.tris;
  };
  let budget = 0;
  out.update = (cam, force = false) => {
    budget = force ? 1e9 : 1;
    // nearest unbuilt chunks first
    const list = [...chunks.values()].map((c) => [c, Math.hypot(c.cx - cam.x, c.cz - cam.z)]).sort((a, b) => a[1] - b[1]);
    for (const [c, d] of list) {
      if (d < NEAR && !c.near && budget > 0) { buildNear(c); budget--; }
      if (d > DROP && c.near) { for (const m of c.near) { m.geometry.dispose(); root.remove(m); } c.near = null; }
      const near = !!c.near && d < NEAR + 20;
      for (const m of c.far) m.visible = !near;
      if (c.near) for (const m of c.near) m.visible = near;
    }
  };
  out.chunks = chunks;
  out.jobs = cut.jobs;
  out.gaps = cut.gaps;
  // ---- ground
  out.ground = buildTownGround(G, plan, map, root, { roadKind: o.roadKind });
  return out;
}

export { holesWall };
