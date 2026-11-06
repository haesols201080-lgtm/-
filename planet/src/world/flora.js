// Vegetation that grows with terraforming. Every instance has a growth
// threshold; the vertex shader scales it in when the planet-wide growth for
// its layer passes that threshold, so the world greens up continuously
// without CPU work. Near-field plants use the Scatter system; trees are
// static, world-wide and bucketed per 512 m cell.
import * as THREE from 'three';
import { GeoBuilder, taperTube } from '../core/geobuilder.js';
import { Simplex, mulberry32, clamp, smoothstep } from '../core/noise.js';
import { WORLD, U } from '../core/shared.js';
import { Scatter } from './scatter.js';
import { makeRockMaterial } from './materials.js';

const HALF = WORLD.SIZE / 2;

const FLORA_HEAD = /* glsl */`
  uniform float uTime, uWind, uLush; uniform vec4 uGrowth; uniform vec4 uGreen[8];
  attribute float aSway; attribute float aGlow; attribute float aBark;
  attribute vec2 iGrow; attribute vec3 iTint;
  varying float vGlow; varying vec3 vTintF; varying float vSwayF; varying float vBark;`;
const FLORA_BODY = /* glsl */`
  float g = 1.0;
  vTintF = vec3(1.0);
  #ifdef USE_INSTANCING
    vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
    float lg = iGrow.y < 0.5 ? uGrowth.x : iGrow.y < 1.5 ? uGrowth.y : iGrow.y < 2.5 ? uGrowth.z : uGrowth.w;
    // local greening around seed / tree spreaders
    for (int i = 0; i < 8; i++) { vec4 gp = uGreen[i]; if (gp.z > 0.0) { float kd = floor(gp.w * 0.5); float st = gp.w - kd * 2.0; bool ok = kd > 0.5 || iGrow.y < 0.5; if (ok) lg = max(lg, st * (1.0 - smoothstep(gp.z * 0.6, gp.z, length(ip.xz - gp.xy))) * (iGrow.y < 2.5 ? 1.0 : 0.85)); } }
    g = smoothstep(iGrow.x, iGrow.x + 0.12, lg);
    vTintF = iTint;
  #else
    vec3 ip = vec3(0.0);
  #endif
  transformed.y *= g;
  transformed.xz *= mix(0.2, 1.0, g);
  float ph = ip.x * 0.13 + ip.z * 0.11;
  float w = (sin(uTime * 1.7 + ph) * 0.6 + sin(uTime * 3.1 + ph * 1.7) * 0.25) * uWind * aSway;
  transformed.x += w * 0.35;
  transformed.z += w * 0.2;
  vGlow = aGlow; vSwayF = aSway; vBark = aBark;`;

function floraUniforms(sh) {
  Object.assign(sh.uniforms, { uTime: U.uTime, uWind: U.uWind, uGrowth: U.uGrowth, uNight: U.uNight, uLush: U.uLush, uSunDir: U.uSunDir, uGreen: U.uGreen });
}

// shadow-pass material that grows/sways exactly like the visible plant
export function makeFloraDepthMaterial({ map = null, alphaTest = 0 } = {}) {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest });
  m.onBeforeCompile = (sh) => {
    floraUniforms(sh);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + FLORA_HEAD).replace('#include <begin_vertex>', '#include <begin_vertex>\n' + FLORA_BODY);
  };
  m.customProgramCacheKey = () => 'flora-depth' + (map ? '-map' : '');
  return m;
}

export function makeFloraMaterial({ side = THREE.FrontSide, translucent = 0.35, map = null, alphaTest = 0 } = {}) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75, metalness: 0, vertexColors: true, side, map, alphaTest });
  if (map) mat.alphaToCoverage = true;
  mat.onBeforeCompile = (sh) => {
    floraUniforms(sh);
    sh.uniforms.uTrans = { value: translucent };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + FLORA_HEAD)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + FLORA_BODY);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uNight, uLush, uTime, uTrans; uniform vec3 uSunDir;
        varying float vGlow; varying vec3 vTintF; varying float vSwayF; varying float vBark;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        diffuseColor.rgb *= mix(vec3(1.0), vTintF, step(vGlow, 0.5) * (1.0 - step(0.5, vBark)));
        diffuseColor.rgb *= mix(vec3(1.0), vec3(0.85, 1.05, 0.8), uLush * (1.0 - vGlow));`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += vGlow * vTintF * (0.35 + 2.2 * uNight) * (0.8 + 0.2 * sin(uTime * 2.0 + vSwayF * 7.0));
        totalEmissiveRadiance += diffuseColor.rgb * uTrans * vSwayF * max(uSunDir.y, 0.0) * 0.35;`);
  };
  mat.customProgramCacheKey = () => 'flora-v3-' + side + translucent + (map ? '-map' : '');
  mat.depthMat = makeFloraDepthMaterial({ map, alphaTest });
  return mat;
}

