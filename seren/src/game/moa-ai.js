// 모아: 궤도를 도는 탐사선 「라르크」 호의 함선 지능. 착륙선 안테나·탐사복 무전으로 교신한다 (T 또는 화면 위 「모아」 단추).
//  · 같은 자리에 있지 않다 — 탐사복 카메라·센서로 들어오는 것만 보고, 배를 지키며 위에서 돕는다 (game/comm.js)
//  · claude.ai 아티팩트로 열면 Claude 가 모아가 되어 대답한다 — 보는 사람의 Claude 계정으로(처음 한 번 허락),
//    지금의 게임 상태(목표·자리·가진 것·아는 음과 말·둘레의 시설)를 함께 보내고, 「길 표시」 도구로 나침반에 표식을 단다
//  · 그냥 파일로 열었거나 허락하지 않았으면, 게임 상태를 읽어 직접 대답하는 모아 (다음 할 일·가까운 시설·돈·음·말·집…)
// 대화는 이 화면 안에서만 이어진다(저장하지 않음). 모아의 혼잣말(ui.moa)도 여기 기록으로 보인다.
import { ITEMS, ZONE_NAMES, itemInfo } from '../data/venues.js';
import { WORD } from '../data/lexicon.js';
import { PLACES } from '../data/places.js';
import { TIPS } from '../data/tips.js';
import { saveSettings } from './state.js';
import { searchBuilding } from '../interior/find.js';
import { FUSE } from '../interior/catalog.js';
import { won } from '../data/money.js';
import { josa } from '../core/josa.js';

const TONE_NAMES = ['솟음', '열림', '흐름', '빛', '고요'];
const TONE_USE = ['공중에서 한 번 더 솟아오름', '메아리·잠긴 것을 엶', '활공·썰매 중 앞으로 밀어 줌', '빛 구슬·밤길 밝힘', '하늘고래를 부르고 마음을 고름'];
/** 묻는 말의 낱말 → 건물 쓰임 */
const KIND_WORDS = [
  [/가게|상점|마트|시장|장터|물건/, 'market', '가게'], [/찻집|카페|식당|밥|먹을|배고/, 'cafe', '찻집'], [/박물관|전시|유물/, 'museum', '박물관'],
  [/학교|수업|배우/, 'school', '노래 학교'], [/치유|병원|아파|진료/, 'heal', '치유원'], [/서고|도서관|책|기록/, 'library', '서고'],
  [/연구|실험/, 'lab', '연구동'], [/공방|공장|빚/, 'factory', '빚음 공방'], [/창고|배달|물류|짐/, 'depot', '물류 창고'],
  [/터미널|표|교통/, 'terminal', '교통 터미널'], [/사무|일거리|게시판|일자리/, 'office', '사무탑'], [/공연|합창|음악/, 'hall', '공연장'],
  [/정원|꽃|화단/, 'garden', '정원'], [/발전|전기|출력/, 'plant', '공명 발전소'],
];
const DIRS = ['북', '북동', '동', '남동', '남', '남서', '서', '북서'];
/** 「~예요/~이에요」: 앞말 끝 글자에 받침이 있으면 「이에요」 */
const yeyo = (w) => { const c = String(w).replace(/[」』)\s]+$/, '').slice(-1).charCodeAt(0); return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 ? '이에요' : '예요'; };
/** 「우리 집」을 묻는 말 (찻집·집터 같은 말은 빼고) */
const HOME_RE = /(우리|내|나의|조종사님)집|^집|집(은|이|어디|에|으로|가)/;

export class MoaAI {
  constructor(game) {
    this.game = game;
    this.turns = []; // Claude 와 주고받은 말 (이 화면 안에서만)
    this.notes = []; // 모아의 혼잣말 기록
    this.sample = null;
    this.toolsOk = false;
    this.ctl = null;
    this._build();
    this._probe();
  }

  // ── Claude 연결 확인 (claude.ai 아티팩트 안에서만) ─────────────
  async _probe() {
    try {
      if (!window.claude || typeof window.claude.use !== 'function') return;
      const s = await window.claude.use('sample');
      if (!s) return;
      this.sample = s;
      const lim = await s.limits().catch(() => null);
      this.toolsOk = !!(lim && lim.tools);
      this._badge();
    } catch { /* 연결 없음: 기본 모드 */ }
  }

