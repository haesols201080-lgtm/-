// 실내의 낱말 모음 (v0.9): 층의 쓰임 · 방의 종류 · 가구·장비. 생성기·그리기·운영·지도·모아가 모두 이 표를 함께 읽는다.
//  · 실제 시설의 짜임(마트의 매장·창고·직원실·하역장, 병원의 접수·진료·검사·병동, 공장의 원료·공정·완성품·관제…)을 따르고,
//    그 위에 아웬 문명의 기술(공명 부양·빛판·결정 기억·생체 섬유·노래 장치)을 얹었다. 이름만 보아도 무엇을 하는 곳인지 알게.

// ── 층의 쓰임 ─────────────────────────────────────────────
// plan: ring(가운데 심 둘레 복도 + 바깥 방) · open(넓은 홀 + 뒤쪽 일하는 방) · gallery(이어진 전시실) · house(한 집) · hall(높은 한 공간 + 중2층)
// mod: 층 높이 = 외벽 모듈 × mod (외벽의 창 띠와 맞는다) · roomd: 복도에서 바깥벽까지 방 깊이(m) · op: 운영(시뮬레이션) 종류
export const FUSE = {
  lobby: { name: '로비', plan: 'open', mod: 2, op: 'lobby', pub: true },
  mart: { name: '마트', plan: 'open', mod: 1, op: 'mart', pub: true },
  shops: { name: '상가', plan: 'open', mod: 1, op: 'mart', pub: true, shops: true },
  dept: { name: '백화점', plan: 'open', mod: 1, op: 'mart', pub: true, dept: true },
  food: { name: '식당가', plan: 'open', mod: 1, op: 'food', pub: true, court: true },
  cafe: { name: '찻집', plan: 'open', mod: 1, op: 'food', pub: true },
  office: { name: '사무실', plan: 'ring', mod: 1, op: 'office', roomd: 9 },
  research: { name: '연구실', plan: 'ring', mod: 1, op: 'lab', roomd: 10 },
  clinic: { name: '진료', plan: 'ring', mod: 1, op: 'clinic', roomd: 8, pub: true },
  ward: { name: '병동', plan: 'ring', mod: 1, op: 'clinic', roomd: 8 },
  diag: { name: '검사·영상', plan: 'ring', mod: 1, op: 'clinic', roomd: 9, pub: true },
  confer: { name: '회의·교육층', plan: 'ring', mod: 1, op: 'office', roomd: 10 },
  exec: { name: '임원층', plan: 'ring', mod: 1, op: 'office', roomd: 9 },
  care: { name: '응급·접수', plan: 'open', mod: 1, op: 'clinic', pub: true, front: true },
  school: { name: '교실', plan: 'ring', mod: 1, op: 'school', roomd: 9 },
  schoolhall: { name: '체육관·강당', plan: 'hall', mod: 2, op: 'school', pub: true },
  canteen: { name: '급식실', plan: 'open', mod: 1, op: 'food', pub: true },
  faculty: { name: '교무·행정', plan: 'ring', mod: 1, op: 'office', roomd: 9 },
  library: { name: '서가', plan: 'open', mod: 1, op: 'library', pub: true },
  museum: { name: '전시실', plan: 'gallery', mod: 1, op: 'museum', pub: true },
  hall: { name: '공연장', plan: 'hall', mod: 2, op: 'hall', pub: true },
  admin: { name: '행정', plan: 'ring', mod: 1, op: 'admin', roomd: 9 },
  civic: { name: '민원실', plan: 'open', mod: 1, op: 'admin', pub: true },
  residential: { name: '주거', plan: 'ring', mod: 1, op: 'home', roomd: 9 },
  house: { name: '집', plan: 'house', mod: 1, op: 'home' },
  hotel: { name: '객실', plan: 'ring', mod: 1, op: 'hotel', roomd: 8 },
  hotelfront: { name: '호텔 로비', plan: 'open', mod: 2, op: 'hotel', pub: true },
  factory: { name: '생산동', plan: 'hall', mod: 2, op: 'factory' },
  storage: { name: '창고', plan: 'hall', mod: 2, op: 'depot' },
  transit: { name: '대합실', plan: 'hall', mod: 2, op: 'terminal', pub: true },
  farm: { name: '재배실', plan: 'open', mod: 1, op: 'farm' },
  garden: { name: '실내 정원', plan: 'open', mod: 2, op: 'garden', pub: true },
  plant: { name: '발전동', plan: 'hall', mod: 2, op: 'plant' },
  tech: { name: '설비층', plan: 'ring', mod: 1, op: 'tech', roomd: 9 },
  parking: { name: '뜬차 주차', plan: 'open', mod: 1, op: 'parking' },
  supply: { name: '물품·설비', plan: 'open', mod: 1, op: 'tech' },
  amenity: { name: '하늘 쉼터', plan: 'open', mod: 1, op: 'amenity', pub: true },
  observation: { name: '전망층', plan: 'open', mod: 1, op: 'observation', pub: true },
  mezz: { name: '중2층', plan: 'open', mod: 1, op: 'mezz' },
  stem: { name: '현관', plan: 'open', mod: 1, op: 'lobby', pub: true },
};

