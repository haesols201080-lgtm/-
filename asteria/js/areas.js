// 아스테리아 1부 — 실내와 던전: 설계도(칸)를 3D 블록으로 바꾼다
'use strict';

// ---------- 설계도 도우미 ----------
function L(id, w, h, fill, o = {}) { return Object.assign({ id, w, h, tiles: new Uint8Array(w * h).fill(fill), list: [], rooms: [] }, o); }
function S(m, x, y, t) { if (x >= 0 && y >= 0 && x < m.w && y < m.h) m.tiles[y * m.w + x] = t; }
function R(m, x, y, w, h, t) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) S(m, i, j, t); }
function room(m, x, y, w, h, floor = T.FLOOR, wall = T.WALL) { R(m, x, y, w, h, wall); R(m, x + 1, y + 1, w - 2, h - 2, floor); }
function disc(m, cx, cy, r, t) { for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) if (dist(x, y, cx, cy) <= r) S(m, x, y, t); }
// 칸 좌표 (x, y)에 둔다. at: [x, y]를 주면 그 좌표 그대로
function add(m, type, x, y, props = {}) {
  props.id = props.id || `${m.id}:${type}:${x},${y}`;
  m.list.push({ type, at: props.at || [x + 0.5, y + 0.5], props });
  return props;
}

// 칸 → 높이와 성질
function toBlocks(L_) {
  const cs = L_.cs || 2;
  const m = new BlockField(L_.id, L_.w, L_.h, cs);
  Object.assign(m, { name: L_.name, temp: L_.temp ?? 16, style: L_.style, trim: L_.trim, dark: !!L_.dark, dim: L_.dim || 0, noSwim: L_.noSwim !== false, outdoor: !!L_.outdoor, region: L_.region ?? 0, floodHi: L_.floodHi ?? 1.2, floodLo: L_.floodLo ?? -1.2, flood: !!L_.flood, bg: L_.bg || 0x07060c, waterC: L_.waterC });
  const wallH = L_.wallH ?? 6;
  for (let i = 0; i < L_.w * L_.h; i++) setCellI(m, i, L_.tiles[i], L_);
  m.wallH = wallH; m.L = L_; m.blds = L_.blds || []; m.ceil = L_.ceil || 0; m.indoor = !!L_.indoor;
  for (const b of m.blds) for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) m.ch[y * m.cw + x] = b.bh;
  m.rooms = L_.rooms.map(r => Object.assign({ h: wallH }, r));
  for (const it of L_.list) {
    const [ax, ay] = it.at;
    const p = it.props;
    // 칸 단위로 적힌 크기들을 미터로
    for (const k of ['cx', 'cy', 'minx', 'maxx', 'miny', 'maxy', 'dx', 'dy', 'len', 'rad', 'w', 'h', 'hw']) if (typeof p[k] === 'number' && !p.meters) p[k] = p[k] * cs;
    if (p.cy !== undefined) { p.cz = p.cy; delete p.cy; }
    const e = makeEnt(it.type, ax * cs, ay * cs, p);
    m.ents.push(e);
  }
  return m;
}
function setCellI(m, i, t, o) {
  o = o || m.L || {};
  const wallH = o.wallH ?? 6;
  let h = 0, f = 0;
  switch (t) {
    case T.GRASS: f = CF.GRASS; break;
    case T.WALL: h = wallH; if (!o.wallClimb) f = CF.NOCLIMB; break;
    case T.DARK: h = wallH + 0.5; f = CF.NOCLIMB; break;
    case T.CRACK: h = Math.min(wallH, 5); f = CF.NOCLIMB | CF.CRACK; break;
    case T.SHELF: h = 3.0; break;
    case T.ROOF: case T.IVY: h = 5.5; break;
    case T.FENCE: h = 1.0; break;
    case T.PILLAR: h = wallH; f = CF.NOCLIMB; break;
    case T.STAIRS: h = 0.5; break;
    case T.HOUSE: h = 7; break;
    case T.HIGH: h = 2.6; f = CF.NOCLIMB; break;
    case T.DEEP: h = -3; f = CF.WATER; m.cw_[i] = o.waterLv ?? -0.5; break;
    case T.FLOOD: h = -0.3; f = CF.FLOOD | CF.CURRENT; break;
    case T.POOL: h = -0.3; f = CF.FLOOD; break;
  }
  m.ch[i] = h; m.ct[i] = t; m.cf[i] = f;
}
function setCell(m, cx, cz, t) { setCellI(m, cz * m.cw + cx, t); m.dirty = true; }

