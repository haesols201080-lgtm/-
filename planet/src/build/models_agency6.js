// Third wave of the colony's hardware in the agency kit: regional
// harvesters that only pay off in their own country, automation (robots,
// printing yards, maintenance drones), heavy power (fusion, orbital
// rectenna, hydro), weather work and the town's evening places.
import * as THREE from 'three';
import { L, v, e, plinth, railing, hazard } from './modelkit.js';
import { strut } from './starkit.js';
import {
  N, hatch, vessel, tubeModule, radiatorWing, deployFrame, grating, avionics, cupola,
  tankV, sphereTank, hangar, cargoBags, geodesicDome, viewBand, platformRails, dishAntenna, heap,
} from './nasakit.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../core/noise.js';
import { porch, band, beacon } from './models_agency.js';

const PI = Math.PI;
const GREEN = 0x2f8f4a, BLUE = 0x2a5db0, CH4 = 0x3f8fd8, MAGENTA = 0xff5ad2;

function gStrut(g, a, b, t, color) {
  const A = v(...a), B = v(...b), d = B.clone().sub(A), len = d.length();
  const q = new THREE.Quaternion().setFromUnitVectors(v(0, 1, 0), d.normalize());
  g.add(new THREE.BoxGeometry(t, len, t), { pos: A.clone().add(B).multiplyScalar(0.5), rot: new THREE.Euler().setFromQuaternion(q), color });
}
// slim braced mast tapering from w0 to w1
function mast(M, x, z, h, w0 = 0.5, w1 = 0.22, color = N.FRAME) {
  const at = (sx, sz, y) => { const w = w0 + (w1 - w0) * y / h; return [x + sx * w, y, z + sz * w]; };
  const C4 = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (const [sx, sz] of C4) strut(M, at(sx, sz, 0), at(sx, sz, h), 0.08, color);
  for (let y = 0; y < h - 0.4; y += 1.2) for (let k = 0; k < 4; k++) {
    const [ax, az] = C4[k], [bx, bz] = C4[(k + 1) % 4];
    strut(M, at(ax, az, y), at(bx, bz, Math.min(h, y + 1.2)), 0.035, color);
    strut(M, at(ax, az, Math.min(h, y + 1.2)), at(bx, bz, Math.min(h, y + 1.2)), 0.045, color);
  }
  M.colCyl(x, z, w0, 0, h);
}
// a work robot standing at (x, z) facing -z
function robot(M, x, z, color = 0xffb347) {
  for (const s of [-1, 1]) M.box('metal', x + s * 0.12, 0.35, z, 0.12, 0.7, 0.14, N.DARK);
  M.box('shell', x, 0.95, z, 0.46, 0.55, 0.3, color);
  M.box('metal', x, 0.95, z - 0.16, 0.24, 0.16, 0.02, N.DARK);
  for (const s of [-1, 1]) M.box('shell', x + s * 0.3, 0.9, z, 0.1, 0.5, 0.12, 0xd9d6ce);
  M.box('shell', x, 1.38, z, 0.3, 0.24, 0.26, 0xeeece6);
  M.box('emissive', x, 1.39, z - 0.135, 0.2, 0.05, 0.01, L.cyan);
}

// ---------------------------------------------------------------- shared detail
const C4 = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
const NAVY = 0x22345a, COBALT = 0x3a6dff;
const HIVE = [0xe9dfc4, 0xd8c592, 0xcfd8c4, 0xe4d2b0];
const FLOWER = [0x9a6ad0, 0xe8c23a, 0xf1ece0, 0xc8579a, 0x7a8ad8];
const LEAF = [0x4f7d39, 0x5c8a3e, 0x46703a];
const eo = (x, y, z, o) => new THREE.Euler(x, y, z, o);

// a straight round member from a to b (into a builder or an animated group)
function seg(M, a, b, r, color, key = 'metal', n = 10) {
  const A = v(...a), B = v(...b), d = B.clone().sub(A), len = d.length();
  if (len < 1e-3) return;
  const q = new THREE.Quaternion().setFromUnitVectors(v(0, 1, 0), d.normalize());
  const geo = new THREE.CylinderGeometry(r, r, len, n), opt = { pos: A.clone().add(B).multiplyScalar(0.5), rot: new THREE.Euler().setFromQuaternion(q), color };
  if (M.gb) M.add(key, geo, opt); else M.add(geo, opt);
}
// industrial pipe run through pts: straight lengths, elbows, a flange on each
// long length
function piping(M, pts, r = 0.07, color = 0xb8bec4) {
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    seg(M, a, b, r, color);
    const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    if (len > 0.9) {
      const k = 0.035 / len, m = [0, 1, 2].map((j) => (a[j] + b[j]) / 2);
      seg(M, m.map((q, j) => q - (b[j] - a[j]) * k), m.map((q, j) => q + (b[j] - a[j]) * k), r * 1.6, N.FRAME);
    }
  }
  for (let i = 1; i < pts.length - 1; i++) M.sphere('metal', pts[i][0], pts[i][1], pts[i][2], r * 1.1, color, 10);
}
// area light on a tapered pole, its head reaching out along yaw
function lightPole(M, x, z, h = 3.4, yaw = 0, color = L.white) {
  M.cyl('metal', x, 0, z, 0.17, 0.08, N.DARK, 10);
  M.cyl('metal', x, 0.08, z, 0.07, h - 0.08, N.FRAME, 8, 0.045);
  const s = Math.sin(yaw), c = Math.cos(yaw);
  M.box('metal', x + s * 0.3, h - 0.02, z + c * 0.3, 0.05, 0.05, 0.62, N.FRAME, yaw);
  M.box('metal', x + s * 0.6, h - 0.06, z + c * 0.6, 0.24, 0.08, 0.36, N.DARK, yaw);
  M.box('emissive', x + s * 0.6, h - 0.105, z + c * 0.6, 0.2, 0.012, 0.3, color, yaw);
  M.colCyl(x, z, 0.12, 0, h);
}
// fixed ladder, rungs across local x of yaw
function ladder(M, x, z, y0, y1, yaw = 0, color = N.YELLOW) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  for (const k of [-1, 1]) M.cyl('metal', x + c * k * 0.2, y0, z - s * k * 0.2, 0.022, y1 - y0, color, 6);
  for (let y = y0 + 0.28; y < y1 - 0.05; y += 0.3) M.box('metal', x, y, z, 0.4, 0.025, 0.025, color, yaw);
}
// square bin over a funnel on four legs; the bin's base at y0
function hopper(M, x, z, w, y0, h, color = 0x9aa0a6) {
  M.box('metal', x, y0 + h * 0.55, z, w, h * 0.9, w, color);
  M.box('metal', x, y0 + h + 0.03, z, w + 0.08, 0.06, w + 0.08, N.FRAME);
  M.add('metal', new THREE.CylinderGeometry(w * 0.68, w * 0.1, y0 * 0.55, 4, 1), { pos: v(x, y0 * 0.725, z), rot: e(0, PI / 4, 0), color });
  for (const [sx, sz] of C4) M.cyl('metal', x + sx * w * 0.44, 0, z + sz * w * 0.44, 0.045, y0 + 0.1, N.STEEL, 6);
}
// belt conveyor between the belt-top points a and b: belt, side frames and
// legs down to the ground
function conveyor(M, a, b, w = 0.5, color = N.STEEL) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
  const hl = Math.hypot(dx, dz), len = Math.hypot(hl, dy), yaw = Math.atan2(dx, dz);
  const rot = eo(-Math.atan2(dy, hl), yaw, 0, 'YXZ');
  const mid = v((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  M.add('metal', new THREE.BoxGeometry(w, 0.05, len), { pos: mid.clone().add(v(0, -0.03, 0)), rot, color: 0x2a2c2f });
  const px = Math.cos(yaw), pz = -Math.sin(yaw);
  for (const s of [-1, 1]) M.add('metal', new THREE.BoxGeometry(0.06, 0.16, len), { pos: mid.clone().add(v(px * s * (w / 2 + 0.04), -0.07, pz * s * (w / 2 + 0.04))), rot, color });
  const n = Math.max(1, Math.round(hl / 1.5));
  for (let i = 0; i <= n; i++) {
    const t = 0.08 + 0.84 * i / n, p = [a[0] + dx * t, a[1] + dy * t, a[2] + dz * t];
    if (p[1] > 0.3) for (const s of [-1, 1]) M.cyl('metal', p[0] + px * s * (w / 2 + 0.04), 0, p[2] + pz * s * (w / 2 + 0.04), 0.035, p[1] - 0.14, color, 6);
  }
}
// a cluster of hexagonal crystal prisms with pointed ends growing from
// (x, y, z); the first `cut` of them are sawn-off stumps
function crystals(M, x, y, z, n, size, seed = 1, color = COBALT, cut = 0) {
  const rnd = mulberry32(seed);
  for (let i = 0; i < n; i++) {
    const big = i === 0 ? 1.25 : 0.5 + rnd() * 0.7;
    const r = (0.09 + rnd() * 0.07) * big * size, h = (0.6 + rnd() * 0.9) * big * size;
    const a = rnd() * PI * 2, off = (i ? 0.15 + rnd() * 0.5 : 0) * size;
    const tilt = i ? 0.22 + rnd() * 0.5 : rnd() * 0.12;
    const stump = i >= n - cut, hh = stump ? h * 0.3 : h;
    const parts = [new THREE.CylinderGeometry(r, r * 1.08, hh, 6).translate(0, hh / 2, 0)];
    if (!stump) parts.push(new THREE.ConeGeometry(r, r * 1.9, 6).translate(0, hh + r * 0.95, 0));
    const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(Math.cos(a) * tilt, rnd() * PI, -Math.sin(a) * tilt));
    m.setPosition(x + Math.sin(a) * off, y - 0.05, z + Math.cos(a) * off);
    for (const p of parts) M.add('crystal', p.applyMatrix4(m), { color: stump ? 0x9cc0ff : color });
  }
}
// barrel-vault glasshouse along x on a low curb: the glazing, arched ribs,
// purlins, glazed end walls with mullions and a transom
function vault(M, x, z, len, r, { y0 = 0.4, ribs = 5, curb = 0x9a948c } = {}) {
  M.box('concrete', x, y0 / 2, z, len + 0.16, y0, r * 2 + 0.16, curb);
  M.add('window', new THREE.CylinderGeometry(r, r, len, 32, 1, true, 0, PI).rotateZ(PI / 2), { pos: v(x, y0, z) });
  for (let i = 0; i <= ribs; i++) {
    const end = i === 0 || i === ribs;
    M.add('metal', new THREE.TorusGeometry(r + 0.02, end ? 0.07 : 0.045, 6, 32, PI).rotateY(PI / 2), { pos: v(x - len / 2 + i * len / ribs, y0, z), color: N.FRAME });
  }
  for (const a of [0.45, 0.95, PI / 2, PI - 0.95, PI - 0.45]) M.box('metal', x, y0 + Math.sin(a) * (r + 0.01), z + Math.cos(a) * (r + 0.01), len, 0.035, 0.035, N.FRAME);
  for (const sx of [-1, 1]) {
    M.add('window', new THREE.CircleGeometry(r, 28, 0, PI).rotateY(PI / 2), { pos: v(x + sx * len / 2, y0, z) });
    for (const lz of [-r * 0.5, 0, r * 0.5]) { const hh = Math.sqrt(r * r - lz * lz); M.box('metal', x + sx * len / 2, y0 + hh / 2, z + lz, 0.05, hh, 0.05, N.FRAME); }
    M.box('metal', x + sx * len / 2, y0 + r * 0.55, z, 0.05, 0.05, 2 * Math.sqrt(r * r - (r * 0.55) ** 2), N.FRAME);
  }
  M.col(x - len / 2, 0, z - r, x + len / 2, y0 + r, z + r);
}
// oil-filled transformer standing on y0: the tank, radiator fins both sides,
// conservator, three porcelain bushings
function transformer(M, x, z, s = 1, yaw = 0, y0 = 0) {
  const c = Math.cos(yaw), sn = Math.sin(yaw);
  const P = (lx, lz) => [x + lx * c + lz * sn, z - lx * sn + lz * c];
  M.box('metal', x, y0 + 0.06, z, 1.5 * s, 0.12, 1.1 * s, N.DARK, yaw);
  M.box('shell', x, y0 + 0.12 + 0.62 * s, z, 1.1 * s, 1.24 * s, 0.8 * s, 0x8f969c, yaw);
  for (const k of [-1, 1]) for (let i = 0; i < 6; i++) { const [px, pz] = P(k * 0.68 * s, -0.33 * s + i * 0.132 * s); M.box('metal', px, y0 + 0.12 + 0.6 * s, pz, 0.24 * s, 0.98 * s, 0.035, 0x737a80, yaw); }
  const [cx, cz] = P(0, 0.26 * s);
  M.add('shell', new THREE.CylinderGeometry(0.17 * s, 0.17 * s, 0.85 * s, 14), { pos: v(cx, y0 + 0.12 + 1.5 * s, cz), rot: eo(0, yaw, PI / 2, 'YXZ'), color: 0x8f969c });
  for (let i = -1; i <= 1; i++) {
    const [bx, bz] = P(i * 0.32 * s, -0.12 * s);
    M.cyl('shell', bx, y0 + 0.12 + 1.24 * s, bz, 0.05 * s, 0.55 * s, 0x9a6e44, 10);
    for (let k = 0; k < 4; k++) M.cyl('shell', bx, y0 + 0.12 + 1.3 * s + k * 0.12 * s, bz, 0.1 * s, 0.035 * s, 0x7a4e2c, 12);
    M.cyl('metal', bx, y0 + 0.12 + 1.79 * s, bz, 0.03, 0.12, N.FRAME, 6);
  }
  M.colCyl(x, z, 0.7 * s, y0, y0 + 1.4 * s);
}
// small radiator panel lying tilted on a roof at y, on two stub rails
function roofRad(M, x, y, z, w, d, yaw = 0) {
  const rot = eo(0.24, yaw, 0, 'YXZ');
  M.add('metal', new THREE.BoxGeometry(w, 0.04, d), { pos: v(x, y + 0.16, z), rot, color: N.RAD });
  for (let i = 1; i < 6; i++) { const o = new THREE.Vector3(-w / 2 + i * w / 6, 0.03, 0).applyEuler(rot); M.add('metal', new THREE.BoxGeometry(0.02, 0.025, d - 0.06), { pos: v(x + o.x, y + 0.16 + o.y, z + o.z), rot, color: 0x3a3f45 }); }
  const fr = new THREE.Vector3(0, 0, d / 2).applyEuler(rot);
  M.add('metal', new THREE.BoxGeometry(w + 0.04, 0.05, 0.05), { pos: v(x + fr.x, y + 0.16 + fr.y, z + fr.z), rot, color: N.FRAME });
  for (const k of [-1, 1]) { const o = new THREE.Vector3(k * w * 0.4, 0, 0).applyEuler(rot); M.box('metal', x + o.x, y + 0.08, z + o.z, 0.05, 0.16, d * 0.8, N.STEEL, yaw); }
}
// patrol / service drone: a hex body, four rotor booms with ducts, camera
// ball underneath, a status light
function bigDrone(M, x, y, z, body = NAVY, light = L.red, s = 1) {
  M.add('shell', new THREE.CylinderGeometry(0.22 * s, 0.26 * s, 0.14 * s, 6), { pos: v(x, y + 0.1 * s, z), color: body });
  M.add('shell', new THREE.SphereGeometry(0.17 * s, 14, 7, 0, PI * 2, 0, PI / 2), { pos: v(x, y + 0.17 * s, z), scale: v(1, 0.55, 1), color: 0xe9e7e1 });
  for (const [sx, sz] of C4) {
    const bx = x + sx * 0.36 * s, bz = z + sz * 0.36 * s;
    seg(M, [x, y + 0.11 * s, z], [bx, y + 0.13 * s, bz], 0.03 * s, N.DARK);
    M.add('metal', new THREE.TorusGeometry(0.17 * s, 0.025 * s, 5, 18), { pos: v(bx, y + 0.15 * s, bz), rot: e(PI / 2, 0, 0), color: body });
    M.cyl('metal', bx, y + 0.13 * s, bz, 0.03 * s, 0.05 * s, N.DARK, 8);
    M.box('metal', bx, y + 0.18 * s, bz, 0.3 * s, 0.01, 0.04 * s, 0x2a2d31, sx * sz * 0.6);
  }
  M.sphere('metal', x, y + 0.01 * s, z, 0.07 * s, 0x1c1e21, 10);
  for (const sx of [-1, 1]) M.cyl('metal', x + sx * 0.12 * s, y - 0.06 * s, z, 0.012, 0.12 * s, N.DARK, 4);
  M.sphere('blink', x, y + 0.12 * s, z - 0.25 * s, 0.03 * s, light, 6);
}


// a sealed data hall on its skid along x: ribbed walls, top and bottom rails,
// a lit status strip, an end door with a window, chillers on the roof
// whose fans turn
function dataHall(M, x, z, len, w, h) {
  M.box('metal', x, 0.12, z, len + 0.2, 0.24, w + 0.2, N.STEEL);
  M.box('shell', x, 0.24 + h / 2, z, len, h, w, N.SHELL);
  for (const k of [-1, 1]) {
    for (let i = 0; i < Math.round(len / 0.26); i++) M.box('shell', x - len / 2 + 0.13 + i * 0.26, 0.24 + h / 2, z + k * (w / 2 + 0.012), 0.05, h - 0.24, 0.025, N.SHELL2);
    for (const y of [0.3, 0.2 + h]) M.box('metal', x, y, z + k * (w / 2 + 0.02), len + 0.04, 0.08, 0.05, N.FRAME);
    M.box('emissive', x, 0.12 + h, z + k * (w / 2 + 0.05), len - 0.4, 0.035, 0.012, L.cyan);
  }
  M.box('metal', x - len / 2 - 0.02, 0.24 + 0.85, z, 0.04, 1.7, 0.95, N.FRAME);
  M.box('hull', x - len / 2 - 0.045, 0.24 + 0.82, z, 0.03, 1.6, 0.85, N.SHELL2);
  M.box('glass', x - len / 2 - 0.065, 0.24 + 1.25, z, 0.01, 0.32, 0.4);
  M.box('metal', x - len / 2 - 0.07, 0.24 + 0.8, z + 0.3, 0.04, 0.05, 0.18, N.DARK);
  M.box('emissive', x - len / 2 - 0.05, 0.24 + 1.78, z, 0.02, 0.06, 0.4, L.green);
  const n = Math.max(1, Math.floor(len / 1.4));
  for (let i = 0; i < n; i++) {
    const cx = x - len / 2 + (i + 0.5) * len / n, y = 0.24 + h;
    M.box('shell', cx, y + 0.2, z, 0.95, 0.4, w * 0.75, N.SHELL2);
    M.cyl('metal', cx, y + 0.4, z, 0.36, 0.02, N.DARK, 24);
    M.add('metal', new THREE.TorusGeometry(0.36, 0.03, 5, 24), { pos: v(cx, y + 0.42, z), rot: e(PI / 2, 0, 0), color: N.FRAME });
    const f = M.animGroup('metal', { pivot: [cx, 0, z], axis: [0, 1, 0], speed: 5 + i });
    for (let k = 0; k < 4; k++) f.add(new THREE.BoxGeometry(0.62, 0.015, 0.11), { pos: v(cx, y + 0.43, z), rot: e(0.3, k * PI / 4, 0), color: 0x6b7178 });
  }
  M.col(x - len / 2 - 0.1, 0, z - w / 2 - 0.1, x + len / 2 + 0.1, 0.24 + h + 0.4, z + w / 2 + 0.1);
}


// six-axis industrial arm on its base at (x, y0, z), slewing about y
function robotArm(M, x, y0, z, { color = N.ORANGE, speed = 0.7, s = 1 } = {}) {
  M.cyl('metal', x, y0, z, 0.24 * s, 0.12, N.DARK, 16);
  const g = M.animGroup('shell', { pivot: [x, 0, z], axis: [0, 1, 0], speed });
  g.add(new THREE.CylinderGeometry(0.19 * s, 0.22 * s, 0.3 * s, 16), { pos: v(x, y0 + 0.27 * s, z), color });
  gStrut(g, [x, y0 + 0.4 * s, z], [x + 0.12 * s, y0 + 1.1 * s, z + 0.25 * s], 0.15 * s, color);
  g.add(new THREE.SphereGeometry(0.11 * s, 12, 8), { pos: v(x + 0.12 * s, y0 + 1.1 * s, z + 0.25 * s), color: N.DARK });
  gStrut(g, [x + 0.12 * s, y0 + 1.1 * s, z + 0.25 * s], [x + 0.18 * s, y0 + 0.78 * s, z + 0.85 * s], 0.11 * s, color);
  g.add(new THREE.BoxGeometry(0.12 * s, 0.14 * s, 0.16 * s), { pos: v(x + 0.18 * s, y0 + 0.68 * s, z + 0.88 * s), color: N.DARK });
  for (const k of [-1, 1]) g.add(new THREE.BoxGeometry(0.025 * s, 0.12 * s, 0.04 * s), { pos: v(x + 0.18 * s + k * 0.04 * s, y0 + 0.57 * s, z + 0.9 * s), color: N.FRAME });
}
// a box hall whose front (local -z) is a curtain wall: floor slab, ribbed
// side and back walls, the glazing with mullions and a transom under a
// spandrel, roof with parapets, light strips inside; returns the glazing top
function glazedHall(M, x, z, w, d, h, { color = N.SHELL, stripe = null, gh = 0, lights = L.white } = {}) {
  const t = 0.18, top = gh || h - 0.75;
  M.box('concrete', x, 0.08, z, w, 0.16, d, 0x6c7075);
  M.box('shell', x, h / 2, z + d / 2 - t / 2, w, h, t, color);
  for (const k of [-1, 1]) M.box('shell', x + k * (w / 2 - t / 2), h / 2, z, t, h, d, color);
  for (let i = 1; i < Math.round(d / 1.2); i++) for (const k of [-1, 1]) M.box('metal', x + k * (w / 2 + 0.01), h / 2, z - d / 2 + i * d / Math.round(d / 1.2), 0.04, h - 0.1, 0.08, N.SHELL2);
  for (let i = 1; i < Math.round(w / 1.2); i++) M.box('metal', x - w / 2 + i * w / Math.round(w / 1.2), h / 2, z + d / 2 + 0.01, 0.08, h - 0.1, 0.04, N.SHELL2);
  M.box('shell', x, top + (h - top) / 2, z - d / 2 + t / 2, w, h - top, t, color);
  M.box('window', x, top / 2 + 0.08, z - d / 2 + 0.06, w - 2 * t, top - 0.16, 0.03);
  const n = Math.max(2, Math.round((w - 2 * t) / 1.15));
  for (let i = 0; i <= n; i++) M.box('metal', x - w / 2 + t + i * (w - 2 * t) / n, top / 2 + 0.08, z - d / 2 + 0.03, 0.07, top - 0.1, 0.09, N.FRAME);
  M.box('metal', x, 0.2, z - d / 2 + 0.03, w - 2 * t, 0.1, 0.1, N.STEEL);
  M.box('metal', x, top * 0.74, z - d / 2 + 0.03, w - 2 * t, 0.05, 0.09, N.FRAME);
  M.box('shell', x, h + 0.06, z, w + 0.08, 0.12, d + 0.08, N.SHELL2);
  for (const k of [-1, 1]) { M.box('metal', x, h + 0.24, z + k * (d / 2 + 0.02), w + 0.12, 0.24, 0.07, N.FRAME); M.box('metal', x + k * (w / 2 + 0.02), h + 0.24, z, 0.07, 0.24, d + 0.12, N.FRAME); }
  for (let i = 0; i < 3; i++) M.box('emissive', x, h - 0.08, z - d / 2 + 0.7 + i * (d - 1.4) / 2, w - 0.8, 0.04, 0.14, lights);
  if (stripe) M.box('emissive', x, top + (h - top) / 2, z - d / 2 - 0.005, w * 0.5, 0.18, 0.02, stripe);
  M.col(x - w / 2, 0, z - d / 2, x + w / 2, h + 0.36, z + d / 2);
  return top;
}


