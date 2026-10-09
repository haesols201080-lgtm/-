// 옷의 자리마다 다른 조작 (v24 「범용 만능 UI 폐기」 · 8장 옷):
//  · 옷걸이: 실제 옷걸이 가로대에 꼬리표가 매달린다(3D 자리를 화면에 비춰 따라감) — 꼬리표 = 이름·빛깔·값·치수. ←→ 고르기 · E 들기
//  · 탈의 칸: 거울 보기 — 카메라가 내 앞으로 돌고, 칸 벽의 고리에 든 옷이 걸린다. ←→ 고르기 · E 입기/벗기 (사는 건 계산대에서)
//  · 옷장: 문 두 짝이 화면 양옆으로 열리고 그 사이에 내가 선다 — 왼문 = 부위, 오른문 = 그 부위의 옷걸이. ↑↓ 부위 · ←→ 옷 · E 입기
//  · 계산대: 손님 쪽 작은 화면에 찍힌 옷이 한 줄씩 · 둥근 결제판에 패를 대면 값이 나간다
import * as THREE from 'three';
import { CLOTHES, SLOTS, SLOT_NAME, clothName } from '../../data/clothes.js';
import { won } from '../../data/money.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hex = (c) => '#' + (c >>> 0).toString(16).padStart(6, '0');
const _v = new THREE.Vector3();

/** 옷 모양 그림 (옷걸이에 걸린 모습) — 꼬리표·고리·옷장에서 같이 쓴다 */
export function garmentSVG(shape, col, w = 44) {
  const c = hex(col), d = 'rgba(0,0,0,.25)';
  const hook = '<path d="M22 2 q4 0 4 4 q0 3 -4 4" fill="none" stroke="#9aa4b0" stroke-width="1.6"/><path d="M8 14 L22 9 L36 14" fill="none" stroke="#9aa4b0" stroke-width="1.6"/>';
  const body = {
    tunic: `<path d="M10 14 L22 12 L34 14 L40 22 L34 25 L33 44 L11 44 L10 25 L4 22 Z" fill="${c}" stroke="${d}"/>`,
    weave: `<path d="M10 14 L22 12 L34 14 L43 34 L36 36 L34 26 L35 47 L9 47 L10 26 L8 36 L1 34 Z" fill="${c}" stroke="${d}"/>`,
    work: `<path d="M10 14 L22 12 L34 14 L42 32 L36 34 L33 26 L33 44 L11 44 L11 26 L8 34 L2 32 Z" fill="${c}" stroke="${d}"/><rect x="26" y="20" width="5" height="5" fill="${d}"/>`,
    coat: `<path d="M10 14 L22 12 L34 14 L42 34 L36 36 L34 28 L37 58 L7 58 L10 28 L8 36 L2 34 Z" fill="${c}" stroke="${d}"/><path d="M22 14 L22 58" stroke="${d}"/>`,
    cape: `<path d="M12 14 Q22 10 32 14 L40 44 Q22 50 4 44 Z" fill="${c}" stroke="${d}"/>`,
    vest: `<path d="M12 14 L18 13 L22 22 L26 13 L32 14 L34 42 L10 42 Z" fill="${c}" stroke="${d}"/><path d="M10 26 H34 M10 32 H34" stroke="#fff4c8" stroke-width="2"/>`,
    wide: `<path d="M12 14 H32 L38 52 H25 L22 24 L19 52 H6 Z" fill="${c}" stroke="${d}"/>`,
    slim: `<path d="M14 14 H30 L31 52 H24 L22 24 L20 52 H13 Z" fill="${c}" stroke="${d}"/>`,
    tall: `<path d="M12 16 H22 V40 H32 Q36 40 36 46 H8 V40 Z" fill="${c}" stroke="${d}"/>`,
    light: `<path d="M8 34 Q14 28 24 30 Q34 32 37 38 V42 H8 Z" fill="${c}" stroke="${d}"/>`,
    brim: `<ellipse cx="22" cy="30" rx="20" ry="5" fill="${c}" stroke="${d}"/><path d="M12 30 Q12 16 22 16 Q32 16 32 30" fill="${c}" stroke="${d}"/>`,
    hood: `<path d="M8 40 Q6 14 22 12 Q38 14 36 40 Q30 34 22 34 Q14 34 8 40 Z" fill="${c}" stroke="${d}"/>`,
    hard: `<path d="M8 30 Q8 14 22 14 Q36 14 36 30 Z" fill="${c}" stroke="${d}"/><rect x="4" y="30" width="36" height="4" rx="2" fill="${c}" stroke="${d}"/>`,
  }[shape] || `<rect x="10" y="14" width="24" height="30" fill="${c}"/>`;
  return `<svg class="gsvg" viewBox="0 0 44 60" width="${w}" height="${(w * 60) / 44}">${hook}${body}</svg>`;
}
/** 가진 옷·든 옷 하나의 그림 (장갑은 모양 이름이 윗옷과 겹쳐 따로) */
const gsvg = (o, w) => (CLOTHES[o.item] && CLOTHES[o.item].slot === 'gloves'
  ? `<svg class="gsvg" viewBox="0 0 44 60" width="${w}" height="${(w * 60) / 44}"><path d="M14 18 h16 v18 q0 10 -8 10 q-8 0 -8 -10 z" fill="${hex(o.color)}" stroke="rgba(0,0,0,.25)"/></svg>`
  : garmentSVG((CLOTHES[o.item] || {}).shape, o.color, w));

