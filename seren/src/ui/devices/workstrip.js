// 손일 띠 (v24 「기기별 UI」): 생산 줄 · 계산대 빛판 · 그릇 씻개 · 보존 작업대처럼 「박자에 맞춰 손을 대는」 일.
//  화면 아래에 그 작업면(움직이는 벨트·빛판 · 그 위를 오가는 물건)과 손을 댈 칸(가운데 창)만 뜬다 — 세계는 가리지 않고,
//  내 손(아바타)이 실제로 그 자리에서 일한다. E·스페이스·누르기로 손을 댄다. 맞으면 칸이 초록으로 번쩍, 빗나가면 빨강.
import { esc, blip, mountDevice, isUse } from './common.js';

const ICON = { belt: '◆', scan: '▣', dish: '◯', chisel: '✦', stamp: '▤', sort: '▥' };

/** workStrip(game, { title, desc, rounds, kind, onDone(hits) }) */
export function workStrip(game, o) {
  const el = document.createElement('div');
  el.className = `wstrip k-${o.kind || 'belt'}`;
  el.innerHTML = `<div class="ws-tag"><b>${esc(o.title)}</b><span>${esc(o.desc || '')}</span></div>
    <div class="ws-bed"><div class="ws-belt"></div><div class="ws-win"></div><div class="ws-item">${ICON[o.kind] || ICON.belt}</div></div>
    <div class="ws-row"><span class="ws-count">0 / ${o.rounds}</span><button class="ws-hit">손 대기 (E)</button><button class="ws-quit">그만 (Esc)</button></div>`;
  const item = el.querySelector('.ws-item'), win = el.querySelector('.ws-win'), count = el.querySelector('.ws-count'), belt = el.querySelector('.ws-belt');
  let n = 0, hits = 0, last = performance.now(), ph = 0, sp = 0.55, done = false;
  if (game.avatar && game.avatar.act) game.avatar.act('operate', 1.2);
  const hit = () => {
    if (done) return;
    const x = 0.5 + 0.5 * Math.sin(ph), ok = x > 0.4 && x < 0.6;
    if (ok) hits++;
    n++; sp *= 1.12;
    win.classList.remove('ok', 'no'); void win.offsetWidth; win.classList.add(ok ? 'ok' : 'no');
    if (game.audio && game.audio.tone) game.audio.tone(ok ? 2 : 0, { gain: 0.3 });
    if (game.avatar && game.avatar.act) game.avatar.act('operate', 0.6);
    count.textContent = `${hits} / ${n}${ok ? ' · 좋아요' : ' · 빗나감'}`;
    if (n >= o.rounds) { done = true; setTimeout(() => { lay.close(); o.onDone(hits); }, 420); }
  };
  el.querySelector('.ws-hit').addEventListener('click', hit);
  el.querySelector('.ws-quit').addEventListener('click', () => lay.close());
  const tick = (now) => {
    if (done || !el.isConnected) return;
    const dt = Math.min(0.25, (now - last) / 1000); last = now;
    ph += dt * sp * Math.PI * 2;
    item.style.left = `${(0.5 + 0.5 * Math.sin(ph)) * 100}%`;
    belt.style.backgroundPositionX = `${(ph * 40) % 400}px`;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  const lay = mountDevice(game, el, { cls: 'dev-strip', keys: (e) => { if (isUse(e)) { hit(); return true; } return false; } });
  blip(game, 'click');
  return lay;
}
