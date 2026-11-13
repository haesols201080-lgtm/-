// Global atmosphere state: time of day, sun/moon, fog, cloud deck, shared uniforms + GLSL.
import * as THREE from 'three';
import { clamp, lerp, smooth } from '../core/rng.js';

export const CLOUD_BASE = 930, CLOUD_TOP = 1260;
export const WORLD_EXTENT = 9600; // metres covered by the light-field texture (centred on origin)

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const col = (r, g, b) => new THREE.Color(r, g, b);

// Uniform objects are shared by reference between every material / pass.
export const U = {
  uTime: { value: 0 },
  uSunDir: { value: v3(0.3, 0.8, 0.2).normalize() },      // key light direction (sun or moon)
  uSunColor: { value: col(1, 1, 1) },                      // key light radiance above the cloud deck
  uTrueSunDir: { value: v3(0.3, 0.8, 0.2).normalize() },   // actual sun (for sky / scattering)
  uMoonDir: { value: v3(-0.3, 0.6, -0.2).normalize() },
  uFogLow: { value: col(0.02, 0.03, 0.05) },
  uFogHigh: { value: col(0.1, 0.15, 0.3) },
  uFogParams: { value: new THREE.Vector4(0.00035, 1 / 300, 0.000022, 6) }, // d0, 1/H, d1, scatter power
  uSunScatter: { value: col(0.5, 0.3, 0.1) },
  uCloud: { value: new THREE.Vector4(CLOUD_BASE, CLOUD_TOP, 0.06, 0.72) }, // base, top, sun transmit, coverage
  uAmbSky: { value: col(0.05, 0.07, 0.1) },
  uAmbGround: { value: col(0.02, 0.02, 0.02) },
  uSkyZenith: { value: col(0.02, 0.05, 0.15) },
  uSkyHorizon: { value: col(0.2, 0.3, 0.5) },
  uLightMap: { value: null },
  uLightMapInfo: { value: new THREE.Vector4(1 / WORLD_EXTENT, 0.5, 7, 13) }, // 1/extent, offset, glow height, falloff
  uNight: { value: 1 },
  uWet: { value: 0.85 },
  uRain: { value: 0.7 },
  uGlowFog: { value: 0.8 },
  uFlash: { value: new THREE.Vector4(0, 0, 0, 0) }, // lightning: x,z, radius, intensity
  uNoiseTex: { value: null },
  uProbe: { value: null },
  uProbeMix: { value: 0 },
  uInterior: { value: 0 },
  uLGrid: { value: null },
};

