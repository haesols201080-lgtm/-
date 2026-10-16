// Interiors. Each room is its own location far east of the city (x = 6000 +
// 100 * slot), built from a small description: size, surfaces, windows
// with a painted view beyond the glass, doors, a ceiling light, props and
// telescreens. Rooms are seen only from inside, so only inner faces exist.
import * as THREE from 'three';
import * as P from './rooms/paint.js';

const PI = Math.PI, H = PI / 2;
const WALL_T = 0.22;

function std(G, map, o = {}) {
  const m = new THREE.MeshStandardMaterial({ map, roughness: o.rough ?? 0.92, color: o.color ?? 0xffffff, metalness: 0 });
  if (o.normal) m.normalMap = o.normal;
  if (map) { map.wrapS = map.wrapT = THREE.RepeatWrapping; }
  return m;
}

// Build a quad with world-scaled UVs (tile metres per texture repeat).
function quad(a, b, c, d, tile, mat) {
  const g = new THREE.BufferGeometry();
  const pos = [...a, ...b, ...c, ...d];
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const e1 = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const e2 = new THREE.Vector3(d[0] - a[0], d[1] - a[1], d[2] - a[2]);
  const L1 = e1.length() / tile, L2 = e2.length() / tile;
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, L1, 0, L1, L2, 0, L2], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat);
  m.receiveShadow = true;
  return m;
}

class Room {
  constructor(G, slot, def) {
    this.G = G;
    this.def = def;
    this.ox = 6000 + slot * 100;
    this.root = new THREE.Group();
    this.root.name = def.id;
    this.root.position.set(this.ox, 0, 0);
    this.points = {};
    this.spawns = {};
    this.screens = [];
    this.lights = [];
    this.clear = [];     // kept-free floor in front of doors and openings
  }

  w(x, z, y = 0) { return new THREE.Vector3(this.ox + x, y, z); }

