// 아스테리아 1부 — 게임 상태, 플레이어 물리, 카메라, 장소 이동(로딩), 빛과 날씨, 저장
'use strict';

const G = {
  mode: 'title', maps: {}, map: null, t: 0, playT: 0, time: 9 * 60, f: {}, done: {}, inv: {}, weapons: [], wi: -1,
  coins: 0, runes: {}, rune: 'magnes', journal: [], letters: [], obj: '', lock: 0, shake: 0, fade: 0, fadeTo: 0,
  boss: null, rings: null, ringsMesh: true, fog: null, region: -1, night: 0, mapCool: 0, camT: null,
  torch: false, crystals: 0, cp: null, resPh: 0, warmT: 0, storm: 0, stormCd: 60, rainbow: 0, lampOff: false,
  mana: 100, maxMana: 100, dynCols: [], flash: null,
};
let P = null;
// 어깨 너머 카메라: 붐 4 m, 오른쪽 어깨 0.55 m, 피벗 1.55 m, 기본으로 8° 내려다본다
const CAM = { yaw: 0, pitch: 0.14, dist: 4.0, x: 0, y: 0, z: 0, tx: 0, ty: 0, tz: 0, init: false, side: 0.55, fov: 48 };
const Timers = [];
function setTimeoutG(fn, s) { Timers.push({ t: s, fn }); }
function wait(s) { return new Promise(r => setTimeoutG(r, s)); }
function runScript(fn) {
  G.lock++;
  return Promise.resolve().then(fn).catch(e => console.error(e)).finally(() => { G.lock = Math.max(0, G.lock - 1); Input.endFrame(); });
}
const isDone = id => !!G.done[id];
const markDone = id => { G.done[id] = true; };

function newPlayer(x, y, z) {
  return {
    x, y, z, vx: 0, vy: 0, vz: 0, yaw: 0, mode: 'ground', hp: 12, maxhp: 12, st: 100, maxst: 100, exhausted: false,
    iframes: 0, atkT: 0, atkCd: 0, kb: null, lastSafe: { x, y, z }, safeT: 0, holding: null, hold: { x: 0, z: 0, y: 1, yaw: 0 },
    stepT: 0, coldT: 0, runeCd: 0, bombCd: 0, boltCd: 0, flash: 0, casting: 0, castAnim: 0, vis: y, climbN: null, fallStart: y,
  };
}

// ======================================================================
// 장소 이동 (로딩 화면)
// ======================================================================
const LOADING_TIPS = [
  '빛나는 지맥 위에 서 있으면 마력이 빨리 찬다.',
  '공명봉 버튼을 길게 누르면 공명파가 터진다. 주변 잔향을 모두 밀어낸다.',
  '정체 룬으로 붙든 적을 때리면, 시간이 풀릴 때 한꺼번에 맞는다.',
  '모닥불 위로 활공하면 더운 바람을 타고 높이 오를 수 있다.',
  '절벽은 어디든 오를 수 있다. 스태미나가 다하기 전에 쉴 곳을 찾자.',
  '불꽃고추를 넣은 요리는 몸을 데운다. 고원에 오르기 전에 챙기자.',
  '룬을 새긴 무기는 마력이 다하면 부서진다.',
  '관측탑 꼭대기에 오르면 그 주변의 지도가 그려진다.',
];
async function showLoading(name, sub) {
  const el = $('loading');
  el.querySelector('.lname').textContent = name || '';
  el.querySelector('.lsub').textContent = sub || '';
  el.querySelector('.ltip').textContent = pick(LOADING_TIPS);
  el.hidden = false; el.classList.remove('out');
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
}
function hideLoading() { const el = $('loading'); el.classList.add('out'); setTimeout(() => { el.hidden = true; }, 600); }
function mapTitle(id) {
  const n = { world: '아스테리아', kalidor: '칼리도르 학원', archives: '기록보관소', hall: '대강당', olab: '오스윈 연구실', kitchen: '식당과 부엌', dorm: '기숙사', under: '지하 회랑', cathedral: '성녀 마렌 성당', clock: '시계탑 기관', mine: '그라벤호프 제3갱', prima: '프리마' }[id];
  return n || (id.startsWith('lab') ? '봉인 실험실' : id);
}
function goMap(id, tx, ty) {
  return runScript(async () => {
    G.fadeTo = 1; await wait(0.25);
    const heavy = !G.maps[id] || id === 'world';
    if (heavy || G.map.kind !== getMapKindGuess(id)) await showLoading(mapTitle(id), id === 'world' ? '대륙' : '');
    enterMap(id, tx, ty);
    hideLoading();
    G.fadeTo = 0;
    await wait(0.15);
    if (TALK.enter && TALK.enter[id]) await TALK.enter[id]();
  });
}
const getMapKindGuess = id => id === 'world' ? 'terrain' : id === 'kalidor' ? 'site' : 'blocks';
function resolveSpot(m, tx, ty) {
  if (m.kind === 'terrain') {
    if (typeof tx === 'string' || tx === undefined) return worldExit(tx);
    return [tx, ty];
  }
  if (m.kind === 'site') {
    if (typeof tx === 'string' || tx === undefined) return (m.spots[tx] || m.spots.court).slice();
    return [tx, ty];
  }
  const cs = m.cs;
  if (typeof tx === 'string') { const sp = m.spots && m.spots[tx]; if (sp) [tx, ty] = sp; else { tx = m.cw / 2; ty = m.cd / 2; } }
  return [Number.isInteger(tx) ? (tx + 0.5) * cs : tx * cs, Number.isInteger(ty) ? (ty + 0.5) * cs : ty * cs];
}
function enterMap(id, tx, ty, meters) {
  if (P.holding) releaseHold();
  const prev = G.map;
  const m = getMap(id);
  if (prev && prev !== m) prev.ents = prev.ents.filter(e => !['bomb', 'proj', 'warn', 'ring', 'bolt', 'wavefx', 'boomfx', 'stasisfx', 'icepillar'].includes(e.type));
  G.map = m;
  if (!m.group) m.group = m.kind === 'site' ? buildSiteScene(m) : buildBlockScene(m);
  if (m.dirty && m.kind === 'blocks') { m.dirty = false; m.group = buildBlockScene(m); }
  GFX.static.clear(); GFX.static.add(m.group);
  GFX.dyn.clear();
  for (const e of m.ents) { e.obj = null; if (!e.fly) e.y = groundY(e); }
  const [x, z] = meters ? [tx, ty] : resolveSpot(m, tx, ty);
  P.x = x; P.z = z; P.y = standHeight(x, z, 99, 999); P.vis = P.y;
  P.vx = P.vy = P.vz = 0; P.mode = 'ground'; P.lastSafe = { x: P.x, y: P.y, z: P.z };
  G.mapCool = 0.8; G.boss = null;
  G.cp = { map: id, x: P.x, z: P.z, meters: true };
  G.region = -1;
  GFX.fx.clear();
  GFX.grass.cx = 1e9; updateGrass(P.x, P.z, true);
  P.obj = null;
  CAM.init = false;
  if (m.kind === 'terrain' && m.season !== seasonSig()) retintWorld(m);
  saveGame();
}

