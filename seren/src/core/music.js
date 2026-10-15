// 생성 음악: 화음 패드 + 드문드문 울리는 종소리 선율. 장소·시간·조화도에 따라 겹이 달라집니다.
// 플레이어가 지은 「이름 노래」가 있으면 밤의 도시에서 그 선율이 흘러나옵니다.
import { audio, SCALE } from './audio.js';

// 화음 (MIDI 근음 기준, D 장조): I, vi, IV, V, ii, iii
const CHORDS = {
  explore: [[50, 57, 62, 66], [47, 54, 59, 62], [43, 50, 55, 59], [45, 52, 57, 61], [50, 57, 62, 69], [43, 50, 55, 62]],
  night: [[47, 54, 59, 62], [43, 50, 55, 59], [50, 57, 62, 66], [42, 49, 54, 57]],
  eclipse: [[38, 45, 50, 57], [43, 50, 53, 58], [41, 48, 53, 57], [38, 45, 50, 54]],
  title: [[50, 57, 62, 66], [43, 50, 55, 59], [47, 54, 59, 62], [45, 52, 57, 64]],
  silence: [[44, 51, 56], [43, 50, 55]],
};
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class Music {
  constructor() {
    this.mood = 'title';
    this.intensity = 0.5;
    this.next = 0;
    this.bar = 0;
    this.pads = [];
    this.enabled = true;
    this.nameSong = null; // [음 번호...]
    this.nameSongChance = 0;
    this.melodyQueue = [];
  }

  setMood(m) {
    if (m === this.mood) return;
    this.mood = m;
    this.next = Math.min(this.next, audio.now + 1.5);
  }

  stopPads(rel = 5) {
    for (const s of this.pads) s(rel);
    this.pads = [];
  }

  update(dt) {
    if (!audio.ready || !this.enabled) return;
    const now = audio.now;
    // 예약된 선율
    while (this.melodyQueue.length && this.melodyQueue[0].t <= now + 0.05) {
      const m = this.melodyQueue.shift();
      audio.tone(m.n, { gain: m.g, dur: 3.5, soft: true, bus: 'music', wet: 0.7, octave: m.o });
    }
    if (now < this.next) return;
    const set = CHORDS[this.mood] || CHORDS.explore;
    const chord = set[this.bar % set.length];
    const barLen = this.mood === 'title' ? 7 : this.mood === 'night' ? 9 : this.mood === 'eclipse' ? 10 : 8;
    this.bar++;
    this.next = now + barLen;
    // 패드 교체
    this.stopPads(barLen * 0.7);
    const warm = this.mood === 'night' || this.mood === 'eclipse';
    const g = 0.022 + this.intensity * 0.02;
    for (let i = 0; i < chord.length; i++) {
      if (i > 1 + Math.round(this.intensity * 2)) break;
      this.pads.push(audio.pad(hz(chord[i]), { gain: g * (i === 0 ? 1.2 : 0.8), type: warm ? 'triangle' : 'sawtooth', cutoff: warm ? 700 : 1100 + this.intensity * 600, attack: barLen * 0.45, detune: 6 + i * 2 }));
    }
    if (this.intensity > 0.35 && this.mood !== 'silence') {
      this.pads.push(audio.pad(hz(chord[0] - 12), { gain: 0.03, type: 'sine', cutoff: 400, attack: 2 }));
    }
    // 선율: 이름 노래 또는 즉흥
    if (this.nameSong && this.nameSong.length && Math.random() < this.nameSongChance) {
      this.nameSong.forEach((n, i) => this.melodyQueue.push({ t: now + 1 + i * 0.55, n, g: 0.11, o: 0 }));
    } else if (this.mood !== 'silence') {
      const count = Math.floor(1 + Math.random() * (2 + this.intensity * 4));
      let t = now + 0.5 + Math.random() * 1.5;
      let n = Math.floor(Math.random() * 5);
      for (let i = 0; i < count; i++) {
        n = Math.max(0, Math.min(9, n + Math.floor(Math.random() * 5) - 2));
        this.melodyQueue.push({ t, n, g: 0.06 + Math.random() * 0.05, o: warm ? -1 : 0 });
        t += [0.4, 0.6, 0.9, 1.3][Math.floor(Math.random() * 4)];
      }
    }
    this.melodyQueue.sort((a, b) => a.t - b.t);
  }
}

export const music = new Music();
