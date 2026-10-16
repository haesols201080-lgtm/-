// London, chief city of Airstrip One, on the real street plan of 1940s central
// London (see london.js). The town generator (town/) lines every street with
// houses, shops, pubs, offices and tenements and leaves bomb sites in the
// gaps; this module puts the story's places among them, raises the
// landmarks (the column in Victory Square, St Martin's, the picture gallery,
// the Ministry of Truth on the site of Senate House), lights the streets,
// hangs the telescreens and posters, and registers the exterior location.
import * as THREE from 'three';
import { GroundMap } from './city_ground.js';
import { Placer } from './city_build.js';
import { posterAtlas } from './city_paint.js';
import { rng, tf, standingQuad, lookYaw } from './city_util.js';
import { addCityLife } from './city_life.js';
import { addPropaganda } from './propaganda.js';
import { londonPlan, WINDOW, VICTORY_SQUARE, SITES, AVENUES, districtAt } from './london.js';
import { buildTown } from './town/index.js';
import { Kit, Frame, TINTS } from './town/kit.js';
import { cornerBuilding } from './town/corner.js';
import { resolve, baysFor } from './town/styles.js';
import { townMaterials } from './town/mats.js';
import { pointInPoly, segDist } from './town/streets.js';

const PI = Math.PI, H = PI / 2;

// where the story's places are looked for (the nearest fitting plot wins)
const WANT = {
  mansions: { at: [-28, -470], minW: 26, kinds: ['street', 'main'], district: ['westend', 'slum'] },
  community: { at: [-40, -600], minW: 15, kinds: ['street', 'main'] },
  cafe: { at: [70, -260], kinds: ['street', 'main', 'lane'] },
  shop: { at: [190, -760], kinds: ['street', 'lane'], district: ['slum'] },
  pub: { at: [150, -690], corner: true, district: ['slum'] },
  obrien: { at: [-190, -1240], minW: 14, district: ['inner'] },
  station: { at: [-120, -330] },
};

