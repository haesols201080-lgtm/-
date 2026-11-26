// DOM UI: loading, title, HUD (counters, prompts, discovery banners, toasts, bubbles), pause, settings, help,
// gamepad remapping and save slots (localStorage, guarded).
import { isTouch } from './quality.js';
import { mountLogo } from './logo.js';

const $ = (id) => document.getElementById(id);
// unit designations shown beside the speaker's name
const CODES = { 세븐: 'SV-7', 셔터: 'R-2', 랜턴: 'L-4', 로터: 'D-1' };
const SAVE_KEY = 'nuri-save-v1', SET_KEY = 'nuri-settings-v1';

export function readJSON(key) { try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : null; } catch { return null; } }
export function writeJSON(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); return true; } catch { return false; } }
export const loadSave = () => readJSON(SAVE_KEY);
export const writeSave = (s) => writeJSON(SAVE_KEY, s);
export const loadSettings = () => readJSON(SET_KEY);
export const writeSettings = (s) => writeJSON(SET_KEY, s);

export class UI {
  constructor() {
    if (isTouch) document.body.classList.add('touch');
    for (const m of document.querySelectorAll('.mark')) mountLogo(m);
    // fetch the notebook pieces now, so the pocket notebook is there the moment play starts (CSS backgrounds
    // only load when first shown)
    this._pre = ['pocket_open', 'pocket_shut', 'spread', 'ring', 'disc'].map((n) => { const im = new Image(); im.src = `./ui/${n}.webp`; return im; })
      .concat(['paper.jpg', 'leather.jpg'].map((n) => { const im = new Image(); im.src = `./ui/${n}`; return im; }));
    // the pocket notebook in the corner opens the notebook (pause)
    const nb = $('nb');
    const openNb = (e) => { e.preventDefault(); e.stopPropagation(); this.fire('nbpause'); };
    nb.addEventListener('click', openNb); nb.addEventListener('touchstart', openNb, { passive: false });
    nb.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') openNb(e); });
    // closing a section: back to the contents when the notebook is open in play, otherwise the notebook shuts
    const shut = (id) => () => (this.section ? this.go('toc') : this.closeBook($(id), () => $(id).classList.add('hidden')));
    $('h-close').onclick = shut('help'); $('s-close').onclick = shut('settings'); $('jr-close').onclick = shut('journal');
    $('bm-close').onclick = () => (this.section ? this.go('toc') : this.fire('mapkey'));
    // every spread is a pair of pages of the same notebook: the page underlay the flags tuck under, the ruled sheets
    // with their printed header and page numbers (the contents page lists the same numbers)
    const PAGES = { pause: [2, 3, 1], journal: [4, 5, 2], bigmap: [6, 7, 3], settings: [8, 9, 4], help: [10, 11, 5] };
    for (const book of document.querySelectorAll('.book')) {
      const [pl, pr, no] = PAGES[book.closest('.screen').id] || [0, 0, 0];
      const top = document.createElement('i'); top.className = 'page-top';
      const mk = (side, hdr, pno) => { const d = document.createElement('div'); d.className = 'sheet ' + side;
        const h = document.createElement('span'); h.className = 'hdr'; h.append(...hdr); const n = document.createElement('span'); n.className = 'pno'; n.textContent = pno; d.append(h, n); return d; };
      const nb = document.createElement('b'); nb.textContent = no;
      book.prepend(top, mk('l', ['SV-7 FIELD NOTES'], pl), mk('r', ['No.', nb], pr));
    }
    // choices are written out and the chosen one circled (the <select> stays underneath for the value)
    for (const sel of document.querySelectorAll('.pg select')) {
      const box = document.createElement('span'); box.className = 'opts';
      for (const o of sel.options) {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'opt'; b.dataset.v = o.value; b.textContent = o.textContent.replace(/\s*\(.*\)/, '');
        b.onclick = (e) => { e.preventDefault(); if (sel.value === o.value) return; const old = box.querySelector('.opt.on'); if (old) this.eraseRing(old); sel.value = o.value; sel.dispatchEvent(new Event('change')); this.syncOpts(); };
        box.appendChild(b);
      }
      sel.after(box); sel._opts = box;
    }
    // a tick rubbed out with the eraser when a box is cleared
    document.addEventListener('change', (e) => { const t = e.target; if (t.matches?.('.pg input[type=checkbox]') && !t.checked) this.rubOut(t, '✓', 1.75); }, true);
    // index tabs on the edge of every spread: jump between sections of the notebook
    const SECTION = { pause: 'toc', journal: 'journal', bigmap: 'map', settings: 'settings', help: 'help' };
    for (const nav of document.querySelectorAll('.book .tabs')) {
      const here = SECTION[nav.closest('.screen').id];
      for (const b of nav.querySelectorAll('button')) {
        b.classList.toggle('on', b.dataset.go === here);
        b.onclick = () => this.go(b.dataset.go);
      }
    }
    this.handlers = {};
  }
  on(name, fn) { this.handlers[name] = fn; }
  fire(name, ...a) { this.handlers[name]?.(...a); }