// ── 방의 종류 ─────────────────────────────────────────────
// acc: public(누구나) staff(일하는 사람) private(사는 사람·묵는 사람) / win: 창이 있어야 좋은 방 / glass: 유리 칸막이
// fl·wl·cl: 바닥·벽·천장 무늬 종류 (material.js) · tone: 빛깔 역할(pal 의 어느 색) · lux: 천장 빛 세기
export const ROOMS = {
  corridor: { name: '복도', acc: 'public', fl: 'strip', cl: 'strip', tone: 'base', lux: 0.8 },
  lifthall: { name: '승강기 홀', acc: 'public', fl: 'stone', cl: 'coffer', tone: 'base', lux: 1 },
  stair: { name: '계단', acc: 'public', fl: 'plain', cl: 'plain', tone: 'base', lux: 0.8 },
  lift: { name: '승강기', acc: 'public', fl: 'plain', cl: 'plain', tone: 'base' },
  cargo: { name: '화물 승강기', acc: 'staff', fl: 'plain', cl: 'plain', tone: 'base' },
  shaft: { name: '설비 관', acc: 'none', fl: 'plain', tone: 'base' },
  // 로비·공용
  lobby: { name: '로비', acc: 'public', win: true, fl: 'stone', cl: 'coffer', tone: 'brand', lux: 1.1 },
  reception: { name: '안내대', acc: 'public', win: true, fl: 'stone', cl: 'coffer', tone: 'brand', lux: 1 },
  mailroom: { name: '우편함실', acc: 'private', fl: 'tile', cl: 'plain', tone: 'base', lux: 0.9 },
  security: { name: '관리실', acc: 'staff', fl: 'tile', cl: 'plain', tone: 'base', lux: 0.9 },
  wc: { name: '정화실', acc: 'public', fl: 'tile', wl: 'tile', cl: 'plain', tone: 'cool', lux: 0.9 },
  storage: { name: '창고', acc: 'staff', fl: 'plain', cl: 'plain', tone: 'base', lux: 0.6 },
  kiosk: { name: '작은 가게', acc: 'public', win: true, fl: 'tile', cl: 'coffer', tone: 'brand', lux: 1.1 },
  lounge: { name: '휴게실', acc: 'public', win: true, fl: 'carpet', cl: 'coffer', tone: 'warm', lux: 0.9 },
  // 사무
  open: { name: '업무 공간', acc: 'staff', win: true, fl: 'carpet', cl: 'strip', tone: 'brand', lux: 1 },
  meeting: { name: '회의실', acc: 'staff', win: true, glass: true, fl: 'carpet', cl: 'coffer', tone: 'brand', lux: 1 },
  manager: { name: '책임자실', acc: 'staff', win: true, glass: true, fl: 'carpet', cl: 'coffer', tone: 'warm', lux: 0.9 },
  pantry: { name: '탕비실', acc: 'staff', win: true, fl: 'tile', cl: 'plain', tone: 'warm', lux: 1 },
  server: { name: '결정 기억실', acc: 'staff', fl: 'grid', cl: 'grid', tone: 'cool', lux: 0.7 },
  hr: { name: '채용 면접실', acc: 'public', win: true, glass: true, fl: 'carpet', cl: 'coffer', tone: 'brand', lux: 1 },
  records: { name: '기록 보관실', acc: 'staff', fl: 'plain', cl: 'plain', tone: 'base', lux: 0.7 },
  // 연구
  labroom: { name: '실험실', acc: 'staff', win: true, glass: true, fl: 'grid', cl: 'grid', tone: 'cool', lux: 1.2 },
  instrument: { name: '장비실', acc: 'staff', fl: 'grid', cl: 'grid', tone: 'cool', lux: 1 },
  coldroom: { name: '시료 냉장실', acc: 'staff', fl: 'grid', cl: 'plain', tone: 'cool', lux: 0.8 },
  cleanroom: { name: '청정실', acc: 'staff', glass: true, fl: 'plain', cl: 'grid', tone: 'cool', lux: 1.3 },
  analysis: { name: '분석실', acc: 'staff', win: true, glass: true, fl: 'carpet', cl: 'strip', tone: 'cool', lux: 1 },
  // 마트·가게
  sales: { name: '매장', acc: 'public', win: true, fl: 'tile', cl: 'grid', tone: 'brand', lux: 1.3 },
  stockroom: { name: '물품 창고', acc: 'staff', fl: 'plain', cl: 'truss', tone: 'base', lux: 0.8 },
  staffroom: { name: '직원실', acc: 'staff', fl: 'tile', cl: 'plain', tone: 'warm', lux: 0.9 },
  dock: { name: '하역장', acc: 'staff', fl: 'plain', cl: 'truss', tone: 'base', lux: 0.8 },
  office1: { name: '사무실', acc: 'staff', win: true, fl: 'carpet', cl: 'plain', tone: 'base', lux: 0.9 },
  // 먹고 마시기
  dining: { name: '식사 공간', acc: 'public', win: true, fl: 'wood', cl: 'coffer', tone: 'warm', lux: 0.9 },
  kitchen: { name: '주방', acc: 'staff', fl: 'tile', wl: 'tile', cl: 'plain', tone: 'cool', lux: 1.2 },
  pantry2: { name: '식재료 창고', acc: 'staff', fl: 'tile', cl: 'plain', tone: 'cool', lux: 0.8 },
  stall: { name: '식당 칸', acc: 'public', fl: 'tile', cl: 'coffer', tone: 'brand', lux: 1.1 },
  // 진료
  waiting: { name: '대기실', acc: 'public', win: true, fl: 'stone', cl: 'coffer', tone: 'cool', lux: 1 },
  consult: { name: '진료실', acc: 'public', win: true, fl: 'plain', cl: 'plain', tone: 'cool', lux: 1.1 },
  scan: { name: '울림 검사실', acc: 'public', fl: 'grid', cl: 'grid', tone: 'cool', lux: 0.9 },
  treat: { name: '치료실', acc: 'public', fl: 'plain', cl: 'plain', tone: 'cool', lux: 1 },
  wardroom: { name: '입원실', acc: 'private', win: true, fl: 'plain', cl: 'plain', tone: 'cool', lux: 0.8 },
  nurse: { name: '간호 자리', acc: 'staff', fl: 'plain', cl: 'coffer', tone: 'cool', lux: 1.1 },
  pharmacy: { name: '약제실', acc: 'public', fl: 'tile', cl: 'plain', tone: 'cool', lux: 1.1 },
  // 학교
  classroom: { name: '교실', acc: 'public', win: true, fl: 'wood', cl: 'strip', tone: 'warm', lux: 1.1 },
  sciroom: { name: '과학실', acc: 'public', win: true, fl: 'grid', cl: 'grid', tone: 'cool', lux: 1.1 },
  musicroom: { name: '노래실', acc: 'public', win: true, fl: 'wood', cl: 'coffer', tone: 'warm', lux: 1 },
  teachers: { name: '교무실', acc: 'staff', win: true, fl: 'carpet', cl: 'plain', tone: 'base', lux: 1 },
  gym: { name: '뜀터', acc: 'public', win: true, fl: 'court', cl: 'truss', tone: 'brand', lux: 1.2 },
  canteen: { name: '급식실', acc: 'public', win: true, fl: 'tile', cl: 'strip', tone: 'warm', lux: 1.1 },
  // 서고·박물관·공연
  stacks: { name: '서가', acc: 'public', win: true, fl: 'carpet', cl: 'coffer', tone: 'warm', lux: 0.9 },
  reading: { name: '열람실', acc: 'public', win: true, fl: 'wood', cl: 'coffer', tone: 'warm', lux: 1 },
  archive: { name: '결정 서고', acc: 'staff', fl: 'plain', cl: 'plain', tone: 'base', lux: 0.6 },
  gallery: { name: '전시실', acc: 'public', fl: 'stone', cl: 'coffer', tone: 'brand', lux: 0.9 },
  conserve: { name: '보존 처리실', acc: 'staff', fl: 'grid', cl: 'grid', tone: 'cool', lux: 1.1 },
  giftshop: { name: '기념품 가게', acc: 'public', win: true, fl: 'tile', cl: 'coffer', tone: 'brand', lux: 1.1 },
  auditorium: { name: '객석', acc: 'public', fl: 'carpet', cl: 'truss', tone: 'brand', lux: 0.5 },
  stage: { name: '무대', acc: 'staff', fl: 'wood', cl: 'truss', tone: 'warm', lux: 1 },
  backstage: { name: '무대 뒤', acc: 'staff', fl: 'plain', cl: 'plain', tone: 'base', lux: 0.8 },
  foyer: { name: '휴게 홀', acc: 'public', win: true, fl: 'stone', cl: 'coffer', tone: 'brand', lux: 1 },
  rehearsal: { name: '연습실', acc: 'staff', win: true, fl: 'wood', cl: 'plain', tone: 'warm', lux: 1 },
  // 행정
  counters: { name: '민원 창구', acc: 'public', win: true, fl: 'stone', cl: 'coffer', tone: 'brand', lux: 1.1 },
  council: { name: '의회실', acc: 'public', win: true, fl: 'carpet', cl: 'coffer', tone: 'warm', lux: 1 },
  // 주거·호텔
  unit: { name: '집', acc: 'private', win: true, fl: 'wood', cl: 'plain', tone: 'warm', lux: 0.9 },
  living: { name: '거실', acc: 'private', win: true, fl: 'wood', cl: 'plain', tone: 'warm', lux: 0.9 },
  bedroom: { name: '잠방', acc: 'private', win: true, fl: 'carpet', cl: 'plain', tone: 'soft', lux: 0.7 },
  kitchen1: { name: '부엌', acc: 'private', win: true, fl: 'tile', cl: 'plain', tone: 'warm', lux: 1 },
  bath: { name: '씻는 방', acc: 'private', fl: 'tile', wl: 'tile', cl: 'plain', tone: 'cool', lux: 0.9 },
  entry: { name: '현관', acc: 'private', fl: 'tile', cl: 'plain', tone: 'base', lux: 0.9 },
  balcony: { name: '발코니', acc: 'private', win: true, glass: true, fl: 'wood', cl: 'plain', tone: 'soft', lux: 0.85 },
  guestroom: { name: '객실', acc: 'private', win: true, fl: 'carpet', cl: 'coffer', tone: 'soft', lux: 0.8 },
  housekeeping: { name: '객실 관리실', acc: 'staff', fl: 'plain', cl: 'plain', tone: 'base', lux: 0.9 },
  laundry: { name: '세탁실', acc: 'staff', fl: 'tile', cl: 'plain', tone: 'cool', lux: 1 },
  // 생산·물류·발전·농장
  production: { name: '생산 공정', acc: 'staff', win: true, fl: 'epoxy', cl: 'truss', tone: 'base', lux: 1.2 },
  rawstore: { name: '원료 창고', acc: 'staff', fl: 'epoxy', cl: 'truss', tone: 'base', lux: 0.8 },
  finished: { name: '완성품 창고', acc: 'staff', fl: 'epoxy', cl: 'truss', tone: 'base', lux: 0.8 },
  control: { name: '관제실', acc: 'staff', win: true, glass: true, fl: 'grid', cl: 'grid', tone: 'cool', lux: 0.8 },
  maint: { name: '정비실', acc: 'staff', fl: 'epoxy', cl: 'plain', tone: 'base', lux: 1 },
  warehouse: { name: '보관 구역', acc: 'staff', fl: 'epoxy', cl: 'truss', tone: 'base', lux: 0.9 },
  sorting: { name: '분류 구역', acc: 'staff', fl: 'epoxy', cl: 'truss', tone: 'base', lux: 1.1 },
  concourse: { name: '대합실', acc: 'public', win: true, fl: 'stone', cl: 'truss', tone: 'brand', lux: 1.1 },
  platform: { name: '승강장', acc: 'public', fl: 'stone', cl: 'truss', tone: 'base', lux: 1 },
  ticket: { name: '표 파는 곳', acc: 'public', fl: 'stone', cl: 'coffer', tone: 'brand', lux: 1.1 },
  corehall: { name: '공명 핵', acc: 'staff', fl: 'epoxy', cl: 'truss', tone: 'base', lux: 0.8 },
  coilroom: { name: '코일실', acc: 'staff', fl: 'epoxy', cl: 'plain', tone: 'base', lux: 0.9 },
  fuelstore: { name: '연료 결정고', acc: 'staff', fl: 'epoxy', cl: 'plain', tone: 'base', lux: 0.7 },
  growhall: { name: '재배실', acc: 'staff', win: true, fl: 'epoxy', cl: 'grow', tone: 'leaf', lux: 1.2 },
  packing: { name: '포장실', acc: 'staff', fl: 'epoxy', cl: 'plain', tone: 'base', lux: 1.1 },
  nutrient: { name: '양분 탱크실', acc: 'staff', fl: 'epoxy', cl: 'plain', tone: 'cool', lux: 0.9 },
  gardenhall: { name: '실내 정원', acc: 'public', win: true, fl: 'moss', cl: 'grow', tone: 'leaf', lux: 1.1 },
  parkbay: { name: '주차 칸', acc: 'public', fl: 'epoxy', cl: 'plain', tone: 'base', lux: 0.7 },
  mech: { name: '공명 설비실', acc: 'staff', fl: 'epoxy', cl: 'plain', tone: 'base', lux: 0.7 },
  gymroom: { name: '뜀 운동실', acc: 'public', win: true, fl: 'court', cl: 'strip', tone: 'brand', lux: 1.1 },
  pool: { name: '울림 욕장', acc: 'public', win: true, fl: 'tile', cl: 'coffer', tone: 'cool', lux: 0.9 },
  deck: { name: '전망 데크', acc: 'public', win: true, fl: 'wood', cl: 'coffer', tone: 'warm', lux: 0.7 },
  bar: { name: '하늘 찻집', acc: 'public', win: true, fl: 'wood', cl: 'coffer', tone: 'warm', lux: 0.7 },
  vestibule: { name: '현관 홀', acc: 'public', fl: 'stone', cl: 'plain', tone: 'base', lux: 1 },
};

