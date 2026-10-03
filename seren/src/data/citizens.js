// 도시의 주민: 이름 · 하는 일(자리 종류) · 하루 일과 · 하는 말 · 함께 할 수 있는 것
// (game/citizens.js 가 읽는다. 자리는 world/cityplan.js 의 템플릿이 블록마다 놓는다)

// 이름: 두 음절 (아웬의 이름은 노래 두 마디)
export const SYL_A = ['라', '세', '이', '루', '미', '아', '하', '노', '린', '솔', '유', '키', '테', '벨', '오', '나', '레', '시', '마', '로', '휘', '단', '에', '파', '소', '가', '도', '비'];
export const SYL_B = ['온', '린', '엘', '아', '루', '하', '미', '나', '솔', '윤', '라', '세', '오', '빈', '란', '울', '결', '담', '별', '은', '휘', '닐', '연', '로'];

// 자리 종류 → 하는 일. hours: 그 자리에 있는 시각 [시작, 끝] (하루 0~1, 0.5 = 정오. 끝이 1 을 넘으면 다음 날로)
// n: 한 자리에 머무는 사람 수 [최소, 최대]. age: 'child' 면 아이. play: 함께 할 수 있는 것
export const ROLES = {
  sell: { label: '장터지기', verb: '물건을 나누는 중', hours: [[0.29, 0.79]], n: [1, 1], play: 'trade' },
  tend: { label: '정원지기', verb: '꽃을 돌보는 중', hours: [[0.24, 0.56], [0.62, 0.72]], n: [1, 2], play: 'garden' },
  play: { label: '아이', verb: '놀이 중', hours: [[0.5, 0.78]], n: [3, 5], age: 'child', play: 'tag' },
  music: { label: '악사', verb: '노래하는 중', hours: [[0.55, 0.9]], n: [1, 1], play: 'song', listeners: [2, 4] },
  listen: { label: '듣는 이', verb: '노래를 듣는 중', hours: [], n: [0, 0] },
  chat: { label: '이웃', verb: '이야기하는 중', hours: [[0.42, 0.84]], n: [2, 3] },
  sit: { label: '쉬는 이', verb: '쉬는 중', hours: [[0.36, 0.82]], n: [1, 1] },
  meditate: { label: '울림 수행자', verb: '고요를 듣는 중', hours: [[0.21, 0.31], [0.84, 0.9]], n: [3, 6], age: 'elder', play: 'meditate' },
  stroll: { label: '산책하는 이', verb: '산책 중', hours: [[0.33, 0.86]], n: [1, 2] },
  carry: { label: '짐꾼', verb: '짐을 나르는 중', hours: [[0.3, 0.7]], n: [1, 1], play: 'carry' },
  console: { label: '기술자', verb: '장치를 살피는 중', hours: [[0.28, 0.72]], n: [1, 1], play: 'tune' },
  inspect: { label: '점검원', verb: '점검 중', hours: [[0.3, 0.7]], n: [1, 1] },
  wait: { label: '기다리는 이', verb: '호버 차를 기다리는 중', hours: [[0.27, 0.35], [0.64, 0.75]], n: [1, 2] },
  observe: { label: '별 관측자', verb: '하늘을 보는 중', hours: [[0.8, 1.2]], n: [1, 2], play: 'tune' },
};

// 건물 안에서 하는 일 (interiors 가 가구 둘레에 자리를 놓는다)
export const INDOOR = {
  cook: { label: '요리하는 이', verb: '저녁을 짓는 중', play: 'meal' },
  eat: { label: '식구', verb: '밥을 먹는 중', play: 'meal' },
  kidplay: { label: '아이', verb: '노는 중', play: 'kidplay' },
  read: { label: '책 읽는 이', verb: '옛 노래를 읽는 중' },
  sleep: { label: '잠든 이', verb: '자는 중' },
  clerk: { label: '사무원', verb: '일을 나누는 중' },
  research: { label: '연구원', verb: '물질의 노래를 듣는 중', play: 'tune' },
  teach: { label: '선생님', verb: '노래를 가르치는 중', play: 'lesson' },
  student: { label: '학생', verb: '수업 중', play: 'lesson' },
  heal: { label: '치유사', verb: '울림을 고르는 중', play: 'heal' },
  patient: { label: '쉬는 이', verb: '쉬는 중' },
  shop: { label: '가게지기', verb: '물건을 나누는 중', play: 'trade' },
  sing: { label: '합창단', verb: '노래하는 중', play: 'song' },
  garden: { label: '정원지기', verb: '꽃을 돌보는 중' },
  work: { label: '일꾼', verb: '일하는 중' },
  guest: { label: '손님', verb: '둘러보는 중' },
  curator: { label: '전시 해설사', verb: '전시를 안내하는 중', play: 'tour' },
};

