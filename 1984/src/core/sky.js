// Sky dome, sun, ambient light, fog and the environment map, driven by the
// clock and the weather. London in 1984: a harsh blue April sky, grey rain,
// the golden evening of the countryside, the oppressive heat of Hate Week.
import * as THREE from 'three';

const skyVert = `
  varying vec3 vDir;
  void main(){
    vDir = normalize(position);
    vec4 p = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * p;
    gl_Position.z = gl_Position.w;
  }`;
const skyFrag = `
  uniform vec3 uZenith, uHorizon, uGround, uSunDir, uSunColor, uCloudLit, uCloudDark;
  uniform float uCloud, uTime, uSunSize, uNight;
  varying vec3 vDir;
  float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
    return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
  float fbm(vec2 p){ float s=0.0, a=0.5; for(int i=0;i<6;i++){ s+=a*n(p); p*=2.03; a*=0.5; } return s; }
  void main(){
    vec3 d = normalize(vDir);
    float y = d.y;
    vec3 col = mix(uHorizon, uZenith, pow(max(y, 0.0), 0.55));
    col = mix(col, uGround, smoothstep(0.0, -0.08, y));
    float sd = max(dot(d, uSunDir), 0.0);
    col += uSunColor * (pow(sd, 6.0) * 0.25 + pow(sd, 90.0) * 0.6) * (1.0 - uCloud * 0.7);
    col += uSunColor * smoothstep(1.0 - uSunSize, 1.0 - uSunSize * 0.6, sd) * 6.0 * (1.0 - uCloud * 0.95);
    if (y > 0.0) {
      vec2 uv = d.xz / (y + 0.12) * 1.4 + vec2(uTime * 0.008, uTime * 0.003);
      float c = fbm(uv);
      float c2 = fbm(uv * 2.0 + 3.1);
      float cov = smoothstep(1.0 - uCloud * 1.05, 1.0 - uCloud * 0.4 + 0.15, c * 0.75 + c2 * 0.35);
      vec3 cc = mix(uCloudDark, uCloudLit, clamp(c2 * 1.2 + sd * 0.4, 0.0, 1.0));
      col = mix(col, cc, cov * smoothstep(0.0, 0.12, y));
    }
    gl_FragColor = vec4(col, 1.0);
  }`;

export const WEATHER = {
  clear_cold: { cloud: 0.3, fog: 0.0018, sun: 1.0, warm: 0.0, rain: 0, wind: 1.0, sat: 0.66 },
  overcast: { cloud: 0.92, fog: 0.0026, sun: 0.22, warm: 0.0, rain: 0, wind: 0.6, sat: 0.6 },
  rain: { cloud: 1.0, fog: 0.0036, sun: 0.1, warm: 0.0, rain: 1, wind: 0.8, sat: 0.55 },
  golden: { cloud: 0.18, fog: 0.0011, sun: 1.15, warm: 1.0, rain: 0, wind: 0.3, sat: 0.95 },
  hot_haze: { cloud: 0.45, fog: 0.0032, sun: 0.8, warm: 0.55, rain: 0, wind: 0.2, sat: 0.62 },
};

const C = (h) => new THREE.Color(h);
const tmp = new THREE.Color();

function mixC(a, b, t) { return a.clone().lerp(b, Math.min(1, Math.max(0, t))); }

export class Atmosphere {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.uni = {
      uZenith: { value: C('#4f74a0') }, uHorizon: { value: C('#b6c2ca') }, uGround: { value: C('#4a4c4e') },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunColor: { value: C('#fff2dc') },
      uCloudLit: { value: C('#e6e6e2') }, uCloudDark: { value: C('#7c8288') },
      uCloud: { value: 0.3 }, uTime: { value: 0 }, uSunSize: { value: 0.0008 }, uNight: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({ uniforms: this.uni, vertexShader: skyVert, fragmentShader: skyFrag,
      side: THREE.BackSide, depthWrite: false, fog: false });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(1000, 48, 24), mat);
    this.dome.renderOrder = -10;
    this.dome.frustumCulled = false;
    scene.add(this.dome);

    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    const s = this.sun.shadow;
    s.mapSize.set(2048, 2048);
    s.camera.near = 1; s.camera.far = 600;
    const ext = 90;
    s.camera.left = -ext; s.camera.right = ext; s.camera.top = ext; s.camera.bottom = -ext;
    s.bias = -0.0004; s.normalBias = 0.04; s.radius = 2.5;
    scene.add(this.sun); scene.add(this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xb0c0d0, 0x403c38, 1.0);
    scene.add(this.hemi);
    this.fog = new THREE.FogExp2(0xb6c2ca, 0.002);
    scene.fog = this.fog;

