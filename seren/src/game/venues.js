// 건물이 실제로 일한다 — 들어간 건물의 쓰임마다 시설(진열대·계산대·전시대·생산 줄·분류대·표 파는 곳·실험대…)을 두고,
// 플레이어가 그 사회의 한 사람으로 직접 쓴다. 관찰자가 아니다.
//  · 돈은 별씨: 공방·창고·발전소·사무탑에서 일하면 받고, 가게·찻집·터미널에서 쓴다. 가게에 물건을 되팔 수도 있다.
//  · 가방의 물건은 쓸모가 있다: 먹으면 몸의 기운(빨리 달리기·멀리 활공), 선물, 지도 밝히기, 기록 읽기.
//  · 시설은 눈에 보이게 움직인다: 생산 줄 위로 물건이 흐르고, 분류대로 짐이 가고, 전시물이 돌고, 출발판이 깜박이고,
//    요리하면 김이 오르고, 발전소 핵이 맥박친다. 일하는 주민도 그 자리에서 일한다.
//  · 시설 = { x, y, z, r, label(), short, use() } — game._findTarget 이 가까운 것을 고르고 E 로 쓴다.
import * as THREE from 'three';
import { glowMaterial } from '../world/materials.js';
import { audio } from '../core/audio.js';
import { WORD, WORDS } from '../data/lexicon.js';
import { glyphSVG } from './language.js';
import { ITEMS, BUFFS, SHELVES, MENU, EXHIBITS, ARCHIVES, BAG_ORDER, WORK_TUNES, ZONE_NAMES } from '../data/venues.js';
import { mulberry32 } from '../core/noise.js';

const TAU = Math.PI * 2;
const NOTE_HEX = ['#ff9f6a', '#ffd27a', '#7ff3e6', '#9fb8ff', '#d8a8ff'];
const PEARL = 0xf1ece4, GOLD = 0xe9c27c, ACC = 0x7ff3e6;

export class Venues {
  constructor(game) {
    this.game = game;
    this.stations = [];
    this.fx = []; // 잠깐의 효과 (치유 고리 등)
    this.order = null; // 찻집 주문
    this.t = 0;
    this._hudT = 0;
  }

  /** 저장되는 것 */
  get S() {
    const s = this.game.state;
    if (!s.venue) s.venue = { exhibits: {}, archives: {}, museums: {}, buffs: {}, days: {}, job: null, earned: 0, spent: 0, worked: 0 };
    return s.venue;
  }
  get inv() { return this.game.state.inv; }
  _day() { return Math.floor(this.game.world.clock.time); }
  _add(id, n = 1, quiet = false) {
    this.inv[id] = (this.inv[id] || 0) + n;
    if (!quiet) this.game.ui.toast(`${ITEMS[id] ? ITEMS[id].name : id} ${n > 0 ? '+' : ''}${n}`, { kind: 'item' });
  }
  _pay(n) {
    if ((this.inv.starseed || 0) < n) { this.game.ui.toast(`별씨가 모자라요 (가진 것 ${this.inv.starseed || 0})`, { kind: 'muted' }); return false; }
    this.inv.starseed -= n; this.S.spent += n;
    audio.chime && audio.chime('soft');
    return true;
  }
  _wage(n, what) {
    this.inv.starseed = (this.inv.starseed || 0) + n; this.S.earned += n; this.S.worked++;
    this.game.ui.toast(`${what} · 별씨 +${n} (가진 것 ${this.inv.starseed})`, { kind: 'item' });
  }
  _learn(id) { const L = this.game.lang; if (id && WORD[id] && !L.known(id)) L.learn(id, 'teach'); }
  /** 실내의 그 쓰임 사람이 한마디 (고맙다·인사) */
  _say(role, kind = 'thanks') {
    const C = this.game.citizens;
    if (!C) return;
    const p = this.game.player.pos;
    let best = null, bd = 1e9;
    for (const q of C.indoor) { if (role && q.role !== role) continue; const d = Math.hypot(q.pos.x - p.x, q.pos.z - p.z); if (d < bd) { bd = d; best = q; } }
    if (best && bd < 14) C._line(best, kind);
  }

  // ── 실내가 열릴 때 (interiors._build 끝에서) ───────────────
  build(cur, K) {
    this.stations = [];
    this.cur = cur;
    this.K = K;
    const pid = cur.info.pid;
    const fn = this['_b_' + pid];
    if (fn) fn.call(this, cur, K);
  }
  clear() { this.stations = []; this.cur = null; this.K = null; this.order = null; }

  _station(st) { st.r = st.r || 2.3; st.y = st.y ?? this.K.fy; this.stations.push(st); return st; }
  _mesh(geo, color, emit = 0) {
    const m = new THREE.Mesh(this.game.interiors._paint(geo, color, emit), this.game.interiors.mat);
    m.frustumCulled = false;
    this.K.group.add(m);
    return m;
  }
  _glow(geo, color, intensity = 1.4) {
    const m = new THREE.Mesh(geo, glowMaterial({ color, intensity }));
    m.frustumCulled = false;
    this.K.group.add(m);
    return m;
  }
  _anim(f) { this.cur.anims.push(f); }

  /** 상호작용할 것 */
  target(p) {
    let best = null, bd = 1e9;
    for (const st of this.stations) {
      if (Math.abs(p.y - st.y) > 2.4) continue;
      const d = Math.hypot(p.x - st.x, p.z - st.z);
      if (d < st.r && d < bd) { bd = d; best = st; }
    }
    if (!best) return null;
    return { kind: 'venue', o: best, label: typeof best.label === 'function' ? best.label() : best.label, short: best.short || '쓰기' };
  }
  use(t) { t.o.use(); }

  // ═══ 쓰임마다 시설 ═══════════════════════════════════════

  // 가게: 진열대마다 파는 칸, 계산대에서 되팔기. 손님이 진열대 사이를 돈다
  _b_market(cur, K) {
    for (let i = 0; i < 6; i++) {
      const [x, z] = K.toward(0.68, Math.PI * 0.45 + i * 0.37);
      const sh = SHELVES[i % SHELVES.length];
      this._station({ x: x + (K.cx - x) * 0.2, z: z + (K.cz - z) * 0.2, label: `진열대 · ${sh.name}`, short: '고르기', use: () => this.shelf(sh) });
    }
    const [qx, qz] = K.toward(0.36, Math.PI * 1.18);
    const ry = K.face(qx, qz, K.cx, K.cz);
    K.put(new THREE.BoxGeometry(3.2, 1.0, 1.0), PEARL, 0, qx, K.fy + 0.5, qz, ry);
    K.put(new THREE.BoxGeometry(3.25, 0.05, 1.05), ACC, 1.4, qx, K.fy + 1.0, qz, ry);
    K.sBox(qx, qz, 1.6, 0.5, ry, 1.0);
    const scr = this._glow(new THREE.PlaneGeometry(1.4, 0.8), 0x9ff6ff, 1.2);
    scr.position.set(qx, K.fy + 1.8, qz); scr.rotation.y = ry + Math.PI;
    this._anim((t) => { scr.material.uniforms.uIntensity.value = 1.0 + Math.sin(t * 3) * 0.2; });
    K.anchor(qx - Math.sin(ry) * 1.0, qz - Math.cos(ry) * 1.0, 'shop', ry);
    this._station({ x: qx + Math.sin(ry) * 1.3, z: qz + Math.cos(ry) * 1.3, label: '계산대 · 되팔기', short: '팔기', use: () => this.sellCard() });
    for (let i = 0; i < 3; i++) K.anchor(K.cx, K.cz, 'guest', 0, { loop: [K.cx, K.cz, K.rin * (0.42 + i * 0.06), i % 2 ? 1 : -1, i * 2.1] });
  }

