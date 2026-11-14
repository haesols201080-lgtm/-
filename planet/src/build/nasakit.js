// NASA-style surface hardware, built procedurally in the design language of
// the agency's analogue habitats and surface concepts (HDU / Desert RATS,
// Artemis surface habitat): white composite pressure vessels made of labelled
// segments with ring frames, rectangular hatches with heavy frames and
// bolts, a soft fabric loft strapped with gores, horizontal tube modules on
// saddles, black radiator wings, a steel deployment frame on levelling feet,
// grated porches and ramps with yellow handrails, gold-foil avionics.
// Every part is something that would be bolted on for a reason.
import * as THREE from 'three';
import { C, L, v, e, railing } from './modelkit.js';
import { strut } from './starkit.js';

const PI = Math.PI;
const eo = (x, y, z, o) => new THREE.Euler(x, y, z, o);
export const N = {
  SHELL: 0xeeece6,      // painted composite
  SHELL2: 0xdedbd2,
  FRAME: 0xb9bdc1,      // aluminium ring frames, hatch frames
  STEEL: 0x4a4f55,      // deployment frame
  DARK: 0x2a2d31,
  RAD: 0x1d2024,        // radiator panels
  GRATE: 0x767c83,
  YELLOW: 0xe2b42a,
  ORANGE: 0xe0662a,
  STENCIL: 0x1a1a1a,
};

// local frame helper: position (lx, ly, lz) turned by yaw about (x, z)
function frame(x, z, yaw) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return (lx, ly, lz) => v(x + lx * c + lz * s, ly, z - lx * s + lz * c);
}

// rectangular hatch on a wall whose outward normal is yaw (local +z out):
// heavy frame, door leaf with a round viewport, latch bar, bolts, stencil
export function hatch(M, x, y, z, yaw, { w = 1.0, h = 1.7, depth = 0.22, label = true } = {}) {
  const W = frame(x, z, yaw), R = e(0, yaw, 0);
  const box = (k, lx, ly, lz, bw, bh, bd, col) => M.add(k, new THREE.BoxGeometry(bw, bh, bd), { pos: W(lx, y + ly, lz), rot: R, color: col });
  const f = 0.13;
  box('metal', 0, h + f / 2, 0, w + 2 * f, f, depth, N.FRAME);
  box('metal', 0, -f / 2, 0, w + 2 * f, f, depth, N.FRAME);
  for (const sx of [-1, 1]) box('metal', sx * (w / 2 + f / 2), h / 2, 0, f, h, depth, N.FRAME);
  box('hull', 0, h / 2, depth / 2 - 0.05, w, h, 0.06, N.SHELL2);
  // viewport
  M.add('glass', new THREE.CylinderGeometry(0.11, 0.11, 0.03, 20), { pos: W(0, y + h * 0.72, depth / 2 - 0.01), rot: eo(PI / 2, yaw, 0, 'YXZ') });
  M.add('metal', new THREE.TorusGeometry(0.13, 0.025, 6, 20), { pos: W(0, y + h * 0.72, depth / 2 - 0.005), rot: R, color: N.FRAME });
  // latch and grab bars
  box('metal', w * 0.28, h * 0.48, depth / 2 + 0.02, 0.05, 0.42, 0.05, N.YELLOW);
  box('metal', -w * 0.3, h * 0.5, depth / 2 + 0.02, 0.18, 0.06, 0.05, N.DARK);
  // bolts on the frame
  for (const sx of [-1, 1]) for (const sy of [0, 1]) M.add('metal', new THREE.CylinderGeometry(0.03, 0.03, 0.04, 8), { pos: W(sx * (w / 2 + f / 2), y + (sy ? h + f / 2 : -f / 2), depth / 2 + 0.01), rot: eo(PI / 2, yaw, 0, 'YXZ'), color: N.DARK });
  // stencil placard above
  if (label) box('hull', 0, h + f + 0.14, depth / 2 - 0.06, w * 0.55, 0.12, 0.02, N.STENCIL);
}

// round viewport on a cylinder wall
export function viewport(M, x, y, z, yaw, r = 0.2) {
  const W = frame(x, z, yaw);
  M.add('glass', new THREE.CylinderGeometry(r, r, 0.06, 24), { pos: W(0, y, 0.02), rot: eo(PI / 2, yaw, 0, 'YXZ') });
  M.add('metal', new THREE.TorusGeometry(r + 0.03, 0.045, 8, 24), { pos: W(0, y, 0.05), rot: e(0, yaw, 0), color: N.FRAME });
}

