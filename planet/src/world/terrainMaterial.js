// Terrain surface shader: a MeshStandardMaterial (so it gets PBR lighting and
// shadows) whose albedo/normal/roughness are replaced by a procedural layer
// stack: regolith, sand, basalt, strata cliffs, frost, wet ground, moss and
// grass. The living layers are driven by the global terraforming uniforms.
import * as THREE from 'three';
import { U } from '../core/shared.js';
import { TEX } from './texstore.js';

export const TERRAIN_GLSL_COMMON = /* glsl */`
uniform sampler2D tRock, tSoil, tSand, tMoss, tNoise;
uniform float uFrost, uWet, uMoss, uGrass, uLush, uWaterLevel, uTime, uSnowMelt, uMicrobe;
uniform vec3 uSunDir;
uniform vec4 uGreen[8];
varying vec3 vTW;
varying vec3 vTN;
varying vec4 vS1;
varying vec4 vS2;
vec3 s2l(vec3 c) { return pow(c, vec3(2.2)); }
float th21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
// interlocking hexagonal sintered-regolith pavers: x = groove mask, y = per-tile id
vec2 hexPave(vec2 p) {
  vec2 r = vec2(1.0, 1.7320508);
  vec2 a = mod(p, r) - r * 0.5;
  vec2 b = mod(p - r * 0.5, r) - r * 0.5;
  vec2 g = dot(a, a) < dot(b, b) ? a : b;
  vec2 id = p - g;
  vec2 ag = abs(g);
  float e = 0.5 - max(dot(ag, normalize(r)), ag.x);
  float fw = fwidth(p.x) * 1.2;
  return vec2(1.0 - smoothstep(0.012, 0.03 + fw, e), th21(floor(id * 10.0 + 0.5)));
}
vec3 gAlb; float gRough; vec3 gN; float gAO;

// ---- loose stones on the ground, procedurally, at the scale a boot sees
vec2 h22(vec2 p) { p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p) * 43758.5453); }
// One size class of angular clasts scattered in a jittered grid. p: world xz
// (m), cell: grid size (m), dens: share of cells holding a stone, sunL:
// horizontal direction toward the sun scaled by shadow length. Returns
// (inside, height, id, shade) where shade is contact occlusion and cast
// shadow on the ground around stones; grad is the stone's surface slope.
vec4 clastLayer(vec2 p, float cell, float dens, vec2 sunL, out vec2 grad) {
  vec2 q = p / cell, ip = floor(q), fp = fract(q);
  vec4 best = vec4(0.0, -1.0, 0.0, 1.0);
  grad = vec2(0.0);
  float sh = 1.0, ao = 1.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 o = vec2(float(i), float(j));
    vec2 h = h22(ip + o);
    if (h.x > dens) continue;
    vec2 h2 = h22(ip + o + 31.7);
    vec2 c = o + 0.2 + 0.6 * h2;
    float rad = 0.15 + 0.27 * h.y;
    float ang = h2.x * 6.2832, ca = cos(ang), sa = sin(ang);
    float asp = 1.0 + 0.7 * h2.y;
    vec2 d0 = fp - c, d1 = d0 + sunL * rad;
    vec2 l = vec2(ca * d0.x + sa * d0.y, -sa * d0.x + ca * d0.y); l.y *= asp;
    vec2 ls = vec2(ca * d1.x + sa * d1.y, -sa * d1.x + ca * d1.y); ls.y *= asp;
    float dp = -1e9, ds = -1e9; vec2 fnB = vec2(1.0, 0.0);
    for (int k = 0; k < 5; k++) {
      float th = float(k) * 1.2566 + fract(h.x * 17.0 + float(k) * 0.37) * 0.6;
      vec2 fn = vec2(cos(th), sin(th));
      float t = dot(l, fn);
      if (t > dp) { dp = t; fnB = fn; }
      ds = max(ds, dot(ls, fn));
    }
    float rr = rad * 0.82, tall = 0.5 + 0.45 * h2.y;
    if (dp < rr) {
      float u = dp / rr, s1 = sqrt(max(0.0, 1.0 - u * u));
      float hh = s1 * rad * tall;
      if (hh > best.y) {
        best = vec4(1.0, hh, fract(h.x * 91.0 + h2.y * 13.0), 1.0);
        vec2 gl = fnB * (-u / max(s1, 0.18) * tall);
        gl.y *= asp;
        grad = vec2(ca * gl.x - sa * gl.y, sa * gl.x + ca * gl.y);
      }
    } else {
      if (ds < rr) sh = min(sh, 0.3 + 0.7 * smoothstep(rr * 0.75, rr, ds));
      ao = min(ao, mix(0.55, 1.0, smoothstep(rr, rr * 1.5, dp)));
    }
  }
  best.w = best.x > 0.0 ? 1.0 : sh * ao;
  return best;
}
vec3 stoneCol(float id) {
  vec3 c = mix(s2l(vec3(0.27, 0.24, 0.22)), s2l(vec3(0.44, 0.31, 0.23)), step(0.45, id));
  c = mix(c, s2l(vec3(0.58, 0.44, 0.33)), step(0.8, id) * 0.8);
  c = mix(c, s2l(vec3(0.17, 0.16, 0.16)), step(0.92, id));
  return c * (0.85 + 0.3 * fract(id * 37.0));
}

vec3 strataColor(float y, float n) {
  float b = fract(y * 0.115 + n * 0.9);
  vec3 c0 = s2l(vec3(0.80, 0.62, 0.46));
  vec3 c1 = s2l(vec3(0.62, 0.33, 0.20));
  vec3 c2 = s2l(vec3(0.44, 0.24, 0.16));
  vec3 c3 = s2l(vec3(0.86, 0.72, 0.56));
  vec3 c = mix(c0, c1, smoothstep(0.15, 0.25, b));
  c = mix(c, c2, smoothstep(0.42, 0.5, b));
  c = mix(c, c3, smoothstep(0.62, 0.68, b));
  c = mix(c, c0, smoothstep(0.86, 0.95, b));
  return c;
}

void computeTerrain() {
  vec3 N = normalize(vTN);
  vec4 bio = vS1;
  float modv = vS2.w;
  float snowW = vS2.x, saltW = vS2.y, crysW = vS2.z;
  vec4 nzA = texture2D(tNoise, vTW.xz * 0.0019);
  vec4 nzB = texture2D(tNoise, vTW.xz * 0.011 + 0.3);
  vec4 nzC = texture2D(tNoise, vTW.xz * 0.045 + 0.7);
  float slope = 1.0 - N.y;
  // wide, noise-broken transition so the rock edge never follows mesh triangles
  float cliff = smoothstep(0.26, 0.62, slope + (nzB.g - 0.5) * 0.18 + (nzC.r - 0.5) * 0.1);

  // ground layers (planar projection)
  // anti-tiling: blend two rotated/offset samples with a low-frequency mask
  vec2 rp = vec2(vTW.x * 0.82 - vTW.z * 0.57, vTW.x * 0.57 + vTW.z * 0.82);
  vec4 soilA = mix(texture2D(tSoil, vTW.xz * 0.21), texture2D(tSoil, rp * 0.17 + 0.37), smoothstep(0.35, 0.65, texture2D(tNoise, vTW.xz * 0.006).g));
  vec4 soilB = texture2D(tSoil, vTW.xz * 0.043 + 0.5);
  vec4 sand = texture2D(tSand, vec2(vTW.x * 0.07 + vTW.z * 0.05, vTW.z * 0.08 - vTW.x * 0.03));
  vec4 mossT = texture2D(tMoss, vTW.xz * 0.19);
  // rock layer (triplanar)
  vec3 bw = pow(abs(N), vec3(5.0)); bw /= (bw.x + bw.y + bw.z);
  float rs = 0.075;
  vec4 rx = texture2D(tRock, vec2(vTW.z, vTW.y * 1.6) * rs);
  vec4 ry = texture2D(tRock, vTW.xz * rs);
  vec4 rz = texture2D(tRock, vec2(vTW.x, vTW.y * 1.6) * rs);
  vec4 rock = rx * bw.x + ry * bw.y + rz * bw.z;
  // anti-tiling for big faces: a second, larger and rotated rock sample
  float rs2 = rs * 0.31;
  vec4 rx2 = texture2D(tRock, vec2(vTW.z * 0.8 + vTW.y * 0.6, vTW.y * 1.2 - vTW.z * 0.3) * rs2 + 0.37);
  vec4 rz2 = texture2D(tRock, vec2(vTW.x * 0.8 - vTW.y * 0.6, vTW.y * 1.2 + vTW.x * 0.3) * rs2 + 0.61);
  vec4 ry2 = texture2D(tRock, vec2(vTW.x * 0.7 + vTW.z * 0.7, vTW.z * 0.7 - vTW.x * 0.7) * rs2 + 0.13);
  float rmix = smoothstep(0.3, 0.7, texture2D(tNoise, vTW.xz * 0.004 + vTW.y * 0.003).g);
  rock = mix(rock, rx2 * bw.x + ry2 * bw.y + rz2 * bw.z, rmix * 0.65);

  float macro = 0.8 + 0.4 * nzA.r * (0.7 + 0.3 * nzB.b);
  float soilDetail = mix(soilA.b, soilB.b, 0.35);

  // --- base albedo per biome
  vec3 regolith = mix(s2l(vec3(0.36, 0.22, 0.15)), s2l(vec3(0.64, 0.44, 0.32)), soilDetail * 0.8 + 0.1);
  regolith = mix(regolith, s2l(vec3(0.52, 0.40, 0.33)), smoothstep(0.35, 0.75, nzB.r) * 0.55);
  regolith = mix(regolith, s2l(vec3(0.60, 0.34, 0.20)), smoothstep(0.55, 0.9, nzA.g) * 0.5);
  vec3 sandC = mix(s2l(vec3(0.62, 0.43, 0.28)), s2l(vec3(0.85, 0.66, 0.47)), sand.b);
  vec3 basalt = mix(s2l(vec3(0.13, 0.11, 0.10)), s2l(vec3(0.33, 0.27, 0.25)), soilDetail);
  vec3 ground = regolith;
  float sandW = smoothstep(0.25, 0.75, bio.r + (nzB.b - 0.5) * 0.4);
  ground = mix(ground, sandC, sandW);
  ground = mix(ground, basalt, smoothstep(0.2, 0.7, bio.g));
  // salt crust with polygon cracks
  vec3 saltC = mix(s2l(vec3(0.72, 0.70, 0.66)), s2l(vec3(0.93, 0.92, 0.88)), smoothstep(0.1, 0.5, sand.b * 0.3 + soilB.a * 0.7));
  float saltCrack = smoothstep(0.08, 0.0, abs(texture2D(tRock, vTW.xz * 0.05).b - 0.5) - 0.02);
  saltC *= 1.0 - saltCrack * 0.35;
  ground = mix(ground, saltC, smoothstep(0.25, 0.7, saltW));
  // crystal plains: lavender-grey glassy grit
  vec3 crysC = mix(s2l(vec3(0.30, 0.27, 0.31)), s2l(vec3(0.56, 0.51, 0.56)), soilDetail);
  ground = mix(ground, crysC, smoothstep(0.25, 0.7, crysW));

  vec3 rockC = mix(s2l(vec3(0.36, 0.21, 0.14)), s2l(vec3(0.66, 0.45, 0.32)), rock.b);
  // sandstone bedding: irregular, low-contrast layers (no candy stripes)
  vec3 strataC = strataColor(vTW.y * 0.45 + rock.b * 3.0 + nzC.r * 4.0 + nzB.g * 6.0, nzB.r);
  strataC = mix(s2l(vec3(0.55, 0.31, 0.19)) * (0.85 + 0.3 * nzC.g), strataC, 0.22) * (0.8 + 0.35 * rock.b);
  rockC = mix(rockC, strataC, smoothstep(0.15, 0.6, bio.b) * smoothstep(0.5, 0.85, slope));
  rockC = mix(rockC, basalt * 1.25, smoothstep(0.2, 0.7, bio.g));
  rockC = mix(rockC, s2l(vec3(0.45, 0.47, 0.52)) * (0.7 + 0.5 * rock.b), smoothstep(0.3, 0.8, snowW));
  rockC = mix(rockC, crysC * 1.1, smoothstep(0.3, 0.8, crysW) * 0.6);

  // scree / exposed rock on eroded crests and steeper hillsides (before cliffs)
  float scree = smoothstep(0.14, 0.42, slope + (nzC.r - 0.5) * 0.12) * (0.35 + 0.55 * smoothstep(0.2, 0.5, bio.b)) * (1.0 - cliff);
  vec3 screeC = mix(rockC * 0.85, ground * 0.8, smoothstep(0.35, 0.75, rock.g)) * (0.8 + 0.35 * rock.b);
  ground = mix(ground, screeC, scree * 0.45);
  vec3 alb = mix(ground, rockC, cliff) * macro;
  float rough = mix(mix(0.93, 0.97, sandW), 0.82, cliff);
  float ao = mix(mix(soilA.a, 1.0, sandW), rock.a, cliff);

  // detail normal
  vec2 tGround = mix(soilA.rg, sand.rg, sandW) * 2.0 - 1.0;
  vec3 nGround = normalize(N + vec3(tGround.x, 0.0, tGround.y) * 0.55);
  vec2 tx = rx.rg * 2.0 - 1.0, ty = ry.rg * 2.0 - 1.0, tz = rz.rg * 2.0 - 1.0;
  vec3 nRock = normalize(N + (vec3(0.0, tx.y, tx.x) * bw.x + vec3(ty.x, 0.0, ty.y) * bw.y + vec3(tz.x, tz.y, 0.0) * bw.z) * 0.9);
  vec3 nrm = normalize(mix(nGround, nRock, cliff));

  // built / packed ground around structures
  // irregular, soft-edged footprint of construction: darker trampled ground, not a painted rectangle
  float packed = smoothstep(0.2 + 0.45 * nzC.r, 0.95, modv) * (1.0 - cliff * 0.6);
  vec3 packedC = alb * mix(0.62, 0.85, soilA.b) * vec3(0.95, 0.93, 0.92);
  alb = mix(alb, packedC, packed * 0.8);
  nrm = normalize(mix(nrm, N, packed * 0.35));
  // paved roads and aprons (mod ~ 1): sintered hex pavers with dust in the joints
  float paved = smoothstep(0.93, 0.985, modv) * (1.0 - cliff);
  if (paved > 0.0) {
    vec2 hp = hexPave(vTW.xz / 0.36);
    // sintered pavers: close tonal range, fine aggregate speckle, dust-filled
    // joints and broad wear/staining so it reads as a used surface, not a tile print
    vec3 paveC = mix(s2l(vec3(0.53, 0.51, 0.49)), s2l(vec3(0.58, 0.56, 0.53)), hp.y) * (0.92 + 0.12 * soilA.b);
    paveC *= 0.94 + 0.08 * th21(floor(vTW.xz * 40.0));
    paveC = mix(paveC, s2l(vec3(0.46, 0.38, 0.32)), hp.x * 0.45);
    paveC = mix(paveC, s2l(vec3(0.52, 0.41, 0.33)), smoothstep(0.55, 0.9, nzC.g) * 0.3);
    paveC *= 1.0 - smoothstep(0.6, 0.95, nzC.b) * 0.12;
    alb = mix(alb, paveC, paved);
    rough = mix(rough, 0.74 + hp.x * 0.15, paved);
    nrm = normalize(mix(nrm, N, paved * 0.85));
    ao = mix(ao, 1.0 - hp.x * 0.25, paved);
  }

  // frost in cold hollows and shaded north slopes
  float hollow = smoothstep(0.55, 0.85, bio.a) * (1.0 - smoothstep(-25.0, 60.0, vTW.y));
  float frostMask = smoothstep(0.55, 0.95, nzB.g * 0.45 + hollow * 0.4 - N.z * 0.12 + nzA.b * 0.25 + nzC.r * 0.1 - sandW * 0.4);
  float frost = uFrost * frostMask * (1.0 - cliff * 0.85) * 0.38;
  alb = mix(alb, s2l(vec3(0.72, 0.74, 0.78)) * (0.85 + 0.15 * soilA.b), frost * (0.6 + 0.4 * soilA.b));
  rough = mix(rough, 0.55, frost);

  // polar snow & glacier ice
  float snowCov = smoothstep(0.25, 0.65, snowW + (nzB.g - 0.5) * 0.3) * (1.0 - cliff * 0.75) * (1.0 - uSnowMelt * smoothstep(0.4, 0.95, 1.0 - snowW + nzA.r * 0.3));
  vec3 snowC = mix(s2l(vec3(0.78, 0.83, 0.9)), s2l(vec3(0.95, 0.97, 1.0)), soilB.b * 0.6 + 0.4 * nzC.r);
  alb = mix(alb, snowC, snowCov);
  rough = mix(rough, 0.45, snowCov);
  nrm = normalize(mix(nrm, N, snowCov * 0.7));

  // living layers
  float above = vTW.y - uWaterLevel;
  float flat_ = 1.0 - smoothstep(0.26, 0.42, slope);
  // vegetation settles where water collects: the landform (bio.a) leads, broad
  // patch noise breaks it up, so terraforming spreads out from hollows and
  // drainage lines and leaves sand, gravel and rock between the patches
  float patchN = smoothstep(0.3, 0.7, nzB.r * 0.6 + nzA.g * 0.5 - 0.05);
  float fertile = clamp(bio.a * 0.62 + patchN * 0.42 + (mossT.b - 0.5) * 0.12 - 0.03, 0.0, 1.0);
  float localG = 0.0;
  float localSeed = 0.0;   // tree spreader (seeds) - spores only grow moss
  for (int i = 0; i < 8; i++) { vec4 gp = uGreen[i]; if (gp.z > 0.0) { float kd = floor(gp.w * 0.5); float st = gp.w - kd * 2.0; float v = st * (1.0 - smoothstep(gp.z * 0.6, gp.z, length(vTW.xz - gp.xy))); localG = max(localG, v); if (kd > 0.5) localSeed = max(localSeed, v); } }
  // Living ground is built from several scales so it never reads as a smooth
  // painted surface: tussock clumps (~0.8 m) and blade speckle (~0.2 m) with
  // shadowed gaps of soil between them, meso hummocks in the normal, natural
  // olive/straw/deep-green variation and a soft sheen.
  vec2 gr1 = vec2(vTW.x * 0.6 - vTW.z * 0.8, vTW.x * 0.8 + vTW.z * 0.6);
  vec4 clump = texture2D(tMoss, gr1 * 1.25 + 0.21);
  vec4 blade = texture2D(tNoise, vTW.xz * 4.3 + 0.13);
  vec4 blade2 = texture2D(tNoise, gr1 * 9.7 + 0.61);
  vec4 hum = texture2D(tMoss, vTW.xz * 0.037 + 0.5);
  float fwG = length(fwidth(vTW.xz));
  float nearF = 1.0 - smoothstep(0.08, 0.6, fwG);          // fine detail only where it resolves
  float midF = 1.0 - smoothstep(0.015, 0.09, fwG);         // tile-sized relief fades before it can repeat (no moire)
  float speck = mix(0.55, blade.r * 0.6 + blade2.g * 0.4, nearF);
  float tuft = smoothstep(0.25, 0.75, mix(0.5, clump.b, midF) * 0.35 + speck * 0.55 + nzC.a * 0.3);
  float mThr = 1.0 - clamp(uMoss * 0.92 + localG * 0.8, 0.0, 1.0);
  float gThr = 1.0 - clamp(uGrass * 0.88 + localSeed * 0.55, 0.0, 1.0);
  fertile *= 1.0 - snowCov * 0.9 - smoothstep(0.4, 0.8, saltW) * 0.6;
  // coverage grows out of the most favourable ground with ragged, stippled
  // edges (clumps and single tufts first), and the ground itself only turns
  // green once the cover has thickened - early on it is bare soil with sprouts
  float rag = (clump.b - 0.5) * 0.28 + (speck - 0.5) * 0.22 * nearF + (nzC.g - 0.5) * 0.12;
  // moss keeps to where it really grows - damp hollows and drainage lines,
  // shaded north-facing ground (north = -z) and the feet of walls - as
  // coherent colonies with soft lobed edges, not a sprinkle of specks
  float shade = smoothstep(-0.05, 0.3, -N.z) * smoothstep(0.04, 0.2, slope);
  float damp = smoothstep(0.42, 0.72, bio.a + shade * 0.25 + scree * 0.15 + (nzC.a - 0.5) * 0.14 + (nzB.r - 0.5) * 0.1);
  float mossCov = smoothstep(mThr, mThr + 0.24, fertile * 0.5 + damp * 0.6 + (nzC.r - 0.5) * 0.12 + (clump.b - 0.5) * 0.08) * damp
                * step(0.001, uMoss + localG) * flat_ * step(0.4, above) * (1.0 - packed) * (1.0 - cliff);
  mossCov *= (0.5 + 0.5 * smoothstep(0.15, 0.6, uMoss + localG)) * (0.7 + 0.3 * smoothstep(0.2, 0.7, clump.b * 0.5 + nzC.a * 0.5));
  float grassCov = smoothstep(gThr, gThr + 0.22, fertile + rag) * step(0.001, uGrass + localSeed * 0.5) * flat_ * smoothstep(0.6, 2.5, above) * (1.0 - packed * 0.8) * (1.0 - scree * 0.85);
  grassCov *= 0.2 + 0.8 * smoothstep(0.12, 0.75, uGrass + localSeed * 0.5);
  // clean cushion moss: yellow-green tips over emerald, fine cushion relief
  vec3 mossC = mix(s2l(vec3(0.25, 0.34, 0.11)), s2l(vec3(0.42, 0.49, 0.17)), smoothstep(0.3, 0.8, clump.b * 0.6 + nzC.a * 0.4));
  mossC = mix(mossC, s2l(vec3(0.2, 0.4, 0.22)), smoothstep(0.55, 0.85, nzB.a) * 0.4);
  mossC *= 0.9 + 0.18 * speck;
  vec3 gDark = s2l(vec3(0.14, 0.2, 0.07)), gMid = s2l(vec3(0.27, 0.34, 0.12)), gLight = s2l(vec3(0.42, 0.45, 0.2));
  vec3 grassC = mix(gDark, gMid, tuft);
  grassC = mix(grassC, gLight, smoothstep(0.55, 0.95, speck * 0.6 + mix(0.5, clump.g, midF) * 0.5) * 0.7);
  grassC = mix(grassC, s2l(vec3(0.16, 0.27, 0.17)), smoothstep(0.55, 0.85, nzA.r) * 0.35);
  // vegetation follows the land: lush dark drainage lines and hollows, drier
  // yellowing crests, and broad shrubland / meadow patches
  float moist = smoothstep(0.3, 0.8, bio.a + (nzB.g - 0.5) * 0.2);
  grassC = mix(grassC * vec3(1.18, 1.05, 0.72), grassC * vec3(0.78, 0.92, 0.85), moist);
  float shrub = smoothstep(0.58, 0.8, nzB.r * 0.7 + nzA.g * 0.3 + moist * 0.15);
  grassC = mix(grassC, s2l(vec3(0.12, 0.17, 0.08)) * (0.75 + 0.5 * clump.b), shrub * 0.55);
  grassC = mix(grassC * vec3(1.08, 0.97, 0.78), grassC, uLush);
  // straw/dry patches and bare soil peeking between tufts
  float dry = smoothstep(0.55, 0.85, nzB.a * 0.7 + nzA.g * 0.4 + (clump.r - 0.5) * 0.15 * midF) * (1.0 - uLush * 0.5);
  grassC = mix(grassC, s2l(vec3(0.5, 0.45, 0.26)) * (0.8 + 0.4 * speck), dry * 0.6);
  grassC *= 0.88 + 0.22 * nzC.r;
  float gap = (1.0 - smoothstep(0.1, 0.3, speck)) * nearF * 0.35;
  grassCov *= 1.0 - 0.6 * smoothstep(0.66, 0.86, nzA.r * 0.8 + nzB.a * 0.3 + (soilA.b - 0.5) * 0.15);
  float edgeSoil = (1.0 - smoothstep(0.0, 0.5, grassCov)) * grassCov * 2.0;   // ragged edges show soil
  grassC = mix(grassC, alb * 0.85, max(gap * 0.3, edgeSoil * (1.0 - tuft) * 0.6));
  alb = mix(alb, mossC, mossCov * 0.85);
  alb = mix(alb, grassC, grassCov);
  // normals: meso hummocks + tussock relief + blade grain (bumped from speckle)
  float live = max(mossCov, grassCov);
  vec2 tm = mossT.rg * 2.0 - 1.0, tc = clump.rg * 2.0 - 1.0, th = hum.rg * 2.0 - 1.0;
  vec2 tb = vec2(blade.g - 0.5, blade2.b - 0.5) * 2.0 * nearF;
  vec3 nLive = normalize(N + vec3(th.x, 0.0, th.y) * 0.3 + vec3(tm.x, 0.0, tm.y) * 0.14 * midF + vec3(tc.x, 0.0, tc.y) * 0.25 * midF + vec3(tb.x, 0.0, tb.y) * 0.4);
  nrm = normalize(mix(nrm, nLive, live));
  rough = mix(rough, 0.78 + 0.18 * (1.0 - speck), live);
  ao = mix(ao, (0.85 + 0.15 * tuft) * mix(1.0, mossT.a, 0.5), grassCov);
  ao = mix(ao, 0.82 + 0.18 * clump.b, mossCov * (1.0 - grassCov));   // moss: soft cushion shading, no dark specks

  // loose stones: gravel, pebbles and cobbles sitting in the fines, each with
  // faceted faces, dust on top, a dark contact line and a shadow away from
  // the sun; only drawn where they resolve on screen, never on pavers,
  // packed ground, dunes, cliffs or under living cover
  {
    float fwS = length(fwidth(vTW.xz));
    float day = smoothstep(-0.02, 0.15, uSunDir.y);
    vec2 sunL = normalize(uSunDir.xz + vec2(1e-4)) * clamp(0.35 / max(uSunDir.y, 0.04), 0.25, 2.6);
    float stony = (1.0 - sandW * 0.85) * (1.0 - packed * 0.85) * (1.0 - paved) * (1.0 - snowCov) * (1.0 - live * 0.85) * (1.0 - cliff)
                * (0.6 + 0.6 * scree + 0.45 * smoothstep(0.2, 0.7, bio.g) + 0.25 * smoothstep(0.45, 0.8, nzB.g));
    // gravel lies in patches: lag deposits between bare fines
    float patchG = smoothstep(0.28, 0.72, texture2D(tNoise, vTW.xz * 0.31 + 0.2).g * 0.7 + texture2D(tNoise, vTW.xz * 0.07).b * 0.5);
    vec4 cells = vec4(0.028, 0.075, 0.22, 0.75), dens = vec4(0.75, 0.55, 0.32, 0.1);
    for (int k = 0; k < 4; k++) {
      float cell = cells[k];
      float f = 1.0 - smoothstep(cell * 0.05, cell * 0.16, fwS);
      if (f < 0.01) continue;
      vec2 gg;
      float dk = dens[k] * stony * (k < 3 ? (0.35 + 0.9 * patchG) : 1.0);
      vec4 r = clastLayer(vTW.xz + float(k) * 13.7, cell, clamp(dk, 0.0, 0.9), sunL, gg);
      if (r.x > 0.0) {
        // stones are the ground's own material, a little darker and greyer,
        // dust-coated on their flatter tops
        vec3 sc = alb * mix(0.55, 1.05, r.z);
        sc = mix(sc, stoneCol(r.z) * 0.9, 0.35 + 0.25 * step(0.75, r.z));
        float top = 1.0 - smoothstep(0.15, 0.9, length(gg));
        sc = mix(sc, alb * 1.04, top * 0.55);
        alb = mix(alb, sc, f);
        rough = mix(rough, 0.78 + 0.12 * r.z, f);
        nrm = normalize(nrm + vec3(-gg.x, 0.0, -gg.y) * 1.6 * f);
        ao = mix(ao, 0.86 + 0.14 * top, f);
      } else {
        float shade = mix(1.0, r.w, f);
        alb *= mix(1.0, shade, 0.5 + 0.45 * day);
        ao *= shade;
      }
    }
    // sand-grain relief and speckle at boot distance
    float fg = 1.0 - smoothstep(0.003, 0.016, fwS);
    if (fg > 0.01) {
      vec4 g1 = texture2D(tNoise, vTW.xz * 23.0), g2 = texture2D(tNoise, vTW.xz * 53.0 + 0.3);
      nrm = normalize(nrm + vec3(g1.r - 0.5 + (g2.g - 0.5) * 0.7, 0.0, g1.g - 0.5 + (g2.b - 0.5) * 0.7) * 0.32 * fg * (1.0 - live));
      alb *= 1.0 + ((g1.b - 0.5) * 0.22 + (g2.a - 0.5) * 0.16) * fg * (1.0 - live * 0.7);
    }
  }

  // microbial mats: thin orange-to-green bands right at the water's edge,
  // the first visible life (like hot-spring cyanobacteria mats)
  if (uMicrobe > 0.001) {
    float edgeBand = (1.0 - smoothstep(0.0, 2.6 + nzC.r * 2.0, above)) * step(-0.6, above) * (1.0 - cliff);
    float mcov = edgeBand * smoothstep(0.35, 0.6, nzC.g * 0.7 + nzB.b * 0.4) * uMicrobe;
    vec3 matC = mix(s2l(vec3(0.66, 0.36, 0.12)), s2l(vec3(0.36, 0.42, 0.14)), smoothstep(0.3, 1.4, above + nzC.a));
    alb = mix(alb, matC, mcov * 0.75);
  }
  // wet shoreline + rain
  float shore = 1.0 - smoothstep(0.0, 2.2, above);
  float wet = max(shore * step(-280.0, uWaterLevel), uWet * (0.55 + 0.45 * nzC.g));
  wet *= (1.0 - frost);
  alb *= mix(1.0, 0.5, wet);
  rough = mix(rough, 0.3, wet);

  gAlb = alb; gRough = rough; gN = nrm; gAO = ao;
}
`;

