// 남은 것들의 제 모습 (v24 「기기별 UI」):
//  · starMap: 착륙선 선실 탁자의 빛 별지도 — 어두운 하늘에 별(지금 여기 · 우르 · 모아가 표시한 별), 항로 점선. 별을 누르면 그 별의 쪽지.
//  · specimens: 표본함 — 여섯 칸 유리 서랍. 찬 칸은 빛나고 빈 칸은 이름표 자리만.
//  · routeMap: 빛길 역의 노선도 — 하모네아 고리선과 갈래들 위에 역 점들, 지금 역은 「여기」. 갈 역을 누르면 캡슐 타기.
//  · glyphStone: 글자돌 — 돌판에 새긴 글자 악보(점 높이 = 음 높이)와 탁본처럼 떠오르는 뜻.
//  · echo: 메아리 — 상자 없이 화면에 번지는 옛 기억의 글(빛 글씨), 아무 데나 누르면 사라진다.
//  · tipNote: 처음 해 보는 일 — 화면 가장자리에 붙는 작은 메모(순서 목록), 「알겠어요」로 떼어 낸다. 세계를 가리지 않는다.
import { esc, blip, mountDevice, isUse } from './common.js';

/** starMap(game, { title, stars: [{ name, sym, note, x, y, here, mark }], foot }) — x, y 는 0..1 */
export function starMap(game, o) {
  const el = document.createElement('div');
  el.className = 'starmap';
  const W = 600, H = 360;
  const pts = o.stars.map((s) => [s.x * W, s.y * H]);
  const here = o.stars.findIndex((s) => s.here);
  let dust = '';
  for (let k = 0; k < 90; k++) dust += `<circle cx="${(k * 137.5) % W}" cy="${(k * 71.3 + (k % 7) * 13) % H}" r="${k % 9 ? 0.7 : 1.3}" fill="#cfe4ff" opacity="${0.25 + (k % 5) * 0.12}"/>`;
  const route = here >= 0 ? o.stars.map((s, i) => (i !== here && s.route ? `<line x1="${pts[here][0]}" y1="${pts[here][1]}" x2="${pts[i][0]}" y2="${pts[i][1]}" stroke="#7ff3e6" stroke-width="1" stroke-dasharray="4 6" opacity=".55"/>` : '')).join('') : '';
  el.innerHTML = `<div class="sm-head"><b>${esc(o.title)}</b><span>별을 누르면 모아가 남긴 쪽지</span></div>
    <svg viewBox="0 0 ${W} ${H}" class="sm-sky">${dust}${route}${o.stars.map((s, i) => `<g class="sm-star${s.here ? ' here' : ''}" data-i="${i}" transform="translate(${pts[i][0]} ${pts[i][1]})"><circle r="${s.here ? 9 : s.big ? 14 : 6}" fill="${s.col || (s.mark ? '#ffd27a' : '#cfe4ff')}"/>${s.ring ? `<ellipse rx="22" ry="6" fill="none" stroke="#cfe4ff" opacity=".6"/>` : ''}<text y="${s.big ? 30 : 22}" text-anchor="middle">${esc(s.sym || '')} ${esc(s.name)}</text></g>`).join('')}</svg>
    <div class="sm-note">${esc(o.foot || '')}</div><button class="sm-leave">탁자에서 물러서기 (Esc)</button>`;
  const note = el.querySelector('.sm-note');
  el.querySelectorAll('.sm-star').forEach((g) => g.addEventListener('click', () => { const s = o.stars[+g.dataset.i]; el.querySelectorAll('.sm-star').forEach((q) => q.classList.toggle('sel', q === g)); note.textContent = `${s.name} — ${s.note}`; blip(game, 'click'); }));
  el.querySelector('.sm-leave').addEventListener('click', () => lay.close());
  const lay = mountDevice(game, el, { cls: 'dev-starmap' });
  return lay;
}

/** specimens(game, { title, cells: [{ name, full, col }], foot }) */
export function specimens(game, o) {
  const el = document.createElement('div');
  el.className = 'specs';
  el.innerHTML = `<div class="sp-lid"><b>${esc(o.title)}</b></div><div class="sp-grid">${o.cells.map((c) => `<div class="sp-cell${c.full ? ' full' : ''}" style="--c:${c.col || '#7ff3e6'}"><i></i><span class="sp-label">${esc(c.name)}</span></div>`).join('')}</div><div class="sp-foot">${esc(o.foot || '')}</div><button class="sp-leave">함 닫기 (Esc)</button>`;
  el.querySelector('.sp-leave').addEventListener('click', () => lay.close());
  const lay = mountDevice(game, el, { cls: 'dev-specs' });
  return lay;
}