// GLSL shared by all world shaders (materials + post passes).
export const NS_COMMON = /* glsl */ `
uniform float uTime;
uniform vec3 uSunDir; uniform vec3 uSunColor; uniform vec3 uTrueSunDir; uniform vec3 uMoonDir;
uniform vec3 uFogLow; uniform vec3 uFogHigh; uniform vec4 uFogParams; uniform vec3 uSunScatter;
uniform vec4 uCloud; uniform vec3 uAmbSky; uniform vec3 uAmbGround;
uniform sampler2D uLightMap; uniform vec4 uLightMapInfo;
uniform float uNight; uniform float uWet; uniform float uRain; uniform float uGlowFog; uniform vec4 uFlash;
uniform sampler2D uNoiseTex;

float nsHash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float nsHash3(vec3 p){ p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.x + p.y) * p.z); }
vec2 nsHash22(vec2 p){ vec3 a = fract(p.xyx * vec3(0.1031, 0.1030, 0.0973)); a += dot(a, a.yzx + 33.33); return fract((a.xx + a.yz) * a.zy); }
vec4 nsNoise(vec2 uv){ return texture2D(uNoiseTex, uv); }

// rgb = neon / street light irradiance, a = sky openness (1 = open sky)
vec4 nsLightField(vec3 wp, float lod){
  vec2 uv = wp.xz * uLightMapInfo.x + uLightMapInfo.y;
  return textureLod(uLightMap, uv, lod);
}
float nsSunVis(float y){ return mix(uCloud.z, 1.0, smoothstep(uCloud.x, uCloud.y + 60.0, y)); }

// analytic height fog optical depth between camera and a world position
float nsFogOD(vec3 cam, vec3 wp){
  vec3 v = wp - cam; float L = length(v);
  float k = uFogParams.y; float dy = v.y;
  float e0 = exp(-k * max(cam.y, -50.0));
  float kd = k * dy;
  float f = abs(kd) > 1e-3 ? (1.0 - exp(-kd)) / kd : 1.0 - 0.5 * kd;
  return L * (uFogParams.z + uFogParams.x * e0 * f);
}
vec3 nsFogColor(vec3 cam, vec3 wp, vec3 dir){
  float my = mix(cam.y, wp.y, 0.35);
  float hi = smoothstep(uCloud.x - 250.0, uCloud.y + 150.0, my);
  vec3 c = mix(uFogLow, uFogHigh, hi);
  float sd = max(dot(dir, uTrueSunDir), 0.0);
  float sc = pow(sd, uFogParams.w) * 0.85 + pow(sd, 48.0) * 1.4 + 0.12;
  c += uSunScatter * sc * mix(1.0, 0.35, hi);
  // coloured haze above neon districts (low mips of the light field)
  float Lr = length(wp - cam);
  vec3 g1p = cam + dir * min(Lr * 0.3, 420.0); vec3 g2p = cam + dir * min(Lr * 0.72, 2400.0);
  vec3 glow = nsLightField(g1p, 5.0).rgb * exp(-max(g1p.y, 0.0) / 260.0) * 0.5 + nsLightField(g2p, 6.8).rgb * (0.25 + 0.75 * exp(-max(g2p.y, 0.0) / 420.0)) * 0.7;
  // a city's sky glow is the sum of thousands of lamps: mostly warm, only tinted by the local neon
  glow = mix(glow, dot(glow, vec3(0.3333)) * vec3(1.22, 0.88, 0.66), 0.6);
  c += glow * uGlowFog;
  return c;
}
vec3 nsApplyFog(vec3 color, vec3 cam, vec3 wp){
  vec3 v = wp - cam; float L = max(length(v), 1e-3);
  float T = exp(-nsFogOD(cam, wp));
  return mix(nsFogColor(cam, wp, v / L), color, T);
}
`;

