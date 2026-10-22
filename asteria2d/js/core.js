// 아스테리아 1부 — 공용 유틸, 타일, 입력, 소리, 파티클
'use strict';

const TS = 32; // 타일 한 칸의 월드 픽셀

// ---------- 수학 / 난수 ----------
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const rand = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
const pick = arr => arr[(Math.random() * arr.length) | 0];
function hash2(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
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

// ---------- 타일 ----------
const T = {
  GRASS: 0, PATH: 1, DEEP: 2, SHALLOW: 3, SAND: 4, SALT: 5, TREE: 6, ROCK: 7, CLIFF: 8, HIGH: 9,
  CHASM: 10, WALL: 11, FLOOR: 12, SNOW: 13, LEY: 14, BRIDGE: 15, CRACK: 16, SHELF: 17, ROOF: 18,
  MINE: 19, DARK: 20, ICE: 21, MUD: 22, LEAF: 23, FENCE: 24, PILLAR: 25, CARPET: 26, SALTC: 27,
  RUIN: 28, FLOOD: 29, PINE: 30, FLOWER: 31, PLAZA: 32, STAIRS: 33, SALTROCK: 34, IVY: 35,
  RAVINE: 36, LAVA: 37, HOUSE: 38,
};
// solid: 막힘 / climb: 오를 수 있음 / high: 높은 곳 / ramp: 높은 곳으로 오르는 경사
// deep: 헤엄 / chasm: 떨어짐 / slow: 느려짐
const TD = [];
function td(id, o) { TD[id] = Object.assign({ solid: false, climb: false, high: false, ramp: false, deep: false, chasm: false, slow: 1 }, o); }
td(T.GRASS, { c: '#7cc46a' });
td(T.PATH, { c: '#d9c28f' });
td(T.DEEP, { c: '#3d86c6', deep: true });
td(T.SHALLOW, { c: '#6fb6dd', slow: 0.75 });
td(T.SAND, { c: '#ead9a6' });
td(T.SALT, { c: '#eef1f4', slow: 0.92 });
td(T.TREE, { c: '#4f9a52', solid: true });
td(T.ROCK, { c: '#9a9488', solid: true });
td(T.CLIFF, { c: '#a8916f', climb: true });
td(T.HIGH, { c: '#b9c98f', high: true });
td(T.CHASM, { c: '#1d2340', chasm: true });
td(T.WALL, { c: '#6c5a73', solid: true });
td(T.FLOOR, { c: '#c9b48e' });
td(T.SNOW, { c: '#eef3fa', slow: 0.85 });
td(T.LEY, { c: '#8fe3e0' });
td(T.BRIDGE, { c: '#a87a4c' });
td(T.CRACK, { c: '#7d6a62', solid: true });
td(T.SHELF, { c: '#8a5a3a', climb: true });
td(T.ROOF, { c: '#c4665a', high: true });
td(T.MINE, { c: '#6b5e55' });
td(T.DARK, { c: '#3a3236', solid: true });
td(T.ICE, { c: '#bfe9ff', ramp: true });
td(T.MUD, { c: '#a89070', slow: 0.8 });
td(T.LEAF, { c: '#d79a4a' });
td(T.FENCE, { c: '#8b6b4a', solid: true });
td(T.PILLAR, { c: '#cfc6b8', solid: true });
td(T.CARPET, { c: '#9c3d4f' });
td(T.SALTC, { c: '#eef1f4' });
td(T.RUIN, { c: '#c8c2b2', high: true });
td(T.FLOOD, { c: '#c9b48e' });
td(T.PINE, { c: '#3f7a58', solid: true });
td(T.FLOWER, { c: '#7cc46a' });
td(T.PLAZA, { c: '#e3d6bd' });
td(T.STAIRS, { c: '#bba57f', ramp: true });
td(T.SALTROCK, { c: '#dfe6ea', solid: true });
td(T.IVY, { c: '#5f8f4a', climb: true });
td(T.RAVINE, { c: '#2a2238', chasm: true });
td(T.LAVA, { c: '#e2603a', solid: true });
td(T.HOUSE, { c: '#b75a4a', solid: true });

// ---------- 캔버스 ----------
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
let VW = 800, VH = 600, DPR = 1, ZOOM = 1;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  VW = cv.clientWidth || window.innerWidth;
  VH = cv.clientHeight || window.innerHeight;
  cv.width = Math.round(VW * DPR);
  cv.height = Math.round(VH * DPR);
  // 짧은 변에 타일 약 15칸이 들어가도록
  ZOOM = clamp(Math.min(VW, VH) / (15 * TS), 0.7, 2.2);
}
window.addEventListener('resize', resize);

