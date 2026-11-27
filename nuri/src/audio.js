// Web Audio: sound effects, ambience and an original generative score. Ambience, footsteps, birds and the music's
// piano are physically-modelled sounds rendered once into buffers (src/soundbank.js); positional sources use HRTF
// panners driven by the camera; forest and cave reverbs crossfade with where the robot is.
// In the house (chapter 2) the bank is chapter 2's own (src/housebank.js, rendered in a worker): each room has its
// acoustics (a furnished room is short and soft, the hall and the stairwell, the kitchen and the laundry livelier);
// what is in another room comes through the doorways quieter and duller, from another floor much more so; everything
// outside comes through the walls (only the low end) until the robot is out on the deck; the house's own sounds
// (the fridge's cycle, the clocks, the radiators, the joists) and the city's run on their own clocks.
import { makeBank, impulse } from './soundbank.js';
import { houseBankJobs } from './housebank.js';
import HouseBankWorker from './housebank.worker.js?worker&inline';
const rnd = (a, b) => a + Math.random() * (b - a);
// (sounds only chapter 2's bank has: silent until it has rendered them)
const HOUSE_ONLY = new Set(['purr', 'hiss', 'growl', 'yowl', 'meow', 'trill', 'pad', 'scrabble', 'catLand', 'wicker', 'wickerBig', 'flapSwing', 'latch', 'lamp', 'rustle', 'bedCreak',
  'bootConcrete', 'bootPorch', 'bootFloor', 'bootStair', 'keys', 'lock', 'doorOpen', 'doorShut', 'carDoor', 'joint', 'horn', 'siren', 'airBrake', 'handbrake', 'engineOff',
  'fridgeOn', 'fridgeOff', 'fridgeGurgle', 'ice', 'chime', 'radKnock', 'radTick', 'creak', 'settle', 'car', 'train', 'plane', 'dog']);
const ALT = { carDoor: 'cardoor', lamp: 'click', latch: 'click', flapSwing: 'clack', doorShut: 'clunk', wickerBig: 'clunk', wicker: 'thud' };
// how much of one room's sound reaches another (through open doors and the stairwell; the rest is through the walls)
const LINK = { 'kitchen|living': 0.6, 'hall|living': 0.5, 'hall|kitchen': 0.45, 'kitchen|laundry': 0.3, 'hall|laundry': 0.45, 'hall|landing': 0.4,
  'bedroom|landing': 0.45, 'back|landing': 0.4, 'kitchen|out': 0.12, 'living|out': 0.08, 'hall|out': 0.08, 'laundry|out': 0.1 };
