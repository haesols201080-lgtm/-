// Satisfactory-style construction: a hologram follows the aim point, snaps to
// foundations / deposits / water, turns blue when valid and red with a reason
// when not. Wheel rotates 15°, R rotates 90°, PgUp/PgDn (or Q/E... ) nudges
// height of foundations, F toggles dismantle, G opens the terrain tool.
// Placing a building flattens a pad into the terrain (with a soft skirt) so
// structures sit on the ground instead of floating or sinking.
import * as THREE from 'three';
import { onStilts, CLEAR } from './supports.js';
import { getModel } from './models.js';
import { makeHologramMaterial } from './materials.js';
import { BUILDINGS, STAGES } from '../sim/data.js';
import { U } from '../core/shared.js';

const REACH = 55;

export class BuildMode {
  constructor(game) {
    this.game = game;
    this.mode = 'none';          // none | place | dismantle | terrain
    this.type = null;
    this.rot = 0;
    this.heightOff = 0;
    this.ghost = null;
    this.holoMat = makeHologramMaterial();
    this.dismantleMat = makeHologramMaterial();
    this.dismantleMat.uniforms.uColor.value.setRGB(1.0, 0.25, 0.15);
    this.valid = false;
    this.reason = '';
    this.target = null;
    this.dismantleHold = 0;
    this.brush = { radius: 4, mode: 1 };
    this.tmp = new THREE.Vector3();
    // terrain brush ring
    const ringG = new THREE.BufferGeometry();
    ringG.setAttribute('position', new THREE.BufferAttribute(new Float32Array(65 * 3), 3));
    this.ring = new THREE.Line(ringG, new THREE.LineBasicMaterial({ color: 0x66e0ff, transparent: true, opacity: 0.9, depthTest: false }));
    this.ring.visible = false;
    this.ring.renderOrder = 20;
    this.ring.frustumCulled = false;
    game.engine.scene.add(this.ring);
  }

  get active() { return this.mode !== 'none'; }

  select(type) {
    this.clearGhost();
    if (BUILDINGS[type].tool === 'road') {
      this.mode = 'road'; this.type = type; this.roadStart = null;
      this.game.ui && this.game.ui.toast('도로 — 좌클릭으로 시작점, 다시 좌클릭으로 이어서 깔기 · 우클릭 끊기 · Esc 종료', 'info', 3);
      return;
    }
    this.mode = 'place';
    this.type = type;
    this.heightOff = 0;
    const model = getModel(type === 'house' ? 'house:0' : type);
    const g = new THREE.Group();
    for (const p of model.parts) {
      const m = new THREE.Mesh(p.geo, this.holoMat);
      m.frustumCulled = false;
      m.renderOrder = 30;
      g.add(m);
    }
    this.ghost = g;
    this.game.engine.scene.add(g);
    this.game.ui && this.game.ui.toast(BUILDINGS[type].name + ' 배치 — 좌클릭 설치 · 휠 회전 · 우클릭/Esc 취소', 'info', 2.5);
  }

  clearGhost() {
    if (this.ghost) { this.game.engine.scene.remove(this.ghost); this.ghost = null; }
    this.clearHighlight();
  }

  clearHighlight() {
    if (this.hl) { this.game.engine.scene.remove(this.hl); this.hl = null; this.hlFor = null; }
  }

  exit() {
    this.clearGhost();
    if (this.game.roads) this.game.roads.showPreview(null);
    this.roadStart = null;
    this.mode = 'none';
    this.type = null;
    this.ring.visible = false;
  }

  toggleDismantle() {
    if (this.mode === 'dismantle') { this.exit(); return; }
    this.exit();
    this.mode = 'dismantle';
    this.game.ui && this.game.ui.toast('해체 모드 — 구조물을 조준하고 좌클릭을 길게 누르세요 (재료 100% 반환)', 'warn', 2.5);
  }

  toggleTerrain() {
    if (this.mode === 'terrain') { this.exit(); return; }
    this.exit();
    this.mode = 'terrain';
    this.ring.visible = true;
    this.game.ui && this.game.ui.toast('지형 도구 — 좌클릭 올리기 · 우클릭 파기 · Shift+좌클릭 평탄화 · 휠 반경', 'info', 3);
  }