// 주민의 말 (단어 id 배열 + 한국어) — 하는 일마다, 그리고 시각·친한 정도에 따라
export const CIT_LINES = {
  sell: [
    { words: ['light', 'flower', 'good', '.', 'you', 'see', '?'], ko: '빛꽃이 좋아. 볼래?' },
    { words: ['eat', 'together', ',', 'friend'], ko: '같이 먹자, 벗이여.' },
    { words: ['seed', 'give', ',', 'i', 'give', 'flower'], ko: '별씨를 주면 꽃을 줄게.' },
    { words: ['day', 'long', '.', 'all', 'come', 'eat'], ko: '긴 낮이야. 모두 먹으러 와.' },
  ],
  tend: [
    { words: ['flower', 'grow', 'long', 'time'], ko: '꽃은 오래 걸려 자라.' },
    { words: ['water', 'flow', ',', 'flower', 'joy'], ko: '물이 흐르면 꽃이 기뻐해.' },
    { words: ['you', 'water', 'give', '?'], ko: '물을 줄래?' },
    { words: ['seed', 'sleep', 'land', '.', 'we', 'wake'], ko: '씨앗은 땅에서 잠들고, 우리가 깨워.' },
  ],
  play: [
    { words: ['play', '!', 'you', 'catch', 'we', '?'], ko: '놀자! 우리 잡을 수 있어?' },
    { words: ['you', 'small', 'star', '!', 'play', 'together'], ko: '작은 별이다! 같이 놀자.' },
    { words: ['run', 'run', '!', 'joy'], ko: '달려, 달려! 신나!' },
    { words: ['catch', 'i', '?', 'no', '!'], ko: '나 잡을 수 있어? 못 잡지!' },
  ],
  music: [
    { words: ['listen', '.', 'song', 'flow'], ko: '들어 봐. 노래가 흐른다.' },
    { words: ['you', 'sing', 'together', '?'], ko: '같이 부를래?' },
    { words: ['song', 'answer', 'song'], ko: '노래는 노래로 대답하지.' },
    { words: ['night', 'chorus', 'come', 'all'], ko: '밤에는 모두 모여 합창이야.' },
  ],
  chat: [
    { words: ['day', 'good', '.', 'wind', 'flow'], ko: '좋은 날이야. 바람이 흘러.' },
    { words: ['you', 'where', 'go', '?'], ko: '어디 가는 길이야?' },
    { words: ['child', 'learn', 'song', 'first'], ko: '아이가 첫 노래를 배웠어.' },
    { words: ['tower', 'sing', '.', 'joy', 'all'], ko: '탑이 노래해. 모두 기뻐해.' },
  ],
  sit: [
    { words: ['rest', 'good', '.'], ko: '쉬는 건 좋아.' },
    { words: ['see', 'sky', '.', 'ring', 'light'], ko: '하늘을 봐. 고리가 빛나.' },
    { words: ['work', 'long', '.', 'tired'], ko: '일이 길었어. 지쳤어.' },
  ],
  meditate: [
    { words: ['still', '.', 'listen', 'world'], ko: '고요히. 세계를 들어.' },
    { words: ['heart', 'still', ',', 'song', 'near'], ko: '마음이 고요하면 노래가 가까워.' },
    { words: ['you', 'still', 'together', '?'], ko: '같이 고요해질래?' },
  ],
  stroll: [
    { words: ['walk', 'good', '.', 'flower', 'see'], ko: '걷기 좋아. 꽃을 봐.' },
    { words: ['path', 'long', ',', 'heart', 'near'], ko: '길은 길어도 마음은 가까워.' },
  ],
  carry: [
    { words: ['work', 'work', '!', 'ship', 'wait'], ko: '일, 일! 배가 기다려.' },
    { words: ['you', 'work', 'together', '?'], ko: '같이 일할래?' },
    { words: ['far', 'home', 'go', '.', 'we', 'give'], ko: '먼 집으로 가는 짐이야. 우리가 보내 줘.' },
  ],
  console: [
    { words: ['core', 'song', 'listen', '.'], ko: '핵의 노래를 듣고 있어.' },
    { words: ['make', 'light', ',', 'make', 'path'], ko: '빛을 빚고, 길을 빚어.' },
    { words: ['you', 'song', 'give', '?'], ko: '노래를 맞춰 줄래?' },
  ],
  inspect: [
    { words: ['all', 'good', '.', 'flow', 'here'], ko: '다 좋아. 흐름이 여기 있어.' },
  ],
  wait: [
    { words: ['ship', 'come', 'near', '.'], ko: '배가 곧 와.' },
    { words: ['i', 'go', 'far', 'home'], ko: '나는 먼 집으로 가.' },
  ],
  observe: [
    { words: ['star', 'far', 'listen', '.'], ko: '먼 별이 듣고 있어.' },
    { words: ['ur', 'great', '.', 'see', '!'], ko: '우르는 크지. 봐!' },
    { words: ['you', 'star', 'where', '?'], ko: '너의 별은 어디야?' },
  ],
  listen: [
    { words: ['song', 'good', '.', 'joy'], ko: '노래가 좋아. 기뻐.' },
  ],
  // 건물 안
  cook: [{ words: ['eat', 'together', '!', 'friend'], ko: '같이 먹자, 벗이여!' }, { words: ['home', 'good', '.', 'rest'], ko: '집은 좋아. 쉬어.' }],
  eat: [{ words: ['child', 'play', ',', 'we', 'eat'], ko: '아이는 놀고, 우리는 먹지.' }, { words: ['eat', 'good', '!', 'joy'], ko: '맛있어! 기뻐.' }],
  kidplay: [{ words: ['play', '!', 'play', '!'], ko: '놀자! 놀자!' }, { words: ['you', 'star', '?', 'play', 'together'], ko: '별이야? 같이 놀자.' }],
  read: [{ words: ['memory', 'song', 'long', '.'], ko: '기억의 노래는 길어.' }],
  sleep: [{ words: ['sleep', '.', 'still'], ko: '자는 중… 쉿.' }],
  clerk: [{ words: ['work', 'flow', ',', 'all', 'good'], ko: '일이 흐르면 모두 좋아.' }],
  research: [{ words: ['crystal', 'song', 'listen', '.'], ko: '결정의 노래를 듣고 있어.' }, { words: ['you', 'song', 'give', '?'], ko: '노래를 맞춰 줄래?' }],
  teach: [{ words: ['learn', 'song', 'first', '.'], ko: '첫 노래를 배워.' }, { words: ['you', 'learn', 'together', '?'], ko: '같이 배울래?' }],
  student: [{ words: ['i', 'learn', '!', 'joy'], ko: '나 배우는 중! 신나.' }],
  heal: [{ words: ['heart', 'still', '.', 'rest'], ko: '마음을 고요히. 쉬어.' }],
  patient: [{ words: ['rest', 'good', '.'], ko: '쉬니까 좋아.' }],
  shop: [{ words: ['flower', 'eat', ',', 'all', 'here'], ko: '꽃도 먹을 것도 다 여기 있어.' }],
  sing: [{ words: ['chorus', '!', 'you', 'sing', '?'], ko: '합창이야! 너도 부를래?' }],
  garden: [{ words: ['flower', 'grow', 'here', '.'], ko: '여기서 꽃이 자라.' }],
  work: [{ words: ['work', 'good', '.', 'make', 'all'], ko: '일은 좋아. 모두를 빚지.' }],
  guest: [{ words: ['day', 'good', '.'], ko: '좋은 날이야.' }],
  curator: [{ words: ['old', 'story', 'here', '.'], ko: '옛 이야기가 여기 있어요.' }, { words: ['see', 'memory', '.'], ko: '기억을 보세요.' }],
  // 친한 사이
  friend: [
    { words: ['friend', '!', 'you', 'come', 'again'], ko: '벗이여! 또 왔구나.' },
    { words: ['you', 'always', 'here', ',', 'friend'], ko: '너는 언제나 여기야, 벗이여.' },
    { words: ['come', 'home', 'we', '.', 'eat', 'together'], ko: '우리 집에 와. 같이 먹자.' },
  ],
  // 시각
  morning: [{ words: ['day', 'wake', '!', 'good', 'day'], ko: '낮이 깨어났어! 좋은 날.' }],
  night: [{ words: ['night', 'we', 'sing', 'together'], ko: '밤엔 함께 노래하자.' }],
  thanks: [{ words: ['thanks', '!', 'friend'], ko: '고마워, 벗이여!' }],
  gift: [{ words: ['gift', '?', 'joy', '!', 'thanks'], ko: '선물이야? 기뻐! 고마워.' }],
  tagWin: [{ words: ['you', 'catch', 'all', '!', 'play', 'again'], ko: '다 잡혔다! 또 놀자!' }],
  tagLose: [{ words: ['no', 'catch', '!', 'again', '?'], ko: '못 잡았지! 다시 할래?' }],
};

// 장터에서 나누는 것 (울로)
export const GOODS = [
  { id: 'fruit', name: '빛열매', price: 1, desc: '달콤하게 빛나는 열매. 주민에게 건네면 함께 나눠 먹는다(친해진다).' },
  { id: 'flower', name: '울림꽃', price: 2, desc: '노래에 맞춰 피는 꽃. 선물하면 크게 기뻐한다.' },
  { id: 'trinket', name: '작은 고리 모형', price: 4, desc: '하늘고리를 본뜬 장식. 모아 두면 일지에 남는다.' },
];