// ======================================================================
// 플레이어
// ======================================================================
const STEP = 0.6;
function inputDir() {
  if (G.lock || G.mode !== 'play' || UI.modal) return { x: 0, z: 0, l: 0, rx: 0, ry: 0 };
  let rx = (Input.key('right') ? 1 : 0) - (Input.key('left') ? 1 : 0) + Input.joy.x;
  let ry = (Input.key('down') ? 1 : 0) - (Input.key('up') ? 1 : 0) + Input.joy.y;
  let l = Math.hypot(rx, ry); if (l > 1) { rx /= l; ry /= l; l = 1; }
  const sy = Math.sin(CAM.yaw), cy = Math.cos(CAM.yaw);
  // 오른쪽 (cos, -sin), 앞 (-sin, -cos)
  const x = cy * rx + -sy * -ry, z = -sy * rx + -cy * -ry;
  return { x, z, l, rx, ry };
}
// 오를 수 있는 면의 높이 (땅 또는 오를 수 있는 충돌체의 윗면)
function surfaceAt(x, z) {
  let s = G.map.ground(x, z), col = null;
  for (const c of collidersNear(x, z, 0.3)) if (insideCol(c, x, z, 0.05) && c.top > s && (c.climb || c.stand)) { s = c.top; col = c; }
  return [s, col];
}
function climbableAt(x, z) {
  const [s, col] = surfaceAt(x, z);
  if (col) return !!col.climb;
  return G.map.climbable(x, z);
}
function blockedByCol(x, z, y) {
  for (const c of collidersNear(x, z, 0.6)) if (c !== P.holding && !c.mob && insideCol(c, x, z, 0.36) && c.top > y + STEP && (c.bot ?? -99) < y + 1.7 && c.self !== P.holding) return c;
  return null;
}
function tryStep(nx, nz) {
  const m = G.map, p = P;
  const g = standHeight(nx, nz, p.y + STEP, STEP);
  const raw = m.ground(nx, nz);
  const wall = raw - p.y > STEP;
  const col = blockedByCol(nx, nz, p.y);
  if (wall || col) return { ok: false, col, wall };
  if (m.noSwim) { const w = m.waterAt(nx, nz); if (w !== null && w - g > 0.9 && p.mode !== 'glide') return { ok: false, water: true }; }
  return { ok: true, g };
}
function startClimb(nx, nz, col) {
  const p = P;
  if (p.exhausted || p.st <= 1 || p.holding) return false;
  let n;
  if (col) {
    if (!col.climb) return false;
    if (col.r !== undefined) { const dx = p.x - col.x, dz = p.z - col.z, l = Math.hypot(dx, dz) || 1; n = { x: dx / l, z: dz / l }; }
    else { const b = colBox(col), lp = colLocal(col, p.x, p.z), px = lp.x, pz = lp.z; const cx = clamp(px, b.x0, b.x1), cz = clamp(pz, b.z0, b.z1); let dx = px - cx, dz = pz - cz; const l = Math.hypot(dx, dz); if (l < 0.01) { dx = px - (b.x0 + b.x1) / 2; dz = pz - (b.z0 + b.z1) / 2; } n = Math.abs(dx) > Math.abs(dz) ? { x: Math.sign(dx), z: 0 } : { x: 0, z: Math.sign(dz) }; if (col.rot) { const co = Math.cos(col.rot), si = Math.sin(col.rot); n = { x: n.x * co + n.z * si, z: -n.x * si + n.z * co }; } }
  } else {
    if (!G.map.climbable(nx, nz)) { if (!p.noClimbT || G.t > p.noClimbT) { toast('매끈해서 오를 수 없다'); p.noClimbT = G.t + 3; } return false; }
    const m = G.map, e = 0.6;
    const gx = m.ground(p.x + e, p.z) - m.ground(p.x - e, p.z), gz = m.ground(p.x, p.z + e) - m.ground(p.x, p.z - e);
    let l = Math.hypot(gx, gz);
    if (l < 0.3) { const dx = nx - p.x, dz = nz - p.z, l2 = Math.hypot(dx, dz) || 1; n = { x: -dx / l2, z: -dz / l2 }; if (m.kind === 'blocks') n = Math.abs(n.x) > Math.abs(n.z) ? { x: Math.sign(n.x), z: 0 } : { x: 0, z: Math.sign(n.z) }; }
    else n = { x: -gx / l, z: -gz / l };
  }
  p.mode = 'climb'; p.climbN = n; p.climbCol = col; p.ladder = col && col.ladder;
  p.vx = p.vz = p.vy = 0; p.yaw = Math.atan2(-n.x, -n.z);
  if (!G.f.climbTip) { G.f.climbTip = true; toast('오르는 중 · 스태미나 바퀴가 다 닳으면 떨어진다 · 점프로 뛰어오른다'); }
  return true;
}
function updatePlayer(dt) {
  const p = P, m = G.map;
  p.iframes -= dt; p.atkCd -= dt; p.atkT -= dt; p.runeCd -= dt; p.bombCd -= dt; p.boltCd -= dt; p.flash -= dt; p.castAnim -= dt;
  const inp = inputDir();
  const control = !G.lock && G.mode === 'play' && !UI.modal;
  const wantRun = control && (Input.key('run')) && !p.exhausted;
  let drain = 0;
  if (p.kb) { p.vx = p.kb.x; p.vz = p.kb.z; p.kb.t -= dt; if (p.kb.t <= 0) p.kb = null; }

  if (p.mode === 'ground') {
    const sp = (wantRun && inp.l > 0.2 ? 7.8 : 4.6) * (p.holding ? 0.75 : 1);
    const w = m.waterAt(p.x, p.z), wade = w !== null && w > p.y + 0.3 ? 0.7 : 1;
    const tx = inp.x * sp * wade, tz = inp.z * sp * wade;
    if (!p.kb) { const k = Math.min(1, dt * 12); p.vx = lerp(p.vx, tx, k); p.vz = lerp(p.vz, tz, k); }
    if (wantRun && inp.l > 0.2) drain = 14;
    if (inp.l > 0.15 && !p.holding) p.yaw += angDiff(p.yaw, Math.atan2(inp.x, inp.z)) * Math.min(1, dt * 14);
    moveAxis(p.vx * dt, 0, inp); moveAxis(0, p.vz * dt, inp);
    pushOut(p, 0.36, 1.7);
    const g = standHeight(p.x, p.z, p.y + STEP, STEP);
    if (p.y - g > 0.45) { p.mode = 'air'; p.vy = 0; p.fallStart = p.y; }
    else p.y = g;
    // 물
    const w2 = m.waterAt(p.x, p.z);
    if (w2 !== null && w2 - g > 1.05 && p.mode === 'ground') enterWater(w2);
    if (control && Input.hit('jump') && p.mode === 'ground') { p.mode = 'air'; p.vy = 7.6; p.fallStart = p.y; sfx('jump'); }
    // 안전한 자리
    p.safeT -= dt;
    if (p.safeT <= 0 && p.mode === 'ground' && (w2 === null || w2 < g + 0.3) && !(m.kind === 'terrain' && (m.flagAt(p.x, p.z) & FL.VOID))) { p.safeT = 0.5; p.lastSafe = { x: p.x, y: p.y, z: p.z }; }
  } else if (p.mode === 'air') {
    p.vy = Math.max(-42, p.vy - 24 * dt);
    if (!p.kb) { const k = Math.min(1, dt * 2.5); p.vx = lerp(p.vx, inp.x * 6, k * inp.l); p.vz = lerp(p.vz, inp.z * 6, k * inp.l); }
    if (inp.l > 0.15) p.yaw += angDiff(p.yaw, Math.atan2(inp.x, inp.z)) * Math.min(1, dt * 6);
    moveAxis(p.vx * dt, 0, inp, true); moveAxis(0, p.vz * dt, inp, true);
    pushOut(p, 0.36, 1.7);
    p.y += p.vy * dt;
    const g = standHeight(p.x, p.z, p.y + 0.3, 0.3);
    if (control && (Input.hit('jump') || Input.hit('glide')) && G.f.coat && !p.exhausted && p.y - g > 1.5) { p.mode = 'glide'; sfx('glide'); p.vy = Math.max(p.vy, -3); }
    const w = m.waterAt(p.x, p.z);
    if (w !== null && p.y <= w - 0.3 && w - g > 1.05) { enterWater(w); }
    else if (p.y <= g) land(g);
    if (p.y < -18) fallOut();
  } else if (p.mode === 'glide') {
    drain = 7;
    p.vy = lerp(p.vy, -2.0, Math.min(1, dt * 3));
    // 모닥불 위의 더운 바람
    for (const e of m.ents) if (e.type === 'fire' && Math.hypot(e.x - p.x, e.z - p.z) < 2.6 && p.y - e.y < 22) { p.vy = lerp(p.vy, 7, dt * 3); if (Math.random() < 0.3) FX.spawn({ x: p.x + rand(-1, 1), y: p.y - 1, z: p.z + rand(-1, 1), vy: 6, life: 0.6, size: 0.3, c: 0xffd8a0, add: false, a: 0.4 }); }
    if (inp.l > 0.15) p.yaw += angDiff(p.yaw, Math.atan2(inp.x, inp.z)) * Math.min(1, dt * 2.2);
    const sp = 9.5;
    p.vx = lerp(p.vx, Math.sin(p.yaw) * sp, dt * 2); p.vz = lerp(p.vz, Math.cos(p.yaw) * sp, dt * 2);
    moveAxis(p.vx * dt, 0, inp, true); moveAxis(0, p.vz * dt, inp, true);
    pushOut(p, 0.36, 1.7);
    p.y += p.vy * dt;
    if (Math.random() < 0.5) FX.spawn({ x: p.x - Math.sin(p.yaw) * 0.5 + rand(-1, 1), y: p.y + 2.2, z: p.z - Math.cos(p.yaw) * 0.5 + rand(-1, 1), vx: -p.vx * 0.3, vz: -p.vz * 0.3, life: 0.5, size: 0.12, c: 0xffffff, add: false, a: 0.6 });
    const g = standHeight(p.x, p.z, p.y + 0.3, 0.3);
    if (control && (Input.hit('jump') || Input.hit('glide'))) { p.mode = 'air'; }
    const w = m.waterAt(p.x, p.z);
    if (w !== null && p.y <= w - 0.3 && w - g > 1.05) enterWater(w);
    else if (p.y <= g) { p.y = g; p.mode = 'ground'; p.vy = 0; sfx('land'); }
    if (p.y < -18) fallOut();
  } else if (p.mode === 'climb') {
    const n = p.climbN;
    const up = -inp.ry, lat = inp.rx;
    const sp = p.ladder ? 3.4 : 2.1;
    const moving = Math.abs(up) > 0.2 || Math.abs(lat) > 0.2;
    drain = p.ladder ? (moving ? 3.5 : 1) : (moving ? 9 : 2.2);
    // 접선 방향 (카메라 기준 오른쪽을 벽면에 투영)
    let tX = -n.z, tZ = n.x;
    const rx = Math.cos(CAM.yaw), rz = -Math.sin(CAM.yaw);
    if (tX * rx + tZ * rz < 0) { tX = -tX; tZ = -tZ; }
    let nx = p.x + tX * lat * sp * 0.8 * dt, nz = p.z + tZ * lat * sp * 0.8 * dt;
    // 옆으로 갔을 때 벽이 없으면 멈춘다
    if (surfaceAt(nx - n.x * 0.6, nz - n.z * 0.6)[0] < p.y + 0.2) { nx = p.x; nz = p.z; }
    p.x = nx; p.z = nz;
    p.y += up * sp * dt;
    if (control && Input.hit('jump') && p.st > 16) { p.y += 1.6; p.st -= 16; sfx('jump'); FX.burst(p.x, p.y, p.z, 8, 0xffffff, 2, 0.3, 0.12, { add: false }); }
    p.yaw = Math.atan2(-n.x, -n.z);
    // 벽에 붙어 있기
    const [sIn] = surfaceAt(p.x - n.x * 0.55, p.z - n.z * 0.55);
    const [sHere] = surfaceAt(p.x, p.z);
    if (sHere > p.y + 0.05) { p.x += n.x * 0.15; p.z += n.z * 0.15; }
    if (sIn <= p.y + 0.15) {
      // 꼭대기: 올라선다
      const tx = p.x - n.x * 0.9, tz = p.z - n.z * 0.9;
      p.x = tx; p.z = tz; p.y = standHeight(tx, tz, p.y + 1, 1.2); p.mode = 'ground'; sfx('land');
      if (p.climbCol && p.climbCol.tower) { const tw = m.ents.find(e => e.type === 'tower' && e.id === p.climbCol.tower); if (tw && !tw.lit) runScript(() => TALK.towerTop(tw)); }
    } else if (up < -0.2 && p.y <= m.ground(p.x + n.x * 0.5, p.z + n.z * 0.5) + 0.1) {
      p.mode = 'ground'; p.y = standHeight(p.x, p.z, p.y + 1);
    } else if (control && (Input.hit('glide') || (Input.hit('cast') && false))) {
      p.mode = 'air'; p.vx = n.x * 4; p.vz = n.z * 4; p.vy = 2; p.yaw = Math.atan2(n.x, n.z);
    }
    if (p.st <= 0) { p.mode = 'air'; p.vy = 0; p.vx = n.x * 1.5; p.vz = n.z * 1.5; p.fallStart = p.y; toast('힘이 빠져서 떨어진다'); }
  } else if (p.mode === 'swim') {
    const w = m.waterAt(p.x, p.z);
    if (w === null) { p.mode = 'ground'; }
    else {
      const sp = wantRun ? 4.2 : 2.8;
      drain = inp.l > 0.2 ? (wantRun ? 16 : 5) : 0;
      p.vx = lerp(p.vx, inp.x * sp, dt * 4); p.vz = lerp(p.vz, inp.z * sp, dt * 4);
      if (inp.l > 0.15) p.yaw += angDiff(p.yaw, Math.atan2(inp.x, inp.z)) * Math.min(1, dt * 8);
      const nx = p.x + p.vx * dt, nz = p.z + p.vz * dt;
      const g = m.ground(nx, nz);
      if (g < w - 0.6 || g - (w - 0.55) < STEP) { p.x = nx; p.z = nz; }
      pushOut(p, 0.36, 1.7);
      p.y = w - 0.55;
      const gHere = m.ground(p.x, p.z);
      if (gHere > w - 0.75) { p.mode = 'ground'; p.y = gHere; }
      if (Math.random() < 0.2 && inp.l > 0.2) FX.spawn({ x: p.x + rand(-0.4, 0.4), y: w + 0.05, z: p.z + rand(-0.4, 0.4), vy: 0.5, life: 0.6, size: 0.25, c: 0xe8f8ff, add: false, a: 0.6 });
      if (p.st <= 0) { toast('더 헤엄칠 힘이 없다'); respawnSafe(2); }
    }
  }
  // 스태미나
  if (drain > 0) {
    if (G.storm > 0 && regionNow() === 2) drain *= 1.6;
    p.st -= drain * dt;
    if (p.st <= 0) { p.st = 0; p.exhausted = true; if (p.mode === 'glide') { p.mode = 'air'; p.fallStart = p.y; } }
  } else if (p.mode === 'ground') {
    p.st = Math.min(p.maxst, p.st + (p.exhausted ? 24 : 34) * dt);
    if (p.exhausted && p.st > p.maxst * 0.35) p.exhausted = false;
  }
  // 발소리
  const hs = Math.hypot(p.vx, p.vz);
  if (p.mode === 'ground' && hs > 1) { p.stepT -= dt * hs; if (p.stepT <= 0) { p.stepT = 2.2; sfx('step'); } }
}
function moveAxis(dx, dz, inp, air) {
  const p = P;
  if (!dx && !dz) return;
  const nx = p.x + dx, nz = p.z + dz;
  if (air) {
    const g = G.map.ground(nx, nz);
    const col = blockedByCol(nx, nz, p.y);
    if (g > p.y + 0.3 || col) {
      if (inp.l > 0.3 && !(G.map.noSwim && false) && (col ? col.climb : G.map.climbable(nx, nz)) && startClimb(nx, nz, col)) return;
      if (dx) p.vx = 0; if (dz) p.vz = 0;
      return;
    }
    p.x = nx; p.z = nz; return;
  }
  const r = tryStep(nx, nz);
  if (r.ok) { p.x = nx; p.z = nz; return; }
  if (r.water) { if (!p.warnT || G.t > p.warnT) { toast(G.map.current && G.map.current(nx, nz) ? '물살이 세서 들어갈 수 없다' : '마력이 섞인 물이라 몸이 튕겨 나온다'); p.warnT = G.t + 2.5; } return; }
  // 벽: 그쪽으로 밀고 있으면 오른다
  const toward = inp.l > 0.5 && (dx * inp.x + dz * inp.z) > 0;
  if (toward && !p.holding) { p.pushT = (p.pushT || 0) + 0.016; if (p.pushT > 0.12) { p.pushT = 0; startClimb(nx, nz, r.col); } }
}
function enterWater(w) {
  const p = P;
  if (G.map.noSwim || (G.map.current && G.map.current(p.x, p.z))) { toast(G.map.current && G.map.current(p.x, p.z) ? '물살이 세서 들어갈 수 없다' : '마력이 섞인 물이라 몸이 튕겨 나온다'); p.x = p.lastSafe.x; p.z = p.lastSafe.z; p.y = p.lastSafe.y; p.mode = 'ground'; p.vx = p.vz = p.vy = 0; return; }
  if (p.mode !== 'swim') { sfx('splash'); FX.burst(p.x, w, p.z, 20, 0xe8f8ff, 4, 0.6, 0.25, { add: false, grav: 9, up: 2 }); }
  p.mode = 'swim'; p.vy = 0; p.y = w - 0.55;
}
function land(g) {
  const p = P, v = -p.vy;
  p.y = g; p.mode = 'ground'; p.vy = 0;
  sfx('land');
  if (v > 16) {
    const q = v > 30 ? 12 : Math.ceil((v - 16) / 2.6) + 1;
    hurtPlayer(q, p.x, p.z, { noKb: true, force: true });
    toast('높은 데서 떨어졌다');
  }
  if (v > 8) FX.burst(p.x, g + 0.1, p.z, 14, 0xd8d0c0, 3, 0.5, 0.25, { add: false, up: 0.3 });
}
function fallOut() { toast('떨어졌다'); respawnSafe(2); }
function respawnSafe(q) {
  const p = P;
  runScript(async () => {
    G.fadeTo = 1; await wait(0.3);
    p.x = p.lastSafe.x; p.y = p.lastSafe.y; p.z = p.lastSafe.z; p.vx = p.vy = p.vz = 0; p.mode = 'ground';
    p.st = Math.max(p.st, p.maxst * 0.4); p.exhausted = false;
    G.fadeTo = 0;
    hurtPlayer(q, p.x, p.z, { noKb: true, force: true });
  });
}
function regionNow() { return G.map.kind === 'terrain' ? G.map.regionAt(P.x, P.z) : (G.map.region ?? 0); }