  // 찻집: 계산대에서 주문 → 부엌에서 짓는다(김) → 받아서 여기서 먹거나 싸 간다
  _b_cafe(cur, K) {
    const [bx, bz] = K.toward(0.62, Math.PI);
    const ry = K.face(bx, bz, K.cx, K.cz);
    K.put(new THREE.CylinderGeometry(3.2, 3.2, 1.05, 18, 1, false, -0.9, 1.8), PEARL, 0, bx, K.fy + 0.52, bz, ry + Math.PI);
    K.put(new THREE.CylinderGeometry(3.23, 3.23, 0.06, 18, 1, true, -0.9, 1.8), 0xffc46a, 1.6, bx, K.fy + 1.06, bz, ry + Math.PI);
    K.sCyl(bx, bz, 2.4, 1.05);
    // 부엌: 화덕 둘 + 김
    const [kx, kz] = K.toward(0.82, Math.PI);
    for (const s of [-1, 1]) {
      const ox = kx + Math.cos(ry) * s * 1.6, oz = kz - Math.sin(ry) * s * 1.6;
      K.put(new THREE.CylinderGeometry(0.7, 0.8, 1.0, 10), 0xc8c2d2, 0, ox, K.fy + 0.5, oz);
      K.put(new THREE.TorusGeometry(0.45, 0.06, 4, 16).rotateX(Math.PI / 2), 0xff9f6a, 2.2, ox, K.fy + 1.02, oz);
      K.sCyl(ox, oz, 0.8, 1.0);
      const puffs = [];
      for (let i = 0; i < 4; i++) { const m = this._glow(new THREE.IcosahedronGeometry(0.18, 0), 0xffffff, 0.5); puffs.push(m); }
      this._anim((t) => puffs.forEach((m, i) => { const k = ((t * 0.35 + i / 4) % 1); m.position.set(ox + Math.sin(i * 2 + t) * 0.2, K.fy + 1.2 + k * 2.2, oz); m.scale.setScalar(0.6 + k * 1.4); m.material.uniforms.uIntensity.value = 0.6 * (1 - k); }));
    }
    // 차림표 홀로그램
    const menu = this._glow(new THREE.PlaneGeometry(2.6, 1.2), 0xffd9a0, 0.9);
    menu.position.set(bx + Math.sin(ry) * 0.2, K.fy + 3.0, bz + Math.cos(ry) * 0.2); menu.rotation.y = ry + Math.PI;
    K.anchor(kx, kz, 'cook', ry);
    K.anchor(bx - Math.sin(ry) * 1.1, bz - Math.cos(ry) * 1.1, 'shop', ry);
    // 식탁
    for (let i = 0; i < 4; i++) { const [tx, tz] = K.toward(0.5, Math.PI * 0.35 + i * 0.42); K.table(tx, tz, 1.0, 3, i % 2 ? 'eat' : null); }
    // 받을 접시 (주문이 다 되면 계산대 위에 나타난다)
    const dish = this._glow(new THREE.CylinderGeometry(0.4, 0.3, 0.12, 12), 0xffe2b8, 1.6);
    dish.position.set(bx + Math.sin(ry) * 1.0, K.fy + 1.15, bz + Math.cos(ry) * 1.0);
    this._anim(() => { dish.visible = !!(this.order && this.order.ready <= this.t); });
    this._station({
      x: bx + Math.sin(ry) * 2.2, z: bz + Math.cos(ry) * 2.2, r: 2.6,
      label: () => (!this.order ? '계산대 · 주문하기' : this.order.ready > this.t ? `${ITEMS[this.order.id].name} 짓는 중 · ${Math.ceil(this.order.ready - this.t)}초` : `${ITEMS[this.order.id].name} 받기`),
      short: '주문', use: () => this.cafe(),
    });
  }

  // 박물관: 전시대 여섯 (돌며 떠 있는 유물), 해설사의 안내, 다 보면 기념품
  _b_museum(cur, K) {
    const rnd = mulberry32(Math.floor(cur.r.seed * 5e8) + 11);
    const pool = EXHIBITS.slice();
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const ex = pool.slice(0, 6);
    this.museumKey = `${cur.r.zone}:${cur.r.kind}:${cur.r.idx}`;
    this.museum = [];
    ex.forEach((e, i) => {
      const [x, z] = K.toward(0.62, Math.PI * 0.32 + (i / 5) * Math.PI * 1.36);
      K.put(new THREE.CylinderGeometry(0.8, 0.95, 1.1, 10), PEARL, 0, x, K.fy + 0.55, z);
      K.put(new THREE.TorusGeometry(0.82, 0.04, 3, 18).rotateX(Math.PI / 2), e.color, 1.6, x, K.fy + 1.1, z);
      K.sCyl(x, z, 0.95, 1.1);
      const plaque = K.face(x, z, K.cx, K.cz);
      K.put(new THREE.BoxGeometry(0.9, 0.5, 0.06).rotateX(-0.5), 0x2a2838, 0.2, x + Math.sin(plaque) * 1.05, K.fy + 0.75, z + Math.cos(plaque) * 1.05, plaque);
      const geos = [new THREE.TorusKnotGeometry(0.32, 0.09, 48, 6), new THREE.IcosahedronGeometry(0.42, 0), new THREE.OctahedronGeometry(0.45, 0), new THREE.TorusGeometry(0.36, 0.1, 6, 18), new THREE.DodecahedronGeometry(0.4, 0), new THREE.ConeGeometry(0.3, 0.8, 6)];
      const art = this._glow(geos[i % geos.length], e.color, 1.3);
      const base = K.fy + 1.9;
      art.position.set(x, base, z);
      this._anim((t) => { art.rotation.set(t * 0.3 + i, t * 0.6 + i, 0); art.position.y = base + Math.sin(t * 1.3 + i) * 0.12; });
      this.museum.push({ e, x, z });
      this._station({ x: x + Math.sin(plaque) * 1.6, z: z + Math.cos(plaque) * 1.6, r: 1.9, label: () => `전시 · ${e.title}${this.S.exhibits[e.id] ? ' ✓' : ''}`, short: '살펴보기', use: () => this.exhibit(e) });
    });
    const [hx, hz] = K.toward(0.28, Math.PI * 0.12);
    K.anchor(hx, hz, 'curator', K.face(hx, hz, K.cx, K.cz) + Math.PI);
    this._station({ x: hx, z: hz, r: 2.2, label: '해설사 · 안내 받기', short: '안내', use: () => this.tour() });
    for (let i = 0; i < 3; i++) K.anchor(K.cx, K.cz, 'guest', 0, { loop: [K.cx, K.cz, K.rin * 0.48, i % 2 ? 1 : -1, i * 2.0, 0.35] });
  }

  // 학교: 수업 중이면 선생님 앞에서 수업 듣기 (글자·노래 → 뜻 고르기)
  _b_school(cur, K) {
    const [x, z] = K.toward(0.22, Math.PI * 0.5);
    const g = this._glow(new THREE.TorusGeometry(0.7, 0.05, 3, 24), 0xffd27a, 1.6);
    g.position.set(K.cx + (x - K.cx) * 0.2, K.fy + 3.0, K.cz + (z - K.cz) * 0.2);
    this._anim((t) => { g.rotation.set(Math.PI / 2 + Math.sin(t) * 0.3, t * 0.8, 0); });
    this._station({ x, z, r: 2.6, label: () => (this.S.days.school === this._day() ? '오늘 수업은 들었어요' : '선생님 · 수업 듣기'), short: '수업', use: () => this.classQuiz() });
  }

  // 치유원: 접수에서 진료 → 빛 고리가 몸을 훑고 지나가며 울림을 고른다
  _b_heal(cur, K) {
    const [x, z] = K.toward(0.32, Math.PI * 1.12);
    const ry = K.face(x, z, K.cx, K.cz);
    K.put(new THREE.BoxGeometry(2.4, 1.0, 0.9), PEARL, 0, x, K.fy + 0.5, z, ry);
    K.put(new THREE.BoxGeometry(2.45, 0.05, 0.95), 0xbfefff, 1.4, x, K.fy + 1.0, z, ry);
    K.sBox(x, z, 1.2, 0.45, ry, 1.0);
    K.anchor(x - Math.sin(ry) * 0.9, z - Math.cos(ry) * 0.9, 'heal', ry);
    for (let i = 0; i < 4; i++) {
      const [bx, bz] = K.toward(0.66, Math.PI * 0.6 + i * 0.5);
      const ring = this._glow(new THREE.TorusGeometry(0.9, 0.03, 3, 20), 0xbfefff, 1.0);
      this._anim((t) => { ring.position.set(bx, K.fy + 1.0 + (Math.sin(t * 0.8 + i) * 0.5 + 0.5) * 1.2, bz); ring.rotation.x = Math.PI / 2; });
    }
    this._station({ x: x + Math.sin(ry) * 1.3, z: z + Math.cos(ry) * 1.3, label: '접수 · 진료 받기', short: '진료', use: () => this.treat() });
  }

