// 시설의 쓰임: 시설지기에게 말을 걸면 그 건물이 하는 일을 고를 수 있습니다.
//  공방(장비·탐지기·빛깔) · 서고(옛 책·단어) · 별지도 방(지도 펼치기·남은 것 찾기) · 쉼터(쉬기·쉼터 사이 이동)
//  온실(별씨 심기·거두기) · 음악당(날마다 합창) · 소식탑(소포·부탁) · 기상탑(오늘의 하늘) · 선착장(연락선·나룻배)
// 모델과 자리는 world/facilities.js, 목록은 data/facilities.js.
import * as THREE from 'three';
import { BOOKS } from '../data/facilities.js';
import { WORDS } from '../data/lexicon.js';
import { AMBIENT } from '../data/story.js';
import { PLACES } from '../data/places.js';
import { ferryGeo, boatMaterial } from '../world/boats.js';
import { atmosUniforms } from '../world/atmosphere.js';
import { mulberry32, hashStr } from '../core/noise.js';
import { won } from '../data/money.js';
import { josa } from '../core/josa.js';

const UP_COST = [3, 5, 8];
const DETECT_COST = [[3, 0], [6, 1], [9, 2]];
export const DETECT_RANGE = [0, 500, 1200, 2500];
const GROW = 1; // 온실: 심고 하루가 지나면 핀다
export const PALETTES = [
  { name: '물빛', wing: 0x3aa8c8, scarf: 0xff6a4a },
  { name: '노을', wing: 0xd8883a, scarf: 0xffd27a },
  { name: '꽃잎', wing: 0xc85aa0, scarf: 0xb9a6ff },
  { name: '별빛', wing: 0x8a7ad8, scarf: 0x7ff3e6 },
  { name: '서리', wing: 0x9ac8e8, scarf: 0xf2f6ff },
];
const GREET = [
  { words: ['you', 'come', 'thanks'], ko: '와 주어 고마워.' },
  { words: ['we', 'sing', 'together'], ko: '우리 함께 노래하자.' },
  { words: ['here', 'home', 'you'], ko: '여기도 너의 집이야.' },
];
const WEATHER = {
  stars: { name: '별비 부르기', sub: '오늘 밤 별씨가 떨어진다', color: 0xffd27a },
  aurora: { name: '오로라 짙게', sub: '오늘 밤 북쪽 하늘의 빛 커튼이 세 배로 짙어진다', color: 0x6dfcd0 },
  clear: { name: '하늘 맑게', sub: '한나절 동안 안개가 걷혀 아주 멀리까지 보인다', color: 0xbfe0ff },
  fog: { name: '안개 깔기', sub: '한나절 동안 낮은 안개가 깔린다 (고요한 산책)', color: 0xd8d0ff },
};

const km = (d) => (d >= 1000 ? `${(d / 1000).toFixed(1)} km` : `${Math.round(d)} m`);

export class Services {
  constructor(game) {
    this.game = game;
    this.fac = game.facilities;
    this.rented = null;
    this._scanT = 0;
    this._marks = [];
    // 시설지기
    for (const F of this.fac.list) {
      const rnd = mulberry32(hashStr(F.id));
      const n = game.npcs._spawn({
        id: 'fac-' + F.id, name: F.info.keeper, service: F.id,
        x: F.keeper.x, z: F.keeper.z, y: F.keeper.y,
        hue: rnd(), glow: F.info.color, scale: 0.9 + rnd() * 0.12, home: { x: F.keeper.x, z: F.keeper.z, r: 0.5 },
      });
      n.fig.yaw = F.yaw;
      F.npc = n;
    }
    for (const [i, l] of GREET.entries()) game.lines['fac_greet_' + i] = { id: 'fac_greet_' + i, ...l };
    // 선착장 사이를 오가는 연락선 (타는 동안만 보인다)
    this.rideFerry = new THREE.Mesh(ferryGeo(), boatMaterial());
    this.rideFerry.visible = false;
    this.rideFerry.frustumCulled = false;
    game.engine.scene.add(this.rideFerry);
  }

  get S() { return this.game.state.facility; }
  get day() { return this.game.world.clock.day; }
  usedToday(key) { return this.S.daily[key] === this.day; }
  useToday(key) { this.S.daily[key] = this.day; }

  /** 불러온 뒤: 빛깔 등 반영 */
  applyState() {
    this.applyCosmetic();
  }

  applyCosmetic() {
    const a = this.game.avatar;
    const p = PALETTES[this.S.cosmetic % PALETTES.length] || PALETTES[0];
    a.wingMat.uniforms.uEmissive.value.set(p.wing).multiplyScalar(0.9);
    a.scarf.material.uniforms.uColor.value.set(p.scarf);
  }