export function setupCity(G) {
  const root = new THREE.Group();
  root.name = 'city';
  const r = rng(1984);
  const plan = londonPlan();
  const [wx0, wz0, wx1, wz1] = WINDOW;
  const map = new GroundMap(wx0 - 10, wz0 - 10, wx1 + 10, wz1 + 10, 0.5);
  const ground = (x, z) => map.height(x, z);
  const placer = new Placer(G, root);
  const special = {};

  // ---- choose and restyle the story's buildings among the plots
  const adjust = (cut, { resolve: res, r: rr }) => {
    const houses = cut.jobs.filter((j) => j.kind === 'house');
    const centre = (j) => j.F.p(j.w / 2, 0, 0);
    const near = (want, list) => {
      let best = null, bd = 1e9;
      for (const j of list) {
        if (j.special || j.kind === 'none') continue;
        const kind = j.street && j.street.kind;
        if (want.kinds && kind && !want.kinds.includes(kind)) continue;
        const c = j.kind === 'house' ? centre(j) : [j.poly[1][0], 0, j.poly[1][1]];
        if (want.district && !want.district.includes(districtAt(c[0], c[2]))) continue;
        const d = Math.hypot(c[0] - want.at[0], c[2] - want.at[1]);
        if (d < bd) { bd = d; best = j; }
      }
      return best;
    };
    // a run of neighbouring houses on one frontage merged into one wide plot
    const run = (want) => {
      let best = null, bd = 1e9;
      const byEdge = new Map();
      for (const j of houses) { if (j.kind !== 'house' || j.special) continue; const k = j.block + ':' + j.edge; if (!byEdge.has(k)) byEdge.set(k, []); byEdge.get(k).push(j); }
      for (const list of byEdge.values()) {
        list.sort((a, b) => a.pos - b.pos);
        for (let i = 0; i < list.length; i++) {
          let w = 0, k = i;
          while (k < list.length && w < want.minW && (k === i || Math.abs(list[k - 1].pos + list[k - 1].w - list[k].pos) < 0.05)) { w += list[k].w; k++; }
          if (w < want.minW) continue;
          const c = list[i].F.p(w / 2, 0, 0);
          if (want.district && !want.district.includes(districtAt(c[0], c[2]))) continue;
          if (want.kinds && list[i].street && !want.kinds.includes(list[i].street.kind)) continue;
          const d = Math.hypot(c[0] - want.at[0], c[2] - want.at[1]);
          if (d < bd) { bd = d; best = list.slice(i, k); }
        }
      }
      if (!best) return null;
      const first = best[0];
      const w = best.reduce((s, j) => s + j.w, 0);
      for (const j of best.slice(1)) { j.kind = 'none'; }
      first.w = w;
      first.d = Math.max(...best.map((j) => j.d));
      first.right = best[best.length - 1].right;
      first.stackR = best[best.length - 1].stackR;
      return first;
    };
    // Victory Mansions: a 1930 block of flats, eight floors of brick and steel windows
    const vm = run(WANT.mansions);
    if (vm) {
      const st = res('interwar', rr, { decay: 0.45, storeys: 8 });
      // 'the glass doors of Victory Mansions': a flats entrance, not a shop
      st.wall = 'brick'; st.wallTint = [0.86, 0.74, 0.62];
      st.doorW = 2.2; st.doorH = 2.9; st.glazedDoor = true; st.fan = 'rect'; st.porch = 1.2;
      st.doorBay = Math.floor(baysFor(st, vm.w) / 2);
      vm.style = st; vm.special = 'mansions';
      vm.d = Math.max(vm.d, 13);
    }
    const cc = run(WANT.community);
    if (cc) {
      const st = res('office', rr, { decay: 0.3, storeys: 3 });
      st.gf = 'shop'; st.fasciaTop = 3.6;
      cc.style = st; cc.special = 'community'; cc.signName = 'COMMUNITY CENTRE  ·  SECTOR 7';
    }
    const ob = run(WANT.obrien);
    if (ob) { ob.style = res('stucco', rr, { decay: 0.02, storeys: 5 }); ob.special = 'obrien'; }
    const cafe = near(WANT.cafe, houses);
    if (cafe) {
      const st = res('shop', rr, { decay: 0.3 });
      st.shopPaint = [0.2, 0.18, 0.12];
      cafe.style = st; cafe.special = 'cafe'; cafe.signName = 'THE CHESTNUT TREE CAFÉ';
    }
    const shop = near(WANT.shop, houses.filter((j) => j.w < 7.5));
    if (shop) {
      const st = res('shop', rr, { decay: 0.6, storeys: 3 });
      shop.style = st; shop.special = 'shop'; shop.signName = 'CHARRINGTON  ·  ANTIQUES';
    }
    const pub = near(WANT.pub, cut.jobs.filter((j) => j.kind === 'corner'));
    if (pub) {
      const st = res('shop', rr, { decay: 0.55, storeys: 3 });
      st.gf = 'pub'; st.wall = 'brick'; st.wallTint = TINTS.red[1]; st.cornice = true; st.shopPaint = [0.12, 0.2, 0.14];
      pub.style = st; pub.special = 'pub'; pub.chamfer = 1.6; pub.signName = 'THE WHITE HART';
    }
    cut.jobs = cut.jobs.filter((j) => j.kind !== 'none');
  };

  const town = buildTown(G, root, plan, map, {
    r, adjust,
    roadKind: (x, z) => {
      const n = plan.nearest(x, z);
      const s = n.street;
      if (!s || s.kind === 'main') return 'asphalt';
      return s.district === 'slum' || s.kind === 'lane' || s.kind === 'alley' ? 'setts' : 'asphalt';
    },
  });
  for (const [cx, cz, hx, hz, rot, top] of town.colliders) G.col.add(cx, cz, hx, hz, rot, { y0: -1, y1: top || 12, tag: 'building', sight: true });
  const spots = town.spots;
  const findSpecial = (id) => town.jobs.find((j) => j.special === id);
  const doorOf = (id) => {
    const j = findSpecial(id);
    if (!j || !j.doors || !j.doors.length) return null;
    // the door nearest the middle of the front
    const c = j.kind === 'house' ? j.F.p(j.w / 2, 0, 0.6) : [j.poly[1][0], 0, j.poly[1][1]];
    let best = j.doors[0], bd = 1e9;
    for (const d of j.doors) { const dd = Math.hypot(d.x - c[0], d.z - c[2]); if (dd < bd) { bd = dd; best = d; } }
    return best;
  };

  // ---- landmarks
  // The Big Brother Monument. Whatever stood here before has been taken over:
  // the column carries Big Brother gazing south, the pedestal shows his
  // victory in the Battle of Airstrip One, the lions were recast in the
  // Party's manner. The broad steps can be climbed.
  placer.add('monument', 0, 0, 0, {
    unique: true,
    collide: [[0, 0, 5.0, 5.0, 60], [6.6, 6.0, 1.85, 3.75, 3.4], [-6.6, 6.0, 1.85, 3.75, 3.4], [6.6, -6.0, 1.85, 3.75, 3.4], [-6.6, -6.0, 1.85, 3.75, 3.4]],
  });
  for (let k = 0; k < 4; k++) { const a = 9.6 - k * 0.45; map.addStep(0, 0, 0, -a, -a, a, a, (k + 1) * 0.3); }
  {
    const words = ['BIG BROTHER', 'THE BATTLE OF AIRSTRIP ONE', 'BIG BROTHER', 'OUR NEW HAPPY LIFE'];
    for (let k = 0; k < 4; k++) {
      const a = k * H;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 0.42), G.mats.signMaterial(words[k], { bg: '#4a4740', fg: '#d8ccaa', serif: true }));
      m.position.set(Math.sin(a) * 4.72, 6.15, Math.cos(a) * 4.72);
      m.rotation.y = a;
      root.add(m);
    }
  }
  // St Martin's-in-the-Fields, 'a museum used for propaganda displays'
  placer.add('church', 92, -122, -H, { unique: true });
  // the Ministry of Truth on the site of Senate House
  const mt = plan.minitrue;
  const mScale = (mt.half * 2 - 26) / 170;
  placer.add('minitrue', mt.x, mt.z, 0, { unique: true, scale: mScale });
  // the other three ministries over the roofs: Peace and Plenty in the same
  // white terraces, Love windowless and grey
  placer.add('pyramid_far', 160, 1650, 0.3, { unique: true, collide: false, cast: false, scale: 1.3 });
  placer.add('miniluv', -1700, -500, -0.2, { unique: true, collide: false, cast: false, scale: 1.15 });
  placer.add('pyramid_far', 1800, -1300, 0.5, { unique: true, collide: false, cast: false, scale: 1.25 });
  gallery(G, root, r);
  squareFittings(G, root);

  // ---- distant London: the real footprints beyond the window as massing
  farLondon(G, root, plan.massing, r);

  // ---- street lamps along every street
  const lamps = [];
  const telescreens = [];
  const lampAt = (x, z, rot) => {
    const p = placer.add('lamp_post', x, z, rot);
    if (p) { const l = placer.node('lamp_post', 'light', x, z, rot) || new THREE.Vector3(x, 4.75, z); lamps.push(l); }
  };
  const used = [];
  const free = (x, z, d) => used.every(([a, b]) => Math.hypot(a - x, b - z) > d);
  for (const s of plan.streets) {
    if (s.kind === 'alley') continue;
    const step = s.kind === 'main' ? 30 : s.district === 'slum' ? 46 : 36;
    let acc = step * 0.5, side = 1;
    for (let i = 0; i < s.line.length - 1; i++) {
      const [ax, az] = s.line[i], [bx, bz] = s.line[i + 1];
      const L = Math.hypot(bx - ax, bz - az);
      if (L < 0.01) continue;
      const ux = (bx - ax) / L, uz = (bz - az) / L;
      for (let t = acc; t < L; t += step) {
        const off = s.w / 2 + 0.5;
        const x = ax + ux * t - uz * off * side, z = az + uz * t + ux * off * side;
        side = -side;
        if (map.typeAt(x, z) !== 1 || !free(x, z, 14)) continue;   // on a pavement, not crowded
        used.push([x, z]);
        lampAt(x, z, Math.atan2(uz * side, -ux * side));
      }
      acc = (acc - L) % step; if (acc < 0) acc += step;
    }
  }

  // ---- telescreens: oblong metal plaques set in the walls where the Party
  // looks: over the doors of its offices and flats, on the blank flank walls
  // of its streets, round the monument's pediment, flanking the Ministry's
  // doors. Hardly any in the prole streets.
  const scr = [];
  const freeS = (x, z, d) => scr.every(([a, b]) => Math.hypot(a - x, b - z) > d);
  const wallScreen = (F, lx, y, scale = 0.6, range = 26) => {
    const p = F.p(lx, 0, 0.02);
    if (!freeS(p[0], p[2], 18)) return;
    scr.push([p[0], p[2]]);
    placer.add('telescreen_wall', p[0], p[2], F.rot, { y: F.oy + y, scale, collide: false, unique: false });
    const dir = new THREE.Vector3(Math.sin(F.rot), 0, Math.cos(F.rot));
    telescreens.push({ location: 'city', pos: new THREE.Vector3(p[0], F.oy + y, p[2]).addScaledVector(dir, 0.2), dir, fov: 150, range });
  };
  const partyAt = (x, z) => districtAt(x, z) !== 'slum';
  for (const j of town.jobs) {
    if (j.kind !== 'house' || !j.doors || !j.doors.length) continue;
    const st = j.style;
    const official = st.type === 'office' || st.type === 'interwar' || st.type === 'tenement' || j.special === 'mansions' || j.special === 'community';
    if (!official || !partyAt(j.F.ox, j.F.oz)) continue;
    const d = j.doors[0];
    const [lx] = j.F.local(d.x, d.z);
    const doorTop = (st.raise || 0) + (st.doorH || 2.6);
    wallScreen(j.F, lx, doorTop + 0.6, 0.55, 22);
  }
  for (const g of spots.gables) {
    const party = partyAt(g.x, g.z);
    if (r() > (party ? 0.45 : 0.05)) continue;
    const F = new Frame(g.x, 0.12, g.z, g.rot);
    wallScreen(F, 0, 3.6, 0.75, 30);
  }
  // round the pediment of the monument (the novel), facing the four ways
  for (let k = 0; k < 4; k++) {
    const a = k * H;
    const F = new Frame(Math.sin(a) * 3.62, 0, Math.cos(a) * 3.62, a);
    scr.length = 0;
    wallScreen(F, 0, 8.6, 1.0, 40);
  }
  // flanking the Ministry's great doors
  {
    const fz = mt.z + 85 * mScale;
    for (const dx of [-15, 15]) { const F = new Frame(mt.x + dx, 0.12, fz, 0); wallScreen(F, 0, 5.2, 1.4, 45); }
  }

  placer.build();

  // ---- posters: pasted flat on the walls between windows, a little askew,
  // layered and torn; the great face on the blank flank walls; the hoardings
  const atlas = posterAtlas(G);
  const posterMat = new THREE.MeshStandardMaterial({ map: atlas.tex, roughness: 0.9, alphaTest: 0.4, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  const posters = [];
  const posterGeo = standingQuad(1, 1);
  const addPoster = (x, y, z, rot, w, kind, tilt = 0) => {
    const g = posterGeo.clone();
    const [u, v, du, dv] = atlas.rect(kind);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, u + uv.getX(i) * du, v + uv.getY(i) * dv);
    const m = new THREE.Mesh(g, posterMat);
    m.scale.set(w, w * 1.4, 1);
    m.position.set(x, y, z);
    m.rotation.set(0, rot, tilt, 'YXZ');
    m.receiveShadow = true;
    m.userData.kind = kind;
    root.add(m);
    posters.push(m);
  };
  const FRESH = ['bb', 'bb', 'ingsoc', 'triad', 'down_enemy', 'always_war', 'thanks_bb', 'plan', 'choc', 'bb', 'enemy'];
  const OLD = ['bb_torn', 'ingsoc_torn', 'bb_faded', 'enemy_torn', 'triad_torn', 'down_enemy_torn'];
  // on the piers between the ground-floor openings of house fronts
  for (const j of town.jobs) {
    if (j.kind !== 'house') continue;
    const st = j.style;
    if (st.gf === 'shop' || st.gf === 'pub' || st.type === 'stucco' && districtAt(j.F.ox, j.F.oz) === 'inner') continue;
    const party = partyAt(j.F.ox, j.F.oz);
    if (r() > (party ? 0.3 : 0.14)) continue;
    const bays = baysFor(st, j.w), bw = j.w / bays;
    const win = (st.win && st.win[0]) || { w: 1 };
    const pier = bw - Math.max(win.w || 1, st.doorW || 1);
    if (pier < 0.8) continue;
    const k = 1 + Math.floor(r() * Math.max(1, bays - 1));
    const lx = Math.min(j.w - 0.5, k * bw);
    const pw = Math.min(0.72, pier - 0.12);
    const p = j.F.p(lx, 0, 0.022);   // the quad is centred on its x
    const kinds = party ? (r() < 0.75 ? FRESH : OLD) : OLD;
    addPoster(p[0], 0.12 + (st.raise || 0) + 1.0 + r() * 0.25, p[2], j.F.rot, pw, kinds[Math.floor(r() * kinds.length)], (r() - 0.5) * 0.05);
    // a second pasted half over the first, as bill-stickers do
    if (r() < 0.3) addPoster(p[0] + Math.cos(j.F.rot) * 0.12, 0.12 + (st.raise || 0) + 1.35, p[2] - Math.sin(j.F.rot) * 0.12, j.F.rot, pw * 0.9, OLD[Math.floor(r() * OLD.length)], (r() - 0.5) * 0.08);
  }
  // the great face on the flank walls ('every commanding corner')
  for (const g of spots.gables) {
    const party = partyAt(g.x, g.z);
    const p = tf(g.x, g.z, g.rot, (r() - 0.5) * Math.max(0, g.len - 5), 0.05);
    if (party && g.h > 9 && r() < 0.6) addPoster(p.x, 4.6 + r() * 2.5, p.z, g.rot, Math.min(3.4, g.len * 0.4), r() < 0.85 ? 'bb' : 'bb_faded', (r() - 0.5) * 0.02);
    else if (r() < 0.5) addPoster(p.x, 1.1 + r() * 0.6, p.z, g.rot, 0.95, OLD[Math.floor(r() * OLD.length)], (r() - 0.5) * 0.06);
  }
  for (const b of spots.bombsites) {
    if (!b.hoarding) continue;
    for (let x = b.x0 + 1.2; x < b.x1 - 0.8; x += 1.0 + r() * 1.0) {
      const p = b.f.w(x, 0.09);
      addPoster(p.x, 0.75 + r() * 0.5, p.z, b.f.rot, 0.9 + r() * 0.3, [...FRESH, ...OLD][Math.floor(r() * (FRESH.length + OLD.length))], (r() - 0.5) * 0.07);
    }
  }

  // ---- flags, banners and streamers, every one fixed to something
  addPropaganda(G, root, town, plan, { r, partyAt, avenues: AVENUES, map, minitrue: { x: mt.x, z: mt.z, s: mScale } });

  // ---- lamp light pool near the camera at night
  const pool = [];
  for (let i = 0; i < 12; i++) { const l = new THREE.PointLight(0xffc27a, 0, 24, 2); l.castShadow = false; root.add(l); pool.push(l); }
  const bulb = G.mats.get('lamp_bulb');
  let poolT = 0;
  const updateLamps = (dt) => {
    const night = 1 - THREE.MathUtils.smoothstep(G.atmos.day ?? 1, 0.15, 0.55);
    if (bulb) bulb.emissiveIntensity = night * 2.2;   // the lamps 'hardly gave any light'
    poolT -= dt;
    if (poolT > 0) return;
    poolT = 0.5;
    const cam = G.camera.position;
    const near = lamps.map((p) => [p, (p.x - cam.x) ** 2 + (p.z - cam.z) ** 2]).sort((a, b) => a[1] - b[1]);
    pool.forEach((l, i) => {
      const n = near[i];
      if (!n || night < 0.05) { l.intensity = 0; return; }
      l.position.copy(n[0]);
      l.intensity = 70 * night;
    });
  };

  // ---- the story's places
  const V = (x, z) => new THREE.Vector3(x, ground(x, z), z);
  const P = (d) => (d ? V(d.ox, d.oz) : null);
  const vmDoor = doorOf('mansions'), ccDoor = doorOf('community'), cafeDoor = doorOf('cafe');
  const shopDoor = doorOf('shop'), pubDoor = doorOf('pub'), obDoor = doorOf('obrien');
  const station = WANT.station.at;
  const mDoor = V(mt.x, mt.z + mt.half - 14);
  const points = {
    home_door: P(vmDoor) || V(-28, -470),
    minitrue_door: mDoor,
    monument: V(0, 14),
    monument_center: V(0, 0),
    shop_door: P(shopDoor) || V(190, -760),
    pub_door: P(pubDoor) || V(150, -690),
    obrien_door: P(obDoor) || V(-190, -1240),
    station_door: V(station[0], station[1]),
    cafe_door: P(cafeDoor) || V(70, -260),
    community_door: P(ccDoor) || V(-40, -600),
    rally: V(0, -35),
    square_center: V(0, -30),
    convoy_start: V(-60, 10), convoy_end: V(48, 0),
    chestnut_tree: P(cafeDoor) ? V(cafeDoor.ox + 2, cafeDoor.oz + 2) : V(70, -255),
    prole_entry: V(-6, -840),
    mansions_road: P(vmDoor) ? V(vmDoor.ox + Math.sin(vmDoor.rot) * 3, vmDoor.oz + Math.cos(vmDoor.rot) * 3) : V(-28, -465),
    inner_road: V(-190, -1200),
    church_portico: V(58, -122),
    station_forecourt: V(station[0], station[1] + 3),
  };
  // the rocket falls on a bomb site near the pub
  {
    let best = null, bd = 1e9;
    for (const b of spots.bombsites) {
      const c = b.f.w((b.x0 + b.x1) / 2, -2);
      const d = Math.hypot(c.x - points.pub_door.x, c.z - points.pub_door.z);
      if (d < bd && d > 20) { bd = d; best = c; }
    }
    points.rocket_site = best ? V(best.x, best.z) : V(150, -660);
  }
  // the Underground entrance: railings and a lit sign on the pavement
  undergroundEntrance(G, root, station[0], station[1], r);
  G.col.add(station[0], station[1] - 1.5, 1.6, 0.1, 0, { y0: -1, y1: 1.2, tag: 'rail' });

  const doors = [
    { id: 'mansions', pos: points.home_door, target: 'mansions_hall', spawn: 'street', label: '승리 맨션 안으로 들어간다' },
    { id: 'minitrue', pos: points.minitrue_door, target: 'records', spawn: 'entrance', label: '진리부로 들어간다' },
    { id: 'shop', pos: points.shop_door, target: 'shop', spawn: 'door', label: '골동품 가게 문을 연다' },
    { id: 'pub', pos: points.pub_door, target: 'pub', spawn: 'door', label: '선술집으로 들어간다' },
    { id: 'obrien', pos: points.obrien_door, target: 'obrien', spawn: 'door', label: '오브라이언의 집 초인종을 누른다' },
    { id: 'cafe', pos: points.cafe_door, target: 'cafe', spawn: 'door', label: '밤나무 카페로 들어간다' },
    { id: 'station', pos: points.station_door, target: 'country', spawn: 'halt', label: '지하철을 타고 패딩턴역으로 간다',
      locked: '지금은 기차를 타고 어디로 떠날 까닭이 없다.' },
  ];
  for (const d of doors) {
    G.interact({
      location: 'city', pos: d.pos.clone().setY(1.3), radius: 2.2, label: d.label,
      enabled: () => G.locations.has(d.target),
      use: () => {
        if (d.locked && !(G.story && G.story.canEnter && G.story.canEnter(d.id))) { if (G.ui && G.ui.toast) G.ui.toast(d.locked); return; }
        G.teleport(d.target, d.spawn);
      },
    });
  }
  // spawns: standing outside each door, back to it
  const outward = (d) => (d ? lookYaw(Math.sin(d.rot), Math.cos(d.rot)) : 0);
  const S = (p, yaw) => ({ x: p.x, y: p.y, z: p.z, yaw });
  const spawns = {
    home_door: S(points.home_door, outward(vmDoor)),
    minitrue_door: S(points.minitrue_door, lookYaw(0, 1)),
    monument: S(points.monument, lookYaw(0, 1)),
    shop_door: S(points.shop_door, outward(shopDoor)),
    pub_door: S(points.pub_door, outward(pubDoor)),
    obrien_door: S(points.obrien_door, outward(obDoor)),
    station_door: S(points.station_door, lookYaw(0, 1)),
    cafe_door: S(points.cafe_door, outward(cafeDoor)),
    community_door: S(points.community_door, outward(ccDoor)),
    rally: S(points.rally, lookYaw(0, 1)),
    rocket_site: S(points.rocket_site, 0),
    prole_entry: S(points.prole_entry, lookYaw(1, 0)),
    mansions_road: S(points.mansions_road, outward(vmDoor)),
  };

  // ---- zones and the living range
  const zones = makeZones(plan, points, mt);
  const zoneAt = zones.at;
  // ---- walking paths for crowds and patrols, routed along the streets
  const paths = makePaths(plan, points, ground, map);

  const loc = G.addLocation({
    id: 'city', root, exterior: true, spawns, ground, zone: zoneAt,
    update: (dt) => {
      updateLamps(dt);
      placer.cull(G.camera.position);
      town.update(G.camera.position);
    },
  });
  // detail for where the player starts
  town.update(points.home_door, true);

  if (G.surv && G.surv.addTelescreen) for (const t of telescreens) G.surv.addTelescreen(t);
  G.world = {
    zoneAt, zones: zones.defs, points, paths, lamps, telescreens, posters, map, placer, plan, town,
    surface: (x, z) => map.surface(x, z),
    setPosterEnemy: (kind) => atlas.setEnemy(kind),
    bounds: WINDOW,
  };
  const ctx = { G, placer, map, ground, plan, town, spots, r: rng(1949), blocks: [], inSquare: (x, z) => pointInPoly(x, z, VICTORY_SQUARE) };
  addCityLife(G, ctx, root);
  return G.world;
}

