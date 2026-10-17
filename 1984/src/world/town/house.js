// One building on one plot, generated from a style. The plot frame F has its
// origin at the left end of the frontage on the building line at pavement
// level: local x runs along the street (0..w, left to right as seen from the
// street), z points out into the street (the facade is the plane z = 0, the
// house lies at z < 0), y is up. Everything is real geometry with depth:
// window reveals, sashes with glazing bars, sills and lintels, panelled
// doors with fanlights, shopfronts with fascias, cornices, parapets, slate
// roofs, party-wall chimney stacks with pots, gable ends, back additions —
// and the decay of a city that has been bombed for twenty years.
import { Frame, TINTS } from './kit.js';
import { baysFor } from './styles.js';

const PI = Math.PI;
const lerp = (a, b, t) => a + (b - a) * t;

// ---------------------------------------------------------------- walls

// Rectangle x0..x1, y0..y1 in plane z of frame F, minus rectangular holes.
// Holes are clipped to the rectangle; cells are merged along rows.
export function holesWall(K, mat, F, x0, x1, y0, y1, holes, z = 0, tint) {
  const hs = holes.filter((h) => h.x1 > x0 && h.x0 < x1 && h.y1 > y0 && h.y0 < y1)
    .map((h) => ({ x0: Math.max(x0, h.x0), x1: Math.min(x1, h.x1), y0: Math.max(y0, h.y0), y1: Math.min(y1, h.y1) }));
  if (!hs.length) { K.quad(mat, F.p(x0, y0, z), F.p(x1, y0, z), F.p(x1, y1, z), F.p(x0, y1, z), null, tint); return; }
  const xs = [...new Set([x0, x1, ...hs.flatMap((h) => [h.x0, h.x1])])].sort((a, b) => a - b);
  const ys = [...new Set([y0, y1, ...hs.flatMap((h) => [h.y0, h.y1])])].sort((a, b) => a - b);
  for (let j = 0; j < ys.length - 1; j++) {
    const ya = ys[j], yb = ys[j + 1];
    if (yb - ya < 1e-4) continue;
    const ym = (ya + yb) / 2;
    let run = null;
    const flush = (xe) => { if (run !== null && xe - run > 1e-4) K.quad(mat, F.p(run, ya, z), F.p(xe, ya, z), F.p(xe, yb, z), F.p(run, yb, z), null, tint); run = null; };
    for (let i = 0; i < xs.length - 1; i++) {
      const xm = (xs[i] + xs[i + 1]) / 2;
      const inHole = hs.some((h) => xm > h.x0 && xm < h.x1 && ym > h.y0 && ym < h.y1);
      if (inHole) flush(xs[i]);
      else if (run === null) run = xs[i];
    }
    flush(xs[xs.length - 1]);
  }
}

// The four sides of a hole cut through a wall from z = 0 back to z = -depth.
function reveals(K, mat, F, h, depth, tint, sides = 'lrtb') {
  const { x0, x1, y0, y1 } = h, z = -depth;
  if (sides.includes('l')) K.face(mat, [F.p(x0, y0, 0), F.p(x0, y0, z), F.p(x0, y1, z), F.p(x0, y1, 0)], ...dir(F, 1, 0, 0), tint);
  if (sides.includes('r')) K.face(mat, [F.p(x1, y0, 0), F.p(x1, y0, z), F.p(x1, y1, z), F.p(x1, y1, 0)], ...dir(F, -1, 0, 0), tint);
  if (sides.includes('t')) K.face(mat, [F.p(x0, y1, 0), F.p(x1, y1, 0), F.p(x1, y1, z), F.p(x0, y1, z)], 0, -1, 0, tint);
  if (sides.includes('b')) K.face(mat, [F.p(x0, y0, 0), F.p(x1, y0, 0), F.p(x1, y0, z), F.p(x0, y0, z)], 0, 1, 0, tint);
}

// a direction given in the frame, in world space
function dir(F, lx, ly, lz) { return [lx * F.c + lz * F.s, ly, -lx * F.s + lz * F.c]; }

// ---------------------------------------------------------------- windows

