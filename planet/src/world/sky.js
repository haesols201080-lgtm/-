// Atmosphere and sky over a moving celestial sphere.
//
// Arke is the largest moon of Kronos, a ringed gas giant. Arke spins once a
// game day about an axis tilted against the giant's orbit round the star, which
// gives it seasons. It circles Kronos every few days. So the giant rises and
// sets every day like the sun, waxes and wanes, now and then eclipses the sun,
// and its sunlit face lights the night. The sibling moons Pele and Themis
// follow their own orbits with true phases. Two more planets of the system
// wander along the ecliptic, and the stars and the Milky Way turn with the sky.
// Everything is computed in a fixed celestial frame (z = Arke's spin axis)
// and rotated into the local sky by the observer's latitude and sidereal time.
import * as THREE from 'three';
import { U, WORLD } from '../core/shared.js';
import { clamp, lerp, smoothstep } from '../core/noise.js';

const TAU = Math.PI * 2;

// the Kronos system. Distances are in giant radii, periods in game days.
export const SYSTEM = {
  YEAR: 40,                 // Kronos round the star
  OBLIQ: 0.40,              // Arke's equator against the ecliptic → seasons
  YEAR0: 0.08,              // year phase on day 1 (spring, days lengthening)
  ARKE: { a: 7.6, P: 5, inc: 0.2, node: 1.0, full: 1.2 },   // giant full on the first night
  RING_TILT: 0.32,          // Kronos' equator (rings) against Arke's orbit: the rings open and close
  SPIN: 0.42,               // Kronos' rotation, its cloud bands drift visibly
  MOONS: [
    { name: '펠레', a: 4.3, R: 0.034, th0: 2.1 },     // inner, volcanic
    { name: '테미스', a: 12.4, R: 0.047, th0: 4.4 },  // outer, ice shell over an ocean
  ],
  PLANETS: [
    { name: '네레이드', r: 0.62, l0: 1.1, mag: 3.2, tint: [0.78, 0.88, 1.0] },   // inner world, evening / morning star
    { name: '하데스', r: 1.9, l0: 3.9, mag: 1.4, tint: [1.0, 0.9, 0.72] },
  ],
};