// pressurised rover parked at (x, z) facing local -z turned by yaw: six
// wheels on the chassis, the white cab with its slanted front glazing and
// orange band, roof solar deck, camera mast, headlights, the rear port
function parkedRover(M, x, z, yaw = 0) {
  const c = Math.cos(yaw), s = Math.sin(yaw), P = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  M.box('metal', x, 0.55, z, 1.3, 0.22, 2.4, N.STEEL, yaw);
  for (const k of [-1, 1]) for (const lz of [-0.85, 0, 0.85]) {
    const [wx, wz] = P(k * 0.8, lz);
    M.add('metal', new THREE.CylinderGeometry(0.34, 0.34, 0.26, 20).rotateZ(PI / 2).rotateY(yaw), { pos: v(wx, 0.34, wz), color: 0x2a2c2f });
    M.add('metal', new THREE.CylinderGeometry(0.19, 0.19, 0.27, 12).rotateZ(PI / 2).rotateY(yaw), { pos: v(wx, 0.34, wz), color: N.FRAME });
    const [ax, az] = P(k * 0.6, lz);
    M.box('metal', ax, 0.4, az, 0.3, 0.08, 0.08, N.DARK, yaw);
  }
  const [cx, cz] = P(0, 0.15);
  M.box('shell', cx, 1.2, cz, 1.45, 1.05, 2.0, N.SHELL, yaw);
  M.box('shell', cx, 1.05, cz, 1.47, 0.14, 2.02, N.ORANGE, yaw);
  const [fx, fz] = P(0, -0.9);
  M.box('shell', fx, 0.95, fz, 1.35, 0.55, 0.5, N.SHELL2, yaw);
  const [gx, gz] = P(0, -0.98);
  M.add('glass', new THREE.BoxGeometry(1.2, 0.55, 0.05), { pos: v(gx, 1.38, gz), rot: eo(0.6, yaw, 0, 'YXZ') });
  for (const k of [-1, 1]) { const [hx, hz] = P(k * 0.5, -1.17); M.box('emissive', hx, 0.85, hz, 0.22, 0.08, 0.02, L.white, yaw); }
  const [sx, sz] = P(0, 0.4);
  M.add('solar', new THREE.BoxGeometry(1.3, 0.04, 1.2), { pos: v(sx, 1.77, sz), rot: e(0, yaw, 0) });
  const [mx, mz] = P(0.55, -0.55);
  M.cyl('metal', mx, 1.72, mz, 0.03, 0.55, N.FRAME, 6);
  M.box('metal', mx, 2.32, mz, 0.22, 0.12, 0.14, N.DARK, yaw);
  const [rx, rz] = P(0, 1.16);
  M.box('metal', rx, 1.2, rz, 0.8, 0.85, 0.05, N.FRAME, yaw);
  M.add('metal', new THREE.TorusGeometry(0.28, 0.04, 6, 20), { pos: v(rx, 1.25, rz), rot: e(0, yaw, 0), color: N.DARK });
  const a = P(-0.75, -1.25), b = P(0.75, 1.25);
  M.col(Math.min(a[0], b[0]), 0, Math.min(a[1], b[1]), Math.max(a[0], b[0]), 1.8, Math.max(a[1], b[1]));
}
// planting for the glasshouses: a palm with its fan of drooping fronds, a
// conifer of stacked cones, a broadleaf tree, a shrub
function flora(M, x, z, kind, s = 1, k = 0, y0 = 0) {
  const G = [0x3d7f3a, 0x2f6b34, 0x4f8a3a, 0x2a6a3a][k % 4];
  if (kind === 'palm') {
    let px = x, py = y0, pz = z;
    for (let i = 0; i < 4; i++) { const nx = px + 0.05 * s * (k % 2 ? 1 : -1), ny = py + 0.55 * s, nz = pz + 0.03 * s; seg(M, [px, py, pz], [nx, ny, nz], (0.09 - i * 0.012) * s, 0x7a6248, 'plant', 7); px = nx; py = ny; pz = nz; }
    for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2 + k; M.add('plant', new THREE.BoxGeometry(0.85 * s, 0.025, 0.2 * s).translate(0.42 * s, 0, 0).rotateZ(-0.45).rotateY(a), { pos: v(px, py, pz), color: G }); }
    M.sphere('plant', px, py, pz, 0.1 * s, 0x5a4636, 6);
  } else if (kind === 'conifer') {
    M.cyl('plant', x, y0, z, 0.07 * s, 0.5 * s, 0x5a3b26, 6);
    for (let i = 0; i < 3; i++) M.add('plant', new THREE.ConeGeometry((0.62 - i * 0.16) * s, (0.9 - i * 0.12) * s, 9), { pos: v(x, y0 + (0.75 + i * 0.5) * s, z), color: [0x2a5a32, 0x2f6438, 0x356e3c][i] });
  } else if (kind === 'broad') {
    M.cyl('plant', x, y0, z, 0.08 * s, 1.1 * s, 0x5a3b26, 7);
    for (let i = 0; i < 4; i++) { const a = i * 1.7 + k; M.sphere('plant', x + Math.cos(a) * 0.3 * s, y0 + (1.3 + (i % 2) * 0.3) * s, z + Math.sin(a) * 0.3 * s, (0.42 + (i % 3) * 0.08) * s, G, 10, 0.85); }
  } else {
    for (let i = 0; i < 3; i++) { const a = i * 2.1 + k; M.sphere('plant', x + Math.cos(a) * 0.18 * s, y0 + 0.22 * s, z + Math.sin(a) * 0.18 * s, 0.26 * s, G, 8, 0.75); }
    M.sphere('plant', x, y0 + 0.4 * s, z, 0.07 * s, FLOWER[k % 5], 6);
  }
}


// ---------------------------------------------------------------- base
// rover garage (6x6): the hangar with its roll-up door and beacons, a
// pressurised rover on the striped apron plugged into its charging post,
// a rack of spare wheels, a red tool cart, a parts shelf with bags
export function garage(M) {
  plinth(M, 6, 6);
  hangar(M, -0.3, 1.05, 4.2, 3.9, 3.2, 0, { stripe: N.ORANGE });
  M.box('concrete', -0.3, 0.02, -1.85, 4.4, 0.04, 2.0, 0x8f8a84);
  for (const s of [-1, 1]) M.box('concrete', -0.3 + s * 1.45, 0.045, -1.85, 0.1, 0.012, 1.9, N.YELLOW);
  hazard(M, -0.3, 0.045, -2.82, 3.0, 0.012, 0.1);
  parkedRover(M, -0.35, -1.95, PI / 2 + 0.12);
  M.cyl('metal', 1.75, 0, -2.4, 0.18, 0.08, N.DARK, 12);
  M.box('shell', 1.75, 0.7, -2.4, 0.32, 1.3, 0.26, N.SHELL);
  M.box('emissive', 1.75, 1.1, -2.54, 0.16, 0.12, 0.01, L.green);
  M.tube('metal', [[1.75, 0.7, -2.55], [1.5, 0.25, -2.5], [1.1, 0.3, -2.1], [0.85, 0.9, -1.95]], 0.03, 0x1d2024, 6);
  M.colCyl(1.75, -2.4, 0.2, 0, 1.4);
  // spare wheels on a rack
  M.box('metal', 2.45, 0.6, 0.4, 0.5, 0.05, 1.5, N.STEEL);
  for (const z of [-0.3, 1.1]) M.cyl('metal', 2.45, 0, z, 0.03, 1.2, N.STEEL, 6);
  for (let i = 0; i < 3; i++) M.add('metal', new THREE.CylinderGeometry(0.34, 0.34, 0.26, 18).rotateX(PI / 2), { pos: v(2.45, 0.98, -0.05 + i * 0.42), color: 0x2a2c2f });
  for (let i = 0; i < 2; i++) M.add('metal', new THREE.CylinderGeometry(0.34, 0.34, 0.26, 18).rotateX(PI / 2), { pos: v(2.45, 0.34, 0.05 + i * 0.5), color: 0x2a2c2f });
  M.col(2.15, 0, -0.35, 2.75, 1.35, 1.15);
  // tool cart and parts shelf
  M.box('shell', -2.55, 0.55, -1.9, 0.5, 0.8, 0.7, 0xc9302a);
  for (let i = 0; i < 4; i++) M.box('metal', -2.31, 0.3 + i * 0.17, -1.9, 0.02, 0.12, 0.6, 0x8a2a24);
  for (const [dx, dz] of C4) M.cyl('metal', -2.55 + dx * 0.18, 0, -1.9 + dz * 0.28, 0.05, 0.14, N.DARK, 8);
  M.col(-2.8, 0, -2.25, -2.3, 0.95, -1.55);
  for (let i = 0; i < 3; i++) M.box('metal', -2.55, 0.5 + i * 0.6, 2.2, 0.5, 0.04, 1.3, N.STEEL);
  for (const z of [1.6, 2.8]) M.cyl('metal', -2.55, 0, z, 0.03, 1.75, N.STEEL, 6);
  cargoBags(M, -2.55, 2.0, 2, PI / 2);
  M.col(-2.8, 0, 1.55, -2.3, 1.75, 2.85);
  M.entry(-0.3);
}

// ---------------------------------------------------------------- power
// small hydro (6x6): a catamaran barge on the lake (y = 0 is the water line):
// two pontoons with their waterline stripes, a steel deck with gratings and
// rails, a ducted turbine hanging in the well between the hulls (it turns
// with the current) under a lifting gantry, the powerhouse, the transformer,
// the cable reel paying the line out to the shore, bollards and mooring lines,
// navigation lights
export function hydro(M) {
  const DY = 0.74;
  for (const sx of [-1, 1]) {
    const x = sx * 2.05;
    M.add('shell', new THREE.CylinderGeometry(0.5, 0.5, 4.4, 28).rotateX(PI / 2), { pos: v(x, -0.02, 0), color: N.SHELL });
    for (const sz of [-1, 1]) M.add('shell', new THREE.SphereGeometry(0.5, 24, 10, 0, PI * 2, 0, PI / 2).rotateX(sz * PI / 2), { pos: v(x, -0.02, sz * 2.2), scale: v(1, 1, 1.5), color: N.SHELL2 });
    for (const k of [-1, 1]) M.box('shell', x + k * 0.5, 0.06, 0, 0.03, 0.13, 4.3, N.ORANGE);
    M.box('metal', x, 0.6, 0, 0.32, 0.22, 5.4, N.STEEL);
    grating(M, sx * 2.0, DY, 0, 1.2, 5.2);
    railing(M, sx * 2.58, -2.55, sx * 2.58, 2.55, DY, 1.0, N.YELLOW);
    // bollards and mooring lines
    for (const sz of [-1, 1]) {
      M.cyl('metal', sx * 2.35, DY, sz * 2.45, 0.09, 0.28, N.DARK, 10);
      M.cyl('metal', sx * 2.35, DY + 0.28, sz * 2.45, 0.13, 0.05, N.DARK, 10);
      seg(M, [sx * 2.35, DY + 0.2, sz * 2.45], [sx * 3.4, -0.25, sz * 3.5], 0.025, 0xd9cfa8, 'metal', 6);
    }
  }
  for (const z of [-2.45, -1.7, -0.5, 0.75, 2.45]) M.box('metal', 0, 0.62, z, 4.4, 0.18, 0.22, N.STEEL);
  grating(M, 0, DY, 1.7, 2.8, 2.0);
  grating(M, 0, DY, -2.25, 2.8, 1.1);
  M.col(-2.6, -0.6, -2.8, 2.6, DY, 2.8, { walk: true });
  // the turbine in its duct
  const ty = -0.38, tz = -0.5;
  M.add('shell', new THREE.CylinderGeometry(0.78, 0.7, 1.4, 32, 1, true).rotateX(PI / 2), { pos: v(0, ty, tz), color: N.SHELL2 });
  for (const dz of [-0.7, 0.7]) M.add('metal', new THREE.TorusGeometry(0.76, 0.06, 6, 32), { pos: v(0, ty, tz + dz), color: N.ORANGE });
  for (const sx of [-1, 1]) seg(M, [sx * 0.55, ty + 0.5, tz], [sx * 0.95, 0.62, tz], 0.07, N.STEEL);
  M.add('metal', new THREE.TorusGeometry(0.1, 0.03, 6, 12), { pos: v(0, ty + 0.83, tz), color: N.YELLOW });
  const rotor = M.animGroup('metal', { pivot: [0, ty, tz], axis: [0, 0, 1], speed: 1.6 });
  rotor.add(new THREE.SphereGeometry(0.18, 14, 8), { pos: v(0, ty, tz - 0.05), scale: v(1, 1, 1.6), color: N.SHELL });
  for (let k = 0; k < 3; k++) { const a = k / 3 * PI * 2; rotor.add(new THREE.BoxGeometry(0.17, 0.56, 0.04).translate(0, 0.36, 0).rotateY(0.45).rotateZ(a), { pos: v(0, ty, tz), color: 0x8a9096 }); }
  // lifting gantry over the well
  for (const sx of [-1, 1]) {
    for (const dz of [-0.6, 0.6]) strut(M, [sx * 1.55, DY, tz + dz], [sx * 1.55, 3.1, tz], 0.12, N.YELLOW);
    strut(M, [sx * 1.55, 1.6, tz - 0.3], [sx * 1.55, 1.6, tz + 0.3], 0.06, N.YELLOW);
  }
  M.box('metal', 0, 3.18, tz, 3.4, 0.24, 0.24, N.YELLOW);
  M.box('metal', 0.1, 2.92, tz, 0.32, 0.3, 0.3, N.DARK);
  M.cyl('metal', 0.1, ty + 0.85, tz, 0.015, 2.92 - ty - 1.0, 0x8a9096, 4);
  // powerhouse
  const ph = 1.75;
  M.box('shell', 0, DY + 0.95, ph, 2.5, 1.9, 1.75, N.SHELL);
  M.add('shell', new THREE.BoxGeometry(2.7, 0.08, 1.95).rotateX(0.12), { pos: v(0, DY + 1.98, ph), color: N.SHELL2 });
  M.box('shell', 0, DY + 1.55, ph, 2.52, 0.16, 1.77, N.ORANGE);
  for (const x of [-0.65, 0.65]) M.box('glass', x, DY + 1.05, ph - 0.885, 0.6, 0.5, 0.03);
  hatch(M, 1.26, DY + 0.02, ph + 0.2, PI / 2, { w: 0.7, h: 1.45, depth: 0.1, label: false });
  for (let i = 0; i < 4; i++) M.box('metal', -1.26, DY + 0.7 + i * 0.12, ph + 0.3, 0.03, 0.05, 0.6, N.DARK);
  M.add('shell', new THREE.TorusGeometry(0.22, 0.06, 8, 20), { pos: v(-0.2, DY + 1.15, ph - 0.9), color: N.ORANGE });
  M.col(-1.25, DY, ph - 0.88, 1.25, DY + 2.0, ph + 0.88);
  transformer(M, 2.0, 1.6, 0.62, 0, DY);
  // cable reel paying the line ashore
  const rx = -2.0, rz = 1.9;
  for (const dx of [-0.32, 0.32]) { M.add('metal', new THREE.CylinderGeometry(0.5, 0.5, 0.05, 24).rotateZ(PI / 2), { pos: v(rx + dx, DY + 0.6, rz), color: N.ORANGE }); M.box('metal', rx + dx, DY + 0.3, rz, 0.08, 0.6, 0.5, N.STEEL); }
  M.add('metal', new THREE.CylinderGeometry(0.4, 0.4, 0.6, 20).rotateZ(PI / 2), { pos: v(rx, DY + 0.6, rz), color: 0x1d2024 });
  M.tube('metal', [[rx, DY + 0.25, rz + 0.3], [rx, DY - 0.1, rz + 0.8], [rx - 0.1, -0.3, rz + 1.4]], 0.05, 0x1d2024, 6);
  // navigation lights
  for (const sx of [-1, 1]) { M.cyl('metal', sx * 2.45, DY, -2.65, 0.03, 1.3, N.FRAME, 6); M.sphere('emissive', sx * 2.45, DY + 1.36, -2.65, 0.07, sx > 0 ? L.green : L.red, 8); }
  M.vent(0, 0.08, tz + 1.0, { rate: 0.5, size: 0.7 });
}
// fusion plant (10x10): an open tokamak on its bioshield drum, sixteen
// D-shaped field coils round the vacuum vessel, poloidal rings, the central
// solenoid and its feedthrough; diagnostic ports glowing with the plasma, a
// neutral-beam injector on its tower, the helium cryoplant, the turbine hall
// with its generator and transformer, radiator wings, the control vestibule
export function fusion(M) {
  plinth(M, 10, 10);
  const cx = -1.2, cz = -0.4, yc = 3.8, R = 2.0, rm = 0.95;
  M.cyl('concrete', cx, 0, cz, 3.35, 0.3, 0x9a948c, 48);
  M.cyl('shell', cx, 0.3, cz, 3.0, 2.25, N.SHELL2, 48);
  for (const y of [0.33, 1.45, 2.53]) M.add('metal', new THREE.TorusGeometry(3.02, 0.06, 5, 48), { pos: v(cx, y, cz), rot: e(PI / 2, 0, 0), color: N.FRAME });
  for (let k = 0; k < 16; k++) { const a = (k + 0.5) / 16 * PI * 2; M.box('metal', cx + Math.sin(a) * 3.03, 1.42, cz + Math.cos(a) * 3.03, 0.16, 2.2, 0.08, N.FRAME, a); }
  for (let k = 0; k < 8; k++) { const a = (k + 0.25) / 8 * PI * 2; M.box('shell', cx + Math.sin(a) * 3.02, 1.95, cz + Math.cos(a) * 3.02, 0.05, 0.5, 0.012, N.STENCIL, a); }
  M.cyl('metal', cx, 2.55, cz, 2.95, 0.12, N.STEEL, 48);
  // vacuum vessel and its field coils
  M.add('hull', new THREE.TorusGeometry(R, rm, 28, 72), { pos: v(cx, yc, cz), rot: e(PI / 2, 0, 0), color: 0xc9ccd0 });
  const D = [];
  for (let i = 0; i <= 7; i++) { const t = PI / 2 - i / 7 * PI / 2; D.push([0.95 + 2.2 * Math.sin(t), 1.25 * Math.cos(t)]); }
  D.push([0.95, 0.45], [0.95, -0.45]);
  for (let i = 0; i <= 7; i++) { const t = PI - i / 7 * PI / 2; D.push([0.95 + 2.2 * Math.sin(t), 1.25 * Math.cos(t)]); }
  for (let k = 0; k < 16; k++) {
    const a = k / 16 * PI * 2, s = Math.sin(a), c = Math.cos(a);
    M.tube('metal', D.map(([p, y]) => [cx + s * p, yc + y, cz + c * p]), 0.13, 0x59616a, 6);
    M.box('metal', cx + s * 3.0, 2.68, cz + c * 3.0, 0.3, 0.22, 0.3, N.DARK, a);
  }
  for (const y of [-1.02, 1.02]) M.add('metal', new THREE.TorusGeometry(2.45, 0.09, 6, 64), { pos: v(cx, yc + y, cz), rot: e(PI / 2, 0, 0), color: 0x9a6a3a });
  M.cyl('metal', cx, 2.6, cz, 0.62, 3.1, 0x3a3f45, 24);
  for (let i = 0; i < 6; i++) M.cyl('metal', cx, 2.75 + i * 0.5, cz, 0.645, 0.18, 0xb87333, 24);
  M.cyl('shell', cx, 5.7, cz, 0.78, 0.26, N.SHELL2, 24);
  M.cyl('metal', cx, 5.96, cz, 0.22, 0.5, N.FRAME, 12);
  beacon(M, cx, 6.46, cz, L.red);
  // the plasma seen through the diagnostic ports
  for (const k of [1, 3, 8, 9, 11, 13]) {
    const a = (k + 0.5) / 16 * PI * 2, s = Math.sin(a), c = Math.cos(a);
    M.add('emissive', new THREE.CylinderGeometry(0.15, 0.15, 0.08, 18), { pos: v(cx + s * 2.96, yc, cz + c * 2.96), rot: eo(PI / 2, a, 0, 'YXZ'), color: 0xff6ad5 });
    M.add('metal', new THREE.TorusGeometry(0.19, 0.045, 6, 18), { pos: v(cx + s * 2.97, yc, cz + c * 2.97), rot: e(0, a, 0), color: N.FRAME });
  }
  M.light(cx + 0.4, yc, cz - 3.3, 0xff6ad5, 2, 6);
  // neutral-beam injector on its tower
  {
    const a = 6.5 / 16 * PI * 2, s = Math.sin(a), c = Math.cos(a);
    const P = (p) => [cx + s * p, yc, cz + c * p];
    seg(M, P(2.75), P(4.0), 0.3, 0xb8bcc0, 'metal', 18);
    for (const p of [3.05, 3.65]) seg(M, P(p - 0.04), P(p + 0.04), 0.4, N.FRAME, 'metal', 18);
    const q = P(4.55);
    M.box('shell', q[0], yc, q[2], 1.05, 1.05, 1.3, N.SHELL, a);
    M.box('metal', q[0], yc + 0.57, q[2], 1.12, 0.08, 1.38, N.FRAME, a);
    M.box('shell', q[0], yc, q[2], 1.08, 0.18, 1.33, N.ORANGE, a);
    for (const [ux, uz] of C4) { const lx = ux * 0.42, lz = uz * 0.5; M.cyl('metal', q[0] + lx * c + lz * s, 0, q[2] - lx * s + lz * c, 0.07, yc - 0.52, N.STEEL, 8); }
    for (const h of [1.0, 2.2]) for (const ux of [-1, 1]) { const lx = ux * 0.42; M.box('metal', q[0] + lx * c, h, q[2] - lx * s, 0.06, 0.06, 1.0, N.STEEL, a); }
    M.col(q[0] - 0.75, 0, q[2] - 0.75, q[0] + 0.75, yc + 0.6, q[2] + 0.75);
  }
  // helium cryoplant: two spheres and the foil-wrapped cold box
  for (const z of [3.7, 2.2]) sphereTank(M, -4.1, 1.25, z, 0.66, {});
  tankV(M, -3.0, 2.55, 0.42, 2.6, { y0: 0.3, band: BLUE, key: 'foil', color: 0xd8a640 });
  piping(M, [[-3.0, 2.2, 2.2], [-3.0, 2.85, 1.6], [cx - 1.2, 2.85, 1.6], [cx - 1.2, 3.1, 1.2]], 0.06, 0xd8d8d0);
  // turbine hall, generator and transformer
  tubeModule(M, -0.4, 1.05, 4.0, 3.8, 0.85, 0, { endHatch: false, startHatch: true, ribs: 3, ports: 2 });
  M.add('metal', new THREE.CylinderGeometry(0.58, 0.58, 1.1, 24), { pos: v(2.3, 1.05, 4.0), rot: e(0, 0, PI / 2), color: 0x5b6168 });
  for (let i = 0; i < 6; i++) M.add('metal', new THREE.TorusGeometry(0.6, 0.03, 4, 24), { pos: v(1.85 + i * 0.18, 1.05, 4.0), rot: e(0, PI / 2, 0), color: N.FRAME });
  M.box('metal', 2.3, 0.25, 4.0, 1.3, 0.5, 1.0, N.STEEL);
  M.col(1.7, 0, 3.4, 2.9, 1.65, 4.6);
  transformer(M, 3.95, 3.85, 0.9, PI / 2);
  piping(M, [[2.85, 1.35, 4.0], [3.4, 2.0, 4.0], [3.95, 2.0, 4.0], [3.95, 1.72, 3.85]], 0.035, 0x2a2d31);
  // radiator wings and their loop
  for (const z0 of [-1.6, -0.3, 1.0]) radiatorWing(M, 4.35, z0, -PI / 2, { w: 1.15, h: 2.8, y0: 0.55 });
  piping(M, [[1.5, 0.45, 3.2], [4.05, 0.45, 3.2], [4.05, 0.45, -1.6]], 0.07, 0xb8bec4);
  for (const z of [2.4, 1.0, -0.4]) M.box('metal', 4.05, 0.2, z, 0.16, 0.4, 0.16, N.STEEL);
  // magnet power supplies
  for (let i = 0; i < 3; i++) avionics(M, -4.45, 0, -2.6 + i * 1.0, 0.7, 1.25, 0.8);
  // control vestibule
  M.box('shell', cx, 1.15, cz - 3.3, 1.9, 2.3, 1.1, N.SHELL);
  M.box('metal', cx, 2.34, cz - 3.3, 2.0, 0.08, 1.2, N.FRAME);
  M.box('glass', cx + 0.66, 1.55, cz - 3.86, 0.45, 0.5, 0.03);
  hatch(M, cx - 0.2, 0.02, cz - 3.85, PI, { w: 0.85, h: 1.75, depth: 0.14 });
  M.col(cx - 0.95, 0, cz - 3.85, cx + 0.95, 2.35, cz - 2.75);
  M.light(cx, 2.7, cz - 4.3, L.white, 2, 7);
  M.colCyl(cx, cz, 3.0, 0, 2.62);
  M.colCyl(cx, cz, 3.2, 2.62, 5.2);
  M.entry(cx - 0.2);
}
// orbital rectenna (12x12): rows of receiving panels on A-frames, each a fine
// silver dipole mesh over a dark ground plane with its junction box, covered
// cable trenches between the rows, the converter station with its
// transformer, the pilot-beacon mast the satellite locks onto, a safety fence
export function rectenna(M) {
  plinth(M, 12, 12, { collide: false });
  M.col(-6, -0.45, -6, 6, 0, 6);
  const tilt = 0.55, pw = 2.3, pd = 1.6;
  const rot = eo(-tilt, 0, 0, 'YXZ');
  for (let r = 0; r < 3; r++) {
    const z = -4.3 + r * 2.5;
    M.box('concrete', -0.7, 0.03, z + 1.25, 10.4, 0.06, 0.32, 0x7f7a74);
    for (let c = 0; c < 4; c++) {
      const x = -4.6 + c * 2.6, y = 1.0;
      for (const sx of [-1, 1]) { strut(M, [x + sx * 0.9, 0, z - 0.6], [x + sx * 0.9, y - 0.35, z - 0.45], 0.06, N.STEEL); strut(M, [x + sx * 0.9, 0, z + 0.65], [x + sx * 0.9, y + 0.35, z + 0.4], 0.06, N.STEEL); M.box('metal', x + sx * 0.9, 0.03, z, 0.14, 0.06, 1.4, N.DARK); }
      M.add('shell', new THREE.BoxGeometry(pw, 0.04, pd), { pos: v(x, y, z), rot, color: 0xc9cdd1 });
      for (let i = 0; i <= 8; i++) { const o = new THREE.Vector3(-pw / 2 + 0.06 + i * (pw - 0.12) / 8, 0.03, 0).applyEuler(rot); M.add('metal', new THREE.BoxGeometry(0.028, 0.016, pd - 0.08), { pos: v(x + o.x, y + o.y, z + o.z), rot, color: 0x3d434a }); }
      for (let k = 0; k <= 5; k++) { const o = new THREE.Vector3(0, 0.03, -pd / 2 + 0.06 + k * (pd - 0.12) / 5).applyEuler(rot); M.add('metal', new THREE.BoxGeometry(pw - 0.08, 0.016, 0.028), { pos: v(x + o.x, y + o.y, z + o.z), rot, color: 0x3d434a }); }
      for (let i = 0; i < 8; i++) for (let k = 0; k < 5; k++) { const o = new THREE.Vector3(-pw / 2 + 0.06 + (i + 0.5) * (pw - 0.12) / 8, 0.035, -pd / 2 + 0.06 + (k + 0.5) * (pd - 0.12) / 5).applyEuler(rot); M.add('metal', new THREE.BoxGeometry(0.16, 0.012, 0.03), { pos: v(x + o.x, y + o.y, z + o.z), rot, color: 0xb87333 }); }
      for (const k of [-1, 1]) { const o = new THREE.Vector3(0, 0.02, k * pd / 2).applyEuler(rot); M.add('metal', new THREE.BoxGeometry(pw + 0.06, 0.05, 0.05), { pos: v(x + o.x, y + o.y, z + o.z), rot, color: N.FRAME }); }
      M.box('shell', x + 1.0, 0.35, z + 0.55, 0.22, 0.28, 0.16, 0xe8e6e0);
      M.col(x - pw / 2, 0, z - 0.75, x + pw / 2, y + 0.5, z + 0.75);
    }
  }
  // converter station and transformer
  const cx = 3.35, cz = 3.85;
  M.box('metal', cx, 0.1, cz, 3.3, 0.2, 1.7, N.STEEL);
  M.box('shell', cx, 0.95, cz, 3.0, 1.5, 1.45, N.SHELL);
  for (let i = 0; i < 12; i++) M.box('shell', cx - 1.4 + i * 0.255, 0.95, cz - 0.735, 0.05, 1.3, 0.02, N.SHELL2);
  M.box('metal', cx, 1.72, cz, 3.05, 0.06, 1.5, N.FRAME);
  roofRad(M, cx - 0.7, 1.75, cz, 1.2, 1.0, 0);
  roofRad(M, cx + 0.75, 1.75, cz, 1.2, 1.0, 0);
  hatch(M, cx - 1.05, 0.2, cz - 0.73, PI, { w: 0.7, h: 1.25, depth: 0.08, label: false });
  M.box('emissive', cx + 0.6, 1.3, cz - 0.74, 0.5, 0.06, 0.01, L.green);
  M.col(cx - 1.5, 0, cz - 0.73, cx + 1.5, 1.75, cz + 0.73);
  transformer(M, 0.6, 4.3, 0.8, 0);
  piping(M, [[-0.7, 0.1, -3.05], [-0.7, 0.1, 3.0], [cx - 1.5, 0.1, 3.0]], 0.05, 0x2a2d31);
  // pilot beacon mast
  const mx = -4.7, mz = 3.9;
  mast(M, mx, mz, 6.6, 0.5, 0.22);
  M.cyl('metal', mx, 6.6, mz, 0.32, 0.08, N.GRATE, 14);
  M.add('shell', new THREE.CylinderGeometry(0.42, 0.12, 0.7, 4, 1, true), { pos: v(mx, 7.05, mz), rot: e(0, PI / 4, 0), color: N.SHELL });
  M.cyl('metal', mx, 6.68, mz, 0.12, 0.05, N.DARK, 10);
  M.sphere('blink', mx + 0.3, 6.75, mz, 0.07, L.red, 6);
  avionics(M, mx + 0.9, 0, mz, 0.6, 0.7, 0.5);
  // safety fence with a gate at the front
  for (const [x0, z0, x1, z1] of [[-5.85, -5.85, -1.5, -5.85], [1.5, -5.85, 5.85, -5.85], [5.85, -5.85, 5.85, 5.85], [-5.85, 5.85, 5.85, 5.85], [-5.85, -5.85, -5.85, 5.85]]) railing(M, x0, z0, x1, z1, 0, 1.2, 0x8a9096);
  for (const s of [-1, 1]) { M.cyl('metal', s * 1.5, 0, -5.85, 0.06, 1.4, N.YELLOW, 8); M.add('shell', new THREE.CylinderGeometry(0.22, 0.22, 0.03, 3).rotateX(PI / 2), { pos: v(s * 1.5, 1.15, -5.9), color: N.YELLOW }); }
}
// high-voltage substation (4x4): on its gravel bed, the transformer with
// fins, conservator and bushings, the dead-end gantry with insulator strings
// and the jumpers down to the bushings, surge arresters, a lightning mast,
// the control kiosk, the fence with its gate and warning sign
export function substation(M) {
  plinth(M, 4, 4);
  M.box('regolith', 0, 0.03, 0, 3.8, 0.06, 3.8, 0x5d5249);
  transformer(M, -0.45, 0.35, 0.95, 0);
  for (const k of [-1, 1]) M.box('metal', 1.2, 1.75, k * 1.0, 0.22, 3.5, 0.22, N.FRAME);
  for (const k of [-1, 1]) for (let y = 0.6; y < 3.2; y += 0.7) strut(M, [1.2, y, k * 1.0 - 0.1], [1.2, y + 0.7, k * 1.0 + 0.1], 0.04, N.FRAME);
  M.box('metal', 1.2, 3.42, 0, 0.24, 0.24, 2.4, N.FRAME);
  for (let i = -1; i <= 1; i++) {
    const z = i * 0.6;
    for (let k = 0; k < 4; k++) M.cyl('shell', 1.2, 2.72 + k * 0.15, z, 0.1, 0.04, 0x7a4e2c, 10);
    M.cyl('metal', 1.2, 2.66, z, 0.015, 0.68, N.DARK, 4);
    M.tube('metal', [[1.2, 2.66, z], [0.8, 2.2, z * 0.8], [0.2, 2.05, z * 0.55], [-0.45 + i * 0.3, 1.95, 0.24]], 0.02, 0x9aa0a6, 4);
  }
  M.col(1.08, 0, -1.12, 1.32, 3.55, -0.88);
  M.col(1.08, 0, 0.88, 1.32, 3.55, 1.12);
  M.box('metal', 0.55, 0.5, -1.25, 1.0, 0.08, 0.25, N.STEEL);
  for (let i = 0; i < 3; i++) { M.cyl('metal', 0.2 + i * 0.35, 0.54, -1.25, 0.05, 0.5, 0x9a6e44, 8); for (let k = 0; k < 3; k++) M.cyl('shell', 0.2 + i * 0.35, 0.62 + k * 0.13, -1.25, 0.08, 0.03, 0x7a4e2c, 10); }
  for (const x of [0.15, 0.95]) M.cyl('metal', x, 0, -1.25, 0.03, 0.5, N.STEEL, 6);
  M.cyl('metal', -1.6, 0, 1.6, 0.06, 4.2, N.FRAME, 8);
  M.cyl('metal', -1.6, 4.2, 1.6, 0.02, 0.5, N.DARK, 4);
  M.box('shell', -1.25, 0.7, -1.3, 0.8, 1.4, 0.7, N.SHELL);
  M.box('metal', -1.25, 1.43, -1.3, 0.86, 0.06, 0.76, N.FRAME);
  M.box('metal', -1.25, 0.65, -1.66, 0.45, 1.1, 0.02, N.SHELL2);
  M.box('shell', -0.88, 1.0, -1.3, 0.06, 0.3, 0.4, 0x8a9096);
  M.col(-1.65, 0, -1.65, -0.85, 1.45, -0.95);
  for (const [x0, z0, x1, z1] of [[-1.92, -1.92, 0.2, -1.92], [1.0, -1.92, 1.92, -1.92], [1.92, -1.92, 1.92, 1.92], [-1.92, 1.92, 1.92, 1.92], [-1.92, -1.92, -1.92, 1.92]]) railing(M, x0, z0, x1, z1, 0, 1.6, 0x8a9096);
  M.box('metal', 0.6, 0.8, -1.92, 0.8, 1.5, 0.03, N.YELLOW);
  M.add('shell', new THREE.CylinderGeometry(0.17, 0.17, 0.02, 3).rotateX(PI / 2), { pos: v(1.45, 1.1, -1.95), color: N.YELLOW });
}

