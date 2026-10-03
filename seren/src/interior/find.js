// 건물 안에서 찾기 (v0.9): 방·층·시설·물건·사람·이음(승강기·계단·출구)을 건물 짜임(B)·층 평면(L)·가구(fix)·운영 상태(node)에서 찾는다.
//  · 안내 빛판(apps 의 directory)·실내 지도(ui/imap)·모아(「가까운 승강기」「계산대」「내가 일하는 곳」)가 모두 이것을 쓴다.
//  · 결과: [{ kind, label, sub, floor, gx, gz(틀 좌표 m), room, fix, d(지금 자리에서의 대략 거리) }]
//  · 층은 지금 층에서 가까운 순으로 펴 보고(평면이 없으면 그때 만든다), 결과가 넉넉하면 멈춘다 — 아주 높은 건물도 한 번에 다 만들지 않는다.
import { GOODS } from '../data/goods.js';
import { ITEMS } from '../data/venues.js';
import { FUSE, ROOMS, FIX } from './catalog.js';
import { won } from '../data/money.js';

/** 이음(계단·승강기)의 문 앞 자리 (틀 좌표) */
export function partSpot(B, part, out = 1.3) {
  const [i, j] = part.door.c, [dx, dz] = part.door.dir;
  return [B.G.ox + i + 0.5 + dx * out, B.G.oz + j + 0.5 + dz * out];
}
/** 방의 가운데 (틀 좌표) */
export function roomSpot(B, R) { return [B.G.ox + R.cx + 0.5, B.G.oz + R.cz + 0.5]; }
/** 정문 안쪽 자리 */
export function exitSpot(B, L, k = 'main') {
  const e = L.ents && L.ents[k];
  if (!e) return null;
  const i = e.c % B.G.gw, j = (e.c / B.G.gw) | 0;
  return [B.G.ox + i + 0.5 - e.dir[0] * 1.2, B.G.oz + j + 0.5 - e.dir[1] * 1.2];
}
/** 중2층 계단의 아래·위 자리 */
export function mezzSpot(B, L, top) {
  const m = L.mstair;
  if (!m) return null;
  const { ox, oz } = B.G;
  if (m.axis === 'x') {
    if (top) return [ox + (m.i0 + m.i1 + 1) / 2, oz + m.J + 0.4];
    const ib = m.run0 + m.sx * (m.n - 1);
    return [ox + ib + 0.5 + m.sx * 1.4, oz + m.J + 2];
  }
  const gx = ox + (m.i0 + m.i1 + 1) / 2;
  return top ? [gx, oz + m.J + 0.4] : [gx, oz + m.jBot + 1.6];
}

const LINKNAME = { stair: '계단', spiral: '나선 계단', lift: '승강기', cargo: '화물 승강기', open: '중2층 계단', roof: '옥상 계단' };
export { LINKNAME };

/** 낱말 → 찾는 것 */
const ALIAS = [
  [/엘리베이터|승강기|리프트/, { link: ['lift'] }],
  [/화물/, { link: ['cargo'] }],
  [/계단/, { link: ['stair', 'spiral', 'open'] }],
  [/출구|나가는|나가|입구|정문|현관/, { exit: true }],
  [/옥상|지붕/, { roof: true }],
  [/테라스|발코니|바깥 ?단/, { terrace: true }],
  [/공중 ?다리|구름 ?다리|건너편|옆 ?탑/, { bridge: true }],
  [/화장실|정화실/, { room: ['wc'] }],
  [/계산/, { tag: ['checkout', 'order', 'pharmacy', 'tickets'] }],
  [/면접/, { tag: ['interview'] }],
  [/출근|퇴근/, { tag: ['clock'] }],
  [/단말|컴퓨터/, { tag: ['terminal', 'catalog', 'analysis'] }],
  [/안내/, { tag: ['directory', 'reception'] }],
  [/내 ?자리|내가 일하는|일터|직장|일하는 곳|내 ?일/, { mywork: true }],
  [/내 ?방|묵는 ?방|객실 ?열쇠/, { myroom: true }],
  [/우리 ?집|내 ?집/, { myhome: true }],
  [/연구실|실험실/, { room: ['labroom', 'instrument', 'analysis', 'cleanroom'] }],
  [/창고/, { room: ['stockroom', 'storage', 'warehouse', 'rawstore', 'finished', 'pantry2', 'archive'] }],
  [/하역/, { room: ['dock'] }],
  [/진료|병원|치유/, { room: ['consult', 'waiting', 'treat', 'scan'] }],
  [/약/, { tag: ['pharmacy'] }],
  [/교실|수업/, { room: ['classroom', 'sciroom', 'musicroom'] }],
  [/회의/, { room: ['meeting', 'council'] }],
  [/식당|밥|먹을|주문/, { tag: ['order'] }],
  [/쉬|휴게|쉼터/, { room: ['lounge', 'staffroom', 'foyer'] }],
];