// celestial rendering shared by the sky dome and the intro's space backdrop
export const SPACE_GLSL = /* glsl */`
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uTimeS;
uniform sampler2D tNoise;
uniform mat3 uSkyRot;     // local sky -> celestial frame
uniform vec4 uGiant;      // Kronos: direction, sin of angular radius (its distance is the unit)
uniform vec3 uGiantAx, uGiantRef;
uniform float uGiantSpin;
uniform vec4 uMoonA, uMoonB;     // Pele, Themis: direction, sin of angular radius
uniform vec2 uMoonD;             // their distances, in units of the giant's distance
uniform vec4 uWandA, uWandB;     // two planets: direction, brightness
uniform float uSunVis;           // 1 clear .. 0 sun behind the giant

float hash13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }

// ---- space: stars, the Milky Way, the giant, moons and planets
// stars on cube-face cells, so each stays round and crisp at any resolution
vec3 starLayer(vec3 c, float K, float fill, float gain, float px, float tw) {
  vec3 a = abs(c);
  vec2 uv; float id;
  if (a.x >= a.y && a.x >= a.z) { uv = c.yz / a.x; id = c.x > 0.0 ? 1.0 : 2.0; }
  else if (a.y >= a.z) { uv = c.zx / a.y; id = c.y > 0.0 ? 3.0 : 4.0; }
  else { uv = c.xy / a.z; id = c.z > 0.0 ? 5.0 : 6.0; }
  vec2 gi = floor(uv * K);
  vec3 key = vec3(gi, id * 17.0 + K);
  float jac = 1.0 + dot(uv, uv); jac *= sqrt(jac);   // cells shrink toward the face edges
  if (hash13(key) * jac > fill) return vec3(0.0);
  vec2 sp = (gi + 0.25 + 0.5 * vec2(hash13(key + 1.7), hash13(key + 4.3))) / K;
  float sg = id == 1.0 || id == 3.0 || id == 5.0 ? 1.0 : -1.0;
  vec3 s = id < 2.5 ? vec3(sg, sp.x, sp.y) : id < 4.5 ? vec3(sp.y, sg, sp.x) : vec3(sp.x, sp.y, sg);
  s = normalize(s);
  float m = hash13(key + 7.7);
  float B = gain * (0.05 + 1.8 * pow(m, 9.0) + 0.25 * m * m);
  float rc = min(px * 0.75, 0.13 / K);
  vec3 dv = c - s;
  float core = exp(-dot(dv, dv) / (rc * rc));
  float t = hash13(key + 2.2);
  vec3 tint = t < 0.1 ? vec3(0.62, 0.74, 1.0) : t < 0.5 ? vec3(0.92, 0.95, 1.0) : t < 0.78 ? vec3(1.0, 0.93, 0.8) : t < 0.94 ? vec3(1.0, 0.8, 0.6) : vec3(1.0, 0.66, 0.48);
  float tws = 1.0 + tw * sin(uTimeS * (3.0 + m * 11.0) + t * 60.0);
  return tint * B * core * tws;
}

float triNoise(vec3 c, float s) {
  vec3 w = abs(c); w = w * w * w; w /= (w.x + w.y + w.z);
  return texture2D(tNoise, c.yz * s).r * w.x + texture2D(tNoise, c.zx * s + 0.31).r * w.y + texture2D(tNoise, c.xy * s + 0.67).r * w.z;
}

const vec3 GNP = vec3(-0.5097, 0.7002, 0.5);      // galactic pole in the celestial frame
const vec3 GCD = vec3(0.8085, 0.5885, 0.0);       // toward the galactic core

// milky way: a band of unresolved stars, brightest and thickest toward the core,
// clumped into star clouds and split by dark dust lanes
float mwBand(vec3 c, out float l, out float sb, out float bul) {
  sb = dot(c, GNP);
  l = atan(dot(c, cross(GNP, GCD)), dot(c, GCD));
  bul = exp(-l * l * 2.2);
  float w = 0.075 + 0.085 * bul;
  return exp(-sb * sb / (w * w)) * (0.35 + 0.65 * bul) + exp(-(l * l * 5.0 + sb * sb * 40.0)) * 0.8;
}
vec3 milkyWay(vec3 c, float band, float l, float sb, float bul) {
  if (band < 0.01) return vec3(0.0);
  float n1 = triNoise(c, 1.7), n2 = triNoise(c, 6.0);
  float clouds = 0.25 + 1.3 * smoothstep(0.3, 0.85, n1 * 0.65 + n2 * 0.5);
  float lane = exp(-pow((sb + 0.014 * sin(l * 5.0 + 1.0)) / (0.022 + 0.022 * bul), 2.0));
  float rift = lane * smoothstep(0.3, 0.65, n2 * 0.7 + n1 * 0.45);
  vec3 col = mix(vec3(0.6, 0.68, 0.95), vec3(1.0, 0.85, 0.64), bul);
  return col * band * clouds * (1.0 - 0.85 * rift) * 0.08;
}

vec3 spaceBack(vec3 d, float px, float tw) {
  vec3 c = uSkyRot * d;
  float l, sb, bul;
  float band = mwBand(c, l, sb, bul);
  vec3 col = milkyWay(c, band, l, sb, bul);
  col += starLayer(c, 110.0, 0.075 + 0.2 * band, 0.55, px, tw);
  col += starLayer(c, 37.0, 0.045, 1.7, px, tw);
  return col;
}

float ringAlpha(float rr) {
  float a = smoothstep(1.3, 1.36, rr) * (1.0 - smoothstep(2.28, 2.34, rr));
  float band = texture2D(tNoise, vec2(rr * 0.61, 0.5)).r;
  float fine = texture2D(tNoise, vec2(rr * 5.3, 0.27)).g;
  float hair = texture2D(tNoise, vec2(rr * 19.0, 0.61)).a;
  a *= (0.22 + 0.78 * band * (0.6 + 0.8 * fine)) * (0.75 + 0.5 * hair);
  a *= mix(0.35, 1.0, smoothstep(1.48, 1.56, rr));                        // faint inner ring
  a *= 1.0 - 0.94 * smoothstep(1.84, 1.86, rr) * (1.0 - smoothstep(1.93, 1.95, rr));   // the big gap
  a *= 1.0 - 0.6 * smoothstep(2.17, 2.18, rr) * (1.0 - smoothstep(2.19, 2.2, rr));
  return clamp(a * 0.85, 0.0, 1.0);
}

float moonShadow(vec3 H, vec4 m, float dist) {
  vec3 v = m.xyz * dist - H;
  float t = dot(v, uSunDir);
  if (t <= 0.0) return 1.0;
  float R = m.w * dist;
  float p2 = dot(v, v) - t * t;
  return smoothstep(R * R * 0.5, R * R * 1.6, p2);
}

// Kronos: banded clouds turning with the planet, phases from the real sun
// direction, ring shadows on the cloud tops and the planet's shadow on the rings.
// Returns premultiplied colour and coverage.
vec4 gasGiant(vec3 d, float px) {
  vec3 P = uGiant.xyz;
  float r = uGiant.w;
  float b = dot(d, P);
  if (b < 0.8) return vec4(0.0);
  vec3 ax = uGiantAx;
  vec4 res = vec4(0.0);
  float disc = b * b - (1.0 - r * r);
  float tP = 1e9;
  if (disc > 0.0) {
    tP = b - sqrt(disc);
    vec3 H = d * tP;
    vec3 n = (H - P) / r;
    float lat = dot(n, ax);
    float lon = atan(dot(n, cross(ax, uGiantRef)), dot(n, uGiantRef)) + uGiantSpin;
    float u = lon / 6.2831853;
    float turb = texture2D(tNoise, vec2(u * 2.0, lat * 0.9 + 0.2)).r;
    float la = lat + (turb - 0.5) * 0.07;
    float bands = texture2D(tNoise, vec2(0.37, la * 1.4)).r * 0.65 + texture2D(tNoise, vec2(0.71, la * 3.6)).g * 0.35;
    float fine = texture2D(tNoise, vec2(u * 6.0, la * 7.0)).g;
    // pale ammonia zones, amber belts, a blue-grey haze toward the poles
    vec3 base = mix(vec3(0.56, 0.4, 0.27), vec3(0.84, 0.77, 0.62), smoothstep(0.36, 0.64, bands));
    base = mix(base, vec3(0.48, 0.3, 0.2), smoothstep(0.55, 0.8, fine) * 0.4);
    base = mix(base, vec3(0.5, 0.56, 0.62), smoothstep(0.6, 0.92, abs(lat)));
    // a long-lived storm oval in the southern belt
    vec2 so = vec2(fract(u - 0.17 + 0.5) - 0.5, (la + 0.38) * 2.2);
    base = mix(base, vec3(0.86, 0.6, 0.45), smoothstep(0.05, 0.02, length(so * vec2(1.0, 1.6))) * 0.8);
    float mu = dot(n, uSunDir);
    float lit = smoothstep(-0.05, 0.2, mu) * (0.3 + 0.7 * max(mu, 0.0));
    // shadow of the rings on the cloud tops
    float sa = dot(uSunDir, ax);
    if (abs(sa) > 1e-3) {
      float ts = -dot(H - P, ax) / sa;
      if (ts > 0.0) lit *= 1.0 - 0.85 * ringAlpha(length(H + uSunDir * ts - P) / r);
    }
    lit *= moonShadow(H, uMoonA, uMoonD.x) * moonShadow(H, uMoonB, uMoonD.y);
    float limb = sqrt(max(dot(n, -d), 0.0));
    vec3 col = base * (lit * (0.5 + 0.55 * limb) + 0.006);
    float cov = clamp(disc / max(fwidth(disc), 1e-9) + 0.5, 0.0, 1.0);
    res = vec4(col * cov, cov);
  }
  // rings
  float den = dot(d, ax);
  if (abs(den) > 1e-5) {
    float t = dot(P, ax) / den;
    if (t > 0.0 && (t < tP || res.a < 0.99)) {
      vec3 q = d * t - P;
      float rr = length(q) / r;
      if (rr > 1.28 && rr < 2.36) {
        float a = ringAlpha(rr);
        float sa = dot(uSunDir, ax);
        bool sameSide = sa * dot(-P, ax) > 0.0;
        float lit = sameSide ? 0.15 + 0.7 * pow(abs(sa), 0.5) : 0.08 + 0.35 * (1.0 - a);
        // the planet's shadow across the rings
        float al = dot(q, uSunDir);
        if (al < 0.0 && length(q - uSunDir * al) < r) lit *= 0.03;
        vec3 rc = mix(vec3(0.6, 0.54, 0.46), vec3(0.86, 0.8, 0.7), texture2D(tNoise, vec2(rr * 1.7, 0.8)).r) * lit;
        if (t < tP) res = vec4(rc * a + res.rgb * (1.0 - a), a + res.a * (1.0 - a));
        else res = vec4(res.rgb + rc * a * (1.0 - res.a), res.a + a * (1.0 - res.a));
      }
    }
  }
  return res;
}

// small moon: a lit sphere, so the phase follows the true sun direction
vec4 moonDisc(vec3 d, vec4 m, vec3 alb, vec3 alb2, float seed, float px) {
  float cd = dot(d, m.xyz);
  float r = max(m.w, px * 1.1);
  if (1.0 - cd > r * r * 3.0) return vec4(0.0);
  vec3 off = (d - m.xyz * cd) / r;
  float q = length(off);
  float cov = 1.0 - smoothstep(1.0 - px / r, 1.0 + px / r, q);
  if (cov <= 0.0) return vec4(0.0);
  vec3 n = normalize(off - m.xyz * sqrt(max(1.0 - q * q, 0.0)));
  float mu = dot(n, uSunDir);
  float lit = smoothstep(-0.04, 0.16, mu) * (0.3 + 0.7 * max(mu, 0.0));
  vec3 e1 = normalize(cross(m.xyz, uGiantAx)), e2 = cross(m.xyz, e1);
  vec2 st = vec2(dot(off, e1), dot(off, e2));
  float tx = texture2D(tNoise, st * 0.3 + seed).r * 0.6 + texture2D(tNoise, st * 0.8 + seed * 1.7).b * 0.4;
  vec3 col = mix(alb, alb2, smoothstep(0.42, 0.68, tx));
  float e = min(1.0, (m.w * m.w) / (r * r) * 1.6);
  return vec4(col * (lit * 1.35 + 0.004) * cov * e, cov * e);
}

vec3 wanderer(vec3 d, vec4 w, vec3 tint, float px) {
  vec3 dv = d - w.xyz;
  float rc = px * 0.85;
  return tint * w.w * exp(-dot(dv, dv) / (rc * rc));
}

// everything beyond the air, composited back to front; cover returns how much
// of the view a solid body blocks
vec3 heavens(vec3 d, float px, float starVis, float tw, out float cover) {
  vec3 col = starVis > 0.003 ? spaceBack(d, px, tw) * starVis : vec3(0.0);
  col += (wanderer(d, uWandA, vec3(0.78, 0.88, 1.0), px) + wanderer(d, uWandB, vec3(1.0, 0.9, 0.72), px)) * mix(starVis, 1.0, 0.1);
  // sun: disc, and the corona when the giant hides it
  float sd = dot(d, uSunDir);
  col += uSunColor * smoothstep(0.99988, 0.99994, sd) * 60.0;
  float sa = sqrt(max(2.0 * (1.0 - sd), 0.0));
  col += vec3(0.95, 0.92, 1.0) * (1.0 - uSunVis) * (exp(-max(sa - 0.0134, 0.0) / 0.006) * 1.4 + exp(-max(sa - 0.0134, 0.0) / 0.03) * 0.25);
  cover = 0.0;
  vec4 mA = moonDisc(d, uMoonA, vec3(0.88, 0.76, 0.4), vec3(0.5, 0.28, 0.12), 0.31, px);
  vec4 mB = moonDisc(d, uMoonB, vec3(0.86, 0.88, 0.9), vec3(0.6, 0.48, 0.4), 0.77, px);
  if (uMoonD.x > 1.0) { col = col * (1.0 - mA.a) + mA.rgb; cover = max(cover, mA.a); }
  if (uMoonD.y > 1.0) { col = col * (1.0 - mB.a) + mB.rgb; cover = max(cover, mB.a); }
  vec4 gg = gasGiant(d, px);
  col = col * (1.0 - gg.a) + gg.rgb; cover = max(cover, gg.a);
  if (uMoonD.x <= 1.0) { col = col * (1.0 - mA.a) + mA.rgb; cover = max(cover, mA.a); }
  if (uMoonD.y <= 1.0) { col = col * (1.0 - mB.a) + mB.rgb; cover = max(cover, mB.a); }
  return col;
}

`;