// ---------------------------------------------------------------- terraforming
// polar melter (6x6): darkens the ice cap so it sublimes: the dust silo on its
// legs with a rotary feeder and a pneumatic line, the blower turret slinging
// dark dust from a curved chute (it slews), two heliostats aiming sunlight at
// the dusted ice, the control shelter with its radiator, a fan of spread dust
export function polarmelter(M) {
  plinth(M, 6, 6);
  const sx = -1.65, sz = 1.35;
  M.cyl('metal', sx, 1.55, sz, 0.85, 2.35, 0x5d5a57, 28);
  M.add('metal', new THREE.ConeGeometry(0.85, 0.95, 28, 1, true), { pos: v(sx, 1.075, sz), rot: e(PI, 0, 0), color: 0x55524f });
  band(M, sx, sz, 0.85, 3.35, 0.24, N.ORANGE);
  for (const y of [1.6, 2.5]) M.add('metal', new THREE.TorusGeometry(0.86, 0.035, 4, 28), { pos: v(sx, y, sz), rot: e(PI / 2, 0, 0), color: N.FRAME });
  M.add('shell', new THREE.ConeGeometry(0.9, 0.35, 28), { pos: v(sx, 4.07, sz), color: 0x6a6662 });
  M.cyl('metal', sx, 4.2, sz, 0.18, 0.3, N.FRAME, 10);
  for (const [ux, uz] of C4) { strut(M, [sx + ux * 0.62, 0, sz + uz * 0.62], [sx + ux * 0.6, 1.62, sz + uz * 0.6], 0.1, N.STEEL); M.box('metal', sx + ux * 0.62, 0.03, sz + uz * 0.62, 0.3, 0.06, 0.3, N.DARK); }
  for (const [a, b] of [[0, 1], [1, 2], [2, 3], [3, 0]]) strut(M, [sx + C4[a][0] * 0.61, 0.9, sz + C4[a][1] * 0.61], [sx + C4[b][0] * 0.61, 0.9, sz + C4[b][1] * 0.61], 0.06, N.STEEL);
  ladder(M, sx + 0.88, sz, 1.0, 4.0, PI / 2);
  M.cyl('metal', sx, 0.32, sz, 0.2, 0.3, N.DARK, 12);
  M.colCyl(sx, sz, 0.88, 0, 4.2);
  // blower turret
  const tx = 0.85, tz = 0.15;
  piping(M, [[sx + 0.1, 0.42, sz], [0.1, 0.42, sz], [0.1, 0.42, tz + 0.2], [tx - 0.5, 0.42, tz + 0.2]], 0.09, 0x3a3f45);
  M.cyl('concrete', tx, 0, tz, 0.85, 0.2, 0x8f8a84, 24);
  M.cyl('metal', tx, 0.2, tz, 0.62, 0.32, N.STEEL, 24);
  M.add('metal', new THREE.TorusGeometry(0.62, 0.05, 6, 28), { pos: v(tx, 0.52, tz), rot: e(PI / 2, 0, 0), color: N.FRAME });
  const T = M.animGroup('shell', { pivot: [tx, 0, tz], axis: [0, 1, 0], speed: 0.22 });
  T.add(new THREE.CylinderGeometry(0.58, 0.58, 0.5, 24).rotateZ(PI / 2), { pos: v(tx, 1.08, tz + 0.05), color: N.SHELL });
  for (const s of [-1, 1]) T.add(new THREE.CylinderGeometry(0.6, 0.6, 0.04, 24).rotateZ(PI / 2), { pos: v(tx + s * 0.25, 1.08, tz + 0.05), color: N.FRAME });
  T.add(new THREE.BoxGeometry(0.5, 0.5, 0.6), { pos: v(tx, 0.82, tz + 0.65), color: N.STEEL });
  T.add(new THREE.CylinderGeometry(0.17, 0.17, 0.5, 14).rotateZ(PI / 2), { pos: v(tx + 0.5, 1.08, tz + 0.05), color: N.DARK });
  const CH = [[tx, 1.55, tz - 0.05], [tx, 2.15, tz - 0.3], [tx, 2.55, tz - 0.85], [tx, 2.7, tz - 1.45]];
  for (let i = 0; i < CH.length - 1; i++) { seg(T, CH[i], CH[i + 1], 0.2, N.SHELL, 'shell', 14); T.add(new THREE.SphereGeometry(0.2, 12, 8), { pos: v(...CH[i]), color: N.SHELL }); }
  T.add(new THREE.BoxGeometry(0.5, 0.06, 0.6).rotateX(-0.45), { pos: v(tx, 2.86, tz - 1.65), color: N.ORANGE });
  for (const s of [-1, 1]) T.add(new THREE.BoxGeometry(0.04, 0.3, 0.5), { pos: v(tx + s * 0.25, 2.75, tz - 1.6), color: N.ORANGE });
  M.colCyl(tx, tz, 0.7, 0, 1.6);
  M.add('regolith', new THREE.CircleGeometry(2.1, 28, PI * 0.28, PI * 0.44).rotateX(-PI / 2), { pos: v(tx, 0.03, tz - 0.6), color: 0x2a2422 });
  // heliostats
  for (const [x, z, yaw] of [[2.0, -1.75, -0.35], [-0.9, -2.0, 0.3]]) {
    M.cyl('concrete', x, 0, z, 0.32, 0.18, 0x8f8a84, 14);
    M.cyl('metal', x, 0.18, z, 0.1, 1.42, N.FRAME, 10);
    M.box('metal', x, 1.66, z, 0.3, 0.24, 0.3, N.DARK);
    const rot = eo(-0.85, yaw + PI, 0, 'YXZ');
    for (let i = 0; i < 4; i++) {
      const o = new THREE.Vector3((i % 2 - 0.5) * 0.84, 0, (Math.floor(i / 2) - 0.5) * 0.64).applyEuler(rot);
      M.add('mirror', new THREE.BoxGeometry(0.8, 0.03, 0.6), { pos: v(x + o.x, 1.95 + o.y, z + o.z), rot, color: 0xd0d8e2 });
    }
    const back = new THREE.Vector3(0, -0.06, 0).applyEuler(rot);
    M.add('metal', new THREE.BoxGeometry(1.7, 0.05, 0.08), { pos: v(x + back.x, 1.95 + back.y, z + back.z), rot, color: N.STEEL });
    M.add('metal', new THREE.BoxGeometry(0.08, 0.05, 1.3), { pos: v(x + back.x, 1.95 + back.y, z + back.z), rot, color: N.STEEL });
    M.colCyl(x, z, 0.3, 0, 2.4);
  }
  // control shelter
  M.box('shell', 2.15, 0.8, 2.05, 1.3, 1.6, 1.1, N.SHELL);
  M.box('metal', 2.15, 1.63, 2.05, 1.36, 0.07, 1.16, N.FRAME);
  M.box('shell', 2.15, 1.32, 2.05, 1.32, 0.14, 1.12, N.ORANGE);
  hatch(M, 2.15, 0.02, 1.48, PI, { w: 0.62, h: 1.35, depth: 0.08, label: false });
  roofRad(M, 2.15, 1.66, 2.05, 1.15, 0.85, 0);
  avionics(M, 0.95, 0, 2.35, 0.6, 0.55, 0.5);
  M.col(1.5, 0, 1.5, 2.8, 1.65, 2.6);
  lightPole(M, -2.6, -2.5, 3.2, PI * 0.8);
}
// cloud seeding station (5x5): a silver-iodide rocket launcher on its
// turntable (a pod of nine tubes raised toward the clouds, two rockets
// loaded), a radome tower that tracks the clouds, a burner stack seeding from
// the ground with its fuel bottle, the store shed with a rack of rockets
export function cloudseeder(M) {
  plinth(M, 5, 5);
  const lx = 0.75, lz = -0.55;
  M.cyl('concrete', lx, 0, lz, 0.8, 0.22, 0x8f8a84, 24);
  M.cyl('metal', lx, 0.22, lz, 0.42, 0.55, N.STEEL, 16);
  M.cyl('metal', lx, 0.77, lz, 0.62, 0.12, N.DARK, 24);
  M.colCyl(lx, lz, 0.75, 0, 0.9);
  const g = M.animGroup('shell', { pivot: [lx, 0, lz], axis: [0, 1, 0], speed: 0.12 });
  g.add(new THREE.CylinderGeometry(0.6, 0.6, 0.12, 24), { pos: v(lx, 0.95, lz), color: N.SHELL2 });
  for (const s of [-1, 1]) g.add(new THREE.BoxGeometry(0.12, 0.85, 0.55), { pos: v(lx + s * 0.6, 1.4, lz), color: N.SHELL2 });
  g.add(new THREE.CylinderGeometry(0.08, 0.08, 1.36, 10).rotateZ(PI / 2), { pos: v(lx, 1.68, lz), color: N.FRAME });
  const el = 0.95, pod = (geo) => geo.rotateX(el);
  g.add(pod(new THREE.BoxGeometry(1.02, 0.98, 1.6).translate(0, 0, -0.2)), { pos: v(lx, 1.68, lz), color: N.SHELL });
  g.add(pod(new THREE.BoxGeometry(1.06, 0.18, 1.64).translate(0, 0.3, -0.2)), { pos: v(lx, 1.68, lz), color: N.ORANGE });
  for (let i = 0; i < 9; i++) {
    const tx = (i % 3 - 1) * 0.3, ty = (Math.floor(i / 3) - 1) * 0.3;
    g.add(pod(new THREE.CylinderGeometry(0.12, 0.12, 0.03, 14).rotateX(PI / 2).translate(tx, ty, -1.005)), { pos: v(lx, 1.68, lz), color: 0x15171a });
    if (i === 1 || i === 5) {
      g.add(pod(new THREE.ConeGeometry(0.1, 0.32, 14).rotateX(-PI / 2).translate(tx, ty, -1.17)), { pos: v(lx, 1.68, lz), color: 0xeeece6 });
      g.add(pod(new THREE.CylinderGeometry(0.102, 0.102, 0.06, 14).rotateX(PI / 2).translate(tx, ty, -1.03)), { pos: v(lx, 1.68, lz), color: N.ORANGE });
    }
  }
  // radome tower
  const rx = -1.5, rz = 1.25;
  mast(M, rx, rz, 2.6, 0.45, 0.32);
  M.cyl('metal', rx, 2.6, rz, 0.62, 0.07, N.GRATE, 20);
  M.add('metal', new THREE.TorusGeometry(0.62, 0.02, 4, 24), { pos: v(rx, 3.2, rz), rot: e(PI / 2, 0, 0), color: N.YELLOW });
  for (let k = 0; k < 6; k++) { const a = k / 6 * PI * 2; M.cyl('metal', rx + Math.sin(a) * 0.62, 2.66, rz + Math.cos(a) * 0.62, 0.015, 0.55, N.YELLOW, 4); }
  M.cyl('metal', rx, 2.67, rz, 0.35, 0.22, N.STEEL, 16);
  M.add('shell', new THREE.IcosahedronGeometry(0.66, 1), { pos: v(rx, 3.45, rz), color: 0xf2f1ec });
  ladder(M, rx + 0.46, rz, 0, 2.6, PI / 2);
  M.colCyl(rx, rz, 0.5, 0, 4.1);
  // ground burner
  const bx = -1.75, bz = -1.45;
  M.box('metal', bx, 0.08, bz, 0.9, 0.16, 0.7, N.STEEL);
  M.cyl('metal', bx + 0.15, 0.16, bz, 0.13, 2.1, 0x8a9096, 12);
  M.cyl('metal', bx + 0.15, 1.6, bz, 0.2, 0.06, N.DARK, 12);
  M.add('emissive', new THREE.CylinderGeometry(0.135, 0.135, 0.12, 12, 1, true), { pos: v(bx + 0.15, 2.2, bz), color: L.orange });
  M.cyl('metal', bx + 0.15, 2.26, bz, 0.16, 0.05, N.DARK, 12);
  M.vent(bx + 0.15, 2.35, bz, { rate: 0.5, size: 0.45, kind: 'heat' });
  M.cyl('shell', bx - 0.22, 0.16, bz, 0.17, 0.9, 0xe8e8e4, 14);
  M.cyl('shell', bx - 0.22, 0.75, bz, 0.175, 0.1, N.ORANGE, 14);
  piping(M, [[bx - 0.22, 1.06, bz], [bx - 0.22, 1.2, bz], [bx + 0.02, 1.2, bz]], 0.025, 0xb8bec4);
  M.col(bx - 0.45, 0, bz - 0.35, bx + 0.45, 2.3, bz + 0.35);
  // store shed with rockets
  M.box('shell', 1.6, 0.7, 1.55, 1.5, 1.4, 1.3, N.SHELL);
  M.box('metal', 1.6, 1.43, 1.55, 1.56, 0.07, 1.36, N.FRAME);
  M.box('metal', 1.6, 0.58, 0.88, 1.0, 1.08, 0.04, 0xc9ccd0);
  for (let k = 1; k < 4; k++) M.box('metal', 1.6, k * 0.27, 0.86, 0.96, 0.025, 0.02, 0x9a9ea2);
  M.col(0.85, 0, 0.9, 2.35, 1.45, 2.2);
  for (let i = 0; i < 2; i++) M.box('metal', 0.2, 0.32 + i * 0.3, 1.6, 0.06, 0.04, 1.2, N.STEEL);
  for (const z of [1.05, 2.15]) M.cyl('metal', 0.2, 0, z, 0.03, 0.7, N.STEEL, 6);
  for (let i = 0; i < 4; i++) {
    const y = 0.4 + Math.floor(i / 2) * 0.3, x = 0.08 + (i % 2) * 0.24;
    M.add('shell', new THREE.CylinderGeometry(0.08, 0.08, 1.0, 12).rotateX(PI / 2), { pos: v(x, y, 1.6), color: 0xeeece6 });
    M.add('shell', new THREE.ConeGeometry(0.08, 0.24, 12).rotateX(-PI / 2), { pos: v(x, y, 0.98), color: N.ORANGE });
  }
}
// dune fixing station (5x5): a checkerboard of straw barriers pressed into
// the sand with marram grass taking hold in the squares, a porous sand fence
// on the windward side, the hydroseeding rig (slurry tank on its skid, pump,
// a spray cannon that sweeps) and its hose reel, rolls of netting and seed
// sacks on pallets
export function dunefixer(M) {
  plinth(M, 5, 5);
  const gx = -0.5, gz = -0.4, W = 3.2, Dd = 3.2, n = 4;
  M.box('regolith', gx, 0.015, gz, W + 0.25, 0.03, Dd + 0.25, 0xc49c6a);
  for (let i = 0; i <= n; i++) {
    M.box('regolith', gx - W / 2 + i * W / n, 0.09, gz, 0.07, 0.15, Dd, 0xb39257);
    M.box('regolith', gx, 0.09, gz - Dd / 2 + i * Dd / n, W, 0.15, 0.07, 0xa98a50);
  }
  const rnd = mulberry32(5);
  for (let i = 0; i < n; i++) for (let k = 0; k < n; k++) {
    if (rnd() < 0.15) continue;
    const cx0 = gx - W / 2 + (i + 0.5) * W / n, cz0 = gz - Dd / 2 + (k + 0.5) * Dd / n;
    for (let t = 0; t < (rnd() < 0.5 ? 2 : 1); t++) {
      const x = cx0 + (rnd() - 0.5) * 0.4, z = cz0 + (rnd() - 0.5) * 0.4, s = 0.7 + rnd() * 0.6;
      for (let j = 0; j < 7; j++) {
        const a = j / 7 * PI * 2 + rnd() * 0.5, tl = 0.2 + rnd() * 0.4, h = (0.32 + rnd() * 0.25) * s;
        M.add('plant', new THREE.ConeGeometry(0.03 * s, h, 3).translate(0, h / 2, 0).rotateX(Math.cos(a) * tl).rotateZ(-Math.sin(a) * tl), { pos: v(x, 0.03, z), color: [0x7a8a3a, 0x8f9a48, 0x6a7a34][j % 3] });
      }
    }
  }
  // porous sand fence along the windward (left) edge
  for (let i = 0; i < 27; i++) M.box('regolith', -2.3, 0.45, -2.05 + i * 0.125, 0.04, 0.9 - (i % 3) * 0.05, 0.06, 0x8f7350);
  for (const y of [0.25, 0.7]) M.box('metal', -2.27, y, -0.4, 0.02, 0.02, 3.4, N.DARK);
  for (let i = 0; i < 4; i++) M.cyl('metal', -2.33, 0, -2.1 + i * 1.12, 0.035, 1.0, N.STEEL, 6);
  M.col(-2.4, 0, -2.1, -2.2, 0.95, 1.3);
  // hydroseeding rig
  const sx = 1.85, sz = -0.35;
  M.box('metal', sx, 0.1, sz, 1.05, 0.2, 2.5, N.STEEL);
  M.add('shell', new THREE.CylinderGeometry(0.45, 0.45, 1.7, 24).rotateX(PI / 2), { pos: v(sx, 0.75, sz + 0.25), color: N.SHELL });
  for (const dz of [-0.85, 0.85]) M.add('shell', new THREE.SphereGeometry(0.45, 20, 8, 0, PI * 2, 0, PI / 2).rotateX(Math.sign(dz) * PI / 2), { pos: v(sx, 0.75, sz + 0.25 + dz), scale: v(1, 1, 0.35), color: N.SHELL2 });
  M.add('shell', new THREE.CylinderGeometry(0.455, 0.455, 0.3, 24, 1, true).rotateX(PI / 2), { pos: v(sx, 0.75, sz + 0.25), color: GREEN });
  for (const dz of [-0.4, 0.8]) M.box('metal', sx, 0.35, sz + dz, 0.7, 0.3, 0.14, N.STEEL);
  M.cyl('metal', sx, 1.2, sz + 0.4, 0.14, 0.12, N.FRAME, 10);
  M.box('metal', sx - 0.25, 0.4, sz - 0.85, 0.4, 0.4, 0.45, 0x3a3f45);
  M.col(sx - 0.5, 0, sz - 1.25, sx + 0.5, 1.25, sz + 1.25);
  M.cyl('metal', sx + 0.15, 0.2, sz - 0.95, 0.12, 0.85, N.STEEL, 10);
  const cannon = M.animGroup('shell', { pivot: [sx + 0.15, 0, sz - 0.95], axis: [0, 1, 0], speed: 0.35 });
  cannon.add(new THREE.CylinderGeometry(0.15, 0.15, 0.2, 12), { pos: v(sx + 0.15, 1.12, sz - 0.95), color: N.SHELL2 });
  cannon.add(new THREE.CylinderGeometry(0.05, 0.08, 0.9, 10).rotateZ(PI / 2 + 0.35), { pos: v(sx - 0.25, 1.32, sz - 0.95), color: N.FRAME });
  cannon.add(new THREE.CylinderGeometry(0.06, 0.04, 0.12, 10).rotateZ(PI / 2 + 0.35), { pos: v(sx - 0.72, 1.48, sz - 0.95), color: N.ORANGE });
  piping(M, [[sx - 0.25, 0.6, sz - 0.85], [sx - 0.25, 0.6, sz - 1.0], [sx + 0.15, 0.6, sz - 1.0]], 0.04, 0x2a2d31);
  // hose reel
  for (const dx of [-0.28, 0.28]) M.add('metal', new THREE.CylinderGeometry(0.36, 0.36, 0.04, 20).rotateZ(PI / 2), { pos: v(sx + dx, 0.5, 1.75), color: N.STEEL });
  M.add('metal', new THREE.CylinderGeometry(0.3, 0.3, 0.52, 18).rotateZ(PI / 2), { pos: v(sx, 0.5, 1.75), color: 0x2f6a3a });
  for (const dx of [-0.32, 0.32]) M.box('metal', sx + dx, 0.25, 1.75, 0.06, 0.5, 0.5, N.STEEL);
  // netting rolls and seed sacks on pallets
  for (const [px, pz] of [[-1.3, 2.05]]) { M.box('metal', px, 0.06, pz, 1.2, 0.12, 0.9, 0x8f7350); for (const dx of [-0.32, 0.32]) M.box('metal', px + dx, 0.03, pz, 0.08, 0.06, 0.9, 0x6f5a40); }
  for (let i = 0; i < 3; i++) M.add('regolith', new THREE.CylinderGeometry(0.2, 0.2, 1.1, 14).rotateZ(PI / 2), { pos: v(-1.3, 0.32 + (i === 2 ? 0.34 : 0), 2.05 + (i === 2 ? 0 : (i - 0.5) * 0.42)), color: [0x2f8f4a, 0x2a7a42, 0x358a50][i] });
  cargoBags(M, 0.2, 1.85, 4, 0);
  M.col(-1.95, 0, 1.6, 0.85, 0.75, 2.5);
}
// soil works (6x6): a rotary drum turning on its riding rings and trunnion
// rollers with the girth gear and drive; the feed hopper and screw lifting
// regolith to the inlet; the microbe culture tank dosing the mix; the
// outlet hood dropping dark soil onto the stacking conveyor and its pile; the
// bagging spout and a pallet of soil sacks
export function soilfactory(M) {
  plinth(M, 6, 6);
  const dz = 0.6, dy = 1.35, dr = 0.82, dl = 3.0;
  for (const x of [-0.95, 0.95]) {
    M.box('concrete', x, 0.25, dz, 0.7, 0.5, 1.5, 0x8f8a84);
    for (const k of [-1, 1]) { M.add('metal', new THREE.CylinderGeometry(0.2, 0.2, 0.22, 16).rotateZ(PI / 2), { pos: v(x, 0.62, dz + k * 0.5), color: N.DARK }); M.box('metal', x, 0.55, dz + k * 0.5, 0.36, 0.14, 0.24, N.STEEL); }
  }
  const drum = M.animGroup('shell', { pivot: [0, dy, dz], axis: [1, 0, 0], speed: 0.5 });
  drum.add(new THREE.CylinderGeometry(dr, dr, dl, 28).rotateZ(PI / 2), { pos: v(0, dy, dz), color: 0xd8d4ca });
  for (const x of [-0.95, 0.95]) drum.add(new THREE.CylinderGeometry(dr + 0.08, dr + 0.08, 0.24, 28).rotateZ(PI / 2), { pos: v(x, dy, dz), color: 0x4a4f55 });
  drum.add(new THREE.CylinderGeometry(dr + 0.13, dr + 0.13, 0.12, 36).rotateZ(PI / 2), { pos: v(0.2, dy, dz), color: 0x2a2d31 });
  for (let k = 0; k < 6; k++) { const a = k / 6 * PI * 2; drum.add(new THREE.BoxGeometry(dl - 0.4, 0.05, 0.1), { pos: v(0, dy + Math.sin(a) * (dr + 0.02), dz + Math.cos(a) * (dr + 0.02)), rot: e(a, 0, 0), color: N.ORANGE }); }
  M.box('metal', 0.2, 0.45, dz - 1.25, 0.6, 0.6, 0.6, 0x3a3f45);
  M.add('metal', new THREE.CylinderGeometry(0.16, 0.16, 0.9, 12).rotateX(PI / 2), { pos: v(0.2, 0.55, dz - 0.75), color: N.DARK });
  M.col(-dl / 2, 0, dz - dr, dl / 2, dy + dr, dz + dr);
  // feed hopper and screw
  hopper(M, -2.35, 2.1, 1.0, 1.4, 1.1, 0x9aa0a6);
  seg(M, [-2.35, 0.75, 1.75], [-1.75, 2.0, dz + 0.15], 0.16, 0xb8bec4, 'metal', 12);
  M.box('metal', -1.6, 1.85, dz, 0.4, 0.5, 0.6, 0x8a9096);
  // microbe culture tank
  tankV(M, -2.3, -0.75, 0.48, 2.0, { y0: 0.25, band: GREEN });
  piping(M, [[-2.3, 2.1, -0.75], [-2.3, 2.45, -0.75], [-1.45, 2.45, dz - 0.2], [-1.45, 2.05, dz - 0.2]], 0.04, 0x2f8f4a);
  // outlet hood, conveyor and pile
  M.box('metal', 1.75, 1.15, dz, 0.5, 1.2, 1.0, 0x8a9096);
  conveyor(M, [1.85, 0.55, dz - 0.4], [2.05, 1.45, -1.75], 0.45);
  heap(M, 2.0, -2.05, 0.95, 0.75, 0.95, 0x3b2a1e, { seed: 31, yaw: 0.3, crest: [0.1, 0.25] });
  // bagging spout and sacks
  M.box('shell', -0.6, 0.9, -1.85, 0.8, 1.8, 0.7, N.SHELL);
  M.box('metal', -0.6, 1.83, -1.85, 0.86, 0.06, 0.76, N.FRAME);
  M.cyl('metal', -0.6, 0.6, -2.3, 0.08, 0.35, N.DARK, 10);
  M.col(-1.0, 0, -2.2, -0.2, 1.85, -1.5);
  M.box('metal', 0.55, 0.06, -2.2, 1.1, 0.12, 0.9, 0x8f7350);
  for (let i = 0; i < 6; i++) M.box('mli', 0.3 + (i % 2) * 0.5, 0.24 + Math.floor(i / 2) * 0.2, -2.2, 0.46, 0.18, 0.8, [0x5a4030, 0x4a3426][i % 2]);
  M.col(0.0, 0, -2.65, 1.1, 0.75, -1.75);
}
// apiary (5x5): pollinators live under glass until the air can be breathed:
// a barrel-vault glasshouse on its curb, a bed of flowering forage and a row
// of hives on stands inside, the airlock vestibule, the air handler with its
// filter fan, the honey room and its drums
export function apiary(M) {
  plinth(M, 5, 5);
  const gx = -0.35, gz = 0.45, len = 3.6, r = 1.35, y0 = 0.35;
  M.box('regolith', gx, y0 + 0.02, gz, len - 0.08, 0.05, 2 * r - 0.1, 0x5a4636);
  M.box('concrete', gx, y0 + 0.05, gz + 0.28, len - 0.25, 0.02, 0.36, 0xb8b2a8);
  // forage bed
  M.box('regolith', gx, y0 + 0.11, gz - 0.55, len - 0.35, 0.14, 0.72, 0x3e3024);
  for (let i = 0; i < 14; i++) {
    const x = gx - len / 2 + 0.38 + (i % 7) * 0.47, z = gz - 0.76 + Math.floor(i / 7) * 0.4;
    M.sphere('plant', x, y0 + 0.3, z, 0.17, LEAF[i % 3], 8, 0.75);
    for (let k = 0; k < 3; k++) M.sphere('plant', x + (k - 1) * 0.08, y0 + 0.43 + (k % 2) * 0.05, z + (k % 2 ? 0.05 : -0.05), 0.055, FLOWER[(i + k) % 5], 6);
  }
  // hives
  for (let i = 0; i < 4; i++) {
    const x = gx - 1.2 + i * 0.8, z = gz + 0.78;
    M.box('metal', x, y0 + 0.17, z, 0.5, 0.05, 0.4, N.STEEL);
    for (const sx of [-1, 1]) M.box('metal', x + sx * 0.21, y0 + 0.08, z, 0.04, 0.16, 0.36, N.STEEL);
    for (let k = 0; k < 2; k++) M.box('shell', x, y0 + 0.32 + k * 0.25, z, 0.46, 0.24, 0.38, HIVE[(i + k) % 4]);
    M.box('metal', x, y0 + 0.71, z, 0.52, 0.05, 0.44, 0x8d939a);
    M.box('metal', x, y0 + 0.22, z - 0.2, 0.26, 0.025, 0.02, N.DARK);
  }
  vault(M, gx, gz, len, r, { y0, ribs: 5 });
  // airlock vestibule
  const vxp = gx - 0.95;
  M.box('shell', vxp, 0.95, gz - r - 0.4, 1.05, 1.9, 0.8, N.SHELL);
  M.box('metal', vxp, 1.92, gz - r - 0.4, 1.12, 0.07, 0.86, N.FRAME);
  M.box('shell', vxp, 1.55, gz - r - 0.4, 1.07, 0.16, 0.82, N.YELLOW);
  hatch(M, vxp, 0.02, gz - r - 0.8, PI, { w: 0.72, h: 1.5, depth: 0.1, label: false });
  M.col(vxp - 0.52, 0, gz - r - 0.8, vxp + 0.52, 1.95, gz - r);
  // air handler at the far end
  const ax = gx + len / 2 + 0.55;
  M.box('shell', ax, 0.62, gz, 0.75, 1.1, 1.1, N.SHELL);
  M.box('metal', ax, 1.2, gz, 0.8, 0.06, 1.15, N.FRAME);
  M.box('metal', gx + len / 2 + 0.09, 0.95, gz, 0.2, 0.32, 0.42, 0x9aa0a6);
  M.add('metal', new THREE.CylinderGeometry(0.34, 0.34, 0.05, 24), { pos: v(ax + 0.39, 0.62, gz), rot: e(0, 0, PI / 2), color: N.DARK });
  M.add('metal', new THREE.TorusGeometry(0.34, 0.03, 5, 24), { pos: v(ax + 0.42, 0.62, gz), rot: e(0, PI / 2, 0), color: N.FRAME });
  const fan = M.animGroup('metal', { pivot: [ax + 0.43, 0.62, gz], axis: [1, 0, 0], speed: 5 });
  for (let k = 0; k < 5; k++) { const t = k / 5 * PI * 2; fan.add(new THREE.BoxGeometry(0.02, 0.28, 0.09), { pos: v(ax + 0.43, 0.62 + Math.cos(t) * 0.15, gz + Math.sin(t) * 0.15), rot: e(t, 0, 0), color: 0x9aa0a6 }); }
  M.col(ax - 0.38, 0, gz - 0.55, ax + 0.45, 1.2, gz + 0.55);
  // honey room and drums
  M.box('shell', 1.55, 0.8, -1.55, 1.25, 1.6, 1.05, N.SHELL);
  M.box('metal', 1.55, 1.63, -1.55, 1.32, 0.07, 1.12, N.FRAME);
  M.box('shell', 1.55, 1.3, -1.55, 1.27, 0.14, 1.07, 0xd99a2b);
  hatch(M, 1.75, 0.02, -2.08, PI, { w: 0.6, h: 1.3, depth: 0.08, label: false });
  M.box('glass', 1.2, 1.05, -2.09, 0.3, 0.32, 0.03);
  M.col(0.92, 0, -2.08, 2.18, 1.65, -1.02);
  for (const [x, z] of [[0.45, -1.95], [0.45, -1.4]]) { M.cyl('steel', x, 0, z, 0.22, 0.62, 0xc9ccd0, 16); M.cyl('shell', x, 0.4, z, 0.225, 0.08, 0xd99a2b, 16); M.cyl('metal', x, 0.62, z, 0.2, 0.03, N.FRAME, 16); }
  M.entry(vxp);
}