  // Walls along the room's edges with openings: {side, at, width, height, sill}
  build() {
    const { G, def } = this;
    const W = def.w, D = def.d, Ht = def.h;
    const wallMat = def.wallMat, floorMat = def.floorMat, ceilMat = def.ceilMat;
    const g = this.root;
    g.add(quad([-W / 2, 0, D / 2], [W / 2, 0, D / 2], [W / 2, 0, -D / 2], [-W / 2, 0, -D / 2], def.floorTile || 1.2, floorMat));
    g.add(quad([-W / 2, Ht, -D / 2], [W / 2, Ht, -D / 2], [W / 2, Ht, D / 2], [-W / 2, Ht, D / 2], 2.5, ceilMat));
    const sides = {
      n: { len: W, o: [-W / 2, -D / 2], u: [1, 0], inward: [0, 1] },
      s: { len: W, o: [W / 2, D / 2], u: [-1, 0], inward: [0, -1] },
      w: { len: D, o: [-W / 2, D / 2], u: [0, -1], inward: [1, 0] },
      e: { len: D, o: [W / 2, -D / 2], u: [0, 1], inward: [-1, 0] },
    };
    const holes = [...(def.windows || []).map((h) => ({ ...h, kind: 'window' })),
      ...(def.doors || []).map((h) => ({ ...h, kind: 'door', sill: 0, height: h.height ?? 2.1, width: h.width ?? 0.9 })),
      ...(def.gaps || []).map((h) => ({ ...h, kind: 'gap', sill: 0, height: Ht }))];
    for (const [key, s] of Object.entries(sides)) {
      const hs = holes.filter((h) => h.side === key).map((h) => ({ ...h, a: h.at - h.width / 2, b: h.at + h.width / 2 })).sort((p, q) => p.a - q.a);
      const P3 = (t, y) => [s.o[0] + s.u[0] * t, y, s.o[1] + s.u[1] * t];
      let t = 0;
      const seg = (t0, t1, y0, y1) => {
        if (t1 - t0 < 0.01 || y1 - y0 < 0.01) return;
        g.add(quad(P3(t0, y0), P3(t1, y0), P3(t1, y1), P3(t0, y1), def.wallTile || 2.0, wallMat));
      };
      for (const h of hs) {
        if (h.kind !== 'window') {
          // nothing may stand in front of a door or an opening
          const p0 = P3(h.a - 0.25, 0), p1 = P3(h.b + 0.25, 0);
          const q0 = [p0[0] + s.inward[0] * 1.15, p0[2] + s.inward[1] * 1.15], q1 = [p1[0] + s.inward[0] * 1.15, p1[2] + s.inward[1] * 1.15];
          const xs = [p0[0], p1[0], q0[0], q1[0]], zs = [p0[2], p1[2], q0[1], q1[1]];
          this.clear.push({ x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs), u: s.u, mid: (h.a + h.b) / 2, side: key });
        }
        seg(t, h.a, 0, Ht);
        seg(h.a, h.b, 0, h.sill);
        seg(h.a, h.b, h.sill + h.height, Ht);
        this.opening(s, h, P3);
        t = h.b;
      }
      seg(t, s.len, 0, Ht);
      // skirting board, stopping at every door and gap
      const cuts = hs.filter((h) => (h.sill ?? 0) < 0.15).map((h) => [h.a - 0.04, h.b + 0.04]);
      let t0 = 0;
      for (const [ca, cb] of [...cuts, [s.len, s.len]]) {
        const len = ca - t0;
        if (len > 0.05) {
          const sk = new THREE.Mesh(new THREE.BoxGeometry(len, 0.14, 0.025), def.skirtMat);
          const mid = P3(t0 + len / 2, 0.07);
          sk.position.set(mid[0] + s.inward[0] * 0.0135, 0.07, mid[2] + s.inward[1] * 0.0135);
          sk.rotation.y = Math.atan2(-s.u[1], s.u[0]);
          g.add(sk);
        }
        t0 = cb;
      }
      // collider for the wall (openings for doors are closed: doors teleport)
      const cx = this.ox + s.o[0] + s.u[0] * s.len / 2 - s.inward[0] * WALL_T / 2;
      const cz = s.o[1] + s.u[1] * s.len / 2 - s.inward[1] * WALL_T / 2;
      const along = Math.abs(s.u[0]) > 0.5;
      G.col.add(cx, cz, along ? s.len / 2 + WALL_T : WALL_T / 2, along ? WALL_T / 2 : s.len / 2 + WALL_T, 0, { y0: -1, y1: Ht + 1, tag: def.id + '_wall' });
    }
  }

  opening(s, h, P3) {
    const { G, def } = this;
    if (h.kind === 'gap') return;     // a recess built by the room itself
    const g = this.root;
    const frameMat = def.frameMat;
    const a = P3(h.a, 0), b = P3(h.b, 0);
    const cx = (a[0] + b[0]) / 2, cz = (a[2] + b[2]) / 2;
    const rot = Math.atan2(s.inward[0], s.inward[1]);
    // reveal: the thickness of the wall round the opening
    const rv = (t, y0, y1) => {
      const p = P3(t, 0);
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, y1 - y0, WALL_T), frameMat);
      m.position.set(p[0] - s.inward[0] * (WALL_T / 2 - 0.012), (y0 + y1) / 2, p[2] - s.inward[1] * (WALL_T / 2 - 0.012));
      m.rotation.y = rot;
      m.castShadow = true;
      g.add(m);
    };
    rv(h.a, h.sill, h.sill + h.height); rv(h.b, h.sill, h.sill + h.height);
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(h.width + 0.12, 0.08, WALL_T), frameMat);
    lintel.position.set(cx - s.inward[0] * (WALL_T / 2 - 0.014), h.sill + h.height + 0.04, cz - s.inward[1] * (WALL_T / 2 - 0.014));
    lintel.rotation.y = rot;
    g.add(lintel);
    if (h.kind === 'window') {
      const sill = lintel.clone();
      sill.position.y = h.sill - 0.03;
      sill.scale.z = 1.25;
      g.add(sill);
      // the painted view a few metres beyond, lit like daylight or night
      const dist = h.viewDist ?? 6;
      const vw = h.width * (1 + dist * 0.9), vh = h.height * (1 + dist * 0.9);
      const views = [P.view(h.view || 'city', false, G.art), P.view(h.view || 'city', true, G.art)];
      const vm = new THREE.MeshBasicMaterial({ map: views[0], fog: false, toneMapped: true });
      const vp = new THREE.Mesh(new THREE.PlaneGeometry(vw, vh), vm);
      vp.position.set(cx - s.inward[0] * (WALL_T + dist), h.sill + h.height / 2, cz - s.inward[1] * (WALL_T + dist));
      vp.rotation.y = rot;
      g.add(vp);
      this.viewMats = this.viewMats || [];
      this.viewMats.push({ mat: vm, views });
      // grimy glass with sash bars
      const gm = new THREE.MeshStandardMaterial({ map: P.dirtyGlass(h.dirty ?? 0.5), transparent: true, opacity: 0.32, roughness: 0.15, metalness: 0, depthWrite: false });
      const gp = new THREE.Mesh(new THREE.PlaneGeometry(h.width, h.height), gm);
      gp.position.set(cx - s.inward[0] * WALL_T * 0.6, h.sill + h.height / 2, cz - s.inward[1] * WALL_T * 0.6);
      gp.rotation.y = rot;
      g.add(gp);
      const bar = (w, ht, y) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, ht, 0.04), frameMat);
        m.position.set(cx - s.inward[0] * WALL_T * 0.6, y, cz - s.inward[1] * WALL_T * 0.6);
        m.rotation.y = rot;
        g.add(m);
      };
      bar(0.05, h.height, h.sill + h.height / 2);
      bar(h.width, 0.05, h.sill + h.height * 0.55);
      // daylight through the window
      const sun = new THREE.SpotLight(0xdfe6ee, 0, 12, 0.9, 0.8, 2);
      sun.position.set(cx - s.inward[0] * 2.5, h.sill + h.height + 0.8, cz - s.inward[1] * 2.5);
      sun.target.position.set(cx + s.inward[0] * 2.5, 0, cz + s.inward[1] * 2.5);
      g.add(sun); g.add(sun.target);
      this.windowLights = this.windowLights || [];
      this.windowLights.push(sun);
    } else {
      // door leaf and frame, the way out
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(h.width, h.height, 0.05), def.doorMat);
      leaf.position.set(cx - s.inward[0] * 0.04, h.height / 2, cz - s.inward[1] * 0.04);
      leaf.rotation.y = rot;
      leaf.castShadow = true;
      g.add(leaf);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), G.mats.get('brass'));
      const kx = h.width * 0.38;
      knob.position.set(cx + s.u[0] * kx + s.inward[0] * 0.02, 1.0, cz + s.u[1] * kx + s.inward[1] * 0.02);
      g.add(knob);
      if (h.to) {
        const pos = this.w(cx + s.inward[0] * 0.4, cz + s.inward[1] * 0.4, 1.2);
        G.interact({
          location: def.id, pos, radius: 1.8, label: h.label || '나간다',
          enabled: () => (h.enabled ? h.enabled(G) : true),
          use: () => {
            if (h.use) return h.use(G);
            const [to, spawn] = h.to;
            if (to === 'city') G.teleport('city', spawn);
            else if (G.locations.has(to)) G.teleport(to, spawn);
          },
        });
      }
      if (h.spawn) this.spawns[h.spawn] = { x: this.ox + cx + s.inward[0] * 0.8, z: cz + s.inward[1] * 0.8, yaw: Math.atan2(-s.inward[0], -s.inward[1]) };
    }
  }

  prop(model, x, z, rot = 0, o = {}) {
    const { G } = this;
    let obj;
    try { obj = G.assets.instance(model); } catch (e) { console.warn('[rooms]', e.message); return null; }
    G.mats.apply(obj, { cast: o.cast ?? true, receive: true, override: o.override });
    obj.position.set(x, o.y ?? 0, z);
    obj.rotation.y = rot;
    obj.userData.prop = model;
    if (o.scale) obj.scale.setScalar(o.scale);
    this.root.add(obj);
    // keep the way through doors free: slide a floor-standing prop along the
    // wall out of a door's clearance, or leave it out
    if ((o.y ?? 0) < 0.3 && !o.allowDoor) {
      const hit = () => {
        obj.updateMatrixWorld(true);
        const b = new THREE.Box3().setFromObject(obj);
        const x0 = b.min.x - this.ox, x1 = b.max.x - this.ox;
        return this.clear.find((c) => x1 > c.x0 && x0 < c.x1 && b.max.z > c.z0 && b.min.z < c.z1);
      };
      let c = hit();
      if (c) {
        const base = obj.position.clone();
        let done = false;
        for (let k = 1; k <= 12 && !done; k++) {
          for (const sg of [1, -1]) {
            obj.position.set(base.x + c.u[0] * 0.2 * k * sg, base.y, base.z + c.u[1] * 0.2 * k * sg);
            if (!hit()) { done = true; break; }
          }
        }
        if (!done) { console.warn('[rooms] left out', model, 'in', this.def.id, ': it would block a door'); this.root.remove(obj); return null; }
      }
    }
    if (o.collide !== false) {
      obj.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(obj);
      box.min.x += this.ox; box.max.x += this.ox;
      if (box.max.y - box.min.y > 0.3 && o.collide !== 'none') {
        this.G.col.addBox3(box, { pad: 0.04, tag: this.def.id + '_prop', sight: o.sight ?? (box.max.y > 1.6) });
      }
    }
    return obj;
  }

  telescreen(x, y, z, rot, o = {}) {
    const obj = this.prop('telescreen_wall', x, z, rot, { y, collide: false });
    const dir = new THREE.Vector3(Math.sin(rot), 0, Math.cos(rot));
    const t = { location: this.def.id, pos: this.w(x, z, y).addScaledVector(dir, 0.15), dir, fov: o.fov ?? 150, range: o.range ?? 12, object: obj };
    this.screens.push(t);
    return t;
  }

  light(x, y, z, o = {}) {
    const bulb = this.prop(o.model || 'bulb', x, z, 0, { y, collide: false, cast: false });
    const l = new THREE.PointLight(o.color ?? 0xffc98e, o.intensity ?? 45, o.distance ?? 14, 2);
    l.position.set(x, y - 0.78, z);
    if (o.shadow !== false && !this.shadowLight) {
      l.castShadow = true;
      l.shadow.mapSize.set(1024, 1024);
      l.shadow.bias = -0.002;
      l.shadow.radius = 4;
      this.shadowLight = l;
    }
    this.root.add(l);
    this.lights.push({ light: l, base: l.intensity });
    return l;
  }

  register() {
    const { G, def } = this;
    const self = this;
    G.addLocation({
      id: def.id, root: this.root, exterior: false, spawns: this.spawns,
      fogColor: def.fog ?? 0x14110d, fogDensity: def.fogDensity ?? 0.04, exposure: def.exposure ?? 1.15,
      zone: () => def.zone || 'interior',
      onEnter: () => {
        const night = (G.atmos.day ?? 1) < 0.3;
        if (self.viewMats) for (const v of self.viewMats) v.mat.map = v.views[night ? 1 : 0];
        if (self.windowLights) for (const l of self.windowLights) l.intensity = night ? 0 : (def.daylight ?? 18) * (0.4 + 0.6 * (G.atmos.day ?? 1));
        if (def.onEnter) def.onEnter(G, self);
      },
      update: (dt) => {
        // a faint flicker in the mains, as power is rationed
        const f = 1 - (Math.random() < 0.01 ? 0.25 : 0) * (def.flicker ?? 1);
        for (const l of self.lights) l.light.intensity = l.base * f * (def.lightScale ?? 1);
        if (def.update) def.update(dt, G, self);
      },
    });
    for (const t of this.screens) {
      if (G.surv && G.surv.addTelescreen) G.surv.addTelescreen(t);
      else G.interiors.telescreens.push(t);
    }
  }
}