// o: { x0, x1, y0, y1, glazing: 'sash6'|'sash4'|'sash2'|'sash1'|'case'|'crittall'|'small',
//      reveal, state: 'ok'|'broken'|'boarded'|'card'|'void', frame (tint), glass }
export function windowIn(K, F, o, wallMat, wallTint, r) {
  const rv = o.reveal ?? 0.16;
  reveals(K, wallMat, F, o, rv + 0.06, wallTint, 'lrt');
  const { x0, x1, y0, y1 } = o;
  const W = x1 - x0, Hh = y1 - y0;
  const zf = -rv;                   // front plane of the frame
  const fr = o.frame || TINTS.frame[0];
  const glass = o.glass || 'glass';
  // sill seat inside the reveal (the stone sill outside is drawn by the caller)
  K.box('stone_dirty', F, x0, x1, y0 - 0.02, y0 + 0.03, zf - 0.04, 0, 'ft');
  if (o.state === 'void') {
    // burnt out: black void and a charred frame stub
    K.quad('rubber', F.p(x0, y0, zf - 0.6), F.p(x1, y0, zf - 0.6), F.p(x1, y1, zf - 0.6), F.p(x0, y1, zf - 0.6));
    reveals(K, 'rubber', F, { x0, x1, y0, y1 }, 0.6, null, 'lrtb');
    return;
  }
  if (o.state === 'boarded') {
    // planks nailed across the opening, a little crooked
    K.quad('rubber', F.p(x0, y0, zf - 0.05), F.p(x1, y0, zf - 0.05), F.p(x1, y1, zf - 0.05), F.p(x0, y1, zf - 0.05));
    const n = Math.max(3, Math.round(Hh / 0.32));
    for (let i = 0; i < n; i++) {
      const ya = y0 + (Hh * i) / n + 0.02, yb = y0 + (Hh * (i + 1)) / n - 0.015;
      const tilt = (r() - 0.5) * 0.08;
      K.face('board', [F.p(x0 - 0.05, ya + tilt, zf + 0.02), F.p(x1 + 0.05, ya - tilt, zf + 0.02), F.p(x1 + 0.05, yb - tilt, zf + 0.02), F.p(x0 - 0.05, yb + tilt, zf + 0.02)], ...dir(F, 0, 0, 1));
    }
    return;
  }
  // box frame ring
  const t = W < 0.7 ? 0.05 : 0.07;
  frameRing(K, F, x0, x1, y0, y1, zf, t, 0.05, 'wood', fr);
  const gx0 = x0 + t, gx1 = x1 - t, gy0 = y0 + t, gy1 = y1 - t;
  const zg = zf - 0.07;
  const g = o.glazing || 'sash6';
  const panes = [];   // [x0, x1, y0, y1] pane rects for state effects
  if (g.startsWith('sash')) {
    const mid = (gy0 + gy1) / 2 + (o.y1 - o.y0 > 1.6 ? 0.04 : 0);
    // upper sash sits proud of the lower one
    const zu = zf - 0.02, zl = zf - 0.06;
    frameRing(K, F, gx0, gx1, mid, gy1, zu, 0.045, 0.04, 'wood', fr, 'b');
    frameRing(K, F, gx0, gx1, gy0, mid + 0.02, zl, 0.045, 0.04, 'wood', fr, 't');
    K.box('wood', F, gx0, gx1, mid - 0.025, mid + 0.025, zu - 0.04, zu + 0.005, 'ft', fr);   // meeting rail
    const cols = g === 'sash6' ? 3 : g === 'sash4' || g === 'sash2' ? 2 : 1;
    const rows = g === 'sash6' ? 2 : g === 'sash4' ? 2 : 1;
    for (const [ya, yb, zz] of [[mid, gy1 - 0.045, zu], [gy0 + 0.045, mid, zl]]) {
      const xa = gx0 + 0.045, xb = gx1 - 0.045;
      for (let c = 1; c < cols; c++) { const x = lerp(xa, xb, c / cols); K.box('wood', F, x - 0.014, x + 0.014, ya, yb, zz - 0.035, zz, 'flr', fr); }
      for (let q = 1; q < rows; q++) { const y = lerp(ya, yb, q / rows); K.box('wood', F, xa, xb, y - 0.014, y + 0.014, zz - 0.035, zz, 'ftu', fr); }
      for (let c = 0; c < cols; c++) for (let q = 0; q < rows; q++) panes.push([lerp(xa, xb, c / cols), lerp(xa, xb, (c + 1) / cols), lerp(ya, yb, q / rows), lerp(ya, yb, (q + 1) / rows), zz - 0.03]);
    }
  } else if (g === 'case' || g === 'small') {
    // two casements with a transom and top lights
    const tr = gy1 - Math.min(0.45, (gy1 - gy0) * 0.28);
    K.box('wood', F, gx0, gx1, tr - 0.03, tr + 0.03, zf - 0.05, zf, 'ftu', fr);
    const xm = (gx0 + gx1) / 2;
    K.box('wood', F, xm - 0.03, xm + 0.03, gy0, gy1, zf - 0.05, zf, 'flr', fr);
    const rows = g === 'small' ? 3 : 1;
    for (const [xa, xb] of [[gx0, xm], [xm, gx1]]) {
      for (let q = 1; q < rows; q++) { const y = lerp(gy0, tr, q / rows); K.box('wood', F, xa, xb, y - 0.012, y + 0.012, zf - 0.04, zf - 0.01, 'ft', fr); }
      for (let q = 0; q < rows; q++) panes.push([xa, xb, lerp(gy0, tr, q / rows), lerp(gy0, tr, (q + 1) / rows), zf - 0.03]);
      panes.push([xa, xb, tr, gy1, zf - 0.03]);
    }
  } else if (g === 'crittall') {
    // slender steel: many small horizontal panes
    const cols = Math.max(2, Math.round(W / 0.55)), rows = Math.max(3, Math.round(Hh / 0.32));
    for (let c = 1; c < cols; c++) { const x = lerp(gx0, gx1, c / cols); K.box('metal_dark', F, x - 0.012, x + 0.012, gy0, gy1, zf - 0.03, zf, 'flr'); }
    for (let q = 1; q < rows; q++) { const y = lerp(gy0, gy1, q / rows); K.box('metal_dark', F, gx0, gx1, y - 0.01, y + 0.01, zf - 0.03, zf, 'ftu'); }
    for (let c = 0; c < cols; c++) for (let q = 0; q < rows; q++) panes.push([lerp(gx0, gx1, c / cols), lerp(gx0, gx1, (c + 1) / cols), lerp(gy0, gy1, q / rows), lerp(gy0, gy1, (q + 1) / rows), zf - 0.02]);
  }
  // glass, with broken panes, cardboard and newspaper where the proles patched them
  const broken = o.state === 'broken' ? 0.3 : o.state === 'card' ? 0.45 : 0;
  if (!broken) {
    K.quad(glass, F.p(gx0, gy0, zg), F.p(gx1, gy0, zg), F.p(gx1, gy1, zg), F.p(gx0, gy1, zg));
  } else {
    for (const [xa, xb, ya, yb] of panes) {
      const u = r();
      const m = u < broken ? (o.state === 'card' ? (r() < 0.6 ? 'cardboard' : 'paper') : 'rubber') : glass;
      const zz = m === glass ? zg : zg + 0.02;
      K.quad(m, F.p(xa, ya, zz), F.p(xb, ya, zz), F.p(xb, yb, zz), F.p(xa, yb, zz));
    }
  }
  // blast tape crosses on a few panes of the old war
  if (o.tape) {
    const z = zg + 0.004;
    const tw = 0.025;
    for (const [xa, xb, ya, yb] of panes.slice(0, 4)) {
      K.bar('paper', F.p(xa, ya, z), F.p(xb, yb, z), tw);
      K.bar('paper', F.p(xb, ya, z), F.p(xa, yb, z), tw);
    }
  }
}

// A rectangular frame ring (outer x0..x1, y0..y1) of thickness t and depth dz
// whose front face is at zf. skip: sides to leave out ('t', 'b').
function frameRing(K, F, x0, x1, y0, y1, zf, t, dz, mat, tint, skip = '') {
  const z0 = zf - dz;
  if (!skip.includes('b')) K.box(mat, F, x0, x1, y0, y0 + t, z0, zf, 'ft', tint);
  if (!skip.includes('t')) K.box(mat, F, x0, x1, y1 - t, y1, z0, zf, 'fu', tint);
  K.box(mat, F, x0, x0 + t, y0, y1, z0, zf, 'fr', tint);
  K.box(mat, F, x1 - t, x1, y0, y1, z0, zf, 'fl', tint);
}