  // ── 시설 열기 ─────────────────────────────
  open(F) {
    const g = this.game;
    this._visit(F, true);
    g.requests.check('facility', { id: F.id });
    g.say(F.npc, g.lines['fac_greet_' + Math.floor(Math.random() * GREET.length)], false);
    this['_' + F.type](F);
  }

  _kicker(F) { return `${F.info.icon} ${F.info.name} · ${F.info.keeper}`; }

  _stat() {
    const s = this.game.state;
    return `<div class="svc-stat"><span>돈 <b>${won(s.inv.starseed || 0)}</b></span><span>별씨 <b>${s.inv.seedstar || 0}</b></span><span>결정 조각 <b>${s.inv.shard || 0}</b></span></div>`;
  }

  /** 값: mat 'money' = 돈(울, 그 구역 공공 몫으로) · 'seed' = 별씨(재료 — 녹이거나 심어서 없어진다) */
  _pay(cost, shard = 0, mat = 'money') {
    const inv = this.game.state.inv;
    const have = mat === 'seed' ? inv.seedstar || 0 : inv.starseed || 0;
    if (have < cost || (inv.shard || 0) < shard) return false;
    const E = this.game.econ;
    if (mat === 'seed') inv.seedstar = have - cost;
    else if (E && this.game.city) E.charge(cost, '시설 이용', 'commons'); else inv.starseed -= cost;
    inv.shard = (inv.shard || 0) - shard;
    return true;
  }

  giveShard(n = 1) {
    const inv = this.game.state.inv;
    inv.shard = (inv.shard || 0) + n;
    this.game.ui.toast(`결정 조각 +${n} (모두 ${inv.shard})`, { kind: 'item' });
  }

  _burst(F, lx, ly, lz, color, count = 30) {
    const p = this.fac.toWorld(F, lx, ly, lz);
    this.game.particles.emit({ pos: p, count, spread: 2.5, up: 3, life: 1.3, size: [0.2, 0.6], color, alpha: 1, add: true, drag: 1.5 });
  }

  // ── 공방 ─────────────────────────────────
  _workshop(F) {
    const g = this.game, s = g.state, up = g.player.upgrades;
    const items = [{ head: '장비 손보기' }];
    const opts = [
      { k: 'glide', name: '날개 다듬기', desc: '활공이 더 멀리, 더 빠르게', max: 3 },
      { k: 'skim', name: '썰매 공명 강화', desc: '썰매 최고 속도 +12%', max: 3, need: !!s.flags.skimmer },
      { k: 'rise', name: '솟음 증폭', desc: '공중에서 「솟음」을 한 번 더', max: 2 },
    ];
    for (const o of opts) {
      const lv = up[o.k] || 0, c = UP_COST[lv];
      items.push({
        label: `${o.name} · ${lv}/${o.max}`,
        sub: lv >= o.max ? '최고 단계' : o.need === false ? '썰매를 고친 뒤에 손볼 수 있어요' : `${o.desc} — 별씨 ${c}`,
        disabled: lv >= o.max || o.need === false || (s.inv.seedstar || 0) < c,
        onClick: () => { if (!this._pay(c, 0, 'seed')) return; up[o.k] = lv + 1; this._crafted(F, `${o.name} ${lv + 1}단계`); },
      });
    }
    const dl = up.detector || 0;
    if (dl < 3) {
      const [c, sh] = DETECT_COST[dl];
      items.push({
        label: `울림 탐지기 · ${dl}/3`,
        sub: `읽지 않은 글자돌과 잠긴 메아리를 나침반에 ${km(DETECT_RANGE[dl + 1])}까지 보여 준다 — 별씨 ${c}${sh ? ` · 결정 조각 ${sh}` : ''}`,
        disabled: (s.inv.seedstar || 0) < c || (s.inv.shard || 0) < sh,
        onClick: () => { if (!this._pay(c, sh, 'seed')) return; up.detector = dl + 1; this._crafted(F, `울림 탐지기 ${dl + 1}단계`); if (!dl) g.ui.moa('탐지기가 붙었어요. 나침반에 보라색 점이 뜨면 그쪽에 아직 읽지 않은 것이 있어요.'); },
      });
    } else items.push({ label: '울림 탐지기 · 3/3', sub: `${km(DETECT_RANGE[3])}까지 듣는다`, disabled: true });
    items.push({ head: '꾸미기' });
    const next = (this.S.cosmetic + 1) % PALETTES.length;
    items.push({
      label: `날개·목도리 빛깔 → 「${PALETTES[next].name}」`, sub: `지금은 「${PALETTES[this.S.cosmetic % PALETTES.length].name}」 — 별씨 1`,
      disabled: (s.inv.seedstar || 0) < 1,
      onClick: () => { if (!this._pay(1, 0, 'seed')) return; this.S.cosmetic = next; this.applyCosmetic(); this._crafted(F, `빛깔 「${PALETTES[next].name}」`); },
    });
    g.ui.serviceCard(this._kicker(F), F.name, '공명 용광로가 별씨를 녹여, 장비에 새 노래를 새긴다. 결정 조각은 음악당과 온실에서 얻을 수 있어요.', items, this._stat());
  }

