// 도시의 물건과 그 흐름 (v0.9): 원료(농장·채굴) → 공장(공정) → 물류 창고 → 가게·식당 → 주민·플레이어.
// 물건은 어디서 저절로 생기지 않는다 — 가게 진열대의 빵은 공장이 빛보리 가루와 꽃꿀로 구운 것이고, 그 가루는 재배원의 빛보리다.
//  · cat: 가게 구역(진열대 cat 과 같은 이름) · price: 가게 값(울) · base: 도매 값 · color/shape: 진열 모양
//  · eat/buff: 먹으면 몸의 기운(venues 의 BUFFS) · use: 가방에서 쓰는 법(eat/gift/map/read/heal/craft)
export const GOODS = {
  // 원료 (농장·채굴)
  grain: { name: '빛보리', cat: 'raw', base: 0.4, price: 1, color: 0xf0d890, shape: 'sack', src: 'farm', desc: '빻으면 가루, 그대로 지으면 밥.' },
  tealeaf: { name: '찻잎', cat: 'raw', base: 0.5, price: 1, color: 0x7fc88a, shape: 'sack', src: 'farm' },
  nectar: { name: '꽃꿀', cat: 'raw', base: 0.6, price: 2, color: 0xffc86a, shape: 'jar', src: 'farm' },
  fiber: { name: '실풀', cat: 'raw', base: 0.4, price: 1, color: 0xd8e8c0, shape: 'sack', src: 'farm' },
  herb: { name: '약초잎', cat: 'raw', base: 0.6, price: 2, color: 0x9fe0a0, shape: 'sack', src: 'farm' },
  milkpod: { name: '젖꽃깍지', cat: 'raw', base: 0.5, price: 1, color: 0xf4f0e0, shape: 'round', src: 'farm', desc: '짜면 구름젖이 나오는 깍지.' },
  ore: { name: '결정 원석', cat: 'raw', base: 0.6, price: 2, color: 0xb9a6ff, shape: 'crystal', src: 'mine' },
  resin: { name: '울림 수지', cat: 'raw', base: 0.5, price: 2, color: 0xffb070, shape: 'jar', src: 'mine' },
  fuel: { name: '연료 결정', cat: 'raw', base: 0.8, price: 3, color: 0xffd9a0, shape: 'crystal', src: 'mine' },
  brine: { name: '하늘 샘물', cat: 'raw', base: 0.3, price: 1, color: 0xbfefff, shape: 'bottle', src: 'mine', desc: '깊은 샘에서 길어 올린 물. 소금과 반짝물이 된다.' },
  clay: { name: '울림 흙', cat: 'raw', base: 0.3, price: 1, color: 0xc89a7a, shape: 'sack', src: 'mine', desc: '구우면 맑게 우는 흙.' },
  // 반제품
  flour: { name: '빛보리 가루', cat: 'pantry', base: 0.9, price: 2, color: 0xf6eedc, shape: 'sack', desc: '빵·과자·국수의 밑.' },
  cloth: { name: '결 직물', cat: 'craft', base: 1.4, price: 3, color: 0xc8b8f0, shape: 'flat', desc: '실풀을 짠 천.' },
  panel: { name: '빛판', cat: 'craft', base: 1.6, price: 4, color: 0x9ff6ff, shape: 'flat', desc: '빛을 받아 그림을 띄우는 얇은 판.' },
  shard: { name: '결정 조각', cat: 'craft', base: 1.2, price: 3, color: 0xc79bff, shape: 'crystal', desc: '원석을 설득해 깎은 조각.' },
  paper: { name: '결종이', cat: 'paper', base: 0.5, price: 1, color: 0xf6f2e8, shape: 'flat', desc: '실풀로 뜬 종이.' },
  // ── 먹을 것 ──
  fruit: { name: '빛열매', cat: 'fresh', base: 0.5, price: 1, color: 0xffa040, shape: 'round', src: 'farm', eat: 'quick', desc: '한 입 베어 물면 발이 가벼워진다.' },
  leafveg: { name: '이슬잎채', cat: 'fresh', base: 0.4, price: 1, color: 0x8fe08a, shape: 'flower', src: 'farm', eat: 'calm', desc: '아침 이슬을 머금은 잎채소.' },
  root: { name: '별뿌리', cat: 'fresh', base: 0.4, price: 1, color: 0xd8a070, shape: 'round', src: 'farm', eat: 'full', desc: '땅속에서 별 모양으로 자라는 뿌리.' },
  cookie: { name: '바람과자', cat: 'bakery', base: 1.0, price: 2, color: 0xe8b870, shape: 'box', eat: 'quick', desc: '바삭한 과자.' },
  bread: { name: '노래빵', cat: 'bakery', base: 1.2, price: 2, color: 0xd89858, shape: 'round', eat: 'full', desc: '구울 때 노래하는 빵.' },
  cake: { name: '꿀결 케이크', cat: 'bakery', base: 2.2, price: 4, color: 0xffe0b0, shape: 'box', eat: 'calm', desc: '구름 크림과 꽃꿀을 켜켜이.' },
  noodle: { name: '결국수', cat: 'pantry', base: 0.8, price: 2, color: 0xf4e8c8, shape: 'box', eat: 'full', desc: '빛보리 가루를 길게 뽑은 국수.' },
  spice: { name: '향 씨앗', cat: 'spice', base: 0.8, price: 2, color: 0xc86a4a, shape: 'jar', desc: '한 꼬집이면 음식이 노래한다.' },
  sauce: { name: '울림 장', cat: 'spice', base: 1.0, price: 2, color: 0x8a4a30, shape: 'jar', desc: '약초잎과 열매를 오래 익힌 장.' },
  salt: { name: '하늘 소금', cat: 'spice', base: 0.5, price: 1, color: 0xf0f8ff, shape: 'jar', desc: '샘물을 말린 맑은 소금.' },
  tea: { name: '울림차', cat: 'drink', base: 1.2, price: 3, color: 0x8fd8a0, shape: 'box', eat: 'glide', desc: '김이 노래하는 차.' },
  juice: { name: '열매즙', cat: 'drink', base: 1.0, price: 2, color: 0xff8a50, shape: 'bottle', eat: 'quick', desc: '빛열매를 짠 즙.' },
  fizz: { name: '반짝물', cat: 'drink', base: 0.6, price: 1, color: 0xbff4ff, shape: 'bottle', eat: 'glide', desc: '샘물에 꽃꿀을 넣고 기포를 깨운 물.' },
  jelly: { name: '별젤리', cat: 'chill', base: 1.1, price: 2, color: 0xff9fd0, shape: 'jar', eat: 'calm', desc: '말랑한 별 모양.' },
  bento: { name: '노래 도시락', cat: 'chill', base: 2.5, price: 5, color: 0xffd27a, shape: 'box', eat: 'full', desc: '빵·열매·향을 한 칸에.' },
  salad: { name: '이슬 샐러드', cat: 'chill', base: 1.4, price: 3, color: 0x9fe890, shape: 'box', eat: 'calm', desc: '잎채에 열매를 얹은 한 그릇.' },
  milk: { name: '구름젖', cat: 'dairy', base: 0.8, price: 2, color: 0xfaf8f0, shape: 'bottle', eat: 'calm', desc: '젖꽃깍지를 짠 하얀 젖.' },
  cream: { name: '구름 크림', cat: 'dairy', base: 1.4, price: 3, color: 0xfff4dc, shape: 'jar', desc: '구름젖을 저어 띄운 크림.' },
  curd: { name: '꽃두부', cat: 'dairy', base: 1.0, price: 2, color: 0xf6f0e0, shape: 'box', eat: 'full', desc: '깍지 젖을 굳힌 부드러운 덩이.' },
  icecream: { name: '별빙과', cat: 'frozen', base: 1.2, price: 3, color: 0xffd8f0, shape: 'box', eat: 'quick', desc: '혀에서 별이 녹는 얼음 과자.' },
  dumpling: { name: '얼린 결만두', cat: 'frozen', base: 1.5, price: 3, color: 0xf2e6d0, shape: 'box', eat: 'full', desc: '데우면 김이 노래하는 만두.' },
  chips: { name: '바삭 뿌리칩', cat: 'snack', base: 0.8, price: 2, color: 0xe8c070, shape: 'box', eat: 'quick', desc: '별뿌리를 얇게 구운 칩.' },
  candy: { name: '별사탕', cat: 'snack', base: 0.5, price: 1, color: 0xffb0e0, shape: 'jar', eat: 'quick', desc: '꽃꿀을 굳힌 작은 별.' },
  meal: { name: '노래 한 상', cat: 'dish', base: 2.5, price: 5, color: 0xffc46a, shape: 'flat', eat: 'full' },
  // ── 살림·몸단장 ──
  soap: { name: '울림 비누', cat: 'home', base: 0.9, price: 2, color: 0xbfefff, shape: 'box', desc: '거품이 작게 노래한다.' },
  cleaner: { name: '맑음 세정제', cat: 'home', base: 1.0, price: 2, color: 0x9fe8ff, shape: 'bottle', desc: '얼룩을 울려 떼어 내는 물.' },
  towel: { name: '결 수건', cat: 'home', base: 0.9, price: 2, color: 0xe8e0f8, shape: 'flat', desc: '부드러운 결 직물 수건.' },
  bowl: { name: '울림 그릇', cat: 'kitchen', base: 1.2, price: 3, color: 0xe0c0a8, shape: 'round', desc: '두드리면 맑게 운다.' },
  cup: { name: '울림 잔', cat: 'kitchen', base: 0.8, price: 2, color: 0xe8d0b8, shape: 'round', desc: '차를 따르면 소리가 달라진다.' },
  pot: { name: '빛 냄비', cat: 'kitchen', base: 3.0, price: 6, color: 0xa8b2c0, shape: 'box', desc: '바닥의 빛판이 데우는 냄비.' },
  garment: { name: '결 옷', cat: 'fashion', base: 3.0, price: 6, color: 0xb9a6ff, shape: 'flat', desc: '결 직물로 지은 옷.' },
  scarf: { name: '바람 목도리', cat: 'fashion', base: 1.6, price: 3, color: 0x9fd8ff, shape: 'flat', desc: '바람결을 따라 흔들린다.' },
  shoes: { name: '뜬신', cat: 'fashion', base: 2.4, price: 5, color: 0xd8c8f0, shape: 'box', desc: '바닥에서 살짝 뜨는 신.' },
  lotion: { name: '꽃결 바름', cat: 'beauty', base: 1.2, price: 3, color: 0xffd8e8, shape: 'jar', desc: '꽃꿀과 약초로 만든 바름약.' },
  perfume: { name: '울림 향수', cat: 'beauty', base: 2.2, price: 5, color: 0xf0b8ff, shape: 'bottle', desc: '뿌리면 은은한 화음이 남는다.' },
  // ── 선물·문구·장치 ──
  flower: { name: '울림꽃', cat: 'gift', base: 0.8, price: 2, color: 0xff9fd0, shape: 'flower', src: 'farm', desc: '주민에게 건네면 기뻐한다.' },
  trinket: { name: '노래 장신구', cat: 'gift', base: 2.0, price: 4, color: 0x7ff3e6, shape: 'crystal', desc: '작게 우는 장신구.' },
  giftbox: { name: '선물 꾸러미', cat: 'gift', base: 3.0, price: 6, color: 0xffc0a0, shape: 'box', desc: '과자와 꽃을 담은 꾸러미.' },
  notebook: { name: '결종이 공책', cat: 'paper', base: 0.8, price: 2, color: 0xe8e0d0, shape: 'flat', desc: '글자를 연습하기 좋은 공책.' },
  storybook: { name: '노래 이야기책', cat: 'paper', base: 2.0, price: 4, color: 0xd8b890, shape: 'box', desc: '아웬의 옛 노래를 엮은 책.' },
  pen: { name: '빛붓', cat: 'paper', base: 0.6, price: 1, color: 0x9ff6ff, shape: 'flat', desc: '빛으로 쓰는 붓.' },
  lantern: { name: '손등불', cat: 'device', base: 2.0, price: 4, color: 0xffd27a, shape: 'crystal', desc: '손에 드는 빛.' },
  lightorb: { name: '빛방울 등', cat: 'device', base: 1.8, price: 4, color: 0xfff0b0, shape: 'round', desc: '방 안에 띄우는 작은 빛.' },
  device: { name: '작은 공명기', cat: 'device', base: 4.0, price: 8, color: 0x9ff6ff, shape: 'box', desc: '멀리 있는 소리를 잇는다.' },
  earpiece: { name: '귀울림', cat: 'device', base: 3.0, price: 6, color: 0xb0c8ff, shape: 'round', desc: '귀에 거는 작은 공명기.' },
  tablet: { name: '손빛판', cat: 'device', base: 5.0, price: 10, color: 0x9ff6ff, shape: 'flat', desc: '손에 드는 울림판 단말.' },
  mapshard: { name: '지도 결정', cat: 'craft', base: 2.0, price: 4, color: 0x9fb8ff, shape: 'crystal' },
  part: { name: '장치 부품', cat: 'craft', base: 1.2, price: 3, color: 0xa8b2c0, shape: 'box', desc: '장치를 고칠 때 쓰는 부품.' },
  // ── 약·원예·놀이 ──
  medicine: { name: '고른울림 약', cat: 'med', base: 2.0, price: 4, color: 0x8ff0c0, shape: 'bottle', eat: 'calm', desc: '어지러운 울림을 고르게.' },
  bandage: { name: '결 붕대', cat: 'med', base: 0.8, price: 2, color: 0xf0f0f0, shape: 'flat', desc: '약초를 먹인 붕대.' },
  vitamin: { name: '기운 알약', cat: 'med', base: 0.8, price: 2, color: 0xffd070, shape: 'jar', eat: 'charged', desc: '열매와 약초를 졸인 알약.' },
  seeds: { name: '씨앗 봉지', cat: 'garden', base: 0.6, price: 1, color: 0xc8a870, shape: 'box', desc: '온실에 심을 씨앗.' },
  potplant: { name: '빛꽃 화분', cat: 'garden', base: 1.6, price: 4, color: 0xff9fd0, shape: 'flower', desc: '울림 흙 화분에 심은 꽃.' },
  fertilizer: { name: '땅울림 거름', cat: 'garden', base: 0.5, price: 1, color: 0x8a7050, shape: 'sack', desc: '밭을 깨우는 거름.' },
  toyorb: { name: '노래 구슬', cat: 'toys', base: 1.2, price: 3, color: 0xb8a0ff, shape: 'round', desc: '굴리면 노래하는 구슬.' },
  kite: { name: '바람연', cat: 'toys', base: 1.4, price: 3, color: 0x9ff6ff, shape: 'flat', desc: '바람결을 타는 연.' },
};
/** 가게 진열대 구역 (20가지) — 진열대마다 한 구역, 대형점은 층마다 묶어서 */
export const CATS = {
  fresh: '신선 과일·채소', bakery: '빵·과자', pantry: '곡물·면', spice: '양념·장', drink: '마실 것',
  chill: '반찬·도시락', dairy: '구름젖·크림', frozen: '얼음 칸', snack: '주전부리', home: '세정·생활',
  kitchen: '부엌살림', fashion: '옷·신', beauty: '몸단장', gift: '선물·꽃', paper: '문구·책',
  device: '장치·빛', craft: '부품·결정', med: '약·치유', garden: '원예·씨앗', toys: '놀이',
};

