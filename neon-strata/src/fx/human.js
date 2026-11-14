// Procedural people. A smooth lofted body (no primitives) is skinned to a 17-bone skeleton; gait and
// idle clips are synthesised from biomechanical joint curves, feet are planted by solving the pelvis
// from ground contact (no sliding), and everything is baked into a bone-matrix texture so thousands of
// instances animate on the GPU.
import * as THREE from 'three';
import { injectNS } from '../render/cityMaterial.js';

// ---- skeleton (bind pose, metres, facing +z, left = +x) ---------------------------------------
const B = { pelvis: 0, spine: 1, chest: 2, neck: 3, head: 4, lArm: 5, lFore: 6, lHand: 7, rArm: 8, rFore: 9, rHand: 10, lThigh: 11, lShin: 12, lFoot: 13, rThigh: 14, rShin: 15, rFoot: 16 };
const BIND = [[0, 0.94, 0], [0, 1.08, 0], [0, 1.26, 0], [0, 1.48, 0], [0, 1.56, 0.01], [0.19, 1.43, 0], [0.222, 1.15, 0], [0.24, 0.9, 0.01], [-0.19, 1.43, 0], [-0.222, 1.15, 0], [-0.24, 0.9, 0.01], [0.09, 0.92, 0], [0.09, 0.5, 0], [0.09, 0.08, -0.02], [-0.09, 0.92, 0], [-0.09, 0.5, 0], [-0.09, 0.08, -0.02]];
const PARENT = [-1, 0, 1, 2, 3, 2, 5, 6, 2, 8, 9, 0, 11, 12, 0, 14, 15];
export const NB = 17, FRAMES = 32;
export const CLIP = { walk: 0, walkU: 1, brisk: 2, idle: 3, talk: 4, phone: 5, run: 6, air: 7, sit: 8 };
const NCLIP = 9;
const D = Math.PI / 180;
const bump = (p, c, w) => { let d = p - c; d -= Math.round(d); return Math.exp(-(d * d) / (2 * w * w)); };