// ---------------------------------------------------------------- industry
// logistics relay (3x3): a slim lattice tower carrying a railed landing deck
// with its marked pad, edge lights, a drone set down and the antenna whip;
// the cabinet, battery box and solar panel at its foot; the cable conduit
// and ladder up the tower
export function relay(M) {
  plinth(M, 3, 3);
  const tx = 0.25, tz = 0.25, th = 5.4;
  mast(M, tx, tz, th, 0.5, 0.32);
  ladder(M, tx, tz - 0.58, 0, th, 0);
  M.cyl('metal', tx + 0.36, 0, tz, 0.04, th, N.DARK, 6);
  M.cyl('metal', tx, th, tz, 1.0, 0.1, N.GRATE, 8);
  M.cyl('metal', tx, th - 0.22, tz, 0.45, 0.22, N.STEEL, 8);
  for (let k = 0; k < 8; k++) { const a = (k + 0.5) / 8 * PI * 2; M.cyl('metal', tx + Math.sin(a) * 0.98, th + 0.1, tz + Math.cos(a) * 0.98, 0.02, 0.85, N.YELLOW, 4); M.sphere('emissive', tx + Math.sin(a) * 0.86, th + 0.12, tz + Math.cos(a) * 0.86, 0.035, L.cyan, 6); }
  M.add('metal', new THREE.TorusGeometry(0.98, 0.025, 4, 8), { pos: v(tx, th + 0.95, tz), rot: e(PI / 2, PI / 8, 0), color: N.YELLOW });
  M.add('concrete', new THREE.RingGeometry(0.5, 0.58, 24), { pos: v(tx, th + 0.105, tz), rot: e(-PI / 2, 0, 0), color: N.YELLOW });
  bigDrone(M, tx, th + 0.12, tz, N.SHELL, L.cyan, 0.8);
  M.cyl('metal', tx - 0.75, th + 0.1, tz + 0.3, 0.015, 1.4, N.FRAME, 4);
  M.sphere('blink', tx - 0.75, th + 1.55, tz + 0.3, 0.05, L.red, 6);
  avionics(M, -0.85, 0, -0.9, 0.6, 0.85, 0.5);
  M.box('shell', -0.85, 0.25, 0.85, 0.55, 0.5, 0.45, 0x3a3f45);
  M.box('emissive', -0.85, 0.42, 0.62, 0.3, 0.04, 0.01, L.green);
  M.cyl('metal', 1.0, 0, -1.0, 0.04, 0.8, N.FRAME, 6);
  M.add('solar', new THREE.BoxGeometry(0.9, 0.04, 0.7), { pos: v(1.0, 0.92, -1.0), rot: eo(0.5, -2.4, 0, 'YXZ') });
  M.add('metal', new THREE.BoxGeometry(0.94, 0.03, 0.74), { pos: v(1.0, 0.9, -1.0), rot: eo(0.5, -2.4, 0, 'YXZ'), color: N.FRAME });
  M.col(-1.15, 0, -1.15, -0.55, 0.9, -0.65);
}
// atmospheric water condenser (3x3): a louvred intake tower drawing the moist
// air past chilled plates, its fan shroud on top, the refrigeration unit with
// its radiator, the water tank with a gauge, the drain
export function condenser(M) {
  plinth(M, 3, 3);
  const tx = -0.35, tz = -0.3;
  M.cyl('metal', tx, 0, tz, 0.82, 0.3, N.STEEL, 24);
  M.cyl('shell', tx, 0.3, tz, 0.72, 2.3, N.SHELL2, 28);
  for (let i = 0; i < 9; i++) M.add('metal', new THREE.CylinderGeometry(0.76, 0.8, 0.09, 28, 1, true), { pos: v(tx, 0.62 + i * 0.2, tz), color: 0x9aa3ab });
  for (let k = 0; k < 6; k++) { const a = k / 6 * PI * 2; M.box('metal', tx + Math.sin(a) * 0.8, 1.45, tz + Math.cos(a) * 0.8, 0.07, 2.1, 0.07, N.FRAME, a); }
  M.cyl('shell', tx, 2.6, tz, 0.86, 0.45, N.SHELL, 28);
  M.add('metal', new THREE.TorusGeometry(0.86, 0.04, 5, 28), { pos: v(tx, 3.05, tz), rot: e(PI / 2, 0, 0), color: N.FRAME });
  M.cyl('metal', tx, 2.95, tz, 0.78, 0.02, N.DARK, 28);
  const fan = M.animGroup('metal', { pivot: [tx, 0, tz], axis: [0, 1, 0], speed: 3 });
  for (let k = 0; k < 5; k++) fan.add(new THREE.BoxGeometry(0.7, 0.02, 0.16).translate(0.36, 0, 0), { pos: v(tx, 3.0, tz), rot: e(0.3, k / 5 * PI * 2, 0), color: 0x6b7178 });
  fan.add(new THREE.CylinderGeometry(0.12, 0.12, 0.1, 12), { pos: v(tx, 3.0, tz), color: N.DARK });
  for (const a of [0, PI / 2]) M.box('metal', tx, 3.06, tz, 1.7, 0.03, 0.04, N.FRAME, a);
  M.colCyl(tx, tz, 0.86, 0, 3.05);
  // refrigeration unit
  M.box('shell', 0.95, 0.45, -0.85, 0.7, 0.8, 0.75, N.SHELL);
  M.box('metal', 0.95, 0.88, -0.85, 0.76, 0.06, 0.8, N.FRAME);
  M.add('metal', new THREE.CylinderGeometry(0.24, 0.24, 0.04, 20).rotateX(PI / 2), { pos: v(0.95, 0.45, -1.23), color: N.DARK });
  M.add('metal', new THREE.TorusGeometry(0.24, 0.025, 4, 20), { pos: v(0.95, 0.45, -1.25), color: N.FRAME });
  roofRad(M, 0.95, 0.9, -0.85, 0.65, 0.6, 0);
  piping(M, [[0.6, 0.55, -0.85], [tx + 0.72, 0.55, -0.85], [tx + 0.72, 0.55, tz]], 0.04, 0x3a6aa0);
  M.col(0.6, 0, -1.25, 1.3, 0.9, -0.45);
  // tank
  tankV(M, 0.85, 0.85, 0.45, 1.3, { y0: 0.2, band: BLUE });
  M.box('glass', 0.85 - 0.46, 0.85, 0.85, 0.02, 0.7, 0.07);
  piping(M, [[tx, 0.2, tz + 0.75], [tx, 0.2, 0.85], [0.42, 0.35, 0.85]], 0.05, 0xb8bec4);
}
// steel mill (8x6): the direct-reduction shaft in heat-tinted steel with its
// stiffener rings, two railed platforms and the charging top; the bucket
// elevator lifting ore from its bin; the gas reformer and methane sphere; the
// glowing tap and the casting bed of billets under a gantry crane; the
// off-gas stack
export function steelmill(M) {
  plinth(M, 8, 6);
  const sx = -2.1, sz = 0.6, sr = 0.95, sh = 5.8;
  M.cyl('concrete', sx, 0, sz, 1.25, 0.35, 0x8f8a84, 28);
  M.cyl('steel', sx, 0.35, sz, sr, sh, 0x9a9590, 32);
  M.add('steel', new THREE.ConeGeometry(sr, 0.6, 32), { pos: v(sx, 0.35 + sh + 0.3, sz), color: 0x8a8580 });
  for (let y = 0.9; y < sh; y += 0.8) M.add('metal', new THREE.TorusGeometry(sr + 0.02, 0.045, 4, 32), { pos: v(sx, y, sz), rot: e(PI / 2, 0, 0), color: 0x4a4f55 });
  for (const py of [2.6, 5.0]) {
    M.add('metal', new THREE.RingGeometry(sr, sr + 0.6, 32).rotateX(-PI / 2), { pos: v(sx, py, sz), color: N.GRATE });
    M.add('metal', new THREE.RingGeometry(sr, sr + 0.6, 32).rotateX(PI / 2), { pos: v(sx, py - 0.02, sz), color: N.STEEL });
    M.add('metal', new THREE.TorusGeometry(sr + 0.6, 0.025, 4, 32), { pos: v(sx, py + 1.0, sz), rot: e(PI / 2, 0, 0), color: N.YELLOW });
    for (let k = 0; k < 10; k++) { const a = k / 10 * PI * 2; M.cyl('metal', sx + Math.sin(a) * (sr + 0.6), py, sz + Math.cos(a) * (sr + 0.6), 0.02, 1.0, N.YELLOW, 4); }
    for (let k = 0; k < 4; k++) { const a = k / 4 * PI * 2 + PI / 4; strut(M, [sx + Math.sin(a) * sr, py - 0.6, sz + Math.cos(a) * sr], [sx + Math.sin(a) * (sr + 0.55), py, sz + Math.cos(a) * (sr + 0.55)], 0.06, N.STEEL); }
  }
  ladder(M, sx - sr - 0.45, sz, 0, 5.0, PI / 2);
  M.cyl('metal', sx + 0.3, 0.35 + sh + 0.5, sz, 0.18, 1.2, N.STEEL, 10);
  M.colCyl(sx, sz, sr + 0.6, 0, sh + 1.0);
  // tap and casting bed
  M.box('metal', sx + 0.95, 0.75, sz - 0.65, 0.5, 0.45, 0.45, 0x3a3f45);
  M.box('emissive', sx + 1.21, 0.7, sz - 0.65, 0.02, 0.24, 0.26, 0xff6a10);
  M.box('emissive', sx + 1.5, 0.37, sz - 0.9, 0.6, 0.03, 0.14, 0xff5a10);
  M.light(sx + 1.4, 0.9, sz - 0.9, L.orange, 3, 6);
  const bx = 1.2, bz = -1.6;
  M.box('metal', bx, 0.3, bz, 3.4, 0.2, 1.4, N.STEEL);
  for (const [ux, uz] of C4) M.cyl('metal', bx + ux * 1.6, 0, bz + uz * 0.6, 0.05, 0.3, N.STEEL, 6);
  for (let i = 0; i < 7; i++) M.box(i < 2 ? 'emissive' : 'metal', bx - 1.35 + i * 0.45, 0.48, bz, 0.34, 0.18, 1.2, i < 2 ? (i ? 0xb83a10 : 0xe0581a) : [0x6a6e74, 0x5f6368][i % 2]);
  for (const s of [-1, 1]) { M.box('metal', bx + s * 1.85, 1.6, bz - 0.85, 0.16, 3.2, 0.16, N.YELLOW); M.box('metal', bx + s * 1.85, 1.6, bz + 0.85, 0.16, 3.2, 0.16, N.YELLOW); M.box('metal', bx + s * 1.85, 3.2, bz, 0.18, 0.2, 1.9, N.YELLOW); }
  M.box('metal', bx + 0.3, 3.2, bz, 3.8, 0.24, 0.24, N.YELLOW);
  M.box('metal', bx + 0.3, 2.98, bz, 0.4, 0.3, 0.35, N.DARK);
  M.cyl('metal', bx + 0.3, 1.0, bz, 0.012, 1.85, 0x8a9096, 4);
  M.box('metal', bx + 0.3, 0.95, bz, 0.5, 0.06, 0.25, N.DARK);
  M.col(bx - 1.7, 0, bz - 0.7, bx + 1.7, 0.6, bz + 0.7);
  for (const s of [-1, 1]) for (const k of [-1, 1]) M.col(bx + s * 1.85 - 0.1, 0, bz + k * 0.85 - 0.1, bx + s * 1.85 + 0.1, 3.3, bz + k * 0.85 + 0.1);
  // bucket elevator and ore bin
  const ex = -0.5, ez = 1.75;
  M.box('shell', ex, 3.3, ez, 0.5, 6.6, 0.45, 0xb8bcc0);
  for (let y = 0.6; y < 6.4; y += 1.1) M.box('metal', ex, y, ez, 0.54, 0.06, 0.49, N.FRAME);
  M.box('shell', ex, 6.75, ez, 0.75, 0.5, 0.6, 0xb8bcc0);
  seg(M, [ex - 0.3, 6.7, ez - 0.15], [sx + 0.45, 6.5, sz + 0.35], 0.17, 0xb8bcc0, 'steel', 10);
  hopper(M, 0.75, 2.05, 1.0, 0.9, 1.0, 0x8a8e92);
  M.colCyl(ex, ez, 0.4, 0, 7.0);
  // reformer and methane
  M.box('shell', 2.0, 0.75, 0.75, 1.3, 1.5, 0.9, N.SHELL);
  M.box('metal', 2.0, 1.53, 0.75, 1.36, 0.07, 0.96, N.FRAME);
  for (let i = 0; i < 3; i++) M.box('emissive', 1.65 + i * 0.35, 0.55, 0.29, 0.14, 0.1, 0.01, L.orange);
  M.col(1.35, 0, 0.3, 2.65, 1.55, 1.2);
  sphereTank(M, 3.15, 1.15, 1.85, 0.72, {});
  band(M, 3.15, 1.85, 0.73, 1.05, 0.14, CH4);
  piping(M, [[2.45, 1.15, 1.85], [2.0, 1.15, 1.85], [2.0, 1.15, 1.2]], 0.06, CH4);
  piping(M, [[1.35, 1.0, 0.75], [sx + sr + 0.3, 1.0, 0.75], [sx + sr + 0.3, 1.0, sz], [sx + sr, 1.0, sz]], 0.08, 0xb8bec4);
  // off-gas stack
  const kx = 3.45, kz = -0.15;
  M.cyl('metal', kx, 0, kz, 0.3, 0.3, N.STEEL, 14);
  M.cyl('steel', kx, 0.3, kz, 0.2, 6.2, 0xa7abaf, 14);
  for (const y of [2.0, 4.0, 6.0]) M.add('metal', new THREE.TorusGeometry(0.21, 0.03, 4, 14), { pos: v(kx, y, kz), rot: e(PI / 2, 0, 0), color: N.ORANGE });
  M.vent(kx, 6.6, kz, { rate: 1.0, size: 0.9, kind: 'exhaust' });
  piping(M, [[sx + 0.3, 6.6, sz], [sx + 0.3, 6.9, sz], [kx, 6.9, sz], [kx, 6.9, kz + 0.25], [kx, 6.5, kz]], 0.1, 0x8a8e92);
  M.colCyl(kx, kz, 0.3, 0, 6.5);
}
// robot factory (8x8): a glazed assembly hall where orange arms work over a
// line of robots taking shape, parts racks at the back, a roll-up loading
// door; outside, finished robots stand in their charging docks and one walks
// the striped test pad among cones; rooftop air handling
export function robotics(M) {
  plinth(M, 8, 8);
  const hx = -0.4, hz = 1.15, hw = 6.0, hd = 3.4, hh = 3.0;
  glazedHall(M, hx, hz, hw, hd, hh, { stripe: L.orange });
  // the line inside
  conveyor(M, [hx - 2.5, 0.75, hz + 0.45], [hx + 2.3, 0.75, hz + 0.45], 0.6);
  for (const x of [-1.7, -0.3, 1.1]) robotArm(M, hx + x, 0.16, hz - 0.45, { speed: 0.5 + (x + 2) * 0.1 });
  for (const x of [-2.1, -0.95, 0.4, 1.6]) {
    M.box('shell', hx + x, 1.02, hz + 0.45, 0.42, 0.5, 0.28, 0xffb347);
    M.box('shell', hx + x, 1.4, hz + 0.45, 0.26, 0.22, 0.22, 0xeeece6);
    M.box('emissive', hx + x, 1.41, hz + 0.33, 0.18, 0.04, 0.01, L.cyan);
  }
  for (let i = 0; i < 4; i++) { M.box('metal', hx - 2.2 + i * 1.45, 1.1, hz + 1.3, 1.2, 1.9, 0.35, N.STEEL); for (let k = 0; k < 3; k++) M.box('shell', hx - 2.2 + i * 1.45, 0.55 + k * 0.6, hz + 1.23, 1.1, 0.3, 0.25, [0x7f8a96, N.ORANGE, 0x9aa3ab][(i + k) % 3]); }
  // loading door on the +x end
  M.box('metal', hx + hw / 2 + 0.03, 1.15, hz + 0.2, 0.06, 2.2, 1.8, 0xc9ccd0);
  for (let k = 1; k < 7; k++) M.box('metal', hx + hw / 2 + 0.07, k * 0.31, hz + 0.2, 0.03, 0.025, 1.76, 0x9a9ea2);
  M.box('metal', hx + hw / 2 + 0.08, 2.35, hz + 0.2, 0.22, 0.25, 2.2, N.FRAME);
  M.box('shell', 3.3, 0.8, 2.75, 1.0, 1.6, 1.2, 0x7f8a96);
  M.col(2.8, 0, 2.15, 3.8, 1.6, 3.35);
  // roof plant
  M.box('shell', hx + 1.6, hh + 0.45, hz + 0.6, 1.4, 0.7, 1.1, N.SHELL2);
  M.cyl('metal', hx + 1.6, hh + 0.8, hz + 0.6, 0.35, 0.03, N.DARK, 20);
  M.add('metal', new THREE.TorusGeometry(0.35, 0.03, 4, 20), { pos: v(hx + 1.6, hh + 0.84, hz + 0.6), rot: e(PI / 2, 0, 0), color: N.FRAME });
  roofRad(M, hx - 1.5, hh + 0.12, hz + 0.6, 1.4, 1.0, 0);
  // charging docks with finished robots
  for (let i = 0; i < 4; i++) {
    const x = -3.0 + i * 0.85, z = -1.9;
    M.box('metal', x, 0.03, z, 0.66, 0.06, 0.6, N.STEEL);
    M.box('shell', x, 0.85, z + 0.33, 0.66, 1.7, 0.1, N.SHELL);
    M.box('emissive', x, 1.55, z + 0.27, 0.4, 0.05, 0.01, L.green);
    M.box('metal', x, 0.9, z + 0.27, 0.16, 0.3, 0.02, N.DARK);
    robot(M, x, z - 0.02, 0xffb347);
  }
  M.col(-3.4, 0, -2.25, -0.05, 1.75, -1.5);
  // test pad
  const tx = 2.35, tz = -2.1;
  hazard(M, tx, 0.015, tz - 1.0, 2.2, 0.02, 0.1);
  hazard(M, tx, 0.015, tz + 1.0, 2.2, 0.02, 0.1);
  hazard(M, tx - 1.1, 0.015, tz, 0.1, 0.02, 2.1);
  hazard(M, tx + 1.1, 0.015, tz, 0.1, 0.02, 2.1);
  for (const [x, z] of [[tx - 0.6, tz - 0.5], [tx + 0.5, tz - 0.4], [tx - 0.4, tz + 0.6], [tx + 0.6, tz + 0.55]]) { M.add('shell', new THREE.ConeGeometry(0.1, 0.32, 10), { pos: v(x, 0.16, z), color: N.ORANGE }); M.box('metal', x, 0.01, z, 0.24, 0.02, 0.24, N.DARK); }
  robot(M, tx, tz, 0xffb347);
  M.col(tx - 0.25, 0, tz - 0.2, tx + 0.25, 1.5, tz + 0.2);
  M.entry(hx);
}
// mass driver (14x6): an electromagnetic launch track rising toward the sky:
// a laced box guideway wound with copper drive coils, booster stations
// clamped along it, A-frame pylons; the breech house with a cargo pod in the
// loading cradle and the ore bin that fills it; the capacitor bank and its
// radiators; the aiming ring and lights at the muzzle
export function massdriver(M) {
  plinth(M, 14, 6, { collide: false });
  M.col(-7, -0.45, -3, 7, 0, 3);
  const A = [-4.6, 1.6, 0.3], B = [6.6, 6.3, 0.3];
  const d = [B[0] - A[0], B[1] - A[1], 0], len = Math.hypot(d[0], d[1]), ang = Math.atan2(d[1], d[0]);
  const at = (t, dy = 0, dz = 0) => [A[0] + d[0] * t, A[1] + d[1] * t + dy, A[2] + dz];
  for (const oz of [-0.32, 0.32]) strut(M, at(0, 0, oz), at(1, 0, oz), 0.12, N.FRAME);
  strut(M, at(0, -0.62), at(1, -0.62), 0.26, N.STEEL);
  const n = Math.floor(len / 0.75);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    for (const oz of [-0.32, 0.32]) strut(M, at(t, -0.6, 0), at(Math.min(1, t + 0.5 / n), 0, oz), 0.04, N.STEEL);
  }
  const nc = Math.floor(len / 0.42);
  for (let i = 1; i < nc; i++) M.add('metal', new THREE.TorusGeometry(0.46, i % 4 ? 0.06 : 0.09, 6, 18), { pos: v(...at(i / nc, -0.12)), rot: new THREE.Euler(0, PI / 2, ang, 'ZYX'), color: i % 4 ? 0xb87333 : N.FRAME });
  for (const t of [0.3, 0.55, 0.8]) { const p = at(t, -0.2); M.add('shell', new THREE.BoxGeometry(1.0, 1.1, 1.25), { pos: v(...p), rot: e(0, 0, ang), color: N.SHELL }); M.add('shell', new THREE.BoxGeometry(1.02, 0.18, 1.27), { pos: v(...at(t, 0.15)), rot: e(0, 0, ang), color: N.ORANGE }); }
  for (const t of [0.2, 0.42, 0.64, 0.86]) {
    const p = at(t, -0.75);
    for (const oz of [-1, 1]) { strut(M, [p[0] - 0.35, 0, p[2] + oz * 1.25], [p[0], p[1], p[2] + oz * 0.12], 0.2, N.STEEL); strut(M, [p[0] + 0.35, 0, p[2] + oz * 1.25], [p[0], p[1], p[2] + oz * 0.12], 0.14, N.STEEL); M.box('concrete', p[0], 0.1, p[2] + oz * 1.25, 1.1, 0.2, 0.6, 0x8f8a84); }
    strut(M, [p[0], p[1] * 0.5, p[2] - 0.7], [p[0], p[1] * 0.5, p[2] + 0.7], 0.08, N.STEEL);
    M.col(p[0] - 0.5, 0, p[2] - 1.5, p[0] + 0.5, p[1], p[2] + 1.5);
  }
  // muzzle
  M.add('metal', new THREE.TorusGeometry(0.62, 0.09, 8, 24), { pos: v(...at(1, -0.1)), rot: new THREE.Euler(0, PI / 2, ang, 'ZYX'), color: N.ORANGE });
  M.add('shell', new THREE.CylinderGeometry(0.62, 0.5, 0.5, 24, 1, true), { pos: v(...at(0.985, -0.1)), rot: e(0, 0, ang - PI / 2), color: N.SHELL });
  for (const oz of [-0.6, 0.6]) M.sphere('blink', B[0], B[1] + 0.1, B[2] + oz, 0.07, L.red, 6);
  // breech house, pod and ore bin
  const hx = -5.6, hz = 0.3;
  M.box('shell', hx, 1.2, hz, 2.0, 2.4, 2.2, N.SHELL);
  M.box('metal', hx, 2.44, hz, 2.08, 0.08, 2.28, N.FRAME);
  M.box('shell', hx, 2.0, hz, 2.04, 0.18, 2.24, N.ORANGE);
  hatch(M, hx, 0.02, hz - 1.1, PI, { w: 0.8, h: 1.6, depth: 0.1 });
  M.col(hx - 1.0, 0, hz - 1.1, hx + 1.0, 2.45, hz + 1.1);
  const pod = at(0.04, 0.3);
  M.add('shell', new THREE.CylinderGeometry(0.3, 0.3, 1.0, 18), { pos: v(...pod), rot: e(0, 0, ang - PI / 2), color: 0xf2f0ea });
  M.add('shell', new THREE.SphereGeometry(0.3, 16, 8, 0, PI * 2, 0, PI / 2), { pos: v(pod[0] + Math.cos(ang) * 0.5, pod[1] + Math.sin(ang) * 0.5, pod[2]), rot: e(0, 0, ang - PI / 2), scale: v(1, 1.6, 1), color: N.ORANGE });
  hopper(M, -5.4, -2.15, 1.1, 1.6, 1.0, 0x8a8e92);
  conveyor(M, [-5.4, 1.15, -1.55], [-5.4, 2.6, -0.4], 0.4);
  // capacitor bank and radiators
  for (let i = 0; i < 5; i++) {
    const x = -2.6 + i * 0.95;
    M.box('shell', x, 0.75, -2.35, 0.85, 1.5, 0.8, 0x3a3f45);
    M.box('metal', x, 1.52, -2.35, 0.9, 0.05, 0.85, N.FRAME);
    M.box('emissive', x, 1.3, -1.94, 0.5, 0.05, 0.01, i % 2 ? L.cyan : L.green);
    M.box('shell', x, 0.4, -1.94, 0.6, 0.12, 0.01, N.YELLOW);
  }
  M.col(-3.05, 0, -2.75, 1.2, 1.55, -1.95);
  M.box('metal', -0.7, 1.75, -2.35, 4.6, 0.06, 0.4, N.GRATE);
  for (const x of [-2.6, 1.0]) M.cyl('metal', x, 1.55, -2.35, 0.04, 0.2, N.STEEL, 6);
  for (const x of [2.1, 3.6, 5.1]) radiatorWing(M, x, -2.55, 0, { w: 1.35, h: 2.2, y0: 0.5 });
}
// centre line of a rounded-rectangle plan from the right jamb of a front
// door gap, round the back, to the left jamb (local -z is the front)
function roundPlan(w, d, r, gap) {
  const P = [];
  const line = (x0, z0, x1, z1, m) => { for (let i = 0; i < m; i++) P.push([x0 + (x1 - x0) * i / m, z0 + (z1 - z0) * i / m]); };
  const arc = (cx, cz, a0, a1) => { for (let i = 0; i < 6; i++) { const a = a0 + (a1 - a0) * i / 6; P.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]); } };
  line(gap / 2, -d / 2, w / 2 - r, -d / 2, 2); arc(w / 2 - r, -d / 2 + r, -PI / 2, 0);
  line(w / 2, -d / 2 + r, w / 2, d / 2 - r, 3); arc(w / 2 - r, d / 2 - r, 0, PI / 2);
  line(w / 2 - r, d / 2, -w / 2 + r, d / 2, 4); arc(-w / 2 + r, d / 2 - r, PI / 2, PI);
  line(-w / 2, d / 2 - r, -w / 2, -d / 2 + r, 3); arc(-w / 2 + r, -d / 2 + r, PI, PI * 1.5);
  line(-w / 2 + r, -d / 2, -gap / 2, -d / 2, 2);
  P.push([-gap / 2, -d / 2]);
  return P;
}