// ---------------------------------------------------------------- zones

function makeZones(plan, pts, mt) {
  const near = (p, r) => [p.x - r, p.z - r, p.x + r, p.z + r];
  const bbox = (poly, m = 0) => { let a = 1e9, b = 1e9, c = -1e9, d = -1e9; for (const [x, z] of poly) { a = Math.min(a, x); b = Math.min(b, z); c = Math.max(c, x); d = Math.max(d, z); } return [a - m, b - m, c + m, d + m]; };
  const defs = {
    minitrue: { name: '진리부', rects: [[mt.x - mt.half - 12, mt.z - mt.half - 12, mt.x + mt.half + 12, mt.z + mt.half + 12]] },
    cafe: { name: '밤나무 카페', rects: [near(pts.cafe_door, 10)] },
    community: { name: '커뮤니티 센터', rects: [near(pts.community_door, 14)] },
    square: { name: '승리 광장', rects: [bbox(VICTORY_SQUARE, 10)] },
    mansions: { name: '승리 맨션', rects: [near(pts.home_door, 40)] },
    station: { name: '지하철역', rects: [near(pts.station_door, 12)] },
    inner: { name: '내부당 구역', rects: [[-330, -1420, -60, -1060]] },
    prole: { name: '프롤 구역', rects: [[40, -1000, 440, -330]] },
    avenue: { name: '당의 대로', rects: [] },
    miniluv: { name: '애정부', rects: [] },
    outskirts: { name: '변두리', rects: [] },
  };
  const inR = (x, z, [a, b, c, d]) => x >= a && x <= c && z >= b && z <= d;
  const ORDER = ['minitrue', 'cafe', 'community', 'square', 'mansions', 'station'];
  const at = (x, z) => {
    for (const id of ORDER) if (defs[id].rects.some((q) => inR(x, z, q))) return id;
    if (pointInPoly(x, z, VICTORY_SQUARE)) return 'square';
    const dist = districtAt(x, z);
    if (dist === 'inner') return 'inner';
    const n = plan.nearest(x, z);
    if (n.street && AVENUES.has(n.street.name) && n.d < (n.street.w || 8) / 2 + (n.street.pave || 2) + 2.5) return 'avenue';
    if (dist === 'slum') return 'prole';
    return 'outskirts';
  };
  return { defs, at };
}