  aim() {
    const cam = this.game.engine.camera;
    const o = cam.position.clone();
    const d = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    const P = this.game.player;
    const maxT = REACH + (P.view === 'third' ? P.camDistCur : 0);
    const tHit = this.game.terrain.raycast(o, d, maxT);
    const cHit = this.game.colliders.raycast(o.x, o.y, o.z, d.x, d.y, d.z, maxT, (c) => !c.rock && !c.ghost);
    let hit = null;
    if (tHit) hit = { t: tHit.t, point: tHit.point, kind: 'terrain', n: this.game.terrain.normal(tHit.point.x, tHit.point.z) };
    if (cHit && (!hit || cHit.t < hit.t)) hit = { t: cHit.t, point: o.clone().addScaledVector(d, cHit.t), kind: 'col', c: cHit.c, n: new THREE.Vector3(cHit.nx, cHit.ny, cHit.nz) };
    // water surface for floating buildings
    const L = U.uWaterLevel.value;
    if (U.uIce.value < 0.5 && d.y < 0 && o.y > L) {
      const tw = (L - o.y) / d.y;
      if (tw > 0 && tw < maxT && (!hit || tw < hit.t)) hit = { t: tw, point: o.clone().addScaledVector(d, tw), kind: 'water', n: new THREE.Vector3(0, 1, 0) };
    }
    return { hit, o, d };
  }

  update(dt, input) {
    if (this.mode === 'place') this.updatePlace(dt, input);
    else if (this.mode === 'road') this.updateRoad(dt, input);
    else if (this.mode === 'dismantle') this.updateDismantle(dt, input);
    else if (this.mode === 'terrain') this.updateTerrain(dt, input);
  }

  // ------------------------------------------------------------ placement
  updatePlace(dt, input) {
    const g = this.game;
    const def = BUILDINGS[this.type];
    if (input.mouse.wheel) this.rot += input.mouse.wheel * Math.PI / 12;
    if (input.hit('KeyR')) this.rot += Math.PI / 2;
    if (def.foundation) {
      if (input.hit('PageUp') || input.hit('KeyT')) this.heightOff += 1;
      if (input.hit('PageDown') || input.hit('KeyY')) this.heightOff -= 1;
    }
    if (input.click(2) || input.hit('Escape')) { this.exit(); return; }
    const { hit } = this.aim();
    const plan = hit ? this.plan(hit, def) : null;
    if (!plan) { this.ghost.visible = false; this.valid = false; this.reason = '조준 지점이 너무 멉니다'; return; }
    this.ghost.visible = true;
    this.ghost.position.set(plan.x, plan.y, plan.z);
    this.ghost.rotation.set(0, plan.rot, 0);
    const check = this.validate(plan, def);
    this.valid = check.ok;
    this.reason = check.reason;
    this.plan_ = plan;
    this.holoMat.uniforms.uColor.value.setRGB(...(this.valid ? [0.3, 0.75, 1.0] : [1.0, 0.25, 0.18]));
    if (input.click(0)) {
      if (this.valid) this.place(plan, def);
      else g.ui && g.ui.toast(this.reason, 'bad', 1.6);
    }
  }

