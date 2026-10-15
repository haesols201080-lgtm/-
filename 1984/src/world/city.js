// London, chief city of Airstrip One. Ties the plan (city_layout), the
// floor (city_ground) and the model placement (city_build) together, adds
// street furniture, posters, telescreens, lamps with pooled real lights,
// doors into the interiors and the distant skyline, and registers the
// exterior location 'city'.
import * as THREE from 'three';
import { GroundMap, buildGround, buildOverlays, blob, T } from './city_ground.js';
import { Placer } from './city_build.js';
import { paintGround, placeParty, placeProle, zoneAt, ZONES, namedPoints, namedPaths, doorDefs, spawnDefs } from './city_layout.js';
import { posterAtlas, POSTER } from './city_paint.js';
import { rng, tf, standingQuad } from './city_util.js';

const PI = Math.PI, H = PI / 2;

export function setupCity(G) {
  const root = new THREE.Group();
  root.name = 'city';
  const map = new GroundMap();
  paintGround(map);
  const ground = (x, z) => map.height(x, z);
  const placer = new Placer(G, root);
  const ctx = { G, placer, map, ground, blocks: [], r: rng(1984),
    spots: { entrances: [], doorsteps: [], gables: [], yards: [], bombsites: [], alleys: [] } };
  placeParty(ctx);
  placeProle(ctx);

  const r = rng(84);
  // ---- bomb sites: soil, rubble, and rosebay willow-herb
  const overlays = [];
  for (const b of ctx.spots.bombsites) {
    const c = b.f.w ? b.f.w((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2) : null;
    if (!c) continue;
    const rx = Math.max(1.5, Math.abs(b.x1 - b.x0) / 2 - 0.5), rz = Math.max(1.5, Math.abs(b.z1 - b.z0) / 2 - 0.5);
    overlays.push({ poly: blob(c.x, c.z, rx, rz, Math.floor(r() * 1e6)), kind: 'dirt', mound: 0.15 });
    if (r() < 0.8) placer.add('rubble_pile', c.x + (r() - 0.5) * rx, c.z + (r() - 0.5) * rz, r() * PI * 2, { scale: 0.8 + r() * 0.6 });
  }
  // the bomb site on the avenue and the waste ground opposite
  overlays.push({ poly: blob(-24, 126, 7, 7, 11), kind: 'rubble', mound: 0.25 });
  placer.add('rubble_pile', -25, 124, 0.7, { scale: 1.3 });
  overlays.push({ poly: blob(25, 125, 7, 11, 12), kind: 'dirt', mound: 0.1 });

  // ---- street furniture
  const lamps = [];
  const lampAt = (x, z, rot) => {
    const p = placer.add('lamp_post', x, z, rot);
    if (p) { const l = placer.node('lamp_post', 'light', x, z, rot) || new THREE.Vector3(x, 4.75, z); lamps.push(l); }
  };
  const telescreens = [];
  const screenAt = (x, z, rot, range = 26) => {
    if (!placer.add('telescreen_pole', x, z, rot)) return;
    const eye = placer.node('telescreen_pole', 'eye', x, z, rot) || new THREE.Vector3(x, 3.7, z);
    telescreens.push({ location: 'city', pos: eye, dir: new THREE.Vector3(Math.sin(rot), 0, Math.cos(rot)), fov: 150, range });
  };
  // the avenue: lamps on both kerbs, a telescreen every block
  for (let z = -2; z <= 258; z += 22) {
    if ((z > 48 && z < 72) || (z > 186 && z < 214)) continue;
    lampAt(-14.4, z, -H); lampAt(14.4, z + 11, H);
  }
  for (const z of [18, 80, 140, 200, 250]) { screenAt(-13.8, z, H); screenAt(13.8, z + 30, -H); }
  // Mansions Road and Station Road
  for (let x = -195; x <= 50; x += 24) { lampAt(x, 48.6, 0); lampAt(x + 12, 71.4, PI); }
  for (let x = -195; x <= 10; x += 24) { lampAt(x, 189.6, 0); lampAt(x + 12, 212.4, PI); }
  screenAt(-40, 48.8, 0); screenAt(-110, 71.2, PI); screenAt(-110, 212.6, PI); screenAt(-60, 189.8, 0);
  // Victory Square: telescreens all round the monument's pediment
  for (let k = 0; k < 4; k++) {
    const a = k * H + PI / 4;
    screenAt(Math.sin(a) * 13.5, -55 + Math.cos(a) * 13.5, a, 30);
  }
  for (let x = -50; x <= 50; x += 20) { lampAt(x, -97, 0); lampAt(x, -13, PI); }
  for (let z = -90; z <= -20; z += 20) { lampAt(-52, z, H); lampAt(52, z, -H); }
  for (const [x, z, rot] of [[-30, -60, H], [30, -60, -H], [-30, -40, H], [30, -40, -H]]) {
    placer.add('bench', x, z, rot); placer.add('bin', x, z + 1.6, 0);
  }
  // the Ministry's plaza
  screenAt(-20, -101.5, 0, 30); screenAt(20, -101.5, 0, 30);
  for (const x of [-48, -24, 24, 48]) lampAt(x, -103, 0);
  // Love Lane, sandbags and the gate of the Ministry of Love
  for (let x = -170; x <= -60; x += 22) { lampAt(x, -89, PI); lampAt(x + 11, -109, 0); }
  screenAt(-100, -89.2, PI); screenAt(-150, -108.8, 0);
  placer.add('sandbags', -178, -92, H); placer.add('sandbags', -178, -106, H);
  // Ministry of Love: barbed wire all round, towers, machine-gun nests
  const fx0 = -350, fx1 = -185, fz0 = -250, fz1 = -85;
  for (let x = fx0 + 3; x < fx1; x += 6) { placer.add('fence_wire', x, fz0, 0); placer.add('fence_wire', x, fz1, PI); }
  for (let z = fz0 + 3; z < fz1; z += 6) {
    placer.add('fence_wire', fx0, z, H);
    if (Math.abs(z - -99) > 7) placer.add('fence_wire', fx1, z, -H);
  }
  for (const [x, z] of [[fx0, fz0], [fx1, fz0], [fx0, fz1], [fx1, fz1], [fx1 + 2, -110], [fx1 + 2, -88]]) placer.add('guard_tower', x, z, -H);
  placer.add('mg_nest', fx1 + 6, -93, -H); placer.add('mg_nest', fx1 + 6, -105, -H);
  placer.add('van', -205, -120, 0.3);
  // Inner Party road: trees and better lamps
  for (let x = 62; x <= 290; x += 18) {
    placer.add(x % 36 < 18 ? 'chestnut' : 'elm', x, -102, r() * PI, { scale: 0.8 + r() * 0.25 });
    lampAt(x + 9, -79.5, PI);
  }
  screenAt(150, -79.8, PI); screenAt(230, -79.8, PI);
  placer.add('chestnut', -58.2, -33, 0.4, { scale: 1.1 });
  // the prole quarter: few lamps, one telescreen at its edge
  for (const z of [30, 90, 150, 210, 270]) for (let x = 75; x < 330; x += 34) lampAt(x, z + 0.4, PI);
  screenAt(57, 60, -H, 22);

  // ---- skyline: the other Ministries and blocks out to the fog
  placer.add('pyramid_far', -900, -700, 0.4, { unique: true, collide: false, cast: false });
  placer.add('pyramid_far', 850, -820, -0.3, { unique: true, collide: false, cast: false });
  const filler = ['party_block_c', 'party_block_a', 'party_block_b', 'prole_terrace_b'];
  for (let i = 0; i < 140; i++) {
    const a = r() * PI * 2, d = 420 + r() * 480;
    const x = Math.cos(a) * d, z = Math.sin(a) * d * 0.9;
    if (Math.abs(x) < 380 && z > -330 && z < 340) continue;
    placer.add(filler[i % filler.length], x, z, Math.round(r() * 4) * H, { collide: false, cast: false, scale: 1 + r() * 0.3 });
  }

  placer.build();
  buildGround(G, map, root);
  buildOverlays(G, map, overlays, root);

  // ---- posters: Big Brother at every commanding corner
  const atlas = posterAtlas(G);
  const posterMat = new THREE.MeshStandardMaterial({ map: atlas.tex, roughness: 0.9, alphaTest: 0.4, side: THREE.DoubleSide });
  const posters = [];
  const posterGeo = standingQuad(1, 1);
  const addPoster = (x, y, z, rot, w, kind) => {
    const g = posterGeo.clone();
    const [u, v, du, dv] = atlas.rect(kind);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, u + uv.getX(i) * du, v + uv.getY(i) * dv);
    const m = new THREE.Mesh(g, posterMat);
    m.scale.set(w, w * 1.4, 1);
    m.position.set(x, y, z);
    m.rotation.y = rot;
    m.receiveShadow = true;
    m.userData.kind = kind;
    root.add(m);
    posters.push(m);
  };
  for (const e of ctx.spots.entrances) {
    for (const side of [-1, 1]) {
      const p = tf(e.x, e.z, e.rot, e.lx + side * 3.2, e.lz + 0.06);
      addPoster(p.x, 1.1, p.z, e.rot, 1.1, r() < 0.7 ? 'bb' : 'ingsoc');
    }
    // the enormous face, high on the facade
    const hi = tf(e.x, e.z, e.rot, e.lx + 6, e.lz + 0.08);
    addPoster(hi.x, 8 + r() * 6, hi.z, e.rot, 4.2, r() < 0.85 ? 'bb' : 'bb_faded');
  }
  for (const g of ctx.spots.gables) {
    if (r() < 0.45) continue;
    const kinds = ['bb_torn', 'ingsoc_torn', 'bb', 'enemy_torn', 'bb_faded'];
    const p = tf(g.x, g.z, g.rot, 0, 0.06);
    addPoster(p.x, 1.0 + r() * 1.2, p.z, g.rot, 1.0, kinds[Math.floor(r() * kinds.length)]);
  }

  // ---- lamps: emissive bulbs always, a pool of real lights near the camera at night
  const pool = [];
  for (let i = 0; i < 12; i++) {
    const l = new THREE.PointLight(0xffc27a, 0, 26, 2);
    l.castShadow = false;
    root.add(l);
    pool.push(l);
  }
  const bulb = G.mats.get('lamp_bulb');
  let poolT = 0;
  const updateLamps = (dt) => {
    const night = 1 - THREE.MathUtils.smoothstep(G.atmos.day ?? 1, 0.15, 0.55);
    if (bulb) bulb.emissiveIntensity = night * 3.5;
    poolT -= dt;
    if (poolT > 0) return;
    poolT = 0.5;
    const cam = G.camera.position;
    const near = lamps.map((p) => [p, (p.x - cam.x) ** 2 + (p.z - cam.z) ** 2]).sort((a, b) => a[1] - b[1]);
    pool.forEach((l, i) => {
      const n = near[i];
      if (!n || night < 0.05) { l.intensity = 0; return; }
      l.position.copy(n[0]);
      l.intensity = 110 * night;
    });
  };

  // ---- named places, doors, the location itself
  const points = namedPoints(ctx);
  const paths = namedPaths(ground);
  for (const d of doorDefs(points)) {
    G.interact({
      location: 'city', pos: d.pos.clone().setY(1.3), radius: 2.2, label: d.label,
      enabled: () => G.locations.has(d.target),
      use: () => {
        if (d.locked && !(G.story && G.story.canEnter && G.story.canEnter(d.id))) {
          if (G.ui && G.ui.toast) G.ui.toast(d.locked);
          return;
        }
        G.teleport(d.target, d.spawn);
      },
    });
  }
  const loc = G.addLocation({
    id: 'city', root, exterior: true, spawns: spawnDefs(points), ground,
    zone: zoneAt,
    update: (dt) => {
      updateLamps(dt);
      placer.cull(G.camera.position);
    },
  });

  if (G.surv && G.surv.addTelescreen) for (const t of telescreens) G.surv.addTelescreen(t);
  G.world = {
    zoneAt, zones: ZONES, points, paths, lamps, telescreens, posters, map, placer,
    surface: (x, z) => map.surface(x, z),
    setPosterEnemy: (kind) => atlas.setEnemy(kind),
  };
  return G.world;
}