// vertical pressure vessel: the core of a surface habitat. Sits on a short
// skirt at y0; segment seams and stencil bands; ring frames top, middle and
// bottom; a fabric loft strapped with gores on top (or a flat bulkhead with a
// hatch ring when loft = 0). hatches: angles of the doors (local yaw).
export function vessel(M, x, z, { r = 2.4, h = 3.0, y0 = 0.7, loft = 1.6, hatches = [PI], ports = [], segs = 8, rot = 0, label = true } = {}) {
  const top = y0 + h;
  M.add('shell', new THREE.CylinderGeometry(r, r, h, 56, 1), { pos: v(x, y0 + h / 2, z), color: N.SHELL });
  // skirt down to the deck/frame
  M.add('metal', new THREE.CylinderGeometry(r * 0.93, r * 0.9, y0, 40, 1, true), { pos: v(x, y0 / 2, z), color: N.STEEL });
  // ring frames
  for (const yy of [y0, y0 + h * 0.5, top]) M.add('metal', new THREE.TorusGeometry(r + 0.02, 0.055, 6, 64), { pos: v(x, yy, z), rot: e(PI / 2, 0, 0), color: N.FRAME });
  // segment seams and their stencilled names
  for (let i = 0; i < segs; i++) {
    const a = rot + (i + 0.5) / segs * PI * 2;
    M.box('metal', x + Math.sin(a) * (r + 0.006), y0 + h / 2, z + Math.cos(a) * (r + 0.006), 0.035, h - 0.1, 0.02, N.FRAME, a);
    if (label) {
      const b = a + PI / segs * 0.62;
      M.box('shell', x + Math.sin(b) * (r + 0.008), y0 + h * 0.62, z + Math.cos(b) * (r + 0.008), 0.05, 0.62, 0.012, N.STENCIL, b);
    }
  }
  for (const a of hatches) hatch(M, x + Math.sin(a) * (r - 0.04), y0 + 0.12, z + Math.cos(a) * (r - 0.04), a, { w: 0.95, h: 1.75 });
  for (const p of ports) viewport(M, x + Math.sin(p.a) * (r - 0.01), y0 + (p.y || 2.1), z + Math.cos(p.a) * (r - 0.01), p.a, p.r || 0.2);
  let cap = top;
  if (loft > 0) {
    // inflatable loft: a short soft drum swelling slightly, closed by a dome
    const prof = [];
    const n = 18;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const yy = t * loft;
      const k = t < 0.5 ? 1 : Math.cos((t - 0.5) / 0.5 * PI / 2);
      const bulge = 1 + 0.025 * Math.sin(Math.min(1, t / 0.5) * PI);
      prof.push(new THREE.Vector2(Math.max(0.001, r * 0.985 * bulge * (t < 0.5 ? 1 : Math.pow(k, 0.55))), yy));
    }
    prof.push(new THREE.Vector2(0.001, loft));
    M.add('mli', new THREE.LatheGeometry(prof, 48), { pos: v(x, top, z), color: 0xf1efe9 });
    // gore straps
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * PI * 2;
      const pts = prof.filter((_, j) => j % 3 === 0 || j === prof.length - 2).map((p) => [x + Math.sin(a) * (p.x + 0.02), top + p.y + 0.005, z + Math.cos(a) * (p.x + 0.02)]);
      M.tube('metal', pts, 0.022, N.FRAME, 4);
    }
    M.add('metal', new THREE.TorusGeometry(r * 0.99, 0.07, 6, 64), { pos: v(x, top + 0.04, z), rot: e(PI / 2, 0, 0), color: N.DARK });
    cap = top + loft;
  } else {
    M.add('shell', new THREE.CylinderGeometry(r * 0.98, r, 0.25, 56), { pos: v(x, top + 0.12, z), color: N.SHELL2 });
    M.add('metal', new THREE.TorusGeometry(0.55, 0.08, 8, 28), { pos: v(x, top + 0.27, z), rot: e(PI / 2, 0, 0), color: N.FRAME });
    cap = top + 0.3;
  }
  M.colCyl(x, z, r + 0.05, 0, cap);
  return cap;
}

// horizontal tube module along yaw (local +x is the module axis), centre
// (x, y, z): ring frames, longitudinal stiffeners, domed end bulkheads,
// saddles to the ground, an end hatch at +x when endHatch
export function tubeModule(M, x, y, z, len, r, yaw = 0, { endHatch = true, startHatch = false, ribs = 3, saddles = true, ports = 0, color = N.SHELL } = {}) {
  const W = frame(x, z, yaw);
  M.add('shell', new THREE.CylinderGeometry(r, r, len, 40), { pos: v(x, y, z), rot: eo(0, yaw, PI / 2, 'YXZ'), color });
  for (const sx of [-1, 1]) {
    M.add('shell', new THREE.SphereGeometry(r, 32, 10, 0, PI * 2, 0, PI / 2), { pos: W(sx * len / 2, y, 0), rot: eo(0, yaw, -sx * PI / 2, 'YXZ'), scale: v(1, 0.28, 1), color: N.SHELL2 });
  }
  for (let i = 0; i <= ribs; i++) {
    const lx = -len / 2 + 0.12 + i * (len - 0.24) / ribs;
    M.add('metal', new THREE.TorusGeometry(r + 0.02, 0.05, 6, 40), { pos: W(lx, y, 0), rot: e(0, yaw + PI / 2, 0), color: N.FRAME });
  }
  for (const a of [PI / 2, PI * 0.9, PI * 0.1]) {
    const [cy, cz] = [Math.sin(a) * (r + 0.01), Math.cos(a) * (r + 0.01)];
    M.add('metal', new THREE.BoxGeometry(len - 0.3, 0.035, 0.035), { pos: W(0, y + cy, cz), rot: e(0, yaw, 0), color: N.FRAME });
  }
  for (let k = 0; k < ports; k++) {
    const lx = -len / 2 + (k + 1) * len / (ports + 1);
    const p = W(lx, 0, -(r - 0.01));
    viewport(M, p.x, y + 0.15, p.z, yaw + PI, 0.16);
  }
  if (saddles && y - r > 0.05) {
    for (const lx of [-len / 2 + 0.6, len / 2 - 0.6]) {
      const p = W(lx, 0, 0);
      M.add('metal', new THREE.BoxGeometry(0.22, y - r * 0.6, r * 1.5), { pos: v(p.x, (y - r * 0.6) / 2, p.z), rot: e(0, yaw, 0), color: N.STEEL });
      M.add('metal', new THREE.BoxGeometry(0.5, 0.08, r * 1.7), { pos: v(p.x, 0.04, p.z), rot: e(0, yaw, 0), color: N.DARK });
    }
  }
  if (endHatch) { const p = W(len / 2 + r * 0.28 - 0.05, 0, 0); hatch(M, p.x, y - 0.85, p.z, yaw + PI / 2, { w: 0.8, h: 1.45, depth: 0.2 }); }
  if (startHatch) { const p = W(-len / 2 - r * 0.28 + 0.05, 0, 0); hatch(M, p.x, y - 0.85, p.z, yaw - PI / 2, { w: 0.8, h: 1.45, depth: 0.2 }); }
  // collider along the axis
  const a = W(-len / 2 - r * 0.3, 0, -r), b = W(len / 2 + r * 0.3, 0, r);
  M.col(Math.min(a.x, b.x), 0, Math.min(a.z, b.z), Math.max(a.x, b.x), y + r, Math.max(a.z, b.z));
}

