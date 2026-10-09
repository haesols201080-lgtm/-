// 기기 화면들이 함께 쓰는 작은 도구 (v24 「범용 만능 UI 폐기」): 모양·조작은 기기마다 따로, 여기는 글 다듬기·소리·키만.
export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const hexCol = (c) => (typeof c === 'number' ? '#' + (c >>> 0).toString(16).padStart(6, '0') : c || '#9fd8ff');

/** 짧은 기계음 (누름·찰칵·땡) — 소리 채널 ui */
export function blip(game, kind = 'press') {
  const a = game.audio || (typeof window !== 'undefined' && window.SEREN && window.SEREN.audio);
  const P = { press: [700, 620, 0.05, 0.04], ok: [520, 780, 0.14, 0.05], no: [200, 150, 0.12, 0.05], click: [1200, 900, 0.03, 0.03], ding: [1320, 1320, 0.35, 0.05], print: [340, 360, 0.5, 0.025] }[kind] || [600, 600, 0.05, 0.04];
  if (a && a.blip) a.blip({ hz: P[0], to: P[1], dur: P[2], gain: P[3], bus: 'ui' });
}

/**
 * 기기를 올린다: game.ui.mount + 그 기기만의 키 (기기가 떠 있는 동안만 · Esc 는 게임이 닫기로 쓴다).
 * keys(e) 가 true 를 돌려주면 그 키는 기기가 썼다(다른 데로 안 감).
 */
export function mountDevice(game, el, { cls = '', keys = null, onClose = null } = {}) {
  let layer = null;
  const h = (e) => {
    if (!layer || game.ui._cardWrap !== layer || e.key === 'Escape') return;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (keys && keys(e)) { e.preventDefault(); e.stopPropagation(); }
  };
  if (keys) window.addEventListener('keydown', h, true);
  layer = game.ui.mount(el, { cls, onClose: () => { if (keys) window.removeEventListener('keydown', h, true); onClose && onClose(); } });
  return layer;
}

/** 키 이름 → 숫자 (1..9 → 0..8), 아니면 -1 */
export const digitOf = (e) => (e.key >= '1' && e.key <= '9' ? +e.key - 1 : -1);
export const isUse = (e) => e.key === 'e' || e.key === 'E' || e.key === 'Enter' || e.key === ' ';
