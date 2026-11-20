// More to solve and to find:
//   * the sealed hollow — a ring of boulders closed by a slab; two pressure pads must be weighed down at the same
//     time (Nuri on one, a friend / crate / stone on the other) and the slab sinks into the ground
//   * the stepping stones — a switch on the pond shore raises a line of stones out of the water one after the other
//     toward an islet; they sink again after a while, so it is a run against the water
//   * survey beacons — little masts an earlier survey unit left on high places; switching one on sweeps the view,
//     clears the map around it and plays that unit's last note
import * as THREE from 'three';
import { POND, HOLLOW } from './layout.js';

const sm = (x) => x * x * (3 - 2 * x);

export const BEACON_NOTES = [
  '측량 비콘 SV-3 · "이 높이에서는 숲 전체가 보인다. 거인들의 집은 북쪽. 연구소에서 보낸 건 우리가 처음이 아니다."',
  '측량 비콘 SV-3 · "비가 오면 개울이 두 배로 불어난다. 낮은 길은 피할 것."',
  '측량 비콘 SV-3 · "다람쥐는 반짝이는 것을 모은다. 높은 곳을 확인할 것."',
  '측량 비콘 SV-3 · "배터리 잔량 4%. 이 기록을 찾는 유닛에게: 울타리 너머로 가라. 그 집에 답이 있다."',
];

export class Puzzles {
  constructor({ ctx, gameplay, world, player, ui, audio, fx, minimap }) {
    Object.assign(this, { ctx, gameplay, world, player, ui, audio, fx, minimap });
    this.scene = ctx.scene; this.R = ctx.RAPIER; this.W = ctx.physics; this.T = world.terrain;
    const S = gameplay.save; S.puzzles = S.puzzles || {}; S.beacons = S.beacons || [];
    this.buildHollow(new THREE.Vector3(HOLLOW.x, 0, HOLLOW.z));
    this.buildStones();
    this.buildBeacons();
  }
  crystal(x, y, z, id) {
    const gp = this.gameplay, geo = gp.shards[0].mesh.geometry, m = new THREE.Mesh(geo, gp.mats.shard);
    m.position.set(x, y, z); this.scene.add(m);
    gp.shards.push({ id, mesh: m, base: y, got: false }); gp.totalShards++;
    if (gp.save.shards.includes(id)) { gp.shards[gp.shards.length - 1].got = true; this.scene.remove(m); }
  }
  weightAt(p, r = 0.3) {
    let w = 0;
    this.W.intersectionsWithShape({ x: p.x, y: p.y + 0.12, z: p.z }, { x: 0, y: 0, z: 0, w: 1 }, new this.R.Cylinder(0.08, r), (c) => {
      const u = c.userData; if (u?.weight) w += u.weight; if (u?.kind === 'player') w += 3; return true; });
    return w + (this.gameplay.extraPlateWeight?.(p) || 0);
  }
  pad(p, rot) {
    const g = new THREE.Group();
    const base = this.gameplay.prop('plate_sf_base'), top = this.gameplay.prop('plate_sf_top');
    base.scale.setScalar(0.62); top.scale.setScalar(0.62); base.position.y = 0.02; top.position.y = 0.05;
    const ring = new THREE.MeshStandardMaterial({ color: 0x0a2a33, emissive: 0x0aa8ff, emissiveIntensity: 0.6, roughness: 0.3 });
    for (const o of [base, top]) o.traverse((m) => { if (m.isMesh && (m.material.name || '').startsWith('eye')) m.material = ring; });
    g.add(base, top); g.position.copy(p); g.rotation.y = rot; this.scene.add(g);
    const c = this.W.createCollider(this.R.ColliderDesc.cylinder(0.035, 0.24).setTranslation(p.x, p.y + 0.035, p.z)); c.userData = { kind: 'plate', surface: 'metal' };
    return { g, top, ring, p, press: 0 };
  }