// ------------------------------------------------------------------ geometry
function grassTuft(seed, blades = 9, h = 0.7) {
  const rnd = mulberry32(seed);
  const gb = new GeoBuilder(['aSway', 'aGlow']);
  for (let b = 0; b < blades; b++) {
    const a = rnd() * Math.PI * 2, r = rnd() * 0.12;
    const bh = h * (0.6 + rnd() * 0.6), bw = 0.035 + rnd() * 0.03;
    const lean = 0.25 + rnd() * 0.35;
    const pos = [], nor = [];
    const segs = 4;
    const pts = [];
    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const w = bw * (1 - t * 0.92);
      const y = bh * t;
      const off = lean * t * t * bh;
      pts.push([w, y, off]);
    }
    for (let s = 0; s < segs; s++) {
      const [w0, y0, o0] = pts[s], [w1, y1, o1] = pts[s + 1];
      const q = [[-w0, y0, o0], [w0, y0, o0], [w1, y1, o1], [-w0, y0, o0], [w1, y1, o1], [-w1, y1, o1]];
      for (const v of q) { pos.push(...v); nor.push(0, 0.6, -0.8); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    const dark = [0.05, 0.08, 0.02], tip = [0.36 + rnd() * 0.1, 0.5 + rnd() * 0.1, 0.12];
    gb.add(g, {
      pos: new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r), rot: new THREE.Euler(0, a + Math.PI / 2 + (rnd() - 0.5), 0),
      color: (x, y) => { const t = clamp(y / bh, 0, 1); return dark.map((d, i) => d + (tip[i] - d) * Math.pow(t, 0.8)); },
      attrs: { aSway: (x, y) => Math.pow(clamp(y / h, 0, 1), 1.6), aGlow: 0 },
    });
  }
  return gb.build();
}

function mossClump(seed) {
  const S = new Simplex(seed);
  let g = new THREE.IcosahedronGeometry(1, 2);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const f = 1 + 0.25 * S.noise3(v.x * 3, v.y * 3, v.z * 3) + 0.1 * S.noise3(v.x * 9, v.y * 9, v.z * 9);
    v.multiplyScalar(f);
    v.y = Math.max(v.y, -0.2) * 0.45;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  const gb = new GeoBuilder(['aSway', 'aGlow']);
  gb.add(g, { color: (x, y) => { const t = clamp(y / 0.45, 0, 1); return [0.06 + 0.06 * t, 0.12 + 0.1 * t, 0.025 + 0.02 * t]; }, attrs: { aSway: 0, aGlow: 0 } });
  return gb.build();
}

function flower(seed) {
  const rnd = mulberry32(seed);
  const gb = new GeoBuilder(['aSway', 'aGlow']);
  const stems = 3 + Math.floor(rnd() * 3);
  for (let s = 0; s < stems; s++) {
    const h = 0.35 + rnd() * 0.45;
    const a = rnd() * 6.28, r = rnd() * 0.15;
    const base = new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
    const curve = new THREE.QuadraticBezierCurve3(base, base.clone().add(new THREE.Vector3(0, h * 0.6, 0)), base.clone().add(new THREE.Vector3((rnd() - 0.5) * 0.25, h, (rnd() - 0.5) * 0.25)));
    gb.add(taperTube(curve, 4, 4, (t) => 0.012 * (1 - t * 0.5)), { color: [0.12, 0.25, 0.06], attrs: { aSway: (x, y) => clamp(y / h, 0, 1), aGlow: 0 } });
    const top = curve.getPoint(1);
    // bulb + petals
    const bulb = new THREE.SphereGeometry(0.045, 8, 6);
    gb.add(bulb, { pos: top, color: [1, 1, 1], attrs: { aSway: 1, aGlow: 1 } });
    for (let k = 0; k < 5; k++) {
      const pa = k / 5 * Math.PI * 2;
      const petal = new THREE.SphereGeometry(0.06, 6, 4);
      petal.scale(1, 0.25, 0.45);
      petal.translate(0.06, 0, 0);
      gb.add(petal, { pos: top, rot: new THREE.Euler(0, pa, 0.35), color: [1, 1, 1], attrs: { aSway: 1, aGlow: 0 } });
    }
  }
  return gb.build();
}

