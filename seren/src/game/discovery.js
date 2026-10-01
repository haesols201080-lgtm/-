// 발견: 글자돌(단어), 메아리(옛 기억), 조망점(지도 밝히기), 줍는 물건, 장소·지역 발견.
import * as THREE from 'three';
import { GLYPH_STONES, ECHOES, CODEX } from '../data/story.js';
import { PLACES, PLACE } from '../data/places.js';
import { REGIONS } from '../world/regions.js';
import { heightAt } from '../world/heightfield.js';
import { glyphStone, PAL, archMaterials } from '../world/arch.js';
import { merge, xf } from '../world/geo-utils.js';
import { glowMaterial } from '../world/materials.js';
import { WORD } from '../data/lexicon.js';
import { mulberry32 } from '../core/noise.js';
import { bus } from '../core/events.js';

const PICKUP_SETS = {
  sled: { label: '썰매 부품', at: 'crash', spots: [[-140, 90], [190, -60], [60, 240]] },
};

function resolve(at, off = [0, 0]) {
  if (Array.isArray(at)) return [at[0] + off[0], at[1] + off[1]];
  const p = PLACE[at];
  return p ? [p.pos[0] + off[0], p.pos[1] + off[1]] : [off[0], off[1]];
}

export class Discovery {
  constructor(game) {
    this.game = game;
    this.scene = game.engine.scene;
    const mats = archMaterials();
    // 글자돌
    this.glyphs = GLYPH_STONES.map((d, i) => {
      const [x, z] = resolve(d.at, d.off);
      const y = d.y ?? game.world.groundAt(x, z);
      const rot = mulberry32(i + 5)() * 6.28;
      const m = new THREE.Mesh(merge(glyphStone({ seed: i + 1 }).map((g) => xf(g, { ry: rot }))), mats.stone);
      m.position.set(x, y - 0.15, z);
      this.scene.add(m);
      game.world.colliders.add({ type: 'cyl', x, z, r: 0.8, y0: y - 1, y1: y + 3.3, walk: false });
      return { ...d, x, y, z, mesh: m };
    });
    this.glyphById = new Map(this.glyphs.map((g) => [g.id, g]));
    // 메아리: 땅 위에 일렁이는 빛
    const shimmerGeo = new THREE.CylinderGeometry(0.7, 1.2, 3.2, 14, 1, true);
    shimmerGeo.translate(0, 1.6, 0);
    this.echoes = ECHOES.map((d) => {
      const [x, z] = resolve(d.at, d.off);
      const y = d.y === 'deck' ? game.structures.deckY : d.y ?? game.world.groundAt(x, z, 1e5);
      const m = new THREE.Mesh(shimmerGeo, glowMaterial({ color: 0xb9a6ff, intensity: 0.9, fresnel: 1, side: THREE.DoubleSide }));
      m.position.set(x, y, z);
      this.scene.add(m);
      const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.35, 0), glowMaterial({ color: 0xe0d4ff, intensity: 1.2 }));
      core.position.set(x, y + 1.6, z);
      this.scene.add(core);
      return { ...d, x, y, z, mesh: m, core };
    });
    // 줍기
    this.pickups = [];
    for (const [setId, set] of Object.entries(PICKUP_SETS)) {
      if (game.state.flags['pickups:' + setId]) this.spawnPickups(setId);
    }
    this.lastRegion = null;
    this.regionCheckT = 0;
  }

  glyph(id) { return this.glyphById.get(id); }

  spawnPickups(setId) {
    const set = PICKUP_SETS[setId];
    if (!set) return;
    const g = this.game;
    g.state.flags['pickups:' + setId] = true;
    const taken = g.state.flags['taken:' + setId] || [];
    set.spots.forEach((off, i) => {
      if (this.pickups.find((p) => p.set === setId && p.i === i)) return;
      const [x, z] = resolve(set.at, off);
      const y = g.world.groundAt(x, z);
      const m = new THREE.Group();
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.35, 0.6), archMaterials().stone);
      const glow = new THREE.Mesh(new THREE.OctahedronGeometry(0.25, 0), glowMaterial({ color: 0xff7a52, intensity: 3 }));
      glow.position.y = 0.6;
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.4, 60, 6, 1, true).translate(0, 30, 0), glowMaterial({ color: 0xff8a5a, intensity: 0.7, fresnel: 0.5, side: THREE.DoubleSide }));
      m.add(box, glow, beam);
      m.position.set(x, y + 0.2, z);
      this.scene.add(m);
      const p = { set: setId, i, x, y, z, mesh: m, taken: taken.includes(i) };
      m.visible = !p.taken;
      this.pickups.push(p);
    });
  }

  /** 상호작용 가능한 가장 가까운 것 */
  nearestInteract(pos) {
    const g = this.game;
    let best = null, bd = 9;
    const consider = (o, d2, kind, label) => { if (d2 < bd) { bd = d2; best = { kind, o, label }; } };
    for (const s of this.glyphs) consider(s, (s.x - pos.x) ** 2 + (s.z - pos.z) ** 2 + ((s.y - pos.y) * 0.5) ** 2, 'glyph', g.state.glyphs[s.id] ? '글자돌 다시 보기' : '글자돌 읽기');
    for (const e of this.echoes) {
      if (e.eclipseOnly && g.world.clock.eclipse < 0.3 && !g.state.echoes[e.id]) continue;
      consider(e, (e.x - pos.x) ** 2 + (e.z - pos.z) ** 2 + ((e.y - pos.y) * 0.5) ** 2, 'echo', g.state.echoes[e.id] ? `메아리 · ${e.title}` : g.state.tones.includes(1) ? '「열림」으로 메아리 열기' : '일렁이는 빛 (무언가 잠겨 있다)');
    }
    for (const v of g.structures.vistas.values()) consider(v, ((v.x - pos.x) ** 2 + (v.z - pos.z) ** 2) * 0.4 + ((v.y - pos.y) * 0.5) ** 2, 'vista', g.state.vistas[v.id] ? '풍경 바라보기' : '조망점 살피기');
    for (const p of this.pickups) if (!p.taken) consider(p, ((p.x - pos.x) ** 2 + (p.z - pos.z) ** 2) * 0.5, 'pickup', '줍기');
    for (const P of g.structures.pylons.values()) {
      const d2 = ((P.x - pos.x) ** 2 + (P.z - pos.z) ** 2) / 30 + ((P.y + 5 - pos.y) * 0.4) ** 2;
      if (!P.alive) consider(P, d2, 'pylon', '공명탑에 손 대기');
    }
    // 전망대
    const dy = g.structures.deckY;
    if (dy && Math.abs(pos.y - dy) < 4 && Math.hypot(pos.x, pos.z) < 95) consider({ id: 'spine-deck', x: 0, y: dy, z: 0, deck: true }, 4, 'deck', g.state.vistas['spine-deck'] ? '세렌을 내려다보기' : '세렌을 내려다보기');
    return best;
  }

  interact(t) {
    const g = this.game;
    if (t.kind === 'glyph') this.readGlyph(t.o);
    else if (t.kind === 'echo') this.openEcho(t.o);
    else if (t.kind === 'vista') g.vista(t.o.id, t.o);
    else if (t.kind === 'deck') g.vista('spine-deck', { x: 0, y: g.structures.deckY + 2, z: 0, place: { name: '척추 전망대' } });
    else if (t.kind === 'pickup') this.take(t.o);
    else if (t.kind === 'pylon') g.resonance.startPylon(t.o);
  }

  readGlyph(s) {
    const g = this.game;
    const first = !g.state.glyphs[s.id];
    g.state.glyphs[s.id] = true;
    const w = WORD[s.word];
    g.ui.glyphCard(s.word, first);
    bus.emit('glyph', { id: s.id });
    if (first) {
      g.lang.learn(s.word, 'stone');
      g.audio.sing(w.notes, { gain: 0.3 });
    }
    g.save();
  }

  openEcho(e) {
    const g = this.game;
    if (!g.state.echoes[e.id]) {
      if (!g.state.tones.includes(1)) { g.ui.moa('빛 속에 무언가 잠겨 있어요. 무언가를 「여는」 소리가 필요할 것 같아요.'); return; }
      // 열림을 연주해야 열린다 — 근처에서 1번 음을 연주하면 resonance → bus 'tone' 으로 열림
      g.ui.moa('「열림」을 연주해 보세요.');
      return;
    }
    g.ui.memory(e);
  }

  /** 열림 연주 시 근처 메아리 열기 */
  onTone(n, pos) {
    if (n !== 1) return;
    const g = this.game;
    for (const e of this.echoes) {
      if (g.state.echoes[e.id]) continue;
      if (e.eclipseOnly && g.world.clock.eclipse < 0.3) continue;
      if (Math.hypot(e.x - pos.x, e.z - pos.z) < 14 && Math.abs(e.y - pos.y) < 10) {
        g.state.echoes[e.id] = true;
        for (const w of e.words || []) g.lang.learn(w, 'teach');
        g.audio.chime('discover');
        setTimeout(() => g.ui.memory(e), 700);
        g.save();
      }
    }
  }

  take(p) {
    const g = this.game;
    p.taken = true;
    p.mesh.visible = false;
    const arr = g.state.flags['taken:' + p.set] || [];
    arr.push(p.i);
    g.state.flags['taken:' + p.set] = arr;
    for (const id of g.state.quests.active) {
      const st = g.quests.step(id);
      if (st && st.type === 'pickup' && st.set === p.set) g.state.quests.data[id].picked = (g.state.quests.data[id].picked || 0) + 1;
    }
    g.audio.chime('word');
    g.ui.toast(`${PICKUP_SETS[p.set].label}를 주웠다`, { kind: 'item' });
    g.ui.refreshObjective();
  }

  update(dt) {
    const g = this.game;
    const t = g.time;
    for (const e of this.echoes) {
      const open = g.state.echoes[e.id];
      const hidden = e.eclipseOnly && g.world.clock.eclipse < 0.3 && !open;
      e.mesh.visible = !hidden;
      e.core.visible = !hidden;
      e.mesh.material.uniforms.uIntensity.value = (open ? 0.2 : 0.45 + Math.sin(t * 2 + e.x) * 0.15) * (0.4 + g.world.atmos.u.uGlow.value * 0.6);
      e.core.material.uniforms.uIntensity.value = (open ? 0.35 : 0.9) * (0.45 + g.world.atmos.u.uGlow.value * 0.55);
      e.core.position.y = e.y + 1.6 + Math.sin(t * 1.5 + e.z) * 0.2;
      e.core.rotation.y = t;
    }
    for (const p of this.pickups) if (!p.taken) p.mesh.children[1].rotation.y = t * 2;
    // 장소·지역 발견 (0.5초마다)
    this.regionCheckT -= dt;
    if (this.regionCheckT > 0) return;
    this.regionCheckT = 0.5;
    const pp = g.player.pos;
    for (const p of PLACES) {
      if (g.state.discovered[p.id] || p.type === 'lift' || p.type === 'none') continue;
      const r = Math.min(p.radius || 60, 400);
      if (Math.hypot(pp.x - p.pos[0], pp.z - p.pos[1]) < r + 30) {
        g.state.discovered[p.id] = Date.now();
        g.ui.toast(`발견 · ${p.name}`, { kind: 'place', sub: p.desc });
        g.audio.chime('discover');
      }
    }
    const reg = g.world.regionAt(pp.x, pp.z);
    if (reg && reg.id !== this.lastRegion) {
      const prev = this.lastRegion;
      this.lastRegion = reg.id;
      if (prev !== null || !g.state.flags['region:' + reg.id]) {
        if (!g.state.flags['region:' + reg.id] || prev !== null) g.ui.regionTitle(reg.name, reg.desc, !g.state.flags['region:' + reg.id]);
        g.state.flags['region:' + reg.id] = true;
      }
    }
  }
}

export { CODEX, REGIONS, PAL };
