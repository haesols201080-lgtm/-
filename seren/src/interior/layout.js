// 층 하나의 평면 (v0.9): 바닥 덮개 + 수직 심 → 복도·방·문·출입구·테라스 문. 처음 그 층이 필요할 때 만든다.
//  · 둘레 복도(ring): 심을 두른 복도 + 긴 날개로 뻗는 복도 + 깊은 바닥이면 바깥벽에서 방 깊이만큼 들어온 둘째 고리.
//    복도에 닿은 칸에서 바깥벽 쪽으로 곧게 퍼지며 칸마다 「복도의 어느 자리에 면했나」를 매기고(펼친 길이 t),
//    t 를 쓰임의 방 너비로 잘라 방을 만든다 → 모든 방이 복도에 닿고, 칸막이는 복도에 수직으로 곧다(둥근 건물은 부채꼴).
//  · 넓은 홀(open/hall/gallery): 홀 + 뒤쪽 벽을 따라 일하는 방(창고·직원실·주방·하역장…) + 앞쪽 손님 자리. 전시는 이어진 방.
//  · 집(house)·세대(unit): 현관 쪽 깊이·옆 자리로 씻는 방·부엌·잠방·거실을 나누고 방 사이에 문.
//  · 출입구: 1층 정문은 바깥 문과 같은 자리(실내는 바깥 문 그 자리에서 열린다), 일하는 쪽은 뒤에 하역 문.
//  · 결과는 순수 자료(Int16 방 번호 칸 + 방·문 목록) — 그리기·충돌·길찾기·지도·모아가 모두 이것을 읽는다.
import { FUSE, ROOMS, flowRoom, MIN_FIT_SKIP, minFit, fitSideIds } from './catalog.js';
import { rngFor, pick, shuffle } from './ids.js';
import { cellX, cellZ } from './volume.js';
import { searchMezzStair } from './core.js';

const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// ── 칸 도구 ───────────────────────────────────────────────
class Grid {
  constructor(gw, gh) { this.gw = gw; this.gh = gh; this.n = gw * gh; }
  c(i, j) { return j * this.gw + i; }
  i(c) { return c % this.gw; }
  j(c) { return (c / this.gw) | 0; }
  ok(i, j) { return i >= 0 && j >= 0 && i < this.gw && j < this.gh; }
  nb(c, f) { const i = c % this.gw, j = (c / this.gw) | 0; for (const [di, dj] of D4) { const a = i + di, b = j + dj; if (a >= 0 && b >= 0 && a < this.gw && b < this.gh) f(b * this.gw + a, di, dj); } }
}

/** 거리 지도 (4방향 BFS): from 칸들에서 through 칸들로 */
function bfs(g, from, through) {
  const d = new Int32Array(g.n).fill(-1);
  const q = new Int32Array(g.n);
  let h = 0, t = 0;
  for (const c of from) { if (d[c] < 0) { d[c] = 0; q[t++] = c; } }
  while (h < t) {
    const c = q[h++];
    g.nb(c, (e) => { if (d[e] < 0 && through(e)) { d[e] = d[c] + 1; q[t++] = e; } });
  }
  return d;
}

/** 덩어리 나누기 */
function components(g, cells, pred) {
  const seen = new Uint8Array(g.n), out = [];
  for (const c0 of cells) {
    if (seen[c0] || !pred(c0)) continue;
    const comp = [c0];
    seen[c0] = 1;
    for (let k = 0; k < comp.length; k++) g.nb(comp[k], (e) => { if (!seen[e] && pred(e)) { seen[e] = 1; comp.push(e); } });
    out.push(comp);
  }
  return out;
}

// ── 방 짜임 (둘레 복도 층): 쓰임 → 방 종류와 너비(m) ───────────────
/** 펼친 길이 T 의 방 띠를 자를 순서. first: 그 쓰임(조직)의 첫 층인가 */
function ringProgram(use, T, rnd, o) {
  const seq = [];
  const add = (type, w) => seq.push({ type, w });
  switch (use) {
    case 'office': case 'admin': {
      add('wc', 4); add('pantry', 5);
      if (o.first) add('hr', 5);
      add('meeting', 6 + Math.floor(rnd() * 3));
      add('manager', 5);
      if (rnd() < 0.6 || o.first) add('server', 4);
      if (use === 'admin') add('records', 6);
      let left = T - seq.reduce((a, b) => a + b.w, 0);
      while (left > 7) { const w = Math.min(left, 10 + Math.floor(rnd() * 10)); add('open', w); left -= w; if (left > 18 && rnd() < 0.35) { add('meeting', 6); left -= 6; } }
      break;
    }
    case 'research': {
      add('wc', 3); add('coldroom', 4); add('instrument', 7); add('analysis', 6);
      if (rnd() < 0.5) add('cleanroom', 7);
      let left = T - seq.reduce((a, b) => a + b.w, 0);
      while (left > 7) { const w = Math.min(left, 8 + Math.floor(rnd() * 4)); add('labroom', w); left -= w; }
      break;
    }
    case 'clinic': {
      add('wc', 3); add('nurse', 5); add('scan', 8); add('treat', 6); add('pharmacy', 5); add('waiting', 7);
      let left = T - seq.reduce((a, b) => a + b.w, 0);
      while (left > 4) { add('consult', 4 + Math.floor(rnd() * 2)); left -= 5; }
      break;
    }
    case 'diag': { // 검사·영상층: 울림 스캐너 여럿 · 검체 실험실 · 청정 영상실 · 처치 · 대기
      add('wc', 3); add('nurse', 5); add('waiting', 8); add('scan', 9); add('scan', 8); add('labroom', 9); add('cleanroom', 8); add('treat', 6); add('analysis', 6);
      let left = T - seq.reduce((a, b) => a + b.w, 0);
      while (left > 6) { add(rnd() < 0.5 ? 'scan' : 'consult', 6); left -= 6; }
      break;
    }
    case 'confer': { // 회의·교육층: 큰 교육장(객석) · 회의실 여럿 · 휴게
      add('wc', 4); add('pantry', 5); add('auditorium', 16); add('lounge', 8);
      let left = T - seq.reduce((a, b) => a + b.w, 0);
      while (left > 6) { add('meeting', 6 + Math.floor(rnd() * 4)); left -= 8; }
      break;
    }
    case 'exec': { // 임원층: 이사회실 · 책임자실 여럿 · 채용 면접실 · 응접 휴게
      add('wc', 4); add('pantry', 5); add('meeting', 12); add('hr', 5); add('lounge', 7); add('records', 5);
      let left = T - seq.reduce((a, b) => a + b.w, 0);
      while (left > 5) { add('manager', 5 + Math.floor(rnd() * 2)); left -= 6; }
      break;
    }
    case 'ward': {
      add('nurse', 6); add('treat', 5); add('storage', 3); add('wc', 3);
      let left = T - 17;
      while (left > 5) { add('wardroom', 5 + Math.floor(rnd() * 2)); left -= 6; }
      break;
    }
    case 'faculty': { // 학교의 교무·행정층: 큰 교무실 · 교장실 · 상담 · 회의 · 기록 · 채용 면접실
      add('wc', 4); add('pantry', 5); add('teachers', 14); add('manager', 6); add('meeting', 8); add('records', 6); add('hr', 5);
      let left = T - seq.reduce((a, b) => a + b.w, 0);
      while (left > 7) { const w = Math.min(left, 8 + Math.floor(rnd() * 4)); add(rnd() < 0.5 ? 'teachers' : 'meeting', w); left -= w; }
      break;
    }
    case 'school': {
      add('wc', 4); add('teachers', 7); add('storage', 3);
      if (o.k % 2 === 0) add('sciroom', 9); else add('musicroom', 8);
      if (o.k === 1) add('canteen', 10);
      let left = T - seq.reduce((a, b) => a + b.w, 0);
      while (left > 7) { add('classroom', 8 + Math.floor(rnd() * 2)); left -= 9; }
      break;
    }
    case 'residential': {
      const uw = 7 + Math.floor(rnd() * 5);
      if (rnd() < 0.3) add('lounge', 6);
      let left = T - seq.reduce((a, b) => a + b.w, 0);
      while (left > 5) { const w = left < uw * 1.6 ? left : uw + Math.floor(rnd() * 3) - 1; add('unit', w); left -= w; }
      break;
    }
    case 'hotel': {
      add('housekeeping', 4); add('storage', 3);
      let left = T - 7;
      const gw = 4 + Math.floor(rnd() * 2);
      while (left > 3.5) { const w = left < gw * 1.6 ? left : gw; add('guestroom', w); left -= w; }
      break;
    }
    case 'tech': default: {
      add('mech', 10); add('storage', 4); add('server', 5);
      let left = T - 19;
      while (left > 6) { add('mech', Math.min(left, 12)); left -= 12; }
    }
  }
  return fitRing(use, seq, T);
}
/** 방 종류마다 쓰임의 가구(책상 묶음·학생 책상과 칠판·침상·잠 고치와 조리대…)가 들어가는 가장 작은 넓이 (m²) */
const MIN_ROOM = { open: 10, classroom: 14, sciroom: 12, musicroom: 10, labroom: 10, consult: 6, wardroom: 10, guestroom: 11, unit: 15, meeting: 6, manager: 5, teachers: 8, treat: 6, scan: 8, waiting: 8, nurse: 5, pharmacy: 5, hr: 5, records: 5, instrument: 6, analysis: 6, cleanroom: 6, auditorium: 16, lounge: 6, canteen: 20 };
/** 방 안에 2×2 칸(2 m 정사각)이 몇 개 들어가나 — 0 이면 폭 1 m 띠 방 */
function fat(g, room, R) {
  const id = R.id + 1;
  let n = 0;
  for (let c = 0; c < g.n; c++) {
    if (room[c] !== id) continue;
    const i = g.i(c), j = g.j(c);
    if (g.ok(i + 1, j + 1) && room[g.c(i + 1, j)] === id && room[g.c(i, j + 1)] === id && room[g.c(i + 1, j + 1)] === id) n++;
  }
  return n;
}
/** 고리형 층의 본실 (이 쓰임의 일이 실제로 일어나는 방) · 작은 층에서도 남겨야 할 방 */
const RING_MAIN = { office: 'open', admin: 'open', research: 'labroom', clinic: 'consult', diag: 'scan', confer: 'meeting', exec: 'manager', ward: 'wardroom', faculty: 'teachers', school: 'classroom', residential: 'unit', hotel: 'guestroom', tech: 'mech' };
const RING_MIN = { open: 8, labroom: 7, consult: 4, scan: 6, meeting: 6, manager: 5, wardroom: 5, teachers: 6, classroom: 7, unit: 6, guestroom: 4, mech: 6 };
const RING_NEED = { clinic: ['waiting'], diag: ['waiting'], ward: ['nurse'] };
/** 덜 급한 부속실부터 (작은 층에서 먼저 빠진다) */
const RING_DROP = ['server', 'storage', 'records', 'coldroom', 'cleanroom', 'pantry', 'hr', 'lounge', 'housekeeping', 'instrument', 'analysis', 'musicroom', 'sciroom', 'canteen', 'pharmacy', 'treat', 'nurse', 'scan', 'auditorium', 'meeting', 'manager', 'teachers', 'wc'];
/**
 * 작은 층: 방 목록이 이 띠의 길이(T m)에 다 들어가지 않으면 본실을 남기고 부속실부터 뺀다 — 작은 학교의 1층이
 * 정화실·창고로만 채워지고 교실이 없는 일이 없게. 본실이 목록에 없으면(부속실만으로 띠가 찼으면) 넣는다.
 */
function fitRing(use, seq, T) {
  const main = RING_MAIN[use] || 'mech', need = RING_NEED[use] || [];
  const sum = () => seq.reduce((a, q) => a + q.w, 0);
  if (!seq.some((q) => q.type === main)) seq.push({ type: main, w: RING_MIN[main] || 6 });
  for (const t of RING_DROP) {
    if (sum() <= T * 1.15) break;
    if (t === main || need.includes(t)) continue;
    for (let k = seq.length - 1; k >= 0 && sum() > T * 1.15; k--) if (seq[k].type === t) seq.splice(k, 1);
  }
  // 작은 띠: 본실이 띠의 절반은 갖게 (부속실이 본실보다 커지지 않게)
  const mains = seq.filter((q) => q.type === main), mw = mains.reduce((a, q) => a + q.w, 0), rest = sum() - mw;
  if (T < 30 && mains.length && mw < rest) for (const q of mains) q.w *= rest / mw;
  return seq;
}

// ── 평면 만들기 ────────────────────────────────────────────
/**
 * B: 건물 짜임(planCore 를 거친), F: 층, ctx: { door: {gx, gz} 바깥 문의 틀 좌표 }
 * 반환: 층 평면 L
 */