// ---------------------------------------------------------------- paths

// A graph of the street centre lines; routes are walked on the pavement to
// the right of the direction of travel.
function makePaths(plan, pts, ground, map) {
  const key = (x, z) => Math.round(x * 2) + ',' + Math.round(z * 2);
  const nodes = new Map();
  const node = (x, z) => { const k = key(x, z); if (!nodes.has(k)) nodes.set(k, { x, z, e: [] }); return nodes.get(k); };
  for (const s of plan.streets) {
    if (s.kind === 'alley') continue;
    for (let i = 0; i < s.line.length - 1; i++) {
      const a = node(...s.line[i]), b = node(...s.line[i + 1]);
      const w = Math.hypot(b.x - a.x, b.z - a.z);
      a.e.push([b, w, s]); b.e.push([a, w, s]);
    }
  }
  const all = [...nodes.values()];
  const nearestNode = (x, z) => { let best = null, bd = 1e9; for (const n of all) { const d = (n.x - x) ** 2 + (n.z - z) ** 2; if (d < bd && n.e.length) { bd = d; best = n; } } return best; };
  const route = (from, to) => {
    const A = nearestNode(from.x, from.z), B = nearestNode(to.x, to.z);
    if (!A || !B) return [];
    const dist = new Map([[A, 0]]), prev = new Map();
    const open = [A];
    while (open.length) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (dist.get(open[i]) + Math.hypot(open[i].x - B.x, open[i].z - B.z) < dist.get(open[bi]) + Math.hypot(open[bi].x - B.x, open[bi].z - B.z)) bi = i;
      const n = open.splice(bi, 1)[0];
      if (n === B) break;
      for (const [m, w, s] of n.e) {
        const cost = w * (s.kind === 'main' ? 0.8 : 1);
        const nd = dist.get(n) + cost;
        if (nd < (dist.has(m) ? dist.get(m) : 1e18)) { dist.set(m, nd); prev.set(m, [n, s]); if (!open.includes(m)) open.push(m); }
      }
    }
    const out = [];
    let n = B;
    while (n && n !== A) { const p = prev.get(n); if (!p) break; out.push([n, p[1]]); n = p[0]; }
    out.reverse();
    // walk on the right-hand pavement
    const line = [];
    let last = A;
    for (const [m, s] of out) {
      const dx = m.x - last.x, dz = m.z - last.z, L = Math.hypot(dx, dz) || 1;
      const off = (s.w || 7) / 2 + Math.max(0.8, (Array.isArray(s.pave) ? s.pave[0] : s.pave || 1.5) * 0.5);
      const nx = -dz / L, nz = dx / L;
      for (const t of [0.15, 0.85]) {
        const x = last.x + dx * t - nx * off, z = last.z + dz * t - nz * off;
        line.push(new THREE.Vector3(x, ground(x, z), z));
      }
      last = m;
    }
    return line;
  };
  const loop = (list) => { const out = []; for (let i = 0; i < list.length; i++) out.push(...route(list[i], list[(i + 1) % list.length])); return out; };
  const sq = VICTORY_SQUARE.map(([x, z]) => {
    const cx = 0, cz = -30;
    const p = new THREE.Vector3(x + (cx - x) * 0.12, 0, z + (cz - z) * 0.12);
    p.y = ground(p.x, p.z);
    return p;
  });
  const P = (x, z) => ({ x, z });
  const paths = {
    commute: route(pts.home_door, pts.minitrue_door),
    avenue_w: route(P(-60, -150), P(-150, -1000)),
    avenue_e: route(P(-150, -1000), P(-60, -150)),
    square_loop: sq,
    mansions_road: route(pts.home_door, P(pts.home_door.x + 120, pts.home_door.z - 60)),
    station_road: route(pts.station_door, P(0, -60)),
    prole_a: loop([P(80, -660), P(220, -560), P(300, -820), P(140, -900)]),
    prole_b: loop([P(150, -650), P(330, -480), P(380, -700)]),
    lovelane: route(P(-60, -40), P(-300, 40)),
    inner: loop([P(-250, -1150), P(-120, -1180), P(-150, -1350)]),
  };
  for (const k in paths) if (paths[k].length < 2) paths[k] = [new THREE.Vector3(0, 0.12, -30), new THREE.Vector3(20, 0.12, -30)];
  return paths;
}

