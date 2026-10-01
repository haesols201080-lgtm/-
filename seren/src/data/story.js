// 세렌의 이야기 데이터: 인물, 아웬의 말, 대화, 퀘스트, 메아리(기억), 글자돌, 도감.
// ─ 아웬의 말(LINES): words = 사전 단어 id 배열. '.', ',', '?', '!' 는 문장부호, '@이름' 은 고유명사.
// ─ 대화(CONVOS): { s: 화자 id, line: LINES id } 또는 { s: 'moa', t: '모아의 말' } 또는 { choice: [...] }
//   act: 대화 중 실행할 동작 목록 (game/actions.js 참고)
// ─ 퀘스트(QUESTS): steps 의 type 은 game/quests.js 참고.

export const NPCS = [
  { id: 'iel', name: '이엘', title: '들판의 정원지기', place: 'crash', offset: [-160, -170], hue: 0.48, glow: 0x7ff3e6 },
  { id: 'on', name: '온', title: '이슬터의 장인', place: 'dewfold', offset: [30, 22], hue: 0.1, glow: 0xffc46a },
  { id: 'hau', name: '하우', title: '척추의 노래지기', place: 'spine', offset: [0, 120], hue: 0.13, glow: 0xffd27a, scale: 1.15 },
  { id: 'mir', name: '미르', title: '하모네아의 아이', place: 'spine', offset: [60, 190], hue: 0.93, glow: 0xff9fd0, scale: 0.72 },
  { id: 'soel', name: '소엘', title: '윤슬의 수정 조율사', place: 'yunseul', offset: [20, 10], hue: 0.88, glow: 0xff9be0 },
  { id: 'ruon', name: '루온', title: '갓마을의 정원사', place: 'gatmaeul', offset: [0, 30], hue: 0.36, glow: 0x6dfcd0 },
  { id: 'tar', name: '타르', title: '떠돌섬의 섬지기', place: 'tteodol', offset: [10, 20], hue: 0.07, glow: 0xffc86a },
  { id: 'vei', name: '베이', title: '별듣는 탑의 관측자', place: 'observatory', offset: [12, 8], hue: 0.6, glow: 0xa8c8ff },
  { id: 'narin', name: '나린', title: '물노래의 물결 가수', place: 'mulnorae', offset: [0, 25], hue: 0.5, glow: 0x7ff0ff },
];

