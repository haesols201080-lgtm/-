// 교신: 모아는 함께 내려온 동료가 아니라, 궤도를 도는 탐사선 「라르크」 호의 함선 지능이다.
// 조종사는 착륙선을 타고 혼자 내려왔고, 모아는 배에 남아 착륙선 안테나·탐사복 무전으로 말하며 탐사복 카메라로 본다.
//   · 라르크 호는 세렌을 14분에 한 바퀴 돈다(게임 시간). 머리 위를 지나는 동안은 직통, 지평선 아래면 착륙선이 중계한다.
//   · 밤하늘엔 지나가는 밝은 점(배)과 깜박이는 항법등이 보인다. 착륙선의 접시 안테나는 늘 배 쪽을 겨눈다.
//   · 모아가 말할 때마다 짧은 무전 소리 + 착륙선 안테나의 빛 + 자막 머리의 신호 표시(경로·세기).
import * as THREE from 'three';
import { glowMaterial } from '../world/materials.js';
import { audio } from '../core/audio.js';
import { PLACE } from '../data/places.js';

const T_ORBIT = 840; // 한 바퀴 (초)
const INC = 0.35; // 궤도가 하늘을 비스듬히 지난다

export class Comm {
  constructor(game) {
    this.game = game;
    this.pulseK = 0;
    this._dir = new THREE.Vector3();
    // 배: 밤하늘을 지나가는 밝은 점 + 항법등 (세계 장면, 카메라에서 멀리)
    this.ship = new THREE.Group();
    this.ship.add(new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), glowMaterial({ color: 0xfff4e0, intensity: 2.4 })));
    this.strobe = new THREE.Mesh(new THREE.SphereGeometry(0.7, 6, 4), glowMaterial({ color: 0xff8a6a, intensity: 3 }));
    this.strobe.position.x = 2.4;
    this.ship.add(this.strobe);
    this.ship.visible = false;
    this.ship.userData.indoor = false;
    game.engine.scene.add(this.ship);
  }

  /** 궤도 위상 0..1 (0~0.5: 지평선 위) */
  get phase() { return (((this.game.time + 90) % T_ORBIT) + T_ORBIT) % T_ORBIT / T_ORBIT; }

  /** 배가 보이는 방향 (단위 벡터) — 지평선 아래면 null */
  shipDir(out = this._dir) {
    const u = this.phase;
    if (u >= 0.5) return null;
    const th = Math.PI * (u / 0.5); // 서쪽 지평선 → 머리 위 → 동쪽 지평선
    const el = Math.sin(th);
    return out.set(Math.cos(th), el * 0.95 + 0.05, Math.sin(th) * INC - 0.3 * (1 - el)).normalize();
  }

  /** 지금 교신 상태: { bars 1..4, route, up } */
  status() {
    const g = this.game, p = g.player.pos;
    const up = this.shipDir() !== null;
    const L = PLACE.crash ? PLACE.crash.pos : [0, 0];
    const far = Math.hypot(p.x - L[0], p.z - L[1]);
    let bars = up ? 4 : far < 30000 ? 3 : 2, route = up ? '라르크 호 직통' : far < 30000 ? '착륙선 중계' : '착륙선 중계 · 원거리';
    if (g.interiors && g.interiors.inPocket) { bars = Math.max(1, bars - 1); route += ' · 건물 안'; }
    if (p.y > 20000) { bars = 4; route = '라르크 호 직통 · 고공'; }
    return { bars, route, up };
  }

  /** 자막 머리: 「모아 · 라르크 호(궤도)」 + 신호 막대 */
  badgeHTML() {
    const s = this.status();
    const bars = [1, 2, 3, 4].map((i) => `<i class="${i <= s.bars ? 'on' : ''}" style="height:${3 + i * 2}px"></i>`).join('');
    return `<span class="sig" title="${s.route}"><span class="bars">${bars}</span>${s.route}</span>`;
  }

  /** 모아가 말할 때: 무전 소리 + 착륙선 안테나 빛 */
  pulse() {
    this.pulseK = 1;
    if (!audio.ready) return;
    const s = this.status();
    audio.noise({ freq: 2400, q: 0.7, dur: 0.07, gain: 0.05 + (4 - s.bars) * 0.02, type: 'bandpass', bus: 'voice' });
    audio.tone({ hz: 1318 }, { gain: 0.035, dur: 0.06, soft: true, bus: 'voice' });
    audio.tone({ hz: 1760 }, { delay: 0.07, gain: 0.03, dur: 0.05, soft: true, bus: 'voice' });
  }

  update(dt) {
    const g = this.game;
    this.pulseK = Math.max(0, this.pulseK - dt * 1.4);
    const d = this.shipDir();
    const cam = g.engine.camera.position;
    const night = g.world.atmos.state.night;
    const show = d && !(g.interiors && g.interiors.inPocket) && night > 0.2;
    this.ship.visible = !!show;
    if (show) {
      const R = 3800;
      this.ship.position.set(cam.x + d.x * R, cam.y + d.y * R, cam.z + d.z * R);
      this.ship.scale.setScalar(R / 900);
      this.ship.lookAt(cam);
      this.strobe.visible = Math.sin(g.time * 5.5) > 0.6;
      // 처음 밤하늘에 배가 높이 떴을 때 한 번
      const f = g.state.flags;
      if (!f.moaShipSeen && d.y > 0.6 && g.mode === 'play' && night > 0.5) {
        f.moaShipSeen = true;
        g.ui.moa('머리 위로 지나가는 밝은 점 보이세요? 깜박이는 게 라르크 호예요. 저는 저기서 조종사님을 보고 있어요.');
      }
    }
  }
}
