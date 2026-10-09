// 진열대 앞면 (v24 「기기별 UI」): 가게 진열대 · 빵 유리장 · 서늘함(찬 칸) · 창고 철제 선반 · 하역장 짐판 · 노점 천.
//  선반 판마다 물건이 실제 남은 수만큼 앞으로 놓여 있고(얼굴 수), 판 앞 가장자리에 값표(이름 · 값)가 붙어 있다.
//  물건을 누르면 하나가 들려 바구니로 간다(진열대에서 실제로 빠짐) — 남은 게 없으면 빈 자리에 「품절」 표.
//  창고·짐판처럼 보기만 하는 곳은 손글씨 재고표(×수)만. 아래에는 손에 든 바구니(수·값)가 보인다.
import { esc, blip, mountDevice, isUse } from './common.js';

const SHAPES = ['box', 'jar', 'bag', 'round', 'bottle', 'box'];
const shapeOf = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return SHAPES[h % SHAPES.length]; };
const PER = { mart: 4, bakery: 4, cold: 3, stock: 5, pallet: 6, gift: 4, stall: 5, pharm: 5 };

/**
 * openShelf(game, { kind, title, sign, items: [{ name, price, n, cap, col, note, off, shape }], onPick(i) → true|false|'말',
 *   foot: () => html, readonly, action: { label, off, on }, onClose })
 */
export function openShelf(game, o) {
  const kind = o.kind || 'mart', per = PER[kind] || 4, items = o.items;
  const el = document.createElement('div');
  el.className = `shelf kind-${kind}`;
  const boards = [];
  for (let k = 0; k < items.length; k += per) boards.push(items.slice(k, k + per).map((it, j) => [it, k + j]));
  const faces = (it) => { const m = Math.min(o.readonly ? 4 : 6, Math.max(0, Math.ceil(it.n))); let s = ''; for (let q = 0; q < m; q++) s += `<i class="sf-pk ${it.shape || shapeOf(it.name)}" style="--c:${it.col || '#d8c8a8'};--q:${q}"></i>`; return s; };
  const tag = (it) => (o.readonly ? `<span class="sf-tag hand"><b>${esc(it.name)}</b><em>× ${Math.floor(it.n)}</em>${it.note ? `<small>${esc(it.note)}</small>` : ''}</span>`
    : `<span class="sf-tag${it.n <= 0 ? ' out' : ''}"><b>${esc(it.name)}</b><em>${esc(it.price)}</em><small>${it.n <= 0 ? '품절' : esc(it.note || `${Math.floor(it.n)}${it.cap ? `/${it.cap}` : ''}개`)}</small></span>`);
  el.innerHTML = `${o.sign ? `<div class="sf-sign"><b>${esc(o.sign)}</b></div>` : ''}<div class="sf-unit"><div class="sf-title">${esc(o.title || '')}</div>
    ${boards.map((row) => `<div class="sf-board">${row.map(([it, i]) => `<button class="sf-item${it.off || it.n <= 0 ? ' off' : ''}" data-i="${i}" ${o.readonly ? 'tabindex="-1"' : ''}><span class="sf-faces">${faces(it)}</span>${tag(it)}</button>`).join('')}</div>`).join('') || '<div class="sf-board empty"><span>비어 있어요</span></div>'}
    </div><div class="sf-foot"><span class="sf-basket"></span>${o.action ? `<button class="sf-act" ${o.action.off ? 'disabled' : ''}>${esc(o.action.label)}</button>` : ''}<button class="sf-leave">물러서기 (Esc)</button></div><div class="sf-say"></div>`;
  const basket = el.querySelector('.sf-basket'), say = el.querySelector('.sf-say');
  const foot = () => { basket.innerHTML = o.foot ? o.foot() : ''; };
  const speak = (t) => { say.textContent = t; say.classList.remove('pop'); void say.offsetWidth; say.classList.add('pop'); };
  const btns = [...el.querySelectorAll('.sf-item')];
  let focus = 0;
  const setFocus = (k) => { focus = Math.max(0, Math.min(btns.length - 1, k)); btns.forEach((b, j) => b.classList.toggle('focus', j === focus)); };
  const pick = (i) => {
    const it = items[i];
    if (o.readonly || !it) return;
    if (it.off || it.n <= 0) { blip(game, 'no'); speak(it.off && it.why ? it.why : '이 칸은 비었어요'); return; }
    const r = o.onPick(i);
    if (r !== true) { blip(game, 'no'); if (typeof r === 'string') speak(r); return; }
    it.n--;
    const b = btns.find((q) => +q.dataset.i === i);
    const pk = b && b.querySelectorAll('.sf-pk');
    if (pk && pk.length) { const last = pk[pk.length - 1]; last.classList.add('lift'); setTimeout(() => { b.querySelector('.sf-faces').innerHTML = faces(it); }, 380); }
    if (b) { b.querySelector('.sf-tag').outerHTML = tag(it); if (it.n <= 0) b.classList.add('off'); }
    blip(game, 'click');
    foot();
  };
  btns.forEach((b) => b.addEventListener('click', () => { setFocus(btns.indexOf(b)); pick(+b.dataset.i); }));
  const actB = el.querySelector('.sf-act');
  if (actB) actB.addEventListener('click', () => { blip(game, 'press'); lay.close(); o.action.on(); });
  el.querySelector('.sf-leave').addEventListener('click', () => lay.close());
  foot();
  if (!o.readonly) setFocus(0);
  const lay = mountDevice(game, el, {
    cls: 'dev-shelf', onClose: o.onClose,
    keys: (e) => {
      if (o.readonly) return false;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { setFocus(focus - 1); return true; }
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { setFocus(focus + 1); return true; }
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') { setFocus(focus - per); return true; }
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') { setFocus(focus + per); return true; }
      if (isUse(e)) { if (btns[focus]) pick(+btns[focus].dataset.i); return true; }
      return false;
    },
  });
  lay.speak = speak;
  return lay;
}
