// Chapter 2's sounds, synthesised from their physics (nothing is recorded) and rendered once into buffers, a few at a
// time while the car ride plays, so nothing stalls. Each comes from how the thing actually makes its sound:
//   the cat    — a purr is the larynx snapping open ~25 times a second on the in- and the out-breath, through the
//                throat; a meow, a trill, a growl and a yowl are a glottal source (harmonics with jitter) through
//                moving formants; a hiss is forced breath through the open mouth; paws are soft pads with claws ticking
//                on the floorboards, scrabbling for grip as it bolts
//   the house  — the fridge's compressor (mains hum at 60/120 Hz and its harmonics, the condenser fan, refrigerant
//                gurgling), its relay starting and stopping it, bottles in its door chinking, the ice maker dropping
//                cubes; a mechanical mantel clock (tick and tock from the escapement into the wooden case) that strikes
//                the hour on a coiled gong, a quartz kitchen clock, the twin-bell alarm clock by the bed; steam
//                radiators hissing at their vents and banging (water hammer in the pipes); floorboards and joists
//                creaking as the house cools (stick-slip friction through the wood's resonances)
//   outside    — Queens at night through the walls: the traffic wash, cars passing on the street, sirens far off
//                with the buildings echoing them, the elevated train, a plane coming down into LaGuardia, a dog, a horn
//   people     — the stranger snoring (the soft palate fluttering on the in-breath), talking in their sleep, the duvet
//                and the bed; boots on the drive, the porch and the stairs; the keys, the deadbolt, the front door
//   things     — the wicker basket creaking, its lid, the cat flap swinging and its latch, the lamp switch
//   the car    — tyre roar in the cabin, expansion joints, a bridge's steel deck, a bus's air brakes, the handbrake
import { TAU, rnd, normalize, lp, hp, bp, seam, bubbles, makeCrickets } from './soundbank.js';

const nz = () => Math.random() * 2 - 1;
const arr = (sr, sec) => new Float32Array(Math.max(1, Math.round(sr * sec)));
const white = (n) => { const d = new Float32Array(n); for (let i = 0; i < n; i++) d[i] = nz(); return d; };
const brown = (n, leak = 0.996, k = 0.04) => { const d = new Float32Array(n); let y = 0; for (let i = 0; i < n; i++) { y = y * leak + nz() * k; d[i] = y; } return d; };
function pink(n) {   // (Paul Kellet's filter)
  const d = new Float32Array(n); let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < n; i++) { const w = nz(); b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2; }
  return d;
}
const add = (d, s, at = 0, g = 1) => { const o = Math.round(at); for (let i = 0; i < s.length; i++) { const j = o + i; if (j >= 0 && j < d.length) d[j] += s[i] * g; } return d; };
// (a buffer may have its own rate: distant and muffled things are rendered at 22 or 24 kHz, the browser resamples them)
const mono = (C, d, r) => { const b = C.createBuffer(1, d.length, r); b.copyToChannel(d, 0); return b; };
const stereo = (C, L, R, r) => { const n = Math.min(L.length, R.length), b = C.createBuffer(2, n, r); b.copyToChannel(L.subarray(0, n), 0); b.copyToChannel(R.subarray(0, n), 1); return b; };
// a smooth path through [u, value] points (u = 0..1 over the sound)
const path = (pts) => (u) => {
  if (u <= pts[0][0]) return pts[0][1];
  for (let k = 1; k < pts.length; k++) if (u <= pts[k][0]) { const [u0, v0] = pts[k - 1], [u1, v1] = pts[k], t = (u - u0) / (u1 - u0); return v0 + (v1 - v0) * t * t * (3 - 2 * t); }
  return pts[pts.length - 1][1];
};
// an echo or two (the buildings across the street, the yard)
const echo = (d, sr, taps) => { const o = d.slice(); for (const [t, g] of taps) add(o, d, t * sr, g); return o; };

// an impact ringing a set of modes (struck from rest), with the contact's own click
function strike(sr, sec, fs, decs, amps = [], { click = 0.3, clickDec = 0.0006, at = 0, into = null, gain = 1 } = {}) {
  const d = into || arr(sr, sec), n = d.length, s0 = Math.round(at * sr);
  fs.forEach((f, k) => {
    // a decaying phasor turned a step each sample (cheaper than exp and sin per sample)
    const r = Math.exp(-1 / (decs[k] * sr)), a = (amps[k] ?? 1 / (k + 1)) * gain, w = TAU * Math.min(f, sr * 0.45) / sr, cw = Math.cos(w) * r, sw = Math.sin(w) * r;
    let re = a, im = 0;
    for (let i = 0; s0 + i < n; i++) { d[s0 + i] += im; const t = re * cw - im * sw; im = re * sw + im * cw; re = t; if ((i & 63) === 0 && re * re + im * im < 4e-8 * a * a) break; }
  });
  if (click) { const r = Math.exp(-1 / (clickDec * sr)); let e = click * gain; for (let i = 0; s0 + i < n && e > 1e-4 * click; i++) { d[s0 + i] += e * nz(); e *= r; } }
  return d;
}
// a low thump: a sine sagging in pitch as it dies (a body landing on a floor, a door slab)
function thump(d, sr, f, dec, a, at = 0) {
  const s0 = Math.round(at * sr); let ph = 0;
  for (let i = 0; s0 + i < d.length; i++) { const e = Math.exp(-i / (dec * sr)); if (e < 2e-4) break; ph += TAU * f * (1 - 0.25 * Math.min(1, i / (dec * sr * 3))) / sr; d[s0 + i] += a * e * Math.sin(ph); }
  return d;
}
// a burst of filtered noise
function burst(d, sr, at, dur, f, q, a, { attack = 0.002, curve = 1 } = {}) {
  const n = Math.round(dur * sr), s = new Float32Array(n);
  for (let i = 0; i < n; i++) { const t = i / sr, u = i / n; s[i] = nz() * Math.min(1, t / attack) * Math.pow(1 - u, curve); }
  return add(d, f ? bp(s, sr, f, q) : s, at * sr, a);
}
// friction: stick-slip pulses at a rate that wanders, through the body's resonances (a creak, a hinge's squeak)
function stickSlip(sr, sec, { rate, body, amp = (u) => Math.sin(Math.PI * u) ** 0.7, jit = 0.15 }) {
  const n = Math.round(sr * sec), src = new Float32Array(n); let t = 0.005;
  while (t < sec - 0.005) { const u = t / sec, a = amp(u) * rnd(0.6, 1), s0 = Math.floor(t * sr); src[s0] += a; if (s0 + 1 < n) src[s0 + 1] -= a * 0.6; t += (1 / Math.max(5, rate(u))) * (1 + nz() * jit); }
  const o = new Float32Array(n);
  for (const [f, q, g] of body) { const r = bp(src, sr, f, q); for (let i = 0; i < n; i++) o[i] += r[i] * g; }
  return o;
}
// a voice: a glottal source (harmonics falling off with `tilt`, f0 with jitter; `rough` halves the period now and then,
// the rasp of a growl) shaped by moving formants [[F, bandwidth, gain], ...]; breath noise through the same tract
function voice(sr, sec, { f0, form, amp, jitter = 0.008, breath = 0.05, rough = 0, tilt = 1, am = null, maxF = 9000 }) {
  const n = Math.round(sr * sec), d = new Float32Array(n), br = new Float32Array(n), K = 56, H = new Float32Array(K + 1);
  let ph = 0, jit = 0, F = f0(0), top = K;
  for (let i = 0; i < n; i++) {
    const u = i / n;
    if ((i & 31) === 0) {
      F = f0(u); const fm = form(u); top = Math.min(K, Math.floor(Math.min(maxF, sr * 0.45) / F));
      for (let k = 1; k <= top; k++) { const f = F * k; let g = 0; for (const [Fc, B, a] of fm) { const x = (f - Fc) / (B * 0.5); g += a / (1 + x * x); } H[k] = g / Math.pow(k, tilt); }
    }
    jit = jit * 0.998 + nz() * jitter * 0.06;
    ph += TAU * F * (1 + jit) / sr; if (ph > TAU * 2) ph -= TAU * 2;
    const s1 = Math.sin(ph), c2 = 2 * Math.cos(ph); let sp = 0, sk = s1, v = 0;
    for (let k = 1; k <= top; k++) { v += H[k] * sk; const sn = c2 * sk - sp; sp = sk; sk = sn; }
    if (rough) v *= 1 + rough * Math.sin(ph * 0.5) * (0.6 + 0.4 * nz());
    const a = amp(u) * (am ? am(i / sr, u) : 1);
    d[i] = v * a; br[i] = nz() * a;
  }
  normalize(d, 0.8);
  if (breath) {
    const nb = new Float32Array(n);
    for (const [Fc, B, a] of form(0.5)) { const r = bp(br, sr, Fc, Math.max(0.5, Fc / B)); for (let i = 0; i < n; i++) nb[i] += r[i] * a; }
    normalize(nb, 0.8); for (let i = 0; i < n; i++) d[i] = d[i] * (1 - breath) + nb[i] * breath;
  }
  return d;
}
const env3 = (a, s, r) => (u) => (u < a ? (u / a) ** 1.5 : u > 1 - r ? Math.max(0, (1 - u) / r) ** 1.4 : 1) * (1 - s * u);

