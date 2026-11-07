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
  copper: { name: '구리', desc: '녹청이 낀 적갈색 광석. 화산대와 층암의 열수 광맥에서 난다.', color: '#c8743f', shape: 'ore' },
  nickel: { name: '니켈', desc: '크레이터 바닥에 묻힌 운석 기원의 은회색 광석.', color: '#a9aa9a', shape: 'ore' },
  sulfur: { name: '황', desc: '화산 분기공 둘레에 맺힌 노란 결정.', color: '#e8cf3a', shape: 'ore' },
  phosphate: { name: '인회석', desc: '층암에서 나는 청록색 인산염 광물. 비료의 재료.', color: '#5fb3a3', shape: 'ore' },
  magnesium: { name: '마그네슘', desc: '소금 평원 증발암의 하얀 광석. 가벼운 합금의 재료.', color: '#e4e6ea', shape: 'ore' },
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
  wire: { name: '구리선', desc: '절연 피복을 입힌 구리 배선 코일.', color: '#d98a4a', shape: 'coil' },
  lightalloy: { name: '경합금', desc: '마그네슘·알루미늄 경량 합금. 높은 주거 타워의 골조.', color: '#e9edf2', shape: 'ingot' },
  battery: { name: '배터리', desc: '니켈·구리 전지 팩. 트램과 대학 설비에 들어간다.', color: '#7ad1a8', shape: 'cell' },
  fertilizer: { name: '비료', desc: '인회석과 황으로 만든 인산 비료.', color: '#b9a46a', shape: 'sack' },
  medicine: { name: '의약품', desc: '배양 씨앗에서 추출한 항생제와 방사선 차단제.', color: '#ff6b7a', shape: 'vial' },
  textiles: { name: '의류', desc: '식물 섬유로 짠 실내복과 작업복.', color: '#7a8cff', shape: 'cloth' },
  delicacy: { name: '온실 과일', desc: '돔 과수원에서 기른 신선한 과일.', color: '#ff9a3c', shape: 'fruit' },
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
  { id: 'wire', out: { wire: 2 }, in: { copper: 2 }, time: 4, name: '구리선', research: 'r_metallurgy' },
  { id: 'lightalloy', out: { lightalloy: 1 }, in: { magnesium: 2, aluminium: 1 }, time: 7, name: '경합금', research: 'r_metallurgy' },
  { id: 'battery', out: { battery: 1 }, in: { nickel: 1, copper: 1 }, time: 8, name: '배터리', research: 'r_battery' },
  { id: 'fertilizer', out: { fertilizer: 2 }, in: { phosphate: 1, sulfur: 1 }, time: 6, name: '비료', research: 'r_agri' },
  { id: 'textiles', out: { textiles: 2 }, in: { seeds: 2, water: 1 }, time: 8, name: '의류', research: 'r_textile', factoryOnly: true },
  { id: 'medicine', out: { medicine: 2 }, in: { sulfur: 1, seeds: 1, water: 1 }, time: 10, name: '의약품', research: 'r_pharma', factoryOnly: true },
  { id: 'delicacy', out: { delicacy: 2 }, in: { fertilizer: 1, water: 2 }, time: 12, name: '온실 과일', research: 'r_agri', factoryOnly: true },
];

// Terraforming stages (Ti thresholds). Structure follows The Planet Crafter's
// stage ladder; values are compressed for a few hours of play.
// Visual milestones keep the original 13 thresholds: sky, water, ice, life
// and fauna are continuous functions of Ti mapped onto these, so the world
// keeps changing smoothly whatever the named stages are.
export const VIS_TI = [0, 1000, 3000, 8000, 20000, 50000, 110000, 220000, 420000, 750000, 1300000, 2200000, 4000000];

