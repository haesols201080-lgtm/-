// 도시의 물건과 그 흐름 (v0.9): 원료(농장·채굴) → 공장(공정) → 물류 창고 → 가게·식당 → 주민·플레이어.
// 물건은 어디서 저절로 생기지 않는다 — 가게 진열대의 빵은 공장이 빛보리 가루와 꽃꿀로 구운 것이고, 그 가루는 재배원의 빛보리다.
//  · cat: 가게 구역(진열대 cat 과 같은 이름) · price: 가게 값(별씨) · base: 도매 값 · color/shape: 진열 모양
//  · eat/buff: 먹으면 몸의 기운(venues 의 BUFFS) · use: 가방에서 쓰는 법(eat/gift/map/read/heal/craft)
export const GOODS = {
  // 원료
  grain: { name: '빛보리', cat: 'raw', base: 0.4, price: 1, color: 0xf0d890, shape: 'sack', src: 'farm' },
  tealeaf: { name: '찻잎', cat: 'raw', base: 0.5, price: 1, color: 0x7fc88a, shape: 'sack', src: 'farm' },
  nectar: { name: '꽃꿀', cat: 'raw', base: 0.6, price: 2, color: 0xffc86a, shape: 'jar', src: 'farm' },
  fiber: { name: '실풀', cat: 'raw', base: 0.4, price: 1, color: 0xd8e8c0, shape: 'sack', src: 'farm' },
  herb: { name: '약초잎', cat: 'raw', base: 0.6, price: 2, color: 0x9fe0a0, shape: 'sack', src: 'farm' },
  ore: { name: '결정 원석', cat: 'raw', base: 0.6, price: 2, color: 0xb9a6ff, shape: 'crystal', src: 'mine' },
  resin: { name: '울림 수지', cat: 'raw', base: 0.5, price: 2, color: 0xffb070, shape: 'jar', src: 'mine' },
  fuel: { name: '연료 결정', cat: 'raw', base: 0.8, price: 3, color: 0xffd9a0, shape: 'crystal', src: 'mine' },
  // 반제품
  flour: { name: '빛보리 가루', cat: 'pantry', base: 0.9, price: 2, color: 0xf6eedc, shape: 'sack' },
  cloth: { name: '결 직물', cat: 'craft', base: 1.4, price: 3, color: 0xc8b8f0, shape: 'flat' },
  panel: { name: '빛판', cat: 'craft', base: 1.6, price: 4, color: 0x9ff6ff, shape: 'flat' },
  shard: { name: '결정 조각', cat: 'craft', base: 1.2, price: 3, color: 0xc79bff, shape: 'crystal' },
  // 먹을 것 (가게·식당)
  fruit: { name: '빛열매', cat: 'fresh', base: 0.5, price: 1, color: 0xffa040, shape: 'round', src: 'farm', eat: 'quick' },
  cookie: { name: '바람과자', cat: 'bakery', base: 1.0, price: 2, color: 0xe8b870, shape: 'box', eat: 'quick' },
  bread: { name: '노래빵', cat: 'bakery', base: 1.2, price: 2, color: 0xd89858, shape: 'round', eat: 'full' },
  tea: { name: '울림차', cat: 'drink', base: 1.2, price: 3, color: 0x8fd8a0, shape: 'box', eat: 'glide' },
  juice: { name: '열매즙', cat: 'drink', base: 1.0, price: 2, color: 0xff8a50, shape: 'bottle', eat: 'quick' },
  jelly: { name: '별젤리', cat: 'chill', base: 1.1, price: 2, color: 0xff9fd0, shape: 'jar', eat: 'calm' },
  bento: { name: '노래 도시락', cat: 'chill', base: 2.5, price: 5, color: 0xffd27a, shape: 'box', eat: 'full' },
  spice: { name: '향 씨앗', cat: 'pantry', base: 0.8, price: 2, color: 0xc86a4a, shape: 'jar' },
  meal: { name: '노래 한 상', cat: 'dish', base: 2.5, price: 5, color: 0xffc46a, shape: 'flat', eat: 'full' },
  // 살림·선물·도구
  flower: { name: '울림꽃', cat: 'gift', base: 0.8, price: 2, color: 0xff9fd0, shape: 'flower', src: 'farm' },
  soap: { name: '울림 비누', cat: 'home', base: 0.9, price: 2, color: 0xbfefff, shape: 'box' },
  garment: { name: '결 옷', cat: 'home', base: 3.0, price: 6, color: 0xb9a6ff, shape: 'flat' },
  lantern: { name: '손등불', cat: 'home', base: 2.0, price: 4, color: 0xffd27a, shape: 'crystal' },
  trinket: { name: '노래 장신구', cat: 'gift', base: 2.0, price: 4, color: 0x7ff3e6, shape: 'crystal' },
  mapshard: { name: '지도 결정', cat: 'craft', base: 2.0, price: 4, color: 0x9fb8ff, shape: 'crystal' },
  device: { name: '작은 공명기', cat: 'craft', base: 4.0, price: 8, color: 0x9ff6ff, shape: 'box' },
  part: { name: '장치 부품', cat: 'craft', base: 1.2, price: 3, color: 0xa8b2c0, shape: 'box' },
  medicine: { name: '고른울림 약', cat: 'med', base: 2.0, price: 4, color: 0x8ff0c0, shape: 'bottle', eat: 'calm' },
  seeds: { name: '씨앗 봉지', cat: 'home', base: 0.6, price: 1, color: 0xc8a870, shape: 'box' },
};

