// The stranger's house: a two-storey detached house in the outer boroughs of New York, at night. Upstairs the
// stranger sleeps (the picnic basket with Seven in it stands on the dresser); a straight flight of stairs goes down to
// the hall; downstairs are the living room (the front window onto the street, a brick fireplace), and the kitchen,
// whose back door has a cat flap out to the deck and the backyard - and beyond the fence, the lights of Manhattan.
// Real sizes (a riser is 19.7 cm, more than half the robot's height). Walls, floors and fabrics are Poly Haven scans
// (CC0); the furniture is scanned too and collides as its own mesh. x = east, z = south (the street is north).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildNeighborhood, glow } from './nyc.js';
import HOUSE_MATS from './house_mats.json';
import HOUSE_LM from './house_lm.json';
import { Person } from './person.js';
import { Quilt } from './quilt.js';
import { fabric, undersideOf, makeMattress, makePillow } from './bedding.js';

// a surface with its light baked: the point lights and the sky fill are in the bake already (the moon and the spot lights,
// which move or switch, stay real-time)
const LIGHTS_BAKED = THREE.ShaderChunk.lights_fragment_begin.replace(/NUM_POINT_LIGHTS > 0/g, '0 > 1').replace(/NUM_HEMI_LIGHTS > 0/g, '0 > 1');

export const HOUSE = {
  x0: -5, x1: 5, z0: -4, z1: 4, T: 0.14,
  H: 2.75, U: 2.95, H2: 2.6,                       // ground-floor ceiling, upstairs floor level, upstairs ceiling height
  part: 1.6,                                        // living room & kitchen (west) | hall (east)
  kz: 0.2,                                          // living room | kitchen
  hz: 1.2,                                          // hall | mud room
  stair: { x0: 3.85, x1: 4.85, zTop: -3.0, zBot: 0.75, n: 15 },
  frontWin: [-4.0, -1.2], winY: [0.8, 2.3], frontDoor: [2.3, 3.3],
  backDoor: [-1.3, -0.4], kitWin: [-4.1, -2.5],
  bedDoor: [-1.5, -0.6], bedWin: [-3.6, -1.6],
  livOpen: [-2.6, -1.0], kitDoor: [-1.0, 0.2], hallKit: [0.3, 1.1],
  yard: { y: -0.6, deck: -0.06 },
};
export const FLAT = HOUSE;   // (the level code's name for it)
// what the robot's feet are on (the footsteps, and how much noise they make), by the house's material
const SURF_OF = {
  oak: 'floor', tread: 'tread', deck: 'tread', porch_floor: 'tread', tile: 'lino', rug: 'rug', rug_bed: 'rug', runner: 'rug', carpet_grey: 'rug', sisal: 'rug',
  counter: 'stone', hearth: 'stone', brick: 'stone', concrete: 'stone', foundation: 'stone', splash: 'stone', ceramic: 'stone', glass: 'stone', lamp_glass: 'stone', mug_blue: 'stone',
  asphalt: 'rock', shingle: 'rock', lawn: 'grass', duvet: 'cloth', mattress: 'cloth', linen: 'cloth', throw: 'cloth', knit: 'cloth', curtain: 'cloth', towel: 'cloth', coat: 'cloth', jeans: 'cloth', sock: 'cloth', shade: 'cloth',
  iron: 'metal', steel: 'metal', brass: 'metal', black_metal: 'metal', fridge: 'metal', vent: 'metal', flue: 'metal', gutter: 'metal', enamel: 'panel',
  plastic_white: 'plastic', plastic_dark: 'plastic', bin_plastic: 'plastic', cardboard: 'paper', book_page: 'paper', cover_red: 'paper', cover_blue: 'paper', cover_green: 'paper', cover_tan: 'paper',
};
const surfaceOf = (mat) => SURF_OF[mat] || 'wood';
const furnSurface = (nm) => /wooden|School|Rocking|Desk|Console|Nightstand|Table|Shelf|Cabinet|Drawer|chest/i.test(nm) ? 'wood'
  : /Sofa|Chair|Ottoman|pillow|cushion|bed|mattress|pouf/i.test(nm) ? 'cloth' : /wash|dryer|stove|fridge|radiator|trash|bin|can_|bucket|Lantern|kettle|pot_/i.test(nm) ? 'metal'
  : /plant|vase|planter|ceramic/i.test(nm) ? 'stone' : /suitcase|box|crate/i.test(nm) ? 'plastic' : /book|paper|magazine/i.test(nm) ? 'paper' : 'wood';

function boxGeo(w, h, d, tile = 1) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] / tile, uv.getY(i) * dims[f][1] / tile); }
  return g;
}
function scanMat(T, color = 0xffffff, extra = {}) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0, ...extra });
  if (T) { for (const t of [T.map, T.normal, T.orm]) t.wrapS = t.wrapT = THREE.RepeatWrapping; Object.assign(m, { map: T.map, normalMap: T.normal, roughnessMap: T.orm, aoMap: T.orm }); }
  return m;
}
function checkerTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.fillStyle = (x + y) % 2 ? '#1d1d1f' : '#e9e5dc'; g.fillRect(x * 32, y * 32, 32, 32); }
  g.strokeStyle = 'rgba(120,110,100,0.5)'; g.lineWidth = 1.5; for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, 256); g.moveTo(0, i * 32); g.lineTo(256, i * 32); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
}

