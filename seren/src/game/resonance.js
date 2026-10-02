// 공명기: 다섯 음을 연주하고, 세계가 그 소리에 반응합니다.
//  0 솟음 — 한 번 더 솟아오르기, 승강 꽃·우물
//  1 열림 — 메아리(옛 기억)를 열고, 잠든 것을 깨움
//  2 흐름 — 활공·썰매·달리기 중 앞으로 밀어 줌
//  3 빛   — 빛 구슬, 빛나방을 부름
//  4 고요 — 생물을 진정시키고 하늘고래를 부름
// 수정은 소리를 기억했다가 거리만큼 늦게(음속) 되돌려 보냅니다.
import { awakenedCount } from './quests.js';
import * as THREE from 'three';
import { audio, NOTE_COLORS, NOTE_NAMES } from '../core/audio.js';
import { bus } from '../core/events.js';
import { glowMaterial } from '../world/materials.js';
import { PYLON_ORDER_LENGTH, KEEPERS, PYLON_TONES } from '../data/story.js';
import { mulberry32, hashStr } from '../core/noise.js';

export class Resonance {
  constructor(game) {
    this.game = game;
    this.scene = game.engine.scene;
    this.waves = [];
    const geo = new THREE.RingGeometry(0.92, 1, 64);
    geo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(geo, glowMaterial({ color: 0xffffff, intensity: 1.5, side: THREE.DoubleSide }));
      m.visible = false;
      m.frustumCulled = false;
      this.scene.add(m);
      this.waves.push({ m, t: 1 });
    }
    this.cool = [0, 0, 0, 0, 0];
    this.history = []; // {n, t}
    this.puzzle = null;
    this.lightOrb = null;
    this.flashes = [];
    const fg = new THREE.SphereGeometry(1, 8, 6);
    for (let i = 0; i < 16; i++) {
      const m = new THREE.Mesh(fg, glowMaterial({ color: 0xffffff, intensity: 2 }));
      m.visible = false;
      this.scene.add(m);
      this.flashes.push({ m, t: 1, delay: 0 });
    }
  }

  get unlocked() { return this.game.state.tones; }

  play(n) {
    const g = this.game;
    if (!this.unlocked.includes(n)) { g.ui.toast('아직 모르는 음이에요', { kind: 'muted' }); return; }
    if (this.cool[n] > 0) return;
    this.cool[n] = 0.28;
    const p = g.player;
    const pos = p.pos.clone();
    pos.y += 1.4;
    audio.tone(n, { gain: 0.55 });
    g.avatar.playTone(NOTE_COLORS[n]);
    this._wave(pos, NOTE_COLORS[n], 18 + (n === 4 ? 20 : 0));
    g.state.stats.tones++;
    this.history.push({ n, t: g.time });
    if (this.history.length > 12) this.history.shift();
    // 음별 효과
    if (n === 0) { if (p.rise()) g.rig.shake(0.05); }
    if (n === 2) this._flow();
    if (n === 3) this._light();
    if (n === 4) bus.emit('calm', { pos });
    this._echo(n, pos);
    if (this.puzzle) this._puzzleInput(n);
    bus.emit('tone', { n, pos });
  }

  _wave(pos, color, size) {
    const w = this.waves.find((x) => x.t >= 1) || this.waves[0];
    w.t = 0;
    w.size = size;
    w.m.position.copy(pos);
    w.m.material.uniforms.uColor.value.set(color);
    w.m.visible = true;
  }

  _flow() {
    const p = this.game.player;
    if (p.state === 'glide') p.glideSpeed = Math.min(p.glideSpeed + 16, 60);
    else if (p.state === 'skim') p.skimSpeed = Math.min(p.skimSpeed + 16, 62);
    else if (p.state === 'fly') p.flySpeed = Math.min(p.flySpeed + 30, 140);
    else if (p.state === 'ground' || p.state === 'air') {
      const f = Math.sin(p.yaw), c = Math.cos(p.yaw);
      p.vel.x += f * 14; p.vel.z += c * 14;
      if (p.state === 'ground') { p.vel.y = 4; p.setState('air'); p.airTime = 0.2; }
    }
    this.cool[2] = 1.1;
    this.game.rig.shake(0.04);
  }

  _light() {
    // 플레이어를 따라다니는 빛 구슬 (밤길 동무)
    const g = this.game;
    if (!this.lightOrb) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 8), glowMaterial({ color: 0xffd8f0, intensity: 3 }));
      const halo = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 8), glowMaterial({ color: 0xff9fd0, intensity: 0.5, fresnel: 1 }));
      m.add(halo);
      this.scene.add(m);
      this.lightOrb = { m, t: 0 };
      m.position.copy(g.player.pos);
    }
    this.lightOrb.t = 90;
  }

  /** 수정·우물 같은 공명체가 소리를 되돌려 보냄 */
  _echo(n, pos) {
    const g = this.game;
    const list = g.flora.queryCrystals(pos.x, pos.z, 420, 6);
    for (const s of g.structures.resonators || []) {
      const d = Math.hypot(s.x - pos.x, s.z - pos.z);
      if (d < 300) list.push({ x: s.x, y: s.y, z: s.z, d });
    }
    list.sort((a, b) => a.d - b.d);
    list.slice(0, 6).forEach((c, i) => {
      const delay = c.d / 340 + 0.05 + i * 0.03;
      audio.tone(n, { delay, gain: 0.35 * Math.max(0.25, 1 - c.d / 500), pos: c, octave: c.d > 150 ? 0 : 1, soft: true, wet: 0.8 });
      const f = this.flashes.find((x) => x.t >= 1);
      if (f) { f.t = 0; f.delay = delay; f.m.position.set(c.x, c.y, c.z); f.m.material.uniforms.uColor.value.set(NOTE_COLORS[n]); f.size = 3 + Math.min(14, c.d * 0.05); }
    });
  }

  // ── 공명탑 선율 맞추기 ───────────────────
  startPylon(P) {
    const g = this.game;
    if (P.alive) return;
    const tones = this.unlocked.length ? this.unlocked : [0];
    const awakened = awakenedCount(g.state, false);
    const len = P.great ? 8 : PYLON_ORDER_LENGTH[Math.min(awakened, PYLON_ORDER_LENGTH.length - 1)];
    const rnd = mulberry32(hashStr(P.id) + awakened * 17);
    const melody = Array.from({ length: len }, () => tones[Math.floor(rnd() * tones.length)]);
    this.puzzle = { P, melody, i: 0, listen: 0, playing: true, t: 0, tries: 0 };
    g.ui.puzzle(this.puzzle);
    this._singMelody();
  }

  /** 선율 따라 하기 (음악당 합창 등): 맞히면 onSolve */
  startSong(P, melody, onSolve, listenLabel) {
    this.puzzle = { P, melody, i: 0, listen: 0, playing: true, t: 0, tries: 0, onSolve, listenLabel };
    this.game.ui.puzzle(this.puzzle);
    this._singMelody();
  }

  _singMelody() {
    const z = this.puzzle;
    z.playing = true;
    z.i = 0;
    const P = z.P;
    z.melody.forEach((n, i) => {
      audio.tone(n, { delay: 0.6 + i * 0.62, gain: 0.6, pos: { x: P.x, y: P.y + 40, z: P.z }, maxDist: 600, wet: 0.7 });
    });
    z.playUntil = this.game.time + 0.6 + z.melody.length * 0.62 + 0.3;
    z.showT = this.game.time + 0.6;
    this.game.ui.puzzle(z);
  }

  _puzzleInput(n) {
    const z = this.puzzle;
    const g = this.game;
    if (z.playing) return;
    if (z.melody[z.i] === n) {
      z.i++;
      g.ui.puzzle(z);
      if (z.i >= z.melody.length) this._pylonSolved();
    } else {
      z.tries++;
      audio.chime('error');
      g.ui.puzzle(z, true);
      setTimeout(() => this.puzzle && this._singMelody(), 900);
    }
  }

  _pylonSolved() {
    const g = this.game;
    const z = this.puzzle;
    this.puzzle = null;
    g.ui.puzzle(null);
    if (z.onSolve) z.onSolve();
    else g.awakenPylon(z.P.id);
  }

  cancelPuzzle() {
    if (!this.puzzle) return;
    this.puzzle = null;
    this.game.ui.puzzle(null);
  }

  update(dt) {
    const g = this.game;
    for (let i = 0; i < 5; i++) this.cool[i] = Math.max(0, this.cool[i] - dt);
    for (const w of this.waves) {
      if (w.t >= 1) continue;
      w.t += dt / 1.4;
      const k = Math.min(1, w.t);
      const s = 0.5 + (1 - Math.pow(1 - k, 3)) * w.size;
      w.m.scale.setScalar(s);
      w.m.material.uniforms.uIntensity.value = (1 - k) * 2.2;
      if (w.t >= 1) w.m.visible = false;
    }
    for (const f of this.flashes) {
      if (f.t >= 1) continue;
      if (f.delay > 0) { f.delay -= dt; f.m.visible = false; continue; }
      f.t += dt / 1.2;
      f.m.visible = f.t < 1;
      f.m.scale.setScalar(f.size * (0.3 + f.t));
      f.m.material.uniforms.uIntensity.value = (1 - f.t) * 1.5;
    }
    if (this.puzzle) {
      const z = this.puzzle;
      if (z.playing && g.time > z.playUntil) { z.playing = false; g.ui.puzzle(z); }
      // 멀어지면 취소
      if (Math.hypot(g.player.pos.x - z.P.x, g.player.pos.z - z.P.z) > 70) this.cancelPuzzle();
    }
    if (this.lightOrb) {
      const o = this.lightOrb;
      o.t -= dt;
      const p = g.player.pos;
      const tx = p.x + Math.sin(g.time * 0.9) * 1.6, tz = p.z + Math.cos(g.time * 0.9) * 1.6, ty = p.y + 2.6 + Math.sin(g.time * 2) * 0.2;
      o.m.position.x += (tx - o.m.position.x) * Math.min(1, dt * 3);
      o.m.position.y += (ty - o.m.position.y) * Math.min(1, dt * 3);
      o.m.position.z += (tz - o.m.position.z) * Math.min(1, dt * 3);
      o.m.scale.setScalar(Math.min(1, o.t / 3));
      if (o.t <= 0) { this.scene.remove(o.m); this.lightOrb = null; }
    }
  }
}

export { NOTE_NAMES, NOTE_COLORS, KEEPERS, PYLON_TONES };