function fern(seed) {
  const rnd = mulberry32(seed);
  const gb = new GeoBuilder(['aSway', 'aGlow']);
  const fronds = 7;
  for (let f = 0; f < fronds; f++) {
    const a = f / fronds * Math.PI * 2 + rnd() * 0.4;
    const len = 0.9 + rnd() * 0.6;
    const segs = 6;
    const pos = [], nor = [];
    const ptsL = [];
    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const x = t * len, y = Math.sin(t * Math.PI * 0.75) * len * 0.55 - t * t * 0.2;
      const w = 0.16 * Math.sin(t * Math.PI) + 0.02;
      ptsL.push([x, y, w]);
    }
    for (let s = 0; s < segs; s++) {
      const [x0, y0, w0] = ptsL[s], [x1, y1, w1] = ptsL[s + 1];
      const q = [[x0, y0, -w0], [x1, y1, -w1], [x1, y1, w1], [x0, y0, -w0], [x1, y1, w1], [x0, y0, w0]];
      for (const v of q) { pos.push(...v); nor.push(0, 1, 0); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    gb.add(g, { rot: new THREE.Euler(0, a, 0), color: (x, y) => { const t = clamp(x / len, 0, 1); return [0.06 + 0.2 * t, 0.16 + 0.22 * t, 0.07 + 0.06 * t]; }, attrs: { aSway: (x) => clamp(x / len, 0, 1), aGlow: 0 } });
  }
  return gb.build();
}

// Trees ----------------------------------------------------------------
// ------------------------------------------------------------------ flowers
// Real flowering plants built from stems, leaves and petals; colours live in
// the vertex colours (glow = 0 so the per-instance tint only shifts them a little).
const FV = (x, y, z) => new THREE.Vector3(x, y, z);
function stemTo(gb, base, top, r, color, sway = 1) {
  const mid = base.clone().lerp(top, 0.5).add(FV((top.x - base.x) * 0.3, 0, (top.z - base.z) * 0.3));
  gb.add(taperTube(new THREE.QuadraticBezierCurve3(base, mid, top), 5, 4, (t) => r * (1 - t * 0.4)), { color, attrs: { aSway: (x, y) => clamp(y / Math.max(0.1, top.y), 0, 1) * sway, aGlow: 0 } });
}
function basalLeaves(gb, rnd, n, len, color) {
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2 + rnd();
    const leaf = new THREE.SphereGeometry(1, 6, 4); leaf.scale(0.035, 0.008, len / 2); leaf.translate(0, 0, len / 2);
    gb.add(leaf, { pos: FV(0, 0.02, 0), rot: new THREE.Euler(-0.5 - rnd() * 0.3, a, 0), color, attrs: { aSway: 0.15, aGlow: 0 } });
  }
}
function petalRing(gb, c, n, len, wid, tilt, color, rnd, sway = 1) {
  for (let k = 0; k < n; k++) {
    const pa = k / n * Math.PI * 2 + rnd() * 0.2;
    const petal = new THREE.SphereGeometry(1, 7, 4); petal.scale(wid, 0.012, len / 2); petal.translate(0, 0, len / 2);
    gb.add(petal, { pos: c, rot: new THREE.Euler(-tilt, pa, 0, 'YXZ'), color, attrs: { aSway: sway, aGlow: 0 } });
  }
}
function flowerDaisy(seed) {
  const rnd = mulberry32(seed), gb = new GeoBuilder(['aSway', 'aGlow']);
  basalLeaves(gb, rnd, 5, 0.14, [0.22, 0.4, 0.12]);
  const n = 3 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const a = rnd() * 6.28, r = rnd() * 0.12, h = 0.25 + rnd() * 0.22;
    const top = FV(Math.cos(a) * r + (rnd() - 0.5) * 0.08, h, Math.sin(a) * r + (rnd() - 0.5) * 0.08);
    stemTo(gb, FV(Math.cos(a) * r * 0.3, 0, Math.sin(a) * r * 0.3), top, 0.007, [0.24, 0.42, 0.14]);
    petalRing(gb, top, 14, 0.045, 0.011, 0.15, [0.96, 0.96, 0.92], rnd);
    gb.add(new THREE.SphereGeometry(0.016, 8, 5), { pos: top.clone().add(FV(0, 0.004, 0)), scale: FV(1, 0.55, 1), color: [0.95, 0.72, 0.12], attrs: { aSway: 1, aGlow: 0 } });
  }
  return gb.build();
}
function flowerPoppy(seed) {
  const rnd = mulberry32(seed), gb = new GeoBuilder(['aSway', 'aGlow']);
  basalLeaves(gb, rnd, 4, 0.12, [0.3, 0.42, 0.18]);
  const n = 2 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const a = rnd() * 6.28, r = rnd() * 0.1, h = 0.35 + rnd() * 0.25;
    const top = FV(Math.cos(a) * r + (rnd() - 0.5) * 0.12, h, Math.sin(a) * r + (rnd() - 0.5) * 0.12);
    stemTo(gb, FV(0, 0, 0), top, 0.006, [0.3, 0.44, 0.18]);
    // cup of four broad petals
    for (let k = 0; k < 4; k++) {
      const petal = new THREE.SphereGeometry(1, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2); petal.scale(0.034, 0.045, 0.012); petal.rotateX(-Math.PI / 2); petal.translate(0, 0.02, 0.022);
      gb.add(petal, { pos: top, rot: new THREE.Euler(-0.55, k * Math.PI / 2 + rnd() * 0.3, 0, 'YXZ'), color: [0.86, 0.12, 0.08], attrs: { aSway: 1, aGlow: 0 } });
    }
    gb.add(new THREE.SphereGeometry(0.011, 6, 4), { pos: top.clone().add(FV(0, 0.012, 0)), color: [0.08, 0.06, 0.08], attrs: { aSway: 1, aGlow: 0 } });
  }
  return gb.build();
}
function flowerBells(seed) {
  const rnd = mulberry32(seed), gb = new GeoBuilder(['aSway', 'aGlow']);
  basalLeaves(gb, rnd, 6, 0.2, [0.2, 0.38, 0.16]);
  const n = 2 + Math.floor(rnd() * 2);
  for (let i = 0; i < n; i++) {
    const a = rnd() * 6.28, h = 0.3 + rnd() * 0.12, out = FV(Math.cos(a), 0, Math.sin(a));
    const curve = new THREE.QuadraticBezierCurve3(FV(0, 0, 0), FV(0, h * 1.1, 0), out.clone().multiplyScalar(0.16).add(FV(0, h * 0.85, 0)));
    gb.add(taperTube(curve, 6, 4, () => 0.005), { color: [0.22, 0.4, 0.16], attrs: { aSway: (x, y) => clamp(y / h, 0, 1), aGlow: 0 } });
    for (let k = 0; k < 6; k++) {
      const t = 0.5 + k * 0.09, p = curve.getPoint(Math.min(1, t));
      const bell = new THREE.CylinderGeometry(0.012, 0.004, 0.026, 8, 1, true); bell.translate(0, -0.016, 0);
      gb.add(bell, { pos: p.clone().addScaledVector(out, 0.012), rot: new THREE.Euler(0.25, 0, 0), color: [0.36, 0.38, 0.9], attrs: { aSway: 1, aGlow: 0 } });
    }
  }
  return gb.build();
}
function flowerLupine(seed) {
  const rnd = mulberry32(seed), gb = new GeoBuilder(['aSway', 'aGlow']);
  // palmate leaves at the base
  for (let i = 0; i < 4; i++) { const a = i / 4 * 6.28 + rnd(); for (let k = 0; k < 7; k++) { const lf = new THREE.SphereGeometry(1, 5, 3); lf.scale(0.009, 0.004, 0.045); lf.translate(0, 0, 0.045); gb.add(lf, { pos: FV(Math.cos(a) * 0.06, 0.12, Math.sin(a) * 0.06), rot: new THREE.Euler(-0.2, a + (k - 3) * 0.32, 0), color: [0.26, 0.44, 0.2], attrs: { aSway: 0.3, aGlow: 0 } }); } }
  const n = 2 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const a = rnd() * 6.28, r = 0.03 + rnd() * 0.08, h = 0.55 + rnd() * 0.3;
    const base = FV(Math.cos(a) * r, 0, Math.sin(a) * r), top = base.clone().add(FV((rnd() - 0.5) * 0.06, h, (rnd() - 0.5) * 0.06));
    stemTo(gb, base, top, 0.008, [0.26, 0.42, 0.2]);
    const col = rnd() < 0.7 ? [0.5, 0.32, 0.86] : [0.9, 0.42, 0.66];
    for (let k = 0; k < 16; k++) {
      const t = 0.45 + k / 16 * 0.55, p = base.clone().lerp(top, t);
      const w = 0.028 * (1.1 - t);
      const fl = new THREE.SphereGeometry(0.011, 6, 4); fl.scale(1, 0.75, 1.3);
      gb.add(fl, { pos: p.clone().add(FV(Math.cos(k * 2.4) * w, 0, Math.sin(k * 2.4) * w)), color: col.map((c) => c * (0.8 + 0.4 * t)), attrs: { aSway: 1, aGlow: 0 } });
    }
  }
  return gb.build();
}
function flowerUmbel(seed) {
  const rnd = mulberry32(seed), gb = new GeoBuilder(['aSway', 'aGlow']);
  basalLeaves(gb, rnd, 5, 0.12, [0.26, 0.4, 0.18]);
  const n = 2 + Math.floor(rnd() * 2);
  const col = rnd() < 0.6 ? [0.95, 0.94, 0.86] : [0.98, 0.84, 0.36];
  for (let i = 0; i < n; i++) {
    const a = rnd() * 6.28, r = rnd() * 0.1, h = 0.4 + rnd() * 0.2;
    const top = FV(Math.cos(a) * r, h, Math.sin(a) * r);
    stemTo(gb, FV(0, 0, 0), top, 0.006, [0.3, 0.42, 0.2]);
    for (let k = 0; k < 18; k++) {
      const rr = Math.sqrt(k / 18) * 0.05, aa = k * 2.4;
      gb.add(new THREE.SphereGeometry(0.008, 5, 3), { pos: top.clone().add(FV(Math.cos(aa) * rr, -rr * rr * 4, Math.sin(aa) * rr)), color: col, attrs: { aSway: 1, aGlow: 0 } });
    }
  }
  return gb.build();
}