// ---------- 피해 ----------
function hurtPlayer(q, fx, fz, o = {}) {
  if ((P.iframes > 0 && !o.force) || (G.lock && !o.force) || G.mode !== 'play') return;
  P.hp -= q;
  if (o.noKill || (G.boss && G.boss.type === 'boss_mask' && !G.boss.dead)) P.hp = Math.max(1, P.hp);
  P.iframes = 0.9; P.flash = 0.3;
  sfx('hurt'); G.shake = Math.max(G.shake, 0.3);
  if (!o.noKb) {
    const dx = P.x - fx, dz = P.z - fz, l = Math.hypot(dx, dz) || 1, k = o.push || 7;
    P.kb = { x: dx / l * k, z: dz / l * k, t: 0.2 };
    if (o.lift && P.mode === 'ground') { P.mode = 'air'; P.vy = o.lift; P.fallStart = P.y; }
  }
  if (P.mode === 'glide') P.mode = 'air';
  if (P.mode === 'climb' && q > 1) { P.mode = 'air'; P.vy = 0; }
  if (P.holding) releaseHold();
  if (P.hp <= 0) gameOver();
}
function gameOver() {
  P.hp = 0;
  runScript(async () => {
    G.fadeTo = 1; await wait(0.7);
    await caption('눈앞이 하얘졌다…', 1.6);
    const cp = G.cp || { map: 'dorm', x: 6, z: 8, meters: true };
    G.boss = null;
    for (const e of G.map.ents) if (e.boss && !e.dead) { e.hp = e.maxhp; e.awake = false; e.x = e.hx; e.z = e.hz; }
    enterMap(cp.map, cp.x, cp.z, true);
    P.hp = P.maxhp; P.st = P.maxst; P.exhausted = false; G.mana = G.maxMana;
    G.fadeTo = 0;
  });
}
function heal(q) { P.hp = Math.min(P.maxhp, P.hp + q); }