// deployable radiator wing: a black panel in a frame, hinged on a post
export function radiatorWing(M, x, z, yaw, { w = 1.4, h = 3.0, y0 = 0.6 } = {}) {
  const W = frame(x, z, yaw), R = e(0, yaw, 0);
  M.add('metal', new THREE.BoxGeometry(w, h, 0.05), { pos: W(w / 2, y0 + h / 2, 0), rot: R, color: N.RAD });
  for (let i = 1; i < 6; i++) M.add('metal', new THREE.BoxGeometry(0.025, h - 0.1, 0.07), { pos: W(i * w / 6, y0 + h / 2, 0), rot: R, color: 0x34383d });
  M.add('metal', new THREE.BoxGeometry(w, 0.06, 0.08), { pos: W(w / 2, y0 + h, 0), rot: R, color: N.FRAME });
  M.add('metal', new THREE.BoxGeometry(w, 0.06, 0.08), { pos: W(w / 2, y0, 0), rot: R, color: N.FRAME });
  M.add('metal', new THREE.CylinderGeometry(0.06, 0.06, h + y0, 8), { pos: W(0, (h + y0) / 2, 0), color: N.FRAME });
}

// steel deployment frame on levelling feet, top of the beams at y
export function deployFrame(M, x, z, w, d, y = 0.6, yaw = 0) {
  const W = frame(x, z, yaw), R = e(0, yaw, 0);
  const beam = (lx, lz, bw, bd) => {
    M.add('metal', new THREE.BoxGeometry(bw, 0.26, bd), { pos: W(lx, y - 0.13, lz), rot: R, color: N.STEEL });
    M.add('metal', new THREE.BoxGeometry(bw + (bw > bd ? 0 : 0.14), 0.03, bd + (bd > bw ? 0 : 0.14)), { pos: W(lx, y - 0.015, lz), rot: R, color: 0x5b6168 });
  };
  beam(0, -d / 2, w, 0.2); beam(0, d / 2, w, 0.2); beam(-w / 2, 0, 0.2, d); beam(w / 2, 0, 0.2, d);
  beam(0, 0, w, 0.16); beam(0, 0, 0.16, d);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const p = W(sx * w / 2, 0, sz * d / 2);
    M.cyl('metal', p.x, 0, p.z, 0.08, y - 0.2, 0x8a9096, 10);
    M.cyl('metal', p.x, 0, p.z, 0.32, 0.08, N.DARK, 16);
  }
}

// grated platform, top at y
export function grating(M, x, y, z, w, d, yaw = 0) {
  const W = frame(x, z, yaw), R = e(0, yaw, 0);
  M.add('metal', new THREE.BoxGeometry(w, 0.08, d), { pos: W(0, y - 0.04, 0), rot: R, color: N.GRATE });
  const n = Math.round(w / 0.12);
  for (let i = 0; i <= n; i++) M.add('metal', new THREE.BoxGeometry(0.025, 0.02, d - 0.04), { pos: W(-w / 2 + i * w / n, y + 0.005, 0), rot: R, color: 0x9aa0a6 });
  M.add('metal', new THREE.BoxGeometry(w + 0.06, 0.14, 0.06), { pos: W(0, y - 0.07, -d / 2), rot: R, color: N.STEEL });
  M.add('metal', new THREE.BoxGeometry(w + 0.06, 0.14, 0.06), { pos: W(0, y - 0.07, d / 2), rot: R, color: N.STEEL });
  if (y > 0.25) for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const p = W(sx * (w / 2 - 0.08), 0, sz * (d / 2 - 0.08)); M.cyl('metal', p.x, 0, p.z, 0.05, y - 0.08, N.STEEL, 8); }
  const a = W(-w / 2, 0, -d / 2), b = W(w / 2, 0, d / 2);
  M.col(Math.min(a.x, b.x), 0, Math.min(a.z, b.z), Math.max(a.x, b.x), y, Math.max(a.z, b.z), { walk: true });
}

// ramp from the ground up to a platform edge at height y, running along yaw
// (local -z is downhill), with yellow handrails both sides
export function ramp(M, x, z, yaw, y, { w = 1.2, run = 0 } = {}) {
  const W = frame(x, z, yaw);
  const L = run || Math.max(1.6, y * 3.2);
  const ang = Math.atan2(y, L);
  const len = Math.hypot(L, y);
  const mid = W(0, y / 2, -L / 2);
  M.add('metal', new THREE.BoxGeometry(w, 0.07, len), { pos: mid, rot: eo(-ang, yaw, 0, 'YXZ'), color: N.GRATE });
  const n = Math.floor(len / 0.3);
  for (let i = 1; i < n; i++) {
    const t = i / n; const p = W(0, y * (1 - t) + 0.04, -L * t);
    M.add('metal', new THREE.BoxGeometry(w - 0.06, 0.025, 0.04), { pos: p, rot: eo(-ang, yaw, 0, 'YXZ'), color: 0x9aa0a6 });
  }
  for (const sx of [-1, 1]) {
    const a = W(sx * w / 2, y + 1.0, 0), b = W(sx * w / 2, 1.0, -L);
    strut(M, [a.x, a.y, a.z], [b.x, b.y, b.z], 0.05, N.YELLOW);
    const a2 = W(sx * w / 2, y + 0.5, 0), b2 = W(sx * w / 2, 0.5, -L);
    strut(M, [a2.x, a2.y, a2.z], [b2.x, b2.y, b2.z], 0.04, N.YELLOW);
    for (let k = 0; k <= 2; k++) { const t = k / 2; const p = W(sx * w / 2, 0, -L * t); M.cyl('metal', p.x, 0, p.z, 0.03, y * (1 - t) + 1.0, N.YELLOW, 6); }
  }
}

