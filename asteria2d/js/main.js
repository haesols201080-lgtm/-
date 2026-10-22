// 아스테리아 1부 — 게임 상태, 플레이어, 룬, 전투, 렌더링, 저장
'use strict';

const G = {
  mode: 'title', maps: {}, map: null, t: 0, playT: 0, time: 9 * 60, f: {}, done: {}, inv: {}, weapons: [], wi: -1,
  coins: 0, runes: {}, rune: 'magnes', journal: [], letters: [], obj: '', lock: 0, shake: 0, fade: 0, fadeTo: 0,
  boss: null, rings: null, ringsMesh: true, fog: null, region: -1, night: 0, mapCool: 0, camT: null, cam: { x: 0, y: 0 },
  torch: false, crystals: 0, cp: null, resPh: 0, warmT: 0, storm: 0, stormCd: 60, rainbow: 0, lampOff: false,
};
let P = null;
const Timers = [];
function setTimeoutG(fn, s) { Timers.push({ t: s, fn }); }
function wait(s) { return new Promise(r => setTimeoutG(r, s)); }
function runScript(fn) {
  G.lock++;
  return Promise.resolve().then(fn).catch(e => console.error(e)).finally(() => { G.lock = Math.max(0, G.lock - 1); Input.endFrame(); });
}
const isDone = id => !!G.done[id];
const markDone = id => { G.done[id] = true; };

function newPlayer(x, y) {
  return {
    x, y, fx: 0, fy: 1, hp: 12, maxhp: 12, st: 100, maxst: 100, exhausted: false, state: 'walk', glide: false,
    iframes: 0, atkT: 0, atkCd: 0, kb: null, lastSafe: { x, y }, safeT: 0, holding: null, hold: { x: 0, y: 0 },
    onTower: null, moving: false, stepT: 0, fallT: 0, coldT: 0, runeCd: 0, bombCd: 0, flash: 0,
  };
}

// ---------- 타일 조회 ----------
function effTile(m, x, y) {
  if (x < 0 || y < 0 || x >= m.w || y >= m.h) return m.oob;
  const t = m.tiles[y * m.w + x];
  if (m.ice.size && m.ice.has(x + ',' + y)) return T.ICE;
  if (t === T.SALTC) {
    if (!G.f.eng_marcella) return T.SALT;
    const d = m.coastD[y * m.w + x], p = coastP();
    if (d <= 5 * p) return T.SHALLOW;
    if (d <= 12 * p) return T.MUD;
    return T.SALT;
  }
  if (t === T.FLOOD || t === T.POOL) return m.flood ? T.DEEP : T.FLOOR;
  return t;
}
const tileAt = (x, y) => effTile(G.map, x, y);
function rawTile(x, y) { const m = G.map; return (x < 0 || y < 0 || x >= m.w || y >= m.h) ? m.oob : m.tiles[y * m.w + x]; }
function setTileCur(x, y, t, persist) {
  S(G.map, x, y, t);
  if (persist) G.done['tile:' + G.map.id + ':' + x + ',' + y + ',' + t] = true;
}
function shown(e) { return !e.dead && (!e.show || e.show()); }
function platformAt(x, y) {
  for (const e of G.map.ents) if (e.type === 'leaf' && e.frozen > 0 && shown(e) && Math.abs(x - e.x) < 0.75 && Math.abs(y - e.y) < 0.7) return e;
  return null;
}
function regionAt(x, y) {
  const m = G.map;
  if (!m.world) return m.region ?? 0;
  x = clamp(Math.floor(x), 0, m.w - 1); y = clamp(Math.floor(y), 0, m.h - 1);
  return m.reg[y * m.w + x];
}

// ---------- 충돌 ----------
function canStand(x, y, fromT) {
  const t = tileAt(Math.floor(x), Math.floor(y)), d = TD[t];
  if (d.solid) return false;
  if (d.high && !P.glide) { const f = TD[fromT]; if (!(f.high || f.climb || f.ramp)) return false; }
  return true;
}
function entSolidHit(nx, ny, r, self) {
  for (const e of G.map.ents) {
    if (!e.solid || e === self || !shown(e)) continue;
    if (P.holding === e) continue;
    const d0 = dist(nx, ny, e.x, e.y);
    if (d0 < e.r + r) {
      // 이미 겹쳐 있으면 멀어지는 방향은 허용
      if (self && dist(self.x, self.y, e.x, e.y) < e.r + r && d0 > dist(self.x, self.y, e.x, e.y)) continue;
      return true;
    }
  }
  return false;
}
function playerBlocked(nx, ny) {
  const r = 0.28, fromT = tileAt(Math.floor(P.x), Math.floor(P.y));
  for (const [ox, oy] of [[-r, -r], [r, -r], [-r, r], [r, r]]) {
    const cx = nx + ox, cy = ny + oy;
    if (Math.floor(cx) === Math.floor(P.x + ox) && Math.floor(cy) === Math.floor(P.y + oy)) {
      // 같은 칸이면 높이 규칙은 무시하되 막힌 칸은 막는다
      if (TD[tileAt(Math.floor(cx), Math.floor(cy))].solid) return true;
      continue;
    }
    if (!canStand(cx, cy, fromT)) return true;
  }
  return entSolidHit(nx, ny, r, P);
}
function blockedFor(x, y, r = 0.3, self) {
  for (const [ox, oy] of [[-r, -r], [r, -r], [-r, r], [r, r], [0, 0]]) {
    const t = tileAt(Math.floor(x + ox), Math.floor(y + oy)), d = TD[t];
    if (d.solid || d.deep || d.chasm || d.climb || d.high) return true;
  }
  for (const e of G.map.ents) if (e.solid && e !== self && shown(e) && e.type !== 'npc' && dist(x, y, e.x, e.y) < e.r + r) return true;
  return false;
}
function moveEnt(e, dx, dy) {
  if (!blockedFor(e.x + dx, e.y, e.r, e)) e.x += dx;
  if (!blockedFor(e.x, e.y + dy, e.r, e)) e.y += dy;
}
function crateBlocked(x, y, self) {
  const r = 0.4;
  for (const [ox, oy] of [[-r, -r], [r, -r], [-r, r], [r, r]]) if (TD[tileAt(Math.floor(x + ox), Math.floor(y + oy))].solid) return true;
  for (const e of G.map.ents) if (e.solid && e !== self && shown(e) && e.type !== 'npc' && dist(x, y, e.x, e.y) < e.r + r) return true;
  return false;
}
function spawn(type, x, y, props = {}) {
  props.id = props.id || type + ':' + Math.random().toString(36).slice(2);
  const e = makeEnt(type, x, y, props);
  G.map.ents.push(e); return e;
}

// ---------- 지도 이동 ----------
function goMap(id, tx, ty, face) {
  return runScript(async () => {
    G.fadeTo = 1; await wait(0.28);
    enterMap(id, tx, ty);
    if (face) { P.fx = face[0]; P.fy = face[1]; }
    G.fadeTo = 0;
    await wait(0.1);
    if (TALK.enter && TALK.enter[id]) await TALK.enter[id]();
  });
}
function enterMap(id, tx, ty) {
  if (P.holding) { P.holding.held = false; P.holding = null; }
  const m = getMap(id);
  if (G.map && G.map !== m) { G.map.ice.clear(); G.map.ents = G.map.ents.filter(e => !['bomb', 'proj', 'warn', 'ring'].includes(e.type)); }
  G.map = m;
  P.x = Number.isInteger(tx) ? tx + 0.5 : tx; P.y = Number.isInteger(ty) ? ty + 0.5 : ty;
  P.lastSafe = { x: P.x, y: P.y }; P.glide = false; P.onTower = null; P.kb = null;
  G.mapCool = 0.7; G.boss = null;
  G.cp = { map: id, x: P.x, y: P.y };
  G.cam.x = P.x * TS; G.cam.y = P.y * TS;
  G.region = -1;
  Parts.length = 0;
  saveGame();
}

