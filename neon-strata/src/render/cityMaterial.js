// The city surface shader: a MeshStandardMaterial extended with a procedural, attribute-driven
// "style" system (interior-mapped windows, hull plating, wet asphalt, neon, signage …),
// neon light-field irradiance, cloud-deck sun occlusion and analytic height fog.
import * as THREE from 'three';
import { U, NS_COMMON } from './env.js';

export const ST = {
  CONCRETE: 0, METAL: 1, CORRUGATED: 2, DARKGLASS: 3, EMISSIVE: 4, SIGN: 5, ROAD: 6, PAVE: 7, RUST: 8, MIRROR: 9,
  WIN_PUNCH: 10, WIN_CURTAIN: 11, WIN_RIBBON: 12, WIN_SLIT: 13, WIN_HIVE: 14, MEGAHULL: 15, SHANTY: 16, LUXURY: 17,
  GROW: 18, WIN_INDUSTRIAL: 19, WATER: 20, FOLIAGE: 21, STONE: 22, HOLO: 23, TILE: 24, FABRIC: 25,
};
// light colour palettes for lit windows / emissives (index = param B)
export const PAL = { WARM: 0, NEUTRAL: 1, COOL: 2, TEAL: 3, MAGENTA: 4, AMBER: 5, MIXED: 6, RED: 7, GREEN: 8, VIOLET: 9, GOLD: 10 };

const VERT_PARS = /* glsl */ `
attribute vec4 aColor; attribute vec4 aStyle; attribute vec4 aStyle2;
flat varying vec4 vStyle; flat varying vec4 vStyle2;
varying vec3 vWPos; varying vec3 vWNormal; varying vec2 vFUv; varying vec4 vCol;
`;
const VERT_MAIN = /* glsl */ `
vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
vWNormal = normalize(mat3(modelMatrix) * objectNormal);
vFUv = uv; vCol = aColor; vStyle = aStyle; vStyle2 = aStyle2;
`;

const FRAG_PARS = /* glsl */ `
${NS_COMMON}
flat varying vec4 vStyle; flat varying vec4 vStyle2;
varying vec3 vWPos; varying vec3 vWNormal; varying vec2 vFUv; varying vec4 vCol;
uniform sampler2D uSignAtlas; uniform float uInterior;
float nsOpen = 1.0; vec3 nsSpill = vec3(0.0); float nsAO = 1.0; float nsIndoor = 0.0;

vec3 nsPalette(float idx, float h){
  int i = int(idx + 0.5);
  if (i == 6) i = h < 0.52 ? 0 : (h < 0.74 ? 1 : (h < 0.87 ? 2 : (h < 0.93 ? 5 : (h < 0.97 ? 3 : 4))));
  if (i == 0) return vec3(1.0, 0.66, 0.36);
  if (i == 1) return vec3(1.0, 0.86, 0.68);
  if (i == 2) return vec3(0.62, 0.80, 1.0);
  if (i == 3) return vec3(0.16, 0.92, 0.82);
  if (i == 4) return vec3(1.0, 0.18, 0.62);
  if (i == 5) return vec3(1.0, 0.45, 0.08);
  if (i == 7) return vec3(1.0, 0.10, 0.05);
  if (i == 8) return vec3(0.35, 1.0, 0.45);
  if (i == 9) return vec3(0.55, 0.30, 1.0);
  return vec3(1.0, 0.78, 0.40);
}
// groove mask + bevel slope for a panel grid (p in metres)
vec3 nsSeams(vec2 p, vec2 size, float w, float px){
  vec2 f = fract(p / size);
  vec2 d = min(f, 1.0 - f) * size;
  float ww = max(w, px * 0.75);
  vec2 m = 1.0 - smoothstep(vec2(0.0), vec2(ww), d);
  vec2 sl = m * sign(f - 0.5) * (w / ww);
  return vec3(max(m.x, m.y) * (w / ww), sl);
}
void nsWall(int kind, vec2 m, vec3 base, float px, inout vec3 albedo, inout float rough, inout float metal, inout vec2 slope){
  vec4 n1 = nsNoise(m * 0.0137); vec4 n2 = nsNoise(m * 0.097 + 0.31);
  if (kind == 0) { // board-formed concrete
    albedo = base * (0.72 + 0.5 * n1.r) * (0.9 + 0.2 * n2.g);
    rough = 0.80 + 0.18 * n2.b; metal = 0.0;
    vec3 sm = nsSeams(m, vec2(2.44, 1.22), 0.018, px);
    albedo *= 1.0 - sm.x * 0.4; slope += sm.yz * 0.7;
    float streak = nsNoise(vec2(m.x * 0.22, m.y * 0.012)).a;
    albedo *= 0.72 + 0.4 * smoothstep(0.25, 0.75, streak);
  } else if (kind == 1) { // metal cladding
    vec2 ps = vec2(1.5, 3.0);
    vec2 pc = floor(m / ps); float ph = nsHash(pc + 3.7);
    albedo = base * (0.78 + 0.4 * ph) * (0.85 + 0.3 * n1.g);
    rough = 0.32 + 0.28 * n2.r + 0.22 * ph; metal = 0.9;
    vec3 sm = nsSeams(m, ps, 0.03, px);
    albedo *= 1.0 - sm.x * 0.65; slope += sm.yz * 1.0 + (vec2(nsHash(pc + 1.0), nsHash(pc + 2.0)) - 0.5) * 0.05 * (1.0 - smoothstep(0.2, 1.0, px));
  } else if (kind == 2) { // painted plaster / render, patched
    vec2 pc = floor(m / vec2(5.3, 3.1) + n1.rg * 0.6);
    float ph = nsHash(pc);
    albedo = base * (0.7 + 0.45 * n1.b) * mix(1.0, 0.72 + 0.5 * ph, 0.5);
    rough = 0.78 + 0.15 * n2.r; metal = 0.0;
    float streak = nsNoise(vec2(m.x * 0.3, m.y * 0.015)).g;
    albedo *= 0.65 + 0.5 * smoothstep(0.2, 0.7, streak);
  } else { // dark composite / stone slabs
    vec2 ps = vec2(3.2, 1.6);
    vec2 pc = floor(m / ps); float ph = nsHash(pc + 9.1);
    albedo = base * (0.8 + 0.3 * ph) * (0.85 + 0.25 * n1.a);
    rough = 0.38 + 0.3 * n2.g; metal = 0.25;
    vec3 sm = nsSeams(m, ps, 0.02, px);
    albedo *= 1.0 - sm.x * 0.6; slope += sm.yz * 0.8;
  }
}
#ifdef NS_INTERIOR
// fake room behind a window: returns colour (lit) for a ray entering at f (cell coords) with tangent-space dir vt
vec3 nsRoom(vec2 f, vec3 vt, vec2 cs, float h1, float h2, out float ceilGlow){
  float depth = mix(0.9, 1.9, h2);
  vec3 rd = vec3(vt.x / cs.x, vt.y / cs.y, max(-vt.z, 0.02) / cs.x);
  vec3 ro = vec3(f, 0.0);
  vec3 inv = 1.0 / (rd + vec3(1e-5));
  vec3 tmax = max((vec3(0.0) - ro) * inv, (vec3(1.0, 1.0, depth) - ro) * inv);
  float t = min(tmax.x, min(tmax.y, tmax.z));
  vec3 hit = ro + rd * t;
  vec3 c; ceilGlow = 0.0;
  float zf = hit.z / depth;
  if (tmax.z <= tmax.x && tmax.z <= tmax.y) { // back wall with furniture / shelving silhouettes
    float fx = floor(hit.x * 4.0 + h1 * 3.0);
    float fh = 0.25 + 0.35 * nsHash(vec2(fx, h2 * 91.0));
    float furn = step(hit.y, fh);
    c = mix(vec3(0.62, 0.58, 0.52), vec3(0.13, 0.11, 0.10), furn);
    float door = step(0.62, hit.x) * step(hit.x, 0.82) * step(hit.y, 0.7) * step(0.5, h1);
    c = mix(c, vec3(0.9, 0.85, 0.7) * 1.6, door * 0.6);
    c *= 0.55 + 0.45 * hit.y;
  } else if (tmax.y < tmax.x) {
    if (rd.y > 0.0) { // ceiling with light fixtures
      vec2 g = fract(vec2(hit.x * 2.0, zf * 3.0 * depth));
      float fix = step(0.25, g.x) * step(g.x, 0.75) * step(0.35, g.y) * step(g.y, 0.65);
      c = vec3(0.5) + vec3(3.2) * fix; ceilGlow = fix;
    } else c = vec3(0.16, 0.14, 0.12) * (0.6 + 0.4 * nsHash(floor(vec2(hit.x * 3.0, zf * 4.0)) + h1));
  } else c = vec3(0.42, 0.40, 0.38) * (0.55 + 0.45 * hit.y);
  return c * (1.0 - 0.45 * zf);
}
#endif
float nsRipple(vec2 p, float t){
  vec2 c = floor(p); vec2 f = fract(p) - 0.5;
  float h = nsHash(c);
  float ph = fract(t * (0.6 + h * 0.5) + h * 7.0);
  float d = length(f + (nsHash22(c) - 0.5) * 0.5);
  return sin((d - ph * 0.55) * 42.0) * smoothstep(0.08, 0.0, abs(d - ph * 0.55)) * (1.0 - ph);
}
`;