// Named stages the player progresses through - many small milestones, each at
// the Ti where its change actually starts to show.
export const STAGES = [
  { id: 'barren', name: '불모의 대지', ti: 0, desc: '얇은 대기, 먼지 낀 하늘, 영하의 지표.' },
  { id: 'warmth', name: '첫 온기', ti: 300, desc: '지표 온도가 오르며 서리가 낮 동안 물러나기 시작합니다.' },
  { id: 'bluesky', name: '푸른 하늘', ti: 1000, desc: '기압이 올라 하늘이 푸르게 산란되기 시작합니다.' },
  { id: 'haze', name: '옅은 안개', ti: 1800, desc: '짙어진 대기에 지평선이 부드럽게 흐려집니다.' },
  { id: 'clouds', name: '구름', ti: 3000, desc: '수증기가 응결해 첫 구름이 떠오릅니다.' },
  { id: 'overcast', name: '두꺼운 구름층', ti: 5000, desc: '구름이 넓게 퍼져 그림자가 대지를 지나갑니다.' },
  { id: 'rain', name: '비', ti: 8000, desc: '구름에서 비가 내리기 시작합니다.' },
  { id: 'thaw', name: '해빙', ti: 13000, desc: '크레이터와 극지의 얼음이 녹기 시작합니다.' },
  { id: 'water', name: '액체 물', ti: 20000, desc: '얼음이 녹아 분지 바닥에 물이 고입니다.' },
  { id: 'ponds', name: '웅덩이', ti: 32000, desc: '낮은 땅마다 물웅덩이가 생깁니다.' },
  { id: 'microbes', name: '미생물', ti: 40000, desc: '따뜻한 물가에 첫 미생물이 번식해 물가가 주황·초록 미생물 막으로 물듭니다.' },
  { id: 'lakes', name: '호수', ti: 50000, desc: '수위가 올라 분지와 크레이터가 호수가 됩니다.' },
  { id: 'algae', name: '조류', ti: 64000, desc: '호수에 조류가 번식해 물빛이 초록으로 바뀌고 산소를 내뿜습니다.' },
  { id: 'lichen', name: '지의류', ti: 78000, desc: '균류와 조류가 함께 사는 지의류가 맨바위에 처음 자리 잡습니다.' },
  { id: 'moss', name: '이끼', ti: 110000, desc: '지의류가 만든 얇은 흙 위로 습한 저지대부터 이끼가 퍼집니다.' },
  { id: 'ferns', name: '양치식물', ti: 150000, desc: '물관을 가진 첫 식물, 고사리가 이끼 사이에서 잎을 폅니다.' },
  { id: 'sprouts', name: '새싹', ti: 185000, desc: '물길을 따라 첫 풀싹이 돋아납니다.' },
  { id: 'flora', name: '초원', ti: 220000, desc: '풀이 대지를 덮기 시작합니다.' },
  { id: 'fish', name: '물고기', ti: 270000, desc: '조류를 먹고 사는 물고기가 호수에 나타납니다.' },
  { id: 'flowers', name: '꽃', ti: 320000, desc: '풀밭 사이로 첫 꽃이 핍니다.' },
  { id: 'trees', name: '침엽수림', ti: 420000, desc: '씨앗으로 번식하는 침엽수가 먼저 숲을 이룹니다.' },
  { id: 'grove', name: '활엽수림', ti: 560000, desc: '넓은 잎의 나무들이 골짜기를 따라 숲을 짙게 만듭니다.' },
  { id: 'insects', name: '곤충', ti: 750000, desc: '꽃가루를 나르는 곤충이 날아다닙니다.' },
  { id: 'bloom', name: '만개', ti: 1000000, desc: '곤충이 꽃가루를 옮기며 꽃과 나무가 한창 무성해집니다.' },
  { id: 'breathable', name: '숨쉬는 대기', ti: 1300000, desc: '헬멧 없이도 숨쉴 수 있는 대기가 되었습니다.' },
  { id: 'birds', name: '새', ti: 1500000, desc: '곤충을 먹이로 삼는 새들이 하늘을 납니다.' },
  { id: 'temperate', name: '온화한 기후', ti: 1700000, desc: '기온과 습도가 안정되어 사계절이 생깁니다.' },
  { id: 'fauna', name: '초식동물', ti: 2200000, desc: '풀을 뜯는 초식동물이 작은 무리를 지어 초원에 나타납니다.' },
  { id: 'thriving', name: '생태계 번성', ti: 3000000, desc: '먹이사슬이 자리 잡아 동물 무리가 커지고 생명이 스스로 늘어납니다.' },
  { id: 'complete', name: '완전한 테라포밍', ti: 4000000, desc: '행성이 스스로 순환하는 생태계를 갖췄습니다.' },
  { id: 'eden', name: '두 번째 지구', ti: 6500000, desc: '누구나 고향이라 부를 수 있는 행성이 되었습니다.' },
];

