// Volumetric cloud deck: 3D noise generation + raymarch shader (runs as a post pass against scene depth).
import * as THREE from 'three';
import { NS_COMMON } from './env.js';

function hash3i(x, y, z, s) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 2147483647) + Math.imul(s, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function worley(x, y, z, period, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  let md = 9;
  for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const cx = xi + dx, cy = yi + dy, cz = zi + dz;
    const wx = ((cx % period) + period) % period, wy = ((cy % period) + period) % period, wz = ((cz % period) + period) % period;
    const px = cx + hash3i(wx, wy, wz, seed), py = cy + hash3i(wx, wy, wz, seed + 1), pz = cz + hash3i(wx, wy, wz, seed + 2);
    const d = (px - x) * (px - x) + (py - y) * (py - y) + (pz - z) * (pz - z);
    if (d < md) md = d;
  }
  return 1 - Math.min(1, Math.sqrt(md));
}
function vnoise3(x, y, z, period, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const fx = x - xi, fy = y - yi, fz = z - zi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const W = (a) => ((a % period) + period) % period;
  const g = (a, b, c) => hash3i(W(xi + a), W(yi + b), W(zi + c), seed);
  const x00 = g(0, 0, 0) + (g(1, 0, 0) - g(0, 0, 0)) * u, x10 = g(0, 1, 0) + (g(1, 1, 0) - g(0, 1, 0)) * u;
  const x01 = g(0, 0, 1) + (g(1, 0, 1) - g(0, 0, 1)) * u, x11 = g(0, 1, 1) + (g(1, 1, 1) - g(0, 1, 1)) * u;
  const y0 = x00 + (x10 - x00) * v, y1 = x01 + (x11 - x01) * v;
  return y0 + (y1 - y0) * w;
}

export function createCloudNoise(size = 48) {
  const data = new Uint8Array(size * size * size * 2);
  let i = 0;
  for (let z = 0; z < size; z++) for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size, w = z / size;
    const p = vnoise3(u * 4, v * 4, w * 4, 4, 11) * 0.55 + vnoise3(u * 8, v * 8, w * 8, 8, 23) * 0.28 + vnoise3(u * 16, v * 16, w * 16, 16, 37) * 0.17;
    const w1 = worley(u * 4, v * 4, w * 4, 4, 5) * 0.6 + worley(u * 8, v * 8, w * 8, 8, 9) * 0.4;
    const w2 = worley(u * 6, v * 6, w * 6, 6, 41) * 0.6 + worley(u * 12, v * 12, w * 12, 12, 57) * 0.4;
    // perlin-worley: billowy base shape
    const pw = Math.max(0, Math.min(1, (p * 0.62 + w1 * 0.62) - 0.12));
    data[i++] = pw * 255; data[i++] = w2 * 255;
  }
  const tex = new THREE.Data3DTexture(data, size, size, size);
  tex.format = THREE.RGFormat; tex.type = THREE.UnsignedByteType;
  tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = tex.wrapR = THREE.RepeatWrapping; tex.unpackAlignment = 1; tex.needsUpdate = true;
  return tex;
}

