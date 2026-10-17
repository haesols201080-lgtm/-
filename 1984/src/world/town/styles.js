// Building types of 1940s London as generator settings. A style is resolved
// once per run of houses (a speculative builder put up a run of identical
// fronts), then each house of the run varies only in what its occupants
// did to it since: door paint, broken and boarded windows, soot.
import { TINTS } from './kit.js';

const pick = (r, a) => a[Math.floor(r() * a.length) % a.length];
const jitter = (r, c, k = 0.06) => c.map((v) => Math.max(0, v * (1 - k + r() * 2 * k)));

// how windows fail with neglect; ground floors suffer first
function stateFn(decay) {
  return (h, r) => {
    const g = h.floor === 0 ? 1.5 : 1;
    const u = r();
    if (u < decay * 0.12 * g) return 'boarded';
    if (u < decay * 0.3 * g) return 'card';
    if (u < decay * 0.42 * g) return 'broken';
    return 'ok';
  };
}

// Common fields: floors (storey heights), raise (ground floor above the
// pavement), bays, win (per floor: w, h, sill, glazing), head, top
// ('parapet'|'eaves'|'mansard'|'flat'), wall/gf materials and tints.
export const TYPES = {
  // Georgian terrace, second/third rate: stock brick, flat front, three bays,
  // gauged arches, diminishing windows, parapet, fanlit door.
  georgian(r, o) {
    const storeys = o.storeys || (r() < 0.6 ? 4 : 3);
    const fl = [3.2, 3.5, 2.9, 2.5, 2.3].slice(0, storeys);
    const stucco = r() < 0.55;
    return {
      w: [5.2, 7.2], d: [10, 13],
      floors: fl, raise: 0.5 + r() * 0.35, bays: 3,
      win: [
        { w: 1.0, h: 2.0, sill: 0.8, glazing: 'sash6' },
        { w: 1.05, h: 2.45, sill: 0.3, glazing: 'sash6' },
        { w: 1.0, h: 1.75, sill: 0.62, glazing: 'sash6' },
        { w: 0.95, h: 1.2, sill: 0.62, glazing: 'sash4' },
        { w: 0.9, h: 1.0, sill: 0.6, glazing: 'sash4' },
      ],
      head: 'gauged', top: r() < 0.2 ? 'mansard' : 'parapet', parapetH: 0.9,
      wall: 'brick', wallTint: jitter(r, pick(r, TINTS.stock)),
      gfMat: stucco ? 'plaster' : null, gfTint: stucco ? jitter(r, pick(r, TINTS.stucco)) : null, rustic: stucco,
      trimMat: 'plaster', trimTint: jitter(r, TINTS.stucco[1]),
      bands: r() < 0.5, cornice: r() < 0.3,
      fan: 'half', doorCase: r() < 0.5 ? 'pilasters' : null, doorW: 1.0, doorH: 2.8,
      balconette: r() < 0.45, backAddition: true,
      doorSide: r() < 0.5 ? 'left' : 'right',
      frameTint: TINTS.frame[0],
    };
  },
  // Regency/early Victorian stucco terrace: the whole front painted stucco,
  // channelled ground floor, architraves and pediments, deep cornice.
  stucco(r, o) {
    const fl = [3.3, 3.6, 3.0, 2.6, 2.4].slice(0, o.storeys || (r() < 0.5 ? 5 : 4));
    const t = jitter(r, pick(r, TINTS.stucco), 0.04);
    return {
      w: [6.0, 7.5], d: [12, 15],
      floors: fl, raise: 0.7 + r() * 0.3, bays: 3,
      win: [
        { w: 1.05, h: 2.1, sill: 0.8, glazing: 'sash4' },
        { w: 1.1, h: 2.6, sill: 0.25, glazing: 'sash4', head: 'pediment' },
        { w: 1.05, h: 1.9, sill: 0.6, glazing: 'sash4', head: 'hood' },
        { w: 1.0, h: 1.4, sill: 0.6, glazing: 'sash4', head: 'architrave' },
        { w: 0.95, h: 1.1, sill: 0.55, glazing: 'sash4', head: 'architrave' },
      ],
      head: 'architrave', top: 'parapet', parapetH: 1.0,
      wall: 'plaster', wallTint: t, gfMat: 'plaster', gfTint: t, rustic: true,
      trimMat: 'plaster', trimTint: t.map((v) => Math.min(1.1, v * 1.04)),
      cornice: true, bands: true,
      fan: 'rect', doorCase: 'pilasters', doorW: 1.1, doorH: 2.9,
      balconette: true, backAddition: true,
      doorSide: r() < 0.5 ? 'left' : 'right',
      frameTint: TINTS.frame[0],
    };
  },
  // Mid-Victorian bay-fronted terrace of the inner suburbs.
  victorian(r, o) {
    const storeys = o.storeys || (r() < 0.5 ? 3 : 2);
    const red = r() < 0.3;
    const eaves = r() < 0.55;
    return {
      w: [5.0, 6.0], d: [9, 12],
      floors: [3.1, 2.9, 2.6].slice(0, storeys), raise: 0.35 + r() * 0.2, bays: 2,
      gf: r() < 0.65 ? 'bay' : null,
      win: [
        { w: 1.0, h: 1.95, sill: 0.75, glazing: 'sash2' },
        { w: 1.0, h: 1.85, sill: 0.7, glazing: 'sash2' },
        { w: 0.95, h: 1.55, sill: 0.65, glazing: 'sash2' },
      ],
      head: r() < 0.5 ? 'stone' : 'segment', top: eaves ? 'eaves' : 'parapet', pitch: 0.62,
      wall: 'brick', wallTint: jitter(r, red ? pick(r, TINTS.red) : pick(r, TINTS.stock)),
      trimMat: 'stone_dirty', trimTint: [0.85, 0.82, 0.76], bayMat: 'stone_dirty',
      cornice: !eaves, bands: r() < 0.4,
      porch: 0.9, fan: 'rect', doorCase: 'corbels', doorW: 0.95, doorH: 2.75,
      backAddition: true, doorSide: r() < 0.5 ? 'left' : 'right', frameTint: pick(r, TINTS.frame),
    };
  },
  // Two-up two-down: the prole street of the novel, 'little two-storey houses
  // with battered doorways which gave straight on the pavement'.
  cottage(r, o) {
    return {
      w: [4.1, 4.8], d: [7, 9],
      floors: [2.6, 2.4], raise: 0.06, bays: 2,
      win: [
        { w: 1.05, h: 1.45, sill: 0.8, glazing: r() < 0.6 ? 'sash2' : 'case' },
        { w: 1.0, h: 1.25, sill: 0.6, glazing: r() < 0.6 ? 'sash2' : 'case' },
      ],
      head: 'segment', top: 'eaves', pitch: 0.58,
      wall: r() < 0.25 ? 'brick_dark' : 'brick', wallTint: jitter(r, r() < 0.5 ? pick(r, TINTS.soot) : TINTS.stock[3]),
      sillMat: r() < 0.5 ? 'stone_dirty' : 'brick',
      porch: 0.12, fan: r() < 0.6 ? 'rect' : 'none', doorW: 0.88, doorH: 2.3,
      backAddition: true, doorSide: r() < 0.5 ? 'left' : 'right', frameTint: pick(r, [TINTS.frame[1], TINTS.frame[2], TINTS.frame[3]]),
    };
  },
  // Shops with two or three floors of rooms over them.
  shop(r, o) {
    const storeys = o.storeys || (r() < 0.5 ? 3 : 4);
    const eaves = r() < 0.3;
    const stuccoUp = r() < 0.3;
    return {
      w: [5.0, 7.0], d: [11, 15],
      floors: [3.7, 3.0, 2.8, 2.6].slice(0, storeys), raise: 0, bays: r() < 0.5 ? 2 : 3,
      gf: 'shop', fasciaTop: 3.5,
      win: [null, { w: 1.0, h: 1.95, sill: 0.65, glazing: pick(r, ['sash2', 'sash4', 'sash1']) },
        { w: 1.0, h: 1.75, sill: 0.65, glazing: 'sash2' }, { w: 0.95, h: 1.45, sill: 0.6, glazing: 'sash2' }],
      head: stuccoUp ? 'hood' : pick(r, ['stone', 'segment', 'gauged']), top: eaves ? 'eaves' : 'parapet', pitch: 0.6,
      wall: stuccoUp ? 'plaster' : 'brick', wallTint: stuccoUp ? jitter(r, pick(r, TINTS.stucco)) : jitter(r, pick(r, [...TINTS.stock, ...TINTS.red])),
      trimMat: 'plaster', trimTint: TINTS.stucco[2], cornice: !eaves, bands: r() < 0.5,
      backAddition: true, frameTint: pick(r, TINTS.frame),
    };
  },
  // A public house: glazed tiles below, the name on a long fascia, frosted
  // glass, and a fancier front above.
  pub(r, o) {
    return {
      w: [7.0, 10.0], d: [12, 15],
      floors: [4.0, 3.2, 3.0], raise: 0, bays: 3,
      gf: 'pub', fasciaTop: 3.8,
      win: [null, { w: 1.1, h: 2.1, sill: 0.55, glazing: 'sash2', head: 'pediment' }, { w: 1.05, h: 1.8, sill: 0.6, glazing: 'sash2', head: 'hood' }],
      head: 'hood', top: 'parapet', wall: r() < 0.5 ? 'brick' : 'plaster', wallTint: jitter(r, r() < 0.5 ? pick(r, TINTS.red) : pick(r, TINTS.stucco)),
      trimMat: 'plaster', trimTint: TINTS.stucco[0], cornice: true, bands: true,
      backAddition: false, frameTint: TINTS.frame[0], shopPaint: pick(r, [[0.12, 0.2, 0.14], [0.28, 0.08, 0.06], [0.1, 0.1, 0.12]]),
    };
  },
  // Victorian commercial building in Portland stone gone black with soot.
  office(r, o) {
    const storeys = o.storeys || 4 + Math.floor(r() * 3);
    return {
      w: [9, 16], d: [14, 20],
      floors: [4.4, 3.8, 3.5, 3.3, 3.1, 3.0, 2.9].slice(0, storeys), raise: 0.5, bays: 0,   // bays from width
      win: [
        { w: 1.3, h: 2.6, sill: 0.9, glazing: 'sash1', head: 'architrave' },
        { w: 1.3, h: 2.5, sill: 0.6, glazing: 'sash2', head: 'pediment' },
        { w: 1.25, h: 2.3, sill: 0.6, glazing: 'sash2', head: 'hood' },
        { w: 1.2, h: 2.1, sill: 0.6, glazing: 'sash2', head: 'architrave' },
        { w: 1.15, h: 1.9, sill: 0.6, glazing: 'sash2', head: 'architrave' },
        { w: 1.1, h: 1.7, sill: 0.55, glazing: 'sash2', head: 'architrave' },
        { w: 1.0, h: 1.5, sill: 0.55, glazing: 'sash2', head: 'architrave' },
      ],
      head: 'architrave', top: r() < 0.3 ? 'mansard' : 'parapet', parapetH: 1.1,
      wall: 'stone_dirty', wallTint: jitter(r, [0.82, 0.8, 0.75]), gfMat: 'stone_dirty', gfTint: [0.7, 0.68, 0.64], rustic: true,
      trimMat: 'stone_dirty', trimTint: [0.9, 0.88, 0.82], cornice: true, bands: true, plinth: true,
      fan: 'rect', doorCase: 'pilasters', doorW: 1.6, doorH: 3.4, glazedDoor: true,
      backAddition: false, frameTint: TINTS.frame[2], doorBay: null,
    };
  },
  // Peabody-style model dwellings: five floors of stock brick striped with
  // white bands, small paired sashes, a flat roof behind a parapet.
  tenement(r, o) {
    return {
      w: [16, 30], d: [10, 12],
      floors: [3.0, 2.75, 2.75, 2.75, 2.75, 2.75].slice(0, o.storeys || 5), raise: 0.3, bays: 0,
      win: [{ w: 0.9, h: 1.6, sill: 0.9, glazing: 'sash2' }, { w: 0.9, h: 1.55, sill: 0.8, glazing: 'sash2' }],
      head: 'segment', top: 'parapet', parapetH: 1.0,
      wall: 'brick', wallTint: jitter(r, pick(r, TINTS.stock.slice(1))),
      trimMat: 'plaster', trimTint: [0.9, 0.88, 0.82], bands: true, cornice: false,
      fan: 'none', doorCase: null, doorW: 1.6, doorH: 2.6, porch: 1.5,
      backAddition: false, frameTint: TINTS.frame[1],
    };
  },
  // LCC / private interwar flats: brown brick, concrete bands, wide steel
  // windows, a flat roof — the newest buildings Winston has known.
  interwar(r, o) {
    return {
      w: [18, 36], d: [11, 14],
      floors: [3.0, 2.8, 2.8, 2.8, 2.8, 2.8, 2.8, 2.8].slice(0, o.storeys || 5 + Math.floor(r() * 3)), raise: 0.2, bays: 0,
      win: [{ w: 1.7, h: 1.45, sill: 0.95, glazing: 'crittall' }],
      head: 'none', sillMat: 'concrete_grey', top: 'flat', parapetH: 0.9,
      wall: 'brick', wallTint: jitter(r, pick(r, [[0.78, 0.62, 0.52], [0.7, 0.6, 0.52], [0.86, 0.76, 0.62]])),
      trimMat: 'concrete_white', trimTint: [0.86, 0.85, 0.8], bands: true,
      fan: 'none', doorW: 1.8, doorH: 2.6, porch: 1.2, glazedDoor: true,
      backAddition: false, frameTint: [0.18, 0.2, 0.18],
    };
  },
  // Canal-side and railway warehouse: low floors, small segmental windows,
  // stacked loading doors in the middle with a hoist beam at the top.
  warehouse(r, o) {
    return {
      w: [14, 26], d: [14, 20],
      floors: [3.8, 3.2, 3.2, 3.2, 3.2, 3.2].slice(0, o.storeys || 4 + Math.floor(r() * 3)), raise: 0.3, bays: 0,
      win: [{ w: 1.15, h: 1.6, sill: 1.0, glazing: 'small' }],
      head: 'segment', top: 'parapet', parapetH: 0.7, sill: true,
      wall: 'brick', wallTint: jitter(r, pick(r, [TINTS.stock[2], TINTS.stock[3], ...TINTS.soot])),
      fan: 'none', doorW: 2.6, doorH: 3.0, porch: 0.2,
      backAddition: false, frameTint: [0.25, 0.22, 0.2], loading: true,
    };
  },
};

// Resolve a type into a full style: dimensions picked, bays from width where
// a type leaves them open, the decay of the run applied.
export function resolve(type, r, o = {}) {
  const st = TYPES[type](r, o);
  st.type = type;
  st.decay = o.decay ?? 0.3;
  st.state = stateFn(st.decay);
  st.roofTint = jitter(r, [0.82, 0.84, 0.88], 0.08);
  st.stackTint = jitter(r, TINTS.stock[3]);
  st.doorPaint = pick(r, TINTS.paint);
  if (st.decay > 0.5) st.wallTint = st.wallTint.map((v) => v * (0.94 - (st.decay - 0.5) * 0.2));
  st.tape = r() < 0.15;
  return st;
}

// Width-dependent bays for the wide types.
export function baysFor(st, w) {
  if (st.bays) return st.bays;
  const pitch = st.type === 'tenement' ? 2.2 : st.type === 'interwar' ? 3.0 : st.type === 'warehouse' ? 3.2 : 2.7;
  return Math.max(2, Math.round(w / pitch));
}