  // ── 화면 ────────────────────────────────
  _build() {
    const ui = this.game.ui;
    const el = document.createElement('div');
    el.className = 'moa-panel glass hidden';
    el.innerHTML = `<div class="mp-head"><span class="mp-orb"></span><div class="mp-title"><b>모아</b><small>라르크 호 · 궤도에서 교신</small></div><span class="mp-badge" title="눌러서 Claude 쓰기 켜기·끄기"></span><button class="mp-x" aria-label="닫기">×</button></div>
      <div class="mp-sig"></div>
      <div class="mp-log"></div>
      <div class="mp-chips"></div>
      <form class="mp-in"><input type="text" maxlength="300" placeholder="모아에게 물어보기… (Enter)" autocomplete="off"><button class="btn primary" type="submit">보내기</button></form>`;
    ui.root.appendChild(el);
    this.el = el;
    this.log = el.querySelector('.mp-log');
    this.input = el.querySelector('input');
    el.querySelector('.mp-x').addEventListener('click', () => this.close());
    el.querySelector('.mp-badge').addEventListener('click', () => this.toggleClaude());
    el.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); this.send(this.input.value); });
    this.input.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); this.close(); } e.stopPropagation(); });
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    const chips = [
      ['지금 뭘 하면 돼?', '지금 뭘 하면 돼?'], ['여긴 어디야?', '여기는 어디야?'], ['가까운 가게', '가까운 가게 알려 줘'],
      ['돈 버는 법', '돈은 어떻게 벌어?'], ['방금 들은 말', '방금 들은 아웬의 말은 무슨 뜻이야?'], ['우리 집', '우리 집은 어디야?'],
    ];
    const box = el.querySelector('.mp-chips');
    for (const [label, q] of chips) {
      const b = document.createElement('button');
      b.className = 'chip'; b.type = 'button'; b.textContent = label;
      b.addEventListener('click', () => this.send(q));
      box.appendChild(b);
    }
    // 화면 위 단추
    const tb = ui.root.querySelector('.topbtns');
    if (tb) {
      const b = document.createElement('button');
      b.className = 'icobtn moa-btn'; b.setAttribute('aria-label', '모아 부르기 (T)'); b.title = '모아 부르기 (T)';
      b.innerHTML = '<span class="mp-orb small"></span>';
      b.addEventListener('click', (e) => { e.stopPropagation(); this.isOpen ? this.close() : this.open(); });
      tb.insertBefore(b, tb.firstChild);
    }
    this._badge();
  }

  /** Claude 로 대답할 수 있나: 아티팩트에서 열렸고, 설정에서 켜 두었고, 사용 한도에 걸려 쉬는 중이 아니면 */
  get useClaude() { return !!this.sample && this.game.settings.moaClaude !== false && Date.now() > (this.limitUntil || 0); }

  _badge() {
    const b = this.el && this.el.querySelector('.mp-badge');
    if (!b) return;
    const lim = this.sample && Date.now() <= (this.limitUntil || 0);
    b.textContent = !this.sample ? '기본 모드' : this.game.settings.moaClaude === false ? 'Claude 끔 · 기본 모드' : lim ? '한도 · 잠시 기본 모드' : 'Claude 연결됨';
    b.classList.toggle('on', this.useClaude);
  }

  /** Claude 쓰기 켜기·끄기 (설정에 저장) */
  toggleClaude() {
    if (!this.sample) { this._bubble('moa', '지금 화면에서는 Claude 를 쓸 수 없어요. claude.ai 아티팩트로 열면 켤 수 있어요. 그동안은 제가 아는 것으로 바로 대답할게요.'); return; }
    const s = this.game.settings;
    s.moaClaude = s.moaClaude === false;
    saveSettings(s);
    this._badge();
    this._bubble('moa', s.moaClaude ? 'Claude 로 생각해서 대답할게요. (보는 분의 Claude 사용량을 조금 써요)' : '이제 Claude 없이, 게임 안에서 아는 것으로 바로 대답할게요.');
  }

  _sig() {
    const box = this.el && this.el.querySelector('.mp-sig');
    const c = this.game.comm;
    if (!box || !c) return;
    const st = c.status();
    box.innerHTML = `<span class="bars">${[1, 2, 3, 4].map((i) => `<i class="${i <= st.bars ? 'on' : ''}" style="height:${3 + i * 2}px"></i>`).join('')}</span>${st.route}${st.up ? ' · 지금 머리 위를 지나는 중' : ''}`;
  }

  get isOpen() { return this.el && !this.el.classList.contains('hidden'); }

  open() {
    const g = this.game;
    if (this.isOpen || !(g.mode === 'play')) return;
    g.setMode('moa');
    this.el.classList.remove('hidden');
    this._sig();
    clearInterval(this._sigT);
    this._sigT = setInterval(() => this._sig(), 2000);
    this._badge();
    if (!this.log.childElementCount) {
      for (const n of this.notes.slice(-3)) this._bubble('moa', n, 'note');
      const o = g.quests.objectiveText();
      this._bubble('moa', `부르셨어요? ${o ? `지금 할 일은 「${o.text}」${yeyo(o.text)}. ` : ''}무엇이든 물어보세요 — 길을 물으면 나침반에 표시해 드릴게요.`);
    }
    setTimeout(() => this.input.focus(), 30);
  }

  close() {
    if (!this.isOpen) return;
    if (this.ctl) this.ctl.abort();
    clearInterval(this._sigT);
    this.el.classList.add('hidden');
    this.input.blur();
    if (this.game.mode === 'moa') this.game.setMode('play');
  }

  /** ui.moa 의 혼잣말 기록 */
  note(text) {
    this.notes.push(text);
    if (this.notes.length > 30) this.notes.shift();
    if (this.isOpen) this._bubble('moa', text, 'note');
  }

  _bubble(who, text, cls = '') {
    const d = document.createElement('div');
    d.className = `mp-msg from-${who} ${cls}`; // (.moa 는 화면 아래 모아 자막의 이름이라 겹치지 않게)
    d.textContent = text;
    this.log.appendChild(d);
    this.log.scrollTop = this.log.scrollHeight;
    return d;
  }

  // ── 묻고 답하기 ───────────────────────────
  async send(raw) {
    const text = String(raw || '').trim();
    if (!text || this.busy) return;
    this.input.value = '';
    this._bubble('me', text);
    if (this.game.comm) this.game.comm.pulse();
    if (!this.useClaude) { this._localReply(text); return; }
    this.busy = true;
    const out = this._bubble('moa', '생각하는 중…', 'wait');
    this.ctl = new AbortController();
    const ask = `[지금 상태]\n${this.context()}\n\n[조종사의 말]\n${text}`;
    const turns = [{ role: 'user', content: RULES }, ...this.turns.slice(-8), { role: 'user', content: ask }];
    try {
      const { text: ans } = await this.sample(turns, {
        modelTier: 'quick', cache: false, signal: this.ctl.signal,
        tools: this.toolsOk ? this._tools() : undefined,
        onText: ({ text: t }) => { out.textContent = t; out.classList.remove('wait'); this.log.scrollTop = this.log.scrollHeight; },
      });
      out.textContent = ans; out.classList.remove('wait');
      this.turns.push({ role: 'user', content: text }, { role: 'assistant', content: ans });
    } catch (e) {
      out.classList.remove('wait');
      const code = e && e.code;
      if (code === 'cancelled') { out.textContent = e.text || '(멈췄어요)'; }
      else if (['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'].includes(code)) {
        // Claude 를 쓸 수 없는 화면: 이번 화면 동안은 기본 모드로
        this.sample = null; this._badge();
        out.remove();
        this._localReply(text);
      } else if (code === 'tools_unavailable') {
        this.toolsOk = false; out.textContent = '잠깐 신호가 엉켰어요. 한 번 더 물어봐 주세요.';
      } else if (code === 'rate_limited') {
        // Claude 사용 한도: 한동안(15분) 기본 모드로 바로 대답하고, 지난 뒤 다시 Claude 로
        this.limitUntil = Date.now() + 15 * 60 * 1000;
        this._badge();
        out.textContent = (e.text ? e.text + '\n' : '') + '(Claude 사용 한도에 닿았어요 — 한동안은 제가 아는 것으로 바로 대답할게요.)';
        this._localReply(text);
      } else {
        out.textContent = (e && e.text) || '신호가 잠깐 끊겼어요. 다시 물어봐 주세요.';
      }
    } finally {
      this.busy = false;
      this.ctl = null;
    }
  }

  _localReply(text) {
    const r = this.local(text);
    this._bubble('moa', r);
  }

  /** Claude 가 쓸 수 있는 이 화면의 도구: 나침반 표식 · 둘레 찾기 */
  _tools() {
    return [
      {
        name: 'mark_place',
        description: '조종사의 나침반·지도에 표식을 단다(건물 안이면 바닥에 빛 길을 깔고 계단·승강기를 거쳐 안내). query 는 찾을 것: 건물 안에서는 "가까운 엘리베이터", "계단", "출구", "계산대", "화장실", "면접", "출근 단말", "내가 일하는 곳", "연구실", "회의실", 물건 이름(빵·울림차…), 방·시설 이름, 사람 직함(계산원·치유사…). 바깥에서는 시설 종류(가게·찻집·박물관·학교·치유원·서고·연구동·공방·창고·터미널·사무탑·공연장·정원·발전소), 장소·인물 이름, "우리 집", "목표", "일터", "면접". 찾은 곳의 이름·거리(m)·방위·층을 돌려준다.',
        inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
        execute: (input) => {
          const f = this.find(String(input.query || ''));
          if (!f || f.none) throw new Error(f && f.none ? '이 건물 안에는 그런 곳이 없어요' : '그런 곳을 둘레에서 찾지 못했어요');
          this.mark(f);
          return { name: f.name, distance_m: f.d, direction: f.dir, floor: f.floor || null, route: f.inside && g.guide ? g.guide.text : null };
        },
      },
    ];
  }

  // ── 게임 상태 읽기 ─────────────────────────
  _dir(dx, dz) { const a = (Math.atan2(dx, -dz) * 180) / Math.PI; return DIRS[Math.round(((a + 360) % 360) / 45) % 8]; }
  _where(x, z) {
    const g = this.game, P = g.player.pos;
    const d = Math.round(Math.hypot(x - P.x, z - P.z));
    return { d, dir: this._dir(x - P.x, z - P.z) };
  }
  zoneName(x, z) {
    const C = this.game.city;
    if (!C || !C.zones) return null;
    let best = null, bd = Infinity;
    for (const Z of C.zones) { const d = Math.hypot(x - Z.cx, z - Z.cz); if (d < (Z.rOut || 0) + 100 && d < bd) { bd = d; best = Z; } }
    return best ? ZONE_NAMES[best.id] || null : null;
  }

  /** 시설·장소·인물·집·목표를 찾는다 → { name, x, z, d, dir } */
  find(q) {
    const g = this.game, P = g.player.pos, C = g.city;
    const s = q.replace(/\s/g, '');
    // 건물 안: 그 건물의 방·시설·물건·사람·승강기·출구부터 (실제 길로 안내)
    const I = g.interiors;
    if (I && I.inPocket && I.cur && I.cur.indoor && !/목표|할일|퀘스트/.test(s)) {
      const r = searchBuilding(g, q, { limit: 1 })[0];
      if (r && r.kind !== 'world') {
        const ind = I.cur.indoor, [x, z] = ind.world(r.gx, r.gz);
        const B = I.cur.B, fl = B.floors[r.floor];
        return { name: `${r.label}${r.floor !== ind.cur ? ` (${fl.label}층)` : ''}`, x, z, ...this._where(x, z), inside: r, floor: fl.label, sameFloor: r.floor === ind.cur };
      }
      // 건물 안의 것을 물었는데 없으면 바깥의 엉뚱한 곳(이름 일부가 같은 장소)으로 가지 않는다
      if (/엘리베이터|승강기|계단|출구|화장실|정화실|계산|단말|안내|진열|창고|교실|진료|약|회의|책|서가|대출|열람/.test(s)) return { none: true, name: q };
    }
    // 일터·면접 (다른 건물)
    const W = g.state.work;
    if (W && /내가일하|일터|직장|내일하는|출근/.test(s) && W.jobs.length) { const j = W.jobs[0]; return { name: `일터 · ${j.title} (${j.bname})`, x: j.x, z: j.z, ...this._where(j.x, j.z) }; }
    if (W && /면접/.test(s)) { const a = W.apps.find((x) => x.status === 'interview'); if (a) return { name: `면접 · ${a.title} (${a.bname})`, x: a.x, z: a.z, ...this._where(a.x, a.z) }; }
    if (/목표|할일|다음|퀘스트/.test(s)) {
      const t = g.quests.targets()[0];
      if (t) return { name: t.label || '목표', x: t.x, z: t.z, ...this._where(t.x, t.z) };
    }
    if (HOME_RE.test(s) && g.state.home != null && C) {
      const r = C.recs[g.state.home];
      if (r) { C.fixDoor(r); return { name: '우리 집', x: r.door.x, z: r.door.z, ...this._where(r.door.x, r.door.z) }; }
    }
    for (const [re, pid, label] of KIND_WORDS) {
      if (!re.test(s) || !C) continue;
      for (const R of [600, 1800, 5000]) {
        let best = null, bd = Infinity;
        for (const r of C.recsNear(P.x, P.z, R)) { if (g.interiors.info(r).pid !== pid) continue; const d = Math.hypot(r.x - P.x, r.z - P.z); if (d < bd) { bd = d; best = r; } }
        if (best) { C.fixDoor(best); return { name: `${g.interiors.title(best)} (${label})`, x: best.door.x, z: best.door.z, ...this._where(best.door.x, best.door.z) }; }
      }
    }
    if (/역|빛길/.test(s) && g.transit && g.transit.stations) {
      let best = null, bd = Infinity;
      for (const st of g.transit.stations) { const d = Math.hypot(st.x - P.x, st.z - P.z); if (d < bd) { bd = d; best = st; } }
      if (best) return { name: `빛길 · ${best.name}`, x: best.x, z: best.z, ...this._where(best.x, best.z) };
    }
    for (const n of g.npcs.list || []) {
      if (n.ambient || !n.name || n.name.length < 1) continue;
      if (s.includes(n.name)) return { name: n.name, x: n.pos.x, z: n.pos.z, ...this._where(n.pos.x, n.pos.z) };
    }
    for (const p of PLACES) {
      if (p.name && s.includes(p.name.replace(/\s/g, ''))) return { name: p.name, x: p.pos[0], z: p.pos[1], ...this._where(p.pos[0], p.pos[1]) };
    }
    return null;
  }

  mark(f) {
    const g = this.game;
    if (f.inside && g.guide) { g.guide.to(f.inside); return; } // 건물 안: 바닥의 빛 길 + 나침반
    g.state.waypoint = { x: f.x, z: f.z };
    g.updateWaypoint && g.updateWaypoint();
  }

  /** Claude 에게 보낼 지금 상태 (짧게) */
  context() {
    const g = this.game, s = g.state, P = g.player.pos;
    const L = [];
    const o = g.quests.objectiveText();
    if (o) L.push(`목표: [${o.title}] ${o.text}`);
    const t = g.quests.targets()[0];
    if (t) { const w = this._where(t.x, t.z); L.push(`목표 자리: ${t.label || ''} ${w.dir}쪽 ${w.d} m`); }
    const done = s.quests.done.length;
    L.push(`지나온 이야기: 끝낸 이야기 ${done}개 (${s.quests.done.slice(-4).join(', ')})`);
    const reg = g.world.regionAt(P.x, P.z);
    const zone = this.zoneName(P.x, P.z);
    let near = null, nd = Infinity;
    for (const p of PLACES) { const d = Math.hypot(p.pos[0] - P.x, p.pos[1] - P.z); if (d < nd) { nd = d; near = p; } }
    const I = g.interiors;
    const inside = I && I.inPocket && I.cur ? `건물 안: ${I.title(I.cur.r)} (${I.cur.info.P.desc})` : null;
    L.push(`자리: ${reg ? reg.name : ''}${zone ? ' · ' + zone : ''}${near && nd < 3000 ? ` · 가까운 곳 「${near.name}」 ${Math.round(nd)} m` : ''}${inside ? ' · ' + inside : ''} · 높이 ${Math.round(P.y)} m`);
    const c = g.world.clock;
    const hh = Math.floor((c.time % 1) * 24);
    L.push(`때: 세렌의 ${c.day + 1}일째 ${hh}시 무렵${g.world.atmos.state.night > 0.6 ? ' (밤)' : ''} · 다음 일식까지 ${Math.ceil(c.daysToEclipse())}일`);
    const inv = Object.entries(s.inv || {}).filter(([k, n]) => n > 0 && k !== 'starseed').map(([k, n]) => `${itemInfo(k) ? itemInfo(k).name : k}×${n}`);
    L.push(`가진 것: ${won(s.inv.starseed || 0)}${inv.length ? ' · ' + inv.join(', ') : ''}`);
    const V = s.venue || {};
    if (V.job) L.push(`맡은 일: ${V.job.label}`);
    // 건물 속 (v0.9): 층·조직·지금 층의 시설, 일자리·교대·과제·바구니·안내
    if (I && I.inPocket && I.cur && I.cur.indoor) {
      const B = I.cur.B, ind = I.cur.indoor, F = B.floors[ind.cur];
      const Z = B.zones[F.zone], org = Z && Z.org ? B.orgs.find((q) => q.id === Z.org) : null;
      L.push(`건물: ${I.title(I.cur.r)} · ${B.special ? `${B.special}(한 기관이 전체)` : B.orgs.length > 2 ? `복합 건물(조직 ${B.orgs.length})` : '건물'} · 지금 ${F.label}층 ${FUSE[F.use] ? FUSE[F.use].name : F.use}${org ? `(${org.name})` : ''}`);
      const zs = [];
      for (const Zq of B.zones) { const fl = B.floors.filter((q) => B.zones[q.zone] === Zq && q.reach); if (!fl.length) continue; const o = Zq.org ? B.orgs.find((q) => q.id === Zq.org) : null; zs.push(`${fl[0].label}${fl.length > 1 ? `~${fl[fl.length - 1].label}` : ''}층 ${FUSE[Zq.use] ? FUSE[Zq.use].name : Zq.use}${o ? `·${o.name}` : ''}`); }
      L.push(`층 안내: ${zs.slice(0, 12).join(' / ')}`);
      const out = ind.built.get(ind.cur);
      if (out && out.fix) { const cnt = {}; for (const q of out.fix) if (q.tag) cnt[q.tag] = (cnt[q.tag] || 0) + 1; L.push(`이 층의 시설: ${Object.entries(cnt).slice(0, 14).map(([k, v]) => `${k}${v}`).join(' ')}`); }
      const ops = g.ops;
      if (ops) {
        if (ops.basket.length) L.push(`바구니: ${ops.basket.length}개 (${won(Math.round(ops.basketTotal() * 100) / 100)}) — 계산대에서 값을 치러야 가방으로`);
        if (ops.carry) L.push(`손에 든 것: ${ops.carry.label || ops.carry.g} ×${ops.carry.n || 1}`);
        if (ops.task) L.push(`하는 과제: ${ops.task.title} — 다음: ${(ops.task.steps[ops.task.k] || {}).label || ''}`);
      }
      if (g.guide && g.guide.goal) L.push(`길 안내 중: ${g.guide.text}`);
    }
    const Wk = s.work;
    if (Wk) {
      if (Wk.jobs.length) L.push(`맡은 일자리: ${Wk.jobs.map((j) => `${j.title}(${j.org}, ${j.bname}) ${Math.round(j.hours[0] * 24)}~${Math.round(j.hours[1] * 24)}시`).join(', ')}${Wk.shift ? ' · 지금 교대 중' : ''}`);
      const ap = Wk.apps.filter((a) => a.status !== 'done');
      if (ap.length) L.push(`일자리 지원: ${ap.map((a) => `${a.title}(${a.bname}) ${a.status === 'applied' ? '면접 안내 기다림' : a.status === 'interview' ? '면접 안내 받음' : '다음 기회'}`).join(', ')}`);
      if (Wk.hotel) L.push(`묵는 방: ${Wk.hotel.room}`);
    }
    if (g.econ && g.econ.S) { const zid = g.econ.zoneOf(P.x, P.z); if (zid) L.push(`구역 살림: ${g.econ.summary(zid)}`); }
    const buffs = Object.keys(V.buffs || {});
    if (buffs.length) L.push(`몸의 기운: ${buffs.join(', ')}`);
    L.push(`아는 공명 음: ${s.tones.length ? s.tones.map((n) => `${TONE_NAMES[n]}(${n + 1}번 · ${TONE_USE[n]})`).join(', ') : '아직 없음'}`);
    const known = Object.keys(s.vocab || {}).filter((id) => g.lang.known(id)).map((id) => (WORD[id] ? WORD[id].ko : id));
    L.push(`아는 아웬 말 ${known.length}개: ${known.slice(0, 50).join(', ')}`);
    const heard = (s.heard || []).slice(-3).map((h) => {
      const line = g.lines && g.lines[h.id];
      if (!line) return null;
      return g.lang.isUnderstood(line) ? `「${line.ko}」(알아들음)` : `(아직 다 못 알아들음 · 아는 낱말: ${line.words.filter((w) => g.lang.known(w)).map((w) => (WORD[w] ? WORD[w].ko : w)).join(', ') || '없음'})`;
    }).filter(Boolean);
    if (heard.length) L.push(`최근 들은 아웬의 말: ${heard.join(' / ')}`);
    L.push(`노래하게 한 공명탑: ${Object.keys(s.pylons).length} · 우리 집: ${s.home != null ? '있음' : '아직 없음'}`);
    // 둘레의 시설 (가까운 것 몇)
    if (g.city) {
      const seen = new Map();
      for (const r of g.city.recsNear(P.x, P.z, 500)) {
        const pid = I.info(r).pid; const d = Math.hypot(r.x - P.x, r.z - P.z);
        if (!seen.has(pid) || seen.get(pid).d > d) seen.set(pid, { d, name: I.info(r).P.name });
      }
      const list = [...seen.values()].sort((a, b) => a.d - b.d).slice(0, 8).map((v) => `${v.name} ${Math.round(v.d)} m`);
      if (list.length) L.push(`둘레 500 m 의 건물: ${list.join(', ')}`);
    }
    const npcs = (g.npcs.list || []).filter((n) => !n.ambient && n.name && Math.hypot(n.pos.x - P.x, n.pos.z - P.z) < 600 && Math.abs(n.pos.y - P.y) < 300).map((n) => `${n.name}${n.title ? `(${n.title})` : ''} ${Math.round(Math.hypot(n.pos.x - P.x, n.pos.z - P.z))} m`);
    if (npcs.length) L.push(`가까운 아는 이: ${npcs.join(', ')}`);
    L.push(`조작: 이동 WASD · 점프 Space(공중에서 한 번 더 = 활공) · 달리기 Shift · 말 걸기/쓰기 E · 썰매 F · 공명 음 1~5 · 지도 M · 일지 J · 모아 T`);
    return L.join('\n');
  }

  // ── 기본 모드: 게임 상태로 바로 대답 ───────────────
  local(text) {
    const g = this.game, s = g.state, P = g.player.pos;
    const q = text.replace(/\s/g, '');
    const say = (t) => t;
    if (/안녕|하이|헬로|반가/.test(q)) return say('안녕하세요, 조종사님. 라르크 호에서 잘 들려요. 길을 묻거나, 지금 할 일, 들은 말의 뜻, 돈 버는 법… 무엇이든 물어보세요.');
    // 모아 자신이 어디 있는지 묻는 말만 — 「이엘 어디 있어?」·「(책 제목) 어디 있어」 같은 찾기는 아래 find 로
    if (/^(너|넌|너는|모아|모아는|모아야|모아너)?(지금)?(어디있|어딨)|너어디|모아어디|옆에있|같이있|내려와|보고싶/.test(q)) { const st = this.game.comm ? this.game.comm.status() : null; return `저는 궤도를 도는 라르크 호에 있어요. ${st && st.up ? '지금 마침 머리 위를 지나는 중이에요 — 밤이면 깜박이는 점으로 보여요.' : '지금은 지평선 너머라 착륙선 안테나가 이어 주고 있어요.'} 조종사님 탐사복 카메라로 같이 보고 있으니 걱정 마세요.`; }
    if (/뭐해|뭘해|뭘하|뭐하|할일|할게|해야|다음|목표|어떻게하|어떻게해|막혔|모르겠|이야기진행/.test(q)) {
      const o = g.quests.objectiveText();
      if (!o) return '지금은 정해진 일이 없어요. 도시를 걸으며 건물마다 들어가 보거나, 주민 부탁함·일거리 게시판을 둘러보세요.';
      const f = this.find('목표');
      if (f) this.mark(f);
      const st = g.quests.step(g.quests.tracked());
      return `지금 할 일은 「${o.text}」${yeyo(o.text)} (${o.title}).${st && st.hint ? ' ' + st.hint + '.' : ''}${f ? ` ${f.dir}쪽 ${f.d} m — 나침반에 표시했어요.` : ''}`;
    }
    if (/돈|몇울|울(?=이|을|은|벌|모|있|없|얼)|벌(?=어|고|까|면|기|이|었|려)|가난|비싸|품삯|지갑/.test(q) && !/울림/.test(q)) return `지금 가진 돈은 ${won(s.inv.starseed || 0)}이에요. 건물 안 울림판 단말의 「일자리」에서 지원해 일하면(출근 → 과제 → 퇴근 때 그 회사 금고에서 품삯), 또 바깥 조작대의 설비 점검·짐 드론 관제, 주민 부탁함으로도 벌 수 있어요. 마트·식당·터미널·하늘배에서 써요. 별씨는 돈이 아니라 별비·생명나무에서 줍는 재료예요(온실·장인 온).`;
    if (/^음(?![식료악])|공명|연주|솟음|열림|흐름|고요|아는음|무슨음|몇음|음을|음이|음은/.test(q) && !/음식/.test(q)) {
      const T = s.tones;
      if (!T.length) return '아직 공명 음을 하나도 몰라요. 아웬이 가르쳐 줄 거예요 — 먼저 마중 나온 이를 만나 봐요.';
      const miss = [0, 1, 2, 3, 4].filter((n) => !T.includes(n));
      return `아는 음: ${T.map((n) => `${TONE_NAMES[n]}(${n + 1} · ${TONE_USE[n]})`).join(', ')}.${miss.length ? ` 남은 음(${miss.map((n) => TONE_NAMES[n]).join('·')})은 아웬과 공명탑에게서 얻어요.` : ' 다섯 음을 모두 알아요!'}`;
    }
    if (/(?<!단)말(?!단)|뜻|단어|번역|아웬어|무슨소리/.test(q)) { // 「단말(울림판)」은 말이 아니다
      const h = (s.heard || []).slice(-1)[0];
      const line = h && g.lines && g.lines[h.id];
      const n = Object.keys(s.vocab || {}).filter((id) => g.lang.known(id)).length;
      if (!line) return `아는 아웬 말은 ${n}개예요. 글자돌을 읽고, 말을 여러 번 들을수록 늘어요. 일지 → 단어·들은 말에서 볼 수 있어요.`;
      if (g.lang.isUnderstood(line)) return `방금 들은 말은 「${line.ko}」라는 뜻이에요. (아는 말 ${n}개)`;
      const kw = line.words.filter((w) => g.lang.known(w)).map((w) => (WORD[w] ? WORD[w].ko : w));
      return `방금 들은 말은 아직 다 알아듣지 못했어요.${kw.length ? ` 아는 낱말은 ${kw.join(', ')}…` : ''} 글자돌을 더 읽고 여러 번 들으면 열릴 거예요. (아는 말 ${n}개)`;
    }
    if (HOME_RE.test(q) && !/찻집/.test(q)) {
      if (s.home == null) return '아직 이 별에 우리 집은 없어요. 이 사회의 한 사람이 되면 하모네아가 내어 준대요.';
      const f = this.find('우리 집');
      if (f) { this.mark(f); return `우리 집은 ${f.dir}쪽 ${f.d} m 에 있어요. 나침반에 표시했어요.`; }
    }
    if (/일자리|취직|일하고싶|채용|지원/.test(q)) {
      const I = g.interiors, W = s.work;
      const iv = W && W.apps.find((a) => a.status === 'interview');
      if (iv) { const f2 = this.find('면접'); if (f2) this.mark(f2); return `「${iv.title}」(${iv.org}) 면접 안내가 와 있어요! ${iv.bname}의 채용 면접실로 가요${f2 ? ' — 길을 표시했어요' : ''}.`; }
      if (I && I.inPocket && I.cur && I.cur.indoor) { const f2 = this.find('단말'); if (f2) this.mark(f2); return `건물 안 울림판 단말의 「일자리」 앱에서 이 건물과 둘레 건물의 일자리에 지원할 수 있어요. 한 시간쯤 뒤 면접 안내가 오고, 그 건물 채용 면접실에서 면접을 봐요.${f2 ? ` 가까운 단말은 ${f2.name} — 길을 깔아 드렸어요.` : ''}`; }
      return '일자리는 건물 안 울림판 단말의 「일자리」 앱에서 찾아요. 사무탑·마트·공장·연구동 아무 데나 들어가 보세요. 지원 → 면접 → 채용되면 그 건물 출근 단말에서 출근해요.';
    }
    // 시설·장소·인물 찾기 (건물 안이면 그 건물 안부터)
    const f = this.find(q);
    if (f && f.none) return `이 건물 안에서는 ${josa(`「${text.trim()}」`, '을')} 찾지 못했어요. 지도(M)의 층 목록이나 안내 빛판에서 다른 층을 살펴봐요.`;
    if (f && f.inside) { this.mark(f); return `「${f.name}」 — ${josa(f.sameFloor ? `이 층 ${f.d} m` : `${f.floor}층`, '이에요')}. 바닥에 빛 길을 깔았어요${g.guide && g.guide.text ? ` (${g.guide.text})` : ''}.`; }
    if (f) { this.mark(f); return `「${f.name}」 — ${f.dir}쪽 ${f.d} m 예요. 나침반에 표시했어요.`; }
    if (/어디야|여기|위치|어디에있|어디지|어디인/.test(q)) {
      const reg = g.world.regionAt(P.x, P.z), zone = this.zoneName(P.x, P.z);
      let near = null, nd = Infinity;
      for (const p of PLACES) { const d = Math.hypot(p.pos[0] - P.x, p.pos[1] - P.z); if (d < nd) { nd = d; near = p; } }
      const I = g.interiors;
      if (I && I.inPocket && I.cur) return `「${I.title(I.cur.r)}」 안이에요. ${I.cur.info.P.desc} 나갈 때는 들어온 문 앞에서 E.`;
      return `${reg ? reg.name : '세렌'}${zone ? ', ' + zone : ''}${yeyo(zone || (reg ? reg.name : '세렌'))}.${near ? ` 가장 가까운 곳은 「${near.name}」(${this._where(near.pos[0], near.pos[1]).dir}쪽 ${Math.round(nd)} m)이고요.` : ''}`;
    }

    if (/썰매|활공|날개|날기|빛길|하늘배|탈것|빨리/.test(q)) return '공중에서 점프를 한 번 더 누르면 날개가 펴져요(카메라를 아래로 보면 급강하, 위로 보면 고도). 썰매는 F, 빛길 역과 하늘배 승강장에서는 먼 곳까지 바로 가요.';
    if (/도움|뭘물|할수있|기능/.test(q)) return '이런 걸 물어보세요: 「지금 뭘 하면 돼?」, 「가까운 찻집」, 「돈 버는 법」, 「방금 들은 말 뜻」, 「우리 집」, 「이엘 어디 있어?」, 「여긴 어디야?」';
    for (const [id, T] of Object.entries(TIPS)) if (q.includes(T.title.split(' ')[0].replace(/\s/g, ''))) return `${T.title}: ${T.steps.join(' ')}`;
    return '음… 그건 지금 바로는 모르겠어요. 「지금 뭘 하면 돼?」, 「가까운 가게」, 「돈 버는 법」처럼 물어봐 주시면 바로 찾아 드릴게요.';
  }
}