export const CLOUD_FRAG = /* glsl */ `
precision highp float; precision highp sampler3D;
${NS_COMMON}
uniform sampler2D tDepth; uniform sampler3D uCloudNoise;
uniform mat4 uInvProj; uniform mat4 uInvView; uniform vec3 uCamPos; uniform vec2 uRes;
uniform vec3 uSkyZenith; uniform vec3 uSkyHorizon;
varying vec2 vUv;

float coverageAt(vec2 xz){
  vec2 q = xz * 0.000045 + vec2(uTime * 0.0006, uTime * 0.00021);
  float c = nsNoise(q).r * 0.62 + nsNoise(q * 3.1 + 0.37).g * 0.38;
  return c;
}
float cloudDensity(vec3 p, float cov, bool detail){
  float h = (p.y - uCloud.x) / (uCloud.y - uCloud.x);
  if (h < 0.0 || h > 1.0) return 0.0;
  // thick deck with a billowing top and ragged underside
  float thick = smoothstep(0.30, 0.78, cov * 0.55 + uCloud.w * 0.6);
  float top = mix(0.45, 1.0, thick);
  float prof = smoothstep(0.0, 0.16, h) * smoothstep(top, top * 0.55, h);
  vec3 w = vec3(uTime * 1.8, 0.0, uTime * 0.7);
  float n = texture(uCloudNoise, (p + w) * vec3(0.00085, 0.0017, 0.00085)).r;
  float d = prof * (0.35 + thick * 0.75) - (1.0 - n) * 0.62;
  if (detail && d > -0.12) {
    float dn = texture(uCloudNoise, (p + w * 1.6) * 0.0042).g;
    d -= (1.0 - dn) * 0.20 * (1.0 - clamp(d * 1.5, 0.0, 1.0));
  }
  return clamp(d * 2.2, 0.0, 1.0);
}
float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
float hg(float c, float g){ float g2 = g * g; return (1.0 - g2) / (12.566 * pow(1.0 + g2 - 2.0 * g * c, 1.5)); }

void main(){
  float depth = texture2D(tDepth, vUv).r;
  vec4 ndc = vec4(vUv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
  vec4 vp = uInvProj * ndc; vp /= vp.w;
  vec3 wp = (uInvView * vec4(vp.xyz, 1.0)).xyz;
  vec3 rd = wp - uCamPos; float sceneDist = length(rd); rd /= sceneDist;
  if (depth >= 0.99999) sceneDist = 1e9;

  float tA, tB;
  float y0 = uCloud.x, y1 = uCloud.y;
  if (abs(rd.y) < 1e-5) { if (uCamPos.y < y0 || uCamPos.y > y1) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; } tA = 0.0; tB = 1e9; }
  else { float ta = (y0 - uCamPos.y) / rd.y, tb = (y1 - uCamPos.y) / rd.y; tA = max(min(ta, tb), 0.0); tB = max(ta, tb); }
  float maxRange = 26000.0;
  tB = min(min(tB, sceneDist), tA + maxRange);
  if (tB <= tA) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }

  const int STEPS = NS_CLOUD_STEPS;
  float jitter = ign(gl_FragCoord.xy + fract(uTime) * 0.0);
  float T = 1.0; vec3 L = vec3(0.0); float tMean = 0.0; float wSum = 0.0;
  float cosS = dot(rd, uSunDir);
  float phase = mix(hg(cosS, 0.72), hg(cosS, -0.25), 0.35) * 12.566 * 0.55 + 0.45;
  float sunAbove = max(uSunDir.y, 0.1);
  float span = tB - tA;
  float prevT = tA;
  vec3 skyAmb = mix(uSkyHorizon, uSkyZenith, 0.45) * 0.55 + uAmbSky * 0.5;
  for (int i = 0; i < STEPS; i++) {
    float f = (float(i) + jitter) / float(STEPS);
    float t = tA + span * (span > 2500.0 ? f * f * (0.35 + 0.65 * f) + f * 0.08 : f) / (span > 2500.0 ? 1.08 : 1.0);
    float dt = max(t - prevT, 0.0) + (i == 0 ? span / float(STEPS) * 0.5 : 0.0); prevT = t;
    vec3 p = uCamPos + rd * t;
    float cov = coverageAt(p.xz);
    float d = cloudDensity(p, cov, t < 9000.0);
    if (d > 0.002) {
      float h = clamp((p.y - y0) / (y1 - y0), 0.0, 1.0);
      float sigma = d * 0.016;
      // sunlight: analytic optical depth to the deck top + one probe for self shadowing
      float dTop = (y1 - p.y) / sunAbove;
      float ds = cloudDensity(p + uSunDir * 70.0, cov, false);
      float odSun = (d * 0.35 + ds * 0.65) * 0.016 * min(dTop, 260.0) * 0.75;
      float Ts = exp(-odSun) * 0.9 + exp(-odSun * 0.22) * 0.18;
      vec3 sun = uSunColor * Ts * phase * (1.0 - exp(-d * 6.0) * 0.45);
      // ambient from the open sky above, city glow + ground haze from below
      vec3 amb = skyAmb * (0.25 + 0.75 * h * h) ;
      vec3 glow = nsLightField(p, 6.0).rgb * exp(-(p.y - y0) / 110.0) * 0.55;
      vec3 below = (uFogLow * 1.35 + glow) * (1.0 - h) * (1.0 - h);
      float fl = uFlash.w * exp(-dot(p.xz - uFlash.xy, p.xz - uFlash.xy) / (uFlash.z * uFlash.z));
      vec3 S = sun + amb + below + vec3(0.75, 0.85, 1.0) * fl * 9.0;
      float a = 1.0 - exp(-sigma * dt);
      L += T * a * S; tMean += T * a * t; wSum += T * a;
      T *= 1.0 - a;
      if (T < 0.012) { T = 0.0; break; }
    }
  }
  if (wSum > 1e-4) {
    float tm = tMean / wSum;
    vec3 pm = uCamPos + rd * tm;
    float fT = exp(-nsFogOD(uCamPos, pm));
    vec3 fc = nsFogColor(uCamPos, pm, rd);
    L = mix(fc * (1.0 - T), L, fT);
  }
  gl_FragColor = vec4(L, T);
}
`;