  progress(k, label) {
    $('loadbar').style.width = (k * 100).toFixed(0) + '%'; $('loadpct').textContent = Math.round(k * 100) + '%';
    // (players see a plain status, not asset file names)
    if (label) $('loadtxt').textContent = k < 0.35 ? '지형과 물길을 만드는 중' : k < 0.7 ? '나무와 이끼를 심는 중' : k < 0.95 ? '친구들을 깨우는 중' : '거의 다 됐어요';
    if (!this._tipT) this.rotateTips();
  }
  rotateTips() {
    const tips = ['숙이기 버튼으로 구르면 좁은 틈도 지나갈 수 있어요.', '물에 들어갔다 나오면 세븐이 흠뻑 젖어요.', '무거운 상자는 발판 위에 올려 보세요.',
      '덩굴은 벽 쪽으로 밀면 기어오를 수 있어요.', '동력 결정은 바위 위나 그루터기 근처에 숨어 있곤 해요.', '친구 로봇 셋이 숲 어딘가에서 기다리고 있어요.',
      '미니맵을 누르면 숲 지도가 열려요.', '동력 결정을 연달아 모으면 회수음이 점점 높아져요.'];
    let i = Math.floor(Math.random() * tips.length);
    const show = () => { const el = $('loadtip'); el.parentElement.classList.add('out'); setTimeout(() => { el.textContent = tips[i++ % tips.length]; el.parentElement.classList.remove('out'); }, 450); };
    $('loadtip').textContent = tips[i++ % tips.length];
    this._tipT = setInterval(show, 4200);
  }
  hideLoading() { clearInterval(this._tipT); const el = $('loading'); el.classList.add('done'); setTimeout(() => el.classList.add('hidden'), 850); }

  showTitle(hasSave) {
    $('title').classList.remove('hidden'); $('hud').classList.add('hidden'); document.body.classList.add('menu-open');
    $('btn-continue').classList.toggle('hidden', !hasSave);
    $('btn-continue').onclick = () => this.fire('continue');
    // in-page confirmation (browser confirm() dialogs are not available everywhere)
    let armed = false;
    $('btn-new').textContent = '새 게임';
    $('btn-new').onclick = () => {
      if (hasSave && !armed) { armed = true; $('btn-new').textContent = '저장이 지워져요 · 한 번 더 누르면 시작'; return; }
      this.fire('new');
    };
    $('btn-settings').onclick = () => { this.openSettings(); this.openBook($('settings')); };
    $('btn-help').onclick = () => this.openBook($('help'));
  }
  startPlay() { $('title').classList.add('hidden'); $('hud').classList.remove('hidden'); document.body.classList.remove('menu-open'); document.body.classList.add('playing'); }

