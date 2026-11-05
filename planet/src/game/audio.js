// Small synthesized sound set (WebAudio): wind ambience that follows the
// atmosphere, rain, and short cues for building, mining and milestones.
export class Audio {
  constructor() {
    this.ctx = null;
    this.volume = 0.6;
  }

  start() {
    if (this.ctx) return;
    try {
      const C = window.AudioContext || window.webkitAudioContext;
      this.ctx = new C();
    } catch (e) { return; }
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(ctx.destination);
    // noise buffer
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    this.noise = buf;
    const mk = (freq, q) => {
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain(); g.gain.value = 0;
      src.connect(f); f.connect(g); g.connect(this.master); src.start();
      return { f, g };
    };
    this.wind = mk(400, 0.6);
    this.rain = mk(2400, 0.4);
  }

  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = v; }

  ambient(atmo, storm, dust, inside) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const w = (0.05 + atmo * 0.12 + dust * 0.12 + storm * 0.2) * (inside ? 0.25 : 1);
    this.wind.g.gain.setTargetAtTime(w, t, 0.5);
    this.wind.f.frequency.setTargetAtTime(250 + atmo * 300 + Math.sin(t * 0.3) * 80, t, 0.8);
    this.rain.g.gain.setTargetAtTime(storm * 0.18 * (inside ? 0.4 : 1), t, 0.6);
  }

  tone(freq, dur, type = 'sine', vol = 0.2, slide = 0) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  play(name) {
    if (!this.ctx) return;
    switch (name) {
      case 'build': this.tone(110, 0.25, 'triangle', 0.35, 0.5); setTimeout(() => this.tone(660, 0.18, 'sine', 0.12), 90); break;
      case 'pickup': this.tone(880, 0.09, 'sine', 0.12, 1.5); break;
      case 'mine': this.tone(220 + Math.random() * 40, 0.06, 'sawtooth', 0.03); break;
      case 'ui': this.tone(520, 0.05, 'sine', 0.06); break;
      case 'done': [523, 659, 784].forEach((f, i) => setTimeout(() => this.tone(f, 0.3, 'sine', 0.1), i * 90)); break;
      case 'stage': [392, 523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 0.6, 'triangle', 0.12), i * 120)); break;
      case 'warn': this.tone(300, 0.2, 'square', 0.05); break;
      case 'shuttle': this.tone(60, 3, 'sawtooth', 0.08, 0.5); break;
    }
  }
}
