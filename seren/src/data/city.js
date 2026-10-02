import { PLACE } from './places.js';

// 도시의 살: 구역마다 「고리 거리 + 방사 대로 + 골목」으로 블록을 나누고, 블록마다 쓰임(토지 이용)을 정한다.
// (world/cityplan.js 가 배정·배치, world/cityfabric.js 가 그리기, 지형 셰이더가 블록 바닥을 그린다)
// 아웬은 소리가 퍼지는 모양(동심원)으로 도시를 짓는다. 가운데는 모이는 곳(공공·광장), 바깥으로 갈수록 만들고 나르는 곳.
//
// at: 장소 id 또는 [x, z]   r0~r1: 채울 반지름(m)   ring: 고리 한 칸(거리 + 블록)의 폭   street: 고리 거리 폭
// avenues: 방사 대로 수   blockLen: 블록 길이(고리를 따라, m)   lane: 블록 사이 골목 폭
// h: 높은 건물 높이 [최소, 최대]   tall: 1 이면 안쪽(r0)일수록 높아진다   style: 건물 양식(STYLE_KINDS)
// sectors: 대로 사이 부채꼴마다 쓰임 묶음(MIX) — 없으면 mix 하나   tint: 색조
// streetEvery: 고리 몇 개마다 차도를 둘지(나머지 고리 경계는 골목)   lanes: 차도 위 차   sky: 지붕 위 하늘 차선 [높이…]
// water: 물 위에도 기둥 집을 짓는다   podium: 상업 블록 기단 높이 [최소, 최대]
// grade: false 면 지형 땅고르기를 하지 않는다(협곡·균열처럼 지형이 곧 도시의 모습인 곳 — 작은 굴곡만 없앰)
// core: 'plaza' 면 r0 안쪽(큰 탑 둘레)을 풀밭 대신 판석 광장으로 덮는다(지형 셰이더)
// marks: 보조 랜드마크 [[모양(lm_*), 부채꼴, 안쪽~바깥 0..1]…] — 그 블록은 광장이 되고 가운데에 하나뿐인 건물 (city-arch 의 landmarkArchetypes)
// peaks: 높은 군집 [[부채꼴, 안쪽~바깥 0..1, 반지름 m, 세기]…] — 한가운데 블록에 초고층 하나, 멀어질수록 묶음의 기본 높이로 (cityfabric._height)
export const ZONES = [
  // ── 하모네아: 척추 고원 (해발 390 m, 반지름 약 1.6 km) ──
  { id: 'cap-core', core: 'plaza', marks: [['lm_port', 7, 0.78]], at: 'harmonea', r0: 470, r1: 1560, ring: 96, street: 24, avenues: 8, blockLen: 118, lane: 9, h: [70, 270], tall: 0.3, peaks: [[1, 0.08, 460, 1], [4, 0.14, 420, 0.95], [2, 0.55, 300, 0.72], [6, 0.38, 260, 0.6]], style: 'capital', sectors: ['civic', 'commerce', 'transit', 'residential', 'commerce', 'civic', 'residential', 'transit'], tint: 'pearl', podium: [8, 22], streetEvery: 1, lanes: true, sky: [70, 150, 260] },
  // ── 하모네아의 네 구역: 큰 탑 둘레 ──
  { id: 'dist-east', core: 'plaza', marks: [['lm_ear', 1, 0.45]], at: 'd-east', r0: 380, r1: 1350, ring: 100, street: 26, avenues: 6, blockLen: 128, lane: 9, h: [60, 380], tall: 0.4, peaks: [[2, 0.06, 360, 1], [5, 0.45, 220, 0.55]], style: 'capital', sectors: ['research', 'research', 'commerce', 'residential', 'research', 'civic'], tint: 'cool', podium: [8, 26], streetEvery: 1, lanes: true, sky: [120, 300] },
  { id: 'dist-sw', core: 'plaza', marks: [['lm_garden', 1, 0.55]], at: 'd-sw', r0: 380, r1: 1300, ring: 100, street: 26, avenues: 6, blockLen: 128, lane: 9, h: [50, 300], tall: 0.5, peaks: [[2, 0.1, 380, 1], [0, 0.5, 260, 0.65], [4, 0.3, 220, 0.55]], style: 'capital', sectors: ['residential', 'residential', 'commerce', 'residential', 'civic', 'residential'], tint: 'warm', podium: [8, 24], streetEvery: 1, lanes: true, sky: [110, 260] },
  { id: 'dist-west', core: 'plaza', marks: [['lm_tree', 0, 0.5]], at: 'd-west', r0: 400, r1: 1300, ring: 100, street: 26, avenues: 6, blockLen: 128, lane: 9, h: [40, 220], tall: 0.3, peaks: [[4, 0.12, 300, 0.85]], style: 'capital', sectors: ['bioindustry', 'bioindustry', 'residential', 'bioindustry', 'transit', 'residential'], tint: 'rose', podium: [6, 16], streetEvery: 1, lanes: true, sky: [100, 230] },
  { id: 'dist-north', core: 'plaza', marks: [['lm_coil', 1, 0.5]], at: 'd-north', r0: 360, r1: 1300, ring: 100, street: 26, avenues: 6, blockLen: 128, lane: 9, h: [40, 260], tall: 0.3, peaks: [[4, 0.1, 280, 0.85], [5, 0.5, 200, 0.5]], style: 'capital', sectors: ['energy', 'energy', 'research', 'energy', 'transit', 'residential'], tint: 'violet', podium: [8, 24], streetEvery: 1, lanes: true, sky: [120, 280] },
  // ── 고원 아래 넓은 교외: 동네(주택) · 농지 · 인공 환경 · 물류 ──
  { id: 'cap-suburb', at: 'harmonea', r0: 1760, r1: 6400, ring: 120, street: 22, avenues: 12, blockLen: 230, lane: 12, h: [10, 40], tall: 0, style: 'suburb', mix: 'suburb', tint: 'pearl', streetEvery: 2, lanes: false },
  // ── 지방 도시: 각자 다른 양식 ──
  { id: 'town-dew', at: 'dewfold', r0: 200, r1: 760, ring: 62, street: 16, avenues: 5, blockLen: 88, lane: 7, h: [8, 26], tall: 0.4, style: 'village', mix: 'village', tint: 'warm', streetEvery: 1, lanes: true },
  { id: 'town-yun', at: 'yunseul', r0: 420, r1: 1150, ring: 74, street: 18, avenues: 6, blockLen: 100, lane: 8, h: [25, 170], tall: 0.8, style: 'glass', mix: 'town', tint: 'crystal', podium: [5, 12], streetEvery: 1, lanes: true, sky: [90] },
  { id: 'town-gat', at: 'gatmaeul', r0: 460, r1: 1200, ring: 76, street: 18, avenues: 6, blockLen: 100, lane: 8, h: [15, 70], tall: 0.5, style: 'bloom', mix: 'town', tint: 'bloom', streetEvery: 1, lanes: true },
  { id: 'town-tte', grade: false, at: 'tteodol', r0: 640, r1: 1300, ring: 70, street: 18, avenues: 5, blockLen: 100, lane: 8, h: [14, 80], tall: 0.5, style: 'canyon', mix: 'town', tint: 'sand', podium: [5, 12], streetEvery: 1, lanes: true },
  { id: 'town-mul', at: 'mulnorae', r0: 520, r1: 1150, ring: 68, street: 18, avenues: 6, blockLen: 96, lane: 8, h: [8, 40], tall: 0.4, style: 'sea', mix: 'village', tint: 'sea', streetEvery: 1, lanes: true, water: true },
  { id: 'town-obs', at: 'array', r0: 340, r1: 700, ring: 60, street: 16, avenues: 4, blockLen: 90, lane: 7, h: [10, 50], tall: 0.5, style: 'frost', mix: 'village', tint: 'frost', streetEvery: 1, lanes: false },
  // ── 바다 건너 ──
  { id: 'far-rift', grade: false, at: 'rift-core', r0: 460, r1: 1300, ring: 72, street: 18, avenues: 6, blockLen: 100, lane: 8, h: [20, 140], tall: 0.6, style: 'canyon', mix: 'town', tint: 'sand', streetEvery: 1, lanes: true },
  { id: 'far-plains', at: 'bones', r0: 560, r1: 1250, ring: 80, street: 20, avenues: 6, blockLen: 120, lane: 9, h: [10, 40], tall: 0.3, style: 'village', mix: 'village', tint: 'warm', streetEvery: 1, lanes: false },
  { id: 'far-ice', at: 'great-ear', r0: 560, r1: 1150, ring: 70, street: 18, avenues: 5, blockLen: 100, lane: 8, h: [10, 60], tall: 0.5, style: 'frost', mix: 'village', tint: 'frost', streetEvery: 1, lanes: false, water: true },
  { id: 'far-falls', grade: false, at: 'sky-forge', r0: 640, r1: 1350, ring: 76, street: 20, avenues: 6, blockLen: 104, lane: 8, h: [20, 120], tall: 0.6, style: 'glass', mix: 'town', tint: 'cool', streetEvery: 1, lanes: true },
];

