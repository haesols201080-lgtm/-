// The city surface shader (v2): MeshStandardMaterial extended with an attribute-driven style system.
// Surfaces are textured from the baked PBR material arrays (render/materials.js) in world metres;
// windows are real recessed openings (parallax jambs) with interior-mapped rooms, curtains, blinds,
// frames and per-room lamps. Also: neon light-field irradiance, cloud-deck sun occlusion, height fog.
import * as THREE from 'three';
import { U, NS_COMMON } from './env.js';

export const ST = {
  CONCRETE: 0, METAL: 1, CORRUGATED: 2, DARKGLASS: 3, EMISSIVE: 4, SIGN: 5, ROAD: 6, PAVE: 7, RUST: 8, MIRROR: 9,
  WIN_RES: 10, WIN_OFFICE: 11, WIN_RIBBON: 12, WIN_SLIT: 13, WIN_CAPSULE: 14, MEGAHULL: 15, WIN_SHANTY: 16, WIN_LUX: 17,
  WIN_GROW: 18, WIN_INDUSTRIAL: 19, WATER: 20, FOLIAGE: 21, STONE: 22, HOLO: 23, TILE: 24, FABRIC: 25, PLASTER: 26,
  COMPOSITE: 27, LOUVER: 28, SCREEN: 29,
  // legacy aliases
  WIN_PUNCH: 10, WIN_CURTAIN: 11, WIN_HIVE: 14, SHANTY: 16, LUXURY: 17, GROW: 18,
};
// wall finish behind / around windows (flags & 7)
export const WK = { CONCRETE: 0, METAL: 1, PLASTER: 2, COMPOSITE: 3, STONE: 4, RIBBED: 5, RUST: 6, PAVERS: 7 };
export const FLAG = { INDOOR: 8, VAR_A: 16, VAR_B: 32 };
export const PAL = { WARM: 0, NEUTRAL: 1, COOL: 2, TEAL: 3, MAGENTA: 4, AMBER: 5, MIXED: 6, RED: 7, GREEN: 8, VIOLET: 9, GOLD: 10 };

const VERT_PARS = /* glsl */ `
attribute vec4 aColor; attribute vec4 aStyle; attribute vec4 aStyle2;
flat varying vec4 vStyle; flat varying vec4 vStyle2;
varying vec3 vWPos; varying vec3 vWNormal; varying vec2 vFUv; varying vec4 vCol;
`;
const VERT_MAIN = /* glsl */ `
vec4 nsWP = vec4(transformed, 1.0); vec3 nsWN = objectNormal;
#ifdef USE_INSTANCING
  nsWP = instanceMatrix * nsWP; nsWN = mat3(instanceMatrix) * nsWN;
#endif
vWPos = (modelMatrix * nsWP).xyz;
vWNormal = normalize(mat3(modelMatrix) * nsWN);
vFUv = uv; vCol = aColor; vStyle = aStyle; vStyle2 = aStyle2;
#ifdef USE_INSTANCING_COLOR
  vCol.rgb *= instanceColor.rgb;
#endif
`;

