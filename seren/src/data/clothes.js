// 옷 (v24 8장 「의류·외형·의류 매장」): 부위(slot)마다 한 벌. 모양(shape)은 player/outfit.js 가 실제 실루엣으로 짓는다.
//  · fit 'awen' = 아웬 치수(3 m 넘는 몸) 기성복 — 그대로는 너무 커서 입고 다닐 수 없다(입어 보면 헐렁하고 소매·단이 길다).
//    옷가게 재단사에게 치수를 재고(한 번) 수선하면 내 옷이 된다. 'univ' = 범용(끈·여밈으로 맞춤) — 누구에게나 바로 맞는다.
//  · good: 도시 살림의 물건(옷가게 재고·공장 줄과 이어진다 — data/goods 의 garment·shoes·scarf).
//  · work: 작업복·보호 장비 (공장·창고·발전동에서 일할 때 어울리는 것).
export const SLOTS = ['hat', 'outer', 'top', 'bottom', 'gloves', 'shoes'];
export const SLOT_NAME = { hat: '머리', outer: '겉옷', top: '윗옷', bottom: '아래옷', gloves: '장갑', shoes: '신' };

export const CLOTHES = {
  'top-weave': { name: '결 짠 긴소매', slot: 'top', shape: 'weave', fit: 'awen', good: 'garment', price: 9, colors: [0xb9a6ff, 0x7fd3c8, 0xf0c8a0], desc: '실풀 결을 그대로 살린 헐렁한 긴소매. 소매 끝이 넓다.' },
  'top-tunic': { name: '여밈 반소매', slot: 'top', shape: 'tunic', fit: 'univ', good: 'garment', price: 7, colors: [0xe8e2d4, 0x9ec8f0, 0xf4b0a0], desc: '어깨 여밈으로 품을 맞추는 반소매. 누구에게나 맞는다.' },
  'top-work': { name: '일꾼 윗옷', slot: 'top', shape: 'work', fit: 'univ', good: 'garment', price: 8, work: true, colors: [0x6a7a8c, 0x8a7a5a], desc: '소매를 조이는 띠와 가슴 주머니가 있는 작업복.' },
  'outer-coat': { name: '긴 바람 외투', slot: 'outer', shape: 'coat', fit: 'awen', good: 'garment', price: 16, colors: [0x4a5a7a, 0x7a4a5a, 0xc8b8a0], desc: '무릎까지 오는 외투. 어깨가 넓고 깃이 선다.' },
  'outer-cape': { name: '어깨 망토', slot: 'outer', shape: 'cape', fit: 'univ', good: 'garment', price: 11, colors: [0xff9fd0, 0x7ff3e6, 0xffc46a], desc: '등을 덮는 짧은 망토. 걸으면 끝이 흔들린다.' },
  'outer-vest': { name: '빛띠 보호 조끼', slot: 'outer', shape: 'vest', fit: 'univ', good: 'garment', price: 10, work: true, colors: [0xffb84a, 0x9ad87a], desc: '두툼한 조끼에 빛띠를 둘렀다. 공장·창고에서 눈에 잘 띈다.' },
  'bottom-wide': { name: '넓은 바지', slot: 'bottom', shape: 'wide', fit: 'awen', good: 'garment', price: 8, colors: [0x5a6a8a, 0xd8c8a8, 0x8a5a6a], desc: '아래로 갈수록 넓어지는 바지. 아웬의 긴 다리에 맞춰 길다.' },
  'bottom-slim': { name: '곧은 바지', slot: 'bottom', shape: 'slim', fit: 'univ', good: 'garment', price: 7, colors: [0x3a4050, 0x6a7a5a, 0xa8b0c0], desc: '몸에 붙는 곧은 바지. 허리끈으로 맞춘다.' },
  'shoes-tall': { name: '긴 뜬신', slot: 'shoes', shape: 'tall', fit: 'awen', good: 'shoes', price: 9, colors: [0x5a4a3a, 0x3a3e4c], desc: '종아리까지 올라오는 뜬신. 바닥이 두껍다.' },
  'shoes-light': { name: '가벼운 뜬신', slot: 'shoes', shape: 'light', fit: 'univ', good: 'shoes', price: 6, colors: [0xf1ece4, 0x7fd3c8, 0xff9a7a], desc: '발등을 감싸는 낮은 신. 끈으로 조인다.' },
  'hat-brim': { name: '챙 넓은 모자', slot: 'hat', shape: 'brim', fit: 'univ', good: 'garment', price: 6, colors: [0xd8c8a0, 0x7a6a9a], desc: '햇빛과 별비를 가리는 넓은 챙.' },
  'hat-hood': { name: '두건', slot: 'hat', shape: 'hood', fit: 'univ', good: 'scarf', price: 5, colors: [0xff6a4a, 0x7fd3c8, 0xb9a6ff], desc: '얼굴 앞은 열어 두고 머리와 목을 감싼다.' },
  'hat-hard': { name: '안전모', slot: 'hat', shape: 'hard', fit: 'univ', good: 'garment', price: 7, work: true, colors: [0xffc46a, 0xf1ece4], desc: '공장·짐 나르는 곳의 단단한 모자.' },
  'gloves-work': { name: '일 장갑', slot: 'gloves', shape: 'work', fit: 'univ', good: 'garment', price: 4, work: true, colors: [0x8a7a5a, 0x5a6a7a], desc: '손목까지 오는 두꺼운 장갑.' },
  'gloves-soft': { name: '얇은 장갑', slot: 'gloves', shape: 'soft', fit: 'awen', good: 'garment', price: 5, colors: [0xf1ece4, 0x3a3e4c], desc: '아웬의 긴 손가락에 맞춘 얇은 장갑.' },
};
// 옷 수선·주문 (재단사)
export const TAILOR = { MEASURE: 2, ALTER: 4, ORDER: 6, ORDER_DAYS: 1 };
export const clothName = (o) => (CLOTHES[o.item] || { name: o.item }).name;