// handrail around three sides of a platform (open at the front)
export function platformRails(M, x, y, z, w, d, yaw = 0, open = 'front') {
  const W = frame(x, z, yaw);
  const seg = (lx0, lz0, lx1, lz1) => { const a = W(lx0, 0, lz0), b = W(lx1, 0, lz1); railing(M, a.x, a.z, b.x, b.z, y, 1.0, N.YELLOW); };
  if (open !== 'left') seg(-w / 2, -d / 2, -w / 2, d / 2);
  if (open !== 'right') seg(w / 2, -d / 2, w / 2, d / 2);
  if (open !== 'back') seg(-w / 2, d / 2, w / 2, d / 2);
}

// avionics box in gold foil on a frame
export function avionics(M, x, y, z, w, h, d, yaw = 0) {
  M.box('foil', x, y + h / 2, z, w, h, d, 0xd8a640, yaw);
  M.box('metal', x, y + 0.03, z, w + 0.1, 0.06, d + 0.1, N.DARK, yaw);
  M.box('metal', x, y + h + 0.02, z, w + 0.04, 0.04, d + 0.04, N.FRAME, yaw);
}

// labelled gas bottles in a rack (O2 green bands, N2 black)
export function bottleRack(M, x, z, yaw, n = 4, band = 0x2f8f4a) {
  const W = frame(x, z, yaw);
  for (let i = 0; i < n; i++) {
    const p = W(-(n - 1) * 0.31 + i * 0.62, 0, 0);
    M.cyl('shell', p.x, 0.1, p.z, 0.25, 1.55, 0xe8e8e4, 18);
    M.add('shell', new THREE.SphereGeometry(0.25, 16, 8, 0, PI * 2, 0, PI / 2), { pos: v(p.x, 1.65, p.z), color: 0xe8e8e4 });
    M.cyl('shell', p.x, 1.25, p.z, 0.255, 0.16, band, 18);
    M.cyl('metal', p.x, 1.85, p.z, 0.05, 0.16, 0x8a9096, 8);
  }
  const a = W(-(n - 1) * 0.31 - 0.35, 0, -0.3), b = W((n - 1) * 0.31 + 0.35, 0, 0.3);
  M.box('metal', (a.x + b.x) / 2, 1.0, (a.z + b.z) / 2, Math.abs(Math.cos(yaw)) * (n * 0.62 + 0.1) + 0.06, 0.06, Math.abs(Math.sin(yaw)) * (n * 0.62 + 0.1) + 0.06, N.STEEL);
  M.box('metal', (a.x + b.x) / 2, 0.05, (a.z + b.z) / 2, Math.abs(Math.cos(yaw)) * (n * 0.62 + 0.2) + 0.5, 0.1, Math.abs(Math.sin(yaw)) * (n * 0.62 + 0.2) + 0.5, N.DARK);
  M.col(Math.min(a.x, b.x), 0, Math.min(a.z, b.z), Math.max(a.x, b.x), 1.9, Math.max(a.z, b.z));
}

// ---------------------------------------------------------------- more agency hardware

// ISS-style cupola on top of a module: octagonal frustum of window panes
// with heavy mullions, a top window, shutters folded open
export function cupola(M, x, y, z, r = 0.85) {
  M.add('shell', new THREE.CylinderGeometry(r * 1.02, r * 1.08, 0.32, 8), { pos: v(x, y + 0.16, z), rot: e(0, PI / 8, 0), color: N.SHELL2 });
  M.add('glass', new THREE.CylinderGeometry(r * 0.66, r, 0.55, 8, 1, true), { pos: v(x, y + 0.6, z), rot: e(0, PI / 8, 0) });
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * PI * 2;
    strut(M, [x + Math.sin(a) * r, y + 0.32, z + Math.cos(a) * r], [x + Math.sin(a) * r * 0.66, y + 0.88, z + Math.cos(a) * r * 0.66], 0.07, N.FRAME);
    const b = a + PI / 8;
    M.box('metal', x + Math.sin(b) * r * 1.12, y + 0.62, z + Math.cos(b) * r * 1.12, r * 0.62, 0.42, 0.03, N.SHELL2, b);
  }
  M.add('metal', new THREE.CylinderGeometry(r * 0.66, r * 0.66, 0.1, 8), { pos: v(x, y + 0.9, z), rot: e(0, PI / 8, 0), color: N.FRAME });
  M.add('glass', new THREE.CylinderGeometry(r * 0.48, r * 0.48, 0.04, 24), { pos: v(x, y + 0.96, z) });
  M.colCyl(x, z, r, y, y + 1.0);
}

