// 입력 통합: 키보드·마우스(포인터 잠금)·터치(가상 스틱·시점 드래그)·게임패드를 하나의 의도(intent)로 모읍니다.
// 게임 코드는 input.move / input.look / input.pressed('jump') 같은 값만 읽습니다.

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  Space: 'jump', ShiftLeft: 'sprint', ShiftRight: 'sprint', KeyE: 'interact', KeyF: 'skimmer', KeyQ: 'listen',
  Digit1: 'tone1', Digit2: 'tone2', Digit3: 'tone3', Digit4: 'tone4', Digit5: 'tone5',
  KeyM: 'map', KeyJ: 'quests', KeyI: 'journal', Tab: 'map', Escape: 'pause', KeyP: 'pause', KeyC: 'camera', KeyV: 'view', KeyH: 'hud', Backquote: 'dev', KeyT: 'moa',
  Enter: 'confirm',
};

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.down = new Set(); // 이번 프레임에 눌린 동작
    this.held = new Set();
    this.up = new Set();
    this.move = { x: 0, y: 0 }; // 오른쪽 +x, 앞 +y
    this.look = { x: 0, y: 0 }; // 이번 프레임 시점 이동량(라디안 비례)
    this.wheel = 0;
    this.lookActive = 0; // 최근 시점 조작 이후 경과(초)
    this.touchMove = { x: 0, y: 0, active: false };
    this.virtual = new Set(); // 터치 버튼으로 누르고 있는 동작
    this.sensitivity = 1;
    this.invertY = false;
    this.locked = false;
    this.enabled = true;
    this.lastDevice = 'keyboard';
    this._bind();
  }

  _bind() {
    addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      const a = KEYMAP[e.code];
      if (a) {
        if (!this.held.has(a)) this.down.add(a);
        this.held.add(a);
        if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      }
      this.keys.add(e.code);
      this.lastDevice = 'keyboard';
    });
    addEventListener('keyup', (e) => {
      const a = KEYMAP[e.code];
      if (a) { this.held.delete(a); this.up.add(a); }
      this.keys.delete(e.code);
    });
    addEventListener('blur', () => { this.held.clear(); this.keys.clear(); });

    const c = this.canvas;
    c.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      if (e.button === 0 && this.wantLock && !this.locked && !this.lockFailed) {
        try {
          const r = c.requestPointerLock?.();
          if (r && r.catch) r.catch(() => { this.lockFailed = true; });
        } catch { this.lockFailed = true; }
      }
      if (e.button === 0) { this.down.add('click'); if (!this.locked) this._drag = true; }
      if (e.button === 2) { this._drag = true; }
      this.lastDevice = 'keyboard';
    });
    addEventListener('mouseup', () => { this._drag = false; });
    document.addEventListener('pointerlockerror', () => { this.lockFailed = true; });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('mousemove', (e) => {
      if (this.locked || this._drag) {
        this.look.x += e.movementX * 0.0022 * this.sensitivity;
        this.look.y += e.movementY * 0.0022 * this.sensitivity * (this.invertY ? -1 : 1);
        this.lookActive = 0;
      }
    });
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === c; });
    c.addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); }, { passive: true });

    // 터치: 왼쪽 절반 = 이동 스틱, 오른쪽 = 시점
    this.touches = new Map();
    c.addEventListener('touchstart', (e) => this._touch(e, 'start'), { passive: false });
    c.addEventListener('touchmove', (e) => this._touch(e, 'move'), { passive: false });
    c.addEventListener('touchend', (e) => this._touch(e, 'end'), { passive: false });
    c.addEventListener('touchcancel', (e) => this._touch(e, 'end'), { passive: false });
  }

  _touch(e, kind) {
    e.preventDefault();
    this.lastDevice = 'touch';
    if (!this.enabled) return;
    for (const t of e.changedTouches) {
      if (kind === 'start') {
        const isStick = t.clientX < innerWidth * 0.42 && !this.touchMove.active;
        this.touches.set(t.identifier, { kind: isStick ? 'stick' : 'look', x0: t.clientX, y0: t.clientY, x: t.clientX, y: t.clientY, t0: performance.now() });
        if (isStick) { this.touchMove.active = true; this.touchMove.x = 0; this.touchMove.y = 0; this.onStick?.(t.clientX, t.clientY, 0, 0, true); }
      } else if (kind === 'move') {
        const s = this.touches.get(t.identifier);
        if (!s) continue;
        if (s.kind === 'stick') {
          const R = 56;
          let dx = (t.clientX - s.x0) / R, dy = (t.clientY - s.y0) / R;
          const l = Math.hypot(dx, dy);
          if (l > 1) {
            // 손가락이 멀리 가면 스틱 중심이 따라온다
            s.x0 += (dx / l) * (l - 1) * R; s.y0 += (dy / l) * (l - 1) * R;
            dx /= l; dy /= l;
          }
          this.touchMove.x = dx; this.touchMove.y = -dy;
          this.onStick?.(s.x0, s.y0, dx, dy, true);
        } else {
          this.look.x += (t.clientX - s.x) * 0.0052 * this.sensitivity;
          this.look.y += (t.clientY - s.y) * 0.0042 * this.sensitivity * (this.invertY ? -1 : 1);
          this.lookActive = 0;
        }
        s.x = t.clientX; s.y = t.clientY;
      } else {
        const s = this.touches.get(t.identifier);
        if (!s) continue;
        if (s.kind === 'stick') { this.touchMove.active = false; this.touchMove.x = 0; this.touchMove.y = 0; this.onStick?.(0, 0, 0, 0, false); }
        else if (performance.now() - s.t0 < 220 && Math.hypot(s.x - s.x0, s.y - s.y0) < 12) this.down.add('tap');
        this.touches.delete(t.identifier);
      }
    }
  }

  /** 터치 버튼 등에서 동작을 누르고 떼기 */
  press(a) { if (!this.virtual.has(a)) this.down.add(a); this.virtual.add(a); }
  release(a) { this.virtual.delete(a); this.up.add(a); }
  tap(a) { this.down.add(a); }

  pressed(a) { return this.enabled && this.down.has(a); }
  isHeld(a) { return this.enabled && (this.held.has(a) || this.virtual.has(a) || this._padHeld?.has(a)); }

  /** 프레임 시작에 호출: 이동 벡터 계산, 게임패드 읽기 */
  poll(dt) {
    this.lookActive += dt;
    let x = 0, y = 0;
    if (this.held.has('left')) x -= 1;
    if (this.held.has('right')) x += 1;
    if (this.held.has('up')) y += 1;
    if (this.held.has('down')) y -= 1;
    if (this.touchMove.active) { x = this.touchMove.x; y = this.touchMove.y; }
    this._pollPad(dt);
    if (this._pad) { if (Math.hypot(this._pad.x, this._pad.y) > 0.15) { x = this._pad.x; y = this._pad.y; } }
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    this.move.x = this.enabled ? x : 0;
    this.move.y = this.enabled ? y : 0;
  }

  _pollPad(dt) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = pads && [...pads].find((p) => p && p.connected);
    if (!gp) { this._pad = null; return; }
    const dz = (v) => (Math.abs(v) < 0.15 ? 0 : v);
    this._pad = { x: dz(gp.axes[0]), y: -dz(gp.axes[1]) };
    const rx = dz(gp.axes[2] || 0), ry = dz(gp.axes[3] || 0);
    if (rx || ry) { this.look.x += rx * dt * 2.6 * this.sensitivity; this.look.y += ry * dt * 2.0 * this.sensitivity; this.lookActive = 0; }
    const map = { 0: 'jump', 2: 'interact', 1: 'skimmer', 5: 'sprint', 4: 'listen', 9: 'pause', 8: 'map', 11: 'view', 12: 'tone1', 15: 'tone2', 13: 'tone3', 14: 'tone4', 3: 'tone5' };
    const held = new Set();
    for (const [i, a] of Object.entries(map)) if (gp.buttons[i]?.pressed) held.add(a);
    const prev = this._padHeld || new Set();
    for (const a of held) if (!prev.has(a)) this.down.add(a);
    for (const a of prev) if (!held.has(a)) this.up.add(a);
    this._padHeld = held;
    if (held.size || this._pad.x || this._pad.y) this.lastDevice = 'pad';
  }

  /** 프레임 끝에 호출 */
  endFrame() {
    this.down.clear();
    this.up.clear();
    this.look.x = 0; this.look.y = 0;
    this.wheel = 0;
  }
}