    // environment map rendered from the dome alone
    this.envScene = new THREE.Scene();
    this.envDome = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), mat);
    this.envScene.add(this.envDome);
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envRT = null;
    this.lastEnvKey = '';

    this.weather = 'clear_cold';
    this.w = { ...WEATHER.clear_cold };
    this.minutes = 13 * 60;
    this.indoor = false;
    this.exposure = 1;
    this.searchlights = this.makeSearchlights();
  }

  makeSearchlights() {
    const g = new THREE.Group();
    const geo = new THREE.CylinderGeometry(0.5, 14, 420, 24, 1, true);
    geo.translate(0, 210, 0);
    const mat = new THREE.MeshBasicMaterial({ color: 0x9fb0c0, transparent: true, opacity: 0.045, blending: THREE.AdditiveBlending,
      depthWrite: false, side: THREE.DoubleSide, fog: false });
    const spots = [[-420, -380], [380, -460], [-520, 320], [460, 420], [60, -600]];
    for (const [x, z] of spots) {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, 0, z);
      m.userData.ph = Math.random() * 6;
      g.add(m);
    }
    g.visible = false;
    this.scene.add(g);
    return g;
  }

  setWeather(name, instant = false) {
    this.weather = name;
    this.target = WEATHER[name];
    if (instant) this.w = { ...this.target };
  }

  // Sun from the time of day: rises east (+x) around 06:00, sets west around 20:00.
  sunDirection(minutes, out) {
    const t = (minutes - 360) / 840;
    const a = Math.PI * t;
    const elev = Math.sin(Math.PI * t) * 0.85;
    out.set(Math.cos(a) * Math.cos(elev), Math.sin(elev), Math.sin(a) * Math.cos(elev) * 0.8 + 0.3).normalize();
    if (t < 0 || t > 1) out.y = -0.2 - Math.abs(t < 0 ? t : t - 1);
    return out;
  }

  update(dt, camPos, minutes) {
    this.minutes = minutes;
    if (this.indoor) { this.uni.uTime.value += dt; this.maybeBakeProbe(camPos); return; }
    const w = this.w, T = this.target || WEATHER[this.weather];
    const k = Math.min(1, dt * 0.15);
    for (const key in T) w[key] += (T[key] - w[key]) * k;
    this.uni.uTime.value += dt;
    this.dome.position.copy(camPos);

    const dir = this.sunDirection(minutes, new THREE.Vector3());
    const elev = dir.y;
    const day = THREE.MathUtils.smoothstep(elev, -0.12, 0.12);
    const dusk = 1 - THREE.MathUtils.smoothstep(Math.abs(elev - 0.06), 0.0, 0.22);
    this.uni.uSunDir.value.copy(dir);

    const cloud = w.cloud;
    // palette by weather, then darkened toward night
    let zen = mixC(C('#4a6f9c'), C('#7e868e'), cloud);
    let hor = mixC(C('#b4c0c8'), C('#a2a6a8'), cloud);
    if (w.warm > 0.01) { zen = mixC(zen, C('#6a8cb0'), w.warm * 0.4); hor = mixC(hor, C('#e0c49a'), w.warm * 0.55); }
    hor = mixC(hor, C('#c98c5c'), dusk * (1 - cloud * 0.6) * 0.8);
    zen = mixC(C('#05070c'), zen, day);
    hor = mixC(C('#151820'), hor, day);
    this.uni.uZenith.value.copy(zen);
    this.uni.uHorizon.value.copy(hor);
    this.uni.uGround.value.copy(hor).multiplyScalar(0.35);
    this.uni.uCloud.value = cloud;
    this.uni.uCloudLit.value.copy(mixC(C('#262a30'), mixC(C('#ecebe6'), C('#e8b888'), dusk * 0.7), day));
    this.uni.uCloudDark.value.copy(mixC(C('#0c0e12'), mixC(C('#8a9096'), C('#5a5e64'), cloud), day));
    const sunCol = mixC(C('#fff3e0'), C('#ff9a5a'), dusk);
    if (w.warm > 0) sunCol.lerp(C('#ffd29a'), w.warm * 0.4);
    this.uni.uSunColor.value.copy(sunCol).multiplyScalar(day);

    // lights
    // direct sun dominates on clear days so shadows read; sky light comes
    // mostly from the environment map
    const sunI = day * w.sun * (1 - cloud * 0.6) * 5.5;
    this.sun.intensity = Math.max(sunI, (1 - day) * 0.18);
    this.sun.color.copy(day > 0.05 ? sunCol : C('#8090b0'));
    const lightDir = day > 0.05 ? dir : new THREE.Vector3(-0.3, 0.8, 0.4).normalize();
    this.sun.position.copy(camPos).addScaledVector(lightDir, 250);
    this.sun.target.position.copy(camPos);
    // snap the shadow camera to texels so shadows do not shimmer
    this.sun.target.updateMatrixWorld();
    this.hemi.color.copy(mixC(C('#1a2230'), mixC(zen, hor, 0.5), day));
    this.hemi.groundColor.copy(mixC(C('#0a0a0c'), C('#4a4640'), day));
    this.hemi.intensity = 0.28 + day * (0.12 + cloud * 0.45);
    this.scene.environmentIntensity = this.indoor ? 0.35 : 0.12 + day * (0.42 + cloud * 0.35);

    // fog
    const fogCol = hor.clone().lerp(C('#8c8a84'), 0.25 * day);
    this.fog.color.copy(fogCol);
    this.fog.density = w.fog * (1 + (1 - day) * 0.6);
    this.exposure = 0.95 + (1 - day) * 0.9;

    this.searchlights.visible = day < 0.25;
    if (this.searchlights.visible) {
      for (const m of this.searchlights.children) {
        const p = m.userData.ph + this.uni.uTime.value * 0.15;
        m.rotation.set(Math.sin(p) * 0.45, 0, Math.cos(p * 0.7) * 0.45);
      }
    }
    this.day = day;
    this.dusk = dusk;

    const key = `${Math.round(minutes / 15)}:${this.weather}:${Math.round(cloud * 10)}`;
    if (key !== this.lastEnvKey) {
      this.lastEnvKey = key;
      this.probeDirty = true;
    }
    this.maybeBakeProbe(camPos);
  }

  // Reflection probe: the real surroundings (buildings, lamps, the sky) are
  // rendered into a cube map at the player's position and prefiltered for
  // image-based lighting, so windows and wet streets reflect the city. Re-
  // baked when the player has moved far enough, the light changed, or the
  // location changed.
  maybeBakeProbe(pos, force = false) {
    if (!this.probePos) this.probePos = pos.clone().add(new THREE.Vector3(1e6, 0, 0));
    const moved = this.probePos.distanceTo(pos);
    if (!force && !this.probeDirty && moved < (this.indoor ? 6 : 25)) return;
    const now = performance.now();
    if (!force && this.lastProbe && now - this.lastProbe < 1500) return;
    this.lastProbe = now;
    this.probeDirty = false;
    this.probePos.copy(pos);
    const r = this.renderer;
    const shadowAuto = r.shadowMap.autoUpdate;
    r.shadowMap.autoUpdate = false;
    const prevEnv = this.scene.environment;
    const domePos = this.dome.position.clone();
    this.dome.position.copy(pos);
    const old = this.envRT;
    try {
      this.scene.environment = prevEnv;
      this.envRT = this.pmrem.fromScene(this.scene, 0, 0.1, this.indoor ? 60 : 1100, { size: 256, position: pos.clone() });
    } catch (e) {
      // older signature without options: bake at the origin of the scene
      this.envRT = this.pmrem.fromScene(this.envScene, 0, 0.1, 500);
    }
    r.shadowMap.autoUpdate = shadowAuto;
    this.dome.position.copy(domePos);
    this.scene.environment = this.envRT.texture;
    if (old) old.dispose();
  }

  invalidateProbe() { this.probeDirty = true; }

  setIndoor(on, fogColor = 0x1a1a1a, density = 0.02) {
    this.indoor = on;
    this.dome.visible = !on;
    this.searchlights.visible = false;
    if (on) {
      this.sun.intensity = 0;
      this.hemi.intensity = 0.25;
      this.hemi.color.set(0x9a9890); this.hemi.groundColor.set(0x2a2622);
      this.fog.color.set(fogColor); this.fog.density = density;
    }
    this.probeDirty = true;
  }
}
