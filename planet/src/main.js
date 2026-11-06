// Entry point: boot sequence (textures, streamed planet around the landing
// site), title screen, main loop, developer panel (?dev=1).
import * as THREE from 'three';
import { Intro } from './game/intro.js';
import { Engine } from './core/engine.js';
import { U, WORLD } from './core/shared.js';
import { generateTextures } from './world/textures.js';
import { TEX } from './world/texstore.js';
import { Terrain } from './world/terrain.js';
import { Sky } from './world/sky.js';
import { Colliders } from './core/colliders.js';
import { Props } from './world/props.js';
import { Flora } from './world/flora.js';
import { Game } from './game/game.js';
import { STAGES, ITEMS, RESEARCH } from './sim/data.js';

const $ = (s) => document.querySelector(s);
function progress(p, text) {
  const b = $('#load-bar'); if (b) b.style.width = Math.round(p * 100) + '%';
  const t = $('#load-text'); if (t && text) t.textContent = text;
}
const frame = () => new Promise((r) => setTimeout(r, 0));
const params = new URLSearchParams(location.search);

async function boot() {
  const engine = new Engine($('#game'));
  progress(0.03, '표면 재질 합성 중');
  await frame();
  Object.assign(TEX, generateTextures(WORLD.SEED));
  U.tNoise.value = TEX.noise;
  progress(0.1, '대기 모델 계산 중');
  await frame();
  const terrain = new Terrain(engine.scene);
  const sky = new Sky(engine.renderer, engine.scene);
  engine.attachSky(sky);
  const colliders = new Colliders();
  const base = { engine, terrain, sky, colliders, THREE, U };
  base.isBlocked = () => false;
  base.props = new Props(base);
  base.flora = new Flora(base);
  const game = new Game(base);
  // props/flora were created with the base object; point them at the game
  game.props.game = game; game.flora.game = game;
  base.isBlocked = (x, z, r) => game.isBlocked(x, z, r);
  window.__game = game;
  window.__THREE = THREE;   // test / dev hook

  const resume = game.hasSave() && !params.has('new');
  const cam = engine.camera;
  if (resume) game.load();
  else game.newGame();
  const P = game.player.pos;
  game.titleCenter = new THREE.Vector3(P.x, P.y, P.z);
  cam.position.set(P.x + 40, P.y + 20, P.z + 40);
  cam.lookAt(P);
  // stream the landing area before the first frame
  for (let i = 0; i < 900; i++) {
    const r = terrain.readyFor(cam.position);
    terrain.readyFor(P);
    game.props.update(cam.position);
    const cells = [...game.props.cells.values()];
    const cr = cells.filter((c) => c.ready).length;
    progress(0.15 + 0.8 * ((r.total ? r.ready / r.total : 0) * 0.6 + (cells.length ? cr / cells.length : 0) * 0.4), `지형 측량 중 · 청크 ${r.ready}/${r.total} · 지역 ${cr}/${cells.length}`);
    if (r.total && r.ready === r.total && terrain.stats.pending === 0 && cr === cells.length && cells.length) break;
    await new Promise((res) => setTimeout(res, 30));
  }
  game.terra.tick(0.016);
  game.terra.sVis = game.terra.visFloat();
  sky.refreshEnv();

  const manual = params.get('test') === '1';
  let last = performance.now();
  game.fps = 0;
  let fpsAcc = 0, fpsN = 0;
  function tick(dt, render = true) {
    U.uTime.value += dt;
    game.update(dt);
    if (!render) return;
    const t0 = performance.now();
    engine.render();
    game.frameMs = performance.now() - t0;
  }
  game.step = (n = 1, dt = 1 / 60) => { for (let i = 0; i < n; i++) tick(dt, i === n - 1); return game.frameMs; };
  game.sim = (n = 1, dt = 1 / 60) => { for (let i = 0; i < n; i++) tick(dt, false); };
  game.settle = async (maxMs = 20000) => {
    const t0 = performance.now();
    while (performance.now() - t0 < maxMs) {
      tick(1 / 60, false);
      const r = terrain.readyFor(cam.position);
      const pend = [...game.props.cells.values()].some((c) => !c.ready);
      if (r.ready === r.total && terrain.stats.pending === 0 && !pend) break;
      await new Promise((res) => setTimeout(res, 40));
    }
    tick(1 / 60, false);
    return terrain.stats;
  };
  // adaptive quality: if the first seconds run slow, step the preset down once or twice
  const auto = { t: 0, n: 0, sum: 0, steps: 0 };
  const ladder = ['ultra', 'high', 'medium', 'low'];
  function loop(now) {
    const raw = (now - last) / 1000;
    const dt = Math.min(0.05, raw);
    last = now;
    if (!manual) {
      tick(dt);
      fpsAcc += dt; fpsN++;
      if (fpsAcc > 1) { game.fps = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
      if (game.settings.autoQuality !== false && auto.steps < 2) {
        auto.t += raw; auto.n++; auto.sum += raw;
        if (auto.t > 4) {
          const avg = auto.sum / auto.n;
          const i = ladder.indexOf(game.settings.quality);
          if (avg > 1 / 32 && i >= 0 && i < ladder.length - 1) {
            game.settings.quality = ladder[i + 1];
            game.applySettings();
            auto.steps++;
          } else auto.steps = 2;
          auto.t = 0; auto.n = 0; auto.sum = 0;
        }
      }
    }
    requestAnimationFrame(loop);
  }
  progress(1, '착륙 준비 완료');
  $('#loading').hidden = true;
  showTitle(game, resume);
  let devFlag = false;
  try { devFlag = localStorage.getItem('terra-dev') === '1'; } catch (e) { /* storage blocked */ }
  if (params.get('dev') === '1' || devFlag) devPanel(game);
  requestAnimationFrame(loop);
  game.ready = true;
}

function showTitle(game, resume) {
  const el = document.createElement('div');
  el.id = 'title';
  const touch = game.input.touch;
  const T = game.terra, st = STAGES[T.stage];
  const sv = T.sVis;
  // planet readout: the real surface state (the start values on a new game)
  const temp = Math.round(-63 + Math.min(80, sv * 8)), press = (0.006 + Math.min(1.2, sv / 10)).toFixed(3);
  const o2 = Math.min(21, sv >= 10 ? 21 : sv * 1.6).toFixed(1);
  const fmt = (v) => (v >= 1e6 ? (v / 1e6).toFixed(2) + ' M' : v >= 1e3 ? (v / 1e3).toFixed(1) + ' k' : Math.round(v) + ' ');
  el.innerHTML = `
    <svg class="t-orbit" viewBox="0 0 400 400" aria-hidden="true">
      <circle cx="200" cy="200" r="186" class="o1"/><circle cx="200" cy="200" r="150" class="o2"/>
      <circle cx="200" cy="200" r="186" class="ticks"/>
      <g class="sat"><circle cx="386" cy="200" r="4"/></g>
    </svg>
    <div class="t-main">
      <div class="t-eyebrow"><i></i>행성 재생 계획 · ARKE-${4207}</div>
      <h1 class="t-logo"><span>TERRA</span><span>GENESIS</span></h1>
      <div class="t-ko">테라 제네시스</div>
      <p class="t-tag">붉은 먼지뿐인 행성 아르케에 홀로 내려앉아, 하늘을 푸르게 바꾸고 호수를 채우고, 숲과 도시를 세우십시오.</p>
      <div class="t-menu">
        <button class="t-btn pri" data-a="go"><b>${resume ? '이어하기' : '착륙 시작'}</b><small>${resume ? `${game.sky.day}일차 · ${st.name} · ${fmt(T.ti)}Ti` : '착륙 포드 · 산소 100% · 1일차'}</small></button>
        ${resume ? '<button class="t-btn" data-a="new"><b>새 개척</b><small>지금의 기록을 지우고 처음부터</small></button>' : ''}
        <div class="t-row">
          <button class="t-btn sm" data-a="help"><b>조작법</b></button>
          <button class="t-btn sm" data-a="set"><b>설정</b></button>
        </div>
      </div>
    </div>
    <aside class="t-data">
      <div class="lbl"><i></i>행성 관측 · ${resume ? '현재' : '착륙 전'}</div>
      <dl>
        <div><dt>지표 온도</dt><dd>${temp} °C</dd></div>
        <div><dt>기압</dt><dd>${press} atm</dd></div>
        <div><dt>산소</dt><dd>${o2} %</dd></div>
        <div><dt>중력</dt><dd>0.84 g</dd></div>
        <div><dt>탐사 구역</dt><dd>16 × 16 km</dd></div>
        <div><dt>테라포밍</dt><dd>${fmt(T.ti)}Ti</dd></div>
      </dl>
      <div class="stage">${st.name}</div>
    </aside>
    <div class="t-foot">${touch ? '왼쪽을 끌어 이동 · 오른쪽을 끌어 시점 · 가로 화면을 권장합니다' : '시작 후 화면을 클릭하면 마우스로 시점을 돌립니다 · Esc 일시 정지 · H 조작 안내'}</div>`;
  document.getElementById('ui').appendChild(el);
  el.querySelector('[data-a=go]').onclick = () => start(game, el);
  const nb = el.querySelector('[data-a=new]');
  if (nb) nb.onclick = () => { game.wipe(); location.search = '?new=1'; };
  el.querySelector('[data-a=help]').onclick = () => game.ui.open('help');
  el.querySelector('[data-a=set]').onclick = () => game.ui.open('pause');
  game.ui.hud.hidden = true;
  game.titleEl = el;
}

function start(game, el) {
  el.remove();
  if (game.input.touch) {
    // phones: go fullscreen and landscape when the browser allows it
    try { const r = document.documentElement.requestFullscreen && document.documentElement.requestFullscreen(); if (r && r.catch) r.then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {})).catch(() => {}); } catch (e) { /* not allowed */ }
  }
  game.audio.start();
  game.ui.close(false);
  // a new expedition opens with the landing; then the game begins
  if (game.flags.newGame && !game.flags.introShown && !params.has('nointro') && game.expedition.b) {
    game.flags.introShown = true;
    new Intro(game, () => begin(game)).start();
    return;
  }
  begin(game);
}

