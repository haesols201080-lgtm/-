// Gameplay layer: light-shard collectibles, physics props (crates, stones, ball, power cell), the pressure-plate
// gate puzzle, crate-stacking to the booster upgrade, the powered lift, vine climbing, companion robots,
// region discovery, checkpoints and save data.
import * as THREE from 'three';
import { mulberry32, clamp, damp, smoothstep } from './util.js';
import { REGIONS, START, OUTCROP, STUMPS, LOGS, WORLD, GLADE_RIDGE } from './layout.js';
import { MILESTONES } from './quests.js';
import { TALK, MEMORY } from './story.js';

const rnd = mulberry32(99);

export class Gameplay {
  constructor(ctx, world, player, ui, audio, fx) {
    Object.assign(this, { ctx, world, player, ui, audio, fx });
    this.scene = ctx.scene; this.R = ctx.RAPIER; this.W = ctx.physics; this.T = world.terrain;
    this.shards = []; this.props = []; this.companions = []; this.zones = []; this.interactables = []; this.mossSources = [];
    this.save = { shards: [], companions: [], regions: [], gateOpen: false, liftPowered: false, booster: false, cellPlaced: false, unlocks: [], explored: '' };
    this.comboN = 0; this.lastCollect = -9;
    this.time = 0;
    this.mats = this.makeMats();
  }

  makeMats() {
    const A = this.ctx.assets.tex;
    const wood = new THREE.MeshStandardMaterial({ map: A.bark.map, normalMap: A.bark.normal, color: 0xd8b48a, roughness: 0.85 });
    const rust = new THREE.MeshStandardMaterial({ color: 0x5a3a26, roughness: 0.62, metalness: 0.75, normalMap: A.rock.normal, normalScale: new THREE.Vector2(0.4, 0.4) });
    const paint = new THREE.MeshStandardMaterial({ color: 0x3e6b62, roughness: 0.55, metalness: 0.6, normalMap: A.rock.normal, normalScale: new THREE.Vector2(0.25, 0.25) });
    const steel = new THREE.MeshStandardMaterial({ color: 0x8b9096, roughness: 0.38, metalness: 1 });
    const stone = new THREE.MeshStandardMaterial({ map: A.rock.map, normalMap: A.rock.normal, roughness: 0.85 });
    const shard = new THREE.MeshPhysicalMaterial({ color: 0x9ff6ff, emissive: 0x2bd9ff, emissiveIntensity: 1.6, roughness: 0.1, metalness: 0, transmission: 0.0, clearcoat: 1 });
    const cellGlow = new THREE.MeshStandardMaterial({ color: 0x102a10, emissive: 0x8cff6a, emissiveIntensity: 2.2 });
    const rubber = new THREE.MeshPhysicalMaterial({ color: 0xc8322a, roughness: 0.55, clearcoat: 0.3 });
    return { wood, rust, paint, steel, stone, shard, cellGlow, rubber };
  }

  // a modelled prop (Blender, scanned materials) as a new group; `over` maps mesh-name prefixes to materials
  prop(name, over = {}) {
    const g = new THREE.Group(), src = this.ctx.assets.models['prop_' + name];
    if (!src) return g;
    src.scene.updateMatrixWorld(true);
    src.scene.traverse((o) => {
      if (!o.isMesh) return;
      const k = Object.keys(over).find((p) => o.name.startsWith(p));
      const m = new THREE.Mesh(o.geometry, k ? over[k] : o.material); m.name = o.name;
      m.applyMatrix4(o.matrixWorld); m.castShadow = true; m.receiveShadow = true; g.add(m);
    });
    return g;
  }

  groundY(x, z) {
    const hit = this.W.castRay(new this.R.Ray({ x, y: 30, z }, { x: 0, y: -1, z: 0 }), 60, true, this.R.QueryFilterFlags.EXCLUDE_SENSORS, undefined, undefined, undefined,
      (c) => c.userData?.kind !== 'player' && c.userData?.kind !== 'item' && c.userData?.kind !== 'item-held');
    return hit ? 30 - hit.timeOfImpact : this.T.heightAt(x, z);
  }

  build() {
    this.buildShards();
    this.buildGatePuzzle();
    this.buildGlade();
    this.buildLiftAndVines();
    this.buildProps();
    this.buildCompanions();
    this.buildEdge();
  }

