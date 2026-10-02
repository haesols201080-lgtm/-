// 세계의 사건: 일식, 별비(별씨가 떨어지는 밤), 축제, 그리고 날마다 새로 생기는 아웬의 부탁.
// 이야기가 끝난 뒤에도 세렌이 계속 살아 있도록, 이 시스템이 새 목표와 변화를 만들어 냅니다.
import * as THREE from 'three';
import { glowMaterial } from '../world/materials.js';
import { heightAt } from '../world/heightfield.js';
import { mulberry32 } from '../core/noise.js';
import { PLACE, PLACES } from '../data/places.js';
import { NPCS, MOA, GLYPH_STONES } from '../data/story.js';

const FAR_NPCS = ['kael', 'moru', 'yuha', 'peon'];
import { WORDS } from '../data/lexicon.js';
import { bus } from '../core/events.js';

export class WorldEvents {
  constructor(game) {
    this.game = game;
    this.scene = game.engine.scene;
    this.eclipseState = 0;
    this.starDay = -1;
    this.stars = []; // 떨어진 별씨
    this.trails = [];
    this.festivalT = 0;
    const tg = new THREE.CylinderGeometry(0.3, 2.2, 1, 6, 1, true);
    tg.translate(0, 0.5, 0);
    this.trailGeo = tg;
  }

  update(dt) {
    const g = this.game;
    const c = g.world.clock;
    // 일식
    if (c.eclipseNear > 0.2 && this.eclipseState === 0) {
      this.eclipseState = 1;
      if (!g.state.flags.sawEclipse) { g.ui.moa(MOA.firstEclipse); g.state.flags.sawEclipse = true; }
      else g.ui.toast('일식 · 우르가 해를 삼킨다', { kind: 'place' });
    } else if (c.eclipseNear < 0.05 && this.eclipseState === 1) {
      this.eclipseState = 0;
      g.ui.toast('일식이 지나갔다', { kind: 'muted' });
    }
    // 별비: 날마다 정해진 확률로 밤에
    const day = c.day;
    const hour = c.hour;
    if (this.starDay !== day && (hour > 21 || hour < 3)) {
      this.starDay = day;
      const rnd = mulberry32(day * 977 + 5);
      if (day >= 1 && (rnd() < 0.45 || g.state.flags.forceStars)) this.starfall(rnd);
    }
    for (const s of this.trails) {
      s.t += dt;
      const k = Math.min(1, s.t / s.dur);
      const y = s.y0 + (s.y1 - s.y0) * k;
      s.m.position.set(s.x0 + (s.x1 - s.x0) * k, y, s.z0 + (s.z1 - s.z0) * k);
      s.m.material.uniforms.uIntensity.value = 3 * (1 - k * 0.3);
      if (k >= 1 && !s.landed) { s.landed = true; this.scene.remove(s.m); this._land(s); }
    }
    this.trails = this.trails.filter((s) => !s.landed);
    for (const s of this.stars) {
      if (s.taken) continue;
      s.core.rotation.y += dt * 2;
      s.core.position.y = s.y + 0.9 + Math.sin(g.time * 2 + s.x) * 0.15;
      if (hour > 6.5 && hour < 18) { this._remove(s); continue; }
      const pp = g.player.pos;
      if ((s.x - pp.x) ** 2 + (s.z - pp.z) ** 2 < 4 && Math.abs(s.y - pp.y) < 3) this._take(s);
    }
    this.stars = this.stars.filter((s) => !s.gone);
    // 축제의 빛
    if (g.state.flags.festival && g.world.atmos.state.night > 0.6) this._fireworks(dt);
  }

