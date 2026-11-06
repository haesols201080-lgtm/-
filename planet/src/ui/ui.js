// HUD and menus. Plain DOM, updated a few times per second (compass and
// prompt every frame). Menus release the pointer lock.
import * as THREE from 'three';
import { ITEMS, BUILDINGS, CATEGORIES, RECIPES, STAGES, PARAMS, TIERS, ERAS, RESEARCH, MILESTONES, fmtTi } from '../sim/data.js';
import { itemIcon, CREDIT_ICON, paramIcon } from './icons.js';
import { U, WORLD } from '../core/shared.js';
import { QUALITY } from '../core/engine.js';

const $ = (sel, root = document) => root.querySelector(sel);
const h = (tag, attrs = {}, html = '') => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); e.innerHTML = html; return e; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class UI {
  constructor(game) {
    this.game = game;
    this.root = $('#ui');
    this.panel = null;
    this.t = 0;
    this._dirty = true;
    this.buildCat = 'base';
    this.hotbar = ['solar', 'heater', 'drill', 'habitat', 'foundation', 'pylon', 'terminal', 'extractor', 'storage'];
    this.mapView = { cx: 0, cz: 0, scale: 1 };
    this.buildHUD();
  }

  dirty() { this._dirty = true; }

  // ---------------------------------------------------------------- HUD
  buildHUD() {
    const hud = h('div', { id: 'hud' });
    hud.innerHTML = `
      <div id="planet" class="frame"><div class="in">
        <div class="ring"><svg viewBox="0 0 64 64"><circle class="bg" cx="32" cy="32" r="27"/><circle class="tk" cx="32" cy="32" r="30.5"/><circle id="st-ring" class="fg" cx="32" cy="32" r="27" stroke-dasharray="0 170"/></svg>
          <div class="rv"><b id="st-tiv" class="num">0</b><small id="st-tiu">Ti</small></div></div>
        <div class="info">
          <div class="lbl">ARKE <span>· TERRAFORMING</span></div>
          <div class="stage" id="st-name">불모의 대지</div>
          <div class="next" id="st-next"></div>
        </div>
        <div class="params">${Object.keys(PARAMS).map((k) => `
          <div class="param" id="pp-${k}" title="${PARAMS[k].name}"><span class="ic">${paramIcon(k)}</span><span class="v num" id="pv-${k}">0</span><i class="mp"><b id="pm-${k}" style="background:${PARAMS[k].color}"></b></i></div>`).join('')}
        </div>
        <span id="st-ti" hidden></span><span id="st-bar" hidden></span><span id="pr-heat" hidden></span><span id="pr-pressure" hidden></span><span id="pr-oxygen" hidden></span><span id="pr-biomass" hidden></span>
      </div></div>
      <div id="compass"><div class="strip" id="cstrip"></div><div class="center"></div><div class="hdg num" id="hdg">000</div></div>
      <div id="where"></div>
      <div id="colony" class="frame r"><div class="in">
        <div class="lbl"><span id="era">전초기지</span><i></i><span id="clock" class="num">06:00</span></div>
        <div class="stats">
          <span class="st" title="인구"><svg viewBox="0 0 16 16"><circle cx="8" cy="5" r="2.6"/><path d="M3 14c.6-3 2.6-4.6 5-4.6s4.4 1.6 5 4.6"/></svg><b class="num" id="popn">0</b></span>
          <span class="st" title="크레딧" id="credits">0</span>
          <span class="st" title="전력"><svg viewBox="0 0 16 16"><path d="M9 1.5 3.5 9H8l-1 5.5L12.5 7H8z"/></svg><b class="num" id="pow">0/0</b></span>
        </div>
        <div class="pw"><i id="powbar"></i></div>
        <div class="chips" id="tiers"></div>
        <div class="rs"><span id="rsname"></span><div class="pw"><i id="rsbar"></i></div></div>
      </div></div>
      <div id="survival">
        <div class="gauge" id="gv-o2"><span class="lbl">O₂</span><div class="seg"><i id="g-o2"></i></div><span class="num" id="g-o2t">100</span></div>
        <div class="gauge" id="gv-hp"><span class="lbl">HP</span><div class="seg"><i id="g-hp"></i></div><span class="num" id="g-hpt">100</span></div>
        <div class="gauge" id="gv-jet"><span class="lbl">JET</span><div class="seg"><i id="g-jet"></i></div><span class="num" id="g-jett"></span></div>
        <div id="o2note"></div>
      </div>
      <div id="hotbar"></div>
      <div id="mode" hidden></div>
      <div id="cross"><svg class="prog" viewBox="0 0 30 30"><circle id="crossprog" cx="15" cy="15" r="13" fill="none" stroke="#66e0ff" stroke-width="2" stroke-dasharray="0 82" transform="rotate(-90 15 15)"/></svg></div>
      <div id="prompt"></div>
      <div id="objective" class="frame r"></div>
      <div id="waypoint" hidden><i class="d"></i><i class="ar"></i><span></span></div>
      <div id="starthelp" hidden></div>
      <div id="toasts"></div>
      <div id="keys" hidden><div>건설<b>B</b> 가방·제작<b>Tab</b> 연구<b>J</b> 지도<b>M</b></div><div>해체<b>F</b> 지형 도구<b>G</b> 시점<b>V</b> 조명<b>L</b></div><div>상호작용<b>E</b> 채집<b>좌클릭</b> 탐사 로버<b>N</b></div></div>
      <div id="keyhint"><b>H</b>조작 안내</div>
      <div id="lockhint" hidden>화면을 클릭하면 조작을 시작합니다</div>`;
    this.root.appendChild(hud);
    this.hud = hud;
    this.renderHotbar();
  }

  renderHotbar() {
    const hb = $('#hotbar');
    hb.innerHTML = this.hotbar.map((t, i) => {
      const lock = t && !this.game.isUnlocked(t).ok;
      return `<div class="slot ${lock ? 'locked' : ''}" data-i="${i}"><span class="k">${i + 1}</span>${t ? `<img alt="${esc(BUILDINGS[t].name)}" src="${this.game.thumbs.get(t)}">` : ''}</div>`;
    }).join('');
  }

  toast(msg, kind = 'info', dur = 2.5, big = false) {
    const box = $('#toasts');
    const t = h('div', { class: 'toast ' + kind + (big ? ' big' : '') }, msg);
    box.appendChild(t);
    while (box.children.length > 5) box.firstChild.remove();
    setTimeout(() => t.remove(), dur * 1000);
  }

  setPrompt(html) { if (this._prompt !== html) { $('#prompt').innerHTML = html; this._prompt = html; } }
  setProgress(f) { $('#crossprog').setAttribute('stroke-dasharray', `${(f * 82).toFixed(1)} 82`); }

  update(dt) {
    const g = this.game;
    this.updateCompass();
    this.updateWaypoint();
    this.t -= dt;
    if (this.t > 0 && !this._dirty) return;
    this.t = 0.25;
    this._dirty = false;
    const T = g.terra;
    const st = STAGES[T.stage], nx = STAGES[T.stage + 1];
    this.layoutHUD();
    this.renderStartHelp();
    $('#st-name').textContent = st.name;
    const tis = fmtTi(T.ti).split(' ');
    $('#st-tiv').textContent = tis[0];
    $('#st-tiu').textContent = (tis[1] || '') + 'Ti';
    const frac = nx ? (T.stageFloat() - T.stage) : 1;
    $('#st-ring').setAttribute('stroke-dasharray', `${(frac * 169.6).toFixed(1)} 170`);
    $('#st-next').textContent = nx ? `→ ${nx.name} · ${fmtTi(nx.ti)}Ti` : '테라포밍 완료';
    for (const k of Object.keys(PARAMS)) {
      $('#pv-' + k).textContent = fmtTi(T.p[k]) + PARAMS[k].unit;
      $('#pm-' + k).style.width = (T.milestoneFrac(k) * 100).toFixed(0) + '%';
      const nm = MILESTONES[k][T.ms[k]];
      $('#pp-' + k).title = PARAMS[k].name + (nm ? ' · 다음: ' + nm[1] : ' · 모든 단계 달성');
    }
    const C = g.colony;
    $('#era').textContent = ERAS[C.era - 1].name;
    $('#popn').textContent = C.total;
    $('#tiers').innerHTML = TIERS.map((t, i) => C.pop[i] ? `<span class="chip"><i style="background:${t.color}"></i>${t.name} ${C.pop[i]}</span>` : '').join('');
    $('#credits').innerHTML = `${CREDIT_ICON}<b class="num">${Math.floor(C.credits)}</b><small style="color:${C.income >= 0 ? 'var(--good)' : 'var(--bad)'}">${C.income >= 0 ? '+' : ''}${C.income.toFixed(1)}</small>`;
    const P = g.eco.power;
    $('#pow').textContent = `${P.supply.toFixed(1)}/${P.demand.toFixed(1)}kW`;
    $('#powbar').style.width = Math.min(100, P.demand > 0 ? P.supply / P.demand * 100 : (P.supply > 0 ? 100 : 0)) + '%';
    $('#powbar').style.background = P.supply >= P.demand ? 'var(--good)' : 'var(--bad)';
    const R = g.research;
    if (R.current) {
      const r = R.get(R.current);
      $('#rsname').textContent = r.name;
      $('#rsbar').style.width = ((R.progress[r.id] || 0) / r.cost * 100).toFixed(1) + '%';
    } else { $('#rsname').textContent = R.rate > 0 ? '연구 대기' : ''; $('#rsbar').style.width = '0%'; }
    $('#colony .rs').hidden = !R.current && !(R.rate > 0);
    const day = g.sky.time;
    const hh = Math.floor(day * 24), mm = Math.floor((day * 24 - hh) * 60);
    $('#clock').textContent = `${g.sky.day}일 · ${g.sky.season()} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    const pl = g.player;
    $('#g-o2').style.width = (pl.oxygen * 100) + '%';
    $('#g-o2t').textContent = Math.round(pl.oxygen * 100);
    $('#g-hp').style.width = (pl.health * 100) + '%';
    $('#g-hpt').textContent = Math.round(pl.health * 100);
    $('#g-jet').style.width = (pl.jetFuel * 100) + '%';
    $('#o2note').textContent = g.o2Note || '';
    $('#gv-o2').classList.toggle('full', pl.oxygen > 0.995);
    $('#gv-hp').classList.toggle('full', pl.health > 0.995);
    $('#gv-jet').classList.toggle('full', pl.jetFuel > 0.995);
    $('#gv-o2').classList.toggle('low', pl.oxygen < 0.25);
    $('#gv-hp').classList.toggle('low', pl.health < 0.25);
    $('#hotbar').classList.toggle('idle', g.build.mode !== 'place');
    this.renderObjective();
    if (this.panel && this.panelRefresh) this.panelRefresh();
  }

  updateCompass() {
    const g = this.game;
    const yaw = g.player.yaw;
    const W = $('#compass').clientWidth;
    const pxPerRad = W / (Math.PI * 0.9);
    const heading = ((-yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2); // 0 = north (-z)
    const items = [];
    const dirs = [['N', 0], ['NE', 45], ['E', 90], ['SE', 135], ['S', 180], ['SW', 225], ['W', 270], ['NW', 315]];
    const names = { N: '북', NE: '북동', E: '동', SE: '남동', S: '남', SW: '남서', W: '서', NW: '북서' };
    const place = (ang) => { let d = ang - heading; d = Math.atan2(Math.sin(d), Math.cos(d)); return W / 2 + d * pxPerRad; };
    for (let a = 0; a < 360; a += 15) {
      const x = place(a * Math.PI / 180);
      if (x < 0 || x > W) continue;
      const lab = dirs.find((d) => d[1] === a);
      items.push(lab ? `<span class="card-dir" style="left:${x}px;color:${lab[0] === 'N' ? 'var(--orange)' : 'var(--ink)'}">${names[lab[0]]}</span>` : `<span class="tick" style="left:${x}px"></span>`);
    }
    const P = g.player.pos;
    for (const m of g.markers()) {
      const ang = Math.atan2(m.x - P.x, -(m.z - P.z));
      const x = place(ang);
      if (x < 4 || x > W - 4) continue;
      items.push(`<span class="mk" style="left:${x}px;background:${m.color}" title="${esc(m.name)}"></span>`);
    }
    const html = items.join('');
    if (html !== this._cmp) { $('#cstrip').innerHTML = html; this._cmp = html; }
    const hd = String(Math.round(heading * 180 / Math.PI) % 360).padStart(3, '0');
    if (hd !== this._hd) { $('#hdg').textContent = hd; this._hd = hd; }
    this._whereT = (this._whereT || 0) - 1;
    if (this._whereT <= 0) {
      this._whereT = 20;
      const prov = g.terrain.gen.provinceAt(P.x, P.z);
      const lat = -P.z / WORLD.HALF * 90, lon = P.x / WORLD.HALF * 180;
      $('#where').textContent = `${prov.name} · ${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(1)}°${lon >= 0 ? 'E' : 'W'} · 고도 ${Math.round(P.y)}m`;
    }
  }

  // panels stack by their real size so nothing overlaps on small screens
  layoutHUD() {
    const pl = $('#planet'), sv = $('#survival'), co = $('#colony'), ob = $('#objective');
    if (!pl || !sv) return;
    const pr = pl.getBoundingClientRect(), hr = this.hud.getBoundingClientRect();
    sv.style.top = ''; sv.style.bottom = '';
    const sr = sv.getBoundingClientRect();
    if (this.game.input.touch || sr.top < pr.bottom + 10) { sv.style.top = (pr.bottom - hr.top + 10) + 'px'; sv.style.bottom = 'auto'; }
    if (co && ob) {
      // on phones the objective sits under the touch button bars on the right
      let below = co.getBoundingClientRect().bottom;
      if (this.game.input.touch) for (const b of document.querySelectorAll('#touch .bar.top, #touch .bar.drawer')) { if (!b.hidden && b.offsetParent) below = Math.max(below, b.getBoundingClientRect().bottom); }
      ob.style.top = (below - hr.top + 10) + 'px';
    }
    // phones: the controls card goes under the gauges instead of across the top
    const sh = $('#starthelp');
    if (sh && this.game.input.touch) sh.style.top = (sv.getBoundingClientRect().bottom - hr.top + 10) + 'px';
  }

  // on-screen marker for the current objective (or the way back to air)
  updateWaypoint() {
    const g = this.game, el = $('#waypoint'), P = g.player;
    if (!el || !g.started) { if (el) el.hidden = true; return; }
    let t = this._wpT;
    if (!g.terra.breathable && P.oxygen < 0.3 && !P.inside && !g.rover.driving && g.expedition.b) {
      const [x, z] = g.expedition.elevatorFoot();
      t = { x, y: g.expedition.b.y + 1.5, z, label: '산소 충전 · 탐사선', warn: true };
    }
    const dist = t ? Math.hypot(t.x - P.pos.x, t.z - P.pos.z) : 0;
    if (!t || dist < 2.2 || g.build.active) { el.hidden = true; return; }
    const cam = g.engine.camera, v = this._wpv || (this._wpv = new THREE.Vector3());
    v.set(t.x, t.y, t.z).applyMatrix4(cam.matrixWorldInverse);
    const behind = v.z > 0;
    v.applyMatrix4(cam.projectionMatrix);
    const W = innerWidth, H = innerHeight, m = 46, mx = 96, mb = g.input.touch ? 150 : 110;
    let x = (v.x * 0.5 + 0.5) * W, y = (-v.y * 0.5 + 0.5) * H;
    if (behind) { x = W - x; y = H - m; }
    if (behind) y = H - mb;
    const off = behind || x < mx || x > W - mx || y < m || y > H - mb;
    const cx = Math.min(W - mx, Math.max(mx, x)), cy = Math.min(H - mb, Math.max(m, y));
    el.hidden = false;
    el.classList.toggle('off', off);
    el.classList.toggle('warn', !!t.warn);
    el.style.transform = `translate(${cx.toFixed(0)}px, ${cy.toFixed(0)}px)`;
    if (off) el.querySelector('.ar').style.transform = `rotate(${Math.atan2(y - H / 2, x - W / 2).toFixed(3)}rad)`;
    const txt = `${t.label} · ${dist < 1000 ? Math.round(dist) + ' m' : (dist / 1000).toFixed(1) + ' km'}`;
    if (txt !== this._wpTxt) { this._wpTxt = txt; el.querySelector('span').textContent = txt; }
  }

  // the basic controls, shown until the first objective is done
  renderStartHelp() {
    const g = this.game, el = $('#starthelp');
    const o = g.objectives.current();
    const show = g.started && !g.flags.helpClosed && o && o.index === 0;
    el.hidden = !show;
    if (!show || el.dataset.ready) return;
    el.dataset.ready = 1;
    const keys = g.input.touch
      ? [['왼쪽 드래그', '이동'], ['스틱 끝까지', '달리기'], ['오른쪽 드래그', '시점'], ['채집 길게', '채집'], ['점프', '점프·제트팩'], ['사용', '상호작용'], ['가방', '제작'], ['더보기', '조작법 등']]
      : [['W A S D', '이동'], ['마우스', '시점'], ['좌클릭 유지', '채집'], ['Space', '점프·제트팩'], ['Tab', '가방·제작'], ['B', '건설'], ['E', '상호작용'], ['H', '조작 안내']];
    el.innerHTML = `<div class="sh">${keys.map(([k, d]) => `<span><b>${k}</b>${d}</span>`).join('')}</div><button class="x" title="닫기">✕</button>`;
    el.querySelector('.x').onclick = () => { g.flags.helpClosed = true; el.hidden = true; };
  }

  renderObjective() {
    const o = this.game.objectives.current();
    const el = $('#objective');
    if (!o) { el.hidden = true; this._wpT = null; return; }
    el.hidden = false;
    if (o.index !== this._objIdx) { this._objIdx = o.index; this._objShow = performance.now(); }
    const fresh = performance.now() - (this._objShow || 0) < 14000;
    this._wpT = o.target;
    const html = `<div class="in"><div class="lbl">OBJECTIVE <b class="num">${String(o.index + 1).padStart(2, '0')}</b><span>/ ${o.total}</span></div><div class="t">${esc(o.title)}</div>${fresh ? `<div class="d">${o.desc}</div>` : ''}
      ${o.step ? `<div class="s">${o.step}</div>` : ''}
      <div class="p">${o.items.map((it) => `<div class="${it.ok ? 'ok' : ''}"><i></i>${esc(it.text)}</div>`).join('')}</div></div>`;
    if (html !== this._obj) { el.innerHTML = html; this._obj = html; }
  }

  setMode(text) {
    const m = $('#mode');
    if (!text) { m.hidden = true; return; }
    m.hidden = false; m.innerHTML = text;
  }

  // ---------------------------------------------------------------- panels
  open(name, arg) {
    const g = this.game;
    this.close(false);
    g.input.uiOpen = true;
    g.input.unlock();
    const wrap = h('div', { id: 'panel-wrap' });
    const panel = h('div', { class: 'panel', role: 'dialog', 'aria-modal': 'true' });
    wrap.appendChild(panel);
    wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) this.close(); });
    this.root.appendChild(wrap);
    this.wrap = wrap;
    this.panel = name;
    this.panelEl = panel;
    this.panelArg = arg;
    this.panelRefresh = null;
    ({ build: () => this.buildPanel(panel), inv: () => this.invPanel(panel, arg), research: () => this.researchPanel(panel), map: () => this.mapPanel(panel), building: () => this.buildingPanel(panel, arg), pause: () => this.pausePanel(panel), help: () => this.helpPanel(panel), poi: () => this.poiPanel(panel, arg), comms: () => this.commsPanel(panel, arg) })[name]();
  }

  close(relock = true) {
    if (this.wrap) { this.wrap.remove(); this.wrap = null; }
    this.panel = null;
    this.panelRefresh = null;
    this.game.input.uiOpen = false;
    if (relock && this.game.started) this.game.input.lock();
  }

  header(panel, title, extra = '') {
    const hd = h('header', {}, `<h2>${title}</h2>${extra}<div class="sp"></div><button class="x" aria-label="닫기">닫기 · Esc</button>`);
    hd.querySelector('.x').onclick = () => this.close();
    panel.appendChild(hd);
    const body = h('div', { class: 'body' });
    panel.appendChild(body);
    return body;
  }

  costHTML(cost, pos) {
    const g = this.game;
    const net = g.eco.netAccess(pos || g.player.pos);
    return Object.entries(cost).map(([id, n]) => {
      if (id === 'credits') return `<span class="c ${g.colony.credits < n ? 'no' : ''}">${CREDIT_ICON}${n}</span>`;
      const have = g.eco.inv.count(id) + (net ? g.eco.store.count(id) : 0);
      return `<span class="c ${have < n ? 'no' : ''}" title="${ITEMS[id].name}">${itemIcon(id, 13)}${n}</span>`;
    }).join('');
  }

  buildPanel(panel) {
    const g = this.game;
    const tabs = `<div class="tabs">${CATEGORIES.map((c) => `<button data-c="${c.id}" class="${c.id === this.buildCat ? 'on' : ''}">${c.name}</button>`).join('')}</div>`;
    const body = this.header(panel, '건설', tabs);
    panel.querySelectorAll('.tabs button').forEach((b) => b.onclick = () => { this.buildCat = b.dataset.c; this.open('build'); });
    const list = Object.entries(BUILDINGS).filter(([, d]) => d.cat === this.buildCat && !d.hidden);
    const grid = h('div', { class: 'bgrid' });
    for (const [type, d] of list) {
      const lock = g.isUnlocked(type);
      const pin = this.hotbar.indexOf(type);
      const card = h('div', { class: 'bcard', tabindex: '0', 'data-t': type }, `
        ${pin >= 0 ? `<span class="pin">${pin + 1}</span>` : ''}
        <img alt="" src="${g.thumbs.get(type)}">
        <div class="n">${esc(d.name)}</div>
        <div class="cost">${this.costHTML(d.cost)}</div>
        ${d.power ? `<div style="font-size:11px;margin-top:4px;color:${d.power > 0 ? 'var(--good)' : 'var(--warn)'}">${d.power > 0 ? '+' : ''}${d.power} kW</div>` : ''}
        ${!lock.ok ? `<div class="lock">${esc(lock.reason)}</div>` : ''}`);
      card.onmouseenter = () => { desc.innerHTML = `<b>${esc(d.name)}</b> — ${esc(d.desc)}${d.workers ? ` · 일손: ${TIERS.find((t) => t.id === d.workers[0]).name} ${d.workers[1]}명` : ''}<br><span style="color:var(--dim)">숫자 키(1–9)를 누르면 이 건물을 핫바에 등록합니다.</span>`; this.hoverType = type; };
      card.onclick = () => { if (!lock.ok) { this.toast(lock.reason, 'bad'); return; } this.close(); g.build.select(type); };
      grid.appendChild(card);
    }
    body.appendChild(grid);
    const desc = h('div', { class: 'bdesc' }, '건물을 고르세요. 설치 중에는 마우스 휠로 회전, R로 90° 회전, 우클릭으로 취소합니다.');
    body.appendChild(desc);
    this.panelKey = (e) => {
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 9 && this.hoverType) { this.hotbar[n - 1] = this.hoverType; this.renderHotbar(); this.toast(BUILDINGS[this.hoverType].name + ' → 핫바 ' + n, 'info', 1.2); this.open('build'); }
    };
  }

  invPanel(panel, storage) {
    const g = this.game;
    const body = this.header(panel, storage ? esc(storage.def.name) : '가방 · 제작');
    const wrap = h('div', { class: 'inv' });
    body.appendChild(wrap);
    const left = h('div');
    wrap.appendChild(left);
    const right = h('div');
    wrap.appendChild(right);
    const render = () => {
      const inv = g.eco.inv;
      const net = g.eco.netAccess(g.player.pos) && g.eco.store.cap > 0;
      let html = `<p class="sec-t">가방 (${inv.usedSlots()}/${inv.slots}칸)${storage ? ' · 클릭하면 보관함으로 옮깁니다' : net ? ' · 클릭하면 공용 창고로 보냅니다 (Shift: 1개)' : ''}</p><div class="igrid">`;
      const ents = [...inv.items.entries()];
      for (let i = 0; i < inv.slots; i++) {
        const e = ents[i];
        html += e ? `<div class="islot" data-id="${e[0]}" title="${esc(ITEMS[e[0]].name)} — ${esc(ITEMS[e[0]].desc)}">${itemIcon(e[0])}<span class="q">${e[1]}</span></div>` : '<div class="islot"></div>';
      }
      html += '</div>';
      if (storage) {
        const sinv = g.storageInv(storage);
        html += `<p class="sec-t" style="margin-top:14px">${esc(storage.def.name)} (${sinv.usedSlots()}/${sinv.slots}칸) · 클릭하면 가방으로 옮깁니다</p><div class="igrid">`;
        const se = [...sinv.items.entries()];
        for (let i = 0; i < sinv.slots; i++) {
          const e = se[i];
          html += e ? `<div class="islot" data-sid="${e[0]}">${itemIcon(e[0])}<span class="q">${e[1]}</span></div>` : '<div class="islot"></div>';
        }
        html += '</div>';
      }
      if (g.eco.store.cap > 0) {
        html += `<p class="sec-t" style="margin-top:14px">식민지 공용 창고 (${g.eco.store.total()}/${g.eco.store.cap}) ${net ? '· 물류망 안: 건설에 바로 쓰이며, 클릭하면 가방으로 꺼냅니다' : '· 물류망 밖 (드론 허브·본부 반경 안에서 이용)'}</p><div class="chips">`;
        for (const [id, n] of g.eco.store.items) html += `<span class="chip" data-store="${id}" style="${net ? 'cursor:pointer;pointer-events:auto' : ''}">${itemIcon(id, 14)} ${ITEMS[id].name} ${n}</span>`;
        html += '</div>';
      }
      left.innerHTML = html;
      left.querySelectorAll('[data-id]').forEach((el) => el.onclick = (ev) => {
        const id = el.dataset.id, n = ev.shiftKey ? 1 : inv.count(id);
        if (storage) { const k = g.storageInv(storage).add(id, n); inv.remove(id, k); render(); return; }
        if (net) { const k = g.eco.store.add(id, n); inv.remove(id, k); if (k < n) this.toast('공용 창고가 가득 찼습니다', 'warn'); render(); }
      });
      left.querySelectorAll('[data-store]').forEach((el) => el.onclick = (ev) => {
        if (!net) return;
        const id = el.dataset.store, n = ev.shiftKey ? 1 : g.eco.store.count(id);
        const k = inv.add(id, n); g.eco.store.remove(id, k); render();
      });
      left.querySelectorAll('[data-sid]').forEach((el) => el.onclick = (ev) => {
        const id = el.dataset.sid, si = g.storageInv(storage), n = ev.shiftKey ? 1 : si.count(id);
        const k = inv.add(id, n); si.remove(id, k); render();
      });
      // crafting
      const bench = g.nearCraft();
      let r = `<p class="sec-t">제작 ${bench ? '· ' + esc(bench) : '· 작업대(탐사선·거주 모듈·제작대) 근처에서 가능'}</p><div class="recipes">`;
      for (const rec of RECIPES) {
        if (rec.factoryOnly) continue;
        if (rec.research && !g.research.has(rec.research)) continue;
        const can = bench && Object.entries(rec.in).every(([id, n]) => inv.count(id) >= n);
        const out = Object.keys(rec.out)[0];
        r += `<div class="recipe">${itemIcon(out, 30)}<div><div>${esc(rec.name)} ×${rec.out[out]}</div><div class="in">${Object.entries(rec.in).map(([id, n]) => `${ITEMS[id].name} ${n} (${inv.count(id)})`).join(' + ')}</div></div>
          <div><button data-r="${rec.id}" ${can ? '' : 'disabled'}>제작</button> <button data-r5="${rec.id}" ${can ? '' : 'disabled'} title="5번 제작">×5</button></div></div>`;
      }
      r += '</div>';
      right.innerHTML = r;
      right.querySelectorAll('[data-r]').forEach((b) => b.onclick = () => { g.craft(b.dataset.r, 1); render(); });
      right.querySelectorAll('[data-r5]').forEach((b) => b.onclick = () => { g.craft(b.dataset.r5, 5); render(); });
    };
    render();
    this.panelRefresh = null;
  }

  researchPanel(panel) {
    const g = this.game, R = g.research;
    const body = this.header(panel, '연구', `<span style="color:var(--muted)">연구 속도 ${R.rate.toFixed(2)}/s · 보유 ${Math.floor(R.points)}</span>`);
    const render = () => {
      const eras = ['개척', '정착', '마을', '도시', '문명'];
      body.innerHTML = `<div class="tree">${eras.map((name, i) => `<div class="tcol"><h3>${i + 1}. ${name}</h3>${RESEARCH.filter((r) => r.era === i + 1).map((r) => {
        const done = R.has(r.id), cur = R.current === r.id, av = R.available(r.id);
        const prog = Math.min(1, (R.progress[r.id] || 0) / r.cost);
        const unlocks = Object.values(BUILDINGS).filter((d) => d.research === r.id).map((d) => d.name).join(', ');
        return `<div class="tnode ${done ? 'done' : ''} ${cur ? 'cur' : ''} ${!done && !av ? 'lock' : ''}" data-id="${r.id}">
          <div class="n">${esc(r.name)} ${R.eureka.has(r.id) ? '<span class="eu">유레카!</span>' : ''}</div>
          <div class="d">${esc(r.desc)}${unlocks ? '<br>해금: ' + esc(unlocks) : ''}</div>
          <div class="bar"><i style="width:${done ? 100 : prog * 100}%;background:${done ? 'var(--good)' : '#c49bff'}"></i></div>
          <div style="font-size:11px;color:var(--muted);margin-top:4px">${done ? '완료' : `${Math.floor(R.progress[r.id] || 0)} / ${r.cost}`}${!done && !av ? ' · 선행: ' + r.req.map((q) => R.name(q)).join(', ') : ''}</div></div>`;
      }).join('')}</div>`).join('')}</div>
      <p style="color:var(--muted);margin-top:10px">연구 점수는 연구 단말기·연구소, 테라포밍 단계 달성, 잔해 탐색에서 얻습니다. 고대 유적을 조사하면 무작위 기술에 「유레카」(비용 50%)가 붙습니다.</p>`;
      body.querySelectorAll('.tnode').forEach((n) => n.onclick = () => { if (R.setCurrent(n.dataset.id)) { this.toast(R.name(n.dataset.id) + ' 연구 시작', 'info'); render(); } });
    };
    render();
  }

  mapPanel(panel) {
    const g = this.game;
    const body = this.header(panel, '행성 지도', '<span style="color:var(--muted)">휠: 확대 · 드래그: 이동</span>');
    const cv = h('canvas', { id: 'mapcv' });
    body.appendChild(cv);
    body.appendChild(h('div', { class: 'legend' }, '<span><i style="background:#ff9d4d"></i>나</span><span><i style="background:#66e0ff"></i>건물</span><span><i style="background:#ffd35a"></i>잔해·보급</span><span><i style="background:#b07aff"></i>유적</span><span><i style="background:#79e08a"></i>광맥</span><span><i style="background:#fff"></i>비콘</span>'));
    const V = this.mapView;
    V.cx = g.player.pos.x; V.cz = g.player.pos.z;
    const draw = () => {
      const r = cv.getBoundingClientRect();
      cv.width = r.width * devicePixelRatio; cv.height = r.height * devicePixelRatio;
      const c = cv.getContext('2d');
      c.fillStyle = '#0a0d10'; c.fillRect(0, 0, cv.width, cv.height);
      const mp = g.mapImage;
      const span = WORLD.SIZE / V.scale;                   // metres across the canvas width
      const k = cv.width / span;
      const toS = (x, z) => [(x - V.cx) * k + cv.width / 2, (z - V.cz) * k + cv.height / 2];
      if (mp) {
        const [x0, y0] = toS(-WORLD.HALF, -WORLD.HALF);
        c.imageSmoothingEnabled = true;
        c.drawImage(mp, x0, y0, WORLD.SIZE * k, WORLD.SIZE * k);
      } else { c.fillStyle = '#888'; c.fillText('지도 측량 중…', 20, 30); }
      // water overlay (current sea level)
      c.lineWidth = 2 * devicePixelRatio;
      const dot = (x, z, col, rr = 4) => { const [sx, sy] = toS(x, z); c.fillStyle = col; c.beginPath(); c.arc(sx, sy, rr * devicePixelRatio, 0, 7); c.fill(); };
      for (const d of g.props.allDeposits()) dot(d.x, d.z, '#79e08a', 3);
      for (const p of g.pois.discovered.values()) dot(p.x, p.z, p.kind === 'ruin' || p.kind === 'geode' ? '#b07aff' : '#ffd35a', 5);
      for (const b of g.buildings.list) dot(b.x, b.z, b.type === 'beacon' ? '#ffffff' : '#66e0ff', b.type === 'hq' ? 6 : 2.5);
      const P = g.player.pos;
      const [px, py] = toS(P.x, P.z);
      c.save(); c.translate(px, py); c.rotate(-g.player.yaw);
      c.fillStyle = '#ff9d4d'; c.beginPath(); c.moveTo(0, -10 * devicePixelRatio); c.lineTo(6 * devicePixelRatio, 7 * devicePixelRatio); c.lineTo(-6 * devicePixelRatio, 7 * devicePixelRatio); c.fill();
      c.restore();
      // landmark labels
      c.font = `${12 * devicePixelRatio}px Pretendard, sans-serif`; c.fillStyle = 'rgba(255,255,255,.75)';
      for (const [, L] of Object.entries(g.landmarks)) { const [sx, sy] = toS(L.x, L.z); c.fillText(L.name, sx + 6, sy); }
    };
    let drag = null;
    cv.onmousedown = (e) => { drag = [e.clientX, e.clientY, V.cx, V.cz]; };
    window.onmouseup = () => { drag = null; };
    cv.onmousemove = (e) => {
      if (!drag) return;
      const span = WORLD.SIZE / V.scale, k = cv.clientWidth / span;
      V.cx = drag[2] - (e.clientX - drag[0]) / k; V.cz = drag[3] - (e.clientY - drag[1]) / k; draw();
    };
    cv.onwheel = (e) => { e.preventDefault(); V.scale = Math.min(40, Math.max(1, V.scale * (e.deltaY < 0 ? 1.25 : 0.8))); draw(); };
    requestAnimationFrame(draw);
    this.panelRefresh = draw;
  }

  buildingPanel(panel, b) {
    const g = this.game;
    const d = b.def;
    const body = this.header(panel, esc(b.type === 'house' ? TIERS[b.tier].name + ' ' + d.name : d.name));
    const render = () => {
      const rows = [];
      if (d.power) rows.push(['전력', d.power > 0 ? `${g.eco.generatorOutput(b).toFixed(1)} / ${d.power} kW 생산` : `${-d.power} kW 사용 · 공급 ${Math.round((b.powerRatio || 0) * 100)}%`]);
      if (d.workers) rows.push(['일손', `${b.workersHave || 0} / ${d.workers[1]} (${TIERS.find((t) => t.id === d.workers[0]).name})`]);
      if (d.terra) rows.push(['테라포밍', Object.entries(d.terra).map(([k, v]) => `${PARAMS[k].name} +${(v * (b.rate || 0)).toFixed(2)}/s`).join(' · ')]);
      if (d.deposit) rows.push(['채굴', `${ITEMS[b.data.ore]?.name || ''} · 6초마다 1개 · 내부 저장 ${b.data.buf || 0}/${d.buffer}`]);
      if (d.research_rp) rows.push(['연구', `${(d.research_rp * (b.rate || 0)).toFixed(2)} 점/s`]);
      if (d.network) rows.push(['물류망', `반경 ${d.network}m`]);
      if (d.service) rows.push(['서비스', `반경 ${d.radius}m · ${b.serviceOk ? '운영 중' : '운영 안 됨'}`]);
      rows.push(['상태', b.status || (b.idle ? '대기' : '가동 중')]);
      if (d.house) {
        const rep = g.colony.needReport(b);
        rows.push(['거주', `${b.data.res || 0} / ${TIERS[b.tier].max}명 (목표 ${b.data.target ?? 0})`]);
        rows.push(['기본 필요', `<div class="needs">${rep.basic.map((n) => `<span class="need ${n.ok ? 'ok' : ''}">${n.name}</span>`).join('')}</div>`]);
        rows.push(['사치 필요', `<div class="needs">${rep.luxury.map((n) => `<span class="need ${n.ok ? 'ok' : ''}">${n.name}</span>`).join('')}</div>`]);
        const up = g.colony.canUpgrade(b);
        rows.push(['업그레이드', up.ok ? '<span style="color:var(--good)">가능</span>' : esc(up.reason)]);
      }
      let extra = '';
      if (d.factory) {
        const recs = RECIPES.filter((r) => d.factory.includes(r.id));
        extra += `<p class="sec-t" style="margin-top:12px">생산 레시피</p><div class="opts">${recs.map((r) => {
          const lock = r.research && !g.research.has(r.research);
          return `<button data-rec="${r.id}" class="${(b.data.recipe || d.factory[0]) === r.id ? 'on' : ''}" ${lock ? 'disabled' : ''}>${r.name} (${Object.entries(r.in).map(([k, n]) => ITEMS[k].name + n).join('+')} → ${Object.entries(r.out).map(([k, n]) => ITEMS[k].name + n).join('')})</button>`;
        }).join('')}</div>`;
      }
      extra += `<div class="opts" style="margin-top:14px">`;
      if (d.power < 0 || d.workers) extra += `<button data-act="toggle">${b.enabled === false ? '가동 시작' : '가동 중지'}</button>`;
      if (d.deposit && b.data.buf) extra += `<button data-act="collect" class="pri">광석 ${b.data.buf}개 가져가기</button>`;
      if (d.house) extra += `<button data-act="upgrade" ${g.colony.canUpgrade(b).ok ? '' : 'disabled'}>지금 업그레이드</button><button data-act="auto" class="${g.colony.autoUpgrade ? 'on' : ''}">자동 업그레이드 ${g.colony.autoUpgrade ? '켜짐' : '꺼짐'}</button>`;
      if (d.storage || d.craft) extra += `<button data-act="open">보관함·제작 열기</button>`;
      extra += '</div>';
      body.innerHTML = `<div class="binfo"><img alt="" src="${g.thumbs.get(b.type === 'house' ? 'house:' + b.tier : b.type)}"><div>
        <p style="color:var(--muted);margin:0 0 12px">${esc(d.desc)}</p>
        <div class="kv">${rows.map(([k, v]) => `<div class="k">${k}</div><div>${v}</div>`).join('')}</div>${extra}</div></div>`;
      body.querySelectorAll('[data-rec]').forEach((x) => x.onclick = () => { b.data.recipe = x.dataset.rec; b.data.busy = false; render(); });
      body.querySelectorAll('[data-act]').forEach((x) => x.onclick = () => {
        const a = x.dataset.act;
        if (a === 'toggle') b.enabled = b.enabled === false;
        if (a === 'collect') { const k = g.eco.give(b.data.ore, b.data.buf); b.data.buf -= k; }
        if (a === 'upgrade') g.colony.tryUpgrade(b);
        if (a === 'auto') g.colony.autoUpgrade = !g.colony.autoUpgrade;
        if (a === 'open') { this.open('inv', d.storage ? b : null); return; }
        render();
      });
    };
    render();
    let t = 0;
    this.panelRefresh = () => { if ((t++ % 4) === 0) render(); };
  }

  commsPanel(panel, b) {
    const g = this.game, C = g.colony, T = g.terra;
    const body = this.header(panel, '심우주 교신기');
    const render = () => {
      const st = C.callStatus();
      const P = T.p;
      const press = (0.006 + Math.min(1.2, T.sVis / 10)).toFixed(3);
      const temp = Math.round(-63 + Math.min(80, T.sVis * 8));
      body.innerHTML = `
        <div class="binfo"><img alt="" src="${g.thumbs.get('comms')}"><div>
          <p style="color:var(--muted);margin:0 0 12px">행성 아르케의 상태를 우주의 개척선과 이주민 정거장으로 송신합니다. 하늘이 바뀔수록 더 많은 사람이 응답합니다.</p>
          <div class="kv">
            <div class="k">테라포밍 단계</div><div>${STAGES[T.stage].name} · ${fmtTi(T.ti)}Ti</div>
            <div class="k">송신 보고</div><div>대기압 약 ${press}기압 · 지표 ${temp}°C · 산소 ${fmtTi(P.oxygen)}ppq</div>
            <div class="k">맞이할 빈 집</div><div>${C.freeHousing()}명</div>
            <div class="k">예상 응답</div><div>${st.ok ? `정착민 ${st.n}명` : `<span style="color:var(--warn)">${esc(st.reason)}</span>`}</div>
          </div>
          <div class="opts" style="margin-top:14px"><button class="pri" data-a="send" ${st.ok ? '' : 'disabled'}>정착민 초청 교신 송신</button></div>
          <p class="sec-t" style="margin-top:16px">교신 기록</p>
          <div style="display:grid;gap:5px;font-size:12.5px">${C.log.length ? C.log.map((l) => `<div style="color:${l.kind === 'in' ? 'var(--good)' : 'var(--muted)'}">${l.kind === 'in' ? '◀ ' : '▶ '}${esc(l.text)}</div>`).join('') : '<div style="color:var(--dim)">아직 송신한 기록이 없습니다.</div>'}</div>
          ${C.calls.length ? `<p style="color:var(--cyan)">${C.calls[0].phase === 'sent' ? '응답을 기다리는 중…' : `${esc(C.calls[0].ship)} 접근 중 — 곧 본부 착륙장에 내립니다`}</p>` : ''}
        </div></div>`;
      const btn = body.querySelector('[data-a=send]');
      if (btn) btn.onclick = () => {
        const r = C.sendCall();
        if (r.ok) { g.fx.skyBeam(b); g.audio.play('stage'); this.toast('교신을 송신했습니다. 응답을 기다립니다.', 'info', 3); }
        render();
      };
    };
    render();
    let t = 0;
    this.panelRefresh = () => { if ((t++ % 4) === 0) render(); };
  }

  poiPanel(panel, res) {
    const body = this.header(panel, res.title);
    body.innerHTML = `<p style="line-height:1.7;color:var(--muted)">${res.text}</p>
      ${res.loot && res.loot.length ? `<div class="chips">${res.loot.map(([id, n]) => `<span class="chip">${itemIcon(id, 14)} ${ITEMS[id].name} +${n}</span>`).join('')}</div>` : ''}
      ${res.rp ? `<p>연구 점수 +${res.rp}</p>` : ''}${res.eureka ? `<p style="color:#c7a6ff">유레카! 「${esc(res.eureka.name)}」 연구 비용의 50%를 얻었습니다.</p>` : ''}`;
  }

  pausePanel(panel) {
    const g = this.game;
    const body = this.header(panel, '일시 정지');
    const s = g.settings;
    body.innerHTML = `
      <div class="opts" style="margin-bottom:18px"><button class="pri" data-a="resume">계속하기</button><button data-a="save">저장</button><button data-a="help">조작법</button><button data-a="title">타이틀로</button></div>
      <div class="settings">
        <label for="q">그래픽 품질</label><select id="q">${Object.keys(QUALITY).map((k) => `<option value="${k}" ${k === s.quality ? 'selected' : ''}>${{ low: '낮음', medium: '보통', high: '높음', ultra: '최고' }[k]}</option>`).join('')}</select>
        <label for="sens">마우스 감도</label><input id="sens" type="range" min="0.5" max="3" step="0.1" value="${s.sens}">
        <label for="fov">시야각 (FOV)</label><input id="fov" type="range" min="60" max="100" step="1" value="${s.fov}">
        <label for="inv">상하 반전</label><select id="inv"><option value="0" ${!s.invertY ? 'selected' : ''}>끄기</option><option value="1" ${s.invertY ? 'selected' : ''}>켜기</option></select>
        <label for="tspd">테라포밍 속도</label><select id="tspd">${[1, 2, 5].map((v) => `<option value="${v}" ${s.terraSpeed === v ? 'selected' : ''}>×${v}</option>`).join('')}</select>
        <label for="vol">효과음</label><input id="vol" type="range" min="0" max="1" step="0.05" value="${s.volume}">
      </div>
      <p style="color:var(--muted);margin-top:16px">진행 상황은 브라우저에 60초마다 자동 저장됩니다.</p>`;
    body.querySelector('[data-a=resume]').onclick = () => this.close();
    body.querySelector('[data-a=save]').onclick = () => { g.save(); this.toast('저장했습니다', 'good'); };
    body.querySelector('[data-a=help]').onclick = () => this.open('help');
    body.querySelector('[data-a=title]').onclick = () => { g.save(); location.reload(); };
    const apply = () => {
      if (s.quality !== $('#q').value) s.autoQuality = false;
      s.quality = $('#q').value; s.sens = +$('#sens').value; s.fov = +$('#fov').value; s.invertY = $('#inv').value === '1'; s.terraSpeed = +$('#tspd').value; s.volume = +$('#vol').value;
      g.applySettings();
    };
    body.querySelectorAll('select, input').forEach((el) => el.onchange = apply);
  }

  helpPanel(panel) {
    const body = this.header(panel, '조작법');
    // every action with its keyboard/mouse input and its touch control, one to one
    const keys = [
      ['이동', 'W A S D', '왼쪽 화면 드래그(스틱)'], ['시점', '마우스', '오른쪽 화면 드래그'], ['달리기', 'Shift', '스틱을 끝까지 밀기'],
      ['점프 / 제트팩', 'Space (공중에서 유지)', '점프 (공중에서 유지)'], ['채집 · 설치 · 해체', '좌클릭 (유지)', '채집 버튼 (유지)'],
      ['상호작용 · 탑승', 'E', '사용'], ['취소 · 종료', '우클릭 / Esc', '취소'], ['건설 메뉴', 'B', '건설'], ['핫바 건설', '1 – 9', '하단 핫바 탭'],
      ['90° 회전', 'R', '90° 회전'], ['15° 회전', '마우스 휠', '↺ 15° · ↻ 15°'], ['기초 판 높이', 'PageUp · PageDown (T · Y)', '높이 + · 높이 −'],
      ['도로 연결 끊기', '우클릭', '연결 끊기'], ['해체 모드', 'F', '더보기 → 해체'], ['지형 도구', 'G', '더보기 → 지형 도구'],
      ['지형: 돋우기 / 깎기', '좌클릭 / 우클릭', '돋우기(채집 버튼) / 깎기'], ['지형: 평탄화', 'Shift + 좌클릭', '평탄화'], ['지형: 붓 크기', '마우스 휠', '붓 크게 · 붓 작게'],
      ['가방 · 제작', 'Tab', '가방'], ['연구', 'J', '연구'], ['지도', 'M', '지도'], ['1인칭 / 3인칭', 'V', '더보기 → 시점'], ['헬멧 조명', 'L', '더보기 → 조명'],
      ['탐사 로버 호출 · 탑승', 'N', '더보기 → 로버'], ['로버 가속 · 조향', 'W · A D', '채집 버튼(가속) · 스틱'], ['로버 브레이크', 'Space', '브레이크'], ['로버 하차', 'E / N', '하차'],
      ['조작법', 'F1', '더보기 → 조작법'], ['일시 정지', 'Esc / P', '☰'],
    ];
    body.innerHTML = `<div class="help h3"><div class="hh"><span>동작</span><b>키보드 · 마우스</b><b>터치</b></div>${keys.map(([a, b, c]) => `<div><span>${a}</span><b>${b}</b><b>${c}</b></div>`).join('')}</div>
      <p style="color:var(--muted);line-height:1.7;margin-top:16px">아르케는 16km 너비의 행성입니다. 극지 빙원과 크레이터 지대, 층암 메사와 대협곡, 모래 바다와 소금 평원, 현무암 화산대와 결정 평원이 위도를 따라 이어집니다.
      광석을 모아 기지를 세우고, 히터·대기 드릴·식물 배양관으로 대기를 바꾸면 하늘이 푸르러지고 비가 내려 분지가 바다가 되며, 이끼와 숲이 자랍니다. 식민 본부를 세우면 정착민이 이주선을 타고 도착해 도시와 문명을 이룹니다.</p>`;
  }
}
