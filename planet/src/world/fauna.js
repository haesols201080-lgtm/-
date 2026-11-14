// Life that arrives with terraforming: glowing pollinators near plants
// (Insects stage), flocks of gliding birds (Fauna stage, more once the
// ecosystem thrives) and herds of grazers wandering the grassland. All
// instanced; wings flap and legs step in the vertex shader.
import * as THREE from 'three';
import { U } from '../core/shared.js';
import { GeoBuilder, taperTube } from '../core/geobuilder.js';

// Gazelle-like grazer built from organic pieces: a lathed barrel body with a
// coat pattern (warm back, dark flank stripe, white belly and rump), a curved
// tapering neck, a head with muzzle, eyes, leaf ears and lyre horns, two-joint
// legs (hind legs with a hock) ending in hooves, and a tufted tail. Legs carry
// aLeg = +/-1 (diagonal pairs) for the stepping gait in the vertex shader.
function grazerGeometry() {
  const gb = new GeoBuilder(['aLeg']);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const back = [0.56, 0.36, 0.2], flank = [0.66, 0.45, 0.27], stripe = [0.17, 0.11, 0.07], white = [0.9, 0.86, 0.78], dark = [0.1, 0.08, 0.07], horn = [0.2, 0.17, 0.14];
  // body: lathe around its long axis (rump at -z, chest at +z)
  const prof = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const r = 0.29 * Math.pow(Math.sin(Math.PI * t), 0.55) * (0.9 + 0.12 * t);
    prof.push(new THREE.Vector2(Math.max(0.01, r), -0.62 + 1.24 * t));
  }
  const body = new THREE.LatheGeometry(prof, 20); body.rotateX(Math.PI / 2); body.scale(0.82, 1.0, 1.0);
  gb.add(body, { pos: V(0, 1.05, 0), attrs: { aLeg: 0 }, color: (x, y, z) => {
    // local: x side, y up (after rotation the lathe axis is z)
    if (z < -0.42 && y < 0.12) return white;                      // rump patch
    if (y < -0.1) return white;                                    // belly
    if (y < -0.02) return stripe;                                  // flank stripe
    return y > 0.14 ? back : flank;
  } });
  // neck: tapered curve from the chest up to the head
  const neckC = new THREE.CatmullRomCurve3([V(0, 1.16, 0.42), V(0, 1.42, 0.6), V(0, 1.68, 0.74)]);
  gb.add(taperTube(neckC, 10, 10, (t) => 0.12 - t * 0.055), { attrs: { aLeg: 0 }, color: (x, y, z, nx, ny, nz) => (nz > 0.35 && ny < 0.3 ? white : flank) });
  // head + muzzle
  const head = new THREE.SphereGeometry(0.1, 14, 10); head.scale(0.85, 0.9, 1.25);
  gb.add(head, { pos: V(0, 1.75, 0.78), attrs: { aLeg: 0 }, color: flank });
  const muzzle = new THREE.CylinderGeometry(0.045, 0.075, 0.2, 10); muzzle.rotateX(Math.PI / 2 + 0.55);
  gb.add(muzzle, { pos: V(0, 1.69, 0.9), attrs: { aLeg: 0 }, color: (x, y) => (y > 0.07 ? dark : white) });
  gb.add(new THREE.SphereGeometry(0.03, 8, 6), { pos: V(0, 1.64, 0.99), attrs: { aLeg: 0 }, color: dark });
  for (const sx of [-1, 1]) {
    gb.add(new THREE.SphereGeometry(0.022, 8, 6), { pos: V(sx * 0.072, 1.78, 0.82), attrs: { aLeg: 0 }, color: dark });
    const ear = new THREE.SphereGeometry(0.06, 8, 6); ear.scale(0.35, 1.4, 0.7); ear.rotateZ(sx * 0.9);
    gb.add(ear, { pos: V(sx * 0.1, 1.86, 0.72), attrs: { aLeg: 0 }, color: flank });
    const hc = new THREE.CatmullRomCurve3([V(sx * 0.035, 1.84, 0.76), V(sx * 0.07, 2.02, 0.7), V(sx * 0.05, 2.18, 0.6), V(sx * 0.07, 2.27, 0.66)]);
    gb.add(taperTube(hc, 12, 6, (t) => 0.022 * (1 - t * 0.8)), { attrs: { aLeg: 0 }, color: horn });
  }
  // tail with a dark tuft
  const tc = new THREE.CatmullRomCurve3([V(0, 1.12, -0.6), V(0, 1.02, -0.7), V(0, 0.88, -0.7)]);
  gb.add(taperTube(tc, 6, 6, (t) => 0.03 * (1 - t * 0.5)), { attrs: { aLeg: 0 }, color: (x, y) => (y < 0.95 ? dark : white) });
  // legs: hip -> knee/hock -> fetlock, hooves
  const legs = [
    { x: -0.12, z: 0.34, ph: 1, hind: false }, { x: 0.12, z: 0.34, ph: -1, hind: false },
    { x: -0.12, z: -0.38, ph: -1, hind: true }, { x: 0.12, z: -0.38, ph: 1, hind: true },
  ];
  for (const L of legs) {
    const pts = L.hind
      ? [V(L.x, 1.0, L.z), V(L.x, 0.72, L.z + 0.08), V(L.x, 0.48, L.z - 0.1), V(L.x, 0.08, L.z - 0.04)]
      : [V(L.x, 1.0, L.z), V(L.x, 0.62, L.z + 0.02), V(L.x, 0.36, L.z), V(L.x, 0.08, L.z + 0.02)];
    const c = new THREE.CatmullRomCurve3(pts);
    gb.add(taperTube(c, 14, 8, (t) => (t < 0.35 ? 0.075 - t * 0.09 : 0.044 - (t - 0.35) * 0.025)), { attrs: { aLeg: L.ph }, color: (x, y) => (y > 0.7 ? flank : y > 0.2 ? [0.62, 0.48, 0.34] : white) });
    const hoof = new THREE.CylinderGeometry(0.026, 0.034, 0.08, 8);
    gb.add(hoof, { pos: V(L.x, 0.04, pts[3].z + 0.005), attrs: { aLeg: L.ph }, color: dark });
  }
  return gb.build();
}