// ---------- 플레이어 ----------
function updatePlayer(dt) {
  const p = P;
  p.iframes -= dt; p.atkCd -= dt; p.atkT -= dt; p.runeCd -= dt; p.bombCd -= dt; p.flash -= dt;
  if (p.fallT > 0) { p.fallT -= dt; if (p.fallT <= 0) { p.x = p.lastSafe.x; p.y = p.lastSafe.y; p.glide = false; hurtPlayer(2, p.x, p.y, { noKb: true, force: true }); } return; }
  let ix = 0, iy = 0;
  const control = !G.lock && G.mode === 'play';
  if (control) {
    ix = (Input.key('right') ? 1 : 0) - (Input.key('left') ? 1 : 0) + Input.joy.x;
    iy = (Input.key('down') ? 1 : 0) - (Input.key('up') ? 1 : 0) + Input.joy.y;
  }
  let l = Math.hypot(ix, iy);
  if (l > 1) { ix /= l; iy /= l; l = 1; }
  const moving = l > 0.18;
  p.moving = moving;
  if (moving && !p.holding) { p.fx = ix / l; p.fy = iy / l; }
  else if (moving && p.holding) { /* 붙든 물건을 바라본다 */ }

  if (p.onTower) {
    if (moving && control) { towerLeave(); }
    else { p.st = Math.min(p.maxst, p.st + 30 * dt); return; }
  }

  const ct = tileAt(Math.floor(p.x), Math.floor(p.y)), cd = TD[ct];
  const plat = platformAt(p.x, p.y);
  let speed = 4.6, drain = 0;
  const wantRun = (Input.key('run') || Input.joy.run) && !p.exhausted && control;
  if (p.glide) {
    p.state = 'glide'; speed = 6.4; drain = 15;
    if (Math.random() < 0.3) Parts.push({ x: p.x + rand(-0.3, 0.3), y: p.y + 0.6, vx: -p.fx, vy: -p.fy, life: 0.4, max: 0.4, c: '#ffffff', size: 2, g: 0 });
    if (cd.climb) { p.glide = false; }
  } else if (cd.climb) {
    p.state = 'climb'; speed = 2.3; drain = moving ? 13 : 4;
  } else if (cd.deep && !plat && ct !== T.ICE) {
    if (G.map.noSwim) {
      p.x = p.lastSafe.x; p.y = p.lastSafe.y;
      if (!p.warnT || G.t > p.warnT) { toast(G.map.id === 'cathedral' ? '물살이 세서 들어갈 수 없다' : '물이 너무 깊다'); p.warnT = G.t + 2; }
      return;
    }
    p.state = 'swim'; speed = 2.5; drain = 8;
  } else {
    p.state = 'walk';
    if (wantRun && moving) { speed = 7.4; drain = 17; }
    speed *= cd.slow;
  }
  if (G.storm > 0 && regionAt(p.x, p.y) === 2) drain *= 1.7;
  if (p.holding) speed *= 0.75;
  if (drain > 0 && (moving || p.state !== 'walk')) {
    p.st -= drain * dt;
    if (p.st <= 0) {
      p.st = 0; p.exhausted = true;
      if (p.state === 'climb') { toast('힘이 빠져서 미끄러졌다'); p.x = p.lastSafe.x; p.y = p.lastSafe.y; }
      else if (p.state === 'glide') { p.glide = false; }
      else if (p.state === 'swim') { toast('더 헤엄칠 힘이 없다'); p.fallT = 0.5; burst(p.x, p.y, 10, '#9fd8ff', 2, 0.5); return; }
    }
  } else if (!p.glide && p.state === 'walk') {
    p.st = Math.min(p.maxst, p.st + (p.exhausted ? 22 : 32) * dt);
    if (p.exhausted && p.st > p.maxst * 0.35) p.exhausted = false;
  }

  // 넉백
  if (p.kb) {
    const nx = p.x + p.kb.x * dt, ny = p.y + p.kb.y * dt;
    if (!playerBlocked(nx, p.y)) p.x = nx;
    if (!playerBlocked(p.x, ny)) p.y = ny;
    p.kb.t -= dt; if (p.kb.t <= 0) p.kb = null;
  } else if (moving && control) {
    const dx = ix * speed * dt, dy = iy * speed * dt;
    if (!playerBlocked(p.x + dx, p.y)) p.x += dx;
    if (!playerBlocked(p.x, p.y + dy)) p.y += dy;
    p.stepT -= dt;
    if (p.stepT <= 0 && p.state === 'walk') { p.stepT = speed > 6 ? 0.22 : 0.32; sfx('step'); }
  }
  // 떨어짐
  const nt = tileAt(Math.floor(p.x), Math.floor(p.y));
  if (!p.glide && TD[nt].chasm && !platformAt(p.x, p.y)) {
    p.fallT = 0.6; sfx('hurt'); toast('떨어졌다');
    return;
  }
  // 안전한 자리 기억
  p.safeT -= dt;
  if (p.safeT <= 0 && !p.glide && p.state === 'walk' && !TD[nt].deep && !TD[nt].chasm && nt !== T.ICE && !platformAt(p.x, p.y)) { p.safeT = 0.4; p.lastSafe = { x: p.x, y: p.y }; }
  if (p.state === 'walk' && !cd.climb) p.lastGround = { x: p.x, y: p.y };
}
function startGlide() {
  if (!G.f.coat) { toast('활공 외투가 있어야 한다'); return; }
  if (P.glide) { P.glide = false; return; }
  const t = TD[tileAt(Math.floor(P.x), Math.floor(P.y))];
  if (!(P.onTower || t.high || t.climb || t.ramp)) { toast('높은 곳에서만 활공할 수 있다'); return; }
  if (P.exhausted) { toast('숨이 차서 뛰어내릴 수 없다'); return; }
  if (P.onTower) towerLeave(true);
  P.glide = true; sfx('glide');
}
function towerLeave(glide) {
  const t = P.onTower; P.onTower = null;
  P.x = t.x + (P.fx || 0) * 1.3; P.y = t.y + 1.2 + (P.fy > 0 ? 0.2 : 0);
  if (playerBlocked(P.x, P.y)) { P.x = t.x; P.y = t.y + 1.3; }
  if (!glide) toast('탑에서 내려왔다');
}
function climbTower(e) {
  if (P.onTower === e) { towerLeave(); return; }
  runScript(async () => {
    if (P.st < 40) { await say('렌', '숨부터 좀 고르자. 이 높이를 오르려면 힘이 남아 있어야 한다.'); return; }
    G.fadeTo = 0.6; await wait(0.4);
    P.st -= 35; P.onTower = e; P.x = e.x; P.y = e.y + 0.1; G.fadeTo = 0;
    await wait(0.3);
    if (!e.lit) await TALK.towerTop(e);
    else toast('활공하려면 F, 내려가려면 움직이거나 E');
  });
}

// ---------- 피해 ----------
function hurtPlayer(q, fx, fy, o = {}) {
  if ((P.iframes > 0 && !o.force) || (G.lock && !o.force) || G.mode !== 'play') return;
  P.hp -= q;
  if (o.noKill || (G.boss && G.boss.type === 'boss_mask' && !G.boss.dead)) P.hp = Math.max(1, P.hp);
  P.iframes = 0.9; P.flash = 0.25;
  sfx('hurt'); G.shake = Math.max(G.shake, 0.25);
  if (!o.noKb) {
    const dx = P.x - fx, dy = P.y - fy, l = Math.hypot(dx, dy) || 1, k = o.push || 6;
    P.kb = { x: dx / l * k, y: dy / l * k, t: 0.18 };
  }
  P.glide = false;
  if (P.holding) { P.holding.held = false; P.holding = null; }
  if (P.hp <= 0) gameOver();
}
function gameOver() {
  P.hp = 0;
  runScript(async () => {
    G.fadeTo = 1; await wait(0.6);
    await caption('눈앞이 하얘졌다…', 1.6);
    const cp = G.cp || { map: 'kalidor', x: 8, y: 34 };
    G.boss = null;
    // 보스는 다시 처음부터
    for (const e of G.map.ents) if (e.boss && !e.dead) { e.hp = e.maxhp; e.awake = false; e.x = e.hx ?? e.x; }
    G.maps[G.map.id] && G.map.ents.forEach(e => { if (['warn', 'ring', 'proj', 'bomb'].includes(e.type)) e.dead = true; });
    enterMap(cp.map, cp.x, cp.y);
    P.hp = P.maxhp; P.st = P.maxst; P.exhausted = false;
    G.fadeTo = 0;
  });
}
function heal(q) { P.hp = Math.min(P.maxhp, P.hp + q); }