// ---------- 입력 ----------
const KEYMAP = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  ShiftLeft: 'run', ShiftRight: 'run', Space: 'attack', KeyJ: 'attack', KeyE: 'act', Enter: 'act', KeyK: 'act',
  KeyQ: 'rune', KeyL: 'rune', KeyF: 'glide', Tab: 'menu', KeyI: 'menu', KeyM: 'map', Escape: 'esc',
  Digit1: 'r1', Digit2: 'r2', Digit3: 'r3', Digit4: 'r4', KeyR: 'runeNext', KeyH: 'eat',
};
const Input = {
  held: {}, pressed: {}, joy: { x: 0, y: 0, active: false }, anyPressed: false,
  down(n) { if (!this.held[n]) { this.pressed[n] = true; this.anyPressed = true; } this.held[n] = true; },
  up(n) { this.held[n] = false; },
  hit(n) { return !!this.pressed[n]; },
  key(n) { return !!this.held[n]; },
  consume(n) { this.pressed[n] = false; },
  endFrame() { this.pressed = {}; this.anyPressed = false; },
};
window.addEventListener('keydown', e => {
  const n = KEYMAP[e.code];
  if (n) {
    Input.down(n);
    if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) || e.code === 'Space' || e.code === 'Tab') e.preventDefault();
  }
  Audio_.unlock();
});
window.addEventListener('keyup', e => { const n = KEYMAP[e.code]; if (n) Input.up(n); });
window.addEventListener('blur', () => { Input.held = {}; });

// 터치: 왼쪽 조이스틱 + 버튼
function setupTouch() {
  const pad = document.getElementById('joy');
  const knob = document.getElementById('joyKnob');
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
    Input.joy.x = dx / R; Input.joy.y = dy / R; Input.joy.active = true;
  };
  pad.addEventListener('pointermove', move);
  const end = e => {
    if (e.pointerId !== pid) return;
    pid = null; knob.style.transform = ''; Input.joy.x = 0; Input.joy.y = 0; Input.joy.active = false;
  };
  pad.addEventListener('pointerup', end);
  pad.addEventListener('pointercancel', end);
  document.querySelectorAll('[data-btn]').forEach(b => {
    const n = b.dataset.btn;
    b.addEventListener('pointerdown', e => { e.preventDefault(); b.setPointerCapture(e.pointerId); Input.down(n); b.classList.add('on'); Audio_.unlock(); });
    const off = () => { Input.up(n); b.classList.remove('on'); };
    b.addEventListener('pointerup', off);
    b.addEventListener('pointercancel', off);
  });
}

// ---------- 소리 (간단한 합성음) ----------
const Audio_ = {
  ac: null, muted: false, master: null,
  unlock() {
    if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return; }
    try {
      this.ac = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ac.createGain(); this.master.gain.value = 0.35; this.master.connect(this.ac.destination);
    } catch (e) { this.ac = null; }
  },
  tone(f, d = 0.1, type = 'sine', v = 0.3, slide = 0, delay = 0) {
    if (!this.ac || this.muted) return;
    const t = this.ac.currentTime + delay;
    const o = this.ac.createOscillator(), g = this.ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + d + 0.02);
  },
  noise(d = 0.2, v = 0.2, hp = 800) {
    if (!this.ac || this.muted) return;
    const t = this.ac.currentTime;
    const len = Math.floor(this.ac.sampleRate * d);
    const buf = this.ac.createBuffer(1, len, this.ac.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = this.ac.createBufferSource(); s.buffer = buf;
    const f = this.ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
    const g = this.ac.createGain(); g.gain.value = v;
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t);
  },
};
function sfx(n) {
  const A = Audio_;
  switch (n) {
    case 'blip': A.tone(660, 0.04, 'square', 0.05); break;
    case 'swing': A.noise(0.08, 0.12, 1800); break;
    case 'hit': A.tone(180, 0.12, 'square', 0.2, -90); A.noise(0.06, 0.15, 600); break;
    case 'hurt': A.tone(260, 0.2, 'sawtooth', 0.2, -150); break;
    case 'pick': A.tone(880, 0.08, 'triangle', 0.2); A.tone(1320, 0.1, 'triangle', 0.15, 0, 0.07); break;
    case 'rune': A.tone(520, 0.25, 'sine', 0.2, 400); break;
    case 'ice': A.tone(1400, 0.2, 'triangle', 0.15, -600); A.noise(0.1, 0.08, 3000); break;
    case 'boom': A.noise(0.5, 0.45, 80); A.tone(90, 0.4, 'sine', 0.4, -50); break;
    case 'freeze': A.tone(300, 0.4, 'sine', 0.2, -200); A.tone(900, 0.3, 'triangle', 0.08); break;
    case 'magnet': A.tone(220, 0.3, 'sawtooth', 0.06, 60); break;
    case 'break': A.noise(0.25, 0.3, 400); A.tone(140, 0.2, 'square', 0.15, -80); break;
    case 'beat': A.tone(70, 0.14, 'sine', 0.45, -20); break;
    case 'beat2': A.tone(95, 0.1, 'sine', 0.3, -20); break;
    case 'open': A.tone(392, 0.15, 'triangle', 0.2); A.tone(523, 0.15, 'triangle', 0.2, 0, 0.12); A.tone(659, 0.25, 'triangle', 0.2, 0, 0.24); break;
    case 'chime': [523, 659, 784, 1046].forEach((f, i) => A.tone(f, 0.5, 'sine', 0.15, 0, i * 0.12)); break;
    case 'rumble': A.noise(1.4, 0.4, 40); A.tone(45, 1.2, 'sine', 0.4, -10); break;
    case 'cook': [440, 554, 659].forEach((f, i) => A.tone(f, 0.18, 'triangle', 0.15, 0, i * 0.09)); break;
    case 'step': A.noise(0.03, 0.03, 2000); break;
    case 'glide': A.noise(0.4, 0.06, 2500); break;
    case 'chain': A.tone(1200, 0.4, 'triangle', 0.2, -900); A.noise(0.2, 0.15, 2500); break;
    case 'deny': A.tone(200, 0.12, 'square', 0.1); A.tone(150, 0.15, 'square', 0.1, 0, 0.1); break;
  }
}

