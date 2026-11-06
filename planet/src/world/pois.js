// Points of interest scattered across the planet: crashed ship wrecks,
// supply caches and alien ruins. Searching them yields materials, research
// data and "eureka" boosts — the reason to explore the far reaches of the map.
import * as THREE from 'three';
import { ModelBuilder, C, L, v, e, pipe, hazard, antenna } from '../build/modelkit.js';
import { mulberry32 } from '../core/noise.js';
import { RESEARCH } from '../sim/data.js';
import { makeRockMaterial } from './materials.js';

function wreck(M, rnd) {
  // broken fuselage halves, scattered panels, scorched cargo
  M.add('hull', new THREE.CylinderGeometry(2.2, 2.4, 9, 18, 1, true, 0, Math.PI * 1.4), { pos: v(-3, 1.4, 0), rot: e(Math.PI / 2, 0.3, 0.5), color: C.W2 });
  M.add('hull', new THREE.CylinderGeometry(2.3, 2.3, 0.4, 18), { pos: v(-6.8, 2.2, -1.2), rot: e(Math.PI / 2, 0.3, 0.5), color: C.G2 });
  M.add('hull', new THREE.ConeGeometry(2.2, 4, 18, 1, true), { pos: v(5, 1.0, 2), rot: e(-Math.PI / 2 + 0.3, 0.8, 0.2), color: C.W });
  M.add('glass', new THREE.SphereGeometry(1.4, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), { pos: v(5.8, 1.2, 3.4), rot: e(-1.0, 0.8, 0) });
  for (let i = 0; i < 9; i++) {
    const a = rnd() * 6.28, r = 3 + rnd() * 7;
    M.add('hull', new THREE.BoxGeometry(0.8 + rnd() * 2, 0.06, 0.6 + rnd() * 1.4), { pos: v(Math.cos(a) * r, 0.1 + rnd() * 0.3, Math.sin(a) * r), rot: e(rnd() - 0.5, rnd() * 6, rnd() - 0.5), color: rnd() < 0.3 ? C.O : C.W2 });
  }
  M.add('metal', new THREE.BoxGeometry(3.4, 0.5, 0.6), { pos: v(1.5, 0.6, -2.4), rot: e(0.2, 0.4, 0.6), color: C.G2 });
  pipe(M, [[-1, 0.2, 1.8], [0.5, 1.6, 2.2], [2.0, 0.4, 3.0]], 0.12, C.D);
  // cargo container (searchable)
  M.bb('hull', -1.0, 0, -0.7, 1.0, 1.3, 0.7, C.O);
  M.bb('metal', -1.05, 1.2, -0.75, 1.05, 1.35, 0.75, C.D);
  hazard(M, 0, 0.65, -0.72, 1.6, 0.18, 0.04);
  M.box('blink', 0, 1.42, 0, 0.12, 0.08, 0.12, L.orange);
  M.colCyl(-3, 0, 2.6, 0, 3.2);
  M.colCyl(5, 2, 2.0, 0, 2.6);
  M.col(-1.0, 0, -0.7, 1.0, 1.35, 0.7);
}

function cache(M) {
  M.bb('concrete', -1.6, -1.0, -1.6, 1.6, 0, 1.6, C.CONC2);
  M.cyl('hull', 0, 0, 0, 1.0, 1.8, C.W, 16);
  M.dome('hull', 0, 1.8, 0, 1.0, C.O, 16);
  M.box('metal', 0, 0.9, -0.98, 0.7, 1.1, 0.1, C.G2);
  M.box('emissive', 0, 1.6, -1.0, 0.5, 0.06, 0.04, L.cyan);
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; M.add('metal', new THREE.CylinderGeometry(0.05, 0.06, 1.6, 6), { pos: v(Math.cos(a) * 1.15, 0.6, Math.sin(a) * 1.15), rot: e(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35), color: C.G2 }); }
  antenna(M, 0.4, 2.6, 0.2, 1.4, L.orange);
  M.colCyl(0, 0, 1.0, 0, 2.6);
}

function ruin(M, rnd) {
  // ring of dark monoliths with glowing glyph bands around a central altar
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2, r = 7.5;
    const h = 5 + rnd() * 5;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    M.add('metal', new THREE.BoxGeometry(1.3, h, 0.8), { pos: v(x, h / 2 - 0.3, z), rot: e((rnd() - 0.5) * 0.12, -a, (rnd() - 0.5) * 0.12), color: 0x1b1a22 });
    for (let k = 0; k < 3; k++) M.add('emissive', new THREE.BoxGeometry(1.32, 0.06, 0.82), { pos: v(x, 1.2 + k * h * 0.28, z), rot: e(0, -a, 0), color: 0x8a5cff });
    M.colCyl(x, z, 0.8, 0, h);
  }
  M.cyl('metal', 0, 0, 0, 2.4, 0.6, 0x24222c, 8);
  M.cyl('metal', 0, 0.6, 0, 1.4, 0.9, 0x1b1a22, 8);
  M.add('emissive', new THREE.OctahedronGeometry(0.6, 0), { pos: v(0, 2.4, 0), color: 0xa070ff });
  M.add('emissive', new THREE.TorusGeometry(1.6, 0.05, 6, 32), { pos: v(0, 1.52, 0), rot: e(Math.PI / 2, 0, 0), color: 0x8a5cff });
  M.colCyl(0, 0, 2.4, 0, 1.5);
}