export function layoutFloor(B, F, ctx = {}) {
  const { gw, gh } = B.G;
  const g = new Grid(gw, gh);
  const rnd = rngFor(B.seed, `floor${F.i}`);
  const FU = FUSE[F.use] || FUSE.office;
  const room = new Int16Array(g.n); // 0 = 바깥, 1.. = 방 번호 + 1
  const rooms = [];
  const doors = [];
  const voidM = new Uint8Array(g.n);
  const inside = F.mask;
  const L = { i: F.i, use: F.use, gw, gh, room, rooms, doors, void: voidM, ents: {}, notes: [] };
  if (!F.reach) { L.closed = true; return L; }
  const newRoom = (type, extra = {}) => { const R = { id: rooms.length, type, name: (ROOMS[type] || {}).name || type, n: 0, ...extra }; rooms.push(R); return R; };
  const setCell = (c, R) => { if (room[c]) rooms[room[c] - 1].n--; room[c] = R.id + 1; R.n++; };
  const free = (c) => inside[c] && !room[c] && !voidM[c];

  // ── 1. 수직 심 (이 층을 지나는 계단·승강기 = 같은 자리) ──
  const core = B.core;
  const coreOn = core && !F.mezz && B.links.some((k) => k.floors.includes(F.i) || (k.kind !== 'open' && k.floors.length && Math.min(...k.floors) < F.i && Math.max(...k.floors) > F.i));
  const linkRoom = {};
  if (core && coreOn) {
    for (const p of core.parts) {
      const t = p.kind === 'stair' || p.kind === 'spiral' ? 'stair' : p.kind === 'lift' ? 'lift' : p.kind === 'cargo' ? 'cargo' : 'shaft';
      const lk = B.links.find((k) => k.part === core.parts.indexOf(p) && k.kind !== 'roof');
      const stops = !!(lk && lk.floors.includes(F.i));
      const R = newRoom(t, { link: lk ? lk.id : null, stops, part: core.parts.indexOf(p) });
      for (const [i, j] of p.cells) if (g.ok(i, j)) setCell(g.c(i, j), R);
      if (lk) linkRoom[lk.id] = R;
    }
    const hall = newRoom('lifthall', { circ: true });
    for (const [i, j] of core.lobby) if (g.ok(i, j) && inside[g.c(i, j)]) setCell(g.c(i, j), hall);
    L.lifthall = hall.id;
  } else if (core && F.mezz) {
    // 중2층: 심의 관이 지나가는 자리는 막혀 있다
    for (const p of core.parts) for (const [i, j] of p.cells) if (g.ok(i, j)) inside[g.c(i, j)] && (voidM[g.c(i, j)] = 2);
    for (const [i, j] of core.lobby) if (g.ok(i, j)) voidM[g.c(i, j)] = 2;
  }

  // ── 1c. 공중다리 통로: 다리 쪽 바깥벽의 문 칸에서 심 앞 홀까지 (홀을 늘린다 — 건너온 사람이 곧장 승강기로) ──
  //  문 칸 = 다리 줄에 가깝고 다리 쪽을 보는 바깥 칸. 길 = 계단·승강기 칸을 피해 홀까지 가장 짧은 칸 길(넓혀서 세 칸).
  const bridgeRuns = [];
  if (F.bridges && F.bridges.length) {
    const hall = L.lifthall != null ? rooms[L.lifthall] : newRoom('corridor', { circ: true });
    const hid = hall.id + 1;
    // 작은 심(층을 거의 다 차지하는)에서는 승강기 홀이 칸을 못 가졌을 수 있다 → 계단·승강기 문 앞 칸을 홀로 (다리에서 온 길이 닿을 곳)
    if (L.lifthall != null && !hall.n && B.core) for (const p of B.core.parts) {
      if (p.kind === 'shaft' || !p.door) continue;
      const [ci, cj] = p.door.c, [fi, fj] = p.door.dir, c = g.ok(ci + fi, cj + fj) ? g.c(ci + fi, cj + fj) : -1;
      if (c >= 0 && inside[c] && !room[c]) setCell(c, hall);
    }
    const coreCell = (c) => room[c] && room[c] !== hid;
    // 홀에서 (계단·승강기 칸을 피해) 걸어서 닿는 칸 — 심이 바깥벽까지 막은 뒤쪽 자투리에는 문을 내지 않는다
    const reach = new Uint8Array(g.n);
    if (L.lifthall != null) {
      const q0 = [];
      for (let c = 0; c < g.n; c++) if (room[c] === hid) { reach[c] = 1; q0.push(c); }
      for (let h = 0; h < q0.length; h++) g.nb(q0[h], (e) => { if (!reach[e] && inside[e] && !coreCell(e)) { reach[e] = 1; q0.push(e); } });
    } else reach.fill(1);
    for (const bd of F.bridges) {
      const [ux, uz] = bd.dir;
      let best = null, bs = 1e9;
      for (let c = 0; c < g.n; c++) {
        if (!inside[c] || coreCell(c) || !reach[c]) continue;
        const i = g.i(c), j = g.j(c), x = cellX(B.G, i), z = cellZ(B.G, j);
        const t = x * ux + z * uz, p = -x * uz + z * ux;
        if (t <= 0) continue;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const out = !g.ok(i + di, j + dj) || !inside[g.c(i + di, j + dj)];
          const dot = di * ux + dj * uz;
          if (!out || dot < 0.35) continue;
          const sc = Math.abs(p) * 2 + (1 - dot) * 3 - t * 0.05;
          if (sc < bs) { bs = sc; best = { c, dir: [di, dj] }; }
        }
      }
      if (!best) continue;
      // 문 칸 → 홀: 칸 너비 우선 찾기
      const prev = new Int32Array(g.n).fill(-2);
      const q = [best.c];
      prev[best.c] = -1;
      let hit = -1;
      for (let h = 0; h < q.length && hit < 0; h++) {
        const c = q[h];
        if (room[c] === hid && L.lifthall != null) { hit = c; break; }
        g.nb(c, (e) => { if (prev[e] === -2 && inside[e] && !coreCell(e)) { prev[e] = c; q.push(e); } });
      }
      const path = [];
      if (hit >= 0) for (let c = hit; c !== -1; c = prev[c]) path.push(c);
      else { // 홀이 없으면 문에서 안쪽으로 네 칸
        let i = g.i(best.c), j = g.j(best.c);
        for (let k = 0; k < 5 && g.ok(i, j) && inside[g.c(i, j)] && !coreCell(g.c(i, j)); k++) { path.push(g.c(i, j)); i -= best.dir[0]; j -= best.dir[1]; }
      }
      for (const c of path) {
        if (!room[c]) setCell(c, hall);
        g.nb(c, (e) => { if (inside[e] && !room[e]) setCell(e, hall); });
      }
      bridgeRuns.push({ bd, best, hall });
    }
  }

  // ── 2. 뚫린 곳(아트리움): 아래층 로비 위로 몇 층이 열려 있다 ──
  const A = B.atrium;
  if (A && B.atriumCells && F.i > B.ground + A.from && F.i <= B.ground + A.to) for (const c of B.atriumCells) if (inside[c] && !room[c]) voidM[c] = 1;
  if (F.mezz) {
    // 중2층 아래 홀이 보이는 앞쪽 가장자리는 난간 (덮개 밖이 곧 뚫린 곳)
  }

  // ── 3. 출입구 (1층: 바깥 문과 같은 자리) ──
  const isGround = F.i === B.ground;
  if (isGround && ctx.door) {
    let best = -1, bd = 1e9, bdir = null;
    for (let c = 0; c < g.n; c++) {
      if (!inside[c] || room[c]) continue;
      g.nb(c, (e, di, dj) => {
        if (inside[e]) return;
        const ex = cellX(B.G, g.i(c)) + di * 0.5, ez = cellZ(B.G, g.j(c)) + dj * 0.5;
        const d = Math.hypot(ex - ctx.door.gx, ez - ctx.door.gz) + (dj === 1 ? 0 : 1.5); // 정면(+z) 벽을 좋아한다
        if (d < bd) { bd = d; best = c; bdir = [di, dj]; }
      });
    }
    if (best >= 0) L.ents.main = { c: best, dir: bdir, w: 2 };
  }

  // ── 3b. 공동 로비: 1층이 가게·식당·찻집인데 위층에 다른 조직(집·회사·호텔…)이 있으면, 정문에서 승강기 홀까지 그 사람들이 지나는
  //   로비를 따로 낸다 — 건물이 클수록 넓게 (중간 3 m 길 · 큰 5 m · 아주 큰 7 m, 정문 앞 넓은 마당)
  if (isGround && L.ents.main && L.lifthall != null && !F.mezz) {
    const own = FUSE[F.use] ? FUSE[F.use].op : '';
    const lobbyUse = ['lobby', 'hotel', 'admin', 'clinic', 'school', 'library', 'museum', 'terminal', 'hall'].includes(own) || ['lobby', 'hotelfront', 'stem', 'care', 'civic', 'transit'].includes(F.use);
    const others = B.zones.some((Z) => Z.from > F.i && Z.org && Z.org !== F.org && !B.floors[Z.from].below && !['tech', 'parking', 'amenity', 'observation', 'mezz'].includes(FUSE[Z.use] ? FUSE[Z.use].op : ''));
    // 작은 층(150 m² 아래)은 따로 내지 않는다 — 가게 위 집처럼 가게를 지나 계단으로 (로비가 작은 매장을 둘로 가르지 않게)
    if (!lobbyUse && others && F.n >= 150) {
      const big = B.size === 'huge' ? 3 : B.size === 'large' ? 2 : 1;
      const lob = newRoom('lobby', { circ: true, shared: true });
      lob.name = '공동 로비';
      const lh = L.lifthall + 1, e0 = L.ents.main.c;
      // 정문 → 승강기 홀: 바깥벽을 따라가는 길을 좋아한다 (넓은 홀 가운데를 가르지 않게) — 벽에서 먼 칸일수록 비싸다
      const edgeD = new Int16Array(g.n).fill(99), dq = [];
      for (let c = 0; c < g.n; c++) if (inside[c]) { let out = false; g.nb(c, (e) => { if (!inside[e]) out = true; }); if (out || g.i(c) === 0 || g.j(c) === 0 || g.i(c) === g.gw - 1 || g.j(c) === g.gh - 1) { edgeD[c] = 0; dq.push(c); } }
      for (let h = 0; h < dq.length; h++) { const c = dq[h]; g.nb(c, (e) => { if (inside[e] && edgeD[e] > edgeD[c] + 1) { edgeD[e] = edgeD[c] + 1; dq.push(e); } }); }
      const dist = new Float32Array(g.n).fill(Infinity), prev = new Int32Array(g.n).fill(-2), open = [e0];
      dist[e0] = 0; prev[e0] = -1;
      let hit = -1;
      while (open.length) {
        let bi = 0;
        for (let k = 1; k < open.length; k++) if (dist[open[k]] < dist[open[bi]]) bi = k;
        const c = open[bi]; open[bi] = open[open.length - 1]; open.pop();
        if (room[c] === lh) { hit = c; break; }
        g.nb(c, (e) => {
          if (!inside[e] || (room[e] && room[e] !== lh)) return;
          const d = dist[c] + 1 + Math.min(6, Math.max(0, edgeD[e] - big - 1)) * 0.8;
          if (d < dist[e]) { if (dist[e] === Infinity) open.push(e); dist[e] = d; prev[e] = c; }
        });
      }
      if (hit >= 0) {
        const path = [];
        for (let c = prev[hit]; c >= 0; c = prev[c]) path.push(c);
        let ring = new Set(path.filter((c) => !room[c]));
        for (let k = 0; k < big; k++) { const nx = new Set(ring); for (const c of ring) g.nb(c, (e) => { if (inside[e] && !room[e] && !voidM[e]) nx.add(e); }); ring = nx; }
        // 정문 앞 마당
        const ei = g.i(e0), ej = g.j(e0), fr = 1.5 + big * 1.5;
        for (let c = 0; c < g.n; c++) if (inside[c] && !room[c] && !voidM[c] && Math.hypot(g.i(c) - ei, g.j(c) - ej) <= fr) ring.add(c);
        for (const c of ring) if (!room[c]) setCell(c, lob);
        L.sharedLobby = lob.id;
      }
    }
  }

  // ── 4. 쓰임에 따라 복도·방 ──
  const plan = FU.plan;
  if (plan === 'ring') ringPlan(B, F, L, g, rnd, { newRoom, setCell, free });
  else if (plan === 'house') housePlan(B, F, L, g, rnd, { newRoom, setCell, free });
  else if (F.mezz) mezzPlan(B, F, L, g, rnd, { newRoom, setCell, free });
  else openPlan(B, F, L, g, rnd, { newRoom, setCell, free, isGround });

  // ── 5. 남은 칸 정리: 아무 방에도 안 든 칸은 이웃 방으로 ──
  for (let pass = 0; pass < 4; pass++) {
    for (let c = 0; c < g.n; c++) {
      if (!inside[c] || room[c] || voidM[c]) continue;
      let to = 0;
      g.nb(c, (e) => { if (room[e] && !to) { const R = rooms[room[e] - 1]; if (!['stair', 'lift', 'cargo', 'shaft'].includes(R.type)) to = room[e]; } });
      if (to) setCell(c, rooms[to - 1]);
    }
  }

  // ── 5c. 폭 1 m 띠 방(2×2 칸 하나 들어가지 않는 방)은 이웃 방으로 — 가구 하나 놓을 수 없는 「방」이 생기지 않게.
  //   복도·홀에 닿았으면 그쪽(복도가 조금 넓어진다), 아니면 같은 집·가장 길게 맞닿은 방으로.
  //   띠가 된 것이 세대·객실의 첫 방이면 그 집의 다른 방(욕실·부엌…)이 그 이름을 이어받는다 (객실이 욕실만 남지 않게). 5a 뒤에도 한 번 더.
  const thinMerge = () => {
    const CORE = ['stair', 'lift', 'cargo', 'shaft'];
    for (let pass = 0; pass < 3; pass++) {
      let ch = 0;
      for (const R of rooms) {
        if (!R.n || CORE.includes(R.type) || R.circ || R.main || R.sealed || R.shop || fat(g, room, R) > 0) continue;
        const kids = rooms.filter((S) => S.n && S.unit === R.id);
        if (kids.length) {
          // 이 집의 가장 큰 다른 방이 이 방을 이어받는다
          const K = kids.sort((a, b) => b.n - a.n)[0];
          for (let c = 0; c < g.n; c++) if (room[c] === R.id + 1) setCell(c, K);
          K.type = R.type; K.name = R.name; K.unit = R.unit; K.unitRoot = R.unitRoot; K.sub = R.sub;
          for (const S of kids) if (S !== K) S.unit = K.id;
          ch++;
          continue;
        }
        const votes = new Map();
        for (let c = 0; c < g.n; c++) if (room[c] === R.id + 1) g.nb(c, (e) => {
          const S = room[e] ? rooms[room[e] - 1] : null;
          if (!S || S === R || CORE.includes(S.type) || S.sealed) return;
          const w = (R.unit != null && (S.unit === R.unit || S.id === R.unit)) ? 10 : S.circ ? 3 : S.main ? 2 : 1;
          votes.set(S, (votes.get(S) || 0) + w);
        });
        let best = null, bv = 0;
        for (const [S, v] of votes) if (v > bv) { bv = v; best = S; }
        if (!best) continue;
        for (let c = 0; c < g.n; c++) if (room[c] === R.id + 1) setCell(c, best);
        ch++;
      }
      if (!ch) break;
    }
  };
  thinMerge();

  // ── 5a. 한 방은 한 덩어리: 떨어진 조각(세대·객실을 나누다 생긴)은 맞닿은 방으로 — 같은 세대·객실의 방부터.
  //   (조각마다 문이 따로 달려 한쪽에서 다른 쪽으로 걸어갈 수 없는 방이 생기지 않게)
  const onePiece = () => {
    const CORE = ['stair', 'lift', 'cargo', 'shaft'];
    const sameHome = (R, S) => R.unit == null ? S.unit == null : (S.unit === R.unit || S.id === R.unit || (R.unitRoot && S.unit === R.id) || (S.unitRoot && R.unit === S.id));
    for (let pass = 0; pass < 3; pass++) {
      let changed = 0;
      // 오가는 공간의 줄기: 사람이 이 층에 들어서는 곳 — 승강기 홀, 승강기·계단 문 바로 앞 칸(홀이 없는 작은 탑은 승강기가 서가·홀로 곧장 열린다),
      // 정문 칸 — 에서 오가는 공간끼리 벽 없이 이어진 칸들
      const net = new Uint8Array(g.n), nq = [];
      const isFlow = (c) => room[c] && flowRoom(rooms[room[c] - 1]);
      const root = (c) => { if (c >= 0 && !net[c] && isFlow(c)) { net[c] = 1; nq.push(c); } };
      if (L.lifthall != null) for (let c = 0; c < g.n; c++) if (room[c] === L.lifthall + 1) root(c);
      if (B.core) for (const p of B.core.parts) {
        if (p.kind === 'shaft' || !p.door) continue;
        const [ci, cj] = p.door.c, [fi, fj] = p.door.dir;
        if (g.ok(ci + fi, cj + fj)) root(g.c(ci + fi, cj + fj));
      }
      if (L.ents.main) root(L.ents.main.c);
      for (let h = 0; h < nq.length; h++) g.nb(nq[h], (e) => { if (!net[e] && isFlow(e)) { net[e] = 1; nq.push(e); } });
      for (const R of rooms) {
        if (!R.n || CORE.includes(R.type) || R.sealed) continue;
        const flow = flowRoom(R);
        const cells = [];
        for (let c = 0; c < g.n; c++) if (room[c] === R.id + 1) cells.push(c);
        const comps = components(g, cells, (c) => room[c] === R.id + 1);
        if (comps.length < 2) continue;
        // 남길 조각: 세대·객실의 첫 방(거실)은 복도에 닿는 조각, 나머지는 가장 큰 조각
        const touchCirc = (comp) => { let n = 0; for (const c of comp) g.nb(c, (e) => { const S = room[e] ? rooms[room[e] - 1] : null; if (S && S !== R && (S.circ || S.main)) n++; }); return n; };
        comps.sort((a, b) => (R.unitRoot || R.type === 'unit' || R.type === 'guestroom' ? (touchCirc(b) > 0) - (touchCirc(a) > 0) : 0) || b.length - a.length); // 복도에 닿는 조각 가운데 가장 큰 것
        for (const comp of comps.slice(1)) {
          // 오가는 공간(홀·복도)끼리는 벽 없이 이어지니, 오가는 공간의 줄기(승강기 홀에서 이어진)에 든 조각은 그대로 둔다 —
          // 줄기와 끊긴 조각(부속실·심에 둘러싸인 홀 자투리)만 이웃 방으로 (그 자투리로 문이 열려 아무도 못 가는 방이 생기지 않게)
          if (flow && (!nq.length || comp.some((c) => net[c]))) continue;
          const votes = new Map();
          for (const c of comp) g.nb(c, (e) => {
            const S = room[e] ? rooms[room[e] - 1] : null;
            if (!S || S === R || CORE.includes(S.type) || S.sealed) return;
            const w = sameHome(R, S) ? 10 : S.circ || S.main ? 1 : 0.5;
            votes.set(S, (votes.get(S) || 0) + w);
          });
          let best = null, bv = 0;
          for (const [S, v] of votes) if (v > bv) { bv = v; best = S; }
          if (best) { for (const c of comp) setCell(c, best); changed++; }
        }
      }
      if (!changed) break;
    }
  };
  onePiece();

  thinMerge(); // 5a 가 조각을 옮긴 뒤 새로 생긴 띠 방도

  // ── 5d. 최소 방 크기 (v24): 방마다 그 쓰임의 정사각형(catalog.MIN_FIT 한 변)과 넓이가 들어가야 한다.
  //   바깥 크기에 맞추느라 찌그러진 방은 이웃과 합친다 — 큰 방의 상한은 두지 않는다 (사용자 원칙: 최소 크기 > 바깥 크기 맞추기)
  //   합친 뒤 모서리로만 이어진 방(세대 거실이 대각선으로 갈라져 안쪽 방들이 현관과 끊기던 것)이 생기면 다시 한 덩어리로 → 다시 최소 크기
  minSizeMerge(L, g, { setCell }, RING_MAIN[F.use]);
  onePiece();
  thinMerge();
  minSizeMerge(L, g, { setCell }, RING_MAIN[F.use]);

  // ── 5b. 중2층 계단: 위가 중2층이면 홀 바닥에서 중2층 앞 가장자리로 곧장 오르는 계단 (두 칸 너비, 칸은 홀 그대로 · void 3) ──
  const upF = B.floors[F.i + 1];
  if (!F.mezz && upF && upF.mezz && !upF.dead) L.mstair = mezzStair(B, F, upF, L, g);
  if (F.mezz) { const lo = B.floors[F.i - 1]; const LH = lo ? layoutFloor(B, lo, ctx) : null; if (LH && LH.mstair) L.mstair = LH.mstair; }

  // ── 6. 문 ──
  makeDoors(B, F, L, g, rnd);
  // ── 7. 테라스 문 (아래 부피의 지붕으로 나가는 문) ──
  if (F.terrace) {
    let best = null, bs = -1e9;
    for (let c = 0; c < g.n; c++) {
      if (!room[c]) continue;
      const R = rooms[room[c] - 1];
      if (['stair', 'lift', 'cargo', 'shaft'].includes(R.type) || R.sealed) continue;
      const svc = ['bath', 'wc', 'storage', 'mech'].includes(R.type); // 맞닿은 방이 이것뿐이면 그래도 문을 낸다 (점수 낮게)
      g.nb(c, (e, di, dj) => {
        if (!F.terrace.mask[e]) return;
        const s = (svc ? -0.5 : R.circ ? 3 : ROOMS[R.type] && ROOMS[R.type].acc === 'public' ? 2 : 1) + rnd() * 0.5;
        if (s > bs) { bs = s; best = { c, e, dir: [di, dj], room: R.id }; }
      });
    }
    if (best) { doors.push({ a: best.room, b: -2, c: best.c, dir: best.dir, w: 1, kind: 'terrace' }); L.ents.terrace = best; }
  }
  // ── 7b. 공중다리 문: 통로 끝 칸의 바깥벽 ──
  for (const { bd, best, hall } of bridgeRuns) {
    if (room[best.c] !== hall.id + 1) continue;
    doors.push({ a: hall.id, b: -3, c: best.c, dir: best.dir, w: 2, kind: 'bridge' });
    (L.ents.bridge || (L.ents.bridge = [])).push({ c: best.c, dir: best.dir, k: bd.k, bi: bd.bi, room: hall.id });
  }
  // ── 8. 지붕 문 ──
  const roofLink = B.links.find((k) => k.kind === 'roof' && k.floors.includes(F.i));
  if (roofLink) L.ents.roof = { link: 'roof', part: roofLink.part };
  // 방 경계 상자
  for (const R of rooms) { R.i0 = 1e9; R.j0 = 1e9; R.i1 = -1; R.j1 = -1; R.cx = 0; R.cz = 0; }
  for (let c = 0; c < g.n; c++) {
    if (!room[c]) continue;
    const R = rooms[room[c] - 1], i = g.i(c), j = g.j(c);
    R.i0 = Math.min(R.i0, i); R.i1 = Math.max(R.i1, i); R.j0 = Math.min(R.j0, j); R.j1 = Math.max(R.j1, j); R.cx += i; R.cz += j;
  }
  for (const R of rooms) if (R.n > 0) { R.cx /= R.n; R.cz /= R.n; }
  L.org = F.org;
  return L;
}

