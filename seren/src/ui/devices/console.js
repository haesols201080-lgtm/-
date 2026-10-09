// 조작반 문법 (v24 「기기별 UI」): 공장 기계 · 관제 조종대 · 검사대 · 바깥의 정비 함·신호 탑·드론 정류대·기상 계기처럼
//  손으로 만지는 산업 장치. 줄무늬 이름판 · 바늘 계기(눈금·위험 띠) · 표시등 · 녹색 글자 화면 · 손바닥으로 누르는 큰 버섯 단추(이름은 아래 각인).
//  단추는 눌렀다 올라오고, 할 수 없는 단추는 덮개가 닫혀 있다. 범용 목록 카드가 아니라 그 장치의 앞판이다.
import { esc, blip, mountDevice, digitOf, isUse } from './common.js';

const gaugeSVG = (g) => {
  const f = Math.max(0, Math.min(1, (g.v || 0) / (g.max || 1)));
  const a = Math.PI * (1 - f), x = 50 + Math.cos(a) * 36, y = 52 - Math.sin(a) * 36;
  const arc = (f0, f1, col, w) => { const a0 = Math.PI * (1 - f0), a1 = Math.PI * (1 - f1); return `<path d="M${50 + Math.cos(a0) * 40} ${52 - Math.sin(a0) * 40} A40 40 0 0 1 ${50 + Math.cos(a1) * 40} ${52 - Math.sin(a1) * 40}" stroke="${col}" stroke-width="${w}" fill="none"/>`; };
  let ticks = '';
  for (let k = 0; k <= 10; k++) { const t = Math.PI * (1 - k / 10), r0 = k % 5 ? 37 : 34; ticks += `<line x1="${50 + Math.cos(t) * r0}" y1="${52 - Math.sin(t) * r0}" x2="${50 + Math.cos(t) * 41}" y2="${52 - Math.sin(t) * 41}" stroke="#2a2a22" stroke-width="${k % 5 ? 0.8 : 1.6}"/>`; }
  const warn = g.warn != null ? arc(Math.max(0, Math.min(1, g.warn / g.max)), 1, '#d84a30', 4) : '';
  const low = g.low != null ? arc(0, Math.max(0, Math.min(1, g.low / g.max)), '#d8a030', 4) : '';
  return `<svg viewBox="0 0 100 62" class="cs-g">${arc(0, 1, '#c8c4b0', 1)}${warn}${low}${ticks}<line class="cs-needle" x1="50" y1="52" x2="${x.toFixed(2)}" y2="${y.toFixed(2)}" stroke="#b02818" stroke-width="2.2" stroke-linecap="round"/><circle cx="50" cy="52" r="4" fill="#2a2a22"/></svg>`;
};
const fmtG = (g) => (g.fmt ? g.fmt(g.v) : `${Math.round(g.v * 10) / 10}${g.unit ? ` ${g.unit}` : ''}`);

/**
 * openConsole(game, { title, plate, tone: 'amber'|'green'|'blue', gauges: [{ label, v, max, unit, warn, low, fmt }],
 *   lamps: [{ label, on, col }], screen: [줄] | 'html', keys: [{ label, sub, col: 'red'|'green'|'amber'|'blue'|'grey', hex (색 직접), off, why, on, stay }], onClose })
 * → 층 (lay.screen(lines) · lay.gauges(list) · lay.keys(list) 로 바꿔 그리기)
 */
export function openConsole(game, o) {
  const el = document.createElement('div');
  el.className = `cons tone-${o.tone || 'amber'}`;
  el.innerHTML = `<div class="cs-plate"><b>${esc(o.title)}</b><span>${esc(o.plate || '')}</span><i class="cs-screw"></i><i class="cs-screw r"></i></div>
    <div class="cs-gauges"></div><div class="cs-lamps"></div><div class="cs-crt"><div class="cs-lines"></div></div><div class="cs-keys"></div>
    <button class="cs-leave">물러서기 (Esc)</button>`;
  const G = el.querySelector('.cs-gauges'), L = el.querySelector('.cs-lamps'), S = el.querySelector('.cs-lines'), K = el.querySelector('.cs-keys');
  let keys = [];
  const api = {
    gauges(list) { G.innerHTML = (list || []).map((g) => `<div class="cs-gw">${gaugeSVG(g)}<b>${esc(fmtG(g))}</b><small>${esc(g.label)}</small></div>`).join(''); G.style.display = list && list.length ? '' : 'none'; },
    lamps(list) { L.innerHTML = (list || []).map((l) => `<span class="cs-lamp${l.on ? ' on' : ''}" style="--lc:${l.col || '#7cf06a'}"><i></i>${esc(l.label)}</span>`).join(''); L.style.display = list && list.length ? '' : 'none'; },
    screen(lines) { S.innerHTML = typeof lines === 'string' ? lines : (lines || []).map((s) => `<div>${esc(s)}</div>`).join(''); el.querySelector('.cs-crt').style.display = lines && lines.length ? '' : 'none'; },
    keys(list) {
      keys = list || [];
      K.innerHTML = keys.map((k, i) => `<div class="cs-kw${k.off ? ' off' : ''}"><button class="cs-k col-${k.col || 'grey'}" data-k="${i}" ${k.hex ? `style="--kc:${k.hex}"` : ''} ${k.off ? 'disabled' : ''}><i></i></button><b>${esc(k.label)}</b><small>${esc(k.off && k.why ? k.why : k.sub || '')}</small>${keys.length > 1 ? `<em>${i + 1}</em>` : ''}</div>`).join('');
      K.querySelectorAll('.cs-k').forEach((b) => b.addEventListener('click', () => api.press(+b.dataset.k)));
      K.style.display = keys.length ? '' : 'none';
    },
    press(i) {
      const k = keys[i];
      if (!k || k.off) { blip(game, 'no'); return; }
      const b = K.querySelector(`[data-k="${i}"]`);
      if (b) { b.classList.add('down'); setTimeout(() => b.classList.remove('down'), 180); }
      blip(game, 'press');
      if (k.stay) { k.on && k.on(api); return; }
      setTimeout(() => { lay.close(); k.on && k.on(); }, 160);
    },
  };
  api.gauges(o.gauges); api.lamps(o.lamps); api.screen(o.screen); api.keys(o.keys);
  el.querySelector('.cs-leave').addEventListener('click', () => lay.close());
  const lay = mountDevice(game, el, {
    cls: 'dev-console', onClose: o.onClose,
    keys: (e) => { const d = digitOf(e); if (d >= 0 && d < keys.length) { api.press(d); return true; } if (isUse(e) && keys.length === 1) { api.press(0); return true; } return false; },
  });
  Object.assign(lay, api);
  Object.defineProperty(lay, 'acts', { get: () => keys.map((k, i) => ({ label: k.label, off: !!k.off, run: () => api.press(i) })) });
  return lay;
}
