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
  // 2부: 바다 건너
  { id: 'sol', name: '솔', title: '하늘닻의 고리지기', place: 'anchor', offset: [70, -36], y: 30001, hue: 0.58, glow: 0xbffcff, scale: 1.2 },
  { id: 'kael', name: '카엘', title: '깊은목의 기관지기', place: 'rift-core', offset: [40, 196], hue: 0.92, glow: 0xff7ad0 },
  { id: 'moru', name: '모루', title: '걸음마을의 길잡이', place: 'plains-pylon', offset: [0, 0], walker: [18, -40], hue: 0.12, glow: 0xffd27a, scale: 1.1 },
  { id: 'yuha', name: '유하', title: '큰 귀의 듣는 이', place: 'great-ear', offset: [10, 152], hue: 0.55, glow: 0x9fd8ff },
  { id: 'peon', name: '페온', title: '하늘 주조소의 장인', place: 'sky-forge', offset: [70, 20], y: 2351, hue: 0.4, glow: 0x7fe8ff },
];

export const LINES = {
  // 이엘
  iel_1: { words: ['come', ',', 'small', 'star', '.', 'we', 'long', 'wait'], ko: '오라, 작은 별. 우리는 오래 기다렸어.' },
  iel_2: { words: ['you', 'come', 'sky', '?'], ko: '너는 하늘에서 왔니?' },
  iel_3: { words: ['i', 'give', 'you', 'rise'], ko: '너에게 「솟음」을 줄게.' },
  iel_4: { words: ['come', '.', 'home', 'we'], ko: '오라. 우리 집으로.' },
  iel_5: { words: ['here', 'home', '.', 'see', 'memory', 'land'], ko: '여기가 우리 집이야. 땅의 기억을 읽어 봐.' },
  iel_6: { words: ['song', 'wait', '.', 'you', 'sing', '?'], ko: '우물이 네 노래를 기다려. 들려줄래?' },
  iel_7: { words: ['joy', '!', 'thanks', ',', 'small', 'star'], ko: '기뻐! 고마워, 작은 별.' },
  iel_8: { words: ['go', '@하모네아', '.', '@하우', 'wait', 'you'], ko: '하모네아로 가. 하우가 너를 기다려.' },
  iel_9: { words: ['flow', 'path', 'here'], ko: '흐름의 길이 여기 있어.' },
  iel_10: { words: ['you', 'always', 'home', 'here'], ko: '여기는 언제나 너의 집이야.' },
  // 온
  on_1: { words: ['you', 'path', '?', 'crystal', 'find'], ko: '네 탈것이니? 수정을 찾아 와.' },
  on_2: { words: ['give', '.', 'i', 'make', 'flow'], ko: '줘 봐. 내가 흐름을 빚어 넣을게.' },
  on_3: { words: ['go', 'far', '!', 'wind', 'you'], ko: '멀리 가! 너는 바람이야.' },
  on_4: { words: ['star', 'seed', 'give', '?'], ko: '별씨를 가져왔니?' },
  // 하우
  hau_1: { words: ['you', 'answer', '.', 'first', 'answer'], ko: '네가 대답이구나. 첫 번째 대답.' },
  hau_2: { words: ['we', 'sing', 'sky', 'long', 'time'], ko: '우리는 아주 오랜 시간 하늘을 향해 노래했다.' },
  hau_3: { words: ['tower', 'listen', '.', 'silence', 'long', 'time'], ko: '탑들은 귀를 기울였다. 오랜 시간, 침묵으로.' },
  hau_4: { words: ['you', 'song', 'first', '.', 'tower', 'listen', 'you'], ko: '네 노래는 처음 듣는 노래. 탑들이 너를 들을 것이다.' },
  hau_5: { words: ['i', 'give', 'you', 'flow'], ko: '너에게 「흐름」을 주마.' },
  hau_6: { words: ['rise', 'spine', '.', 'see', 'all', 'land'], ko: '척추 위로 오르거라. 모든 땅을 보아라.' },
  hau_7: { words: ['tower', 'sing', 'again', '.', 'thanks'], ko: '탑이 다시 노래하는구나. 고맙다.' },
  hau_8: { words: ['night', 'come', '.', 'you', 'song', 'sky', 'give'], ko: '밤이 오면, 네 노래를 하늘에 주어라.' },
  hau_13: { words: ['here', 'home', 'all', '.', 'you', 'walk', 'see', 'learn'], ko: '여기는 모두의 집이다. 걸으며 보고 배워라.' },
  hau_14: { words: ['you', 'work', ',', 'share', ',', 'learn', '.', 'you', 'friend'], ko: '너는 일하고, 나누고, 배웠다. 너는 우리의 벗이다.' },
  hau_15: { words: ['you', 'name', 'song', 'make', '.', 'you', 'we'], ko: '네 이름 노래를 빚어라. 그러면 너는 우리다.' },
  hau_16: { words: ['home', 'give', 'you', '.', 'here', 'you', 'home'], ko: '집을 주마. 여기가 네 집이다.' },
  hau_9: { words: ['we', 'sing', 'you', 'name', 'always'], ko: '우리는 언제나 네 이름을 노래하리라.' },
  hau_10: { words: ['all', 'tower', 'sing', '!', 'land', 'sing'], ko: '모든 탑이 노래한다! 땅도 함께 노래한다.' },
  // 미르
  mir_1: { words: ['you', 'star', '?', 'star', 'far', '?'], ko: '너 별이야? 별은 멀어?' },
  mir_2: { words: ['i', 'dream', 'sky', 'ring', 'always'], ko: '나는 언제나 고리 너머 하늘을 꿈꿔.' },
  mir_3: { words: ['whale', 'see', '?', 'whale', 'sing', 'great'], ko: '고래 봤어? 고래 노래는 엄청 커.' },
  // 지역 지기
  keeper_1: { words: ['tower', 'listen', 'long', '.', 'we', 'wait'], ko: '탑이 오래 귀를 기울이고 있어. 우리는 기다려.' },
  keeper_2: { words: ['you', 'song', '?', 'tower', 'listen'], ko: '네 노래라면? 탑이 들을지도 몰라.' },
  keeper_3: { words: ['thanks', '!', 'tower', 'sing', 'again'], ko: '고마워! 탑이 다시 노래해.' },
  keeper_4: { words: ['we', 'sing', 'together', 'night'], ko: '밤에 우리 함께 노래하자.' },
  soel_1: { words: ['crystal', 'listen', 'all', 'song'], ko: '수정은 모든 노래를 들어.' },
  ruon_1: { words: ['forest', 'dream', 'light', 'always'], ko: '숲은 늘 빛을 꿈꿔.' },
  tar_1: { words: ['island', 'wait', '.', 'tower', 'sing', ',', 'island', 'rise'], ko: '섬들이 내려앉아 기다려. 탑이 노래하면 섬이 솟아.' },
  tar_2: { words: ['island', 'rise', '!', 'joy'], ko: '섬이 솟아! 기뻐!' },
  vei_1: { words: ['i', 'listen', 'star', 'long', 'time'], ko: '나는 오랜 시간 별을 들었어.' },
  vei_2: { words: ['star', 'answer', '.', 'you', 'answer'], ko: '별이 대답했어. 네가 그 대답이야.' },
  narin_1: { words: ['sea', 'sing', 'always', '.', 'listen'], ko: '바다는 언제나 노래해. 들어 봐.' },
  // 탑
  pylon_sing: { words: ['song', 'again', '?'], ko: '노래를, 다시?' },
  // ── 2부: 바다 건너 ──
  hau_11: { words: ['ring', 'keeper', 'listen', 'you', '.', 'go', 'up'], ko: '고리지기가 너를 들었다. 위로 가거라.' },
  hau_12: { words: ['spine', 'up', '.', '@솔', 'wait', 'long', 'time'], ko: '척추 위에서 솔이 아주 오래 기다렸다.' },
  sol_1: { words: ['small', 'star', '.', 'i', 'listen', 'you', 'song'], ko: '작은 별. 네 노래를 들었다.' },
  sol_2: { words: ['see', 'far', 'land', '.', 'great', 'tower', 'listen'], ko: '먼 땅을 보아라. 큰 탑들이 아직 듣고만 있다.' },
  sol_3: { words: ['great', 'tower', 'keep', 'spine', '.', 'spine', 'keep', 'ring'], ko: '큰 탑이 척추를 붙들고, 척추가 고리를 붙든다.' },
  sol_4: { words: ['silence', 'come', '.', 'ring', 'listen', '.', 'we', 'wait'], ko: '침묵이 왔고, 고리는 귀가 되었다. 우리는 기다렸다.' },
  sol_5: { words: ['you', 'fall', '.', 'you', 'flow', '.', 'go', 'far'], ko: '뛰어내리고, 흘러라. 멀리 가거라.' },
  sol_6: { words: ['all', 'tower', 'sing', '!', 'world', 'chorus'], ko: '모든 탑이 노래한다! 온 세계의 합창이다.' },
  sol_7: { words: ['ring', 'sing', '.', 'ship', 'leave', '.', 'we', 'answer'], ko: '고리가 노래한다. 배들이 떠난다. 이제 우리가 대답한다.' },
  sol_8: { words: ['you', 'name', 'ring', 'sing', 'always'], ko: '고리는 언제나 네 이름을 노래할 것이다.' },
  kael_1: { words: ['core', 'heart', 'world', '.', 'listen'], ko: '핵은 세계의 마음이야. 들어 봐.' },
  kael_2: { words: ['we', 'make', 'spine', 'core', 'song'], ko: '우리는 핵의 노래로 척추를 빚었어.' },
  moru_1: { words: ['we', 'walk', 'always', '.', 'land', 'long'], ko: '우리는 언제나 걸어. 땅은 길거든.' },
  moru_2: { words: ['walk', 'long', 'see', 'all'], ko: '오래 걸으면 모든 걸 봐.' },
  yuha_1: { words: ['ear', 'listen', '@우르', '.', 'far', 'star', 'listen'], ko: '귀는 우르를 듣고, 먼 별을 들어.' },
  yuha_2: { words: ['you', 'star', 'answer', '.', 'ear', 'listen', 'first'], ko: '네 별의 대답을 귀가 처음 들었어.' },
  peon_1: { words: ['i', 'make', 'ship', '.', 'song', 'make', 'ship'], ko: '나는 배를 빚어. 노래가 배를 빚지.' },
  peon_2: { words: ['waterfall', 'light', 'flow', 'always'], ko: '빛의 폭포는 언제나 흘러.' },
  farkeeper_1: { words: ['great', 'tower', 'listen', '.', 'you', 'sing', '?'], ko: '큰 탑이 아직 듣고만 있어. 네가 노래해 줄래?' },
  farkeeper_2: { words: ['spine', 'up', 'sing', '!', 'thanks'], ko: '척추 위로 노래가 오른다! 고마워.' },
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
  { words: ['silence', 'wait', 'answer'], ko: '침묵은 대답을 기다리는 것.' },
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
    { s: 'moa', t: '…노래? 아니에요, 이건 언어예요. 우리가 312일 동안 따라온 그 신호랑 같은 음계예요. 지금부터 기록할게요.' },
    { s: 'iel', line: 'iel_2' },
    { choice: [{ t: '(하늘의 고리 너머를 가리킨다)' }, { t: '(착륙선을 가리키고 고개를 끄덕인다)' }] },
    { s: 'moa', t: '알아들은 것 같아요. 놀라지도 않네요. …정말로 우리를 기다리고 있었던 거예요.' },
    { s: 'iel', line: 'iel_3', act: [{ do: 'giveTone', n: 0 }] },
    { s: 'moa', t: '공명기가 방금 저 존재의 소리에 맞춰졌어요. 새 음이 저장됐어요 — 「솟음」. 공중에서 연주하면 한 번 더 솟아오를 수 있어요.' },
    { s: 'iel', line: 'iel_4', act: [{ do: 'learn', word: 'come', how: 'guess' }] },
    { s: 'moa', t: '손짓을 보니… 「오라」, 따라오라는 뜻 같아요. 저 빛나는 마을 쪽이에요. 첫 접촉 규약 따위는 필요 없겠네요 — 손님으로 초대받았어요.' },
  ],
  'iel-village': [
    { s: 'iel', line: 'iel_5' },
    { s: 'moa', t: '이 마을, 작아 보여도 길마다 빛 징이 박혀 있고 집집이 공명 설비가 돌아요. 시골조차 이 수준이에요.' },
    { s: 'moa', t: '마을 둘레에 빛나는 글자가 새겨진 돌이 있어요. 손님에게 말을 가르치려고 세워 둔 것 같아요. 읽어 보면 단어를 배울 수 있을 거예요.' },
  ],
  'iel-well': [
    { s: 'iel', line: 'iel_6' },
    { s: 'moa', t: '가운데 우물의 빛 핵이 잠잠해요. 마을 사람들이 손님의 첫 노래로 켜도록 남겨 둔 거래요 — 환영 의식이에요. 「솟음」을 들려주세요.' },
  ],
  'iel-well-done': [
    { s: 'iel', line: 'iel_7', act: [{ do: 'giveTone', n: 1 }] },
    { s: 'moa', t: '두 번째 음이에요 — 「열림」. 닫힌 것을 열고, 돌에 남은 옛 노래(메아리)를 들려주는 소리 같아요.' },
    { s: 'moa', t: '마을의 장인 「온」이 우리 착륙선을 궁금해한대요. 화물칸에 실어 온 호버 썰매 얘기를 하면 좋아할 거예요.' },
  ],
  'on-sled': [
    { s: 'on', line: 'on_1' },
    { s: 'moa', t: '착륙선 화물칸의 호버 썰매요. 그런데 여기선 우리 엔진이 안 먹혀요 — 이 별에선 모든 게 울림으로 떠요.' },
    { s: 'moa', t: '온 말로는 들판의 「공명 결정」 셋이면 썰매를 세렌식으로 고칠 수 있대요. 착륙지 둘레에 표시할게요.' },
  ],
  'on-sled-done': [
    { s: 'on', line: 'on_2' },
    { s: 'moa', t: '…세상에. 우리 엔진을 떼고 공명 결정을 끼웠어요. 이제 이 썰매는 세렌의 울림을 타고 떠요. F 키(또는 썰매 버튼)로 탈 수 있어요.', act: [{ do: 'unlockSkimmer' }] },
    { s: 'on', line: 'on_3' },
  ],
  'iel-spine': [
    { s: 'iel', line: 'iel_8' },
    { s: 'iel', line: 'iel_9', act: [{ do: 'enableCurrent', id: 'meadow-spine' }] },
    { s: 'moa', t: '하모네아 — 저 지평선의 탑들과 하늘까지 이어진 「척추」가 있는 수도예요. 마을 북쪽 끝의 빛의 띠가 그쪽으로 흘러요. 저 흐름에 닿으면 데려다줄 거예요.' },
  ],
  'iel-idle': [
    { s: 'iel', line: 'iel_10' },
  ],
  'hau-first': [
    { s: 'hau', line: 'hau_1' },
    { s: 'moa', t: '이분이 우리 신호에 처음 대답을 보낸 쪽의 대표래요. 다른 아웬보다 훨씬 오래 산 것 같아요. 목소리가 낮고… 무거워요.' },
    { s: 'hau', line: 'hau_2' },
    { s: 'hau', line: 'hau_3' },
    { s: 'moa', t: '그러니까… 아웬은 아주 오래 하늘에 노래를 보냈고, 그다음엔 각 지방의 공명탑을 「듣는 쪽」으로 돌려놓고 대답을 기다렸대요. 그 대답이 — 우리예요.' },
    { s: 'hau', line: 'hau_5', act: [{ do: 'giveTone', n: 2 }] },
    { s: 'moa', t: '세 번째 음 — 「흐름」. 활공이나 썰매 중에 연주하면 해류처럼 앞으로 밀어 줘요.' },
    { s: 'hau', line: 'hau_13' },
    { s: 'moa', t: '먼저 이 도시에서 살아 보래요. 일하고, 사고, 구경하고, 이웃을 도와 보라고요. 손님이 아니라 이웃이 되면 그때 탑 이야기를 해 주겠대요.' },
    { s: 'hau', line: 'hau_6' },
  ],
  'hau-wait': [
    { s: 'hau', line: 'hau_13' },
    { s: 'moa', t: '하우는 우리가 이 도시에서 지내 보길 기다리고 있어요. 일하고, 사고, 구경하고, 이웃을 도와 봐요.' },
  ],
  'hau-towers': [
    { s: 'hau', line: 'hau_4' },
  ],
  'hau-neighbor': [
    { s: 'hau', line: 'hau_14', act: [{ do: 'gesture', npc: 'hau', v: 0.8 }, { do: 'learn', word: 'friend', how: 'teach' }] },
    { s: 'moa', t: '「벗」이래요. 이 도시에서 그 말은… 시민증 같은 거래요.' },
    { s: 'hau', line: 'hau_4' },
    { s: 'moa', t: '듣고 있는 탑들에게 우리 노래를 들려주면, 탑이 다시 노래하는 쪽으로 돌아선대요. 그러면 그 지방의 빛길 갈래선과 하늘길도 다시 열리고요.' },
    { s: 'moa', t: '대답이 정말로 왔다는 걸 온 세렌에 알리는 일이에요. 그걸 우리한테 맡긴 거예요.' },
  ],
  'hau-pylon': [
    { s: 'hau', line: 'hau_7' },
  ],
  'hau-night': [
    { s: 'hau', line: 'hau_8' },
    { s: 'hau', line: 'hau_15' },
    { s: 'moa', t: '아웬은 이 별에 사는 사람이 되면 자기만의 「이름 노래」를 지어 하늘에 올린대요. 하우가… 오늘 밤 전망대에서 우리 이름을 지으래요.' },
  ],
  'hau-name-done': [
    { s: 'hau', line: 'hau_9' },
    { s: 'moa', t: '조종사님. 방금 그 선율, 승강줄을 타고 고리까지 올라갔어요. 고리가 그걸 더 먼 곳으로 보냈고요. …우리 고향 쪽으로요.' },
    { s: 'moa', t: '빛의 속도로 팔십 년. 누군가 언젠가 들을 거예요. 아웬이 그랬던 것처럼.' },
    { s: 'hau', line: 'hau_16', act: [{ do: 'assignHome' }] },
    { s: 'moa', t: '…집이요. 하모네아에 우리 집이 생겼어요. 지도에 표시할게요. 312일 만에 처음으로, 돌아갈 곳이 생겼네요.' },
  ],
  'hau-all': [
    { s: 'hau', line: 'hau_10' },
    { s: 'moa', t: '다섯 탑이 모두 노래해요. 세렌 전체가… 울리고 있어요. 오늘 밤은 우리를 위한 축제래요. 그래도 여기서 끝은 아니래요. 아웬에게는 「끝」이라는 말 대신 「다시」가 있대요.' },
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
  // ── 2부: 바다 건너 ──
  'hau-far': [
    { s: 'hau', line: 'hau_11' },
    { s: 'moa', t: '축제 동안 승강줄을 타고 신호가 내려왔대요. 30킬로미터 위, 「하늘닻」의 고리지기가 새 시민을 직접 보고 싶대요.' },
    { s: 'hau', line: 'hau_12' },
    { s: 'moa', t: '전망대에 승강차 정류장이 있어요. 금빛 원 안에 서서 상호작용하면 올라가요. …30킬로미터. 마음의 준비를 해 둘게요.' },
  ],
  'sol-first': [
    { s: 'sol', line: 'sol_1', act: [{ do: 'gesture', npc: 'sol', v: 0.9 }] },
    { s: 'moa', t: '이분… 몸의 절반이 빛이에요. 아웬이 오래 살면 울림이 된다던데, 그 중간쯤에 있는 것 같아요.' },
    { s: 'sol', line: 'sol_2' },
    { s: 'moa', t: '바다 건너 네 곳에 땅이 있어요. 지도에 표시할게요 — 동쪽 균열, 남쪽 초원, 북쪽 얼음, 서쪽 고원.' },
    { s: 'sol', line: 'sol_3' },
    { s: 'moa', t: '그러니까… 고리를 붙들고 있는 다른 척추들의 뿌리가 그 큰 탑들이에요. 그 탑들이 아직 「듣는 쪽」이라서, 고리의 절반은 귀로만 쓰이고 있대요.' },
    { s: 'moa', t: '네 탑이 모두 노래하면 고리 전체가 하나의 목소리가 돼요. 이 별이 처음으로 하늘에 「대답」을 보내는 거예요.' },
    { s: 'sol', line: 'sol_4' },
    { s: 'sol', line: 'sol_5', act: [{ do: 'enableCurrent', id: 'great-east' }, { do: 'enableCurrent', id: 'great-south' }, { do: 'enableCurrent', id: 'great-north' }, { do: 'enableCurrent', id: 'great-west' }, { do: 'flag', k: 'greatOpen' }] },
    { s: 'moa', t: '대륙 해안에서 바다를 건너는 큰 해류가 흐르기 시작했어요. 아니면… 여기 가장자리의 문에서 뛰어내려 활공해도 돼요. 공기가 옅어서 엄청 빨라질 거예요.' },
  ],
  'sol-wait': [
    { s: 'sol', line: 'sol_5' },
  ],
  'sol-final': [
    { s: 'sol', line: 'sol_6' },
    { s: 'moa', t: '조종사님, 위를 보세요. 고리가… 끝에서 끝까지 불이 켜지고 있어요.', act: [{ do: 'worldChorus' }] },
    { s: 'sol', line: 'sol_7' },
    { s: 'sol', line: 'sol_8' },
    { s: 'moa', t: '우리가 받은 첫 신호는 「오라」였어요. 이제 이 별이 온 하늘에 「다시」라고 노래해요.' },
    { s: 'moa', t: '그 노래 속에 조종사님 이름 노래도 들어 있어요. 우리는 이제 손님이 아니에요. 세렌의 사람이에요.' },
  ],
  'sol-idle': [
    { s: 'sol', line: 'sol_8' },
  ],
  'kael-1': [
    { s: 'kael', line: 'kael_1' },
    { s: 'kael', line: 'kael_2' },
    { s: 'moa', t: '저 고리 기관이 세렌의 핵과 함께 진동해요. 행성 하나를 악기로 쓴 거예요.' },
    { s: 'kael', line: 'farkeeper_1' },
  ],
  'moru-1': [
    { s: 'moru', line: 'moru_1' },
    { s: 'moru', line: 'moru_2' },
    { s: 'moa', t: '이 마을은 한 번도 멈춘 적이 없대요. 거신이 걸음을 멈추면 마을도 잠든다고.' },
    { s: 'moru', line: 'farkeeper_1' },
  ],
  'yuha-1': [
    { s: 'yuha', line: 'yuha_1' },
    { s: 'yuha', line: 'yuha_2' },
    { s: 'moa', t: '…라르크 호의 신호를 처음 받은 게 이 귀였대요. 우리가 오는 걸 여기서 먼저 알았던 거예요.' },
    { s: 'yuha', line: 'farkeeper_1' },
  ],
  'peon-1': [
    { s: 'peon', line: 'peon_1' },
    { s: 'peon', line: 'peon_2' },
    { s: 'moa', t: '하모네아의 탑도, 하늘을 나는 배도 여기서 노래로 빚었대요. 쇠를 녹이는 게 아니라 물질을 노래로 「설득」한대요.' },
    { s: 'peon', line: 'farkeeper_1' },
  ],
  'farkeeper-awake': [
    { s: '$keeper', line: 'farkeeper_2' },
  ],
};

