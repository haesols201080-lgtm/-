// 도시 건물이 실제로 하는 일: 물건·음식·효과·전시·기록·일거리.
// (game/venues.js 가 읽는다. 건물 쓰임은 game/interiors.js 의 PURPOSE, 쓰임마다의 시설은 venues.js 의 BUILD)

// ── 가방에 들어가는 것 ─────────────────────────────
// use: eat(먹으면 buff) · gift(주민 선물) · map(지도 밝히기) · read(읽으면 말) / price: 가게 값(울) / sell: 되팔 값
export const ITEMS = {
  fruit: { name: '빛열매', tag: '먹을 것', desc: '한 입 베어 물면 잠깐 발이 가벼워진다. 주민과 나눠 먹을 수도 있다.', price: 1, sell: 0, use: 'eat', buff: 'quick', icon: '●' },
  cookie: { name: '바람과자', tag: '먹을 것', desc: '바삭한 과자. 먹으면 4분 동안 더 빨리 달린다.', price: 2, use: 'eat', buff: 'quick', icon: '◆' },
  tea: { name: '울림차', tag: '먹을 것', desc: '김이 노래하는 차. 마시면 5분 동안 활공이 더 멀리 간다.', price: 3, use: 'eat', buff: 'glide', icon: '◐' },
  meal: { name: '노래 한 상', tag: '먹을 것', desc: '든든한 한 끼. 10분 동안 달리기와 활공이 조금씩 좋아진다.', price: 5, use: 'eat', buff: 'full', icon: '◎' },
  flower: { name: '울림꽃', tag: '선물', desc: '주민에게 선물하면 기뻐한다.', price: 2, sell: 1, use: 'gift', icon: '✿' },
  trinket: { name: '노래 장신구', tag: '선물', desc: '작은 결정에 노래 한 소절이 들어 있다. 귀한 선물.', price: 4, sell: 2, use: 'gift', icon: '✧' },
  lantern: { name: '손등불', tag: '만든 것', desc: '빚음 공방에서 직접 빚은 등불. 선물하거나 가게에 팔 수 있다.', sell: 3, use: 'gift', icon: '✦' },
  mapshard: { name: '지도 결정', tag: '도구', desc: '쓰면 가까운 못 가 본 곳의 지도가 밝혀진다.', price: 4, use: 'map', icon: '◇' },
  book: { name: '빌린 기록 결정', tag: '책', desc: '서고에서 빌린 기록. 읽으면 말 하나를 배우고, 다 읽으면 사라진다.', use: 'read', icon: '▤' },
  shard: { name: '결정 조각', tag: '재료', desc: '장비를 손보는 재료 (울림 공방). 연구동 실험에서 얻는다.', sell: 2, icon: '◈' },
  starseed: { name: '울', tag: '돈', desc: '세렌의 화폐 단위. 울림판에 새겨 세는 고마움의 셈 — 일하면 받고, 가게에서 쓴다.', icon: '◎' },
  seedstar: { name: '별씨', tag: '재료', desc: '별비가 내린 밤과 생명나무에서 줍는 빛 씨앗. 온실에 심으면 빛꽃이 피고, 장인 온이 녹여 장비를 손본다.', icon: '✶' },
};
export const BAG_ORDER = ['starseed', 'seedstar', 'meal', 'tea', 'cookie', 'fruit', 'flower', 'trinket', 'lantern', 'mapshard', 'book', 'shard'];

// ── 몸의 기운 (먹거나 치유받으면 잠깐) ─────────────
export const BUFFS = {
  quick: { name: '가벼운 발', dur: 240, speed: 1.18 },
  glide: { name: '울림차 기운', dur: 300, glide: 1.35 },
  full: { name: '든든함', dur: 600, speed: 1.08, glide: 1.12 },
  calm: { name: '맑은 울림', dur: 480, speed: 1.05, glide: 1.2 },
  charged: { name: '공명 충전', dur: 300, speed: 1.12, glide: 1.15 },
};

// ── 가게 진열대: 칸마다 파는 것 ─────────────────
export const SHELVES = [
  { name: '먹을 것 칸', items: ['fruit', 'cookie', 'tea'], color: 0xffc46a },
  { name: '선물 칸', items: ['flower', 'trinket'], color: 0xff9fd0 },
  { name: '길잡이 칸', items: ['mapshard', 'tea'], color: 0x7ff3e6 },
];

