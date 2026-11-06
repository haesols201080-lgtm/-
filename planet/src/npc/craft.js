// Colony aircraft: the logistics quadcopter (frame + separately tinted cargo
// pod) and the colonist shuttle, a lifting-body VTOL spaceplane with heat
// shield belly, cockpit glazing, cabin windows, canted fins, lift-fan
// nacelles and landing legs.
import * as THREE from 'three';
import { GeoBuilder } from '../core/geobuilder.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const E = (x, y, z) => new THREE.Euler(x, y, z);
const WHITE = 0xe9e8e3, CARBON = 0x33363b, DARK = 0x222428, ORANGE = 0xf0761c, STEEL = 0x8d939a;

function lathe(profile, seg, phiStart = 0, phiLength = Math.PI * 2) {
  return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg, phiStart, phiLength);
}
function plate(points, depth, bevel = 0.02) {
  const sh = new THREE.Shape(points.map(([a, b]) => new THREE.Vector2(a, b)));
  return new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, steps: 1 });
}

// ------------------------------------------------------------------ drone (forward is +z)
export function droneGeometry() {
  const F = new GeoBuilder();
  // lens-shaped body shell with an orange light band and a sensor eye
  const shell = lathe([[0, -0.09], [0.2, -0.085], [0.3, -0.05], [0.33, 0.0], [0.3, 0.06], [0.2, 0.1], [0, 0.115]], 24);
  shell.scale(1, 1, 1.22);
  F.add(shell, { color: (x, y, z, nx, ny) => (ny < -0.55 ? [0.2, 0.21, 0.23] : [0.91, 0.9, 0.88]) });
  const bandG = lathe([[0.333, -0.012], [0.333, 0.012]], 24); bandG.scale(1, 1, 1.22);
  F.add(bandG, { color: ORANGE });
  F.add(new THREE.SphereGeometry(0.06, 12, 8), { pos: V(0, -0.02, 0.37), color: DARK });
  F.add(new THREE.TorusGeometry(0.06, 0.012, 6, 14), { pos: V(0, -0.02, 0.375), color: STEEL });
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const mx = sx * 0.52, mz = sz * 0.52;
    // carbon arm from the body to the motor
    const arm = new THREE.CylinderGeometry(0.028, 0.034, 0.62, 8); arm.rotateZ(Math.PI / 2); arm.rotateY(-Math.atan2(mz, mx));
    F.add(arm, { pos: V(mx * 0.55, 0.0, mz * 0.55), color: CARBON });
    // motor, rotor blur disc, prop guard ring and its struts
    F.add(new THREE.CylinderGeometry(0.055, 0.06, 0.09, 12), { pos: V(mx, 0.03, mz), color: DARK });
    F.add(new THREE.CylinderGeometry(0.235, 0.235, 0.006, 24), { pos: V(mx, 0.085, mz), color: (x, y, z) => { const r = Math.hypot(x, z); return r < 0.05 ? [0.15, 0.15, 0.16] : [0.3, 0.32, 0.35]; } });
    F.add(new THREE.TorusGeometry(0.26, 0.016, 6, 28), { pos: V(mx, 0.085, mz), rot: E(Math.PI / 2, 0, 0), color: WHITE });
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      F.add(new THREE.BoxGeometry(0.2, 0.012, 0.016), { pos: V(mx + Math.cos(a) * 0.15, 0.06, mz + Math.sin(a) * 0.15), rot: E(0, -a, 0), color: CARBON });
    }
    // navigation light under each motor
    F.add(new THREE.SphereGeometry(0.02, 6, 4), { pos: V(mx, -0.025, mz), color: sz > 0 ? [0.95, 0.95, 0.9] : [0.95, 0.25, 0.15] });
  }
  // skids and the cargo hoist
  for (const sx of [-1, 1]) {
    const sk = new THREE.CylinderGeometry(0.014, 0.014, 0.5, 6); sk.rotateX(Math.PI / 2);
    F.add(sk, { pos: V(sx * 0.17, -0.17, 0), color: CARBON });
    for (const sz of [-0.15, 0.15]) F.add(new THREE.CylinderGeometry(0.01, 0.01, 0.1, 5), { pos: V(sx * 0.15, -0.12, sz), rot: E(0, 0, sx * 0.3), color: CARBON });
  }
  F.add(new THREE.CylinderGeometry(0.035, 0.035, 0.08, 10), { pos: V(0, -0.11, 0), color: STEEL });
  for (const sx of [-1, 1]) F.add(new THREE.CylinderGeometry(0.006, 0.006, 0.16, 4), { pos: V(sx * 0.08, -0.2, 0), rot: E(0, 0, -sx * 0.35), color: STEEL });
  // cargo pod (tinted per load)
  const P = new GeoBuilder();
  const pod = new THREE.BoxGeometry(0.34, 0.22, 0.42, 1, 1, 1);
  P.add(pod, { pos: V(0, -0.38, 0), color: 0xffffff });
  P.add(new THREE.BoxGeometry(0.36, 0.03, 0.44), { pos: V(0, -0.27, 0), color: 0x9a9a9a });
  P.add(new THREE.BoxGeometry(0.36, 0.03, 0.44), { pos: V(0, -0.49, 0), color: 0x9a9a9a });
  for (const sx of [-1, 1]) P.add(new THREE.BoxGeometry(0.01, 0.12, 0.3), { pos: V(sx * 0.172, -0.38, 0), color: 0x6a6a6a });
  return { frame: mergeVertices(F.build(), 1e-5), pod: mergeVertices(P.build(), 1e-5) };
}