// 퀘스트. kind: main | side | request
export const QUESTS = {
  mq0: {
    title: '착륙', kind: 'main',
    steps: [
      { type: 'move', dist: 12, text: '착륙선에서 내려 세렌의 땅을 걸어 보기', hint: 'WASD / 왼쪽 화면을 끌어 이동', onStart: [{ do: 'npcGo', npc: 'iel', place: 'crash', offset: [-30, -33], lead: false }] },
      { type: 'near', npc: 'iel', r: 9, text: '마중 나온 빛나는 형체에게 다가가기' },
      { type: 'talk', npc: 'iel', convo: 'iel-first', text: '이 별의 사람과 처음 마주하기' },
      { type: 'reach', place: 'dewfold', r: 70, text: '이엘을 따라 이슬터 마을로', onStart: [{ do: 'npcGo', npc: 'iel', place: 'dewfold', offset: [8, 14] }] },
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
    title: '손님의 탈것', kind: 'main',
    steps: [
      { type: 'talk', npc: 'on', convo: 'on-sled', text: '장인 온에게 착륙선 썰매 이야기하기' },
      { type: 'pickup', set: 'sled', count: 3, text: '착륙지 둘레에서 공명 결정 찾기', onStart: [{ do: 'spawnPickups', set: 'sled' }] },
      { type: 'talk', npc: 'on', convo: 'on-sled-done', text: '온에게 결정 가져가기' },
      { type: 'skim', dist: 200, text: '썰매 타 보기' },
      { type: 'talk', npc: 'iel', convo: 'iel-spine', text: '이엘에게 돌아가기' },
    ],
    next: 'mq2',
  },
  mq2: {
    title: '빛의 수도', kind: 'main',
    steps: [
      { type: 'reach', place: 'spine', r: 260, text: '해류를 타고 하모네아의 척추로' },
      { type: 'talk', npc: 'hau', convo: 'hau-first', text: '노래지기 하우 만나기' },
      { type: 'vista', id: 'spine-deck', text: '척추 꼭대기 전망대에서 도시 내려다보기', hint: '광장의 빛기둥에 들어가면 위로 실려 가요' },
    ],
    next: 'mq2b',
    onDone: [{ do: 'moa', t: '저 아래 건물마다 쓰임이 있어요. 문으로 들어가면 층마다 가게·사무실·공장·병원이 진짜로 돌아가요 — 물건은 공장에서 물류 창고를 거쳐 진열대로 오고, 돈(울)은 일한 만큼 회사 금고에서 나와요. 건물 안 단말의 「일자리」로 일을 구해 봐요.' }],
  },
  mq2b: {
    title: '이웃이 되기', kind: 'main',
    steps: [
      { type: 'stat', path: 'venue.worked', count: 1, text: '도시에서 일 하나 해 보기', hint: '건물 안 울림판 단말의 「일자리」에서 지원 → 면접 → 출근 단말에서 출근, 또는 바깥 조작대의 일' },
      { type: 'stat', path: 'venue.spent', count: 1, text: '번 돈(울)으로 무언가 사 보기', hint: '마트에서 바구니에 담아 계산대로, 찻집·식당의 주문대, 장터, 터미널의 표' },
      { type: 'stat', path: 'venue.exhibits', count: 1, text: '박물관이나 연구동에서 전시 살펴보기' },
      { type: 'flag', k: 'helpedNeighbor', text: '이웃 돕기 — 주민의 부탁이나 맡은 일 끝내기', hint: '집 탑의 주민 부탁함, 사무탑·창고의 일거리, 「!」가 뜬 주민' },
      { type: 'talk', npc: 'hau', convo: 'hau-neighbor', text: '척추의 하우에게 돌아가기' },
    ],
    next: 'mq3',
    onDone: [{ do: 'moa', t: '지도에 아직 「듣고 있는」 공명탑 다섯 개를 표시했어요. 어느 쪽부터 가도 괜찮아요.' }],
  },
  mq3: {
    title: '귀 기울인 탑들', kind: 'main',
    steps: [
      { type: 'awaken', count: 3, text: '듣고 있는 공명탑에 노래 들려주기', marker: 'pylons' },
    ],
    next: 'mq4',
  },
  mq4: {
    title: '이름 노래', kind: 'main',
    steps: [
      { type: 'talk', npc: 'hau', convo: 'hau-night', text: '척추의 하우에게 돌아가기' },
      { type: 'night', text: '밤이 될 때까지 기다리기', hint: '메뉴 → 쉬기 로 시간을 보낼 수 있어요' },
      { type: 'compose', text: '전망대에서 나의 이름 노래 짓기' },
      { type: 'talk', npc: 'hau', convo: 'hau-name-done', text: '하우와 이야기하기' },
      { type: 'flag', k: 'homeVisit', text: '하모네아의 우리 집에 가 보기', marker: 'home' },
    ],
    next: 'mq5',
  },
  mq5: {
    title: '온 합창', kind: 'main',
    steps: [
      { type: 'awaken', count: 5, text: '남은 탑들에도 노래 들려주기', marker: 'pylons' },
      { type: 'talk', npc: 'hau', convo: 'hau-all', text: '하우에게 돌아가기' },
    ],
    onDone: [{ do: 'festival' }, { do: 'moa', t: '축제예요! 탑이 모두 노래하니 하늘길도 다 열렸어요. 이제 하늘배든 승강판이든 마음껏 타 봐요.' }],
    next: 'mq6',
  },
  // ── 2부: 바다 건너 ──
  mq6: {
    title: '하늘닻', kind: 'main',
    steps: [
      { type: 'flag', k: 'rodeSky', text: '하늘배를 타고 다른 구역으로 날아가 보기', hint: '승강장 탑의 조작대, 또는 교통 터미널' },
      { type: 'flag', k: 'liftTop', text: '랜드마크나 거대 탑 꼭대기에 올라 보기', hint: '거대 탑 발치·랜드마크의 승강판 조작대' },
      { type: 'talk', npc: 'hau', convo: 'hau-far', text: '하우의 이야기 듣기' },
      { type: 'flag', k: 'anchorVisit', text: '승강차를 타고 하늘닻(30 km)으로', hint: '척추 전망대의 금빛 정류장', marker: 'anchor' },
      { type: 'talk', npc: 'sol', convo: 'sol-first', text: '고리지기 솔 만나기' },
    ],
    next: 'mq7',
  },
  mq7: {
    title: '바다 건너', kind: 'main',
    steps: [
      { type: 'awaken', great: true, count: 4, text: '먼 땅의 큰 탑에 노래 들려주기', marker: 'pylons', hint: '하늘닻에서 뛰어내리거나, 해안의 큰 해류를 타요' },
    ],
    next: 'mq8',
  },
  mq8: {
    title: '온 세계의 노래', kind: 'main',
    steps: [
      { type: 'talk', npc: 'sol', convo: 'sol-final', text: '하늘닻의 솔에게 돌아가기' },
    ],
    reward: { starseed: 8 },
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

// 듣는 탑에 들려주는 선율 (얻은 음만 사용) — 차례로 들려줄수록 길어진다
export const PYLON_ORDER_LENGTH = [3, 4, 5, 6, 7];

// 지역 지기와 공명탑
export const KEEPERS = {
  'glass-pylon': 'soel', 'bloom-pylon': 'ruon', 'canyon-pylon': 'tar', 'frost-pylon': 'vei', 'sea-pylon': 'narin',
  'rift-pylon': 'kael', 'plains-pylon': 'moru', 'ice-pylon': 'yuha', 'falls-pylon': 'peon',
};
// 처음 두 공명탑을 깨울 때 주는 음
export const PYLON_TONES = [3, 4];

// 메아리: 「열림」을 연주하면 열리는 옛 기억
export const ECHOES = [
  { id: 'e-first', at: 'dewfold', off: [-30, -60], title: '첫 노래', words: ['first', 'song'],
    text: '아주 먼 옛날, 아웬은 땅이 우는 소리를 처음 들었다. 그 울림이 외로워 보여서, 그들은 대답했다. 그것이 첫 노래였다.' },
  { id: 'e-ring', at: 'spine', off: [180, -120], title: '고리를 짓다', words: ['ring', 'sky'],
    text: '천 세대의 합창으로 아웬은 하늘에 고리를 걸었다. 고리는 별을 향해 열어 둔 거대한 귀였다.' },
  { id: 'e-seed', at: 'spine', off: [-60, 0], y: 'deck', title: '씨앗 노래', words: ['seed', 'far'],
    text: '아웬은 노래를 씨앗처럼 하늘로 보냈다. 얼마나 걸릴지 아무도 몰랐다. 누군가 언젠가 들을 거라고, 그들은 그저 믿었다.' },
  { id: 'e-becoming', at: 'gatmaeul', off: [60, -40], title: '울림이 된 이들', words: ['echo', 'gone'],
    text: '늙은 아웬은 죽지 않는다. 몸을 내려놓고 울림이 된다. 균사 숲의 빛은 그렇게 떠난 이들의 숨결이다.' },
  { id: 'e-islands', at: 'tteodol', off: [-90, 60], title: '떠도는 섬', words: ['island', 'fall'],
    text: '섬들은 탑의 노래 위에 떠 있었다. 탑들이 듣는 쪽으로 돌아서던 날, 섬들은 아주 천천히, 다치지 않게 내려앉았다. 아웬은 그것을 「기다림의 자세」라 불렀다.' },
  { id: 'e-listener', at: 'observatory', off: [-20, 20], title: '별 듣는 자', words: ['listen', 'star'],
    text: '베이의 선조들은 이 탑에서 별의 대답을 기다렸다. 천 번의 겨울 동안 아무도 대답하지 않았다. 그래도 아무도 귀를 닫지 않았다.' },
  { id: 'e-waves', at: 'mulnorae', off: [80, -30], title: '파도의 악기', words: ['sea', 'song'],
    text: '물노래의 아치들은 파도가 연주하는 악기다. 바다가 숨 쉬는 한, 이 노래에는 끝이 없다.' },
  { id: 'e-crystal', at: 'yunseul', off: [-50, 40], title: '수정의 기억', words: ['crystal', 'memory'],
    text: '윤슬의 수정은 들은 소리를 모두 기억한다. 조용히 오래 서 있으면, 오래전 아이들의 웃음소리가 들린다.' },
  { id: 'e-silence', at: 'old-gate', off: [0, 30], title: '침묵의 시작', words: ['silence', 'wait'],
    text: '마지막 대합창이 하늘로 떠난 뒤, 아웬은 공명탑을 하나씩 「듣는 쪽」으로 돌렸다. 도시는 그동안에도 일하고, 웃고, 자랐다. 탑만이 침묵한 채 귀를 기울였다. 기다림도 노래의 일부였으니까.' },
  { id: 'e-lark', at: 'crash', off: [16, 12], title: '라르크 호 일지', words: ['answer'],
    text: '라르크 호 비행 일지, 312일째. 「신호를 해독했다. 이건 데이터가 아니다. 노래다. 누군가 아주 오래 우리를 부르고 있었다. 착륙해도 될지 망설이던 밤, 들판 한가운데 빛 표지가 켜졌다. 내려가기로 했다.」' },
  { id: 'e-farewell', at: 'meadow-vista', off: [6, 0], title: '다시 울리자', words: ['again', 'return'],
    text: '아웬에게는 「안녕」이라는 말이 없다. 헤어질 때 그들은 이렇게 노래한다. 「다시 울리자.」' },
  { id: 'e-eclipse', at: 'spine', off: [40, 40], y: 'deck', title: '우르의 그림자', words: ['dark', 'together'], eclipseOnly: true,
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
  // ── 도시의 짜임 (v0.9: 건물 속) ──
  c_terminal: { name: '울림판 단말', cat: '도시', text: '건물마다 놓인 빛판. 손을 대면 그 건물의 층 안내·일자리·장부가 떠오른다. 아웬은 일자리를 구할 때도, 길을 찾을 때도 이 판에 먼저 묻는다.' },
  c_starseed: { name: '울의 흐름', cat: '도시', word: 'share', text: '세렌의 화폐 「울」은 새로 생기지 않는다. 주민이 가게에서 쓴 울은 회사 금고로, 회사는 일꾼에게 품삯으로, 일꾼은 세금으로 공공 몫에 돌려준다. 공공 몫은 학교·치유원을 꾸리고 이웃에게 고마움을 나눈다 — 「쓴 울은 다시 이웃에게 돈다」.' },
  c_chain: { name: '물건의 길', cat: '도시', word: 'work', text: '진열대의 노래빵은 공장이 빛보리 가루와 빛열매로 구운 것이고, 가루는 재배원의 빛보리를 빻은 것이다. 공장은 발전소의 빛이 있어야 돌고, 물류 창고가 가게의 주문대로 짐 드론을 보낸다. 어느 고리 하나가 멈추면 진열대가 빈다.' },
  c_job: { name: '아웬의 일자리', cat: '도시', text: '아웬은 일자리를 노래로 지원하지 않는다 — 단말에 이름을 남기면 한 시간쯤 뒤 면접 안내가 온다. 면접관은 일을 아는지, 셈을 하는지, 그리고 지친 동료에게 어떻게 하는지를 묻는다. 품삯은 일한 시간과 마친 일만큼, 그 회사 금고에서.' },
  c_bridge: { name: '공중다리', cat: '도시', text: '가까운 높은 탑 둘을 잇는 유리 통로. 다리 바닥이 곧 두 탑의 한 층 바닥이라, 그 층은 건너온 사람을 받는 하늘 쉼터가 된다. 다리 문으로 나가 통로를 건너면 땅에 내려가지 않고 옆 탑의 같은 높이로 들어선다.' },
  c_mixed: { name: '섞인 탑', cat: '도시', text: '큰 탑은 한 건물이 아니라 작은 도시다. 아래 기단에는 가게와 식당가, 가운데는 사무, 위로는 집과 호텔, 꼭대기에는 전망층. 쓰임이 바뀌는 곳에는 하늘 쉼터, 열네 층 남짓마다 설비층이 있다. 높은 탑의 승강기는 낮은층·높은층 무리로 나뉜다.' },
  c_hospital: { name: '종합 치유원', cat: '도시', word: 'heal', text: '한 치유원이 건물 전체를 쓴다. 1층은 응급과 접수, 그 위로 외래 진료실, 울림 스캐너가 모인 검사·영상층, 치유원 행정, 병동이 차례로 쌓이고, 지붕에는 회복 정원이 있다. 침상이 오르내리는 큰 승강기가 따로 있다.' },
  c_hq: { name: '한 회사의 본사', cat: '도시', text: '회사 하나가 탑 전체를 쓰는 본사. 로비 위에 사원 식당, 사무층들, 가운데의 회의·교육층, 꼭대기의 임원층. 층마다 같은 상표 빛깔이지만 쓰임이 다르다.' },
  c_library: { name: '서고의 책', cat: '도시', word: 'story', text: '서고의 서가에는 분류마다 실제 책이 꽂혀 있다 — 역사·자연·노래·이야기·어린이·말과 글·기술·살림·몸·도시·나눔. 기록 서고에는 구역의 연대 기록이 한 해에 한 권씩. 빌린 책은 어느 서고에 돌려줘도 된다.' },
  c_campus: { name: '배움의 집', cat: '도시', word: 'learn', text: '학교 한 채: 아래는 뜀터와 강당, 급식실과 도서 칸, 위로 교실층. 짝수층에는 과학실, 홀수층에는 노래실이 있다. 시간표는 한 시간마다 바뀐다.' },
  c_mart: { name: '대형점 본점', cat: '도시', text: '연쇄점의 본점. 층마다 식품관·생활·도구·옷과 선물 매장이 있고, 위층에는 같은 회사의 식당가와 상품 창고, 그 위는 본사 사무실이다. 하역장으로 들어온 짐은 창고를 거쳐 진열대로 간다.' },
  skywhale: { name: '하늘고래', cat: '생물', word: 'whale', text: '몸길이 200m에 이르는 떠다니는 생물. 몸속 기낭이 세렌의 울림에 공명해 떠오른다. 아웬은 고래의 노래로 계절을 센다.' },
  strider: { name: '긴다리', cat: '생물', text: '네 개의 긴 다리로 들판을 건너는 초식 생물. 무리 지어 천천히 이동하며, 지나간 자리에 빛갈대 씨앗을 퍼뜨린다.' },
  moth: { name: '빛나방', cat: '생물', text: '밤에 나오는 작은 발광 곤충. 「빛」 음에 이끌려 모여든다.' },
  hopper: { name: '톡톡이', cat: '생물', text: '빛갈대 들판의 작은 세발 동물. 물방울 같은 몸 허리에 빛 구멍이 고리로 나 있고, 눈자루 끝의 눈 셋으로 사방을 본다. 등의 감각 깃 끝이 빛나 무리끼리 신호를 보낸다. 빠르게 다가오면 용수철 다리로 폴짝 달아나지만, 가만히 있으면 먼저 다가온다. 아웬 아이들의 단짝.' },
  songbird: { name: '노래새', cat: '생물', word: 'song', text: '깃털 대신 빛 맥이 흐르는 막 날개로 나는 작은 연. 부리가 없고, 빛 테를 두른 커다란 눈구슬 하나로 본다. 무리 지어 날다 등과 돛대에 갈고리 발로 매달려 지저귀고, 들은 공명 음을 그대로 따라 부른다. 아웬은 이 「새」에게 노래를 가르쳐 마을의 소식을 퍼뜨린다고 한다.' },
  beast: { name: '등짐소', cat: '생물', text: '겹친 껍데기 판 셋과 마디진 다리 여섯의 순한 큰 초식 동물. 눈 대신 얼굴판의 빛 구멍 넷으로 빛과 소리를 느끼고, 긴 덩굴 코로 풀을 뜯는다. 등에는 결정이 돋는다. 마을에서는 빛 열매 꼬투리를 지고 텃밭과 길을 오가며 일을 돕는다. 쓰다듬으면 껍데기 판이 낮게 울린다.' },
  crab: { name: '유리게', cat: '생물', text: '유리 황야와 바닷가의 작은 보석 걸음이. 둥근 돔 몸 둘레로 유리 다리 여섯이 별처럼 뻗어 어느 쪽으로든 종종걸음친다. 앞으로 뻗은 수정 더듬이로 소리를 튕겨 서로 대화한다. 겁이 많아 놀라면 모래에 숨는다.' },
  jelly: { name: '포자해파리', cat: '생물', text: '공기 속을 떠다니는 해파리. 균사 숲에는 늘, 들판에는 해 질 녘부터 나온다. 거대 버섯의 포자를 먹고 산다. 아웬은 정원에 줄을 매어 「살아 있는 등」으로 둔다 — 공명 음을 들으면 그 색으로 빛난다.' },
  reed: { name: '빛갈대', cat: '식물', text: '끝에 빛 씨앗이 달린 갈대. 땅의 울림을 모아 밤에 빛난다.' },
  lantern: { name: '등불나무', cat: '식물', text: '가지 끝에 따뜻한 빛 열매가 열리는 나무. 아웬은 길을 표시할 때 이 나무를 심는다.' },
  mushroom: { name: '거대 빛버섯', cat: '식물', text: '높이 수백 m까지 자라는 균류. 갓 위에 마을을 지을 만큼 단단하다.' },
  crystalspire: { name: '노래수정', cat: '광물', text: '유리 황야의 거대 수정. 들은 소리를 저장했다가 되돌려 보낸다.' },
  ur: { name: '우르', cat: '천체', word: 'ur', text: '세렌이 도는 거대 가스행성. 세렌은 늘 같은 면을 우르에게 보인다. 밤마다 보름처럼 차올라 땅을 호박색으로 비춘다.' },
  ring: { name: '궤도 고리', cat: '천체', word: 'ring', text: '아웬이 세렌 둘레에 건설한 인공 고리. 척추의 승강줄로 땅과 이어져 있다. 별을 향한 귀.' },
  // 아웬의 기술
  arcology: { name: '울림탑', cat: '기술', text: '하모네아의 거대한 유리 탑. 높은 것은 2 km 를 넘는다. 벽은 소리로 굳힌 유리이고, 층마다 하늘정원이 있다. 허리에 두른 「하늘바퀴」는 아무것도 붙들지 않고 공명만으로 떠 있다.' },
  liner: { name: '하늘배', cat: '기술', word: 'ship', text: '길이 300 m 의 큰배부터 아홉 걸음짜리 나룻배까지. 바닥의 공명 고리가 세렌의 울림을 밀어내 뜬다. 큰배의 갑판은 공원이라, 활공해서 내려앉으면 함께 실려 간다.' },
  lightrail: { name: '빛길', cat: '기술', word: 'path', text: '유리관 속을 캡슐이 시속 2,000 km 넘게 달린다. 하모네아를 도는 고리선과 여섯 갈래. 갈래선은 그 지방의 탑이 노래해야 움직인다.' },
  drone: { name: '돌보미', cat: '기술', word: 'keep', text: '정원과 거리를 돌보는 작은 떠다니는 기계. 낯선 것을 보면 다가와 살핀다. 공명 음을 들으면 그 색으로 빛나며 따라 부른다.' },
  shuttle: { name: '별항구의 왕복선', cat: '기술', text: '820 m 가속 고리탑을 지나며 소리로 떠밀려 궤도까지 오른다. 고리에서 내려오는 배는 별항구 옆 착륙장에 내린다.' },
  anchor: { name: '하늘닻', cat: '기술', word: 'up', text: '척추의 승강줄 30 km 높이의 역. 공기가 거의 없어 하늘이 검고, 세렌이 둥글게 휜다. 가장자리의 문에서 뛰어내리면 공기가 옅어 아주 빠르게 활공할 수 있다.' },
  core: { name: '세렌의 심장 기관', cat: '기술', word: 'core', text: '깊은목 바닥의 자이로 고리 셋과 결정 심장. 세렌의 핵이 우르의 조석에 울리는 박동을 받아 모든 척추로 보낸다. 아웬은 행성 하나를 악기로 만들었다.' },
  colossus: { name: '거신', cat: '기술', word: 'walk', text: '느린땅을 걸어 다니는 도시 기계. 다리 여섯, 키 300 m. 가장 큰 거신의 등에는 마을과 큰 공명탑이 실려 있다. 배 밑에서 오르는 기류를 타면 올라갈 수 있다.' },
  greatear: { name: '큰 귀', cat: '기술', word: 'ear', text: '우르를 향해 기울어 선 지름 420 m 의 고리. 막이 별빛의 떨림까지 듣는다. 라르크 호의 신호를 처음 들은 곳.' },
  forge: { name: '하늘 주조소', cat: '기술', word: 'make', text: '고원 위 하늘에 뜬 공방. 물질을 노래로 「설득」해 모양을 바꾼다. 하늘배와 탑의 뼈대가 이곳에서 빚어졌다.' },
};

// 모아의 혼잣말 (상황별)
export const MOA = {
  firstGlide: '날개가 펴졌어요! 카메라를 아래로 보면 급강하, 위로 보면 기수를 들어요.',
  firstCurrent: '해류예요! 점프하면 언제든 빠져나올 수 있어요.',
  firstNight: '밤이에요. 우르가 꽉 찼어요… 땅이 빛나고 있어요.',
  firstEclipse: '해가 우르 뒤로 들어가요. 일식이에요. 아웬들이 모두 노래하기 시작했어요.',
  edge: '더 나가면 울림이 끊겨요. 저 너머는 아직 갈 수 없어요.',
  hardLand: '착지 충격 흡수. 그래도 조금만 살살 부탁해요.',
  lowHarmony: '이 지역은 빛이 낮게 가라앉아 있어요. 근처 공명탑이 아직 「듣는 쪽」이라서 그래요.',
  firstSkim: '썰매가 공명을 타고 떠요. 내리막에서는 더 빨라지고, 물 위도 달릴 수 있어요.',
  firstJump: '공중에서 점프를 한 번 더 누르면 등의 날개가 펴져요. 높은 곳에서 뛰어내려 보세요.',
  firstWord: '단어를 하나 알게 됐어요. 예전에 들었던 말도 다시 읽어 볼 수 있어요 — 일지의 「들은 말」을 보세요.',
  anchor: '고도 30킬로미터. 하늘이 검어요… 저 아래 조각들이 전부 우리가 걸어온 곳이고, 바다 건너에 땅이 더 있어요.',
  // 아웬 기술을 처음 볼 때
  seeLiner: '저 배… 길이가 300미터는 돼요. 엔진 소리가 없어요. 세렌의 울림을 밀어내서 떠 있어요.',
  seeLaunch: '방금 저 고리탑에서 뭔가 쏘아 올려졌어요! 궤도로 가는 왕복선이에요. 이 문명은… 우주를 오가고 있어요.',
  seeArcology: '2킬로미터짜리 유리 탑이에요. 그 허리에 도는 고리는 아무것도 붙들고 있지 않아요. 공명만으로 떠 있어요.',
  seeDrone: '작은 기계가 우리를 살펴봐요. 해치진 않을 것 같아요. 호기심이 많네요.',
  seeColossus: '…걸어요. 저 산만 한 게 걸어요. 등에 마을이 있어요!',
  seeCore: '행성의 핵과 같이 울리는 기관이래요. 이 문명은 별 하나를 통째로 악기로 만들었어요.',
};