  // ---- quests
  setQuest(q, animate) {
    const el = $('quest');
    if (!q) { el.classList.add('hidden'); return; }
    // a task just finished stays ticked and struck through for a moment before the next one is written
    if (this._qHold && performance.now() < this._qHold) { clearTimeout(this._qT); this._qT = setTimeout(() => this.setQuest(q, animate), this._qHold - performance.now() + 20); return; }
    el.classList.remove('hidden');
    const title = q.title, prog = q.prog ? `${q.prog[0]} / ${q.prog[1]}` : '';
    const isNew = $('q-title').textContent !== title;
    if (isNew) {
      // the old lines rubbed out, the new task written on the same lines
      if ($('q-title').textContent && el.offsetParent) this.rubOut($('quest').querySelector('.q-head')), this.rubOut($('quest').querySelector('.q-obj'));
      el.classList.remove('done');
      $('q-step').textContent = `No.${q.step} / ${q.total}`;
      $('q-title').textContent = title; $('q-text').textContent = q.text; $('q-prog').textContent = prog;
      if (animate !== false) { el.classList.remove('enter'); void el.offsetWidth; el.classList.add('enter'); }
    } else {
      if ($('q-text').textContent !== q.text) $('q-text').textContent = q.text;
      this.rewrite($('q-prog'), prog);
    }
  }
  questDone(title, reward) {
    // in the corner notebook: the box ticked, the task struck through
    const el = $('quest'); el.classList.remove('done'); void el.offsetWidth; el.classList.add('done'); this._qHold = performance.now() + 1500;
    $('qdone-title').textContent = title; $('qdone-reward').textContent = reward ? '획득 · ' + reward : '';
    const d = $('qdone'); this.restart(d); d._t = setTimeout(() => d.classList.add('hidden'), 3600);
  }
  // ---- juice
  flyShard(x, y, onArrive) {
    const target = $('shards').closest('.ct').getBoundingClientRect();
    const d = document.createElement('i'); d.className = 'flyshard'; d.style.transform = `translate(${x}px, ${y}px)`;
    document.body.appendChild(d);
    requestAnimationFrame(() => requestAnimationFrame(() => { d.style.transform = `translate(${target.left + 16}px, ${target.top + target.height / 2}px) scale(.7)`; }));
    setTimeout(() => { d.remove(); onArrive?.(); const ct = $('shards').closest('.ct'); ct.classList.remove('bump'); void ct.offsetWidth; ct.classList.add('bump'); }, 640);
  }
  // ---- dialogue: lines = [[name, text], ...]; typewriter, advance by tap / action / jump
  dialogue(lines, onDone) {
    const el = $('dlg'), nm = $('dlg-name'), tx = $('dlg-text');
    let i = -1, full = '', shown = 0, timer = null;
    const next = () => {
      if (timer && shown < full.length) { shown = full.length; tx.textContent = full; el.classList.remove('typing'); return; }
      i++;
      if (i >= lines.length) { clearInterval(timer); el.classList.add('hidden'); document.body.classList.remove('dialog'); this.dlg = null; onDone?.(); return; }
      const [who, text] = lines[i];
      nm.textContent = who; nm.classList.toggle('nuri', who === '세븐');
      if (CODES[who]) { const c = document.createElement('span'); c.className = 'code'; c.textContent = CODES[who]; nm.appendChild(c); }
      full = text; shown = 0; tx.textContent = ''; el.classList.add('typing');
      clearInterval(timer);
      timer = setInterval(() => { shown += 1; tx.textContent = full.slice(0, shown); if (shown >= full.length) { clearInterval(timer); el.classList.remove('typing'); } }, 28);
      this.fire('dlgline', who);
    };
    el.classList.remove('hidden'); document.body.classList.add('dialog');
    el.onclick = next; el.ontouchstart = (e) => { e.stopPropagation(); e.preventDefault(); next(); };
    this.dlg = { next };
    next();
  }
  // full-screen story text over black (intro / ending); tap to skip ahead
  // onFade runs as the page starts to fade, so whatever comes next is already on screen behind it (no flash of the
  // plain game view between the story and a cutscene)
  story(lines, onDone, { title = null, hold = 3400, memory = false, onFade = null } = {}) {
    const el = $('story'), box = $('story-text');
    box.innerHTML = ''; el.classList.remove('hidden', 'fade'); el.classList.toggle('memory', memory);
    let i = 0, t = null, done = false;
    const finish = () => { if (done) return; done = true; clearTimeout(t); onFade?.(); el.classList.add('fade'); setTimeout(() => { el.classList.add('hidden'); onDone?.(); }, 1000); };
    const step = () => {
      if (i < lines.length) { const p = document.createElement('p'); p.textContent = lines[i++]; box.appendChild(p); t = setTimeout(step, hold); }
      else if (title && !box.querySelector('.title')) { const p = document.createElement('p'); p.className = 'title'; p.textContent = title; box.appendChild(p); t = setTimeout(finish, 3000); }
      else finish();
    };
    el.onclick = () => { clearTimeout(t); step(); };
    el.ontouchstart = (e) => { e.preventDefault(); clearTimeout(t); step(); };
    step();
  }
  // a short list of choices (Mina's flights)
  choose(title, options, cb) {
    let el = $('choice'); if (!el) { el = document.createElement('div'); el.id = 'choice'; el.className = 'screen'; document.body.appendChild(el); }
    el.innerHTML = ''; el.classList.remove('hidden');
    const pn = document.createElement('div'); pn.className = 'panel'; const h = document.createElement('h2'); h.textContent = title; pn.appendChild(h);
    const mn = document.createElement('div'); mn.className = 'menu';
    for (const [label, v] of options) { const b = document.createElement('button'); b.textContent = label; b.onclick = () => { el.classList.add('hidden'); cb(v); }; mn.appendChild(b); }
    const x = document.createElement('button'); x.textContent = '그만두기'; x.onclick = () => { el.classList.add('hidden'); cb(null); }; mn.appendChild(x);
    pn.appendChild(mn); el.appendChild(pn); this.choiceOpen = () => !el.classList.contains('hidden');
  }
  fadeOut(ms, then) { let f = $('fader'); if (!f) { f = document.createElement('div'); f.id = 'fader'; document.body.appendChild(f); } f.style.opacity = '1'; setTimeout(() => { then?.(); setTimeout(() => { f.style.opacity = '0'; }, 250); }, ms); }
  // ---- relics & journal
  relic(name, desc, foot) { $('relic-name').textContent = name; $('relic-desc').textContent = desc; $('relic-foot').textContent = foot; const el = $('relic'); this.restart(el); el._t = setTimeout(() => el.classList.add('hidden'), 8000); }
  openJournal(data) {
    const body = $('jr-body'), el = $('journal'), det = $('jr-detail');
    const show = (tab, e) => {
      det.innerHTML = '';
      const h = document.createElement('h3'); const p = document.createElement('div'); p.className = 'jr-text';
      if (tab === 'stats') { h.textContent = '지금까지의 현황'; for (const s2 of data.stats) { const r = document.createElement('p'); r.textContent = s2.title; p.appendChild(r); } }
      else if (!e) { h.textContent = '빈 면'; const r = document.createElement('p'); r.textContent = '아직 적은 것이 없다.'; p.appendChild(r); }
      else { h.textContent = e.unknown ? '???' : (e.title || '탐사 기록'); const r = document.createElement('p'); r.textContent = e.text; p.appendChild(r); if (e.unknown) det.classList.add('unknown'); }
      det.classList.toggle('unknown', !!e?.unknown);
      det.append(h, p);
    };
    const render = (tab) => {
      for (const b of el.querySelectorAll('.jr-tabs button')) b.classList.toggle('on', b.dataset.tab === tab);
      body.innerHTML = '';
      const items = data[tab];
      items.forEach((e, i) => {
        const d = document.createElement('button'); d.className = 'jr-item' + (e.unknown ? ' unknown' : '');
        const label = e.title || (e.text.length > 20 ? e.text.slice(0, 20) + '…' : e.text);
        const n = document.createElement('i'); n.textContent = String(i + 1).padStart(2, '0'); const b = document.createElement('span'); b.textContent = label;
        d.append(n, b); d.onclick = () => { for (const x of body.children) x.classList.remove('on'); d.classList.add('on'); show(tab, e); };
        body.appendChild(d);
      });
      if (tab === 'stats') show('stats');
      else { const first = items.findIndex((e) => !e.unknown); if (first >= 0) body.children[first].click(); else show(tab, null); }
    };
    for (const b of el.querySelectorAll('.jr-tabs button')) b.onclick = () => render(b.dataset.tab);

    el.classList.remove('hidden'); render('relics');
  }
  // ---- ring trials
  trialShow(name, n) { $('tr-name').textContent = name; $('tr-count').textContent = `고리 0 / ${n}`; $('trial').classList.remove('hidden'); this._trN = n; }
  trialTime(t, i) { $('tr-time').textContent = t.toFixed(2); $('tr-count').textContent = `고리 ${i} / ${this._trN}`; }
  trialHide() { $('trial').classList.add('hidden'); }
  countdown(v) { const el = $('countdown'); el.textContent = v; this.restart(el); el._t = setTimeout(() => el.classList.add('hidden'), 900); }
  trialResult(name, t, m, isBest, prev) {
    $('trr-name').textContent = `${name} 완주`; $('trr-time').textContent = t.toFixed(2) + '초';
    const md = $('trr-medal'); md.className = m >= 0 ? 'm' + m : 'none'; md.textContent = ['금', '은', '동'][m] || '';
    $('trr-best').textContent = isBest ? (prev ? `최고 기록 경신 · 이전 ${prev.toFixed(2)}초` : '첫 기록') : `최고 기록 ${prev.toFixed(2)}초`;
    const el = $('trialres'); this.restart(el); el._t = setTimeout(() => el.classList.add('hidden'), 5500);
  }
  trialFail(name) { this.toast(`${name} 시간 초과. 출발 지점에서 다시 시작할 수 있어요.`); }
  combo(n) { const el = $('combo'); el.textContent = `연속 회수 ×${n}`; this.restart(el); el._t = setTimeout(() => el.classList.add('hidden'), 900); }
  flash() { const el = $('flash'); el.classList.remove('go'); void el.offsetWidth; el.classList.add('go'); }