const FRAG_SURFACE = /* glsl */ `
{
  int st = int(vStyle.x + 0.5);
  float seed = vStyle.y;
  float pA = vStyle.z / 255.0; float pB = vStyle.w;
  int flags = int(vStyle2.z + 0.5);
  nsIndoor = float((flags / 8) % 2);
  vec3 wN = normalize(vWNormal) * faceDirection;
  vec3 T; vec3 Bt;
  if (abs(wN.y) < 0.96) { T = normalize(cross(vec3(0.0, 1.0, 0.0), wN)); Bt = cross(wN, T); } else { T = vec3(1.0, 0.0, 0.0); Bt = vec3(0.0, 0.0, -1.0); }
  vec3 base = vCol.rgb * vCol.rgb;
  float px = max(length(dFdx(vWPos)), length(dFdy(vWPos)));
  vec3 Vw = normalize(cameraPosition - vWPos);
  vec3 albedo = base; float rough = 0.7; float metal = 0.0; vec3 emis = vec3(0.0); vec2 slope = vec2(0.0);
  float wetAllow = 1.0 - nsIndoor;
  vec4 lf = nsLightField(vWPos, 0.0);
  nsOpen = mix(lf.a, 1.0, smoothstep(40.0, 260.0, vWPos.y));
  nsSpill = lf.rgb * exp(-max(vWPos.y - uLightMapInfo.z, 0.0) / uLightMapInfo.w) * (1.0 - nsIndoor);
  nsAO = vCol.a;
  float night = uNight;

  if (st >= 10 && st <= 19 && st != 15) {
    // ------------------------------------------------------------------ windowed facades
    vec2 cs = max(vStyle2.xy * 0.1, vec2(0.5));
    vec2 uvc = vFUv; vec2 cell = floor(uvc); vec2 f = fract(uvc);
    vec2 m = uvc * cs;
    float h1 = nsHash(cell + seed * 7.31); float h2 = nsHash(cell * 1.73 + seed * 3.17 + 11.0); float h3 = nsHash(cell.yx * 2.31 + seed + 5.0);
    float hFloor = nsHash(vec2(cell.y * 3.1, seed));
    vec2 wmin = vec2(0.2, 0.3); vec2 wmax = vec2(0.8, 0.82); float frameW = 0.07; int wallKind = flags % 4; float glassRough = 0.08; vec3 glassTint = vec3(0.02, 0.025, 0.03);
    float sub = 0.0; float litBoost = 1.0; float spandrel = 0.0; float balcony = 0.0;
    if (st == 11) { wmin = vec2(0.02, 0.0); wmax = vec2(0.98, 1.0); frameW = 0.05; spandrel = 0.2; glassTint = base * 0.25; glassRough = 0.04; }
    else if (st == 12) { wmin = vec2(-0.1, 0.36); wmax = vec2(1.1, 0.84); frameW = 0.05; sub = 2.0; }
    else if (st == 13) { wmin = vec2(0.36, 0.1); wmax = vec2(0.64, 0.92); frameW = 0.05; }
    else if (st == 14) { wmin = vec2(0.12, 0.34); wmax = vec2(0.88, 0.88); frameW = 0.06; balcony = 1.0; }
    else if (st == 16) { wmin = vec2(0.16 + 0.3 * h2, 0.36 + 0.12 * h3); wmax = wmin + vec2(0.2 + 0.2 * h1, 0.22 + 0.16 * h2); wmax = min(wmax, vec2(0.94)); frameW = 0.05; if (h3 > 0.58) { wmin = vec2(2.0); wmax = vec2(2.0); } }
    else if (st == 17) { wmin = vec2(0.06, 0.08); wmax = vec2(0.94, 0.9); frameW = 0.045; glassRough = 0.03; glassTint = vec3(0.03, 0.04, 0.05); }
    else if (st == 18) { wmin = vec2(0.03, 0.04); wmax = vec2(0.97, 0.96); frameW = 0.05; sub = 3.0; litBoost = 1.5; }
    else if (st == 19) { wmin = vec2(0.08, 0.2); wmax = vec2(0.92, 0.9); frameW = 0.05; sub = 4.0; }
    vec2 d2 = min(f - wmin, wmax - f) * cs;
    float din = min(d2.x, d2.y);
    float aa = max(px, 0.002);
    float win = smoothstep(-aa * 0.6, aa * 0.6, din);
    float frame = win * (1.0 - smoothstep(frameW - aa * 0.5, frameW + aa * 0.5, din));
    if (sub > 0.0) { // glazing bars
      vec2 gf = fract((f - wmin) / (wmax - wmin) * vec2(sub, st == 19 ? 3.0 : 1.0));
      vec2 gd = min(gf, 1.0 - gf) * (wmax - wmin) * cs / vec2(sub, st == 19 ? 3.0 : 1.0);
      frame = max(frame, win * (1.0 - smoothstep(0.02, 0.02 + aa, min(gd.x, gd.y))));
    }
    if (spandrel > 0.0) { float sp = 1.0 - smoothstep(spandrel - aa / cs.y, spandrel + aa / cs.y, f.y); frame = max(frame, sp * 0.999); }
    float glass = win * (1.0 - frame);

    // wall
    nsWall(wallKind, m, base, px, albedo, rough, metal, slope);
    if (st == 16) { // shanty patchwork: random coloured sheets
      vec2 pc = floor(m / vec2(2.2, 2.6) + nsNoise(m * 0.02).rg * 0.8); float ph = nsHash(pc + seed);
      vec3 tint = mix(vec3(0.62, 0.56, 0.5), nsPalette(floor(ph * 9.99), ph) * 0.35 + 0.35, step(0.7, ph) * 0.45);
      albedo *= tint * 1.25; rough = mix(rough, 0.45, step(0.7, ph)); metal = step(0.7, ph) * 0.7;
      float corr = sin(m.x * 26.0) * step(0.4, ph);
      slope.x += corr * 0.35 * (1.0 - smoothstep(0.02, 0.12, px));
    }
    // sill / lintel shading + grime streaks under the window
    float below = smoothstep(wmin.y, wmin.y - 0.25, f.y) * step(wmin.x, f.x) * step(f.x, wmax.x);
    albedo *= 1.0 - below * 0.35 * nsNoise(vec2(m.x * 0.7, m.y * 0.05)).r * (1.0 - spandrel * 4.0);
    float recess = (1.0 - win) * smoothstep(0.22, 0.0, -din) ;
    nsAO *= 1.0 - 0.0 * recess;
    if (balcony > 0.5) { // parapet band + deep shadowed recess above
      float par = step(f.y, 0.3);
      albedo = mix(albedo, base * (0.5 + 0.4 * h3), par * 0.8);
      float slab = smoothstep(0.035, 0.0, abs(f.y - 0.31));
      albedo = mix(albedo, vec3(0.04), slab);
    }
    vec3 frameCol = mix(vec3(0.045), base * 0.35, 0.3); float frameRough = 0.4; float frameMetal = 0.8;

    // lighting state of this room
    float litRatio = clamp(pA * mix(0.45, 1.0, night), 0.0, 1.0);
    float litRnd = h1;
    if (st == 11 || st == 12) litRnd = mix(h1, hFloor, 0.55); // offices light whole floors
    float lit = step(litRnd, litRatio);
    vec3 lc = nsPalette(pB, h2);
    if (st == 18) { lc = mix(vec3(1.0, 0.12, 0.75), vec3(0.75, 0.2, 1.0), h2); lit = step(h1, 0.92); }
    if (st == 19 && h3 > 0.8) lc = vec3(1.0, 0.25, 0.04);
    float tv = step(0.93, h3) * lit; // flickering screens
    if (tv > 0.5) lc = mix(lc, vec3(0.3, 0.55, 1.0) * (0.6 + 0.6 * nsHash(vec2(floor(uTime * 7.0 + h2 * 9.0), h1))), 0.8);
    float roomB = 0.35 + 0.65 * nsHash(cell * 0.71 + seed * 1.9 + 3.0);
    float inten = (0.55 + 1.5 * h2 * h2) * roomB * litBoost * mix(0.5, 1.0, night) * (st == 11 ? 0.6 : 1.0);

    // level of detail: when cells shrink to a pixel, converge to the average look
    float fw = max(fwidth(uvc).x, fwidth(uvc).y);
    float lod = smoothstep(0.30, 0.95, fw);
    vec2 area = clamp(wmax - wmin, 0.0, 1.0);
    float areaF = area.x * area.y * (1.0 - spandrel) * 0.9;

    vec3 roomCol = vec3(0.0); float ceilGlow = 0.0;
    vec3 inner = vec3(0.012, 0.014, 0.018);
    #ifdef NS_INTERIOR
    if (lod < 0.999 && glass > 0.001) {
      vec3 vt = vec3(dot(-Vw, T), dot(-Vw, Bt), dot(-Vw, wN));
      vec3 rc = nsRoom(f, vt, cs, h1, h2, ceilGlow);
      float blind = step(1.0 - (0.15 + 0.6 * h3) * step(0.45, h1), (f.y - wmin.y) / max(wmax.y - wmin.y, 1e-3)) * (st == 11 ? 0.0 : 1.0);
      if (st == 18) { // grow racks: glowing shelves with plants
        float rack = smoothstep(0.1, 0.0, abs(fract(rc.g * 3.0 + f.y * 4.0) - 0.5) - 0.3);
        rc = mix(vec3(0.1, 0.5, 0.12), vec3(1.0), rack) * 0.8;
      }
      float curt = step(abs(f.x - 0.5 * (wmin.x + wmax.x)), (wmax.x - wmin.x) * (0.5 - 0.32 * h2 * step(0.55, h3))) ;
      vec3 litc = mix(lc, vec3(1.0, 0.9, 0.78), 0.25);
      roomCol = mix(rc * litc * inten, lc * inten * (0.22 + 0.06 * sin(f.y * cs.y * 60.0)), max(blind, 1.0 - curt)) * lit;
      inner = mix(inner + rc * 0.012 * (1.0 - night * 0.5), base * 0.25, blind * (1.0 - lit));
    } else
    #endif
    { roomCol = lc * inten * 0.55 * lit; }
    vec3 avgEmis = lc * 0.7 * litBoost * mix(0.5, 1.0, night) * 0.55 * litRatio * areaF * (0.5 + 1.0 * nsHash(floor(cell / 3.0) + seed)) * (st == 11 ? 0.6 : 1.0);
    // compose
    vec3 wallAlb = albedo; float wallRough = rough; float wallMetal = metal;
    albedo = mix(wallAlb, frameCol, frame); rough = mix(wallRough, frameRough, frame); metal = mix(wallMetal, frameMetal, frame);
    float dirt = nsNoise(m * 0.05).b;
    albedo = mix(albedo, glassTint + inner, glass); rough = mix(rough, glassRough + 0.25 * dirt * dirt, glass); metal = mix(metal, 0.0, glass);
    slope *= 1.0 - win;
    emis = roomCol * glass;
    // bevel at window reveal
    vec2 rs = (1.0 - smoothstep(vec2(0.0), vec2(0.06 + aa), abs(d2))) * sign(f - 0.5 * (wmin + wmax)) * step(abs(din), 0.12) * (1.0 - lod);
    slope += rs * 0.8 * step(din, 0.06);
    // far LOD blend
    albedo = mix(albedo, mix(wallAlb, glassTint, areaF), lod);
    rough = mix(rough, mix(wallRough, 0.2, areaF), lod); metal = mix(metal, wallMetal * (1.0 - areaF), lod);
    emis = mix(emis, avgEmis, lod);
    if (st == 17) { // luxury: gilded trim between floors
      float trim = smoothstep(0.035, 0.02, abs(f.y - 0.04)) * (1.0 - lod);
      albedo = mix(albedo, vec3(1.0, 0.72, 0.3), trim); metal = mix(metal, 1.0, trim); rough = mix(rough, 0.25, trim);
    }
    wetAllow *= 0.3;
  } else if (st == 15) {
    // ------------------------------------------------------------------ megastructure hull
    vec2 m = vFUv;
    vec4 n1 = nsNoise(m * 0.0021); vec4 n2 = nsNoise(m * 0.031 + 0.5);
    vec2 s1 = vec2(54.0, 36.0); vec2 s2 = vec2(9.0, 6.0); vec2 s3 = vec2(1.5, 1.0);
    vec2 c1 = floor(m / s1); vec2 c2 = floor(m / s2); vec2 c3 = floor(m / s3);
    float hA = nsHash(c1 + seed); float hB = nsHash(c2 + seed * 1.7); float hC = nsHash(c3 + seed * 2.3);
    float f2 = 1.0 - smoothstep(0.02, 0.2, px); float f3 = 1.0 - smoothstep(0.004, 0.035, px); float f1 = 1.0 - smoothstep(0.3, 2.5, px);
    albedo = base * (0.62 + 0.5 * hA * f1 + 0.0) * (0.8 + 0.4 * mix(0.5, hB, f2)) * (0.9 + 0.2 * mix(0.5, hC, f3)) * (0.75 + 0.5 * n1.r);
    rough = 0.42 + 0.3 * n2.g + 0.2 * mix(0.5, hB, f2); metal = 0.65 + 0.3 * mix(0.5, hA, f1);
    vec3 sm1 = nsSeams(m, s1, 0.5, px); vec3 sm2 = nsSeams(m, s2, 0.09, px); vec3 sm3 = nsSeams(m, s3, 0.015, px);
    albedo *= (1.0 - sm1.x * 0.75) * (1.0 - sm2.x * 0.55) * (1.0 - sm3.x * 0.35);
    slope += sm1.yz * 1.0 + sm2.yz * 0.8 + sm3.yz * 0.5;
    slope += (vec2(nsHash(c2 + 1.3), nsHash(c2 + 2.9)) - 0.5) * 0.06 * f2;
    // long rain streaks
    albedo *= 0.7 + 0.45 * smoothstep(0.2, 0.8, nsNoise(vec2(m.x * 0.045, m.y * 0.0016)).a);
    // habitation bands: rows of tiny windows + service lights
    vec2 wc = m / vec2(3.0, 4.0); vec2 wcell = floor(wc); vec2 wf = fract(wc);
    float band = step(0.52, nsHash(vec2(floor(wcell.y / 3.0), seed + 3.0))) * step(0.28, nsHash(vec2(floor(wcell.x / 14.0), floor(wcell.y / 9.0)) + seed));
    float wh = nsHash(wcell + seed * 5.1);
    float litR = clamp(pA * mix(0.5, 1.0, night), 0.0, 1.0);
    float wlit = step(wh, litR) * band;
    vec2 wd = min(wf - vec2(0.2, 0.3), vec2(0.8, 0.75) - wf) * vec2(3.0, 4.0);
    float waa = max(px, 0.003);
    float wmask = smoothstep(-waa * 0.6, waa * 0.6, min(wd.x, wd.y));
    float wl = smoothstep(0.25, 1.0, max(fwidth(wc).x, fwidth(wc).y));
    vec3 wcol = nsPalette(pB, nsHash(wcell * 1.3 + 2.0)) * (1.0 + 2.5 * nsHash(wcell + 9.0)) * mix(0.55, 1.0, night);
    albedo = mix(albedo, vec3(0.015), wmask * band * (1.0 - wl) * 0.9);
    rough = mix(rough, 0.08, wmask * band * (1.0 - wl)); metal = mix(metal, 0.0, wmask * band * (1.0 - wl));
    emis = mix(wcol * wmask * wlit, wcol * litR * band * 0.3 * (0.5 + nsHash(floor(wcell / 2.0))), wl);
    // sparse red beacons / work lights along the big seams
    float bc = step(0.965, nsHash(c2 * 3.7 + seed)) * smoothstep(0.6, 0.0, length(fract(m / s2) - 0.5) * 9.0 / (1.0 + px * 6.0));
    emis += vec3(1.0, 0.16, 0.05) * bc * (6.0 + 6.0 * sin(uTime * 2.0 + hB * 40.0)) * step(px, 6.0);
    wetAllow *= 0.3;
  } else if (st == 0 || st == 1 || st == 8 || st == 22) {
    // ------------------------------------------------------------------ plain walls
    int kind = st == 0 ? 0 : (st == 1 ? 1 : (st == 22 ? 3 : 1));
    nsWall(kind, vFUv, base, px, albedo, rough, metal, slope);
    if (st == 8) { // rusted / painted industrial steel
      vec4 n = nsNoise(vFUv * 0.06); vec4 n3 = nsNoise(vFUv * 0.41);
      float rust = smoothstep(0.42, 0.7, n.r * 0.6 + n3.g * 0.4 + (1.0 - vCol.a) * 0.3);
      albedo = mix(albedo, vec3(0.20, 0.075, 0.03) * (0.5 + n3.b), rust * 0.85);
      rough = mix(rough, 0.92, rust); metal = mix(metal, 0.15, rust);
    }
    if ((flags / 4) % 2 == 1) { // hazard stripes
      float hz = step(0.5, fract((vFUv.x + vFUv.y) * 0.7));
      albedo = mix(albedo, mix(vec3(0.02), vec3(0.75, 0.5, 0.02), hz), 0.85);
    }
  } else if (st == 2) {
    // ------------------------------------------------------------------ corrugated sheet / containers
    vec2 m = vFUv; vec4 n = nsNoise(m * 0.05); vec4 n3 = nsNoise(m * 0.33);
    float c = sin(m.x * 20.94);
    float fade = 1.0 - smoothstep(0.03, 0.15, px);
    albedo = base * (0.8 + 0.25 * n.g) * (1.0 + 0.12 * c * fade);
    slope.x += cos(m.x * 20.94) * 0.55 * fade;
    float rust = smoothstep(0.5, 0.78, n.r * 0.55 + n3.g * 0.45);
    albedo = mix(albedo, vec3(0.18, 0.07, 0.03) * (0.5 + n3.b), rust * 0.8);
    rough = mix(0.45, 0.9, rust); metal = mix(0.7, 0.1, rust);
  } else if (st == 3 || st == 9) {
    // ------------------------------------------------------------------ dark glass / mirror panels
    vec2 ps = st == 9 ? vec2(2.0, 2.0) : vec2(1.8, 3.6);
    vec3 sm = nsSeams(vFUv, ps, 0.03, px);
    vec2 pc = floor(vFUv / ps);
    albedo = st == 9 ? vec3(0.85, 0.88, 0.92) : base * 0.3 + 0.01;
    metal = st == 9 ? 1.0 : 0.0; rough = (st == 9 ? 0.03 : 0.05) + 0.1 * nsNoise(vFUv * 0.04).r;
    albedo *= 1.0 - sm.x * 0.8; rough += sm.x * 0.4;
    slope += (vec2(nsHash(pc + 1.0), nsHash(pc + 2.0)) - 0.5) * 0.035 * (1.0 - smoothstep(0.2, 1.0, px));
    wetAllow *= 0.2;
  } else if (st == 4) {
    // ------------------------------------------------------------------ emissive (neon tubes, strips, beacons)
    float inten = vStyle2.w * 0.2;
    float fl = 1.0;
    int mode = flags % 4;
    if (mode == 1) fl = 0.75 + 0.25 * step(0.3, nsHash(vec2(floor(uTime * 13.0), seed))) * step(0.1, sin(uTime * (1.0 + seed * 0.02) + seed));
    else if (mode == 2) fl = smoothstep(0.75, 0.95, sin(uTime * 2.2 + seed * 0.7) * 0.5 + 0.5);
    else if (mode == 3) fl = 0.6 + 0.4 * sin(uTime * 1.3 + seed * 0.3 + vWPos.y * 0.02);
    float nf = (flags / 4) % 2 == 1 ? mix(0.12, 1.0, night) : 1.0;
    if ((flags / 8) % 2 == 1) { float dp = fract(vFUv.x * 0.9 + seed * 0.37); fl *= smoothstep(0.32, 0.2, abs(dp - 0.5)) * (0.6 + 0.4 * nsHash(vec2(floor(vFUv.x * 0.9 + seed * 0.37), seed))); }
    emis = base * inten * fl * nf; albedo = base * 0.08; rough = 0.35; metal = 0.0; wetAllow = 0.0;
  } else if (st == 5 || st == 23) {
    // ------------------------------------------------------------------ signage from atlas (5) / hologram panel (23)
    vec4 tx = texture2D(uSignAtlas, vFUv);
    float inten = vStyle2.w * 0.1;
    float h = nsHash(vec2(seed, 3.0));
    float fl = 1.0;
    if (h > 0.72) fl = 0.55 + 0.45 * step(0.25, nsHash(vec2(floor(uTime * (9.0 + h * 10.0)), seed)));
    if (h < 0.12) fl *= step(0.5, fract(uTime * 0.35 + h * 5.0));
    albedo = tx.rgb * 0.06 + 0.012; rough = 0.25; metal = 0.0;
    emis = tx.rgb * tx.rgb * inten * fl * mix(0.5, 1.0, night);
    if (st == 23) { float scan = 0.75 + 0.25 * sin(vWPos.y * 9.0 - uTime * 6.0); emis *= scan; }
    wetAllow = 0.0;
  } else if (st == 6) {
    // ------------------------------------------------------------------ road (u across in metres, v along)
    vec2 m = vFUv; float width = vStyle2.x; // metres
    vec4 n = nsNoise(vWPos.xz * 0.021); vec4 n3 = nsNoise(vWPos.xz * 0.23);
    albedo = vec3(0.028, 0.029, 0.032) * (0.7 + 0.6 * n.g) * (0.85 + 0.3 * n3.r);
    rough = 0.72 + 0.2 * n3.g;
    // patches + cracks
    float patchM = smoothstep(0.62, 0.66, nsNoise(floor(vWPos.xz / vec2(3.0, 7.0)) * 0.173).b);
    albedo *= 1.0 - 0.3 * patchM;
    float crack = smoothstep(0.022, 0.0, abs(nsNoise(vWPos.xz * 0.06).a - 0.5)) * (1.0 - smoothstep(0.02, 0.1, px));
    albedo *= 1.0 - 0.5 * crack;
    float fadeM = 1.0 - smoothstep(0.08, 0.5, px);
    if (width > 0.5) {
      float lanes = max(2.0, floor(width / 3.6));
      float lu = m.x / width * lanes;
      float ld = abs(fract(lu + 0.5) - 0.5) * width / lanes;
      float edge = min(m.x, width - m.x);
      float inner = step(0.5, lu) * step(lu, lanes - 0.5);
      float dash = step(0.45, fract(m.y / 9.0));
      float isCenter = step(abs(lu - lanes * 0.5), 0.2);
      float mark = (1.0 - smoothstep(0.07, 0.07 + px, ld)) * inner * mix(dash, 1.0, isCenter);
      mark = max(mark, 1.0 - smoothstep(0.08, 0.08 + px, abs(edge - 0.35)));
      float wear = smoothstep(0.25, 0.6, n3.b + n.r * 0.3);
      vec3 mc = mix(vec3(0.55), vec3(0.6, 0.42, 0.06), isCenter);
      albedo = mix(albedo, mc, mark * wear * 0.8 * fadeM);
      // glowing guide studs for hover traffic
      float stud = (1.0 - smoothstep(0.05, 0.09, abs(edge - 0.35))) * step(0.82, fract(m.y / 6.0));
      emis += vec3(0.1, 0.9, 0.8) * stud * 2.5 * fadeM * mix(0.3, 1.0, night);
    }
  } else if (st == 7 || st == 24) {
    // ------------------------------------------------------------------ pavers / tiles
    vec2 ps = st == 7 ? vec2(0.6, 0.6) : vec2(1.2, 1.2);
    vec2 m = vWPos.xz;
    if (abs(wN.y) < 0.7) m = vFUv;
    vec2 pc = floor(m / ps + vec2(step(1.0, mod(floor(m.y / ps.y), 2.0)) * 0.5 * float(st == 7), 0.0));
    float ph = nsHash(pc);
    vec4 n = nsNoise(m * 0.03);
    float f2 = 1.0 - smoothstep(0.03, 0.2, px);
    albedo = base * (0.75 + 0.35 * mix(0.5, ph, f2)) * (0.75 + 0.5 * n.r);
    rough = st == 7 ? 0.8 : 0.28 + 0.2 * ph; metal = 0.0;
    vec3 sm = nsSeams(m + vec2(step(1.0, mod(floor(m.y / ps.y), 2.0)) * 0.5 * ps.x * float(st == 7), 0.0), ps, 0.012, px);
    albedo *= 1.0 - sm.x * 0.55; slope += sm.yz * 0.6;
  } else if (st == 20) {
    // ------------------------------------------------------------------ water
    vec2 m = vWPos.xz;
    float t = uTime * 0.6;
    vec2 w1 = nsNoise(m * 0.021 + vec2(t * 0.011, t * 0.007)).rg - 0.5;
    vec2 w2 = nsNoise(m * 0.083 - vec2(t * 0.019, t * 0.013)).ba - 0.5;
    slope = (w1 * 0.5 + w2 * 0.28) * (0.35 + vStyle2.w * 0.01);
    albedo = base * 0.25; rough = 0.035; metal = 0.0; wetAllow = 0.0;
  } else if (st == 21) {
    // ------------------------------------------------------------------ foliage / moss / lawn
    vec4 n = nsNoise(vWPos.xz * 0.11 + vWPos.y * 0.07); vec4 n3 = nsNoise(vWPos.xz * 0.9 + vWPos.yy * 0.6);
    albedo = base * (0.45 + 0.9 * n.r) * (0.6 + 0.7 * n3.g);
    albedo = mix(albedo, albedo.grb * vec3(1.1, 0.9, 0.5), n.b * 0.35);
    rough = 0.85; metal = 0.0; slope = (n3.rg - 0.5) * 1.6;
    emis = albedo * max(dot(-Vw, uSunDir), 0.0) * 0.0;
  } else if (st == 25) {
    // ------------------------------------------------------------------ fabric / tarp awnings
    vec4 n = nsNoise(vFUv * 0.21);
    float stripe = step(0.5, fract(vFUv.x * 0.9 + seed * 0.13));
    albedo = base * mix(0.55, 1.0, stripe * step(0.5, nsHash(vec2(seed, 1.0)))) * (0.7 + 0.5 * n.r);
    rough = 0.9; slope = (n.gb - 0.5) * 0.8;
    emis = albedo * nsSpill * 0.25;
  } else {
    albedo = base; rough = 0.6;
  }

  // ---------------------------------------------------------------------- weathering common to all
  float up = smoothstep(0.55, 0.95, wN.y);
  if (st != 4 && st != 5 && st != 23 && st != 20) {
    // soot towards the ground on walls, moss in permanently wet places
    float low = (1.0 - up) * exp(-max(vWPos.y, 0.0) / 9.0) * (1.0 - nsIndoor);
    albedo *= 1.0 - 0.45 * low * (0.5 + nsNoise(vWPos.xz * 0.13 + vWPos.y * 0.21).r);
  }
  float wet = uWet * wetAllow;
  if (wet > 0.001) {
    vec4 pn = nsNoise(vWPos.xz * 0.017); vec4 pn2 = nsNoise(vWPos.xz * 0.061 + 0.37);
    float pud = smoothstep(0.50, 0.60, pn.r * 0.62 + pn2.g * 0.38) * up * step(vWPos.y, uCloud.x) * wet;
    float film = wet * mix(0.35, 0.8, up);
    albedo *= mix(1.0, 0.55, film * (1.0 - metal));
    rough = mix(rough, mix(0.3, 0.12, up), film * 0.8);
    rough = mix(rough, 0.025, pud);
    albedo *= mix(1.0, 0.5, pud);
    slope *= 1.0 - pud;
    if (uRain > 0.02 && up > 0.5 && px < 0.03) {
      float e = 0.012;
      vec2 rp1 = vWPos.xz * 6.0; float t1 = uTime * 1.6;
      float rx = nsRipple(rp1 + vec2(e * 6.0, 0.0), t1) - nsRipple(rp1 - vec2(e * 6.0, 0.0), t1);
      float rz = nsRipple(rp1 + vec2(0.0, e * 6.0), t1) - nsRipple(rp1 - vec2(0.0, e * 6.0), t1);
      slope += vec2(rx, -rz) * 0.5 * uRain * mix(0.15, 1.0, pud) * (1.0 - smoothstep(0.008, 0.03, px));
    }
    // vertical streaking on walls
    float vs = (1.0 - up) * wet * smoothstep(0.35, 0.8, nsNoise(vec2(dot(vWPos.xz, T.xz) * 0.35, vWPos.y * 0.012 + uTime * 0.002)).g);
    rough = mix(rough, 0.18, vs * 0.5 * (1.0 - nsIndoor));
  }

  vec3 wN2 = normalize(wN + (T * slope.x + Bt * slope.y));
  normal = normalize((viewMatrix * vec4(wN2, 0.0)).xyz);
  diffuseColor.rgb = albedo;
  roughnessFactor = clamp(rough, 0.02, 1.0);
  metalnessFactor = clamp(metal, 0.0, 1.0);
  totalEmissiveRadiance += emis;
}
`;

