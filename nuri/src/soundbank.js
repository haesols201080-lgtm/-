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
    const n = Math.round(sr * sec), L = new Float32Array(n), R = new Float32Array(n);
    for (const d of [L, R]) {
      // bubbles come in bursts (water tumbling over a stone), not evenly
      const bursts = Math.round(sec * rate / 14);
      for (let b = 0; b < bursts; b++) { const c = Math.random() * sec, w = rnd(0.05, 0.35), seg = new Float32Array(Math.round(sr * w));
        bubbles(seg, sr, rnd(8, 22) / w, fLo, fHi, 0.5); const s0 = Math.floor(c * sr); for (let i = 0; i < seg.length && s0 + i < n; i++) d[s0 + i] += seg[i]; }
      bubbles(d, sr, rate * 0.3, fLo, fHi, 0.35);
      bubbles(d, sr, rate * 0.02, 90, 260, 0.6);                               // the occasional deep glug
      const nz = new Float32Array(n); for (let i = 0; i < n; i++) nz[i] = Math.random() * 2 - 1;
      const hiss = bp(nz, sr, 2600, 0.6), mod = (i) => 0.6 + 0.4 * Math.sin(i / sr * 1.3 + Math.random() * 0.001);
      for (let i = 0; i < n; i++) d[i] += hiss[i] * bed * mod(i);
      if (roar) { const r = new Float32Array(n); for (let i = 0; i < n; i++) r[i] = Math.random() * 2 - 1; lp(r, sr, 420); lp(r, sr, 420); for (let i = 0; i < n; i++) d[i] += r[i] * roar; }
      hp(d, sr, 90); normalize(d, 0.8);
    }
    const a = seam(L, sr), b = seam(R, sr), bf = C.createBuffer(2, a.length, sr); bf.copyToChannel(a, 0); bf.copyToChannel(b, 1); return bf;
  };
  B.stream = water(7, 140, 380, 2600, 0.05, 0);
  B.brook = water(6, 260, 300, 1900, 0.09, 0.0);
  B.fall = water(6, 900, 160, 1300, 0.35, 0.9);
  // ---- wind: brown noise with wandering resonances and gusts; pine needles hiss in the crowns; branches creak now and
  // then; leaves: fine crackle that follows the gusts. All stereo (left and right independent).
  {
    const sec = 18, n = Math.round(sr * sec);
    const gust = (t) => Math.max(0.1, 0.55 + 0.45 * Math.sin(t * 0.39 + 1) * Math.sin(t * 0.23) + 0.15 * Math.sin(t * 1.7));
    const ch = (seed) => {
      const d = new Float32Array(n), lv = new Float32Array(n), nd = new Float32Array(n);
      let br = 0; for (let i = 0; i < n; i++) { br = (br + (Math.random() * 2 - 1) * 0.02) * 0.998; d[i] = br; nd[i] = Math.random() * 2 - 1; }
      const f1 = bp(d, sr, 240 + seed * 40, 2.2), f2 = bp(d, sr, 520, 3), needles = bp(nd, sr, 3600, 0.9);
      for (let i = 0; i < n; i++) { const g = gust(i / sr + seed); d[i] = d[i] * 0.5 + (f1[i] * 3 + f2[i] * 2) * g + needles[i] * 0.12 * g * g; }
      for (let i = 0; i < n; i++) { const g = Math.max(0, gust(i / sr + seed) - 0.35); if (Math.random() < 0.03 * g) { const a = rnd(0.2, 1) * g; for (let k = 0; k < 40 && i + k < n; k++) lv[i + k] += a * (Math.random() * 2 - 1) * Math.exp(-k / 8); } }
      // creaks: a slow friction squeal through a body resonance
      for (let c = 0; c < 2; c++) { const s0 = Math.floor(rnd(1, sec - 2) * sr), len = Math.floor(rnd(0.4, 0.9) * sr), f0 = rnd(90, 180); let ph = 0;
        const cr = new Float32Array(len); for (let i = 0; i < len; i++) { const u = i / len; ph += TAU * f0 * (1 + 0.25 * Math.sin(u * 6) + 0.03 * (Math.random() * 2 - 1)) / sr; cr[i] = (ph % TAU) / TAU - 0.5; }
        const res = bp(cr, sr, rnd(380, 700), 6); for (let i = 0; i < len && s0 + i < n; i++) d[s0 + i] += res[i] * Math.sin(Math.PI * i / len) * 0.05; }
      hp(lv, sr, 2500); normalize(d, 0.8); normalize(lv, 0.6); return [seam(d, sr, 0.5), seam(lv, sr, 0.3)];
    };
    const [wl, ll] = ch(0), [wr, lr] = ch(7.3);
    const st = (a, b) => { const bf = C.createBuffer(2, Math.min(a.length, b.length), sr); bf.copyToChannel(a.subarray(0, bf.length), 0); bf.copyToChannel(b.subarray(0, bf.length), 1); return bf; };
    B.wind = st(wl, wr); B.leaves = st(ll, lr);
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
        const env = Math.sin(Math.PI * u) ** 0.6 * (n.a || 1) * (1 - (n.trem || 0.15) * (0.5 + 0.5 * Math.sin(TAU * 42 * i / sr)));
        const h = n.mellow ? [1, 0.08, 0.02] : [1, 0.22, 0.08];
        d[s0 + i] += env * (Math.sin(ph) + h[1] * Math.sin(2 * ph) + h[2] * Math.sin(3 * ph)) + env * 0.04 * (Math.random() * 2 - 1);
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
  // blackbird-like: mellow, slurred flute phrases in the low register, ending in a quiet twitter
  for (let v = 0; v < 2; v++) { const N = []; let t = 0;
    for (let k = 0; k < 4; k++) { const f = rnd(1500, 2600), f2 = f * rnd(0.8, 1.3); N.push({ t, d: rnd(0.18, 0.32), f0: f, f1: f2, curve: 1, mellow: 1, vib: 40, trem: 0.05 }); t += rnd(0.2, 0.36); }
    for (let k = 0; k < 5; k++) { N.push({ t, d: 0.03, f0: rnd(4500, 6000), f1: rnd(3500, 5000), a: 0.4 }); t += 0.05; }
    B.birds.push(sing(N)); }
  // dove: soft low hoo-hoo
  { const N = [], f = 520; [[0, 0.32, 1], [0.5, 0.22, 0.8], [0.8, 0.5, 1]].forEach(([t, d, a]) => N.push({ t, d, f0: f * 0.95, f1: f * 1.02, curve: 1, a })); B.dove = sing(N); }
  // woodpecker: a quick roll of knocks
  { const n = Math.round(sr * 1.1), d = new Float32Array(n);
    for (let k = 0; k < 17; k++) { const s0 = Math.floor((k * 0.048 + (k * k) * 0.0004) * sr);
      for (let i = 0; i < 400 && s0 + i < n; i++) d[s0 + i] += (Math.random() * 2 - 1) * Math.exp(-i / 50) * 0.6 + Math.sin(TAU * 950 * i / sr) * Math.exp(-i / 120) * 0.5; }
    normalize(d, 0.7); B.woodpecker = loopBuf(C, d); }
  // ---- footsteps
  const step1 = (kind) => {
    const n = Math.round(sr * 0.32), d = new Float32Array(n), nz = () => Math.random() * 2 - 1;
    const thump = (f, dec, a) => { for (let i = 0; i < n; i++) d[i] += a * Math.sin(TAU * f * i / sr * (1 - i / n * 0.3)) * Math.exp(-i / (dec * sr)); };
    const grit = (f, q, dec, a, t0 = 0) => { const g = new Float32Array(n); for (let i = 0; i < n; i++) g[i] = nz() * Math.exp(-Math.max(0, i / sr - t0) / dec) * (i / sr >= t0 ? 1 : 0); const o = bp(g, sr, f, q); for (let i = 0; i < n; i++) d[i] += o[i] * a; };
    const clicks = (cnt, spread, fLo, fHi, a, dec = 0.0012) => { for (let k = 0; k < cnt; k++) { const s0 = Math.floor(Math.random() ** 1.5 * spread * sr), f = rnd(fLo, fHi), aa = a * rnd(0.3, 1);
      for (let i = 0; i < sr * 0.012 && s0 + i < n; i++) d[s0 + i] += aa * Math.sin(TAU * f * i / sr) * Math.exp(-i / (dec * sr)) * (0.5 + 0.5 * nz()); } };
    const modes = (fs, decs, a) => fs.forEach((f, k) => { for (let i = 0; i < n; i++) d[i] += a * Math.sin(TAU * f * i / sr) * Math.exp(-i / (decs[k] * sr)) / (k + 1); });
    if (kind === 'leaves') { clicks(110, 0.12, 900, 4200, 0.38, 0.0012); thump(85, 0.035, 0.45); grit(2200, 1, 0.05, 0.3); grit(700, 1.2, 0.05, 0.35); }
    else if (kind === 'dirt') { thump(70, 0.04, 0.7); grit(900, 0.9, 0.035, 0.5); clicks(6, 0.04, 1500, 3000, 0.15); }
    else if (kind === 'pebbles') { thump(90, 0.03, 0.5); clicks(9, 0.07, 1800, 4200, 0.5, 0.004); grit(900, 1, 0.03, 0.2); }
    else if (kind === 'moss') { thump(60, 0.05, 0.5); grit(420, 0.7, 0.06, 0.4); }
    else if (kind === 'rock') { clicks(2, 0.006, 3000, 4200, 0.7, 0.0025); thump(150, 0.025, 0.5); }
    else if (kind === 'wood') { modes([rnd(170, 210), rnd(390, 440), rnd(680, 760)], [0.09, 0.06, 0.04], 0.6); clicks(2, 0.004, 2000, 3000, 0.4, 0.002); }
    else if (kind === 'metal') { modes([rnd(880, 940), 1430, 2210, 3020].map((f) => f * rnd(0.97, 1.03)), [0.25, 0.18, 0.12, 0.08], 0.35); clicks(2, 0.003, 4000, 6000, 0.5, 0.002); }
    else if (kind === 'water') { grit(1200, 0.6, 0.09, 0.8); bubbles(d, sr, 120, 500, 2400, 0.25); thump(80, 0.04, 0.3); }
    return d;
  };
  // a step is a heel strike and then the toe rolling down ~60-90 ms later (softer)
  const step = (kind) => {
    const a = step1(kind), b = step1(kind), off = Math.floor(rnd(0.06, 0.09) * sr), d = new Float32Array(a.length + off);
    for (let i = 0; i < a.length; i++) d[i] += a[i]; for (let i = 0; i < b.length; i++) d[i + off] += b[i] * 0.55;
    lp(d, sr, 6500); normalize(d, 0.85); return loopBuf(C, d);
  };
  B.steps = {};
  for (const k of ['leaves', 'dirt', 'pebbles', 'moss', 'rock', 'wood', 'metal', 'water']) B.steps[k] = [0, 1, 2, 3].map(() => step(k));
  // ---- piano voice for the music (D-major pentatonic over three octaves + chord tones)
  B.piano = {};
  const piano = (m) => {
    // Karplus-Strong: a burst of noise in a delay line the length of one period, averaged each pass (a plucked string)
    const f = 440 * Math.pow(2, (m - 69) / 12), sec = 3.2, n = Math.round(sr * sec), d = new Float32Array(n);
    const P = sr / f, N0 = Math.max(2, Math.round(P - 0.5)), frac = 0, line = new Float32Array(N0);   // the averaging adds half a sample
    for (let i = 0; i < line.length; i++) line[i] = (Math.random() * 2 - 1) * 0.8;
    lp(line, sr, 2500 + m * 30);                                             // a softer pluck (finger, not pick)
    const damp = 0.996 - Math.max(0, m - 60) * 0.00012;
    let idx = 0, prev = 0;
    for (let i = 0; i < n; i++) {
      const a = line[idx], b = line[(idx + 1) % line.length];
      const v = (a * (1 - frac) + b * frac);
      const y = damp * 0.5 * (v + prev); prev = v;
      line[idx] = y; d[i] = y; idx = (idx + 1) % line.length;
    }
    // body: a gentle resonance and a short attack ramp
    const body = bp(d, sr, 220, 1.2); for (let i = 0; i < n; i++) d[i] = d[i] + body[i] * 0.4;
    for (let i = 0; i < 64; i++) d[i] *= i / 64;
    normalize(d, 0.5); return loopBuf(C, d);
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