function begin(game) {
  game.ui.hud.hidden = false;
  game.started = true;
  game.input.lock();
  game.updateLockHint();
  if (game.flags.newGame && !game.flags.landedToast) {
    game.flags.landedToast = true;
    game.ui.toast('<b>행성 아르케, 착륙 완료</b>대기압 0.006기압 · 지표 −63°C · 산소 없음. 탐사선 화물 승강기 아래에서 산소를 보충할 수 있습니다.', 'info', 8, true);
  }
}
window.__start = () => { const g = window.__game; if (g && g.titleEl) { g.flags.introShown = true; start(g, g.titleEl); } };
window.__intro = () => { const g = window.__game; if (g && g.titleEl) start(g, g.titleEl); };

// --------------------------------------------------------------- developer panel
function devPanel(game) {
  const el = document.createElement('div');
  el.id = 'dev';
  el.className = 'card';
  const stages = STAGES.map((s, i) => `<option value="${i}">${i}. ${s.name}</option>`).join('');
  el.innerHTML = `<b>개발자 모드</b>
    <div class="opts"><button data-a="items">자원 +200</button><button data-a="research">연구 전부</button><button data-a="credits">크레딧 +5000</button></div>
    <div class="opts"><button data-a="god">무적</button><button data-a="fly">비행</button><button data-a="fast">빠른 이동</button></div>
    <label>테라포밍 단계 <select data-a="stage">${stages}</select></label>
    <div class="opts"><button data-a="t6">아침</button><button data-a="t12">정오</button><button data-a="t18">저녁</button><button data-a="t0">밤</button></div>
    <div class="opts"><button data-a="tp-volcano">화산</button><button data-a="tp-basin">분지</button><button data-a="tp-rift">대협곡</button><button data-a="tp-home">기지</button></div>`;
  document.body.appendChild(el);
  el.addEventListener('mousedown', (e) => e.stopPropagation());
  const g = game;
  el.querySelectorAll('button').forEach((b) => b.onclick = () => {
    const a = b.dataset.a;
    if (a === 'items') { g.eco.inv.slots = 60; for (const id in ITEMS) { g.eco.inv.items.set(id, 150); g.eco.store.items.set(id, 200); } }
    if (a === 'research') for (const r of RESEARCH) g.research.done.add(r.id);
    if (a === 'credits') g.colony.credits += 5000;
    if (a === 'god') g.cheats.god = !g.cheats.god;
    if (a === 'fly') g.player.flyCheat = !g.player.flyCheat;
    if (a === 'fast') g.player.speedMul = g.player.speedMul > 1 ? 1 : 4;
    if (/^t\d+$/.test(a)) g.sky.time = +a.slice(1) / 24;
    if (a.startsWith('tp-')) {
      const k = a.slice(3);
      const L = k === 'home' ? { x: g.titleCenter.x, z: g.titleCenter.z } : g.landmarks[k];
      g.player.pos.set(L.x + 30, g.terrain.height(L.x + 30, L.z + 30) + 2, L.z + 30);
    }
    g.ui.dirty(); g.ui.renderHotbar();
  });
  el.querySelector('select').onchange = (e) => {
    const i = +e.target.value;
    const ti = STAGES[i].ti * 1.02 + 1;
    const cur = g.terra.ti;
    if (ti > cur) g.terra.add('pressure', ti - cur);
    g.terra.sVis = g.terra.visFloat();
  };
}

boot().catch((e) => {
  console.error(e);
  const t = $('#load-text'); if (t) t.textContent = '오류: ' + e.message;
});