// joint angles (degrees) for a pose. returns { rot: [euler xyz per bone], root:[x,y,z] offsets } (root y solved later)
function pose(clip, ph) {
  const r = []; for (let i = 0; i < NB; i++) r.push([0, 0, 0]);
  const c = Math.cos(ph * Math.PI * 2), s = Math.sin(ph * Math.PI * 2);
  const leg = (p, amp, kn, an) => ({ hip: (12 + 21 * Math.cos(p * 6.2832 - 0.1) - 2 * Math.cos(p * 12.566)) * amp, knee: 4 + 15 * bump(p, 0.13, 0.085) * kn + 60 * bump(p, 0.72, 0.105) * kn, ankle: (-6 * bump(p, 0.07, 0.04) + 10 * bump(p, 0.42, 0.1) - 20 * bump(p, 0.63, 0.05) + 3 * bump(p, 0.8, 0.07)) * an });
  let rootX = 0, lean = 3, solve = true, rootY = 0;
  if (clip === CLIP.walk || clip === CLIP.walkU || clip === CLIP.brisk || clip === CLIP.run) {
    const run = clip === CLIP.run, brisk = clip === CLIP.brisk;
    const amp = run ? 1.75 : brisk ? 1.18 : 1, kn = run ? 1.55 : brisk ? 1.1 : 1, an = run ? 1.3 : 1;
    const L = leg(ph, amp, kn, an), R = leg(ph + 0.5, amp, kn, an);
    if (run) { L.knee += 16; R.knee += 16; }
    r[B.lThigh] = [-L.hip, 0, -1.5]; r[B.lShin] = [L.knee, 0, 0]; r[B.lFoot] = [-L.ankle, 0, 0];
    r[B.rThigh] = [-R.hip, 0, 1.5]; r[B.rShin] = [R.knee, 0, 0]; r[B.rFoot] = [-R.ankle, 0, 0];
    const py = (run ? -9 : brisk ? -7 : -5) * c, pr = (run ? 3 : 4) * Math.sin(ph * 6.2832 + 0.3);
    lean = run ? 11 : brisk ? 5 : 3;
    r[B.pelvis] = [lean, py, pr]; rootX = 0.02 * Math.sin(ph * 6.2832 + 0.3);
    r[B.spine] = [1, -py * 0.7, -pr * 0.6]; r[B.chest] = [run ? 2 : 0, -py * 1.0 + (run ? 0 : 0), -pr * 0.3];
    r[B.neck] = [-lean * 0.5, py * 0.35, 0]; r[B.head] = [-lean * 0.4 + 1.5 * Math.cos(ph * 12.566), py * 0.35, 0];
    const sw = run ? 40 : brisk ? 26 : 18, el = run ? 78 : 16, elS = run ? 14 : 14;
    r[B.lArm] = [sw * c, 0, -4]; r[B.lFore] = [-(el + elS * (0.5 - 0.5 * c)), 0, 0];
    r[B.rArm] = [-sw * c, 0, 4]; r[B.rFore] = [-(el + elS * (0.5 + 0.5 * c)), 0, 0];
    r[B.lHand] = [-6, 0, 0]; r[B.rHand] = [-6, 0, 0];
    if (clip === CLIP.walkU) { r[B.rArm] = [-34 + 2 * c, 0, 10]; r[B.rFore] = [-104, 0, 0]; r[B.rHand] = [10, 0, 0]; }
  } else if (clip === CLIP.air) {
    r[B.pelvis] = [6, 0, 0]; r[B.lThigh] = [-38, 0, -3]; r[B.lShin] = [52, 0, 0]; r[B.rThigh] = [-14, 0, 3]; r[B.rShin] = [34, 0, 0]; r[B.lFoot] = [18, 0, 0]; r[B.rFoot] = [22, 0, 0];
    r[B.lArm] = [-20, 0, -28]; r[B.rArm] = [14, 0, 30]; r[B.lFore] = [-40, 0, 0]; r[B.rFore] = [-30, 0, 0]; solve = false; rootY = 0.02;
  } else if (clip === CLIP.sit) { // on a stool: thighs level, elbows towards the table, head following the talk
    const slow = Math.sin(ph * 6.2832), s2 = Math.sin(ph * 12.566 + 1.0), g = Math.sin(ph * 6.2832 * 3);
    r[B.pelvis] = [-3, 2 * slow, 0]; r[B.lThigh] = [-84, 0, -7]; r[B.rThigh] = [-83, 0, 7]; r[B.lShin] = [86, 0, 0]; r[B.rShin] = [90 + 4 * slow, 0, 0]; r[B.lFoot] = [-3, 0, 0]; r[B.rFoot] = [-7, 0, 0];
    r[B.spine] = [9 + s2, -2 * slow, 0]; r[B.chest] = [7, -2 * slow, 0]; r[B.neck] = [-5, 8 * slow, 0]; r[B.head] = [-5 + 3 * s2, 14 * slow, 0];
    r[B.lArm] = [-36, 0, -10]; r[B.lFore] = [-72 - 6 * s2, 0, 0]; r[B.rArm] = [-30 + 7 * g, 0, 10]; r[B.rFore] = [-84 + 16 * Math.max(0, g), 0, 0]; r[B.rHand] = [8 * g, 0, 0];
  } else { // standing clips: weight shift, breathing, look-around; talk / phone overlays
    const slow = Math.sin(ph * 6.2832), slow2 = Math.sin(ph * 12.566 + 1.0);
    r[B.pelvis] = [1, 4 * slow, 2.2 * slow]; rootX = 0.02 * slow;
    r[B.lThigh] = [-2 - 2 * slow, 0, -3 - 2.2 * slow]; r[B.lShin] = [5 + 4 * Math.max(0, -slow), 0, 0]; r[B.lFoot] = [-2, 8, 2.2 * slow];
    r[B.rThigh] = [-2 + 2 * slow, 0, 3 - 2.2 * slow]; r[B.rShin] = [5 + 4 * Math.max(0, slow), 0, 0]; r[B.rFoot] = [-2, -8, 2.2 * slow];
    r[B.spine] = [1 + 0.8 * slow2, -3 * slow, -1.5 * slow]; r[B.chest] = [1.2 * slow2, -2 * slow, -1 * slow];
    r[B.neck] = [0, 6 * Math.sin(ph * 6.2832 * 1 + 0.7), 0]; r[B.head] = [2 * slow2, 9 * Math.sin(ph * 6.2832 + 0.7), 0];
    r[B.lArm] = [2 + 2 * slow2, 0, -5]; r[B.lFore] = [-14, 0, 0]; r[B.rArm] = [2 - 2 * slow2, 0, 5]; r[B.rFore] = [-14, 0, 0];
    if (clip === CLIP.talk) { const g = Math.sin(ph * 6.2832 * 3), g2 = Math.sin(ph * 6.2832 * 2 + 1); r[B.rArm] = [-24 + 8 * g, 0, 12]; r[B.rFore] = [-70 - 22 * g2, 0, 0]; r[B.rHand] = [10 * g, 0, 0]; r[B.lArm] = [-10 + 5 * g2, 0, -8]; r[B.lFore] = [-46 - 12 * g, 0, 0]; r[B.head] = [3 * g, 8 * g2, 0]; }
    if (clip === CLIP.phone) { r[B.rArm] = [-38, 0, 6]; r[B.rFore] = [-112 + 2 * slow2, 0, 0]; r[B.rHand] = [18, 0, 0]; r[B.neck] = [10, 0, 0]; r[B.head] = [14 + 1.5 * slow2, -4, 0]; r[B.lArm] = [4, 0, -5]; }
  }
  return { rot: r, rootX, solve, rootY };
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _one = new THREE.Vector3(1, 1, 1);
function worldMats(p, root) {
  const out = [];
  for (let i = 0; i < NB; i++) {
    const pr = PARENT[i]; const off = pr < 0 ? [root[0], BIND[0][1] + root[1], root[2]] : [BIND[i][0] - BIND[pr][0], BIND[i][1] - BIND[pr][1], BIND[i][2] - BIND[pr][2]];
    _e.set(p.rot[i][0] * D, p.rot[i][1] * D, p.rot[i][2] * D, 'YXZ'); _q.setFromEuler(_e);
    const loc = new THREE.Matrix4().compose(_v.set(off[0], off[1], off[2]), _q, _one);
    out.push(pr < 0 ? loc : new THREE.Matrix4().multiplyMatrices(out[pr], loc));
  }
  return out;
}
const SOLE = [[0, -0.08, -0.06], [0, -0.08, 0.2]]; // heel, toe in foot-bone space
function soles(mats) { const res = []; for (const b of [B.lFoot, B.rFoot]) { let ymin = 1e9, z = 0; for (const s of SOLE) { _v.set(s[0], s[1], s[2]).applyMatrix4(mats[b]); if (_v.y < ymin) { ymin = _v.y; } } _v.set(0, -0.08, 0.05).applyMatrix4(mats[b]); res.push({ y: ymin, z: _v.z }); } return res; }

// bake all clips → HalfFloat texture (width = NB*3 texels, one row per frame) + per-clip stride length
export function bakeAnimations() {
  const W = NB * 3, H = NCLIP * (FRAMES + 1); const data = new Uint16Array(W * H * 4); const stride = [];
  const inv = BIND.map((b) => new THREE.Matrix4().makeTranslation(-b[0], -b[1], -b[2]));
  for (let c = 0; c < NCLIP; c++) {
    // pass 1: solve root height from ground contact, integrate forward travel of the stance foot
    const roots = []; let zAcc = 0; let prev = null; let prevStance = -1; let lastStep = 0;
    for (let f = 0; f <= FRAMES; f++) {
      const ph = f / FRAMES; const p = pose(c, ph); let root = [p.rootX, p.rootY, 0];
      if (p.solve) { const m0 = worldMats(p, [p.rootX, 0, 0]); const s = soles(m0); const low = Math.min(s[0].y, s[1].y); root[1] = -low; const st = s[0].y <= s[1].y ? 0 : 1; if (prev && st === prevStance) zAcc += Math.max(0, prev[st].z - s[st].z); else if (prev) zAcc += lastStep; if (prev && st === prevStance) lastStep = Math.max(0, prev[st].z - s[st].z); prev = s; prevStance = st; }
      roots.push([root[0], root[1], zAcc]);
    }
    const S = Math.max(0, roots[FRAMES][2]); stride.push(S);
    // smooth root height a little (kills contact switching pops)
    const ys = roots.map((r) => r[1]); for (let it = 0; it < 2; it++) for (let f = 0; f <= FRAMES; f++) { const a = ys[(f - 1 + FRAMES) % FRAMES], b = ys[f % FRAMES], d = ys[(f + 1) % FRAMES]; roots[f][1] = (a + 2 * b + d) / 4; }
    for (let f = 0; f <= FRAMES; f++) {
      const ph = (f % FRAMES) / FRAMES; const p = pose(c, ph); const rt = roots[f % FRAMES];
      const mats = worldMats(p, [rt[0], rt[1], rt[2] - S * ph]);
      for (let b = 0; b < NB; b++) {
        _m.multiplyMatrices(mats[b], inv[b]); const e = _m.elements; const row = c * (FRAMES + 1) + f; const o = (row * W + b * 3) * 4;
        const put = (k, a, b2, c2, d) => { data[o + k * 4] = THREE.DataUtils.toHalfFloat(a); data[o + k * 4 + 1] = THREE.DataUtils.toHalfFloat(b2); data[o + k * 4 + 2] = THREE.DataUtils.toHalfFloat(c2); data[o + k * 4 + 3] = THREE.DataUtils.toHalfFloat(d); };
        put(0, e[0], e[4], e[8], e[12]); put(1, e[1], e[5], e[9], e[13]); put(2, e[2], e[6], e[10], e[14]);
      }
    }
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.minFilter = tex.magFilter = THREE.LinearFilter; tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping; tex.needsUpdate = true;
  return { tex, W, H, stride };
}
export const clipRow = (clip, phase) => clip * (FRAMES + 1) + (phase - Math.floor(phase)) * FRAMES;

// ---- body mesh ---------------------------------------------------------------------------------
// part ids: 0 skin, 1 top, 2 bottom, 3 shoes, 4 hair / hood, 5 emissive accent, 6 bag
class Body {
  constructor() { this.pos = []; this.skin = []; this.idx = []; this.n = 0; }
  vert(x, y, z, a, b, w, part) { this.pos.push(x, y, z); this.skin.push(a, b, w, part); return this.n++; }
  // rings: [{c:[x,y,z], rx, rz, a, b, w, part, plane ('h' horizontal | 'f' facing forward), wfn}]
  tube(rings, segs = 10, o = {}) {
    const first = this.n;
    for (const r of rings) for (let i = 0; i < segs; i++) {
      const t = (i / segs) * Math.PI * 2, cs = Math.cos(t), sn = Math.sin(t);
      const sq = o.square ?? 0; const k = 1 / Math.pow(Math.pow(Math.abs(cs), 2 + sq * 6) + Math.pow(Math.abs(sn), 2 + sq * 6), 1 / (2 + sq * 6));
      let x, y, z;
      if (r.plane === 'f') { x = r.c[0] + cs * k * r.rx; y = r.c[1] + sn * k * r.rz; z = r.c[2]; } else { x = r.c[0] + cs * k * r.rx; y = r.c[1]; z = r.c[2] + sn * k * r.rz * (sn > 0 ? (r.front ?? 1) : (r.back ?? 1)); }
      if (r.pfn) { const q = r.pfn(x, y, z, cs, sn); x = q[0]; y = q[1]; z = q[2]; }
      let a = r.a, b = r.b ?? r.a, w = r.w ?? 0, part = r.part;
      if (r.vfn) { const m = r.vfn(x, y, z, cs, sn); if (m) { a = m.a ?? a; b = m.b ?? b; w = m.w ?? w; part = m.part ?? part; } }
      this.vert(x, y, z, a, b, w, part);
    }
    for (let j = 0; j < rings.length - 1; j++) for (let i = 0; i < segs; i++) { const a = first + j * segs + i, b = first + j * segs + ((i + 1) % segs), c = a + segs, d = b + segs; if (rings[0].plane === 'f') this.idx.push(a, b, d, a, d, c); else this.idx.push(a, d, b, a, c, d); }
    const cap = (j, flip) => { const r = rings[j]; const c = this.vert(r.c[0], r.c[1] + (r.plane === 'f' ? 0 : (j ? 1 : -1) * (o.capH ?? 0.01)), r.c[2] + (r.plane === 'f' ? (j ? 1 : -1) * (o.capH ?? 0.02) : 0), r.a, r.b ?? r.a, r.w ?? 0, r.capPart ?? r.part); for (let i = 0; i < segs; i++) { const a = first + j * segs + i, b = first + j * segs + ((i + 1) % segs); flip ? this.idx.push(c, b, a) : this.idx.push(c, a, b); } };
    const fwd = rings[0].plane === 'f';
    if (o.capStart !== false) cap(0, fwd ? true : false); if (o.capEnd !== false) cap(rings.length - 1, fwd ? false : true);
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3)); g.setAttribute('aSkin', new THREE.Float32BufferAttribute(this.skin, 4)); g.setIndex(this.idx); g.computeVertexNormals();
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 1.6);
    return g;
  }
}
const R = (x, y, z, rx, rz, a, b, w, part, extra) => ({ c: [x, y, z], rx, rz, a, b, w, part, ...extra });