// ======================================================================
// 칼리도르 학원 (1장): 바깥 도시. 건물 안은 따로 불러오는 장소다
// ======================================================================
function bld(m, x, y, w, h, o) { R(m, x, y, w, h, T.HOUSE); m.blds.push(Object.assign({ x, y, w, h }, o)); }
function buildKalidor() {
  const m = L('kalidor', 64, 48, T.GRASS, { name: '칼리도르 학원', temp: 18, region: 1, outdoor: true, style: 'town', wallH: 9, blds: [] });
  R(m, 0, 0, 64, 1, T.WALL); R(m, 0, 47, 64, 1, T.WALL); R(m, 0, 0, 1, 48, T.WALL); R(m, 63, 0, 1, 48, T.WALL);
  R(m, 30, 0, 4, 20, T.PATH);
  disc(m, 32, 26, 7.3, T.PLAZA);
  R(m, 12, 17, 40, 2, T.PATH); R(m, 11, 19, 2, 11, T.PATH); R(m, 13, 26, 13, 2, T.PATH); R(m, 38, 25, 9, 2, T.PATH); R(m, 38, 30, 14, 2, T.PATH); R(m, 50, 30, 2, 3, T.PATH);
  bld(m, 3, 3, 20, 14, { name: '기록보관소', bh: 9, wall: 0xd8c8a8, roof: 0x8a5a3a, door: [12.5, 17], tower: [19, 5] });
  bld(m, 41, 3, 20, 14, { name: '대강당', bh: 10, wall: 0xe8e0d0, roof: 0x4a5a9a, door: [51, 17], dome: true });
  bld(m, 47, 20, 14, 10, { name: '오스윈 연구실', bh: 7, wall: 0xd0c4d8, roof: 0x6a4a7a, door: [47, 25.5], doorSide: 'w', spire: true });
  bld(m, 41, 33, 20, 12, { name: '식당과 부엌', bh: 7, wall: 0xe8d8c0, roof: 0xa85a4a, door: [51, 33], doorSide: 'n', chimney: true });
  bld(m, 3, 30, 18, 15, { name: '기숙사', bh: 8, wall: 0xd8e0d0, roof: 0x4a7a6a, door: [12, 30], doorSide: 'n' });
  bld(m, 23, 5, 6, 8, { name: '서쪽 상가', bh: 5.5, wall: 0xeadcc0, roof: 0xc4665a, flat: true });
  bld(m, 35, 5, 6, 8, { name: '동쪽 상가', bh: 5.5, wall: 0xeadcc0, roof: 0x5a8ab8, flat: true });
  R(m, 14, 20, 10, 1, T.FENCE); R(m, 14, 24, 4, 1, T.FENCE); R(m, 20, 24, 4, 1, T.FENCE);
  m.trees = [];
  for (let x = 2; x < 62; x += 3) if (x < 28 || x > 35) m.trees.push([x, 1.6]);
  for (const [x, y] of [[26, 34], [38, 34], [25, 20], [39, 20], [8, 20], [57, 18], [24, 40], [34, 42], [24, 45], [36, 45], [62 - 1.6, 32]]) m.trees.push([x, y]);
  add(m, 'fountain', 0, 0, { at: [32, 26] });
  add(m, 'whale', 0, 0, { at: [32, 26] });
  for (const [x, y] of [[26, 21], [38, 21], [26, 31], [38, 31], [31, 14], [34, 14], [12, 22], [50, 28], [10, 18], [46, 31]]) add(m, 'deco', x, y, { kind: 'lamp' });
  for (const [x, y] of [[27, 24], [37, 28], [21, 28], [44, 19], [28, 38], [36, 38]]) add(m, 'deco', x, y, { kind: 'flowerbed' });
  add(m, 'deco', 29, 33, { kind: 'bench' }); add(m, 'deco', 35, 33, { kind: 'bench' });
  add(m, 'deco', 32, 10, { kind: 'statue' });
  add(m, 'deco', 0, 0, { at: [26, 14.2], kind: 'stall', c: '#5a9ae8' }); add(m, 'deco', 0, 0, { at: [38, 14.2], kind: 'stall', c: '#e8a83a' });
  add(m, 'npc', 36, 29, { name: '재봉사 넬', talk: 'tailor', shop: 'tailor', look: { cloak: '#c86a8a', hair: '#3a2a2a' }, show: () => G.f.council });
  add(m, 'npc', 44, 19, { name: '견습생 율', talk: 'student', look: { cloak: '#3b6ea8', hair: '#d8a050' }, wander: 2 });
  add(m, 'npc', 18, 22, { name: '미라', talk: 'mira', look: MIRA_LOOK });
  add(m, 'npc', 28, 29, { name: '핍', talk: 'pip', look: { cloak: '#5aa86a', hair: '#e8c070', scale: 0.75 } });
  add(m, 'npc', 36, 23, { name: '견습생 도린', talk: 'student2', look: { cloak: '#3b6ea8', hair: '#2a2a2a' }, wander: 3 });
  add(m, 'npc', 22, 19, { name: '학생 세라', talk: 'student3', look: { cloak: '#a84a4a', hair: '#7a3a2a' }, wander: 3 });
  for (const [id, x, y, hy] of [['orb1', 16, 23, 1.6], ['orb2', 38, 8, 6.9], ['orb3', 29, 3, 2]]) add(m, 'orb', x, y, { id, hy, show: () => G.f.miraTask && !G.f.miraDone });
  add(m, 'book', 0, 0, { at: [26, 8.5], flee: true, minx: 23.6, maxx: 28.4, miny: 5.6, maxy: 11.4, hy: 6.6, rad: 0.8, c: '#3a6aa8', show: () => G.f.bookTask && !G.f.bookDone });
  add(m, 'book', 30, 22, { id: 'fb9', rad: 5, hy: 7, c: '#c89a3a' }); add(m, 'book', 34, 28, { id: 'fb10', rad: 4, hy: 6, c: '#3a6aa8' }); add(m, 'book', 14, 18, { id: 'fb11', rad: 3, hy: 10, c: '#a83a3a' });
  add(m, 'warp', 0, 0, { at: [32, 0.9], look: 'none', to: 'world', tx: 'gate', rad: 2.2, cond: () => G.f.ch1ready, locked: () => G.f.coat ? '내일 아침에 떠나자. 기숙사에서 자고 가야 한다.' : '원정이 정해지기 전에는 성문이 열리지 않는다.' });
  // 건물 문 → 실내
  add(m, 'warp', 0, 0, { at: [13, 17.7], look: 'bdoor', to: 'archives', tx: 9.5, ty: 11.5, label: '기록보관소', rad: 1.3 });
  add(m, 'warp', 0, 0, { at: [51, 17.7], look: 'bdoor', to: 'hall', tx: 9.5, ty: 11.5, label: '대강당', rad: 1.3 });
  add(m, 'warp', 0, 0, { at: [46.3, 26], look: 'bdoor', face: 'w', to: 'olab', tx: 1.5, ty: 5.5, label: '오스윈 연구실', rad: 1.3 });
  add(m, 'warp', 0, 0, { at: [51, 32.3], look: 'bdoor', face: 'n', to: 'kitchen', tx: 9.5, ty: 1.5, label: '식당', rad: 1.3 });
  add(m, 'warp', 0, 0, { at: [12, 29.3], look: 'bdoor', face: 'n', to: 'dorm', tx: 8.5, ty: 1.5, label: '기숙사', rad: 1.3 });
  return toBlocks(m);
}
// 실내 공통: 천장이 있는 방
function indoor(id, w, h, o) { const m = L(id, w, h, o.floor || T.FLOOR, Object.assign({ temp: 20, region: 1, wallH: 6, ceil: 6, style: 'room', bg: 0x1a1410, indoor: true }, o)); room(m, 0, 0, w, h, o.floor || T.FLOOR); return m; }
function buildArchives() {
  const m = indoor('archives', 20, 14, { name: '기록보관소', style: 'wood', ceil: 7, wallH: 7, bg: 0x140e0a });
  S(m, 9, 13, T.FLOOR); S(m, 10, 13, T.FLOOR);
  R(m, 1, 9, 18, 1, T.SHELF); R(m, 3, 6, 16, 1, T.SHELF); R(m, 1, 3, 16, 1, T.SHELF);
  add(m, 'warp', 0, 0, { at: [10, 13.6], look: 'none', to: 'kalidor', tx: 12.5, ty: 18.5, rad: 1.4 });
  add(m, 'deco', 13, 1, { kind: 'table' });
  add(m, 'npc', 8, 1, { name: '기록관 베르타', talk: 'berta', look: { cloak: '#6a4a8a', hair: '#9a9a9a', body: '#e8e0cf' } });
  add(m, 'collect', 14, 1, { key: 'manuscript', show: () => G.f.delivered });
  for (let i = 0; i < 6; i++) add(m, 'book', 3 + i * 3, 5 + (i % 3) * 2, { id: 'fb' + i, rad: 2 + i % 2, hy: 4 + i % 2 * 0.8, c: ['#a83a3a', '#3a8a5a', '#8a5aa8'][i % 3] });
  for (const [x, y] of [[2, 12], [17, 12], [2, 1], [18, 7]]) add(m, 'deco', x, y, { kind: 'lamp' });
  add(m, 'sign', 12, 11, { title: '기록보관소 규칙', text: '서가에 올라가지 말 것.\n(누군가 그 아래에 "급할 땐 예외"라고 적어 두었다)' });
  return toBlocks(m);
}
function buildHall() {
  const m = indoor('hall', 20, 14, { name: '대강당', floor: T.CARPET, ceil: 9, wallH: 9, bg: 0x10101c });
  S(m, 9, 13, T.CARPET); S(m, 10, 13, T.CARPET);
  for (const y of [3, 10]) for (const x of [3, 16]) S(m, x, y, T.PILLAR);
  add(m, 'warp', 0, 0, { at: [10, 13.6], look: 'none', to: 'kalidor', tx: 50.5, ty: 18.5, rad: 1.4 });
  add(m, 'deco', 9, 5, { kind: 'table', cups: true }); add(m, 'deco', 5, 5, { kind: 'table' }); add(m, 'deco', 13, 5, { kind: 'table' });
  add(m, 'npc', 9, 2, { name: '의장 알드릭', talk: 'aldric', look: { cloak: '#8a2a3a', hair: '#dddddd', body: '#f0e6d0', hat: '#5a1a2a' } });
  add(m, 'npc', 0, 0, { at: [12.5, 3], name: '평의원 소냐', talk: 'councilor', look: { cloak: '#5a3a6a', hair: '#3a2a2a' } });
  add(m, 'collect', 15, 3, { key: 'roster', show: () => G.f.council });
  add(m, 'trigger', 0, 0, { at: [10, 9], w: 18, h: 9, cond: () => G.f.ch1engine && !G.f.council, onEnter: () => runScript(TALK.council) });
  for (const [x, y] of [[1, 1], [18, 1], [1, 12], [18, 12]]) add(m, 'deco', x, y, { kind: 'lamp' });
  add(m, 'deco', 0, 0, { at: [10, 6.5], kind: 'skydome' });
  return toBlocks(m);
}
function buildOLab() {
  const m = indoor('olab', 14, 10, { name: '오스윈 연구실', style: 'wood', bg: 0x120e14 });
  S(m, 0, 5, T.FLOOR); S(m, 0, 6, T.FLOOR);
  add(m, 'warp', 0, 0, { at: [0.5, 6], look: 'none', to: 'kalidor', tx: 45.5, ty: 25.5, rad: 1.2 });
  add(m, 'deco', 6, 3, { kind: 'table', cups: true });
  add(m, 'npc', 8, 2, { name: '오스윈', talk: 'oswin', look: OSWIN_LOOK, show: () => G.f.oswinInLab !== false });
  add(m, 'warp', 11, 7, { look: 'stairs', to: 'under', tx: 4, ty: 14, cond: () => G.f.toUnder, locked: '계단 아래는 기관 회랑이다. 허락 없이는 내려갈 수 없다.', label: '지하 회랑' });
  add(m, 'deco', 12, 1, { kind: 'barrel' }); add(m, 'deco', 2, 1, { kind: 'barrel' });
  add(m, 'deco', 0, 0, { at: [10, 1.5], kind: 'orrery' });
  for (const [x, y] of [[1, 8], [12, 4]]) add(m, 'deco', x, y, { kind: 'lamp' });
  return toBlocks(m);
}
function buildKitchen() {
  const m = indoor('kitchen', 20, 12, { name: '식당과 부엌', bg: 0x160e0a });
  S(m, 9, 0, T.FLOOR); S(m, 10, 0, T.FLOOR);
  add(m, 'warp', 0, 0, { at: [10, 0.5], look: 'none', to: 'kalidor', tx: 50.5, ty: 31.5, rad: 1.2 });
  add(m, 'fire', 16, 2, { look: 'hearth' });
  add(m, 'forage', 2, 2, { item: 'pantry', give: [['carrot', 1], ['potato', 1], ['herb', 1]], regrow: 40 });
  for (const [x, y] of [[5, 6], [11, 6], [15, 8], [5, 9]]) add(m, 'deco', x, y, { kind: 'table', bread: true });
  add(m, 'npc', 12, 3, { name: '요리장 토마', talk: 'toma', look: { cloak: '#e8e0cf', body: '#ffffff', hair: '#5a3a2a', hat: '#ffffff' } });
  for (const [x, y] of [[1, 10], [18, 10], [8, 1]]) add(m, 'deco', x, y, { kind: 'lamp' });
  return toBlocks(m);
}
function buildDorm() {
  const m = indoor('dorm', 18, 15, { name: '기숙사', bg: 0x10141a });
  S(m, 8, 0, T.FLOOR); S(m, 9, 0, T.FLOOR);
  add(m, 'warp', 0, 0, { at: [9, 0.5], look: 'none', to: 'kalidor', tx: 11.5, ty: 28.5, rad: 1.2, cond: () => !G.f.hideHud, locked: '' });
  for (let i = 0; i < 4; i++) add(m, 'deco', 2 + i * 4, 3, { kind: 'bed', c: ['#4a7ab8', '#b84a6a', '#4ab87a', '#b8a04a'][i] });
  for (let i = 0; i < 4; i++) add(m, 'deco', 2 + i * 4, 11, { kind: 'bed', c: ['#8a5ab8', '#b88a4a', '#4a9ab8', '#a84a4a'][i] });
  add(m, 'deco', 9, 7, { kind: 'table' });
  add(m, 'deco', 0, 0, { at: [16, 7], kind: 'window' });
  add(m, 'trigger', 2, 3, { w: 3, h: 3, once: false, cond: () => G.f.coat && !G.f.slept, onEnter: () => TALK.sleep() });
  for (const [x, y] of [[1, 7], [16, 1], [16, 13]]) add(m, 'deco', x, y, { kind: 'lamp' });
  return toBlocks(m);
}