// ------------------------------------------------------------------ shuttle (nose is -z, origin 2 m above the pad)
export function shuttleGeometry() {
  const G = new GeoBuilder();
  const TILE = [0.17, 0.175, 0.185], HULL = [0.92, 0.915, 0.9];
  const tiled = (x, y, z, nx, ny) => (ny < -0.45 ? TILE : HULL);
  // lifting-body fuselage: a lathe along z (t = -z), flattened, black tile belly
  const prof = [[0, -4.35], [0.85, -4.3], [1.22, -3.7], [1.42, -2.2], [1.5, -0.4], [1.47, 1.2], [1.34, 2.4], [1.06, 3.35], [0.66, 4.05], [0.26, 4.5], [0, 4.6]];
  const rOf = (t) => { for (let i = 1; i < prof.length; i++) if (t <= prof[i][1]) { const [r0, t0] = prof[i - 1], [r1, t1] = prof[i]; return r0 + (r1 - r0) * (t - t0) / (t1 - t0); } return 0; };
  const toBody = (g) => { g.rotateX(-Math.PI / 2); g.scale(1, 0.8, 1); return g; };
  G.add(toBody(lathe(prof, 36)), { color: tiled });
  // a patch of the hull surface (z range, angle range around the axis: 0 top,
  // +pi/2 the right side) lifted a hair off the skin: glazing, door, windows
  const patch = (z0, z1, a0, a1, lift = 1.006, n = 4, seg = 6) => {
    if (a1 < a0) [a0, a1] = [a1, a0];
    const pts = [];
    for (let i = 0; i <= n; i++) { const t = -z1 + (z1 - z0) * i / n; pts.push([rOf(t) * lift, t]); }
    return toBody(lathe(pts, seg, a0, a1 - a0));
  };
  // cockpit glazing in two panes with a centre frame
  for (const sx of [-1, 1]) G.add(patch(-3.95, -2.45, sx > 0 ? 0.035 : -0.95, sx > 0 ? 0.95 : -0.035, 1.008, 6, 10), { color: 0x141c26 });
  // cabin windows, passenger door with an orange handle, cheat line
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      if (sx > 0 && (i === 2 || i === 3)) continue;
      const z = -1.6 + i * 0.55;
      G.add(patch(z - 0.14, z + 0.14, sx * 1.15, sx * 1.35, 1.006, 1, 3), { color: 0x18202a });
    }
    G.add(patch(-2.6, 3.2, sx * 1.545, sx * 1.6, 1.004, 10, 2), { color: ORANGE });
  }
  G.add(patch(-0.36, 0.62, 0.98, 1.98, 1.004, 3, 8), { color: [0.74, 0.74, 0.73] });
  G.add(patch(-0.32, 0.58, 1.02, 1.94, 1.007, 3, 8), { color: [0.86, 0.86, 0.85] });
  G.add(patch(0.36, 0.5, 1.4, 1.48, 1.012, 1, 1), { color: ORANGE });
  // delta strakes along the lower sides, white on top and tiled underneath
  const mirror = (pts, sx) => pts.map(([x, z]) => [x * sx, z]);
  for (const sx of [-1, 1]) {
    const wing = plate(mirror([[1.2, -0.6], [3.15, 3.0], [3.3, 3.6], [1.3, 3.75]], sx), 0.1, 0.03);
    G.add(wing.rotateX(Math.PI / 2), { pos: V(0, -0.36, 0), color: tiled });
    // wingtip lift-fan nacelle
    G.add(new THREE.CylinderGeometry(0.42, 0.42, 0.42, 24), { pos: V(sx * 2.85, -0.38, 2.75), color: HULL });
    G.add(new THREE.TorusGeometry(0.36, 0.05, 6, 22), { pos: V(sx * 2.85, -0.6, 2.75), rot: E(Math.PI / 2, 0, 0), color: DARK });
    G.add(new THREE.CylinderGeometry(0.33, 0.33, 0.05, 20), { pos: V(sx * 2.85, -0.58, 2.75), color: [0.3, 0.27, 0.24] });
    // forward canard with its own nacelle
    const can = plate(mirror([[1.25, -2.0], [2.05, -1.45], [2.05, -0.95], [1.3, -0.8]], sx), 0.08, 0.02);
    G.add(can.rotateX(Math.PI / 2), { pos: V(0, -0.3, 0), color: tiled });
    G.add(new THREE.CylinderGeometry(0.34, 0.34, 0.38, 22), { pos: V(sx * 2.1, -0.34, -1.25), color: HULL });
    G.add(new THREE.TorusGeometry(0.29, 0.045, 6, 20), { pos: V(sx * 2.1, -0.54, -1.25), rot: E(Math.PI / 2, 0, 0), color: DARK });
    G.add(new THREE.CylinderGeometry(0.27, 0.27, 0.05, 18), { pos: V(sx * 2.1, -0.52, -1.25), color: [0.3, 0.27, 0.24] });
    // canted twin fins
    const fin = plate([[2.6, 0], [3.9, 0], [4.25, 1.5], [3.65, 1.55]], 0.09, 0.025);
    fin.translate(0, 0, -0.045); fin.rotateY(-Math.PI / 2);
    G.add(fin, { pos: V(sx * 0.8, 0.5, 0), rot: E(0, 0, -sx * 0.38), color: HULL });
    G.add(new THREE.SphereGeometry(0.05, 8, 6), { pos: V(sx * 1.38, 1.9, 4.05), color: sx < 0 ? [0.95, 0.2, 0.15] : [0.2, 0.9, 0.35] });
    // landing legs: oleo strut, drag brace and footpad
    for (const lz of [-1.7, 2.3]) {
      const top = V(sx * 1.0, -0.75, lz), foot = V(sx * 1.45, -1.78, lz);
      const d = foot.clone().sub(top), len = d.length();
      const strut = new THREE.CylinderGeometry(0.07, 0.055, len, 10);
      strut.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize()));
      G.add(strut, { pos: top.clone().add(foot).multiplyScalar(0.5), color: STEEL });
      G.add(new THREE.CylinderGeometry(0.26, 0.3, 0.07, 16), { pos: V(foot.x, -1.82, lz), color: CARBON });
      const b0 = V(sx * 0.7, -0.7, lz + 0.55), b1 = V(sx * 1.3, -1.45, lz);
      const bd = b1.clone().sub(b0), brace = new THREE.CylinderGeometry(0.03, 0.03, bd.length(), 6);
      brace.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), bd.normalize()));
      G.add(brace, { pos: b0.clone().add(b1).multiplyScalar(0.5), color: CARBON });
    }
  }
  // main engines in the tail
  for (const [x, y] of [[0, 0.05], [-0.62, -0.18], [0.62, -0.18]]) {
    const bell = new THREE.CylinderGeometry(0.36, 0.2, 0.55, 20, 1, true); bell.rotateX(Math.PI / 2);
    G.add(bell, { pos: V(x, y, 4.45), color: [0.33, 0.33, 0.35] });
    G.add(new THREE.CircleGeometry(0.2, 16), { pos: V(x, y, 4.2), color: [0.12, 0.1, 0.09] });
  }
  // dorsal antenna and RCS blocks on the nose
  G.add(new THREE.BoxGeometry(0.04, 0.35, 0.5), { pos: V(0, 1.27, 0.6), rot: E(0.25, 0, 0), color: STEEL });
  for (const sx of [-1, 1]) G.add(new THREE.BoxGeometry(0.06, 0.12, 0.18), { pos: V(sx * 0.62, 0.42, -3.85), rot: E(0, 0, sx * 0.6), color: DARK });
  return mergeVertices(G.build(), 1e-5);
}