  // ---------------------------------------------------------------- shards
  buildShards() {
    let geo = new THREE.OctahedronGeometry(0.045, 0); geo.scale(0.75, 1.3, 0.75);
    { const sm = this.prop('shard').children[0]; if (sm) { geo = sm.geometry.clone().applyMatrix4(sm.matrix); geo.computeVertexNormals(); } }
    const spots = [];
    const onPath = [[0.2, 21], [-0.8, 18.5], [-2, 15.5], [-2.6, 12.5], [-2.2, 9], [-1.9, 6.5], [-2.1, 1.0], [-3.6, -3.5], [-6.8, -7.8], [2.2, -2.2], [6, -3.2], [10, -4]];
    onPath.forEach(([x, z]) => spots.push([x, null, z]));
    // on top of boulders and stumps (vertical exploration)
    for (const r of this.world.rocks.filter((q) => !q.small).slice(0, 12)) spots.push([r.x, r.top + 0.12, r.z]);
    for (const s of this.world.stumps) spots.push([s.x, s.top + 0.12, s.z]);
    // along the bridge log
    const L = LOGS[0];
    for (let i = 0; i < 3; i++) { const t = 0.25 + i * 0.25; spots.push([L[0] + (L[2] - L[0]) * t, this.world.logs[0].y + L[4] + 0.12, L[1] + (L[3] - L[1]) * t]); }
    // inside the hollow log
    const H = LOGS[1]; spots.push([(H[0] + H[2]) / 2, null, (H[1] + H[3]) / 2]);
    // around the pond rim and in the shallows
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 1.4 + 2.2; spots.push([17.5 + Math.cos(a) * 6.2, null, -7 + Math.sin(a) * 6.2]); }
    // tunnel cave + summit
    for (const p of this.caveSpots()) spots.push(p);
    // glade + north path
    spots.push([-18.5, null, -20.5], [-21, null, -24], [-3, null, -22], [0, null, -29]);
    // the squirrel's hoard: shards it took for acorns, stashed on the highest boulder with its cones
    {
      const hi = this.world.rocks.filter((q) => !q.small).sort((a, b) => (b.top - this.T.heightAt(b.x, b.z)) - (a.top - this.T.heightAt(a.x, a.z)))[0];
      if (hi) {
        for (let k = 0; k < 3; k++) { const a = k * 2.1; spots.push([hi.x + Math.cos(a) * 0.16, hi.top + 0.1, hi.z + Math.sin(a) * 0.16]); }
        const cones = [0, 1, 2].map((i) => this.world.variants('pinecone_' + i)[0]).filter(Boolean);
        for (let k = 0; k < 6; k++) { const v = cones[k % cones.length]; if (!v) break; const a = k * 1.05 + 0.4, r = 0.08 + (k % 2) * 0.07;
          const m = new THREE.Mesh(v.geo, v.mat); m.position.set(hi.x + Math.cos(a) * r, hi.top - 0.01, hi.z + Math.sin(a) * r); m.rotation.set(1.3, a, 0.4 * k); m.scale.setScalar(1.1); m.castShadow = true; this.scene.add(m); }
        this.stash = new THREE.Vector3(hi.x, hi.top, hi.z);
      }
    }
    spots.forEach(([x, y, z], i) => {
      const m = new THREE.Mesh(geo, this.mats.shard);
      const gy = y ?? this.groundY(x, z) + 0.13;
      m.position.set(x, gy, z); m.castShadow = false;
      this.scene.add(m);
      const light = i % 4 === 0 ? new THREE.PointLight(0x5ee8ff, 0.25, 1.2, 2) : null;
      if (light) m.add(light);
      this.shards.push({ id: 's' + i, mesh: m, base: gy, got: false });
    });
    this.totalShards = this.shards.length;
  }

  caveSpots() {
    // probe the tunnel: walkable floor inside the outcrop under a rock ceiling
    const out = [];
    const c = Math.cos(OUTCROP.yaw), s = Math.sin(OUTCROP.yaw);
    for (const t of [-0.5, 0, 0.45]) {
      // tunnel runs along local y (Blender) -> game local -z; rotated by yaw
      const lx = 0.6 + t * 4, lz = -(t * 6);
      const wx = OUTCROP.x + lx * c + lz * s, wz = OUTCROP.z - lx * s + lz * c;
      const floor = this.floorUnderCeiling(wx, wz);
      if (floor !== null) out.push([wx, floor + 0.15, wz]);
    }
    this.caveCenter = out[1] ? new THREE.Vector3(out[1][0], out[1][1], out[1][2]) : null;
    return out;
  }
  floorUnderCeiling(x, z) {
    for (let y = OUTCROP.base + 0.2; y < OUTCROP.base + 1.6; y += 0.1) {
      const up = this.W.castRay(new this.R.Ray({ x, y, z }, { x: 0, y: 1, z: 0 }), 4, false, this.R.QueryFilterFlags.EXCLUDE_SENSORS);
      const dn = this.W.castRay(new this.R.Ray({ x, y, z }, { x: 0, y: -1, z: 0 }), 1.5, false, this.R.QueryFilterFlags.EXCLUDE_SENSORS);
      if (up && dn && up.timeOfImpact > 0.45 && up.collider.userData?.kind === 'outcrop') return y - dn.timeOfImpact;
    }
    return null;
  }

  // ---------------------------------------------------------------- crates / props
  makeCrate(x, z, size = 0.3) {
    const s = size;
    const g = this.prop('crate'); g.scale.setScalar(s / 0.3); g.rotation.y = (rnd() - 0.5) * 0.1;
    const outer = new THREE.Group(); outer.add(g);
    const y = this.groundY(x, z) + s / 2 + 0.02;
    const body = this.W.createRigidBody(this.R.RigidBodyDesc.dynamic().setTranslation(x, y, z).setLinearDamping(2.5).setAngularDamping(4).setCcdEnabled(true));
    body.setEnabledRotations(false, true, false, true);
    const col = this.W.createCollider(this.R.ColliderDesc.cuboid(s / 2, s / 2, s / 2).setMass(18).setFriction(0.7), body);
    col.userData = { kind: 'crate', surface: 'wood', weight: 18 };
    this.scene.add(outer);
    const p = { kind: 'crate', body, col, mesh: outer, size: s };
    this.props.push(p);
    return p;
  }

  makeItem(kind, x, z, opts = {}) {
    let mesh, desc, mass = 1, r = 0.05;
    if (kind === 'stone') {
      const v = this.world.variants('rk_rock_07')[0];
      const geo = v.geo.clone(); geo.translate(0, -v.size.y / 2, 0);
      mesh = new THREE.Mesh(geo, v.mat);
      const w = Math.max(v.size.x, v.size.z); r = 0.05 + rnd() * 0.02; mesh.scale.setScalar(r * 2 / w);
      desc = this.R.ColliderDesc.ball(r * 0.9); mass = 1.2;
    } else if (kind === 'ball') {
      r = 0.075; mesh = this.prop('ball', { ball: this.mats.rubber });
      desc = this.R.ColliderDesc.ball(r).setRestitution(0.65); mass = 0.25;
    } else if (kind === 'cell') {
      r = 0.05; mesh = this.cellModel();
      const pl = new THREE.PointLight(0x8cff6a, 0.4, 1, 2); mesh.add(pl);
      desc = this.R.ColliderDesc.cylinder(0.055, 0.042); mass = 1;
    } else if (kind === 'pinecone') {
      r = 0.035;
      const v = this.world.variants('pinecone_' + Math.floor(rnd() * 3))[0];
      const pg = v.geo.clone(); pg.translate(0, -v.size.y / 2, 0);
      mesh = new THREE.Mesh(pg, v.mat); mesh.scale.setScalar(0.075 / Math.max(v.size.x, v.size.y, v.size.z));
      desc = this.R.ColliderDesc.ball(r); mass = 0.2;
    }
    mesh.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    const y = opts.y ?? this.groundY(x, z) + r + 0.03;
    const body = this.W.createRigidBody(this.R.RigidBodyDesc.dynamic().setTranslation(x, y, z).setLinearDamping(0.4).setAngularDamping(0.6).setCcdEnabled(true));
    const col = this.W.createCollider(desc.setMass(mass).setFriction(0.8), body);
    col.userData = { kind: 'item', item: kind, weight: mass };
    this.scene.add(mesh);
    const p = { kind, body, col, mesh, r, carry: true };
    this.props.push(p);
    return p;
  }

  cellModel() {
    return this.prop('cell', { core: this.mats.cellGlow, window: new THREE.MeshPhysicalMaterial({ color: 0xcfe9dc, roughness: 0.05, transmission: 0.0, transparent: true, opacity: 0.35, depthWrite: false }) });
  }

  buildProps() {
    this.ball = this.makeItem('ball', 2.2, 21.5);
    for (let i = 0; i < 5; i++) { const a = i * 1.3; this.makeItem('stone', -1 + Math.cos(a) * 2.5, 4.6 + Math.sin(a) * 0.8); }
    for (let i = 0; i < 6; i++) { const t = this.world.treeSpots[i]; const a = rnd() * 6.28; this.makeItem('pinecone', t.x + Math.cos(a) * 1.6, t.z + Math.sin(a) * 1.6); }
    // power cell hidden inside the hollow log (crawl in to get it)
    const H = LOGS[1];
    const cx = (H[0] + H[2]) / 2, cz = (H[1] + H[3]) / 2;
    if (!this.save.cellPlaced) this.cell = this.makeItem('cell', cx, cz, { y: this.world.logs[1].y - 0.08 });
  }

  // ---------------------------------------------------------------- gate puzzle
  buildGatePuzzle() {
    // iron garden gate wedged between two big boulders
    const a = new THREE.Vector3(-15.6, 0, -14.2), b = new THREE.Vector3(-10.4, 0, -16.6);
    const dir = b.clone().sub(a); const len = dir.length(); dir.normalize();
    const gateC = a.clone().addScaledVector(dir, len / 2);
    const gy = this.groundY(gateC.x, gateC.z);
    const width = len - 2.0, height = 0.95;
    const gate = new THREE.Group();
    const leafW = width / 2 - 0.02, leaves = [];
    for (const sd of [-1, 1]) {
      const pil = this.prop('gate_pillar'); pil.position.set(sd * (width / 2 + 0.19), -0.04, 0); pil.rotation.y = sd > 0 ? Math.PI : 0; gate.add(pil);
      // stones stacked from the pillar up against the boulder so the gate is part of a wall
      for (let k = 0; k < 2; k++) {
        const st = this.prop('gate_pillar'); st.position.set(sd * (width / 2 + 0.55 + k * 0.33), -0.5 - k * 0.25, (rnd() - 0.5) * 0.06);
        st.rotation.y = rnd() * 0.3; st.scale.set(1.0, 0.9, 0.95); gate.add(st);
      }
      const hinge = new THREE.Group(); hinge.position.set(sd * width / 2, 0, 0); gate.add(hinge);
      const leaf = this.prop('gate_leaf'); leaf.scale.set(leafW * -sd, height / 0.95, 1); hinge.add(leaf);
      hinge.userData.sd = sd; leaves.push(hinge);
    }
    gate.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    gate.position.set(gateC.x, gy - 0.05, gateC.z); gate.rotation.y = -Math.atan2(dir.z, dir.x);
    this.scene.add(gate);
    const q = new THREE.Quaternion().setFromEuler(gate.rotation);
    const body = this.W.createRigidBody(this.R.RigidBodyDesc.kinematicPositionBased().setTranslation(gateC.x, gy + height / 2, gateC.z).setRotation(q));
    const col = this.W.createCollider(this.R.ColliderDesc.cuboid(width / 2 + 0.6, height / 2 + 0.6, 0.04), body);
    col.userData = { kind: 'gate', surface: 'metal' };
    // fill the gaps between gate and boulders
    for (const s of [-1, 1]) {
      const p = gateC.clone().addScaledVector(dir, s * (width / 2 + 0.6));
      const c = this.W.createCollider(this.R.ColliderDesc.cuboid(0.6, 1.2, 0.08).setTranslation(p.x, gy + 1.0, p.z).setRotation(q));
      c.userData = { kind: 'static', surface: 'rock' };
    }
    this.gate = { mesh: gate, leaves, body, y0: gy, open: this.save.gateOpen ? 1 : 0, height, center: gateC };
    this.buildGladeWall();
    // pressure plate on the near (south-east) side
    const nrm = new THREE.Vector3(-dir.z, 0, dir.x); if (nrm.z < 0) nrm.negate();
    const pp = gateC.clone().addScaledVector(nrm, 2.2).addScaledVector(dir, 0.6);
    const py = this.groundY(pp.x, pp.z);
    const plate = new THREE.Group();
    // pressure pad in the robots' design language (white painted panels, graphite housing, rubber treads, a light ring)
    const ringM = new THREE.MeshStandardMaterial({ color: 0x0a2a33, emissive: 0x4fe8ff, emissiveIntensity: 0.3, roughness: 0.3 });
    const padM = { shell: new THREE.MeshPhysicalMaterial({ color: 0xc9c4b9, roughness: 0.48, metalness: 0.04, clearcoat: 0.15, clearcoatRoughness: 0.35, vertexColors: true }),
      dark: new THREE.MeshStandardMaterial({ color: 0x2c3036, roughness: 0.5, metalness: 0.9, vertexColors: true }),
      rubber: new THREE.MeshStandardMaterial({ color: 0x17191c, roughness: 0.88, vertexColors: true }), eye: ringM };
    const byName = (g) => { g.traverse((o) => { if (o.isMesh) { const k = (o.material.name || '').split('.')[0]; if (padM[k]) o.material = padM[k]; } }); return g; };
    const base = byName(this.prop('plate_sf_base')); base.position.y = 0.035; plate.add(base);
    const top = new THREE.Group(); top.add(byName(this.prop('plate_sf_top'))); top.position.y = 0.04; plate.add(top);
    top.children[0].position.y = 0.035 - 0.04 + 0.05;
    plate.rotation.y = gate.rotation.y + Math.PI / 2;
    const ring = { material: ringM };
    plate.position.set(pp.x, py, pp.z); plate.traverse((o) => { if (o.isMesh) { o.receiveShadow = true; o.castShadow = true; } });
    this.scene.add(plate);
    // colliders follow the model: the housing (top at +0.093) and the pad, which sinks with the load
    const pc = this.W.createCollider(this.R.ColliderDesc.cylinder(0.059, 0.38).setTranslation(pp.x, py + 0.034, pp.z));
    pc.userData = { kind: 'plate', surface: 'metal' };
    const padBody = this.W.createRigidBody(this.R.RigidBodyDesc.kinematicPositionBased().setTranslation(pp.x, py + 0.108, pp.z));
    const padCol = this.W.createCollider(this.R.ColliderDesc.cylinder(0.016, 0.25), padBody); padCol.userData = { kind: 'plate', surface: 'metal' };
    this.plate = { mesh: plate, top, ring, pos: new THREE.Vector3(pp.x, py, pp.z), press: 0, padBody };
    this.plateFx = this.buildPlateFx(new THREE.Vector3(pp.x, py, pp.z), gateC.clone().addScaledVector(dir, -(width / 2 + 0.19)), gy);
    // crate placed a few metres away
    this.gateCrate = this.makeCrate(pp.x + nrm.x * 1.6 + dir.x * 1.2, pp.z + nrm.z * 1.6 + dir.z * 1.2);
    // a little sign of rust flakes... and the reward behind the gate (glade)
  }

  // the glade is closed by a rocky earth bank (raised in the terrain, planted with shrubs, ferns and young firs by the
  // world): stones of every size sit half-buried in its crest — boulders, tilted slabs, rubble — with gaps the
  // undergrowth fills, the way a moraine or an old field bank looks; a sealed band inside the crest keeps it closed
  buildGladeWall() {
    const pts = GLADE_RIDGE;
    const segs = []; let total = 0;
    for (let i = 0; i + 1 < pts.length; i++) { const L = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); segs.push({ i, L, t0: total }); total += L; }
    const at = (t) => { const g = segs.find((q) => t <= q.t0 + q.L) || segs[segs.length - 1]; const f = (t - g.t0) / g.L, [x0, z0] = pts[g.i], [x1, z1] = pts[g.i + 1];
      return { x: x0 + (x1 - x0) * f, z: z0 + (z1 - z0) * f, tx: (x1 - x0) / g.L, tz: (z1 - z0) / g.L }; };
    const L = this.world.rockLib(), vars = [...L.big.filter((v) => v.src !== 'boulder_01'), ...L.mid, ...L.small];
    const lists = vars.map(() => []);
    const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), p = new THREE.Vector3();
    const stone = (x, z, D, H, sink, tilt, flat = 1) => {
      const k = Math.floor(rnd() * vars.length), v = vars[k];
      const s = D / Math.max(v.size.x, v.size.z), sy = H / v.size.y;
      let gy = this.T.heightAt(x, z);
      for (let a2 = 0; a2 < 6.28; a2 += 1.57) gy = Math.min(gy, this.T.heightAt(x + Math.cos(a2) * D * 0.3, z + Math.sin(a2) * D * 0.3));
      e.set((rnd() - 0.5) * tilt, rnd() * 6.28, (rnd() - 0.5) * tilt); q.setFromEuler(e);
      p.set(x, gy - H * sink, z); sc.set(s, sy, s * flat);
      mtx.compose(p, q, sc); lists[k].push(mtx.clone());
      this.world.hull(v.geo, mtx, { kind: 'rock', surface: 'rock' });
      this.mossSources.push({ geo: v.geo, matrix: mtx.clone(), kind: 'rock' });
    };
    let t = segs[0].L * 0.18;
    const tEnd = total - segs[segs.length - 1].L * 0.18;
    while (t < tEnd) {
      const c = at(t), nx = -c.tz, nz = c.tx, r = rnd();
      const off = (rnd() - 0.5) * 0.9, x = c.x + nx * off, z = c.z + nz * off;
      let step;
      if (r < 0.45) { const D = 0.9 + rnd() * 1.2; stone(x, z, D, D * (0.55 + rnd() * 0.35), 0.35 + rnd() * 0.15, 0.3); step = D * (0.5 + rnd() * 0.4); }
      else if (r < 0.72) { const D = 1.1 + rnd() * 0.9; stone(x, z, D, 0.35 + rnd() * 0.3, 0.25, 0.9, 0.55 + rnd() * 0.3); step = D * 0.6; }   // tilted slab
      else if (r < 0.88) {                                                      // rubble pile
        for (let k = 0; k < 3; k++) { const D = 0.35 + rnd() * 0.4; stone(x + (rnd() - 0.5) * 0.8, z + (rnd() - 0.5) * 0.8, D, D * 0.7, 0.3, 0.8); }
        step = 0.9;
      } else step = 0.8 + rnd() * 0.8;                                           // a gap the shrubs fill
      // loose stones down the slopes
      if (rnd() < 0.5) { const sd = rnd() < 0.5 ? -1 : 1, d = 1.0 + rnd() * 0.9, D = 0.25 + rnd() * 0.35; stone(c.x + nx * sd * d, c.z + nz * sd * d, D, D * 0.6, 0.35, 0.8); }
      t += step;
    }
    vars.forEach((v, k) => {
      if (!lists[k].length) return;
      const im = new THREE.InstancedMesh(v.geo, v.mat, lists[k].length);
      lists[k].forEach((m, i) => im.setMatrixAt(i, m));
      im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere(); this.scene.add(im);
    });
    // sealed band along the crest
    for (let i = 0; i + 1 < pts.length; i++) {
      const [x0, z0] = pts[i], [x1, z1] = pts[i + 1];
      const f0 = i === 0 ? 0.12 : 0, f1 = i === pts.length - 2 ? 0.88 : 1;
      const xa = x0 + (x1 - x0) * f0, za = z0 + (z1 - z0) * f0, xb = x0 + (x1 - x0) * f1, zb = z0 + (z1 - z0) * f1;
      const cx = (xa + xb) / 2, cz = (za + zb) / 2, len = Math.hypot(xb - xa, zb - za), yaw = -Math.atan2(z1 - z0, x1 - x0);
      // from below the lowest ground on the line to 2.3 m above its highest point (stones on the crest + a double
      // jump + hover must not get over it)
      let lo = Infinity, hi = -Infinity;
      for (let k = 0; k <= 12; k++) { const f = k / 12, h = this.T.heightAt(xa + (xb - xa) * f, za + (zb - za) * f); lo = Math.min(lo, h); hi = Math.max(hi, h); }
      const y0 = lo - 0.3, y1 = hi + 2.3, hh = (y1 - y0) / 2;
      const q2 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      const c = this.W.createCollider(this.R.ColliderDesc.cuboid(len / 2 + 0.05, hh, 0.15).setTranslation(cx, y0 + hh, cz).setRotation(q2));
      c.userData = { kind: 'static', surface: 'rock' };
    }
  }

  // the pad is alive: neon ring + its halo on the ground, a light, a scanning beam with a hologram crate that says
  // "put weight here", sparks, and a power line that runs to the gate pillar and pulses toward it
  buildPlateFx(pos, pillar, gy) {
    const add = (o) => { this.scene.add(o); return o; };
    const C = new THREE.Color(0x0aa8ff);
    const mkMat = (tex, op) => new THREE.MeshBasicMaterial({ map: tex, color: C.clone(), transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const halo = add(new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), mkMat(glowTex('disc'), 0.8)));
    halo.rotation.x = -Math.PI / 2; halo.position.set(pos.x, pos.y + 0.012, pos.z); halo.renderOrder = 2;
    const neon = add(new THREE.Mesh(new THREE.PlaneGeometry(0.87, 0.87), mkMat(glowTex('ring'), 0.9)));
    neon.rotation.x = -Math.PI / 2; neon.position.set(pos.x, pos.y + 0.093, pos.z); neon.renderOrder = 3;
    // volumetric light shaft: soft camera-facing sheets (a narrow bright core inside a wide faint glow) with slow
    // drifting density, plus a flare where the light leaves the pad; no hard geometry edges anywhere
    const beamU = { uT: { value: 0 }, uC: { value: C.clone() }, uK: { value: 1 } };
    const shaftMat = (w, k) => new THREE.ShaderMaterial({
      uniforms: { ...beamU, uW: { value: w }, uI: { value: k } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform float uT, uK, uW, uI; uniform vec3 uC; varying vec2 vUv;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
        void main(){ float x = vUv.x - 0.5, y = vUv.y;
          float prof = exp(-x * x / uW);
          float fall = pow(1.0 - y, 1.35) * smoothstep(0.0, 0.05, y);
          float n = 0.55 * vn(vec2(x * 5.0, y * 3.0 - uT * 0.35)) + 0.45 * vn(vec2(x * 11.0 + 3.0, y * 7.0 - uT * 0.6));
          float a = prof * fall * (0.45 + 0.75 * n) * uI * uK;
          gl_FragColor = vec4(uC * a, 1.0); }` });
    const beam = new THREE.Group();   // (kept off: a visible shaft read as a prop, not as light)
    const core = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.5), shaftMat(0.012, 0.55)); core.position.y = 0.75;
    const wide = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.7), shaftMat(0.06, 0.22)); wide.position.y = 0.85;
    beam.add(wide, core); beam.position.set(pos.x, pos.y + 0.06, pos.z);
    const flare = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex('soft'), color: C.clone(), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
    flare.scale.set(0.7, 0.3, 1); flare.position.set(pos.x, pos.y + 0.11, pos.z); add(flare);
    // hologram crate: glowing edges + faint faces, and chevrons pointing down at the pad
    const holo = new THREE.Group();   // (hologram hint removed: the lit pad and its cable say enough)
    const box = new THREE.BoxGeometry(0.26, 0.26, 0.26);
    const edgeM = new THREE.LineBasicMaterial({ color: C.clone(), transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    holo.add(new THREE.LineSegments(new THREE.EdgesGeometry(box), edgeM));
    const faceM = new THREE.MeshBasicMaterial({ color: C.clone(), transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    holo.add(new THREE.Mesh(box, faceM));
    // plank lines on the faces so it reads as "a crate"
    const pl = [];
    for (const z of [-0.131, 0.131]) for (const y of [-0.043, 0.043]) pl.push(-0.13, y, z, 0.13, y, z);
    for (const x of [-0.131, 0.131]) for (const y of [-0.043, 0.043]) pl.push(x, y, -0.13, x, y, 0.13);
    const plG = new THREE.BufferGeometry(); plG.setAttribute('position', new THREE.Float32BufferAttribute(pl, 3));
    holo.add(new THREE.LineSegments(plG, edgeM));
    const chev = [];
    for (let k = 0; k < 2; k++) { const y = -0.2 - k * 0.07; chev.push(-0.06, y + 0.04, 0, 0, y, 0, 0, y, 0, 0.06, y + 0.04, 0); }
    const chG = new THREE.BufferGeometry(); chG.setAttribute('position', new THREE.Float32BufferAttribute(chev, 3));
    const chevL = new THREE.LineSegments(chG, edgeM); holo.add(chevL);
    holo.position.set(pos.x, pos.y + 0.72, pos.z);
    const light = add(new THREE.PointLight(0x0aa8ff, 3.0, 2.6, 2)); light.position.set(pos.x, pos.y + 0.28, pos.z);
    // power line to the gate pillar: a cable snaking over the ground with energy pulses running along it
    const pts = [], n = 18, from = pos.clone(), to = pillar.clone();
    const side = new THREE.Vector3(-(to.z - from.z), 0, to.x - from.x).normalize();
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = from.x + (to.x - from.x) * t + side.x * Math.sin(t * Math.PI * 2.2) * 0.18 * (1 - t) * t * 4,
        z = from.z + (to.z - from.z) * t + side.z * Math.sin(t * Math.PI * 2.2) * 0.18 * (1 - t) * t * 4;
      const yy = (i === n ? gy : this.groundY(x, z)) + 0.012;
      pts.push(new THREE.Vector3(x, yy, z));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const cable = add(new THREE.Mesh(new THREE.TubeGeometry(curve, 90, 0.011, 6), new THREE.MeshStandardMaterial({ color: 0x1b1e22, roughness: 0.6, metalness: 0.3 })));
    cable.receiveShadow = true;
    const flowU = { uT: { value: 0 }, uC: { value: C.clone() }, uK: { value: 0.5 }, uSpd: { value: 0.4 } };
    const flow = add(new THREE.Mesh(new THREE.TubeGeometry(curve, 90, 0.016, 6), new THREE.ShaderMaterial({
      uniforms: flowU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform float uT, uK, uSpd; uniform vec3 uC; varying vec2 vUv;
        void main(){ float x = vUv.x * 9.0 - uT * uSpd * 9.0; float d = fract(x);
          float a = smoothstep(0.0, 0.08, d) * smoothstep(0.45, 0.1, d);
          gl_FragColor = vec4(uC * (0.12 + a) * uK, 1.0); }` })));
    return { halo, neon, beam, beamU, flare, holo, edgeM, faceM, chevL, light, flowU, solvedT: this.save.gateOpen ? 9 : -1, sparkT: 0, moteT: 0 };
  }
  updatePlateFx(dt, time, press, solved) {
    const F = this.plateFx; if (!F) return;
    const P = this.plate.pos;
    const idle = new THREE.Color(0x0aa8ff), warn = new THREE.Color(0xff9a1a), ok = new THREE.Color(0x22ff7a);
    if (solved && F.solvedT < 0) {
      F.solvedT = 0;
      this.fx.burst(new THREE.Vector3(P.x, P.y + 0.15, P.z), 0x7dffb0, 46);
      this.fx.ring?.(new THREE.Vector3(P.x, P.y + 0.05, P.z), 0.9, 0.7);
    }
    if (F.solvedT >= 0) F.solvedT += dt;
    const sT = F.solvedT;
    const pulse = 0.5 + 0.5 * Math.sin(time * 3.2);
    const col = solved ? ok : press > 0.02 ? warn : idle;
    const flick = press > 0.02 && !solved ? 0.7 + 0.3 * Math.sin(time * 37) * Math.sin(time * 13) : 1;
    for (const m of [F.halo.material, F.neon.material, F.edgeM, F.faceM]) m.color.copy(col);
    F.beamU.uC.value.copy(col); F.flowU.uC.value.copy(col); F.light.color.copy(col);
    this.plate.ring.material.emissive.copy(col);
    this.plate.ring.material.emissiveIntensity = solved ? 3.2 : 1.6 + pulse * 1.2 + press * 2;
    F.neon.material.opacity = (solved ? 0.95 : 0.6 + pulse * 0.35) * flick;
    F.halo.material.opacity = (solved ? 0.6 : 0.32 + pulse * 0.18 + press * 0.3) * flick;
    F.neon.position.y = P.y + 0.093;
    F.light.intensity = (solved ? 4.0 : 2.2 + pulse * 1.4 + press * 2) * flick;
    // beam + hologram: shown while the pad waits for weight; on success the beam shoots up and the hologram dissolves
    const waitK = solved ? Math.max(0, 1 - sT * 1.4) : 1;
    F.beamU.uT.value = time; F.beamU.uK.value = waitK * (solved ? 1 + sT * 3 : 0.85 + pulse * 0.3) * flick;
    for (const m of F.beam.children) { m.material.uniforms.uT.value = time; m.material.uniforms.uK.value = F.beamU.uK.value; m.material.uniforms.uC.value.copy(col); }
    // the sheets always face the camera (turning about the vertical axis only)
    const cam = this.ctx.camera; F.beam.rotation.y = Math.atan2(cam.position.x - P.x, cam.position.z - P.z);
    F.beam.scale.set(1 + (solved ? sT * 0.5 : 0), 1 + (solved ? sT * 2.2 : 0), 1);
    F.beam.visible = F.holo.visible = waitK > 0.01;
    F.flare.material.color.copy(col); F.flare.material.opacity = (solved ? 0.7 : 0.3 + pulse * 0.15) * flick;
    F.flare.scale.set(0.7 + pulse * 0.08, 0.3 + pulse * 0.04, 1);
    // dust motes drifting up through the light
    F.moteT -= dt;
    if (F.moteT < 0 && waitK > 0.2) {
      F.moteT = 0.07;
      const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * 0.2;
      this.fx.spawn({ x: P.x + Math.cos(a) * r, y: P.y + 0.12 + Math.random() * 0.3, z: P.z + Math.sin(a) * r, vx: (Math.random() - 0.5) * 0.04, vy: 0.07 + Math.random() * 0.08, vz: (Math.random() - 0.5) * 0.04,
        g: 0, drag: 0.05, max: 2.5 + Math.random() * 2, s0: 0.006, s1: 0.004, c: [col.r * 0.6 + 0.4, col.g * 0.6 + 0.4, col.b * 0.6 + 0.4], a: 0.85, add: true });
    }
    F.holo.rotation.y = time * 0.9; F.holo.position.y = P.y + 0.72 + Math.sin(time * 1.8) * 0.03 + (solved ? sT * 0.5 : 0);
    F.holo.scale.setScalar(1 + (solved ? sT * 0.8 : 0) - press * 0.25);
    // the hologram flickers like a projection (scan-line dropouts)
    const holoFl = (Math.sin(time * 23) > 0.93 ? 0.35 : 1) * (0.8 + 0.2 * Math.sin(time * 61));
    F.edgeM.opacity = 0.7 * waitK * flick * holoFl; F.faceM.opacity = 0.07 * waitK * flick * holoFl;
    F.chevL.position.y = -((time * 0.12) % 0.07);
    // power line: slow idle pulses, bright fast flow to the gate once solved
    F.flowU.uT.value = time; F.flowU.uSpd.value = solved ? 1.4 : 0.35 + press; F.flowU.uK.value = solved ? 1.6 : 0.45 + press * 0.8;
    // sparks rising off the ring
    F.sparkT -= dt;
    if (F.sparkT < 0 && waitK > 0.2) {
      F.sparkT = solved ? 0.03 : 0.11;
      const a = Math.random() * 6.28, r = 0.3 + Math.random() * 0.04;
      this.fx.spawn({ x: P.x + Math.cos(a) * r, y: P.y + 0.09, z: P.z + Math.sin(a) * r, vx: 0, vy: 0.25 + Math.random() * 0.25, vz: 0, g: 0, drag: 0.2,
        max: 0.9 + Math.random() * 0.6, s0: 0.012, s1: 0.0, c: [col.r, col.g, col.b], a: 0.9, add: true });
    }
  }

  plateLoad() {
    let w = 0;
    const p = this.plate.pos;
    this.W.intersectionsWithShape({ x: p.x, y: p.y + 0.14, z: p.z }, { x: 0, y: 0, z: 0, w: 1 }, new this.R.Cylinder(0.08, 0.3), (c) => {
      const u = c.userData; if (u?.weight) w += u.weight; if (u?.kind === 'player') w += 3; return true;
    });
    return w;
  }

  // ---------------------------------------------------------------- glade: crate-stacking up to the booster module
  buildGlade() {
    const s = this.world.stumps[0];
    this.booster = null;
    if (!this.save.booster) {
      const g = new THREE.Group();
      const core = this.prop('booster', { core: new THREE.MeshStandardMaterial({ color: 0x103040, emissive: 0x47e3ff, emissiveIntensity: 2.5, metalness: 0.4, roughness: 0.3 }) });
      core.scale.setScalar(1.2);
      const ring = new THREE.Group();
      g.add(core, ring); g.position.set(s.x, s.top + 0.18, s.z);
      const l = new THREE.PointLight(0x47e3ff, 0.8, 2.5, 2); g.add(l);
      this.scene.add(g); this.booster = { mesh: g, core, ring };
    }
    this.gladeCrate = this.makeCrate(s.x + 2.1, s.z + 1.4);
  }

  // ---------------------------------------------------------------- lift + vines on the outcrop
  buildLiftAndVines() {
    // probe the outcrop rim for (a) a lift spot near the pond and (b) a steep wall for vines
    const cands = [];
    const top = this.world.outcropTop;
    for (let i = 0; i < 48; i++) {
      const a = i / 48 * Math.PI * 2;
      for (let r = 3; r < 9; r += 0.25) {
        const x = OUTCROP.x + Math.cos(a) * r, z = OUTCROP.z + Math.sin(a) * r;
        const h = this.W.castRay(new this.R.Ray({ x, y: top + 2, z }, { x: 0, y: -1, z: 0 }), top + 6, true, this.R.QueryFilterFlags.EXCLUDE_SENSORS);
        if (!h || h.collider.userData?.kind !== 'outcrop') {
          // first point outside the rock along this ray: the rim lies just inside
          const xi = OUTCROP.x + Math.cos(a) * (r - 0.6), zi = OUTCROP.z + Math.sin(a) * (r - 0.6);
          const hi = this.W.castRayAndGetNormal(new this.R.Ray({ x: xi, y: top + 2, z: zi }, { x: 0, y: -1, z: 0 }), top + 6, true, this.R.QueryFilterFlags.EXCLUDE_SENSORS);
          if (hi && hi.collider.userData?.kind === 'outcrop' && hi.normal.y > 0.8) {
            cands.push({ a, x, z, xi, zi, H: top + 2 - hi.timeOfImpact, g: this.groundY(x, z) });
          }
          break;
        }
      }
    }
    // lift: near the pond (south-west), the highest walkable rim
    const pondDir = Math.atan2(-7 - OUTCROP.z, 17.5 - OUTCROP.x);
    const ang = (c, t) => Math.abs(Math.atan2(Math.sin(c.a - t), Math.cos(c.a - t)));
    const liftC = cands.filter((c) => ang(c, pondDir - 0.5) < 0.9 && !this.T.isWater(c.x, c.z) && c.H - c.g > 2).sort((p, q) => q.H - p.H)[0] || cands.sort((p, q) => q.H - p.H)[0];
    const vineC = cands.filter((c) => ang(c, pondDir + Math.PI * 0.6) < 1.0 && c.H - c.g > 1.5 && (!liftC || Math.hypot(c.x - liftC.x, c.z - liftC.z) > 4.5)).sort((p, q) => q.H - p.H)[0];
    this.summit = liftC ? new THREE.Vector3(liftC.xi, liftC.H, liftC.zi) : new THREE.Vector3(OUTCROP.x, top, OUTCROP.z);
    if (liftC) this.buildLift(liftC);
    if (vineC) this.buildVines(vineC);
  }

  buildLift(c) {
    const out = new THREE.Vector2(c.x - c.xi, c.z - c.zi).normalize();
    const px = c.x + out.x * 0.25, pz = c.z + out.y * 0.25;
    const y0 = this.groundY(px, pz) + 0.02, y1 = c.H + 0.02;
    const g = new THREE.Group();
    const deck = this.prop('lift_deck'); deck.rotation.y = Math.atan2(out.x, out.y); g.add(deck);
    g.position.set(px, y0, pz); g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.scene.add(g);
    // tower rails (two steel columns)
    const towerH = y1 - y0 + 0.6;
    const side = new THREE.Vector2(-out.y, out.x);
    for (const s of [-1, 1]) {
      const col = this.prop('ibeam'); col.scale.set(1, towerH, 1); col.rotation.y = -Math.atan2(side.y, side.x);
      col.position.set(px + side.x * s * 0.42, y0 - 0.1, pz + side.y * s * 0.42); this.scene.add(col);
      col.position.y += towerH / 2;   // collider below uses the centre
      const cc = this.W.createCollider(this.R.ColliderDesc.cuboid(0.03, towerH / 2, 0.03).setTranslation(col.position.x, col.position.y, col.position.z)); cc.userData = { kind: 'static', surface: 'metal' };
      col.position.y -= towerH / 2;
    }
    const head = this.prop('lift_head'); head.rotation.y = Math.atan2(-side.y, side.x);
    const headY = y0 + towerH - 0.14; head.position.set(px, headY, pz); this.scene.add(head);
    // footings under the columns
    for (const s of [-1, 1]) { const ft = this.prop('gate_pillar'); ft.scale.set(0.45, 0.12, 0.45); ft.position.set(px + side.x * s * 0.42, y0 - 0.12, pz + side.y * s * 0.42); this.scene.add(ft); }
    const steel = new THREE.MeshStandardMaterial({ color: 0x3a3d40, roughness: 0.45, metalness: 0.9 });
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 1, 6), steel); cable.castShadow = true; this.scene.add(cable);
    const cwCable = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 1, 6), steel); cwCable.castShadow = true; this.scene.add(cwCable);
    const counter = this.prop('lift_counter'); counter.rotation.y = head.rotation.y; this.scene.add(counter);
    const cwX = px - side.x * 0.48, cwZ = pz - side.y * 0.48;
    // socket box at the base
    const sock = new THREE.Group();
    const lampM = new THREE.MeshStandardMaterial({ color: 0x300000, emissive: 0xff3a2a, emissiveIntensity: 2, roughness: 0.2 });
    const sbox = this.prop('socket', { lamp: lampM }); sock.add(sbox);
    sbox.rotation.y = Math.atan2(out.x, out.y);
    const lamp = { material: lampM };
    const sp = new THREE.Vector3(px + out.x * 0.62 + side.x * 0.45, 0, pz + out.y * 0.62 + side.y * 0.45);
    sock.position.set(sp.x, this.groundY(sp.x, sp.z) + 0.11, sp.z); sock.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.scene.add(sock);
    const sc = this.W.createCollider(this.R.ColliderDesc.cuboid(0.08, 0.11, 0.06).setTranslation(sock.position.x, sock.position.y, sock.position.z)); sc.userData = { kind: 'static', surface: 'metal' };
    const body = this.W.createRigidBody(this.R.RigidBodyDesc.kinematicPositionBased().setTranslation(px, y0 - 0.025, pz));
    body.userData = { platform: true };
    const col = this.W.createCollider(this.R.ColliderDesc.cuboid(0.35, 0.025, 0.35), body); col.userData = { kind: 'lift', surface: 'metal' };
    this.lift = { mesh: g, body, y0, y1, t: 0, dir: 0, powered: this.save.liftPowered, socket: sock, lamp, socketPos: sock.position.clone(), wait: 0,
      cable, cwCable, counter, headY, cw: new THREE.Vector2(cwX, cwZ) };
    if (this.lift.powered) this.powerLift(true);
    this.interactables.push({ pos: this.lift.socketPos, r: 0.45, label: () => (this.player.carry?.kind === 'cell' ? '전력 셀 끼우기' : (this.lift.powered ? '승강기 작동' : '전원 장치 (전력 셀 필요)')), act: () => this.useSocket() });
  }

  powerLift(silent) {
    const L = this.lift; L.powered = true; this.save.liftPowered = true;
    L.lamp.material.emissive.set(0x5bff6a);
    if (!L.cellMesh) {
      const cell = this.cellModel(); cell.position.y = 0.16; L.socket.add(cell); L.cellMesh = cell;
    }
    if (!silent) { this.audio.play('power'); this.ui.toast('승강기 전원 복구.'); this.player.emit('solved'); this.onCinematic?.(L.mesh.position.clone().setY(L.mesh.position.y + 0.8), 2.4); this.persist(); }
  }

  useSocket() {
    const L = this.lift;
    if (!L.powered && this.player.carry?.kind === 'cell') {
      const it = this.player.carry; this.player.carry = null;
      this.W.removeRigidBody(it.body); this.scene.remove(it.mesh); this.props.splice(this.props.indexOf(it), 1);
      this.save.cellPlaced = true;
      this.powerLift(false); return;
    }
    if (!L.powered) { this.audio.play('deny'); this.ui.toast('전력이 없어요. 어딘가에 전력 셀이 있을지도…'); this.player.emit('worried'); return; }
    L.dir = L.t < 0.5 ? 1 : -1; this.audio.play('lever');
  }

  buildVines(c) {
    const out = new THREE.Vector3(c.x - c.xi, 0, c.z - c.zi).normalize();
    const g0 = this.groundY(c.x, c.z);
    const height = c.H - g0;
    // wall hugging point: cast toward the rock at mid height
    const mid = g0 + height * 0.5;
    const hit = this.W.castRay(new this.R.Ray({ x: c.x + out.x, y: mid, z: c.z + out.z }, { x: -out.x, y: 0, z: -out.z }), 6, true, this.R.QueryFilterFlags.EXCLUDE_SENSORS);
    const d = hit ? hit.timeOfImpact - 1 : 0;
    const wx = c.x - out.x * d, wz = c.z - out.z * d;
    const zone = { center: new THREE.Vector3(wx, 0, wz), normal: out.clone(), halfWidth: 0.45, bottom: g0, top: c.H };
    this.zones.push(zone);
    // vine strands with leaves
    const leafGeo = new THREE.PlaneGeometry(0.06, 0.05);
    const vineMat = new THREE.MeshStandardMaterial({ color: 0x3a4a1c, roughness: 0.8 });
    const leafMat = new THREE.MeshStandardMaterial({ map: ivyLeafTexture(), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.6 });
    const side = new THREE.Vector3(-out.z, 0, out.x);
    const leaves = [];
    for (let k = 0; k < 9; k++) {
      const off = (k / 8 - 0.5) * 0.85;
      const pts = [];
      for (let j = 0; j <= 16; j++) {
        const y = c.H + 0.05 - (j / 16) * (height + 0.05);
        const base = new THREE.Vector3(wx + side.x * (off + Math.sin(j * 0.9 + k) * 0.04), y, wz + side.z * (off + Math.sin(j * 0.9 + k) * 0.04));
        const h2 = this.W.castRay(new this.R.Ray({ x: base.x + out.x * 0.6, y, z: base.z + out.z * 0.6 }, { x: -out.x, y: 0, z: -out.z }), 2, true, this.R.QueryFilterFlags.EXCLUDE_SENSORS);
        if (h2) base.set(base.x + out.x * (0.6 - h2.timeOfImpact + 0.03), y, base.z + out.z * (0.6 - h2.timeOfImpact + 0.03));
        pts.push(base);
        if (j % 1 === 0) leaves.push(base.clone().addScaledVector(out, 0.015));
      }
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.008, 5), vineMat);
      tube.castShadow = true; this.scene.add(tube);
    }
    const im = new THREE.InstancedMesh(leafGeo, leafMat, leaves.length * 2);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1);
    let n = 0;
    for (const p of leaves) for (let r = 0; r < 2; r++) {
      q.setFromEuler(new THREE.Euler(rnd() * 6, Math.atan2(out.x, out.z) + (rnd() - 0.5), rnd() * 6)); sc.setScalar(0.8 + rnd() * 0.8);
      m.compose(p.clone().add(new THREE.Vector3((rnd() - 0.5) * 0.05, (rnd() - 0.5) * 0.05, (rnd() - 0.5) * 0.05)), q, sc); im.setMatrixAt(n++, m);
    }
    im.castShadow = true; this.scene.add(im);
  }

  tryClimbStart(player, dir, mag, grounded) {
    if (mag < 0.3) return;
    for (const z of this.zones) {
      const rel = new THREE.Vector3(player.pos.x - z.center.x, 0, player.pos.z - z.center.z);
      const dist = rel.dot(z.normal), along = Math.abs(rel.dot(new THREE.Vector3(-z.normal.z, 0, z.normal.x)));
      if (dist < 0.45 && dist > -0.2 && along < z.halfWidth && player.pos.y >= z.bottom - 0.2 && player.pos.y < z.top - 0.3 && dir.dot(z.normal) < -0.6) {
        player.startClimb(z); return;
      }
    }
  }

  // ---------------------------------------------------------------- crates: push / grab-pull
  pushCrate(body, dir, speed) {
    const v = body.linvel();
    body.setLinvel({ x: dir.x * speed, y: Math.min(v.y, 0.5), z: dir.z * speed }, true);
  }
  tryGrab(player) {
    const f = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw));
    for (const p of this.props) {
      if (p.kind !== 'crate') continue;
      const t = p.body.translation();
      const d = new THREE.Vector3(t.x - player.pos.x, 0, t.z - player.pos.z);
      if (d.length() < p.size / 2 + 0.24 && d.normalize().dot(f) > 0.4 && Math.abs(t.y - p.size / 2 - player.pos.y) < 0.2) {
        player.grab = { prop: p, dirToBody: d, pulling: false };
        this.audio.play('grab'); return true;
      }
    }
    return false;
  }
  updateGrab(player, dt) {
    const g = player.grab, t = g.prop.body.translation();
    const d = new THREE.Vector3(t.x - player.pos.x, 0, t.z - player.pos.z);
    const dist = d.length(); d.normalize(); g.dirToBody = d;
    if (dist > g.prop.size / 2 + 0.36 || !player.grounded) { player.grab = null; return; }
    // crate follows the player's horizontal motion along the grab axis
    const v = new THREE.Vector3(player.vel.x, 0, player.vel.z);
    const along = v.dot(d);
    g.pulling = along < -0.05;
    const want = d.clone().multiplyScalar(along);
    // keep a constant gap while pulling
    const gap = dist - (g.prop.size / 2 + 0.115);
    want.addScaledVector(d, -gap * 6);
    const lv = g.prop.body.linvel();
    g.prop.body.setLinvel({ x: want.x, y: Math.min(lv.y, 0.3), z: want.z }, true);
    // the player cannot strafe while holding
    const side = new THREE.Vector3(-d.z, 0, d.x);
    const s = v.dot(side); player.vel.x -= side.x * s; player.vel.z -= side.z * s;
  }

  // ---------------------------------------------------------------- carry / throw / kick
  nearestItem(player, maxD = 0.36) {
    let best = null, bd = maxD;
    const f = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw));
    for (const p of this.props) {
      if (!p.carry || p === player.carry) continue;
      const t = p.body.translation();
      const d = new THREE.Vector3(t.x - player.pos.x, 0, t.z - player.pos.z);
      const dd = d.length();
      if (dd < bd && Math.abs(t.y - player.pos.y) < 0.35 && (dd < 0.15 || d.normalize().dot(f) > 0.2)) { bd = dd; best = p; }
    }
    return best;
  }
  pickUp(player, p) {
    if (p.kind === 'ball') { // kick instead
      const f = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw));
      p.body.applyImpulse({ x: f.x * 0.55, y: 0.25, z: f.z * 0.55 }, true);
      player.playAction('kick', 0.35); this.audio.play('kick'); player.emit('kick'); return;
    }
    player.carry = p; p.col.userData.kind = 'item-held';
    p.body.setBodyType(this.R.RigidBodyType.KinematicPositionBased, true);
    player.playAction('press', 0.25); this.audio.play('pickup');
  }
  dropCarry(player, throwIt = false) {
    const p = player.carry; if (!p) return;
    player.carry = null;
    const f = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw));
    const pos = new THREE.Vector3(player.pos.x + f.x * (throwIt ? 0.12 : 0.2), player.pos.y + (throwIt ? 0.45 : 0.12), player.pos.z + f.z * (throwIt ? 0.12 : 0.2));
    p.body.setTranslation(pos, true);
    p.body.setBodyType(this.R.RigidBodyType.Dynamic, true);
    p.col.userData.kind = 'item';
    if (throwIt) {
      p.body.setLinvel({ x: f.x * 3.4 + player.vel.x * 0.5, y: 2.6, z: f.z * 3.4 + player.vel.z * 0.5 }, true);
      p.body.setAngvel({ x: (rnd() - 0.5) * 8, y: (rnd() - 0.5) * 8, z: (rnd() - 0.5) * 8 }, true);
      player.playAction('throw', 0.4); this.audio.play('throw');
    } else { p.body.setLinvel({ x: 0, y: 0, z: 0 }, true); this.audio.play('drop'); }
  }

  // primary interact button
  interact(player) {
    if (player.grab) { player.grab = null; return; }
    if (player.carry) {
      for (const it of this.interactables) if (it.pos.distanceTo(player.pos) < it.r + 0.25) { it.act(); return; }
      this.dropCarry(player, true); return;
    }
    // interactables (companions, socket)
    let best = null, bd = 1e9;
    for (const it of this.interactables) { const d = it.pos.distanceTo(player.pos); if (d < it.r && d < bd && (!it.enabled || it.enabled())) { bd = d; best = it; } }
    if (best) { best.act(); return; }
    const item = this.nearestItem(player);
    if (item) { this.pickUp(player, item); return; }
    if (this.tryGrab(player)) return;
    // nothing: inspect pose + look around
    player.playAction('inspect', 1.1); player.emit('inspect');
  }

  prompt(player) {
    if (player.grab) return '놓기';
    if (player.carry) {
      for (const it of this.interactables) if (it.pos.distanceTo(player.pos) < it.r + 0.25) return it.label();
      return '던지기';
    }
    for (const it of this.interactables) if (it.pos.distanceTo(player.pos) < it.r && (!it.enabled || it.enabled())) return it.label();
    const item = this.nearestItem(player);
    if (item) return item.kind === 'ball' ? '공 차기' : item.kind === 'cell' ? '전력 셀 들기' : '들기';
    const f = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw));
    for (const p of this.props) if (p.kind === 'crate') {
      const t = p.body.translation(); const d = new THREE.Vector3(t.x - player.pos.x, 0, t.z - player.pos.z);
      if (d.length() < p.size / 2 + 0.24 && d.normalize().dot(f) > 0.4) return '잡고 당기기';
    }
    return null;
  }

  // ---------------------------------------------------------------- companions (original little robots)
  buildCompanions() {
    const spots = [
      { id: 'toto', name: '토토', x: -6.2 + 1.9, z: 12.2 + 0.9, line: '삐빅! 뿌리 사이에 끼어 있었어. 고마워!', kind: 0 },
      { id: 'bori', name: '보리', kind: 1, line: '여긴 어두워서 무서웠어… 반딧불이 친구들이 있어서 다행이야.', at: this.caveCenter },
      { id: 'mina', name: '미나', kind: 2, line: '와, 여기 경치 최고지? 저 멀리 사람들 집이 보여!', at: this.summit },
    ];
    for (const s of spots) {
      const pos = s.at ? s.at.clone() : new THREE.Vector3(s.x, this.groundY(s.x, s.z), s.z);
      if (s.at) pos.y = this.groundY(pos.x + 0.001, pos.z) <= pos.y + 0.5 ? pos.y : pos.y;
      const mesh = makeCompanion(s.kind, this.mats, this.ctx.assets.models);
      mesh.position.copy(pos); mesh.position.y += s.kind === 2 ? 0.25 : 0;
      this.scene.add(mesh);
      const found = this.save.companions.includes(s.id);
      const c = { ...s, mesh, pos, found, t: rnd() * 6 };
      this.companions.push(c);
      this.interactables.push({ pos, r: 0.5, label: () => (c.found ? `${s.name}와 인사하기` : `${s.name} 깨우기`), act: () => this.talk(c) });
      const col = this.W.createCollider(this.R.ColliderDesc.ball(0.08).setTranslation(pos.x, pos.y + 0.09 + (s.kind === 2 ? 0.25 : 0), pos.z)); col.userData = { kind: 'creature' };
    }
  }
  talk(c) {
    this.player.playAction('wave', 1.2);
    const first = !c.found;
    if (first) { c.found = true; this.save.companions.push(c.id); this.audio.play('friend'); this.player.emit('friend'); this.persist(); this.ui.setFriends(this.save.companions.length, this.companions.length); }
    else this.audio.play('beep');
    const T = TALK[c.id];
    if (!T || this.ui.dlg) { this.ui.bubble(c.name, c.line); return; }
    c.talkN = (c.talkN || 0) + 1;
    // later chatter follows the progress: only lines whose condition holds, newest-relevant first
    const pool = T.again.filter((e) => !e.when || e.when(this)).sort((a, b) => (b.when ? 1 : 0) - (a.when ? 1 : 0));
    const pick = first ? T.first : pool[(c.talkN - 1) % pool.length].lines;
    const lines = pick.map(([w, t]) => [w, t.replace('{n}', this.save.shards.length).replace('{t}', 30)]);
    if (first) c.joyT = 2.2;
    if (first && this.onMeet) this.onMeet(c, lines); else this.ui.dialogue(lines);
  }

  // ---------------------------------------------------------------- north edge: garden fence (next region teaser)
  buildEdge() {
    const z = -37.2, y0 = this.groundY(0.5, z);
    const fence = new THREE.Group();
    for (let i = -14; i <= 14; i++) {
      if (i === 0 || i === 1) continue; // a gap where a picket is missing
      const p = this.prop('fence_picket');
      const x = 0.5 + i * 0.14;
      p.position.set(x, this.groundY(x, z) - 0.03, z); p.rotation.set(0, (rnd() - 0.5) * 0.06, (rnd() - 0.5) * 0.05); p.scale.y = 0.94 + rnd() * 0.1; fence.add(p);
    }
    for (const yy of [0.25, 0.75]) { const r = this.prop('fence_rail'); r.position.set(0.5, y0 + yy, z + 0.027); r.scale.x = 4.1; r.rotation.z = (rnd() - 0.5) * 0.01; fence.add(r); }
    this.scene.add(fence);
    // the fence is closed except for the gap where two pickets are missing; the gap itself is held shut until Mina can fly
    for (const [x0, x1] of [[-1.5, 0.37], [0.77, 2.5]]) {
      const c = this.W.createCollider(this.R.ColliderDesc.cuboid((x1 - x0) / 2, 1.0, 0.05).setTranslation((x0 + x1) / 2, y0 + 0.5, z - 0.25)); c.userData = { kind: 'static', surface: 'wood' };
    }
    this.gapCol = this.W.createCollider(this.R.ColliderDesc.cuboid(0.2, 1.0, 0.05).setTranslation(0.57, y0 + 0.5, z - 0.25)); this.gapCol.userData = { kind: 'static', surface: 'wood' };
    this.fenceGap = new THREE.Vector3(0.57, y0, z);
    this.edgeZ = z;
  }

  // ---------------------------------------------------------------- per-frame
  update(dt, time) {
    this.time = time;
    const P = this.player;
    // sync props
    for (const p of this.props) {
      if (P.carry === p) {
        const f = new THREE.Vector3(Math.sin(P.yaw), 0, Math.cos(P.yaw));
        const hp = new THREE.Vector3(P.pos.x + f.x * 0.02, P.pos.y + 0.43 + p.r, P.pos.z + f.z * 0.02);
        p.body.setNextKinematicTranslation(hp);
        p.mesh.position.copy(hp); p.mesh.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), P.yaw);
        continue;
      }
      const t = p.body.translation(), r = p.body.rotation();
      p.mesh.position.set(t.x, t.y, t.z); p.mesh.quaternion.set(r.x, r.y, r.z, r.w);
      if (t.y < -10) { p.body.setTranslation({ x: t.x, y: this.groundY(t.x, t.z) + 0.5, z: t.z }, true); p.body.setLinvel({ x: 0, y: 0, z: 0 }, true); }
      // splash when a prop drops into the water
      const wy = this.T.waterY;
      if (p.lastY !== undefined && p.lastY > wy && t.y <= wy + 0.02 && this.T.isWater(t.x, t.z)) {
        const k = Math.min(1, Math.abs(p.body.linvel().y) / 4) * (p.kind === 'crate' ? 1 : 0.6);
        this.fx.waterSplash({ x: t.x, y: wy, z: t.z }, 0.25 + k * 0.6); this.world.sim.drop(t.x, t.z, 0.08 + k * 0.08, -0.04 - k * 0.05);
        this.audio.play('splash', { pos: p.mesh.position, vol: 0.3 + k * 0.6 });
      }
      p.lastY = t.y;
      // bounce sounds
      const v = p.body.linvel(); const vy = v.y;
      if (p.lastVy !== undefined && p.lastVy < -1.2 && vy > -0.2) this.audio.play(p.kind === 'ball' ? 'bounce' : p.kind === 'crate' ? 'thud' : 'clack', { vol: clamp(-p.lastVy / 5, 0.2, 1), pos: p.mesh.position });
      p.lastVy = vy;
    }
    // shards
    for (const s of this.shards) {
      if (s.got) continue;
      s.mesh.rotation.y = time * 1.6; s.mesh.position.y = s.base + Math.sin(time * 2.2 + s.base * 5) * 0.015;
      const tp = new THREE.Vector3(P.pos.x, P.pos.y + 0.18, P.pos.z);
      const d = s.mesh.position.distanceTo(tp);
      // light magnet: shards close by fly to the robot (further once the magnet is unlocked)
      const magR = this.unlocked('magnet') ? 1.3 : 0.55;
      if (d < magR || s.pull) { s.pull = true; s.mesh.position.lerp(tp, Math.min(1, dt * (7 + 10 / Math.max(0.1, d)))); s.mesh.rotation.y += dt * 12; }
      if (d < 0.22) this.collect(s);
    }
    // pressure plate + gate
    const load = this.plateLoad();
    const press = clamp(load / 15, 0, 1);
    this.plate.press = damp(this.plate.press, press, 10, dt);
    this.plate.top.position.y = 0.04 - this.plate.press * 0.025;
    this.plate.padBody.setNextKinematicTranslation({ x: this.plate.pos.x, y: this.plate.pos.y + 0.108 - this.plate.press * 0.025, z: this.plate.pos.z });
    this.updatePlateFx(dt, time, press, this.save.gateOpen);
    if (!this.save.gateOpen && load >= 15) { this.save.gateOpen = true; this.audio.play('gate'); this.ui.toast('철문 개방. 경첩이 3년 만에 움직였다.'); P.emit('solved'); this.onCinematic?.(this.gate.center.clone().setY(this.gate.y0 + 0.5), 2.8); this.persist(); }
    if (load > 0 && load < 15 && !this.save.gateOpen && !this.plateHintShown) { this.plateHintShown = true; this.ui.toast('압력판이 조금 내려갔다. 무게가 부족하다.'); P.emit('worried'); }
    const G = this.gate;
    const tgt = this.save.gateOpen ? 1 : press * 0.06;
    G.open = damp(G.open, tgt, this.save.gateOpen ? 1.2 : 6, dt);
    // the leaves swing open on their hinges (away from the plate side); a pressed plate makes them rattle ajar
    G.mesh.position.y = G.y0 - 0.02;
    for (const h of G.leaves) h.rotation.y = h.userData.sd * G.open * 1.75;
    G.body.setNextKinematicTranslation({ x: G.center.x, y: G.y0 + G.height / 2 + G.open * (G.height + 0.7), z: G.center.z });
    // booster pickup
    if (this.booster) {
      const b = this.booster; b.core.rotation.y = time * 0.8; b.core.rotation.z = Math.sin(time * 1.3) * 0.15; b.mesh.position.y += Math.sin(time * 2) * 0.0005;
      if (b.mesh.position.distanceTo(new THREE.Vector3(P.pos.x, P.pos.y + 0.2, P.pos.z)) < 0.3) {
        this.scene.remove(b.mesh); this.booster = null; this.save.booster = true; P.abilities.booster = true;
        this.audio.play('ability'); this.ui.ability('호버 부스터 획득!', '공중에서 점프를 한 번 더 누르면 2단 점프, 계속 누르고 있으면 호버링해요.'); this.onBooster?.();
        P.emit('ability'); this.fx.burst(b.mesh.position, 0x6ee8ff, 40); this.persist();
      }
    }
    // lift
    if (this.lift) {
      const L = this.lift;
      if (L.dir !== 0) {
        L.t = clamp(L.t + L.dir * dt / 4.5, 0, 1);
        if (L.t === 0 || L.t === 1) { L.dir = 0; this.audio.play('clunk'); }
      } else if (L.powered) {
        // auto-call: stepping on the deck sends it to the other end after a short pause
        const onDeck = P.platform === L.body;
        L.wait = onDeck ? L.wait + dt : 0;
        if (L.wait > 0.8) { L.dir = L.t < 0.5 ? 1 : -1; L.wait = -3; this.audio.play('lever'); }
      }
      const e = L.t * L.t * (3 - 2 * L.t);
      const y = L.y0 + (L.y1 - L.y0) * e;
      L.body.setNextKinematicTranslation({ x: L.mesh.position.x, y: y - 0.025, z: L.mesh.position.z });
      L.mesh.position.y = y;
      // hoist rope from the sheave to the bridle eye; the counterweight rises as the deck goes down
      {
        const top = L.headY - 0.18, eye = y + 0.64, m = L.mesh.position;
        L.cable.scale.y = Math.max(0.01, top - eye); L.cable.position.set(m.x, (top + eye) / 2, m.z);
        const cy = Math.min(top - 0.3, L.y0 + 0.35 + (L.y1 - y));
        L.counter.position.set(L.cw.x, cy, L.cw.y);
        L.cwCable.scale.y = Math.max(0.01, L.headY - cy); L.cwCable.position.set(L.cw.x, (L.headY + cy) / 2, L.cw.y);
      }
      this.audio.setLoop('lift', L.dir !== 0 ? 0.5 : 0, L.mesh.position);
    }
    // companions idle
    for (const c of this.companions) {
      c.t += dt;
      animateCompanion(c, dt, P, this.ctx.camera);
    }
    // regions
    for (const r of REGIONS) {
      if (this.save.regions.includes(r.id)) continue;
      const d = Math.hypot(P.pos.x - r.x, P.pos.z - r.z);
      if (d < r.r && (r.minY === undefined || P.pos.y > r.minY) && (r.maxY === undefined || P.pos.y < r.maxY) && P.grounded) {
        this.save.regions.push(r.id);
        this.ui.discover(r.name); this.audio.play('discover'); P.emit('discover');
        P.checkpoint = { x: P.pos.x, y: P.pos.y + 0.05, z: P.pos.z, yaw: P.yaw };
        this.persist();
      }
    }
    // north edge teaser
    if (P.pos.z < this.edgeZ + 0.9 && !this.edgeShown) { this.edgeShown = true; this.ui.toast(this.save.charged ? '울타리 틈 너머로 정원이 보인다.' : '울타리 너머 거인의 거주지. 틈은 아직 막혀 있다.'); P.emit('curious'); }
    // through the gap: the garden (next region) begins here
    if (this.save.charged && P.pos.z < this.edgeZ - 0.4 && !this.save.regions.includes('garden')) {
      this.save.regions.push('garden'); this.ui.discover('정원 입구'); this.audio.play('discover'); P.emit('discover'); this.persist();
    }
    if (P.pos.z > this.edgeZ + 3) this.edgeShown = false;
  }

  openFence(silent = false) {
    if (this.gapCol) { this.W.removeCollider(this.gapCol, true); this.gapCol = null; }
    const m = this.companions.find((c) => c.kind === 2);
    if (m) { m.flyT = undefined; const np = this.fenceGap.clone().add(new THREE.Vector3(0.75, 0, 0.9)); np.y = this.groundY(np.x, np.z); m.pos.copy(np); m.mesh.position.copy(np); m.mesh.rotation.x = 0; }   // (the interactable shares this vector)
    if (!silent) { this.ui.toast('울타리 틈 확보. 미나가 대기 중이다.'); this.audio.play('discover'); }
  }
  unlocked(id) { return this.save.unlocks.includes(id); }
  collect(s) {
    s.got = true; this.scene.remove(s.mesh);
    this.save.shards.push(s.id);
    this.fx.burst(s.mesh.position, 0x7ff0ff, 18);
    // chain pickups: each shard within 2.5 s of the last raises the chime and the combo count
    this.comboN = this.time - this.lastCollect < 2.5 ? this.comboN + 1 : 1; this.lastCollect = this.time;
    this.audio.play('collect', { pitch: 1 + Math.min(8, this.comboN - 1) * 0.07 });
    if (this.comboN >= 2) this.ui.combo(this.comboN);
    // the shard flies into the counter, which ticks when it arrives
    const v = s.mesh.position.clone().project(this.ctx.camera), n = this.save.shards.length;
    if (v.z < 1) this.ui.flyShard((v.x * 0.5 + 0.5) * innerWidth, (-v.y * 0.5 + 0.5) * innerHeight, () => this.ui.setShards(n, this.totalShards));
    else this.ui.setShards(n, this.totalShards);
    this.player.emit('collect');
    for (const m of MILESTONES) if (n === m.n && !this.unlocked(m.id)) this.unlock(m);
    if (MEMORY[n] && !this.save.memories?.includes(n)) { (this.save.memories = this.save.memories || []).push(n); setTimeout(() => this.onMemory?.(n), 1400); }
    this.persistSoon();
  }
  unlock(m, silent = false) {
    if (!this.save.unlocks.includes(m.id)) this.save.unlocks.push(m.id);
    if (m.id === 'dash') this.player.abilities.dash = true;
    if (silent) return;
    setTimeout(() => { this.ui.ability(`${m.title} 작동`, `결정 ${m.n}개 · ${m.desc}`); this.ui.flash(); this.audio.play('ability'); this.player.emit('ability'); }, 700);
  }

  // apply loaded progress
  applySave(sv) {
    Object.assign(this.save, sv);
    for (const s of this.shards) if (sv.shards?.includes(s.id)) { s.got = true; this.scene.remove(s.mesh); }
    for (const c of this.companions) c.found = sv.companions?.includes(c.id);
    if (sv.booster && this.booster) { this.scene.remove(this.booster.mesh); this.booster = null; }
    this.player.abilities.booster = !!sv.booster;
    if (sv.charged) this.openFence(true);
    this.save.unlocks = sv.unlocks || [];
    for (const m of MILESTONES) if (this.save.unlocks.includes(m.id)) this.unlock(m, true);
    if (sv.gateOpen) this.gate.open = 1;
    if (sv.liftPowered && this.lift && !this.lift.powered) this.powerLift(true);
    if (sv.cellPlaced && this.cell) { this.W.removeRigidBody(this.cell.body); this.scene.remove(this.cell.mesh); this.props.splice(this.props.indexOf(this.cell), 1); this.cell = null; }
    this.ui.setShards(this.save.shards.length, this.totalShards);
    this.ui.setFriends(this.save.companions.length, this.companions.length);
  }
  persistSoon() { clearTimeout(this._pt); this._pt = setTimeout(() => this.persist(), 800); }
  persist() { this.onSave && this.onSave(); }
}