// ---------------------------------------------------------------- the cat
function purr(sr, sec) {
  const d = arr(sr, sec), n = d.length, envA = new Float32Array(n);
  let t = 0.03;
  while (t < sec) {
    const cyc = rnd(2.1, 2.7), inh = cyc * rnd(0.38, 0.45), exh = cyc * rnd(0.45, 0.52);
    for (const [t0, len, rate, a] of [[t, inh, rnd(24.5, 27), 0.62], [t + inh + 0.05, exh, rnd(21.5, 23.5), 1]]) {
      let tp = t0;
      while (tp < t0 + len) {
        const u = (tp - t0) / len, e = a * Math.sin(Math.PI * u) ** 0.6, s0 = Math.floor(tp * sr), f = rnd(55, 80), L = Math.floor(sr * 0.03);
        for (let i = 0; i < L && s0 + i < n; i++) { const x = i / sr; d[s0 + i] += e * (0.7 * Math.sin(TAU * f * x) * Math.exp(-x / 0.007) + 0.45 * nz() * Math.exp(-x / 0.002)); }
        const step = (1 / rate) * (1 + nz() * 0.06);
        for (let i = 0; i < step * sr && s0 + i < n; i++) envA[s0 + i] = e;
        tp += step;
      }
    }
    t += cyc;
  }
  lp(envA, sr, 8);
  const a = bp(d, sr, 240, 1.4), b = bp(d, sr, 780, 2.2), br = white(n); lp(br, sr, 1600); hp(br, sr, 250);
  const o = new Float32Array(n); for (let i = 0; i < n; i++) o[i] = d[i] * 0.12 + a[i] * 1.2 + b[i] * 0.5 + br[i] * envA[i] * 0.4;
  hp(o, sr, 35); lp(o, sr, 1400); lp(o, sr, 1400); normalize(o, 0.8); return seam(o, sr, 0.15);   // (a purr is almost all below 1.5 kHz)
}
function hiss(sr) {
  const sec = rnd(1.0, 1.4), n = Math.round(sr * sec), w = white(n);
  const a = bp(w, sr, rnd(3000, 3600), 1.6), b = bp(w, sr, rnd(5200, 6200), 2.2), c = bp(w, sr, 1600, 1.2), o = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sr, u = t / sec, atk = Math.min(1, t / 0.012), rel = u > 0.7 ? Math.exp(-(u - 0.7) * 10) : 1, wob = 0.85 + 0.15 * Math.sin(TAU * 5.5 * t + 1);
    o[i] = (a[i] + b[i] * 0.7 + c[i] * 0.35) * atk * rel * wob + w[i] * (t < 0.05 ? 1.6 * Math.exp(-t / 0.014) : 0) * 0.5;   // (the spit first)
  }
  hp(o, sr, 900); normalize(o, 0.85); return o;
}
function growl(sr) {
  const sec = rnd(1.3, 1.8), w1 = rnd(0.8, 1.6);
  return voice(sr, sec, { f0: (u) => 112 + 16 * Math.sin(TAU * w1 * u + 1) - 10 * u, form: () => [[520, 300, 1], [1250, 350, 0.6], [2600, 500, 0.25], [3600, 600, 0.1]],
    amp: env3(0.08, 0.1, 0.18), am: (t) => 0.55 + 0.45 * Math.sin(TAU * 22 * t + 2 * Math.sin(TAU * 1.3 * t)), rough: 0.5, jitter: 0.035, breath: 0.28, tilt: 0.8 });
}
function yowl(sr) {
  const sec = rnd(1.2, 1.5);
  const F0 = path([[0, 250], [0.3, 470], [0.6, 560], [1, 380]]), F1 = path([[0, 420], [0.4, 920], [1, 680]]), F2 = path([[0, 1300], [0.45, 1900], [1, 1450]]);
  return voice(sr, sec, { f0: (u) => F0(u) * (1 + 0.025 * Math.sin(TAU * 6.5 * u * sec)), form: (u) => [[F1(u), 260, 1], [F2(u), 320, 0.7], [3100, 500, 0.3]],
    amp: env3(0.12, 0, 0.3), rough: 0.25, jitter: 0.02, breath: 0.12, tilt: 0.9 });
}
function meow(sr, kind) {
  if (kind === 0) {   // "mee-ow"
    const F0 = path([[0, 480], [0.3, 690], [0.65, 640], [1, 470]]), F1 = path([[0, 380], [0.25, 950], [0.7, 900], [1, 600]]), F2 = path([[0, 1500], [0.3, 2100], [0.7, 1700], [1, 1150]]);
    return voice(sr, rnd(0.7, 0.85), { f0: F0, form: (u) => [[F1(u), 220, 1], [F2(u), 300, 0.7], [3300, 450, 0.3]], amp: path([[0, 0], [0.08, 0.5], [0.3, 1], [0.75, 0.8], [1, 0]]), breath: 0.08, tilt: 1.1 });
  }
  if (kind === 1) {   // a short "mew"
    const F0 = path([[0, 620], [0.4, 780], [1, 600]]), F1 = path([[0, 500], [0.4, 1000], [1, 800]]), F2 = path([[0, 1900], [0.4, 2300], [1, 1900]]);
    return voice(sr, rnd(0.35, 0.45), { f0: F0, form: (u) => [[F1(u), 240, 1], [F2(u), 320, 0.6], [3500, 500, 0.25]], amp: path([[0, 0], [0.12, 1], [0.6, 0.8], [1, 0]]), breath: 0.1, tilt: 1.1 });
  }
  // "mrrow?" - it starts as a trill and opens, rising
  const F0 = path([[0, 420], [0.3, 480], [0.7, 560], [1, 700]]), F1 = path([[0, 450], [0.35, 800], [1, 1000]]), F2 = path([[0, 1300], [0.4, 1600], [1, 2100]]);
  return voice(sr, rnd(0.6, 0.75), { f0: F0, form: (u) => [[F1(u), 240, 1], [F2(u), 320, 0.6], [3300, 500, 0.25]], amp: path([[0, 0], [0.08, 0.7], [0.5, 1], [0.85, 0.8], [1, 0]]),
    am: (t, u) => (u < 0.28 ? 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(TAU * 26 * t)) ** 2 : 1), breath: 0.1, tilt: 1.1 });
}
function trill(sr) {
  const F0 = path([[0, 470], [0.5, 560], [1, 620]]);
  return voice(sr, rnd(0.38, 0.5), { f0: F0, form: () => [[500, 250, 1], [1700, 400, 0.5], [3200, 500, 0.15]], amp: path([[0, 0], [0.15, 1], [0.7, 0.9], [1, 0]]),
    am: (t) => 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(TAU * 26 * t)) ** 2, breath: 0.08, tilt: 1.2 });
}
function pad(sr, claws) {
  const d = arr(sr, 0.1);
  thump(d, sr, rnd(95, 130), 0.012, 0.8); burst(d, sr, 0, 0.03, 700, 0.8, 0.35);
  if (claws) for (let k = 0; k < (Math.random() < 0.5 ? 1 : 2); k++) strike(sr, 0, [rnd(3500, 5500), rnd(6500, 7800)], [0.0015, 0.001], [0.5, 0.25], { click: 0.25, clickDec: 0.0003, at: rnd(0.002, 0.02), into: d });
  normalize(d, 0.8); return d;
}
function scrabble(sr) {   // claws skidding on the varnish for grip, then catching
  const sec = 0.55, d = arr(sr, sec);
  for (let k = 0; k < 22; k++) strike(sr, 0, [rnd(2800, 5500), rnd(6000, 8000)], [0.0012, 0.0008], [1, 0.4], { click: 0.4, clickDec: 0.0003, at: Math.pow(Math.random(), 0.8) * (sec - 0.05), into: d, gain: rnd(0.3, 1) });
  for (let k = 0; k < 3; k++) { const s0 = rnd(0.02, 0.3), len = rnd(0.02, 0.05), f = rnd(1300, 2200), m = Math.round(len * sr), s = new Float32Array(m);
    for (let i = 0; i < m; i++) s[i] = Math.sin(TAU * f * i / sr * (1 + 0.1 * i / m)) * Math.sin(Math.PI * i / m) * (0.6 + 0.4 * nz()); add(d, s, s0 * sr, 0.25); }
  for (let k = 0; k < 4; k++) thump(d, sr, rnd(90, 120), 0.012, 0.5, 0.05 + k * rnd(0.08, 0.11));
  normalize(d, 0.85); return d;
}
function catLand(sr) {   // onto the cat tree's carpeted top: the weight, the claws in the sisal, the tree rocking
  const d = arr(sr, 0.9);
  thump(d, sr, 75, 0.05, 1); burst(d, sr, 0, 0.06, 1200, 0.8, 0.4);
  const sc = new Float32Array(Math.round(0.25 * sr)); for (let i = 0; i < sc.length; i++) sc[i] = nz() * (Math.random() < 0.08 ? 1 : 0.25) * (1 - i / sc.length);
  add(d, bp(sc, sr, 2800, 1), 0.01 * sr, 0.5);
  strike(sr, 0, [rnd(170, 200), rnd(400, 450), rnd(900, 1000)], [0.15, 0.08, 0.04], [0.6, 0.4, 0.2], { click: 0.2, at: 0.005, into: d });   // (the cardboard post's hollow thonk)
  add(d, stickSlip(sr, 0.35, { rate: (u) => 90 + 60 * u, body: [[480, 5, 1], [1150, 4, 0.4]] }), 0.12 * sr, 0.12);
  normalize(d, 0.85); return d;
}

