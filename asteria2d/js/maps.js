// 아스테리아 1부 — 지도 (학원, 대륙, 기관 던전, 봉인 실험실)
'use strict';

T.POOL = 39; // 수위에 따라 잔잔한 물이 되는 바닥
td(T.POOL, { c: '#c9b48e' });

function M(id, w, h, fill, o = {}) {
  return Object.assign({ id, w, h, tiles: new Uint8Array(w * h).fill(fill), ents: [], name: '', temp: 16, dark: false, ice: new Map(), flood: false, noSwim: false, oob: T.WALL }, o);
}
function S(m, x, y, t) { if (x >= 0 && y >= 0 && x < m.w && y < m.h) m.tiles[y * m.w + x] = t; }
function Gt(m, x, y) { return (x >= 0 && y >= 0 && x < m.w && y < m.h) ? m.tiles[y * m.w + x] : -1; }
function R(m, x, y, w, h, t) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) S(m, i, j, t); }
function room(m, x, y, w, h, floor = T.FLOOR, wall = T.WALL) { R(m, x, y, w, h, wall); R(m, x + 1, y + 1, w - 2, h - 2, floor); }
function add(m, type, x, y, props = {}) {
  props.id = props.id || `${m.id}:${type}:${x},${y}`;
  const e = makeEnt(type, x, y, props);
  m.ents.push(e); return e;
}
function disc(m, cx, cy, r, t, only) {
  for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
    if (dist(x, y, cx, cy) <= r && (!only || only.includes(Gt(m, x, y)))) S(m, x, y, t);
  }
}
// 두께 있는 꺾은선. 물 위에서는 다리로 바꾼다
function road(m, pts, t, w = 1, overWater = T.BRIDGE, skip) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    const n = Math.ceil(Math.hypot(bx - ax, by - ay) * 2);
    for (let k = 0; k <= n; k++) {
      const x = lerp(ax, bx, k / n), y = lerp(ay, by, k / n);
      for (let oy = -w; oy <= w; oy++) for (let ox = -w; ox <= w; ox++) {
        if (ox * ox + oy * oy > w * w + 0.5) continue;
        const tx = Math.round(x + ox), ty = Math.round(y + oy), cur = Gt(m, tx, ty);
        if (cur < 0 || (skip && skip.includes(cur))) continue;
        if (TD[cur].deep || cur === T.SHALLOW) { if (overWater !== null) S(m, tx, ty, overWater); }
        else S(m, tx, ty, t);
      }
    }
  }
}

// ======================================================================
// 칼리도르 학원 (1장)
// ======================================================================
function buildKalidor() {
  const m = M('kalidor', 64, 48, T.GRASS, { name: '칼리도르 학원', temp: 18, region: 1 });
  R(m, 0, 0, 64, 1, T.WALL); R(m, 0, 47, 64, 1, T.WALL); R(m, 0, 0, 1, 48, T.WALL); R(m, 63, 0, 1, 48, T.WALL);
  // 나무와 화단
  for (let x = 2; x < 62; x += 3) { if (x < 28 || x > 35) { S(m, x, 1, T.TREE); } }
  // 대로와 광장
  R(m, 30, 0, 4, 20, T.PATH);
  disc(m, 32, 26, 7.3, T.PLAZA);
  R(m, 12, 17, 40, 2, T.PATH);   // 북쪽 길
  R(m, 11, 19, 2, 11, T.PATH);   // 기숙사 길
  R(m, 13, 26, 13, 2, T.PATH);   // 서쪽 길
  R(m, 38, 25, 9, 2, T.PATH);    // 연구실 길
  R(m, 38, 30, 14, 2, T.PATH); R(m, 50, 30, 2, 3, T.PATH); // 부엌 길
  // 기록보관소 (북서)
  room(m, 3, 3, 20, 14, T.FLOOR);
  S(m, 12, 16, T.FLOOR); S(m, 13, 16, T.FLOOR);
  R(m, 4, 12, 18, 1, T.SHELF);                 // 넘어야 하는 서가
  R(m, 6, 9, 16, 1, T.SHELF);                  // 왼쪽 끝에 틈
  R(m, 4, 6, 16, 1, T.SHELF);                  // 오른쪽 끝에 틈
  // 대강당 (북동)
  room(m, 41, 3, 20, 14, T.CARPET);
  S(m, 50, 16, T.CARPET); S(m, 51, 16, T.CARPET);
  // 오스윈 연구실 (동)
  room(m, 47, 20, 14, 10, T.FLOOR);
  S(m, 47, 25, T.FLOOR); S(m, 47, 26, T.FLOOR);
  // 부엌과 식당 (남동)
  room(m, 41, 33, 20, 12, T.FLOOR);
  S(m, 50, 33, T.FLOOR); S(m, 51, 33, T.FLOOR);
  // 기숙사 (남서)
  room(m, 3, 30, 18, 15, T.FLOOR);
  S(m, 11, 30, T.FLOOR); S(m, 12, 30, T.FLOOR);
  // 지붕을 탈 수 있는 상가 두 채
  R(m, 23, 5, 6, 8, T.ROOF); R(m, 23, 12, 6, 1, T.IVY);
  R(m, 35, 5, 6, 8, T.ROOF); R(m, 35, 12, 6, 1, T.IVY);
  // 미라의 실험 마당 울타리
  R(m, 14, 20, 10, 1, T.FENCE); R(m, 14, 24, 4, 1, T.FENCE); R(m, 20, 24, 4, 1, T.FENCE);
  for (const [x, y] of [[26, 34], [38, 34], [25, 20], [39, 20], [8, 20], [57, 18], [24, 40], [34, 42], [16, 46 - 2]]) S(m, x, y, T.TREE);

  // 장식
  add(m, 'fountain', 32, 26, { exact: false });
  m.ents[m.ents.length - 1].x = 32; m.ents[m.ents.length - 1].y = 26;
  add(m, 'whale', 32, 26);
  for (const [x, y] of [[26, 21], [38, 21], [26, 31], [38, 31], [31, 14], [34, 14], [12, 22], [50, 28]]) add(m, 'deco', x, y, { kind: 'lamp' });
  for (const [x, y] of [[27, 24], [37, 28], [21, 28], [44, 19]]) add(m, 'deco', x, y, { kind: 'flowerbed' });
  add(m, 'deco', 29, 33, { kind: 'bench' }); add(m, 'deco', 35, 33, { kind: 'bench' });
  add(m, 'deco', 32, 10, { kind: 'statue' });
  add(m, 'deco', 27, 15, { kind: 'stall', c: '#5a9ae8' }); add(m, 'deco', 37, 15, { kind: 'stall', c: '#e8a83a' });
  // 기록보관소
  add(m, 'deco', 16, 4, { kind: 'table' });
  add(m, 'npc', 11, 4, { name: '기록관 베르타', talk: 'berta', look: { cloak: '#6a4a8a', hair: '#9a9a9a', body: '#e8e0cf' } });
  add(m, 'collect', 17, 4, { key: 'manuscript', show: () => G.f.delivered });
  // 대강당
  add(m, 'deco', 50, 8, { kind: 'table', cups: true }); add(m, 'deco', 46, 8, { kind: 'table' }); add(m, 'deco', 54, 8, { kind: 'table' });
  add(m, 'npc', 50, 5, { name: '의장 알드릭', talk: 'aldric', look: { cloak: '#8a2a3a', hair: '#ddd', body: '#f0e6d0', hat: '#5a1a2a' } });
  add(m, 'collect', 56, 6, { key: 'roster', show: () => G.f.council });
  add(m, 'trigger', 50, 14, { w: 4, h: 2, cond: () => G.f.ch1engine && !G.f.council, onEnter: () => runScript(TALK.council) });
  add(m, 'npc', 36, 29, { name: '재봉사 넬', talk: 'tailor', shop: 'tailor', look: { cloak: '#c86a8a', hair: '#3a2a2a' }, show: () => G.f.council });
  add(m, 'npc', 44, 12, { name: '견습생 율', talk: 'student', look: { cloak: '#3b6ea8', hair: '#d8a050' }, wander: 2 });
  // 오스윈 연구실
  add(m, 'deco', 53, 23, { kind: 'table', cups: true });
  add(m, 'npc', 55, 22, { name: '오스윈', talk: 'oswin', look: OSWIN_LOOK, show: () => G.f.oswinInLab !== false });
  add(m, 'warp', 58, 27, { look: 'stairs', to: 'under', tx: 4, ty: 14, cond: () => G.f.toUnder, locked: '계단 아래는 기관 회랑이다. 허락 없이는 내려갈 수 없다.', label: '지하 회랑' });
  add(m, 'deco', 59, 21, { kind: 'barrel' });
  // 부엌
  add(m, 'fire', 57, 35, { look: 'hearth' });
  add(m, 'forage', 43, 35, { item: 'pantry', give: [['carrot', 1], ['potato', 1], ['herb', 1]], regrow: 40 });
  for (const [x, y] of [[46, 39], [52, 39], [56, 41]]) add(m, 'deco', x, y, { kind: 'table', bread: true });
  add(m, 'npc', 53, 36, { name: '요리장 토마', talk: 'toma', look: { cloak: '#e8e0cf', body: '#fff', hair: '#5a3a2a', hat: '#ffffff' } });
  // 기숙사
  for (let i = 0; i < 4; i++) add(m, 'deco', 5 + i * 4, 32, { kind: 'bed', c: ['#4a7ab8', '#b84a6a', '#4ab87a', '#b8a04a'][i] });
  add(m, 'deco', 7, 37, { kind: 'table' });
  // 마당과 광장 사람들
  add(m, 'npc', 18, 22, { name: '미라', talk: 'mira', look: MIRA_LOOK });
  add(m, 'npc', 28, 29, { name: '핍', talk: 'pip', look: { cloak: '#5aa86a', hair: '#e8c070', scale: 0.8 }, });
  add(m, 'npc', 36, 23, { name: '견습생 도린', talk: 'student2', look: { cloak: '#3b6ea8', hair: '#2a2a2a' }, wander: 3 });
  add(m, 'npc', 22, 18, { name: '학생 세라', talk: 'student3', look: { cloak: '#a84a4a', hair: '#7a3a2a' }, wander: 3 });
  // 미라의 부유석과 도망친 책
  add(m, 'orb', 16, 23, { id: 'orb1' }); add(m, 'orb', 38, 6, { id: 'orb2' }); add(m, 'orb', 29, 3, { id: 'orb3' });
  for (const o of m.ents) if (o.type === 'orb') o.show = () => G.f.miraTask && !G.f.miraDone;
  const b = add(m, 'book', 25, 8, { flee: true, minx: 23.6, maxx: 28.4, miny: 5.6, maxy: 11.2, rad: 0.8, c: '#3a6aa8' });
  b.show = () => G.f.bookTask && !G.f.bookDone;
  for (let i = 0; i < 6; i++) add(m, 'book', 6 + i * 3, 8 + (i % 3) * 2, { id: 'fb' + i, rad: 2 + i % 2, c: ['#a83a3a', '#3a8a5a', '#8a5aa8'][i % 3] });
  add(m, 'book', 30, 22, { id: 'fb9', rad: 5, c: '#c89a3a' });
  add(m, 'book', 34, 28, { id: 'fb10', rad: 4, c: '#3a6aa8' });
  // 성문
  add(m, 'warp', 31, 0, { look: 'gate', to: 'world', tx: 100, ty: 114, rad: 1.9, cond: () => G.f.ch1ready, locked: () => G.f.coat ? '내일 아침에 떠나자. 기숙사에서 자고 가야 한다.' : '원정이 정해지기 전에는 성문이 열리지 않는다.' });
  m.ents[m.ents.length - 1].x = 32;
  add(m, 'trigger', 6, 34, { w: 3, h: 3, once: false, cond: () => G.f.coat && !G.f.slept, onEnter: () => TALK.sleep() });
  return m;
}