/** 공정: 공장 한 줄이 한 번 돌 때 (재료 → 만든 것, 기운 kWh 비슷한 빛 단위, 걸리는 시간 h) */
export const RECIPES = {
  mill: { name: '빛보리 빻기', in: { grain: 3 }, out: { flour: 3 }, energy: 1, hours: 1 },
  bakery: { name: '과자 굽기', in: { flour: 2, nectar: 1 }, out: { cookie: 4 }, energy: 2, hours: 1 },
  bread: { name: '빵 굽기', in: { flour: 2, fruit: 1 }, out: { bread: 3 }, energy: 2, hours: 1 },
  cake: { name: '케이크 굽기', in: { flour: 1, nectar: 1, cream: 1 }, out: { cake: 2 }, energy: 2, hours: 1 },
  noodle: { name: '국수 뽑기', in: { flour: 2 }, out: { noodle: 3 }, energy: 1, hours: 1 },
  tea: { name: '차 덖기', in: { tealeaf: 2 }, out: { tea: 3 }, energy: 1, hours: 1 },
  juice: { name: '즙 짜기', in: { fruit: 3 }, out: { juice: 2 }, energy: 1, hours: 1 },
  fizz: { name: '반짝물 깨우기', in: { brine: 1, nectar: 1 }, out: { fizz: 3 }, energy: 0.5, hours: 1 },
  jelly: { name: '젤리 굳히기', in: { nectar: 1, fruit: 1 }, out: { jelly: 2 }, energy: 1, hours: 1 },
  bento: { name: '도시락 싸기', in: { bread: 1, fruit: 1, spice: 1 }, out: { bento: 2 }, energy: 1, hours: 1 },
  salad: { name: '샐러드 담기', in: { leafveg: 2, fruit: 1 }, out: { salad: 2 }, energy: 0.5, hours: 1 },
  spice: { name: '향 씨앗 고르기', in: { herb: 1 }, out: { spice: 2 }, energy: 0.5, hours: 1 },
  sauce: { name: '장 익히기', in: { herb: 1, fruit: 1 }, out: { sauce: 2 }, energy: 0.5, hours: 1 },
  salt: { name: '소금 말리기', in: { brine: 2 }, out: { salt: 3 }, energy: 1, hours: 1 },
  milk: { name: '젖 짜기', in: { milkpod: 2 }, out: { milk: 3 }, energy: 0.5, hours: 1 },
  cream: { name: '크림 띄우기', in: { milk: 2 }, out: { cream: 1 }, energy: 0.5, hours: 1 },
  curd: { name: '두부 굳히기', in: { milkpod: 2 }, out: { curd: 2 }, energy: 0.5, hours: 1 },
  icecream: { name: '빙과 얼리기', in: { cream: 1, nectar: 1 }, out: { icecream: 3 }, energy: 1.5, hours: 1 },
  dumpling: { name: '만두 빚어 얼리기', in: { flour: 1, leafveg: 1, root: 1 }, out: { dumpling: 3 }, energy: 1.5, hours: 1 },
  chips: { name: '뿌리칩 굽기', in: { root: 2 }, out: { chips: 3 }, energy: 1, hours: 1 },
  candy: { name: '별사탕 굳히기', in: { nectar: 2 }, out: { candy: 4 }, energy: 1, hours: 1 },
  cloth: { name: '실 짜기', in: { fiber: 3 }, out: { cloth: 2 }, energy: 2, hours: 1 },
  garment: { name: '옷 짓기', in: { cloth: 2 }, out: { garment: 1 }, energy: 1, hours: 2 },
  scarf: { name: '목도리 뜨기', in: { cloth: 1 }, out: { scarf: 1 }, energy: 0.5, hours: 1 },
  shoes: { name: '뜬신 짓기', in: { cloth: 1, resin: 1 }, out: { shoes: 1 }, energy: 1, hours: 1 },
  towel: { name: '수건 짜기', in: { cloth: 1 }, out: { towel: 2 }, energy: 0.5, hours: 1 },
  shard: { name: '원석 설득', in: { ore: 2 }, out: { shard: 2 }, energy: 3, hours: 1 },
  panel: { name: '빛판 펴기', in: { ore: 1, resin: 1 }, out: { panel: 1 }, energy: 2, hours: 1 },
  lantern: { name: '등불 빚기', in: { shard: 2, resin: 1 }, out: { lantern: 1 }, energy: 2, hours: 1 },
  lightorb: { name: '빛방울 빚기', in: { shard: 1, panel: 1 }, out: { lightorb: 2 }, energy: 1.5, hours: 1 },
  trinket: { name: '장신구 다듬기', in: { shard: 1 }, out: { trinket: 1 }, energy: 1, hours: 1 },
  toyorb: { name: '노래 구슬 굴리기', in: { shard: 1, resin: 1 }, out: { toyorb: 2 }, energy: 1, hours: 1 },
  pen: { name: '빛붓 깎기', in: { resin: 1, shard: 1 }, out: { pen: 3 }, energy: 0.5, hours: 1 },
  device: { name: '공명기 짜기', in: { shard: 2, panel: 1, part: 1 }, out: { device: 1 }, energy: 3, hours: 2 },
  earpiece: { name: '귀울림 짜기', in: { part: 1, shard: 1 }, out: { earpiece: 1 }, energy: 1.5, hours: 1 },
  tablet: { name: '손빛판 짜기', in: { panel: 2, part: 1 }, out: { tablet: 1 }, energy: 2, hours: 2 },
  mapshard: { name: '지도 결정 새기기', in: { shard: 1, panel: 1 }, out: { mapshard: 1 }, energy: 2, hours: 1 },
  part: { name: '부품 깎기', in: { shard: 1, resin: 1 }, out: { part: 2 }, energy: 2, hours: 1 },
  pot: { name: '냄비 짜기', in: { part: 1, panel: 1 }, out: { pot: 1 }, energy: 2, hours: 1 },
  soap: { name: '비누 굳히기', in: { resin: 1, nectar: 1 }, out: { soap: 2 }, energy: 1, hours: 1 },
  cleaner: { name: '세정제 섞기', in: { resin: 1, herb: 1 }, out: { cleaner: 2 }, energy: 1, hours: 1 },
  bowl: { name: '그릇 굽기', in: { clay: 2 }, out: { bowl: 2 }, energy: 1.5, hours: 1 },
  cup: { name: '잔 굽기', in: { clay: 1 }, out: { cup: 2 }, energy: 1, hours: 1 },
  giftbox: { name: '꾸러미 싸기', in: { cookie: 2, flower: 1 }, out: { giftbox: 1 }, energy: 0.3, hours: 1 },
  medicine: { name: '약 달이기', in: { herb: 2, nectar: 1 }, out: { medicine: 2 }, energy: 1, hours: 1 },
  bandage: { name: '붕대 적시기', in: { cloth: 1, herb: 1 }, out: { bandage: 3 }, energy: 0.5, hours: 1 },
  vitamin: { name: '알약 졸이기', in: { fruit: 1, herb: 1 }, out: { vitamin: 3 }, energy: 0.5, hours: 1 },
  lotion: { name: '바름약 개기', in: { nectar: 1, herb: 1 }, out: { lotion: 2 }, energy: 0.5, hours: 1 },
  perfume: { name: '향수 거르기', in: { flower: 2, resin: 1 }, out: { perfume: 2 }, energy: 1, hours: 1 },
  paper: { name: '종이 뜨기', in: { fiber: 2 }, out: { paper: 3 }, energy: 1, hours: 1 },
  notebook: { name: '공책 매기', in: { paper: 2 }, out: { notebook: 2 }, energy: 0.5, hours: 1 },
  storybook: { name: '이야기책 엮기', in: { paper: 3 }, out: { storybook: 1 }, energy: 0.5, hours: 1 },
  kite: { name: '연 만들기', in: { cloth: 1, fiber: 1 }, out: { kite: 1 }, energy: 0.5, hours: 1 },
  potplant: { name: '화분 심기', in: { flower: 1, clay: 1 }, out: { potplant: 1 }, energy: 0.3, hours: 1 },
  fertilizer: { name: '거름 삭히기', in: { herb: 1, grain: 1 }, out: { fertilizer: 3 }, energy: 0.5, hours: 1 },
  seeds: { name: '씨앗 받기', in: { flower: 1, grain: 1 }, out: { seeds: 4 }, energy: 0.3, hours: 1 },
};
/** 공장 종류 → 돌리는 공정 묶음 (공장마다 씨앗으로 하나) */
export const LINES = {
  food: ['mill', 'bakery', 'bread', 'cake', 'noodle'], drink: ['tea', 'juice', 'jelly', 'fizz'], meal: ['bento', 'spice', 'bread', 'salad', 'sauce'],
  dairy: ['milk', 'cream', 'curd', 'icecream'], snackline: ['chips', 'candy', 'dumpling', 'salt'],
  textile: ['cloth', 'garment', 'scarf', 'shoes', 'towel'], crystal: ['shard', 'lantern', 'trinket', 'toyorb', 'pen'], tech: ['panel', 'part', 'device', 'mapshard', 'earpiece', 'tablet', 'lightorb', 'pot'],
  home: ['soap', 'cleaner', 'bowl', 'cup', 'giftbox'], pharma: ['medicine', 'spice', 'bandage', 'vitamin', 'lotion', 'perfume'],
  paper: ['paper', 'notebook', 'storybook', 'kite'], garden: ['fertilizer', 'potplant', 'seeds'],
};
/** 농장이 기르는 것 (재배원 씨앗으로 둘) */
export const CROPS = ['grain', 'tealeaf', 'fruit', 'nectar', 'fiber', 'herb', 'flower', 'leafveg', 'root', 'milkpod'];
/** 채굴·샘이 내는 것 */
export const MINED = ['ore', 'resin', 'fuel', 'brine', 'clay'];
/** 가게 진열대 구역 → 놓는 물건 */
export const SHELF_GOODS = {
  fresh: ['fruit', 'leafveg', 'root'], bakery: ['bread', 'cookie', 'cake'], pantry: ['flour', 'noodle', 'grain'], spice: ['spice', 'sauce', 'salt'], drink: ['tea', 'juice', 'fizz'],
  chill: ['bento', 'salad', 'jelly'], dairy: ['milk', 'cream', 'curd'], frozen: ['icecream', 'dumpling'], snack: ['chips', 'candy', 'cookie'], home: ['soap', 'cleaner', 'towel'],
  kitchen: ['bowl', 'cup', 'pot'], fashion: ['garment', 'scarf', 'shoes'], beauty: ['lotion', 'perfume'], gift: ['flower', 'trinket', 'giftbox'], paper: ['notebook', 'storybook', 'pen'],
  device: ['lightorb', 'lantern', 'earpiece', 'device', 'tablet'], craft: ['part', 'shard', 'mapshard', 'panel', 'cloth'], med: ['medicine', 'bandage', 'vitamin'], garden: ['seeds', 'potplant', 'fertilizer'], toys: ['toyorb', 'kite'],
};
/** 주민 한 사람이 하루에 쓰는 것 (가게에서 산다) */
export const DEMAND = {
  bread: 0.3, fruit: 0.35, tea: 0.22, cookie: 0.15, juice: 0.12, jelly: 0.06, bento: 0.1, flour: 0.04, spice: 0.03, soap: 0.04, garment: 0.01, lantern: 0.008, trinket: 0.01, flower: 0.05, medicine: 0.02, seeds: 0.01, part: 0.005, device: 0.002,
  leafveg: 0.18, root: 0.12, cake: 0.04, noodle: 0.1, grain: 0.02, sauce: 0.03, salt: 0.02, fizz: 0.1, salad: 0.06, milk: 0.12, cream: 0.02, curd: 0.04, icecream: 0.04, dumpling: 0.05, chips: 0.07, candy: 0.04,
  cleaner: 0.025, towel: 0.008, bowl: 0.004, cup: 0.005, pot: 0.002, scarf: 0.004, shoes: 0.003, lotion: 0.015, perfume: 0.006, giftbox: 0.008, notebook: 0.008, storybook: 0.004, pen: 0.008,
  lightorb: 0.003, earpiece: 0.0015, tablet: 0.0008, bandage: 0.008, vitamin: 0.015, potplant: 0.003, fertilizer: 0.004, toyorb: 0.005, kite: 0.002, shard: 0.003, mapshard: 0.001, panel: 0.001, cloth: 0.003,
};