// ── 가구·장비 ─────────────────────────────────────────────
// w×d: 바닥 자리(m, 로컬 x×z, 앞 = +z) · h: 높이 · wall: 등을 벽에 댄다 · front: 앞에 비워 둘 거리(쓰는 사람이 서는 곳)
// use: 상호작용 열쇠 (ops 가 잇는다) · slots: 물건 칸 수 · solid: 막힘 (기본 true)
export const FIX = {
  // 공용
  plant: { name: '빛깃 화분', w: 0.9, d: 0.9, h: 1.6, round: true },
  bench: { name: '긴 의자', w: 2.0, d: 0.6, h: 0.5 },
  sofa: { name: '구름 의자', w: 2.2, d: 0.9, h: 0.8, wall: true, front: 0.6 },
  lowtable: { name: '낮은 탁자', w: 1.2, d: 0.7, h: 0.45 },
  armchair: { name: '둥근 의자', w: 0.9, d: 0.9, h: 0.8, round: true },
  infokiosk: { name: '안내 빛판', w: 0.8, d: 0.6, h: 1.8, front: 1.0, use: 'directory' },
  terminal: { name: '울림판 단말', w: 0.9, d: 0.6, h: 1.4, front: 1.0, use: 'terminal' },
  vending: { name: '나눔 기계', w: 1.0, d: 0.7, h: 1.9, wall: true, front: 1.0, use: 'vending', slots: 6 },
  water: { name: '샘물 기둥', w: 0.5, d: 0.5, h: 1.3, wall: true, front: 0.8, round: true },
  reception: { name: '안내대', w: 3.2, d: 1.0, h: 1.05, front: 1.6, back: 1.2, use: 'desk' },
  mailbox: { name: '우편함', w: 2.4, d: 0.5, h: 1.8, wall: true, front: 1.0, use: 'mail' },
  lockers: { name: '보관함', w: 2.0, d: 0.55, h: 1.9, wall: true, front: 1.0, use: 'locker' },
  timeclock: { name: '출근 단말', w: 0.6, d: 0.3, h: 1.5, wall: true, front: 1.0, use: 'clock' },
  wcstall: { name: '정화대 칸', w: 1.2, d: 1.5, h: 2.1, wall: true, front: 0.9 },
  sink: { name: '씻는 대', w: 1.6, d: 0.6, h: 0.9, wall: true, front: 0.9 },
  cabinet: { name: '수납장', w: 1.4, d: 0.5, h: 1.9, wall: true, front: 0.8 },
  art: { name: '빛 조형', w: 1.0, d: 1.0, h: 2.6, round: true },
  // 사무
  desk: { name: '책상', w: 1.6, d: 0.8, h: 0.75, front: 0.9, use: 'desk', seat: true },
  meettable: { name: '회의 탁자', w: 3.0, d: 1.4, h: 0.75, front: 0.9, seats: 6 },
  board: { name: '빛 칠판', w: 2.6, d: 0.2, h: 1.8, wall: true, front: 1.5 },
  printer: { name: '빛판 찍개', w: 1.0, d: 0.7, h: 1.1, wall: true, front: 0.9 },
  rack: { name: '결정 기억 선반', w: 0.8, d: 1.1, h: 2.1, front: 0.9 },
  // 마트
  gondola: { name: '진열대', w: 1.2, d: 3.6, h: 1.7, front: 0, use: 'shelf', slots: 8, aisle: true },
  wallshelf: { name: '벽 진열대', w: 3.0, d: 0.6, h: 2.0, wall: true, front: 1.4, use: 'shelf', slots: 6 },
  chiller: { name: '서늘 진열대', w: 2.4, d: 0.9, h: 2.0, wall: true, front: 1.4, use: 'shelf', slots: 6, cold: true },
  produce: { name: '열매 진열섬', w: 2.0, d: 1.4, h: 0.95, front: 0, use: 'shelf', slots: 4, island: true },
  checkout: { name: '계산대', w: 2.4, d: 0.9, h: 1.0, front: 1.2, back: 1.0, use: 'checkout' },
  selfcheck: { name: '셀프 계산대', w: 0.9, d: 0.7, h: 1.3, front: 1.1, use: 'checkout' },
  baskets: { name: '바구니 쌓개', w: 0.7, d: 0.7, h: 0.8, front: 0.8, use: 'basket' },
  gate: { name: '나가는 문살', w: 0.3, d: 1.2, h: 1.0 },
  stockrack: { name: '물품 선반', w: 2.4, d: 1.0, h: 2.4, front: 1.2, use: 'stock', slots: 6 },
  pallet: { name: '짐판', w: 1.2, d: 1.2, h: 1.2, front: 1.0, use: 'pallet', slots: 1 },
  docklevel: { name: '하역 문', w: 3.0, d: 0.4, h: 3.2, wall: true, front: 3.0, use: 'dock' },
  handcart: { name: '뜬수레', w: 0.9, d: 1.4, h: 1.0, front: 0.8, use: 'cart' },
  // 먹고 마시기
  counter: { name: '주문대', w: 3.2, d: 0.9, h: 1.05, front: 1.4, back: 1.1, use: 'order' },
  teamachine: { name: '울림차 기계', w: 1.0, d: 0.6, h: 1.2, wall: true, front: 0.9, use: 'cook' },
  stove: { name: '빛 화덕', w: 1.6, d: 0.8, h: 0.95, wall: true, front: 1.1, use: 'cook' },
  prep: { name: '손질대', w: 2.0, d: 0.8, h: 0.95, wall: true, front: 1.1, use: 'prep' },
  coldbox: { name: '서늘함', w: 1.2, d: 0.8, h: 2.0, wall: true, front: 1.1, use: 'ingredients', slots: 6, cold: true },
  dishwash: { name: '그릇 씻개', w: 1.4, d: 0.8, h: 0.95, wall: true, front: 1.0, use: 'dishes' },
  table2: { name: '두 사람 식탁', w: 0.9, d: 0.9, h: 0.75, round: true, front: 0, seats: 2, use: 'table' },
  table4: { name: '네 사람 식탁', w: 1.3, d: 1.3, h: 0.75, round: true, front: 0, seats: 4, use: 'table' },
  display: { name: '진열 유리장', w: 1.8, d: 0.7, h: 1.2, front: 1.0, use: 'shelf', slots: 4 },
  // 연구
  labbench: { name: '실험대', w: 3.0, d: 1.2, h: 0.95, front: 1.1, use: 'bench' },
  hood: { name: '증기 흡입대', w: 1.6, d: 0.8, h: 2.2, wall: true, front: 1.1, use: 'bench' },
  spectro: { name: '울림 분광기', w: 1.6, d: 1.2, h: 1.5, front: 1.2, use: 'instrument' },
  grower: { name: '결정 생장로', w: 1.4, d: 1.4, h: 1.9, round: true, front: 1.2, use: 'instrument' },
  scanner: { name: '공명 스캐너', w: 2.6, d: 1.6, h: 2.0, front: 1.2, use: 'instrument' },
  freezer: { name: '시료 냉장고', w: 1.2, d: 0.8, h: 2.0, wall: true, front: 1.1, use: 'samples', slots: 6, cold: true },
  analysis: { name: '분석 단말', w: 1.6, d: 0.8, h: 0.75, front: 0.9, use: 'analysis', seat: true },
  // 학교
  sdesk: { name: '학생 책상', w: 1.2, d: 0.6, h: 0.7, front: 0.7, seat: true, use: 'student' },
  tdesk: { name: '선생님 책상', w: 1.6, d: 0.8, h: 0.75, front: 0.9, use: 'teacher' },
  instrumentrack: { name: '노래 악기', w: 1.8, d: 0.6, h: 1.2, wall: true, front: 1.0 },
  canteenline: { name: '급식대', w: 4.0, d: 0.9, h: 1.0, front: 1.4, back: 1.0, use: 'order' },
  hoop: { name: '뜀 고리', w: 1.2, d: 0.6, h: 3.2, wall: true, front: 3 },
  // 진료
  examdesk: { name: '진료 책상', w: 1.4, d: 0.7, h: 0.75, front: 0.9, use: 'doctor', seat: true },
  exambed: { name: '진료 침상', w: 2.0, d: 0.8, h: 0.7, wall: true, front: 1.0, use: 'bed' },
  bed: { name: '돌봄 침상', w: 2.1, d: 1.0, h: 0.8, wall: true, front: 1.0, use: 'bed' },
  treatpod: { name: '울림 치료 고치', w: 2.4, d: 1.2, h: 1.4, front: 1.1, use: 'treat' },
  nursedesk: { name: '간호대', w: 3.0, d: 0.9, h: 1.05, front: 1.4, back: 1.0, use: 'nurse' },
  medshelf: { name: '약 선반', w: 2.4, d: 0.5, h: 2.0, wall: true, front: 1.1, use: 'stock', slots: 6 },
  seats: { name: '대기 의자 줄', w: 3.0, d: 0.7, h: 0.5, front: 0.8, use: 'wait' },
  // 서고·박물관·공연·행정
  bookshelf: { name: '기록 결정 서가', w: 3.0, d: 0.6, h: 2.2, front: 1.2, use: 'books', slots: 6 },
  bookcase: { name: '작은 서가', w: 1.5, d: 0.5, h: 2.2, front: 1.0, use: 'books', slots: 3 },
  readtable: { name: '열람 탁자', w: 2.4, d: 1.2, h: 0.75, front: 0.9, seats: 6, use: 'read' },
  catalog: { name: '찾기 단말', w: 0.8, d: 0.6, h: 1.2, front: 1.0, use: 'catalog' },
  plinth: { name: '전시대', w: 1.2, d: 1.2, h: 1.1, front: 1.3, round: true, use: 'exhibit' },
  case: { name: '전시 유리장', w: 2.4, d: 0.7, h: 1.6, wall: true, front: 1.3, use: 'exhibit' },
  bigexhibit: { name: '큰 전시물', w: 3.0, d: 3.0, h: 3.2, front: 1.5, round: true, use: 'exhibit' },
  restore: { name: '보존 작업대', w: 2.2, d: 1.0, h: 0.95, front: 1.1, use: 'restore' },
  seatrow: { name: '객석 줄', w: 6.0, d: 0.9, h: 0.9, front: 0, seats: 8, use: 'seat' },
  stageplat: { name: '무대', w: 8.0, d: 5.0, h: 0.9, front: 0, walk: true },
  lightrig: { name: '빛 조종대', w: 1.6, d: 0.8, h: 1.1, front: 1.0, use: 'lights' },
  ticketbooth: { name: '표 파는 창구', w: 2.4, d: 1.0, h: 1.05, front: 1.4, back: 1.0, use: 'tickets' },
  servicecounter: { name: '민원 창구', w: 2.0, d: 0.9, h: 1.05, front: 1.4, back: 1.0, use: 'civic' },
  numbers: { name: '번호표 기둥', w: 0.5, d: 0.5, h: 1.4, round: true, front: 0.9, use: 'queue' },
  counciltable: { name: '둥근 의회 탁자', w: 5.0, d: 5.0, h: 0.75, round: true, front: 1.0, seats: 10 },
  // 주거·호텔
  bedpod: { name: '잠 고치', w: 2.1, d: 1.5, h: 1.0, wall: true, front: 0.9, use: 'sleep' },
  bedpod1: { name: '작은 잠 고치', w: 2.0, d: 1.0, h: 0.9, wall: true, front: 0.8, use: 'sleep' },
  wardrobe: { name: '옷 고치', w: 1.2, d: 0.6, h: 2.0, wall: true, front: 0.8, use: 'storage' },
  kcounter: { name: '부엌 조리대', w: 2.4, d: 0.6, h: 0.92, wall: true, front: 1.0, use: 'cook' },
  kitchenette: { name: '작은 조리대', w: 1.2, d: 0.6, h: 0.92, wall: true, front: 0.9, use: 'cook' },
  dtable: { name: '식탁', w: 1.6, d: 0.9, h: 0.75, front: 0.8, seats: 4, use: 'eat' },
  washpod: { name: '씻는 고치', w: 1.4, d: 1.0, h: 2.1, wall: true, front: 0.8 },
  wc1: { name: '정화대', w: 0.7, d: 0.7, h: 0.5, wall: true, front: 0.7 },
  shelfh: { name: '책장', w: 1.6, d: 0.4, h: 1.8, wall: true, front: 0.8 },
  hkcart: { name: '정돈 수레', w: 1.0, d: 0.6, h: 1.1, front: 0.8, use: 'cart' },
  washer: { name: '세탁 고치', w: 1.0, d: 0.8, h: 1.2, wall: true, front: 1.0, use: 'laundry' },
  // 생산·물류
  machine: { name: '울림 성형기', w: 2.6, d: 2.0, h: 2.4, front: 1.4, use: 'machine' },
  kiln: { name: '빛가마', w: 2.4, d: 2.4, h: 2.8, round: true, front: 1.4, use: 'machine' },
  assembler: { name: '조립 팔', w: 2.2, d: 1.8, h: 2.2, front: 1.4, use: 'machine' },
  packer: { name: '포장기', w: 2.0, d: 1.6, h: 1.8, front: 1.3, use: 'machine' },
  conveyor: { name: '띠 실어 나르개', w: 1.0, d: 4.0, h: 0.9, front: 0 },
  bins: { name: '원료 통', w: 2.0, d: 1.0, h: 1.3, wall: true, front: 1.2, use: 'stock', slots: 4 },
  qcbench: { name: '검사대', w: 2.2, d: 1.0, h: 0.95, front: 1.1, use: 'qc' },
  console: { name: '관제 조종대', w: 2.4, d: 1.0, h: 1.1, front: 1.1, use: 'console' },
  toolrack: { name: '연장 걸이', w: 2.0, d: 0.5, h: 2.0, wall: true, front: 1.0, use: 'tools' },
  forklift: { name: '뜬짐차', w: 1.2, d: 2.2, h: 2.0, front: 1.0 },
  bigrack: { name: '높은 짐 선반', w: 2.6, d: 1.2, h: 3.6, front: 1.4, use: 'stock', slots: 8 },
  sorter: { name: '분류 띠', w: 1.4, d: 6.0, h: 1.0, front: 1.2, use: 'sort' },
  dronepad: { name: '짐 드론 자리', w: 2.4, d: 2.4, h: 0.2, front: 0.6, round: true, walk: true, use: 'drone' },
  // 교통
  gateline: { name: '타는 문', w: 4.0, d: 0.8, h: 1.1, front: 1.6, back: 1.6, use: 'gate' },
  ticketm: { name: '표 기계', w: 1.0, d: 0.7, h: 1.7, front: 1.1, use: 'tickets' },
  departures: { name: '떠나는 판', w: 3.6, d: 0.3, h: 2.2, wall: true, front: 2.0, use: 'departures' },
  bay: { name: '타는 곳', w: 6.0, d: 3.2, h: 0.3, front: 0, walk: true, use: 'board' },
  // 발전·농장
  core: { name: '공명 핵', w: 5.0, d: 5.0, h: 5.5, round: true, front: 2.0, use: 'core' },
  coil: { name: '공명 코일', w: 2.0, d: 2.0, h: 3.4, round: true, front: 1.2, use: 'coil' },
  pump: { name: '식힘 펌프', w: 2.0, d: 1.4, h: 1.8, front: 1.1, use: 'pump' },
  fuelrack: { name: '연료 결정 선반', w: 2.4, d: 1.0, h: 2.2, front: 1.2, use: 'stock', slots: 6 },
  growrack: { name: '재배 선반', w: 1.2, d: 4.0, h: 2.6, front: 0, use: 'crop', aisle: true },
  growbed: { name: '재배 이랑', w: 1.4, d: 4.0, h: 0.7, front: 0, use: 'crop', aisle: true },
  growbox: { name: '재배 상자', w: 1.2, d: 2.0, h: 1.4, front: 0.8, use: 'crop' },
  tank: { name: '양분 탱크', w: 1.8, d: 1.8, h: 2.4, round: true, front: 1.1, use: 'nutrient' },
  packtable: { name: '포장 탁자', w: 2.4, d: 1.0, h: 0.95, front: 1.1, use: 'pack' },
  crates: { name: '거둔 것 상자', w: 1.2, d: 1.2, h: 1.0, front: 1.0, use: 'stock', slots: 2 },
  // 주차·설비·쉼터
  hovercar: { name: '뜬차', w: 2.2, d: 4.4, h: 1.5, front: 0.8 },
  mechunit: { name: '공명 설비', w: 2.4, d: 1.6, h: 2.2, front: 1.1, use: 'mech' },
  pooltub: { name: '울림 욕조', w: 6.0, d: 4.0, h: 0.5, front: 1.0, walk: false },
  floatpad: { name: '뜀 운동판', w: 1.4, d: 1.4, h: 0.4, round: true, front: 0.8, use: 'exercise' },
  scope: { name: '별 망원기', w: 0.9, d: 0.9, h: 1.6, round: true, front: 1.0, use: 'scope' },
  barcounter: { name: '하늘 찻집 대', w: 3.6, d: 0.9, h: 1.05, front: 1.4, back: 1.1, use: 'order' },
};

