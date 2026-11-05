// Game: wires every system together and runs the frame — input, player or
// rover, construction, interaction (mining, buildings, ruins), survival,
// simulation (economy, terraforming, colony, research), world streaming,
// camera, HUD and rendering. Also save/load and the title screen camera.
import * as THREE from 'three';
import { U, WORLD } from '../core/shared.js';
import { Input } from '../core/input.js';
import { Player } from '../player/player.js';
import { Rover } from '../player/rover.js';
import { Buildings } from '../build/buildings.js';
import { BuildMode } from '../build/buildmode.js';
import { Supports } from '../build/supports.js';
import { Roads } from '../build/roads.js';
import { Economy, Inventory } from '../sim/economy.js';
import { Terraform } from '../sim/terraform.js';
import { Colony } from '../sim/colony.js';
import { Research } from '../sim/research.js';
import { NPCs } from '../npc/npc.js';
import { POIs } from '../world/pois.js';
import { Fauna } from '../world/fauna.js';
import { FX } from '../world/fx.js';
import { UI } from '../ui/ui.js';
import { Thumbs } from '../ui/thumbs.js';
import { Objectives } from './objectives.js';
import { Audio } from './audio.js';
import { BUILDINGS, RECIPES, ITEMS, STAGES, ERAS } from '../sim/data.js';
import { ORE_TYPES } from '../world/props.js';
import { LANDMARKS } from '../world/worldgen.js';
import { GeoBuilder } from '../core/geobuilder.js';

const SAVE_KEY = 'terra-genesis-save-v1';
const SET_KEY = 'terra-genesis-settings-v1';

export class Game {
  constructor(base) {
    Object.assign(this, base);       // engine, terrain, sky, colliders, props, flora
    this.flags = {};
    this.cheats = { god: false };
    this.settings = Object.assign({ quality: 'high', sens: 1, fov: 72, invertY: false, terraSpeed: 1, volume: 0.6 }, readJSON(SET_KEY));
    this.input = new Input(this.engine.renderer.domElement);
    this.audio = new Audio();
    this.buildings = new Buildings(this);
    this.isBlocked = (x, z, r) => this.buildings.isBlocked(x, z, r);
    this.eco = new Economy(this);
    this.terra = new Terraform(this);
    this.colony = new Colony(this);
    this.research = new Research(this);
    this.npcs = new NPCs(this);
    this.drones = this.npcs;
    this.shuttle = this.npcs;
    this.npcNearDoor = (x, z) => this.npcs.npcNearDoor(x, z);
    this.pois = new POIs(this);
    this.fauna = new Fauna(this);
    this.fx = new FX(this);
    this.player = new Player(this);
    this.rover = new Rover(this);
    this.build = new BuildMode(this);
    this.roads = new Roads(this);
    this.supports = new Supports(this);
    this.thumbs = new Thumbs(this);
    this.objectives = new Objectives(this);
    this.isUnlocked = (t) => this.research.isUnlocked(t);
    this.ui = new UI(this);
    this.landmarks = { volcano: LANDMARKS.volcano, volcano2: LANDMARKS.volcano2, basin: LANDMARKS.basin, rift: { x: -1200, z: -1650, name: LANDMARKS.rift.name }, start: { x: 0, z: 0, name: '착륙 지점' } };
    this.mining = { t: 0, ore: null };
    this.makeTool();
    this.input.onLockChange = (locked) => { this.updateLockHint(); if (!locked && this.started && !this.input.uiOpen && !this.input.cursorMode) this.ui.open('pause'); };
    this.input.onKey((e) => this.onKey(e));
    this.applySettings();
    // overview map in the background
    this.buildMap();
    this.autosaveT = 60;
  }

  // ---------------------------------------------------------------- setup
  newGame() {
    const T = this.terrain;
    // find a flat landing spot near the origin
    let best = [12, 18], bs = 9;
    for (let i = 0; i < 60; i++) {
      const x = (Math.random() - 0.5) * 60, z = (Math.random() - 0.5) * 60;
      const s = T.slope(x, z) + Math.abs(T.height(x + 3, z) - T.height(x - 3, z)) * 0.05;
      if (s < bs) { bs = s; best = [x, z]; }
    }
    const [px, pz] = best;
    const y = T.height(px, pz) + 0.25;
    T.flattenRect(px, pz, 3.8, 3.8, 0, y - 0.03, 3);
    this.props.clearArea(px, pz, 4);
    this.buildings.add('pod', px, y, pz, 0.6);
    this.player.spawn(px + 3.5, pz + 4, 0.6);
    this.rover.summon(new THREE.Vector3(px - 6, 0, pz + 2), 0.6 + Math.PI / 2);
    this.eco.gridDirty = true;
    this.sky.time = 0.31;
    this.flags.newGame = true;
  }