// variant: { fem, coat, hood, hairLong, bag, skirt, visor, bulky }
export function buildBody(v = {}) {
  const b = new Body(); const fem = v.fem ? 1 : 0; const bulk = v.bulky ? 1.12 : 1;
  const sh = (fem ? 0.178 : 0.2) * bulk, hip = fem ? 0.178 : 0.168, waist = fem ? 0.122 : 0.142; const AK = 1.2, LK = 1.12;
  const topPart = 1, botPart = 2;
  // torso
  const torso = [R(0, 0.8, 0, 0.125, 0.1, 0, 0, 0, botPart), R(0, 0.9, 0, hip, 0.118, 0, 0, 0, botPart), R(0, 0.99, 0, hip * 0.97, 0.112, 0, 1, 0.3, botPart), R(0, 1.04, 0, hip * 0.9, 0.105, 0, 1, 0.6, topPart),
    R(0, 1.09, 0, waist * bulk, 0.098 * bulk, 1, 1, 0, topPart), R(0, 1.18, 0.004, (waist + 0.014) * bulk, 0.106 * bulk, 1, 2, 0.5, topPart), R(0, 1.29, 0.01, (sh - 0.015), (fem ? 0.125 : 0.12) * bulk, 2, 2, 0, topPart, { front: fem ? 1.12 : 1 }),
    R(0, 1.39, 0.006, sh, 0.114 * bulk, 2, 2, 0, topPart), R(0, 1.455, 0, sh * 0.86, 0.092 * bulk, 2, 2, 0, topPart), R(0, 1.5, 0, 0.066, 0.064, 2, 3, 0.5, v.hood ? 4 : topPart), R(0, 1.55, 0.004, 0.05, 0.054, 3, 3, 0, v.hood ? 4 : 0)];
  b.tube(torso, 12, { capEnd: false });
  // head (+ hair / hood / visor by vertex position)
  const hs = v.hood ? 1.13 : 1;
  const headFn = (x, y, z, cs, sn) => {
    const face = z > 0.03 * hs && y < 1.735 && y > 1.585 && Math.abs(x) < 0.075 * hs;
    const eye = !v.visor && Math.abs(y - 1.684) < 0.004 && z > 0.06 && Math.abs(x) > 0.02 && Math.abs(x) < 0.06;
    if (v.hood) return { part: face ? (v.visor ? (y > 1.66 && y < 1.7 ? 5 : 3) : (eye ? 3 : 0)) : 4 };
    const fringe = v.fem || v.hairLong ? 1.705 : 1.722;
    const hair = y > fringe + (z > 0.05 ? 0.012 : 0) || (z < 0.03 && y > 1.625) || (v.hairLong && z < 0.045 && y > 1.59);
    if (v.visor && face && y > 1.66 && y < 1.7) return { part: 5 };
    if (v.mask && face && y < 1.66) return { part: 3 };
    return { part: hair ? 4 : (eye ? 3 : 0) };
  };
  const nose = (x, y, z, cs, sn) => (sn > 0.96 ? [x, y - 0.006, z + 0.014] : [x, y, z]);
  const head = [R(0, 1.555, 0.006, 0.052 * hs, 0.058 * hs, 3, 4, 0.5, 0), R(0, 1.596, 0.012, 0.064 * hs, 0.08 * hs, 4, 4, 0, 0, { front: 1.02 }), R(0, 1.63, 0.012, 0.072 * hs, 0.09 * hs, 4, 4, 0, 0, { front: 1.03 }), R(0, 1.658, 0.012, 0.076 * hs, 0.094 * hs, 4, 4, 0, 0, { pfn: v.hood ? null : nose }), R(0, 1.684, 0.011, 0.078 * hs, 0.096 * hs, 4, 4, 0, 0, { front: 0.97 }), R(0, 1.712, 0.008, 0.079 * hs, 0.099 * hs, 4, 4, 0, 0), R(0, 1.746, 0.004, 0.071 * hs, 0.09 * hs, 4, 4, 0, 4), R(0, 1.772, 0, 0.046 * hs, 0.058 * hs, 4, 4, 0, 4)];
  for (const r of head) { r.vfn = headFn; if (r.pfn === null) delete r.pfn; } b.tube(head, 12, { capStart: false, capH: 0.012 });
  if (v.hairLong) b.tube([R(0, 1.7, -0.07, 0.078, 0.05, 4, 4, 0, 4), R(0, 1.6, -0.085, 0.082, 0.045, 4, 3, 0.4, 4), R(0, 1.5, -0.09, 0.09, 0.04, 3, 2, 0.7, 4), R(0, 1.36, -0.1, 0.085, 0.03, 2, 2, 0, 4)], 8);
  // arms
  for (const s of [1, -1]) {
    const A = s > 0 ? B.lArm : B.rArm, F = s > 0 ? B.lFore : B.rFore, Hh = s > 0 ? B.lHand : B.rHand; const k = bulk;
    b.tube([R(s * (sh - 0.016), 1.455, 0, 0.056 * k, 0.062 * k, 2, A, 0.5, topPart), R(s * (sh + 0.012), 1.4, 0, 0.06 * k * AK, 0.062 * k * AK, A, A, 0, topPart), R(s * (sh + 0.022), 1.3, 0, 0.05 * k * AK, 0.053 * k * AK, A, A, 0, topPart), R(s * 0.226, 1.2, 0, 0.044 * k * AK, 0.046 * k * AK, A, F, 0.25, topPart), R(s * 0.23, 1.15, 0, 0.042 * k * AK, 0.044 * k * AK, A, F, 0.5, topPart), R(s * 0.233, 1.1, 0.002, 0.043 * k * AK, 0.044 * k * AK, A, F, 0.8, topPart),
      R(s * 0.238, 1.0, 0.006, 0.039 * k * AK, 0.04 * k * AK, F, F, 0, topPart), R(s * 0.242, 0.92, 0.01, 0.032 * k * AK, 0.032 * k * AK, F, Hh, 0.3, topPart), R(s * 0.244, 0.895, 0.01, 0.03, 0.031, F, Hh, 0.6, 0), R(s * 0.246, 0.86, 0.014, 0.027, 0.046, Hh, Hh, 0, 0), R(s * 0.247, 0.8, 0.022, 0.025, 0.043, Hh, Hh, 0, 0), R(s * 0.247, 0.755, 0.028, 0.017, 0.028, Hh, Hh, 0, 0)], 8, { capH: 0.012 });
  }
  // legs + shoes
  for (const s of [1, -1]) {
    const T = s > 0 ? B.lThigh : B.rThigh, Sn = s > 0 ? B.lShin : B.rShin, Ft = s > 0 ? B.lFoot : B.rFoot; const lw = fem ? 0.94 : 1;
    b.tube([R(s * 0.088, 0.93, 0, 0.086 * lw * LK, 0.096 * LK, 0, T, 0.5, botPart), R(s * 0.094, 0.84, 0, 0.087 * lw * LK, 0.094 * LK, T, T, 0, botPart), R(s * 0.092, 0.7, 0.004, 0.074 * lw * LK, 0.08 * LK, T, T, 0, botPart), R(s * 0.09, 0.57, 0.004, 0.06 * LK, 0.066 * LK, T, Sn, 0.2, botPart), R(s * 0.09, 0.5, 0.004, 0.055 * LK, 0.06 * LK, T, Sn, 0.5, botPart), R(s * 0.09, 0.44, 0, 0.052 * LK, 0.058 * LK, T, Sn, 0.85, botPart),
      R(s * 0.09, 0.36, -0.008, 0.052 * LK, 0.06 * LK, Sn, Sn, 0, botPart), R(s * 0.09, 0.22, -0.006, 0.043 * LK, 0.048 * LK, Sn, Sn, 0, botPart), R(s * 0.09, 0.12, -0.01, 0.036, 0.04, Sn, Ft, 0.4, v.boots ? 3 : botPart), R(s * 0.09, 0.07, -0.014, 0.036, 0.042, Sn, Ft, 0.7, 3)], 8, { capStart: true, capEnd: false });
    b.tube([R(s * 0.09, 0.05, -0.085, 0.038, 0.04, Ft, Ft, 0, 3, { plane: 'f' }), R(s * 0.09, 0.055, -0.03, 0.046, 0.052, Ft, Ft, 0, 3, { plane: 'f' }), R(s * 0.092, 0.05, 0.06, 0.05, 0.046, Ft, Ft, 0, 3, { plane: 'f' }), R(s * 0.094, 0.04, 0.14, 0.048, 0.036, Ft, Ft, 0, 3, { plane: 'f' }), R(s * 0.094, 0.03, 0.2, 0.036, 0.026, Ft, Ft, 0, 3, { plane: 'f' })], 8, { capH: 0.02, square: 0.15 });
  }
  // coat / skirt: flares from the waist, front panels follow the thighs so it moves with the stride
  if (v.coat || v.skirt) {
    const hem = v.coat ? 0.5 : 0.62, flare = v.coat ? 1.0 : 0.8; const part = v.skirt ? botPart : topPart;
    const sk = (y, rx, rz, low) => R(0, y, 0, rx, rz, 0, 0, 0, part, { vfn: (x, yy, z) => ({ a: 0, b: x > 0 ? B.lThigh : B.rThigh, w: low * (z > -0.02 ? 0.62 : 0.3) * Math.min(1, Math.abs(x) / 0.07 + 0.35) }) });
    b.tube([sk(1.1, (waist + 0.03) * bulk, 0.118 * bulk, 0), sk(0.98, hip + 0.03, 0.14, 0.15), sk(0.84, hip + 0.045 * flare, 0.158, 0.5), sk(0.68, hip + 0.065 * flare, 0.172, 0.85), sk(hem, hip + 0.08 * flare, 0.182, 1)], 14, { capStart: false, capEnd: false });
    b.tube([sk(hem, hip + 0.08 * flare - 0.012, 0.17, 1), sk(hem + 0.02, hip + 0.06 * flare, 0.15, 1)], 14, { capStart: false, capEnd: false }); // hem thickness (inner lip)
    if (v.coat) b.tube([R(0, 1.47, 0, 0.105, 0.085, 2, 2, 0, topPart), R(0, 1.53, 0.004, 0.085, 0.08, 2, 3, 0.5, topPart), R(0, 1.545, 0.004, 0.092, 0.086, 3, 3, 0, topPart)], 10, { capStart: false, capEnd: false }); // collar
  }
  if (v.bag) b.tube([R(0, 1.12, -0.17, 0.12, 0.06, 2, 1, 0.5, 6), R(0, 1.2, -0.185, 0.135, 0.075, 2, 2, 0, 6), R(0, 1.38, -0.18, 0.13, 0.07, 2, 2, 0, 6), R(0, 1.44, -0.16, 0.1, 0.05, 2, 2, 0, 6)], 8, { square: 0.5, capH: 0.02 });
  return b.build();
}