  /** 별씨가 떨어진다 */
  starfall(rnd = Math.random) {
    const g = this.game;
    const pp = g.player.pos;
    const n = 7 + Math.floor(rnd() * 5);
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2, r = 250 + rnd() * 2600;
      const x = pp.x + Math.cos(a) * r, z = pp.z + Math.sin(a) * r;
      const h = heightAt(x, z);
      if (h < 1) continue;
      const from = { x: x - 1800 + rnd() * 600, y: 5000, z: z - 1200 + rnd() * 400 };
      const m = new THREE.Mesh(this.trailGeo, glowMaterial({ color: 0xffe0a8, intensity: 3 }));
      const dir = new THREE.Vector3(x - from.x, h - from.y, z - from.z).normalize();
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
      m.scale.set(1, 140, 1);
      this.scene.add(m);
      this.trails.push({ m, x0: from.x, y0: from.y, z0: from.z, x1: x, y1: h, z1: z, t: -i * 1.7 - rnd() * 4, dur: 2.2 });
    }
    g.ui.moa('별비예요! 떨어진 별씨를 모아 두면 장인 온이 장비를 손봐 줄 거예요. 아침이 되면 빛이 사라져요.');
    g.audio.chime('word');
  }

  _land(s) {
    const g = this.game;
    const grp = new THREE.Group();
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.35, 0), glowMaterial({ color: 0xfff0c8, intensity: 3.5 }));
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.9, 80, 8, 1, true).translate(0, 40, 0), glowMaterial({ color: 0xffd27a, intensity: 0.8, fresnel: 0.5, side: THREE.DoubleSide }));
    grp.add(beam);
    this.scene.add(grp, core);
    grp.position.set(s.x1, s.y1, s.z1);
    core.position.set(s.x1, s.y1 + 1, s.z1);
    this.stars.push({ x: s.x1, y: s.y1, z: s.z1, grp, core });
    g.audio.noise({ freq: 300, dur: 0.8, gain: 0.5, pos: { x: s.x1, y: s.y1, z: s.z1 }, sweep: 80, type: 'lowpass' });
  }

  _take(s) {
    s.taken = true;
    this._remove(s);
    this.game.giveItem('starseed', 1);
    this.game.audio.chime('word');
  }

  _remove(s) { this.scene.remove(s.grp, s.core); s.gone = true; }

  festival() {
    const g = this.game;
    g.state.flags.festival = true;
    g.world.sky.hoopMat.uniforms.uLights.value = 2.4;
    g.ui.regionTitle('온 합창', '다섯 탑이 모두 노래한다. 오늘 밤 하모네아에서 축제가 열린다.', true);
  }

  _fireworks(dt) {
    this.festivalT -= dt;
    if (this.festivalT > 0) return;
    this.festivalT = 0.8 + Math.random() * 1.6;
    const g = this.game;
    if (Math.hypot(g.player.pos.x, g.player.pos.z) > 6000) return;
    const x = (Math.random() - 0.5) * 1800, z = (Math.random() - 0.5) * 1800, y = 700 + Math.random() * 500;
    const n = Math.floor(Math.random() * 5);
    g.resonance._wave(new THREE.Vector3(x, y, z), [0xffd27a, 0x7ff3e6, 0x7fb8ff, 0xffb8e8, 0xb9a6ff][n], 120);
    g.audio.tone(n, { pos: { x, y, z }, gain: 0.5, maxDist: 5000, octave: -1, wet: 0.9 });
  }
}

// ── 부탁: 날마다 새로 생기는 작은 목표 ─────────────────────────
const TEMPLATES = [
  (g, rnd) => { // 안부 전하기
    const reach = (n) => (FAR_NPCS.includes(n.id) ? !!g.state.flags.greatOpen : n.id === 'sol' ? !!g.state.flags.anchorVisit : true);
    const keepers = NPCS.filter((n) => n.id !== 'iel' && g.npcs.get(n.id) && reach(n));
    const n = keepers[Math.floor(rnd() * keepers.length)];
    const pool = NPCS.filter(reach);
    const from = pool[Math.floor(rnd() * pool.length)];
    if (!n || n.id === from.id) return null;
    return { kind: 'visit', npc: n.id, title: `${from.name}의 안부`, text: `${PLACE[n.place].name}의 ${n.name}에게 ${from.name}의 노래를 전하기`, reward: 2 };
  },
  (g, rnd) => { // 글자돌
    const left = GLYPH_STONES.filter((s) => !g.state.glyphs[s.id]);
    if (!left.length) return null;
    const pp = g.player.pos;
    const dist = (s) => { const o = g.discovery.glyph(s.id); return Math.hypot(o.x - pp.x, o.z - pp.z); };
    left.sort((a, b) => dist(a) - dist(b));
    const s = left[Math.floor(rnd() * Math.min(4, left.length))];
    return { kind: 'glyph', glyph: s.id, title: '잊힌 글자', text: '아직 읽지 않은 글자돌 하나 읽기', reward: 1 };
  },
  (g, rnd) => { // 하늘고래
    if (!g.state.tones.includes(4)) return null;
    return { kind: 'whale', title: '고래의 노래', text: '하늘고래에게 「고요」를 들려주기', reward: 3 };
  },
  (g, rnd) => { // 빛 밝히기
    if (!g.state.tones.includes(3)) return null;
    const cands = PLACES.filter((p) => ['vista', 'arch', 'pylon'].includes(p.type));
    const p = cands[Math.floor(rnd() * cands.length)];
    return { kind: 'tone', n: 3, place: p.id, title: '어둠 밝히기', text: `${p.name}에서 밤에 「빛」 연주하기`, night: true, reward: 2 };
  },
  (g, rnd) => { // 거신에 오르기
    if (!g.state.flags.greatOpen) return null;
    return { kind: 'walker', title: '걷는 마을', text: '느린땅의 거신 등에 올라 보기 (배 밑의 기류를 타요)', reward: 3 };
  },
  (g, rnd) => { // 하늘닻에서 뛰어내리기
    if (!g.state.flags.greatOpen) return null;
    const lands = ['깊은목', '느린땅', '흰 숨', '천 폭포 고원'];
    const k = Math.floor(rnd() * 4);
    return { kind: 'dive', region: ['rift', 'plains', 'icesea', 'falls'][k], title: '하늘에서 먼 땅으로', text: `하늘닻에서 뛰어내려 ${lands[k]}에 내리기`, reward: 4 };
  },
  (g, rnd) => { // 해류 타기
    const list = g.currents.list.filter((c) => c.enabled);
    const c = list[Math.floor(rnd() * list.length)];
    if (!c) return null;
    return { kind: 'ride', current: c.id, title: '흐름을 타고', text: `「${c.def.name}」를 끝까지 타기`, reward: 1 };
  },
];