// ---------------------------------------------------------------- landmarks

// The picture gallery on the north side of the square: a long stone front
// with a columned portico and a low dome, much as the National Gallery.
function gallery(G, root, r) {
  const K = new Kit();
  const st = resolve('office', r, { decay: 0.25, storeys: 2 });
  st.floors = [7.5, 6.0]; st.raise = 1.6;
  st.win = [{ w: 1.6, h: 3.6, sill: 1.6, glazing: 'sash2', head: 'pediment' }, { w: 1.4, h: 3.0, sill: 1.2, glazing: 'sash2', head: 'architrave' }];
  st.wallTint = [0.86, 0.84, 0.78]; st.gfTint = [0.8, 0.78, 0.72]; st.bayPitch = 6;
  const poly = SITES.gallery.slice().reverse();   // clockwise in plan terms: outside on the left
  // the front faces south onto the terrace: find that edge
  const fronts = [];
  for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; if (Math.abs(a[1] - b[1]) < 1 && a[1] > -100) fronts.push([i, i + 1]); }
  cornerBuilding(K, { poly, fronts, d: 40 }, st, r, 0.12);
  // portico: eight columns and a pediment in the middle of the front
  const zf = -96, x0 = -38, x1 = -14, yb = 0.12 + 1.6, h = 11;
  for (let i = 0; i < 8; i++) {
    const x = x0 + ((x1 - x0) * i) / 7;
    K.cyl('stone_dirty', x, zf + 4.2, yb, yb + h, 0.55, 10, true, [0.86, 0.84, 0.78]);
  }
  const F = new Frame(x0 - 1.2, yb + h, zf + 5.2, 0);
  K.box('stone_dirty', F, 0, x1 - x0 + 2.4, 0, 1.4, -5.6, 0, 'fblrtu', [0.86, 0.84, 0.78]);
  K.face('stone_dirty', [F.p(0, 1.4, 0), F.p(x1 - x0 + 2.4, 1.4, 0), F.p((x1 - x0 + 2.4) / 2, 4.4, 0)], 0, 0, 1, [0.84, 0.82, 0.76]);
  K.face('slate', [F.p(0, 1.4, 0), F.p((x1 - x0 + 2.4) / 2, 4.4, 0), F.p((x1 - x0 + 2.4) / 2, 4.4, -5.6), F.p(0, 1.4, -5.6)], -0.5, 1, 0);
  K.face('slate', [F.p((x1 - x0 + 2.4) / 2, 4.4, 0), F.p(x1 - x0 + 2.4, 1.4, 0), F.p(x1 - x0 + 2.4, 1.4, -5.6), F.p((x1 - x0 + 2.4) / 2, 4.4, -5.6)], 0.5, 1, 0);
  // steps up to the portico
  for (let i = 0; i < 6; i++) K.box('stone_dirty', new Frame(x0 - 2, 0.12, zf + 6 + (5 - i) * 0.3, 0), 0, x1 - x0 + 4, 0, 0.27 * (i + 1), -6 - (5 - i) * 0.3 + 0.3, 0, 'ftlr');
  // the dome over the middle
  const dx = (x0 + x1) / 2, dz = zf - 16, base = 0.12 + 13.5 + 1;
  K.cyl('stone_dirty', dx, dz, base, base + 4, 7, 16, false, [0.82, 0.8, 0.74]);
  for (let i = 0; i < 6; i++) {
    const a0 = (i / 6) * H, a1 = ((i + 1) / 6) * H;
    const r0 = Math.cos(a0) * 7.4, r1 = Math.cos(a1) * 7.4, y0 = base + 4 + Math.sin(a0) * 5, y1 = base + 4 + Math.sin(a1) * 5;
    for (let k = 0; k < 16; k++) {
      const b0 = (k / 16) * PI * 2, b1 = ((k + 1) / 16) * PI * 2;
      K.face('metal_dark', [[dx + Math.cos(b0) * r0, y0, dz + Math.sin(b0) * r0], [dx + Math.cos(b1) * r0, y0, dz + Math.sin(b1) * r0], [dx + Math.cos(b1) * r1, y1, dz + Math.sin(b1) * r1], [dx + Math.cos(b0) * r1, y1, dz + Math.sin(b0) * r1]], Math.cos((b0 + b1) / 2), 0.6, Math.sin((b0 + b1) / 2), [0.5, 0.6, 0.55]);
    }
  }
  K.build(root, townMaterials(G), { name: 'gallery' });
  G.col.add(-24, -123, 68, 27, 0, { y0: -1, y1: 20, tag: 'building' });
  G.col.add((x0 + x1) / 2, zf + 4.2, (x1 - x0) / 2 + 0.6, 0.6, 0, { y0: -1, y1: 12, tag: 'columns', sight: false });
}