export const VARIANTS = [
  { name: 'jacket', v: { boots: 1 } }, { name: 'coatHood', v: { coat: 1, hood: 1, visor: 1, boots: 1 } }, { name: 'coatF', v: { coat: 1, fem: 1, hairLong: 1 } },
  { name: 'hoodieBag', v: { hood: 1, bag: 1, mask: 1, bulky: 1 } }, { name: 'skirt', v: { skirt: 1, fem: 1 } }, { name: 'coatM', v: { coat: 1, mask: 1, boots: 1 } },
];

// ---- material (instanced, GPU-skinned) ------------------------------------------------------------
export function createHumanMaterial(anim) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82, metalness: 0.0 });
  const uni = { uAnimTex: { value: anim.tex }, uAnimSize: { value: new THREE.Vector2(anim.W, anim.H) } };
  const skinFn = /* glsl */ `
    attribute vec4 aSkin; attribute vec4 iAnim; attribute vec3 iC0; attribute vec3 iC1; attribute vec4 iC2;
    uniform sampler2D uAnimTex; uniform vec2 uAnimSize; varying vec3 vHC; varying float vHE;
    mat4 nsBone(float bone, float row){ float u = (bone * 3.0 + 0.5) / uAnimSize.x; float v = (row + 0.5) / uAnimSize.y; float du = 1.0 / uAnimSize.x;
      vec4 r0 = texture2D(uAnimTex, vec2(u, v)), r1 = texture2D(uAnimTex, vec2(u + du, v)), r2 = texture2D(uAnimTex, vec2(u + 2.0 * du, v));
      return mat4(r0.x, r1.x, r2.x, 0.0, r0.y, r1.y, r2.y, 0.0, r0.z, r1.z, r2.z, 0.0, r0.w, r1.w, r2.w, 1.0); }
    mat4 nsSkin(float row){ mat4 a = nsBone(aSkin.x, row); mat4 b = nsBone(aSkin.y, row); return a * (1.0 - aSkin.z) + b * aSkin.z; }`;
  injectNS(mat, {
    key: 'human', uniforms: uni, vertexPars: skinFn,
    vertexReplace: [['#include <beginnormal_vertex>', `#include <beginnormal_vertex>
      mat4 nsSk = nsSkin(iAnim.x); if (iAnim.w > 0.001) { mat4 s2 = nsSkin(iAnim.z); nsSk = nsSk * (1.0 - iAnim.w) + s2 * iAnim.w; }
      objectNormal = normalize(mat3(nsSk) * objectNormal);
      float part = aSkin.w; vec3 skinTone = mix(vec3(0.78, 0.6, 0.48), vec3(0.36, 0.25, 0.19), iC2.a);
      vHC = part < 0.5 ? skinTone : (part < 1.5 ? iC0 : (part < 2.5 ? iC1 : (part < 3.5 ? vec3(0.05, 0.05, 0.06) : (part < 4.5 ? iC2.rgb : (part < 5.5 ? vec3(1.0) : iC1 * 0.6 + 0.05)))));
      vHE = (part > 4.5 && part < 5.5) ? 1.0 : 0.0;`],
      ['#include <begin_vertex>', '#include <begin_vertex>\n transformed = (nsSk * vec4(transformed, 1.0)).xyz;']],
    fragmentPars: 'varying vec3 vHC; varying float vHE;',
    fragmentSurface: /* glsl */ `diffuseColor.rgb = vHC * vHC; roughnessFactor = mix(0.86, 0.5, step(0.9, vHE)); totalEmissiveRadiance += vec3(0.2, 0.9, 1.0) * vHE * 4.0;
      float wetH = uWet * 0.6; diffuseColor.rgb *= 1.0 - 0.25 * wetH; roughnessFactor = mix(roughnessFactor, 0.35, wetH * 0.5);`,
  });
  return mat;
}
export function makeHumanMesh(geo, mat, count) {
  const g = geo.clone();
  g.setAttribute('iAnim', new THREE.InstancedBufferAttribute(new Float32Array(count * 4), 4)); g.setAttribute('iC0', new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3));
  g.setAttribute('iC1', new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3)); g.setAttribute('iC2', new THREE.InstancedBufferAttribute(new Float32Array(count * 4), 4));
  const m = new THREE.InstancedMesh(g, mat, count); m.frustumCulled = false; m.count = 0; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  for (const k of ['iAnim', 'iC0', 'iC1', 'iC2']) g.getAttribute(k).setUsage(THREE.DynamicDrawUsage);
  return m;
}