// ---------- 상호작용 ----------
function interactTarget() {
  const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw);
  let best = null, bs = 1e9;
  for (const e of G.map.ents) {
    if (!shown(e)) continue;
    const d = ET[e.type];
    if (!d || !d.interact) continue;
    if (d.prompt && !d.prompt(e)) continue;
    const dx = e.x - P.x, dz = e.z - P.z, l = Math.hypot(dx, dz);
    const reach = 2.2 + (e.r > 0.6 ? e.r - 0.4 : 0) + (e.type === 'chair' ? 1.5 : 0);
    if (l > reach || Math.abs((e.fly ? e.y - 1 : e.y) - P.y) > 2.4) continue;
    const dot = l < 0.5 ? 1 : (dx * fx + dz * fz) / l;
    const s = l * (1.6 - dot);
    if (dot < -0.2 && l > 1.2) continue;
    if (s < bs) { bs = s; best = e; }
  }
  return best;
}

// ---------- 아이템 ----------
function give(k, n = 1, quiet) {
  G.inv[k] = (G.inv[k] || 0) + n;
  if (k === 'crystal') { G.crystals = (G.crystals || 0) + n; if (G.crystals >= 4) { G.crystals -= 4; runScript(TALK.crystalUpgrade); } }
  if (!quiet) sfx('pick');
  toast(`${ITEMS[k] ? ITEMS[k].name : k} +${n}`, quiet);
}
function take(k, n = 1) { if ((G.inv[k] || 0) < n) return false; G.inv[k] -= n; if (G.inv[k] <= 0) delete G.inv[k]; return true; }
function giveWeapon(k, quiet) {
  if (G.weapons.length >= 6) { toast('무기를 더 들 수 없다 · 가방에서 버리자'); return; }
  G.weapons.push({ k, d: WEAPONS[k].dur });
  if (G.wi < 0 || WEAPONS[k].dmg > WEAPONS[G.weapons[G.wi].k].dmg) G.wi = G.weapons.length - 1;
  if (!quiet) sfx('pick');
  toast(`무기: ${WEAPONS[k].name}${WEAPONS[k].elem ? ' · ' + ELEM[WEAPONS[k].elem].n : ''}`, quiet);
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
const outdoor = () => !!G.map.outdoor;
function airTemp() {
  const m = G.map;
  let t;
  if (m.kind === 'terrain') {
    const r = m.regionAt(P.x, P.z);
    t = REG[r].temp;
    if (r === 3 && G.f.elm === 'full') t = 1;
    if (r === 2 && G.f.eng_marcella) t = 23;
    if (r === 6 && G.f.westDark) t = -14;
    if (r === 4 || r === 5) t -= Math.max(0, (P.y - 12) * 0.35);
    if ((r === 0 || r === 1) && G.f.grav === 'pump' && dist(P.x, P.z, PLACES.kalidorGate[0], PLACES.kalidorGate[1]) < 170) t -= 10;
  } else {
    t = m.temp;
    if ((m.id === 'kalidor' || m.id === 'hall') && G.f.tremor && !G.f.ch1engine) t = 6;
  }
  if (outdoor()) t -= G.night * 6;
  return Math.round(t);
}
function feltTemp() {
  let t = airTemp();
  for (const e of G.map.ents) if (e.type === 'fire' && Math.hypot(e.x - P.x, e.z - P.z) < 4.5) { t += 18; break; }
  if (G.torch && (G.map.dark || G.night > 0.5)) t += 5;
  return t;
}
function updateCold(dt) {
  if (G.warmT > 0) G.warmT -= dt;
  if (G.lock) return;
  const prot = (G.f.furcoat ? 14 : 0) + (G.warmT > 0 ? 12 : 0);
  G.coldDef = 5 - (feltTemp() + prot);
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
  if (m.kind !== 'terrain') { const c = m.ents.find(e => (e.type === 'core' || e.type === 'chair') && shown(e)); return c ? { x: c.x, z: c.z } : null; }
  const list = [];
  if (!G.f.eng_marcella) list.push(PLACES.cathedral);
  if (!G.f.eng_elm) list.push(PLACES.clock);
  if (!G.f.eng_grav) list.push(PLACES.mine);
  if (G.f.summons && !G.f.primaStop) list.push(PLACES.prima);
  let best = null, bd = 1e9;
  for (const [x, z] of list) { const d = dist(x, z, P.x, P.z); if (d < bd) { bd = d; best = { x, z }; } }
  return best;
}
function updateResonance(dt) {
  if (!G.f.stone || G.f.stoneSilent) { G.res = null; return; }
  const t = resonanceTarget();
  if (!t) { G.res = null; return; }
  const d = dist(t.x, t.z, P.x, P.z);
  const k = 1 - clamp(d / (G.map.kind === 'terrain' ? 560 : 60), 0, 1);
  const f = G.heartSync !== undefined ? lerp(0.9, 1.4, G.heartSync) : lerp(0.45, 2.8, k * k);
  const prev = G.resPh;
  G.resPh += dt * f;
  if (Math.floor(G.resPh) !== Math.floor(prev) && (k > 0.25 || G.heartSync !== undefined)) { sfx('beat'); try { if (navigator.vibrate && k > 0.6) navigator.vibrate(25); } catch (e) { } }
  G.res = { x: t.x, z: t.z, d, k, ph: G.resPh % 1 };
}

// ---------- 지역, 날씨, 안개 ----------
function updateWorldFx(dt) {
  const m = G.map;
  if (m.kind !== 'terrain') { G.storm = 0; return; }
  const r = m.regionAt(P.x, P.z);
  if (r !== G.region && r !== 7) {
    G.region = r;
    if (G.lastBanner !== r) { G.lastBanner = r; banner(REG[r].name); if (TALK.region) TALK.region(r); }
  }
  if (r === 2 && !G.f.eng_marcella) {
    G.stormCd -= dt;
    if (G.storm > 0) G.storm -= dt;
    else if (G.stormCd <= 0) { G.stormCd = rand(70, 120); G.storm = 18; toast('소금 폭풍이 분다 · 스태미나가 빨리 닳는다'); }
  } else G.storm = Math.max(0, G.storm - dt);
  revealFog(P.x, P.z, 34);
}
const FOG_C = 4, FOG_W = WORLD_W / FOG_C, FOG_H = WORLD_D / FOG_C;
function revealFog(cx, cz, r) {
  if (!G.fog) return;
  const R = r / FOG_C, gx = cx / FOG_C, gz = cz / FOG_C;
  for (let y = Math.floor(gz - R); y <= gz + R; y++) for (let x = Math.floor(gx - R); x <= gx + R; x++) {
    if (x < 0 || y < 0 || x >= FOG_W || y >= FOG_H) continue;
    if ((x - gx) ** 2 + (y - gz) ** 2 <= R * R) G.fog[y * FOG_W + x] = 1;
  }
}
function weatherFx(dt) {
  const m = G.map, r = regionNow();
  const cx = CAM.tx, cy = CAM.ty, cz = CAM.tz;
  const snow = (m.kind === 'terrain' && (r === 4 || r === 5 || (r === 3 && G.f.elm === 'full') || (r === 6 && G.f.westDark))) || m.id === 'prima';
  if (snow) for (let i = 0; i < (r === 5 ? 9 : 4); i++) FX.spawn({ x: cx + rand(-25, 25), y: cy + rand(6, 16), z: cz + rand(-25, 25), vx: r === 5 ? rand(2, 5) : rand(-0.5, 0.5), vy: -rand(1.5, 3), vz: rand(-0.5, 0.5), life: 6, size: 0.12, c: 0xffffff, add: false, drag: 0, shrink: false, a: 0.85 });
  if (G.storm > 0 && r === 2) for (let i = 0; i < 10; i++) FX.spawn({ x: cx + rand(-25, 5), y: cy + rand(-1, 6), z: cz + rand(-25, 25), vx: 24, vy: 0, vz: rand(-2, 2), life: 1.6, size: 0.12, c: 0xffffff, add: false, drag: 0, shrink: false, a: 0.6 });
  if (G.rain > 0) { G.rain -= dt; for (let i = 0; i < 18; i++) FX.spawn({ x: cx + rand(-20, 20), y: cy + rand(8, 14), z: cz + rand(-20, 20), vy: -30, life: 0.6, size: 0.08, c: 0xbfe6ff, add: false, drag: 0, shrink: false }); }
  if (m.kind === 'terrain' && G.night > 0.6 && (r === 0 || r === 3) && Math.random() < 0.3) FX.spawn({ x: cx + rand(-18, 18), y: m.ground(cx, cz) + rand(0.4, 2.5), z: cz + rand(-18, 18), vx: rand(-0.4, 0.4), vy: rand(-0.2, 0.2), vz: rand(-0.4, 0.4), life: 3, size: 0.12, c: 0xd8ff8a, drag: 0 });
  if ((m.id === 'kalidor' || m.id === 'hall') && G.f.tremor && !G.f.ch1engine) for (let i = 0; i < (m.id === 'hall' ? 6 : 2); i++) FX.spawn({ x: cx + rand(-16, 16), y: cy + rand(4, 9), z: cz + rand(-16, 16), vy: -1.5, vx: rand(-0.3, 0.3), life: 5, size: 0.12, c: 0xffffff, add: false, drag: 0, shrink: false });
  if (m.kind === 'blocks' && !m.outdoor && Math.random() < 0.4) FX.spawn({ x: cx + rand(-10, 10), y: cy + rand(0, 4), z: cz + rand(-10, 10), vy: rand(-0.05, 0.05), vx: rand(-0.1, 0.1), life: 4, size: 0.06, c: m.trim || 0xffe8c0, drag: 0, a: 0.5 });
}

// ======================================================================
// 메인 루프
// ======================================================================
let lastT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - lastT) / 1000 || 0.016);
  lastT = now;
  G.t += dt; GFX.t = G.t; GFX.timeU.value = G.t;
  try { step(dt); render(dt); } catch (e) { console.error(e); }
  Input.endFrame();
}
function step(dt) {
  for (let i = Timers.length - 1; i >= 0; i--) { const tm = Timers[i]; tm.t -= dt; if (tm.t <= 0) { Timers.splice(i, 1); tm.fn(); } }
  G.fade = lerp(G.fade, G.fadeTo, Math.min(1, dt * 8));
  if (Math.abs(G.fade - G.fadeTo) < 0.01) G.fade = G.fadeTo;
  UI.update(dt);
  if (G.mode !== 'play' || !G.map) return;
  if (UI.modal) return;
  G.playT += dt;
  if (G.mapCool > 0) G.mapCool -= dt;
  G.shake = Math.max(0, G.shake - dt);
  if (G.rainbow > 0) G.rainbow -= dt * 0.05;
  updateClock(dt);
  updateCamera(dt);
  if (!G.lock) {
    if (Input.hit('attack')) meleeAttack();
    if (Input.hit('act')) { const e = interactTarget(); if (e) ET[e.type].interact(e); }
    if (Input.hit('rune')) useRune();
    if (Input.hit('r1')) selectRune('magnes'); if (Input.hit('r2')) selectRune('stasis'); if (Input.hit('r3')) selectRune('cryo'); if (Input.hit('r4')) selectRune('burst');
    if (Input.hit('runeNext')) cycleRune();
    if (Input.hit('menu')) UI.openMenu();
    if (Input.hit('map')) UI.openMap();
    if (Input.hit('eat')) quickEat();
  }
  updateCasting(dt);
  // 움직이는 충돌체
  G.dynCols.length = 0;
  for (const e of G.map.ents) { if (!shown(e)) continue; const d = ET[e.type]; if (d && d.col) { const c = d.col(e); if (c) { c.ent = e; G.dynCols.push(c); } } }
  updatePlayer(dt);
  updateHold(dt);
  const m = G.map, far = m.kind === 'terrain' ? 110 : m.kind === 'site' ? 170 : 1e9;
  for (const e of m.ents) {
    if (!shown(e)) continue;
    const d = ET[e.type];
    if (!d || !d.update) continue;
    if (far < 1e8 && Math.abs(e.x - P.x) > far && Math.abs(e.z - P.z) > far && !e.boss && e.type !== 'tower') continue;
    d.update(e, dt);
  }
  if (m.ents.some(e => e.dead && TEMP_T.has(e.type))) m.ents = m.ents.filter(e => !(e.dead && TEMP_T.has(e.type)));
  updateMana(dt);
  updateCold(dt);
  updateResonance(dt);
  updateWorldFx(dt);
  weatherFx(dt);
  if (TALK.tick) TALK.tick(dt);
  G.saveT = (G.saveT || 0) + dt;
  if (G.saveT > 30 && !G.lock) { G.saveT = 0; saveGame(); }
}
const TEMP_T = new Set(['proj', 'warn', 'ring', 'bomb', 'bolt', 'wavefx', 'boomfx', 'stasisfx', 'icepillar']);

