import { PLACE } from './places.js';

// 도시의 살: 큰 구조물 사이를 채우는 건물·거리·떠다니는 차의 배치 표 (world/cityfabric.js 가 읽음).
// 도시는 「고리 거리 + 방사 대로」로 짜여 있다 — 아웬은 소리가 퍼지는 모양(동심원)으로 도시를 짓는다.
//
// at: 장소 id 또는 [x, z]   r0~r1: 채울 반지름(m)   ring: 고리 한 칸(거리 + 건물 줄)의 폭   street: 거리 폭
// rows: 한 칸에 건물 줄 수   lot: 필지 간격(고리를 따라)   foot: 건물 반지름 [최소, 최대]
// avenues: 방사 대로 수   h: 높이 [최소, 최대]   tall: 1 이면 안쪽(r0)일수록 높아진다   fill: 채우는 비율(나머지는 공원)
// clump: 동네 단위로 뭉치게 하는 노이즈 크기(m, 0 이면 고르게)   style: STYLES 의 양식   tint: 색조 목록
// streetEvery: 고리 몇 개마다 거리를 그릴지(0 = 대로만)   lanes: 거리 위를 달리는 차   sky: 지붕 위 하늘 차선 [높이…]
// pave: 땅을 포장하는 정도(0..1, 지형 색에 반영 — terrain-mesher)   water: 물 위에도 기둥 집을 짓는다   podium: 탑 밑을 잇는 낮은 블록(기단) 높이 [최소, 최대]
export const ZONES = [
  // ── 하모네아: 척추 고원 (해발 390 m, 반지름 약 1.6 km) ──
  { id: 'cap-core', at: 'harmonea', r0: 470, r1: 1560, ring: 96, street: 24, rows: 2, lot: 36, foot: [9, 16], avenues: 8, h: [40, 240], tall: 0.3, fill: 0.95, style: 'capital', tint: 'pearl', podium: [8, 22], pave: 0.9, streetEvery: 1, lanes: true, sky: [70, 150, 260] },
  // ── 하모네아의 네 구역: 큰 탑 둘레의 고층 밀집 ──
  { id: 'dist-east', at: 'd-east', r0: 380, r1: 1350, ring: 100, street: 26, rows: 2, lot: 38, foot: [10, 17], avenues: 6, h: [35, 420], tall: 1, fill: 0.9, style: 'highrise', tint: 'cool', podium: [8, 26], pave: 0.85, streetEvery: 2, lanes: true, sky: [120, 300] },
  { id: 'dist-sw', at: 'd-sw', r0: 380, r1: 1300, ring: 100, street: 26, rows: 2, lot: 38, foot: [10, 17], avenues: 6, h: [30, 360], tall: 1, fill: 0.9, style: 'highrise', tint: 'warm', podium: [8, 24], pave: 0.85, streetEvery: 2, lanes: true, sky: [110, 260] },
  { id: 'dist-west', at: 'd-west', r0: 400, r1: 1300, ring: 100, street: 26, rows: 2, lot: 40, foot: [10, 17], avenues: 6, h: [30, 300], tall: 1, fill: 0.88, style: 'garden', tint: 'rose', podium: [6, 16], pave: 0.6, streetEvery: 2, lanes: true, sky: [100, 230] },
  { id: 'dist-north', at: 'd-north', r0: 360, r1: 1300, ring: 100, street: 26, rows: 2, lot: 38, foot: [10, 16], avenues: 6, h: [35, 380], tall: 1, fill: 0.9, style: 'highrise', tint: 'violet', podium: [8, 24], pave: 0.85, streetEvery: 2, lanes: true, sky: [120, 280] },
  // ── 고원 아래 넓은 교외: 동네마다 뭉친 낮은 집들 ──
  { id: 'cap-suburb', at: 'harmonea', r0: 1760, r1: 6400, ring: 120, street: 30, rows: 1, lot: 58, foot: [12, 24], avenues: 12, h: [12, 70], tall: 0, fill: 0.62, clump: 900, style: 'suburb', tint: 'pearl', streetEvery: 0, lanes: false },
  // ── 지방 도시: 각자 다른 양식 ──
  { id: 'town-dew', at: 'dewfold', r0: 200, r1: 760, ring: 62, street: 16, rows: 1, lot: 34, foot: [8, 15], avenues: 5, h: [8, 26], tall: 0.4, fill: 0.85, clump: 380, style: 'village', tint: 'warm', streetEvery: 1, lanes: true, pave: 0.45 },
  { id: 'town-yun', at: 'yunseul', r0: 420, r1: 1150, ring: 74, street: 18, rows: 1, lot: 38, foot: [9, 17], avenues: 6, h: [25, 170], tall: 0.8, fill: 0.85, style: 'glass', tint: 'crystal', podium: [5, 12], pave: 0.6, streetEvery: 1, lanes: true, sky: [90] },
  { id: 'town-gat', at: 'gatmaeul', r0: 460, r1: 1200, ring: 76, street: 18, rows: 1, lot: 40, foot: [10, 18], avenues: 6, h: [15, 70], tall: 0.5, fill: 0.85, clump: 420, style: 'bloom', tint: 'bloom', pave: 0.4, streetEvery: 1, lanes: true },
  { id: 'town-tte', at: 'tteodol', r0: 640, r1: 1300, ring: 70, street: 18, rows: 1, lot: 38, foot: [9, 16], avenues: 5, h: [14, 80], tall: 0.5, fill: 0.85, style: 'canyon', tint: 'sand', podium: [5, 12], pave: 0.55, streetEvery: 1, lanes: true },
  { id: 'town-mul', at: 'mulnorae', r0: 520, r1: 1150, ring: 68, street: 18, rows: 1, lot: 36, foot: [9, 15], avenues: 6, h: [8, 40], tall: 0.4, fill: 0.85, style: 'sea', tint: 'sea', streetEvery: 1, lanes: true, water: true },
  { id: 'town-obs', at: 'array', r0: 340, r1: 700, ring: 60, street: 16, rows: 1, lot: 34, foot: [8, 14], avenues: 4, h: [10, 50], tall: 0.5, fill: 0.8, style: 'frost', tint: 'frost', streetEvery: 1, lanes: false },
  // ── 바다 건너 ──
  { id: 'far-rift', at: 'rift-core', r0: 460, r1: 1300, ring: 72, street: 18, rows: 1, lot: 38, foot: [9, 16], avenues: 6, h: [20, 140], tall: 0.6, fill: 0.8, style: 'canyon', tint: 'sand', streetEvery: 1, lanes: true },
  { id: 'far-plains', at: 'bones', r0: 560, r1: 1250, ring: 80, street: 20, rows: 1, lot: 46, foot: [10, 18], avenues: 6, h: [10, 40], tall: 0.3, fill: 0.7, clump: 500, style: 'village', tint: 'warm', streetEvery: 1, lanes: false },
  { id: 'far-ice', at: 'great-ear', r0: 560, r1: 1150, ring: 70, street: 18, rows: 1, lot: 40, foot: [9, 16], avenues: 5, h: [10, 60], tall: 0.5, fill: 0.75, style: 'frost', tint: 'frost', streetEvery: 1, lanes: false, water: true },
  { id: 'far-falls', at: 'sky-forge', r0: 640, r1: 1350, ring: 76, street: 20, rows: 1, lot: 42, foot: [10, 17], avenues: 6, h: [20, 120], tall: 0.6, fill: 0.8, style: 'glass', tint: 'cool', streetEvery: 1, lanes: true, pave: 0.5 },
];