// an old robotic lander from the first survey: leg pads, drill arm, dish
function probe(M, rnd) {
  M.cyl('hull', 0, 1.0, 0, 1.0, 0.9, C.W2, 6);
  M.cyl('metal', 0, 1.9, 0, 1.05, 0.12, C.G2, 6);
  for (let i = 0; i < 3; i++) {
    const a = i / 3 * Math.PI * 2 + 0.3;
    M.add('metal', new THREE.CylinderGeometry(0.05, 0.06, 1.5, 6), { pos: v(Math.cos(a) * 1.2, 0.65, Math.sin(a) * 1.2), rot: e(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5), color: C.G2 });
    M.cyl('metal', Math.cos(a) * 1.6, 0, Math.sin(a) * 1.6, 0.28, 0.06, C.D, 10);
  }
  // tilted dish on a mast, one solar wing snapped and lying in the dust
  M.cyl('metal', 0.4, 2.0, 0.2, 0.05, 1.2, C.G, 6);
  M.add('hull', new THREE.SphereGeometry(0.7, 14, 6, 0, Math.PI * 2, 0, 0.6), { pos: v(0.4, 3.3, 0.2), rot: e(2.2, 0.4, 0), color: C.W });
  M.add('solar', new THREE.BoxGeometry(2.2, 0.05, 1.0), { pos: v(-1.9, 1.5, 0), rot: e(0, 0, 0.1) });
  M.add('solar', new THREE.BoxGeometry(2.2, 0.05, 1.0), { pos: v(2.6, 0.12, 1.4), rot: e(0.15, 0.9, 0.2) });
  // sample drill arm reaching into the ground
  pipe(M, [[0.8, 1.2, -0.6], [1.6, 0.9, -1.2], [1.9, 0.0, -1.5]], 0.07, C.G2);
  M.box('blink', 0, 2.05, 0, 0.1, 0.06, 0.1, L.red);
  M.colCyl(0, 0, 1.1, 0, 2.0);
}

// a geode: a rough boulder split in two, the halves fallen apart so the
// crystal-lined cut faces look at each other across the gap
function geode(M, rnd) {
  const R = 2.0;
  for (const sd of [-1, 1]) {
    const cx = sd * 0.9;
    const half = new THREE.SphereGeometry(R, 20, 14, 0, Math.PI);       // z >= 0 half...
    half.rotateY(sd * Math.PI / 2);                                       // ...turned to face away from the gap
    const P = half.attributes.position, q = new THREE.Vector3();
    for (let i = 0; i < P.count; i++) { q.fromBufferAttribute(P, i); const n = 1 + 0.12 * Math.sin(q.x * 3.1 + q.y * 2.3) * Math.cos(q.z * 2.7); P.setXYZ(i, q.x * n, q.y * n, q.z * n); }
    half.computeVertexNormals();
    M.add('rock', half, { pos: v(cx, 0.9, 0), rot: e(0, 0, sd * 0.12), scale: v(1, 0.78, 1) });
    // cut face: dark agate rim around a hollow lined with crystals
    const face = new THREE.CircleGeometry(R * 0.96, 28); face.rotateY(-sd * Math.PI / 2);
    M.add('rock', face, { pos: v(cx - sd * 0.01, 0.9, 0), rot: e(0, 0, sd * 0.12), scale: v(1, 0.78, 1) });
    const ring = new THREE.TorusGeometry(R * 0.72, 0.1, 6, 28); ring.rotateY(-sd * Math.PI / 2);
    M.add('concrete', ring, { pos: v(cx - sd * 0.03, 0.9, 0), rot: e(0, 0, sd * 0.12), scale: v(1, 0.78, 1), color: 0xb9a7c4 });
    for (let k = 0; k < 26; k++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * R * 0.62;
      const cr = new THREE.ConeGeometry(0.07 + rnd() * 0.07, 0.3 + rnd() * 0.35, 6); cr.rotateZ(sd * Math.PI / 2);
      M.add('emissive', cr, { pos: v(cx - sd * 0.15, 0.9 + Math.sin(a) * r * 0.78, Math.cos(a) * r), rot: e((rnd() - 0.5) * 0.6, (rnd() - 0.5) * 0.6, 0), color: rnd() < 0.55 ? 0x7ad8ff : 0xb48cff });
    }
  }
  M.colCyl(-1.4, 0, 1.4, 0, 2.4);
  M.colCyl(1.4, 0, 1.4, 0, 2.4);
}