// ======================================================================
// 지하 회랑 (1장 던전)
// ======================================================================
function buildUnder() {
  const m = M('under', 56, 48, T.DARK, { name: '지하 회랑', temp: 10, noSwim: true, region: 1, dim: 0.35 });
  room(m, 1, 12, 54, 5, T.FLOOR);
  add(m, 'warp', 3, 14, { look: 'stairs', to: 'kalidor', tx: 56, ty: 27 });
  add(m, 'chest', 7, 13, { weapon: 'wood' });
  add(m, 'sign', 9, 15, { title: '안내판', text: '실험실 네 곳은 봉인되어 있다. 연구원의 공명봉에만 반응한다.\n기관실로 가는 문은 룬 네 개가 모두 있어야 열린다.' });
  const runes = ['magnes', 'stasis', 'cryo', 'burst'];
  for (let i = 0; i < 4; i++) {
    const x0 = 2 + i * 13;
    room(m, x0, 1, 12, 12, T.FLOOR);
    S(m, x0 + 5, 12, T.FLOOR); S(m, x0 + 6, 12, T.FLOOR);
    add(m, 'pedestal', x0 + 5, 3, { rune: runes[i] });
    m.ents[m.ents.length - 1].x = x0 + 6;
    add(m, 'deco', x0 + 2, 2, { kind: 'barrel' });
  }
  // 실험실 1: 인력 — 철 상자를 누름판에
  const pl = add(m, 'plate', 9, 9, { crateOnly: true, onPress: () => { G.f.lab0 = true; } });
  add(m, 'crate', 4, 9);
  add(m, 'gate', 7, 12, { cond: () => !G.runes.magnes || G.f.lab0 }); add(m, 'gate', 8, 12, { cond: () => !G.runes.magnes || G.f.lab0 });
  // 실험실 2: 정체 — 칼날이 길을 막는다
  R(m, 16, 7, 10, 1, T.WALL); S(m, 20, 7, T.FLOOR); S(m, 21, 7, T.FLOOR);
  const sp = add(m, 'spinner', 20, 7, { len: 1.3, speed: 3, cond: () => G.runes.stasis }); sp.x = 21; sp.y = 7.5;
  // 실험실 3: 결빙 — 룬을 받으면 물이 찬다 (runes.js에서 처리)
  // 실험실 4: 파열 — 룬을 받으면 천장이 무너진다
  // 메아리 식당
  room(m, 8, 16, 40, 14, T.FLOOR);
  R(m, 26, 16, 4, 1, T.FLOOR);
  for (const [x, y] of [[13, 20], [13, 25], [40, 21], [40, 26], [20, 27]]) add(m, 'deco', x, y, { kind: 'table', bread: true });
  for (const x of [16, 22, 34, 40]) add(m, 'deco', x, 17, { kind: 'window' });
  add(m, 'echo', 14, 21, { kind: 'human', act: 'bread' });
  add(m, 'echo', 39, 22, { kind: 'human', act: 'bread' });
  add(m, 'echo', 22, 18, { kind: 'human', act: 'window' });
  add(m, 'echo', 34, 18, { kind: 'human', act: 'window' });
  add(m, 'echo', 18, 26, { kind: 'beast' });
  add(m, 'echo', 42, 27, { kind: 'beast' });
  add(m, 'echo', 30, 24, { kind: 'human', act: 'window', watcher: true, unique: true, id: 'watcher' });
  // 기관실 앞방
  room(m, 8, 29, 40, 17, T.FLOOR);
  S(m, 27, 29, T.FLOOR); S(m, 28, 29, T.FLOOR);
  add(m, 'gate', 27, 29, { look: 'seal', sockets: runes, cond: () => runes.every(r => G.runes[r]) });
  add(m, 'gate', 28, 29, { look: 'seal', sockets: runes, cond: () => runes.every(r => G.runes[r]) });
  // 중계탑 1: 무너진 벽 속 (파열)
  R(m, 9, 31, 7, 1, T.CRACK); R(m, 15, 31, 1, 6, T.CRACK); R(m, 9, 36, 7, 1, T.CRACK);
  add(m, 'pylon', 12, 33, { id: 'pyA', onOn: pylonCheck });
  // 중계탑 2: 빠진 도관 (인력)
  const sock = add(m, 'plate', 27, 35, { need: 'conduit', crateOnly: true });
  add(m, 'pylon', 27, 33, { id: 'pyB', cond: () => sock.on, hint: '도관이 빠져 있다. 금속이니 인력 룬으로 끌어올 수 있겠다.', onOn: pylonCheck });
  add(m, 'crate', 18, 41, { look: 'conduit' });
  // 중계탑 3: 물 건너 섬 (결빙 + 정체)
  R(m, 34, 30, 13, 9, T.DEEP); R(m, 42, 32, 4, 4, T.FLOOR);
  add(m, 'pylon', 44, 33, { id: 'pyC', onOn: pylonCheck });
  const sp2 = add(m, 'spinner', 42, 35, { len: 1.2, speed: 2.6 });
  add(m, 'sign', 32, 40, { text: '물이 깊다. 결빙 룬(3)으로 얼음 발판을 만들 수 있다. 얼음은 세 개까지 유지된다.' });
  // 기관실 문
  S(m, 27, 45, T.FLOOR); S(m, 28, 45, T.FLOOR);
  add(m, 'gate', 27, 45, { look: 'seal', cond: () => G.f.pylons }); add(m, 'gate', 28, 45, { look: 'seal', cond: () => G.f.pylons });
  add(m, 'trigger', 27, 44, { w: 3, h: 1, cond: () => G.f.pylons, onEnter: () => runScript(TALK.engineRoom) });
  m.ents[m.ents.length - 1].x = 28;
  for (const [x, y] of [[10, 43], [46, 43], [20, 38]]) add(m, 'deco', x, y, { kind: 'lamp' });
  return m;
}
function pylonCheck() {
  const n = ['pyA', 'pyB', 'pyC'].filter(isDone).length;
  toast(`중계탑 ${n} / 3`);
  if (n >= 3) { G.f.pylons = true; runScript(async () => { await wait(0.5); sfx('open'); await say('렌', '세 개 다 켜졌다. 기관실 문이 열린다!'); }); }
}

