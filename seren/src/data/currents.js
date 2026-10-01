// 공명 해류 경로. 점 = [x, 높이, z, 절대높이?] — 절대높이가 아니면 높이는 지면 위 m.
// enabled:false 인 해류는 해당 공명탑을 깨우면 흐르기 시작합니다 (unlock = 공명탑 id).

export const CURRENTS = [
  {
    id: 'meadow-spine', name: '들판의 해류', color: 0x7ff3e6, speed: 85,
    points: [[-330, 2.6, 7690], [-260, 20, 7480], [-120, 75, 6800], [0, 140, 5600], [110, 185, 4300], [70, 250, 3200], [0, 560, 2300, 1], [0, 470, 1650, 1], [40, 430, 1180, 1]],
  },
  {
    id: 'capital-ring', name: '하모네아 고리 해류', color: 0xffd27a, speed: 70,
    points: Array.from({ length: 13 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2;
      return [Math.cos(a) * 820, 560 + Math.sin(a * 2) * 40, Math.sin(a) * 820, 1];
    }),
  },
  {
    id: 'crash-dewfold', name: '작은 해류', color: 0x9ff6ff, speed: 45,
    points: [[560, 2.6, 8560], [450, 14, 8400], [200, 22, 8150], [-150, 16, 7930], [-280, 10, 7860]],
  },
  {
    id: 'spine-glass', name: '동쪽 해류', color: 0xff9be0, speed: 95, enabled: false, unlock: 'glass-pylon',
    points: [[1350, 520, 120, 1], [3000, 520, 400, 1], [5500, 420, 800, 1], [8000, 380, 1200, 1], [9800, 320, 1400, 1], [10300, 275, 1420, 1]],
  },
  {
    id: 'spine-bloom', name: '서쪽 해류', color: 0x6dfcd0, speed: 95, enabled: false, unlock: 'bloom-pylon',
    points: [[-1350, 520, 200, 1], [-3500, 500, 900, 1], [-6200, 420, 1700, 1], [-8600, 320, 2300, 1], [-9700, 250, 2550, 1]],
  },
  {
    id: 'spine-canyon', name: '북동 해류', color: 0xffc86a, speed: 95, enabled: false, unlock: 'canyon-pylon',
    points: [[900, 520, -1100, 1], [2600, 560, -3200, 1], [4800, 560, -5600, 1], [6800, 480, -7400, 1], [7550, 420, -7950, 1]],
  },
  {
    id: 'spine-frost', name: '북서 해류', color: 0xa8c8ff, speed: 100, enabled: false, unlock: 'frost-pylon',
    points: [[-900, 520, -1100, 1], [-2800, 700, -3400, 1], [-5000, 900, -5800, 1], [-6700, 700, -7900, 1], [-8600, 1400, -7300, 1], [-9600, 1790, -7040, 1]],
  },
  {
    id: 'spine-sea', name: '남동 해류', color: 0x7ff0ff, speed: 100, enabled: false, unlock: 'sea-pylon',
    points: [[1200, 520, 900, 1], [4000, 420, 3600, 1], [8000, 300, 6800, 1], [11500, 220, 9800, 1], [14200, 240, 12000, 1], [14850, 230, 12300, 1]],
  },
];