export const SKY_GLSL = SPACE_GLSL + /* glsl */`
uniform float uAtmo;      // 0 thin dusty air .. 1 full atmosphere
uniform float uDust;      // airborne dust haze
uniform float uCloudCover;
uniform float uCloudTime;
uniform float uStorm;     // dark rain clouds
uniform vec3 uCamPos;
uniform float uDip;       // horizon dip from planet curvature at the camera altitude
uniform float uShine;     // how much sunlit giant is up in the night sky

// ---- the sky's air
vec3 skyBase(vec3 d) {
  float sunE = uSunDir.y;
  float day = smoothstep(-0.16, 0.12, sunE) * mix(0.05, 1.0, uSunVis);
  float h = max((d.y + uDip) / (1.0 + uDip), 0.0);
  vec3 thinZen = vec3(0.055, 0.034, 0.03);
  vec3 thinHor = vec3(0.66, 0.42, 0.28);
  vec3 thickZen = vec3(0.10, 0.25, 0.62);
  vec3 thickHor = vec3(0.55, 0.70, 0.86);
  vec3 zen = mix(thinZen, thickZen, uAtmo);
  vec3 hor = mix(thinHor, thickHor, uAtmo);
  hor = mix(hor, vec3(0.62, 0.45, 0.32), uDust * 0.6);
  vec3 col = mix(hor, zen, pow(h, mix(0.3, 0.42, uAtmo)));
  float sd = max(dot(d, uSunDir), 0.0);
  // twilight colours: Mars-like blue sunsets in thin air, orange in thick air
  float twi = (1.0 - smoothstep(0.0, 0.32, sunE)) * smoothstep(-0.22, 0.02, sunE);
  vec3 setCol = mix(vec3(0.35, 0.55, 1.0), vec3(1.0, 0.42, 0.15), uAtmo);
  col = mix(col, setCol * 1.2, twi * pow(sd, mix(6.0, 2.0, uAtmo)) * (1.0 - h * 0.7));
  col = mix(col, col * vec3(1.0, 0.75, 0.6), twi * (1.0 - h) * uAtmo * 0.6);
  col *= mix(0.02, 1.0, day);
  // night: airglow brightest toward the horizon, plus air lit by the giant's sunlit face
  vec3 night = mix(vec3(0.017, 0.021, 0.036), vec3(0.008, 0.011, 0.022), h);
  vec3 shineCol = mix(vec3(0.007, 0.006, 0.005), vec3(0.026, 0.05, 0.11), uAtmo) + vec3(0.03, 0.022, 0.015) * uDust;
  float gd = max(dot(d, uGiant.xyz), 0.0);
  night += shineCol * uShine * (0.5 + 0.5 * (1.0 - h) + 2.5 * pow(gd, 10.0));
  col += night * (1.0 - day);
  // sun glow (mie)
  col += uSunColor * (pow(sd, 6.0) * mix(0.12, 0.35, uAtmo) + pow(sd, 90.0) * 0.8 + uDust * pow(sd, 3.0) * 0.25) * smoothstep(-0.16, 0.12, sunE) * uSunVis;
  return col;
}

vec4 cloudLayer(vec3 d, vec3 ro) {
  if (uCloudCover <= 0.001 || d.y <= 0.0) return vec4(0.0);
  float H = 1400.0;
  float t = (H - ro.y) / max(d.y, 0.02);
  vec2 p = ro.xz + d.xz * t;
  vec2 w = vec2(uCloudTime * 6.0, uCloudTime * 2.0);
  float n = texture2D(tNoise, (p + w) * 0.00016).r * 0.6 + texture2D(tNoise, (p + w * 1.6) * 0.0006).g * 0.3 + texture2D(tNoise, (p + w * 2.2) * 0.0022).a * 0.12;
  float cov = mix(0.82, 0.38, uCloudCover);
  float dens = smoothstep(cov, cov + 0.22, n);
  // light: sample toward the sun
  vec2 ps = p + uSunDir.xz * 260.0;
  float ns = texture2D(tNoise, (ps + w) * 0.00016).r * 0.6 + texture2D(tNoise, (ps + w * 1.6) * 0.0006).g * 0.3;
  float shade = 1.0 - smoothstep(cov, cov + 0.35, ns) * 0.65;
  float day = smoothstep(-0.12, 0.15, uSunDir.y) * mix(0.05, 1.0, uSunVis);
  vec3 lit = mix(vec3(0.55, 0.58, 0.66), vec3(1.25, 1.18, 1.08), shade) * uSunColor;
  lit = mix(lit, lit * vec3(1.0, 0.7, 0.5), (1.0 - smoothstep(0.0, 0.3, uSunDir.y)) * uAtmo);
  lit = mix(lit, vec3(0.24, 0.26, 0.3), uStorm * 0.75);
  vec3 col = lit * mix(0.025, 1.0, day) + vec3(0.05, 0.055, 0.07) * uShine * (1.0 - day);
  float fade = smoothstep(0.02, 0.18, d.y) * (1.0 - smoothstep(9000.0, 26000.0, t));
  return vec4(col, dens * fade);
}

vec3 skyColor(vec3 d, vec3 ro) {
  vec3 air = skyBase(d);
  float day = smoothstep(-0.16, 0.12, uSunDir.y) * mix(0.05, 1.0, uSunVis);
  float px = max(length(fwidth(d)), 1e-5);
  // stars only once the sky is dark: even a thin dusty atmosphere outshines them by day
  float starVis = clamp(1.0 - day * 1.6, 0.0, 1.0) * (1.0 - uCloudCover * 0.6) * smoothstep(-0.06, 0.12, d.y);
  // light from space dims and reddens through more air toward the horizon
  float am = 1.0 / max(d.y + uDip + 0.035, 0.035);
  vec3 trans = exp(-am * (0.004 + 0.05 * uAtmo + 0.035 * uDust) * vec3(0.55, 0.8, 1.35));
  float tw = (0.15 + 0.5 * (1.0 - smoothstep(0.0, 0.5, d.y))) * uAtmo;   // scintillation only through thick air
  float cover;
  vec3 sp = heavens(d, px, starVis, tw, cover);
  vec3 col = air + sp * trans;
  vec4 cl = cloudLayer(d, ro);
  col = mix(col, cl.rgb, cl.a);
  // ground below the horizon fades to a dark haze
  float below = smoothstep(-uDip, -uDip - 0.12, d.y);
  col = mix(col, skyBase(vec3(d.x, -uDip + 0.01, d.z)) * 0.85, below);
  return col;
}
`;