// ======================================================================
// 대륙 아스테리아 (열린 세계)
// ======================================================================
const REG = [
  { name: '중앙 평원', temp: 17 }, { name: '칼리도르', temp: 18 }, { name: '마르셀라 해안', temp: 27 },
  { name: '엘름바텐 숲', temp: 13 }, { name: '그라벤호프 산지', temp: -4 }, { name: '알테라 고원', temp: -18 },
  { name: '서부 평원', temp: 12 }, { name: '바다', temp: 14 },
];
const WORLD_W = 200, WORLD_H = 150;
const PLACES = {
  kalidorGate: [100, 117], marcella: [34, 88], cathedral: [22, 82], elm: [158, 80], clock: [178, 62],
  grav: [100, 20], mine: [106, 12], camp: [66, 46], prima: [22, 9], riven: [72, 54],
  orta: [14, 50], brig: [28, 54], seilen: [46, 50],
};
const TOWERS = [
  { id: 'tw0', x: 100, y: 108, name: '칼리도르 관측탑', r: 34 },
  { id: 'tw1', x: 52, y: 90, name: '서쪽 해안 관측탑', r: 38 },
  { id: 'tw2', x: 134, y: 78, name: '동쪽 숲 관측탑', r: 40 },
  { id: 'tw3', x: 100, y: 56, name: '북쪽 산 관측탑', r: 40 },
  { id: 'tw4', x: 70, y: 41, name: '고원 관측탑', r: 42 },
];
const LABS = [[84, 100], [122, 104], [64, 74], [46, 108], [150, 102], [124, 58], [86, 46], [40, 54]];

function plateauMask(x, y) {
  const n = (fbm(x * 0.1, y * 0.1, 21) - 0.5) * 6;
  return x > 8 + n && x < 62 + n && y > 5 + n * 0.5 && y < 43 + n * 0.6;
}
function regionOfXY(x, y) {
  if (plateauMask(x, y)) return 5;
  if (x >= 64 && x <= 142 && y < 50 + (fbm(x * 0.05, 0, 3) - 0.5) * 8) return 4;
  if (x > 138 + (fbm(0, y * 0.06, 4) - 0.5) * 8 && y > 38 && y < 118) return 3;
  if (x >= 91 && x <= 109 && y >= 117 && y <= 133) return 1;
  if (x < 60 && y > 58 && y < 122) return 2;
  if (x < 64 && y >= 43 && y <= 58) return 6;
  return 0;
}