// ---------------------------------------------------------------- the house
function fridgeHum(sr) {
  const sec = 8, n = sr * sec, d = new Float32Array(n), w = white(n), fan = bp(w, sr, 420, 0.8), fan2 = bp(w, sr, 1150, 2.5), p = [0, 1, 2, 3, 4, 5].map(() => Math.random() * TAU);
  for (let i = 0; i < n; i++) {
    const t = i / sr, m = 1 + 0.06 * Math.sin(TAU * 0.25 * t);
    d[i] = m * (0.5 * Math.sin(TAU * 120 * t + p[0]) + 0.35 * Math.sin(TAU * 120.125 * t + p[1]) + 0.3 * Math.sin(TAU * 60 * t + p[2]) + 0.18 * Math.sin(TAU * 240 * t + p[3])
      + 0.1 * Math.sin(TAU * 180 * t + p[4]) + 0.06 * Math.sin(TAU * 360 * t + p[5]) + 0.03 * Math.sin(TAU * 480 * t)) + fan[i] * 0.9 + fan2[i] * 0.25;
  }
  bubbles(d, sr, 1.2, 140, 420, 0.06);
  lp(d, sr, 1600); lp(d, sr, 1600); hp(d, sr, 40); normalize(d, 0.7);
  for (let i = 0; i < n; i++) d[i] += 0.006 * Math.sin(TAU * 3125 * i / sr);   // (and the faint whine of the electronics, above it)
  return seam(d, sr, 0.1);
}
const tink = (sr, d, at, g) => strike(sr, 0, [rnd(2600, 3200), rnd(4200, 5000), rnd(6500, 7200)], [0.06, 0.04, 0.025], [1, 0.6, 0.3], { click: 0.2, at, into: d, gain: g });
function fridgeOn(sr) {
  const d = arr(sr, 1.3);
  strike(sr, 0, [2600, 4100], [0.004, 0.003], [0.4, 0.2], { click: 0.5, clickDec: 0.0004, into: d });           // the relay
  strike(sr, 0, [58, 118, 240], [0.25, 0.15, 0.08], [1, 0.6, 0.3], { click: 0, at: 0.03, into: d });           // the motor kicking over
  const r = new Float32Array(Math.round(0.45 * sr)); for (let i = 0; i < r.length; i++) r[i] = nz() * (0.5 + 0.5 * Math.sin(TAU * 120 * i / sr)) * Math.exp(-i / (0.15 * sr));
  add(d, bp(r, sr, 380, 2), 0.04 * sr, 0.5); tink(sr, d, 0.15, 0.25); tink(sr, d, 0.22, 0.15);
  normalize(d, 0.8); return d;
}
function fridgeOff(sr) {
  const d = arr(sr, 1.5); let ph = 0;
  for (let i = 0; i < 0.6 * sr; i++) { const u = i / (0.6 * sr); ph += TAU * (60 - 38 * u) / sr; d[i] += 0.6 * Math.sin(ph) * (1 - u) ** 2; }
  const r = new Float32Array(Math.round(0.6 * sr)); for (let i = 0; i < r.length; i++) r[i] = nz() * (0.5 + 0.5 * Math.sin(TAU * 30 * i / sr)) * Math.exp(-i / (0.18 * sr));
  add(d, bp(r, sr, 300, 1.5), 0.05 * sr, 0.6); tink(sr, d, 0.08, 0.3); tink(sr, d, 0.14, 0.2); if (Math.random() < 0.6) tink(sr, d, 0.21, 0.12);
  normalize(d, 0.8); return d;
}
function fridgeGurgle(sr) {
  const sec = 5, d = arr(sr, sec);
  for (let b = 0; b < 4; b++) { const seg = arr(sr, rnd(0.3, 0.8)); bubbles(seg, sr, 40, 180, 900, 0.3); add(d, seg, rnd(0, sec - 0.8) * sr, rnd(0.5, 1)); }
  burst(d, sr, 0.2, 2.5, 2500, 0.8, 0.04, { attack: 0.5 });
  for (let k = 0; k < 4; k++) strike(sr, 0, [rnd(1800, 2600), rnd(3200, 4200)], [0.006, 0.004], [0.5, 0.25], { click: 0.2, at: rnd(0.5, sec - 0.2), into: d, gain: rnd(0.3, 0.8) });
  normalize(d, 0.6); return d;
}
function ice(sr) {
  const d = arr(sr, 1.2); let t = 0.04;
  for (let k = 0; k < 9; k++) { strike(sr, 0, [rnd(1400, 2200), rnd(2800, 3800), rnd(4800, 6200)], [0.02, 0.012, 0.008], [1, 0.6, 0.35], { click: 0.5, at: t, into: d, gain: rnd(0.35, 1) * (k < 3 ? 1 : 0.7) }); t += rnd(0.015, 0.09); }
  thump(d, sr, 210, 0.02, 0.4, 0.05);
  normalize(d, 0.8); return d;
}
// the mantel clock's escapement: the pallet dropping and locking (two impacts ~3 ms apart) into the wooden case; the
// tock a little lower than the tick
function clockBeat(sr, d, at, k, g) {
  const fs = [1150, 1820, 2650, 3900].map((f) => f * k * rnd(0.98, 1.02));
  strike(sr, 0, fs, [0.018, 0.012, 0.008, 0.005], [1, 0.7, 0.45, 0.3], { click: 0.6, clickDec: 0.0003, at, into: d, gain: g });
  strike(sr, 0, fs, [0.012, 0.008, 0.006, 0.004], [1, 0.7, 0.45, 0.3], { click: 0.3, clickDec: 0.0003, at: at + 0.003, into: d, gain: g * 0.45 });
  strike(sr, 0, [rnd(410, 440) * k, rnd(820, 880) * k], [0.02, 0.012], [0.4, 0.2], { click: 0, at, into: d, gain: g });
}
function tickMantel(sr) { const d = arr(sr, 2); for (let b = 0; b < 4; b++) clockBeat(sr, d, b * 0.5, b % 2 ? 0.86 : 1, rnd(0.85, 1)); normalize(d, 0.8); return d; }
function tickQuartz(sr) {
  const d = arr(sr, 2);
  for (let b = 0; b < 2; b++) strike(sr, 0, [rnd(2000, 2300), rnd(3300, 3700), rnd(5000, 5400), rnd(850, 950)], [0.006, 0.004, 0.003, 0.008], [1, 0.6, 0.3, 0.4], { click: 0.3, clickDec: 0.0003, at: b, into: d, gain: rnd(0.9, 1) });
  normalize(d, 0.7); return d;
}
function tickAlarm(sr) {   // the twin-bell alarm clock: four beats a second, its bells ringing faintly with each
  const d = arr(sr, 1);
  for (let b = 0; b < 4; b++) strike(sr, 0, [3300, 4700, 6900, 2210].map((f) => f * (b % 2 ? 0.94 : 1)), [0.008, 0.006, 0.004, 0.08], [1, 0.7, 0.4, 0.12], { click: 0.5, clickDec: 0.0003, at: b * 0.25, into: d, gain: rnd(0.85, 1) });
  normalize(d, 0.7); return d;
}
function chime(sr) {   // a coiled gong struck by the hammer (a rod's partials: 1, 2.76, 5.40, 8.93)
  const d = arr(sr, 5.5), f0 = rnd(290, 310);
  strike(sr, 0, [f0, f0 * 1.003, f0 * 2.76, f0 * 5.4, f0 * 8.93], [3.4, 3.0, 1.8, 0.9, 0.5], [1, 0.3, 0.6, 0.35, 0.2], { click: 0.4, clickDec: 0.0008, into: d });
  normalize(d, 0.8); return d;
}
function radHiss(sr) {   // the steam vent on the radiator: puffs of hiss, sometimes a whistle, a spit of water
  const sec = 9, n = sr * sec, w = white(n), h1 = bp(w, sr, 4200, 0.9), h2 = bp(w, sr, 7000, 1.2), d = new Float32Array(n), q = [rnd(0.1, 0.25), rnd(0.3, 0.6), Math.random() * TAU];
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr, puff = 0.62 + 0.25 * Math.sin(TAU * q[0] * t + q[2]) + 0.13 * Math.sin(TAU * q[1] * t);
    ph += TAU * (3520 + 25 * Math.sin(TAU * 0.7 * t)) / sr;
    d[i] = (h1[i] + h2[i] * 0.6) * puff + Math.max(0, puff - 0.8) * 0.9 * Math.sin(ph);
  }
  bubbles(d, sr, 2.5, 600, 2400, 0.2);
  hp(d, sr, 1500); normalize(d, 0.6); return seam(d, sr, 0.3);
}
function radKnock(sr, kind) {   // water hammer: the steam slams condensate along the pipe
  const at = kind === 0 ? [0] : kind === 1 ? [0, rnd(0.3, 0.4)] : [0, rnd(0.5, 0.65), rnd(0.8, 0.9)], d = arr(sr, at[at.length - 1] + 1.0);
  for (const a of at) {
    const g = rnd(0.6, 1);
    strike(sr, 0, [rnd(170, 200), rnd(480, 540), rnd(980, 1060), rnd(1600, 1750), rnd(2400, 2600)], [0.35, 0.22, 0.14, 0.09, 0.05], [0.8, 1, 0.7, 0.5, 0.3], { click: 0.8, clickDec: 0.0008, at: a, into: d, gain: g });
    thump(d, sr, 52, 0.07, 0.8 * g, a);
  }
  normalize(d, 0.9); return d;
}
function radTick(sr) {   // the iron expanding as it heats
  const d = arr(sr, 2.2), k = 3 + Math.floor(Math.random() * 4);
  for (let i = 0; i < k; i++) strike(sr, 0, [rnd(2600, 4800), rnd(5200, 7000)], [0.004, 0.002], [1, 0.5], { click: 0.5, at: rnd(0, 2), into: d, gain: rnd(0.3, 1) });
  normalize(d, 0.7); return d;
}
function creak(sr) {   // a floorboard or a joist as the house cools
  const sec = rnd(0.3, 0.9), f0 = rnd(70, 190), bodyF = rnd(380, 900), w = rnd(1, 3), p = Math.random() * TAU;
  const d = stickSlip(sr, sec, { rate: (u) => f0 * (0.6 + 0.6 * Math.sin(Math.PI * u)) * (1 + 0.25 * Math.sin(TAU * u * w + p)), body: [[bodyF, 6, 1], [bodyF * rnd(2.3, 2.9), 5, 0.5], [rnd(150, 220), 3, 0.6]] });
  normalize(d, 0.8); return d;
}
function settle(sr) { const d = arr(sr, 0.5); strike(sr, 0, [rnd(600, 900), rnd(1500, 2100), rnd(3000, 3800)], [0.03, 0.015, 0.008], [1, 0.6, 0.3], { click: 0.7, into: d }); normalize(d, 0.8); return d; }

