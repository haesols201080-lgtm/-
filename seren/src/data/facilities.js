// 쓰임이 있는 건물들: 세렌의 도시마다 실제로 일을 하는 시설.
// type 은 아래 FACILITY_TYPES 중 하나. at = 장소 id (또는 [x, z]), off = [dx, dz] 또는 polar = [각도°, 거리 m].
// 자리에 다른 구조물이 있으면 빌더가 조금씩 밀어서 빈 곳을 찾습니다. y 를 주면 그 높이(하늘닻 등)에 짓습니다.
// 새 시설을 더하려면 여기 한 줄, 새 종류를 더하려면 FACILITY_TYPES + world/facilities.js 의 모델 + game/services.js 의 기능.

export const FACILITY_TYPES = {
  workshop: { name: '울림 공방', keeper: '공방지기', verb: '장비 손보기', color: 0xffc46a, icon: '⚒' },
  library: { name: '노래 서고', keeper: '서고지기', verb: '책 읽기 · 단어 배우기', color: 0xb9a6ff, icon: '書' },
  maproom: { name: '별지도 방', keeper: '지도지기', verb: '지도 펼치기 · 남은 것 찾기', color: 0x7ff3e6, icon: '◎' },
  rest: { name: '쉼터', keeper: '쉼터지기', verb: '쉬기 · 쉼터 사이 이동', color: 0xffd27a, icon: '☾' },
  greenhouse: { name: '온실', keeper: '온실지기', verb: '별씨 심기 · 거두기', color: 0x6dfcd0, icon: '✿' },
  hall: { name: '음악당', keeper: '합창지기', verb: '합창에 끼기', color: 0xff9fd0, icon: '♪' },
  courier: { name: '소식탑', keeper: '소식지기', verb: '부탁 게시판', color: 0x9ff6ff, icon: '✉' },
  weather: { name: '기상탑', keeper: '하늘지기', verb: '오늘 밤 하늘 고르기', color: 0xa8c8ff, icon: '☁' },
  dock: { name: '하늘배 선착장', keeper: '선착장지기', verb: '배 타기 · 나룻배 빌리기', color: 0x7fb8ff, icon: '⛴' },
};

export const FACILITIES = [
  // ── 하모네아: 척추 광장 둘레 ──
  { id: 'cap-workshop', type: 'workshop', name: '하모네아 대공방', at: 'harmonea', polar: [45, 330] },
  { id: 'cap-library', type: 'library', name: '척추 서고', at: 'harmonea', polar: [105, 330] },
  { id: 'cap-maproom', type: 'maproom', name: '하모네아 별지도 방', at: 'harmonea', polar: [165, 330] },
  { id: 'cap-hall', type: 'hall', name: '대음악당', at: 'harmonea', polar: [225, 370] },
  { id: 'cap-courier', type: 'courier', name: '하모네아 소식탑', at: 'harmonea', polar: [285, 330] },
  { id: 'cap-weather', type: 'weather', name: '하모네아 기상탑', at: 'harmonea', polar: [345, 340] },
  { id: 'cap-rest', type: 'rest', name: '광장 쉼터', at: 'harmonea', polar: [80, 600] },
  { id: 'cap-greenhouse', type: 'greenhouse', name: '하모네아 온실', at: 'harmonea', polar: [200, 620] },
  { id: 'cap-dock', type: 'dock', name: '하모네아 선착장', at: 'harmonea', polar: [120, 1120] },
  // ── 하모네아의 구역 ──
  { id: 'dist-workshop', type: 'workshop', name: '새벽 공방', at: 'd-east', toward: [0, 0], dist: 520 },
  { id: 'dist-library', type: 'library', name: '별바라기 서고', at: 'd-north', toward: [0, 0], dist: 520 },
  { id: 'dist-hall', type: 'hall', name: '물결 음악당', at: 'd-sw', toward: [0, 0], dist: 540 },
  { id: 'dist-greenhouse', type: 'greenhouse', name: '포자 온실', at: 'd-west', toward: [0, 0], dist: 560 },
  // ── 들판 ──
  { id: 'dew-workshop', type: 'workshop', name: '온의 공방', at: 'dewfold', off: [40, 34] },
  { id: 'dew-rest', type: 'rest', name: '이슬터 쉼터', at: 'dewfold', off: [-80, -6] },
  { id: 'dew-greenhouse', type: 'greenhouse', name: '이슬터 온실', at: 'dewfold', off: [70, -60] },
  { id: 'dew-dock', type: 'dock', name: '이슬터 선착장', at: 'dewfold', off: [-170, 120] },
  { id: 'meadow-weather', type: 'weather', name: '바람언덕 기상탑', at: 'meadow-vista', off: [60, 40] },
  // ── 지방 도시 ──
  { id: 'yun-library', type: 'library', name: '윤슬 결정 서고', at: 'archive', off: [0, 110] },
  { id: 'yun-rest', type: 'rest', name: '윤슬 쉼터', at: 'yunseul', off: [-60, 120] },
  { id: 'yun-dock', type: 'dock', name: '윤슬 선착장', at: 'yunseul', off: [-320, -160] },
  { id: 'gat-greenhouse', type: 'greenhouse', name: '포자 공방 온실', at: 'foundry', off: [20, 150] },
  { id: 'gat-rest', type: 'rest', name: '갓마을 쉼터', at: 'gatmaeul', off: [140, 220] },
  { id: 'gat-dock', type: 'dock', name: '갓마을 선착장', at: 'gatmaeul', off: [320, -160] },
  { id: 'tte-workshop', type: 'workshop', name: '조선소 공방', at: 'shipyard', off: [-1050, 150] },
  { id: 'tte-rest', type: 'rest', name: '떠돌섬 쉼터', at: 'tteodol', off: [160, 160] },
  { id: 'tte-dock', type: 'dock', name: '떠돌섬 선착장', at: 'tteodol', off: [-260, 260] },
  { id: 'obs-maproom', type: 'maproom', name: '별듣는 지도 방', at: 'array', off: [0, -300] },
  { id: 'obs-rest', type: 'rest', name: '별듣는 쉼터', at: 'array', off: [260, -120] },
  { id: 'obs-dock', type: 'dock', name: '첨봉 선착장', at: 'array', off: [-300, 160] },
  { id: 'mul-hall', type: 'hall', name: '파도 음악당', at: 'mulnorae', off: [70, -90] },
  { id: 'mul-rest', type: 'rest', name: '물노래 쉼터', at: 'mulnorae', off: [-70, 60] },
  { id: 'mul-dock', type: 'dock', name: '물노래 선착장', at: 'mulnorae', off: [-220, -170] },
  // ── 바다 건너 ──
  { id: 'rift-rest', type: 'rest', name: '깊은목 바닥 쉼터', at: 'rift-core', off: [60, 330] },
  { id: 'rift-dock', type: 'dock', name: '깊은목 선착장', at: [38500, 2000], far: true },
  { id: 'plains-rest', type: 'rest', name: '느린땅 쉼터', at: 'bones', off: [340, -260] },
  { id: 'plains-dock', type: 'dock', name: '느린땅 선착장', at: 'bones', off: [560, 200], far: true },
  { id: 'ice-rest', type: 'rest', name: '큰 귀 쉼터', at: 'great-ear', off: [280, 40] },
  { id: 'ice-dock', type: 'dock', name: '흰 숨 선착장', at: 'great-ear', off: [-300, 140], far: true },
  { id: 'falls-workshop', type: 'workshop', name: '주조소 아래 공방', at: 'sky-forge', off: [230, 320] },
  { id: 'falls-rest', type: 'rest', name: '고원 쉼터', at: 'sky-forge', off: [-260, 300] },
  { id: 'falls-dock', type: 'dock', name: '천 폭포 선착장', at: 'sky-forge', off: [40, -460], far: true },
  // ── 하늘닻 (30 km) ──
  { id: 'anchor-maproom', type: 'maproom', name: '하늘 지도 방', at: [-104, -52], y: 30001.25, world: true },
  { id: 'anchor-rest', type: 'rest', name: '하늘닻 쉼터', at: [52, 104], y: 30001.25 },
];