// the share of each room's reverb: furnished and soft, or bare and hard
const ROOMS = { living: [0.22, 0.04], kitchen: [0.1, 0.22], hall: [0.06, 0.32], laundry: [0.05, 0.36], bedroom: [0.24, 0.03], landing: [0.1, 0.26], back: [0.12, 0.2], out: [0, 0] };
export class Audio {
  constructor({ place = 'forest' } = {}) {
    this.ctx = null; this.vol = { master: 0.8, music: 0.5, sfx: 0.8 }; this.loops = {};
    this.place = place; this.hb = {}; this.srcs = []; this.musicK = 1; this.tension = 0;
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
    if (this.place === 'house') {
      this.vForest.gain.value = 0;
      // the rooms: a furnished one (short, soft, dark) and a bare one (longer, brighter, its early reflections close)
      const ra = C.createConvolver(); ra.buffer = impulse(C, 0.7, 5, 0.25, 22);
      const rb = C.createConvolver(); rb.buffer = impulse(C, 1.2, 3.6, 0.5, 28);
      this.vSoft = C.createGain(); this.vSoft.gain.value = 0.2; this.vBare = C.createGain(); this.vBare.gain.value = 0;
      this.verb.connect(ra); this.verb.connect(rb); ra.connect(this.vSoft); rb.connect(this.vBare); this.vSoft.connect(this.comp); this.vBare.connect(this.comp);
      // everything outside comes in through the walls: a low pass and a level that open up when the robot is out
      this.outBus = C.createGain(); this.outLP = C.createBiquadFilter(); this.outLP.type = 'lowpass'; this.outLP.frequency.value = 600; this.outLP.Q.value = 0.5;
      this.outG = C.createGain(); this.outG.gain.value = 0.3; this.outBus.connect(this.outLP); this.outLP.connect(this.outG); this.outG.connect(this.amb);
      this.loadHouseBank();
    } else { this.bank = makeBank(C); this.startAmbience(); }
    this.applyVolume();
    this.startMusic();
  }
  applyVolume() {
    if (!this.ctx) return;
    this.master.gain.value = this.vol.master; this.mus.gain.value = this.vol.music * 0.5 * this.musicK; this.sfx.gain.value = this.vol.sfx; this.amb.gain.value = this.vol.sfx * 0.7;
  }
  // the music's level for the moment (a cutscene in the dark, the house at night), eased
  setMusic(k, sec = 2) { this.musicK = k; if (this.ctx) this.mus.gain.setTargetAtTime(this.vol.music * 0.5 * k, this.ctx.currentTime, sec / 3); }
  // ---- chapter 2's bank, from a worker (or, where workers aren't allowed, a few sounds per frame here)
  loadHouseBank() {
    const C = this.ctx;
    const real = (v) => {
      if (v && v.__buf) { const b = C.createBuffer(v.ch, v.n, v.r); v.d.forEach((a, c) => b.copyToChannel(a, c)); return b; }
      if (Array.isArray(v)) return v.map(real);
      if (v && typeof v === 'object') { const o = {}; for (const k in v) o[k] = real(v[k]); return o; }
      return v;
    };
    const take = (name, i, val) => {
      if (name === 'base') { this.bank = val; return; }
      if (i !== undefined) (this.hb[name] || (this.hb[name] = []))[i] = val; else this.hb[name] = val;
    };
    const fallback = () => {
      if (this.bankLocal) return; this.bankLocal = true; try { this.worker?.terminate(); } catch (e) { /* */ }
      const jobs = [['base', () => makeBank(C, { place: 'house' })], ...houseBankJobs(C)].filter(([n]) => !(n in this.hb) && !(n === 'base' && this.bank));
      const queue = []; for (const [n, f, cnt] of jobs) { if (cnt) for (let i = 0; i < cnt; i++) queue.push([n, () => f(i), i]); else queue.push([n, f]); }
      const run = () => { const t0 = performance.now(); while (queue.length && performance.now() - t0 < 8) { const [n, f, i] = queue.shift(); try { take(n, i, f()); } catch (e) { console.warn('sound', n, e); } } if (queue.length) setTimeout(run, 30); else this.bankReady = true; };
      run();
    };
    try {
      const w = this.worker = new HouseBankWorker();
      const guard = setTimeout(() => { if (!this.bank) fallback(); }, 4000);
      w.onmessage = (e) => { if (this.bankLocal) return; const m = e.data; if (m.done) { this.bankReady = true; clearTimeout(guard); w.terminate(); return; } if (m.error) { console.warn('sound', m.name, m.error); return; } take(m.name, m.i, real(m.val)); };
      w.onerror = (e) => { console.warn('sound worker', e.message); e.preventDefault?.(); fallback(); };
      w.postMessage({ sampleRate: C.sampleRate });
    } catch (e) { fallback(); }
  }
  pick(name) { const b = this.hb[name]; if (!b) return null; if (Array.isArray(b)) { const ok = b.filter(Boolean); return ok.length ? ok[Math.floor(Math.random() * ok.length)] : null; } return b; }
  // play one of the bank's buffers into a destination
  buf(dest, b, { rate = 1, gain = 1, at = 0, offset = 0 } = {}) {
    const C = this.ctx, src = C.createBufferSource(); src.buffer = b; src.playbackRate.value = rate;
    const g = C.createGain(); g.gain.value = gain; src.connect(g); g.connect(dest); src.start(C.currentTime + at, offset); return src;
  }
  // ---- the house: where things are
  setLayout(H) { this.layout = H; }
  roomAt(p) {
    const H = this.layout; if (!H || !p) return null;
    if (p.x < H.x0 - 0.02 || p.x > H.x1 + 0.02 || p.z < H.z0 - 0.02 || p.z > H.z1 + 0.02 || p.y < -0.25) return 'out';
    if (p.y > H.U - 0.45) return p.x >= H.part ? 'landing' : p.z < H.kz ? 'bedroom' : 'back';
    if (p.x >= H.part) return p.z > H.hz ? 'laundry' : 'hall';
    return p.z < H.kz ? 'living' : 'kitchen';
  }
  // what gets from room a to room b: a level, a low pass cut-off, a reverb share
  link(a, b) {
    if (!a || !b || a === b) return null;
    const key = a < b ? a + '|' + b : b + '|' + a, up = (r) => r === 'landing' || r === 'bedroom' || r === 'back';
    let k = LINK[key];
    if (k === undefined) k = a === 'out' || b === 'out' ? 0.06 : up(a) === up(b) ? 0.22 : 0.07;
    if (this.flapOpen && key === 'kitchen|out') k = 0.3;
    return { k, cut: 350 + 14000 * k * k, verb: 0.5 + k };
  }
  occlusion(pos) { return this.place === 'house' && this.layout ? this.link(this.roomAt(pos), this.here) : null; }
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
  panner(pos, ref = 0.6, roll = 1.2) {
    const pan = this.ctx.createPanner(); pan.panningModel = 'HRTF'; pan.distanceModel = 'inverse'; pan.refDistance = ref; pan.maxDistance = 2000; pan.rolloffFactor = roll;
    pan.positionX.value = pos.x; pan.positionY.value = pos.y; pan.positionZ.value = pos.z; return pan;
  }
  out(pos, bus = this.sfx, verb = 0.3, ref = 0.6, occlude = true) {
    const C = this.ctx;
    const g = C.createGain();
    if (pos) {
      const pan = this.panner(pos, ref);
      // (heard from another room: quieter, duller, more of it reverberant)
      const oc = occlude ? this.occlusion(pos) : null; let tail = g;
      if (oc) { const f = C.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = oc.cut; const k = C.createGain(); k.gain.value = oc.k; g.connect(f); f.connect(k); tail = k; }
      tail.connect(pan); pan.connect(bus); if (verb) { const v = C.createGain(); v.gain.value = verb * (oc ? oc.verb : 1); pan.connect(v); v.connect(this.verb); }
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
    // chapter 2's bank has its own recording of most things: one of its variants, a little different each time
    const hb = name !== 'step' && this.pick(name);
    if (hb) { const d = this.out(o.pos, o.bus || this.sfx, o.verb ?? 0.25, o.ref ?? 0.6); d.gain.value = vol; this.buf(d, hb, { rate: p * (o.exact ? 1 : rnd(0.96, 1.04)), at: o.at || 0 }); return; }
    if (this.place === 'house' && ALT[name]) return this.play(ALT[name], o);                    // (not rendered yet: the simple one)
    if (this.place === 'house' && HOUSE_ONLY.has(name)) return;
    const d = this.out(o.pos, this.sfx, o.verb ?? 0.25);
    d.gain.value = vol;
    switch (name) {
      case 'step': {
        const s = o.surface || 'leaves';
        const bank = this.bank?.steps[s === 'water' ? 'water' : s] || this.bank?.steps.leaves || this.bank?.steps.wood;
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

  // ---- chapter 2: sources that sound all the time where they are (a clock, the fridge), and loops that follow
  // something (the cat purring); each heard through the rooms between it and the robot
  source(key, bufName, pos, { gain = 0.3, ref = 0.5, roll = 1, rate = 1, verb = 0.15, on = 1, tau = 0.5, bus } = {}) {
    const b = this.pick(bufName); if (!b || !this.ctx) return null;
    const C = this.ctx, src = C.createBufferSource(); src.buffer = b; src.loop = true; src.playbackRate.value = rate;
    const g = C.createGain(); g.gain.value = 0; const f = C.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 18000;
    const pan = this.panner(pos, ref, roll); src.connect(g); g.connect(f); f.connect(pan); pan.connect(bus || this.amb);
    const v = C.createGain(); v.gain.value = verb; pan.connect(v); v.connect(this.verb);
    src.start(0, Math.random() * b.duration);
    const S = { key, src, g, f, pan, v, verb, base: gain, on, tau, pos: { x: pos.x, y: pos.y, z: pos.z }, room: this.roomAt(pos) };
    this.srcs.push(S); return S;
  }
  moveSource(S, pos) { if (!S) return; S.pos.x = pos.x; S.pos.y = pos.y; S.pos.z = pos.z; S.pan.positionX.value = pos.x; S.pan.positionY.value = pos.y; S.pan.positionZ.value = pos.z; S.room = this.roomAt(pos); }
  // a loop that follows something about, made when its sound is ready
  follow(key, bufName, pos, level, opts = {}) {
    if (!this.ctx) return;
    let S = this.srcs.find((x) => x.key === key);
    if (!S) { if (level <= 0) return; S = this.source(key, bufName, pos, { ...opts, gain: 1, on: 0 }); if (!S) return; }
    this.moveSource(S, pos); S.on = level;
  }
  // the house's sources and its night, set up when the robot climbs out of the basket
  startHouse(spots) {
    this.spots = spots; this.night = { t: 0, fridgeOn: true, fridgeT: rnd(25, 50), rad: spots.radiators.map(() => ({ on: Math.random() < 0.6, t: rnd(10, 40) })),
      next: { car: rnd(4, 10), horn: rnd(30, 60), siren: rnd(40, 80), train: rnd(50, 90), plane: rnd(70, 130), dog: rnd(35, 80), knock: rnd(15, 35), tick: rnd(8, 20), creak: rnd(6, 16), ice: rnd(90, 160), chime: rnd(60, 80) }, chimes: 0 };
    this.setMusic(0.75, 4);
  }
  ensureHouseSources() {
    const P = this.spots; if (!P || this.houseSrcs) return;
    if (!['fridge', 'tickMantel', 'tickQuartz', 'tickAlarm', 'radHiss', 'city', 'breeze', 'crickets'].every((k) => this.hb[k])) return;
    this.houseSrcs = true;
    this.fridgeS = this.source('fridge', 'fridge', P.fridge, { gain: 0.32, ref: 0.6, tau: 0.6 });
    for (const c of P.clocks) this.source('clock', c.kind, c.pos, { gain: c.gain, ref: 0.3, verb: 0.25 });
    this.radS = P.radiators.map((r, i) => this.source('rad' + i, 'radHiss', r, { gain: 0.05, ref: 0.4, rate: rnd(0.9, 1.1), verb: 0.2, on: this.night.rad[i].on ? 1 : 0, tau: 2 }));
    // the city and the yard, through the walls
    const C = this.ctx, bed = C.createBufferSource(); bed.buffer = this.hb.city; bed.loop = true; this.cityG = C.createGain(); this.cityG.gain.value = 0.55; bed.connect(this.cityG); this.cityG.connect(this.outBus); bed.start(0, Math.random() * 20);
    const bz = C.createBufferSource(); bz.buffer = this.hb.breeze; bz.loop = true; this.breezeG = C.createGain(); this.breezeG.gain.value = 0.25; bz.connect(this.breezeG); this.breezeG.connect(this.outBus); bz.start(0, Math.random() * 10);
    const cr = C.createBufferSource(); cr.buffer = this.hb.crickets; cr.loop = true; cr.playbackRate.value = 0.94; this.crickG = C.createGain(); this.crickG.gain.value = 0; cr.connect(this.crickG); this.crickG.connect(this.outBus); cr.start(0, Math.random() * 3);
  }
  // something outside: through the walls (the out bus), placed (and moving, with the pitch of its passing) by a panner
  playOut(name, from, to, { vol = 1, ref = 10, dur, rate = 1, doppler = 0, verb = 0.25 } = {}) {
    const b = this.pick(name); if (!b || !this.ctx) return;
    const C = this.ctx, t = C.currentTime, T = dur || b.duration / rate, pan = this.panner(from, ref, 1), g = C.createGain(); g.gain.value = vol;
    if (to) { pan.positionX.setValueAtTime(from.x, t); pan.positionX.linearRampToValueAtTime(to.x, t + T); pan.positionY.setValueAtTime(from.y, t); pan.positionY.linearRampToValueAtTime(to.y, t + T); pan.positionZ.setValueAtTime(from.z, t); pan.positionZ.linearRampToValueAtTime(to.z, t + T); }
    const src = C.createBufferSource(); src.buffer = b; src.playbackRate.value = rate;
    if (to && doppler) {
      // the pitch of something going past at speed: c / (c + its speed away from us), the house at the origin
      const L = this.ctx.listener, lx = L.positionX ? L.positionX.value : 0, lz = L.positionZ ? L.positionZ.value : 0, n = 48, curve = new Float32Array(n);
      const vx = (to.x - from.x) / T, vy = (to.y - from.y) / T, vz = (to.z - from.z) / T;
      for (let i = 0; i < n; i++) { const u = i / (n - 1), x = from.x + (to.x - from.x) * u - lx, y = from.y + (to.y - from.y) * u, z = from.z + (to.z - from.z) * u - lz, r = Math.hypot(x, y, z) || 1; curve[i] = rate * 343 / (343 + (x * vx + y * vy + z * vz) / r); }
      src.playbackRate.setValueCurveAtTime(curve, t, T);
    }
    src.connect(g); g.connect(pan); pan.connect(this.outBus); const v = C.createGain(); v.gain.value = verb; pan.connect(v); v.connect(this.verb); src.start(t);
  }
  // each frame in the house: which room the robot is in, the acoustics, what reaches it, and the night going on
  updateHouse(dt, pos, { flapOpen = false } = {}) {
    if (!this.ctx || !this.layout) return;
    const now = this.ctx.currentTime, here = this.here = this.roomAt(pos), N = this.night; this.flapOpen = flapOpen;
    const R = ROOMS[here] || ROOMS.living, out = here === 'out';
    this.vSoft.gain.setTargetAtTime(R[0], now, 0.25); this.vBare.gain.setTargetAtTime(R[1], now, 0.25); this.vForest.gain.setTargetAtTime(out ? 0.16 : 0, now, 0.25);
    // the walls: outside is only its low end indoors (a little more by the open flap, a little more upstairs, nearer the roof)
    const nearFlap = flapOpen && here === 'kitchen' && this.spots && Math.hypot(pos.x - this.spots.flap.x, pos.z - this.spots.flap.z) < 1.6;
    const cut = out ? 9000 : nearFlap ? 2200 : here === 'landing' || here === 'bedroom' || here === 'back' ? 700 : 520;
    this.outLP.frequency.setTargetAtTime(cut, now, 0.3); this.outG.gain.setTargetAtTime(out ? 1 : nearFlap ? 0.55 : 0.32, now, 0.3);
    this.ensureHouseSources();
    if (this.crickG) { this.crickG.gain.setTargetAtTime(out ? 0.05 : 0, now, 0.5); this.breezeG.gain.setTargetAtTime(out ? 0.45 : 0.2, now, 0.5); }
    for (const S of this.srcs) {
      const oc = this.link(S.room, here), k = oc ? oc.k : 1;
      S.g.gain.setTargetAtTime(S.base * S.on * k, now, S.on ? S.tau : 0.06);
      S.f.frequency.setTargetAtTime(oc ? oc.cut : 18000, now, 0.15); S.v.gain.setTargetAtTime(S.verb * (oc ? oc.verb : 1), now, 0.2);
    }
    if (!N || !this.houseSrcs) return;
    N.t += dt; const P = this.spots, nx = N.next;
    // the fridge: the compressor runs a minute or so, rests, starts again; the ice maker drops its cubes now and then
    N.fridgeT -= dt;
    if (N.fridgeT <= 0) {
      N.fridgeOn = !N.fridgeOn; N.fridgeT = N.fridgeOn ? rnd(50, 90) : rnd(30, 55);
      this.play(N.fridgeOn ? 'fridgeOn' : 'fridgeOff', { pos: P.fridge, vol: 0.5, verb: 0.2 });
      if (!N.fridgeOn) this.play('fridgeGurgle', { pos: P.fridge, vol: 0.35, at: 1.2 });
      if (this.fridgeS) this.fridgeS.on = N.fridgeOn ? 1 : 0;
    }
    if ((nx.ice -= dt) <= 0) { nx.ice = rnd(150, 260); this.play('ice', { pos: P.fridge, vol: 0.35 }); }
    // the radiators: steam comes up for a while and goes again; the pipes bang; the iron ticks as it warms
    N.rad.forEach((r, i) => { r.t -= dt; if (r.t <= 0) { r.on = !r.on; r.t = r.on ? rnd(40, 90) : rnd(30, 70); if (this.radS[i]) this.radS[i].on = r.on ? 1 : 0; } });
    const rad = () => P.radiators[Math.floor(Math.random() * P.radiators.length)];
    if ((nx.knock -= dt) <= 0) { nx.knock = rnd(30, 80); const r = rad(); this.play('radKnock', { pos: { x: r.x + rnd(-0.6, 0.6), y: r.y - 0.2, z: r.z }, vol: rnd(0.35, 0.6), verb: 0.4 }); }
    if ((nx.tick -= dt) <= 0) { nx.tick = rnd(12, 30); this.play('radTick', { pos: rad(), vol: 0.3 }); }
    // the joists and boards as the house cools
    if ((nx.creak -= dt) <= 0) {
      nx.creak = rnd(9, 28); const H = this.layout, up = Math.random() < 0.5;
      this.play(Math.random() < 0.75 ? 'creak' : 'settle', { pos: { x: rnd(H.x0 + 0.5, H.x1 - 0.5), y: up ? H.U + 0.1 : H.H - 0.1, z: rnd(H.z0 + 0.5, H.z1 - 0.5) }, vol: rnd(0.25, 0.5), verb: 0.45 });
    }
    // the mantel clock strikes three (and the half hours after)
    if ((nx.chime -= dt) <= 0) { const k = N.chimes === 0 ? 3 : 1; N.chimes++; nx.chime = 300; for (let i = 0; i < k; i++) this.play('chime', { pos: P.chime, vol: 0.55, verb: 0.4, at: i * 2.3, exact: true }); }
    // the street and the city
    const st = P.street;
    if ((nx.car -= dt) <= 0) { nx.car = rnd(8, 28); const dir = Math.random() < 0.5 ? 1 : -1, lane = st.z + (dir > 0 ? 1.1 : -1.1), sp = rnd(9, 14), L = sp * 9 / 2;
      this.playOut('car', { x: -dir * L, y: 0.6, z: lane }, { x: dir * L, y: 0.6, z: lane }, { vol: rnd(0.5, 0.9), ref: 7, dur: 9, doppler: 1, rate: rnd(0.9, 1.1) }); }
    if ((nx.horn -= dt) <= 0) { nx.horn = rnd(50, 120); this.playOut('horn', { x: rnd(-80, 80), y: 1, z: st.z - rnd(10, 80) }, null, { vol: 0.5, ref: 12 }); }
    if ((nx.siren -= dt) <= 0) { nx.siren = rnd(80, 170); const a = Math.random() * Math.PI * 2, r = rnd(250, 450), from = { x: Math.cos(a) * r, y: 10, z: Math.sin(a) * r }, b2 = a + rnd(-0.6, 0.6);
      this.playOut('siren', from, { x: Math.cos(b2) * r * 0.8, y: 10, z: Math.sin(b2) * r * 0.8 }, { vol: 0.7, ref: 140, verb: 0.5 }); }
    if ((nx.train -= dt) <= 0) { nx.train = rnd(110, 200); this.playOut('train', { x: -400, y: 8, z: -480 }, { x: 300, y: 8, z: -520 }, { vol: 0.9, ref: 220, verb: 0.4 }); }
    if ((nx.plane -= dt) <= 0) { nx.plane = rnd(140, 260); const s2 = Math.random() < 0.5 ? 1 : -1; this.playOut('plane', { x: -700 * s2, y: 320, z: 300 }, { x: 700 * s2, y: 260, z: -250 }, { vol: 0.85, ref: 260, doppler: 1, verb: 0.3 }); }
    if ((nx.dog -= dt) <= 0) { nx.dog = rnd(70, 150); const a = Math.random() * Math.PI * 2, r = rnd(25, 60); this.playOut('dog', { x: Math.cos(a) * r, y: 0.5, z: Math.sin(a) * r }, null, { vol: 0.6, ref: 8, verb: 0.4 }); }
  }
  // ---- the car: an engine whose pitch follows the road speed through the gears, tyres on the road, the wind on the
  // body, the bridge's steel deck singing under the tyres
  carEngine(speed, level = 1) {
    if (!this.ctx || (!this.carN && level <= 0)) return;
    const C = this.ctx, now = C.currentTime;
    if (!this.carN) {
      const out = C.createGain(); out.gain.value = 0; out.connect(this.sfx);
      const lpE = C.createBiquadFilter(); lpE.type = 'lowpass'; lpE.Q.value = 0.9; const wobG = C.createGain(); lpE.connect(wobG); wobG.connect(out);
      const mk = (type, g) => { const o = C.createOscillator(); o.type = type; const k = C.createGain(); k.gain.value = g; o.connect(k); k.connect(lpE); o.start(); return o; };
      const o1 = mk('sawtooth', 0.22), o2 = mk('sine', 0.55), o3 = mk('triangle', 0.1);
      // (the firing is not perfectly even: a slow wobble on the level)
      const wob = C.createOscillator(); wob.frequency.value = 6.3; const wg = C.createGain(); wg.gain.value = 0.08; wob.connect(wg); wg.connect(wobG.gain); wob.start();
      const roadG = C.createGain(); roadG.gain.value = 0; roadG.connect(this.sfx);
      const windN = C.createBufferSource(); windN.buffer = this.noiseBuf; windN.loop = true; const wh = C.createBiquadFilter(); wh.type = 'bandpass'; wh.frequency.value = 1400; wh.Q.value = 0.5;
      const windG = C.createGain(); windG.gain.value = 0; windN.connect(wh); wh.connect(windG); windG.connect(this.sfx); windN.start();
      const grateG = C.createGain(); grateG.gain.value = 0; grateG.connect(this.sfx);
      this.carN = { out, lpE, o1, o2, o3, roadG, windG, grateG, v: speed };
    }
    const N = this.carN;
    if (!N.road && this.hb.road) { N.road = C.createBufferSource(); N.road.buffer = this.hb.road; N.road.loop = true; N.road.connect(N.roadG); N.road.start(); }
    if (!N.grate && this.hb.grate) { N.grate = C.createBufferSource(); N.grate.buffer = this.hb.grate; N.grate.loop = true; N.grate.connect(N.grateG); N.grate.start(); }
    // the road speed eases (the car accelerates, brakes); the revs climb through each gear and drop at the change
    N.v += (speed - N.v) * 0.02; const v = N.v, G = [0, 5, 10, 15, 21, 60];
    let g = 0; while (g < G.length - 2 && v > G[g + 1]) g++;
    const u = (v - G[g]) / (G[g + 1] - G[g]), rpm = level <= 0 ? 0 : 750 + (g === 4 ? 950 + Math.min(1, u * 3) * 600 : 400 + u * 1400) * Math.min(1, v / 2 + 0.2);
    const f = Math.max(20, rpm / 60 * 2);   // (a four-cylinder fires twice a turn)
    N.o1.frequency.setTargetAtTime(f, now, 0.15); N.o2.frequency.setTargetAtTime(f / 2, now, 0.15); N.o3.frequency.setTargetAtTime(f * 2, now, 0.15);
    N.lpE.frequency.setTargetAtTime(140 + f * 2.6, now, 0.2);
    N.out.gain.setTargetAtTime(level * (0.15 + 0.07 * Math.min(1, v / 20)), now, 0.25);
    N.roadG.gain.setTargetAtTime(level * 0.34 * Math.pow(Math.min(1.3, v / 24), 1.3), now, 0.3); if (N.road) N.road.playbackRate.setTargetAtTime(0.75 + v / 70, now, 0.3);
    N.windG.gain.setTargetAtTime(level * 0.05 * Math.pow(v / 24, 2), now, 0.3);
  }
  carGrate(on) { if (this.carN) this.carN.grateG.gain.setTargetAtTime(on ? 0.12 : 0, this.ctx.currentTime, 0.4); }
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
  // In the house at night it is B minor too (Bm9 – Gmaj7 – D add9 – A), slower, softer and with more silence in it;
  // while the stranger stirs or the lamp is on, only a low note now and then (`tension`).
  startMusic() {
    const C = this.ctx;
    this.musicT = C.currentTime + 1.0;
    const PENT = [62, 64, 66, 69, 71, 74, 76, 78, 81, 83];
    const forest = [[50, [62, 66, 69, 73, 76]], [47, [62, 66, 69, 71, 74]], [43, [62, 66, 69, 71, 74]], [45, [62, 64, 69, 71, 76]]];
    const cave = [[47, [62, 66, 69, 71]], [43, [59, 62, 66, 69]], [45, [61, 64, 69, 71]], [42, [61, 66, 69, 73]]];
    const house = [[47, [61, 62, 66, 69]], [43, [62, 66, 69, 71]], [38, [62, 64, 66, 69]], [45, [61, 64, 66, 69]]];
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
      if (!this.bank?.piano) { this.musicT = C.currentTime + 0.5; this.musicTimer = setTimeout(schedule, 400); return; }   // (the house's bank still rendering)
      while (this.musicT < C.currentTime + 2.0) {
        const houseMode = this.mood === 'house', caveMode = this.mood === 'cave', prog = houseMode ? house : caveMode ? cave : forest, beat = houseMode ? 1.25 : caveMode ? 1.05 : 0.9;
        const [root, chord] = prog[bar % 4], t0 = this.musicT, lift = (this.liftT || 0) > 0 ? 1 : 0;
        if (houseMode && this.tension > 0.5) { if (bar % 2 === 0) note(root - 12 >= 38 ? root - 12 : root, t0, 0.12); this.musicT += beat * 4; bar++; continue; }
        // left hand: a slow broken chord low down (in the house its third voice only sometimes: more air)
        const hv = houseMode ? 0.7 : 1;
        note(root, t0, 0.22 * hv); note(root + 7, t0 + beat * 1.5, 0.14 * hv); if (!houseMode) note(root + 16, t0 + beat * 2.5, 0.11); else if (Math.random() < 0.6) note(chord[1] - 12, t0 + beat * 2.5, 0.08);
        // the pad only under lifted moments (and softly in the cave)
        if (lift || caveMode) pad(chord.slice(0, 3).map((m) => m - 12), t0, beat * 4, caveMode ? 0.006 : 0.009);
        // right hand: the phrase (2 bars), repeated with small changes; rests are part of it
        if (bar % 4 === 0) phrase = Math.random() < 0.6 ? this.varyPhrase(phrase, PENT) : this.newPhrase(PENT);
        if (houseMode && bar % 8 >= 6) { this.musicT += beat * 4; bar++; continue; }   // (two bars of only the left hand, now and then)
        for (const [pos, m] of phrase[bar % 2]) {
          if (!lift && Math.random() < (houseMode ? 0.4 : 0.2)) continue;
          const mm = caveMode ? m - 3 - 12 * (m > 74 ? 1 : 0) : houseMode && m > 78 ? m - 12 : m;
          note(mm, t0 + pos * beat + (Math.random() - 0.5) * 0.02, (houseMode ? 0.09 : caveMode ? 0.1 : 0.14) * (0.8 + Math.random() * 0.3));
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