/** 3D 자리 → 화면 픽셀 (보이지 않으면 null) */
function toScreen(game, x, y, z, host) {
  _v.set(x, y, z).project(game.engine.camera);
  if (_v.z > 1 || _v.z < -1) return null;
  const r = host.getBoundingClientRect();
  return [((_v.x + 1) / 2) * r.width, ((1 - _v.y) / 2) * r.height];
}
/** 키 받기 (기기가 열린 동안만) */
function keys(map) { const f = (e) => { const k = map[e.key] || map[e.key.toLowerCase()]; if (k) { e.preventDefault(); k(); } }; window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f); }
/** 카메라를 잠깐 바꿨다가 되돌린다 */
function holdCam(game, set) { const r = game.rig, old = { yaw: r.yaw, pitch: r.pitch, zoom: r.zoom }; set(r); r._init = false; return () => { Object.assign(r, old); r._init = false; }; }

// ── 옷걸이 ─────────────────────────────────────
export function browseRack(game, { options, rail, held, max, take }) {
  // options: [{ item, color, price, fit, left }] · rail: [[x,y,z],[x,y,z]] 세계 좌표의 가로대 양 끝 · take(opt) → 성공이면 true
  const host = document.createElement('div');
  host.className = 'rack-view';
  host.innerHTML = `<div class="rv-tags"></div><div class="rv-held"></div><div class="rv-keys">← → 고르기 · E 손에 들기 · Esc 그만</div>`;
  const tagsEl = host.querySelector('.rv-tags'), heldEl = host.querySelector('.rv-held');
  let sel = 0, raf = 0;
  const drawTags = () => {
    tagsEl.innerHTML = options.map((o, i) => { const C = CLOTHES[o.item]; return `<div class="rv-tag${i === sel ? ' sel' : ''}${o.left <= 0 ? ' gone' : ''}" data-i="${i}"><i class="rv-string"></i><div class="rv-card"><b>${esc(C.name)}</b><span class="rv-sw" style="background:${hex(o.color)}"></span><em>${esc(won(o.price))}</em><small>${o.fit === 'awen' ? '아웬 치수' : '누구나 맞음'}</small></div></div>`; }).join('');
    tagsEl.querySelectorAll('.rv-tag').forEach((t) => t.addEventListener('click', () => { sel = +t.dataset.i; drawTags(); doTake(); }));
    heldEl.innerHTML = `<span>손에 든 옷 ${held().length}/${max}</span>${held().map((o) => gsvg(o, 26)).join('')}`;
  };
  const place = () => {
    raf = requestAnimationFrame(place);
    const n = options.length, els = tagsEl.children;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, a = rail[0], b = rail[1];
      const p = toScreen(game, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, host);
      const el = els[i];
      if (!el) continue;
      if (!p) { el.style.display = 'none'; continue; }
      el.style.display = ''; el.style.transform = `translate(${p[0]}px, ${p[1]}px)`;
    }
  };
  const doTake = () => { const o = options[sel]; if (!o || o.left <= 0) return; if (take(o)) drawTags(); }; // take 가 남은 수(left)를 고친다
  const un = keys({ arrowleft: () => { sel = (sel + options.length - 1) % options.length; drawTags(); }, arrowright: () => { sel = (sel + 1) % options.length; drawTags(); }, e: doTake, enter: doTake, ' ': doTake });
  drawTags(); place();
  return game.ui.mount(host, { cls: 'dev-world', onClose: () => { cancelAnimationFrame(raf); un(); } });
}

