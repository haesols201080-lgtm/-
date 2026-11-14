// Terraforming: heat / pressure / oxygen / biomass accumulate into the
// Terraformation Index (Ti). The Ti decides the stage (The Planet Crafter's
// ladder: blue sky, clouds, rain, liquid water, lakes, moss, flora, trees,
// insects, breathable air, fauna, complete), and a continuous stage value
// drives every visual: sky colour, dust, clouds, rain, ice melt, sea level,
// moss/grass on the ground, plant growth and colour saturation.
import { STAGES, PARAMS, VIS_TI, MILESTONES } from './data.js';
import { U, WORLD } from '../core/shared.js';
import { BUILD_U } from '../build/materials.js';
import { clamp, lerp } from '../core/noise.js';

function table(pts, s) {
  if (s <= pts[0][0]) return pts[0][1];
  for (let i = 0; i < pts.length - 1; i++) {
    const [a, va] = pts[i], [b, vb] = pts[i + 1];
    if (s <= b) return va + (vb - va) * (s - a) / (b - a);
  }
  return pts[pts.length - 1][1];
}

// weather kinds: rain/snow amount, dust, extra cloud, fog, wind, lightning
export const WEATHER = {
  clear: { name: '맑음' },
  fair: { name: '뭉게구름', cloud: 0.15 },
  overcast: { name: '흐림', cloud: 0.45 },
  drizzle: { name: '이슬비', rain: 0.35, cloud: 0.35 },
  rain: { name: '비', rain: 1, cloud: 0.4 },
  thunder: { name: '뇌우', rain: 1.25, cloud: 0.6, flash: true, wind: 0.5 },
  fog: { name: '안개', fog: 1, cloud: 0.2 },
  snow: { name: '눈', snow: 1, cloud: 0.45 },
  devils: { name: '먼지 회오리', dust: 0.25, wind: 0.4 },
  dust: { name: '먼지 폭풍', dust: 1, wind: 0.8 },
  haze: { name: '연무', dust: 0.12, fog: 0.4 },
  gale: { name: '강풍', wind: 1, cloud: 0.25 },
};

export class Terraform {
  constructor(game) {
    this.game = game;
    this.p = { heat: 0, pressure: 0, oxygen: 0, biomass: 0 };
    this.rate = { heat: 0, pressure: 0, oxygen: 0, biomass: 0 };
    this._acc = { heat: 0, pressure: 0, oxygen: 0, biomass: 0 };
    this.stage = 0;
    this.ms = { heat: 0, pressure: 0, oxygen: 0, biomass: 0 };   // next milestone index per parameter
    this.sVis = 0;          // smoothed continuous stage used for visuals
    this.weather = { kind: 'clear', t: 0, next: 240, storm: 0, wet: 0, dustStorm: 0 };
    this.rateT = 0;
  }

  get ti() { return this.p.heat + this.p.pressure + this.p.oxygen + this.p.biomass; }

  add(k, v) { this.p[k] += v; this._acc[k] += v; }

  // continuous position along a list of Ti thresholds (log-interpolated)
  static along(list, ti) {
    let i = 0;
    while (i < list.length - 1 && ti >= list[i + 1]) i++;
    if (i >= list.length - 1) return list.length - 1;
    const a = Math.max(list[i], 1), b = list[i + 1];
    const t = i === 0 ? Math.max(0, Math.log(Math.max(ti, 1)) / Math.log(b)) : Math.log(ti / a) / Math.log(b / a);
    return i + clamp(t, 0, 1);
  }
  // named-stage progress (HUD); visuals run on visFloat()
  stageFloat() { return Terraform.along(STAGES.map((s) => s.ti), this.ti); }
  visFloat() { return Terraform.along(VIS_TI, this.ti); }
  // progress (0..1, log) from the last reached milestone to the next one
  milestoneFrac(k) {
    const L = MILESTONES[k], i = this.ms[k];
    if (i >= L.length) return 1;
    const a = Math.max(1, i > 0 ? L[i - 1][0] : 1), b = L[i][0], v = Math.max(1, this.p[k]);
    return clamp(Math.log(v / a) / Math.log(b / a), 0, 1);
  }
  stageAt(ti) { let st = 0; while (st < STAGES.length - 1 && ti >= STAGES[st + 1].ti) st++; return st; }

  is(stageId) { return this.stage >= STAGES.findIndex((s) => s.id === stageId); }

