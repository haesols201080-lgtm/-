// 화면 UI: HUD(목표·나침반·알림·모아 자막·공명 단추), 대화창, 카드, 메뉴, 타이틀, 터치 조작.
// 게임 로직은 game.ui.xxx() 만 부르고, DOM 은 여기서만 다룹니다.
import { NOTE_COLORS, NOTE_NAMES } from '../core/audio.js';
import { glyphSVG } from '../game/language.js';
import { WORD } from '../data/lexicon.js';
import { IS_TOUCH } from '../core/quality.js';
import { MapView } from './map.js';
import { Journal } from './journal.js';
import { Settings } from './settings.js';

const $ = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const hex = (c) => '#' + c.toString(16).padStart(6, '0');

const ICON = {
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 5c3-1 6-1 8 1 2-2 5-2 8-1v14c-3-1-6-1-8 1-2-2-5-2-8-1z"/><path d="M12 6v14"/></svg>',
};

export class UI {
  constructor(game) {
    this.game = game;
    this.root = document.getElementById('ui');
    if (IS_TOUCH) document.body.classList.add('touch');
    this.touch = IS_TOUCH;
    this._build();
    this.mapView = new MapView(game);
    this.journal = new Journal(game);
    this.settingsView = new Settings(game);
    this.dialogue = this._dialogueApi();
    this.toastQ = [];
  }

  _build() {
    const r = this.root;
    this.hud = $(`<div id="hud"></div>`);
    r.appendChild(this.hud);
    this.vign = $(`<div class="vignette"></div>`);
    this.hud.appendChild(this.vign);
    this.obj = $(`<div class="objective hidden"><div class="q"></div><div class="t"></div><div class="h hidden"></div></div>`);
    this.hud.appendChild(this.obj);
    this.compass = $(`<div class="compass"><div class="strip"></div><div class="center"></div></div>`);
    this.hud.appendChild(this.compass);
    this.compassStrip = this.compass.firstElementChild;
    this.alti = $(`<div class="alti hidden"></div>`);
    this.hud.appendChild(this.alti);
    const tb = $(`<div class="topbtns"></div>`);
    for (const [k, tab] of [['map', 'map'], ['book', 'journal'], ['menu', 'settings']]) {
      const b = $(`<button class="icobtn" aria-label="${tab}">${ICON[k]}</button>`);
      b.addEventListener('click', () => this.openMenu(tab));
      tb.appendChild(b);
    }
    this.hud.appendChild(tb);
    this.promptEl = $(`<div class="prompt glass hidden"></div>`);
    this.hud.appendChild(this.promptEl);
    this.moaEl = $(`<div class="moa" style="opacity:0"></div>`);
    this.hud.appendChild(this.moaEl);
    this.sayEl = $(`<div class="say" style="opacity:0"><div class="who"></div><div class="l"></div></div>`);
    this.hud.appendChild(this.sayEl);
    this.toastsEl = $(`<div class="toasts"></div>`);
    this.hud.appendChild(this.toastsEl);
    this.regionEl = $(`<div class="region"><div class="name"></div><div class="line"></div><div class="desc"></div></div>`);
    this.hud.appendChild(this.regionEl);
    this.puzzleEl = $(`<div class="puzzle hidden"><div class="label"></div><div class="slots"></div></div>`);
    this.hud.appendChild(this.puzzleEl);
    // 공명 단추
    this.tonesEl = $(`<div class="tones"></div>`);
    this.toneBtns = NOTE_NAMES.map((n, i) => {
      const b = $(`<button class="tone locked" style="--c:${hex(NOTE_COLORS[i])}"><span class="n">${n}</span><span class="k">${i + 1}</span></button>`);
      const fire = (e) => { e.preventDefault(); e.stopPropagation(); this.game.input.tap('tone' + (i + 1)); };
      b.addEventListener('pointerdown', fire);
      this.tonesEl.appendChild(b);
      return b;
    });
    this.hud.appendChild(this.tonesEl);
    if (this.touch) this._buildTouch();
    this.fadeEl = $(`<div class="fade"></div>`);
    r.appendChild(this.fadeEl);
    this.flashEl = $(`<div class="flash"></div>`);
    r.appendChild(this.flashEl);
  }

