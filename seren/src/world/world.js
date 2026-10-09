// 세계: 하늘·대기·지형·바다·충돌, 그리고 그 위에 얹히는 모든 콘텐츠 모듈을 묶습니다.
// 콘텐츠 모듈은 { update(dt, ctx) } 를 가진 객체로 world.add() 하면 매 프레임 갱신됩니다.
import { SkyClock } from './sky-clock.js';
import { Atmosphere } from './atmosphere.js';
import { Sky } from './sky.js';
import { Terrain } from './terrain.js';
import { Water } from './water.js';
import { Colliders } from './colliders.js';
import { heightAt, regionWeights, RC } from './heightfield.js';
import { REGIONS, WORLD } from './regions.js';

export class World {
  constructor(engine) {
    this.engine = engine;
    this.scene = engine.scene;
    this.clock = new SkyClock();
    this.atmos = new Atmosphere();
    this.sky = new Sky();
    engine.sky = this.sky;
    this.terrain = new Terrain(engine.scene, { lodFactor: engine.q.lod });
    this.water = new Water(engine.scene);
    this.colliders = new Colliders();
    this.heightAt = (x, z) => heightAt(x, z);
    this.limitRadius = WORLD.limitRadius;
    this.updrafts = []; // {x, z, r, y0, y1, strength, enabled}
    this.clearZones = []; // 식물이 자라지 않는 곳 {x, z, r} | {seg: [x0, z0, x1, z1], r} (마을 길·광장·집터)
    this.gravityWells = []; // {x, z, r, scale}
    this.modules = [];
    this.elapsed = 0;
    this._w = new Float32Array(RC);
    this.tetherTop = 30000;
  }

  add(mod) {
    this.modules.push(mod);
    return mod;
  }

  /** 지형 + 구조물을 고려한 지면 높이 */
  /** 식물이 자라면 안 되는 자리인가 (장소의 길·광장·집터) */
  cleared(x, z) {
    const Z = this.clearZones;
    if (!Z.length) return false;
    if (this._clearN !== Z.length) {
      this._clearN = Z.length;
      let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
      for (const c of Z) { const xs = c.seg ? [c.seg[0], c.seg[2]] : [c.x], zs = c.seg ? [c.seg[1], c.seg[3]] : [c.z]; for (const v of xs) { x0 = Math.min(x0, v - c.r); x1 = Math.max(x1, v + c.r); } for (const v of zs) { z0 = Math.min(z0, v - c.r); z1 = Math.max(z1, v + c.r); } }
      this._clearBB = [x0, z0, x1, z1];
    }
    const B = this._clearBB;
    if (x < B[0] || x > B[2] || z < B[1] || z > B[3]) return false;
    for (const c of Z) {
      if (c.seg) {
        const [ax, az, bx, bz] = c.seg, dx = bx - ax, dz = bz - az;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
        if ((x - ax - dx * t) ** 2 + (z - az - dz * t) ** 2 < c.r * c.r) return true;
      } else if ((x - c.x) ** 2 + (z - c.z) ** 2 < c.r * c.r) return true;
    }
    return false;
  }

  groundAt(x, z, y = 1e5) {
    // y 를 주면 그 높이에서 조금 위까지만 (머리 위의 떠 있는 발판으로 튀어 오르지 않게)
    return this.colliders.ground(x, z, y, y >= 1e5 ? 1e5 : 4).h;
  }

  /** 지형/물 중 높은 쪽 */
  surfaceAt(x, z) {
    return Math.max(heightAt(x, z), WORLD.seaLevel);
  }

  regionAt(x, z) {
    const i = regionWeights(x, z, this._w);
    return REGIONS[i];
  }

  updraftAt(p) {
    let best = 0;
    for (const u of this.updrafts) {
      if (u.enabled === false) continue;
      const dx = p.x - u.x, dz = p.z - u.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > u.r * u.r) continue;
      if (p.y < u.y0 - 5 || p.y > u.y1) continue;
      const fall = 1 - Math.sqrt(d2) / u.r;
      const top = Math.min(1, (u.y1 - p.y) / 40);
      best = Math.max(best, u.strength * (0.35 + 0.65 * fall) * top);
    }
    return best;
  }

  gravityScale(p) {
    let s = 1;
    for (const g of this.gravityWells) {
      const dx = p.x - g.x, dz = p.z - g.z;
      const d = Math.hypot(dx, dz);
      if (d < g.r) s = Math.min(s, g.scale + (1 - g.scale) * (d / g.r) ** 2);
    }
    return s;
  }

  update(dt, camera, ctx) {
    this.elapsed += dt;
    // 실내 공간에 있는 동안에는 땅·도시·하늘을 문 앞 거리에 선 것처럼 갱신한다 (세부 단계가 바뀌지 않게)
    const real = this.viewProxy ? camera.position.clone() : null;
    if (real) camera.position.copy(this.viewProxy);
    try {
      this.atmos.u.uAlt.value = camera.position.y;
      this.clock.update(dt);
      this.atmos.update(this.clock, this.elapsed, camera.position.y);
      this.colliders.update();
      for (const m of this.modules) m.update && m.update(dt, ctx);
      this.terrain.update(camera.position);
      this.water.update(camera.position);
    } finally {
      if (real) camera.position.copy(real);
    }
  }

  /** 렌더 직전에 (카메라 확정 후) 하늘 갱신 */
  preRender(camera) {
    this.sky.update(camera, this.tetherTop);
  }
}
