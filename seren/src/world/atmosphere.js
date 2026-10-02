// 대기 상태: 해의 고도에 따라 하늘·빛·안개 색을 정하고, 모든 셰이더가 공유하는 uniform 을 갱신합니다.
import * as THREE from 'three';
import { UR_DIR } from './sky-clock.js';

const C = (hex) => new THREE.Color(hex); // sRGB hex → 선형 색
const LIGHT = 0.56;

// 해 고도(sunDir.y)별 팔레트. 색은 sRGB hex, 세기는 따로 곱한다.
const KEYS = [
  { e: -0.4, top: '#05071c', hor: '#1d1a40', glow: '#000000', sun: '#000000', sunI: 0, ambT: '#2a2f66', ambB: '#14122c', ambI: 0.42, fog: 0.00006 },
  { e: -0.16, top: '#0a0e2e', hor: '#2e2356', glow: '#1a0c2a', sun: '#000000', sunI: 0, ambT: '#33397a', ambB: '#1a1736', ambI: 0.5, fog: 0.00007 },
  { e: -0.06, top: '#1c2763', hor: '#a25a86', glow: '#b0406e', sun: '#ff5a3a', sunI: 0.0, ambT: '#4a4d96', ambB: '#2c2244', ambI: 0.62, fog: 0.00009 },
  { e: 0.0, top: '#2a4787', hor: '#ff9478', glow: '#ff6a4a', sun: '#ff7a3c', sunI: 1.1, ambT: '#6a77b8', ambB: '#4a3550', ambI: 0.75, fog: 0.0001 },
  { e: 0.08, top: '#36679c', hor: '#ffb98e', glow: '#ff9a62', sun: '#ffa860', sunI: 1.7, ambT: '#7f9ac8', ambB: '#5e4a58', ambI: 0.7, fog: 0.0001 },
  { e: 0.22, top: '#2a7fb0', hor: '#a9d2e2', glow: '#ffc8a0', sun: '#ffe0b0', sunI: 2.1, ambT: '#7fb8d8', ambB: '#5c5a66', ambI: 0.75, fog: 0.000082 },
  { e: 0.6, top: '#1d74a8', hor: '#a4d2e4', glow: '#000000', sun: '#fff0d8', sunI: 2.3, ambT: '#84c4e0', ambB: '#62606a', ambI: 0.78, fog: 0.000078 },
];
const ECLIPSE = { top: '#0b0f34', hor: '#3a2a5c', glow: '#ff7a5a', ambT: '#3a5aa0', ambB: '#1c1630', ambI: 0.5, fog: 0.00008 };

for (const k of KEYS) for (const f of ['top', 'hor', 'glow', 'sun', 'ambT', 'ambB']) k[f] = C(k[f]);
for (const f of ['top', 'hor', 'glow', 'ambT', 'ambB']) ECLIPSE[f] = C(ECLIPSE[f]);

export const atmosUniforms = {
  uSunDir: { value: new THREE.Vector3(0, 1, 0) },
  uSunColor: { value: new THREE.Color() },
  uSkyTop: { value: new THREE.Color() },
  uSkyHorizon: { value: new THREE.Color() },
  uHorizonGlow: { value: new THREE.Color() },
  uAmbTop: { value: new THREE.Color() },
  uAmbBottom: { value: new THREE.Color() },
  uUrDir: { value: UR_DIR.clone() },
  uUrLight: { value: new THREE.Color() },
  uNight: { value: 0 },
  uEclipse: { value: 0 },
  uGlow: { value: 0 },
  uTime: { value: 0 },
  uFogDensity: { value: 0.0001 },
  uFogFalloff: { value: 1 / 1100 },
  uCurv: { value: 1 / (2 * 1600000) },
  uAurora: { value: 1 }, // 오로라 세기 (기상탑)
  uAlt: { value: 0 }, // 카메라 높이 (m) — 높이 오르면 하늘이 우주처럼 어두워진다
  uSilence: { value: Array.from({ length: 10 }, () => new THREE.Vector4(0, 0, 1, 0)) },
};