// Outside dressing round a window: stone sill, and a head (gauged brick flat
// arch, stone lintel, moulded stucco architrave, or a little cornice).
export function dressing(K, F, o, st) {
  const { x0, x1, y0, y1 } = o;
  if (st.sill !== false) {
    const m = st.sillMat || 'stone_dirty';
    K.box(m, F, x0 - 0.07, x1 + 0.07, y0 - 0.09, y0 - 0.01, -0.02, 0.06, 'flrtu', st.sillTint);
  }
  const head = o.head || st.head;
  if (head === 'gauged') {
    // rubbed red brick voussoirs, the trapezoid flush on the wall
    const hh = 0.24, sp = 0.06;
    K.face('brick', [F.p(x0, y1, 0.008), F.p(x1, y1, 0.008), F.p(x1 + sp, y1 + hh, 0.008), F.p(x0 - sp, y1 + hh, 0.008)], ...dir(F, 0, 0, 1), st.archTint || [1.05, 0.72, 0.58]);
  } else if (head === 'stone') {
    K.box('stone_dirty', F, x0 - 0.1, x1 + 0.1, y1, y1 + 0.24, -0.01, 0.02, 'flrt', st.stoneTint);
  } else if (head === 'segment') {
    // segmental arch in brick headers: a shallow curved band of quads
    const n = 6, rise = Math.min(0.16, (x1 - x0) * 0.12), hb = 0.12;
    for (let i = 0; i < n; i++) {
      const a = i / n, b = (i + 1) / n;
      const ya = y1 + Math.sin(a * PI) * rise, yb = y1 + Math.sin(b * PI) * rise;
      const xa = lerp(x0, x1, a), xb = lerp(x0, x1, b);
      K.face('brick', [F.p(xa, ya - 0.02, 0.008), F.p(xb, yb - 0.02, 0.008), F.p(xb, yb + hb, 0.008), F.p(xa, ya + hb, 0.008)], ...dir(F, 0, 0, 1), st.archTint || [0.82, 0.62, 0.5]);
    }
  } else if (head === 'architrave' || head === 'pediment' || head === 'hood') {
    // moulded surround in stucco or stone, and a cornice hood over it
    const m = st.trimMat || 'plaster', tt = st.trimTint;
    const a = 0.11;
    K.box(m, F, x0 - a, x0, y0 - 0.02, y1 + a, 0, 0.05, 'flrt', tt);
    K.box(m, F, x1, x1 + a, y0 - 0.02, y1 + a, 0, 0.05, 'flrt', tt);
    K.box(m, F, x0 - a, x1 + a, y1, y1 + a, 0, 0.05, 'fu', tt);
    if (head !== 'architrave') {
      K.sweep(m, F.sub(0, y1 + a, 0), x0 - a - 0.08, x1 + a + 0.08, [[0, 0], [0.08, 0], [0.12, 0.06], [0.16, 0.1], [0.16, 0.14], [0, 0.14]], true, tt);
      if (head === 'pediment') {
        const yb = y1 + a + 0.14, xm = (x0 + x1) / 2, ph = (x1 - x0) * 0.22;
        K.face(m, [F.p(x0 - a - 0.06, yb, 0.1), F.p(x1 + a + 0.06, yb, 0.1), F.p(xm, yb + ph, 0.1)], ...dir(F, 0, 0, 1), tt);
        K.face(m, [F.p(x0 - a - 0.06, yb, 0.1), F.p(xm, yb + ph, 0.1), F.p(xm, yb + ph, 0), F.p(x0 - a - 0.06, yb, 0)], ...dir(F, -0.5, 1, 0), tt);
        K.face(m, [F.p(xm, yb + ph, 0.1), F.p(x1 + a + 0.06, yb, 0.1), F.p(x1 + a + 0.06, yb, 0), F.p(xm, yb + ph, 0)], ...dir(F, 0.5, 1, 0), tt);
      }
    }
  }
}

// ---------------------------------------------------------------- doors

// A door set back in a reveal or porch, with a panelled leaf, letterbox and
// knob, a fanlight above, a doorcase and steps in front.
export function doorIn(K, F, o, st, r) {
  const { x0, x1, y0, y1 } = o;
  const depth = o.porch || 0.28;
  const wallMat = st.gfMat || st.wall, wallTint = st.gfTint || st.wallTint;
  const fan = o.fan || 'rect';
  const fanH = fan === 'none' ? 0 : fan === 'half' ? (x1 - x0) / 2 : 0.42;
  const dh = y1 - y0 - fanH;     // door leaf height
  reveals(K, wallMat, F, { x0, x1, y0, y1 }, depth, wallTint, 'lrt');
  // floor of the reveal/porch: stone threshold or tiles
  K.box(o.porch > 0.5 ? 'tile_white' : 'stone_dirty', F, x0, x1, y0 - 0.04, y0, -depth, 0, 't', o.porch > 0.5 ? [0.55, 0.4, 0.34] : null);
  const zd = -depth;
  const paint = o.paint || TINTS.paint[0];
  if (o.state === 'boarded') {
    K.quad('board', F.p(x0, y0, zd + 0.03), F.p(x1, y0, zd + 0.03), F.p(x1, y1, zd + 0.03), F.p(x0, y1, zd + 0.03));
    K.bar('wood_dark', F.p(x0, y0 + 0.3, zd + 0.07), F.p(x1, y1 - 0.3, zd + 0.07), 0.08);
    return;
  }
  // door leaf with frame
  K.box('wood', F, x0, x1, y0, y0 + dh, zd, zd + 0.02, 'f', paint);
  const pw = (x1 - x0 - 0.3) / 2, ph = (dh - 0.5) / 3;
  const panels = o.glazed ? [[0, 1], [1, 1]] : [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2]];
  for (const [i, j] of panels) {
    const px = x0 + 0.1 + i * (pw + 0.1), py = y0 + 0.18 + j * (ph + 0.07);
    if (o.glazed && j === 1) {
      K.quad('glass', F.p(px, py, zd + 0.015), F.p(px + pw, py, zd + 0.015), F.p(px + pw, py + ph * 2, zd + 0.015), F.p(px, py + ph * 2, zd + 0.015));
    } else {
      K.box('wood', F, px, px + pw, py, py + ph, zd + 0.02, zd + 0.035, 'flrtu', paint);
    }
  }
  K.box('brass', F, (x0 + x1) / 2 - 0.12, (x0 + x1) / 2 + 0.12, y0 + dh * 0.55, y0 + dh * 0.55 + 0.04, zd + 0.02, zd + 0.04, 'ft');
  K.box('brass', F, x1 - 0.14, x1 - 0.1, y0 + dh * 0.48, y0 + dh * 0.48 + 0.05, zd + 0.02, zd + 0.06, 'flrt');
  if (fan === 'rect') {
    K.box('wood', F, x0, x1, y0 + dh, y0 + dh + 0.06, zd, zd + 0.04, 'fu', paint);
    K.quad('glass', F.p(x0, y0 + dh + 0.06, zd + 0.01), F.p(x1, y0 + dh + 0.06, zd + 0.01), F.p(x1, y1, zd + 0.01), F.p(x0, y1, zd + 0.01));
  } else if (fan === 'half') {
    // semicircular fanlight with radiating glazing bars (Georgian)
    const cx = (x0 + x1) / 2, cy = y0 + dh, R = (x1 - x0) / 2;
    const n = 8;
    for (let i = 0; i < n; i++) {
      const a = PI - (i / n) * PI, b = PI - ((i + 1) / n) * PI;
      K.face('glass', [F.p(cx, cy, zd + 0.01), F.p(cx + Math.cos(a) * R, cy + Math.sin(a) * R, zd + 0.01), F.p(cx + Math.cos(b) * R, cy + Math.sin(b) * R, zd + 0.01)], ...dir(F, 0, 0, 1));
      K.bar('wood', F.p(cx, cy, zd + 0.03), F.p(cx + Math.cos(a) * R, cy + Math.sin(a) * R, zd + 0.03), 0.02, TINTS.frame[0]);
    }
    // the wall above the square reveal but outside the arch is filled in
    for (let i = 0; i < n; i++) {
      const a = PI - (i / n) * PI, b = PI - ((i + 1) / n) * PI;
      const p = (t) => [cx + Math.cos(t) * R, cy + Math.sin(t) * R];
      const [ax, ay] = p(a), [bx, by] = p(b);
      const ex = i < n / 2 ? x0 : x1;
      K.face(wallMat, [F.p(ax, ay, zd + 0.005), F.p(bx, by, zd + 0.005), F.p(bx, y1, zd + 0.005), F.p(ax, y1, zd + 0.005)], ...dir(F, 0, 0, 1), wallTint);
      void ex;
    }
    K.box('wood', F, x0, x1, cy - 0.05, cy, zd, zd + 0.04, 'f', paint);
  }
  // doorcase: pilasters and a cornice hood (Georgian, stucco), or plain
  if (o.case === 'pilasters') {
    const m = st.trimMat || 'plaster', tt = st.trimTint;
    K.box(m, F, x0 - 0.32, x0 - 0.06, y0, y1 + 0.05, 0, 0.12, 'flrt', tt);
    K.box(m, F, x1 + 0.06, x1 + 0.32, y0, y1 + 0.05, 0, 0.12, 'flrt', tt);
    K.box(m, F, x0 - 0.4, x1 + 0.4, y1 + 0.05, y1 + 0.32, 0, 0.16, 'flrtu', tt);
    K.sweep(m, F.sub(0, y1 + 0.32, 0), x0 - 0.5, x1 + 0.5, [[0, 0], [0.22, 0], [0.26, 0.08], [0.26, 0.12], [0, 0.12]], true, tt);
  } else if (o.case === 'corbels') {
    const m = st.trimMat || 'stone_dirty', tt = st.trimTint;
    K.box(m, F, x0 - 0.2, x0 - 0.04, y1 - 0.35, y1, 0, 0.18, 'flrtu', tt);
    K.box(m, F, x1 + 0.04, x1 + 0.2, y1 - 0.35, y1, 0, 0.18, 'flrtu', tt);
    K.box(m, F, x0 - 0.26, x1 + 0.26, y1, y1 + 0.14, 0, 0.24, 'flrtu', tt);
  }
  // steps up from the pavement
  const steps = Math.round(y0 / 0.17);
  if (steps > 0) {
    const out = o.stepsOut ?? true;
    for (let i = 0; i < steps; i++) {
      const top = y0 - i * 0.17;
      const zf = out ? 0.3 * (i + 1) : -depth + 0.3 * (steps - i);
      K.box('stone_dirty', F, x0 - 0.15, x1 + 0.15, top - 0.17, top, out ? 0 : -depth, Math.min(zf, out ? zf : 0), 'flrt');
    }
  }
}

