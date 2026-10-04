// 세렌의 하늘 시계: 낮과 밤, 계절, 해의 경로, 우르(가스행성) 일식.
// 세렌은 우르에 조석 고정되어 있어 우르는 언제나 북쪽 하늘 같은 자리에 떠 있습니다.
// 해가 반대편에 있을 때(밤) 우르는 보름처럼 꽉 차서 땅을 호박색으로 비추고,
// 계절이 기울어 해의 길이 우르를 지나가는 날에는 한낮에 일식이 일어납니다.
import * as THREE from 'three';

const DEG = Math.PI / 180;

export const UR_AZ = 12 * DEG; // 북쪽에서 동쪽으로
export const UR_EL = 30 * DEG;
export const UR_RADIUS = 11 * DEG; // 겉보기 반지름
export const UR_DIR = new THREE.Vector3(Math.sin(UR_AZ) * Math.cos(UR_EL), Math.sin(UR_EL), -Math.cos(UR_AZ) * Math.cos(UR_EL)).normalize();

const LAT = 32 * DEG; // 천구의 극이 남쪽 지평선 위 32°
const POLE = new THREE.Vector3(0, Math.sin(LAT), Math.cos(LAT)).normalize();
const SEASON_DAYS = 5; // 다섯 날마다 일식
const ECLIPSE_DAY = 2; // 첫 일식은 셋째 날

// 우르를 정확히 지나가는 날의 정오 고도
const urDotP = UR_DIR.dot(POLE);
const E_NOON_ECLIPSE = Math.acos(-urDotP) - LAT;

export class SkyClock {
  constructor() {
    this.dayLength = 1200; // 실제 초 (하루 20분)
    this.time = 0.3; // 일수 단위 연속 시간 (정수부 = 날짜, 소수부 = 하루 중 시각, 0 = 자정, 0.5 = 정오)
    this.scale = 1;
    this.frozen = false;
    this.sunDir = new THREE.Vector3();
    this.eclipse = 0; // 0..1 일식 정도
    this.eclipseNear = 0; // 일식 전후의 넓은 창(음악·이벤트용)
    this.urPhase = 0; // 우르가 빛나는 비율 0..1
    this._q = new THREE.Quaternion();
    this.update(0);
  }

  get day() { return Math.floor(this.time); }
  get hour() { return (this.time - Math.floor(this.time)) * 24; }

  // 정오 고도(계절)
  noonElevation(t) {
    const phase = ((t - ECLIPSE_DAY - 0.47) / SEASON_DAYS) * Math.PI * 2;
    return E_NOON_ECLIPSE + 22 * DEG * (1 - Math.cos(phase));
  }

  sunAt(t, out) {
    const eNoon = this.noonElevation(t);
    const frac = t - Math.floor(t);
    const H = (frac - 0.5) * Math.PI * 2;
    out.set(0, Math.sin(eNoon), -Math.cos(eNoon));
    // 극축 기준으로 회전: 아침에는 동쪽(+X)에서 떠오른다
    this._q.setFromAxisAngle(POLE, H);
    out.applyQuaternion(this._q);
    return out;
  }

  update(dt) {
    if (!this.frozen) {
      // 일식 중에는 시간이 천천히 흐른다
      const slow = 1 - 0.7 * this.eclipseNear;
      this.time += (dt * this.scale * slow) / this.dayLength;
    }
    this.sunAt(this.time, this.sunDir);
    const sep = Math.acos(Math.min(1, Math.max(-1, this.sunDir.dot(UR_DIR))));
    this.eclipse = 1 - smooth(UR_RADIUS - 1.2 * DEG, UR_RADIUS + 1.8 * DEG, sep);
    this.eclipseNear = 1 - smooth(UR_RADIUS + 2 * DEG, UR_RADIUS + 16 * DEG, sep);
    if (this.sunDir.y < -0.05) this.eclipseNear = 0;
    this.urPhase = (1 - this.sunDir.dot(UR_DIR)) * 0.5;
  }

  /** 다음 특정 시각(0..1)으로 건너뛰기 */
  skipTo(frac) {
    const cur = this.time - Math.floor(this.time);
    let d = frac - cur;
    if (d <= 0.01) d += 1;
    this.time += d;
    this.update(0);
  }

  /** 다음 일식까지 남은 일수 */
  daysToEclipse() {
    for (let t = this.time; t < this.time + SEASON_DAYS + 1; t += 0.01) {
      const s = this.sunAt(t, _v);
      if (s.angleTo(UR_DIR) < UR_RADIUS && s.y > 0) return t - this.time;
    }
    return SEASON_DAYS;
  }

  timeLabel() {
    const h = this.hour;
    if (this.eclipse > 0.5) return '일식';
    if (h < 4.5) return '깊은 밤';
    if (h < 6.5) return '새벽';
    if (h < 10) return '아침';
    if (h < 14) return '한낮';
    if (h < 17.5) return '오후';
    if (h < 19.5) return '저녁';
    return '밤';
  }
}

const _v = new THREE.Vector3();
function smooth(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
