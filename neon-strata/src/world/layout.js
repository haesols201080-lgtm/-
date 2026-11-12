// Macro layout of KAIROS-9: a radial-organic megacity grown around the central Spire.
// x = east, z = south. Angles in radians from +x towards +z.
import { TAU } from '../core/rng.js';

export const R_CORE = 660;     // Spire plaza radius
export const R_CITY = 3300;    // dense city limit
export const R_SPRAWL = 5000;  // low outskirts limit
export const COAST_X = -3420;  // sea wall line (west)
export const RINGS = [{ r: 720, w: 26 }, { r: 1720, w: 30 }, { r: 2840, w: 26 }];
export const BOULEVARD_W = 30;

const D = Math.PI / 180;
// order = increasing angle starting at east (0) going south (+z)
export const DISTRICTS = [
  { id: 'hive', name: '하이브', en: 'THE HIVE', ang: 0, sub: '주거 메가블록', corp: 'hive', tint: [1.0, 0.72, 0.42] },
  { id: 'verdant', name: '버던트', en: 'VERDANT TERRACES', ang: 45, sub: '수직 농장 지대', corp: 'verdant', tint: [0.9, 0.25, 0.8] },
  { id: 'sump', name: '침전층', en: 'THE SUMP', ang: 90, sub: '최하층 슬럼', corp: null, tint: [0.2, 0.9, 0.75] },
  { id: 'foundry', name: '파운드리', en: 'VANTA FOUNDRY', ang: 135, sub: '중공업 지대', corp: 'vanta', tint: [1.0, 0.35, 0.1] },
  { id: 'port', name: '에테르 항', en: 'AETHER PORT', ang: 180, sub: '방벽과 하역항', corp: 'aether', tint: [0.3, 0.75, 1.0] },
  { id: 'oldq', name: '구시가', en: 'OLD QUARTER', ang: 225, sub: '기록 보존 구역', corp: 'archive', tint: [0.75, 0.65, 1.0] },
  { id: 'meridian', name: '메리디안', en: 'MERIDIAN', ang: 270, sub: '금융 중심', corp: 'meridian', tint: [0.45, 0.95, 0.85] },
  { id: 'lumina', name: '루미나', en: 'LUMINA STRIP', ang: 315, sub: '환락가', corp: 'lumina', tint: [1.0, 0.25, 0.65] },
];
export const DISTRICT_BY_ID = Object.fromEntries(DISTRICTS.map((d) => [d.id, d]));
export const CORE = { id: 'core', name: '스파이어 광장', en: 'SPIRE CONCOURSE', sub: '도시의 축', corp: 'helion', tint: [1.0, 0.8, 0.5] };
export const SPRAWL = { id: 'sprawl', name: '외곽', en: 'OUTLANDS', sub: '끝없는 변두리', corp: null, tint: [0.5, 0.5, 0.6] };
export const ZENITH = { id: 'zenith', name: '제니스', en: 'ZENITH', sub: '구름 위의 도시', corp: 'helion', tint: [1.0, 0.9, 0.7] };

// boundary k separates DISTRICTS[k] and DISTRICTS[k+1]; its angle meanders with radius
const BP = [[0.9, 1.3, 0.11], [1.4, 4.1, 0.09], [1.1, 2.2, 0.12], [1.7, 0.4, 0.08], [0.8, 5.0, 0.10], [1.3, 3.3, 0.11], [1.0, 1.9, 0.09], [1.6, 0.9, 0.12]];
export function boundaryAngle(k, r) {
  const p = BP[k], t = r / 1000;
  return (DISTRICTS[k].ang + 22.5) * D + p[2] * Math.sin(t * p[0] * 2.1 + p[1]) + p[2] * 0.45 * Math.sin(t * p[0] * 5.3 + p[1] * 2.7);
}
export function ringRadius(j, th) {
  const R = RINGS[j].r;
  return R * (1 + 0.035 * Math.sin(th * 3 + j * 1.7) + 0.02 * Math.sin(th * 7 + j * 4.1 + 0.6));
}
const norm = (a) => ((a % TAU) + TAU) % TAU;

export function districtIndexAt(x, z) {
  const r = Math.hypot(x, z); const th = norm(Math.atan2(z, x));
  // find k with boundary(k-1) <= th < boundary(k)
  for (let k = 0; k < 8; k++) {
    const hi = norm(boundaryAngle(k, r)), lo = norm(boundaryAngle((k + 7) % 8, r));
    if (lo < hi ? (th >= lo && th < hi) : (th >= lo || th < hi)) return k;
  }
  return 0;
}
export function districtAt(x, z) {
  const r = Math.hypot(x, z);
  if (r < R_CORE) return CORE;
  if (x < COAST_X + 40) return SPRAWL;
  if (r > R_CITY) return SPRAWL;
  return DISTRICTS[districtIndexAt(x, z)];
}
// district to show to the player (adds vertical dimension)
export function placeAt(x, y, z) {
  if (y > 1380 && Math.hypot(x, z) < 760) return ZENITH;
  return districtAt(x, z);
}
// polyline of a boulevard k from the core to the city edge
export function boulevardPath(k, step = 36) {
  const pts = [];
  for (let r = R_CORE - 30; r <= R_CITY + 60; r += step) { const a = boundaryAngle(k, r); pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
  return pts;
}
export function ringPath(j, n = 220) {
  const pts = [];
  for (let i = 0; i < n; i++) { const th = (i / n) * TAU; const r = ringRadius(j, th); pts.push([Math.cos(th) * r, Math.sin(th) * r]); }
  return pts;
}
// direction helpers for generators
export const radial = (x, z) => { const r = Math.hypot(x, z) || 1; return [x / r, z / r]; };
export const yawFacing = (dx, dz) => Math.atan2(dx, dz); // pen yaw so that local +z points along (dx,dz)