// ---------------------------------------------------------------- shopfronts

// A Victorian shopfront across x0..x1 of the ground floor: pilasters with
// console brackets, a fascia board carrying the name, a cornice, a timber or
// tiled stallriser, plate glass with mullions and top lights, and a recessed
// door with a tiled lobby. o: { h (fascia top), sign: [u, v, du, dv] in the
// sign atlas, paint, state: 'ok'|'boarded'|'dead', doorAt: 'mid'|'left'|'right', blind }
export function shopfront(K, F, x0, x1, o, r) {
  const h = o.h || 3.4;
  const paint = o.paint || TINTS.paint[r.int(0, TINTS.paint.length - 1)];
  const pil = 0.32;
  const fy0 = h - 0.62, fy1 = h - 0.08;   // fascia
  // pilasters
  for (const [a, b] of [[x0, x0 + pil], [x1 - pil, x1]]) {
    K.box('wood', F, a, b, 0, fy0, 0, 0.12, 'flrt', paint);
    K.box('wood', F, a + 0.03, b - 0.03, fy0 - 0.05, fy1 + 0.04, 0.1, 0.3, 'flrtu', paint);   // console
  }
  // fascia board with the name
  K.box('wood', F, x0 + pil - 0.02, x1 - pil + 0.02, fy0, fy1, 0.04, 0.2, 'tu', paint);
  if (o.sign) {
    const [u, v, du, dv] = o.sign;
    K.quad('signs', F.p(x0 + pil, fy0, 0.2), F.p(x1 - pil, fy0, 0.2), F.p(x1 - pil, fy1, 0.2), F.p(x0 + pil, fy1, 0.2), [u, v, u + du, v, u + du, v + dv, u, v + dv]);
  } else K.box('wood', F, x0 + pil, x1 - pil, fy0, fy1, 0.18, 0.2, 'f', paint);
  // cornice over the fascia
  K.sweep('wood', F.sub(0, fy1, 0), x0 - 0.04, x1 + 0.04, [[0, 0], [0.26, 0], [0.32, 0.06], [0.34, 0.12], [0, 0.12]], true, paint);
  K.box('metal_dark', F, x0, x1, fy1 + 0.12, fy1 + 0.14, 0, 0.36, 't');   // lead flashing
  // the window bay
  const gx0 = x0 + pil, gx1 = x1 - pil;
  const doorW = 1.0, recess = 1.1;
  const da = o.doorAt === 'left' ? gx0 + 0.05 : o.doorAt === 'right' ? gx1 - doorW - 0.05 : (gx0 + gx1) / 2 - doorW / 2;
  const db = da + doorW;
  // soffit above the glass up to the fascia
  K.box('wood', F, gx0, gx1, fy0 - 0.12, fy0, -0.15, 0.04, 'fu', paint);
  if (o.state === 'boarded') {
    K.quad('board', F.p(gx0, 0, 0.02), F.p(gx1, 0, 0.02), F.p(gx1, fy0 - 0.12, 0.02), F.p(gx0, fy0 - 0.12, 0.02));
    for (let x = gx0 + 0.6; x < gx1 - 0.3; x += 1.2 + r() * 0.6) K.bar('wood_dark', F.p(x, 0.1, 0.05), F.p(x + (r() - 0.5) * 0.2, fy0 - 0.2, 0.05), 0.07);
    return;
  }
  const sr = 0.55;   // stallriser height
  const tr = fy0 - 0.5;   // transom
  const segs = [[gx0, da], [db, gx1]].filter(([a, b]) => b - a > 0.3);
  for (const [a, b] of segs) {
    K.box(o.tiled ? 'tile_white' : 'wood', F, a, b, 0, sr, -0.12, 0, 'ft', o.tiled ? [0.3, 0.32, 0.26] : paint);
    K.box('wood', F, a, b, sr, sr + 0.08, -0.16, -0.02, 'ft', paint);   // cill
    K.box('wood', F, a, b, tr - 0.04, tr + 0.04, -0.16, -0.06, 'ftu', paint);
    const n = Math.max(1, Math.round((b - a) / 1.1));
    for (let i = 1; i < n; i++) { const x = lerp(a, b, i / n); K.box('wood', F, x - 0.03, x + 0.03, sr + 0.08, fy0 - 0.12, -0.16, -0.08, 'flr', paint); }
    for (let i = 1; i < n * 2; i++) { const x = lerp(a, b, i / (n * 2)); K.box('wood', F, x - 0.015, x + 0.015, tr + 0.04, fy0 - 0.12, -0.16, -0.1, 'f', paint); }
    const dead = o.state === 'dead' && r() < 0.5;
    K.quad(dead ? 'rubber' : o.glass || 'glass', F.p(a, sr + 0.08, -0.13), F.p(b, sr + 0.08, -0.13), F.p(b, fy0 - 0.12, -0.13), F.p(a, fy0 - 0.12, -0.13));
    // whitewash or paper over the lower half when the shop is dead
    if (o.state === 'dead') K.quad('paper', F.p(a, sr + 0.1, -0.12), F.p(b, sr + 0.1, -0.12), F.p(b, tr - 0.3, -0.12), F.p(a, tr - 0.3, -0.12));
  }
  // the door lobby
  K.box('tile_white', F, da, db, -0.01, 0.01, -recess, 0, 't', [0.6, 0.55, 0.48]);
  K.face('glass', [F.p(da, sr, 0), F.p(da, sr, -recess), F.p(da, fy0 - 0.12, -recess), F.p(da, fy0 - 0.12, 0)], ...dir(F, 1, 0, 0));
  K.face('glass', [F.p(db, sr, 0), F.p(db, sr, -recess), F.p(db, fy0 - 0.12, -recess), F.p(db, fy0 - 0.12, 0)], ...dir(F, -1, 0, 0));
  K.face('wood', [F.p(da, 0, 0), F.p(da, 0, -recess), F.p(da, sr, -recess), F.p(da, sr, 0)], ...dir(F, 1, 0, 0), paint);
  K.face('wood', [F.p(db, 0, 0), F.p(db, 0, -recess), F.p(db, sr, -recess), F.p(db, sr, 0)], ...dir(F, -1, 0, 0), paint);
  K.box('wood', F, da, db, fy0 - 0.12, fy0, -recess, 0, 'u', paint);
  const dF = F.sub(0, 0, -recess);
  K.box('wood', dF, da, db, 0, 2.3, -0.05, 0, 'f', paint);
  K.quad('glass', dF.p(da + 0.12, 0.95, 0.005), dF.p(db - 0.12, 0.95, 0.005), dF.p(db - 0.12, 2.15, 0.005), dF.p(da + 0.12, 2.15, 0.005));
  K.quad('glass', dF.p(da, 2.3, -0.02), dF.p(db, 2.3, -0.02), dF.p(db, fy0 - 0.12, -0.02), dF.p(da, fy0 - 0.12, -0.02));
  // a canvas blind, pulled out on some
  if (o.blind) {
    const yb = fy0 - 0.1, out = 1.5;
    K.face('canvas', [F.p(gx0, yb, 0.3), F.p(gx1, yb, 0.3), F.p(gx1, yb - 0.75, out), F.p(gx0, yb - 0.75, out)], 0, 1, 0.3, o.blindTint);
    K.face('canvas', [F.p(gx0, yb - 0.75, out), F.p(gx1, yb - 0.75, out), F.p(gx1, yb - 0.95, out), F.p(gx0, yb - 0.95, out)], ...dir(F, 0, 0, 1), o.blindTint);
    K.bar('metal_dark', F.p(gx0 + 0.1, yb - 0.2, 0.3), F.p(gx0 + 0.1, yb - 0.75, out), 0.03);
    K.bar('metal_dark', F.p(gx1 - 0.1, yb - 0.2, 0.3), F.p(gx1 - 0.1, yb - 0.75, out), 0.03);
  }
}