// ---------- 공격 ----------
function attack() {
  if (P.atkCd > 0 || P.glide || P.state === 'climb' || P.state === 'swim' || P.onTower) return;
  const w = G.weapons[G.wi];
  P.atkT = 0.2; P.atkCd = 0.36;
  sfx('swing');
  const hx = P.x + P.fx * 0.75, hy = P.y + P.fy * 0.75;
  let hit = false;
  for (const e of G.map.ents) {
    if (!shown(e) || !e.hittable) continue;
    const reach = 0.95 + (e.boss ? e.r * 0.6 : e.r);
    if (dist(hx, hy, e.x, e.y) < reach) {
      if (ET[e.type].onHit) { if (ET[e.type].onHit(e)) hit = true; continue; }
      const base = w ? WEAPONS[w.k].dmg : 1;
      damageEnt(e, base, P.x, P.y);
      hit = true;
    }
  }
  if (hit && w) {
    w.d--;
    if (w.d <= 0) {
      toast(`${WEAPONS[w.k].name}이(가) 부서졌다`); sfx('break');
      G.weapons.splice(G.wi, 1); G.wi = G.weapons.length ? 0 : -1;
    }
  }
}
function damageEnt(e, dmg, fx, fy, silent) {
  if (e.dead) return;
  if (e.frozen > 0 && e.stasis && !e.boss) { e.stored = (e.stored || 0) + dmg; sfx('blip'); return; }
  if (e.watcher) { e.dead = true; markDone(e.id); burst(e.x, e.y, 14, '#c8a0ff', 3, 0.6); sfx('hit'); G.f.watcherHit = true; return; }
  const mul = ET[e.type].dmgMul ? ET[e.type].dmgMul(e) : 1;
  if (e.boss && !e.awake) return;
  e.hp -= dmg * mul;
  if (!silent) sfx('hit');
  burst(e.x, e.y, 6, '#fff', 2.5, 0.3);
  if (!e.boss) { const dx = e.x - fx, dy = e.y - fy, l = Math.hypot(dx, dy) || 1; e.kb = { x: dx / l * 7, y: dy / l * 7, t: 0.14 }; if (e.state === 'idle') e.state = 'chase'; }
  if (mul < 1 && e.boss) toast('움직임이 너무 빨라서 제대로 맞지 않는다');
  if (e.hp <= 0) killEnt(e);
}
function killEnt(e) {
  e.dead = true;
  if (e.unique) markDone(e.id);
  if (e.boss) { G.boss = null; burst(e.x, e.y, 40, '#fff', 5, 1.2, 4); sfx('chime'); TALK.bossDown(e); return; }
  burst(e.x, e.y, 18, e.tint ? TINT[e.tint] : (e.k ? e.k.c : '#c8a0ff'), 3, 0.9, 3);
  if (e.type === 'echo') {
    if (Math.random() < 0.7) give('dust', 1, true);
    if (Math.random() < 0.6) addCoins(1 + (Math.random() * 5 | 0), true);
    if (Math.random() < 0.16) giveWeapon(pick(e.kind === 'big' ? ['runeSword', 'brass'] : ['brass', 'stick', 'stick']), true);
  } else if (e.type === 'beast') {
    give('meat', 1);
  }
}

// ---------- 룬 ----------
function selectRune(k) { if (G.runes[k]) { G.rune = k; sfx('blip'); } }
function cycleRune() {
  const ks = Object.keys(RUNES).filter(k => G.runes[k]);
  if (!ks.length) return;
  G.rune = ks[(ks.indexOf(G.rune) + 1) % ks.length]; sfx('blip');
}
function coneTarget(filter, range = 6.5, cone = 0.55) {
  let best = null, bs = 1e9;
  for (const e of G.map.ents) {
    if (!shown(e) || !filter(e)) continue;
    const dx = e.x - P.x, dy = e.y - P.y, d = Math.hypot(dx, dy);
    if (d > range) continue;
    const dot = d < 0.6 ? 1 : (dx * P.fx + dy * P.fy) / d;
    if (dot < cone) continue;
    const s = d * (2 - dot);
    if (s < bs) { bs = s; best = e; }
  }
  return best;
}
function useRune() {
  if (!G.runes[G.rune]) { if (!Object.keys(G.runes).length) toast('아직 룬이 없다'); return; }
  if (P.glide || P.onTower) return;
  const k = G.rune;
  if (k === 'magnes') {
    if (P.holding) { P.holding.held = false; P.holding = null; sfx('magnet'); return; }
    const e = coneTarget(o => o.metal);
    if (!e) { toast('끌어당길 금속이 없다'); sfx('deny'); return; }
    if (e.onMagnes) { e.onMagnes(e); return; }
    P.holding = e; e.held = true;
    let ox = e.x - P.x, oy = e.y - P.y; const l = Math.hypot(ox, oy) || 1;
    const L = clamp(l, 1.3, 3); P.hold = { x: ox / l * L, y: oy / l * L };
    sfx('magnet');
  } else if (k === 'stasis') {
    if (P.runeCd > 0) { sfx('deny'); return; }
    const e = coneTarget(o => o.stasis, 7.5, 0.45);
    if (!e) { toast('붙들 것이 없다'); sfx('deny'); return; }
    if (e.boss) { toast('너무 커서 붙들 수 없다'); return; }
    ET[e.type].onStasis(e); P.runeCd = 1.2; sfx('freeze');
  } else if (k === 'cryo') {
    if (P.runeCd > 0) return;
    for (let s = 1; s <= 3; s++) {
      const tx = Math.floor(P.x + P.fx * s), ty = Math.floor(P.y + P.fy * s);
      const key = tx + ',' + ty;
      if (G.map.ice.has(key)) { G.map.ice.delete(key); sfx('ice'); burst(tx + 0.5, ty + 0.5, 8, '#dff4ff', 2, 0.4); P.runeCd = 0.25; return; }
      const raw = rawTile(tx, ty), t = tileAt(tx, ty);
      if (raw === T.FLOOD && G.map.flood) { toast('물살이 세서 얼음이 버티지 못한다'); sfx('deny'); return; }
      if (t === T.DEEP || t === T.SHALLOW) {
        G.map.ice.set(key, G.t);
        if (G.map.ice.size > 3) { const first = G.map.ice.keys().next().value; G.map.ice.delete(first); }
        sfx('ice'); burst(tx + 0.5, ty + 0.5, 12, '#dff4ff', 2, 0.5); P.runeCd = 0.35; return;
      }
      if (TD[t].solid) break;
    }
    toast('얼릴 물이 앞에 없다'); sfx('deny');
  } else if (k === 'burst') {
    const live = G.map.ents.find(e => e.type === 'bomb' && !e.dead);
    if (live) { explode(live); return; }
    if (P.bombCd > 0) { sfx('deny'); return; }
    spawn('bomb', P.x + P.fx * 0.9, P.y + P.fy * 0.9, { exact: true });
    P.bombCd = 1.5; sfx('rune');
    if (!G.f.bombTip) { G.f.bombTip = true; toast('룬(Q)을 한 번 더 누르면 바로 터진다'); }
  }
}
function explode(b) {
  if (b.dead) return;
  b.dead = true;
  const R = 1.7;
  sfx('boom'); G.shake = 0.45;
  burst(b.x, b.y, 30, '#7ff0ff', 6, 0.6, 4); burst(b.x, b.y, 20, '#fff', 4, 0.4, 3);
  for (const e of G.map.ents) {
    if (!shown(e) || e === b) continue;
    if (dist(e.x, e.y, b.x, b.y) > R + (e.r || 0.4)) continue;
    if (ET[e.type].onBurst) ET[e.type].onBurst(e);
    else if (e.hittable && e.hp !== undefined && e.type !== 'chain') damageEnt(e, 4, b.x, b.y);
  }
  for (let y = Math.floor(b.y - R); y <= b.y + R; y++) for (let x = Math.floor(b.x - R); x <= b.x + R; x++) {
    if (dist(x + 0.5, y + 0.5, b.x, b.y) > R) continue;
    if (rawTile(x, y) === T.CRACK) { setTileCur(x, y, G.map.floorT ?? (G.map.world ? T.GRASS : (G.map.style === 'mine' ? T.MINE : T.FLOOR)), true); burst(x + 0.5, y + 0.5, 10, '#8a7a72', 3, 0.6, 4); sfx('break'); }
  }
  if (dist(P.x, P.y, b.x, b.y) < R) hurtPlayer(2, b.x, b.y, { push: 8 });
}

