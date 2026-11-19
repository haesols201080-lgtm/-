// Gameplay layer: light-shard collectibles, physics props (crates, stones, ball, power cell), the pressure-plate
// gate puzzle, crate-stacking to the booster upgrade, the powered lift, vine climbing, companion robots,
// region discovery, checkpoints and save data.
import * as THREE from 'three';
import { mulberry32, clamp, damp, smoothstep } from './util.js';
import { REGIONS, START, OUTCROP, STUMPS, LOGS, WORLD } from './layout.js';

const rnd = mulberry32(99);

export class Gameplay {
  constructor(ctx, world, player, ui, audio, fx) {
    Object.assign(this, { ctx, world, player, ui, audio, fx });
    this.scene = ctx.scene; this.R = ctx.RAPIER; this.W = ctx.physics; this.T = world.terrain;
    this.shards = []; this.props = []; this.companions = []; this.zones = []; this.interactables = [];
    this.save = { shards: [], companions: [], regions: [], gateOpen: false, liftPowered: false, booster: false, cellPlaced: false };
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
    const geo = new THREE.OctahedronGeometry(0.045, 0); geo.scale(0.75, 1.3, 0.75);
    const spots = [];
    const onPath = [[0.2, 21], [-0.8, 18.5], [-2, 15.5], [-2.6, 12.5], [-2.2, 9], [-1.9, 6.5], [-2.1, 1.0], [-3.6, -3.5], [-6.8, -7.8], [2.2, -2.2], [6, -3.2], [10, -4]];
    onPath.forEach(([x, z]) => spots.push([x, null, z]));
    // on top of boulders and stumps (vertical exploration)
    for (const r of this.world.rocks.slice(0, 12)) spots.push([r.x, r.top + 0.12, r.z]);
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
    const g = new THREE.Group();
    const s = size, t = s * 0.08;
    const plank = new THREE.BoxGeometry(s, s / 3 - 0.004, t);
    for (const face of [0, 1, 2, 3]) for (let k = 0; k < 3; k++) {
      const m = new THREE.Mesh(plank, this.mats.wood);
      const y = -s / 2 + s / 6 + k * s / 3;
      m.position.set(0, y, s / 2 - t / 2); m.rotation.z = (rnd() - 0.5) * 0.02;
      const holder = new THREE.Group(); holder.rotation.y = face * Math.PI / 2; holder.add(m); g.add(holder);
    }
    for (const yy of [-1, 1]) { const top = new THREE.Mesh(new THREE.BoxGeometry(s - 0.002, t, s - 0.002), this.mats.wood); top.position.y = yy * (s / 2 - t / 2); g.add(top); }
    for (const cx of [-1, 1]) for (const cz of [-1, 1]) { const post = new THREE.Mesh(new THREE.BoxGeometry(t * 1.2, s + 0.004, t * 1.2), this.mats.rust); post.position.set(cx * (s / 2 - t * 0.4), 0, cz * (s / 2 - t * 0.4)); g.add(post); }
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    const y = this.groundY(x, z) + s / 2 + 0.02;
    const body = this.W.createRigidBody(this.R.RigidBodyDesc.dynamic().setTranslation(x, y, z).setLinearDamping(2.5).setAngularDamping(4).setCcdEnabled(true));
    body.setEnabledRotations(false, true, false, true);
    const col = this.W.createCollider(this.R.ColliderDesc.cuboid(s / 2, s / 2, s / 2).setMass(18).setFriction(0.7), body);
    col.userData = { kind: 'crate', surface: 'wood', weight: 18 };
    this.scene.add(g);
    const p = { kind: 'crate', body, col, mesh: g, size: s };
    this.props.push(p);
    return p;
  }

