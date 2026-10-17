// The plan of London, Airstrip One: which surface lies where, which building
// stands where, the prole streets packed with terraces, and the named zones,
// points and pavement paths the other modules use. Coordinates follow
// docs/architecture.md (metres, north is -Z).
import * as THREE from 'three';
import { T, blob } from './city_ground.js';
import { tf, lookYaw } from './city_util.js';

const PI = Math.PI, H = PI / 2;

// ---------------------------------------------------------------- the plan

// Prole quarter: east-west streets run between frontages [z - 6, z + 1] so the
// shop (z = 95) and the pub (z = 35) front straight onto them; north-south
// streets are [x - 3.5, x + 3.5].
export const PROLE = { ew: [30, 90, 150, 210, 270], ns: [63, 130, 200, 270], lane: [-9, -2], x0: 40, x1: 334, z0: -10, z1: 312 };
const ewC = (z) => [z - 6, z + 1];
const nsC = (x) => [x - 3.5, x + 3.5];

export function paintGround(map) {
  const P = (x0, z0, x1, z1, t) => map.paint(x0, z0, x1, z1, t);

  // the prole quarter first; the Party roads that reach it are painted over it
  P(PROLE.x0, PROLE.z0, PROLE.x1, PROLE.z1, T.YARD);
  for (const z of PROLE.ew) { const [a, b] = ewC(z); P(59.5, a, PROLE.x1, b, T.PAVING); }
  for (const x of PROLE.ns) { const [a, b] = nsC(x); P(a, -9, b, 300, T.PAVING); }
  P(53, PROLE.lane[0], PROLE.x1, PROLE.lane[1], T.PAVING);
  for (const z of PROLE.ew) { const [a, b] = ewC(z); P(59.5, a + 1.3, PROLE.x1, b - 1.3, T.COBBLE); }
  for (const x of PROLE.ns) { const [a, b] = nsC(x); P(a + 1.3, -9, b - 1.3, 299, T.COBBLE); }
  P(53, PROLE.lane[0] + 1.3, PROLE.x1, PROLE.lane[1] - 1.3, T.COBBLE);

  // Party London: pavements, then the level square, then carriageways
  P(-20, -10, 20, 277, T.PAVING);          // Victory Avenue
  P(-205, 47, 60, 73, T.PAVING);           // Mansions Road
  P(-205, 188, 20, 214, T.PAVING);         // Station Road
  P(-135, 207, -85, 216, T.PAVING);        // station forecourt
  P(-185, -111, -55, -87, T.PAVING);       // Love Lane
  P(-187, -111, -163, 214, T.PAVING);      // West Road
  P(55, -101, 300, -79, T.PAVING);         // Inner Party road
  P(86, -296, 108, -79, T.PAVING);         // Ministry east road
  P(102, -168, 300, -150, T.PAVING);       // Inner Party back lane
  P(-20, 256, 60, 277, T.PAVING);          // South Road
  P(-63, -118, 63, -4, T.PAVING);          // round the square
  P(-90, -292, 90, -110, T.PAVING);        // the Ministry's apron
  P(-55, -100, 55, -10, T.SQUARE);         // Victory Square
  P(-60, -114, 60, -100, T.SQUARE);        // Ministry plaza
  P(-9, -10, 9, 271, T.ASPHALT);
  P(-200, 54, 61, 66, T.ASPHALT);
  P(-200, 195, 9, 207, T.ASPHALT);
  P(-185, -104, -55, -94, T.ASPHALT);
  P(-180, -104, -170, 207, T.ASPHALT);
  P(55, -95, 296, -85, T.ASPHALT);
  P(92, -290, 102, -85, T.ASPHALT);
  P(102, -163, 296, -155, T.ASPHALT);
  P(-9, 262, 60.8, 271, T.ASPHALT);

  // Ministry of Love compound: bare concrete inside the wire
  P(-350, -250, -185, -85, T.COMPOUND);

  // Inner Party gardens and the park south of their road
  P(105, -117, 290, -101, T.GRASS);
  P(105, -177, 290, -168, T.GRASS);
  P(105, -150, 290, -138, T.GRASS);
  P(102, -79, 296, -14, T.GRASS);
  for (const x of [142, 192, 242]) { P(x - 1.2, -122, x + 1.2, -101, T.PAVING); P(x - 1.2, -177, x + 1.2, -163, T.PAVING); }
  P(102, -49, 296, -46.6, T.PAVING);
  for (const x of [150, 205, 260]) P(x - 1.2, -79, x + 1.2, -14, T.PAVING);

  // courtyard behind Victory Mansions
  P(-66, 74, -34, 118, T.YARD);
}

