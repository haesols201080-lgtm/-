// 아스테리아 1부 — 화면 위 정보, 대화, 메뉴, 요리, 상점, 지도
'use strict';

const $ = id => document.getElementById(id);
const HUD = { w: 800, h: 600, dpr: 1 };
let ctx = null;
function circle(x, y, r, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
function rrect(x, y, w, h, r, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); ctx.fill(); }
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const UI = {
  modal: null, dlg: null, choice: null, paper: null, promptEl: null,
  init() {
    ctx = $('hud').getContext('2d');
    this.promptEl = $('prompt');
    $('btnNew').onclick = () => { Audio_.unlock(); this.startNew(); };
    $('btnCont').onclick = () => { Audio_.unlock(); const s = loadSave(); if (s) { $('title').hidden = true; applySave(s); this.showTouch(); } };
    $('btnConfirmNew').onclick = () => { $('confirmNew').hidden = true; this.reallyNew(); };
    $('btnCancelNew').onclick = () => { $('confirmNew').hidden = true; };
    $('btnHelp').onclick = () => { $('help').hidden = !$('help').hidden; };
    if (!loadSave()) $('btnCont').hidden = true;
    const clickAdvance = e => { if (this.dlg || this.paper) { e.preventDefault(); this.advance(); } };
    $('dlg').addEventListener('pointerdown', clickAdvance);
    $('paper').addEventListener('pointerdown', clickAdvance);
    $('panelClose').onclick = () => this.closePanel();
    $('mapClose').onclick = () => this.closeMap();
    $('mapScreen').addEventListener('pointerdown', e => { if (e.target.id === 'mapScreen') this.closeMap(); });
    document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => this.menuTab(b.dataset.tab));
    $('btnTouchMenu').onclick = () => { if (G.mode === 'play' && !G.lock && !this.modal) this.openMenu(); };
    $('btnTouchMap').onclick = () => { if (G.mode === 'play' && !G.lock && !this.modal) this.openMap(); };
    document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('.sndBtn'); if (!b) return; Audio_.muted = !Audio_.muted; document.querySelectorAll('.sndBtn').forEach(x => x.textContent = Audio_.muted ? '소리 켜기' : '소리 끄기'); });
    const touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    this.touch = touch;
    document.body.classList.toggle('touch', !!touch);
  },
  showTouch() { $('touch').hidden = !this.touch; $('hudBtns').hidden = false; },
  startNew() {
    if (loadSave()) { $('confirmNew').hidden = false; return; }
    this.reallyNew();
  },
  reallyNew() { $('title').hidden = true; newGame(); this.showTouch(); },

  // ----- 대화 -----
  say(who, text, o = {}) {
    return new Promise(res => {
      const el = $('dlg');
      el.hidden = false;
      el.className = 'dlg' + (o.cls ? ' ' + o.cls : '') + (who === '렌' ? ' ren' : '');
      el.querySelector('.who').textContent = who || '';
      el.querySelector('.who').hidden = !who;
      this.dlg = { res, full: text, n: 0, el: el.querySelector('.txt'), t: 0, auto: o.auto };
      this.dlg.el.textContent = '';
      el.querySelector('.more').style.visibility = 'hidden';
    });
  },
  advance() {
    if (this.paper) { const p = this.paper; this.paper = null; $('paper').hidden = true; p.res(); sfx('blip'); return; }
    const d = this.dlg; if (!d) return;
    if (d.n < d.full.length) { d.n = d.full.length; d.el.textContent = d.full; return; }
    this.dlg = null; $('dlg').hidden = true; d.res(); sfx('blip');
  },
  choose(prompt, opts) {
    return new Promise(res => {
      const el = $('choice');
      el.innerHTML = (prompt ? `<div class="cq">${esc(prompt)}</div>` : '') + opts.map((o, i) => `<button class="copt" id="copt${i}" data-i="${i}">${esc(o)}</button>`).join('');
      el.hidden = false;
      this.choice = { res, n: opts.length, i: 0 };
      el.querySelectorAll('.copt').forEach(b => b.onclick = () => this.pickChoice(+b.dataset.i));
      this.hiChoice();
    });
  },
  hiChoice() { $('choice').querySelectorAll('.copt').forEach((b, i) => b.classList.toggle('hi', i === this.choice.i)); },
  pickChoice(i) { const c = this.choice; if (!c) return; this.choice = null; $('choice').hidden = true; sfx('blip'); c.res(i); },
  paperShow(title, body, cls) {
    return new Promise(res => {
      const el = $('paper');
      el.className = 'paper' + (cls ? ' ' + cls : '');
      el.querySelector('.ptitle').textContent = title;
      el.querySelector('.pbody').innerHTML = esc(body).replace(/\n/g, '<br>');
      el.hidden = false;
      this.paper = { res, t: 0 };
    });
  },
  caption(text, s = 2.5) {
    const el = $('caption');
    el.textContent = text; el.classList.add('on');
    return new Promise(res => setTimeoutG(() => { el.classList.remove('on'); setTimeoutG(res, 0.5); }, s));
  },
  toast(text, quiet) {
    const el = document.createElement('div');
    el.className = 'toast' + (quiet ? ' quiet' : '');
    el.textContent = text;
    const box = $('toasts');
    box.appendChild(el);
    while (box.children.length > 4) box.firstChild.remove();
    setTimeout(() => el.classList.add('out'), quiet ? 1600 : 2600);
    setTimeout(() => el.remove(), quiet ? 2100 : 3200);
  },
  banner(text) {
    const el = $('banner');
    el.textContent = text; el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
  },
  prompt(e, text) {
    const el = this.promptEl;
    if (!e || !text) { el.hidden = true; return; }
    const pr = project(e.x, e.y + (e.fly ? 0.8 : 2.1), e.z);
    if (!pr.on) { el.hidden = true; return; }
    const x = pr.x, y = pr.y;
    el.hidden = false;
    el.innerHTML = `<b>${this.touch ? '◎' : 'E'}</b> ${esc(text)}`;
    el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -100%)`;
  },
  update(dt) {
    if (this.dlg) {
      const d = this.dlg;
      d.t += dt;
      const before = d.n;
      d.n = Math.min(d.full.length, d.n + dt * 42 + (Input.key('attack') ? dt * 60 : 0));
      if ((d.n | 0) !== (before | 0)) { d.el.textContent = d.full.slice(0, d.n | 0); if ((d.n | 0) % 3 === 0) sfx('blip'); }
      if (d.n >= d.full.length) $('dlg').querySelector('.more').style.visibility = 'visible';
      if (Input.hit('act') || Input.hit('attack') || Input.hit('esc')) this.advance();
      return;
    }
    if (this.paper) { this.paper.t += dt; if (this.paper.t > 0.3 && (Input.hit('act') || Input.hit('attack') || Input.hit('esc'))) this.advance(); return; }
    if (this.choice) {
      const c = this.choice;
      if (Input.hit('up') || Input.hit('left')) { c.i = (c.i + c.n - 1) % c.n; this.hiChoice(); sfx('blip'); }
      if (Input.hit('down') || Input.hit('right')) { c.i = (c.i + 1) % c.n; this.hiChoice(); sfx('blip'); }
      if (Input.hit('act') || Input.hit('attack')) this.pickChoice(c.i);
      return;
    }
    if (this.modal === 'panel' && (Input.hit('menu') || Input.hit('esc'))) this.closePanel();
    else if (this.modal === 'map' && (Input.hit('map') || Input.hit('esc') || Input.hit('menu'))) this.closeMap();
    if (G.mode === 'play' && G.f.holdSit !== undefined && this.sitHold) this.sitHold(dt);
    $('obj').textContent = G.obj ? '◆ ' + G.obj : '';
    $('obj').hidden = !G.obj || G.mode !== 'play';
  },

  // ----- 화면 위 정보 -----
  drawHUD() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.setTransform(HUD.dpr, 0, 0, HUD.dpr, 0, 0);
    if (G.mode === 'play' && G.map) { drawScreenFx(); drawLabels(); }
    if (G.mode === 'play' && !G.lock && !this.modal && G.map) { const it = interactTarget(); this.prompt(it, it ? (ET[it.type].prompt ? ET[it.type].prompt(it) : '살펴보기') : null); } else this.prompt(null);
    if (G.showPendant) drawPendant();
    if (G.fade > 0.003) { ctx.fillStyle = G.fadeWhite ? `rgba(255,255,255,${G.fade})` : `rgba(8,6,16,${G.fade})`; ctx.fillRect(0, 0, HUD.w, HUD.h); }
    if (G.mode !== 'play' || G.f.hideHud || !P) return;
    const pad = 14;
    // 하트
    const hearts = Math.ceil(P.maxhp / 4);
    for (let i = 0; i < hearts; i++) {
      const x = pad + 10 + (i % 10) * 22, y = pad + 10 + Math.floor(i / 10) * 20;
      const fill = clamp(P.hp - i * 4, 0, 4) / 4;
      drawHeart(x, y, 9, fill);
    }
    // 마력
    const my = pad + 10 + Math.ceil(hearts / 10) * 20 + 2, mw = 150 * (G.maxMana / 100);
    rrect(pad, my, mw + 4, 10, 5, 'rgba(22,20,44,0.62)');
    const mg = ctx.createLinearGradient(pad, 0, pad + mw, 0); mg.addColorStop(0, '#3ab8d8'); mg.addColorStop(1, '#bff8ff');
    rrect(pad + 2, my + 2, mw * clamp(G.mana / G.maxMana, 0, 1), 6, 3, mg);
    if (P.onLey) { ctx.fillStyle = '#bff8ff'; ctx.font = '600 11px "IBM Plex Sans KR", sans-serif'; ctx.textAlign = 'left'; ctx.fillText('지맥 · 마력이 차오른다', pad + mw + 12, my + 9); }
    // 스태미나 바퀴 (줄어들 때만)
    if (P.st < P.maxst - 0.5 || P.exhausted) {
      const pr = project(P.x, P.vis + 1.6, P.z), px = pr.x + 46, py = pr.y - 30;
      ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(20,20,30,0.5)';
      ctx.beginPath(); ctx.arc(px, py, 12, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = P.exhausted ? '#ff6a4a' : (P.st < P.maxst * 0.25 ? '#ffd25a' : '#7aef7a');
      ctx.beginPath(); ctx.arc(px, py, 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (P.st / P.maxst)); ctx.stroke();
    }
    // 오른쪽 위: 온도, 시간
    const t = airTemp(), felt = feltTemp();
    const rx = HUD.w - pad - 64;
    rrect(rx - 6, pad, 70, 58, 10, 'rgba(22,20,44,0.62)');
    const cold = G.coldDef > 0;
    ctx.fillStyle = cold ? '#9fd8ff' : felt > 26 ? '#ffb35a' : '#e8f0e0';
    ctx.font = '700 17px "IBM Plex Sans KR", sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(`${t}°C`, rx + 18, pad + 22);
    // 온도계
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(rx + 4, pad + 8, 5, 18);
    ctx.fillStyle = cold ? '#7ac8ff' : '#ff7a5a'; const fh = clamp((t + 20) / 50, 0.05, 1) * 18; ctx.fillRect(rx + 4, pad + 26 - fh, 5, fh); circle(rx + 6.5, pad + 28, 4, cold ? '#7ac8ff' : '#ff7a5a');
    const h = Math.floor(G.time / 60), mi = Math.floor(G.time % 60);
    ctx.font = '500 12px "IBM Plex Sans KR", sans-serif'; ctx.fillStyle = '#cfd8e8';
    ctx.fillText(`${G.night > 0.5 ? '☾' : '☀'} ${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`, rx + 4, pad + 48);
    if (G.warmT > 0) { ctx.fillStyle = '#ffb35a'; ctx.fillText('온기 ' + Math.ceil(G.warmT) + '초', rx - 2, pad + 74); }
    if (G.f.furcoat) { ctx.fillStyle = '#d8c8a8'; ctx.fillText('털 외투', rx + 4, pad + (G.warmT > 0 ? 90 : 74)); }
    // 위 가운데: 공명석 나침반
    if (G.res) {
      const cx = HUD.w / 2, cy = pad + 22;
      const a = Math.atan2(G.res.y - P.y, G.res.x - P.x);
      const pulse = 1 + Math.max(0, 1 - G.res.ph * 3) * 0.25;
      rrect(cx - 26, pad, 52, 44, 12, 'rgba(22,20,44,0.62)');
      ctx.globalAlpha = 0.35 * pulse; circle(cx, cy, 15 * pulse, '#7ff0ff'); ctx.globalAlpha = 1;
      circle(cx, cy, 9, '#2a5a6a'); circle(cx, cy, 6, '#7ff0ff');
      ctx.strokeStyle = '#e8ffff'; ctx.lineWidth = 3; ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * 9, cy + Math.sin(a) * 9); ctx.lineTo(cx + Math.cos(a) * 19, cy + Math.sin(a) * 19); ctx.stroke();
      ctx.fillStyle = '#bfefff'; ctx.font = '500 10px "IBM Plex Sans KR", sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(G.map.world ? Math.round(G.res.d) + '칸' : '공명', cx, pad + 52);
    }
    // 왼쪽 아래: 룬
    const ks = Object.keys(RUNES).filter(k => G.runes[k]);
    const by = HUD.h - pad - 46 - (this.touch ? 150 : 0);
    if (ks.length) {
      rrect(pad, by - 4, ks.length * 40 + 8, 50, 12, 'rgba(22,20,44,0.62)');
      ks.forEach((k, i) => {
        const x = pad + 24 + i * 40, y = by + 20, on = G.rune === k, R_ = RUNES[k];
        circle(x, y, on ? 16 : 13, on ? R_.c : 'rgba(255,255,255,0.15)');
        ctx.fillStyle = on ? '#1a1430' : '#e8e8f8'; ctx.font = `700 ${on ? 13 : 11}px "IBM Plex Sans KR", sans-serif`; ctx.textAlign = 'center';
        ctx.fillText(R_.glyph, x, y + 4);
        if (!this.touch) { ctx.fillStyle = '#aab'; ctx.font = '500 9px sans-serif'; ctx.fillText(Object.keys(RUNES).indexOf(k) + 1, x + 12, y + 16); }
        if (k === 'magnes' && P.holding) { ctx.strokeStyle = '#ff5ab0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 18, 0, 7); ctx.stroke(); }
      });
      ctx.fillStyle = '#e8e8f8'; ctx.font = '600 11px "IBM Plex Sans KR", sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(RUNES[G.rune] ? RUNES[G.rune].name + ' 룬' + (this.touch ? '' : ' · Q') : '', pad + 6, by - 10);
    }
    // 오른쪽 아래: 무기
    const w = G.weapons[G.wi];
    const wx = HUD.w - pad - 150, wy = HUD.h - pad - 44 - (this.touch ? 150 : 0);
    rrect(wx, wy, 150, 44, 12, 'rgba(22,20,44,0.62)');
    ctx.textAlign = 'left'; ctx.font = '600 12px "IBM Plex Sans KR", sans-serif'; ctx.fillStyle = '#f0eee8';
    ctx.fillText(w ? WEAPONS[w.k].name : '맨손', wx + 12, wy + 18);
    if (w) { ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(wx + 12, wy + 27, 126, 5); const r = w.d / WEAPONS[w.k].dur; ctx.fillStyle = r < 0.25 ? '#ff6a4a' : '#d8c070'; ctx.fillRect(wx + 12, wy + 27, 126 * r, 5); }
    ctx.fillStyle = '#ffe08a'; ctx.font = '600 11px "IBM Plex Sans KR", sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(`빛화 ${G.coins}`, HUD.w - pad - 4, wy - 8);
    // 보스 체력
    if (G.boss && !G.boss.dead && G.boss.awake) {
      const bw = Math.min(420, HUD.w - 60), bx = HUD.w / 2 - bw / 2, byy = HUD.h - pad - 30 - (this.touch ? 160 : 60);
      ctx.fillStyle = '#f0eee8'; ctx.font = '700 13px "Gowun Batang", serif'; ctx.textAlign = 'center';
      ctx.fillText(G.boss.name, HUD.w / 2, byy - 6);
      rrect(bx, byy, bw, 9, 4, 'rgba(0,0,0,0.5)');
      rrect(bx, byy, bw * clamp(G.boss.hp / G.boss.maxhp, 0, 1), 9, 4, '#c8a0ff');
    }
    // 고원 불빛 수 (5장 사슬)
    if (G.f.chainsOpen && G.f.chainsLeft !== undefined) {
      ctx.fillStyle = '#ffe7a0'; ctx.font = '600 13px "IBM Plex Sans KR", sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(`고원의 불빛 ${G.f.chainsLeft} / 6`, HUD.w / 2, pad + 76);
    }
    // 수문 제한 시간 (4장 숨은 선택)
    if (G.f.manualStart && !G.f.manualDone) {
      const left = Math.max(0, Math.ceil(G.f.manualEnd - G.t));
      ctx.fillStyle = left < 15 ? '#ff8a6a' : '#9fd8ff'; ctx.font = '700 16px "IBM Plex Sans KR", sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(`물이 다시 차오른다 · ${left}초 · 구한 광부 ${G.f.rescued || 0}명`, HUD.w / 2, pad + 78);
    }
    // 심장 박동 비교 (5장)
    if (G.heartSync !== undefined) drawHeartbeats();
    // 번역 메모 (5장)
    if (G.map.id === 'prima' && G.f.transl) drawTranslation();
  },

  // ----- 메뉴 -----
  openMenu() { this.modal = 'panel'; $('panel').hidden = false; this.menuTab(this.tab || 'bag'); sfx('blip'); },
  closePanel() { this.modal = null; $('panel').hidden = true; Input.endFrame(); },
  menuTab(tab) {
    this.tab = tab;
    document.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    const box = $('panelBody');
    if (tab === 'bag') box.innerHTML = this.bagHTML();
    else if (tab === 'weapon') box.innerHTML = this.weaponHTML();
    else if (tab === 'journal') box.innerHTML = this.journalHTML();
    else if (tab === 'letters') box.innerHTML = this.lettersHTML();
    else if (tab === 'help') box.innerHTML = $('helpText').innerHTML;
    box.querySelectorAll('[data-eat]').forEach(b => b.onclick = () => { eatItem(b.dataset.eat); this.menuTab('bag'); });
    box.querySelectorAll('[data-drop]').forEach(b => b.onclick = () => { take(b.dataset.drop, 1); this.menuTab('bag'); });
    box.querySelectorAll('[data-equip]').forEach(b => b.onclick = () => { G.wi = +b.dataset.equip; sfx('blip'); this.menuTab('weapon'); });
    box.querySelectorAll('[data-wdrop]').forEach(b => b.onclick = () => { const i = +b.dataset.wdrop; G.weapons.splice(i, 1); if (G.wi >= G.weapons.length) G.wi = G.weapons.length - 1; this.menuTab('weapon'); });
    box.querySelectorAll('[data-read]').forEach(b => b.onclick = () => { const k = b.dataset.read; const j = JOURNAL[k]; this.closePanel(); runScript(async () => { await UI.paperShow(j.title, journalText(k), j.hand ? 'hand' : ''); }); });
    box.querySelectorAll('[data-letter]').forEach(b => b.onclick = () => { const L = G.letters[+b.dataset.letter]; this.closePanel(); runScript(async () => { await UI.paperShow(L.title, L.body, 'hand'); }); });
  },
  bagHTML() {
    const ks = Object.keys(G.inv).filter(k => G.inv[k] > 0);
    const keyItems = [];
    if (G.f.stone) keyItems.push(['공명석', G.f.stoneSilent ? '아무 소리도 내지 않는다.' : '오스윈이 렌의 맥박에 맞춰 조율한 펜던트. 가장 가까운 기관 쪽으로 울린다.']);
    if (G.f.coat) keyItems.push(['활공 외투', '높은 곳에서 F로 활공한다. 오스윈이 젊을 때 입던 관측대원 외투.']);
    if (G.f.furcoat) keyItems.push(['털 외투', '추위를 크게 덜어준다.']);
    if (G.torch) keyItems.push(['횃불', '어두운 곳을 밝히고 몸을 조금 데운다.']);
    if (G.f.map) keyItems.push(['대륙 지도', 'M으로 연다. 관측탑에 오르면 그 주변이 그려진다.']);
    let h = `<div class="stat">하트 ${(P.hp / 4).toFixed(2).replace(/\.?0+$/, '')} / ${P.maxhp / 4} · 스태미나 ${Math.round(P.maxst)} · 공명 결정 ${G.crystals || 0} / 4</div>`;
    if (keyItems.length) h += '<h4>소중한 물건</h4>' + keyItems.map(([n, d]) => `<div class="row"><b>${n}</b><span>${d}</span></div>`).join('');
    h += '<h4>재료와 요리</h4>';
    if (!ks.filter(k => k !== 'crystal').length) h += '<p class="empty">가방이 비어 있다. 덤불과 약초를 채집하자.</p>';
    for (const k of ks) {
      if (k === 'crystal' || k === 'torch') continue;
      const it = itemInfo(k);
      const eff = [];
      if (it.heal) eff.push('♥' + (it.heal / 4));
      if (it.warm) eff.push('온기 ' + it.warm + '초');
      if (it.stam) eff.push('스태미나 +' + it.stam);
      if (it.mana) eff.push('마력 +' + it.mana);
      h += `<div class="row"><b>${esc(it.name)} <em>×${G.inv[k]}</em></b><span>${eff.join(' · ') || esc(it.desc || '')}</span>${it.heal || it.warm || it.stam || it.mana ? `<button data-eat="${esc(k)}">먹기</button>` : ''}<button class="ghost" data-drop="${esc(k)}">버리기</button></div>`;
    }
    return h;
  },
  weaponHTML() {
    if (!G.weapons.length) return '<p class="empty">무기가 없다. 맨손 공격은 약하다.</p>';
    return G.weapons.map((w, i) => { const W = WEAPONS[w.k]; return `<div class="row ${i === G.wi ? 'cur' : ''}"><b>${W.name}</b><span>공격력 ${W.dmg} · 내구도 ${w.d}/${W.dur}</span>${i === G.wi ? '<em>장착 중</em>' : `<button data-equip="${i}">장착</button>`}<button class="ghost" data-wdrop="${i}">버리기</button></div>`; }).join('') + '<p class="note">룬을 새긴 무기는 마력이 다하면 부서진다.</p>';
  },
  journalHTML() {
    let h = `<h4>지금 할 일</h4><p>${esc(G.obj || '—')}</p>`;
    h += `<h4>기관</h4><div class="row"><b>마르셀라</b><span>${G.f.eng_marcella ? '수리 완료' : '비틀림'}</span></div><div class="row"><b>엘름바텐</b><span>${G.f.eng_elm ? (G.f.elm === 'full' ? '완전 수리' : '미완 (안정화)') : '비틀림'}</span></div><div class="row"><b>그라벤호프</b><span>${G.f.eng_grav ? ({ pump: '재가동 · 펌프', south: '재가동 · 학원 규격', manual: '재가동 · 직접 배수' }[G.f.grav]) : '멈춤'}</span></div>`;
    h += '<h4>수집한 기록</h4>';
    if (!G.journal.length) h += '<p class="empty">아직 없다.</p>';
    for (const k of G.journal) { const j = JOURNAL[k]; h += `<div class="row"><b>${esc(j.title)}</b><span>${esc(j.where)}</span><button data-read="${k}">읽기</button></div>`; }
    return h;
  },
  lettersHTML() {
    if (!G.letters.length) return '<p class="empty">아직 받은 편지가 없다.</p>';
    return G.letters.map((L, i) => `<div class="row"><b>${esc(L.title)}</b><span>${esc(L.from)}</span><button data-letter="${i}">읽기</button></div>`).join('');
  },

  // ----- 요리 -----
  openCook(fire) {
    this.modal = 'panel';
    $('panel').hidden = false;
    document.querySelectorAll('[data-tab]').forEach(b => b.classList.remove('on'));
    this.cookSel = [];
    this.renderCook();
  },
  renderCook() {
    const box = $('panelBody');
    const ks = Object.keys(G.inv).filter(k => G.inv[k] > 0 && ITEMS[k] && ITEMS[k].ing);
    const sel = this.cookSel;
    const cnt = k => sel.filter(s => s === k).length;
    let h = '<h4>화로 · 재료를 세 개까지 고른다</h4>';
    if (!ks.length) h += '<p class="empty">요리할 재료가 없다.</p>';
    h += '<div class="ings">' + ks.map(k => `<button class="ing ${cnt(k) ? 'on' : ''}" data-ing="${k}" ${G.inv[k] - cnt(k) <= 0 && !cnt(k) ? 'disabled' : ''}>${esc(ITEMS[k].name)} <em>${G.inv[k] - cnt(k)}</em>${cnt(k) ? ` <i>+${cnt(k)}</i>` : ''}</button>`).join('') + '</div>';
    const r = sel.length ? cookResult(sel) : null;
    h += `<div class="pot">${sel.length ? sel.map(k => esc(ITEMS[k].name)).join(' + ') : '냄비가 비어 있다'}</div>`;
    if (r) h += `<div class="preview">→ <b>${esc(r.name)}</b> · ♥${r.heal / 4}${r.warm ? ' · 온기 ' + r.warm + '초' : ''}${r.stam ? ' · 스태미나 +' + r.stam : ''}${r.mana ? ' · 마력 +' + r.mana : ''}</div>`;
    h += `<div class="acts"><button id="cookGo" ${sel.length ? '' : 'disabled'}>요리하기</button><button class="ghost" id="cookClear">비우기</button><button class="ghost" id="cookDone">닫기</button></div>`;
    box.innerHTML = h;
    box.querySelectorAll('[data-ing]').forEach(b => b.onclick = () => {
      const k = b.dataset.ing;
      if (cnt(k) && (G.inv[k] - cnt(k) <= 0 || sel.length >= 3)) { sel.splice(sel.indexOf(k), 1); }
      else if (sel.length < 3 && G.inv[k] - cnt(k) > 0) sel.push(k);
      sfx('blip'); this.renderCook();
    });
    $('cookClear').onclick = () => { this.cookSel = []; this.renderCook(); };
    $('cookDone').onclick = () => this.closePanel();
    $('cookGo').onclick = () => {
      const r = cookResult(sel);
      for (const k of sel) take(k, 1);
      const key = `dish|${r.name}|${r.heal}|${r.warm}|${r.stam}|${r.mana || 0}`;
      G.inv[key] = (G.inv[key] || 0) + 1;
      sfx('cook'); burst(P.x, P.y - 0.5, 14, '#ffd27a', 2, 0.7);
      this.cookSel = [];
      this.renderCook();
      $('panelBody').insertAdjacentHTML('afterbegin', `<div class="made">${esc(r.name)}을(를) 만들었다!</div>`);
      if (TALK.onCook) TALK.onCook(r, key);
    };
  },

  // ----- 상점 -----
  openShop(id) {
    const S_ = SHOPS[id];
    this.modal = 'panel'; $('panel').hidden = false;
    document.querySelectorAll('[data-tab]').forEach(b => b.classList.remove('on'));
    const box = $('panelBody');
    const render = () => {
      let h = `<h4>${esc(S_.name)}</h4><p class="note">가진 빛화: ${G.coins}</p>`;
      for (const [i, s] of S_.list.entries()) {
        const n = s.weapon ? WEAPONS[s.weapon].name : s.key ? s.label : ITEMS[s.item].name;
        const owned = s.key && G.f[s.key];
        h += `<div class="row"><b>${esc(n)}</b><span>${esc(s.desc || (s.item ? ITEMS[s.item].desc || '' : ''))}</span><em>${s.price} 빛화</em><button data-buy="${i}" ${owned || G.coins < s.price ? 'disabled' : ''}>${owned ? '보유' : '사기'}</button></div>`;
      }
      h += '<div class="acts"><button class="ghost" id="shopDone">닫기</button></div>';
      box.innerHTML = h;
      box.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => {
        const s = S_.list[+b.dataset.buy];
        if (G.coins < s.price) return;
        G.coins -= s.price;
        if (s.weapon) giveWeapon(s.weapon); else if (s.key) { G.f[s.key] = true; toast(s.label + '을(를) 샀다'); sfx('pick'); } else give(s.item, s.n || 1);
        render();
      });
      $('shopDone').onclick = () => this.closePanel();
    };
    render();
  },

  // ----- 지도 -----
  openMap() {
    if (G.map.kind === 'terrain' && !G.f.map) { toast('아직 지도가 없다'); return; }
    this.modal = 'map'; $('mapScreen').hidden = false; this.drawMap(); sfx('blip');
  },
  closeMap() { this.modal = null; $('mapScreen').hidden = true; Input.endFrame(); },
  drawMap() {
    const c = $('mapcv'), mc = c.getContext('2d');
    const world = G.map.kind === 'terrain', site = G.map.kind === 'site';
    const m = G.map;
    const W = world ? 256 : site ? m.nx : m.cw, H = world ? 192 : site ? m.nz : m.cd;
    const box = c.parentElement.getBoundingClientRect();
    const sc = Math.max(1, Math.min((box.width - 8) / W, (box.height - 10) / H));
    c.width = Math.floor(W * sc * HUD.dpr); c.height = Math.floor(H * sc * HUD.dpr);
    c.style.width = Math.floor(W * sc) + 'px'; c.style.height = Math.floor(H * sc) + 'px';
    const img = mc.createImageData(W, H), cc = new THREE.Color();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (world) {
        const wx = (x + 0.5) * 4, wz = (y + 0.5) * 4, vi = m.vi(Math.round(wx / 2), Math.round(wz / 2));
        if (!G.fog[y * FOG_W + x]) { img.data[i] = 222; img.data[i + 1] = 212; img.data[i + 2] = 186; img.data[i + 3] = 255; continue; }
        const h = m.h[vi];
        let r = m.col[vi * 3], g = m.col[vi * 3 + 1], b = m.col[vi * 3 + 2];
        if (h < 0.1 && !(m.fl[vi] & FL.VOID)) { r = 0.35; g = 0.6; b = 0.8; }
        const shade = 0.75 + clamp((m.ground(wx + 4, wz - 4) - h) * -0.06 + 0.25, 0, 0.5);
        img.data[i] = Math.min(255, r * 255 * shade); img.data[i + 1] = Math.min(255, g * 255 * shade); img.data[i + 2] = Math.min(255, b * 255 * shade); img.data[i + 3] = 255;
      } else if (site) {
        const vi = m.vi(x, y), h = m.h[vi];
        let r = m.col[vi * 3], g = m.col[vi * 3 + 1], b = m.col[vi * 3 + 2];
        if (m.wl[vi] > h) { r = 0.32; g = 0.5; b = 0.58; }
        if (m.fl[vi] & SF.COURT) { r = 0.78; g = 0.7; b = 0.58; }
        const shade = 0.8 + clamp((m.h[m.vi(Math.min(m.nx, x + 1), Math.max(0, y - 1))] - h) * 0.08, -0.3, 0.3);
        img.data[i] = Math.min(255, r * 255 * shade); img.data[i + 1] = Math.min(255, g * 255 * shade); img.data[i + 2] = Math.min(255, b * 255 * shade); img.data[i + 3] = 255;
      } else {
        const k = y * W + x; blockColor(m, m.ct[k], x, y, m.ch[k], cc);
        const sh = m.ch[k] > 2 ? 0.65 : 1;
        img.data[i] = cc.r * 255 * sh; img.data[i + 1] = cc.g * 255 * sh; img.data[i + 2] = cc.b * 255 * sh; img.data[i + 3] = 255;
      }
    }
    const off = document.createElement('canvas'); off.width = W; off.height = H; off.getContext('2d').putImageData(img, 0, 0);
    mc.imageSmoothingEnabled = world || site;
    mc.setTransform(1, 0, 0, 1, 0, 0);
    mc.drawImage(off, 0, 0, c.width, c.height);
    const k = world ? 4 : site ? m.res : m.cs;
    mc.setTransform(sc * HUD.dpr / k, 0, 0, sc * HUD.dpr / k, 0, 0);
    const dot = (x, y, r, col) => { mc.fillStyle = col; mc.beginPath(); mc.arc(x, y, r * k / sc + 1, 0, 7); mc.fill(); mc.strokeStyle = 'rgba(0,0,0,0.4)'; mc.lineWidth = k / sc; mc.stroke(); };
    if (world) {
      const seen = (x, y) => G.fog[Math.floor(y / 4) * FOG_W + Math.floor(x / 4)];
      for (const t of TOWERS) { const [x, z] = M_(t.u, t.v); if (seen(x, z)) dot(x, z, 4, isDone(t.id) ? '#3aa8b8' : '#d8783a'); }
      LABS.forEach(([u, v], i) => { const [x, z] = M_(u, v); if (seen(x, z)) dot(x, z, 3, isDone('lab:' + i) ? '#d8b040' : '#6a8ab8'); });
      const names = [['칼리도르', 100, 124], ['마르셀라', 34, 88], ['엘름바텐', 158, 80], ['그라벤호프', 100, 20], ['알테라 고원', 36, 22], ['리벤', 72, 54], ['오르타', 14, 50], ['브리그', 28, 54], ['세일른', 46, 50]];
      for (const [n, u, v] of names) { const [x, z] = M_(u, v); if (seen(x, z)) { mc.font = `700 ${13 * k / sc}px "Gowun Batang", serif`; mc.fillStyle = '#2a2238'; mc.textAlign = 'center'; mc.fillText(n, x, z + 30); } }
      const engs = [['eng_marcella', PLACES.cathedral], ['eng_elm', PLACES.clock], ['eng_grav', PLACES.mine]];
      for (const [f, [x, z]] of engs) if (seen(x, z) || G.f.map) dot(x, z, 5, G.f[f] ? '#7ff0ff' : '#ff5a6a');
      if (G.f.summons) dot(PLACES.prima[0], PLACES.prima[1], 5, G.f.primaStop ? '#555' : '#c0b0ff');
    }
    const px = P.x, py = P.z, a = Math.atan2(Math.cos(P.yaw), Math.sin(P.yaw)), s2 = 4 * k / sc + 3;
    mc.fillStyle = '#e83a5a'; mc.beginPath();
    mc.moveTo(px + Math.cos(a) * s2 * 1.3, py + Math.sin(a) * s2 * 1.3); mc.lineTo(px + Math.cos(a + 2.4) * s2, py + Math.sin(a + 2.4) * s2); mc.lineTo(px + Math.cos(a - 2.4) * s2, py + Math.sin(a - 2.4) * s2); mc.fill();
    mc.strokeStyle = '#fff'; mc.lineWidth = k / sc; mc.stroke();
    $('mapTitle').textContent = world ? '대륙 아스테리아' : (G.map.name || mapTitle(G.map.id));
    $('mapLegend').innerHTML = world ? '<span class="lg a"></span>밝힌 탑 <span class="lg b"></span>안 밝힌 탑 <span class="lg c"></span>비틀린 기관 <span class="lg d"></span>고친 기관 <span class="lg e"></span>실험실' : '';
  },

};
const say = (w, t, o) => UI.say(w, t, o);
const choose = (p, o) => UI.choose(p, o);
const caption = (t, s) => UI.caption(t, s);
const toast = (t, q) => UI.toast(t, q);
const banner = t => UI.banner(t);
function openCook(e) { UI.openCook(e); }

function drawHeart(x, y, r, fill) {
  const path = () => { ctx.beginPath(); ctx.moveTo(x, y + r * 0.9); ctx.bezierCurveTo(x - r * 1.6, y - r * 0.2, x - r * 0.6, y - r * 1.3, x, y - r * 0.4); ctx.bezierCurveTo(x + r * 0.6, y - r * 1.3, x + r * 1.6, y - r * 0.2, x, y + r * 0.9); ctx.closePath(); };
  path(); ctx.fillStyle = 'rgba(30,20,40,0.55)'; ctx.fill();
  if (fill > 0) {
    ctx.save(); path(); ctx.clip();
    ctx.fillStyle = '#ff4a6a';
    // 4분의 1씩: 시계 방향으로 채운다
    ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, r * 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * fill); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  path(); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.2; ctx.stroke();
}
function drawHeartbeats() {
  const w = Math.min(320, HUD.w - 40), x0 = HUD.w / 2 - w / 2, y0 = 90;
  rrect(x0 - 10, y0 - 22, w + 20, 82, 12, 'rgba(22,20,44,0.7)');
  ctx.font = '600 11px "IBM Plex Sans KR", sans-serif'; ctx.textAlign = 'left';
  const line = (yy, f, ph, col, label) => {
    ctx.fillStyle = col; ctx.fillText(label, x0, yy - 8);
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath();
    for (let i = 0; i <= w; i += 2) {
      const tt = G.t * f - i / w * 3 + ph, p = tt - Math.floor(tt);
      const v = p < 0.08 ? -Math.sin(p / 0.08 * Math.PI) * 12 : p < 0.14 ? Math.sin((p - 0.08) / 0.06 * Math.PI) * 5 : 0;
      i ? ctx.lineTo(x0 + i, yy + v) : ctx.moveTo(x0 + i, yy + v);
    }
    ctx.stroke();
  };
  line(y0 + 6, 1.4, 0, '#ff8aa0', '렌의 맥박');
  line(y0 + 44, lerp(0.9, 1.4, G.heartSync), 0, '#7ff0ff', '공명석');
}
function drawTranslation() {
  const rows = TRANSLATION.filter((r, i) => i < (G.f.steles || 0) + 1);
  const w = 230, x0 = HUD.w - w - 14, y0 = 120;
  rrect(x0, y0, w, 30 + rows.length * 34, 10, 'rgba(244,236,214,0.92)');
  ctx.fillStyle = '#4a3a2a'; ctx.font = '700 12px "Gowun Batang", serif'; ctx.textAlign = 'left';
  ctx.fillText('렌의 번역 메모', x0 + 12, y0 + 20);
  rows.forEach((r, i) => {
    const y = y0 + 40 + i * 34, done = i < (G.f.steles || 0);
    ctx.font = '700 12px "IBM Plex Sans KR", sans-serif'; ctx.fillStyle = '#2a2238'; ctx.fillText(r.word, x0 + 12, y);
    ctx.font = '500 12px "IBM Plex Sans KR", sans-serif';
    ctx.fillStyle = done ? '#9a8a7a' : '#2a2238';
    ctx.fillText(r.old, x0 + 70, y);
    if (done) { const tw = ctx.measureText(r.old).width; ctx.strokeStyle = '#a83a3a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x0 + 68, y - 4); ctx.lineTo(x0 + 72 + tw, y - 4); ctx.stroke(); ctx.fillStyle = '#a83a3a'; ctx.font = '700 13px "Gowun Batang", serif'; ctx.fillText('→ ' + r.neu, x0 + 78 + tw, y); }
  });
}

// ---------- 먹기와 요리 ----------
function itemInfo(k) {
  if (k.startsWith('dish|')) { const [, name, heal, warm, stam, mana] = k.split('|'); return { name, heal: +heal, warm: +warm, stam: +stam, mana: +(mana || 0), dish: true }; }
  return ITEMS[k] || { name: k };
}
function eatItem(k) {
  const it = itemInfo(k);
  if (!take(k, 1)) return;
  if (it.heal) heal(it.heal);
  if (it.warm) G.warmT = Math.max(G.warmT, it.warm);
  if (it.stam) { P.st = Math.min(P.maxst, P.st + it.stam); P.exhausted = false; }
  if (it.mana) { G.mana = Math.min(G.maxMana, G.mana + it.mana); FX.burst(P.x, P.y + 1, P.z, 20, 0x9ff4ff, 3, 0.6, 0.2); }
  sfx('pick'); toast(`${it.name}을(를) 먹었다`);
  if (TALK.onEat) TALK.onEat(k, it);
}
function quickEat() {
  const ks = Object.keys(G.inv).filter(k => G.inv[k] > 0 && itemInfo(k).heal);
  if (!ks.length) { toast('먹을 것이 없다'); return; }
  const cold = G.coldDef > 0;
  ks.sort((a, b) => { const A = itemInfo(a), B = itemInfo(b); return (cold ? (B.warm || 0) - (A.warm || 0) : 0) || (B.heal - A.heal); });
  eatItem(ks[0]);
}
function cookResult(sel) {
  const has = k => sel.includes(k), n = k => sel.filter(s => s === k).length;
  let heal = 0;
  for (const k of sel) heal += ITEMS[k].heal || 0;
  heal = Math.round(heal * 1.6);
  const salt = n('salt');
  heal += salt * 2;
  const warm = n('pepper') * 150 + n('candy') * 100;
  const stam = n('mushroom') * 40;
  const mana = n('manabloom') * 50;
  let name;
  const meat = has('meat'), fish = has('fish'), veg = ['carrot', 'potato', 'herb'].some(has), fruit = ['berry', 'apple'].some(has);
  if (has('dust') && sel.every(k => k === 'dust' || k === 'salt')) { name = '이상한 요리'; heal = 1; }
  else if (meat && veg) name = '고기 스튜';
  else if (fish && veg) name = '생선 수프';
  else if (meat) name = '고기 꼬치';
  else if (fish) name = '생선 구이';
  else if (has('mushroom') && !veg && !fruit) name = '버섯 볶음';
  else if (veg && !fruit) name = '채소 수프';
  else if (fruit && !veg) name = '과일 조림';
  else if (has('bread')) name = '구운 빵';
  else if (has('pepper') && sel.every(k => k === 'pepper' || k === 'salt')) name = '고추 구이';
  else name = '잡탕';
  const pre = [];
  if (salt && name !== '이상한 요리') pre.push('소금 간을 한');
  if (warm && name !== '고추 구이') pre.push('매콤한');
  if (stam && name !== '버섯 볶음') pre.push('든든한');
  if (mana) pre.push('마력이 깃든');
  return { name: (pre.join(' ') + ' ' + name).trim(), heal: Math.max(1, heal), warm, stam, mana };
}

// 1장 마지막 10초: 오스윈의 오래된 펜던트
function drawPendant() {
  ctx.setTransform(HUD.dpr, 0, 0, HUD.dpr, 0, 0);
  const s = Math.min(HUD.w, HUD.h);
  const cx = HUD.w / 2, cy = HUD.h / 2 - s * 0.05;
  // 창틀과 밤하늘
  ctx.fillStyle = '#1a1d3a'; ctx.fillRect(cx - s * 0.36, cy - s * 0.3, s * 0.72, s * 0.5);
  ctx.strokeStyle = '#6a4a3a'; ctx.lineWidth = s * 0.02; ctx.strokeRect(cx - s * 0.36, cy - s * 0.3, s * 0.72, s * 0.5);
  ctx.beginPath(); ctx.moveTo(cx, cy - s * 0.3); ctx.lineTo(cx, cy + s * 0.2); ctx.stroke();
  for (let i = 0; i < 18; i++) { ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.4 + hash2(i, 3) * 0.5; ctx.fillRect(cx - s * 0.34 + hash2(i, 1) * s * 0.68, cy - s * 0.28 + hash2(i, 2) * s * 0.3, 2, 2); }
  ctx.globalAlpha = 1;
  // 손
  ctx.fillStyle = '#e8c8a8';
  ctx.beginPath(); ctx.ellipse(cx, cy + s * 0.12, s * 0.16, s * 0.07, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#5a4a7a'; ctx.fillRect(cx + s * 0.12, cy + s * 0.08, s * 0.2, s * 0.1);
  // 줄과 펜던트
  ctx.strokeStyle = '#b89a5a'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx - s * 0.12, cy + s * 0.1); ctx.quadraticCurveTo(cx - s * 0.06, cy - s * 0.02, cx, cy + s * 0.02); ctx.stroke();
  const r = s * 0.06;
  ctx.fillStyle = '#9a8048'; ctx.beginPath(); ctx.arc(cx, cy + s * 0.06, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#b89a5a'; ctx.beginPath(); ctx.arc(cx, cy + s * 0.06, r * 0.82, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 0.35; ctx.fillStyle = '#6a5428';
  for (let i = 0; i < 14; i++) ctx.fillRect(cx - r * 0.7 + hash2(i, 5) * r * 1.4, cy + s * 0.06 - r * 0.6 + hash2(i, 6) * r * 1.2, 3, 1);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#4a3a1a'; ctx.font = `700 ${Math.round(r * 1.1)}px "Gowun Batang", serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('I', cx, cy + s * 0.065);
  ctx.textBaseline = 'alphabetic';
}