// downward lift-fan exhaust positions (shuttle local space)
export const SHUTTLE_FANS = [[-2.85, -0.62, 2.75], [2.85, -0.62, 2.75], [-2.1, -0.56, -1.25], [2.1, -0.56, -1.25]];

// ------------------------------------------------------------------ colony ship
// A 50 m stainless-steel lander: 9 m body, tangent-ogive nose, black hex
// heat-shield tiles on the windward (-z) side, forward and aft flaps, six
// engines (three gimballed sea-level bells inside three large vacuum bells),
// six landing legs, crew windows and a cargo elevator on the leeward (+z)
// side. Origin is the ground contact; the elevator platform is separate.
export const SHIP = { R: 4.5, H: 50, door: 28.2 };
export function shipGeometry() {
  const R = SHIP.R, L = 14, Y0 = 36, rho = (R * R + L * L) / (2 * R);
  const nose = (yy) => (yy <= 0 ? R : yy >= L ? 0 : Math.sqrt(rho * rho - yy * yy) + R - rho);
  const rAt = (y) => (y < Y0 ? R : nose(y - Y0));
  const prof = [[0, 2.15], [4.25, 2.15], [R, 2.6]];
  for (let y = 3; y < Y0; y += 3) prof.push([R, y]);
  for (let k = 0; k <= 14; k++) { const yy = L * (1 - Math.pow(1 - k / 14, 1.25)); prof.push([Math.max(0.35, nose(yy)), Y0 + yy]); }
  prof.push([0, Y0 + L + 0.05]);
  const S = new GeoBuilder(), T = new GeoBuilder(), D = new GeoBuilder();
  const STEEL = [0.86, 0.87, 0.89], WELD = [0.6, 0.62, 0.64];
  S.add(lathe(prof, 56), { color: STEEL });
  // weld lines between the steel rings
  for (let y = 4.0; y < Y0 + 8; y += 1.83) {
    const r0 = rAt(y - 0.025), r1 = rAt(y + 0.025);
    S.add(lathe([[r0 * 1.0025, y - 0.025], [r1 * 1.0025, y + 0.025]], 56), { color: WELD });
  }
  // heat-shield tiles over the windward ~200 degrees, from the skirt over the nose
  const tp = [];
  for (let y = 2.7; y < Y0; y += 3) tp.push([R * 1.007, y]);
  for (let k = 0; k <= 12; k++) { const yy = (L - 0.6) * k / 12; tp.push([nose(yy) * 1.007 + 0.02, Y0 + yy]); }
  T.add(lathe(tp, 48, Math.PI - 1.72, 3.44), { color: 0xffffff });
  // chines along the tile edge
  for (const sx of [-1, 1]) {
    const a = Math.PI - sx * 1.62, ch = new THREE.BoxGeometry(0.5, Y0 - 3, 0.14);
    S.add(ch, { pos: V(Math.sin(a) * (R + 0.2), Y0 / 2 + 1.5, Math.cos(a) * (R + 0.2)), rot: E(0, a + Math.PI / 2, 0), color: STEEL });
  }
  // flaps: steel plates with a tiled windward face
  const flap = (pts, th) => {
    for (const sx of [-1, 1]) {
      const m = pts.map(([x, y]) => [x * sx, y]);
      const g = plate(m, th, 0.06); g.translate(0, 0, -th / 2 - 0.3);
      S.add(g, { color: STEEL });
      const t = plate(m, 0.04, 0); t.translate(0, 0, -th / 2 - 0.36);
      D.add(t, { color: [0.07, 0.07, 0.08] });
      // hinge fairing along the root
      const [p0, p1] = [m[0], m[1]], len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
      const hg = new THREE.CylinderGeometry(0.32, 0.32, len, 12);
      hg.rotateZ(-Math.atan2(p1[0] - p0[0], p1[1] - p0[1]));
      S.add(hg, { pos: V((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, -0.3), color: STEEL });
    }
  };
  flap([[R - 0.25, 3.2], [R - 0.25, 13.6], [R + 2.4, 12.4], [R + 3.7, 4.4]], 0.32);
  flap([[rAt(Y0 + 1.2) - 0.25, Y0 + 1.2], [rAt(Y0 + 9.2) - 0.25, Y0 + 9.2], [rAt(Y0 + 9.2) + 1.9, Y0 + 8.2], [rAt(Y0 + 1.2) + 2.7, Y0 + 2.4]], 0.26);
  // raceway on the leeward quarter
  const ra = 0.9;
  S.add(new THREE.BoxGeometry(0.55, Y0 - 4, 0.32), { pos: V(Math.sin(ra) * (R + 0.14), Y0 / 2 + 1, Math.cos(ra) * (R + 0.14)), rot: E(0, ra, 0), color: [0.78, 0.79, 0.81] });
  // crew windows: two decks of small dark panes on the leeward side
  const pane = (y, a, w, h) => D.add(lathe([[rAt(y - h / 2) * 1.006, y - h / 2], [rAt(y + h / 2) * 1.006, y + h / 2]], 2, a - w / 2, w), { color: [0.05, 0.07, 0.09] });
  for (const y of [32.6, 34.9]) for (let i = -6; i <= 6; i++) if (Math.abs(i) > 0) pane(y, i * 0.13, 0.075, 0.55);
  // cargo door outline, elevator boom and its winch
  const dy = SHIP.door, half = 0.36;
  for (const [y0, y1, a0, a1] of [[dy, dy + 3.4, -half - 0.02, -half + 0.02], [dy, dy + 3.4, half - 0.02, half + 0.02], [dy - 0.03, dy + 0.03, -half, half], [dy + 3.37, dy + 3.43, -half, half]]) {
    D.add(lathe([[R * 1.005, y0], [R * 1.005, y1]], 4, a0, a1 - a0), { color: [0.2, 0.21, 0.23] });
  }
  S.add(new THREE.BoxGeometry(0.5, 0.45, 3.2), { pos: V(0, dy + 3.75, R + 1.45), color: STEEL });
  for (const sx of [-1, 1]) S.add(new THREE.BoxGeometry(0.12, 0.12, 3.0), { pos: V(sx * 1.1, dy + 3.6, R + 1.4), color: STEEL });
  D.add(new THREE.BoxGeometry(2.6, 0.3, 0.4), { pos: V(0, dy + 3.55, R + 2.85), color: [0.25, 0.26, 0.28] });
  // RCS thruster blocks near the top and bottom
  for (const y of [Y0 - 1.5, 5.5]) for (const a of [0.55, -0.55]) D.add(new THREE.BoxGeometry(0.5, 0.7, 0.2), { pos: V(Math.sin(a) * (R + 0.08), y, Math.cos(a) * (R + 0.08)), rot: E(0, a, 0), color: [0.18, 0.19, 0.2] });
  // aft skirt, thrust plate and engines
  S.add(lathe([[R * 1.012, 1.9], [R * 1.012, 2.75]], 56), { color: [0.55, 0.57, 0.6] });
  D.add(new THREE.CircleGeometry(4.25, 40).rotateX(Math.PI / 2), { pos: V(0, 2.15, 0), color: [0.1, 0.1, 0.11] });
  const bell = (x, z, rt, re, y0, y1) => {
    D.add(new THREE.CylinderGeometry(rt, re, y0 - y1, 28, 1, true), { pos: V(x, (y0 + y1) / 2, z), color: (px, py) => (py < -(y0 - y1) * 0.3 ? [0.5, 0.36, 0.26] : [0.22, 0.22, 0.24]) });
    D.add(new THREE.CylinderGeometry(rt * 0.8, rt * 1.05, 0.5, 16), { pos: V(x, y0 + 0.2, z), color: [0.3, 0.31, 0.33] });
  };
  for (let k = 0; k < 3; k++) { const a = k * Math.PI * 2 / 3 + Math.PI / 2; bell(Math.cos(a) * 1.25, Math.sin(a) * 1.25, 0.32, 0.66, 2.15, 0.85); }
  for (let k = 0; k < 3; k++) { const a = k * Math.PI * 2 / 3 + Math.PI / 6; bell(Math.cos(a) * 2.85, Math.sin(a) * 2.85, 0.42, 1.18, 2.15, 0.25); }
  // six landing legs: hinged at the skirt, splayed out to round footpads
  for (let k = 0; k < 6; k++) {
    const a = k * Math.PI / 3 + Math.PI / 6, c = Math.cos(a), s = Math.sin(a);
    const top = V(c * 4.15, 5.2, s * 4.15), foot = V(c * 5.6, 0.35, s * 5.6);
    const d = foot.clone().sub(top), st = new THREE.CylinderGeometry(0.2, 0.16, d.length(), 10);
    st.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize()));
    S.add(st, { pos: top.clone().add(foot).multiplyScalar(0.5), color: [0.7, 0.72, 0.74] });
    const b0 = V(c * 3.9, 2.0, s * 3.9), bd = foot.clone().sub(b0), br = new THREE.CylinderGeometry(0.11, 0.11, bd.length(), 8);
    br.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), bd.normalize()));
    D.add(br, { pos: b0.clone().add(foot).multiplyScalar(0.5), color: [0.28, 0.29, 0.31] });
    D.add(new THREE.CylinderGeometry(0.55, 0.65, 0.3, 18), { pos: V(foot.x, 0.15, foot.z), color: [0.22, 0.23, 0.25] });
  }
  // elevator platform (animated separately): grating deck, rails, cable sheaves
  const P = new GeoBuilder();
  P.add(new THREE.BoxGeometry(2.5, 0.18, 2.1), { pos: V(0, 0.09, 0), color: [0.42, 0.44, 0.47] });
  for (const sx of [-1, 1]) {
    P.add(new THREE.BoxGeometry(0.05, 0.05, 2.1), { pos: V(sx * 1.22, 1.05, 0), color: [0.85, 0.65, 0.2] });
    for (const z of [-1.0, 0, 1.0]) P.add(new THREE.CylinderGeometry(0.025, 0.025, 1.0, 6), { pos: V(sx * 1.22, 0.6, z), color: [0.7, 0.72, 0.74] });
  }
  P.add(new THREE.BoxGeometry(2.5, 0.05, 0.05), { pos: V(0, 1.05, 1.03), color: [0.85, 0.65, 0.2] });
  return {
    steel: mergeVertices(S.build(), 1e-5), tiles: mergeVertices(T.build(), 1e-5), dark: mergeVertices(D.build(), 1e-5), platform: P.build(),
  };
}

