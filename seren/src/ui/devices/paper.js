// 종이 문법 (v24 「기기별 UI」): 창구의 전표 · 재단 주문서 · 집 계약서처럼 사람과 사람 사이에 오가는 종이.
//  · 놓인 자리(surface): counter 창구 대리석 · desk 나무 책상 · cloth 재단대 천. 위쪽에 창구 너머 사람의 말풍선 한 줄.
//  · 종이 묶음(pads): 창구 위에 놓인 여러 장의 빈 종이 (입금표·출금표…) — 하나를 집으면 그 종이가 앞에 놓인다.
//  · 종이: 인쇄된 머리글(기관 · 이름 · 번호) · 밑줄 칸(값은 손글씨) · 고르는 칸(동그라미 치기) · 약관 · 서명란(눌러 서명 → 제출)
//    → 받은 쪽이 도장을 찍고(빨간 원) 한 줄로 답한다 · 결과가 틀리면 종이를 돌려준다(빨간 줄).
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let SEQ = 1000;

/**
 * openPaper(game, { surface, org, who, line, pads: [{ id, label, color, form: () => FORM }], form: FORM, onClose })
 * FORM = { title, no?, fields: [{ key, label, type: 'amount'|'pick'|'show'|'text', value, max, unit, options: [{ v, t, sub, swatch }] }],
 *          terms?: [문장], sign: '서명' 단추 글, submit(values) → { ok, stamp, say, keep } }
 */
export function openPaper(game, o) {
  const el = document.createElement('div');
  el.className = `paper-desk surf-${o.surface || 'counter'}`;
  el.innerHTML = `<div class="pd-window"><b>${esc(o.org || '')}</b><span class="pd-who">${esc(o.who || '')}</span><p class="pd-say">${esc(o.line || '')}</p></div>
    <div class="pd-top">${(o.pads || []).map((p, i) => `<button class="pd-pad" data-pad="${i}" style="--pc:${p.color || '#f4efe2'}"><i></i><i></i><b>${esc(p.label)}</b></button>`).join('')}</div>
    <div class="pd-sheet-slot"></div><button class="pd-leave">자리 떠나기 (Esc)</button>`;
  const slot = el.querySelector('.pd-sheet-slot'), say = el.querySelector('.pd-say');
  const speak = (t) => { say.textContent = t; say.classList.remove('pop'); void say.offsetWidth; say.classList.add('pop'); };
  const sheet = (F) => {
    const vals = {};
    for (const f of F.fields) vals[f.key] = f.value ?? (f.type === 'pick' && f.options && f.options[0] ? f.options[0].v : f.type === 'amount' ? '' : '');
    const no = F.no || `No. ${++SEQ}`;
    const draw = () => {
      slot.innerHTML = `<div class="sheet"><div class="sh-head"><span>${esc(o.org || '')}</span><b>${esc(F.title)}</b><small>${esc(no)}</small></div>
        ${F.fields.map((f) => {
          if (f.type === 'pick') return `<div class="sh-f pick"><label>${esc(f.label)}</label><div class="sh-opts">${(f.options || []).map((op, i) => `<button class="sh-opt${vals[f.key] === op.v ? ' on' : ''}" data-k="${esc(f.key)}" data-i="${i}">${op.swatch ? `<i style="background:${op.swatch}"></i>` : ''}${esc(op.t)}${op.sub ? `<small>${esc(op.sub)}</small>` : ''}</button>`).join('') || '<em>고를 것이 없어요</em>'}</div></div>`;
          if (f.type === 'amount') return `<div class="sh-f"><label>${esc(f.label)}</label><span class="sh-line"><input class="sh-hand" data-k="${esc(f.key)}" inputmode="numeric" value="${esc(vals[f.key])}" placeholder="${f.max != null ? `~${esc(Math.floor(f.max * 100) / 100)}` : ''}"><em>${esc(f.unit || '울')}</em></span></div>`;
          if (f.type === 'text') return `<div class="sh-f"><label>${esc(f.label)}</label><span class="sh-line"><input class="sh-hand" data-k="${esc(f.key)}" value="${esc(vals[f.key])}"></span></div>`;
          return `<div class="sh-f"><label>${esc(f.label)}</label><span class="sh-line"><span class="sh-hand">${esc(typeof f.value === 'function' ? f.value(vals) : f.value)}</span></span></div>`;
        }).join('')}
        ${F.terms ? `<ol class="sh-terms">${F.terms.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>` : ''}
        <div class="sh-sign"><span>서명</span><button class="sh-signbox" title="눌러서 서명">${esc(F.sign || '여기에 서명')}</button></div><div class="sh-stamp"></div></div>`;
      slot.querySelectorAll('.sh-opt').forEach((b) => b.addEventListener('click', () => { const f = F.fields.find((q) => q.key === b.dataset.k); vals[f.key] = f.options[+b.dataset.i].v; draw(); }));
      slot.querySelectorAll('input.sh-hand').forEach((inp) => { inp.addEventListener('input', () => { vals[inp.dataset.k] = inp.value; F.fields.filter((f) => f.type === 'show' && typeof f.value === 'function').forEach(() => {}); }); inp.addEventListener('keydown', (e) => e.stopPropagation()); });
      slot.querySelector('.sh-signbox').addEventListener('click', () => {
        const box = slot.querySelector('.sh-signbox');
        box.innerHTML = '<svg viewBox="0 0 120 30"><path d="M4 22 C 18 2, 26 30, 40 14 S 60 4, 70 20 S 96 26, 116 8" /></svg>';
        box.disabled = true;
        const r = F.submit(vals) || { ok: false };
        setTimeout(() => {
          const stp = slot.querySelector('.sh-stamp');
          stp.className = `sh-stamp ${r.ok ? 'ok' : 'no'}`;
          stp.textContent = r.stamp || (r.ok ? '접수' : '돌려줌');
          if (r.say) speak(r.say);
          game.audio && game.audio.blip && game.audio.blip({ hz: r.ok ? 220 : 160, to: r.ok ? 180 : 120, dur: 0.12, gain: 0.07, bus: 'ui' });
          if (!r.keep) setTimeout(() => { slot.innerHTML = ''; if (o.after) o.after(r); }, r.ok ? 1400 : 1800);
        }, 380);
      });
    };
    draw();
  };
  el.querySelectorAll('.pd-pad').forEach((b) => b.addEventListener('click', () => { const p = o.pads[+b.dataset.pad]; const F = p.form(); if (F) sheet(F); }));
  el.querySelector('.pd-leave').addEventListener('click', () => layer.close());
  const layer = game.ui.mount(el, { cls: 'dev-paper', onClose: o.onClose });
  layer.speak = speak; layer.sheet = sheet;
  if (o.form) sheet(o.form);
  return layer;
}
