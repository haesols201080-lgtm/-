// Colonist body: one detailed mesh per person, drawn instanced (one draw call
// for the whole crowd). Every vertex belongs to a bone (body, head, thighs,
// shins, upper arms, forearms) that the vertex shader rotates from a
// per-instance walk phase, so hips, knees and elbows bend like a real gait.
// Colours come from slots filled per instance (top, skin, hair, trousers,
// tier accent) and optional parts (seven hair styles, beard, helmet with
// life-support pack) are switched per instance.
import * as THREE from 'three';
import { GeoBuilder } from '../core/geobuilder.js';
import { U } from '../core/shared.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const E = (x, y, z) => new THREE.Euler(x, y, z);

export const HAIR_STYLES = 7;
// colour slots
const TOP = 0, SKIN = 1, HAIR = 2, PANTS = 3, FIXED = 4, ACCENT = 5, VISOR = 6;
// visibility: always, helmet only, bare head only, beard, hair style s -> 4 + s
const ALL = 0, HELM = 1, BARE = 2, BEARD = 3, STYLE = 4;
// bones
const BODY = 0, HEAD = 1, THIGH_L = 2, SHIN_L = 3, THIGH_R = 4, SHIN_R = 5, UARM_L = 6, FARM_L = 7, UARM_R = 8, FARM_R = 9;

// segment budget: the near model and the far (LOD) model share every shape
let Q = 1;
const sg = (n, min = 5) => Math.max(min, Math.round(n * Q));

// closed lathe from [radius, y] pairs (bottom to top)
function limb(profile, seg = 14) {
  const pts = [new THREE.Vector2(0, profile[0][1] - 0.004), ...profile.map(([r, y]) => new THREE.Vector2(r, y)), new THREE.Vector2(0, profile[profile.length - 1][1] + 0.004)];
  return new THREE.LatheGeometry(pts, sg(seg));
}
const band = (pr, k, seg = 14) => new THREE.LatheGeometry(pr.map(([r, y]) => new THREE.Vector2(r * k, y)), sg(seg));
const ell = (r, sx, sy, sz, w = 16, h = 12) => { const g = new THREE.SphereGeometry(r, sg(w), sg(h, 4)); g.scale(sx, sy, sz); return g; };

// head: a sphere shaped into cranium, tapering jaw and chin, flatter face and
// a nape that tucks into the neck. k scales it up for hair and beard shells;
// the sphere seam faces backwards.
function headGeo(k = 1, phiStart = 0, phiLength = Math.PI * 2, thetaStart = 0, thetaLength = Math.PI) {
  const g = new THREE.SphereGeometry(1, sg(28, 10), sg(20, 8), phiStart, phiLength, thetaStart, thetaLength);
  g.rotateY(Math.PI / 2);
  const P = g.attributes.position, q = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) {
    q.fromBufferAttribute(P, i);
    let { x, y, z } = q;
    const lo = Math.max(0, -y), hi = Math.max(0, y);
    x *= 1 - 0.3 * Math.pow(lo, 1.4) + 0.04 * Math.exp(-((y + 0.15) ** 2) * 20) * (z < 0 ? 1 : 0);
    if (z > 0) z *= 1 - 0.42 * lo + 0.06 * hi;
    else z *= 0.93 - 0.05 * lo;
    P.setXYZ(i, x * 0.077 * k, y * 0.116 * k, z * 0.1 * k);
  }
  g.computeVertexNormals();
  return g;
}