// ── 찻집·식당 차림표 (cook: 짓는 데 걸리는 초) ───
export const MENU = [
  { id: 'tea', cook: 4 },
  { id: 'cookie', cook: 3 },
  { id: 'meal', cook: 7 },
];

// ── 박물관 전시 (박물관마다 이 가운데 6가지가 놓인다) ──
// word: 살펴보면 배우는 말 (이미 알면 넘어감)
export const EXHIBITS = [
  { id: 'resonator', title: '첫 공명기', era: '처음의 시대', text: '아웬이 처음으로 돌의 노래를 들은 날 깎은 도구. 이 작은 소리굽쇠 하나로 아웬은 물질을 부수지 않고 설득하는 법을 배웠다.', word: 'old', color: 0xffd27a },
  { id: 'spine-seed', title: '척추의 씨앗', era: '고리의 시대', text: '하늘닻까지 이어진 승강줄은 이 결정 씨앗 하나에서 자랐다. 3백 년 동안 합창이 끊이지 않았다고 한다.', word: 'grow', color: 0x7ff3e6 },
  { id: 'first-song', title: '첫 이름 노래', era: '처음의 시대', text: '아이가 태어나면 부모는 여섯 음으로 이름을 지어 부른다. 이것은 기록에 남은 가장 오래된 이름 노래의 결정이다.', word: 'name', color: 0xff9fd0 },
  { id: 'silence', title: '들음의 해', era: '대답 이전', text: '공명탑을 「듣는 쪽」으로 돌린 해의 기록. 떠 있던 섬들은 쉬려고 내려앉고, 먼 해류도 잠시 쉬었다. 아웬은 그동안 탑 대신 노래했다.', word: 'story', color: 0x9aa4c8 },
  { id: 'ur-map', title: '우르의 지도', era: '고리의 시대', text: '가스행성 우르의 띠와 폭풍을 노래로 적은 지도. 띠마다 다른 음으로 울린다.', word: 'ur', color: 0xffc46a },
  { id: 'whale-bone', title: '하늘고래의 노래 뼈', era: '언제나', text: '하늘고래가 떠난 자리에 남은 가벼운 뼈. 바람이 지나면 지금도 고래의 노래가 난다.', word: 'whale', color: 0xbfeff8 },
  { id: 'loom', title: '빛 베틀', era: '빚음의 시대', text: '빛으로 천을 짜던 베틀. 지금 도시의 유리는 모두 이 베틀의 후손이다.', word: 'build', color: 0xb9a6ff },
  { id: 'chorus-stone', title: '합창돌', era: '고리의 시대', text: '천 명이 한목소리로 노래해 띄운 돌. 공중다리와 떠 있는 섬은 이 기술로 세워졌다.', word: 'chorus', color: 0x7ff3e6 },
  { id: 'ship-model', title: '첫 하늘배', era: '바다의 시대', text: '처음으로 바다를 건넌 하늘배의 본. 돛 대신 노래하는 고리가 달려 있다.', word: 'ship', color: 0xffd27a },
  { id: 'healer-bowl', title: '치유사의 그릇', era: '언제나', text: '지친 울림을 고르게 다듬던 그릇. 그릇을 두드리면 몸의 음이 제자리로 돌아온다고 믿었다.', word: 'heal', color: 0xff9fd0 },
  { id: 'harvest', title: '첫 빛열매', era: '들의 시대', text: '들에서 처음 거둔 빛열매를 결정에 담았다. 아웬은 지금도 첫 열매를 이웃과 나눈다.', word: 'share', color: 0xffc46a },
  { id: 'courier-pack', title: '소식꾼의 가방', era: '바다의 시대', text: '탑과 탑 사이로 소식을 나르던 소식꾼의 가방. 안에는 아직 전하지 못한 노래가 하나 들어 있다.', word: 'carry', color: 0xc8c2d2 },
  { id: 'star-lens', title: '별 렌즈', era: '고리의 시대', text: '별듣는 탑에서 쓰던 렌즈. 별빛을 소리로 바꿔 들었다.', word: 'star', color: 0xbffcff },
  { id: 'ice-flute', title: '얼음 피리', era: '흰 숨의 시대', text: '흰 숨의 얼음 바다에서 만든 피리. 우르의 소리를 따라 부르려 했다.', word: 'ice', color: 0xdff6ff },
  { id: 'colossus-key', title: '거신의 열쇠', era: '느린땅의 시대', text: '걷는 도시 거신을 깨우던 열쇠 노래의 악보. 일곱 음을 한 번에 울려야 한다.', word: 'great', color: 0xc9a86c },
  { id: 'echo-jar', title: '메아리 단지', era: '언제나', text: '사라진 사람의 마지막 노래를 담아 두는 단지. 기억은 노래로 남는다.', word: 'memory', color: 0xb9a6ff },
];