export const LINES = {
  // 이엘
  iel_1: { words: ['come', ',', 'small', 'star', '.', 'we', 'long', 'wait'], ko: '오라, 작은 별. 우리는 오래 기다렸어.' },
  iel_2: { words: ['you', 'fall', 'sky', '?'], ko: '너는 하늘에서 떨어졌니?' },
  iel_3: { words: ['i', 'give', 'you', 'rise'], ko: '너에게 「솟음」을 줄게.' },
  iel_4: { words: ['come', '.', 'home', 'we'], ko: '오라. 우리 집으로.' },
  iel_5: { words: ['here', 'home', '.', 'see', 'memory', 'land'], ko: '여기가 우리 집이야. 땅의 기억을 읽어 봐.' },
  iel_6: { words: ['song', 'sleep', '.', 'you', 'wake', '?'], ko: '노래가 잠들었어. 네가 깨워 줄래?' },
  iel_7: { words: ['joy', '!', 'thanks', ',', 'small', 'star'], ko: '기뻐! 고마워, 작은 별.' },
  iel_8: { words: ['go', 'spine', '.', '@하우', 'wait', 'you'], ko: '척추로 가. 하우가 너를 기다려.' },
  iel_9: { words: ['flow', 'path', 'here'], ko: '흐름의 길이 여기 있어.' },
  iel_10: { words: ['you', 'always', 'home', 'here'], ko: '여기는 언제나 너의 집이야.' },
  // 온
  on_1: { words: ['you', 'path', 'fall', '?', 'find'], ko: '네 탈것이 떨어졌니? 찾아 와.' },
  on_2: { words: ['give', '.', 'i', 'wake', 'flow'], ko: '줘 봐. 내가 흐름을 깨울게.' },
  on_3: { words: ['go', 'far', '!', 'wind', 'you'], ko: '멀리 가! 너는 바람이야.' },
  on_4: { words: ['star', 'seed', 'give', '?'], ko: '별씨를 가져왔니?' },
  // 하우
  hau_1: { words: ['you', 'answer', '.', 'first', 'answer'], ko: '네가 대답이구나. 첫 번째 대답.' },
  hau_2: { words: ['we', 'sing', 'sky', 'long', 'time'], ko: '우리는 아주 오랜 시간 하늘을 향해 노래했다.' },
  hau_3: { words: ['tower', 'silence', '.', 'land', 'sleep'], ko: '탑들이 침묵했다. 땅이 잠들었다.' },
  hau_4: { words: ['you', 'song', 'first', '.', 'tower', 'listen', 'you'], ko: '네 노래는 처음 듣는 노래. 탑들이 너를 들을 것이다.' },
  hau_5: { words: ['i', 'give', 'you', 'flow'], ko: '너에게 「흐름」을 주마.' },
  hau_6: { words: ['rise', 'spine', '.', 'see', 'all', 'land'], ko: '척추 위로 오르거라. 모든 땅을 보아라.' },
  hau_7: { words: ['tower', 'sing', 'again', '.', 'thanks'], ko: '탑이 다시 노래하는구나. 고맙다.' },
  hau_8: { words: ['night', 'come', '.', 'you', 'song', 'sky', 'give'], ko: '밤이 오면, 네 노래를 하늘에 주어라.' },
  hau_9: { words: ['we', 'sing', 'you', 'name', 'always'], ko: '우리는 언제나 네 이름을 노래하리라.' },
  hau_10: { words: ['all', 'tower', 'sing', '!', 'land', 'wake'], ko: '모든 탑이 노래한다! 땅이 깨어났다.' },
  // 미르
  mir_1: { words: ['you', 'star', '?', 'star', 'far', '?'], ko: '너 별이야? 별은 멀어?' },
  mir_2: { words: ['i', 'dream', 'sky', 'ring', 'always'], ko: '나는 언제나 고리 너머 하늘을 꿈꿔.' },
  mir_3: { words: ['whale', 'see', '?', 'whale', 'sing', 'great'], ko: '고래 봤어? 고래 노래는 엄청 커.' },
  // 지역 지기
  keeper_1: { words: ['tower', 'sleep', '.', 'we', 'sad'], ko: '탑이 잠들었어. 우리는 슬퍼.' },
  keeper_2: { words: ['you', 'song', '?', 'tower', 'listen'], ko: '네 노래라면? 탑이 들을지도 몰라.' },
  keeper_3: { words: ['thanks', '!', 'land', 'wake', 'again'], ko: '고마워! 땅이 다시 깨어났어.' },
  keeper_4: { words: ['we', 'sing', 'together', 'night'], ko: '밤에 우리 함께 노래하자.' },
  soel_1: { words: ['crystal', 'listen', 'all', 'song'], ko: '수정은 모든 노래를 들어.' },
  ruon_1: { words: ['forest', 'dream', 'light', 'gone'], ko: '숲은 사라진 빛을 꿈꿔.' },
  tar_1: { words: ['island', 'fall', '.', 'island', 'sleep'], ko: '섬들이 떨어졌어. 섬들이 잠들었어.' },
  tar_2: { words: ['island', 'rise', '!', 'joy'], ko: '섬이 솟아! 기뻐!' },
  vei_1: { words: ['i', 'listen', 'star', 'long', 'time'], ko: '나는 오랜 시간 별을 들었어.' },
  vei_2: { words: ['star', 'answer', '.', 'you', 'answer'], ko: '별이 대답했어. 네가 그 대답이야.' },
  narin_1: { words: ['sea', 'sing', 'always', '.', 'listen'], ko: '바다는 언제나 노래해. 들어 봐.' },
  // 탑
  pylon_sing: { words: ['song', 'again', '?'], ko: '노래를, 다시?' },
};

