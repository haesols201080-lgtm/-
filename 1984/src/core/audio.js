// Web Audio: synthesised beds and effects (recorded samples in
// window.__ASSETS__.a override them by name). The telescreen's fruity voice
// drones under everything indoors; the city hums; the Hate roars.
import * as THREE from 'three';
import { store } from './store.js';

export function setupAudio(G) {
  const AC = window.AudioContext || window.webkitAudioContext;
  const ctx = AC ? new AC() : null;
  const A = { ctx, volume: parseFloat(store.get('1984.vol') || '0.8'), buffers: {} };
  if (!ctx) { G.audio = { play() {}, unlock() {}, master() {}, blip() {}, shout() {}, helicopter() {}, step() {} }; return G.audio; }
  const out = ctx.createGain(); out.gain.value = A.volume; out.connect(ctx.destination);
  const verb = ctx.createConvolver();
  const verbGain = ctx.createGain(); verbGain.gain.value = 0.25;
  verb.connect(verbGain).connect(out);
  // impulse response: a damp stone street
  {
    const len = ctx.sampleRate * 2.2, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
    verb.buffer = ir;
  }
  const noise = (sec, color = 'white') => {
    const len = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    let last = 0, b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (color === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      else if (color === 'pink') { b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0527; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2; }
      else d[i] = w;
    }
    return b;
  };
  const NW = noise(3), NP = noise(4, 'pink'), NB = noise(4, 'brown');
  // decode packed samples if any
  const packed = (window.__ASSETS__ && window.__ASSETS__.a) || {};
  for (const [name, uri] of Object.entries(packed)) {
    fetch(uri).then((r) => r.arrayBuffer()).then((b) => ctx.decodeAudioData(b)).then((buf) => { A.buffers[name] = buf; }).catch(() => {});
  }

  const panner = (pos) => {
    if (!pos) return null;
    const p = ctx.createPanner();
    p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 4; p.maxDistance = 400; p.rolloffFactor = 1.1;
    p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z;
    return p;
  };
  const route = (node, o = {}) => {
    const g = ctx.createGain(); g.gain.value = o.volume ?? 1;
    node.connect(g);
    const p = panner(o.pos);
    const last = p ? (g.connect(p), p) : g;
    last.connect(out);
    if (o.wet !== 0) { const s = ctx.createGain(); s.gain.value = o.wet ?? 0.4; last.connect(s).connect(verb); }
    return g;
  };
  const src = (buf, loop = false, rate = 1) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = loop; s.playbackRate.value = rate; return s; };
  const env = (g, t, a, d, peak = 1) => { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };

  // ---- one-shot effects
  const FX = {
    step(o) {
      const t = ctx.currentTime, s = src(NW, false, 0.7 + Math.random() * 0.3);
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = o.surface === 'wood' ? 380 : o.surface === 'cobble' ? 900 : 650; f.Q.value = 1.2;
      const g = ctx.createGain(); env(g, t, 0.004, o.running ? 0.09 : 0.13, o.running ? 0.9 : 0.6);
      s.connect(f).connect(g); route(g, { volume: 0.35, wet: 0.25 }); s.start(t, Math.random() * 2, 0.3);
    },
    pen() {
      const t = ctx.currentTime, s = src(NW, false, 2);
      const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 3000;
      const g = ctx.createGain(); env(g, t, 0.003, 0.05, 0.25); s.connect(f).connect(g); route(g, { wet: 0.05 }); s.start(t, Math.random(), 0.1);
    },
    tube() {
      const t = ctx.currentTime, s = src(NP, false, 1);
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(2400, t + 0.5);
      const g = ctx.createGain(); env(g, t, 0.05, 0.6, 0.8); s.connect(f).connect(g); route(g, { wet: 0.3 }); s.start(t, 0, 1);
    },
    whistle() {
      // the getting-up whistle: one ear-splitting note
      const t = ctx.currentTime, o = ctx.createOscillator(), o2 = ctx.createOscillator();
      o.type = 'square'; o.frequency.value = 2080; o2.type = 'sine'; o2.frequency.value = 2093;
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.12, t + 0.05); g.gain.setValueAtTime(0.12, t + 4); g.gain.linearRampToValueAtTime(0, t + 4.3);
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 5000;
      o.connect(f); o2.connect(f); f.connect(g); route(g, { wet: 0.5 }); o.start(t); o2.start(t); o.stop(t + 4.4); o2.stop(t + 4.4);
    },
    count(o) {
      const t = ctx.currentTime, osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 330 * (o.rate || 1);
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 3;
      const g = ctx.createGain(); env(g, t, 0.01, 0.18, 0.25); osc.connect(f).connect(g); route(g, { wet: 0.3 }); osc.start(t); osc.stop(t + 0.3);
    },
    telescreen_bark() {
      // a harsh male voice, unintelligible, through a cheap speaker
      for (let i = 0; i < 6; i++) {
        const t = ctx.currentTime + i * 0.16, osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 110 + Math.random() * 30;
        const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 600 + Math.random() * 900; f.Q.value = 5;
        const g = ctx.createGain(); env(g, t, 0.02, 0.14, 0.4); osc.connect(f).connect(g); route(g, { volume: 0.7, wet: 0.5 }); osc.start(t); osc.stop(t + 0.2);
      }
    },
    explosion(o) {
      // a rocket bomb: a crack, then a long rolling low thunder
      const t = ctx.currentTime, s = src(NB, false, 0.5), s2 = src(NW, false, 0.6);
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(60, t + 3.5);
      const g = ctx.createGain(); env(g, t, 0.01, 4.5, 2.2);
      const g2 = ctx.createGain(); env(g2, t, 0.002, 0.25, 1.2);
      s.connect(f).connect(g); s2.connect(g2);
      route(g, { pos: o.pos, volume: 2.5, wet: 0.9 }); route(g2, { pos: o.pos, volume: 1.2, wet: 0.6 });
      s.start(t); s2.start(t, 0, 0.3);
    },
    door() {
      const t = ctx.currentTime, s = src(NB, false, 1.2);
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
      const g = ctx.createGain(); env(g, t, 0.005, 0.35, 1); s.connect(f).connect(g); route(g, { wet: 0.4 }); s.start(t, 0, 0.5);
    },
    bell(o) {
      const t = ctx.currentTime;
      for (const [m, a] of [[1, 1], [2.76, 0.5], [5.4, 0.25], [8.93, 0.12]]) {
        const osc = ctx.createOscillator(); osc.frequency.value = 220 * m;
        const g = ctx.createGain(); env(g, t, 0.005, 5 / m, a * 0.2); osc.connect(g); route(g, { pos: o.pos, wet: 0.8 }); osc.start(t); osc.stop(t + 6);
      }
    },
  };

  // ---- beds: city hum, wind, rain, interior drone
  const beds = {};
  const bed = (name, make) => { if (!beds[name]) { const g = ctx.createGain(); g.gain.value = 0; make(g); g.connect(out); beds[name] = g; } return beds[name]; };
  bed('city', (g) => {
    const s = src(NB, true); const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 220; s.connect(f).connect(g); s.start();
    const s2 = src(NP, true, 0.5); const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 500; f2.Q.value = 0.4;
    const g2 = ctx.createGain(); g2.gain.value = 0.25; s2.connect(f2).connect(g2).connect(g); s2.start();
  });
  bed('wind', (g) => {
    const s = src(NP, true, 0.7); const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 400; f.Q.value = 0.8;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.13; const lg = ctx.createGain(); lg.gain.value = 260; lfo.connect(lg).connect(f.frequency); lfo.start();
    s.connect(f).connect(g); s.start();
  });
  bed('rain', (g) => {
    const s = src(NW, true); const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 900;
    const f2 = ctx.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = 7000;
    s.connect(f).connect(f2).connect(g); s.start();
  });
  bed('room', (g) => {
    const s = src(NB, true, 0.6); const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 120; s.connect(f).connect(g); s.start();
    const hum = ctx.createOscillator(); hum.frequency.value = 50; const hg = ctx.createGain(); hg.gain.value = 0.05; hum.connect(hg).connect(g); hum.start();
  });
  // the telescreen voice: "a fruity voice reading out a list of figures"
  const voice = ctx.createGain(); voice.gain.value = 0;
  {
    const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 118;
    const vib = ctx.createOscillator(); vib.frequency.value = 3.1; const vg = ctx.createGain(); vg.gain.value = 9; vib.connect(vg).connect(osc.frequency); vib.start();
    const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 700; f1.Q.value = 4;
    const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1300; f2.Q.value = 6;
    const syl = ctx.createGain(); syl.gain.value = 0;
    osc.connect(f1).connect(syl); osc.connect(f2).connect(syl);
    const tel = ctx.createBiquadFilter(); tel.type = 'bandpass'; tel.frequency.value = 1100; tel.Q.value = 0.7;
    syl.connect(tel).connect(voice); voice.connect(out);
    osc.start();
    // syllables and pauses
    const speak = () => {
      const t = ctx.currentTime;
      const n = 3 + Math.floor(Math.random() * 7);
      for (let i = 0; i < n; i++) {
        const tt = t + i * 0.17;
        syl.gain.setValueAtTime(0, tt); syl.gain.linearRampToValueAtTime(0.5, tt + 0.03); syl.gain.linearRampToValueAtTime(0.05, tt + 0.14);
        f1.frequency.setValueAtTime(400 + Math.random() * 700, tt); f2.frequency.setValueAtTime(1000 + Math.random() * 1400, tt);
        osc.frequency.setValueAtTime(105 + Math.random() * 30, tt);
      }
      syl.gain.setValueAtTime(0, t + n * 0.17 + 0.05);
      setTimeout(speak, (n * 0.17 + 0.3 + Math.random() * 0.8) * 1000);
    };
    speak();
  }
  // the Hate: a crowd of voices roaring, swelling with the player's shout
  const crowd = ctx.createGain(); crowd.gain.value = 0;
  {
    for (let i = 0; i < 10; i++) {
      const s = src(NP, true, 0.8 + Math.random() * 0.4);
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 300 + Math.random() * 900; f.Q.value = 3;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.6 + Math.random() * 2.2;
      const lg = ctx.createGain(); lg.gain.value = 0.5; const g = ctx.createGain(); g.gain.value = 0.5;
      lfo.connect(lg).connect(g.gain); lfo.start();
      s.connect(f).connect(g).connect(crowd); s.start(0, Math.random() * 3);
    }
    crowd.connect(out);
    const c2 = ctx.createGain(); c2.gain.value = 0.6; crowd.connect(c2).connect(verb);
  }
  const myShout = ctx.createGain(); myShout.gain.value = 0;
  {
    const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 160;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 2;
    const s = src(NP, true); const fn = ctx.createBiquadFilter(); fn.type = 'bandpass'; fn.frequency.value = 1800;
    osc.connect(f).connect(myShout); s.connect(fn).connect(myShout); osc.start(); s.start();
    myShout.connect(out);
  }
  // helicopter rotor thump
  const heli = ctx.createGain(); heli.gain.value = 0;
  const heliPan = ctx.createPanner(); heliPan.panningModel = 'HRTF'; heliPan.refDistance = 12; heliPan.rolloffFactor = 1.4;
  {
    const s = src(NB, true); const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 200;
    const am = ctx.createGain(); am.gain.value = 0.5;
    const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 11; const lg = ctx.createGain(); lg.gain.value = 0.5;
    lfo.connect(lg).connect(am.gain); lfo.start();
    s.connect(f).connect(am).connect(heli); s.start();
    heli.connect(heliPan).connect(out);
  }

  const set = (g, v, k = 1.5) => g.gain.setTargetAtTime(v, ctx.currentTime, k);
  const audio = {
    get volume() { return A.volume; },
    unlock() { if (ctx.state !== 'running') ctx.resume(); },
    master(v) { A.volume = v; out.gain.value = v; store.set('1984.vol', v); },
    play(name, o = {}) {
      if (ctx.state !== 'running') return;
      const buf = A.buffers[name];
      if (buf) { const s = src(buf, false, o.rate ?? 1); route(s, o); s.start(); return; }
      if (FX[name]) FX[name](o);
    },
    step(surface, running) { audio.play('step', { surface, running }); },
    blip() {},
    shout(k) { set(myShout, k * 0.18, 0.08); },
    hateCrowd(k) { set(crowd, k * 0.5, 0.3); },
    helicopter(pos) { heliPan.positionX.value = pos.x; heliPan.positionY.value = pos.y; heliPan.positionZ.value = pos.z; },
  };
  // footsteps from the player
  G.player.onStep = (running) => {
    const s = G.world && G.state.location === 'city' && G.world.surface ? G.world.surface(G.player.pos.x, G.player.pos.z) : (G.location && G.location.exterior ? 'grass' : 'wood');
    audio.step(s, running);
  };
  // listener follows the camera; beds follow the place and the weather
  const fwd = new THREE.Vector3();
  G.onUpdate(() => {
    const L = ctx.listener, c = G.camera.position;
    G.camera.getWorldDirection(fwd);
    if (L.positionX) {
      L.positionX.value = c.x; L.positionY.value = c.y; L.positionZ.value = c.z;
      L.forwardX.value = fwd.x; L.forwardY.value = fwd.y; L.forwardZ.value = fwd.z;
      L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
    }
    const ext = !G.location || G.location.exterior;
    const rain = G.atmos.w ? G.atmos.w.rain : 0;
    const wind = G.atmos.w ? G.atmos.w.wind : 0.5;
    const night = 1 - (G.atmos.day ?? 1);
    set(beds.city, ext && G.state.location === 'city' ? 0.22 * (1 - night * 0.6) : 0.02);
    set(beds.wind, ext ? 0.05 + wind * 0.09 : 0.01);
    set(beds.rain, rain * (ext ? 0.35 : 0.08));
    set(beds.room, ext ? 0 : 0.16);
    // the telescreen drones wherever one can hear it
    let near = 99;
    if (G.surv) for (const t of G.surv.screens) if (t.location === G.state.location) near = Math.min(near, t.pos.distanceTo(c));
    set(voice, near < 30 && !G.telescreenSilent ? Math.min(0.09, 0.5 / (near + 2)) : 0, 0.6);
    set(heli, G.state.location === 'city' && G.surv && G.surv.helicopter ? 0.6 : 0, 1);
  });
  addEventListener('pointerdown', () => audio.unlock(), { once: false });
  G.audio = audio;
  return audio;
}