// ======================================================================
// 지하 회랑 (1장)
// ======================================================================
function buildUnder() {
  const m = L('under', 56, 48, T.DARK, { name: '지하 회랑', temp: 10, region: 1, dim: 0.55, style: 'under', trim: 0x7ff0ff });
  room(m, 1, 12, 54, 5);
  add(m, 'warp', 2, 14, { look: 'stairs', to: 'olab', tx: 10.5, ty: 7.5 });
  add(m, 'chest', 7, 13, { weapon: 'wood' });
  add(m, 'sign', 9, 15, { title: '안내판', text: '실험실 네 곳은 봉인되어 있다. 연구원의 공명봉에만 반응한다.\n기관실로 가는 문은 룬 네 개가 모두 있어야 열린다.' });
  const runes = ['magnes', 'stasis', 'cryo', 'burst'];
  for (let i = 0; i < 4; i++) {
    const x0 = 2 + i * 13;
    room(m, x0, 1, 12, 12);
    add(m, 'pedestal', 0, 0, { at: [x0 + 6, 3.5], rune: runes[i] });
    add(m, 'deco', x0 + 2, 2, { kind: 'barrel' });
  }
  for (let i = 0; i < 4; i++) { const x0 = 2 + i * 13; S(m, x0 + 5, 12, T.FLOOR); S(m, x0 + 6, 12, T.FLOOR); }
  add(m, 'plate', 9, 9, { crateOnly: true, onPress: () => { G.f.lab0 = true; } });
  add(m, 'crate', 4, 9);
  add(m, 'gate', 0, 0, { at: [8, 12.5], hw: 2, cond: () => !G.runes.magnes || G.f.lab0 });
  R(m, 16, 7, 10, 1, T.WALL); S(m, 20, 7, T.FLOOR); S(m, 21, 7, T.FLOOR);
  add(m, 'spinner', 0, 0, { at: [21, 7.5], len: 1.4, speed: 3, cond: () => G.runes.stasis });
  room(m, 8, 16, 40, 14);
  room(m, 8, 29, 40, 17);
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
  S(m, 27, 29, T.FLOOR); S(m, 28, 29, T.FLOOR);
  add(m, 'gate', 0, 0, { at: [28, 29.5], hw: 2, look: 'seal', sockets: runes, cond: () => runes.every(r => G.runes[r]) });
  R(m, 9, 31, 7, 1, T.CRACK); R(m, 15, 31, 1, 6, T.CRACK); R(m, 9, 36, 7, 1, T.CRACK);
  add(m, 'pylon', 12, 33, { id: 'pyA', onOn: pylonCheck });
  const sock = add(m, 'plate', 27, 35, { need: 'conduit', crateOnly: true, id: 'sockB' });
  add(m, 'pylon', 27, 33, { id: 'pyB', cond: () => { const p = G.map.ents.find(e => e.id === 'sockB'); return p && p.on; }, hint: '도관이 빠져 있다. 금속이니 인력 룬으로 끌어올 수 있겠다.', onOn: pylonCheck });
  add(m, 'crate', 18, 41, { look: 'conduit' });
  R(m, 34, 30, 13, 9, T.DEEP); R(m, 42, 32, 4, 4, T.FLOOR);
  add(m, 'pylon', 44, 33, { id: 'pyC', onOn: pylonCheck });
  add(m, 'spinner', 42, 35, { len: 1.2, speed: 2.6 });
  add(m, 'sign', 32, 40, { text: '물이 깊고 마력이 섞여 있어 들어갈 수 없다. 결빙 룬(3)으로 얼음 기둥을 세우자. 얼음은 세 개까지 남는다.' });
  S(m, 27, 45, T.FLOOR); S(m, 28, 45, T.FLOOR);
  add(m, 'gate', 0, 0, { at: [28, 45.5], hw: 2, look: 'seal', cond: () => G.f.pylons });
  add(m, 'trigger', 0, 0, { at: [28, 44.5], w: 3, h: 1, cond: () => G.f.pylons, onEnter: () => runScript(TALK.engineRoom) });
  for (const [x, y] of [[10, 43], [46, 43], [20, 38], [6, 14], [30, 14], [50, 14]]) add(m, 'deco', x, y, { kind: 'lamp' });
  return toBlocks(m);
}
function pylonCheck() {
  const n = ['pyA', 'pyB', 'pyC'].filter(isDone).length;
  toast(`중계탑 ${n} / 3`);
  if (n >= 3) { G.f.pylons = true; runScript(async () => { await wait(0.5); sfx('open'); await say('렌', '세 개 다 켜졌다. 기관실 문이 열린다!'); }); }
}

