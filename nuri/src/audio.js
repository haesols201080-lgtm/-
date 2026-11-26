// Web Audio: sound effects, ambience and an original generative score. Ambience, footsteps, birds and the music's
// piano are physically-modelled sounds rendered once into buffers (src/soundbank.js); positional sources use HRTF
// panners driven by the camera; forest and cave reverbs crossfade with where the robot is.
import { makeBank, impulse } from './soundbank.js';
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
    // reverbs: open forest (short, soft, diffuse) and the cave (long, dark); sends go to both, their levels follow the place
    this.verb = C.createGain();
    const fv = C.createConvolver(); fv.buffer = impulse(C, 1.5, 3.2, 0.45, 8);
    const cv = C.createConvolver(); cv.buffer = impulse(C, 3.4, 2.2, 0.25, 14);
    this.vForest = C.createGain(); this.vForest.gain.value = 0.26; this.vCave = C.createGain(); this.vCave.gain.value = 0.0;
    this.verb.connect(fv); this.verb.connect(cv); fv.connect(this.vForest); cv.connect(this.vCave); this.vForest.connect(this.comp); this.vCave.connect(this.comp);
    this.noiseBuf = this.makeNoise(2);
    this.bank = makeBank(C);
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
        const bank = this.bank?.steps[s === 'water' ? 'water' : s] || this.bank?.steps.leaves;
        if (bank) {
          const src = C.createBufferSource(); src.buffer = bank[Math.floor(Math.random() * bank.length)]; src.playbackRate.value = (0.92 + Math.random() * 0.16) * (p || 1);
          const g = C.createGain(); g.gain.value = 0.55; src.connect(g); g.connect(d); src.start(t);
          this.tone(d, t, 0.05, { f: 2100 + Math.random() * 300, f2: 2500, type: 'sine', gain: 0.006 });   // the boot's servo
          break;
        }
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
      case 'splash': if (this.bank) { const src = C.createBufferSource(); src.buffer = this.bank.steps.water[Math.floor(Math.random() * 4)]; src.playbackRate.value = 0.7 + Math.random() * 0.2; const g = C.createGain(); g.gain.value = 0.7 * vol; src.connect(g); g.connect(d); src.start(t); }
        this.noise(d, t, 0.6, { f: 1400, f2: 300, q: 0.8, gain: 0.45 * vol }); this.noise(d, t + 0.05, 0.35, { f: 4000, q: 2, gain: 0.2 }); break;
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
        if (this.bank) {
          const r = Math.random(), B = this.bank;
          const b = r < 0.72 ? B.birds[Math.floor(Math.random() * B.birds.length)] : r < 0.86 ? B.dove : B.woodpecker;
          const src = C.createBufferSource(); src.buffer = b; src.playbackRate.value = 0.94 + Math.random() * 0.12;
          const g = C.createGain(); g.gain.value = b === B.woodpecker ? 0.35 : 0.22; src.connect(g); g.connect(d); src.start(t);
          break;
        }
        const base = 2600 + Math.random() * 1600, n = 2 + Math.floor(Math.random() * 4);
        for (let i = 0; i < n; i++) this.tone(d, t + i * (0.09 + Math.random() * 0.05), 0.08, { f: base * (0.9 + Math.random() * 0.25), f2: base * (1.15 + Math.random() * 0.3), gain: 0.06 });
        break;
      }
      case 'flap': for (let i = 0; i < 5; i++) this.noise(d, t + i * 0.05, 0.05, { f: 700, q: 1, gain: 0.2 }); break;
      case 'chitter': for (let i = 0; i < 6; i++) this.tone(d, t + i * 0.035, 0.03, { f: 3200 + Math.random() * 800, type: 'square', gain: 0.012 }); break;
      // chapter 2: the stranger asleep, the flat, the car
      case 'snore': {
        // a slow nasal intake, then the soft buzzing breath out (a low sawtooth through a closed-mouth formant)
        this.noise(d, t, 1.1, { type: 'bandpass', f: 380, f2: 620, q: 1.4, gain: 0.05, attack: 0.5 });
        const o = this.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(62, t + 1.2); o.frequency.linearRampToValueAtTime(54, t + 2.4);
        const lp2 = this.ctx.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = 260; lp2.Q.value = 3;
        const g = this.ctx.createGain(); g.gain.setValueAtTime(0, t + 1.2); g.gain.linearRampToValueAtTime(0.07, t + 1.45); g.gain.exponentialRampToValueAtTime(0.001, t + 2.5);
        o.connect(lp2); lp2.connect(g); g.connect(d); o.start(t + 1.2); o.stop(t + 2.6);
        this.noise(d, t + 1.2, 1.2, { type: 'lowpass', f: 500, q: 0.7, gain: 0.03, attack: 0.2 });
        break;
      }
      case 'mumble': for (let i = 0; i < 3; i++) this.tone(d, t + i * 0.22, 0.26, { f: 150 + Math.random() * 40, f2: 120 + Math.random() * 30, type: 'triangle', gain: 0.06, attack: 0.04 }); this.noise(d, t, 0.7, { type: 'lowpass', f: 700, gain: 0.04, attack: 0.1 }); break;
      case 'click': this.noise(d, t, 0.03, { type: 'highpass', f: 3000, gain: 0.5 }); this.tone(d, t, 0.04, { f: 1800, f2: 900, type: 'square', gain: 0.05 }); break;
      case 'cardoor': this.noise(d, t, 0.35, { type: 'lowpass', f: 300, gain: 0.9 }); this.tone(d, t, 0.25, { f: 70, f2: 45, gain: 0.5 }); this.noise(d, t + 0.02, 0.08, { type: 'bandpass', f: 2200, q: 2, gain: 0.2 }); break;
      case 'blinker': this.tone(d, t, 0.03, { f: 2400, type: 'square', gain: 0.03 }); this.tone(d, t + 0.36, 0.03, { f: 1900, type: 'square', gain: 0.025 }); break;
    }
  }

  setLoop(name, level, pos) {
    if (!this.ctx) return;
    let L = this.loops[name];
    if (!L) {
      const C = this.ctx;
      const d = this.out(pos, this.sfx, 0.2); d.gain.value = 0;
      const s = C.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
      const f = C.createBiquadFilter(); f.type = name === 'engine' ? 'lowpass' : 'bandpass'; f.frequency.value = name === 'lift' ? 220 : name === 'hover' ? 1800 : name === 'engine' ? 160 : name === 'city' ? 420 : 800; f.Q.value = name === 'engine' ? 0.8 : 2;
      s.connect(f); f.connect(d); s.start();
      L = this.loops[name] = { d, f };
      if (name === 'lift') { const o = C.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 55; const g = C.createGain(); g.gain.value = 0.05; o.connect(g); g.connect(d); o.start(); }
      if (name === 'engine') { const o = C.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 38; const lp3 = C.createBiquadFilter(); lp3.type = 'lowpass'; lp3.frequency.value = 120; const g = C.createGain(); g.gain.value = 0.35; o.connect(lp3); lp3.connect(g); g.connect(d); o.start(); }
    }
    L.d.gain.setTargetAtTime(level, this.ctx.currentTime, 0.08);
  }

  // ---- ambience: wind and leaves (baked gusts), crickets, birds around in the canopy, water sources
  loopSrc(buffer, dest, gain, rate = 1) {
    const C = this.ctx, src = C.createBufferSource(); src.buffer = buffer; src.loop = true; src.playbackRate.value = rate;
    const g = C.createGain(); g.gain.value = gain; src.connect(g); g.connect(dest); src.start(0, Math.random() * buffer.duration); return g;
  }
  startAmbience() {
    const B = this.bank;
    this.windG = this.loopSrc(B.wind, this.amb, 0.16);
    this.leavesG = this.loopSrc(B.leaves, this.amb, 0.05);
    this.cricketG = this.loopSrc(B.crickets, this.amb, 0.0, 1);
    this.waterSources = [];
    this.nextBird = 1.5; this.t = 0;
  }
  addWaterSource(pos, level = 0.25, bright = 1) {
    if (!this.ctx) return;
    const B = this.bank, buf = level >= 0.6 ? B.fall : (this.waterSources.length % 2 ? B.brook : B.stream);
    const d = this.out(pos, this.amb, 0.12);
    d.gain.value = level * (level >= 0.6 ? 1.1 : 2.2);
    this.loopSrc(buf, d, 1, 0.92 + Math.random() * 0.16 * bright);
    this.waterSources.push(d);
  }
  updateAmbience(dt, playerPos, windK = 1, cave = 0) {
    if (!this.ctx) return;
    this.t += dt;
    const now = this.ctx.currentTime;
    this.windG.gain.setTargetAtTime(0.16 * windK * (1 - cave * 0.8), now, 0.6);
    this.leavesG.gain.setTargetAtTime(0.06 * windK * (1 - cave), now, 0.6);
    this.cricketG.gain.setTargetAtTime(0.012 * (1 - cave), now, 1);
    this.vForest.gain.setTargetAtTime(0.26 * (1 - cave), now, 0.4);
    this.vCave.gain.setTargetAtTime(0.5 * cave, now, 0.4);
    this.mood = cave > 0.5 ? 'cave' : 'forest';
    this.nextBird -= dt;
    if (this.nextBird <= 0 && cave < 0.5) {
      this.nextBird = 2.5 + Math.random() * 6;
      const a = Math.random() * 6.28, r = 7 + Math.random() * 16;
      this.play('bird', { pos: { x: playerPos.x + Math.cos(a) * r, y: playerPos.y + 4 + Math.random() * 7, z: playerPos.z + Math.sin(a) * r }, verb: 0.55 });
    }
  }
  // the score lifts for a while after something is found (discovery, a friend, a relic)
  lift(sec = 20) { this.liftT = Math.max(this.liftT || 0, sec); }

  // ---- background music: an original, slow generative piece for felt piano and a soft pad.
  // D major in the open forest (Dmaj9 – Bm11 – Gmaj7 – A sus), sparse phrases that repeat and vary; in the cave it
  // turns to B minor, lower and thinner; after a discovery it opens up for a while (fuller pad, more notes).
  startMusic() {
    const C = this.ctx;
    this.musicT = C.currentTime + 1.0;
    const PENT = [62, 64, 66, 69, 71, 74, 76, 78, 81, 83];
    const forest = [[50, [62, 66, 69, 73, 76]], [47, [62, 66, 69, 71, 74]], [43, [62, 66, 69, 71, 74]], [45, [62, 64, 69, 71, 76]]];
    const cave = [[47, [62, 66, 69, 71]], [43, [59, 62, 66, 69]], [45, [61, 64, 69, 71]], [42, [61, 66, 69, 73]]];
    const near = (m) => { const keys = Object.keys(this.bank.piano).map(Number); return keys.reduce((a, k) => (Math.abs(k - m) < Math.abs(a - m) ? k : a), keys[0]); };
    const note = (m, t, v, dest = this.mus) => {
      const k = near(m), src = C.createBufferSource(); src.buffer = this.bank.piano[k]; src.playbackRate.value = Math.pow(2, (m - k) / 12);
      const g = C.createGain(); g.gain.value = v; src.connect(g); g.connect(dest);
      const sv = C.createGain(); sv.gain.value = 0.9; g.connect(sv); sv.connect(this.verb); src.start(t);
    };
    const pad = (notes, t, dur, lvl) => {
      for (const m of notes) for (const det of [-4, 4]) {
        const o = C.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 440 * Math.pow(2, (m - 69) / 12); o.detune.value = det;
        const f = C.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 650; f.Q.value = 0.4;
        const g = C.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(lvl, t + dur * 0.35); g.gain.linearRampToValueAtTime(0, t + dur + 1.2);
        o.connect(f); f.connect(g); g.connect(this.mus); const sv = C.createGain(); sv.gain.value = 0.6; g.connect(sv); sv.connect(this.verb);
        o.start(t); o.stop(t + dur + 1.3);
      }
    };
    let bar = 0, phrase = this.newPhrase(PENT);
    const schedule = () => {
      if (!this.ctx) return;
      while (this.musicT < C.currentTime + 2.0) {
        const caveMode = this.mood === 'cave', prog = caveMode ? cave : forest, beat = caveMode ? 1.05 : 0.9;
        const [root, chord] = prog[bar % 4], t0 = this.musicT, lift = (this.liftT || 0) > 0 ? 1 : 0;
        // left hand: a slow broken chord low down
        note(root, t0, 0.22); note(root + 7, t0 + beat * 1.5, 0.14); note(root + 16, t0 + beat * 2.5, 0.11);
        // the pad only under lifted moments (and softly in the cave)
        if (lift || caveMode) pad(chord.slice(0, 3).map((m) => m - 12), t0, beat * 4, caveMode ? 0.006 : 0.009);
        // right hand: the phrase (2 bars), repeated with small changes; rests are part of it
        if (bar % 4 === 0) phrase = Math.random() < 0.6 ? this.varyPhrase(phrase, PENT) : this.newPhrase(PENT);
        for (const [pos, m] of phrase[bar % 2]) {
          if (!lift && Math.random() < 0.2) continue;
          const mm = caveMode ? m - 3 - 12 * (m > 74 ? 1 : 0) : m;
          note(mm, t0 + pos * beat + (Math.random() - 0.5) * 0.02, (caveMode ? 0.1 : 0.14) * (0.8 + Math.random() * 0.3));
        }
        this.musicT += beat * 4; bar++;
        if (this.liftT > 0) this.liftT -= beat * 4;
      }
      this.musicTimer = setTimeout(schedule, 400);
    };
    schedule();
  }
  newPhrase(P) {
    const bar = () => { const out = []; let pos = Math.random() < 0.5 ? 0 : 0.5, i = 2 + Math.floor(Math.random() * 5);
      while (pos < 4) { if (Math.random() < 0.72) out.push([pos, P[Math.max(0, Math.min(P.length - 1, i))]]); i += Math.round((Math.random() - 0.5) * 3); pos += [0.5, 1, 1, 1.5][Math.floor(Math.random() * 4)]; } return out; };
    return [bar(), bar()];
  }
  varyPhrase(ph, P) { return ph.map((b) => b.map(([pos, m]) => [pos, Math.random() < 0.25 ? P[Math.max(0, Math.min(P.length - 1, P.indexOf(m) + (Math.random() < 0.5 ? -1 : 1)))] : m])); }
}
