// What stands in a gap in the street wall. Bomb sites: the stumps of the
// front wall, a mound of brick rubble, a hoarding along the pavement plastered
// with posters, sometimes an emergency water tank. Shanties: the novel's
// 'sordid colonies of wooden dwellings like chicken-houses'. Walls: a yard
// wall with a gate where a frontage runs out.
import { TINTS } from './kit.js';

const PI = Math.PI;

export function fillGap(K, g, r, plan) {
  const { F, w, d } = g;
  const out = { colliders: [] };
  const kind = g.kind || 'bombsite';
  if (kind === 'wall' || w < 3) {
    // yard wall, 2 m, brick with a coping, a boarded gate
    const h = 1.9 + r() * 0.4;
    const t = TINTS.stock[2 + Math.floor(r() * 2)];
    const gate = w > 2.4 ? [w / 2 - 0.8, w / 2 + 0.8] : null;
    const segs = gate ? [[0, gate[0]], [gate[1], w]] : [[0, w]];
    for (const [a, b] of segs) {
      K.box('brick', F, a, b, -0.3, h, -0.23, 0, 'fblrt', t);
      K.box('stone_dirty', F, a - 0.02, b + 0.02, h, h + 0.08, -0.27, 0.04, 'fblrt');
    }
    if (gate) {
      K.box('board', F, gate[0], gate[1], 0, h - 0.1, -0.15, -0.1, 'fb', [0.7, 0.66, 0.6]);
    }
    out.colliders.push(col(F, 0, w, -0.25, 0));
    return out;
  }
  // ---- bomb site
  const low = [];
  // stumps of the old front wall, jagged
  let x = 0;
  while (x < w) {
    const seg = Math.min(w - x, 0.6 + r() * 1.4);
    const h = r() < 0.25 ? 0 : 0.2 + r() * (r() < 0.2 ? 2.4 : 1.0);
    if (h > 0) K.box('brick', F, x, x + seg, -0.3, h, -0.34, -0.02, 'fblrt', TINTS.soot[0]);
    low.push(h);
    x += seg;
  }
  // a hoarding along the pavement on many sites (posters go on it later)
  if (r() < 0.55 && kind !== 'shanties') {
    const h = 2.4;
    K.box('board', F, 0.05, w - 0.05, 0, h, 0.02, 0.06, 'fbt', [0.62, 0.58, 0.52]);
    for (let px = 0.4; px < w - 0.2; px += 2.4) K.box('wood_dark', F, px - 0.05, px + 0.05, 0, h, -0.1, 0.02, 'fblr');
    out.colliders.push(col(F, 0, w, -0.05, 0.08));
    out.hoarding = true;
  } else {
    // a low rope or fence of iron bars across the front, mostly gone
    for (let px = 0.3; px < w; px += 1.6 + r() * 1.5) K.bar('rust', F.p(px, 0, 0.0), F.p(px + (r() - 0.5) * 0.2, 0.9, 0.0), 0.04);
  }
  // rubble heap: a lumpy mound of quads in the rubble material
  const nx = Math.max(2, Math.round(w / 2.5)), nz = Math.max(2, Math.round(d / 2.5));
  const H = [];
  for (let i = 0; i <= nx; i++) {
    H.push([]);
    for (let j = 0; j <= nz; j++) {
      const u = i / nx, v = j / nz;
      const edge = Math.min(u, 1 - u, v, 1 - v);
      H[i].push(Math.max(0, Math.min(1, edge * 3)) * (0.4 + r() * 1.3) * (kind === 'shanties' ? 0.25 : 1));
    }
  }
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const P = (ii, jj) => F.p((w * ii) / nx, H[ii][jj] - 0.02, -0.4 - ((d - 0.6) * jj) / nz);
      K.face(kind === 'shanties' ? 'dirt' : 'rubble', [P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)], 0, 1, 0);
    }
  }
  // burnt timbers and a bedstead in the rubble
  for (let k = 0; k < Math.round(w / 4); k++) {
    const a = F.p(r() * w, 0.4 + r() * 0.4, -1 - r() * (d - 2)), b = [a[0] + (r() - 0.5) * 4, a[1] + r() * 0.8, a[2] + (r() - 0.5) * 4];
    K.bar('wood_dark', a, b, 0.14, [0.35, 0.33, 0.3]);
  }
  // emergency water supply tank
  if (r() < 0.25 && w > 7 && kind !== 'shanties') {
    const tF = F.sub(w / 2 - 2.5, 0, -d / 2 - 1);
    K.box('rust', tF, 0, 5, 0, 1.6, -3, 0, 'fblrt', [0.6, 0.6, 0.62]);
    K.box('rubber', tF, 0.1, 4.9, 1.45, 1.55, -2.9, -0.1, 't');
    out.colliders.push(col(tF, 0, 5, -3, 0));
    out.tank = true;
  }
  if (kind === 'shanties') {
    // chicken-house dwellings: board walls, tarred felt or tin roofs, a stovepipe
    let sx = 0.6;
    while (sx < w - 2.2) {
      const sw = 2.2 + r() * 1.4, sd = 2.0 + r() * 1.5, sh = 1.9 + r() * 0.4;
      const z0 = -1.2 - r() * Math.max(0.5, d - sd - 2);
      const sF = F.sub(sx, 0, z0, (r() - 0.5) * 0.25);
      const t = [0.55 + r() * 0.2, 0.5 + r() * 0.15, 0.45 + r() * 0.1];
      K.box(r() < 0.5 ? 'board' : 'wood', sF, 0, sw, 0, sh, -sd, 0, 'fblr', t);
      // door and a tiny window
      K.box('wood_dark', sF, sw * 0.2, sw * 0.2 + 0.7, 0, 1.7, 0, 0.02, 'f');
      K.quad(r() < 0.5 ? 'cardboard' : 'glass', sF.p(sw * 0.6, 1.0, 0.02), sF.p(sw * 0.6 + 0.5, 1.0, 0.02), sF.p(sw * 0.6 + 0.5, 1.4, 0.02), sF.p(sw * 0.6, 1.4, 0.02));
      // mono-pitch roof of corrugated iron
      const rm = r() < 0.6 ? 'corrugated' : 'rubber';
      K.face(rm, [sF.p(-0.2, sh + 0.35, 0.3), sF.p(sw + 0.2, sh + 0.35, 0.3), sF.p(sw + 0.2, sh - 0.1, -sd - 0.3), sF.p(-0.2, sh - 0.1, -sd - 0.3)], ...up(sF), rm === 'corrugated' ? [0.7, 0.62, 0.55] : null);
      K.face('board', [sF.p(0, sh, 0), sF.p(0, sh, -sd), sF.p(0, sh + 0.35, 0)], ...side(sF, -1), t);
      K.face('board', [sF.p(sw, sh, 0), sF.p(sw, sh, -sd), sF.p(sw, sh + 0.35, 0)], ...side(sF, 1), t);
      const pp = sF.p(sw - 0.4, 0, -sd * 0.5);
      K.cyl('metal_dark', pp[0], pp[2], F.oy + sh, F.oy + sh + 1.2, 0.07, 6, true);
      out.colliders.push(col(sF, 0, sw, -sd, 0));
      sx += sw + 0.6 + r() * 1.2;
    }
    // a fence of old doors and corrugated sheets along the street
    for (let px = 0; px < w - 0.9; px += 0.95) {
      const h = 1.4 + r() * 0.6;
      K.box(r() < 0.5 ? 'corrugated' : 'board', F, px, px + 0.92, 0, h, 0.0, 0.03, 'fb', [0.6 + r() * 0.2, 0.55, 0.5]);
    }
    out.colliders.push(col(F, 0, w, -0.05, 0.05));
  }
  void low; void plan;
  return out;
}

function col(F, x0, x1, z0, z1) {
  const p = F.p((x0 + x1) / 2, 0, (z0 + z1) / 2);
  return [p[0], p[2], Math.max(0.05, (x1 - x0) / 2), Math.max(0.05, (z1 - z0) / 2), F.rot];
}
const up = (F) => [F.s * 0.3, 1, F.c * 0.3];
const side = (F, s) => [s * F.c, 0, -s * F.s];