// ---------- 파티클 ----------
const Parts = [];
function burst(x, y, n, c, sp = 3, life = 0.6, size = 3, g = 0) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = Math.random() * sp;
    Parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, max: life, c, size: size * (0.5 + Math.random() * 0.8), g });
  }
}
function updateParts(dt) {
  for (let i = Parts.length - 1; i >= 0; i--) {
    const p = Parts[i];
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; p.life -= dt;
    if (p.life <= 0) Parts.splice(i, 1);
  }
}
function drawParts() {
  for (const p of Parts) {
    ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
    ctx.fillStyle = p.c;
    ctx.fillRect(p.x * TS - p.size / 2, p.y * TS - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

// ---------- 그리기 도우미 ----------
function circle(x, y, r, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
function ellipse(x, y, rx, ry, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); }
function shadow(x, y, r) { ellipse(x, y, r, r * 0.4, 'rgba(20,20,40,0.22)'); }
function rrect(x, y, w, h, r, c) {
  ctx.fillStyle = c; ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); ctx.fill();
}
// 사람 모양: 그림자, 몸, 머리, 방향
function drawPerson(px, py, o) {
  const t = G.t;
  const bob = o.moving ? Math.sin(t * 14) * 1.5 : Math.sin(t * 2) * 0.6;
  const s = o.scale || 1;
  shadow(px, py + 9 * s, 8 * s);
  ctx.save();
  ctx.translate(px, py + bob);
  ctx.scale(s, s);
  if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
  // 망토
  ctx.fillStyle = o.cloak || '#3b6ea8';
  ctx.beginPath(); ctx.moveTo(-8, 8); ctx.lineTo(8, 8); ctx.lineTo(6, -4); ctx.lineTo(-6, -4); ctx.closePath(); ctx.fill();
  // 몸
  rrect(-6, -6, 12, 12, 4, o.body || '#e8e0cf');
  // 머리
  circle(0, -11, 7, o.skin || '#f3d3b5');
  // 머리카락
  ctx.fillStyle = o.hair || '#4a3324';
  ctx.beginPath(); ctx.arc(0, -12, 7.3, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
  if (o.hat) { ctx.fillStyle = o.hat; ctx.fillRect(-8, -19, 16, 3); ctx.fillRect(-5, -24, 10, 6); }
  // 눈 (방향)
  const fx = o.fx || 0, fy = o.fy || 1;
  if (fy > -0.5) {
    ctx.fillStyle = '#2a2230';
    ctx.fillRect(-3 + fx * 2.5 - 1, -11 + fy, 2, 2);
    ctx.fillRect(3 + fx * 2.5 - 1, -11 + fy, 2, 2);
  }
  if (o.scarf) { ctx.fillStyle = o.scarf; ctx.fillRect(-6, -6, 12, 3); }
  if (o.mask) { circle(0, -11, 7.2, o.mask); ctx.fillStyle = '#333'; ctx.fillRect(-4, -12, 3, 2); ctx.fillRect(1, -12, 3, 2); if (o.crack) { ctx.strokeStyle = '#7ef'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-2, -18); ctx.lineTo(1, -12); ctx.lineTo(-1, -6); ctx.stroke(); } }
  ctx.restore();
  ctx.globalAlpha = 1;
}