// ======================================================================
// 2장: 성녀 마렌 성당
// ======================================================================
function buildCathedral() {
  const m = L('cathedral', 48, 40, T.WALL, { name: '성녀 마렌 성당', temp: 22, flood: true, region: 2, style: 'salt', trim: 0xbff4ff, wallH: 8, dim: 0.2, bg: 0x1a2230, waterC: 0x4aa8d8 });
  room(m, 12, 22, 24, 16);
  room(m, 1, 6, 12, 30); room(m, 35, 6, 12, 30); room(m, 12, 4, 24, 19);
  S(m, 12, 30, T.FLOOR); S(m, 12, 31, T.FLOOR); S(m, 35, 30, T.FLOOR); S(m, 35, 31, T.FLOOR); S(m, 23, 22, T.FLOOR); S(m, 24, 22, T.FLOOR);
  R(m, 2, 12, 10, 16, T.FLOOD);
  R(m, 36, 7, 10, 20, T.POOL); R(m, 40, 8, 5, 3, T.HIGH);
  add(m, 'warp', 0, 0, { at: [24, 36.6], look: 'arch', to: 'world', tx: 'cathedral' });
  add(m, 'lever', 0, 0, { at: [24, 26.5], look: 'arm', label: '종루의 팔', verb: '팔 돌리기', onUse: () => { G.map.flood = !G.map.flood; G.shake = 0.5; sfx('rumble'); toast(G.map.flood ? '바닷물이 밀려 들어온다 · 수위 높음' : '바닷물이 빠져나간다 · 수위 낮음'); } });
  add(m, 'sign', 18, 32, { title: '순례자의 낙서', text: '종루의 팔을 돌리면 바다가 성당 안으로 들어오고 나간다.\n서쪽 회랑은 물살이 세다. 동쪽 예배당의 물은 잔잔하다.' });
  for (const [x, y] of [[15, 25], [32, 25], [15, 34], [32, 34]]) add(m, 'deco', x, y, { kind: 'lamp' });
  add(m, 'collect', 30, 33, { key: 'prayer' });
  add(m, 'lever', 6, 8, { label: '봉인 A', verb: '봉인 풀기', c: '#7ff0ff', onUse: () => { if (!G.f.sealA) { G.f.sealA = true; sfx('chime'); toast('봉인 하나가 풀렸다'); } } });
  add(m, 'echo', 5, 30, { kind: 'human', tint: 'salt', act: 'pray' });
  add(m, 'echo', 9, 9, { kind: 'beast', tint: 'salt' });
  add(m, 'lever', 42, 9, { label: '봉인 B', verb: '봉인 풀기', c: '#7ff0ff', onUse: () => { if (!G.f.sealB) { G.f.sealB = true; sfx('chime'); toast('봉인 하나가 풀렸다'); } } });
  add(m, 'crust', 0, 0, { at: [34.5, 31], look: 'salt', w: 1.4 });
  add(m, 'echo', 40, 30, { kind: 'human', tint: 'salt', act: 'pray' });
  add(m, 'sign', 38, 33, { title: '돌판', text: '높은 단은 물이 찼을 때만 닿는다. 얼음 기둥 위에서는 단에 오를 수 있다.' });
  add(m, 'gate', 0, 0, { at: [24, 22.5], hw: 2, look: 'seal', cond: () => G.f.sealA && G.f.sealB });
  add(m, 'boss_salt', 0, 0, { at: [24, 12.5], id: 'boss_salt', unique: true });
  add(m, 'core', 0, 0, { at: [24, 6.5], flag: 'eng_marcella', talk: 'coreMarcella', c: '#9ff4ff', verb: '기관 고치기' });
  add(m, 'plaque', 0, 0, { at: [18.5, 5.4], talk: 'plaqueMarcella' });
  for (const [x, y] of [[14, 6], [33, 6], [14, 20], [33, 20]]) add(m, 'deco', x, y, { kind: 'lamp' });
  return toBlocks(m);
}