// Victory Square's two fountains, drained for the duration and never filled
// again: granite basins with litter and dead leaves in them.
function squareFittings(G, root) {
  const K = new Kit();
  for (const sx of [-1, 1]) {
    const cx = sx * 22, cz = -38, R = 6.2;
    K.cyl('granite', cx, cz, 0.12, 0.66, R, 32, true, [0.7, 0.68, 0.64]);   // the basin, drained and silted up
    K.cyl('granite', cx, cz, 0.12, 0.76, R + 0.2, 32, false);
    K.cyl('granite', cx, cz, 0.62, 2.6, 0.9, 12, true);
    K.cyl('bronze', cx, cz, 2.6, 3.0, 1.6, 16, true);
    K.cyl('granite', cx, cz, 3.0, 4.2, 0.35, 10, true);
    G.col.add(cx, cz, R, R, 0, { y0: -1, y1: 0.76, tag: 'fountain', sight: false });
    G.col.add(cx, cz, R * 0.72, R * 0.72, Math.PI / 4, { y0: -1, y1: 0.76, tag: 'fountain', sight: false });
  }
  K.build(root, townMaterials(G), { name: 'square' });
}

// The Underground entrance: a stair down behind railings, a lit sign.
function undergroundEntrance(G, root, x, z, r) {
  const K = new Kit();
  const F = new Frame(x - 1.6, 0.12, z - 1.4, 0);
  K.box('tile_white', F, 0, 3.2, -2.6, 0, -4.2, 0, 'lr', [0.75, 0.75, 0.7]);
  K.box('rubber', F, 0, 3.2, -2.6, -2.5, -4.2, 0, 't');
  for (let i = 0; i < 10; i++) K.box('stone_dirty', F, 0.1, 3.1, -0.26 * (i + 1), -0.26 * i, -0.4 * (i + 1), -0.4 * i, 'ft');
  for (const sx of [0, 3.2]) {
    K.box('iron_black', F, sx - 0.03, sx + 0.03, 0, 1.05, -4.2, 0, 'flrbt');
    for (let zz = 0; zz > -4.2; zz -= 0.14) K.box('iron_black', F, sx - 0.01, sx + 0.01, 0, 1.0, zz - 0.01, zz + 0.01, 'flr');
  }
  K.box('iron_black', F, 0, 3.2, 0, 1.05, -4.25, -4.15, 'fb');
  // the sign on two posts
  const sF = new Frame(x - 1.2, 0.12, z + 0.1, 0);
  K.box('iron_black', sF, 0, 0.08, 0, 2.6, -0.04, 0.04, 'flrbt');
  K.box('iron_black', sF, 2.32, 2.4, 0, 2.6, -0.04, 0.04, 'flrbt');
  const atlas = townMaterials(G);
  K.box('metal_dark', sF, -0.05, 2.45, 2.2, 2.9, -0.06, 0.06, 'blrtu');
  K.build(root, atlas, { name: 'underground' });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), G.mats.signMaterial('UNDERGROUND', { bg: '#1c2a4a', fg: '#e6e2d8' }));
  sign.position.set(x - 1.2 + 1.2, 0.12 + 2.55, z + 0.17);
  root.add(sign);
}

// Real building footprints beyond the playable window, as low dark massing
// with a forest of chimneys: London going on into the smoke.
function farLondon(G, root, massing, r) {
  const K = new Kit();
  K.lod = true;
  for (const [x, z, hx, hz, rot, h0] of massing) {
    const h = Math.min(h0, 12 + r() * 10);
    const F = new Frame(x, 0, z, rot);
    const t = TINTS.stock[2 + Math.floor(r() * 2)].map((v) => v * 0.8);
    K.box('brick', F, -hx, hx, 0, h, -hz, hz, 'fblrt', t);
    if (hx * hz > 60 && r() < 0.6) K.box('brick', F, -hx * 0.3, -hx * 0.3 + 0.8, h, h + 1.6, -0.6, 0.6, 'fblrt', TINTS.soot[0]);
  }
  K.build(root, townMaterials(G), { name: 'farlondon', cast: false });
}
