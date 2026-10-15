// 승강기 (v24 「기기별 UI」 · 4단계 「승강기」): 두 가지 판.
//  · openLiftCall — 승강장 벽의 부르기 판: 위에 칸 위치 표시창(지금 몇 층 · 오는 쪽 화살표), 아래 둥근 ▲▼ 단추(누르면 테두리에 불).
//    칸이 오는 동안 표시창 숫자가 넘어가고, 도착해 문이 열리면 「딩」 하고 판에서 물러선다 — 그다음은 걸어 들어간다.
//  · openLiftPanel — 칸 안 벽의 조작반: 표시창(지금 층·화살표), 둥근 층 단추(누르면 불, 그 층에 닿으면 꺼진다), 문 열기/닫기, 비상 호출.
//    옆 벽에는 층 안내판(층 · 쓰임 · 들어 있는 곳). 단추를 누르면 문이 닫히고 칸이 실제로 움직인다(game/lifts) — 판은 그동안 떠 있고
//    도착해 문이 열리면 스스로 닫힌다.
import { esc, blip, mountDevice, isUse } from './common.js';

/**
 * openLiftCall(game, { title, floor, range, up, down, live: () => ({ label, dir, up, down, open }), onCall(dir) → 'here'|'called', onClose })
 */
export function openLiftCall(game, o) {
  const el = document.createElement('div');
  el.className = 'liftc';
  el.innerHTML = `<div class="lc-plate"><div class="lc-disp"><i class="lp-arrow"></i><b></b></div>
      <div class="lc-kind">${esc(o.title)}<small>${esc(o.range || '')}</small></div>
      <div class="lc-btns">${o.up ? '<button class="lc-b" data-d="up" title="위로">▲</button>' : ''}${o.down ? '<button class="lc-b" data-d="down" title="아래로">▼</button>' : ''}</div>
      <div class="lc-floor">${esc(o.floor || '')}</div></div>
    <div class="lc-note">단추를 누르면 칸이 와요. 문이 열리면 걸어 들어가서 안쪽 조작반에서 층을 눌러요.</div>
    <button class="lc-leave">단추에서 물러서기 (Esc)</button>`;
  const disp = el.querySelector('.lc-disp b'), arrow = el.querySelector('.lp-arrow'), note = el.querySelector('.lc-note');
  const btn = (d) => el.querySelector(`.lc-b[data-d="${d}"]`);
  let called = false, shut = false, wasOpen = true;
  const sync = () => {
    if (shut) return;
    const s = o.live();
    disp.textContent = s.label;
    arrow.className = `lp-arrow${s.dir > 0 ? ' up' : s.dir < 0 ? ' down' : ''}`;
    if (btn('up')) btn('up').classList.toggle('lit', s.up);
    if (btn('down')) btn('down').classList.toggle('lit', s.down);
    // 문이 (닫혀 있다가) 열렸다 → 딩, 물러선다
    if (s.open && (called || !wasOpen)) { blip(game, 'ding'); note.textContent = '문이 열렸어요 — 걸어 들어가세요.'; shut = true; setTimeout(() => lay.close(), 450); return; }
    wasOpen = s.open;
  };
  const press = (d) => {
    if (!btn(d)) return;
    blip(game, 'press');
    const r = o.onCall(d);
    called = true;
    btn(d).classList.add('lit');
    if (r === 'here') note.textContent = '칸이 이 층에 있어요 — 문이 열려요.';
    else note.textContent = '불이 들어왔어요. 칸이 오는 동안 표시창을 보세요.';
    sync();
  };
  el.querySelectorAll('.lc-b').forEach((b) => b.addEventListener('click', () => press(b.dataset.d)));
  el.querySelector('.lc-leave').addEventListener('click', () => lay.close());
  const tm = setInterval(sync, 150);
  const lay = mountDevice(game, el, {
    cls: 'dev-world dev-liftc',
    onClose: () => { clearInterval(tm); o.onClose && o.onClose(); },
    keys: (e) => {
      if ((e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') && o.up) { press('up'); return true; }
      if ((e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') && o.down) { press('down'); return true; }
      if (isUse(e)) { press(o.up ? 'up' : 'down'); return true; }
      return false;
    },
  });
  wasOpen = o.live().open;
  sync();
  lay.acts = [o.up && { label: '▲ 위로 부르기', off: false, run: () => press('up') }, o.down && { label: '▼ 아래로 부르기', off: false, run: () => press('down') }].filter(Boolean);
  return lay;
}

/**
 * openLiftPanel(game, { title, cargo, plaque, floors: [{ i, label, name, org, off }] (위층부터),
 *   live: () => ({ label, dir, at, lit: Set, open, moving }), onPick(i), onOpen(), onShut(), onBell?, onClose })
 */
export function openLiftPanel(game, o) {
  const floors = o.floors;
  const el = document.createElement('div');
  el.className = `liftp${o.cargo ? ' cargo' : ''}`;
  el.innerHTML = `<div class="lp-dir"><b>층 안내</b>${floors.map((f) => `<div class="lp-row" data-i="${f.i}"><span>${esc(f.label)}</span><em>${esc(f.name)}</em><small>${esc(f.org || '')}</small></div>`).join('')}</div>
    <div class="lp-plate"><div class="lp-disp"><i class="lp-arrow"></i><b></b></div>
      <div class="lp-kind">${esc(o.title)}</div>
      <div class="lp-btns">${floors.map((f, k) => `<button class="lp-b" data-k="${k}" ${f.off ? 'disabled' : ''} title="${esc(f.name)}"><span>${esc(f.label)}</span></button>`).join('')}</div>
      <div class="lp-doors"><button class="lp-d" data-open title="문 열기">◀▶</button><button class="lp-d" data-shut title="문 닫기">▶◀</button><button class="lp-bell" data-bell title="비상 호출">🔔</button></div>
      <div class="lp-plaque">${esc(o.plaque || (o.cargo ? '화물 · 최대 2톤' : '정원 12 · 공명 부양'))}</div></div>`;
  const disp = el.querySelector('.lp-disp b'), arrow = el.querySelector('.lp-arrow');
  const btns = [...el.querySelectorAll('.lp-b')], rows = [...el.querySelectorAll('.lp-row')];
  let focus = 0, picked = null, shut = false;
  const setFocus = (k) => { focus = (k + btns.length) % btns.length; btns.forEach((b, j) => b.classList.toggle('focus', j === focus)); };
  const sync = () => {
    if (shut) return;
    const s = o.live();
    disp.textContent = s.label;
    arrow.className = `lp-arrow${s.dir > 0 ? ' up' : s.dir < 0 ? ' down' : ''}`;
    floors.forEach((f, k) => { btns[k].classList.toggle('lit', s.lit.has(f.i)); btns[k].classList.toggle('here', s.at === f.i); rows[k].classList.toggle('here', s.at === f.i); });
    // 고른 층에 닿아 문이 열렸다 → 판을 닫는다 (걸어 나가면 된다)
    if (picked != null && !s.moving && s.at === picked && s.open) { shut = true; setTimeout(() => lay.close(), 300); }
  };
  const press = (k) => {
    const f = floors[k];
    if (!f || f.off) return;
    const s = o.live();
    if (s.at === f.i && !s.moving) { blip(game, 'click'); o.onOpen(); return; } // 지금 층 단추 = 문 열기
    blip(game, 'press');
    picked = f.i;
    o.onPick(f.i);
    sync();
  };
  btns.forEach((b, k) => b.addEventListener('click', () => press(k)));
  el.querySelector('[data-open]').addEventListener('click', () => { blip(game, 'click'); o.onOpen(); });
  el.querySelector('[data-shut]').addEventListener('click', () => { blip(game, 'click'); o.onShut(); });
  el.querySelector('[data-bell]').addEventListener('click', () => { blip(game, 'ding'); if (o.onBell) o.onBell(); else game.ui.toast('관리실: 「무슨 일이세요? 칸은 멀쩡해요 — 가실 층 단추를 눌러 주세요」', {}); });
  const s0 = o.live();
  setFocus(Math.max(0, floors.findIndex((f) => f.i === s0.at)));
  const tm = setInterval(sync, 150);
  const lay = mountDevice(game, el, {
    cls: 'dev-lift',
    onClose: () => { clearInterval(tm); o.onClose && o.onClose(); },
    keys: (e) => {
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') { setFocus(focus - 1); return true; }
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') { setFocus(focus + 1); return true; }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { setFocus(focus + (e.key === 'ArrowLeft' ? -1 : 1)); return true; }
      if (isUse(e)) { press(focus); return true; }
      return false;
    },
  });
  sync();
  lay.acts = [...floors.map((f, k) => ({ label: `${f.label} ${f.name}`, off: !!f.off || s0.at === f.i, run: () => press(k) })), { label: '문 열기', off: false, run: () => o.onOpen() }];
  return lay;
}
