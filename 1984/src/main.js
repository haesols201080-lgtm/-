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
import { store } from './core/store.js';
import { isTouch, setupTouch } from './core/touch.js';

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
  const params0 = new URLSearchParams(location.search);
  // ?nocity skips building London (fast look-dev of rooms and the country)
  if (params0.has('nocity')) G.world = { points: { home_door: { x: 0, y: 0, z: 0 } }, zones: {}, paths: {}, lamps: [], telescreens: [], posters: [], zoneAt: () => 'outskirts', surface: () => 'paving', setPosterEnemy() {}, placer: { footprints: [] } };
  else setupCity(G);
  ui.loading(0.9);
  setupInteriors(G);
  setupCountryside(G);
  setupWeather(G);
  setupStory(G);
  ui.loading(0.96);
  const params = new URLSearchParams(location.search);
  if (params.has('noprobe')) G.atmos.noProbe = true;
  if (params.has('slowgpu')) G.debug.maxDt = 2;     // headless tests run at ~1 fps
  const touch = isTouch();
  if (touch) setupTouch(G);
  G.renderer.setup(G.scene, G.camera, params.get('q') || store.get('1984.quality') || (touch ? 'low' : 'medium'));
  // compile shaders up front so the first seconds do not stutter
  if (params0.has('nocity')) G.enter('flat', 'door');
  else G.enter('city', 'home_door');
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