/** 층 쓰임 → 그 층의 방 짜임(운영 쪽 이름) */
export const OP_NAME = {
  lobby: '로비', mart: '가게', food: '식당', office: '회사', lab: '연구소', clinic: '치유원', school: '학교', library: '서고', museum: '박물관',
  hall: '공연장', admin: '행정청', home: '주거', hotel: '호텔', factory: '공장', depot: '물류 창고', terminal: '터미널', farm: '농장',
  garden: '정원', plant: '발전소', tech: '설비', parking: '주차장', amenity: '쉼터', observation: '전망대', mezz: '중2층',
};

/** 방 사이 칸막이 두께 (칸 경계 가운데에 선다 — 두 방에 반씩): render.partitions 가 그리고, furnish 가 벽에 붙는 가구를 그만큼 띄운다 */
export const PART_T = 0.14;
/**
 * 방의 가장 작은 크기 (v24): [그 방 안에 들어가야 하는 정사각형 한 변(칸 = m), 넓이(m²)]. 이보다 작으면 「좁은 방」.
 * 바깥 껍데기에 맞추려 방을 찌그러뜨리지 않는다 — 실내 배율(program.interiorScale)과 방 나누기(layout)가 이 값을 지킨다. 큰 방은 상한 없음.
 * 여기 없는 방은 [2, 4]. 복도·홀·심(계단·승강기·관)·발코니는 따로.
 */
