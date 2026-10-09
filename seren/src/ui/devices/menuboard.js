// 차림판 + 주문대 (v24 「기기별 UI」): 찻집·식당 계산대 위에 걸린 빛 차림판(이름 · 점선 · 값, 아래에 재료 한 줄)과
//  그 아래 주문대 — 차림을 누르면 주문 쪽지에 적히고, 주문대의 종을 치면 값을 치르고 주문이 부엌으로 간다.
//  다 지어지면 같은 주문대 위에 쟁반(그릇·김)이 놓이고 「쟁반 들기」 또는 「봉투에 싸기」.
import { esc, blip, mountDevice, digitOf, isUse } from './common.js';

const dishSVG = (col = '#e8c890') => `<svg viewBox="0 0 120 70" class="mb-dish"><ellipse cx="60" cy="58" rx="54" ry="9" fill="#c8b8a0"/><path d="M20 40 Q60 74 100 40 Z" fill="#f4efe6" stroke="#b8a888"/><ellipse cx="60" cy="40" rx="40" ry="8" fill="${col}"/><path class="mb-steam" d="M48 30 q-6 -10 0 -18 M60 28 q-6 -10 0 -20 M72 30 q-6 -10 0 -18" stroke="rgba(255,255,255,.7)" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>`;

/**
 * openMenuBoard(game, { org, who, line, items: [{ name, price, ins, mins, off, why, col }], cash: () => 글, onOrder(i) → true|'말',
 *   ready: { name, col, tray(), bag() }, onClose })
 */
export function openMenuBoard(game, o) {
  const el = document.createElement('div');
  el.className = 'menub';
  const board = `<div class="mb-board"><div class="mb-org">${esc(o.org)}</div>${o.items.map((it, i) => `<button class="mb-it${it.off ? ' off' : ''}" data-i="${i}"><span class="mb-n">${esc(it.name)}</span><span class="mb-dots"></span><span class="mb-p">${esc(it.price)}</span><small>${esc(it.off ? it.why || '오늘은 끝났어요' : it.ins || '')}${it.mins && !it.off ? ` · ${esc(it.mins)}` : ''}</small></button>`).join('')}</div>`;
  el.innerHTML = `${board}<div class="mb-counter"><div class="mb-say">${esc(o.line || '무엇으로 드릴까요?')}</div><div class="mb-slip"><b>주문</b><span class="mb-pick">차림판에서 골라요</span><em class="mb-sum"></em></div><button class="mb-bell" disabled title="종을 쳐서 주문"><i></i><span>종 치기</span></button><div class="mb-tray"></div><div class="mb-cash"></div></div><button class="mb-leave">물러서기 (Esc)</button>`;
  const say = el.querySelector('.mb-say'), pickEl = el.querySelector('.mb-pick'), sum = el.querySelector('.mb-sum'), bell = el.querySelector('.mb-bell'), cash = el.querySelector('.mb-cash'), tray = el.querySelector('.mb-tray');
  const speak = (t) => { say.textContent = t; say.classList.remove('pop'); void say.offsetWidth; say.classList.add('pop'); };
  const refresh = () => { cash.textContent = o.cash ? o.cash() : ''; };
  let sel = -1;
  const choose = (i) => {
    const it = o.items[i];
    if (!it || o.ready) return;
    if (it.off) { blip(game, 'no'); speak(it.why || '그건 오늘 끝났어요'); return; }
    sel = i;
    el.querySelectorAll('.mb-it').forEach((b, j) => b.classList.toggle('sel', j === i));
    pickEl.textContent = it.name; sum.textContent = it.price;
    bell.disabled = false;
    blip(game, 'click');
  };
  const ring = () => {
    if (sel < 0 || o.ready) return;
    bell.classList.add('ring'); setTimeout(() => bell.classList.remove('ring'), 400);
    blip(game, 'ding');
    const r = o.onOrder(sel);
    if (r === true) { speak(`${o.items[sel].name}, 지어 드릴게요. 다 되면 여기 놓을게요`); bell.disabled = true; el.classList.add('ordered'); refresh(); }
    else speak(typeof r === 'string' ? r : '지금은 받을 수 없어요');
  };
  if (o.ready) {
    el.classList.add('ready');
    tray.innerHTML = `${dishSVG(o.ready.col)}<b>${esc(o.ready.name)}</b><div><button class="mb-t" data-t>쟁반 들기</button><button class="mb-t ghost" data-b>봉투에 싸기</button></div>`;
    tray.querySelector('[data-t]').addEventListener('click', () => { blip(game, 'ok'); lay.close(); o.ready.tray(); });
    tray.querySelector('[data-b]').addEventListener('click', () => { blip(game, 'click'); lay.close(); o.ready.bag(); });
    speak(`${o.ready.name} 나왔어요. 빈 식탁에서 드시거나 싸 가셔도 돼요`);
  }
  el.querySelectorAll('.mb-it').forEach((b) => b.addEventListener('click', () => choose(+b.dataset.i)));
  bell.addEventListener('click', ring);
  el.querySelector('.mb-leave').addEventListener('click', () => lay.close());
  refresh();
  const lay = mountDevice(game, el, {
    cls: 'dev-menu', onClose: o.onClose,
    keys: (e) => {
      const d = digitOf(e);
      if (d >= 0 && d < o.items.length) { choose(d); return true; }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { choose(Math.max(0, Math.min(o.items.length - 1, sel + (e.key === 'ArrowUp' ? -1 : 1)))); return true; }
      if (isUse(e)) { if (o.ready) tray.querySelector('[data-t]').click(); else ring(); return true; }
      return false;
    },
  });
  lay.speak = speak;
  return lay;
}