// 지나가는 아웬의 말 (들을수록 모아가 단어를 추정)
export const AMBIENT = [
  { words: ['day', 'light', 'joy'], ko: '밝은 낮, 기쁘다.' },
  { words: ['wind', 'sing', 'meadow'], ko: '바람이 들판에서 노래해.' },
  { words: ['you', 'small', 'star', '?'], ko: '네가 작은 별이니?' },
  { words: ['we', 'wait', 'long'], ko: '우리는 오래 기다렸지.' },
  { words: ['see', '@우르', '.', 'great'], ko: '우르를 봐. 크지.' },
  { words: ['night', 'we', 'sing', 'together'], ko: '밤엔 함께 노래하자.' },
  { words: ['whale', 'sky', 'far'], ko: '고래가 먼 하늘에.' },
  { words: ['memory', 'echo', 'always'], ko: '기억은 언제나 울린다.' },
  { words: ['where', 'you', 'home', '?'], ko: '너의 집은 어디야?' },
  { words: ['all', 'return', 'again'], ko: '모두 다시 돌아온다.' },
  { words: ['silence', 'sad'], ko: '침묵은 슬퍼.' },
  { words: ['star', 'far', 'listen'], ko: '먼 별이 듣고 있어.' },
  { words: ['child', 'sing', 'first', 'song'], ko: '아이가 첫 노래를 부른다.' },
  { words: ['time', 'flow', 'sea'], ko: '시간은 바다처럼 흐른다.' },
  { words: ['friend', ',', 'come'], ko: '벗이여, 오라.' },
  { words: ['light', 'dark', 'together'], ko: '빛과 어둠은 함께야.' },
  { words: ['dream', 'sky', 'ring'], ko: '고리의 하늘을 꿈꾼다.' },
  { words: ['we', 'wait', 'answer'], ko: '우리는 대답을 기다려.' },
  { words: ['you', 'answer', '?'], ko: '네가 대답이야?' },
  { words: ['long', 'time', 'wait', '.', 'joy'], ko: '오래 기다렸어. 기뻐.' },
  { words: ['heart', 'song', 'spine'], ko: '척추의 노래는 마음이야.' },
  { words: ['keep', 'memory', 'tower'], ko: '탑이 기억을 지켜.' },
];
export const AMBIENT_AFTER_NAME = [
  { words: ['we', 'sing', 'you', 'name'], ko: '우리는 네 이름을 노래해.' },
  { words: ['you', 'song', 'always', 'here'], ko: '네 노래는 언제나 여기 있어.' },
];