  makeTool() {
    // handheld multitool: rounded body, emitter ring, orange rail, grip, status light
    const gb = new GeoBuilder();
    const body = new THREE.CapsuleGeometry(0.032, 0.2, 6, 14); body.rotateX(Math.PI / 2);
    gb.add(body, { color: 0xe9e7e2 });
    gb.add(new THREE.BoxGeometry(0.018, 0.012, 0.2), { pos: new THREE.Vector3(0, 0.033, 0.0), color: 0xf0761c });
    gb.add(new THREE.CylinderGeometry(0.036, 0.036, 0.03, 18), { pos: new THREE.Vector3(0, 0, -0.1), rot: new THREE.Euler(Math.PI / 2, 0, 0), color: 0x3a3e44 });
    gb.add(new THREE.CylinderGeometry(0.016, 0.026, 0.06, 14), { pos: new THREE.Vector3(0, 0, -0.145), rot: new THREE.Euler(Math.PI / 2, 0, 0), color: 0x24272b });
    gb.add(new THREE.TorusGeometry(0.03, 0.004, 6, 20), { pos: new THREE.Vector3(0, 0, -0.165), color: 0x80868d });
    const grip = new THREE.CapsuleGeometry(0.016, 0.07, 4, 10);
    gb.add(grip, { pos: new THREE.Vector3(0, -0.055, 0.06), rot: new THREE.Euler(0.35, 0, 0), color: 0x2c2f33 });
    gb.add(new THREE.BoxGeometry(0.012, 0.02, 0.05), { pos: new THREE.Vector3(0.03, 0.012, 0.03), color: 0x33373c });
    const m = new THREE.Mesh(gb.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.3 }));
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 3.5, 4.5) }));
    glow.position.set(0, 0, -0.178);
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.012, 0.03), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 2.4, 3.0) }));
    led.position.set(0.0365, 0.012, 0.03);
    const tool = new THREE.Group();
    tool.add(m, glow, led);
    this.tool = tool;
    this.toolGlow = glow;
    const ov = new THREE.Scene();
    ov.add(tool);
    const l = new THREE.DirectionalLight(0xffffff, 2.5);
    l.position.set(0.5, 1, 0.3);
    ov.add(l, new THREE.HemisphereLight(0xbcd6ff, 0x504030, 0.8));
    this.overlay = ov;
    this.overlayLight = l;
    this.engine.overlay = ov;
  }

  applySettings() {
    const s = this.settings;
    this.engine.applyQuality(s.quality);
    this.input.sensitivity = 0.0022 * s.sens;
    this.input.invertY = s.invertY;
    this.engine.camera.fov = s.fov;
    this.engine.camera.updateProjectionMatrix();
    this.audio.setVolume(s.volume);
    this.flora && this.flora.scatter && (this.flora.scatter.densityScale = this.engine.quality.flora, this.flora.invalidate());
    try { localStorage.setItem(SET_KEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
  }

  buildMap() {
    const size = 256, rows = 16;
    const H = new Float32Array(size * size), P = new Uint8Array(size * size * 4);
    let done = 0;
    for (let r = 0; r < size; r += rows) {
      this.terrain.requestMap(size, r, r + rows, (res) => {
        H.set(res.H, res.row0 * size); P.set(res.P, res.row0 * size * 4);
        if (++done === size / rows) this.mapData = { H, P, size }, this.renderMapImage();
      });
    }
  }

  renderMapImage() {
    if (!this.mapData) return;
    const { H, P, size } = this.mapData;
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const c = cv.getContext('2d');
    const img = c.createImageData(size, size);
    const L = U.uWaterLevel.value, lush = U.uGrass.value;
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
      const k = j * size + i;
      const h = H[k];
      const hx = H[j * size + Math.min(size - 1, i + 1)] - H[j * size + Math.max(0, i - 1)];
      const hz = H[Math.min(size - 1, j + 1) * size + i] - H[Math.max(0, j - 1) * size + i];
      const shade = Math.max(0.35, Math.min(1.3, 0.85 - (hx + hz) * 0.012));
      let r = 150, g = 92, b = 62;
      const sand = P[k * 4] / 255, bas = P[k * 4 + 1] / 255, str = P[k * 4 + 2] / 255, snow = P[k * 4 + 3] / 255;
      r = r * (1 - sand) + 205 * sand; g = g * (1 - sand) + 160 * sand; b = b * (1 - sand) + 115 * sand;
      r = r * (1 - bas) + 70 * bas; g = g * (1 - bas) + 62 * bas; b = b * (1 - bas) + 60 * bas;
      r = r * (1 - str * 0.4) + 190 * str * 0.4; g = g * (1 - str * 0.4) + 120 * str * 0.4;
      r = r * (1 - snow) + 225 * snow; g = g * (1 - snow) + 230 * snow; b = b * (1 - snow) + 235 * snow;
      if (lush > 0 && h > L + 1) { const t = lush * 0.6; r = r * (1 - t) + 70 * t; g = g * (1 - t) + 120 * t; b = b * (1 - t) + 55 * t; }
      if (h < L) { const d = Math.min(1, (L - h) / 80); r = 20 + 30 * (1 - d); g = 70 + 50 * (1 - d); b = 100 + 40 * (1 - d); }
      img.data[k * 4] = r * shade; img.data[k * 4 + 1] = g * shade; img.data[k * 4 + 2] = b * shade; img.data[k * 4 + 3] = 255;
    }
    c.putImageData(img, 0, 0);
    this.mapImage = cv;
  }

  // ---------------------------------------------------------------- keys
  onKey(e) {
    const ui = this.ui;
    if (!this.started) return;
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (ui.panel) { ui.close(); return; }
      if (this.build.active) { this.build.exit(); return; }
      if (e.code === 'KeyP') ui.open('pause');
      return;
    }
    if (ui.panel) {
      const map = { Tab: 'inv', KeyB: 'build', KeyJ: 'research', KeyM: 'map' };
      if (map[e.code] === ui.panel) { ui.close(); return; }
      if (ui.panelKey && ui.panel === 'build') ui.panelKey(e);
      return;
    }
    if (this.driving()) {
      if (e.code === 'KeyE' || e.code === 'KeyN') this.exitRover();
      if (e.code === 'KeyM') ui.open('map');
      return;
    }
    switch (e.code) {
      case 'Tab': ui.open('inv', this.nearStorage()); break;
      case 'KeyB': this.build.exit(); ui.open('build'); break;
      case 'KeyJ': ui.open('research'); break;
      case 'KeyM': ui.open('map'); break;
      case 'KeyF': this.build.toggleDismantle(); break;
      case 'KeyG': this.build.toggleTerrain(); break;
      case 'KeyN': this.callRover(); break;
      case 'F1': ui.open('help'); break;
      default: {
        const m = /^Digit([1-9])$/.exec(e.code);
        if (m) {
          const t = ui.hotbar[+m[1] - 1];
          if (!t) break;
          const lock = this.isUnlocked(t);
          if (!lock.ok) { ui.toast(lock.reason, 'bad'); break; }
          if (this.build.mode === 'place' && this.build.type === t) this.build.exit(); else this.build.select(t);
        }
      }
    }
  }

  driving() { return this.rover.driving; }

  callRover() {
    if (this.rover.present && this.rover.near(this.player.pos, 60)) { this.ui.toast('로버가 근처에 있습니다 (E로 탑승)', 'info'); return; }
    this.rover.summon(this.player.pos, this.player.yaw + Math.PI / 2);
    this.ui.toast('탐사 로버가 도착했습니다 — E로 탑승', 'good');
  }

  enterRover() {
    this.rover.driving = true;
    this.player.model.root.visible = false;
    this.build.exit();
    this.ui.toast('운전: W/S 가속 · A/D 조향 · Shift 부스트 · Space 브레이크 · E 하차', 'info', 3);
  }

  exitRover() {
    const R = this.rover;
    R.driving = false;
    const c = Math.cos(R.yaw), s = Math.sin(R.yaw);
    const x = R.pos.x + 2.2 * c, z = R.pos.z - 2.2 * s;
    this.player.pos.set(x, this.terrain.height(x, z) + 0.2, z);
    this.player.vel.set(0, 0, 0);
  }

  // ---------------------------------------------------------------- interaction helpers
  nearCraft() {
    const p = this.player.pos;
    for (const b of this.buildings.list) if (b.def.craft && Math.hypot(b.x - p.x, b.z - p.z) < Math.max(b.hw, b.hd) + 6) return b.def.name;
    return null;
  }

  nearStorage() {
    const p = this.player.pos;
    let best = null, bd = 6;
    for (const b of this.buildings.list) {
      if (!b.def.storage) continue;
      const d = Math.hypot(b.x - p.x, b.z - p.z) - Math.max(b.hw, b.hd);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }

  storageInv(b) {
    if (!b.inv) { b.inv = new Inventory(b.def.storage, 50); if (b.data.inv) b.inv.load(b.data.inv); }
    return b.inv;
  }

  craft(id, times = 1) {
    const rec = RECIPES.find((r) => r.id === id);
    const inv = this.eco.inv;
    let made = 0;
    for (let k = 0; k < times; k++) {
      if (!Object.entries(rec.in).every(([i, n]) => inv.count(i) >= n)) break;
      for (const [i, n] of Object.entries(rec.in)) inv.remove(i, n);
      for (const [i, n] of Object.entries(rec.out)) if (inv.add(i, n) < n) this.ui.toast('가방이 가득 찼습니다', 'warn');
      made++;
    }
    if (made) { this.audio.play('pickup'); if (id === 'plate') this.flags.platesMade = true; }
    this.ui.dirty();
  }

  dismantle(b) {
    if (b.def.storage) {
      const inv = this.storageInv(b);
      for (const [id, n] of inv.items) this.eco.give(id, n);
    }
    if (b.data.buf) this.eco.give(b.data.ore, b.data.buf);
    this.eco.refund(b.type, b);
    this.buildings.remove(b);
    this.onChanged();
    this.fx.build(b.x, b.y, b.z, Math.max(b.hw, b.hd) * 2);
    this.audio.play('build');
    this.ui.toast(b.def.name + ' 해체 — 재료를 돌려받았습니다', 'info', 1.6);
  }

  onChanged() {
    this.eco.gridDirty = true;
    this.npcs.invalidate();
    this.flora.invalidate();
    this.ui.renderHotbar();
  }

  onBuilt(b) {
    if (b.type === 'hq') {
      this.colony.credits += 600;
      this.ui.toast('<b>식민 본부 가동</b>정착 헌장 기금 600 크레딧이 지급되었습니다. 정착민은 심우주 교신기로 초청합니다.', 'good', 6, true);
    }
    this.onChanged();
  }

  onStage(k, st) {
    this.research.addPoints(15 * k);
    const unlocked = Object.values(BUILDINGS).filter((d) => d.unlockStage === st.id).map((d) => d.name);
    this.ui.toast(`<b>${st.name}</b>${st.desc}${unlocked.length ? '<br>해금: ' + unlocked.join(', ') : ''}`, 'good', 7, true);
    this.audio.play('stage');
    this.ui.renderHotbar();
    this.renderMapImage();
    if (st.id === 'breathable') this.ui.toast('이제 헬멧 없이도 숨쉴 수 있습니다 — 산소가 더 이상 줄지 않습니다', 'good', 6);
  }

  onResearch(r, unlocked) {
    this.ui.toast(`<b>연구 완료: ${r.name}</b>${unlocked.length ? '해금: ' + unlocked.join(', ') : r.desc}`, 'good', 5, true);
    this.audio.play('done');
    this.ui.renderHotbar();
  }

  onEra(e, era) {
    this.ui.toast(`<b>${era.name} 시대</b>${era.desc}`, 'good', 7, true);
    this.audio.play('stage');
  }

  markers() {
    const out = [];
    for (const b of this.buildings.list) {
      if (b.type === 'hq') out.push({ x: b.x, z: b.z, color: '#ff9d4d', name: '식민 본부' });
      else if (b.type === 'pod') out.push({ x: b.x, z: b.z, color: '#66e0ff', name: '착륙 포드' });
      else if (b.type === 'beacon') out.push({ x: b.x, z: b.z, color: '#ffffff', name: '비콘' });
      else if (b.type === 'habitat') out.push({ x: b.x, z: b.z, color: '#9fe3ea', name: '거주 모듈' });
    }
    const P = this.player.pos;
    for (const p of this.pois.discovered.values()) {
      if (Math.hypot(p.x - P.x, p.z - P.z) > 3000) continue;
      if (this.props.searched.has([...this.pois.discovered.entries()].find(([, v]) => v === p)?.[0])) continue;
      out.push({ x: p.x, z: p.z, color: p.kind === 'ruin' ? '#b07aff' : '#ffd35a', name: p.name });
    }
    if (this.rover.present && !this.rover.driving) out.push({ x: this.rover.pos.x, z: this.rover.pos.z, color: '#79e08a', name: '로버' });
    return out;
  }

  updateLockHint() {
    const el = document.getElementById('lockhint');
    if (el) el.hidden = !this.started || this.input.locked || this.input.uiOpen || this.input.cursorMode;
  }

  // ---------------------------------------------------------------- frame
  update(dt) {
    if (this.supports.dirty) this.supports.rebuild();
    const input = this.input, P = this.player, cam = this.engine.camera;
    const playing = this.started && !this.ui.panel;
    if (playing) {
      if (this.rover.driving) {
        this.rover.update(dt, input);
        P.pos.copy(this.rover.pos); P.pos.y += 1.6;
        P.vel.set(0, 0, 0);
        P.onGround = true;
      } else {
        P.update(dt, input);
        this.rover.update(dt, input);
        if (this.build.active) this.build.update(dt, input);
        else this.interact(dt, input);
      }
      this.survival(dt);
    } else if (this.started) {
      this.rover.update(dt, input);
    }
    const sp = this.settings.terraSpeed;
    if (this.started) {
      this.eco.tick(dt);
      // terraform machines produce scaled by the speed option
      if (sp !== 1) for (const b of this.buildings.list) if (b.def.terra) for (const [k, v] of Object.entries(b.def.terra)) this.terra.add(k, v * (b.rate || 0) * dt * (sp - 1));
      this.terra.tick(dt);
      this.colony.tick(dt);
      this.research.tick(dt);
      this.autosaveT -= dt;
      if (this.autosaveT <= 0) { this.autosaveT = 60; this.save(); }
    }
    // camera
    if (this.started) {
      if (this.rover.driving) this.roverCamera(dt, cam, input);
      else P.updateCamera(dt, cam);
    } else this.titleCamera(dt, cam);
    this.updateTool(dt);
    // world
    this.sky.update(dt, cam.position);
    this.terrain.update(cam.position);
    this.props.update(cam.position);
    this.flora.update(cam.position);
    this.fauna.update(dt, cam.position);
    this.buildings.update(dt, cam.position, P);
    this.npcs.update(dt, cam.position);
    this.pois.update(P.pos);
    this.fx.update(dt, cam.position, this.terra.weather.storm);
    this.engine.underwater = cam.position.y < U.uWaterLevel.value && U.uIce.value < 0.5 ? 1 : 0;
    this.engine.hurt = Math.max(0, this.engine.hurt - dt * 0.6, P.oxygen <= 0 ? 0.6 : P.oxygen < 0.2 ? 0.25 : 0);
    this.audio.ambient(this.sky.uniforms.uAtmo.value, this.terra.weather.storm, this.sky.uniforms.uDust.value, !!P.inside);
    if (this.started) {
      this.ui.update(dt);
      this.ui.setMode(this.build.mode === 'place' ? `건설: <b>${BUILDINGS[this.build.type].name}</b> · 좌클릭 설치 · 휠/R 회전 · 우클릭 취소` : this.build.mode === 'dismantle' ? '<span style="color:var(--bad)">해체 모드</span> · 좌클릭 길게 · F 종료' : this.build.mode === 'road' ? '도로 깔기 · 좌클릭 지점 · 우클릭 끊기 · Esc 종료' : this.build.mode === 'terrain' ? `지형 도구 · 반경 ${this.build.brush.radius.toFixed(1)}m · 좌클릭 올리기 · 우클릭 파기 · Shift 평탄화` : this.rover.driving ? `탐사 로버 · ${Math.abs(this.rover.speed * 3.6).toFixed(0)} km/h` : '');
      if (this.build.active && this.build.mode !== 'terrain') this.ui.setPrompt(this.build.reason ? `<span class="bad">${this.build.reason}</span>` : '');
    }
    input.endFrame();
  }

  roverCamera(dt, cam, input) {
    const R = this.rover, P = this.player;
    if (input.active) { P.yaw -= input.mouse.dx * input.sensitivity; P.pitch = Math.max(-0.8, Math.min(0.5, P.pitch - input.mouse.dy * input.sensitivity)); }
    if (!input.mouse.dx && Math.abs(R.speed) > 2) P.yaw += Math.atan2(Math.sin(R.yaw - P.yaw), Math.cos(R.yaw - P.yaw)) * Math.min(1, dt * 1.5);
    const dist = 11;
    const d = new THREE.Vector3(-Math.sin(P.yaw) * Math.cos(P.pitch), Math.sin(P.pitch), -Math.cos(P.yaw) * Math.cos(P.pitch));
    const pivot = R.pos.clone().add(new THREE.Vector3(0, 2.6, 0));
    cam.position.copy(pivot).addScaledVector(d, -dist);
    const gh = this.terrain.height(cam.position.x, cam.position.z) + 1;
    if (cam.position.y < gh) cam.position.y = gh;
    cam.lookAt(pivot.clone().addScaledVector(d, 10));
  }

  titleCamera(dt, cam) {
    this.titleT = (this.titleT || 0) + dt * 0.02;
    const a = this.titleT;
    const c = this.titleCenter || new THREE.Vector3();
    const x = c.x + Math.cos(a) * 60, z = c.z + Math.sin(a) * 60;
    cam.position.set(x, Math.max(this.terrain.height(x, z) + 14, c.y + 12), z);
    cam.lookAt(c.x, c.y + 3, c.z);
  }

  updateTool(dt) {
    const P = this.player, cam = this.engine.camera;
    const show = this.started && P.view === 'first' && !this.rover.driving && !this.hideTool;
    this.tool.visible = show;
    if (!show) return;
    const sp = Math.hypot(P.vel.x, P.vel.z);
    this.toolBob = (this.toolBob || 0) + dt * sp * 1.6;
    const mining = this.mining.ore ? 1 : 0;
    const kick = this.build.active ? 0.03 : 0;
    this.tool.position.copy(cam.position);
    this.tool.quaternion.copy(cam.quaternion);
    const off = new THREE.Vector3(0.16 + Math.sin(this.toolBob) * 0.005, -0.13 + Math.abs(Math.cos(this.toolBob)) * 0.006 - kick, -0.36 + mining * (Math.random() * 0.004));
    this.tool.position.add(off.applyQuaternion(cam.quaternion));
    this.toolGlow.material.color.setRGB(mining ? 3 : 1.5, mining ? 5 : 3.5, mining ? 6 : 4.5);
    this.overlay.environment = this.engine.scene.environment;
    this.overlayLight.position.copy(cam.position).add(U.uSunDir.value);
    this.overlayLight.target.position.copy(cam.position);
    this.overlayLight.intensity = 0.4 + 2.2 * (1 - U.uNight.value);
  }

  // aim, mining and E interactions
  interact(dt, input) {
    const P = this.player, cam = this.engine.camera, ui = this.ui;
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    const reach = 5.5 + (P.view === 'third' ? P.camDistCur : 0);
    let prompt = '';
    // ores
    const ore = input.active ? this.props.pickOre(cam.position, dir, reach) : null;
    const oreOk = ore && Math.hypot(ore.x - P.pos.x, ore.z - P.pos.z) < 5;
    if (oreOk) {
      prompt = `<span class="key">좌클릭</span>${ORE_TYPES[ore.type].name} 채집`;
      if (input.btn(0)) {
        if (this.mining.ore !== ore) { this.mining.ore = ore; this.mining.t = 0; }
        this.mining.t += dt;
        ui.setProgress(Math.min(1, this.mining.t / 0.7));
        const tip = P.view === 'first' ? this.toolGlow.getWorldPosition(new THREE.Vector3()) : P.eyePos().add(new THREE.Vector3(0, -0.4, 0));
        const tgt = new THREE.Vector3(ore.x, ore.y + 0.3 * ore.s, ore.z);
        this.fx.setBeam(tip, tgt);
        this.fx.sparks(tgt, 1);
        if (Math.random() < 0.3) this.audio.play('mine');
        P.working = true;
        if (this.mining.t >= 0.7) {
          const n = 1 + (Math.random() < 0.35 ? 1 : 0);
          const got = this.eco.give(ore.type, n);
          if (got) { this.props.removeOre(ore); ui.toast(`${ORE_TYPES[ore.type].name} +${got}`, 'info', 1.2); this.audio.play('pickup'); }
          else ui.toast('가방이 가득 찼습니다', 'warn');
          this.mining.ore = null; this.mining.t = 0;
        }
      } else { this.mining.ore = null; this.mining.t = 0; }
    } else { this.mining.ore = null; this.mining.t = 0; }
    if (!this.mining.ore) { this.fx.setBeam(null); ui.setProgress(0); P.working = false; }

    // structures, ruins, rover
    if (!prompt) {
      const hit = this.colliders.raycast(cam.position.x, cam.position.y, cam.position.z, dir.x, dir.y, dir.z, reach + 1, (c) => !c.rock);
      const b = hit && hit.c.b && Math.hypot(hit.c.b.x - P.pos.x, hit.c.b.z - P.pos.z) < Math.max(hit.c.b.hw, hit.c.b.hd) + 4 ? hit.c.b : null;
      const poi = hit && hit.c.poi ? this.pois.active.get(hit.c.poi.id) : this.pois.nearest(P.pos, 4);
      if (this.rover.near(P.pos, 4.5)) {
        prompt = '<span class="key">E</span>탐사 로버 탑승';
        if (input.hit('KeyE')) this.enterRover();
      } else if (poi && Math.hypot(poi.poi.x - P.pos.x, poi.poi.z - P.pos.z) < 14) {
        const done = this.props.searched.has(poi.poi.id);
        prompt = done ? `${this.pois.name(poi.poi.kind)} <span class="sub">이미 조사함</span>` : `<span class="key">E</span>${this.pois.name(poi.poi.kind)} 조사하기`;
        if (!done && input.hit('KeyE')) this.searchPOI(poi);
      } else if (b) {
        const d = b.def;
        let sub = b.status ? `<span class="sub">${b.status}</span>` : '';
        if (b.type === 'habitat' && P.inside === b) {
          prompt = `<span class="key">E</span>침대에서 쉬기 ${this.sky.isNight() ? '(아침까지)' : ''}`;
          if (input.hit('KeyE')) this.sleep();
        } else {
          prompt = `<span class="key">E</span>${d.name}${b.type === 'house' ? ` · 주민 ${b.data.res || 0}명` : ''}${sub}`;
          if (input.hit('KeyE')) {
            if (d.storage && (b.type === 'storage')) ui.open('inv', b);
            else if (d.comms) ui.open('comms', b);
            else ui.open('building', b);
          }
        }
      }
    }
    ui.setPrompt(prompt);
  }

  searchPOI(a) {
    const res = this.pois.search(a);
    if (res.already) return;
    const texts = {
      wreck: '오래전 이 행성에 닿지 못한 수송선이다. 화물칸의 잠금장치가 아직 살아 있다. 쓸 만한 부품과 항법 기록을 회수했다.',
      cache: '궤도에서 투하된 보급 캡슐. 개척단의 표식이 찍혀 있다.',
      ruin: '검은 석판들이 원을 이루고 있다. 표면의 홈을 따라 보랏빛이 흐르다가 손을 대자 문양이 단말기로 흘러들었다. 이 행성에는 우리보다 먼저 온 누군가가 있었다.',
    };
    this.ui.open('poi', { title: this.pois.name(a.poi.kind), text: texts[a.poi.kind], ...res });
    this.audio.play('done');
  }

  sleep() {
    const night = this.sky.isNight() || this.sky.time > 0.7 || this.sky.time < 0.25;
    if (!night) { this.ui.toast('잠은 밤에만 잘 수 있습니다', 'info'); return; }
    // fast-forward the simulation to morning
    const target = this.sky.time > 0.5 ? 1.27 - this.sky.time : 0.27 - this.sky.time;
    const secs = target * this.sky.dayLength;
    for (let t = 0; t < secs; t += 1) { this.eco.tick(1); this.terra.tick(1); this.colony.tick(1); this.research.tick(1); }
    this.sky.time = 0.27;
    if (this.sky.time < 0.27) this.sky.day++;
    this.player.oxygen = 1; this.player.health = 1;
    this.ui.toast('푹 쉬었습니다. 아침입니다.', 'good');
  }

  survival(dt) {
    const P = this.player;
    P.inside = this.buildings.inside(P.pos);
    let refill = null;
    if (P.inside && P.inside.def.o2) refill = P.inside.def.name;
    for (const b of this.buildings.list) if (b.type === 'pod' && Math.hypot(b.x - P.pos.x, b.z - P.pos.z) < 7) refill = '착륙 포드';
    if (this.rover.driving) refill = '탐사 로버';
    if (this.terra.breathable) { P.oxygen = Math.min(1, P.oxygen + dt * 0.2); this.o2Note = '숨쉬는 대기 — 산소 무제한'; }
    else if (refill) { P.oxygen = Math.min(1, P.oxygen + dt * 0.25); this.o2Note = refill + '에서 산소 충전 중'; }
    else {
      const k = (P.jetting ? 1.4 : 1) * ((this.input.down('ShiftLeft') && Math.hypot(P.vel.x, P.vel.z) > 5) ? 1.25 : 1);
      P.oxygen = Math.max(0, P.oxygen - dt / P.o2Capacity * k);
      this.o2Note = P.oxygen < 0.25 ? '산소 부족! 포드·거주 모듈·로버로 돌아가세요' : '';
      if (P.oxygen < 0.25 && !this._o2warn) { this._o2warn = true; this.ui.toast('산소가 25% 남았습니다', 'bad', 3); this.audio.play('warn'); }
      if (P.oxygen > 0.4) this._o2warn = false;
    }
    if (P.oxygen <= 0) P.damage(dt * 0.05, '질식');
    else P.health = Math.min(1, P.health + dt * 0.01);
    if (this.cheats.god) { P.oxygen = 1; P.health = 1; }
    if (P.health <= 0) this.respawn();
  }

  respawn() {
    const P = this.player;
    const homes = this.buildings.list.filter((b) => b.def.o2);
    let best = homes[0], bd = Infinity;
    for (const b of homes) { const d = Math.hypot(b.x - P.pos.x, b.z - P.pos.z); if (d < bd) { bd = d; best = b; } }
    if (best) { const [x, z] = this.buildings.toWorld(best, 0, -best.hd - 2); P.spawn(x, z, best.rot); }
    P.oxygen = 1; P.health = 1;
    this.ui.toast('정신을 잃었다가 ' + (best ? best.def.name : '착륙 지점') + ' 근처에서 깨어났습니다 (' + (P.lastDamage || '') + ')', 'bad', 5);
  }

  // ---------------------------------------------------------------- save / load
  save() {
    if (!this.started) return;
    const data = {
      v: 1, t: Date.now(),
      player: { x: this.player.pos.x, y: this.player.pos.y, z: this.player.pos.z, yaw: this.player.yaw, pitch: this.player.pitch, o2: this.player.oxygen, hp: this.player.health, view: this.player.view },
      sky: { time: this.sky.time, day: this.sky.day },
      eco: this.eco.serialize(), terra: this.terra.serialize(), colony: this.colony.serialize(), research: this.research.serialize(),
      buildings: this.buildings.list.map((b) => ({ id: b.id, type: b.type, x: b.x, y: b.y, z: b.z, rot: b.rot, tier: b.tier, enabled: b.enabled, data: { ...b.data, inv: b.inv ? b.inv.toJSON() : b.data.inv } })),
      edits: this.terrain.editList, collected: [...this.props.collected], searched: [...this.props.searched], pois: this.pois.serialize(),
      hotbar: this.ui.hotbar, obj: this.objectives.index, flags: this.flags,
      rover: this.rover.present ? { x: this.rover.pos.x, z: this.rover.pos.z, yaw: this.rover.yaw } : null,
    };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { console.warn('save failed', e); }
  }

  hasSave() { return !!readJSON(SAVE_KEY); }

  load() {
    const d = readJSON(SAVE_KEY);
    if (!d) return false;
    this.terrain.replayEdits(d.edits || []);
    for (const id of d.collected || []) this.props.collected.add(id);
    for (const id of d.searched || []) this.props.searched.add(id);
    this.pois.load(d.pois);
    this.eco.load(d.eco || {});
    this.terra.load(d.terra || {});
    this.colony.load(d.colony || {});
    this.research.load(d.research || {});
    for (const b of d.buildings || []) {
      const nb = this.buildings.add(b.type, b.x, b.y, b.z, b.rot, { id: b.id, tier: b.tier, data: b.data });
      if (b.enabled === false) nb.enabled = false;
    }
    for (const b of this.buildings.list) this.props.clearArea(b.x, b.z, Math.hypot(b.hw, b.hd) + 0.5);
    this.sky.time = d.sky?.time ?? 0.35; this.sky.day = d.sky?.day ?? 1;
    const p = d.player;
    this.player.pos.set(p.x, p.y, p.z); this.player.yaw = p.yaw; this.player.pitch = p.pitch;
    this.player.oxygen = p.o2 ?? 1; this.player.health = p.hp ?? 1; this.player.view = p.view || 'third';
    if (d.hotbar) this.ui.hotbar = d.hotbar;
    this.objectives.index = d.obj || 0;
    this.flags = d.flags || {};
    if (d.rover) { this.rover.summon(new THREE.Vector3(d.rover.x, 0, d.rover.z), 0); this.rover.pos.set(d.rover.x, this.terrain.height(d.rover.x, d.rover.z), d.rover.z); this.rover.yaw = d.rover.yaw; }
    this.eco.gridDirty = true;
    this.npcs.invalidate();
    this.roads.rebuild();
    this.supports.rebuild();
    this.ui.renderHotbar();
    return true;
  }

  wipe() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } }
}

function readJSON(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