// ---------------------------------------------------------------- outside
function cityBed(sr) {   // the traffic wash of Queens (a highway's hum under it, the avenues swelling and fading)
  const sec = 24, n = sr * sec, ch = () => {
    const b = brown(n, 0.997, 0.02); lp(b, sr, 250); lp(b, sr, 250);
    const hw = bp(brown(n, 0.998, 0.03), sr, 120, 1), hiss2 = bp(white(n), sr, 700, 0.6), bumps = [];
    for (let k = 0; k < 9; k++) bumps.push([rnd(0, sec), rnd(2, 5), rnd(0.3, 1)]);
    const d = new Float32Array(n);
    let s = 0;
    for (let i = 0; i < n; i++) { if ((i & 255) === 0) { const t = i / sr; s = 0; for (const [c, wd, a] of bumps) { const x = (t - c) / wd; s += a * Math.exp(-x * x); } } d[i] = b[i] * (0.5 + s) + hiss2[i] * 0.05 * s + hw[i] * 0.3; }
    hp(d, sr, 28); normalize(d, 0.7); return seam(d, sr, 0.6);
  };
  return [ch(), ch()];
}
function breeze(sr) {   // a night breeze in the yard: soft gusts, the neighbours' trees, a leaf skittering on the deck
  const sec = 14, n = sr * sec, ch = () => {
    const p = pink(n); lp(p, sr, 500); const lv = bp(white(n), sr, 3000, 0.8), d = new Float32Array(n), q = [rnd(0.15, 0.3), rnd(0.4, 0.7), Math.random() * TAU];
    let g = 0;
    for (let i = 0; i < n; i++) { if ((i & 127) === 0) { const t = i / sr; g = Math.max(0.12, 0.55 + 0.35 * Math.sin(TAU * q[0] * t + q[2]) + 0.15 * Math.sin(TAU * q[1] * t)); } d[i] = p[i] * g + lv[i] * 0.05 * g * g; }
    hp(d, sr, 30); normalize(d, 0.7); return seam(d, sr, 0.4);
  };
  return [ch(), ch()];
}
function carPass(sr) {   // tyres on asphalt and the engine low under them (the panner carries it past)
  const sec = 9, n = sr * sec, w = white(n), a = bp(w, sr, rnd(700, 900), 0.5), b = brown(n, 0.995, 0.05), d = new Float32Array(n), fe = rnd(38, 55); lp(b, sr, 300);
  for (let i = 0; i < n; i++) { const t = i / sr, u = t / sec, e = Math.sin(Math.PI * u) ** 0.5; d[i] = (a[i] * 0.7 + b[i] * 1.5 + 0.08 * Math.sin(TAU * fe * t) * (1 + 0.3 * Math.sin(TAU * fe * 2 * t))) * e; }
  normalize(d, 0.8); return d;
}
function siren(sr) {   // an FDNY wail and yelp far off, the buildings answering it
  const sec = 16, n = sr * sec, d = new Float32Array(n); let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr, u = t / sec, yelp = t > 8 && t < 11.5;
    const f = (650 + 850 * (0.5 - 0.5 * Math.cos(TAU * t * (yelp ? 3.2 : 1 / 4.2)))) * (1 + 0.03 * (0.5 - u));
    ph += TAU * f / sr; const e = Math.min(1, t / 3) * Math.min(1, (sec - t) / 4);
    d[i] = e * (Math.sin(ph) + 0.3 * Math.sin(2 * ph) + 0.45 * Math.sin(3 * ph) + 0.15 * Math.sin(5 * ph));
  }
  const o = bp(d, sr, 1200, 0.8); lp(o, sr, 1800);
  const e = echo(o, sr, [[0.31, 0.32], [0.67, 0.2], [1.1, 0.1]]); normalize(e, 0.8); return e;
}
function train(sr) {   // the elevated subway along Roosevelt Avenue: rumble, wheels over rail joints, a squeal on the curve
  const sec = 20, n = sr * sec, d = new Float32Array(n), env = path([[0, 0], [0.3, 1], [0.6, 1], [1, 0]]);
  const r = brown(n, 0.998, 0.03); lp(r, sr, 160); lp(r, sr, 160);
  for (let i = 0; i < n; i++) d[i] = r[i] * 2.2 * env(i / n);
  for (let t = 0.3; t < sec - 0.4; t += rnd(0.7, 0.8)) { const g = env(t / sec); for (const o of [0, rnd(0.16, 0.2)]) strike(sr, 0, [rnd(180, 260), rnd(600, 800), rnd(1400, 1700)], [0.05, 0.03, 0.02], [1, 0.5, 0.25], { click: 0.3, at: t + o, into: d, gain: g * rnd(0.3, 0.55) }); }
  const sq = new Float32Array(n), s0 = rnd(0.35, 0.5) * sec, s1 = s0 + rnd(2, 3.5), w = white(n);
  for (let i = Math.round(s0 * sr); i < Math.min(n, s1 * sr); i++) { const u = (i / sr - s0) / (s1 - s0); sq[i] = w[i] * Math.sin(Math.PI * u) * (0.6 + 0.4 * Math.sin(TAU * 7 * i / sr)); }
  add(d, bp(sq, sr, rnd(2900, 3300), 20), 0, 0.5);
  for (let i = 0; i < n; i++) { const t = i / sr, u = t / sec; d[i] += 0.012 * env(u) * Math.sin(TAU * (700 + 300 * u) * t); }
  lp(d, sr, 2500); const e = echo(d, sr, [[0.4, 0.25]]); normalize(e, 0.8); return e;
}
function plane(sr) {   // a jet low over Queens on its way down into LaGuardia
  const sec = 24, n = sr * sec, p = pink(n), b = brown(n, 0.997, 0.03), d = new Float32Array(n), env = path([[0, 0], [0.46, 1], [0.54, 1], [1, 0]]); lp(p, sr, 700); lp(b, sr, 120);
  let ph = 0;
  for (let i = 0; i < n; i++) { const u = i / n, e = env(u) ** 1.6; ph += TAU * (1950 - 200 * u) / sr; d[i] = (p[i] * 1.2 + b[i] * 1.4) * e + 0.02 * e * Math.sin(ph); }
  hp(d, sr, 25); normalize(d, 0.8); return d;
}
function dog(sr) {   // a dog a few yards over
  const d = arr(sr, 2.4);
  for (const t of [0, 0.42, 0.85, Math.random() < 0.5 ? 1.6 : 1.4]) {
    const F0 = path([[0, rnd(450, 520)], [0.2, rnd(600, 680)], [1, rnd(360, 420)]]);
    add(d, voice(sr, rnd(0.13, 0.2), { f0: F0, form: () => [[900, 400, 1], [1700, 500, 0.6], [2800, 600, 0.3]], amp: env3(0.06, 0.2, 0.4), rough: 0.6, jitter: 0.04, breath: 0.3, tilt: 0.7 }), t * sr, rnd(0.7, 1));
  }
  lp(d, sr, 2200); const e = echo(d, sr, [[0.18, 0.3], [0.41, 0.15]]); normalize(e, 0.8); return e;
}
function horn(sr) {   // a car's two-tone horn a street away
  const d = arr(sr, 1.4), two = Math.random() < 0.5;
  for (const [t0, len] of two ? [[0, 0.18], [0.3, 0.45]] : [[0, 0.5]]) for (const f of [415, 520]) {
    const m = Math.round(len * sr); for (let i = 0; i < m; i++) { const t = i / sr, e = Math.min(1, t / 0.02) * Math.min(1, (len - t) / 0.04); let s = 0; for (const k of [1, 3, 5, 7]) s += Math.sin(TAU * f * k * t) / k; d[Math.round(t0 * sr) + i] += 0.5 * s * e; }
  }
  lp(d, sr, 1800); const e = echo(d, sr, [[0.22, 0.3], [0.5, 0.15]]); normalize(e, 0.8); return e;
}

