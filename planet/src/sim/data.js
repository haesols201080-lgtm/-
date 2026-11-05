// Game data: items, recipes, buildings, terraforming stages, research tree,
// population tiers and eras. Pure data — systems read from here.

export const ITEMS = {
  iron: { name: '철', desc: '붉은 산화철 광석. 철판의 재료.', color: '#b4532f', shape: 'ore' },
  silicon: { name: '규소', desc: '회청색 규산염 광석. 유리와 회로의 재료.', color: '#8fa6bd', shape: 'ore' },
  titanium: { name: '티타늄', desc: '가볍고 단단한 은빛 광석.', color: '#d6dbe2', shape: 'ore' },
  aluminium: { name: '알루미늄', desc: '창백한 경금속 광석.', color: '#e2dccb', shape: 'ore' },
  cobalt: { name: '코발트', desc: '푸르게 빛나는 결정. 회로에 쓰인다.', color: '#2f6dff', shape: 'ore' },
  ice: { name: '얼음', desc: '크레이터 바닥의 물 얼음.', color: '#a7e3ff', shape: 'ore' },
  uranium: { name: '우라늄', desc: '녹색으로 빛나는 방사성 결정.', color: '#52ff6b', shape: 'ore' },
  plate: { name: '철판', desc: '표준 구조재.', color: '#9aa3ab', shape: 'plate' },
  glass: { name: '유리', desc: '여압 유리 패널.', color: '#9fe3ea', shape: 'glass' },
  alloy: { name: '합금', desc: '티타늄 강화 합금 잉곳.', color: '#c9cfd8', shape: 'ingot' },
  circuit: { name: '회로', desc: '코발트 배선 회로 기판.', color: '#3ac08a', shape: 'chip' },
  water: { name: '물', desc: '정수된 물 팩.', color: '#46b4ff', shape: 'drop' },
  food: { name: '식량', desc: '수경 농장에서 기른 식량 상자.', color: '#9bd25a', shape: 'leaf' },
  goods: { name: '생활용품', desc: '정착민의 일상 용품.', color: '#f0a65a', shape: 'box' },
  electronics: { name: '전자기기', desc: '단말기와 가전 부품.', color: '#ffd35a', shape: 'chip2' },
  fuelrod: { name: '연료봉', desc: '우라늄 연료봉. 원자로 연료.', color: '#7dff8c', shape: 'rod' },
  seeds: { name: '씨앗', desc: '배양실에서 개량한 행성 적응 씨앗.', color: '#c6e070', shape: 'seed' },
};

export const RECIPES = [
  { id: 'plate', out: { plate: 1 }, in: { iron: 2 }, time: 4, name: '철판' },
  { id: 'glass', out: { glass: 1 }, in: { silicon: 2 }, time: 4, name: '유리' },
  { id: 'alloy', out: { alloy: 1 }, in: { titanium: 2, iron: 1 }, time: 6, name: '합금' },
  { id: 'circuit', out: { circuit: 1 }, in: { silicon: 1, cobalt: 1 }, time: 6, name: '회로' },
  { id: 'water', out: { water: 2 }, in: { ice: 1 }, time: 3, name: '물' },
  { id: 'seeds', out: { seeds: 2 }, in: { water: 1, ice: 1 }, time: 6, name: '씨앗', research: 'r_bio' },
  { id: 'fuelrod', out: { fuelrod: 1 }, in: { uranium: 2, alloy: 1 }, time: 10, name: '연료봉', research: 'r_fission' },
  { id: 'goods', out: { goods: 2 }, in: { plate: 1, glass: 1, water: 1 }, time: 8, name: '생활용품', research: 'r_goods', factoryOnly: true },
  { id: 'electronics', out: { electronics: 1 }, in: { circuit: 1, alloy: 1, aluminium: 1 }, time: 10, name: '전자기기', research: 'r_electronics', factoryOnly: true },
];