// Parametric quadruped in the grazer frame: hips at y = 1, legs to the
// ground (the gait shader swings them about the hip), head at +z. Species
// differ in build, neck, head, horns or antlers, mane, tail and coat pattern;
// the herd code scales each species to its real size.
function quadruped(P) {
  const gb = new GeoBuilder(['aLeg']);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const { len = 0.62, r = 0.29, sx = 0.82, neck = 0.55, neckUp = 1.0, head = 0.1, muz = 0.2, back, flank, belly, dark = [0.1, 0.08, 0.07], legC = null, pat = 'none', horns = 'none', hornC = [0.2, 0.17, 0.14], mane = null, tail = 'tuft', ear = 1, hump = 0, wool = 0, legR = 1 } = P;
  const prof = [];
  for (let i = 0; i <= 18; i++) {
    const t = i / 18;
    prof.push(new THREE.Vector2(Math.max(0.01, r * Math.pow(Math.sin(Math.PI * t), 0.55) * (0.9 + 0.12 * t)), -len + 2 * len * t));
  }
  const body = new THREE.LatheGeometry(prof, 22); body.rotateX(Math.PI / 2); body.scale(sx, 1.0, 1.0);
  if (wool) { const B = body.attributes.position; for (let i = 0; i < B.count; i++) { const x = B.getX(i), y = B.getY(i), z = B.getZ(i); const k = 1 + wool * Math.sin(x * 40) * Math.sin(y * 37 + 1) * Math.sin(z * 43 + 2); B.setXYZ(i, x * k, y * k, z); } body.computeVertexNormals(); }
  const coat = (x, y, z) => {
    if (y < -r * 0.35) return belly;
    if (pat === 'stripes') return Math.sin(z * 26 + Math.sin(y * 9) * 1.4) > 0.1 ? dark : belly;
    if (pat === 'spots' && y > -r * 0.2 && Math.sin(x * 70) * Math.sin(z * 64 + 1) * Math.sin(y * 58 + 2) > 0.18) return belly;
    if (pat === 'saddle' && y > r * 0.3) return back;
    if (z < -len * 0.7 && y < r * 0.4 && P.rump) return P.rump;
    return y > r * 0.45 ? back : flank;
  };
  gb.add(body, { pos: V(0, 1.05, 0), attrs: { aLeg: 0 }, color: coat });
  if (hump) { const h = new THREE.SphereGeometry(r, 14, 10); h.scale(sx * 0.9, hump, 1.0); gb.add(h, { pos: V(0, 1.05 + r * 0.55, len * 0.55), attrs: { aLeg: 0 }, color: back }); }
  // neck and head
  const c0 = V(0, 1.12, len * 0.68), hp = V(0, 1.12 + neck * neckUp, len * 0.68 + neck * (1.15 - neckUp * 0.55));
  const nc = new THREE.CatmullRomCurve3([c0, c0.clone().lerp(hp, 0.5).add(V(0, 0.04, -0.03)), hp]);
  gb.add(taperTube(nc, 10, 10, (t) => r * 0.45 - t * r * 0.2), { attrs: { aLeg: 0 }, color: (x, y, z) => (pat === 'stripes' ? coat(x, y, z * 2) : flank) });
  const hd = new THREE.SphereGeometry(head, 14, 10); hd.scale(0.85, 0.9, 1.25);
  gb.add(hd, { pos: hp.clone().add(V(0, 0.04, 0.04)), attrs: { aLeg: 0 }, color: flank });
  const mz = new THREE.CylinderGeometry(head * 0.45, head * 0.75, muz, 10); mz.rotateX(Math.PI / 2 + 0.6);
  gb.add(mz, { pos: hp.clone().add(V(0, -0.03, muz * 0.55 + head * 0.4)), attrs: { aLeg: 0 }, color: (x, y) => (y > 0.03 ? flank : P.muzzle || dark) });
  for (const s2 of [-1, 1]) {
    gb.add(new THREE.SphereGeometry(head * 0.2, 8, 6), { pos: hp.clone().add(V(s2 * head * 0.72, head * 0.35, head * 0.5)), attrs: { aLeg: 0 }, color: dark });
    const er = new THREE.SphereGeometry(head * 0.6 * ear, 8, 6); er.scale(0.35, 1.4, 0.7); er.rotateZ(s2 * 0.9);
    gb.add(er, { pos: hp.clone().add(V(s2 * head, head * 0.9, -head * 0.2)), attrs: { aLeg: 0 }, color: flank });
    const hb = hp.clone().add(V(s2 * head * 0.35, head * 0.85, -head * 0.1));
    if (horns === 'spiral' || horns === 'curveBack') {
      const back2 = horns === 'curveBack';
      const hc = new THREE.CatmullRomCurve3([hb, hb.clone().add(V(s2 * 0.04, 0.18, back2 ? -0.12 : -0.04)), hb.clone().add(V(s2 * 0.06, back2 ? 0.26 : 0.36, back2 ? -0.32 : -0.12)), hb.clone().add(V(s2 * (back2 ? 0.05 : 0.08), back2 ? 0.2 : 0.44, back2 ? -0.46 : -0.06))]);
      gb.add(taperTube(hc, 14, 7, (t) => (back2 ? 0.045 : 0.024) * (1 - t * 0.8)), { attrs: { aLeg: 0 }, color: hornC });
    } else if (horns === 'antler' || horns === 'palmate') {
      const beam = new THREE.CatmullRomCurve3([hb, hb.clone().add(V(s2 * 0.16, 0.22, -0.06)), hb.clone().add(V(s2 * 0.3, 0.5, -0.1)), hb.clone().add(V(s2 * 0.36, 0.78, 0.02))]);
      gb.add(taperTube(beam, 12, 6, (t) => 0.03 * (1 - t * 0.6)), { attrs: { aLeg: 0 }, color: hornC });
      if (horns === 'palmate') {
        const palm = new THREE.SphereGeometry(0.2, 10, 6); palm.scale(1.3, 0.12, 0.9);
        gb.add(palm, { pos: hb.clone().add(V(s2 * 0.34, 0.55, -0.06)), rot: new THREE.Euler(0, 0, s2 * 0.5), attrs: { aLeg: 0 }, color: hornC });
      } else {
        for (const t of [0.35, 0.6, 0.85]) {
          const b0 = beam.getPoint(t), tip = b0.clone().add(V(s2 * 0.04, 0.16, 0.12));
          gb.add(taperTube(new THREE.LineCurve3(b0, tip), 3, 5, (u) => 0.016 * (1 - u * 0.7)), { attrs: { aLeg: 0 }, color: hornC });
        }
      }
    } else if (horns === 'tusks') {
      const tc = new THREE.CatmullRomCurve3([hp.clone().add(V(s2 * head * 0.5, -head * 0.5, muz + head * 0.2)), hp.clone().add(V(s2 * head * 0.75, -head * 0.1, muz + head * 0.35)), hp.clone().add(V(s2 * head * 0.7, head * 0.25, muz + head * 0.25))]);
      gb.add(taperTube(tc, 6, 5, (t) => 0.02 * (1 - t * 0.7)), { attrs: { aLeg: 0 }, color: [0.88, 0.84, 0.74] });
    }
  }
  // mane along the neck
  if (mane) { const mc = new THREE.CatmullRomCurve3([c0.clone().add(V(0, r * 0.35, -0.05)), c0.clone().lerp(hp, 0.5).add(V(0, r * 0.5, -0.05)), hp.clone().add(V(0, head * 0.9, -head * 0.6))]); gb.add(taperTube(mc, 10, 6, () => 0.035), { attrs: { aLeg: 0 }, color: mane }); }
  // tail
  const t0 = V(0, 1.1, -len);
  if (tail === 'long') { const tc = new THREE.CatmullRomCurve3([t0, t0.clone().add(V(0, -0.15, -0.12)), t0.clone().add(V(0, -0.6, -0.14))]); gb.add(taperTube(tc, 8, 7, (t) => 0.03 + t * 0.05), { attrs: { aLeg: 0 }, color: mane || dark }); }
  else if (tail === 'short') gb.add(new THREE.SphereGeometry(0.06, 8, 6), { pos: t0.clone().add(V(0, 0.02, -0.03)), attrs: { aLeg: 0 }, color: P.rump || flank });
  else { const tc = new THREE.CatmullRomCurve3([t0, t0.clone().add(V(0, -0.1, -0.1)), t0.clone().add(V(0, -0.25, -0.1))]); gb.add(taperTube(tc, 6, 6, (t) => 0.025 * (1 - t * 0.4)), { attrs: { aLeg: 0 }, color: (x, y) => (y < -0.17 ? dark : flank) }); }
  // legs: hip -> knee/hock -> fetlock -> hoof
  const lx = r * sx * 0.45, lz = len * 0.58;
  for (const L of [{ x: -lx, z: lz, ph: 1, hind: false }, { x: lx, z: lz, ph: -1, hind: false }, { x: -lx, z: -lz, ph: -1, hind: true }, { x: lx, z: -lz, ph: 1, hind: true }]) {
    const pts = L.hind ? [V(L.x, 1.0, L.z), V(L.x, 0.72, L.z + 0.08), V(L.x, 0.46, L.z - 0.1), V(L.x, 0.08, L.z - 0.04)] : [V(L.x, 1.0, L.z), V(L.x, 0.62, L.z + 0.02), V(L.x, 0.36, L.z), V(L.x, 0.08, L.z + 0.02)];
    gb.add(taperTube(new THREE.CatmullRomCurve3(pts), 14, 8, (t) => legR * (t < 0.35 ? 0.08 - t * 0.09 : 0.048 - (t - 0.35) * 0.026)), { attrs: { aLeg: L.ph }, color: (x, y) => (y > 0.75 ? flank : (legC || flank)) });
    gb.add(new THREE.CylinderGeometry(0.03 * legR, 0.038 * legR, 0.08, 8), { pos: V(L.x, 0.04, pts[3].z + 0.005), attrs: { aLeg: L.ph }, color: dark });
  }
  return gb.build();
}

