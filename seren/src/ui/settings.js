// 설정 + 일시정지 동작 (쉬기, 저장, 타이틀로)
import { PRESETS } from '../core/quality.js';
import { saveSettings, defaultSettings } from '../game/state.js';

// 소리 채널 (v24): [열쇠, 이름, 설명]
const CHANNELS = [
  ['master', '전체 음량', '모든 채널에 곱함'], ['music', '배경 음악', ''], ['ambience', '환경음', '바람·물·도시·기계의 지속음'],
  ['sfx', '효과음', '발걸음·문·충돌·도구·탈것·탑'], ['ui', '시스템·UI 음', '알림·메뉴·발견·저장'], ['voice', '목소리', '아웬의 노래하는 말'],
];
// 화면·빛 (v24): [열쇠, 이름, 최소, 최대, 설명] — 안전한 범위 안에서만 (완전히 검거나 하얗게 날아가지 않게)
const DISP = [
  ['bright', '전체 밝기', 0.6, 1.5, '최종 화면 노출'], ['light', '조명 밝기', 0.4, 1.6, '가로등·실내등·발광 장치'], ['bloom', '빛 번짐', 0, 1.6, '밝은 빛 둘레의 번짐(눈부심)'],
];

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
      <div class="section-title">화면·빛 <small>— 바로 뒤 장면에 반영돼요</small></div>
      ${DISP.map(([k, l, lo, hi, sub]) => `<div class="setrow"><label>${l}<small>${sub}</small></label><input type="range" min="${lo}" max="${hi}" step="0.05" value="${s[k]}" data-disp="${k}"><output data-o="${k}">${Math.round(s[k] * 100)}%</output></div>`).join('')}
      <div class="section-title">소리 <small>— 전체 음량은 아래 채널 모두에 곱해져요</small></div>
      ${CHANNELS.map(([k, l, sub]) => `<div class="setrow"><label>${l}<small>${sub}</small></label><input type="range" min="0" max="1" step="0.01" value="${s.vol[k] ?? 0.8}" data-vol="${k}"><output data-o="v-${k}">${Math.round((s.vol[k] ?? 0.8) * 100)}</output></div>`).join('')}
      <div class="menu-actions" style="margin-top:6px"><button class="btn" data-reset>소리·화면 기본값으로</button></div>
      <div class="section-title">조작</div>
      <div class="setrow"><label>시점 감도</label><input type="range" min="0.3" max="2.5" step="0.05" value="${s.sensitivity}" data-sens></div>
      <div class="setrow"><label>시점 <small>(V)</small></label><div class="seg" data-view><button data-v="third" class="${s.view === 'first' ? '' : 'on'}">3인칭</button><button data-v="first" class="${s.view === 'first' ? 'on' : ''}">1인칭</button></div></div>
      <div class="setrow"><label>상하 반전</label><div class="seg" data-inv><button data-v="0" class="${s.invertY ? '' : 'on'}">끔</button><button data-v="1" class="${s.invertY ? 'on' : ''}">켬</button></div></div>
      <div class="setrow"><label>도움말</label><div class="seg" data-hints><button data-v="1" class="${s.hints ? 'on' : ''}">켬</button><button data-v="0" class="${s.hints ? '' : 'on'}">끔</button></div></div>
      <div class="section-title">모아</div>
      <div class="setrow"><label>Claude 로 대답</label><div class="seg" data-moa><button data-v="1" class="${s.moaClaude !== false ? 'on' : ''}">켬</button><button data-v="0" class="${s.moaClaude === false ? 'on' : ''}">끔</button></div></div>
      <p style="color:var(--ink-dim);margin:4px 0 0;font-size:13px;line-height:1.7">claude.ai 아티팩트로 열면 모아가 Claude 로 생각해서 대답해요 — 보는 분의 Claude 계정(요금제)의 사용량을 조금 쓰고, 따로 돈이 들지는 않아요. 한도에 닿거나 끄면 게임 안의 기본 모아가 바로 대답해요.</p>
      <div class="section-title">조작법</div>
      <p style="color:var(--ink-dim);line-height:1.9;font-size:14px;margin:0">${g.ui.touch
        ? '왼쪽 화면 끌기: 이동 · 오른쪽 화면 끌기: 시점 · 점프 단추: 점프 / 공중에서 한 번 더 누르면 활공 · 활공 중 화면을 아래로 끌면 급강하 · 공명 단추: 다섯 음 연주 · 살피기: 대화·읽기'
        : 'WASD 이동 · 마우스 시점(클릭하면 고정) · Space 점프 / 공중에서 활공 · Shift 달리기·급강하·썰매 가속 · E 살피기·대화 · F 썰매 · 1–5 공명 · M 지도 · J 퀘스트 · I 일지·가방 · V 시점 · Esc 메뉴<br>활공: 아래를 보면 급강하해서 속도를 얻고, 위를 보면 속도를 고도로 바꿔요.'}</p>
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
    el.querySelectorAll('[data-vol]').forEach((r) => r.addEventListener('input', () => {
      const k = r.dataset.vol;
      s.vol[k] = +r.value; g.audio.setVolume(k, +r.value); saveSettings(s);
      el.querySelector(`[data-o="v-${k}"]`).textContent = Math.round(+r.value * 100);
      // 들으며 맞추기: 그 채널의 소리를 잠깐 (음악·환경음은 이미 흐르고 있다)
      clearTimeout(this._preview); this._preview = setTimeout(() => { const a = g.audio; if (!a.ready) return; if (k === 'ui') a.chime('soft'); else if (k === 'sfx' || k === 'master') a.blip({ hz: 420, to: 640, dur: 0.18, gain: 0.12 }); else if (k === 'voice' && a.sing) a.sing([2, 4], { gain: 0.3 }); }, 120);
    }));
    el.querySelectorAll('[data-disp]').forEach((r) => r.addEventListener('input', () => {
      const k = r.dataset.disp;
      s[k] = +r.value; g.applyDisplay(); saveSettings(s);
      el.querySelector(`[data-o="${k}"]`).textContent = `${Math.round(s[k] * 100)}%`;
    }));
    el.querySelector('[data-reset]').addEventListener('click', () => {
      const d = defaultSettings();
      s.vol = { ...d.vol }; s.bright = d.bright; s.light = d.light; s.bloom = d.bloom;
      for (const [k, v] of Object.entries(s.vol)) g.audio.setVolume(k, v);
      g.applyDisplay(); saveSettings(s);
      body.innerHTML = ''; this.render(body, opts);
    });
    el.querySelector('[data-sens]').addEventListener('input', (e) => { s.sensitivity = +e.target.value; g.input.sensitivity = s.sensitivity; saveSettings(s); });
    el.querySelectorAll('[data-inv] button').forEach((b) => b.addEventListener('click', () => { s.invertY = b.dataset.v === '1'; g.input.invertY = s.invertY; saveSettings(s); el.querySelectorAll('[data-inv] button').forEach((x) => x.classList.toggle('on', x === b)); }));
    el.querySelectorAll('[data-moa] button').forEach((b) => b.addEventListener('click', () => { s.moaClaude = b.dataset.v === '1'; saveSettings(s); el.querySelectorAll('[data-moa] button').forEach((x) => x.classList.toggle('on', x === b)); g.moaAI && g.moaAI._badge(); }));
    el.querySelectorAll('[data-view] button').forEach((b) => b.addEventListener('click', () => { s.view = b.dataset.v; if (g.rig) g.rig.view = s.view; saveSettings(s); el.querySelectorAll('[data-view] button').forEach((x) => x.classList.toggle('on', x === b)); if (g.ui && g.ui.tView) g.ui.tView.classList.toggle('on', s.view === 'first'); }));
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