// construction yard (8x8): a gantry printer riding its rails over the print
// bed (laced bridge, legs on bogies, the head on its carriage) laying the
// next course of a printed hall: layered regolith walls on a rounded plan
// with the door left open, the top course half laid; the binder silos and
// their feed hose; a laydown of panels and beam bundles; a printing drone on
// its pad; floodlights on the gantry
export function constructionyard(M) {
  plinth(M, 8, 8);
  const cx = -0.5, cz = 0.6;
  M.box('concrete', cx, 0.05, cz, 4.6, 0.1, 4.4, 0x8f8a84);
  // the printed hall in progress
  const pw = 3.4, pd = 2.5, pr = 0.75, t = 0.24, gap = 0.9, pz = cz + 0.15;
  const Po = roundPlan(pw, pd, pr, gap), Pi = roundPlan(pw - 2 * t, pd - 2 * t, pr - t, gap);
  const course = (f) => { const m = Math.max(2, Math.round(f * Po.length)); return new THREE.Shape([...Po.slice(0, m), ...Pi.slice(0, m).reverse()].map(([x, z]) => new THREE.Vector2(x, -z))); };
  const NC = 9;
  for (let k = 0; k <= NC; k++) {
    const f = k < NC ? 1 : 0.34;
    M.add('concrete', new THREE.ExtrudeGeometry(course(f), { depth: 0.105, bevelEnabled: false, curveSegments: 4 }).rotateX(-PI / 2), { pos: v(cx, 0.1 + k * 0.115, pz), color: k % 2 ? 0xa39c92 : 0x968f86 });
  }
  const m = Math.round(0.34 * Po.length) - 1, ex = cx + (Po[m][0] + Pi[m][0]) / 2, ez = pz + (Po[m][1] + Pi[m][1]) / 2, ey = 0.1 + (NC + 1) * 0.115;
  M.col(cx - pw / 2, 0, pz - pd / 2, cx + pw / 2, ey, pz + pd / 2);
  // rails and gantry, standing over the head's position
  const gx = 2.55, gz = ez;
  for (const s of [-1, 1]) {
    M.box('metal', cx + s * gx, 0.08, cz, 0.22, 0.16, 4.6, N.STEEL);
    M.box('metal', cx + s * gx, 0.18, cz, 0.08, 0.05, 4.6, 0x9aa0a6);
    for (let k = 0; k < 7; k++) M.box('metal', cx + s * gx, 0.02, cz - 2.2 + k * 0.73, 0.46, 0.04, 0.16, N.DARK);
    M.box('metal', cx + s * gx, 0.36, gz, 0.4, 0.34, 1.3, N.ORANGE);
    for (const dz of [-0.45, 0.45]) {
      M.box('metal', cx + s * gx, 2.35, gz + dz, 0.22, 3.9, 0.22, N.ORANGE);
      for (let y = 0.8; y < 4.0; y += 0.9) strut(M, [cx + s * gx, y, gz + dz], [cx + s * gx, y + 0.9, gz - dz], 0.06, N.ORANGE);
    }
  }
  for (const dz of [-0.35, 0.35]) M.box('metal', cx, 4.25, gz + dz, gx * 2 + 0.4, 0.16, 0.16, N.ORANGE);
  for (let i = 0; i < 12; i++) { const x0 = cx - gx + i * gx * 2 / 12; strut(M, [x0, 4.25, gz - 0.35], [x0 + gx * 2 / 12, 4.25, gz + 0.35], 0.05, N.ORANGE); }
  M.box('shell', ex, 4.15, gz, 0.6, 0.5, 0.95, N.SHELL);
  M.box('metal', ex, ey + 1.25, gz, 0.16, 4.1 - ey - 1.0, 0.16, N.FRAME);
  M.cyl('metal', ex, ey + 0.05, gz, 0.07, 0.25, N.DARK, 10);
  M.sphere('emissive', ex, ey + 0.05, gz, 0.05, L.orange, 8);
  for (const s of [-1, 1]) { M.box('metal', cx + s * (gx - 0.3), 4.0, gz - 0.45, 0.28, 0.16, 0.12, N.DARK); M.box('emissive', cx + s * (gx - 0.3), 3.92, gz - 0.48, 0.22, 0.01, 0.08, L.white); }
  for (const s of [-1, 1]) M.col(cx + s * gx - 0.2, 0, gz - 0.55, cx + s * gx + 0.2, 4.3, gz + 0.55);
  // binder silos and the feed hose up to the head
  for (const [x, z] of [[-3.3, 3.45], [-2.4, 3.45]]) { tankV(M, x, z, 0.42, 2.8, { y0: 0.4, band: N.ORANGE, color: 0xd9d5cc }); }
  M.tube('metal', [[-2.85, 1.2, 3.3], [-2.85, 3.0, 3.0], [cx - gx, 4.5, gz + 0.6], [ex, 4.5, gz + 0.4], [ex, 4.4, gz]], 0.06, 0x2a2d31, 6);
  // laydown: panels and beam bundles on dunnage
  for (let i = 0; i < 5; i++) M.box('shell', 2.7, 0.12 + i * 0.09, -2.7, 1.6, 0.07, 1.1, i % 2 ? 0xdedbd2 : 0xd0ccc2);
  for (const dz of [-0.4, 0.4]) M.box('metal', 2.7, 0.04, -2.7 + dz, 1.8, 0.08, 0.1, 0x8f7350);
  for (let i = 0; i < 6; i++) M.box('metal', -0.2, 0.12 + Math.floor(i / 3) * 0.13, -3.35 + (i % 3) * 0.14, 2.4, 0.12, 0.12, 0x9aa3ab);
  for (const dx of [-0.9, 0.5]) M.box('metal', -0.2 + dx, 0.03, -3.21, 0.1, 0.06, 0.5, 0x8f7350);
  M.col(1.85, 0, -3.3, 3.55, 0.6, -2.1);
  M.col(-1.4, 0, -3.45, 1.0, 0.35, -2.95);
  // printing drone and pad
  M.cyl('concrete', -2.9, 0, -2.6, 0.7, 0.06, 0x8f8a84, 24);
  M.add('concrete', new THREE.RingGeometry(0.55, 0.62, 24), { pos: v(-2.9, 0.07, -2.6), rot: e(-PI / 2, 0, 0), color: N.YELLOW });
  bigDrone(M, -2.9, 0.07, -2.6, N.ORANGE, L.orange, 1.1);
  M.entry(cx);
}
// maintenance drone base (6x6): the drone hangar in service orange, a raised
// landing deck with a battery-swap station whose arm works, two service
// drones on their pads, a row of parts lockers, a wheeled tool robot, spare
// parts crates in a striped work zone, a beacon mast
export function maintenance(M) {
  plinth(M, 6, 6);
  hangar(M, -1.05, 1.0, 3.0, 3.4, 2.9, 0, { stripe: N.ORANGE });
  M.box('metal', -1.05, 0.02, -1.05, 2.2, 0.03, 0.9, 0x5b6168);
  // landing deck
  const dx = 1.75, dz = 0.55, dy = 1.7;
  grating(M, dx, dy, dz, 2.4, 3.4);
  platformRails(M, dx, dy, dz, 2.4, 3.4, 0, 'left');
  for (const [ux, uz] of C4) strut(M, [dx + ux * 1.1, 0, dz + uz * 1.6], [dx + ux * 0.7, dy - 0.1, dz + uz * 1.0], 0.07, N.STEEL);
  ladder(M, dx + 0.6, dz - 1.75, 0, dy + 0.9, 0);
  for (const z of [dz - 0.85, dz + 0.85]) {
    M.cyl('metal', dx - 0.2, dy, z, 0.5, 0.025, 0x3a3f45, 24);
    M.add('concrete', new THREE.RingGeometry(0.4, 0.45, 24), { pos: v(dx - 0.2, dy + 0.03, z), rot: e(-PI / 2, 0, 0), color: N.ORANGE });
    bigDrone(M, dx - 0.2, dy + 0.1, z, 0xd8661f, L.green, 0.95);
  }
  M.box('shell', dx + 0.85, dy + 0.45, dz, 0.6, 0.9, 0.9, N.SHELL);
  for (let i = 0; i < 3; i++) M.box('shell', dx + 0.54, dy + 0.25 + i * 0.25, dz, 0.02, 0.18, 0.7, [N.ORANGE, 0x3a3f45, N.ORANGE][i]);
  M.box('emissive', dx + 0.54, dy + 0.82, dz, 0.01, 0.06, 0.5, L.green);
  const arm = M.animGroup('shell', { pivot: [dx + 0.85, 0, dz], axis: [0, 1, 0], speed: 0.6 });
  arm.add(new THREE.CylinderGeometry(0.12, 0.14, 0.2, 12), { pos: v(dx + 0.85, dy + 1.0, dz), color: N.SHELL2 });
  gStrut(arm, [dx + 0.85, dy + 1.05, dz], [dx + 0.5, dy + 1.45, dz - 0.3], 0.1, N.ORANGE);
  gStrut(arm, [dx + 0.5, dy + 1.45, dz - 0.3], [dx + 0.15, dy + 1.1, dz - 0.6], 0.08, N.ORANGE);
  arm.add(new THREE.BoxGeometry(0.14, 0.12, 0.14), { pos: v(dx + 0.12, dy + 1.03, dz - 0.62), color: N.DARK });
  // lockers, tool robot, crates
  for (let i = 0; i < 4; i++) {
    const x = -2.4 + i * 0.5;
    M.box('shell', x, 0.85, -2.45, 0.46, 1.7, 0.5, N.SHELL2);
    M.box('shell', x, 0.85, -2.71, 0.4, 1.55, 0.02, i % 2 ? N.ORANGE : 0x8a9096);
    M.box('metal', x + 0.14, 0.95, -2.73, 0.03, 0.2, 0.03, N.DARK);
    M.box('glass', x, 1.4, -2.72, 0.24, 0.16, 0.01);
  }
  M.col(-2.7, 0, -2.75, -0.65, 1.7, -2.2);
  robot(M, 0.15, -1.7, N.ORANGE);
  M.col(-0.1, 0, -1.9, 0.4, 1.5, -1.5);
  hazard(M, 1.6, 0.015, -2.35, 2.4, 0.02, 0.08);
  hazard(M, 1.6, 0.015, -1.35, 2.4, 0.02, 0.08);
  for (const [x, w, h] of [[0.85, 0.6, 0.5], [1.5, 0.55, 0.7], [2.2, 0.7, 0.45]]) { M.box('shell', x, h / 2, -1.85, w, h, 0.6, 0x7f8a96); M.box('metal', x, h + 0.01, -1.85, w + 0.02, 0.02, 0.62, N.FRAME); }
  cargoBags(M, 1.5, -1.75, 2, 0);
  M.col(0.5, 0, -2.2, 2.6, 0.75, -1.5);
  // beacon mast
  M.cyl('metal', -2.7, 0, -0.9, 0.06, 3.6, N.FRAME, 8);
  M.cyl('metal', -2.7, 3.6, -0.9, 0.14, 0.12, N.DARK, 10);
  M.sphere('blink', -2.7, 3.82, -0.9, 0.11, L.orange, 10);
  M.box('shell', -2.7, 2.6, -0.82, 0.3, 0.5, 0.1, N.SHELL);
  M.box('emissive', -2.7, 2.6, -0.76, 0.2, 0.12, 0.01, L.green);
}
// ice mine (5x5): a rodwell: the drill mast over its cased hole with the top
// drive, the boiler skid that sends hot water down and its stack, the
// foil-wrapped meltwater tank with its gauge, the insulated hose reel, ice
// cores laid in a rack, the heated control shelter
export function icemine(M) {
  plinth(M, 5, 5);
  const wx = -1.0, wz = -0.5;
  M.cyl('metal', wx, 0, wz, 0.35, 0.3, N.STEEL, 16);
  M.cyl('metal', wx, 0.3, wz, 0.22, 0.25, N.ORANGE, 14);
  for (const [sx, sz] of C4) strut(M, [wx + sx * 0.75, 0, wz + sz * 0.75], [wx + sx * 0.14, 4.4, wz + sz * 0.14], 0.09, 0xd5d8db);
  for (const y of [1.2, 2.4, 3.5]) { const r = 0.75 - (0.61 * y / 4.4); for (const [a, b] of [[0, 1], [1, 2], [2, 3], [3, 0]]) strut(M, [wx + C4[a][0] * r, y, wz + C4[a][1] * r], [wx + C4[b][0] * r, y, wz + C4[b][1] * r], 0.05, 0xd5d8db); }
  M.box('metal', wx, 4.5, wz, 0.5, 0.3, 0.5, N.DARK);
  M.box('shell', wx, 3.2, wz, 0.42, 0.55, 0.42, N.ORANGE);
  M.cyl('metal', wx, 0.55, wz, 0.06, 2.4, 0x9aa0a6, 8);
  M.sphere('blink', wx, 4.75, wz, 0.07, L.red, 6);
  M.colCyl(wx, wz, 0.7, 0, 4.5);
  // boiler skid
  const bx = 1.15, bz = -1.3;
  M.box('metal', bx, 0.1, bz, 2.0, 0.2, 1.0, N.STEEL);
  M.add('shell', new THREE.CylinderGeometry(0.4, 0.4, 1.5, 22).rotateZ(PI / 2), { pos: v(bx - 0.1, 0.7, bz), color: N.SHELL });
  for (const s of [-1, 1]) M.add('shell', new THREE.SphereGeometry(0.4, 18, 8, 0, PI * 2, 0, PI / 2).rotateZ(-s * PI / 2), { pos: v(bx - 0.1 + s * 0.75, 0.7, bz), scale: v(0.35, 1, 1), color: N.SHELL2 });
  M.add('shell', new THREE.CylinderGeometry(0.405, 0.405, 0.24, 22, 1, true).rotateZ(PI / 2), { pos: v(bx - 0.1, 0.7, bz), color: 0xc9302a });
  M.box('metal', bx + 0.8, 0.55, bz, 0.35, 0.7, 0.6, 0x3a3f45);
  M.box('emissive', bx + 0.98, 0.5, bz, 0.01, 0.16, 0.24, L.orange);
  M.cyl('metal', bx - 0.5, 1.05, bz, 0.09, 1.3, 0x8a9096, 10);
  M.vent(bx - 0.5, 2.4, bz, { rate: 0.8, size: 0.6 });
  M.col(bx - 1.0, 0, bz - 0.5, bx + 1.0, 1.15, bz + 0.5);
  piping(M, [[bx - 0.85, 0.7, bz + 0.25], [wx + 0.45, 0.7, bz + 0.25], [wx + 0.45, 0.45, wz], [wx + 0.2, 0.45, wz]], 0.06, 0xc9302a);
  // meltwater tank
  tankV(M, 1.45, 1.35, 0.55, 2.0, { y0: 0.25, band: BLUE, key: 'foil', color: 0xd8a640 });
  M.box('glass', 1.45 - 0.56, 1.3, 1.35, 0.03, 1.1, 0.08);
  piping(M, [[wx, 0.6, wz + 0.25], [wx, 0.6, 1.0], [0.95, 0.6, 1.0]], 0.05, 0x3a6aa0);
  // insulated hose reel
  for (const dz of [-0.3, 0.3]) { M.add('metal', new THREE.CylinderGeometry(0.5, 0.5, 0.05, 24).rotateX(PI / 2), { pos: v(-1.75, 0.65, 1.55 + dz), color: N.STEEL }); M.box('metal', -1.75, 0.32, 1.55 + dz, 0.55, 0.64, 0.08, N.STEEL); }
  M.add('metal', new THREE.CylinderGeometry(0.42, 0.42, 0.56, 20).rotateX(PI / 2), { pos: v(-1.75, 0.65, 1.55), color: 0xd8661f });
  M.col(-2.3, 0, 1.2, -1.2, 1.15, 1.9);
  // core rack
  M.box('metal', 0.1, 0.5, 1.95, 1.4, 0.05, 0.5, N.STEEL);
  for (const [sx, sz] of C4) M.cyl('metal', 0.1 + sx * 0.65, 0, 1.95 + sz * 0.2, 0.025, 0.5, N.STEEL, 6);
  for (let i = 0; i < 4; i++) M.add('shell', new THREE.CylinderGeometry(0.06, 0.06, 1.2, 12).rotateZ(PI / 2), { pos: v(0.1, 0.59, 1.8 + i * 0.1), color: [0xdfeef6, 0xcfe4f0, 0xe8f2f8, 0xc4dcea][i] });
  // control shelter
  M.box('shell', -1.8, 0.75, -1.85, 1.1, 1.5, 0.9, N.SHELL);
  M.box('metal', -1.8, 1.53, -1.85, 1.16, 0.07, 0.96, N.FRAME);
  M.box('shell', -1.8, 1.2, -1.85, 1.12, 0.14, 0.92, 0xc9302a);
  M.box('glass', -1.5, 0.95, -2.31, 0.32, 0.3, 0.02);
  roofRad(M, -1.8, 1.56, -1.85, 0.8, 0.6, 0);
  M.col(-2.35, 0, -2.3, -1.25, 1.55, -1.4);
}
// evaporation salt works (8x8): four lined pans stepped through the
// evaporation stages (fresh brine, concentrating green, the pink of the
// halophile bloom, the white crust being harvested), earth berms with a
// walkway, the brine pump station and its feed main, a harvester at work in
// the crust pan, the radial stacker building the white stockpile
export function saltworks(M) {
  plinth(M, 8, 8);
  const PANS = [[-2.0, -1.6, 'water', 0x1b5e6e], [1.0, -1.6, 'concrete', 0x3f9a7e], [-2.0, 1.5, 'concrete', 0xd9788f], [1.0, 1.5, 'crust', 0xf4f1ea]];
  const pw = 2.7, pd = 2.6;
  for (const [x, z, kind, col] of PANS) {
    M.box('regolith', x, 0.11, z - pd / 2 - 0.12, pw + 0.48, 0.22, 0.24, 0x8a6e58);
    M.box('regolith', x, 0.11, z + pd / 2 + 0.12, pw + 0.48, 0.22, 0.24, 0x8a6e58);
    for (const k of [-1, 1]) M.box('regolith', x + k * (pw / 2 + 0.12), 0.11, z, 0.24, 0.22, pd, 0x8a6e58);
    M.box('metal', x, 0.02, z, pw, 0.04, pd, 0x2a2c2f);
    if (kind === 'crust') {
      M.box('concrete', x, 0.07, z, pw - 0.02, 0.06, pd - 0.02, col);
      for (let i = 0; i < 7; i++) M.box('concrete', x - pw / 2 + 0.3 + i * 0.36, 0.105, z, 0.05, 0.012, pd - 0.2, 0xd8d2c8);
    } else if (kind === 'water') M.box('water', x, 0.07, z, pw - 0.02, 0.04, pd - 0.02);
    else {
      M.box('concrete', x, 0.06, z, pw - 0.02, 0.04, pd - 0.02, col);
      for (let i = 0; i < 5; i++) M.box('concrete', x, 0.082, z - pd / 2 + 0.3 + i * 0.5, pw - 0.3, 0.004, 0.18, col === 0xd9788f ? 0xe6a0ae : 0x5fb497);
    }
    M.col(x - pw / 2 - 0.24, 0, z - pd / 2 - 0.24, x + pw / 2 + 0.24, 0.22, z + pd / 2 + 0.24, { walk: true });
  }
  // walkway on the middle berm
  grating(M, -0.5, 0.25, -0.05, 0.5, 6.0);
  // pump station and feed main
  const px = -3.25, pz = -3.35;
  M.box('shell', 3.3, 0.75, -3.05, 1.3, 1.5, 1.2, N.SHELL);
  M.box('metal', 3.3, 1.53, -3.05, 1.36, 0.07, 1.26, N.FRAME);
  M.box('shell', 3.3, 1.2, -3.05, 1.32, 0.14, 1.22, BLUE);
  hatch(M, 3.3, 0.02, -2.45, 0, { w: 0.6, h: 1.3, depth: 0.08, label: false });
  M.col(2.65, 0, -3.65, 3.95, 1.55, -2.45);
  M.cyl('metal', 3.3, 0, -1.55, 0.22, 0.6, N.STEEL, 14);
  M.cyl('metal', 3.3, 0.6, -1.55, 0.3, 0.08, N.ORANGE, 14);
  M.colCyl(3.3, -1.55, 0.3, 0, 0.7);
  piping(M, [[3.55, 0.4, -1.55], [3.75, 0.4, -1.55], [3.75, 0.4, -2.45]], 0.06, 0xb8bec4);
  piping(M, [[2.65, 0.45, -3.4], [-2.0, 0.45, -3.4], [-2.0, 0.3, -2.95]], 0.07, 0x3a6aa0);
  for (const x of [1.6, -0.5]) M.box('metal', x, 0.19, -3.4, 0.14, 0.38, 0.14, N.STEEL);
  void px; void pz;
  // harvester in the crust pan
  const hx = 0.7, hz = 1.35;
  M.box('shell', hx, 0.55, hz, 0.9, 0.5, 1.3, N.YELLOW);
  M.box('shell', hx + 0.1, 1.05, hz + 0.25, 0.6, 0.5, 0.6, N.YELLOW);
  M.box('glass', hx + 0.1, 1.1, hz + 0.25, 0.62, 0.36, 0.62);
  for (const k of [-1, 1]) M.box('metal', hx + k * 0.5, 0.25, hz, 0.22, 0.32, 1.4, N.DARK);
  M.add('metal', new THREE.CylinderGeometry(0.18, 0.18, 1.3, 14).rotateZ(PI / 2), { pos: v(hx, 0.3, hz - 0.85), color: 0x9aa0a6 });
  M.box('metal', hx, 0.5, hz - 0.85, 1.35, 0.06, 0.3, N.STEEL);
  M.col(hx - 0.7, 0, hz - 1.0, hx + 0.7, 1.3, hz + 0.7);
  // stacker and stockpile
  const sx = 3.3, sz = 1.9;
  heap(M, sx, sz, 0.72, 0.62, 0.9, 0xf2f0ea, { seed: 41, yaw: -0.5, crest: [-0.2, -0.15], clods: 5 });
  conveyor(M, [1.85, 0.35, 0.9], [sx - 0.25, 1.3, sz - 0.2], 0.42);
  M.box('metal', sx - 0.2, 1.24, sz - 0.15, 0.3, 0.12, 0.3, N.DARK);
  lightPole(M, -3.6, 3.6, 3.4, PI * 0.75);
}
// sand glass works (6x6): the melting furnace in refractory brick held by
// steel buckstays and tie rods, its ports glowing, the flue stack; the sand
// silo and batch conveyor feeding the doghouse; the annealing lehr carrying
// the glass ribbon out onto the roller table; racks of finished sheets; the
// pile of washed sand
export function sandglass(M) {
  plinth(M, 6, 6);
  const fx = -1.1, fz = 0.25, fw = 2.2, fd = 1.7;
  M.box('concrete', fx, 0.1, fz, fw + 0.3, 0.2, fd + 0.3, 0x8f8a84);
  M.box('brick', fx, 0.95, fz, fw, 1.5, fd, 0xa9684a);
  M.add('brick', new THREE.CylinderGeometry(fd / 2, fd / 2, fw, 18, 1, false, 0, PI).rotateZ(PI / 2).scale(1, 0.45, 1), { pos: v(fx, 1.7, fz), color: 0x9a5c40 });
  for (let i = 0; i < 5; i++) for (const k of [-1, 1]) M.box('metal', fx - fw / 2 + 0.2 + i * (fw - 0.4) / 4, 1.05, fz + k * (fd / 2 + 0.08), 0.12, 1.95, 0.12, 0x2f3338);
  for (let i = 0; i < 5; i++) M.add('metal', new THREE.CylinderGeometry(0.025, 0.025, fd + 0.35, 6).rotateX(PI / 2), { pos: v(fx - fw / 2 + 0.2 + i * (fw - 0.4) / 4, 2.05, fz), color: 0x2f3338 });
  for (const x of [fx - 0.6, fx, fx + 0.6]) {
    M.box('metal', x, 0.95, fz - fd / 2 - 0.02, 0.36, 0.3, 0.04, N.DARK);
    M.box('emissive', x, 0.95, fz - fd / 2 - 0.045, 0.24, 0.18, 0.01, 0xff7a20);
  }
  M.light(fx, 1.0, fz - fd / 2 - 0.6, L.orange, 2.5, 6);
  M.col(fx - fw / 2, 0, fz - fd / 2, fx + fw / 2, 2.1, fz + fd / 2);
  // flue stack
  M.cyl('concrete', -2.35, 0, 1.75, 0.42, 0.25, 0x8f8a84, 16);
  M.cyl('steel', -2.35, 0.25, 1.75, 0.3, 4.4, 0xa7abaf, 18);
  for (const y of [1.2, 2.4, 3.6]) M.add('metal', new THREE.TorusGeometry(0.31, 0.035, 4, 18), { pos: v(-2.35, y, 1.75), rot: e(PI / 2, 0, 0), color: N.FRAME });
  M.cyl('metal', -2.35, 4.6, 1.75, 0.34, 0.12, N.DARK, 18);
  ladder(M, -2.35, 1.42, 0.3, 4.4, 0);
  piping(M, [[fx - 0.6, 1.5, fz + fd / 2], [-2.35, 1.5, fz + fd / 2], [-2.35, 1.5, 1.45]], 0.16, 0x8a8e92);
  M.vent(-2.35, 4.75, 1.75, { rate: 0.7, size: 0.8, kind: 'heat' });
  M.colCyl(-2.35, 1.75, 0.42, 0, 4.7);
  // sand silo, batch conveyor, doghouse
  hopper(M, -2.25, -1.85, 0.9, 1.3, 1.6, 0xc9ccd0);
  conveyor(M, [-2.25, 0.55, -1.2], [-2.45, 1.75, -0.05], 0.38);
  M.box('metal', -2.4, 1.35, fz, 0.4, 0.5, 0.7, 0x3a3f45);
  // annealing lehr and the ribbon
  const lx0 = fx + fw / 2, lx1 = 2.25;
  M.box('shell', (lx0 + lx1) / 2, 0.75, fz, lx1 - lx0, 0.75, 0.95, N.SHELL);
  M.box('metal', (lx0 + lx1) / 2, 1.15, fz, lx1 - lx0 + 0.05, 0.06, 1.0, N.FRAME);
  for (let i = 0; i < 5; i++) M.cyl('metal', lx0 + 0.3 + i * 0.45, 1.18, fz, 0.07, 0.18, N.DARK, 8);
  for (let i = 0; i < 4; i++) M.box('metal', lx0 + 0.2 + i * 0.6, 0.18, fz, 0.08, 0.36, 0.9, N.STEEL);
  M.box('emissive', lx0 + 0.02, 0.62, fz, 0.02, 0.2, 0.7, 0xff9a40);
  M.col(lx0, 0, fz - 0.48, lx1, 1.15, fz + 0.48);
  for (let i = 0; i < 6; i++) M.add('metal', new THREE.CylinderGeometry(0.04, 0.04, 0.95, 8).rotateX(PI / 2), { pos: v(lx1 + 0.08 + i * 0.11, 0.55, fz), color: 0x9aa0a6 });
  for (const k of [-1, 1]) M.box('metal', lx1 + 0.35, 0.28, fz + k * 0.48, 0.75, 0.55, 0.06, N.STEEL);
  M.box('window', lx1 + 0.3, 0.6, fz, 0.8, 0.012, 0.85);
  // racks of finished sheets
  for (const [x, z] of [[0.25, -1.9], [1.65, -1.9]]) {
    M.box('metal', x, 0.06, z, 1.25, 0.12, 0.8, N.STEEL);
    for (const k of [-1, 1]) strut(M, [x + k * 0.55, 0.1, z - 0.3], [x + k * 0.55, 1.2, z], 0.06, N.STEEL), strut(M, [x + k * 0.55, 0.1, z + 0.3], [x + k * 0.55, 1.2, z], 0.06, N.STEEL);
    M.box('metal', x, 1.2, z, 1.2, 0.05, 0.05, N.STEEL);
    for (const k of [-1, 1]) for (let i = 0; i < 4; i++) M.add('window', new THREE.BoxGeometry(1.05, 0.95, 0.012).rotateX(k * (0.2 + i * 0.03)), { pos: v(x, 0.64, z + k * (0.1 + i * 0.045)) });
    M.col(x - 0.62, 0, z - 0.4, x + 0.62, 1.25, z + 0.4);
  }
  heap(M, 1.45, 2.05, 1.05, 0.72, 0.62, 0xdcc9a0, { seed: 51, yaw: 0.2, crest: [-0.3, 0.1] });
}
// fumarole sulphur collector (5x5): a fuming vent in a mound of altered rock
// crusted yellow with sulphur, the collection hood on three legs with its
// insulated duct, the finned condenser where the vapour drops its sulphur,
// the trough to the casting moulds, a pallet of cast blocks, the gas monitor
// mast with its windsock, the control cabinet
export function sulfurvent(M) {
  plinth(M, 5, 5);
  const vx = -0.75, vz = -0.25;
  const mound = new THREE.IcosahedronGeometry(1.3, 2), P = mound.attributes.position;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i), r = Math.hypot(x, z);
    const k = 1 + 0.12 * Math.sin(x * 3.7 + z * 2.9) + 0.07 * Math.cos(z * 5.1 - x * 1.3);
    let yy = Math.max(-0.1, y) * 0.34 * k;
    if (r < 0.42 && y > 0) yy -= (0.42 - r) * 0.55;
    P.setXYZ(i, x * k, yy, z * k);
  }
  mound.computeVertexNormals();
  M.add('regolith', mound, { pos: v(vx, 0.02, vz), color: 0x75604a });
  const rnd = mulberry32(13);
  for (let i = 0; i < 26; i++) {
    const a = rnd() * PI * 2, rr = 0.3 + rnd() * 0.85, h = 0.44 * Math.max(0, 1 - (rr / 1.35) ** 2) + 0.03;
    M.sphere('regolith', vx + Math.cos(a) * rr, h, vz + Math.sin(a) * rr, 0.08 + rnd() * 0.14, [0xe8cf3a, 0xd9b82a, 0xf0dc6a, 0xc9a832][i % 4], 7, 0.35);
  }
  for (let i = 0; i < 8; i++) { const a = i * 0.8, rr = 0.36 + (i % 3) * 0.05; M.add('shell', new THREE.ConeGeometry(0.035, 0.18, 4).rotateX(0.3).rotateY(a), { pos: v(vx + Math.cos(a) * rr, 0.32, vz + Math.sin(a) * rr), color: 0xf2de5a }); }
  M.vent(vx, 0.45, vz, { rate: 1.3, size: 1.0 });
  M.colCyl(vx, vz, 1.25, 0, 0.5);
  // hood and duct
  M.add('metal', new THREE.CylinderGeometry(0.24, 0.95, 0.75, 24, 1, true), { pos: v(vx, 1.45, vz), color: 0x8a9096 });
  M.add('metal', new THREE.TorusGeometry(0.95, 0.05, 6, 28), { pos: v(vx, 1.08, vz), rot: e(PI / 2, 0, 0), color: N.FRAME });
  for (let k = 0; k < 3; k++) { const a = k / 3 * PI * 2 + 0.4; strut(M, [vx + Math.cos(a) * 1.4, 0, vz + Math.sin(a) * 1.4], [vx + Math.cos(a) * 0.92, 1.1, vz + Math.sin(a) * 0.92], 0.08, N.STEEL); M.box('metal', vx + Math.cos(a) * 1.4, 0.04, vz + Math.sin(a) * 1.4, 0.3, 0.08, 0.3, N.DARK); }
  const cx = 1.35, cz = -0.75;
  piping(M, [[vx, 1.8, vz], [vx, 2.45, vz], [cx, 2.45, vz], [cx, 2.45, cz], [cx, 2.2, cz]], 0.16, 0xc9cdd1);
  // condenser
  M.cyl('metal', cx, 0, cz, 0.55, 0.3, N.STEEL, 20);
  M.cyl('steel', cx, 0.3, cz, 0.42, 1.8, 0xb9bdc1, 24);
  for (let i = 0; i < 9; i++) M.cyl('metal', cx, 0.45 + i * 0.18, cz, 0.6, 0.03, 0x8a9096, 24);
  M.add('steel', new THREE.ConeGeometry(0.42, 0.25, 24), { pos: v(cx, 2.22, cz), color: 0xb9bdc1 });
  M.colCyl(cx, cz, 0.6, 0, 2.3);
  // trough and moulds
  M.box('metal', cx, 0.18, 0.15, 0.3, 0.16, 1.4, N.STEEL);
  M.box('shell', cx, 0.24, 0.15, 0.2, 0.04, 1.36, 0xd88a2a);
  for (let i = 0; i < 6; i++) {
    const mx = 0.75 + (i % 3) * 0.55, mz = 1.05 + Math.floor(i / 3) * 0.55;
    M.box('metal', mx, 0.08, mz, 0.46, 0.16, 0.46, 0x5b6168);
    M.box('shell', mx, 0.12 + (i % 3) * 0.02, mz, 0.38, 0.06, 0.38, i < 4 ? 0xe8cf3a : 0xd88a2a);
  }
  M.col(0.45, 0, 0.75, 2.1, 0.2, 1.85);
  for (let k = 0; k < 3; k++) for (let i = 0; i < 6; i++) M.box('shell', -1.75 + (i % 3) * 0.38, 0.16 + k * 0.19, 1.75 + Math.floor(i / 3) * 0.26 + (k % 2) * 0.04, 0.36, 0.18, 0.24, [0xe8cf3a, 0xdcc232][(i + k) % 2]);
  M.box('metal', -1.37, 0.04, 1.88, 1.25, 0.08, 0.65, 0x8f7350);
  M.col(-2.0, 0, 1.55, -0.75, 0.75, 2.2);
  // gas monitor mast and windsock, control cabinet
  M.cyl('metal', 2.1, 0, 1.95, 0.05, 2.6, N.FRAME, 8);
  M.box('shell', 2.1, 1.4, 1.85, 0.3, 0.4, 0.2, N.SHELL);
  M.box('emissive', 2.1, 1.48, 1.74, 0.16, 0.06, 0.01, L.green);
  M.add('shell', new THREE.CylinderGeometry(0.12, 0.05, 0.7, 10, 1, true).rotateZ(PI / 2), { pos: v(1.72, 2.5, 1.95), color: N.ORANGE });
  M.add('shell', new THREE.CylinderGeometry(0.105, 0.085, 0.2, 10, 1, true).rotateZ(PI / 2), { pos: v(1.66, 2.5, 1.95), color: 0xf2f2f2 });
  M.sphere('blink', 2.1, 2.68, 1.95, 0.06, L.red, 6);
  M.box('shell', -1.95, 0.7, -1.85, 0.8, 1.4, 0.6, N.SHELL);
  M.box('metal', -1.95, 1.43, -1.85, 0.86, 0.06, 0.66, N.FRAME);
  M.box('shell', -1.95, 1.1, -1.85, 0.82, 0.12, 0.62, N.YELLOW);
  M.box('emissive', -1.95, 0.85, -2.16, 0.36, 0.18, 0.01, L.cyan);
  M.col(-2.35, 0, -2.15, -1.55, 1.45, -1.55);
}
// meteorite works (6x6): an iron-nickel mass sitting in its own small crater,
// thumbprinted by its fall and sawn open on one side to bright metal; the
// wire saw on its frame; a tracked excavator with a magnet grab loading the
// ore skip; sawn slices standing in a rack
export function meteorite(M) {
  plinth(M, 6, 6);
  const mx = -0.75, mz = 0.45;
  heap(M, mx, mz, 2.25, 2.05, 0.42, 0x6a5444, { seed: 61, yaw: 0.7, profile: 'rim', clods: 12 });
  // the mass: a lumpy body with regmaglypt dimples, cut flat on +x
  let met = new THREE.IcosahedronGeometry(1.0, 4);
  met.deleteAttribute('normal'); met.deleteAttribute('uv'); met = mergeVertices(met);
  const P = met.attributes.position, rnd = mulberry32(9);
  const dim = Array.from({ length: 30 }, () => { const u = rnd() * 2 - 1, a = rnd() * PI * 2, s = Math.sqrt(1 - u * u); return [s * Math.cos(a), u, s * Math.sin(a), 0.16 + rnd() * 0.14]; });
  const n = v(0, 0, 0);
  for (let i = 0; i < P.count; i++) {
    n.set(P.getX(i), P.getY(i), P.getZ(i)).normalize();
    let k = 1 + 0.13 * Math.sin(n.x * 3.1 + n.z * 2.2) + 0.08 * Math.cos(n.y * 4.0 + n.x * 1.7);
    for (const [dx, dy, dz, r] of dim) { const d = Math.hypot(n.x - dx, n.y - dy, n.z - dz); if (d < r) k -= 0.06 * Math.cos(d / r * PI / 2) ** 2; }
    P.setXYZ(i, n.x * k * 1.35, n.y * k * 0.95, Math.max(-0.8, n.z * k * 1.15));
  }
  met.computeVertexNormals();
  M.add('regolith', met, { pos: v(mx, 0.55, mz), color: 0x2f2a27 });
  M.add('steel', new THREE.CircleGeometry(1, 36).rotateY(PI).scale(0.86, 0.6, 1), { pos: v(mx, 0.52, mz - 0.805), color: 0xd6dadc });
  for (let i = 0; i < 5; i++) M.add('steel', new THREE.BoxGeometry(1.2 - Math.abs(i - 2) * 0.25, 0.012, 0.004).rotateZ(0.5 + i * 0.13), { pos: v(mx - 0.2 + i * 0.1, 0.5 + (i - 2) * 0.09, mz - 0.81), color: 0xa9adb0 });
  M.colCyl(mx, mz, 1.25, 0, 1.4);
  // wire saw frame cutting the next slice
  const sawZ = mz - 0.42;
  for (const dx of [-1.55, 1.55]) { M.box('metal', mx + dx, 1.35, sawZ, 0.22, 2.7, 0.22, N.YELLOW); M.box('metal', mx + dx, 0.05, sawZ, 0.6, 0.1, 0.6, N.DARK); }
  M.box('metal', mx, 2.75, sawZ, 3.35, 0.24, 0.26, N.YELLOW);
  for (const dx of [-1.25, 1.25]) { M.add('metal', new THREE.CylinderGeometry(0.22, 0.22, 0.08, 18).rotateX(PI / 2), { pos: v(mx + dx, 2.45, sawZ), color: N.DARK }); seg(M, [mx + dx, 2.3, sawZ], [mx + dx * 0.55, 1.2, sawZ], 0.012, 0x9aa0a6, 'metal', 4); }
  seg(M, [mx - 0.69, 1.2, sawZ], [mx + 0.69, 1.2, sawZ], 0.012, 0x9aa0a6, 'metal', 4);
  M.box('metal', mx, 2.45, sawZ, 0.6, 0.3, 0.4, N.DARK);
  M.col(mx - 1.7, 0, sawZ - 0.15, mx - 1.4, 2.85, sawZ + 0.15);
  M.col(mx + 1.4, 0, sawZ - 0.15, mx + 1.7, 2.85, sawZ + 0.15);
  // excavator with magnet grab
  const ex = 1.75, ez = 1.0, yaw = 0.55;
  const c = Math.cos(yaw), s = Math.sin(yaw), W = (lx, lz) => [ex + lx * c + lz * s, ez - lx * s + lz * c];
  for (const k of [-1, 1]) { const [x, z] = W(k * 0.45, 0); M.box('metal', x, 0.22, z, 0.32, 0.44, 1.6, N.DARK, yaw); for (const d of [-0.8, 0.8]) { const [x2, z2] = W(k * 0.45, d); M.add('metal', new THREE.CylinderGeometry(0.22, 0.22, 0.32, 14).rotateZ(PI / 2).rotateY(yaw), { pos: v(x2, 0.22, z2), color: N.DARK }); } }
  M.box('metal', ex, 0.5, ez, 0.8, 0.14, 0.8, N.STEEL, yaw);
  const [bx, bz] = W(0, 0.1);
  M.box('shell', bx, 0.9, bz, 1.05, 0.6, 1.2, N.YELLOW, yaw);
  const [kx, kz] = W(0.3, -0.25);
  M.box('shell', kx, 1.45, kz, 0.48, 0.6, 0.55, N.YELLOW, yaw);
  M.box('glass', kx, 1.5, kz, 0.5, 0.42, 0.57, undefined, yaw);
  const [wx, wz] = W(0, 0.62);
  M.box('metal', wx, 0.85, wz, 1.0, 0.45, 0.25, N.DARK, yaw);
  const [b0x, b0z] = W(-0.2, -0.55), [b1x, b1z] = W(-0.2, -1.7), [b2x, b2z] = W(-0.2, -2.25);
  strut(M, [b0x, 1.05, b0z], [b1x, 2.45, b1z], 0.2, N.YELLOW);
  strut(M, [b1x, 2.45, b1z], [b2x, 1.35, b2z], 0.15, N.YELLOW);
  seg(M, [b0x, 0.9, b0z], [b1x, 2.1, b1z], 0.05, N.FRAME);
  M.cyl('metal', b2x, 1.05, b2z, 0.36, 0.16, 0x2a2d31, 20);
  M.cyl('metal', b2x, 1.21, b2z, 0.1, 0.14, N.DARK, 10);
  M.col(ex - 0.85, 0, ez - 0.85, ex + 0.85, 1.8, ez + 0.85);
  // ore skip with broken metal
  const sx = 1.55, sz = -1.75;
  M.box('metal', sx, 0.45, sz, 1.4, 0.8, 1.0, 0x5b6168);
  for (const k of [-1, 1]) M.add('metal', new THREE.BoxGeometry(0.1, 0.85, 1.05).rotateZ(k * 0.25), { pos: v(sx + k * 0.74, 0.45, sz), color: 0x4a4f55 });
  for (let i = 0; i < 8; i++) M.add('metal', new THREE.IcosahedronGeometry(0.14 + (i % 3) * 0.04, 0), { pos: v(sx - 0.45 + (i % 4) * 0.3, 0.88, sz - 0.2 + Math.floor(i / 4) * 0.38), rot: e(i, i * 2, 0), color: [0x4a4440, 0x6a6460, 0x3d3430][i % 3] });
  M.col(sx - 0.8, 0, sz - 0.55, sx + 0.8, 0.9, sz + 0.55);
  // sawn slices in a rack
  M.box('metal', -2.05, 0.06, -2.05, 1.3, 0.12, 0.7, N.STEEL);
  for (let i = 0; i < 4; i++) {
    const x = -2.5 + i * 0.3;
    M.add('steel', new THREE.CylinderGeometry(0.42 - i * 0.03, 0.42 - i * 0.03, 0.06, 20).rotateZ(PI / 2).rotateY(0.08), { pos: v(x, 0.55 - i * 0.03, -2.05), color: 0xc9cdd1 });
    M.add('metal', new THREE.TorusGeometry(0.42 - i * 0.03, 0.03, 4, 20).rotateY(PI / 2), { pos: v(x + 0.035, 0.55 - i * 0.03, -2.05), color: 0x3d3430 });
  }
  for (const dx of [-0.6, 0.6]) M.box('metal', -2.05 + dx, 0.45, -2.05, 0.05, 0.8, 0.05, N.STEEL);
  M.col(-2.7, 0, -2.4, -1.4, 1.0, -1.7);
}
// crystal harvester (5x5): a cobalt-glass outcrop on its broken host rock,
// some crystals already sawn to stumps; a laser gantry riding rails across
// it with its cutting head and beam; a picking arm loading cut crystal into
// crates; the sorting cabinet with its radiator; a floodlight
export function crystalmine(M) {
  plinth(M, 5, 5);
  const ox = -0.5, oz = 0.55;
  const rock = new THREE.IcosahedronGeometry(1.15, 1);
  const P = rock.attributes.position;
  for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i); const k = 1 + 0.16 * Math.sin(x * 4.1 + z * 3.3) + 0.1 * Math.cos(y * 5.0 + x * 2.0); P.setXYZ(i, x * k * 1.15, Math.max(-0.25, y * k * 0.42), z * k); }
  rock.computeVertexNormals();
  M.add('regolith', rock, { pos: v(ox, 0.12, oz), color: 0x4a3c36 });
  crystals(M, ox, 0.38, oz, 15, 1.0, 7, COBALT, 4);
  crystals(M, ox + 0.85, 0.18, oz - 0.55, 6, 0.55, 11, 0x5a8aff, 2);
  crystals(M, ox - 0.9, 0.15, oz + 0.4, 5, 0.5, 19, 0x4a7af0, 1);
  M.colCyl(ox, oz, 1.2, 0, 1.4);
  // rails and gantry
  for (const s of [-1, 1]) {
    const x = ox + s * 1.75;
    M.box('metal', x, 0.06, 0.65, 0.2, 0.12, 3.1, N.STEEL);
    M.box('metal', x, 0.14, 0.65, 0.08, 0.05, 3.1, 0x9aa0a6);
    for (let k = 0; k < 5; k++) M.box('metal', x, 0.02, -0.75 + k * 0.7, 0.42, 0.04, 0.16, N.DARK);
    M.box('metal', x, 0.2, -0.86, 0.26, 0.28, 0.1, N.YELLOW);
    M.box('metal', x, 0.32, 0.5, 0.36, 0.3, 1.2, N.ORANGE);
    for (const dz of [-0.5, 0.5]) strut(M, [x, 0.45, 0.5 + dz], [x, 2.62, 0.5], 0.14, N.ORANGE);
    strut(M, [x, 1.2, 0.2], [x, 1.2, 0.8], 0.08, N.ORANGE);
  }
  M.box('metal', ox, 2.72, 0.5, 3.75, 0.26, 0.3, N.ORANGE);
  M.box('metal', ox, 2.9, 0.5, 3.6, 0.08, 0.12, N.DARK);
  const hx = ox + 0.15;
  M.box('shell', hx, 2.62, 0.5, 0.5, 0.42, 0.55, N.SHELL);
  M.cyl('metal', hx, 1.85, 0.5, 0.09, 0.62, N.FRAME, 10);
  M.cyl('metal', hx, 1.72, 0.5, 0.06, 0.14, N.DARK, 10);
  M.add('emissive', new THREE.CylinderGeometry(0.012, 0.012, 0.7, 6), { pos: v(hx, 1.37, 0.5), color: 0xff3322 });
  M.sphere('emissive', hx, 1.02, 0.5, 0.05, 0xff6a3a, 8);
  M.light(hx, 1.2, 0.5, 0xff4a2a, 1.5, 4);
  M.col(ox - 1.95, 0, 0.0, ox - 1.55, 2.9, 1.0);
  M.col(ox + 1.55, 0, 0.0, ox + 1.95, 2.9, 1.0);
  // picking arm and crates
  M.cyl('metal', 1.65, 0, -0.75, 0.28, 0.45, N.DARK, 14);
  const arm = M.animGroup('shell', { pivot: [1.65, 0, -0.75], axis: [0, 1, 0], speed: 0.5 });
  arm.add(new THREE.CylinderGeometry(0.2, 0.24, 0.28, 14), { pos: v(1.65, 0.6, -0.75), color: N.SHELL });
  gStrut(arm, [1.65, 0.7, -0.75], [1.5, 1.6, -1.05], 0.16, N.SHELL);
  arm.add(new THREE.SphereGeometry(0.12, 12, 8), { pos: v(1.5, 1.62, -1.05), color: N.DARK });
  gStrut(arm, [1.5, 1.62, -1.05], [1.25, 1.2, -1.6], 0.12, N.SHELL);
  arm.add(new THREE.BoxGeometry(0.16, 0.16, 0.2), { pos: v(1.22, 1.1, -1.65), color: N.DARK });
  M.colCyl(1.65, -0.75, 0.3, 0, 0.6);
  for (let i = 0; i < 3; i++) {
    const x = 0.2 + i * 0.62, z = -1.95;
    M.box('metal', x, 0.04, z, 0.56, 0.08, 0.56, N.STEEL);
    M.box('shell', x, 0.3, z, 0.5, 0.44, 0.5, 0x5b6168);
    M.box('metal', x, 0.52, z, 0.52, 0.03, 0.52, N.FRAME);
    crystals(M, x, 0.42, z, 4, 0.32, 31 + i, COBALT);
  }
  M.col(-0.1, 0, -2.25, 1.55, 0.55, -1.65);
  // sorting cabinet and radiator, floodlight
  M.box('shell', -1.85, 0.7, -1.7, 0.9, 1.4, 0.7, N.SHELL);
  M.box('metal', -1.85, 1.43, -1.7, 0.96, 0.06, 0.76, N.FRAME);
  M.box('emissive', -1.85, 1.0, -2.06, 0.5, 0.26, 0.01, L.cyan);
  M.box('metal', -1.85, 0.4, -2.06, 0.6, 0.12, 0.02, N.DARK);
  roofRad(M, -1.85, 1.46, -1.7, 0.85, 0.6, 0);
  M.col(-2.3, 0, -2.05, -1.4, 1.45, -1.35);
  lightPole(M, 2.15, 2.1, 3.0, PI * 1.3, L.white);
}