// soft-goods expandable module (TransHab / BEAM lineage): MLI skin swelling
// slightly between hard bulkheads, longerons and circumferential straps
export function inflatable(M, x, y, z, len, r, yaw = 0, { color = 0xefece4 } = {}) {
  const prof = [];
  const n = 20;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    prof.push(new THREE.Vector2(r * (0.86 + 0.14 * Math.pow(Math.sin(t * PI), 0.35)), (t - 0.5) * len));
  }
  const g = new THREE.LatheGeometry(prof, 40);
  g.rotateZ(PI / 2); g.rotateY(yaw);
  M.add('mli', g, { pos: v(x, y, z), color });
  const W = frame(x, z, yaw);
  for (const sx of [-1, 1]) {
    const p = W(sx * len / 2, 0, 0);
    M.add('shell', new THREE.CylinderGeometry(r * 0.88, r * 0.88, 0.22, 40), { pos: v(p.x, y, p.z), rot: eo(0, yaw, PI / 2, 'YXZ'), color: N.SHELL2 });
    M.add('metal', new THREE.TorusGeometry(r * 0.88, 0.06, 6, 40), { pos: v(p.x, y, p.z), rot: e(0, yaw + PI / 2, 0), color: N.FRAME });
  }
  for (let i = 1; i < 5; i++) {
    const lx = -len / 2 + i * len / 5;
    const rr = r * (0.86 + 0.14 * Math.pow(Math.sin(i / 5 * PI), 0.35)) + 0.012;
    const p = W(lx, 0, 0);
    M.add('metal', new THREE.TorusGeometry(rr, 0.022, 4, 40), { pos: v(p.x, y, p.z), rot: e(0, yaw + PI / 2, 0), color: N.FRAME });
  }
  for (let k = 0; k < 8; k++) {
    const a = k / 8 * PI * 2;
    const ax = W(1, 0, 0).sub(W(0, 0, 0)).normalize(), perp = new THREE.Vector3(-ax.z, 0, ax.x);
    const pts2 = prof.filter((_, j) => j % 2 === 0).map((q) => { const p = W(q.y, 0, 0); const rr = q.x + 0.012; return [p.x + perp.x * Math.cos(a) * rr, y + Math.sin(a) * rr, p.z + perp.z * Math.cos(a) * rr]; });
    M.tube('metal', pts2, 0.02, N.FRAME, 4);
  }
  const a = W(-len / 2, 0, -r), b = W(len / 2, 0, r);
  M.col(Math.min(a.x, b.x), y - r, Math.min(a.z, b.z), Math.max(a.x, b.x), y + r, Math.max(a.z, b.z));
}

// short node with berthing rings on its sides (local +-z) and ends (+-x)
export function node(M, x, y, z, r = 1.15, len = 2.2, yaw = 0, ports = ['x-', 'x+', 'z-', 'z+']) {
  const W = frame(x, z, yaw);
  M.add('shell', new THREE.CylinderGeometry(r, r, len, 32), { pos: v(x, y, z), rot: eo(0, yaw, PI / 2, 'YXZ'), color: N.SHELL });
  for (const sx of [-1, 1]) { const p = W(sx * len / 2, 0, 0); M.add('shell', new THREE.CylinderGeometry(r * 0.98, r, 0.16, 32), { pos: v(p.x, y, p.z), rot: eo(0, yaw, PI / 2, 'YXZ'), color: N.SHELL2 }); }
  for (const pt of ports) {
    if (pt[0] === 'z') {
      const sz = pt[1] === '-' ? -1 : 1, p = W(0, 0, sz * r);
      M.add('metal', new THREE.CylinderGeometry(0.62, 0.66, 0.28, 24), { pos: v(p.x, y, p.z), rot: eo(PI / 2, yaw, 0, 'YXZ'), color: N.FRAME });
      M.add('shell', new THREE.CylinderGeometry(0.5, 0.5, 0.3, 24), { pos: v(p.x, y, p.z), rot: eo(PI / 2, yaw, 0, 'YXZ'), color: N.SHELL2 });
    }
  }
  const a = W(-len / 2, 0, -r), b = W(len / 2, 0, r);
  M.col(Math.min(a.x, b.x), 0, Math.min(a.z, b.z), Math.max(a.x, b.x), y + r, Math.max(a.z, b.z));
}

// vertical pressure tank on legs: capsule body, stencil band, valve and stub
export function tankV(M, x, z, r, h, { y0 = 0.5, band = N.ORANGE, color = 0xeceae4, key = 'shell' } = {}) {
  const prof = [], head = r * 0.55, body = Math.max(0.1, h - 2 * head);
  for (let i = 0; i <= 8; i++) { const a = i / 8 * PI / 2; prof.push(new THREE.Vector2(Math.max(0.001, Math.sin(a) * r), -body / 2 - Math.cos(a) * head)); }
  for (let i = 0; i <= 8; i++) { const a = i / 8 * PI / 2; prof.push(new THREE.Vector2(Math.max(0.001, Math.cos(a) * r), body / 2 + Math.sin(a) * head)); }
  M.add(key, new THREE.LatheGeometry(prof, 28), { pos: v(x, y0 + h / 2, z), color });
  if (band) M.add('shell', new THREE.CylinderGeometry(r + 0.012, r + 0.012, Math.min(0.3, body * 0.25), 28, 1, true), { pos: v(x, y0 + h * 0.62, z), color: band });
  M.add('metal', new THREE.TorusGeometry(r + 0.01, 0.035, 4, 28), { pos: v(x, y0 + head, z), rot: e(PI / 2, 0, 0), color: N.FRAME });
  for (let k = 0; k < 4; k++) {
    const a = k / 4 * PI * 2 + PI / 4;
    strut(M, [x + Math.sin(a) * r * 0.9, y0 + head * 0.7, z + Math.cos(a) * r * 0.9], [x + Math.sin(a) * r * 1.05, 0, z + Math.cos(a) * r * 1.05], 0.07, N.STEEL);
  }
  M.cyl('metal', x, y0 + h - 0.05, z, 0.06, 0.35, N.FRAME, 8);
  M.box('metal', x, y0 + h + 0.32, z, 0.18, 0.1, 0.1, N.YELLOW);
  M.colCyl(x, z, r, 0, y0 + h);
}