// shrubs: low bushy plants of small leaves, some with berries (flowering stage)
function shrub(seed, berries) {
  const rnd = mulberry32(seed), gb = new GeoBuilder(['aSway', 'aGlow']);
  const n = 7 + Math.floor(rnd() * 5);
  for (let i = 0; i < n; i++) {
    const a = rnd() * 6.28, out = FV(Math.cos(a), 0, Math.sin(a)), h = 0.45 + rnd() * 0.45;
    const tip = out.clone().multiplyScalar(0.25 + rnd() * 0.35).add(FV(0, h, 0));
    stemTo(gb, FV(0, 0, 0), tip, 0.014, [0.3, 0.24, 0.18], 0.6);
    for (let k = 0; k < 9; k++) {
      const p = FV(0, 0, 0).lerp(tip, 0.35 + rnd() * 0.65).add(FV((rnd() - 0.5) * 0.18, (rnd() - 0.5) * 0.12, (rnd() - 0.5) * 0.18));
      const lf = new THREE.SphereGeometry(1, 5, 3); lf.scale(0.05, 0.012, 0.075);
      gb.add(lf, { pos: p, rot: new THREE.Euler(rnd() - 0.5, rnd() * 6.28, rnd() - 0.5), color: [0.24 + rnd() * 0.08, 0.42 + rnd() * 0.1, 0.16], attrs: { aSway: 0.6, aGlow: 0 } });
      if (berries && rnd() < 0.35) gb.add(new THREE.SphereGeometry(0.018, 6, 4), { pos: p.clone().add(FV(0, -0.03, 0)), color: berries, attrs: { aSway: 0.6, aGlow: 0 } });
    }
  }
  return gb.build();
}

