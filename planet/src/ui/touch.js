// Touch controls for phones and tablets: a floating joystick on the left half
// moves (push to the rim to run), dragging anywhere on the right half looks
// around, and a thumb cluster carries the actions. Build-mode buttons appear
// only while building. Everything feeds the same Input the keyboard does.
import { BUILDINGS } from '../sim/data.js';
import { setTouchHints } from './hint.js';

export function isTouchDevice() {
  try { return matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints > 0 && 'ontouchstart' in window); } catch (e) { return false; }
}

const SVG = {
  act: '<svg viewBox="0 0 24 24"><path d="M5 19 14 10M13 5l6 6-3 3-6-6z"/></svg>',
  jump: '<svg viewBox="0 0 24 24"><path d="M12 19V6M6 11l6-6 6 6"/></svg>',
  use: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/><path d="M12 9v6M9 12h6"/></svg>',
};

export class TouchControls {
  constructor(game) {
    this.game = game;
    const I = game.input;
    I.touch = true;
    setTouchHints(true);
    document.documentElement.classList.add('touch');
    const el = document.createElement('div');
    el.id = 'touch';
    el.hidden = true;
    el.innerHTML = `
      <div class="zone move" data-z="move"><div class="stick"><i></i></div></div>
      <div class="zone look" data-z="look"></div>
      <div class="cluster">
        <button class="tb big act" data-hold="btn0" aria-label="채집·설치">${SVG.act}<span>채집</span></button>
        <button class="tb jump" data-hold="Space" aria-label="점프·제트팩">${SVG.jump}<span>점프</span></button>
        <button class="tb use" data-tap="KeyE" aria-label="상호작용">${SVG.use}<span>사용</span></button>
      </div>
      <div class="bar top">
        <button class="tc" data-tap="KeyB">건설</button>
        <button class="tc" data-tap="Tab">가방</button>
        <button class="tc" data-tap="KeyJ">연구</button>
        <button class="tc" data-tap="KeyM">지도</button>
        <button class="tc more" data-more="1">더보기</button>
        <button class="tc" data-menu="1" aria-label="메뉴">☰</button>
      </div>
      <div class="bar drawer" hidden>
        <button class="tc" data-tap="KeyV">시점</button>
        <button class="tc" data-tap="KeyF">해체</button>
        <button class="tc" data-tap="KeyG">지형 도구</button>
        <button class="tc" data-tap="KeyN">로버</button>
        <button class="tc" data-tap="KeyL">조명</button>
        <button class="tc" data-tap="F1">조작법</button>
      </div>
      <div class="bar buildbar" hidden>
        <button class="tc m-place" data-tap="KeyR">90° 회전</button>
        <button class="tc m-place" data-wheel="-1">↺ 15°</button>
        <button class="tc m-place" data-wheel="1">↻ 15°</button>
        <button class="tc m-found" data-tap="KeyT">높이 +</button>
        <button class="tc m-found" data-tap="KeyY">높이 −</button>
        <button class="tc m-road" data-tapbtn="2">연결 끊기</button>
        <button class="tc m-terrain" data-hold="btn2">깎기</button>
        <button class="tc m-terrain" data-hold="flatten">평탄화</button>
        <button class="tc m-terrain" data-wheel="-1">붓 크게</button>
        <button class="tc m-terrain" data-wheel="1">붓 작게</button>
        <button class="tc cancel" data-tap="Escape">취소</button>
      </div>`;
    document.getElementById('ui').appendChild(el);
    this.el = el;
    this.stick = el.querySelector('.stick');
    this.knob = this.stick.querySelector('i');
    this.drawer = el.querySelector('.drawer');
    this.buildbar = el.querySelector('.buildbar');
    this.actLabel = el.querySelector('.act span');
    this.jumpLabel = el.querySelector('.jump span');
    this.useLabel = el.querySelector('.use span');
    this.moveId = null; this.lookId = null;
    this.stickC = { x: 0, y: 0 };
    this.lastLook = { x: 0, y: 0 };

    const R = 56;
    const setMove = (vx, vy) => {
      const m = Math.hypot(vx, vy);
      // analog for walking (direction and speed follow the thumb smoothly);
      // the keys still drive the rover and anything else that reads them
      I.axis.x = vx; I.axis.y = -vy; I.axis.on = m > 0.05;
      I.hold('KeyW', vy < -0.32); I.hold('KeyS', vy > 0.32);
      I.hold('KeyA', vx < -0.32); I.hold('KeyD', vx > 0.32);
      I.hold('ShiftLeft', m > 0.94);
      this.knob.style.transform = `translate(${vx * R}px, ${vy * R}px)`;
    };
    const zMove = el.querySelector('[data-z=move]'), zLook = el.querySelector('[data-z=look]');
    zMove.addEventListener('pointerdown', (e) => {
      if (this.moveId !== null) return;
      this.moveId = e.pointerId; try { zMove.setPointerCapture(e.pointerId); } catch (err) { /* capture is optional */ }
      this.stickC = { x: e.clientX, y: e.clientY };
      this.stick.style.left = e.clientX + 'px'; this.stick.style.top = e.clientY + 'px';
      this.stick.classList.add('on');
      e.preventDefault();
    });
    zMove.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.moveId) return;
      let vx = (e.clientX - this.stickC.x) / R, vy = (e.clientY - this.stickC.y) / R;
      const m = Math.hypot(vx, vy);
      if (m > 1) { vx /= m; vy /= m; }
      setMove(vx, vy);
    });
    const endMove = (e) => {
      if (e.pointerId !== this.moveId) return;
      this.moveId = null; setMove(0, 0); this.stick.classList.remove('on');
    };
    zMove.addEventListener('pointerup', endMove); zMove.addEventListener('pointercancel', endMove);

    zLook.addEventListener('pointerdown', (e) => {
      if (this.lookId !== null) return;
      this.lookId = e.pointerId; try { zLook.setPointerCapture(e.pointerId); } catch (err) { /* capture is optional */ }
      this.lastLook = { x: e.clientX, y: e.clientY };
      e.preventDefault();
    });
    zLook.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.lookId) return;
      const k = 2.1 * (window.devicePixelRatio > 2 ? 0.85 : 1);
      I.look((e.clientX - this.lastLook.x) * k, (e.clientY - this.lastLook.y) * k);
      this.lastLook = { x: e.clientX, y: e.clientY };
    });
    const endLook = (e) => { if (e.pointerId === this.lookId) this.lookId = null; };
    zLook.addEventListener('pointerup', endLook); zLook.addEventListener('pointercancel', endLook);

    // buttons: hold-buttons stay down while pressed, tap-buttons fire once
    for (const b of el.querySelectorAll('[data-hold]')) {
      const code = b.dataset.hold;
      const on = (v) => {
        // the act button accelerates while driving (W), flatten = Shift + primary
        if (code === 'btn0' && game.driving && game.driving()) { I.hold('KeyW', v); I.holdBtn(0, false); }
        else if (code === 'btn0') I.holdBtn(0, v);
        else if (code === 'btn2') I.holdBtn(2, v);
        else if (code === 'flatten') { I.hold('ShiftLeft', v); I.holdBtn(0, v); }
        else I.hold(code, v);
        b.classList.toggle('down', v);
      };
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (err) { /* optional */ } on(true); });
      b.addEventListener('pointerup', () => on(false));
      b.addEventListener('pointercancel', () => on(false));
    }
    for (const b of el.querySelectorAll('[data-tap]')) b.addEventListener('pointerdown', (e) => { e.preventDefault(); I.tap(b.dataset.tap); });
    for (const b of el.querySelectorAll('[data-wheel]')) b.addEventListener('pointerdown', (e) => { e.preventDefault(); I.wheelTap(+b.dataset.wheel); });
    for (const b of el.querySelectorAll('[data-tapbtn]')) b.addEventListener('pointerdown', (e) => { e.preventDefault(); I.tapBtn(+b.dataset.tapbtn); });
    el.querySelector('[data-more]').addEventListener('pointerdown', (e) => { e.preventDefault(); this.drawer.hidden = !this.drawer.hidden; });
    el.querySelector('[data-menu]').addEventListener('pointerdown', (e) => { e.preventDefault(); game.ui.open('pause'); });
    // hotbar slots become buttons
    document.getElementById('hotbar').addEventListener('pointerdown', (e) => {
      const s = e.target.closest('.slot'); if (!s) return;
      e.preventDefault(); I.tap('Digit' + (+s.dataset.i + 1));
    });
    // keep the page from scrolling or zooming under the thumbs
    for (const t of ['touchstart', 'touchmove']) el.addEventListener(t, (e) => { if (e.target.closest('#touch')) e.preventDefault(); }, { passive: false });
  }

  // per frame: show the controls in play, swap labels with the mode
  update() {
    const g = this.game;
    const show = g.started && !g.ui.panel;
    if (this.el.hidden === show) this.el.hidden = !show;
    if (!show) return;
    const mode = g.build.mode;
    const building = mode === 'place' || mode === 'road' || mode === 'terrain' || mode === 'dismantle';
    this.buildbar.hidden = !building;
    if (building && this._mode !== mode + (g.build.type || '')) {
      this._mode = mode + (g.build.type || '');
      const found = mode === 'place' && BUILDINGS[g.build.type] && BUILDINGS[g.build.type].foundation;
      for (const b of this.buildbar.children) {
        const c = b.classList;
        b.hidden = c.contains('m-place') ? mode !== 'place' : c.contains('m-found') ? !found : c.contains('m-road') ? mode !== 'road' : c.contains('m-terrain') ? mode !== 'terrain' : false;
      }
    }
    const driving = g.driving && g.driving();
    const label = mode === 'place' || mode === 'road' ? '설치' : mode === 'dismantle' ? '해체' : mode === 'terrain' ? '돋우기' : driving ? '가속' : '채집';
    const jl = driving ? '브레이크' : '점프', ul = driving ? '하차' : '사용';
    if (this.jumpLabel.textContent !== jl) this.jumpLabel.textContent = jl;
    if (this.useLabel.textContent !== ul) this.useLabel.textContent = ul;
    if (this.actLabel.textContent !== label) this.actLabel.textContent = label;
  }
}
