// 세렌 — 울림이 남는 별
import * as THREE from 'three';
import { Game } from './game/game.js';
import { heightAt } from './world/heightfield.js';
import { listSlots, renameSlot, deleteSlot, defaultState } from './game/state.js';
import { QUESTS } from './data/story.js';
import { questType } from './game/quests.js';

const game = new Game();
game.boot();

// 개발·테스트용 핸들 (브라우저 콘솔에서 SEREN.game 으로 접근)
// ?debug=1 : 성능 표시
if (new URLSearchParams(location.search).has('debug')) {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:99;font:11px monospace;color:#9ff;background:rgba(0,0,0,.5);padding:6px 8px;border-radius:6px;pointer-events:none;white-space:pre';
  document.body.appendChild(el);
  let n = 0, t0 = performance.now();
  setInterval(() => {
    const i = game.engine.renderer.info;
    const fps = (game.frames - n) / ((performance.now() - t0) / 1000);
    n = game.frames; t0 = performance.now();
    el.textContent = `fps ${fps.toFixed(0)}  res ${game.engine.resScale.toFixed(2)}\ncalls ${i.render.calls}  tris ${(i.render.triangles / 1000).toFixed(0)}k\nchunks ${game.world.terrain.visibleCount}  flora ${game.flora.count.join('/')}\npos ${game.player.pos.toArray().map((v) => v.toFixed(0)).join(',')}`;
  }, 500);
}

window.SEREN = {
  game, THREE, heightAt, defaultState,
  slots: { list: listSlots, rename: renameSlot, remove: deleteSlot },
  questTypes: () => {
    const ids = Object.keys(QUESTS), chain = [];
    for (let id = 'mq0'; id && !chain.includes(id); id = QUESTS[id] && QUESTS[id].next) chain.push(id);
    return { main: ids.filter((id) => questType(QUESTS[id]) === 'main'), side: ids.filter((id) => questType(QUESTS[id]) === 'side'), chain };
  },
  engine: game.engine,
  terrain: game.world.terrain,
  ready: () => game.mode !== 'boot' && game.settledFrames > 3,
  debugInfo: () => ({
    mode: game.mode, state: game.player.state, pos: game.player.pos.toArray().map((v) => +v.toFixed(1)),
    speed: +game.player.hspeed.toFixed(1), vy: +game.player.vel.y.toFixed(1), glide: +game.player.glideSpeed.toFixed(1),
    skim: +game.player.skimSpeed.toFixed(1), ev: [...game.player.events],
    quest: game.quests.objectiveText(), tones: game.state.tones,
  }),
};