// ---------------------------------------------------------------- roofs

// Party-wall chimney stack centred on local x = x, running front-back from
// z0 to z1, from y0 to y1, with pots along its cap.
export function stack(K, F, x, z0, z1, y0, y1, pots, tint, r) {
  const hw = 0.38;
  K.box('brick', F, x - hw, x + hw, y0, y1, z0, z1, 'fblrt', tint);
  K.box('brick', F, x - hw - 0.05, x + hw + 0.05, y1 - 0.18, y1 - 0.06, z0 - 0.05, z1 + 0.05, 'fblrtu', tint);   // oversailing course
  const n = K.lod ? 0 : pots;
  for (let i = 0; i < n; i++) {
    if (r() < 0.12) continue;   // a pot gone
    const z = lerp(z0 + 0.2, z1 - 0.2, n === 1 ? 0.5 : i / (n - 1));
    const q = F.p(x, 0, z);
    const ph = 0.35 + r() * 0.5;
    const pt = r() < 0.5 ? [0.85, 0.55, 0.42] : [0.7, 0.62, 0.55];
    K.cyl('brick', q[0], q[2], F.oy + y1, F.oy + y1 + ph, 0.12 + r() * 0.03, 6, true, pt);
  }
}

// Slate roof pitched both ways with the ridge parallel to the street.
// zf/zb: front and back wall planes; eaves overhang ov; returns ridge height.
function pitched(K, F, x0, x1, y, zf, zb, pitch, ov, st, o = {}) {
  const zr = (zf + zb) / 2;
  const rise = Math.tan(pitch) * (zf - zb) / 2;
  const yr = y + rise;
  const drop = Math.tan(pitch) * ov;
  const ex0 = x0 - (o.bargeL ? 0.15 : 0), ex1 = x1 + (o.bargeR ? 0.15 : 0);
  const sl = st.roofTint;
  K.face('slate', [F.p(ex0, y - drop, zf + ov), F.p(ex1, y - drop, zf + ov), F.p(ex1, yr, zr), F.p(ex0, yr, zr)], ...dir(F, 0, 1, 1), sl);
  K.face('slate', [F.p(ex0, yr, zr), F.p(ex1, yr, zr), F.p(ex1, y - drop, zb - ov), F.p(ex0, y - drop, zb - ov)], ...dir(F, 0, 1, -1), sl);
  // ridge tiles
  K.box('slate', F, ex0, ex1, yr - 0.05, yr + 0.08, zr - 0.12, zr + 0.12, 'fbt', [0.7, 0.62, 0.58]);
  // eaves undersides and the cast-iron gutter at the front
  K.face('wood', [F.p(ex0, y - drop, zf + ov), F.p(ex1, y - drop, zf + ov), F.p(ex1, y, zf), F.p(ex0, y, zf)], 0, -1, 0, TINTS.frame[2]);
  K.face('wood', [F.p(ex0, y, zb), F.p(ex1, y, zb), F.p(ex1, y - drop, zb - ov), F.p(ex0, y - drop, zb - ov)], 0, -1, 0, TINTS.frame[2]);
  if (ov > 0.05 && !K.lod) K.box('iron_black', F, ex0, ex1, y - drop - 0.12, y - drop + 0.02, zf + ov - 0.02, zf + ov + 0.1, 'fbtu');
  return yr;
}

// Gable triangle filling the side of a pitched roof at local x.
function gable(K, F, x, y, yr, zf, zb, mat, tint, sign) {
  K.face(mat, [F.p(x, y, zf), F.p(x, y, zb), F.p(x, yr, (zf + zb) / 2)], ...dir(F, sign, 0, 0), tint);
}

// ---------------------------------------------------------------- the house