// ======================================================================
// 3장: 시계탑 기관
// ======================================================================
function buildClock() {
  const m = L('clock', 44, 44, T.WALL, { name: '시계탑 기관', temp: 12, region: 3, style: 'wood', trim: 0xffc880, dim: 0.3, bg: 0x140c08 });
  if (!G.rings) G.rings = [0, 2, 3];
  if (G.ringsMesh === undefined) G.ringsMesh = true;
  room(m, 12, 32, 20, 11); room(m, 12, 21, 20, 12); room(m, 12, 10, 20, 12); room(m, 8, 0, 28, 11);
  for (const y of [32, 21, 10]) { S(m, 21, y, T.FLOOR); S(m, 22, y, T.FLOOR); }
  add(m, 'warp', 0, 0, { at: [22, 41.6], look: 'door', to: 'world', tx: 'clock' });
  add(m, 'lever', 15, 36, { label: '고리 1', verb: '고리 1 돌리기', onUse: () => rotRing(0) });
  add(m, 'ringface', 19, 34, { ring: 0 }); add(m, 'ringface', 24, 34, { ring: 1 });
  add(m, 'sign', 28, 38, { title: '관리인의 메모', text: '문은 양쪽 방 고리의 바늘이 같은 곳을 가리킬 때 열린다.\n고리 2와 고리 3은 맞물려 함께 돈다. 맞물림을 풀면 고리 2만 돈다.\n마지막 문은 고리 3이 정오(위)를 가리킬 때 열린다.' });
  add(m, 'collect', 14, 40, { key: 'inscription' });
  add(m, 'gate', 0, 0, { at: [22, 32.5], hw: 2, cond: () => G.rings[0] === G.rings[1] });
  add(m, 'lever', 15, 27, { label: '고리 2', verb: '고리 2 돌리기', onUse: () => { rotRing(1); if (G.ringsMesh) rotRing(2); } });
  add(m, 'lever', 28, 27, { label: '맞물림', verb: '맞물림 바꾸기', c: '#ffd27a', onUse: () => { G.ringsMesh = !G.ringsMesh; toast(G.ringsMesh ? '고리 2와 3이 맞물렸다' : '고리 2와 3의 맞물림이 풀렸다'); } });
  add(m, 'ringface', 19, 23, { ring: 1 }); add(m, 'ringface', 24, 23, { ring: 2 });
  add(m, 'echo', 16, 30, { kind: 'human', tint: 'time', act: 'sweep' });
  add(m, 'echo', 27, 30, { kind: 'wisp', tint: 'time' });
  add(m, 'gate', 0, 0, { at: [22, 21.5], hw: 2, cond: () => G.rings[1] === G.rings[2] });
  add(m, 'spinner', 17, 15, { len: 2.2, speed: 2.8 }); add(m, 'spinner', 26, 15, { len: 2.2, speed: -3.2 });
  add(m, 'ringface', 22, 18, { ring: 2 });
  add(m, 'chest', 14, 12, { weapon: 'leafblade' });
  add(m, 'echo', 22, 13, { kind: 'big', tint: 'time', act: 'hunt' });
  add(m, 'gate', 0, 0, { at: [22, 10.5], hw: 2, cond: () => G.rings[2] === 0 });
  add(m, 'boss_hunter', 0, 0, { at: [22, 5.5], id: 'boss_hunter', unique: true, cx: 22, cy: 5.5 });
  for (const [x, y] of [[10, 2], [33, 2], [10, 8], [33, 8]]) add(m, 'lever', x, y, { label: '시간 고리', verb: '시간 늦추기', c: '#ffc880', onUse: e => { const b = G.map.ents.find(o => o.type === 'boss_hunter' && !o.dead); if (b && b.awake) { if (e.used > G.t) { toast('고리가 아직 돌아오는 중이다'); return; } e.used = G.t + 9; b.slowT = 5; sfx('freeze'); toast('사냥꾼의 시간이 느려졌다. 지금이다!'); } } });
  add(m, 'core', 0, 0, { at: [22, 2.2], flag: 'eng_elm', talk: 'coreElm', c: '#ffc880', verb: '조율기 살피기' });
  return toBlocks(m);
}
function rotRing(i) { G.rings[i] = (G.rings[i] + 1) % 4; sfx('blip'); G.shake = 0.15; }