// generic (non-facade) surface: only gathers lighting helpers
const FRAG_SURFACE_SIMPLE = /* glsl */ `
{
  vec4 lf = nsLightField(vWPos, 0.0);
  nsOpen = mix(lf.a, 1.0, smoothstep(40.0, 260.0, vWPos.y));
  nsSpill = lf.rgb * exp(-max(vWPos.y - uLightMapInfo.z, 0.0) / uLightMapInfo.w);
  #ifdef NS_PROP_INDOOR
    nsIndoor = uInterior;
  #endif
}
`;

const FRAG_LIGHT_END = /* glsl */ `
{
  // hemisphere ambient (brighter above the cloud deck), neon light-field spill, lightning
  float hiAmb = mix(1.0, 3.2, smoothstep(uCloud.x, uCloud.y, vWPos.y)) * (1.0 - nsIndoor);
  vec3 wNn = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
  vec3 hemi = mix(uAmbGround, uAmbSky, wNn.y * 0.5 + 0.5) * hiAmb * mix(0.35, 1.0, nsOpen);
  float fl = uFlash.w * exp(-dot(vWPos.xz - uFlash.xy, vWPos.xz - uFlash.xy) / (uFlash.z * uFlash.z * 2.0)) * (1.0 - nsIndoor);
  hemi += vec3(0.6, 0.7, 1.0) * fl * (0.5 + 0.5 * wNn.y) * 0.6;
  // overcast sky is brighter towards the sun: gives form under the cloud deck
  vec3 skyDir = normalize(vec3(uTrueSunDir.x, 0.45, uTrueSunDir.z));
  hemi += uSunScatter * 0.85 * max(dot(wNn, skyDir), 0.0) * mix(0.3, 1.0, nsOpen) * (1.0 - nsIndoor) * (1.0 - smoothstep(uCloud.x, uCloud.y, vWPos.y));
  vec3 irr = hemi + nsSpill * (0.55 + 0.45 * (1.0 - abs(wNn.y)));
  reflectedLight.indirectDiffuse += irr * material.diffuseColor;
  // cheap spec response to the neon field on glossy/wet surfaces
  float gl = (1.0 - material.roughness); gl *= gl;
  reflectedLight.indirectSpecular += nsSpill * gl * 0.35 * mix(vec3(0.04), material.diffuseColor + material.specularColor, 0.5);
  reflectedLight.indirectDiffuse *= nsAO;
  reflectedLight.indirectSpecular *= mix(1.0, nsAO, 0.7) * mix(0.55, 1.0, nsOpen);
}
`;

