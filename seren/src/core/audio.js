// 소리 엔진: 모든 소리를 Web Audio 로 합성합니다 (외부 파일 없음).
// 공명 음(종소리 같은 FM 합성), 바람, 발소리, 효과음, 아웬의 노래하는 말, 잔향.

// 세렌의 음계: D 장조 5음 음계. 공명 다섯 음과 음악이 모두 이 음계를 써서 언제 눌러도 어울린다.
export const SCALE = [587.33, 659.25, 739.99, 880.0, 987.77];
export const NOTE_NAMES = ['솟음', '열림', '흐름', '빛', '고요'];
export const NOTE_COLORS = [0xffd27a, 0x7ff3e6, 0x7fb8ff, 0xffb8e8, 0xb9a6ff];

const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class Audio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.vol = { master: 0.9, music: 0.6, ambience: 0.7, sfx: 0.85, ui: 0.8, voice: 0.85 };
    this.listener = { x: 0, y: 0, z: 0, yaw: 0 };
  }

  /** 사용자 제스처 안에서 호출해야 소리가 켜진다 (iOS 등) */
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.enabled = false; return; }
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = this.vol.master;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.3;
    this.master.connect(comp).connect(ctx.destination);
    this.bus = {};
    // 채널: 음악 · 효과음(세계의 사건) · 환경음(바람·물·도시의 지속음) · 시스템·UI 음(알림·메뉴·저장) · 목소리 — 서로 묶지 않는다
    for (const k of ['music', 'sfx', 'ambience', 'ui', 'voice']) {
      const g = ctx.createGain();
      g.gain.value = this.vol[k];
      g.connect(this.master);
      this.bus[k] = g;
    }
    // 잔향
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this._impulse(4.2, 2.6);
    this.reverbGain = ctx.createGain();
    this.reverbGain.gain.value = 0.55;
    this.reverb.connect(this.reverbGain).connect(this.master);
    this.noiseBuf = this._noise(2);
    this._initWind();
    this._initHum();
  }

  get ready() { return !!this.ctx && this.enabled; }
  get now() { return this.ctx ? this.ctx.currentTime : 0; }

  setVolume(k, v) {
    this.vol[k] = v;
    if (!this.ctx) return;
    if (k === 'master') this.master.gain.setTargetAtTime(v, this.now, 0.05);
    else if (this.bus[k]) this.bus[k].gain.setTargetAtTime(v, this.now, 0.05);
  }

  _impulse(sec, decay) {
    const ctx = this.ctx;
    const n = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < n; i++) {
        const t = i / n;
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * (i < 200 ? i / 200 : 1);
      }
    }
    return buf;
  }

  _noise(sec) {
    const ctx = this.ctx;
    const n = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b = 0;
    for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; b = 0.97 * b + 0.03 * w; d[i] = w * 0.5 + b * 2.5; }
    return buf;
  }

  /** 세계 좌표 → 좌우 위치·거리 감쇠 */
  _spatial(pos, maxDist = 400) {
    if (!pos) return { pan: 0, gain: 1 };
    const L = this.listener;
    const dx = pos.x - L.x, dz = pos.z - L.z, dy = (pos.y ?? L.y) - L.y;
    const d = Math.hypot(dx, dy, dz);
    const ang = Math.atan2(dx, dz) - L.yaw;
    const pan = Math.max(-1, Math.min(1, Math.sin(ang) * -1)) * Math.min(1, d / 6);
    const gain = Math.max(0, 1 - d / maxDist) / (1 + d / 60);
    return { pan, gain, d };
  }

  _out(bus, pan, wet = 0.3) {
    const ctx = this.ctx;
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    const g = ctx.createGain();
    if (p) { p.pan.value = pan; g.connect(p); p.connect(this.bus[bus]); } else g.connect(this.bus[bus]);
    if (wet > 0) {
      const s = ctx.createGain();
      s.gain.value = wet;
      g.connect(s);
      s.connect(this.reverb);
    }
    return g;
  }

  /**
   * 공명 음: 종과 유리를 섞은 FM 음색
   * note: 0..4 (음계) 또는 {hz}, opts: { pos, gain, dur, octave, bus, wet, soft }
   */
  tone(note, opts = {}) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = this.now + (opts.delay || 0);
    const hz = typeof note === 'number' ? SCALE[((note % 5) + 5) % 5] * Math.pow(2, Math.floor(note / 5) + (opts.octave || 0)) : note.hz;
    const sp = this._spatial(opts.pos, opts.maxDist || 900);
    const gain = (opts.gain ?? 0.5) * sp.gain;
    if (gain < 0.003) return;
    const dur = opts.dur ?? 2.6;
    const out = this._out(opts.bus || 'sfx', sp.pan, opts.wet ?? 0.45);
    out.gain.value = gain;
    // 운반파 + 변조파
    const car = ctx.createOscillator();
    car.frequency.value = hz;
    const mod = ctx.createOscillator();
    mod.frequency.value = hz * (opts.soft ? 2.0 : 3.51);
    const modG = ctx.createGain();
    modG.gain.setValueAtTime(hz * (opts.soft ? 0.8 : 2.2), t);
    modG.gain.exponentialRampToValueAtTime(hz * 0.05, t + dur * 0.6);
    mod.connect(modG).connect(car.frequency);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(1, t + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    car.connect(env).connect(out);
    // 부드러운 배음 (유리잔)
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = hz * 2.003;
    const e2 = ctx.createGain();
    e2.gain.setValueAtTime(0.0001, t);
    e2.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
    e2.gain.exponentialRampToValueAtTime(0.0005, t + dur * 0.7);
    o2.connect(e2).connect(out);
    for (const o of [car, mod, o2]) { o.start(t); o.stop(t + dur + 0.1); }
  }

  /** 아웬의 노래하는 말: 음표 배열을 미끄러지듯 이어 부른다 */
  sing(notes, opts = {}) {
    if (!this.ready || !notes.length) return 0;
    const ctx = this.ctx;
    const t0 = this.now + (opts.delay || 0);
    const sp = this._spatial(opts.pos, 300);
    const gain = (opts.gain ?? 0.32) * sp.gain;
    const step = opts.step ?? 0.2;
    const pitch = opts.pitch ?? 1;
    const out = this._out('voice', sp.pan, 0.5);
    out.gain.value = gain;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    const vib = ctx.createOscillator();
    vib.frequency.value = 5.2;
    const vibG = ctx.createGain();
    vibG.gain.value = 6;
    vib.connect(vibG);
    vibG.connect(osc.frequency);
    vibG.connect(osc2.frequency);
    // 모음 같은 울림
    const f1 = ctx.createBiquadFilter();
    f1.type = 'bandpass'; f1.Q.value = 3;
    const f2 = ctx.createBiquadFilter();
    f2.type = 'bandpass'; f2.Q.value = 5;
    const env = ctx.createGain();
    env.gain.value = 0;
    osc.connect(f1); osc.connect(f2); osc2.connect(env);
    f1.connect(env); f2.connect(env);
    env.connect(out);
    let t = t0;
    const vowels = [[700, 1200], [400, 2200], [300, 900], [500, 1700], [600, 1000]];
    notes.forEach((n, i) => {
      const hz = (typeof n === 'number' ? SCALE[((n % 5) + 5) % 5] * Math.pow(2, Math.floor(n / 5) - 1) : n) * pitch;
      const v = vowels[(typeof n === 'number' ? n : i) % vowels.length];
      osc.frequency.setTargetAtTime(hz, t, 0.03);
      osc2.frequency.setTargetAtTime(hz, t, 0.03);
      f1.frequency.setTargetAtTime(v[0], t, 0.05);
      f2.frequency.setTargetAtTime(v[1], t, 0.05);
      env.gain.setTargetAtTime(n === null ? 0 : 0.8, t, 0.03);
      if ((i + 1) % 3 === 0) env.gain.setTargetAtTime(0.25, t + step * 0.8, 0.02);
      t += step;
    });
    env.gain.setTargetAtTime(0, t, 0.08);
    for (const o of [osc, osc2, vib]) { o.start(t0); o.stop(t + 0.6); }
    return t - t0;
  }

  /** 짧은 잡음 효과 (발소리·착지·물 등) */
  noise({ freq = 800, q = 1, dur = 0.08, gain = 0.2, type = 'bandpass', pos, sweep, attack = 0.004, bus = 'sfx', wet = 0.05, maxDist = 200 } = {}) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = this.now;
    const sp = this._spatial(pos, maxDist);
    if (sp.gain * gain < 0.002) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain * sp.gain, t + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const out = this._out(bus, sp.pan, wet);
    src.connect(f).connect(env).connect(out);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
  }

  /** 단순 음 (효과음) */
  blip({ hz = 600, to, dur = 0.15, gain = 0.15, type = 'sine', bus = 'sfx', wet = 0.2, delay = 0 } = {}) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = this.now + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(hz, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this._out(bus, 0, wet));
    o.start(t); o.stop(t + dur + 0.05);
  }

  /** 발견 아르페지오 */
  chime(kind = 'discover') {
    if (!this.ready) return;
    const seqs = {
      discover: [0, 2, 4, 7, 9],
      word: [4, 7, 9],
      quest: [0, 4, 7, 9, 12, 14],
      soft: [7, 9],
      error: [3, 1],
      pylon: [0, 2, 4, 5, 7, 9, 10, 12, 14],
    };
    const s = seqs[kind] || seqs.discover;
    // 알림·발견·퀘스트 소리는 시스템·UI 채널, 탑의 노래(pylon)는 세계의 소리(효과음)
    s.forEach((n, i) => this.tone(n, { delay: i * (kind === 'pylon' ? 0.16 : 0.09), gain: 0.22, dur: 2.2, soft: true, bus: kind === 'pylon' ? 'sfx' : 'ui', wet: 0.6 }));
  }

  // ── 지속음: 바람 / 스키머 웅웅 ──────────────
  _initWind() {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 400; f.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(f).connect(g).connect(this.bus.ambience);
    src.start();
    this.wind = { f, g };
  }

  _initHum() {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = 60;
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = 120;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 500; f.Q.value = 4;
    const g = ctx.createGain();
    g.gain.value = 0;
    o.connect(f); o2.connect(f);
    f.connect(g).connect(this.bus.sfx);
    o.start(); o2.start();
    this.hum = { o, o2, f, g };
  }

  /** 매 프레임: 바람 세기, 스키머 소리 */
  updateLoops(speed, state, altitude, windBase = 0.15) {
    if (!this.ready) return;
    const t = this.now;
    const air = state === 'glide' || state === 'current' || state === 'air' || state === 'lift';
    const w = Math.min(1, windBase + (air ? speed / 35 : speed / 70) + Math.max(0, altitude - 200) / 3000);
    this.wind.g.gain.setTargetAtTime(w * 0.32, t, 0.25);
    this.wind.f.frequency.setTargetAtTime(250 + w * 1300, t, 0.3);
    const sk = state === 'skim' || state === 'fly';
    this.hum.g.gain.setTargetAtTime(sk ? 0.035 + Math.min(0.05, speed / 900) : 0, t, 0.15);
    this.hum.o.frequency.setTargetAtTime(48 + speed * 2.2, t, 0.1);
    this.hum.o2.frequency.setTargetAtTime(96 + speed * 4.4, t, 0.1);
    this.hum.f.frequency.setTargetAtTime(300 + speed * 30, t, 0.1);
  }

  /** 지속 음색 하나 (음악 등에서 사용) — 정지 함수 반환 */
  pad(hz, { gain = 0.05, type = 'sawtooth', cutoff = 900, attack = 3, bus = 'music', detune = 7, wet = 0.5 } = {}) {
    if (!this.ready) return () => {};
    const ctx = this.ctx;
    const t = this.now;
    const out = this._out(bus, 0, wet);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = cutoff; f.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    const oscs = [-detune, detune].map((d) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = hz; o.detune.value = d; o.connect(f); o.start(t); return o; });
    f.connect(g).connect(out);
    return (release = 4) => {
      const n = this.now;
      g.gain.cancelScheduledValues(n);
      g.gain.setValueAtTime(Math.max(g.gain.value, 0.0001), n);
      g.gain.exponentialRampToValueAtTime(0.0001, n + release);
      for (const o of oscs) o.stop(n + release + 0.1);
    };
  }
}

export const audio = new Audio();
export { midiHz };