// spherical pressure tank on four legs with an equator ring
export function sphereTank(M, x, y, z, r, { color = 0xe9e7e1, key = 'shell' } = {}) {
  M.add(key, new THREE.SphereGeometry(r, 28, 16), { pos: v(x, y, z), color });
  M.add('metal', new THREE.TorusGeometry(r + 0.01, 0.05, 6, 32), { pos: v(x, y, z), rot: e(PI / 2, 0, 0), color: N.FRAME });
  for (let k = 0; k < 4; k++) {
    const a = k / 4 * PI * 2 + PI / 4;
    M.cyl('metal', x + Math.sin(a) * r * 0.98, 0, z + Math.cos(a) * r * 0.98, 0.07, y, N.STEEL, 8);
  }
  M.colCyl(x, z, r, 0, y + r);
}

// tall process column (distillation / electrolysis stack): stiffener rings,
// a caged ladder and a railed platform at the top
export function processColumn(M, x, z, r, h, { y0 = 0.3, yaw = 0 } = {}) {
  M.cyl('steel', x, y0, z, r, h, 0xd5d8db, 20);
  M.add('steel', new THREE.SphereGeometry(r, 20, 8, 0, PI * 2, 0, PI / 2), { pos: v(x, y0 + h, z), scale: v(1, 0.5, 1), color: 0xd5d8db });
  for (let yy = y0 + 0.8; yy < y0 + h; yy += 1.0) M.add('metal', new THREE.TorusGeometry(r + 0.01, 0.03, 4, 24), { pos: v(x, yy, z), rot: e(PI / 2, 0, 0), color: N.FRAME });
  const W = frame(x, z, yaw);
  const l0 = W(-0.22, 0, -r - 0.2), l1 = W(0.22, 0, -r - 0.2);
  for (const p of [l0, l1]) M.cyl('metal', p.x, 0, p.z, 0.025, y0 + h, N.YELLOW, 6);
  for (let yy = 0.3; yy < y0 + h; yy += 0.32) { const p = W(0, 0, -r - 0.2); M.box('metal', p.x, yy, p.z, 0.44, 0.025, 0.025, N.YELLOW, yaw); }
  M.cyl('metal', x, y0 + h - 0.1, z, r + 0.55, 0.06, N.GRATE, 20);
  M.add('metal', new THREE.TorusGeometry(r + 0.55, 0.025, 4, 24), { pos: v(x, y0 + h + 0.9, z), rot: e(PI / 2, 0, 0), color: N.YELLOW });
  for (let k = 0; k < 6; k++) { const a = k / 6 * PI * 2; M.cyl('metal', x + Math.sin(a) * (r + 0.55), y0 + h - 0.05, z + Math.cos(a) * (r + 0.55), 0.02, 0.95, N.YELLOW, 4); }
  M.vent(x, y0 + h + 0.4, z, { rate: 1.2, size: 0.9 + r });
  M.colCyl(x, z, r, 0, y0 + h);
}

// rigid hangar (rover garage): straight walls under a faceted roof, ring
// frames outside the skin, a segmented roll-up door on the front end
// (local -z), personnel hatch on the side, beacons; length along local z
export function hangar(M, x, z, w, d, h, yaw = 0, { color = N.SHELL, door = true, stripe = null } = {}) {
  const W = frame(x, z, yaw);
  const wall = h * 0.58;
  const prof = [[-w / 2, 0], [-w / 2, wall], [-w * 0.3, h], [w * 0.3, h], [w / 2, wall], [w / 2, 0]];
  const sh = new THREE.Shape();
  sh.moveTo(prof[0][0], prof[0][1]); for (const p of prof.slice(1)) sh.lineTo(p[0], p[1]); sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: false });
  g.translate(0, 0, -d / 2); g.rotateY(yaw);
  M.add('shell', g, { pos: v(x, 0, z), color });
  // ring frames
  const nf = Math.max(2, Math.round(d / 1.6));
  for (let i = 0; i <= nf; i++) {
    const lz = -d / 2 + i * d / nf;
    for (let k = 0; k < prof.length - 1; k++) {
      const a = W(prof[k][0] * 1.02, prof[k][1], lz), b = W(prof[k + 1][0] * 1.02, prof[k + 1][1], lz);
      strut(M, [a.x, prof[k][1] + (k === 0 ? 0 : 0.02), a.z], [b.x, prof[k + 1][1] + 0.02, b.z], 0.1, N.FRAME);
    }
  }
  if (stripe) for (const sx of [-1, 1]) { const p = W(sx * (w / 2 + 0.01), 0, 0); M.box('shell', p.x, wall * 0.55, p.z, 0.02, 0.35, d - 0.2, stripe, yaw); }
  if (door) {
    const p = W(0, 0, -d / 2 - 0.03), dw = w * 0.62, dh = wall * 0.95;
    M.box('metal', p.x, dh / 2, p.z, dw, dh, 0.06, 0xc9ccd0, yaw);
    for (let k = 1; k < Math.round(dh / 0.32); k++) { const q = W(0, 0, -d / 2 - 0.07); M.box('metal', q.x, k * 0.32, q.z, dw - 0.04, 0.03, 0.03, 0x9a9ea2, yaw); }
    for (const sx of [-1, 1]) { const q = W(sx * (dw / 2 + 0.12), 0, -d / 2 - 0.08); M.box('metal', q.x, dh / 2, q.z, 0.2, dh, 0.18, N.FRAME, yaw); }
    const q = W(0, 0, -d / 2 - 0.08); M.box('metal', q.x, dh + 0.15, q.z, dw + 0.5, 0.3, 0.2, N.FRAME, yaw);
    for (const sx of [-1, 1]) { const b = W(sx * (dw / 2 + 0.12), 0, -d / 2 - 0.2); M.sphere('blink', b.x, dh + 0.42, b.z, 0.08, N.ORANGE, 6); }
  }
  const a = W(-w / 2, 0, -d / 2), b = W(w / 2, 0, d / 2);
  M.col(Math.min(a.x, b.x), 0, Math.min(a.z, b.z), Math.max(a.x, b.x), h, Math.max(a.z, b.z));
  return wall;
}