/**
 * 5d. 최소 크기에 못 미치는 방 합치기 — 작은 방부터:
 *  · 합칠 이웃 = 합친 방이 (이름을 잇는 쪽의) 최소를 채우는 이웃 가운데 같은 집·같은 종류·작은 쪽. 채우는 이웃이 없으면 가장 나아지는 쪽.
 *  · 어느 이웃과 합쳐도 나아지지 않는 얇은 띠(복도와 바깥벽 사이가 얕은 곳)는 맞닿은 복도·홀로 (복도가 넓어진 자리) — 층의 본실·세대 첫 방은 남긴다.
 *  · 합친 방은 더 중요한 쪽(층의 본실 > 세대·객실의 첫 방 > 가게 > 넓은 쪽)의 종류·이름을 잇는다.
 */
/** 방의 무게: 층의 본실(넓은 홀·둘레 복도 층의 업무 공간·교실…) 8 · 세대·객실의 첫 방 4 · 가게 2 */
export function roomRank(R, mainT) { return (R.main || (mainT && R.type === mainT) ? 8 : 0) + (R.unitRoot || ((R.type === 'unit' || R.type === 'guestroom') && R.unit == null) ? 4 : 0) + (R.shop ? 2 : 0); }
const NOFIT = ['stair', 'lift', 'cargo', 'shaft'];
/** 최소 크기에 못 미치는 본실·세대 첫 방의 수 (program.makeBuilding 이 실내 배율을 키울지 정한다) */
export function narrowMain(L) {
  let n = 0;
  const mainT = RING_MAIN[L.use];
  for (const R of L.rooms) {
    if (!R.n || NOFIT.includes(R.type) || MIN_FIT_SKIP.has(R.type) || R.circ || R.sealed || roomRank(R, mainT) < 4) continue;
    const [mk, ma] = minFit(R.type);
    if (R.n < ma || fitSideIds(L.room, L.gw, L.gh, R.id + 1, R.id + 1) < mk) n++;
  }
  return n;
}

