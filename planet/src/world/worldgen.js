// Planet generator: a pure, deterministic function of (x, z).
//
// The 16 km square map reads like one planet: latitude bands (polar ice caps
// north/south, cold crater lands and canyon country at mid latitudes, warm
// dune seas, volcanic provinces, salt flats and crystal plains near the
// equator), continental noise that carves future ocean basins, provinces laid
// out on a soft Voronoi grid so neighbouring terrain types blend into each
// other, and a handful of landmarks visible from far away (a giant shield
// volcano, the Great Rift canyon, an impact basin that becomes an inland sea).
import { Simplex, hash2, clamp, smoothstep, lerp } from '../core/noise.js';

export const PLANET = {
  HALF: 8192,
  SEED: 4207,
  CURV: 1 / (2 * 60000),          // visual curvature: drop = d^2 * CURV
};

// surface weights layout in out[1..7]
export const SURF = { sand: 0, basalt: 1, strata: 2, fert: 3, snow: 4, salt: 5, crystal: 6 };

export const PROVINCES = [
  { id: 'plains', name: '적철 평원' },
  { id: 'mesa', name: '층암 메사 지대' },
  { id: 'dunes', name: '모래 바다' },
  { id: 'volcanic', name: '현무암 화산대' },
  { id: 'craters', name: '크레이터 지대' },
  { id: 'crystal', name: '결정 평원' },
  { id: 'highlands', name: '침식 고원' },
  { id: 'salt', name: '소금 평원' },
  { id: 'glacier', name: '극지 빙원' },
];

export const LANDMARKS = {
  volcano: { x: 3600, z: 2300, r: 2300, h: 720, name: '아르케 순상화산' },
  volcano2: { x: -5200, z: -1200, r: 1100, h: 330, name: '쌍둥이 화산' },
  basin: { x: -3700, z: 2900, r: 1900, d: 200, name: '고요의 충돌 분지' },
  rift: { name: '대협곡', pts: [[-7600, -2600], [-5200, -2100], [-3000, -2500], [-1200, -1650], [600, -1450], [2600, -2050], [4600, -1800], [7600, -2300]] },
};

const CELL = 1500;         // province voronoi cell size
const CRATER_CELL = 520;

function terrace(h, step, sharp) {
  const t = h / step;
  const f = t - Math.floor(t);
  return (Math.floor(t) + smoothstep(0.5 - sharp, 0.5 + sharp, f)) * step;
}

