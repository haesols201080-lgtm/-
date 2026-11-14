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
  M.add('hull', new THREE.CylinderGeometry(r, r, h, 56, 1), { pos: v(x, y0 + h / 2, z), color: N.SHELL });
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
      M.box('hull', x + Math.sin(b) * (r + 0.008), y0 + h * 0.62, z + Math.cos(b) * (r + 0.008), 0.05, 0.62, 0.012, N.STENCIL, b);
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
    M.add('hull', new THREE.CylinderGeometry(r * 0.98, r, 0.25, 56), { pos: v(x, top + 0.12, z), color: N.SHELL2 });
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
  M.add('hull', new THREE.CylinderGeometry(r, r, len, 40), { pos: v(x, y, z), rot: eo(0, yaw, PI / 2, 'YXZ'), color });
  for (const sx of [-1, 1]) {
    M.add('hull', new THREE.SphereGeometry(r, 32, 10, 0, PI * 2, 0, PI / 2), { pos: W(sx * len / 2, y, 0), rot: eo(0, yaw, -sx * PI / 2, 'YXZ'), scale: v(1, 0.28, 1), color: N.SHELL2 });
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
    M.cyl('hull', p.x, 0.1, p.z, 0.25, 1.55, 0xe8e8e4, 18);
    M.add('hull', new THREE.SphereGeometry(0.25, 16, 8, 0, PI * 2, 0, PI / 2), { pos: v(p.x, 1.65, p.z), color: 0xe8e8e4 });
    M.cyl('hull', p.x, 1.25, p.z, 0.255, 0.16, band, 18);
    M.cyl('metal', p.x, 1.85, p.z, 0.05, 0.16, 0x8a9096, 8);
  }
  const a = W(-(n - 1) * 0.31 - 0.35, 0, -0.3), b = W((n - 1) * 0.31 + 0.35, 0, 0.3);
  M.box('metal', (a.x + b.x) / 2, 1.0, (a.z + b.z) / 2, Math.abs(Math.cos(yaw)) * (n * 0.62 + 0.1) + 0.06, 0.06, Math.abs(Math.sin(yaw)) * (n * 0.62 + 0.1) + 0.06, N.STEEL);
  M.box('metal', (a.x + b.x) / 2, 0.05, (a.z + b.z) / 2, Math.abs(Math.cos(yaw)) * (n * 0.62 + 0.2) + 0.5, 0.1, Math.abs(Math.sin(yaw)) * (n * 0.62 + 0.2) + 0.5, N.DARK);
  M.col(Math.min(a.x, b.x), 0, Math.min(a.z, b.z), Math.max(a.x, b.x), 1.9, Math.max(a.z, b.z));
}