/**
 * 찾기. game: 게임, q: 낱말, opt: { limit, floor(지금 층), gx, gz(지금 자리) }
 * 반환: 가까운 순 결과
 */
export function searchBuilding(game, q, opt = {}) {
  const I = game.interiors, cur = I.cur;
  if (!cur || !cur.indoor) return [];
  const ind = cur.indoor, B = cur.B, ops = game.ops;
  const s = String(q || '').trim();
  if (!s) return [];
  const here = opt.floor ?? ind.cur;
  let [hx, hz] = opt.gx != null ? [opt.gx, opt.gz] : ind.grid(game.player.pos.x, game.player.pos.z);
  const res = [];
  const add = (e) => { e.d = Math.abs(e.floor - here) * 8 + Math.hypot(e.gx - hx, e.gz - hz) * (e.floor === here ? 1 : 0.3); res.push(e); };
  const fl = (i) => B.floors[i];
  const reach = B.floors.filter((F) => F.reach && !F.dead).map((F) => F.i).sort((a, b) => Math.abs(a - here) - Math.abs(b - here) || a - b);
  const al = ALIAS.filter(([re]) => re.test(s)).map(([, v]) => v);
  const want = Object.assign({}, ...al);
  const S = game.state.work || { jobs: [] };
  // ── 나와 관계된 곳 ──
  if (want.mywork) {
    const job = (S.jobs || []).find((j) => j.uid === cur.uid);
    if (job) {
      const T = ops && ops.tenants && ops.tenants.find((t) => t.k === job.k);
      for (const i of (T ? T.floors : reach).slice(0, 6)) {
        const pl = ind.plan(i);
        const F = pl && pl.fix.find((f) => f.tag === 'clock') || pl && pl.fix.find((f) => f.tag === 'desk' || f.tag === 'checkout' || f.tag === 'machine');
        if (F) { add({ kind: 'mywork', label: `내 일터 · ${job.title}`, sub: `${fl(i).label}층 · ${F.tag === 'clock' ? '출근 단말' : FIX[F.t].name}`, floor: i, gx: F.ax, gz: F.az, fix: F.id }); break; }
      }
    } else if ((S.jobs || []).length) {
      const j = S.jobs[0];
      res.push({ kind: 'world', label: `내 일터 · ${j.title}`, sub: `${j.bname || j.org} (다른 건물)`, world: { x: j.x, z: j.z }, floor: here, gx: hx, gz: hz, d: 1e6 });
    }
  }
  if (want.myroom && S.hotel && S.hotel.uid === cur.uid) {
    const pl = ind.plan(S.hotel.floor), R = pl && pl.L.rooms[S.hotel.roomId];
    if (R) { const [gx, gz] = roomSpot(B, R); add({ kind: 'room', label: `묵는 방 · ${S.hotel.room}`, sub: '잠 고치에서 쉬면 저장', floor: S.hotel.floor, gx, gz, room: R.id }); }
  }
  if (want.myhome && game.state.home != null && ops && cur.r.id === game.state.home) {
    const b = game.state.bld && game.state.bld[cur.uid];
    const mf = b && b.myFloor != null ? b.myFloor : reach.find((i) => fl(i).use === 'residential' || fl(i).use === 'house');
    if (mf != null) { const pl = ind.plan(mf); const U = pl && (pl.L.rooms.find((R) => (b && b.myUnit === `${mf}:${R.id}`)) || pl.L.rooms.find((R) => R.unitRoot || R.house)); if (U) { const [gx, gz] = roomSpot(B, U); add({ kind: 'room', label: '우리 집', sub: `${fl(mf).label}층`, floor: mf, gx, gz, room: U.id }); } }
  }
  // ── 이음 ──
  if (want.link && B.core) {
    // 승강기를 찾는데 이 건물엔 화물 승강기뿐이면 그것도
    const kinds = want.link.includes('lift') && !B.links.some((k) => k.kind === 'lift') ? [...want.link, 'cargo'] : want.link;
    for (const lk of B.links) {
      if (!kinds.includes(lk.kind)) continue;
      if (lk.kind === 'open') {
        const lo = lk.floors[0], pl = ind.plan(lo);
        const sp = pl && mezzSpot(B, pl.L, false);
        if (sp) add({ kind: 'link', label: '중2층 계단', sub: `${fl(lo).label}층 홀 → 중2층`, floor: lo, gx: sp[0], gz: sp[1], link: lk.id });
        continue;
      }
      const part = B.core.parts[lk.part];
      if (!part) continue;
      const fls = lk.floors.includes(here) ? [here] : [lk.floors.slice().sort((a, b) => Math.abs(a - here) - Math.abs(b - here))[0]];
      const [gx, gz] = partSpot(B, part);
      for (const i of fls) add({ kind: 'link', label: LINKNAME[lk.kind] || lk.kind, sub: `${lk.bank === 'high' ? '높은 층 ' : lk.bank === 'low' ? '낮은 층 ' : ''}${fl(Math.min(...lk.floors)).label}~${fl(Math.max(...lk.floors)).label}층`, floor: i, gx, gz, link: lk.id });
    }
  }
  if (want.exit) {
    const pl = ind.plan(B.ground), sp = pl && exitSpot(B, pl.L);
    if (sp) add({ kind: 'exit', label: '정문 (나가는 곳)', sub: `${fl(B.ground).label}층`, floor: B.ground, gx: sp[0], gz: sp[1] });
    for (const i of reach) { const pl2 = ind.plan(i); const e = pl2 && pl2.L.ents.dock; if (e) { const sp2 = exitSpot(B, pl2.L, 'dock'); if (sp2) add({ kind: 'exit', label: '하역 문', sub: `${fl(i).label}층 · 직원`, floor: i, gx: sp2[0], gz: sp2[1] }); } }
  }
  if (want.roof && B.roof) {
    const lk = B.links.find((k) => k.kind === 'roof');
    const part = lk && B.core.parts[lk.part];
    if (part) { const [gx, gz] = partSpot(B, part); add({ kind: 'roof', label: '옥상 문', sub: `${fl(lk.floors[0]).label}층 계단 위`, floor: lk.floors[0], gx, gz }); }
  }
  if (want.terrace) for (const F of B.floors) if (F.terrace && F.reach) { const pl = ind.plan(F.i); const e = pl && pl.L.ents.terrace; if (e) { const i = e.c % B.G.gw, j = (e.c / B.G.gw) | 0; add({ kind: 'terrace', label: '바깥 단(테라스)', sub: `${F.label}층`, floor: F.i, gx: B.G.ox + i + 0.5 - e.dir[0], gz: B.G.oz + j + 0.5 - e.dir[1] }); } }
  if (want.bridge) for (const F of B.floors) if (F.bridges && F.reach) {
    const pl = ind.plan(F.i);
    for (const e of (pl && pl.L.ents.bridge) || []) {
      const BL = game.city && game.city.bridgeList ? game.city.bridgeList[e.bi] : null;
      const other = BL ? (BL.a === cur.r ? BL.b : BL.a) : null;
      const i = e.c % B.G.gw, j = (e.c / B.G.gw) | 0;
      add({ kind: 'bridge', label: '공중다리 문', sub: `${F.label}층${other ? ` · 건너편 ${game.interiors.title(other)}` : ''}`, floor: F.i, gx: B.G.ox + i + 0.5 - e.dir[0], gz: B.G.oz + j + 0.5 - e.dir[1] });
    }
  }
  // ── 층 쓰임 ──
  for (const F of B.floors) {
    if (!F.reach || F.dead) continue;
    const U = FUSE[F.use];
    const zone = B.zones[F.zone], org = zone && zone.org ? B.orgs.find((o) => o.id === zone.org) : null;
    if ((U && s.length >= 2 && U.name.includes(s)) || (org && s.length >= 2 && org.name.includes(s)) || s === `${F.label}층`) {
      const pl = ind.plan(F.i);
      const hall = pl && (pl.L.lifthall != null ? pl.L.rooms[pl.L.lifthall] : pl.L.rooms.find((R) => R.main) || pl.L.rooms.find((R) => R.circ && R.n));
      if (hall) { const [gx, gz] = roomSpot(B, hall); add({ kind: 'floor', label: `${F.label}층 · ${U ? U.name : F.use}`, sub: org ? org.name : '', floor: F.i, gx, gz }); }
    }
  }
  // ── 방·시설·물건 (가까운 층부터) ──
  const roomTypes = want.room || null, tags = want.tag || null;
  const goodKeys = Object.keys(GOODS).filter((k) => s.length >= 2 && (GOODS[k].name.includes(s) || s.includes(GOODS[k].name)));
  let scanned = 0;
  for (const i of reach) {
    if (res.length >= (opt.limit || 8) * 2 && scanned >= 3) break;
    if (scanned > 40) break;
    const pl = ind.plan(i);
    scanned++;
    if (!pl || pl.L.closed) continue;
    const { L, fix } = pl;
    for (const R of L.rooms) {
      if (!R.n || R.sealed || R.circ) continue;
      const nm = R.name || (ROOMS[R.type] && ROOMS[R.type].name) || '';
      const hit = roomTypes ? roomTypes.includes(R.type) : s.length >= 2 && (nm.includes(s) || (ROOMS[R.type] && ROOMS[R.type].name.includes(s)));
      if (!hit) continue;
      const [gx, gz] = roomSpot(B, R);
      add({ kind: 'room', label: nm, sub: `${fl(i).label}층${ROOMS[R.type] && ROOMS[R.type].acc === 'staff' ? ' · 직원' : ''}`, floor: i, gx, gz, room: R.id });
    }
    for (const F of fix) {
      const f = FIX[F.t];
      if (!f) continue;
      const hit = tags ? tags.includes(F.tag) : s.length >= 2 && f.name && f.name.includes(s);
      if (hit) add({ kind: 'fix', label: f.name, sub: `${fl(i).label}층 · ${(L.rooms[F.room] || {}).name || ''}`, floor: i, gx: F.ax, gz: F.az, fix: F.id });
    }
    // 진열대의 물건 (운영 상태가 있는 층만: 진짜 재고)
    if (goodKeys.length && ops && ops.tenants) {
      const T = ops.byFloor(i);
      const sh = T && T.node && T.node.shelf;
      if (sh) for (const [key, st] of Object.entries(sh)) {
        if (!goodKeys.includes(st.g) || !key.startsWith(`${i}:`)) continue;
        const fid = key.split('/')[0], F = fix.find((x) => x.id === fid);
        if (F) add({ kind: 'good', label: `${GOODS[st.g].name} · ${won(GOODS[st.g].price)}`, sub: `${fl(i).label}층 진열대 · 남은 ${st.n}`, floor: i, gx: F.ax, gz: F.az, fix: F.id, n: st.n });
      }
    }
  }
  // 아직 펴 보지 않은 가게 층의 물건: 진열대 칸이 있는 가게 쓰임 층을 알려 준다
  if (goodKeys.length && !res.some((e) => e.kind === 'good')) {
    const cats = new Set(goodKeys.map((k) => GOODS[k].cat));
    for (const F of B.floors) if (F.reach && ['mart', 'shops', 'dept'].includes(F.use)) { const pl = ind.plan(F.i); const sh = pl && pl.fix.find((x) => x.tag === 'shelf' && (!x.cat || cats.has(x.cat))); if (sh) add({ kind: 'fix', label: `${[...goodKeys].map((k) => GOODS[k].name).join('·')} 진열대 쪽`, sub: `${F.label}층 · ${FUSE[F.use].name}`, floor: F.i, gx: sh.ax, gz: sh.az, fix: sh.id }); }
  }
  // ── 사람 ──
  if (ops && ops.agents && s.length >= 2) for (const a of ops.agents.list) if (a.title && (a.title.includes(s) || s.includes(a.title))) add({ kind: 'person', label: `${a.name} · ${a.title}`, sub: `${fl(a.floor).label}층`, floor: a.floor, gx: a.gx, gz: a.gz, agent: a.key });
  // 같은 것 겹치지 않게, 가까운 순
  const seen = new Set();
  return res.sort((a, b) => a.d - b.d).filter((e) => { const k = `${e.kind}|${e.label}|${e.floor}|${Math.round(e.gx)}|${Math.round(e.gz)}`; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, opt.limit || 8);
}

/** 층 하나의 표시점 (지도용): 방 이름·이음·시설 묶음 */
export function floorMarkers(game, i) {
  const cur = game.interiors.cur, ind = cur.indoor, B = cur.B;
  const pl = ind.plan(i);
  if (!pl) return [];
  const { L, fix } = pl;
  const M = [];
  if (B.core) for (const lk of B.links) {
    if (!lk.floors.includes(i) || lk.kind === 'open' || lk.kind === 'roof') continue;
    const part = B.core.parts[lk.part];
    if (!part) continue;
    const [gx, gz] = partSpot(B, part, 0);
    M.push({ k: lk.kind === 'cargo' ? 'cargo' : lk.kind === 'lift' ? 'lift' : 'stair', gx, gz, label: LINKNAME[lk.kind] });
  }
  for (const lk of B.links) if (lk.kind === 'open' && lk.floors.includes(i)) { const lo = ind.plan(lk.floors[0]); const sp = lo && mezzSpot(B, lo.L, i !== lk.floors[0]); if (sp) M.push({ k: 'stair', gx: sp[0], gz: sp[1], label: '중2층 계단' }); }
  const ex = exitSpot(B, L);
  if (ex && i === B.ground) M.push({ k: 'exit', gx: ex[0], gz: ex[1], label: '정문' });
  if (L.ents.dock) { const d = exitSpot(B, L, 'dock'); if (d) M.push({ k: 'dock', gx: d[0], gz: d[1], label: '하역 문' }); }
  if (L.ents.terrace) { const e = L.ents.terrace, a = e.c % B.G.gw, b = (e.c / B.G.gw) | 0; M.push({ k: 'terrace', gx: B.G.ox + a + 0.5, gz: B.G.oz + b + 0.5, label: '테라스' }); }
  for (const e of L.ents.bridge || []) { const a = e.c % B.G.gw, b = (e.c / B.G.gw) | 0; M.push({ k: 'bridge', gx: B.G.ox + a + 0.5, gz: B.G.oz + b + 0.5, label: '공중다리' }); }
  const KEY = { checkout: 'pay', clock: 'work', terminal: 'term', directory: 'info', reception: 'info', interview: 'hire', order: 'food', machine: 'mach', exhibit: 'art', pharmacy: 'med', tickets: 'ticket', stock: 'stock', console: 'mach', core: 'mach', sleep: 'bed', crop: 'crop', analysis: 'term', instrument: 'mach', doctor: 'med', catalog: 'term', vending: 'food', civic: 'info' };
  const seen = new Map();
  for (const F of fix) {
    const k = KEY[F.tag];
    if (!k) continue;
    // 같은 방의 같은 종류는 하나만 (지도에 너무 많지 않게)
    const key = `${k}|${F.room}`;
    if (seen.has(key) && !['pay', 'work', 'hire'].includes(k)) continue;
    seen.set(key, 1);
    M.push({ k, gx: F.x, gz: F.z, label: FIX[F.t] ? FIX[F.t].name : F.t, fix: F.id, room: F.room });
  }
  return M;
}
export { ITEMS };
