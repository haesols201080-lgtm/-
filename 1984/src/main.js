// Entry point: load assets, build the world, run the story.
import { createGame } from './game/game.js';
import { loadAll } from './core/assets.js';
import { buildLibrary } from './core/materials.js';
import { setupAudio } from './core/audio.js';
import { setupUI } from './game/ui.js';
import { setupCity } from './world/city.js';
import { setupInteriors } from './world/interiors.js';
import { setupCountryside } from './world/countryside.js';
import { setupNPCs } from './game/npc.js';
import { setupSurveillance } from './game/surveillance.js';
import { setupWeather } from './game/weather.js';
import { setupStory } from './game/story.js';

async function boot() {
  const container = document.getElementById('game');
  const G = createGame(container);
  window.G = G;
  const ui = setupUI(G);
  ui.loading(0);
  await loadAll((p) => ui.loading(p * 0.8));
  buildLibrary();
  setupAudio(G);
  setupNPCs(G);
  setupSurveillance(G);
  ui.loading(0.84);
  setupCity(G);
  ui.loading(0.9);
  setupInteriors(G);
  setupCountryside(G);
  setupWeather(G);
  setupStory(G);
  ui.loading(0.96);
  const params = new URLSearchParams(location.search);
  if (params.has('noprobe')) G.atmos.noProbe = true;
  if (params.has('slowgpu')) G.debug.maxDt = 2;     // headless tests run at ~1 fps
  G.renderer.setup(G.scene, G.camera, params.get('q') || localStorage.getItem('1984.quality') || 'medium');
  // compile shaders up front so the first seconds do not stutter
  G.enter('city', G.world.points.home_door ? { x: G.world.points.home_door.x, z: G.world.points.home_door.z + 0, yaw: 0 } : { x: 0, z: 0 });
  G.renderer.gl.compile(G.scene, G.camera);
  ui.loading(1);
  G.start();
  if (params.has('nostory')) return;   // tools/shot.mjs drives the camera itself
  const choice = params.has('skip') ? 'new' : await ui.mainMenu();
  await G.story.start(choice === 'new');
}

boot().catch((e) => {
  console.error(e);
  const el = document.getElementById('fatal');
  if (el) { el.hidden = false; el.textContent = '오류: ' + (e && e.message ? e.message : e); }
});
