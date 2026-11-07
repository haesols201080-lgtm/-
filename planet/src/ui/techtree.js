// Research as a tech tree that is uncovered as you go. Technologies run left
// to right by how deep their prerequisites go, joined by lines from what they
// need to what they open. Researched and researchable techs are shown in full;
// the ring just beyond is sealed ("미확인 기술"), and everything further is
// still in the dark. Picking a tech shows what it unlocks; aiming at a sealed
// one queues its missing path, which then runs in order on its own.
import { RESEARCH, BUILDINGS, RECIPES, TIERS, ITEMS } from '../sim/data.js';
import { itemIcon } from './icons.js';

const NW = 200, NH = 66, CX = 262, RY = 88, PAD = 26;
const ERA_COL = ['#e9b46a', '#7fd6ff', '#5fd3a8', '#b39bff', '#ffe27a'];
const ERA_NAME = ['개척', '정착', '마을', '도시', '문명'];
const LOCK = '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1.5" fill="currentColor"/><path d="M5 7 V5 a3 3 0 0 1 6 0 V7" stroke="currentColor" stroke-width="1.6" fill="none"/></svg>';
const FLASK = '<svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true"><path d="M12 5 h8 M14 5 v8 L7 25 a2 2 0 0 0 2 3 h14 a2 2 0 0 0 2-3 L18 13 V5" stroke="#9fb4bd" stroke-width="1.8" fill="none"/><path d="M10 21 h12 l3 5 H7 Z" fill="#c49bff" fill-opacity=".55"/></svg>';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let LAYOUT = null;
// columns by prerequisite depth; inside a column, nodes sit level with what
// they need where there is room, so the lines read straight across
function layout() {
  if (LAYOUT) return LAYOUT;
  const by = Object.fromEntries(RESEARCH.map((r) => [r.id, r]));
  const depth = {};
  const dep = (id) => depth[id] ?? (depth[id] = by[id].req.length ? 1 + Math.max(...by[id].req.map(dep)) : 0);
  RESEARCH.forEach((r) => dep(r.id));
  const kids = {};
  RESEARCH.forEach((r) => r.req.forEach((q) => (kids[q] = kids[q] || []).push(r.id)));
  const cols = [];
  RESEARCH.forEach((r) => (cols[depth[r.id]] = cols[depth[r.id]] || []).push(r.id));
  const row = {};
  cols.forEach((c) => c.forEach((id, i) => { row[id] = i; }));
  const mean = (ids) => (ids.length ? ids.reduce((s, q) => s + row[q], 0) / ids.length : null);
  for (let pass = 0; pass < 8; pass++) {
    const back = pass % 2 === 1;
    const order = back ? [...cols.keys()].reverse() : [...cols.keys()];
    for (const ci of order) {
      const key = (id) => (back ? mean(kids[id] || []) : mean(by[id].req)) ?? row[id];
      cols[ci].sort((a, b) => key(a) - key(b));
      cols[ci].forEach((id, i) => { row[id] = i; });
    }
  }
  // vertical placement: aim each node at its prerequisites' height, keep spacing
  const y = {};
  cols.forEach((c, ci) => {
    const want = c.map((id, i) => (ci && by[id].req.length ? by[id].req.reduce((s, q) => s + y[q], 0) / by[id].req.length : i * RY));
    const out = [];
    want.forEach((w, i) => { out[i] = i ? Math.max(w, out[i - 1] + RY) : w; });
    const shift = want.reduce((s, w, i) => s + (w - out[i]), 0) / want.length;
    c.forEach((id, i) => { y[id] = out[i] + shift; });
    // never above the top row
    const top = Math.min(...c.map((id) => y[id]));
    if (top < 0) c.forEach((id) => { y[id] -= top; });
  });
  const minY = Math.min(...Object.values(y));
  const pos = {};
  RESEARCH.forEach((r) => { pos[r.id] = { x: PAD + depth[r.id] * CX, y: PAD + 22 + (y[r.id] - minY) }; });
  const W = PAD * 2 + (cols.length - 1) * CX + NW, H = Math.max(...Object.values(pos).map((p) => p.y)) + NH + PAD;
  LAYOUT = { pos, cols, kids, depth, W, H };
  return LAYOUT;
}