function minSizeMerge(L, g, T, mainT) {
  const { room, rooms } = L;
  const CORE = NOFIT;
  const skip = (R) => !R || !R.n || CORE.includes(R.type) || MIN_FIT_SKIP.has(R.type) || R.circ || R.sealed;
  const fits = (R, k, n) => { const [mk, ma] = minFit(R.type); return k >= mk && n >= ma; };
  const rank = (R) => roomRank(R, mainT);
  const home = (R) => (R.unit != null ? R.unit : R.unitRoot || R.subs ? R.id : null);
  const move = (from, to) => { for (let c = 0; c < g.n; c++) if (room[c] === from.id + 1) T.setCell(c, to); };
  for (let pass = 0; pass < 8; pass++) {
    let ch = 0;
    const order = rooms.filter((R) => !skip(R)).sort((a, b) => a.n - b.n);
    for (const R of order) {
      if (skip(R)) continue; // 이번 차례에 이미 합쳐짐
      const k = fitSideIds(room, g.gw, g.gh, R.id + 1, R.id + 1);
      if (fits(R, k, R.n)) continue;
      const edge = new Map();
      for (let c = 0; c < g.n; c++) if (room[c] === R.id + 1) g.nb(c, (e) => {
        const S = room[e] ? rooms[room[e] - 1] : null;
        if (S && S !== R && !CORE.includes(S.type) && !S.sealed) edge.set(S, (edge.get(S) || 0) + 1);
      });
      let best = null, bs = -1e9, circ = null;
      for (const [S, ed] of edge) {
        if (S.circ || MIN_FIT_SKIP.has(S.type)) { if (S.circ && (!circ || ed > edge.get(circ))) circ = S; continue; }
        const keep = rank(S) > rank(R) || (rank(S) === rank(R) && S.n > R.n) ? S : R;
        const kS = fitSideIds(room, g.gw, g.gh, S.id + 1, S.id + 1);
        const k2 = fitSideIds(room, g.gw, g.gh, R.id + 1, S.id + 1), n2 = R.n + S.n;
        const ok = fits(keep, k2, n2);
        if (!ok && k2 <= Math.max(k, kS) && n2 <= Math.max(R.n, S.n) * 1.6) continue; // 길어지기만 하는 합치기
        // 다른 본실끼리(업무 공간 둘)는 합쳐도 되지만, 본실이 남의 집 방을 먹지는 않는다
        if (rank(R) >= 8 && rank(S) >= 4 && rank(S) < 8) continue;
        const hR = home(R), hS = home(S);
        const sc = (ok ? 1000 : 0) + (k2 - k) * 40 + (hR != null && hR === hS ? 300 : hR != null && hS != null ? -400 : 0) + (S.type === R.type ? 120 : 0) - n2 * 0.6 + ed * 2;
        if (sc > bs) { bs = sc; best = { S, keep }; }
      }
      if (best) {
        const { S, keep } = best;
        if (keep === R) move(S, R); else move(R, S);
        ch++;
        continue;
      }
      // 나아지는 이웃이 없다: 복도에 닿은 얇은 방은 복도로 (본실·세대 첫 방은 남긴다 — 건물 배율이 넓힌다)
      if (circ && rank(R) < 4) { move(R, circ); ch++; }
    }
    if (!ch) break;
  }
  // 세대·객실의 방 목록 정리 (합쳐져 없어진 방)
  for (const R of rooms) if (R.subs) R.subs = R.subs.filter((id) => rooms[id] && rooms[id].n > 0 && rooms[id].id !== R.id);
}

/** 중2층 계단 자리 (찾는 규칙은 core.js 의 searchMezzStair — 심을 놓을 때 이미 자리가 있는지 확인했다) */
function mezzStair(B, F, M, L, g) {
  const { room, rooms } = L;
  const hall = rooms.find((R) => R.main) || rooms.slice().sort((a, b) => b.n - a.n)[0];
  const door = L.ents.main ? [g.i(L.ents.main.c), g.j(L.ents.main.c)] : null;
  // 심(계단·승강기) 문 앞 두 칸 × 세 칸은 비운다 — 계단이 그 칸을 지나면 옆 난간이 계단실·승강기 문을 막는다 (v24 셀 검사: 공연장 계단 문)
  const coreFront = new Set();
  for (const p of (B.core && B.core.parts) || []) {
    if (p.kind === 'shaft' || !p.door) continue;
    const [ci, cj] = p.door.c, [fi, fj] = p.door.dir;
    for (let k = 1; k <= 2; k++) for (let w = -1; w <= 1; w++) { const ii = ci + fi * k + (fj ? w : 0), jj = cj + fj * k + (fi ? w : 0); if (g.ok(ii, jj)) coreFront.add(g.c(ii, jj)); }
  }
  const okCell = (strict) => (ii, jj) => {
    if (!g.ok(ii, jj)) return false;
    const c = g.c(ii, jj);
    if (!F.mask[c] || L.void[c] || M.mask[c] || !room[c] || coreFront.has(c)) return false;
    const R = rooms[room[c] - 1];
    return strict ? R === hall : !['stair', 'lift', 'cargo', 'shaft', 'lifthall'].includes(R.type);
  };
  const S = searchMezzStair(g.gw, M.mask, M.y - F.y, okCell(true), door) || searchMezzStair(g.gw, M.mask, M.y - F.y, okCell(false), door);
  if (!S) { L.notes.push('중2층 계단 자리 없음'); return null; }
  const take = (c, v) => { if (room[c] !== hall.id + 1) { rooms[room[c] - 1].n--; room[c] = hall.id + 1; hall.n++; } if (v) L.void[c] = v; };
  if (S.axis === 'z') {
    for (let k = 1; k <= S.n; k++) for (let a = 0; a < 2; a++) take(g.c(S.i0 + a, S.J + k), 3);
    for (let a = 0; a < 2; a++) take(g.c(S.i0 + a, S.J + S.n + 1), 0);
  } else {
    for (let k = 0; k < S.n; k++) for (const jj of [S.J + 1, S.J + 2]) take(g.c(S.run0 + S.sx * k, jj), 3);
    for (const ii of [S.i0, S.i1]) for (const jj of [S.J + 1, S.J + 2]) take(g.c(ii, jj), 3);
    for (const jj of [S.J + 1, S.J + 2]) take(g.c(S.run0 + S.sx * S.n, jj), 0);
  }
  return S;
}

