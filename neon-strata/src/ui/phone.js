// The player's phone: a real device in the hand (P / the phone button). Status bar with the city's time, signal and
// battery, a home screen with widgets, and apps that do the real things: messages, a city map, jobs, the bank,
// stocks, the camera and gallery, settings, plus shortcuts to trading, business and the garage.
import { fmt, COMMODITIES } from '../game/game.js';

const ICON = {
  msg: '<path d="M4 6h16v10H9l-5 4z" fill="#fff"/>',
  map: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" fill="none" stroke="#fff" stroke-width="2"/><path d="M9 4v14M15 6v14" stroke="#fff" stroke-width="2"/>',
  jobs: '<rect x="3" y="7" width="18" height="12" rx="2" fill="#fff"/><path d="M9 7V5h6v2" fill="none" stroke="#fff" stroke-width="2"/>',
  bank: '<path d="M3 9l9-5 9 5zM5 10h2v7H5zm5 0h2v7h-2zm5 0h2v7h-2zM3 18h18v2H3z" fill="#fff"/>',
  stock: '<path d="M3 17l5-6 4 3 7-8" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><path d="M15 6h4v4" fill="none" stroke="#fff" stroke-width="2.4"/>',
  cam: '<rect x="3" y="7" width="18" height="12" rx="3" fill="#fff"/><circle cx="12" cy="13" r="3.6" fill="#222"/><rect x="8" y="5" width="8" height="3" rx="1" fill="#fff"/>',
  photo: '<rect x="4" y="4" width="16" height="16" rx="3" fill="#fff"/><path d="M6 17l4-5 3 3 2-2 3 4z" fill="#333"/><circle cx="15" cy="8.5" r="1.6" fill="#333"/>',
  set: '<circle cx="12" cy="12" r="3" fill="none" stroke="#fff" stroke-width="2"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M5 19l3-3M16 8l3-3" stroke="#fff" stroke-width="2"/>',
  trade: '<path d="M4 8h13l-3-3M20 16H7l3 3" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>',
  biz: '<path d="M4 20V9l8-5 8 5v11h-5v-6H9v6z" fill="#fff"/>',
  car: '<path d="M4 15l2-5h12l2 5v3H4z" fill="#fff"/><circle cx="8" cy="18" r="1.6" fill="#333"/><circle cx="16" cy="18" r="1.6" fill="#333"/>',
  rank: '<path d="M5 20V12h3v8zm5.5 0V6h3v14zM16 20V9h3v11z" fill="#fff"/>',
};
const APPS = [
  ['msg', '메시지', '#2fc35a,#1a9a43'], ['map', '지도', '#4aa3ff,#1f6fd1'], ['jobs', '일자리', '#ff9f43,#e2711d'], ['bank', '럭스뱅크', '#7d5cff,#5034c9'],
  ['stock', '증권', '#1c1c1e,#3a3a3c'], ['cam', '카메라', '#8e8e93,#5d5d62'], ['photo', '사진', '#ffd34d,#f08c2a'], ['set', '설정', '#8e8e93,#636366'],
  ['trade', '거래', '#18b6a4,#0f8577'], ['biz', '사업', '#e04f7a,#b22c57'], ['car', '차고', '#5a6c80,#3a4a5c'], ['rank', '서열', '#c49a3a,#8f6a1c'],
];
const icon = (id, grad) => { const [a, b] = grad.split(','); return `<span class="ph-ic" style="background:linear-gradient(160deg,${a},${b})"><svg viewBox="0 0 24 24">${ICON[id]}</svg></span>`; };
const DAYS = ['일', '월', '화', '수', '목', '금', '토'];
// people you know answer you back
const REPLY = { '민지': { '좋아, 끝나고 갈게': '오케이 ㅎㅎ 루미나 3번 출구 앞에서 봐', '이번 주는 일이 많아': '에이 그래도 밥은 먹고 다녀라', '거기 비 많이 와?': '여기도 산성비 장난 아님 우산 챙겨' }, '집주인 박씨': { '네, 이번 주 안에 드릴게요': '그래요. 수도관 공사 있으니 참고하고', '보일러가 고장났어요': '기사 불러 둘게요. 오후에 들를 겁니다' }, '집주인': { '잘 부탁드립니다': '네네 이웃들이랑 사이좋게 지내요', '언제 정산하나요?': '매주 첫날 아침에 계좌에서 빠져나갑니다' } };

