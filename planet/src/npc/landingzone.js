// Ship landing zone next to the HQ: an octagonal pad of jointed concrete
// slabs with a hazard-striped curb, a scorched steel blast plate and
// touchdown markings, edge lights, an apron paved toward the HQ, four
// floodlight masts, blast berms, a propellant tank farm piped to an
// umbilical tower at the pad edge, and a windsock. Built in the pad's frame
// (+z faces the HQ, y = 0 is the pad top); everything outside the pad sits
// on the terrain where it stands.
import * as THREE from 'three';
import { GeoBuilder } from '../core/geobuilder.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const E = (x, y, z) => new THREE.Euler(x, y, z);
const PAD = 24;            // octagon circumradius: a 48 m pad, ~5x the ship's diameter
const AP = PAD * Math.cos(Math.PI / 8);

export const ZONE_RADIUS = 52;
const FARM_Z = -AP - 13;

// is a point (pad frame) occupied by the zone's structures?
export function zoneBlocks(lx, lz, r = 0) {
  const d = Math.hypot(lx, lz);
  if (d < PAD + 3 + r) return true;                                         // pad and its lights
  if (Math.abs(lx) < 15 + r && lz < -AP + r && lz > FARM_Z - 9 - r) return true;  // propellant farm
  if (Math.abs(lx) < 8 + r && lz > AP - r && lz < AP + 22 + r) return true;       // apron
  if (d > 36 - r && d < 39 + r && Math.abs(lz) < Math.abs(lx) * 0.5) return true;  // blast walls
  return false;
}

// solid parts for the collision world (pad frame): [x, z, radius, y0, y1] or boxes [x, z, hx, hz, y0, y1]
export function zoneColliders(gh) {
  const fz = FARM_Z, fg = Math.min(gh(-6, fz), gh(6, fz), gh(0, fz - 6)) - 0.3;
  const cyl = [[-10.5, fz - 2, 3.4, fg, fg + 8], [5, -10, 0.9, 0, 9.2]];
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4, mx = Math.cos(a) * 31, mz = Math.sin(a) * 31; cyl.push([mx, mz, 1.3, gh(mx, mz) - 0.4, gh(mx, mz) + 17.5]); }
  const box = [[-3.2, fz, 2.2, 7.1, fg, fg + 5.5], [3.2, fz, 2.2, 7.1, fg, fg + 5.5]];
  return { cyl, box };
}