// Terraforming stages (Ti thresholds). Structure follows The Planet Crafter's
// stage ladder; values are compressed for a few hours of play.
export const STAGES = [
  { id: 'barren', name: '불모의 대지', ti: 0, desc: '얇은 대기, 먼지 낀 하늘, 영하의 지표.' },
  { id: 'bluesky', name: '푸른 하늘', ti: 1000, desc: '기압이 올라 하늘이 푸르게 산란되기 시작합니다.' },
  { id: 'clouds', name: '구름', ti: 3000, desc: '수증기가 응결해 첫 구름이 떠오릅니다.' },
  { id: 'rain', name: '비', ti: 8000, desc: '구름에서 비가 내리기 시작합니다.' },
  { id: 'water', name: '액체 물', ti: 20000, desc: '얼음이 녹아 분지 바닥에 물이 고입니다.' },
  { id: 'lakes', name: '호수', ti: 50000, desc: '수위가 올라 분지와 크레이터가 호수가 됩니다.' },
  { id: 'moss', name: '이끼', ti: 110000, desc: '습한 저지대부터 이끼가 퍼집니다.' },
  { id: 'flora', name: '초원', ti: 220000, desc: '풀과 꽃이 대지를 덮기 시작합니다.' },
  { id: 'trees', name: '숲', ti: 420000, desc: '첫 나무들이 자라 숲을 이룹니다.' },
  { id: 'insects', name: '곤충', ti: 750000, desc: '꽃가루를 나르는 곤충이 날아다닙니다.' },
  { id: 'breathable', name: '숨쉬는 대기', ti: 1300000, desc: '헬멧 없이도 숨쉴 수 있는 대기가 되었습니다.' },
  { id: 'fauna', name: '생명의 행성', ti: 2200000, desc: '새와 동물들이 행성에 정착합니다.' },
  { id: 'complete', name: '완전한 테라포밍', ti: 4000000, desc: '행성이 스스로 순환하는 생태계를 갖췄습니다.' },
];

export const PARAMS = {
  heat: { name: '열', unit: 'pK', color: '#ff8a4c' },
  pressure: { name: '기압', unit: 'nPa', color: '#c49bff' },
  oxygen: { name: '산소', unit: 'ppq', color: '#63d0ff' },
  biomass: { name: '바이오매스', unit: 'g', color: '#7fdc6a' },
};

// Population tiers (Anno-style). needs: basic needs add residents; luxury add happiness/income.
export const TIERS = [
  { id: 'pioneer', name: '개척민', color: '#e9b46a', base: 2, max: 10, tax: 0.6, basic: ['water', 'food', 'power', 'market'], luxury: ['lounge'],
    upgrade: null },
  { id: 'tech', name: '기술자', color: '#7fd6ff', base: 4, max: 18, tax: 1.3, basic: ['water', 'food', 'power', 'market', 'clinic', 'goods'], luxury: ['lounge', 'park'],
    upgrade: { cost: { alloy: 2, glass: 4, credits: 60 }, research: 'r_goods' } },
  { id: 'engineer', name: '공학자', color: '#b39bff', base: 6, max: 26, tax: 2.2, basic: ['water', 'food', 'power', 'market', 'clinic', 'goods', 'school', 'electronics'], luxury: ['lounge', 'park', 'culture'],
    upgrade: { cost: { alloy: 4, circuit: 2, glass: 4, credits: 150 }, research: 'r_education' } },
  { id: 'citizen', name: '시민', color: '#ffe27a', base: 8, max: 36, tax: 3.6, basic: ['water', 'food', 'power', 'market', 'clinic', 'goods', 'school', 'electronics', 'culture'], luxury: ['park', 'lounge'],
    upgrade: { cost: { alloy: 6, electronics: 4, glass: 6, credits: 300 }, research: 'r_culture' } },
];

// colonists answering an invitation, by terraforming stage reached
export const WAVES = { clouds: 6, rain: 8, water: 10, lakes: 12, moss: 14, flora: 16, trees: 20, insects: 24, breathable: 30, fauna: 36, complete: 40 };
export const SHIPS = ['개척선 새벽별호', '이민선 아우로라', '수송선 헬리오스 7', '정착선 푸른등대', '이주선 오디세이아', '개척선 은하수', '수송선 카론', '정착선 첫걸음'];

export const NEED_NAMES = {
  water: '물', food: '식량', power: '전력', market: '배급소', clinic: '의료소', goods: '생활용품',
  school: '학교', electronics: '전자기기', culture: '문화 센터', lounge: '라운지', park: '공원',
};

