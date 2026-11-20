// Procedural Web Audio: all sound effects, ambience and the background music are synthesized at runtime
// (original material, no samples). Positional sources use PannerNodes driven by the camera listener.
export class Audio {
  constructor() {
    this.ctx = null; this.vol = { master: 0.8, music: 0.5, sfx: 0.8 }; this.loops = {};
  }
  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const C = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = C.createGain(); this.master.connect(C.destination);
    this.comp = C.createDynamicsCompressor(); this.comp.threshold.value = -14; this.comp.connect(this.master);
    this.sfx = C.createGain(); this.sfx.connect(this.comp);
    this.mus = C.createGain(); this.mus.connect(this.comp);
    this.amb = C.createGain(); this.amb.connect(this.comp);
    // shared reverb (forest early reflections)
    this.verb = C.createConvolver(); this.verb.buffer = this.impulse(2.2, 2.6);
    this.verbGain = C.createGain(); this.verbGain.gain.value = 0.22; this.verb.connect(this.verbGain); this.verbGain.connect(this.comp);
    this.noiseBuf = this.makeNoise(2);
    this.applyVolume();
    this.startAmbience();
    this.startMusic();
  }
  applyVolume() {
    if (!this.ctx) return;
    this.master.gain.value = this.vol.master; this.mus.gain.value = this.vol.music * 0.5; this.sfx.gain.value = this.vol.sfx; this.amb.gain.value = this.vol.sfx * 0.7;
  }
  impulse(sec, decay) {
    const C = this.ctx, n = C.sampleRate * sec, b = C.createBuffer(2, n, C.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); }
    return b;
  }
  makeNoise(sec) {
    const C = this.ctx, n = C.sampleRate * sec, b = C.createBuffer(1, n, C.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  setListener(cam) {
    if (!this.ctx) return;
    const L = this.ctx.listener, p = cam.position;
    const f = cam.getWorldDirection(this._f || (this._f = cam.position.clone()));
    if (L.positionX) { L.positionX.value = p.x; L.positionY.value = p.y; L.positionZ.value = p.z; L.forwardX.value = f.x; L.forwardY.value = f.y; L.forwardZ.value = f.z; L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0; }
    else { L.setPosition(p.x, p.y, p.z); L.setOrientation(f.x, f.y, f.z, 0, 1, 0); }
  }
  out(pos, bus = this.sfx, verb = 0.3) {
    const C = this.ctx;
    const g = C.createGain();
    if (pos) {
      const pan = C.createPanner(); pan.panningModel = 'HRTF'; pan.distanceModel = 'inverse'; pan.refDistance = 0.6; pan.maxDistance = 40; pan.rolloffFactor = 1.2;
      pan.positionX.value = pos.x; pan.positionY.value = pos.y; pan.positionZ.value = pos.z;
      g.connect(pan); pan.connect(bus); if (verb) { const v = C.createGain(); v.gain.value = verb; pan.connect(v); v.connect(this.verb); }
    } else { g.connect(bus); if (verb) { const v = C.createGain(); v.gain.value = verb; g.connect(v); v.connect(this.verb); } }
    return g;
  }
  noise(dest, t, dur, { type = 'bandpass', f = 1000, q = 1, f2, gain = 0.5, attack = 0.002 } = {}) {
    const C = this.ctx, s = C.createBufferSource(); s.buffer = this.noiseBuf;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const fl = C.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur); fl.Q.value = q;
    const g = C.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(dest); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  tone(dest, t, dur, { f = 440, f2, type = 'sine', gain = 0.3, attack = 0.005 } = {}) {
    const C = this.ctx, o = C.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = C.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  }

  play(name, o = {}) {
    if (!this.ctx) return;
    const C = this.ctx, t = C.currentTime, vol = o.vol ?? 1, p = o.pitch ?? 1;
    const d = this.out(o.pos, this.sfx, o.verb ?? 0.25);
    d.gain.value = vol;
    switch (name) {
      case 'step': {
        const s = o.surface || 'leaves';
        if (s === 'leaves') { this.noise(d, t, 0.09, { f: 2600, q: 0.7, gain: 0.25 }); this.noise(d, t + 0.01, 0.06, { f: 5200, q: 1.2, gain: 0.12 }); }
        else if (s === 'dirt') this.noise(d, t, 0.07, { type: 'lowpass', f: 900, gain: 0.35 });
        else if (s === 'pebbles') { for (let i = 0; i < 3; i++) this.noise(d, t + i * 0.012, 0.03, { f: 3000 + Math.random() * 2000, q: 6, gain: 0.25 }); }
        else if (s === 'moss') this.noise(d, t, 0.07, { type: 'lowpass', f: 500, gain: 0.25 });
        else if (s === 'rock') { this.noise(d, t, 0.04, { f: 1800, q: 3, gain: 0.3 }); this.tone(d, t, 0.04, { f: 180, gain: 0.08 }); }
        else if (s === 'wood') { this.tone(d, t, 0.08, { f: 240 * p, f2: 160, type: 'triangle', gain: 0.18 }); this.noise(d, t, 0.03, { f: 1200, q: 2, gain: 0.12 }); }
        else if (s === 'metal') { this.tone(d, t, 0.18, { f: 820, type: 'square', gain: 0.03 }); this.tone(d, t, 0.25, { f: 1310, gain: 0.05 }); this.noise(d, t, 0.03, { f: 4000, q: 4, gain: 0.15 }); }
        else if (s === 'water') this.noise(d, t, 0.12, { f: 1400, f2: 600, q: 1.5, gain: 0.35 });
        // tiny servo whine for the robot gait
        this.tone(d, t, 0.06, { f: 1900 + Math.random() * 300, f2: 2400, type: 'sine', gain: 0.012 });
        break;
      }
      case 'jump': this.tone(d, t, 0.16, { f: 380 * p, f2: 760, type: 'triangle', gain: 0.12 }); this.noise(d, t, 0.1, { f: 2500, q: 1, gain: 0.08 }); break;
      case 'djump': this.noise(d, t, 0.35, { f: 600, f2: 2400, q: 2, gain: 0.25 }); this.tone(d, t, 0.25, { f: 520, f2: 1040, type: 'sawtooth', gain: 0.04 }); break;
      case 'land': this.noise(d, t, 0.12, { type: 'lowpass', f: 500, gain: 0.5 * vol }); this.tone(d, t, 0.1, { f: 110, f2: 70, gain: 0.25 * vol }); this.tone(d, t + 0.04, 0.06, { f: 2200, gain: 0.02 }); break;
      case 'roll': this.noise(d, t, 0.35, { f: 800, f2: 400, q: 0.8, gain: 0.25 }); break;
      case 'slide': this.noise(d, t, 0.5, { f: 1500, f2: 500, q: 0.7, gain: 0.25 }); break;
      case 'splash': this.noise(d, t, 0.6, { f: 1400, f2: 300, q: 0.8, gain: 0.6 * vol }); this.noise(d, t + 0.05, 0.35, { f: 4000, q: 2, gain: 0.2 }); break;
      case 'swim': this.noise(d, t, 0.3, { f: 900, f2: 500, q: 1.2, gain: 0.2 }); break;
      case 'collect': [0, 0.07, 0.14].forEach((k, i) => this.tone(d, t + k, 0.35, { f: [1320, 1760, 2637][i] * p, type: 'sine', gain: 0.12 })); this.tone(d, t, 0.6, { f: 3520 * p, gain: 0.03 }); break;
      case 'discover': [0, 0.12, 0.24, 0.36].forEach((k, i) => this.tone(d, t + k, 0.9, { f: [523, 659, 784, 1047][i], type: 'triangle', gain: 0.08 })); break;
      case 'quest': [0, 0.11, 0.22, 0.4].forEach((k, i) => this.tone(d, t + k, 0.7, { f: [659, 784, 988, 1319][i], type: 'triangle', gain: 0.09 })); this.tone(d, t + 0.4, 1.2, { f: 1976, gain: 0.025 }); break;
      case 'ability': [0, 0.1, 0.2, 0.3, 0.45].forEach((k, i) => this.tone(d, t + k, 1.0, { f: [392, 523, 659, 784, 1047][i], type: 'triangle', gain: 0.1 })); this.noise(d, t, 1.2, { f: 300, f2: 3000, q: 3, gain: 0.08 }); break;
      case 'friend': [0, 0.09, 0.18].forEach((k, i) => this.tone(d, t + k, 0.18, { f: [880, 1175, 1568][i], type: 'square', gain: 0.03 })); break;
      case 'beep': this.tone(d, t, 0.08, { f: 1200 * p, type: 'square', gain: 0.025 }); this.tone(d, t + 0.1, 0.08, { f: 1600 * p, type: 'square', gain: 0.025 }); break;
      case 'emote': {
        const m = o.mood || 'happy';
        const seq = { happy: [988, 1319], sad: [784, 587], surprised: [700, 1400], curious: [880, 1175, 990], worried: [660, 620, 580], sleepy: [520, 440], love: [1047, 1319, 1568] }[m] || [900, 1200];
        seq.forEach((f, i) => this.tone(d, t + i * 0.085, 0.09, { f, type: 'square', gain: 0.018 })); break;
      }
      case 'pickup': this.tone(d, t, 0.1, { f: 600, f2: 900, type: 'triangle', gain: 0.1 }); break;
      case 'drop': this.noise(d, t, 0.08, { type: 'lowpass', f: 700, gain: 0.3 }); break;
      case 'throw': this.noise(d, t, 0.2, { f: 1800, f2: 600, q: 1, gain: 0.2 }); break;
      case 'kick': this.tone(d, t, 0.08, { f: 150, f2: 90, gain: 0.4 }); this.noise(d, t, 0.05, { f: 1500, q: 1, gain: 0.2 }); break;
      case 'bounce': this.tone(d, t, 0.09, { f: 300 * p, f2: 200, type: 'sine', gain: 0.25 * vol }); break;
      case 'thud': this.tone(d, t, 0.18, { f: 120, f2: 70, gain: 0.4 * vol }); this.noise(d, t, 0.1, { type: 'lowpass', f: 600, gain: 0.3 * vol }); break;
      case 'clack': this.noise(d, t, 0.05, { f: 2400, q: 4, gain: 0.3 * vol }); break;
      case 'grab': this.tone(d, t, 0.05, { f: 500, type: 'square', gain: 0.03 }); this.noise(d, t, 0.05, { f: 1200, q: 2, gain: 0.15 }); break;
      case 'gate': this.noise(d, t, 1.6, { f: 300, f2: 900, q: 6, gain: 0.25 }); this.tone(d, t, 1.4, { f: 90, f2: 140, type: 'sawtooth', gain: 0.05 }); this.tone(d, t + 1.4, 0.4, { f: 70, gain: 0.3 }); break;
      case 'power': this.tone(d, t, 0.8, { f: 60, f2: 240, type: 'sawtooth', gain: 0.08 }); this.tone(d, t + 0.6, 0.4, { f: 1200, type: 'sine', gain: 0.08 }); break;
      case 'deny': this.tone(d, t, 0.12, { f: 220, type: 'square', gain: 0.05 }); this.tone(d, t + 0.14, 0.18, { f: 165, type: 'square', gain: 0.05 }); break;
      case 'lever': this.noise(d, t, 0.12, { f: 2200, q: 5, gain: 0.25 }); this.tone(d, t, 0.1, { f: 300, type: 'square', gain: 0.03 }); break;
      case 'clunk': this.tone(d, t, 0.2, { f: 90, f2: 60, gain: 0.4 }); this.noise(d, t, 0.15, { f: 900, q: 2, gain: 0.2 }); break;
      case 'grabledge': this.noise(d, t, 0.06, { f: 1500, q: 2, gain: 0.2 }); this.tone(d, t, 0.05, { f: 1400, type: 'square', gain: 0.012 }); break;
      case 'bird': {
        const base = 2600 + Math.random() * 1600, n = 2 + Math.floor(Math.random() * 4);
        for (let i = 0; i < n; i++) this.tone(d, t + i * (0.09 + Math.random() * 0.05), 0.08, { f: base * (0.9 + Math.random() * 0.25), f2: base * (1.15 + Math.random() * 0.3), gain: 0.06 });
        break;
      }
      case 'flap': for (let i = 0; i < 5; i++) this.noise(d, t + i * 0.05, 0.05, { f: 700, q: 1, gain: 0.2 }); break;
      case 'chitter': for (let i = 0; i < 6; i++) this.tone(d, t + i * 0.035, 0.03, { f: 3200 + Math.random() * 800, type: 'square', gain: 0.012 }); break;
    }
  }

  setLoop(name, level, pos) {
    if (!this.ctx) return;
    let L = this.loops[name];
    if (!L) {
      const C = this.ctx;
      const d = this.out(pos, this.sfx, 0.2); d.gain.value = 0;
      const s = C.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
      const f = C.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = name === 'lift' ? 220 : name === 'hover' ? 1800 : 800; f.Q.value = 2;
      s.connect(f); f.connect(d); s.start();
      L = this.loops[name] = { d, f };
      if (name === 'lift') { const o = C.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 55; const g = C.createGain(); g.gain.value = 0.05; o.connect(g); g.connect(d); o.start(); }
    }
    L.d.gain.setTargetAtTime(level, this.ctx.currentTime, 0.08);
  }

  // ---- ambience: wind, leaves, distant birds, stream, insects
  startAmbience() {
    const C = this.ctx;
    const wind = C.createBufferSource(); wind.buffer = this.noiseBuf; wind.loop = true;
    const wf = C.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.value = 420;
    const wg = C.createGain(); wg.gain.value = 0.12;
    wind.connect(wf); wf.connect(wg); wg.connect(this.amb); wind.start();
    const leaves = C.createBufferSource(); leaves.buffer = this.noiseBuf; leaves.loop = true;
    const lf = C.createBiquadFilter(); lf.type = 'highpass'; lf.frequency.value = 3500;
    const lg = C.createGain(); lg.gain.value = 0.02;
    leaves.connect(lf); lf.connect(lg); lg.connect(this.amb); leaves.start();
    this.windNodes = { wf, wg, lg };
    // stream: positional loops along the water
    this.waterSources = [];
    this.nextBird = 2; this.nextInsect = 4; this.t = 0;
  }
  addWaterSource(pos, level = 0.25, bright = 1) {
    if (!this.ctx) return;
    const C = this.ctx;
    const d = this.out(pos, this.amb, 0.1); d.gain.value = level;
    const s = C.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true; s.playbackRate.value = 0.9 + Math.random() * 0.2;
    const f = C.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900 * bright; f.Q.value = 0.6;
    const f2 = C.createBiquadFilter(); f2.type = 'peaking'; f2.frequency.value = 2400 * bright; f2.gain.value = 6;
    s.connect(f); f.connect(f2); f2.connect(d); s.start(0, Math.random());
    this.waterSources.push(d);
  }
  updateAmbience(dt, playerPos, windK = 1, cave = 0) {
    if (!this.ctx) return;
    this.t += dt;
    const w = this.windNodes;
    const gust = 0.6 + 0.4 * Math.sin(this.t * 0.23) * Math.sin(this.t * 0.37);
    w.wg.gain.setTargetAtTime(0.11 * gust * windK * (1 - cave * 0.7), this.ctx.currentTime, 0.5);
    w.wf.frequency.setTargetAtTime(300 + 300 * gust, this.ctx.currentTime, 0.5);
    w.lg.gain.setTargetAtTime(0.025 * gust * windK * (1 - cave), this.ctx.currentTime, 0.5);
    this.nextBird -= dt;
    if (this.nextBird <= 0 && cave < 0.5) {
      this.nextBird = 2 + Math.random() * 6;
      const a = Math.random() * 6.28, r = 6 + Math.random() * 14;
      this.play('bird', { pos: { x: playerPos.x + Math.cos(a) * r, y: playerPos.y + 4 + Math.random() * 6, z: playerPos.z + Math.sin(a) * r }, verb: 0.5 });
    }
  }

  // ---- background music: gentle generative piece in D major pentatonic (original)
  startMusic() {
    const C = this.ctx;
    this.musicT = C.currentTime + 0.5;
    const scale = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
    const chords = [[50, 57, 62, 66], [47, 54, 59, 62], [43, 50, 55, 59], [45, 52, 57, 61]]; // D, Bm, G, A (midi)
    const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
    let bar = 0, motif = [0, 2, 4, 3, 2, 4, 5, 4];
    const schedule = () => {
      if (!this.ctx) return;
      while (this.musicT < C.currentTime + 1.2) {
        const t0 = this.musicT, beat = 0.42, ch = chords[bar % 4];
        // soft pad
        for (const n of ch) {
          const o = C.createOscillator(); o.type = 'triangle'; o.frequency.value = mtof(n - 12) * (1 + (Math.random() - 0.5) * 0.002);
          const g = C.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.022, t0 + 0.8); g.gain.linearRampToValueAtTime(0.0, t0 + beat * 8 + 0.4);
          const f = C.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
          o.connect(f); f.connect(g); g.connect(this.mus); const v = C.createGain(); v.gain.value = 0.5; g.connect(v); v.connect(this.verb);
          o.start(t0); o.stop(t0 + beat * 8 + 0.5);
        }
        // plucked melody (kalimba-like), evolving motif
        if (bar % 8 === 0) motif = motif.map((m) => Math.max(0, Math.min(9, m + Math.round((Math.random() - 0.5) * 2))));
        for (let i = 0; i < 8; i++) {
          if (Math.random() < 0.28) continue;
          const tt = t0 + i * beat + (i % 2 ? 0.02 : 0);
          const m = 62 + scale[motif[(i + bar) % 8]];
          const f0 = mtof(m);
          const o = C.createOscillator(); o.type = 'sine'; o.frequency.value = f0;
          const o2 = C.createOscillator(); o2.type = 'sine'; o2.frequency.value = f0 * 3.01;
          const g = C.createGain(); g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(0.05, tt + 0.006); g.gain.exponentialRampToValueAtTime(0.0005, tt + 1.4);
          const g2 = C.createGain(); g2.gain.value = 0.25;
          o.connect(g); o2.connect(g2); g2.connect(g); g.connect(this.mus);
          const v = C.createGain(); v.gain.value = 0.8; g.connect(v); v.connect(this.verb);
          o.start(tt); o2.start(tt); o.stop(tt + 1.5); o2.stop(tt + 1.5);
        }
        // light shaker on off-beats
        for (let i = 0; i < 8; i++) if (i % 2 === 1 && bar % 2 === 1) this.noise(this.mus, t0 + i * beat, 0.05, { type: 'highpass', f: 7000, gain: 0.03 });
        // soft bass
        const b = C.createOscillator(); b.type = 'sine'; b.frequency.value = mtof(ch[0] - 12);
        const bg = C.createGain(); bg.gain.setValueAtTime(0, t0); bg.gain.linearRampToValueAtTime(0.07, t0 + 0.05); bg.gain.exponentialRampToValueAtTime(0.001, t0 + beat * 4);
        b.connect(bg); bg.connect(this.mus); b.start(t0); b.stop(t0 + beat * 4 + 0.1);
        this.musicT += beat * 8; bar++;
      }
      this.musicTimer = setTimeout(schedule, 300);
    };
    schedule();
  }
}
