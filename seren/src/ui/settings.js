// 설정 + 일시정지 동작 (쉬기, 저장, 타이틀로)
import { PRESETS } from '../core/quality.js';
import { saveSettings } from '../game/state.js';

export class Settings {
  constructor(game) { this.game = game; }

  /** opts.title: 타이틀 화면에서 연 설정 — 게임 안에서만 뜻이 있는 것(쉬기·저장·타이틀로)은 빼고 */
  render(body, opts = {}) {
    const g = this.game;
    const s = g.settings;
    const el = document.createElement('div');
    const q = g.engine.qualityName;
    const inGame = !opts.title;
    el.innerHTML = `
      ${inGame ? `<div class="section-title">쉬기</div>
      <p style="color:var(--ink-dim);margin:0 0 10px">세렌의 하루는 20분이에요. 쉬면서 원하는 때까지 시간을 보낼 수 있어요.</p>
      <div class="seg" data-rest>
        <button data-t="0.27">새벽까지</button><button data-t="0.5">한낮까지</button><button data-t="0.74">해질녘까지</button><button data-t="0.95">깊은 밤까지</button>
      </div>` : ''}
      <div class="section-title">그래픽</div>
      <div class="setrow"><label>품질</label><div class="seg" data-q>${Object.entries(PRESETS).map(([k, v]) => `<button data-k="${k}" class="${k === q ? 'on' : ''}">${v.label}</button>`).join('')}</div></div>
      <div class="section-title">소리</div>
      ${[['master', '전체'], ['music', '음악'], ['sfx', '효과음'], ['ambience', '바람·환경'], ['voice', '목소리']].map(([k, l]) => `<div class="setrow"><label>${l}</label><input type="range" min="0" max="1" step="0.05" value="${s.vol[k]}" data-vol="${k}"></div>`).join('')}
      <div class="section-title">조작</div>
      <div class="setrow"><label>시점 감도</label><input type="range" min="0.3" max="2.5" step="0.05" value="${s.sensitivity}" data-sens></div>
      <div class="setrow"><label>상하 반전</label><div class="seg" data-inv><button data-v="0" class="${s.invertY ? '' : 'on'}">끔</button><button data-v="1" class="${s.invertY ? 'on' : ''}">켬</button></div></div>
      <div class="setrow"><label>도움말</label><div class="seg" data-hints><button data-v="1" class="${s.hints ? 'on' : ''}">켬</button><button data-v="0" class="${s.hints ? '' : 'on'}">끔</button></div></div>
      <div class="section-title">모아</div>
      <div class="setrow"><label>Claude 로 대답</label><div class="seg" data-moa><button data-v="1" class="${s.moaClaude !== false ? 'on' : ''}">켬</button><button data-v="0" class="${s.moaClaude === false ? 'on' : ''}">끔</button></div></div>
      <p style="color:var(--ink-dim);margin:4px 0 0;font-size:13px;line-height:1.7">claude.ai 아티팩트로 열면 모아가 Claude 로 생각해서 대답해요 — 보는 분의 Claude 계정(요금제)의 사용량을 조금 쓰고, 따로 돈이 들지는 않아요. 한도에 닿거나 끄면 게임 안의 기본 모아가 바로 대답해요.</p>
      <div class="section-title">조작법</div>
      <p style="color:var(--ink-dim);line-height:1.9;font-size:14px;margin:0">${g.ui.touch
        ? '왼쪽 화면 끌기: 이동 · 오른쪽 화면 끌기: 시점 · 점프 단추: 점프 / 공중에서 한 번 더 누르면 활공 · 활공 중 화면을 아래로 끌면 급강하 · 공명 단추: 다섯 음 연주 · 살피기: 대화·읽기'
        : 'WASD 이동 · 마우스 시점(클릭하면 고정) · Space 점프 / 공중에서 활공 · Shift 달리기·급강하·썰매 가속 · E 살피기·대화 · F 썰매 · 1–5 공명 · M 지도 · J 일지 · Esc 메뉴<br>활공: 아래를 보면 급강하해서 속도를 얻고, 위를 보면 속도를 고도로 바꿔요.'}</p>
      <div class="menu-actions">
        ${inGame ? '<button class="btn" data-save>지금 저장</button>' : ''}
        <button class="btn" data-full>전체 화면</button>
        ${inGame ? '<button class="btn" data-title>타이틀로</button>' : ''}
      </div>`;
    body.appendChild(el);
    el.querySelectorAll('[data-rest] button').forEach((b) => b.addEventListener('click', () => { g.rest(parseFloat(b.dataset.t)); g.ui.closeMenu(); }));
    el.querySelectorAll('[data-q] button').forEach((b) => b.addEventListener('click', () => {
      s.quality = b.dataset.k;
      saveSettings(s);
      g.setQuality(b.dataset.k);
      el.querySelectorAll('[data-q] button').forEach((x) => x.classList.toggle('on', x === b));
    }));
    el.querySelectorAll('[data-vol]').forEach((r) => r.addEventListener('input', () => { s.vol[r.dataset.vol] = +r.value; g.audio.setVolume(r.dataset.vol, +r.value); saveSettings(s); }));
    el.querySelector('[data-sens]').addEventListener('input', (e) => { s.sensitivity = +e.target.value; g.input.sensitivity = s.sensitivity; saveSettings(s); });
    el.querySelectorAll('[data-inv] button').forEach((b) => b.addEventListener('click', () => { s.invertY = b.dataset.v === '1'; g.input.invertY = s.invertY; saveSettings(s); el.querySelectorAll('[data-inv] button').forEach((x) => x.classList.toggle('on', x === b)); }));
    el.querySelectorAll('[data-moa] button').forEach((b) => b.addEventListener('click', () => { s.moaClaude = b.dataset.v === '1'; saveSettings(s); el.querySelectorAll('[data-moa] button').forEach((x) => x.classList.toggle('on', x === b)); g.moaAI && g.moaAI._badge(); }));
    el.querySelectorAll('[data-hints] button').forEach((b) => b.addEventListener('click', () => { s.hints = b.dataset.v === '1'; saveSettings(s); el.querySelectorAll('[data-hints] button').forEach((x) => x.classList.toggle('on', x === b)); }));
    el.querySelector('[data-save]')?.addEventListener('click', () => { g.save(true); g.ui.toast('저장했어요'); });
    el.querySelector('[data-full]').addEventListener('click', () => {
      const d = document.documentElement;
      if (document.fullscreenElement) document.exitFullscreen?.();
      else (d.requestFullscreen || d.webkitRequestFullscreen)?.call(d);
    });
    el.querySelector('[data-title]')?.addEventListener('click', () => { g.save(true); location.reload(); });
  }
}
