// 퀘스트 엔진: 데이터(story.js 의 QUESTS)를 읽어 단계별 조건을 확인하고 동작을 실행합니다.
// 단계 type:
//   move(dist) · near(npc,r) · reach(place,r) · talk(npc,convo) · glyphs(ids) · tone(n,place,r)
//   pickup(set,count) · skim(dist) · vista(id) · awaken(count) · night · compose · scan(id) · flag(k)
//   stat(path,count) — 상태의 수치(또는 기록 수)가 count 이상 (예: 'venue.worked' 일한 횟수, 'venue.exhibits' 본 전시 수)
import { QUESTS, ECHOES, GLYPH_STONES } from '../data/story.js';
import { PLACE, GREAT_PYLONS } from '../data/places.js';

const GREAT = new Set(GREAT_PYLONS);
/** 깨운 공명탑 수 (great: 큰 공명탑만 / 아니면 대륙의 공명탑만) */
export function awakenedCount(state, great = false) { return Object.keys(state.pylons).filter((id) => GREAT.has(id) === great).length; }
/** 'venue.worked' 같은 경로의 값: 수치면 그대로, 기록(객체)이면 그 개수 */
function statValue(state, path) {
  let v = state;
  for (const k of path.split('.')) v = v == null ? undefined : v[k];
  return typeof v === 'number' ? v : v && typeof v === 'object' ? Object.keys(v).length : 0;
}
import { bus } from '../core/events.js';

/** 퀘스트 유형: 데이터의 type 이 먼저, 없으면 옛 kind ('side' 만 사이드 — 지금 있는 이야기 퀘스트는 모두 main) */
export function questType(q) { return q ? (q.type || (q.kind === 'side' ? 'side' : 'main')) : 'main'; }

export class Quests {
  constructor(game) {
    this.game = game;
    this._last = null;
    bus.on('convoDone', (e) => this._event('talk', e));
    bus.on('tone', (e) => this._event('tone', e));
    bus.on('flag', () => this._dirty = true);
  }

  get s() { return this.game.state.quests; }

  isActive(id) { return this.s.active.includes(id); }
  isDone(id) { return this.s.done.includes(id); }
  /** active | done | failed | held | null(시작 전) */
  status(id) { return this.s.status[id] || (this.isDone(id) ? 'done' : this.isActive(id) ? 'active' : null); }
  _day() { const c = this.game.world && this.game.world.clock; return c ? +(c.day + (c.time % 1)).toFixed(2) : 0; }

  start(id, silent = false) {
    const q = QUESTS[id];
    if (!q || this.isActive(id) || this.isDone(id)) return;
    this.s.active.push(id);
    this.s.step[id] = 0;
    this.s.data[id] = {};
    this.s.status[id] = 'active';
    this.s.log[id] = { start: this._day(), end: null, steps: [] };
    if (!silent) this.game.ui.toast(questType(q) === 'main' ? `이야기 · ${q.title}` : `새 사이드 퀘스트 · ${q.title}`, { kind: 'quest', sub: questType(q) === 'side' ? 'J 퀘스트 창에서 추적할 수 있어요' : '' });
    this._enterStep(id);
  }

  /** 추적: id 를 고르거나, null(자동 — 메인 먼저)로 되돌리거나, 'none'(아무것도 추적하지 않음 — 정상 상태) */
  track(id) {
    this.s.tracked = id === 'none' || id === 'req' || id == null ? id : this.isActive(id) && this.status(id) === 'active' ? id : this.s.tracked;
    this.game.ui.refreshObjective();
    if (this.game.updateWaypoint) this.game.updateWaypoint();
  }
  untrack() { this.track('none'); }
  /** 보류: 추적·목표에서 빠지고 진행은 그대로 남는다 · 다시 이어 가기 */
  hold(id) { if (this.isActive(id) && questType(QUESTS[id]) === 'side') { this.s.status[id] = 'held'; if (this.s.tracked === id) this.s.tracked = null; this.track(this.s.tracked); } }
  resume(id) { if (this.isActive(id) && this.s.status[id] === 'held') { this.s.status[id] = 'active'; this.track(id); } }
  /** 실패 (사이드만 — 메인은 실패하지 않는다): 목록에서 빠지고 「실패」로 남는다 */
  fail(id, why = '') {
    const q = QUESTS[id];
    if (!q || !this.isActive(id) || questType(q) === 'main') return;
    this.s.active = this.s.active.filter((x) => x !== id);
    this.s.status[id] = 'failed';
    const L = this.s.log[id] || (this.s.log[id] = { start: null, steps: [] });
    L.end = this._day(); L.why = why;
    if (this.s.tracked === id) this.s.tracked = null;
    this.game.ui.toast(`놓침 · ${q.title}`, { sub: why });
    this.game.ui.refreshObjective();
    if (this.game.updateWaypoint) this.game.updateWaypoint();
  }