// black hex tiles with thin grey gaps, each tile a touch different, a few
// lighter replacement tiles
export function tileMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.78, metalness: 0.05 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLP = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vLP;
      float tHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 tp = vec2(atan(vLP.x, vLP.z) * 4.5, vLP.y) / 0.62;
        vec2 hr = vec2(1.0, 1.7320508), hh = hr * 0.5;
        vec2 ha = mod(tp, hr) - hh, hb = mod(tp - hh, hr) - hh;
        vec2 gv = dot(ha, ha) < dot(hb, hb) ? ha : hb;
        vec2 id = tp - gv;
        vec2 ag = abs(gv);
        float hd = max(dot(ag, vec2(0.5, 0.8660254)), ag.x);
        float gap = smoothstep(0.455, 0.49, hd) * (1.0 - smoothstep(0.3, 1.0, fwidth(tp.x) * 2.0));
        float rnd = tHash(id);
        vec3 tc = vec3(0.055, 0.056, 0.06) * (0.85 + 0.3 * rnd);
        tc = mix(tc, vec3(0.62, 0.6, 0.57), step(0.996, rnd));
        diffuseColor.rgb = mix(tc, vec3(0.32, 0.32, 0.33), gap);`);
  };
  m.customProgramCacheKey = () => 'ship-tiles-v1';
  return m;
}

// ------------------------------------------------------------------ flight profiles
const ease = (k) => k * k * (3 - 2 * k);
// entry, flip and landing burn; t in seconds from 2 km altitude
export function shipDescent(t) {
  if (t < 16) { const k = t / 16; return { alt: 2000 - 1450 * k, off: 600 * (1 - k) + 60, pitch: -1.42 + 0.03 * Math.sin(t * 0.9), thr: 0, engines: 0 }; }
  if (t < 19.5) { const k = (t - 16) / 3.5; return { alt: 550 - 70 * k, off: 60 - 15 * k, pitch: -1.42 * (1 - ease(k)) + 0.16 * Math.sin(k * Math.PI), thr: 1, engines: 3 }; }
  const k = Math.min(1, (t - 19.5) / 14);
  return { alt: 480 * Math.pow(1 - k, 2.2), off: 45 * Math.pow(1 - k, 2), pitch: 0.04 * (1 - k) * Math.sin(t * 2), thr: 0.75 + 0.25 * (1 - k), engines: k < 0.55 ? 3 : 1, done: k >= 1 };
}
export const DESCENT_TIME = 33.5;
export function shipAscent(t) {
  return { alt: 0.5 * 11 * t * t, off: 0, pitch: -Math.max(0, t - 7) * 0.045, thr: 1, engines: 3, vac: t > 1.5, done: t > 18 };
}
export const elevatorAt = (t, down = 4, up = 20) => (t < down ? 0 : t < down + 9 ? ease((t - down) / 9) : t < up ? 1 : t < up + 9 ? 1 - ease((t - up) / 9) : 0);

// ------------------------------------------------------------------ ship rig
// Meshes, engine plumes, dust and the cargo elevator of one ship; pose()
// places it for any phase of flight. The ship pivots about its centre of
// mass, 20 m above the feet.
let shipGeo = null, shipMats = null;
export class ShipRig {
  constructor(scene) {
    const g = shipGeo || (shipGeo = shipGeometry());
    const M = shipMats || (shipMats = {
      steel: new THREE.MeshPhysicalMaterial({ vertexColors: true, color: 0xd6d9de, metalness: 0.95, roughness: 0.3, envMapIntensity: 1.25 }),
      dark: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.45, side: THREE.DoubleSide }),
      tiles: tileMaterial(),
    });
    const body = this.body = new THREE.Group();
    for (const [geo, mat] of [[g.steel, M.steel], [g.tiles, M.tiles], [g.dark, M.dark]]) {
      const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; body.add(m);
    }
    this.plat = new THREE.Mesh(g.platform, M.steel); this.plat.castShadow = true; this.plat.receiveShadow = true;
    this.cables = [-1, 1].map((sx) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 5).translate(0, -0.5, 0), M.dark); c.position.set(sx * 1.1, SHIP.door + 3.45, SHIP.R + 2.85); body.add(c); return c; });
    body.add(this.plat);
    // methalox exhaust: nearly transparent blue-violet plume with a bright
    // core at the nozzle and shock diamonds down the axis
    const flames = this.flames = new THREE.Group();
    const add = (c, o) => new THREE.MeshBasicMaterial({ color: new THREE.Color(...c), transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false });
    const core = add([3.2, 3.6, 5.5], 0.75), plume = add([0.45, 0.42, 1.25], 0.22), diamond = add([2.6, 2.4, 4.2], 0.6);
    for (let k = 0; k < 6; k++) {
      const inner = k < 3, a = inner ? k * Math.PI * 2 / 3 + Math.PI / 2 : (k - 3) * Math.PI * 2 / 3 + Math.PI / 6, r = inner ? 1.25 : 2.85;
      const e = new THREE.Group(), w = inner ? 1 : 1.75;
      e.add(new THREE.Mesh(new THREE.ConeGeometry(0.5 * w, 3.2, 14, 1, true).translate(0, 1.6, 0), core));
      e.add(new THREE.Mesh(new THREE.CylinderGeometry(1.1 * w, 0.62 * w, 16, 16, 1, true).translate(0, 8, 0), plume));
      for (let d = 0; d < 5; d++) e.add(new THREE.Mesh(new THREE.SphereGeometry(0.42 * w * (1 - d * 0.12), 10, 8).scale(1, 1.6, 1).translate(0, 1.6 + d * 2.3 * w, 0), diamond));
      e.rotation.x = Math.PI; e.position.set(Math.cos(a) * r, inner ? 0.85 : 0.25, Math.sin(a) * r);
      e.userData = { inner, k };
      flames.add(e);
    }
    body.add(flames);
    // dust kicked up by the engines near the ground
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const cx = cv.getContext('2d'), gr = cx.createRadialGradient(32, 32, 4, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,0.0)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    cx.fillStyle = gr; cx.fillRect(0, 0, 64, 64);
    this.dust = new THREE.Mesh(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), color: 0xb08a6a, transparent: true, opacity: 0, depthWrite: false }));
    this.group = new THREE.Group();
    body.position.y = -20;
    this.group.add(body);
    this.group.visible = false;
    scene.add(this.group, this.dust);
  }

  // site: ground point {x, y, z}; p: {alt, off, pitch, thr, engines, vac, elev}
  pose(site, rot, from, p, t = 0, dustGrow = 0) {
    const ax = Math.sin(from) * (p.off || 0), az = Math.cos(from) * (p.off || 0), alt = p.alt || 0;
    this.group.position.set(site.x + ax, site.y + 20 + alt, site.z + az);
    this.group.rotation.set(p.pitch || 0, rot, 0, 'YXZ');
    const top = SHIP.door + 3.45, py = top - 0.6 - (top - 0.6) * (p.elev || 0);
    this.plat.position.set(0, py, SHIP.R + 2.85);
    for (const c of this.cables) c.scale.y = Math.max(0.01, top - py - 0.1);
    const thr = p.thr || 0;
    this.flames.visible = thr > 0;
    const fl = 1 + 0.06 * Math.sin(t * 41) + 0.04 * Math.sin(t * 67);
    for (const f of this.flames.children) {
      const { inner, k } = f.userData;
      const on = inner ? (k < (p.engines || 0) ? thr : 0) : (p.vac ? thr : 0);
      f.visible = on > 0.02;
      f.scale.set(1, on * fl, 1);
    }
    const near = thr > 0 ? Math.max(0, 1 - alt / 90) : 0;
    this.dust.visible = near > 0;
    this.dust.position.set(site.x + ax, site.y + 0.4, site.z + az);
    this.dust.scale.setScalar(12 + 30 * (1 - near) + dustGrow);
    this.dust.material.opacity = near * 0.55;
  }

  // world position of a point in the landed ship's frame
  static toWorld(site, rot, lx, lz) { const c = Math.cos(rot), s = Math.sin(rot); return [site.x + lx * c + lz * s, site.z - lx * s + lz * c]; }
  // the elevator platform's world position at the ground
  static elevatorFoot(site, rot) { return ShipRig.toWorld(site, rot, 0, SHIP.R + 2.85); }
}