  makeItem(kind, x, z, opts = {}) {
    let mesh, desc, mass = 1, r = 0.05;
    if (kind === 'stone') {
      const v = this.world.variants('rock_07')[0];
      const geo = v.geo.clone(); geo.translate(0, -v.size.y / 2, 0);
      mesh = new THREE.Mesh(geo, v.mat);
      const w = Math.max(v.size.x, v.size.z); r = 0.05 + rnd() * 0.02; mesh.scale.setScalar(r * 2 / w);
      desc = this.R.ColliderDesc.ball(r * 0.9); mass = 1.2;
    } else if (kind === 'ball') {
      r = 0.075; mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 16), this.mats.rubber);
      desc = this.R.ColliderDesc.ball(r).setRestitution(0.65); mass = 0.25;
    } else if (kind === 'cell') {
      r = 0.05; mesh = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.11, 20), this.mats.steel);
      const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.07, 20), this.mats.cellGlow);
      const cap1 = new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.043, 0.015, 20), this.mats.paint); cap1.position.y = 0.05;
      const cap2 = cap1.clone(); cap2.position.y = -0.05;
      glow.scale.set(1.05, 1, 1.05);
      mesh.add(body, glow, cap1, cap2);
      const pl = new THREE.PointLight(0x8cff6a, 0.4, 1, 2); mesh.add(pl);
      desc = this.R.ColliderDesc.cylinder(0.055, 0.042); mass = 1;
    } else if (kind === 'pinecone') {
      r = 0.035; mesh = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.07, 10, 4), new THREE.MeshStandardMaterial({ color: 0x5b3b22, roughness: 0.9 }));
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
    const bar = new THREE.CylinderGeometry(0.012, 0.012, height, 8);
    const nb = Math.floor(width / 0.075);
    for (let i = 0; i <= nb; i++) {
      const m = new THREE.Mesh(bar, this.mats.rust); m.position.set(-width / 2 + i * width / nb, height / 2, 0); gate.add(m);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.05, 6), this.mats.rust); tip.position.set(m.position.x, height + 0.025, 0); gate.add(tip);
    }
    for (const yy of [0.12, height * 0.55, height - 0.06]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(width + 0.04, 0.025, 0.02), this.mats.rust); rail.position.y = yy; gate.add(rail);
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
    this.gate = { mesh: gate, body, y0: gy, open: this.save.gateOpen ? 1 : 0, height, center: gateC };
    // pressure plate on the near (south-east) side
    const nrm = new THREE.Vector3(-dir.z, 0, dir.x); if (nrm.z < 0) nrm.negate();
    const pp = gateC.clone().addScaledVector(nrm, 2.2).addScaledVector(dir, 0.6);
    const py = this.groundY(pp.x, pp.z);
    const plate = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.37, 0.06, 32), this.mats.stone); base.position.y = 0.0; plate.add(base);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.04, 32), this.mats.paint); top.position.y = 0.04; plate.add(top);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.01, 8, 40), this.mats.cellGlow.clone()); ring.rotation.x = Math.PI / 2; ring.position.y = 0.05; plate.add(ring);
    plate.position.set(pp.x, py, pp.z); plate.traverse((o) => { if (o.isMesh) { o.receiveShadow = true; o.castShadow = true; } });
    this.scene.add(plate);
    const pc = this.W.createCollider(this.R.ColliderDesc.cylinder(0.03, 0.28).setTranslation(pp.x, py + 0.035, pp.z));
    pc.userData = { kind: 'plate', surface: 'metal' };
    this.plate = { mesh: plate, top, ring, pos: new THREE.Vector3(pp.x, py, pp.z), press: 0 };
    // crate placed a few metres away
    this.gateCrate = this.makeCrate(pp.x + nrm.x * 1.6 + dir.x * 1.2, pp.z + nrm.z * 1.6 + dir.z * 1.2);
    // a little sign of rust flakes... and the reward behind the gate (glade)
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
      const core = new THREE.Mesh(new THREE.TorusKnotGeometry(0.035, 0.012, 64, 8), new THREE.MeshStandardMaterial({ color: 0x103040, emissive: 0x47e3ff, emissiveIntensity: 2.5, metalness: 0.4, roughness: 0.3 }));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.006, 8, 40), this.mats.steel);
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
    const vineC = cands.filter((c) => ang(c, pondDir + Math.PI * 0.6) < 1.0 && c.H - c.g > 1.5).sort((p, q) => q.H - p.H)[0];
    this.summit = liftC ? new THREE.Vector3(liftC.xi, liftC.H, liftC.zi) : new THREE.Vector3(OUTCROP.x, top, OUTCROP.z);
    if (liftC) this.buildLift(liftC);
    if (vineC) this.buildVines(vineC);
  }

  buildLift(c) {
    const out = new THREE.Vector2(c.x - c.xi, c.z - c.zi).normalize();
    const px = c.x + out.x * 0.25, pz = c.z + out.y * 0.25;
    const y0 = this.groundY(px, pz) + 0.02, y1 = c.H + 0.02;
    const g = new THREE.Group();
    const deck = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.05, 0.7), this.mats.paint); g.add(deck);
    for (let i = -2; i <= 2; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.008, 0.03), this.mats.steel); s.position.set(0, 0.03, i * 0.13); g.add(s); }
    const rail = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.01, 6, 4), this.mats.rust); rail.rotation.x = Math.PI / 2; rail.rotation.z = Math.PI / 4; rail.scale.set(1.35, 1.35, 1); rail.position.y = 0.3; g.add(rail);
    g.position.set(px, y0, pz); g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.scene.add(g);
    // tower rails (two steel columns)
    const towerH = y1 - y0 + 0.6;
    const side = new THREE.Vector2(-out.y, out.x);
    for (const s of [-1, 1]) {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.06, towerH, 0.06), this.mats.rust);
      col.position.set(px + side.x * s * 0.42, y0 + towerH / 2 - 0.1, pz + side.y * s * 0.42); col.castShadow = true; this.scene.add(col);
      const cc = this.W.createCollider(this.R.ColliderDesc.cuboid(0.03, towerH / 2, 0.03).setTranslation(col.position.x, col.position.y, col.position.z)); cc.userData = { kind: 'static', surface: 'metal' };
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.06), this.mats.rust); beam.position.set(px, y0 + towerH - 0.1, pz); beam.rotation.y = -Math.atan2(side.y, side.x); this.scene.add(beam);
    // socket box at the base
    const sock = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.12), this.mats.paint); sock.add(box);
    const slot = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.02, 16), this.mats.steel); slot.position.y = 0.11; sock.add(slot);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.015, 12, 8), new THREE.MeshStandardMaterial({ color: 0x300000, emissive: 0xff3a2a, emissiveIntensity: 2 })); lamp.position.set(0, 0.05, 0.062); sock.add(lamp);
    const sp = new THREE.Vector3(px + out.x * 0.62 + side.x * 0.45, 0, pz + out.y * 0.62 + side.y * 0.45);
    sock.position.set(sp.x, this.groundY(sp.x, sp.z) + 0.11, sp.z); sock.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.scene.add(sock);
    const sc = this.W.createCollider(this.R.ColliderDesc.cuboid(0.08, 0.11, 0.06).setTranslation(sock.position.x, sock.position.y, sock.position.z)); sc.userData = { kind: 'static', surface: 'metal' };
    const body = this.W.createRigidBody(this.R.RigidBodyDesc.kinematicPositionBased().setTranslation(px, y0 - 0.025, pz));
    body.userData = { platform: true };
    const col = this.W.createCollider(this.R.ColliderDesc.cuboid(0.35, 0.025, 0.35), body); col.userData = { kind: 'lift', surface: 'metal' };
    this.lift = { mesh: g, body, y0, y1, t: 0, dir: 0, powered: this.save.liftPowered, socket: sock, lamp, socketPos: sock.position.clone(), wait: 0 };
    if (this.lift.powered) this.powerLift(true);
    this.interactables.push({ pos: this.lift.socketPos, r: 0.45, label: () => (this.player.carry?.kind === 'cell' ? '전력 셀 끼우기' : (this.lift.powered ? '승강기 작동' : '전원 장치 (전력 셀 필요)')), act: () => this.useSocket() });
  }

  powerLift(silent) {
    const L = this.lift; L.powered = true; this.save.liftPowered = true;
    L.lamp.material.emissive.set(0x5bff6a);
    if (!L.cellMesh) {
      const cell = new THREE.Group();
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.11, 20), this.mats.steel);
      const gl = new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.031, 0.07, 20), this.mats.cellGlow); gl.scale.set(1.05, 1, 1.05);
      cell.add(b, gl); cell.position.y = 0.15; L.socket.add(cell); L.cellMesh = cell;
    }
    if (!silent) { this.audio.play('power'); this.ui.toast('승강기에 전원이 들어왔어요!'); this.player.emit('solved'); this.persist(); }
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
    const leafMat = new THREE.MeshStandardMaterial({ map: this.ctx.assets.tex.leaves.map, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.7 });
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
      const mesh = makeCompanion(s.kind, this.mats);
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
    this.ui.bubble(c.name, c.line);
    this.player.playAction('wave', 1.2);
    if (!c.found) { c.found = true; this.save.companions.push(c.id); this.audio.play('friend'); this.player.emit('friend'); this.persist(); this.ui.setFriends(this.save.companions.length, this.companions.length); }
    else this.audio.play('beep');
  }

  // ---------------------------------------------------------------- north edge: garden fence (next region teaser)
  buildEdge() {
    const z = -37.2, y0 = this.groundY(0.5, z);
    const fence = new THREE.Group();
    for (let i = -14; i <= 14; i++) {
      if (i === 0 || i === 1) continue; // a gap where a picket is missing
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.05, 0.025), this.mats.wood);
      const x = 0.5 + i * 0.14;
      p.position.set(x, this.groundY(x, z) + 0.5, z); p.rotation.z = (rnd() - 0.5) * 0.05; p.castShadow = true; fence.add(p);
    }
    for (const yy of [0.25, 0.75]) { const r = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.06, 0.03), this.mats.wood); r.position.set(0.5, y0 + yy, z - 0.03); r.castShadow = true; fence.add(r); }
    this.scene.add(fence);
    const c = this.W.createCollider(this.R.ColliderDesc.cuboid(2.1, 1.0, 0.05).setTranslation(0.5, y0 + 0.5, z - 0.25)); c.userData = { kind: 'static', surface: 'wood' };
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
      const d = s.mesh.position.distanceTo(new THREE.Vector3(P.pos.x, P.pos.y + 0.18, P.pos.z));
      if (d < 0.22) this.collect(s);
    }
    // pressure plate + gate
    const load = this.plateLoad();
    const press = clamp(load / 15, 0, 1);
    this.plate.press = damp(this.plate.press, press, 10, dt);
    this.plate.top.position.y = 0.04 - this.plate.press * 0.025;
    this.plate.ring.material.emissiveIntensity = 0.2 + this.plate.press * 2.5;
    if (!this.save.gateOpen && load >= 15) { this.save.gateOpen = true; this.audio.play('gate'); this.ui.toast('철컥— 녹슨 문이 열렸어요!'); P.emit('solved'); this.persist(); }
    if (load > 0 && load < 15 && !this.save.gateOpen && !this.plateHintShown) { this.plateHintShown = true; this.ui.toast('발판이 살짝 눌렸지만… 더 무거운 게 필요해 보여요.'); P.emit('worried'); }
    const G = this.gate;
    const tgt = this.save.gateOpen ? 1 : press * 0.06;
    G.open = damp(G.open, tgt, this.save.gateOpen ? 1.2 : 6, dt);
    G.mesh.position.y = G.y0 - 0.05 + G.open * (G.height + 0.05);
    G.body.setNextKinematicTranslation({ x: G.center.x, y: G.y0 + G.height / 2 + G.open * (G.height + 0.7), z: G.center.z });
    // booster pickup
    if (this.booster) {
      const b = this.booster; b.core.rotation.y = time * 2; b.ring.rotation.x = time; b.mesh.position.y += Math.sin(time * 2) * 0.0005;
      if (b.mesh.position.distanceTo(new THREE.Vector3(P.pos.x, P.pos.y + 0.2, P.pos.z)) < 0.3) {
        this.scene.remove(b.mesh); this.booster = null; this.save.booster = true; P.abilities.booster = true;
        this.audio.play('ability'); this.ui.ability('호버 부스터 획득!', '공중에서 점프를 한 번 더 누르면 2단 점프, 계속 누르고 있으면 호버링해요.');
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
    if (P.pos.z < this.edgeZ + 0.9 && !this.edgeShown) { this.edgeShown = true; this.ui.toast('울타리 너머는 사람들이 사는 집과 정원이에요. (다음 지역 — 아직 제작 중)'); P.emit('curious'); }
    if (P.pos.z > this.edgeZ + 3) this.edgeShown = false;
  }

  collect(s) {
    s.got = true; this.scene.remove(s.mesh);
    this.save.shards.push(s.id);
    this.fx.burst(s.mesh.position, 0x7ff0ff, 18);
    this.audio.play('collect', { pitch: 1 + (this.save.shards.length % 5) * 0.06 });
    this.ui.setShards(this.save.shards.length, this.totalShards);
    this.player.emit('collect');
    this.persistSoon();
  }

  // apply loaded progress
  applySave(sv) {
    Object.assign(this.save, sv);
    for (const s of this.shards) if (sv.shards?.includes(s.id)) { s.got = true; this.scene.remove(s.mesh); }
    for (const c of this.companions) c.found = sv.companions?.includes(c.id);
    if (sv.booster && this.booster) { this.scene.remove(this.booster.mesh); this.booster = null; }
    this.player.abilities.booster = !!sv.booster;
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
function makeCompanion(kind, mats) {
  const g = new THREE.Group();
  const shell = new THREE.MeshPhysicalMaterial({ color: [0xe7b04a, 0x8fa7b5, 0xe8e1d5][kind], roughness: 0.4, metalness: 0.1, clearcoat: 0.3 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x23272d, roughness: 0.45, metalness: 0.9 });
  const eyeM = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: [0xffb347, 0x9effc0, 0xff7ad9][kind], emissiveIntensity: 2.5 });
  if (kind === 0) { // Toto: barrel body on a single wheel, one big camera eye
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.12, 24), shell); body.position.y = 0.11; g.add(body);
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.014, 10, 20), dark); wheel.rotation.y = Math.PI / 2; wheel.position.y = 0.04; g.add(wheel);
    const eye = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 20), dark); eye.rotation.x = Math.PI / 2; eye.position.set(0, 0.13, 0.065); g.add(eye);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.018, 20), eyeM); lens.position.set(0, 0.13, 0.076); g.add(lens);
    g.userData.eye = lens;
  } else if (kind === 1) { // Bori: boxy lantern bot with two slot eyes and a handle
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.1), shell); body.position.y = 0.1; g.add(body);
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.008, 0.005), eyeM); e.position.set(s * 0.025, 0.115, 0.052); g.add(e); }
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.005, 6, 16, Math.PI), dark); handle.position.y = 0.16; g.add(handle);
    for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.012, 0.05, 8), dark); leg.position.set(s * 0.035, 0.025, 0); g.add(leg); }
    const lamp = new THREE.PointLight(0x9effc0, 0.6, 1.6, 2); lamp.position.y = 0.1; g.add(lamp);
    g.userData.eye = eyeM;
  } else { // Mina: little hovering drone with two rotors
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.055, 24, 16), shell); body.scale.y = 0.75; g.add(body);
    const visor = new THREE.Mesh(new THREE.SphereGeometry(0.04, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2.5), dark); visor.rotation.x = Math.PI / 2; visor.position.z = 0.03; g.add(visor);
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.CircleGeometry(0.008, 12), eyeM); e.position.set(s * 0.014, 0.004, 0.066); g.add(e); }
    g.userData.rotors = [];
    for (const s of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.006, 0.012), dark); arm.position.set(s * 0.07, 0.02, 0); g.add(arm);
      const rotor = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.002, 0.01), dark); rotor.position.set(s * 0.1, 0.03, 0); g.add(rotor); g.userData.rotors.push(rotor);
    }
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
function animateCompanion(c, dt, P, camera) {
  const m = c.mesh, t = c.t;
  const toP = new THREE.Vector3(P.pos.x - m.position.x, 0, P.pos.z - m.position.z);
  const near = toP.length() < 2.5;
  const want = near ? Math.atan2(toP.x, toP.z) : Math.sin(t * 0.3) * 1.2;
  m.rotation.y += (((want - m.rotation.y + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 4);
  if (c.kind === 2) { m.position.y = c.pos.y + 0.25 + Math.sin(t * 2) * 0.03; for (const r of m.userData.rotors) r.rotation.y += dt * 40; }
  else if (c.found) m.position.y = c.pos.y + Math.abs(Math.sin(t * 5)) * 0.015 * (near ? 1 : 0);
  if (!c.found) m.rotation.z = Math.sin(t * 1.3) * 0.05; else m.rotation.z = 0;
}
