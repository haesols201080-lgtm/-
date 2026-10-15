// 생활 기기들 (v24 「기기별 UI」):
//  · vending: 나눔 기계 — 유리 앞판 안의 나선 칸(칸 번호·값), 오른쪽 번호 자판과 패 대는 곳. 번호를 누르고 패를 대면 나선이 돌아
//    물건이 아래 꺼내는 곳으로 떨어진다 → 꺼내는 곳을 눌러 집는다.
//  · kitchen: 우리 집 부엌 — 조리대 위에 가방의 재료 그릇들, 벽에 꽂힌 요리 쪽지. 쪽지를 고르면 필요한 재료가 냄비로 들어가고
//    「불 켜기」 → 김이 오르면 다 됨. 재료가 모자란 쪽지는 흐릿하다.
//  · chest: 맡겨 두는 서랍 — 왼쪽은 내 가방(주머니 칸), 오른쪽은 열린 서랍(나무 칸막이). 누르면 한 개씩 옮겨진다.
import { esc, blip, mountDevice, digitOf, isUse } from './common.js';

/** vending(game, { title, items: [{ name, price, n, col, off, why }], buy(i) → true|'말' }) */
export function vending(game, o) {
  const el = document.createElement('div');
  el.className = 'vend';
  const code = (i) => `${String.fromCharCode(65 + Math.floor(i / 3))}${(i % 3) + 1}`;
  el.innerHTML = `<div class="vd-glass"><div class="vd-top">${esc(o.title || '나눔 기계')}</div><div class="vd-rows">${o.items.map((it, i) => `<button class="vd-coil${it.off || it.n <= 0 ? ' off' : ''}" data-i="${i}"><span class="vd-cans">${'<i></i>'.repeat(Math.max(0, Math.min(4, it.n)))}</span><b>${esc(it.name)}</b><em>${esc(it.price)}</em><small>${code(i)}</small></button>`).join('')}</div><div class="vd-tray"><span>꺼내는 곳</span></div></div>
    <div class="vd-side"><div class="vd-lcd">번호를 고르세요</div><div class="vd-keys">${o.items.map((_, i) => `<button class="vd-k" data-i="${i}">${code(i)}</button>`).join('')}</div><button class="vd-reader"><i></i>패 대기</button><button class="vd-leave">물러서기 (Esc)</button></div>`;
  el.querySelectorAll('.vd-coil').forEach((b) => b.style.setProperty('--c', o.items[+b.dataset.i].col || '#9fd8ff'));
  const lcd = el.querySelector('.vd-lcd'), tray = el.querySelector('.vd-tray');
  let sel = -1, dropped = null;
  const choose = (i) => { const it = o.items[i]; if (!it) return; sel = i; el.querySelectorAll('.vd-coil').forEach((b) => b.classList.toggle('sel', +b.dataset.i === i)); lcd.textContent = it.off || it.n <= 0 ? `${code(i)} · ${it.why || '다 떨어짐'}` : `${code(i)} ${it.name} · ${it.price} — 패를 대요`; blip(game, 'click'); };
  const pay = () => {
    if (sel < 0 || dropped) { blip(game, 'no'); return; }
    const it = o.items[sel];
    if (it.off || it.n <= 0) { blip(game, 'no'); return; }
    const r = o.buy(sel);
    if (r !== true) { lcd.textContent = typeof r === 'string' ? r : '거래가 안 됐어요'; blip(game, 'no'); return; }
    blip(game, 'ok');
    const coil = el.querySelector(`.vd-coil[data-i="${sel}"]`);
    coil.classList.add('spin'); const can = coil.querySelector('.vd-cans i'); if (can) can.remove();
    it.n--;
    dropped = it;
    setTimeout(() => { tray.innerHTML = `<button class="vd-got" style="--c:${it.col || '#9fd8ff'}"><i></i>${esc(it.name)} 집기</button>`; tray.querySelector('.vd-got').addEventListener('click', take); lcd.textContent = '꺼내는 곳에서 집어 가세요'; }, 700);
  };
  const take = () => { if (!dropped) return; blip(game, 'click'); dropped = null; tray.innerHTML = '<span>꺼내는 곳</span>'; lcd.textContent = '번호를 고르세요'; };
  el.querySelectorAll('.vd-coil, .vd-k').forEach((b) => b.addEventListener('click', () => choose(+b.dataset.i)));
  el.querySelector('.vd-reader').addEventListener('click', pay);
  el.querySelector('.vd-leave').addEventListener('click', () => lay.close());
  const lay = mountDevice(game, el, { cls: 'dev-vend', keys: (e) => { const d = digitOf(e); if (d >= 0 && d < o.items.length) { choose(d); return true; } if (isUse(e)) { if (dropped) take(); else pay(); return true; } return false; } });
  lay.acts = o.items.map((it, i) => ({ label: it.name, off: !!it.off || it.n <= 0, run: () => { choose(i); pay(); } }));
  return lay;
}