// Per-parameter milestones (Planet Crafter-style): each parameter has its own
// named thresholds between the planet-wide stages, so progress is felt often.
export const MILESTONES = {
  heat: [
    [60, '첫 열원', '지표에서 처음으로 열이 감지됩니다.'], [400, '영하 60도', '혹한이 조금 누그러졌습니다.'],
    [1500, '영하 40도', '낮에는 서리가 물러납니다.'], [5000, '영하 20도', '얼음이 햇볕에 승화하기 시작합니다.'],
    [15000, '어는점', '지표 온도가 0°C를 넘는 날이 생깁니다.'], [45000, '영상 8도', '물이 얼지 않고 고여 있습니다.'],
    [80000, '영상 12도', '봄날 같은 낮이 이어집니다.'],
    [140000, '영상 15도', '사람이 지내기에 쾌적한 기온입니다.'], [450000, '영상 22도', '따뜻한 바람이 붑니다.'],
    [1200000, '아열대', '골짜기마다 습하고 따뜻한 공기가 머뭅니다.'], [2500000, '열대 저지', '적도 저지대가 덥고 습해집니다.'],
    [5000000, '열 평형', '온실 대기가 스스로 열을 붙잡아 둡니다. 히터 없이도 따뜻합니다.'],
  ],
  pressure: [
    [60, '희미한 대기', '기체 분자가 겨우 감지됩니다.'], [400, '0.005 atm', '먼지가 바람에 실려 날립니다.'],
    [1500, '0.02 atm', '이제 소리가 공기를 타고 전해집니다.'], [5000, '0.08 atm', '하늘의 색이 짙어집니다.'],
    [15000, '0.25 atm', '물이 금방 끓어 없어지지 않습니다.'], [45000, '0.5 atm', '구름이 무겁게 떠다닙니다.'],
    [80000, '0.65 atm', '바람에 실린 먼지가 눈에 띄게 줄어듭니다.'],
    [140000, '0.8 atm', '압력복 없이도 버틸 만한 기압입니다.'], [450000, '1 atm', '지구와 같은 기압에 도달했습니다.'],
    [1200000, '1.2 atm', '풍부한 대기가 행성을 감쌉니다.'], [2500000, '1.3 atm', '바다 수준의 기압이 고원 꼭대기까지 닿습니다.'],
    [5000000, '안정 대기', '자기권과 두꺼운 대기가 균형을 이뤄 공기가 우주로 새지 않습니다.'],
  ],
  oxygen: [
    [60, '산소 흔적', '대기에서 산소 분자가 검출됩니다.'], [400, '산소 0.05%', '자외선을 막는 오존층이 생기기 시작합니다.'],
    [1500, '산소 0.2%', '오존층이 짙어져 하늘이 푸르러집니다.'], [5000, '산소 0.7%', '금속이 녹슬기 시작합니다.'],
    [15000, '산소 2%', '불꽃이 타오를 수 있습니다.'], [45000, '산소 5%', '물속 생물이 숨쉴 수 있습니다.'],
    [80000, '산소 7%', '작은 동물이 숨쉴 수 있는 공기입니다.'],
    [140000, '산소 10%', '숨은 가쁘지만 생존할 수 있는 공기입니다.'], [450000, '산소 16%', '거의 숨쉴 수 있는 공기입니다.'],
    [1200000, '산소 21%', '지구와 같은 공기입니다.'], [2500000, '산소 23%', '불이 잘 붙어 건조한 계절엔 산불을 조심해야 합니다.'],
    [5000000, '산소 순환', '광합성과 호흡이 균형을 이뤄 산소 농도가 스스로 유지됩니다.'],
  ],
  biomass: [
    [5, '첫 미생물', '토양에서 미생물이 번식을 시작합니다.'], [50, '미생물 막', '젖은 바위에 얇은 생물막이 생깁니다.'],
    [400, '남조류', '물웅덩이가 초록빛을 띱니다.'], [2000, '바이오필름', '흙이 생명을 품기 시작합니다.'],
    [8000, '토양 생성', '레골리스가 비옥한 흙으로 바뀝니다.'], [30000, '부엽토', '쓰러진 풀이 흙을 기름지게 합니다.'],
    [70000, '초지 뿌리', '풀뿌리가 흙을 붙잡아 먼지 폭풍이 잦아듭니다.'],
    [120000, '풍부한 토양', '어디든 씨앗이 뿌리내릴 수 있습니다.'], [450000, '생물량 폭증', '생명이 스스로 퍼져 나갑니다.'],
    [1200000, '숲의 무게', '행성의 생물량이 숲을 이룹니다.'], [2500000, '원시림', '수백 년 된 숲처럼 나무가 빽빽합니다.'],
    [5000000, '생명의 행성', '생물량이 지구의 숲에 견줄 만합니다.'],
  ],
};

export const PARAMS = {
  heat: { name: '열', unit: 'pK', color: '#ff8a4c' },
  pressure: { name: '기압', unit: 'nPa', color: '#c49bff' },
  oxygen: { name: '산소', unit: 'ppq', color: '#63d0ff' },
  biomass: { name: '바이오매스', unit: 'g', color: '#7fdc6a' },
};

// Population tiers (Anno-style). needs: basic needs add residents; luxury add
// happiness/income. Each tier adds needs on top of the one below, so a street
// climbs the ladder as the colony learns to make and serve more.
const B0 = ['air', 'water', 'food', 'power', 'market'];
const B1 = [...B0, 'clinic', 'sanitation'], B2 = [...B1, 'goods', 'waste'], B3 = [...B2, 'textiles'], B4 = [...B3, 'school', 'electronics'];
const B5 = [...B4, 'medicine', 'transit'], B6 = [...B5, 'culture', 'security'], B7 = [...B6, 'university'], B8 = [...B7, 'delicacy'];
export const TIERS = [
  { id: 'pioneer', name: '개척민', color: '#e9b46a', base: 2, max: 10, tax: 0.6, basic: B0, luxury: ['lounge'], upgrade: null,
    desc: '돔 하나에 몇 명이 함께 사는 첫 정착민.' },
  { id: 'settler', name: '정착민', color: '#d9835a', base: 3, max: 13, tax: 0.9, basic: B1, luxury: ['lounge', 'gym', 'childcare'],
    upgrade: { cost: { plate: 4, glass: 2, credits: 30 }, research: 'r_medicine' }, desc: '가족을 꾸려 눌러앉은 사람들. 의료소가 가까워야 합니다.' },
  { id: 'tech', name: '기술자', color: '#7fd6ff', base: 4, max: 18, tax: 1.3, basic: B2, luxury: ['lounge', 'gym', 'park', 'childcare'],
    upgrade: { cost: { alloy: 2, glass: 4, credits: 60 }, research: 'r_goods' }, desc: '설비를 고치고 돌리는 기술자.' },
  { id: 'artisan', name: '숙련공', color: '#5fd3a8', base: 5, max: 22, tax: 1.7, basic: B3, luxury: ['lounge', 'gym', 'park', 'childcare'],
    upgrade: { cost: { alloy: 3, wire: 4, credits: 90 }, research: 'r_textile' }, desc: '손재주로 공방을 꾸리는 숙련공. 옷을 지어 입습니다.' },
  { id: 'engineer', name: '공학자', color: '#b39bff', base: 6, max: 26, tax: 2.2, basic: B4, luxury: ['gym', 'park', 'culture'],
    upgrade: { cost: { alloy: 4, circuit: 2, glass: 4, credits: 150, diploma: 2 }, research: 'r_education' }, desc: '학교를 나와 설계를 맡는 공학자.' },
  { id: 'scientist', name: '연구원', color: '#6fa8ff', base: 7, max: 30, tax: 2.8, basic: B5, luxury: ['park', 'culture', 'gym'],
    upgrade: { cost: { lightalloy: 4, circuit: 3, credits: 210, diploma: 3 }, research: 'r_transit' }, desc: '행성을 연구하는 과학자. 약과 교통편이 필요합니다.' },
  { id: 'citizen', name: '시민', color: '#ffe27a', base: 8, max: 36, tax: 3.6, basic: B6, luxury: ['park', 'lounge', 'gym'],
    upgrade: { cost: { alloy: 6, electronics: 4, glass: 6, credits: 300 }, research: 'r_culture' }, desc: '문화를 누리는 도시의 시민.' },
  { id: 'professional', name: '전문직', color: '#ff9fd0', base: 9, max: 42, tax: 4.6, basic: B7, luxury: ['park', 'gym', 'lounge'],
    upgrade: { cost: { lightalloy: 6, battery: 4, electronics: 4, credits: 450, degree: 2 }, research: 'r_university' }, desc: '의사·변호사·설계사. 대학이 가까워야 합니다.' },
  { id: 'notable', name: '명사', color: '#c9f27a', base: 10, max: 48, tax: 5.8, basic: B8, luxury: ['park', 'culture', 'gym'],
    upgrade: { cost: { lightalloy: 8, battery: 6, glass: 10, credits: 650, degree: 3 }, research: 'r_highrise' }, desc: '식민지를 이끄는 명사. 다이아그리드 타워에 삽니다.' },
  { id: 'native', name: '아르케인', color: '#9ff0ff', base: 12, max: 56, tax: 7.2, basic: B8, luxury: ['park', 'culture', 'gym', 'lounge'],
    upgrade: { cost: { lightalloy: 10, electronics: 8, battery: 8, credits: 900, degree: 4 }, research: 'r_native', stage: 'breathable' },
    desc: '아르케에서 나고 자란 첫 세대. 에어록 없는 집에서 바깥 공기를 마십니다.' },
];

