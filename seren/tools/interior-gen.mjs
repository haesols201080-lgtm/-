// 실내 생성기 시험 (브라우저 없이): 들어갈 수 있는 모든 모양 × 쓰임 × 크기로 건물 짜임·층 평면을 만들고 검사한다.
//   node tools/interior-gen.mjs            요약 + 검사
//   node tools/interior-gen.mjs show slab office 30 22 120   한 건물의 층 평면을 글자로
import { cityArchetypes, SPEC } from '../src/world/city-arch.js';
import { makeBuilding } from '../src/interior/program.js';
import { layoutFloor } from '../src/interior/layout.js';
import { facadeProfile } from '../src/interior/volume.js';
import { furnishFloor } from '../src/interior/recipes.js';
import { FIX } from '../src/interior/catalog.js';

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
  const t0 = performance.now();
  const B = makeBuilding(r, ctxFor());
  const t1 = performance.now();
  console.log(`${kind}/${use} ${hw}x${hd}x${h} → ${B.floors.length}층 (지상 ${B.floors.length - B.ground}) size=${B.size} gfa=${B.gfa} core=${B.core ? B.core.types.join('+') : '없음'} roof=${!!B.roof} atrium=${!!B.atrium} ${(t1 - t0).toFixed(0)}ms`);
  console.log('zones:', B.zones.map((Z) => `${Z.use}[${Z.from}-${Z.to}]${Z.org ? ' ' + Z.org.split(':')[1] : ''}`).join(' | '));
  const want = process.argv[8] ? process.argv[8].split(',').map(Number) : B.floors.map((F) => F.i);
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
  const SIZES = [[9, 9, 9], [14, 12, 22], [20, 16, 60], [28, 22, 140], [40, 16, 16]];
  let n = 0, fail = 0, floors = 0, rooms = 0, ms = 0;
  const problems = [];
  for (const kind of KINDS) for (const use of USES) for (const [hw, hd, h] of SIZES) {
    const S = SPEC[kind];
    if (S.low && h > 40) continue;
    const r = fakeRec(kind, use, hw, hd, h, { x: 1000 + n * 37, z: -2000 + n * 11 });
    n++;
    try {
      const t0 = performance.now();
      const B = makeBuilding(r, ctxFor());
      if (!B) { problems.push(`${kind}/${use}/${hw}: 짜임 없음`); fail++; continue; }
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
      }
      // 같은 건물은 늘 같은 짜임
      const B2 = makeBuilding(fakeRec(kind, use, hw, hd, h, { x: 1000 + (n - 1) * 37, z: -2000 + (n - 1) * 11 }), ctxFor());
      const sig = (b) => JSON.stringify(b.floors.map((F) => [F.use, F.n, F.y.toFixed(2)]).concat([b.core ? b.core.types : null, b.zones.map((Z) => Z.org)]));
      if (sig(B) !== sig(B2)) problems.push(`${kind}/${use}: 다시 만들면 달라짐`);
      ms += performance.now() - t0;
    } catch (e) { fail++; problems.push(`${kind}/${use}/${hw}x${h}: 오류 ${e.message}\n${e.stack.split('\n').slice(1, 3).join('\n')}`); }
  }
  console.log(`건물 ${n} · 실패 ${fail} · 층 ${floors} · 방 ${rooms} · 평균 ${(ms / n).toFixed(1)} ms`);
  const uniq = [...new Set(problems)];
  console.log(`문제 ${uniq.length}`);
  console.log(uniq.slice(0, 60).join('\n'));
}
