// 물건 놓기 (v24 「구매한 물품의 실제 사용」 · 범용 UI 폐기): 메뉴 없이 그 자리에서 — 바라보는 쪽 바닥에 물건의 반투명 모습이 뜨고
//  놓을 수 있으면 초록, 벽·가구에 걸리면 빨강. 방향키 앞뒤·옆으로 옮기기 · Q/R 돌리기 · E 놓기 · X 가방에 넣기(이미 놓인 것) · Esc 그만.
import * as THREE from 'three';
import { GB } from '../../interior/geom.js';
import { decorModel } from '../../interior/exhibits.js';

const OK = new THREE.MeshBasicMaterial({ color: 0x7ff3a0, transparent: true, opacity: 0.55, depthWrite: false });
const NO = new THREE.MeshBasicMaterial({ color: 0xff6a5a, transparent: true, opacity: 0.55, depthWrite: false });

/**
 * placeMode(game, { k, name, color, ind, floor, start: {gx, gz, ry}?, canPlace(gx, gz) → true|이유, onPlace(gx, gz, ry), onBag?() })
 * 틀 좌표(gx, gz)와 틀 기준 돌림(ry)으로 돌려준다 (집 꾸미기 장부와 같은 좌표)
 */
export function placeMode(game, o) {
  const ind = o.ind, theta = ind.B.theta;
  const gb = new GB();
  decorModel(gb, o.k, 0, 0, 0, 0, o.color ?? 0xffffff);
  const mesh = new THREE.Mesh(gb.build(), OK);
  mesh.userData.indoor = true; mesh.renderOrder = 5;
  game.engine.scene.add(mesh);
  // 처음 자리: 놓인 물건을 옮기면 그 자리, 새 물건은 바라보는 쪽 1 m 앞
  const p = game.player.pos;
  let fwd = 1.0, side = 0, ry = o.start ? o.start.ry : -game.player.yaw + theta, okNow = false, why = '';
  let base = o.start ? { gx: o.start.gx, gz: o.start.gz } : null;
  const at = () => {
    if (base) return [base.gx + side * 0.5, base.gz + fwd * 0.5 - 0.5]; // 놓인 것을 옮길 때: 그 자리에서 칸 단위로
    const yaw = game.player.yaw, x = p.x + Math.sin(yaw) * fwd + Math.cos(yaw) * side, z = p.z + Math.cos(yaw) * fwd - Math.sin(yaw) * side;
    return ind.grid(x, z);
  };
  const host = document.createElement('div');
  host.className = 'place-view';
  host.innerHTML = `<div class="pv-item"><b>${o.name}</b><span class="pv-state"></span></div><div class="pv-keys">방향키 옮기기 · Q R 돌리기 · E 놓기${o.onBag ? ' · X 가방에 넣기' : ''} · Esc 그만</div>`;
  const stateEl = host.querySelector('.pv-state');
  let raf = 0;
  const tick = () => {
    raf = requestAnimationFrame(tick);
    const [gx, gz] = at();
    const [wx, wz] = ind.world(gx, gz);
    mesh.position.set(wx, ind.yOf(o.floor) + 0.01, wz);
    mesh.rotation.y = ry + theta;
    const r = o.canPlace(gx, gz);
    okNow = r === true; why = okNow ? '여기에 놓을 수 있어요' : r;
    mesh.material = okNow ? OK : NO;
    stateEl.textContent = why; stateEl.className = `pv-state ${okNow ? 'ok' : 'no'}`;
  };
  const step = (df, ds) => { fwd = Math.max(0.5, Math.min(base ? 6 : 2.5, fwd + df)); side = Math.max(-3, Math.min(3, side + ds)); };
  const onKey = (e) => {
    const k = e.key.toLowerCase();
    if (k === 'arrowup' || k === 'w') step(0.25, 0); else if (k === 'arrowdown' || k === 's') step(-0.25, 0);
    else if (k === 'arrowleft' || k === 'a') step(0, -0.25); else if (k === 'arrowright' || k === 'd') step(0, 0.25);
    else if (k === 'q') ry += Math.PI / 8; else if (k === 'r') ry -= Math.PI / 8;
    else if (k === 'e' || k === 'enter') { if (okNow) { const [gx, gz] = at(); o.onPlace(gx, gz, ry); lay.close(); } else game.audio && game.audio.blip && game.audio.blip({ hz: 200, to: 150, dur: 0.1, gain: 0.05, bus: 'ui' }); }
    else if (k === 'x' && o.onBag) { o.onBag(); lay.close(); }
    else return;
    e.preventDefault();
  };
  window.addEventListener('keydown', onKey);
  tick();
  const lay = game.ui.mount(host, { cls: 'dev-world', onClose: () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', onKey); game.engine.scene.remove(mesh); mesh.geometry.dispose(); o.onClose && o.onClose(); } });
  return lay;
}
