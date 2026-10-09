// 도시의 조직들 (v0.9): 가게 연쇄점·회사·연구소·병원·학교·호텔·공장… 같은 조직의 건물은 상표(빛깔·문양·간판 모양)를 나누지만
// 구조와 세부는 건물마다 다르다. 조직은 구역마다 몇 개씩 있고, 건물이 씨앗으로 하나를 고른다(큰 연쇄점은 여러 구역에).
//  · pal: [주색, 보조색, 밝은 빛] · motif: 간판 문양(material/props 가 그림) · sign: 간판 모양

/** 업종 → 조직 이름 후보 (도시 전체 연쇄점은 chain) */
export const ORG_POOLS = {
  mart: { chain: ['별바구니', '한아름 곳간', '이슬장터', '빛열매 마트', '고리장', '나눔터'], suffix: ['', ' 동네점', ' 큰점'] },
  shops: { chain: ['울림 상가', '고리 아케이드', '빛길 상점가'], suffix: [''] },
  dept: { chain: ['하모 백화점', '빛고리 백화점'], suffix: [''] },
  food: { chain: ['김노래 찻집', '한 상 식당', '별빵 굽는 집', '물결 국숫집', '꿀물 가게', '저녁빛 식당'], suffix: [''] },
  office: { pre: ['울림', '빛실', '별결', '고리', '하늘길', '이슬', '결정', '물결', '노래', '바람', '은빛', '첫빛'], post: ['설계', '공학', '물류', '기록', '상사', '조율', '통신', '셈터', '디자인', '중개', '번역', '건축'] },
  lab: { pre: ['공명', '결정', '중력', '생명결', '빛', '하늘', '깊은물'], post: ['연구소', '과학원', '실험실', '연구원'] },
  clinic: { chain: ['고른울림 치유원', '맑은숨 병원', '하모네아 돌봄원', '이웃 치유원'], suffix: [''] },
  school: { pre: ['새싹', '첫노래', '물결', '별바라기', '고리', '이슬'], post: [' 노래 학교', ' 배움터'] },
  library: { chain: ['하모네아 서고', '구역 기록관'], suffix: [''] },
  museum: { chain: ['기억 박물관', '노래 역사관', '빚음 박물관', '하늘 박물관'], suffix: [''] },
  hall: { chain: ['울림 공연장', '합창 극장', '노래 마당'], suffix: [''] },
  admin: { chain: ['하모네아 행정청', '구역 민원청', '이웃 의회'], suffix: [''] },
  bank: { chain: ['고리 나눔 은행', '하모네아 울림 은행', '이슬 신용 조합', '별빛 은행'], suffix: [' 지점', ''] },
  clothes: { pre: ['결', '실풀', '바람결', '빛올', '고운', '긴소매'], post: [' 옷방', ' 옷가게', ' 지음새', ' 재단소'] },
  home: { chain: ['고리 주거조합', '이슬 주거조합', '별집 조합', '바람결 공동주택'], suffix: [''] },
  hotel: { chain: ['하늘쉼 호텔', '별잠 여관', '고요 호텔', '나그네 쉼터'], suffix: [''] },
  factory: { pre: ['빚음', '울림', '결정', '고리', '빛'], post: [' 공방', ' 제작소', ' 공장'] },
  depot: { chain: ['하늘길 물류', '고리 짐나름', '날개 배송'], suffix: [' 창고'] },
  terminal: { chain: ['하모네아 교통공사'], suffix: [' 터미널'] },
  farm: { pre: ['푸른', '빛잎', '이슬', '열매', '꽃꿀'], post: [' 농장', ' 재배원'] },
  garden: { chain: ['하늘 정원 조합'], suffix: [''] },
  plant: { chain: ['하모네아 공명 전력'], suffix: [' 발전소'] },
};

/** 상표 빛깔 (주색·보조·빛) — 조직마다 하나 */
export const BRAND_PALS = [
  [0x2f8f83, 0xf1ece4, 0x7ff3e6], [0xc4553a, 0xf6e7d8, 0xffb36b], [0x5b4aa8, 0xe9e4f6, 0xc79bff], [0x3f7a3a, 0xe8f0e2, 0xb4f07a],
  [0xb03a6a, 0xf6e4ec, 0xff8fb8], [0x2c5f9e, 0xe0e8f4, 0x8fc4ff], [0x8a6a2c, 0xf2ebdc, 0xffe6b0], [0x24766f, 0xe6f2ef, 0x9ff6ff],
  [0x9a4a1f, 0xf4e6dc, 0xff9f7a], [0x4a5468, 0xeceef2, 0xd8e6ff], [0x6e2f8f, 0xf0e4f6, 0xe0a8ff], [0x2f7a5a, 0xe4f2ea, 0x8ff0c0],
];
export const MOTIFS = ['ring', 'drop', 'star', 'leaf', 'wave', 'tri', 'spiral', 'cross', 'hex', 'arc'];
export const SIGNS = ['band', 'halo', 'blade', 'glyph'];
