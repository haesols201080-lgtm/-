// 실내 길찾기 (v0.9): 층마다 0.5 m 칸의 걸을 수 있는 땅(벽·가구·심을 뺀) + 칸 사이 벽 + 층 사이 이음(계단·승강기).
//  · 사람(agents)·플레이어 안내선·지도 길·모아의 「가는 길」이 모두 이것을 쓴다 — 지도와 실제 공간이 같은 자료에서 나온다.
//  · 층을 건너는 길: 이 층 → (계단·승강기 문 앞) → 그 층의 같은 이음 문 앞 → 목적지. 이음은 건물 짜임(B.links)에 있다.
import { FIX, flowRoom } from './catalog.js';

const S = 2;
const D8 = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];

/** 층 하나의 걸음 칸. L: 평면, fix: 가구, B: 짜임 */
export function navGrid(B, L, fix) {
  const gw = L.gw * S, gh = L.gh * S, n = gw * gh;
  const ok = new Uint8Array(n);
  const ox = B.G.ox, oz = B.G.oz;
  const rooms = L.rooms;
  for (let c = 0; c < L.room.length; c++) {
    const r = L.room[c];
    if (!r || L.void[c] === 1 || L.void[c] === 3) continue;
    const R = rooms[r - 1];
    if (['lift', 'cargo', 'shaft'].includes(R.type) || R.sealed) continue;
    const i = c % L.gw, j = (c / L.gw) | 0;
    for (let b = 0; b < S; b++) for (let a = 0; a < S; a++) ok[(j * S + b) * gw + i * S + a] = 1;
  }
  // 가구: 가구 놓기(furnish)와 같은 자리 (0.5 m 칸에 걸치면 막힘)
  for (const q of fix) {
    const f = FIX[q.t];
    if (!f || f.walk) continue;
    const odd = q.rot % 2 === 1, W = odd ? q.d : q.w, D = odd ? q.w : q.d;
    const a0 = Math.floor((q.x - W / 2 + 0.01 - ox) * S), a1 = Math.floor((q.x + W / 2 - 0.01 - ox) * S), b0 = Math.floor((q.z - D / 2 + 0.01 - oz) * S), b1 = Math.floor((q.z + D / 2 - 0.01 - oz) * S);
    for (let b = Math.max(0, b0); b <= Math.min(gh - 1, b1); b++) for (let a = Math.max(0, a0); a <= Math.min(gw - 1, a1); a++) ok[b * gw + a] = 0;
  }
  // 벽: 1 m 칸 사이의 벽 모서리 (문·열린 곳은 통한다)
  const open = new Set();
  for (const d of L.doors) {
    const i = d.c % L.gw, j = (d.c / L.gw) | 0, [di, dj] = d.dir;
    const w = Math.max(1, d.w), o0 = -Math.floor((w - 1) / 2), o1 = Math.ceil((w - 1) / 2);
    for (let o = o0; o <= o1; o++) { const ci = i + (dj ? o : 0), cj = j + (di ? o : 0); open.add(di ? `v${di > 0 ? ci + 1 : ci},${cj}` : `h${ci},${dj > 0 ? cj + 1 : cj}`); }
  }
  const wallV = new Uint8Array((L.gw + 1) * L.gh), wallH = new Uint8Array(L.gw * (L.gh + 1));
  const flow = rooms.map(flowRoom);
  const walled = (r, s) => r && s && r !== s && !(flow[r - 1] && flow[s - 1]); // 복도·홀끼리는 벽이 없다 (render.partitions 와 같은 규칙)
  for (let j = 0; j < L.gh; j++) for (let i = 0; i < L.gw; i++) {
    const c = j * L.gw + i, r = L.room[c];
    if (i + 1 < L.gw) { const e = c + 1, s = L.room[e]; if (walled(r, s) && !open.has(`v${i + 1},${j}`)) wallV[j * (L.gw + 1) + i + 1] = 1; }
    if (j + 1 < L.gh) { const e = c + L.gw, s = L.room[e]; if (walled(r, s) && !open.has(`h${i},${j + 1}`)) wallH[(j + 1) * L.gw + i] = 1; }
  }
  // 사람(반지름 0.35 m)이 설 수 있는 곳: 비어 있는 1 m 창(0.5 m 칸 2×2, 벽을 넘지 않는)에 드는 칸만 — 가구 놓기의 길 검사와 같은 규칙
  const free = ok.slice();
  ok.fill(0);
  const cw = L.gw;
  for (let b = 0; b + 1 < gh; b++) for (let a = 0; a + 1 < gw; a++) {
    const k = b * gw + a;
    if (!free[k] || !free[k + 1] || !free[k + gw] || !free[k + gw + 1]) continue;
    const ci0 = a >> 1, ci1 = (a + 1) >> 1, cj0 = b >> 1, cj1 = (b + 1) >> 1;
    if (ci0 !== ci1 && (wallV[cj0 * (cw + 1) + ci1] || wallV[cj1 * (cw + 1) + ci1])) continue;
    if (cj0 !== cj1 && (wallH[cj1 * cw + ci0] || wallH[cj1 * cw + ci1])) continue;
    ok[k] = ok[k + 1] = ok[k + gw] = ok[k + gw + 1] = 1;
  }
  return { gw, gh, ok, ox, oz, wallV, wallH, cgw: L.gw };
}

