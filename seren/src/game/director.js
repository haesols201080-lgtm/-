// 연출: 타이틀 카메라, 오프닝, 조망점 둘러보기, 공명탑 각성, 노래 보내기.
// 각 연출은 카메라를 잠시 맡았다가(rig.override) 끝나면 돌려줍니다.
import * as THREE from 'three';
import { heightAt } from '../world/heightfield.js';
import { music } from '../core/music.js';
import { audio } from '../core/audio.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export class Director {
  constructor(game) {
    this.game = game;
    this.seq = null;
  }

  get active() { return !!this.seq; }

  /** 시간 순서대로 진행되는 연출 */
  run(duration, frame, onEnd) {
    this.seq = { t: 0, duration, frame, onEnd };
  }

  update(dt) {
    const s = this.seq;
    if (!s) return;
    s.t += dt;
    const k = Math.min(1, s.t / s.duration);
    s.frame(k, s.t, dt);
    if (k >= 1) {
      this.seq = null;
      this.game.rig.override = null;
      s.onEnd && s.onEnd();
    }
  }

  skip() {
    if (!this.seq) return;
    this.seq.t = this.seq.duration;
    this.update(0);
  }

  // ── 타이틀 화면: 들판 위를 천천히 흐르는 카메라 ─────────
  titleFrame(t) {
    const g = this.game;
    const a = t * 0.012;
    const cx = 260 + Math.sin(a) * 160, cz = 9350 + Math.cos(a * 0.7) * 120;
    const cy = Math.max(heightAt(cx, cz) + 14, 62) + Math.sin(t * 0.1) * 4;
    g.rig.override = { pos: V(cx, cy, cz), look: V(-200 + Math.sin(a * 0.5) * 300, 900, -400) };
  }

  // ── 오프닝: 착륙선 해치에서 조종사의 어깨 너머로 — 경사판을 내려선 들판과 마중 나온 빛 ──
  wake(onEnd) {
    const g = this.game;
    const p = g.player.pos;
    const fx = Math.sin(g.player.yaw), fz = Math.cos(g.player.yaw); // 바라보는 쪽
    const rx = fz, rz = -fx;
    const from = V(p.x - fx * 3.6 + rx * 0.6, p.y + 2.1, p.z - fz * 3.6 + rz * 0.6);
    const mid = V(p.x - fx * 1.0 + rx * 4.5, p.y + 4.5, p.z - fz * 1.0 + rz * 4.5);
    this.run(7.5, (k) => {
      const e = k < 0.5 ? (k / 0.5) ** 2 * 0.5 : 0.5 + (1 - (1 - (k - 0.5) / 0.5) ** 2) * 0.5;
      const pos = from.clone().lerp(mid, e);
      const look = V(p.x + fx * 40, p.y + 1.2 + e * 8, p.z + fz * 40);
      g.rig.override = { pos, look };
    }, onEnd);
  }

  // ── 조망점: 높은 곳에서 천천히 돌며 세계를 보여 준다 ─────────
  vista(v, name, sub, onEnd) {
    const g = this.game;
    const c = V(v.x, v.y + 2, v.z);
    const big = v.deck;
    const R = big ? 160 : 26, H = big ? 40 : 8;
    const a0 = g.rig.yaw + Math.PI;
    g.ui.regionTitle(name, sub, true);
    audio.chime('discover');
    this.run(big ? 11 : 8, (k) => {
      const e = k * k * (3 - 2 * k);
      const a = a0 + e * Math.PI * (big ? 1.2 : 0.9);
      const pos = V(c.x + Math.sin(a) * R * (0.6 + e * 0.4), c.y + H * (0.5 + e), c.z + Math.cos(a) * R * (0.6 + e * 0.4));
      const look = V(c.x - Math.sin(a) * 3000, c.y - (big ? 900 : 120), c.z - Math.cos(a) * 3000);
      g.rig.override = { pos, look, fov: 60 + e * 8 };
    }, onEnd);
  }

  // ── 공명탑 각성 ──────────────────────────
  pylon(P, onEnd) {
    const g = this.game;
    const c = V(P.x, P.y, P.z);
    const pp = g.player.pos.clone();
    const dir = pp.clone().sub(c).setY(0).normalize();
    music.setMood('explore');
    this.run(9, (k, t) => {
      const e = k * k * (3 - 2 * k);
      const dist = 40 + e * 180;
      const pos = V(c.x + dir.x * dist + dir.z * 30, c.y + 6 + e * 90, c.z + dir.z * dist - dir.x * 30);
      const look = V(c.x, c.y + 40 + e * 60, c.z);
      g.rig.override = { pos, look, fov: 62 + e * 10 };
      if (t > 1.2 && !this._flashed) { this._flashed = true; g.ui.flash('#bffcff', 1600); g.rig.shake(0.4); }
    }, () => { this._flashed = false; onEnd && onEnd(); });
  }

  // ── 노래 보내기: 전망대에서 승강줄을 따라 하늘로 ─────────────
  sendSong(notes, onEnd) {
    const g = this.game;
    const deckY = g.structures.deckY;
    notes.forEach((n, i) => audio.tone(n, { delay: 0.5 + i * 0.7, gain: 0.6, dur: 4, wet: 0.8 }));
    // 아웬 합창: 같은 선율을 낮게
    notes.forEach((n, i) => audio.tone(n, { delay: 5.2 + i * 0.7, gain: 0.35, octave: -1, dur: 5, soft: true, wet: 0.9 }));
    notes.forEach((n, i) => audio.tone(n, { delay: 5.2 + i * 0.7, gain: 0.25, octave: 1, dur: 5, soft: true, wet: 0.9 }));
    this.run(16, (k, t) => {
      const e = k * k * (3 - 2 * k);
      const y = deckY + 40 + e * 6000;
      const pos = V(220 - e * 80, deckY + 30 + e * 400, 260 - e * 100);
      const look = V(0, y, 0);
      g.rig.override = { pos, look, fov: 62 + e * 14 };
      g.structures.tetherPulse = e;
    }, onEnd);
  }
}