// colonists answering an invitation, by terraforming stage reached
export const WAVES = { clouds: 6, rain: 8, water: 10, lakes: 12, moss: 14, flora: 16, trees: 20, insects: 24, breathable: 30, fauna: 36, complete: 40 };
export const SHIPS = ['개척선 새벽별호', '이민선 아우로라', '수송선 헬리오스 7', '정착선 푸른등대', '이주선 오디세이아', '개척선 은하수', '수송선 카론', '정착선 첫걸음', '이민선 마지막 여름', '수송선 베링 12', '정착선 씨앗창고', '이주선 늦은 귀향'];

export const NEED_NAMES = {
  water: '물', food: '식량', power: '전력', market: '배급소', clinic: '의료소', goods: '생활용품',
  school: '학교', electronics: '전자기기', culture: '문화 센터', lounge: '라운지', park: '공원',
  textiles: '의류', medicine: '의약품', delicacy: '온실 과일', gym: '체육관', transit: '트램', university: '대학',
  air: '공기', sanitation: '하수 처리', waste: '쓰레기 수거', security: '치안', childcare: '보육',
};

export const ERAS = [
  { id: 1, name: '전초기지', desc: '홀로 착륙한 개척자의 시대' },
  { id: 2, name: '정착지', desc: '식민 본부를 세우고 첫 정착민을 맞이합니다', req: { building: 'hq' } },
  { id: 3, name: '마을', desc: '정착민 가족이 자리 잡은 마을', req: { pop: 25, tier: ['settler', 8] } },
  { id: 4, name: '소도시', desc: '기술자들이 공장을 돌리는 소도시', req: { pop: 50, tier: ['tech', 12] } },
  { id: 5, name: '공업 도시', desc: '숙련공의 공방에서 물자가 넘쳐나는 도시', req: { pop: 90, tier: ['artisan', 16] } },
  { id: 6, name: '도시', desc: '시청이 행정을 맡고 공학자와 산업이 자라나는 도시', req: { pop: 140, tier: ['engineer', 20], building: 'cityhall' } },
  { id: 7, name: '학술 도시', desc: '연구원이 모여드는 학술 도시', req: { pop: 200, tier: ['scientist', 24] } },
  { id: 8, name: '대도시', desc: '시민 문화가 꽃피는 대도시', req: { pop: 280, tier: ['citizen', 30] } },
  { id: 9, name: '행성 문명', desc: '행성 문명의 탄생', req: { pop: 380, tier: ['professional', 30], building: 'monument' } },
  { id: 10, name: '두 번째 고향', desc: '아르케에서 태어난 세대가 도시를 이끕니다', req: { pop: 500, tier: ['native', 30] } },
];