  step(id) {
    const q = QUESTS[id];
    return q ? q.steps[this.s.step[id] ?? 0] : null;
  }

  _enterStep(id) {
    const st = this.step(id);
    if (!st) return;
    const d = this.s.data[id];
    d.moved = 0; d.skimmed = 0;
    if (st.onStart) this.game.actions.run(st.onStart, { quest: id });
    if (st.hint && this.game.settings.hints) this.game.ui.hint(st.hint);
    this.game.ui.refreshObjective();
  }

  completeStep(id) {
    const st = this.step(id);
    if (!st) return;
    if (st.onDone) this.game.actions.run(st.onDone, { quest: id });
    this.s.step[id]++;
    const L = this.s.log[id] || (this.s.log[id] = { start: null, end: null, steps: [] });
    L.steps.push(this._day());
    const q = QUESTS[id];
    if (this.s.step[id] >= q.steps.length) this._finish(id);
    else {
      this.game.audio.chime('soft');
      this._enterStep(id);
    }
    this.game.save();
  }

  _finish(id) {
    const q = QUESTS[id];
    this.s.active = this.s.active.filter((x) => x !== id);
    this.s.done.push(id);
    this.s.status[id] = 'done';
    if (this.s.log[id]) this.s.log[id].end = this._day();
    if (this.s.tracked === id) this.s.tracked = null; // 마친 목표의 표식·방향은 바로 거둔다
    this.game.audio.chime('quest');
    this.game.ui.toast(`완료 · ${q.title}`, { kind: 'done' });
    if (q.reward) {
      if (q.reward.starseed) this.game.giveItem('starseed', q.reward.starseed);
    }
    if (q.onDone) this.game.actions.run(q.onDone, { quest: id });
    if (q.next) this.start(q.next);
    this.game.ui.refreshObjective();
    bus.emit('questDone', { id });
  }

  /** 이 인물에게 진행할 대화가 있나 */
  talkFor(npcId) {
    for (const id of this.s.active) {
      const st = this.step(id);
      if (st && st.type === 'talk' && st.npc === npcId) return st.convo;
    }
    return null;
  }

  hasTalk(npcId) {
    if (this.talkFor(npcId)) return true;
    const ex = this.game.extraTalk && this.game.extraTalk(npcId, true);
    return !!ex;
  }

  _event(type, e) {
    for (const id of [...this.s.active]) {
      const st = this.step(id);
      if (!st || st.type !== type) continue;
      if (type === 'talk' && e.convo === st.convo) this.completeStep(id);
      if (type === 'tone' && e.n === st.n) {
        const p = PLACE[st.place];
        if (!p || Math.hypot(e.pos.x - p.pos[0], e.pos.z - p.pos[1]) < (st.r || 20)) this.completeStep(id);
      }
    }
  }

  /** 시작 조건이 맞나 (start: { after, talk, stat }) — talk 조건은 그 인물과 말할 때 game.extraTalk 가 연다 */
  canStart(id) {
    const q = QUESTS[id];
    if (!q || this.isActive(id) || this.isDone(id) || this.s.status[id] === 'failed') return false;
    const c = q.start || {};
    if (c.newGame) return false;
    if (c.after && !this.isDone(c.after)) return false;
    if (c.stat && statValue(this.game.state, c.stat[0]) < c.stat[1]) return false;
    return true;
  }
  /** 저절로 열리는 사이드 퀘스트 (인물에게 말을 걸어 여는 것은 빼고) — 가끔 확인 */
  _autoStart() {
    for (const [id, q] of Object.entries(QUESTS)) {
      if (questType(q) !== 'side' || (q.start && q.start.talk)) continue;
      if (this.canStart(id)) this.start(id);
    }
  }
  /** 퀘스트와 관련된 인물·장소 (지금 단계 → 없으면 퀘스트 전체의 첫 인물/장소) */
  related(id) {
    const q = QUESTS[id];
    if (!q) return '';
    const st = this.step(id) || q.steps[0];
    const name = (x) => (x.npc ? (this.game.npcs.get(x.npc) || {}).name || '' : x.place ? (PLACE[x.place] || {}).name || '' : '');
    return name(st) || q.steps.map(name).find(Boolean) || '';
  }