export class Phone {
  constructor(game, input, hud, engine) {
    Object.assign(this, { g: game, input, hud, engine }); this.open = false; this.app = 'home'; this.day = 0; this.lastHour = game.env.hour; this.photos = []; this.inbox = []; this.ledger = []; this.lastLux = game.state.lux; this.mapZoom = 1; this.mapOff = { x: 0, z: 0 }; this.replies = {};
    const el = document.createElement('div'); el.id = 'phone'; el.innerHTML = `<div class="ph-body"><i class="ph-k k1"></i><i class="ph-k k2"></i><i class="ph-k k3"></i><i class="ph-k k4"></i>
      <div class="ph-screen"><div class="ph-status"><span class="ph-time"></span><span class="ph-island"><i></i></span><span class="ph-sys"><svg viewBox="0 0 18 12" class="ph-sig"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg><b class="ph-net">6G</b><span class="ph-bat"><i></i></span></span></div>
      <div class="ph-view"></div><div class="ph-homebar"></div><div class="ph-flash"></div></div><div class="ph-glare"></div></div>`;
    document.body.appendChild(el); this.el = el; this.view = el.querySelector('.ph-view');
    el.addEventListener('click', (e) => { const t = e.target.closest('[data-a]'); if (t) { e.stopPropagation(); this._act(t.dataset.a, t.dataset); } });
    el.querySelector('.ph-homebar').addEventListener('click', () => this.go('home'));
    el.addEventListener('pointerdown', (e) => { this._down = true; const m = e.target.closest('.pa-map'); if (m) { this._drag = { x: e.clientX, y: e.clientY }; m.setPointerCapture?.(e.pointerId); } });
    window.addEventListener('pointerup', () => { this._down = false; this._drag = null; });
    el.addEventListener('pointermove', (e) => { if (!this._drag) return; const cv = this.view.querySelector('.pa-map'); if (!cv) return; const k = (cv.width / cv.clientWidth) / (0.45 * this.mapZoom); this.mapOff.x -= (e.clientX - this._drag.x) * k; this.mapOff.z -= (e.clientY - this._drag.y) * k; this._drag = { x: e.clientX, y: e.clientY }; this.drawMap(); });
    el.addEventListener('wheel', (e) => { if (this.app === 'map') { e.preventDefault(); this.mapZoom = Math.max(0.25, Math.min(8, this.mapZoom * (e.deltaY < 0 ? 1.15 : 0.87))); this.drawMap(); } }, { passive: false });
    for (const ev of ['mousedown', 'touchstart', 'touchmove', 'keydown']) el.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
    // capture what happens to the player as messages and bank entries
    const toast = game.toast.bind(game); game.toast = (text, kind = '') => { toast(text, kind); this._msg(kind === 'bad' ? '카이로스 경보' : kind === 'good' ? '카이로스 알림' : '시스템', text); };
    const earn = game.earn.bind(game); game.earn = (n, why) => { earn(n, why); this.ledger.unshift({ t: this.clock(), d: n, why: why || '입금' }); this.lastLux = game.state.lux; };
    this._msg('집주인 박씨', '캡슐텔 0번지 월세는 매주 정산합니다. 늦지 마세요.'); this._msg('민지', '야 이번 주말에 루미나 쪽 야시장 갈래? 일 끝나면 연락해');
    this._msg('구인 매칭', '근처 가게와 기관의 구인 공고를 일자리 앱에서 확인하세요. 출근은 직접 가서 기록합니다.');
  }
  clock() { const h = this.g.env.hour; return `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`; }
  date() { const base = new Date(2049, 10, 15 + this.day); return `${base.getMonth() + 1}월 ${base.getDate()}일 ${DAYS[base.getDay()]}요일`; }
  _msg(from, text) { let th = this.inbox.find((t) => t.from === from); if (!th) { th = { from, items: [], unread: 0 }; this.inbox.unshift(th); } else { this.inbox.splice(this.inbox.indexOf(th), 1); this.inbox.unshift(th); } th.items.push({ t: this.clock(), text }); if (th.items.length > 40) th.items.shift(); th.unread++; if (this.open && this.app === 'home') this.render(); }
  toggle(force) {
    this.open = force ?? !this.open; this.el.classList.toggle('show', this.open); document.body.classList.toggle('phone-open', this.open); this.input.enabled = !this.open && !this.hud.open;
    if (this.open) { document.exitPointerLock?.(); this.app = 'home'; this.render(); this.g.audio?.blip(990, 0.04); }
  }
  back() { if (this.app === 'home') return this.toggle(false); if (this.app.startsWith('th:')) return this.go('msg'); if (this.app === 'photo' && this.viewing != null) { this.viewing = null; return this.render(true); } this.go('home'); }
  go(app) { const prev = this.app; this.app = app; this._last = null; this.view.classList.remove('enter', 'exit'); void this.view.offsetWidth; this.view.classList.add(app === 'home' && prev !== 'home' ? 'exit' : 'enter'); this.g.audio?.blip(app === 'home' ? 520 : 760, 0.02); if (app === 'map') this.mapOff = { x: 0, z: 0 }; if (app === 'msg' || app.startsWith('th:')) { const th = this.inbox.find((t) => 'th:' + t.from === app); if (th) th.unread = 0; } if (app === 'jobs' && !this.g.job && !this.g.offers.length) this.g.rollOffers(); this.render(); }
  _act(a, d) {
    const g = this.g;
    if (a === 'app') { const id = d.id; if (id === 'trade' || id === 'biz' || id === 'rank') { this.toggle(false); this.hud.toggle(id === 'rank' ? 'rank' : id); return; } if (id === 'car') { this.toggle(false); this.hud.toggle('garage'); return; } this.go(id); return; }
    if (a === 'home') return this.back();
    if (a === 'snap') return this.shoot();
    if (a === 'center') { this.mapOff = { x: 0, z: 0 }; return this.drawMap(); }
    if (a === 'reply') { const th = this.inbox.find((t) => t.from === d.f); if (th) { th.items.push({ t: this.clock(), text: d.t, me: true }); this.replies[d.f] = (this.replies[d.f] || 0) + 1; const ans = REPLY[d.f] && REPLY[d.f][d.t]; if (ans) setTimeout(() => { this._msg(d.f, ans); }, 1600 + Math.random() * 1800); } this._last = null; return this.render(); }
    if (a === 'thread') return this.go('th:' + d.f);
    if (a === 'accept') { g.accept(+d.i); this.toggle(false); return; }
    if (a === 'reroll') { g.offers = []; g.rollOffers(); }
    if (a === 'cancel') g.cancelJob();
    if (a === 'zoom') this.mapZoom = Math.max(0.25, Math.min(8, this.mapZoom * (+d.k)));
    if (a === 'share') g.tradeShares(d.id, +d.n);
    if (a === 'sens') { g.player.sens = +d.v; try { localStorage.setItem('ns.sens', d.v); } catch (e) { /* ignore */ } }
    if (a === 'q') { try { localStorage.setItem('ns.quality', d.q); } catch (e) { /* ignore */ } location.search = ''; }
    if (a === 'view') { const p = this.photos[+d.i]; if (p) { this.viewing = +d.i; } }
    if (a === 'unview') this.viewing = null;
    this.render();
  }
  // camera: hide the UI for a frame, grab the picture, flash
  shoot() {
    const r = this.engine.renderer; this.el.classList.add('snap'); document.body.classList.add('photo');
    requestAnimationFrame(() => { try { this.engine.render(0); const c = r.domElement; const t = document.createElement('canvas'); t.width = 360; t.height = Math.round(360 * c.height / c.width); t.getContext('2d').drawImage(c, 0, 0, t.width, t.height); this.photos.unshift({ src: t.toDataURL('image/jpeg', 0.82), t: this.clock(), where: this.g.district().name }); if (this.photos.length > 24) this.photos.pop(); } catch (e) { /* ignore */ }
      document.body.classList.remove('photo'); this.el.classList.remove('snap'); const f = this.el.querySelector('.ph-flash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); this.g.audio?.blip(1500, 0.03); this._last = null; this.render(true); });
  }
  update(dt) {
    const g = this.g, s = g.state; const h = g.env.hour; if (h < this.lastHour - 12) this.day++; this.lastHour = h;
    if (s.lux < this.lastLux - 0.5) this.ledger.unshift({ t: this.clock(), d: -(this.lastLux - s.lux), why: '결제 · 지출' }); this.lastLux = s.lux; if (this.ledger.length > 60) this.ledger.length = 60;
    if (g.news !== this._news) { this._news = g.news; if (g.news) this._msg('카이로스 뉴스', g.news); }
    if (!this.open) return;
    this.el.querySelector('.ph-time').textContent = this.clock();
    const bat = Math.max(9, 100 - ((s.playtime || 0) / 45) % 92); const b = this.el.querySelector('.ph-bat i'); b.style.width = bat + '%'; b.classList.toggle('lo', bat < 20);
    this._t = (this._t || 0) + dt; if (this._t > 1.0 && !this._down) { this._t = 0; if (this.app === 'home' || this.app === 'jobs' || this.app === 'bank' || this.app === 'stock' || this.app === 'msg' || this.app.startsWith('th:')) this.render(); }
    if (this.app === 'map') this.drawMap();
    if (this.app === 'cam') { const vf = this.view.querySelector('.pa-vf'); if (vf) { const c = this.engine.renderer.domElement; const x = vf.getContext('2d'); const sw = c.height * (vf.width / vf.height); try { x.drawImage(c, (c.width - sw) / 2, 0, sw, c.height, 0, 0, vf.width, vf.height); } catch (e) { /* ignore */ } } }
  }
  render(force) {
    const g = this.g, s = g.state; const unread = this.inbox.reduce((n, t) => n + t.unread, 0); let h = '';
    const bar = (title, right = '') => `<div class="pa-bar"><button class="pa-back" data-a="home">‹</button><b>${title}</b><span>${right}</span></div>`;
    const rain = g.env.weather.rain; const temp = Math.round(9 + 7 * Math.sin(((g.env.hour - 9) / 24) * 6.283) - rain * 3);
    if (this.app === 'home') {
      h = `<div class="ph-home"><div class="w-clock"><div class="w-date">${this.date()}</div><div class="w-time">${this.clock()}</div></div>
        <div class="w-row"><div class="w-card"><small>${g.district().name}</small><b>${temp}°</b><span>${rain > 0.6 ? '강한 비' : rain > 0.2 ? '비' : '흐림'} · 산성도 ${(rain * 3.1 + 1.2).toFixed(1)}</span></div>
        <div class="w-card lux"><small>럭스 잔액</small><b>${fmt(s.lux)} ℓ</b><span>${g.job ? '근무 중 · ' + (g.job.name || '') : '체력 ' + Math.round(s.energy ?? 100)}</span></div></div>
        <div class="ph-grid">${APPS.map(([id, n, c]) => `<button class="ph-app" data-a="app" data-id="${id}">${icon(id, c)}${id === 'msg' && unread ? `<i class="badge">${unread > 99 ? '99+' : unread}</i>` : ''}<span>${n}</span></button>`).join('')}</div>
        <div class="ph-dock">${['msg', 'map', 'jobs', 'cam'].map((id) => { const a = APPS.find((q) => q[0] === id); return `<button class="ph-app" data-a="app" data-id="${id}">${icon(id, a[2])}</button>`; }).join('')}</div></div>`;
    } else if (this.app === 'msg') {
      h = bar('메시지') + `<div class="pa-list">${this.inbox.map((t) => `<button class="pa-row" data-a="thread" data-f="${t.from}"><span class="av">${t.from[0]}</span><span class="tx"><b>${t.from}</b><small>${t.items[t.items.length - 1].text}</small></span><span class="mt">${t.items[t.items.length - 1].t}${t.unread ? `<i class="dot">${t.unread}</i>` : ''}</span></button>`).join('')}</div>`;
    } else if (this.app.startsWith('th:')) {
      const th = this.inbox.find((t) => 'th:' + t.from === this.app); h = `<div class="pa-bar"><button class="pa-back" data-a="app" data-id="msg">‹</button><b>${th ? th.from : ''}</b><span></span></div><div class="pa-chat">${th ? th.items.map((m) => `<div class="bub${m.me ? ' me' : ''}"><p>${m.text}</p><small>${m.t}</small></div>`).join('') : ''}</div>${th && REPLY[th.from] ? `<div class="pa-qr">${Object.keys(REPLY[th.from]).map((t) => `<button data-a="reply" data-f="${th.from}" data-t="${t}">${t}</button>`).join('')}</div>` : ''}`;
    } else if (this.app === 'map') {
      h = bar('지도', g.district().name) + `<canvas class="pa-map" width="560" height="820"></canvas><div class="pa-zoom"><button data-a="zoom" data-k="1.6">+</button><button data-a="zoom" data-k="0.625">−</button><button data-a="center">◎</button></div>`;
    } else if (this.app === 'jobs') {
      const J = g.job;
      h = bar('일자리', `체력 ${Math.round(s.energy ?? 100)}`) + `<div class="pa-list">${J ? `<div class="pa-card on"><small>근무 중</small><b>${J.name} · ${J.item ? '' : ''}${J.trade ? J.trade.name : ''}</b><p>${g.jobLabel()}</p><button class="pa-btn ghost" data-a="cancel">근무 포기</button></div>` : ''}
        ${!J ? (g.offers.length ? g.offers.map((o, i) => `<div class="pa-card"><small>${o.gig ? '단기 일감' : o.trade.name + ' · ' + o.rankName}</small><b>${o.name}</b><p>${o.gig ? o.item + ' · ' + o.tasks.length + '곳' : '손님 응대 근무'} · ${Math.round(o.d)} m</p><div class="pa-row2"><span class="pay">${fmt(o.pay)} ℓ</span><button class="pa-btn" data-a="accept" data-i="${i}">지원</button></div></div>`).join('') : '<p class="pa-empty">지금 근처에 구인이 없습니다.<br>상점가로 이동해 보세요.</p>') + `<button class="pa-btn ghost wide" data-a="reroll">새로 고침</button>` : ''}</div>`;
    } else if (this.app === 'bank') {
      h = bar('럭스뱅크') + `<div class="pa-bank"><small>입출금 계좌 ··· 2049-0915</small><b>${fmt(s.lux)} ℓ</b><span>보유 화물 ${g.cargoUsed()} / ${g.cargoCap()} · 사업 ${Object.keys(s.biz).length}개</span></div>
        <div class="pa-list">${this.ledger.length ? this.ledger.map((e) => `<div class="pa-tx"><span>${e.why}<small>${e.t}</small></span><b class="${e.d < 0 ? 'neg' : ''}">${e.d < 0 ? '−' : '+'}${fmt(Math.abs(Math.round(e.d)))} ℓ</b></div>`).join('') : '<p class="pa-empty">거래 내역이 없습니다</p>'}</div>`;
    } else if (this.app === 'stock') {
      h = bar('증권') + `<div class="pa-list">${Object.keys(g.stock).map((k) => { const hist = g.stockHist[k] || []; const v = g.stock[k]; const v0 = hist.length ? hist[0] : v; const ch = ((v - v0) / v0) * 100; const pts = hist.slice(-40); const mn = Math.min(...pts, v), mx = Math.max(...pts, v); const path = pts.map((q, i) => `${(i / Math.max(1, pts.length - 1)) * 70},${22 - ((q - mn) / Math.max(1e-6, mx - mn)) * 20}`).join(' ');
        return `<div class="pa-stock"><span><b>${k.toUpperCase()}</b><small>보유 ${s.shares[k] || 0}주</small></span><svg viewBox="0 0 70 24"><polyline points="${path}" fill="none" stroke="${ch >= 0 ? '#ff5a5a' : '#4a90ff'}" stroke-width="1.6"/></svg><span class="px"><b>${fmt(Math.round(v))}</b><small class="${ch >= 0 ? 'up' : 'dn'}">${ch >= 0 ? '+' : ''}${ch.toFixed(2)}%</small></span><span class="bs"><button data-a="share" data-id="${k}" data-n="1">매수</button><button data-a="share" data-id="${k}" data-n="-1">매도</button></span></div>`; }).join('')}</div>`;
    } else if (this.app === 'cam') {
      const last = this.photos[0];
      h = `<div class="pa-cam"><canvas class="pa-vf" width="360" height="640"></canvas><div class="cam-top"><span>사진</span><span>${g.district().name}</span></div><div class="cam-bot"><button class="cam-th" data-a="app" data-id="photo">${last ? `<img src="${last.src}" alt="최근 사진">` : ''}</button><button class="cam-sh" data-a="snap" aria-label="촬영"><i></i></button><button class="cam-x" data-a="home">완료</button></div></div>`;
    } else if (this.app === 'photo') {
      if (this.viewing != null && this.photos[this.viewing]) { const p = this.photos[this.viewing]; h = `<div class="pa-bar"><button class="pa-back" data-a="unview">‹</button><b>${p.where}</b><span>${p.t}</span></div><img class="pa-full" src="${p.src}" alt="사진">`; }
      else h = bar('사진', `${this.photos.length}장`) + (this.photos.length ? `<div class="pa-gal">${this.photos.map((p, i) => `<button data-a="view" data-i="${i}"><img src="${p.src}" alt="사진 ${i + 1}"></button>`).join('')}</div>` : '<p class="pa-empty">아직 찍은 사진이 없습니다.<br>카메라로 도시를 찍어 보세요.</p>');
    } else if (this.app === 'set') {
      const q = (() => { try { return localStorage.getItem('ns.quality') || '자동'; } catch (e) { return '자동'; } })();
      h = bar('설정') + `<div class="pa-list"><div class="pa-card"><small>마우스 감도</small><div class="pa-row2">${[0.6, 1, 1.4, 2].map((v) => `<button class="pa-btn ${Math.abs((g.player.sens || 1) - v) < 0.01 ? '' : 'ghost'}" data-a="sens" data-v="${v}">${v}</button>`).join('')}</div></div>
        <div class="pa-card"><small>그래픽 품질 · 현재 ${q}</small><div class="pa-row2">${['low', 'medium', 'high', 'ultra'].map((v) => `<button class="pa-btn ghost" data-a="q" data-q="${v}">${{ low: '낮음', medium: '보통', high: '높음', ultra: '최상' }[v]}</button>`).join('')}</div></div>
        <div class="pa-card"><small>기기</small><p>KAIROS ONE · 카이로스-9 통신망 6G<br>배터리는 숙소에서 쉬면 충전됩니다.</p></div></div>`;
    }
    if (!force && h === this._last) return; const keepScroll = this._lastApp === this.app ? this.view.scrollTop : 0; this._last = h; this._lastApp = this.app;
    this.view.innerHTML = h; const anim = this.view.classList.contains('enter') ? ' enter' : this.view.classList.contains('exit') ? ' exit' : ''; this.view.className = 'ph-view a-' + this.app.replace(':', '-').split('-')[0] + anim; this.view.scrollTop = this.app.startsWith('th:') ? 1e6 : keepScroll;
    if (this.app === 'map') this.drawMap();
    void COMMODITIES;
  }
  drawMap() {
    const cv = this.view.querySelector('.pa-map'); if (!cv) return; const c = cv.getContext('2d'); const W = cv.width, H = cv.height; const g = this.g, p = g.player.p, ctx = g.city.ctx;
    const k = 0.45 * this.mapZoom; const cx = p.x + this.mapOff.x, cz = p.z + this.mapOff.z; const T = (x, z) => [W / 2 + (x - cx) * k, H / 2 + (z - cz) * k];
    c.fillStyle = '#e9e6df'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#d5d1c7'; for (const b of ctx.blocks || []) { const q = b.corners; if (!q) continue; const a = T(q[0][0], q[0][1]); if (a[0] < -400 || a[0] > W + 400 || a[1] < -400 || a[1] > H + 400) continue; c.beginPath(); q.forEach((v, i) => { const t = T(v[0], v[1]); i ? c.lineTo(t[0], t[1]) : c.moveTo(t[0], t[1]); }); c.closePath(); c.fill(); }
    c.strokeStyle = '#fff'; c.lineCap = 'round';
    for (const s of ctx.streets || []) { c.lineWidth = Math.max(1, s.w * k * 0.9); c.beginPath(); s.pts.forEach((v, i) => { const t = T(v[0], v[1]); i ? c.lineTo(t[0], t[1]) : c.moveTo(t[0], t[1]); }); c.stroke(); }
    c.strokeStyle = '#f6c66b'; for (const r of ctx.roads || []) { c.lineWidth = Math.max(2, (r.w || 20) * k); c.beginPath(); r.pts.forEach((v, i) => { const t = T(v[0], v[1]); i ? c.lineTo(t[0], t[1]) : c.moveTo(t[0], t[1]); }); if (r.closed) c.closePath(); c.stroke(); }
    const dot = (x, z, col, r = 4) => { const t = T(x, z); if (t[0] < -10 || t[0] > W + 10 || t[1] < -10 || t[1] > H + 10) return; c.fillStyle = col; c.beginPath(); c.arc(t[0], t[1], r, 0, 6.283); c.fill(); };
    for (const o of g.pois) { if (o.type === 'hospital') dot(o.x, o.z, '#e5484d', 5); else if (o.type === 'hotel') dot(o.x, o.z, '#8e6cf0', 4); else if (o.type === 'school') dot(o.x, o.z, '#2e9e5b', 4); else if (o.type === 'station') dot(o.x, o.z, '#1f6fd1', 6); }
    const tg = g.jobTarget && g.jobTarget(); if (tg) { dot(tg.x, tg.z, '#ff8a00', 8); dot(tg.x, tg.z, '#fff', 3); }
    const yaw = g.player.camYaw || 0; const t = T(p.x, p.z); c.save(); c.translate(t[0], t[1]); c.rotate(-yaw + Math.PI); c.fillStyle = 'rgba(30,120,255,0.18)'; c.beginPath(); c.arc(0, 0, 26, 0, 6.283); c.fill(); c.fillStyle = '#1e78ff'; c.beginPath(); c.moveTo(0, -11); c.lineTo(8, 9); c.lineTo(0, 5); c.lineTo(-8, 9); c.closePath(); c.fill(); c.restore();
    c.fillStyle = 'rgba(0,0,0,0.55)'; c.font = '600 20px "NS UI", sans-serif'; c.fillText(`${Math.round(100 / k)} m`, 18, H - 22); c.fillRect(18, H - 16, 100, 4);
  }
}