// ── 둘레 복도 층 ───────────────────────────────────────────
function ringPlan(B, F, L, g, rnd, T) {
  const { room, rooms } = L;
  const inside = F.mask;
  const FU = FUSE[F.use];
  const roomd = FU.roomd || 9;
  const MAXD = roomd + 3;
  const corr = T.newRoom('corridor', { circ: true });
  const isCorr = (c) => room[c] === corr.id + 1 || (L.lifthall != null && room[c] === L.lifthall + 1);
  const core = B.core;
  // 바깥까지 거리
  const outside = [];
  for (let c = 0; c < g.n; c++) if (!inside[c]) outside.push(c);
  const dF = bfs(g, outside, (c) => inside[c]);
  const ringW = F.n < 90 ? 0 : F.n < 220 ? 1 : 2;
  if (core && ringW) {
    // a. 심 둘레 고리 (작은 층은 한 칸, 아주 작은 층은 승강기 홀만)
    const ci0 = core.i0, cj0 = core.j0, ci1 = core.i0 + core.w - 1, cj1 = core.j0 + core.d - 1;
    for (let j = cj0 - ringW; j <= cj1 + ringW; j++) for (let i = ci0 - ringW; i <= ci1 + ringW; i++) {
      if (!g.ok(i, j)) continue;
      const c = g.c(i, j);
      if (T.free(c)) T.setCell(c, corr);
    }
  }
  // 작은 층·작은 심(나선 계단): 계단·승강기 문 앞 칸들을 홀로
  if (core) {
    for (const p of core.parts) {
      if (p.kind === 'shaft') continue;
      const [ci, cj] = p.door.c, [fi, fj] = p.door.dir;
      for (let k = 1; k <= 2; k++) for (let w = -1; w <= 1; w++) {
        const i = ci + fi * k + (fj ? w : 0), j = cj + fj * k + (fi ? w : 0);
        if (g.ok(i, j) && T.free(g.c(i, j)) && (k === 1 || F.n > 60)) T.setCell(g.c(i, j), corr);
      }
    }
  }
  // b. 바깥 부피의 모양이 복도를 정한다: 긴 날개(상자)는 날개를 따라 곧은 복도, 넓은 덩어리는 안쪽 고리, 큰 원통은 둥근 고리
  const V = B.V;
  const cx0 = B.G.ox, cz0 = B.G.oz;
  const toCell = (x, z) => [Math.floor(x - cx0), Math.floor(z - cz0)];
  const paint = (x, z) => { const [i, j] = toCell(x, z); if (g.ok(i, j)) { const c = g.c(i, j); if (T.free(c)) T.setCell(c, corr); } };
  if (V && F.n >= 140) for (const C of V.cols) {
    if (C.y0 > F.y + 0.5 || C.y1 < F.ceil - 0.5) continue;
    if (C.t === 'b') {
      const ax = C.hx >= C.hz, half = Math.max(C.hx, C.hz) - 0.4, wid = Math.min(C.hx, C.hz) - 0.4;
      const ux = ax ? C.cs : C.sn, uz = ax ? -C.sn : C.cs; // 긴 축 (상자 로컬 x 또는 z 의 틀 방향)
      const vx = -uz, vz = ux;
      if (wid * 2 > roomd * 2 + 3) {
        // 넓은 덩어리: 바깥벽에서 방 깊이만큼 들어온 사각 고리
        const a = Math.max(C.hx, C.hz) - 0.4 - roomd, bb = wid - roomd;
        if (a > 1 && bb > 1) for (let t = -a; t <= a; t += 0.5) for (const sg of [-1, 1]) for (let w = 0; w < 2; w += 0.5) { paint(C.x + ux * t + vx * (bb - w) * sg, C.z + uz * t + vz * (bb - w) * sg); }
        if (a > 1 && bb > 1) for (let t = -bb; t <= bb; t += 0.5) for (const sg of [-1, 1]) for (let w = 0; w < 2; w += 0.5) { paint(C.x + vx * t + ux * (a - w) * sg, C.z + vz * t + uz * (a - w) * sg); }
      } else if (half * 2 > roomd * 1.6 + 6) {
        // 긴 날개: 가운데 줄을 따라 (양 끝은 방 깊이의 0.7 남기고)
        const e = half - roomd * 0.7;
        for (let t = -e; t <= e; t += 0.5) for (let w = -1; w < 1; w += 0.5) paint(C.x + ux * t + vx * w, C.z + uz * t + vz * w);
      }
    } else if (C.r > roomd + 5 && !C.dome) {
      const rr = C.r - 0.4 - roomd - 1;
      for (let k = 0; k < 720; k++) { const a = (k / 720) * Math.PI * 2; for (let w = 0; w < 2; w += 0.5) paint(C.x + Math.cos(a) * (rr + w), C.z + Math.sin(a) * (rr + w)); }
    }
  }
  // c. 그래도 복도에서 너무 먼 칸이 있으면 바깥벽에서 방 깊이만큼 들어온 고리
  for (let guard = 0; guard < 2; guard++) {
    const corrCells = [];
    for (let c = 0; c < g.n; c++) if (isCorr(c)) corrCells.push(c);
    const dC = bfs(g, corrCells, (c) => T.free(c));
    let far = 0;
    for (let c = 0; c < g.n; c++) if (T.free(c) && dC[c] > far) far = dC[c];
    if (far <= MAXD) break;
    let added = 0;
    for (let c = 0; c < g.n; c++) if (T.free(c) && (dF[c] === roomd || dF[c] === roomd + 1) && dC[c] > 2) { T.setCell(c, corr); added++; }
    if (!added) break;
  }
  // d. 1층이면 정문에서 복도까지 곧은 길 (두 칸)
  if (L.ents.main) {
    const s = L.ents.main.c;
    const corrCells = [];
    for (let c = 0; c < g.n; c++) if (isCorr(c)) corrCells.push(c);
    const dC = bfs(g, corrCells, (c) => T.free(c) || isCorr(c));
    let c = s;
    for (let guard = 0; guard < 400 && c >= 0 && !isCorr(c); guard++) {
      if (T.free(c)) T.setCell(c, corr);
      // 옆 칸 하나 더 (두 칸 너비)
      const [di, dj] = L.ents.main.dir;
      const side = g.c(Math.min(g.gw - 1, Math.max(0, g.i(c) + (dj ? 1 : 0))), Math.min(g.gh - 1, Math.max(0, g.j(c) + (di ? 1 : 0))));
      if (T.free(side)) T.setCell(side, corr);
      let nx = -1, nd = dC[c] < 0 ? 1e9 : dC[c];
      g.nb(c, (e) => { if (dC[e] >= 0 && dC[e] < nd) { nd = dC[e]; nx = e; } });
      c = nx;
    }
  }
  // e. 복도가 끊겼으면 승강기 홀 쪽으로 곧게 잇는다
  connectCorridors(L, g, corr, T);
  // e. 방 띠: 복도에 닿은 칸 → 바깥벽 쪽으로 곧게 퍼지며 「면한 복도 자리」를 매긴다
  const bays = components(g, [...Array(g.n).keys()], (c) => T.free(c));
  const ctr = core ? [core.i0 + core.w / 2, core.j0 + core.d / 2] : [g.gw / 2, g.gh / 2];
  let floorK = 0;
  const zone = B.zones[F.zone];
  const first = zone && zone.from === F.i;
  bays.sort((a, b) => b.length - a.length);
  for (const bay of bays) {
    if (bay.length < 6) { for (const c of bay) T.setCell(c, corr); continue; }
    const inBay = new Uint8Array(g.n);
    for (const c of bay) inBay[c] = 1;
    // 복도에 닿은 칸 (앞면)
    const front = [];
    for (const c of bay) { let n = null; g.nb(c, (e, di, dj) => { if (isCorr(e)) n = n ? [n[0] - di, n[1] - dj] : [-di, -dj]; }); if (n) front.push({ c, n }); }
    if (!front.length) {
      // 복도에 닿지 않은 덩어리: 창고로 (이웃 방에서 문)
      const R = T.newRoom('storage', { blind: true });
      for (const c of bay) T.setCell(c, R);
      continue;
    }
    // 앞면 칸을 심 둘레 각도로 줄 세우고 펼친 길이 t
    for (const f of front) f.a = Math.atan2(g.j(f.c) + 0.5 - ctr[1], g.i(f.c) + 0.5 - ctr[0]);
    front.sort((p, q) => p.a - q.a);
    // 고리 모양 띠는 가장 큰 틈에서 자른다
    let cut = 0, gap = -1;
    for (let k = 0; k < front.length; k++) {
      const p = front[k], q = front[(k + 1) % front.length];
      const d = Math.hypot(g.i(p.c) - g.i(q.c), g.j(p.c) - g.j(q.c));
      if (d > gap) { gap = d; cut = (k + 1) % front.length; }
    }
    const ord = front.slice(cut).concat(front.slice(0, cut));
    let t = 0;
    const tOf = new Float32Array(g.n).fill(-1);
    ord.forEach((f, k) => { if (k) { const p = ord[k - 1]; t += Math.min(2, Math.hypot(g.i(p.c) - g.i(f.c), g.j(p.c) - g.j(f.c))); } tOf[f.c] = t; f.t = t; });
    const Ttot = t + 1;
    // 곧게 퍼지기: 앞면 칸의 바깥 방향으로 행진 (먼저 닿은 쪽이 가진다)
    const src = new Int32Array(g.n).fill(-1);
    for (const f of ord) src[f.c] = f.c;
    for (const f of ord) {
      const ni = Math.sign(Math.round(f.n[0])), nj = Math.sign(Math.round(f.n[1]));
      if (!ni && !nj) continue;
      let i = g.i(f.c) + ni, j = g.j(f.c) + nj;
      while (g.ok(i, j) && inBay[g.c(i, j)] && src[g.c(i, j)] < 0) { src[g.c(i, j)] = f.c; i += ni; j += nj; }
    }
    // 남은 칸(모서리 그늘): 덩어리마다 통째로 한 방에 — 둘레에서 가장 많이 맞닿은 칸의 주인에게 (칸막이가 비스듬해지지 않게)
    {
      const seen2 = new Uint8Array(g.n);
      for (const c0 of bay) {
        if (src[c0] >= 0 || seen2[c0]) continue;
        const comp = [c0];
        seen2[c0] = 1;
        const votes = new Map();
        for (let k = 0; k < comp.length; k++) g.nb(comp[k], (e) => {
          if (!inBay[e]) return;
          if (src[e] >= 0) { votes.set(src[e], (votes.get(src[e]) || 0) + 1); return; }
          if (!seen2[e]) { seen2[e] = 1; comp.push(e); }
        });
        let best = -1, bv = -1;
        for (const [v, n] of votes) if (n > bv) { bv = n; best = v; }
        if (best >= 0) for (const c of comp) src[c] = best;
      }
    }
    for (let pass = 0; pass < 60; pass++) {
      let ch = 0;
      for (const c of bay) {
        if (src[c] >= 0) continue;
        let s = -1;
        g.nb(c, (e) => { if (s < 0 && inBay[e] && src[e] >= 0) s = src[e]; });
        if (s >= 0) { src[c] = s; ch++; }
      }
      if (!ch) break;
    }
    // 방 짜기: 앞면 칸마다 그 칸이 가진 넓이(모서리 칸은 넓다)를 재어, 너비가 아니라 넓이로 자른다
    let seq = ringProgram(F.use, Ttot, rnd, { first, k: F.i + floorK++ });
    if (!seq.length || bay.length < 14) seq = [{ type: bay.length < 14 ? 'storage' : seq.length ? seq[seq.length - 1].type : 'storage', w: Ttot }];
    // 넓은 방(업무 공간·세대·교실)은 띠의 양 끝(모서리)에, 작은 방은 가운데에
    const big = seq.filter((s) => s.w >= 7), small = seq.filter((s) => s.w < 7);
    const ordered = big.length >= 2 ? [big[0], ...small, ...big.slice(1)] : seq;
    const own = new Map();
    for (const c of bay) { const f = src[c] >= 0 ? src[c] : ord[0].c; own.set(f, (own.get(f) || 0) + 1); }
    const sum = ordered.reduce((a, b) => a + b.w, 0) || 1;
    const per = bay.length / sum; // 너비 1 m 당 넓이
    let ki = 0, acc = 0;
    const roomOfF = new Map();
    const made = ordered.map((s) => T.newRoom(s.type, { org: F.org }));
    for (const f of ord) {
      const a = own.get(f.c) || 0;
      // 이번 방이 목표 넓이의 반을 넘겼고 다음 칸까지 더하면 넘치면 다음 방으로
      while (ki < ordered.length - 1 && acc + a / 2 > ordered[ki].w * per) { acc -= ordered[ki].w * per; ki++; }
      roomOfF.set(f.c, made[ki]);
      acc += a;
    }
    for (const c of bay) T.setCell(c, roomOfF.get(src[c] >= 0 ? src[c] : ord[0].c) || made[made.length - 1]);
    tidyBay(g, bay, made, room, T);
    // 너무 작은 방은 이웃(같은 띠의 앞뒤)과 합친다 — 쓰임의 가구가 들어갈 넓이(MIN_ROOM)보다 작거나 폭이 1 m 인 방도
    for (let pass = 0; pass < 3; pass++) {
      let ch = 0;
      for (let q = 0; q < made.length; q++) {
        const R = made[q];
        if (R.n === 0 || (R.n >= (MIN_ROOM[R.type] || 6) && fat(g, room, R) > 0)) continue;
        let to = null;
        for (let d = 1; d < made.length && !to; d++) { if (made[q + d] && made[q + d].n) to = made[q + d]; else if (made[q - d] && made[q - d].n) to = made[q - d]; }
        if (!to) continue;
        for (const c of bay) if (room[c] === R.id + 1) T.setCell(c, to);
        ch++;
      }
      if (!ch) break;
    }
    // 세대·객실은 안을 나눈다
    for (const R of made) {
      if (!R.n) continue;
      if (R.type === 'unit') subdivideUnit(B, F, L, g, rnd, T, R, isCorr);
      else if (R.type === 'guestroom') subdivideGuest(B, F, L, g, rnd, T, R, isCorr);
      // 발코니 외벽 층: 집·객실마다 바깥벽을 따라 발코니 (바깥에서 보이는 난간 띠와 같은 층)
      if (F.balcony && (R.type === 'living' || R.type === 'guestroom')) balconyOf(F, L, g, T, R);
    }
  }
}

/** 띠 안의 방 다듬기: 남의 방에 둘러싸인 칸(톱니·끼어든 칸)은 둘러싼 방으로, 떨어진 조각은 가장 많이 맞닿은 방으로 — 방이 반듯해진다 */
function tidyBay(g, bay, made, room, T) {
  const byId = new Map(made.map((R) => [R.id + 1, R]));
  for (let pass = 0; pass < 6; pass++) {
    let ch = 0;
    for (const c of bay) {
      const a = room[c];
      if (!byId.has(a)) continue;
      const cnt = new Map();
      g.nb(c, (e) => { const b = room[e]; if (byId.has(b)) cnt.set(b, (cnt.get(b) || 0) + 1); });
      if ((cnt.get(a) || 0) >= 2) continue;
      let best = 0, bv = 0;
      for (const [b, v] of cnt) if (b !== a && v > bv) { bv = v; best = b; }
      if (best && bv >= 2 && byId.get(a).n > 4) { T.setCell(c, byId.get(best)); ch++; }
    }
    if (!ch) break;
  }
  for (const R of made) {
    const cells = bay.filter((c) => room[c] === R.id + 1);
    if (cells.length < 2) continue;
    const comps = components(g, cells, (c) => room[c] === R.id + 1).sort((a, b) => b.length - a.length);
    for (const comp of comps.slice(1)) {
      const votes = new Map();
      for (const c of comp) g.nb(c, (e) => { const b = room[e]; if (byId.has(b) && b !== R.id + 1) votes.set(b, (votes.get(b) || 0) + 1); });
      let best = 0, bv = 0;
      for (const [b, v] of votes) if (v > bv) { bv = v; best = b; }
      if (best) for (const c of comp) T.setCell(c, byId.get(best));
    }
  }
}

/** 끊긴 복도 덩어리를 승강기 홀 쪽으로 곧게 잇는다 */
function connectCorridors(L, g, corr, T) {
  const { room } = L;
  const hub = L.lifthall != null ? L.lifthall + 1 : corr.id + 1;
  const isC = (c) => room[c] === corr.id + 1 || room[c] === hub;
  for (let guard = 0; guard < 8; guard++) {
    const comps = components(g, [...Array(g.n).keys()], isC);
    if (comps.length <= 1) return;
    // 홀을 품은 덩어리
    const main = comps.find((cc) => cc.some((c) => room[c] === hub)) || comps[0];
    const inMain = new Uint8Array(g.n);
    for (const c of main) inMain[c] = 1;
    for (const cc of comps) {
      if (cc === main) continue;
      // 이 덩어리에서 본 덩어리까지 빈 칸·방을 지나는 가장 짧은 길
      const prev = new Int32Array(g.n).fill(-1), q = [...cc];
      const seen = new Uint8Array(g.n);
      for (const c of cc) seen[c] = 1;
      let hit = -1;
      for (let h = 0; h < q.length && hit < 0; h++) {
        const c = q[h];
        g.nb(c, (e) => {
          if (hit >= 0 || seen[e] || !L.room[e] && !T.free(e)) return;
          const R = L.rooms[room[e] - 1];
          if (R && ['stair', 'lift', 'cargo', 'shaft'].includes(R.type)) return;
          seen[e] = 1; prev[e] = c; q.push(e);
          if (inMain[e]) hit = e;
        });
      }
      for (let c = hit; c >= 0 && !cc.includes(c); c = prev[c]) if (!inMain[c]) T.setCell(c, corr);
    }
  }
}

// ── 세대 나누기 (집 한 채의 방들) ─────────────────────────────
function subdivideUnit(B, F, L, g, rnd, T, U, isEntry) {
  const { room } = L;
  const cells = [];
  for (let c = 0; c < g.n; c++) if (room[c] === U.id + 1) cells.push(c);
  if (cells.length < 18) { U.type = 'unit'; U.sub = 'studio'; return; }
  // 깊이: 복도(입구 쪽)에서 · 옆: 입구 줄을 따라
  const entryCells = cells.filter((c) => { let e = false; g.nb(c, (x) => { if (isEntry(x)) e = true; }); return e; });
  const dep = bfs(g, entryCells, (c) => room[c] === U.id + 1);
  // 옆 좌표: 입구 줄의 방향으로 투영
  let ax = 0, az = 0;
  for (const c of entryCells) g.nb(c, (x, di, dj) => { if (isEntry(x)) { ax += -dj; az += di; } });
  const al = Math.hypot(ax, az) || 1;
  ax /= al; az /= al;
  if (!ax && !az) ax = 1;
  let s0 = 1e9, s1 = -1e9;
  for (const c of cells) { const s = g.i(c) * ax + g.j(c) * az; s0 = Math.min(s0, s); s1 = Math.max(s1, s); }
  const mirror = rnd() < 0.5;
  const sN = (c) => { const v = (g.i(c) * ax + g.j(c) * az - s0) / Math.max(1, s1 - s0); return mirror ? 1 - v : v; };
  const maxD = Math.max(...cells.map((c) => dep[c]));
  const W = s1 - s0 + 1, area = cells.length;
  const plan = area < 34 || W < 5 ? 'studio' : area < 62 ? 'one' : 'two';
  U.sub = plan;
  const sub = {};
  const mk = (t) => sub[t] || (sub[t] = T.newRoom(t, { unit: U.id, org: U.org }));
  const living = U; // 세대 방 자체가 거실
  living.type = 'living';
  living.name = '거실';
  living.unitRoot = true;
  for (const c of cells) {
    const s = sN(c), d = dep[c];
    let t = null;
    if (plan === 'studio') { if (s < 0.45 && d < 3) t = 'bath'; }
    else if (plan === 'one') { if (s < 0.4 && d < 3) t = 'bath'; else if (s >= 0.4 && d < 3) t = 'kitchen1'; else if (s < 0.5 && d >= 3 && maxD > 5) t = 'bedroom'; }
    else { if (s < 0.3 && d < 3) t = 'bath'; else if (s >= 0.3 && s < 0.68 && d < 3) t = 'kitchen1'; else if (s < 0.34 && d >= 3) t = 'bedroom'; else if (s >= 0.7 && d >= 3) t = 'bedroom2'; }
    if (t === 'bedroom2') T.setCell(c, sub.bedroom2 || (sub.bedroom2 = T.newRoom('bedroom', { unit: U.id, org: U.org })));
    else if (t) T.setCell(c, mk(t));
  }
  // 작은 방(3칸 미만)은 거실로 — 잠방은 잠 고치(2 × 1 m + 앞 0.8 m)가 놓일 2 × 3 m 자리(2×2 덩어리 둘)가 없으면 거실로
  for (const R of Object.values(sub)) if (R.n > 0 && (R.n < 4 || (R.type === 'bedroom' && (R.n < 6 || fat(g, room, R) < 2)))) for (const c of cells) if (room[c] === R.id + 1) T.setCell(c, living);
  U.subs = Object.values(sub).filter((R) => R.n > 0).map((R) => R.id);
}