export function makeTerrainMaterial() {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0, side: THREE.DoubleSide });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      tRock: { value: TEX.rock }, tSoil: { value: TEX.soil }, tSand: { value: TEX.sand }, tMoss: { value: TEX.moss },
      tNoise: U.tNoise, uFrost: U.uFrost, uWet: U.uWet, uMoss: U.uMoss, uGrass: U.uGrass, uSnowMelt: U.uSnowMelt,
      uLush: U.uLush, uWaterLevel: U.uWaterLevel, uTime: U.uTime, uGreen: U.uGreen, uMicrobe: U.uMicrobe, uSunDir: U.uSunDir,
    });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTW;\nvarying vec3 vTN;\nattribute vec4 aS1;\nattribute vec4 aS2;\nvarying vec4 vS1;\nvarying vec4 vS2;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvTW = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvTN = normalize(mat3(modelMatrix) * objectNormal);\nvS1 = aS1; vS2 = aS2;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + TERRAIN_GLSL_COMMON)
      .replace('#include <map_fragment>', 'computeTerrain();\ndiffuseColor.rgb = gAlb;')
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = gRough;')
      .replace('#include <normal_fragment_maps>', 'normal = normalize((viewMatrix * vec4(gN, 0.0)).xyz) * faceDirection;')
      .replace('#include <aomap_fragment>', 'float ambientOcclusion = mix(1.0, gAO, 0.75);\nreflectedLight.indirectDiffuse *= ambientOcclusion;\nreflectedLight.indirectSpecular *= ambientOcclusion;');
  };
  mat.customProgramCacheKey = () => 'terrain-v23';
  return mat;
}
