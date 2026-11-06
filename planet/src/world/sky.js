// Atmosphere: analytic sky dome (thin dusty sky -> blue sky as pressure
// rises), sun/moon/stars, a ringed gas giant, a procedural cloud deck, the
// day/night cycle and the lights + environment map that follow from it.
import * as THREE from 'three';
import { U, WORLD } from '../core/shared.js';
import { clamp, lerp, smoothstep } from '../core/noise.js';

export const SKY_GLSL = /* glsl */`
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uMoonDir;
uniform float uAtmo;      // 0 thin dusty air .. 1 full atmosphere
uniform float uDust;      // airborne dust haze
uniform float uCloudCover;
uniform float uCloudTime;
uniform float uStorm;     // dark rain clouds
uniform float uTimeS;
uniform sampler2D tNoise;
uniform vec3 uCamPos;
uniform float uDip;       // horizon dip from planet curvature at the camera altitude

float hash13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }

vec3 skyBase(vec3 d) {
  float sunE = uSunDir.y;
  float day = smoothstep(-0.16, 0.12, sunE);
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
  // night sky glow
  vec3 night = mix(vec3(0.006, 0.008, 0.016), vec3(0.012, 0.02, 0.05), h);
  col += night * (1.0 - day);
  // sun glow (mie)
  col += uSunColor * (pow(sd, 6.0) * mix(0.12, 0.35, uAtmo) + pow(sd, 90.0) * 0.8 + uDust * pow(sd, 3.0) * 0.25) * day;
  return col;
}

vec3 starField(vec3 d) {
  vec3 p = d * 260.0;
  vec3 c = floor(p);
  float h = hash13(c);
  if (h < 0.985) return vec3(0.0);
  vec3 sp = c + vec3(hash13(c + 1.7), hash13(c + 4.3), hash13(c + 9.1));
  float dd = length(p - sp);
  float b = smoothstep(0.55, 0.0, dd) * pow((h - 0.985) / 0.015, 2.0);
  float tw = 0.75 + 0.25 * sin(uTimeS * (2.0 + h * 9.0) + h * 40.0);
  vec3 tint = mix(vec3(0.7, 0.8, 1.0), vec3(1.0, 0.85, 0.7), hash13(c + 2.2));
  return tint * b * tw * 3.0;
}

// ringed gas giant fixed in the sky
vec4 gasGiant(vec3 d) {
  vec3 P = normalize(vec3(-0.55, 0.38, -0.74));
  float r = 0.13;
  vec3 axis = normalize(vec3(0.25, 1.0, 0.35));
  vec4 res = vec4(0.0);
  float b = dot(d, P);
  float c = 1.0 - r * r;
  float disc = b * b - c;
  float tPlanet = 1e9;
  if (disc > 0.0 && b > 0.0) {
    tPlanet = b - sqrt(disc);
    vec3 hit = d * tPlanet;
    vec3 n = normalize(hit - P);
    float lat = dot(n, axis);
    float lon = atan(dot(n, normalize(cross(axis, vec3(0.0, 0.0, 1.0)))), dot(n, cross(axis, normalize(cross(axis, vec3(0.0, 0.0, 1.0))))));
    float bands = texture2D(tNoise, vec2(lon * 0.05 + uTimeS * 0.0004, lat * 2.4)).r;
    float bands2 = texture2D(tNoise, vec2(lon * 0.2, lat * 9.0)).g;
    vec3 base = mix(vec3(0.75, 0.55, 0.38), vec3(0.95, 0.85, 0.68), smoothstep(0.3, 0.7, bands));
    base = mix(base, vec3(0.55, 0.32, 0.22), smoothstep(0.55, 0.8, bands2) * 0.5);
    float lit = smoothstep(-0.15, 0.35, dot(n, uSunDir));
    float rim = pow(1.0 - max(dot(n, -d), 0.0), 3.0);
    vec3 col = base * (lit * 1.25 + 0.025) + vec3(0.9, 0.7, 0.5) * rim * lit * 0.4;
    res = vec4(col, smoothstep(0.0, 0.002, disc));
  }
  // rings
  float denom = dot(d, axis);
  if (abs(denom) > 1e-4) {
    float t = dot(P, axis) / denom;
    if (t > 0.0) {
      vec3 q = d * t - P;
      float rr = length(q) / r;
      if (rr > 1.35 && rr < 2.35 && (t < tPlanet || res.a < 0.5)) {
        float band = texture2D(tNoise, vec2(rr * 0.9, 0.5)).r;
        float a = smoothstep(1.35, 1.45, rr) * (1.0 - smoothstep(2.2, 2.35, rr)) * (0.35 + 0.65 * band);
        a *= 1.0 - smoothstep(1.86, 1.9, rr) * (1.0 - smoothstep(1.94, 1.98, rr)) * 0.9;
        vec3 rc = mix(vec3(0.75, 0.68, 0.6), vec3(0.95, 0.9, 0.82), band);
        float lit = 0.35 + 0.65 * max(dot(axis, uSunDir) * sign(dot(axis, -d)) * -1.0 + 0.6, 0.0);
        res.rgb = mix(res.rgb, rc * lit, a * 0.85);
        res.a = max(res.a, a * 0.85);
      }
    }
  }
  return res;
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
  float day = smoothstep(-0.12, 0.15, uSunDir.y);
  vec3 lit = mix(vec3(0.55, 0.58, 0.66), vec3(1.25, 1.18, 1.08), shade) * uSunColor;
  lit = mix(lit, lit * vec3(1.0, 0.7, 0.5), (1.0 - smoothstep(0.0, 0.3, uSunDir.y)) * uAtmo);
  lit = mix(lit, vec3(0.24, 0.26, 0.3), uStorm * 0.75);
  vec3 col = lit * mix(0.025, 1.0, day);
  float fade = smoothstep(0.02, 0.18, d.y) * (1.0 - smoothstep(9000.0, 26000.0, t));
  return vec4(col, dens * fade);
}

vec3 skyColor(vec3 d, vec3 ro) {
  vec3 col = skyBase(d);
  float day = smoothstep(-0.16, 0.12, uSunDir.y);
  // stars only once the sky is dark: even a thin dusty atmosphere outshines them by day
  float starVis = clamp(1.0 - day * 1.6, 0.0, 1.0) * (1.0 - uCloudCover * 0.6);
  if (d.y > -0.05) col += starField(d) * starVis;
  vec4 gg = gasGiant(d);
  float ggVis = mix(1.0, 0.45, day * uAtmo);
  col = mix(col, gg.rgb + col * 0.25, gg.a * ggVis);
  // small moon
  float md = dot(d, uMoonDir);
  float moon = smoothstep(0.99955, 0.99965, md);
  col = mix(col, vec3(0.85, 0.82, 0.78) * (0.4 + 0.6 * (1.0 - day * uAtmo * 0.5)), moon);
  // sun disc
  float sd = dot(d, uSunDir);
  col += uSunColor * smoothstep(0.99988, 0.99994, sd) * 60.0 * smoothstep(-0.05, 0.02, uSunDir.y);
  vec4 cl = cloudLayer(d, ro);
  col = mix(col, cl.rgb, cl.a);
  // ground below the horizon fades to a dark haze
  float below = smoothstep(-uDip, -uDip - 0.12, d.y);
  col = mix(col, skyBase(vec3(d.x, -uDip + 0.01, d.z)) * 0.85, below);
  return col;
}
`;