// ------------------------------------------------------------------ orbits
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
class Orbits {
  constructor() {
    const S = SYSTEM, A = S.ARKE;
    this.Z = v3(0, 0, 1);
    // Arke's orbit round the giant, a little inclined to its own equator
    this.UA = v3(Math.cos(A.node), Math.sin(A.node), 0);
    this.NA = this.Z.clone().applyAxisAngle(this.UA, A.inc);
    this.VA = v3().crossVectors(this.NA, this.UA).normalize();
    // the giant's spin axis (ring plane normal), tilted further
    const tAx = this.UA.clone().applyAxisAngle(this.NA, 1.3);
    this.G = this.NA.clone().applyAxisAngle(tAx, S.RING_TILT);
    this.UG = v3().crossVectors(this.Z, this.G).normalize();
    this.VG = v3().crossVectors(this.G, this.UG).normalize();
    this.moons = S.MOONS.map((m) => ({ ...m, P: A.P * Math.pow(m.a / A.a, 1.5) }));
    // phase Arke's orbit so the giant is full on the first night
    const s = this.sunAt(A.full, v3());
    this.th0 = Math.atan2(s.dot(this.VA), s.dot(this.UA)) - TAU * A.full / A.P;
    this.out = {
      sun: v3(), giant: v3(), giantR: 0, giantRef: v3(), spin: 0, pA: v3(),
      moons: S.MOONS.map(() => ({ dir: v3(), r: 0, d: 0 })),
      planets: S.PLANETS.map(() => ({ dir: v3(), b: 0 })),
      lambda: 0, decl: 0, ra: 0,
    };
    this._t = v3(); this._q = v3();
  }