// Small lake fish: spindle body with a forked tail and dorsal fin; the tail
// beats in the vertex shader (aFin = distance along the body).
function fishGeometry() {
  const gb = new GeoBuilder(['aLeg']);
  const prof = [];
  for (let i = 0; i <= 10; i++) { const t = i / 10; prof.push(new THREE.Vector2(Math.max(0.004, 0.075 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.05)), 0.8)), -0.22 + 0.44 * t)); }
  const body = new THREE.LatheGeometry(prof, 10); body.rotateX(Math.PI / 2); body.scale(0.55, 1, 1);
  gb.add(body, { color: (x, y) => (y > 0.01 ? [0.2, 0.26, 0.24] : [0.72, 0.74, 0.68]), attrs: { aLeg: (x, y, z) => Math.max(0, -z) } });
  const tail = new THREE.BufferGeometry();
  tail.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.2, 0, 0.09, -0.32, 0, 0, -0.27, 0, 0, -0.2, 0, 0, -0.27, 0, -0.09, -0.32], 3));
  tail.computeVertexNormals();
  gb.add(tail, { color: [0.24, 0.3, 0.28], attrs: { aLeg: (x, y, z) => -z } });
  const fin = new THREE.BufferGeometry();
  fin.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.05, 0.04, 0, 0.11, -0.04, 0, 0.05, -0.08], 3));
  fin.computeVertexNormals();
  gb.add(fin, { color: [0.2, 0.26, 0.24], attrs: { aLeg: 0.05 } });
  return gb.build();
}

function fishMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.3, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime; attribute float aLeg;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
        float ph = instanceMatrix[3][0] * 2.1 + instanceMatrix[3][2] * 1.7;
        #else
        float ph = 0.0;
        #endif
        transformed.x += sin(uTime * 9.0 + ph - aLeg * 8.0) * aLeg * 0.35;`);
  };
  m.customProgramCacheKey = () => 'fish-v1';
  return m;
}

// Hare: compact body, long ears, white scut, big hind legs (it hops; the hop
// is driven on the CPU)
function hareGeometry() {
  const gb = new GeoBuilder(['aLeg']);
  const fur = [0.5, 0.4, 0.3], belly = [0.82, 0.76, 0.66], dark = [0.12, 0.1, 0.09];
  const body = new THREE.SphereGeometry(0.16, 12, 9); body.scale(0.85, 0.8, 1.35);
  gb.add(body, { pos: new THREE.Vector3(0, 0.2, -0.02), color: (x, y) => (y < -0.07 ? belly : fur), attrs: { aLeg: 0 } });
  const head = new THREE.SphereGeometry(0.075, 10, 8); head.scale(0.85, 0.85, 1.2);
  gb.add(head, { pos: new THREE.Vector3(0, 0.33, 0.17), color: fur, attrs: { aLeg: 0 } });
  for (const sx of [-1, 1]) {
    const ear = new THREE.SphereGeometry(1, 8, 6); ear.scale(0.022, 0.1, 0.012);
    gb.add(ear, { pos: new THREE.Vector3(sx * 0.03, 0.47, 0.13), rot: new THREE.Euler(-0.35, 0, sx * 0.18), color: (x, y) => (y > 0.07 ? dark : fur), attrs: { aLeg: 0 } });
    gb.add(new THREE.SphereGeometry(0.012, 6, 4), { pos: new THREE.Vector3(sx * 0.045, 0.35, 0.22), color: dark, attrs: { aLeg: 0 } });
    const hind = new THREE.SphereGeometry(1, 8, 6); hind.scale(0.05, 0.08, 0.13);
    gb.add(hind, { pos: new THREE.Vector3(sx * 0.1, 0.1, -0.12), color: fur, attrs: { aLeg: 0 } });
    const fore = new THREE.CylinderGeometry(0.018, 0.022, 0.16, 5);
    gb.add(fore, { pos: new THREE.Vector3(sx * 0.06, 0.08, 0.12), color: fur, attrs: { aLeg: 0 } });
  }
  gb.add(new THREE.SphereGeometry(0.04, 6, 5), { pos: new THREE.Vector3(0, 0.24, -0.24), color: [0.95, 0.93, 0.9], attrs: { aLeg: 0 } });
  return gb.build();
}

// Bison: massive shoulder hump, low head with short curved horns, shaggy
// dark mane over the forequarters, beard, short sturdy legs
function bisonGeometry() {
  const gb = new GeoBuilder(['aLeg']);
  const coat = [0.26, 0.17, 0.11], mane = [0.15, 0.1, 0.07], horn = [0.12, 0.11, 0.1];
  const prof = [];
  for (let i = 0; i <= 16; i++) { const t = i / 16; prof.push(new THREE.Vector2(Math.max(0.01, 0.52 * Math.pow(Math.sin(Math.PI * t), 0.5) * (0.78 + 0.32 * t)), -1.0 + 2.0 * t)); }
  const body = new THREE.LatheGeometry(prof, 18); body.rotateX(Math.PI / 2); body.scale(0.95, 1.1, 1);
  gb.add(body, { pos: new THREE.Vector3(0, 1.18, 0), color: (x, y, z) => (z > 0.1 ? mane : coat), attrs: { aLeg: 0 } });
  const hump = new THREE.SphereGeometry(0.5, 14, 10); hump.scale(0.85, 0.85, 1.05);
  gb.add(hump, { pos: new THREE.Vector3(0, 1.5, 0.55), color: mane, attrs: { aLeg: 0 } });
  const head = new THREE.SphereGeometry(0.3, 12, 10); head.scale(0.9, 1.0, 1.15);
  gb.add(head, { pos: new THREE.Vector3(0, 1.0, 1.15), color: mane, attrs: { aLeg: 0 } });
  const beard = new THREE.ConeGeometry(0.16, 0.42, 8); beard.rotateX(Math.PI);
  gb.add(beard, { pos: new THREE.Vector3(0, 0.66, 1.22), color: mane, attrs: { aLeg: 0 } });
  gb.add(new THREE.SphereGeometry(0.1, 8, 6), { pos: new THREE.Vector3(0, 0.92, 1.45), color: [0.08, 0.07, 0.06], attrs: { aLeg: 0 } });
  for (const sx of [-1, 1]) {
    const hc = new THREE.CatmullRomCurve3([new THREE.Vector3(sx * 0.2, 1.18, 1.18), new THREE.Vector3(sx * 0.36, 1.25, 1.18), new THREE.Vector3(sx * 0.38, 1.42, 1.22)]);
    gb.add(taperTube(hc, 6, 6, (t) => 0.05 * (1 - t * 0.75)), { color: horn, attrs: { aLeg: 0 } });
  }
  const tail = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 1.3, -1.0), new THREE.Vector3(0, 1.0, -1.1), new THREE.Vector3(0, 0.7, -1.08)]);
  gb.add(taperTube(tail, 5, 5, (t) => 0.035 + t * 0.03), { color: mane, attrs: { aLeg: 0 } });
  for (const [lx, lz, ph] of [[-0.26, 0.6, 1], [0.26, 0.6, -1], [-0.26, -0.6, -1], [0.26, -0.6, 1]]) {
    const leg = new THREE.CylinderGeometry(0.07, 0.11, 0.9, 7);
    gb.add(leg, { pos: new THREE.Vector3(lx, 0.45, lz), color: (x, y) => (y < -0.35 ? horn : lz > 0 ? mane : coat), attrs: { aLeg: ph } });
  }
  return gb.build();
}

function grazerMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime; attribute float aLeg;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
        float gait = length(instanceMatrix[1].xyz) / max(1e-4, length(instanceMatrix[0].xyz));   // y/x scale ratio carries walking speed (1.0 = still)
        float ph = instanceMatrix[3][0] * 0.37 + instanceMatrix[3][2] * 0.29;
        #else
        float gait = 1.0; float ph = 0.0;
        #endif
        float walk = clamp((gait - 1.0) * 40.0, 0.0, 1.0);
        if (aLeg != 0.0) {
          float sw = sin(uTime * 7.0 + ph) * aLeg * 0.45 * walk;
          float k = clamp((1.0 - position.y) / 0.92, 0.0, 1.0);
          transformed.z += sin(sw) * k * 0.92;
          transformed.y += (1.0 - cos(sw)) * k * 0.18;
        }`);
  };
  m.customProgramCacheKey = () => 'grazer-v3';
  return m;
}