function buildWorld() {
  const W = WORLD_W, H = WORLD_H;
  const m = M('world', W, H, T.GRASS, { name: '아스테리아', world: true, oob: T.DEEP });
  m.reg = new Uint8Array(W * H);
  m.coastD = new Uint8Array(W * H);
  const coastX = y => 13 + Math.round(4 * fbm(0.5, y * 0.05, 3));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const edge = Math.min(x, W - 1 - x, y, H - 1 - y);
    const n = fbm(x * 0.06, y * 0.06, 1);
    let land = edge > 3 + n * 7;
    let t = T.GRASS;
    const inBand = y >= 58 && y <= 120;
    if (inBand) {
      const cx = coastX(y);
      if (x <= cx) land = false;
      else if (x <= cx + 12 && land) { t = T.SALTC; m.coastD[y * W + x] = x - cx; }
    }
    if (!land) t = T.DEEP;
    S(m, x, y, t);
    m.reg[y * W + x] = land ? regionOfXY(x, y) : 7;
  }
  const RG = (x, y) => m.reg[y * W + x];

  // --- 지역별 땅 ---
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const r = RG(x, y), cur = Gt(m, x, y);
    if (cur === T.DEEP || cur === T.SALTC) continue;
    const n = fbm(x * 0.13, y * 0.13, 5), h = hash2(x, y, 3);
    if (r === 0 || r === 6) {
      if (n > 0.72) S(m, x, y, T.TREE);
      else if (h < 0.04) S(m, x, y, T.FLOWER);
      else if (n < 0.24 && h < 0.3) S(m, x, y, T.ROCK);
    } else if (r === 2) {
      S(m, x, y, T.SALT);
      if (n > 0.7) S(m, x, y, T.SALTROCK);
    } else if (r === 3) {
      const f = fbm(x * 0.16, y * 0.16, 9);
      S(m, x, y, f > 0.52 ? (h < 0.5 ? T.TREE : T.PINE) : T.LEAF);
    } else if (r === 4) {
      const k = fbm(x * 0.11, y * 0.11, 15);
      if (k > 0.63) S(m, x, y, T.ROCK);
      else if (k > 0.56) S(m, x, y, T.CLIFF);
      else S(m, x, y, h < 0.05 ? T.PINE : T.SNOW);
    } else if (r === 5) {
      S(m, x, y, T.HIGH);
      if (n > 0.7 && h < 0.5) S(m, x, y, T.RUIN);
      if (h < 0.012) S(m, x, y, T.PILLAR);
    }
  }
  // 고원 둘레는 절벽
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    if (RG(x, y) !== 5) continue;
    let edgeT = false;
    for (let oy = -2; oy <= 2 && !edgeT; oy++) for (let ox = -2; ox <= 2; ox++) { const rr = m.reg[(y + oy) * W + (x + ox)]; if (rr !== 5) { edgeT = true; break; } }
    if (edgeT) S(m, x, y, T.CLIFF);
  }
  // 고원의 무너진 다리 (활공으로 건넌다)
  R(m, 9, 27, 54, 4, T.CHASM);
  R(m, 34, 6, 5, 21, T.CHASM);
  R(m, 28, 25, 6, 2, T.RUIN); R(m, 28, 31, 6, 2, T.RUIN);  // 끊긴 다리의 양 끝
  R(m, 39, 14, 2, 4, T.RUIN); R(m, 32, 14, 2, 4, T.RUIN);
  // 프리마 앞뜰
  disc(m, 22, 11, 5, T.RUIN);
  for (const [x, y] of [[17, 7], [27, 7], [17, 15], [27, 15]]) S(m, x, y, T.PILLAR);
  // 고원 오르는 길 (남동쪽 절벽): 절벽 타일 그대로 둔다
  // 그라벤호프 마을 터
  disc(m, 100, 20, 9, T.SNOW);
  disc(m, 106, 12, 3, T.SNOW);
  // 엘름바텐 마을과 시계탑 섬
  disc(m, 158, 80, 8, T.LEAF);
  for (let y = 50; y < 75; y++) for (let x = 165; x < 192; x++) {
    const d = dist(x, y, 178, 62);
    if (d < 6.5) S(m, x, y, T.LEAF);
    else if (d < 9.5) S(m, x, y, T.RAVINE);
  }
  // 마르셀라 마을
  disc(m, 34, 88, 7, T.SAND);
  // 칼리도르 성벽 (밖에서 본 모습)
  R(m, 92, 118, 17, 15, T.WALL); R(m, 93, 119, 15, 13, T.ROOF);
  S(m, 100, 118, T.PATH);
  // 서부 도시와 리벤 마을 터
  for (const k of ['orta', 'brig', 'seilen', 'riven']) disc(m, PLACES[k][0], PLACES[k][1], 4, T.GRASS);
  disc(m, 66, 46, 3, T.GRASS);

  // --- 호수와 강 ---
  disc(m, 76, 80, 6, T.DEEP, [T.GRASS, T.FLOWER, T.ROCK, T.TREE]);
  disc(m, 130, 112, 5, T.DEEP, [T.GRASS, T.FLOWER, T.ROCK, T.TREE]);
  const river = (pts) => { for (let i = 0; i < pts.length - 1; i++) { const [ax, ay] = pts[i], [bx, by] = pts[i + 1]; const n = Math.ceil(Math.hypot(bx - ax, by - ay) * 2); for (let k = 0; k <= n; k++) { const x = Math.round(lerp(ax, bx, k / n)), y = Math.round(lerp(ay, by, k / n)); for (let o = -1; o <= 1; o++) { const c = Gt(m, x + o, y); if (c >= 0 && c !== T.WALL && c !== T.ROOF && RG(x + o, y) !== 5) S(m, x + o, y, T.DEEP); } } } };
  river([[118, 48], [116, 62], [122, 78], [126, 94], [140, 118], [158, 147]]);
  river([[78, 52], [72, 64], [76, 80]]);
  river([[76, 86], [66, 100], [58, 118], [52, 147]]);
  // 물가는 얕은 물
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    if (Gt(m, x, y) !== T.DEEP) continue;
    let landN = false;
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const c = Gt(m, x + ox, y + oy); if (c !== T.DEEP && c !== T.SHALLOW && c !== T.SALTC) landN = true; }
    if (landN && hash2(x, y, 8) < 0.7 && m.reg[y * W + x] !== 7) S(m, x, y, T.SHALLOW);
    else if (landN && m.reg[y * W + x] === 7 && Gt(m, x, y) === T.DEEP && hash2(x, y, 9) < 0.5) S(m, x, y, T.SHALLOW);
  }
  // 바닷가 모래
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const c = Gt(m, x, y);
    if (c !== T.GRASS && c !== T.FLOWER) continue;
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { if (m.reg[(y + oy) * W + x + ox] === 7) { S(m, x, y, T.SAND); break; } }
  }

  // --- 길 ---
  const PATHABLE = null;
  const roads = [
    [[100, 117], [100, 104], [100, 92]],
    [[100, 92], [80, 90], [60, 88], [40, 88]],
    [[100, 92], [120, 86], [136, 82], [150, 80]],
    [[100, 92], [100, 70], [100, 52]],
    [[100, 52], [104, 44], [96, 36], [104, 28], [100, 22]],
    [[100, 70], [84, 62], [72, 54], [66, 47]],
    [[158, 80], [160, 71], [166, 63], [168, 62]],
    [[40, 88], [34, 88], [26, 84], [22, 83]],
    [[66, 47], [52, 52], [40, 52], [28, 54], [14, 51]],
    [[100, 22], [105, 15], [106, 13]],
  ];
  for (const r of roads) road(m, r, T.PATH, 1, T.BRIDGE, [T.WALL, T.ROOF, T.SALTC, T.CLIFF, T.HIGH, T.RAVINE, T.CHASM, T.RUIN]);
  // 산길은 바위를 뚫는다
  road(m, [[100, 52], [104, 44], [96, 36], [104, 28], [100, 22], [105, 15], [106, 13]], T.PATH, 1, T.BRIDGE, [T.WALL, T.ROOF]);
  // 지맥 (빛나는 길): 풀밭에만 그린다
  const ley = (pts) => road(m, pts, T.LEY, 0, null, [T.WALL, T.ROOF, T.TREE, T.ROCK, T.CLIFF, T.HIGH, T.PATH, T.BRIDGE, T.SALTC, T.SALT, T.SALTROCK, T.PINE, T.LEAF, T.SNOW, T.RAVINE, T.CHASM, T.RUIN, T.PILLAR, T.SAND]);
  ley([[100, 116], [90, 100], [70, 92], [52, 84], [30, 80]]);
  ley([[100, 116], [112, 100], [130, 90], [140, 72]]);
  ley([[100, 116], [108, 96], [96, 76], [92, 58]]);
  ley([[100, 116], [84, 104], [70, 80], [62, 60], [56, 48]]);
  ley([[70, 92], [76, 110], [86, 130]]);

  // --- 장소와 사람 ---
  // 성문
  add(m, 'warp', 100, 118, { look: 'gate', to: 'kalidor', tx: 32, ty: 3, label: '칼리도르 성문' });
  // 관측탑 + 모닥불
  for (const t of TOWERS) {
    disc(m, t.x, t.y, 2.2, T.GRASS, [T.TREE, T.ROCK, T.PINE, T.SALTROCK, T.FLOWER, T.DEEP, T.SHALLOW]);
    add(m, 'tower', t.x, t.y, { id: t.id, tname: t.name, rad: t.r });
    add(m, 'fire', t.x + 2, t.y + 2, { id: 'fire:' + t.id });
  }
  // 봉인 실험실
  LABS.forEach(([x, y], i) => {
    disc(m, x, y, 1.5, T.GRASS, [T.TREE, T.ROCK, T.PINE, T.SALTROCK, T.DEEP, T.SHALLOW, T.FLOWER]);
    add(m, 'warp', x, y, { look: 'lab', lab: i, to: 'lab' + i, tx: 8, ty: 11, label: '봉인 실험실' });
  });
  // 기관 빛기둥
  add(m, 'pillar', 22, 77, { flag: 'eng_marcella', c: '127,240,255' });
  add(m, 'pillar', 178, 60, { flag: 'eng_elm', c: '255,200,128' });
  add(m, 'pillar', 106, 8, { flag: 'eng_grav', c: '255,154,90' });
  add(m, 'pillar', 22, 8, { c: '220,210,255', flagOff: 'primaStop' });
  add(m, 'pillar', 100, 125, { c: '127,240,255', flag: 'ch1engine' });
  for (const [x, y, f] of [[192, 18, 0], [196, 134, 1], [6, 142, 0], [150, 4, 1], [62, 146, 0], [190, 96, 1], [124, 146, 0]]) add(m, 'pillar', x, y, { flicker: !!f, c: f ? '255,170,200' : '160,220,255' });
  // 떠 있는 섬
  for (const [x, y, s] of [[86, 84, 1], [118, 70, 0.8], [70, 106, 1.2], [140, 100, 0.9], [60, 66, 0.7], [112, 110, 0.6]]) add(m, 'island', x, y, { s });

  // 칼리도르 앞
  add(m, 'sign', 103, 112, { title: '이정표', text: '서쪽: 마르셀라 해안 · 동쪽: 엘름바텐 숲 · 북쪽: 그라벤호프 산지\n북서쪽 구름 위: 알테라 고원 (출입 금지)' });
  add(m, 'npc', 97, 113, { name: '성문지기', talk: 'gatekeeper', look: { cloak: '#6a6a7a', hair: '#3a2a1a', hat: '#4a4a5a' } });

  // 마르셀라
  const [mx, my] = PLACES.marcella;
  R(m, 17, 74, 10, 7, T.WALL); R(m, 18, 75, 8, 5, T.ROOF);
  add(m, 'warp', 22, 81, { look: 'arch', to: 'cathedral', tx: 23, ty: 34, label: '성녀 마렌 성당' });
  for (const [x, y, c] of [[30, 85, '#5a8ab8'], [38, 85, '#c46a5a'], [30, 92, '#5aa88a'], [38, 92, '#d8a04a']]) { R(m, x - 1, y - 1, 3, 2, T.HOUSE); add(m, 'deco', x, y - 1, { kind: 'house', roof: c, wall: '#f4ecdc' }); }
  add(m, 'npc', 25, 85, { name: '대사제 오렐리아', talk: 'priest', look: { cloak: '#f4f4f8', body: '#e8e8f0', hair: '#c8b8a8', hat: '#d8c070' } });
  add(m, 'npc', 34, 89, { name: '어부 노엘', talk: 'fisher', look: { cloak: '#3a6a8a', hair: '#5a3a2a' }, wander: 2 });
  add(m, 'npc', 36, 87, { name: '염전 상인', talk: 'saltshop', shop: 'salt', look: { cloak: '#e8e0cf', body: '#fff', hair: '#2a2a2a' } });
  add(m, 'npc', 31, 89, { name: '생선 장수', talk: 'fishshop', shop: 'fish', look: { cloak: '#5a8ab8', hair: '#8a5a3a' } });
  add(m, 'npc', 44, 84, { name: '순례자 안나', talk: 'pilgrim', look: { cloak: '#d8d0c0', hair: '#5a4a3a', hat: '#c8b898' } });
  add(m, 'npc', 48, 96, { name: '순례자', talk: 'pilgrim2', look: { cloak: '#d8d0c0', hair: '#8a6a4a' }, wander: 4 });
  add(m, 'collect', 33, 91, { key: 'chronicle' });
  add(m, 'deco', 34, 86, { kind: 'festival', need: 'eng_marcella' });
  add(m, 'deco', 12, 90, { kind: 'boat', show: () => G.f.eng_marcella && coastP() > 0.6 });
  add(m, 'deco', 10, 96, { kind: 'boat', show: () => G.f.eng_marcella && coastP() > 0.8 });
  add(m, 'fire', 36, 92, { id: 'fire:marcella' });

  // 엘름바텐
  for (const [x, y, c] of [[153, 76, '#a85a3a'], [163, 76, '#8a6a3a'], [153, 84, '#7a5a3a'], [163, 85, '#b8783a']]) { R(m, x - 1, y - 1, 3, 2, T.HOUSE); add(m, 'deco', x, y - 1, { kind: 'house', roof: c, wall: '#e8dcc4' }); }
  add(m, 'npc', 157, 79, { name: '촌장 브람', talk: 'chief', look: { cloak: '#7a5a3a', hair: '#8a7a6a' } });
  add(m, 'npc', 166, 80, { name: '헤다', talk: 'hedda', look: { cloak: '#9a6a8a', hair: '#eeeeee', body: '#f0e6d0' }, show: () => !G.f.heddaGone });
  add(m, 'deco', 167, 82, { kind: 'flowerbed' }); add(m, 'deco', 165, 82, { kind: 'flowerbed' });
  add(m, 'npc', 155, 83, { name: '마을 아이 테오', talk: 'teo', look: { cloak: '#c8782a', hair: '#5a3a2a', scale: 0.8 }, wander: 2 });
  add(m, 'npc', 160, 84, { name: '숲 상인', talk: 'elmshop', shop: 'elm', look: { cloak: '#5a7a3a', hair: '#3a2a1a' }, show: () => G.f.elm === 'full' });
  add(m, 'npc', 150, 80, { name: '사냥꾼 오드', talk: 'hunter', look: { cloak: '#6a5a3a', hair: '#2a2a1a', hat: '#4a3a2a' }, show: () => G.f.elm === 'full' });
  add(m, 'collect', 154, 81, { key: 'ledger' });
  add(m, 'curtain', 163, 66, { w: 3 });
  add(m, 'warp', 178, 60, { look: 'door', to: 'clock', tx: 21, ty: 39, label: '시계탑 기관' });
  add(m, 'leaf', 169, 62, { fixed: true });
  add(m, 'leaf', 170, 62, { dy: 1.8, speed: 0.8 });
  add(m, 'leaf', 171, 62, { fixed: true });
  add(m, 'leaf', 177, 69, { fixed: true }); add(m, 'leaf', 177, 70, { dx: 1.6, speed: 1.1 }); add(m, 'leaf', 177, 71, { fixed: true });
  add(m, 'sign', 167, 64, { text: '공중에 멈춘 낙엽은 밟을 수 있다. 흔들리는 잎은 정체 룬(2)으로 그 자리에 붙들 수 있다.' });
  add(m, 'fire', 156, 86, { id: 'fire:elm' });

  // 그라벤호프
  for (const [x, y] of [[94, 16], [94, 24], [106, 24], [92, 20]]) { R(m, x - 1, y - 1, 3, 2, T.HOUSE); add(m, 'deco', x, y - 1, { kind: 'house', roof: '#5a5a6a', wall: '#c8c0b8' }); }
  add(m, 'npc', 102, 18, { name: '감독관 하르트만', talk: 'overseer', look: { cloak: '#2a3a5a', hair: '#5a5a5a', hat: '#1a2a4a' } });
  add(m, 'npc', 104, 15, { name: '광부 가족 엘사', talk: 'elsa', look: { cloak: '#7a5a5a', hair: '#3a2a1a' } });
  for (const [x, y] of [[103, 13], [101, 14], [107, 16]]) add(m, 'npc', x, y, { name: '광부 가족', talk: 'family', look: { cloak: pick(['#6a5a4a', '#5a4a5a', '#4a5a5a']), hair: '#2a2a2a' }, show: () => !G.f.eng_grav });
  add(m, 'npc', 98, 22, { name: '대장장이 그레타', talk: 'gravshop', shop: 'grav', look: { cloak: '#5a3a2a', hair: '#c87a3a' } });
  add(m, 'npc', 96, 18, { name: '구조된 광부 요나스', talk: 'miner', look: { cloak: '#6a5a4a', hair: '#3a2a1a', hat: '#d8b030' }, show: () => G.f.rescued > 0 });
  add(m, 'warp', 106, 11, { look: 'cave', to: 'mine', tx: 4, ty: 4, label: '그라벤호프 제3갱' });
  add(m, 'fire', 99, 25, { id: 'fire:grav' });
  add(m, 'deco', 108, 18, { kind: 'cart_d' });

  // 카시안의 야영지 (5장 입구)
  add(m, 'deco', 64, 45, { kind: 'tent', c: '#8a6aa8' });
  add(m, 'fire', 67, 47, { id: 'fire:camp' });
  add(m, 'npc', 65, 48, { name: '카시안', talk: 'kassianCamp', look: KASSIAN_LOOK, id: 'kassCamp', show: () => G.f.summons && !G.f.kassJoined });
  add(m, 'sign', 62, 44, { title: '학원 표지', text: '알테라 고원. 이 위로는 체온 관리 없이 오르지 말 것.\n절벽은 스태미나가 버티는 만큼만 오를 수 있다.' });
  add(m, 'warp', 22, 9, { look: 'arch', to: 'prima', tx: 19, ty: 51, label: '프리마', cond: () => G.f.summons, locked: '거대한 문이 굳게 닫혀 있다. 지금은 열 수 없다.' });
  add(m, 'trigger', 22, 12, { w: 6, h: 2, cond: () => G.f.kassJoined && !G.f.primaGate, onEnter: () => TALK.primaGate() });

  // 서부 세 도시와 리벤 (5장 이후 불이 꺼진다)
  for (const [k, nm] of [['orta', '오르타'], ['brig', '브리그'], ['seilen', '세일른']]) {
    const [x, y] = PLACES[k];
    R(m, x - 2, y - 1, 2, 2, T.HOUSE); R(m, x + 1, y - 1, 2, 2, T.HOUSE);
    add(m, 'deco', x - 1, y - 1, { kind: 'house', roof: '#7a6a9a', wall: '#e8dcc4', dark: false });
    add(m, 'deco', x + 2, y - 1, { kind: 'house', roof: '#9a6a5a', wall: '#e8dcc4' });
    add(m, 'deco', x, y - 3, { kind: 'light', flagOff: 'dark_' + k });
    add(m, 'npc', x, y + 2, { name: nm + ' 주민', talk: 'westTown', town: nm, look: { cloak: '#7a6a5a', hair: '#4a3a2a' } });
  }
  const [rx, ry] = PLACES.riven;
  R(m, rx - 3, ry - 2, 2, 2, T.HOUSE); R(m, rx + 2, ry - 2, 2, 2, T.HOUSE);
  add(m, 'deco', rx - 2, ry - 2, { kind: 'house', roof: '#6a7a5a', wall: '#e8dcc4' });
  add(m, 'deco', rx + 3, ry - 2, { kind: 'house', roof: '#7a5a5a', wall: '#e8dcc4' });
  add(m, 'npc', rx, ry + 2, { name: '리벤 주민', talk: 'riven', look: { cloak: '#6a7a8a', hair: '#5a4a3a' }, show: () => !G.f.primaStop });
  add(m, 'poster', rx + 1, ry, { talk: 'poster', show: () => G.f.primaStop });
  add(m, 'npc', rx - 1, ry + 1, { name: '???', talk: 'helper', id: 'helper', look: {}, show: () => G.f.posterRead });

  // 채집물
  const forageAt = (r, item, n, ok) => {
    let c = 0, guard = 0;
    while (c < n && guard++ < 4000) {
      const x = 4 + (Math.random() * (W - 8)) | 0, y = 4 + (Math.random() * (H - 8)) | 0;
      if (m.reg[y * W + x] !== r) continue;
      const t = Gt(m, x, y);
      if (!(ok || [T.GRASS, T.FLOWER, T.LEAF, T.SNOW, T.SALT, T.HIGH, T.SAND]).includes(t)) continue;
      add(m, 'forage', x, y, { item, regrow: 150 }); c++;
    }
  };
  forageAt(0, 'berry', 16); forageAt(0, 'apple', 10); forageAt(0, 'herb', 14); forageAt(0, 'pepper', 5);
  forageAt(2, 'pepper', 10); forageAt(2, 'herb', 4);
  forageAt(3, 'mushroom', 16); forageAt(3, 'apple', 8); forageAt(3, 'herb', 6);
  forageAt(4, 'mushroom', 6); forageAt(4, 'pepper', 8);
  forageAt(5, 'herb', 6); forageAt(5, 'pepper', 6);
  forageAt(6, 'berry', 8); forageAt(6, 'apple', 6);

  // 잔향과 야생 동물
  const spawnIn = (r, type, n, props) => {
    let c = 0, guard = 0;
    while (c < n && guard++ < 6000) {
      const x = 4 + (Math.random() * (W - 8)) | 0, y = 4 + (Math.random() * (H - 8)) | 0;
      if (m.reg[y * W + x] !== r) continue;
      const t = Gt(m, x, y);
      if (TD[t].solid || TD[t].deep || TD[t].chasm || TD[t].climb || t === T.SALTC) continue;
      if (dist(x, y, 100, 116) < 12) continue;
      const p = typeof props === 'function' ? props() : Object.assign({}, props);
      add(m, type, x, y, p); c++;
    }
  };
  const acts = ['bread', 'sweep', 'window', 'pray'];
  spawnIn(0, 'echo', 10, () => ({ kind: 'beast' }));
  spawnIn(0, 'echo', 7, () => ({ kind: 'human', act: pick(acts) }));
  spawnIn(0, 'beast', 9, { kind: 'boar' });
  spawnIn(6, 'beast', 4, { kind: 'boar' });
  spawnIn(6, 'echo', 4, () => ({ kind: 'beast' }));
  spawnIn(2, 'echo', 9, () => ({ kind: Math.random() < 0.6 ? 'human' : 'beast', tint: 'salt', act: 'pray' }));
  spawnIn(3, 'echo', 9, () => ({ kind: Math.random() < 0.5 ? 'human' : 'wisp', tint: 'time', act: 'sweep' }));
  spawnIn(3, 'echo', 8, () => ({ kind: Math.random() < 0.5 ? 'human' : 'big', tint: 'time', act: 'hunt', show: () => G.f.elm === 'stable' }));
  spawnIn(3, 'beast', 7, { kind: 'deer', show: () => G.f.elm === 'full' });
  spawnIn(4, 'echo', 9, () => ({ kind: Math.random() < 0.6 ? 'human' : 'beast', tint: 'frost', act: 'dig' }));
  spawnIn(5, 'echo', 10, () => ({ kind: pick(['human', 'wisp', 'big', 'beast']), tint: 'ruin', act: 'window' }));
  spawnIn(0, 'echo', 2, () => ({ kind: 'big' }));
  return m;
}

