// 게임 전체를 묶는 중심. 엔진·세계·플레이어·시스템·UI 를 만들고, 모드에 따라 매 프레임 갱신합니다.
// 모드: boot → title → intro → play ⇄ (dialogue | menu | card | cinematic)
import * as THREE from 'three';
import { Engine } from '../core/engine.js';
import { Input } from '../core/input.js';
import { detectQuality } from '../core/quality.js';
import { audio } from '../core/audio.js';
import { music } from '../core/music.js';
import { bus } from '../core/events.js';
import { World } from '../world/world.js';
import { Flora } from '../world/flora.js';
import { Structures } from '../world/structures.js';
import { Megacity } from '../world/megacity.js';
import { Traffic } from '../world/traffic.js';
import { Transit } from '../world/transit.js';
import { Landmarks } from '../world/landmarks.js';
import { Drones } from '../world/drones.js';
import { SkyAnchor } from '../world/anchor.js';
import { Farlands } from '../world/farlands.js';
import { Colossi } from '../world/colossus.js';
import { Facilities } from '../world/facilities.js';
import { CityFabric } from '../world/cityfabric.js';
import { Streams } from '../world/streams.js';
import { Currents } from '../world/currents.js';
import { Creatures } from '../world/creatures.js';
import { Fauna } from '../world/fauna.js';
import { Comm } from './comm.js';
import { Clouds } from '../world/clouds.js';
import { Particles, Trail } from '../world/particles.js';
import { REGIONS } from '../world/regions.js';
import { playerUniform, glowMaterial } from '../world/materials.js';
import { Player } from '../player/player.js';
import { Avatar } from '../player/avatar.js';
import { CameraRig } from '../player/camera-rig.js';
import { CURRENTS } from '../data/currents.js';
import { LANDING_START } from '../data/places.js';
import { LINES, MOA, KEEPERS, PYLON_TONES, CODEX, QUESTS } from '../data/story.js';
import { UR_DIR } from '../world/sky-clock.js';
import { defaultState, loadState, saveState, hasSave, loadSettings, deleteSave } from './state.js';
import { Language } from './language.js';
import { NPCs } from './npcs.js';
import { Quests, awakenedCount } from './quests.js';
import { playApproach } from './approach.js';
import { fountainWaterMaterial } from '../world/cityfabric.js';
import { Dialogue } from './dialogue.js';
import { Actions } from './actions.js';
import { Resonance } from './resonance.js';
import { Discovery } from './discovery.js';
import { WorldEvents, Requests } from './world-events.js';
import { Director } from './director.js';
import { Services } from './services.js';
import { Interiors } from './interiors.js';
import { Tips } from './tips.js';
import { MoaAI } from './moa-ai.js';
import { Venues } from './venues.js';
import { Outdoors } from './outdoors.js';
import { Citizens } from './citizens.js';
import { UI } from '../ui/ui.js';
import { MapData } from '../ui/map.js';

export class Game {
  constructor() {
    this.params = new URLSearchParams(location.search);
    this.settings = loadSettings();
    const q = this.params.get('q') || this.settings.quality || detectQuality();
    this.engine = new Engine(document.getElementById('gl'), q);
    this.input = new Input(this.engine.canvas);
    this.input.sensitivity = this.settings.sensitivity;
    this.input.invertY = this.settings.invertY;
    this.audio = audio;
    this.music = music;
    for (const [k, v] of Object.entries(this.settings.vol)) audio.vol[k] = v;
    this.state = defaultState();
    this.time = 0;
    this.mode = 'boot';
    this.frames = 0;
    this.settledFrames = 0;
    this.lines = Object.fromEntries(Object.entries(LINES).map(([id, l]) => [id, { id, ...l }]));

    this.world = new World(this.engine);
    this.structures = this.world.add(new Structures(this.world));
    this.megacity = this.world.add(new Megacity(this.world, this.structures, this.engine.q));
    this.structures.markers.push(...this.megacity.markers);
    this.traffic = this.world.add(new Traffic(this.world, this.megacity, this.engine.q));
    this.transit = this.world.add(new Transit(this.world, this.engine.q));
    this.landmarks = this.world.add(new Landmarks(this.world, this.structures));
    this.anchor = this.world.add(new SkyAnchor(this.world, this.structures));
    this.farlands = this.world.add(new Farlands(this.world, this.structures));
    this.colossi = this.world.add(new Colossi(this.world, this.structures, this));
    this.facilities = this.world.add(new Facilities(this.world, this.structures));
    this.transit.isOpen = (u) => (!u ? true : u.startsWith('quest:') ? this.quests.isDone(u.slice(6)) : !!this.state.pylons[u]);
    this.flora = this.world.add(new Flora(this.world, this.engine.q));
    this.currents = this.world.add(new Currents(this.world, CURRENTS));
    this.city = this.world.add(new CityFabric(this.world, this.engine.q, { transit: this.transit, facilities: this.facilities, currents: this.currents }));
    this.streams = this.world.add(new Streams(this.world, this.city, this.engine.q));
    this.player = new Player(this.world);
    this.creatures = this.world.add(new Creatures(this.world, this));
    this.fauna = this.world.add(new Fauna(this.world, this)); // 톡톡이·노래새·등짐소·포자해파리·유리게
    this.drones = this.world.add(new Drones(this.world, this));
    this.clouds = this.world.add(new Clouds(this.world, this.engine.q));
    this.avatar = new Avatar();
    this.avatar.addTo(this.engine.scene);
    this.rig = new CameraRig(this.engine.camera, this.world);

    this.ui = new UI(this);
    this.lang = new Language(this);
    this.actions = new Actions(this);
    this.quests = new Quests(this);
    this.npcs = new NPCs(this);
    this.dialogue = new Dialogue(this);
    this.resonance = new Resonance(this);
    this.discovery = new Discovery(this);
    this.events = new WorldEvents(this);
    this.director = new Director(this);
    this.mapData = new MapData(this);
    this.requests = new Requests(this);
    this.services = new Services(this);
    this.venues = new Venues(this);
    this.interiors = new Interiors(this);
    this.tips = new Tips(this);
    this.moaAI = new MoaAI(this);
    this.comm = new Comm(this); // 모아 = 궤도의 라르크 호 (착륙선 안테나로 교신)
    this.outdoors = new Outdoors(this);
    this.citizens = new Citizens(this);

    this.particles = new Particles(this.engine.scene);
    this.trails = [new Trail(this.engine.scene, 0xbffcff), new Trail(this.engine.scene, 0xbffcff)];
    this._beacons();
    this._wireEvents();
    this.saveT = 30;
  }

