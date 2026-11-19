// Unified input: keyboard + mouse (pointer lock), gamepad (with remappable buttons) and touch
// (virtual move stick on the left, camera drag on the right, action buttons).
import { isTouch } from './quality.js';

const DEFAULT_PAD = { jump: 0, crouch: 1, interact: 2, emote: 3, pause: 9, zoomIn: 5, zoomOut: 4 };

export class Input {
  constructor(dom) {
    this.dom = dom;
    this.keys = new Set();
    this.move = { x: 0, y: 0 };      // x right, y forward, magnitude 0..1
    this.look = { x: 0, y: 0 };      // accumulated camera delta (radians-ish) consumed per frame
    this.zoom = 0;
    this.btn = { jump: false, crouch: false, interact: false, emote: false, walk: false };
    this.pressed = new Set();        // edge-triggered this frame
    this.released = new Set();
    this.sens = 1; this.invertY = false;
    this.padMap = { ...DEFAULT_PAD };
    this.padPrev = {};
    this.usingPad = false; this.usingTouch = isTouch;
    this.enabled = true;
    this.listeners = [];
    this.capture = null; // callback when remapping a gamepad button
    this.bind();
  }

  on(name, fn) { this.listeners.push([name, fn]); }
  emit(name) { for (const [n, f] of this.listeners) if (n === name) f(); }

  press(name) { if (!this.btn[name]) this.pressed.add(name); this.btn[name] = true; }
  release(name) { if (this.btn[name]) this.released.add(name); this.btn[name] = false; }

