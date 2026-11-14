// Procedural, seamless textures generated at load time. Each surface texture
// packs (normal.x, normal.y, height, cavity) so a terrain sample gives both
// shading detail and albedo variation from a single fetch.
import * as THREE from 'three';
import { Simplex, mulberry32, tileNoise, clamp } from '../core/noise.js';

function worleyTile(size, cells, seed) {
  const rnd = mulberry32(seed);
  const fx = new Float32Array(cells * cells);
  const fy = new Float32Array(cells * cells);
  for (let i = 0; i < cells * cells; i++) { fx[i] = rnd(); fy[i] = rnd(); }
  const f1 = new Float32Array(size * size);
  const f2 = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * cells, v = (y / size) * cells;
      const cx = Math.floor(u), cy = Math.floor(v);
      let d1 = 9, d2 = 9;
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const gx = cx + ox, gy = cy + oy;
          const wx = ((gx % cells) + cells) % cells, wy = ((gy % cells) + cells) % cells;
          const px = gx + fx[wy * cells + wx], py = gy + fy[wy * cells + wx];
          const dx = px - u, dy = py - v;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
        }
      }
      f1[y * size + x] = d1;
      f2[y * size + x] = d2;
    }
  }
  return { f1, f2 };
}

function heightToPacked(size, h, strength, cavity) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const xl = (x - 1 + size) % size, xr = (x + 1) % size;
      const yu = (y - 1 + size) % size, yd = (y + 1) % size;
      const dx = (h[y * size + xr] - h[y * size + xl]) * strength;
      const dy = (h[yd * size + x] - h[yu * size + x]) * strength;
      let nx = -dx, ny = -dy, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l; ny /= l;
      const i = (y * size + x) * 4;
      data[i] = clamp(Math.round((nx * 0.5 + 0.5) * 255), 0, 255);
      data[i + 1] = clamp(Math.round((ny * 0.5 + 0.5) * 255), 0, 255);
      data[i + 2] = clamp(Math.round(h[y * size + x] * 255), 0, 255);
      data[i + 3] = clamp(Math.round((cavity ? cavity[y * size + x] : 1) * 255), 0, 255);
    }
  }
  return data;
}

