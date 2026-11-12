// Procedural audio: a slow synth pad, rain, skimmer engine, UI tones. Starts on the first user gesture.
export class GameAudio {
  constructor() { this.ctx = null; }
  start() {
    if (this.ctx) return; const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC(); const master = this.master = c.createGain(); master.gain.value = 0.5; master.connect(c.destination);
    // pad: stacked detuned saws through a breathing low-pass
    const padG = c.createGain(); padG.gain.value = 0.05; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 480; lp.Q.value = 3; padG.connect(lp); lp.connect(master);
    for (const f of [55, 82.4, 110.3, 164.6, 219.4]) for (const d of [-7, 6]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = d; o.connect(padG); o.start(); }
    const lfo = c.createOscillator(); lfo.frequency.value = 0.045; const lg = c.createGain(); lg.gain.value = 260; lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
    // noise source (rain + wind)
    const len = c.sampleRate * 2; const buf = c.createBuffer(1, len, c.sampleRate); const d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const mkNoise = (type, freq, q) => { const s = c.createBufferSource(); s.buffer = buf; s.loop = true; const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = c.createGain(); g.gain.value = 0; s.connect(f); f.connect(g); g.connect(master); s.start(); return { f, g }; };
    this.rain = mkNoise('highpass', 2200, 0.4); this.wind = mkNoise('bandpass', 320, 0.6);
    // engine
    const eo = this.eng = c.createOscillator(); eo.type = 'sawtooth'; eo.frequency.value = 50; const ef = this.engF = c.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 300; const eg = this.engG = c.createGain(); eg.gain.value = 0; eo.connect(ef); ef.connect(eg); eg.connect(master); eo.start();
  }
  update(rain, indoor, flying, speed, altitude) {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    this.rain.g.gain.setTargetAtTime(rain * (1 - indoor * 0.8) * (altitude > 900 ? 0 : 0.11), t, 0.4);
    this.wind.g.gain.setTargetAtTime(Math.min(0.2, 0.02 + speed * 0.0022 + (altitude > 600 ? 0.05 : 0)), t, 0.3); this.wind.f.frequency.setTargetAtTime(300 + speed * 9, t, 0.3);
    this.engG.gain.setTargetAtTime(flying ? 0.05 + Math.min(0.06, speed * 0.001) : 0, t, 0.15); this.eng.frequency.setTargetAtTime(46 + speed * 1.1, t, 0.12); this.engF.frequency.setTargetAtTime(240 + speed * 14, t, 0.12);
  }
  tone(freq, dur, type = 'sine', vol = 0.12, when = 0) { if (!this.ctx) return; const c = this.ctx; const o = c.createOscillator(); o.type = type; o.frequency.value = freq; const g = c.createGain(); const t = c.currentTime + when; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02); }
  blip(f = 600, d = 0.08) { this.tone(f, d, 'triangle', 0.1); }
  coin() { this.tone(1180, 0.09, 'sine', 0.1); this.tone(1760, 0.16, 'sine', 0.09, 0.06); }
  chord() { [392, 494, 587, 784].forEach((f, i) => this.tone(f, 0.7, 'triangle', 0.07, i * 0.07)); }
  thud() { this.tone(70, 0.25, 'sine', 0.3); this.tone(140, 0.12, 'square', 0.05); }
}
