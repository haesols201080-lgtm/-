// 집 알림판 (v24 부동산 · 범용 UI 폐기): 벽에 꽂힌 종이 카드 — 카드마다 그 집의 실루엣(단독 집 / 층 수만큼 높은 건물), 이름, 거리, 집세.
//  카드를 누르면 떼어져 앞으로 나오고 「나침반에 꽂기」 핀이 붙는다. 계약은 중개 책상의 종이에서.
import { won } from '../../data/money.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
/** 집 실루엣: 단독(지붕 있는 낮은 집) · 건물(층 수만큼 창 줄) */
export function houseSVG(q, w = 70) {
  if (q.house) return `<svg viewBox="0 0 70 54" width="${w}" height="${(w * 54) / 70}"><path d="M8 28 L35 8 L62 28 V50 H8 Z" fill="#e9dcc0" stroke="#6a5a40"/><rect x="29" y="34" width="12" height="16" fill="#8a6a4a"/><rect x="14" y="32" width="9" height="8" fill="#9fd8ff"/><rect x="47" y="32" width="9" height="8" fill="#9fd8ff"/></svg>`;
  const n = Math.min(12, q.floors), h = 8 + n * 3.6;
  let wins = '';
  for (let i = 0; i < n; i++) for (let j = 0; j < 3; j++) wins += `<rect x="${24 + j * 8}" y="${52 - 6 - i * 3.6}" width="5" height="2" fill="${(i + j) % 4 ? '#9fd8ff' : '#ffd27a'}"/>`;
  return `<svg viewBox="0 0 70 54" width="${w}" height="${(w * 54) / 70}"><rect x="20" y="${52 - h}" width="30" height="${h}" fill="#c8d0dc" stroke="#4a5060"/>${wins}<rect x="31" y="46" width="8" height="6" fill="#4a5060"/></svg>`;
}

export function openBoard(game, { title, listings, onPin }) {
  const el = document.createElement('div');
  el.className = 'lboard';
  el.innerHTML = `<div class="lb-head"><b>${esc(title)}</b><span>오늘 나온 집 ${listings.length}곳 · 계약은 중개 책상에서</span></div><div class="lb-felt">${listings.map((q, i) => `<div class="lb-card" data-i="${i}" style="--r:${((i * 37) % 7) - 3}deg"><i class="lb-pin"></i>${houseSVG(q)}<b>${esc(q.name)}</b><small>${q.house ? '단독 집' : `${q.floors}층 건물의 한 집`} · ${q.d} m</small><em>이레 ${esc(won(q.rent))}</em><button class="lb-go">나침반에 꽂기</button></div>`).join('') || '<p class="lb-none">오늘은 나온 집이 없어요</p>'}</div><button class="lb-leave">물러서기 (Esc)</button>`;
  el.querySelectorAll('.lb-card').forEach((c) => c.addEventListener('click', (e) => {
    const q = listings[+c.dataset.i];
    if (e.target.closest('.lb-go')) { onPin(q); c.classList.add('pinned'); c.querySelector('.lb-go').textContent = '꽂았어요'; return; }
    el.querySelectorAll('.lb-card.up').forEach((x) => x !== c && x.classList.remove('up'));
    c.classList.toggle('up');
  }));
  el.querySelector('.lb-leave').addEventListener('click', () => lay.close());
  const lay = game.ui.mount(el, { cls: 'dev-board' });
  return lay;
}
