// Terraforming: heat / pressure / oxygen / biomass accumulate into the
// Terraformation Index (Ti). The Ti decides the stage (The Planet Crafter's
// ladder: blue sky, clouds, rain, liquid water, lakes, moss, flora, trees,
// insects, breathable air, fauna, complete), and a continuous stage value
// drives every visual: sky colour, dust, clouds, rain, ice melt, sea level,
// moss/grass on the ground, plant growth and colour saturation.
import { STAGES, PARAMS } from './data.js';
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

export class Terraform {
  constructor(game) {
    this.game = game;
    this.p = { heat: 0, pressure: 0, oxygen: 0, biomass: 0 };
    this.rate = { heat: 0, pressure: 0, oxygen: 0, biomass: 0 };
    this._acc = { heat: 0, pressure: 0, oxygen: 0, biomass: 0 };
    this.stage = 0;
    this.sVis = 0;          // smoothed continuous stage used for visuals
    this.weather = { kind: 'clear', t: 0, next: 240, storm: 0, wet: 0, dustStorm: 0 };
    this.rateT = 0;
  }

  get ti() { return this.p.heat + this.p.pressure + this.p.oxygen + this.p.biomass; }

  add(k, v) { this.p[k] += v; this._acc[k] += v; }

  stageFloat() {
    const ti = this.ti;
    let i = 0;
    while (i < STAGES.length - 1 && ti >= STAGES[i + 1].ti) i++;
    if (i >= STAGES.length - 1) return STAGES.length - 1;
    const a = Math.max(STAGES[i].ti, 1), b = STAGES[i + 1].ti;
    const t = i === 0 ? Math.max(0, Math.log(Math.max(ti, 1)) / Math.log(b)) : Math.log(ti / a) / Math.log(b / a);
    return i + clamp(t, 0, 1);
  }

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
    if (st > this.stage) {
      for (let k = this.stage + 1; k <= st; k++) this.game.onStage && this.game.onStage(k, STAGES[k]);
      this.stage = st;
    }
    const target = this.stageFloat();
    this.sVis += (target - this.sVis) * Math.min(1, dt * 0.25);
    if (Math.abs(target - this.sVis) > 2) this.sVis = target;   // after loading
    this.applyVisuals(dt);
  }

  applyVisuals(dt) {
    const s = this.sVis;
    const W = this.weather;
    // ---- weather events
    W.t += dt;
    if (W.kind === 'clear' && W.t > W.next) {
      if (s >= 3) { W.kind = 'rain'; W.dur = 70 + Math.random() * 80; }
      else if (s < 2.5) { W.kind = 'dust'; W.dur = 50 + Math.random() * 40; }
      W.t = 0;
    } else if (W.kind !== 'clear' && W.t > W.dur) {
      W.kind = 'clear'; W.t = 0; W.next = 220 + Math.random() * 260;
    }
    const raining = W.kind === 'rain';
    W.storm += ((raining ? 1 : 0) - W.storm) * Math.min(1, dt * 0.08);
    W.dustStorm += ((W.kind === 'dust' ? 1 : 0) - W.dustStorm) * Math.min(1, dt * 0.06);
    W.wet = clamp(W.wet + (raining ? dt * 0.02 : -dt * 0.004), 0, 1);

    const atmo = table([[0, 0], [1, 0.55], [2, 0.7], [3, 0.78], [6, 0.86], [10, 1]], s);
    const dust = table([[0, 0.45], [1, 0.35], [3, 0.12], [6, 0.04]], s) + W.dustStorm * 0.6;
    const cloud = table([[0, 0], [1.8, 0], [2.4, 0.3], [3, 0.45], [5, 0.55], [8, 0.62]], s) * (1 + W.storm * 0.6);
    this.game.sky.setAtmosphere({ atmo, dust, cloud: clamp(cloud, 0, 1), storm: W.storm });
    U.uFrost.value = table([[0, 1], [3, 0.55], [4.2, 0]], s);
    U.uIce.value = s >= 4 ? 0 : 1;
    this.game.props.setMelt(table([[3.8, 0], [4.6, 1]], s));
    const level = s < 4 ? WORLD.WATER_DRY : table([[4, -295], [5, -95], [6, -28], [8, -7], [10, 0]], s);
    U.uWaterLevel.value = level;
    U.uSnowMelt.value = table([[4, 0], [10, 0.55], [12, 0.7]], s);
    // life arrives gradually and overlapping (Planet Crafter-like): lichen and
    // moss creep out of damp hollows first, single grass tufts sprout and only
    // slowly close into meadows, flowers follow the grass, trees come last
    const moss = table([[5.6, 0], [6.5, 0.22], [7.5, 0.5], [9, 0.8], [11, 1]], s);
    const grass = table([[6.8, 0], [7.5, 0.16], [8.5, 0.4], [9.5, 0.62], [11, 0.85], [12, 1]], s);
    U.uMoss.value = moss;
    U.uGrass.value = grass;
    U.uGrowth.value.set(moss, grass, table([[7.6, 0], [9, 0.45], [10.5, 1]], s), table([[8, 0], [9.5, 0.45], [11, 1]], s));
    U.uLush.value = table([[9, 0], [12, 1]], s);
    U.uWet.value = W.wet;
    U.uWind.value = 0.15 + atmo * 0.45 + W.storm * 0.6;
    BUILD_U.uDustAmt.value = dust * 1.2;
    // local greening from seed / tree spreaders (Terra Nil-style restoration around machines)
    const greens = this.game.buildings.list.filter((b) => b.def.green && b.powerRatio > 0.05);
    for (let i = 0; i < 8; i++) {
      const g = greens[i];
      const u = U.uGreen.value[i];
      if (g) {
        g.data.green = Math.min(1, (g.data.green || 0) + dt / 90);
        u.set(g.x, g.z, g.def.green * (0.4 + 0.6 * g.data.green), g.data.green * (s >= 4 ? 1 : 0.35));
      } else u.set(0, 0, 0, 0);
    }
    if (this.game.flora && this._lastGreen !== greens.length) { this._lastGreen = greens.length; this.game.flora.invalidate(); }
  }

  get breathable() { return this.sVis >= 10; }

  serialize() { return { p: this.p, stage: this.stage, weather: { kind: this.weather.kind, t: this.weather.t, next: this.weather.next } }; }
  load(o) {
    Object.assign(this.p, o.p || {});
    this.stage = o.stage || 0;
    this.sVis = this.stageFloat();
  }
}

export { PARAMS };
