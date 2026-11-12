// Unified input: keyboard + mouse (pointer lock) on desktop, dual-zone touch (stick + look drag + buttons) on mobile.
export class Input {
  constructor(canvas, ui) {
    this.canvas = canvas; this.ui = ui; this.keys = new Set(); this.pressed = new Set();
    this.move = { x: 0, y: 0 }; this.lookX = 0; this.lookY = 0; this.wheel = 0;
    this.touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0; this.locked = false; this.enabled = true;
    this.stick = { id: -1, x0: 0, y0: 0, x: 0, y: 0 }; this.lookT = { id: -1, x: 0, y: 0 }; this.btn = {};
    const kd = (e) => { if (e.repeat) return; this.keys.add(e.code); this.pressed.add(e.code); if (['Space', 'Tab', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault(); };
    const ku = (e) => this.keys.delete(e.code);
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku); window.addEventListener('blur', () => this.keys.clear());
    canvas.addEventListener('click', () => { if (!this.touch && this.enabled && !this.locked) canvas.requestPointerLock?.(); });
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === canvas; });
    window.addEventListener('mousemove', (e) => { if (this.locked) { this.lookX += e.movementX; this.lookY += e.movementY; } });
    window.addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); }, { passive: true });
    window.addEventListener('mousedown', (e) => { if (this.locked) this.pressed.add('Mouse' + e.button); });
    // touch zones
    const ts = (e) => {
      if (!this.enabled) return;
      for (const t of e.changedTouches) {
        if (t.target.closest && t.target.closest('.tbtn,.panel,.hud-click')) continue;
        if (t.clientX < window.innerWidth * 0.42 && this.stick.id < 0) { this.stick.id = t.identifier; this.stick.x0 = this.stick.x = t.clientX; this.stick.y0 = this.stick.y = t.clientY; this.ui?.stick?.(true, t.clientX, t.clientY, 0, 0); }
        else if (this.lookT.id < 0) { this.lookT.id = t.identifier; this.lookT.x = t.clientX; this.lookT.y = t.clientY; }
      }
    };
    const tm = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.stick.id) { this.stick.x = t.clientX; this.stick.y = t.clientY; const dx = t.clientX - this.stick.x0, dy = t.clientY - this.stick.y0; const l = Math.hypot(dx, dy), m = 56; const k = l > m ? m / l : 1; this.ui?.stick?.(true, this.stick.x0, this.stick.y0, dx * k, dy * k); }
        else if (t.identifier === this.lookT.id) { this.lookX += (t.clientX - this.lookT.x) * 2.2; this.lookY += (t.clientY - this.lookT.y) * 2.2; this.lookT.x = t.clientX; this.lookT.y = t.clientY; }
      }
      if (this.stick.id >= 0 || this.lookT.id >= 0) e.preventDefault();
    };
    const te = (e) => { for (const t of e.changedTouches) { if (t.identifier === this.stick.id) { this.stick.id = -1; this.ui?.stick?.(false); } if (t.identifier === this.lookT.id) this.lookT.id = -1; } };
    canvas.addEventListener('touchstart', ts, { passive: true }); canvas.addEventListener('touchmove', tm, { passive: false }); canvas.addEventListener('touchend', te); canvas.addEventListener('touchcancel', te);
  }
  // virtual buttons (HUD calls these)
  setButton(name, down) { if (down && !this.btn[name]) this.pressed.add('Btn' + name); this.btn[name] = down; }
  hit(...codes) { for (const c of codes) if (this.pressed.has(c)) return true; return false; }
  down(...codes) { for (const c of codes) if (this.keys.has(c) || this.btn[c.replace('Btn', '')] && c.startsWith('Btn')) return true; return false; }
  frame() {
    let x = 0, y = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y += 1; if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1; if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.stick.id >= 0) { const dx = this.stick.x - this.stick.x0, dy = this.stick.y - this.stick.y0; const m = 56; x = Math.max(-1, Math.min(1, dx / m)); y = Math.max(-1, Math.min(1, -dy / m)); }
    const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
    this.move.x = x; this.move.y = y;
    return this;
  }
  endFrame() { this.pressed.clear(); this.lookX = 0; this.lookY = 0; this.wheel = 0; }
}