// ---- time-of-day palette -------------------------------------------------------------------
// each key: hour, fogLow, fogHigh, sunColor(above clouds), scatter, ambSky, ambGround, zenith, horizon, night, cloudTransmit
const K = (h, o) => ({ h, ...o });
const KEYS = [
  K(0, { fogLow: [0.010, 0.017, 0.030], fogHigh: [0.006, 0.010, 0.022], sun: [0.10, 0.14, 0.24], scat: [0.010, 0.016, 0.030], ambS: [0.016, 0.026, 0.048], ambG: [0.010, 0.010, 0.012], zen: [0.002, 0.004, 0.012], hor: [0.012, 0.022, 0.05], night: 1, ct: 0.25, d0: 0.00038 }),
  K(4.6, { fogLow: [0.012, 0.018, 0.032], fogHigh: [0.008, 0.012, 0.026], sun: [0.10, 0.14, 0.24], scat: [0.012, 0.018, 0.030], ambS: [0.018, 0.028, 0.05], ambG: [0.010, 0.010, 0.012], zen: [0.003, 0.006, 0.018], hor: [0.02, 0.03, 0.06], night: 1, ct: 0.25, d0: 0.00038 }),
  K(6.0, { fogLow: [0.10, 0.060, 0.050], fogHigh: [0.30, 0.17, 0.14], sun: [2.6, 1.05, 0.40], scat: [0.55, 0.20, 0.07], ambS: [0.10, 0.08, 0.10], ambG: [0.035, 0.022, 0.018], zen: [0.06, 0.10, 0.26], hor: [0.95, 0.42, 0.20], night: 0.75, ct: 0.10, d0: 0.00043 }),
  K(8.0, { fogLow: [0.30, 0.25, 0.20], fogHigh: [0.42, 0.50, 0.62], sun: [5.2, 4.1, 3.0], scat: [0.50, 0.36, 0.22], ambS: [0.36, 0.38, 0.42], ambG: [0.10, 0.09, 0.08], zen: [0.10, 0.24, 0.62], hor: [0.62, 0.70, 0.82], night: 0.12, ct: 0.07, d0: 0.00031 }),
  K(12.5, { fogLow: [0.40, 0.37, 0.31], fogHigh: [0.48, 0.60, 0.80], sun: [6.4, 5.9, 5.2], scat: [0.40, 0.36, 0.30], ambS: [0.50, 0.54, 0.60], ambG: [0.13, 0.12, 0.10], zen: [0.07, 0.20, 0.62], hor: [0.55, 0.70, 0.92], night: 0.0, ct: 0.08, d0: 0.00026 }),
  K(16.0, { fogLow: [0.44, 0.33, 0.22], fogHigh: [0.52, 0.56, 0.66], sun: [6.0, 4.7, 3.2], scat: [0.62, 0.40, 0.20], ambS: [0.44, 0.42, 0.42], ambG: [0.12, 0.10, 0.08], zen: [0.08, 0.19, 0.55], hor: [0.72, 0.66, 0.66], night: 0.05, ct: 0.08, d0: 0.00031 }),
  K(18.0, { fogLow: [0.42, 0.19, 0.055], fogHigh: [0.52, 0.26, 0.14], sun: [4.6, 1.55, 0.42], scat: [1.25, 0.46, 0.085], ambS: [0.22, 0.13, 0.085], ambG: [0.06, 0.032, 0.018], zen: [0.07, 0.10, 0.30], hor: [1.25, 0.50, 0.14], night: 0.45, ct: 0.12, d0: 0.00053 }),
  K(19.3, { fogLow: [0.075, 0.042, 0.050], fogHigh: [0.12, 0.07, 0.11], sun: [0.9, 0.30, 0.16], scat: [0.30, 0.10, 0.06], ambS: [0.045, 0.04, 0.06], ambG: [0.016, 0.012, 0.014], zen: [0.012, 0.018, 0.07], hor: [0.34, 0.12, 0.10], night: 0.9, ct: 0.14, d0: 0.00043 }),
  K(20.6, { fogLow: [0.011, 0.018, 0.032], fogHigh: [0.007, 0.011, 0.024], sun: [0.10, 0.14, 0.24], scat: [0.012, 0.018, 0.032], ambS: [0.016, 0.026, 0.048], ambG: [0.010, 0.010, 0.012], zen: [0.002, 0.004, 0.012], hor: [0.012, 0.022, 0.05], night: 1, ct: 0.25, d0: 0.00038 }),
  K(24, { fogLow: [0.010, 0.017, 0.030], fogHigh: [0.006, 0.010, 0.022], sun: [0.10, 0.14, 0.24], scat: [0.010, 0.016, 0.030], ambS: [0.016, 0.026, 0.048], ambG: [0.010, 0.010, 0.012], zen: [0.002, 0.004, 0.012], hor: [0.012, 0.022, 0.05], night: 1, ct: 0.25, d0: 0.00038 }),
];
const tmp = {};
function sample(hour) {
  let i = 0; while (i < KEYS.length - 2 && KEYS[i + 1].h <= hour) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  let t = clamp((hour - a.h) / (b.h - a.h), 0, 1); t = t * t * (3 - 2 * t);
  for (const k in a) {
    if (k === 'h') continue;
    if (Array.isArray(a[k])) { tmp[k] = tmp[k] || [0, 0, 0]; for (let j = 0; j < 3; j++) tmp[k][j] = lerp(a[k][j], b[k][j], t); }
    else tmp[k] = lerp(a[k], b[k], t);
  }
  return tmp;
}