export const ERAS = [
  { id: 1, name: '전초기지', desc: '홀로 착륙한 개척자의 시대' },
  { id: 2, name: '정착지', desc: '식민 본부를 세우고 첫 정착민을 맞이합니다', req: { building: 'hq' } },
  { id: 3, name: '마을', desc: '기술자 계층이 자리 잡은 마을', req: { pop: 40, tier: ['tech', 10] } },
  { id: 4, name: '도시', desc: '공학자와 산업이 자라나는 도시', req: { pop: 120, tier: ['engineer', 20] } },
  { id: 5, name: '문명', desc: '행성 문명의 탄생', req: { pop: 240, tier: ['citizen', 30], building: 'monument' } },
];

// Buildings. size = [width(x), depth(z)] in metres. power: + generates, - consumes (kW).
// cat: base | power | terra | industry | colony
export const BUILDINGS = {
  pod: { name: '착륙 포드', cat: 'base', size: [4, 4], hidden: true, cost: {}, desc: '당신을 이 행성에 내려준 착륙선. 산소를 보충하고 간단한 제작을 할 수 있습니다.', o2: true, craft: true, storage: 16 },
  habitat: { name: '거주 모듈', cat: 'base', size: [8, 8], cost: { plate: 4, glass: 2 }, desc: '여압된 생활 공간. 안에서 산소가 채워지고, 침대에서 밤을 넘길 수 있으며 작업대와 보관함이 있습니다.', o2: true, craft: true, storage: 24, sleep: true, enter: true },
  foundation: { name: '기초 판', cat: 'base', size: [8, 8], cost: { iron: 2 }, desc: '8×8m 구조 기초. 서로 붙여 넓은 바닥을 만들고, 지형 위로 띄워 지을 수 있습니다.', foundation: true, free: true },
  storage: { name: '보관함', cat: 'base', size: [2, 1.4], cost: { plate: 2 }, desc: '30칸 물품 보관함.', storage: 30 },
  fabricator: { name: '제작대', cat: 'base', size: [3, 2], cost: { iron: 4, silicon: 2 }, desc: '부품을 손으로 제작하는 작업대.', craft: true },
  lamp: { name: '조명탑', cat: 'base', size: [1, 1], cost: { iron: 1, silicon: 1 }, power: -0.3, desc: '밤을 밝히는 조명.', light: true },
  beacon: { name: '비콘', cat: 'base', size: [1, 1], cost: { iron: 1 }, desc: '멀리서도 보이는 위치 표시등. 나침반에 표시됩니다.', beacon: true },

  solar: { name: '태양광 패널', cat: 'power', size: [4, 4], cost: { plate: 2, glass: 2 }, power: 3, desc: '낮에 최대 3 kW를 생산합니다.', solar: true },
  pylon: { name: '송전탑', cat: 'power', size: [1, 1], cost: { iron: 2 }, desc: '전력망을 30m 확장합니다. 가까운 송전탑·시설과 자동으로 연결됩니다.', range: 30 },
  wind: { name: '풍력 터빈', cat: 'power', size: [3, 3], cost: { plate: 3, alloy: 1 }, power: 5, desc: '대기가 짙을수록 많은 전력을 냅니다 (최대 5 kW).', wind: true, research: 'r_wind' },
  reactor: { name: '핵분열 원자로', cat: 'power', size: [8, 8], cost: { alloy: 8, circuit: 4, plate: 8 }, power: 60, desc: '연료봉 1개로 3분간 60 kW를 생산합니다.', fuel: 'fuelrod', fuelTime: 180, research: 'r_fission' },

  heater: { name: '히터', cat: 'terra', size: [3, 3], cost: { iron: 2, silicon: 1 }, power: -1.5, terra: { heat: 1.2 }, desc: '지표를 데워 열(pK)을 올립니다.' },
  drill: { name: '대기 드릴', cat: 'terra', size: [3, 3], cost: { iron: 3, titanium: 1 }, power: -2, terra: { pressure: 1.0 }, desc: '지각의 가스를 뽑아 기압(nPa)을 올립니다.' },
  vegetube: { name: '식물 배양관', cat: 'terra', size: [2.4, 2.4], cost: { glass: 2, plate: 1, ice: 1 }, power: -1, terra: { oxygen: 1.6, biomass: 0.2 }, desc: '밀폐 배양관의 식물이 산소(ppq)를 만듭니다.', unlockStage: 'bluesky' },
  heater2: { name: '히터 T2', cat: 'terra', size: [4, 4], cost: { alloy: 2, plate: 2 }, power: -5, terra: { heat: 9 }, desc: '고출력 히터.', unlockStage: 'clouds' },
  drill2: { name: '대기 드릴 T2', cat: 'terra', size: [4, 4], cost: { alloy: 3, plate: 3 }, power: -6, terra: { pressure: 7 }, desc: '심부 가스 드릴.', unlockStage: 'rain' },
  seeder: { name: '이끼 살포기', cat: 'terra', size: [3, 3], cost: { plate: 2, glass: 1, seeds: 2 }, power: -2, terra: { biomass: 12, oxygen: 4 }, desc: '주변 60m에 이끼와 풀을 먼저 자라게 합니다.', green: 60, unlockStage: 'water', research: 'r_bio' },
  algae: { name: '조류 배양기', cat: 'terra', size: [3, 3], cost: { plate: 3, glass: 2 }, power: -2, terra: { oxygen: 30, biomass: 8 }, desc: '얕은 물(수심 0.5~6m)에 띄워 산소를 대량 생산합니다.', water: true, unlockStage: 'lakes' },
  treespreader: { name: '나무 살포기', cat: 'terra', size: [4, 4], cost: { alloy: 2, glass: 2, seeds: 4 }, power: -4, terra: { biomass: 160, oxygen: 60 }, desc: '주변 80m에 숲을 키웁니다.', green: 80, unlockStage: 'flora' },
  insectdome: { name: '곤충 사육 돔', cat: 'terra', size: [6, 6], cost: { glass: 6, alloy: 3, seeds: 4 }, power: -6, terra: { biomass: 600 }, desc: '꽃가루 매개 곤충을 길러 방사합니다.', unlockStage: 'trees' },
  mirror: { name: '궤도 반사경 송신소', cat: 'terra', size: [8, 8], cost: { alloy: 10, circuit: 6, electronics: 4 }, power: -20, terra: { heat: 1800, pressure: 400 }, desc: '궤도 반사경을 조종해 행성 전체를 데웁니다.', research: 'r_orbital' },

  extractor: { name: '자동 채굴기', cat: 'industry', size: [5, 5], cost: { iron: 6, silicon: 2 }, power: -3, desc: '광맥 위에 설치하면 6초마다 광석을 캐냅니다. 드론망에 연결되면 자동으로 창고로 보냅니다.', deposit: true, buffer: 60, research: 'r_auto' },
  smelter: { name: '정련소', cat: 'industry', size: [6, 5], cost: { plate: 4, iron: 4, silicon: 2 }, power: -4, desc: '드론망의 재료로 철판·유리·합금 등을 자동 생산합니다.', factory: ['plate', 'glass', 'alloy', 'water'], research: 'r_refine' },
  assembler: { name: '조립기', cat: 'industry', size: [6, 6], cost: { plate: 6, alloy: 2, circuit: 1 }, power: -6, desc: '회로·연료봉·씨앗을 자동 생산합니다.', factory: ['circuit', 'fuelrod', 'seeds'], research: 'r_assembly' },
  dronehub: { name: '드론 허브', cat: 'industry', size: [5, 5], cost: { plate: 4, circuit: 2 }, power: -3, desc: '반경 70m 시설들을 물류망으로 묶습니다. 드론이 생산품을 나르며, 공용 창고 100칸이 있습니다.', network: 70, depot: 100, research: 'r_logistics' },
  depot: { name: '물류 창고', cat: 'industry', size: [6, 6], cost: { plate: 6, iron: 4 }, desc: '물류망 공용 저장 용량 +300.', depot: 300, research: 'r_logistics' },

  hq: { name: '식민 본부', cat: 'colony', size: [16, 16], cost: { plate: 20, glass: 10, alloy: 6, circuit: 4 }, power: 12, desc: '식민지의 심장. 반경 90m 물류망, 공용 창고 400, 정착민 셔틀이 내리는 착륙장.', network: 90, depot: 400, o2: true, craft: true, unique: true, enter: true, research: 'r_colony' },
  comms: { name: '심우주 교신기', cat: 'colony', size: [8, 8], cost: { plate: 8, alloy: 3, circuit: 4, glass: 2 }, power: -4, desc: '행성의 상태를 우주로 송신해 정착민을 초청합니다. 대기가 구름 단계에 이르러야 첫 교신에 응답이 옵니다.', comms: true, unique: true, research: 'r_colony', unlockStage: 'bluesky' },
  house: { name: '주거지', cat: 'colony', size: [8, 8], cost: { plate: 6, glass: 4, credits: 0 }, desc: '정착민이 사는 집. 필요가 채워지면 인구가 늘고, 상위 계층으로 업그레이드됩니다.', house: true, research: 'r_colony' },
  farm: { name: '수경 농장', cat: 'colony', size: [8, 12], cost: { plate: 6, glass: 6, ice: 4 }, power: -4, desc: '물 1개로 식량 3개를 기릅니다.', workers: ['pioneer', 4], produce: { food: 3 }, consume: { water: 1 }, cycle: 20, research: 'r_colony' },
  pump: { name: '정수 펌프', cat: 'colony', size: [4, 4], cost: { plate: 3, glass: 1 }, power: -2, desc: '얼음을 녹이거나(물 2) 호숫가에서는 물을 직접 퍼 올립니다(물 3).', workers: ['pioneer', 2], produce: { water: 2 }, consume: { ice: 1 }, cycle: 12, pump: true, research: 'r_colony' },
  market: { name: '배급소', cat: 'colony', size: [8, 8], cost: { plate: 6, glass: 2, credits: 40 }, desc: '반경 45m 주거지에 물·식량·물자를 배급합니다.', workers: ['pioneer', 2], service: 'market', radius: 45, research: 'r_colony' },
  lounge: { name: '라운지', cat: 'colony', size: [7, 7], cost: { plate: 4, glass: 4, credits: 60 }, power: -2, desc: '반경 40m 주민의 행복도와 세수를 높입니다.', workers: ['pioneer', 2], service: 'lounge', radius: 40, research: 'r_medicine' },
  clinic: { name: '의료소', cat: 'colony', size: [8, 8], cost: { plate: 6, glass: 4, alloy: 2, credits: 80 }, power: -3, desc: '반경 50m 기술자 이상 계층의 필수 시설.', workers: ['tech', 2], service: 'clinic', radius: 50, research: 'r_medicine' },
  factory: { name: '생활용품 공장', cat: 'colony', size: [10, 8], cost: { plate: 8, alloy: 2, circuit: 1, credits: 100 }, power: -6, desc: '철판·유리·물로 생활용품을 만듭니다.', workers: ['tech', 4], recipe: 'goods', research: 'r_goods' },
  techplant: { name: '전자 공장', cat: 'colony', size: [10, 10], cost: { alloy: 6, circuit: 4, glass: 4, credits: 180 }, power: -10, desc: '회로·합금·알루미늄으로 전자기기를 만듭니다.', workers: ['engineer', 4], recipe: 'electronics', research: 'r_electronics' },
  school: { name: '학교', cat: 'colony', size: [10, 8], cost: { plate: 8, glass: 6, credits: 150 }, power: -3, desc: '반경 55m 공학자 이상 계층의 필수 시설.', workers: ['tech', 3], service: 'school', radius: 55, research: 'r_education' },
  lab: { name: '연구소', cat: 'colony', size: [8, 8], cost: { plate: 6, glass: 4, circuit: 3, credits: 120 }, power: -5, desc: '연구 점수를 만듭니다 (공학자 4명).', workers: ['engineer', 4], research_rp: 0.6, research: 'r_education' },
  terminal: { name: '연구 단말기', cat: 'base', size: [2, 2], cost: { iron: 3, silicon: 3, cobalt: 1 }, power: -2, desc: '혼자서도 쓸 수 있는 소형 연구 장비. 연구 점수를 천천히 만듭니다.', research_rp: 0.12 },
  park: { name: '공원', cat: 'colony', size: [10, 10], cost: { plate: 2, seeds: 4, credits: 50 }, desc: '반경 45m 주민 행복도 상승. 초원 단계부터 지을 수 있습니다.', service: 'park', radius: 45, unlockStage: 'flora', research: 'r_roads' },
  culture: { name: '문화 센터', cat: 'colony', size: [12, 12], cost: { alloy: 8, glass: 8, electronics: 2, credits: 300 }, power: -6, desc: '반경 60m 시민 계층의 필수 시설.', workers: ['engineer', 3], service: 'culture', radius: 60, research: 'r_culture' },
  road: { name: '도로', cat: 'colony', size: [4, 8], cost: { iron: 1 }, desc: '정착민과 차량이 다니는 길. 걷는 속도가 빨라집니다.', road: true, research: 'r_roads', free: true },
  monument: { name: '개척자 기념탑', cat: 'colony', size: [10, 10], cost: { alloy: 20, glass: 10, electronics: 6, credits: 800 }, desc: '문명 시대로 나아가기 위한 상징. 주민 전체의 행복도가 오릅니다.', unique: true, research: 'r_monument' },
  elevator: { name: '궤도 엘리베이터', cat: 'colony', size: [16, 16], cost: { alloy: 60, electronics: 20, circuit: 30, glass: 30, credits: 3000 }, power: -40, desc: '행성 문명의 완성. 하늘과 궤도를 잇는 탑.', unique: true, research: 'r_orbital', wonder: true },
};