export function setupInteriors(G) {
  G.interiors = { points: {}, telescreens: [], rooms: {} };
  const tex = {
    paper: P.paperUtility(), victorian: P.paperVictorian(), stripe: P.paperStripe(),
    lino: P.linoPlain(), linoRed: P.linoPlain([110, 52, 40]), carpet: P.carpet(), plaster: P.paintNeutral(3),
  };
  const lib = (n) => G.mats.get(n);
  const M = {
    paper: std(G, tex.paper), victorian: std(G, tex.victorian), stripe: std(G, tex.stripe),
    lino: std(G, tex.lino, { rough: 0.6 }), linoRed: std(G, tex.linoRed, { rough: 0.55 }), carpet: std(G, tex.carpet, { rough: 1 }),
    plaster: std(G, tex.plaster, { color: 0xd8d2c4 }), ministry: std(G, tex.plaster, { color: 0xbfc4c0 }),
    wood: lib('wood'), woodDark: lib('wood_dark'), tile: lib('tile_white'), concrete: lib('concrete_grey'),
    wallpaper: lib('wallpaper'), peeling: lib('plaster_peeling'), brick: lib('brick'),
  };
  const base = { skirtMat: M.woodDark, frameMat: M.woodDark, doorMat: M.woodDark, ceilMat: M.plaster };
  let slot = 0;
  const make = (def) => {
    const room = new Room(G, slot++, { ...base, ...def });
    room.build();
    if (def.furnish) def.furnish(room);
    room.register();
    G.interiors.rooms[def.id] = room;
    G.interiors.points[def.id] = room.points;
    return room;
  };
  const pt = (room, name, x, z, y = 0) => { room.points[name] = room.w(x, z, y); };

  // ---- Victory Mansions: the hallway smelling of boiled cabbage and old rag mats
  make({
    id: 'mansions_hall', w: 6, d: 9, h: 3.4, wallMat: M.peeling, floorMat: M.linoRed, floorTile: 1.6, fog: 0x18150f,
    windows: [{ side: 's', at: 1.4, width: 1.6, height: 2.2, sill: 0.4, view: 'street', dirty: 0.8 }],
    doors: [
      { side: 's', at: 4.6, width: 1.4, to: ['city', 'home_door'], label: '거리로 나간다', spawn: 'street' },
      { side: 'n', at: 4.8, to: ['flat', 'door'], label: '계단으로 7층까지 올라간다', spawn: 'stairs' },
    ],
    furnish(r) {
      // the poster too large for indoor display, the lift that never works
      const big = r.prop('poster', 2.98, -1.0, -H, { collide: false, scale: 2.2, y: 0.4, override: { poster_bb: G.mats.get('poster_bb') } });
      r.prop('poster', 0.6, -4.48, 0, { collide: false, y: 1.1, override: { poster_bb: G.mats.get('poster_ingsoc') } });
      const lift = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 0.05), G.mats.get('metal_dark'));
      lift.position.set(-1.6, 1.1, -4.47); r.root.add(lift);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.3), new THREE.MeshStandardMaterial({ map: P.notice(['OUT OF ORDER']) }));
      sign.position.set(-1.6, 1.5, -4.43); r.root.add(sign);
      r.light(0, 3.4, -1.0, { intensity: 22 });
      r.telescreen(-2.97, 1.8, 1.5, H, { range: 10 });
      pt(r, 'poster', 2.9, -1.0, 2.5);
    },
  });

  // ---- Winston's flat, seven flights up. The telescreen is in the long wall
  // opposite the window; beside it a shallow alcove, out of its sight.
  make({
    id: 'flat', w: 5.2, d: 4.2, h: 2.7, wallMat: M.wallpaper, wallTile: 1.6, floorMat: M.wood, floorTile: 1.5, fog: 0x15120e, exposure: 1.2,
    windows: [{ side: 'n', at: 2.6, width: 1.3, height: 1.4, sill: 0.9, view: 'city', viewDist: 8 }],
    gaps: [{ side: 's', at: 3.8, width: 1.2 }],
    doors: [{ side: 'w', at: 3.4, to: ['mansions_hall', 'stairs'], label: '아래층으로 내려간다', spawn: 'door' }],
    furnish(r) {
      // the alcove: a recess 1.2 m wide, 0.6 m deep in the south wall, west of the telescreen
      const ax = -1.2, aw = 1.2, ad = 0.62, D = 2.1;
      for (const [a, b, c, d] of [
        [[ax - aw / 2, 0, D + ad], [ax + aw / 2, 0, D + ad], [ax + aw / 2, 2.7, D + ad], [ax - aw / 2, 2.7, D + ad]],
        [[ax - aw / 2, 0, D], [ax - aw / 2, 0, D + ad], [ax - aw / 2, 2.7, D + ad], [ax - aw / 2, 2.7, D]],
        [[ax + aw / 2, 0, D + ad], [ax + aw / 2, 0, D], [ax + aw / 2, 2.7, D], [ax + aw / 2, 2.7, D + ad]],
      ]) r.root.add(quad(d, c, b, a, 1.6, M.wallpaper));
      r.root.add(quad([ax - aw / 2, 0.001, D + ad], [ax + aw / 2, 0.001, D + ad], [ax + aw / 2, 0.001, D], [ax - aw / 2, 0.001, D], 1.5, M.wood));
      r.root.add(quad([ax - aw / 2, 2.699, D], [ax + aw / 2, 2.699, D], [ax + aw / 2, 2.699, D + ad], [ax - aw / 2, 2.699, D + ad], 2.5, M.plaster));
      // telescreen on the long south wall, facing north into the room
      r.telescreen(0.6, 1.6, D - 0.02, PI, { range: 9, fov: 150 });
      // he sits well back in the alcove, the chair against its back wall and
      // facing the room; the table stands in front of him, half in the recess
      r.prop('chair', ax, D + ad - 0.27, PI, { collide: 'none' });
      r.prop('table', ax, D - 0.08, 0, { collide: 'none' });
      r.prop('diary', ax + 0.08, D + 0.02, PI + 0.12, { y: 0.76, collide: false });
      r.prop('bed', 1.9, -0.6, H);
      r.prop('cupboard', 2.3, 1.55, -H);
      r.prop('gin', ax - 0.34, D - 0.22, 0, { y: 0.76, collide: false });
      r.prop('sink', -2.3, 0.3, H);
      r.light(0.2, 2.7, 0, { intensity: 30 });
      pt(r, 'alcove_seat', ax, D + ad - 0.3);
      pt(r, 'bed', 1.9, -0.6);
      pt(r, 'window', 0, -1.6);
      pt(r, 'telescreen', 0.6, D, 1.6);
      r.spawns.alcove = { x: r.ox + ax, z: D + 0.2, yaw: 0 };
      r.spawns.bed = { x: r.ox + 1.2, z: -0.6, yaw: H };
    },
  });
  // carve the alcove out of the flat's south wall collider
  {
    const r = G.interiors.rooms.flat;
    const wall = [...G.col.boxes].find((b) => b.tag === 'flat_wall' && Math.abs(b.cz - (2.1 + WALL_T / 2)) < 0.01);
    if (wall) {
      wall.solid = false; wall.sight = false;
      const x0 = r.ox - 2.6, x1 = r.ox + 2.6, a0 = r.ox - 1.8, a1 = r.ox - 0.6;
      G.col.add((x0 + a0) / 2, 2.1 + 0.11, (a0 - x0) / 2, 0.11, 0, { tag: 'flat_wall' });
      G.col.add((a1 + x1) / 2, 2.1 + 0.11, (x1 - a1) / 2, 0.11, 0, { tag: 'flat_wall' });
      G.col.add(r.ox - 1.2, 2.1 + 0.62 + 0.11, 0.6, 0.11, 0, { tag: 'flat_wall' });
    }
  }

  // ---- the Parsons' flat next door
  make({
    id: 'parsons_flat', w: 6, d: 5, h: 2.7, wallMat: M.wallpaper, wallTile: 1.6, floorMat: M.lino, fog: 0x15120e,
    windows: [{ side: 'n', at: 3, width: 1.3, height: 1.4, sill: 0.9, view: 'city' }],
    doors: [{ side: 'w', at: 4, to: ['mansions_hall', 'stairs'], label: '복도로 나간다', spawn: 'door' }],
    furnish(r) {
      r.prop('table', 0, 0, 0); r.prop('chair', 0.6, 0.1, -H); r.prop('chair', -0.6, 0.1, H);
      r.prop('sink', 2.7, 1.5, -H); r.prop('cupboard', 2.7, -1.2, -H); r.prop('bed', -2.2, -1.2, 0);
      r.telescreen(-1, 1.6, 2.48, PI);
      r.light(0, 2.7, 0, { intensity: 30 });
      pt(r, 'sink', 2.4, 1.5);
    },
  });

  // ---- the Records Department: a long hall of cubicles, the big telescreen
  make({
    id: 'records', w: 14, d: 30, h: 4.2, wallMat: M.ministry, floorMat: M.lino, floorTile: 1.8, fog: 0x1a1c1c, exposure: 1.05,
    flicker: 0.4, daylight: 0,
    doors: [
      { side: 's', at: 7, width: 1.6, to: ['city', 'minitrue_door'], label: '진리부를 나선다', spawn: 'entrance' },
      { side: 'e', at: 26, to: ['canteen', 'door'], label: '지하 식당으로 내려간다', spawn: 'corridor' },
    ],
    furnish(r) {
      // two rows of cubicles facing the aisle
      for (let i = 0; i < 6; i++) {
        const z = 8 - i * 3.2;
        r.prop('cubicle', -4.6, z, H, { collide: true });
        r.prop('cubicle', 4.6, z, -H, { collide: true });
      }
      // Winston's: the third on the west side
      // the end of the hall: the big telescreen and the chairs for the Hate
      const big = r.prop('telescreen_wall', 0, -14.9, 0, { y: 2.3, collide: false, scale: 2.6 });
      const t = { location: 'records', pos: r.w(0, -14.4, 2.3), dir: new THREE.Vector3(0, 0, 1), fov: 160, range: 30, object: big };
      r.screens.push(t);
      for (let row = 0; row < 3; row++) r.prop('chair_row', 0, -10 + row * 1.4, PI, { collide: 'none' });
      for (let i = 0; i < 4; i++) r.light(0, 4.2, 10 - i * 7, { intensity: 55, model: 'bulb', shadow: i === 1 });
      pt(r, 'cubicle_seat', -4.6 + 0.0, 8 - 2 * 3.2 + 0.15);
      pt(r, 'hate_seat', -0.5, -7.2);
      pt(r, 'julia_seat', -0.5, -5.8);
      pt(r, 'obrien_seat', 1.5, -7.2);
      pt(r, 'screen', 0, -14.6, 2.3);
      pt(r, 'corridor', 6, 12);
      r.spawns.cubicle = { x: r.ox - 3.6, z: 8 - 2 * 3.2, yaw: H };
      r.spawns.hate_seat = { x: r.ox - 0.5, z: -7.2, yaw: 0 };
      r.spawns.corridor = { x: r.ox + 5.5, z: 12, yaw: 0 };
    },
  });

  // ---- the canteen, low-ceilinged, deep underground
  make({
    id: 'canteen', w: 16, d: 12, h: 2.6, wallMat: M.tile, wallTile: 1.0, floorMat: M.lino, fog: 0x1e1d18, fogDensity: 0.06,
    doors: [{ side: 'w', at: 2, to: ['records', 'corridor'], label: '기록국으로 올라간다', spawn: 'door' }],
    furnish(r) {
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) r.prop('canteen_table', -3 + i * 4, -1 + j * 3.4, 0);
      const counter = new THREE.Mesh(new THREE.BoxGeometry(6, 1.0, 0.6), G.mats.get('metal'));
      counter.position.set(1, 0.5, -5.6); r.root.add(counter);
      G.col.add(r.ox + 1, -5.6, 3, 0.3, 0, { y0: 0, y1: 1, tag: 'counter' });
      r.telescreen(7.9, 1.8, 0, -H, { range: 14 });
      for (let i = 0; i < 3; i++) r.light(-4 + i * 4, 2.6, 0, { intensity: 35, shadow: i === 1 });
      pt(r, 'table', -3, -1.8);
      pt(r, 'counter', 1, -4.8);
      r.spawns.table = { x: r.ox - 3, z: -2.2, yaw: 0 };
    },
  });

  // ---- Mr Charrington's junk shop and the room above it
  make({
    id: 'shop', w: 6, d: 7, h: 2.8, wallMat: M.victorian, floorMat: M.woodDark, floorTile: 1.2, fog: 0x17120c, exposure: 1.25,
    windows: [{ side: 's', at: 2.0, width: 2.6, height: 1.6, sill: 0.6, view: 'prole', dirty: 0.9 }],
    doors: [
      { side: 's', at: 4.8, to: ['city', 'shop_door'], label: '가게를 나선다', spawn: 'door' },
      { side: 'n', at: 4.6, to: ['room', 'door'], label: '2층 방으로 올라간다', spawn: 'stairs' },
    ],
    furnish(r) {
      r.prop('cupboard', -2.7, -1.5, H); r.prop('cupboard', 2.7, -2.0, -H);
      r.prop('table', 0, -0.5, 0);
      r.prop('paperweight', 0.15, -0.45, 0, { y: 0.76, collide: false });
      r.prop('armchair', 2.2, 1.5, -2.4);
      r.light(0, 2.8, 0, { intensity: 18 });
      pt(r, 'paperweight', 0.15, -0.45, 0.8);
    },
  });
  make({
    id: 'room', w: 4.6, d: 4.2, h: 2.6, wallMat: M.wallpaper, floorMat: M.woodDark, fog: 0x17110b, exposure: 1.25,
    windows: [{ side: 's', at: 1.4, width: 1.2, height: 1.3, sill: 0.8, view: 'yard' }],
    doors: [{ side: 'w', at: 3.0, to: ['shop', 'stairs'], label: '가게로 내려간다', spawn: 'door' }],
    furnish(r) {
      r.prop('bed_old', 1.2, -0.9, 0);
      r.prop('gateleg', -1.0, 0.6, 0);
      r.prop('armchair', -1.6, -1.2, 0.6);
      r.prop('oil_stove', 0.2, 1.7, 0, { collide: 'none' });
      r.engraving = r.prop('engraving', -0.4, -2.08, 0, { y: 1.6, collide: false });
      r.hidden = r.prop('telescreen_wall', -0.4, -2.1, 0, { y: 1.6, collide: false });
      r.hidden.visible = false;
      r.light(0, 2.6, 0, { intensity: 16 });
      pt(r, 'bed', 1.2, -0.9); pt(r, 'window', 1.4, 1.6); pt(r, 'engraving', -0.4, -2.0, 1.6);
      r.spawns.bed = { x: r.ox + 0.4, z: -0.4, yaw: -H };
      r.spawns.window = { x: r.ox + 1.4, z: 1.4, yaw: PI };
    },
  });

  // ---- the prole pub
  make({
    id: 'pub', w: 9, d: 7, h: 3.0, wallMat: M.victorian, floorMat: M.woodDark, fog: 0x1c140c, fogDensity: 0.07, exposure: 1.2,
    windows: [{ side: 's', at: 2.5, width: 2.0, height: 1.5, sill: 0.8, view: 'prole', dirty: 1 }],
    doors: [{ side: 's', at: 6.5, to: ['city', 'pub_door'], label: '선술집을 나선다', spawn: 'door' }],
    furnish(r) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(5, 1.1, 0.7), M.woodDark);
      bar.position.set(-0.5, 0.55, -2.4); r.root.add(bar);
      G.col.add(r.ox - 0.5, -2.4, 2.5, 0.35, 0, { y0: 0, y1: 1.1, tag: 'bar' });
      r.prop('cupboard', -1.5, -3.3, 0); r.prop('cupboard', 0.5, -3.3, 0);
      for (const [x, z] of [[2.5, 0.8], [-2.5, 1.2]]) { r.prop('table', x, z, 0); r.prop('chair', x + 0.6, z, -H); r.prop('chair', x - 0.6, z, H); }
      r.light(-1, 3, 0, { intensity: 26 }); r.light(2.5, 3, 1, { intensity: 14, shadow: false });
      pt(r, 'bar', -0.5, -1.7); pt(r, 'oldman', -2.5, 1.2);
    },
  });

  // ---- O'Brien's flat: soft carpet, dark blue paper, a telescreen he can turn off
  make({
    id: 'obrien', w: 7, d: 6, h: 3.0, wallMat: std(G, tex.stripe, { color: 0x5a6a90 }), floorMat: M.carpet, fog: 0x0e1018, exposure: 1.15,
    windows: [{ side: 'n', at: 3.5, width: 1.6, height: 1.8, sill: 0.7, view: 'inner', dirty: 0.1 }],
    doors: [{ side: 'w', at: 4.5, to: ['city', 'obrien_door'], label: '오브라이언의 집을 나선다', spawn: 'door' }],
    furnish(r) {
      r.prop('table', 1.5, -1.5, 0); r.prop('armchair', 0.6, -1.2, 1.2); r.prop('chair', 2.3, -1.2, -H);
      r.prop('cupboard', 3.35, 1.0, -H);
      r.screen = r.telescreen(-3.4, 1.6, 0, H, { range: 9 });
      r.light(1.5, 3, -1.5, { intensity: 30, color: 0xffe0b8 });
      pt(r, 'desk', 1.5, -1.5); pt(r, 'screen', -3.3, 0, 1.6);
    },
  });

  // ---- the Chestnut Tree Café
  make({
    id: 'cafe', w: 9, d: 7, h: 3.0, wallMat: M.victorian, floorMat: M.lino, fog: 0x15120d, fogDensity: 0.06,
    windows: [{ side: 's', at: 2, width: 2.6, height: 1.6, sill: 0.7, view: 'square' }],
    doors: [{ side: 's', at: 6.5, to: ['city', 'cafe_door'], label: '카페를 나선다', spawn: 'door' }],
    furnish(r) {
      r.prop('table', -3, -2.4, 0); r.prop('chair', -3, -1.8, PI); r.prop('chess', -3, -2.4, 0.3, { y: 0.76, collide: false });
      r.prop('gin', -2.75, -2.25, 0, { y: 0.76, collide: false });
      r.prop('table', 1, 0, 0); r.prop('table', 3, -2, 0);
      r.telescreen(4.4, 1.7, -1, -H);
      r.light(-1, 3, -1, { intensity: 20 });
      pt(r, 'corner', -3, -1.7);
      r.spawns.corner = { x: r.ox - 3, z: -1.6, yaw: 0 };
    },
  });

  // ---- the Ministry of Love: the white cell, the interrogation room, Room 101
  make({
    id: 'cell', w: 6, d: 6, h: 4.5, wallMat: M.tile, wallTile: 1.0, floorMat: M.tile, ceilMat: M.tile, fog: 0xd8dcd8, fogDensity: 0.01,
    exposure: 0.95, flicker: 0,
    doors: [{ side: 's', at: 3, to: null, label: '' }],
    furnish(r) {
      r.prop('cell_bench', 0, -2.75, 0); r.prop('cell_bench', -2.75, 0, H); r.prop('cell_bench', 2.75, 0, -H);
      for (const [x, z, rot] of [[0, -2.98, 0], [-2.98, 0, H], [2.98, 0, -H], [0, 2.98, PI]]) r.telescreen(x, 3.2, z, rot, { range: 8 });
      r.light(0, 4.5, 0, { intensity: 140, color: 0xf4f6ff, shadow: false });
      pt(r, 'bench', 0, -2.4);
      r.spawns.bench = { x: r.ox, z: -2.3, yaw: PI };
    },
  });
  make({
    id: 'interrogation', w: 6, d: 7, h: 3.5, wallMat: M.concrete, floorMat: M.concrete, fog: 0x101010, flicker: 0,
    furnish(r) {
      r.prop('rack', 0, 0, 0);
      r.light(0, 3.5, 0, { intensity: 90, color: 0xf8f8ff });
      pt(r, 'rack', 0, 0); pt(r, 'obrien', 1.2, 1.4);
      r.spawns.rack = { x: r.ox, z: 0.2, yaw: PI };
    },
  });
  make({
    id: 'room101', w: 5, d: 5, h: 3.2, wallMat: M.concrete, floorMat: M.concrete, fog: 0x0a0a0a, flicker: 0,
    furnish(r) {
      r.prop('table', 0, -1.2, 0);
      r.prop('cage', 0, -1.2, 0, { y: 0.76, collide: false });
      r.prop('chair', 0, 0.2, PI);
      r.light(0, 3.2, -0.5, { intensity: 50 });
      pt(r, 'chair', 0, 0.2); pt(r, 'cage', 0, -1.2, 0.9);
      r.spawns.chair = { x: r.ox, z: 0.3, yaw: 0 };
    },
  });

  G.interiors.setEngravingFallen = (on) => {
    const r = G.interiors.rooms.room;
    if (!r) return;
    if (r.engraving) { r.engraving.rotation.x = on ? -1.4 : 0; r.engraving.position.y = on ? 0.05 : 1.6; r.engraving.position.z = on ? -1.6 : -2.08; }
    if (r.hidden) r.hidden.visible = on;
    if (on && !r.hiddenScreen && G.surv && G.surv.addTelescreen) {
      r.hiddenScreen = { location: 'room', pos: r.w(-0.4, -1.95, 1.6), dir: new THREE.Vector3(0, 0, 1), fov: 160, range: 8 };
      G.surv.addTelescreen(r.hiddenScreen);
    }
  };
  return G.interiors;
}