const KINDS = {
  wreck: { name: '추락한 수송선 잔해', fn: wreck },
  cache: { name: '보급 캡슐', fn: cache },
  ruin: { name: '고대 유적', fn: ruin },
  probe: { name: '옛 탐사 착륙선', fn: probe },
  geode: { name: '결정 정동', fn: geode },
};

export class POIs {
  constructor(game) {
    this.game = game;
    this.active = new Map();     // id -> {poi, group, cols}
    this.discovered = new Map(); // id -> {kind, x, z, name}
    this.models = {};
  }

  model(kind, seed) {
    const M = new ModelBuilder();
    KINDS[kind].fn(M, mulberry32(seed));
    return M.finish();
  }

  spawn(p) {
    if (this.active.has(p.id)) return;
    const g = this.game;
    const seed = p.id.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0;
    const model = this.model(p.kind, seed);
    const group = new THREE.Group();
    const mats = g.buildings.mats;
    for (const part of model.parts) {
      const m = new THREE.Mesh(part.geo, part.key === 'rock' ? (this._rockMat || (this._rockMat = makeRockMaterial())) : (mats[part.key] || mats.hull));
      m.castShadow = part.key !== 'emissive' && part.key !== 'blink';
      m.receiveShadow = true;
      group.add(m);
    }
    const y = g.terrain.gen.sample(p.x, p.z) - (p.kind === 'wreck' ? 0.6 : 0);
    group.position.set(p.x, y, p.z);
    group.rotation.y = p.rot;
    g.engine.scene.add(group);
    const c = Math.cos(p.rot), s = Math.sin(p.rot);
    const cols = model.colliders.map((k) => {
      const wx = p.x + k.x * c + k.z * s, wz = p.z - k.x * s + k.z * c;
      return k.cyl ? g.colliders.addCyl(wx, wz, k.r, y + k.y0, y + k.y1, null, { poi: p }) : g.colliders.addBox(wx, wz, k.hx, k.hz, p.rot, y + k.y0, y + k.y1, null, { poi: p });
    });
    this.active.set(p.id, { poi: p, group, cols, y });
  }

  despawn(p) {
    const a = this.active.get(p.id);
    if (!a) return;
    this.game.engine.scene.remove(a.group);
    for (const c of a.cols) this.game.colliders.remove(c);
    this.active.delete(p.id);
  }

  nearest(pos, r = 5) {
    let best = null, bd = r;
    for (const a of this.active.values()) {
      const d = Math.hypot(a.poi.x - pos.x, a.poi.z - pos.z);
      if (d < bd) { bd = d; best = a; }
    }
    return best;
  }

  name(kind) { return KINDS[kind].name; }

  update(pos) {
    for (const a of this.active.values()) {
      const p = a.poi;
      if (!this.discovered.has(p.id) && Math.hypot(p.x - pos.x, p.z - pos.z) < 160) {
        this.discovered.set(p.id, { kind: p.kind, x: p.x, z: p.z, name: KINDS[p.kind].name });
        this.game.ui && this.game.ui.toast('발견: ' + KINDS[p.kind].name, 'info', 3);
      }
    }
  }

  search(a) {
    const g = this.game;
    const p = a.poi;
    if (g.props.searched.has(p.id)) return { already: true };
    g.props.searched.add(p.id);
    const rnd = mulberry32((p.id.length * 7919 + Math.floor(p.x * 13 + p.z * 7)) >>> 0);
    const loot = [];
    const give = (id, n) => { const k = g.eco.give(id, n); if (k) loot.push([id, k]); };
    let rp = 0, eureka = null;
    if (p.kind === 'wreck') {
      give('plate', 4 + Math.floor(rnd() * 5)); give('circuit', 1 + Math.floor(rnd() * 3)); if (rnd() < 0.6) give('alloy', 2 + Math.floor(rnd() * 3)); give('glass', 2 + Math.floor(rnd() * 3));
      rp = 25;
    } else if (p.kind === 'cache') {
      give('plate', 3); give('glass', 3); give('water', 4); if (rnd() < 0.5) give('cobalt', 3); if (rnd() < 0.4) give('seeds', 3);
      rp = 12;
    } else if (p.kind === 'probe') {
      give('circuit', 2 + Math.floor(rnd() * 2)); give('electronics', 1 + Math.floor(rnd() * 2)); give('alloy', 2);
      rp = 40;
    } else if (p.kind === 'geode') {
      give('cobalt', 4 + Math.floor(rnd() * 4)); give('silicon', 6 + Math.floor(rnd() * 6)); if (rnd() < 0.4) give('uranium', 2);
      rp = 20;
    } else {
      rp = 60;
      const av = RESEARCH.filter((r) => !g.research.has(r.id) && !g.research.eureka.has(r.id));
      if (av.length) { eureka = av[Math.floor(rnd() * Math.min(av.length, 5))]; g.research.grantEureka(eureka.id); }
    }
    g.research.addPoints(rp);
    return { loot, rp, eureka };
  }

  serialize() { return [...this.discovered.entries()]; }
  load(arr) { this.discovered = new Map(arr || []); }
}