// plot: { F, w, d, left, right ('party' | 'open'), stackL, stackR, seed }
// st:   a resolved style from styles.js
// returns { colliders: [[cx, cz, hx, hz, rot]], doors: [{x, z, rot}], gables: [...], top }
export function house(K, plot, st, r) {
  const { F, w, d } = plot;
  const out = { colliders: [], doors: [], gables: [], top: 0 };
  const fl = st.floors;
  const raise = st.raise || 0;
  const fy = [raise];
  for (const h of fl) fy.push(fy[fy.length - 1] + h);
  const top = fy[fy.length - 1];
  const parapet = st.top === 'parapet' || st.top === 'mansard' || st.top === 'flat' ? (st.parapetH ?? 0.85) : 0;
  const wallTop = top + parapet;
  out.top = wallTop;
  const wall = st.wall, wt = st.wallTint;
  const gfm = st.gfMat || wall, gft = st.gfTint || wt;
  const bays = baysFor(st, w);
  const isShop = st.gf === 'shop' || st.gf === 'pub';

  // ---- openings, floor by floor
  const holes = [];
  const wins = [];
  const bayX = (j) => (w * (j + 0.5)) / bays;
  const doorBay = st.doorBay ?? (st.doorSide === 'right' ? bays - 1 : 0);
  for (let i = 0; i < fl.length; i++) {
    if (i === 0 && isShop) continue;
    const W = st.win[i] || st.win[st.win.length - 1];
    for (let j = 0; j < bays; j++) {
      if (st.skipBay && st.skipBay(i, j)) continue;
      const cx = bayX(j);
      if (i === 0 && j === doorBay && st.gf !== 'none') {
        const dw = st.doorW || 1.0;
        const dh = st.doorH || Math.min(fl[0] - 0.35, 2.75);
        const h = { x0: cx - dw / 2, x1: cx + dw / 2, y0: raise, y1: raise + dh, door: true };
        holes.push(h);
        continue;
      }
      if (i === 0 && st.gf === 'bay') continue;   // the canted bay covers the ground floor
      const ww = W.w, wh = W.h;
      const y0 = fy[i] + W.sill;
      const h = { x0: cx - ww / 2, x1: cx + ww / 2, y0, y1: Math.min(y0 + wh, fy[i + 1] - 0.25), floor: i, glazing: W.glazing || st.glazing, head: W.head };
      holes.push(h); wins.push(h);
    }
  }
  // the canted bay window of a Victorian terrace
  let bay = null;
  if (st.gf === 'bay') {
    const bw = Math.min(2.5, w - (st.doorW || 1) - 0.8);
    const cx = doorBay === 0 ? w - bw / 2 - 0.35 : bw / 2 + 0.35;
    bay = { x0: cx - bw / 2, x1: cx + bw / 2, y0: 0, y1: fy[1] - 0.15, floor: 0 };
    holes.push(bay);
  }
  let shop = null;
  if (isShop) {
    shop = { x0: 0.02, x1: w - 0.02, y0: -0.3, y1: st.fasciaTop || 3.4 };
    holes.push(shop);
  }

  // ---- the front wall: ground floor band and the upper wall, minus openings
  const gfTop = isShop ? shop.y1 : fy[1];
  const yBase = -0.4;
  // far LOD: solid walls with the glass laid flat on them
  const lod = K.lod;
  holesWall(K, gfm, F, 0, w, yBase, gfTop, lod ? [] : holes, 0, gft);
  holesWall(K, wall, F, 0, w, gfTop, wallTop, lod ? [] : holes, 0, wt);
  if (lod) {
    for (const h of holes) {
      const m = h.door ? 'wood_dark' : h === shop ? (st.gf === 'pub' ? 'frosted' : 'glass') : (st.state(h, r) === 'boarded' ? 'board' : st.glassMat || 'glass');
      const y0 = Math.max(0, h.y0), y1 = h === shop ? h.y1 - 0.62 : h.y1;
      K.quad(m, F.p(h.x0, y0, 0.012), F.p(h.x1, y0, 0.012), F.p(h.x1, y1, 0.012), F.p(h.x0, y1, 0.012), null, h.door ? st.doorPaint : null);
      if (h === shop && st.sign) { const [u, v, du, dv] = st.sign; K.quad('signs', F.p(0.3, y1, 0.1), F.p(w - 0.3, y1, 0.1), F.p(w - 0.3, h.y1 - 0.08, 0.1), F.p(0.3, h.y1 - 0.08, 0.1), [u, v, u + du, v, u + du, v + dv, u, v + dv]); }
    }
  }
  if (st.rustic && !isShop && !lod) {
    // channelled stucco: shadow lines across the ground floor
    for (let y = raise + 0.42; y < gfTop - 0.1; y += 0.42) K.quad(gfm, F.p(0, y - 0.01, 0.003), F.p(w, y - 0.01, 0.003), F.p(w, y + 0.01, 0.003), F.p(0, y + 0.01, 0.003), null, gft.map((c) => c * 0.72));
  }
  if (st.plinth) K.box('stone_dirty', F, 0, w, yBase, raise + 0.05, 0, 0.04, 'ft');

  // ---- windows with their dressings
  for (const h of lod ? [] : wins) {
    const state = st.state(h, r);
    windowIn(K, F, { ...h, state, frame: st.frameTint, glass: st.glassMat || 'glass', tape: st.tape && r() < 0.5 }, h.floor === 0 ? gfm : wall, h.floor === 0 ? gft : wt, r);
    dressing(K, F, h, st);
    if (st.balconette && h.floor === 1) balconette(K, F, h.x0 - 0.1, h.x1 + 0.1, h.y0);
  }
  // ---- door
  for (const h of holes.filter((q) => q.door)) {
    if (!lod) doorIn(K, F, { ...h, porch: st.porch, fan: st.fan, case: st.doorCase, paint: st.doorPaint, state: st.doorState, glazed: st.glazedDoor }, st, r);
    const p = F.p((h.x0 + h.x1) / 2, 0, 0.5);
    out.doors.push({ x: p[0], z: p[2], rot: F.rot });
  }
  if (bay && !lod) bayWindow(K, F, bay, st, r);
  if (shop) {
    if (!lod) shopfront(K, F, shop.x0, shop.x1, { h: shop.y1, sign: st.sign, paint: st.shopPaint, state: st.shopState, doorAt: st.shopDoor, blind: st.blind, tiled: st.gf === 'pub', glass: st.gf === 'pub' ? 'frosted' : null }, r);
    const p = F.p(w / 2, 0, 0.6);
    out.doors.push({ x: p[0], z: p[2], rot: F.rot, shop: true });
  }

  // ---- bands, cornice, parapet
  if (st.bands && !lod) for (let i = 1; i < fl.length; i++) K.sweep(st.trimMat || 'stone_dirty', F.sub(0, fy[i] - 0.06, 0), 0, w, [[0, 0], [0.05, 0], [0.05, 0.12], [0, 0.12]], false, st.trimTint);
  if (st.top !== 'eaves') {
    if (st.cornice) K.sweep(st.trimMat || 'plaster', F.sub(0, top - 0.25, 0), 0, w, [[0, 0], [0.06, 0], [0.1, 0.08], [0.24, 0.16], [0.3, 0.24], [0.3, 0.3], [0, 0.3]], false, st.trimTint);
    // coping on the parapet
    K.box('stone_dirty', F, 0, w, wallTop, wallTop + 0.08, -0.32, 0.05, 'fbt');
    K.face(wall, [F.p(0, top, -0.28), F.p(w, top, -0.28), F.p(w, wallTop, -0.28), F.p(0, wallTop, -0.28)], ...dir(F, 0, 0, -1), wt);
  }

  // ---- side walls (always closed: a lower neighbour or a gap shows them)
  const yTopSide = st.top === 'eaves' ? top : wallTop;
  const sideL = plot.left === 'open' ? (st.sideMat || 'brick') : wall;
  const sideR = plot.right === 'open' ? (st.sideMat || 'brick') : wall;
  const stT = st.sideTint || TINTS.stock[2];
  K.face(sideL, [F.p(0, yBase, 0), F.p(0, yBase, -d), F.p(0, yTopSide, -d), F.p(0, yTopSide, 0)], ...dir(F, -1, 0, 0), plot.left === 'open' ? stT : wt);
  K.face(sideR, [F.p(w, yBase, 0), F.p(w, yBase, -d), F.p(w, yTopSide, -d), F.p(w, yTopSide, 0)], ...dir(F, 1, 0, 0), plot.right === 'open' ? stT : wt);
  // back wall with plain sash windows
  K.face('brick', [F.p(0, yBase, -d), F.p(w, yBase, -d), F.p(w, yTopSide, -d), F.p(0, yTopSide, -d)], ...dir(F, 0, 0, -1), TINTS.stock[3]);
  for (let i = 0; i < (lod ? 0 : fl.length); i++) {
    const n = Math.max(1, Math.floor(w / 3));
    for (let j = 0; j < n; j++) {
      const cx = (w * (j + 0.5)) / n, y0 = fy[i] + 0.8, y1 = Math.min(fy[i + 1] - 0.3, y0 + 1.4);
      K.face(r() < 0.15 ? 'board' : 'glass', [F.p(cx - 0.45, y0, -d - 0.02), F.p(cx + 0.45, y0, -d - 0.02), F.p(cx + 0.45, y1, -d - 0.02), F.p(cx - 0.45, y1, -d - 0.02)], ...dir(F, 0, 0, -1));
    }
  }
  // the back addition: a narrow two-storey wing into the yard
  if (st.backAddition && d > 6) {
    const bw = Math.min(w * 0.5, 2.8), bd = 3.5 + r() * 2, bh = Math.min(top, fy[Math.min(2, fl.length)]);
    const bF = F.sub(0, 0, -d);
    const bx0 = plot.left === 'open' ? 0 : 0, bx1 = bw;
    K.box('brick', bF, bx0, bx1, yBase, bh, -bd, 0, 'blr', TINTS.stock[3]);
    pitchedLean(K, bF, bx0, bx1, bh, -bd, 0, st);
    out.colliders.push(colliderOf(bF, bx0, bx1, -bd, 0));
  }

  // ---- roof
  const zf = st.top === 'eaves' ? 0 : -0.3, zb = -d;
  let ridge = wallTop;
  if (st.top === 'eaves' || st.roof === 'pitched') {
    ridge = pitched(K, F, 0, w, top, zf, zb, st.pitch || 0.6, st.top === 'eaves' ? 0.3 : 0, st, { bargeL: plot.left === 'open', bargeR: plot.right === 'open' });
    gable(K, F, 0, top, ridge, zf, zb, sideL, plot.left === 'open' ? stT : wt, -1);
    gable(K, F, w, top, ridge, zf, zb, sideR, plot.right === 'open' ? stT : wt, 1);
  } else if (st.top === 'mansard') {
    const mh = 2.6, inset = 1.0;
    const yA = wallTop - 0.4;
    K.face('slate', [F.p(0, yA, -0.3), F.p(w, yA, -0.3), F.p(w, yA + mh, -0.3 - inset), F.p(0, yA + mh, -0.3 - inset)], ...dir(F, 0, 0.4, 1), st.roofTint);
    K.face('slate', [F.p(0, yA + mh, -0.3 - inset), F.p(w, yA + mh, -0.3 - inset), F.p(w, yA + mh, -d + 0.5), F.p(0, yA + mh, -d + 0.5)], 0, 1, 0, st.roofTint);
    K.face('brick', [F.p(0, yA, -0.3), F.p(0, yA, -d + 0.5), F.p(0, yA + mh, -d + 0.5), F.p(0, yA + mh, -0.3 - inset)], ...dir(F, -1, 0, 0), wt);
    K.face('brick', [F.p(w, yA, -0.3), F.p(w, yA, -d + 0.5), F.p(w, yA + mh, -d + 0.5), F.p(w, yA + mh, -0.3 - inset)], ...dir(F, 1, 0, 0), wt);
    // dormers
    for (let j = 0; j < (lod ? 0 : bays); j++) {
      const cx = bayX(j), dw = 0.8;
      const dF = F.sub(0, 0, -0.3 - inset * 0.55);
      K.box('wood', dF, cx - dw / 2 - 0.1, cx + dw / 2 + 0.1, yA + 0.8, yA + 2.1, -0.6, 0.15, 'flrt', TINTS.frame[3]);
      K.quad(st.glassMat || 'glass', dF.p(cx - dw / 2, yA + 0.95, 0.16), dF.p(cx + dw / 2, yA + 0.95, 0.16), dF.p(cx + dw / 2, yA + 1.95, 0.16), dF.p(cx - dw / 2, yA + 1.95, 0.16));
    }
    ridge = yA + mh;
  } else {
    // hidden London roof behind the parapet: low slopes, mostly unseen
    ridge = pitched(K, F, 0, w, top, -0.3, -d, 0.35, 0, st);
    gable(K, F, 0, top, ridge, -0.3, -d, wall, wt, -1);
    gable(K, F, w, top, ridge, -0.3, -d, wall, wt, 1);
  }
  out.top = Math.max(wallTop, ridge);

  // ---- chimney stacks on the party walls
  const sz0 = Math.min(-d * 0.5 + 1.0, -1.2), sz1 = sz0 - Math.min(2.2, d * 0.35);
  const sTop = Math.max(ridge, wallTop) + 0.9 + r() * 0.6;
  const pots = Math.max(2, Math.min(8, fl.length * 2));
  if (plot.stackL !== false) stack(K, F, 0, sz1, sz0, top - 0.5, sTop, pots, st.stackTint || TINTS.stock[3], r);
  if (plot.stackR) stack(K, F, w, sz1, sz0, top - 0.5, sTop, pots, st.stackTint || TINTS.stock[3], r);

  // ---- downpipe on the party line
  if (!lod && (st.top === 'eaves' || r() < 0.5)) K.box('iron_black', F, w - 0.09, w - 0.01, yBase, top, 0, 0.09, 'flr');

  // ---- exposed side: shoring, ghosts of the neighbour, a poster spot
  for (const [side, x, sgn] of [['left', 0, -1], ['right', w, 1]]) {
    if (plot[side] !== 'open') continue;
    const p = F.p(x, 0, -d / 2);
    out.gables.push({ x: p[0], z: p[2], rot: F.rot + (sgn > 0 ? PI / 2 : -PI / 2), h: top, len: d, bombed: plot[side + 'Bombed'] });
    if (plot[side + 'Bombed'] && !lod) ghostOfNeighbour(K, F, x, sgn, fy, d, r);
    if (plot[side + 'Shore'] && !lod) shores(K, F, x, sgn, top, d, r);
  }

  out.colliders.push(colliderOf(F, 0, w, -d, 0));
  return out;
}