// ======================================================================
// 2장: 성녀 마렌 성당 (마르셀라 기관)
// ======================================================================
function buildCathedral() {
  const m = M('cathedral', 48, 40, T.WALL, { name: '성녀 마렌 성당', temp: 22, noSwim: true, flood: true, region: 2, style: 'salt' });
  room(m, 12, 22, 24, 16, T.FLOOR);
  add(m, 'warp', 23, 36, { look: 'arch', to: 'world', tx: 22, ty: 84 });
  m.ents[m.ents.length - 1].x = 24;
  add(m, 'lever', 23, 26, { look: 'arm', label: '종루의 팔', verb: '팔 돌리기', onUse: () => { m.flood = !m.flood; G.shake = 0.4; sfx('rumble'); toast(m.flood ? '바닷물이 밀려 들어온다 · 수위 높음' : '바닷물이 빠져나간다 · 수위 낮음'); } });
  m.ents[m.ents.length - 1].x = 24;
  add(m, 'sign', 18, 32, { title: '순례자의 낙서', text: '종루의 팔을 돌리면 바다가 성당 안으로 들어오고 나간다.\n서쪽 회랑은 물살이 세다. 동쪽 예배당의 물은 잔잔하다.' });
  for (const [x, y] of [[15, 25], [32, 25], [15, 34], [32, 34]]) add(m, 'deco', x, y, { kind: 'lamp' });
  add(m, 'collect', 30, 33, { key: 'prayer' });
  // 서쪽 회랑: 물살 (수위가 낮아야 걸어갈 수 있다)
  room(m, 1, 6, 12, 30, T.FLOOR);
  S(m, 12, 30, T.FLOOR); S(m, 12, 31, T.FLOOR);
  R(m, 2, 12, 10, 16, T.FLOOD);
  const sealA = add(m, 'lever', 6, 8, { label: '봉인 A', verb: '봉인 풀기', c: '#7ff0ff', onUse: e => { if (!G.f.sealA) { G.f.sealA = true; sfx('chime'); toast('봉인 하나가 풀렸다 (1/2)'); } } });
  add(m, 'echo', 5, 30, { kind: 'human', tint: 'salt', act: 'pray' });
  add(m, 'echo', 9, 9, { kind: 'beast', tint: 'salt' });
  // 동쪽 예배당: 잔잔한 물 (수위가 높아야 얼음으로 높은 단에 오른다)
  room(m, 35, 6, 12, 30, T.FLOOR);
  S(m, 35, 30, T.FLOOR); S(m, 35, 31, T.FLOOR);
  R(m, 36, 7, 10, 20, T.POOL);
  R(m, 40, 8, 5, 3, T.HIGH);
  add(m, 'lever', 42, 9, { label: '봉인 B', verb: '봉인 풀기', c: '#7ff0ff', onUse: e => { if (!G.f.sealB) { G.f.sealB = true; sfx('chime'); toast('봉인 하나가 풀렸다'); } } });
  add(m, 'crust', 34, 30, { look: 'salt' }); add(m, 'crust', 34, 31, { look: 'salt' });
  add(m, 'echo', 40, 30, { kind: 'human', tint: 'salt', act: 'pray' });
  add(m, 'sign', 38, 33, { title: '돌판', text: '높은 단은 물 위에서만 닿는다. 얼음은 경사처럼 밟고 오를 수 있다.' });
  // 북쪽: 심부
  room(m, 12, 4, 24, 19, T.FLOOR);
  S(m, 23, 22, T.FLOOR); S(m, 24, 22, T.FLOOR);
  add(m, 'gate', 23, 22, { look: 'seal', cond: () => G.f.sealA && G.f.sealB }); add(m, 'gate', 24, 22, { look: 'seal', cond: () => G.f.sealA && G.f.sealB });
  const b = add(m, 'boss_salt', 23, 12, { id: 'boss_salt', unique: true }); b.x = 24;
  if (G.f.bossSalt) b.dead = true;
  add(m, 'core', 23, 6, { flag: 'eng_marcella', talk: 'coreMarcella', c: '#9ff4ff', verb: '기관 고치기' }); m.ents[m.ents.length - 1].x = 24;
  add(m, 'plaque', 18, 5, { talk: 'plaqueMarcella' });
  for (const [x, y] of [[14, 6], [33, 6], [14, 20], [33, 20]]) add(m, 'deco', x, y, { kind: 'lamp' });
  return m;
}

