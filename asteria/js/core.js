// 아스테리아 1부 — 공용 유틸, 노이즈, 입력, 소리
'use strict';

// ---------- 수학 / 노이즈 ----------
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const rand = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
const pick = arr => arr[(Math.random() * arr.length) | 0];
const angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
function hash2(x, y, s = 0) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 982451653)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967295;
}
function noise2(x, y, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s);
  const c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
function fbm(x, y, s = 0) {
  return noise2(x, y, s) * 0.55 + noise2(x * 2.1, y * 2.1, s + 7) * 0.3 + noise2(x * 4.3, y * 4.3, s + 13) * 0.15;
}
function ridged(x, y, s = 0) {
  let a = 0, amp = 0.6, f = 1;
  for (let i = 0; i < 4; i++) { const n = 1 - Math.abs(noise2(x * f, y * f, s + i * 11) * 2 - 1); a += n * n * amp; amp *= 0.5; f *= 2.03; }
  return a;
}
// 선분까지 거리
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 ? clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1) : 0;
  return [Math.hypot(px - ax - dx * t, py - ay - dy * t), t];
}
function polyDist(px, py, pts) {
  let best = 1e9, bi = 0, bt = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [d, t] = segDist(px, py, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
    if (d < best) { best = d; bi = i; bt = t; }
  }
  return [best, bi, bt];
}

// ---------- 입력 ----------
const KEYMAP = {
  KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right', ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run', Space: 'jump', KeyJ: 'attack', KeyK: 'cast', KeyE: 'act', Enter: 'act',
  KeyQ: 'rune', KeyF: 'glide', Tab: 'menu', KeyI: 'menu', KeyM: 'map', Escape: 'esc',
  Digit1: 'r1', Digit2: 'r2', Digit3: 'r3', Digit4: 'r4', KeyR: 'runeNext', KeyH: 'eat', KeyZ: 'camL', KeyC: 'camR',
};
const Input = {
  held: {}, pressed: {}, released: {}, joy: { x: 0, y: 0 }, look: { x: 0, y: 0 }, wheel: 0, locked: false,
  down(n) { if (!this.held[n]) this.pressed[n] = true; this.held[n] = true; },
  up(n) { if (this.held[n]) this.released[n] = true; this.held[n] = false; },
  hit(n) { return !!this.pressed[n]; },
  rel(n) { return !!this.released[n]; },
  key(n) { return !!this.held[n]; },
  endFrame() { this.pressed = {}; this.released = {}; this.look.x = 0; this.look.y = 0; this.wheel = 0; },
};
window.addEventListener('keydown', e => {
  const n = KEYMAP[e.code];
  if (n) { Input.down(n); if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault(); }
  Audio_.unlock();
});
window.addEventListener('keyup', e => { const n = KEYMAP[e.code]; if (n) Input.up(n); });
window.addEventListener('blur', () => { for (const k in Input.held) Input.up(k); });

