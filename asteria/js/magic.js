// 아스테리아 1부 — 마법: 마력, 공명봉 마법탄과 공명파, 룬 넷, 근접 공격과 무기 속성
'use strict';

const RUNE_COST = { magnes: 10, stasis: 20, cryo: 12, burst: 15 };

// ---------- 마력 ----------
function updateMana(dt) {
  if (P.casting > 0 || P.holding) { if (P.holding) { G.mana -= 3 * dt; if (G.mana <= 0) { G.mana = 0; releaseHold(); toast('마력이 다해서 놓쳤다'); } } return; }
  let rate = 5;
  const m = G.map;
  P.onLey = m.kind === 'terrain' && (m.flagAt(P.x, P.z) & FL.LEY) && P.mode === 'ground';
  if (P.onLey) rate = 30;
  G.mana = Math.min(G.maxMana, G.mana + rate * dt);
  if (P.onLey && G.mana < G.maxMana && Math.random() < 0.7) {
    const a = rand(6.28), r = rand(1.5, 3);
    FX.spawn({ x: P.x + Math.cos(a) * r, y: P.y + 0.1, z: P.z + Math.sin(a) * r, vx: -Math.cos(a) * r * 1.5, vy: rand(1.5, 2.5), vz: -Math.sin(a) * r * 1.5, life: 0.6, size: 0.14, c: 0x8ff7f0, drag: 0.2 });
    if (Math.random() < 0.05) sfx('mana');
  }
}
function spendMana(n) {
  if (G.mana < n) { toast('마력이 모자라다 · 빛나는 지맥 위에 서면 빨리 찬다'); sfx('deny'); return false; }
  G.mana -= n; return true;
}
function rodTip() {
  const o = P.obj;
  if (o && o.rod && o.rod.tip) { const v = V3(); o.rod.tip.getWorldPosition(v); return v; }
  return V3(P.x + Math.sin(P.yaw) * 0.5, P.y + 1.6, P.z + Math.cos(P.yaw) * 0.5);
}

// ---------- 조준 ----------
function aimDir() {
  // 카메라가 보는 방향 (수평). 카메라가 너무 위를 보면 플레이어가 보는 방향
  const yaw = CAM.yaw + Math.PI;
  return { x: Math.sin(yaw), z: Math.cos(yaw) };
}
function aimTarget(filter, range = 26, cone = 0.82) {
  const d = aimDir();
  let best = null, bs = 1e9;
  for (const e of G.map.ents) {
    if (!shown(e) || !filter(e)) continue;
    const dx = e.x - P.x, dz = e.z - P.z, l = Math.hypot(dx, dz);
    if (l > range || Math.abs(e.y - P.y) > 10) continue;
    const dot = l < 1.2 ? 1 : (dx * d.x + dz * d.z) / l;
    if (dot < cone) continue;
    const s = l * (2.2 - dot);
    if (s < bs) { bs = s; best = e; }
  }
  return best;
}
const isFoe = e => (e.type === 'echo' || e.boss || e.type === 'beast' || e.type === 'chain') && !e.watcher;

