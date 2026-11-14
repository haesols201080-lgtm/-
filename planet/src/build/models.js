// Procedural building models. Local frame: origin at footprint centre,
// y = 0 is the walkable floor (top of the concrete pad), the door/front faces
// -Z. Every model returns parts by material plus colliders, interior volumes
// and light points via ModelBuilder.finish(). Every building is built in the
// agency's hardware language (nasakit.js); this file keeps the ship's
// colliders and the plain infrastructure (foundation, lamp, beacon, pylon,
// road, space elevator) and registers the rest.
import * as THREE from 'three';
import { ModelBuilder, C, L, v, e, plinth, antenna } from './modelkit.js';
import { N } from './nasakit.js';
import * as NASA from './models_nasa.js';
import * as AG from './models_agency.js';
import * as AG2 from './models_agency2.js';
import * as AG3 from './models_agency3.js';
import * as HOMES from './models_houses.js';
import * as AG5 from './models_agency5.js';

const PI = Math.PI;

// ------------------------------------------------------------------ base
// The expedition ship stands here; its meshes are a ShipRig (npc/craft.js)
// shared with the colony ships. The model only carries its colliders.
function pod(M) {
  M.colCyl(0, 0, 4.6, 0, 50);
  for (let k = 0; k < 6; k++) { const a = k * PI / 3 + PI / 6; M.colCyl(Math.cos(a) * 5.6, Math.sin(a) * 5.6, 0.65, 0, 1.2); }
  M.col(-3.4, 0, 4.85, 3.4, 0.22, 8.45);
  M.light(0, 3, 8, L.warm, 4, 12);
}

function foundation(M) {
  M.bb('concrete', -4, -1.0, -4, 4, 0, 4, C.CONC);
  M.bb('metal', -4.05, -0.18, -4.05, 4.05, -0.02, 4.05, C.G2);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    M.bb('metal', sx * 3.4 - 0.3, -14, sz * 3.4 - 0.3, sx * 3.4 + 0.3, -1.0, sz * 3.4 + 0.3, C.G2);
    M.bb('metal', sx * 3.4 - 0.45, -1.15, sz * 3.4 - 0.45, sx * 3.4 + 0.45, -1.0, sz * 3.4 + 0.45, C.D);
  }
  M.bb('metal', -3.4, -2.2, -0.15, 3.4, -1.0, 0.15, C.G);
  M.bb('metal', -0.15, -2.2, -3.4, 0.15, -1.0, 3.4, C.G);
  // edge hazard markings (painted just above the slab)
  for (const [x0, z0, x1, z1] of [[-4, -4, 4, -3.82], [-4, 3.82, 4, 4], [-4, -3.82, -3.82, 3.82], [3.82, -3.82, 4, 3.82]]) {
    M.add('hull', new THREE.BoxGeometry(Math.abs(x1 - x0), 0.012, Math.abs(z1 - z0)), {
      pos: v((x0 + x1) / 2, 0.006, (z0 + z1) / 2),
      color: (lx, ly, lz) => (Math.floor((lx + lz) * 2.2 + 50) & 1 ? [0.92, 0.7, 0.08] : [0.12, 0.12, 0.12]),
    });
  }
  M.col(-4, -1.0, -4, 4, 0, 4);
}

function lamp(M) {
  M.cyl('concrete', 0, -1, 0, 0.35, 1.15, C.CONC2, 12);
  M.cyl('metal', 0, 0, 0, 0.08, 5, C.G2, 8, 0.06);
  M.box('metal', 0, 5.0, -0.4, 0.2, 0.12, 1.0, C.D);
  M.box('emissive', 0, 4.92, -0.65, 0.16, 0.04, 0.5, L.warm);
  M.colCyl(0, 0, 0.2, 0, 5);
  M.light(0, 4.6, -0.65, L.warm, 30, 22);
}

function beacon(M) {
  for (let i = 0; i < 3; i++) {
    const a = i / 3 * PI * 2;
    M.add('metal', new THREE.CylinderGeometry(0.04, 0.05, 1.6, 6), { pos: v(Math.cos(a) * 0.35, 0.7, Math.sin(a) * 0.35), rot: e(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4), color: C.G2 });
  }
  M.cyl('hull', 0, 1.3, 0, 0.18, 0.3, C.O, 12);
  M.sphere('blink', 0, 1.75, 0, 0.18, L.orange, 12);
  M.colCyl(0, 0, 0.3, 0, 1.6);
}