// Surfaces kept open (bomb sites, yards) so the filler never builds on them.
export const KEEP_OPEN = [
  [-33, 117, -16, 134],        // bomb site on the avenue, west side
  [16, 111, 34, 138],          // hoarding and waste ground, east side
  [-31, 41, -16, 47],
];

// ---------------------------------------------------------------- Party London

// [model, x, z, rotY, opts]
export const PARTY = [
  ['minitrue', 0, -200, 0, { unique: true }],
  ['monument', 0, -55, 0, { unique: true }],
  ['church', 82, -50, -H, { unique: true }],
  ['party_block_c', -70, -60, H],
  ['party_block_b', 70, -20, -H],
  ['party_block_a', -38, 2, PI], ['party_block_a', 38, 2, PI],
  // Victory Avenue, west then east
  ['party_block_b', -23, 30, H], ['victory_mansions', -25, 95, H, { unique: true }], ['party_block_a', -23, 150, H],
  ['party_block_b', -24, 177, H],
  // moved south from z = 215: at 215 it stood across Station Road
  ['party_block_c', -25, 237.5, H],
  ['community_centre', 27, 30, -H, { unique: true }], ['party_block_a', 23, 95, -H], ['party_block_b', 24, 150, -H],
  ['party_block_a', 23, 205, -H], ['party_block_b', 24, 233, -H],
  // behind Victory Mansions and along Mansions Road
  ['party_block_c', -75, 95, H], ['party_block_a', -75, 160, H], ['party_block_b', -120, 100, -H],
  ['party_block_a', -80, 40, 0], ['party_block_b', -130, 38, 0],
  ['party_block_b', -150, -10, -H], ['party_block_c', -150, 160, -H],
  // round Love Lane
  ['party_block_a', -120, -70, PI], ['party_block_b', -120, -125, 0], ['party_block_a', -160, -122, 0],
  // the Inner Party quarter
  ['inner_block', 140, -130, 0], ['inner_block', 190, -125, 0], ['inner_block', 240, -130, 0],
  ['inner_block', 140, -185, 0], ['inner_block', 190, -185, 0], ['inner_block', 240, -185, 0],
  ['station', -110, 250, PI, { unique: true }],
  ['pyramid_far', -270, -170, 0, { scale: 0.8, unique: true, tag: 'miniluv' }],
];

export function placeParty(ctx) {
  const { placer, spots, G } = ctx;
  for (const [model, x, z, rot, o = {}] of PARTY) {
    const opts = { ...o };
    if (model === 'cafe') opts.unique = true;
    const p = placer.add(model, x, z, rot, opts);
    if (!p) continue;
    const e = placer.entrance(model, x, z, rot);
    if (e) spots.entrances.push({ model, x, z, rot, ...e });
  }
  // the Chestnut Tree: a plaster-fronted café on the square's west side
  const signs = G.mats.signMaterial ? {
    cafe: G.mats.signMaterial('THE CHESTNUT TREE CAFÉ', { bg: '#2b2620', fg: '#cdbf98', serif: true }),
    station: G.mats.signMaterial('PADDINGTON', { bg: '#1e2124', fg: '#d8d4c8' }),
  } : {};
  placer.add('cafe', -66, -22, H, { unique: true, override: signs.cafe ? { sign: signs.cafe } : undefined });
  if (signs.station) placer.setOverride('station', { sign: signs.station });
}