// ---------- 상호작용 ----------
function interactTarget() {
  const ax = P.x + P.fx * 0.7, ay = P.y + P.fy * 0.7;
  let best = null, bs = 1e9;
  for (const e of G.map.ents) {
    if (!shown(e)) continue;
    const d = ET[e.type];
    if (!d || !d.interact) continue;
    if (d.prompt && !d.prompt(e)) continue;
    const reach = e.reach || (e.type === 'tower' ? 1.9 : e.type === 'chair' ? 2 : 1.5) + (e.r > 0.5 ? e.r - 0.4 : 0);
    if (dist(P.x, P.y, e.x, e.y) > reach) continue;
    const s = dist(ax, ay, e.x, e.y);
    if (s < bs) { bs = s; best = e; }
  }
  return best;
}

// ---------- 아이템 ----------
function give(k, n = 1, quiet) {
  G.inv[k] = (G.inv[k] || 0) + n;
  if (k === 'crystal') { G.crystals = (G.crystals || 0) + n; if (G.crystals >= 4) { G.crystals -= 4; runScript(TALK.crystalUpgrade); } }
  if (!quiet) { sfx('pick'); toast(`${ITEMS[k] ? ITEMS[k].name : k} +${n}`); }
  else toast(`${ITEMS[k] ? ITEMS[k].name : k} +${n}`, true);
}
function take(k, n = 1) { if ((G.inv[k] || 0) < n) return false; G.inv[k] -= n; if (G.inv[k] <= 0) delete G.inv[k]; return true; }
function giveWeapon(k, quiet) {
  if (G.weapons.length >= 6) { toast('무기를 더 들 수 없다 · 가방에서 버리자'); return; }
  G.weapons.push({ k, d: WEAPONS[k].dur });
  if (G.wi < 0) G.wi = G.weapons.length - 1;
  else if (WEAPONS[k].dmg > WEAPONS[G.weapons[G.wi].k].dmg) G.wi = G.weapons.length - 1;
  if (!quiet) sfx('pick');
  toast(`무기: ${WEAPONS[k].name}`, quiet);
}
function addCoins(n, quiet) { G.coins += n; toast(`빛화 +${n}`, quiet); }

// ---------- 시간과 온도 ----------
function updateClock(dt) {
  if (G.lock && !G.clockRun) return;
  G.time = (G.time + dt * 2.2) % 1440;
  const h = G.time / 60;
  let n = 0;
  if (h >= 18 && h < 21) n = (h - 18) / 3; else if (h >= 21 || h < 4) n = 1; else if (h >= 4 && h < 7) n = 1 - (h - 4) / 3;
  G.night = n;
}
function outdoor() { return G.map.world || G.map.id === 'kalidor'; }
function airTemp() {
  const m = G.map;
  let t;
  if (m.world) {
    const r = regionAt(P.x, P.y);
    t = REG[r].temp;
    if (r === 3 && G.f.elm === 'full') t = 1;
    if (r === 2 && G.f.eng_marcella) t = 23;
    if (r === 6 && G.f.westDark) t = -14;
    if (r === 4) t -= Math.max(0, (40 - P.y) * 0.25);
    if ((r === 0 || r === 1) && G.f.grav === 'pump' && dist(P.x, P.y, 100, 122) < 34) t -= 10;
  } else {
    t = m.temp;
    if (m.id === 'kalidor' && G.f.tremor && !G.f.ch1engine) t = 6;
  }
  if (outdoor()) t -= G.night * 6;
  return Math.round(t);
}
function feltTemp() {
  let t = airTemp();
  for (const e of G.map.ents) if (e.type === 'fire' && dist(e.x, e.y, P.x, P.y) < 3.4) { t += 18; break; }
  if (G.torch && (G.map.dark || G.night > 0.5)) t += 5;
  return t;
}
function updateCold(dt) {
  if (G.warmT > 0) G.warmT -= dt;
  if (G.lock) return;
  const prot = (G.f.furcoat ? 14 : 0) + (G.warmT > 0 ? 12 : 0);
  const eff = feltTemp() + prot;
  G.coldDef = 5 - eff;
  if (G.coldDef > 0) {
    const sev = Math.ceil(G.coldDef / 8);
    P.coldT += dt;
    if (P.coldT > 6 / sev) {
      P.coldT = 0; P.hp -= 1; P.flash = 0.2; sfx('hurt');
      if (!G.f.coldTip) { G.f.coldTip = true; toast('너무 춥다. 불 근처로 가거나, 매콤한 요리를 먹거나, 털 외투를 입자'); }
      if (P.hp <= 0) gameOver();
    }
  } else P.coldT = 0;
}

// ---------- 공명석 ----------
function resonanceTarget() {
  const m = G.map;
  if (G.f.stoneSilent) return null;
  if (!m.world) { const c = m.ents.find(e => (e.type === 'core' || e.type === 'chair') && shown(e)); return c ? { x: c.x, y: c.y } : null; }
  const list = [];
  if (!G.f.eng_marcella) list.push(PLACES.cathedral);
  if (!G.f.eng_elm) list.push(PLACES.clock);
  if (!G.f.eng_grav) list.push(PLACES.mine);
  if (G.f.summons && !G.f.primaStop) list.push(PLACES.prima);
  let best = null, bd = 1e9;
  for (const [x, y] of list) { const d = dist(x, y, P.x, P.y); if (d < bd) { bd = d; best = { x, y }; } }
  return best;
}
function updateResonance(dt) {
  if (!G.f.stone || G.f.stoneSilent) { G.res = null; return; }
  const t = resonanceTarget();
  if (!t) { G.res = null; return; }
  const d = dist(t.x, t.y, P.x, P.y);
  const k = 1 - clamp(d / (G.map.world ? 110 : 30), 0, 1);
  const f = G.heartSync !== undefined ? lerp(0.9, 1.4, G.heartSync) : lerp(0.45, 2.8, k * k);
  const prev = G.resPh;
  G.resPh += dt * f;
  if (Math.floor(G.resPh) !== Math.floor(prev)) {
    if (k > 0.25 || G.heartSync !== undefined) { sfx('beat'); try { if (navigator.vibrate && k > 0.6) navigator.vibrate(25); } catch (e) { } }
  }
  G.res = { x: t.x, y: t.y, d, k, ph: G.resPh % 1 };
}

// ---------- 날씨와 지역 ----------
function updateWorldFx(dt) {
  if (!G.map.world) { G.storm = 0; return; }
  const r = regionAt(P.x, P.y);
  if (r !== G.region && r !== 7) {
    G.region = r;
    if (G.lastBanner !== r) { G.lastBanner = r; banner(REG[r].name); if (TALK.region) TALK.region(r); }
  }
  if (r === 2 && !G.f.eng_marcella) {
    G.stormCd -= dt;
    if (G.storm > 0) G.storm -= dt;
    else if (G.stormCd <= 0) { G.stormCd = rand(70, 120); G.storm = 18; toast('소금 폭풍이 분다 · 스태미나가 빨리 닳는다'); }
  } else G.storm = Math.max(0, G.storm - dt);
  // 걸어서 밝힌 안개
  revealFog(P.x, P.y, 7);
}
function revealFog(cx, cy, r) {
  if (!G.fog) return;
  const W = WORLD_W;
  for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
    if (x < 0 || y < 0 || x >= W || y >= WORLD_H) continue;
    if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) G.fog[y * W + x] = 1;
  }
}

