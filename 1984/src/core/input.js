// Keyboard, mouse and pointer lock.
export class Input {
  constructor(el) {
    this.el = el;
    this.keys = new Set();
    this.pressed = new Set();
    this.mx = 0; this.my = 0;
    this.mouseDown = false;
    this.locked = false;
    this.enabled = true;
    this.sensitivity = 1;
    this.axis = { x: 0, z: 0 };   // analogue walking from the touch stick
    this.drag = false;             // look by dragging when pointer lock is refused
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    addEventListener('mousemove', (e) => {
      if (this.locked || (this.drag && this.mouseDown)) { this.mx += e.movementX; this.my += e.movementY; }
    });
    el.addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.mouseDown = true; this.pressed.add('Mouse0'); }
    });
    addEventListener('mouseup', (e) => { if (e.button === 0) this.mouseDown = false; });
    document.addEventListener('pointerlockerror', () => { this.drag = true; });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === el;
      if (this.onLockChange) this.onLockChange(this.locked);
    });
  }

  lock() {
    if (document.pointerLockElement !== this.el && this.el.requestPointerLock) {
      // sandboxed frames may refuse pointer lock: fall back to drag-to-look
      const refuse = () => { this.drag = true; };
      try { const p = this.el.requestPointerLock(); if (p && p.catch) p.catch(refuse); } catch (e) { refuse(); }
    }
  }

  unlock() { if (document.pointerLockElement) document.exitPointerLock(); }

  down(code) { return this.enabled && this.keys.has(code); }

  hit(code) { return this.pressed.has(code); }

  consumeMouse() {
    const r = [this.mx * this.sensitivity, this.my * this.sensitivity];
    this.mx = 0; this.my = 0;
    return r;
  }

  endFrame() { this.pressed.clear(); }
}