// ======================================================================
// 4장: 그라벤호프 제3갱
// ======================================================================
function buildMine() {
  const m = L('mine', 64, 48, T.DARK, { name: '그라벤호프 제3갱', temp: 1, dark: true, region: 4, style: 'mine', bg: 0x030204 });
  room(m, 1, 1, 14, 10, T.MINE, T.DARK);
  room(m, 14, 4, 24, 4, T.MINE, T.DARK);
  room(m, 37, 4, 5, 11, T.MINE, T.DARK);
  room(m, 36, 14, 26, 20, T.MINE, T.DARK);
  room(m, 44, 1, 19, 12, T.MINE, T.DARK);
  room(m, 4, 10, 4, 21, T.MINE, T.DARK);
  room(m, 1, 30, 30, 17, T.MINE, T.DARK);
  room(m, 30, 30, 7, 4, T.MINE, T.DARK);
  for (const [x, y] of [[14, 5], [14, 6], [37, 5], [37, 6], [39, 14], [5, 10], [6, 10], [5, 30], [6, 30], [30, 31], [30, 32], [36, 31], [36, 32]]) S(m, x, y, T.MINE);
  R(m, 52, 12, 1, 3, T.MINE);
  S(m, 25, 6, T.CRACK);
  R(m, 2, 38, 28, 8, T.DEEP);
  add(m, 'warp', 2, 2, { look: 'cave', to: 'world', tx: 'mine' });
  add(m, 'fire', 9, 4, { id: 'fire:mine' });
  add(m, 'sign', 6, 8, { title: '갱 입구', text: '그라벤호프 제3갱. 아래 갱도는 떨림 이후 물에 잠겼다.\n어두우니 횃불을 들 것. 횃불은 몸도 조금 데워준다.' });
  add(m, 'chest', 12, 3, { item: 'torch', onOpen: () => { G.torch = true; toast('횃불을 들었다. 어둠이 조금 물러난다'); } });
  add(m, 'crate', 25, 5, { look: 'cart' });
  add(m, 'echo', 32, 5, { kind: 'human', tint: 'mine', act: 'dig' });
  add(m, 'crate', 39, 10, { look: 'cart' });
  for (const [x, y] of [[40, 18], [57, 18], [40, 30], [57, 30]]) add(m, 'deco', x, y, { kind: 'lamp' });
  add(m, 'boss_mine', 48, 24, { id: 'boss_mine', unique: true });
  add(m, 'collect', 59, 16, { key: 'minerLetter' });
  add(m, 'gate', 52, 13, { hw: 1, cond: () => G.f.mineBoss });
  add(m, 'core', 58, 3, { flag: 'eng_grav', talk: 'coreGrav', c: '#ff9a5a', verb: '용광로 살피기', look: 'furnace' });
  add(m, 'collect', 60, 10, { key: 'relayMap' });
  const shapes = { '47,5': 'L', '48,5': 'I', '49,5': 'L', '50,5': 'I', '47,6': 'L', '48,6': 'T', '49,6': 'I', '50,6': 'L', '47,7': 'I', '48,7': 'L', '49,7': 'L', '50,7': 'L' };
  const sol = { '47,6': 3, '47,5': 1, '48,5': 1, '49,5': 2, '49,6': 0, '49,7': 0, '50,7': 3, '50,6': 1 };
  for (const k in shapes) { const [x, y] = k.split(',').map(Number); add(m, 'pipe', x, y, { shape: shapes[k], rot: ((sol[k] ?? 0) + 1 + ((x * 3 + y) % 3)) % 4, id: 'pipe' + k, gx: x, gy: y }); }
  add(m, 'pipe', 51, 6, { shape: 'L', rot: 0, valve: true, id: 'valve', gx: 51, gy: 6 });
  add(m, 'deco', 46, 6, { kind: 'source' });
  add(m, 'sign', 51, 3, { title: '남쪽 중계선', text: '남쪽 중계선 → 칼리도르 외곽 · 남부 마을들' });
  add(m, 'sign', 51, 9, { title: '배수 펌프', text: '배수 펌프 → 아래 갱도' });
  add(m, 'sign', 45, 9, { title: '정비 지침', text: '마력은 왼쪽 원천에서 들어온다. 관을 이어 밸브까지 흐르게 할 것.\n밸브가 가리키는 쪽으로 마력이 간다. 학원 규격: 남쪽 중계선.' });
  add(m, 'lever', 55, 9, { label: '기관 점화', verb: '점화하기', c: '#ff9a3a', onUse: e => TALK.ignite(e) });
  add(m, 'sign', 8, 33, { title: '배수 수문 제어', text: '배수 수문 다섯 개. 기관에 동력이 있을 때만 움직인다.\n철 수문은 끌어당겨서, 걸린 수문은 깨뜨려서 연다.\n문 하나마다 아래 갱도 하나의 물이 빠진다.' });
  [[5, 'iron'], [10, 'jam'], [15, 'iron'], [20, 'jam'], [25, 'iron']].forEach(([x, k], i) => add(m, 'floodgate', x, 37, { kind: k, idx: i, id: 'fg' + i }));
  add(m, 'trigger', 0, 0, { at: [15.5, 34.5], w: 26, h: 6, once: false, cond: () => G.f.manualUntil && G.t < G.f.manualUntil && !G.f.manualStart, onEnter: () => TALK.manualStart() });
  add(m, 'echo', 18, 33, { kind: 'beast', tint: 'mine' });
  for (const [x, y] of [[3, 32], [28, 32], [16, 32], [6, 20], [25, 6]]) add(m, 'deco', x, y, { kind: 'lamp' });
  return toBlocks(m);
}

