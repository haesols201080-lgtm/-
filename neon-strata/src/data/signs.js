// Signage copy for KAIROS-9. Written the way real Korean street signs are: 상호 + 업종, 층수, 전화,
// with this world's trades mixed in (의체 정비, 산소 충전, 럭스 환전 …).
// tpl: panel | channel | trad | cross | chain | neon | tech    hue: accent family

export const SHOPS = [
  ['할매손국수', '손칼국수 · 수제비', 'trad', 'red'],
  ['새벽국밥', '24시 돼지국밥 · 순대', 'panel', 'red'],
  ['은하포차', '실내포장마차', 'neon', 'pink'],
  ['달무리분식', '떡볶이 · 김밥 · 라면', 'panel', 'yellow'],
  ['삼거리 숯불구이', '배양육 전문', 'panel', 'red'],
  ['궤도치킨', '후라이드 · 양념 · 간장', 'chain', 'orange'],
  ['미리내만두', '찐만두 · 군만두', 'panel', 'white'],
  ['광장해장국', '선지 · 뼈해장국', 'trad', 'cream'],
  ['불티꼬치', '닭꼬치 · 어묵', 'neon', 'amber'],
  ['안개주점', '소주 · 막걸리 · 전', 'trad', 'dark'],
  ['노을다방', '쌍화차 · 원두커피', 'channel', 'amber'],
  ['김밥나라', '24시 · 포장 · 배달', 'panel', 'orange'],
  ['별빛호프', '생맥주 · 노가리', 'neon', 'cyan'],
  ['심야식당 달', '야식 · 혼밥 환영', 'channel', 'white'],
  ['한빛약국', '처방조제 · 방독필터', 'cross', 'green'],
  ['새봄의원', '내과 · 호흡기', 'cross', 'blue'],
  ['가온치과', '임플란트 · 교정', 'panel', 'blue'],
  ['청운고시텔', '월세 · 일일 숙박', 'panel', 'blue'],
  ['궤도여인숙', '숙박 · 대실', 'neon', 'red'],
  ['캡슐텔 0번지', '1박 12럭스', 'tech', 'cyan'],
  ['누리전당포', '의체 · 귀금속 · 기억칩', 'panel', 'yellow'],
  ['대성부동산', '분양 · 임대 · 고도권', 'panel', 'green'],
  ['하늘세탁', '수선 · 방진복', 'panel', 'white'],
  ['명성이발관', '남성컷 · 면도', 'trad', 'cream'],
  ['오로라헤어', '펌 · 염색 · 홀로컬러', 'channel', 'pink'],
  ['행운복권방', '럭스 로또 · 즉석', 'panel', 'yellow'],
  ['별무리노래방', '최신곡 · 홀로무대', 'neon', 'violet'],
  ['은성사우나', '찜질 · 수면실 · 24시', 'panel', 'red'],
  ['의체정비소', '관절 · 구동계 · 도색', 'tech', 'amber'],
  ['뉴럴클리닉', '신경 인터페이스', 'tech', 'cyan'],
  ['드론수리', '매입 · 판매 · 개조', 'panel', 'orange'],
  ['기억보관소', '백업 · 복원 · 삭제', 'tech', 'violet'],
  ['산소충전소', '캔 · 탱크 · 정기권', 'chain', 'cyan'],
  ['럭스환전', '수수료 최저 · 즉시', 'panel', 'yellow'],
  ['배터리교환', '30초 완충', 'chain', 'green'],
  ['홀로사진관', '증명 · 가족 · 영정', 'channel', 'white'],
  ['사이버안과', '렌즈 이식 · 교정', 'cross', 'cyan'],
  ['칩 개통', '해킹 방지 · 명의 변경', 'panel', 'white'],
  ['합성장기은행', '간 · 신장 · 각막', 'tech', 'red'],
  ['궤도택배', '당일 · 고층 배송', 'chain', 'yellow'],
  ['고도면허 대행', '서류 · 시험 · 갱신', 'panel', 'blue'],
  ['미래독서실', '스터디 · 수면캡슐', 'panel', 'green'],
  ['형제철물', '공구 · 배관 · 열쇠', 'panel', 'red'],
  ['제일전파사', '수리 · 중고 · 안테나', 'panel', 'blue'],
  ['풍년쌀상회', '합성미 · 잡곡', 'trad', 'cream'],
  ['바다횟집', '양식 광어 · 우럭', 'panel', 'blue'],
  ['엄마손반찬', '김치 · 밑반찬', 'trad', 'red'],
  ['우리마트', '식자재 · 생필품', 'chain', 'green'],
  ['총각네 과일', '수경재배 · 당일수확', 'panel', 'yellow'],
  ['풀다이브방', '가상현실 · 24시', 'tech', 'pink'],
  ['황금당', '금 · 은 · 럭스칩 매입', 'trad', 'gold'],
  ['중앙열쇠', '도어락 · 생체인증', 'panel', 'yellow'],
  ['태양광 수리', '패널 · 축전지', 'panel', 'orange'],
  ['필터나라', '방독면 · 정화통', 'chain', 'blue'],
  ['빛나라조명', 'LED · 네온 · 홀로', 'neon', 'cyan'],
  ['구름다리 여관', '장기 투숙 환영', 'trad', 'dark'],
];

