// HUD + phone-style management panel + minimap + touch controls. Plain DOM over the canvas.
import { COMMODITIES, BUSINESSES, LICENSES, FLOAT, INTERACT, STOCK_BASE, CORP_DIST, fmt } from '../game/game.js';
import { VEHICLES, CEILINGS } from '../game/player.js';
import { districtAt, DISTRICT_BY_ID, R_CITY, RINGS, COAST_X } from '../world/layout.js';
import { CLOUD_BASE, CLOUD_TOP } from '../render/env.js';
import { BRANDS } from '../data/signs.js';

const $ = (s, r = document) => r.querySelector(s);
const TABS = [['jobs', '일감'], ['trade', '거래'], ['biz', '사업'], ['stock', '주식'], ['garage', '차고·면허'], ['rank', '서열'], ['sys', '설정']];
const DCOL = { hive: '#b98a52', verdant: '#8a4f9e', sump: '#3f8f80', foundry: '#a8542a', port: '#3f78a8', oldq: '#7d6fb0', meridian: '#4fa99a', lumina: '#b04a86', core: '#c9a560', sprawl: '#39414d', zenith: '#e8d6a0' };

export class HUD {
  constructor(game, input) {
    this.g = game; this.input = input; this.open = false; this.tab = 'jobs'; this.t = 0;
    const ui = $('#ui');
    ui.innerHTML = `
      <div id="hud">
        <div class="h-tl"><div class="h-dist" id="h-dist"></div><div class="h-sub" id="h-sub"></div></div>
        <div class="h-tr"><div class="h-lux"><span id="h-lux">0</span><em>ℓ</em></div><div class="h-inc" id="h-inc"></div><div class="h-rank" id="h-rank"></div></div>
        <div class="h-obj" id="h-obj"></div>
        <div class="h-alt"><div class="h-tape"><i id="h-altfill"></i><b id="h-ceil"></b><u id="h-cloud"></u></div><div class="h-altv"><span id="h-altv">0</span> m</div><div class="h-spd"><span id="h-spd">0</span> km/h</div></div>
        <canvas id="h-mini" class="hud-click" width="190" height="190"></canvas>
        <div class="h-job" id="h-job"></div>
        <div class="h-prompt" id="h-prompt"></div>
        <div class="h-toasts" id="h-toasts"></div>
        <div class="h-news"><span id="h-news"></span></div>
        <div class="h-warn" id="h-warn">고도 한도 — 면허 등급을 올리세요</div>
        <div class="h-stick" id="h-stick"><i></i></div>
        <div class="h-touch" id="h-touch"></div>
        <button class="h-menu hud-click" id="h-menu">☰</button>
      </div>
      <div id="panel" class="panel"><div class="p-head"><div class="p-tabs" id="p-tabs"></div><button class="p-x" data-act="close">✕</button></div><div class="p-body" id="p-body"></div></div>
      <div id="fade"></div>`;
    this.el = { dist: $('#h-dist'), sub: $('#h-sub'), lux: $('#h-lux'), inc: $('#h-inc'), rank: $('#h-rank'), obj: $('#h-obj'), altv: $('#h-altv'), spd: $('#h-spd'), fill: $('#h-altfill'), ceil: $('#h-ceil'), cloud: $('#h-cloud'), job: $('#h-job'), prompt: $('#h-prompt'), toasts: $('#h-toasts'), news: $('#h-news'), warn: $('#h-warn'), stick: $('#h-stick'), panel: $('#panel'), body: $('#p-body'), tabs: $('#p-tabs'), fade: $('#fade') };
    this.mini = $('#h-mini').getContext('2d'); this._mapBg();
    $('#h-menu').addEventListener('click', () => this.toggle());
    this.el.panel.addEventListener('click', (e) => { const b = e.target.closest('[data-act]'); if (b) this._act(b.dataset.act, b.dataset); });
    if (input.touch) this._touch();
    document.body.classList.toggle('touch', input.touch);
  }
  stick(on, x, y, dx, dy) { const s = this.el.stick; s.style.display = on ? 'block' : 'none'; if (on) { s.style.left = x - 60 + 'px'; s.style.top = y - 60 + 'px'; s.firstChild.style.transform = `translate(${dx}px,${dy}px)`; } }
  _touch() {
    const t = $('#h-touch'); const mk = (name, label, cls = '') => { const b = document.createElement('button'); b.className = 'tbtn ' + cls; b.textContent = label; b.dataset.name = name; const dn = (e) => { e.preventDefault(); this.input.setButton(name, true); b.classList.add('on'); }, up = (e) => { e.preventDefault(); this.input.setButton(name, false); b.classList.remove('on'); }; b.addEventListener('touchstart', dn, { passive: false }); b.addEventListener('touchend', up); b.addEventListener('touchcancel', up); t.appendChild(b); return b; };
    mk('Jump', '▲', 'b-jump'); this.bDown = mk('Down', '▼', 'b-down'); mk('Run', '≫', 'b-run'); this.bF = mk('F', '탑승', 'b-f'); this.bE = mk('E', 'E', 'b-e'); this.bQ = mk('Q', 'Q', 'b-q'); mk('R', '호출', 'b-r');
  }
  _mapBg() { // 512px map of ±5300 m: district tint + blocks + rings
    const S = 512, R = 5300; const cv = document.createElement('canvas'); cv.width = cv.height = S; const c = cv.getContext('2d'); const img = c.createImageData(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const wx = (x / S - 0.5) * 2 * R, wz = (y / S - 0.5) * 2 * R; const d = districtAt(wx, wz); const col = wx < COAST_X ? '#10202c' : DCOL[d.id] || '#333'; const n = parseInt(col.slice(1), 16); const k = d.id === 'sprawl' ? 0.5 : 0.32; const o = (y * S + x) * 4; img.data[o] = ((n >> 16) & 255) * k; img.data[o + 1] = ((n >> 8) & 255) * k; img.data[o + 2] = (n & 255) * k; img.data[o + 3] = 255; }
    c.putImageData(img, 0, 0); const P = (v) => (v / (2 * R) + 0.5) * S;
    for (const b of this.g.city.ctx.blocks || []) { c.save(); c.translate(P(b.x), P(b.z)); c.rotate(-b.yaw); c.fillStyle = b.reserved ? 'rgba(255,220,150,0.5)' : 'rgba(255,255,255,0.14)'; c.fillRect((-b.w / 2 / (2 * R)) * S, (-b.d / 2 / (2 * R)) * S, (b.w / (2 * R)) * S, (b.d / (2 * R)) * S); c.restore(); }
    c.strokeStyle = 'rgba(255,220,160,0.5)'; c.lineWidth = 1.2; c.beginPath(); c.arc(S / 2, S / 2, (352 / (2 * R)) * S, 0, 6.283); c.fillStyle = 'rgba(255,220,150,0.7)'; c.fill();
    this.mapBg = cv; this.mapR = R;
  }
  toggle(tab) { this.open = tab ? true : !this.open; if (tab) this.tab = tab; this.el.panel.classList.toggle('show', this.open); this.input.enabled = !this.open; if (this.open) { document.exitPointerLock?.(); this.render(); } else if (!this.input.touch) this.g.engine.canvas.requestPointerLock?.(); }