export class Requests {
  constructor(game) {
    this.game = game;
    this.active = game.state.flags.requests || [];
    this.day = game.state.flags.requestDay ?? -1;
    bus.on('tone', (e) => this._check('tone', e));
    bus.on('convoDone', (e) => this._check('talk', e));
    bus.on('calm', () => this._check('whale'));
    bus.on('glyph', (e) => this._check('glyph', e));
    bus.on('currentDone', (e) => this._check('ride', e));
  }

  update(dt = 0) {
    const g = this.game;
    if (!g.quests.isDone('mq2')) return;
    // 거신 갑판 위에 섰는가, 하늘닻에서 뛰어내려 먼 땅에 내렸는가
    const p = g.player;
    if (p.pos.y > 25000) this._dived = true;
    if (this.active.length && p.state === 'ground') {
      const onWalker = p.groundC && p.groundC.obj && g.colossi && g.colossi.list.some((w) => w.deck === p.groundC.obj);
      if (onWalker) this._check('walker');
      if (this._dived && p.pos.y < 20000) {
        const reg = g.world.regionAt(p.pos.x, p.pos.z);
        this._check('dive', { region: reg && reg.id });
        this._dived = false;
      }
    }
    const day = g.world.clock.day;
    if (day !== this.day && g.world.clock.hour > 6) {
      this.day = day;
      const rnd = mulberry32(day * 131 + 7);
      const fresh = [];
      for (let k = 0; k < 6 && fresh.length < 2; k++) {
        const r = TEMPLATES[Math.floor(rnd() * TEMPLATES.length)](g, rnd);
        if (r && !fresh.find((x) => x.kind === r.kind) && !this.active.find((x) => x.title === r.title)) fresh.push(r);
      }
      this.active = [...this.active.slice(-2), ...fresh];
      g.state.flags.requests = this.active;
      g.state.flags.requestDay = day;
      if (fresh.length) g.ui.toast(`새 부탁 ${fresh.length}개 · 일지에서 볼 수 있어요`, { kind: 'quest' });
      g.ui.refreshObjective();
    }
  }

  hasVisit(npcId) { return this.active.some((r) => r.kind === 'visit' && r.npc === npcId); }

  _check(type, e) {
    const g = this.game;
    for (const r of [...this.active]) {
      let ok = false;
      if (r.kind === 'tone' && type === 'tone' && e.n === r.n) {
        const p = PLACE[r.place];
        ok = Math.hypot(e.pos.x - p.pos[0], e.pos.z - p.pos[1]) < 60 && (!r.night || g.world.atmos.state.night > 0.5);
      }
      if (r.kind === 'visit' && type === 'talk' && e.npc === r.npc) ok = true;
      if (r.kind === 'whale' && type === 'whale') ok = true;
      if (r.kind === 'glyph' && type === 'glyph' && e.id === r.glyph) ok = true;
      if (r.kind === 'ride' && type === 'ride' && e.id === r.current) ok = true;
      if (r.kind === 'walker' && type === 'walker') ok = true;
      if (r.kind === 'dive' && type === 'dive' && e.region === r.region) ok = true;
      if (ok) this._complete(r);
    }
  }

  _complete(r) {
    const g = this.game;
    this.active = this.active.filter((x) => x !== r);
    g.state.flags.requests = this.active;
    g.state.requestsDone++;
    g.giveItem('starseed', r.reward);
    // 모르는 단어 하나를 배운다
    const unknown = WORDS.filter((w) => !g.lang.known(w.id));
    if (unknown.length) g.lang.learn(unknown[Math.floor(Math.random() * unknown.length)].id, 'teach');
    g.ui.toast(`부탁 완료 · ${r.title}`, { kind: 'done' });
    g.ui.refreshObjective();
    g.audio.chime('quest');
  }
}