  sunAt(dayF, out) {
    const l = TAU * (dayF / SYSTEM.YEAR + SYSTEM.YEAR0), e = SYSTEM.OBLIQ;
    return out.set(Math.cos(l), Math.sin(l) * Math.cos(e), Math.sin(l) * Math.sin(e));
  }

  // celestial-frame directions at a moment (dayF = days since the landing)
  at(dayF) {
    const S = SYSTEM, A = S.ARKE, o = this.out;
    this.sunAt(dayF, o.sun);
    o.lambda = TAU * (dayF / S.YEAR + S.YEAR0);
    o.ra = Math.atan2(o.sun.y, o.sun.x);
    o.decl = Math.asin(o.sun.z);
    const th = this.th0 + TAU * dayF / A.P;
    const pA = o.pA.copy(this.UA).multiplyScalar(Math.cos(th) * A.a).addScaledVector(this.VA, Math.sin(th) * A.a);
    o.giant.copy(pA).multiplyScalar(-1 / A.a);
    o.giantR = 1 / A.a;
    // band longitude reference: the meridian facing Arke, in the giant's own frame
    const ref = o.giantRef.copy(pA).addScaledVector(this.G, -pA.dot(this.G)).normalize();
    o.spin = (Math.atan2(ref.dot(this.VG), ref.dot(this.UG)) - TAU * dayF / S.SPIN) % TAU;
    this.moons.forEach((m, i) => {
      const t = m.th0 + TAU * dayF / m.P;
      const v = this._t.copy(this.UG).multiplyScalar(Math.cos(t) * m.a).addScaledVector(this.VG, Math.sin(t) * m.a).sub(pA);
      const dist = v.length();
      o.moons[i].dir.copy(v).divideScalar(dist);
      o.moons[i].r = m.R / dist;
      o.moons[i].d = dist / A.a;
    });
    // other planets: heliocentric circles in the ecliptic; the giant sits opposite the sun
    const lg = o.lambda + Math.PI, e = S.OBLIQ;
    S.PLANETS.forEach((p, i) => {
      const lp = p.l0 + TAU * dayF / (S.YEAR * Math.pow(p.r, 1.5));
      const x = Math.cos(lp) * p.r - Math.cos(lg), y = Math.sin(lp) * p.r - Math.sin(lg);
      const L = Math.hypot(x, y);
      o.planets[i].dir.set(x / L, (y / L) * Math.cos(e), (y / L) * Math.sin(e));
      o.planets[i].b = p.mag / (L * L) * (p.r < 1 ? 0.5 + 0.5 * Math.max(0, (x * Math.cos(lp) + y * Math.sin(lp)) / L) : 1);
    });
    return o;
  }
}

