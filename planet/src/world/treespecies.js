// Tree species shared by the worker (placement) and the main thread (models).
// Order of arrival follows plant evolution: conifers (gymnosperms) first,
// broadleaf trees one stage later, the alien bloom tree last.
export const TREE_SPECIES = [
  { id: 'pine', name: '소나무', group: 'conifer' },
  { id: 'spruce', name: '가문비나무', group: 'conifer' },
  { id: 'fir', name: '청전나무', group: 'conifer' },
  { id: 'oak', name: '참나무', group: 'broadleaf' },
  { id: 'birch', name: '자작나무', group: 'broadleaf' },
  { id: 'maple', name: '단풍나무', group: 'broadleaf' },
  { id: 'acacia', name: '아카시아', group: 'broadleaf' },
  { id: 'willow', name: '버드나무', group: 'broadleaf' },
  { id: 'palm', name: '야자나무', group: 'broadleaf' },
  { id: 'bloom', name: '아르케 꽃나무', group: 'late' },
];

// growth threshold offset per group (applied to each instance's threshold)
export function treeThreshold(species, thr) {
  const g = TREE_SPECIES[species].group;
  if (g === 'conifer') return thr * 0.8;
  if (g === 'broadleaf') return Math.min(1, 0.14 + thr * 0.86);
  return Math.min(1, 0.3 + thr * 0.7);
}

// pick a species from the site: altitude, latitude, wetness, soil
export function pickTreeSpecies(r, h, lat, s) {
  // s = surface weights [sand, basalt, strata, fert, snow, salt, crystal]
  const cold = Math.abs(lat) > 0.45 ? 1 : 0, warm = Math.abs(lat) < 0.3 ? 1 : 0;
  const high = h > 70 ? 1 : 0, wet = h < 10 && s[3] > 0.55 ? 1 : 0;
  const w = [
    0.6 + s[1] * 2.2 + high * 1.2,               // pine: volcanic and high ground
    0.4 + cold * 2.2 + high * 1.4 + s[4] * 2,    // spruce: cold, high
    0.15 + cold * 1.2 + s[4] * 1.5,              // fir (blue): coldest
    1.0 + (1 - cold) * 0.8 - s[0] * 0.8,         // oak: temperate lowland
    0.5 + cold * 0.9 + s[3] * 0.6,               // birch: cool, pioneer broadleaf
    0.7 + s[3] * 0.8 - s[0] * 0.6,               // maple: fertile ground
    0.1 + s[0] * 2.4 + warm * 0.8,               // acacia: dry sand, warm
    wet * 2.4,                                   // willow: wet lowland by water
    wet * warm * 2.8 + s[0] * warm * 0.6,        // palm: warm shores
    0.1 + s[6] * 2.5,                            // bloom: crystal plains
  ];
  let tot = 0;
  for (const v of w) tot += Math.max(0, v);
  let x = r * tot;
  for (let i = 0; i < w.length; i++) { x -= Math.max(0, w[i]); if (x <= 0) return i; }
  return 3;
}