function toTexture(data, size, srgb = false) {
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 8;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function normalize01(a) {
  let mn = Infinity, mx = -Infinity;
  for (let i = 0; i < a.length; i++) { if (a[i] < mn) mn = a[i]; if (a[i] > mx) mx = a[i]; }
  const r = mx - mn || 1;
  for (let i = 0; i < a.length; i++) a[i] = (a[i] - mn) / r;
  return a;
}

export function generateTextures(seed = 7) {
  const S = new Simplex(seed);
  const out = {};

  // --- generic noise texture (RGBA = fbm low, fbm mid, worley, fbm high) ---
  {
    const N = 256;
    const w = worleyTile(N, 8, seed + 11);
    const d = new Uint8Array(N * N * 4);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const u = x / N, v = y / N, i = (y * N + x) * 4;
      d[i] = clamp((tileNoise(S, u, v, 3, 4) * 0.5 + 0.5) * 255, 0, 255);
      d[i + 1] = clamp((tileNoise(S, u + 0.37, v + 0.11, 9, 4) * 0.5 + 0.5) * 255, 0, 255);
      d[i + 2] = clamp((1 - w.f1[y * N + x] * 1.4) * 255, 0, 255);
      d[i + 3] = clamp((tileNoise(S, u + 0.71, v + 0.53, 24, 3) * 0.5 + 0.5) * 255, 0, 255);
    }
    out.noise = toTexture(d, N);
  }

  const N = 512;
  // --- rock: natural fractured stone. Thin branching cracks along the zero
  // lines of warped noise (not a polygon cell network), a faint joint set,
  // fine grain and weak bedding, so it reads as weathered rock up close.
  {
    const h = new Float32Array(N * N);
    const cav = new Float32Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const u = x / N, v = y / N, k = y * N + x;
      const wx = 0.06 * tileNoise(S, u + 3.3, v, 3, 3), wy = 0.06 * tileNoise(S, u, v + 7.1, 3, 3);
      const base = tileNoise(S, u, v, 4, 5) * 0.5 + 0.5;
      const c1 = Math.pow(1 - Math.abs(tileNoise(S, u + wx, v + wy, 5, 3)), 16);
      const c2 = Math.pow(1 - Math.abs(tileNoise(S, u * 1 + wy * 2 + 0.5, v + wx * 2, 13, 2)), 22);
      const joint = Math.pow(Math.abs(Math.sin((u * 7 + v * 3 + tileNoise(S, u, v + 1.7, 2, 2) * 0.8) * Math.PI)), 40);
      const grain = tileNoise(S, u + 0.21, v + 0.67, 48, 2) * 0.5 + 0.5;
      const strata = Math.sin((v * 14 + tileNoise(S, u, v + 3.1, 3, 3) * 1.4) * Math.PI) * 0.5 + 0.5;
      h[k] = base * 0.55 + grain * 0.18 + strata * 0.08 - c1 * 0.22 - c2 * 0.1 - joint * 0.06;
      cav[k] = 1 - c1 * 0.55 - c2 * 0.3 - joint * 0.15;
    }
    normalize01(h);
    out.rock = toTexture(heightToPacked(N, h, 7.0, cav), N);
  }

  // --- regolith: pebbly dusty soil ---
  {
    const w = worleyTile(N, 22, seed + 31);
    const w2 = worleyTile(N, 64, seed + 32);
    const h = new Float32Array(N * N);
    const cav = new Float32Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const u = x / N, v = y / N, k = y * N + x;
      const pebble = Math.max(0, 1 - w.f1[k] * 2.2);
      const grit = Math.max(0, 1 - w2.f1[k] * 2.0);
      const dust = tileNoise(S, u + 5.3, v + 1.7, 6, 4) * 0.5 + 0.5;
      const mask = tileNoise(S, u + 9.1, v + 2.2, 3, 2) > -0.1 ? 1 : 0.35;
      h[k] = dust * 0.45 + pebble * pebble * 0.45 * mask + grit * 0.18;
      cav[k] = 0.7 + 0.3 * Math.min(1, pebble * 2 + 0.3);
    }
    normalize01(h);
    out.soil = toTexture(heightToPacked(N, h, 5.0, cav), N);
  }

  // --- sand: wind ripples ---
  {
    const h = new Float32Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const u = x / N, v = y / N, k = y * N + x;
      const warp = tileNoise(S, u + 2.2, v + 7.7, 3, 3) * 0.9;
      const r = Math.sin((u * 2 + v * 14 + warp) * Math.PI * 2);
      const ripple = Math.pow(r * 0.5 + 0.5, 1.6);
      const grain = tileNoise(S, u + 4.4, v + 1.1, 48, 2) * 0.5 + 0.5;
      h[k] = ripple * 0.75 + grain * 0.25;
    }
    normalize01(h);
    out.sand = toTexture(heightToPacked(N, h, 3.0, null), N);
  }

  // --- living ground: moss / grass litter ---
  {
    const w = worleyTile(N, 40, seed + 41);
    const h = new Float32Array(N * N);
    const cav = new Float32Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const u = x / N, v = y / N, k = y * N + x;
      const clump = Math.max(0, 1 - w.f1[k] * 2.4);
      const blades = tileNoise(S, u * 1 + 3.3, v * 1 + 9.9, 64, 2) * 0.5 + 0.5;
      const big = tileNoise(S, u + 1.9, v + 6.4, 5, 3) * 0.5 + 0.5;
      h[k] = clump * 0.45 + blades * 0.35 + big * 0.2;
      cav[k] = 0.6 + 0.4 * clump;
    }
    normalize01(h);
    out.moss = toTexture(heightToPacked(N, h, 6.0, cav), N);
  }

  // --- water ripples normal map (two-channel normal) ---
  {
    const M = 256;
    const h = new Float32Array(M * M);
    for (let y = 0; y < M; y++) for (let x = 0; x < M; x++) {
      const u = x / M, v = y / M;
      h[y * M + x] = tileNoise(S, u + 3.7, v + 0.4, 6, 5);
    }
    normalize01(h);
    out.water = toTexture(heightToPacked(M, h, 4.5, null), M);
  }

  // --- metal panel detail for buildings: subtle brushed / speckle ---
  {
    const M = 256;
    const h = new Float32Array(M * M);
    for (let y = 0; y < M; y++) for (let x = 0; x < M; x++) {
      const u = x / M, v = y / M;
      h[y * M + x] = tileNoise(S, u + 8.8, v * 0.15 + 1.3, 32, 3) * 0.4 + tileNoise(S, u + 1.1, v + 2.2, 6, 4) * 0.6;
    }
    normalize01(h);
    out.panel = toTexture(heightToPacked(M, h, 1.2, null), M);
  }

  return out;
}

// Soft round sprite used for particles, stars and light glows.
export function makeGlowTexture(size = 64) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
