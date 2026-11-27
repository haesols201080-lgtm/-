// Renders chapter 2's sound bank off the main thread (the game keeps its frame rate while ~2 s of synthesis runs) and
// posts each sound back as soon as it is done: plain sample arrays, moved rather than copied; the page turns them
// into AudioBuffers. The steps and the piano come first, then the jobs in the order the chapter needs them.
import { makeBank } from './soundbank.js';
import { houseBankJobs } from './housebank.js';

// an AudioContext stand-in: just enough for the bank's code to write its buffers into
function fakeCtx(sampleRate) {
  return { sampleRate, createBuffer: (ch, n, r) => { const d = Array.from({ length: ch }, () => new Float32Array(n));
    return { __buf: 1, ch, n, r, d, length: n, duration: n / r, numberOfChannels: ch, sampleRate: r, getChannelData: (c) => d[c], copyToChannel: (a, c) => d[c].set(a.subarray(0, n)) }; } };
}
function pack(v, tr) {
  if (v && v.__buf) { for (const a of v.d) tr.push(a.buffer); return { __buf: 1, ch: v.ch, n: v.n, r: v.r, d: v.d }; }
  if (Array.isArray(v)) return v.map((x) => pack(x, tr));
  if (v && typeof v === 'object') { const o = {}; for (const k in v) o[k] = pack(v[k], tr); return o; }
  return v;
}
self.onmessage = (e) => {
  const C = fakeCtx(e.data.sampleRate);
  const send = (name, val, i) => { const tr = []; const p = pack(val, tr); self.postMessage({ name, i, val: p }, tr); };
  try { send('base', makeBank(C, { place: 'house' })); } catch (err) { self.postMessage({ error: String(err), name: 'base' }); }
  for (const [name, f, cnt] of houseBankJobs(C)) {
    try { if (cnt) for (let i = 0; i < cnt; i++) send(name, f(i), i); else send(name, f()); }
    catch (err) { self.postMessage({ error: String(err), name }); }
  }
  self.postMessage({ done: true });
};
