// Sound bank: physically-modelled sounds rendered once into AudioBuffers at start (cheap to play afterwards).
//   water     — a babbling stream from thousands of Minnaert bubbles (short, upward-chirping, decaying sines) over a
//               soft noise bed; the waterfall is the same with bigger, denser bubbles and a low roar
//   wind      — brown noise through slowly wandering resonances with a gust envelope; leaves — fine crackle that
//               follows the same gusts
//   birds     — songs built from pitch trajectories with harmonics: a thrush-like repeated phrase, a two-note
//               "chiff-chaff", a fast trill, a dove's soft hoo, a distant woodpecker drumming
//   insects   — cricket chirps (pulse trains on a 4.6 kHz carrier)
//   steps     — several variants per surface: leaves (dozens of tiny crackles), dirt (thump + grit), pebbles
//               (resonant clicks), moss (muffled), rock (sharp tick + knock), wood (modal resonances), metal (ringing
//               inharmonic partials), water (splash + bubbles)
//   piano     — additive notes with slight inharmonicity and a hammer transient, for the music
const TAU = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);

function buf(C, sec, ch = 1) { return C.createBuffer(ch, Math.max(1, Math.round(C.sampleRate * sec)), C.sampleRate); }
function normalize(d, peak = 0.9) { let m = 0; for (const v of d) m = Math.max(m, Math.abs(v)); if (m > 0) { const k = peak / m; for (let i = 0; i < d.length; i++) d[i] *= k; } }
// one-pole low / high pass in place
function lp(d, sr, f) { const a = Math.exp(-TAU * f / sr); let y = 0; for (let i = 0; i < d.length; i++) { y = (1 - a) * d[i] + a * y; d[i] = y; } }
function hp(d, sr, f) { const a = Math.exp(-TAU * f / sr); let y = 0, x0 = 0; for (let i = 0; i < d.length; i++) { const x = d[i]; y = a * (y + x - x0); x0 = x; d[i] = y; } }
// state-variable band pass (returns a new array)
function bp(src, sr, f, q) { const out = new Float32Array(src.length), F = 2 * Math.sin(Math.PI * Math.min(f, sr / 6) / sr), Q = 1 / q; let lo = 0, ba = 0;
  for (let i = 0; i < src.length; i++) { const hi = src[i] - lo - Q * ba; ba += F * hi; lo += F * ba; out[i] = ba; } return out; }
// crossfade the loop seam so loops play without a click
function seam(d, sr, sec = 0.08) { const n = Math.round(sr * sec); for (let i = 0; i < n; i++) { const k = i / n; d[i] = d[i] * k + d[d.length - n + i] * (1 - k); } return d.subarray(0, d.length - n); }
function loopBuf(C, data) { const b = C.createBuffer(1, data.length, C.sampleRate); b.copyToChannel(data, 0); return b; }

function bubbles(d, sr, rate, fLo, fHi, amp) {
  const n = Math.round(d.length / sr * rate);
  for (let k = 0; k < n; k++) {
    const t0 = Math.floor(Math.random() * d.length), f0 = fLo * Math.pow(fHi / fLo, Math.random() ** 1.6);
    const dur = 0.012 + 3.5 / f0 * rnd(1, 4), len = Math.floor(dur * sr), a = amp * Math.pow(600 / f0, 0.5) * rnd(0.3, 1);
    let ph = 0;
    for (let i = 0; i < len && t0 + i < d.length; i++) {
      const t = i / sr, f = f0 * (1 + 0.9 * t / dur);                          // the Minnaert bubble chirps upward
      ph += TAU * f / sr; d[t0 + i] += a * Math.sin(ph) * Math.exp(-t / (dur * 0.3)) * Math.min(1, i / 12);
    }
  }
}