// ---------------------------------------------------------------- science
// gene lab (8x8): a lab vessel with a window band and a biohazard band, a
// greenhouse dome for the trials, sequencer racks in foil
export function genelab(M) {
  plinth(M, 8, 8);
  const vx = -1.0, vz = 0.6;
  deployFrame(M, vx, vz, 4.6, 4.6, 0.55);
  const cap = vessel(M, vx, vz, { r: 2.5, h: 3.4, y0: 0.55, loft: 0, hatches: [PI], ports: [], segs: 10 });
  viewBand(M, vx, vz, 2.5, 1.6, 1.0, { from: PI * 0.55, to: PI * 1.45, n: 9 });
  band(M, vx, vz, 2.5, 3.3, 0.22, N.ORANGE);
  cupola(M, vx, cap - 0.05, vz, 0.75);
  geodesicDome(M, 2.4, -1.8, 1.4, { skirt: 0.3, detail: 1 });
  for (let i = 0; i < 5; i++) M.sphere('plant', 2.4 + Math.cos(i * 1.3) * 0.5, 0.5, -1.8 + Math.sin(i * 1.3) * 0.5, 0.25, [0x3d7f3a, 0x7a4fb8, 0x2f8a6a][i % 3], 8, 0.85);
  for (let i = 0; i < 3; i++) avionics(M, 2.8, 0, 1.0 + i * 0.9, 0.6, 1.0, 0.7);
  porch(M, vx, vz - 2.5, 0.55, { w: 1.4, d: 0.7, run: 1.1 });
  M.entry(vx);
}
// data centre (8x8): two sealed data halls with ribbed walls and lit status
// strips, chillers turning on their roofs, the cable tray bridging them, the
// coolant loop out to a bank of radiator wings, the UPS and transformer, the
// entry vestibule, a fibre-relay mast
export function datacenter(M) {
  plinth(M, 8, 8);
  dataHall(M, -0.7, -1.55, 5.0, 1.55, 1.75);
  dataHall(M, -0.7, 0.75, 5.0, 1.55, 1.75);
  // cable tray between the halls
  for (const x of [-2.6, -0.7, 1.2]) for (const z of [-0.55, -0.15]) M.cyl('metal', x, 0, z, 0.04, 2.3, N.STEEL, 6);
  M.box('metal', -0.7, 2.32, -0.35, 4.6, 0.05, 0.5, N.GRATE);
  for (const k of [-1, 1]) M.box('metal', -0.7, 2.4, -0.35 + k * 0.25, 4.6, 0.12, 0.03, N.STEEL);
  for (let i = 0; i < 3; i++) M.box('metal', -0.7, 2.38, -0.45 + i * 0.1, 4.5, 0.05, 0.06, [0x2a5db0, 0xe0662a, 0x2a2d31][i]);
  // coolant loop and radiators
  piping(M, [[1.85, 1.0, -1.25], [2.6, 1.0, -1.25], [2.6, 1.0, 2.6], [3.1, 1.0, 2.6]], 0.08, 0xb8bec4);
  piping(M, [[1.85, 0.7, 1.05], [2.4, 0.7, 1.05], [2.4, 0.7, -2.8], [3.1, 0.7, -2.8]], 0.08, 0x3a6aa0);
  for (const z of [-2.75, -1.3, 0.15, 1.6]) radiatorWing(M, 3.35, z, -PI / 2, { w: 1.3, h: 2.4, y0: 0.55 });
  // UPS, transformer
  avionics(M, -2.6, 0, 2.6, 1.6, 1.2, 0.9);
  for (let i = 0; i < 4; i++) M.box('emissive', -3.2 + i * 0.4, 0.95, 2.14, 0.12, 0.05, 0.01, i < 3 ? L.green : L.orange);
  transformer(M, -0.4, 2.85, 0.8, 0);
  piping(M, [[-0.4, 1.6, 2.6], [-0.4, 2.2, 2.2], [-0.4, 2.2, 1.7]], 0.04, 0x2a2d31);
  // entry vestibule at the front
  M.box('shell', -2.2, 1.05, -2.75, 1.2, 2.1, 0.8, N.SHELL);
  M.box('metal', -2.2, 2.13, -2.75, 1.28, 0.07, 0.88, N.FRAME);
  M.box('shell', -2.2, 1.75, -2.75, 1.22, 0.14, 0.82, BLUE);
  hatch(M, -2.2, 0.02, -3.17, PI, { w: 0.78, h: 1.65, depth: 0.12 });
  M.col(-2.8, 0, -3.17, -1.6, 2.15, -2.35);
  // fibre relay mast
  M.cyl('metal', 1.6, 0, 2.8, 0.06, 4.2, N.FRAME, 8);
  M.box('shell', 1.6, 3.6, 2.68, 0.36, 0.9, 0.08, N.SHELL);
  M.box('shell', 1.52, 3.6, 2.85, 0.08, 0.9, 0.36, N.SHELL);
  M.sphere('blink', 1.6, 4.26, 2.8, 0.06, L.red, 6);
  lightPole(M, 3.6, -3.55, 3.4, PI * 1.75);
  M.entry(-2.2);
}