// ---------------------------------------------------------------- the stranger
function snore(sr) {
  const sec = 3.2, n = sr * sec, src = new Float32Array(n), inh = rnd(1.2, 1.5), fr = rnd(28, 42), peak = rnd(0.5, 0.7);
  for (let t = 0.05; t < inh; t += (1 / fr) * (1 + nz() * 0.08)) {
    const u = t / inh, e = (u < peak ? u / peak : (1 - u) / (1 - peak)) ** 1.2, s0 = Math.round(t * sr);
    for (let i = 0; i < 0.03 * sr && s0 + i < n; i++) { const x = i / sr; src[s0 + i] += e * (nz() * Math.exp(-x / 0.004) + 0.6 * Math.sin(TAU * 90 * x) * Math.exp(-x / 0.008)); }
  }
  const a = bp(src, sr, 320, 1.5), b = bp(src, sr, 1000, 2.5), c = bp(src, sr, 2400, 3), d = new Float32Array(n);
  for (let i = 0; i < n; i++) d[i] = a[i] + b[i] * 0.4 + c[i] * 0.15 + src[i] * 0.1;
  burst(d, sr, 0.05, inh, 1400, 0.6, 0.05, { attack: 0.4 });                                   // the air drawn in
  const ex = rnd(1.65, 1.85); lp(d, sr, 2200); lp(d, sr, 2200); burst(d, sr, ex, 0.05, 0, 0, 0.12); lp(d, sr, 4000);
  const out = new Float32Array(n); for (let i = Math.round(ex * sr); i < n; i++) { const u = (i / sr - ex) / (sec - ex); out[i] = nz() * Math.max(0, Math.sin(Math.PI * Math.min(1, Math.max(0, u)))) ** 0.8; }
  const o2 = bp(out, sr, 600, 0.5); lp(o2, sr, 1500); for (let i = 0; i < n; i++) d[i] += o2[i] * 0.35;
  normalize(d, 0.85); return d;
}
const VOW = { a: [730, 1090, 2440], e: [530, 1840, 2480], i: [270, 2290, 3010], o: [570, 840, 2410], u: [300, 870, 2240], schwa: [500, 1500, 2500] };
function mumble(sr) {   // talking in their sleep: a few slurred syllables, low and breathy, half into the pillow
  const syl = 3 + Math.floor(Math.random() * 3), keys = Object.keys(VOW), seq = Array.from({ length: syl }, () => VOW[keys[Math.floor(Math.random() * keys.length)]]);
  const sec = syl * rnd(0.2, 0.26) + 0.2, f0b = rnd(98, 118);
  const form = (u) => { const x = Math.min(syl - 1, u * syl), k = Math.floor(x), t = x - k, A = seq[k], B = seq[Math.min(syl - 1, k + 1)], s = t * t * (3 - 2 * t);
    return A.map((F, j) => [F + (B[j] - F) * s * 0.6, 120 + j * 60, [1, 0.5, 0.2][j]]); };
  const amp = (u) => { const x = u * syl, t = x - Math.floor(x); return Math.sin(Math.PI * t) ** 0.6 * (u > 0.9 ? (1 - u) * 10 : 1) * (0.7 + 0.3 * Math.sin(u * 7)); };
  const d = voice(sr, sec, { f0: (u) => f0b * (1 + 0.12 * Math.sin(u * 5) - 0.1 * u), form, amp, jitter: 0.02, breath: 0.35, tilt: 1.4 });
  lp(d, sr, 2000); normalize(d, 0.8); return d;
}
function rustle(sr) {   // the duvet as they turn over: thousands of tiny crinkles, a broad swish
  const sec = rnd(1.3, 1.8), n = Math.round(sr * sec), d = new Float32Array(n), env = path([[0, 0], [0.25, 1], [0.45, 0.4], [0.7, 0.9], [1, 0]]);
  for (let k = 0; k < 1400; k++) { const t = Math.random() * sec, e = env(t / sec); if (Math.random() > e) continue; const s0 = Math.round(t * sr), L = Math.round(rnd(0.0005, 0.002) * sr), a = rnd(0.2, 1); for (let i = 0; i < L && s0 + i < n; i++) d[s0 + i] += a * nz() * (1 - i / L); }
  const o = bp(d, sr, 2500, 0.5), sw = white(n); for (let i = 0; i < n; i++) sw[i] *= env(i / n); const s2 = bp(sw, sr, 1200, 0.7);
  for (let i = 0; i < n; i++) o[i] += s2[i] * 0.5; lp(o, sr, 7000); normalize(o, 0.8); return o;
}
function bedCreak(sr) {
  const d = arr(sr, 1.0);
  add(d, stickSlip(sr, rnd(0.5, 0.8), { rate: (u) => rnd(80, 140) * (0.7 + 0.5 * Math.sin(Math.PI * u)), body: [[rnd(300, 450), 5, 1], [rnd(800, 1000), 4, 0.4]] }), 0.05 * sr, 1);
  strike(sr, 0, [rnd(260, 300), rnd(680, 740), rnd(1200, 1300)], [0.35, 0.2, 0.12], [0.25, 0.15, 0.08], { click: 0, at: 0.08, into: d });   // (the box spring)
  thump(d, sr, 60, 0.06, 0.4, 0.04);
  normalize(d, 0.8); return d;
}
// a grown-up in boots: the heel, then the sole rolling down; on a hollow porch or a stair the boards answer
function boot(sr, kind) {
  const d = arr(sr, 0.7), toe = rnd(0.08, 0.12);
  for (const [at, g] of [[0, 1], [toe, 0.5]]) {
    thump(d, sr, rnd(55, 70), 0.03, g, at);
    if (kind === 'concrete') { burst(d, sr, at, 0.05, 2500, 0.7, 0.35 * g); burst(d, sr, at + 0.02, 0.08, 900, 0.8, 0.15 * g, { attack: 0.02 }); }
    else strike(sr, 0, kind === 'floor' ? [rnd(105, 130), rnd(240, 290), rnd(520, 600)] : [rnd(80, 100), rnd(180, 220), rnd(400, 460)], kind === 'floor' ? [0.08, 0.05, 0.03] : [0.15, 0.1, 0.06], [1, 0.7, 0.4], { click: 0.25, at, into: d, gain: 0.8 * g });
  }
  if (kind !== 'concrete' && Math.random() < (kind === 'stair' ? 0.6 : 0.3)) add(d, stickSlip(sr, rnd(0.2, 0.35), { rate: (u) => rnd(90, 160), body: [[rnd(400, 700), 5, 1], [rnd(1200, 1700), 4, 0.4]] }), (toe + 0.02) * sr, 0.25);
  normalize(d, 0.85); return d;
}
function keys(sr) {   // the key ring jingling
  const d = arr(sr, 0.9);
  for (let k = 0; k < 16; k++) strike(sr, 0, [rnd(3000, 4500), rnd(5200, 7000), rnd(7800, 9000)], [0.04, 0.025, 0.015], [1, 0.7, 0.4], { click: 0.3, at: Math.pow(Math.random(), 1.3) * 0.75, into: d, gain: rnd(0.2, 1) });
  normalize(d, 0.75); return d;
}
function lock(sr) {   // the key going in past the pins, turning, the deadbolt going over
  const d = arr(sr, 1.0);
  burst(d, sr, 0, 0.18, 4500, 2, 0.15, { attack: 0.03 });
  for (let k = 0; k < 6; k++) strike(sr, 0, [rnd(5000, 7000)], [0.003], [0.5], { click: 0.3, at: 0.02 + k * 0.027, into: d, gain: rnd(0.3, 0.6) });
  burst(d, sr, 0.42, 0.15, 1800, 2, 0.15, { attack: 0.04 });
  strike(sr, 0, [rnd(380, 450), rnd(900, 1050), rnd(2100, 2400)], [0.04, 0.03, 0.015], [1, 0.6, 0.3], { click: 0.6, at: 0.6, into: d }); thump(d, sr, 90, 0.03, 0.4, 0.6);
  normalize(d, 0.8); return d;
}
function doorOpen(sr) {   // the latch, then the hinge's squeak as the door swings in
  const d = arr(sr, 1.7);
  strike(sr, 0, [rnd(2400, 2700), rnd(3800, 4300)], [0.008, 0.005], [1, 0.5], { click: 0.5, into: d });
  add(d, stickSlip(sr, rnd(0.8, 1.1), { rate: (u) => 300 + 320 * Math.sin(Math.PI * u) + 80 * Math.sin(u * 17), body: [[rnd(1700, 2000), 8, 1], [rnd(3300, 3700), 6, 0.5], [rnd(600, 800), 4, 0.3]], amp: (u) => Math.sin(Math.PI * u) ** 1.5 }), 0.15 * sr, 0.5);
  const air = new Float32Array(Math.round(sr)); for (let i = 0; i < air.length; i++) air[i] = nz() * Math.sin(Math.PI * i / air.length); lp(air, sr, 300); add(d, air, 0.2 * sr, 0.4);
  normalize(d, 0.8); return d;
}
function doorShut(sr) {
  const d = arr(sr, 1.0);
  strike(sr, 0, [rnd(75, 95), rnd(160, 190), rnd(320, 380), rnd(650, 750)], [0.12, 0.09, 0.06, 0.03], [1, 0.8, 0.5, 0.3], { click: 0.6, into: d });
  strike(sr, 0, [rnd(2700, 3000), rnd(4300, 4700)], [0.006, 0.004], [0.5, 0.3], { click: 0.3, at: 0.012, into: d });
  const r = new Float32Array(Math.round(0.2 * sr)); for (let i = 0; i < r.length; i++) r[i] = nz() * (0.5 + 0.5 * Math.sin(TAU * 40 * i / sr)) * Math.exp(-i / (0.05 * sr)); add(d, bp(r, sr, 1500, 1.5), 0.01 * sr, 0.3);
  thump(d, sr, 35, 0.08, 0.6);
  normalize(d, 0.85); return d;
}
function lampSwitch(sr) {   // the rotary switch in the lamp's socket: two clicks and its spring
  const d = arr(sr, 0.2);
  strike(sr, 0, [rnd(3200, 3600), rnd(5200, 5800), rnd(7400, 8200)], [0.01, 0.006, 0.004], [1, 0.6, 0.3], { click: 0.8, clickDec: 0.0004, into: d });
  strike(sr, 0, [rnd(2900, 3200), rnd(4800, 5200)], [0.008, 0.005], [0.6, 0.3], { click: 0.5, clickDec: 0.0004, at: 0.006, into: d });
  strike(sr, 0, [4100], [0.03], [0.1], { click: 0, at: 0.006, into: d });
  normalize(d, 0.8); return d;
}
function wicker(sr, big) {   // the willow creaking: many small cracks where the strands rub, the hollow body under them
  const sec = big ? 1.3 : rnd(0.35, 0.5), d = arr(sr, sec), cnt = big ? 220 : Math.floor(rnd(60, 120)), centres = big ? [0.15, 0.5, 0.8] : [rnd(0.05, 0.15), rnd(0.2, 0.35)];
  for (let k = 0; k < cnt; k++) { const c = centres[k % centres.length] * sec, t = Math.max(0, c + nz() * 0.06 * sec), L = Math.round(rnd(0.001, 0.003) * sr), f = rnd(1200, 4500), a = rnd(0.2, 1), s0 = Math.round(t * sr);
    for (let i = 0; i < L && s0 + i < d.length; i++) d[s0 + i] += a * Math.sin(TAU * f * i / sr) * (1 - i / L) * (0.6 + 0.4 * nz()); }
  thump(d, sr, 140, 0.02, 0.6, centres[0] * sec); add(d, bp(d.slice(), sr, 350, 1.5), 0, 0.8);
  if (big) { add(d, stickSlip(sr, 0.8, { rate: (u) => 60 + 50 * u, body: [[900, 4, 1], [2100, 4, 0.4]] }), 0.1 * sr, 0.35); strike(sr, 0, [rnd(190, 220), rnd(500, 560)], [0.06, 0.03], [1, 0.5], { click: 0.4, at: 1.0, into: d, gain: 0.6 }); }
  normalize(d, 0.8); return d;
}
function flapSwing(sr) {   // the cat flap swinging back and forth against its frame, settling, the magnet catching it
  const d = arr(sr, 1.3);
  [[0, 1], [0.3, 0.7], [0.52, 0.5], [0.68, 0.35], [0.8, 0.22], [0.88, 0.12]].forEach(([t, g]) => strike(sr, 0, [rnd(800, 950), rnd(1650, 1850), rnd(2800, 3200)], [0.015, 0.01, 0.006], [1, 0.6, 0.4], { click: 0.5, at: t, into: d, gain: g }));
  strike(sr, 0, [3500], [0.004], [0.5], { click: 0.4, at: 0.95, into: d, gain: 0.3 });
  const sw = new Float32Array(Math.round(0.9 * sr)); for (let i = 0; i < sw.length; i++) sw[i] = nz() * (1 - i / sw.length) * (0.5 + 0.5 * Math.sin(TAU * 1.8 * i / sr)); lp(sw, sr, 1200); add(d, sw, 0, 0.06);
  normalize(d, 0.8); return d;
}
function latch(sr) { const d = arr(sr, 0.35); burst(d, sr, 0, 0.12, 2600, 3, 0.25, { attack: 0.04, curve: 0.3 }); strike(sr, 0, [2200, 3600, 5400], [0.008, 0.005, 0.003], [1, 0.6, 0.3], { click: 0.7, at: 0.14, into: d }); normalize(d, 0.8); return d; }

