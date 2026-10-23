// 아스테리아 1부 — 화면 위 정보, 대화, 메뉴, 요리, 상점, 지도
'use strict';

const $ = id => document.getElementById(id);
const HUD = { w: 800, h: 600, dpr: 1, safe: { t: 0, r: 0, b: 0, l: 0 } };
let ctx = null;
function circle(x, y, r, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
function rrect(x, y, w, h, r, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); ctx.fill(); }
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ----- 칼리도르 UI 공용: 글꼴, 황동, 판 -----
// 제목·이름·표지 = 함렛, 이야기 = 고운바탕, 긴 기록 = 나눔명조, 지역·주문 = 송명, 라틴 대문자 = Cinzel
const F_T = '"Hahmlet", "Gowun Batang", serif', F_S = '"Gowun Batang", serif', F_B = '"Nanum Myeongjo", "Gowun Batang", serif', F_A = '"Song Myung", "Hahmlet", serif', F_L = '"Cinzel", "Hahmlet", serif';
const UTAU = Math.PI * 2;
const uFont = (w, s, f = F_T) => { ctx.font = `${w} ${s}px ${f}`; };
const uWrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const uHexA = (c, a) => { const n = parseInt(c.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
const uHexK = (c, k) => { const n = parseInt(c.slice(1), 16); return `rgb(${(n >> 16) * k | 0},${((n >> 8) & 255) * k | 0},${(n & 255) * k | 0})`; };
// 황동: 왼쪽 위가 밝다
function uBrass(x0, y0, x1, y1) { const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, '#F3DA9A'); g.addColorStop(0.45, '#C9A45C'); g.addColorStop(1, '#7A5B26'); return g; }
// 양 끝이 사라지는 가로 띠 색
function uFade(cx, hw, rgb, a) { const g = ctx.createLinearGradient(cx - hw, 0, cx + hw, 0); g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(0.18, `rgba(${rgb},${a})`); g.addColorStop(0.82, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`); return g; }
// 그림자를 깐 글자
function uTxt(s, x, y, col, align = 'left', sh = 0.85) { ctx.textAlign = align; ctx.fillStyle = `rgba(8,6,10,${sh})`; ctx.fillText(s, x + 1, y + 1.2); ctx.fillStyle = col; ctx.fillText(s, x, y); }
function uDia(x, y, r, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); ctx.fill(); }
function uRing(x, y, r, c, lw) { ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.beginPath(); ctx.arc(x, y, r, 0, UTAU); ctx.stroke(); }
function uTicks(x, y, r0, r1, n, rot, c, lw) { ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.beginPath(); for (let i = 0; i < n; i++) { const a = rot + i / n * UTAU, cs = Math.cos(a), sn = Math.sin(a); ctx.moveTo(x + cs * r0, y + sn * r0); ctx.lineTo(x + cs * r1, y + sn * r1); } ctx.stroke(); }
// 모서리를 깎은 판
function uPlate(x, y, w, h, c) { ctx.beginPath(); ctx.moveTo(x + c, y); ctx.lineTo(x + w - c, y); ctx.lineTo(x + w, y + c); ctx.lineTo(x + w, y + h - c); ctx.lineTo(x + w - c, y + h); ctx.lineTo(x + c, y + h); ctx.lineTo(x, y + h - c); ctx.lineTo(x, y + c); ctx.closePath(); }
function uGlass(x, y, w, h, c = 6) {
  uPlate(x, y, w, h, c); ctx.fillStyle = 'rgba(22,19,26,0.8)'; ctx.fill();
  ctx.lineWidth = 1.2; ctx.strokeStyle = uBrass(x, y, x + Math.min(w, 120), y + h); ctx.stroke();
  uPlate(x + 3, y + 3, w - 6, h - 6, Math.max(1, c - 1.5)); ctx.lineWidth = 0.8; ctx.strokeStyle = 'rgba(201,164,92,0.24)'; ctx.stroke();
}
// 양피지 섬유 결: 한 번 그려 CSS 변수로 깐다 (이음매 없이 반복)
function uPaperTex() {
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N;
  const x = c.getContext('2d'), img = x.createImageData(N, N), d = img.data, rnd = Math.random, offs = [-N, 0, N];
  for (let i = 0; i < d.length; i += 4) { d[i] = 110; d[i + 1] = 80; d[i + 2] = 40; d[i + 3] = rnd() * rnd() * 46; }
  x.putImageData(img, 0, 0);
  for (let i = 0; i < 16; i++) {
    const px = rnd() * N, py = rnd() * N, r = 20 + rnd() * 50, a = 0.025 + rnd() * 0.04;
    for (const ox of offs) for (const oy of offs) { const g = x.createRadialGradient(px + ox, py + oy, 0, px + ox, py + oy, r); g.addColorStop(0, `rgba(140,100,50,${a})`); g.addColorStop(1, 'rgba(140,100,50,0)'); x.fillStyle = g; x.fillRect(px + ox - r, py + oy - r, r * 2, r * 2); }
  }
  for (let i = 0; i < 260; i++) {
    const px = rnd() * N, py = rnd() * N, a = rnd() * Math.PI, l = 5 + rnd() * 24, bx = (rnd() - 0.5) * 6, by = (rnd() - 0.5) * 6;
    x.strokeStyle = rnd() < 0.6 ? `rgba(105,74,36,${0.06 + rnd() * 0.1})` : `rgba(255,250,236,${0.12 + rnd() * 0.16})`; x.lineWidth = 0.5 + rnd() * 0.7;
    for (const ox of offs) for (const oy of offs) { x.beginPath(); x.moveTo(px + ox, py + oy); x.quadraticCurveTo(px + ox + Math.cos(a) * l * 0.5 + bx, py + oy + Math.sin(a) * l * 0.5 + by, px + ox + Math.cos(a) * l, py + oy + Math.sin(a) * l); x.stroke(); }
  }
  return c.toDataURL();
}

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
    try { document.documentElement.style.setProperty('--paper-tex', `url(${uPaperTex()})`); } catch (e) { }
    // 캔버스 글꼴은 미리 받아 둔다 (한글 웹 글꼴은 글자 묶음별로 내려받는다)
    if (document.fonts && document.fonts.load) {
      const names = Object.values(WEAPONS).map(w => w.name).join('') + Object.values(RUNES).map(r => r.name + r.glyph).join('');
      const sample = '북동남서 빛화 칸 공명 룬 맨손 지맥 마력이 차오른다 온기 초 털 외투 목표 렌의 맥박 공명석 번역 메모 고원의 불빛 물이 다시 차오른다 구한 광부 명 0123456789:°/·' + names;
      for (const f of [`500 12px ${F_T}`, `700 12px ${F_T}`, `400 16px ${F_A}`, `700 12px ${F_L}`, `700 12px ${F_S}`, `400 12px ${F_B}`, `700 12px ${F_B}`]) document.fonts.load(f, sample).catch(() => { });
    }
    this.readSafe(); addEventListener('resize', () => this.readSafe());
  },
  // 노치·홈 막대 영역 (캔버스 HUD도 피해서 그린다)
  readSafe() { const el = $('safeProbe'); if (!el) return; const s = getComputedStyle(el); HUD.safe = { t: parseFloat(s.paddingTop) || 0, r: parseFloat(s.paddingRight) || 0, b: parseFloat(s.paddingBottom) || 0, l: parseFloat(s.paddingLeft) || 0 }; },
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
      const w = el.querySelector('.who');
      w.textContent = who || ''; w.hidden = !who;
      // 이름과 금 실선이 먹처럼 번져 나온다 (줄마다 다시)
      w.style.animation = 'none'; void w.offsetWidth; w.style.animation = '';
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
    const html = `${this.touch ? '<b class="tap"></b>' : '<b>E</b>'}<span>${esc(text)}</span>`;
    if (this._ph !== html) { this._ph = html; el.innerHTML = html; }
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
    // 목표: 바뀔 때만 다시 쓴다
    const o = G.obj && G.mode === 'play' ? G.obj : '';
    if (o !== this._obj) { this._obj = o; $('obj').innerHTML = o ? `<b>목표</b>${esc(o)}` : ''; }
    $('obj').hidden = !o;
  },

  // ----- 화면 위 정보 -----
  drawHUD() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.setTransform(HUD.dpr, 0, 0, HUD.dpr, 0, 0);
    ctx.textBaseline = 'alphabetic'; ctx.lineCap = 'butt';
    if (G.mode === 'play' && G.map) { drawScreenFx(); drawLabels(); }
    if (G.mode === 'play' && !G.lock && !this.modal && G.map) { const it = interactTarget(); this.prompt(it, it ? (ET[it.type].prompt ? ET[it.type].prompt(it) : '살펴보기') : null); } else this.prompt(null);
    if (G.showPendant) drawPendant();
    if (G.fade > 0.003) { ctx.fillStyle = G.fadeWhite ? `rgba(255,255,255,${G.fade})` : `rgba(8,6,16,${G.fade})`; ctx.fillRect(0, 0, HUD.w, HUD.h); }
    if (G.mode !== 'play' || G.f.hideHud || !P) return;
    const S = HUD.safe, pad = 14, L = pad + S.l, T = pad + S.t, R = HUD.w - pad - S.r, B = HUD.h - pad - S.b, tb = this.touch ? 150 : 0;
    // 생명석: 황동 테를 두른 수정 (하트 4칸 = 수정 하나)
    const gems = Math.ceil(P.maxhp / 4), per = 10, low = P.hp <= 4;
    for (let i = 0; i < gems; i++) drawGem(L + 9 + (i % per) * 21, T + 11 + Math.floor(i / per) * 24, 7.5, clamp(P.hp - i * 4, 0, 4) / 4, low && P.hp > i * 4);
    // 마력: 황동 틀 속을 흐르는 푸른 액체
    const my = T + 11 + Math.ceil(gems / per) * 24 - 6, mw = 150 * (G.maxMana / 100);
    drawMana(L + 7, my, mw, clamp(G.mana / G.maxMana, 0, 1), P.onLey);
    if (P.onLey && HUD.w > 600) { uFont(500, 11); uTxt('지맥 · 마력이 차오른다', L + mw + 20, my + 7, '#BFF8FF'); }
    // 목표 글은 생명석 줄 수에 맞춰 내린다
    const ot = Math.round(my + 17);
    if (this._objTop !== ot) { this._objTop = ot; $('obj').style.top = ot + 'px'; }
    // 스태미나 바퀴 (줄어들 때만)
    if (P.st < P.maxst - 0.5 || P.exhausted) {
      const pr = project(P.x, P.vis + 1.6, P.z);
      drawStamina(pr.x + 46, pr.y - 30, P.st / P.maxst, P.exhausted);
    }
    // 오른쪽 위: 기온과 시각을 재는 황동 천문 문자판
    drawDial(R - 30, T + 30, 28);
    // 위 가운데: 나침반 띠 (공명석이 가리키는 기관 표시)
    drawCompass(HUD.w / 2, T, clamp(HUD.w * 0.4, 150, 340));
    // 왼쪽 아래: 룬 홈
    const ks = Object.keys(RUNES).filter(k => G.runes[k]);
    if (ks.length) {
      const sp = 42, by = B - 24 - tb, pw = ks.length * sp + 12;
      uGlass(L, by - 23, pw, 46, 8);
      ks.forEach((k, i) => drawSocket(L + 6 + sp / 2 + i * sp, by, k, G.rune === k, this.touch));
      const R_ = RUNES[G.rune];
      if (R_) {
        uFont(700, 12); const lab = R_.name + ' 룬';
        uTxt(lab, L + 4, by - 31, '#F2E8D5');
        if (!this.touch) { const kx = L + 4 + ctx.measureText(lab).width + 13; uRing(kx, by - 35, 7, 'rgba(217,179,106,0.85)', 1); uFont(700, 9, F_L); ctx.textAlign = 'center'; ctx.fillStyle = '#E9CF86'; ctx.fillText('Q', kx, by - 31.5); }
      }
    }
    // 오른쪽 아래: 무기 홈과 빛화
    drawWeapon(R, B - tb);
    // 보스 체력
    if (G.boss && !G.boss.dead && G.boss.awake) {
      const bw = Math.min(440, HUD.w - 70), bx = HUD.w / 2 - bw / 2, byy = B - 30 - (this.touch ? 160 : 60), k = clamp(G.boss.hp / G.boss.maxhp, 0, 1);
      uFont(400, 19, F_A); uTxt(G.boss.name, HUD.w / 2, byy - 10, '#F3E3BD', 'center', 0.9);
      ctx.fillStyle = 'rgba(8,6,10,0.75)'; ctx.fillRect(bx - 2, byy - 2, bw + 4, 13);
      const g = ctx.createLinearGradient(0, byy, 0, byy + 9); g.addColorStop(0, '#E6D2FF'); g.addColorStop(0.5, '#A97CE0'); g.addColorStop(1, '#5A3790');
      ctx.fillStyle = g; ctx.fillRect(bx, byy, bw * k, 9);
      ctx.fillStyle = 'rgba(10,8,12,0.55)'; for (let q = 1; q < 4; q++) ctx.fillRect(bx + bw * q / 4 - 0.5, byy, 1, 9);
      ctx.strokeStyle = uBrass(bx, byy - 3, bx + bw * 0.4, byy + 12); ctx.lineWidth = 1.3; ctx.strokeRect(bx - 1.5, byy - 1.5, bw + 3, 12);
      uDia(bx - 7, byy + 4.5, 5, uBrass(bx - 12, byy, bx, byy + 9)); uDia(bx + bw + 7, byy + 4.5, 5, uBrass(bx + bw, byy, bx + bw + 12, byy + 9));
    }
    // 고원 불빛 수 (5장 사슬)
    if (G.f.chainsOpen && G.f.chainsLeft !== undefined) { uFont(700, 14); uTxt(`고원의 불빛 ${G.f.chainsLeft} / 6`, HUD.w / 2, T + 64, '#FFE7A0', 'center'); }
    // 수문 제한 시간 (4장 숨은 선택)
    if (G.f.manualStart && !G.f.manualDone) {
      const left = Math.max(0, Math.ceil(G.f.manualEnd - G.t));
      uFont(700, 16); uTxt(`물이 다시 차오른다 · ${left}초 · 구한 광부 ${G.f.rescued || 0}명`, HUD.w / 2, T + 66, left < 15 ? '#FF9A7A' : '#A8DCFF', 'center');
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
    const turn = this.tab !== tab; this.tab = tab;
    document.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    const box = $('panelBody');
    // 쪽이 바뀌면 먹이 번지듯 드러난다
    if (turn) { box.classList.remove('ink'); void box.offsetWidth; box.classList.add('ink'); }
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
      if (it.heal) eff.push('<i class="gem"></i>' + (it.heal / 4));
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
    if (r) h += `<div class="preview">→ <b>${esc(r.name)}</b> · <i class="gem"></i>${r.heal / 4}${r.warm ? ' · 온기 ' + r.warm + '초' : ''}${r.stam ? ' · 스태미나 +' + r.stam : ''}${r.mana ? ' · 마력 +' + r.mana : ''}</div>`;
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
    const u = k / sc;
    const dot = (x, y, r, col) => { mc.fillStyle = col; mc.beginPath(); mc.arc(x, y, r * u + 1, 0, 7); mc.fill(); mc.strokeStyle = 'rgba(43,33,24,0.85)'; mc.lineWidth = 1.2 * u; mc.stroke(); };
    // 기관: 열두 눈금 룬 고리
    const rune = (x, y, col) => { const r = 6 * u + 1; mc.strokeStyle = 'rgba(43,33,24,0.9)'; mc.lineWidth = 3.4 * u; mc.beginPath(); mc.arc(x, y, r, 0, 7); mc.stroke(); mc.strokeStyle = col; mc.lineWidth = 2 * u; mc.beginPath(); mc.arc(x, y, r, 0, 7); mc.stroke(); mc.beginPath(); for (let i = 0; i < 12; i++) { const a = i / 12 * UTAU; mc.moveTo(x + Math.cos(a) * (r + 1.5 * u), y + Math.sin(a) * (r + 1.5 * u)); mc.lineTo(x + Math.cos(a) * (r + 4 * u), y + Math.sin(a) * (r + 4 * u)); } mc.strokeStyle = 'rgba(43,33,24,0.85)'; mc.lineWidth = 1 * u; mc.stroke(); mc.fillStyle = col; mc.beginPath(); mc.arc(x, y, 1.6 * u, 0, 7); mc.fill(); };
    if (world) {
      const seen = (x, y) => G.fog[Math.floor(y / 4) * FOG_W + Math.floor(x / 4)];
      for (const t of TOWERS) { const [x, z] = M_(t.u, t.v); if (seen(x, z)) dot(x, z, 4, isDone(t.id) ? '#2E8A96' : '#C0662E'); }
      LABS.forEach(([lu, lv], i) => { const [x, z] = M_(lu, lv); if (seen(x, z)) dot(x, z, 3, isDone('lab:' + i) ? '#C9A045' : '#6A7A9A'); });
      const names = [['칼리도르', 100, 124], ['마르셀라', 34, 88], ['엘름바텐', 158, 80], ['그라벤호프', 100, 20], ['알테라 고원', 36, 22], ['리벤', 72, 54], ['오르타', 14, 50], ['브리그', 28, 54], ['세일른', 46, 50]];
      // 지명: 송명체 먹 글씨, 양피지 테두리로 읽히게
      for (const [n, nu, nv] of names) { const [x, z] = M_(nu, nv); if (seen(x, z)) { mc.font = `${15 * u}px ${F_A}`; mc.textAlign = 'center'; mc.lineJoin = 'round'; mc.strokeStyle = 'rgba(234,219,190,0.85)'; mc.lineWidth = 3.5 * u; mc.strokeText(n, x, z + 30); mc.fillStyle = '#2B2118'; mc.fillText(n, x, z + 30); } }
      const engs = [['eng_marcella', PLACES.cathedral], ['eng_elm', PLACES.clock], ['eng_grav', PLACES.mine]];
      for (const [f, [x, z]] of engs) if (seen(x, z) || G.f.map) rune(x, z, G.f[f] ? '#2AA6B8' : '#A82E38');
      if (G.f.summons) rune(PLACES.prima[0], PLACES.prima[1], G.f.primaStop ? '#555' : '#8A6AC8');
    }
    const px = P.x, py = P.z, a = Math.atan2(Math.cos(P.yaw), Math.sin(P.yaw)), s2 = 4 * k / sc + 3;
    mc.fillStyle = '#A3242A'; mc.beginPath();
    mc.moveTo(px + Math.cos(a) * s2 * 1.3, py + Math.sin(a) * s2 * 1.3); mc.lineTo(px + Math.cos(a + 2.4) * s2, py + Math.sin(a + 2.4) * s2); mc.lineTo(px + Math.cos(a - 2.4) * s2, py + Math.sin(a - 2.4) * s2); mc.closePath(); mc.fill();
    mc.strokeStyle = '#F2E8D5'; mc.lineWidth = 1.2 * k / sc; mc.lineJoin = 'round'; mc.stroke();
    // 먹선 테두리와 나침 장미 (화면 픽셀 기준)
    mc.setTransform(HUD.dpr, 0, 0, HUD.dpr, 0, 0);
    const cw = c.width / HUD.dpr, ch = c.height / HUD.dpr;
    mc.strokeStyle = 'rgba(43,33,24,0.55)'; mc.lineWidth = 1; mc.strokeRect(4.5, 4.5, cw - 9, ch - 9);
    mc.strokeStyle = 'rgba(43,33,24,0.25)'; mc.strokeRect(7.5, 7.5, cw - 15, ch - 15);
    if (cw > 160 && ch > 120) {
      const rx = cw - 34, ry = 38;
      mc.fillStyle = 'rgba(234,219,190,0.7)'; mc.beginPath(); mc.arc(rx, ry, 17, 0, 7); mc.fill();
      mc.strokeStyle = 'rgba(43,33,24,0.8)'; mc.lineWidth = 1; mc.beginPath(); mc.arc(rx, ry, 15, 0, 7); mc.stroke(); mc.beginPath(); mc.arc(rx, ry, 11.5, 0, 7); mc.stroke();
      mc.beginPath(); for (let i = 0; i < 12; i++) { const a2 = i / 12 * UTAU; mc.moveTo(rx + Math.cos(a2) * 11.5, ry + Math.sin(a2) * 11.5); mc.lineTo(rx + Math.cos(a2) * 15, ry + Math.sin(a2) * 15); } mc.stroke();
      mc.fillStyle = '#2B2118'; mc.beginPath(); mc.moveTo(rx, ry - 13); mc.lineTo(rx + 3.5, ry); mc.lineTo(rx - 3.5, ry); mc.closePath(); mc.fill();
      mc.fillStyle = '#A3242A'; mc.beginPath(); mc.moveTo(rx, ry + 13); mc.lineTo(rx + 3.5, ry); mc.lineTo(rx - 3.5, ry); mc.closePath(); mc.fill();
      mc.font = `700 11px ${F_T}`; mc.textAlign = 'center'; mc.lineWidth = 3; mc.strokeStyle = 'rgba(234,219,190,0.9)'; mc.strokeText('북', rx, ry - 20); mc.fillStyle = '#2B2118'; mc.fillText('북', rx, ry - 20);
    }
    $('mapTitle').textContent = world ? '대륙 아스테리아' : (G.map.name || mapTitle(G.map.id));
    const li = (c2, t) => `<span class="li"><i class="lg ${c2}"></i>${t}</span>`;
    $('mapLegend').innerHTML = world ? li('a', '밝힌 탑') + li('b', '안 밝힌 탑') + li('c', '비틀린 기관') + li('d', '고친 기관') + li('e', '실험실') : '';
  },

};
const say = (w, t, o) => UI.say(w, t, o);
const choose = (p, o) => UI.choose(p, o);
const caption = (t, s) => UI.caption(t, s);
const toast = (t, q) => UI.toast(t, q);
const banner = t => UI.banner(t);
function openCook(e) { UI.openCook(e); }

// ----- HUD 그림 조각 -----
// 생명석: 세로로 긴 육각 수정, 황동 테. 채움은 아래에서 위로 (4분의 1씩)
function gemPath(x, y, r) { ctx.beginPath(); ctx.moveTo(x, y - r * 1.2); ctx.lineTo(x + r * 0.9, y - r * 0.45); ctx.lineTo(x + r * 0.9, y + r * 0.45); ctx.lineTo(x, y + r * 1.2); ctx.lineTo(x - r * 0.9, y + r * 0.45); ctx.lineTo(x - r * 0.9, y - r * 0.45); ctx.closePath(); }
function drawGem(x, y, r, fill, warn) {
  if (warn) { const a = 0.28 + 0.28 * Math.sin(G.t * 6), g = ctx.createRadialGradient(x, y, 1, x, y, r * 2.4); g.addColorStop(0, `rgba(255,90,100,${a})`); g.addColorStop(1, 'rgba(255,90,100,0)'); circle(x, y, r * 2.4, g); }
  gemPath(x, y, r + 2.7); ctx.fillStyle = 'rgba(8,6,10,0.55)'; ctx.fill();
  gemPath(x, y, r + 1.6); ctx.fillStyle = uBrass(x - r, y - r, x + r, y + r); ctx.fill();
  gemPath(x, y, r); ctx.fillStyle = '#1C1119'; ctx.fill();
  if (fill > 0) {
    ctx.save(); gemPath(x, y, r); ctx.clip();
    const top = y + r * 1.2 - r * 2.4 * fill, g = ctx.createLinearGradient(x - r, y - r, x + r * 0.6, y + r);
    g.addColorStop(0, '#FFB4B8'); g.addColorStop(0.35, '#E23A50'); g.addColorStop(1, '#6A0E22');
    ctx.fillStyle = g; ctx.fillRect(x - r, top, r * 2, r * 2.6);
    if (fill < 1) { ctx.fillStyle = 'rgba(255,205,210,0.75)'; ctx.fillRect(x - r, top, r * 2, 1); }
    ctx.restore();
  }
  // 깎은 면
  ctx.strokeStyle = `rgba(255,236,236,${fill > 0 ? 0.34 : 0.13})`; ctx.lineWidth = 0.7; ctx.beginPath();
  ctx.moveTo(x - r * 0.9, y - r * 0.45); ctx.lineTo(x - r * 0.4, y - r * 0.18); ctx.lineTo(x + r * 0.4, y - r * 0.18); ctx.lineTo(x + r * 0.9, y - r * 0.45);
  ctx.moveTo(x - r * 0.4, y - r * 0.18); ctx.lineTo(x, y + r * 1.2); ctx.lineTo(x + r * 0.4, y - r * 0.18);
  ctx.moveTo(x - r * 0.4, y - r * 0.18); ctx.lineTo(x, y - r * 1.2); ctx.lineTo(x + r * 0.4, y - r * 0.18);
  ctx.stroke();
  if (fill > 0) { ctx.fillStyle = 'rgba(255,255,255,0.62)'; ctx.beginPath(); ctx.moveTo(x - r * 0.66, y - r * 0.4); ctx.lineTo(x - r * 0.12, y - r * 0.88); ctx.lineTo(x - r * 0.28, y - r * 0.3); ctx.closePath(); ctx.fill(); }
}
// 마력 막대: 가는 황동 틀, 흐르는 시안 액체
function drawMana(x, y, w, k, ley) {
  const h = 7;
  if (ley) { const g = ctx.createLinearGradient(0, y - 8, 0, y + h + 8); g.addColorStop(0, 'rgba(127,240,255,0)'); g.addColorStop(0.5, `rgba(127,240,255,${0.22 + 0.12 * Math.sin(G.t * 5)})`); g.addColorStop(1, 'rgba(127,240,255,0)'); ctx.fillStyle = g; ctx.fillRect(x - 4, y - 8, w + 8, h + 16); }
  ctx.fillStyle = 'rgba(8,6,10,0.62)'; ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
  ctx.fillStyle = 'rgba(12,20,28,0.92)'; ctx.fillRect(x, y, w, h);
  if (k > 0) {
    const fw = w * k, g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, '#A8F6FF'); g.addColorStop(0.45, '#3FC8E8'); g.addColorStop(1, '#1D6A92');
    ctx.fillStyle = g; ctx.fillRect(x, y, fw, h);
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, fw, h); ctx.clip();
    // 흐름: 비스듬한 밝은 결이 오른쪽으로 흐른다
    const t = G.t * 24; ctx.fillStyle = 'rgba(225,255,255,0.3)'; ctx.beginPath();
    for (let i = 0; i < w / 16 + 2; i++) { const sx = x - 16 + ((i * 16 + t) % (w + 32)); ctx.moveTo(sx, y + h); ctx.lineTo(sx + 4, y); ctx.lineTo(sx + 7, y); ctx.lineTo(sx + 3, y + h); }
    ctx.fill();
    // 물결 윗면과 끝의 밝은 면
    ctx.strokeStyle = 'rgba(235,255,255,0.75)'; ctx.lineWidth = 0.9; ctx.beginPath();
    for (let xx = 0; xx <= fw; xx += 3) { const yy = y + 1.2 + Math.sin(xx * 0.3 - G.t * 5) * 0.6; xx ? ctx.lineTo(x + xx, yy) : ctx.moveTo(x, yy); }
    ctx.stroke();
    ctx.fillStyle = 'rgba(235,255,255,0.9)'; ctx.fillRect(x + fw - 1.4, y, 1.4, h);
    ctx.restore();
  }
  ctx.fillStyle = 'rgba(10,8,12,0.5)'; for (let q = 1; q < 4; q++) ctx.fillRect(x + w * q / 4 - 0.5, y, 1, h);
  ctx.strokeStyle = uBrass(x, y - 3, x + Math.min(w, 80), y + h + 3); ctx.lineWidth = 1.3; ctx.strokeRect(x - 1.5, y - 1.5, w + 3, h + 3);
  uDia(x - 5, y + h / 2, 4.2, uBrass(x - 9, y, x - 1, y + h)); uDia(x + w + 5, y + h / 2, 4.2, uBrass(x + w + 1, y, x + w + 9, y + h));
}
// 스태미나 바퀴: 황동 테와 열두 눈금
function drawStamina(x, y, k, ex) {
  const r = 12;
  circle(x, y, r + 7, 'rgba(10,8,12,0.42)');
  uRing(x, y, r, 'rgba(30,24,30,0.8)', 5);
  ctx.strokeStyle = ex ? '#D0503A' : k < 0.25 ? '#E8963A' : '#EBD08A'; ctx.lineWidth = 4.2;
  ctx.beginPath(); ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + UTAU * clamp(k, 0, 1)); ctx.stroke();
  uRing(x, y, r + 3.6, uBrass(x - r, y - r, x + r, y + r), 1.3); uRing(x, y, r - 3.3, 'rgba(201,164,92,0.5)', 0.8);
  uTicks(x, y, r + 3.6, r + 6.4, 12, -Math.PI / 2, 'rgba(243,218,154,0.85)', 1);
}
// 기온·시각 문자판: 황동 고리, 24 눈금, 해와 달이 하루에 한 바퀴 (정오가 위)
function drawDial(cx, cy, r) {
  const t = airTemp(), felt = feltTemp(), cold = G.coldDef > 0;
  circle(cx, cy, r + 4, 'rgba(8,6,10,0.5)');
  const g = ctx.createRadialGradient(cx, cy - r * 0.35, 2, cx, cy, r); g.addColorStop(0, 'rgba(54,46,64,0.95)'); g.addColorStop(1, 'rgba(16,13,20,0.95)');
  circle(cx, cy, r, g);
  uRing(cx, cy, r, uBrass(cx - r, cy - r, cx + r, cy + r), 3);
  uRing(cx, cy, r - 2.6, 'rgba(10,8,12,0.65)', 1);
  uTicks(cx, cy, r - 7.5, r - 3.5, 12, 0, 'rgba(217,179,106,0.85)', 1.1);
  uTicks(cx, cy, r - 5.5, r - 3.5, 12, Math.PI / 12, 'rgba(217,179,106,0.45)', 0.8);
  // 기온 호 (아래쪽, 왼쪽이 춥다)
  const a0 = Math.PI * 0.72, a1 = Math.PI * 0.28, rr = r - 11, k = clamp((t + 20) / 50, 0.03, 1);
  ctx.lineCap = 'round'; ctx.lineWidth = 2.4;
  ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.beginPath(); ctx.arc(cx, cy, rr, a0, a1, true); ctx.stroke();
  ctx.strokeStyle = cold ? '#8FD0FF' : felt > 26 ? '#FFB35A' : '#E9CF86'; ctx.beginPath(); ctx.arc(cx, cy, rr, a0, a0 - (a0 - a1) * k, true); ctx.stroke();
  ctx.lineCap = 'butt';
  // 해와 달
  const ta = Math.PI / 2 + ((G.time % 1440) / 1440) * UTAU, sx = cx + Math.cos(ta) * r, sy = cy + Math.sin(ta) * r;
  if (G.night > 0.5) { ctx.save(); ctx.beginPath(); ctx.arc(sx, sy, 4.4, 0, UTAU); ctx.clip(); circle(sx, sy, 4.4, '#E8EEFF'); circle(sx + 2, sy - 1.4, 3.6, 'rgba(34,30,46,0.96)'); ctx.restore(); uRing(sx, sy, 4.4, 'rgba(160,170,210,0.8)', 0.8); }
  else { const sg = ctx.createRadialGradient(sx, sy, 1, sx, sy, 8); sg.addColorStop(0, 'rgba(255,214,130,0.7)'); sg.addColorStop(1, 'rgba(255,214,130,0)'); circle(sx, sy, 8, sg); circle(sx, sy, 3.9, '#FFE9B5'); uRing(sx, sy, 3.9, '#A8782A', 1); }
  uFont(700, 15); uTxt(`${t}°`, cx + 2, cy + 2, cold ? '#A8DCFF' : felt > 26 ? '#FFC07A' : '#F2E8D5', 'center', 0.9);
  const h = Math.floor(G.time / 60), mi = Math.floor(G.time % 60);
  uFont(500, 9); uTxt(`${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`, cx, cy + 11.5, '#C8BBA2', 'center', 0.7);
  uFont(500, 11); let ty = cy + r + 17;
  if (G.warmT > 0) { uTxt('온기 ' + Math.ceil(G.warmT) + '초', cx + r, ty, '#FFB35A', 'right'); ty += 15; }
  if (G.f.furcoat) uTxt('털 외투', cx + r, ty, '#D8C8A8', 'right');
}
// 나침반 띠: 새긴 눈금, 북동남서, 공명석이 가리키는 기관은 시안 룬 고리
function drawCompass(cx, y, w) {
  const h = 22, hw = w / 2, half = Math.PI * 0.43;
  const heading = -(typeof CAM !== 'undefined' ? (CAM.cy ?? CAM.yaw) : 0);
  ctx.fillStyle = uFade(cx, hw, '22,19,26', 0.78); ctx.fillRect(cx - hw, y, w, h);
  ctx.fillStyle = uFade(cx, hw, '201,164,92', 0.95); ctx.fillRect(cx - hw, y, w, 1); ctx.fillRect(cx - hw, y + h - 1, w, 1);
  ctx.fillStyle = uFade(cx, hw, '201,164,92', 0.28); ctx.fillRect(cx - hw, y + 3, w, 0.8); ctx.fillRect(cx - hw, y + h - 3.8, w, 0.8);
  const X = rel => cx + rel / half * hw;
  for (let d = 0; d < 360; d += 15) {
    const rel = uWrap(d * Math.PI / 180 - heading); if (Math.abs(rel) > half) continue;
    const x = X(rel); ctx.globalAlpha = 1 - Math.pow(Math.abs(rel) / half, 4);
    if (d % 90 === 0) { uFont(700, 12); uTxt('북동남서'[d / 90], x, y + 15.5, d === 0 ? '#F8E2A2' : '#D9B36A', 'center', 0.9); }
    else if (d % 45 === 0) uDia(x, y + h / 2, 2.6, '#C9A45C');
    else { ctx.fillStyle = 'rgba(217,179,106,0.8)'; ctx.fillRect(x - 0.5, y + 5, 1, 4); ctx.fillRect(x - 0.5, y + h - 9, 1, 4); }
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#F0D590'; ctx.beginPath(); ctx.moveTo(cx - 4.5, y - 1); ctx.lineTo(cx + 4.5, y - 1); ctx.lineTo(cx, y + 4.5); ctx.closePath(); ctx.fill();
  if (G.res) {
    const b = Math.atan2(G.res.x - P.x, -(G.res.z - P.z)), rel = uWrap(b - heading), inside = Math.abs(rel) <= half;
    const x = X(clamp(rel, -half * 0.94, half * 0.94)), my = y + h / 2, ph = G.res.ph;
    ctx.globalAlpha = (1 - ph) * 0.75; uRing(x, my, 6 + ph * 10, '#7FF0FF', 1.2); ctx.globalAlpha = 1;
    circle(x, my, 6.6, 'rgba(8,26,32,0.9)'); uRing(x, my, 6, '#7FF0FF', 1.3); uTicks(x, my, 6, 8.4, 6, G.t * 0.8, 'rgba(127,240,255,0.8)', 1); uDia(x, my, 2.4, '#E0FFFF');
    if (!inside) { const s = Math.sign(rel); ctx.strokeStyle = '#7FF0FF'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x + s * 11, my - 4); ctx.lineTo(x + s * 15, my); ctx.lineTo(x + s * 11, my + 4); ctx.stroke(); }
    uFont(500, 10); uTxt(G.map.world ? Math.round(G.res.d) + '칸' : '공명', clamp(x, cx - hw + 18, cx + hw - 18), y + h + 12, '#BFF8FF', 'center');
  }
}
// 룬 홈: 황동 고리 속 오목한 자리. 고른 룬은 빛나고 열두 눈금이 돈다
function drawSocket(x, y, k, on, touch) {
  const R_ = RUNES[k], r = on ? 15 : 12;
  if (on) { const g = ctx.createRadialGradient(x, y, r * 0.5, x, y, r + 12); g.addColorStop(0, uHexA(R_.c, 0.42)); g.addColorStop(1, uHexA(R_.c, 0)); circle(x, y, r + 12, g); }
  circle(x, y, r + 2.4, 'rgba(8,6,10,0.6)');
  const g2 = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, 1, x, y, r);
  if (on) { g2.addColorStop(0, '#FFFFFF'); g2.addColorStop(0.32, R_.c); g2.addColorStop(1, uHexK(R_.c, 0.45)); } else { g2.addColorStop(0, 'rgba(62,54,70,0.95)'); g2.addColorStop(1, 'rgba(16,13,20,0.95)'); }
  circle(x, y, r, g2);
  uRing(x, y, r, on ? uBrass(x - r, y - r, x + r, y + r) : '#7A5F2C', on ? 2.6 : 1.6);
  if (on) uTicks(x, y, r + 2.8, r + 5.4, 12, G.t * 0.5, 'rgba(243,218,154,0.9)', 1);
  uFont(400, on ? 17 : 13, F_A); ctx.textAlign = 'center'; ctx.fillStyle = on ? '#1A1220' : '#D9CDB4'; ctx.fillText(R_.glyph, x, y + (on ? 5.5 : 4.5));
  if (!touch) { uFont(700, 9, F_L); uTxt(String(Object.keys(RUNES).indexOf(k) + 1), x + r * 0.8, y + r + 2, '#C9A45C', 'center', 0.9); }
  if (k === 'magnes' && P.holding) uRing(x, y, r + 8, R_.c, 2);
}
// 무기 홈: 깎은 판 + 둥근 황동 홈 속 칼날 그림 + 내구도. 위에 빛화
function drawWeapon(R, B) {
  const w = G.weapons[G.wi], W = w ? WEAPONS[w.k] : null, pw = 176, ph = 46, wx = R - pw, wy = B - ph;
  uGlass(wx, wy, pw, ph, 8);
  const sx = wx + 24, sy = wy + ph / 2;
  circle(sx, sy, 16, 'rgba(8,6,10,0.55)');
  const g = ctx.createRadialGradient(sx - 4, sy - 5, 1, sx, sy, 14); g.addColorStop(0, 'rgba(66,58,74,0.95)'); g.addColorStop(1, 'rgba(14,11,18,0.95)'); circle(sx, sy, 14, g);
  uRing(sx, sy, 14, uBrass(sx - 14, sy - 14, sx + 14, sy + 14), 2);
  if (W) {
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(Math.PI / 4);
    const bg = ctx.createLinearGradient(-3, 0, 3, 0); bg.addColorStop(0, '#F4ECDC'); bg.addColorStop(0.5, W.c); bg.addColorStop(1, uHexK(W.c, 0.55));
    ctx.fillStyle = bg; ctx.beginPath(); ctx.moveTo(0, -10.5); ctx.lineTo(2.4, -6.5); ctx.lineTo(2.4, 4); ctx.lineTo(-2.4, 4); ctx.lineTo(-2.4, -6.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = uBrass(-6, 4, 6, 7); ctx.fillRect(-6, 4, 12, 2.2); ctx.fillStyle = '#5A3A24'; ctx.fillRect(-1.3, 6.2, 2.6, 4.2); circle(0, 11.2, 1.6, '#C9A45C');
    ctx.restore();
  } else uDia(sx, sy, 3.2, '#7A5F2C');
  uFont(700, 13); uTxt(W ? W.name : '맨손', wx + 47, wy + 20, '#F2E8D5');
  if (W) {
    const bx = wx + 47, bw = pw - 60, by = wy + 29, k = clamp(w.d / W.dur, 0, 1);
    ctx.fillStyle = 'rgba(8,6,10,0.75)'; ctx.fillRect(bx, by, bw, 5);
    if (k < 0.25) ctx.fillStyle = '#C8463A'; else { const dg = ctx.createLinearGradient(0, by, 0, by + 5); dg.addColorStop(0, '#F3DA9A'); dg.addColorStop(1, '#A8823A'); ctx.fillStyle = dg; }
    ctx.fillRect(bx + 1, by + 1, (bw - 2) * k, 3);
    ctx.strokeStyle = 'rgba(201,164,92,0.65)'; ctx.lineWidth = 0.8; ctx.strokeRect(bx - 0.5, by - 0.5, bw + 1, 6);
  }
  // 빛화
  uFont(700, 12); const ct = `빛화 ${G.coins}`, tw = ctx.measureText(ct).width;
  uTxt(ct, R - 2, wy - 9, '#F0D590', 'right');
  const cx = R - 2 - tw - 10, cy = wy - 13;
  circle(cx + 0.8, cy + 1, 5.6, 'rgba(8,6,10,0.7)'); circle(cx, cy, 5.4, uBrass(cx - 5, cy - 5, cx + 5, cy + 5)); uRing(cx, cy, 3.4, 'rgba(110,82,34,0.85)', 0.9); uDia(cx, cy, 1.5, 'rgba(110,82,34,0.9)');
}
function drawHeartbeats() {
  const w = Math.min(320, HUD.w - 40), x0 = HUD.w / 2 - w / 2, y0 = 94 + HUD.safe.t;
  uGlass(x0 - 14, y0 - 26, w + 28, 86, 8);
  uFont(500, 11);
  const line = (yy, f, ph, col, label) => {
    uTxt(label, x0, yy - 9, col);
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath();
    for (let i = 0; i <= w; i += 2) {
      const tt = G.t * f - i / w * 3 + ph, p = tt - Math.floor(tt);
      const v = p < 0.08 ? -Math.sin(p / 0.08 * Math.PI) * 12 : p < 0.14 ? Math.sin((p - 0.08) / 0.06 * Math.PI) * 5 : 0;
      i ? ctx.lineTo(x0 + i, yy + v) : ctx.moveTo(x0 + i, yy + v);
    }
    ctx.stroke();
  };
  line(y0 + 6, 1.4, 0, '#F09AA6', '렌의 맥박');
  line(y0 + 44, lerp(0.9, 1.4, G.heartSync), 0, '#7FF0FF', '공명석');
}
// 렌의 번역 메모: 양피지 쪽지에 먹 글씨, 고친 말은 검붉은 잉크
function drawTranslation() {
  const rows = TRANSLATION.filter((r, i) => i < (G.f.steles || 0) + 1);
  const w = 236, x0 = HUD.w - w - 14 - HUD.safe.r, y0 = 194 + HUD.safe.t, h = 34 + rows.length * 34;
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4; ctx.fillStyle = '#EADBBE'; ctx.fillRect(x0, y0, w, h); ctx.restore();
  const g = ctx.createRadialGradient(x0 + w / 2, y0 + h / 2, Math.min(w, h) * 0.3, x0 + w / 2, y0 + h / 2, Math.max(w, h) * 0.7); g.addColorStop(0, 'rgba(184,152,104,0)'); g.addColorStop(1, 'rgba(150,108,52,0.45)');
  ctx.fillStyle = g; ctx.fillRect(x0, y0, w, h);
  ctx.strokeStyle = 'rgba(110,72,30,0.6)'; ctx.lineWidth = 1; ctx.strokeRect(x0 + 0.5, y0 + 0.5, w - 1, h - 1);
  ctx.strokeStyle = 'rgba(138,106,46,0.55)'; ctx.lineWidth = 0.7; ctx.strokeRect(x0 + 4, y0 + 4, w - 8, h - 8);
  uFont(700, 12.5); ctx.textAlign = 'left'; ctx.fillStyle = '#2B2118'; ctx.fillText('렌의 번역 메모', x0 + 14, y0 + 22);
  ctx.fillStyle = 'rgba(138,106,46,0.7)'; ctx.fillRect(x0 + 14, y0 + 29, w - 34, 1); uDia(x0 + w - 16, y0 + 29.5, 2.6, '#6E2320');
  rows.forEach((r, i) => {
    const y = y0 + 48 + i * 34, done = i < (G.f.steles || 0);
    ctx.textAlign = 'left'; uFont(700, 12.5, F_B); ctx.fillStyle = '#2B2118'; ctx.fillText(r.word, x0 + 14, y);
    uFont(400, 12.5, F_B); ctx.fillStyle = done ? '#9A8A7A' : '#2B2118'; ctx.fillText(r.old, x0 + 70, y);
    if (done) { const tw = ctx.measureText(r.old).width; ctx.strokeStyle = '#8E2A26'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x0 + 68, y - 4); ctx.lineTo(x0 + 72 + tw, y - 4); ctx.stroke(); ctx.fillStyle = '#6E2320'; uFont(700, 13, F_S); ctx.fillText('→ ' + r.neu, x0 + 78 + tw, y); }
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
    const col = P.casting > 0.85 ? 'rgba(191,248,255,0.95)' : 'rgba(242,232,213,0.6)', cx = W / 2, cy = H * 0.47;
    const r = P.casting > 0 ? 6 + Math.min(1, P.casting / 0.85) * 10 : 5;
    uRing(cx, cy, r, col, 1.3); uTicks(cx, cy, r + 2, r + 5, 4, Math.PI / 4, col, 1.2);
  }
}
function drawLabels() {
  ctx.textAlign = 'center';
  for (const L_ of GFX.labels) {
    const p = project(L_.x, L_.y, L_.z);
    if (!p.on) continue;
    // 체력 막대: 어두운 홈 + 가는 황동 테
    if (L_.o.bar !== undefined) { ctx.fillStyle = 'rgba(8,6,10,0.7)'; ctx.fillRect(p.x - 23, p.y - 3.5, 46, 7); ctx.fillStyle = L_.col; ctx.fillRect(p.x - 22, p.y - 2.5, 44 * clamp(L_.o.bar, 0, 1), 5); ctx.strokeStyle = 'rgba(201,164,92,0.75)'; ctx.lineWidth = 0.8; ctx.strokeRect(p.x - 23.5, p.y - 4, 47, 8); continue; }
    if (L_.o.big) { uFont(700, 26); uTxt(L_.text, p.x, p.y, L_.col, 'center', 0.7); continue; }
    // 이름표: 어두운 유리 알약, 황동 테, 함렛
    uFont(500, 12);
    const w = ctx.measureText(L_.text).width + 18;
    rrect(p.x - w / 2, p.y - 15, w, 20, 10, 'rgba(22,19,26,0.8)');
    ctx.strokeStyle = 'rgba(201,164,92,0.6)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.textAlign = 'center'; ctx.fillStyle = L_.col === '#fff' ? '#F2E8D5' : L_.col; ctx.fillText(L_.text, p.x, p.y - 0.5);
  }
}