const FRAG_PARS = /* glsl */ `
${NS_COMMON}
flat varying vec4 vStyle; flat varying vec4 vStyle2;
varying vec3 vWPos; varying vec3 vWNormal; varying vec2 vFUv; varying vec4 vCol;
uniform sampler2D uSignAtlas; uniform float uInterior;
uniform sampler2DArray uMatA; uniform sampler2DArray uMatB;
float nsOpen = 1.0; vec3 nsSpill = vec3(0.0); float nsAO = 1.0; float nsIndoor = 0.0;

struct NsM { vec3 alb; float h; vec2 n; float rough; float cav; };
NsM nsMat(float layer, vec2 uv){
  vec4 a = texture(uMatA, vec3(uv, layer)); vec4 b = texture(uMatB, vec3(uv, layer));
  NsM m; m.alb = a.rgb * a.rgb * 4.0; m.h = a.a; m.n = b.rg * 2.0 - 1.0; m.rough = b.b; m.cav = b.a; return m;
}
vec3 nsGrunge(vec2 uv){ vec3 c = texture(uMatA, vec3(uv, 8.0)).rgb; return c * c * 4.0; }

vec3 nsPalette(float idx, float h){
  int i = int(idx + 0.5);
  if (i == 6) i = h < 0.5 ? 0 : (h < 0.76 ? 1 : (h < 0.9 ? 2 : (h < 0.95 ? 5 : (h < 0.98 ? 3 : 4))));
  if (i == 0) return vec3(1.0, 0.63, 0.33);
  if (i == 1) return vec3(1.0, 0.84, 0.64);
  if (i == 2) return vec3(0.66, 0.82, 1.0);
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
// textured wall finish. kind: 0 concrete, 1 metal panels, 2 plaster, 3 composite, 4 ashlar, 5 ribbed, 6 rusted steel, 7 pavers
void nsWall(int kind, vec2 m, vec3 base, float px, float seed, inout vec3 albedo, inout float rough, inout float metal, inout vec2 slope, inout float cav){
  vec2 so = vec2(seed * 0.173, seed * 0.091);
  vec3 g = nsGrunge(m * 0.06 + so);
  float macro = nsNoise(m * 0.004 + so).r;
  float nf = 1.0 - smoothstep(0.08, 0.6, px);
  NsM t;
  if (kind == 0) {
    t = nsMat(0.0, m * 0.25 + so); albedo = base * t.alb * (0.82 + 0.36 * macro); rough = t.rough; metal = 0.0; slope += t.n * 1.3 * nf; cav *= t.cav;
    vec3 sm = nsSeams(m, vec2(7.2, 3.6), 0.02, px); albedo *= 1.0 - sm.x * 0.3; slope += sm.yz * 0.5;
  } else if (kind == 1) {
    vec2 ps = vec2(1.5, 3.0); vec2 pc = floor(m / ps); float ph = nsHash(pc + seed);
    t = nsMat(2.0, m / 3.0 + ph * 3.7); albedo = base * t.alb * (0.82 + 0.3 * ph) * (0.85 + 0.3 * macro); rough = clamp(t.rough * (0.75 + 0.6 * ph), 0.05, 1.0); metal = 0.92; slope += t.n * 0.7 * nf; cav *= t.cav;
    vec3 sm = nsSeams(m, ps, 0.025, px); albedo *= 1.0 - sm.x * 0.6; cav *= 1.0 - sm.x * 0.5;
    slope += sm.yz * 0.9 + (vec2(nsHash(pc + 1.0), nsHash(pc + 2.0)) - 0.5) * 0.045 * (1.0 - smoothstep(0.2, 1.0, px));
  } else if (kind == 2) {
    t = nsMat(1.0, m * 0.25 + so);
    vec2 pc = floor(m / vec2(6.4, 3.2) + nsNoise(m * 0.01).rg * 0.5); float ph = nsHash(pc + seed);
    albedo = base * t.alb * (0.8 + 0.3 * macro) * mix(1.0, 0.78 + 0.4 * ph, 0.45); rough = t.rough; metal = 0.0; slope += t.n * nf; cav *= t.cav;
  } else if (kind == 3) {
    vec2 ps = vec2(2.4, 1.2); vec2 pc = floor(m / ps); float ph = nsHash(pc + seed + 9.1);
    t = nsMat(6.0, m * 0.5 + ph); albedo = base * t.alb * (0.85 + 0.25 * ph); rough = clamp(t.rough + 0.15 * (ph - 0.5), 0.05, 1.0); metal = 0.35; slope += t.n * 0.6 * nf; cav *= t.cav;
    vec3 sm = nsSeams(m, ps, 0.018, px); albedo *= 1.0 - sm.x * 0.65; slope += sm.yz * 0.8;
  } else if (kind == 4) {
    t = nsMat(11.0, m / 3.0 + so); albedo = base * t.alb * (0.85 + 0.3 * macro); rough = t.rough; metal = 0.0; slope += t.n * 1.6 * nf; cav *= t.cav;
  } else if (kind == 5) {
    t = nsMat(5.0, m * 0.5 + so); albedo = base * t.alb * (0.85 + 0.3 * macro); rough = t.rough; metal = 0.75; slope += t.n * 1.8 * nf; cav *= t.cav;
  } else if (kind == 6) {
    t = nsMat(3.0, m / 3.0 + so); albedo = t.alb * mix(vec3(0.53), base, t.cav) * (0.85 + 0.3 * macro); rough = t.rough; metal = t.cav * 0.6; slope += t.n * 1.2 * nf;
  } else {
    t = nsMat(7.0, m / 2.4 + so); albedo = base * t.alb; rough = t.rough; metal = 0.0; slope += t.n * 1.5 * nf; cav *= t.cav;
  }
  albedo *= mix(1.0, 0.5, g.r * 0.7) * (0.78 + 0.35 * g.g);
  rough = clamp(rough + g.r * 0.15 - g.b * 0.2 * metal, 0.04, 1.0);
}
float nsBoxD(vec2 p, vec2 a, vec2 b, float r){ // signed distance (positive inside) to a rounded rect a..b
  vec2 q = abs(p - (a + b) * 0.5) - (b - a) * 0.5 + r;
  return -(length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r);
}
#ifdef NS_INTERIOR
// Fake room behind the glass. p: entry point (metres, room box origin bottom-left on the glass plane),
// vt: tangent space view dir (z<0 into the wall), rs: room width/height, dep: depth.
vec3 nsRoom(vec2 p, vec3 vt, vec2 rs, float dep, float h1, float h2, float office){
  vec3 rd = vec3(vt.x, vt.y, max(-vt.z, 0.03));
  rd.x = abs(rd.x) < 1e-4 ? 1e-4 : rd.x; rd.y = abs(rd.y) < 1e-4 ? 1e-4 : rd.y;
  vec3 ro = vec3(clamp(p, vec2(0.01), rs - 0.01), 0.0);
  vec3 inv = 1.0 / rd;
  vec3 tm = max((vec3(0.0) - ro) * inv, (vec3(rs, dep) - ro) * inv);
  float t = min(tm.x, min(tm.y, tm.z));
  vec3 hit = ro + rd * t;
  vec3 lampP = vec3(rs.x * (0.3 + 0.4 * h1), rs.y - 0.3, dep * (0.35 + 0.3 * h2));
  vec3 wallTint = mix(vec3(0.85, 0.8, 0.72), mix(vec3(0.6, 0.72, 0.7), vec3(0.8, 0.66, 0.55), h2), step(0.5, h1) * 0.8);
  vec3 col; float em = 0.0;
  if (tm.z <= tm.x && tm.z <= tm.y) { // back wall: furniture silhouettes, picture
    col = wallTint * mix(0.55, 0.3, office);
    float sx = hit.x / rs.x * (3.0 + office * 5.0); float si = floor(sx); float sf = fract(sx);
    float fh = (0.25 + 0.5 * nsHash(vec2(si, h1 * 37.0))) * rs.y * step(0.25, nsHash(vec2(si + 5.0, h2 * 11.0)));
    float furn = step(hit.y, fh) * step(0.08, sf) * step(sf, 0.92);
    col = mix(col, vec3(0.12, 0.09, 0.07) + 0.1 * nsHash(vec2(si, h2)), furn);
    vec2 pc = (hit.xy - vec2(rs.x * (0.25 + 0.5 * h2), rs.y * 0.62)) / vec2(0.5, 0.32);
    col = mix(col, vec3(0.25, 0.3, 0.35), step(abs(pc.x), 1.0) * step(abs(pc.y), 1.0) * step(0.55, h1) * 0.7);
  } else if (tm.y < tm.x) {
    if (rd.y > 0.0) { // ceiling + fixtures
      col = vec3(0.7);
      if (office > 0.5) { vec2 g = fract(vec2(hit.x / 2.4, hit.z / 1.8)); em = step(0.25, g.x) * step(g.x, 0.75) * step(0.42, g.y) * step(g.y, 0.58) * 6.0; }
      else em = smoothstep(0.3, 0.2, length(hit.xz - lampP.xz)) * 5.0;
    } else { col = mix(vec3(0.16, 0.11, 0.07), vec3(0.2, 0.2, 0.22), office); col *= 0.8 + 0.2 * step(0.04, fract(hit.x * 2.2)); }
  } else col = wallTint * 0.5;
  vec3 dl = hit - lampP;
  float I = office > 0.5 ? 0.36 : 1.7 / (1.0 + dot(dl, dl) * 0.35);
  if (office > 0.5) { // desks + partitions as dark bands near the floor, columns at intervals
    float desk = step(hit.y, 1.15) * step(0.25, fract(hit.z * 0.45 + h1)) * step(tm.z, 1e8);
    col = mix(col, vec3(0.08, 0.085, 0.1), desk * 0.6 * step(hit.y, 1.15) * float(tm.z > tm.x || tm.z > tm.y ? 0.0 : 1.0));
    col *= 0.85 + 0.15 * step(0.1, fract(hit.x / 7.2));
  }
  return col * I + vec3(em);
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
  int wk = flags % 8;
  nsIndoor = float((flags / 8) % 2);
  bool varA = (flags / 16) % 2 == 1; bool varB = (flags / 32) % 2 == 1;
  vec3 wN = normalize(vWNormal) * faceDirection;
  vec3 T; vec3 Bt;
  if (abs(wN.y) < 0.96) { T = normalize(cross(vec3(0.0, 1.0, 0.0), wN)); Bt = cross(wN, T); } else { T = vec3(1.0, 0.0, 0.0); Bt = vec3(0.0, 0.0, -1.0); }
  vec3 base = vCol.rgb * vCol.rgb;
  float px = max(length(dFdx(vWPos)), length(dFdy(vWPos)));
  vec3 Vw = normalize(cameraPosition - vWPos);
  vec3 albedo = base; float rough = 0.7; float metal = 0.0; vec3 emis = vec3(0.0); vec2 slope = vec2(0.0); float cav = 1.0;
  float wetAllow = 1.0 - nsIndoor;
  vec4 lf = nsLightField(vWPos, 0.0);
  nsOpen = mix(lf.a, 1.0, smoothstep(40.0, 260.0, vWPos.y));
  nsSpill = lf.rgb * exp(-max(vWPos.y - uLightMapInfo.z, 0.0) / uLightMapInfo.w) * (1.0 - nsIndoor);
  nsAO = vCol.a;
  float night = uNight;
  vec2 hm = abs(wN.y) > 0.7 ? vWPos.xz : vFUv; // metres on the surface

  if (st >= 10 && st <= 19 && st != 15) {
    // ================================================================== windowed facades
    vec2 cs = max(vStyle2.xy * 0.1, vec2(0.6));
    vec2 uvc = vFUv; vec2 cell = floor(uvc); vec2 f = fract(uvc);
    vec2 fm = f * cs; vec2 m = uvc * cs;
    float h1 = nsHash(cell + seed * 7.31); float h2 = nsHash(cell * 1.73 + seed * 3.17 + 11.0); float h3 = nsHash(cell.yx * 2.31 + seed + 5.0);
    float hb = nsHash(vec2(seed, 17.0)); float hFloor = nsHash(vec2(cell.y * 3.1, seed));
    // opening geometry (metres within the bay)
    vec2 o0 = vec2(0.7, 0.95); vec2 o1 = cs - vec2(0.7, 0.6); float D = 0.2; float fw = 0.055; vec2 pd = vec2(2.0, 1.0); float rnd = 0.0; float hasWin = 1.0;
    float office = 0.0; float roomSpan = 1.0; float litBoost = 1.0; float glassRough = 0.07; vec3 glassTint = vec3(0.018, 0.02, 0.024);
    if (st == 10) {
      float ww = min(cs.x - 0.9, mix(1.25, 1.85, hb)); float wh = min(cs.y - 1.35, mix(1.3, 1.55, hb));
      o0 = vec2((cs.x - ww) * 0.5, 0.95); o1 = o0 + vec2(ww, wh);
      if (varA) { o0 = vec2(0.3, 0.14); o1 = vec2(cs.x - 0.3, cs.y - 0.5); pd = vec2(3.0, 1.0); D = 1.0; }
    } else if (st == 11) { o0 = vec2(0.03, 1.0); o1 = vec2(cs.x - 0.03, cs.y - 0.06); D = 0.07; fw = 0.035; pd = vec2(1.0); office = 1.0; roomSpan = 8.0; glassTint = mix(base, vec3(dot(base, vec3(0.333))), 0.5) * 0.1 + 0.008; glassRough = 0.04; }
    else if (st == 12) { o0 = vec2(-0.3, 1.0); o1 = vec2(cs.x + 0.3, cs.y - 0.8); D = 0.16; pd = vec2(1.0); office = 1.0; roomSpan = 6.0; }
    else if (st == 13) { float ww = 0.5; o0 = vec2((cs.x - ww) * 0.5, 0.5); o1 = vec2(o0.x + ww, cs.y - 0.5); D = 0.6; pd = vec2(1.0); fw = 0.03; }
    else if (st == 14) { float ww = min(cs.x, cs.y) * 0.52; o0 = cs * 0.5 - ww * 0.5 + vec2(0.0, 0.06); o1 = o0 + ww; rnd = ww * 0.3; D = 0.28; pd = vec2(1.0); fw = 0.07; }
    else if (st == 16) { hasWin = step(h3, 0.5); float ww = mix(0.7, 1.4, h1); float wh = mix(0.6, 1.15, h2); o0 = vec2(mix(0.3, max(0.3, cs.x - ww - 0.3), h2), mix(0.95, max(0.95, cs.y - wh - 0.45), h1)); o1 = o0 + vec2(ww, wh); D = 0.1; pd = vec2(1.0 + step(0.5, h2), 1.0); }
    else if (st == 17) { o0 = vec2(0.12, 0.1); o1 = vec2(cs.x - 0.12, cs.y - 0.42); D = 0.3; fw = 0.04; pd = vec2(2.0, 1.0); glassRough = 0.03; }
    else if (st == 18) { o0 = vec2(0.08, 0.2); o1 = cs - vec2(0.08, 0.15); D = 0.1; pd = vec2(3.0, 2.0); fw = 0.04; litBoost = 1.6; }
    else { o0 = vec2(0.4, 1.1); o1 = cs - vec2(0.4, 0.5); D = 0.14; pd = max(vec2(1.0), floor((o1 - o0) / vec2(0.55, 0.62))); fw = 0.028; }

    float fwc = max(fwidth(uvc).x, fwidth(uvc).y);
    float lod = smoothstep(0.22, 0.8, fwc);
    float aa = max(px * 0.7, 0.003);
    // wall finish
    nsWall(wk, m, base, px, seed, albedo, rough, metal, slope, cav);
    vec3 wallAlb = albedo; float wallRough = rough; float wallMetal = metal;
    vec3 gr = nsGrunge(m * 0.11 + seed * 0.07);

    // floor slab line + bay joints (panelised construction)
    float slab = 1.0 - smoothstep(0.0, 0.03 + aa, min(fm.y, cs.y - fm.y));
    albedo *= 1.0 - 0.3 * slab * (1.0 - lod); slope.y += slab * sign(fm.y - cs.y * 0.5) * 0.5 * (1.0 - lod);
    if (st == 14) { // capsule pods: every bay is its own module with a shadow gap
      float gap = 1.0 - smoothstep(0.05, 0.09 + aa, min(min(fm.x, cs.x - fm.x), min(fm.y, cs.y - fm.y)));
      float tone = 0.72 + 0.5 * h1; albedo *= tone * (1.0 - 0.85 * gap); cav *= 1.0 - 0.8 * gap; rough = mix(rough, 0.9, gap);
      vec2 e2 = min(fm, cs - fm); slope += (1.0 - smoothstep(vec2(0.09), vec2(0.2), e2)) * sign(fm - cs * 0.5) * 0.9 * (1.0 - lod);
    }
    if (st == 16) { // shanty patchwork sheets
      vec2 pc = floor(m / vec2(1.9, 2.3) + nsNoise(m * 0.02).rg * 0.8); float ph = nsHash(pc + seed);
      vec3 tint = mix(vec3(0.72, 0.66, 0.6), nsPalette(floor(ph * 9.99), ph) * 0.3 + 0.38, step(0.72, ph) * 0.5);
      albedo *= tint * 1.15; rough = mix(rough, 0.5, step(0.72, ph) * 0.5);
    }
    if (st == 11 || st == 12) { // spandrel / mullion caps for curtain walls
      float mull = 1.0 - smoothstep(0.03, 0.03 + aa, min(fm.x, cs.x - fm.x));
      if (st == 11) { albedo = mix(mix(base, vec3(dot(base, vec3(0.333))), 0.55) * 0.16 + 0.01, vec3(0.55, 0.57, 0.6) * 0.5, mull); rough = mix(0.16 + 0.2 * gr.g, 0.35, mull); metal = mix(0.0, 0.9, mull); slope = slope * 0.2 + vec2(mull * sign(fm.x - cs.x * 0.5) * 0.8, 0.0) * (1.0 - lod); }
    }

    // ---- opening + recess parallax
    float dOut = nsBoxD(fm, o0, o1, rnd);
    float open = smoothstep(-aa, aa, dOut) * hasWin;
    vec3 vt = vec3(dot(-Vw, T), dot(-Vw, Bt), dot(-Vw, wN));
    vec2 shift = vt.xy / max(-vt.z, 0.14) * D * (1.0 - lod);
    vec2 fg = fm + shift;
    float dIn = nsBoxD(fg, o0, o1, rnd);
    float glassHit = smoothstep(-aa, aa, dIn);
    // sill, lintel shading + grime under the sill
    float inX = smoothstep(o0.x - 0.12, o0.x, fm.x) * smoothstep(o1.x + 0.12, o1.x, fm.x) * hasWin * (1.0 - office);
    float under = inX * smoothstep(o0.y - 0.75, o0.y - 0.02, fm.y) * step(fm.y, o0.y);
    albedo *= 1.0 - under * (0.2 + 0.45 * gr.r) * (1.0 - lod);
    float sill = inX * (1.0 - smoothstep(0.0, 0.07, abs(fm.y - (o0.y - 0.04)))) * step(rnd, 0.001);
    albedo = mix(albedo, wallAlb * 1.25 + 0.02, sill * 0.5 * (1.0 - lod)); slope.y -= sill * 0.9 * (1.0 - lod);
    float lintelSh = inX * smoothstep(o1.y + 0.5, o1.y, fm.y) * step(o1.y, fm.y);
    cav *= 1.0 - 0.18 * lintelSh;

    // residential extras: wall AC units, balcony rails
    if (st == 10 && lod < 0.9) {
      if (!varA && h2 > 0.68 && cs.x > 2.4) { // split AC outdoor unit under the window
        vec2 a0 = vec2(cs.x * 0.5 - 0.42 + (h1 - 0.5) * 0.5, 0.18); vec2 a1 = a0 + vec2(0.84, 0.58);
        float ad = nsBoxD(fm, a0, a1, 0.03); float ac = smoothstep(-aa, aa, ad);
        vec2 au = (fm - a0) / (a1 - a0);
        float fan = smoothstep(0.34, 0.3, length((au - vec2(0.36, 0.5)) * vec2(1.45, 1.0)));
        float vents = step(0.5, fract(au.y * 9.0)) * step(0.72, au.x);
        vec3 acc = vec3(0.5, 0.5, 0.48) * (0.75 + 0.25 * gr.g) * (1.0 - 0.75 * fan * (0.6 + 0.4 * step(0.5, fract(atan(au.y - 0.5, au.x - 0.36) * 1.9)))) * (1.0 - 0.4 * vents);
        albedo = mix(albedo, acc, ac); rough = mix(rough, 0.55, ac); metal = mix(metal, 0.5, ac);
        float sh = smoothstep(a0.y - 0.35, a0.y, fm.y) * step(fm.y, a0.y) * smoothstep(a0.x - 0.05, a0.x + 0.1, fm.x) * smoothstep(a1.x + 0.05, a1.x - 0.1, fm.x);
        albedo *= 1.0 - 0.45 * sh; slope += vec2(0.0, -0.6) * ac * step(ad, 0.04);
      }
    }

    float litRatio = clamp(pA * mix(0.4, 1.0, night), 0.0, 1.0);
    float litRnd = office > 0.5 ? mix(h1, hFloor, 0.7) : mix(h1, nsHash(floor(cell / vec2(2.0, 1.0)) + seed), 0.25);
    float lit = step(litRnd, litRatio);
    vec3 lc = nsPalette(pB, h2);
    if (st == 18) { lc = mix(vec3(1.0, 0.12, 0.75), vec3(0.72, 0.2, 1.0), h2); lit = step(h1, 0.9); }
    if (st == 19 && h3 > 0.75) lc = vec3(1.0, 0.28, 0.05);
    float tv = step(0.9, h3) * lit * (1.0 - office);
    float roomB = 0.3 + 0.7 * nsHash(cell * 0.71 + seed * 1.9 + 3.0);
    float inten = (0.9 + 1.4 * h2) * roomB * litBoost * mix(0.5, 1.0, night);
    if (tv > 0.5) { lc = mix(lc, vec3(0.35, 0.6, 1.0), 0.75); inten *= 0.45 + 0.4 * nsHash(vec2(floor(uTime * 6.0 + h2 * 9.0), h1)); }

    vec2 area = clamp(o1 - o0, vec2(0.0), cs) / cs;
    float areaF = area.x * area.y * hasWin * (st == 16 ? 0.5 : 1.0);

    if (open > 0.001 && lod < 0.999) {
      // jamb (reveal) colour: shadowed wall; soffit darker, sill lighter
      float soff = step(o1.y, fg.y), sillT = step(fg.y, o0.y);
      vec3 jamb = wallAlb * (0.5 - 0.22 * soff + 0.25 * sillT);
      // --- glass plane content
      vec2 gu = (fg - o0) / max(o1 - o0, vec2(1e-3)); // 0..1 across the glazing
      vec2 pu = gu * pd; vec2 pf = fract(pu);
      vec2 pdist = min(pf, 1.0 - pf) * (o1 - o0) / pd;
      float frame = 1.0 - smoothstep(fw * 0.5, fw * 0.5 + aa, min(pdist.x, pdist.y));
      frame = max(frame, 1.0 - smoothstep(fw, fw + aa, dIn));
      if (st == 12) { float bx = fract(fg.x / cs.x); frame = max(frame, 1.0 - smoothstep(0.03, 0.03 + aa, min(bx, 1.0 - bx) * cs.x)); }
      vec3 frameCol = st == 17 ? vec3(0.5, 0.36, 0.18) : mix(vec3(0.05), vec3(0.55), step(0.6, hb) * (1.0 - office));
      // curtains / blinds state for this room
      float cst = nsHash(cell * 0.37 + seed * 0.61 + 1.7);
      float side = (cst > 0.3 && cst < 0.56) ? smoothstep(0.24 + 0.2 * h2, 0.2 + 0.2 * h2, min(gu.x, 1.0 - gu.x)) : 0.0;
      float sheer = (cst >= 0.56 && cst < 0.74) ? 1.0 : 0.0;
      float blind = (cst >= 0.74 && cst < 0.9) ? step(gu.y, 1.0) * step(1.0 - (0.35 + 0.65 * h3), gu.y) : 0.0;
      float black = cst >= 0.9 ? 1.0 : 0.0;
      if (office > 0.5 || st == 18 || st == 19 || st == 13) { side = 0.0; sheer = 0.0; black = 0.0; blind *= step(0.8, cst) * office; }
      float folds = 0.75 + 0.25 * sin(gu.x * (o1.x - o0.x) * 34.0 + h1 * 6.0);
      float slats = 0.55 + 0.45 * step(0.35, fract(gu.y * (o1.y - o0.y) * 22.0));
      vec3 cloth = mix(vec3(0.75, 0.7, 0.62), nsPalette(floor(h3 * 9.99), h1) * 0.45 + 0.3, step(0.6, h2) * 0.6);
      // interior
      vec3 room = vec3(0.0); vec3 inner = vec3(0.012, 0.013, 0.016);
      #ifdef NS_INTERIOR
        float rs = roomSpan; float ri = floor(cell.x / rs);
        vec2 rp = vec2((cell.x - ri * rs) * cs.x + fg.x, fg.y - 0.02);
        float rh1 = nsHash(vec2(ri, cell.y) + seed * 7.31), rh2 = nsHash(vec2(ri, cell.y) * 1.73 + seed * 3.17 + 11.0);
        vec3 rc = nsRoom(rp, vt, vec2(cs.x * rs, cs.y - 0.3), mix(3.2, 5.5, rh2) * (1.0 + office * 2.0), rh1, rh2, office);
        if (st == 18) { float rack = smoothstep(0.12, 0.0, abs(fract(fg.y * 2.2 + rc.r) - 0.5) - 0.28); rc = mix(vec3(0.08, 0.4, 0.1), vec3(1.4), rack); }
        // occasional silhouette of someone at the window
        float person = step(0.93, h1) * (1.0 - office);
        vec2 pp = (fg - vec2(mix(o0.x, o1.x, 0.3 + 0.4 * h3), o0.y)) / vec2(0.26, 0.95);
        float sil = person * smoothstep(1.0, 0.85, length(vec2(pp.x, max(pp.y - 0.55, 0.0) * 1.9)) + step(pp.y, 0.0) * 9.0) ;
        rc *= 1.0 - 0.9 * sil;
        room = rc * mix(lc, vec3(1.0, 0.92, 0.82), 0.3) * inten * lit;
        inner += rc * 0.006 * (1.0 - 0.5 * night);
      #else
        room = lc * inten * 0.45 * lit;
      #endif
      float cover = max(max(side, sheer), max(blind, black));
      vec3 coverAlb = mix(cloth * folds, vec3(0.6, 0.6, 0.58) * slats, blind); coverAlb = mix(coverAlb, vec3(0.03), black);
      vec3 coverEm = (mix(cloth * folds * 0.5, vec3(0.7, 0.68, 0.6) * slats * 0.35, blind) * (1.0 - black) + black * 0.02) * lc * inten * lit * (0.55 + 0.45 * sheer);
      vec3 gAlb = mix(glassTint + inner, coverAlb * 0.12, cover);
      vec3 gEm = mix(room, coverEm, cover);
      float dirt = gr.g * 0.5 + gr.b * 0.5;
      float gR = glassRough + 0.22 * dirt * dirt;
      // frames on top
      gAlb = mix(gAlb, frameCol, frame); gEm *= 1.0 - frame; gR = mix(gR, 0.4, frame); float gM = frame * 0.7;
      // balcony rail in front of the recess (wall plane)
      float rail = 0.0;
      if (st == 10 && varA) { float bars = 1.0 - smoothstep(0.012, 0.012 + aa, abs(fract(fm.x / 0.11) - 0.5) * 0.11); float top = 1.0 - smoothstep(0.025, 0.025 + aa, abs(fm.y - 1.15)); rail = max(bars * step(fm.y, 1.15), top) * step(o0.x, fm.x) * step(fm.x, o1.x) * step(o0.y, fm.y); }
      if (st == 17) { float gl = step(fm.y, 1.1) * step(o0.y, fm.y); rail = max(rail, (1.0 - smoothstep(0.02, 0.02 + aa, abs(fm.y - 1.1))) * 0.9); gR = mix(gR, 0.03, gl * 0.0); }
      // compose opening
      vec3 oAlb = mix(jamb, gAlb, glassHit); float oR = mix(0.85, gR, glassHit); float oM = mix(0.0, gM, glassHit); vec3 oEm = gEm * glassHit;
      // light spilling onto the jambs from a lit room
      oEm += jamb * lc * inten * lit * 0.35 * (1.0 - glassHit) * (1.0 - cover * 0.6);
      oAlb = mix(oAlb, vec3(0.04), rail); oEm *= 1.0 - rail; oR = mix(oR, 0.4, rail); oM = mix(oM, 0.8, rail);
      float k = open * (1.0 - lod);
      albedo = mix(albedo, oAlb, k); rough = mix(rough, oR, k); metal = mix(metal, oM, k); emis = oEm * k; slope *= 1.0 - k; cav = mix(cav, mix(0.55, 1.0, glassHit), k);
    }
    // far LOD: converge to the statistical look
    vec3 avgEmis = lc * 0.75 * litBoost * mix(0.5, 1.0, night) * litRatio * areaF * (0.35 + 1.3 * nsHash(floor(cell / 3.0) + seed)) * (office > 0.5 ? 0.8 : 0.55);
    albedo = mix(albedo, mix(wallAlb, glassTint + 0.01, areaF), lod);
    rough = mix(rough, mix(wallRough, 0.15, areaF), lod); metal = mix(metal, wallMetal * (1.0 - areaF), lod);
    emis = mix(emis, avgEmis, lod);
    if (st == 17) { float trim = (1.0 - smoothstep(0.03, 0.045, abs(fm.y - 0.05))) * (1.0 - lod); albedo = mix(albedo, vec3(1.0, 0.72, 0.3), trim); metal = mix(metal, 1.0, trim); rough = mix(rough, 0.25, trim); }
    wetAllow *= 0.35;
  } else if (st == 15) {
    // ================================================================== megastructure hull
    vec2 m = vFUv;
    vec2 s1 = vec2(54.0, 36.0); vec2 s2 = vec2(9.0, 6.0);
    vec2 c1 = floor(m / s1); vec2 c2 = floor(m / s2);
    float hA = nsHash(c1 + seed); float hB = nsHash(c2 + seed * 1.7);
    float f2 = 1.0 - smoothstep(0.02, 0.25, px); float f1 = 1.0 - smoothstep(0.3, 3.0, px);
    nsWall(hB > 0.7 ? 3 : (hA > 0.5 ? 1 : 0), m, base, px, seed, albedo, rough, metal, slope, cav);
    albedo *= (0.7 + 0.5 * mix(0.5, hA, f1)) * (0.8 + 0.4 * mix(0.5, hB, f2));
    vec3 sm1 = nsSeams(m, s1, 0.5, px); vec3 sm2 = nsSeams(m, s2, 0.09, px);
    albedo *= (1.0 - sm1.x * 0.75) * (1.0 - sm2.x * 0.55); cav *= 1.0 - sm1.x * 0.6;
    slope += sm1.yz * 1.0 + sm2.yz * 0.8 + (vec2(nsHash(c2 + 1.3), nsHash(c2 + 2.9)) - 0.5) * 0.06 * f2;
    albedo *= 0.72 + 0.4 * smoothstep(0.2, 0.8, nsNoise(vec2(m.x * 0.045, m.y * 0.0016)).a);
    // habitation bands: rows of small windows
    vec2 wc = m / vec2(2.4, 3.6); vec2 wcell = floor(wc); vec2 wf = fract(wc);
    float band = step(0.5, nsHash(vec2(floor(wcell.y / 4.0), seed + 3.0))) * step(0.3, nsHash(vec2(floor(wcell.x / 18.0), floor(wcell.y / 12.0)) + seed));
    float wh = nsHash(wcell + seed * 5.1);
    float litR = clamp(pA * mix(0.45, 1.0, night), 0.0, 1.0);
    float wlit = step(wh, litR) * band;
    vec2 wd = min(wf - vec2(0.22, 0.3), vec2(0.78, 0.72) - wf) * vec2(2.4, 3.6);
    float waa = max(px, 0.003);
    float wmask = smoothstep(-waa * 0.6, waa * 0.6, min(wd.x, wd.y));
    float wl = smoothstep(0.25, 1.0, max(fwidth(wc).x, fwidth(wc).y));
    vec3 wcol = nsPalette(pB, nsHash(wcell * 1.3 + 2.0)) * (0.7 + 1.6 * nsHash(wcell + 9.0)) * mix(0.5, 1.0, night);
    float wm = wmask * band * (1.0 - wl);
    albedo = mix(albedo, vec3(0.015), wm * 0.92); rough = mix(rough, 0.08, wm); metal = mix(metal, 0.0, wm);
    emis = mix(wcol * wmask * wlit, wcol * litR * band * 0.26 * (0.4 + 1.2 * nsHash(floor(wcell / 2.0))), wl);
    float bc = step(0.97, nsHash(c2 * 3.7 + seed)) * smoothstep(0.6, 0.0, length(fract(m / s2) - 0.5) * 9.0 / (1.0 + px * 6.0));
    emis += vec3(1.0, 0.16, 0.05) * bc * (5.0 + 5.0 * sin(uTime * 2.0 + hB * 40.0)) * step(px, 6.0);
    wetAllow *= 0.3;
  } else if (st == 0 || st == 1 || st == 8 || st == 22 || st == 26 || st == 27 || st == 2 || st == 7) {
    // ================================================================== plain textured surfaces
    int kind = st == 0 ? 0 : (st == 1 ? 1 : (st == 8 ? 6 : (st == 22 ? 4 : (st == 26 ? 2 : (st == 27 ? 3 : (st == 2 ? 5 : 7))))));
    nsWall(kind, hm, base, px, seed, albedo, rough, metal, slope, cav);
    if (varA) { float hz = step(0.5, fract((hm.x + hm.y) * 0.8)); albedo = mix(albedo, mix(vec3(0.02), vec3(0.72, 0.5, 0.03), hz) * (0.6 + 0.4 * nsGrunge(hm * 0.2).g), 0.85); }
  } else if (st == 28) {
    // ================================================================== louvres / mechanical grilles
    vec2 m = hm; float sl = fract(m.y / 0.16);
    nsWall(1, m * vec2(1.0, 0.2), base, px, seed, albedo, rough, metal, slope, cav);
    float fade = 1.0 - smoothstep(0.02, 0.12, px);
    float gap = smoothstep(0.55, 0.7, sl) * fade;
    albedo *= mix(1.0, 0.08, gap) * mix(0.75, 1.0, smoothstep(0.0, 0.5, sl) * fade + (1.0 - fade));
    slope.y += (sl - 0.3) * 2.2 * fade * (1.0 - gap); cav *= 1.0 - 0.6 * gap;
    vec3 sm = nsSeams(m, vec2(2.4, 9.0), 0.04, px); albedo = mix(albedo, base * 0.5, sm.x);
  } else if (st == 3 || st == 9) {
    // ================================================================== dark glass / mirror panels
    vec2 ps = st == 9 ? vec2(2.0, 2.0) : vec2(1.5, 3.6);
    vec3 sm = nsSeams(vFUv, ps, 0.03, px); vec2 pc = floor(vFUv / ps);
    vec3 g = nsGrunge(vFUv * 0.08);
    albedo = st == 9 ? vec3(0.85, 0.88, 0.92) : base * 0.25 + 0.008;
    metal = st == 9 ? 1.0 : 0.0; rough = (st == 9 ? 0.03 : 0.04) + 0.18 * g.g * g.g + 0.1 * g.r;
    albedo *= 1.0 - sm.x * 0.8; rough += sm.x * 0.4;
    slope += (vec2(nsHash(pc + 1.0), nsHash(pc + 2.0)) - 0.5) * 0.03 * (1.0 - smoothstep(0.2, 1.0, px));
    wetAllow *= 0.2;
  } else if (st == 4) {
    // ================================================================== emissive (tubes, strips, beacons)
    float inten = vStyle2.w * 0.2;
    float fl = 1.0;
    int mode = flags % 4;
    if (mode == 1) fl = 0.75 + 0.25 * step(0.3, nsHash(vec2(floor(uTime * 13.0), seed))) * step(0.1, sin(uTime * (1.0 + seed * 0.02) + seed));
    else if (mode == 2) fl = smoothstep(0.75, 0.95, sin(uTime * 2.2 + seed * 0.7) * 0.5 + 0.5);
    else if (mode == 3) fl = 0.6 + 0.4 * sin(uTime * 1.3 + seed * 0.3 + vWPos.y * 0.02);
    float nf = (flags / 4) % 2 == 1 ? mix(0.12, 1.0, night) : 1.0;
    if ((flags / 8) % 2 == 1) { float dp = fract(vFUv.x * 0.9 + seed * 0.37); fl *= smoothstep(0.32, 0.2, abs(dp - 0.5)) * (0.6 + 0.4 * nsHash(vec2(floor(vFUv.x * 0.9 + seed * 0.37), seed))); nsIndoor = 0.0; }
    emis = base * inten * fl * nf; albedo = base * 0.08; rough = 0.35; metal = 0.0; wetAllow = 0.0;
  } else if (st == 5 || st == 23) {
    // ================================================================== signage from the atlas
    vec2 suv = vFUv;
    if (varA) suv.x = mix(vStyle2.x, vStyle2.y, fract(vFUv.x + uTime * 0.03 * (0.5 + nsHash(vec2(seed, 1.0))))) / 255.0; // ticker scroll between u0..u1
    vec4 tx = texture2D(uSignAtlas, suv);
    float inten = vStyle2.w * 0.1;
    float h = nsHash(vec2(seed, 3.0));
    float fl = 1.0;
    if (h > 0.8) fl = 0.6 + 0.4 * step(0.25, nsHash(vec2(floor(uTime * (9.0 + h * 10.0)), seed)));
    vec3 g = nsGrunge(vWPos.xy * 0.3 + vWPos.zz * 0.3 + seed);
    albedo = tx.rgb * tx.rgb * 0.5 + 0.01; rough = 0.3 + 0.3 * g.g; metal = 0.0;
    // back-lit panel: uneven tube lighting + dirt
    float uneven = 0.8 + 0.2 * sin(vFUv.x * 190.0 + seed) * (1.0 - smoothstep(0.02, 0.2, px));
    emis = tx.rgb * tx.rgb * inten * fl * mix(0.3, 1.0, night) * (0.72 + 0.28 * g.g) * uneven;
    if (st == 23) { float scan = 0.75 + 0.25 * sin(vWPos.y * 9.0 - uTime * 6.0); emis *= scan; }
    wetAllow = 0.0;
  } else if (st == 29) {
    // ================================================================== LED video wall (procedural programme)
    vec2 p = vFUv; float res = max(24.0, vStyle2.x * 2.0);
    vec2 pg = p * vec2(res, res * vStyle2.y / max(vStyle2.x, 1.0));
    vec2 pq = floor(pg) / res; vec2 pf = fract(pg);
    float prog = floor(uTime * 0.18 + seed * 0.37); float tt = fract(uTime * 0.18 + seed * 0.37);
    float k = nsHash(vec2(prog, seed)); vec3 ca = nsPalette(floor(k * 9.99), k), cb = nsPalette(floor(fract(k * 7.3) * 9.99), k);
    float pat;
    if (k < 0.33) pat = step(0.5, fract(pq.x * 3.0 - uTime * 0.2 + sin(pq.y * 6.0 + uTime) * 0.1));
    else if (k < 0.66) pat = smoothstep(0.02, 0.0, abs(length(pq - vec2(0.5, 0.3)) - fract(uTime * 0.25))) + step(0.75, nsHash(floor(pq * vec2(14.0, 8.0)) + prog)) * step(0.5, fract(uTime * 0.8 + pq.x));
    else pat = step(pq.y * 0.6 + 0.2, nsNoise(vec2(pq.x * 0.7 + uTime * 0.02, prog * 0.1)).r) ;
    vec3 c = mix(cb * 0.12, ca, pat) * smoothstep(0.0, 0.08, tt);
    float dot2 = (1.0 - smoothstep(0.02, 0.3, px * res * 0.1)) ; float led = mix(1.0, smoothstep(0.48, 0.3, length(pf - 0.5)), dot2);
    emis = c * led * vStyle2.w * 0.1 * mix(0.35, 1.0, night); albedo = vec3(0.02); rough = 0.3; wetAllow = 0.0;
  } else if (st == 6) {
    // ================================================================== road (u across in metres, v along)
    vec2 m = vFUv; float width = vStyle2.x;
    NsM t = nsMat(4.0, vWPos.xz / 5.0);
    float macro = nsNoise(vWPos.xz * 0.011).g; vec3 g = nsGrunge(vWPos.xz * 0.05);
    albedo = vec3(0.036, 0.037, 0.04) * t.alb * (0.75 + 0.5 * macro) * (0.8 + 0.3 * g.g);
    rough = t.rough; slope += t.n * 1.4 * (1.0 - smoothstep(0.05, 0.4, px)); cav = t.cav;
    float patchM = smoothstep(0.62, 0.64, nsNoise(floor(vWPos.xz / vec2(3.4, 8.0)) * 0.173).b);
    albedo *= 1.0 - 0.28 * patchM;
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
      float wear = smoothstep(0.2, 0.6, g.g * 0.6 + t.h * 0.5 + macro * 0.3);
      vec3 mc = mix(vec3(0.5), vec3(0.55, 0.38, 0.05), isCenter);
      albedo = mix(albedo, mc, mark * wear * 0.8 * fadeM);
      float stud = (1.0 - smoothstep(0.05, 0.09, abs(edge - 0.35))) * step(0.84, fract(m.y / 6.0));
      emis += vec3(0.1, 0.9, 0.8) * stud * 2.2 * fadeM * mix(0.3, 1.0, night);
    }
  } else if (st == 24) {
    // ================================================================== polished plaza tile
    vec2 ps = vec2(1.2, 1.2); vec2 m = hm; vec2 pc = floor(m / ps); float ph = nsHash(pc + seed);
    NsM t = nsMat(6.0, m * 0.35); vec3 g = nsGrunge(m * 0.07);
    albedo = base * t.alb * (0.82 + 0.3 * ph) * (0.8 + 0.3 * g.g); rough = clamp(0.22 + 0.3 * g.g + 0.2 * ph, 0.05, 1.0); metal = 0.0; slope += t.n * 0.4;
    vec3 sm = nsSeams(m, ps, 0.012, px); albedo *= 1.0 - sm.x * 0.6; slope += sm.yz * 0.6;
  } else if (st == 20) {
    // ================================================================== water
    vec2 m = vWPos.xz; float t = uTime * 0.6;
    vec2 w1 = nsNoise(m * 0.021 + vec2(t * 0.011, t * 0.007)).rg - 0.5;
    vec2 w2 = nsNoise(m * 0.083 - vec2(t * 0.019, t * 0.013)).ba - 0.5;
    slope = (w1 * 0.5 + w2 * 0.28) * (0.35 + vStyle2.w * 0.01);
    albedo = base * 0.25; rough = 0.035; metal = 0.0; wetAllow = 0.0;
  } else if (st == 21) {
    // ================================================================== foliage
    vec2 m = abs(wN.y) > 0.7 ? vWPos.xz : vec2(dot(vWPos.xz, T.xz), vWPos.y);
    NsM t = nsMat(10.0, m / 3.0); NsM t2 = nsMat(10.0, m / 0.9 + 0.37);
    albedo = base * t.alb * (0.6 + 0.5 * t2.alb.g); rough = t.rough; metal = 0.0; slope += t.n * 2.2 + t2.n * 1.2; cav = t.cav * (0.6 + 0.4 * t2.cav);
  } else if (st == 25) {
    // ================================================================== fabric / tarp
    NsM t = nsMat(9.0, vFUv / 1.5 + seed * 0.1);
    float stripe = step(0.5, fract(vFUv.x * 0.9 + seed * 0.13));
    albedo = base * t.alb * mix(0.6, 1.0, max(stripe, step(nsHash(vec2(seed, 1.0)), 0.5))); rough = t.rough; slope += t.n * 1.6; cav = t.cav;
    emis = albedo * nsSpill * 0.2;
  } else { albedo = base; rough = 0.6; }

  // ---------------------------------------------------------------------- weathering common to all
  float up = smoothstep(0.55, 0.95, wN.y);
  if (st != 4 && st != 5 && st != 23 && st != 20 && st != 29) {
    float low = (1.0 - up) * exp(-max(vWPos.y, 0.0) / 9.0) * (1.0 - nsIndoor);
    albedo *= 1.0 - 0.4 * low * (0.5 + nsNoise(vWPos.xz * 0.13 + vWPos.y * 0.21).r);
    float dirtAO = clamp(1.0 - vCol.a, 0.0, 1.0);
    albedo *= 1.0 - 0.35 * dirtAO; rough = mix(rough, 0.9, dirtAO * 0.5);
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
      float e = 0.012; vec2 rp1 = vWPos.xz * 6.0; float t1 = uTime * 1.6;
      float rx = nsRipple(rp1 + vec2(e * 6.0, 0.0), t1) - nsRipple(rp1 - vec2(e * 6.0, 0.0), t1);
      float rz = nsRipple(rp1 + vec2(0.0, e * 6.0), t1) - nsRipple(rp1 - vec2(0.0, e * 6.0), t1);
      slope += vec2(rx, -rz) * 0.5 * uRain * mix(0.15, 1.0, pud) * (1.0 - smoothstep(0.008, 0.03, px));
    }
    float vs = (1.0 - up) * wet * smoothstep(0.35, 0.8, nsNoise(vec2(dot(vWPos.xz, T.xz) * 0.35, vWPos.y * 0.012 + uTime * 0.002)).g);
    rough = mix(rough, 0.18, vs * 0.5 * (1.0 - nsIndoor));
  }

  vec3 wN2 = normalize(wN + (T * slope.x + Bt * slope.y));
  normal = normalize((viewMatrix * vec4(wN2, 0.0)).xyz);
  diffuseColor.rgb = albedo;
  roughnessFactor = clamp(rough, 0.02, 1.0);
  metalnessFactor = clamp(metal, 0.0, 1.0);
  totalEmissiveRadiance += emis;
  nsAO *= mix(1.0, cav, 0.75);
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
  float hiAmb = mix(1.0, 3.2, smoothstep(uCloud.x, uCloud.y, vWPos.y)) * (1.0 - nsIndoor);
  vec3 wNn = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
  vec3 hemi = mix(uAmbGround, uAmbSky, wNn.y * 0.5 + 0.5) * hiAmb * mix(0.35, 1.0, nsOpen);
  float fl = uFlash.w * exp(-dot(vWPos.xz - uFlash.xy, vWPos.xz - uFlash.xy) / (uFlash.z * uFlash.z * 2.0)) * (1.0 - nsIndoor);
  hemi += vec3(0.6, 0.7, 1.0) * fl * (0.5 + 0.5 * wNn.y) * 0.6;
  vec3 skyDir = normalize(vec3(uTrueSunDir.x, 0.45, uTrueSunDir.z));
  hemi += uSunScatter * 0.85 * max(dot(wNn, skyDir), 0.0) * mix(0.3, 1.0, nsOpen) * (1.0 - nsIndoor) * (1.0 - smoothstep(uCloud.x, uCloud.y, vWPos.y));
  vec3 irr = hemi + nsSpill * (0.55 + 0.45 * (1.0 - abs(wNn.y))) + vec3(0.085, 0.075, 0.065) * nsIndoor * (0.6 + 0.4 * wNn.y);
  reflectedLight.indirectDiffuse += irr * material.diffuseColor;
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

export const MATU = { uMatA: { value: null }, uMatB: { value: null } };

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
    Object.assign(shader.uniforms, U, MATU);
    shader.uniforms.uSignAtlas = opts.signAtlas || { value: null };
    if (opts.uniforms) Object.assign(shader.uniforms, opts.uniforms);
    const vp = facade ? VERT_PARS : 'varying vec3 vWPos; varying vec3 vWNormal;';
    const vm = facade ? VERT_MAIN : /* glsl */ `
      vec4 nsWP = vec4(transformed, 1.0); vec3 nsWN = objectNormal;
      #ifdef USE_INSTANCING
        nsWP = instanceMatrix * nsWP; nsWN = mat3(instanceMatrix) * nsWN;
      #endif
      vWPos = (modelMatrix * nsWP).xyz;
      vWNormal = normalize(mat3(modelMatrix) * nsWN);`;
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
        // vGlow: x = mode (0 cone/beam, 1 hologram sheet, 2 soft blob, 3 atlas hologram), y = intensity, z = seed, w = night-only
        vec3 V = normalize(cameraPosition - vWPos);
        float mode = floor(vGlow.x + 0.5);
        float a = 1.0;
        vec3 c = vCol.rgb * vCol.rgb;
        if (mode < 0.5) {
          float edge = pow(abs(dot(normalize(vN), V)), 1.6);
          float n = nsNoise(vec2(vUv2.x * 0.35 + uTime * 0.01, vUv2.y * 0.5 - uTime * 0.03)).r;
          a = edge * pow(1.0 - clamp(vUv2.y, 0.0, 1.0), 1.7) * (0.55 + 0.9 * n);
        } else if (mode < 1.5) {
          float scan = 0.7 + 0.3 * sin(vWPos.y * 2.2 - uTime * 3.0 + vGlow.z);
          float gl = step(0.985, nsHash(vec2(floor(vWPos.y * 0.6), floor(uTime * 9.0))));
          a = vCol.a * scan * (1.0 - gl * 0.6);
        } else if (mode < 2.5) { float d = length(vUv2 - 0.5) * 2.0; a = smoothstep(1.0, 0.0, d); a *= a; }
        else {
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