  plan(hit, def) {
    const g = this.game;
    const T = g.terrain;
    const [w, d] = def.size;
    let x = hit.point.x, z = hit.point.z, rot = this.rot, y;
    let onFoundation = null, snapped = false, deposit = null;
    const fb = hit.kind === 'col' && hit.c.b && (hit.c.b.def.foundation || hit.c.b.def.road) ? hit.c.b : null;
    if (fb && def.foundation === fb.def.foundation && def.road === fb.def.road) {
      // snap next to the hit foundation (Satisfactory-style edge snapping)
      const [lx, lz] = g.buildings.toLocal(fb, hit.point.x, hit.point.z);
      const fw = fb.hw * 2, fd = fb.hd * 2;
      let ox = 0, oz = 0;
      if (Math.abs(lx) / fb.hw > Math.abs(lz) / fb.hd) ox = Math.sign(lx) * fw; else oz = Math.sign(lz) * fd;
      if (hit.n.y < 0.5) { ox = Math.round(hit.n.x * fb.c - hit.n.z * fb.s) * fw; oz = Math.round(hit.n.x * fb.s + hit.n.z * fb.c) * fd; }
      const [wx, wz] = g.buildings.toWorld(fb, ox, oz);
      x = wx; z = wz; rot = fb.rot; y = fb.y + this.heightOff * (def.foundation ? 1 : 0);
      snapped = true;
    } else if (fb && hit.n.y > 0.7) {
      // building on top of a foundation: snap to its 1 m grid
      const [lx, lz] = g.buildings.toLocal(fb, hit.point.x, hit.point.z);
      const qr = Math.round((rot - fb.rot) / (Math.PI / 2)) * (Math.PI / 2);
      rot = fb.rot + qr;
      const odd = (n) => (Math.round(n) % 2 !== 0 ? 0.5 : 0);
      const sw = Math.abs(Math.cos(qr)) > 0.5 ? w : d, sd = Math.abs(Math.cos(qr)) > 0.5 ? d : w;
      const sx = Math.round(lx - odd(sw)) + odd(sw), sz = Math.round(lz - odd(sd)) + odd(sd);
      [x, z] = g.buildings.toWorld(fb, sx, sz);
      y = fb.y;
      onFoundation = fb;
    } else if (def.deposit) {
      deposit = g.props.nearestDeposit(hit.point.x, hit.point.z, 9);
      if (deposit) { x = deposit.x; z = deposit.z; snapped = true; }
    } else if (def.water) {
      if (hit.kind !== 'water') return { x, y: hit.point.y, z, rot, needWater: true };
      y = U.uWaterLevel.value;
    }
    if (y === undefined) {
      if (def.foundation) {
        y = Math.round(hit.point.y * 2) / 2 + 0.5 + this.heightOff;
      } else {
        // average ground under the footprint
        const c = Math.cos(rot), s = Math.sin(rot);
        let sum = 0, n = 0, mn = Infinity, mx = -Infinity;
        for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
          const lx = i / 2 * w / 2, lz = j / 2 * d / 2;
          const h = T.height(x + lx * c + lz * s, z - lx * s + lz * c);
          sum += h; n++; mn = Math.min(mn, h); mx = Math.max(mx, h);
        }
        const st = onStilts(this.type, def);
        y = st ? mx + CLEAR : sum / n + 0.05;
        return { x, y, z, rot, mn, mx, snapped, deposit, onFoundation, stilts: st };
      }
    }
    return { x, y, z, rot, snapped, deposit, onFoundation, mn: y, mx: y };
  }

  validate(p, def) {
    const g = this.game;
    if (p.needWater) return { ok: false, reason: '얕은 물 위에만 설치할 수 있습니다' };
    const P = g.player.pos;
    if (Math.hypot(p.x - P.x, p.z - P.z) > REACH && !g.ignoreReach) return { ok: false, reason: '너무 멉니다' };
    if (!g.terrain.inWorld(p.x, p.z, 200)) return { ok: false, reason: '행성 경계 밖입니다' };
    if (def.unique && g.buildings.count(this.type) > 0) return { ok: false, reason: '하나만 지을 수 있습니다' };
    if (def.deposit && !p.deposit) return { ok: false, reason: '광맥 위에만 설치할 수 있습니다' };
    if (p.deposit && g.buildings.list.some((b) => b.data.deposit === p.deposit.id)) return { ok: false, reason: '이 광맥에는 이미 채굴기가 있습니다' };
    if (def.water) {
      const depth = U.uWaterLevel.value - g.terrain.height(p.x, p.z);
      if (depth < 0.5 || depth > 8) return { ok: false, reason: '수심 0.5~8m인 곳에만 띄울 수 있습니다' };
    } else if (!def.foundation && !p.onFoundation && (p.stilts ? p.mn : p.y - 0.25) < U.uWaterLevel.value + 0.2 && U.uIce.value < 0.5) {
      return { ok: false, reason: '물속에는 지을 수 없습니다' };
    }
    if (!def.foundation && !p.onFoundation && !def.water) {
      const diag = Math.hypot(def.size[0], def.size[1]);
      if (p.mx - p.mn > (p.stilts ? Math.max(5, diag * 0.78) : Math.max(2.2, diag * 0.42))) return { ok: false, reason: '지형이 너무 가파릅니다 (지형 도구로 평탄화하세요)' };
    }
    if (p.onFoundation) {
      // footprint must be fully supported by foundations at the same level
      const c = Math.cos(p.rot), s = Math.sin(p.rot);
      const [w, d] = def.size;
      for (const [i, j] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]]) {
        const lx = i * (w / 2 - 0.2), lz = j * (d / 2 - 0.2);
        const wx = p.x + lx * c + lz * s, wz = p.z - lx * s + lz * c;
        const top = g.colliders.groundAt(wx, wz, 0.05, p.y + 0.05);
        if (Math.abs(top - p.y) > 0.05) return { ok: false, reason: '기초 판 위가 충분하지 않습니다' };
      }
    }
    // overlap with other structures
    const me = { x: p.x, z: p.z, hw: def.size[0] / 2 - 0.05, hd: def.size[1] / 2 - 0.05, rot: p.rot };
    for (const b of g.buildings.list) {
      if (Math.hypot(b.x - p.x, b.z - p.z) > b.hw + b.hd + me.hw + me.hd) continue;
      if (p.onFoundation && b.def.foundation) continue;
      if (b.def.foundation && def.foundation && Math.abs(b.y - p.y) > 1.05) continue;
      if (!def.foundation && b.def.foundation && p.y >= b.y - 0.01) continue;
      if (obbOverlap(me, b)) return { ok: false, reason: '다른 구조물과 겹칩니다' };
    }
    // player must not be trapped inside a closed structure
    if (!def.foundation && !def.road && !def.walkable) {
      const lx = (P.x - p.x) * Math.cos(p.rot) - (P.z - p.z) * Math.sin(p.rot);
      const lz = (P.x - p.x) * Math.sin(p.rot) + (P.z - p.z) * Math.cos(p.rot);
      if (Math.abs(lx) < def.size[0] / 2 + 0.4 && Math.abs(lz) < def.size[1] / 2 + 0.4 && Math.abs(P.y - p.y) < 4) return { ok: false, reason: '설치 위치에서 비켜 주세요' };
    }
    const lock = g.isUnlocked ? g.isUnlocked(this.type) : { ok: true };
    if (!lock.ok) return { ok: false, reason: lock.reason };
    const cost = g.eco.costOf(this.type);
    if (!g.eco.canAfford(cost, p)) return { ok: false, reason: '자원이 부족합니다: ' + g.eco.missingText(cost, p) };
    return { ok: true, reason: '' };
  }

  place(p, def) {
    const g = this.game;
    const cost = g.eco.costOf(this.type);
    g.eco.pay(cost, p);
    if (!def.foundation && !p.onFoundation && !def.water && !p.stilts) {
      // level the ground flush with the floor (3 cm under it) and keep it level
      // a terrain cell past the edge so the slab never stands proud of the ground
      const ext = 1.6;
      g.terrain.flattenRect(p.x, p.z, def.size[0] / 2 + ext, def.size[1] / 2 + ext, p.rot, p.y - 0.03, def.size[0] > 6 ? 4 : 2.5, def.apron ? Math.max(0.4, def.apron - ext + 0.2) : 0);
    }
    const r = Math.hypot(def.size[0], def.size[1]) / 2 + 0.5;
    if (!p.onFoundation) g.props.clearArea(p.x, p.z, r);
    g.flora.invalidate();
    const data = p.deposit ? { deposit: p.deposit.id, ore: p.deposit.type } : {};
    if (p.stilts && !p.onFoundation) data.stilts = true;
    const b = g.buildings.add(this.type, p.x, p.y, p.z, p.rot, { data });
    g.onBuilt && g.onBuilt(b);
    g.fx && g.fx.build(p.x, p.y, p.z, Math.max(def.size[0], def.size[1]));
    g.audio && g.audio.play('build');
    if (def.foundation && g.player.pos.y < p.y && Math.abs(g.player.pos.x - p.x) < 4.5 && Math.abs(g.player.pos.z - p.z) < 4.5) g.player.pos.y = p.y;
    // keep placing the same type (Satisfactory keeps the hologram)
    if (def.unique) this.exit();
  }

  // scripted placement (tests / tools): same planning + validation as the hologram
  placeAt(type, x, z, rot = 0, hitKind = 'terrain') {
    const def = BUILDINGS[type];
    const T = this.game.terrain;
    this.type = type; this.rot = rot;
    let hit = { point: new THREE.Vector3(x, T.height(x, z), z), kind: 'terrain', n: T.normal(x, z) };
    if (hitKind === 'water') hit = { point: new THREE.Vector3(x, U.uWaterLevel.value, z), kind: 'water', n: new THREE.Vector3(0, 1, 0) };
    if (hitKind === 'col') {
      const c = this.game.colliders.raycast(x, 500, z, 0, -1, 0, 1000, (k) => !k.rock);
      if (c) hit = { point: new THREE.Vector3(x, 500 - c.t, z), kind: 'col', c: c.c, n: new THREE.Vector3(c.nx, c.ny, c.nz) };
    }
    const plan = this.plan(hit, def);
    const v = this.validate(plan, def);
    let b = null;
    if (v.ok) { this.place(plan, def); b = this.game.buildings.list[this.game.buildings.list.length - 1]; }
    this.type = null;
    return { ok: v.ok, reason: v.reason, b, plan };
  }

  // ------------------------------------------------------------ roads
  roadCheck(a, b) {
    const g = this.game;
    const L = Math.hypot(b.x - a.x, b.z - a.z);
    if (L < 4) return { ok: false, reason: '도로가 너무 짧습니다' };
    if (L > 160) return { ok: false, reason: '한 번에 160m까지 깔 수 있습니다' };
    if (Math.hypot(b.x - g.player.pos.x, b.z - g.player.pos.z) > 120 && !g.ignoreReach) return { ok: false, reason: '너무 멉니다' };
    let wet = 0;
    for (let t = 0; t <= 1; t += 0.1) { const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t; if (g.terrain.height(x, z) < U.uWaterLevel.value + 0.3 && U.uIce.value < 0.5) wet++; }
    if (wet) return { ok: false, reason: '물속에는 도로를 낼 수 없습니다' };
    const cost = { iron: Math.max(1, Math.ceil(L / 10)) };
    if (!g.eco.canAfford(cost, a)) return { ok: false, reason: '자원이 부족합니다: ' + g.eco.missingText(cost, a) };
    const lock = g.isUnlocked ? g.isUnlocked(this.type) : { ok: true };
    if (!lock.ok) return { ok: false, reason: lock.reason };
    return { ok: true, cost, L };
  }

  layRoad(a, b) {
    const g = this.game;
    const chk = this.roadCheck(a, b);
    if (!chk.ok) return chk;
    g.eco.pay(chk.cost, a);
    g.terrain.road([a, b]);
    const n = Math.ceil(chk.L / 4);
    for (let i = 0; i <= n; i++) g.props.clearArea(a.x + (b.x - a.x) * i / n, a.z + (b.z - a.z) * i / n, 4.2);
    g.flora.invalidate();
    g.npcs.invalidate();
    g.roads.rebuild(); g.supports.dirty = true;
    g.audio && g.audio.play('build');
    return chk;
  }

  updateRoad(dt, input) {
    const g = this.game;
    if (input.hit('Escape')) { this.exit(); return; }
    if (input.click(2)) { if (this.roadStart) { this.roadStart = null; g.roads.showPreview(null); } else this.exit(); return; }
    const { hit } = this.aim();
    if (!hit) { g.roads.showPreview(null); this.reason = '조준 지점이 너무 멉니다'; return; }
    const p = g.roads.snap(hit.point.x, hit.point.z);
    if (!this.roadStart) {
      const r = 1.5;
      g.roads.showPreview({ x: p.x - r, z: p.z }, { x: p.x + r, z: p.z }, true);
      this.reason = p.snapped ? '기존 도로에 이어 붙입니다 — 좌클릭으로 시작' : '좌클릭으로 도로 시작점을 찍으세요';
      if (input.click(0)) this.roadStart = p;
      return;
    }
    const chk = this.roadCheck(this.roadStart, p);
    g.roads.showPreview(this.roadStart, p, chk.ok);
    this.reason = chk.ok ? `도로 ${chk.L.toFixed(0)}m · 철 ${chk.cost.iron}${p.snapped ? ' · 교차로 연결' : ''}` : chk.reason;
    if (input.click(0)) {
      const r = this.layRoad(this.roadStart, p);
      if (r.ok) this.roadStart = p; else g.ui && g.ui.toast(r.reason, 'bad', 1.6);
    }
  }

  // ------------------------------------------------------------ dismantle
  updateDismantle(dt, input) {
    const g = this.game;
    if (input.click(2) || input.hit('Escape')) { this.exit(); return; }
    const { hit } = this.aim();
    const b = hit && hit.kind === 'col' ? hit.c.b : null;
    this.target = b && b.type !== 'pod' ? b : null;
    if (this.target !== this.hlFor) {
      this.clearHighlight();
      if (this.target) {
        const grp = new THREE.Group();
        for (const p of this.target.model.parts) { const m = new THREE.Mesh(p.geo, this.dismantleMat); m.frustumCulled = false; m.renderOrder = 30; grp.add(m); }
        grp.position.set(this.target.x, this.target.y, this.target.z);
        grp.rotation.y = this.target.rot;
        grp.scale.setScalar(1.01);
        g.engine.scene.add(grp);
        this.hl = grp; this.hlFor = this.target;
      }
    }
    this.reason = this.target ? '' : '해체할 구조물을 조준하세요';
    if (this.target && input.btn(0)) {
      this.dismantleHold += dt;
      if (this.dismantleHold > 0.45) {
        this.dismantleHold = 0;
        const why = this.blockers(this.target);
        if (why) { g.ui && g.ui.toast(why, 'bad', 2); return; }
        const t = this.target;
        this.clearHighlight();
        g.dismantle(t);
      }
    } else this.dismantleHold = 0;
  }

  blockers(b) {
    const g = this.game;
    if (b.def.foundation || b.def.road) {
      for (const o of g.buildings.list) {
        if (o === b || o.def.foundation) continue;
        if (Math.abs(o.y - b.y) < 0.05 && g.buildings.footprintHit(b, o.x, o.z, 0)) return '위에 다른 구조물이 있어 해체할 수 없습니다';
      }
    }
    return null;
  }

  // ------------------------------------------------------------ terrain tool (ASTRONEER-like)
  updateTerrain(dt, input) {
    const g = this.game;
    if (input.click(2) && !input.btn(2)) { /* handled below */ }
    if (input.hit('Escape')) { this.exit(); return; }
    if (input.mouse.wheel) this.brush.radius = Math.max(2, Math.min(10, this.brush.radius - input.mouse.wheel * 0.5));
    const { hit } = this.aim();
    if (!hit) { this.ring.visible = false; return; }
    this.ring.visible = true;
    const pos = this.ring.geometry.attributes.position;
    const r = this.brush.radius;
    for (let i = 0; i <= 64; i++) {
      const a = i / 64 * Math.PI * 2;
      const x = hit.point.x + Math.cos(a) * r, z = hit.point.z + Math.sin(a) * r;
      pos.setXYZ(i, x, g.terrain.height(x, z) + 0.15, z);
    }
    pos.needsUpdate = true;
    const shift = input.down('ShiftLeft') || input.down('ShiftRight');
    if (input.click(0) && shift) this.flatTarget = hit.point.y;
    this.tAcc = (this.tAcc || 0) + dt;
    if (this.tAcc < 0.15) return;
    const amt = this.tAcc;
    this.tAcc = 0;
    if (Math.hypot(hit.point.x - g.player.pos.x, hit.point.z - g.player.pos.z) > 25) return;
    if (g.buildings.isBlocked(hit.point.x, hit.point.z, r * 0.6)) return;
    if (input.btn(0) && shift) { g.terrain.brush(hit.point.x, hit.point.z, r, 0, amt * 2.5, this.flatTarget ?? hit.point.y); g.flora.invalidate(); }
    else if (input.btn(0)) { g.terrain.brush(hit.point.x, hit.point.z, r, 1, amt * 1.6, 0); g.flora.invalidate(); }
    else if (input.btn(2)) { g.terrain.brush(hit.point.x, hit.point.z, r, -1, amt * 1.6, 0); g.flora.invalidate(); }
  }
}

// 2D oriented-rectangle overlap (separating axis)
function obbOverlap(a, b) {
  const axes = [[Math.cos(a.rot), -Math.sin(a.rot)], [Math.sin(a.rot), Math.cos(a.rot)], [Math.cos(b.rot), -Math.sin(b.rot)], [Math.sin(b.rot), Math.cos(b.rot)]];
  const corners = (o) => {
    const c = Math.cos(o.rot), s = Math.sin(o.rot);
    return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, j]) => { const lx = i * o.hw, lz = j * o.hd; return [o.x + lx * c + lz * s, o.z - lx * s + lz * c]; });
  };
  const ca = corners(a), cb = corners(b);
  for (const [ax, az] of axes) {
    let amin = Infinity, amax = -Infinity, bmin = Infinity, bmax = -Infinity;
    for (const [x, z] of ca) { const p = x * ax + z * az; amin = Math.min(amin, p); amax = Math.max(amax, p); }
    for (const [x, z] of cb) { const p = x * ax + z * az; bmin = Math.min(bmin, p); bmax = Math.max(bmax, p); }
    if (amax <= bmin || bmax <= amin) return false;
  }
  return true;
}