/** 방의 바깥벽에 닿은 칸 한 줄을 발코니로 (줄이 3칸 넘고, 방이 넉넉히 남을 때) */
function balconyOf(F, L, g, T, R) {
  const { room } = L;
  const cells = [];
  for (let c = 0; c < g.n; c++) if (room[c] === R.id + 1) cells.push(c);
  const edge = cells.filter((c) => { let out = false; g.nb(c, (e) => { if (!F.mask[e]) out = true; }); return out; });
  if (edge.length < 3 || cells.length - edge.length < 8) return;
  const B = T.newRoom('balcony', { unit: R.unit ?? R.id, org: R.org });
  for (const c of edge) T.setCell(c, B);
  R.subs = (R.subs || []).concat([B.id]);
}

function subdivideGuest(B, F, L, g, rnd, T, U, isEntry) {
  const { room } = L;
  const cells = [];
  for (let c = 0; c < g.n; c++) if (room[c] === U.id + 1) cells.push(c);
  if (cells.length < 12) return;
  const entryCells = cells.filter((c) => { let e = false; g.nb(c, (x) => { if (isEntry(x)) e = true; }); return e; });
  const dep = bfs(g, entryCells, (c) => room[c] === U.id + 1);
  let ax = 0, az = 0;
  for (const c of entryCells) g.nb(c, (x, di, dj) => { if (isEntry(x)) { ax += -dj; az += di; } });
  const al = Math.hypot(ax, az) || 1;
  ax /= al; az /= al;
  let s0 = 1e9, s1 = -1e9;
  for (const c of cells) { const s = g.i(c) * ax + g.j(c) * az; s0 = Math.min(s0, s); s1 = Math.max(s1, s); }
  const mirror = rnd() < 0.5;
  const bath = T.newRoom('bath', { unit: U.id, org: U.org });
  for (const c of cells) {
    let s = (g.i(c) * ax + g.j(c) * az - s0) / Math.max(1, s1 - s0);
    if (mirror) s = 1 - s;
    if (s < 0.5 && dep[c] < 3) T.setCell(c, bath);
  }
  // 욕실이 너무 작거나, 욕실을 떼면 객실이 잠자리·책상을 놓을 넓이(MIN_ROOM.guestroom)·모양(2×2 덩어리 둘)이 안 되면 떼지 않는다
  if (bath.n < 4 || U.n < MIN_ROOM.guestroom || fat(g, room, U) < 2) for (const c of cells) if (room[c] === bath.id + 1) T.setCell(c, U);
  U.subs = bath.n ? [bath.id] : [];
}

// ── 한 집(단독 주택) ────────────────────────────────────────
// 가장 넓은 층이 살림층(현관·거실·부엌·씻는 방), 나머지는 잠방층(계단참·씻는 방·잠방·서재), 아주 작은 층은 현관 홀·계단참.
// 계단참(또는 현관)에서 두 칸까지를 홀로 두고, 씻는 방은 심 옆에, 나머지는 홀 둘레를 부채꼴로 나눠 방마다 홀에 닿게 한다.
function housePlan(B, F, L, g, rnd, T) {
  const { room } = L;
  const cells = [];
  for (let c = 0; c < g.n; c++) if (T.free(c)) cells.push(c);
  const houseFloors = B.floors.filter((x) => x.use === 'house');
  const main = houseFloors.reduce((a, x) => (x.n > a.n * 1.4 ? x : a), houseFloors[0]);
  const isMain = F === main;
  const rs = {};
  const mk = (t, k = '') => rs[t + k] || (rs[t + k] = T.newRoom(t, { org: F.org, house: true, ...(t === 'office1' ? { name: '서재' } : {}) }));
  if (cells.length < 30) {
    // 작은 층: 집에 큰 층이 따로 있으면 현관 홀·계단참, 이 층이 집의 가장 큰 층이면 한 칸 집(잠 고치·조리대·식탁이 한 방에)
    const bigger = houseFloors.some((x) => x !== F && x.n >= 30);
    const R = bigger ? mk('entry') : mk('unit');
    if (bigger) { R.name = F.i === B.ground ? '현관 홀' : '계단참'; R.circ = true; } else R.name = '한 칸 집';
    for (const c of cells) T.setCell(c, R);
    return;
  }
  // 홀의 시작: 1층은 정문, 위층은 계단 앞
  let start = [];
  if (F.i === B.ground && L.ents.main) start = [L.ents.main.c];
  else if (B.core) {
    for (const p of B.core.parts) { if (p.kind !== 'stair' && p.kind !== 'spiral') continue; const [ci, cj] = p.door.c, [fi, fj] = p.door.dir; if (g.ok(ci + fi, cj + fj)) start.push(g.c(ci + fi, cj + fj)); }
    for (const [i, j] of B.core.lobby) if (g.ok(i, j)) start.push(g.c(i, j));
  }
  start = start.filter((c) => T.free(c));
  if (!start.length) start = [cells[0]];
  const dH = bfs(g, start, (c) => T.free(c));
  const hall = mk('entry');
  hall.name = isMain && F.i === B.ground ? '현관' : '홀';
  hall.circ = true;
  for (const c of cells) if (dH[c] >= 0 && dH[c] <= (cells.length > 120 ? 2 : 1)) T.setCell(c, hall);
  // 씻는 방: 심(계단) 가까이, 홀 밖의 칸 몇
  const coreCells = [];
  if (B.core) for (const p of B.core.parts) for (const [i, j] of p.cells) if (g.ok(i, j)) coreCells.push(g.c(i, j));
  const dCo = bfs(g, coreCells.length ? coreCells : start, (c) => T.free(c) || coreCells.includes(c));
  const near = cells.filter((c) => T.free(c)).sort((p, q) => dCo[p] - dCo[q]);
  const bath = mk('bath');
  for (const c of near.slice(0, Math.min(10, Math.max(5, Math.round(cells.length * 0.08))))) T.setCell(c, bath);
  // 나머지: 홀 가운데에서 본 각도로 부채꼴
  let hx = 0, hz = 0, hn = 0;
  for (const c of cells) if (room[c] === hall.id + 1) { hx += g.i(c); hz += g.j(c); hn++; }
  hx /= hn || 1; hz /= hn || 1;
  const rest = cells.filter((c) => T.free(c)).map((c) => ({ c, a: Math.atan2(g.j(c) - hz, g.i(c) - hx) }));
  rest.sort((p, q) => p.a - q.a);
  const kinds = isMain ? (rest.length > 70 ? ['living', 'kitchen1', 'living'] : ['living', 'kitchen1']) : rest.length > 110 ? ['bedroom', 'office1', 'bedroom', 'bedroom'] : rest.length > 60 ? ['bedroom', 'bedroom'] : ['bedroom'];
  const shares = kinds.map((k) => (k === 'living' ? 1.6 : k === 'office1' ? 0.7 : k === 'kitchen1' ? 0.9 : 1));
  const tot = shares.reduce((a, b) => a + b, 0);
  const rot = Math.floor(rnd() * rest.length);
  const ordr = rest.slice(rot).concat(rest.slice(0, rot));
  let k = 0, acc = 0;
  const kc = {};
  for (const q of ordr) {
    while (k < kinds.length - 1 && acc >= (shares[k] / tot) * ordr.length) { acc -= (shares[k] / tot) * ordr.length; k++; }
    const t = kinds[k];
    const key = t === 'living' ? 'living' : t + (kc[t + k] ?? (kc[t + k] = Object.keys(kc).filter((x) => x.startsWith(t)).length));
    T.setCell(q.c, t === 'living' ? mk('living') : mk(t, String(key)));
    acc++;
  }
  for (const R of Object.values(rs)) if (R.n > 0 && R.n < 4 && R !== hall) for (const c of cells) if (room[c] === R.id + 1) T.setCell(c, hall);
}

// ── 중2층: 홀을 내려다보는 앞쪽 통로(난간) + 뒤쪽 방들(관제·사무·회의·직원실) ──
function mezzPlan(B, F, L, g, rnd, T) {
  const { room } = L;
  const inside = F.mask;
  const walk = T.newRoom('corridor', { circ: true, gallery: true });
  // 앞쪽 가장자리 두 칸 = 통로 (열마다 맨 앞 두 칸)
  for (let i = 0; i < g.gw; i++) {
    let jm = -1;
    for (let j = g.gh - 1; j >= 0; j--) if (T.free(g.c(i, j))) { jm = j; break; }
    if (jm < 0) continue;
    for (let j = jm; j > jm - 2 && j >= 0; j--) if (T.free(g.c(i, j))) T.setCell(g.c(i, j), walk);
  }
  const rest = [];
  for (let c = 0; c < g.n; c++) if (T.free(c)) rest.push(c);
  const op = FUSE[B.floors[B.ground].use] ? FUSE[B.floors[B.ground].use].op : 'factory';
  const list = op === 'factory' ? [['control', 7], ['office1', 0.5], ['meeting', 6], ['staffroom', 5]] : op === 'depot' ? [['office1', 0.5], ['control', 6], ['staffroom', 5], ['meeting', 6]]
    : op === 'plant' ? [['control', 9], ['office1', 0.5], ['staffroom', 5]] : op === 'terminal' ? [['lounge', 0.6], ['office1', 0.4], ['wc', 3]] : op === 'hall' ? [['control', 6], ['lounge', 0.6], ['rehearsal', 7]]
      : op === 'farm' ? [['office1', 0.5], ['analysis', 6], ['staffroom', 5]] : [['office1', 0.6], ['meeting', 6], ['staffroom', 5]];
  if (!rest.length) return;
  let i0 = 1e9, i1 = -1;
  for (const c of rest) { i0 = Math.min(i0, g.i(c)); i1 = Math.max(i1, g.i(c)); }
  const W = i1 - i0 + 1;
  const fixed = list.filter(([, w]) => w >= 1).reduce((a, [, w]) => a + w, 0);
  const fr = list.filter(([, w]) => w < 1).reduce((a, [, w]) => a + w, 0) || 1;
  const share = Math.max(0, W - fixed);
  let x = i0;
  const cuts = list.map(([t, w]) => { const a = x; x += w < 1 ? (share * w) / fr : w; return { t, a, b: x }; });
  const made = cuts.map((q) => T.newRoom(q.t, { org: F.org }));
  for (const c of rest) { const i = g.i(c) + 0.5; let k = cuts.findIndex((q) => i >= q.a && i < q.b); if (k < 0) k = cuts.length - 1; T.setCell(c, made[k]); }
  for (const R of made) if (R.n > 0 && R.n < 5) for (const c of rest) if (room[c] === R.id + 1) T.setCell(c, walk);
  L.mezzWalk = walk.id;
  void inside; void rnd;
}