// ---------- 공명봉: 마법탄 / 공명파 ----------
function updateCasting(dt) {
  if (G.lock || P.mode === 'climb' || P.mode === 'swim') { P.casting = 0; return; }
  if (Input.key('cast')) {
    if (P.casting === 0) { P.casting = 0.001; P.castDisc = P.castDisc || makeCastDisc(); P.castDisc.visible = true; }
    P.casting += dt;
    const k = Math.min(1, P.casting / 0.85);
    P.castDisc.position.set(P.x, P.y + 0.06, P.z);
    P.castDisc.scale.setScalar(0.6 + k * 2.4);
    P.castDisc.rotation.z += dt * (1 + k * 5);
    P.castDisc.material.opacity = 0.35 + k * 0.5;
    if (k > 0.25 && Math.random() < 0.8) {
      const t = rodTip(), a = rand(6.28), r = 1.6;
      FX.spawn({ x: t.x + Math.cos(a) * r, y: t.y + rand(-1, 1), z: t.z + Math.sin(a) * r, vx: -Math.cos(a) * r * 3, vy: 0, vz: -Math.sin(a) * r * 3, life: 0.3, size: 0.12, c: 0x9ff4ff, drag: 0 });
    }
    if (k >= 1 && !P.chargeSnd) { P.chargeSnd = true; sfx('charge'); }
  } else if (P.casting > 0) {
    const charged = P.casting >= 0.85;
    P.casting = 0; P.chargeSnd = false;
    if (P.castDisc) P.castDisc.visible = false;
    if (charged) resonanceWave(); else castBolt();
  }
}
function makeCastDisc() { const d = runeDisc('#7ff0ff', 2, 2.2); GFX.scene.add(d); return d; }
function castBolt() {
  if (P.boltCd > 0) return;
  if (!spendMana(6)) return;
  P.boltCd = 0.28; P.castAnim = 0.3;
  const t = rodTip(), tgt = aimTarget(isFoe);
  const d = aimDir();
  let vx = d.x, vy = 0.05, vz = d.z;
  if (tgt) { const dx = tgt.x - t.x, dy = tgt.y + 1 - t.y, dz = tgt.z - t.z, l = Math.hypot(dx, dy, dz); vx = dx / l; vy = dy / l; vz = dz / l; }
  P.yaw = Math.atan2(vx, vz);
  spawn('bolt', t.x, t.z, { y: t.y, vx: vx * 30, vy: vy * 30, vz: vz * 30, tgt });
  sfx('cast');
  FX.burst(t.x, t.y, t.z, 10, 0x9ff4ff, 3, 0.3, 0.15);
}
function resonanceWave() {
  if (!spendMana(30)) return;
  P.castAnim = 0.5;
  sfx('wave'); G.shake = Math.max(G.shake, 0.35);
  spawn('wavefx', P.x, P.z, { y: P.y + 0.1 });
  G.flash = { c: 0x9ff4ff, k: 4, t: 0.4, x: P.x, y: P.y + 1.5, z: P.z };
  for (const e of G.map.ents) {
    if (!shown(e) || !e.hittable || e.watcher) continue;
    const d = Math.hypot(e.x - P.x, e.z - P.z);
    if (d > 6.5 || Math.abs(e.y - P.y) > 3) continue;
    if (e.type === 'chain') { ET.chain.onHit(e); continue; }
    damageEnt(e, 4, P.x, P.z, false, 12);
  }
  for (let i = 0; i < 60; i++) { const a = i / 60 * 6.28; FX.spawn({ x: P.x, y: P.y + 0.4, z: P.z, vx: Math.cos(a) * 14, vy: 0.5, vz: Math.sin(a) * 14, life: 0.5, size: 0.3, c: 0x9ff4ff, drag: 1.2 }); }
}
ET.bolt = {
  init(e) { e.life = 1.6; e.fly = true; },
  update(e, dt) {
    if (e.tgt && shown(e.tgt)) {
      const dx = e.tgt.x - e.x, dy = e.tgt.y + 1 - e.y, dz = e.tgt.z - e.z, l = Math.hypot(dx, dy, dz) || 1, sp = Math.hypot(e.vx, e.vy, e.vz);
      const k = Math.min(1, dt * 6);
      e.vx = lerp(e.vx, dx / l * sp, k); e.vy = lerp(e.vy, dy / l * sp, k); e.vz = lerp(e.vz, dz / l * sp, k);
    }
    e.x += e.vx * dt; e.y += e.vy * dt; e.z += e.vz * dt; e.life -= dt;
    for (let i = 0; i < 3; i++) FX.spawn({ x: e.x - e.vx * dt * i / 3, y: e.y - e.vy * dt * i / 3, z: e.z - e.vz * dt * i / 3, vx: rand(-0.5, 0.5), vy: rand(-0.5, 0.5), vz: rand(-0.5, 0.5), life: 0.35, size: 0.2, c: i ? 0x7ff0ff : 0xffffff });
    if (e.life <= 0 || G.map.ground(e.x, e.z) > e.y) return boltPop(e);
    for (const o of G.map.ents) {
      if (o === e || !shown(o) || !o.hittable || o.watcher) continue;
      const h = o.boss ? 2.5 : 1.2;
      if (Math.hypot(o.x - e.x, o.z - e.z) < (o.r || 0.5) + 0.4 && e.y > o.y - 0.2 && e.y < o.y + h * (o.k ? o.k.size : 1) + 0.6) {
        if (o.type === 'chain') ET.chain.onHit(o); else damageEnt(o, 2, e.x - e.vx, e.z - e.vz, false, 4);
        return boltPop(e);
      }
    }
    for (const c of collidersNear(e.x, e.z, 0.3)) if (!c.mob && insideCol(c, e.x, e.z, 0) && e.y < c.top && e.y > (c.bot ?? -99)) return boltPop(e);
  },
  model() { const g = new THREE.Group(); mesh(geo('sph', 0.22, 10, 8), GLOW('#ffffff', 3), 0, 0, 0, g); mesh(geo('sph', 0.42, 10, 8), ADD('#7ff0ff', 2, 0.6), 0, 0, 0, g); return g; },
};
function boltPop(e) { e.dead = true; FX.burst(e.x, e.y, e.z, 16, 0x9ff4ff, 4, 0.4, 0.2); G.flash = { c: 0x7ff0ff, k: 1.5, t: 0.12, x: e.x, y: e.y, z: e.z }; }
ET.wavefx = {
  init(e) { e.t = 0; e.fly = true; },
  update(e, dt) { e.t += dt; if (e.t > 0.6) e.dead = true; },
  model() { const g = new THREE.Group(); g.d = runeDisc('#7ff0ff', 2, 2.6); g.add(g.d); g.r = mesh(geo('ring', 0.9, 1, 64), ADD('#bff8ff', 2.5, 0.8), 0, 0.1, 0, g); g.r.rotation.x = -Math.PI / 2; g.s = mesh(geo('sph', 1, 24, 12), ADD('#7ff0ff', 1.2, 0.25), 0, 0, 0, g); return g; },
  sync(e, o) { const k = e.t / 0.6; o.d.scale.setScalar(1 + k * 6); o.d.material.opacity = 1 - k; o.r.scale.setScalar(0.5 + k * 13); o.r.material.opacity = (1 - k) * 0.8; o.s.scale.set(k * 7, k * 3, k * 7); o.s.material.opacity = (1 - k) * 0.3; o.d.rotation.z = k * 3; },
};

