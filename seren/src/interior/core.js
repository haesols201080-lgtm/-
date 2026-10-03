// 수직 심(코어): 계단·승강기·화물 승강기·설비 관을 한 덩어리로 모아, 그것이 지나는 모든 층에서 같은 자리에 둔다 (v0.9).
//  · 심의 크기는 건물 크기로: 작은 집은 나선 계단(+작은 승강기), 보통 건물은 계단 + 승강기, 큰 건물은 계단 둘 + 승강기 여럿 + 화물 승강기.
//  · 자리는 심이 지나는 모든 층의 바닥 덮개 교집합 안에서 고른다(위로 좁아지거나 꺾인 건물도 심은 곧게 선다).
//    둘레 복도가 있는 층(사무·주거·호텔)은 가운데 쪽, 넓은 홀 층(마트·공장·창고)은 뒤쪽을 좋아한다.
//  · 아주 높은 탑은 승강기를 낮은층용·높은층용으로 나눈다(높은층용은 로비에서 바로 올라가는 급행).
//  · 심 앞(정면) 칸은 승강기 홀 — 복도와 이어진다. 계단 문·승강기 문은 모두 그쪽을 본다.
import { FUSE } from './catalog.js';

// 부품: w×d 칸, 정면(+d 쪽)에 문. d 가 6 보다 작으면 뒤쪽에 붙고 앞은 승강기 홀
const COMP = {
  stair: { w: 3, d: 6, kind: 'stair' },
  spiral: { w: 3, d: 3, kind: 'spiral' },
  spiral2: { w: 2, d: 2, kind: 'spiral' }, // 좁은 줄기 속 나선 계단 (버섯 집 같은)
  lift: { w: 3, d: 3, kind: 'lift' },
  liftS: { w: 2, d: 2, kind: 'lift' },
  cargo: { w: 4, d: 4, kind: 'cargo' },
  riser: { w: 1, d: 2, kind: 'shaft' },
};

/** 건물 크기 → 심 짜임 후보 (큰 것부터; 안 들어가면 작은 것으로) */
function coreOptions(B, nUp) {
  const gfa = B.gfa, opts = [];
  // 한 집(단독 주택): 나선 계단 (+ 세 층 넘으면 작은 승강기)
  if (B.floors.every((F) => F.use === 'house' || F.use === 'stem')) return nUp >= 3 ? [['spiral', 'liftS'], ['spiral'], ['spiral2']] : [['spiral'], ['spiral2']];
  const service = ['market', 'factory', 'depot', 'heal', 'hotel', 'plant', 'terminal', 'museum', 'lab'].includes(B.pid) || gfa > 6000;
  const nl = Math.max(1, Math.min(6, Math.round(gfa / 5200) + 1));
  if (nUp >= 6 || gfa > 2500) {
    const L = Array(nl).fill('lift');
    opts.push(['stair', ...L, ...(service ? ['cargo'] : []), 'riser', 'stair']);
    if (nl > 2) opts.push(['stair', ...L.slice(0, 2), ...(service ? ['cargo'] : []), 'riser', 'stair']);
    opts.push(['stair', 'lift', 'lift', 'riser']);
  }
  if (nUp >= 2 || B.floors.length >= 2) {
    opts.push(['stair', 'lift', ...(service ? ['cargo'] : []), 'riser']);
    opts.push(['stair', 'lift']);
    opts.push(['spiral', 'liftS']);
  }
  opts.push(['spiral']);
  opts.push(['spiral2']);
  return opts;
}

/** 부품 목록 → 정방향(정면 +j) 칸 목록. 반환 { w, d, parts:[{type, i0, j0, w, d}], lobby:[[i,j]] } */
function layoutComps(list) {
  const D = Math.max(...list.map((t) => COMP[t].d));
  const mini = list.every((t) => t === 'spiral' || t === 'spiral2' || t === 'liftS');
  const lobbyD = mini || list.some((t) => COMP[t].d < D) ? 0 : 2; // 곧은 계단만 있으면 앞에 2칸 홀
  const parts = [];
  let x = 0;
  for (const t of list) { const c = COMP[t]; parts.push({ type: t, kind: c.kind, i0: x, j0: 0, w: c.w, d: c.d }); x += c.w; }
  const W = x, Dt = D + lobbyD;
  const lobby = [];
  const occ = new Set();
  for (const p of parts) for (let i = p.i0; i < p.i0 + p.w; i++) for (let j = p.j0; j < p.j0 + p.d; j++) occ.add(i * 100 + j);
  for (let i = 0; i < W; i++) for (let j = 0; j < Dt; j++) if (!occ.has(i * 100 + j)) lobby.push([i, j]);
  return { w: W, d: Dt, parts, lobby, mini };
}

