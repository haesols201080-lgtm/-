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

  // ── 균사 숲 (서) ─────────────────────────
  { id: 'gatmaeul', type: 'bloomcity', name: '갓마을', region: 'bloom', pos: [-9850, 2600], radius: 420,
    desc: '거대한 버섯 갓 위에 지은 마을. 밤이면 숲 전체가 숨 쉬듯 빛난다.' },
  { id: 'bloom-pylon', type: 'pylon', name: '숲의 공명탑', region: 'bloom', pos: [-7150, -1750], flat: { r: 45, blend: 80 },
    desc: '포자 안개 속에 잠든 공명탑.' },
  { id: 'bloom-vista', type: 'vista', name: '포자 언덕', region: 'bloom', pos: [-3850, -1900] },

  // ── 부유 협곡 (북동) ─────────────────────
  { id: 'tteodol', type: 'canyoncity', name: '떠돌섬', region: 'canyon', pos: [7600, -8050], radius: 600, flat: { r: 120, blend: 80 },
    desc: '협곡 위에 떠 있던 섬들의 도시. 지금은 섬들이 협곡 바닥에 내려앉았다.' },
  { id: 'canyon-pylon', type: 'pylon', name: '협곡의 공명탑', region: 'canyon', pos: [5200, -5600], flat: { r: 45, blend: 60 },
    desc: '절벽 끝에 선 공명탑.' },
  { id: 'canyon-vista', type: 'vista', name: '붉은 계단', region: 'canyon', pos: [50, -5950] },

  // ── 서리 첨봉 (북서) ─────────────────────
  { id: 'observatory', type: 'observatory', name: '별듣는 탑', region: 'frost', pos: [-9700, -7000], flat: { r: 55, h: 1735, blend: 120 },
    desc: '첨봉 꼭대기의 관측소. 아웬은 이곳에서 별의 노래를 들었다.' },
  { id: 'frost-pylon', type: 'pylon', name: '첨봉의 공명탑', region: 'frost', pos: [-6850, -8050], flat: { r: 45, blend: 70 },
    desc: '눈보라 속에 얼어붙은 공명탑.' },
  { id: 'frost-vista', type: 'vista', name: '얼음 이마', region: 'frost', pos: [-1900, -8500] },

  // ── 노래하는 바다 (남동) ─────────────────
  { id: 'mulnorae', type: 'seacity', name: '물노래', region: 'sea', pos: [14900, 12350], radius: 500, flat: { r: 150, h: 34, blend: 140 },
    desc: '섬과 바다 아치에 기대어 지은 도시. 파도가 아치를 지날 때 노래가 난다.' },
  { id: 'sea-pylon', type: 'pylon', name: '바다의 공명탑', region: 'sea', pos: [12050, 6950], flat: { r: 40, blend: 60 },
    desc: '해안 절벽 위의 공명탑.' },
];

export const PLACE = Object.fromEntries(PLACES.map((p) => [p.id, p]));

// 지형 평탄화 목록 (heightfield 가 사용)
export const FLATTEN = PLACES.filter((p) => p.flat).map((p) => ({ x: p.pos[0], z: p.pos[1], r: p.flat.r, blend: p.flat.blend ?? 60, h: p.flat.h }));