/** routeMap(game, { title, line, here, stops: [{ name, open, on }] }) — 고리 위에 역을 두르고 지금 역을 아래에 */
export function routeMap(game, o) {
  const el = document.createElement('div');
  el.className = 'route';
  const n = o.stops.length + 1, R = 130, cx = 170, cy = 160;
  const pos = (k) => { const a = Math.PI / 2 + (k / n) * Math.PI * 2; return [cx + Math.cos(a) * R, cy + Math.sin(a) * R]; };
  const [hx, hy] = pos(0);
  el.innerHTML = `<div class="rt-head"><b>빛길 · ${esc(o.title)}</b><span>${esc(o.line || '관 속의 캡슐이 고리선과 갈래로 세렌을 잇는다')}</span></div>
    <svg viewBox="0 0 340 330" class="rt-map"><circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#7ff3e6" stroke-width="6" opacity=".35"/><circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#7ff3e6" stroke-width="2"/>
    <g class="rt-here" transform="translate(${hx} ${hy})"><circle r="11" fill="#ff7a52"/><text y="28" text-anchor="middle">여기 · ${esc(o.here)}</text></g>
    ${o.stops.map((s, i) => { const [x, y] = pos(i + 1); return `<g class="rt-stop" data-i="${i}" transform="translate(${x} ${y})"><circle r="9" fill="#0a1a2a" stroke="#7ff3e6" stroke-width="3"/><text y="${y < cy ? -15 : 24}" text-anchor="middle">${esc(s.name)}</text></g>`; }).join('')}</svg>
    <div class="rt-foot">${o.stops.length ? '갈 역을 누르면 캡슐이 문을 연다' : '지금은 열린 다른 역이 없어요'}</div><button class="rt-leave">승강장에서 물러서기 (Esc)</button>`;
  el.querySelectorAll('.rt-stop').forEach((g) => g.addEventListener('click', () => { const s = o.stops[+g.dataset.i]; blip(game, 'ok'); lay.close(); s.on(); }));
  el.querySelector('.rt-leave').addEventListener('click', () => lay.close());
  const lay = mountDevice(game, el, { cls: 'dev-route' });
  lay.acts = o.stops.map((s) => ({ label: s.name, off: false, run: () => { lay.close(); s.on(); } }));
  return lay;
}

/** glyphStone(game, { first, svg, ko, notes: [색], foot }) */
export function glyphStone(game, o) {
  const el = document.createElement('div');
  el.className = 'gstone';
  el.innerHTML = `<div class="gs-slab"><small>${o.first ? '새 단어' : '글자돌'}</small><div class="gs-glyph">${o.svg}</div><div class="gs-notes">${o.notes.map((c) => `<i style="--c:${c}"></i>`).join('')}</div></div>
    <div class="gs-rub"><b>${esc(o.ko)}</b><p>${esc(o.foot || '점의 높이가 음의 높이예요. 아웬의 글자는 악보이기도 해요.')}</p></div><button class="gs-leave">돌에서 손 떼기 (Esc)</button>`;
  el.querySelector('.gs-leave').addEventListener('click', () => lay.close());
  const lay = mountDevice(game, el, { cls: 'dev-gstone', keys: (e) => { if (isUse(e)) { lay.close(); return true; } return false; } });
  return lay;
}

/** echo(game, { kicker, title, text }) — 화면에 번지는 기억, 누르면 사라진다 */
export function echo(game, o) {
  const el = document.createElement('div');
  el.className = 'echo';
  el.innerHTML = `<small>${esc(o.kicker || '메아리 · 옛 기억')}</small><h2>${esc(o.title)}</h2><div class="ec-text">${esc(o.text)}</div><em>누르면 사라져요</em>`;
  el.addEventListener('click', () => lay.close());
  const lay = mountDevice(game, el, { cls: 'dev-echo', keys: (e) => { if (isUse(e)) { lay.close(); return true; } return false; } });
  return lay;
}

/** tipNote(game, { title, intro, steps: [html 줄], ok: '알겠어요', onOk }) — 가장자리 메모 */
export function tipNote(game, o) {
  const el = document.createElement('div');
  el.className = 'tipnote';
  el.innerHTML = `<i class="tn-pin"></i><small>처음 해 보기</small><b>${esc(o.title)}</b><p>${esc(o.intro || '')}</p><ol>${(o.steps || []).map((x) => `<li>${x}</li>`).join('')}</ol><button class="tn-ok">${esc(o.ok || '알겠어요')}</button>`;
  el.querySelector('.tn-ok').addEventListener('click', () => { blip(game, 'click'); lay.close(); o.onOk && o.onOk(); });
  const lay = mountDevice(game, el, { cls: 'dev-world dev-tip', keys: (e) => { if (isUse(e)) { el.querySelector('.tn-ok').click(); return true; } return false; } });
  return lay;
}