const tmp = { top: new THREE.Color(), hor: new THREE.Color(), glow: new THREE.Color(), sun: new THREE.Color(), ambT: new THREE.Color(), ambB: new THREE.Color() };

export class Atmosphere {
  constructor() {
    this.u = atmosUniforms;
    this.fogScale = 1; // 날씨·이벤트용 배율
    this.state = { night: 0, sunVisible: 1 };
  }

  update(clock, elapsed, alt = 0) {
    const u = this.u;
    const s = clock.sunDir;
    u.uSunDir.value.copy(s);
    u.uTime.value = elapsed;

    // 해 고도로 팔레트 보간
    const e = s.y;
    let i = 0;
    while (i < KEYS.length - 2 && e > KEYS[i + 1].e) i++;
    const a = KEYS[i], b = KEYS[i + 1];
    let t = (e - a.e) / (b.e - a.e);
    t = Math.min(1, Math.max(0, t));
    tmp.top.copy(a.top).lerp(b.top, t);
    tmp.hor.copy(a.hor).lerp(b.hor, t);
    tmp.glow.copy(a.glow).lerp(b.glow, t);
    tmp.sun.copy(a.sun).lerp(b.sun, t);
    tmp.ambT.copy(a.ambT).lerp(b.ambT, t);
    tmp.ambB.copy(a.ambB).lerp(b.ambB, t);
    let sunI = a.sunI + (b.sunI - a.sunI) * t;
    let ambI = a.ambI + (b.ambI - a.ambI) * t;
    let fog = a.fog + (b.fog - a.fog) * t;

    // 일식
    const ec = clock.eclipse;
    const en = clock.eclipseNear * 0.5 + ec * 0.5;
    if (en > 0) {
      tmp.top.lerp(ECLIPSE.top, en);
      tmp.hor.lerp(ECLIPSE.hor, en);
      tmp.glow.lerp(ECLIPSE.glow, ec * 0.6);
      tmp.ambT.lerp(ECLIPSE.ambT, en);
      tmp.ambB.lerp(ECLIPSE.ambB, en);
      ambI += (ECLIPSE.ambI - ambI) * en;
      fog += (ECLIPSE.fog - fog) * en;
      sunI *= 1 - ec * 0.97;
    }

    u.uSkyTop.value.copy(tmp.top);
    u.uSkyHorizon.value.copy(tmp.hor);
    u.uHorizonGlow.value.copy(tmp.glow);
    // 조명 세기 보정: ACES 톤매핑이 중간톤을 밝히므로 직접광·환경광을 낮춰 색이 바래지 않게 한다
    u.uSunColor.value.copy(tmp.sun).multiplyScalar(sunI * LIGHT);
    // 높은 곳: 하늘빛(환경광)이 줄고 햇빛만 남는다
    const space = smooth(2500, 34000, alt);
    u.uAmbTop.value.copy(tmp.ambT).multiplyScalar(ambI * LIGHT * (1 - 0.6 * space));
    u.uAmbBottom.value.copy(tmp.ambB).multiplyScalar(ambI * LIGHT * (1 - 0.3 * space));
    u.uFogDensity.value = fog * this.fogScale;

    // 우르의 반사광: 위상(보름일수록 밝음) × 하늘이 어두울수록 두드러짐
    const night = 1 - smooth(-0.14, 0.06, e);
    const urI = clock.urPhase * clock.urPhase * (0.12 + 0.5 * night);
    u.uUrLight.value.setRGB(1.0, 0.62, 0.36).multiplyScalar(urI * 0.75);
    u.uNight.value = night;
    u.uEclipse.value = ec;
    u.uGlow.value = Math.min(1.4, 0.04 + 1.0 * night + 1.1 * ec);
    this.state.night = night;
    this.state.sunVisible = Math.max(0, sunI / 2.9);
  }

  setSilence(i, x, z, r, amount) {
    this.u.uSilence.value[i].set(x, z, r, amount);
  }
}

function smooth(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