// 양식: 건물 모양별 가중치
export const STYLES = {
  capital: { twist: 3, blade: 2.5, stack: 2.5, slab: 2, spire: 1.2, twin: 1, ovoid: 1, arcology: 1 },
  highrise: { twist: 3, blade: 3, spire: 2, stack: 2, slab: 2, twin: 1.2, ovoid: 0.8 },
  garden: { arcology: 4, ovoid: 2, stack: 2, twist: 1.5, cap: 1 },
  suburb: { villa: 5, arcology: 2, slab: 1.5, dome: 1.5, stack: 0.6 },
  village: { dome: 4, villa: 3, arcology: 1 },
  glass: { crystal: 5, spire: 2, blade: 2, twist: 1 },
  bloom: { cap: 6, ovoid: 2, dome: 2 },
  canyon: { stack: 3, arcology: 3, villa: 2, stilt: 1 },
  sea: { stilt: 5, villa: 2, dome: 2, ovoid: 1 },
  frost: { villa: 3, slab: 2, dome: 3, spire: 1 },
};

// 색조 (건물 바탕색에 곱해짐 — 진주빛을 크게 벗어나지 않게)
export const TINTS = {
  pearl: [0xffffff, 0xf4eeff, 0xfff4e6, 0xeaf6ff, 0xf8eaf2],
  cool: [0xeaf4ff, 0xdfeeff, 0xf2f8ff, 0xe4f8f4],
  warm: [0xfff2e0, 0xffecd8, 0xfff8ee, 0xf8eadc],
  rose: [0xffe8f2, 0xfff0f6, 0xf6e4ff, 0xffffff],
  violet: [0xeee6ff, 0xe6e8ff, 0xf6f0ff, 0xffffff],
  crystal: [0xffd6ee, 0xd6f2ff, 0xe8dcff, 0xfff0f8],
  bloom: [0xffc8e8, 0xc8fff0, 0xffe8b0, 0xe0d0ff],
  sand: [0xffe4cc, 0xf6dcc8, 0xfff0e0, 0xf0d8c0],
  sea: [0xe4f8ff, 0xffffff, 0xd8f4f0, 0xf0f8ff],
  frost: [0xeef4ff, 0xe4ecff, 0xffffff, 0xe8f8ff],
};

// ── 포장된 땅 (지형 색): 워커에서도 쓰므로 순수 함수 ──
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const PAVE = ZONES.filter((Z) => Z.pave).map((Z) => {
  const [cx, cz] = Array.isArray(Z.at) ? Z.at : PLACE[Z.at].pos;
  const rOut = Z.r0 + Math.floor((Z.r1 - Z.r0) / Z.ring) * Z.ring;
  return { cx, cz, a: Z.r0 - Z.street - 20, b: rOut + 30, k: Z.pave };
});
/** 0..1: 이 자리가 얼마나 포장되었나 */
export function pavedAt(x, z) {
  let p = 0;
  for (const Q of PAVE) {
    const dx = x - Q.cx, dz = z - Q.cz, r2 = dx * dx + dz * dz;
    const lo = Math.max(0, Q.a - 50), hi = Q.b + 50;
    if (r2 > hi * hi || r2 < lo * lo) continue;
    const r = Math.sqrt(r2);
    p = Math.max(p, Q.k * sm(Q.a - 50, Q.a, r) * (1 - sm(Q.b, Q.b + 50, r)));
  }
  return p;
}