// ── 토지 이용 (블록의 쓰임) — 지형 셰이더와 같은 번호 ──
export const USE = { NONE: 0, RES: 1, COM: 2, CIV: 3, IND: 4, LOG: 5, ENE: 6, RSC: 7, TRN: 8, ENV: 9, GRN: 10, PLZ: 11, FARM: 12, VILLA: 13 };
export const USE_NAME = { 1: '주거', 2: '상업', 3: '공공', 4: '산업', 5: '물류', 6: '에너지', 7: '연구', 8: '교통', 9: '인공 환경', 10: '계획 녹지', 11: '광장', 12: '농지', 13: '주택가' };

// 부채꼴(쓰임 묶음)마다 블록 쓰임의 비율
export const MIX = {
  civic: { CIV: 3, PLZ: 1.6, GRN: 1.6, COM: 2, RES: 1.6, RSC: 0.5, ENV: 0.4 },
  commerce: { COM: 5, PLZ: 1.2, RES: 1.6, CIV: 0.6, TRN: 0.6, GRN: 0.8 },
  transit: { TRN: 3, LOG: 2.2, COM: 1.5, PLZ: 0.8, IND: 0.6, GRN: 0.6, RES: 0.6 },
  residential: { RES: 6, GRN: 1.6, CIV: 1, COM: 1, ENV: 0.7, PLZ: 0.5 },
  research: { RSC: 5, CIV: 0.8, GRN: 1.2, RES: 1.4, ENV: 1 },
  energy: { ENE: 4, IND: 1.6, LOG: 1.1, RSC: 0.6, GRN: 0.7, RES: 0.8 },
  bioindustry: { IND: 3, ENV: 3, LOG: 1.6, RES: 1.2, GRN: 0.7 },
  suburb: { FARM: 6, VILLA: 2.4, ENV: 1.6, GRN: 1.2, ENE: 1, LOG: 0.8, IND: 0.6, CIV: 0.3, COM: 0.3 },
  town: { RES: 3, VILLA: 1.5, COM: 1.6, PLZ: 0.8, GRN: 1.2, CIV: 0.8, ENV: 1, IND: 0.5, LOG: 0.4, RSC: 0.5 },
  village: { VILLA: 4, RES: 0.8, PLZ: 0.6, GRN: 1.2, ENV: 1, COM: 0.7, FARM: 1.6, CIV: 0.5 },
};