// ---------------------------------------------------------------- prole quarter

const TERRACES = [
  { model: 'prole_terrace', half: 10.4, p: 0.42, doors: [-9.3, -4.1, 1.1, 6.3] },
  { model: 'prole_terrace_b', half: 13, p: 0.33, doors: [-11.9, -6.7, -1.5, 3.7, 8.9] },
  { model: 'prole_ruin', half: 10.4, p: 0.25, doors: [-9.3, -4.1], ruin: true },
];
const FIXED = {
  shop: { half: 5.2, doors: [-0.9] },
  pub: { half: 5.2, doors: [-4.1, 1.1] },
};

// A row frame: origin on the frontage line, rotY = the facing of the houses.
// Local +z points out of the fronts into the street, houses stand at z = -4.
function frame(ox, oz, rot) {
  const c = Math.cos(rot), s = Math.sin(rot);
  return {
    ox, oz, rot,
    w: (lx, lz) => tf(ox, oz, rot, lx, lz),
    l: (x, z) => { const dx = x - ox, dz = z - oz; return { x: dx * c - dz * s, z: dx * s + dz * c }; },
  };
}

// Pack terraces along [a, b] (local x) leaving alleys and bomb sites.
function pack(r, a, b) {
  const items = [];
  let pos = a + (r() < 0.35 ? r.range(0, 4) : 0);
  for (;;) {
    const rem = b - pos;
    const fits = TERRACES.filter((t) => t.half * 2 <= rem);
    if (!fits.length) break;
    let u = r() * fits.reduce((s, t) => s + t.p, 0), t = fits[0];
    for (const f of fits) { u -= f.p; if (u <= 0) { t = f; break; } }
    items.push({ ...t, s: pos + t.half });
    pos += t.half * 2;
    const g = r();
    pos += g < 0.2 ? r.range(6.5, 12) : g < 0.45 ? r.range(2.4, 3.4) : r.range(0, 0.25);
  }
  // spread the leftover so the gaps are not always at the far end
  const last = items.length ? items[items.length - 1].s + items[items.length - 1].half : a;
  const slack = Math.max(0, b - last);
  const shift = slack * r() * 0.6;
  for (const it of items) it.s += shift;
  return items;
}

// One row of terraces on a frame between local a and b; fixed buildings keep
// their place. Records yards, bomb sites, alleys, doorsteps and gable ends.
function row(ctx, f, a, b, yard, fixed = []) {
  const { r, placer, spots } = ctx;
  const items = [];
  const occ = fixed.map((it) => ({ ...FIXED[it.model], ...it, fixed: true })).sort((p, q) => p.s - q.s);
  let cur = a;
  for (const it of occ) {
    items.push(...pack(r, cur, it.s - it.half - 0.1));
    items.push(it);
    cur = it.s + it.half + 0.1;
  }
  items.push(...pack(r, cur, b));
  items.sort((p, q) => p.s - q.s);
  const gaps = [];
  for (let i = 0; i <= items.length; i++) {
    const lo = i === 0 ? a : items[i - 1].s + items[i - 1].half;
    const hi = i === items.length ? b : items[i].s - items[i].half;
    gaps.push({ lo, hi, w: hi - lo, end: i === 0 || i === items.length });
  }
  items.forEach((it, i) => {
    const gL = gaps[i], gR = gaps[i + 1];
    const shoreL = gL.w >= 3.6 && r() < 0.85;
    const shoreR = gR.w >= 3.6 && !it.ruin && r() < 0.85;
    gL.shoreHi = shoreL; gR.shoreLo = shoreR;
    const p = f.w(it.s, -4);
    placer.add(it.model, p.x, p.z, f.rot, { shoreL, shoreR, unique: it.unique, override: it.override, tag: 'prole' });
    for (const lx of it.doors || []) {
      const d = f.w(it.s + lx, 0.35), o = f.w(it.s + lx, 1.0);
      spots.doorsteps.push({ x: d.x, z: d.z, ox: o.x, oz: o.z, rot: f.rot });
    }
    // exposed gable ends (no neighbour within 2.4 m) can carry a big poster
    for (const [g, sx] of [[gL, -1], [gR, 1]]) {
      if (g.w < 2.4 || (it.ruin && sx > 0)) continue;
      const lx = it.s + sx * (it.half + 0.03);
      const p0 = f.w(lx, -4 + 2.0);
      spots.gables.push({ x: p0.x, z: p0.z, rot: f.rot + (sx > 0 ? H : -H), shored: sx < 0 ? shoreL : shoreR });
    }
    spots.yards.push({ f, x0: it.s - it.half, x1: it.s + it.half, z0: -8 - yard, z1: -8, houses: Math.round(it.half / 2.6), ruin: !!it.ruin, model: it.model });
    if (it.ruin) spots.bombsites.push({ f, x0: it.s, x1: it.s + it.half, z0: -8 - yard * 0.6, z1: -0.4, inRuin: true });
  });
  for (const g of gaps) {
    if (g.w >= 5) {
      const pad0 = g.shoreLo ? 3.4 : 0.3, pad1 = g.shoreHi ? 3.4 : 0.3;
      spots.bombsites.push({ f, x0: g.lo, x1: g.hi, z0: -8 - yard, z1: 0, pad0, pad1, front: true });
    } else if (g.w >= 2.2) {
      spots.alleys.push({ f, x0: g.lo, x1: g.hi, z0: -8 - yard, z1: 0 });
    }
  }
  return items;
}