  // 서고: 책장의 기록 결정 읽기·빌리기
  _b_library(cur, K) {
    const rnd = mulberry32(Math.floor(cur.r.seed * 9e8) + 3);
    const recs = ARCHIVES.slice().sort(() => rnd() - 0.5).slice(0, 4);
    for (let i = 0; i < 2; i++) {
      const [x, z] = K.toward(0.5 + (i % 2) * 0.22, Math.PI * 0.55 + Math.floor(i / 2) * 0.45);
      const ry = K.face(x, z, K.cx, K.cz);
      this._station({ x: x + Math.sin(ry) * 1.4, z: z + Math.cos(ry) * 1.4, label: '책장 · 기록 결정', short: '읽기', use: () => this.archives(recs) });
    }
    const orb = this._glow(new THREE.IcosahedronGeometry(0.35, 1), 0xb9a6ff, 1.6);
    const [ox, oz] = K.toward(0.3, Math.PI * 0.8);
    this._anim((t) => { orb.position.set(ox, K.fy + 2.4 + Math.sin(t) * 0.2, oz); orb.rotation.y = t; });
  }

  // 연구동: 실험대에서 물질의 음 맞추기 → 결정 조각
  _b_lab(cur, K) {
    for (let i = 0; i < 3; i++) {
      const [x, z] = K.toward(0.6, Math.PI * 0.75 + i * 0.45);
      const atoms = [0, 1, 2].map((k) => this._glow(new THREE.IcosahedronGeometry(0.09, 0), [ACC, 0xff9fd0, 0xffd27a][k], 2.0));
      this._anim((t) => atoms.forEach((m, k) => { const a = t * (1.5 + k * 0.4) + k * 2.1; m.position.set(x + Math.cos(a) * 0.7, K.fy + 2.0 + Math.sin(a * 1.3) * 0.35, z + Math.sin(a) * 0.7); }));
      this._station({ x: x + (K.cx - x) * 0.32, z: z + (K.cz - z) * 0.32, label: '실험대 · 물질의 음 맞추기', short: '실험', use: () => this.experiment() });
    }
  }