// 쓰임마다 들어서는 건물 모양 (양식마다 바꿔 낄 수 있다)
export const STYLE_KINDS = {
  // 주거·상업: 익숙한 고층 문법(후퇴·왕관·테라스·돌출·하늘정원·세 쌍둥이) / 연구: 관측 고리·꼬투리·관측동
  capital: {
    tower: { balcony: 2.2, terrace: 1.8, skygarden: 1.6, setback: 1.4, triad: 1.2, twist: 1, arcology: 0.6, ovoid: 0.5 },
    office: { setback: 2.4, crown: 2.2, slab: 2, cantilever: 1.8, blade: 1.8, skygarden: 1.1, twist: 1.2, stack: 1, twin: 0.8, spire: 0.5 },
    lab: { halolab: 2.6, podlab: 2, observatory: 2, antenna: 1.4 },
    house: { villa: 3, dome: 1 },
  },
  suburb: { tower: { arcology: 2, bubbles: 1.5, balcony: 1 }, office: { slab: 2, stack: 1 }, lab: { observatory: 1, podlab: 1 }, house: { villa: 5, dome: 1.5, bubbles: 0.6 } },
  village: { tower: { dome: 2, arcology: 1 }, office: { villa: 2, stack: 1 }, lab: { observatory: 1 }, house: { dome: 3, villa: 3 } },
  glass: { tower: { crystal: 4, spire: 1.5, triad: 1 }, office: { crystal: 3, blade: 2, spire: 1.5, crown: 1 }, lab: { antenna: 1, crystal: 1, halolab: 1.5 }, house: { crystal: 1, villa: 2 } },
  bloom: { tower: { cap: 4, ovoid: 1.5, bubbles: 1.5, treeform: 1 }, office: { cap: 3, ovoid: 1 }, lab: { podlab: 1 }, house: { cap: 3, dome: 1 } },
  canyon: { tower: { stack: 3, arcology: 3, terrace: 2 }, office: { stack: 2, slab: 1, arcology: 1, setback: 2 }, lab: { observatory: 1, antenna: 1 }, house: { villa: 3, stack: 0.5 } },
  sea: { tower: { stilt: 2, dome: 1 }, office: { villa: 2, dome: 1 }, lab: { observatory: 1 }, house: { stilt: 4, villa: 2, dome: 1 } },
  frost: { tower: { dome: 2, slab: 1 }, office: { slab: 2, dome: 1 }, lab: { observatory: 2, antenna: 1 }, house: { villa: 3, dome: 3 } },
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

// ── 구역의 기하 (cityplan·지형 셰이더·지도·식물이 함께 쓴다 — 워커에서도 쓰므로 순수) ──
const TAU = Math.PI * 2;
export const ZGEO = ZONES.map((Z) => {
  const [cx, cz] = Array.isArray(Z.at) ? Z.at : PLACE[Z.at].pos;
  const nb = Math.floor((Z.r1 - Z.r0) / Z.ring);
  return {
    id: Z.id, cx, cz, r0: Z.r0, ring: Z.ring, street: Z.street, nb, rOut: Z.r0 + nb * Z.ring,
    avenues: Z.avenues, aOff: (cx % 7) * 0.1, every: Z.streetEvery || 0, lane: Z.lane, blockLen: Z.blockLen,
    avH: Z.street * 0.35 + 4.2, // 대로 반폭 (차도 + 보도)
  };
});
/** 고리 k 의 시작에 차도가 있나 (k = nb 는 바깥 가장자리 거리) */
export const hasStreet = (G, k) => k === G.nb || (G.every > 0 && k % G.every === 0);
/** 고리 k 의 블록이 시작하는 반지름까지의 띠 폭 (차도면 차도 폭, 아니면 골목) */
export const bandStart = (G, k) => (hasStreet(G, k) ? G.street : G.lane);

/** 0..1: 이 자리가 도시 구역(블록·거리)인가 — 지형 정점색·지도·식물이 쓴다 */
export function pavedAt(x, z) {
  for (const G of ZGEO) {
    const dx = x - G.cx, dz = z - G.cz, r2 = dx * dx + dz * dz;
    const lo = G.r0 - G.street, hi = G.rOut + G.street;
    if (r2 < lo * lo || r2 > hi * hi) continue;
    return 1;
  }
  return 0;
}