export function placeProle(ctx) {
  const { G } = ctx;
  const sign = (t) => (G.mats.signMaterial ? { sign: G.mats.signMaterial(t, { bg: '#2a231c', fg: '#bfae86', serif: true }) } : undefined);
  const xs = [[66.5, 126.5], [133.5, 196.5], [203.5, 266.5], [273.5, 330]];
  const zs = [[-2, 24], [31, 84], [91, 144], [151, 204], [211, 264], [271, 310]];
  // the fixed shops: Mr Charrington's, the pub, two more for the street life
  const fixedAt = {
    '133.5,91': [{ model: 'shop', worldX: 165, override: sign('CHARRINGTON — ANTIQUES'), unique: true }],
    '66.5,31': [{ model: 'pub', worldX: 95, override: sign('THE WHITE HART'), unique: true }],
    '203.5,151': [{ model: 'shop', worldX: 236, override: sign('GREENGROCER'), unique: true }],
    '133.5,204': [{ model: 'shop', worldX: 151, override: sign('STATIONER'), unique: true }],
  };
  for (const [x0, x1] of xs) {
    for (const [z0, z1] of zs) {
      const D = z1 - z0;
      const south = z0 === 271;
      const yard = south ? 12 : D >= 40 ? 12 : (D - 16) / 2;
      // north frontage, facing the street on the block's north edge
      const fN = frame(0, z0, PI);
      const fixN = (fixedAt[`${x0},${z0}`] || []).map((it) => ({ ...it, s: -it.worldX }));
      row(ctx, fN, -x1, -x0, yard, fixN);
      ctx.blocks.push({ x0, x1, z0, z1, yard, south });
      if (!south) {
        const fixS = (fixedAt[`${x0},${z1}`] || []).map((it) => ({ ...it, s: it.worldX }));
        row(ctx, frame(0, z1, 0), x0, x1, yard, fixS);
      }
    }
  }
  // west side of the first north-south street, houses facing east
  for (const [za, zb] of [[-2, 24], [91, 144], [151, 204], [211, 255]]) {
    row(ctx, frame(59.5, 0, H), -zb, -za, 11);
  }
}

// ---------------------------------------------------------------- zones