// ---------- 메인 루프 ----------
let lastT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - lastT) / 1000 || 0.016);
  lastT = now;
  G.t += dt;
  try { step(dt); render(); } catch (e) { console.error(e); }
  Input.endFrame();
}
function step(dt) {
  // 타이머
  for (let i = Timers.length - 1; i >= 0; i--) { const tm = Timers[i]; tm.t -= dt; if (tm.t <= 0) { Timers.splice(i, 1); tm.fn(); } }
  G.fade = lerp(G.fade, G.fadeTo, Math.min(1, dt * 10));
  if (Math.abs(G.fade - G.fadeTo) < 0.01) G.fade = G.fadeTo;
  UI.update(dt);
  if (G.mode !== 'play' || !G.map) return;
  if (UI.modal) return;
  G.playT += dt;
  if (G.mapCool > 0) G.mapCool -= dt;
  G.shake = Math.max(0, G.shake - dt);
  if (G.rainbow > 0) G.rainbow -= dt * 0.05;
  updateClock(dt);

  // 입력
  if (!G.lock) {
    if (Input.hit('attack')) attack();
    if (Input.hit('act')) {
      if (P.onTower) towerLeave();
      else { const e = interactTarget(); if (e) ET[e.type].interact(e); }
    }
    if (Input.hit('rune')) useRune();
    if (Input.hit('glide')) startGlide();
    if (Input.hit('r1')) selectRune('magnes');
    if (Input.hit('r2')) selectRune('stasis');
    if (Input.hit('r3')) selectRune('cryo');
    if (Input.hit('r4')) selectRune('burst');
    if (Input.hit('runeNext')) cycleRune();
    if (Input.hit('menu')) UI.openMenu();
    if (Input.hit('map')) UI.openMap();
    if (Input.hit('eat')) quickEat();
  }
  updatePlayer(dt);
  const m = G.map;
  for (const e of m.ents) {
    if (!shown(e)) continue;
    const d = ET[e.type];
    if (d && d.update) {
      if (e.cond && e.type === 'spinner' && !e.cond()) continue;
      d.update(e, dt);
    }
  }
  if (m.ents.some(e => e.dead && e.temp !== false && ['proj', 'warn', 'ring', 'bomb'].includes(e.type))) m.ents = m.ents.filter(e => !(e.dead && ['proj', 'warn', 'ring', 'bomb'].includes(e.type)));
  if (P.holding && (dist(P.holding.x, P.holding.y, P.x, P.y) > 7 || !shown(P.holding))) { P.holding.held = false; P.holding = null; }
  updateParts(dt);
  updateCold(dt);
  updateResonance(dt);
  updateWorldFx(dt);
  if (TALK.tick) TALK.tick(dt);
  G.saveT = (G.saveT || 0) + dt;
  if (G.saveT > 30 && !G.lock) { G.saveT = 0; saveGame(); }
}

// ---------- 렌더링 ----------
const lightCv = document.createElement('canvas');
const lctx = lightCv.getContext('2d');
function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#141428'; ctx.fillRect(0, 0, cv.width, cv.height);
  if (G.mode === 'title' || !G.map) { UI.drawTitleBg && UI.drawTitleBg(); return; }
  const m = G.map;
  // 카메라
  let tx = P.x * TS, ty = P.y * TS;
  if (P.onTower) ty -= 70;
  if (G.camT) { tx = G.camT.x * TS; ty = G.camT.y * TS; }
  G.cam.x = lerp(G.cam.x, tx, G.camT ? 0.04 : 0.15); G.cam.y = lerp(G.cam.y, ty, G.camT ? 0.04 : 0.15);
  const hw = VW / 2 / ZOOM, hh = VH / 2 / ZOOM;
  let cx = G.cam.x, cy = G.cam.y;
  if (!m.world || true) { cx = clamp(cx, hw, Math.max(hw, m.w * TS - hw)); cy = clamp(cy, hh, Math.max(hh, m.h * TS - hh)); if (m.w * TS < hw * 2) cx = m.w * TS / 2; if (m.h * TS < hh * 2) cy = m.h * TS / 2; }
  if (G.shake > 0) { cx += rand(-1, 1) * G.shake * 12; cy += rand(-1, 1) * G.shake * 12; }
  G.view = { cx, cy };
  ctx.setTransform(DPR * ZOOM, 0, 0, DPR * ZOOM, DPR * (VW / 2 - cx * ZOOM), DPR * (VH / 2 - cy * ZOOM));
  const x0 = Math.floor((cx - hw) / TS) - 1, x1 = Math.ceil((cx + hw) / TS) + 1;
  const y0 = Math.floor((cy - hh) / TS) - 1, y1 = Math.ceil((cy + hh) / TS) + 2;
  drawTiles(m, x0, x1, y0, y1);
  // 엔티티
  const vis = e => e.x > x0 - 3 && e.x < x1 + 3 && e.y > y0 - 3 && e.y < y1 + 22;
  const GROUND = ['plate', 'warp', 'pipe', 'leaf', 'ring', 'warn', 'trigger'];
  for (const e of m.ents) if (GROUND.includes(e.type) && shown(e) && vis(e)) ET[e.type].draw && ET[e.type].draw(e);
  const list = m.ents.filter(e => !GROUND.includes(e.type) && e.type !== 'pillar' && e.type !== 'island' && shown(e) && vis(e));
  list.push({ type: '_player', y: P.y, x: P.x });
  list.sort((a, b) => a.y - b.y);
  for (const e of list) {
    if (e.type === '_player') { drawPlayer(); continue; }
    const d = ET[e.type]; if (d && d.draw) d.draw(e);
  }
  for (const e of m.ents) if ((e.type === 'island') && shown(e) && vis(e)) ET[e.type].draw(e);
  for (const e of m.ents) if (e.type === 'pillar' && shown(e) && e.x > x0 - 2 && e.x < x1 + 2 && e.y > y0 - 2 && e.y < y1 + 22) ET.pillar.draw(e);
  drawParts();
  drawWeather(m, cx, cy, hw, hh);
  // 상호작용 표시
  if (!G.lock && G.mode === 'play') {
    const it = interactTarget();
    if (it) { const pr = ET[it.type].prompt ? ET[it.type].prompt(it) : '살펴보기'; UI.prompt(it, pr); } else UI.prompt(null);
  } else UI.prompt(null);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawLighting(m, cx, cy);
  drawScreenFx();
  UI.drawHUD();
  if (G.showPendant) drawPendant();
  if (G.fade > 0.003) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = G.fadeWhite ? `rgba(255,255,255,${G.fade})` : `rgba(10,8,20,${G.fade})`; ctx.fillRect(0, 0, cv.width, cv.height); }
}
function drawPlayer() {
  const p = P;
  if (p.onTower) return;
  const x = p.x * TS, y = p.y * TS;
  if (p.fallT > 0) { ctx.globalAlpha = p.fallT / 0.6; drawPerson(x, y + (0.6 - p.fallT) * 30, Object.assign({ scale: p.fallT / 0.6 }, REN_LOOK())); ctx.globalAlpha = 1; return; }
  if (p.iframes > 0 && Math.sin(G.t * 40) > 0.3) return;
  const look = Object.assign({ moving: p.moving, fx: p.fx, fy: p.fy }, REN_LOOK());
  if (p.state === 'swim') { ellipse(x, y + 4, 12, 6, 'rgba(255,255,255,0.35)'); drawPerson(x, y + 6, Object.assign(look, { scale: 0.85 })); return; }
  if (p.glide) {
    ellipse(x, y + 26, 10, 4, 'rgba(0,0,0,0.2)');
    ctx.fillStyle = '#2f7f7a'; ctx.beginPath(); ctx.moveTo(x - 24, y - 26); ctx.quadraticCurveTo(x, y - 42, x + 24, y - 26); ctx.lineTo(x, y - 18); ctx.closePath(); ctx.fill();
    drawPerson(x, y - 8, look); return;
  }
  if (p.state === 'climb') { ctx.globalAlpha = 0.95; drawPerson(x, y, Object.assign(look, { fy: -1 })); ctx.globalAlpha = 1; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - 6, y - 4); ctx.lineTo(x - 9, y - 14); ctx.moveTo(x + 6, y - 4); ctx.lineTo(x + 9, y - 14); ctx.stroke(); }
  else drawPerson(x, y, look);
  if (p.atkT > 0) {
    const w = G.weapons[G.wi];
    const a = Math.atan2(p.fy, p.fx), sw = (1 - p.atkT / 0.2) * 2.2 - 1.1;
    ctx.strokeStyle = w ? WEAPONS[w.k].c : '#ffe7c0'; ctx.lineWidth = w ? 4 : 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x + Math.cos(a + sw) * 8, y - 4 + Math.sin(a + sw) * 8); ctx.lineTo(x + Math.cos(a + sw) * (w ? 30 : 18), y - 4 + Math.sin(a + sw) * (w ? 30 : 18)); ctx.stroke(); ctx.lineCap = 'butt';
    ctx.globalAlpha = 0.25; ctx.strokeStyle = '#fff'; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(x, y - 4, 24, a - 1.1, a + sw); ctx.stroke(); ctx.globalAlpha = 1;
  }
  if (P.holding) {
    ctx.strokeStyle = 'rgba(255,90,176,0.6)'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.lineTo(P.holding.x * TS, P.holding.y * TS - 6); ctx.stroke(); ctx.setLineDash([]);
  }
}

