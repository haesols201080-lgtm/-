// 실내 생성기 시험 (브라우저 없이): 들어갈 수 있는 모든 모양 × 쓰임 × 크기로 건물 짜임·층 평면을 만들고 검사한다.
//   node tools/interior-gen.mjs            요약 + 검사
//   node tools/interior-gen.mjs show slab office 30 22 120   한 건물의 층 평면을 글자로
import { cityArchetypes, SPEC } from '../src/world/city-arch.js';
import { makeBuilding } from '../src/interior/program.js';
import { layoutFloor } from '../src/interior/layout.js';
import { facadeProfile, sdfAt, cellX, cellZ } from '../src/interior/volume.js';
import { packB, unpackB, packL, unpackL } from '../src/interior/store.js';
import { furnishFloor, ESSENTIAL } from '../src/interior/recipes.js';
import { FIX } from '../src/interior/catalog.js';
import { navGrid } from '../src/interior/nav.js';

const A = cityArchetypes();
const profile = (k) => facadeProfile(k, A[k] && A[k].hi);
const byUse = { home: 'home', office: 'office', market: 'market', school: 'school', heal: 'heal', library: 'library', hall: 'hall', factory: 'factory', depot: 'depot', lab: 'lab', terminal: 'terminal', garden: 'garden', cafe: 'cafe', museum: 'museum', plant: 'plant', hotel: 'hotel', admin: 'admin', farm: 'farm' };
export function fakeRec(kind, use, hw, hd, h, o = {}) {
  const S = SPEC[kind];
  const a = o.a ?? 0.3, x = o.x ?? 1000, z = o.z ?? -2000, gy = 50;
  const rot = -a + Math.PI / 2;
  let sx = hw, sz = hd;
  if (S.round) sx = sz = Math.min(hw, hd);
  const base = gy - 1.2, sy = h + 1.2;
  const nx = Math.cos(a), nz = Math.sin(a);
  const ext = S.round ? sx * (S.plan[1]) : sz * S.plan[2];
  const r = { kind, idx: 0, x, z, a, base, gy, mx: gy, sx, sy, sz, rot, top: base + sy, zone: o.zone || 'cap-core', use, style: o.style || 'capital', seed: 0.37, door: { x: x + nx * (ext + 0.25), z: z + nz * (ext + 0.25), nx, nz, yaw: Math.atan2(nx, nz) }, floorY: gy + 0.15 };
  return r;
}
export const ctxFor = () => ({ profile, pid: (r) => byUse[r.use] || 'office' });

const ROOMCH = {};
const CH = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
function draw(B, L) {
  const { gw, gh } = B.G;
  const lines = [];
  let i0 = gw, i1 = 0, j0 = gh, j1 = 0;
  for (let c = 0; c < gw * gh; c++) if (L.room[c] || B.floors[L.i].mask[c]) { const i = c % gw, j = (c / gw) | 0; i0 = Math.min(i0, i); i1 = Math.max(i1, i); j0 = Math.min(j0, j); j1 = Math.max(j1, j); }
  for (let j = j1; j >= j0; j--) {
    let s = '';
    for (let i = i0; i <= i1; i++) {
      const c = j * gw + i;
      const r = L.room[c];
      if (L.void[c]) { s += '~'; continue; }
      if (!r) { s += B.floors[L.i].terrace && B.floors[L.i].terrace.mask[c] ? '.' : ' '; continue; }
      const R = L.rooms[r - 1];
      const t = R.type;
      s += t === 'corridor' || t === 'lifthall' ? '#' : t === 'stair' ? 'S' : t === 'lift' ? 'L' : t === 'cargo' ? 'C' : t === 'shaft' ? '|' : CH[R.id % CH.length];
    }
    lines.push(s);
  }
  return lines.join('\n');
}