// 옛 책: 서고에서 읽는 아웬의 기록. 읽으면 단어 하나를 확실히 알게 된다.
export const BOOKS = [
  { id: 'b-silence', at: 'cap-library', title: '침묵의 연대기', word: 'silence',
    text: '마지막 대합창이 하늘로 떠난 뒤, 아웬은 공명탑을 하나씩 「듣는 쪽」으로 돌렸다. 대답이 오면 놓치지 않으려고. 탑이 듣는 동안 도시는 쉬지 않고 자랐고, 사람들은 탑 대신 노래했다. 그 기다림을 아웬은 「들음」이라 부른다.' },
  { id: 'b-spine', at: 'cap-library', title: '척추를 세운 노래', word: 'spine',
    text: '척추는 세워진 것이 아니라 불려 올려졌다. 천 명의 합창이 사흘 밤낮 같은 음을 이어 부르는 동안, 바닥의 결정이 하늘로 자랐다. 그 음은 지금도 승강줄 속에서 울리고 있다.' },
  { id: 'b-ship', at: 'cap-library', title: '하늘배의 뼈', word: 'ship',
    text: '하늘배의 바닥에는 고리가 셋 있다. 고리는 세렌의 울림을 아주 조금 밀어낸다. 그 차이만큼 배가 뜬다. 노를 젓는 대신, 아웬은 배에게 어디로 가고 싶은지 노래한다.' },
  { id: 'b-stars', at: 'dist-library', title: '별을 듣는 법', word: 'listen',
    text: '별빛에도 소리가 있다. 너무 낮고 너무 느려서, 천 년을 들어야 한 음이 된다. 별듣는 이들은 대를 이어 한 별의 노래를 받아 적는다.' },
  { id: 'b-children', at: 'dist-library', title: '아이들의 첫 노래', word: 'child',
    text: '아웬의 아이는 태어나 처음으로 자기 이름을 노래한다. 마을은 그 노래를 받아 다시 불러 준다. 그때부터 그 이름은 그 아이의 것이다.' },
  { id: 'b-crystal', at: 'yun-library', title: '결정의 기억', word: 'memory',
    text: '수정 격자는 들은 것을 잊지 않는다. 보관소의 결정 하나에는 한 도시의 백 년이 들어 있다. 울림이 된 아웬은 그 속에서 아직 노래하고 있다.' },
  { id: 'b-glass', at: 'yun-library', title: '유리 황야의 바람', word: 'wind',
    text: '유리 황야의 모래는 한때 노래하는 탑이었다. 탑이 부서지며 흩어진 결정이 바람에 울어, 황야는 지금도 낮게 노래한다.' },
  { id: 'b-make', at: 'yun-library', title: '설득에 관하여', word: 'make',
    text: '아웬은 물질을 깎거나 녹이지 않는다. 물질이 이미 부르고 있는 노래를 찾아, 그 노래를 조금 바꾸자고 설득한다. 설득이 끝나면 물질은 스스로 모양을 바꾼다.' },
];