// ---------------------------------------------------------------- the car
function road(sr) {   // in the cabin: tyre roar, the body booming at its low resonances, small bumps through the seat
  const sec = 6, n = sr * sec, ch = () => {
    const p = pink(n); lp(p, sr, 900); lp(p, sr, 900); const a = bp(p, sr, 95, 3), b = bp(p, sr, 170, 3), t2 = bp(white(n), sr, 2500, 0.7), d = new Float32Array(n);
    for (let i = 0; i < n; i++) d[i] = p[i] + a[i] * 0.6 + b[i] * 0.3 + t2[i] * 0.05;
    for (let k = 0; k < 6; k++) thump(d, sr, rnd(45, 70), 0.05, 0.25, rnd(0, sec - 0.3));
    normalize(d, 0.8); return seam(d, sr, 0.3);
  };
  return [ch(), ch()];
}
function joint(sr) {   // an expansion joint: the front wheels, then the back, the suspension knocking, a rattle
  const d = arr(sr, 0.7), gap = rnd(0.15, 0.2);
  for (const at of [0, gap]) { thump(d, sr, 60, 0.05, 1, at); strike(sr, 0, [110, 240, rnd(320, 360), rnd(680, 740)], [0.06, 0.04, 0.02, 0.012], [0.6, 0.4, 0.3, 0.15], { click: 0.15, at, into: d }); burst(d, sr, at, 0.08, 1200, 1.5, 0.08); }
  normalize(d, 0.85); return d;
}
function grate(sr) {   // the tyres singing on a bridge's steel deck
  const sec = 4, n = sr * sec, w = white(n), a = bp(w, sr, 380, 10), b = bp(w, sr, 760, 10), c = bp(w, sr, 1140, 10), lo = w.slice(); lp(lo, sr, 600); lp(lo, sr, 600);
  const d = new Float32Array(n); for (let i = 0; i < n; i++) d[i] = a[i] + b[i] * 0.4 + c[i] * 0.2 + lo[i] * 0.4;
  normalize(d, 0.7); return seam(d, sr, 0.2);
}
function airBrake(sr) { const d = arr(sr, 0.9); burst(d, sr, 0, 0.75, 5000, 0.8, 1, { attack: 0.005, curve: 1.6 }); const h = d.slice(); hp(h, sr, 2500); normalize(h, 0.7); return h; }
function handbrake(sr) {
  const d = arr(sr, 0.7); let t = 0;
  for (let k = 0; k < 6; k++) { strike(sr, 0, [rnd(2400, 2700), rnd(3800, 4200)], [0.006, 0.004], [1, 0.5], { click: 0.4, at: t, into: d, gain: 0.6 }); t += 0.05 + k * 0.012; }
  strike(sr, 0, [rnd(300, 360), rnd(800, 900)], [0.04, 0.02], [1, 0.5], { click: 0.3, at: t + 0.02, into: d, gain: 0.6 });
  normalize(d, 0.75); return d;
}
function carDoor(sr) {   // the slab of the door, its latch, the glass in it, the cabin's air pressed by it
  const d = arr(sr, 1.0);
  strike(sr, 0, [rnd(52, 60), rnd(115, 130), rnd(250, 280), rnd(500, 560)], [0.15, 0.1, 0.06, 0.03], [1, 0.8, 0.5, 0.3], { click: 0.5, into: d });
  strike(sr, 0, [rnd(2400, 2700), rnd(3900, 4300)], [0.008, 0.005], [0.5, 0.3], { click: 0.3, at: 0.008, into: d });
  strike(sr, 0, [rnd(1700, 1900), rnd(2600, 2800)], [0.02, 0.012], [0.2, 0.1], { click: 0, at: 0.012, into: d });
  thump(d, sr, 30, 0.06, 0.8);
  normalize(d, 0.9); return d;
}
function engineOff(sr) {
  const d = arr(sr, 1.2); let ph = 0;
  for (let i = 0; i < 0.9 * sr; i++) { const u = i / (0.9 * sr); ph += TAU * (30 - 18 * u) / sr; d[i] += Math.sin(ph) * (1 - u) ** 1.5 * (0.7 + 0.3 * Math.sin(ph * 0.5)); }
  const r = new Float32Array(Math.round(0.5 * sr)); for (let i = 0; i < r.length; i++) r[i] = nz() * (0.5 + 0.5 * Math.sin(TAU * 25 * i / sr)) * Math.exp(-i / (0.12 * sr)); add(d, bp(r, sr, 400, 1.2), 0.02 * sr, 0.4);
  normalize(d, 0.8); return d;
}