  // ── 시작 ─────────────────────────────────
  boot() {
    const bar = document.querySelector('#boot .boot-bar i');
    const msg = document.querySelector('#boot .boot-msg');
    // 타이틀 카메라 자리에서 지형을 먼저 만들어 둔다
    this.world.clock.time = 0.745;
    this.world.clock.frozen = true;
    this.player.teleport(LANDING_START[0], undefined, LANDING_START[1]);
    this.player.state = 'ground';
    this.director.titleFrame(0);
    this._last = performance.now();
    const start = this._last;
    const tick = (now) => {
      const dt = Math.max(0, Math.min(0.05, (now - this._last) / 1000)); // 첫 rAF 시각이 시작 시각보다 앞설 수 있다
      this._last = now;
      const waited = (now - start) / 1000;
      this.time += dt;
      this.director.titleFrame(this.time);
      this.rig._applyOverride();
      this.world.update(dt, this.engine.camera, { game: this, player: this.player });
      this.world.preRender(this.engine.camera);
      this.engine.render();
      const t = this.world.terrain;
      const prog = Math.min(1, (this.frames + 1) / 40) * (t.settled ? 1 : 0.85);
      bar.style.width = `${Math.round(prog * 100)}%`;
      this.frames++;
      this.settledFrames = t.settled ? this.settledFrames + 1 : 0;
      if ((this.settledFrames > 8 && this.frames > 30) || (this.settledFrames > 2 && waited > 8) || waited > 30) {
        msg.textContent = '';
        document.getElementById('boot').classList.add('hide');
        this.showTitle();
        requestAnimationFrame((tt) => this._frame(tt));
        return;
      }
      msg.textContent = t.settled ? '빛을 모으는 중…' : '세계를 그리는 중…';
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  showTitle() {
    this.mode = 'title';
    music.setMood('title');
    const auto = this.params.get('play');
    if (auto) { // 테스트·바로가기: ?play=new | ?play=continue
      if (auto === 'continue' && hasSave()) this.continueGame(); else this.newGame(auto !== 'intro'); // ?play=intro: 오프닝까지
      return;
    }
    this.ui.title({
      hasSave: hasSave(),
      onContinue: () => { audio.unlock(); this.continueGame(); },
      onNew: () => { audio.unlock(); this.newGame(); },
      onSettings: () => { audio.unlock(); this.ui.titleSettings(); },
    });
    const unlock = () => { audio.unlock(); removeEventListener('pointerdown', unlock); removeEventListener('keydown', unlock); };
    addEventListener('pointerdown', unlock);
    addEventListener('keydown', unlock);
  }

  newGame(skipIntro = false) {
    deleteSave();
    this.state = defaultState();
    this.services.applyState();
    this.ui.hideTitle();
    this.mode = 'intro';
    this.world.clock.frozen = false;
    this.world.clock.time = 0.655;
    this.player.teleport(this.state.player.x, this.state.player.y ?? undefined, this.state.player.z);
    this.player.state = 'ground'; // 착륙선 경사판 발치에 서서 시작
    this.player.yaw = this.state.player.yaw;
    this.player.canSkim = false;
    this.rig.yaw = this.player.yaw + Math.PI;
    this.rig.pitch = -0.12;
    this.ui.refreshButtons();
    const begin = () => {
      this.ui.fade(false);
      this.rig.override = null;
      const wake = this.params.has('nowake') ? (f) => f() : (f) => this.director.wake(f);
      wake(() => {
        this.mode = 'play';
        this.ui.setHud(true);
        this.ui.refreshButtons();
        this.quests.start('mq0', true);
        this.ui.refreshObjective();
        this._moaLater('…착륙 확인. 조종사님, 들리세요? 여기는 궤도의 라르크 호, 모아예요. 착륙선 안테나로 이어졌어요.', 0.3);
        this._moaLater('탐사복 카메라 화면이 잘 들어와요. 저 빛 표지가 우리를 여기로 이끌었어요 — 하늘의 고리, 승강줄, 2킬로미터짜리 탑들. 고등 문명이에요.', 6.0);
        this._moaLater('저는 배를 지키며 위에서 듣고 볼게요. 땅 위는 조종사님 혼자예요. …누군가 마중 나오고 있어요.', 13.0);
      });
    };
    this.ui.setHud(false);
    if (skipIntro) { begin(); return; }
    this.ui.fade(true, true);
    music.setMood('night');
    // 오프닝: 라르크 호가 세렌에 다가가고, 착륙선이 내려앉기까지 (approach.js)
    playApproach(this, begin);
  }

  continueGame() {
    const s = loadState();
    if (!s) { this.newGame(); return; }
    this.state = s;
    this.ui.hideTitle();
    this.world.clock.frozen = false;
    this.world.clock.time = s.clock;
    const p = s.player;
    this.player.teleport(p.x, p.y ?? undefined, p.z);
    this.player.yaw = p.yaw || 0;
    this.rig.yaw = (p.yaw || 0) + Math.PI;
    this._applyState();
    this.rig.override = null;
    this.mode = 'play';
    this.ui.setHud(true);
    this.ui.toast(`돌아왔어요 · 세렌의 ${this.world.clock.day + 1}일째`, { kind: 'quest' });
    // 옛 이야기로 저장한 판: 새 이야기의 알맞은 장으로 옮겼다고 알린다
    if (s.flags.storyMigrated) {
      const q = QUESTS[s.flags.storyMigrated];
      setTimeout(() => this.ui.toast('이야기가 새로 쓰였어요', { kind: 'quest', sub: `지금까지의 여정에 맞춰 「${q ? q.title : ''}」부터 이어 가요` }), 2600);
      delete s.flags.storyMigrated;
      this.save();
    }
  }

  /** 불러온 상태를 세계에 반영 */
  _applyState() {
    const s = this.state;
    this.player.canSkim = !!s.flags.skimmer;
    this.player.upgrades = { glide: 0, skim: 0, rise: 0, ...s.upgrades };
    for (const id of Object.keys(s.pylons)) { this.structures.awakenPylon(id, true); this.traffic.unlock(id, true); }
    for (const c of this.currents.list) {
      if (c.def.unlock && s.pylons[c.def.unlock]) c.setEnabled(true);
      if (s.flags['cur:' + c.id]) c.setEnabled(true);
    }
    if (s.flags.wellAwake && this.structures.wellAwake) this.structures.wellAwake(true);
    if (s.nameSong) { music.nameSong = s.nameSong; music.nameSongChance = 0.3; }
    if (s.flags.festival) this.world.sky.hoopMat.uniforms.uLights.value = 2.4;
    this.world.sky.setFarBright(awakenedCount(s, true) / 4);
    if (s.flags.worldChorus) this.worldChorus(true);
    this.mapData.load(s.reveal);
    if (s.flags['pickups:sled']) this.discovery.spawnPickups('sled');
    for (const [id, pos] of Object.entries(s.flags.npcPos || {})) this.npcs.goTo(id, pos[0], pos[1], { instant: true });
    this.requests.active = s.flags.requests || [];
    // 우리 집: 건물 번호는 화질(건물 밀도)에 따라 달라질 수 있어, 저장된 자리에서 가장 가까운 살림집으로 다시 찾는다
    if (s.home != null && s.homeAt && this.city) {
      const r = this.city.recs[s.home];
      if (!r || Math.hypot(r.x - s.homeAt[0], r.z - s.homeAt[1]) > 3) {
        let best = null, bd = Infinity;
        for (const q of this.city.recs) { if (q.use !== 'home') continue; const d = Math.hypot(q.x - s.homeAt[0], q.z - s.homeAt[1]); if (d < bd) { bd = d; best = q; } }
        if (best) s.home = best.id;
      }
    }
    // 1부를 끝낸 옛 저장: 2부(바다 건너)를 이어서 시작
    if (this.quests.isDone('mq5') && !this.quests.isActive('mq6') && !this.quests.isDone('mq6')) this.quests.start('mq6', true);
    this.transit.refresh();
    this.services.applyState();
    this.ui.refreshButtons();
    this.ui.refreshObjective();
    this.updateWaypoint();
  }

  save(force = false) {
    if (this.mode === 'title' || this.mode === 'boot' || this.mode === 'intro') return;
    const s = this.state;
    const p = this.player;
    if (p.state !== 'current' && p.state !== 'lift' && p.state !== 'down' && p.state !== 'ride') s.player = { x: p.pos.x, y: p.pos.y > 20000 && p.state === 'ground' ? p.pos.y + 0.5 : null, z: p.pos.z, yaw: p.yaw };
    const safe = this.interiors && this.interiors.safeSpot();
    if (safe) s.player = { x: safe.x, y: null, z: safe.z, yaw: p.yaw };
    s.clock = this.world.clock.time;
    s.upgrades = { ...p.upgrades };
    s.reveal = this.mapData.serialize();
    const np = {};
    for (const n of this.npcs.list) if (!n.ambient && n.moved) np[n.id] = [n.home.x, n.home.z];
    s.flags.npcPos = np;
    saveState(s);
    if (force) this.saveT = 30;
  }

  setQuality(name) {
    this.engine.setQuality(name);
    this.world.terrain.lodFactor = this.engine.q.lod;
  }

  setMode(m) {
    this.mode = m;
    document.body.classList.toggle('busy', m !== 'play');
    this.input.wantLock = m === 'play';
    if (m !== 'play' && document.pointerLockElement) document.exitPointerLock?.();
  }

  // ── 반복 ─────────────────────────────────
  _frame(now) {
    const dt = Math.min(0.05, Math.max(0.0005, (now - this._last) / 1000));
    this._last = now;
    this.time += dt;
    try { this.update(dt); } catch (e) { console.error(e); }
    requestAnimationFrame((t) => this._frame(t));
  }

  /** 렌더링 없이 시뮬레이션만 한 걸음 (자동 테스트용) */
  /** 분수 연못 속을 걷기: 느려지고, 둘레로 물결이 퍼지고, 첨벙 소리 (물은 밟히지 않는다 — 연못 테만 단단하다) */
  _wading(dt) {
    const p = this.player;
    if ((this._wadeT = (this._wadeT || 0) - dt) < 0) { this._wadeT = 0.12; this._fount = this.city && !this.interiors.inPocket ? this.city.fountainAt(p.pos.x, p.pos.z) : null; }
    const F = this._fount;
    const inW = !!F && p.pos.y < F.y - 0.05 && (p.state === 'ground' || p.state === 'air');
    p.wade = (p.wade || 0) + ((inW ? 1 : 0) - (p.wade || 0)) * Math.min(1, dt * 6);
    const U = fountainWaterMaterial().uniforms.uWade.value;
    if (inW) U.set(p.pos.x, p.pos.z, Math.min(1, 0.25 + p.hspeed / 5), 0);
    else U.z = Math.max(0, U.z - dt * 0.8);
    if (inW && !this._wasWade && audio.ready) audio.noise({ freq: 900, q: 0.6, dur: 0.55, gain: 0.16, type: 'bandpass', sweep: 260, pos: p.pos });
    if (inW && p.hspeed > 0.8 && p.state === 'ground' && (this._splashT = (this._splashT || 0) - dt) < 0) {
      this._splashT = Math.max(0.24, 0.45 - p.hspeed * 0.03);
      if (audio.ready) audio.noise({ freq: 1300 + Math.random() * 600, q: 0.9, dur: 0.16, gain: 0.06, type: 'bandpass', pos: p.pos });
    }
    this._wasWade = inW;
  }

  updateSim(dt) {
    this.input.poll(dt);
    this.player.update(dt, this.input, this.rig);
    this.input.endFrame();
  }

  update(dt) {
    const input = this.input;
    input.poll(dt);
    const mode = this.mode;
    if (mode === 'title') {
      this.director.titleFrame(this.time);
      this.rig._applyOverride();
      this.npcs.update(dt);
    } else {
      this._handleInput(dt);
      const free = mode === 'play' && !this.director.active;
      const steps = Math.max(1, Math.ceil(dt / (1 / 60)));
      const h = dt / steps;
      const prev = this.player.pos.clone();
      this._frameEvents = [];
      for (let i = 0; i < steps; i++) {
        if (this.player.state !== 'down') this.player.update(h, free ? input : NO_INPUT, this.rig);
        this.citizens.pushPlayer(this.player.pos);
        this.npcs.pushPlayer(this.player.pos);
        if (i < steps - 1) input.down.clear();
        this._playerEvents();
        this._frameEvents.push(...this.player.events);
      }
      this._stats(prev);
      this.avatar.update(dt, this.player);
      this._wading(dt);
      this.comm.update(dt);
      this.structures.aimAntenna(this.comm.shipDir(), this.comm.pulseK, this.time);
      playerUniform.value.copy(this.player.pos);
      this.rig.update(dt, free ? input : NO_INPUT, this.player);
      if (!this.rig.override) this.interiors.clampCamera(this.engine.camera, this.rig.smoothTarget);
      if (mode === 'dialogue' && this.dialogue.active && this.dialogue.active.npc) this._dialogueCam(dt);
      else this._dlgCam = null;
      if (this.player.state === 'ride' && this.player.ride) {
        const r = this.player.ride;
        if (mode === 'play' && (input.pressed('jump') || input.pressed('interact'))) r.skip();
        this.rig.override = r.cam;
        this.rig._applyOverride();
        this.rig.override = null;
      }
      this.avatar.root.visible = !this._hideAvatar && (this.player.state !== 'ride' || !!(this.player.ride && this.player.ride.showAvatar));
      this.director.update(dt);
      this._effects(dt);
      this.dialogue.update(dt);
      this.resonance.update(dt);
      this.discovery.update(dt);
      this.npcs.update(dt);
      if (mode === 'play' || mode === 'dialogue') this.quests.update(dt);
      this.events.update(dt);
      this.requests.update(dt);
      this.services.update(dt);
      this.interiors.update(dt);
      this.venues.update(dt);
      this.outdoors.update(dt);
      this.citizens.update(dt);
      if ((this._scanT = (this._scanT || 0) - dt) < 0) { this._scanT = 0.5; this._techScan(); }
      this._hud(dt);
      this.mapData.reveal(this.player.pos.x, this.player.pos.z, 450 + Math.max(0, this.player.pos.y - this.player.groundH) * 2);
      this.state.playTime += dt;
      this.saveT -= dt;
      if (this.saveT <= 0 && mode === 'play') { this.save(); this.saveT = 30; }
    }
    this.mapData.step(this.mode === 'menu' ? 6 : 1.2);
    this.world.update(dt, this.engine.camera, { game: this, player: this.player });
    this._atmosphereByPlace(dt);
    if (this.engine.bloom) this.engine.bloom.strength = 0.42 - 0.13 * this.world.atmos.state.night; // 밤 번짐을 덜
    this.world.preRender(this.engine.camera);
    this._audio(dt);
    this.engine.render();
    this.engine.adapt(dt);
    input.endFrame();
    this.frames++;
    this.settledFrames = this.world.terrain.settled ? this.settledFrames + 1 : 0;
  }

  // ── 입력 ─────────────────────────────────
  _handleInput() {
    const i = this.input;
    const m = this.mode;
    // 모아와 이야기하는 중: 글자 입력은 모아 창이 받는다. Esc·T 로 닫기
    if (m === 'moa') { if (i.pressed('pause') || i.pressed('moa')) this.moaAI.close(); return; }
    if (i.pressed('moa') && m === 'play' && !this.director.active) { this.moaAI.open(); return; }
    if (i.pressed('pause')) {
      if (this.ui.menuEl) this.ui.closeMenu();
      else if (m === 'card') this.ui.closeCard();
      else if (m === 'play') this.ui.openMenu('settings');
      return;
    }
    if (i.pressed('map')) { if (this.ui.menuEl && this.ui.menuTab === 'map') this.ui.closeMenu(); else if (m === 'play' || m === 'menu') this.ui.openMenu('map'); }
    if (i.pressed('journal')) { if (this.ui.menuEl && this.ui.menuTab === 'journal') this.ui.closeMenu(); else if (m === 'play' || m === 'menu') this.ui.openMenu('journal'); }
    if (i.pressed('hud')) this.ui.setHud(this.ui.hud.classList.contains('off'));
    if (m === 'intro' && (i.pressed('jump') || i.pressed('interact') || i.pressed('confirm'))) this.director.skip();
    if (m === 'dialogue') {
      if (i.pressed('interact') || i.pressed('jump') || i.pressed('confirm') || i.pressed('click')) this.dialogue.next();
      return;
    }
    if (m === 'card') { if (this.ui.cardKeys !== false && (i.pressed('interact') || i.pressed('confirm') || i.pressed('jump'))) this.ui.closeCard(); return; }
    if (m !== 'play' || this.director.active) return;
    if (this.player.state === 'down') {
      if (i.move.x || i.move.y || i.pressed('jump') || i.pressed('interact') || i.pressed('tap') || i.pressed('click')) {
        this.player.setState('ground');
        this.avatar.landSquash = 1;
        audio.noise({ freq: 300, dur: 0.3, gain: 0.2 });
      }
      return;
    }
    for (let n = 0; n < 5; n++) {
      if (!i.pressed('tone' + (n + 1))) continue;
      if (this._composing) {
        if (this.state.tones.includes(n)) { audio.tone(n, { gain: 0.5 }); this.ui.composeNote(n); this.ui.flashTone(n); }
      } else { this.resonance.play(n); this.ui.flashTone(n); }
    }
    if (i.pressed('interact') && this._target) this._interact(this._target);
    if (i.pressed('skimmer') && !this.state.flags.skimmer) this.ui.toast('아직 탈것이 없어요', { kind: 'muted' });
  }

  // ── 상호작용 ───────────────────────────────
  _findTarget() {
    const p = this.player.pos;
    if (this.player.state === 'fly') {
      const dock = this.facilities.list.some((F) => F.type === 'dock' && Math.hypot(F.x - p.x, F.z - p.z) < 60 && Math.abs(F.y + F.padY - p.y) < 30);
      return { kind: 'unfly', label: dock ? '나룻배 돌려주기' : '나룻배에서 내리기', short: '내리기' };
    }
    const act = this.citizens.activityTarget(p);
    if (act) return act;
    const inside = this.interiors.target(p);
    if (inside && (inside.kind !== 'door' || inside.dist < 2.6)) return inside; // 문 바로 앞이면 문이 먼저 (옆 조작대·주민보다)
    const ven = this.venues.target(p);
    if (ven) return ven;
    const out = this.interiors.inPocket ? null : this.outdoors.target(p);
    if (out) return out;
    const npc = this.npcs.nearest(p, 5.5, (n) => !n.ambient);
    if (npc && npc.service === 'lobby') return { kind: 'lobby', o: npc, label: '안내지기 · 이 건물 이야기', short: '안내' };
    if (npc && npc.service) { const F = this.facilities.byId.get(npc.service); return { kind: 'facility', o: F, label: `${F.info.keeper} · ${F.info.verb}`, short: F.info.name }; }
    if (npc) return { kind: 'npc', o: npc, label: `${npc.name}와(과) 마주하기`, short: '말 걸기' };
    const cit = this.citizens.target(p);
    if (cit) return cit;
    const fa = this.fauna && this.fauna.target(p);
    if (fa) return fa;
    const ld = this.structures.landerTarget && this.structures.landerTarget(p);
    if (ld) return ld;
    if (inside) return inside;
    const el = this.anchor.stopNear(p);
    if (el) return { kind: 'elevator', o: el, label: el.up ? (this.elevatorOpen() ? '승강차 · 하늘닻으로 오르기 (30 km)' : '승강차 (아직 멈춰 있다)') : '승강차 · 척추 전망대로 내려가기', short: '승강차' };
    const d = this.discovery.nearestInteract(p);
    if (d) return d;
    const st = this.transit.nearest(p);
    if (st) return { kind: 'station', o: st, label: `빛길 · ${st.name}`, short: '빛길' };
    return null;
  }

  _interact(t) {
    if (t.kind === 'npc') return this.talkTo(t.o);
    if (t.kind === 'citizen') return this.citizens.open(t.o);
    if (t.kind === 'fauna') return this.fauna.interact(t.o);
    if (t.kind === 'lander') return this.landerUse(t.o.kind);
    if (t.kind === 'cit-act') return this.citizens.activityInteract(t);
    if (t.kind === 'facility') { this.focusOn(t.o.npc); return this.services.open(t.o); }
    if (t.kind === 'unfly') return this.services.endFly();
    if (t.kind === 'door') return this.interiors.enter(t.o);
    if (t.kind === 'venue') return this.venues.use(t);
    if (t.kind === 'outdoor') return this.outdoors.use(t);
    if (t.kind === 'exit') return this.interiors.exit();
    if (t.kind === 'lift') return this.interiors.up();
    if (t.kind === 'liftdown') return this.interiors.down();
    if (t.kind === 'lobby') { this.focusOn(t.o); return this.interiors.talk(); }
    if (t.kind === 'station') { if (this.tips.first('transit', () => this.stationCard(t.o))) return; return this.stationCard(t.o); }
    if (t.kind === 'elevator') return this.rideElevator(t.o.up);
    if (t.kind === 'deck' && this.quests.step('mq4')?.type === 'compose') {
      if (this.world.atmos.state.night > 0.5) return this.startCompose();
      this.ui.moa('하우는 밤에 노래를 보내라고 했어요. 메뉴에서 쉬면서 밤을 기다려요.');
      return;
    }
    this.discovery.interact(t);
  }

  /** 착륙선 선실: 교신 단말·별지도·표본함·일지 */
  landerUse(kind) {
    const s = this.state, ui = this.ui;
    if (kind === 'door') { this.interiors.enterCabin(this.structures.lander); return; }
    if (kind === 'term') { this.moaAI.open(); this.moaAI.note('(착륙선 교신 단말) 여기선 신호가 제일 깨끗해요. 라르크 호는 지금도 궤도를 돌고 있어요.'); return; }
    if (kind === 'map') {
      ui.serviceCard('라르크 호 · 별지도', '우리가 지나온 길과, 아직 가 보지 않은 별들', '탁자 위 빛 지도. 고향 쪽 항로와 우르 둘레, 그리고 모아가 표시해 둔 별 몇 개.', [{ label: '닫기', primary: true }],
        `<div class="svc-list">
          <div class="svc-row"><b>◉ 세렌</b> — 우르를 도는 위성. 지금 여기. 신호가 시작된 곳.</div>
          <div class="svc-row"><b>◌ 우르</b> — 세렌이 도는 가스행성. 고리 너머로 보인다.</div>
          <div class="svc-row"><b>? 잿빛 고리별</b> — 항로 바깥쪽. 고리가 둘인 행성. 모아: 「신호는 없지만, 반사광이 이상해요.」</div>
          <div class="svc-row"><b>? 쌍둥이 얼음별</b> — 서로를 도는 두 얼음 행성. 아직 아무도 가 보지 않았다.</div>
          <div class="svc-row"><b>? 세렌이 노래를 보낸 쪽</b> — 아웬의 옛 노래가 향한 별자리. 언젠가 대답이 그쪽에서 올지도.</div>
        </div><p class="muted">모아: 「라르크 호의 연료와 기록 장치는 아직 넉넉해요. 세렌에서 할 일을 다 하면… 그다음은 그때 생각해요.」</p>`);
      if (!s.flags.starmapSeen) { s.flags.starmapSeen = true; this.save(); }
      return;
    }
    if (kind === 'samples') {
      const have = [['세렌의 흙', true], ['빛갈대 씨앗', !!(s.codex && s.codex.reed)], ['노래수정 조각', (s.inv && s.inv.shard) > 0]];
      ui.serviceCard('표본함', '여섯 칸 — 세렌 칸과, 아직 빈 다른 별의 칸', '탐사선이 처음부터 싣고 온 표본함. 칸마다 다른 별의 이름표 자리가 비어 있다.', [{ label: '닫기', primary: true }],
        `<div class="svc-list">${have.map(([n, ok]) => `<div class="svc-row">${ok ? '●' : '○'} 세렌 · ${n}${ok ? '' : ' — 아직'}</div>`).join('')}
          <div class="svc-row">○ (이름표 없음) — 다른 별</div><div class="svc-row">○ (이름표 없음) — 다른 별</div><div class="svc-row">○ (이름표 없음) — 다른 별</div></div>
        <p class="muted">모아: 「빈 칸이 셋이나 남았네요. 처음 설계할 때부터 한 별로 끝날 여행이 아니었던 거죠.」</p>`);
      return;
    }
    if (kind === 'log') {
      const day = this.world.clock.day + 1;
      ui.serviceCard('탐사 일지', `라르크 호 · 착륙 ${day}일째`, '착륙선 화면에 모아가 남긴 기록.', [{ label: '닫기', primary: true }],
        `<div class="svc-list"><div class="svc-row">· 312일의 항해 끝에 세렌 궤도 진입. 들판의 빛 표지 확인.</div>
        <div class="svc-row">· 조종사 단독 착륙. 모아는 라르크 호에 남아 착륙선 안테나로 교신.</div>
        <div class="svc-row">· 배운 아웬 말 ${Object.keys(s.vocab || {}).length}개 · 얻은 음 ${s.tones.length}개 · 노래하는 탑 ${Object.keys(s.pylons).length}</div>
        ${s.home != null ? '<div class="svc-row">· 하모네아에 집이 생김. 「손님」이 아니라 「이웃」.</div>' : ''}</div>`);
    }
  }

  talkTo(n) {
    const convo = this.quests.talkFor(n.id) || this.extraTalk(n.id);
    if (convo) this.dialogue.start(convo, n);
  }

  /** 퀘스트 밖의 대화 (지역 지기, 미르, 온 등). checkOnly 면 「!」 표시 여부만 */
  extraTalk(id, checkOnly = false) {
    const s = this.state;
    const keeperPylon = Object.keys(KEEPERS).find((k) => KEEPERS[k] === id);
    if (this.requests.hasVisit(id)) {
      if (checkOnly) return true;
      return id === 'hau' ? 'hau-pylon' : keeperPylon ? (s.pylons[keeperPylon] ? 'keeper-awake' : 'keeper-silent') : id === 'mir' ? 'mir-1' : id === 'on' ? 'on-seeds' : 'iel-idle';
    }
    if (checkOnly) return id === 'mir' && !this.quests.isActive('sq_mir') && !this.quests.isDone('sq_mir') && this.quests.isDone('mq2');
    if (keeperPylon) {
      const own = { soel: 'soel-1', ruon: 'ruon-1', tar: s.pylons[keeperPylon] ? 'tar-2' : 'tar-1', vei: 'vei-1', narin: 'narin-1', kael: 'kael-1', moru: 'moru-1', yuha: 'yuha-1', peon: 'peon-1' }[id];
      if (!s.flags['met:' + id]) { s.flags['met:' + id] = true; return own; }
      const far = ['kael', 'moru', 'yuha', 'peon'].includes(id);
      if (far) return s.pylons[keeperPylon] ? 'farkeeper-awake' : own;
      return s.pylons[keeperPylon] ? 'keeper-awake' : 'keeper-silent';
    }
    if (id === 'sol') return this.quests.isDone('mq8') ? 'sol-idle' : 'sol-wait';
    if (id === 'mir') {
      if (!this.quests.isActive('sq_mir') && !this.quests.isDone('sq_mir')) { this.quests.start('sq_mir'); return this.quests.talkFor('mir'); }
      return 'mir-1';
    }
    if (id === 'on') {
      if (s.flags.skimmer) { this._afterConvo = () => this.upgradeCard(); return 'on-seeds'; }
      return 'on-sled';
    }
    if (id === 'hau') return Object.keys(s.pylons).length ? 'hau-pylon' : this.quests.isDone('mq2b') ? 'hau-towers' : this.quests.isDone('mq2') ? 'hau-wait' : 'hau-first';
    if (id === 'iel') return 'iel-idle';
    return null;
  }

  /** 빛길 역: 갈 곳 고르기 */
  stationCard(S) {
    const T = this.transit;
    T.refresh();
    if (!S.open) {
      const L = T.lines.find((l) => l.id === S.line);
      this.ui.toast(`${L.name}은 멈춰 있다`, { kind: 'muted', sub: L.unlock.startsWith('quest:') ? '썰매를 고친 뒤에 다시 와 보자' : '그 지방의 공명탑이 노래하면 다시 달린다' });
      return;
    }
    const dests = T.stations.filter((d) => d !== S && d.open);
    const html = `<div class="dests">${dests.map((d, i) => `<button class="btn" data-dest="${i}">${d.name}</button>`).join('')}</div>`;
    this.ui.infoCard('빛길', S.name, '관 속의 캡슐이 하모네아를 도는 고리선과 여섯 갈래로 세렌을 잇는다. 어디로 갈까?');
    const card = document.querySelector('.card');
    const box = document.createElement('div');
    box.innerHTML = html;
    card.insertBefore(box, card.lastElementChild);
    box.querySelectorAll('[data-dest]').forEach((b) => b.addEventListener('click', () => {
      const D = dests[+b.dataset.dest];
      this.ui.closeCard();
      this.startRide(S, D);
    }));
  }

  elevatorOpen() { return this.quests.isDone('mq2') || !!this.state.flags.elevator; }

  /** 척추의 승강차: 전망대 ↔ 하늘닻(30 km) */
  rideElevator(up) {
    if (up && !this.elevatorOpen()) { this.ui.toast('승강차가 멈춰 있다', { kind: 'muted', sub: '하모네아의 노래지기를 먼저 만나 보자' }); return; }
    const ride = this.anchor.makeRide(up, (wentUp) => {
      this.rig.override = null;
      if (wentUp) {
        const first = !this.state.discovered.anchor;
        this.state.discovered.anchor = Date.now();
        this.state.flags.anchorVisit = true;
        bus.emit('flag', 'anchorVisit');
        this.scan('anchor');
        this.ui.regionTitle('하늘닻', '고도 30 km · 공기가 거의 없다. 세렌이 둥글게 휘어 보인다.', first);
        if (first) setTimeout(() => this.ui.moa(MOA.anchor || '고도 30킬로미터. 저 아래 조각들이 전부 우리가 걸어온 곳이에요. 그리고 바다 건너… 땅이 더 있어요.'), 3500);
      }
      this.save();
    });
    this.player.enterRide(ride);
    audio.noise({ freq: 120, q: 0.6, dur: 4, gain: 0.8, type: 'lowpass', attack: 0.8 });
    audio.chime('soft');
  }

  startRide(A, B) {
    const ride = this.transit.makeRide(A, B, (S) => {
      this.rig.override = null;
      this.ui.regionTitle(S.name, '빛길에서 내렸다', false);
      this.save();
    });
    this.player.enterRide(ride);
    audio.noise({ freq: 500, q: 0.6, dur: 2.5, gain: 0.5, type: 'bandpass', sweep: 1600, attack: 0.6 });
    audio.chime('soft');
  }

  /** 온 세계의 노래: 고리 전체에 불이 켜지고, 먼 척추들이 빛나고, 하늘길이 모두 열린다 */
  worldChorus(instant = false) {
    this.state.flags.worldChorus = true;
    const sky = this.world.sky;
    sky.hoopMat.uniforms.uLights.value = 3.4;
    sky.setFarBright(1.5);
    for (const l of this.traffic.lanes) if (l.unlock) l.enabled = true;
    if (instant) return;
    music.setMood('night');
    audio.chime('quest');
    this.rig.shake(0.2);
    const notes = this.state.nameSong || [0, 2, 4, 2, 0, 4];
    notes.forEach((n, i) => setTimeout(() => audio.tone(n, { gain: 0.7, wet: 0.9, octave: -1 }), 1500 + i * 700));
    setTimeout(() => this.ui.regionTitle('온 세계의 노래', '고리의 끝에서 끝까지, 네 이름이 울린다.', true), 1200);
  }

  /** 아웬의 기술을 처음 가까이서 볼 때: 도감 + 모아의 말 */
  _techScan() {
    const p = this.player.pos, s = this.state;
    const seen = (id, moaKey) => { if (s.codex[id]) return; this.scan(id); if (moaKey && MOA[moaKey]) setTimeout(() => this.ui.moa(MOA[moaKey]), 1600); };
    for (const v of this.traffic.vessels) {
      if (v.type !== 'liner' || v.lane.vis < 0.5) continue;
      if (v.pos.distanceToSquared(p) < 900 * 900) { seen('liner', 'seeLiner'); break; }
    }
    const sp = this.megacity.starport;
    if (sp && Math.hypot(p.x - sp.x, p.z - sp.z) < 1800 && this.traffic.shuttles.some((x) => x.mode === 'launch')) seen('shuttle', 'seeLaunch');
    for (const d of this.megacity.districts) if (Math.hypot(p.x - d.x, p.z - d.z) < 1400) { seen('arcology', 'seeArcology'); break; }
    if (this.transit.nearest(p, 60)) seen('lightrail');
    for (const d of this.drones.list) if (d.curious > 0 && d.pos.distanceToSquared(p) < 15 * 15) { seen('drone', 'seeDrone'); break; }
    for (const w of this.colossi.list) if (Math.hypot(p.x - w.pos.x, p.z - w.pos.z) < 1500) { seen('colossus', 'seeColossus'); break; }
    const fl = this.farlands;
    if (fl.core && Math.hypot(p.x - fl.core.x, p.z - fl.core.z) < 900) seen('core', 'seeCore');
    if (fl.ear && Math.hypot(p.x - fl.ear.x, p.z - fl.ear.z) < 900) seen('greatear');
    if (fl.forge && Math.hypot(p.x - fl.forge.x, p.z - fl.forge.z) < 900 && p.y > 1500) seen('forge');
  }

  upgradeCard() {
    const s = this.state, p = this.player;
    const opts = [
      { k: 'glide', name: '날개 다듬기', desc: '활공이 더 멀리, 더 빠르게', max: 3 },
      { k: 'skim', name: '썰매 공명 강화', desc: '썰매 최고 속도 +12%', max: 3 },
      { k: 'rise', name: '솟음 증폭', desc: '공중에서 「솟음」을 한 번 더', max: 2 },
    ];
    const cost = (lv) => [3, 5, 8][lv] ?? 99;
    const html = opts.map((o) => {
      const lv = p.upgrades[o.k] || 0;
      const c = cost(lv);
      const can = lv < o.max && s.inv.starseed >= c;
      return `<div class="qitem" style="text-align:left"><div class="qt">${o.name} <small style="color:var(--ink-dim)">${lv}/${o.max}</small></div><div class="qs">${o.desc}</div>${lv < o.max ? `<button class="btn" data-up="${o.k}" ${can ? '' : 'disabled'} style="margin-top:8px">별씨 ${c}개로 손보기</button>` : '<div class="qs" style="color:var(--teal)">최고 단계</div>'}</div>`;
    }).join('');
    this.ui.infoCard('장인 온의 작업대', `가진 별씨 ${s.inv.starseed}개`, '별비가 내리는 밤에 떨어진 별씨를 모아 오세요.');
    const card = document.querySelector('.card');
    const box = document.createElement('div');
    box.innerHTML = html;
    card.insertBefore(box, card.lastElementChild);
    box.querySelectorAll('[data-up]').forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.up;
      const lv = p.upgrades[k] || 0;
      if (s.inv.starseed < cost(lv)) return;
      s.inv.starseed -= cost(lv);
      p.upgrades[k] = lv + 1;
      s.upgrades = { ...p.upgrades };
      audio.chime('quest');
      this.ui.closeCard();
      this.ui.toast('장비를 손봤다', { kind: 'item' });
      this.save();
    }));
  }

  /** 아웬이 말한다: 노래 + 자막 + 학습. 반환: 노래 길이(초) */
  say(npc, line, ambient) {
    const notes = this.lang.notesOf(line);
    const pos = npc ? { x: npc.pos.x, y: npc.pos.y + 3, z: npc.pos.z } : null;
    const pitch = npc && npc.scale && npc.scale < 0.8 ? 1.5 : npc && npc.id === 'hau' ? 0.75 : 1;
    const dur = audio.sing(notes, { pos, gain: ambient ? 0.22 : 0.34, pitch }) || notes.length * 0.2;
    if (npc) npc.fig.speak(dur);
    this.lang.hear(line, npc ? npc.id : null);
    if (ambient) this.ui.say(npc && !npc.ambient ? npc.name : '지나가는 아웬', this.lang.render(line, { size: 22 }));
    return dur;
  }

  giveTone(n) {
    if (this.state.tones.includes(n)) return;
    this.state.tones.push(n);
    this.state.tones.sort();
    this.lang.learn(['rise', 'open', 'flow', 'light', 'still'][n], 'teach', true);
    this.ui.refreshButtons();
    this.ui.flashTone(n);
    audio.chime('quest');
    this.ui.toast(`새 공명 음 · 「${['솟음', '열림', '흐름', '빛', '고요'][n]}」 (${n + 1})`, { kind: 'word' });
  }

  /** 이야기 깃발 세우기 (퀘스트의 flag 단계가 듣는다) */
  setFlag(k, v = true) {
    if (this.state.flags[k] === v) return;
    this.state.flags[k] = v;
    bus.emit('flag', k);
  }

  giveItem(k, n = 1) {
    this.state.inv[k] = (this.state.inv[k] || 0) + n;
    if (k === 'starseed') this.ui.toast(`별씨 +${n} (모두 ${this.state.inv.starseed})`, { kind: 'item' });
  }

  scan(id) {
    if (this.state.codex[id]) return;
    this.state.codex[id] = true;
    const c = CODEX[id];
    if (!c) return;
    this.ui.toast(`도감 · ${c.name}`, { kind: 'word', sub: '일지의 「도감」에 기록했어요' });
    if (c.word) this.lang.learn(c.word, 'scan');
    audio.chime('word');
  }

  journalNote(text) {
    const j = this.state.journal;
    if (j[j.length - 1] === text) return;
    j.push(text);
    if (j.length > 80) j.shift();
  }

  _moaLater(text, delay) { setTimeout(() => this.ui.moa(text), delay * 1000); }

  // ── 공명탑 ─────────────────────────────────
  awakenPylon(id) {
    const P = this.structures.pylons.get(id);
    if (!P || this.state.pylons[id]) return;
    this.state.pylons[id] = true;
    const count = awakenedCount(this.state, !!P.great);
    this.structures.awakenPylon(id);
    audio.chime('pylon');
    this.setMode('cinematic');
    this.director.pylon(P, () => {
      this.setMode('play');
      this.ui.regionTitle(P.place.name, '듣던 탑이 노래로 대답한다. 땅이 함께 울린다.', true);
      for (const c of this.currents.list) if (c.def.unlock === id) { c.setEnabled(true); this.ui.toast(`해류가 다시 흐른다 · ${c.def.name}`, { kind: 'done' }); }
      if (!P.great && count <= PYLON_TONES.length) this.giveTone(PYLON_TONES[count - 1]);
      const keeper = KEEPERS[id];
      const kn = keeper && this.npcs.get(keeper);
      if (kn && !P.great) { this.npcs.goTo(keeper, P.x + 18, P.z + 12); kn.moved = true; }
      this.state.harmony[P.place.region] = Math.max(this.state.harmony[P.place.region] || 0, 60);
      const lines = [
        '탑이 노래하는 쪽으로 돌아섰어요! 주변의 빛이 살아나고… 그 지방 빛길 갈래선과 하늘길이 다시 열렸어요.',
        '두 번째 탑이에요. 새 음도 받았어요. 지나가던 주민들이 우리한테 인사해요.',
        '세 번째예요. 하우가 우리를 부르는 것 같아요. 하모네아의 척추로 돌아가 봐요.',
        '네 번째. 세렌이 조금씩 더 크게 울려요.',
        '다섯 탑이 모두 노래해요! 하우에게 가요.',
      ];
      const greatLines = [
        '큰 탑이 노래해요! 저 빛기둥… 고리까지 닿았어요. 척추 하나가 귀에서 목소리로 바뀌었어요.',
        '두 번째 큰 탑. 바다 건너 하늘길이 다시 열려요. 배들이 오는 게 보여요.',
        '세 번째예요. 고리의 불빛이 점점 이어져요.',
        '네 큰 탑이 모두 노래해요! 하늘닻의 솔에게 가요.',
      ];
      if (P.great) this.world.sky.setFarBright(count / 4);
      this.ui.moa(P.great ? greatLines[Math.min(count, 4) - 1] : lines[Math.min(count, lines.length) - 1]);
      bus.emit('awaken', { id, count, great: !!P.great });
      this.save(true);
    });
  }

  // ── 조망점 ─────────────────────────────────
  vista(id, v) {
    const first = !this.state.vistas[id];
    this.state.vistas[id] = true;
    const deck = id === 'spine-deck';
    this.mapData.reveal(v.x, v.z, deck ? 16000 : 3500);
    this.setMode('cinematic');
    const name = v.place ? v.place.name : '조망점';
    const reg = this.world.regionAt(v.x, v.z);
    this.director.vista({ x: v.x, y: v.y, z: v.z, deck }, name, deck ? '세렌의 모든 땅이 내려다보인다.' : reg.name, () => {
      this.setMode('play');
      if (first) this.ui.toast(deck ? '지도가 넓게 밝혀졌다' : '지도의 주변이 밝혀졌다', { kind: 'place' });
      if (first && deck) this.ui.moa('빛기둥이 꺼진 곳들이 보여요. 지도에 표시해 둘게요.');
      this.save();
    });
  }

  // ── 이름 노래 ──────────────────────────────
  startCompose() {
    this._composing = true;
    this.ui.moa('여섯 음을 골라 주세요. 조종사님만의 노래예요.');
    this.ui.compose((notes) => {
      this._composing = false;
      this.state.nameSong = notes;
      music.nameSong = notes;
      music.nameSongChance = 0.3;
      this.setMode('cinematic');
      this.director.sendSong(notes, () => {
        this.setMode('play');
        this.structures.tetherPulse = 0;
        this.save(true);
      });
    });
  }

  rest(frac) {
    this.ui.fade(true);
    setTimeout(() => {
      this.world.clock.skipTo(frac);
      this.ui.fade(false);
      this.ui.toast(`${this.world.clock.timeLabel()} · 세렌의 ${this.world.clock.day + 1}일째`);
    }, 1300);
  }

  focusOn(npc) {
    const p = this.player;
    p.yaw = Math.atan2(npc.pos.x - p.pos.x, npc.pos.z - p.pos.z);
    p.vel.set(0, 0, 0);
    npc.fig.look = p.pos;
  }

  /** 대화 카메라: 플레이어 어깨 너머로 상대를 비춘다 */
  _dialogueCam(dt) {
    const n = this.dialogue.active.npc;
    const p = this.player.pos;
    const dx = n.pos.x - p.x, dz = n.pos.z - p.z;
    const d = Math.hypot(dx, dz) || 1;
    const fx = dx / d, fz = dz / d;
    const sx = -fz, sz = fx;
    const s = n.scale || 1;
    const pos = new THREE.Vector3(p.x - fx * 3.6 + sx * 1.6, p.y + 2.3, p.z - fz * 3.6 + sz * 1.6);
    const gh = this.world.heightAt(pos.x, pos.z) + 0.8;
    if (pos.y < gh) pos.y = gh;
    const look = new THREE.Vector3(n.pos.x, n.pos.y + 2.4 * s, n.pos.z);
    if (!this._dlgCam) this._dlgCam = { pos: this.engine.camera.position.clone(), look: look.clone() };
    const k = Math.min(1, dt * 3);
    this._dlgCam.pos.lerp(pos, k);
    this._dlgCam.look.lerp(look, k);
    this.rig.override = { pos: this._dlgCam.pos, look: this._dlgCam.look };
    this.rig._applyOverride();
    this.rig.override = null;
  }

  /** 움직임의 손맛: 먼지·물보라·날개 궤적·반짝임 */
  _effects(dt) {
    const p = this.player;
    const P = this.particles;
    const reg = this._regionCache && this.frames % 15 ? this._regionCache : (this._regionCache = this.world.regionAt(p.pos.x, p.pos.z));
    const dust = reg ? reg.pal.soil : 0xb0a090;
    for (const e of this._frameEvents || []) {
      if (e === 'land') {
        const k = Math.min(1, (p.impact || 4) / 18);
        P.emit({ pos: p.pos, count: 6 + Math.round(k * 16), spread: 2 + k * 4, flat: true, up: 1.5, life: 0.9, size: [0.6, 2.2 + k * 2], color: dust, alpha: 0.35 + k * 0.3, drag: 3, gravity: 1, radius: 0.6 });
      }
      if (e === 'jump') P.emit({ pos: p.pos, count: 5, spread: 1.4, flat: true, life: 0.6, size: [0.4, 1.4], color: dust, alpha: 0.3, drag: 3 });
      if (e === 'splash') P.emit({ pos: p.pos, count: 26, spread: 3, up: 6, life: 1.1, size: [0.3, 0.8], color: 0xcffaff, alpha: 0.7, gravity: 12, drag: 0.5, add: true });
      if (e === 'rise') P.emit({ pos: p.pos, count: 22, spread: 3.5, flat: true, life: 0.9, size: [0.3, 0.9], color: 0xffd27a, alpha: 0.9, drag: 2, add: true, vel: { x: 0, y: -4, z: 0 } });
      if (e === 'glideStart') P.emit({ pos: { x: p.pos.x, y: p.pos.y + 1, z: p.pos.z }, count: 14, spread: 2, life: 0.7, size: [0.2, 0.5], color: 0xbffcff, alpha: 0.9, add: true });
      if (e === 'currentIn') P.emit({ pos: p.pos, count: 30, spread: 4, life: 1.0, size: [0.2, 0.7], color: p.current ? p.current.mat.uniforms.uColor.value.getHex() : 0x7ff3e6, alpha: 1, add: true });
    }
    // 썰매: 물 위면 물보라, 땅이면 먼지
    if (p.state === 'skim' && p.skimSpeed > 6 && !p._skimAir) {
      const water = this.world.heightAt(p.pos.x, p.pos.z) < 0.2;
      const back = { x: p.pos.x - Math.sin(p.yaw) * 1.2, y: p.pos.y - 0.3, z: p.pos.z - Math.cos(p.yaw) * 1.2 };
      const rate = Math.min(4, p.skimSpeed / 10);
      this._skimAcc = (this._skimAcc || 0) + rate * dt * 30;
      while (this._skimAcc > 1) {
        this._skimAcc -= 1;
        const side = Math.random() < 0.5 ? -1 : 1;
        const vel = { x: Math.cos(p.yaw) * side * 3 - Math.sin(p.yaw) * 2, y: water ? 3 : 1, z: -Math.sin(p.yaw) * side * 3 - Math.cos(p.yaw) * 2 };
        P.emit({ pos: back, vel, count: 1, spread: 1, life: water ? 0.8 : 1.2, size: water ? [0.3, 1.0] : [0.6, 2.4], color: water ? 0xd8fbff : dust, alpha: water ? 0.6 : 0.3, gravity: water ? 9 : 0.5, drag: water ? 0.6 : 2.5, add: water });
      }
    }
    // 해류: 주위를 흐르는 빛 알갱이
    if (p.state === 'current' && p.current && Math.random() < 0.6) {
      P.emit({ pos: { x: p.pos.x, y: p.pos.y + 1, z: p.pos.z }, count: 2, spread: 3, life: 0.5, size: [0.15, 0.4], color: p.current.mat.uniforms.uColor.value.getHex(), alpha: 0.9, add: true, radius: 4, vel: { x: -p.vel.x * 0.3, y: -p.vel.y * 0.3, z: -p.vel.z * 0.3 } });
    }
    P.update(dt);
    // 날개 끝 궤적
    const gliding = (p.state === 'glide' && p.glideSpeed > 13) || p.state === 'current';
    const cam = this.engine.camera.position;
    this.avatar.wingTips.forEach((tip, i) => {
      tip.getWorldPosition(this._tipV || (this._tipV = new THREE.Vector3()));
      this.trails[i].update(dt, this._tipV, gliding && this.avatar.wingOpen > 0.6, cam);
    });
  }

  // ── 목표·표식 빛기둥 ─────────────────────────
  _beacons() {
    const mk = (color) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 3.5, 1, 10, 1, true).translate(0, 0.5, 0), glowMaterial({ color, intensity: 0.7, fresnel: 0.6, side: THREE.DoubleSide }));
      m.frustumCulled = false;
      m.visible = false;
      this.engine.scene.add(m);
      return m;
    };
    this.questBeam = mk(0xffd27a);
    this.wayBeam = mk(0xffffff);
  }

  updateWaypoint() {
    const w = this.state.waypoint;
    this.wayBeam.visible = !!w;
    if (w) {
      this.wayBeam.position.set(w.x, this.world.groundAt(w.x, w.z), w.z);
      this.wayBeam.scale.set(1, 900, 1);
    }
  }

  _hud() {
    const p = this.player;
    this._target = this.mode === 'play' && p.state !== 'down' && p.state !== 'ride' && !this.director.active ? this._findTarget() : null;
    // 처음 만나는 건물의 일: 모아가 한 번 알려 준다
    const tk = this._target && this._target.kind, fl = this.state.flags;
    if (tk === 'venue' && !fl.moaVenue) { fl.moaVenue = true; this.ui.moa('이 건물의 시설은 장식이 아니에요. 가게에서 사고, 공방·창고에서 일해 별씨를 벌 수 있어요. 가방은 일지에 있어요.'); }
    if (tk === 'outdoor' && !fl.moaConsole) { fl.moaConsole = true; this.ui.moa('발치의 빛 기둥은 바깥 조작대예요. 들어갈 수 없는 건물도 여기서 그 건물의 일을 할 수 있어요.'); }
    this.ui.prompt(this._target ? this._target.label : null, this._target ? this._target.short : null);
    // 다가간 사람·시설지기를 바라본다 (말 걸 수 있다는 걸 몸으로도)
    const who = this._target && this._target.o && (this._target.kind === 'npc' || this._target.kind === 'citizen' || this._target.kind === 'lobby' ? this._target.o : this._target.kind === 'facility' ? this._target.o.npc : null);
    const wp = who && who.pos;
    if (wp) (this.avatar.lookAt || (this.avatar.lookAt = new THREE.Vector3())).set(wp.x, wp.y + 3.0 * (who.scale || 1), wp.z);
    else this.avatar.lookAt = null;
    const markers = [];
    const pos = p.pos;
    const bearing = (x, z) => ((Math.atan2(x - pos.x, -(z - pos.z)) * 180) / Math.PI + 360) % 360;
    markers.push({ bearing: bearing(pos.x + UR_DIR.x, pos.z + UR_DIR.z), cls: 'ur', label: '우르' });
    const tg = this.quests.targets();
    for (const t of tg.slice(0, 4)) {
      const d = Math.hypot(t.x - pos.x, t.z - pos.z);
      markers.push({ bearing: bearing(t.x, t.z), cls: 'q', label: d > 30 ? (d > 1000 ? (d / 1000).toFixed(1) + 'km' : Math.round(d) + 'm') : '' });
    }
    if (this.state.waypoint) {
      const w = this.state.waypoint;
      const d = Math.hypot(w.x - pos.x, w.z - pos.z);
      markers.push({ bearing: bearing(w.x, w.z), cls: 'w', label: d > 1000 ? (d / 1000).toFixed(1) + 'km' : Math.round(d) + 'm' });
      if (d < 25) { this.state.waypoint = null; this.updateWaypoint(); this.ui.toast('표식에 도착했다', { kind: 'muted' }); }
    }
    if (Math.hypot(pos.x, pos.z) > 1200) markers.push({ bearing: bearing(0, 0), cls: 'p', label: '척추' });
    markers.push(...this.services.compassMarkers(bearing));
    this.ui.updateCompass(this.rig.yaw, markers);
    this.ui.altimeter(this.interiors.inPocket ? 0 : p.pos.y, p.state === 'glide' ? p.glideSpeed : p.vel.length());
    const t0 = tg[0];
    if (t0) {
      const d = Math.hypot(t0.x - pos.x, t0.z - pos.z);
      this.questBeam.visible = d > 60;
      const h = t0.y ?? this.world.groundAt(t0.x, t0.z);
      this.questBeam.position.set(t0.x, h, t0.z);
      this.questBeam.scale.set(1 + d / 800, 600 + d * 0.15, 1 + d / 800);
    } else this.questBeam.visible = false;
  }

  _stats(prev) {
    const p = this.player;
    const d = Math.hypot(p.pos.x - prev.x, p.pos.z - prev.z);
    if (d < 100) {
      if (p.state === 'ground') this.state.stats.distance += d;
      if (p.state === 'glide') this.state.stats.glideDistance += d;
    }
  }

  // ── 플레이어 사건 → 소리·연출·모아 ────────────────
  _playerEvents() {
    const p = this.player;
    const s = this.state;
    for (const e of p.events) {
      if (e === 'jump') {
        audio.noise({ freq: 900, dur: 0.18, gain: 0.08, sweep: 2000 });
        if (!s.flags.moaJump && !this.player.indoor) { s.flags.moaJump = true; this.ui.moa(MOA.firstJump); }
      }
      if (e === 'land') {
        const k = Math.min(1, (p.impact || 4) / 20);
        audio.noise({ freq: 220, dur: 0.12 + k * 0.2, gain: 0.08 + k * 0.25, type: 'lowpass' });
        this.avatar.landSquash = Math.min(1, 0.3 + k);
        if (k > 0.5) this.rig.shake(0.08 * k);
      }
      if (e === 'hardland') { this.rig.shake(0.3); if (!s.flags.moaHard) { s.flags.moaHard = true; this.ui.moa(MOA.hardLand); } }
      if (e === 'glideStart') {
        audio.noise({ freq: 1400, dur: 0.35, gain: 0.12, sweep: 500 });
        audio.tone(2, { gain: 0.12, octave: 1, soft: true, dur: 1.2 });
        if (!s.flags.moaGlide) { s.flags.moaGlide = true; this.ui.moa(MOA.firstGlide); }
      }
      if (e === 'skimOn') {
        audio.blip({ hz: 200, to: 600, dur: 0.3, gain: 0.08, type: 'triangle' });
        if (!s.flags.moaSkim) { s.flags.moaSkim = true; this.ui.moa(MOA.firstSkim); }
      }
      if (e === 'currentIn') {
        audio.noise({ freq: 600, dur: 1.2, gain: 0.25, sweep: 3000 });
        [0, 2, 4].forEach((n, i) => audio.tone(n, { delay: i * 0.08, gain: 0.15, soft: true, octave: 1 }));
        s.stats.currentRides++;
        if (!s.flags.moaCurrent) { s.flags.moaCurrent = true; this.ui.moa(MOA.firstCurrent); }
      }
      if (e === 'currentOut' && this._lastCurrent) bus.emit('currentDone', { id: this._lastCurrent });
      if (e === 'liftIn') [0, 1, 2, 3, 4].forEach((n, i) => audio.tone(n, { delay: i * 0.12, gain: 0.12, soft: true }));
      if (e === 'splash') audio.noise({ freq: 1200, dur: 0.6, gain: 0.3, sweep: 300 });
      if (e === 'edge') this.ui.moa(MOA.edge);
      if (e === 'bump') { this.rig.shake(0.15); audio.noise({ freq: 160, dur: 0.2, gain: 0.25, type: 'lowpass' }); }
    }
    if (p.state === 'current' && p.current) this._lastCurrent = p.current.id;
  }

  _audio(dt) {
    const p = this.player;
    const cam = this.engine.camera;
    audio.listener.x = cam.position.x; audio.listener.y = cam.position.y; audio.listener.z = cam.position.z;
    audio.listener.yaw = Math.atan2(-Math.sin(this.rig.yaw), -Math.cos(this.rig.yaw));
    const speed = p.state === 'glide' ? p.glideSpeed : p.state === 'current' ? 80 : p.hspeed;
    audio.updateLoops(this.mode === 'title' ? 4 : speed, p.state, p.pos.y - p.groundH);
    if (p.state === 'ground' && p.hspeed > 1 && this.mode === 'play') {
      this._step = (this._step || 0) + dt * (1.6 + p.hspeed * 0.22);
      if (this._step > 1) {
        this._step = 0;
        const reg = this.world.regionAt(p.pos.x, p.pos.z).id;
        const f = p.groundC ? 2400 : p.pos.y < 4 ? 1400 : reg === 'glass' ? 3200 : reg === 'frost' && p.pos.y > 900 ? 900 : 700;
        audio.noise({ freq: f * (0.85 + Math.random() * 0.3), q: 1.2, dur: 0.07, gain: 0.05 + p.hspeed * 0.004, wet: 0.02 });
      }
    }
    if (this.mode !== 'title') {
      const c = this.world.clock;
      let mood = 'explore';
      if (c.eclipseNear > 0.3) mood = 'eclipse';
      else if (this.world.atmos.state.night > 0.6) mood = 'night';
      else for (const P of this.structures.pylons.values()) if (!P.alive && Math.hypot(P.x - p.pos.x, P.z - p.pos.z) < 1200) mood = 'silence';
      music.setMood(mood);
      music.intensity = 0.3 + Object.keys(this.state.pylons).length * 0.12;
    }
    music.update(dt);
  }

  /** 장소에 따른 대기 변화 (서리 첨봉의 눈보라 등) */
  _atmosphereByPlace(dt) {
    const p = this.player.pos;
    const frost = this.structures.pylons.get('frost-pylon');
    let target = this.services.fogTarget();
    if (frost && !frost.alive) target *= 1 + 2.5 * Math.max(0, 1 - Math.hypot(p.x - frost.x, p.z - frost.z) / 4500);
    const a = this.world.atmos;
    a.fogScale += (target - a.fogScale) * Math.min(1, dt * 0.3);
    if (!this.state.flags.moaNight && a.state.night > 0.8 && this.mode === 'play') { this.state.flags.moaNight = true; this.ui.moa(MOA.firstNight); }
  }

  _wireEvents() {
    bus.on('word', (e) => {
      const w = e.word;
      if (e.how === 'guess') this.ui.toast(`번역 추정 · 「${w.ko}」`, { kind: 'word', sub: '여러 번 들은 말에서 뜻을 짐작했어요' });
      else this.ui.toast(`단어 · 「${w.ko}」`, { kind: 'word' });
      audio.chime('word');
      if (!this.state.flags.moaWord && Object.keys(this.state.vocab).length >= 2) { this.state.flags.moaWord = true; setTimeout(() => this.ui.moa(MOA.firstWord), 1500); }
    });
    bus.on('lineUnderstood', (e) => {
      if (e.id === 'iel_1') {
        setTimeout(() => this.ui.infoCard('예전에 들었던 말', '「오라, 작은 별. 우리는 오래 기다렸어.」', '이엘이 처음 만났을 때 했던 말이에요. 그때는 한 마디도 알아듣지 못했죠.'), 1200);
      } else this.ui.toast('들었던 말 하나를 이제 이해한다', { kind: 'word', sub: '일지 → 들은 말' });
    });
    bus.on('tone', (e) => {
      this.discovery.onTone(e.n, e.pos);
      this.particles.emit({ pos: e.pos, count: 18, spread: 3, up: 2, life: 1.1, size: [0.2, 0.6], color: [0xffd27a, 0x7ff3e6, 0x7fb8ff, 0xffb8e8, 0xb9a6ff][e.n], alpha: 1, add: true, drag: 1.5 });
    });
    bus.on('convoDone', () => { if (this._afterConvo) { const f = this._afterConvo; this._afterConvo = null; setTimeout(f, 100); } });
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.save(); });
    addEventListener('beforeunload', () => this.save());
  }
}

const NO_INPUT = { move: { x: 0, y: 0 }, look: { x: 0, y: 0 }, wheel: 0, pressed: () => false, isHeld: () => false, lookActive: 99, lastDevice: 'keyboard' };