export class Sky {
  constructor(renderer, scene) {
    this.renderer = renderer;
    this.scene = scene;
    this.uniforms = {
      uSunDir: U.uSunDir,
      uSunColor: U.uSunColor,
      uAtmo: { value: 0 },
      uDust: { value: 0.4 },
      uCloudCover: U.uCloudCover,
      uCloudTime: U.uCloudTime,
      uStorm: { value: 0 },
      uTimeS: U.uTime,
      tNoise: U.tNoise,
      uCamPos: { value: new THREE.Vector3() },
      uDip: { value: 0 },
      uSkyRot: { value: new THREE.Matrix3() },
      uGiant: { value: new THREE.Vector4(0, 1, 0, 0.13) },
      uGiantAx: { value: new THREE.Vector3(0, 1, 0) },
      uGiantRef: { value: new THREE.Vector3(1, 0, 0) },
      uGiantSpin: { value: 0 },
      uMoonA: { value: new THREE.Vector4(0, 1, 0, 0.004) },
      uMoonB: { value: new THREE.Vector4(0, 1, 0, 0.004) },
      uMoonD: { value: new THREE.Vector2(2, 2) },
      uWandA: { value: new THREE.Vector4(0, 1, 0, 0) },
      uWandB: { value: new THREE.Vector4(0, 1, 0, 0) },
      uSunVis: { value: 1 },
      uShine: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: /* glsl */`
        varying vec3 vDir;
        void main() {
          vDir = position;
          vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position = vec4(p.xy, p.w * 0.99999, p.w);
        }`,
      fragmentShader: SKY_GLSL + /* glsl */`
        varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          gl_FragColor = vec4(skyColor(d, uCamPos), 1.0);
        }`,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), mat);
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -1000;
    scene.add(this.dome);

    // separate scene for environment map capture
    this.envScene = new THREE.Scene();
    this.envDome = new THREE.Mesh(this.dome.geometry, mat);
    this.envDome.frustumCulled = false;
    this.envScene.add(this.envDome);
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envRT = null;
    this.envTimer = 0;
    this.lastEnvKey = '';

    // lights
    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 1; sc.far = 600;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.05;
    scene.add(this.sun);
    scene.add(this.sun.target);
    this.hemi = new THREE.HemisphereLight(0x8899aa, 0x443322, 0.2);
    scene.add(this.hemi);