let _lightsBegin = null;
function patchedLightsBegin() {
  if (_lightsBegin) return _lightsBegin;
  let src = THREE.ShaderChunk.lights_fragment_begin;
  const key = 'getDirectionalLightInfo( directionalLight, directLight );';
  if (src.includes(key)) src = src.replace(key, key + '\n\t\tdirectLight.color *= nsSunVis(vWPos.y) * mix(0.3, 1.0, nsOpen) * (1.0 - nsIndoor);');
  else console.warn('[NS] could not patch directional light chunk');
  _lightsBegin = src;
  return src;
}

/**
 * Extend a MeshStandardMaterial with the NEON STRATA world shading.
 * opts.facade: use the attribute driven style system (city geometry)
 */
export function injectNS(material, opts = {}) {
  const facade = !!opts.facade;
  material.defines = material.defines || {};
  if (opts.interior) material.defines.NS_INTERIOR = 1;
  if (opts.propIndoor) material.defines.NS_PROP_INDOOR = 1;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, U);
    shader.uniforms.uSignAtlas = opts.signAtlas || { value: null };
    if (opts.uniforms) Object.assign(shader.uniforms, opts.uniforms);
    const vp = facade ? VERT_PARS : 'varying vec3 vWPos; varying vec3 vWNormal;';
    const vm = facade ? VERT_MAIN : /* glsl */ `
      vec4 nsWP = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        nsWP = instanceMatrix * nsWP;
      #endif
      vWPos = (modelMatrix * nsWP).xyz;
      vWNormal = normalize(mat3(modelMatrix) * objectNormal);`;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + vp + (opts.vertexPars || ''))
      .replace('#include <project_vertex>', (opts.vertexTransform || '') + '\n#include <project_vertex>\n' + vm);
    const fp = facade ? FRAG_PARS : NS_COMMON + /* glsl */ `
      varying vec3 vWPos; varying vec3 vWNormal; uniform float uInterior;
      float nsOpen = 1.0; vec3 nsSpill = vec3(0.0); float nsAO = 1.0; float nsIndoor = 0.0;`;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + fp + (opts.fragmentPars || ''))
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + (facade ? FRAG_SURFACE : FRAG_SURFACE_SIMPLE) + (opts.fragmentSurface || ''))
      .replace('#include <lights_fragment_begin>', patchedLightsBegin())
      .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n' + FRAG_LIGHT_END)
      .replace('#include <fog_fragment>', (opts.fragmentEnd || '') + '\ngl_FragColor.rgb = nsApplyFog(gl_FragColor.rgb, cameraPosition, vWPos);');
  };
  material.customProgramCacheKey = () => 'ns' + (facade ? 'F' : 'S') + (opts.interior ? 'I' : '') + (opts.key || '');
  return material;
}