// 타일 색 (지역과 상태 반영)
function tileColor(m, t, x, y) {
  const reg = m.world ? m.reg[y * m.w + x] : -1;
  const st = m.style;
  switch (t) {
    case T.GRASS: case T.FLOWER: case T.HOUSE:
      if (reg === 6 && G.f.westDark) return '#9aa8a0';
      if (reg === 3) return G.f.elm === 'full' ? '#e8eef4' : '#c8a060';
      if (reg === 4) return '#e8eef4';
      if (reg === 2) return '#efe8d8';
      return (hash2(x, y) < 0.5) ? '#7cc46a' : '#76bd64';
    case T.LEAF: return G.f.elm === 'full' ? (hash2(x, y) < 0.5 ? '#eef3fa' : '#e4ebf3') : (hash2(x, y) < 0.5 ? '#d79a4a' : '#cf8e40');
    case T.HIGH: return reg === 5 ? (hash2(x, y) < 0.5 ? '#e6edf5' : '#dfe7f0') : '#b9c98f';
    case T.CLIFF: return reg === 5 || reg === 4 ? '#9aa0ae' : '#a8916f';
    case T.ROCK: return reg === 4 ? '#8a90a0' : '#9a9488';
    case T.WALL: return st === 'salt' ? '#d8dde4' : st === 'wood' ? '#6a4a3a' : st === 'mine' ? '#3a3236' : st === 'ruin' ? '#a8a2b8' : st === 'lab' ? '#4c5f7a' : '#6c5a73';
    case T.FLOOR: return st === 'salt' ? '#c8d0d8' : st === 'wood' ? '#a8784a' : st === 'ruin' ? '#cfcadc' : st === 'lab' ? '#8a9ab0' : (m.id === 'under' ? '#8a8090' : '#c9b48e');
    case T.PINE: return reg === 4 ? '#e8eef4' : (G.f.elm === 'full' && reg === 3 ? '#e8eef4' : '#c8a060');
    case T.TREE: return reg === 3 ? (G.f.elm === 'full' ? '#e8eef4' : '#c8a060') : (reg === 2 ? '#efe8d8' : '#76bd64');
  }
  return TD[t].c;
}
function drawTiles(m, x0, x1, y0, y1) {
  x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(m.w - 1, x1); y1 = Math.min(m.h - 1, y1);
  const t = G.t;
  // 맵 밖
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const tt = effTile(m, x, y), px = x * TS, py = y * TS, h = hash2(x, y);
    ctx.fillStyle = tileColor(m, tt, x, y);
    ctx.fillRect(px, py, TS + 0.5, TS + 0.5);
    switch (tt) {
      case T.GRASS: if (h < 0.3) { ctx.fillStyle = 'rgba(40,100,40,0.25)'; ctx.fillRect(px + h * 60 % 24, py + h * 97 % 24, 2, 5); ctx.fillRect(px + h * 60 % 24 + 3, py + h * 97 % 24 + 1, 2, 4); } break;
      case T.FLOWER: circle(px + 10, py + 12, 2.5, ['#ff7ab0', '#ffd45a', '#ffffff', '#9a7aff'][(h * 4) | 0]); circle(px + 22, py + 22, 2.2, ['#ffd45a', '#ff7ab0', '#fff'][(h * 3) | 0]); break;
      case T.PATH: if (h < 0.4) { ctx.fillStyle = 'rgba(120,90,50,0.25)'; ctx.fillRect(px + h * 80 % 26, py + h * 53 % 26, 4, 3); } break;
      case T.PLAZA: ctx.strokeStyle = 'rgba(150,130,100,0.35)'; ctx.lineWidth = 1; ctx.strokeRect(px + 0.5, py + 0.5, TS - 1, TS - 1); break;
      case T.DEEP: { ctx.fillStyle = 'rgba(255,255,255,0.12)'; const o = (Math.sin(t * 1.5 + x * 0.7 + y * 0.4) + 1) * 8; ctx.fillRect(px + o, py + 10 + (h * 10), 10, 2); if (rawTile === null) { } break; }
      case T.SHALLOW: ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(px + (Math.sin(t + x) + 1) * 10, py + 16, 8, 2); break;
      case T.SALT: if (h < 0.15) { ctx.globalAlpha = 0.5 + Math.sin(t * 3 + h * 20) * 0.5; circle(px + h * 200 % 30, py + h * 130 % 30, 1.5, '#fff'); ctx.globalAlpha = 1; } break;
      case T.SALTROCK: ctx.fillStyle = '#f6fafc'; ctx.beginPath(); ctx.moveTo(px + 4, py + 30); ctx.lineTo(px + 14, py + 2); ctx.lineTo(px + 28, py + 30); ctx.fill(); ctx.strokeStyle = '#b8c8d4'; ctx.stroke(); break;
      case T.TREE: {
        const reg = m.world ? m.reg[y * m.w + x] : 0;
        const autumn = reg === 3 && G.f.elm !== 'full', winter = reg === 3 && G.f.elm === 'full';
        ctx.fillStyle = '#6a4a2a'; ctx.fillRect(px + 13, py + 18, 6, 12);
        const c = autumn ? ['#e0782a', '#d8a02a', '#c85a2a'][(h * 3) | 0] : winter ? '#9aa8a0' : '#4f9a52';
        circle(px + 16, py + 13, 13, c); circle(px + 10, py + 9, 7, autumn ? '#f0a040' : winter ? '#f4f8fc' : '#5fae5a');
        if (winter) circle(px + 18, py + 6, 6, '#fff');
        break;
      }
      case T.PINE: { ctx.fillStyle = '#5a3a2a'; ctx.fillRect(px + 14, py + 22, 4, 9); ctx.fillStyle = '#3f7a58'; ctx.beginPath(); ctx.moveTo(px + 16, py - 2); ctx.lineTo(px + 30, py + 24); ctx.lineTo(px + 2, py + 24); ctx.fill(); const reg = m.world ? m.reg[y * m.w + x] : 0; if (reg === 4 || (reg === 3 && G.f.elm === 'full')) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(px + 16, py - 2); ctx.lineTo(px + 22, py + 10); ctx.lineTo(px + 10, py + 10); ctx.fill(); } break; }
      case T.ROCK: ellipse(px + 16, py + 18, 14, 12, 'rgba(0,0,0,0.12)'); circle(px + 16, py + 15, 13, tileColor(m, tt, x, y)); circle(px + 11, py + 10, 5, 'rgba(255,255,255,0.18)'); break;
      case T.CLIFF: ctx.fillStyle = 'rgba(0,0,0,0.15)'; for (let i = 0; i < 4; i++) ctx.fillRect(px, py + i * 8 + 5, TS, 2); ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(px + (h * 20 | 0), py + 2, 6, 3); break;
      case T.IVY: ctx.fillStyle = '#7a4a3a'; ctx.fillRect(px, py, TS, TS); ctx.fillStyle = '#4f9a52'; for (let i = 0; i < 5; i++) { ctx.fillRect(px + i * 7 + 2, py, 3, TS); circle(px + i * 7 + 3, py + (h * 20 + i * 5) % 28, 3, '#5fae5a'); } break;
      case T.SHELF: ctx.fillStyle = '#6a4a2a'; ctx.fillRect(px, py, TS, TS); for (let i = 0; i < 6; i++) { ctx.fillStyle = ['#a83a3a', '#3a6aa8', '#3a8a5a', '#c89a3a', '#8a5aa8'][(i + x) % 5]; ctx.fillRect(px + 2 + i * 5, py + 4 + (i % 2) * 2, 4, 12 - (i % 2) * 2); ctx.fillRect(px + 2 + i * 5, py + 19, 4, 10); } break;
      case T.HIGH: case T.RUIN: case T.ROOF: {
        if (tt === T.ROOF) { ctx.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = 0; i < 4; i++) ctx.fillRect(px, py + i * 8, TS, 1.5); }
        if (tt === T.RUIN) { ctx.strokeStyle = 'rgba(100,90,120,0.3)'; ctx.strokeRect(px + 1, py + 1, TS - 2, TS - 2); }
        const below = effTile(m, x, y + 1);
        if (!TD[below].high && below !== T.CLIFF) { ctx.fillStyle = 'rgba(40,40,60,0.35)'; ctx.fillRect(px, py + TS - 6, TS, 6); }
        break;
      }
      case T.CHASM: case T.RAVINE: { const g = ctx.createLinearGradient(px, py, px, py + TS); g.addColorStop(0, '#2a2a4a'); g.addColorStop(1, '#0e0e20'); ctx.fillStyle = g; ctx.fillRect(px, py, TS + 0.5, TS + 0.5); if (h < 0.08) { ctx.globalAlpha = 0.5; circle(px + 16, py + 16, 1.5, '#7ff0ff'); ctx.globalAlpha = 1; } const above = effTile(m, x, y - 1); if (!TD[above].chasm) { ctx.fillStyle = 'rgba(120,100,80,0.8)'; ctx.fillRect(px, py, TS, 5); } break; }
      case T.WALL: { ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(px, py + TS - 5, TS, 5); ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fillRect(px + (y % 2) * 16, py + 10, 15, 1); break; }
      case T.CRACK: ctx.strokeStyle = '#3a2a2a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px + 6, py + 4); ctx.lineTo(px + 16, py + 16); ctx.lineTo(px + 10, py + 28); ctx.moveTo(px + 16, py + 16); ctx.lineTo(px + 26, py + 12); ctx.stroke(); break;
      case T.LEY: { const g = 0.5 + Math.sin(t * 2 + x * 0.3 + y * 0.3) * 0.3; ctx.fillStyle = tileColor(m, T.GRASS, x, y); ctx.fillRect(px, py, TS + 0.5, TS + 0.5); ctx.globalAlpha = g * 0.7; ctx.fillStyle = '#8ff7f0'; ctx.fillRect(px + 6, py + 6, 20, 20); ctx.globalAlpha = g * 0.3; ctx.fillRect(px, py, TS, TS); ctx.globalAlpha = 1; break; }
      case T.BRIDGE: ctx.fillStyle = '#7a5434'; for (let i = 0; i < 4; i++) ctx.fillRect(px, py + i * 8 + 6, TS, 1.5); break;
      case T.ICE: { const raw = m.tiles[y * m.w + x]; ctx.fillStyle = '#5aa0d8'; ctx.fillRect(px, py, TS, TS); rrect(px + 2, py + 1, TS - 4, TS - 3, 4, '#dff4ff'); ctx.fillStyle = '#ffffff'; ctx.fillRect(px + 6, py + 5, 8, 3); break; }
      case T.LEAF: if (G.f.elm !== 'full') { ctx.fillStyle = h < 0.5 ? '#e0a050' : '#b8602a'; ctx.beginPath(); ctx.ellipse(px + h * 90 % 26 + 3, py + h * 70 % 26 + 3, 4, 2.5, h * 6, 0, 7); ctx.fill(); } break;
      case T.SNOW: if (h < 0.2) { ctx.fillStyle = 'rgba(160,180,210,0.35)'; ctx.fillRect(px + h * 70 % 26, py + h * 40 % 26, 5, 2); } break;
      case T.MINE: if (h < 0.3) { ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(px + h * 70 % 26, py + h * 40 % 26, 4, 3); } break;
      case T.DARK: ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(px + (h * 20 | 0), py + (h * 30 | 0) % 24, 8, 6); break;
      case T.CARPET: ctx.fillStyle = 'rgba(255,220,120,0.25)'; ctx.fillRect(px, py + 2, TS, 2); ctx.fillRect(px, py + TS - 4, TS, 2); break;
      case T.FENCE: ctx.fillStyle = tileColor(m, T.GRASS, x, y); ctx.fillRect(px, py, TS, TS); ctx.fillStyle = '#8b6b4a'; ctx.fillRect(px, py + 10, TS, 4); ctx.fillRect(px, py + 20, TS, 4); ctx.fillRect(px + 4, py + 6, 4, 22); ctx.fillRect(px + 22, py + 6, 4, 22); break;
      case T.PILLAR: ctx.fillStyle = m.world ? tileColor(m, T.HIGH, x, y) : tileColor(m, T.FLOOR, x, y); ctx.fillRect(px, py, TS, TS); rrect(px + 5, py - 14, 22, 44, 3, '#cfc6b8'); ctx.fillStyle = '#a8a090'; ctx.fillRect(px + 5, py - 14, 22, 4); break;
      case T.STAIRS: for (let i = 0; i < 4; i++) { ctx.fillStyle = i % 2 ? '#a8987a' : '#c8b89a'; ctx.fillRect(px, py + i * 8, TS, 8); } break;
      case T.MUD: if (h < 0.3) { ctx.fillStyle = 'rgba(120,160,190,0.45)'; ctx.fillRect(px + h * 90 % 22, py + h * 50 % 26, 9, 3); } break;
      case T.FLOOR: case T.SAND: {
        const raw = m.tiles[y * m.w + x];
        if ((raw === T.FLOOD || raw === T.POOL) && !m.flood) { ctx.fillStyle = 'rgba(80,120,150,0.25)'; ctx.fillRect(px, py, TS, TS); }
        if (m.style === 'wood' && tt === T.FLOOR) { ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.fillRect(px, py + (x % 2) * 16, TS, 1); }
        break;
      }
    }
    if (tt === T.DEEP && !m.world && (m.tiles[y * m.w + x] === T.FLOOD)) { ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2; const o = (t * 40 + y * 9) % 32; ctx.beginPath(); ctx.moveTo(px + o - 8, py + 12); ctx.lineTo(px + o, py + 12); ctx.stroke(); }
  }
}