export function colonistGeometry(lod = 0) {
  Q = lod ? 0.42 : 0.85;
  const D = !lod;   // small details only on the near model
  const gb = new GeoBuilder(['aBone', 'aSlot', 'aShow']);  // packed into aPart after build
  const put = (geo, bone, slot, opt = {}) => gb.add(geo, { pos: opt.pos, rot: opt.rot, scale: opt.scale, color: opt.color ?? 0xffffff, attrs: { aBone: bone, aSlot: slot, aShow: opt.show ?? ALL } });
  const BOOT = 0x2e2b28, SOLE = 0x151517, BELT = 0x2a2c30, METAL = 0xb4b9bf, LIP = 0x8a4a42, EYE = 0x17130f;

  // ---- legs: thigh, knee, shin, boot
  for (const sx of [-1, 1]) {
    const x = sx * 0.092, th = sx < 0 ? THIGH_L : THIGH_R, sh = sx < 0 ? SHIN_L : SHIN_R;
    const thigh = limb([[0.054, 0.48], [0.06, 0.55], [0.07, 0.68], [0.078, 0.8], [0.083, 0.9], [0.07, 0.965]]);
    thigh.scale(1, 1, 1.06);
    put(thigh, th, PANTS, { pos: V(x, 0, 0) });
    put(ell(0.056, 1, 1, 1, 12, 10), sh, PANTS, { pos: V(x, 0.5, -0.004) });
    const shin = limb([[0.043, 0.09], [0.046, 0.15], [0.056, 0.3], [0.06, 0.37], [0.054, 0.45], [0.05, 0.515]]);
    put(shin, sh, PANTS, { pos: V(x, 0, 0) });
    // seam down the outside of the trouser leg
    if (D) put(new THREE.BoxGeometry(0.006, 0.36, 0.012), sh, PANTS, { pos: V(x + sx * 0.0585, 0.32, 0), color: 0xb8b8b8 });
    // boot: shaft, foot, toe cap and sole
    put(new THREE.CylinderGeometry(0.053, 0.056, 0.15, sg(14)), sh, FIXED, { pos: V(x, 0.11, 0.004), color: BOOT });
    if (D) put(new THREE.TorusGeometry(0.052, 0.008, 6, 16), sh, FIXED, { pos: V(x, 0.185, 0.004), rot: E(Math.PI / 2, 0, 0), color: BOOT });
    put(ell(0.05, 1.05, 0.95, 2.5, 14, 10), sh, FIXED, { pos: V(x, 0.055, -0.045), color: BOOT });
    put(new THREE.BoxGeometry(0.108, 0.026, 0.275), sh, FIXED, { pos: V(x, 0.013, -0.046), color: SOLE });
  }

  // ---- pelvis, belt and pouch
  put(ell(0.16, 1, 0.78, 0.74), BODY, PANTS, { pos: V(0, 0.94, 0.004) });
  const belt = new THREE.CylinderGeometry(1, 1, 0.045, sg(24), 1, true);
  belt.scale(0.155, 1, 0.112);
  put(belt, BODY, FIXED, { pos: V(0, 1.005, 0), color: BELT });
  if (D) put(new THREE.BoxGeometry(0.052, 0.036, 0.012), BODY, FIXED, { pos: V(0, 1.005, -0.114), color: METAL });
  if (D) put(new THREE.BoxGeometry(0.06, 0.075, 0.045), BODY, FIXED, { pos: V(0.148, 0.97, 0.03), rot: E(0, -0.5, 0), color: 0x3a3c40 });

  // ---- torso: oval lathe with chest, waist and shoulder line
  const torso = limb([[0.142, 0.95], [0.146, 1.02], [0.15, 1.1], [0.163, 1.2], [0.174, 1.3], [0.172, 1.36], [0.156, 1.415], [0.112, 1.465], [0.06, 1.49]], 20);
  torso.scale(1, 1, 0.66);
  put(torso, BODY, TOP);
  // yoke across the shoulders in the accent colour, chest pockets, badge
  // bands follow the facets of the part they wrap so the edges stay clean
  const yoke = band([[0.172, 1.36], [0.1633, 1.39]], 1.015, 20);
  yoke.scale(1, 1, 0.66);
  put(yoke, BODY, ACCENT);
  if (D) for (const sx of [-1, 1]) {
    put(new THREE.BoxGeometry(0.075, 0.07, 0.012), BODY, TOP, { pos: V(sx * 0.082, 1.27, -0.1), rot: E(0, -sx * 0.45, 0), color: 0xc8c8c8 });
    put(new THREE.BoxGeometry(0.079, 0.02, 0.016), BODY, TOP, { pos: V(sx * 0.082, 1.302, -0.101), rot: E(0, -sx * 0.45, 0), color: 0xa0a0a0 });
  }
  if (D) put(new THREE.BoxGeometry(0.004, 0.36, 0.01), BODY, FIXED, { pos: V(0, 1.21, -0.104), rot: E(-0.067, 0, 0), color: 0x55585c });
  if (D) put(new THREE.BoxGeometry(0.04, 0.016, 0.006), BODY, ACCENT, { pos: V(-0.082, 1.33, -0.103), rot: E(0, 0.45, 0) });
  // collar and neck
  const collar = new THREE.TorusGeometry(0.062, 0.017, sg(8, 4), sg(20));
  collar.scale(1.05, 0.92, 1);
  put(collar, BODY, TOP, { pos: V(0, 1.49, 0.006), rot: E(Math.PI / 2 - 0.12, 0, 0), color: 0xd0d0d0 });
  put(new THREE.CylinderGeometry(0.047, 0.051, 0.13, sg(12)), BODY, SKIN, { pos: V(0, 1.515, 0.008) });

  // ---- arms: shoulder, upper arm with accent band, elbow, forearm, cuff, hand
  for (const sx of [-1, 1]) {
    const x = sx * 0.2, ua = sx < 0 ? UARM_L : UARM_R, fa = sx < 0 ? FARM_L : FARM_R;
    put(ell(0.054, 1, 0.9, 0.95, 14, 10), ua, TOP, { pos: V(sx * 0.181, 1.396, 0.004) });
    put(limb([[0.042, 1.11], [0.046, 1.19], [0.05, 1.29], [0.052, 1.37], [0.045, 1.425]]), ua, TOP, { pos: V(x, 0, 0) });
    put(band([[0.0507, 1.318], [0.0513, 1.344]], 1.05), ua, ACCENT, { pos: V(x, 0, 0) });
    put(ell(0.041, 1, 1, 1, 10, 8), fa, TOP, { pos: V(x, 1.115, 0) });
    put(limb([[0.031, 0.885], [0.034, 0.94], [0.041, 1.04], [0.042, 1.1], [0.036, 1.13]]), fa, TOP, { pos: V(x, 0, 0) });
    if (D) put(band([[0.0313, 0.89], [0.0329, 0.921]], 1.09), fa, TOP, { pos: V(x, 0, 0), color: 0x9a9a9a });
    // hand: palm mitt, fingers curled forward, thumb
    put(ell(0.03, 0.85, 1.55, 1.25, 10, 8), fa, SKIN, { pos: V(x, 0.84, -0.004) });
    if (D) put(ell(0.026, 0.8, 1.1, 1.1, 8, 6), fa, SKIN, { pos: V(x, 0.795, -0.012) });
    if (D) put(ell(0.012, 1, 2.4, 1, 6, 5), fa, SKIN, { pos: V(x - sx * 0.006, 0.84, -0.034), rot: E(0.5, 0, 0) });
  }

  // ---- head: one smooth skull-and-jaw shape, nose, ears, eyes, brows, mouth
  const HC = V(0, 1.632, 0.004);
  put(headGeo(1), HEAD, SKIN, { pos: HC });
  put(ell(0.013, 0.75, 1.5, 1.0, 8, 6), HEAD, SKIN, { pos: V(0, 1.614, -0.09), rot: E(0.3, 0, 0) });
  if (D) for (const sx of [-1, 1]) {
    put(ell(0.023, 0.42, 1, 0.72, 8, 6), HEAD, SKIN, { pos: V(sx * 0.077, 1.625, 0.012) });
    put(ell(0.0095, 1, 0.75, 0.6, 8, 6), HEAD, FIXED, { pos: V(sx * 0.032, 1.648, -0.081), color: EYE });
    put(new THREE.BoxGeometry(0.032, 0.007, 0.008), HEAD, HAIR, { pos: V(sx * 0.033, 1.668, -0.08), rot: E(0, -sx * 0.3, -sx * 0.1), show: BARE });
  }
  if (D) put(new THREE.BoxGeometry(0.028, 0.005, 0.006), HEAD, FIXED, { pos: V(0, 1.579, -0.08), color: LIP });

  // ---- hair styles: shells that follow the head shape, tilted back so the
  // hairline sits high on the forehead and low on the nape
  const cap = (k, theta, tilt = 0.36) => { const g = headGeo(k, 0, Math.PI * 2, 0, theta); g.rotateX(tilt); return g; };
  const hair = (geo, st, opt = {}) => put(geo, HEAD, HAIR, { pos: HC, ...opt, show: STYLE + st });
  // 0 short crop
  hair(cap(1.06, Math.PI * 0.5), 0);
  // 1 long, to the shoulders
  hair(cap(1.07, Math.PI * 0.56, 0.3), 1);
  hair(ell(0.1, 0.9, 1.45, 0.55, 14, 10), 1, { pos: V(0, 1.56, 0.07) });
  for (const sx of [-1, 1]) hair(ell(0.03, 0.8, 2.6, 1.4, 8, 8), 1, { pos: V(sx * 0.074, 1.585, 0.014), rot: E(0, 0, sx * 0.08) });
  // 2 bun
  hair(cap(1.06, Math.PI * 0.52), 2);
  hair(ell(0.042, 1, 0.9, 1, 12, 10), 2, { pos: V(0, 1.722, 0.094) });
  // 3 ponytail
  hair(cap(1.06, Math.PI * 0.52), 3);
  hair(ell(0.024, 1, 1, 1, 8, 6), 3, { pos: V(0, 1.665, 0.112) });
  hair(ell(0.028, 0.9, 3.4, 0.85, 10, 8), 3, { pos: V(0, 1.575, 0.118), rot: E(-0.18, 0, 0) });
  // 4 buzz cut
  hair(cap(1.02, Math.PI * 0.5, 0.42), 4);
  // 5 curls: a lumpy, fuller shell
  const curls = cap(1.16, Math.PI * 0.55, 0.32);
  const P = curls.attributes.position, q = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) {
    q.fromBufferAttribute(P, i);
    const k = 1 + 0.07 * Math.sin(q.x * 95) * Math.sin(q.y * 90 + 1.3) * Math.sin(q.z * 88 + 0.7);
    P.setXYZ(i, q.x * k, q.y * k, q.z * k);
  }
  curls.computeVertexNormals();
  hair(curls, 5);
  // 6 swept fringe
  hair(cap(1.06, Math.PI * 0.5, 0.3), 6);
  hair(ell(0.058, 1.15, 0.4, 0.8, 12, 8), 6, { pos: V(0.016, 1.716, -0.04), rot: E(0.15, 0, -0.28) });

  // beard: the lower front of the head shape, a little proud of the skin
  put(headGeo(1.07, Math.PI - 1.25, 2.5, 1.95, Math.PI - 1.95), HEAD, HAIR, { pos: HC, show: BEARD });

  // ---- helmet, neck ring and life-support pack (before the air is breathable)
  put(new THREE.SphereGeometry(0.152, sg(22), sg(16)), HEAD, FIXED, { pos: V(0, 1.64, 0.004), color: 0xe9e8e4, show: HELM });
  put(new THREE.SphereGeometry(0.154, sg(22), sg(10, 4), Math.PI * 0.98, Math.PI * 1.04, Math.PI * 0.3, Math.PI * 0.36), HEAD, VISOR, { pos: V(0, 1.64, 0.004), color: 0x3a2e1c, show: HELM });
  put(new THREE.TorusGeometry(0.1, 0.022, sg(8, 4), sg(22)), BODY, FIXED, { pos: V(0, 1.49, 0.006), rot: E(Math.PI / 2, 0, 0), color: 0x8c9298, show: HELM });
  put(new THREE.BoxGeometry(0.27, 0.36, 0.11), BODY, FIXED, { pos: V(0, 1.24, 0.155), color: 0xdedcd6, show: HELM });
  put(new THREE.BoxGeometry(0.275, 0.04, 0.115), BODY, ACCENT, { pos: V(0, 1.35, 0.155), show: HELM });
  if (D) for (const sx of [-1, 1]) put(new THREE.CylinderGeometry(0.018, 0.018, 0.3, 8), BODY, FIXED, { pos: V(sx * 0.1, 1.24, 0.215), color: 0x8c9298, show: HELM });
  const g = gb.build();
  // one vec3 per vertex keeps us well under the attribute limit with instancing
  const nb = g.attributes.aBone.count, part = new Float32Array(nb * 3);
  for (let i = 0; i < nb; i++) { part[i * 3] = g.attributes.aBone.array[i]; part[i * 3 + 1] = g.attributes.aSlot.array[i]; part[i * 3 + 2] = g.attributes.aShow.array[i]; }
  g.deleteAttribute('aBone'); g.deleteAttribute('aSlot'); g.deleteAttribute('aShow');
  g.setAttribute('aPart', new THREE.Float32BufferAttribute(part, 3));
  // shared corners become one vertex: far fewer vertex-shader runs per person
  return mergeVertices(g, 1e-5);
}