// 화면 효과: 추위, 피해, 공명석의 맥동
function drawScreenFx() {
  const W = HUD.w, H = HUD.h;
  if (G.coldDef > 0) {
    const a = clamp(G.coldDef / 25, 0.15, 0.5);
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.7);
    g.addColorStop(0, 'rgba(180,220,255,0)'); g.addColorStop(1, `rgba(210,238,255,${a})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  if (P && P.flash > 0) { ctx.fillStyle = `rgba(255,50,60,${P.flash * 0.8})`; ctx.fillRect(0, 0, W, H); }
  if (G.res) {
    const pulse = Math.max(0, 1 - G.res.ph * 3), a = (0.04 + G.res.k * 0.28) * pulse;
    if (a > 0.004) {
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.72);
      g.addColorStop(0, 'rgba(127,240,255,0)'); g.addColorStop(1, `rgba(127,240,255,${a})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
  }
  // 조준점: 공명봉을 모을 때와 룬을 고를 때
  if (P && (P.casting > 0 || (G.runes[G.rune] && !G.lock && G.rune !== 'burst'))) {
    ctx.strokeStyle = P.casting > 0.85 ? 'rgba(191,248,255,0.95)' : 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.5;
    const r = P.casting > 0 ? 6 + Math.min(1, P.casting / 0.85) * 10 : 5;
    ctx.beginPath(); ctx.arc(W / 2, H * 0.47, r, 0, Math.PI * 2); ctx.stroke();
  }
}
function drawLabels() {
  ctx.textAlign = 'center';
  for (const L_ of GFX.labels) {
    const p = project(L_.x, L_.y, L_.z);
    if (!p.on) continue;
    if (L_.o.bar !== undefined) { rrect(p.x - 22, p.y - 3, 44, 6, 3, 'rgba(0,0,0,0.5)'); rrect(p.x - 21, p.y - 2, 42 * clamp(L_.o.bar, 0, 1), 4, 2, L_.col); continue; }
    if (L_.o.big) { ctx.font = '900 26px "IBM Plex Sans KR", sans-serif'; ctx.fillStyle = L_.col; ctx.fillText(L_.text, p.x, p.y); continue; }
    ctx.font = '600 12px "IBM Plex Sans KR", sans-serif';
    const w = ctx.measureText(L_.text).width + 14;
    rrect(p.x - w / 2, p.y - 15, w, 20, 8, 'rgba(22,18,44,0.72)');
    ctx.fillStyle = L_.col; ctx.fillText(L_.text, p.x, p.y);
  }
}
