// 대화 진행: 아웬은 노래로 말하고(소리 + 글자/번역), 모아는 한국어로 말합니다.
import { CONVOS, LINES, NPCS, KEEPERS } from '../data/story.js';
import { bus } from '../core/events.js';

export class Dialogue {
  constructor(game) {
    this.game = game;
    this.active = null;
  }

  get busy() { return !!this.active; }

  start(convoId, npc = null) {
    const convo = CONVOS[convoId];
    if (!convo) { console.warn('[dialogue] 없는 대화', convoId); return; }
    this.active = { id: convoId, convo, i: -1, npc, wait: 0 };
    this.game.setMode('dialogue');
    if (npc) this.game.focusOn(npc);
    this.next();
  }

  /** 즉석 대화: entries = [{ lineObj }, { s: 'moa', t }] (주민과의 이야기 등). onEnd: 끝나면 */
  startCustom(entries, npc = null, onEnd = null) {
    if (this.active) return;
    this.active = { id: 'custom', convo: entries, i: -1, npc, wait: 0, onEnd };
    this.game.setMode('dialogue');
    if (npc) this.game.focusOn(npc);
    this.next();
  }

  _speaker(s) {
    const g = this.game;
    if (s === '$keeper' && this.active.npc) return this.active.npc;
    return g.npcs.get(s) || this.active.npc;
  }

  next() {
    const a = this.active;
    if (!a) return;
    if (a.wait > 0) return;
    a.i++;
    if (a.i >= a.convo.length) { this.end(); return; }
    const e = a.convo[a.i];
    const g = this.game;
    if (e.choice) {
      g.ui.dialogue.choices(e.choice, (k) => {
        if (e.choice[k].act) g.actions.run(e.choice[k].act);
        this.next();
      });
      return;
    }
    if (e.s === 'moa') {
      g.ui.dialogue.moa(e.t);
      g.audio.blip({ hz: 900, to: 1200, dur: 0.08, gain: 0.05, bus: 'ui' });
    } else {
      const npc = this._speaker(e.speaker || e.s);
      const line = e.lineObj || { id: e.line, ...LINES[e.line] };
      const dur = g.say(npc, line, false);
      g.ui.dialogue.line(npc ? npc.name : '아웬', npc ? npc.title : '', line);
      a.wait = Math.min(1.2, dur * 0.5);
    }
    if (e.act) g.actions.run(e.act, { convo: a.id });
  }

  update(dt) {
    if (this.active && this.active.wait > 0) this.active.wait -= dt;
  }

  end() {
    const a = this.active;
    this.active = null;
    this.game.ui.dialogue.hide();
    this.game.setMode('play');
    if (a && a.onEnd) a.onEnd();
    if (a && a.id !== 'custom') bus.emit('convoDone', { convo: a.id, npc: a.npc && a.npc.id });
  }
}

export { NPCS, KEEPERS };