export const ZONES = {
  minitrue: { name: '진리부', rects: [[-92, -296, 92, -100]] },
  cafe: { name: '밤나무 카페', rects: [[-73, -31, -55, -13]] },
  community: { name: '커뮤니티 센터', rects: [[15, 11, 40, 49]] },
  square: { name: '승리 광장', rects: [[-63, -100, 63, -4], [53, -66, 63, -34]] },
  mansions: { name: '승리 맨션', rects: [[-200, 47, 60, 73], [-90, 73, -15, 125]] },
  station: { name: '패딩턴역', rects: [[-205, 186, -16, 292]] },
  lovelane: { name: '애정부 가는 길', rects: [[-187, -112, -55, -86]] },
  miniluv: { name: '애정부', rects: [[-360, -262, -184, -80]] },
  inner: { name: '내부당 구역', rects: [[55, -300, 310, -12]] },
  prole: { name: '프롤 구역', rects: [[48, -12, 340, 318]] },
  avenue: { name: '승리 대로', rects: [[-20, -10, 20, 280], [-20, 255, 60, 280]] },
  outskirts: { name: '변두리', rects: [] },
};
const ZONE_ORDER = ['minitrue', 'cafe', 'community', 'square', 'mansions', 'station', 'lovelane', 'miniluv', 'inner', 'prole', 'avenue'];

export function zoneAt(x, z) {
  for (const id of ZONE_ORDER) {
    for (const [x0, z0, x1, z1] of ZONES[id].rects) if (x >= x0 && x <= x1 && z >= z0 && z <= z1) return id;
  }
  return 'outskirts';
}

// ---------------------------------------------------------------- points, paths, doors

export function namedPoints(ctx) {
  const { placer, ground } = ctx;
  const V = (x, z) => new THREE.Vector3(x, ground(x, z), z);
  const e = (m, x, z, rot) => placer.entrance(m, x, z, rot, 1.7).front;
  const vm = e('victory_mansions', -25, 95, H);
  const ob = e('inner_block', 190, -125, 0);
  const cc = e('community_centre', 27, 30, -H);
  const shop = tf(165, 95, PI, -0.9, 5.3);
  const pub = tf(95, 35, PI, -4.1, 5.3);
  const pts = {
    home_door: V(vm.x, vm.z),
    minitrue_door: V(0, -112.2),
    monument: V(0, -42.2),
    monument_center: V(0, -55),
    shop_door: V(shop.x, shop.z),
    pub_door: V(pub.x, pub.z),
    obrien_door: V(ob.x, ob.z),
    station_door: V(-110, 211.8),
    cafe_door: V(-59.0, -22),
    community_door: V(cc.x, cc.z),
    rocket_site: V(104, 147.5),
    convoy_start: V(-50, -15),
    convoy_end: V(50, -15),
    rally: V(0, -28),
    square_center: V(0, -75),
    chestnut_tree: V(-58.2, -32),
    miniluv_gate: V(-181, -99),
    prole_entry: V(62.5, 60),
    inner_road: V(160, -90),
    mansions_road: V(-40, 51),
    station_forecourt: V(-110, 210),
    courtyard: V(-50, 96),
    bombsite_avenue: V(-24, 126),
    church_portico: V(51, -50),
  };
  return pts;
}