// the jobs, in the order they are needed: the car first (it plays while the rest renders), then the arrival in the
// dark, then the house, the cat and the night outside
export function houseBankJobs(C) {
  // [name, render] for one buffer, [name, render(i), count] for variants (each its own slice)
  const R = C.sampleRate, M = 24000, L = 22050;   // (22.05 kHz: the lowest rate every browser takes)
  const m = (r, f) => () => mono(C, f(r), r), v = (r, f) => (i) => mono(C, f(r, i), r);
  const stP = (r, f) => () => { const [a, b] = f(r); return stereo(C, a, b, r); };
  return [
    ['road', stP(M, road)], ['joint', v(M, joint), 3], ['grate', m(M, grate)], ['carDoor', v(M, carDoor), 2], ['horn', v(M, horn), 2],
    ['siren', m(M, siren)], ['airBrake', m(R, airBrake)], ['handbrake', m(R, handbrake)], ['engineOff', m(M, engineOff)], ['wicker', v(R, (r) => wicker(r, false)), 3],
    ['bootConcrete', v(R, (r) => boot(r, 'concrete')), 3], ['bootPorch', v(M, (r) => boot(r, 'porch')), 3], ['bootFloor', v(M, (r) => boot(r, 'floor')), 3], ['bootStair', v(M, (r) => boot(r, 'stair')), 4],
    ['keys', m(R, keys)], ['lock', m(R, lock)], ['doorOpen', v(R, doorOpen), 2], ['doorShut', m(M, doorShut)], ['lamp', m(R, lampSwitch)],
    ['fridge', m(M, fridgeHum)], ['tickMantel', m(R, tickMantel)], ['tickQuartz', m(R, tickQuartz)], ['tickAlarm', m(R, tickAlarm)],
    ['radHiss', m(R, radHiss)], ['city', stP(L, cityBed)], ['purr', m(L, (r) => purr(r, 7.5))],
    ['snore', v(M, snore), 3], ['mumble', v(M, mumble), 3], ['rustle', v(R, rustle), 2], ['bedCreak', v(M, bedCreak), 2],
    ['hiss', v(R, hiss), 2], ['growl', v(M, growl), 2], ['yowl', m(M, yowl)], ['meow', v(M, meow), 3], ['trill', v(M, trill), 2],
    ['pad', v(R, (r, i) => pad(r, i % 2 === 1)), 6], ['scrabble', v(R, scrabble), 2], ['catLand', v(R, catLand), 2],
    ['wickerBig', m(R, (r) => wicker(r, true))], ['flapSwing', m(R, flapSwing)], ['latch', m(R, latch)],
    ['fridgeOn', m(R, fridgeOn)], ['fridgeOff', m(M, fridgeOff)], ['fridgeGurgle', m(M, fridgeGurgle)], ['ice', m(R, ice)], ['chime', m(R, chime)],
    ['radKnock', v(R, radKnock), 3], ['radTick', v(R, radTick), 2], ['creak', v(M, creak), 5], ['settle', v(M, settle), 2],
    ['car', v(L, carPass), 3], ['train', m(M, train)], ['plane', m(L, plane)], ['dog', v(M, dog), 2],
    ['breeze', stP(L, breeze)], ['crickets', () => makeCrickets(C)],
  ];
}
