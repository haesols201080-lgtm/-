// Phone and tablet controls: a floating stick on the left half of the screen
// walks, dragging on the right half looks, and buttons stand in for the keys.
// Buttons send the same keydown/keyup events as a keyboard, so every system
// that listens for keys (the UI, the hold-to-act meter) works unchanged.
export const isTouch = () => (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window;

const CSS = `
#touch{position:fixed;inset:0;z-index:5;pointer-events:none;touch-action:none;user-select:none;-webkit-user-select:none}
#touch .zone{position:absolute;top:0;bottom:0;pointer-events:auto;touch-action:none}
#touch .zl{left:0;width:45%}#touch .zr{right:0;width:55%}
#touch .stick{position:absolute;width:120px;height:120px;margin:-60px 0 0 -60px;border-radius:50%;border:1px solid rgba(220,214,200,.35);background:rgba(10,10,10,.18);display:none}
#touch .stick i{position:absolute;left:50%;top:50%;width:48px;height:48px;margin:-24px 0 0 -24px;border-radius:50%;background:rgba(220,214,200,.45)}
#touch .btns{position:absolute;right:max(14px,env(safe-area-inset-right,0px));bottom:max(18px,env(safe-area-inset-bottom,0px));display:grid;grid-template-columns:repeat(2,64px);gap:10px;pointer-events:auto}
#touch .top{position:absolute;right:max(14px,env(safe-area-inset-right,0px));top:max(14px,env(safe-area-inset-top,0px));display:flex;gap:8px;pointer-events:auto}
#touch button{width:64px;height:64px;border-radius:50%;border:1px solid rgba(220,214,200,.4);background:rgba(12,12,12,.42);color:#ddd6c8;font:600 13px/1.1 system-ui,sans-serif;letter-spacing:.02em;touch-action:none;padding:0}
#touch .top button{width:46px;height:46px;border-radius:8px;font-size:12px}
#touch button.on{background:rgba(150,30,22,.6);border-color:rgba(230,120,100,.6)}
#touch button.act{grid-column:1 / span 2;width:100%;border-radius:32px}
`;

export function setupTouch(G) {
  const input = G.input;
  input.touch = true;
  input.locked = true;           // looking needs no pointer lock on a touch screen
  input.lock = () => {};
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const root = document.createElement('div'); root.id = 'touch';
  root.innerHTML = `<div class="zone zl"></div><div class="zone zr"></div><div class="stick"><i></i></div>
    <div class="top"><button data-k="KeyM">지도</button><button data-k="Escape">II</button></div>
    <div class="btns"><button data-k="KeyC" data-toggle="1">숙이기</button><button data-k="ShiftLeft" data-toggle="1">뛰기</button><button class="act" data-k="KeyE">살피기</button></div>`;
  document.body.appendChild(root);
  const stick = root.querySelector('.stick'), knob = stick.querySelector('i');
  const key = (type, code) => dispatchEvent(new KeyboardEvent(type, { code, key: code, bubbles: true }));

  // walking stick
  let sId = null, sx = 0, sy = 0;
  const zl = root.querySelector('.zl');
  zl.addEventListener('pointerdown', (e) => {
    if (sId !== null) return;
    sId = e.pointerId; sx = e.clientX; sy = e.clientY;
    stick.style.left = sx + 'px'; stick.style.top = sy + 'px'; stick.style.display = 'block';
    zl.setPointerCapture(e.pointerId);
  });
  zl.addEventListener('pointermove', (e) => {
    if (e.pointerId !== sId) return;
    let dx = e.clientX - sx, dy = e.clientY - sy;
    const d = Math.hypot(dx, dy), R = 50;
    if (d > R) { dx *= R / d; dy *= R / d; }
    knob.style.transform = `translate(${dx}px,${dy}px)`;
    input.axis.x = dx / R; input.axis.z = -dy / R;
  });
  const endStick = (e) => {
    if (e.pointerId !== sId) return;
    sId = null; input.axis.x = 0; input.axis.z = 0;
    stick.style.display = 'none'; knob.style.transform = '';
  };
  zl.addEventListener('pointerup', endStick); zl.addEventListener('pointercancel', endStick);

  // looking
  let lId = null, lx = 0, ly = 0;
  const zr = root.querySelector('.zr');
  zr.addEventListener('pointerdown', (e) => {
    if (lId !== null) return;
    lId = e.pointerId; lx = e.clientX; ly = e.clientY; zr.setPointerCapture(e.pointerId);
  });
  zr.addEventListener('pointermove', (e) => {
    if (e.pointerId !== lId) return;
    input.mx += (e.clientX - lx) * 2.2; input.my += (e.clientY - ly) * 2.2;
    lx = e.clientX; ly = e.clientY;
  });
  const endLook = (e) => { if (e.pointerId === lId) lId = null; };
  zr.addEventListener('pointerup', endLook); zr.addEventListener('pointercancel', endLook);

  // buttons
  for (const b of root.querySelectorAll('button')) {
    const code = b.dataset.k;
    if (b.dataset.toggle) {
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        const on = !b.classList.contains('on');
        b.classList.toggle('on', on);
        key(on ? 'keydown' : 'keyup', code);
      });
    } else {
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); key('keydown', code); });
      const up = (e) => { e.preventDefault(); key('keyup', code); };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
    }
  }
  // hide the controls while a dialogue, choice or menu has the screen
  const tick = () => {
    const hide = G.modal || G.paused || G.cutscene > 0 || !G.started;
    root.style.display = hide ? 'none' : 'block';
    if (hide && sId !== null) { sId = null; input.axis.x = 0; input.axis.z = 0; stick.style.display = 'none'; }
    requestAnimationFrame(tick);
  };
  tick();
  return root;
}
