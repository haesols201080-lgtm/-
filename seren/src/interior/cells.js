// 방·구역 단위 독립 공간 「셀」 (v24 · 문서 P0 「방·구역 단위 독립 포켓 + 로딩 전환」)
//  · 셀 = 벽 없이 이어진 방 무리: 오가는 공간끼리(복도·홀·로비·승강기 홀) · 열린 문 · 유리 칸막이 너머 — 실제 문이 있는 곳에서만 갈린다.
//  · 층을 꿰는 셀: 계단실(S+심 부품 번호 — 그 계단이 서는 모든 층의 계단 칸), 아트리움(A — 뚫린 층들의 둘레 무리),
//    중2층(아래 홀과 한 셀 — 홀에서 중2층 계단으로 오르는 한 공간).
//  · 건물은 지금 셀만 짓는다 (building.setCell): 다른 방·다른 층의 벽·가구·사람·상호작용은 그리기·충돌·고르기 후보가 아니다.
//    한 층 평면의 좌표는 그대로라 문 이쪽과 저쪽이 같은 자리 — 문턱을 넘으면 짧게 가리고(ui.blink) 둘레만 옆 셀로 바뀐다.
//  · 문 너머(아직 짓지 않은 옆 셀)는 문틀 뒤의 어두운 깊이(render.vestibule)로 보인다 — 검은 판이 아니라 빛이 거의 없는 다음 공간.
import { flowRoom, ROOMS } from './catalog.js';

/** 걸어 들어갈 수 없는 방 (승강기 칸·화물 승강기 칸·설비 관) */
export const NOWALK = new Set(['lift', 'cargo', 'shaft']);
const special = (R) => R.type === 'stair' || NOWALK.has(R.type);

/** 문 자리 (모서리 열쇠 → 문) — render.partitions 와 같은 열쇠 */
export function doorEdges(L) {
  const { gw } = L;
  const at = new Map();
  for (const d of L.doors) {
    const i = d.c % gw, j = (d.c / gw) | 0, [di, dj] = d.dir;
    const w = Math.max(1, d.w), o0 = -Math.floor((w - 1) / 2), o1 = Math.ceil((w - 1) / 2);
    for (let o = o0; o <= o1; o++) {
      const ci = i + (dj ? o : 0), cj = j + (di ? o : 0);
      at.set(di ? `v${di > 0 ? ci + 1 : ci},${cj}` : `h${ci},${dj > 0 ? cj + 1 : cj}`, d);
    }
  }
  return at;
}

/**
 * 한 층의 방 무리: 방 번호 → 무리 뿌리(가장 작은 방 번호). 계단·승강기·관은 -1.
 * 벽이 서지 않는 이웃(render.partitions 의 규칙과 같다)끼리 묶는다: 오가는 공간끼리 · 열린 문 · 유리 칸막이.
 */
export function floorGroups(L) {
  const R = L.rooms, n = R.length, { gw, gh, room } = L;
  const par = new Int32Array(n);
  for (let k = 0; k < n; k++) par[k] = k;
  const find = (a) => { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; };
  const uni = (a, b) => { a = find(a); b = find(b); if (a !== b) { if (a < b) par[b] = a; else par[a] = b; } };
  const glass = (t) => !!(ROOMS[t] && ROOMS[t].glass);
  const doors = doorEdges(L);
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    const c = j * gw + i;
    const a = room[c] - 1;
    if (a < 0) continue;
    for (const [di, dj] of [[1, 0], [0, 1]]) {
      const ii = i + di, jj = j + dj;
      if (ii >= gw || jj >= gh) continue;
      const b = room[jj * gw + ii] - 1;
      if (b < 0 || b === a) continue;
      const A = R[a], B = R[b];
      if (special(A) || special(B)) continue;
      if (flowRoom(A) && flowRoom(B)) { uni(a, b); continue; }
      const d = doors.get(di ? `v${i + 1},${j}` : `h${i},${j + 1}`);
      if (d && d.kind === 'open') { uni(a, b); continue; }
      if (!d && (glass(A.type) || glass(B.type))) uni(a, b);
    }
  }
  const root = new Int32Array(n);
  for (let k = 0; k < n; k++) root[k] = special(R[k]) ? -1 : find(k);
  return root;
}

/** 셀 열쇠 → { kind: 'F'|'S'|'A', floor?, root?, part? } */
export function parseKey(key) {
  if (!key) return null;
  if (key[0] === 'S') return { kind: 'S', part: +key.slice(1) };
  if (key === 'A') return { kind: 'A' };
  const m = /^F(\d+):(\d+)$/.exec(key);
  return m ? { kind: 'F', floor: +m[1], root: +m[2] } : null;
}