// ---------- 카메라 ----------
function updateCamera(dt) {
  const ctrl = G.mode === 'play' && !UI.modal && !UI.choice;
  if (ctrl) {
    CAM.yaw -= Input.look.x * 0.0042;
    CAM.pitch = clamp(CAM.pitch + Input.look.y * 0.0034, -0.35, 1.25);
    if (Input.key('camL')) CAM.yaw += 2.2 * dt;
    if (Input.key('camR')) CAM.yaw -= 2.2 * dt;
    if (Input.wheel && !P.holding) CAM.dist = clamp(CAM.dist + Input.wheel * 0.5, 2.4, 14);
    // 활공 중에는 뒤로 천천히 따라간다
    if (P.mode === 'glide') CAM.yaw += angDiff(CAM.yaw, P.yaw + Math.PI) * dt * 1.2;
  }
}
function placeCamera(dt) {
  const cam = GFX.camera;
  const inside = !G.map.outdoor;
  let tx = P.x, ty = P.vis + 1.55, tz = P.z, dist_ = inside ? Math.min(CAM.dist, 3.0) : CAM.dist, pitch = CAM.pitch, yaw = CAM.yaw;
  if (P.mode === 'swim') ty = P.y + 1.1;
  // 오르기·활공·싸움에서는 붐을 늘린다
  if (P.mode === 'climb' || P.mode === 'glide') dist_ += 1.2;
  if (G.boss) dist_ += 1.0;
  if (G.camT) { tx = G.camT.x; tz = G.camT.z; ty = (G.camT.y ?? G.map.ground(tx, tz)) + 1.5; dist_ = G.camT.dist || 14; pitch = G.camT.pitch ?? 0.45; if (G.camT.yaw !== undefined) yaw = G.camT.yaw; }
  const k = CAM.init ? Math.min(1, dt * (G.camT ? 2 : 10)) : 1;
  CAM.tx = lerp(CAM.tx, tx, k); CAM.tz = lerp(CAM.tz, tz, k); CAM.ty = lerp(CAM.ty, ty, CAM.init ? Math.min(1, dt * (G.camT ? 2 : 6)) : 1);
  CAM.cy = CAM.init ? CAM.cy + angDiff(CAM.cy, yaw) * k : yaw; CAM.cp = CAM.init ? lerp(CAM.cp, pitch, k) : pitch; CAM.cd = CAM.init ? lerp(CAM.cd, dist_, k) : dist_;
  CAM.init = true;
  // 어깨 너머: 피벗과 카메라를 함께 오른쪽으로 민다 (연출 카메라일 때는 빼고)
  const side = G.camT ? 0 : CAM.side * clamp(CAM.cd / 4, 0.5, 1.2);
  CAM.sideK = lerp(CAM.sideK ?? side, side, Math.min(1, dt * 4));
  const rx = Math.cos(CAM.cy) * CAM.sideK, rz = -Math.sin(CAM.cy) * CAM.sideK;
  let px = CAM.tx + rx, pz = CAM.tz + rz;
  // 어깨 쪽이 벽에 막히면 가운데로
  if (camClip(CAM.tx, CAM.ty, CAM.tz, px, CAM.ty, pz) < 1) { px = CAM.tx; pz = CAM.tz; }
  let cx = px + Math.sin(CAM.cy) * Math.cos(CAM.cp) * CAM.cd, cz = pz + Math.cos(CAM.cy) * Math.cos(CAM.cp) * CAM.cd, cy = CAM.ty + Math.sin(CAM.cp) * CAM.cd;
  const clip = camClip(px, CAM.ty, pz, cx, cy, cz);
  cx = lerp(px, cx, clip); cy = lerp(CAM.ty, cy, clip); cz = lerp(pz, cz, clip);
  // 화각: 바깥 48°, 안 50°, 달리면 +4°
  const fov = (inside ? 50 : CAM.fov) + (Math.hypot(P.vx, P.vz) > 7 ? 4 : 0) + (G.camT ? 4 : 0);
  if (Math.abs(cam.fov - fov) > 0.05) { cam.fov = lerp(cam.fov, fov, Math.min(1, dt * 3)); cam.updateProjectionMatrix(); }
  if (G.map.ceil) cy = Math.min(cy, G.map.ceil - 0.4);
  cy = Math.max(cy, G.map.ground(cx, cz) + 0.3);
  if (G.shake > 0) { cx += rand(-1, 1) * G.shake * 0.25; cy += rand(-1, 1) * G.shake * 0.25; }
  if (G.cine) { cx = G.cine.x; cy = G.cine.y; cz = G.cine.z; }
  cam.position.set(cx, cy, cz);
  if (G.cine) cam.lookAt(G.cine.lx, G.cine.ly, G.cine.lz); else cam.lookAt(px, CAM.ty, pz);
}