function treeParasol(seed) {
  const rnd = mulberry32(seed);
  const S = new Simplex(seed);
  const gb = new GeoBuilder(['aSway', 'aGlow']);
  const H = 7 + rnd() * 3;
  const lean = new THREE.Vector3((rnd() - 0.5) * 2, 0, (rnd() - 0.5) * 2);
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.4, 0), new THREE.Vector3(lean.x * 0.2, H * 0.35, lean.z * 0.2),
    new THREE.Vector3(lean.x * 0.6, H * 0.7, lean.z * 0.6), new THREE.Vector3(lean.x, H, lean.z),
  ]);
  const bark = (x, y) => { const n = S.noise3(x * 4, y * 1.5, 0) * 0.5 + 0.5; return [0.22 + 0.08 * n, 0.15 + 0.05 * n, 0.12 + 0.03 * n]; };
  gb.add(taperTube(curve, 10, 8, (t) => 0.42 * (1 - t * 0.6) + (t < 0.08 ? (0.08 - t) * 3 : 0)), { color: bark, attrs: { aSway: (x, y) => Math.pow(clamp(y / H, 0, 1), 2) * 0.25, aGlow: 0 } });
  const top = curve.getPoint(1);
  const canopy = (c, r, hh) => {
    const g = new THREE.IcosahedronGeometry(1, 2);
    const p = g.attributes.position; const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const f = 1 + 0.18 * S.noise3(v.x * 2.5 + c.x, v.y * 2.5, v.z * 2.5);
      v.multiplyScalar(f);
      v.set(v.x * r, (v.y > 0 ? v.y * hh : v.y * hh * 0.35), v.z * r);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    gb.add(g, { pos: c, color: (x, y) => { const t = clamp(y / hh * 0.5 + 0.5, 0, 1); return [0.07 + 0.2 * t, 0.17 + 0.26 * t, 0.08 + 0.1 * t]; }, attrs: { aSway: 0.3, aGlow: 0 } });
  };
  canopy(top.clone().add(new THREE.Vector3(0, 0.4, 0)), 3.4 + rnd(), 1.3);
  for (let k = 0; k < 2; k++) {
    const t = 0.55 + rnd() * 0.25;
    const p = curve.getPoint(t);
    const dir = new THREE.Vector3(Math.cos(k * 3 + rnd()), 0.5, Math.sin(k * 3 + rnd())).normalize();
    const end = p.clone().addScaledVector(dir, 2.4);
    const br = new THREE.QuadraticBezierCurve3(p, p.clone().addScaledVector(dir, 1.2).add(new THREE.Vector3(0, -0.2, 0)), end);
    gb.add(taperTube(br, 5, 5, (tt) => 0.16 * (1 - tt * 0.6)), { color: bark, attrs: { aSway: 0.2, aGlow: 0 } });
    canopy(end.clone().add(new THREE.Vector3(0, 0.3, 0)), 1.6 + rnd() * 0.6, 0.8);
  }
  return gb.build();
}