  _crafted(F, what) {
    const g = this.game;
    g.state.upgrades = { ...g.player.upgrades };
    g.audio.chime('quest');
    g.audio.noise({ freq: 2400, dur: 0.5, gain: 0.25, sweep: 600 });
    this._burst(F, 0, 1.6, 0, 0xffc46a, 40);
    g.ui.toast(`손봤다 · ${what}`, { kind: 'item' });
    g.save();
  }

  // ── 서고 ─────────────────────────────────
  _library(F) {
    const g = this.game, s = g.state;
    const books = BOOKS.filter((b) => b.at === F.id);
    const items = [{ head: '옛 책' }];
    for (const b of books) {
      const read = !!this.S.books[b.id];
      items.push({ label: `「${b.title}」`, sub: read ? '다시 읽기' : '처음 읽으면 아웬의 말 하나를 확실히 알게 된다', primary: !read, onClick: () => this.readBook(b) });
    }
    const unknown = WORDS.filter((w) => !g.lang.known(w.id));
    items.push({ head: '배우기' });
    items.push({
      label: '서고지기에게 말 배우기', sub: unknown.length ? `모르는 단어 하나를 배운다 — 2울 · 아직 모르는 말 ${unknown.length}개` : '세렌의 말을 모두 알아요',
      disabled: !unknown.length || s.inv.starseed < 2,
      onClick: () => {
        if (!this._pay(2)) return;
        const w = unknown[Math.floor(Math.random() * unknown.length)];
        g.lang.learn(w.id, 'teach');
        g.audio.sing(w.notes, { gain: 0.3 });
        g.save();
      },
    });
    const n = Object.keys(this.S.books).length;
    g.ui.serviceCard(this._kicker(F), F.name, `결정판에 새긴 옛 노래가 책장마다 빛난다. 세렌의 서고에서 읽은 책 ${n}/${BOOKS.length}권.`, items, this._stat());
  }

  readBook(b) {
    const g = this.game;
    const first = !this.S.books[b.id];
    this.S.books[b.id] = true;
    g.ui._card(`<div class="kicker">노래 서고 · 옛 책</div><h2>${b.title}</h2><div class="memo">${b.text}</div>`);
    if (first) {
      g.lang.learn(b.word, 'teach');
      g.journalNote(`서고에서 「${b.title}」를 읽었다.`);
      g.save();
    }
  }

  // ── 별지도 방 ─────────────────────────────
  _maproom(F) {
    const g = this.game;
    const whole = !!F.def.world;
    const done = !!this.S.daily['map:' + F.id];
    const items = [{
      label: whole ? '세렌 전체를 펼치기' : '둘레 7 km 를 펼치기', sub: done ? '이미 펼쳤어요 · 지도 보기' : '지도의 안개가 걷힌다', primary: !done,
      onClick: () => {
        if (!done) {
          this.S.daily['map:' + F.id] = true;
          if (whole) g.mapData.reveal(0, 0, 90000);
          else g.mapData.reveal(F.x, F.z, 7000);
          g.audio.chime('discover');
          g.ui.toast(whole ? '세렌의 모든 땅이 지도에 그려졌다' : '지도의 둘레가 밝혀졌다', { kind: 'place' });
          g.save();
        }
        setTimeout(() => g.ui.openMenu('map'), done ? 0 : 600);
      },
    }, { head: '남은 것 찾기 · 가장 가까운 곳에 표식' }];
    for (const kind of ['glyph', 'echo', 'place']) {
      const t = this.nearestLeft(kind);
      const name = { glyph: '읽지 않은 글자돌', echo: '잠긴 메아리', place: '못 가 본 곳' }[kind];
      items.push({ label: name, sub: t ? `${t.name} · ${km(t.d)}` : '남은 것이 없어요', disabled: !t, onClick: () => this.mark(t) });
    }
    g.ui.serviceCard(this._kicker(F), F.name, whole ? '하늘닻의 유리 아래, 세렌 전체가 빛으로 떠 있다.' : '탁자 위에 둘레 14 km 의 땅이 빛으로 솟아 있다.', items);
  }