  update(dt) {
    const g = this.game;
    const pl = g.player;
    if ((this._autoT = (this._autoT || 0) - dt) < 0) { this._autoT = 2; this._autoStart(); }
    if (!this._last) this._last = pl.pos.clone();
    const moved = Math.hypot(pl.pos.x - this._last.x, pl.pos.z - this._last.z);
    this._last.copy(pl.pos);
    // 본편이 없을 때 표시하는 목표(수집 수·일식)는 가끔 새로 고친다
    if (!this.s.active.length && (this._freeT = (this._freeT || 0) - dt) < 0) { this._freeT = 4; g.ui.refreshObjective(); }
    for (const id of [...this.s.active]) {
      const st = this.step(id);
      if (!st) continue;
      const d = this.s.data[id];
      let done = false;
      switch (st.type) {
        case 'move': d.moved = (d.moved || 0) + (moved < 20 ? moved : 0); done = d.moved >= st.dist; break;
        case 'near': {
          const n = g.npcs.get(st.npc);
          done = n && n.pos.distanceTo(pl.pos) < st.r;
          break;
        }
        case 'reach': {
          const p = PLACE[st.place];
          done = p && Math.hypot(pl.pos.x - p.pos[0], pl.pos.z - p.pos[1]) < st.r;
          break;
        }
        case 'glyphs': done = st.ids.every((x) => g.state.glyphs[x]); break;
        case 'pickup': done = (g.state.quests.data[id].picked || 0) >= st.count; break;
        case 'skim': if (pl.state === 'skim') d.skimmed = (d.skimmed || 0) + (moved < 30 ? moved : 0); done = d.skimmed >= st.dist; break;
        case 'vista': done = !!g.state.vistas[st.id]; break;
        case 'awaken': done = awakenedCount(g.state, !!st.great) >= st.count; break;
        case 'night': done = g.world.atmos.state.night > 0.75; break;
        case 'compose': done = !!g.state.nameSong; break;
        case 'scan': done = !!g.state.codex[st.id]; break;
        case 'flag': done = !!g.state.flags[st.k]; break;
        case 'stat': done = statValue(g.state, st.path) >= st.count; break;
      }
      if (done) this.completeStep(id);
    }
  }

  /** 추적 중인 이야기 (본편 우선) */
  tracked() {
    const t = this.s.tracked;
    if (t === 'none' || (t === 'req' && this.game.requests && this.game.requests.active.length)) return null;
    if (t && this.isActive(t) && this.status(t) === 'active') return t;
    const a = this.s.active.filter((id) => this.status(id) === 'active');
    const main = a.find((id) => questType(QUESTS[id]) === 'main');
    return main || a[0] || null;
  }

  objectiveText() {
    if (this.s.tracked === 'none') return null; // 추적을 끈 상태도 정상 (목표 칸·표식 없음)
    if (this.s.tracked === 'req') { const r = this.game.requests && this.game.requests.active[0]; if (r) return { title: '부탁 · ' + r.title, text: r.text, kind: 'side', id: 'req' }; }
    const id = this.tracked();
    if (!id) return this._freeObjective();
    const q = QUESTS[id];
    const st = this.step(id);
    if (!st) return null;
    let t = st.text;
    if (st.type === 'awaken') t += ` (${awakenedCount(this.game.state, !!st.great)}/${st.count})`;
    if (st.type === 'pickup') t += ` (${this.s.data[id].picked || 0}/${st.count})`;
    if (st.type === 'glyphs') t += ` (${st.ids.filter((x) => this.game.state.glyphs[x]).length}/${st.ids.length})`;
    return { title: q.title, text: t, kind: questType(q), id };
  }

  /** 본편이 없을 때: 부탁 → 남은 수집거리·다음 일식 */
  _freeObjective() {
    const g = this.game;
    const r = g.requests && g.requests.active[0];
    if (r) return { title: '부탁 · ' + r.title, text: r.text, kind: 'side' };
    if (!this.isDone('mq5')) return null;
    const echoes = ECHOES.filter((e) => g.state.echoes[e.id]).length;
    const glyphs = GLYPH_STONES.filter((s) => g.state.glyphs[s.id]).length;
    const d = g.world.clock.daysToEclipse();
    const ecl = d < 0.05 ? '지금 일식' : `일식까지 ${Math.ceil(d)}일`;
    return { title: '세렌의 기억', text: `메아리 ${echoes}/${ECHOES.length} · 글자돌 ${glyphs}/${GLYPH_STONES.length} · ${ecl}`, kind: 'side' };
  }