// Pose shader shared by the colour pass and the shadow pass
const POSE = /* glsl */`
attribute vec3 aPart;   // bone, colour slot, visibility
attribute vec4 iAnim;   // walk phase, stride (0 standing .. 1 walking), personal seed, feminine build
attribute vec4 iLook;   // hair style, beard, helmet, accent colour (packed 0xRRGGBB)
attribute vec4 iCols;   // top, skin, hair, trousers (packed 0xRRGGBB)
uniform float uTime;
vec3 cUnpack(float v) { float r = floor(v / 65536.0); float g = floor((v - r * 65536.0) / 256.0); float b = v - r * 65536.0 - g * 256.0; return pow(vec3(r, g, b) / 255.0, vec3(2.2)); }
vec3 cRX(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(p.x, c * p.y - s * p.z, s * p.y + c * p.z); }
vec3 cRY(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z); }
vec3 cRZ(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(c * p.x - s * p.y, s * p.x + c * p.y, p.z); }
vec3 colPose(vec3 p, inout vec3 n) {
  float b = aPart.x, aShow = aPart.z, ph = iAnim.x, amp = iAnim.y, fem = iAnim.w;
  // optional parts collapse away
  float show = 1.0, helm = iLook.z;
  if (aShow > 0.5) {
    if (aShow < 1.5) show = helm;
    else if (aShow < 2.5) show = 1.0 - helm;
    else if (aShow < 3.5) show = (1.0 - helm) * iLook.y;
    else show = (1.0 - helm) * (1.0 - step(0.5, abs(aShow - 4.0 - iLook.x)));
  }
  if (show < 0.5) return vec3(0.0);
  float restY = p.y;
  // build: narrower shoulders and wider hips
  if (b < 0.5) p.x *= 1.0 + fem * (0.1 * (1.0 - smoothstep(0.98, 1.14, restY)) - 0.08 * smoothstep(1.18, 1.42, restY));
  float s = sin(ph), c = cos(ph);
  float side = (abs(b - 2.0) < 0.5 || abs(b - 3.0) < 0.5 || abs(b - 6.0) < 0.5 || abs(b - 7.0) < 0.5) ? -1.0 : 1.0;
  if (b > 5.5) p.x -= side * fem * 0.014;
  if (b > 1.5 && b < 5.5) {
    // legs: thigh swings from the hip, the knee folds most while the leg swings through
    float ls = side < 0.0 ? s : -s, lc = side < 0.0 ? c : -c;
    float thigh = amp * 0.44 * ls + amp * 0.06;
    float knee = -(0.04 + amp * (0.1 + 0.72 * pow(max(0.0, lc), 1.6)));
    vec3 hip = vec3(side * 0.092, 0.93, 0.0), kn = vec3(side * 0.092, 0.5, 0.0);
    if (b > 2.5 && b < 3.5 || b > 4.5) { p = cRX(p - kn, knee) + kn; n = cRX(n, knee); }
    p = cRX(p - hip, thigh) + hip; n = cRX(n, thigh);
  } else if (b > 5.5) {
    // arms swing against the legs, elbows soft
    float as = side < 0.0 ? -s : s;
    float upper = amp * 0.36 * as - 0.03;
    float elbow = 0.16 + amp * (0.12 + 0.3 * max(0.0, as)) + (1.0 - amp) * 0.04 * sin(uTime * 0.7 + iAnim.z * 9.0);
    vec3 sh = vec3(side * 0.2, 1.41, 0.0), el = vec3(side * 0.2, 1.115, 0.0);
    if (b > 6.5 && b < 7.5 || b > 8.5) { p = cRX(p - el, elbow) + el; n = cRX(n, elbow); }
    p = cRX(p - sh, upper) + sh; n = cRX(n, upper);
    float abd = side * (0.07 + fem * 0.02);
    p = cRZ(p - sh, abd) + sh; n = cRZ(n, abd);
  } else if (b > 0.5) {
    // head: settles with each step, looks around when standing
    float look = (1.0 - amp) * 0.45 * sin(uTime * 0.23 + iAnim.z * 17.0) * smoothstep(-0.2, 0.6, sin(uTime * 0.11 + iAnim.z * 5.0));
    float nod = amp * 0.04 * cos(2.0 * ph) - 0.03;
    vec3 nk = vec3(0.0, 1.5, 0.0);
    p = cRX(p - nk, nod) + nk; n = cRX(n, nod);
    p = cRY(p - nk, look) + nk; n = cRY(n, look);
  }
  // shoulders counter-rotate against the hips
  float tw = amp * 0.09 * s;
  float w = b < 0.5 ? smoothstep(0.98, 1.3, restY) : (b > 0.5 && b < 1.5) || b > 5.5 ? 1.0 : 0.0;
  p = cRY(p, tw * w - tw * 0.45 * (1.0 - w)); n = cRY(n, tw * w - tw * 0.45 * (1.0 - w));
  // breathing, step bob and a slight forward lean
  p.y += amp * (0.022 * cos(2.0 * ph) - 0.01) + (1.0 - amp) * w * 0.004 * sin(uTime * 1.6 + iAnim.z * 7.0);
  float lean = -amp * 0.05;
  p = cRX(p, lean); n = cRX(n, lean);
  return p;
}
`;