function drawWeather(m, cx, cy, hw, hh) {
  const r = m.world ? regionAt(P.x, P.y) : m.region;
  const L = cx - hw, Tp = cy - hh, W = hw * 2, H = hh * 2;
  const snow = (m.world && (r === 4 || r === 5 || (r === 3 && G.f.elm === 'full') || (r === 6 && G.f.westDark))) || m.id === 'prima';
  if (snow) {
    ctx.fillStyle = '#ffffff';
    const n = r === 5 ? 90 : 50;
    for (let i = 0; i < n; i++) {
      const sx_ = (hash2(i, 1) * W + G.t * (20 + hash2(i, 2) * 30) * (r === 5 ? 3 : 1)) % W, sy_ = (hash2(i, 3) * H + G.t * (40 + hash2(i, 4) * 40)) % H;
      ctx.globalAlpha = 0.7; ctx.fillRect(L + sx_, Tp + sy_, 2.5, 2.5);
    }
    ctx.globalAlpha = 1;
  }
  // 엘름바텐: 공중에 멈춘 낙엽과 빗방울
  if (m.world && r === 3 && G.f.elm !== 'full') {
    for (let i = 0; i < 40; i++) {
      const wx = Math.floor(L / 200) * 200 + hash2(i, 5) * 400, wy = Math.floor(Tp / 200) * 200 + hash2(i, 6) * 400;
      if (G.f.elm !== 'stable' || i % 2) {
        ctx.fillStyle = i % 3 ? '#e0782a' : '#d8a02a';
        ctx.beginPath(); ctx.ellipse(wx, wy - 30, 5, 3, i, 0, 7); ctx.fill();
        if (i % 4 === 0) { ctx.fillStyle = '#bfe6ff'; ctx.fillRect(wx + 30, wy - 50, 2, 6); }
      }
    }
  }
  // 칼리도르 떨림: 대강당 돔 안의 눈
  if (m.id === 'kalidor' && G.f.tremor && !G.f.ch1engine) {
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 60; i++) { const x = 42 * TS + hash2(i, 7) * 18 * TS, y = 4 * TS + ((hash2(i, 8) * 12 * TS + G.t * 30) % (12 * TS)); ctx.globalAlpha = 0.8; ctx.fillRect(x, y, 2.5, 2.5); }
    for (let i = 0; i < 30; i++) { const x = L + hash2(i, 9) * W, y = Tp + ((hash2(i, 10) * H + G.t * 25) % H); ctx.globalAlpha = 0.4; ctx.fillRect(x, y, 2, 2); }
    ctx.globalAlpha = 1;
  }
  // 소금 폭풍
  if (G.storm > 0 && m.world && r === 2) {
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 80; i++) { const x = L + (hash2(i, 11) * W + G.t * 400) % W, y = Tp + hash2(i, 12) * H; ctx.globalAlpha = 0.6; ctx.fillRect(x, y, 14, 1.5); }
    ctx.globalAlpha = 1;
  }
}