export const MIN_FIT = {
  classroom: [4, 24], sciroom: [4, 20], musicroom: [3, 12], auditorium: [5, 40], gym: [5, 40], canteen: [4, 24], stacks: [3, 16], reading: [3, 12],
  gallery: [4, 20], council: [4, 20], rehearsal: [3, 12], stage: [4, 16], warehouse: [4, 30], production: [4, 30], sorting: [4, 20], platform: [3, 20],
  concourse: [3, 16], growhall: [4, 24], gardenhall: [4, 24], pool: [4, 24], gymroom: [3, 16], open: [3, 12], labroom: [3, 12], wardroom: [3, 12],
  dining: [3, 12], kitchen: [2, 8], sales: [3, 12], lobby: [3, 12], waiting: [3, 9], lounge: [3, 9], foyer: [3, 12], living: [3, 10], unit: [3, 15],
  guestroom: [3, 9], bedroom: [3, 8], meeting: [3, 9], manager: [3, 9], consult: [3, 9], treat: [3, 9], scan: [3, 9], office1: [3, 9], control: [3, 9],
  teachers: [3, 9], dock: [3, 12], counters: [3, 9], rawstore: [3, 9], finished: [3, 9], corehall: [3, 9], coilroom: [3, 9], packing: [3, 9], parkbay: [3, 12],
  staffroom: [2, 6], nurse: [2, 6], pharmacy: [2, 6], hr: [2, 6], instrument: [2, 6], cleanroom: [2, 6], analysis: [2, 6], stockroom: [2, 6], archive: [2, 6],
  conserve: [2, 6], giftshop: [2, 6], backstage: [2, 6], laundry: [2, 6], maint: [2, 6], fuelstore: [2, 6], nutrient: [2, 6], deck: [2, 6], bar: [2, 6], kitchen1: [2, 5],
};
export const MIN_FIT_SKIP = new Set(['corridor', 'lifthall', 'stair', 'lift', 'cargo', 'shaft', 'balcony', 'vestibule', 'entry']);
export const minFit = (type) => MIN_FIT[type] || [2, 4];
/** 방 R(번호 id) 안에 들어가는 가장 큰 정사각형 한 변 (칸) — 0/1 격자에서 가장 큰 정사각 */
export function fitSide(room, gw, gh, id) { return fitSideIds(room, gw, gh, id, id); }
/** 방 번호 a 또는 b 인 칸들(두 방을 합친다면)에 들어가는 가장 큰 정사각형 한 변 */
export function fitSideIds(room, gw, gh, a, b) {
  const dp = new Uint16Array(gw * gh);
  let best = 0;
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    const c = j * gw + i;
    if (room[c] !== a && room[c] !== b) continue;
    const v = i && j ? Math.min(dp[c - 1], dp[c - gw], dp[c - gw - 1]) + 1 : 1;
    dp[c] = v;
    if (v > best) best = v;
  }
  return best;
}
/** 사람이 오가는 공간(복도·승강기 홀·로비·넓은 홀)끼리는 벽 없이 이어진다 — 그리기(render)·걸음 칸(nav)·검사가 같은 규칙 */
export function flowRoom(R) { return !!R && (R.circ || (R.main && !R.boh)) && !['stair', 'lift', 'cargo', 'shaft'].includes(R.type) && !R.sealed; }