/** 두 0.5 m 칸 사이를 지날 수 있나 (벽 모서리를 넘지 않나) */
function pass(N, a, b, x, y) {
  if (!N.ok[y * N.gw + x]) return false;
  const ci0 = a >> 1, cj0 = b >> 1, ci1 = x >> 1, cj1 = y >> 1;
  if (ci0 !== ci1) { const e = Math.max(ci0, ci1); if (N.wallV[cj0 * (N.cgw + 1) + e] || N.wallV[cj1 * (N.cgw + 1) + e]) return false; }
  if (cj0 !== cj1) { const e = Math.max(cj0, cj1); if (N.wallH[e * N.cgw + ci0] || N.wallH[e * N.cgw + ci1]) return false; }
  return true;
}

/** 틀 좌표 → 가까운 걸을 수 있는 칸 */
export function snap(N, x, z, R = 6) {
  const a = Math.floor((x - N.ox) * S), b = Math.floor((z - N.oz) * S);
  if (a >= 0 && b >= 0 && a < N.gw && b < N.gh && N.ok[b * N.gw + a]) return [a, b];
  for (let r = 1; r <= R; r++) for (let db = -r; db <= r; db++) for (let da = -r; da <= r; da++) {
    if (Math.max(Math.abs(da), Math.abs(db)) !== r) continue;
    const x2 = a + da, y2 = b + db;
    if (x2 >= 0 && y2 >= 0 && x2 < N.gw && y2 < N.gh && N.ok[y2 * N.gw + x2]) return [x2, y2];
  }
  return null;
}

/** A* (8 방향, 모서리 자르지 않기) → 틀 좌표 점 목록 (곧게 다듬은) 또는 null */
export function findPath(N, x0, z0, x1, z1, maxNodes = 40000) {
  const s = snap(N, x0, z0), t = snap(N, x1, z1);
  if (!s || !t) return null;
  const W = N.gw, n = W * N.gh;
  const g = new Float32Array(n).fill(Infinity), came = new Int32Array(n).fill(-1), closed = new Uint8Array(n);
  const si = s[1] * W + s[0], ti = t[1] * W + t[0];
  const heap = [[0, si]];
  g[si] = 0;
  const h = (k) => { const a = k % W, b = (k / W) | 0; const dx = Math.abs(a - t[0]), dy = Math.abs(b - t[1]); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); };
  let seen = 0;
  while (heap.length && seen < maxNodes) {
    // 작은 힙
    let bi = 0;
    for (let k = 1; k < heap.length; k++) if (heap[k][0] < heap[bi][0]) bi = k;
    const [, k] = heap[bi];
    heap[bi] = heap[heap.length - 1]; heap.pop();
    if (closed[k]) continue;
    closed[k] = 1; seen++;
    if (k === ti) break;
    const a = k % W, b = (k / W) | 0;
    for (const [da, db, cost] of D8) {
      const x = a + da, y = b + db;
      if (x < 0 || y < 0 || x >= W || y >= N.gh) continue;
      const e = y * W + x;
      if (closed[e] || !pass(N, a, b, x, y)) continue;
      if (da && db && (!pass(N, a, b, a + da, b) || !pass(N, a, b, a, b + db))) continue;
      const ng = g[k] + cost;
      if (ng < g[e]) { g[e] = ng; came[e] = k; heap.push([ng + h(e), e]); }
    }
    if (heap.length > 6000) heap.sort((p, q) => p[0] - q[0]).length = 3000;
  }
  if (came[ti] < 0 && si !== ti) return null;
  const cells = [];
  for (let k = ti; k >= 0; k = came[k]) { cells.push(k); if (k === si) break; }
  cells.reverse();
  // 곧게 다듬기: 보이는 데까지 건너뛴다
  const pts = cells.map((k) => [N.ox + ((k % W) + 0.5) / S, N.oz + (((k / W) | 0) + 0.5) / S]);
  const out = [pts[0]];
  let i = 0;
  while (i < pts.length - 1) {
    let j = pts.length - 1;
    for (; j > i + 1; j--) if (clearLine(N, pts[i], pts[j])) break;
    out.push(pts[j]);
    i = j;
  }
  return out;
}

/** 두 점 사이가 막힘 없이 보이나 (0.25 m 걸음) */
export function clearLine(N, p, q) {
  const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
  const n = Math.max(1, Math.ceil(d / 0.25));
  let pa = Math.floor((p[0] - N.ox) * S), pb = Math.floor((p[1] - N.oz) * S);
  for (let k = 1; k <= n; k++) {
    const x = p[0] + ((q[0] - p[0]) * k) / n, z = p[1] + ((q[1] - p[1]) * k) / n;
    const a = Math.floor((x - N.ox) * S), b = Math.floor((z - N.oz) * S);
    if (a < 0 || b < 0 || a >= N.gw || b >= N.gh) return false;
    if (a !== pa || b !== pb) { if (!pass(N, pa, pb, a, b)) return false; pa = a; pb = b; }
  }
  return true;
}

/** 길 길이 */
export function pathLen(pts) { let s = 0; for (let k = 1; k < pts.length; k++) s += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]); return s; }
