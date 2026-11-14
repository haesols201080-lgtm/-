// "Starbase Mars" kit: the civic buildings share the ships' engineering
// language so the town and the Starship beside it read as one place.
// Stainless drums welded in 1.8 m rings with black heat-tile panels, lattice
// towers like a launch tower, catwalk bridges, pipe racks, tank farms,
// floodlight masts and lit symbols that say what each building is for.
import * as THREE from 'three';
import { C, L, v, e, railing, antenna, tank, habDome, ribDome, porthole } from './modelkit.js';

const PI = Math.PI, TAU = PI * 2;
const STEEL = 0xd6d9de, FRAME = 0x3a3f45;

// a box strut between two points
export function strut(M, a, b, t, color = FRAME, key = 'metal') {
  const A = v(...a), B = v(...b), d = B.clone().sub(A), len = d.length();
  if (len < 1e-3) return;
  const q = new THREE.Quaternion().setFromUnitVectors(v(0, 1, 0), d.normalize());
  M.add(key, new THREE.BoxGeometry(t, len, t), { pos: A.clone().add(B).multiplyScalar(0.5), rot: new THREE.Euler().setFromQuaternion(q), color });
}

// stainless drum: welded rings, rows of small deep-set windows on the floors
// people use, a heat-tile panel, a lit identity band, and a cap
export function steelDrum(M, x, z, r, h, { y0 = 0, cap = 'dome', rows = [], tiles = null, accent = null, face = PI, color = STEEL, key = 'steel' } = {}) {
  M.add(key, new THREE.CylinderGeometry(r, r, h, 56, 1, true), { pos: v(x, y0 + h / 2, z), color });
  M.add('metal', new THREE.CylinderGeometry(r + 0.12, r + 0.18, 0.5, 56, 1, true), { pos: v(x, y0 + 0.25, z), color: FRAME });
  // windows: small, framed, in rows around the drum (skipping the tile panel)
  const n = Math.max(6, Math.round(TAU * r / 1.15));
  for (const ry of rows) for (let i = 0; i < n; i++) {
    const a = i / n * TAU;
    if (tiles && Math.abs(Math.atan2(Math.sin(a - tiles[0]), Math.cos(a - tiles[0]))) < tiles[1] / 2 + 0.15) continue;
    const px = x + Math.sin(a) * (r + 0.01), pz = z + Math.cos(a) * (r + 0.01);
    M.box('glass', px, y0 + ry, pz, 0.5, 0.95, 0.06, undefined, a);
    M.box('metal', px + Math.sin(a) * 0.05, y0 + ry + 0.55, pz + Math.cos(a) * 0.05, 0.7, 0.1, 0.16, FRAME, a);
    M.box('metal', px + Math.sin(a) * 0.03, y0 + ry - 0.53, pz + Math.cos(a) * 0.03, 0.62, 0.06, 0.1, FRAME, a);
  }
  if (tiles) M.add('tiles', new THREE.CylinderGeometry(r + 0.035, r + 0.035, h * 0.86, 28, 1, true, tiles[0] - tiles[1] / 2, tiles[1]), { pos: v(x, y0 + h * 0.5, z), color: 0xffffff });
  if (accent !== null) M.add('emissive', new THREE.CylinderGeometry(r + 0.04, r + 0.04, 0.12, 56, 1, true), { pos: v(x, y0 + h - 0.6, z), color: accent });
  const top = y0 + h;
  if (cap === 'dome') {
    M.add(key, new THREE.SphereGeometry(r, 48, 16, 0, TAU, 0, PI / 2), { pos: v(x, top, z), scale: v(1, 0.42, 1), color });
    M.cyl('metal', x, top + r * 0.4, z, r * 0.16, 0.25, FRAME, 16);
  } else if (cap === 'glass') {
    M.add('metal', new THREE.TorusGeometry(r, 0.12, 8, 48), { pos: v(x, top, z), rot: e(PI / 2, 0, 0), color: FRAME });
    ribDome(M, x, top, z, r * 0.96, { ribs: 12, rib: FRAME });
  } else if (cap === 'nose') {
    const prof = [];
    for (let i = 0; i <= 12; i++) { const t = i / 12; prof.push(new THREE.Vector2(r * Math.cos(t * PI / 2) ** 0.8, t * r * 1.5)); }
    M.add(key, new THREE.LatheGeometry(prof, 48), { pos: v(x, top, z), color });
  } else {
    M.add('metal', new THREE.CylinderGeometry(r + 0.06, r + 0.06, 0.6, 56, 1, true), { pos: v(x, top + 0.3, z), color: FRAME });
    M.cyl('metal', x, top - 0.02, z, r, 0.08, 0x5b6168, 48);
  }
  M.colCyl(x, z, r, y0, top + (cap === 'dome' ? r * 0.35 : cap === 'nose' ? r : 0.4));
  return top;
}