// ── 넓은 홀 층 ──────────────────────────────────────────────
/** 홀 + 뒤쪽 일하는 방 + (1층) 앞쪽 작은 가게들 */
function openPlan(B, F, L, g, rnd, T) {
  const { room } = L;
  const inside = F.mask;
  const use = F.use;
  // 홀 이름
  const HALL = {
    lobby: 'lobby', stem: 'vestibule', mart: 'sales', shops: 'sales', dept: 'sales', food: 'dining', cafe: 'dining', clothes: 'boutique', care: 'waiting', carew: 'waiting', civic: 'counters', bank: 'banking',
    library: 'stacks', museum: 'gallery', hall: 'auditorium', schoolhall: 'gym', hotelfront: 'lobby', factory: 'production', storage: 'warehouse',
    transit: 'concourse', farm: 'growhall', garden: 'gardenhall', plant: 'corehall', parking: 'parkbay', supply: 'warehouse', amenity: 'lounge', observation: 'deck', mezz: 'office1', canteen: 'canteen',
  };
  // 뒤쪽 일하는 방들: [종류, 너비 m] (뒤쪽 벽을 따라 depth m 깊이)
  const BOH = {
    mart: { d: 7, list: [['stockroom', 0.55], ['staffroom', 5], ['office1', 4], ['wc', 3]], dock: true },
    shops: { d: 5, list: [['storage', 5], ['wc', 3], ['staffroom', 4]] },
    dept: { d: 6, list: [['stockroom', 0.5], ['staffroom', 5], ['wc', 4], ['office1', 5]], dock: F.i === B.ground },
    food: { d: 6, list: [['kitchen', 0.45], ['pantry2', 4], ['wc', 3], ['staffroom', 4]] },
    cafe: { d: 5, list: [['kitchen', 0.5], ['pantry2', 3], ['wc', 3]] },
    clothes: { d: 5, list: [['fitting', 4], ['tailor', 5], ['storage', 0.35], ['wc', 3]] }, // 탈의실 · 재단실 · 옷 창고
    canteen: { d: 6, list: [['kitchen', 0.5], ['pantry2', 5], ['staffroom', 4], ['wc', 4]] },
    care: { d: 6, list: [['consult', 4], ['treat', 6], ['pharmacy', 5], ['nurse', 4], ['wc', 3]] },
    carew: { d: 6, list: [['wardroom', 0.35], ['consult', 4], ['treat', 5], ['nurse', 3], ['wc', 3]] },
    civic: { d: 6, list: [['office1', 0.4], ['records', 6], ['meeting', 6], ['wc', 3]] },
    bank: { d: 6, list: [['vault', 5], ['bankconsult', 5], ['office1', 0.35], ['records', 4], ['security', 4], ['wc', 3]] }, // 큰 은행: 금고실·기록실·관리실까지
    library: { d: 6, list: [['archive', 0.4], ['reading', 8], ['office1', 4], ['wc', 3]] },
    museum: { d: 6, list: [['conserve', 7], ['storage', 0.35], ['office1', 4], ['wc', 3]], gallery: true },
    hall: { d: 6, list: [['backstage', 0.5], ['rehearsal', 7], ['wc', 3], ['storage', 3]] },
    schoolhall: { d: 4, list: [['storage', 5], ['wc', 3]] },
    hotelfront: { d: 6, list: [['office1', 5], ['kitchen', 6], ['laundry', 5], ['storage', 3], ['wc', 3]] },
    factory: { d: 7, list: [['rawstore', 0.32], ['maint', 6], ['staffroom', 5], ['wc', 3], ['finished', 0.3]], dock: true },
    storage: { d: 6, list: [['sorting', 0.4], ['office1', 5], ['staffroom', 4], ['wc', 3]], dock: true },
    transit: { d: 6, list: [['platform', 0.7], ['office1', 4], ['wc', 3]] },
    farm: { d: 6, list: [['packing', 0.35], ['nutrient', 5], ['coldroom', 5], ['wc', 3]], dock: true },
    garden: { d: 4, list: [['storage', 4], ['wc', 3]] },
    plant: { d: 7, list: [['coilroom', 0.4], ['fuelstore', 0.3], ['maint', 6], ['wc', 3]], dock: true },
    lobby: { d: 5, list: [['security', 4], ['mailroom', 5], ['wc', 4], ['storage', 3]] },
    stem: null,
    parking: { d: 5, list: [['storage', 0.5], ['mech', 0.5]] },
    supply: { d: 6, list: [['storage', 0.4], ['mech', 0.3], ['laundry', 0.3]] },
    amenity: { d: 6, list: [['gymroom', 0.5], ['pool', 0.5]] },
    observation: { d: 5, list: [['bar', 0.6], ['wc', 3], ['storage', 3]] },
    mezz: { d: 0, list: [] },
  };
  // 작은 층(150 m² 아래): 뒤쪽 방은 이 쓰임에 꼭 있어야 하는 것만 (마트의 창고, 식당의 주방, 치유원의 진료실…) — 홀에 일할 자리가 남게
  const SMALL_BOH = {
    mart: [['stockroom', 0.9]], shops: [['storage', 0.9]], dept: [['stockroom', 0.9]], food: [['kitchen', 0.9]], cafe: [['kitchen', 0.9]], clothes: [['fitting', 0.45], ['tailor', 0.5]], canteen: [['kitchen', 0.9]],
    care: [['consult', 0.5], ['pharmacy', 0.4]], carew: [['wardroom', 0.55], ['consult', 0.4]], civic: [['office1', 0.9]], bank: [['bankconsult', 0.5], ['office1', 0.4]], library: [], museum: [['storage', 0.9]], hall: [['backstage', 0.9]], schoolhall: [],
    hotelfront: [['office1', 0.9]], factory: [['rawstore', 0.45], ['finished', 0.45]], storage: [['sorting', 0.9]], transit: [['platform', 0.9]], farm: [['packing', 0.9]],
    garden: [], plant: [['fuelstore', 0.9]], lobby: [['mailroom', 0.9]], observation: [['bar', 0.9]],
  };
  const hallType = HALL[use] || 'lobby';
  let spec = BOH[use];
  if (spec && F.n < 150 && SMALL_BOH[use]) spec = SMALL_BOH[use].length && F.n >= 60 ? { ...spec, d: Math.min(spec.d, 3), list: SMALL_BOH[use] } : null;
  // 뒤쪽(−z) 벽에서의 거리: 열마다 맨 뒤 칸에서
  const back = new Int16Array(g.n).fill(-1);
  for (let i = 0; i < g.gw; i++) {
    let j0 = -1;
    for (let j = 0; j < g.gh; j++) if (inside[g.c(i, j)]) { j0 = j; break; }
    if (j0 < 0) continue;
    for (let j = j0; j < g.gh; j++) if (inside[g.c(i, j)]) back[g.c(i, j)] = j - j0;
  }
  // 바닥 깊이가 얕으면(작은 건물) 일하는 방도 얕게
  let maxJ = 0;
  for (let c = 0; c < g.n; c++) if (inside[c]) maxJ = Math.max(maxJ, back[c]);
  const bohD = spec ? (F.n < 150 ? Math.min(3, Math.floor(maxJ * 0.25)) : Math.min(spec.d, Math.max(0, Math.floor(maxJ * 0.38)))) : 0;
  const minD = F.n < 150 ? 2 : 3; // 작은 층은 두 칸 깊이의 뒤쪽 방도
  const hall = T.newRoom(hallType, { org: F.org, main: true });
  // 승강기 홀 → 넓은 홀: 뒤쪽 일하는 방 띠가 심을 감싸 승강기 홀을 가두지 않게, 띠 밖까지 길(두세 칸)을 먼저 홀로 잡는다
  if (L.lifthall != null && spec && bohD >= minD && !F.mezz) {
    const lh = L.lifthall + 1, prev = new Int32Array(g.n).fill(-2), q = [];
    for (let c = 0; c < g.n; c++) if (room[c] === lh) { prev[c] = -1; q.push(c); }
    let hit = -1;
    for (let h = 0; h < q.length && hit < 0; h++) {
      const c = q[h];
      if (room[c] !== lh && back[c] >= bohD) { hit = c; break; }
      g.nb(c, (e) => { if (prev[e] === -2 && T.free(e)) { prev[e] = c; q.push(e); } });
    }
    if (hit >= 0) for (let c = hit; c >= 0 && room[c] !== lh; c = prev[c]) { if (T.free(c)) T.setCell(c, hall); g.nb(c, (e) => { if (T.free(e) && back[e] >= 0) T.setCell(e, hall); }); }
  }
  const bohCells = [];
  for (let c = 0; c < g.n; c++) {
    if (!T.free(c)) continue;
    if (bohD >= minD && back[c] >= 0 && back[c] < bohD && !F.mezz) bohCells.push(c);
    else T.setCell(c, hall);
  }
  // 일하는 방: 뒤쪽 띠를 x 로 자른다 (비율 <1 = 남은 길이의 몫, ≥1 = m)
  if (bohCells.length && spec) {
    let i0 = 1e9, i1 = -1;
    for (const c of bohCells) { i0 = Math.min(i0, g.i(c)); i1 = Math.max(i1, g.i(c)); }
    const W = i1 - i0 + 1;
    const fixed = spec.list.filter(([, w]) => w >= 1).reduce((a, [, w]) => a + w, 0);
    const share = Math.max(0, W - fixed);
    const fr = spec.list.filter(([, w]) => w < 1).reduce((a, [, w]) => a + w, 0) || 1;
    const items = shuffle(rnd, spec.list.slice(1)).concat([spec.list[0]]);
    // 큰 방(첫째)은 가운데·하역 문 쪽으로: 순서를 섞되 첫째는 가운데
    const order = [...items.slice(0, Math.floor(items.length / 2)), items[items.length - 1], ...items.slice(Math.floor(items.length / 2), items.length - 1)];
    let x = i0;
    const cuts = order.map(([t, w]) => { const len = w < 1 ? (share * w) / fr : w; const a = x; x += len; return { t, a, b: x }; });
    if (W < 9) cuts.splice(1); // 아주 좁으면 큰 방 하나
    const made = cuts.map((q) => T.newRoom(q.t, { org: F.org, boh: true }));
    for (const c of bohCells) {
      const i = g.i(c) + 0.5;
      let k = cuts.findIndex((q) => i >= q.a && i < q.b);
      if (k < 0) k = cuts.length - 1;
      T.setCell(c, made[k]);
    }
    for (const R of made) if (R.n > 0 && R.n < 5) for (const c of bohCells) if (room[c] === R.id + 1) T.setCell(c, hall);
    L.boh = made.filter((R) => R.n > 0).map((R) => R.id);
    // 하역 문: 가장 큰 일하는 방의 뒤쪽 바깥벽
    if (spec.dock) {
      const big = made.filter((R) => R.n).sort((a, b) => b.n - a.n)[0];
      if (big) {
        let best = -1, bs = 1e9;
        for (const c of bohCells) {
          if (room[c] !== big.id + 1) continue;
          let ext = false;
          g.nb(c, (e, di, dj) => { if (!inside[e] && dj === -1) ext = true; });
          if (!ext) continue;
          const s = Math.abs(g.i(c) - (big.i0 ?? (i0 + i1) / 2));
          const sc = Math.abs(g.i(c) + 0.5 - (cuts[made.indexOf(big)].a + cuts[made.indexOf(big)].b) / 2);
          if (sc < bs) { bs = sc; best = c; }
          void s;
        }
        if (best >= 0) L.ents.dock = { c: best, dir: [0, -1], w: 3, room: big.id };
      }
    }
  }
  // 1층 로비: 앞쪽 양 모서리에 작은 가게 (상업 구역·큰 건물)
  if ((use === 'lobby' || use === 'hotelfront') && F.n > 400 && rnd() < 0.7) {
    let jMax = 0;
    for (let c = 0; c < g.n; c++) if (room[c] === hall.id + 1) jMax = Math.max(jMax, g.j(c));
    let i0 = 1e9, i1 = -1;
    for (let c = 0; c < g.n; c++) if (room[c] === hall.id + 1) { i0 = Math.min(i0, g.i(c)); i1 = Math.max(i1, g.i(c)); }
    for (const side of [0, 1]) {
      const K = T.newRoom(rnd() < 0.5 ? 'kiosk' : use === 'hotelfront' ? 'bar' : 'kiosk', { org: null, shop: true });
      for (let c = 0; c < g.n; c++) {
        if (room[c] !== hall.id + 1) continue;
        const i = g.i(c), j = g.j(c);
        if (jMax - j < 6 && (side === 0 ? i - i0 < 6 : i1 - i < 6)) T.setCell(c, K);
      }
      if (K.n < 12) for (let c = 0; c < g.n; c++) if (room[c] === K.id + 1) T.setCell(c, hall);
    }
  }
  // 전시: 홀을 이어진 전시실 몇으로 (넓은 문으로 차례차례)
  if (spec && spec.gallery) {
    let i0 = 1e9, i1 = -1;
    for (let c = 0; c < g.n; c++) if (room[c] === hall.id + 1) { i0 = Math.min(i0, g.i(c)); i1 = Math.max(i1, g.i(c)); }
    const W = i1 - i0 + 1, n = Math.max(1, Math.min(5, Math.round(W / 11)));
    if (n > 1) {
      const gs = [hall];
      for (let k = 1; k < n; k++) gs.push(T.newRoom('gallery', { org: F.org, main: true }));
      for (let c = 0; c < g.n; c++) if (room[c] === hall.id + 1) { const k = Math.min(n - 1, Math.floor(((g.i(c) - i0) / W) * n)); if (k) T.setCell(c, gs[k]); }
      L.galleries = gs.map((R) => R.id);
    }
  }
  // 공연장: 객석 앞쪽 띠는 휴게 홀(로비)
  //   (작은 층은 휴게 홀 띠를 얕게, 객석이 30 m² 아래로 줄면 나누지 않는다 — 객석 없는 공연장이 되지 않게)
  if (use === 'hall' && hall.n >= 60) {
    let jMax = 0, jMin = 1e9;
    for (let c = 0; c < g.n; c++) if (room[c] === hall.id + 1) { jMax = Math.max(jMax, g.j(c)); jMin = Math.min(jMin, g.j(c)); }
    const fd = Math.min(5, Math.max(2, Math.floor((jMax - jMin + 1) * 0.3)));
    const fo = T.newRoom('foyer', { org: F.org });
    for (let c = 0; c < g.n; c++) if (room[c] === hall.id + 1 && jMax - g.j(c) < fd) T.setCell(c, fo);
    if (fo.n < 12 || hall.n < 30) for (let c = 0; c < g.n; c++) if (room[c] === fo.id + 1) T.setCell(c, hall);
  }
}