export function colonistMaterials() {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.uTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + POSE + '\nvarying float vSlot;')
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvec3 cN = objectNormal; vec3 cP = colPose(position, cN); objectNormal = cN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed = cP;')
      .replace('#include <color_vertex>', `#include <color_vertex>
        float aSlot = aPart.y;
        float slotV = aSlot < 0.5 ? iCols.x : aSlot < 1.5 ? iCols.y : aSlot < 2.5 ? iCols.z : aSlot < 3.5 ? iCols.w : aSlot > 4.5 && aSlot < 5.5 ? iLook.w : 16777215.0;
        vec3 slotRGB = cUnpack(slotV);
        // gloves while the suit is on
        if (iLook.z > 0.5 && aSlot > 0.5 && aSlot < 1.5) slotRGB = vec3(0.32, 0.34, 0.37);
        vColor.rgb *= slotRGB; vSlot = aSlot;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vSlot;')
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        if (vSlot > 5.5) roughnessFactor = 0.1;
        else if (vSlot > 0.5 && vSlot < 1.5) roughnessFactor = 0.55;
        else if (vSlot > 1.5 && vSlot < 2.5) roughnessFactor = 0.48;
        else if (vSlot > 3.5 && vSlot < 4.5) roughnessFactor = 0.42;`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
        if (vSlot > 5.5) metalnessFactor = 0.8;`);
  };
  mat.customProgramCacheKey = () => 'colonist-v1';
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  depth.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.uTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + POSE)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvec3 cN = vec3(0.0, 1.0, 0.0); transformed = colPose(position, cN);');
  };
  depth.customProgramCacheKey = () => 'colonist-depth-v1';
  return { mat, depth };
}

// per-instance attribute buffers attached to each LOD's geometry
export function colonistMesh(scene, cap, lod = 0) {
  const geo = colonistGeometry(lod);
  const ia = (name, n) => { const a = new THREE.InstancedBufferAttribute(new Float32Array(cap * n), n); a.setUsage(THREE.DynamicDrawUsage); geo.setAttribute(name, a); return a; };
  const attrs = { iAnim: ia('iAnim', 4), iLook: ia('iLook', 4), iCols: ia('iCols', 4) };
  const { mat, depth } = sharedMats || (sharedMats = colonistMaterials());
  const mesh = new THREE.InstancedMesh(geo, mat, cap);
  mesh.customDepthMaterial = depth;
  mesh.count = 0; mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
  scene.add(mesh);
  return { mesh, attrs };
}
let sharedMats = null;
