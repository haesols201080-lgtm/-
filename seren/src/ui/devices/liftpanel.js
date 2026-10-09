// 승강기 조작반 (v24 「기기별 UI」): 칸 안 벽의 금속판 — 위에 층 표시창(지금 층·화살표), 둥근 층 단추(누르면 테두리에 불),
//  문 열기/닫기 단추, 비상 호출. 옆 벽에는 층 안내판(층 · 쓰임 · 들어 있는 곳). 단추를 누르면 표시창의 숫자가 그 층까지 넘어가고 칸이 움직인다.
import { esc, blip, mountDevice, isUse } from './common.js';

/**
 * openLiftPanel(game, { title, cargo, floors: [{ i, label, name, org, here, off }] (위층부터), onPick(i), onBell? })
 */
export function openLiftPanel(game, o) {
  const floors = o.floors;
  const here = floors.findIndex((f) => f.here);
  const el = document.createElement('div');
  el.className = `liftp${o.cargo ? ' cargo' : ''}`;
  el.innerHTML = `<div class="lp-dir"><b>층 안내</b>${floors.map((f) => `<div class="lp-row${f.here ? ' here' : ''}"><span>${esc(f.label)}</span><em>${esc(f.name)}</em><small>${esc(f.org || '')}</small></div>`).join('')}</div>
    <div class="lp-plate"><div class="lp-disp"><i class="lp-arrow"></i><b>${esc(here >= 0 ? floors[here].label : '')}</b></div>
      <div class="lp-kind">${esc(o.title)}</div>
      <div class="lp-btns">${floors.map((f, k) => `<button class="lp-b${f.here ? ' here' : ''}" data-k="${k}" ${f.off ? 'disabled' : ''} title="${esc(f.name)}"><span>${esc(f.label)}</span></button>`).join('')}</div>
      <div class="lp-doors"><button class="lp-d" data-open title="문 열기 (내리기)">◀▶</button><button class="lp-d" data-shut title="문 닫기">▶◀</button><button class="lp-bell" data-bell title="비상 호출">🔔</button></div>
      <div class="lp-plaque">${o.cargo ? '화물 · 최대 2톤' : '정원 12 · 공명 부양'}</div></div>`;
  const disp = el.querySelector('.lp-disp b'), arrow = el.querySelector('.lp-arrow');
  const btns = [...el.querySelectorAll('.lp-b')];
  let focus = Math.max(0, here), going = false;
  const setFocus = (k) => { focus = (k + btns.length) % btns.length; btns.forEach((b, j) => b.classList.toggle('focus', j === focus)); };
  const press = (k) => {
    const f = floors[k];
    if (going || !f || f.off || f.here) { if (f && f.here) blip(game, 'no'); return; }
    going = true;
    btns[k].classList.add('lit');
    blip(game, 'press');
    // 표시창: 지금 층에서 고른 층까지 한 칸씩 (위층이 앞 = 번호가 작다)
    const dir = k < here ? 1 : -1;
    arrow.className = `lp-arrow ${dir > 0 ? 'up' : 'down'}`;
    let j = here;
    const step = () => {
      if (j === k) { blip(game, 'ding'); setTimeout(() => { lay.close(); o.onPick(f.i); }, 260); return; }
      j -= dir;
      disp.textContent = floors[j].label;
      setTimeout(step, Math.max(70, 360 / Math.max(1, Math.abs(k - here))));
    };
    setTimeout(step, 320);
  };
  btns.forEach((b, k) => b.addEventListener('click', () => press(k)));
  el.querySelector('[data-open]').addEventListener('click', () => { blip(game, 'click'); lay.close(); });
  el.querySelector('[data-shut]').addEventListener('click', () => blip(game, 'click'));
  el.querySelector('[data-bell]').addEventListener('click', () => { blip(game, 'ding'); if (o.onBell) o.onBell(); else game.ui.toast('관리실: 「무슨 일이세요? 칸은 멀쩡해요 — 가실 층 단추를 눌러 주세요」', {}); });
  setFocus(focus);
  const lay = mountDevice(game, el, {
    cls: 'dev-lift',
    keys: (e) => {
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') { setFocus(focus - 1); return true; }
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') { setFocus(focus + 1); return true; }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { setFocus(focus + (e.key === 'ArrowLeft' ? -1 : 1)); return true; }
      if (isUse(e)) { press(focus); return true; }
      return false;
    },
  });
  return lay;
}