/** 정방향 칸 (i, j) 를 방향 o(0: 정면 +z, 1: 정면 +x, 2: −z, 3: −x)로 돌려 격자 칸으로 */
function rot(o, w, d, i, j) {
  switch (o) {
    case 0: return [i, j];
    case 1: return [j, w - 1 - i];
    case 2: return [w - 1 - i, d - 1 - j];
    default: return [d - 1 - j, i];
  }
}
const DIRS = [[0, 1], [1, 0], [0, -1], [-1, 0]]; // 정면 방향 (격자 i, j)

/**
 * 심 놓기. B: 건물 짜임(층 덮개가 있다). 반환: B.core / B.links 를 채운다.
 */
export function planCore(B) {
  const { gw, gh } = B.G;
  // 한 층뿐인 건물(지하·옥상 없음)은 심이 없다
  if (B.floors.length === 1 && !B.roof) { B.core = null; B.links = []; B.floors[0].reach = true; return null; }
  const N = gw * gh;
  const fl = B.floors.filter((F) => !F.mezz);
  const nUp = fl.filter((F) => !F.below).length;
  const openPref = ['mart', 'food', 'factory', 'depot', 'terminal', 'plant', 'museum', 'library', 'hall', 'farm', 'garden'].includes(FUSE[B.floors[B.ground].use]?.op) || ['market', 'factory', 'depot', 'terminal', 'plant', 'farm'].includes(B.pid);
  // 모든 층의 교집합 (작은 층부터 빼 보며)
  let serve = fl.slice();
  for (let attempt = 0; attempt < fl.length; attempt++) {
    const I = new Uint8Array(N).fill(1);
    for (const F of serve) for (let c = 0; c < N; c++) if (!F.mask[c]) I[c] = 0;
    // 합 표(직사각형이 다 들어가는지 O(1))
    const S = new Int32Array((gw + 1) * (gh + 1));
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) S[(j + 1) * (gw + 1) + i + 1] = I[j * gw + i] + S[j * (gw + 1) + i + 1] + S[(j + 1) * (gw + 1) + i] - S[j * (gw + 1) + i];
    const full = (i0, j0, w, d) => i0 >= 0 && j0 >= 0 && i0 + w <= gw && j0 + d <= gh && S[(j0 + d) * (gw + 1) + i0 + w] - S[j0 * (gw + 1) + i0 + w] - S[(j0 + d) * (gw + 1) + i0] + S[j0 * (gw + 1) + i0] === w * d;
    // 덮개 무게중심 (가장 작은 층)
    let small = serve[0];
    for (const F of serve) if (F.n < small.n) small = F;
    let cx = 0, cz = 0, cn = 0;
    for (let c = 0; c < N; c++) if (small.mask[c]) { cx += c % gw; cz += (c / gw) | 0; cn++; }
    cx /= cn || 1; cz /= cn || 1;
    // 정문 칸 (1층 덮개에서 정면 +j 끝 가운데)
    const G0 = B.floors[B.ground];
    let doorJ = 0;
    for (let j = gh - 1; j >= 0; j--) if (G0.mask[j * gw + Math.floor(gw / 2)]) { doorJ = j; break; }
    for (const list of coreOptions(B, nUp)) {
      const L = layoutComps(list);
      let best = null, bs = Infinity;
      for (let o = 0; o < 4; o++) {
        const W = o % 2 ? L.d : L.w, Dd = o % 2 ? L.w : L.d;
        const [fx, fz] = DIRS[o];
        for (let j0 = 0; j0 + Dd <= gh; j0++) for (let i0 = 0; i0 + W <= gw; i0++) {
          if (!full(i0, j0, W, Dd)) continue;
          // 정면 앞 두 칸이 비어야 (홀에서 들어갈 수 있게)
          const fc = L.mini ? 1 : 2; // 정면 앞 빈 칸 (작은 나선 계단은 한 칸)
          const fi0 = fx > 0 ? i0 + W : fx < 0 ? i0 - fc : i0, fj0 = fz > 0 ? j0 + Dd : fz < 0 ? j0 - fc : j0;
          const fw = fx ? fc : W, fd = fz ? fc : Dd;
          if (!full(fi0, fj0, fw, fd)) continue;
          const mx = i0 + W / 2, mz = j0 + Dd / 2;
          let s;
          if (openPref) s = mz * 2.2 + Math.abs(mx - gw / 2) * 0.8 + (o === 0 ? 0 : 6); // 뒤쪽(−z), 정면은 문 쪽을 보게
          else {
            s = Math.hypot(mx - cx - 0.5, mz - cz - 0.5) * 2 + (o === 0 ? 0 : o === 2 ? 1.5 : 0.8);
            // 둘레 복도 자리: 사방으로 2칸이 더 남으면 좋다
            if (!full(i0 - 2, j0 - 2, W + 4, Dd + 4)) s += 25;
          }
          // 정문 앞 6 m 는 비운다
          if (j0 + Dd > doorJ - 6 && Math.abs(mx - gw / 2) < W / 2 + 3) s += 60;
          if (s < bs) { bs = s; best = { o, i0, j0, W, Dd }; }
        }
      }
      if (!best) continue;
      return finish(B, L, best, list, serve);
    }
    // 아무것도 안 들어가면 맨 위층부터 하나씩 빼 본다 (그 층은 쓸 수 없는 층)
    const top = serve.filter((F) => !F.below);
    if (top.length <= 1) break;
    const drop = top[top.length - 1];
    serve = serve.filter((F) => F !== drop);
  }
  B.core = null; B.links = [];
  for (const F of B.floors) F.reach = F.i === B.ground; // 심이 없으면 1층만
  return null;
}