// vertical projecting signs: [stacked text, bottom tag, tpl, hue]
export const BLADES = [
  ['손국수', '1층', 'trad', 'red'], ['약국', '', 'cross', 'green'], ['여인숙', '숙박', 'neon', 'red'], ['전당포', '2층', 'panel', 'yellow'],
  ['치과', '3층', 'panel', 'blue'], ['노래방', '지하', 'neon', 'violet'], ['사우나', '24시', 'panel', 'red'], ['포차', '', 'neon', 'pink'],
  ['호프', '2층', 'neon', 'cyan'], ['복권', '', 'panel', 'yellow'], ['이발', '', 'trad', 'cream'], ['세탁', '', 'panel', 'white'],
  ['정비소', '의체', 'tech', 'amber'], ['환전', '럭스', 'panel', 'yellow'], ['충전', '산소', 'chain', 'cyan'], ['캡슐텔', '24시', 'tech', 'cyan'],
  ['고시텔', '월세', 'panel', 'blue'], ['만두', '', 'panel', 'white'], ['국밥', '24시', 'panel', 'red'], ['다방', '2층', 'channel', 'amber'],
  ['부동산', '', 'panel', 'green'], ['철물', '', 'panel', 'red'], ['의원', '4층', 'cross', 'blue'], ['택배', '', 'chain', 'yellow'],
  ['필터', '', 'chain', 'blue'], ['꼬치', '', 'neon', 'amber'], ['분식', '', 'panel', 'yellow'], ['미용실', '2층', 'channel', 'pink'],
  ['주점', '지하', 'trad', 'dark'], ['풀다이브', '3층', 'tech', 'pink'], ['횟집', '', 'panel', 'blue'], ['마트', '', 'chain', 'green'],
];

// large format advertising: [headline, subline, brand id, motif]
export const ADS = [
  ['빛은 권리입니다', '광량 정기권 — 월 40럭스부터', 'helion', 'sun'],
  ['강철은 약속을 지킨다', '반타 중공업 · 창립 212주년', 'vanta', 'beam'],
  ['하늘길, 15분 배송', '에테르 물류 고층 직배', 'aether', 'orbit'],
  ['당신의 럭스를 정오에', '메리디안 은행 · 예금 연 3.1%', 'meridian', 'lines'],
  ['내일의 식탁을 기릅니다', '버던트 바이오 수경 농장', 'verdant', 'leaf'],
  ['밤은 끝나지 않는다', '루미나 스트립 · 매일 밤', 'lumina', 'rings'],
  ['모두에게 한 칸의 빛', '하이브 주거공사 입주자 모집', 'hive', 'hex'],
  ['기억은 가장 오래된 화폐', '아카이브 기억 신탁', 'archive', 'bars'],
  ['고도 면허 3급 접수 중', '고도관리국 · 스파이어 1층 민원실', 'gov', 'arrow'],
  ['산성비 주의보', '우산은 생명입니다 — 시 재난본부', 'gov', 'rain'],
  ['구름 위 분양 개시', '제니스 레지던스 · 햇빛이 드는 집', 'helion', 'sun'],
  ['럭세이드', '한 모금의 햇빛 · 제로 슈거', 'lumina', 'can'],
  ['궤도 정착지 이주 신청', '새로운 하늘, 새로운 시작', 'aether', 'orbit'],
  ['스카이웨일 홀로쇼', '매일 밤 9시 · 루미나 상공', 'lumina', 'whale'],
  ['의체 할부 0%', '반타 메디컬 · 36개월 무이자', 'vanta', 'beam'],
  ['숨 쉴 권리', '산소 정기 배송 · 첫 달 무료', 'verdant', 'leaf'],
];