  // 빚음 공방: 생산 줄 — 재료가 기계 넷을 지나며 등불이 된다. 줄에 서서 일한다
  _b_factory(cur, K) {
    const N = 14, R = K.rin * 0.42, a0 = Math.PI * 0.5, a1 = Math.PI * 1.55;
    const at = (k) => { const a = Math.atan2(K.dn[1], K.dn[0]) + a0 + (a1 - a0) * k; return [K.cx + Math.cos(a) * R, K.cz + Math.sin(a) * R, a]; };
    for (let s = 0; s < 12; s++) {
      const [x, z, a] = at((s + 0.5) / 12);
      K.put(new THREE.BoxGeometry(1.3, 0.55, (R * (a1 - a0)) / 12 + 0.1), 0x5a6478, 0, x, K.fy + 0.28, z, -a);
      K.put(new THREE.BoxGeometry(1.32, 0.03, (R * (a1 - a0)) / 12 + 0.1), ACC, 1.0, x, K.fy + 0.57, z, -a);
    }
    const geo = new THREE.BoxGeometry(0.42, 0.32, 0.42);
    const items = new THREE.InstancedMesh(this.game.interiors._paint(geo, 0xffffff, 0.6), this.game.interiors.mat, N);
    items.frustumCulled = false;
    items.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
    this.K.group.add(items);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1), pv = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), c = new THREE.Color();
    const raw = new THREE.Color(0x8a7a6a), done = new THREE.Color(0xffd27a);
    this._anim((t) => {
      for (let i = 0; i < N; i++) {
        const k = ((t * 0.045 + i / N) % 1);
        const [x, z, a] = at(k);
        pv.set(x, K.fy + 0.75, z); q.setFromAxisAngle(up, -a + t); m4.compose(pv, q, sc);
        items.setMatrixAt(i, m4);
        c.copy(raw).lerp(done, Math.min(1, Math.max(0, (k - 0.2) / 0.6)));
        items.setColorAt(i, c);
      }
      items.instanceMatrix.needsUpdate = true; items.instanceColor.needsUpdate = true;
    });
    const [sx, sz] = at(0.5);
    this._station({ x: K.cx + (sx - K.cx) * 0.6, z: K.cz + (sz - K.cz) * 0.6, r: 2.6, label: '생산 줄 · 일하기 (등불 빚기)', short: '일하기', use: () => this.lineWork() });
  }

  // 물류 창고: 컨베이어로 짐이 들어와 색 칸 셋으로 갈린다. 분류하기·배달 맡기
  _b_depot(cur, K) {
    const dir = Math.atan2(K.dn[1], K.dn[0]) + Math.PI / 2;
    const ux = Math.cos(dir), uz = Math.sin(dir), L = K.rin * 1.1;
    const [mx, mz] = K.toward(0.35, Math.PI);
    for (let s = 0; s < 8; s++) {
      const k = (s + 0.5) / 8 - 0.5, x = mx + ux * k * L, z = mz + uz * k * L;
      K.put(new THREE.BoxGeometry(L / 8 + 0.05, 0.6, 1.3), 0x5a6478, 0, x, K.fy + 0.3, z, -dir);
      K.put(new THREE.BoxGeometry(L / 8 + 0.05, 0.03, 1.32), ACC, 0.9, x, K.fy + 0.61, z, -dir);
    }
    const COLS = [0xff9fd0, 0x7ff3e6, 0xffd27a];
    COLS.forEach((cc, i) => {
      const x = mx + ux * (0.5 * L + 1.2) + Math.cos(dir + Math.PI / 2) * (i - 1) * 1.6, z = mz + uz * (0.5 * L + 1.2) + Math.sin(dir + Math.PI / 2) * (i - 1) * 1.6;
      K.put(new THREE.BoxGeometry(1.3, 1.6, 1.3), 0x3a4052, 0, x, K.fy + 0.8, z, -dir);
      K.put(new THREE.TorusGeometry(0.5, 0.06, 3, 16), cc, 2.0, x, K.fy + 1.75, z, -dir);
      K.sBox(x, z, 0.65, 0.65, -dir, 1.6);
    });
    const N = 10, geo = new THREE.BoxGeometry(0.5, 0.4, 0.5);
    const parcels = new THREE.InstancedMesh(this.game.interiors._paint(geo, 0xffffff, 0.3), this.game.interiors.mat, N);
    parcels.frustumCulled = false;
    parcels.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
    this.K.group.add(parcels);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1), pv = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), c = new THREE.Color();
    for (let i = 0; i < N; i++) parcels.setColorAt(i, c.set(COLS[i % 3]));
    this._anim((t) => {
      for (let i = 0; i < N; i++) {
        const k = ((t * 0.06 + i / N) % 1) - 0.5;
        pv.set(mx + ux * k * L, K.fy + 0.82, mz + uz * k * L); q.setFromAxisAngle(up, -dir); m4.compose(pv, q, sc);
        parcels.setMatrixAt(i, m4);
      }
      parcels.instanceMatrix.needsUpdate = true; parcels.instanceColor.needsUpdate = true;
    });
    this._station({ x: mx + Math.cos(dir + Math.PI / 2) * 1.6, z: mz + Math.sin(dir + Math.PI / 2) * 1.6, r: 2.6, label: '분류대 · 짐 나누기', short: '일하기', use: () => this.sortWork() });
    const [jx, jz] = K.toward(0.3, Math.PI * 0.45);
    K.anchor(jx, jz, 'clerk', K.face(jx, jz, K.cx, K.cz) + Math.PI);
    this._station({ x: jx, z: jz, r: 2.2, label: () => (this.S.job ? `맡은 일 · ${this.S.job.label}` : '배달 창구 · 짐 맡기'), short: '배달', use: () => this.deliveryCard() });
  }

  // 터미널: 출발판(깜박이는 행선지) + 표 파는 곳 → 다른 구역 터미널로
  _b_terminal(cur, K) {
    const [dx, dz] = K.toward(0.3, Math.PI * 1.4);
    const ry = K.face(dx, dz, K.cx, K.cz);
    const board = this._glow(new THREE.PlaneGeometry(2.4, 2.6), 0x7ff3e6, 1.0);
    board.position.set(dx, K.fy + 2.5, dz); board.rotation.y = ry + Math.PI;
    this._anim((t) => { board.material.uniforms.uIntensity.value = 0.8 + 0.3 * (Math.sin(t * 6) > 0.6 ? 1 : 0); });
    this._station({ x: dx + Math.sin(ry) * 1.6, z: dz + Math.cos(ry) * 1.6, r: 2.6, label: '표 파는 곳 · 행선지 고르기', short: '표', use: () => this.tickets() });
  }

  // 사무탑: 일거리 게시판 (배달·측량·안부)
  _b_office(cur, K) {
    const [x, z] = K.toward(0.3, Math.PI * 1.05);
    const ry = K.face(x, z, K.cx, K.cz);
    const board = this._glow(new THREE.PlaneGeometry(2.8, 1.6), 0xffd27a, 0.9);
    board.position.set(x, K.fy + 2.2, z); board.rotation.y = ry + Math.PI;
    this._station({ x: x + Math.sin(ry) * 1.4, z: z + Math.cos(ry) * 1.4, r: 2.4, label: () => (this.S.job ? `맡은 일 · ${this.S.job.label}` : '일거리 게시판'), short: '일거리', use: () => this.jobBoard() });
  }

  // 공연장: 공연(정오~밤) 보기 → 함께 부르기
  _b_hall(cur, K) {
    const [x, z] = K.toward(0.62, Math.PI);
    const lights = [0, 1, 2].map((i) => this._glow(new THREE.ConeGeometry(0.9, 3.4, 12, 1, true), [0xff9fd0, 0x7ff3e6, 0xffd27a][i], 0.25));
    this._anim((t) => lights.forEach((m, i) => { m.position.set(x + Math.cos(t * 0.5 + i * 2.1) * 1.4, K.fy + K.LH - 1.8, z + Math.sin(t * 0.5 + i * 2.1) * 1.4); }));
    this._station({ x: K.cx + (x - K.cx) * 0.45, z: K.cz + (z - K.cz) * 0.45, r: 2.6, label: () => (this._showtime() ? '객석 · 공연 보기' : '공연 시간표 보기'), short: '공연', use: () => this.concert() });
  }

  // 정원: 화단 셋 돌보기 → 울림꽃
  _b_garden(cur, K) {
    for (let i = 0; i < 3; i++) {
      const [x, z] = K.toward(0.66, Math.PI * 0.55 + i * 0.45);
      K.put(new THREE.CylinderGeometry(1.1, 1.2, 0.6, 12), 0x8a6a5a, 0, x, K.fy + 0.3, z);
      K.put(new THREE.CircleGeometry(1.05, 12).rotateX(-Math.PI / 2), 0x2a1a14, 0, x, K.fy + 0.61, z);
      for (let k = 0; k < 5; k++) K.put(new THREE.ConeGeometry(0.08, 0.9, 4).rotateZ(0.3).rotateY(k * 1.3), [0x9fd8a8, 0xc8a8ff, 0x8ff0ff][k % 3], 0.3, x + Math.cos(k * 1.3) * 0.5, K.fy + 1.0, z + Math.sin(k * 1.3) * 0.5);
      K.sCyl(x, z, 1.2, 0.6);
    }
    const [x, z] = K.toward(0.5, Math.PI * 1.0);
    this._station({ x, z, r: 2.6, label: () => (this.S.days.garden === this._day() ? '화단 · 오늘은 다 돌봤어요' : '화단 · 돌보기'), short: '돌보기', use: () => this.tend() });
  }

  // 집: 잠자리(밤) · 부엌 간식
  _b_home(cur, K) {
    const [bx, bz] = K.toward(0.8, Math.PI * 0.25 + 0.32);
    this._station({ x: bx + (K.cx - bx) * 0.2, z: bz + (K.cz - bz) * 0.2, r: 2.2, label: '잠자리 · 아침까지 자기', short: '자기', use: () => this.sleep() });
    const [kx, kz] = K.toward(0.74, Math.PI * 1.3);
    this._station({ x: kx + (K.cx - kx) * 0.25, z: kz + (K.cz - kz) * 0.25, r: 2.2, label: () => (this.S.days.snack === this._day() ? '부엌 · 오늘 간식은 받았어요' : '부엌 · 간식 얻기'), short: '부엌', use: () => this.snack() });
  }

  // 발전소: 맥박치는 핵 + 조종대 (출력 맞추기)
  _b_plant(cur, K) {
    const [x, z] = K.toward(0.48, Math.PI);
    const core = this._glow(new THREE.IcosahedronGeometry(1.1, 2), 0xffd9a0, 1.6);
    core.position.set(x, K.fy + 2.4, z);
    const rings = [0, 1, 2].map((i) => this._glow(new THREE.TorusGeometry(1.8 + i * 0.35, 0.05, 3, 32), [0xffc46a, ACC, 0xff9fd0][i], 1.6));
    this._anim((t) => {
      const p = 0.5 + 0.5 * Math.sin(t * 2.4);
      core.scale.setScalar(0.9 + p * 0.15); core.material.uniforms.uIntensity.value = 1.2 + p;
      rings.forEach((m, i) => { m.position.copy(core.position); m.rotation.set(t * (0.6 + i * 0.3), t * (0.4 + i * 0.2), i); });
    });
    K.put(new THREE.CylinderGeometry(1.4, 1.6, 0.4, 16), 0x5a6478, 0, x, K.fy + 0.2, z);
    K.sCyl(x, z, 1.8, 4.2);
    for (let i = 0; i < 2; i++) {
      const [cx2, cz2] = K.toward(0.32, Math.PI * (0.7 + i * 0.6));
      const ry = K.face(cx2, cz2, x, z);
      K.put(new THREE.BoxGeometry(1.8, 1.0, 0.8), 0xc8c2d2, 0, cx2, K.fy + 0.5, cz2, ry);
      K.put(new THREE.BoxGeometry(1.6, 0.6, 0.05).rotateX(-0.6), 0x7ff3e6, 1.6, cx2, K.fy + 1.15, cz2, ry);
      K.sBox(cx2, cz2, 0.9, 0.4, ry, 1.0);
      K.anchor(cx2 - Math.sin(ry) * 0.9, cz2 - Math.cos(ry) * 0.9, 'work', ry);
      if (i === 0) this._station({ x: cx2 + Math.sin(ry) * 1.2, z: cz2 + Math.cos(ry) * 1.2, r: 2.2, label: '조종대 · 출력 맞추기', short: '일하기', use: () => this.powerWork() });
    }
  }

  // ═══ 쓰기 ═══════════════════════════════════════════════

  shelf(sh) {
    const g = this.game, inv = this.inv;
    const items = sh.items.map((id) => {
      const I = ITEMS[id];
      return { label: `${I.icon} ${I.name} · 별씨 ${I.price}`, sub: `${I.desc} (가진 것 ${inv[id] || 0})`, disabled: (inv.starseed || 0) < I.price, stay: true,
        onClick: (b) => { if (!this._pay(I.price)) return; this._add(id); this._learn('share'); this._say('shop'); b.querySelector('small').textContent = `${I.desc} (가진 것 ${inv[id] || 0})`; } };
    });
    g.ui.serviceCard('가게', sh.name, `가진 별씨 ${inv.starseed || 0} · 고르면 바로 가방에 들어가요. 먹을 것은 가방(일지 → 가방)에서 꺼내 먹어요.`, items);
  }

  sellCard() {
    const g = this.game, inv = this.inv;
    const sellable = BAG_ORDER.filter((id) => ITEMS[id].sell && (inv[id] || 0) > 0);
    if (!sellable.length) { g.ui.serviceCard('가게', '계산대', '되팔 물건이 없어요. 공방에서 빚은 손등불·결정 조각·울림꽃은 여기서 별씨로 바꿀 수 있어요.', []); return; }
    g.ui.serviceCard('가게', '계산대 · 되팔기', `가진 별씨 ${inv.starseed || 0}`, sellable.map((id) => {
      const I = ITEMS[id];
      return { label: `${I.icon} ${I.name} 팔기 · 별씨 ${I.sell}`, sub: `가진 것 ${inv[id]}`, stay: true, onClick: (b) => { if ((inv[id] || 0) <= 0) return; inv[id]--; inv.starseed = (inv.starseed || 0) + I.sell; this._say('shop'); b.querySelector('small').textContent = `가진 것 ${inv[id]}`; g.ui.toast(`${I.name} → 별씨 +${I.sell}`, { kind: 'item' }); } };
    }));
  }

  cafe() {
    const g = this.game;
    if (this.order && this.order.ready > this.t) { g.ui.toast('부엌에서 짓고 있어요. 잠깐만요', { kind: 'muted' }); return; }
    if (this.order) {
      const I = ITEMS[this.order.id];
      g.ui.serviceCard('찻집', `${I.name} 나왔어요`, I.desc, [
        { label: '여기서 먹기', sub: '자리에 앉아 먹는다 (바로 기운이 난다)', primary: true, onClick: () => { this.order = null; this.eat(this._lastOrder, true); this._say('eat', 'thanks'); } },
        { label: '싸 가기', sub: '가방에 넣는다', onClick: () => { this._add(this._lastOrder); this.order = null; } },
      ]);
      return;
    }
    g.ui.serviceCard('찻집', '차림표', `가진 별씨 ${this.inv.starseed || 0} · 주문하면 부엌에서 지어 계산대에 내어 줘요`, MENU.map((M) => {
      const I = ITEMS[M.id];
      return { label: `${I.icon} ${I.name} · 별씨 ${I.price}`, sub: `${I.desc} · ${M.cook}초`, disabled: (this.inv.starseed || 0) < I.price,
        onClick: () => { if (!this._pay(I.price)) return; this.order = { id: M.id, ready: this.t + M.cook }; this._lastOrder = M.id; this._say('shop', 'thanks'); audio.chime && audio.chime('soft'); } };
    }));
  }

  /** 먹기: 기운 + (가게 밖에서 먹으면 가방에서 하나 줄인다) */
  eat(id, here = false) {
    const I = ITEMS[id];
    if (!I || I.use !== 'eat') return;
    if (!here) { if ((this.inv[id] || 0) <= 0) return; this.inv[id]--; }
    this.buff(I.buff);
    this._learn('eat');
    this.game.ui.toast(`${I.name}을(를) 먹었다 · ${BUFFS[I.buff].name}`, { kind: 'item' });
  }

  buff(id) {
    const B = BUFFS[id];
    if (!B) return;
    this.S.buffs[id] = B.dur;
    this._hudT = 0;
  }

  exhibit(e) {
    const g = this.game, first = !this.S.exhibits[e.id];
    this.S.exhibits[e.id] = true;
    if (first) this._learn(e.word);
    const seen = this.museum.filter((m) => this.S.exhibits[m.e.id]).length;
    const w = e.word && WORD[e.word] ? `<div class="mini-glyph">${glyphSVG(e.word, 56)}<span>「${WORD[e.word].ko}」</span></div>` : '';
    g.ui.serviceCard(`박물관 · ${e.era}`, e.title, e.text, [], `${w}<div class="svc-stat"><span>이 박물관에서 본 전시 <b>${seen}/6</b></span></div>`);
    this._checkMuseum();
  }
  _checkMuseum() {
    if (!this.museum || this.S.museums[this.museumKey]) return;
    if (this.museum.every((m) => this.S.exhibits[m.e.id])) {
      this.S.museums[this.museumKey] = true;
      this._add('trinket', 1, true); this.inv.starseed = (this.inv.starseed || 0) + 3;
      setTimeout(() => this.game.ui.toast('전시를 모두 보았다 · 기념품 노래 장신구 + 별씨 3', { kind: 'item' }), 600);
    }
  }
  /** 해설사의 안내: 전시대를 차례로 비추며 이야기한다 (카드를 닫으면 안내도 끝) */
  tour() {
    const g = this.game;
    if (!this.museum) return;
    const list = this.museum.slice();
    let i = 0;
    const show = () => {
      if (i >= list.length) { this._tourStep = null; g.rig.override = null; g.ui.closeCard(); g.ui.toast('해설사: 「와 주어 고마워요」', {}); this._checkMuseum(); return; }
      const step = i, m = list[i++];
      this._tourStep = step;
      const dx = m.x - this.K.cx, dz = m.z - this.K.cz, d = Math.hypot(dx, dz) || 1;
      g.rig.override = { pos: new THREE.Vector3(m.x - (dx / d) * 3.4 + (-dz / d) * 1.2, this.K.fy + 2.4, m.z - (dz / d) * 3.4 + (dx / d) * 1.2), look: new THREE.Vector3(m.x, this.K.fy + 1.8, m.z) };
      const first = !this.S.exhibits[m.e.id];
      this.S.exhibits[m.e.id] = true;
      if (first) this._learn(m.e.word);
      g.ui.serviceCard(`해설사의 안내 · ${i}/${list.length}`, m.e.title, m.e.text, [{ label: i < list.length ? '다음 전시로' : '안내 마치기', primary: true, stay: true, onClick: () => show() }], '',
        { onClose: () => { if (this._tourStep === step) { this._tourStep = null; g.rig.override = null; } } });
    };
    show();
  }

  classQuiz() {
    const g = this.game, t = g.world.clock.time % 1;
    if (this.S.days.school === this._day()) { g.ui.toast('오늘 수업은 이미 들었어요. 내일 또 와요', { kind: 'muted' }); return; }
    if (t < 0.27 || t > 0.72) { g.ui.serviceCard('노래 학교', '지금은 수업이 없어요', '수업은 아침부터 저녁 전까지 열려요. 그때 다시 오세요.', []); return; }
    const L = g.lang;
    const unknown = WORDS.filter((w) => !L.known(w.id));
    const pool = (unknown.length >= 3 ? unknown : WORDS).slice().sort(() => Math.random() - 0.5);
    const qs = pool.slice(0, 3);
    let k = 0, right = 0;
    const ask = () => {
      if (k >= qs.length) {
        this.S.days.school = this._day();
        this._wage(1, `수업 ${right}/3`);
        this._say('teach', 'thanks');
        return;
      }
      const w = qs[k++];
      const wrong = WORDS.filter((x) => x.id !== w.id).sort(() => Math.random() - 0.5).slice(0, 2);
      const opts = [w, ...wrong].sort(() => Math.random() - 0.5);
      audio.sing && audio.sing(w.notes, { gain: 0.3 });
      const wrap = g.ui.serviceCard(`노래 학교 · 문제 ${k}/3`, '이 노래는 무슨 뜻일까요?', '선생님이 노래하고 글자를 보여 줘요. 점의 높이가 음의 높이예요.', [
        ...opts.map((o) => ({ label: o.ko, onClick: () => { const ok = o.id === w.id; if (ok) { right++; L.learn(w.id, 'teach', true); } g.ui.toast(ok ? `맞아요 · 「${w.ko}」` : `「${w.ko}」였어요`, { kind: ok ? 'item' : 'muted' }); setTimeout(ask, 450); } })),
        { label: '▶ 다시 듣기', sub: '선생님이 한 번 더 노래한다', stay: true, onClick: () => audio.sing && audio.sing(w.notes, { gain: 0.3 }) },
      ], `<div class="mini-glyph big">${glyphSVG(w.id, 96)}</div>`);
      void wrap;
    };
    ask();
  }

  treat() {
    const g = this.game, p = g.player.pos;
    if (this._treatT && this.t - this._treatT < 30) { g.ui.toast('방금 진료를 받았어요. 조금 쉬었다 와요', { kind: 'muted' }); return; }
    this._treatT = this.t;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.05, 3, 24), glowMaterial({ color: 0xbfefff, intensity: 2.0 }));
    ring.rotation.x = Math.PI / 2;
    this.K.group.add(ring);
    const t0 = this.t;
    this.fx.push((t) => { const k = (t - t0) / 3; if (k > 1) { this.K && this.K.group.remove(ring); return true; } ring.position.set(p.x, p.y + 0.1 + (Math.sin(k * Math.PI * 3) * 0.5 + 0.5) * 1.8, p.z); return false; });
    audio.sing && audio.sing([4, 2, 0, 2, 4], { gain: 0.25, step: 0.35 });
    this._say('heal');
    setTimeout(() => { this.buff('calm'); this._learn('heal'); g.ui.toast('치유사: 울림이 고르게 됐어요 · 맑은 울림 (8분)', { kind: 'item' }); }, 3000);
  }

  archives(recs) {
    const g = this.game;
    g.ui.serviceCard('서고', '기록 결정', '결정을 손에 쥐면 옛 노래가 들린다. 읽으면 말을 하나 배워요.', [
      ...recs.map((R) => ({ label: `${this.S.archives[R.id] ? '✓ ' : ''}${R.title}`, sub: R.text.slice(0, 34) + '…', onClick: () => { this.S.archives[R.id] = true; this._learn(R.word); g.ui.serviceCard('기록 결정', R.title, R.text, [], R.word && WORD[R.word] ? `<div class="mini-glyph">${glyphSVG(R.word, 56)}<span>「${WORD[R.word].ko}」</span></div>` : ''); } })),
      { label: '빌려 가기', sub: (this.inv.book || 0) > 0 ? '이미 빌린 결정이 있어요' : '가방에 넣어 두고 아무 데서나 읽는다', disabled: (this.inv.book || 0) > 0, onClick: () => this._add('book') },
    ]);
  }

  /** 실험: 물질이 내는 음을 듣고 같은 음을 고른다 (세 번) */
  experiment() {
    const g = this.game;
    let k = 0, right = 0;
    const round = () => {
      if (k >= 3) {
        if (right >= 2) { this._add('shard'); this._say('research', 'thanks'); } else g.ui.toast(`실험 ${right}/3 · 다시 해 봐요`, { kind: 'muted' });
        return;
      }
      k++;
      const target = Math.floor(Math.random() * 5);
      const play = () => audio.tone && audio.tone(target, { gain: 0.45 });
      play();
      g.ui.serviceCard(`연구동 · 실험 ${k}/3`, '이 물질은 어떤 음으로 울릴까요?', '들은 음과 같은 음을 고르세요. 맞으면 물질이 그 음으로 정렬된다.', [
        { label: '▶ 다시 듣기', stay: true, onClick: play },
        ...['솟음', '열림', '흐름', '빛', '고요'].map((nm, i) => ({ label: `${nm}`, sub: `${i + 1}번 음`, onClick: () => { audio.tone && audio.tone(i, { gain: 0.35 }); const ok = i === target; if (ok) right++; g.ui.toast(ok ? '정렬됐다!' : '어긋났다…', { kind: ok ? 'item' : 'muted' }); setTimeout(round, 600); } })),
      ]);
    };
    round();
  }

  /** 생산 줄: 빛 표시가 가운데 칸에 올 때 누르기 (여섯 번) */
  lineWork() {
    const g = this.game;
    this._learn('build');
    this._timing('빚음 공방 · 생산 줄', '빛 표시가 가운데 칸에 들어올 때 「빚기」(E·스페이스). 박자에 맞춰 여섯 번.', 6, (hits) => {
      const pay = 1 + hits;
      this._wage(pay, `생산 줄 ${hits}/6`);
      if (hits >= 5) this._add('lantern');
      audio.sing && audio.sing(WORK_TUNES.factory, { gain: 0.25 });
      this._say('work', 'thanks');
    });
  }

  /** 분류: 들어온 짐의 색에 맞는 칸으로 (여섯 개) */
  sortWork() {
    const g = this.game;
    this._learn('carry');
    const COLS = ['#ff9fd0', '#7ff3e6', '#ffd27a'], NAMES = ['분홍 칸', '청록 칸', '금빛 칸'];
    let k = 0, right = 0;
    const next = () => {
      if (k >= 6) { this._wage(1 + right, `짐 나누기 ${right}/6`); audio.sing && audio.sing(WORK_TUNES.depot, { gain: 0.25 }); return; }
      k++;
      const c = Math.floor(Math.random() * 3);
      const glyphW = WORDS[Math.floor(Math.random() * WORDS.length)];
      const t0 = performance.now();
      g.ui.serviceCard(`물류 창고 · 짐 ${k}/6`, '이 짐은 어느 칸으로?', '짐에 붙은 빛 띠의 색을 보고 같은 색 칸으로 보내요. 빠를수록 좋아요.', NAMES.map((nm, i) => ({
        label: nm, sub: ' ', onClick: () => { const ok = i === c && performance.now() - t0 < 6000; if (ok) right++; g.ui.toast(ok ? '맞는 칸!' : '다른 칸이었어요', { kind: ok ? 'item' : 'muted' }); setTimeout(next, 300); },
      })), `<div class="mini-parcel" style="--c:${COLS[c]}"><div class="box">${glyphSVG(glyphW.id, 44)}</div></div>`);
      const btns = document.querySelectorAll('.svc-b');
      btns.forEach((b, i) => { b.style.borderColor = COLS[i]; b.style.boxShadow = `inset 4px 0 0 ${COLS[i]}`; });
    };
    next();
  }

  /**
   * 발전소: 출력 바늘을 띠 안에 붙잡아 두기 (12초). 핵의 출력이 물결치며 바늘을 민다 — 거꾸로 밀어 붙잡는다.
   * o: { kicker, title, pay, onWin } — 코일 탑 조율도 같은 놀이를 쓴다
   */
  powerWork(o = {}) {
    const g = this.game;
    const html = `<div class="mini-meter"><div class="band"></div><div class="needle"></div></div><div class="mini-row"><button class="btn" data-d="-1">▼ 낮추기</button><button class="btn" data-d="1">▲ 높이기</button></div><p class="mini-msg">띠 안에 머문 시간 <b>0.0</b>초 / 7초 · 남은 시간 <i>12</i>초</p>`;
    const wrap = g.ui._card(`<div class="kicker">${o.kicker || '공명 발전소 · 조종대'}</div><h2>${o.title || '출력 맞추기'}</h2><p>핵의 출력이 물결친다. ▲▼(또는 방향키 위·아래, W·S)로 바늘을 가운데 띠 안에 붙잡아 두세요. 12초 동안 7초를 넘기면 성공.</p>${html}`, null, { keys: false });
    let x = 0.5, v = 0, inBand = 0, T = 0, done = false;
    const t0 = performance.now(), ph1 = Math.random() * TAU, ph2 = Math.random() * TAU;
    const needle = wrap.querySelector('.needle'), msg = wrap.querySelector('.mini-msg b'), left = wrap.querySelector('.mini-msg i');
    const push = (d) => { v += d * 0.32; };
    wrap.querySelectorAll('[data-d]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); push(+b.dataset.d); }));
    const key = (e) => { if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') push(1); if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') push(-1); };
    window.addEventListener('keydown', key);
    const tick = (now) => {
      if (done || !wrap.isConnected) { window.removeEventListener('keydown', key); return; }
      // 벽시계로 (화면이 느려도 12초는 12초) · 물리는 1/60초씩 나눠서
      const T1 = Math.min(12, (now - t0) / 1000);
      while (T1 - T > 1e-4) {
        const dt = Math.min(1 / 60, T1 - T); T += dt;
        const surge = 0.34 * Math.sin(T * 0.75 + ph1) + 0.22 * Math.sin(T * 1.8 + ph2);
        v += (surge + (Math.random() - 0.5) * 0.8) * dt;
        v *= Math.exp(-0.9 * dt);
        x += v * dt;
        if (x < 0 || x > 1) { x = Math.max(0, Math.min(1, x)); v *= -0.3; }
        if (x > 0.42 && x < 0.58) inBand += dt;
      }
      needle.style.left = `${x * 100}%`;
      msg.textContent = inBand.toFixed(1);
      left.textContent = Math.max(0, Math.ceil(12 - T));
      if (T1 >= 12) {
        done = true; window.removeEventListener('keydown', key);
        wrap.close();
        if (inBand >= 7) { this._wage(o.pay || 4, `${o.title || '출력 맞추기'} 성공`); this._learn('core'); audio.sing && audio.sing(WORK_TUNES.plant, { gain: 0.25 }); if (o.onWin) o.onWin(); else this._say('work', 'thanks'); }
        else { this._wage(1, `${o.title || '출력 맞추기'} · 띠 안에 ${inBand.toFixed(1)}초 (7초를 넘기면 별씨 ${o.pay || 4})`); }
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /** 박자 맞추기 (공방): 표시가 오가는 막대, 가운데 칸에서 누르기 */
  _timing(title, desc, rounds, onDone) {
    const g = this.game;
    const wrap = g.ui._card(`<div class="kicker">${title}</div><h2>박자 맞추기</h2><p>${desc}</p><div class="mini-bar"><div class="zone"></div><div class="mark"></div></div><div class="mini-row"><button class="btn primary" data-hit>빚기 (E)</button></div><p class="mini-msg">0 / ${rounds}</p>`, null, { keys: false });
    const mark = wrap.querySelector('.mark'), msg = wrap.querySelector('.mini-msg');
    let n = 0, hits = 0, last = performance.now(), ph = 0, sp = 0.55, done = false;
    const hit = () => {
      if (done) return;
      const x = 0.5 + 0.5 * Math.sin(ph);
      const ok = x > 0.4 && x < 0.6;
      if (ok) hits++;
      n++; sp *= 1.12;
      audio.tone && audio.tone(ok ? 2 : 0, { gain: 0.3 });
      msg.textContent = `${hits} / ${n} ${ok ? '· 좋아요!' : '· 빗나감'}`;
      if (n >= rounds) { done = true; window.removeEventListener('keydown', key); setTimeout(() => { wrap.close(); onDone(hits); }, 400); }
    };
    const key = (e) => { if (e.key === 'e' || e.key === 'E' || e.key === ' ' || e.key === 'Enter') { e.preventDefault(); hit(); } };
    window.addEventListener('keydown', key);
    wrap.querySelector('[data-hit]').addEventListener('click', (e) => { e.stopPropagation(); hit(); });
    const tick = (now) => {
      if (done || !wrap.isConnected) { window.removeEventListener('keydown', key); return; }
      const dt = Math.min(0.25, (now - last) / 1000); last = now;
      ph += dt * sp * TAU;
      mark.style.left = `${(0.5 + 0.5 * Math.sin(ph)) * 100}%`;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // ── 표·여행 ─────────────────────────────
  tickets() {
    const g = this.game, here = this.cur && this.cur.r;
    const by = new Map();
    for (const r of g.city.recs) {
      if (r.use !== 'terminal' || !here || r.zone === here.zone) continue;
      const d = Math.hypot(r.x - here.x, r.z - here.z);
      const cur = by.get(r.zone);
      if (!cur || d < cur.d) by.set(r.zone, { r, d });
    }
    const ZN = ZONE_NAMES;
    const list = [...by.values()].sort((a, b) => a.d - b.d).slice(0, 7);
    if (!list.length) { g.ui.serviceCard('터미널', '행선지', '지금은 다른 구역으로 가는 편이 없어요.', []); return; }
    g.ui.serviceCard('교통 터미널', '어디로 갈까요?', `가진 별씨 ${this.inv.starseed || 0} · 표를 사면 바로 출발해요 (하늘배·빛길 환승)`, list.map(({ r, d }) => {
      const price = Math.max(1, Math.round(d / 2500) + 1);
      return { label: `${ZN[r.zone] || r.zone} · 별씨 ${price}`, sub: `${(d / 1000).toFixed(1)} km`, disabled: (this.inv.starseed || 0) < price, onClick: () => { if (!this._pay(price)) return; this._learn('go'); this.travelTo(r, ZN[r.zone] || r.zone); } };
    }));
  }
  travelTo(r, name) {
    const g = this.game;
    g.interiors.close();
    g.ui.fade(true);
    setTimeout(() => {
      g.player.teleport(r.door.x + r.door.nx * 4, undefined, r.door.z + r.door.nz * 4);
      g.player.yaw = Math.atan2(r.door.nx, r.door.nz);
      g.rig.yaw = g.player.yaw + Math.PI;
      g.ui.fade(false);
      g.ui.toast(`${name} 터미널에 내렸다`, {});
      g.setFlag('rodeSky');
    }, 1300);
  }

  // ── 일거리 (사무탑 게시판·창고 배달) ──────────────
  jobBoard(here = this.cur && this.cur.r) {
    const g = this.game;
    if (this.S.job) { this._jobStatus(); return; }
    if (!here) return;
    const rnd = mulberry32((this._day() * 977 + here.idx) | 0);
    const offices = g.city.recs.filter((r) => r !== here && r.zone === here.zone && (r.use === 'office' || r.use === 'hall' || r.use === 'school' || r.use === 'heal'));
    const pickFar = (arr) => { const c = arr.filter((r) => { const d = Math.hypot(r.x - here.x, r.z - here.z); return d > 200 && d < 1100; }); return c.length ? c[Math.floor(rnd() * c.length)] : null; };
    const items = [];
    const doc = pickFar(offices);
    if (doc) { const I = g.interiors.info(doc); const d = Math.hypot(doc.x - here.x, doc.z - here.z); items.push({ label: `문서 전하기 → ${I.name}`, sub: `${Math.round(d)} m · 별씨 ${2 + Math.round(d / 300)}`, onClick: () => this._takeJob({ kind: 'deliver', label: `문서 → ${I.name}`, x: doc.door.x, z: doc.door.z, reward: 2 + Math.round(d / 300), word: 'carry' }) }); }
    const mk = g.city.marks && g.city.marks.length ? g.city.marks[Math.floor(rnd() * g.city.marks.length)] : null;
    if (mk) { const d = Math.hypot(mk.x - here.x, mk.z - here.z); items.push({ label: `측량 · ${mk.name}의 높이 재기`, sub: `${(d / 1000).toFixed(1)} km · 별씨 ${3 + Math.round(d / 800)}`, onClick: () => this._takeJob({ kind: 'visit', label: `측량 → ${mk.name}`, x: mk.x, z: mk.z, r: 60, reward: 3 + Math.round(d / 800), word: 'far' }) }); }
    const roles = [['tend', '정원지기'], ['sell', '장터지기'], ['music', '악사'], ['carry', '짐꾼']];
    const [role, rname] = roles[Math.floor(rnd() * roles.length)];
    items.push({ label: `안부 전하기 · 아무 ${rname}에게`, sub: '거리에서 그 일을 하는 주민과 이야기하면 끝 · 별씨 2', onClick: () => this._takeJob({ kind: 'greet', role, label: `안부 → ${rname}`, reward: 2, word: 'friend' }) });
    g.ui.serviceCard('사무탑', '오늘의 일거리', '도시의 일은 노래로 나누어 맡아요. 하나를 맡으면 나침반에 목적지가 보여요.', items);
  }
  deliveryCard(here = this.cur && this.cur.r) {
    const g = this.game;
    if (this.S.job) { this._jobStatus(); return; }
    if (!here) return;
    const cands = g.city.recs.filter((r) => r !== here && r.zone === here.zone && Math.hypot(r.x - here.x, r.z - here.z) > 220 && Math.hypot(r.x - here.x, r.z - here.z) < 1200);
    if (!cands.length) { g.ui.toast('지금은 맡길 짐이 없어요', { kind: 'muted' }); return; }
    const dst = cands[Math.floor(Math.random() * cands.length)];
    const I = g.interiors.info(dst), d = Math.hypot(dst.x - here.x, dst.z - here.z);
    const reward = 2 + Math.round(d / 250);
    g.ui.serviceCard('물류 창고', '배달 창구', `${I.name}로 갈 짐이 있어요. ${Math.round(d)} m.`, [
      { label: `짐 맡기 · 별씨 ${reward}`, sub: '그 건물 문 앞까지 가면 전해져요', primary: true, onClick: () => this._takeJob({ kind: 'deliver', label: `짐 → ${I.name}`, x: dst.door.x, z: dst.door.z, reward, word: 'carry', parcel: true }) },
    ]);
  }
  _takeJob(job) {
    this.S.job = job;
    if (job.parcel) this.inv.parcel = 1;
    this.game.ui.toast(`일을 맡았다 · ${job.label}`, {});
    audio.chime && audio.chime('soft');
  }
  _jobStatus() {
    const g = this.game, J = this.S.job;
    g.ui.serviceCard('맡은 일', J.label, J.kind === 'greet' ? '거리에서 그 일을 하는 주민과 이야기하면 끝나요.' : '나침반·지도의 표시를 따라가요.', [
      { label: '일 그만두기', sub: '맡은 일을 내려놓는다', onClick: () => { this.S.job = null; this.inv.parcel = 0; } },
    ]);
  }
  _finishJob() {
    const J = this.S.job;
    this.S.job = null;
    this.inv.parcel = 0;
    this._learn(J.word);
    this._wage(J.reward, `일을 마쳤다 · ${J.label}`);
    this.game.setFlag('helpedNeighbor');
  }
  /** 주민과 이야기했을 때 (안부 일거리) */
  onTalk(p) { const J = this.S.job; if (J && J.kind === 'greet' && p.role === J.role) this._finishJob(); }
  /** 나침반·지도 표시 */
  targets() {
    const J = this.S.job;
    if (!J || J.kind === 'greet') return [];
    return [{ x: J.x, y: null, z: J.z, label: J.label }];
  }

  // ── 공연·정원·집 ─────────────────────────────
  _showtime() { const t = this.game.world.clock.time % 1; return t > 0.45 && t < 0.92; }
  concert() {
    const g = this.game;
    if (!this._showtime()) { g.ui.serviceCard('공연장', '공연 시간표', '합창은 한낮이 지나면 시작해 밤까지 이어져요. 그때 객석에 앉으면 함께 부를 수도 있어요.', []); return; }
    const phrase = Array.from({ length: 4 }, () => Math.floor(Math.random() * 5));
    audio.sing && audio.sing(phrase, { gain: 0.32, step: 0.45 });
    this._say('sing', 'friend');
    let inp = [];
    const NAMES = ['솟음', '열림', '흐름', '빛', '고요'];
    const wrap = g.ui.serviceCard('공연장', '합창단이 노래한다', '방금 부른 네 음을 따라 불러 보세요 (버튼 또는 1~5).', [
      { label: '▶ 한 번 더 듣기', stay: true, onClick: () => audio.sing && audio.sing(phrase, { gain: 0.32, step: 0.45 }) },
      ...NAMES.map((nm, i) => ({ label: nm, sub: `${i + 1}`, stay: true, onClick: () => press(i) })),
    ], `<p class="mini-msg">따라 부른 음: <b>-</b></p>`);
    const msg = wrap.querySelector('.mini-msg b');
    const press = (i) => {
      audio.tone && audio.tone(i, { gain: 0.4 });
      inp.push(i);
      msg.textContent = inp.map((n) => NAMES[n]).join(' · ');
      if (inp.length === phrase.length) {
        const ok = inp.every((n, k) => n === phrase[k]);
        setTimeout(() => {
          wrap.close();
          if (ok) { this.buff('calm'); this._learn('chorus'); g.ui.toast('합창에 섞였다! · 맑은 울림', { kind: 'item' }); }
          else g.ui.toast('조금 달랐어요. 다음 노래 때 또 해 봐요', { kind: 'muted' });
        }, 300);
      }
    };
    const key = (e) => { const n = +e.key; if (n >= 1 && n <= 5) press(n - 1); };
    window.addEventListener('keydown', key);
    const obs = setInterval(() => { if (!wrap.isConnected) { window.removeEventListener('keydown', key); clearInterval(obs); } }, 500);
  }
  tend() {
    const g = this.game;
    if (this.S.days.garden === this._day()) { g.ui.toast('오늘은 다 돌봤어요', { kind: 'muted' }); return; }
    const moist = [0.6, 0.3, 0.8].map((m) => Math.max(0.1, m + (Math.random() - 0.5) * 0.4));
    let left = 3;
    const draw = (wrap) => wrap.querySelectorAll('.svc-b').forEach((b, i) => { if (i < 3) b.querySelector('small').textContent = `물기 ${'●'.repeat(Math.round(moist[i] * 5))}${'○'.repeat(5 - Math.round(moist[i] * 5))}`; });
    const wrap = g.ui.serviceCard('정원', '화단 돌보기', '가장 마른 화단부터 물을 주세요 (세 번).', [0, 1, 2].map((i) => ({ label: `${i + 1}번 화단`, sub: ' ', stay: true, onClick: () => {
      const driest = moist.indexOf(Math.min(...moist));
      const ok = i === driest;
      moist[i] = Math.min(1, moist[i] + 0.5);
      audio.tone && audio.tone(2, { gain: 0.3 });
      left--;
      if (!ok) g.ui.toast('다른 화단이 더 말랐어요', { kind: 'muted' });
      draw(wrap);
      if (left <= 0) { wrap.close(); this.S.days.garden = this._day(); this._add('flower'); this._learn('grow'); this._say('garden', 'thanks'); }
    } })));
    draw(wrap);
  }
  sleep() {
    const g = this.game, t = g.world.clock.time % 1;
    if (t > 0.3 && t < 0.72) { g.ui.toast('아직 낮이에요. 저녁에 다시 와요', { kind: 'muted' }); return; }
    this.buff('full');
    g.rest(0.27);
  }
  snack() {
    const g = this.game;
    if (this.S.days.snack === this._day()) { g.ui.toast('오늘 간식은 받았어요', { kind: 'muted' }); return; }
    this.S.days.snack = this._day();
    this._add(Math.random() < 0.5 ? 'cookie' : 'fruit');
    this._say('cook', 'thanks');
  }

  // ── 가방에서 쓰기 ───────────────────────────
  useItem(id) {
    const I = ITEMS[id], g = this.game;
    if (!I || (this.inv[id] || 0) <= 0) return;
    if (I.use === 'eat') return this.eat(id);
    if (I.use === 'map') {
      this.inv[id]--;
      const p = g.player.pos, md = g.mapData;
      let best = null;
      for (let k = 0; k < 40; k++) { const a = Math.random() * TAU, d = 600 + Math.random() * 2400, x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d; if (md.revealedAt(x, z) < 0.3) { best = [x, z]; break; } }
      if (best) { md.reveal(best[0], best[1], 900); g.ui.toast('지도 결정이 빛나며 먼 곳을 비춘다 · 지도가 밝혀졌다', { kind: 'item' }); }
      else g.ui.toast('가까운 곳은 이미 다 밝혀져 있어요', { kind: 'muted' });
      return;
    }
    if (I.use === 'read') {
      this.inv[id]--;
      const L = g.lang, un = WORDS.filter((w) => !L.known(w.id));
      if (un.length) { const w = un[Math.floor(Math.random() * un.length)]; L.learn(w.id, 'teach'); }
      else g.ui.toast('결정 속 노래는 이미 아는 말들이었다', { kind: 'muted' });
      return;
    }
    if (I.use === 'gift') g.ui.toast('주민에게 말을 걸어 선물할 수 있어요', { kind: 'muted' });
  }

  // ── 매 프레임 ─────────────────────────────
  update(dt) {
    this.t += dt;
    const g = this.game, S = this.S;
    // 기운: 시간이 지나면 사라진다 → 플레이어 몸에
    let speed = 1, glide = 1;
    for (const [id, left] of Object.entries(S.buffs)) {
      const nl = left - dt;
      if (nl <= 0) { delete S.buffs[id]; g.ui.toast(`${BUFFS[id].name} 기운이 사라졌다`, { kind: 'muted' }); continue; }
      S.buffs[id] = nl;
      speed *= BUFFS[id].speed || 1; glide *= BUFFS[id].glide || 1;
    }
    if (g.player.mods) { g.player.mods.speed = speed; g.player.mods.glide = glide; }
    // 일거리: 목적지에 닿으면 끝
    const J = S.job;
    if (J && J.kind !== 'greet') {
      const p = g.player.pos;
      if (Math.hypot(p.x - J.x, p.z - J.z) < (J.r || 6)) this._finishJob();
    }
    for (let i = this.fx.length - 1; i >= 0; i--) if (this.fx[i](this.t)) this.fx.splice(i, 1);
    // 기운 표시 (1초마다)
    this._hudT -= dt;
    if (this._hudT <= 0) { this._hudT = 1; this._hud(); }
  }
  _hud() {
    const ui = this.game.ui;
    if (!ui.root) return;
    if (!this.hudEl) { this.hudEl = document.createElement('div'); this.hudEl.className = 'buffs'; ui.root.appendChild(this.hudEl); }
    const S = this.S, parts = [];
    for (const [id, left] of Object.entries(S.buffs)) parts.push(`<span>${BUFFS[id].name} ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}</span>`);
    if (S.job) parts.push(`<span class="job">맡은 일 · ${S.job.label}</span>`);
    const html = parts.join('');
    if (html !== this._hudHtml) { this.hudEl.innerHTML = html; this._hudHtml = html; }
  }
}