export const CONVOS = {
  'iel-first': [
    { s: 'iel', line: 'iel_1', act: [{ do: 'gesture', npc: 'iel', v: 0.7 }] },
    { s: 'moa', t: '…노래? 아니에요, 이건 언어예요. 음 높이마다 규칙이 있어요. 지금부터 기록할게요.' },
    { s: 'iel', line: 'iel_2' },
    { choice: [{ t: '(하늘을 가리킨다)' }, { t: '(고개를 끄덕인다)' }] },
    { s: 'iel', line: 'iel_3', act: [{ do: 'giveTone', n: 0 }] },
    { s: 'moa', t: '공명기가 방금 저 존재의 소리에 맞춰졌어요. 새 음이 저장됐어요 — 「솟음」. 공중에서 연주하면 한 번 더 솟아오를 수 있어요.' },
    { s: 'iel', line: 'iel_4', act: [{ do: 'learn', word: 'come', how: 'guess' }] },
    { s: 'moa', t: '손짓을 보니… 「오라」, 따라오라는 뜻 같아요. 저 빛나는 마을 쪽이에요.' },
  ],
  'iel-village': [
    { s: 'iel', line: 'iel_5' },
    { s: 'moa', t: '마을 둘레에 빛나는 글자가 새겨진 돌이 있어요. 가까이 가서 읽어 보면 단어를 배울 수 있을 거예요.' },
  ],
  'iel-well': [
    { s: 'iel', line: 'iel_6' },
    { s: 'moa', t: '가운데 우물의 수정이 꺼져 있어요. 「솟음」을 들려주면 반응할지도 몰라요.' },
  ],
  'iel-well-done': [
    { s: 'iel', line: 'iel_7', act: [{ do: 'giveTone', n: 1 }] },
    { s: 'moa', t: '두 번째 음이에요 — 「열림」. 잠긴 것, 잠든 것을 여는 소리 같아요.' },
    { s: 'iel', line: 'on_1', speaker: 'on' },
  ],
  'on-sled': [
    { s: 'on', line: 'on_1' },
    { s: 'moa', t: '포드의 화물칸에 호버 썰매가 있었어요. 추락하면서 부품이 흩어졌어요. 신호를 표시할게요.' },
  ],
  'on-sled-done': [
    { s: 'on', line: 'on_2' },
    { s: 'moa', t: '…세상에. 썰매 엔진에 공명 수정을 끼웠어요. 이제 이 썰매는 세렌의 울림을 타고 떠요. F 키(또는 썰매 버튼)로 탈 수 있어요.', act: [{ do: 'unlockSkimmer' }] },
    { s: 'on', line: 'on_3' },
  ],
  'iel-spine': [
    { s: 'iel', line: 'iel_8' },
    { s: 'iel', line: 'iel_9', act: [{ do: 'enableCurrent', id: 'meadow-spine' }] },
    { s: 'moa', t: '마을 북쪽 끝에서 빛의 띠가 하늘로 이어져요. 저 흐름에 닿으면 척추까지 데려다줄 것 같아요.' },
  ],
  'iel-idle': [
    { s: 'iel', line: 'iel_10' },
  ],
  'hau-first': [
    { s: 'hau', line: 'hau_1' },
    { s: 'moa', t: '이분은 다른 아웬보다 훨씬 오래된 것 같아요. 목소리가 낮고… 무거워요.' },
    { s: 'hau', line: 'hau_2' },
    { s: 'hau', line: 'hau_3' },
    { s: 'moa', t: '「탑」과 「침묵」. 들판에서 봤던 빛기둥 같은 탑이 다른 곳에도 있는데, 꺼져 있다는 뜻 같아요.' },
    { s: 'hau', line: 'hau_4' },
    { s: 'hau', line: 'hau_5', act: [{ do: 'giveTone', n: 2 }] },
    { s: 'moa', t: '세 번째 음 — 「흐름」. 활공이나 썰매 중에 연주하면 해류처럼 앞으로 밀어 줘요.' },
    { s: 'hau', line: 'hau_6' },
  ],
  'hau-pylon': [
    { s: 'hau', line: 'hau_7' },
  ],
  'hau-night': [
    { s: 'hau', line: 'hau_8' },
    { s: 'moa', t: '세 개의 탑이 깨어났어요. 하우가… 밤에 전망대에서 우리 노래를 하늘에 보내라고 해요. 우리 노래요.' },
  ],
  'hau-name-done': [
    { s: 'hau', line: 'hau_9' },
    { s: 'moa', t: '조종사님. 방금 그 선율, 승강줄을 타고 고리까지 올라갔어요. 고리가 그걸 더 먼 곳으로 보냈고요. …우리 고향 쪽으로요.' },
    { s: 'moa', t: '빛의 속도로 팔십 년. 누군가 언젠가 들을 거예요. 아웬이 그랬던 것처럼.' },
  ],
  'hau-all': [
    { s: 'hau', line: 'hau_10' },
    { s: 'moa', t: '다섯 탑이 모두 노래해요. 세렌 전체가… 울리고 있어요. 그래도 여기서 끝은 아니래요. 아웬에게는 「끝」이라는 말 대신 「다시」가 있대요.' },
  ],
  'mir-1': [
    { s: 'mir', line: 'mir_1' },
    { s: 'mir', line: 'mir_2' },
  ],
  'mir-2': [
    { s: 'mir', line: 'mir_3' },
    { s: 'moa', t: '하늘고래… 저 커다란 떠다니는 생물 말인가 봐요. 가까이 가서 「고요」를 들려주면 다가올지도 몰라요.' },
  ],
  'keeper-silent': [
    { s: '$keeper', line: 'keeper_1' },
    { s: '$keeper', line: 'keeper_2' },
  ],
  'keeper-awake': [
    { s: '$keeper', line: 'keeper_3' },
    { s: '$keeper', line: 'keeper_4' },
  ],
  'soel-1': [{ s: 'soel', line: 'soel_1' }],
  'ruon-1': [{ s: 'ruon', line: 'ruon_1' }],
  'tar-1': [{ s: 'tar', line: 'tar_1' }],
  'tar-2': [{ s: 'tar', line: 'tar_2' }],
  'vei-1': [{ s: 'vei', line: 'vei_1' }, { s: 'vei', line: 'vei_2' }],
  'narin-1': [{ s: 'narin', line: 'narin_1' }],
  'on-seeds': [
    { s: 'on', line: 'on_4' },
  ],
};