export function namedPaths(ground) {
  const V = (pts) => pts.map(([x, z]) => new THREE.Vector3(x, ground(x, z), z));
  const avenue = (x) => {
    const out = [];
    for (let z = -6; z <= 256; z += 16) {
      if ((z > 50 && z < 70) || (z > 191 && z < 211)) continue;
      out.push([x, z]);
    }
    return out;
  };
  const paths = {
    avenue_w: V(avenue(-12)),
    avenue_e: V(avenue(12)),
    square_loop: V([[-45, -90], [-15, -94], [15, -94], [45, -90], [48, -72], [48, -38], [45, -18], [15, -15], [-15, -15], [-45, -18], [-48, -38], [-48, -72]]),
    lovelane: V([[-60, -90.5], [-90, -90.5], [-120, -90.5], [-150, -90.5], [-166, -90.5], [-166, -107.5], [-130, -107.5], [-95, -107.5], [-60, -107.5]]),
    prole_a: V([[63, 3], [63, 27.5], [80, 27.5], [100, 27.5], [130, 27.5], [130, 60], [130, 87.5], [165, 87.5], [200, 87.5], [200, 120], [200, 147.5], [165, 147.5], [130, 147.5], [100, 147.5], [63, 147.5], [63, 110], [63, 87.5], [63, 60]]),
    prole_b: V([[130, 207.5], [165, 207.5], [200, 207.5], [235, 207.5], [270, 207.5], [270, 180], [270, 147.5], [270, 120], [270, 87.5], [235, 87.5], [200, 87.5], [200, 120], [200, 147.5], [200, 180], [200, 207.5], [165, 207.5]]),
    inner: V([[60, -81.5], [100, -81.5], [140, -81.5], [180, -81.5], [220, -81.5], [260, -81.5], [292, -81.5], [292, -98.5], [250, -98.5], [200, -98.5], [150, -98.5], [104, -98.5], [60, -98.5]]),
    mansions_road: V([[-14, 50.5], [-40, 50.5], [-80, 50.5], [-120, 50.5], [-160, 50.5], [-160, 69.5], [-120, 69.5], [-80, 69.5], [-40, 69.5], [-14, 69.5]]),
    station_road: V([[-14, 191.5], [-50, 191.5], [-90, 191.5], [-130, 191.5], [-160, 191.5], [-160, 210.5], [-130, 211], [-90, 211], [-50, 210.5], [-14, 210.5]]),
    commute: V([[-16.3, 93.5], [-12, 88], [-12, 60], [-12, 30], [-12, -4], [-8, -16], [-20, -40], [-20, -72], [-8, -96], [0, -108], [0, -112.2]]),
  };
  return paths;
}

// Doors from the street into interiors (targets per docs/architecture.md).
export function doorDefs(pts) {
  return [
    { id: 'mansions', pos: pts.home_door, target: 'mansions_hall', spawn: 'street', label: '승리 맨션 안으로 들어간다' },
    { id: 'minitrue', pos: pts.minitrue_door, target: 'records', spawn: 'entrance', label: '진리부로 들어간다' },
    { id: 'shop', pos: pts.shop_door, target: 'shop', spawn: 'door', label: '골동품 가게 문을 연다' },
    { id: 'pub', pos: pts.pub_door, target: 'pub', spawn: 'door', label: '선술집으로 들어간다' },
    { id: 'obrien', pos: pts.obrien_door, target: 'obrien', spawn: 'door', label: '오브라이언의 집 초인종을 누른다' },
    { id: 'cafe', pos: pts.cafe_door, target: 'cafe', spawn: 'door', label: '밤나무 카페로 들어간다' },
    { id: 'station', pos: pts.station_door, target: 'country', spawn: 'halt', label: '패딩턴역으로 들어간다',
      locked: '지금은 기차를 타고 어디로 떠날 까닭이 없다.' },
  ];
}

// Spawns for G.enter('city', name): standing outside each door, back to it.
export function spawnDefs(pts) {
  const S = (p, dx, dz) => ({ x: p.x, y: p.y, z: p.z, yaw: lookYaw(dx, dz) });
  return {
    home_door: S(pts.home_door, 1, 0),
    minitrue_door: S(pts.minitrue_door, 0, 1),
    monument: S(pts.monument, 0, 1),
    shop_door: S(pts.shop_door, 0, -1),
    pub_door: S(pts.pub_door, 0, -1),
    obrien_door: S(pts.obrien_door, 0, 1),
    station_door: S(pts.station_door, 0, -1),
    cafe_door: S(pts.cafe_door, 1, 0),
    community_door: S(pts.community_door, 1, 0),
    rally: S(pts.rally, 0, -1),
    rocket_site: S(pts.rocket_site, 1, 0),
    prole_entry: S(pts.prole_entry, 1, 0),
  };
}

export { blob };