  setShards(n, t) { this.rewrite($('shards'), n); $('shards-total').textContent = '/' + t; }
  setFriends(n, t) { this.rewrite($('friends'), n); $('friends-total').textContent = '/' + t; }
  setPrompt(text, usingPad) {
    const p = $('prompt');
    if (!text) { p.classList.add('hidden'); return; }
    p.classList.remove('hidden');
    $('prompt-key').textContent = isTouch ? '행동' : usingPad ? 'X' : 'E';
    $('prompt-text').textContent = text;
  }
  restart(el) { el.classList.add('hidden'); void el.offsetWidth; el.classList.remove('hidden'); clearTimeout(el._t); }
  discover(name) { $('discover-name').textContent = name; const el = $('discover'); this.restart(el); el._t = setTimeout(() => el.classList.add('hidden'), 4300); }
  toast(text) { const el = $('toast'); el.textContent = text; this.restart(el); el._t = setTimeout(() => el.classList.add('hidden'), 4100); }
  bubble(name, text) { $('bubble-name').textContent = name + (CODES[name] ? ' · ' + CODES[name] : ''); $('bubble-text').textContent = text; const el = $('bubble'); this.restart(el); el._t = setTimeout(() => el.classList.add('hidden'), 5100); }
  ability(title, desc) { $('ability-title').textContent = title; $('ability-desc').textContent = desc; const el = $('ability'); this.restart(el); el._t = setTimeout(() => el.classList.add('hidden'), 6100); }