// 마우스: 끌어서 카메라, 포인터 잠금 시 이동만으로 카메라. 왼쪽 공격, 오른쪽 마법
function setupPointer() {
  const el = document.getElementById('hud');
  let drag = null;
  el.addEventListener('contextmenu', e => e.preventDefault());
  el.addEventListener('pointerdown', e => {
    Audio_.unlock();
    if (e.pointerType === 'touch') {
      // 터치는 화면 오른쪽을 끌어 카메라를 돌린다
      if (!drag && e.clientX > window.innerWidth * 0.35) { drag = { id: e.pointerId, x: e.clientX, y: e.clientY, touch: true }; el.setPointerCapture(e.pointerId); }
      return;
    }
    if (G.mode !== 'play' || UI.modal || UI.dlg || UI.choice || UI.paper) return;
    if (Input.locked) { if (e.button === 0) Input.down('attack'); if (e.button === 2) Input.down('cast'); return; }
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0, button: e.button };
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener('pointermove', e => {
    if (Input.locked && e.pointerType === 'mouse') { Input.look.x += e.movementX; Input.look.y += e.movementY; return; }
    if (!drag || drag.id !== e.pointerId) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY; drag.moved = (drag.moved || 0) + Math.abs(dx) + Math.abs(dy);
    Input.look.x += dx * (drag.touch ? 1.6 : 1); Input.look.y += dy * (drag.touch ? 1.6 : 1);
  });
  const end = e => {
    if (Input.locked && e.pointerType === 'mouse') { if (e.button === 0) Input.up('attack'); if (e.button === 2) Input.up('cast'); return; }
    if (!drag || drag.id !== e.pointerId) return;
    if (!drag.touch && drag.moved < 6) {
      // 짧은 클릭: 왼쪽은 공격, 오른쪽은 마법. 처음 클릭하면 포인터 잠금을 시도한다
      if (drag.button === 0) { Input.down('attack'); setTimeout(() => Input.up('attack'), 30); }
      if (drag.button === 2) { Input.down('cast'); setTimeout(() => Input.up('cast'), 30); }
      if (!G.f.noLock) { try { const p = el.requestPointerLock && el.requestPointerLock(); if (p && p.catch) p.catch(() => { G.f.noLock = true; }); } catch (err) { G.f.noLock = true; } }
    }
    drag = null;
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('wheel', e => { Input.wheel += Math.sign(e.deltaY); }, { passive: true });
  document.addEventListener('pointerlockchange', () => { Input.locked = document.pointerLockElement === el; });
}

// 터치: 왼쪽 조이스틱 + 버튼
function setupTouch() {
  const pad = document.getElementById('joy'), knob = document.getElementById('joyKnob');
  if (!pad) return;
  let pid = null, cx = 0, cy = 0;
  const R = 46;
  pad.addEventListener('pointerdown', e => {
    pid = e.pointerId; pad.setPointerCapture(pid);
    const r = pad.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2;
    move(e); Audio_.unlock();
  });
  const move = e => {
    if (e.pointerId !== pid) return;
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const l = Math.hypot(dx, dy);
    if (l > R) { dx = dx / l * R; dy = dy / l * R; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    Input.joy.x = dx / R; Input.joy.y = dy / R;
  };
  pad.addEventListener('pointermove', move);
  const end = e => { if (e.pointerId !== pid) return; pid = null; knob.style.transform = ''; Input.joy.x = 0; Input.joy.y = 0; };
  pad.addEventListener('pointerup', end);
  pad.addEventListener('pointercancel', end);
  document.querySelectorAll('[data-btn]').forEach(b => {
    const n = b.dataset.btn;
    b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); b.setPointerCapture(e.pointerId); Input.down(n); b.classList.add('on'); Audio_.unlock(); });
    const off = () => { Input.up(n); b.classList.remove('on'); };
    b.addEventListener('pointerup', off);
    b.addEventListener('pointercancel', off);
  });
}