// growth module: a transparent pressure tube with ring frames, rack shelves
// of plants under magenta grow light inside
export function growTube(M, x, y, z, len, r, yaw = 0) {
  const W = frame(x, z, yaw);
  M.add('glass', new THREE.CylinderGeometry(r, r, len, 32, 1, true), { pos: v(x, y, z), rot: eo(0, yaw, PI / 2, 'YXZ') });
  for (let i = 0; i <= 4; i++) { const p = W(-len / 2 + i * len / 4, 0, 0); M.add('metal', new THREE.TorusGeometry(r + 0.02, 0.05, 6, 32), { pos: v(p.x, y, p.z), rot: e(0, yaw + PI / 2, 0), color: N.FRAME }); }
  for (const sx of [-1, 1]) { const p = W(sx * len / 2, 0, 0); M.add('shell', new THREE.CylinderGeometry(r, r, 0.2, 32), { pos: v(p.x, y, p.z), rot: eo(0, yaw, PI / 2, 'YXZ'), color: N.SHELL2 }); }
  for (const ly of [-r * 0.45, 0, r * 0.45]) {
    const p = W(0, 0, 0);
    M.add('metal', new THREE.BoxGeometry(len - 0.4, 0.04, r * 1.1), { pos: v(p.x, y + ly - 0.15, p.z), rot: e(0, yaw, 0), color: N.FRAME });
    M.add('plant', new THREE.BoxGeometry(len - 0.5, 0.16, r * 1.0), { pos: v(p.x, y + ly - 0.05, p.z), rot: e(0, yaw, 0), color: 0x3f8a3a });
    M.add('emissive', new THREE.BoxGeometry(len - 0.6, 0.02, r * 0.7), { pos: v(p.x, y + ly + 0.22, p.z), rot: e(0, yaw, 0), color: 0xff5ad2 });
  }
  if (y - r > 0.05) for (const lx of [-len / 2 + 0.5, len / 2 - 0.5]) { const p = W(lx, 0, 0); M.box('metal', p.x, (y - r * 0.7) / 2, p.z, 0.2, y - r * 0.7, r * 1.4, N.STEEL, yaw); }
  const a = W(-len / 2, 0, -r), b = W(len / 2, 0, r);
  M.col(Math.min(a.x, b.x), 0, Math.min(a.z, b.z), Math.max(a.x, b.x), y + r, Math.max(a.z, b.z));
}

// roll-out solar array: a mast carrying two blanket wings on a boom
export function rosa(M, x, z, h = 6, yaw = 0, { span = 2.2, height = 2.4 } = {}) {
  const W = frame(x, z, yaw);
  M.cyl('metal', x, 0, z, 0.1, h, N.FRAME, 8);
  M.cyl('metal', x, 0, z, 0.4, 0.12, N.DARK, 12);
  for (const sx of [-1, 1]) {
    const c = W(sx * (span / 2 + 0.2), 0, 0);
    M.box('solar', c.x, h - height / 2, c.z, span, height, 0.04, undefined, yaw);
    const t = W(sx * (span + 0.2), 0, 0);
    M.cyl('metal', t.x, h - height - 0.05, t.z, 0.06, height + 0.1, N.FRAME, 8);
    const m = W(sx * (span / 2 + 0.2), 0, 0);
    M.box('metal', m.x, h + 0.04, m.z, span + 0.3, 0.08, 0.08, N.FRAME, yaw);
  }
  M.colCyl(x, z, 0.15, 0, h);
}

// weather / instrument mast: cross arms, cup anemometer, radiation shield
export function instrumentMast(M, x, z, h = 4.5) {
  M.cyl('metal', x, 0, z, 0.05, h, N.FRAME, 6);
  M.box('metal', x, h - 0.6, z, 1.2, 0.05, 0.05, N.FRAME);
  for (let i = 0; i < 6; i++) M.cyl('shell', x + 0.5, h - 0.55 + i * 0.07, z, 0.11, 0.03, 0xf2f2f2, 12);
  M.cyl('metal', x - 0.5, h - 0.6, z, 0.015, 0.35, N.DARK, 4);
  for (let k = 0; k < 3; k++) { const a = k / 3 * PI * 2; M.sphere('metal', x - 0.5 + Math.sin(a) * 0.14, h - 0.24, z + Math.cos(a) * 0.14, 0.045, N.DARK, 6); }
  M.box('metal', x, h * 0.45, z + 0.08, 0.3, 0.4, 0.14, 0xe2e2df);
  M.sphere('blink', x, h + 0.05, z, 0.05, L.red, 6);
}