  showPause(info, status) {
    document.body.classList.add('menu-open', 'paused'); this.section = 'toc';
    $('save-info').textContent = info || '';
    // today's record: what the robot is doing now, then the tallies, written as notebook lines
    const box = $('ps-status'); box.innerHTML = '';
    if (status?.quest) {
      const q = document.createElement('div'); q.className = 'entry-now';
      const h = document.createElement('small'); h.textContent = '지금 할 일'; q.appendChild(h);
      const t = document.createElement('b'); t.textContent = status.quest.title; q.appendChild(t);
      const x = document.createElement('p'); x.textContent = status.quest.text + (status.quest.prog ? `  (${status.quest.prog})` : ''); q.appendChild(x);
      box.appendChild(q);
    }
    for (const [k, v] of status?.lines || []) {
      const row = document.createElement('div'); row.className = 'entry';
      const a = document.createElement('span'); a.textContent = k; const b = document.createElement('em'); b.textContent = v;
      row.append(a, b); box.appendChild(row);
    }
    $('p-resume').onclick = () => this.fire('resume');
    $('p-save').onclick = () => this.fire('save');
    $('p-load').onclick = () => this.fire('load');
    $('p-settings').onclick = () => this.go('settings');
    $('p-journal').onclick = () => this.go('journal');
    $('p-help').onclick = () => this.go('help');
    $('p-map').onclick = () => this.go('map');
    $('p-title').onclick = () => this.fire('title');
    this.openBook($('pause'));
  }
  // ================================================================ pen and eraser
  syncOpts() { for (const sel of document.querySelectorAll('.pg select')) for (const b of sel._opts?.children || []) b.classList.toggle('on', b.dataset.v === sel.value); }
  // the ink at an element rubbed out: a copy of it shaking and fading where it was, a grey smudge, crumbs
  rubOut(el, text, scale = 1) {
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    const g = document.createElement('span'); g.className = 'rubbing'; g.textContent = text ?? el.textContent;
    Object.assign(g.style, { left: r.left + 'px', top: (text ? r.top - r.height * 0.55 : r.top) + 'px', font: cs.font, color: text ? '#a63d2c' : cs.color, lineHeight: cs.lineHeight });
    if (text) g.style.fontSize = parseFloat(cs.fontSize) * scale + 'px';
    document.body.appendChild(g); setTimeout(() => g.remove(), 700);
    const sm = document.createElement('i'); sm.className = 'smudge';
    Object.assign(sm.style, { left: r.left - 4 + 'px', top: r.top - 2 + 'px', width: Math.max(18, r.width + 8) + 'px', height: r.height + 4 + 'px' });
    document.body.appendChild(sm); setTimeout(() => sm.remove(), 2900);
    for (let k = 0; k < 5; k++) {
      const c = document.createElement('i'); c.className = 'crumb';
      Object.assign(c.style, { left: r.left + Math.random() * r.width + 'px', top: r.top + r.height * 0.6 + 'px' });
      c.style.setProperty('--dx', (Math.random() - 0.5) * 30 + 'px'); c.style.setProperty('--dy', 12 + Math.random() * 18 + 'px'); c.style.setProperty('--r', Math.random() * 180 + 'deg');
      document.body.appendChild(c); setTimeout(() => c.remove(), 850);
    }
  }
  eraseRing(opt) { const r = document.createElement('span'); r.className = 'rubbing'; const b = opt.getBoundingClientRect();
    Object.assign(r.style, { left: b.left + 'px', top: b.top + b.height * 0.12 + 'px', width: b.width + 'px', height: b.height * 0.8 + 'px', border: '1.8px solid #a63d2c', borderRadius: '50%', transform: 'rotate(-4deg)' });
    document.body.appendChild(r); setTimeout(() => r.remove(), 700); this.rubOut(opt, ''); }
  // write a new value over an old one: the old one rubbed out, the new one written in
  rewrite(el, text) {
    text = String(text);
    if (el.textContent === text) return;
    if (el.textContent && el.offsetParent) this.rubOut(el);
    el.textContent = text; el.classList.remove('pen'); void el.offsetWidth; el.classList.add('pen');
  }