// launch-tower lattice: corner columns, girts and X bracing on every face,
// a zig-zag stair inside, a platform with rails and a mast on top
export function lattice(M, x, z, w, h, { y0 = 0, bay = 3.0, color = FRAME, mast = true, stairs = true } = {}) {
  const c = w / 2;
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) M.box('metal', x + sx * c, y0 + h / 2, z + sz * c, 0.32, h, 0.32, color);
  const nb = Math.max(1, Math.round(h / bay)), bh = h / nb;
  const faces = [[[-c, -c], [c, -c]], [[c, -c], [c, c]], [[c, c], [-c, c]], [[-c, c], [-c, -c]]];
  for (let i = 0; i <= nb; i++) {
    const y = y0 + i * bh;
    for (const [[ax, az], [bx, bz]] of faces) {
      strut(M, [x + ax, y, z + az], [x + bx, y, z + bz], 0.2, color);
      if (i < nb) {
        strut(M, [x + ax, y, z + az], [x + bx, y + bh, z + bz], 0.11, color);
        strut(M, [x + bx, y, z + bz], [x + ax, y + bh, z + az], 0.11, color);
      }
    }
    if (stairs && i < nb) {
      const s = i % 2 ? 1 : -1;
      strut(M, [x - c * 0.6 * s, y + 0.1, z - c * 0.35], [x + c * 0.6 * s, y + bh - 0.1, z - c * 0.35], 0.5, 0x6f757c);
      M.box('metal', x, y + bh - 0.05, z, w - 0.3, 0.06, w - 0.3, 0x6f757c);
    }
  }
  const top = y0 + h;
  M.box('metal', x, top + 0.05, z, w + 1.0, 0.12, w + 1.0, 0x6f757c);
  railing(M, x - c - 0.5, z - c - 0.5, x + c + 0.5, z - c - 0.5, top + 0.1, 1.0, C.G);
  railing(M, x + c + 0.5, z - c - 0.5, x + c + 0.5, z + c + 0.5, top + 0.1, 1.0, C.G);
  railing(M, x + c + 0.5, z + c + 0.5, x - c - 0.5, z + c + 0.5, top + 0.1, 1.0, C.G);
  if (mast) antenna(M, x, top + 0.1, z, 4.5);
  for (const [sx, sz] of [[-1, -1], [1, 1]]) M.sphere('blink', x + sx * c, top + 0.3, z + sz * c, 0.12, L.red, 8);
  M.col(x - c - 0.2, y0, z - c - 0.2, x + c + 0.2, top + 0.2, z + c + 0.2);
  return top;
}

// grated walkway with rails between two points at height y
export function catwalk(M, ax, az, bx, bz, y, w = 1.1) {
  const len = Math.hypot(bx - ax, bz - az), yaw = Math.atan2(bx - ax, bz - az);
  M.add('metal', new THREE.BoxGeometry(w, 0.1, len), { pos: v((ax + bx) / 2, y, (az + bz) / 2), rot: e(0, yaw, 0), color: 0x6f757c });
  for (const s of [-1, 1]) {
    const ox = Math.cos(yaw) * s * w / 2, oz = -Math.sin(yaw) * s * w / 2;
    M.tube('metal', [[ax + ox, y + 1.0, az + oz], [bx + ox, y + 1.0, bz + oz]], 0.03, C.G, 4);
    M.tube('metal', [[ax + ox, y + 0.5, az + oz], [bx + ox, y + 0.5, bz + oz]], 0.02, C.G, 4);
  }
  for (const s of [0.15, 0.5, 0.85]) M.box('metal', ax + (bx - ax) * s, y - 0.25, az + (bz - az) * s, 0.15, 0.45, 0.15, FRAME);
}

// parallel pipes on T supports
export function pipeRack(M, ax, az, bx, bz, y, n = 3, colors = [0xb8bec4, 0xc9a640, 0x5b8ec7]) {
  const len = Math.hypot(bx - ax, bz - az), yaw = Math.atan2(bx - ax, bz - az), nx = Math.cos(yaw), nz = -Math.sin(yaw);
  const ns = Math.max(2, Math.round(len / 3));
  for (let i = 0; i <= ns; i++) {
    const t = i / ns, px = ax + (bx - ax) * t, pz = az + (bz - az) * t;
    M.box('metal', px, y / 2, pz, 0.16, y, 0.16, FRAME);
    M.box('metal', px, y, pz, Math.abs(nx) * n * 0.32 + 0.16, 0.12, Math.abs(nz) * n * 0.32 + 0.16, FRAME);
  }
  for (let k = 0; k < n; k++) {
    const o = (k - (n - 1) / 2) * 0.3;
    M.tube('metal', [[ax + nx * o, y + 0.16, az + nz * o], [bx + nx * o, y + 0.16, bz + nz * o]], 0.1, colors[k % colors.length], 8);
  }
}

