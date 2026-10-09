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

// 일터마다의 말 (v24 「직업·시설별 생활 대사」): 건물 운영(op)마다 일하는 이(staff)·찾아온 이(visitor) — 그 공간에서 실제로 일하고 지내는 이야기.
// 단어는 lexicon 에 있는 것만 (뜻은 한국어 쪽이 정확하고, 단어는 노래·글자로 들리는 줄거리).
const L = (w, ko) => ({ words: w.split(' '), ko });
export const JOB_LINES = {
  mart: {
    staff: [L('find small , give small', '진열대 빈 칸부터 채워요. 오늘은 과일 칸이 빨리 비네요.'), L('carry long , tired', '아침 배송이 늦어서 상자를 한꺼번에 날랐어요.'), L('you find ?', '찾는 거 있어요? 저 끝 칸에 새로 들어왔어요.'), L('all come eat , good', '저녁 무렵엔 다들 먹을 걸 사러 와서 줄이 길어요.')],
    visitor: [L('eat find , home', '저녁거리 사러 왔어요. 집에 식구가 많아서요.'), L('good flower , here', '여기 꽃차가 제일 좋아요. 다른 데는 금방 떨어져요.'), L('wait long ?', '계산 줄이 길면 그냥 다음에 올까 봐요.')],
  },
  food: {
    staff: [L('eat make , all day', '하루 종일 국을 끓여요. 냄새에 배가 안 고파져요.'), L('you eat ?', '드실 거 정했어요? 오늘은 꽃국이 맛있어요.'), L('day long , rest no', '점심때는 쉴 틈이 없어요. 지금이 조금 한가해요.')],
    visitor: [L('eat good , here', '이 집 밥이 생각나서 또 왔어요.'), L('friend wait , eat together', '벗을 기다리는 중이에요. 같이 먹기로 했거든요.'), L('work tired , eat', '일 끝나고 배가 고파서 들렀어요.')],
  },
  factory: {
    staff: [L('make make , always', '기계가 쉬지 않으니 우리도 교대로 지켜요.'), L('keep core , good', '이 기계 소리가 고르면 잘 돌고 있는 거예요.'), L('work long , rest near', '교대가 곧 끝나요. 다음 조가 오면 쉬러 가요.'), L('crystal carry , make', '원료가 늦게 와서 줄이 잠깐 멈췄었어요.')],
    visitor: [L('see make , good', '물건이 만들어지는 걸 보는 게 재밌어요.')],
  },
  depot: {
    staff: [L('carry carry , find', '상자마다 갈 곳이 적혀 있어요. 틀리면 먼 구역까지 가 버려요.'), L('ship come , wait', '짐배가 들어오면 그때부터 바빠져요.'), L('tired , carry long', '오늘은 짐이 유난히 많네요.')],
    visitor: [L('gift wait , here', '보낸 소포 찾으러 왔어요.')],
  },
  office: {
    staff: [L('work long , light', '오늘 할 일을 나누는 중이에요. 회의가 길어졌어요.'), L('friend share , good', '옆자리 동료가 일을 많이 도와줘요.'), L('time go , home near', '이것만 끝내면 집에 가요.'), L('eat together , friend', '점심은 동료들이랑 아래층에서 먹어요.')],
    visitor: [L('wait , answer', '서류 답을 기다리는 중이에요.')],
  },
  lab: {
    staff: [L('crystal listen , learn', '수정이 내는 소리를 기록하고 있어요. 어제랑 미세하게 달라요.'), L('make again , again', '같은 실험을 몇 번째 하는지 몰라요. 그래도 조금씩 나아져요.'), L('friend find , joy', '동료가 새 결과를 찾아서 다들 들떠 있어요.')],
    visitor: [L('see , learn', '연구동은 처음 와 봐요. 다 신기하네요.')],
  },
  school: {
    staff: [L('child learn , good', '아이들이 노래를 빨리 배워요. 저보다 낫다니까요.'), L('learn time , listen', '다음 시간은 옛 노래 수업이에요.'), L('child play , tired', '쉬는 시간마다 아이들이 뛰어다녀서 정신이 없어요.')],
    visitor: [L('friend play , together', '쉬는 시간에 벗이랑 놀 거예요.'), L('learn long , tired', '수업이 길어서 졸려요.'), L('song learn , joy', '오늘 새 노래를 배웠어요!'), L('home go , near', '이 시간만 끝나면 집에 가요.')],
  },
  clinic: {
    staff: [L('heal , wait small', '오늘은 찾아온 이가 많아서 조금 기다려야 해요.'), L('rest , heal', '푹 쉬면 금방 나아요. 무리하지 마세요.'), L('work night , tired', '밤 근무가 끝났는데 아직 인계가 남았어요.'), L('listen heart , good', '울림을 들어 보니 많이 좋아졌어요.')],
    visitor: [L('wait long , tired', '진료 차례를 기다리는 중이에요.'), L('heal , thanks', '여기 치유사들 덕분에 많이 나았어요.'), L('fall , heal', '넘어져서 다쳤어요. 별일 아니래요.')],
  },
  plant: {
    staff: [L('light keep , always', '도시에 빛이 끊기지 않게 지켜요.'), L('core listen , good', '심장 소리가 고르네요. 오늘은 조용한 날이에요.')],
    visitor: [],
  },
  terminal: {
    staff: [L('ship come , wait small', '다음 배는 조금 늦어요. 바람이 세서요.'), L('path find , you ?', '어디 가세요? 고리 노선이면 저쪽이에요.'), L('all come , all go', '하루에 몇 천 명이 오가요. 얼굴은 다 못 외워요.')],
    visitor: [L('wait ship , home', '집에 가는 배를 기다려요.'), L('far go , friend', '먼 구역에 사는 벗을 만나러 가요.'), L('wait long , tired', '배가 늦어서 한참 기다렸어요.')],
  },
  museum: {
    staff: [L('old story , keep', '옛 이야기를 지키는 게 제 일이에요.'), L('you see ?', '저 전시 보셨어요? 새로 들어온 거예요.')],
    visitor: [L('old song , joy', '옛 노래 기록을 보러 왔어요.'), L('child learn , here', '아이에게 보여 주려고 데려왔어요.')],
  },
  library: {
    staff: [L('story keep , silence', '조용히 해 주세요. 다들 읽는 중이에요.'), L('story find , you ?', '찾는 책 있어요? 분류를 알려 드릴게요.')],
    visitor: [L('story long , joy', '이 책 벌써 세 번째 읽어요.'), L('learn , here', '시험 공부하러 왔어요.')],
  },
  hall: {
    staff: [L('song together , night', '오늘 밤 공연 준비 중이에요.')],
    visitor: [L('song listen , joy', '합창 들으러 왔어요. 자리가 금방 차요.')],
  },
  hotel: {
    staff: [L('far come , rest', '먼 구역에서 온 손님이 많아요. 다들 피곤해 보여요.'), L('home , open', '방은 다 정리됐어요. 손님 맞을 준비 끝!'), L('night work , tired', '밤 근무라 낮에 자요.')],
    visitor: [L('far come , rest', '먼 데서 와서 하룻밤 묵어 가요.'), L('sky see , good', '위층 창에서 보이는 도시가 정말 예뻐요.')],
  },
  bank: {
    staff: [L('keep , answer', '맡기실 거면 이쪽 창구로 오세요.'), L('time long , all come', '월말이라 오늘은 사람이 많네요.'), L('keep seed , good', '맡긴 별씨는 안전하게 지켜요.')],
    visitor: [L('give seed , keep', '번 돈을 맡기러 왔어요.'), L('wait , answer', '상담 차례를 기다려요.')],
  },
  farm: {
    staff: [L('grow , water', '물을 조금 덜 줬더니 더 잘 자라요.'), L('flower grow , joy', '새 싹이 올라왔어요.')],
    visitor: [L('flower see , good', '꽃 구경하러 왔어요.')],
  },
  home: {
    staff: [],
    visitor: [L('home , rest', '집이 제일 편해요.'), L('child sleep , silence', '아이가 자고 있어요. 조용히요.'), L('eat together , all', '저녁은 다 같이 먹어요.')],
  },
};
// 일과 상관없는 생활 말 (식사·퇴근 계획·산 물건·자주 가는 곳·날씨·동료)
export const CASUAL_LINES = [
  L('work go , eat home', '일 끝나면 집에 가서 밥 먹을 거예요.'),
  L('gift find , friend', '벗에게 줄 선물을 찾고 있어요.'),
  L('wind , sky good', '오늘 바람이 좋아서 하늘이 맑아요.'),
  L('rest day , meadow go', '쉬는 날엔 들판에 가요. 바람 소리가 좋아요.'),
  L('friend , song together', '벗이랑 저녁에 노래하러 가기로 했어요.'),
  L('small make , home', '집에 둘 작은 장식을 샀어요.'),
  L('tired , sleep long', '어제 늦게 자서 좀 피곤해요.'),
  L('sea go , dream', '언젠가 바다 마을에 가 보고 싶어요.'),
];
// 붐빌 때 하는 말
export const BUSY_LINES = [L('all come , here', '오늘은 사람이 정말 많네요.'), L('wait long , all', '다들 기다리느라 줄이 길어요.')];