function treeSpire(seed) {
  const rnd = mulberry32(seed);
  const gb = new GeoBuilder(['aSway', 'aGlow']);
  const H = 9 + rnd() * 5;
  gb.add(new THREE.CylinderGeometry(0.18, 0.38, H * 0.5, 7), { pos: new THREE.Vector3(0, H * 0.25 - 0.3, 0), color: [0.2, 0.13, 0.1], attrs: { aSway: 0, aGlow: 0 } });
  const tiers = 6;
  for (let i = 0; i < tiers; i++) {
    const t = i / tiers;
    const r = 2.4 * (1 - t * 0.8) + 0.3;
    const y = H * 0.22 + t * H * 0.72;
    const g = new THREE.ConeGeometry(r, H * 0.26, 9, 1, true);
    gb.add(g, { pos: new THREE.Vector3(0, y, 0), rot: new THREE.Euler(0, i * 0.7, 0), color: (x, yy) => { const k = clamp(yy / (H * 0.26) + 0.5, 0, 1); return [0.04 + 0.08 * k, 0.16 + 0.16 * k, 0.15 + 0.12 * k]; }, attrs: { aSway: (x, yy, z, wx, wy) => Math.pow(clamp(wy / H, 0, 1), 2) * 0.35, aGlow: 0 } });
    const cap = new THREE.CircleGeometry(r, 9);
    cap.rotateX(Math.PI / 2);
    gb.add(cap, { pos: new THREE.Vector3(0, y - H * 0.13, 0), rot: new THREE.Euler(0, i * 0.7, 0), color: [0.03, 0.08, 0.07], attrs: { aSway: 0.1, aGlow: 0 } });
  }
  return gb.build();
}

function treeLantern(seed) {
  const rnd = mulberry32(seed);
  const S = new Simplex(seed + 3);
  const gb = new GeoBuilder(['aSway', 'aGlow']);
  const H = 5 + rnd() * 2;
  const prof = [];
  for (let i = 0; i <= 10; i++) { const t = i / 10; prof.push(new THREE.Vector2(0.25 + 0.55 * Math.sin(t * Math.PI * 0.9) * (1 - t * 0.5) + 0.05, t * H - 0.3)); }
  const trunk = new THREE.LatheGeometry(prof, 10);
  gb.add(trunk, { color: (x, y, z) => { const n = S.noise3(x * 3, y * 2, z * 3) * 0.5 + 0.5; return [0.25 + 0.1 * n, 0.2 + 0.06 * n, 0.24 + 0.08 * n]; }, attrs: { aSway: 0, aGlow: 0 } });
  const branches = 5;
  for (let b = 0; b < branches; b++) {
    const a = b / branches * Math.PI * 2 + rnd() * 0.5;
    const start = new THREE.Vector3(0, H * (0.8 + rnd() * 0.15), 0);
    const end = start.clone().add(new THREE.Vector3(Math.cos(a) * (2 + rnd()), 0.6 + rnd(), Math.sin(a) * (2 + rnd())));
    const mid = start.clone().lerp(end, 0.5).add(new THREE.Vector3(0, 0.8, 0));
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    gb.add(taperTube(curve, 6, 5, (t) => 0.13 * (1 - t * 0.7)), { color: [0.25, 0.2, 0.24], attrs: { aSway: (x, y, z, wx, wy) => clamp((wy - H * 0.8) / 2, 0, 1) * 0.4, aGlow: 0 } });
    // hanging glow pods
    for (let k = 0; k < 3; k++) {
      const p = curve.getPoint(0.5 + k * 0.22);
      const pod = new THREE.SphereGeometry(0.16 + rnd() * 0.08, 8, 6);
      pod.scale(1, 1.4, 1);
      gb.add(pod, { pos: p.clone().add(new THREE.Vector3(0, -0.35, 0)), color: [1, 1, 1], attrs: { aSway: 0.5, aGlow: 1 } });
    }
    // leaf fan at the end
    const fan = new THREE.SphereGeometry(0.9, 8, 5);
    fan.scale(1, 0.3, 1);
    gb.add(fan, { pos: end, color: [0.2, 0.08, 0.28], attrs: { aSway: 0.5, aGlow: 0 } });
  }
  return gb.build();
}

export function treeGeometries() {
  return [treeParasol(1), treeParasol(2), treeSpire(3), treeSpire(4), treeLantern(5), treeLantern(6)];
}