  /** 아직 남은 것 중 가장 가까운 것 */
  nearestLeft(kind, from = this.game.player.pos) {
    const g = this.game, s = g.state;
    let best = null;
    const consider = (x, z, name) => { const d = Math.hypot(x - from.x, z - from.z); if (!best || d < best.d) best = { x, z, name, d }; };
    if (kind === 'glyph') for (const o of g.discovery.glyphs) { if (!s.glyphs[o.id]) consider(o.x, o.z, '글자돌'); }
    if (kind === 'echo') for (const o of g.discovery.echoes) { if (!s.echoes[o.id]) consider(o.x, o.z, o.eclipseOnly ? '일식 때만 보이는 메아리' : '메아리'); }
    if (kind === 'place') for (const p of PLACES) { if (!s.discovered[p.id] && p.type !== 'lift' && p.type !== 'none' && p.name) consider(p.pos[0], p.pos[1], p.name); }
    return best;
  }

  mark(t) {
    const g = this.game;
    g.state.waypoint = { x: t.x, z: t.z };
    g.updateWaypoint();
    g.audio.chime('soft');
    g.ui.toast(`표식 · ${t.name}`, { kind: 'place', sub: `${km(t.d)} · 나침반의 흰 점을 따라가세요` });
  }

  // ── 쉼터 ─────────────────────────────────
  _rest(F) {
    const g = this.game;
    const items = [{ head: '쉬기 (시간이 흐른다)' }];
    for (const [label, frac] of [['아침까지', 0.27], ['한낮까지', 0.5], ['저녁까지', 0.74], ['밤까지', 0.92]]) {
      items.push({ label: `${label} 쉬기`, onClick: () => { g.rest(frac); this._burst(F, 0, 1.2, 1, 0xffb060, 20); } });
    }
    items.push({ head: '쉼터 사이 오가기' });
    const others = this.fac.list.filter((X) => X.type === 'rest' && X !== F && this.S.visited[X.id]);
    const pp = g.player.pos;
    others.sort((a, b) => Math.hypot(a.x - pp.x, a.z - pp.z) - Math.hypot(b.x - pp.x, b.z - pp.z));
    for (const X of others) items.push({ label: X.name, sub: `${this._regionName(X)} · ${km(Math.hypot(X.x - pp.x, X.z - pp.z))}`, onClick: () => this.travelTo(X) });
    if (!others.length) items.push({ label: '아직 기억한 쉼터가 없어요', sub: '다른 마을의 쉼터에 들르면, 쉼터지기들이 노래를 이어 길을 열어 줘요', disabled: true });
    g.ui.serviceCard(this._kicker(F), F.name, '화롯불 곁에서 쉬어 가요. 들른 쉼터끼리는 노래로 이어져 있어 한숨에 오갈 수 있어요.', items);
  }

  _regionName(F) {
    const r = this.game.world.regionAt(F.x, F.z);
    return F.y > 20000 ? '하늘닻' : r ? r.name : '';
  }

  /** 다른 쉼터로 (빛으로 접혔다 펼쳐진다) */
  travelTo(X) {
    const g = this.game;
    g.setMode('cinematic');
    g.ui.fade(true);
    g.audio.noise({ freq: 900, q: 0.7, dur: 2.2, gain: 0.4, type: 'bandpass', sweep: 3000, attack: 0.8 });
    setTimeout(() => {
      const P = this.fac.toWorld(X, 0, 0, X.R + 3.5);
      g.player.teleport(P.x, X.y > 20000 ? X.y + 1 : undefined, P.z);
      g.player.yaw = X.yaw + Math.PI;
      g.rig.yaw = X.yaw;
      g.mapData.reveal(P.x, P.z, 900);
      this.S.visited[X.id] = true;
      setTimeout(() => {
        g.ui.fade(false);
        g.setMode('play');
        g.ui.regionTitle(X.name, '쉼터지기의 노래를 따라 왔다', false);
        g.save();
      }, 900);
    }, 1300);
  }

  // ── 온실 ─────────────────────────────────
  _garden(F) { return this.S.garden[F.id] || (this.S.garden[F.id] = [null, null, null]); }

  _greenhouse(F) {
    const g = this.game, s = g.state;
    const G = this._garden(F);
    const now = g.world.clock.time;
    const items = [];
    G.forEach((t, i) => {
      if (t === null) items.push({ label: `${i + 1}번 밭 · 비어 있다`, sub: '별씨 1개를 심는다 — 하루가 지나면 꽃이 핀다', disabled: (s.inv.seedstar || 0) < 1, onClick: () => { if (!this._pay(1, 0, 'seed')) return; G[i] = g.world.clock.time; g.audio.chime('soft'); g.ui.toast(`${i + 1}번 밭에 별씨를 심었다`, { kind: 'item' }); g.save(); } });
      else {
        const k = (now - t) / GROW;
        if (k >= 1) items.push({ label: `${i + 1}번 밭 · 꽃이 활짝 피었다`, sub: '거두기 — 별씨 3 · 가끔 결정 조각이나 새 말', primary: true, onClick: () => this.harvest(F, i) });
        else items.push({ label: `${i + 1}번 밭 · 자라는 중 ${Math.floor(k * 100)}%`, sub: `${Math.ceil((1 - k) * 24)}시간 뒤에 핀다 · 쉼터에서 쉬면 금방이에요`, disabled: true });
      }
    });
    g.ui.serviceCard(this._kicker(F), F.name, '별씨는 세렌의 흙에서 빛꽃으로 자라고, 꽃은 별씨를 셋 맺는다.', items, this._stat());
  }