function colliderOf(F, x0, x1, z0, z1) {
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const p = F.p(cx, 0, cz);
  return [p[0], p[2], (x1 - x0) / 2, (z1 - z0) / 2, F.rot];
}

// lean-to roof over a back addition
function pitchedLean(K, F, x0, x1, y, z0, z1, st) {
  K.face('slate', [F.p(x0, y + 0.9, z1), F.p(x1, y + 0.9, z1), F.p(x1, y, z0 - 0.2), F.p(x0, y, z0 - 0.2)], ...dir(F, 0, 1, -1), st.roofTint);
  K.face('brick', [F.p(x0, y, z0), F.p(x0, y, z1), F.p(x0, y + 0.9, z1)], ...dir(F, -1, 0, 0), TINTS.stock[3]);
  K.face('brick', [F.p(x1, y, z0), F.p(x1, y, z1), F.p(x1, y + 0.9, z1)], ...dir(F, 1, 0, 0), TINTS.stock[3]);
}

// Wrought-iron balconette in front of a first-floor window.
function balconette(K, F, x0, x1, y) {
  K.box('stone_dirty', F, x0, x1, y - 0.1, y, 0, 0.35, 'flrtu');
  const yt = y + 0.9;
  K.box('iron_black', F, x0, x1, yt - 0.03, yt, 0.3, 0.34, 'ftlr');
  for (let x = x0 + 0.05; x <= x1 - 0.04; x += 0.12) K.box('iron_black', F, x - 0.008, x + 0.008, y, yt, 0.31, 0.33, 'flr');
  K.box('iron_black', F, x0, x0 + 0.02, y, yt, 0, 0.34, 'flr');
  K.box('iron_black', F, x1 - 0.02, x1, y, yt, 0, 0.34, 'flr');
}

