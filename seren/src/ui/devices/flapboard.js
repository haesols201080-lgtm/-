// 출발 안내판 + 표 기계 (v24 「기기별 UI」): 터미널·별항구·하늘배 정류장·나루의 넘김판 — 글자 조각이 촤르르 넘어가며
//  시각 · 행선지 · 타는 곳 · 값 · 상태가 맞춰진다. 줄을 고르면 아래 표 기계의 값 창이 바뀌고, 「표 뽑기」를 누르면 표가 찍혀 나온다 →
//  나온 표를 집으면(눌러서) 그 편으로 간다. 갈 수 없는 줄은 상태 칸이 빨갛다(값이 모자람·운항 없음).
import { esc, blip, mountDevice, isUse } from './common.js';

const FLAPS = '가나다라마바사아자차카타파하0123456789:·-';

/**
 * openFlap(game, { title, sub, cols: ['시각','행선지',…], rows: [{ cells: [...], status, off, why, fare, on, stub }], foot, machine: '표 뽑기', readonly, onClose })
 *  fare: 표 값 글 (없으면 「호출」) · stub: 표에 찍을 줄들 · on(): 표를 집었을 때
 */
export function openFlap(game, o) {
  const el = document.createElement('div');
  el.className = `flapb${o.readonly ? ' ro' : ''}`; // readonly: 보기만 하는 판 (표 기계 없음)
  const cols = o.cols || ['시각', '행선지', '타는 곳', '값', '상태'];
  el.innerHTML = `<div class="fl-head"><b>${esc(o.title)}</b><span>${esc(o.sub || '')}</span><i class="fl-clock"></i></div>
    <div class="fl-grid" style="--n:${cols.length}"><div class="fl-colh">${cols.map((c) => `<span>${esc(c)}</span>`).join('')}</div>
    ${o.rows.map((r, k) => `<button class="fl-row${r.off ? ' off' : ''}" data-k="${k}">${[...r.cells, r.status || ''].slice(0, cols.length).map((c, j) => `<span class="fl-cell${j === cols.length - 1 ? ' st' : ''}">${[...String(c)].map((ch) => `<i class="fc" data-c="${esc(ch)}">${ch === ' ' ? '&nbsp;' : esc(FLAPS[Math.floor(Math.random() * FLAPS.length)])}</i>`).join('')}</span>`).join('')}</button>`).join('') || `<p class="fl-none">${esc(o.empty || '지금은 떠나는 편이 없어요')}</p>`}</div>
    <div class="fl-foot">${esc(o.foot || '')}</div>
    <div class="fl-mach"><div class="fl-win"><small>고른 편</small><b class="fl-sel">—</b><em class="fl-fare"></em></div><button class="fl-pull" disabled>${esc(o.machine || '표 뽑기')}</button><div class="fl-slot"><div class="fl-ticket"></div></div><button class="fl-leave">물러서기 (Esc)</button></div>`;
  // 글자 조각 넘기기: 줄마다 조금씩 늦게, 글자마다 몇 번 넘어가다 멈춘다
  const chars = [...el.querySelectorAll('.fc')];
  chars.forEach((c, k) => {
    const fin = c.dataset.c;
    if (fin === ' ') return;
    let n = 3 + (k % 5);
    const flip = () => { if (!c.isConnected) return; if (--n <= 0) { c.textContent = fin; c.classList.add('set'); return; } c.textContent = FLAPS[Math.floor(Math.random() * FLAPS.length)]; setTimeout(flip, 55); };
    setTimeout(flip, 40 + Math.floor(k / 6) * 18);
  });
  if (chars.length) blip(game, 'print');
  const clock = el.querySelector('.fl-clock');
  const tm = game.world && game.world.clock ? game.world.clock.time % 1 : 0;
  clock.textContent = `${String(Math.floor(tm * 24)).padStart(2, '0')}:${String(Math.floor((tm * 1440) % 60)).padStart(2, '0')}`;
  const rows = [...el.querySelectorAll('.fl-row')];
  const selEl = el.querySelector('.fl-sel'), fareEl = el.querySelector('.fl-fare'), pull = el.querySelector('.fl-pull'), ticket = el.querySelector('.fl-ticket');
  let sel = -1, printed = false;
  const choose = (k) => {
    if (printed || o.readonly) return;
    const r = o.rows[k];
    if (!r) return;
    sel = k;
    rows.forEach((b, j) => b.classList.toggle('sel', j === k));
    selEl.textContent = r.cells[1] || r.cells[0];
    fareEl.textContent = r.off ? (r.why || '탈 수 없어요') : (r.fare || '');
    fareEl.classList.toggle('no', !!r.off);
    pull.disabled = !!r.off;
    blip(game, 'click');
  };
  const print = () => {
    const r = o.rows[sel];
    if (!r || r.off || printed) { blip(game, 'no'); return; }
    printed = true;
    pull.disabled = true;
    ticket.innerHTML = `<b>${esc(o.title)}</b>${(r.stub || r.cells).map((s) => `<span>${esc(s)}</span>`).join('')}<em>집어 가기 ▸</em>`;
    ticket.classList.add('out');
    blip(game, 'print');
  };
  ticket.addEventListener('click', () => { if (!printed) return; blip(game, 'ok'); lay.close(); o.rows[sel].on(); });
  rows.forEach((b, k) => b.addEventListener('click', () => choose(k)));
  pull.addEventListener('click', print);
  el.querySelector('.fl-leave').addEventListener('click', () => lay.close());
  const first = o.rows.findIndex((r) => !r.off);
  if (first >= 0 && !o.readonly) choose(first);
  const lay = mountDevice(game, el, {
    cls: 'dev-flap', onClose: o.onClose,
    keys: (e) => {
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') { choose(Math.max(0, sel - 1)); return true; }
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') { choose(Math.min(o.rows.length - 1, sel + 1)); return true; }
      if (isUse(e)) { if (printed) ticket.click(); else print(); return true; }
      return false;
    },
  });
  lay.acts = o.rows.map((r, k) => ({ label: String(r.cells[1] || r.cells[0]), off: !!r.off || !!o.readonly, run: () => { choose(k); print(); ticket.click(); } }));
  return lay;
}