  // ---------------------------------------------------------------- the sealed hollow
  buildHollow(c) {
    const W = this.world, L = W.rockLib(), gy = this.T.heightAt(c.x, c.z); c.y = gy;
    // a horseshoe of big rocks around a hollow 1.2 m across, open to the south
    const ring = [[0, 1.5], [1.15, 0.95], [-1.15, 0.95], [1.45, -0.2], [-1.45, -0.2]];
    ring.forEach(([dx, dz], i) => W.bedRock(L.big[i % L.big.length], c.x + dx, c.z + dz, 1.5 + (i % 2) * 0.3, { sink: 0.18, yaw: i * 1.7, tilt: 0.1 }));
    // the slab across the mouth
    const sv = L.mid[0], ss = 1.5 / sv.w;
    const slab = new THREE.Mesh(sv.geo, sv.mat); slab.scale.set(ss, ss * 1.1, ss * 0.45);
    slab.position.set(c.x, gy - 0.05, c.z - 0.75); slab.castShadow = slab.receiveShadow = true; this.scene.add(slab);
    const body = this.W.createRigidBody(this.R.RigidBodyDesc.kinematicPositionBased().setTranslation(c.x, gy + 0.5, c.z - 0.75));
    this.W.createCollider(this.R.ColliderDesc.cuboid(0.75, 0.55, 0.18), body).userData = { kind: 'static', surface: 'rock' };
    const pads = [this.pad(new THREE.Vector3(c.x - 0.95, this.gameplay.groundY(c.x - 0.95, c.z - 2.0), c.z - 2.0), 0.3), this.pad(new THREE.Vector3(c.x + 0.95, this.gameplay.groundY(c.x + 0.95, c.z - 2.0), c.z - 2.0), -0.3)];
    // inside: two crystals and the reward on a flat stone
    this.crystal(c.x - 0.3, gy + 0.15, c.z + 0.4, 'h0'); this.crystal(c.x + 0.3, gy + 0.15, c.z + 0.5, 'h1'); this.crystal(c.x, gy + 0.15, c.z + 0.1, 'h2');
    this.hollow = { c, slab, body, pads, open: this.gameplay.save.puzzles.hollow ? 1 : 0, y0: gy };
    this.gameplay.interactables.push({ pos: new THREE.Vector3(c.x, gy, c.z - 1.3), r: 0.6, enabled: () => !this.gameplay.save.puzzles.hollow,
      label: () => '돌판 조사 · 발판 두 개를 동시에 눌러야 할 것 같다', act: () => { this.ui.bubble('세븐', '발판이 두 개. 하나는 내가 누를 수 있다. 다른 하나는…'); this.player.emit('curious'); } });
  }
  // ---------------------------------------------------------------- the stepping stones
  buildStones() {
    const W = this.world, L = W.rockLib(), wy = this.T.waterY;
    // from the west shore of the pond to an islet in the middle
    const shore = new THREE.Vector3(POND.x - POND.r - 0.6, 0, POND.z + 0.3); shore.y = this.T.heightAt(shore.x, shore.z);
    const islet = new THREE.Vector3(POND.x + 0.4, 0, POND.z - 0.2);
    const isl = W.bedRock(L.big[2], islet.x, islet.z, 1.4, { sink: 0.0, yaw: 0.6, tilt: 0.05, flat: 0.55 });
    isl.m.position.y = wy - 0.25; isl.m.updateMatrixWorld(true); W.hull(L.big[2].geo, isl.m.matrixWorld, { kind: 'rock', surface: 'rock' });
    const top = new THREE.Box3().setFromObject(isl.m).max.y;
    this.crystal(islet.x, top + 0.14, islet.z, 'p0'); this.crystal(islet.x + 0.25, top + 0.14, islet.z + 0.2, 'p1');
    this.stones = [];
    const n = 5;
    for (let k = 0; k < n; k++) {
      const f = (k + 1) / (n + 1), x = shore.x + (islet.x - shore.x) * f, z = shore.z + (islet.z - shore.z) * f + Math.sin(k * 1.7) * 0.25;
      const v = L.mid[(k + 2) % L.mid.length], s = 0.5 / v.w;
      const m = new THREE.Mesh(v.geo, v.mat); m.scale.set(s, s * 0.55, s); m.rotation.y = k * 1.3; m.castShadow = m.receiveShadow = true; this.scene.add(m);
      const lowY = wy - 0.45, highY = wy + 0.02;
      const body = this.W.createRigidBody(this.R.RigidBodyDesc.kinematicPositionBased().setTranslation(x, lowY, z));
      this.W.createCollider(this.R.ColliderDesc.cylinder(0.08, 0.2), body).userData = { kind: 'static', surface: 'rock' };
      m.position.set(x, lowY - 0.08, z);
      this.stones.push({ m, body, x, z, lowY, highY, k, h: 0 });
    }
    this.switchPad = this.pad(new THREE.Vector3(shore.x - 0.5, shore.y, shore.z - 0.6), 1.2);
    this.stonesT = -1;
  }
  // ---------------------------------------------------------------- survey beacons
  buildBeacons() {
    const gp = this.gameplay, W = this.world, spots = [];
    if (gp.summit) spots.push(gp.summit.clone().add(new THREE.Vector3(0.6, 0, -0.5)));
    // spread over the map: the lookout, the glade stump, a boulder east of the path, a boulder by the north path
    const st = W.stumps[0]; if (st) spots.push(new THREE.Vector3(st.x + 0.25, st.top, st.z - 0.15));
    const rockNear = (x, z) => W.rocks.filter((r) => !r.small).sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0];
    for (const [x, z] of [[9.5, 6], [3, -27]]) { const r = rockNear(x, z); if (r) spots.push(new THREE.Vector3(r.x, r.top, r.z)); }
    this.beacons = spots.slice(0, 4).map((p, i) => {
      const y = gp.groundY(p.x + 0.0001, p.z);
      const g = new THREE.Group(); g.position.set(p.x, y, p.z);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.009, 0.42, 6), new THREE.MeshStandardMaterial({ color: 0x8a9096, metalness: 0.9, roughness: 0.4 }));
      mast.position.y = 0.21; g.add(mast);
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.065, 0.04, 10), new THREE.MeshStandardMaterial({ color: 0x2c3036, metalness: 0.8, roughness: 0.5 })); foot.position.y = 0.02; g.add(foot);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), new THREE.MeshStandardMaterial({ color: 0x220a04, emissive: 0xff6a2a, emissiveIntensity: 0.4 })); lamp.position.y = 0.43; g.add(lamp);
      g.traverse((o) => { if (o.isMesh) o.castShadow = true; }); this.scene.add(g);
      const on = gp.save.beacons.includes(i);
      if (on) lamp.material.emissive.set(0x4fe8ff);
      const b = { g, lamp, p: g.position.clone(), i, on };
      gp.interactables.push({ pos: b.p, r: 0.45, label: () => (b.on ? '측량 비콘 (기록 재생)' : '측량 비콘 켜기'), act: () => this.beacon(b) });
      return b;
    });
  }
  beacon(b) {
    const first = !b.on;
    if (first) {
      b.on = true; this.gameplay.save.beacons.push(b.i); b.lamp.material.emissive.set(0x4fe8ff); b.lamp.material.emissiveIntensity = 2.5;
      this.minimap?.reveal(b.p.x, b.p.z, 30); this.gameplay.save.explored = this.minimap?.saveFog();
      this.audio.play('discover'); this.fx.burst(b.p.clone().setY(b.p.y + 0.43), 0x4fe8ff, 30); this.gameplay.persist();
      this.onBeacon?.(b);
    }
    this.ui.relic('측량 비콘', BEACON_NOTES[b.i % BEACON_NOTES.length], first ? `비콘 ${this.gameplay.save.beacons.length} / ${this.beacons.length} · 주변 지도 확보` : '이전 탐사 유닛의 기록');
    this.player.playAction('inspect', 1.2);
  }

  // ---------------------------------------------------------------- per frame
  update(dt, time) {
    const gp = this.gameplay, S = gp.save;
    // the sealed hollow: both pads weighed down -> the slab sinks (and stays down)
    const H = this.hollow;
    let both = true;
    for (const pd of H.pads) {
      const w = this.weightAt(pd.p);
      pd.press += ((w >= 3 ? 1 : 0) - pd.press) * Math.min(1, dt * 10);
      pd.top.position.y = 0.05 - pd.press * 0.016;
      pd.ring.emissiveIntensity = 0.6 + pd.press * 2.6 + (S.puzzles.hollow ? 1.5 : 0);
      if (w < 3) both = false;
    }
    if (both && !S.puzzles.hollow) { S.puzzles.hollow = true; this.audio.play('gate'); this.ui.toast('돌판이 땅속으로 가라앉는다.'); this.player.emit('solved'); gp.onCinematic?.(H.c.clone().setY(H.y0 + 0.3), 2.4); gp.persist(); }
    H.open += ((S.puzzles.hollow ? 1 : 0) - H.open) * Math.min(1, dt * 0.8);
    const sy = H.y0 - 0.05 - H.open * 1.3;
    H.slab.position.y = sy; H.body.setNextKinematicTranslation({ x: H.c.x, y: sy + 0.55, z: H.c.z - 0.75 });
    // stepping stones: the switch starts the sequence; each stone rises in turn, then they sink one after another
    const sp = this.switchPad, w = this.weightAt(sp.p);
    sp.press += ((w >= 3 ? 1 : 0) - sp.press) * Math.min(1, dt * 10); sp.top.position.y = 0.05 - sp.press * 0.016;
    if (w >= 3 && this.stonesT < 0) { this.stonesT = 0; this.audio.play('lever'); this.audio.play('power', { vol: 0.5 }); }
    sp.ring.emissiveIntensity = this.stonesT >= 0 ? 2.5 + Math.sin(time * 10) * 0.8 : 0.6 + sp.press * 2;
    if (this.stonesT >= 0) {
      this.stonesT += dt;
      const hold = 9;                                                    // seconds up after the last stone has risen
      for (const s of this.stones) {
        const up = sm(Math.min(1, Math.max(0, (this.stonesT - s.k * 0.45) / 0.6)));
        const down = sm(Math.min(1, Math.max(0, (this.stonesT - hold - s.k * 0.35) / 0.8)));
        const h = up * (1 - down);
        if (h > 0.05 && s.h <= 0.05) { this.audio.play('splash', { pos: s.m.position, vol: 0.35 }); this.fx.waterSplash?.({ x: s.x, y: this.T.waterY, z: s.z }, 0.35); }
        s.h = h;
        const y = s.lowY + (s.highY - s.lowY) * h;
        s.m.position.y = y - 0.08 + Math.sin(time * 3 + s.k) * 0.004 * h; s.body.setNextKinematicTranslation({ x: s.x, y, z: s.z });
      }
      if (this.stonesT > hold + this.stones.length * 0.35 + 1) this.stonesT = -1;
    }
    for (const b of this.beacons) if (b.on) b.lamp.material.emissiveIntensity = 1.6 + Math.sin(time * 3 + b.i) * 0.9;
    else b.lamp.material.emissiveIntensity = Math.sin(time * 6 + b.i) > 0.85 ? 1.6 : 0.25;          // an old dying blink
  }
}