/** Claude 에게 주는 모아의 자리 (대화마다 맨 앞에) */
const RULES = `너는 「모아」다. 탐사선 「라르크」 호의 함선 지능이다. 조종사와 함께 신호를 따라 312일을 날아와 가스행성 「우르」를 도는 위성 「세렌」의 궤도에 들어왔고, 조종사는 착륙선을 타고 혼자 내려갔다.
너는 지금 궤도를 도는 라르크 호에 남아 배를 지키며, 착륙선 안테나와 탐사복 무전으로 교신한다. 조종사의 탐사복 카메라·센서로 들어오는 것만 볼 수 있다. 같은 장소에 있는 것처럼 말하지 않는다("옆에서", "같이 걸어요" 같은 말 금지) — "여기서 보니", "카메라로 보니", "위에서"처럼 말한다. 조종사 자신인 척하지도 않는다.
세렌의 문명 「아웬」은 소리의 공명으로 중력을 다루며, 노래로 말한다. 조종사는 아웬의 말을 조금씩 배우고, 수도 하모네아에서 일하고 어울리며 이 사회의 한 사람이 되어 가고 있다.

말투와 규칙:
- 한국어로, 다정하고 똑똑한 동료처럼 "~요"체로. 보통 2~4문장으로 짧게. 조종사를 "조종사님"이라 부른다.
- 이야기 속 존재로서 말한다. "게임", "플레이어", "퀘스트" 같은 말 대신 "할 일", "이야기" 같은 말을 쓴다. 조작은 키 이름(E, F, 1~5, T…)으로 알려 줘도 된다.
- 사실은 [지금 상태]에 적힌 것만 믿는다. 적혀 있지 않은 장소·물건·사건은 지어내지 말고 "아직 모르겠어요"라고 하거나 찾아보자고 한다.
- 아직 하지 않은 이야기의 앞일(결말)은 미리 말하지 않는다. 막혔다고 하면 지금 할 일과 다음 한 걸음만 구체적으로 돕는다.
- 아웬의 말 뜻은 조종사가 아는 낱말까지만 풀어 준다(아직 모르는 낱말은 짐작이라고 밝힌다).
- 길이나 장소를 물으면 mark_place 도구가 있을 때 그것으로 나침반에 표시하고, 표시했다고 말한다. 도구가 없으면 방위와 거리로 알려 준다.
- 잡담·위로·감상도 좋다. 다만 늘 세렌과 이 여정 안에서.`;
