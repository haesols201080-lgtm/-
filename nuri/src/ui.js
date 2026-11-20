// DOM UI: loading, title, HUD (counters, prompts, discovery banners, toasts, bubbles), pause, settings, help,
// gamepad remapping and save slots (localStorage, guarded).
import { isTouch } from './quality.js';

const $ = (id) => document.getElementById(id);
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
    this.handlers = {};
  }
  on(name, fn) { this.handlers[name] = fn; }
  fire(name, ...a) { this.handlers[name]?.(...a); }

  progress(k, label) { $('loadbar').style.width = (k * 100).toFixed(0) + '%'; if (label) $('loadtxt').textContent = `불러오는 중… ${label}`; }
  hideLoading() { $('loading').classList.add('hidden'); }

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
    $('q-step').textContent = `메인 퀘스트 ${q.step} / ${q.total}`;
    $('q-title').textContent = q.title; $('q-text').textContent = q.text;
    $('q-prog').textContent = q.prog ? `${q.prog[0]} / ${q.prog[1]}` : '';
    if (animate) { el.classList.remove('enter'); void el.offsetWidth; el.classList.add('enter'); }
  }
  questDone(title, reward) {
    $('qdone-title').textContent = title; $('qdone-reward').textContent = reward ? '보상 · ' + reward : '';
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
  combo(n) { const el = $('combo'); el.textContent = `연속 ×${n}`; this.restart(el); el._t = setTimeout(() => el.classList.add('hidden'), 900); }
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
  bubble(name, text) { $('bubble-name').textContent = name; $('bubble-text').textContent = text; const el = $('bubble'); this.restart(el); el._t = setTimeout(() => el.classList.add('hidden'), 5100); }
  ability(title, desc) { $('ability-title').textContent = title; $('ability-desc').textContent = desc; const el = $('ability'); this.restart(el); el._t = setTimeout(() => el.classList.add('hidden'), 6100); }

  showPause(info) {
    $('pause').classList.remove('hidden'); document.body.classList.add('menu-open');
    $('save-info').textContent = info || '';
    $('p-resume').onclick = () => this.fire('resume');
    $('p-save').onclick = () => this.fire('save');
    $('p-load').onclick = () => this.fire('load');
    $('p-settings').onclick = () => this.openSettings();
    $('p-help').onclick = () => $('help').classList.remove('hidden');
    $('p-title').onclick = () => this.fire('title');
    $('h-close').onclick = () => $('help').classList.add('hidden');
  }
  hidePause() { $('pause').classList.add('hidden'); $('settings').classList.add('hidden'); $('help').classList.add('hidden'); document.body.classList.remove('menu-open'); }
  pauseOpen() { return !$('pause').classList.contains('hidden'); }
  setSaveInfo(t) { $('save-info').textContent = t; }

  bindSettings(S, apply, input) {
    this.S = S; this.applyS = apply; this.input = input;
    const bindRange = (id, key) => { const el = $(id); el.value = S[key]; el.oninput = () => { S[key] = +el.value; apply(); }; };
    bindRange('s-master', 'master'); bindRange('s-music', 'music'); bindRange('s-sfx', 'sfx'); bindRange('s-sens', 'sens');
    $('s-invert').checked = S.invertY; $('s-invert').onchange = (e) => { S.invertY = e.target.checked; apply(); };
    $('s-tod').checked = S.timeFlow; $('s-tod').onchange = (e) => { S.timeFlow = e.target.checked; apply(); };
    $('s-weather').value = S.weather; $('s-weather').onchange = (e) => { S.weather = e.target.value; apply(); };
    $('s-quality').value = S.quality;
    $('s-quality').onchange = (e) => { S.quality = e.target.value; apply(); $('quality-note').textContent = '그래픽 품질은 페이지를 새로고침하면 적용돼요.'; };
    $('s-close').onclick = () => $('settings').classList.add('hidden');
    this.renderPadMap();
  }
  renderPadMap() {
    const box = $('pad-map'); box.innerHTML = '';
    const names = { jump: '점프', crouch: '숙이기', interact: '행동', emote: '손 흔들기' };
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