  tick(dt) {
    // rates (per second) for the HUD
    this.rateT += dt;
    if (this.rateT >= 1) {
      for (const k in this.rate) { this.rate[k] = lerp(this.rate[k], this._acc[k] / this.rateT, 0.5); this._acc[k] = 0; }
      this.rateT = 0;
    }
    const ti = this.ti;
    let st = 0;
    while (st < STAGES.length - 1 && ti >= STAGES[st + 1].ti) st++;
    for (const k in MILESTONES) {
      const L = MILESTONES[k];
      while (this.ms[k] < L.length && this.p[k] >= L[this.ms[k]][0]) { this.game.onMilestone && this.game.onMilestone(k, L[this.ms[k]]); this.ms[k]++; }
    }
    if (st > this.stage) {
      for (let k = this.stage + 1; k <= st; k++) this.game.onStage && this.game.onStage(k, STAGES[k]);
      this.stage = st;
    }
    const target = this.visFloat();
    this.sVis += (target - this.sVis) * Math.min(1, dt * 0.25);
    if (Math.abs(target - this.sVis) > 2) this.sVis = target;   // after loading
    this.applyVisuals(dt);
  }

  applyVisuals(dt) {
    const s = this.sVis;
    const W = this.weather;
    // ---- weather events: eleven kinds, the mix changes as the planet does
    W.t += dt;
    // the next spell of weather is decided as the sky clears, so a weather
    // station can forecast it a minute ahead
    if (W.kind === 'clear' && !W.upcoming) {
      const pool = s < 2.5 ? { devils: 3, dust: 2, haze: 2, gale: 1 }
        : s < 3 ? { haze: 2, devils: 2, gale: 1, overcast: 1 }
          : s < 6 ? { snow: 3, overcast: 2, fog: 2, drizzle: 1, gale: 1, fair: 1 }
            : s < 10 ? { rain: 3, drizzle: 2, overcast: 2, fog: 2, thunder: 1, snow: 1, gale: 1, fair: 2 }
              : { rain: 2, drizzle: 2, thunder: 1.5, fog: 1.5, fair: 3, overcast: 2, gale: 1, snow: 0.5 };
      // cloud seeding brings rain three times as often; dune fixing halves dust
      const eco = this.game.eco;
      if (eco && eco.rainmaker) for (const k of ['rain', 'drizzle', 'thunder']) if (pool[k]) pool[k] *= 3;
      if (eco && eco.dunefix) for (const k of ['dust', 'devils']) if (pool[k]) pool[k] *= 0.5;
      let r = Math.random() * Object.values(pool).reduce((a, b) => a + b, 0);
      W.upcoming = 'fair';
      for (const [k, w] of Object.entries(pool)) { r -= w; if (r <= 0) { W.upcoming = k; break; } }
      W.warned = false;
    }
    if (W.kind === 'clear' && W.upcoming && !W.warned && W.next - W.t < 60 && ['dust', 'thunder', 'gale', 'snow'].includes(W.upcoming)) {
      const g = this.game;
      if (g.eco && g.eco.weatherStation) {
        W.warned = true;
        g.ui && g.ui.toast(`<b>기상 관측소 예보</b> 1분 뒤 ${WEATHER[W.upcoming].name} — 태양광 패널을 덮고 닦아 둡니다`, 'info', 5, true);
      }
    }
    if (W.kind === 'clear' && W.t > W.next) {
      W.kind = W.upcoming || 'fair';
      W.upcoming = null;
      W.dur = 60 + Math.random() * 100;
      W.t = 0;
    } else if (W.kind !== 'clear' && W.t > (W.dur || 90)) {
      W.kind = 'clear'; W.t = 0; W.next = 150 + Math.random() * 220;
    }
    const K = WEATHER[W.kind] || WEATHER.clear, ease = Math.min(1, dt * 0.08);
    W.storm += ((K.rain || 0) - W.storm) * ease;
    W.dustStorm += ((K.dust || 0) - W.dustStorm) * Math.min(1, dt * 0.06);
    W.snow = (W.snow || 0) + ((K.snow || 0) - (W.snow || 0)) * ease;
    W.fog = (W.fog || 0) + ((K.fog || 0) - (W.fog || 0)) * Math.min(1, dt * 0.05);
    W.cloudAdd = (W.cloudAdd || 0) + ((K.cloud || 0) - (W.cloudAdd || 0)) * Math.min(1, dt * 0.05);
    W.gale = (W.gale || 0) + ((K.wind || 0) - (W.gale || 0)) * ease;
    const raining = W.storm > 0.2;
    W.wet = clamp(W.wet + (raining ? dt * 0.02 * W.storm : -dt * 0.004), 0, 1);
    // lightning in thunderstorms
    W.flash = Math.max(0, (W.flash || 0) - dt * 7);
    if (K.flash && W.storm > 0.8 && Math.random() < dt * 0.1) W.flash = 1;
    this.game.engine.exposure = 1 + W.flash * (0.8 + 0.6 * Math.sin(W.t * 90));
    W.name = WEATHER[W.kind] ? WEATHER[W.kind].name : '맑음';

    const atmo = table([[0, 0], [1, 0.55], [2, 0.7], [3, 0.78], [6, 0.86], [10, 1]], s);
    const dust = table([[0, 0.45], [1, 0.35], [3, 0.12], [6, 0.04]], s) + W.dustStorm * 0.6;
    const cloudW = W.cloudAdd;
    const cloud = table([[0, 0], [1.8, 0], [2.4, 0.3], [3, 0.45], [5, 0.55], [8, 0.62], [10.2, 0.62], [11, 0.48]], s) * (1 + W.storm * 0.6);   // temperate: fair-weather skies
    this.game.sky.setAtmosphere({ atmo, dust, cloud: clamp(cloud + cloudW * (s >= 1.8 ? 1 : 0.3), 0, 1), storm: W.storm, fog: W.fog });
    U.uFrost.value = table([[0, 1], [3, 0.55], [4.2, 0]], s);
    U.uIce.value = s >= 4 ? 0 : 1;
    this.game.props.setMelt(table([[3.5, 0], [4.6, 1]], s));          // thaw stage: ice starts to go
    const level = s < 4 ? WORLD.WATER_DRY : table([[4, -295], [5, -95], [6, -28], [8, -7], [10, 0]], s);
    U.uWaterLevel.value = level;
    U.uSnowMelt.value = table([[3.5, 0], [4, 0.12], [10, 0.55], [10.5, 0.62], [11.5, 0.82], [12, 0.86]], s);   // temperate: snowline climbs
    // life arrives gradually and overlapping (Planet Crafter-like): lichen and
    // moss creep out of damp hollows first, single grass tufts sprout and only
    // slowly close into meadows, flowers follow the grass, trees come last
    // primary succession, in the order life really arrives: microbial mats on
    // warm wet shores, algae in the lakes, lichen on bare rock, then moss,
    // ferns (via the moss ramp), grass, flowers, conifers and broadleaf trees
    U.uMicrobe.value = table([[4.6, 0], [5.0, 0.6], [6, 1], [7.5, 0.4], [9, 0]], s);
    U.uAlgae.value = table([[5.1, 0], [5.5, 0.6], [6.5, 1], [9, 0.55]], s);
    U.uLichen.value = table([[5.35, 0], [5.8, 0.6], [7, 1]], s);
    const moss = table([[5.9, 0], [6.5, 0.26], [7.5, 0.5], [9, 0.8], [11, 1]], s);
    const grass = table([[6.8, 0], [7.5, 0.16], [8.5, 0.4], [9.5, 0.62], [11, 0.85], [12, 1]], s);
    U.uMoss.value = moss;
    U.uGrass.value = grass;
    U.uGrowth.value.set(moss, grass, table([[7.6, 0], [9, 0.45], [10.5, 1]], s), table([[8, 0], [9.5, 0.45], [11, 1]], s));
    U.uLush.value = table([[9, 0], [12, 1]], s);
    U.uWet.value = W.wet;
    U.uWind.value = 0.15 + atmo * 0.45 + W.storm * 0.6 + W.gale * 0.9;
    BUILD_U.uDustAmt.value = dust * 1.2;
    // local greening from seed / tree spreaders (Terra Nil-style restoration around machines)
    const greens = this.game.buildings.list.filter((b) => b.def.green && b.powerRatio > 0.05);
    for (let i = 0; i < 8; i++) {
      const g = greens[i];
      const u = U.uGreen.value[i];
      if (g) {
        g.data.green = Math.min(1, (g.data.green || 0) + dt / 90);
        // w packs kind and strength: spores (moss spreader) only advance lichen,
        // moss and ferns locally; seeds (tree spreader) advance grass, flowers, trees
        const kind = g.type === 'seeder' ? 0 : 1;
        u.set(g.x, g.z, g.def.green * (0.4 + 0.6 * g.data.green), kind * 2 + Math.min(0.999, g.data.green * (s >= 4 ? 1 : 0.35)));
      } else u.set(0, 0, 0, 0);
    }
    if (this.game.flora && this._lastGreen !== greens.length) { this._lastGreen = greens.length; this.game.flora.invalidate(); }
  }

  get breathable() { return this.sVis >= 10; }

  serialize() { return { p: this.p, stage: this.stage, weather: { kind: this.weather.kind, t: this.weather.t, next: this.weather.next } }; }
  load(o) {
    Object.assign(this.p, o.p || {});
    this.stage = this.stageAt(this.ti);          // recomputed: the stage list may have changed
    for (const k in MILESTONES) { let i = 0; while (i < MILESTONES[k].length && this.p[k] >= MILESTONES[k][i][0]) i++; this.ms[k] = i; }
    this.sVis = this.visFloat();
  }
}

export { PARAMS };
