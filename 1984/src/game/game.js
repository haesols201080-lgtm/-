// The shared game context (G) and main loop. Every module receives G and
// talks to the others only through it. See docs/architecture.md.
import * as THREE from 'three';
import * as assets from '../core/assets.js';
import * as mats from '../core/materials.js';
import * as art from '../core/art.js';
import { Renderer } from '../core/renderer.js';
import { Atmosphere } from '../core/sky.js';
import { Input } from '../core/input.js';
import { Colliders } from '../world/collision.js';
import { Player } from './player.js';

export class Emitter {
  constructor() { this.h = new Map(); }
  on(n, f) { if (!this.h.has(n)) this.h.set(n, new Set()); this.h.get(n).add(f); return () => this.h.get(n).delete(f); }
  emit(n, d) { const s = this.h.get(n); if (s) for (const f of [...s]) f(d); }
}

export function createGame(container) {
  const renderer = new Renderer(container);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 2500);
  const input = new Input(renderer.gl.domElement);
  const col = new Colliders();
  const player = new Player(camera, input, col);
  const atmos = new Atmosphere(scene, renderer.gl);
  scene.add(camera);

  const G = {
    THREE, renderer, scene, camera, input, col, player, atmos, assets, mats, art,
    events: new Emitter(),
    state: {
      day: 1, minutes: 7 * 60 + 15, suspicion: 0, record: 0, flags: {}, inventory: [], money: 12.5,
      location: 'city', ending: null, part: 1,
    },
    clock: { scale: 1, paused: false },     // game minutes per real second
    time: 0,                                  // real seconds since start
    paused: false,                            // menu or modal: world frozen
    cutscene: 0,                              // >0 while a scripted scene runs
    locations: new Map(),
    location: null,
    interactables: new Set(),
    triggers: new Set(),
    updaters: new Set(),
    waiters: [],
    focus: null,
    debug: { godMode: false },
  };

  // ------------------------------------------------------------ helpers

  G.wait = (sec) => new Promise((res) => G.waiters.push({ t: G.time + sec, res }));
  G.until = (pred, timeout = Infinity) => new Promise((res) => {
    const start = G.time;
    G.waiters.push({ pred, res, t: start + timeout });
  });

  G.fadeValue = 0;
  G.fade = (to, dur = 0.8) => new Promise((res) => {
    const from = G.fadeValue; const t0 = G.time;
    const f = () => {
      const k = Math.min(1, (G.time - t0) / Math.max(0.001, dur));
      G.fadeValue = from + (to - from) * k * k * (3 - 2 * k);
      renderer.u.uFade.value = G.fadeValue;
      if (k >= 1) { G.updaters.delete(f); res(); }
    };
    G.updaters.add(f);
  });

  G.clockText = () => {
    const m = Math.floor(G.state.minutes) % 1440;
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  };

  G.setTime = (minutes) => { G.state.minutes = minutes; G.events.emit('time', minutes); };

  // A location is a group of objects shown on its own (the city, the
  // countryside, each interior). Interiors sit far from the city so their
  // colliders never overlap.
  G.addLocation = (loc) => {
    loc.root.visible = false;
    scene.add(loc.root);
    G.locations.set(loc.id, loc);
    return loc;
  };

  G.enter = (id, spawn) => {
    const loc = G.locations.get(id);
    if (!loc) throw new Error('unknown location ' + id);
    if (G.location && G.location !== loc) {
      G.location.root.visible = false;
      if (G.location.onExit) G.location.onExit(G);
    }
    loc.root.visible = true;
    G.location = loc;
    G.state.location = id;
    if (loc.exterior) atmos.setIndoor(false); else atmos.setIndoor(true, loc.fogColor ?? 0x15130f, loc.fogDensity ?? 0.03);
    const s = typeof spawn === 'string' ? loc.spawns[spawn] : spawn;
    if (s) player.place(s.x, s.y ?? 0, s.z, s.yaw ?? 0);
    player.ground = loc.ground || (() => 0);
    if (loc.onEnter) loc.onEnter(G);
    G.events.emit('enter', id);
  };

  G.teleport = async (id, spawn, opts = {}) => {
    G.cutscene++;
    await G.fade(1, opts.fadeOut ?? 0.6);
    G.enter(id, spawn);
    if (opts.during) await opts.during();
    await G.wait(opts.hold ?? 0.25);
    await G.fade(0, opts.fadeIn ?? 0.8);
    G.cutscene--;
  };

  // Interactables: things the player can use with E when looking at them.
  // { location, pos: Vector3, radius, label, enabled?(), use() }
  G.interact = (def) => { def.radius ??= 1.8; G.interactables.add(def); return () => G.interactables.delete(def); };

  // Triggers: run when the player enters an area.
  // { location, x, z, r | (hx, hz), once, enter(), exit?(), enabled?() }
  G.trigger = (def) => { def.inside = false; G.triggers.add(def); return () => G.triggers.delete(def); };

  G.onUpdate = (f) => { G.updaters.add(f); return () => G.updaters.delete(f); };

  // ------------------------------------------------------------ loop

  const tmpV = new THREE.Vector3();
  const tmpD = new THREE.Vector3();

  function pickFocus() {
    if (G.cutscene > 0 || G.paused) return null;
    const eye = camera.position;
    const dir = player.lookDir(tmpD);
    let best = null, bestScore = -Infinity;
    for (const it of G.interactables) {
      if (it.location && it.location !== G.state.location) continue;
      if (it.enabled && !it.enabled()) continue;
      tmpV.copy(it.pos).sub(eye);
      const d = tmpV.length();
      if (d > it.radius + 0.6) continue;
      const dot = tmpV.normalize().dot(dir);
      const need = d < 1.0 ? 0.55 : 0.82;
      if (dot < need) continue;
      const score = dot * 2 - d * 0.3;
      if (score > bestScore) { bestScore = score; best = it; }
    }
    return best;
  }

  function updateTriggers() {
    const p = player.pos;
    for (const t of G.triggers) {
      if (t.location && t.location !== G.state.location) { t.inside = false; continue; }
      if (t.enabled && !t.enabled()) { t.inside = false; continue; }
      let inside;
      if (t.r != null) inside = Math.hypot(p.x - t.x, p.z - t.z) < t.r;
      else inside = Math.abs(p.x - t.x) < t.hx && Math.abs(p.z - t.z) < t.hz;
      if (inside && !t.inside) {
        t.inside = true;
        if (t.once) G.triggers.delete(t);
        if (t.enter) t.enter();
      } else if (!inside && t.inside) {
        t.inside = false;
        if (t.exit) t.exit();
      }
    }
  }

  let last = performance.now();
  G.frame = (now = performance.now()) => {
    let dt = Math.min(G.debug.maxDt || 0.1, (now - last) / 1000);
    last = now;
    if (G.paused) dt = 0;
    G.time += dt;
    mats.globals.uTime.value = G.time;
    // clock
    if (!G.paused && !G.clock.paused && G.cutscene === 0) {
      const before = G.state.minutes;
      G.state.minutes += dt * G.clock.scale;
      if (Math.floor(before) !== Math.floor(G.state.minutes)) G.events.emit('minute', G.state.minutes);
    }
    // player
    if (!G.paused) {
      player.locked = G.cutscene > 0 || G.modal;
      player.lookLocked = !!G.lookLocked || G.modal;
      player.update(dt);
    }
    // waits
    for (let i = G.waiters.length - 1; i >= 0; i--) {
      const w = G.waiters[i];
      if ((w.pred && w.pred()) || G.time >= w.t) { G.waiters.splice(i, 1); w.res(w.pred ? !!w.pred() : true); }
    }
    if (!G.paused) {
      updateTriggers();
      G.focus = pickFocus();
      if (G.focus && (input.hit('KeyE') || input.hit('Mouse0')) && !G.modal) {
        const f = G.focus; f.use(G);
      }
      for (const f of [...G.updaters]) f(dt);
      if (G.location && G.location.update) G.location.update(dt, G);
      G.events.emit('update', dt);
    }
    atmos.update(dt, camera.position, G.state.minutes);
    const ext = !G.location || G.location.exterior;
    mats.globals.uNight.value = ext ? 1 - atmos.day : 0.3;
    mats.globals.uDayLum.value = ext ? 0.25 + atmos.day * (1.4 - atmos.w.cloud * 0.5) : 0.5;
    renderer.gl.toneMappingExposure = G.location && !G.location.exterior ? (G.location.exposure ?? 1.0) : atmos.exposure;
    art.telescreen.update(dt);
    renderer.render(dt);
    input.endFrame();
  };

  G.start = () => {
    const loop = (t) => { G.frame(t); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  };

  addEventListener('resize', () => renderer.resize());
  return G;
}
