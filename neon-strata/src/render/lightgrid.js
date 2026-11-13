// Local light grid: every lamp, sign and tube in the city as a real point light. Lights are binned into a
// world-space XZ grid (one RGBA16UI texel per light, N slots per cell) that the surface shaders walk per pixel,
// so neon actually lights the wall behind it, the pavement under it and throws specular streaks on wet asphalt.
// When a cell overflows, the weakest light has its range shrunk until it no longer reaches that cell – the
// window function then fades to zero before the border, so there are never seams between cells.
import * as THREE from 'three';
import { U } from './env.js';

export const LG = { EXT: 3840, CELL: 16, N: 8, PAD: 24 };

export function emptyLightGrid() {
  const t = new THREE.DataTexture(new Uint16Array(4), 1, 1, THREE.RGBAIntegerFormat, THREE.UnsignedShortType);
  t.internalFormat = 'RGBA16UI'; t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true;
  return t;
}

// lights: flat array, stride 8 = x, y, z, radius, r, g, b (linear * intensity), flags (1 = indoor)
export function buildLightGrid(lights, maxPerCell = LG.N) {
  const { EXT, CELL, N, PAD } = LG; const G = (EXT * 2) / CELL;
  const capIn = 2, capOut = Math.max(2, Math.min(N, maxPerCell) - capIn);
  // 1. merge emitters that sit within a few metres of each other (a shopfront's sign + awning lamps act as one source)
  const buckets = new Map(); let raw = 0;
  for (let o = 0; o < lights.length; o += 8) {
    const rad = lights[o + 3]; const r = lights[o + 4], g = lights[o + 5], b = lights[o + 6];
    const m = Math.max(r, g, b); if (!(m > 1e-4) || rad > 90 || rad < 1) continue;
    const x = lights[o], y = lights[o + 1], z = lights[o + 2]; const indoor = lights[o + 7] & 1;
    if (Math.abs(x) > EXT - PAD - 1 || Math.abs(z) > EXT - PAD - 1) continue;
    raw++;
    const key = ((Math.floor(x / 4.5) + 2000) * 6000 + (Math.floor(z / 4.5) + 2000)) * 2048 + Math.min(1023, Math.max(0, Math.floor(y / 4))) * 2 + indoor;
    let c = buckets.get(key); if (!c) { c = { x: 0, y: 0, z: 0, w: 0, r: 0, g: 0, b: 0, rad: 0, indoor }; buckets.set(key, c); }
    c.x += x * m; c.y += y * m; c.z += z * m; c.w += m; c.r += r; c.g += g; c.b += b; c.rad = Math.max(c.rad, rad);
  }
  const L = [];
  for (const c of buckets.values()) {
    const m = Math.max(c.r, c.g, c.b); const range = Math.floor(Math.min(PAD, Math.max(5, c.rad * 0.9)) * 2) / 2;
    L.push({ x: Math.round((c.x / c.w) * 4) / 4, y: c.y / c.w, z: Math.round((c.z / c.w) * 4) / 4, range, r: c.r / m, g: c.g / m, b: c.b / m, power: m * (0.45 * range) ** 2, indoor: c.indoor, cells: null, dead: false });
  }
  const d2box = (l, k) => { const x0 = (k % G) * CELL - EXT, z0 = ((k / G) | 0) * CELL - EXT; const dx = Math.max(x0 - l.x, 0, l.x - x0 - CELL), dz = Math.max(z0 - l.z, 0, l.z - z0 - CELL); return dx * dx + dz * dz; };
  let shrunk = 0, dropped = 0;
  // 2. bin each set, shrinking the weakest contributor's reach whenever a cell overflows (never a seam)
  const fit = (indoor, cap) => {
    const lists = new Array(G * G);
    L.forEach((l, li) => {
      if (l.indoor !== indoor) return;
      l.cells = []; const r = l.range;
      const cx0 = Math.max(0, Math.floor((l.x - r + EXT) / CELL)), cx1 = Math.min(G - 1, Math.floor((l.x + r + EXT) / CELL));
      const cz0 = Math.max(0, Math.floor((l.z - r + EXT) / CELL)), cz1 = Math.min(G - 1, Math.floor((l.z + r + EXT) / CELL));
      for (let cz = cz0; cz <= cz1; cz++) for (let cx = cx0; cx <= cx1; cx++) { const k = cz * G + cx; if (d2box(l, k) < r * r) { (lists[k] || (lists[k] = [])).push(li); l.cells.push(k); } }
    });
    for (let k = 0; k < G * G; k++) {
      const arr = lists[k]; if (!arr) continue;
      while (arr.length > cap) {
        let wi = -1, ws = Infinity;
        for (const li of arr) { const l = L[li]; const d2 = d2box(l, k); const w = 1 - d2 / (l.range * l.range); const s = (l.power * w * w) / (d2 + 16) * (l.y > 45 ? 0.3 : l.y > 14 ? 0.6 : 1); if (s < ws) { ws = s; wi = li; } }
        const l = L[wi]; const nr = Math.floor(Math.sqrt(d2box(l, k)) * 2 - 0.02) / 2;
        if (nr < 3.5) { for (const kk of l.cells) { const a = lists[kk]; a.splice(a.indexOf(wi), 1); } l.cells = []; l.dead = true; dropped++; }
        else { l.range = nr; shrunk++; l.cells = l.cells.filter((kk) => { if (d2box(l, kk) < nr * nr) return true; const a = lists[kk]; a.splice(a.indexOf(wi), 1); return false; }); }
      }
    }
    return lists;
  };
  const LO = fit(0, capOut), LI = fit(1, capIn);
  const W = G * N; const data = new Uint16Array(W * G * 4); let used = 0, maxN = 0;
  for (let k = 0; k < G * G; k++) {
    const arr = (LO[k] || []).concat(LI[k] || []); if (!arr.length) continue;
    const cx = k % G, cz = (k / G) | 0; const x0 = cx * CELL - EXT, z0 = cz * CELL - EXT;
    maxN = Math.max(maxN, arr.length);
    arr.forEach((li, i) => {
      const l = L[li]; const o = (cz * W + cx * N + i) * 4;
      const dxq = Math.round((l.x - x0 + PAD) * 4), dzq = Math.round((l.z - z0 + PAD) * 4);
      data[o] = (Math.min(255, Math.max(0, dxq)) << 8) | Math.min(255, Math.max(0, dzq));
      data[o + 1] = Math.min(65535, Math.max(0, Math.round((l.y + 16) * 16)));
      const iq = Math.min(511, Math.max(1, Math.round((Math.log2(l.power) + 4) * 32)));
      data[o + 2] = (Math.round(l.range * 2) << 10) | (l.indoor << 9) | iq;
      data[o + 3] = (Math.round(l.r * 31) << 11) | (Math.round(l.g * 63) << 5) | Math.round(l.b * 31);
      used++;
    });
  }
  const tex = new THREE.DataTexture(data, W, G, THREE.RGBAIntegerFormat, THREE.UnsignedShortType);
  tex.internalFormat = 'RGBA16UI'; tex.minFilter = tex.magFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.unpackAlignment = 1; tex.needsUpdate = true;
  const old = U.uLGrid.value; U.uLGrid.value = tex; if (old) old.dispose();
  return { texture: tex, raw, lights: L.length, alive: L.filter((l) => !l.dead).length, shrunk, dropped, slots: used, maxPerCell: maxN };
}

