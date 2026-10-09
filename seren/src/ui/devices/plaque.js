// 설명 명판 (v24 「기기별 UI」): 전시품 받침 옆의 놋쇠판 · 기념비의 돌판 · 안내 기둥의 유리판. 화면 한쪽에 비스듬히 서서
//  전시품·기념비(카메라가 그쪽을 비춘다)를 가리지 않는다. 글은 새긴 글씨(놋쇠·돌) 또는 빛 글씨(유리). 해설사와 둘러볼 때는
//  아래에 해설사의 말(자막)과 손짓 단추(다음 전시로)만 붙는다.
import { esc, blip, mountDevice, isUse } from './common.js';

/**
 * openPlaque(game, { mat: 'brass'|'stone'|'glass'|'wood', kicker, title, era, text, art (html), foot (html), say (해설사 말),
 *   actions: [{ label, on, stay }], cam: { pos: Vector3, look: Vector3 }, side: 'left'|'right', onClose })
 */
export function openPlaque(game, o) {
  const el = document.createElement('div');
  el.className = `plq mat-${o.mat || 'brass'} side-${o.side || 'left'}`;
  el.innerHTML = `<div class="pq-face">${o.kicker ? `<small class="pq-k">${esc(o.kicker)}</small>` : ''}<h3>${esc(o.title)}</h3>${o.era ? `<div class="pq-era">${esc(o.era)}</div>` : ''}${o.art ? `<div class="pq-art">${o.art}</div>` : ''}<p>${esc(o.text || '')}</p>${o.foot ? `<div class="pq-foot">${o.foot}</div>` : ''}<i class="pq-bolt a"></i><i class="pq-bolt b"></i><i class="pq-bolt c"></i><i class="pq-bolt d"></i></div>
    ${o.say ? `<div class="pq-say">${esc(o.say)}</div>` : ''}<div class="pq-acts">${(o.actions || []).map((a, i) => `<button class="pq-a" data-a="${i}">${esc(a.label)}</button>`).join('')}<button class="pq-a ghost" data-leave>물러서기 (Esc)</button></div>`;
  const prev = game.rig ? game.rig.override : null;
  if (o.cam && game.rig) game.rig.override = { pos: o.cam.pos, look: o.cam.look };
  const act = (i) => { const a = (o.actions || [])[i]; if (!a) return; blip(game, 'click'); if (!a.stay) lay.close(); a.on && a.on(); };
  el.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => act(+b.dataset.a)));
  el.querySelector('[data-leave]').addEventListener('click', () => lay.close());
  const lay = mountDevice(game, el, {
    cls: 'dev-plaque',
    onClose: () => { if (o.cam && game.rig && game.rig.override && game.rig.override.pos === o.cam.pos) game.rig.override = prev && prev !== game.rig.override ? prev : null; o.onClose && o.onClose(); },
    keys: (e) => { if (isUse(e) && (o.actions || []).length) { act(0); return true; } return false; },
  });
  return lay;
}