// ── 서고의 기록 결정 (읽으면 말 하나) ─────────────
export const ARCHIVES = [
  { id: 'a-founding', title: '하모네아를 세운 날', text: '첫 합창단이 고원에 모여 사흘 밤낮을 노래하자 땅이 둥글게 솟았다. 그 둥근 땅이 지금의 하모네아다.', word: 'first' },
  { id: 'a-rings', title: '왜 고리 거리인가', text: '소리는 둥글게 퍼진다. 그래서 아웬은 도시를 동심원으로 짓는다. 같은 고리에 사는 이웃은 같은 메아리를 듣는다.', word: 'ring' },
  { id: 'a-trade', title: '나눔의 법', text: '아웬은 물건을 사고팔지 않고 나눈다. 울은 값이 아니라 고마움을 세는 셈이다. 쓴 울은 품삯과 나눔으로 다시 이웃에게 돈다.', word: 'share' },
  { id: 'a-work', title: '일의 노래', text: '공방·창고·발전소의 일꾼은 일하면서 노래한다. 일마다 박자가 달라서, 일하는 소리만 들어도 무슨 일인지 안다.', word: 'work' },
  { id: 'a-sleep', title: '쉬는 탑', text: '오래 노래한 탑은 한동안 귀만 열고 쉰다. 그동안에는 사람들이 대신 노래한다.', word: 'sleep' },
  { id: 'a-ships', title: '하늘배 길잡이', text: '하늘배는 해류를 따라 난다. 길잡이는 바람의 음을 듣고 배를 이끈다.', word: 'wind' },
  { id: 'a-children', title: '아이들의 학교', text: '아이는 다섯 살이 되면 처음으로 자기 이름을 노래한다. 학교의 첫 수업은 언제나 자기 이름이다.', word: 'learn' },
  { id: 'a-heal', title: '울림 치유', text: '아픈 것은 음이 어긋난 것이다. 치유사는 어긋난 음을 찾아 고르게 다듬는다.', word: 'heal' },
  { id: 'a-build', title: '탑을 짓는 법', text: '탑은 쌓지 않고 기른다. 결정 씨앗에 노래를 들려주면 씨앗이 스스로 자라 탑이 된다.', word: 'build' },
  { id: 'a-old', title: '옛 노래의 결정', text: '아주 옛날 노래는 결정에 담겨 서고에 머문다. 결정을 손에 쥐면 그 노래가 들린다.', word: 'old' },
];

// ── 건물마다 일하는 노래 (일할 때 흘러나오는 음) ──
export const WORK_TUNES = {
  factory: [0, 2, 4, 2],
  depot: [1, 3, 1, 3],
  plant: [0, 0, 4, 4],
  lab: [2, 4, 3],
};

