// 데이터에서 부르는 동작들. 퀘스트·대화의 act/onStart/onDone 목록이 여기로 옵니다.
// 새 동작을 만들려면 HANDLERS 에 { 이름: (game, a, ctx) => {...} } 를 추가하세요.
import { PLACE } from '../data/places.js';
import { NOTE_NAMES } from '../core/audio.js';
import { bus } from '../core/events.js';

const HANDLERS = {
  moa: (g, a) => g.ui.moa(a.t),
  toast: (g, a) => g.ui.toast(a.t),
  flag: (g, a) => { g.state.flags[a.k] = a.v ?? true; bus.emit('flag', a.k); },
  learn: (g, a) => g.lang.learn(a.word, a.how || 'teach'),
  giveTone: (g, a) => g.giveTone(a.n),
  gesture: (g, a) => { const n = g.npcs.get(a.npc); if (n) n.fig.gesture = a.v ?? 0.8; },
  npcGo: (g, a) => {
    const p = PLACE[a.place];
    if (!p) return;
    const off = a.offset || [0, 0];
    g.npcs.goTo(a.npc, p.pos[0] + off[0], p.pos[1] + off[1], { instant: a.instant });
    const n = g.npcs.get(a.npc);
    if (n) n.lead = a.lead !== false;
  },
  enableCurrent: (g, a) => { g.currents.enable(a.id, true); g.state.flags['cur:' + a.id] = true; },
  spawnPickups: (g, a) => g.discovery.spawnPickups(a.set),
  unlockSkimmer: (g) => { g.state.flags.skimmer = true; g.player.canSkim = true; g.ui.refreshButtons(); g.ui.toast('호버 썰매를 얻었다', { kind: 'item' }); },
  wellAwake: (g) => { g.state.flags.wellAwake = true; g.structures.wellAwake && g.structures.wellAwake(); g.audio.chime('discover'); },
  startQuest: (g, a) => g.quests.start(a.id),
  festival: (g) => g.events.festival(),
  worldChorus: (g) => g.worldChorus(),
  // 하모네아가 내어 주는 집: 지금 선 곳에서 가장 가까운 살림집
  assignHome: (g) => {
    const C = g.city;
    if (!C || g.state.home != null) return;
    const p = g.player.pos;
    let best = null, bd = Infinity;
    for (const r of C.recs) {
      if (r.use !== 'home') continue;
      const d = (r.x - p.x) ** 2 + (r.z - p.z) ** 2;
      if (d < bd) { bd = d; best = r; }
    }
    if (!best) return;
    C.fixDoor(best);
    g.state.home = best.id;
    g.state.homeAt = [best.x, best.z];
    g.ui.toast('하모네아에 우리 집이 생겼다', { kind: 'item', sub: g.interiors.info(best).name });
    g.ui.refreshObjective();
  },
};

export class Actions {
  constructor(game) { this.game = game; }
  run(list, ctx = {}) {
    for (const a of list || []) {
      const h = HANDLERS[a.do];
      if (!h) { console.warn('[actions] 알 수 없는 동작', a.do); continue; }
      try { h(this.game, a, ctx); } catch (e) { console.error('[actions]', a, e); }
    }
  }
}

export { NOTE_NAMES };
