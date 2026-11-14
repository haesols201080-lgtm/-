// Keyboard / mouse / pointer-lock input with per-frame edge detection.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.released = new Set();
    this.mouse = { dx: 0, dy: 0, wheel: 0, buttons: 0, pressed: 0, released: 0 };
    this.axis = { x: 0, y: 0, on: false };   // analog stick (touch): x right, y forward, length 0..1
    this.locked = false;
    this.uiOpen = false;
    this.touch = false;            // touch controls drive input (no pointer lock)
    this._tapKeys = [];            // keys pressed by a tap, released after one frame
    this._tapBtns = 0;
    this.sensitivity = 0.0022;
    this.invertY = false;
    this.listeners = [];
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'F1'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
      for (const l of this.listeners) l(e);
    });
    window.addEventListener('keyup', (e) => { this.keys.delete(e.code); this.released.add(e.code); });
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse.buttons = 0; });
    canvas.addEventListener('mousedown', (e) => {
      if (!this.locked && !this.uiOpen && !this.cursorMode) { this.lock(); return; }
      this.mouse.buttons |= 1 << e.button;
      this.mouse.pressed |= 1 << e.button;
    });
    window.addEventListener('mouseup', (e) => {
      this.mouse.buttons &= ~(1 << e.button);
      this.mouse.released |= 1 << e.button;
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.locked && !this.cursorMode) return;
      if (this.cursorMode && !(this.mouse.buttons & 4)) return;
      this.mouse.dx += e.movementX || 0;
      this.mouse.dy += e.movementY || 0;
    });
    window.addEventListener('wheel', (e) => { if (this.locked || this.cursorMode) this.mouse.wheel += Math.sign(e.deltaY); }, { passive: true });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked) this.mouse.buttons = 0;
      this.onLockChange && this.onLockChange(this.locked);
    });
    document.addEventListener('pointerlockerror', () => { this.cursorMode = true; this.onLockChange && this.onLockChange(false); });
  }

  lock() {
    if (this.uiOpen || this.touch) return;
    try {
      const p = this.canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => { this.cursorMode = true; });
    } catch (e) { this.cursorMode = true; }
  }

  unlock() { if (document.pointerLockElement) document.exitPointerLock(); }

  down(code) { return this.keys.has(code); }
  hit(code) { return this.pressed.has(code); }
  btn(b) { return (this.mouse.buttons & (1 << b)) !== 0; }
  click(b) { return (this.mouse.pressed & (1 << b)) !== 0; }
  get active() { return (this.locked || this.cursorMode || this.touch) && !this.uiOpen; }

  // ---- synthetic input used by the touch controls
  tap(code) {
    this.pressed.add(code); this.keys.add(code); this._tapKeys.push(code);
    const ev = { code, key: code, target: null, preventDefault() {} };
    for (const l of this.listeners) l(ev);
  }
  hold(code, on) {
    if (on) { if (!this.keys.has(code)) this.pressed.add(code); this.keys.add(code); }
    else if (this.keys.has(code)) { this.keys.delete(code); this.released.add(code); }
  }
  holdBtn(b, on) {
    if (on) { this.mouse.buttons |= 1 << b; this.mouse.pressed |= 1 << b; }
    else { this.mouse.buttons &= ~(1 << b); this.mouse.released |= 1 << b; }
  }
  tapBtn(b) { this.holdBtn(b, true); this._tapBtns |= 1 << b; }
  look(dx, dy) { this.mouse.dx += dx; this.mouse.dy += dy; }
  wheelTap(v) { this.mouse.wheel += v; }

  onKey(fn) { this.listeners.push(fn); }

  endFrame() {
    for (const c of this._tapKeys) { this.keys.delete(c); this.released.add(c); }
    this._tapKeys.length = 0;
    if (this._tapBtns) { this.mouse.buttons &= ~this._tapBtns; this._tapBtns = 0; }
    this.pressed.clear();
    this.released.clear();
    this.mouse.dx = 0; this.mouse.dy = 0; this.mouse.wheel = 0;
    this.mouse.pressed = 0; this.mouse.released = 0;
  }
}
