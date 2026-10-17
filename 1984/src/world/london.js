// Airstrip One's London: the real street plan of 1940s central London from
// Trafalgar Square (Victory Square) north through Seven Dials and St Giles to
// Bloomsbury, where the Ministry of Truth stands on the site of Senate House.
// Districts, zones, reserved sites and the places of the story are defined
// here in the real coordinates (metres; x east, z south; origin Nelson's
// Column). Street geometry (c) OpenStreetMap contributors, ODbL.
import L from './town/london_data.js';
import { buildPlan, pointInPoly, area } from './town/streets.js';

export const WINDOW = L.window;   // [x0, z0, x1, z1]

// Victory Square: the paved square with the column, the north terrace road
// in front of the picture gallery, roads on the other three sides
export const VICTORY_SQUARE = [[-64, -56], [-30, -63], [0, -69], [38, -78], [49, -48], [52, -24], [46, 2], [10, 13], [-24, 16], [-46, 16], [-52, 4]];

// sites kept clear of generated houses: [x0, z0, x1, z1] or polygons
export const SITES = {
  minitrue: { c: [-44, -1462], half: 118 },            // Senate House
  gallery: [[-92, -150], [44, -150], [44, -96], [-92, -96]],   // the picture gallery (National Gallery)
  stmartins: [[62, -142], [120, -142], [120, -104], [62, -104]],
};

// districts by polygon, first match wins
const DISTRICTS = [
  ['inner', [[-330, -1420], [-60, -1420], [-60, -1060], [-330, -1060]]],              // Bedford Square, Gower Street
  ['bloomsbury', [[-340, -1600], [440, -1600], [440, -1020], [-340, -1020]]],
  ['slum', [[10, -1020], [440, -1020], [440, -330], [150, -300], [40, -420], [-60, -760], [-90, -1020]]],   // St Giles, Seven Dials, Drury Lane
  ['westend', [[-340, -1020], [440, -1020], [440, 120], [-340, 120]]],
];
export function districtAt(x, z) {
  for (const [id, poly] of DISTRICTS) if (pointInPoly(x, z, poly)) return id;
  return 'westend';
}

// the Party's thoroughfares: the living range follows these
export const AVENUES = new Set(['Charing Cross Road', 'Tottenham Court Road', 'Shaftesbury Avenue', 'New Oxford Street', 'Bloomsbury Street',
  'Great Russell Street', 'Gower Street', 'St Martin\'s Place', 'Trafalgar Square', 'Cranbourn Street', 'Long Acre', 'St Giles High Street',
  'Bedford Square', 'Montague Place', 'Malet Street', 'Store Street', 'Duncannon Street', 'Strand', 'Pall Mall East', 'Cockspur Street']);

export function londonPlan() {
  const ms = SITES.minitrue;
  const mBox = [ms.c[0] - ms.half, ms.c[1] - ms.half, ms.c[0] + ms.half, ms.c[1] + ms.half];
  const inBox = ([x, z], b, m = 0) => x > b[0] - m && x < b[2] + m && z > b[1] - m && z < b[3] + m;
  // streets: drop the ones under the Ministry's apron, give a Party road round it
  const streets = [];
  for (const [i, s] of L.streets.entries()) {
    if (s.pts.every((p) => inBox(p, mBox, 6))) continue;
    if (s.pts.some((p) => inBox(p, mBox, -2))) {
      // cut the line where it enters the site
      const keep = [];
      let cur = [];
      for (const p of s.pts) { if (inBox(p, mBox, 2)) { if (cur.length > 1) keep.push(cur); cur = []; } else cur.push(p); }
      if (cur.length > 1) keep.push(cur);
      for (const k of keep) streets.push(street(s, k, i));
      continue;
    }
    streets.push(street(s, s.pts, i));
  }
  // the ring road round the Ministry
  const [a, b, c, d] = [[mBox[0] - 8, mBox[1] - 8], [mBox[2] + 8, mBox[1] - 8], [mBox[2] + 8, mBox[3] + 8], [mBox[0] - 8, mBox[3] + 8]];
  streets.push({ id: 'ministry_ring', name: 'Ministry Approach', pts: [a, b, c, d, a], w: 12, pave: 4, kind: 'main', smooth: 0, district: 'bloomsbury' });
  const squares = [
    { id: 'victory_square', poly: VICTORY_SQUARE, kind: 'square' },
    // the Ministry's apron: concrete all round the pyramid
    { id: 'ministry_apron', poly: [[mBox[0], mBox[1]], [mBox[2], mBox[1]], [mBox[2], mBox[3]], [mBox[0], mBox[3]]], kind: 'apron' },
  ];
  const gardens = L.parks.filter((p) => Math.abs(area(p.poly)) > 300 && !p.poly.every((q) => inBox(q, mBox))).map((p) => ({ poly: p.poly, name: p.n }));
  const plan = buildPlan({ bounds: WINDOW, streets, squares, gardens, kerbRadius: 2.4 });
  plan.districtAt = districtAt;
  plan.reserved = [
    { id: 'gallery', poly: SITES.gallery },
    { id: 'stmartins', poly: SITES.stmartins },
    { id: 'minitrue', poly: [[mBox[0], mBox[1]], [mBox[2], mBox[1]], [mBox[2], mBox[3]], [mBox[0], mBox[3]]] },
  ];
  plan.minitrue = { x: ms.c[0], z: ms.c[1], half: ms.half };
  plan.massing = L.massing;
  plan.squaresDef = squares;
  plan.licence = L.licence;
  return plan;
}

function street(s, pts, i) {
  const mid = pts[Math.floor(pts.length / 2)];
  const district = districtAt(mid[0], mid[1]);
  let { w, p } = s;
  // prole streets are narrower and have narrower pavements
  if (district === 'slum' && s.k === 'street') { w = 6.0; p = 1.7; }
  return { id: 's' + i, name: s.n, cls: s.c, pts, w, pave: p, kind: s.k, smooth: 0, district };
}