/** 물건 → 그것을 만드는 공정 (첫 번째) */
export const MAKER = (() => { const m = {}; for (const [rk, R] of Object.entries(RECIPES)) for (const k of Object.keys(R.out)) if (!m[k]) m[k] = rk; return m; })();
/**
 * 한 사람이 하루에 쓰는 것을 만들려면 하루에 무엇이 얼마나 필요한가 (재료까지 거슬러): { 물건: 수 }.
 * 농장·채굴의 거둠, 공장의 공정 힘, 발전소의 빛을 이 수에 맞춰 잡는다 (econ.js) — 물건은 이 사슬로만 생긴다.
 */
export const PER_CAPITA = (() => {
  const need = {};
  const add = (k, n, depth = 0) => {
    need[k] = (need[k] || 0) + n;
    const rk = MAKER[k];
    if (!rk || depth > 8) return;
    const R = RECIPES[rk], per = n / R.out[k];
    for (const [i, v] of Object.entries(R.in)) add(i, per * v, depth + 1);
  };
  for (const [k, d] of Object.entries(DEMAND)) add(k, d);
  return need;
})();
/** 공정의 깊이 (원료에서 몇 단계) — 재료가 되는 것부터 돌린다 */
export const RECIPE_ORDER = (() => {
  const depth = {};
  const dOf = (k, seen = 0) => { const rk = MAKER[k]; if (!rk || seen > 8) return 0; return 1 + Math.max(0, ...Object.keys(RECIPES[rk].in).map((i) => dOf(i, seen + 1))); };
  for (const rk of Object.keys(RECIPES)) depth[rk] = Math.max(...Object.keys(RECIPES[rk].out).map((k) => dOf(k)));
  return Object.keys(RECIPES).sort((a, b) => depth[a] - depth[b]);
})();