// ======================================================================
// 5장: 프리마
// ======================================================================
function buildPrima() {
  const m = L('prima', 40, 56, T.WALL, { name: '프리마', temp: -10, region: 5, style: 'ruin', trim: 0xc0b0ff, wallH: 8, dim: 0.25, bg: 0x0c0a18 });
  room(m, 6, 40, 28, 15); room(m, 10, 14, 20, 27); room(m, 8, 1, 24, 14, T.CARPET);
  for (let y = 17; y < 39; y += 4) { S(m, 12, y, T.PILLAR); S(m, 27, y, T.PILLAR); }
  for (const y of [40, 14]) { S(m, 19, y, T.FLOOR); S(m, 20, y, T.FLOOR); }
  add(m, 'warp', 0, 0, { at: [20, 53.6], look: 'arch', to: 'world', tx: 'prima' });
  add(m, 'boss_mask', 0, 0, { at: [20, 45], id: 'boss_mask', unique: true });
  add(m, 'npc', 22, 43, { name: '회색 가면', talk: 'maskDown', look: { cloak: '#5a5a62', body: '#7a7a82', skin: '#cfc8c0', hair: '#3a3a40', mask: '#9a9aa2', crack: true }, id: 'maskNpc', show: () => G.f.maskDown, sit: true });
  add(m, 'npc', 17, 43, { name: '카시안', talk: 'kassianGuard', look: KASSIAN_LOOK, id: 'kassGuard', show: () => G.f.maskDown && !G.f.chamber });
  add(m, 'gate', 0, 0, { at: [20, 40.5], hw: 2, look: 'seal', cond: () => G.f.maskDown });
  [[13, 36], [26, 31], [13, 24], [26, 18]].forEach(([x, y], i) => add(m, 'stele', x, y, { idx: i, id: 'stele' + i }));
  add(m, 'chest', 26, 37, { weapon: 'ancient' });
  add(m, 'echo', 20, 33, { kind: 'human', tint: 'ruin', act: 'window' });
  add(m, 'echo', 16, 27, { kind: 'wisp', tint: 'ruin' });
  add(m, 'echo', 23, 21, { kind: 'big', tint: 'ruin', act: 'pray' });
  add(m, 'echo', 20, 17, { kind: 'human', tint: 'ruin', act: 'pray' });
  add(m, 'gate', 0, 0, { at: [20, 14.5], hw: 2, look: 'seal', cond: () => (G.f.steles || 0) >= 4 });
  add(m, 'chair', 0, 0, { at: [20, 4.5] });
  [[15, 3], [25, 3], [14, 7], [26, 7], [16, 10], [24, 10]].forEach(([x, y], i) => add(m, 'chain', x, y, { cx: 20, cy: 4.5, id: 'chain' + i }));
  add(m, 'trigger', 0, 0, { at: [20, 12.5], w: 4, h: 1, cond: () => !G.f.chamber, onEnter: () => runScript(TALK.chamber) });
  for (const [x, y] of [[10, 3], [29, 3], [10, 12], [29, 12], [8, 44], [31, 44]]) add(m, 'deco', x, y, { kind: 'lamp', c: '#c0b0ff' });
  return toBlocks(m);
}