export class Flat {
  constructor(ctx, A) {
    this.ctx = ctx; this.A = A; this.scene = ctx.scene; this.R = ctx.RAPIER; this.W = ctx.physics;
    this.group = new THREE.Group(); this.scene.add(this.group);
    // the house as modelled in Blender (blender/build_house.py): walls, floors, stairs, windows, doors, mouldings,
    // the kitchen, the furniture, the outside; the procedural shell below then only gives the colliders and the
    // things that move or matter to the game
    this.arch = A.models.h_house_arch || null; this.keep = new Set(); this.bedDY = this.arch ? 0.12 : 0;
  }
  keepVis(...o) { for (const x of o) if (x) this.keep.add(x); }
  // the modelled house's materials, as in blender/build_house.py (house_mats.json): scanned sets with their tile size
  // (UV0 is in metres), tint, normal strength and roughness; plain paints and metals by colour
  archMats() {
    const sets = this.A.tex.sets || {}, out = {};
    const tile = (S, t) => { if (!S) return {}; const c = (x) => { if (!x) return null; const y = x.clone(); y.wrapS = y.wrapT = THREE.RepeatWrapping; y.repeat.set(1 / t, 1 / t); y.needsUpdate = true; return y; }; return { map: c(S.map), normalMap: c(S.normal), roughnessMap: c(S.orm) }; };
    for (const [name, d] of Object.entries(HOUSE_MATS)) {
      if (d.set) {
        const m = new THREE.MeshStandardMaterial({ color: d.tint, roughness: d.rough, metalness: 0, ...tile(sets[d.set], d.tile), envMapIntensity: 0.5 });
        m.normalScale.setScalar(d.normal); out[name] = m;
      } else out[name] = new THREE.MeshStandardMaterial({ color: new THREE.Color(d.color), roughness: d.rough, metalness: d.metal || 0, envMapIntensity: 0.6 });
    }
    // (the curtains: the jacquard scan they were tinted from is a burgundy one, and showed through as red; they are
    // lined drapes in a warm beige cotton, the bedding's scanned weave, with a cloth's sheen)
    if (sets.hs_sheet) out.curtain = fabric(sets.hs_sheet, { tile: 0.29, color: 0xcbbca2, sheenColor: 0xeadfca, sheenRoughness: 0.6, crinkle: 0.6, crease: 0.35 });
    for (const k of ['curtain', 'duvet', 'throw', 'knit', 'jeans', 'towel', 'coat', 'linen', 'shade']) if (out[k]) out[k].side = THREE.DoubleSide;
    out.glass = this.mats.glassM;
    if (out.lamp_glass) { out.lamp_glass.emissive = new THREE.Color(0xffc070); out.lamp_glass.emissiveIntensity = 2.2; }
    return out;
  }
  // the modelled house into the scene: its own materials swapped for the scanned ones by name; it collides as it
  // looks (a robot finds its way under the bed, round the cat tree, over the washing machine); the furniture is listed
  addArch() {
    const root = this.arch.scene; this.archRoot = root; this.group.add(root); root.updateMatrixWorld(true);
    const M = this.archM = this.archMats(); this.furn = [];
    const tops = new Set(), LM = { int: this.A.tex.lmInt, ext: this.A.tex.lmExt }, baked = new Map();
    const bake = (m, atlas) => {
      const lm = LM[atlas]; if (!lm || !m) return m;
      const key = m.uuid + atlas; if (baked.has(key)) return baked.get(key);
      const c = m.clone(); c.lightMap = lm; c.lightMapIntensity = (HOUSE_LM[atlas] || 1) * Math.PI * (HOUSE_LM.gain || 1); c.envMapIntensity = Math.min(c.envMapIntensity ?? 1, 0.35);
      c.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <lights_fragment_begin>', LIGHTS_BAKED); };
      c.customProgramCacheKey = () => 'baked';
      baked.set(key, c); return c;
    };
    this.baked = !!(LM.int || LM.ext);
    root.traverse((o) => {
      if (!o.isMesh) return;
      let top = o; while (top.parent && top.parent !== root) top = top.parent;
      const nm = top.name || o.name;
      o.castShadow = true; o.receiveShadow = true;
      const atlas = (top.userData || {}).atlas;
      if (/^(arch_|props_|soft_|glass)/.test(nm)) {
        const mat0 = (Array.isArray(o.material) ? o.material[0] : o.material)?.name?.replace(/\.\d+$/, '') || '';
        const sw = (m) => M[m.name.replace(/\.\d+$/, '')] || m;
        o.material = Array.isArray(o.material) ? o.material.map(sw) : sw(o.material);
        if (nm.startsWith('glass')) { o.castShadow = false; o.renderOrder = 2; }
        else if (nm.startsWith('soft_')) { if (nm.startsWith('soft_duvet')) this.softDuvet = o; }       // (cloth: the robot pushes through it)
        else this.meshCollider(o, surfaceOf(mat0));
        o.userData.mat0 = mat0;
      }
      if (o.geometry.attributes.uv1 && (atlas === 'int' || atlas === 'ext')) o.material = Array.isArray(o.material) ? o.material.map((m) => bake(m, atlas)) : bake(o.material, atlas);
      if (nm.startsWith('f_') && !tops.has(top)) {
        tops.add(top); const ud = top.userData || {};
        this.furn.push({ key: ud.key || nm.slice(2).replace(/\.\d+$/, ''), obj: top, box: new THREE.Box3().setFromObject(top) });
        if (ud.collide) this.meshCollider(top, furnSurface(nm));
      }
    });
  }
  // (with the modelled house, a piece of furniture is the model's own: the one of that kind nearest the spot)
  archPiece(key, x, z) {
    let best = null, bd = 1e9;
    for (const f of this.furn || []) if (f.key === key) { const c = f.box.getCenter(new THREE.Vector3()), d = Math.hypot(c.x - x, c.z - z); if (d < bd) { bd = d; best = f; } }
    if (!best) return null;
    best.obj.userData.box = best.box; return best.obj;
  }
  collider(desc, surface = 'wood') { const c = this.W.createCollider(desc); c.userData = { kind: 'static', surface }; return c; }
  block(w, h, d, mat, x, y, z, { tile = 1, surface = 'wood', collide = true, shadow = true, rotY = 0 } = {}) {
    const m = new THREE.Mesh(boxGeo(w, h, d, tile), mat); m.position.set(x, y, z); m.rotation.y = rotY;
    m.castShadow = shadow; m.receiveShadow = true; this.group.add(m);
    if (collide) { const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, 0)); this.collider(this.R.ColliderDesc.cuboid(w / 2, h / 2, d / 2).setTranslation(x, y, z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }), surface); }
    return m;
  }
  place(key, x, z, { y = 0, rotY = 0, scale = 1, surface = 'wood', collide = true } = {}) {
    if (this.arch) return this.archPiece(key, x, z);
    const src = this.A.models['h_' + key]; if (!src) return null;
    const o = src.scene.clone(true); o.scale.setScalar(scale); o.rotation.y = rotY;
    o.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(o);
    o.position.set(x - (bb.min.x + bb.max.x) / 2, y - bb.min.y, z - (bb.min.z + bb.max.z) / 2);
    this.group.add(o); o.updateMatrixWorld(true);
    if (collide) this.meshCollider(o, surface);
    o.userData.box = new THREE.Box3().setFromObject(o);
    return o;
  }
  meshCollider(o, surface) {
    const geos = [];
    o.traverse((m) => { if (m.isMesh) { let g = m.geometry.clone().applyMatrix4(m.matrixWorld); for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k); if (g.index) g = g.toNonIndexed(); geos.push(g); } });
    if (!geos.length) return null;
    const g = mergeGeometries(geos, false), v = new Float32Array(g.attributes.position.array);
    const idx = new Uint32Array(v.length / 3); for (let i = 0; i < idx.length; i++) idx[i] = i;
    return this.collider(this.R.ColliderDesc.trimesh(v, idx), surface);
  }
  // a wall along x or z from (a0) to (a1) at the fixed coordinate c, between heights y0..y1, with rectangular openings
  // [[from, to, bottom, top], ...] along its length
  wall(axis, c, a0, a1, y0, y1, openings = [], mat = this.mats.wallM) {
    const T = HOUSE.T, segs = [[a0, a1, y0, y1]];
    const cut = (list, [o0, o1, ob, ot]) => list.flatMap(([s0, s1, b, t]) => {
      if (o1 <= s0 || o0 >= s1 || ot <= b || ob >= t) return [[s0, s1, b, t]];
      const out = [];
      if (o0 > s0) out.push([s0, o0, b, t]); if (o1 < s1) out.push([o1, s1, b, t]);
      const m0 = Math.max(s0, o0), m1 = Math.min(s1, o1);
      if (ob > b) out.push([m0, m1, b, ob]); if (ot < t) out.push([m0, m1, ot, t]);
      return out;
    });
    let list = segs; for (const o of openings) list = cut(list, o);
    for (const [s0, s1, b, t] of list) {
      if (s1 - s0 < 0.005 || t - b < 0.005) continue;
      const mid = (s0 + s1) / 2, len = s1 - s0;
      if (axis === 'x') this.block(len, t - b, T, mat, mid, (b + t) / 2, c, { tile: 1.6 }); else this.block(T, t - b, len, mat, c, (b + t) / 2, mid, { tile: 1.6 });
    }
  }

  build() {
    const Hs = HOUSE, A = this.A.tex, T = Hs.T;
    const floorM = scanMat(A.floor, 0xcfb79a, { envMapIntensity: 0.6 });
    const wallM = scanMat(A.wall, 0xe8dfcf, { envMapIntensity: 0.35 });
    const ceilM = scanMat(A.wall, 0xf1ece2, { envMapIntensity: 0.3 });
    const trimM = new THREE.MeshStandardMaterial({ color: 0xeee9df, roughness: 0.5 });
    const brickM = scanMat(A.brick, 0xb88a78, { envMapIntensity: 0.3 });
    const glassM = new THREE.MeshPhysicalMaterial({ color: 0xcfe0e8, roughness: 0.03, metalness: 0, transparent: true, opacity: 0.1, envMapIntensity: 1.4, depthWrite: false });
    const darkWood = new THREE.MeshStandardMaterial({ color: 0x4a3426, roughness: 0.55 });
    const doorM = new THREE.MeshStandardMaterial({ color: 0xece6da, roughness: 0.45 });
    this.mats = { floorM, wallM, ceilM, trimM, brickM, glassM, darkWood, doorM };
    if (this.arch) this.addArch();
    const W = Hs.x1 - Hs.x0, D = Hs.z1 - Hs.z0, cx = (Hs.x0 + Hs.x1) / 2, cz = (Hs.z0 + Hs.z1) / 2;
    // ---- ground floor slab, the checkered kitchen floor on it, the upstairs slab (with the stairwell left open)
    // (with the modelled house these only catch whatever falls through it: a little below its floors, so the floor
    // under the robot's feet is the model's own - oak, tile, a rug - and its footsteps sound of it)
    const sink = this.arch ? 0.015 : 0;
    this.block(W, 0.2, D, floorM, cx, -0.1 - sink, cz, { tile: 1.2, shadow: false, surface: 'floor' });
    // (the scanned tiles; a drawn checkerboard only if they are missing)
    let kfM;
    if (A.tile) { kfM = scanMat(A.tile, 0xe6e1d8, { envMapIntensity: 0.7, roughness: 0.8 }); kfM.aoMap = null; for (const t of [A.tile.map, A.tile.normal, A.tile.orm]) t.repeat.set((Hs.part - Hs.x0) / 1.6, (Hs.z1 - Hs.kz) / 1.6); }
    else { const chk = checkerTexture(); chk.repeat.set((Hs.part - Hs.x0) / 1.2, (Hs.z1 - Hs.kz) / 1.2); kfM = new THREE.MeshStandardMaterial({ map: chk, roughness: 0.35, envMapIntensity: 0.6 }); }
    const kf = new THREE.Mesh(new THREE.PlaneGeometry(Hs.part - Hs.x0, Hs.z1 - Hs.kz), kfM);
    kf.rotation.x = -Math.PI / 2; kf.position.set((Hs.x0 + Hs.part) / 2, 0.002, (Hs.kz + Hs.z1) / 2); kf.receiveShadow = true; this.group.add(kf);
    this.kitchenFloor = kf;
    const S = Hs.stair, slab = (x0, x1, z0, z1) => { this.block(x1 - x0, Hs.U - Hs.H, z1 - z0, floorM, (x0 + x1) / 2, (Hs.H + Hs.U) / 2 - sink, (z0 + z1) / 2, { tile: 1.2, surface: 'floor' }); };
    slab(Hs.x0, S.x0, Hs.z0, Hs.z1); slab(S.x1, Hs.x1, Hs.z0, Hs.z1); slab(S.x0, S.x1, Hs.z0, S.zTop); slab(S.x0, S.x1, S.zBot, Hs.z1);
    this.block(W + 0.3, 0.12, D + 0.3, ceilM, cx, Hs.U + Hs.H2 + 0.06, cz, { tile: 2 });
    // ---- ground floor walls
    const G0 = 0, G1 = Hs.H;
    this.wall('x', Hs.z0 - T / 2, Hs.x0 - T, Hs.x1 + T, G0, G1, [[...Hs.frontWin, ...Hs.winY], [Hs.frontDoor[0], Hs.frontDoor[1], 0, 2.1]]);
    this.wall('x', Hs.z1 + T / 2, Hs.x0 - T, Hs.x1 + T, G0, G1, [[...Hs.backDoor, 0, 2.05], [...Hs.kitWin, 1.15, 2.1]]);
    this.wall('z', Hs.x0 - T / 2, Hs.z0, Hs.z1, G0, G1); this.wall('z', Hs.x1 + T / 2, Hs.z0, Hs.z1, G0, G1);
    this.wall('z', Hs.part, Hs.z0, Hs.z1, G0, G1, [[...Hs.livOpen, 0, 2.3], [...Hs.hallKit, 0, 2.05]]);
    this.wall('x', Hs.kz, Hs.x0, Hs.part, G0, G1, [[...Hs.kitDoor, 0, 2.05]]);
    this.wall('x', Hs.hz, Hs.part, Hs.x1, G0, G1, [[2.2, 3.0, 0, 2.05]]);
    this.closedDoor('x', Hs.hz, 2.2, 3.0, 0);                                    // mud room
    this.closedDoor('x', Hs.z0 - T / 2, Hs.frontDoor[0], Hs.frontDoor[1], 0, 2.1, 0.06);   // front door
    // ---- upstairs walls
    const U0 = Hs.U, U1 = Hs.U + Hs.H2;
    this.wall('x', Hs.z0 - T / 2, Hs.x0 - T, Hs.x1 + T, U0, U1, [[...Hs.bedWin, U0 + 0.8, U0 + 2.2]]);
    this.wall('x', Hs.z1 + T / 2, Hs.x0 - T, Hs.x1 + T, U0, U1);
    this.wall('z', Hs.x0 - T / 2, Hs.z0, Hs.z1, U0, U1); this.wall('z', Hs.x1 + T / 2, Hs.z0, Hs.z1, U0, U1);
    this.wall('z', Hs.part, Hs.z0, Hs.kz, U0, U1, [[...Hs.bedDoor, U0, U0 + 2.05]]);
    this.wall('x', Hs.kz, Hs.x0, Hs.part, U0, U1);
    this.wall('x', Hs.hz, Hs.part, Hs.x1, U0, U1, [[2.0, 2.8, U0, U0 + 2.05]]);
    this.closedDoor('x', Hs.hz, 2.0, 2.8, U0);
    this.wall('z', Hs.part, Hs.kz, Hs.hz, U0, U1);
    // skirting along the walls the robot walks beside
    const skirt = (axis, c, a0, a1, y) => { const len = a1 - a0; if (axis === 'x') this.block(len, 0.09, 0.016, trimM, (a0 + a1) / 2, y + 0.045, c, { collide: false, shadow: false }); else this.block(0.016, 0.09, len, trimM, c, y + 0.045, (a0 + a1) / 2, { collide: false, shadow: false }); };
    for (const y of [0, U0]) { skirt('x', Hs.z0 + 0.008, Hs.x0, Hs.x1, y); skirt('z', Hs.x0 + 0.008, Hs.z0, Hs.z1, y); skirt('z', Hs.x1 - 0.008, Hs.z0, Hs.z1, y); }
    // crown moulding where the walls meet the ceilings (a cove profile: two steps)
    const crown = (axis, c, a0, a1, y, dir) => { const len = a1 - a0;
      for (const [h, d, dy] of [[0.07, 0.03, -0.035], [0.035, 0.055, -0.0175]]) {
        if (axis === 'x') this.block(len, h, d, trimM, (a0 + a1) / 2, y + dy, c + dir * d / 2, { collide: false, shadow: false }); else this.block(d, h, len, trimM, c + dir * d / 2, y + dy, (a0 + a1) / 2, { collide: false, shadow: false }); } };
    for (const y of [Hs.H, U1]) { crown('x', Hs.z0, Hs.x0, Hs.x1, y, 1); crown('x', Hs.z1, Hs.x0, Hs.x1, y, -1); crown('z', Hs.x0, Hs.z0, Hs.z1, y, 1); crown('z', Hs.x1, Hs.z0, Hs.z1, y, -1); }
    this.stairs(); this.windows(); this.backDoor(); this.yard();
    this.buildBedroom(); this.buildLiving(); this.buildKitchen();
    this.lights();
    this.city = buildNeighborhood(this.scene, this.A);
    if (this.arch) for (const c of this.group.children) if (c !== this.archRoot && !this.keep.has(c) && !c.isLight) c.visible = false;
    return this;
  }
  closedDoor(axis, c, a0, a1, y0, h = 2.05, off = 0.03) {
    const w = a1 - a0, g = new RoundedBoxGeometry(axis === 'x' ? w - 0.02 : 0.045, h - 0.02, axis === 'x' ? 0.045 : w - 0.02, 2, 0.008);
    const m = new THREE.Mesh(g, this.mats.doorM); m.position.set(axis === 'x' ? (a0 + a1) / 2 : c, y0 + h / 2, axis === 'x' ? c + off : (a0 + a1) / 2); m.castShadow = m.receiveShadow = true; this.group.add(m);
    for (const [dy, hh] of [[0.55, 0.7], [1.5, 0.7]]) { const p = new THREE.Mesh(new RoundedBoxGeometry(axis === 'x' ? w * 0.62 : 0.01, hh, axis === 'x' ? 0.01 : w * 0.62, 2, 0.004), this.mats.trimM); p.position.copy(m.position).add(new THREE.Vector3(0, -h / 2 + dy + hh / 2 - 0.25, axis === 'x' ? 0.026 : 0)); this.group.add(p); }
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), new THREE.MeshStandardMaterial({ color: 0xb59a5a, metalness: 0.9, roughness: 0.3 }));
    knob.position.copy(m.position).add(new THREE.Vector3(axis === 'x' ? w / 2 - 0.09 : 0.04, -h / 2 + 0.98, axis === 'x' ? 0.05 : w / 2 - 0.09)); this.group.add(knob);
    this.collider(this.R.ColliderDesc.cuboid(axis === 'x' ? w / 2 : 0.03, h / 2, axis === 'x' ? 0.03 : w / 2).setTranslation(m.position.x, m.position.y, m.position.z));
  }
  stairs() {
    const Hs = HOUSE, S = Hs.stair, rise = Hs.U / S.n, run = (S.zBot - S.zTop) / S.n, { floorM, trimM, darkWood } = this.mats;
    for (let i = 0; i < S.n; i++) {
      const top = (i + 1) * rise, z1 = S.zBot - i * run, z0 = z1 - run;
      this.block(S.x1 - S.x0, top, run, trimM, (S.x0 + S.x1) / 2, top / 2, (z0 + z1) / 2, { surface: 'wood', shadow: true });
      // a wooden tread with a nosing over each white riser
      const tr = new THREE.Mesh(boxGeo(S.x1 - S.x0, 0.025, run + 0.025, 0.8), floorM); tr.position.set((S.x0 + S.x1) / 2, top - 0.0125, (z0 + z1) / 2 + 0.012); tr.receiveShadow = tr.castShadow = true; this.group.add(tr);
    }
    // the banister round the stairwell upstairs: posts, spindles and a handrail (solid to a small robot)
    const y = Hs.U, rail = (ax, c, a0, a1) => {
      const len = a1 - a0;
      for (let a = a0; a <= a1 + 1e-3; a += 0.12) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.86, 0.025), trimM); sp.position.set(ax === 'z' ? c : a, y + 0.43, ax === 'z' ? a : c); sp.castShadow = true; this.group.add(sp); }
      this.block(ax === 'z' ? 0.07 : len, 0.05, ax === 'z' ? len : 0.07, darkWood, ax === 'z' ? c : (a0 + a1) / 2, y + 0.89, ax === 'z' ? (a0 + a1) / 2 : c, { collide: false });
      this.collider(this.R.ColliderDesc.cuboid(ax === 'z' ? 0.02 : len / 2, 0.45, ax === 'z' ? len / 2 : 0.02).setTranslation(ax === 'z' ? c : (a0 + a1) / 2, y + 0.45, ax === 'z' ? (a0 + a1) / 2 : c));
    };
    rail('z', S.x0 - 0.02, S.zTop + 0.6, S.zBot); rail('x', S.zBot + 0.02, S.x0, S.x1);
    this.stairTop = new THREE.Vector3((S.x0 + S.x1) / 2, Hs.U, S.zTop - 0.35);
    this.stairBottom = new THREE.Vector3((S.x0 + S.x1) / 2, 0, S.zBot + 0.3);
  }
  windows() {
    const Hs = HOUSE, T = Hs.T, { trimM, glassM } = this.mats;
    const frame = (x0, x1, y0, y1, z, inside) => {
      for (const [a, b, c, d] of [[x0, y0, x0 + 0.06, y1], [x1 - 0.06, y0, x1, y1], [x0, y0, x1, y0 + 0.06], [x0, y1 - 0.06, x1, y1], [x0, (y0 + y1) / 2 - 0.03, x1, (y0 + y1) / 2 + 0.03]])
        this.block(c - a, d - b, 0.07, trimM, (a + c) / 2, (b + d) / 2, z, { collide: false });
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, y1 - y0), glassM); gl.position.set((x0 + x1) / 2, (y0 + y1) / 2, z); this.group.add(gl);
      this.collider(this.R.ColliderDesc.cuboid((x1 - x0) / 2, (y1 - y0) / 2, 0.03).setTranslation((x0 + x1) / 2, (y0 + y1) / 2, z), 'glass');
      this.block(x1 - x0 + 0.16, 0.035, 0.22, trimM, (x0 + x1) / 2, y0 - 0.0175, z + inside * 0.1, { surface: 'wood' });   // sill
    };
    frame(...Hs.frontWin, ...Hs.winY, Hs.z0 - T / 2, 1);
    frame(...Hs.bedWin, Hs.U + 0.8, Hs.U + 2.2, Hs.z0 - T / 2, 1);
    frame(...Hs.kitWin, 1.15, 2.1, Hs.z1 + T / 2, -1);
    // curtains in the living room and the bedroom, linen in soft folds
    const curM = scanMat(this.A.tex.linen, 0xc8b89c, { side: THREE.DoubleSide, envMapIntensity: 0.3 });
    const curtain = (xa, xb, y0, y1, gather) => {
      const w = xb - xa, g = new THREE.PlaneGeometry(w, y1 - y0, 48, 10), p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const u = p.getX(i) / w + 0.5; p.setZ(i, Math.sin(u * Math.PI * 2 * 6 * gather) * 0.04); }
      g.computeVertexNormals(); const c = new THREE.Mesh(g, curM); c.position.set((xa + xb) / 2, (y0 + y1) / 2, Hs.z0 + 0.14); c.castShadow = c.receiveShadow = true; this.group.add(c);
    };
    curtain(Hs.frontWin[0] - 0.4, Hs.frontWin[0] + 0.25, 0.3, 2.6, 0.9); curtain(Hs.frontWin[1] - 0.25, Hs.frontWin[1] + 0.4, 0.3, 2.6, 0.9);
    curtain(Hs.bedWin[0] - 0.35, Hs.bedWin[0] + 0.7, Hs.U + 0.25, Hs.U + 2.45, 0.6); curtain(Hs.bedWin[1] - 0.3, Hs.bedWin[1] + 0.35, Hs.U + 0.25, Hs.U + 2.45, 1);
  }
  // the kitchen's back door, glazed at the top, with a cat flap at the bottom (its little lock slides at the top)
  backDoor() {
    const Hs = HOUSE, [x0, x1] = Hs.backDoor, z = Hs.z1 + Hs.T / 2, { doorM, trimM, glassM } = this.mats;
    const f0 = (x0 + x1) / 2 - 0.17, f1 = (x0 + x1) / 2 + 0.17, fh = 0.34, fb = 0.03;
    // the threshold under the door, level with the kitchen floor, out to the deck
    this.keepVis(this.block(x1 - x0 + 0.1, 0.08, 0.3, this.mats.trimM, (x0 + x1) / 2, -0.04, Hs.z1 + 0.08, { surface: 'wood' }));
    const part = (a, b, y0, y1) => this.keepVis(this.block(b - a, y1 - y0, 0.05, doorM, (a + b) / 2, (y0 + y1) / 2, z, { surface: 'wood' }));
    part(x0, f0, 0, 2.05); part(f1, x1, 0, 2.05); part(f0, f1, fb + fh, 1.2); part(f0, f1, 1.9, 2.05);
    this.keepVis(this.block(f1 - f0, fb, 0.05, doorM, (f0 + f1) / 2, fb / 2, z, { collide: false }));          // the flap's bottom lip (stepped over)
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 - 0.1, 0.65), glassM); gl.position.set((x0 + x1) / 2, 1.55, z - 0.03); this.group.add(gl); this.keepVis(gl);
    this.collider(this.R.ColliderDesc.cuboid((x1 - x0) / 2, 0.36, 0.025).setTranslation((x0 + x1) / 2, 1.55, z), 'glass');
    // the flap frame, the flap (hinged at the top) and its lock
    const fr = new THREE.Mesh(new RoundedBoxGeometry(f1 - f0 + 0.05, fh + 0.05, 0.07, 2, 0.01), new THREE.MeshStandardMaterial({ color: 0xd9d6ce, roughness: 0.4 }));
    fr.position.set((f0 + f1) / 2, fb + fh / 2, z); this.group.add(fr); this.keepVis(fr);
    const hinge = new THREE.Group(); hinge.position.set((f0 + f1) / 2, fb + fh, z); this.group.add(hinge); this.keepVis(hinge);
    const flap = new THREE.Mesh(new RoundedBoxGeometry(f1 - f0 - 0.01, fh - 0.01, 0.008, 2, 0.003), new THREE.MeshPhysicalMaterial({ color: 0x9aa0a6, roughness: 0.2, transparent: true, opacity: 0.55 }));
    flap.position.y = -fh / 2; hinge.add(flap);
    this.flapCol = this.collider(this.R.ColliderDesc.cuboid((f1 - f0) / 2, fh / 2, 0.03).setTranslation((f0 + f1) / 2, fb + fh / 2, z));
    const lock = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.022, 0.02, 2, 0.005), new THREE.MeshStandardMaterial({ color: 0xc8442e, roughness: 0.4 }));
    lock.position.set((f0 + f1) / 2 - 0.05, fb + fh + 0.012, z - 0.04); this.group.add(lock); this.keepVis(lock);
    this.flap = { hinge, lock, pos: new THREE.Vector3((f0 + f1) / 2, 0, z - 0.25), lockPos: new THREE.Vector3((f0 + f1) / 2, fb + fh, z - 0.1), x: (f0 + f1) / 2, z };
    // the cat's bowl by the door (no cat tonight)
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.06, 0.05, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0x3a6fb0, roughness: 0.35, side: THREE.DoubleSide }));
    bowl.position.set(x0 - 0.35, 0.025, z - 0.3); this.group.add(bowl); this.keepVis(bowl);
    this.collider(this.R.ColliderDesc.cylinder(0.025, 0.075).setTranslation(bowl.position.x, 0.025, bowl.position.z));
    this.catBowl = bowl.position.clone();
  }
  yard() {
    const Hs = HOUSE, Y = Hs.yard, z = Hs.z1 + Hs.T;
    const deckM = scanMat(this.A.tex.floor, 0x8a7360, { envMapIntensity: 0.4 });
    this.block(3.6, 0.2, 2.0, deckM, -0.85, Y.deck - 0.1, z + 1.0, { tile: 1, surface: 'tread' });                                   // (hollow boards)
    for (let i = 0; i < 3; i++) this.block(1.4, 0.18, 0.3, deckM, -0.85, Y.deck - 0.18 * (i + 1) - 0.09, z + 2.15 + i * 0.3, { surface: 'tread' });
    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(16, 10), new THREE.MeshStandardMaterial({ color: 0x1d2a18, roughness: 1 })); lawn.rotation.x = -Math.PI / 2; lawn.position.set(0, Y.y + 0.005, z + 7); lawn.receiveShadow = true; this.group.add(lawn);
    this.collider(this.R.ColliderDesc.cuboid(8, 0.1, 5).setTranslation(0, Y.y - 0.1, z + 7), 'moss');
    // the backyard fence (boards), the far side open toward the view
    const fenceM = new THREE.MeshStandardMaterial({ color: 0x6b5a48, roughness: 0.9 });
    for (let x = -8; x <= 8; x += 0.16) { if (Math.abs(x) < 3.2) continue; const b = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.6, 0.025), fenceM); b.position.set(x, Y.y + 0.8, z + 11.5); this.group.add(b); }
    const low = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.9, 0.025), fenceM); low.position.set(0, Y.y + 0.45, z + 11.5); this.group.add(low);
    this.yardLook = new THREE.Vector3(-0.85, Y.deck, z + 1.2);
  }

  buildBedroom() {
    const Hs = HOUSE, A = this.A.tex, U = Hs.U;
    const linenM = scanMat(A.linen, 0xa9b4bf, { side: THREE.DoubleSide, envMapIntensity: 0.3 }), pillowM = scanMat(A.linen, 0xe6e2da, { envMapIntensity: 0.3 });
    const { darkWood } = this.mats;
    // the bed with its head against the back (south) wall
    const bx = -3.2, bz = -0.95, BW = 1.6, BL = 2.1;
    const DY = this.bedDY;
    this.block(BW, 0.3, BL, darkWood, bx, U + 0.15, bz, { surface: 'wood', collide: !this.arch });
    this.block(BW + 0.04, 1.0, 0.07, darkWood, bx, U + 0.5, Hs.kz - 0.035, { surface: 'wood', collide: !this.arch });
    const mat = new THREE.Mesh(new RoundedBoxGeometry(BW - 0.05, 0.2, BL - 0.05, 3, 0.05), pillowM); mat.position.set(bx, U + 0.4, bz); mat.receiveShadow = true; this.group.add(mat);
    const pil = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.13, 0.4, 4, 0.06), pillowM); pil.position.set(bx - 0.15, U + 0.56 + DY, Hs.kz - 0.32); pil.rotation.y = 0.08; pil.castShadow = pil.receiveShadow = true; this.group.add(pil); if (!this.arch) this.keepVis(pil);
    // the stranger: asleep on his back under the duvet, his head on the pillow, his forearms on the duvet; the duvet
    // rises and falls (src/person.js: the model and his clips, in his T-shirt). Without the model, a tuft of hair
    if (this.A.models.h_stranger) {
      // on his side of the bed (the lamp's), his head on its pillow, on the mattress (his clips' frame has the mattress
      // top at y = 0: U + 0.5 + DY here)
      const man = this.man = new Person(this.A.models.h_stranger, 'bed');
      man.root.rotation.y = Math.PI;                                   // (his head toward the headboard)
      man.root.position.set(bx - 0.08, U + 0.5 + DY, Hs.kz - 1.1); this.group.add(man.root); this.keepVis(man.root);
      man.play('sleep', { loop: true, fade: 0 }); man.mixer.update(0); man.root.updateMatrixWorld(true);
      const pw = this.arch?.scene.getObjectByName('soft_pillow0'), pc = pw ? new THREE.Box3().setFromObject(pw).getCenter(new THREE.Vector3()) : new THREE.Vector3(bx - 0.14, 0, Hs.kz - 0.3);
      const h = man.bone('head').getWorldPosition(new THREE.Vector3());
      man.root.position.x += pc.x + 0.03 - h.x; man.root.position.z += pc.z + 0.02 - h.z; man.root.updateMatrixWorld(true);
    } else {
      const hair = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshStandardMaterial({ color: 0x1b140f, roughness: 0.55 }));
      hair.scale.set(0.095, 0.085, 0.11); hair.position.set(bx - 0.2, U + 0.66 + DY, Hs.kz - 0.36); hair.castShadow = true; this.group.add(hair); this.keepVis(hair);
    }
    // (the house's alarm clock was set down past the nightstand's front edge, in the air: onto its back corner)
    const clk = this.arch?.scene.getObjectByName('f_alarm_clock_01'), nst = this.arch?.scene.getObjectByName('f_ClassicNightstand_01');
    if (clk && nst) {
      const nb = new THREE.Box3().setFromObject(nst), cb = new THREE.Box3().setFromObject(clk), c = cb.getCenter(new THREE.Vector3());
      clk.position.add(new THREE.Vector3(nb.min.x + 0.11 - c.x, nb.max.y - cb.min.y, nb.max.z - 0.09 - c.z)); clk.updateMatrixWorld(true);
    }
    // (the house's bat was left standing up through the mattress: it lies on the floor under the bed)
    const bat = this.arch?.scene.getObjectByName('f_baseball_bat');
    if (bat) {
      bat.rotateOnWorldAxis(new THREE.Vector3(Math.cos(1.25), 0, -Math.sin(1.25)), Math.PI / 2); bat.updateMatrixWorld(true);
      const bb = new THREE.Box3().setFromObject(bat), c = bb.getCenter(new THREE.Vector3());
      bat.position.add(new THREE.Vector3(bx - c.x, U + 0.003 - bb.min.y, -0.55 - c.z)); bat.updateMatrixWorld(true);
    }
    const dg = new THREE.PlaneGeometry(BW + 0.24, BL - 0.2, 56, 64); dg.rotateX(-Math.PI / 2); dg.translate(bx, 0, bz - 0.1);
    const duvet = new THREE.Mesh(dg, linenM); duvet.castShadow = duvet.receiveShadow = true; this.group.add(duvet); if (!this.softDuvet) this.keepVis(duvet);
    // body under the duvet, head end toward +z (the pillow): shoulders, chest, hip, legs bent
    const body = [[-0.12, 0.72, 0.17, 0.24, 0.2], [-0.1, 0.35, 0.15, 0.22, 0.32], [-0.06, -0.05, 0.19, 0.26, 0.28], [0.0, -0.48, 0.12, 0.2, 0.3], [0.12, -0.62, 0.1, 0.2, 0.2]];
    this.sleeper = { duvet, base: dg.attributes.position.array.slice(), body, bx, bz, BW, BL, stir: 0, U: U + DY, head: new THREE.Vector3(bx, U + 0.7 + DY, Hs.kz - 0.4) };
    if (this.man) this.makeBed({ pil, mattress: mat, duvet }); else this.shapeDuvet(0);
    this.collider(this.R.ColliderDesc.cuboid(BW / 2, 0.06, BL / 2).setTranslation(bx, U + 0.56 + DY, bz), 'fabric');
    // nightstand and the bedside lamp (off; it comes on if the stranger wakes)
    const ns = this.place('ClassicNightstand_01', -4.45, Hs.kz - 0.4, { y: U, rotY: Math.PI / 2 });
    const nsTop = ns ? ns.userData.box.max.y : U + 0.7;
    this.place('desk_lamp_arm_01', -4.45, Hs.kz - 0.42, { y: nsTop, rotY: Math.PI * 0.6, scale: 0.75, collide: false });
    this.place('round_spectacles', -4.42, Hs.kz - 0.2, { y: nsTop, rotY: 2.2, collide: false });
    this.place('modern_ceiling_lamp_01', -2.5, -1.7, { y: U + Hs.H2 - 0.95, collide: false });
    // (its light from the lamp's own bulb, the way the bulb faces: down onto the nightstand and the bed's head; the
    // bulb itself glows only while it is on; and a little of it bounced round the room)
    this.bedLamp = new THREE.SpotLight(0xffc98a, 0, 6, 1.05, 0.7, 1.6); this.bedLamp.position.set(-4.35, nsTop + 0.5, Hs.kz - 0.5); this.bedLamp.target.position.set(-2.6, U, -1.6);
    const lampObj = this.arch?.scene.getObjectByName('f_desk_lamp_arm_01');
    if (lampObj) {
      let bulb = null; lampObj.traverse((o) => { if (o.isMesh && /_light$/.test(o.material?.name || '')) bulb = o; });
      if (bulb) {
        bulb.updateMatrixWorld(true);
        const P = bulb.geometry.attributes.position, N = bulb.geometry.attributes.normal, c = new THREE.Vector3(), n = new THREE.Vector3(), v = new THREE.Vector3(), nm = new THREE.Matrix3().getNormalMatrix(bulb.matrixWorld);
        for (let i = 0; i < P.count; i++) { c.add(v.fromBufferAttribute(P, i).applyMatrix4(bulb.matrixWorld)); if (N) n.add(v.fromBufferAttribute(N, i).applyMatrix3(nm)); }
        c.divideScalar(P.count); if (n.lengthSq() < 1e-6) n.set(0, -1, 0); n.normalize();
        this.bedLamp.position.copy(c).addScaledVector(n, 0.02); this.bedLamp.target.position.copy(c).addScaledVector(n, 1.0);
        this.bulb = bulb.material; this.bulb.emissive = new THREE.Color(0xffd7a0); this.bulb.emissiveIntensity = 0;
      }
    }
    this.bedLamp.castShadow = false; this.bedLamp.shadow.mapSize.set(512, 512); this.group.add(this.bedLamp, this.bedLamp.target);
    // (the bounce: from where the bulb's light lands, just over the nightstand's top, warm and dim)
    { const P = this.bedLamp.position, d = this.bedLamp.target.position.clone().sub(P).normalize(), k = d.y < -0.2 ? Math.max(0.05, (P.y - (nsTop + 0.06)) / -d.y) : 0.3;
      this.bedBounce = new THREE.PointLight(0xffc98a, 0, 3.5, 2); this.bedBounce.position.copy(P).addScaledVector(d, k); this.group.add(this.bedBounce); }
    // the dresser under the window with the picnic basket on it, a chair beside it, a moving box in the corner
    const con = this.place('ClassicConsole_01', -0.4, Hs.z0 + 0.32, { y: U, rotY: 0 });
    const top = con ? con.userData.box.max.y : U + 0.95;
    this.place('GreenChair_01', 0.75, -3.1, { y: U, rotY: -Math.PI / 2 - 0.5 });
    const cbx = this.place('cardboard_box_01', -4.4, -3.55, { y: U, rotY: 0.3 });
    this.place('vintage_video_camera', -4.38, -3.52, { y: cbx ? cbx.userData.box.max.y : U + 0.4, rotY: 0.9, collide: false });
    const bk = new THREE.Group(), src = this.A.models.h_wicker_basket_02?.scene.clone(true);
    let lid = null;
    if (src) { src.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; if (/lid/.test(o.name)) lid = o; } }); src.scale.setScalar(2.1); bk.add(src); }
    bk.position.set(-0.65, top, Hs.z0 + 0.34); bk.rotation.y = Math.PI + 0.25; this.group.add(bk); this.keepVis(bk); bk.updateMatrixWorld(true);
    const hingeL = new THREE.Group(); hingeL.position.set(0, 0.42, -0.222); bk.add(hingeL);
    if (lid) { lid.removeFromParent(); const s2 = new THREE.Group(); s2.scale.setScalar(2.1); s2.add(lid); lid.position.set(0, 0, 0.106); lid.quaternion.identity(); hingeL.add(s2); }
    if (src) { const base2 = src.getObjectByName('wicker_basket_02_base') || src; src.updateMatrixWorld(true); this.meshCollider(base2, 'fabric'); }
    const q = new THREE.Quaternion(); bk.getWorldQuaternion(q);
    this.lidCol = this.collider(this.R.ColliderDesc.cuboid(0.24, 0.02, 0.24).setTranslation(bk.position.x, top + 0.44, bk.position.z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }), 'fabric');
    this.basket = { group: bk, hinge: hingeL, floor: new THREE.Vector3(bk.position.x, top + 0.04, bk.position.z), open: 0 };
    this.chairSeat = new THREE.Vector3(0.75, U + 0.5, -3.1);
    // the bedroom door, left ajar onto the landing (it opens into the bedroom; the gap fits the robot)
    const dw = Hs.bedDoor[1] - Hs.bedDoor[0], hinge = new THREE.Group(); hinge.position.set(Hs.part - Hs.T / 2, U, Hs.bedDoor[1]); this.group.add(hinge);
    const leaf = new THREE.Mesh(new RoundedBoxGeometry(0.045, 2.03, dw - 0.02, 2, 0.008), this.mats.doorM); leaf.position.set(-0.022, 1.02, -dw / 2); leaf.castShadow = leaf.receiveShadow = true; hinge.add(leaf);
    hinge.rotation.y = -0.85; hinge.updateMatrixWorld(true);
    { const qq = new THREE.Quaternion(); hinge.getWorldQuaternion(qq); const p = new THREE.Vector3(-0.022, 1.02, -dw / 2).applyMatrix4(hinge.matrixWorld);
      this.collider(this.R.ColliderDesc.cuboid(0.022, 1.02, dw / 2).setTranslation(p.x, p.y, p.z).setRotation({ x: qq.x, y: qq.y, z: qq.z, w: qq.w })); }
    this.doorGap = new THREE.Vector3(Hs.part, U, Hs.bedDoor[0] + 0.18);
  }
  // the bed made up (src/bedding.js): the mattress in its fitted sheet and two pillows in their cases, all sinking
  // where he lies (he sinks a little into them), and the duvet, as cloth (src/quilt.js): it falls over him and the bed
  // as the house is built and moves with him; it lies on the mattress, the pillows and the bed's frame (as
  // blender/build_house.py made it; the procedural bed's without the modelled house). The modelled bedding is put away
  makeBed({ pil, mattress, duvet }) {
    const Hs = HOUSE, S = this.sleeper, MT = S.U + 0.5, { bx, bz, BW, BL } = S, sets = this.A.tex.sets || {}, man = this.man;
    man.root.position.y -= 0.025; man.root.updateMatrixWorld(true);
    const under = undersideOf(man, { x0: bx - BW / 2, x1: bx + BW / 2, z0: bz - BL / 2, z1: Hs.kz });
    const sheetM = fabric(sets.hs_sheet, { tile: 0.29, sheenColor: 0xf2f0ec, crinkle: 0.6, crease: 0.5 });
    const caseM = fabric(sets.hs_sheet, { tile: 0.29, color: 0xfbf9f5, sheenColor: 0xffffff, crinkle: 0.45, crease: 0.6 });
    const duvetM = fabric(sets.hs_duvet, { tile: 0.27, sheenColor: 0xc9d5e3, sheenRoughness: 0.6, crinkle: 0.5, crease: 1.05, vertexColors: true });
    const W = BW - 0.06, L = BL - 0.06;
    const bedTop = makeMattress({ bx, bz, W, L, top: MT, under, material: sheetM }); this.group.add(bedTop); this.keepVis(bedTop);
    const spots = this.arch ? [[-3.6, Hs.kz - 0.3, 0.06], [-2.8, Hs.kz - 0.28, -0.05]] : [[pil.position.x, pil.position.z, pil.rotation.y]];
    const pillows = spots.map(([x, z, ry], k) => { const p = makePillow({ c: [x, MT, z], ry, seed: k + 1, under, material: caseM }); this.group.add(p); this.keepVis(p); return p; });
    const boxes = [{ c: [bx, MT - 0.105, bz], h: [W / 2, 0.105, L / 2], r: 0.055 }, ...pillows.map((p) => p.userData.collider)];
    if (this.arch) {
      const U = Hs.U, fz = bz - BL / 2;
      boxes.push({ c: [bx - BW / 2 + 0.02, U + 0.36, bz], h: [0.02, 0.06, BL / 2] }, { c: [bx + BW / 2 - 0.02, U + 0.36, bz], h: [0.02, 0.06, BL / 2] },
        { c: [bx, U + 0.635, fz - 0.0375], h: [BW / 2 - 0.04, 0.185, 0.0275] }, { c: [bx - BW / 2 + 0.005, U + 0.45, fz - 0.035], h: [0.035, 0.45, 0.035] },
        { c: [bx + BW / 2 - 0.005, U + 0.45, fz - 0.035], h: [0.035, 0.45, 0.035] }, { c: [bx, U + 0.91, Hs.kz - 0.06], h: [BW / 2 - 0.04, 0.29, 0.02] });
      for (const nm of ['soft_pillow0', 'soft_pillow1']) { const o = this.arch.scene.getObjectByName(nm); if (o) o.visible = false; }
      this.arch.scene.traverse((o) => { if (o.isMesh && o.userData.mat0 === 'mattress') o.visible = false; });
    } else { boxes.push({ c: [bx, Hs.U + 0.5, Hs.kz - 0.035], h: [BW / 2, 0.5, 0.035] }); pil.visible = false; mattress.visible = false; }
    this.quilt = new Quilt({ parent: this.group, material: duvetM, man, boxes, floor: Hs.U,
      layout: { x0: bx - 1.05, x1: bx + 1.05, z0: bz - BL / 2 + 0.06, z1: Hs.kz - 0.54, y: MT + 0.34, nx: 53, nz: 42 },
      field: { x0: bx - BW / 2, x1: bx + BW / 2, z0: bz - BL / 2, z1: bz + BL / 2 } });
    this.keepVis(this.quilt.mesh);
    if (this.softDuvet) this.softDuvet.visible = false;
    duvet.visible = false;
  }
  shapeDuvet(t) {
    const S = this.sleeper;
    if (this.softDuvet) {
      // the modelled duvet: it rises and falls over the chest, a little more when the sleeper stirs
      const g = this.softDuvet.geometry, p = g.attributes.position;
      if (!S.soft) { S.soft = p.array.slice(); this.softDuvet.updateMatrixWorld(true); S.inv = this.softDuvet.matrixWorld.clone(); }
      const br = Math.sin(t * Math.PI * 2 / 4.2) * 0.018 * (1 + S.stir * 0.8), a = p.array, b = S.soft, M = S.inv.elements;
      for (let i = 0; i < p.count; i++) {
        const x = b[i * 3] * M[0] + b[i * 3 + 1] * M[4] + b[i * 3 + 2] * M[8] + M[12] - S.bx, y = b[i * 3] * M[1] + b[i * 3 + 1] * M[5] + b[i * 3 + 2] * M[9] + M[13];
        const z = b[i * 3] * M[2] + b[i * 3 + 1] * M[6] + b[i * 3 + 2] * M[10] + M[14] - S.bz;
        const k = Math.exp(-(((x + 0.08) / 0.32) ** 2) - (((z - 0.4) / 0.38) ** 2)) * (y > S.U + 0.55 ? 1 : 0);
        a[i * 3 + 1] = b[i * 3 + 1] + br * k;
      }
      p.needsUpdate = true; return;
    }
    const p = S.duvet.geometry.attributes.position, a = p.array, b = S.base;
    const br = 1 + 0.045 * Math.sin(t * Math.PI * 2 / 4.2), st = S.stir;
    for (let i = 0; i < p.count; i++) {
      const x = b[i * 3] - S.bx, z = b[i * 3 + 2] - S.bz;
      let h = 0.53 + 0;
      for (const [cx, cz, hh, rx, rz] of S.body) {
        const k = Math.exp(-(((x - cx - st * 0.05) / rx) ** 2) - (((z - cz) / rz) ** 2));
        h += hh * k * (cz > -0.2 ? br : 1) * (1 + st * 0.15);
      }
      const ex = Math.max(0, Math.abs(x) - (S.BW / 2 - 0.04)), ez = Math.max(0, -z - (S.BL / 2 - 0.15));
      h -= (ex + ez) * 2.2; h = Math.max(h, 0.22) + 0.006 * Math.sin(x * 23 + z * 17);
      a[i * 3 + 1] = S.U + h;
    }
    p.needsUpdate = true; S.duvet.geometry.computeVertexNormals();
  }

  buildLiving() {
    const Hs = HOUSE, A = this.A.tex, { brickM, darkWood } = this.mats;
    // the brick fireplace on the west wall: chimney breast, firebox, hearth, mantel
    const fz0 = -3.0, fz1 = -1.4, fd = 0.4;
    this.block(fd, Hs.H, 0.35, brickM, Hs.x0 + fd / 2, Hs.H / 2, fz0 + 0.175, { tile: 0.9 });
    this.block(fd, Hs.H, 0.35, brickM, Hs.x0 + fd / 2, Hs.H / 2, fz1 - 0.175, { tile: 0.9 });
    this.block(fd, Hs.H - 0.8, fz1 - fz0 - 0.7, brickM, Hs.x0 + fd / 2, 0.8 + (Hs.H - 0.8) / 2, (fz0 + fz1) / 2, { tile: 0.9 });
    const fb = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.8, fz1 - fz0 - 0.7), new THREE.MeshStandardMaterial({ color: 0x0e0b09, roughness: 1 })); fb.position.set(Hs.x0 + 0.1, 0.4, (fz0 + fz1) / 2); this.group.add(fb);
    this.collider(this.R.ColliderDesc.cuboid(0.1, 0.4, (fz1 - fz0 - 0.7) / 2).setTranslation(Hs.x0 + 0.1, 0.4, (fz0 + fz1) / 2));
    this.block(0.5, 0.06, fz1 - fz0 + 0.3, brickM, Hs.x0 + fd + 0.2, 0.03, (fz0 + fz1) / 2, { tile: 0.9 });
    this.block(0.24, 0.07, fz1 - fz0 + 0.24, darkWood, Hs.x0 + fd + 0.06, 1.25, (fz0 + fz1) / 2);
    this.place('ceramic_vase_01', Hs.x0 + fd + 0.06, fz0 + 0.3, { y: 1.285, scale: 0.7 });
    this.place('marble_bust_01', Hs.x0 + fd + 0.04, (fz0 + fz1) / 2 + 0.05, { y: 1.285, rotY: Math.PI / 2 + 0.25, scale: 0.72, collide: false });
    this.place('brass_candleholders', Hs.x0 + fd + 0.05, fz1 - 0.32, { y: 1.285, rotY: Math.PI / 2, scale: 0.55, collide: false });
    // sofa facing the fire, a coffee table on a rug, the armchair, the old television by the front window
    const rugM = scanMat(A.rug, 0xd8cfc0, { envMapIntensity: 0.2 });
    const rug = new THREE.Mesh(boxGeo(2.4, 0.018, 1.8, 0.8), rugM); rug.position.set(-2.2, 0.009, -2.2); rug.receiveShadow = true; this.group.add(rug);
    this.collider(this.R.ColliderDesc.cuboid(1.2, 0.009, 0.9).setTranslation(-2.2, 0.009, -2.2), 'fabric');
    this.place('Sofa_01', -0.75, -2.2, { rotY: -Math.PI / 2, surface: 'fabric' });
    const ct = this.place('CoffeeTable_01', -2.3, -2.2, { rotY: Math.PI / 2, scale: 0.8 });
    this.place('chess_set', -2.36, -2.5, { y: ct ? ct.userData.box.max.y : 0.42, rotY: 0.35, scale: 0.75, collide: false });
    this.place('modern_ceiling_lamp_01', -2.3, -2.0, { y: Hs.H - 0.95, collide: false });
    this.place('ArmChair_01', -2.6, -0.6, { rotY: Math.PI + 0.5, surface: 'fabric' });
    this.place('Ottoman_01', -0.9, -0.5, { rotY: 0.3, surface: 'fabric' });
    const tvt = this.place('WoodenTable_02', -0.4, -3.55, { scale: 1.15 }), tvTop = tvt ? tvt.userData.box.max.y : 0.48;
    const tv = this.place('television_02', -0.4, -3.55, { y: tvTop, rotY: Math.PI * 0.85 });
    this.tvLed = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2a1a })); this.keepVis(this.tvLed);
    const tb = tv?.userData.box;
    if (this.arch && tb) { const c = tb.getCenter(new THREE.Vector3()); this.tvLed.position.set(c.x + 0.2, tb.min.y + 0.05, c.z + 0.2); } else this.tvLed.position.set(-0.32, tvTop + 0.04, (tb?.max.z ?? -3.35) + 0.002);
    this.group.add(this.tvLed);
    this.tvLight = new THREE.PointLight(0xff2a1a, 0.08, 0.7, 2); this.tvLight.position.copy(this.tvLed.position).add(new THREE.Vector3(0, 0, 0.03)); this.group.add(this.tvLight);
    this.place('potted_plant_02', -4.4, -3.4, { rotY: 0.5 });
    this.place('potted_plant_04', -2.15, -2.05, { y: 0.42, collide: false });
    this.place('gamepad', -1.6, -1.5, { y: 0.018, rotY: 0.7, collide: false });
    this.place('boombox', 0.55, -3.78, { rotY: -0.08 });
    this.place('cardboard_box_01', -4.45, -0.3, { rotY: 0.15 }); this.place('cardboard_box_01', -3.85, -0.2, { rotY: -0.3, scale: 0.8 });
    // the hall: the muddy rubber boots by the front door
    this.place('rubber_boots', 2.7, -3.55, { rotY: 0.4, collide: false });
    const sc = this.place('vintage_suitcase', 1.98, -3.82, { rotY: 0.05 });
    this.place('binoculars', 2.0, -3.8, { y: sc ? sc.userData.box.max.y : 0.35, rotY: 1.3, collide: false });
    this.notes = [
      { at: this.arch ? new THREE.Vector3(-3.9, 0, -3.05) : new THREE.Vector3(-0.4, 0, -3.1), r: 0.6, text: '브라운관 텔레비전. 대기 표시등이 빨갛게 깜빡인다. 꺼진 게 아니라 잠든 것이다.' },
      { at: new THREE.Vector3(-1.6, 0, -1.5), r: 0.45, text: '거인의 조종기. 버튼 하나가 내 손바닥만 하다. 줄이 텔레비전에 꽂혀 있다.' },
      { at: new THREE.Vector3(2.7, 0, -3.3), r: 0.55, text: '숲에서 신던 장화다. 아직 흙이 묻어 있다. …내가 있던 숲의 흙.' },
      { at: this.arch ? new THREE.Vector3(0.7, 0, -0.55) : new THREE.Vector3(-4.1, 0, -0.1), r: 0.6, text: '상자에 「잡동사니」라고 적혀 있다. 열린 틈으로 낡은 장난감 로봇이 보인다. 나도 여기 들어가게 되는 걸까.' },
      { at: new THREE.Vector3(Hs.x0 + 0.75, 0, -2.2), r: 0.6, text: '벽난로. 재가 식어 있다. 거인들은 불을 집 안에 가둬 두고 쓴다.' },
      { at: new THREE.Vector3(-2.6, 0, -3.5), r: 0.7, text: '창밖은 거인들의 길. 가로등. 다른 집들. 지붕 너머로 하늘이 주황빛이다. 도시의 불빛이다.' },
    ];
  }
  buildKitchen() {
    const Hs = HOUSE, z1 = Hs.z1, { trimM, darkWood } = this.mats;
    const cab = new THREE.MeshStandardMaterial({ color: 0x8aa39a, roughness: 0.55 }), counterM = new THREE.MeshStandardMaterial({ color: 0xdedad2, roughness: 0.3, envMapIntensity: 0.6 });
    const steel = new THREE.MeshStandardMaterial({ color: 0xb9bcbf, roughness: 0.25, metalness: 0.9 });
    // counters along the back wall (the sink under the window) and the west wall (the stove); the fridge
    const counter = (x0, x1, z0, z) => { this.block(x1 - x0, 0.86, Math.abs(z - z0), cab, (x0 + x1) / 2, 0.43, (z0 + z) / 2, { surface: 'wood' }); this.block(x1 - x0 + 0.03, 0.04, Math.abs(z - z0) + 0.03, counterM, (x0 + x1) / 2, 0.88, (z0 + z) / 2, { surface: 'rock' }); };
    if (!this.arch) {
      counter(-4.86, -1.55, z1 - 0.62, z1);
      this.block(0.62, 0.86, 1.6, cab, Hs.x0 + 0.31, 0.43, 1.3, { surface: 'wood' }); this.block(0.65, 0.04, 1.63, counterM, Hs.x0 + 0.32, 0.88, 1.3, { surface: 'rock' });
    }
    const sink = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.02, 0.42), steel); sink.position.set(-3.3, 0.905, z1 - 0.32); this.group.add(sink);
    for (const [x, z] of [[-4.75, 1.05], [-4.75, 1.55], [-4.45, 1.05], [-4.45, 1.55]]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.012, 20), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 })); b.position.set(x, 0.906, z); this.group.add(b); }
    // the stove's clock glows green in the dark
    // (on the modelled house's stove: its front faces the room at x0 + 0.66, the clock above the oven door)
    const ck = this.arch ? [Hs.x0 + 0.666, 0.86, 2.05] : [Hs.x0 + 0.625, 0.72, 1.3];
    const clock = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.03), new THREE.MeshBasicMaterial({ color: 0x3dff8a })); clock.position.set(...ck); clock.rotation.y = Math.PI / 2; this.group.add(clock); this.keepVis(clock);
    const cl = new THREE.PointLight(0x3dff8a, 0.025, 0.45, 2); cl.position.set(ck[0] + 0.05, ck[1], ck[2]); this.group.add(cl);   // (a display's faint glow)
    this.place('pot_enamel_01', -4.72, 1.08, { y: 0.912, rotY: 0.6, collide: false });
    this.place('wine_bottles_01', -1.85, z1 - 0.25, { y: 0.9, collide: false }); this.place('wine_bottles_01', -1.74, z1 - 0.33, { y: 0.9, rotY: 1.1, collide: false });
    this.place('modern_ceiling_lamp_01', -2.4, 2.0, { y: Hs.H - 0.95, collide: false });
    // the range hood over the stove, its little lamp left on: the one warm light downstairs
    const hood = new THREE.Mesh(new RoundedBoxGeometry(0.55, 0.16, 0.8, 2, 0.02), steel); hood.position.set(Hs.x0 + 0.29, 1.62, 1.3); hood.castShadow = true; this.group.add(hood);
    const hl = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.06), new THREE.MeshBasicMaterial({ color: 0xffe2b0 })); hl.rotation.x = Math.PI / 2; hl.position.set(Hs.x0 + 0.33, 1.538, 1.3); this.group.add(hl);
    const hlL = new THREE.SpotLight(0xffc888, 2.4, 4.5, 1.1, 0.8, 1.6); hlL.position.set(Hs.x0 + 0.33, this.arch ? 1.58 : 1.53, this.arch ? 2.05 : 1.3); hlL.target.position.set(Hs.x0 + 0.6, 0, this.arch ? 2.05 : 1.3);
    hlL.castShadow = true; hlL.shadow.mapSize.set(512, 512); hlL.shadow.bias = -0.0008; this.group.add(hlL, hlL.target);
    // (the hood light's warmth bounced off the hob and the counter into the kitchen)
    const fill = new THREE.PointLight(0xffb070, 0.45, 4.5, 1.8); fill.position.set(Hs.x0 + 0.75, 1.15, this.arch ? 2.05 : 1.3); this.group.add(fill);
    const fridge = this.block(0.78, 1.78, 0.72, new THREE.MeshStandardMaterial({ color: 0xe9e7e1, roughness: 0.35 }), Hs.x0 + 0.4, 0.89, 0.62, { surface: 'metal', collide: !this.arch });
    fridge.material.envMapIntensity = 0.7;
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 8), steel); handle.position.set(Hs.x0 + 0.8, 1.2, 0.36); this.group.add(handle);
    // the photos stuck on the fridge door: the forest
    const ph = document.createElement('canvas'); ph.width = 128; ph.height = 96; const pg = ph.getContext('2d');
    pg.fillStyle = '#f3efe6'; pg.fillRect(0, 0, 128, 96); const grd = pg.createLinearGradient(0, 0, 0, 80); grd.addColorStop(0, '#9fb6c8'); grd.addColorStop(1, '#3d5a35'); pg.fillStyle = grd; pg.fillRect(6, 6, 116, 70);
    for (let i = 0; i < 9; i++) { pg.fillStyle = '#1f3320'; pg.beginPath(); const x = 10 + i * 13; pg.moveTo(x, 76); pg.lineTo(x + 6, 20 + (i % 3) * 8); pg.lineTo(x + 12, 76); pg.fill(); }
    const pt = new THREE.CanvasTexture(ph); pt.colorSpace = THREE.SRGBColorSpace;
    const photo = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.11), new THREE.MeshStandardMaterial({ map: pt, roughness: 0.6 })); photo.position.set(Hs.x0 + (this.arch ? 0.763 : 0.795), this.arch ? 1.45 : 1.35, this.arch ? 0.55 : 0.7); photo.rotation.y = Math.PI / 2; photo.rotation.z = 0.06; this.group.add(photo); this.keepVis(photo);
    // the kitchen table with two chairs
    const tbl = new THREE.Group(); tbl.position.set(-2.4, 0, 2.0); this.group.add(tbl);
    const top = new THREE.Mesh(new RoundedBoxGeometry(1.2, 0.04, 0.8, 2, 0.01), darkWood); top.position.y = 0.74; top.castShadow = top.receiveShadow = true; tbl.add(top);
    for (const [x, z] of [[-0.54, -0.34], [0.54, -0.34], [-0.54, 0.34], [0.54, 0.34]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.72, 0.05), darkWood); l.position.set(x, 0.36, z); l.castShadow = true; tbl.add(l); if (!this.arch) this.collider(this.R.ColliderDesc.cuboid(0.025, 0.36, 0.025).setTranslation(-2.4 + x, 0.36, 2.0 + z)); }
    if (!this.arch) this.collider(this.R.ColliderDesc.cuboid(0.6, 0.02, 0.4).setTranslation(-2.4, 0.74, 2.0));
    this.place('GreenChair_01', -2.4, 1.25, { rotY: 0 }); this.place('GreenChair_01', -1.45, 2.05, { rotY: -Math.PI / 2 });
    this.notes.push(
      { at: new THREE.Vector3(Hs.x0 + 1.0, 0, 0.7), r: 0.6, text: '냉장고 문에 사진이 붙어 있다. 숲. 나무들. 거인은 숲을 좋아한다. 그래서 거기 있었던 거다.' },
      { at: this.catBowl.clone(), r: 0.4, text: '파란 밥그릇. 고양이 냄새가 난다. 라디에이터 옆 방석에서 고양이가 자고 있다. …깨우지 말자.' },
    );
  }

  lights() {
    const Hs = HOUSE;
    // the moon from the south over the backyard (kitchen window, the glass in the back door), cool
    const moon = new THREE.DirectionalLight(0xa9bce6, 0.9);
    moon.position.set(-6, 9, 16); moon.target.position.set(-1.5, 0, 0);
    const sm = this.ctx.tier.shadowMap >= 2048 ? 2048 : 1024;
    moon.castShadow = true; moon.shadow.mapSize.set(sm, sm);
    Object.assign(moon.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 45 }); moon.shadow.bias = -0.0004; moon.shadow.normalBias = 0.02;
    this.group.add(moon, moon.target);
    // the street lamp outside the front window: a warm sodium wash into the living room
    // (from the head of the lamp in front of the house, src/nyc.js: x = 0, 6.6 m up over the kerb)
    const street = new THREE.SpotLight(0xffb066, 26, 18, 0.5, 0.7, 1.6); street.position.set(0, 6.55, -14.1); street.target.position.set(-2.6, 0, -1.6);
    street.castShadow = true; street.shadow.mapSize.set(sm / 2, sm / 2); this.group.add(street, street.target);
    // city glow at the bedroom window
    // (through the bedroom's front window, x -3.6 to -1.6; the walls stop it elsewhere)
    if (!this.baked) { const bw = new THREE.SpotLight(0x8aa0d0, 9, 10, 0.6, 0.8, 1.5); bw.position.set(-2.6, Hs.U + 2.6, -6.5); bw.target.position.set(-2.4, Hs.U, -1.8); bw.castShadow = true; bw.shadow.mapSize.set(512, 512); bw.shadow.bias = -0.0006; this.group.add(bw, bw.target); }
    // the porch lantern by the front door (blender/build_house.py), left on
    if (this.arch && !this.baked) { const pl = new THREE.PointLight(0xffb873, 2.2, 7, 1.8); pl.position.set(2.05, 1.75, Hs.z0 - Hs.T - 0.13); this.group.add(pl); }
    const hemi = new THREE.HemisphereLight(0x5a6a8a, 0x2a2018, 0.2); this.group.add(hemi);
    // night lights: one plugged in on the landing by the top of the stairs, one in the hall at the bottom
    for (const [x, y, z] of [[3.6, Hs.U + 0.3, Hs.z0 + Hs.T / 2 + 0.01], [Hs.part + Hs.T / 2 + 0.01, 0.3, 0.8]]) {
      const nl = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.08, 0.02, 2, 0.008), new THREE.MeshStandardMaterial({ color: 0x332211, emissive: 0xffa25a, emissiveIntensity: 2.5 }));
      nl.position.set(x, y, z); this.group.add(nl); this.keepVis(nl);
      const l = new THREE.PointLight(0xffa25a, 1.0, 3.4, 1.8); l.position.set(x, y, z + (z < 0 ? 0.1 : 0)); if (x < 2) l.position.x += 0.1; this.group.add(l);
    }
  }

  update(dt, t) {
    const S = this.sleeper;
    S.stir = Math.max(0, S.stir - dt * 0.6);
    if (this.man) this.man.bone('head').getWorldPosition(S.head);          // (the snore comes from where his head is)
    // (the duvet: cloth over him when he is there, src/quilt.js; else the modelled one, breathing)
    if (this.quilt) this.quilt.update(dt, { robot: this.robot, active: this.clothActive ?? true }); else this.shapeDuvet(t);
    if (this.bulb) { const k = this.bedLamp.intensity / 9; this.bulb.emissiveIntensity = 3 * k; this.bedBounce.intensity = 0.45 * k; }
    const on = Math.sin(t * 1.4) > -0.2; this.tvLed.material.color.setRGB(on ? 1 : 0.25, 0.1, 0.06); this.tvLight.intensity = on ? 0.08 : 0.02;
    this.basket.hinge.rotation.x = -this.basket.open * 1.9 - (this.basket.jolt || 0);
    if (this.basket.jolt) this.basket.jolt = Math.max(0, this.basket.jolt - dt * 1.6);
    // the cat flap swings when something goes through it
    this.flap.hinge.rotation.x = this.flapSwing || 0;
    this.city?.userData.update(t);
  }
  terrain() {
    const up = new THREE.Vector3(0, 1, 0), Hs = HOUSE;
    return { waterY: -99, heightAt: (x, z) => (z > Hs.z1 + 0.1 ? (z > Hs.z1 + 2.0 ? Hs.yard.y : Hs.yard.deck) : 0), isWater: () => false, normalAt: () => up.clone(), surfaceAt: () => 'wood' };
  }
}