export class Sky {
  constructor(renderer, scene) {
    this.renderer = renderer;
    this.scene = scene;
    this.uniforms = {
      uSunDir: U.uSunDir,
      uSunColor: U.uSunColor,
      uMoonDir: { value: new THREE.Vector3(0.3, 0.5, 0.8).normalize() },
      uAtmo: { value: 0 },
      uDust: { value: 0.4 },
      uCloudCover: U.uCloudCover,
      uCloudTime: U.uCloudTime,
      uStorm: { value: 0 },
      uTimeS: U.uTime,
      tNoise: U.tNoise,
      uCamPos: { value: new THREE.Vector3() },
      uDip: { value: 0 },
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

    this.time = 0.36;        // fraction of a day; 0.25 sunrise, 0.5 noon
    this.dayLength = 1080;   // seconds per day
    this.day = 1;
    this.state = { atmo: 0, dust: 0.4, cloud: 0, storm: 0 };
    this.fog = { density: 0.0012, falloff: 0.012, color: new THREE.Color(), sunColor: new THREE.Color() };
    this.tmp = new THREE.Vector3();
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

  update(dt, camPos) {
    this.time += dt / this.dayLength;
    if (this.time >= 1) { this.time -= 1; this.day++; }
    const a = (this.time - 0.25) * Math.PI * 2;
    const inc = 0.42;
    const sd = U.uSunDir.value.set(Math.cos(a), Math.sin(a) * Math.cos(inc) + 0.14, Math.sin(a) * Math.sin(inc) * 0.6 - 0.25).normalize();
    const md = this.uniforms.uMoonDir.value.set(-Math.cos(a * 0.93 + 2.4), 0.35 + 0.4 * Math.sin(a * 0.93 + 2.4), 0.6).normalize();

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
    const day = smoothstep(-0.12, 0.1, elev);
    U.uNight.value = 1 - day;
    // sun colour: white-hot in thin air, warm near the horizon in thick air
    const warm = (1 - smoothstep(0.0, 0.45, elev)) * (0.35 + 0.65 * atmo);
    const sc = U.uSunColor.value;
    sc.setRGB(1.0, lerp(0.97, 0.62, warm), lerp(0.92, 0.38, warm));
    const storm = u.uStorm.value;

    // directional light = sun by day, moon by night
    const moonUp = md.y > 0;
    if (day > 0.02) {
      this.sun.position.copy(camPos).addScaledVector(sd, 300);
      this.sun.color.copy(sc);
      this.sun.intensity = 3.4 * day * (1 - storm * 0.55) * (1 - u.uDust.value * 0.25);
    } else {
      this.sun.position.copy(camPos).addScaledVector(moonUp ? md : this.tmp.set(0.2, 1, 0.3).normalize(), 300);
      this.sun.color.setRGB(0.55, 0.65, 0.95);
      this.sun.intensity = 0.55;
    }
    this.sun.target.position.copy(camPos);
    // snap shadow camera to texels to avoid shimmering
    const ts = (this.sun.shadow.camera.right - this.sun.shadow.camera.left) / this.sun.shadow.mapSize.x;
    this.sun.target.position.x = Math.round(this.sun.target.position.x / ts) * ts;
    this.sun.target.position.z = Math.round(this.sun.target.position.z / ts) * ts;
    this.sun.position.x = this.sun.target.position.x + (this.sun.position.x - camPos.x);
    this.sun.position.z = this.sun.target.position.z + (this.sun.position.z - camPos.z);

    this.hemi.intensity = 0.22 + 0.04 * day;
    this.hemi.color.setRGB(lerp(0.55, 0.45, atmo), lerp(0.4, 0.6, atmo), lerp(0.3, 0.85, atmo));
    this.hemi.groundColor.setRGB(0.3, 0.18, 0.1);

    // fog parameters follow the atmosphere
    const f = this.fog;
    f.density = lerp(0.00017, 0.00014, atmo) * (1 + u.uDust.value * 3.2 + storm * 5.0) * (1 + (s.fog || 0) * 22);
    f.falloff = lerp(0.0021, 0.0027, atmo);
    const hz = this.tmp;
    hz.set(lerp(0.62, 0.55, atmo), lerp(0.40, 0.70, atmo), lerp(0.25, 0.86, atmo));
    f.color.setRGB(hz.x, hz.y, hz.z).multiplyScalar(lerp(0.015, 0.85, day));
    f.color.lerp(new THREE.Color(0.012, 0.016, 0.03), 1 - day);
    f.color.lerp(new THREE.Color(0.25, 0.27, 0.3).multiplyScalar(day), storm * 0.6);
    f.sunColor.copy(sc).multiplyScalar(day * lerp(0.5, 0.9, atmo));

    // camera white balance: partly neutralise the illuminant (sun + sky + red
    // ground bounce) so whites read white, like an auto-WB camera would
    const il = this._il || (this._il = new THREE.Vector3());
    il.set(sc.r * 0.62 + hz.x * 0.28 + 0.1 * 0.62, sc.g * 0.62 + hz.y * 0.28 + 0.1 * 0.38, sc.b * 0.62 + hz.z * 0.28 + 0.1 * 0.24);
    const lum = il.x * 0.2126 + il.y * 0.7152 + il.z * 0.0722;
    const k = 0.8 * day;
    U.uWB.value.set(lerp(1, lum / il.x, k), lerp(1, lum / il.y, k), lerp(1, lum / il.z, k));

    // environment map refresh when lighting changed enough
    this.envTimer -= dt;
    const key = [Math.round(elev * 40), Math.round(atmo * 20), Math.round(U.uCloudCover.value * 10), Math.round(storm * 5)].join(',');
    if (this.envTimer <= 0 && key !== this.lastEnvKey) {
      this.refreshEnv();
      this.lastEnvKey = key;
      this.envTimer = 1.5;
    }
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