function wingMaterial(color, glow) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.7, side: THREE.DoubleSide, emissive: glow ? color : 0x000000, emissiveIntensity: glow ? 0.6 : 0 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
        float ph = instanceMatrix[3][0] * 1.7 + instanceMatrix[3][2] * 1.3;
        #else
        float ph = 0.0;
        #endif
        float flap = sin(uTime * ${glow ? '22.0' : '6.0'} + ph) * ${glow ? '0.9' : '0.55'};
        float side = sign(position.x);
        float ax = abs(position.x);
        transformed.y += ax * sin(flap) * side * side;
        transformed.x = side * ax * cos(flap);`);
  };
  m.customProgramCacheKey = () => 'wing' + glow;
  return m;
}

const _bc = new THREE.Color();
// pollinators and other insects: ten kinds told apart by colour
const BUGS = [[1, 0.7, 0.25], [0.4, 0.9, 1], [1, 0.4, 0.8], [0.98, 0.92, 0.3], [0.95, 0.95, 0.95], [0.35, 0.6, 1], [1, 0.45, 0.15], [0.55, 1, 0.45], [0.75, 0.5, 1], [0.95, 0.25, 0.2]];

export class Fauna {
  constructor(game) {
    this.game = game;
    const scene = game.engine.scene;
    // pollinator: two wing quads
    const bug = new THREE.BufferGeometry();
    bug.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0.09, 0, -0.04, 0.08, 0, 0.06, 0, 0, 0, -0.08, 0, 0.06, -0.09, 0, -0.04], 3));
    bug.computeVertexNormals();
    this.bugs = new THREE.InstancedMesh(bug, wingMaterial(new THREE.Color(1.0, 0.7, 0.25), true), 120);
    this.bugs.count = 0; this.bugs.frustumCulled = false;
    this.bugs.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(120 * 3).fill(1), 3);
    scene.add(this.bugs);
    this.bugList = [];
    // bird: body + two wings
    const bird = new THREE.BufferGeometry();
    const W = 1.4;
    bird.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.5, W, 0, 0.1, 0, 0, 0.35, 0, 0, -0.5, 0, 0, 0.35, -W, 0, 0.1, 0, 0, -0.6, 0.12, 0.05, 0.3, -0.12, 0.05, 0.3], 3));
    bird.computeVertexNormals();
    this.birds = new THREE.InstancedMesh(bird, wingMaterial(new THREE.Color(0.85, 0.82, 0.78), false), 96);
    this.birds.count = 0; this.birds.frustumCulled = false; this.birds.castShadow = true;
    this.birds.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(96 * 3).fill(1), 3);
    scene.add(this.birds);
    this.flocks = [];
    this.m4 = new THREE.Matrix4();
    // herbivores in the order they arrive: hares, gazelles, then bison
    const mk = (geo, n) => { const m = new THREE.InstancedMesh(geo, grazerMaterial(), n); m.count = 0; m.frustumCulled = false; m.castShadow = true; m.receiveShadow = true; scene.add(m); return m; };
    this.grazers = mk(grazerGeometry(), 64);
    const Q = (P) => mk(quadruped(P), 32);
    this.kinds = [
      { id: 'hare', name: '산토끼', mesh: mk(hareGeometry(), 48), from: 10.7, groups: (s) => (s >= 11.45 ? 3 : 2), size: [2, 4], spread: 8, speed: 2.6, hop: true },
      { id: 'gazelle', name: '가젤', mesh: this.grazers, from: 11, groups: (s) => (s >= 11.45 ? 3 : 2), size: [3, 6], spread: 14, speed: 1.6 },
      { id: 'deer', name: '붉은사슴', mesh: Q({ len: 0.6, r: 0.31, neck: 0.6, head: 0.11, back: [0.46, 0.26, 0.14], flank: [0.54, 0.31, 0.17], belly: [0.78, 0.68, 0.55], rump: [0.86, 0.8, 0.7], tail: 'short', horns: 'antler', hornC: [0.42, 0.34, 0.24] }), from: 11.1, groups: () => 1, size: [3, 5], spread: 14, speed: 1.4, scale: 1.2 },
      { id: 'fallow', name: '꽃사슴', mesh: Q({ len: 0.56, r: 0.28, neck: 0.55, head: 0.1, back: [0.5, 0.32, 0.18], flank: [0.58, 0.38, 0.21], belly: [0.9, 0.86, 0.78], pat: 'spots', tail: 'short', rump: [0.92, 0.9, 0.84], horns: 'palmate', hornC: [0.5, 0.42, 0.3] }), from: 11.15, groups: () => 1, size: [3, 6], spread: 12, speed: 1.5, scale: 1.0 },
      { id: 'ibex', name: '산양', mesh: Q({ len: 0.5, r: 0.31, neck: 0.4, neckUp: 0.8, head: 0.1, back: [0.5, 0.44, 0.36], flank: [0.6, 0.53, 0.43], belly: [0.82, 0.78, 0.7], legC: [0.25, 0.2, 0.16], horns: 'curveBack', hornC: [0.36, 0.3, 0.24], tail: 'short', legR: 1.15 }), from: 11.2, groups: () => 1, size: [2, 5], spread: 10, speed: 1.2, scale: 0.95 },
      { id: 'boar', name: '멧돼지', mesh: Q({ len: 0.62, r: 0.4, sx: 0.8, neck: 0.12, neckUp: 0.2, head: 0.16, muz: 0.24, back: [0.18, 0.15, 0.13], flank: [0.26, 0.21, 0.17], belly: [0.3, 0.25, 0.2], muzzle: [0.35, 0.28, 0.25], horns: 'tusks', ear: 1.3, wool: 0.04, tail: 'tuft', legR: 1.25, hump: 0.55 }), from: 11.25, groups: () => 1, size: [3, 6], spread: 9, speed: 1.6, scale: 0.68 },
      { id: 'llama', name: '라마', mesh: Q({ len: 0.55, r: 0.3, neck: 0.85, neckUp: 1.35, head: 0.1, back: [0.82, 0.76, 0.66], flank: [0.84, 0.78, 0.68], belly: [0.8, 0.74, 0.64], legC: [0.62, 0.52, 0.42], ear: 1.5, wool: 0.06, tail: 'short' }), from: 11.3, groups: () => 1, size: [3, 6], spread: 12, speed: 1.2, scale: 1.15 },
      { id: 'horse', name: '야생마', mesh: Q({ len: 0.72, r: 0.33, neck: 0.7, neckUp: 0.95, head: 0.12, muz: 0.32, back: [0.32, 0.19, 0.1], flank: [0.38, 0.22, 0.12], belly: [0.4, 0.25, 0.14], legC: [0.1, 0.08, 0.07], mane: [0.08, 0.06, 0.05], tail: 'long' }), from: 11.35, groups: () => 1, size: [4, 7], spread: 16, speed: 1.9, scale: 1.35 },
      { id: 'zebra', name: '얼룩말', mesh: Q({ len: 0.7, r: 0.34, neck: 0.65, neckUp: 0.95, head: 0.12, muz: 0.3, back: [0.08, 0.08, 0.08], flank: [0.08, 0.08, 0.08], belly: [0.93, 0.92, 0.88], dark: [0.07, 0.07, 0.07], pat: 'stripes', mane: [0.1, 0.1, 0.1], tail: 'long' }), from: 11.4, groups: () => 1, size: [4, 8], spread: 16, speed: 1.8, scale: 1.25 },
      { id: 'bison', name: '들소', mesh: mk(bisonGeometry(), 40), from: 11.45, groups: () => 2, size: [4, 8], spread: 18, speed: 1.1 },
      { id: 'moose', name: '말코손바닥사슴', mesh: Q({ len: 0.72, r: 0.38, neck: 0.45, neckUp: 0.8, head: 0.15, muz: 0.32, back: [0.16, 0.11, 0.08], flank: [0.22, 0.15, 0.1], belly: [0.3, 0.22, 0.16], legC: [0.52, 0.44, 0.36], horns: 'palmate', hornC: [0.58, 0.5, 0.4], hump: 0.6, tail: 'short' }), from: 11.45, groups: () => 1, size: [1, 3], spread: 20, speed: 1.2, scale: 1.75 },
    ];
    this.herds = [];
    this.fish = new THREE.InstancedMesh(fishGeometry(), fishMaterial(), 120);
    this.fish.count = 0; this.fish.frustumCulled = false;
    this.fish.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(120 * 3).fill(1), 3);
    scene.add(this.fish);
    this.schools = [];
  }

  update(dt, cam) {
    const T = this.game.terra;
    const s = T.sVis;
    const terrain = this.game.terrain;
    // pollinators near the player once insects exist
    const wantBugs = s >= 9 ? Math.min(120, Math.floor((s - 9) * 60 + 30)) : 0;
    while (this.bugList.length < wantBugs) {
      const a = Math.random() * 6.28, r = 6 + Math.random() * 45;
      const x = cam.x + Math.cos(a) * r, z = cam.z + Math.sin(a) * r;
      this.bugList.push({ x, z, y: terrain.height(x, z) + 0.6 + Math.random() * 1.6, h: Math.random() * 6.28, sp: 1 + Math.random() * 2, c: BUGS[Math.floor(Math.random() * BUGS.length)] });
    }
    this.bugList.length = Math.min(this.bugList.length, wantBugs);
    const q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1), col = new THREE.Color();
    let n = 0;
    for (const b of this.bugList) {
      b.h += (Math.random() - 0.5) * dt * 4;
      b.x += Math.cos(b.h) * b.sp * dt; b.z += Math.sin(b.h) * b.sp * dt;
      const gy = terrain.height(b.x, b.z);
      b.y += ((gy + 0.8 + Math.sin(U.uTime.value * 2 + b.h) * 0.5) - b.y) * dt * 2;
      if (Math.hypot(b.x - cam.x, b.z - cam.z) > 60) { const a = Math.random() * 6.28; b.x = cam.x + Math.cos(a) * 40; b.z = cam.z + Math.sin(a) * 40; b.y = terrain.height(b.x, b.z) + 1; }
      if (b.y < U.uWaterLevel.value + 0.5) continue;
      this.m4.compose(p.set(b.x, b.y, b.z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -b.h), sc);
      this.bugs.setMatrixAt(n, this.m4);
      this.bugs.setColorAt(n, col.setRGB(...b.c));
      n++;
    }
    this.bugs.count = n;
    this.bugs.instanceMatrix.needsUpdate = true;
    this.bugs.instanceColor.needsUpdate = true;

    // bird flocks circling at altitude
    // birds come after insects (food) and a breathable sky: Birds stage
    const wantFlocks = s >= 11.45 ? 10 : s >= 10.6 ? 5 : s >= 10.25 ? 2 : 0;
    while (this.flocks.length < wantFlocks) {
      const a = Math.random() * 6.28;
      // species: white gulls high and slow, dark swifts low and fast, ochre
      // kites in pairs circling wide, slate-blue finches in tight small flocks
      const SP = [{ c: [1, 1, 1], h: [60, 90], sp: [0.06, 0.09], n: [5, 9], r: [70, 140], s: 1.2 },          // gulls
        { c: [0.25, 0.25, 0.28], h: [25, 45], sp: [0.16, 0.24], n: [8, 14], r: [40, 80], s: 0.7 },             // swifts
        { c: [0.8, 0.55, 0.3], h: [70, 110], sp: [0.04, 0.06], n: [2, 3], r: [120, 200], s: 1.7 },             // kites
        { c: [0.45, 0.55, 0.75], h: [18, 30], sp: [0.2, 0.3], n: [10, 16], r: [25, 45], s: 0.5 },              // finches
        { c: [0.1, 0.1, 0.12], h: [30, 60], sp: [0.1, 0.14], n: [20, 30], r: [50, 90], s: 0.6 },               // starling murmurations
        { c: [0.55, 0.42, 0.3], h: [120, 170], sp: [0.025, 0.04], n: [1, 2], r: [160, 260], s: 2.4 },          // eagles
        { c: [0.92, 0.92, 0.95], h: [40, 70], sp: [0.07, 0.1], n: [6, 11], r: [80, 150], s: 1.6 },             // egrets
        { c: [0.35, 0.4, 0.3], h: [35, 55], sp: [0.09, 0.12], n: [8, 14], r: [60, 110], s: 1.3 },              // geese in skeins
        { c: [0.85, 0.35, 0.3], h: [15, 25], sp: [0.24, 0.32], n: [4, 7], r: [20, 35], s: 0.45 },              // robins
        { c: [0.95, 0.75, 0.25], h: [20, 35], sp: [0.22, 0.3], n: [6, 10], r: [25, 40], s: 0.42 },             // goldfinches
      ];
      const B = SP[this.flocks.length % SP.length], R = (q) => q[0] + Math.random() * (q[1] - q[0]);
      this.flocks.push({ cx: cam.x + Math.cos(a) * 200, cz: cam.z + Math.sin(a) * 200, r: R(B.r), a: Math.random() * 6.28, h: R(B.h), sp: R(B.sp), n: Math.round(R(B.n)), c: B.c, s: B.s });
    }
    this.flocks.length = Math.min(this.flocks.length, wantFlocks);
    n = 0;
    for (const f of this.flocks) {
      f.a += f.sp * dt;
      if (Math.hypot(f.cx - cam.x, f.cz - cam.z) > 600) { f.cx = cam.x + (Math.random() - 0.5) * 400; f.cz = cam.z + (Math.random() - 0.5) * 400; }
      const base = terrain.height(f.cx, f.cz) + f.h;
      for (let k = 0; k < f.n && n < 96; k++) {
        const aa = f.a - k * 0.03 + Math.sin(k * 7.1) * 0.02;
        const rr = f.r + Math.sin(k * 3.3) * 6;
        const x = f.cx + Math.cos(aa) * rr, z = f.cz + Math.sin(aa) * rr, y = base + Math.sin(k * 1.9 + U.uTime.value * 0.5) * 3;
        const yaw = -aa;
        this.m4.compose(p.set(x, y, z), q.setFromEuler(new THREE.Euler(0, yaw, 0.25)), sc.setScalar(f.s || 1));
        this.birds.setColorAt(n, _bc.setRGB(...(f.c || [1, 1, 1])));
        this.birds.setMatrixAt(n++, this.m4);
      }
    }
    this.birds.count = n;
    this.birds.instanceMatrix.needsUpdate = true;
    if (this.birds.instanceColor) this.birds.instanceColor.needsUpdate = true;
    this.updateHerds(dt, cam, s);
  }

  // herds of grazers on open grassland near the player (Fauna stage, more and
  // larger once the ecosystem thrives); they amble, stop to graze, regroup
  updateHerds(dt, cam, s) {
    const terrain = this.game.terrain;
    const okGround = (x, z) => {
      if (!terrain.inWorld(x, z, 50)) return false;
      const h = terrain.height(x, z);
      return h > U.uWaterLevel.value + 1 && terrain.slope(x, z) < 0.3 && !this.game.buildings.isBlocked(x, z, 6);
    };
    // spawn / retire groups per species
    this.kinds.forEach((K, ki) => {
      const want = s >= K.from ? K.groups(s) : 0;
      let have = this.herds.filter((H) => H.kind === ki).length;
      while (have < want) {
        let cx = 0, cz = 0, ok = false;
        for (let t = 0; t < 12 && !ok; t++) { const a = Math.random() * 6.28, r = (K.hop ? 30 : 70) + Math.random() * 120; cx = cam.x + Math.cos(a) * r; cz = cam.z + Math.sin(a) * r; ok = okGround(cx, cz); }
        if (!ok) break;
        const big = s >= 11.45 ? 1 : 0;
        const n = K.size[0] + Math.floor(Math.random() * (K.size[1] - K.size[0] + 1)) + big * 2;
        const herd = { kind: ki, cx, cz, dir: Math.random() * 6.28, t: 0, members: [] };
        for (let k = 0; k < n; k++) herd.members.push({ ox: (Math.random() - 0.5) * K.spread, oz: (Math.random() - 0.5) * K.spread, x: cx, z: cz, h: Math.random() * 6.28, sp: 0, graze: Math.random() * 4, sc: 0.85 + Math.random() * 0.35, hop: Math.random() * 6 });
        this.herds.push(herd); have++;
      }
      while (have > want) { const i = this.herds.findIndex((H) => H.kind === ki); this.herds.splice(i, 1); have--; }
    });
    const counts = this.kinds.map(() => 0);
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3();
    for (let hi = this.herds.length - 1; hi >= 0; hi--) {
      const H = this.herds[hi], K = this.kinds[H.kind];
      H.t += dt;
      // the group drifts; it turns away from water, steep ground and buildings
      if (H.t > 6 + Math.random() * 6) { H.t = 0; H.dir += (Math.random() - 0.5) * 1.6; }
      const v = K.speed * 0.6;
      const nx = H.cx + Math.sin(H.dir) * v * dt, nz = H.cz + Math.cos(H.dir) * v * dt;
      if (okGround(nx + Math.sin(H.dir) * 10, nz + Math.cos(H.dir) * 10)) { H.cx = nx; H.cz = nz; } else H.dir += 1.3 * dt;
      if (Math.hypot(H.cx - cam.x, H.cz - cam.z) > 420) { this.herds.splice(hi, 1); continue; }
      for (const A of H.members) {
        const tx = H.cx + A.ox, tz = H.cz + A.oz;
        const dx = tx - A.x, dz = tz - A.z, d = Math.hypot(dx, dz);
        A.graze -= dt;
        const moving = d > 1.5 && A.graze < 0;
        if (A.graze < -6) A.graze = 2 + Math.random() * 6;
        const target = moving ? Math.min(K.speed, d * 0.4) : 0;
        A.sp += (target - A.sp) * Math.min(1, dt * 2);
        if (A.sp > 0.05) {
          const want = Math.atan2(dx, dz);
          const dh = Math.atan2(Math.sin(want - A.h), Math.cos(want - A.h));
          A.h += dh * Math.min(1, dt * 2.5);
          A.x += Math.sin(A.h) * A.sp * dt; A.z += Math.cos(A.h) * A.sp * dt;
        }
        const n = counts[H.kind];
        if (n >= K.mesh.instanceMatrix.count) continue;
        let y = terrain.height(A.x, A.z) - 0.03;
        if (K.hop) { A.hop += dt * (A.sp > 0.1 ? 9 : 0); if (A.sp > 0.1) y += Math.abs(Math.sin(A.hop)) * 0.22; }
        const grazing = A.sp < 0.1 ? 1 : 0;
        e.set(grazing * 0.12, A.h, 0, 'YXZ');
        // the y/x scale ratio carries the gait (read in the shader); hares hop instead
        const gait = K.hop ? 0 : Math.min(0.02, A.sp * 0.012);
        const ks = A.sc * (K.scale || 1);
        sc.set(ks, ks * (1 + gait), ks);
        this.m4.compose(p.set(A.x, y, A.z), q.setFromEuler(e), sc);
        K.mesh.setMatrixAt(n, this.m4);
        counts[H.kind] = n + 1;
      }
    }
    this.kinds.forEach((K, ki) => { K.mesh.count = counts[ki]; K.mesh.instanceMatrix.needsUpdate = true; });
    this.updateFish(dt, cam, s);
  }

  // schools of small fish cruising just under the surface of nearby lakes
  // (Fish stage, after algae has fed the water)
  updateFish(dt, cam, s) {
    const terrain = this.game.terrain;
    const L = U.uWaterLevel.value;
    const want = s >= 7.3 ? (s >= 9 ? 6 : 3) : 0;
    const deep = (x, z, d) => terrain.inWorld(x, z, 50) && terrain.height(x, z) < L - d;
    while (this.schools.length < want) {
      let x = 0, z = 0, ok = false;
      for (let t = 0; t < 16 && !ok; t++) { const a = Math.random() * 6.28, r = 15 + Math.random() * 110; x = cam.x + Math.cos(a) * r; z = cam.z + Math.sin(a) * r; ok = deep(x, z, 2.2); }
      if (!ok) break;
      // ten species: tint, size and school size
      const FS = [
        { c: [1, 1, 1], size: 1.0, n: [6, 12] },          // trout
        { c: [1.25, 0.85, 0.35], size: 0.9, n: [6, 10] }, // perch
        { c: [1.3, 0.95, 0.4], size: 1.5, n: [3, 6] },    // carp
        { c: [1.3, 0.55, 0.35], size: 1.1, n: [5, 9] },   // char
        { c: [0.7, 0.85, 0.75], size: 1.2, n: [4, 8] },   // bass
        { c: [0.85, 0.9, 1.15], size: 0.8, n: [8, 14] },  // roach
        { c: [0.65, 0.8, 1.3], size: 0.7, n: [8, 14] },   // bluegill
        { c: [1.4, 0.7, 0.6], size: 1.3, n: [3, 5] },     // golden orfe
        { c: [0.45, 0.42, 0.38], size: 1.9, n: [2, 3] },  // catfish
        { c: [1.15, 1.15, 1.2], size: 0.45, n: [14, 22] },// minnows
      ];
      const F = FS[Math.floor(Math.random() * FS.length)];
      this.schools.push({ x, z, h: Math.random() * 6.28, n: F.n[0] + Math.floor(Math.random() * (F.n[1] - F.n[0] + 1)), t: 0, sp: 1.2 + Math.random(), c: F.c, size: F.size * (0.85 + Math.random() * 0.3) });
    }
    this.schools.length = Math.min(this.schools.length, want);
    let n = 0;
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(1, 1, 1);
    for (let i = this.schools.length - 1; i >= 0; i--) {
      const F = this.schools[i];
      F.t += dt;
      F.h += Math.sin(F.t * 0.7 + i) * 0.4 * dt;
      const nx = F.x + Math.sin(F.h) * F.sp * dt, nz = F.z + Math.cos(F.h) * F.sp * dt;
      if (deep(nx + Math.sin(F.h) * 3, nz + Math.cos(F.h) * 3, 1.4)) { F.x = nx; F.z = nz; } else F.h += 2.0 * dt + 0.5;
      if (Math.hypot(F.x - cam.x, F.z - cam.z) > 220) { this.schools.splice(i, 1); continue; }
      for (let k = 0; k < F.n && n < 120; k++) {
        const ox = Math.sin(k * 2.39 + F.t * 0.6) * (0.5 + (k % 4) * 0.35), oz = Math.cos(k * 1.7 + F.t * 0.5) * (0.5 + (k % 3) * 0.4) - k * 0.12;
        const c = Math.cos(F.h), sn = Math.sin(F.h);
        const x = F.x + ox * c + oz * sn, z = F.z - ox * sn + oz * c;
        e.set(0, F.h + Math.sin(F.t * 2 + k) * 0.15, 0);
        this.m4.compose(p.set(x, L - 0.45 - (k % 3) * 0.25, z), q.setFromEuler(e), sc.setScalar((0.85 + (k % 5) * 0.08) * (F.size || 1)));
        this.fish.setColorAt(n, new THREE.Color(...(F.c || [1, 1, 1])));
        this.fish.setMatrixAt(n++, this.m4);
      }
    }
    this.fish.count = n;
    this.fish.instanceMatrix.needsUpdate = true;
    if (this.fish.instanceColor) this.fish.instanceColor.needsUpdate = true;
  }
}
