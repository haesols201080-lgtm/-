// Deterministic random + noise helpers used by every procedural generator.

export function hash32(a) {
  a |= 0; a = (a + 0x7ed55d16 + (a << 12)) | 0; a = (a ^ 0xc761c23c ^ (a >>> 19)) | 0;
  a = (a + 0x165667b1 + (a << 5)) | 0; a = ((a + 0xd3a2646c) ^ (a << 9)) | 0;
  a = (a + 0xfd7046c5 + (a << 3)) | 0; a = (a ^ 0xb55a4f09 ^ (a >>> 16)) | 0;
  return a >>> 0;
}
export function hash2(x, y, seed = 0) {
  return hash32((x | 0) * 374761393 + (y | 0) * 668265263 + seed * 2147483647) / 4294967296;
}
export function strSeed(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export class RNG {
  constructor(seed = 1) { this.s = (typeof seed === 'string' ? strSeed(seed) : seed) >>> 0 || 1; }
  next() { // mulberry32
    let t = (this.s += 0x6d2b79f5) | 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  f(a = 1, b) { if (b === undefined) { b = a; a = 0; } return a + (b - a) * this.next(); }
  i(a, b) { if (b === undefined) { b = a; a = 0; } return Math.floor(a + (b - a + 1) * this.next()); } // inclusive
  chance(p) { return this.next() < p; }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  sign() { return this.next() < 0.5 ? -1 : 1; }
  gauss() { return (this.next() + this.next() + this.next() + this.next() - 2) / 2; }
  fork(tag = 0) { return new RNG(hash32(this.s ^ hash32((typeof tag === 'string' ? strSeed(tag) : tag) + 0x9e3779b9))); }
  weighted(items) { // [[weight, value], ...]
    let sum = 0; for (const it of items) sum += it[0];
    let r = this.next() * sum;
    for (const it of items) { r -= it[0]; if (r <= 0) return it[1]; }
    return items[items.length - 1][1];
  }
  shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(this.next() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
}

const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
export function vnoise2(x, y, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = fade(xf), v = fade(yf);
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed), c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm2(x, y, oct = 4, seed = 0, lac = 2.03, gain = 0.5) {
  let s = 0, a = 0.5, n = 0;
  for (let i = 0; i < oct; i++) { s += a * vnoise2(x, y, seed + i * 17); n += a; x *= lac; y *= lac; a *= gain; }
  return s / n;
}
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const TAU = Math.PI * 2;
