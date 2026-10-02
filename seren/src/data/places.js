// 세렌의 이름 있는 장소들. 좌표는 [x, z] (m), −Z 가 북쪽.
// flat: 지형을 평평하게 다듬을 반경(m)과 높이(생략하면 그 자리 높이).
// 새 장소를 추가하려면 여기에 항목을 더하고, type 에 맞는 빌더가 structures.js 에 있는지 확인하세요.

export const PLACES = [
  // ── 중앙 ──────────────────────────────
  { id: 'spine', type: 'spine', name: '척추', region: 'spine', pos: [0, 0], radius: 420,
    desc: '궤도 고리까지 이어지는 승강줄의 뿌리. 아웬의 노래가 모두 이곳으로 모인다.' },
  { id: 'harmonea', type: 'capital', name: '하모네아', region: 'spine', pos: [0, 0], radius: 1500, label: '도시',
    desc: '척추를 둘러싼 아웬의 수도. 떠 있는 꽃잎 위에 집과 정원이 있다.' },
  { id: 'lift-s', type: 'lift', name: '남쪽 승강 기둥', region: 'spine', pos: [0, 1780], top: [0, 1560], exit: [0, -1], flat: { r: 40, blend: 60 } },
  { id: 'lift-e', type: 'lift', name: '동쪽 승강 기둥', region: 'spine', pos: [1800, 0], top: [1570, 0], exit: [-1, 0], flat: { r: 40, blend: 60 } },
  { id: 'lift-w', type: 'lift', name: '서쪽 승강 기둥', region: 'spine', pos: [-1800, 60], top: [-1570, 60], exit: [1, 0], flat: { r: 40, blend: 60 } },
  { id: 'lift-n', type: 'lift', name: '북쪽 승강 기둥', region: 'spine', pos: [0, -1810], top: [0, -1570], exit: [0, 1], flat: { r: 40, blend: 60 } },
  { id: 'spine-deck', type: 'none', name: '척추 전망대', region: 'spine', pos: [0, 0], vista: true, y: 1290 },
  { id: 'd-east', type: 'district', name: '새벽 구역', region: 'spine', pos: [3500, -1700], radius: 700,
    desc: '2.2 km 의 울림탑과 그 허리를 감싼 하늘바퀴. 하모네아에서 가장 먼저 해가 닿는 곳.' },
  { id: 'd-sw', type: 'district', name: '물결 구역', region: 'spine', pos: [-2800, 4200], radius: 700,
    desc: '두 기둥이 아치로 이어진 소리굽쇠탑의 구역. 탑 사이에 빛 구슬이 떠 있다.' },
  { id: 'd-west', type: 'district', name: '포자 구역', region: 'spine', pos: [-4300, -700], radius: 700,
    desc: '빛기둥을 따라 원반 층들이 떠 있는 뜬층탑의 구역.' },
  { id: 'd-north', type: 'district', name: '별바라기 구역', region: 'spine', pos: [1600, -4300], radius: 700,
    desc: '북쪽 하늘의 우르를 마주한 탑들의 구역.' },
  { id: 'starport', type: 'starport', name: '별항구', region: 'spine', pos: [2300, 2700], radius: 230, flat: { r: 175, blend: 140 },
    desc: '궤도 고리로 오르는 왕복선이 780 m 가속 고리탑을 지나 하늘로 쏘아 올려지는 곳.' },

  // ── 빛갈대 들판 (남) ─────────────────────
  { id: 'crash', type: 'crash', name: '추락 지점', region: 'meadow', pos: [600, 8600], radius: 40,
    desc: '탐사선 「라르크」의 탈출 포드가 떨어진 곳. 아직 연기가 오른다.' },
  { id: 'dewfold', type: 'village', name: '이슬터', region: 'meadow', pos: [-420, 7820], radius: 160, flat: { r: 110, blend: 90 },
    desc: '빛갈대 들판의 정원 마을. 아웬 「이엘」이 사는 곳.' },
  { id: 'meadow-pylon', type: 'pylon', name: '들판의 공명탑', region: 'meadow', pos: [1350, 6200], flat: { r: 45, blend: 70 }, alive: true,
    desc: '세렌에서 아직 노래하는 몇 안 되는 공명탑.' },
  { id: 'meadow-vista', type: 'vista', name: '바람언덕', region: 'meadow', pos: [3500, 4700], desc: '들판에서 가장 높은 언덕.' },
  { id: 'old-gate', type: 'arch', name: '옛 관문', region: 'meadow', pos: [-2600, 10200], desc: '바다를 향해 선 거대한 아치.' },

  // ── 유리 황야 (동) ───────────────────────
  { id: 'yunseul', type: 'glasscity', name: '윤슬', region: 'glass', pos: [10380, 1420], radius: 380, flat: { r: 150, blend: 60 },
    desc: '수정 메사 위에 지은 도시. 바람이 불면 도시 전체가 화음을 낸다.' },
  { id: 'glass-pylon', type: 'pylon', name: '황야의 공명탑', region: 'glass', pos: [8700, -1200], flat: { r: 45, blend: 60 }, region2: 'glass',
    desc: '모래에 반쯤 묻힌 공명탑.' },
  { id: 'glass-vista', type: 'vista', name: '노을 메사', region: 'glass', pos: [4100, -400] },

  { id: 'archive', type: 'landmark', name: '기억 결정 보관소', region: 'glass', pos: [11080, 1420], radius: 120, flat: { r: 70, blend: 60 },
    desc: '아웬의 모든 노래가 수정 격자에 새겨져 보관되는 곳. 빛이 결정 속을 오르내린다.' },

  // ── 균사 숲 (서) ─────────────────────────
  { id: 'gatmaeul', type: 'bloomcity', name: '갓마을', region: 'bloom', pos: [-9850, 2600], radius: 420,
    desc: '거대한 버섯 갓 위에 지은 마을. 밤이면 숲 전체가 숨 쉬듯 빛난다.' },
  { id: 'bloom-pylon', type: 'pylon', name: '숲의 공명탑', region: 'bloom', pos: [-7150, -1750], flat: { r: 45, blend: 80 },
    desc: '포자 안개 속에 잠든 공명탑.' },
  { id: 'bloom-vista', type: 'vista', name: '포자 언덕', region: 'bloom', pos: [-3850, -1900] },

  { id: 'foundry', type: 'landmark', name: '포자 공방', region: 'bloom', pos: [-10550, 2600], radius: 160, flat: { r: 90, blend: 60 },
    desc: '살아 있는 재료를 길러 내는 유리 돔 공방. 집도, 배의 돛도 이곳에서 자란다.' },

  // ── 부유 협곡 (북동) ─────────────────────
  { id: 'tteodol', type: 'canyoncity', name: '떠돌섬', region: 'canyon', pos: [7600, -8050], radius: 600, flat: { r: 120, blend: 80 },
    desc: '협곡 위에 떠 있던 섬들의 도시. 지금은 섬들이 협곡 바닥에 내려앉았다.' },
  { id: 'canyon-pylon', type: 'pylon', name: '협곡의 공명탑', region: 'canyon', pos: [5200, -5600], flat: { r: 45, blend: 60 },
    desc: '절벽 끝에 선 공명탑.' },
  { id: 'canyon-vista', type: 'vista', name: '붉은 계단', region: 'canyon', pos: [50, -5950] },

  { id: 'shipyard', type: 'landmark', name: '중력 조선소', region: 'canyon', pos: [8250, -8700], radius: 350,
    desc: '협곡 위 공중에 큰배를 띄워 놓고 짓는 곳. 지금은 반쯤 지은 배가 그대로 멈춰 있다.' },

  // ── 서리 첨봉 (북서) ─────────────────────
  { id: 'observatory', type: 'observatory', name: '별듣는 탑', region: 'frost', pos: [-9700, -7000], flat: { r: 55, h: 1735, blend: 120 },
    desc: '첨봉 꼭대기의 관측소. 아웬은 이곳에서 별의 노래를 들었다.' },
  { id: 'frost-pylon', type: 'pylon', name: '첨봉의 공명탑', region: 'frost', pos: [-6850, -8050], flat: { r: 45, blend: 70 },
    desc: '눈보라 속에 얼어붙은 공명탑.' },
  { id: 'frost-vista', type: 'vista', name: '얼음 이마', region: 'frost', pos: [-1900, -8500] },

  { id: 'array', type: 'landmark', name: '별듣는 배열', region: 'frost', pos: [-9700, -5900], radius: 300, flat: { r: 240, blend: 140 },
    desc: '하늘을 향한 거대한 귀들. 아웬은 이것으로 다른 별의 노래를 들었다.' },

  // ── 노래하는 바다 (남동) ─────────────────
  { id: 'mulnorae', type: 'seacity', name: '물노래', region: 'sea', pos: [14900, 12350], radius: 500, flat: { r: 150, h: 34, blend: 140 },
    desc: '섬과 바다 아치에 기대어 지은 도시. 파도가 아치를 지날 때 노래가 난다.' },
  { id: 'tidal', type: 'landmark', name: '조석 기관', region: 'sea', pos: [15600, 12350], radius: 300,
    desc: '바다에 반쯤 잠긴 세 개의 고리. 우르가 끌어당기는 물의 힘을 노래로 바꾼다.' },
  { id: 'sea-pylon', type: 'pylon', name: '바다의 공명탑', region: 'sea', pos: [12050, 6950], flat: { r: 40, blend: 60 },
    desc: '해안 절벽 위의 공명탑.' },
];

export const PLACE = Object.fromEntries(PLACES.map((p) => [p.id, p]));

// 지형 평탄화 목록 (heightfield 가 사용)
export const FLATTEN = PLACES.filter((p) => p.flat).map((p) => ({ x: p.pos[0], z: p.pos[1], r: p.flat.r, blend: p.flat.blend ?? 60, h: p.flat.h }));