  _act(act, d) {
    const g = this.g; const dist = g.district().id;
    if (act === 'close') return this.toggle();
    if (act === 'tab') { this.tab = d.tab; }
    else if (act === 'accept') g.accept(+d.i); else if (act === 'reroll') g.rollOffers(); else if (act === 'cancel') g.cancelJob();
    else if (act === 'buy') g.buy(d.id, +d.n, this.tradeD || dist); else if (act === 'sell') g.sell(d.id, +d.n, this.tradeD || dist);
    else if (act === 'biz') g.buyBiz(d.id); else if (act === 'lic') g.buyLicense(); else if (act === 'veh') g.buyVehicle(+d.t); else if (act === 'remote') g.buyRemote();
    else if (act === 'share') g.tradeShares(d.id, +d.n); else if (act === 'quality') { try { localStorage.setItem('ns.quality', d.q); } catch (e) { /* ignore */ } location.search = ''; }
    else if (act === 'sens') { g.player.sens = +d.v; try { localStorage.setItem('ns.sens', d.v); } catch (e) { /* ignore */ } } else if (act === 'reset') { if (confirm('저장 데이터를 지우고 처음부터 시작할까요?')) g.reset(); }
    else if (act === 'save') { g.save(); g.toast('저장 완료', 'good'); } else if (act === 'travel') { g.travel(g.pois.filter((p) => p.type === 'station')[+d.i]); return this.toggle(); }
    this.render();
  }
  render() {
    const g = this.g, s = g.state; const dist = g.district();
    this.el.tabs.innerHTML = TABS.map(([id, n]) => `<button class="p-tab ${id === this.tab ? 'on' : ''}" data-act="tab" data-tab="${id}">${n}</button>`).join('');
    let h = ''; const row = (a, b, c = '') => `<div class="row"><div class="r-a">${a}</div><div class="r-b">${b}</div><div class="r-c">${c}</div></div>`;
    const btn = (label, act, data = '', dis = false) => `<button class="btn" data-act="${act}" ${data} ${dis ? 'disabled' : ''}>${label}</button>`;
    if (this.tab === 'jobs') {
      h += `<h3>배달 의뢰</h3>`;
      if (g.job) h += row(`<b>진행 중</b> — ${g.job.item}`, `${g.job.stage === 0 ? '수령지' : '배송지'}로 이동 · 보수 ${fmt(g.job.pay)} ℓ`, btn('포기', 'cancel'));
      else { h += g.offers.map((o, i) => row(`<b>${o.item}</b> 운송`, `${Math.round(o.d)} m · 제한 ${o.time}초`, `<span class="pay">${fmt(o.pay)} ℓ</span>${btn('수락', 'accept', `data-i="${i}"`)}`)).join('') || '<p class="dim">주변에 의뢰가 없습니다. 다른 곳으로 이동해 보세요.</p>'; h += btn('의뢰 새로 고침', 'reroll'); }
      h += `<h3>현재 목표</h3><p>${g.objective ? g.objective.text : ''}</p><p class="dim">${g.objective ? g.objective.sub : ''}</p>`;
      h += `<h3>적재 화물 <small>${g.cargoUsed()} / ${g.cargoCap()}</small></h3>` + (Object.keys(s.cargo).map((k) => row(COMMODITIES.find((c) => c.id === k).name, `${s.cargo[k].n}개 · 평단 ${fmt(s.cargo[k].avg)} ℓ`)).join('') || '<p class="dim">비어 있음</p>');
    } else if (this.tab === 'trade') {
      const can = g.near && ['shop', 'market', 'plaza', 'lobby'].includes(g.near.type); const dd = this.tradeD = dist.id;
      h += `<h3>${dist.name} 시세 <small>적재 ${g.cargoUsed()} / ${g.cargoCap()}</small></h3>`; if (!can) h += '<p class="warn">상점 안이나 시장 광장에서만 거래할 수 있습니다. 시세 조회만 가능합니다.</p>';
      h += COMMODITIES.map((c) => { const p = g.price(c.id, dd); const have = s.cargo[c.id]; const rel = p / c.base; const tag = rel < 0.8 ? '<i class="lo">저가</i>' : rel > 1.25 ? '<i class="hi">고가</i>' : ''; return row(`<b>${c.name}</b> ${tag}`, `${fmt(p)} ℓ${have ? ` · 보유 ${have.n} (평단 ${fmt(have.avg)})` : ''}`, can ? btn('−1', 'sell', `data-id="${c.id}" data-n="1"`, !have) + btn('전량 매도', 'sell', `data-id="${c.id}" data-n="9999"`, !have) + btn('+1', 'buy', `data-id="${c.id}" data-n="1"`) + btn('+10', 'buy', `data-id="${c.id}" data-n="10"`) + btn('최대', 'buy', `data-id="${c.id}" data-n="9999"`) : ''); }).join('');
      if (g.event) h += `<p class="warn">${g.news}</p>`;
    } else if (this.tab === 'biz') {
      h += `<h3>사업체 <small>초당 수익 ${fmt(g.income())} ℓ</small></h3>`;
      h += BUSINESSES.map((b) => { const l = g.bizLevel(b.id); const dn = b.d === 'zenith' ? '제니스' : (DISTRICT_BY_ID[b.d] || {}).name; const seen = s.visited[b.d]; return row(`<b>${b.name}</b> <small>${dn}</small>`, l >= 0 ? `Lv.${l + 1} · +${fmt(g.bizIncome(b))} ℓ/초` : (seen ? `예상 +${fmt(b.inc)} ℓ/초` : '<span class="dim">미방문 구역</span>'), l >= 9 ? '<span class="dim">최대</span>' : btn(`${l < 0 ? '인수' : '확장'} ${fmt(g.bizCost(b))} ℓ`, 'biz', `data-id="${b.id}"`, !seen || s.lux < g.bizCost(b))); }).join('');
    } else if (this.tab === 'stock') {
      const can = s.remote || (g.near && g.near.type === 'exchange');
      h += `<h3>에테르 거래소 <small>유통 주식 ${FLOAT}주 · 51% = 경영권</small></h3>`; if (!can) h += `<p class="warn">스파이어 광장의 거래소 단말에서만 매매할 수 있습니다. ${btn('원격 단말 설치 5,000 ℓ', 'remote', '', s.lux < 5000)}</p>`;
      h += Object.keys(STOCK_BASE).map((k) => { const p = g.stock[k]; const hist = g.stockHist[k]; const ch = hist.length > 1 ? (p / hist[0] - 1) * 100 : 0; const have = s.shares[k] || 0; const br = BRANDS[k]; return row(`<b style="color:${br.color}">${br.name}</b> <small>${br.ko}</small>`, `${fmt(p)} ℓ <i class="${ch >= 0 ? 'hi' : 'lo'}">${ch >= 0 ? '▲' : '▼'}${Math.abs(ch).toFixed(1)}%</i> · 보유 ${have}주 (${((have / FLOAT) * 100).toFixed(0)}%)${have >= FLOAT * 0.51 ? ' <i class="hi">경영권</i>' : ''}`, can ? btn('−10', 'share', `data-id="${k}" data-n="-10"`, !have) + btn('+1', 'share', `data-id="${k}" data-n="1"`) + btn('+10', 'share', `data-id="${k}" data-n="10"`) + btn('+100', 'share', `data-id="${k}" data-n="100"`) : ''); }).join('');
    } else if (this.tab === 'garage') {
      h += '<h3>비행체</h3>' + VEHICLES.slice(1).map((v, i) => { const t = i + 1; const own = s.vehicle >= t; const cost = Math.round(v.price - (s.vehicle ? VEHICLES[s.vehicle].price * 0.5 : 0)); return row(`<b>${v.name}</b>`, `최고 ${Math.round(v.speed * 3.6)} km/h · 적재 ${v.cargo}`, own ? '<span class="dim">보유</span>' : btn(`구매 ${fmt(cost)} ℓ`, 'veh', `data-t="${t}"`, s.lux < cost)); }).join('');
      h += '<h3>고도 면허</h3>' + LICENSES.map((l, i) => row(`<b>${l.name}</b>`, `비행 한도 ${i === 4 ? '무제한' : CEILINGS[i] + ' m'}`, s.license >= i ? '<span class="dim">취득</span>' : i === s.license + 1 ? btn(`취득 ${fmt(l.cost)} ℓ`, 'lic', '', s.lux < l.cost) : '')).join('');
      h += `<p class="dim">구름층은 ${CLOUD_BASE}–${CLOUD_TOP} m. 3급부터 구름 위 제니스(1,500 m)에 오를 수 있습니다.</p>`;
    } else if (this.tab === 'rank') {
      const r = g.rank(); h += `<h3>광휘 서열 <small>순자산 ${fmt(g.netWorth())} ℓ · ${r.named ? r.n + '위' : fmt(r.n) + '위'}</small></h3>`;
      h += g.rivals().map((x, i) => `<div class="row ${x.me ? 'me' : ''}"><div class="r-a">${r.named || !x.me ? i + 1 : '…'}</div><div class="r-b"><b>${x.name}</b></div><div class="r-c">${fmt(x.v)} ℓ</div></div>`).join('');
    } else {
      const st = g.pois.filter((p) => p.type === 'station');
      h += '<h3>설정</h3>' + row('그래픽 품질', '', ['low', 'medium', 'high', 'ultra'].map((q) => btn({ low: '낮음', medium: '보통', high: '높음', ultra: '최고' }[q], 'quality', `data-q="${q}"`, g.engine.q.name === q)).join(''));
      h += row('시점 감도', '', [['0.0016', '낮음'], ['0.0024', '보통'], ['0.0034', '높음']].map(([v, n]) => btn(n, 'sens', `data-v="${v}"`)).join('')) + row('진행 상황', `플레이 ${Math.floor(s.playtime / 60)}분`, btn('저장', 'save') + btn('초기화', 'reset'));
      if (g.near && g.near.type === 'station') h += '<h3>마그레브 노선 (8 ℓ)</h3>' + st.map((p, i) => row(p.name, '', btn('탑승', 'travel', `data-i="${i}"`))).join('');
      h += `<h3>조작</h3><p class="dim">WASD 이동 · 마우스 시점 · Shift 달리기/부스트 · Space 점프/상승 · C 하강 · F 탑승/하차 · R 스키머 호출 · E 상호작용 · Tab 메뉴</p>`;
    }
    this.el.body.innerHTML = h;
  }