// horizontal tank on saddles, steel, with a coloured band
export function tankH(M, x, y, z, len, r, { yaw = 0, band = C.Y } = {}) {
  const prof = [], head = r * 0.5, body = len - 2 * head;
  for (let i = 0; i <= 8; i++) { const a = i / 8 * PI / 2; prof.push(new THREE.Vector2(Math.sin(a) * r, -body / 2 - Math.cos(a) * head)); }
  for (let i = 0; i <= 8; i++) { const a = i / 8 * PI / 2; prof.push(new THREE.Vector2(Math.cos(a) * r, body / 2 + Math.sin(a) * head)); }
  const g = new THREE.LatheGeometry(prof, 28);
  g.rotateZ(-PI / 2); g.rotateY(yaw);
  M.add('steel', g, { pos: v(x, y, z), color: STEEL });
  const c = Math.cos(yaw), s = Math.sin(yaw);
  M.add('hull', new THREE.CylinderGeometry(r + 0.02, r + 0.02, 0.3, 28, 1, true), { pos: v(x, y, z), rot: e(0, yaw, PI / 2), color: band });
  for (const t of [-body * 0.3, body * 0.3]) M.box('metal', x + t * c, (y - r * 0.5) / 2, z - t * s, 0.25, y - r * 0.5, r * 1.3, FRAME, yaw);
}

export function floodMast(M, x, z, h = 7, face = PI) {
  M.cyl('metal', x, 0, z, 0.09, h, FRAME, 8);
  M.box('metal', x, h, z, 1.2, 0.12, 0.12, FRAME, face);
  for (const s of [-0.4, 0.4]) {
    const px = x + Math.cos(face) * s, pz = z - Math.sin(face) * s;
    M.box('metal', px, h + 0.25, pz, 0.36, 0.3, 0.22, C.D, face);
    M.box('emissive', px + Math.sin(face) * 0.12, h + 0.25, pz + Math.cos(face) * 0.12, 0.28, 0.22, 0.02, L.white, face);
  }
  M.light(x + Math.sin(face) * 1.2, h - 0.5, z + Math.cos(face) * 1.2, L.white, 2.2, 14);
  // the light shaft in the dusty night air, aimed down and out
  const tilt = 0.62, len = (h + 0.25) / Math.sin(tilt) * 0.95;
  const g = new THREE.CylinderGeometry(0.16, len * 0.3, len, 20, 1, true);
  g.translate(0, -len / 2, 0);
  const d = new THREE.Vector3(Math.sin(face) * Math.cos(tilt), -Math.sin(tilt), Math.cos(face) * Math.cos(tilt));
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), d);
  M.add('beam', g, { pos: v(x + Math.sin(face) * 0.15, h + 0.25, z + Math.cos(face) * 0.15), rot: new THREE.Euler().setFromQuaternion(q), color: 0xfff4e0, uvRect: [0, 0, 1, 1] });
}

// lit symbols that say what a building is for, on a dark plate facing `face`
export function symbol(M, kind, x, y, z, s, face, color) {
  M.box('metal', x, y, z, s * 1.25, s * 1.25, 0.1, C.D, face);
  const off = 0.07, fx = Math.sin(face) * off, fz = Math.cos(face) * off;
  const at = (lx, ly) => [x + Math.cos(face) * lx + fx, y + ly, z - Math.sin(face) * lx + fz];
  const bar = (lx, ly, w, h) => { const [px, py, pz] = at(lx, ly); M.box('emissive', px, py, pz, w, h, 0.03, color, face); };
  if (kind === 'cross') { bar(0, 0, s * 0.3, s * 0.9); bar(0, 0, s * 0.9, s * 0.3); }
  else if (kind === 'shield') { bar(0, s * 0.18, s * 0.7, s * 0.42); bar(0, -s * 0.12, s * 0.48, s * 0.3); bar(0, -s * 0.32, s * 0.22, s * 0.18); }
  else if (kind === 'book') { bar(-s * 0.22, 0, s * 0.38, s * 0.6); bar(s * 0.22, 0, s * 0.38, s * 0.6); bar(0, -s * 0.34, s * 0.86, s * 0.06); }
  else if (kind === 'flask') { bar(0, s * 0.28, s * 0.18, s * 0.34); bar(0, -s * 0.1, s * 0.46, s * 0.3); bar(0, -s * 0.3, s * 0.7, s * 0.14); }
  else if (kind === 'star') { bar(0, 0, s * 0.18, s * 0.9); bar(0, 0, s * 0.9, s * 0.18); bar(0, 0, s * 0.6, s * 0.6); }
}

// small domed module beside a drum, joined by a short tube
export function pod(M, x, z, r, color = C.W) {
  const top = habDome(M, x, z, r, { drum: 2.4, oculus: false, skip: [0, PI / 2, PI, -PI / 2] });
  return top;
}

export { STEEL, FRAME };