// ======================================================================
// 렌더링
// ======================================================================
const _lightCand = [];
function render(dt) {
  if (!G.map) { GFX.renderer.render(GFX.scene, GFX.camera); UI.drawHUD(); return; }
  const m = G.map;
  // 플레이어 모습
  if (!P.obj) { P.obj = makeRig(REN_LOOK(), { rod: true, glider: true }); GFX.dyn.add(P.obj); P.lookKey = JSON.stringify(REN_LOOK()); }
  if (P.lookKey !== JSON.stringify(REN_LOOK())) { GFX.dyn.remove(P.obj); P.obj = null; return; }
  P.vis = Math.abs(P.vis - P.y) > 2 ? P.y : lerp(P.vis, P.y, Math.min(1, dt * 18));
  P.obj.position.set(P.x, P.mode === 'climb' || P.mode === 'air' || P.mode === 'glide' || P.mode === 'swim' ? P.y : P.vis, P.z);
  P.obj.rotation.y = P.yaw;
  const hs = Math.hypot(P.vx, P.vz);
  const mode = P.mode === 'ground' ? (hs > 6 ? 'run' : hs > 0.6 ? 'walk' : 'idle') : P.mode === 'air' ? 'fall' : P.mode;
  animRig(P.obj, { mode, atk: P.atkT, cast: P.casting > 0 ? 1 : P.castAnim > 0 ? 0.6 : 0 }, dt);
  P.obj.visible = !(P.iframes > 0 && Math.sin(G.t * 40) > 0.5);
  if (P.obj.rod) { P.obj.rod.tip.scale.setScalar(1 + (P.casting > 0 ? Math.min(1, P.casting) * 1.5 : 0) + Math.sin(G.t * 5) * 0.1); }
  // 엔티티 모습
  GFX.labels.length = 0;
  const far = m.kind === 'terrain' ? 130 : m.kind === 'site' ? 190 : 1e9;
  _lightCand.length = 0;
  for (const e of m.ents) {
    const vis = shown(e) && Math.abs(e.x - CAM.tx) < far && Math.abs(e.z - CAM.tz) < far;
    const d = ET[e.type];
    if (!d) continue;
    if (!vis) { if (e.obj) e.obj.visible = false; continue; }
    if (!e.obj && d.model) { e.obj = d.model(e); GFX.dyn.add(e.obj); }
    if (e.obj) {
      e.obj.visible = true;
      e.obj.position.set(e.x, e.y, e.z);
      if (!e.noYaw && e.yaw) e.obj.rotation.y = e.yaw;
      if (d.sync) d.sync(e, e.obj, dt);
    }
    if (e.light) _lightCand.push(e);
  }
  // 정적 애니메이션
  if (m.anims) for (const a of m.anims) a(G.t);
  if (m.kind === 'terrain' && m.tideMesh) { m.tideMesh.visible = !!G.f.eng_marcella; m.tideMesh.position.y = tideLevel(); }
  if (m.floodMeshes) for (const fm of m.floodMeshes) { fm.position.y = m.flood ? m.floodHi : m.floodLo; fm.visible = m.flood; }
  GFX.waterN.offset.set(G.t * 0.02, G.t * 0.013);
  // 빛 풀: 가까운 8개
  const lx = CAM.tx, lz = CAM.tz;
  _lightCand.sort((a, b) => Math.hypot(a.x - lx, a.z - lz) - Math.hypot(b.x - lx, b.z - lz));
  for (let i = 0; i < GFX.pool.length; i++) {
    const L_ = GFX.pool[i], e = _lightCand[i];
    if (e && Math.hypot(e.x - lx, e.z - lz) < 50) {
      const f = e.type === 'fire' ? 0.85 + Math.sin(G.t * 13 + e.x) * 0.1 + Math.random() * 0.08 : 1;
      L_.position.set(e.x, e.y + (e.light.h || 1), e.z); L_.color.setHex(e.light.c); L_.intensity = e.light.k * f * (m.outdoor ? 0.5 + G.night * 1.2 : 1.4); L_.distance = e.light.d || 12;
    } else L_.intensity = 0;
  }
  if (G.flash) { const L_ = GFX.pool[GFX.pool.length - 1]; L_.position.set(G.flash.x, G.flash.y, G.flash.z); L_.color.setHex(G.flash.c); L_.intensity = G.flash.k * (G.flash.t / 0.4); L_.distance = 20; G.flash.t -= dt; if (G.flash.t <= 0) G.flash = null; }
  // 공명봉 불빛
  const tip = rodTip();
  GFX.rodLight.position.copy(tip);
  const darkish = m.dark || (!m.outdoor && m.kind === 'blocks') || (m.outdoor && G.night > 0.5);
  GFX.rodLight.intensity = (darkish ? (G.torch && m.dark ? 2.4 : 1.2) : 0.3) + (P.casting > 0 ? 1.5 : 0);
  GFX.rodLight.distance = m.dark ? (G.torch ? 16 : 9) : 10;
  GFX.rodLight.color.setHex(m.dark && G.torch ? 0xffb870 : 0x9ff4ff);
  // 하늘, 해, 안개
  const r = regionNow();
  if (m.outdoor) {
    const haze = { 2: [0xf4f0e8, 0.35], 3: [0xe8b880, 0.3], 4: [0xdfe8f0, 0.4], 5: [0xe8eef8, 0.6], 6: [G.f.westDark ? 0x9aa8b8 : 0xc8e0e8, 0.3] }[r];
    const glare = r === 2 && !G.f.eng_marcella && G.time / 60 > 11 && G.time / 60 < 15;
    updateSky({ hour: G.time / 60, night: G.night, haze: haze && haze[0], hazeK: haze && haze[1], fog: m.kind === 'terrain' ? (r === 5 ? 0.0065 : r === 4 ? 0.0048 : 0.0024) + (G.storm > 0 ? 0.012 : 0) : m.kind === 'site' ? 0.0011 : 0.0028, aurora: r === 5 || r === 4 ? 1 : 0.3, sunK: glare ? 1.5 : 1 });
    if (GFX.finalU) GFX.finalU.exposure.value = lerp(GFX.finalU.exposure.value, glare ? 1.35 : 0.82, dt);
  } else {
    updateSky({ indoor: true, bg: m.bg || 0x07060c, fog: m.dark ? 0.06 : m.indoor ? 0.012 : 0.022, sun: m.dark ? 0.0 : 0.25, hemi: m.dark ? 0.06 : (m.indoor ? 0.55 : 0.35), amb: m.dark ? 0.02 : 0.15, hemiC: m.indoor ? 0xffe0c0 : 0x8090c0 });
    if (GFX.finalU) GFX.finalU.exposure.value = 0.9;
  }
  const sd = GFX.skyU.sunDir.value;
  GFX.sun.position.set(P.x + sd.x * 90, P.y + sd.y * 90, P.z + sd.z * 90); GFX.sun.target.position.set(P.x, P.y, P.z); GFX.sun.target.updateMatrixWorld();
  GFX.sky.position.copy(GFX.camera.position);
  updateGrass(P.x, P.z);
  GFX.fx.update(dt);
  placeCamera(dt);
  if (GFX.finalU) { GFX.finalU.tint.value.setRGB(1, 1, 1); if (G.coldDef > 0) GFX.finalU.tint.value.setRGB(0.92, 0.97, 1.08); }
  if (GFX.composer) GFX.composer.render(); else GFX.renderer.render(GFX.scene, GFX.camera);
  UI.drawHUD();
}

