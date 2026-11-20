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
    $('btn-settings').onclick = () => this.openSettings();
    $('btn-help').onclick = () => $('help').classList.remove('hidden');
    $('h-close').onclick = () => $('help').classList.add('hidden');
  }
  startPlay() { $('title').classList.add('hidden'); $('hud').classList.remove('hidden'); document.body.classList.remove('menu-open'); document.body.classList.add('playing'); }

  // ---- quests
  setQuest(q, animate) {
    const el = $('quest');
    if (!q) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    $('q-step').textContent = `탐사 목표 ${q.step} / ${q.total}`;
    $('q-title').textContent = q.title; $('q-text').textContent = q.text;
    $('q-prog').textContent = q.prog ? `${q.prog[0]} / ${q.prog[1]}` : '';
    if (animate) { el.classList.remove('enter'); void el.offsetWidth; el.classList.add('enter'); }
  }
  questDone(title, reward) {
    $('qdone-title').textContent = title; $('qdone-reward').textContent = reward ? '획득 · ' + reward : '';
    const el = $('qdone'); this.restart(el); el._t = setTimeout(() => el.classList.add('hidden'), 3600);
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
  story(lines, onDone, { title = null, hold = 3400, memory = false } = {}) {
    const el = $('story'), box = $('story-text');
    box.innerHTML = ''; el.classList.remove('hidden', 'fade'); el.classList.toggle('memory', memory);
    let i = 0, t = null, done = false;
    const finish = () => { if (done) return; done = true; clearTimeout(t); el.classList.add('fade'); setTimeout(() => { el.classList.add('hidden'); onDone?.(); }, 1000); };
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
    const body = $('jr-body'), el = $('journal');
    const render = (tab) => {
      for (const b of el.querySelectorAll('.jr-tabs button')) b.classList.toggle('on', b.dataset.tab === tab);
      body.innerHTML = '';
      for (const e of data[tab]) { const d = document.createElement('div'); d.className = 'jr-item' + (e.unknown ? ' unknown' : ''); const b = document.createElement('b'); b.textContent = e.title; d.appendChild(b);
        if (e.text) { const p = document.createElement('p'); p.textContent = e.text; d.appendChild(p); } body.appendChild(d); }
    };
    for (const b of el.querySelectorAll('.jr-tabs button')) b.onclick = () => render(b.dataset.tab);
    $('jr-close').onclick = () => el.classList.add('hidden');
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

  setShards(n, t) { $('shards').textContent = n; $('shards-total').textContent = '/' + t; }
  setFriends(n, t) { $('friends').textContent = n; $('friends-total').textContent = '/' + t; }
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

  showPause(info) {
    $('pause').classList.remove('hidden'); document.body.classList.add('menu-open');
    $('save-info').textContent = info || '';
    $('p-resume').onclick = () => this.fire('resume');
    $('p-save').onclick = () => this.fire('save');
    $('p-load').onclick = () => this.fire('load');
    $('p-settings').onclick = () => this.openSettings();
    $('p-journal').onclick = () => this.fire('journal');
    $('p-help').onclick = () => $('help').classList.remove('hidden');
    $('p-title').onclick = () => this.fire('title');
    $('h-close').onclick = () => $('help').classList.add('hidden');
  }
  hidePause() { $('pause').classList.add('hidden'); $('settings').classList.add('hidden'); $('help').classList.add('hidden'); $('journal').classList.add('hidden'); document.body.classList.remove('menu-open'); }
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
    $('s-quality').onchange = (e) => { S.quality = e.target.value; apply(); $('quality-note').textContent = '그래픽 품질은 페이지를 새로고침하면 적용돼요.'; };
    $('s-close').onclick = () => $('settings').classList.add('hidden');
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