// ---------------------------------------------------------------- colony
// supermarket (12x10): a big pressurised hall with a glazed storefront and
// the store lit inside (aisles of shelving, chiller cabinets glowing along
// the back, checkouts), the entrance vestibule under a canopy with its green
// sign, a cart corral, the loading dock with two reefer units and a roll-up
// door, air handling and skylights on the roof
export function supermarket(M) {
  plinth(M, 12, 10);
  const hx = -1.0, hz = 0.9, hw = 8.4, hd = 5.2, hh = 3.8;
  glazedHall(M, hx, hz, hw, hd, hh, { gh: 2.9 });
  // inside: aisles, chillers, checkouts
  const COL = [0xd94a3a, 0xe8b23a, 0x3f8f5a, 0x3a6ab0, 0xe8e2d4, 0x9a5ac0, 0xe07a2a];
  for (let r = 0; r < 3; r++) {
    const z = hz - 0.8 + r * 1.1;
    M.box('metal', hx - 0.3, 0.9, z, 5.4, 1.5, 0.5, 0x5b6168);
    for (let lv = 0; lv < 3; lv++) for (const k of [-1, 1]) for (let i = 0; i < 9; i++) M.box('shell', hx - 2.7 + 0.3 + i * 0.6, 0.45 + lv * 0.45, z + k * 0.27, 0.5, 0.26, 0.04, COL[(i + lv * 3 + r + (k > 0 ? 2 : 0)) % COL.length]);
  }
  for (let i = 0; i < 6; i++) { M.box('shell', hx - 3.0 + i * 1.2, 1.1, hz + hd / 2 - 0.45, 1.1, 1.9, 0.5, N.SHELL2); M.box('emissive', hx - 3.0 + i * 1.2, 1.1, hz + hd / 2 - 0.71, 0.95, 1.6, 0.01, 0xd8eef8); }
  for (let i = 0; i < 3; i++) { const x = hx - 2.6 + i * 1.3; M.box('shell', x, 0.55, hz - hd / 2 + 0.85, 0.5, 0.8, 1.0, N.SHELL2); M.box('emissive', x, 1.05, hz - hd / 2 + 1.1, 0.2, 0.14, 0.02, L.cyan); }
  // entrance vestibule and canopy
  const ez = hz - hd / 2;
  M.box('window', hx + 1.6, 1.25, ez - 0.75, 2.4, 2.3, 1.4);
  for (const [dx, dz] of [[-1.2, -0.7], [1.2, -0.7], [-1.2, 0.7], [1.2, 0.7]]) M.box('metal', hx + 1.6 + dx, 1.25, ez - 0.75 + dz, 0.08, 2.4, 0.08, N.FRAME);
  M.box('metal', hx + 1.6, 2.42, ez - 0.75, 2.5, 0.08, 1.5, N.FRAME);
  M.box('metal', hx + 1.6, 1.15, ez - 1.47, 0.04, 2.2, 0.06, N.DARK);
  M.box('shell', hx + 1.6, 3.15, ez - 0.95, 4.2, 0.16, 1.9, N.SHELL2);
  M.box('emissive', hx + 1.6, 3.15, ez - 1.91, 3.0, 0.12, 0.02, L.green);
  M.box('emissive', hx - 1.4, 3.38, ez - 0.02, 3.6, 0.5, 0.04, 0x55e08a);
  for (const dx of [-1.9, 1.9]) M.cyl('metal', hx + 1.6 + dx, 0, ez - 1.75, 0.06, 3.1, N.FRAME, 8);
  M.col(hx + 0.4, 0, ez - 1.45, hx + 2.8, 2.45, ez);
  for (let i = 0; i < 4; i++) { const x = hx - 3.0 + i * 0.32; M.box('metal', x, 0.5, ez - 1.0, 0.3, 0.35, 0.55, 0x9aa0a6); M.box('metal', x, 0.25, ez - 1.0, 0.02, 0.5, 0.5, N.DARK); }
  M.box('metal', hx - 2.5, 0.75, ez - 1.0, 1.5, 0.04, 0.04, N.FRAME);
  // loading dock and reefers
  M.box('concrete', 4.15, 0.5, 1.6, 1.9, 1.0, 4.4, 0x8f8a84);
  hazard(M, 5.05, 1.01, 1.6, 0.1, 0.02, 4.3);
  M.col(3.2, 0, -0.6, 5.1, 1.0, 3.8, { walk: true });
  M.box('metal', hx + hw / 2 + 0.03, 1.15 + 0.9, 1.7, 0.06, 2.0, 2.0, 0xc9ccd0);
  for (let k = 1; k < 6; k++) M.box('metal', hx + hw / 2 + 0.07, 1.05 + k * 0.33, 1.7, 0.03, 0.025, 1.96, 0x9a9ea2);
  for (const z of [0.1, 3.0]) {
    M.box('shell', 4.45, 1.65, z, 1.2, 1.3, 1.6, 0xf2f0ea);
    M.box('metal', 4.45, 1.65, z - 0.82, 1.0, 1.1, 0.06, 0x8a9096);
    M.add('metal', new THREE.CylinderGeometry(0.24, 0.24, 0.04, 20).rotateX(PI / 2), { pos: v(4.45, 1.75, z - 0.86), color: N.DARK });
  }
  // roof
  for (let i = 0; i < 3; i++) { const x = hx - 2.6 + i * 2.6; M.box('window', x, hh + 0.2, hz + 0.3, 1.6, 0.06, 2.6); M.box('metal', x, hh + 0.16, hz + 0.3, 1.7, 0.1, 2.7, N.FRAME); }
  for (const x of [hx - 1.3, hx + 1.3]) { M.box('shell', x, hh + 0.45, hz + 2.0, 1.1, 0.7, 0.9, N.SHELL2); M.cyl('metal', x, hh + 0.8, hz + 2.0, 0.3, 0.03, N.DARK, 18); }
  M.entry(hx + 1.6);
}
// vertical farm (8x8): a tower of glazed grow floors between solid slabs,
// racks of greens on every floor under magenta grow light, mullions round
// the glazing, the solid core; a geodesic greenhouse crown; the nutrient
// tanks and the riser feeding the floors; the entry vestibule
export function verticalfarm(M) {
  plinth(M, 8, 8);
  const vx = -0.5, vz = 0.5, r = 2.3, fh = 1.8, nf = 4, y0 = 0.5;
  deployFrame(M, vx, vz, 4.4, 4.4, y0);
  M.cyl('metal', vx, 0, vz, r * 0.92, y0, N.STEEL, 40);
  M.cyl('shell', vx, y0, vz, 0.65, nf * fh + 0.4, N.SHELL2, 20);
  for (let f = 0; f <= nf; f++) {
    const y = y0 + f * fh;
    M.cyl('shell', vx, y, vz, r + 0.06, 0.38, N.SHELL, 48);
    M.add('metal', new THREE.TorusGeometry(r + 0.07, 0.04, 4, 48), { pos: v(vx, y + 0.38, vz), rot: e(PI / 2, 0, 0), color: N.FRAME });
    if (f === nf) break;
    M.add('window', new THREE.CylinderGeometry(r, r, fh - 0.38, 48, 1, true), { pos: v(vx, y + 0.38 + (fh - 0.38) / 2, vz) });
    for (let k = 0; k < 16; k++) { const a = (k + 0.5) / 16 * PI * 2; M.box('metal', vx + Math.sin(a) * (r + 0.02), y + 0.38 + (fh - 0.38) / 2, vz + Math.cos(a) * (r + 0.02), 0.07, fh - 0.38, 0.07, N.FRAME, a); }
    for (const [rr, h] of [[r - 0.45, 0.85], [r - 1.0, 0.65]]) {
      M.add('plant', new THREE.CylinderGeometry(rr, rr, 0.22, 40, 1, true), { pos: v(vx, y + 0.55, vz), color: 0x4f8a3a });
      M.add('plant', new THREE.CylinderGeometry(rr - 0.02, rr - 0.02, 0.2, 40, 1, true), { pos: v(vx, y + 0.95, vz), color: 0x5c9a3e });
      for (let k = 0; k < 8; k++) { const a = k / 8 * PI * 2 + rr; M.cyl('metal', vx + Math.sin(a) * (rr + 0.03), y + 0.38, vz + Math.cos(a) * (rr + 0.03), 0.025, h, 0x8a9096, 4); }
      M.add('emissive', new THREE.CylinderGeometry(rr, rr, 0.05, 40, 1, true), { pos: v(vx, y + fh - 0.06, vz), color: MAGENTA });
    }
  }
  const top = y0 + nf * fh + 0.38;
  geodesicDome(M, vx, vz, r * 0.92, { y0: top, skirt: 0.3, detail: 1 });
  for (let i = 0; i < 6; i++) { const a = i * 1.05; flora(M, vx + Math.cos(a) * 1.1, vz + Math.sin(a) * 1.1, i % 2 ? 'broad' : 'shrub', 0.75, i, top + 0.3); }
  M.light(vx, 3.0, vz - r - 0.6, 0xff6ad5, 2, 7);
  M.colCyl(vx, vz, r + 0.06, 0, top + r);
  // tanks and riser
  tankV(M, 2.85, -2.3, 0.45, 1.6, { y0: 0.2, band: BLUE });
  tankV(M, 2.85, -1.1, 0.42, 1.4, { y0: 0.2, band: 0xb9a46a });
  piping(M, [[2.4, 0.4, -1.7], [vx + r + 0.25, 0.4, -1.0], [vx + r + 0.25, top - 0.3, -1.0], [vx + r * 0.8, top - 0.3, -0.6]], 0.06, 0xb8bec4);
  for (let f = 1; f < nf; f++) M.box('metal', vx + r + 0.18, y0 + f * fh + 0.2, -0.95, 0.14, 0.1, 0.14, N.STEEL);
  // vestibule
  M.box('shell', vx, 1.15, vz - r - 0.45, 1.3, 1.9, 0.9, N.SHELL);
  M.box('metal', vx, 2.13, vz - r - 0.45, 1.36, 0.07, 0.96, N.FRAME);
  M.box('shell', vx, 1.75, vz - r - 0.45, 1.32, 0.14, 0.92, GREEN);
  hatch(M, vx, y0, vz - r - 0.9, PI, { w: 0.8, h: 1.55, depth: 0.1, label: false });
  porch(M, vx, vz - r - 0.9, y0, { w: 1.4, d: 0.6, run: 0.9 });
  M.col(vx - 0.65, 0, vz - r - 0.9, vx + 0.65, 2.15, vz - r);
  M.entry(vx);
}
// security drone base (6x6): the ops module in patrol livery with its light
// bar, a raised drone deck on its frame with three charging pads and their
// drones, the sensor mast with a turning radar, PTZ camera and floodlights,
// barriers at the front, light poles
export function securitybase(M) {
  plinth(M, 6, 6);
  const mx = -1.0, mz = 1.55, my = 1.15, mr = 0.95;
  tubeModule(M, mx, my, mz, 3.6, mr, 0, { endHatch: false, startHatch: true, ribs: 3, ports: 2 });
  for (const lx of [-1.0, 1.0]) M.add('shell', new THREE.CylinderGeometry(mr + 0.015, mr + 0.015, 0.36, 40, 1, true), { pos: v(mx + lx, my, mz), rot: e(0, 0, PI / 2), color: NAVY });
  M.box('metal', mx, my + mr + 0.06, mz, 0.9, 0.08, 0.3, N.DARK);
  M.box('emissive', mx - 0.22, my + mr + 0.14, mz, 0.4, 0.08, 0.22, 0xff3322);
  M.box('emissive', mx + 0.22, my + mr + 0.14, mz, 0.4, 0.08, 0.22, 0x3a6aff);
  M.box('shell', mx + 0.6, 1.0, mz - mr - 0.25, 1.0, 1.9, 0.55, N.SHELL);
  M.box('metal', mx + 0.6, 1.98, mz - mr - 0.25, 1.06, 0.07, 0.6, N.FRAME);
  M.box('shell', mx + 0.6, 1.7, mz - mr - 0.25, 1.02, 0.14, 0.57, NAVY);
  hatch(M, mx + 0.6, 0.02, mz - mr - 0.52, PI, { w: 0.72, h: 1.5, depth: 0.1 });
  M.col(mx + 0.1, 0, mz - mr - 0.52, mx + 1.1, 2.0, mz - mr);
  avionics(M, mx - 1.3, 0, mz - mr - 0.35, 0.7, 0.8, 0.5);
  // drone deck
  const dx = 1.45, dz = -0.95, dy = 1.55;
  grating(M, dx, dy, dz, 2.7, 2.5);
  platformRails(M, dx, dy, dz, 2.7, 2.5, 0, 'front');
  for (const [ux, uz] of C4) strut(M, [dx + ux * 1.25, 0, dz + uz * 1.15], [dx + ux * 1.25 * 0.6, dy - 0.1, dz], 0.06, N.STEEL);
  ladder(M, dx - 0.9, dz - 1.3, 0, dy + 0.9, 0);
  for (const [x, z] of [[dx - 0.65, dz + 0.5], [dx + 0.65, dz + 0.5], [dx, dz - 0.6]]) {
    M.cyl('metal', x, dy, z, 0.5, 0.025, 0x3a3f45, 24);
    M.add('concrete', new THREE.RingGeometry(0.4, 0.45, 24), { pos: v(x, dy + 0.03, z), rot: e(-PI / 2, 0, 0), color: N.YELLOW });
    for (let k = 0; k < 4; k++) { const a = k / 4 * PI * 2 + PI / 4; M.sphere('emissive', x + Math.sin(a) * 0.47, dy + 0.04, z + Math.cos(a) * 0.47, 0.025, L.cyan, 6); }
    bigDrone(M, x, dy + 0.1, z, NAVY, L.red, 1);
  }
  // sensor mast
  const sx = -2.25, sz = -1.55;
  mast(M, sx, sz, 5.0, 0.42, 0.2);
  M.cyl('metal', sx, 5.0, sz, 0.45, 0.07, N.GRATE, 16);
  M.add('metal', new THREE.TorusGeometry(0.45, 0.02, 4, 20), { pos: v(sx, 5.6, sz), rot: e(PI / 2, 0, 0), color: N.YELLOW });
  M.cyl('metal', sx, 5.07, sz, 0.08, 0.8, N.FRAME, 8);
  const rad = M.animGroup('shell', { pivot: [sx, 0, sz], axis: [0, 1, 0], speed: 1.6 });
  rad.add(new THREE.BoxGeometry(1.3, 0.24, 0.07), { pos: v(sx, 5.95, sz), color: N.SHELL });
  rad.add(new THREE.BoxGeometry(1.32, 0.04, 0.09), { pos: v(sx, 5.81, sz), color: N.DARK });
  M.box('metal', sx, 4.7, sz - 0.3, 0.06, 0.06, 0.5, N.FRAME);
  M.sphere('glass', sx, 4.56, sz - 0.55, 0.14, undefined, 14);
  M.cyl('metal', sx, 4.62, sz - 0.55, 0.15, 0.1, N.SHELL, 14);
  for (const s of [-1, 1]) {
    M.box('metal', sx + s * 0.32, 4.95, sz, 0.26, 0.2, 0.14, N.DARK, s * 0.5);
    M.box('emissive', sx + s * 0.36, 4.95, sz - 0.06, 0.2, 0.14, 0.01, L.white, s * 0.5);
  }
  beacon(M, sx, 6.25, sz, L.red);
  // front barriers and light poles
  for (const x of [-0.4, 0.75]) {
    M.add('concrete', new THREE.CylinderGeometry(0.16, 0.3, 0.55, 4, 1).rotateY(PI / 4).scale(2.6, 1, 1), { pos: v(x, 0.275, -2.6), color: 0xa59f96 });
    M.box('shell', x, 0.5, -2.6, 0.9, 0.08, 0.2, N.YELLOW);
    M.col(x - 0.55, 0, -2.75, x + 0.55, 0.55, -2.45);
  }
  lightPole(M, 2.65, -2.65, 3.6, PI * 1.75);
  lightPole(M, 2.65, 2.6, 3.6, PI * 1.25);
}