// ── 문 만들기 ───────────────────────────────────────────────
/** 방마다 복도(또는 홀·거실)로 통하는 문. 세대 안 방은 거실로. 승강기·계단은 승강기 홀로 */
function makeDoors(B, F, L, g, rnd) {
  const { room, rooms, doors } = L;
  const circ = (R) => R && (R.circ || R.main);
  const typeOf = (c) => (room[c] ? rooms[room[c] - 1] : null);
  /** R 의 칸 가운데 이웃 조건을 만족하는 경계 [{c, e, di, dj}] */
  const edges = (R, pred) => {
    const out = [];
    for (let c = 0; c < g.n; c++) {
      if (room[c] !== R.id + 1) continue;
      if (L.void[c] === 3) continue; // 중2층 계단 칸에는 문을 내지 않는다
      g.nb(c, (e, di, dj) => { const S = typeOf(e); if (S && S !== R && pred(S) && L.void[e] !== 3) out.push({ c, e, di, dj, S }); });
    }
    return out;
  };
  const pickMid = (list) => {
    if (!list.length) return null;
    // 가장 긴 곧은 경계의 가운데
    let cx = 0, cz = 0;
    for (const q of list) { cx += g.i(q.c); cz += g.j(q.c); }
    cx /= list.length; cz /= list.length;
    let best = list[0], bd = 1e9;
    for (const q of list) { const d = Math.hypot(g.i(q.c) - cx, g.j(q.c) - cz); if (d < bd) { bd = d; best = q; } }
    return best;
  };
  // 문이 차지한 칸막이 모서리 (cells.doorEdges 와 같은 열쇠) — 넓은 문이 제 방 끝을 넘어 이웃 문과 겹치면 서로의 문틀 기둥·문 너머 어둠의 옆벽이
  // 상대 문을 막는다 (v24 셀 검사: 문 앞에서 끼임). 문은 두 방이 모두 맞닿은 칸에서만, 이미 문이 있는 모서리는 피해 폭을 줄이거나 옆으로 민다.
  const used = new Set(), near = new Set(); // near: 문 바로 옆 모서리 — 문틀 기둥이 서는 자리라 다른 문을 붙여 내지 않는다
  const ekey = (i, j, di, dj) => (di ? `v${di > 0 ? i + 1 : i},${j}` : `h${i},${dj > 0 ? j + 1 : j}`);
  const claim = (i0, j0, di, dj, lo, hi) => {
    const ti = dj ? 1 : 0, tj = di ? 1 : 0;
    for (let o = lo; o <= hi; o++) used.add(ekey(i0 + ti * o, j0 + tj * o, di, dj));
    near.add(ekey(i0 + ti * (lo - 1), j0 + tj * (lo - 1), di, dj));
    near.add(ekey(i0 + ti * (hi + 1), j0 + tj * (hi + 1), di, dj));
  };
  const span = (c, di, dj, w) => { const out = [], i = g.i(c), j = g.j(c), o0 = -Math.floor((Math.max(1, w) - 1) / 2), o1 = Math.ceil((Math.max(1, w) - 1) / 2); for (let o = o0; o <= o1; o++) out.push([i + (dj ? o : 0), j + (di ? o : 0)]); return out; };
  const add = (R, q, kind = 'door', w = 1) => {
    const ti = q.dj ? 1 : 0, tj = q.di ? 1 : 0, i0 = g.i(q.c), j0 = g.j(q.c);
    const ok = (o) => {
      const i = i0 + ti * o, j = j0 + tj * o, i2 = i + q.di, j2 = j + q.dj;
      const k = ekey(i, j, q.di, q.dj);
      return g.ok(i, j) && g.ok(i2, j2) && room[g.c(i, j)] === R.id + 1 && room[g.c(i2, j2)] === q.S.id + 1 && !used.has(k) && !near.has(k) && L.void[g.c(i, j)] !== 3 && L.void[g.c(i2, j2)] !== 3;
    };
    if (!ok(0)) return false;
    let lo = 0, hi = 0;
    while (hi - lo + 1 < w && ok(hi + 1)) hi++;
    while (hi - lo + 1 < w && ok(lo - 1)) lo--;
    const ww = hi - lo + 1, a = lo + Math.floor((ww - 1) / 2);
    claim(i0, j0, q.di, q.dj, lo, hi);
    doors.push({ a: R.id, b: q.S.id, c: g.c(i0 + ti * a, j0 + tj * a), dir: [q.di, q.dj], w: ww, kind });
    return true;
  };
  /** 경계 목록에서 가운데부터 (이미 문이 있는 모서리면 가까운 다른 자리로) — 놓은 자리 또는 null */
  const place = (R, list, kind, w) => {
    const q = pickMid(list);
    if (!q) return null;
    if (add(R, q, kind, w)) return q;
    const rest = list.filter((x) => x !== q).sort((x, y) => Math.hypot(g.i(x.c) - g.i(q.c), g.j(x.c) - g.j(q.c)) - Math.hypot(g.i(y.c) - g.i(q.c), g.j(y.c) - g.j(q.c)));
    for (const x of rest) if (add(R, x, kind, w)) return x;
    return null;
  };
  for (const R of rooms) {
    if (!R.n || R.circ || R.main && !R.boh) continue;
    if (R.type === 'shaft') continue;
    if (R.type === 'lift' || R.type === 'cargo' || R.type === 'stair') {
      // 심의 부품: 정면 문 (승강기는 서는 층에만)
      if ((R.type !== 'stair' && !R.stops) || R.part == null) continue;
      const p = B.core.parts[R.part];
      const [ci, cj] = p.door.c, [fi, fj] = p.door.dir;
      const c = g.c(ci, cj), e = g.c(ci + fi, cj + fj);
      if (g.ok(ci + fi, cj + fj) && room[e]) {
        const w = R.type === 'cargo' ? 2 : 1;
        doors.push({ a: R.id, b: room[e] - 1, c, dir: [fi, fj], w, kind: R.type, link: R.link });
        claim(ci, cj, fi, fj, -Math.floor((w - 1) / 2), Math.ceil((w - 1) / 2));
      }
      continue;
    }
    // 세대 안 방: 그 세대의 거실로
    if (R.unit != null && !R.unitRoot) {
      const U = rooms[R.unit];
      const kind = R.type === 'kitchen1' ? 'open' : 'door', w = R.type === 'kitchen1' ? 2 : 1;
      place(R, edges(R, (S) => S === U), kind, w) || place(R, edges(R, (S) => S.unit === R.unit || S === U), kind, w);
      continue;
    }
    if (R.house) {
      // 집 안: 거실·부엌은 홀로 열려 있고, 잠방·씻는 방·서재는 홀(없으면 거실)로 문
      const open = R.type === 'living' || R.type === 'kitchen1';
      const kind = open ? 'open' : 'door', w = open ? 2 : 1;
      place(R, edges(R, (S) => S.circ), kind, w) || place(R, edges(R, (S) => S.type === 'living'), kind, w) || place(R, edges(R, (S) => S.house), kind, w);
      // 계단·승강기 홀과 집 홀 사이
      continue;
    }
    // 보통 방: 복도·홀로 (큰 방·공용 방은 넓게)
    let list = edges(R, circ);
    if (!list.length) list = edges(R, (S) => !['stair', 'lift', 'cargo', 'shaft'].includes(S.type));
    if (!list.length) continue;
    const pub = ROOMS[R.type] && ROOMS[R.type].acc === 'public';
    const wide = R.n > 60 || ['waiting', 'lounge', 'canteen', 'gym', 'foyer', 'auditorium', 'kiosk', 'bar', 'platform', 'gallery', 'gymroom', 'pool', 'deck', 'sorting', 'rawstore', 'finished', 'coilroom', 'fuelstore', 'packing', 'stockroom', 'kitchen', 'giftshop', 'counters', 'reading'].includes(R.type);
    const open = ['waiting', 'lounge', 'kiosk', 'bar', 'platform', 'foyer', 'deck', 'sorting', 'rawstore', 'finished', 'canteen'].includes(R.type);
    const q = place(R, list, open ? 'open' : R.boh ? 'staff' : 'door', open ? 3 : wide ? 2 : 1);
    // 큰 방은 둘째 문 (먼 쪽)
    if (q && R.n > 90 && list.length > 6) {
      let far = null, fd = -1;
      for (const x of list) { const d = Math.hypot(g.i(x.c) - g.i(q.c), g.j(x.c) - g.j(q.c)); if (d > fd) { fd = d; far = x; } }
      if (far && fd > 6) add(R, far, open ? 'open' : R.boh ? 'staff' : 'door', wide ? 2 : 1);
    }
    void pub;
  }
  // 이어진 전시실: 넓은 열린 문으로 차례로
  if (L.galleries) for (let k = 1; k < L.galleries.length; k++) {
    const R = rooms[L.galleries[k]], P = rooms[L.galleries[k - 1]];
    place(R, edges(R, (S) => S === P), 'open', 3);
  }
  // 갇힌 방이 없게: 문으로 이어진 방 그래프에서 홀·복도에 닿지 않는 방은 아무 이웃으로 문을 낸다
  for (let guard = 0; guard < 4; guard++) {
    const adj = new Map();
    for (const d of doors) { if (d.b < 0) continue; (adj.get(d.a) || adj.set(d.a, []).get(d.a)).push(d.b); (adj.get(d.b) || adj.set(d.b, []).get(d.b)).push(d.a); }
    const roots = rooms.filter((R) => R.n && (R.circ || R.main || (L.ents.main && room[L.ents.main.c] === R.id + 1))).map((R) => R.id); // 정문이 여는 방도 출발점
    const seen = new Set(roots), q = [...roots];
    while (q.length) { const a = q.pop(); for (const b of adj.get(a) || []) if (!seen.has(b)) { seen.add(b); q.push(b); } }
    let fixed = 0;
    for (const R of rooms) {
      if (!R.n || seen.has(R.id) || ['shaft', 'lift', 'cargo'].includes(R.type) || (R.type === 'stair' && !R.stops && R.part != null)) continue;
      if (R.type === 'stair') continue;
      if (place(R, edges(R, (S) => seen.has(S.id) && !['shaft', 'lift', 'cargo', 'stair'].includes(S.type)), 'door', 1)) fixed++;
    }
    if (!fixed) break;
  }
  // 그래도 갇힌 방(심 뒤에 끼인 자투리 등): 이어진 이웃 방에 합치고, 이웃이 없으면 설비 공간(들어갈 수 없는 관·덕트)으로
  {
    const adj = new Map();
    for (const d of doors) { if (d.b < 0) continue; (adj.get(d.a) || adj.set(d.a, []).get(d.a)).push(d.b); (adj.get(d.b) || adj.set(d.b, []).get(d.b)).push(d.a); }
    const roots = rooms.filter((R) => R.n && (R.circ || R.main || (L.ents.main && room[L.ents.main.c] === R.id + 1))).map((R) => R.id); // 정문이 여는 방도 출발점
    const seen = new Set(roots), q = [...roots];
    while (q.length) { const a = q.pop(); for (const b of adj.get(a) || []) if (!seen.has(b)) { seen.add(b); q.push(b); } }
    for (const R of rooms) {
      if (!R.n || seen.has(R.id) || ['shaft', 'lift', 'cargo', 'stair'].includes(R.type)) continue;
      const nb = edges(R, (S) => seen.has(S.id) && !['shaft', 'lift', 'cargo', 'stair'].includes(S.type));
      const to = nb.length ? nb[0].S : null;
      for (let k = doors.length - 1; k >= 0; k--) if (doors[k].a === R.id || doors[k].b === R.id) doors.splice(k, 1);
      if (to) { for (let c = 0; c < g.n; c++) if (room[c] === R.id + 1) { room[c] = to.id + 1; to.n++; } R.n = 0; }
      else { R.type = 'shaft'; R.name = '설비 공간'; R.sealed = true; }
    }
  }
  void B; void F; void rnd;
}