/** kitchen(game, { title, pantry: [{ name, n, col }], recipes: [{ name, need: [{ name, n, have }], ok }], cook(i) → 결과 이름 }) */
export function kitchen(game, o) {
  const el = document.createElement('div');
  el.className = 'kitch';
  el.innerHTML = `<div class="kt-wall"><b>${esc(o.title || '우리 집 부엌')}</b><div class="kt-cards">${o.recipes.map((r, i) => `<button class="kt-card${r.ok ? '' : ' off'}" data-i="${i}"><b>${esc(r.name)}</b>${r.need.map((q) => `<span class="${q.have >= q.n ? '' : 'no'}">${esc(q.name)} ${q.n} <em>(${q.have})</em></span>`).join('')}</button>`).join('')}</div></div>
    <div class="kt-top"><div class="kt-bowls">${o.pantry.map((p) => `<span class="kt-bowl" style="--c:${p.col || '#d8c8a8'}"><i></i><b>${esc(p.name)}</b><em>${p.n}</em></span>`).join('') || '<span class="kt-empty">가방에 재료가 없어요 (빵·빛열매·찻잎은 마트에서)</span>'}</div>
      <div class="kt-stove"><div class="kt-pot"><i class="kt-steam"></i></div><button class="kt-fire" disabled>불 켜기</button><div class="kt-msg">요리 쪽지를 골라요</div></div></div><button class="kt-leave">부엌에서 물러서기 (Esc)</button>`;
  const fire = el.querySelector('.kt-fire'), msg = el.querySelector('.kt-msg'), pot = el.querySelector('.kt-pot');
  let sel = -1, busy = false;
  const choose = (i) => { const r = o.recipes[i]; if (!r || busy) return; if (!r.ok) { blip(game, 'no'); msg.textContent = '재료가 모자라요'; return; } sel = i; el.querySelectorAll('.kt-card').forEach((b, j) => b.classList.toggle('sel', j === i)); pot.classList.add('full'); fire.disabled = false; msg.textContent = `${r.need.map((q) => `${q.name} ${q.n}`).join(' · ')} → 냄비에`; blip(game, 'click'); };
  const cook = () => {
    if (sel < 0 || busy) return;
    busy = true; fire.disabled = true; pot.classList.add('on'); msg.textContent = '보글보글…';
    if (game.avatar && game.avatar.act) game.avatar.act('operate', 2);
    setTimeout(() => { const name = o.cook(sel); pot.classList.remove('on', 'full'); pot.classList.add('done'); msg.textContent = `${name} 다 됐다 · 가방에 넣었다`; blip(game, 'ding'); setTimeout(() => lay.close(), 1100); }, 1600);
  };
  el.querySelectorAll('.kt-card').forEach((b) => b.addEventListener('click', () => choose(+b.dataset.i)));
  fire.addEventListener('click', cook);
  el.querySelector('.kt-leave').addEventListener('click', () => lay.close());
  const lay = mountDevice(game, el, { cls: 'dev-kitchen', keys: (e) => { const d = digitOf(e); if (d >= 0 && d < o.recipes.length) { choose(d); return true; } if (isUse(e)) { cook(); return true; } return false; } });
  lay.acts = o.recipes.map((r, i) => ({ label: r.name, off: !r.ok, run: () => { choose(i); cook(); } }));
  return lay;
}

/** chest(game, { title, bag: () => [{ id, name, n, col }], box: () => [{ id, name, n, col }], put(id), take(id) }) */
export function chest(game, o) {
  const el = document.createElement('div');
  el.className = 'chest';
  const cell = (it, side) => `<button class="ch-cell" data-id="${esc(it.id)}" data-s="${side}" style="--c:${it.col || '#d8c8a8'}"><i></i><b>${esc(it.name)}</b><em>${it.n}</em></button>`;
  const draw = () => {
    const bag = o.bag(), box = o.box();
    el.innerHTML = `<div class="ch-bag"><b>내 가방</b><small>누르면 서랍에 맡긴다</small><div class="ch-grid">${bag.map((it) => cell(it, 'bag')).join('') || '<span class="ch-empty">맡길 것이 없어요</span>'}</div></div>
      <div class="ch-box"><div class="ch-lip">${esc(o.title || '서랍')}</div><small>누르면 가방으로 꺼낸다</small><div class="ch-grid wood">${box.map((it) => cell(it, 'box')).join('') || '<span class="ch-empty">비어 있어요</span>'}</div></div><button class="ch-leave">서랍 닫기 (Esc)</button>`;
    el.querySelectorAll('.ch-cell').forEach((b) => b.addEventListener('click', () => { blip(game, 'click'); if (b.dataset.s === 'bag') o.put(b.dataset.id); else o.take(b.dataset.id); draw(); }));
    el.querySelector('.ch-leave').addEventListener('click', () => lay.close());
  };
  let lay = null;
  draw();
  lay = mountDevice(game, el, { cls: 'dev-chest' });
  Object.defineProperty(lay, 'acts', { get: () => [...o.bag().map((it) => ({ label: `맡기 ${it.name}`, off: false, run: () => { o.put(it.id); draw(); } })), ...o.box().map((it) => ({ label: `꺼내기 ${it.name}`, off: false, run: () => { o.take(it.id); draw(); } }))] });
  return lay;
}