function unlocksOf(id) {
  const blds = Object.entries(BUILDINGS).filter(([, d]) => d.research === id && !d.hidden).map(([type, d]) => ({ type, name: d.name }));
  const recs = RECIPES.filter((r) => r.research === id);
  const tiers = TIERS.map((t, i) => ({ t, i })).filter(({ t }) => t.upgrade && t.upgrade.research === id).map(({ t, i }) => ({ from: TIERS[i - 1].name, to: t.name, color: t.color, stage: t.upgrade.stage }));
  return { blds, recs, tiers };
}

export function techTreePanel(ui, panel) {
  const g = ui.game, R = g.research, L = layout();
  const byId = (id) => RESEARCH.find((r) => r.id === id);
  panel.classList.add('techp');
  const body = ui.header(panel, '연구', '<span class="tt-stat"></span>');
  body.innerHTML = `<div class="tt-main">
      <div class="tt-legend"><span class="tt-eras"></span>
        <span class="tt-key"><em class="k-done"></em>완료 <em class="k-av"></em>연구 가능 <em class="k-seal"></em>미확인</span><span class="tt-hint">드래그·휠로 이동 · 기술을 누르면 자세히</span></div>
      <div class="tt-wrap"><div class="tt-canvas">
        <div class="tt-cols"></div><svg class="tt-edges"></svg><div class="tt-fog"><span>미탐사</span></div><div class="tt-nodes"></div></div></div>
    </div>
    <aside class="tt-side"></aside>`;
  const wrap = body.querySelector('.tt-wrap'), canvas = body.querySelector('.tt-canvas'), svg = body.querySelector('.tt-edges'), nodes = body.querySelector('.tt-nodes'), side = body.querySelector('.tt-side');
  const fog = body.querySelector('.tt-fog'), colsEl = body.querySelector('.tt-cols'), erasEl = body.querySelector('.tt-eras');
  const stat = panel.querySelector('.tt-stat');

  // what the colony knows: researched and researchable techs in full, the
  // next ring as sealed cards, nothing beyond
  const known = (id) => R.has(id) || R.available(id);
  const vis = (id) => (known(id) ? 'known' : byId(id).req.every(known) ? 'sealed' : 'hidden');
  let sel = R.current || R.nextFromQueue() || RESEARCH.find((r) => R.available(r.id))?.id || RESEARCH[0].id;
  if (vis(sel) === 'hidden') sel = RESEARCH.find((r) => R.available(r.id))?.id || RESEARCH[0].id;

  const state = (id) => (R.has(id) ? 'done' : R.current === id ? 'cur' : R.available(id) ? (R.queue.includes(id) ? 'avail queued' : 'avail') : R.queue.includes(id) ? 'lock queued' : 'lock');
  const icon = (id) => {
    const u = unlocksOf(id);
    if (u.blds.length) return `<img alt="" src="${g.thumbs.get(u.blds[0].type)}">`;
    const rec = u.recs[0];
    if (rec) return itemIcon(Object.keys(rec.out)[0], 34);
    return FLASK;
  };
  const chain = (id) => {
    const s = new Set([id]);
    const up = (q) => { for (const p of byId(q).req) if (!s.has(p)) { s.add(p); up(p); } };
    const down = (q) => { for (const k of L.kids[q] || []) if (!s.has(k)) { s.add(k); down(k); } };
    up(id); down(id);
    return s;
  };
  // a sealed tech can be aimed at: every prerequisite is at least researchable
  const reachable = (id) => byId(id).req.every(known);

  const drawTree = () => {
    const V = {};
    RESEARCH.forEach((r) => { V[r.id] = vis(r.id); });
    const shown = RESEARCH.filter((r) => V[r.id] !== 'hidden');
    const maxX = Math.max(...shown.map((r) => L.pos[r.id].x)) + NW;
    const W = Math.max(maxX + CX * 1.1 + PAD, wrap.clientWidth / (parseFloat(getComputedStyle(canvas).zoom) || 1));
    canvas.style.width = W + 'px'; canvas.style.height = L.H + 'px';
    svg.setAttribute('width', W); svg.setAttribute('height', L.H);
    fog.style.left = (maxX + 40) + 'px';
    const colsShown = new Set(shown.map((r) => L.depth[r.id]));
    colsEl.innerHTML = [...colsShown].map((ci) => `<span style="left:${PAD + ci * CX}px">${ci + 1}</span>`).join('');
    const eras = new Set(shown.filter((r) => V[r.id] === 'known').map((r) => r.era));
    erasEl.innerHTML = ERA_NAME.map((n, i) => `<span><i style="background:${ERA_COL[i]}"></i>${i + 1}. ${eras.has(i + 1) ? n : '???'}</span>`).join('');
    const hl = chain(sel);
    const edges = [];
    for (const r of shown) for (const q of r.req) {
      if (V[q] === 'hidden') continue;
      const a = L.pos[q], b = L.pos[r.id];
      const x1 = a.x + NW, y1 = a.y + NH / 2, x2 = b.x, y2 = b.y + NH / 2, mx = (x1 + x2) / 2;
      const cls = (R.has(r.id) ? 'done' : R.has(q) ? 'on' : 'off') + (hl.has(q) && hl.has(r.id) ? ' hl' : '');
      edges.push(`<path class="${cls}" d="M${x1} ${y1} C${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}"/>`);
    }
    // where the tree runs on into the dark, a short trail of dots
    for (const r of shown) if ((L.kids[r.id] || []).some((k) => V[k] === 'hidden')) {
      const a = L.pos[r.id], x1 = a.x + NW, y1 = a.y + NH / 2;
      edges.push(`<path class="stub" d="M${x1} ${y1} L${x1 + 46} ${y1}"/><circle class="stub" cx="${x1 + 54}" cy="${y1}" r="2"/><circle class="stub" cx="${x1 + 62}" cy="${y1}" r="2"/><circle class="stub" cx="${x1 + 70}" cy="${y1}" r="2"/>`);
    }
    svg.innerHTML = edges.join('');
    nodes.innerHTML = shown.map((r) => {
      const p = L.pos[r.id];
      if (V[r.id] === 'sealed') {
        const need = r.req.filter((q) => !R.has(q) && known(q)).map((q) => R.name(q));
        return `<button class="tt-node sealed${r.id === sel ? ' sel' : ''}${R.queue.includes(r.id) ? ' queued' : ''}" data-id="${r.id}" style="left:${p.x}px;top:${p.y}px;--era:${ERA_COL[r.era - 1]}">
          <span class="ic"><b class="q">?</b></span><span class="tx"><b>미확인 기술</b><small>${LOCK} ${need.length ? esc(need.join(' · ')) + ' 완료 시 공개' : '선행 기술을 더 연구해야 합니다'}</small></span></button>`;
      }
      const st = state(r.id), prog = Math.min(1, (R.progress[r.id] || 0) / r.cost);
      const qi = R.queue.indexOf(r.id);
      const sub = R.has(r.id) ? '완료' : `${Math.floor(R.progress[r.id] || 0)} / ${r.cost}${R.eureka.has(r.id) ? ' · 유레카' : ''}`;
      return `<button class="tt-node ${st}${r.id === sel ? ' sel' : ''}${hl.has(r.id) ? ' chain' : ''}" data-id="${r.id}" style="left:${p.x}px;top:${p.y}px;--era:${ERA_COL[r.era - 1]}">
        <span class="ic">${icon(r.id)}</span><span class="tx"><b>${esc(r.name)}</b><small>${sub}</small><i class="bar"><u style="width:${(R.has(r.id) ? 1 : prog) * 100}%"></u></i></span>${qi >= 0 && !R.has(r.id) ? `<em class="qn">${qi + 1}</em>` : ''}</button>`;
    }).join('');
    nodes.querySelectorAll('.tt-node').forEach((n) => {
      n.onclick = () => { if (dragged) return; sel = n.dataset.id; render(); focus(sel); };
      n.ondblclick = () => { sel = n.dataset.id; start(sel); };
    });
  };

  const start = (id) => {
    if (R.has(id)) return;
    if (vis(id) === 'sealed' && !reachable(id)) return;
    const wasAvail = R.available(id);
    const path = R.plan(id);
    R.target(id);
    ui.toast(wasAvail ? `${R.name(id)} 연구 시작` : vis(id) === 'sealed' ? `미확인 기술까지 ${path.length}단계 연구 예약` : `${R.name(id)}까지 ${path.length}단계 연구 예약`, 'info');
    render();
  };

  const drawSide = () => {
    const r = byId(sel);
    const chipFor = (q) => (vis(q) === 'known' ? `<button class="chip ${R.has(q) ? 'ok' : ''}" data-go="${q}">${R.has(q) ? '✓ ' : ''}${esc(R.name(q))}</button>` : vis(q) === 'sealed' ? `<button class="chip seal" data-go="${q}">? 미확인 기술</button>` : '<span class="chip seal">???</span>');
    if (vis(sel) === 'sealed') {
      const ok = reachable(sel), path = R.plan(sel);
      side.innerHTML = `<div class="tt-h" style="--era:${ERA_COL[r.era - 1]}"><small>${R.has(r.req[0]) || r.req.some(known) ? '선행 연구 너머의 기술' : ''}</small><h3>미확인 기술</h3></div>
        <p class="d">아직 무엇인지 모릅니다. 선행 연구를 모두 마치면 정체와 해금 내용이 드러납니다.</p>
        ${ok ? `<button class="pri go">경로 예약 · ${path.length}단계</button>` : '<button class="pri" disabled>선행 기술 중 아직 모르는 것이 있습니다</button>'}
        <h4>선행 연구</h4><div class="chips">${r.req.map(chipFor).join('')}</div>
        ${R.queue.length ? `<p class="qinfo">예약된 연구 ${R.queue.filter((q) => !R.has(q)).length}개가 순서대로 진행됩니다. <button class="link clr">예약 취소</button></p>` : ''}
        <p class="foot">연구를 마칠 때마다 다음 기술이 드러납니다. 고대 유적을 조사하면 무작위 기술에 「유레카」(비용 50%)가 붙습니다.</p>`;
    } else {
      const st = state(sel), u = unlocksOf(sel);
      const prog = Math.min(1, (R.progress[sel] || 0) / r.cost);
      const reqs = r.req.map(chipFor).join('') || '<span class="none">없음 — 바로 연구할 수 있습니다</span>';
      const nextIds = L.kids[sel] || [];
      const next = nextIds.map(chipFor).join('') || '<span class="none">마지막 기술</span>';
      const list = [
        ...u.blds.map((b) => `<li><img alt="" src="${g.thumbs.get(b.type)}"><span><b>${esc(b.name)}</b><small>${esc(BUILDINGS[b.type].desc).slice(0, 70)}${BUILDINGS[b.type].desc.length > 70 ? '…' : ''}</small></span></li>`),
        ...u.recs.map((rc) => { const out = Object.keys(rc.out)[0]; return `<li><span class="ri">${itemIcon(out, 30)}</span><span><b>제작법 · ${esc(rc.name)}</b><small>${Object.entries(rc.in).map(([k, n]) => `${n} ${esc(itemName(k))}`).join(' + ')} → ${Object.entries(rc.out).map(([k, n]) => `${n} ${esc(itemName(k))}`).join(', ')}</small></span></li>`; }),
        ...u.tiers.map((t) => `<li><span class="ri tier" style="background:${t.color}"></span><span><b>주거 업그레이드 · ${esc(t.from)} → ${esc(t.to)}</b><small>${t.stage ? '숨쉬는 대기 단계 이후' : '조건을 채운 집이 자동으로 올라갑니다'}</small></span></li>`),
      ].join('') || '<li class="none">해금되는 시설 없음</li>';
      const path = R.has(sel) ? [] : R.plan(sel);
      const btn = st === 'done' ? '<button class="pri" disabled>연구 완료</button>'
        : st === 'cur' ? `<button class="pri" disabled>연구 중 · ${Math.round(prog * 100)}%</button>`
          : '<button class="pri go">연구 시작</button>';
      side.innerHTML = `<div class="tt-h" style="--era:${ERA_COL[r.era - 1]}"><small>${r.era}. ${ERA_NAME[r.era - 1]} · 비용 ${r.cost}</small><h3>${esc(r.name)}</h3></div>
        <p class="d">${esc(r.desc)}</p>
        <div class="pbar"><i style="width:${(R.has(sel) ? 1 : prog) * 100}%"></i></div>
        <div class="pnum">${R.has(sel) ? '완료' : `${Math.floor(R.progress[sel] || 0)} / ${r.cost}`}${R.eureka.has(sel) ? ' · 유레카 (비용 절반 지급)' : ''}</div>
        ${btn}
        ${path.length > 1 ? `<div class="path"><small>연구 순서</small>${path.map((q, i) => `<span class="${R.available(q) ? 'av' : ''}">${i + 1}. ${esc(R.name(q))}</span>`).join('')}</div>` : ''}
        <h4>해금</h4><ul class="un">${list}</ul>
        <h4>선행 연구</h4><div class="chips">${reqs}</div>
        <h4>다음으로 이어지는 연구</h4><div class="chips">${next}</div>
        ${R.queue.length ? `<p class="qinfo">예약된 연구 ${R.queue.filter((q) => !R.has(q)).length}개가 순서대로 진행됩니다. <button class="link clr">예약 취소</button></p>` : ''}
        <p class="foot">연구를 마칠 때마다 다음 기술이 드러납니다. 연구 점수는 연구 단말기·연구소·대학, 테라포밍 단계 달성, 잔해 탐색에서 얻습니다.</p>`;
    }
    const go = side.querySelector('.go');
    if (go) go.onclick = () => start(sel);
    side.querySelectorAll('[data-go]').forEach((b) => b.onclick = () => { sel = b.dataset.go; render(); focus(sel); });
    const clr = side.querySelector('.clr');
    if (clr) clr.onclick = () => { R.queue = []; render(); };
  };

  const render = () => {
    stat.textContent = `연구 속도 ${R.rate.toFixed(2)}/s · 보유 ${Math.floor(R.points)}${R.current ? ' · 진행 중: ' + R.name(R.current) : ''}`;
    if (vis(sel) === 'hidden') sel = RESEARCH.find((r) => R.available(r.id))?.id || sel;
    drawTree(); drawSide();
  };
  const focus = (id, instant) => {
    const p = L.pos[id], z = parseFloat(getComputedStyle(canvas).zoom) || 1;
    wrap.scrollTo({ left: (p.x + NW / 2) * z - wrap.clientWidth / 2, top: (p.y + NH / 2) * z - wrap.clientHeight / 2, behavior: instant ? 'auto' : 'smooth' });
  };

  // drag to pan, wheel scrolls sideways
  let drag = null, dragged = false;
  wrap.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch' || e.button !== 0) return;          // touch pans natively
    drag = { x: e.clientX, y: e.clientY, l: wrap.scrollLeft, t: wrap.scrollTop, id: e.pointerId }; dragged = false;
  });
  wrap.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!dragged && Math.abs(dx) + Math.abs(dy) > 5) { dragged = true; wrap.classList.add('drag'); wrap.setPointerCapture(drag.id); }
    if (dragged) { wrap.scrollLeft = drag.l - dx; wrap.scrollTop = drag.t - dy; }
  });
  const end = () => { drag = null; wrap.classList.remove('drag'); setTimeout(() => { dragged = false; }, 0); };
  wrap.addEventListener('pointerup', end);
  wrap.addEventListener('pointercancel', end);
  wrap.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && wrap.scrollHeight <= wrap.clientHeight + 4) { wrap.scrollLeft += e.deltaY; e.preventDefault(); }
  }, { passive: false });

  render();
  requestAnimationFrame(() => focus(sel, true));
  let t = 0;
  ui.panelRefresh = () => { if ((t++ % 6) === 0) render(); };
}

function itemName(id) { return ITEMS[id]?.name || id; }