// 퀘스트. kind: main | side | request
export const QUESTS = {
  mq0: {
    title: '낙하', kind: 'main',
    steps: [
      { type: 'move', dist: 12, text: '일어나서 몸을 움직여 보기', hint: 'WASD / 왼쪽 화면을 끌어 이동' },
      { type: 'near', npc: 'iel', r: 9, text: '빛나는 형체에게 다가가기' },
      { type: 'talk', npc: 'iel', convo: 'iel-first', text: '빛나는 형체와 마주하기' },
      { type: 'reach', place: 'dewfold', r: 70, text: '이엘을 따라 빛나는 마을로', onStart: [{ do: 'npcGo', npc: 'iel', place: 'dewfold', offset: [8, 14] }] },
    ],
    next: 'mq1',
  },
  mq1: {
    title: '첫 말', kind: 'main',
    steps: [
      { type: 'talk', npc: 'iel', convo: 'iel-village', text: '이엘과 이야기하기' },
      { type: 'glyphs', ids: ['g-star', 'g-we', 'g-song'], text: '마을의 글자돌 읽기', marker: 'glyphs' },
      { type: 'talk', npc: 'iel', convo: 'iel-well', text: '이엘에게 돌아가기' },
      { type: 'tone', n: 0, place: 'dewfold', r: 14, text: '우물 앞에서 「솟음」 연주하기', onDone: [{ do: 'wellAwake' }] },
      { type: 'talk', npc: 'iel', convo: 'iel-well-done', text: '이엘과 이야기하기' },
    ],
    next: 'mq1b',
  },
  mq1b: {
    title: '흩어진 썰매', kind: 'main',
    steps: [
      { type: 'talk', npc: 'on', convo: 'on-sled', text: '장인 온과 이야기하기' },
      { type: 'pickup', set: 'sled', count: 3, text: '썰매 부품 찾기', onStart: [{ do: 'spawnPickups', set: 'sled' }] },
      { type: 'talk', npc: 'on', convo: 'on-sled-done', text: '온에게 부품 가져가기' },
      { type: 'skim', dist: 200, text: '썰매 타 보기' },
      { type: 'talk', npc: 'iel', convo: 'iel-spine', text: '이엘에게 돌아가기' },
    ],
    next: 'mq2',
  },
  mq2: {
    title: '척추의 도시', kind: 'main',
    steps: [
      { type: 'reach', place: 'spine', r: 260, text: '해류를 타고 척추로' },
      { type: 'talk', npc: 'hau', convo: 'hau-first', text: '노래지기 하우 만나기' },
      { type: 'vista', id: 'spine-deck', text: '척추 꼭대기 전망대에 오르기', hint: '광장의 빛기둥에 들어가면 위로 실려 가요' },
    ],
    next: 'mq3',
    onDone: [{ do: 'moa', t: '지도에 꺼진 탑 다섯 개를 표시했어요. 어느 쪽부터 가도 괜찮아요.' }],
  },
  mq3: {
    title: '잠든 탑들', kind: 'main',
    steps: [
      { type: 'awaken', count: 3, text: '침묵한 공명탑 깨우기', marker: 'pylons' },
    ],
    next: 'mq4',
  },
  mq4: {
    title: '대답', kind: 'main',
    steps: [
      { type: 'talk', npc: 'hau', convo: 'hau-night', text: '척추의 하우에게 돌아가기' },
      { type: 'night', text: '밤이 될 때까지 기다리기', hint: '메뉴 → 쉬기 로 시간을 보낼 수 있어요' },
      { type: 'compose', text: '전망대에서 나의 노래를 짓기' },
      { type: 'talk', npc: 'hau', convo: 'hau-name-done', text: '하우와 이야기하기' },
    ],
    next: 'mq5',
  },
  mq5: {
    title: '온 합창', kind: 'main',
    steps: [
      { type: 'awaken', count: 5, text: '남은 공명탑 깨우기', marker: 'pylons' },
      { type: 'talk', npc: 'hau', convo: 'hau-all', text: '하우에게 돌아가기' },
    ],
    onDone: [{ do: 'festival' }],
  },
  sq_mir: {
    title: '별이 궁금한 아이', kind: 'side',
    steps: [
      { type: 'talk', npc: 'mir', convo: 'mir-1', text: '하모네아의 아이와 이야기하기' },
      { type: 'scan', id: 'skywhale', text: '하늘고래를 가까이서 관찰하기', onStart: [{ do: 'moa', t: '하늘고래는 보통 높은 하늘을 떠돌아요. 「고요」나 활공으로 가까이 가 보세요.' }] },
      { type: 'talk', npc: 'mir', convo: 'mir-2', text: '미르에게 들려주기' },
    ],
    reward: { starseed: 3 },
  },
};

