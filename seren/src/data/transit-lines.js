// 빛길 노선과 역 자리 (높이와 상관없는 순수 자료) — world/transit.js 가 짓고, heightfield 가 역 자리 땅을 고른다(역마다 평평한 단).
import { PLACE } from './places.js';

export const RING_R = 1600;

export const LINES = [
  { id: 'l-meadow', name: '들판선', station: '이슬터역', to: 'dewfold', off: 200, unlock: 'quest:mq2', color: 0x7ff3e6 },
  { id: 'l-glass', name: '황야선', station: '윤슬역', to: 'yunseul', off: 170, unlock: 'glass-pylon', color: 0xff9be0 },
  { id: 'l-bloom', name: '숲선', station: '갓마을역', to: 'gatmaeul', off: 500, unlock: 'bloom-pylon', color: 0x6dfcd0 },
  { id: 'l-canyon', name: '협곡선', station: '떠돌섬역', to: 'tteodol', off: 700, unlock: 'canyon-pylon', color: 0xffc86a },
  { id: 'l-frost', name: '첨봉선', station: '별듣는역', to: 'observatory', off: 88, unlock: 'frost-pylon', color: 0xa8c8ff, slope: 0.2 },
  { id: 'l-sea', name: '바다선', station: '물노래역', to: 'mulnorae', off: 420, unlock: 'sea-pylon', color: 0x7ff0ff },
];

/** 역 건물의 크기 (로컬: x 옆, z 노선 방향) — 받침 34 × 74 m, 둘레 12 m 앞마당(드나드는 길이 평평하게 이어지는 곳) */
export const STATION = { hw: 17, hl: 37, apron: 12 };

/** 모든 역 자리: 갈림역(고리 위) + 갈래 끝 역. { id, line, hub, x, z, dir:[ux, uz] } */
export function stationSites() {
  const out = [];
  for (const L of LINES) {
    const P = PLACE[L.to];
    if (!P) continue;
    const [cx, cz] = P.pos;
    const a = Math.atan2(cz, cx);
    out.push({ id: L.id + ':hub', line: L.id, hub: true, x: Math.cos(a) * RING_R, z: Math.sin(a) * RING_R, dir: [-Math.sin(a), Math.cos(a)] });
    const d = Math.hypot(cx, cz), ux = cx / d, uz = cz / d;
    out.push({ id: L.id + ':end', line: L.id, hub: false, x: cx - ux * L.off, z: cz - uz * L.off, dir: [ux, uz] });
  }
  return out;
}