function finish(B, L, best, list, serve) {
  const { o, i0, j0 } = best;
  const toG = (i, j) => { const [a, b] = rot(o, L.w, L.d, i, j); return [i0 + a, j0 + b]; };
  const front = DIRS[o];
  const parts = L.parts.map((p, k) => {
    const cells = [];
    for (let i = p.i0; i < p.i0 + p.w; i++) for (let j = p.j0; j < p.j0 + p.d; j++) cells.push(toG(i, j));
    // 문: 부품 정면 가운데 칸, 정면 방향
    const di = p.i0 + Math.floor(p.w / 2), dj = p.j0 + p.d - 1;
    return { id: `${p.kind}${k}`, type: p.type, kind: p.kind, cells, door: { c: toG(di, dj), dir: front }, w: p.w, d: p.d };
  });
  const lobby = L.lobby.map(([i, j]) => toG(i, j));
  const serveIdx = serve.map((F) => F.i);
  const above = serve.filter((F) => !F.below);
  // 승강기 무리: 아주 높으면 낮은층용·높은층용 (높은층용은 로비 + 위쪽 절반)
  const lifts = parts.filter((p) => p.kind === 'lift');
  const split = above.length > 28 && lifts.length >= 4;
  const mid = above[Math.floor(above.length / 2)];
  const links = [];
  for (const p of parts) {
    if (p.kind === 'shaft') continue;
    let floors = serveIdx.slice();
    let bank = null;
    if (p.kind === 'lift' && split) {
      const k = lifts.indexOf(p);
      bank = k < lifts.length / 2 ? 'low' : 'high';
      floors = serveIdx.filter((i) => B.floors[i].below || i === B.ground || (bank === 'low' ? i <= mid.i : i >= mid.i));
    }
    links.push({ id: p.id, kind: p.kind, type: p.type, floors, bank, part: parts.indexOf(p) });
  }
  // 중2층: 홀 바닥에서 뚫린 곧은 계단 (layout 이 자리를 잡는다)
  for (const F of B.floors) if (F.mezz) links.push({ id: `open${F.i}`, kind: 'open', floors: [F.i - 1, F.i], mezz: F.i });
  // 옥상 문: 첫 계단이 맨 위층에서 지붕으로
  const stairs = parts.filter((p) => p.kind === 'stair' || p.kind === 'spiral');
  if (B.roof && stairs.length) links.push({ id: 'roof', kind: 'roof', floors: [above[above.length - 1].i], part: parts.indexOf(stairs[0]) });
  B.core = { o, i0, j0, w: best.W, d: best.Dd, front, parts, lobby, types: list };
  B.links = links;
  // 중2층: 심의 관·홀이 차지한 칸을 빼고, 남는 자리가 작으면 중2층을 두지 않는다
  for (const F of B.floors.slice()) {
    if (!F.mezz) continue;
    const { gw } = B.G;
    for (const p of parts) for (const [i, j] of p.cells) for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const c = (j + dj) * gw + i + di; if (c >= 0 && c < F.mask.length && F.mask[c]) { F.mask[c] = 0; F.n--; } }
    for (const [i, j] of lobby) { const c = j * gw + i; if (F.mask[c]) { F.mask[c] = 0; F.n--; } }
    if (F.n < 24) { F.dead = true; B.links = B.links.filter((k) => k.mezz !== F.i); }
  }
  // 심이 닿지 않는 층(맨 위의 작은 층 등)은 쓰지 않는다
  for (const F of B.floors) F.reach = !F.dead && (F.mezz || serveIdx.includes(F.i));
  return B.core;
}