export const env = {
  hour: 21.5,          // 0..24
  dayLength: 1440,     // real seconds per in-game day
  paused: false,
  weather: { rain: 0.7, target: 0.7, storm: 0, timer: 40 },
  sunElev: 0,
  isDay: false,
  exposureBias: 1,
  flashT: 0,

  setHour(h) { this.hour = ((h % 24) + 24) % 24; this.update(0, null); },

  update(dt, camPos) {
    if (!this.paused) this.hour = (this.hour + (dt * 24) / this.dayLength) % 24;
    U.uTime.value += dt;
    const h = this.hour;
    const a = ((h - 6) / 12) * Math.PI;
    const sun = U.uTrueSunDir.value.set(Math.cos(a), Math.sin(a), 0.42).normalize();
    U.uMoonDir.value.set(-Math.cos(a) * 0.8, Math.max(0.25, -Math.sin(a)) , -0.5).normalize();
    this.sunElev = sun.y;
    this.isDay = sun.y > -0.02;
    const s = sample(h);
    // key light: sun while above the horizon, otherwise the moon
    if (sun.y > -0.06) U.uSunDir.value.copy(sun); else U.uSunDir.value.copy(U.uMoonDir.value);
    if (U.uSunDir.value.y < 0.06) { U.uSunDir.value.y = 0.06; U.uSunDir.value.normalize(); }
    U.uSunColor.value.setRGB(s.sun[0], s.sun[1], s.sun[2]);
    U.uFogLow.value.setRGB(s.fogLow[0], s.fogLow[1], s.fogLow[2]);
    U.uFogHigh.value.setRGB(s.fogHigh[0], s.fogHigh[1], s.fogHigh[2]);
    U.uSunScatter.value.setRGB(s.scat[0], s.scat[1], s.scat[2]);
    U.uAmbSky.value.setRGB(s.ambS[0], s.ambS[1], s.ambS[2]);
    U.uAmbGround.value.setRGB(s.ambG[0], s.ambG[1], s.ambG[2]);
    U.uSkyZenith.value.setRGB(s.zen[0], s.zen[1], s.zen[2]);
    U.uSkyHorizon.value.setRGB(s.hor[0], s.hor[1], s.hor[2]);
    U.uNight.value = s.night;
    U.uCloud.value.z = s.ct;

    // weather drift
    const w = this.weather;
    if (dt > 0) {
      w.timer -= dt;
      if (w.timer <= 0) { w.timer = 60 + Math.random() * 150; const r = Math.random(); w.target = r < 0.3 ? 0 : r < 0.65 ? 0.45 : 1; w.storm = w.target > 0.9 && Math.random() < 0.6 ? 1 : 0; }
      w.rain += clamp(w.target - w.rain, -dt * 0.03, dt * 0.03);
      // lightning
      this.flashT -= dt;
      if (w.storm && w.rain > 0.6 && this.flashT < -2 - Math.random() * 9) {
        this.flashT = 0.35;
        const ang = Math.random() * 6.283, r = 600 + Math.random() * 3500;
        const cx = camPos ? camPos.x : 0, cz = camPos ? camPos.z : 0;
        U.uFlash.value.set(cx + Math.cos(ang) * r, cz + Math.sin(ang) * r, 900 + Math.random() * 1500, 1);
      }
      const ft = this.flashT;
      U.uFlash.value.w = ft > 0 ? (Math.sin(ft * 60) * 0.5 + 0.5) * smooth(0, 0.35, ft) * 1.0 + (ft > 0.3 ? 1 : 0) : 0;
    }
    U.uRain.value = w.rain;
    U.uWet.value = clamp(lerp(U.uWet.value, w.rain > 0.05 ? 1 : 0.25, dt * 0.02 + (dt === 0 ? 1 : 0)), 0, 1);
    U.uFogParams.value.x = s.d0 * (1 + w.rain * 0.45);
  },
};

