// 칠판 (v24 「기기별 UI」): 교실 앞 초록 칠판 — 나무 틀 · 분필 받침 · 분필 글씨(손글씨 글꼴). 선생님이 쓴 문제와 그림(글자 악보),
//  고를 답은 칠판 아래쪽에 분필로 적혀 있고 누르면 동그라미가 쳐진다. 맞으면 선생님이 옆에 ○, 틀리면 바른 답에 밑줄.
//  시간표·수업 없음 안내도 같은 칠판에 적힌다. 지우개로 지우고 다음 문제를 쓴다(write).
import { esc, blip, mountDevice, digitOf } from './common.js';

/**
 * openChalk(game, { title, corner, lines: [줄], art (html), choices: [{ t, on }], extra: [{ t, on }], onClose })
 * → 층 (lay.write({ title, lines, art, choices, extra }) 로 지우고 다시 쓰기 · lay.mark(i, ok) 동그라미/가위표)
 */
export function openChalk(game, o) {
  const el = document.createElement('div');
  el.className = 'chalk';
  el.innerHTML = `<div class="ck-board"><div class="ck-in"></div><div class="ck-tray"><i></i><i class="b"></i><i class="er"></i></div></div><button class="ck-leave">교실에서 물러서기 (Esc)</button>`;
  const IN = el.querySelector('.ck-in');
  let cur = o;
  const write = (w) => {
    cur = Object.assign({}, cur, w);
    IN.classList.remove('wipe'); void IN.offsetWidth; IN.classList.add('wipe');
    IN.innerHTML = `<div class="ck-top"><b>${esc(cur.title || '')}</b><span>${esc(cur.corner || '')}</span></div>
      ${(cur.lines || []).map((s) => `<p>${esc(s)}</p>`).join('')}${cur.art ? `<div class="ck-art">${cur.art}</div>` : ''}
      <div class="ck-ch">${(cur.choices || []).map((c, i) => `<button class="ck-c" data-c="${i}"><em>${i + 1}.</em> ${esc(c.t)}</button>`).join('')}</div>
      <div class="ck-ex">${(cur.extra || []).map((c, i) => `<button class="ck-x" data-x="${i}">${esc(c.t)}</button>`).join('')}</div>`;
    IN.querySelectorAll('[data-c]').forEach((b) => b.addEventListener('click', () => pick(+b.dataset.c)));
    IN.querySelectorAll('[data-x]').forEach((b) => b.addEventListener('click', () => { const x = cur.extra[+b.dataset.x]; blip(game, 'click'); x && x.on && x.on(lay); }));
  };
  let busy = false;
  const pick = (i) => {
    const c = (cur.choices || [])[i];
    if (!c || busy) return;
    busy = true;
    IN.querySelector(`[data-c="${i}"]`).classList.add('circ');
    blip(game, 'click');
    setTimeout(() => { busy = false; c.on && c.on(lay, i); }, 260);
  };
  const lay = mountDevice(game, el, {
    cls: 'dev-chalk', onClose: o.onClose,
    keys: (e) => { const d = digitOf(e); if (d >= 0 && cur.choices && d < cur.choices.length) { pick(d); return true; } return false; },
  });
  lay.write = write;
  lay.mark = (i, ok) => { const b = IN.querySelector(`[data-c="${i}"]`); if (b) b.classList.add(ok ? 'right' : 'wrong'); };
  el.querySelector('.ck-leave').addEventListener('click', () => lay.close());
  write(o);
  Object.defineProperty(lay, 'acts', { get: () => [...(cur.choices || []).map((c, i) => ({ label: c.t, off: false, run: () => pick(i) })), ...(cur.extra || []).map((x) => ({ label: x.t, off: false, run: () => x.on && x.on(lay) }))] });
  return lay;
}