export function makeBank(C) {
  const sr = C.sampleRate, B = {};
  // ---- water
  const water = (sec, rate, fLo, fHi, bed, roar) => {
    const d = new Float32Array(Math.round(sr * sec));
    bubbles(d, sr, rate, fLo, fHi, 0.5);
    const nz = new Float32Array(d.length); for (let i = 0; i < d.length; i++) nz[i] = Math.random() * 2 - 1;
    const hiss = bp(nz, sr, 1800, 0.7); for (let i = 0; i < d.length; i++) d[i] += hiss[i] * bed;
    if (roar) { const r = new Float32Array(d.length); for (let i = 0; i < d.length; i++) r[i] = Math.random() * 2 - 1; lp(r, sr, 380); lp(r, sr, 380); for (let i = 0; i < d.length; i++) d[i] += r[i] * roar; }
    hp(d, sr, 120); normalize(d, 0.8); return loopBuf(C, seam(d, sr));
  };
  B.stream = water(7, 140, 380, 2600, 0.05, 0);
  B.brook = water(6, 260, 300, 1900, 0.09, 0.0);
  B.fall = water(6, 900, 160, 1300, 0.35, 0.9);
  // ---- wind: brown noise with wandering resonances and gusts; leaves: crackle that follows the gusts
  {
    const sec = 16, n = Math.round(sr * sec), d = new Float32Array(n), lv = new Float32Array(n);
    let br = 0; for (let i = 0; i < n; i++) { br = (br + (Math.random() * 2 - 1) * 0.02) * 0.998; d[i] = br; }
    const gust = (t) => 0.55 + 0.45 * Math.sin(t * 0.39 + 1) * Math.sin(t * 0.23) + 0.15 * Math.sin(t * 1.7);
    const f1 = bp(d, sr, 260, 2.2), f2 = bp(d, sr, 520, 3);
    for (let i = 0; i < n; i++) { const g = gust(i / sr); d[i] = d[i] * 0.6 + (f1[i] * 3 + f2[i] * 2) * g; }
    for (let i = 0; i < n; i++) { const g = Math.max(0, gust(i / sr) - 0.35); if (Math.random() < 0.03 * g) { const a = rnd(0.2, 1) * g; for (let k = 0; k < 40 && i + k < n; k++) lv[i + k] += a * (Math.random() * 2 - 1) * Math.exp(-k / 8); } }
    hp(lv, sr, 2500); normalize(d, 0.8); normalize(lv, 0.6);
    B.wind = loopBuf(C, seam(d, sr, 0.5)); B.leaves = loopBuf(C, seam(lv, sr, 0.3));
  }
  // ---- crickets
  {
    const sec = 4, n = Math.round(sr * sec), d = new Float32Array(n);
    for (let c = 0; c < 9; c++) {
      const t0 = c * 0.44 + rnd(0, 0.05), f = 4600 + rnd(-80, 80);
      for (let p = 0; p < 3; p++) { const s0 = Math.floor((t0 + p * 0.032) * sr), len = Math.floor(0.022 * sr);
        for (let i = 0; i < len && s0 + i < n; i++) d[s0 + i] += Math.sin(TAU * f * i / sr) * Math.sin(Math.PI * i / len) * (0.8 + 0.2 * Math.sin(TAU * 140 * i / sr)); }
    }
    normalize(d, 0.6); B.crickets = loopBuf(C, d);
  }
  // ---- birds: phrases from pitch trajectories (fundamental + a weaker 2nd harmonic)
  const sing = (notes) => {
    const total = notes.reduce((a, n) => Math.max(a, n.t + n.d), 0) + 0.15, d = new Float32Array(Math.round(sr * total));
    for (const n of notes) {
      const s0 = Math.floor(n.t * sr), len = Math.floor(n.d * sr); let ph = 0;
      for (let i = 0; i < len && s0 + i < d.length; i++) {
        const u = i / len, f = n.f0 + (n.f1 - n.f0) * (n.curve ? Math.sin(u * Math.PI / 2) : u) + (n.vib || 0) * Math.sin(TAU * 38 * u * n.d);
        ph += TAU * f / sr;
        const env = Math.sin(Math.PI * u) ** 0.6 * (n.a || 1);
        d[s0 + i] += env * (Math.sin(ph) + 0.18 * Math.sin(2 * ph) + 0.06 * Math.sin(3 * ph));
      }
    }
    normalize(d, 0.7); return loopBuf(C, d);
  };
  B.birds = [];
  // thrush-like: 3 phrases, each repeated 2-3 times
  for (let v = 0; v < 3; v++) { const N = []; let t = 0;
    for (let ph = 0; ph < 3; ph++) { const f = rnd(2200, 4200), kind = Math.floor(rnd(0, 3)), rep = 2 + (Math.random() < 0.5 ? 1 : 0);
      for (let r = 0; r < rep; r++) { if (kind === 0) { N.push({ t, d: 0.09, f0: f, f1: f * 1.25, curve: 1 }); t += 0.13; }
        else if (kind === 1) { N.push({ t, d: 0.05, f0: f * 1.2, f1: f * 0.8 }); N.push({ t: t + 0.07, d: 0.06, f0: f, f1: f * 1.1 }); t += 0.17; }
        else { N.push({ t, d: 0.16, f0: f, f1: f, vib: 120 }); t += 0.2; } }
      t += 0.32; }
    B.birds.push(sing(N)); }
  // chiff-chaff: alternating two pitches
  for (let v = 0; v < 2; v++) { const N = [], hi = rnd(5200, 5800), lo = rnd(4300, 4700); let t = 0;
    for (let k = 0; k < 7; k++) { const f = k % 2 ? lo : hi; N.push({ t, d: 0.07, f0: f * 1.08, f1: f * 0.93 }); t += 0.36 + rnd(-0.04, 0.04); } B.birds.push(sing(N)); }
  // trill: a fast run that falls
  for (let v = 0; v < 2; v++) { const N = []; let t = 0, f = rnd(4500, 6200);
    for (let k = 0; k < 26; k++) { N.push({ t, d: 0.025, f0: f * 1.1, f1: f * 0.9, a: 0.8 }); t += 0.04; f *= 0.992; } B.birds.push(sing(N)); }
  // dove: soft low hoo-hoo
  { const N = [], f = 520; [[0, 0.32, 1], [0.5, 0.22, 0.8], [0.8, 0.5, 1]].forEach(([t, d, a]) => N.push({ t, d, f0: f * 0.95, f1: f * 1.02, curve: 1, a })); B.dove = sing(N); }
  // woodpecker: a quick roll of knocks
  { const n = Math.round(sr * 1.1), d = new Float32Array(n);
    for (let k = 0; k < 17; k++) { const s0 = Math.floor((k * 0.048 + (k * k) * 0.0004) * sr);
      for (let i = 0; i < 400 && s0 + i < n; i++) d[s0 + i] += (Math.random() * 2 - 1) * Math.exp(-i / 50) * 0.6 + Math.sin(TAU * 950 * i / sr) * Math.exp(-i / 120) * 0.5; }
    normalize(d, 0.7); B.woodpecker = loopBuf(C, d); }
  // ---- footsteps
  const step = (kind) => {
    const n = Math.round(sr * 0.32), d = new Float32Array(n), nz = () => Math.random() * 2 - 1;
    const thump = (f, dec, a) => { for (let i = 0; i < n; i++) d[i] += a * Math.sin(TAU * f * i / sr * (1 - i / n * 0.3)) * Math.exp(-i / (dec * sr)); };
    const grit = (f, q, dec, a, t0 = 0) => { const g = new Float32Array(n); for (let i = 0; i < n; i++) g[i] = nz() * Math.exp(-Math.max(0, i / sr - t0) / dec) * (i / sr >= t0 ? 1 : 0); const o = bp(g, sr, f, q); for (let i = 0; i < n; i++) d[i] += o[i] * a; };
    const clicks = (cnt, spread, fLo, fHi, a, dec = 0.0012) => { for (let k = 0; k < cnt; k++) { const s0 = Math.floor(Math.random() ** 1.5 * spread * sr), f = rnd(fLo, fHi), aa = a * rnd(0.3, 1);
      for (let i = 0; i < sr * 0.012 && s0 + i < n; i++) d[s0 + i] += aa * Math.sin(TAU * f * i / sr) * Math.exp(-i / (dec * sr)) * (0.5 + 0.5 * nz()); } };
    const modes = (fs, decs, a) => fs.forEach((f, k) => { for (let i = 0; i < n; i++) d[i] += a * Math.sin(TAU * f * i / sr) * Math.exp(-i / (decs[k] * sr)) / (k + 1); });
    if (kind === 'leaves') { clicks(46, 0.1, 1800, 7000, 0.5); thump(80, 0.03, 0.25); grit(3500, 1, 0.05, 0.3); }
    else if (kind === 'dirt') { thump(70, 0.04, 0.7); grit(900, 0.9, 0.035, 0.5); clicks(6, 0.04, 1500, 3000, 0.15); }
    else if (kind === 'pebbles') { thump(90, 0.03, 0.4); clicks(9, 0.07, 2500, 5500, 0.55, 0.004); }
    else if (kind === 'moss') { thump(60, 0.05, 0.5); grit(420, 0.7, 0.06, 0.4); }
    else if (kind === 'rock') { clicks(2, 0.006, 3000, 4200, 0.7, 0.0025); thump(150, 0.025, 0.5); }
    else if (kind === 'wood') { modes([rnd(170, 210), rnd(390, 440), rnd(680, 760)], [0.09, 0.06, 0.04], 0.6); clicks(2, 0.004, 2000, 3000, 0.4, 0.002); }
    else if (kind === 'metal') { modes([rnd(880, 940), 1430, 2210, 3020].map((f) => f * rnd(0.97, 1.03)), [0.25, 0.18, 0.12, 0.08], 0.35); clicks(2, 0.003, 4000, 6000, 0.5, 0.002); }
    else if (kind === 'water') { grit(1200, 0.6, 0.09, 0.8); bubbles(d, sr, 120, 500, 2400, 0.25); thump(80, 0.04, 0.3); }
    normalize(d, 0.85); return loopBuf(C, d);
  };
  B.steps = {};
  for (const k of ['leaves', 'dirt', 'pebbles', 'moss', 'rock', 'wood', 'metal', 'water']) B.steps[k] = [0, 1, 2, 3].map(() => step(k));
  // ---- piano voice for the music (D-major pentatonic over three octaves + chord tones)
  B.piano = {};
  const piano = (m) => {
    const f = 440 * Math.pow(2, (m - 69) / 12), sec = 3.0, n = Math.round(sr * sec), d = new Float32Array(n);
    const B_ = 0.0004;                                                     // string stiffness: partials run slightly sharp
    for (let k = 1; k <= 6; k++) { const fk = f * k * Math.sqrt(1 + B_ * k * k), a = 1 / (k ** 1.35), dec = (1.6 + 1.2 * (60 / m)) / (1 + 0.45 * k);
      if (fk > sr / 2.2) break; for (let i = 0; i < n; i++) d[i] += a * Math.sin(TAU * fk * i / sr + k) * Math.exp(-i / (dec * sr)); }
    for (let i = 0; i < 300; i++) d[i] += (Math.random() * 2 - 1) * 0.15 * Math.exp(-i / 60);   // felt hammer
    for (let i = 0; i < 200; i++) d[i] *= i / 200;
    lp(d, sr, 4200); normalize(d, 0.5); return loopBuf(C, d);
  };
  for (let m = 38; m <= 86; m++) if ([2, 4, 6, 9, 11, 1].includes(m % 12)) B.piano[m] = piano(m);
  return B;
}

// a reverb impulse response: early reflections + a diffuse tail with high frequencies dying faster
export function impulse(C, sec, decay, bright = 0.5, early = 6) {
  const n = Math.round(C.sampleRate * sec), b = C.createBuffer(2, n, C.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay);
    for (let k = 0; k < early; k++) { const s0 = Math.floor(rnd(0.006, 0.06) * C.sampleRate); if (s0 < n) d[s0] += rnd(0.3, 0.8) * (Math.random() < 0.5 ? -1 : 1); }
    lp(d, C.sampleRate, 1500 + bright * 6000);
  }
  return b;
}
