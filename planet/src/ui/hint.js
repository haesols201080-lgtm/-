// Device-aware guidance. Hints are written for keyboard and mouse; on a touch
// screen every toast, prompt, mode line and objective passes through
// touchify(), which names the on-screen buttons instead (사용, 채집/설치,
// 건설, 가방, 연구, 취소...) so the guide always matches what the player has.
let touch = false;
export function setTouchHints(on) { touch = !!on; }
export function isTouchHints() { return touch; }

// ordered: whole sentences first, then phrases, then single keys
const RULES = [
  ['운전: W/S 가속 · A/D 조향 · Shift 부스트 · Space 브레이크 · E 하차', '운전: 스틱 위·아래로 가속·후진, 좌우로 조향 · 끝까지 밀면 부스트 · 가속 · 브레이크 · 하차 버튼'],
  ['도로 — 좌클릭으로 시작점, 다시 좌클릭으로 이어서 깔기 · 우클릭 끊기 · Esc 종료', '도로 — 설치 버튼으로 시작점, 다시 눌러 이어서 깔기 · 연결 끊기 · 취소로 종료'],
  ['배치 — 좌클릭 설치 · 휠 회전 · 우클릭/Esc 취소', '배치 — 설치 버튼 · ↺ ↻ 15° · 90° 회전 · 취소'],
  ['구조물을 조준하고 좌클릭을 길게 누르세요', '구조물을 조준하고 해체 버튼을 길게 누르세요'],
  ['지형 도구 — 좌클릭 올리기 · 우클릭 파기 · Shift+좌클릭 평탄화 · 휠 반경', '지형 도구 — 돋우기 · 깎기 · 평탄화 · 붓 크게/작게 버튼'],
  ['좌클릭 설치 · 휠/R 회전 · 우클릭 취소', '설치 버튼 · ↺ ↻ 15° · 90° 회전 · 취소'],
  ['좌클릭 길게 · F 종료', '해체 버튼 길게 · 취소로 종료'],
  ['좌클릭 지점 · 우클릭 끊기 · Esc 종료', '설치 버튼으로 지점 · 연결 끊기 · 취소로 종료'],
  ['좌클릭 올리기 · 우클릭 파기 · Shift 평탄화', '돋우기 · 깎기 · 평탄화 버튼'],
  ['좌클릭으로 설치 · R/휠 회전', '설치 버튼 · 90° 회전 · ↺ ↻ 15°'],
  ['좌클릭으로 시작', '설치 버튼으로 시작'],
  ['좌클릭으로 도로 시작점을 찍으세요', '설치 버튼으로 도로 시작점을 찍으세요'],
  ['<b>좌클릭을 누르고 있으면</b>', '<b>채집 버튼을 누르고 있으면</b>'],
  ['좌클릭 유지', '채집 버튼 유지'],
  ['<span class="key">E</span>', '<span class="key">사용</span>'],
  ['<span class="key">좌클릭</span>', '<span class="key">채집</span>'],
  ['E로 탑승', '사용 버튼으로 탑승'],
  ['<b>Tab</b>을 눌러', '<b>가방</b> 버튼을 눌러'],
  ['<b>B</b>로', '<b>건설</b> 버튼으로'],
  ['<b>J</b>로', '<b>연구</b> 버튼으로'],
  ['<b>E</b>로', '<b>사용</b> 버튼으로'],
  ['<b>N</b>으로', '<b>더보기 → 로버</b> 버튼으로'],
  ['<b>Tab</b>', '<b>가방</b>'], ['<b>B</b>', '<b>건설</b>'], ['<b>J</b>', '<b>연구</b>'], ['<b>M</b>', '<b>지도</b>'],
  ['<b>E</b>', '<b>사용</b>'], ['<b>N</b>', '<b>더보기 → 로버</b>'], ['<b>F</b>', '<b>더보기 → 해체</b>'], ['<b>G</b>', '<b>더보기 → 지형 도구</b>'],
  ['좌클릭', '채집 버튼'], ['우클릭', '취소'], ['Esc', '취소'],
];

export function touchify(s) {
  if (!touch || typeof s !== 'string' || !s) return s;
  for (const [a, b] of RULES) if (s.includes(a)) s = s.split(a).join(b);
  return s;
}