function distSeg(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const t = clamp(((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz), 0, 1);
  const cx = ax + dx * t - px, cz = az + dz * t - pz;
  return Math.sqrt(cx * cx + cz * cz);
}

export class WorldGen {
  constructor(seed = PLANET.SEED) {
    this.seed = seed;
    this.S = new Simplex(seed);
    this.S2 = new Simplex(seed + 17);
    this.cellCache = new Map();
    this.craterCache = new Map();
    this._pw = new Float32Array(PROVINCES.length);
    this._d = new Float32Array(9);
    this._t = new Int32Array(9);
  }

  // province type of a voronoi cell, chosen by latitude of its seed point
  cell(ci, cj) {
    const k = (ci + 5000) * 10007 + (cj + 5000);
    let c = this.cellCache.get(k);
    if (c) return c;
    const px = (ci + 0.15 + 0.7 * hash2(ci, cj, this.seed)) * CELL;
    const pz = (cj + 0.15 + 0.7 * hash2(ci, cj, this.seed + 1)) * CELL;
    const lat = Math.abs(pz / PLANET.HALF);
    const r = hash2(ci, cj, this.seed + 2);
    let table;
    if (lat > 0.74) table = [['glacier', 6], ['craters', 1.5], ['highlands', 1]];
    else if (lat > 0.5) table = [['craters', 3], ['highlands', 2], ['mesa', 2], ['plains', 1.5], ['glacier', 0.6]];
    else if (lat > 0.24) table = [['mesa', 2.5], ['plains', 2.5], ['highlands', 1.5], ['craters', 1.5], ['dunes', 1], ['volcanic', 1]];
    else table = [['dunes', 2.5], ['plains', 2], ['volcanic', 2], ['crystal', 1.4], ['salt', 1.2], ['mesa', 1]];
    let tot = 0;
    for (const [, w] of table) tot += w;
    let acc = r * tot, type = table[0][0];
    for (const [t, w] of table) { acc -= w; if (acc <= 0) { type = t; break; } }
    // the landing region is forced to welcoming, varied ground
    if (Math.abs(ci) <= 0 && Math.abs(cj) <= 0) type = 'plains';
    if (ci === 1 && cj === 0) type = 'mesa';
    if (ci === -1 && cj === 0) type = 'craters';
    if (ci === 0 && cj === 1) type = 'dunes';
    if (ci === -1 && cj === -1) type = 'highlands';
    if (ci === 1 && cj === 1) type = 'crystal';
    if (ci === 0 && cj === -1) type = 'volcanic';
    c = { px, pz, type, ti: PROVINCES.findIndex((p) => p.id === type) };
    this.cellCache.set(k, c);
    return c;
  }

  craterCell(a, b) {
    const k = (a + 5000) * 10007 + (b + 5000);
    let c = this.craterCache.get(k);
    if (c !== undefined) return c;
    const pr = hash2(a, b, this.seed + 31);
    const cprov = this.cell(Math.floor(a * CRATER_CELL / CELL), Math.floor(b * CRATER_CELL / CELL)).type;
    const chance = cprov === 'craters' ? 0.85 : cprov === 'glacier' ? 0.35 : cprov === 'dunes' || cprov === 'salt' ? 0.08 : 0.18;
    if (pr > chance) { this.craterCache.set(k, null); return null; }
    const R = 30 + 230 * Math.pow(hash2(a, b, this.seed + 32), 2.6);
    c = {
      R, x: (a + 0.5) * CRATER_CELL + (hash2(a, b, this.seed + 33) - 0.5) * (CRATER_CELL - R),
      z: (b + 0.5) * CRATER_CELL + (hash2(a, b, this.seed + 34) - 0.5) * (CRATER_CELL - R),
      D: R * (0.22 + 0.08 * hash2(a, b, this.seed + 35)),
      ice: (cprov === 'glacier' && R > 50) || (cprov === 'craters' && R > 110 && hash2(a, b, this.seed + 36) < 0.6) || (Math.abs(b * CRATER_CELL) > 3500 && R > 80),
    };
    this.craterCache.set(k, c);
    return c;
  }

  // provinces influencing a point: fills this._pw (weights per province index, sum 1)
  provinces(x, z) {
    const S = this.S;
    const wx = x + 260 * S.fbm2(x / 1400 + 3.1, z / 1400 - 7.3, 2);
    const wz = z + 260 * S.fbm2(x / 1400 - 5.2, z / 1400 + 1.9, 2);
    const ci = Math.floor(wx / CELL), cj = Math.floor(wz / CELL);
    const D = this._d, T = this._t, pw = this._pw;
    pw.fill(0);
    let dmin = 1e9, n = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const c = this.cell(ci + i, cj + j);
      const dx = wx - c.px, dz = wz - c.pz;
      const d = Math.sqrt(dx * dx + dz * dz);
      D[n] = d; T[n] = c.ti; n++;
      if (d < dmin) dmin = d;
    }
    const BW = 520;
    let tot = 0;
    for (let k = 0; k < 9; k++) {
      const t = 1 - (D[k] - dmin) / BW;
      if (t <= 0) continue;
      const w = t * t * (3 - 2 * t);
      pw[T[k]] += w; tot += w;
    }
    for (let k = 0; k < pw.length; k++) pw[k] /= tot;
    return pw;
  }

  // Returns height; if out provided, fills out[0..6] with surface weights and out[7] = crater-floor flag.
  sample(x, z, out) {
    const S = this.S, S2 = this.S2;
    const H = PLANET.HALF;
    const lat = z / H;
    const alat = Math.abs(lat);

    // continents & oceans
    const cx = x + 500 * S2.noise2(x / 3000, z / 3000), cz = z + 500 * S2.noise2(x / 3000 + 9, z / 3000 - 4);
    let cont = S.fbm2(cx / 5200 + 11, cz / 5200 - 3, 3) + 0.28;
    cont += 0.55 * Math.exp(-(x * x + z * z) / (2600 * 2600));        // landing continent
    cont -= 0.35 * smoothstep(0.6, 0.0, alat) * smoothstep(0.3, -0.2, S2.fbm2(cx / 4000 - 2, cz / 4000, 2)); // equatorial seas
    const land = smoothstep(-0.32, 0.05, cont);
    let h = land >= 1 ? 18 + 60 * clamp(cont, 0, 1.2) : lerp(-95 + 30 * S.fbm2(x / 900, z / 900, 2), 18 + 60 * clamp(cont, 0, 1.2), land);
    h += 14 * S.fbm2(cx / 1100 + 1.7, cz / 1100, 4) + 4.5 * S.fbm2(x / 190, z / 190, 3) + 1.1 * S.fbm2(x / 41, z / 41, 2);

    // provinces
    const pw = this.provinces(x, z);
    let sand = 0, basalt = 0, strata = 0, fert = 0.45, snow = 0, salt = 0, crystal = 0;
    let dh = 0;
    for (let pi = 0; pi < pw.length; pi++) {
      const w = pw[pi];
      if (w <= 0.0005) continue;
      switch (pi) {
        case 0: {
          dh += w * (5 * S.fbm2(x / 320, z / 320, 3));
          fert += w * 0.15;
          break;
        }
        case 1: {
          const m = smoothstep(0.0, 0.2, S.fbm2(x / 520 + 40, z / 520 - 12, 4));
          let mh = m * (38 + 20 * S.fbm2(x / 160, z / 160, 2));
          mh = terrace(mh + 9, 9, 0.17) - 9;
          dh += w * mh;
          strata += w * (0.55 + 0.45 * m);
          break;
        }
        case 2: {
          const dir = (x * 0.8 + z * 0.6) / 52;
          const dn = Math.pow(Math.abs(Math.sin(dir + 2.6 * S.fbm2(x / 170, z / 170, 2))), 1.5);
          const big = Math.pow(Math.abs(Math.sin((x * 0.3 - z * 0.95) / 260 + S.fbm2(x / 600, z / 600, 2) * 2)), 2);
          dh += w * (dn * 6 * (0.5 + 0.5 * S.fbm2(x / 260, z / 260, 2)) + big * 18 - 6);
          sand += w;
          fert -= w * 0.15;
          break;
        }
        case 3: {
          const r = S.ridged2(x / 620 + 9, z / 620 + 1, 4, 2.0, 0.45);
          const flow = smoothstep(0.55, 0.85, S2.ridged2(x / 300, z / 300, 3));
          dh += w * (14 + 70 * Math.pow(r, 2.3) - flow * 4 + 3 * S.fbm2(x / 70, z / 70, 2));
          basalt += w;
          fert += w * 0.1;
          break;
        }
        case 4: {
          dh += w * (4 * S.fbm2(x / 260, z / 260, 2));
          fert -= w * 0.05;
          break;
        }
        case 5: {
          dh += w * ((6 - h) * 0.55 + 2 * S.fbm2(x / 80, z / 80, 2));
          crystal += w;
          break;
        }
        case 6: {
          const r = S.ridged2(x / 560 - 3, z / 560 + 7, 5, 2.0, 0.5);
          const gully = smoothstep(0.7, 0.95, S2.ridged2(x / 140 + 5, z / 140, 3));
          dh += w * (30 + 85 * Math.pow(r, 1.6) - gully * 9);
          strata += w * 0.35;
          fert -= w * 0.1;
          break;
        }
        case 7: {
          dh += w * ((-8 - h) * 0.85 + 0.6 * S.fbm2(x / 60, z / 60, 2));
          salt += w;
          fert += w * 0.1;
          break;
        }
        case 8: {
          const g = S.fbm2(x / 700 + 2, z / 700, 4);
          dh += w * (48 + 40 * g + 14 * S.ridged2(x / 240, z / 240, 3));
          snow += w;
          fert -= w * 0.3;
          break;
        }
      }
    }
    h += dh * smoothstep(-0.25, 0.1, cont + 0.05);

    // polar caps: the planet's ends rise into ice plateaus
    const polar = smoothstep(0.72, 0.9, alat);
    if (polar > 0) {
      h += polar * (70 + 50 * S.fbm2(x / 900, z / 900, 3));
      snow = Math.max(snow, polar);
    }
    // east/west boundary: towering ranges close the map
    if (Math.abs(x) > H - 850) {
      const ew = smoothstep(H - 700, H - 120, Math.abs(x) + 120 * S.fbm2(z / 400, x / 400, 2));
      if (ew > 0) h += ew * (220 + 260 * Math.pow(S.ridged2(x / 380, z / 380, 4), 1.5));
    }
    if (Math.abs(z) > H - 750) {
      const ns = smoothstep(H - 600, H - 100, Math.abs(z) + 100 * S.fbm2(x / 400, z / 400, 2));
      if (ns > 0) { h += ns * (180 + 200 * S.fbm2(x / 300, z / 300, 3)); snow = 1; }
    }

    // landmark: giant shield volcano with a caldera
    {
      const V = LANDMARKS.volcano;
      const r = Math.hypot(x - V.x, z - V.z) / V.r;
      if (r < 1.25) {
        const shield = V.h * Math.pow(Math.max(0, 1 - r), 1.7) * (1 + 0.04 * S.fbm2(x / 200, z / 200, 3));
        const cald = r < 0.09 ? -(1 - r / 0.09) * 150 : 0;
        const rim = 30 * Math.exp(-Math.pow((r - 0.09) / 0.025, 2));
        const ridge = (1 - r) * 40 * Math.pow(S.ridged2(Math.atan2(z - V.z, x - V.x) * 6, r * 8, 3), 3);
        h += (shield + cald + rim + ridge) * smoothstep(1.25, 0.9, r);
        basalt = Math.max(basalt, smoothstep(1.1, 0.6, r));
      }
      const V2 = LANDMARKS.volcano2;
      for (const [ox, oz, s] of [[0, 0, 1], [1700, 900, 0.75]]) {
        const r2 = Math.hypot(x - V2.x - ox, z - V2.z - oz) / (V2.r * s);
        if (r2 < 1) {
          const cone = V2.h * s * Math.pow(1 - r2, 1.3) - (r2 < 0.12 ? (1 - r2 / 0.12) * 60 * s : 0);
          h += cone * smoothstep(1, 0.8, r2);
          basalt = Math.max(basalt, smoothstep(1, 0.4, r2));
        }
      }
    }

    // landmark: impact basin (future inland sea)
    {
      const B = LANDMARKS.basin;
      const r0 = Math.hypot(x - B.x, z - B.z) / B.r;
      const r = r0 < 1.7 ? r0 / (1 + 0.08 * S.fbm2(x / 500, z / 500, 2)) : 9;
      if (r < 1.5) {
        const bowl = r < 1 ? -B.d * (1 - Math.pow(r, 2.6)) : 0;
        const rim = B.d * 0.35 * Math.exp(-Math.pow((r - 1) / 0.12, 2));
        h = lerp(h, Math.min(h, 25) + bowl + rim, smoothstep(1.5, 1.0, r));
        if (r < 0.8) sand = Math.max(sand, 0.5);
      }
    }

    // landmark: the Great Rift, terraced walls
    {
      const P = LANDMARKS.rift.pts;
      let d0 = 1e9;
      for (let i = 0; i < P.length - 1; i++) d0 = Math.min(d0, distSeg(x, z, P[i][0], P[i][1], P[i + 1][0], P[i + 1][1]));
      let d = 1e9, width = 0;
      if (d0 < 1100) {
        const rx = x + 140 * S.fbm2(x / 500, z / 500, 3), rz = z + 140 * S.fbm2(x / 500 + 4, z / 500, 3);
        for (let i = 0; i < P.length - 1; i++) d = Math.min(d, distSeg(rx, rz, P[i][0], P[i][1], P[i + 1][0], P[i + 1][1]));
        width = 340 + 160 * S.fbm2(x / 1500, z / 1500, 2);
      }
      if (d < width * 1.6) {
        const t = smoothstep(width * 1.6, width * 0.45, d);
        const floor = -130 + 10 * S.fbm2(x / 200, z / 200, 2);
        let rh = lerp(h, floor, t);
        rh = lerp(rh, terrace(rh, 14, 0.14), smoothstep(0.05, 0.4, t) * (1 - smoothstep(0.92, 1, t)) * 0.9);
        h = rh;
        strata = Math.max(strata, smoothstep(0.0, 0.3, t) * (1 - smoothstep(0.95, 1, t) * 0.6));
        if (t > 0.9) { sand = Math.max(sand, 0.6); fert += 0.3; }
      }
    }

    // ordinary canyons: noise zero-crossings in mesa / highland country
    {
      const mask = (pw[1] + pw[6] * 0.7 + pw[0] * 0.35) * land;
      const cn0 = mask > 0.05 ? S2.fbm2(x / 1700 + 8, z / 1700 - 2, 3) : 1;
      const cn = Math.abs(cn0) < 0.35 ? cn0 + 0.25 * S.fbm2(x / 400, z / 400, 2) : cn0;
      const cw = Math.abs(cn);
      if (cw < 0.06 && mask > 0.05) {
        const t = smoothstep(0.06, 0.012, cw) * mask;
        const floor = Math.min(h, 2) - 26;
        h = lerp(h, terrace(lerp(h, floor, t), 8, 0.18), t);
        strata = Math.max(strata, t * 0.9);
        fert += t * 0.4;
      }
    }

    // craters
    let craterFloor = 0;
    {
      const ci = Math.floor(x / CRATER_CELL), cj = Math.floor(z / CRATER_CELL);
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const c = this.craterCell(ci + i, cj + j);
        if (!c) continue;
        const dx = x - c.x, dz = z - c.z;
        if (dx * dx + dz * dz > 3.61 * c.R * c.R) continue;
        const r = Math.sqrt(dx * dx + dz * dz) / c.R;
        const D = c.D, R = c.R;
        const bowl = r < 1 ? D * (Math.pow(r, 2.3) - 1) : 0;
        const rim = D * 0.3 * Math.exp(-Math.pow((r - 1) / 0.25, 2));
        const peak = R > 140 && r < 0.18 ? D * 0.35 * (1 - r / 0.18) : 0;
        h += bowl + rim + peak;
        if (r < 0.65) craterFloor = Math.max(craterFloor, 1 - r / 0.65);
      }
    }

    if (out) {
      fert += craterFloor * 0.35 + (1 - smoothstep(-10, 60, h)) * 0.3;
      fert -= snow * 0.3 + salt * 0.2;
      out[0] = clamp(sand + (1 - land) * 0.6, 0, 1);
      out[1] = clamp(basalt, 0, 1);
      out[2] = clamp(strata, 0, 1);
      out[3] = clamp(fert + 0.18 * S2.fbm2(x / 160, z / 160, 2), 0, 1);
      out[4] = clamp(snow, 0, 1);
      out[5] = clamp(salt, 0, 1);
      out[6] = clamp(crystal, 0, 1);
      out[7] = craterFloor;
    }
    return h;
  }

  provinceAt(x, z) {
    const p = this.provinces(x, z);
    let best = 0, bw = -1;
    for (let k = 0; k < p.length; k++) if (p[k] > bw) { bw = p[k]; best = k; }
    if (Math.abs(z) > PLANET.HALF * 0.86) best = 8;
    return PROVINCES[best];
  }
}