  harvest(F, i) {
    const g = this.game;
    this._garden(F)[i] = null;
    g.giveItem('seedstar', 3);
    if (Math.random() < 0.3) this.giveShard(1);
    if (Math.random() < 0.15) {
      const unknown = WORDS.filter((w) => !g.lang.known(w.id));
      if (unknown.length) g.lang.learn(unknown[Math.floor(Math.random() * unknown.length)].id, 'teach');
    }
    const pl = F.plots[i];
    this._burst(F, pl.lx, 1.6, pl.lz, 0x6dfcd0, 36);
    g.audio.chime('word');
    g.save();
  }

  // ── 음악당 ───────────────────────────────
  _hall(F) {
    const g = this.game;
    const done = this.usedToday('hall:' + F.id);
    const few = g.state.tones.length < 2;
    const items = [
      {
        label: '오늘의 합창에 끼기', primary: !done && !few,
        sub: done ? '오늘은 함께 불렀어요 · 내일 다시 와요' : few ? '공명 음을 둘 이상 알아야 해요' : '합창지기의 선율을 듣고 똑같이 연주하기 — 2울 · 결정 조각 1',
        disabled: done || few, onClick: () => this.choir(F),
      },
      { label: '한 소절 듣기', sub: '합창지기가 노래한다 (자주 들으면 말을 짐작하게 돼요)', onClick: () => { const l = AMBIENT[Math.floor(Math.random() * AMBIENT.length)]; const id = `amb_${AMBIENT.indexOf(l)}`; g.lines[id] = { id, ...l }; g.say(F.npc, g.lines[id], true); F.extra.choir = Math.max(F.extra.choir, 0.5); } },
    ];
    g.ui.serviceCard(this._kicker(F), F.name, '아웬은 날마다 한 번, 같은 노래를 모두 함께 부른다. 그 노래로 도시의 울림을 고른다.', items);
  }

  choir(F) {
    const g = this.game;
    const tones = g.state.tones;
    const rnd = mulberry32(hashStr(F.id) + this.day * 31);
    const melody = Array.from({ length: 5 + Math.min(2, Math.floor(tones.length / 2)) }, () => tones[Math.floor(rnd() * tones.length)]);
    const c = this.fac.toWorld(F, F.choirLocal[0], 2, F.choirLocal[1]);
    F.extra.choir = 1;
    g.resonance.startSong({ id: 'hall-' + F.id, x: c.x, y: c.y - 30, z: c.z }, melody, () => {
      this.useToday('hall:' + F.id);
      F.extra.choir = 1.6;
      melody.forEach((n, i) => {
        g.audio.tone(n, { delay: 0.3 + i * 0.32, gain: 0.45, pos: c, octave: 1, wet: 0.9 });
        g.audio.tone(n, { delay: 0.3 + i * 0.32, gain: 0.35, pos: c, octave: -1, wet: 0.9 });
      });
      this._burst(F, 0, 4, -F.R * 0.2, 0xff9fd0, 50);
      g.giveItem('starseed', 2);
      this.giveShard(1);
      g.ui.toast('합창이 도시에 울린다', { kind: 'done', sub: '내일 또 같은 시간에 모여요' });
      g.save();
    }, '합창지기의 노래를 들으세요…');
    if (!g.state.flags.moaChoir) { g.state.flags.moaChoir = true; g.ui.moa('먼저 들어요. 그리고 1부터 5까지, 들은 그대로 연주해요.'); }
  }