// 공명탑을 깨우는 선율 (얻은 음만 사용) — 순서대로 깨울수록 길어진다
export const PYLON_ORDER_LENGTH = [3, 4, 5, 6, 7];

// 지역 지기와 공명탑
export const KEEPERS = {
  'glass-pylon': 'soel', 'bloom-pylon': 'ruon', 'canyon-pylon': 'tar', 'frost-pylon': 'vei', 'sea-pylon': 'narin',
};
// 처음 두 공명탑을 깨울 때 주는 음
export const PYLON_TONES = [3, 4];

// 메아리: 「열림」을 연주하면 열리는 옛 기억
export const ECHOES = [
  { id: 'e-first', at: 'dewfold', off: [-30, -60], title: '첫 노래', words: ['first', 'song'],
    text: '아주 먼 옛날, 아웬은 땅이 우는 소리를 처음 들었다. 그 울림이 외로워 보여서, 그들은 대답했다. 그것이 첫 노래였다.' },
  { id: 'e-ring', at: 'spine', off: [180, -120], title: '고리를 짓다', words: ['ring', 'sky'],
    text: '천 세대의 합창으로 아웬은 하늘에 고리를 걸었다. 고리는 별을 향해 열어 둔 거대한 귀였다.' },
  { id: 'e-seed', at: 'spine', off: [-60, 0], y: 1300, title: '씨앗 노래', words: ['seed', 'far'],
    text: '아웬은 노래를 씨앗처럼 하늘로 보냈다. 얼마나 걸릴지 아무도 몰랐다. 누군가 언젠가 들을 거라고, 그들은 그저 믿었다.' },
  { id: 'e-becoming', at: 'gatmaeul', off: [60, -40], title: '울림이 된 이들', words: ['echo', 'gone'],
    text: '늙은 아웬은 죽지 않는다. 몸을 내려놓고 울림이 된다. 균사 숲의 빛은 그렇게 떠난 이들의 숨결이다.' },
  { id: 'e-islands', at: 'tteodol', off: [-90, 60], title: '떠도는 섬', words: ['island', 'fall'],
    text: '섬들은 노래 위에 떠 있었다. 노래하는 이가 줄어들자, 섬들은 아주 천천히, 다치지 않게 내려앉았다.' },
  { id: 'e-listener', at: 'observatory', off: [-20, 20], title: '별 듣는 자', words: ['listen', 'star'],
    text: '베이의 선조들은 이 탑에서 별의 대답을 기다렸다. 천 번의 겨울 동안 아무도 대답하지 않았다. 그래도 아무도 귀를 닫지 않았다.' },
  { id: 'e-waves', at: 'mulnorae', off: [80, -30], title: '파도의 악기', words: ['sea', 'song'],
    text: '물노래의 아치들은 파도가 연주하는 악기다. 바다가 숨 쉬는 한, 이 노래에는 끝이 없다.' },
  { id: 'e-crystal', at: 'yunseul', off: [-50, 40], title: '수정의 기억', words: ['crystal', 'memory'],
    text: '윤슬의 수정은 들은 소리를 모두 기억한다. 조용히 오래 서 있으면, 오래전 아이들의 웃음소리가 들린다.' },
  { id: 'e-silence', at: 'old-gate', off: [0, 30], title: '침묵의 시작', words: ['silence', 'wait'],
    text: '마지막 대합창이 끝난 뒤, 아웬의 수는 조금씩 줄었다. 탑은 하나씩 잠들었다. 그래도 그들은 기다렸다. 기다림도 노래의 일부였으니까.' },
  { id: 'e-lark', at: 'crash', off: [8, 6], title: '라르크 호 일지', words: ['answer'],
    text: '라르크 호 비행 일지, 312일째. 「신호를 해독했다. 이건 데이터가 아니다. 노래다. 누군가 아주 오래 우리를 부르고 있었다.」' },
  { id: 'e-farewell', at: 'meadow-vista', off: [6, 0], title: '다시 울리자', words: ['again', 'return'],
    text: '아웬에게는 「안녕」이라는 말이 없다. 헤어질 때 그들은 이렇게 노래한다. 「다시 울리자.」' },
  { id: 'e-eclipse', at: 'spine-deck', off: [40, 40], y: 1300, title: '우르의 그림자', words: ['dark', 'together'], eclipseOnly: true,
    text: '우르가 해를 삼키는 날이면, 세렌의 모든 목소리가 하나가 된다. 어둠 속에서 아웬은 서로의 노래로 서로를 찾는다.' },
];