// stack of cargo transfer bags (soft white bags with straps)
export function cargoBags(M, x, z, n = 4, yaw = 0) {
  const W = frame(x, z, yaw);
  for (let i = 0; i < n; i++) {
    const p = W((i % 2) * 0.62 - 0.31, 0, Math.floor(i / 4) * 0.5);
    const y = (Math.floor(i / 2) % 2) * 0.42;
    M.box('mli', p.x, y + 0.21, p.z, 0.58, 0.4, 0.45, 0xece8de, yaw);
    M.box('metal', p.x, y + 0.21, p.z, 0.6, 0.04, 0.47, 0x7f8a96, yaw);
  }
}

// geodesic greenhouse dome: faceted glazing on a strut frame (not a smooth
// bubble), on a low shell skirt with a ring beam
export function geodesicDome(M, x, z, r, { y0 = 0, detail = 2, skirt = 0.5 } = {}) {
  const g = new THREE.IcosahedronGeometry(r, detail);
  const P = g.attributes.position;
  const pos = [], edges = new Map();
  const key = (p, q) => { const a = p.map((k) => Math.round(k * 100)).join(','), b = q.map((k) => Math.round(k * 100)).join(','); return a < b ? a + '|' + b : b + '|' + a; };
  for (let i = 0; i < P.count; i += 3) {
    const t = [0, 1, 2].map((k) => [P.getX(i + k), P.getY(i + k), P.getZ(i + k)]);
    if ((t[0][1] + t[1][1] + t[2][1]) / 3 < 0.02 * r) continue;
    for (const p of t) pos.push(x + p[0], y0 + skirt + Math.max(0, p[1]), z + p[2]);
    for (const [p, q] of [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]]) edges.set(key(p, q), [p, q]);
  }
  const dg = new THREE.BufferGeometry();
  dg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  dg.computeVertexNormals();
  M.add('window', dg);
  for (const [p, q] of edges.values()) strut(M, [x + p[0], y0 + skirt + Math.max(0, p[1]), z + p[2]], [x + q[0], y0 + skirt + Math.max(0, q[1]), z + q[2]], 0.06 + r * 0.004, N.FRAME);
  M.add('shell', new THREE.CylinderGeometry(r * 1.01, r * 1.04, skirt, 40, 1, true), { pos: v(x, y0 + skirt / 2, z), color: N.SHELL2 });
  M.add('metal', new THREE.TorusGeometry(r * 1.01, 0.1, 6, 48), { pos: v(x, y0 + skirt, z), rot: e(PI / 2, 0, 0), color: N.STEEL });
  M.colCyl(x, z, r, 0, y0 + skirt + r);
}

// panoramic window band around a vessel (lounges, control rooms)
export function viewBand(M, x, z, r, y, h, { from = 0, to = PI * 2, n = 14 } = {}) {
  M.add('glass', new THREE.CylinderGeometry(r + 0.02, r + 0.02, h, 48, 1, true, from, to - from), { pos: v(x, y + h / 2, z) });
  for (let i = 0; i <= n; i++) {
    const a = from + (to - from) * i / n;
    M.box('metal', x + Math.sin(a) * (r + 0.05), y + h / 2, z + Math.cos(a) * (r + 0.05), 0.08, h + 0.1, 0.08, N.FRAME, a);
  }
  for (const yy of [y, y + h]) M.add('metal', new THREE.TorusGeometry(r + 0.05, 0.05, 6, 48, to - from), { pos: v(x, yy, z), rot: e(PI / 2, 0, -from + PI / 2), color: N.FRAME });
}

// landing pad: sintered disc, painted ring and cross, edge lights
export function landingPad(M, x, z, r) {
  M.cyl('concrete', x, -0.05, z, r, 0.2, 0x8f8a84, 40);
  M.add('concrete', new THREE.RingGeometry(r * 0.72, r * 0.78, 48), { pos: v(x, 0.16, z), rot: e(-PI / 2, 0, 0), color: 0xd9b23a });
  M.box('concrete', x, 0.155, z, r * 0.9, 0.01, 0.22, 0xe9e5dd);
  M.box('concrete', x, 0.155, z, 0.22, 0.01, r * 0.9, 0xe9e5dd);
  for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2; M.sphere('blink', x + Math.cos(a) * (r - 0.2), 0.2, z + Math.sin(a) * (r - 0.2), 0.07, N.ORANGE, 6); }
}

// small drilling derrick with a drill string and a top drive
export function derrick(M, x, z, h, w = 1.4) {
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) strut(M, [x + sx * w / 2, 0, z + sz * w / 2], [x + sx * w * 0.18, h, z + sz * w * 0.18], 0.1, N.ORANGE);
  for (let k = 1; k < 4; k++) {
    const t = k / 4, hw = w / 2 * (1 - t) + w * 0.18 * t, y = h * t;
    for (const [a, b] of [[[-1, -1], [1, -1]], [[1, -1], [1, 1]], [[1, 1], [-1, 1]], [[-1, 1], [-1, -1]]]) strut(M, [x + a[0] * hw, y, z + a[1] * hw], [x + b[0] * hw, y, z + b[1] * hw], 0.06, N.ORANGE);
  }
  M.box('metal', x, h + 0.2, z, w * 0.5, 0.4, w * 0.5, N.DARK);
  M.cyl('metal', x, 0, z, 0.07, h, 0x9aa0a6, 8);
  M.box('metal', x, h * 0.55, z, 0.4, 0.5, 0.4, N.YELLOW);
  M.sphere('blink', x, h + 0.5, z, 0.08, L.red, 6);
  M.colCyl(x, z, w * 0.45, 0, h);
}