    this.time = 0.36;        // fraction of a day; 0.25 sunrise, 0.5 noon (at the equinox)
    this.dayLength = 1080;   // seconds per day
    this.day = 1;
    this.state = { atmo: 0, dust: 0.4, cloud: 0, storm: 0 };
    this.fog = { density: 0.0012, falloff: 0.012, color: new THREE.Color(), sunColor: new THREE.Color() };
    this.tmp = new THREE.Vector3();
    this.orbits = new Orbits();
    this.lat = 0;
    this.sunVis = 1;         // 0 during a total eclipse by the giant
    this.shine = 0;          // sunlit giant in the night sky
    this.adapt = 1;          // eye / camera adaptation to the dark
    this._X = new THREE.Vector3(); this._Y = new THREE.Vector3(); this._A = new THREE.Vector3(); this._M = new THREE.Vector3();
    this._nd = new THREE.Vector3();
  }

  setShadowSize(s) {
    this.sun.shadow.mapSize.set(s, s);
    if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
  }

  // planetary state from terraforming (0..1 values)
  setAtmosphere({ atmo, dust, cloud, storm, fog = 0 }) {
    const s = this.state;
    s.atmo = atmo; s.dust = dust; s.cloud = cloud; s.storm = storm; s.fog = fog;
  }

  sunElevation() { return U.uSunDir.value.y; }
  isNight() { return U.uSunDir.value.y < -0.05; }

  // celestial frame -> local sky (x east, y up, -z north) for this latitude and moment
  local(c, out) { return out.copy(this._X).multiplyScalar(c.x).addScaledVector(this._Y, c.y).addScaledVector(this._A, c.z); }

  // solve the sky for the current moment; also used by tests
  solve(lat) {
    const C = this.orbits.at(this.day - 1 + this.time);
    const A = this._A.set(0, Math.sin(lat), -Math.cos(lat)), M = this._M.set(0, Math.cos(lat), Math.sin(lat));
    const th = (this.time - 0.5) * TAU + C.ra;          // sidereal angle: the sun's hour angle plus its right ascension
    const c = Math.cos(th), s = Math.sin(th);
    this._X.set(-s, M.y * c, M.z * c);                  // M cos - E sin
    this._Y.set(c, M.y * s, M.z * s);                   // M sin + E cos
    const u = this.uniforms;
    this.local(C.sun, U.uSunDir.value).normalize();
    const X = this._X, Y = this._Y;
    u.uSkyRot.value.set(X.x, X.y, X.z, Y.x, Y.y, Y.z, A.x, A.y, A.z);
    const g = this.local(C.giant, this.tmp);
    u.uGiant.value.set(g.x, g.y, g.z, C.giantR);
    this.local(this.orbits.G, u.uGiantAx.value);
    this.local(C.giantRef, u.uGiantRef.value);
    u.uGiantSpin.value = C.spin;
    const mo = (i, U4) => { const m = C.moons[i]; this.local(m.dir, this._nd); U4.set(this._nd.x, this._nd.y, this._nd.z, m.r); };
    mo(0, u.uMoonA.value); mo(1, u.uMoonB.value);
    u.uMoonD.value.set(C.moons[0].d, C.moons[1].d);
    const pl = (i, U4) => { const p = C.planets[i]; this.local(p.dir, this._nd); U4.set(this._nd.x, this._nd.y, this._nd.z, p.b); };
    pl(0, u.uWandA.value); pl(1, u.uWandB.value);
    // eclipse: the giant's disc over the sun's
    const sd = U.uSunDir.value, gv = u.uGiant.value;
    const sep = Math.acos(clamp(sd.x * gv.x + sd.y * gv.y + sd.z * gv.z, -1, 1));
    const rg = Math.asin(C.giantR), rs = 0.0134;
    const k = clamp((sep - (rg - rs)) / (2 * rs), 0, 1);
    this.sunVis = k * k * (3 - 2 * k);
    u.uSunVis.value = this.sunVis;
    // giant phase: lit fraction seen from Arke
    this.giantPhase = (1 - (C.sun.x * C.giant.x + C.sun.y * C.giant.y + C.sun.z * C.giant.z)) / 2;
    return C;
  }

  update(dt, camPos) {
    this.time += dt / this.dayLength;
    if (this.time >= 1) { this.time -= 1; this.day++; }
    // the sky follows the latitude the explorer stands at
    this.lat = clamp(-camPos.z / WORLD.HALF, -0.85, 0.85) * Math.PI / 2;
    this.solve(this.lat);
    const sd = U.uSunDir.value;

    const s = this.state;
    const u = this.uniforms;
    u.uAtmo.value = lerp(u.uAtmo.value, s.atmo, Math.min(1, dt * 0.5));
    u.uDust.value = lerp(u.uDust.value, s.dust, Math.min(1, dt * 0.5));
    U.uCloudCover.value = lerp(U.uCloudCover.value, s.cloud, Math.min(1, dt * 0.3));
    u.uStorm.value = lerp(u.uStorm.value, s.storm, Math.min(1, dt * 0.3));
    U.uCloudTime.value += dt;
    u.uCamPos.value.copy(camPos);
    u.uDip.value = Math.sqrt(4 * Math.max(camPos.y + 20, 1) * WORLD.CURV);
    this.dome.position.copy(camPos);

    const atmo = u.uAtmo.value;
    const elev = sd.y;
    const vis = this.sunVis;
    const day = smoothstep(-0.12, 0.1, elev);
    const dayV = day * lerp(0.05, 1, vis);
    U.uNight.value = 1 - dayV;
    // sun colour: white-hot in thin air, warm near the horizon in thick air
    const warm = (1 - smoothstep(0.0, 0.45, elev)) * (0.35 + 0.65 * atmo);
    const sc = U.uSunColor.value;
    sc.setRGB(1.0, lerp(0.97, 0.62, warm), lerp(0.92, 0.38, warm));
    const storm = u.uStorm.value;
    const cloud = U.uCloudCover.value;

    // night light: the giant's sunlit face when it is up, else starlight and airglow
    const gv = u.uGiant.value;
    this.shine = this.giantPhase * smoothstep(-0.04, 0.14, gv.y) * (1 - cloud * 0.5) * (1 - storm * 0.6);
    u.uShine.value = this.shine;
    const nd = this._nd.set(0.15, 1, 0.3).normalize().lerp(this.tmp.set(gv.x, Math.max(gv.y, 0.05), gv.z).normalize(), smoothstep(0.03, 0.2, this.shine)).normalize();
    const nightI = (0.55 + 0.55 * this.shine) * (1 - storm * 0.4);
    const sunI = 3.4 * day * vis * (1 - storm * 0.55) * (1 - u.uDust.value * 0.25);
    const w = clamp(sunI / Math.max(nightI, 1e-3) - 0.5, 0, 1);
    const ldir = this.tmp.copy(nd).lerp(sd, w).normalize();
    this.sun.position.copy(camPos).addScaledVector(ldir, 300);
    this.sun.intensity = sunI * w + nightI * (1 - w);
    const gs = smoothstep(0.05, 0.4, this.shine);
    this.sun.color.setRGB(lerp(0.52, 0.92, gs), lerp(0.62, 0.84, gs), lerp(0.95, 0.74, gs)).lerp(sc, w);
    this.sun.target.position.copy(camPos);
    // snap shadow camera to texels to avoid shimmering
    const ts = (this.sun.shadow.camera.right - this.sun.shadow.camera.left) / this.sun.shadow.mapSize.x;
    this.sun.target.position.x = Math.round(this.sun.target.position.x / ts) * ts;
    this.sun.target.position.z = Math.round(this.sun.target.position.z / ts) * ts;
    this.sun.position.x = this.sun.target.position.x + (this.sun.position.x - camPos.x);
    this.sun.position.z = this.sun.target.position.z + (this.sun.position.z - camPos.z);

    // sky fill: by day the air, by night a blue starlit dome
    this.hemi.intensity = lerp(0.6 + 0.18 * this.shine, 0.22 + 0.04 * day, dayV);
    this.hemi.color.setRGB(lerp(0.42, lerp(0.55, 0.45, atmo), dayV), lerp(0.5, lerp(0.4, 0.6, atmo), dayV), lerp(0.78, lerp(0.3, 0.85, atmo), dayV));
    this.hemi.groundColor.setRGB(lerp(0.2, 0.3, dayV), lerp(0.17, 0.18, dayV), lerp(0.16, 0.1, dayV));
    // eyes adapt to the dark
    this.adapt = lerp(this.adapt, 1 + 0.7 * (1 - dayV), Math.min(1, dt * 0.6));

    // fog parameters follow the atmosphere
    const f = this.fog;
    f.density = lerp(0.00017, 0.00014, atmo) * (1 + u.uDust.value * 2.2 + storm * 5.0) * (1 + (s.fog || 0) * 22);
    f.falloff = lerp(0.0021, 0.0027, atmo);
    const hz = (this._hz || (this._hz = new THREE.Vector3())).set(lerp(0.62, 0.55, atmo), lerp(0.40, 0.70, atmo), lerp(0.25, 0.86, atmo));
    f.color.setRGB(hz.x, hz.y, hz.z).multiplyScalar(lerp(0.015, 0.85, dayV));
    f.color.lerp(new THREE.Color(0.02 + 0.03 * this.shine, 0.026 + 0.035 * this.shine, 0.05 + 0.05 * this.shine), 1 - dayV);
    f.color.lerp(new THREE.Color(0.25, 0.27, 0.3).multiplyScalar(dayV), storm * 0.6);
    f.sunColor.copy(sc).multiplyScalar(dayV * lerp(0.5, 0.9, atmo));

    // camera white balance: partly neutralise the illuminant (sun + sky + red
    // ground bounce) so whites read white, like an auto-WB camera would
    const il = this._il || (this._il = new THREE.Vector3());
    il.set(sc.r * 0.62 + hz.x * 0.28 + 0.1 * 0.62, sc.g * 0.62 + hz.y * 0.28 + 0.1 * 0.38, sc.b * 0.62 + hz.z * 0.28 + 0.1 * 0.24);
    const lum = il.x * 0.2126 + il.y * 0.7152 + il.z * 0.0722;
    const k = 0.8 * dayV;
    U.uWB.value.set(lerp(1, lum / il.x, k), lerp(1, lum / il.y, k), lerp(1, lum / il.z, k));

    // environment map refresh when lighting changed enough
    this.envTimer -= dt;
    const key = [Math.round(elev * 40), Math.round(atmo * 20), Math.round(cloud * 10), Math.round(storm * 5), Math.round(this.shine * 8), Math.round(vis * 6)].join(',');
    if (this.envTimer <= 0 && key !== this.lastEnvKey) {
      this.refreshEnv();
      this.lastEnvKey = key;
      this.envTimer = 1.5;
    }
  }

  // the colony calendar counts seasons for the northern hemisphere
  season() {
    const l = ((this.orbits.out.lambda % TAU) + TAU) % TAU;
    return ['봄', '여름', '가을', '겨울'][Math.floor(l / (TAU / 4))];
  }

  // for the HUD and tests
  report() {
    const u = this.uniforms, C = this.orbits.out, deg = (r) => +(r * 180 / Math.PI).toFixed(1);
    const el = (v) => deg(Math.asin(clamp(v.y, -1, 1)));
    return {
      lat: deg(this.lat), decl: deg(C.decl), season: this.season(),
      sunEl: el(U.uSunDir.value), giantEl: el(u.uGiant.value), giantPhase: +this.giantPhase.toFixed(2), shine: +this.shine.toFixed(2),
      sunVis: +this.sunVis.toFixed(2), moonEl: [el(u.uMoonA.value), el(u.uMoonB.value)], moonR: [u.uMoonA.value.w, u.uMoonB.value.w].map((x) => deg(x)),
    };
  }

  refreshEnv() {
    const prev = this.envRT;
    const keep = this.uniforms.uCamPos.value.clone();
    this.uniforms.uCamPos.value.set(0, 0, 0);
    this.envDome.position.set(0, 0, 0);
    this.envRT = this.pmrem.fromScene(this.envScene, 0.02, 0.1, 10);
    this.scene.environment = this.envRT.texture;
    this.uniforms.uCamPos.value.copy(keep);
    if (prev) prev.dispose();
  }
}