export function createCityMaterial(quality, signAtlasUniform) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, metalness: 0, envMapIntensity: 1 });
  injectNS(m, { facade: true, interior: !!quality.interiorMap, signAtlas: signAtlasUniform });
  return m;
}

// unlit additive material for light cones, holograms, beams (with fog attenuation + soft fade)
export function createGlowMaterial(opts = {}) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: opts.side ?? THREE.DoubleSide, fog: false,
    uniforms: { ...U, uColor: { value: new THREE.Color(opts.color ?? 0xffffff) }, uIntensity: { value: opts.intensity ?? 1 }, uSignAtlas: { value: null } },
    vertexShader: /* glsl */ `
      attribute vec4 aColor; attribute vec4 aGlow;
      varying vec3 vWPos; varying vec3 vN; varying vec2 vUv2; varying vec4 vCol; varying vec4 vGlow;
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWPos = wp.xyz; vN = normalize(mat3(modelMatrix) * normal); vUv2 = uv; vCol = aColor; vGlow = aGlow;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      ${NS_COMMON}
      uniform vec3 uColor; uniform float uIntensity; uniform sampler2D uSignAtlas;
      varying vec3 vWPos; varying vec3 vN; varying vec2 vUv2; varying vec4 vCol; varying vec4 vGlow;
      void main(){
        // vGlow: x = mode (0 cone/beam, 1 hologram sheet, 2 soft blob), y = intensity, z = seed, w = night-only
        vec3 V = normalize(cameraPosition - vWPos);
        float mode = floor(vGlow.x + 0.5);
        float a = 1.0;
        vec3 c = vCol.rgb * vCol.rgb;
        if (mode < 0.5) { // light cone: uv.y 0 at source → 1 at end; fresnel-soft edges
          float edge = pow(abs(dot(normalize(vN), V)), 1.6);
          float n = nsNoise(vec2(vUv2.x * 0.35 + uTime * 0.01, vUv2.y * 0.5 - uTime * 0.03)).r;
          a = edge * pow(1.0 - clamp(vUv2.y, 0.0, 1.0), 1.7) * (0.55 + 0.9 * n);
        } else if (mode < 1.5) { // hologram sheet
          float scan = 0.7 + 0.3 * sin(vWPos.y * 2.2 - uTime * 3.0 + vGlow.z);
          float gl = step(0.985, nsHash(vec2(floor(vWPos.y * 0.6), floor(uTime * 9.0)))) ;
          a = vCol.a * scan * (1.0 - gl * 0.6);
        } else if (mode < 2.5) { float d = length(vUv2 - 0.5) * 2.0; a = smoothstep(1.0, 0.0, d); a *= a; }
        else { // atlas hologram: translucent projected signage
          vec4 tx = texture2D(uSignAtlas, vUv2);
          c *= tx.rgb * tx.rgb;
          float scan = 0.72 + 0.28 * sin(vWPos.y * 3.0 - uTime * 4.0 + vGlow.z);
          float gl = step(0.975, nsHash(vec2(floor(vWPos.y * 0.35 + vGlow.z), floor(uTime * 8.0))));
          a = vCol.a * scan * (1.0 - gl * 0.7);
        }
        float nf = mix(1.0, mix(0.12, 1.0, uNight), vGlow.w);
        vec3 col = c * uColor * a * vGlow.y * uIntensity * nf;
        float T = exp(-nsFogOD(cameraPosition, vWPos));
        gl_FragColor = vec4(col * T, 1.0);
      }`,
  });
}