// ======================================================================
// 3장: 시계탑 기관 (엘름바텐)
// ======================================================================
function buildClock() {
  const m = M('clock', 44, 44, T.WALL, { name: '시계탑 기관', temp: 12, noSwim: true, region: 3, style: 'wood' });
  if (!G.rings) G.rings = [0, 2, 3];
  if (G.ringsMesh === undefined) G.ringsMesh = true;
  // 방 0
  room(m, 12, 32, 20, 11, T.FLOOR);
  add(m, 'warp', 21, 41, { look: 'door', to: 'world', tx: 178, ty: 63 });
  add(m, 'lever', 15, 36, { label: '고리 1', verb: '고리 1 돌리기', onUse: () => rotRing(0) });
  add(m, 'ringface', 19, 34, { ring: 0 }); add(m, 'ringface', 24, 34, { ring: 1 });
  add(m, 'sign', 28, 38, { title: '관리인의 메모', text: '문은 양쪽 방 고리의 바늘이 같은 곳을 가리킬 때 열린다.\n고리 2와 고리 3은 맞물려 함께 돈다. 맞물림을 풀면 고리 2만 돈다.\n마지막 문은 고리 3이 정오(위)를 가리킬 때 열린다.' });
  add(m, 'collect', 14, 40, { key: 'inscription' });
  add(m, 'gate', 21, 32, { cond: () => G.rings[0] === G.rings[1] }); add(m, 'gate', 22, 32, { cond: () => G.rings[0] === G.rings[1] });
  // 방 1
  room(m, 12, 21, 20, 12, T.FLOOR);
  add(m, 'lever', 15, 27, { label: '고리 2', verb: '고리 2 돌리기', onUse: () => { rotRing(1); if (G.ringsMesh) rotRing(2); } });
  add(m, 'lever', 28, 27, { label: '맞물림', verb: '맞물림 바꾸기', c: '#ffd27a', onUse: () => { G.ringsMesh = !G.ringsMesh; toast(G.ringsMesh ? '고리 2와 3이 맞물렸다' : '고리 2와 3의 맞물림이 풀렸다'); } });
  add(m, 'ringface', 19, 23, { ring: 1 }); add(m, 'ringface', 24, 23, { ring: 2 });
  add(m, 'echo', 16, 30, { kind: 'human', tint: 'time', act: 'sweep' });
  add(m, 'echo', 27, 30, { kind: 'wisp', tint: 'time' });
  add(m, 'gate', 21, 21, { cond: () => G.rings[1] === G.rings[2] }); add(m, 'gate', 22, 21, { cond: () => G.rings[1] === G.rings[2] });
  // 방 2: 추가 흔들리는 방
  room(m, 12, 10, 20, 12, T.FLOOR);
  const s1 = add(m, 'spinner', 17, 15, { len: 2.2, speed: 2.8 });
  const s2 = add(m, 'spinner', 26, 15, { len: 2.2, speed: -3.2 });
  add(m, 'ringface', 22, 18, { ring: 2 });
  add(m, 'chest', 14, 12, { weapon: 'leafblade' });
  add(m, 'echo', 22, 13, { kind: 'big', tint: 'time', act: 'hunt' });
  add(m, 'gate', 21, 10, { cond: () => G.rings[2] === 0 }); add(m, 'gate', 22, 10, { cond: () => G.rings[2] === 0 });
  // 꼭대기: 사냥꾼과 조율기
  room(m, 8, 0, 28, 11, T.FLOOR);
  const h = add(m, 'boss_hunter', 21, 5, { id: 'boss_hunter', unique: true }); h.cx = 22; h.cy = 5.5; h.x = 22;
  if (G.f.bossHunter) h.dead = true;
  for (const y of [32, 21, 10]) { S(m, 21, y, T.FLOOR); S(m, 22, y, T.FLOOR); }
  for (const [x, y] of [[10, 2], [33, 2], [10, 8], [33, 8]]) add(m, 'lever', x, y, { label: '시간 고리', verb: '시간 늦추기', c: '#ffc880', onUse: e => { const b = G.map.ents.find(o => o.type === 'boss_hunter' && !o.dead); if (b && b.awake) { if (e.used > G.t) { toast('고리가 아직 돌아오는 중이다'); return; } e.used = G.t + 9; b.slowT = 5; sfx('freeze'); toast('사냥꾼의 시간이 느려졌다. 지금이다!'); } } });
  add(m, 'core', 21, 1, { flag: 'eng_elm', talk: 'coreElm', c: '#ffc880', verb: '조율기 살피기' }); m.ents[m.ents.length - 1].x = 22; m.ents[m.ents.length - 1].y = 2.2;
  return m;
}
function rotRing(i) { G.rings[i] = (G.rings[i] + 1) % 4; sfx('blip'); G.shake = 0.12; }