// ======================================================================
// 봉인 실험실
// ======================================================================
function buildLab(i) {
  const m = L('lab' + i, 18, 14, T.WALL, { name: '봉인 실험실', temp: 15, region: 0, style: 'lab', trim: 0x7ff0ff, dim: 0.3, bg: 0x060a14 });
  room(m, 0, 0, 18, 14);
  add(m, 'warp', 0, 0, { at: [9, 12.6], look: 'lab', lab: i, to: 'world', tx: 'lab' + i });
  add(m, 'chest', 0, 0, { at: [9, 2.5], item: 'crystal', id: 'lab:' + i, onOpen: () => toast('공명 결정을 얻었다. 네 개를 모으면 몸이 단단해진다') });
  const kind = i % 6;
  const title = ['끌어당기는 방', '깨뜨리는 방', '얼리는 방', '붙드는 방', '견디는 방', '두 가지를 쓰는 방'][kind];
  add(m, 'sign', 3, 11, { title: '실험실 명판', text: `「${title}」\n고대 마법사들의 수련실이었다고 전해진다.` });
  add(m, 'deco', 0, 0, { at: [9, 7], kind: 'runefloor' });
  if (kind === 0 || kind === 5 || kind === 4) { R(m, 1, 5, 16, 1, T.WALL); S(m, 8, 5, T.FLOOR); S(m, 9, 5, T.FLOOR); }
  if (kind === 0) {
    add(m, 'gate', 0, 0, { at: [9, 5.5], hw: 2, cond: () => G.f['labp' + i] });
    add(m, 'plate', 3, 8, { crateOnly: true, onPress: () => { G.f['labp' + i] = true; } });
    add(m, 'crate', 14, 9);
  } else if (kind === 1) {
    R(m, 1, 5, 16, 1, T.CRACK); R(m, 1, 6, 16, 1, T.WALL); S(m, 6, 6, T.CRACK); S(m, 12, 6, T.CRACK);
  } else if (kind === 2) {
    R(m, 1, 4, 16, 5, T.DEEP);
  } else if (kind === 3) {
    R(m, 1, 6, 16, 1, T.WALL); S(m, 8, 6, T.FLOOR); S(m, 9, 6, T.FLOOR);
    add(m, 'spinner', 0, 0, { at: [9, 6.5], len: 1.4, speed: 5.2 });
    add(m, 'spinner', 4, 9, { len: 1.6, speed: 3 }); add(m, 'spinner', 13, 9, { len: 1.6, speed: -3 });
  } else if (kind === 4) {
    const alive = () => !G.map.ents.some(o => o.type === 'echo' && !o.dead);
    add(m, 'gate', 0, 0, { at: [9, 5.5], hw: 2, cond: alive });
    for (const [x, y] of [[4, 8], [13, 8], [9, 9]]) add(m, 'echo', x, y, { kind: x === 9 ? 'big' : 'human', act: 'window', id: 'labecho' + i + x });
  } else {
    add(m, 'gate', 0, 0, { at: [9, 5.5], hw: 2, cond: () => G.f['labp' + i] });
    add(m, 'plate', 3, 8, { crateOnly: true, onPress: () => { G.f['labp' + i] = true; } });
    R(m, 11, 7, 1, 5, T.CRACK); R(m, 12, 7, 5, 1, T.CRACK);
    add(m, 'crate', 14, 9);
  }
  if (i === 2) add(m, 'collect', 15, 2, { key: 'labnote1' });
  if (i === 5) add(m, 'collect', 15, 2, { key: 'labnote2' });
  return toBlocks(m);
}

const BUILDERS = { kalidor: buildKalidor, archives: buildArchives, hall: buildHall, olab: buildOLab, kitchen: buildKitchen, dorm: buildDorm, under: buildUnder, world: buildWorld, cathedral: buildCathedral, clock: buildClock, mine: buildMine, prima: buildPrima };
for (let i = 0; i < LABS.length; i++) BUILDERS['lab' + i] = () => buildLab(i);
// 다른 곳에서 대륙으로 나올 때 서는 자리
function worldExit(key) {
  const k = String(key);
  if (k === 'gate') return [PLACES.kalidorGate[0], PLACES.kalidorGate[1] - 10];
  if (k === 'cathedral') return [PLACES.cathedral[0], PLACES.cathedral[1] + 9];
  if (k === 'clock') return [PLACES.clock[0], PLACES.clock[1] + 9];
  if (k === 'mine') return [PLACES.mine[0], PLACES.mine[1] + 9];
  if (k === 'prima') return [PLACES.prima[0], PLACES.prima[1] + 16];
  if (k.startsWith('lab')) { const [u, v] = LABS[+k.slice(3)]; const [x, z] = M_(u, v); return [x, z + 7]; }
  return [PLACES.kalidorGate[0], PLACES.kalidorGate[1] - 10];
}
function getMap(id) {
  if (!G.maps[id]) {
    const m = BUILDERS[id]();
    if (m.kind === 'blocks') {
      for (const k in G.done) if (k.startsWith('cell:' + id + ':')) { const [x, z, t] = k.split(':')[2].split(',').map(Number); setCellI(m, z * m.cw + x, t); }
      if (G.f['flood_' + id] !== undefined) m.flood = G.f['flood_' + id];
    }
    G.maps[id] = m;
  }
  return G.maps[id];
}