/** 공정: 공장 한 줄이 한 번 돌 때 (재료 → 만든 것, 기운 kWh 비슷한 빛 단위, 걸리는 시간 h) */
export const RECIPES = {
  mill: { name: '빛보리 빻기', in: { grain: 3 }, out: { flour: 3 }, energy: 1, hours: 1 },
  bakery: { name: '과자 굽기', in: { flour: 2, nectar: 1 }, out: { cookie: 4 }, energy: 2, hours: 1 },
  bread: { name: '빵 굽기', in: { flour: 2, fruit: 1 }, out: { bread: 3 }, energy: 2, hours: 1 },
  tea: { name: '차 덖기', in: { tealeaf: 2 }, out: { tea: 3 }, energy: 1, hours: 1 },
  juice: { name: '즙 짜기', in: { fruit: 3 }, out: { juice: 2 }, energy: 1, hours: 1 },
  jelly: { name: '젤리 굳히기', in: { nectar: 1, fruit: 1 }, out: { jelly: 2 }, energy: 1, hours: 1 },
  bento: { name: '도시락 싸기', in: { bread: 1, fruit: 1, spice: 1 }, out: { bento: 2 }, energy: 1, hours: 1 },
  spice: { name: '향 씨앗 고르기', in: { herb: 1 }, out: { spice: 2 }, energy: 0.5, hours: 1 },
  cloth: { name: '실 짜기', in: { fiber: 3 }, out: { cloth: 2 }, energy: 2, hours: 1 },
  garment: { name: '옷 짓기', in: { cloth: 2 }, out: { garment: 1 }, energy: 1, hours: 2 },
  shard: { name: '원석 설득', in: { ore: 2 }, out: { shard: 2 }, energy: 3, hours: 1 },
  panel: { name: '빛판 펴기', in: { ore: 1, resin: 1 }, out: { panel: 1 }, energy: 2, hours: 1 },
  lantern: { name: '등불 빚기', in: { shard: 2, resin: 1 }, out: { lantern: 1 }, energy: 2, hours: 1 },
  trinket: { name: '장신구 다듬기', in: { shard: 1 }, out: { trinket: 1 }, energy: 1, hours: 1 },
  device: { name: '공명기 짜기', in: { shard: 2, panel: 1, part: 1 }, out: { device: 1 }, energy: 3, hours: 2 },
  mapshard: { name: '지도 결정 새기기', in: { shard: 1, panel: 1 }, out: { mapshard: 1 }, energy: 2, hours: 1 },
  part: { name: '부품 깎기', in: { shard: 1, resin: 1 }, out: { part: 2 }, energy: 2, hours: 1 },
  soap: { name: '비누 굳히기', in: { resin: 1, nectar: 1 }, out: { soap: 2 }, energy: 1, hours: 1 },
  medicine: { name: '약 달이기', in: { herb: 2, nectar: 1 }, out: { medicine: 2 }, energy: 1, hours: 1 },
};
/** 공장 종류 → 돌리는 공정 묶음 (공장마다 씨앗으로 하나) */
export const LINES = {
  food: ['mill', 'bakery', 'bread'], drink: ['tea', 'juice', 'jelly'], meal: ['bento', 'spice', 'bread'],
  textile: ['cloth', 'garment'], crystal: ['shard', 'lantern', 'trinket'], tech: ['panel', 'part', 'device', 'mapshard'],
  home: ['soap', 'shard', 'lantern'], pharma: ['medicine', 'spice'],
};
/** 농장이 기르는 것 (재배원 씨앗으로 둘) */
export const CROPS = ['grain', 'tealeaf', 'fruit', 'nectar', 'fiber', 'herb', 'flower'];
/** 가게 진열대 구역 → 놓는 물건 */
export const SHELF_GOODS = {
  fresh: ['fruit', 'flower'], bakery: ['bread', 'cookie'], pantry: ['flour', 'spice', 'seeds'], drink: ['tea', 'juice'], chill: ['jelly', 'bento'],
  snack: ['cookie', 'jelly', 'juice'], home: ['soap', 'garment', 'lantern', 'seeds'], gift: ['flower', 'trinket', 'lantern'], craft: ['part', 'shard', 'mapshard', 'device', 'panel', 'cloth'], med: ['medicine'],
};
/** 주민 한 사람이 하루에 쓰는 것 (가게에서 산다) */
export const DEMAND = { bread: 0.35, fruit: 0.4, tea: 0.25, cookie: 0.2, juice: 0.15, jelly: 0.08, bento: 0.12, flour: 0.05, spice: 0.04, soap: 0.05, garment: 0.01, lantern: 0.01, trinket: 0.01, flower: 0.05, medicine: 0.02, seeds: 0.01, part: 0.005, device: 0.002 };