  bind() {
    const keymap = { Space: 'jump', KeyC: 'crouch', ControlLeft: 'crouch', KeyE: 'interact', KeyF: 'interact', KeyQ: 'emote', ShiftLeft: 'walk', ShiftRight: 'walk' };
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (keymap[e.code]) { this.press(keymap[e.code]); if (e.code === 'Space') e.preventDefault(); }
      if (e.code === 'Escape' || e.code === 'KeyP' || e.code === 'Tab') { e.preventDefault(); this.emit('pause'); }
      if (e.code === 'KeyR') this.emit('respawn');
      this.usingPad = false;
    });
    addEventListener('keyup', (e) => { this.keys.delete(e.code); if (keymap[e.code]) this.release(keymap[e.code]); });
    addEventListener('blur', () => { this.keys.clear(); for (const k in this.btn) this.release(k); });
    this.dom.addEventListener('mousedown', (e) => {
      if (this.usingTouch) return;
      if (document.pointerLockElement !== this.dom && this.enabled) this.dom.requestPointerLock?.();
    });
    addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === this.dom) {
        this.look.x += e.movementX * 0.0024 * this.sens;
        this.look.y += e.movementY * 0.0024 * this.sens * (this.invertY ? -1 : 1);
      }
    });
    addEventListener('wheel', (e) => { this.zoom += Math.sign(e.deltaY) * 0.12; }, { passive: true });
    if (isTouch) this.buildTouch();
  }

  buildTouch() {
    const root = document.getElementById('touch');
    root.classList.add('on');
    const stick = root.querySelector('.stick'), knob = root.querySelector('.knob');
    let moveId = null, lookId = null, ox = 0, oy = 0, lx = 0, ly = 0;
    const R = 56;
    const setStick = (dx, dy) => {
      const d = Math.hypot(dx, dy), k = d > R ? R / d : 1;
      knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
      const m = Math.min(1, d / R);
      const a = Math.atan2(dy, dx);
      this.move.x = Math.cos(a) * m; this.move.y = -Math.sin(a) * m;
    };
    root.addEventListener('touchstart', (e) => {
      for (const t of e.changedTouches) {
        const el = t.target.closest('[data-btn]');
        if (el) { this.press(el.dataset.btn); el.classList.add('down'); continue; }
        if (t.clientX < innerWidth * 0.45 && moveId === null) {
          moveId = t.identifier; ox = t.clientX; oy = t.clientY;
          stick.style.left = ox + 'px'; stick.style.top = oy + 'px'; stick.classList.add('active'); setStick(0, 0);
        } else if (lookId === null) { lookId = t.identifier; lx = t.clientX; ly = t.clientY; }
      }
      e.preventDefault();
    }, { passive: false });
    root.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === moveId) setStick(t.clientX - ox, t.clientY - oy);
        if (t.identifier === lookId) {
          this.look.x += (t.clientX - lx) * 0.006 * this.sens; this.look.y += (t.clientY - ly) * 0.005 * this.sens * (this.invertY ? -1 : 1);
          lx = t.clientX; ly = t.clientY;
        }
      }
      e.preventDefault();
    }, { passive: false });
    const end = (e) => {
      for (const t of e.changedTouches) {
        const el = t.target.closest('[data-btn]');
        if (el) { this.release(el.dataset.btn); el.classList.remove('down'); }
        if (t.identifier === moveId) { moveId = null; this.move.x = this.move.y = 0; stick.classList.remove('active'); knob.style.transform = ''; }
        if (t.identifier === lookId) lookId = null;
      }
    };
    root.addEventListener('touchend', end); root.addEventListener('touchcancel', end);
    root.querySelector('[data-act=pause]').addEventListener('touchstart', (e) => { e.stopPropagation(); this.emit('pause'); });
  }

  pollGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = [...pads].find((p) => p && p.connected);
    if (!gp) return null;
    const dz = (v) => (Math.abs(v) < 0.15 ? 0 : (v - Math.sign(v) * 0.15) / 0.85);
    const lx = dz(gp.axes[0] || 0), ly = dz(gp.axes[1] || 0), rx = dz(gp.axes[2] || 0), ry = dz(gp.axes[3] || 0);
    if (Math.abs(lx) + Math.abs(ly) + Math.abs(rx) + Math.abs(ry) > 0.05) this.usingPad = true;
    // remap capture
    if (this.capture) {
      gp.buttons.forEach((b, i) => { if (b.pressed && !this.padPrev[i]) { const c = this.capture; this.capture = null; c(i); } });
      this.padPrev = Object.fromEntries(gp.buttons.map((b, i) => [i, b.pressed]));
      return gp;
    }
    for (const [name, idx] of Object.entries(this.padMap)) {
      const b = gp.buttons[idx]; if (!b) continue;
      const was = this.padPrev[idx];
      if (b.pressed && !was) {
        this.usingPad = true;
        if (name === 'pause') this.emit('pause');
        else if (name === 'zoomIn') this.zoom -= 0.25;
        else if (name === 'zoomOut') this.zoom += 0.25;
        else this.press(name);
      }
      if (!b.pressed && was && this.btn[name] !== undefined) this.release(name);
    }
    this.padPrev = Object.fromEntries(gp.buttons.map((b, i) => [i, b.pressed]));
    this.padMove = { x: lx, y: -ly };
    this.padLook = { x: rx, y: ry };
    return gp;
  }

  update(dt) {
    this.pressed.clear(); this.released.clear();
    // keyboard move
    let kx = 0, ky = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) ky += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) ky -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) kx += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) kx -= 1;
    const gp = this.pollGamepad();
    this.kbMove = { x: kx, y: ky };
    if (gp && this.padLook) { this.look.x += this.padLook.x * 2.6 * dt * this.sens; this.look.y += this.padLook.y * 2.0 * dt * this.sens * (this.invertY ? -1 : 1); }
  }

  // called by game after update; pressed set persists for this frame
  getMove() {
    if (this.kbMove && (this.kbMove.x || this.kbMove.y)) {
      const l = Math.hypot(this.kbMove.x, this.kbMove.y);
      const s = this.btn.walk ? 0.45 : 1;
      return { x: this.kbMove.x / l * s, y: this.kbMove.y / l * s };
    }
    if (this.padMove && (this.padMove.x || this.padMove.y)) return this.padMove;
    return this.move;
  }
  consumeLook() { const l = { ...this.look }; this.look.x = 0; this.look.y = 0; return l; }
  consumeZoom() { const z = this.zoom; this.zoom = 0; return z; }
  wasPressed(n) { return this.pressed.has(n); }
}