// 글자돌: 읽으면 단어 하나. at = 장소 id 또는 [x, z]
export const GLYPH_STONES = [
  { id: 'g-star', word: 'star', at: 'dewfold', off: [70, 30] },
  { id: 'g-we', word: 'we', at: 'dewfold', off: [-60, 50] },
  { id: 'g-song', word: 'song', at: 'dewfold', off: [-20, 95] },
  { id: 'g-small', word: 'small', at: 'crash', off: [-60, -40] },
  { id: 'g-long', word: 'long', at: 'meadow-pylon', off: [30, 20] },
  { id: 'g-wait', word: 'wait', at: 'spine', off: [260, 60] },
  { id: 'g-sky', word: 'sky', at: 'meadow-vista', off: [12, 8] },
  { id: 'g-home', word: 'home', at: 'dewfold', off: [110, -40] },
  { id: 'g-tower', word: 'tower', at: 'spine', off: [-270, -80] },
  { id: 'g-memory', word: 'memory', at: 'old-gate', off: [30, -20] },
  { id: 'g-answer', word: 'answer', at: 'spine', off: [20, -280] },
  { id: 'g-silence', word: 'silence', at: 'glass-pylon', off: [40, 10] },
  { id: 'g-crystal', word: 'crystal', at: 'yunseul', off: [60, -30] },
  { id: 'g-light', word: 'light', at: 'glass-vista', off: [10, 10] },
  { id: 'g-forest', word: 'forest', at: 'gatmaeul', off: [-80, 20] },
  { id: 'g-dream', word: 'dream', at: 'bloom-pylon', off: [30, -30] },
  { id: 'g-gone', word: 'gone', at: 'bloom-vista', off: [10, 10] },
  { id: 'g-island', word: 'island', at: 'tteodol', off: [50, 50] },
  { id: 'g-fall', word: 'fall', at: 'canyon-pylon', off: [-30, 30] },
  { id: 'g-wind', word: 'wind', at: 'canyon-vista', off: [10, 10] },
  { id: 'g-ice', word: 'ice', at: 'frost-pylon', off: [30, 20] },
  { id: 'g-listen', word: 'listen', at: 'observatory', off: [30, -10] },
  { id: 'g-far', word: 'far', at: 'frost-vista', off: [10, 10] },
  { id: 'g-sea', word: 'sea', at: 'mulnorae', off: [-40, 30] },
  { id: 'g-time', word: 'time', at: 'sea-pylon', off: [30, 20] },
  { id: 'g-return', word: 'return', at: 'crash', off: [120, 160] },
  { id: 'g-together', word: 'together', at: 'harmonea', off: [700, 300] },
  { id: 'g-child', word: 'child', at: 'harmonea', off: [-500, 600] },
  { id: 'g-heart', word: 'heart', at: 'spine', off: [0, 300] },
  { id: 'g-path', word: 'path', at: 'dewfold', off: [-200, -300] },
  { id: 'g-night', word: 'night', at: 'observatory', off: [-40, 30] },
  { id: 'g-day', word: 'day', at: 'meadow-pylon', off: [-40, -10] },
  { id: 'g-whale', word: 'whale', at: 'mulnorae', off: [60, -60] },
  { id: 'g-always', word: 'always', at: 'harmonea', off: [200, -900] },
];