// ---------- 소리 (합성음) ----------
const Audio_ = {
  ac: null, muted: false, master: null, hum: null,
  unlock() {
    if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return; }
    try {
      this.ac = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ac.createGain(); this.master.gain.value = 0.32; this.master.connect(this.ac.destination);
    } catch (e) { this.ac = null; }
  },
  tone(f, d = 0.1, type = 'sine', v = 0.3, slide = 0, delay = 0) {
    if (!this.ac || this.muted) return;
    const t = this.ac.currentTime + delay;
    const o = this.ac.createOscillator(), g = this.ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + d + 0.05);
  },
  noise(d = 0.2, v = 0.2, hp = 800, lp = 0) {
    if (!this.ac || this.muted) return;
    const t = this.ac.currentTime, len = Math.floor(this.ac.sampleRate * d);
    const buf = this.ac.createBuffer(1, len, this.ac.sampleRate), ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = this.ac.createBufferSource(); s.buffer = buf;
    const f = this.ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
    let last = f;
    if (lp) { const l = this.ac.createBiquadFilter(); l.type = 'lowpass'; l.frequency.value = lp; f.connect(l); last = l; }
    const g = this.ac.createGain(); g.gain.value = v;
    s.connect(f); last.connect(g); g.connect(this.master); s.start(t);
  },
};
function sfx(n) {
  const A = Audio_;
  switch (n) {
    case 'blip': A.tone(660, 0.05, 'triangle', 0.06); break;
    case 'swing': A.noise(0.12, 0.14, 1600, 6000); break;
    case 'hit': A.tone(190, 0.14, 'square', 0.14, -100); A.noise(0.08, 0.2, 500); break;
    case 'hurt': A.tone(260, 0.22, 'sawtooth', 0.16, -160); break;
    case 'pick': A.tone(880, 0.1, 'triangle', 0.18); A.tone(1320, 0.14, 'triangle', 0.14, 0, 0.07); break;
    case 'cast': A.tone(740, 0.28, 'sine', 0.16, 600); A.tone(1110, 0.2, 'triangle', 0.06, 400, 0.03); A.noise(0.18, 0.05, 3000); break;
    case 'charge': A.tone(220, 0.5, 'sine', 0.1, 440); break;
    case 'wave': A.tone(160, 0.6, 'sine', 0.3, -80); A.noise(0.5, 0.22, 200, 2000); [523, 784, 1046].forEach((f, i) => A.tone(f, 0.5, 'sine', 0.06, 0, i * 0.05)); break;
    case 'zap': A.tone(1400, 0.12, 'sawtooth', 0.06, -900); A.noise(0.1, 0.1, 2500); break;
    case 'rune': A.tone(520, 0.3, 'sine', 0.18, 400); A.tone(780, 0.3, 'sine', 0.08, 600, 0.05); break;
    case 'ice': A.tone(1500, 0.25, 'triangle', 0.14, -700); A.noise(0.25, 0.1, 3500); break;
    case 'boom': A.noise(0.7, 0.5, 60, 1800); A.tone(80, 0.6, 'sine', 0.45, -45); break;
    case 'freeze': A.tone(300, 0.5, 'sine', 0.2, -200); A.tone(900, 0.4, 'triangle', 0.07); A.tone(1200, 0.4, 'sine', 0.05, 0, 0.1); break;
    case 'magnet': A.tone(220, 0.35, 'sawtooth', 0.05, 80); A.tone(330, 0.35, 'sine', 0.06, 60); break;
    case 'break': A.noise(0.35, 0.32, 300, 3000); A.tone(130, 0.24, 'square', 0.12, -70); break;
    case 'beat': A.tone(70, 0.16, 'sine', 0.42, -20); break;
    case 'beat2': A.tone(95, 0.12, 'sine', 0.3, -20); break;
    case 'open': [392, 523, 659].forEach((f, i) => A.tone(f, 0.25, 'triangle', 0.16, 0, i * 0.12)); break;
    case 'chime': [523, 659, 784, 1046, 1318].forEach((f, i) => A.tone(f, 0.7, 'sine', 0.12, 0, i * 0.1)); break;
    case 'rumble': A.noise(1.6, 0.42, 30, 400); A.tone(42, 1.4, 'sine', 0.4, -8); break;
    case 'cook': [440, 554, 659, 880].forEach((f, i) => A.tone(f, 0.2, 'triangle', 0.12, 0, i * 0.09)); break;
    case 'step': A.noise(0.04, 0.035, 1500, 5000); break;
    case 'jump': A.noise(0.1, 0.06, 800, 3000); A.tone(300, 0.08, 'sine', 0.05, 120); break;
    case 'land': A.noise(0.1, 0.1, 200, 1500); break;
    case 'glide': A.noise(0.6, 0.06, 2000); break;
    case 'splash': A.noise(0.4, 0.2, 400, 4000); break;
    case 'chain': A.tone(1200, 0.5, 'triangle', 0.18, -900); A.noise(0.25, 0.15, 2500); break;
    case 'deny': A.tone(200, 0.12, 'square', 0.08); A.tone(150, 0.15, 'square', 0.08, 0, 0.1); break;
    case 'mana': A.tone(1320, 0.12, 'sine', 0.03, 200); break;
  }
}
