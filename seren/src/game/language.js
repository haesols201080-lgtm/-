// 아웬어: 글자 그리기, 번역 표시, 단어 익히기.
// 들은 말은 모두 기록되고, 단어를 새로 알게 될 때마다 예전에 들었던 말이 다시 번역됩니다.
import { WORDS, WORD } from '../data/lexicon.js';
import { hashStr, mulberry32 } from '../core/noise.js';
import { bus } from '../core/events.js';

const glyphCache = new Map();

/** 단어의 글자 (SVG 문자열). 점의 높이 = 음의 높이 */
export function glyphSVG(id, size = 28) {
  const key = id + ':' + size;
  if (glyphCache.has(key)) return glyphCache.get(key);
  const w = WORD[id];
  const rnd = mulberry32(hashStr(id) * 7 + 3);
  const notes = w ? w.notes : [0];
  const n = notes.length;
  const pts = notes.map((v, i) => [n === 1 ? 20 : 9 + (i * 22) / (n - 1), 33 - (v % 5) * 5.2 - (v >= 5 ? 4 : 0)]);
  let d = '';
  if (n > 1) {
    d += `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 1; i < n; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      const cx = (x0 + x1) / 2, cy = Math.min(y0, y1) - 5 - rnd() * 4;
      d += ` Q${cx.toFixed(1)},${cy.toFixed(1)} ${x1},${y1}`;
    }
  }
  const deco = [];
  const kind = Math.floor(rnd() * 4);
  const [fx, fy] = pts[0];
  if (kind === 0) deco.push(`<path d="M${fx},${fy} L${fx},${Math.min(38, fy + 9)}"/>`);
  if (kind === 1) deco.push(`<path d="M6,37 Q20,${31 + rnd() * 4} 34,37"/>`);
  if (kind === 2) deco.push(`<path d="M${fx - 6},${fy - 7} A7,7 0 0,1 ${fx + 6},${fy - 7}"/>`);
  if (kind === 3) deco.push(`<circle cx="${pts[n - 1][0]}" cy="${pts[n - 1][1]}" r="5" fill="none"/>`);
  if (rnd() < 0.5) deco.push(`<path d="M${8 + rnd() * 6},6 L${26 + rnd() * 6},${4 + rnd() * 4}"/>`);
  const dots = pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.4" fill="currentColor" stroke="none"/>`).join('');
  const svg = `<svg class="gl" viewBox="0 0 40 40" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${d ? `<path d="${d}"/>` : ''}${deco.join('')}${dots}</svg>`;
  glyphCache.set(key, svg);
  return svg;
}

export class Language {
  constructor(game) {
    this.game = game;
  }

  get s() { return this.game.state; }

  level(id) { return this.s.vocab[id] || 0; }
  known(id) { return this.level(id) >= 1; }
  get knownCount() { return Object.values(this.s.vocab).filter((v) => v >= 1).length; }
  get total() { return WORDS.length; }

  /** 단어를 알게 됨. how: 'stone' | 'guess' | 'teach' | 'scan' | ... */
  learn(id, how = 'teach', silent = false) {
    if (!WORD[id]) return false;
    const lv = how === 'guess' ? 1 : 2;
    const prev = this.level(id);
    if (prev >= lv) return false;
    this.s.vocab[id] = lv;
    if (!silent) bus.emit('word', { id, how, word: WORD[id], first: prev === 0 });
    this._recheckHeard(id);
    return true;
  }

  isUnderstood(line) {
    return line.words.every((w) => !WORD[w] || this.known(w));
  }

  /** 한 줄을 들음: 노출 횟수 → 추정 학습, 들은 말 기록 */
  hear(line, place = null) {
    const s = this.s;
    if (!s.heard.find((h) => h.id === line.id)) {
      s.heard.push({ id: line.id, t: Date.now(), place, understood: this.isUnderstood(line) });
    }
    const guesses = [];
    for (const w of line.words) {
      if (!WORD[w]) continue;
      s.exposure[w] = (s.exposure[w] || 0) + 1;
      if (!this.known(w) && s.exposure[w] >= 4 && Math.random() < 0.7) guesses.push(w);
    }
    // 한 번에 하나만 추정 (모아가 차근차근)
    if (guesses.length) this.learn(guesses[0], 'guess');
  }

  _recheckHeard() {
    for (const h of this.s.heard) {
      if (h.understood) continue;
      const line = this.game.lines && this.game.lines[h.id];
      if (line && this.isUnderstood(line)) {
        h.understood = true;
        bus.emit('lineUnderstood', { id: h.id, line });
      }
    }
  }

  /** 표시용 HTML: 아는 단어는 한국어로, 모르는 단어는 글자로 */
  render(line, opts = {}) {
    if (!opts.raw && this.isUnderstood(line) && line.ko) return `<span class="tr full">${line.ko}</span>`;
    return line.words.map((w) => {
      if (w[0] === '@') return `<span class="tok name">${w.slice(1)}</span>`;
      if (!WORD[w]) return `<span class="punct">${w}</span>`;
      const lv = this.level(w);
      if (lv >= 1) return `<span class="tok known${lv === 1 ? ' guess' : ''}" title="${WORD[w].ko}">${WORD[w].ko}${lv === 1 ? '<sup>?</sup>' : ''}</span>`;
      return `<span class="tok glyph">${glyphSVG(w, opts.size || 26)}</span>`;
    }).join(' ');
  }

  /** 줄을 노래할 음표들 (단어 사이 쉼) */
  notesOf(line) {
    const out = [];
    for (const w of line.words) {
      if (w[0] === '@') { const h = hashStr(w); out.push(h % 5, (h >> 4) % 5 + 5); continue; }
      if (!WORD[w]) { out.push(null); continue; }
      out.push(...WORD[w].notes);
    }
    return out;
  }
}
