// 시설지기 곁의 손 기기 (v24 「기기별 UI」):
//  · workbench: 공방의 공명 용광로 작업대 — 장비 부품이 받침 위에 놓여 있고(날개·썰매·솟음 증폭기·탐지기·목도리), 부품마다 새긴 단계 눈금(●●○).
//    부품을 집으면 망치(새기기) 단추가 그 부품 옆에 붙고, 값(별씨·결정 조각)은 옆 저울 접시에 놓인 만큼만.
//  · hearth: 쉼터의 화롯가 — 해시계 원판(아침·한낮·저녁·밤 네 조각)을 눌러 그때까지 쉬고, 화로 둘레의 노래돌(들른 쉼터)을 눌러 그리로 간다.
//  · beds: 온실 밭 — 흙 상자마다 빈 흙 / 싹(자란 만큼 키) / 활짝 핀 꽃. 누르면 심기·거두기.
import { esc, blip, mountDevice, digitOf } from './common.js';

/** openWorkbench(game, { title, note, mats: [{ name, n, col }], parts: [{ name, desc, lv, max, cost, off, why, icon, on }] }) */
export function openWorkbench(game, o) {
  const el = document.createElement('div');
  el.className = 'wbench';
  const pips = (p) => `${'●'.repeat(p.lv)}${'○'.repeat(Math.max(0, p.max - p.lv))}`;
  el.innerHTML = `<div class="wb-head"><b>${esc(o.title)}</b><span>${esc(o.note || '')}</span></div>
    <div class="wb-top"><div class="wb-parts">${o.parts.map((p, i) => `<button class="wb-part${p.off ? ' off' : ''}" data-i="${i}"><i>${esc(p.icon || '◇')}</i><b>${esc(p.name)}</b><em>${pips(p)}</em><small>${esc(p.off && p.why ? p.why : p.desc)}</small><span class="wb-cost">${esc(p.cost || '')}</span></button>`).join('')}</div>
    <div class="wb-scale"><small>가진 재료</small>${o.mats.map((m) => `<span style="--c:${m.col || '#ffe2a0'}"><i></i>${esc(m.name)} <b>${m.n}</b></span>`).join('')}<div class="wb-furnace"><i></i></div></div></div>
    <div class="wb-act"><span class="wb-msg">부품을 골라요</span><button class="wb-hammer" disabled>🔨 새기기</button><button class="wb-leave">물러서기 (Esc)</button></div>`;
  const msg = el.querySelector('.wb-msg'), hammer = el.querySelector('.wb-hammer');
  let sel = -1;
  const choose = (i) => { const p = o.parts[i]; if (!p) return; sel = i; el.querySelectorAll('.wb-part').forEach((b, j) => b.classList.toggle('sel', j === i)); hammer.disabled = !!p.off; msg.textContent = p.off ? (p.why || '지금은 손볼 수 없어요') : `${p.name} — ${p.cost}`; blip(game, 'click'); };
  const strike = () => { const p = o.parts[sel]; if (!p || p.off) { blip(game, 'no'); return; } el.classList.add('strike'); blip(game, 'press'); setTimeout(() => { lay.close(); p.on(); }, 420); };
  el.querySelectorAll('.wb-part').forEach((b) => b.addEventListener('click', () => choose(+b.dataset.i)));
  hammer.addEventListener('click', strike);
  el.querySelector('.wb-leave').addEventListener('click', () => lay.close());
  const lay = mountDevice(game, el, { cls: 'dev-bench', keys: (e) => { const d = digitOf(e); if (d >= 0 && d < o.parts.length) { choose(d); return true; } if (e.key === 'e' || e.key === 'E' || e.key === 'Enter') { strike(); return true; } return false; } });
  lay.acts = o.parts.map((p, i) => ({ label: p.name, off: !!p.off, run: () => { choose(i); strike(); } }));
  return lay;
}