// ── 탈의 칸 (거울) ─────────────────────────────
export function mirrorBooth(game, { held, wear, isOn, onClose, cam = null }) {
  const host = document.createElement('div');
  host.className = 'mirror-view';
  host.innerHTML = `<div class="mv-hook"><b>고리</b><div class="mv-list"></div></div><div class="mv-note"></div><div class="mv-keys">← → 고르기 · E 입기/벗기 · Esc 탈의 칸에서 나오기 — 사는 건 계산대에서</div>`;
  const list = host.querySelector('.mv-list'), note = host.querySelector('.mv-note');
  let sel = 0;
  const draw = () => {
    const H = held();
    if (!H.length) { list.innerHTML = '<em>든 옷이 없어요</em>'; note.textContent = ''; return; }
    sel = Math.min(sel, H.length - 1);
    list.innerHTML = H.map((o, i) => `<button class="mv-h${i === sel ? ' sel' : ''}${isOn(o) ? ' on' : ''}" data-i="${i}">${gsvg(o, 40)}<span>${esc(CLOTHES[o.item].name)}</span><em>${esc(won(o.price))}</em></button>`).join('');
    list.querySelectorAll('.mv-h').forEach((b) => b.addEventListener('click', () => { sel = +b.dataset.i; toggle(); }));
    const o = H[sel];
    note.innerHTML = isOn(o) ? (o.fit === 'awen' ? '아웬 치수 — 소매가 손을 덮고 단이 끌려요. 사서 재단사에게 수선을 맡기면 맞아요.' : '잘 맞아요.') : '';
  };
  const toggle = () => { const o = held()[sel]; if (!o) return; wear(o); draw(); };
  // 카메라: 칸 밖 점원 자리에서 나를 앞에서 본다(cam) — 없으면 뒤따르던 카메라를 앞으로 돌린다
  const back = cam ? (() => { const prev = game.rig.override; game.rig.override = cam; return () => { if (game.rig.override === cam) game.rig.override = prev && prev !== cam ? prev : null; }; })() : holdCam(game, (r) => { r.yaw = game.player.yaw; r.pitch = -0.04; r.zoom = 0.62; });
  const un = keys({ arrowup: () => { sel = Math.max(0, sel - 1); draw(); }, arrowleft: () => { sel = Math.max(0, sel - 1); draw(); }, arrowdown: () => { sel = Math.min(held().length - 1, sel + 1); draw(); }, arrowright: () => { sel = Math.min(held().length - 1, sel + 1); draw(); }, e: toggle, enter: toggle, ' ': toggle });
  draw();
  const L = game.ui.mount(host, { cls: 'dev-world', onClose: () => { un(); back(); onClose && onClose(); } });
  L.redraw = draw;
  return L;
}

