// 세렌 — 울림이 남는 별
import * as THREE from 'three';
import { Game } from './game/game.js';
import { heightAt } from './world/heightfield.js';

const game = new Game();
game.boot();

// 개발·테스트용 핸들 (브라우저 콘솔에서 SEREN.game 으로 접근)
window.SEREN = {
  game, THREE, heightAt,
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