function pylon(M) {
  M.cyl('concrete', 0, -1, 0, 0.6, 1.2, C.CONC2, 10);
  const H = 9;
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    M.add('metal', new THREE.CylinderGeometry(0.05, 0.07, H + 0.4, 6), { pos: v(sx * 0.3, H / 2, sz * 0.3), rot: e(sz * -0.035, 0, sx * 0.035), color: C.G });
  }
  for (let y = 1; y < H; y += 1.5) {
    const w = 0.6 * (1 - y / H * 0.6) + 0.1;
    for (const [a, b] of [[[-w, -w], [w, w]], [[w, -w], [-w, w]]]) {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      M.add('metal', new THREE.CylinderGeometry(0.025, 0.025, len * 1.1, 4), { pos: v(0, y + 0.6, 0), rot: e(PI / 2, Math.atan2(b[0] - a[0], b[1] - a[1]), 0.6), color: C.G2 });
    }
  }
  M.box('metal', 0, H, 0, 2.6, 0.18, 0.18, C.G2);
  for (const x of [-1.1, 1.1]) {
    M.cyl('hull', x, H + 0.1, 0, 0.1, 0.45, 0x9a6e44, 8);
    for (let k = 0; k < 3; k++) M.cyl('hull', x, H + 0.15 + k * 0.13, 0, 0.16, 0.04, 0x7a4e2c, 10);
  }
  M.sphere('blink', 0, H + 0.5, 0, 0.1, L.red, 8);
  M.colCyl(0, 0, 0.45, 0, H);
}

function road(M) {
  M.bb('concrete', -2, -1.0, -4, 2, -0.02, 4, C.CONC2);
  M.add('concrete', new THREE.BoxGeometry(3.6, 0.04, 8), { pos: v(0, 0.0, 0), color: C.ASPH });
  M.bb('concrete', -2.0, -0.02, -4, -1.8, 0.12, 4, C.CONC);
  M.bb('concrete', 1.8, -0.02, -4, 2.0, 0.12, 4, C.CONC);
  for (let i = 0; i < 4; i++) M.bb('hull', -0.06, 0.02, -3.5 + i * 2, 0.06, 0.03, -2.6 + i * 2, C.Y);
  M.col(-2, -1.0, -4, 2, 0.02, 4);
}

function elevator(M) {
  plinth(M, 16, 16);
  // anchor station: a composite drum with a window band, a turned ring
  // and the tether foot; radiators, tanks and masts around it
  M.cyl('shell', 0, 0, 0, 7.2, 3.0, N.SHELL2, 40);
  M.cyl('shell', 0, 3.0, 0, 7.4, 0.4, N.ORANGE, 40);
  M.cyl('shell', 0, 3.4, 0, 5.6, 6.0, N.SHELL, 36);
  for (const y of [3.45, 6.0, 9.3]) M.add('metal', new THREE.TorusGeometry(5.62, 0.07, 6, 48), { pos: v(0, y, 0), rot: e(PI / 2, 0, 0), color: N.FRAME });
  for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2; M.box('glass', Math.cos(a) * 5.62, 6.0, Math.sin(a) * 5.62, 0.04, 3.4, 2.2, -a); }
  M.cyl('metal', 0, 9.4, 0, 4.0, 1.0, N.STEEL, 28);
  // tether: tall tapering spire going up to the sky
  M.cyl('shell', 0, 10.4, 0, 1.6, 120, N.SHELL, 16, 0.6);
  M.cyl('emissive', 0, 10.4, 0, 0.62, 1200, L.cyan, 8, 0.4);
  for (let i = 0; i < 8; i++) M.cyl('shell', 0, 20 + i * 14, 0, 2.2 - i * 0.12, 0.6, N.ORANGE, 16);
  // climber car
  const car = M.animGroup('shell', { pivot: [0, 0, 0], axis: [0, 1, 0], speed: 0.4 });
  car.add(new THREE.CylinderGeometry(2.4, 2.4, 2.4, 16), { pos: v(0, 40, 0), color: N.SHELL2 });
  for (const [x, z] of [[-6.6, -6.6], [6.6, -6.6], [-6.6, 6.6], [6.6, 6.6]]) antenna(M, x, 0, z, 5);
  for (let k = 0; k < 4; k++) {
    const a = k / 4 * PI * 2 + PI / 4, x = Math.cos(a) * 7.4, z = Math.sin(a) * 7.4;
    M.box('metal', x, 1.6, z, 0.06, 2.4, 1.6, N.RAD, -a);
    M.box('metal', x, 2.85, z, 0.1, 0.08, 1.7, N.FRAME, -a);
  }
  M.colCyl(0, 0, 7.3, 0, 9.4);
  M.colCyl(0, 0, 1.7, 9.4, 130);
}

// ------------------------------------------------------------------ registry
const BUILDERS = { pod, foundation, lamp, beacon, pylon, road, elevator };