export const TICKERS = [
  '럭스 지수 ▲ 2.4%   ·   헬리온 광업 ▲ 1.1%   ·   반타 중공업 ▼ 0.8%   ·   에테르 물류 ▲ 3.6%   ·   고도 면허 3급 접수 중   ·   오늘 밤 산성비 주의보   ·   ',
  '침전층 7구역 배수 작업 중 — 우회 바랍니다   ·   마그레브 순환선 정상 운행   ·   스파이어 승강기 B 점검   ·   분실 드론 신고 119-7   ·   ',
  'OPEN 24H   ·   합성육 구이 1+1   ·   산소캔 3개 10럭스   ·   의체 무료 점검   ·   기억 백업 당일 완료   ·   LUX 결제 환영   ·   ',
];

export const DECALS = ['07', '12', 'A', 'B', '출구', '하역', '주차', '금연', '임대', '위험', '고압', 'P'];
export const NOTICES = ['관계자 외 출입금지', 'CCTV 작동중', '침수 주의', '고압 주의', '낙하물 주의', '화물 하역장', '제3격벽', '비상 대피로'];

export const BRANDS = {
  helion: { name: 'HELION', ko: '헬리온', color: '#ffc45a', alt: '#ff7a1a' },
  vanta: { name: 'VANTA', ko: '반타 중공업', color: '#ff5a3c', alt: '#ffb199' },
  aether: { name: 'AETHER', ko: '에테르 물류', color: '#58d6ff', alt: '#b7f3ff' },
  meridian: { name: 'MERIDIAN', ko: '메리디안 은행', color: '#7df9d0', alt: '#e8fff8' },
  verdant: { name: 'VERDANT', ko: '버던트 바이오', color: '#9dff6a', alt: '#ff4fd8' },
  lumina: { name: 'LUMINA', ko: '루미나', color: '#ff3fa4', alt: '#a56bff' },
  hive: { name: 'HIVE', ko: '하이브 주거공사', color: '#ffd9a0', alt: '#ff9966' },
  archive: { name: 'ARCHIVE', ko: '아카이브', color: '#c9b8ff', alt: '#7fd4ff' },
  gov: { name: 'KAIROS-9', ko: '카이로스 시청', color: '#e8eef5', alt: '#8fb4d8' },
};

// every glyph the sign fonts must contain (used by tools/build-fonts.py)
export function signCharset() {
  const s = new Set();
  const add = (t) => { for (const ch of t) s.add(ch); };
  for (const r of SHOPS) { add(r[0]); add(r[1]); }
  for (const r of BLADES) { add(r[0]); add(r[1]); }
  for (const r of ADS) { add(r[0]); add(r[1]); }
  for (const t of TICKERS) add(t);
  for (const t of DECALS) add(t);
  for (const t of NOTICES) add(t);
  for (const k in BRANDS) { add(BRANDS[k].name); add(BRANDS[k].ko); }
  add('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz .,·-—+%:/()☎▲▼↑↓←→층지하시럭스영업중배달포장전화국번');
  return [...s].join('');
}
