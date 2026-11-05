// Research (Civilization-style tech tree across eras). Points come from
// research terminals / labs, stage milestones and exploration (data caches,
// wrecks). Alien ruins grant "eureka" boosts: 50% of a tech's cost.
import { RESEARCH, BUILDINGS, STAGES } from './data.js';

export class Research {
  constructor(game) {
    this.game = game;
    this.done = new Set();
    this.points = 0;          // unspent bank
    this.current = null;
    this.progress = {};       // id -> points invested
    this.eureka = new Set();
    this.rate = 0;
    this._acc = 0; this._t = 0;
  }

  has(id) { return this.done.has(id); }
  get(id) { return RESEARCH.find((r) => r.id === id); }
  name(id) { return this.get(id)?.name || id; }

  available(id) {
    const r = this.get(id);
    return r && !this.done.has(id) && r.req.every((q) => this.done.has(q));
  }

  setCurrent(id) {
    if (!this.available(id)) return false;
    this.current = id;
    this.spendBank();
    return true;
  }

  addPoints(p) {
    this._acc += p;
    if (!this.current) {
      // auto-pick the cheapest available tech so points are never wasted
      const av = RESEARCH.filter((r) => this.available(r.id)).sort((a, b) => a.cost - b.cost);
      if (av.length) this.current = av[0].id;
      else { this.points += p; return; }
    }
    this.invest(p);
  }

  invest(p) {
    const r = this.get(this.current);
    this.progress[r.id] = (this.progress[r.id] || 0) + p;
    if (this.progress[r.id] >= r.cost) {
      const over = this.progress[r.id] - r.cost;
      this.complete(r.id);
      this.current = null;
      if (over > 0) this.points += over;
      this.spendBank();
    }
  }

  spendBank() {
    if (this.current && this.points > 0) { const p = this.points; this.points = 0; this.invest(p); }
  }

  complete(id) {
    this.done.add(id);
    const unlocked = Object.entries(BUILDINGS).filter(([, d]) => d.research === id).map(([, d]) => d.name);
    this.game.onResearch && this.game.onResearch(this.get(id), unlocked);
  }

  grantEureka(id) {
    const r = this.get(id);
    if (!r || this.done.has(id) || this.eureka.has(id)) return false;
    this.eureka.add(id);
    this.progress[id] = (this.progress[id] || 0) + r.cost * 0.5;
    if (this.progress[id] >= r.cost && this.available(id)) { this.complete(id); if (this.current === id) this.current = null; }
    return true;
  }

  tick(dt) {
    this._t += dt;
    if (this._t >= 2) { this.rate = this._acc / this._t; this._acc = 0; this._t = 0; }
  }

  // which buildings can be built now (research + stage gates)
  isUnlocked(type) {
    const d = BUILDINGS[type];
    if (!d || d.hidden) return { ok: false, reason: '' };
    if (d.research && !this.done.has(d.research)) return { ok: false, reason: '연구 필요: ' + this.name(d.research) };
    if (d.unlockStage) {
      const si = STAGES.findIndex((s) => s.id === d.unlockStage);
      if (this.game.terra.stage < si) return { ok: false, reason: '테라포밍 단계 필요: ' + STAGES[si].name };
    }
    return { ok: true, reason: '' };
  }

  serialize() { return { done: [...this.done], points: this.points, current: this.current, progress: this.progress, eureka: [...this.eureka] }; }
  load(o) {
    this.done = new Set(o.done || []);
    this.points = o.points || 0;
    this.current = o.current || null;
    this.progress = o.progress || {};
    this.eureka = new Set(o.eureka || []);
  }
}
