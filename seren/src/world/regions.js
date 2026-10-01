// 세렌의 지역 정의.
// 좌표계: 1 단위 = 1 m, Y 위쪽, −Z 가 북쪽(가스행성 우르가 떠 있는 방향), +X 가 동쪽.
// 지역을 추가하려면 이 배열에 항목을 더하고 heightfield.js 의 regionHeight 에 지형 함수를 추가하세요.

export const REGIONS = [
  {
    id: 'spine', name: '척추 고원', short: '척추',
    center: [0, 0], size: 0.3,
    desc: '아웬 문명의 심장. 궤도 고리로 이어지는 거대한 승강 기둥 「척추」가 솟아 있는 고원 도시.',
    pal: { grass: 0x4f9a82, grass2: 0x86b88e, soil: 0xbfae98, rock: 0xcdbba7, rock2: 0xa89a8c, glow: 0xffe0a0, glowAmt: 0.25 },
  },
  {
    id: 'meadow', name: '빛갈대 들판', short: '들판',
    center: [-300, 8200], size: 1.0,
    desc: '바람이 불 때마다 빛나는 갈대가 물결치는 남쪽 구릉. 아웬의 정원 마을 「이슬터」가 있다.',
    pal: { grass: 0x23806f, grass2: 0x5c9e6e, soil: 0x6f8f6a, rock: 0x8d8aa6, rock2: 0x6f6c8c, glow: 0x6ff7ff, glowAmt: 0.65 },
  },
  {
    id: 'glass', name: '유리 황야', short: '황야',
    center: [10200, 1600], size: 1.0,
    desc: '분홍빛 유리 모래 언덕과 거대한 수정 탑이 늘어선 동쪽 황야. 바람에 수정이 운다.',
    pal: { grass: 0xe6bfcc, grass2: 0xf4dcc6, soil: 0xdcb0b8, rock: 0xd98f7a, rock2: 0xbf6f6c, glow: 0xff9be0, glowAmt: 0.35 },
  },
  {
    id: 'bloom', name: '균사 숲', short: '숲',
    center: [-9800, 2600], size: 1.0,
    desc: '수백 미터 높이의 빛버섯 나무가 하늘을 덮은 서쪽 숲. 포자가 별처럼 떠다닌다.',
    pal: { grass: 0x4a3d86, grass2: 0x2d6a7c, soil: 0x3a3060, rock: 0x4d4466, rock2: 0x3a3450, glow: 0x6dfcd0, glowAmt: 1.0 },
  },
  {
    id: 'canyon', name: '부유 협곡', short: '협곡',
    center: [7600, -8200], size: 1.0,
    desc: '붉은 지층이 계단처럼 깎인 북동쪽 협곡. 공명으로 떠 있던 바위섬들이 침묵 속에 내려앉았다.',
    pal: { grass: 0xb07a4a, grass2: 0xc99a62, soil: 0xb8794f, rock: 0xc0603f, rock2: 0xe0a070, glow: 0xffc86a, glowAmt: 0.3 },
  },
  {
    id: 'frost', name: '서리 첨봉', short: '첨봉',
    center: [-7400, -9200], size: 1.0,
    desc: '2천 미터가 넘는 얼음 봉우리들. 정상에는 별을 듣는 옛 관측소가 있다.',
    pal: { grass: 0x6d9a98, grass2: 0x8fb3b0, soil: 0x7d8597, rock: 0x6f7a91, rock2: 0x8e97ab, glow: 0xa8c8ff, glowAmt: 0.4 },
  },
  {
    id: 'sea', name: '노래하는 바다', short: '바다',
    center: [12500, 12500], size: 1.0,
    desc: '남동쪽 바다에 흩어진 섬과 바다 아치. 파도가 아치를 지날 때마다 낮은 노래가 울린다.',
    pal: { grass: 0x5fb59a, grass2: 0x9fd0a0, soil: 0xefd9ae, rock: 0x9a8f8c, rock2: 0x7a7a86, glow: 0x7ff0ff, glowAmt: 0.5 },
  },
];

export const REGION_INDEX = Object.fromEntries(REGIONS.map((r, i) => [r.id, i]));

export const WORLD = {
  seaLevel: 0,
  landRadius: 15500, // 대륙 반경(대략)
  limitRadius: 26000, // 이 너머는 「장막」 — 더 나아갈 수 없음
  plateauRadius: 1650, // 척추 고원 반경
  plateauHeight: 390,
};