export function buildLandingZone(game, site, rot) {
  const T = game.terrain, c = Math.cos(rot), s = Math.sin(rot);
  const gh = (lx, lz) => T.height(site.x + lx * c + lz * s, site.z - lx * s + lz * c) - site.y;
  const CON = new GeoBuilder(), STL = new GeoBuilder(), PNT = new GeoBuilder(), LIT = new GeoBuilder(), DRT = new GeoBuilder();
  const rnd = ((seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647)(1 + Math.floor(Math.abs(site.x * 13 + site.z * 7)) % 100000);
  const insideOct = (x, z, m = 0) => { for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; if (x * Math.cos(a) + z * Math.sin(a) > AP - m) return false; } return true; };
  const bar = (G, a, b, r, color, seg = 6) => {
    const d = b.clone().sub(a), g = new THREE.CylinderGeometry(r, r, d.length(), seg);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize()));
    G.add(g, { pos: a.clone().add(b).multiplyScalar(0.5), color });
  };

  // ---- pad: base octagon, slab field with joints, curb with hazard stripes, foundation skirt
  CON.add(new THREE.CircleGeometry(PAD, 8, Math.PI / 8).rotateX(-Math.PI / 2), { color: 0x55524e });
  for (let i = -6; i < 6; i++) for (let j = -6; j < 6; j++) {
    const x = i * 4 + 2, z = j * 4 + 2;
    if (!insideOct(x, z, 3.4)) continue;
    const v = 0.9 + rnd() * 0.16;
    CON.add(new THREE.BoxGeometry(3.9, 0.06, 3.9), { pos: V(x, 0.03, z), color: new THREE.Color(0x8e8a84).multiplyScalar(v) });
  }
  // perimeter band of cast concrete between the slabs and the curb
  const band = new THREE.RingGeometry(AP - 1.6, PAD - 0.05, 8, 1, Math.PI / 8); band.rotateX(-Math.PI / 2);
  CON.add(band, { pos: V(0, 0.035, 0), color: 0x7f7b75 });
  CON.add(new THREE.CylinderGeometry(PAD, PAD + 0.9, 4, 8, 1, true).rotateY(Math.PI / 8), { pos: V(0, -1.98, 0), color: 0x6d6964 });
  for (let k = 0; k < 8; k++) {
    const a0 = k * Math.PI / 4 + Math.PI / 8, a1 = a0 + Math.PI / 4;
    const p0 = V(Math.cos(a0) * (PAD - 0.3), 0, Math.sin(a0) * (PAD - 0.3)), p1 = V(Math.cos(a1) * (PAD - 0.3), 0, Math.sin(a1) * (PAD - 0.3));
    const n = 18, ang = -Math.atan2(p1.z - p0.z, p1.x - p0.x);
    for (let i = 0; i < n; i++) {
      const p = p0.clone().lerp(p1, (i + 0.5) / n), len = p0.distanceTo(p1) / n;
      PNT.add(new THREE.BoxGeometry(len * 0.98, 0.28, 0.6), { pos: V(p.x, 0.14, p.z), rot: E(0, ang, 0), color: i % 2 ? 0x1d1d1f : 0xd8a531 });
    }
  }

  // ---- blast plate: steel segments, scorch fading out from the centre, leg pads
  const plate = new THREE.RingGeometry(0, 10, 48, 8); plate.rotateX(-Math.PI / 2);
  STL.add(plate, { pos: V(0, 0.075, 0), color: (x, y, z) => { const r = Math.hypot(x, z); const k = Math.min(1, r / 10); const n = 0.75 + 0.25 * Math.sin(x * 1.7 + z * 2.3) * Math.sin(x * 0.6 - z * 0.9); return [0.03 + 0.16 * k * k * n, 0.028 + 0.15 * k * k * n, 0.026 + 0.14 * k * k * n]; } });
  for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; PNT.add(new THREE.BoxGeometry(10, 0.02, 0.07), { pos: V(Math.cos(a) * 5, 0.09, Math.sin(a) * 5), rot: E(0, -a, 0), color: 0x111214 }); }
  const seam = new THREE.RingGeometry(5.0, 5.07, 48); seam.rotateX(-Math.PI / 2);
  PNT.add(seam, { pos: V(0, 0.09, 0), color: 0x111214 });
  for (let k = 0; k < 6; k++) {
    const a = k * Math.PI / 3 + Math.PI / 6;
    STL.add(new THREE.CylinderGeometry(1.0, 1.05, 0.08, 24), { pos: V(Math.cos(a) * 5.6, 0.1, Math.sin(a) * 5.6), color: 0x6a6e73 });
  }
  // touchdown ring, corner brackets and an approach arrow toward the apron
  const tr = new THREE.RingGeometry(15, 15.6, 96); tr.rotateX(-Math.PI / 2);
  PNT.add(tr, { pos: V(0, 0.07, 0), color: 0xd8a531 });
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2 + Math.PI / 4, cx = Math.cos(a) * 18.5, cz = Math.sin(a) * 18.5;
    PNT.add(new THREE.BoxGeometry(2.2, 0.02, 0.35), { pos: V(cx, 0.07, cz), rot: E(0, -a + Math.PI / 2, 0), color: 0xf2f0ea });
  }
  for (const sx of [-1, 1]) PNT.add(new THREE.BoxGeometry(0.4, 0.02, 2.4), { pos: V(sx * 0.8, 0.07, 18.6), rot: E(0, sx * 0.5, 0), color: 0xf2f0ea });

  // ---- edge lights on short posts
  for (let k = 0; k < 16; k++) {
    const a = k * Math.PI / 8 + Math.PI / 8, r = k % 2 ? AP + 0.35 : PAD + 0.35;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    STL.add(new THREE.CylinderGeometry(0.07, 0.09, 0.5, 8), { pos: V(x, 0.25, z), color: 0x5d6268 });
    LIT.add(new THREE.SphereGeometry(0.13, 10, 8), { pos: V(x, 0.56, z), color: z > AP - 2 ? [6, 3.2, 0.6] : [0.9, 2.6, 7] });
  }

  // ---- apron toward the HQ: paved strip that follows the ground
  const AW = 12, AL = 22, ap = new THREE.PlaneGeometry(AW, AL, 6, 22); ap.rotateX(-Math.PI / 2); ap.translate(0, 0, AP + AL / 2 - 1.5);
  const app = ap.attributes.position;
  const apY = (x, z) => (z < AP + 1 ? 0.03 : gh(x, z) + 0.09);
  for (let i = 0; i < app.count; i++) app.setY(i, apY(app.getX(i), app.getZ(i)));
  ap.computeVertexNormals();
  CON.add(ap, { color: 0x77736d });
  for (let z = AP + 1.5; z < AP + AL - 2; z += 1) {
    for (const sx of [-1, 1]) PNT.add(new THREE.BoxGeometry(0.22, 0.03, 1.0), { pos: V(sx * (AW / 2 - 0.4), apY(sx * (AW / 2 - 0.4), z) + 0.02, z), color: 0xd8a531 });
    if (Math.round(z - AP) % 3 === 0) PNT.add(new THREE.BoxGeometry(0.25, 0.03, 1.4), { pos: V(0, apY(0, z) + 0.02, z), color: 0xf2f0ea });
  }

  // ---- floodlight masts: lattice towers at the four diagonals
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2 + Math.PI / 4, mx = Math.cos(a) * 31, mz = Math.sin(a) * 31, g0 = gh(mx, mz) - 0.4, H = 19;
    CON.add(new THREE.BoxGeometry(2.4, 1.0, 2.4), { pos: V(mx, g0 + 0.5, mz), color: 0x7c7873 });
    const w = 0.55, legs = [[-w, -w], [w, -w], [w, w], [-w, w]];
    for (const [ox, oz] of legs) bar(STL, V(mx + ox, g0 + 1, mz + oz), V(mx + ox * 0.6, g0 + H, mz + oz * 0.6), 0.06, 0x9a9fa5);
    for (let y = 1; y < H - 1; y += 2.2) {
      const t0 = 1 - 0.4 * (y - 1) / (H - 1), t1 = 1 - 0.4 * (y + 1.2) / (H - 1);
      for (let i = 0; i < 4; i++) {
        const [ax, az] = legs[i], [bx, bz] = legs[(i + 1) % 4];
        bar(STL, V(mx + ax * t0, g0 + y, mz + az * t0), V(mx + bx * t1, g0 + y + 2.2, mz + bz * t1), 0.025, 0xa7acb2, 4);
      }
    }
    // lamp head aimed at the pad
    const toC = Math.atan2(-mx, -mz);
    STL.add(new THREE.BoxGeometry(2.6, 0.12, 0.6), { pos: V(mx, g0 + H + 0.1, mz), rot: E(0, toC + Math.PI / 2, 0), color: 0x6c7176 });
    for (const o of [-0.9, 0, 0.9]) {
      const lx = mx + Math.cos(toC) * o, lz = mz - Math.sin(toC) * o;
      STL.add(new THREE.BoxGeometry(0.7, 0.5, 0.35), { pos: V(lx, g0 + H + 0.45, lz), rot: new THREE.Euler(0.35, toC, 0, 'YXZ'), color: 0x2e3135 });
      LIT.add(new THREE.BoxGeometry(0.58, 0.38, 0.04), { pos: V(lx + Math.sin(toC) * 0.19, g0 + H + 0.4, lz + Math.cos(toC) * 0.19), rot: new THREE.Euler(0.35, toC, 0, 'YXZ'), color: [7, 6.4, 5.2] });
    }
    LIT.add(new THREE.SphereGeometry(0.12, 8, 6), { pos: V(mx, g0 + H + 0.95, mz), color: [7, 0.6, 0.3] });
  }

  // ---- blast walls: precast concrete panels with buttresses on both flanks,
  // each panel standing on the ground where it is
  for (const side of [-1, 1]) {
    for (let i = -6; i <= 6; i++) {
      const aa = (side > 0 ? 0 : Math.PI) + i * 0.0745, r = 37;
      const x = Math.cos(aa) * r, z = Math.sin(aa) * r, g = gh(x, z) - 0.8;
      const yaw = -aa + Math.PI / 2, v = 0.92 + rnd() * 0.12;
      CON.add(new THREE.BoxGeometry(2.72, 3.6, 0.55), { pos: V(x, g + 1.8, z), rot: E(0, yaw, 0), color: new THREE.Color(0x8a8680).multiplyScalar(v) });
      CON.add(new THREE.BoxGeometry(2.72, 0.2, 0.7), { pos: V(x, g + 3.6, z), rot: E(0, yaw, 0), color: 0x77736d });
      // buttress on the outer face
      const bx = Math.cos(aa) * (r + 0.9), bz = Math.sin(aa) * (r + 0.9);
      CON.add(new THREE.BoxGeometry(0.45, 2.6, 1.6), { pos: V(bx, g + 1.3, bz), rot: E(0, yaw, 0), color: 0x7a7670 });
      // hazard band along the top of the inner face
      PNT.add(new THREE.BoxGeometry(2.72, 0.25, 0.02), { pos: V(Math.cos(aa) * (r - 0.29), g + 3.25, Math.sin(aa) * (r - 0.29)), rot: E(0, yaw, 0), color: i % 2 ? 0x1d1d1f : 0xd8a531 });
    }
  }

  // ---- propellant farm behind the pad: twin horizontal tanks, a sphere, piping, umbilical tower
  const fz = FARM_Z, fg = Math.min(gh(-6, fz), gh(6, fz), gh(0, fz - 6)) - 0.3;
  CON.add(new THREE.BoxGeometry(26, 0.6, 14), { pos: V(0, fg + 0.3, fz - 1), color: 0x7c7873 });
  for (const [x, col] of [[-3.2, 0xe8e7e2], [3.2, 0xcfd3d8]]) {
    const tank = new THREE.CylinderGeometry(2.1, 2.1, 12, 28); tank.rotateX(Math.PI / 2);
    STL.add(tank, { pos: V(x, fg + 3.3, fz), color: col });
    for (const ez of [-6, 6]) { const cap = new THREE.SphereGeometry(2.1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2); cap.scale(1, 0.45, 1); cap.rotateX(ez > 0 ? Math.PI / 2 : -Math.PI / 2); STL.add(cap, { pos: V(x, fg + 3.3, fz + ez), color: col }); }
    for (const sz of [-4, 0, 4]) CON.add(new THREE.BoxGeometry(3.6, 1.4, 0.7), { pos: V(x, fg + 1.2, fz + sz), color: 0x8b8781 });
    for (const sz of [-3, 3]) PNT.add(new THREE.CylinderGeometry(2.13, 2.13, 0.25, 28).rotateX(Math.PI / 2), { pos: V(x, fg + 3.3, fz + sz), color: x < 0 ? 0x2f6fb0 : 0xd8a531 });
  }
  const sph = V(-10.5, fg + 4.6, fz - 2);
  STL.add(new THREE.SphereGeometry(3.4, 28, 18), { pos: sph, color: 0xe8e7e2 });
  for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; bar(STL, V(sph.x + Math.cos(a) * 2.6, fg + 0.6, sph.z + Math.sin(a) * 2.6), V(sph.x + Math.cos(a) * 2.9, fg + 4.2, sph.z + Math.sin(a) * 2.9), 0.15, 0x9a9fa5, 8); }
  // pipe rack to the umbilical tower on the pad edge
  const ux = 5, uz = -10;
  for (const [px, col] of [[-3.2, 0x2f6fb0], [3.2, 0xd8a531]]) {
    const y = fg + 1.0 + (px > 0 ? 0.3 : 0);
    bar(STL, V(px, fg + 3.3, fz + 6.4), V(px, y, fz + 7.5), 0.16, 0xb8bcc1, 10);
    const pts = [V(px, y, fz + 7.5), V(px * 0.4 + ux * 0.6, y, -AP - 1.5), V(ux + px * 0.12, Math.min(y, -0.4), -AP + 0.2)];
    for (let i = 0; i < pts.length - 1; i++) bar(STL, pts[i], pts[i + 1], 0.16, 0xb8bcc1, 10);
    PNT.add(new THREE.CylinderGeometry(0.19, 0.19, 0.4, 10).rotateX(Math.PI / 2), { pos: pts[1].clone().add(V(0, 0, 0.6)), color: col });
  }
  for (let z = fz + 8.5; z < -AP - 1; z += 3) {
    const g = gh(0.5, z), top = fg + 0.82, h = top - g;
    if (h < 0.15) continue;
    STL.add(new THREE.BoxGeometry(8.5, 0.16, 0.3), { pos: V(0.5, top, z), color: 0x8b8781 });
    for (const sx of [-3.2, 3.6]) STL.add(new THREE.BoxGeometry(0.18, h, 0.18), { pos: V(sx, g + h / 2, z), color: 0x8b8781 });
  }
  // covered trench across the pad carrying the lines to the tower
  STL.add(new THREE.BoxGeometry(1.8, 0.05, AP + uz + 0.6), { pos: V(ux, 0.07, (uz - AP) / 2), color: 0x4c5055 });
  for (let z = -AP + 1; z < uz; z += 1.2) PNT.add(new THREE.BoxGeometry(1.82, 0.02, 0.05), { pos: V(ux, 0.1, z), color: 0x2a2c30 });
  // umbilical tower with an arm reaching toward the ship's base
  const UH = 9;
  for (const [ox, oz] of [[-0.6, -0.6], [0.6, -0.6], [0.6, 0.6], [-0.6, 0.6]]) bar(STL, V(ux + ox, 0, uz + oz), V(ux + ox, UH, uz + oz), 0.07, 0xd8a531);
  for (let y = 0.5; y < UH; y += 1.5) for (const [a, b] of [[[-0.6, -0.6], [0.6, -0.6]], [[0.6, -0.6], [0.6, 0.6]], [[0.6, 0.6], [-0.6, 0.6]], [[-0.6, 0.6], [-0.6, -0.6]]]) bar(STL, V(ux + a[0], y, uz + a[1]), V(ux + b[0], y + 1.5, uz + b[1]), 0.03, 0xd8a531, 4);
  STL.add(new THREE.BoxGeometry(1.6, 0.25, 1.6), { pos: V(ux, UH, uz), color: 0x5d6268 });
  bar(STL, V(ux, 2.6, uz + 0.6), V(ux * 0.55, 2.3, -5.4), 0.12, 0x9a9fa5, 8);
  bar(STL, V(ux, 3.4, uz + 0.6), V(ux * 0.55, 2.5, -5.4), 0.05, 0x9a9fa5, 6);
  STL.add(new THREE.BoxGeometry(0.8, 0.6, 0.5), { pos: V(ux * 0.55, 2.3, -5.4), color: 0x3a3d42 });
  LIT.add(new THREE.SphereGeometry(0.12, 8, 6), { pos: V(ux, UH + 0.3, uz), color: [7, 0.6, 0.3] });

  // ---- windsock by the apron
  const wx = -AW / 2 - 3, wz = AP + 6, wg = gh(wx, wz);
  STL.add(new THREE.CylinderGeometry(0.06, 0.08, 6, 8), { pos: V(wx, wg + 3, wz), color: 0xd0d3d6 });
  const sock = new THREE.CylinderGeometry(0.35, 0.16, 2.0, 12, 4, true); sock.rotateZ(Math.PI / 2 - 0.25);
  PNT.add(sock, { pos: V(wx + 1.0, wg + 5.7, wz), color: (x) => ((Math.floor((x + 1) * 2.5) % 2) ? [0.9, 0.9, 0.88] : [0.85, 0.22, 0.06]) });

  // ---- meshes
  const group = new THREE.Group();
  const mats = [
    [CON, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 })],
    [STL, new THREE.MeshPhysicalMaterial({ vertexColors: true, metalness: 0.75, roughness: 0.38 })],
    [PNT, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide })],
    [LIT, new THREE.MeshBasicMaterial({ vertexColors: true })],
    [DRT, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })],
  ];
  for (const [G, mat] of mats) {
    if (G.empty) continue;
    const m = new THREE.Mesh(G.build(), mat);
    m.receiveShadow = true; m.castShadow = G !== LIT && G !== CON;
    group.add(m);
  }
  group.position.set(site.x, site.y, site.z);
  group.rotation.y = rot;
  return group;
}