// Buildings. size = [width(x), depth(z)] in metres. power: + generates, - consumes (kW).
// cat: base | power | terra | industry | colony
export const BUILDINGS = {
  pod: { name: '탐사선 아르케-1', cat: 'base', size: [13, 13], hidden: true, cost: {}, desc: '선발 탐사대와 가압 로버를 싣고 이 행성에 처음 내린 스테인리스 우주선. 화물 승강기 아래에서 산소를 보충하고 간단한 제작을 할 수 있습니다.', o2: true, craft: true, storage: 16 },
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
  seeder: { name: '이끼 살포기', cat: 'terra', size: [3, 3], cost: { plate: 2, glass: 1, seeds: 2 }, power: -2, terra: { biomass: 12, oxygen: 4 }, desc: '지의류·이끼·고사리 포자를 뿌려 주변 60m에서 이 단계의 생명이 먼저 자리 잡게 합니다. 풀과 나무는 퍼뜨리지 못합니다.', green: 60, unlockStage: 'water', research: 'r_bio' },
  algae: { name: '조류 배양기', cat: 'terra', size: [3, 3], cost: { plate: 3, glass: 2 }, power: -2, terra: { oxygen: 30, biomass: 8 }, desc: '얕은 물(수심 0.5~6m)에 띄워 산소를 대량 생산합니다.', water: true, unlockStage: 'ponds' },
  treespreader: { name: '나무 살포기', cat: 'terra', size: [4, 4], cost: { alloy: 2, glass: 2, seeds: 4 }, power: -4, terra: { biomass: 160, oxygen: 60 }, desc: '주변 80m에 숲을 키웁니다.', green: 80, unlockStage: 'flora' },
  insectdome: { name: '곤충 사육 돔', cat: 'terra', size: [6, 6], cost: { glass: 6, alloy: 3, seeds: 4 }, power: -6, terra: { biomass: 600 }, desc: '꽃가루 매개 곤충을 길러 방사합니다.', unlockStage: 'trees' },
  mirror: { name: '궤도 반사경 송신소', cat: 'terra', size: [8, 8], cost: { alloy: 10, circuit: 6, electronics: 4 }, power: -20, terra: { heat: 1800, pressure: 400 }, desc: '궤도 반사경을 조종해 행성 전체를 데웁니다.', research: 'r_orbital' },

  extractor: { name: '자동 채굴기', cat: 'industry', size: [5, 5], cost: { iron: 6, silicon: 2 }, power: -3, desc: '광맥 위에 설치하면 6초마다 광석을 캐냅니다. 드론망에 연결되면 자동으로 창고로 보냅니다.', deposit: true, buffer: 60, research: 'r_auto' },
  smelter: { name: '정련소', cat: 'industry', size: [6, 5], cost: { plate: 4, iron: 4, silicon: 2 }, power: -4, desc: '드론망의 재료로 철판·유리·합금 등을 자동 생산합니다.', factory: ['plate', 'glass', 'alloy', 'water', 'wire', 'lightalloy'], research: 'r_refine' },
  assembler: { name: '조립기', cat: 'industry', size: [6, 6], cost: { plate: 6, alloy: 2, circuit: 1 }, power: -6, desc: '회로·연료봉·씨앗·배터리·비료를 자동 생산합니다.', factory: ['circuit', 'fuelrod', 'seeds', 'battery', 'fertilizer'], research: 'r_assembly' },
  dronehub: { name: '드론 허브', cat: 'industry', size: [5, 5], apron: 2.5, cost: { plate: 4, circuit: 2 }, power: -3, desc: '반경 70m 시설들을 물류망으로 묶습니다. 드론이 생산품을 나르며, 공용 창고 100칸이 있습니다.', network: 70, depot: 100, research: 'r_logistics' },
  depot: { name: '물류 창고', cat: 'industry', size: [6, 6], apron: 2.5, cost: { plate: 6, iron: 4 }, desc: '물류망 공용 저장 용량 +300.', depot: 300, research: 'r_logistics' },

  hq: { name: '식민 본부', cat: 'colony', size: [16, 16], apron: 3, cost: { plate: 20, glass: 10, alloy: 6, circuit: 4 }, power: 12, desc: '식민지의 심장. 반경 90m 물류망, 공용 창고 400, 근처 평지에 이주선 착륙장을 둡니다.', network: 90, depot: 400, o2: true, craft: true, unique: true, enter: true, research: 'r_colony' },
  comms: { name: '심우주 교신기', cat: 'colony', size: [8, 8], apron: 2, cost: { plate: 8, alloy: 3, circuit: 4, glass: 2 }, power: -4, desc: '행성의 상태를 우주로 송신해 정착민을 초청합니다. 대기가 구름 단계에 이르러야 첫 교신에 응답이 옵니다.', comms: true, unique: true, research: 'r_colony', unlockStage: 'bluesky' },
  house: { name: '주거지', cat: 'colony', size: [8, 8], cost: { plate: 6, glass: 4, credits: 0 }, desc: '정착민이 사는 집. 필요가 채워지면 인구가 늘고, 상위 계층으로 업그레이드됩니다.', house: true, research: 'r_colony' },
  farm: { name: '수경 농장', cat: 'colony', size: [8, 12], cost: { plate: 6, glass: 6, ice: 4 }, power: -4, desc: '물 1개로 식량 3개를 기릅니다.', workers: ['pioneer', 4], produce: { food: 3 }, consume: { water: 1 }, cycle: 20, research: 'r_colony' },
  pump: { name: '정수 펌프', cat: 'colony', size: [4, 4], cost: { plate: 3, glass: 1 }, power: -2, desc: '얼음을 녹이거나(물 2) 호숫가에서는 물을 직접 퍼 올립니다(물 3).', workers: ['pioneer', 2], produce: { water: 2 }, consume: { ice: 1 }, cycle: 12, pump: true, research: 'r_colony' },
  market: { name: '배급소', cat: 'colony', size: [8, 8], apron: 2.5, cost: { plate: 6, glass: 2, credits: 40 }, desc: '반경 45m 주거지에 물·식량·생활용품 같은 물자를 배급합니다. 배급소가 없으면 창고에 물자가 있어도 집에 닿지 않습니다.', workers: ['pioneer', 2], service: 'market', radius: 45, research: 'r_colony' },
  lounge: { name: '라운지', cat: 'colony', size: [7, 7], cost: { plate: 4, glass: 4, credits: 60 }, power: -2, desc: '반경 40m 주민이 저녁에 모여 쉬는 곳. 행복한 식민지는 세금을 더 내고, 모든 일터가 더 빨리 일합니다.', workers: ['pioneer', 2], service: 'lounge', radius: 40, research: 'r_medicine' },
  clinic: { name: '의료소', cat: 'colony', size: [8, 8], apron: 2, cost: { plate: 6, glass: 4, alloy: 2, credits: 80 }, power: -3, desc: '반경 50m 주민을 진료합니다. 의료소가 없으면 주민의 15%가 앓아누워 일하지 못합니다. 탐사대원도 여기서 치료받고 산소를 채울 수 있습니다. 정착민 이상 계층의 필수 시설.', workers: ['tech', 2], service: 'clinic', radius: 50, research: 'r_medicine' },
  factory: { name: '생활용품 공장', cat: 'colony', size: [10, 8], cost: { plate: 8, alloy: 2, circuit: 1, credits: 100 }, power: -6, desc: '철판·유리·물로 생활용품을 만듭니다.', workers: ['tech', 4], recipe: 'goods', research: 'r_goods' },
  techplant: { name: '전자 공장', cat: 'colony', size: [10, 10], cost: { alloy: 6, circuit: 4, glass: 4, credits: 180 }, power: -10, desc: '회로·합금·알루미늄으로 전자기기를 만듭니다.', workers: ['engineer', 4], recipe: 'electronics', research: 'r_electronics' },
  school: { name: '학교', cat: 'colony', size: [10, 8], apron: 2, cost: { plate: 8, glass: 6, credits: 150 }, power: -3, desc: '반경 55m 정착민 이상 가정의 아이들을 가르칩니다(최대 40명). 60초마다 수료생이 나오고, 집을 공학자·연구원으로 올리려면 수료생이 필요합니다. 공학자 이상 계층의 필수 시설.', workers: ['tech', 3], service: 'school', radius: 55, research: 'r_education' },
  lab: { name: '연구소', cat: 'colony', size: [8, 8], cost: { plate: 6, glass: 4, circuit: 3, credits: 120 }, power: -5, desc: '연구 점수를 만듭니다 (공학자 4명).', workers: ['engineer', 4], research_rp: 0.6, research: 'r_education' },
  terminal: { name: '연구 단말기', cat: 'base', size: [2, 2], cost: { iron: 3, silicon: 3, cobalt: 1 }, power: -2, desc: '혼자서도 쓸 수 있는 소형 연구 장비. 연구 점수를 천천히 만듭니다.', research_rp: 0.12 },
  park: { name: '공원', cat: 'colony', size: [10, 10], cost: { plate: 2, seeds: 4, credits: 50 }, desc: '반경 45m 주민 행복도 상승. 나무와 잔디가 산소와 바이오매스도 조금 만듭니다. 꽃 단계부터 지을 수 있습니다.', terra: { oxygen: 2, biomass: 4 }, service: 'park', radius: 45, unlockStage: 'flowers', research: 'r_roads' },
  culture: { name: '문화 센터', cat: 'colony', size: [12, 12], apron: 3, cost: { alloy: 8, glass: 8, electronics: 2, credits: 300 }, power: -6, desc: '반경 60m 시민 계층의 필수 시설. 공연과 축제로 행복도를 올리고, 문화 센터 하나마다 교신에 응답하는 이주민이 25% 늘어납니다(최대 50%).', workers: ['engineer', 3], service: 'culture', radius: 60, research: 'r_culture' },
  gym: { name: '체육관', cat: 'colony', size: [10, 8], apron: 2, cost: { plate: 8, glass: 4, credits: 90 }, power: -3, desc: '반경 50m 주민의 질병 위험을 절반으로 줄입니다. 운동하는 주민이 많을수록 식민지 전체의 작업 효율이 오릅니다(최대 +8%).', workers: ['settler', 2], service: 'gym', radius: 50, research: 'r_sports' },
  textile: { name: '섬유 공방', cat: 'colony', size: [8, 8], cost: { plate: 6, glass: 2, wire: 2, credits: 80 }, power: -4, desc: '씨앗과 물로 식물 섬유 의류를 짭니다.', workers: ['settler', 4], recipe: 'textiles', research: 'r_textile' },
  orchard: { name: '돔 과수원', cat: 'colony', size: [10, 10], cost: { glass: 10, plate: 4, fertilizer: 4, credits: 160 }, power: -4, desc: '비료와 물로 온실 과일을 기릅니다.', workers: ['tech', 4], recipe: 'delicacy', research: 'r_agri' },
  pharma: { name: '제약소', cat: 'colony', size: [8, 8], cost: { plate: 6, glass: 4, circuit: 2, credits: 140 }, power: -5, desc: '황·씨앗·물로 의약품을 만듭니다.', workers: ['artisan', 3], recipe: 'medicine', research: 'r_pharma' },
  transit: { name: '트램 정류장', cat: 'colony', size: [10, 6], cost: { plate: 4, lightalloy: 4, wire: 4, credits: 120 }, power: -3, desc: '반경 65m 주거지를 트램망으로 잇습니다. 정류장이 둘 이상이면 트램망 안의 집은 다른 정류장 근처의 시설까지 이용하고, 탐사대원은 정류장 사이를 트램으로 이동합니다. 연구원 이상 계층의 필수 시설.', workers: ['tech', 2], service: 'transit', radius: 65, research: 'r_transit' },
  university: { name: '대학', cat: 'colony', size: [12, 12], apron: 3, cost: { lightalloy: 8, glass: 10, electronics: 4, battery: 4, credits: 400 }, power: -8, desc: '반경 70m 공학자 이상 가정의 청년을 받아 가르칩니다(최대 30명). 90초마다 졸업생을 배출하며, 집을 전문직 이상으로 올리려면 졸업생이 필요합니다. 재학생 1명당 연구 점수 0.012/s.', workers: ['scientist', 4], service: 'university', radius: 70, research: 'r_university' },
  lifesupport: { name: '생명유지 시설', cat: 'colony', size: [6, 6], cost: { plate: 4, glass: 2, circuit: 1 }, power: -3, desc: '반경 50m 집에 숨 쉴 공기를 공급합니다. 물을 전기분해해 산소를 만들고 이산화탄소를 걸러내며, 물을 계속 씁니다. 숨쉬는 대기 단계 전까지 모든 집의 필수 시설.', service: 'air', radius: 50, research: 'r_colony' },
  sewage: { name: '하수처리장', cat: 'colony', size: [8, 8], cost: { plate: 6, glass: 2, alloy: 1 }, power: -3, desc: '반경 60m 집의 하수를 정화해 쓴 물의 절반을 창고로 돌려보냅니다. 하수 처리가 안 되는 동네는 병이 돕니다. 정착민 이상 계층의 필수 시설.', workers: ['settler', 2], service: 'sanitation', radius: 60, research: 'r_sanitation' },
  recycling: { name: '재활용 센터', cat: 'colony', size: [8, 8], cost: { plate: 6, alloy: 2 }, power: -4, desc: '반경 60m 집의 쓰레기를 수거해 분류하고, 1분마다 철판·유리·구리선을 되살려 창고에 넣습니다. 수거되지 않는 동네는 행복도가 떨어집니다. 기술자 이상 계층의 필수 시설.', workers: ['tech', 3], service: 'waste', radius: 60, research: 'r_sanitation' },
  powerbank: { name: '축전소', cat: 'power', size: [5, 4], cost: { battery: 4, plate: 2, wire: 2 }, desc: '같은 전력망의 남는 전기를 저장했다가(최대 12 MJ) 모자랄 때 최대 20 kW로 내보냅니다. 태양광만으로도 밤을 넘길 수 있습니다.', storage_kj: 12000, rate_kw: 20, research: 'r_battery' },
  firestation: { name: '소방서', cat: 'colony', size: [10, 8], apron: 2, cost: { plate: 6, alloy: 2, glass: 2 }, power: -2, desc: '반경 80m 시설의 화재를 10초 안에 진압하고, 정기 점검으로 화재 위험을 70% 줄입니다. 대기 산소가 2%를 넘으면 불이 날 수 있습니다.', workers: ['settler', 3], service: 'fire', radius: 80, research: 'r_safety' },
  police: { name: '치안센터', cat: 'colony', size: [8, 8], cost: { plate: 6, glass: 2, circuit: 1 }, power: -2, desc: '반경 70m 주거지를 순찰합니다. 인구가 40명을 넘으면 치안이 닿지 않는 집은 행복도와 세금이 떨어집니다. 시민 이상 계층의 필수 시설.', workers: ['tech', 3], service: 'security', radius: 70, research: 'r_safety' },
  nursery: { name: '보육원', cat: 'colony', size: [8, 8], cost: { plate: 6, glass: 4, credits: 80 }, power: -2, desc: '반경 50m 가정의 아이를 돌봅니다. 돌봄을 받는 가정에서는 2분마다 아이가 태어나 빈 방이 있는 집으로 들어갑니다(행복할수록 많이).', workers: ['settler', 2], service: 'childcare', radius: 50, research: 'r_family' },
  cityhall: { name: '시청', cat: 'colony', size: [14, 12], apron: 3, cost: { plate: 12, glass: 8, alloy: 6, credits: 400 }, power: -4, desc: '식민지의 행정. 세금 징수가 15% 늘고 주민 전체 행복도가 3% 오르며, 인구·소득·교육 통계를 볼 수 있습니다. 도시 시대로 가려면 필요합니다.', workers: ['engineer', 4], unique: true, research: 'r_civics' },
  tradepost: { name: '교역소', cat: 'colony', size: [10, 10], apron: 2, cost: { plate: 8, alloy: 2, circuit: 2 }, power: -3, desc: '궤도 화물선과 거래합니다. 크레딧으로 물자를 사들이거나 창고의 물자를 팝니다. 근처에서 나지 않는 광석을 구할 때 씁니다.', workers: ['tech', 2], trade: true, research: 'r_trade' },
  road: { name: '도로', cat: 'colony', size: [6, 6], cost: { iron: 1 }, desc: '두 지점을 찍어 소결 레골리스 포장도로를 깝니다. 지형을 따라 경사를 다듬고, 다른 도로에 이으면 교차로가 됩니다. 10m당 철 1.', tool: 'road', research: 'r_colony' },
  monument: { name: '개척자 기념탑', cat: 'colony', size: [10, 10], apron: 3, cost: { alloy: 20, glass: 10, electronics: 6, credits: 800 }, desc: '문명 시대로 나아가기 위한 상징. 주민 전체의 행복도가 오르고, 찾아오는 방문객이 분당 20 크레딧을 남깁니다.', unique: true, research: 'r_monument' },
  elevator: { name: '궤도 엘리베이터', cat: 'colony', size: [16, 16], apron: 4, cost: { alloy: 60, electronics: 20, circuit: 30, glass: 30, credits: 3000 }, power: -40, desc: '하늘과 궤도를 잇는 탑. 창고에서 150개를 넘는 물자를 30초마다 궤도로 수출해 크레딧을 벌고, 이주민이 엘리베이터로 내려와 교신 한 번에 50% 더 많이 옵니다.', unique: true, research: 'r_orbital', wonder: true },
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
  { id: 'r_colony', name: '정착 프로토콜', era: 1, cost: 90, req: ['r_logistics'], desc: '식민 본부, 주거지, 생명유지 시설, 농장, 정수 펌프, 배급소.' },
  { id: 'r_wind', name: '풍력 발전', era: 2, cost: 60, req: ['r_colony'], desc: '풍력 터빈.' },
  { id: 'r_assembly', name: '조립 자동화', era: 2, cost: 120, req: ['r_colony'], desc: '조립기로 회로·씨앗·연료봉 자동 생산.' },
  { id: 'r_medicine', name: '의료와 여가', era: 2, cost: 110, req: ['r_colony'], desc: '의료소와 라운지. 개척민 → 정착민 업그레이드.' },
  { id: 'r_goods', name: '경공업', era: 2, cost: 160, req: ['r_assembly'], desc: '생활용품 공장. 정착민 → 기술자 업그레이드.' },
  { id: 'r_roads', name: '도시 계획', era: 3, cost: 120, req: ['r_goods'], desc: '도로와 공원.' },
  { id: 'r_education', name: '교육', era: 3, cost: 240, req: ['r_goods', 'r_medicine'], desc: '학교와 연구소. 숙련공 → 공학자 업그레이드.' },
  { id: 'r_electronics', name: '전자공학', era: 3, cost: 280, req: ['r_education'], desc: '전자 공장.' },
  { id: 'r_fission', name: '핵분열', era: 3, cost: 300, req: ['r_assembly'], desc: '연료봉과 핵분열 원자로.' },
  { id: 'r_culture', name: '문화', era: 4, cost: 420, req: ['r_electronics'], desc: '문화 센터. 연구원 → 시민 업그레이드.' },
  { id: 'r_monument', name: '기념비 건축', era: 4, cost: 380, req: ['r_culture'], desc: '개척자 기념탑.' },
  { id: 'r_orbital', name: '궤도 공학', era: 5, cost: 700, req: ['r_monument', 'r_fission'], desc: '궤도 반사경 송신소와 궤도 엘리베이터.' },
  { id: 'r_metallurgy', name: '비철 야금', era: 2, cost: 100, req: ['r_refine'], desc: '정련소에서 구리선과 경합금을 뽑습니다.' },
  { id: 'r_sports', name: '체육', era: 2, cost: 80, req: ['r_colony'], desc: '체육관.' },
  { id: 'r_textile', name: '섬유', era: 2, cost: 130, req: ['r_goods', 'r_metallurgy'], desc: '섬유 공방. 기술자 → 숙련공 업그레이드.' },
  { id: 'r_battery', name: '전지', era: 3, cost: 180, req: ['r_metallurgy', 'r_assembly'], desc: '조립기에서 니켈·구리 배터리를 만들고, 축전소로 밤에도 전기를 씁니다.' },
  { id: 'r_agri', name: '농화학', era: 3, cost: 200, req: ['r_bio', 'r_assembly'], desc: '비료와 돔 과수원.' },
  { id: 'r_pharma', name: '제약', era: 3, cost: 260, req: ['r_medicine', 'r_education'], desc: '제약소.' },
  { id: 'r_transit', name: '대중교통', era: 3, cost: 280, req: ['r_roads', 'r_metallurgy'], desc: '트램 정류장. 공학자 → 연구원 업그레이드.' },
  { id: 'r_university', name: '고등 교육', era: 4, cost: 480, req: ['r_culture', 'r_battery'], desc: '대학. 시민 → 전문직 업그레이드.' },
  { id: 'r_highrise', name: '초고층 건축', era: 4, cost: 560, req: ['r_university', 'r_agri'], desc: '다이아그리드 타워. 전문직 → 명사 업그레이드.' },
  { id: 'r_sanitation', name: '위생 공학', era: 2, cost: 110, req: ['r_colony'], desc: '하수처리장과 재활용 센터.' },
  { id: 'r_family', name: '가족 정착', era: 2, cost: 100, req: ['r_medicine'], desc: '보육원. 식민지에서 아이가 태어납니다.' },
  { id: 'r_safety', name: '공공 안전', era: 2, cost: 140, req: ['r_colony'], desc: '소방서와 치안센터.' },
  { id: 'r_trade', name: '궤도 교역', era: 2, cost: 150, req: ['r_logistics'], desc: '교역소. 궤도 화물선과 물자를 사고팝니다.' },
  { id: 'r_civics', name: '시민 행정', era: 3, cost: 260, req: ['r_roads', 'r_safety'], desc: '시청. 도시 시대의 조건.' },
  { id: 'r_native', name: '요람 프로그램', era: 5, cost: 800, req: ['r_highrise', 'r_monument'], desc: '아르케에서 태어난 첫 세대를 위한 개방형 주거. 숨쉬는 대기 이후 명사 → 아르케인 업그레이드.' },
];

export function fmtTi(v) {
  if (v >= 1e9) return (v / 1e9).toFixed(2) + ' G';
  if (v >= 1e6) return (v / 1e6).toFixed(2) + ' M';
  if (v >= 1e3) return (v / 1e3).toFixed(1) + ' k';
  return v.toFixed(0) + ' ';
}