/** 0.5 m 칸으로: 가구 = 글자, 비워 둘 곳 = ·, 빈 바닥 = 공백, 막힘 = █ */
function drawFix(B, L, FU) {
  const occ = FU.occ;
  const map = new Map();
  const SYM = { gondola: 'G', wallshelf: 'W', chiller: 'C', produce: 'P', checkout: '$', selfcheck: 's', baskets: 'b', stockrack: 'R', pallet: 'p', handcart: 'h', desk: 'd', meettable: 'M', board: '=', cabinet: 'c', printer: 'r', plant: '*', sofa: 'S', lowtable: 't', armchair: 'a', reception: 'Q', infokiosk: 'i', terminal: 'T', water: 'w', bench: 'B', lockers: 'L', timeclock: 'k', table4: 'O', table2: 'o', counter: 'Q', stove: 'F', prep: 'f', coldbox: 'C', dishwash: 'D', machine: 'M', kiln: 'K', assembler: 'A', packer: 'P', bigrack: 'R', bins: 'b', qcbench: 'q', console: 'c', toolrack: 't', forklift: 'F', bedpod: 'Z', bedpod1: 'z', wardrobe: 'w', kcounter: 'k', dtable: 'O', washpod: 'U', wc1: 'u', sink: 'n', sdesk: 'd', tdesk: 'D', bookshelf: 'H', readtable: 'O', seatrow: 'r', stageplat: '#', growrack: 'g', growbed: 'g', hovercar: 'V' };
  for (const q of FU.list) {
    const f = FIX[q.t];
    const odd = q.rot % 2 === 1, W = odd ? f.d : f.w, D = odd ? f.w : f.d;
    for (let z = q.z - D / 2 + 0.25; z < q.z + D / 2; z += 0.5) for (let x = q.x - W / 2 + 0.25; x < q.x + W / 2; x += 0.5) { const [a, b] = occ.sub(x, z); map.set(b * occ.gw + a, SYM[q.t] || '?'); }
  }
  let a0 = 1e9, a1 = -1, b0 = 1e9, b1 = -1;
  for (let k = 0; k < occ.o.length; k++) if (occ.rm[k]) { const a = k % occ.gw, b = (k / occ.gw) | 0; a0 = Math.min(a0, a); a1 = Math.max(a1, a); b0 = Math.min(b0, b); b1 = Math.max(b1, b); }
  const out = [];
  for (let b = b1; b >= b0; b--) {
    let s = '';
    for (let a = a0; a <= a1; a++) {
      const k = b * occ.gw + a;
      if (map.has(k)) { s += map.get(k); continue; }
      if (!occ.rm[k]) { s += ' '; continue; }
      // 방 경계는 얇은 선으로
      const r = occ.rm[k];
      const edge = (a > 0 && occ.rm[k - 1] && occ.rm[k - 1] !== r && (a % 2 === 0)) || (b > 0 && occ.rm[k - occ.gw] && occ.rm[k - occ.gw] !== r && (b % 2 === 0));
      s += occ.o[k] === 1 ? '█' : edge ? '+' : occ.o[k] === 3 ? '·' : ' ';
    }
    out.push(s);
  }
  return out.join('\n');
}

const cmd = process.argv[2];
if (cmd === 'show') {
  const [, , , kind, use, hw, hd, h] = process.argv;
  const r = fakeRec(kind, use, +hw, +hd, +h);
  // bridge=k : 일괄 검사의 k 번째 건물처럼 공중다리 하나 (높이·방향)
  const bk = process.argv.find((a) => a.startsWith('bridge='));
  if (bk) { const k = +bk.slice(7), th = k * 2.399; r.bridges = [{ bi: 0, y: r.base + r.sy * (0.4 + ((k * 0.37) % 0.35)), ux: Math.cos(th), uz: Math.sin(th) }]; }
  const t0 = performance.now();
  const B = makeBuilding(r, ctxFor());
  const t1 = performance.now();
  console.log(`${kind}/${use} ${hw}x${hd}x${h} → ${B.floors.length}층 (지상 ${B.floors.length - B.ground}) size=${B.size} gfa=${B.gfa} core=${B.core ? B.core.types.join('+') : '없음'} roof=${!!B.roof} atrium=${!!B.atrium} ${(t1 - t0).toFixed(0)}ms`);
  console.log('zones:', B.zones.map((Z) => `${Z.use}[${Z.from}-${Z.to}]${Z.org ? ' ' + Z.org.split(':')[1] : ''}`).join(' | '));
  const fa = process.argv.slice(8).find((a) => /^[\d,]+$/.test(a));
  const want = fa ? fa.split(',').map(Number) : B.floors.map((F) => F.i);
  for (const F of B.floors) {
    if (!want.includes(F.i)) continue;
    const L = layoutFloor(B, F, { door: B.door });
    const FU = furnishFloor(B, L);
    L.fix = FU.list;
    console.log(`\n── ${F.label}층 ${F.use} y=${(F.y - B.volume.floorY).toFixed(1)} h=${F.h.toFixed(1)} n=${F.n}${F.terrace ? ` 테라스 ${F.terrace.n}` : ''}${F.vault ? ' vault' : ''} rooms=${L.rooms.filter((R) => R.n).length} doors=${L.doors.length}`);
    console.log(L.rooms.filter((R) => R.n && !['corridor', 'lifthall', 'stair', 'lift', 'cargo', 'shaft'].includes(R.type)).map((R) => `${CH[R.id % CH.length]}:${R.name}(${R.n})`).join(' '));
    console.log(draw(B, L));
    const cnt = {};
    for (const q of FU.list) cnt[q.t] = (cnt[q.t] || 0) + 1;
    console.log('가구:', Object.entries(cnt).map(([t, n]) => `${FIX[t].name}×${n}`).join(' '), JSON.stringify(FU.stats));
    console.log(drawFix(B, L, FU));
  }
  process.exit(0);
}