  // ── 소식탑 ───────────────────────────────
  _courier(F) {
    const g = this.game, R = g.requests;
    const board = R.active.length
      ? `<div style="text-align:left;margin:10px 0">${R.active.map((r) => `<div class="qitem"><div class="qt">${r.title}</div><div class="qs">${r.text} · ${won(r.reward)}</div></div>`).join('')}</div>`
      : '<p>게시판이 비어 있다.</p>';
    const parcelDone = this.usedToday('parcel:' + F.id);
    const boardDone = this.usedToday('board');
    const items = [
      { label: '소포 나르기', sub: parcelDone ? '오늘 이 탑의 소포는 다 나갔어요' : '먼 시설로 가는 소포를 맡는다 — 받는 이에게 전하면 품삯(울)', primary: !parcelDone, disabled: parcelDone || R.active.length >= 6, onClick: () => this.parcel(F) },
      { label: '새 부탁 받기', sub: boardDone ? '오늘 새로 온 부탁은 이미 받았어요' : '게시판에 하나를 더 붙인다', disabled: boardDone || R.active.length >= 6, onClick: () => { const r = R.addOne(); if (r) { this.useToday('board'); g.ui.toast(`새 부탁 · ${r.title}`, { kind: 'quest', sub: r.text }); } else g.ui.toast('지금은 새 부탁이 없어요', { kind: 'muted' }); } },
    ];
    g.ui.serviceCard(this._kicker(F), F.name, `일벌들이 꼭대기 창구에서 세렌 곳곳으로 소식을 나른다. 들어준 부탁 ${g.state.requestsDone}개.`, items, board);
  }

  parcel(F) {
    const g = this.game, s = g.state;
    const ok = (X) => X !== F && X.type !== 'courier' && (X.y < 20000 || s.flags.anchorVisit) && (!X.def.far || s.flags.greatOpen) && !g.requests.active.some((r) => r.kind === 'parcel' && r.to === X.id);
    const cands = this.fac.list.filter((X) => ok(X) && Math.hypot(X.x - F.x, X.z - F.z) > 1200);
    cands.sort((a, b) => Math.hypot(a.x - F.x, a.z - F.z) - Math.hypot(b.x - F.x, b.z - F.z));
    const X = cands[Math.floor(Math.random() * Math.min(8, cands.length))];
    if (!X) { g.ui.toast('지금은 보낼 소포가 없어요', { kind: 'muted' }); return; }
    const d = Math.hypot(X.x - F.x, X.z - F.z);
    const r = { kind: 'parcel', to: X.id, title: `${josa(X.name, '로')} 가는 소포`, text: `${this._regionName(X)} ${X.name}의 ${X.info.keeper}에게 소포 전하기 (${km(d)})`, reward: 2 + Math.min(4, Math.floor(d / 4000)) };
    g.requests.add(r);
    this.useToday('parcel:' + F.id);
    s.waypoint = { x: X.x, z: X.z };
    g.updateWaypoint();
    g.audio.chime('quest');
    g.ui.toast(`소포를 맡았다 · ${X.name}`, { kind: 'quest', sub: '나침반의 흰 점에 표식을 남겼어요' });
  }

  // ── 기상탑 ───────────────────────────────
  _weather(F) {
    const g = this.game;
    const used = this.usedToday('weather');
    const cur = this.S.weather;
    const items = Object.entries(WEATHER).map(([k, w]) => ({ label: w.name, sub: used ? '하늘은 하루에 한 번만 고를 수 있어요' : w.sub, disabled: used, primary: cur && cur.kind === k, onClick: () => this.setWeather(F, k) }));
    if (cur) items.push({ label: '원래 하늘로', sub: '고른 날씨를 거둔다', onClick: () => { this.S.weather = null; F.extra.beamT = 2; g.ui.toast('하늘이 제 노래로 돌아간다', { kind: 'muted' }); } });
    g.ui.serviceCard(this._kicker(F), F.name, `구슬이 하늘에 노래를 쏘아 올려 구름과 빛을 고른다.${cur ? ` 지금 하늘: 「${WEATHER[cur.kind].name}」` : ''}`, items);
  }

  setWeather(F, kind) {
    const g = this.game, c = g.world.clock;
    this.useToday('weather');
    const night = c.hour > 21 || c.hour < 3;
    const until = kind === 'aurora' || kind === 'stars' ? Math.floor(c.time + (c.hour < 3 ? 0 : 1)) + 0.3 : c.time + 0.5;
    this.S.weather = { kind, until };
    if (kind === 'stars') {
      if (night) g.events.starfall(); else g.state.flags.wxStars = true;
    }
    F.extra.beamT = 7;
    F.extra.beam.material.uniforms.uColor.value.set(WEATHER[kind].color);
    F.extra.orb.material.uniforms.uEmissive.value.set(WEATHER[kind].color).multiplyScalar(0.9);
    g.audio.chime('quest');
    g.audio.noise({ freq: 400, dur: 3, gain: 0.4, sweep: 3200, attack: 0.6 });
    g.rig.shake(0.06);
    g.ui.toast(`오늘의 하늘 · ${WEATHER[kind].name}`, { kind: 'place', sub: kind === 'stars' && !night ? '밤이 되면 별씨가 떨어져요' : WEATHER[kind].sub });
    g.save();
  }

  /** 날씨가 정한 안개 배율 */
  fogTarget() {
    const w = this.S.weather;
    return !w ? 1 : w.kind === 'clear' ? 0.35 : w.kind === 'fog' ? 2.8 : 1;
  }