// Canted ground-floor bay: three sashes on a stone base under a slate top.
function bayWindow(K, F, b, st, r) {
  const { x0, x1, y1 } = b;
  const proj = 0.7, cw = x1 - x0, side = proj;   // 45 degree cheeks
  const ya = 0.0, yw0 = 0.7, yw1 = y1 - 0.35;
  const pts = [[x0, 0], [x0 + side, proj], [x1 - side, proj], [x1, 0]];
  const m = st.bayMat || 'stone_dirty', t = st.bayTint;
  for (let i = 0; i < 3; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const rot = Math.atan2(-(bz - az), bx - ax);
    const sF = F.sub(ax, 0, az, rot);
    // base and head panels, and the mullion posts
    K.box(m, sF, 0, len, ya - 0.4, yw0, -0.1, 0, 'ft', t);
    K.box(m, sF, 0, len, yw1, y1, -0.1, 0, 'fu', t);
    K.box(m, sF, 0, 0.14, yw0, yw1, -0.1, 0.02, 'flr', t);
    K.box(m, sF, len - 0.14, len, yw0, yw1, -0.1, 0.02, 'flr', t);
    windowIn(K, sF, { x0: 0.14, x1: len - 0.14, y0: yw0, y1: yw1, glazing: st.win[0].glazing || 'sash2', reveal: 0.04, state: st.state({ floor: 0 }, r), frame: st.frameTint }, m, t, r);
    K.box('stone_dirty', sF, 0.1, len - 0.1, yw0 - 0.08, yw0, 0, 0.06, 'ft');
  }
  // the bay's roof: a small slate hip
  const yt = y1, yr = y1 + 0.55;
  K.face('slate', [F.p(x0 + side, yt, proj + 0.08), F.p(x1 - side, yt, proj + 0.08), F.p(x1 - side * 0.6, yr, 0), F.p(x0 + side * 0.6, yr, 0)], ...dir(F, 0, 1, 1), st.roofTint);
  K.face('slate', [F.p(x0 - 0.05, yt, 0), F.p(x0 + side, yt, proj + 0.08), F.p(x0 + side * 0.6, yr, 0)], ...dir(F, -1, 1, 1), st.roofTint);
  K.face('slate', [F.p(x1 - side, yt, proj + 0.08), F.p(x1 + 0.05, yt, 0), F.p(x1 - side * 0.6, yr, 0)], ...dir(F, 1, 1, 1), st.roofTint);
  // the floor of the bay
  K.face(m, [F.p(x0, ya - 0.4, 0), F.p(x1, ya - 0.4, 0), F.p(x1 - side, ya - 0.4, proj), F.p(x0 + side, ya - 0.4, proj)], 0, -1, 0, t);
  void cw;
}

// Where a neighbour was bombed away its rooms stay printed on the party wall:
// strips of wallpaper floor by floor, a fireplace and its flue, the scar of a
// staircase, the line of a lost roof.
function ghostOfNeighbour(K, F, x, sgn, fy, d, r) {
  const n = Math.min(fy.length - 1, 4);
  const papers = [[0.62, 0.55, 0.42], [0.5, 0.56, 0.5], [0.66, 0.5, 0.45], [0.55, 0.52, 0.6], [0.7, 0.66, 0.55]];
  // a frame on the side wall: +z out of it, +x runs back from the street on
  // the right-hand wall and forward on the left-hand one
  const xF = F.sub(x, 0, 0, sgn > 0 ? PI / 2 : -PI / 2);
  const B = (t) => (sgn > 0 ? t : -t);           // t metres back from the facade
  const bx = (K2, mat, a, b, y0, y1, z0, z1, faces, tint) => K2.box(mat, xF, Math.min(B(a), B(b)), Math.max(B(a), B(b)), y0, y1, z0, z1, faces, tint);
  for (let i = 0; i < n; i++) {
    if (r() < 0.2) continue;
    const ya = fy[i] + 0.05, yb = fy[i + 1] - 0.15;
    const a = 0.4 + r() * 0.8, b = d - 0.6 - r() * 1.5;
    if (b - a < 1.5) continue;
    const col = papers[r.int(0, papers.length - 1)];
    bx(K, r() < 0.5 ? 'plaster_peeling' : 'plaster', a, b, ya, yb, 0, 0.015, 'f', col);
    // fireplace and chimney breast
    const fx = (a + b) / 2;
    bx(K, 'brick', fx - 0.7, fx + 0.7, ya - 0.05, yb + 0.1, 0, 0.3, 'flrt', TINTS.soot[0]);
    bx(K, 'rubber', fx - 0.35, fx + 0.35, ya, ya + 0.75, 0.29, 0.31, 'f');
    // the line of the lost floor
    bx(K, 'rubber', 0.2, d - 0.2, fy[i + 1] - 0.15, fy[i + 1] - 0.05, 0, 0.012, 'f');
  }
}

// Raking timber shores propping an exposed party wall.
function shores(K, F, x, sgn, top, d, r) {
  const n = Math.max(2, Math.round(d / 4));
  for (let i = 0; i < n; i++) {
    const z = -d * (i + 0.5) / n;
    const foot = 4 + top * 0.3;
    const a = F.p(x + sgn * foot, 0, z), b = F.p(x + sgn * 0.15, Math.min(top - 1, 3.2 + r() * 2.5), z);
    K.bar('wood_dark', a, b, 0.22);
    const c = F.p(x + sgn * (foot * 0.55), 0, z), e = F.p(x + sgn * 0.15, Math.min(top - 2, 2.0 + r()), z);
    K.bar('wood_dark', c, e, 0.2);
    K.box('wood_dark', F.sub(x, 0, z, 0), sgn > 0 ? 0 : -0.12, sgn > 0 ? 0.12 : 0, 0, Math.min(top - 0.5, 6), -0.15, 0.15, 'flrt');
    K.box('wood_dark', F.sub(x, 0, z, 0), sgn > 0 ? 0 : -foot - 0.5, sgn > 0 ? foot + 0.5 : 0, 0, 0.18, -0.15, 0.15, 'flrt');
  }
}