// ── 옷장 ───────────────────────────────────────
export function wardrobeView(game, { where = '옷장' } = {}) {
  const W = game.state.wardrobe;
  const host = document.createElement('div');
  host.className = 'wardrobe-view';
  host.innerHTML = `<div class="wv-door l"><b>${esc(where)}</b><div class="wv-slots"></div></div><div class="wv-door r"><div class="wv-rail"></div><div class="wv-hint"></div></div><div class="wv-keys">↑ ↓ 부위 · ← → 옷 · E 입기 · Esc 문 닫기</div>`;
  const slotsEl = host.querySelector('.wv-slots'), rail = host.querySelector('.wv-rail'), hint = host.querySelector('.wv-hint');
  let si = 0, gi = 0;
  const mine = (slot) => [null, ...W.own.filter((o) => CLOTHES[o.item] && CLOTHES[o.item].slot === slot)];
  const draw = () => {
    slotsEl.innerHTML = SLOTS.map((s, i) => { const cur = W.own.find((o) => o.id === W.worn[s]); return `<button class="wv-slot${i === si ? ' sel' : ''}" data-i="${i}"><span>${esc(SLOT_NAME[s])}</span><em>${cur ? esc(clothName(cur)) : '탐사복'}</em></button>`; }).join('');
    slotsEl.querySelectorAll('.wv-slot').forEach((b) => b.addEventListener('click', () => { si = +b.dataset.i; gi = 0; draw(); }));
    const L = mine(SLOTS[si]);
    gi = Math.min(gi, L.length - 1);
    rail.innerHTML = L.map((o, i) => {
      if (!o) return `<button class="wv-hang empty${i === gi ? ' sel' : ''}${!W.worn[SLOTS[si]] ? ' on' : ''}" data-i="${i}"><span>탐사복만</span></button>`;
      const no = o.fit === 'awen' || o.atTailor;
      return `<button class="wv-hang${i === gi ? ' sel' : ''}${W.worn[SLOTS[si]] === o.id ? ' on' : ''}${no ? ' no' : ''}" data-i="${i}">${gsvg(o, 46)}<span>${esc(clothName(o))}</span></button>`;
    }).join('');
    rail.querySelectorAll('.wv-hang').forEach((b) => b.addEventListener('click', () => { gi = +b.dataset.i; wear(); }));
    const o = L[gi];
    hint.textContent = !o ? '' : o.atTailor ? '재단사에게 맡겨 둔 옷이에요' : o.fit === 'awen' ? '아웬 치수 — 수선해야 입을 수 있어요' : o.fit === 'univ' ? '범용 · 끈으로 맞춤' : '내 치수로 고친 옷';
  };
  const wear = () => {
    const s = SLOTS[si], o = mine(s)[gi];
    if (o && (o.fit === 'awen' || o.atTailor)) { draw(); return; }
    if (o) W.worn[s] = o.id; else delete W.worn[s];
    game.dress(); game.save(); draw();
  };
  const back = holdCam(game, (r) => { r.yaw = game.player.yaw; r.pitch = -0.06; r.zoom = 0.7; });
  const un = keys({ arrowup: () => { si = (si + SLOTS.length - 1) % SLOTS.length; gi = 0; draw(); }, arrowdown: () => { si = (si + 1) % SLOTS.length; gi = 0; draw(); }, arrowleft: () => { gi = Math.max(0, gi - 1); draw(); }, arrowright: () => { gi = Math.min(mine(SLOTS[si]).length - 1, gi + 1); draw(); }, e: wear, enter: wear, ' ': wear });
  draw();
  return game.ui.mount(host, { cls: 'dev-world', onClose: () => { un(); back(); } });
}

// ── 계산대 (손님 쪽 화면 · 결제판) ───────────────
export function counterPay(game, { org, lines, total, pay, drop = null }) {
  // lines: [{ name, price, color }] · pay() → true 면 결제됨 · drop: { label, on } 돈이 모자랄 때 몇 개 내려놓기
  const host = document.createElement('div');
  host.className = 'pos';
  host.innerHTML = `<div class="pos-screen"><div class="pos-head">${esc(org)}</div><div class="pos-lines"></div><div class="pos-total"><span>모두</span><b>${esc(won(total))}</b></div><div class="pos-cash">가진 돈 ${esc(won(game.state.inv.starseed || 0))}</div></div>
    <button class="pos-pad"><i></i><span>시민 패를 대세요</span></button>${drop ? `<button class="pos-drop">${esc(drop.label)}</button>` : ''}<button class="pos-leave">그만두기 (Esc)</button>`;
  const L = host.querySelector('.pos-lines'), pad = host.querySelector('.pos-pad');
  lines.forEach((l, i) => setTimeout(() => { const d = document.createElement('div'); d.className = 'pos-line'; d.innerHTML = `<i style="background:${hex(l.color)}"></i><span>${esc(l.name)}</span><b>${esc(won(l.price))}</b>`; L.appendChild(d); game.audio && game.audio.blip && game.audio.blip({ hz: 1250, to: 1400, dur: 0.05, gain: 0.04, bus: 'ui' }); }, 220 * i));
  let done = false;
  const go = () => {
    if (done) return;
    if (!pay()) { pad.classList.add('no'); pad.querySelector('span').textContent = '돈이 모자라요'; return; }
    done = true; pad.classList.add('ok'); pad.querySelector('span').textContent = '결제되었어요';
    setTimeout(() => lay.close(), 1100);
  };
  pad.addEventListener('click', go);
  host.querySelector('.pos-leave').addEventListener('click', () => lay.close());
  if (drop) host.querySelector('.pos-drop').addEventListener('click', () => { lay.close(); drop.on(); });
  const un = keys({ e: go, enter: go });
  const lay = game.ui.mount(host, { cls: 'dev-pos', onClose: un });
  lay.acts = [{ label: '패 대기 · 결제', off: false, run: go }, ...(drop ? [{ label: drop.label, off: false, run: () => { lay.close(); drop.on(); } }] : [])];
  return lay;
}