// ---------- 근접 공격 (무기 속성) ----------
function meleeAttack() {
  if (P.atkCd > 0 || P.mode !== 'ground' || P.holding) return;
  const w = G.weapons[G.wi], W = w ? WEAPONS[w.k] : null;
  P.atkT = 0.28; P.atkCd = 0.42;
  sfx('swing');
  const reach = W ? (W.reach || 2.3) : 1.8;
  const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw);
  // 휘두르는 궤적
  for (let i = 0; i < 14; i++) { const a = P.yaw + (i / 13 - 0.5) * 2.2, r = reach * 0.9; FX.spawn({ x: P.x + Math.sin(a) * r, y: P.y + 1.1 + (i / 13) * 0.3, z: P.z + Math.cos(a) * r, life: 0.18, size: 0.16, c: W && W.elem ? ELEM[W.elem].c : 0xffffff }); }
  let hit = false;
  for (const e of G.map.ents) {
    if (!shown(e) || !e.hittable || e.watcher && false) continue;
    const dx = e.x - P.x, dz = e.z - P.z, l = Math.hypot(dx, dz);
    const rr = reach + (e.boss ? e.r * 0.8 : (e.r || 0.4));
    if (l > rr || Math.abs(e.y - P.y) > 2) continue;
    if (l > 0.6 && (dx * fx + dz * fz) / l < 0.25) continue;
    if (ET[e.type].onHit) { if (ET[e.type].onHit(e)) hit = true; continue; }
    damageEnt(e, W ? W.dmg : 1, P.x, P.z, false, W && W.elem === 'wind' ? 14 : 7);
    if (W && W.elem) applyElem(e, W.elem);
    hit = true;
  }
  if (hit && w) {
    w.d--;
    if (w.d <= 0) { toast(`${W.name}의 마력이 다해서 부서졌다`); sfx('break'); FX.burst(P.x + fx, P.y + 1, P.z + fz, 20, ELEM[W.elem || 'none'].c, 4, 0.6, 0.2); G.weapons.splice(G.wi, 1); G.wi = G.weapons.length ? 0 : -1; }
  }
}
const ELEM = { none: { c: 0xffffff }, fire: { c: 0xff7a2a, n: '불꽃' }, frost: { c: 0xbfe8ff, n: '서리' }, shock: { c: 0xd8b8ff, n: '번개' }, wind: { c: 0xc8ffd8, n: '바람' } };
function applyElem(e, el) {
  if (el === 'fire') { e.burn = 3; FX.burst(e.x, e.y + 1, e.z, 12, 0xff7a2a, 3, 0.5, 0.25); }
  if (el === 'frost') { e.chill = 3; if (Math.random() < 0.25 && e.stasis && !e.boss) { e.frozen = 1.5; } FX.burst(e.x, e.y + 1, e.z, 12, 0xbfe8ff, 3, 0.5, 0.2); }
  if (el === 'shock') {
    e.stun = 0.8; sfx('zap');
    const n = G.map.ents.find(o => o !== e && o.type === 'echo' && shown(o) && Math.hypot(o.x - e.x, o.z - e.z) < 5);
    if (n) { damageEnt(n, 2, e.x, e.z, true); n.stun = 0.6; for (let i = 0; i < 10; i++) { const k = i / 9; FX.spawn({ x: lerp(e.x, n.x, k) + rand(-0.2, 0.2), y: lerp(e.y, n.y, k) + 1.2 + rand(-0.2, 0.2), z: lerp(e.z, n.z, k), life: 0.25, size: 0.2, c: 0xd8b8ff }); } }
  }
}
function damageEnt(e, dmg, fx, fz, silent, kb = 7) {
  if (e.dead) return;
  if (e.frozen > 0 && e.stasis && !e.boss) { e.stored = (e.stored || 0) + dmg; sfx('blip'); return; }
  if (e.watcher) { e.dead = true; markDone(e.id); FX.burst(e.x, e.y + 1, e.z, 30, 0xc8a0ff, 4, 0.8, 0.2); sfx('hit'); G.f.watcherHit = true; return; }
  if (e.boss && !e.awake) return;
  const mul = ET[e.type].dmgMul ? ET[e.type].dmgMul(e) : 1;
  e.hp -= dmg * mul;
  if (!silent) sfx('hit');
  FX.burst(e.x, e.y + 1, e.z, 10, 0xffffff, 4, 0.3, 0.15);
  e.hitFlash = 0.12;
  if (!e.boss) { const dx = e.x - fx, dz = e.z - fz, l = Math.hypot(dx, dz) || 1; e.kb = { x: dx / l * kb, z: dz / l * kb, t: 0.16 }; if (e.state === 'idle') e.state = 'chase'; }
  if (mul < 1 && e.boss && !silent) toast('움직임이 너무 빨라서 제대로 맞지 않는다');
  if (e.hp <= 0) killEnt(e);
}
function killEnt(e) {
  e.dead = true;
  if (e.unique) markDone(e.id);
  if (e.boss) { G.boss = null; FX.burst(e.x, e.y + 2, e.z, 80, 0xffffff, 8, 1.4, 0.35); sfx('chime'); TALK.bossDown(e); return; }
  const c = COL(e.tint ? TINT[e.tint] : '#a898ff').getHex();
  FX.burst(e.x, e.y + 1, e.z, 40, c, 4, 1.1, 0.25, { lift: 1.5 });
  if (e.type === 'echo') {
    if (Math.random() < 0.7) give('dust', 1, true);
    if (Math.random() < 0.6) addCoins(1 + (Math.random() * 5 | 0), true);
    if (Math.random() < 0.18) giveWeapon(pick(e.kind === 'big' ? ['runeSword', 'emberBlade', 'frostSpear'] : ['brass', 'stick', 'stick', 'emberBlade']), true);
    if (Math.random() < 0.3) { G.mana = Math.min(G.maxMana, G.mana + 15); }
  } else if (e.type === 'beast') give('meat', 1);
}

