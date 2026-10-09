// 건물이 실제로 일한다 — 들어간 건물의 쓰임마다 시설(진열대·계산대·전시대·생산 줄·분류대·표 파는 곳·실험대…)을 두고,
// 플레이어가 그 사회의 한 사람으로 직접 쓴다. 관찰자가 아니다.
//  · 돈은 울(data/money.js): 공방·창고·발전소·사무탑에서 일하면 받고, 가게·찻집·터미널에서 쓴다. 가게에 물건을 되팔 수도 있다.
//  · 가방의 물건은 쓸모가 있다: 먹으면 몸의 기운(빨리 달리기·멀리 활공), 선물, 지도 밝히기, 기록 읽기.
//  · 시설은 눈에 보이게 움직인다: 생산 줄 위로 물건이 흐르고, 분류대로 짐이 가고, 전시물이 돌고, 출발판이 깜박이고,
//    요리하면 김이 오르고, 발전소 핵이 맥박친다. 일하는 주민도 그 자리에서 일한다.
//  · 시설 = { x, y, z, r, label(), short, use() } — game._findTarget 이 가까운 것을 고르고 E 로 쓴다.
import * as THREE from 'three';
import { glowMaterial } from '../world/materials.js';
import { audio } from '../core/audio.js';
import { WORD, WORDS } from '../data/lexicon.js';
import { glyphSVG } from './language.js';
import { ITEMS, BUFFS, SHELVES, MENU, EXHIBITS, ARCHIVES, BAG_ORDER, WORK_TUNES, ZONE_NAMES, itemInfo } from '../data/venues.js';
import { mulberry32 } from '../core/noise.js';
import { won } from '../data/money.js';
import { josa } from '../core/josa.js';
import { BAL } from '../data/balance.js';
import { openPlaque } from '../ui/devices/plaque.js';
import { openChalk } from '../ui/devices/chalkboard.js';
import { openFlap } from '../ui/devices/flapboard.js';
import { workStrip } from '../ui/devices/workstrip.js';
import { labBench, sorter, reactor, scoreStand } from '../ui/devices/bench.js';

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
  /** 물건을 가방에: 도시의 물건이면 그 구역 가게·창고 재고에서 온다 (v0.9 — 저절로 생기지 않는다) */
  _add(id, n = 1, quiet = false) {
    const E = this.game.econ;
    if (n > 0 && E && this.game.city) n = E.goodsOut(id, n);
    if (n <= 0) { if (!quiet) this.game.ui.toast(`${itemInfo(id) ? itemInfo(id).name : id} — 구역에 남은 것이 없어요`, { kind: 'muted' }); return 0; }
    this.inv[id] = (this.inv[id] || 0) + n;
    if (!quiet) this.game.ui.toast(`${itemInfo(id) ? itemInfo(id).name : id} ${n > 0 ? '+' : ''}${n}`, { kind: 'item' });
    return n;
  }
  /** 값 치르기: 플레이어 → 그 구역 회사 몫 (도시 장부) */
  _pay(n, why = '값', to = 'firms') {
    if ((this.inv.starseed || 0) < n) { this.game.ui.toast(`돈이 모자라요 (가진 돈 ${won(this.inv.starseed || 0)})`, { kind: 'muted' }); return false; }
    const E = this.game.econ;
    if (E && this.game.city) E.charge(n, why, to); else { this.inv.starseed -= n; this.S.spent += n; }
    audio.chime && audio.chime('soft');
    return true;
  }
  /** 품삯: 그 구역 회사 몫 → 플레이어 (금고에 있는 만큼). 건물 속 교대 일(ops)이 부른 놀이는 퇴근 때 한꺼번에 받으므로 여기서 주지 않는다 */
  _wage(n, what, from = 'firms') {
    if (this.payless && performance.now() < this.payless) { this.payless = 0; this.game.ui.toast(`${what} · 교대 일로 셈`, { kind: 'item' }); return 0; }
    const E = this.game.econ;
    const paid = E && this.game.city ? E.reward(n, what, from) : (this.inv.starseed = (this.inv.starseed || 0) + n, n);
    this.S.earned += paid; this.S.worked++;
    this.game.ui.toast(`${what} · +${won(Math.round(paid * 100) / 100)}${paid < n ? ' (구역 금고가 모자라 덜 받음)' : ''} (가진 돈 ${won(this.inv.starseed)})`, { kind: 'item' });
    return paid;
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

  clear() { this.stations = []; this.cur = null; this.K = null; this.order = null; }

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

  /** 먹기: 기운 + (가게 밖에서 먹으면 가방에서 하나 줄인다) */
  eat(id, here = false) {
    const I = itemInfo(id);
    if (!I || I.use !== 'eat') return;
    if (!here) { if ((this.inv[id] || 0) <= 0) return; this.inv[id]--; }
    this.buff(I.buff);
    this._learn('eat');
    this.game.ui.toast(`${josa(I.name, '을')} 먹었다 · ${BUFFS[I.buff].name}`, { kind: 'item' });
    if (this.game.health) this.game.health.heal(BAL.HEAL[id] ?? BAL.FOOD_HEAL); // 먹으면 조금 회복 (약은 많이)
  }

  buff(id) {
    const B = BUFFS[id];
    if (!B) return;
    this.S.buffs[id] = B.dur;
    this._hudT = 0;
  }

  exhibit(e) {
    if (this.game.tips && this.game.tips.first('museum', () => this.exhibit(e))) return;
    const g = this.game, first = !this.S.exhibits[e.id];
    this.S.exhibits[e.id] = true;
    if (first) this._learn(e.word);
    const ids = [...new Set((this.museum || []).map((m) => m.e.id))];
    const seen = ids.filter((id) => this.S.exhibits[id]).length;
    // 받침 옆 놋쇠 명판 (전시품을 가리지 않게 화면 오른쪽에 비스듬히)
    openPlaque(g, { mat: 'brass', side: 'right', kicker: '전시 설명', title: e.title, era: e.era, text: e.text,
      art: e.word && WORD[e.word] ? `${glyphSVG(e.word, 56)}<span>「${WORD[e.word].ko}」</span>` : '', foot: `이 박물관에서 본 전시 ${seen}/${ids.length || 1}` });
    this._checkMuseum();
  }
  _checkMuseum() {
    if (!this.museum || this.S.museums[this.museumKey]) return;
    if (this.museum.every((m) => this.S.exhibits[m.e.id])) {
      this.S.museums[this.museumKey] = true;
      this._add('trinket', 1, true); if (this.game.econ) this.game.econ.reward(3, '박물관 기념', 'commons'); else this.inv.starseed = (this.inv.starseed || 0) + 3;
      setTimeout(() => this.game.ui.toast('전시를 모두 보았다 · 기념품 노래 장신구 + 3울', { kind: 'item' }), 600);
    }
  }
  /** 해설사의 안내: 전시대를 차례로 비추며 이야기한다 (카드를 닫으면 안내도 끝) */
  tour() {
    if (this.game.tips && this.game.tips.first('museum', () => this.tour())) return;
    const g = this.game;
    if (!this.museum || !this.K) { g.ui.toast('해설사: 「전시실의 안내 빛판 앞에서 함께 둘러봐요」', { kind: 'muted' }); return; }
    const list = this.museum.slice();
    const LEAD = ['먼저 이쪽이에요.', '다음은 여기예요.', '이건 꼭 가까이서 보세요.', '여기 서 보세요.', '이 앞에서 잠깐요.', '마지막이에요.'];
    let i = 0;
    const show = () => {
      if (i >= list.length) { this._tourStep = null; g.ui.toast('해설사: 「와 주어 고마워요」', {}); this._checkMuseum(); return; }
      const step = i, m = list[i++];
      this._tourStep = step;
      const dx = m.x - this.K.cx, dz = m.z - this.K.cz, d = Math.hypot(dx, dz) || 1;
      const cam = { pos: new THREE.Vector3(m.x - (dx / d) * 3.4 + (-dz / d) * 1.2, this.K.fy + 2.4, m.z - (dz / d) * 3.4 + (dx / d) * 1.2), look: new THREE.Vector3(m.x, this.K.fy + 1.8, m.z) };
      if (!this.S.exhibits[m.e.id]) { this.S.exhibits[m.e.id] = true; this._learn(m.e.word); }
      openPlaque(g, { mat: 'brass', side: 'right', kicker: `해설사와 둘러보기 · ${i}/${list.length}`, title: m.e.title, era: m.e.era, text: m.e.text, cam,
        say: `해설사: 「${i === list.length ? LEAD[5] : LEAD[step % 5]} ${m.e.title}이에요.」`,
        actions: [{ label: i < list.length ? '다음 전시로 ▸' : '안내 마치기', on: () => show() }],
        onClose: () => { if (this._tourStep === step) this._tourStep = null; } });
    };
    show();
  }
  classQuiz() {
    if (this.game.tips && this.game.tips.first('school', () => this.classQuiz())) return;
    const g = this.game, t = g.world.clock.time % 1;
    if (this.S.days.school === this._day()) { g.ui.toast('오늘 수업은 이미 들었어요. 내일 또 와요', { kind: 'muted' }); return; }
    if (t < 0.27 || t > 0.72) { openChalk(g, { title: '시간표', corner: '노래 학교', lines: ['아침 ~ 저녁 전 · 노래 글자 수업', '지금은 수업이 없어요. 그때 다시 와요.'] }); return; }
    const L = g.lang;
    const unknown = WORDS.filter((w) => !L.known(w.id));
    const pool = (unknown.length >= 3 ? unknown : WORDS).slice().sort(() => Math.random() - 0.5);
    const qs = pool.slice(0, 3);
    let k = 0, right = 0, lay = null;
    const ask = () => {
      if (lay && !lay.isConnected) return; // 칠판 앞을 떠났으면 수업도 끝
      if (k >= qs.length) {
        this.S.days.school = this._day();
        this._wage(1, `수업 ${right}/3`, 'commons');
        this._say('teach', 'thanks');
        lay.write({ title: '오늘 수업 끝', lines: [`맞힌 문제 ${right} / 3`, '내일 또 와요.'], art: '', choices: [], extra: [{ t: '교실에서 나가기 ▸', on: (Lay) => Lay.close() }] });
        return;
      }
      const w = qs[k++];
      const wrong = WORDS.filter((x) => x.id !== w.id).sort(() => Math.random() - 0.5).slice(0, 2);
      const opts = [w, ...wrong].sort(() => Math.random() - 0.5);
      audio.sing && audio.sing(w.notes, { gain: 0.3 });
      const spec = { title: `문제 ${k} / 3`, corner: '노래 학교', lines: ['이 노래는 무슨 뜻일까요?', '점의 높이가 음의 높이예요.'], art: glyphSVG(w.id, 96),
        choices: opts.map((o) => ({ t: o.ko, on: (Lay, i) => {
          const ok = o.id === w.id;
          Lay.mark(i, ok); if (!ok) Lay.mark(opts.indexOf(w), true);
          if (ok) { right++; L.learn(w.id, 'teach', true); }
          g.ui.toast(ok ? `맞아요 · 「${w.ko}」` : `「${w.ko}」였어요`, { kind: ok ? 'item' : 'muted' });
          setTimeout(ask, 1100);
        } })),
        extra: [{ t: '▶ 선생님, 한 번 더요', on: () => audio.sing && audio.sing(w.notes, { gain: 0.3 }) }] };
      if (!lay) lay = openChalk(g, spec); else lay.write(spec);
    };
    ask();
  }
  /**
   * 실험: 물질이 내는 음을 듣고 같은 음을 고른다 (세 번). 고를 수 있는 음 = 내가 아는 공명 음뿐.
   * 아는 음이 하나 이하면 「두 소리가 같은가」만 듣고 고른다 (연주할 필요 없음)
   */
  experiment() {
    if (this.game.tips && this.game.tips.first('lab', () => this.experiment())) return;
    const g = this.game;
    const pool = [...g.state.tones].sort((a, b) => a - b);
    let k = 0, right = 0, lay = null;
    const round = () => {
      if (lay && !lay.isConnected) return; // 실험대를 떠났으면 그만
      if (k >= 3) {
        setTimeout(() => lay && lay.close(), 600);
        if (right >= 2) { this._add('shard'); this._say('research', 'thanks'); } else g.ui.toast(`실험 ${right}/3 · 다시 해 봐요`, { kind: 'muted' });
        return;
      }
      k++;
      let spec;
      if (pool.length < 2) { // 아는 음이 하나 이하: 두 소리가 같은가만 듣는다 (연주할 필요 없음)
        const a = Math.floor(Math.random() * 5), b = Math.random() < 0.5 ? a : (a + 1 + Math.floor(Math.random() * 4)) % 5;
        const play = (v) => audio.tone && audio.tone(v ? b : a, { gain: 0.45 });
        play(0); setTimeout(() => play(1), 650);
        spec = { round: k, rounds: 3, mode: 'same', pool, play, answer: (same) => { const ok = same === (a === b); if (ok) right++; setTimeout(round, 1100); return ok; } };
      } else {
        const target = pool[Math.floor(Math.random() * pool.length)];
        const play = () => audio.tone && audio.tone(target, { gain: 0.45 });
        play();
        spec = { round: k, rounds: 3, mode: 'name', pool, play, answer: (i) => { const ok = i === target; if (ok) right++; setTimeout(round, 1100); return ok; } };
      }
      if (!lay) lay = labBench(g, spec); else lay.next(spec);
    };
    round();
  }
  /** 분류: 들어온 짐의 색에 맞는 칸으로 (여섯 개) */
  sortWork() {
    if (this.game.tips && this.game.tips.first('depot', () => this.sortWork())) return;
    const g = this.game;
    this._learn('carry');
    const COLS = ['#ff9fd0', '#7ff3e6', '#ffd27a'], NAMES = ['분홍 슈트', '청록 슈트', '금빛 슈트'];
    let k = 0, right = 0;
    const next = () => {
      if (k >= 6) { this._wage(1 + right, `짐 나누기 ${right}/6`); audio.sing && audio.sing(WORK_TUNES.depot, { gain: 0.25 }); return; }
      k++;
      const c = Math.floor(Math.random() * 3), glyphW = WORDS[Math.floor(Math.random() * WORDS.length)];
      sorter(g, { k, n: 6, col: COLS[c], glyph: glyphSVG(glyphW.id, 40), cols: COLS, names: NAMES, limit: 6000,
        pick: (i, late) => { const ok = i === c && !late; if (ok) right++; g.ui.toast(ok ? '맞는 슈트!' : late ? '늦었어요 — 벨트 끝으로 떨어졌다' : '다른 슈트였어요', { kind: ok ? 'item' : 'muted' }); setTimeout(next, 250); } });
    };
    next();
  }
  /**
   * 발전소: 출력 바늘을 띠 안에 붙잡아 두기 (12초). 핵의 출력이 물결치며 바늘을 민다 — 거꾸로 밀어 붙잡는다.
   * o: { kicker, title, pay, onWin } — 코일 탑 조율도 같은 놀이를 쓴다
   */
  powerWork(o = {}) {
    if (this.game.tips && this.game.tips.first('plant', () => this.powerWork(o))) return;
    reactor(this.game, { kicker: o.kicker, title: o.title, secs: 12, need: 7, onEnd: (inBand) => {
      if (o.pay === 0) { if (inBand >= 7) { this._learn('core'); if (o.onWin) o.onWin(); } else this.game.ui.toast(`띠 안에 ${inBand.toFixed(1)}초 — 7초를 넘겨야 해요`, { kind: 'muted' }); return; }
      if (inBand >= 7) { this._wage(o.pay || 4, `${o.title || '출력 맞추기'} 성공`); this._learn('core'); audio.sing && audio.sing(WORK_TUNES.plant, { gain: 0.25 }); if (o.onWin) o.onWin(); else this._say('work', 'thanks'); }
      else this._wage(1, `${o.title || '출력 맞추기'} · 띠 안에 ${inBand.toFixed(1)}초 (7초를 넘기면 ${won(o.pay || 4)})`);
    } });
  }
  /** 박자 맞추기 (공방): 표시가 오가는 막대, 가운데 칸에서 누르기 */
  _timing(title, desc, rounds, onDone) {
    const kind = /계산|세기/.test(title) ? 'scan' : /설거지|그릇/.test(title) ? 'dish' : /보존|유물/.test(title) ? 'chisel' : /도장|서류|결재/.test(title) ? 'stamp' : 'belt';
    workStrip(this.game, { title, desc, rounds, kind, onDone });
  }
  // ── 표·여행 ─────────────────────────────
  tickets() {
    if (this.game.tips && this.game.tips.first('terminal', () => this.tickets())) return;
    const g = this.game, here = (this.cur && this.cur.r) || (g.interiors.cur && g.interiors.cur.r);
    const by = new Map();
    for (const r of g.city.recs) {
      if (r.use !== 'terminal' || !here || r.zone === here.zone) continue;
      const d = Math.hypot(r.x - here.x, r.z - here.z);
      const cur = by.get(r.zone);
      if (!cur || d < cur.d) by.set(r.zone, { r, d });
    }
    const ZN = ZONE_NAMES, cash = this.inv.starseed || 0, tm = g.world.clock.time % 1;
    const hm = (t) => { const m = Math.floor(((t % 1) + 1) % 1 * 1440); return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
    const rows = [...by.values()].sort((a, b) => a.d - b.d).slice(0, 7).map(({ r, d }, k) => {
      const price = Math.max(1, Math.round(d / 2500) + 1), name = ZN[r.zone] || r.zone, poor = cash < price, at = hm(tm + 0.003 + k * 0.005);
      return { cells: [at, name, `${k + 1}번`, won(price)], status: poor ? '돈 모자람' : k === 0 ? '타는 중' : '곧 떠남', off: poor, why: `${won(price)}이 필요해요`, fare: won(price),
        stub: [`${at} 떠남 · ${k + 1}번 타는 곳`, name, `${(d / 1000).toFixed(1)} km · 하늘배·빛길 환승`, won(price)],
        on: () => { if (!this._pay(price)) return; this._learn('go'); this.travelTo(r, name); } };
    });
    openFlap(g, { title: '떠나는 편', sub: '교통 터미널 · 하늘배·빛길 환승', cols: ['시각', '행선지', '타는 곳', '값', '상태'], rows, foot: `가진 돈 ${won(cash)} · 표를 집으면 바로 타요`, empty: '지금은 다른 구역으로 가는 편이 없어요' });
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
    if (this.game.tips && this.game.tips.first('concert', () => this.concert())) return;
    const g = this.game;
    if (!this._showtime()) { openPlaque(g, { mat: 'wood', kicker: '공연장 게시판', title: '합창 시간표', text: '합창은 한낮이 지나면 시작해 밤까지 이어져요. 그때 객석에 앉으면 함께 부를 수도 있어요.' }); return; }
    const pool = [...g.state.tones].sort((a, b) => a - b);
    const sing = (l) => audio.sing && audio.sing(l, { gain: 0.32, step: 0.45 });
    if (pool.length < 2) { const l = [0, 2, 4, 2, 0]; sing(l); scoreStand(g, { phrase: null, listen: l, pool, replay: () => sing(l), done: () => {} }); return; }
    const phrase = Array.from({ length: 4 }, () => pool[Math.floor(Math.random() * pool.length)]);
    sing(phrase);
    this._say('sing', 'friend');
    scoreStand(g, { phrase, pool, replay: () => sing(phrase), done: (ok) => {
      if (ok) { this.buff('calm'); this._learn('chorus'); g.ui.toast('합창에 섞였다! · 맑은 울림', { kind: 'item' }); }
      else g.ui.toast('조금 달랐어요. 다음 노래 때 또 해 봐요', { kind: 'muted' });
    } });
  }
  sleep() {
    if (this.game.tips && this.game.tips.first('home', () => this.sleep())) return;
    const g = this.game, t = g.world.clock.time % 1;
    if (t > 0.3 && t < 0.72) { g.ui.toast('아직 낮이에요. 저녁에 다시 와요', { kind: 'muted' }); return; }
    this.buff('full');
    g.rest(0.27);
  }
  // ── 가방에서 쓰기 ───────────────────────────
  useItem(id) {
    const I = itemInfo(id), g = this.game;
    if (!I || (this.inv[id] || 0) <= 0) return;
    if (I.use === 'eat') return this.eat(id);
    if (I.use === 'heal') { // 붕대 같은 응급 회복
      if (this.game.health && this.game.health.hp >= this.game.health.H.max) { this.game.ui.toast('지금은 다친 데가 없어요', { kind: 'muted' }); return; }
      this.inv[id]--;
      this.game.health && this.game.health.heal(BAL.HEAL[id] ?? 20, `${josa(I.name, '을')} 감았다`);
      return;
    }
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