// 도감
export const CODEX = {
  skywhale: { name: '하늘고래', cat: '생물', word: 'whale', text: '몸길이 200m에 이르는 떠다니는 생물. 몸속 기낭이 세렌의 울림에 공명해 떠오른다. 아웬은 고래의 노래로 계절을 센다.' },
  strider: { name: '긴다리', cat: '생물', text: '네 개의 긴 다리로 들판을 건너는 초식 생물. 무리 지어 천천히 이동하며, 지나간 자리에 빛갈대 씨앗을 퍼뜨린다.' },
  moth: { name: '빛나방', cat: '생물', text: '밤에 나오는 작은 발광 곤충. 「빛」 음에 이끌려 모여든다.' },
  crab: { name: '유리게', cat: '생물', text: '유리 황야의 작은 갑각류. 수정 껍데기로 소리를 반사해 서로 대화한다. 겁이 많다.' },
  jelly: { name: '포자해파리', cat: '생물', text: '균사 숲의 공기 속을 떠다니는 해파리. 거대 버섯의 포자를 먹고 산다.' },
  reed: { name: '빛갈대', cat: '식물', text: '끝에 빛 씨앗이 달린 갈대. 땅의 울림을 모아 밤에 빛난다.' },
  lantern: { name: '등불나무', cat: '식물', text: '가지 끝에 따뜻한 빛 열매가 열리는 나무. 아웬은 길을 표시할 때 이 나무를 심는다.' },
  mushroom: { name: '거대 빛버섯', cat: '식물', text: '높이 수백 m까지 자라는 균류. 갓 위에 마을을 지을 만큼 단단하다.' },
  crystalspire: { name: '노래수정', cat: '광물', text: '유리 황야의 거대 수정. 들은 소리를 저장했다가 되돌려 보낸다.' },
  ur: { name: '우르', cat: '천체', word: 'ur', text: '세렌이 도는 거대 가스행성. 세렌은 늘 같은 면을 우르에게 보인다. 밤마다 보름처럼 차올라 땅을 호박색으로 비춘다.' },
  ring: { name: '궤도 고리', cat: '천체', word: 'ring', text: '아웬이 세렌 둘레에 건설한 인공 고리. 척추의 승강줄로 땅과 이어져 있다. 별을 향한 귀.' },
};

// 모아의 혼잣말 (상황별)
export const MOA = {
  firstGlide: '날개가 펴졌어요! 카메라를 아래로 보면 급강하, 위로 보면 기수를 들어요.',
  firstCurrent: '해류예요! 점프하면 언제든 빠져나올 수 있어요.',
  firstNight: '밤이에요. 우르가 꽉 찼어요… 땅이 빛나고 있어요.',
  firstEclipse: '해가 우르 뒤로 들어가요. 일식이에요. 아웬들이 모두 노래하기 시작했어요.',
  edge: '더 나가면 울림이 끊겨요. 저 너머는 아직 갈 수 없어요.',
  hardLand: '착지 충격 흡수. 그래도 조금만 살살 부탁해요.',
  lowHarmony: '이 지역은 색이 바래 있어요. 근처 공명탑이 잠들어 있어서 그런 것 같아요.',
  firstSkim: '썰매가 공명을 타고 떠요. 내리막에서는 더 빨라지고, 물 위도 달릴 수 있어요.',
  firstWord: '단어를 하나 알게 됐어요. 예전에 들었던 말도 다시 읽어 볼 수 있어요 — 일지의 「들은 말」을 보세요.',
};