  // ================================================================ the notebook in the hands
  // Every section is a spread of the same notebook. Opening: it comes up and the front cover swings open on the spine;
  // closing: the left-hand pages swing back over as the cover and it goes down; moving between sections: one leaf
  // turns, carrying the page you were reading on its front and the next one on its back. While a leaf turns, the far
  // page keeps the old writing until the leaf lands on it.
  // a page's writing copied onto a face (ids dropped; the copy is placed for the face, not the book)
  pageCopy(pg, inset) {
    const c = pg.cloneNode(true); c.removeAttribute('id'); for (const e of c.querySelectorAll('[id]')) e.removeAttribute('id');
    c.classList.add('pg-copy'); c.style.visibility = ''; Object.assign(c.style, inset, { position: 'absolute', overflow: 'hidden' }); c.scrollTop = pg.scrollTop; return c;
  }
  openBook(el, done) {
    el.classList.remove('hidden');
    const book = el.querySelector('.book'); this.clearBook(book);
    const flap = document.createElement('div'); flap.className = 'flap';
    const front = document.createElement('i'); front.className = 'face cover';
    const back = document.createElement('i'); back.className = 'face inside';
    // the left page as it will lie once the cover is over: the spread's left half with its writing
    this.sheetCopy(book, 'l', back, { left: '11.4%', right: '0', top: '7.3%', bottom: '9.5%' });
    const pl = book.querySelector('.pg-l'); if (pl) back.appendChild(this.pageCopy(pl, { left: '19.2%', right: '9.2%', top: '14.5%' }));
    flap.append(front, back); book.appendChild(flap);
    book.classList.add('closed', 'enter');
    const end = (e) => { if (e.target !== flap) return; flap.remove(); book.classList.remove('closed', 'enter'); this._bookAnim = null; done?.(); };
    flap.addEventListener('animationend', end); this._bookAnim = flap;
  }
  closeBook(el, done) {
    const book = el.querySelector('.book'); this.clearBook(book);
    const flap = document.createElement('div'); flap.className = 'flap shut';
    const front = document.createElement('i'); front.className = 'face cover';
    const back = document.createElement('i'); back.className = 'face inside';
    this.sheetCopy(book, 'l', back, { left: '11.4%', right: '0', top: '7.3%', bottom: '9.5%' });
    const pl = book.querySelector('.pg-l'); if (pl) back.appendChild(this.pageCopy(pl, { left: '19.2%', right: '9.2%', top: '14.5%' }));
    flap.append(front, back); book.appendChild(flap);
    book.classList.add('closing');
    const end = (e) => { if (e.target !== book) return; book.removeEventListener('animationend', end); flap.remove(); book.classList.remove('closing'); this._bookAnim = null; done?.(); };
    book.addEventListener('animationend', end); this._bookAnim = flap;
  }
  sheetCopy(book, side, face, inset) { const sh = book.querySelector('.sheet.' + side); if (!sh) return; const c = sh.cloneNode(true); Object.assign(c.style, inset); face.appendChild(c); }
  clearBook(book) { for (const x of book.querySelectorAll('.flap, .leaf, .pg-hold, .turn-shade')) x.remove(); book.classList.remove('closed', 'enter', 'closing'); for (const p of book.querySelectorAll('.pg')) p.style.visibility = ''; }
  // turn one leaf from the section on screen to the next one
  turn(fromEl, toEl, forward, done) {
    const fb = fromEl.querySelector('.book'), tb = toEl.querySelector('.book');
    this.clearBook(tb); this._turning = true;
    toEl.classList.remove('hidden'); toEl.classList.add('turning');
    const L = { left: '8.8%', right: '10.38%', top: '8.65%' }, R = { left: '12.19%', right: '8.8%', top: '8.65%' };
    const far = forward ? 'l' : 'r', near = forward ? 'r' : 'l';
    // the far page keeps the old writing until the leaf lands on it
    const hold = this.pageCopy(fb.querySelector('.pg-' + far), {}); hold.className = fb.querySelector('.pg-' + far).className + ' pg-hold'; hold.style.cssText = '';
    tb.appendChild(hold); tb.querySelector('.pg-' + far).style.visibility = 'hidden';
    const leaf = document.createElement('div'); leaf.className = 'leaf ' + (forward ? 'fwd' : 'bwd');
    const front = document.createElement('i'); front.className = 'face ' + (forward ? 'pr' : 'pl');
    const back = document.createElement('i'); back.className = 'face back ' + (forward ? 'pl' : 'pr');
    const PAGE = { left: '0', right: '0', top: '0', bottom: '0' };
    this.sheetCopy(fb, near, front, PAGE); this.sheetCopy(tb, far, back, PAGE);
    front.appendChild(this.pageCopy(fb.querySelector('.pg-' + near), forward ? R : L));
    back.appendChild(this.pageCopy(tb.querySelector('.pg-' + far), forward ? L : R));
    leaf.append(front, back);
    const shade = document.createElement('i'); shade.className = 'turn-shade ' + (forward ? 'fwd' : 'bwd');
    tb.append(shade, leaf);
    leaf.addEventListener('animationend', (e) => {
      if (e.target !== leaf) return;
      leaf.remove(); hold.remove(); shade.remove(); tb.querySelector('.pg-' + far).style.visibility = '';
      toEl.classList.remove('turning'); this._turning = false; done?.();
    });
    this.fire('pageturn');
  }
  // move to a section of the notebook (from the contents page, an index tab or a "close" on a section)
  go(where) {
    const ORDER = ['toc', 'journal', 'map', 'settings', 'help'], SCREEN = { toc: 'pause', journal: 'journal', map: 'bigmap', settings: 'settings', help: 'help' };
    const cur = this.section || 'toc';
    if (cur === where || this._turning) return;
    const fromEl = $(SCREEN[cur]);
    // fill the target section the usual way, then turn the leaf to it
    if (where === 'journal') this.fire('journal');
    else if (where === 'map') this.fire('openmap');
    else if (where === 'settings') this.openSettings();
    else if (where === 'help') $('help').classList.remove('hidden');
    const toEl = $(SCREEN[where]);
    this.section = where;
    this.turn(fromEl, toEl, ORDER.indexOf(where) > ORDER.indexOf(cur), () => {
      if (cur === 'map') this.fire('closemap'); else if (cur !== 'toc') fromEl.classList.add('hidden');
    });
  }
  hidePause() {
    // close the notebook from whichever section is open, then put it away
    const top = ['bigmap', 'journal', 'help', 'settings', 'pause'].map((id) => $(id)).find((el) => !el.classList.contains('hidden'));
    const finish = () => { $('pause').classList.add('hidden'); $('settings').classList.add('hidden'); $('help').classList.add('hidden'); $('journal').classList.add('hidden'); this.fire('closemap'); };
    document.body.classList.remove('paused'); this.section = null;
    if (top) this.closeBook(top, () => { finish(); document.body.classList.remove('menu-open'); }); else { finish(); document.body.classList.remove('menu-open'); }
  }
  pauseOpen() { return !$('pause').classList.contains('hidden'); }
  setSaveInfo(t) { $('save-info').textContent = t; }