// ---------- 룬 ----------
function selectRune(k) { if (G.runes[k]) { if (P.holding && k !== 'magnes') releaseHold(); G.rune = k; sfx('blip'); } }
function cycleRune() {
  const ks = Object.keys(RUNES).filter(k => G.runes[k]);
  if (!ks.length) return;
  selectRune(ks[(ks.indexOf(G.rune) + 1) % ks.length]);
}
function releaseHold() {
  if (!P.holding) return;
  P.holding.held = false; P.holding = null; sfx('magnet');
  if (P.beam) P.beam.visible = false;
}
function useRune() {
  if (!G.runes[G.rune]) { toast(Object.keys(G.runes).length ? '그 룬은 아직 없다' : '아직 룬이 없다'); return; }
  if (P.mode === 'glide' || P.mode === 'climb') return;
  const k = G.rune;
  if (k === 'magnes') {
    if (P.holding) { releaseHold(); return; }
    const e = aimTarget(o => o.metal, 16, 0.75);
    if (!e) { toast('끌어당길 금속이 없다 · 카메라로 금속을 겨누자'); sfx('deny'); return; }
    if (!spendMana(RUNE_COST.magnes)) return;
    runeFlash(e, '#ff5ab0');
    if (e.onMagnes) { ET[e.type].onMagnes(e); return; }
    P.holding = e; e.held = true;
    const dx = e.x - P.x, dz = e.z - P.z, l = Math.hypot(dx, dz) || 1, L_ = clamp(l, 2.6, 6);
    P.hold = { x: dx / l * L_, z: dz / l * L_, y: 1.0, yaw: CAM.yaw };
    sfx('magnet');
  } else if (k === 'stasis') {
    if (P.runeCd > 0) { sfx('deny'); return; }
    const e = aimTarget(o => o.stasis, 20, 0.78);
    if (!e) { toast('붙들 것이 없다'); sfx('deny'); return; }
    if (e.boss) { toast('너무 커서 붙들 수 없다'); return; }
    if (!spendMana(RUNE_COST.stasis)) return;
    if (ET[e.type].onStasis(e) !== false) { runeFlash(e, '#ffd27a'); spawn('stasisfx', e.x, e.z, { y: e.y, tgt: e }); }
    P.runeCd = 1.0; sfx('freeze');
  } else if (k === 'cryo') {
    if (P.runeCd > 0) return;
    // 이미 있는 얼음 기둥을 겨누면 깬다
    const near = G.map.ents.find(o => o.type === 'icepillar' && !o.dead && Math.hypot(o.x - P.x, o.z - P.z) < 9 && aimHits(o, 0.85));
    if (near) { near.shatter = true; P.runeCd = 0.25; return; }
    const d = aimDir();
    for (let s = 1.6; s <= 10; s += 0.4) {
      const x = P.x + d.x * s, z = P.z + d.z * s;
      const w = G.map.waterAt(x, z), g = G.map.ground(x, z);
      if (g > P.y + 2.5) break;
      if (w === null || w - g < 0.5) continue;
      if (G.map.current && G.map.current(x, z)) { toast('물살이 세서 얼음이 버티지 못한다'); sfx('deny'); return; }
      if (!spendMana(RUNE_COST.cryo)) return;
      const pillars = G.map.ents.filter(o => o.type === 'icepillar' && !o.dead);
      if (pillars.length >= 3) pillars[0].shatter = true;
      spawn('icepillar', x, z, { y: w, base: g });
      P.runeCd = 0.35; sfx('ice');
      return;
    }
    toast('얼릴 물이 앞에 없다'); sfx('deny');
  } else if (k === 'burst') {
    const live = G.map.ents.find(e => e.type === 'bomb' && !e.dead);
    if (live) { explode(live); return; }
    if (P.bombCd > 0) { sfx('deny'); return; }
    if (!spendMana(RUNE_COST.burst)) return;
    const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw);
    spawn('bomb', P.x + fx * 1.4, P.z + fz * 1.4, { y: P.y + 1.2 });
    P.bombCd = 1.2; sfx('rune');
    if (!G.f.bombTip) { G.f.bombTip = true; toast('룬(Q)을 한 번 더 누르면 바로 터진다'); }
  }
}
function aimHits(o, cone) { const d = aimDir(), dx = o.x - P.x, dz = o.z - P.z, l = Math.hypot(dx, dz) || 1; return (dx * d.x + dz * d.z) / l > cone; }
function runeFlash(e, c) {
  const t = rodTip();
  for (let i = 0; i < 16; i++) { const k = i / 15; FX.spawn({ x: lerp(t.x, e.x, k), y: lerp(t.y, e.y + 1, k), z: lerp(t.z, e.z, k), life: 0.35, size: 0.18, c: COL(c).getHex() }); }
  P.castAnim = 0.3;
}
// 붙든 금속을 따라오게 (카메라를 돌리면 같이 돈다)
function updateHold(dt) {
  const e = P.holding;
  if (!e) { if (P.beam) P.beam.visible = false; return; }
  if (!shown(e) || Math.hypot(e.x - P.x, e.z - P.z) > 12) { releaseHold(); return; }
  const da = CAM.yaw - P.hold.yaw; P.hold.yaw = CAM.yaw;
  const c = Math.cos(-da), s = Math.sin(-da), hx = P.hold.x * c - P.hold.z * s, hz = P.hold.x * s + P.hold.z * c;
  P.hold.x = hx; P.hold.z = hz;
  if (Input.wheel) { const l = Math.hypot(hx, hz), L2 = clamp(l - Input.wheel * 0.6, 2, 8); P.hold.x *= L2 / l; P.hold.z *= L2 / l; }
  P.yaw = Math.atan2(P.hold.x, P.hold.z);
  if (!P.beam) { P.beam = mesh(geo('cyl', 0.05, 0.05, 1, 6, 1, true), ADD('#ff5ab0', 2.2, 0.8)); GFX.scene.add(P.beam); }
  const t = rodTip(), dx = e.x - t.x, dy = e.y + 0.7 - t.y, dz = e.z - t.z, l = Math.hypot(dx, dy, dz);
  P.beam.visible = true;
  P.beam.position.set(t.x + dx / 2, t.y + dy / 2, t.z + dz / 2);
  P.beam.scale.set(1 + Math.sin(GFX.t * 30) * 0.4, l, 1 + Math.sin(GFX.t * 30) * 0.4);
  P.beam.quaternion.setFromUnitVectors(V3(0, 1, 0), V3(dx, dy, dz).normalize());
}
ET.stasisfx = {
  init(e) { e.fly = true; },
  update(e) { const t = e.tgt; if (!t || !shown(t) || !(t.frozen > 0) || (t.frozen > 1e8 && e.age > 1.5)) { e.dead = true; return; } e.x = t.x; e.z = t.z; e.y = t.y; e.age = (e.age || 0) + 0.016; },
  model() { const g = new THREE.Group(); g.d = runeDisc('#ffd27a', 3.2, 2.2); g.d.rotation.x = 0; g.d.position.y = 1.2; g.add(g.d); g.d2 = runeDisc('#ffd27a', 3.2, 1.6); g.d2.position.y = 1.2; g.add(g.d2); return g; },
  sync(e, o, dt) { o.d.rotation.z += dt * 0.6; o.d2.rotation.z -= dt * 0.4; o.d.lookAt(GFX.camera.position); },
};
ET.icepillar = {
  init(e) { e.t = 0; e.top = e.y + 1.6; e.fly = true; },
  col: e => e.t > 0.25 ? { x: e.x, z: e.z, hw: 0.95, hd: 0.95, top: e.top * Math.min(1, e.t / 0.3) + (e.base) * (1 - Math.min(1, e.t / 0.3)), bot: e.base, stand: true, climb: true } : null,
  update(e, dt) {
    e.t += dt;
    if (e.shatter) { e.dead = true; sfx('ice'); FX.burst(e.x, e.top - 0.8, e.z, 40, 0xdff4ff, 5, 0.7, 0.22, { add: false, grav: 12 }); }
    if (e.t < 0.3 && Math.random() < 0.8) FX.spawn({ x: e.x + rand(-1, 1), y: e.y, z: e.z + rand(-1, 1), vy: rand(2, 5), life: 0.5, size: 0.18, c: 0xdff4ff, add: false, grav: 6 });
  },
  model(e) {
    const g = new THREE.Group();
    const h = e.top - e.base;
    const b = mesh(geo('box', 1.9, h, 1.9), new THREE.MeshStandardMaterial({ color: 0xcfefff, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.88, emissive: 0x3a8ac8, emissiveIntensity: 0.25, flatShading: true }), 0, h / 2, 0, g);
    for (let i = 0; i < 5; i++) { const s = mesh(geo('cone', 0.25, 0.8, 4), mat('#eaf8ff', { rough: 0.1 }), rand(-0.7, 0.7), h + 0.2, rand(-0.7, 0.7), g); s.rotation.set(rand(-0.4, 0.4), 0, rand(-0.4, 0.4)); }
    b.castShadow = true; b.receiveShadow = true;
    g.h = h;
    return g;
  },
  sync(e, o) { o.position.y = e.base; o.scale.y = Math.min(1, e.t / 0.3); },
};