// the agency's operations centre and clinic, each with its open-air form
Object.assign(BUILDERS, { cityhall: NASA.cityhall, clinic: NASA.clinic, 'cityhall@open': NASA.cityhallOpen, 'clinic@open': NASA.clinicOpen });
// service buildings of the agency base, each with its open-air form
for (const t of ['lifesupport', 'sewage', 'recycling', 'firestation', 'police', 'nursery', 'tradepost', 'school', 'lab', 'market']) {
  BUILDERS[t] = (M) => AG[t](M, false);
  BUILDERS[t + '@open'] = (M) => AG[t](M, true);
}
// colony buildings, second batch
for (const t of ['lounge', 'gym', 'textile', 'orchard', 'pharma', 'transit', 'university', 'factory', 'techplant', 'hq', 'farm', 'pump', 'park', 'culture', 'monument']) {
  BUILDERS[t] = (M) => AG2[t](M, false);
  BUILDERS[t + '@open'] = (M) => AG2[t](M, true);
}
// base, power, terraforming and industry hardware in the agency kit
for (const t of ['habitat', 'storage', 'fabricator', 'terminal', 'solar', 'wind', 'reactor', 'powerbank', 'vegetube', 'seeder', 'algae', 'treespreader', 'insectdome', 'mirror', 'extractor', 'smelter', 'assembler', 'dronehub', 'depot', 'comms']) BUILDERS[t] = AG3[t];
Object.assign(BUILDERS, { heater: (M) => AG3.heater(M, false), heater2: (M) => AG3.heater(M, true), drill: (M) => AG3.drill(M, false), drill2: (M) => AG3.drill(M, true) });
// the newer working parts: field gear, science, power, atmosphere, methane
for (const t of ['o2station', 'shelter', 'analyzer', 'radar', 'observatory', 'weather', 'rtg', 'geothermal', 'gasturbine', 'solarthermal', 'ghgplant', 'microbevat', 'fishery', 'faunareserve', 'magshield', 'comet', 'sabatier', 'crusher', 'chemplant', 'spaceport', 'hospital', 'library', 'mall', 'bank', 'spa', 'stadium', 'hotel']) BUILDERS[t] = AG5[t];
// homes, two designs per tier, in the same hardware language
for (let t = 0; t < 10; t++) { BUILDERS['house:' + t] = HOMES['house' + t]; BUILDERS['house:' + t + 'b'] = HOMES['house' + t + 'b']; }

// a building type that has an open-air form for after the air is breathable
export function hasOpenForm(type) { return !!BUILDERS[type + '@open']; }

const cache = new Map();
// mirrored variant (key suffix ':m'): flips X, fixes triangle winding, colliders, lights, doors
function mirrorModel(src) {
  const parts = src.parts.map((p) => {
    const g = p.geo.clone();
    const P = g.attributes.position, N = g.attributes.normal;
    for (let i = 0; i < P.count; i++) { P.setX(i, -P.getX(i)); N.setX(i, -N.getX(i)); }
    for (let i = 0; i < P.count; i += 3) {
      for (const name of Object.keys(g.attributes)) {
        const a = g.attributes[name], k = a.itemSize;
        for (let c = 0; c < k; c++) { const t = a.array[(i + 1) * k + c]; a.array[(i + 1) * k + c] = a.array[(i + 2) * k + c]; a.array[(i + 2) * k + c] = t; }
      }
    }
    let anim = p.anim;
    if (anim && anim.pivot) anim = { ...anim, pivot: [-anim.pivot[0], anim.pivot[1], anim.pivot[2]], axis: [anim.axis[0], -anim.axis[1], -anim.axis[2]] };
    if (anim && anim.slide) anim = { slide: [-anim.slide[0], anim.slide[1], anim.slide[2]] };
    g.computeBoundingBox(); g.computeBoundingSphere();
    return { ...p, geo: g, anim };
  });
  return {
    parts,
    colliders: src.colliders.map((c) => ({ ...c, x: -c.x })),
    interiors: src.interiors.map((r) => ({ ...r, x0: -r.x1, x1: -r.x0 })),
    lights: src.lights.map((l) => ({ ...l, x: -l.x })),
    doors: src.doors.map((d) => ({ ...d, x: -d.x })),
    vents: (src.vents || []).map((q) => ({ ...q, x: -q.x })),
    entries: src.entries ? src.entries.map((x) => -x) : src.entries,
    height: src.height,
  };
}

export function getModel(key) {
  if (cache.has(key)) return cache.get(key);
  if (key.endsWith(':m')) {
    const model = mirrorModel(getModel(key.slice(0, -2)));
    model.key = key;
    cache.set(key, model);
    return model;
  }
  const fn = BUILDERS[key];
  if (!fn) throw new Error('no model ' + key);
  const M = new ModelBuilder();
  fn(M);
  const model = M.finish();
  model.key = key;
  cache.set(key, model);
  return model;
}

export function modelKeys() { return Object.keys(BUILDERS); }