// ------------------------------------------------------------------ Flora (near-field plants)
export class Flora {
  constructor(game) {
    const scene = game.engine.scene;
    this.game = game;
    this.S = new Simplex(WORLD.SEED + 77);
    this.mat = makeFloraMaterial({ side: THREE.DoubleSide, translucent: 0.4 });
    this.stoneMat = makeRockMaterial();
    const T = game.terrain;
    const up = new THREE.Vector3(0, 1, 0);
    const qn = new THREE.Quaternion();
    const sf = new Float32Array(8);
    const nrm = new THREE.Vector3();
    const groundOK = (x, z, maxSlope) => {
      if (!T.inWorld(x, z, 30)) return null;
      const y = T.height(x, z);
      if (y < U.uWaterLevel.value + 0.4) return null;
      if (T.slope(x, z) > maxSlope) return null;
      T.surfAt(x, z, sf);
      if (sf[7] > 0.35 || sf[4] > 0.6) return null;
      if (game.isBlocked && game.isBlocked(x, z, 0.3)) return null;
      return y;
    };
    this.groundOK = groundOK;
    const fert = (x, z) => clamp(sf[3] * 0.7 + (this.S.fbm2(x / 90, z / 90, 2) * 0.5 + 0.5) * 0.3 - sf[1] * 0.1 - sf[5] * 0.4, 0, 1);
    // local boost from spreaders; seedsOnly ignores the moss (spore) spreader
    const greenBoost = (x, z, seedsOnly = false) => {
      let b = 0;
      for (const g of U.uGreen.value) if (g.z > 0) { const kd = Math.floor(g.w * 0.5), st = g.w - kd * 2; if (seedsOnly && kd < 1) continue; const d = Math.hypot(x - g.x, z - g.y); if (d < g.z) b = Math.max(b, st * (1 - Math.max(0, (d - g.z * 0.6) / (g.z * 0.4)))); }
      return b;
    };
    const stone = game.props.smallRock;
    this.scatter = new Scatter(scene, {
      tile: 24, radius: 95,
      layers: [
        { // stones
          geo: stone.clone(), mat: this.stoneMat, max: 2600, perTile: 22, castShadow: true, radius: 70,
          attrs: { iTint: 3 },
          place: (x, z, r1, r2, r3) => {
            const y = groundOK(x, z, 0.6); if (y === null) return null;
            if (r1 > 0.45 + sf[2] * 0.3 + sf[1] * 0.3 - sf[0] * 0.3 - sf[5] * 0.3) return null;
            // vegetation buries loose stones: far fewer on grassy, fertile ground
            if (r3 < (U.uGrass.value * 0.8 + U.uMoss.value * 0.2) * clamp(fert(x, z) * 1.4, 0, 1)) return null;
            const s = 0.08 + Math.pow(r2, 2.6) * 0.65;
            const v = 0.85 + r3 * 0.3;
            let c = [0.46, 0.33, 0.26];
            c = c.map((k, i) => k + ([0.58, 0.46, 0.36][i] - k) * sf[0] * 0.6);
            c = c.map((k, i) => k + ([0.64, 0.43, 0.3][i] - k) * sf[2]);
            c = c.map((k, i) => k + ([0.16, 0.14, 0.14][i] - k) * sf[1]);
            c = c.map((k, i) => k + ([0.38, 0.33, 0.42][i] - k) * sf[6] * 0.7);
            return { y: y - s * 0.15, s, ry: r3 * 6.28, rx: (r2 - 0.5) * 0.4, attrs: { iTint: c.map((k) => k * v) } };
          },
        },
        { // moss clumps
          geo: mossClump(3), mat: this.mat, max: 1600, perTile: 14, castShadow: false, radius: 70,
          attrs: { iGrow: 2, iTint: 3 },
          enabled: () => U.uGrowth.value.x > 0.001 || U.uGreen.value.some((g) => g.z > 0 && g.w > 0),
          place: (x, z, r1, r2, r3) => {
            const y = groundOK(x, z, 0.35); if (y === null) return null;
            if (U.uGrass.value > 0.2) return null;              // grass replaces the moss cushions
            const f = fert(x, z);
            if (f < 0.5 && greenBoost(x, z) < 0.3) return null;  // cushions only in damp ground
            const thr = clamp(1.25 - f * 1.1 + (r1 - 0.5) * 0.2 - greenBoost(x, z) * 0.8, 0.02, 1);
            const s = 0.15 + r2 * 0.4;
            return { y: y - 0.06, sx: s * (0.8 + r3 * 0.6), sy: s * 0.6, sz: s, ry: r3 * 6.28, attrs: { iGrow: [thr, 0], iTint: [0.85 + r3 * 0.3, 0.9 + r2 * 0.2, 0.8] } };
          },
        },
        { // grass tufts
          geo: grassTuft(5, 12, 0.6), mat: this.mat, max: 9000, perTile: 120, castShadow: false, radius: 62, densityFalloff: true,
          attrs: { iGrow: 2, iTint: 3 },
          enabled: () => U.uGrowth.value.y > 0.001 || U.uGreen.value.some((g) => g.z > 0 && g.w >= 2.3),
          place: (x, z, r1, r2, r3) => {
            const y = groundOK(x, z, 0.32); if (y === null) return null;
            // tall tufts gather in meadow patches; between them stays short turf
            const meadow = this.S.fbm2(x / 26 + 11, z / 26 - 4, 2) * 0.5 + 0.5;
            if (meadow < 0.48 + r2 * 0.12) return null;
            const thr = clamp(1 - fert(x, z) + (r1 - 0.5) * 0.35 - greenBoost(x, z, true) * 0.5, 0.02, 1);
            const s = 0.8 + r2 * 1.0;
            T.normal(x, z, nrm);
            qn.setFromUnitVectors(up, nrm).multiply(new THREE.Quaternion().setFromAxisAngle(up, r3 * 6.28));
            const dry = smoothstep(0.4, 0.9, r1) * (0.5 + sf[0]);
            return { y: y - 0.03, s, q: qn, attrs: { iGrow: [thr, 1], iTint: [0.85 + dry * 0.35, 0.9 + r3 * 0.2 - dry * 0.05, 0.75 + r2 * 0.2] } };
          },
        },
        // flowering plants in drifts: the ground is split into ~22 m patches,
        // each patch belongs to one species, so meadows read as natural drifts
        ...[[flowerDaisy, 21], [flowerPoppy, 22], [flowerBells, 23], [flowerLupine, 24], [flowerUmbel, 25], [flower, 9]].map(([fn, sd], si) => ({
          geo: fn(sd), mat: this.mat, max: si === 5 ? 300 : 700, perTile: si === 5 ? 3 : 7, castShadow: false, radius: 80,
          attrs: { iGrow: 2, iTint: 3 },
          enabled: () => U.uGrowth.value.z > 0.001,
          place: (x, z, r1, r2, r3) => {
            const wx = x + this.S.noise2(x / 40, z / 40) * 9, wz = z + this.S.noise2(x / 40 + 7, z / 40) * 9;
            const pi = Math.floor(wx / 22), pj = Math.floor(wz / 22);
            const h = ((Math.imul(pi, 73856093) ^ Math.imul(pj, 19349663)) >>> 0) % 1000 / 1000;
            const sp = h < 0.06 ? 5 : Math.floor(((h - 0.06) / 0.94) * 5);
            if (sp !== si) return null;
            const dens = this.S.fbm2(x / 9 + si * 3, z / 9, 2) * 0.5 + 0.5;
            if (dens < 0.45) return null;
            const y = groundOK(x, z, 0.3); if (y === null) return null;
            const f = fert(x, z);
            if (f < 0.35) return null;
            const thr = clamp(1 - f + (r1 - 0.5) * 0.4 - greenBoost(x, z, true) * 0.3, 0.02, 1);
            if (si === 5) {
              const pal = [[0.45, 0.25, 1.0], [0.2, 0.85, 1.0], [1.0, 0.45, 0.2], [1.0, 0.3, 0.6]];
              return { y, s: 0.8 + r2 * 0.6, ry: r2 * 6.28, attrs: { iGrow: [thr, 2], iTint: pal[Math.floor(r3 * pal.length) % pal.length] } };
            }
            const v = 0.9 + r3 * 0.2;
            return { y, s: 1.0 + r2 * 0.7, ry: r2 * 6.28, attrs: { iGrow: [thr, 2], iTint: [v, v, v] } };
          },
        })),
        // shrubs (flowering plants): green and berry bushes at meadow edges
        ...[[0, null], [1, [0.62, 0.08, 0.12]], [2, [0.2, 0.22, 0.55]]].map(([k, berry]) => ({
          geo: shrub(41 + k * 7, berry), mat: this.mat, max: 500, perTile: 3, castShadow: true, radius: 90,
          attrs: { iGrow: 2, iTint: 3 },
          enabled: () => U.uGrowth.value.z > 0.001,
          place: (x, z, r1, r2, r3) => {
            const edge = this.S.fbm2(x / 30 - k * 5, z / 30 + 2, 2) * 0.5 + 0.5;
            if (edge < 0.58 || r1 > 0.6) return null;
            const y = groundOK(x, z, 0.35); if (y === null) return null;
            const f = fert(x, z);
            if (f < 0.4) return null;
            const thr = clamp(1.05 - f * 0.9 + (r2 - 0.5) * 0.3 - greenBoost(x, z, true) * 0.3, 0.05, 1);
            const v = 0.85 + r3 * 0.3;
            return { y: y - 0.05, s: 0.8 + r2 * 0.9, ry: r3 * 6.28, attrs: { iGrow: [thr, 2], iTint: [v, v * (0.95 + r2 * 0.1), v] } };
          },
        })),
        { // ferns: spore plants, the first vascular plants - they follow the
          // moss into damp ground, well before grass and flowers
          geo: fern(13), mat: this.mat, max: 900, perTile: 9, castShadow: true, radius: 95,
          attrs: { iGrow: 2, iTint: 3 },
          enabled: () => U.uGrowth.value.x > 0.2,
          place: (x, z, r1, r2, r3) => {
            const y = groundOK(x, z, 0.4); if (y === null) return null;
            const f = fert(x, z);
            if (f < 0.45) return null;
            // ferns grow in clumps in damp, shaded spots, not everywhere
            const clump = this.S.fbm2(x / 14 - 7, z / 14 + 3, 2) * 0.5 + 0.5;
            if (clump < 0.6) return null;
            const thr = clamp(0.24 + (1 - f) * 0.45 + (r1 - 0.5) * 0.2, 0.22, 1);
            return { y: y - 0.05, s: 0.8 + r2 * 1.1, ry: r3 * 6.28, attrs: { iGrow: [thr, 0], iTint: [0.9 + r3 * 0.2, 0.95 + r2 * 0.15, 0.85] } };
          },
        },
      ],
    });
  }

  update(camPos) { this.scatter.update(camPos); }
  invalidate() { this.scatter.invalidate(); }
}