// ---- sky dome ------------------------------------------------------------------------------
export function createSky() {
  const geo = new THREE.SphereGeometry(1, 48, 24);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
    uniforms: { ...U, uSkyScale: { value: 1 } },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main(){ vDir = position; vec4 p = modelViewMatrix * vec4(position, 0.0); gl_Position = projectionMatrix * vec4(p.xyz, 1.0); gl_Position.z = gl_Position.w; }
    `,
    fragmentShader: /* glsl */ `
      ${NS_COMMON}
      uniform vec3 uSkyZenith; uniform vec3 uSkyHorizon;
      varying vec3 vDir;
      float stars(vec3 d){
        vec3 p = d * 220.0; vec3 ip = floor(p); vec3 fp = fract(p) - 0.5;
        float h = nsHash3(ip);
        float s = smoothstep(0.985, 1.0, h) * smoothstep(0.35, 0.0, length(fp));
        return s * (0.5 + 0.5 * sin(uTime * (1.0 + h * 3.0) + h * 40.0));
      }
      void main(){
        vec3 d = normalize(vDir);
        float up = max(d.y, 0.0);
        vec3 sky = mix(uSkyHorizon, uSkyZenith, pow(up, 0.42));
        float sd = max(dot(d, uTrueSunDir), 0.0);
        float sunUp = smoothstep(-0.08, 0.05, uTrueSunDir.y);
        // sun disc + mie halo
        vec3 sunTint = mix(vec3(1.0, 0.42, 0.12), vec3(1.0, 0.93, 0.82), smoothstep(0.0, 0.35, uTrueSunDir.y));
        sky += sunTint * (smoothstep(0.9994, 0.99975, sd) * 60.0 + pow(sd, 900.0) * 6.0 + pow(sd, 60.0) * 0.55 + pow(sd, 8.0) * 0.16) * sunUp;
        // moon
        float md = max(dot(d, uMoonDir), 0.0);
        float moon = smoothstep(0.99955, 0.9997, md);
        vec3 mcol = vec3(0.75, 0.85, 1.0) * (0.75 + 0.25 * nsNoise(d.xy * 28.0).r);
        sky += (mcol * moon * 2.2 + vec3(0.25, 0.35, 0.6) * pow(md, 120.0) * 0.35) * uNight;
        sky += vec3(0.8, 0.9, 1.0) * stars(d) * uNight * 1.6 * smoothstep(0.02, 0.3, d.y);
        // horizon haze consistent with scene fog
        vec3 far = cameraPosition + d * (42000.0 / (1.0 + max(d.y, 0.0) * 28.0));
        if (d.y < 0.0) far = cameraPosition + d * min(42000.0, (cameraPosition.y + 30.0) / max(-d.y, 1e-4));
        vec3 c = nsApplyFog(sky, cameraPosition, far);
        gl_FragColor = vec4(c, 0.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false; mesh.renderOrder = -1000; mesh.matrixAutoUpdate = false;
  mesh.name = 'sky';
  return mesh;
}

// tileable RGBA noise texture (value noise, 4 decorrelated channels, several octaves)
export function createNoiseTexture(size = 256) {
  const data = new Uint8Array(size * size * 4);
  const lat = (period, seed) => {
    const g = new Float32Array(period * period);
    let s = seed >>> 0;
    for (let i = 0; i < g.length; i++) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; g[i] = s / 4294967296; }
    return g;
  };
  for (let c = 0; c < 4; c++) {
    const octs = [];
    for (let o = 0; o < 6; o++) octs.push({ p: 4 << o, g: lat(4 << o, 1337 + c * 101 + o * 7), a: Math.pow(0.55, o) });
    let norm = 0; for (const o of octs) norm += o.a;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      let v = 0;
      for (const o of octs) {
        const fx = (x / size) * o.p, fy = (y / size) * o.p;
        const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
        const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
        const x1 = (x0 + 1) % o.p, y1 = (y0 + 1) % o.p;
        const a = o.g[y0 * o.p + x0], b = o.g[y0 * o.p + x1], cc = o.g[y1 * o.p + x0], d = o.g[y1 * o.p + x1];
        v += o.a * (a + (b - a) * sx + (cc - a) * sy + (a - b - cc + d) * sx * sy);
      }
      data[(y * size + x) * 4 + c] = Math.max(0, Math.min(255, (v / norm) * 255));
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true; tex.needsUpdate = true;
  return tex;
}