  _buildTouch() {
    const t = $(`<div class="touchui"></div>`);
    this.stickEl = $(`<div class="stick"><i></i></div>`);
    t.appendChild(this.stickEl);
    t.appendChild($(`<div class="stick-hint"></div>`));
    const mk = (cls, label, action, hold = true) => {
      const b = $(`<div class="tbtn ${cls}">${label}</div>`);
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.classList.add('down'); if (hold) this.game.input.press(action); else this.game.input.tap(action); });
      const up = (e) => { e.preventDefault(); b.classList.remove('down'); if (hold) this.game.input.release(action); };
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('pointerleave', up);
      t.appendChild(b);
      return b;
    };
    this.tJump = mk('jump', '점프<br><small>활공</small>', 'jump');
    this.tAct = mk('act hidden', '살피기', 'interact', false);
    this.tSkim = mk('skim hidden', '썰매', 'skimmer', false);
    this.tSprint = mk('sprint', '달리기', 'sprint');
    this.hud.appendChild(t);
    const stick = this.stickEl, knob = stick.firstElementChild;
    this.game.input.onStick = (x, y, dx, dy, on) => {
      stick.classList.toggle('on', on);
      if (on) { stick.style.left = x + 'px'; stick.style.top = y + 'px'; knob.style.transform = `translate(${dx * 32}px, ${dy * 32}px)`; }
    };
  }

  refreshButtons() {
    const s = this.game.state;
    this.toneBtns.forEach((b, i) => b.classList.toggle('locked', !s.tones.includes(i)));
    this.tonesEl.classList.toggle('hidden', s.tones.length === 0);
    if (this.tSkim) this.tSkim.classList.toggle('hidden', !s.flags.skimmer);
  }

  flashTone(n) {
    const b = this.toneBtns[n];
    b.classList.add('hit');
    setTimeout(() => b.classList.remove('hit'), 160);
  }

  setHud(on) { this.hud.classList.toggle('off', !on); }

  // ── 목표 ────────────────────────────
  refreshObjective() {
    const o = this.game.quests.objectiveText();
    if (!o) { this.obj.classList.add('hidden'); return; }
    this.obj.classList.remove('hidden');
    this.obj.classList.toggle('side', o.kind !== 'main');
    this.obj.querySelector('.q').textContent = o.title;
    this.obj.querySelector('.t').textContent = o.text;
  }

  hint(text) {
    const h = this.obj.querySelector('.h');
    h.textContent = text;
    h.classList.remove('hidden');
    clearTimeout(this._hintT);
    this._hintT = setTimeout(() => h.classList.add('hidden'), 14000);
  }

  // ── 알림 ────────────────────────────
  toast(text, opts = {}) {
    const el = $(`<div class="toast ${opts.kind || ''}"></div>`);
    el.textContent = text;
    if (opts.sub) el.appendChild($(`<span class="sub"></span>`)).textContent = opts.sub;
    this.toastsEl.appendChild(el);
    while (this.toastsEl.children.length > 4) this.toastsEl.firstElementChild.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 700); }, opts.sub ? 5200 : 3600);
  }

  moa(text, dur) {
    const el = this.moaEl;
    el.innerHTML = `<b>모아</b>${text}`;
    el.style.opacity = 1;
    clearTimeout(this._moaT);
    this._moaT = setTimeout(() => (el.style.opacity = 0), dur || Math.max(3500, text.length * 85));
    this.game.journalNote && this.game.journalNote(text);
  }

  /** 지나가는 아웬의 말 (왼쪽 아래) */
  say(name, html) {
    if (name === null) { this.sayEl.style.opacity = 0; clearTimeout(this._sayT); return; }
    this.sayEl.querySelector('.who').textContent = name;
    this.sayEl.querySelector('.l').innerHTML = html;
    this.sayEl.style.opacity = 1;
    clearTimeout(this._sayT);
    this._sayT = setTimeout(() => (this.sayEl.style.opacity = 0), 5200);
  }

  prompt(text, short) {
    if (!text) { this.promptEl.classList.add('hidden'); if (this.tAct) this.tAct.classList.add('hidden'); this._prompt = null; return; }
    if (this._prompt === text) return;
    this._prompt = text;
    this.promptEl.innerHTML = `<span class="kbd">E</span>${text}`;
    // 터치: 단추에는 짧은 말, 화면에는 전체 설명
    this.promptEl.classList.remove('hidden');
    if (this.tAct) {
      this.tAct.classList.remove('hidden');
      const s = short || (text.includes('읽') ? '읽기' : text.includes('열') ? '열기' : text.includes('줍') ? '줍기' : text.includes('탑') ? '손 대기' : '살피기');
      this.tAct.textContent = s;
    }
  }

  regionTitle(name, desc, first) {
    const el = this.regionEl;
    el.querySelector('.name').textContent = name;
    el.querySelector('.desc').textContent = first ? desc : '';
    el.classList.add('show');
    clearTimeout(this._regT);
    this._regT = setTimeout(() => el.classList.remove('show'), first ? 5200 : 3000);
  }

  fade(on) { this.fadeEl.classList.toggle('on', on); }

  flash(color = '#ffffff', ms = 900) {
    const el = this.flashEl;
    el.style.transition = 'none';
    el.style.background = color;
    el.style.opacity = 0.8;
    requestAnimationFrame(() => { el.style.transition = `opacity ${ms}ms ease`; el.style.opacity = 0; });
  }

  // ── 나침반 ───────────────────────────
  /** 고도·속도 (높은 곳에서만) */
  altimeter(y, speed) {
    const on = y > 1800;
    this.alti.classList.toggle('hidden', !on);
    if (!on) return;
    const t = `고도 ${y >= 10000 ? (y / 1000).toFixed(1) + ' km' : Math.round(y).toLocaleString() + ' m'} · ${Math.round(speed)} m/s`;
    if (t !== this._altiT) { this.alti.textContent = t; this._altiT = t; }
  }

  updateCompass(camYaw, markers) {
    // 화면 정면 = 카메라 방위 (북쪽 0, 시계방향 +)
    const heading = ((-camYaw * 180) / Math.PI + 360) % 360;
    const W = this.compass.clientWidth || 400;
    const span = 140; // 보이는 각도
    const toX = (deg) => {
      let d = deg - heading;
      d = ((d + 540) % 360) - 180;
      if (Math.abs(d) > span / 2 + 6) return null;
      return W / 2 + (d / span) * W;
    };
    let html = '';
    const names = { 0: '북', 45: '북동', 90: '동', 135: '남동', 180: '남', 225: '남서', 270: '서', 315: '북서' };
    for (let a = 0; a < 360; a += 15) {
      const x = toX(a);
      if (x === null) continue;
      if (names[a] !== undefined) html += `<div class="tick ${a % 90 === 0 ? 'major' : ''}" style="left:${x}px">${names[a]}</div>`;
      else html += `<div class="tick minor" style="left:${x}px"></div>`;
    }
    for (const m of markers) {
      const x = toX(m.bearing);
      if (x === null) continue;
      html += `<div class="mk ${m.cls}" style="left:${x}px"><i></i>${m.label ? `<span>${m.label}</span>` : ''}</div>`;
    }
    if (html !== this._cHtml) { this.compassStrip.innerHTML = html; this._cHtml = html; }
  }

  // ── 공명탑 퍼즐 ──────────────────────────
  puzzle(z, err = false) {
    const el = this.puzzleEl;
    if (!z) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    el.querySelector('.label').textContent = z.playing ? z.listenLabel || '탑의 노래를 들으세요…' : '같은 선율을 연주하세요';
    el.querySelector('.slots').innerHTML = z.melody.map((n, i) => `<div class="slot ${i < z.i || z.playing ? 'on' : ''}" style="--c:${hex(NOTE_COLORS[n])}"></div>`).join('');
    if (z.playing) {
      // 탑이 노래하는 동안 한 음씩 불이 켜진다
      const slots = el.querySelectorAll('.slot');
      slots.forEach((s) => s.classList.remove('on'));
      z.melody.forEach((n, i) => setTimeout(() => slots[i] && slots[i].classList.add('on'), 600 + i * 620));
      setTimeout(() => slots.forEach((s) => s.classList.remove('on')), 600 + z.melody.length * 620 + 250);
    }
    el.classList.toggle('err', err);
    if (err) setTimeout(() => el.classList.remove('err'), 450);
  }

  // ── 대화창 ───────────────────────────
  _dialogueApi() {
    const ui = this;
    let box = null;
    const ensure = () => {
      if (box) return box;
      box = $(`<div class="dialogue glass"><div class="who"></div><div class="text"></div><div class="tr-hint"></div><div class="choices"></div><div class="next">▶</div></div>`);
      box.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; e.preventDefault(); ui.game.dialogue.next(); });
      ui.root.appendChild(box);
      return box;
    };
    return {
      line(name, title, line) {
        const b = ensure();
        b.classList.remove('hidden');
        b.querySelector('.who').className = 'who';
        b.querySelector('.who').innerHTML = `${name}<small>${title || ''}</small>`;
        b.querySelector('.text').innerHTML = ui.game.lang.render(line);
        const und = ui.game.lang.isUnderstood(line);
        const unknown = line.words.filter((w) => WORD[w] && !ui.game.lang.known(w)).length;
        b.querySelector('.tr-hint').textContent = und ? '' : `모르는 단어 ${unknown}개 — 들을수록, 글자돌을 읽을수록 알게 됩니다`;
        b.querySelector('.choices').innerHTML = '';
        b.querySelector('.next').classList.remove('hidden');
      },
      moa(text) {
        const b = ensure();
        b.classList.remove('hidden');
        b.querySelector('.who').className = 'who moa';
        b.querySelector('.who').innerHTML = `모아<small>탐사복 보조 지능</small>`;
        b.querySelector('.text').textContent = text;
        b.querySelector('.tr-hint').textContent = '';
        b.querySelector('.choices').innerHTML = '';
        b.querySelector('.next').classList.remove('hidden');
        ui.game.journalNote && ui.game.journalNote(text);
      },
      choices(list, cb) {
        const b = ensure();
        const c = b.querySelector('.choices');
        c.innerHTML = '';
        b.querySelector('.next').classList.add('hidden');
        list.forEach((ch, i) => {
          const btn = $(`<button class="btn">${ch.t}</button>`);
          btn.addEventListener('click', (e) => { e.stopPropagation(); c.innerHTML = ''; cb(i); });
          c.appendChild(btn);
        });
      },
      hide() { if (box) box.classList.add('hidden'); },
    };
  }

  // ── 카드 ─────────────────────────────
  // 한 번에 하나: 새 카드를 열면 앞의 카드는 닫힌다(앞 카드의 onClose 도 불린다).
  // opts.keys === false 면 E·스페이스·엔터로 닫히지 않는다 — 그 키를 쓰는 놀이 카드. wrap.close() 는 그 카드만 닫는다.
  _card(inner, onClose, opts = {}) {
    if (this._cardWrap) { this.closeCard(); if (this._cardWrap) this._cardWrap.close(); }
    const wrap = $(`<div class="card-wrap"><div class="card glass">${inner}<div><button class="btn" data-close-card>닫기</button></div></div></div>`);
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      wrap.remove();
      if (this._cardWrap === wrap) { this._cardWrap = null; this._cardClose = null; this.cardKeys = true; this.game.setMode('play'); }
      onClose && onClose();
    };
    wrap.querySelector('[data-close-card]').addEventListener('click', close);
    wrap.addEventListener('pointerdown', (e) => { if (e.target === wrap) close(); });
    this.root.appendChild(wrap);
    this.game.setMode('card');
    this._cardWrap = wrap;
    this._cardClose = close;
    this.cardKeys = opts.keys !== false;
    wrap.close = close;
    return wrap;
  }

  closeCard() { if (this._cardClose) { const c = this._cardClose; this._cardClose = null; c(); } }

  glyphCard(wordId, first) {
    const w = WORD[wordId];
    const notes = w.notes.map((n) => `<i style="--c:${hex(NOTE_COLORS[n % 5])}"></i>`).join('');
    this._card(`<div class="kicker">${first ? '새 단어' : '글자돌'}</div><div class="big-glyph">${glyphSVG(wordId, 120)}</div><h2>${w.ko}</h2><div class="notes">${notes}</div><p>점의 높이가 음의 높이예요. 아웬의 글자는 악보이기도 해요.</p>`);
  }

  memory(e) {
    this._card(`<div class="kicker">메아리 · 옛 기억</div><h2>${e.title}</h2><div class="memo">${e.text}</div>`);
  }

  infoCard(kicker, title, body) {
    this._card(`<div class="kicker">${kicker}</div><h2>${title}</h2><p>${body}</p>`);
  }

  /**
   * 시설 카드: 할 수 있는 일을 단추로.
   * items: [{ label, sub, disabled, primary, onClick, stay }] — stay 면 누른 뒤에도 카드를 닫지 않는다
   * opts: { onClose, keys } (_card 참고)
   */
  serviceCard(kicker, title, body, items, extra = '', opts = {}) {
    const html = `<div class="kicker">${kicker}</div><h2>${title}</h2>${body ? `<p>${body}</p>` : ''}${extra}<div class="svc">${items.map((it, i) => it.head ? `<div class="svc-h">${it.head}</div>` : `<button class="btn svc-b${it.primary ? ' primary' : ''}" data-i="${i}" ${it.disabled ? 'disabled' : ''}><b>${it.label}</b>${it.sub ? `<small>${it.sub}</small>` : ''}</button>`).join('')}</div>`;
    const wrap = this._card(html, opts.onClose, opts);
    wrap.querySelector('.card').classList.add('svc-card');
    wrap.querySelectorAll('[data-i]').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      const it = items[+b.dataset.i];
      if (!it || it.disabled) return;
      if (!it.stay) this.closeCard();
      it.onClick && it.onClick(b);
    }));
    return wrap;
  }

  // ── 메뉴 ─────────────────────────────
  openMenu(tab = 'map', force = false) {
    const g = this.game;
    if (this.menuEl) { this.switchTab(tab); return; }
    if (!force && (g.mode === 'dialogue' || g.mode === 'title' || g.mode === 'intro' || g.mode === 'cinematic')) return;
    this._menuPrev = g.mode;
    if (g.mode !== 'title') g.setMode('menu');
    const m = $(`<div class="menu"><div class="head"><div class="title">SEREN</div>
      <button class="tab" data-t="map">지도</button><button class="tab" data-t="journal">일지</button><button class="tab" data-t="settings">설정</button>
      <div class="sp"></div><button class="btn" data-close>돌아가기</button></div><div class="body"></div></div>`);
    m.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => this.switchTab(b.dataset.t)));
    m.querySelector('[data-close]').addEventListener('click', () => this.closeMenu());
    this.root.appendChild(m);
    this.menuEl = m;
    this.switchTab(tab);
  }

  switchTab(tab) {
    const m = this.menuEl;
    if (!m) return;
    m.querySelectorAll('.tab').forEach((b) => b.classList.toggle('on', b.dataset.t === tab));
    const body = m.querySelector('.body');
    this.mapView.detach();
    body.className = 'body' + (tab === 'map' ? ' map' : '');
    body.innerHTML = '';
    if (tab === 'map') this.mapView.attach(body);
    else if (tab === 'journal') this.journal.render(body);
    else this.settingsView.render(body);
    this.menuTab = tab;
  }

  closeMenu() {
    if (!this.menuEl) return;
    this.mapView.detach();
    this.menuEl.remove();
    this.menuEl = null;
    if (this._menuPrev !== 'title') this.game.setMode('play');
  }

  // ── 이름 노래 짓기 ─────────────────────────
  compose(onDone) {
    const g = this.game;
    const el = $(`<div class="compose glass"><h3>나의 노래</h3><p>공명 단추로 여섯 음을 연주하세요. 이 선율이 하늘로 보내집니다.</p><div class="slots"></div><div><button class="btn" data-r>다시</button> <button class="btn primary" data-ok disabled>보내기</button></div></div>`);
    const notes = [];
    const draw = () => {
      el.querySelector('.slots').innerHTML = Array.from({ length: 6 }, (_, i) => `<div class="slot ${i < notes.length ? 'on' : ''}" style="--c:${i < notes.length ? hex(NOTE_COLORS[notes[i]]) : '#fff'}"></div>`).join('');
      el.querySelector('[data-ok]').disabled = notes.length < 6;
    };
    draw();
    el.querySelector('[data-r]').addEventListener('click', () => { notes.length = 0; draw(); });
    el.querySelector('[data-ok]').addEventListener('click', () => { el.remove(); this._composeAdd = null; onDone([...notes]); });
    this.hud.appendChild(el);
    this._composeAdd = (n) => { if (notes.length < 6) { notes.push(n); draw(); } };
  }

  composeNote(n) { if (this._composeAdd) this._composeAdd(n); }

  // ── 타이틀 · 자막 ─────────────────────────
  title({ hasSave, onContinue, onNew, onSettings }) {
    const el = $(`<div class="title-screen">
      <div class="title-logo"><div class="en">SEREN</div><div class="ko">울림이 남는 별</div></div>
      <div class="title-menu">
        ${hasSave ? '<button class="btn primary" data-c>이어하기</button>' : ''}
        <button class="btn ${hasSave ? '' : 'primary'}" data-n>${hasSave ? '처음부터' : '시작하기'}</button>
        <button class="btn" data-s>설정</button>
      </div>
      <div class="title-foot">${this.touch ? '헤드폰을 권해요 · 가로 화면이 편해요' : '헤드폰을 권해요 · WASD 이동 · 마우스 시점 · Space 점프/활공 · 1–5 공명'}</div>
    </div>`);
    el.querySelector('[data-c]')?.addEventListener('click', onContinue);
    el.querySelector('[data-n]').addEventListener('click', () => {
      if (!hasSave) { onNew(); return; }
      this.confirm('새로 시작하면 지금까지의 여정이 지워져요.', '처음부터 시작', onNew);
    });
    el.querySelector('[data-s]').addEventListener('click', onSettings);
    this.root.appendChild(el);
    this.titleEl = el;
    this.setHud(false);
  }

  /** 페이지 안의 확인 창 (브라우저 confirm 대신 — 일부 환경에서는 confirm 이 막혀 있다) */
  confirm(text, yesLabel, onYes) {
    const el = $(`<div class="card-wrap" style="z-index:40"><div class="card glass"><p style="color:var(--ink);font-size:16px">${text}</p><div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap"><button class="btn" data-no>그만두기</button><button class="btn primary" data-yes>${yesLabel}</button></div></div></div>`);
    el.querySelector('[data-no]').addEventListener('click', () => el.remove());
    el.querySelector('[data-yes]').addEventListener('click', () => { el.remove(); onYes(); });
    this.root.appendChild(el);
  }

  hideTitle() {
    if (!this.titleEl) return;
    const el = this.titleEl;
    el.classList.add('out');
    setTimeout(() => el.remove(), 1300);
    this.titleEl = null;
  }

  caption(lines, onDone) {
    const el = $(`<div class="caption"><div class="c"></div><div class="skip">눌러서 넘기기</div></div>`);
    this.root.appendChild(el);
    const c = el.querySelector('.c');
    let i = 0, timer = null;
    const next = () => {
      clearTimeout(timer);
      if (i >= lines.length) { c.classList.remove('on'); setTimeout(() => { el.remove(); onDone && onDone(); }, 1200); return; }
      c.classList.remove('on');
      setTimeout(() => {
        c.innerHTML = lines[i++];
        c.classList.add('on');
        timer = setTimeout(next, 4200);
      }, i === 0 ? 300 : 1300);
    };
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); next(); });
    this._captionNext = next;
    next();
  }
}