  bindSettings(S, apply, input) {
    this.S = S; this.applyS = apply; this.input = input;
    const bindRange = (id, key) => { const el = $(id); el.value = S[key]; el.oninput = () => { S[key] = +el.value; apply(); }; };
    bindRange('s-master', 'master'); bindRange('s-music', 'music'); bindRange('s-sfx', 'sfx'); bindRange('s-sens', 'sens');
    $('s-invert').checked = S.invertY; $('s-invert').onchange = (e) => { S.invertY = e.target.checked; apply(); };
    $('s-tod').checked = S.timeFlow; $('s-tod').onchange = (e) => { S.timeFlow = e.target.checked; apply(); };
    $('s-guide').checked = S.guide !== false; $('s-guide').onchange = (e) => { S.guide = e.target.checked; apply(); };
    $('s-weather').value = S.weather; $('s-weather').onchange = (e) => { S.weather = e.target.value; apply(); };
    $('s-quality').value = S.quality;
    $('s-quality').onchange = (e) => { S.quality = e.target.value; apply(); this.rewrite($('quality-note'), '그래픽 품질은 페이지를 새로고침하면 적용돼요.'); };
    this.syncOpts();

    this.renderPadMap();
  }
  renderPadMap() {
    const box = $('pad-map'); box.innerHTML = '';
    const names = { jump: '점프', crouch: '숙이기', interact: '행동', emote: '인사' };
    for (const [k, label] of Object.entries(names)) {
      const b = document.createElement('button');
      b.textContent = `${label}: 버튼 ${this.input.padMap[k]}`;
      b.onclick = () => {
        b.textContent = `${label}: 버튼을 누르세요…`;
        this.input.capture = (idx) => { this.input.padMap[k] = idx; this.S.padMap = { ...this.input.padMap }; this.applyS(); this.renderPadMap(); };
      };
      box.appendChild(b);
    }
  }
  openSettings() { $('settings').classList.remove('hidden'); }
}