// ======================================================================
// 4장: 그라벤호프 제3갱 (용광로 기관)
// ======================================================================
function buildMine() {
  const m = M('mine', 64, 48, T.DARK, { name: '그라벤호프 제3갱', temp: 1, dark: true, noSwim: true, region: 4, style: 'mine' });
  // 입구 홀
  room(m, 1, 1, 14, 10, T.MINE, T.DARK);
  add(m, 'warp', 3, 2, { look: 'cave', to: 'world', tx: 106, ty: 14 });
  add(m, 'fire', 9, 4, { id: 'fire:mine' });
  add(m, 'sign', 6, 8, { title: '갱 입구', text: '그라벤호프 제3갱. 아래 갱도는 떨림 이후 물에 잠겼다.\n어두우니 횃불을 들 것. 횃불은 몸도 조금 데워준다.' });
  add(m, 'chest', 12, 3, { item: 'torch', onOpen: () => { G.torch = true; toast('횃불을 들었다. 어둠이 조금 물러난다'); } });
  // 동쪽 갱도 (광차와 무너진 돌)
  room(m, 14, 4, 24, 4, T.MINE, T.DARK);
  S(m, 14, 5, T.MINE); S(m, 14, 6, T.MINE);
  add(m, 'crate', 25, 5, { look: 'cart' });
  S(m, 25, 6, T.CRACK);
  add(m, 'echo', 32, 5, { kind: 'human', tint: 'mine', act: 'dig' });
  // 내려가는 수직 갱
  room(m, 37, 4, 5, 11, T.MINE, T.DARK);
  S(m, 37, 5, T.MINE); S(m, 37, 6, T.MINE); S(m, 39, 14, T.MINE);
  add(m, 'crate', 39, 10, { look: 'cart' }); add(m, 'crate', 39, 8, { look: 'cart' });
  // 큰 굴 (보스)
  room(m, 36, 14, 26, 20, T.MINE, T.DARK);
  for (const [x, y] of [[40, 18], [57, 18], [40, 30], [57, 30]]) add(m, 'deco', x, y, { kind: 'lamp' });
  const b = add(m, 'boss_mine', 48, 24, { id: 'boss_mine', unique: true });
  if (G.f.mineBoss) b.dead = true;
  add(m, 'collect', 59, 16, { key: 'minerLetter' });
  // 용광로 기관실
  room(m, 44, 1, 19, 12, T.MINE, T.DARK);
  R(m, 52, 12, 1, 3, T.MINE);
  add(m, 'gate', 52, 13, { cond: () => G.f.mineBoss });
  add(m, 'core', 58, 3, { flag: 'eng_grav', talk: 'coreGrav', c: '#ff9a5a', verb: '용광로 살피기' });
  add(m, 'collect', 60, 10, { key: 'relayMap' });
  add(m, 'deco', 46, 6, { kind: 'barrel' });
  const shapes = { '47,5': 'L', '48,5': 'I', '49,5': 'L', '50,5': 'I', '47,6': 'L', '48,6': 'T', '49,6': 'I', '50,6': 'L', '47,7': 'I', '48,7': 'L', '49,7': 'L', '50,7': 'L' };
  const sol = { '47,6': 3, '47,5': 1, '48,5': 1, '49,5': 2, '49,6': 0, '49,7': 0, '50,7': 3, '50,6': 1 };
  for (const k in shapes) { const [x, y] = k.split(',').map(Number); add(m, 'pipe', x, y, { shape: shapes[k], rot: ((sol[k] ?? 0) + 1 + ((x * 3 + y) % 3)) % 4, id: 'pipe' + k }); }
  add(m, 'pipe', 51, 6, { shape: 'L', rot: 0, valve: true, id: 'valve' });
  add(m, 'deco', 46, 6, { kind: 'barrel' });
  add(m, 'sign', 51, 4, { title: '남쪽 중계선', text: '남쪽 중계선 → 칼리도르 외곽 · 남부 마을들' });
  add(m, 'sign', 51, 8, { title: '배수 펌프', text: '배수 펌프 → 아래 갱도' });
  add(m, 'sign', 45, 9, { title: '정비 지침', text: '마력은 왼쪽 원천에서 들어온다. 관을 이어 밸브까지 흐르게 할 것.\n밸브가 가리키는 쪽으로 마력이 간다. 학원 규격: 남쪽 중계선.' });
  add(m, 'lever', 55, 9, { label: '기관 점화', verb: '점화하기', c: '#ff9a3a', onUse: e => TALK.ignite(e) });
  // 배수 수문 회랑 (숨은 선택)
  room(m, 4, 10, 4, 21, T.MINE, T.DARK);
  S(m, 5, 10, T.MINE); S(m, 6, 10, T.MINE);
  room(m, 1, 30, 30, 17, T.MINE, T.DARK);
  S(m, 5, 30, T.MINE); S(m, 6, 30, T.MINE);
  R(m, 2, 38, 28, 8, T.DEEP);
  add(m, 'sign', 8, 33, { title: '배수 수문 제어', text: '배수 수문 다섯 개. 기관에 동력이 있을 때만 움직인다.\n철 수문은 끌어당겨서, 걸린 수문은 깨뜨려서 연다.\n문 하나마다 아래 갱도 하나의 물이 빠진다.' });
  [[5, 'iron'], [10, 'jam'], [15, 'iron'], [20, 'jam'], [25, 'iron']].forEach(([x, k], i) => add(m, 'floodgate', x, 37, { kind: k, idx: i, id: 'fg' + i }));
  add(m, 'trigger', 15, 34, { w: 26, h: 6, once: false, cond: () => G.f.manualUntil && G.t < G.f.manualUntil && !G.f.manualStart, onEnter: () => TALK.manualStart() });
  room(m, 30, 30, 7, 4, T.MINE, T.DARK);
  S(m, 30, 31, T.MINE); S(m, 30, 32, T.MINE); S(m, 36, 31, T.MINE); S(m, 36, 32, T.MINE);
  add(m, 'echo', 18, 33, { kind: 'beast', tint: 'mine' });
  for (const [x, y] of [[3, 32], [28, 32], [16, 32]]) add(m, 'deco', x, y, { kind: 'lamp' });
  return m;
}