/** openHearth(game, { title, note, times: [{ label, frac }], rest(frac), now (0..1), stones: [{ name, sub, on }], empty }) */
export function openHearth(game, o) {
  const el = document.createElement('div');
  el.className = 'hearth';
  const R = 80, cx = 100, cy = 100;
  const seg = (k, n) => { const a0 = (k / n) * Math.PI * 2 - Math.PI / 2, a1 = ((k + 1) / n) * Math.PI * 2 - Math.PI / 2; return `M${cx} ${cy} L${cx + Math.cos(a0) * R} ${cy + Math.sin(a0) * R} A${R} ${R} 0 0 1 ${cx + Math.cos(a1) * R} ${cy + Math.sin(a1) * R} Z`; };
  const mid = (k, n) => { const a = ((k + 0.5) / n) * Math.PI * 2 - Math.PI / 2; return [cx + Math.cos(a) * R * 0.62, cy + Math.sin(a) * R * 0.62]; };
  const COL = ['#ffd8a0', '#fff2b0', '#ffb070', '#5a5a9a'];
  const hand = (o.now ?? 0) * Math.PI * 2 - Math.PI / 2;
  el.innerHTML = `<div class="ht-head"><b>${esc(o.title)}</b><span>${esc(o.note || '')}</span></div>
    <div class="ht-row"><div class="ht-dial"><small>해시계 — 언제까지 쉴까요?</small><svg viewBox="0 0 200 200">${o.times.map((t, k) => `<path class="ht-seg" data-k="${k}" d="${seg(k, o.times.length)}" fill="${COL[k % 4]}"/><text x="${mid(k, o.times.length)[0]}" y="${mid(k, o.times.length)[1] + 5}" text-anchor="middle">${esc(t.label)}</text>`).join('')}<line x1="${cx}" y1="${cy}" x2="${cx + Math.cos(hand) * R * 0.95}" y2="${cy + Math.sin(hand) * R * 0.95}" stroke="#3a2010" stroke-width="3" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="6" fill="#3a2010"/></svg></div>
    <div class="ht-fire"><div class="ht-flame"><i></i><i></i><i></i></div><div class="ht-stones">${o.stones.map((s, i) => `<button class="ht-stone" data-i="${i}" style="--a:${(i / Math.max(1, o.stones.length)) * 360}deg"><b>${esc(s.name)}</b><small>${esc(s.sub || '')}</small></button>`).join('') || `<p class="ht-none">${esc(o.empty || '')}</p>`}</div><small>화로 둘레의 노래돌 — 들른 쉼터로 이어져 있어요</small></div></div>
    <button class="ht-leave">화롯가에서 일어서기 (Esc)</button>`;
  el.querySelectorAll('.ht-seg').forEach((p) => p.addEventListener('click', () => { const t = o.times[+p.dataset.k]; blip(game, 'ok'); lay.close(); o.rest(t.frac); }));
  el.querySelectorAll('.ht-stone').forEach((b) => b.addEventListener('click', () => { const s = o.stones[+b.dataset.i]; blip(game, 'ok'); lay.close(); s.on(); }));
  el.querySelector('.ht-leave').addEventListener('click', () => lay.close());
  const lay = mountDevice(game, el, { cls: 'dev-hearth', keys: (e) => { const d = digitOf(e); if (d >= 0 && d < o.times.length) { el.querySelector(`.ht-seg[data-k="${d}"]`).dispatchEvent(new Event('click')); return true; } return false; } });
  lay.acts = [...o.times.map((t, k) => ({ label: `${t.label}까지 쉬기`, off: false, run: () => el.querySelector(`.ht-seg[data-k="${k}"]`).dispatchEvent(new Event('click')) })), ...o.stones.map((st, i) => ({ label: st.name, off: false, run: () => el.querySelector(`.ht-stone[data-i="${i}"]`).click() }))];
  return lay;
}

/** openBeds(game, { title, note, beds: [{ state: 'empty'|'grow'|'ripe', pct, label, sub, off, why, on }] }) */
export function openBeds(game, o) {
  const el = document.createElement('div');
  el.className = 'beds';
  const plant = (b) => (b.state === 'empty' ? '<i class="bd-soil"></i>' : b.state === 'grow' ? `<i class="bd-sprout" style="--h:${Math.max(8, Math.round(b.pct * 60))}px"></i>` : '<i class="bd-bloom"><b></b><b></b><b></b></i>');
  el.innerHTML = `<div class="bd-head"><b>${esc(o.title)}</b><span>${esc(o.note || '')}</span></div><div class="bd-row">${o.beds.map((b, i) => `<button class="bd-box ${b.state}${b.off ? ' off' : ''}" data-i="${i}"><span class="bd-plant">${plant(b)}</span><b>${esc(b.label)}</b><small>${esc(b.off && b.why ? b.why : b.sub || '')}</small></button>`).join('')}</div><button class="bd-leave">물러서기 (Esc)</button>`;
  el.querySelectorAll('.bd-box').forEach((bx) => bx.addEventListener('click', () => { const b = o.beds[+bx.dataset.i]; if (b.off || !b.on) { blip(game, 'no'); return; } blip(game, 'ok'); lay.close(); b.on(); }));
  el.querySelector('.bd-leave').addEventListener('click', () => lay.close());
  const lay = mountDevice(game, el, { cls: 'dev-beds', keys: (e) => { const d = digitOf(e); if (d >= 0 && d < o.beds.length) { el.querySelector(`.bd-box[data-i="${d}"]`).click(); return true; } return false; } });
  lay.acts = o.beds.map((b, i) => ({ label: b.label, off: !!b.off || !b.on, run: () => el.querySelector(`.bd-box[data-i="${i}"]`).click() }));
  return lay;
}