// ── 들어갈 수 없는 건물의 바깥 조작대 (건물 발치의 빛 기둥) ──
// fn: game/outdoors.js 의 쓰임. tower 는 건물의 쓰임(use)에 따라: home → 주민 부탁함, office → 일거리 게시판
export const OUTDOOR = {
  padtower: { fn: 'taxi', name: '하늘배 승강탑', label: '하늘배 부르기 · 도시 위로 날아가기', short: '하늘배' },
  branchport: { fn: 'drones', name: '가지 항구', label: '짐 드론 관제 · 들어오는 드론 받기', short: '관제' },
  coiltower: { fn: 'charge', name: '코일 탑', label: '공명 충전 · 몸에 기운 받기', short: '충전' },
  conduit: { fn: 'maint', name: '공명 도관', label: '도관 점검 · 압력 고르기', short: '점검' },
  cooler: { fn: 'maint', name: '식힘 탑', label: '식힘 탑 점검 · 압력 고르기', short: '점검' },
  tanks: { fn: 'maint', name: '저장 탱크', label: '탱크 점검 · 압력 고르기', short: '점검' },
  antenna: { fn: 'signal', name: '울림 안테나', label: '먼 신호 듣기', short: '듣기' },
  treeform: { fn: 'harvest', name: '생장 나무', label: '생장 나무 · 열매 거두기', short: '거두기' },
  gate: { fn: 'guide', name: '구역의 문', label: '도시 안내판 · 길 찾기', short: '안내' },
  twin: { fn: 'tower', name: '쌍둥이 탑', short: '부탁함' },
  triad: { fn: 'tower', name: '세 갈래 탑', short: '부탁함' },
  stilt: { fn: 'tower', name: '물 위 집', short: '부탁함' },
  lm_port: { fn: 'mark', name: '하늘 나루', label: '하늘 나루 · 출항과 승강판', short: '나루' },
  lm_ear: { fn: 'mark', name: '별귀 탑', label: '별귀 탑 · 하늘 듣기와 승강판', short: '별귀' },
  lm_coil: { fn: 'mark', name: '울림 코일 탑', label: '울림 코일 탑 · 조율과 승강판', short: '코일' },
  lm_garden: { fn: 'mark', name: '매달린 정원', label: '매달린 정원 · 열매와 승강판', short: '정원' },
  lm_tree: { fn: 'mark', name: '생명나무', label: '생명나무 · 별씨와 승강판', short: '생명나무' },
};

// ── 주민 부탁함: 탑에 사는 주민이 날마다 하나씩 부탁한다 (가져다주면 고마움 = 울) ──
// where: 어디서 구하는지 (안내)
export const WISHES = [
  { item: 'fruit', n: 2, why: '아이 생일이라 빛열매가 모자라요', where: '가게 「먹을 것 칸」', reward: 4 },
  { item: 'tea', n: 1, why: '목이 쉬어 노래를 못 해요. 울림차 한 잔이면 나을 텐데', where: '가게·찻집', reward: 5 },
  { item: 'flower', n: 1, why: '이웃에게 사과하고 싶어요. 울림꽃 한 송이면…', where: '가게 「선물 칸」·정원 돌보기', reward: 4 },
  { item: 'cookie', n: 2, why: '손님이 와요. 바람과자 두 개만 구해 줄래요?', where: '가게·찻집', reward: 6 },
  { item: 'lantern', n: 1, why: '창가에 둘 등불이 깨졌어요', where: '빚음 공방 생산 줄', reward: 7 },
  { item: 'meal', n: 1, why: '하루 종일 일해서 밥 지을 기운이 없어요', where: '찻집', reward: 8 },
  { item: 'shard', n: 1, why: '집의 노래 장치가 고장 났어요. 결정 조각 하나면 고칠 수 있어요', where: '연구동 실험', reward: 6 },
  { item: 'trinket', n: 1, why: '오래 떨어져 지낸 동생에게 보낼 선물이 필요해요', where: '가게 「선물 칸」·박물관 기념품', reward: 9 },
];

// ── 구역 이름 (안내판·터미널) ──
export const ZONE_NAMES = { 'cap-core': '하모네아 한가운데', 'dist-east': '새벽 구역', 'dist-sw': '물결 구역', 'dist-west': '포자 구역', 'dist-north': '별바라기 구역', 'cap-suburb': '하모네아 교외', 'town-dew': '이슬터', 'town-yun': '윤슬', 'town-gat': '갓마을', 'town-tte': '떠돌섬', 'town-mul': '물노래', 'town-obs': '별듣는 마을', 'far-rift': '깊은목', 'far-plains': '느린땅', 'far-ice': '흰 숨', 'far-falls': '천 폭포 고원' };

// ── 안내판의 길 찾기: 실내 쓰임 → 이름 ──
export const FIND = [
  ['market', '가게'], ['cafe', '찻집'], ['museum', '박물관'], ['school', '노래 학교'], ['heal', '치유원'], ['library', '서고'],
  ['lab', '연구동'], ['factory', '빚음 공방'], ['depot', '물류 창고'], ['terminal', '터미널'], ['office', '사무탑'], ['hall', '공연장'], ['garden', '정원'], ['plant', '공명 발전소'],
];