export const CATEGORIES = [
  { id: 'base', name: '기지' },
  { id: 'power', name: '에너지' },
  { id: 'terra', name: '테라포밍' },
  { id: 'industry', name: '산업' },
  { id: 'colony', name: '식민지' },
];

// Research tree (Civilization-style eras). eureka: exploration finds that boost a tech by 50%.
export const RESEARCH = [
  { id: 'r_auto', name: '자동 채굴', era: 1, cost: 20, req: [], desc: '광맥 위에 자동 채굴기를 세웁니다.' },
  { id: 'r_refine', name: '정련 공학', era: 1, cost: 40, req: ['r_auto'], desc: '정련소로 부품을 자동 생산합니다.' },
  { id: 'r_logistics', name: '드론 물류', era: 1, cost: 60, req: ['r_refine'], desc: '드론 허브와 물류 창고. 시설 간 자동 운송.' },
  { id: 'r_bio', name: '행성 생물학', era: 1, cost: 50, req: [], desc: '씨앗 배양과 이끼 살포기.' },
  { id: 'r_colony', name: '정착 프로토콜', era: 1, cost: 90, req: ['r_logistics'], desc: '식민 본부, 주거지, 농장, 정수 펌프, 배급소.' },
  { id: 'r_wind', name: '풍력 발전', era: 2, cost: 60, req: ['r_colony'], desc: '풍력 터빈.' },
  { id: 'r_assembly', name: '조립 자동화', era: 2, cost: 120, req: ['r_colony'], desc: '조립기로 회로·씨앗·연료봉 자동 생산.' },
  { id: 'r_medicine', name: '의료와 여가', era: 2, cost: 110, req: ['r_colony'], desc: '의료소와 라운지.' },
  { id: 'r_goods', name: '경공업', era: 2, cost: 160, req: ['r_assembly'], desc: '생활용품 공장. 개척민 → 기술자 업그레이드.' },
  { id: 'r_roads', name: '도시 계획', era: 3, cost: 120, req: ['r_goods'], desc: '도로와 공원.' },
  { id: 'r_education', name: '교육', era: 3, cost: 240, req: ['r_goods', 'r_medicine'], desc: '학교와 연구소. 기술자 → 공학자 업그레이드.' },
  { id: 'r_electronics', name: '전자공학', era: 3, cost: 280, req: ['r_education'], desc: '전자 공장.' },
  { id: 'r_fission', name: '핵분열', era: 3, cost: 300, req: ['r_assembly'], desc: '연료봉과 핵분열 원자로.' },
  { id: 'r_culture', name: '문화', era: 4, cost: 420, req: ['r_electronics'], desc: '문화 센터. 공학자 → 시민 업그레이드.' },
  { id: 'r_monument', name: '기념비 건축', era: 4, cost: 380, req: ['r_culture'], desc: '개척자 기념탑.' },
  { id: 'r_orbital', name: '궤도 공학', era: 5, cost: 700, req: ['r_monument', 'r_fission'], desc: '궤도 반사경 송신소와 궤도 엘리베이터.' },
];

export function fmtTi(v) {
  if (v >= 1e9) return (v / 1e9).toFixed(2) + ' G';
  if (v >= 1e6) return (v / 1e6).toFixed(2) + ' M';
  if (v >= 1e3) return (v / 1e3).toFixed(1) + ' k';
  return v.toFixed(0) + ' ';
}