// ---------- 저장 ----------
const SAVE_KEY = 'asteria-part1-3d-save';
function saveData() {
  let fogc = '';
  if (G.fog) { const c = []; for (let y = 0; y < FOG_H; y += 2) for (let x = 0; x < FOG_W; x += 2) c.push(G.fog[y * FOG_W + x] ? 1 : 0); fogc = c.join(''); }
  return {
    v: 1, f: G.f, done: G.done, inv: G.inv, weapons: G.weapons, wi: G.wi, coins: G.coins, runes: G.runes, rune: G.rune,
    journal: G.journal, letters: G.letters, obj: G.obj, map: G.map ? G.map.id : 'dorm', x: P ? P.x : 6, z: P ? P.z : 8,
    hp: P ? P.hp : 12, maxhp: P ? P.maxhp : 12, maxst: P ? P.maxst : 100, maxMana: G.maxMana, time: G.time, playT: G.playT, rings: G.rings, ringsMesh: G.ringsMesh,
    torch: G.torch, crystals: G.crystals, fogc, cp: G.cp, warmT: G.warmT, cam: CAM.yaw,
  };
}
function saveGame() {
  if (G.mode !== 'play' || G.noSave || !G.map) return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(saveData())); } catch (e) { }
}
function loadSave() { try { const s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
async function applySave(d) {
  Object.assign(G, { f: d.f || {}, done: d.done || {}, inv: d.inv || {}, weapons: d.weapons || [], wi: d.wi ?? -1, coins: d.coins || 0, runes: d.runes || {}, rune: d.rune || 'magnes', journal: d.journal || [], letters: d.letters || [], obj: d.obj || '', time: d.time ?? 540, playT: d.playT || 0, rings: d.rings || null, ringsMesh: d.ringsMesh ?? true, torch: !!d.torch, crystals: d.crystals || 0, cp: d.cp, warmT: d.warmT || 0, maxMana: d.maxMana || 100, mana: d.maxMana || 100 });
  G.maps = {};
  G.fog = new Uint8Array(FOG_W * FOG_H);
  if (d.fogc) { let i = 0; for (let y = 0; y < FOG_H; y += 2) for (let x = 0; x < FOG_W; x += 2) { if (d.fogc[i++] === '1') for (let oy = 0; oy < 2; oy++) for (let ox = 0; ox < 2; ox++) if (y + oy < FOG_H && x + ox < FOG_W) G.fog[(y + oy) * FOG_W + x + ox] = 1; } }
  P = newPlayer(d.x, 0, d.z);
  P.hp = d.hp > 0 ? d.hp : d.maxhp; P.maxhp = d.maxhp; P.maxst = d.maxst; P.st = P.maxst;
  CAM.yaw = d.cam || 0;
  G.mode = 'play';
  await showLoading(mapTitle(d.map), '이어하기');
  enterMap(d.map, d.x, d.z, true);
  hideLoading();
}
async function newGame() {
  Object.assign(G, { f: {}, done: {}, inv: {}, weapons: [], wi: -1, coins: 0, runes: {}, rune: 'magnes', journal: [], letters: [], obj: '', time: 7 * 60 + 40, playT: 0, rings: null, ringsMesh: true, torch: false, crystals: 0, maps: { world: G.maps.world }, warmT: 0, mana: 100, maxMana: 100 });
  G.fog = new Uint8Array(FOG_W * FOG_H);
  P = newPlayer(0, 0, 0);
  G.mode = 'play';
  await showLoading('칼리도르 학원', '1장 · 식어가는 도시');
  enterMap('kalidor', 'court');
  hideLoading();
  runScript(TALK.opening);
}

// ---------- 시작 ----------
async function boot(data) {
  initGfx();
  setupPointer();
  setupTouch();
  UI.init();
  requestAnimationFrame(frame);
  // 타이틀 뒤로 대륙을 미리 그려 둔다
  await showLoading('아스테리아', '대륙을 그리는 중');
  try {
    G.maps.world = buildWorld();
    titleScene();
  } catch (e) { console.error(e); }
  hideLoading();
  if (data && data.save) { $('title').hidden = true; await applySave(data.save); UI.showTouch(); }
}
// 타이틀 화면: 해 질 녘 칼리도르 위를 천천히 도는 카메라
function titleScene() {
  const m = G.maps.world;
  G.map = m; P = P || newPlayer(...PLACES.kalidorGate, 0);
  GFX.static.clear(); GFX.static.add(m.group);
  G.time = 17.6 * 60; G.night = 0.2;
  G.titleCam = true;
}
function titleTick(dt) {
  if (G.mode !== 'title' || !G.titleCam) return;
  const m = G.map, a = G.t * 0.03;
  const cx = PLACES.kalidorGate[0], cz = PLACES.kalidorGate[1] - 60;
  G.cine = { x: cx + Math.cos(a) * 140, y: m.ground(cx, cz) + 70, z: cz + Math.sin(a) * 140, lx: cx, ly: m.ground(cx, cz) + 20, lz: cz };
  for (const an of m.anims) an(G.t);
  updateSky({ hour: 17.4, night: 0.1, fog: 0.0022, aurora: 0.3 });
  GFX.sky.position.copy(GFX.camera.position);
  GFX.camera.position.set(G.cine.x, G.cine.y, G.cine.z); GFX.camera.lookAt(G.cine.lx, G.cine.ly, G.cine.lz);
  GFX.sun.position.set(cx + 60, 120, cz + 30); GFX.sun.target.position.set(cx, 0, cz); GFX.sun.target.updateMatrixWorld();
  GFX.fx.update(dt);
  if (GFX.composer) GFX.composer.render(); else GFX.renderer.render(GFX.scene, GFX.camera);
}
// 타이틀 화면에서는 렌더 대신 타이틀 카메라
const _render0 = render;
render = function (dt) { if (G.mode === 'title') { titleTick(dt); UI.drawHUD(); return; } G.cine = G.cineKeep || null; _render0(dt); };

if (window.claude && window.claude.hot && window.claude.hot.snapshot) {
  try { window.claude.hot.snapshot(() => (G.mode === 'play' ? { save: saveData() } : {})); } catch (e) { }
}
window.__asteria = { G, get P() { return P; }, goMap, enterMap, give, giveWeapon, CAM, GFX, TALK: () => TALK,
  // 시험용: 화면을 그리지 않고 시간만 빨리 돌린다
  sim(sec) { for (let t = 0; t < sec; t += 0.05) { G.t += 0.05; GFX.t = G.t; step(0.05); Input.endFrame(); } } };
window.claude?.hot?.ready ? window.claude.hot.ready(boot) : boot(window.claude?.hot?.data ?? {});