  // ── 선착장 ───────────────────────────────
  _dock(F) {
    const g = this.game;
    const open = g.quests.isDone('mq2') || !!g.state.flags.elevator;
    const items = [{ head: '연락선 · 들른 선착장 사이를 날아간다' }];
    const pp = g.player.pos;
    const others = this.fac.list.filter((X) => X.type === 'dock' && X !== F && this.S.visited[X.id]);
    others.sort((a, b) => Math.hypot(a.x - pp.x, a.z - pp.z) - Math.hypot(b.x - pp.x, b.z - pp.z));
    for (const X of others) items.push({ label: X.name, sub: `${this._regionName(X)} · ${km(Math.hypot(X.x - pp.x, X.z - pp.z))}`, disabled: !open, onClick: () => this.ferryTo(F, X) });
    if (!others.length) items.push({ label: '아직 들른 선착장이 없어요', sub: '다른 마을의 선착장에 들르면 연락선 길이 열려요', disabled: true });
    items.push({ head: '나룻배' });
    items.push({
      label: '나룻배 빌리기', primary: open, disabled: !open,
      sub: !open ? '배들은 척추의 도시가 깨어난 뒤에 다녀요' : g.ui.touch ? '혼자 타는 작은 하늘배 · 막대로 방향, 점프로 오르기, 상호작용으로 내리기' : '혼자 타는 작은 하늘배 · 보는 쪽으로 W, Space 오르기, Shift 빠르게, E 내리기',
      onClick: () => this.rentSkiff(F),
    });
    g.ui.serviceCard(this._kicker(F), F.name, '바닥의 세 고리가 세렌의 울림을 밀어내 배를 띄운다.', items);
  }

  rentSkiff(F) {
    const g = this.game;
    const P = this.fac.toWorld(F, F.R * 0.62, F.padY + 1.2, F.R * 0.15);
    g.player.pos.copy(P);
    g.player.yaw = F.yaw;
    g.player.startFly();
    this.rented = F;
    F.skiffMesh.visible = false;
    F.skiffMesh.userData.away = true;
    g.audio.blip({ hz: 160, to: 520, dur: 0.5, gain: 0.1, type: 'triangle' });
    g.ui.toast('나룻배를 빌렸다', { kind: 'item', sub: g.ui.touch ? '상호작용 단추로 내려요' : 'E 로 내리면 배는 스스로 돌아가요' });
    if (!g.state.flags.moaSkiff) { g.state.flags.moaSkiff = true; setTimeout(() => g.ui.moa('위를 보면 오르고 아래를 보면 내려가요. 높이 5 km 위로는 고리가 더 밀어내지 못한대요.'), 1500); }
  }

  endFly() {
    const g = this.game;
    g.player.stopFly();
    if (this.rented) { const m = this.rented.skiffMesh; m.userData.away = false; m.visible = this.rented.detail !== false; this.rented = null; }
    g.particles.emit({ pos: g.player.pos, count: 24, spread: 2.5, life: 1, size: [0.2, 0.6], color: 0x7ff3e6, alpha: 1, add: true, drag: 1.5 });
    g.audio.blip({ hz: 520, to: 160, dur: 0.4, gain: 0.08, type: 'triangle' });
    g.ui.toast('나룻배가 스스로 선착장으로 돌아간다', { kind: 'muted' });
  }