// ── 일괄 검사 ──
if (!cmd || cmd === 'all') {
  const KINDS = Object.entries(SPEC).filter(([, S]) => S.enter && !S.fixed).map(([k]) => k);
  const USES = ['home', 'office', 'market', 'cafe', 'school', 'heal', 'library', 'museum', 'hall', 'factory', 'depot', 'lab', 'terminal', 'garden', 'plant', 'hotel', 'admin', 'farm'];
  const SIZES = [[9, 9, 9], [14, 12, 22], [20, 16, 60], [28, 22, 140], [40, 16, 16], [8, 8, 130]]; // 마지막: 가늘고 높은 첨탑 (심이 층을 거의 다 차지)
  let n = 0, fail = 0, floors = 0, rooms = 0, ms = 0, mz = 0;
  const LK = { stair: '계단', spiral: '나선 계단', lift: '승강기', cargo: '화물 승강기' };
  const stats = { cells: 0, outside: 0, links: 0, order: 0, special: 0, doorD: 0, noTerrace: 0, persist: 0, bridges: 0, bridgeNoLift: 0, walkRooms: 0, walkLost: 0, essRooms: 0, essN: 0, essMiss: {}, byPid: {} };
  const problems = [];
  for (const kind of KINDS) for (const use of USES) for (const [hw, hd, h] of SIZES) {
    const S = SPEC[kind];
    if (S.low && h > 40) continue;
    const r = fakeRec(kind, use, hw, hd, h, { x: 1000 + n * 37, z: -2000 + n * 11 });
    // 높은 탑에는 공중다리 하나 (바깥 cityfabric._bridges 처럼: 높이의 40~75% · 아무 방향)
    const addBridge = (rr, k) => { if (h >= 100) { const th = k * 2.399; rr.bridges = [{ bi: 0, y: rr.base + rr.sy * (0.4 + ((k * 0.37) % 0.35)), ux: Math.cos(th), uz: Math.sin(th) }]; } };
    addBridge(r, n);
    n++;
    try {
      const t0 = performance.now();
      const B = makeBuilding(r, ctxFor());
      if (!B) { problems.push(`${kind}/${use}/${hw}: 짜임 없음`); fail++; continue; }
      // ── 바깥과 안이 맞는가 ──
      const tag = `${kind}/${use}/${hw}x${h}`;
      const Vv = B.V, G = B.G;
      let outside = 0, cellsN = 0;
      for (const F of B.floors) {
        if (F.below || !F.reach || F.dead) continue;
        const yA = F.y + 0.3, yB = Math.min(F.ceil, F.y + (F.vault ? 2.5 : 2.6)) - 0.3;
        for (let c = 0; c < F.mask.length; c++) if (F.mask[c]) {
          cellsN++;
          const x = cellX(G, c % G.gw), z = cellZ(G, (c / G.gw) | 0);
          if (sdfAt(Vv, x, z, yA) > 0.05 || sdfAt(Vv, x, z, yB) > 0.05) outside++;
        }
      }
      stats.cells += cellsN; stats.outside += outside;
      if (outside > cellsN * 0.002) problems.push(`${tag}: 바깥 부피 밖 칸 ${outside}/${cellsN}`);
      // 층 높이: 차례로 쌓이고 겹치지 않으며 지붕을 넘지 않는다
      const up = B.floors.filter((F) => !F.below && !F.mezz);
      for (let k = 1; k < up.length; k++) if (up[k].y < up[k - 1].y + up[k - 1].h - 0.4) problems.push(`${tag}: ${up[k].label}층이 아래층과 겹침`);
      for (const F of up) if (F.ceil > B.volume.top + 0.05) problems.push(`${tag}: ${F.label}층 천장이 지붕 위`);
      // 승강기·계단: 이음이 서는 모든 층에서 그 칸이 층 안
      if (B.core) for (const lk of B.links) {
        if (lk.part == null || lk.kind === 'roof') continue;
        const part = B.core.parts[lk.part];
        for (const fi of lk.floors) { const F = B.floors[fi]; if (part.cells.some(([i, j]) => !F.mask[j * G.gw + i])) { problems.push(`${tag}: ${LK[lk.kind] || lk.kind} 칸이 ${F.label}층 밖`); break; } }
        stats.links++;
      }
      // 쓰임의 차례 (섞인 건물): 가게·상가는 사무·주거·호텔 아래, 주거·호텔이 사무 아래로 내려오지 않는다 (기단·전환층은 예외)
      if (!B.special) {
        const idx = (u) => up.map((F, k) => (u.includes(F.use) ? k : -1)).filter((k) => k >= 0);
        const shop = idx(['mart', 'shops', 'dept']), work = idx(['office', 'research']), live = idx(['residential', 'hotel']);
        if (shop.length && (work.length || live.length) && Math.max(...shop) > Math.min(...work.concat(live))) problems.push(`${tag}: 가게 층이 사무·주거 위`);
        stats.order++;
      } else stats.special++;
      // 건물 짜임 저장·불러오기
      {
        const B3 = unpackB(JSON.parse(JSON.stringify(packB(B))), r);
        const sg = (b) => JSON.stringify(b.floors.map((F) => [F.use, F.n, F.y.toFixed(2), F.reach, F.dead || false, Array.from(F.mask).join('')]).concat([b.links, b.zones.map((Z) => Z.org), b.special || null]));
        if (sg(B3) !== sg(B)) problems.push(`${tag}: 건물 짜임 저장·불러오기가 다름`);
      }
      const pidB = B.pid;
      stats.byPid[pidB] = stats.byPid[pidB] || { n: 0, sig: new Set() };
      for (const F of B.floors) {
        const L = layoutFloor(B, F, { door: B.door });
        floors++;
        if (L.closed) { if (!F.below && !F.dead) problems.push(`${kind}/${use}/${hw}x${h}: ${F.label}층 닿지 않음 (${F.use} n=${F.n})`); continue; }
        rooms += L.rooms.filter((R) => R.n).length;
        // 문 그래프로 모든 방이 이어지나
        const adj = new Map();
        for (const d of L.doors) { if (d.b < 0) continue; (adj.get(d.a) || adj.set(d.a, []).get(d.a)).push(d.b); (adj.get(d.b) || adj.set(d.b, []).get(d.b)).push(d.a); }
        const roots = L.rooms.filter((R) => R.n && (R.circ || R.main)).map((R) => R.id);
        const seen = new Set(roots), q = [...roots];
        while (q.length) { const a = q.pop(); for (const b of adj.get(a) || []) if (!seen.has(b)) { seen.add(b); q.push(b); } }
        const lost = L.rooms.filter((R) => R.n && !seen.has(R.id) && !['shaft', 'lift', 'cargo'].includes(R.type) && !(R.type === 'stair' && !R.stops));
        if (lost.length) problems.push(`${kind}/${use}/${hw}x${h}: ${F.label}층 갇힌 방 ${lost.map((R) => R.name + R.n).join(',')}`);
        if (!roots.length) problems.push(`${kind}/${use}/${hw}x${h}: ${F.label}층 복도·홀 없음`);
        if (F.i === B.ground && !L.ents.main) problems.push(`${kind}/${use}/${hw}x${h}: 정문 없음`);
        // 정문 = 바깥 문 자리 (3 m 안)
        // (바깥 문이 실내 부피보다 바깥에 붙은 모양이면 가장 가까운 실내 칸까지의 거리를 기준으로)
        if (F.i === B.ground && L.ents.main) {
          const e = L.ents.main.c; const d = Math.hypot(cellX(G, e % G.gw) - B.door.gx, cellZ(G, (e / G.gw) | 0) - B.door.gz);
          let dmin = 1e9; for (let c = 0; c < F.mask.length; c++) if (F.mask[c]) dmin = Math.min(dmin, Math.hypot(cellX(G, c % G.gw) - B.door.gx, cellZ(G, (c / G.gw) | 0) - B.door.gz));
          if (d > dmin + 2) problems.push(`${tag}: 정문이 바깥 문에서 ${d.toFixed(1)} m (가장 가까운 칸 ${dmin.toFixed(1)} m)`);
          stats.doorD = Math.max(stats.doorD, d - dmin);
        }
        // 공중다리: 다리 높이 = 이 층 바닥, 다리 쪽 바깥벽에 문, 문은 다리 줄 위에 (바깥벽에서 2.5 m 안), 승강기가 선다
        if (F.bridges) for (const bd of F.bridges) {
          stats.bridges++;
          const e = (L.ents.bridge || []).find((q) => q.bi === bd.bi);
          if (!e) { problems.push(`${tag}: ${F.label}층 공중다리 문 없음`); continue; }
          const ex = cellX(G, e.c % G.gw), ez = cellZ(G, (e.c / G.gw) | 0), [ux, uz] = bd.dir;
          const tc = ex * ux + ez * uz, pc = -ex * uz + ez * ux;
          let tf = tc; for (; tf < tc + 30; tf += 0.1) if (sdfAt(Vv, tf * ux, tf * uz, F.y + 1) > 0) break;
          stats.bridgeWall = Math.max(stats.bridgeWall || 0, tf - tc); // 둥근(달걀) 탑은 층 가운데 높이의 바깥벽이 더 불룩하다
          // 문은 다리 통로 폭(±3.2 m) 안, 다리 쪽을 보고, 바깥 칸에 맞닿는다 · 문에서 홀(승강기 앞)까지 이어진다
          const out = e.c % G.gw + e.dir[0], outJ = ((e.c / G.gw) | 0) + e.dir[1];
          const onEdge = out < 0 || outJ < 0 || out >= G.gw || outJ >= G.gh || !F.mask[outJ * G.gw + out];
          stats.bridgeSide = Math.max(stats.bridgeSide || 0, Math.abs(pc));
          if (Math.abs(pc) > 3.2) stats.bridgeOff = (stats.bridgeOff || 0) + 1; // 심이 다리 쪽 바깥벽을 막아 옆으로 비킨 문
          if (Math.abs(pc) > 12 || e.dir[0] * ux + e.dir[1] * uz < 0.3 || !onEdge) problems.push(`${tag}: ${F.label}층 공중다리 문이 다리에서 벗어남 (옆 ${pc.toFixed(1)} m)`);
          if (L.room[e.c] !== L.lifthall + 1) problems.push(`${tag}: ${F.label}층 공중다리 문이 승강기 홀과 떨어짐`);
          { // 홀 안에서 문 칸 → 승강기 앞 칸이 이어지나 (같은 방이라도 끊기지 않게)
            const hid = L.room[e.c], seen = new Set([e.c]), q = [e.c]; let ok = false;
            // 승강기 앞 = 심의 홀 칸 + 승강기·계단 문 바로 앞 칸 (홀 칸이 없는 작은 심 — 나선 계단 + 작은 승강기 — 도)
            const core = B.core ? new Set(B.core.lobby.map(([i, j]) => j * G.gw + i)) : null;
            if (core) for (const p of B.core.parts) if (p.kind !== 'shaft' && p.door) core.add((p.door.c[1] + p.door.dir[1]) * G.gw + p.door.c[0] + p.door.dir[0]);
            while (q.length) { const c = q.pop(); if (!core || core.has(c)) { ok = true; break; } for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const i = c % G.gw + di, j = ((c / G.gw) | 0) + dj; const k = j * G.gw + i; if (i >= 0 && j >= 0 && i < G.gw && j < G.gh && !seen.has(k) && L.room[k] === hid) { seen.add(k); q.push(k); } } }
            if (!ok) problems.push(`${tag}: ${F.label}층 공중다리 통로가 승강기 앞까지 끊김`);
          }
          if (Math.abs(F.y - r.bridges[0].y) > 0.05) problems.push(`${tag}: 공중다리 높이와 층 바닥이 다름`);
          if (!B.links.some((lk) => lk.kind === 'lift' && lk.floors.includes(F.i))) stats.bridgeNoLift++;
        }
        // 실제로 걸어서 닿나 (가구·벽까지 넣은 0.5 m 걸음 칸): 승강기 홀(없으면 정문 홀)에서 범람 → 모든 방에 닿아야
        {
          const fx = furnishFloor(B, L).list;
          // 방마다 꼭 있어야 하는 가구 (그 쓰임의 일이 일어나는 자리): 하나라도 없으면 센다
          for (const R of L.rooms) {
            const need = R.n ? ESSENTIAL[R.type] : null;
            if (!need) continue;
            stats.essRooms++;
            for (const [, tg, , , , cond] of need) {
              if (cond && !cond({ B, L })) continue;
              if (!fx.some((q) => q.room === R.id && q.tag === tg)) { const k = `${R.type}:${tg}`; stats.essMiss[k] = (stats.essMiss[k] || 0) + 1; stats.essN++; if (stats.essN <= 12) problems.push(`${tag}: ${F.label}층 ${R.name}(${R.n} m²)에 ${tg} 없음`); }
            }
          }
          const N = navGrid(B, L, fx);
          // 시작: 사람이 이 층에 들어서는 곳 (layout 5a 와 같은 규칙) — 승강기 홀 · 승강기·계단 문 바로 앞 칸 · 정문 (홀이 빈 작은 탑도)
          const startRoom = L.lifthall != null && L.rooms[L.lifthall].n ? L.lifthall : (L.rooms.find((R) => R.main && R.n) || L.rooms.find((R) => R.circ && R.n) || {}).id;
          const startC = new Set();
          if (B.core) for (const p of B.core.parts) if (p.kind !== 'shaft' && p.door && F.reach) { const i = p.door.c[0] + p.door.dir[0], j = p.door.c[1] + p.door.dir[1]; if (i >= 0 && j >= 0 && i < L.gw && j < L.gh) startC.add(j * L.gw + i); }
          if (L.ents.main) startC.add(L.ents.main.c);
          const seen = new Uint8Array(N.gw * N.gh), q = [];
          for (let k = 0; k < N.ok.length; k++) { const c = ((k / N.gw) >> 1) * L.gw + ((k % N.gw) >> 1); if (N.ok[k] && ((startRoom != null && L.room[c] === startRoom + 1) || startC.has(c))) { seen[k] = 1; q.push(k); } }
          const wall = (a, b, x, y) => { const ci0 = a >> 1, cj0 = b >> 1, ci1 = x >> 1, cj1 = y >> 1; if (ci0 !== ci1) { const e = Math.max(ci0, ci1); if (N.wallV[cj0 * (N.cgw + 1) + e] || N.wallV[cj1 * (N.cgw + 1) + e]) return true; } if (cj0 !== cj1) { const e = Math.max(cj0, cj1); if (N.wallH[e * N.cgw + ci0] || N.wallH[e * N.cgw + ci1]) return true; } return false; };
          for (let h = 0; h < q.length; h++) { const k = q[h], a = k % N.gw, b = (k / N.gw) | 0; for (const [da, db] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = a + da, y = b + db; if (x < 0 || y < 0 || x >= N.gw || y >= N.gh) continue; const e = y * N.gw + x; if (seen[e] || !N.ok[e] || wall(a, b, x, y)) continue; seen[e] = 1; q.push(e); } }
          const got = new Set();
          for (let k = 0; k < seen.length; k++) if (seen[k]) got.add(L.room[((k / N.gw) >> 1) * L.gw + ((k % N.gw) >> 1)]);
          const lostW = q.length ? L.rooms.filter((R) => R.n && !got.has(R.id + 1) && !['shaft', 'lift', 'cargo', 'stair'].includes(R.type) && !R.sealed) : [];
          stats.walkRooms += L.rooms.filter((R) => R.n).length; stats.walkLost += lostW.length;
          if (lostW.length) problems.push(`${tag}: ${F.label}층 걸어서 못 가는 방 ${lostW.slice(0, 4).map((R) => R.name).join(',')}${lostW.length > 4 ? ` 외 ${lostW.length - 4}` : ''}`);
        }
        // 테라스가 있는 층은 테라스 문
        if (F.terrace && F.terrace.n >= 12 && !L.ents.terrace && !F.mezz) stats.noTerrace++;
        // 승강기 칸은 그 층 평면에서도 승강기 방
        for (const R of L.rooms) if ((R.type === 'lift' || R.type === 'cargo') && R.n === 0) problems.push(`${tag}: ${F.label}층 승강기 방이 비었음`);
        if (F.i === B.ground) stats.byPid[pidB].sig.add(L.rooms.filter((R) => R.n).map((R) => R.type).sort().join(',') + '|' + L.rooms.length);
        // 저장·불러오기: 층 평면이 그대로 (글자로 바꿨다 되살려도 칸·방·문·가구가 같다)
        if (F.i === B.ground) {
          const fx = furnishFloor(B, L).list;
          const back = unpackL(JSON.parse(JSON.stringify(packL(L, fx))));
          const same = back.L.room.every((v, k) => v === L.room[k]) && back.L.void.every((v, k) => v === L.void[k]) && back.L.doors.length === L.doors.length && back.fix.length === fx.length && JSON.stringify(back.L.mstair || null) === JSON.stringify(L.mstair || null);
          if (!same) problems.push(`${tag}: 층 평면 저장·불러오기가 다름`);
          stats.persist++;
        }
        // 중2층이 있으면 홀에서 오르는 계단이 있어야 한다
        const up = B.floors[F.i + 1];
        if (up && up.mezz && !up.dead && !F.mezz) { if (!L.mstair) problems.push(`${kind}/${use}/${hw}x${h}: 중2층 계단 없음`); else mz++; }
      }
      // 같은 건물은 늘 같은 짜임
      const r2 = fakeRec(kind, use, hw, hd, h, { x: 1000 + (n - 1) * 37, z: -2000 + (n - 1) * 11 });
      addBridge(r2, n - 1);
      const B2 = makeBuilding(r2, ctxFor());
      if (r.bridges && !B.floors.some((F) => F.bridges)) problems.push(`${tag}: 공중다리 높이에 층이 없음`);
      const sig = (b) => JSON.stringify(b.floors.map((F) => [F.use, F.n, F.y.toFixed(2)]).concat([b.core ? b.core.types : null, b.zones.map((Z) => Z.org)]));
      if (sig(B) !== sig(B2)) problems.push(`${kind}/${use}: 다시 만들면 달라짐`);
      ms += performance.now() - t0;
    } catch (e) { fail++; problems.push(`${kind}/${use}/${hw}x${h}: 오류 ${e.message}\n${e.stack.split('\n').slice(1, 3).join('\n')}`); }
  }
  console.log(`건물 ${n} · 실패 ${fail} · 층 ${floors} · 방 ${rooms} · 평균 ${(ms / n).toFixed(1)} ms · 중2층 계단 ${mz}`);
  console.log(`바깥 부피 밖 칸 ${stats.outside}/${stats.cells} · 이음 검사 ${stats.links} · 쓰임 차례 검사 ${stats.order} (전문 건물 ${stats.special}) · 정문-바깥 문 (가장 가까운 칸 기준) 최대 ${stats.doorD.toFixed(1)} m · 테라스 문 없는 큰 테라스 ${stats.noTerrace} · 저장 왕복 ${stats.persist} · 공중다리 문 ${stats.bridges} (승강기 안 서는 층 ${stats.bridgeNoLift}, 문 → 바깥 외벽 최대 ${(stats.bridgeWall || 0).toFixed(1)} m, 다리 폭 밖으로 비킨 문 ${stats.bridgeOff || 0} · 최대 ${(stats.bridgeSide || 0).toFixed(1)} m)`);
  console.log(`걸어서 닿는가 (가구·벽 포함 0.5 m 칸): 방 ${stats.walkRooms} 중 못 가는 방 ${stats.walkLost}`);
  console.log(`핵심 가구 (방마다 그 쓰임의 일이 일어나는 자리): 방 ${stats.essRooms} 중 빠진 것 ${stats.essN}${stats.essN ? ` — ${Object.entries(stats.essMiss).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${k} ${v}`).join(', ')}` : ''}`);
  console.log('1층 짜임의 가짓수 (같은 쓰임 안에서):', Object.entries(stats.byPid).map(([k, v]) => `${k} ${v.sig.size}`).join(' · '));
  const uniq = [...new Set(problems)];
  console.log(`문제 ${uniq.length}`);
  console.log(uniq.slice(0, 60).join("\n"));
  const cat = {}; for (const p of uniq) { const k = p.split(": ")[1].replace(/[0-9.]+/g, "#"); cat[k] = (cat[k] || 0) + 1; }
  console.log("종류:", JSON.stringify(cat));
}