// ---------- 파열 룬 폭발 ----------
function explode(b) {
  if (b.dead) return;
  b.dead = true;
  const R = 3.6;
  sfx('boom'); G.shake = 0.6;
  G.flash = { c: 0x7ff0ff, k: 6, t: 0.35, x: b.x, y: b.y + 1, z: b.z };
  spawn('boomfx', b.x, b.z, { y: b.y + 0.5 });
  FX.burst(b.x, b.y + 0.6, b.z, 70, 0x7ff0ff, 12, 0.7, 0.35); FX.burst(b.x, b.y + 0.6, b.z, 40, 0xffffff, 8, 0.5, 0.25);
  FX.burst(b.x, b.y + 0.3, b.z, 30, 0x8a8078, 6, 1.2, 0.35, { add: false, grav: 10, lift: 3 });
  for (const e of G.map.ents) {
    if (!shown(e) || e === b) continue;
    if (Math.hypot(e.x - b.x, e.z - b.z) > R + (e.r || 0.4) || Math.abs(e.y - b.y) > 3) continue;
    if (ET[e.type].onBurst) ET[e.type].onBurst(e);
    else if (e.hittable && e.hp !== undefined && e.type !== 'chain') damageEnt(e, 4, b.x, b.z, false, 14);
    if (e.type === 'crate' && P.holding !== e) { e.vy = 6; e.x += (e.x - b.x) * 0.3; e.z += (e.z - b.z) * 0.3; }
  }
  const m = G.map;
  if (m.kind === 'blocks') {
    const cs = m.cs;
    for (let cz = Math.floor((b.z - R) / cs); cz <= Math.floor((b.z + R) / cs); cz++) for (let cx = Math.floor((b.x - R) / cs); cx <= Math.floor((b.x + R) / cs); cx++) {
      if (cx < 0 || cz < 0 || cx >= m.cw || cz >= m.cd) continue;
      const i = cz * m.cw + cx;
      if (!(m.cf[i] & CF.CRACK)) continue;
      if (Math.hypot((cx + 0.5) * cs - b.x, (cz + 0.5) * cs - b.z) > R + 0.6) continue;
      const ft = m.style === 'mine' ? T.MINE : T.FLOOR;
      setCell(m, cx, cz, ft); G.done[`cell:${m.id}:${cx},${cz},${ft}`] = true;
      FX.burst((cx + 0.5) * cs, 2, (cz + 0.5) * cs, 40, 0x8a7a72, 7, 1.2, 0.4, { add: false, grav: 14 });
      sfx('break');
    }
  }
  if (Math.hypot(P.x - b.x, P.z - b.z) < R - 0.6 && Math.abs(P.y - b.y) < 2.5) hurtPlayer(2, b.x, b.z, { push: 12, lift: 6 });
}
ET.boomfx = {
  init(e) { e.t = 0; e.fly = true; },
  update(e, dt) { e.t += dt; if (e.t > 0.5) e.dead = true; },
  model() { const g = new THREE.Group(); g.s = mesh(geo('sph', 1, 24, 14), ADD('#bff8ff', 2.5, 0.6), 0, 0, 0, g); g.r = mesh(geo('ring', 0.8, 1, 48), ADD('#7ff0ff', 2.5, 0.8), 0, -0.4, 0, g); g.r.rotation.x = -Math.PI / 2; return g; },
  sync(e, o) { const k = e.t / 0.5; o.s.scale.setScalar(0.5 + k * 3.8); o.s.material.opacity = (1 - k) * 0.6; o.r.scale.setScalar(1 + k * 7); o.r.material.opacity = (1 - k) * 0.8; },
};