// ---------------------------------------------------------------- civic
// canteen (8x6): a glazed dining vault with tables, chairs and warm light
// strung along its ridge, the kitchen block with its hood stack steaming and
// a serving hatch, the cold store with its refrigeration unit, the entry
// vestibule beside a lit menu board, planters
export function canteen(M) {
  plinth(M, 8, 6);
  const vx = -1.0, vz = 0.3, len = 4.4, r = 1.5, y0 = 0.35;
  M.box('concrete', vx, y0 + 0.03, vz, len - 0.08, 0.06, 2 * r - 0.1, 0x8a7a6a);
  for (let i = 0; i < 3; i++) {
    const x = vx - 1.4 + i * 1.4;
    M.cyl('metal', x, y0, vz, 0.05, 0.62, N.DARK, 8);
    M.cyl('shell', x, y0 + 0.62, vz, 0.38, 0.04, 0xe9e2d4, 20);
    for (let k = 0; k < 4; k++) { const a = k * PI / 2 + PI / 4; M.box('shell', x + Math.sin(a) * 0.55, y0 + 0.24, vz + Math.cos(a) * 0.55, 0.3, 0.05, 0.3, [0xd8661f, 0x3a6ab0, 0x2f8f4a, 0xe8b23a][(i + k) % 4], a); M.box('shell', x + Math.sin(a) * 0.68, y0 + 0.45, vz + Math.cos(a) * 0.68, 0.3, 0.4, 0.04, [0xd8661f, 0x3a6ab0, 0x2f8f4a, 0xe8b23a][(i + k) % 4], a); }
  }
  for (const x of [vx - len / 2 + 0.35, vx + len / 2 - 0.35]) for (const s of [-1, 1]) { M.cyl('shell', x, y0, vz + s * 0.95, 0.16, 0.3, 0x8a6a4a, 12); M.sphere('plant', x, y0 + 0.5, vz + s * 0.95, 0.24, 0x4f8a3a, 10, 0.9); }
  M.box('emissive', vx, y0 + r - 0.12, vz, len - 0.6, 0.03, 0.06, L.warm);
  for (let i = 0; i < 5; i++) M.sphere('emissive', vx - 1.6 + i * 0.8, y0 + r - 0.3, vz, 0.07, L.warm, 8);
  M.light(vx, y0 + 1.0, vz, L.warm, 2, 7);
  vault(M, vx, vz, len, r, { y0, ribs: 6 });
  // kitchen block
  const kx = 2.35, kz = 0.3;
  M.box('shell', kx, 1.2, kz, 2.3, 2.4, 2.4, N.SHELL);
  M.box('metal', kx, 2.43, kz, 2.38, 0.07, 2.48, N.FRAME);
  M.box('shell', kx, 1.95, kz, 2.32, 0.18, 2.42, 0xd8661f);
  M.box('glass', kx - 0.4, 1.3, kz - 1.21, 0.7, 0.5, 0.03);
  M.box('emissive', kx - 0.4, 1.3, kz - 1.2, 0.66, 0.46, 0.01, L.warm);
  M.box('shell', kx + 0.3, 2.65, kz + 0.4, 0.8, 0.4, 0.8, N.SHELL2);
  M.cyl('steel', kx + 0.3, 2.85, kz + 0.4, 0.17, 0.9, 0xc9cdd1, 12);
  M.cyl('metal', kx + 0.3, 3.75, kz + 0.4, 0.26, 0.06, N.DARK, 12);
  M.vent(kx + 0.3, 3.9, kz + 0.4, { rate: 0.8, size: 0.6 });
  hatch(M, kx + 0.6, 0.02, kz - 1.2, PI, { w: 0.62, h: 1.5, depth: 0.08, label: false });
  M.col(kx - 1.15, 0, kz - 1.2, kx + 1.15, 2.45, kz + 1.2);
  // cold store
  M.box('shell', 2.75, 0.75, -2.15, 1.3, 1.5, 1.1, 0xeef2f4);
  M.box('metal', 2.75, 1.53, -2.15, 1.36, 0.07, 1.16, N.FRAME);
  M.box('shell', 2.75, 1.2, -2.15, 1.32, 0.12, 1.12, BLUE);
  roofRad(M, 2.75, 1.56, -2.15, 1.0, 0.8, 0);
  M.col(2.1, 0, -2.7, 3.4, 1.6, -1.6);
  // vestibule, menu board, planters
  const ex = vx - 0.9;
  M.box('shell', ex, 1.0, vz - r - 0.4, 1.15, 2.0, 0.8, N.SHELL);
  M.box('metal', ex, 2.02, vz - r - 0.4, 1.22, 0.07, 0.86, N.FRAME);
  M.box('shell', ex, 1.65, vz - r - 0.4, 1.17, 0.14, 0.82, 0xd8661f);
  hatch(M, ex, 0.02, vz - r - 0.8, PI, { w: 0.78, h: 1.6, depth: 0.1, label: false });
  M.col(ex - 0.58, 0, vz - r - 0.8, ex + 0.58, 2.05, vz - r);
  M.cyl('metal', ex + 1.15, 0, vz - r - 0.75, 0.04, 1.0, N.DARK, 6);
  M.box('shell', ex + 1.15, 1.25, vz - r - 0.75, 0.7, 0.55, 0.06, N.DARK);
  M.box('emissive', ex + 1.15, 1.25, vz - r - 0.79, 0.6, 0.45, 0.01, L.warm);
  for (const x of [-3.4, 0.6]) { M.box('concrete', x, 0.22, -2.35, 1.0, 0.44, 0.5, 0x9a948c); for (let i = 0; i < 3; i++) M.sphere('plant', x - 0.3 + i * 0.3, 0.55, -2.35, 0.17, LEAF[i], 8, 0.8); }
  M.entry(ex);
}
// playground (6x6): a geodesic dome over a slide, swings and a sandpit
export function playground(M) {
  plinth(M, 6, 6);
  const cx = 0, cz = 0.3;
  M.cyl('plant', cx, 0.02, cz, 2.5, 0.05, 0x5d8f3a, 28);
  strut(M, [cx - 1.4, 1.3, cz], [cx - 0.2, 0.1, cz + 0.4], 0.5, 0xd9b23a);
  M.box('metal', cx - 1.6, 0.65, cz - 0.2, 0.5, 1.3, 0.5, N.ORANGE);
  for (const s of [-1, 1]) strut(M, [cx + 1.0 + s * 0.6, 0, cz - 0.8], [cx + 1.0, 1.6, cz - 0.8], 0.06, BLUE);
  M.box('metal', cx + 1.0, 1.6, cz - 0.8, 1.6, 0.06, 0.06, BLUE);
  for (const s of [-0.35, 0.35]) { M.cyl('metal', cx + 1.0 + s, 0.55, cz - 0.8, 0.01, 1.05, N.DARK, 4); M.box('shell', cx + 1.0 + s, 0.5, cz - 0.8, 0.3, 0.04, 0.16, 0xc94a8a); }
  M.cyl('regolith', cx + 0.6, 0.02, cz + 1.3, 0.7, 0.08, 0xd8c08a, 16);
  for (let i = 0; i < 4; i++) M.sphere('shell', cx - 0.8 + i * 0.5, 0.15, cz + 1.6, 0.14, [N.ORANGE, BLUE, GREEN, N.YELLOW][i], 8);
  geodesicDome(M, cx, cz, 2.7, { skirt: 0.35, detail: 2 });
  M.box('shell', cx, 0.9, cz - 2.85, 1.2, 1.8, 0.6, N.SHELL2);
  hatch(M, cx, 0.02, cz - 3.15, PI, { w: 0.8, h: 1.5, depth: 0.1, label: false });
}
// theatre (10x8): the auditorium drum under its fabric loft, the fly tower
// with ribbed walls and a stage door, the glazed foyer wrapping the front
// with its warm light, the canopy with the marquee of bulbs and a lit title,
// poster lightboxes, scenery crates at the dock, planters and light poles
export function theatre(M) {
  plinth(M, 10, 8);
  const vx = -0.4, vz = 0.25, r = 2.8;
  deployFrame(M, vx, vz, 5.0, 5.0, 0.4);
  vessel(M, vx, vz, { r, h: 3.0, y0: 0.4, loft: 1.4, hatches: [], ports: [], segs: 12 });
  // fly tower
  const fz = 3.15;
  M.box('shell', vx, 3.3, fz, 4.2, 6.6, 1.5, N.SHELL2);
  for (let i = 0; i <= 7; i++) for (const k of [-1, 1]) M.box('metal', vx - 2.1 + i * 0.6, 3.3, fz + k * 0.76, 0.08, 6.5, 0.04, N.FRAME);
  for (const k of [-1, 1]) for (let y = 1.2; y < 6.6; y += 1.3) M.box('metal', vx + k * 2.11, y, fz, 0.04, 0.06, 1.5, N.FRAME);
  M.box('metal', vx, 6.65, fz, 4.32, 0.16, 1.62, N.FRAME);
  M.box('metal', vx, 1.3, fz + 0.77, 2.0, 2.4, 0.04, 0xc9ccd0);
  for (let k = 1; k < 8; k++) M.box('metal', vx, k * 0.3, fz + 0.8, 1.96, 0.025, 0.02, 0x9a9ea2);
  ladder(M, vx + 2.25, fz, 0, 6.6, PI / 2);
  M.sphere('blink', vx + 1.9, 6.85, fz, 0.07, L.red, 6);
  M.col(vx - 2.1, 0, fz - 0.75, vx + 2.1, 6.7, fz + 0.75);
  // glazed foyer round the front
  const R2 = 3.5, from = PI * 0.6, to = PI * 1.4;
  M.add('concrete', new THREE.RingGeometry(r, R2, 36, 1, from - PI / 2, to - from).rotateX(-PI / 2), { pos: v(vx, 0.06, vz), color: 0x8a7a6a });
  viewBand(M, vx, vz, R2, 0.05, 2.45, { from, to, n: 12 });
  M.add('shell', new THREE.RingGeometry(r - 0.05, R2 + 0.12, 36, 1, from - PI / 2, to - from).rotateX(-PI / 2), { pos: v(vx, 2.62, vz), color: N.SHELL2 });
  M.add('shell', new THREE.CylinderGeometry(R2 + 0.12, R2 + 0.12, 0.3, 36, 1, true, from, to - from), { pos: v(vx, 2.65, vz), color: N.SHELL });
  M.add('emissive', new THREE.CylinderGeometry(R2 - 0.15, R2 - 0.15, 0.06, 36, 1, true, from, to - from), { pos: v(vx, 2.5, vz), color: L.warm });
  for (let i = 0; i < 6; i++) { const a = from + (i + 0.5) * (to - from) / 6; M.cyl('metal', vx + Math.sin(a) * 3.1, 0.06, vz + Math.cos(a) * 3.1, 0.18, 0.75, 0x9a948c, 10); M.sphere('plant', vx + Math.sin(a) * 3.1, 1.0, vz + Math.cos(a) * 3.1, 0.3, LEAF[i % 3], 10, 0.9); }
  M.light(vx, 1.8, vz - 3.0, L.warm, 3, 8);
  // canopy, marquee and title
  const cz = vz - R2;
  M.box('shell', vx, 2.75, cz - 0.25, 3.4, 0.14, 0.9, N.SHELL);
  for (const dx of [-1.55, 1.55]) M.cyl('metal', vx + dx, 0, cz - 0.7, 0.06, 2.7, N.FRAME, 8);
  M.box('shell', vx, 3.25, cz - 0.62, 2.8, 0.75, 0.14, 0x2a2d31);
  M.box('emissive', vx, 3.25, cz - 0.7, 2.3, 0.36, 0.01, 0xffd28a);
  for (let i = 0; i < 14; i++) for (const k of [-1, 1]) M.sphere('emissive', vx - 1.32 + i * 0.203, 3.25 + k * 0.31, cz - 0.71, 0.04, L.warm, 6);
  for (const k of [-1, 1]) for (let i = 0; i < 3; i++) M.sphere('emissive', vx + k * 1.36, 3.04 + i * 0.21, cz - 0.71, 0.04, L.warm, 6);
  // poster lightboxes
  for (const [dx, col] of [[-2.35, 0xc94a8a], [2.35, 0x3a8ad8]]) { const z = vz - Math.sqrt(R2 * R2 - dx * dx) - 0.35; M.box('metal', vx + dx, 1.05, z, 0.7, 1.4, 0.1, N.DARK); M.box('emissive', vx + dx, 1.08, z - 0.06, 0.58, 1.25, 0.01, col); M.box('metal', vx + dx, 0.17, z, 0.5, 0.34, 0.3, N.STEEL); }
  // dock crates, planters and light poles
  for (let i = 0; i < 3; i++) M.box('shell', vx + 2.9, 0.4 + (i === 2 ? 0.7 : 0), fz + (i % 2 ? 0.45 : -0.45) * (i === 2 ? 0 : 1), 1.0, 0.75, 0.8, [0x6a4a3a, 0x5a3e30, 0x7a5644][i]);
  M.col(vx + 2.35, 0, fz - 0.9, vx + 3.45, 1.5, fz + 0.9);
  for (const s of [-1, 1]) { M.box('concrete', vx + s * 4.1, 0.25, -2.9, 1.0, 0.5, 0.6, 0x9a948c); for (let i = 0; i < 3; i++) M.sphere('plant', vx + s * 4.1 - 0.3 + i * 0.3, 0.62, -2.9, 0.2, LEAF[i], 8, 0.8); M.col(vx + s * 4.1 - 0.5, 0, -3.2, vx + s * 4.1 + 0.5, 0.5, -2.6); }
  lightPole(M, vx - 3.9, -3.6, 3.6, PI * 0.15, L.warm);
  lightPole(M, vx + 3.9, -3.6, 3.6, -PI * 0.15, L.warm);
  M.entry(vx);
}
// broadcast station (6x6): a guyed lattice mast with its panel antennas,
// microwave drums and warning lights, the studio module with its windows and
// ON AIR light, a steerable uplink dish, the transmitter shelter in foil
export function broadcast(M) {
  plinth(M, 6, 6);
  const mx = 1.2, mz = 1.1;
  mast(M, mx, mz, 14, 0.6, 0.3);
  for (let k = 0; k < 4; k++) { const a = k * PI / 2; M.box('shell', mx + Math.sin(a) * 0.42, 12.4, mz + Math.cos(a) * 0.42, 0.42, 1.6, 0.08, N.SHELL, a); M.box('shell', mx + Math.sin(a) * 0.42, 10.6, mz + Math.cos(a) * 0.42, 0.42, 1.2, 0.08, N.SHELL2, a); }
  for (const [a, y] of [[PI * 1.25, 8.6], [PI * 0.4, 7.6]]) { M.add('shell', new THREE.CylinderGeometry(0.35, 0.35, 0.3, 20).rotateX(PI / 2).rotateY(a), { pos: v(mx + Math.sin(a) * 0.6, y, mz + Math.cos(a) * 0.6), color: N.SHELL }); M.add('metal', new THREE.CylinderGeometry(0.34, 0.34, 0.02, 20).rotateX(PI / 2).rotateY(a), { pos: v(mx + Math.sin(a) * 0.76, y, mz + Math.cos(a) * 0.76), color: N.SHELL2 }); }
  for (const y of [4.6, 9.4, 14.1]) M.sphere('blink', mx, y, mz, 0.08, L.red, 6);
  M.cyl('metal', mx, 14, mz, 0.03, 1.2, N.FRAME, 6);
  for (const a of [PI * 0.5, PI * 1.17, PI * 1.83]) {
    const gx = mx + Math.sin(a) * 1.75, gz = mz + Math.cos(a) * 1.75;
    M.box('concrete', gx, 0.1, gz, 0.4, 0.2, 0.4, 0x8f8a84);
    for (const y of [6.0, 11.5]) seg(M, [gx, 0.2, gz], [mx + Math.sin(a) * 0.35, y, mz + Math.cos(a) * 0.35], 0.012, 0x2a2d31, 'metal', 4);
  }
  // studio
  tubeModule(M, -1.35, 1.1, -1.4, 3.2, 0.9, 0, { endHatch: true, startHatch: false, ribs: 2, ports: 0 });
  for (let i = 0; i < 3; i++) M.add('glass', new THREE.BoxGeometry(0.55, 0.42, 0.04), { pos: v(-2.35 + i * 0.8, 1.35, -2.24), rot: e(-0.35, 0, 0) });
  M.box('shell', 0.5, 2.05, -1.4, 0.06, 0.18, 0.5, N.DARK);
  M.box('emissive', 0.54, 2.05, -1.4, 0.01, 0.12, 0.42, 0xff2a1a);
  M.cyl('metal', -1.9, 2.0, -1.4, 0.05, 0.4, N.FRAME, 6);
  M.add('shell', new THREE.SphereGeometry(0.35, 16, 8, 0, PI * 2, 0, PI / 2).rotateX(-0.9), { pos: v(-1.9, 2.5, -1.4), color: N.SHELL });
  // uplink dish and shelter
  dishAntenna(M, -1.55, 1.55, { s: 0.42, tilt: 0.85, speed: 0.06 });
  avionics(M, 2.3, 0, -1.3, 1.0, 1.4, 1.1);
  M.box('metal', 1.75, 1.6, -0.1, 0.25, 0.06, 2.1, N.GRATE);
  M.col(1.8, 0, -1.85, 2.8, 1.45, -0.75);
}
// botanical garden (12x12): two geodesic glasshouses, the larger with palms,
// conifers and broadleaf trees round a pond and a paved path, the smaller
// with flowering shrubs; the linking tunnel, the entrance pavilion with its
// canopy, benches outside
export function botanical(M) {
  plinth(M, 12, 12);
  const A = [-1.8, 1.2, 3.4], B = [3.0, -2.2, 2.4];
  for (const [x, z, r] of [A, B]) M.cyl('plant', x, 0.02, z, r * 0.95, 0.05, 0x587a35, 32);
  M.cyl('water', A[0] + 0.9, 0.05, A[1] + 0.6, 0.85, 0.04, 0x2a6a7a, 24);
  M.box('concrete', A[0], 0.08, A[1] - 1.2, 0.7, 0.03, 2.4, 0xb8b2a8);
  const KA = [['palm', -1.6, 0.3, 1.25], ['conifer', 0.2, 2.2, 1.2], ['broad', -1.9, 1.9, 1.15], ['palm', 1.6, -0.9, 1.1], ['conifer', -2.3, -0.9, 1.0], ['broad', 0.9, 2.0, 0.95], ['shrub', 1.9, 0.6, 1.2], ['shrub', -0.9, -2.0, 1.1], ['palm', -0.4, 2.6, 0.9], ['shrub', 2.4, 1.6, 1.0]];
  KA.forEach(([k, dx, dz, s], i) => flora(M, A[0] + dx, A[1] + dz, k, s, i));
  for (let i = 0; i < 9; i++) { const a = i * 0.7; flora(M, B[0] + Math.cos(a) * (0.5 + (i % 3) * 0.5), B[1] + Math.sin(a) * (0.5 + (i % 3) * 0.5), i === 4 ? 'broad' : 'shrub', 0.9 + (i % 2) * 0.3, i + 2); }
  for (const [x, z, r] of [A, B]) geodesicDome(M, x, z, r, { skirt: 0.4, detail: 2 });
  const d = Math.hypot(B[0] - A[0], B[1] - A[1]), ux = (B[0] - A[0]) / d, uz = (B[1] - A[1]) / d;
  const p0 = [A[0] + ux * A[2] * 0.95, A[1] + uz * A[2] * 0.95], p1 = [B[0] - ux * B[2] * 0.95, B[1] - uz * B[2] * 0.95];
  const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), yaw = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
  M.add('window', new THREE.CylinderGeometry(0.8, 0.8, len, 24, 1, true), { pos: v((p0[0] + p1[0]) / 2, 0.9, (p0[1] + p1[1]) / 2), rot: new THREE.Euler(0, -yaw, PI / 2, 'YXZ') });
  for (let i = 0; i <= 3; i++) { const t = i / 3; M.add('metal', new THREE.TorusGeometry(0.82, 0.05, 6, 24), { pos: v(p0[0] + (p1[0] - p0[0]) * t, 0.9, p0[1] + (p1[1] - p0[1]) * t), rot: e(0, -yaw + PI / 2, 0), color: N.FRAME }); }
  M.box('concrete', (p0[0] + p1[0]) / 2, 0.05, (p0[1] + p1[1]) / 2, len, 0.1, 1.6, 0x9a948c, -yaw);
  // entrance pavilion and canopy
  const ez = A[1] - A[2] - 0.45;
  M.box('shell', A[0], 1.1, ez, 1.8, 2.2, 1.0, N.SHELL);
  M.box('metal', A[0], 2.23, ez, 1.88, 0.07, 1.08, N.FRAME);
  M.box('shell', A[0], 1.85, ez, 1.82, 0.16, 1.02, GREEN);
  hatch(M, A[0], 0.02, ez - 0.5, PI, { w: 0.9, h: 1.7, depth: 0.12, label: false });
  M.box('shell', A[0], 2.45, ez - 0.75, 2.6, 0.1, 1.2, N.SHELL2);
  for (const s of [-1, 1]) M.cyl('metal', A[0] + s * 1.15, 0, ez - 1.25, 0.05, 2.4, N.FRAME, 8);
  M.col(A[0] - 0.9, 0, ez - 0.5, A[0] + 0.9, 2.25, ez + 0.5);
  for (const s of [-1, 1]) { M.box('metal', A[0] + s * 2.2, 0.42, ez - 1.0, 1.2, 0.06, 0.4, 0x8a6a4a); for (const k of [-1, 1]) M.box('metal', A[0] + s * 2.2 + k * 0.5, 0.2, ez - 1.0, 0.06, 0.4, 0.36, N.DARK); }
  M.entry(A[0]);
}
// planetary museum (10x8): the hall vessel with its window band and a
// canopied entrance, banners on poles, the replica of the first lander on its
// plinth (body, four splayed legs and pads, antenna) and the old rover
export function museum(M) {
  plinth(M, 10, 8);
  const vx = -1.6, vz = 0.6;
  deployFrame(M, vx, vz, 5.0, 5.0, 0.55);
  vessel(M, vx, vz, { r: 2.7, h: 3.4, y0: 0.55, loft: 1.2, hatches: [PI], ports: [], segs: 12 });
  viewBand(M, vx, vz, 2.7, 1.5, 1.3, { from: PI * 0.4, to: PI * 1.6, n: 12 });
  porch(M, vx, vz - 2.7, 0.55, { w: 1.6, d: 0.6, run: 0.9 });
  M.box('shell', vx, 2.6, vz - 3.35, 2.4, 0.1, 1.3, N.SHELL2);
  for (const s of [-1, 1]) M.cyl('metal', vx + s * 1.1, 0, vz - 3.9, 0.05, 2.6, N.FRAME, 8);
  for (const [dx, col] of [[-3.2, 0xc9302a], [-2.6, 0x2a5db0], [0.0, N.ORANGE]]) { const x = vx + dx + 1.6; M.cyl('metal', x, 0, -3.7, 0.04, 3.6, N.FRAME, 6); M.box('metal', x + 0.25, 3.45, -3.7, 0.55, 0.04, 0.04, N.FRAME); M.box('shell', x + 0.25, 2.75, -3.7, 0.48, 1.35, 0.02, col); }
  // first-lander replica on its plinth
  const px = 2.9, pz = -1.4;
  M.cyl('concrete', px, 0, pz, 1.35, 0.45, 0x9a948c, 8);
  M.box('metal', px, 0.3, pz - 1.36, 0.6, 0.2, 0.02, 0xb08a3a);
  M.cyl('shell', px, 1.25, pz, 0.62, 0.75, 0xd8d5cc, 16);
  M.add('shell', new THREE.ConeGeometry(0.62, 0.5, 16), { pos: v(px, 2.25, pz), color: 0xd8d5cc });
  M.cyl('shell', px, 1.25, pz, 0.635, 0.12, N.ORANGE, 16);
  M.add('foil', new THREE.CylinderGeometry(0.66, 0.55, 0.35, 16), { pos: v(px, 1.08, pz), color: 0xd8a640 });
  for (let k = 0; k < 4; k++) { const a = k / 4 * PI * 2 + PI / 4; strut(M, [px + Math.sin(a) * 0.5, 1.2, pz + Math.cos(a) * 0.5], [px + Math.sin(a) * 1.1, 0.47, pz + Math.cos(a) * 1.1], 0.06, N.FRAME); M.cyl('metal', px + Math.sin(a) * 1.12, 0.45, pz + Math.cos(a) * 1.12, 0.14, 0.04, N.FRAME, 10); }
  M.cyl('metal', px + 0.3, 2.45, pz, 0.02, 0.5, N.FRAME, 4);
  const prof = []; for (let i = 0; i <= 6; i++) { const t = i / 6; prof.push(new THREE.Vector2(0.03 + t * 0.32, t * t * 0.1)); }
  for (const rev of [false, true]) M.add('shell', new THREE.LatheGeometry(rev ? prof.slice().reverse() : prof, 14).rotateX(-0.5), { pos: v(px + 0.3, 2.95, pz), color: 0xe8e6e0 });
  M.colCyl(px, pz, 1.35, 0, 2.5);
  // old rover
  const rx = 3.2, rz = 1.8;
  M.box('shell', rx, 0.55, rz, 0.9, 0.35, 1.3, 0xe8e6e0);
  for (const sx of [-1, 1]) for (const sz of [-1, 0, 1]) M.add('metal', new THREE.CylinderGeometry(0.17, 0.17, 0.12, 12), { pos: v(rx + sx * 0.52, 0.18, rz + sz * 0.5), rot: e(0, 0, PI / 2), color: 0x3a3f45 });
  M.add('solar', new THREE.BoxGeometry(1.1, 0.03, 1.4), { pos: v(rx, 0.78, rz) });
  M.cyl('metal', rx - 0.3, 0.78, rz - 0.5, 0.025, 0.5, N.FRAME, 4);
  M.box('metal', rx - 0.3, 1.32, rz - 0.5, 0.14, 0.1, 0.14, N.DARK);
  M.col(rx - 0.6, 0, rz - 0.75, rx + 0.6, 0.9, rz + 0.75);
  M.entry(vx);
}
// biosphere ark (16x16): a great geodesic dome over a forest and a pond,
// four service modules round it, the entrance
export function ark(M) {
  plinth(M, 16, 16);
  const R = 6.6;
  M.cyl('plant', 0, 0.02, 0, R * 0.96, 0.06, 0x4f7a35, 40);
  M.cyl('water', 1.6, 0.04, 1.8, 1.8, 0.04, 0x2a6a7a, 28);
  for (let i = 0; i < 16; i++) {
    const a = i * 2.39996, rr = 1.5 + (i % 4) * 1.1;
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    if (Math.hypot(x - 1.6, z - 1.8) < 2.2) continue;
    flora(M, x, z, ['broad', 'conifer', 'palm', 'broad', 'shrub'][i % 5], 1.5 + (i % 3) * 0.35, i);
  }
  geodesicDome(M, 0, 0, R, { skirt: 0.6, detail: 3 });
  for (let k = 0; k < 4; k++) {
    const a = k * PI / 2 + PI / 4, x = Math.cos(a) * (R + 0.6), z = Math.sin(a) * (R + 0.6);
    tubeModule(M, x, 1.1, z, 1.6, 0.85, -a, { endHatch: false, startHatch: false, ribs: 1, ports: 0 });
  }
  M.box('shell', 0, 1.2, -R - 0.4, 2.0, 2.4, 1.4, N.SHELL2);
  hatch(M, 0, 0.02, -R - 1.1, PI, { w: 1.1, h: 2.0, depth: 0.14 });
  M.light(0, 5.0, 0, L.warm, 2, 14);
  M.entry(0);
}