// ---------------------------------------------------------------- companion robot designs (original)
function makeCompanion(kind, mats, models) {
  // modelled in Blender (blender/build_companions.py): materials are chosen by the model's material names
  const shell = new THREE.MeshPhysicalMaterial({ color: [0xd9a04a, 0x6f8797, 0xe4ded2][kind], roughness: 0.42, metalness: 0.05, clearcoat: 0.25, clearcoatRoughness: 0.35, vertexColors: true });
  const dark = new THREE.MeshStandardMaterial({ color: 0x24282e, roughness: 0.42, metalness: 0.85, vertexColors: true });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x17191b, roughness: 0.9, metalness: 0, vertexColors: true });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0b0f12, roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02 });
  const eyeM = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: [0xffb347, 0x9effc0, 0xff7ad9][kind], emissiveIntensity: 2.5 });
  const byMat = { shell, dark, rubber, glass, eye: eyeM };
  const g = new THREE.Group();
  const src = models['comp_' + ['toto', 'bori', 'mina'][kind]];
  g.userData.rotors = []; g.userData.eye = eyeM;
  src.scene.updateMatrixWorld(true);
  for (const node of src.scene.children) {
    const holder = new THREE.Group(); holder.position.copy(node.position); holder.quaternion.copy(node.quaternion); g.add(holder);
    node.traverse((o) => {
      if (!o.isMesh) return;
      const base = (o.material.name || '').split('.')[0];
      const m = new THREE.Mesh(o.geometry, byMat[base] || dark);
      if (o !== node) { m.position.copy(o.position); m.quaternion.copy(o.quaternion); }
      m.castShadow = true; m.receiveShadow = true; holder.add(m);
    });
    if (node.name.startsWith('mina_rotor')) g.userData.rotors.push(holder);
    if (node.name.startsWith('toto_wheel')) g.userData.wheel = holder;
  }
  if (kind === 1) { const lamp = new THREE.PointLight(0x9effc0, 0.6, 1.6, 2); lamp.position.y = 0.1; g.add(lamp); }
  return g;
}
function animateCompanion(c, dt, P, camera) {
  const m = c.mesh, t = c.t;
  const toP = new THREE.Vector3(P.pos.x - m.position.x, 0, P.pos.z - m.position.z);
  const near = toP.length() < 2.5;
  const want = near ? Math.atan2(toP.x, toP.z) : Math.sin(t * 0.3) * 1.2;
  m.rotation.y += (((want - m.rotation.y + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 4);
  if (c.kind === 2) {
    m.position.y = c.pos.y + 0.25 + Math.sin(t * 2) * 0.03; for (const r of m.userData.rotors) r.rotation.y += dt * (c.flyT !== undefined ? 70 : 40);
    // the ending: Mina lifts off and heads north over the fence
    if (c.flyT !== undefined) { c.flyT += dt; const f = c.flyT; m.position.y += Math.min(7, f * f * 0.35); m.position.z = c.pos.z - Math.max(0, f - 2.2) ** 1.5 * 0.9; m.rotation.x = -0.18 * Math.min(1, Math.max(0, f - 2)); }
  } else if (m.userData.wheel && c.found && near) m.userData.wheel.rotation.x += dt * 6;
  else if (c.found) m.position.y = c.pos.y + Math.abs(Math.sin(t * 5)) * 0.015 * (near ? 1 : 0);
  if (!c.found) m.rotation.z = Math.sin(t * 1.3) * 0.05; else m.rotation.z = 0;
  // joy on being found: hops and twirls
  if (c.joyT > 0) { c.joyT -= dt; const k = Math.min(1, c.joyT); m.position.y += Math.abs(Math.sin(c.joyT * 9)) * 0.07 * k; m.rotation.y += dt * 7 * k; }
}

// ivy-like leaf (three lobes, pale veins, darker edges) painted once into a canvas
let _ivy = null;
function ivyLeafTexture() {
  if (_ivy) return _ivy;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.translate(64, 118);
  const lobe = (ang, len, wid) => { g.save(); g.rotate(ang); g.beginPath(); g.moveTo(0, 0);
    g.bezierCurveTo(wid, -len * 0.3, wid * 0.8, -len * 0.85, 0, -len); g.bezierCurveTo(-wid * 0.8, -len * 0.85, -wid, -len * 0.3, 0, 0); g.fill(); g.restore(); };
  const grd = g.createRadialGradient(0, -50, 4, 0, -50, 70); grd.addColorStop(0, '#4f6b2a'); grd.addColorStop(0.7, '#3a5420'); grd.addColorStop(1, '#2a3d17');
  g.fillStyle = grd;
  lobe(0, 100, 40); lobe(-0.95, 70, 30); lobe(0.95, 70, 30); lobe(-1.7, 40, 18); lobe(1.7, 40, 18);
  g.strokeStyle = 'rgba(190,205,150,0.55)'; g.lineWidth = 2;
  for (const a of [0, -0.95, 0.95, -1.7, 1.7]) { g.save(); g.rotate(a); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, a === 0 ? -92 : -55); g.stroke(); g.restore(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; _ivy = t; return t;
}


// soft additive glow sprites drawn once into canvases: 'disc' = radial falloff, 'ring' = a neon ring with its halo
const _glow = {};
function glowTex(kind) {
  if (_glow[kind]) return _glow[kind];
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  if (kind === 'soft') {
    const r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.2, 'rgba(255,255,255,0.5)'); r.addColorStop(0.5, 'rgba(255,255,255,0.12)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 256, 256);
  } else if (kind === 'disc') {
    const r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    r.addColorStop(0, 'rgba(255,255,255,0.0)'); r.addColorStop(0.28, 'rgba(255,255,255,0.55)'); r.addColorStop(0.42, 'rgba(255,255,255,0.35)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 256, 256);
  } else {
    const R = 128 * 0.62;
    for (const [w, a] of [[26, 0.12], [14, 0.25], [6, 0.6], [2.2, 1.0]]) { g.strokeStyle = `rgba(255,255,255,${a})`; g.lineWidth = w; g.beginPath(); g.arc(128, 128, R, 0, Math.PI * 2); g.stroke(); }
    // six tick marks, like the robots' light details
    g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,0.85)';
    for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + Math.PI / 6; g.beginPath(); g.moveTo(128 + Math.cos(a) * (R + 9), 128 + Math.sin(a) * (R + 9)); g.lineTo(128 + Math.cos(a) * (R + 18), 128 + Math.sin(a) * (R + 18)); g.stroke(); }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; _glow[kind] = t; return t;
}