  update(dt) {
    const g = this.g, s = g.state, pl = g.player, p = pl.p, e = this.el; this.t += dt;
    const d = g.district(); if (this._d !== d.id) { this._d = d.id; e.dist.textContent = d.name; e.sub.textContent = d.en + ' · ' + d.sub; e.dist.parentElement.classList.remove('pop'); void e.dist.offsetWidth; e.dist.parentElement.classList.add('pop'); }
    e.lux.textContent = fmt(s.lux); const inc = g.income(); e.inc.textContent = inc > 0 ? `+${fmt(inc)} ℓ/초` : ''; const r = g.rank(); e.rank.textContent = `서열 ${r.named ? r.n : fmt(r.n)}위`;
    if (g.objective) e.obj.innerHTML = `<small>목표 ${Math.min(g.objective.i + 1, g.objective.n)}/${g.objective.n}</small>${g.objective.text}`;
    e.altv.textContent = Math.round(p.y); e.spd.textContent = Math.round(pl.speed * 3.6);
    const maxA = 2000; e.fill.style.height = Math.min(100, (p.y / maxA) * 100) + '%'; e.ceil.style.bottom = Math.min(100, (CEILINGS[s.license] / maxA) * 100) + '%'; e.cloud.style.bottom = (CLOUD_BASE / maxA) * 100 + '%'; e.cloud.style.height = ((CLOUD_TOP - CLOUD_BASE) / maxA) * 100 + '%';
    e.warn.classList.toggle('show', pl.ceilWarn > 0);
    // prompts
    let pr = pl.liftPrompt || ''; if (!pr && g.near) pr = `${g.near.name ? g.near.name + ' — ' : ''}${INTERACT[g.near.type]}`;
    if (!pr && pl.mode === 'foot' && pl.hasCar && pl.pos.distanceTo(pl.vpos) < 7) pr = '[F] 스키머 탑승';
    e.prompt.textContent = pr; e.prompt.classList.toggle('show', !!pr);
    if (this.bDown) { this.bDown.style.display = pl.mode === 'fly' ? '' : 'none'; this.bE.style.display = pr.includes('[E]') ? '' : 'none'; this.bQ.style.display = pr.includes('[Q]') ? '' : 'none'; this.bF.style.display = pl.hasCar ? '' : 'none'; }
    const J = g.job; if (J) { const t = J.stage === 0 ? J.a : J.b; e.job.innerHTML = `<b>${J.stage === 0 ? '수령' : '배송'}</b> ${J.item} · ${Math.round(Math.hypot(t.x - p.x, t.z - p.z))} m · <span class="${J.left < 15 ? 'lo' : ''}">${Math.max(0, Math.round(J.left))}초</span>`; e.job.classList.add('show'); } else e.job.classList.remove('show');
    e.toasts.innerHTML = g.toasts.map((t) => `<div class="toast ${t.kind}" style="opacity:${Math.min(1, t.t)}">${t.text}</div>`).join('');
    if (e.news.textContent !== g.news) e.news.textContent = g.news;
    e.fade.style.opacity = g.fade || 0;
    this._mini(p, pl);
    if (this.open && this.t > 1) { this.t = 0; if (this.tab === 'trade' || this.tab === 'stock' || this.tab === 'rank') this.render(); }
  }
  _mini(p, pl) {
    const c = this.mini, S = 190, bg = this.mapBg, R = this.mapR; const view = pl.mode === 'fly' ? 1300 : 420; const k = bg.width / (2 * R);
    c.clearRect(0, 0, S, S); c.save(); c.beginPath(); c.arc(S / 2, S / 2, S / 2 - 2, 0, 6.283); c.clip();
    c.imageSmoothingEnabled = true; c.drawImage(bg, (p.x + R - view) * k, (p.z + R - view) * k, view * 2 * k, view * 2 * k, 0, 0, S, S);
    const P = (x, z) => [S / 2 + ((x - p.x) / view) * (S / 2), S / 2 + ((z - p.z) / view) * (S / 2)]; const clampR = (q) => { const dx = q[0] - S / 2, dy = q[1] - S / 2, l = Math.hypot(dx, dy), m = S / 2 - 8; return l > m ? [S / 2 + (dx / l) * m, S / 2 + (dy / l) * m] : q; };
    const dot = (x, z, col, r = 3.2) => { const q = clampR(P(x, z)); c.fillStyle = col; c.beginPath(); c.arc(q[0], q[1], r, 0, 6.283); c.fill(); };
    for (const o of this.g.pois) if (o.type === 'station' || o.type === 'home' || o.type === 'exchange' || o.type === 'license') { if (Math.hypot(o.x - p.x, o.z - p.z) < view * 1.2) dot(o.x, o.z, o.type === 'home' ? '#7df9d0' : o.type === 'station' ? '#58d6ff' : '#ffc45a', 2.6); }
    for (const q of this.g.pickups) if (Math.hypot(q.x - p.x, q.z - p.z) < view) dot(q.x, q.z, '#ffd866', 1.6);
    const J = this.g.job; if (J) { const t = J.stage === 0 ? J.a : J.b; dot(t.x, t.z, J.stage === 0 ? '#5ff2e6' : '#ffb347', 5); }
    if (pl.hasCar && pl.mode === 'foot') dot(pl.vpos.x, pl.vpos.z, '#ffffff', 3);
    c.translate(S / 2, S / 2); c.rotate(-pl.camYaw); c.fillStyle = '#fff'; c.beginPath(); c.moveTo(0, -8); c.lineTo(5.5, 6); c.lineTo(0, 3); c.lineTo(-5.5, 6); c.closePath(); c.fill(); c.restore();
    c.strokeStyle = 'rgba(120,220,255,0.5)'; c.lineWidth = 1.5; c.beginPath(); c.arc(S / 2, S / 2, S / 2 - 2, 0, 6.283); c.stroke();
  }
}