  /** 연락선: A 선착장 → B 선착장 (높이 올라 곧장 날아간다) */
  ferryTo(A, B) {
    const g = this.game;
    const a = this.fac.toWorld(A, 0, A.padY + 2.2, 0), b = this.fac.toWorld(B, 0, B.padY + 2.2, 0);
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    const alt = Math.max(a.y, b.y) + 160 + Math.min(2400, d * 0.06);
    const p1 = new THREE.Vector3(a.x, alt, a.z).lerp(b, 0.12).setY(alt), p2 = new THREE.Vector3(b.x, alt, b.z).lerp(a, 0.12).setY(alt);
    const T = Math.max(12, Math.min(45, 10 + d / 1400));
    const bez = (u, out) => {
      const v = 1 - u;
      return out.set(0, 0, 0).addScaledVector(a, v * v * v).addScaledVector(p1, 3 * v * v * u).addScaledVector(p2, 3 * v * u * u).addScaledVector(b, u * u * u);
    };
    const P = new THREE.Vector3(), Q = new THREE.Vector3(), Tn = new THREE.Vector3();
    const ship = this.rideFerry;
    const away = (F, on) => { F.ferry.userData.away = on; F.ferry.visible = !on && F.detail !== false; };
    away(A, true);
    away(B, true);
    ship.visible = true;
    const ride = {
      t: 0, done: false, cam: { pos: new THREE.Vector3(), look: new THREE.Vector3() },
      step: (dt, player) => {
        ride.t = Math.min(T, ride.t + dt);
        const k = ride.t / T;
        const u = k * k * k * (k * (k * 6 - 15) + 10);
        bez(u, P);
        bez(Math.min(1, u + 0.002), Q);
        Tn.subVectors(Q, P);
        if (Tn.lengthSq() < 1e-6) Tn.set(b.x - a.x, 0, b.z - a.z);
        Tn.normalize();
        ship.position.copy(P);
        Q.copy(P).add(Tn);
        ship.lookAt(Q.x, P.y + Tn.y * 0.3, Q.z);
        player.pos.set(P.x, P.y + 0.3, P.z);
        player.yaw = Math.atan2(Tn.x, Tn.z);
        const hx = Tn.x, hz = Tn.z, hl = Math.hypot(hx, hz) || 1;
        const fx = hx / hl, fz = hz / hl, sx = -fz, sz = fx;
        ride.cam.pos.set(P.x - fx * 30 + sx * 9, P.y + 11, P.z - fz * 30 + sz * 9);
        ride.cam.look.set(P.x + fx * 50, P.y + Tn.y * 30, P.z + fz * 50);
        if (ride.t >= T) {
          ride.done = true;
          ship.visible = false;
          away(A, false);
          away(B, false);
          const L = this.fac.toWorld(B, 0, B.padY, B.R * 0.35);
          player.pos.copy(L);
          player.yaw = B.yaw;
          this.S.visited[B.id] = true;
          g.rig.override = null;
          g.ui.regionTitle(B.name, '연락선에서 내렸다', false);
          g.save();
        }
      },
      skip: () => { ride.t = Math.max(ride.t, T - 2.5); },
    };
    g.player.enterRide(ride);
    g.audio.noise({ freq: 220, q: 0.6, dur: 3, gain: 0.5, type: 'lowpass', sweep: 900, attack: 0.8 });
    g.audio.chime('soft');
  }

  // ── 매 프레임 ─────────────────────────────
  _visit(F, silent = false) {
    if (this.S.visited[F.id]) return;
    const g = this.game;
    this.S.visited[F.id] = true;
    if (silent) return;
    g.ui.toast(`발견 · ${F.name}`, { kind: 'place', sub: `${F.info.icon} ${F.info.name} — ${F.info.verb}` });
    g.audio.chime('discover');
    if (!g.state.flags.moaFacility) { g.state.flags.moaFacility = true; setTimeout(() => g.ui.moa(`저 건물엔 ${josa(F.info.keeper, '이')} 있어요. 말을 걸면 이 건물이 하는 일을 도와줄 거예요.`), 2500); }
  }

  update(dt) {
    const g = this.game;
    const pp = g.player.pos;
    const S = this.S;
    this._scanT -= dt;
    if (this._scanT <= 0) {
      this._scanT = 0.5;
      if (g.mode === 'play') {
        for (const F of this.fac.list) {
          if (S.visited[F.id] || !F.group.visible) continue;
          if (Math.hypot(pp.x - F.x, pp.z - F.z) < F.R + 28 && Math.abs(pp.y - F.y) < 60) this._visit(F);
        }
      }
      this._detect();
      // 날씨가 끝났는가
      if (S.weather && g.world.clock.time > S.weather.until) S.weather = null;
    }
    // 오로라
    const au = atmosUniforms.uAurora;
    const want = S.weather && S.weather.kind === 'aurora' ? 3.2 : 1;
    au.value += (want - au.value) * Math.min(1, dt * 0.5);
    // 온실의 꽃
    const now = g.world.clock.time;
    for (const F of this.fac.list) {
      if (F.type !== 'greenhouse' || !F.group.visible) continue;
      const G = S.garden[F.id];
      F.plants.forEach((m, i) => {
        const t = G && G[i];
        if (t === null || t === undefined) { m.scale.setScalar(0.001); return; }
        const k = Math.min(1, Math.max(0, (now - t) / GROW));
        const s = 0.12 + 0.88 * k + (k >= 1 ? Math.sin(g.time * 2 + i) * 0.04 : 0);
        m.scale.set(s, s, s);
      });
    }
  }

  /** 울림 탐지기: 나침반 표시 */
  _detect() {
    const g = this.game;
    const lv = g.player.upgrades.detector || 0;
    this._marks.length = 0;
    if (!lv) return;
    const r = DETECT_RANGE[lv];
    for (const kind of ['glyph', 'echo']) {
      const t = this.nearestLeft(kind);
      if (t && t.d < r && t.d > 12) this._marks.push(t);
    }
  }

  compassMarkers(bearing) {
    return this._marks.map((t) => ({ bearing: bearing(t.x, t.z), cls: 'd', label: km(t.d) }));
  }
}