// GLSL: walk the grid cell under a world position. E is in the engine's "irradiance" units (radiance = E * albedo).
export const NS_LOCAL_LIGHTS = /* glsl */ `
#ifdef NS_LOCAL_LIGHTS
uniform highp usampler2D uLGrid;
void nsLocalLights(vec3 wp, vec3 N, vec3 V, float rough, vec3 F0, float indoor, inout vec3 dOut, inout vec3 sOut){
  vec2 g = (wp.xz + ${LG.EXT.toFixed(1)}) / ${LG.CELL.toFixed(1)};
  if (g.x < 0.0 || g.y < 0.0 || g.x >= ${((LG.EXT * 2) / LG.CELL).toFixed(1)} || g.y >= ${((LG.EXT * 2) / LG.CELL).toFixed(1)}) return;
  ivec2 c = ivec2(g);
  vec2 org = vec2(c) * ${LG.CELL.toFixed(1)} - ${(LG.EXT + LG.PAD).toFixed(1)};
  float a = max(rough * rough, 0.004);
  float NoV = max(dot(N, V), 0.02);
  for (int i = 0; i < ${LG.N}; i++) {
    uvec4 t = texelFetch(uLGrid, ivec2(c.x * ${LG.N} + i, c.y), 0);
    uint rq = t.b >> 10;
    if (rq == 0u) break;
    if (abs(float((t.b >> 9) & 1u) - indoor) > 0.5) continue;
    vec3 lp = vec3(org.x + float(t.r >> 8) * 0.25, float(t.g) * 0.0625 - 16.0, org.y + float(t.r & 255u) * 0.25);
    vec3 Lv = lp - wp; float d2 = dot(Lv, Lv); float range = float(rq) * 0.5;
    float w = 1.0 - d2 / (range * range);
    if (w <= 0.0) continue;
    float d = sqrt(d2); vec3 Ld = Lv / max(d, 1e-3);
    vec3 col = vec3(float(t.a >> 11) / 31.0, float((t.a >> 5) & 63u) / 63.0, float(t.a & 31u) / 31.0);
    vec3 E = col * (exp2(float(t.b & 511u) / 32.0 - 4.0) * w * w / (d2 + 2.6));
    float NoL = dot(N, Ld);
    dOut += E * max(NoL * 0.82 + 0.18, 0.0); // wrapped: tubes and light boxes are area sources
    float nl = max(NoL, 0.0);
    if (nl > 0.0) {
      float aa = max(a, 0.22 / (d + 0.22)); // widen the lobe by the emitter's angular size
      vec3 H = normalize(Ld + V); float NoH = max(dot(N, H), 0.0); float VoH = max(dot(V, H), 0.0);
      float a2 = aa * aa; float dd = NoH * NoH * (a2 - 1.0) + 1.0;
      float k = aa * 0.5; float vis = 0.25 / ((nl * (1.0 - k) + k) * (NoV * (1.0 - k) + k));
      float fr = pow(1.0 - VoH, 5.0);
      sOut += E * nl * min(a2 / (dd * dd) * vis, 90.0) * (F0 + (1.0 - F0) * fr) * (a / aa);
    }
  }
}
#endif
`;