function drawLighting(m, cx, cy) {
  const W = cv.width, H = cv.height;
  const toScreen = (x, y) => [DPR * (VW / 2 + (x * TS - cx) * ZOOM), DPR * (VH / 2 + (y * TS - cy) * ZOOM)];
  let dark = 0;
  if (m.dark) dark = 0.93;
  else if (m.dim) dark = m.dim;
  else if (outdoor()) dark = G.night * 0.55;
  if (dark <= 0.01) return;
  if (lightCv.width !== W || lightCv.height !== H) { lightCv.width = W; lightCv.height = H; }
  lctx.globalCompositeOperation = 'source-over';
  lctx.clearRect(0, 0, W, H);
  lctx.fillStyle = m.dark ? `rgba(6,5,12,${dark})` : `rgba(14,20,60,${dark})`;
  lctx.fillRect(0, 0, W, H);
  lctx.globalCompositeOperation = 'destination-out';
  const hole = (x, y, r, a = 1) => {
    const [sx_, sy_] = toScreen(x, y), rr = r * TS * ZOOM * DPR;
    if (sx_ < -rr || sy_ < -rr || sx_ > W + rr || sy_ > H + rr) return;
    const g = lctx.createRadialGradient(sx_, sy_, rr * 0.2, sx_, sy_, rr);
    g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    lctx.fillStyle = g; lctx.beginPath(); lctx.arc(sx_, sy_, rr, 0, Math.PI * 2); lctx.fill();
  };
  hole(P.x, P.y, m.dark ? (G.torch ? 5.5 + Math.sin(G.t * 9) * 0.2 : 2.4) : 4, 1);
  for (const e of m.ents) {
    if (!shown(e)) continue;
    if (e.type === 'fire') hole(e.x, e.y, 5, 1);
    else if (e.type === 'deco' && e.kind === 'lamp' && !G.lampOff) hole(e.x, e.y - 0.7, 3.5, 0.9);
    else if (e.type === 'deco' && e.kind === 'house' && !e.dark && !(G.f.westDark && regionAt(e.x, e.y) === 6)) hole(e.x, e.y, 2.5, 0.6);
    else if (e.type === 'pylon' && e.on) hole(e.x, e.y, 4, 0.8);
    else if (e.type === 'core') hole(e.x, e.y, 5, 0.9);
    else if (e.type === 'boss_mine' || (e.type === 'echo' && e.act === 'lantern')) hole(e.x, e.y, 3, 0.7);
    else if (e.type === 'pipe' && e.flow) hole(e.x, e.y, 1.5, 0.6);
    else if (e.type === 'pillar') hole(e.x, e.y, 3, 0.7);
  }
  lctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(lightCv, 0, 0);
}

function drawScreenFx() {
  const W = cv.width, H = cv.height;
  // 마르셀라 한낮 반사광
  if (G.map.world && regionAt(P.x, P.y) === 2 && !G.f.eng_marcella) {
    const h = G.time / 60;
    if (h > 11 && h < 15) { ctx.fillStyle = `rgba(255,255,255,${0.32 + Math.sin(G.t * 1.3) * 0.08})`; ctx.fillRect(0, 0, W, H); }
  }
  // 추위
  if (G.coldDef > 0 && G.mode === 'play') {
    const a = clamp(G.coldDef / 25, 0.15, 0.5);
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.7);
    g.addColorStop(0, 'rgba(180,220,255,0)'); g.addColorStop(1, `rgba(200,235,255,${a})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  if (P.flash > 0) { ctx.fillStyle = `rgba(255,60,60,${P.flash})`; ctx.fillRect(0, 0, W, H); }
  // 공명석 맥동: 화면 테두리
  if (G.res && G.mode === 'play') {
    const k = G.res.k, ph = G.res.ph;
    const pulse = Math.max(0, 1 - ph * 3);
    const a = (0.05 + k * 0.3) * pulse;
    if (a > 0.005) {
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.72);
      g.addColorStop(0, 'rgba(127,240,255,0)'); g.addColorStop(1, `rgba(127,240,255,${a})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
  }
}

// ---------- 저장 ----------
const SAVE_KEY = 'asteria-part1-save';
function saveData() {
  let fogc = '';
  if (G.fog) { const W = WORLD_W, c = []; for (let y = 0; y < WORLD_H; y += 4) for (let x = 0; x < W; x += 4) c.push(G.fog[y * W + x] ? 1 : 0); fogc = c.join(''); }
  return {
    v: 1, f: G.f, done: G.done, inv: G.inv, weapons: G.weapons, wi: G.wi, coins: G.coins, runes: G.runes, rune: G.rune,
    journal: G.journal, letters: G.letters, obj: G.obj, map: G.map ? G.map.id : 'kalidor', x: P ? P.x : 8, y: P ? P.y : 34,
    hp: P ? P.hp : 12, maxhp: P ? P.maxhp : 12, maxst: P ? P.maxst : 100, time: G.time, playT: G.playT, rings: G.rings, ringsMesh: G.ringsMesh,
    torch: G.torch, crystals: G.crystals, fogc, cp: G.cp, warmT: G.warmT,
  };
}
function saveGame() {
  if (G.mode !== 'play' || G.noSave) return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(saveData())); } catch (e) { }
}
function loadSave() {
  try { const s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; }
}
function applySave(d) {
  Object.assign(G, { f: d.f || {}, done: d.done || {}, inv: d.inv || {}, weapons: d.weapons || [], wi: d.wi ?? -1, coins: d.coins || 0, runes: d.runes || {}, rune: d.rune || 'magnes', journal: d.journal || [], letters: d.letters || [], obj: d.obj || '', time: d.time ?? 540, playT: d.playT || 0, rings: d.rings || null, ringsMesh: d.ringsMesh ?? true, torch: !!d.torch, crystals: d.crystals || 0, cp: d.cp, warmT: d.warmT || 0 });
  G.maps = {};
  G.fog = new Uint8Array(WORLD_W * WORLD_H);
  if (d.fogc) { let i = 0; for (let y = 0; y < WORLD_H; y += 4) for (let x = 0; x < WORLD_W; x += 4) { if (d.fogc[i++] === '1') for (let oy = 0; oy < 4; oy++) for (let ox = 0; ox < 4; ox++) if (y + oy < WORLD_H && x + ox < WORLD_W) G.fog[(y + oy) * WORLD_W + x + ox] = 1; } }
  P = newPlayer(d.x, d.y);
  P.hp = d.hp; P.maxhp = d.maxhp; P.maxst = d.maxst; P.st = P.maxst;
  G.mode = 'play';
  enterMap(d.map, d.x, d.y);
  if (P.hp <= 0) P.hp = P.maxhp;
}
function newGame() {
  Object.assign(G, { f: {}, done: {}, inv: {}, weapons: [], wi: -1, coins: 0, runes: {}, rune: 'magnes', journal: [], letters: [], obj: '', time: 7 * 60 + 40, playT: 0, rings: null, ringsMesh: true, torch: false, crystals: 0, maps: {}, warmT: 0 });
  G.fog = new Uint8Array(WORLD_W * WORLD_H);
  P = newPlayer(6.5, 34.5);
  G.mode = 'play';
  enterMap('kalidor', 6, 34);
  runScript(TALK.opening);
}

// 핫 리로드 시 상태 유지
function boot(data) {
  resize();
  setupTouch();
  UI.init();
  if (data && data.save) { applySave(data.save); }
  requestAnimationFrame(frame);
}
if (window.claude && window.claude.hot && window.claude.hot.snapshot) {
  try { window.claude.hot.snapshot(() => (G.mode === 'play' ? { save: saveData() } : {})); } catch (e) { }
}
window.__asteria = { G, get P() { return P; }, goMap, enterMap, give, giveWeapon, TALK: () => TALK };
window.claude?.hot?.ready ? window.claude.hot.ready(boot) : boot(window.claude?.hot?.data ?? {});
