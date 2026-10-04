// 처음 해 보는 일 안내: 시설·놀이·탈것을 처음 쓸 때 「어떻게 하나요」 카드를 한 번 띄운다 (data/tips.js).
//   if (g.tips.first('lab', () => this.experiment())) return;  ← 처음이면 안내 카드 → 「알겠어요」에서 다시 부른다
//   g.tips.show('indoor')                                       ← 안내만 (다음 행동 없이)
// 본 안내는 state.tips 에 남는다. 설정의 「도움말」을 끄면 띄우지 않는다. 일지 → 도움말에서 다시 볼 수 있다.
import { TIPS } from '../data/tips.js';

export class Tips {
  constructor(game) {
    this.game = game;
  }

  get seen() {
    const s = this.game.state;
    return s.tips || (s.tips = {});
  }

  _on() { return this.game.settings.hints !== false; }

  _html(T) {
    return `<ol class="tip-steps">${T.steps.map((x) => `<li>${x}</li>`).join('')}</ol>`;
  }

  /** 처음이면 안내 카드를 띄우고 true (「알겠어요 · 시작」을 누르면 cont 를 부른다). 아니면 false */
  first(id, cont) {
    const T = TIPS[id];
    if (!T || this.seen[id] || !this._on()) return false;
    this.seen[id] = 1;
    const g = this.game;
    // 카드가 열린 채(다른 시설 카드 위)라도 한 장만 — 안내 카드로 바꾼다
    g.ui.serviceCard('처음 해 보기 · 안내', T.title, T.intro, [
      { label: cont ? '알겠어요 · 시작하기' : '알겠어요', primary: true, onClick: () => cont && setTimeout(cont, 30) },
    ], this._html(T));
    g.save();
    return true;
  }

  /** 안내만 띄운다 (처음 한 번) */
  show(id) { return this.first(id, null); }

  /** 다시 보기 목록 (일지의 도움말) */
  list() { return Object.entries(TIPS).map(([id, T]) => ({ id, ...T, seen: !!this.seen[id] })); }
}