// ======================================================================
// 5장: 프리마 (가장 오래된 기관)
// ======================================================================
function buildPrima() {
  const m = M('prima', 40, 56, T.WALL, { name: '프리마', temp: -10, noSwim: true, region: 5, style: 'ruin' });
  room(m, 6, 40, 28, 15, T.FLOOR);
  add(m, 'warp', 19, 53, { look: 'arch', to: 'world', tx: 22, ty: 13 });
  const mask = add(m, 'boss_mask', 19, 45, { id: 'boss_mask', unique: true });
  if (G.f.maskDown) { mask.dead = true; }
  add(m, 'npc', 22, 43, { name: '회색 가면', talk: 'maskDown', look: { cloak: '#5a5a62', body: '#7a7a82', skin: '#cfc8c0', hair: '#3a3a40', mask: '#9a9aa2', crack: true }, id: 'maskNpc', show: () => G.f.maskDown && !G.f.sat });
  add(m, 'npc', 17, 43, { name: '카시안', talk: 'kassianGuard', look: KASSIAN_LOOK, id: 'kassGuard', show: () => G.f.maskDown && !G.f.chamber });
  add(m, 'gate', 19, 40, { look: 'seal', cond: () => G.f.maskDown }); add(m, 'gate', 20, 40, { look: 'seal', cond: () => G.f.maskDown });
  // 비문의 회랑
  room(m, 10, 14, 20, 27, T.FLOOR);
  for (let y = 17; y < 39; y += 4) { S(m, 12, y, T.PILLAR); S(m, 27, y, T.PILLAR); }
  [[13, 36], [26, 31], [13, 24], [26, 18]].forEach(([x, y], i) => add(m, 'stele', x, y, { idx: i, id: 'stele' + i }));
  add(m, 'chest', 26, 37, { weapon: 'ancient' });
  add(m, 'echo', 20, 33, { kind: 'human', tint: 'ruin', act: 'window' });
  add(m, 'echo', 16, 27, { kind: 'wisp', tint: 'ruin' });
  add(m, 'echo', 23, 21, { kind: 'big', tint: 'ruin', act: 'pray' });
  add(m, 'echo', 20, 17, { kind: 'human', tint: 'ruin', act: 'pray' });
  add(m, 'gate', 19, 14, { look: 'seal', cond: () => (G.f.steles || 0) >= 4 }); add(m, 'gate', 20, 14, { look: 'seal', cond: () => (G.f.steles || 0) >= 4 });
  // 심장실
  room(m, 8, 1, 24, 14, T.CARPET);
  const ch = add(m, 'chair', 19, 4); ch.x = 20;
  const cx = 20, cy = 4.5;
  [[15, 3], [25, 3], [14, 7], [26, 7], [16, 10], [24, 10]].forEach(([x, y], i) => add(m, 'chain', x, y, { cx, cy, id: 'chain' + i }));
  for (const y of [40, 14]) { S(m, 19, y, T.FLOOR); S(m, 20, y, T.FLOOR); }
  add(m, 'trigger', 19, 12, { w: 4, h: 1, cond: () => !G.f.chamber, onEnter: () => runScript(TALK.chamber) });
  m.ents[m.ents.length - 1].x = 20;
  for (const [x, y] of [[10, 3], [29, 3], [10, 12], [29, 12]]) add(m, 'deco', x, y, { kind: 'lamp' });
  return m;
}

// ======================================================================
// 봉인 실험실 (공명 결정)
// ======================================================================
function buildLab(i) {
  const [wx, wy] = LABS[i];
  const m = M('lab' + i, 18, 14, T.WALL, { name: '봉인 실험실', temp: 15, noSwim: true, region: 0, style: 'lab', dim: 0.25 });
  room(m, 0, 0, 18, 14, T.FLOOR);
  add(m, 'warp', 8, 12, { look: 'lab', lab: i, to: 'world', tx: wx, ty: wy + 1.5 });
  m.ents[m.ents.length - 1].x = 9;
  add(m, 'chest', 8, 2, { item: 'crystal', id: 'lab:' + i, onOpen: () => toast('공명 결정을 얻었다. 네 개를 모으면 몸이 단단해진다') });
  m.ents[m.ents.length - 1].x = 9;
  const kind = i % 6;
  const title = ['끌어당기는 방', '깨뜨리는 방', '얼리는 방', '붙드는 방', '견디는 방', '두 가지를 쓰는 방'][kind];
  add(m, 'sign', 3, 11, { title: '실험실 명판', text: `「${title}」\n고대 마법사들의 수련실이었다고 전해진다.` });
  if (kind === 0) {
    R(m, 1, 5, 16, 1, T.WALL); S(m, 8, 5, T.FLOOR); S(m, 9, 5, T.FLOOR);
    add(m, 'gate', 8, 5, { cond: () => G.f['labp' + i] }); add(m, 'gate', 9, 5, { cond: () => G.f['labp' + i] });
    add(m, 'plate', 3, 8, { crateOnly: true, onPress: () => { G.f['labp' + i] = true; } });
    add(m, 'crate', 14, 9);
  } else if (kind === 1) {
    R(m, 1, 5, 16, 1, T.CRACK); R(m, 1, 6, 16, 1, T.WALL); S(m, 6, 6, T.CRACK); S(m, 12, 6, T.CRACK);
  } else if (kind === 2) {
    R(m, 1, 4, 16, 5, T.DEEP);
  } else if (kind === 3) {
    R(m, 1, 6, 16, 1, T.WALL); S(m, 8, 6, T.FLOOR); S(m, 9, 6, T.FLOOR);
    const s = add(m, 'spinner', 8, 6, { len: 1.3, speed: 5.2 }); s.x = 9; s.y = 6.5;
    add(m, 'spinner', 4, 9, { len: 1.6, speed: 3 }); add(m, 'spinner', 13, 9, { len: 1.6, speed: -3 });
  } else if (kind === 4) {
    R(m, 1, 5, 16, 1, T.WALL); S(m, 8, 5, T.FLOOR); S(m, 9, 5, T.FLOOR);
    add(m, 'gate', 8, 5, { cond: () => !G.map.ents.some(o => o.type === 'echo' && !o.dead) }); add(m, 'gate', 9, 5, { cond: () => !G.map.ents.some(o => o.type === 'echo' && !o.dead) });
    for (const [x, y] of [[4, 8], [13, 8], [9, 9]]) add(m, 'echo', x, y, { kind: x === 9 ? 'big' : 'human', act: 'window', id: 'labecho' + i + x });
  } else {
    R(m, 1, 5, 16, 1, T.WALL); S(m, 8, 5, T.FLOOR); S(m, 9, 5, T.FLOOR);
    add(m, 'gate', 8, 5, { cond: () => G.f['labp' + i] }); add(m, 'gate', 9, 5, { cond: () => G.f['labp' + i] });
    add(m, 'plate', 3, 8, { crateOnly: true, onPress: () => { G.f['labp' + i] = true; } });
    R(m, 11, 7, 1, 5, T.CRACK); R(m, 12, 7, 5, 1, T.CRACK);
    add(m, 'crate', 14, 9);
  }
  if (i === 2) add(m, 'collect', 15, 2, { key: 'labnote1' });
  if (i === 5) add(m, 'collect', 15, 2, { key: 'labnote2' });
  return m;
}

const BUILDERS = {
  kalidor: buildKalidor, under: buildUnder, world: buildWorld, cathedral: buildCathedral,
  clock: buildClock, mine: buildMine, prima: buildPrima,
};
for (let i = 0; i < LABS.length; i++) BUILDERS['lab' + i] = () => buildLab(i);
function getMap(id) {
  if (!G.maps[id]) {
    const m = BUILDERS[id]();
    // 저장된 깨진 벽 적용
    for (const k in G.done) if (k.startsWith('tile:' + id + ':')) { const [x, y, t] = k.split(':')[2].split(',').map(Number); S(m, x, y, t); }
    G.maps[id] = m;
  }
  return G.maps[id];
}
function coastP() {
  if (!G.f.eng_marcella) return 0;
  return clamp((G.playT - (G.f.marcellaT || 0)) / 120, 0, 1);
}