  _requestTargets() {
    const g = this.game;
    const r = g.requests && g.requests.active[0];
    if (!r) return [];
    if (r.kind === 'visit') { const n = g.npcs.get(r.npc); return n ? [{ x: n.pos.x, y: n.pos.y + 3, z: n.pos.z, label: n.name }] : []; }
    if (r.kind === 'glyph') { const s = g.discovery.glyph(r.glyph); return s ? [{ x: s.x, y: s.y + 2, z: s.z, label: '글자돌' }] : []; }
    if (r.kind === 'tone') { const p = PLACE[r.place]; return p ? [{ x: p.pos[0], y: null, z: p.pos[1], label: p.name }] : []; }
    if (r.kind === 'ride') { const c = g.currents.byId.get(r.current); if (c) { const p = c.samples[0]; return [{ x: p.x, y: p.y, z: p.z, label: c.def.name }]; } }
    if (r.kind === 'walker' && g.colossi && g.colossi.town) { const w = g.colossi.town; return [{ x: w.pos.x, y: w.pos.y, z: w.pos.z, label: '거신' }]; }
    if (r.kind === 'parcel' && g.facilities) { const F = g.facilities.byId.get(r.to); return F ? [{ x: F.keeper.x, y: F.keeper.y + 3, z: F.keeper.z, label: F.name }] : []; }
    if (r.kind === 'dive' && g.anchor && g.player.pos.y < 20000) { const d = g.anchor.deckStop; return [{ x: d.x, y: d.y, z: d.z, label: '승강차' }]; }
    return [];
  }

  /** 현재 목표의 위치들 (나침반·지도·빛기둥 표시) */
  targets() {
    const base = this._targets0();
    const v = this.game.venues ? this.game.venues.targets() : [];
    return v.length ? v.concat(base) : base;
  }
  _targets0() {
    if (this.s.tracked === 'none') return [];
    if (this.s.tracked === 'req' && this.game.requests && this.game.requests.active.length) return this._requestTargets();
    const id = this.tracked();
    if (!id) return this._requestTargets();
    const st = this.step(id);
    if (!st) return [];
    const g = this.game;
    const out = [];
    const npcPos = (nid) => {
      const n = g.npcs.get(nid);
      if (!n) return;
      // 하늘닻 위의 솔: 땅에 있으면 승강차를 가리킨다
      if (n.pos.y > 20000 && g.player.pos.y < 20000 && g.anchor) { const d = g.anchor.deckStop; out.push({ x: d.x, y: d.y, z: d.z, label: '승강차 → ' + n.name }); return; }
      out.push({ x: n.pos.x, y: n.pos.y + 3, z: n.pos.z, label: n.name });
    };
    switch (st.type) {
      case 'near': case 'talk': npcPos(st.npc); break;
      case 'reach': case 'tone': { const p = PLACE[st.place]; if (p) out.push({ x: p.pos[0], y: null, z: p.pos[1], label: p.name }); break; }
      case 'vista': { const v = g.structures.vistas.get(st.id); if (v) out.push({ x: v.x, y: v.y, z: v.z, label: v.place.name }); else if (st.id === 'spine-deck') out.push({ x: 0, y: g.structures.deckY, z: 0, label: '전망대' }); break; }
      case 'glyphs': for (const gid of st.ids) if (!g.state.glyphs[gid]) { const s = g.discovery.glyph(gid); if (s) out.push({ x: s.x, y: s.y + 2, z: s.z, label: '글자돌' }); } break;
      case 'pickup': for (const p of g.discovery.pickups) if (!p.taken && p.set === st.set) out.push({ x: p.x, y: p.y + 1, z: p.z, label: '부품' }); break;
      case 'awaken': for (const P of g.structures.pylons.values()) if (!P.alive && P.great === !!st.great) out.push({ x: P.x, y: P.y + P.h, z: P.z, label: P.place.name }); break;
      case 'compose': out.push({ x: 0, y: g.structures.deckY, z: 0, label: '전망대' }); break;
      case 'scan': if (st.id === 'skywhale' && g.creatures) { const w = g.creatures.nearestWhale(g.player.pos); if (w) out.push({ x: w.x, y: w.y, z: w.z, label: '하늘고래' }); } break;
      case 'flag':
        if (st.marker === 'anchor' && g.anchor && g.player.pos.y < 20000) { const d = g.anchor.deckStop; out.push({ x: d.x, y: d.y, z: d.z, label: '승강차' }); }
        if (st.marker === 'home' && g.state.home != null && g.city) { const r = g.city.recs[g.state.home]; if (r) g.city.fixDoor(r); if (r) out.push({ x: r.door.x, y: r.floorY + 2, z: r.door.z, label: '우리 집' }); }
        break;
    }
    return out;
  }
}
