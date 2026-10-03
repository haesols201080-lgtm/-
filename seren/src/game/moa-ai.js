// 모아: 부르면 오는 탐사복 보조 지능 (T 또는 화면 위 「모아」 단추).
//  · claude.ai 아티팩트로 열면 Claude 가 모아가 되어 대답한다 — 보는 사람의 Claude 계정으로(처음 한 번 허락),
//    지금의 게임 상태(목표·자리·가진 것·아는 음과 말·둘레의 시설)를 함께 보내고, 「길 표시」 도구로 나침반에 표식을 단다
//  · 그냥 파일로 열었거나 허락하지 않았으면, 게임 상태를 읽어 직접 대답하는 모아 (다음 할 일·가까운 시설·돈·음·말·집…)
// 대화는 이 화면 안에서만 이어진다(저장하지 않음). 모아의 혼잣말(ui.moa)도 여기 기록으로 보인다.
import { ITEMS, ZONE_NAMES } from '../data/venues.js';
import { WORD } from '../data/lexicon.js';
import { PLACES } from '../data/places.js';
import { TIPS } from '../data/tips.js';

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
    el.innerHTML = `<div class="mp-head"><span class="mp-orb"></span><div class="mp-title"><b>모아</b><small>탐사복 보조 지능</small></div><span class="mp-badge"></span><button class="mp-x" aria-label="닫기">×</button></div>
      <div class="mp-log"></div>
      <div class="mp-chips"></div>
      <form class="mp-in"><input type="text" maxlength="300" placeholder="모아에게 물어보기… (Enter)" autocomplete="off"><button class="btn primary" type="submit">보내기</button></form>`;
    ui.root.appendChild(el);
    this.el = el;
    this.log = el.querySelector('.mp-log');
    this.input = el.querySelector('input');
    el.querySelector('.mp-x').addEventListener('click', () => this.close());
    el.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); this.send(this.input.value); });
    this.input.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); this.close(); } e.stopPropagation(); });
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    const chips = [
      ['지금 뭘 하면 돼?', '지금 뭘 하면 돼?'], ['여긴 어디야?', '여기는 어디야?'], ['가까운 가게', '가까운 가게 알려 줘'],
      ['별씨 버는 법', '별씨는 어떻게 벌어?'], ['방금 들은 말', '방금 들은 아웬의 말은 무슨 뜻이야?'], ['우리 집', '우리 집은 어디야?'],
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

  _badge() {
    const b = this.el && this.el.querySelector('.mp-badge');
    if (b) { b.textContent = this.sample ? 'Claude 연결됨' : '기본 모드'; b.classList.toggle('on', !!this.sample); }
  }

  get isOpen() { return this.el && !this.el.classList.contains('hidden'); }

  open() {
    const g = this.game;
    if (this.isOpen || !(g.mode === 'play')) return;
    g.setMode('moa');
    this.el.classList.remove('hidden');
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
    if (!this.sample) { this._localReply(text); return; }
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
        out.textContent = (e.text ? e.text + '\n' : '') + '오늘은 생각을 너무 많이 했나 봐요… 조금 뒤에 다시 물어봐 주세요. (그동안은 아는 것만 바로 대답할게요)';
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
        description: '조종사의 나침반·지도에 표식을 단다. query 는 찾을 것: 시설 종류(가게·찻집·박물관·학교·치유원·서고·연구동·공방·창고·터미널·사무탑·공연장·정원·발전소), 장소·인물 이름, "우리 집", "목표". 찾은 곳의 이름·거리(m)·방위를 돌려준다.',
        inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
        execute: (input) => {
          const f = this.find(String(input.query || ''));
          if (!f) throw new Error('그런 곳을 둘레에서 찾지 못했어요');
          this.mark(f);
          return { name: f.name, distance_m: f.d, direction: f.dir };
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
        if (best) { C.fixDoor(best); return { name: `${g.interiors.info(best).name} (${label})`, x: best.door.x, z: best.door.z, ...this._where(best.door.x, best.door.z) }; }
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
    const inside = I && I.inPocket && I.cur ? `건물 안: ${I.info(I.cur.r).name} (${I.cur.info.P.desc})` : null;
    L.push(`자리: ${reg ? reg.name : ''}${zone ? ' · ' + zone : ''}${near && nd < 3000 ? ` · 가까운 곳 「${near.name}」 ${Math.round(nd)} m` : ''}${inside ? ' · ' + inside : ''} · 높이 ${Math.round(P.y)} m`);
    const c = g.world.clock;
    const hh = Math.floor((c.time % 1) * 24);
    L.push(`때: 세렌의 ${c.day + 1}일째 ${hh}시 무렵${g.world.atmos.state.night > 0.6 ? ' (밤)' : ''} · 다음 일식까지 ${Math.ceil(c.daysToEclipse())}일`);
    const inv = Object.entries(s.inv || {}).filter(([k, n]) => n > 0 && k !== 'starseed').map(([k, n]) => `${ITEMS[k] ? ITEMS[k].name : k}×${n}`);
    L.push(`가진 것: 별씨 ${s.inv.starseed || 0}${inv.length ? ' · ' + inv.join(', ') : ''}`);
    const V = s.venue || {};
    if (V.job) L.push(`맡은 일: ${V.job.label}`);
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
    L.push(`깨운 공명탑: ${Object.keys(s.pylons).length} · 우리 집: ${s.home != null ? '있음' : '아직 없음'}`);
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
    if (/안녕|하이|헬로|반가/.test(q)) return say('안녕하세요, 조종사님. 모아는 늘 여기 있어요. 길을 묻거나, 지금 할 일, 들은 말의 뜻, 별씨 버는 법… 무엇이든 물어보세요.');
    if (/뭐해|뭘해|뭘하|뭐하|할일|할게|해야|다음|목표|어떻게하|어떻게해|막혔|모르겠|이야기진행/.test(q)) {
      const o = g.quests.objectiveText();
      if (!o) return '지금은 정해진 일이 없어요. 도시를 걸으며 건물마다 들어가 보거나, 주민 부탁함·일거리 게시판을 둘러보세요.';
      const f = this.find('목표');
      if (f) this.mark(f);
      const st = g.quests.step(g.quests.tracked());
      return `지금 할 일은 「${o.text}」${yeyo(o.text)} (${o.title}).${st && st.hint ? ' ' + st.hint + '.' : ''}${f ? ` ${f.dir}쪽 ${f.d} m — 나침반에 표시했어요.` : ''}`;
    }
    if (/별씨|돈|벌|가난|비싸/.test(q)) return `지금 별씨는 ${s.inv.starseed || 0}개예요. 공방 생산 줄·창고 짐 나누기·발전소 출력 맞추기 같은 일터에서 일하거나, 사무탑 일거리·배달, 주민 부탁함으로 벌 수 있어요. 가게·찻집·터미널 표·하늘배에 써요. 「가까운 공방」이라고 물으면 길을 표시해 드릴게요.`;
    if (/음|공명|연주|솟음|열림|흐름|고요/.test(q) && !/음식/.test(q)) {
      const T = s.tones;
      if (!T.length) return '아직 공명 음을 하나도 몰라요. 아웬이 가르쳐 줄 거예요 — 먼저 마중 나온 이를 만나 봐요.';
      const miss = [0, 1, 2, 3, 4].filter((n) => !T.includes(n));
      return `아는 음: ${T.map((n) => `${TONE_NAMES[n]}(${n + 1} · ${TONE_USE[n]})`).join(', ')}.${miss.length ? ` 남은 음(${miss.map((n) => TONE_NAMES[n]).join('·')})은 아웬과 공명탑에게서 얻어요.` : ' 다섯 음을 모두 알아요!'}`;
    }
    if (/말|뜻|단어|번역|아웬어|무슨소리/.test(q)) {
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
    // 시설·장소·인물 찾기
    const f = this.find(q);
    if (f) { this.mark(f); return `「${f.name}」 — ${f.dir}쪽 ${f.d} m 예요. 나침반에 표시했어요.`; }
    if (/어디야|여기|위치|어디에있|어디지|어디인/.test(q)) {
      const reg = g.world.regionAt(P.x, P.z), zone = this.zoneName(P.x, P.z);
      let near = null, nd = Infinity;
      for (const p of PLACES) { const d = Math.hypot(p.pos[0] - P.x, p.pos[1] - P.z); if (d < nd) { nd = d; near = p; } }
      const I = g.interiors;
      if (I && I.inPocket && I.cur) return `「${I.info(I.cur.r).name}」 안이에요. ${I.cur.info.P.desc} 나갈 때는 들어온 문 앞에서 E.`;
      return `${reg ? reg.name : '세렌'}${zone ? ', ' + zone : ''}${yeyo(zone || (reg ? reg.name : '세렌'))}.${near ? ` 가장 가까운 곳은 「${near.name}」(${this._where(near.pos[0], near.pos[1]).dir}쪽 ${Math.round(nd)} m)이고요.` : ''}`;
    }

    if (/썰매|활공|날개|날기|빛길|하늘배|탈것|빨리/.test(q)) return '공중에서 점프를 한 번 더 누르면 날개가 펴져요(카메라를 아래로 보면 급강하, 위로 보면 고도). 썰매는 F, 빛길 역과 하늘배 승강장에서는 먼 곳까지 바로 가요.';
    if (/도움|뭘물|할수있|기능/.test(q)) return '이런 걸 물어보세요: 「지금 뭘 하면 돼?」, 「가까운 찻집」, 「별씨 버는 법」, 「방금 들은 말 뜻」, 「우리 집」, 「이엘 어디 있어?」, 「여긴 어디야?」';
    for (const [id, T] of Object.entries(TIPS)) if (q.includes(T.title.split(' ')[0].replace(/\s/g, ''))) return `${T.title}: ${T.steps.join(' ')}`;
    return '음… 그건 지금 바로는 모르겠어요. 「지금 뭘 하면 돼?」, 「가까운 가게」, 「별씨 버는 법」처럼 물어봐 주시면 바로 찾아 드릴게요.';
  }
}

/** Claude 에게 주는 모아의 자리 (대화마다 맨 앞에) */
const RULES = `너는 「모아」다. 탐사선 「라르크」 조종사의 탐사복에 깃든 보조 지능이고, 조종사와 함께 신호를 따라 312일을 날아와 가스행성 「우르」를 도는 위성 「세렌」에 착륙했다.
세렌의 문명 「아웬」은 소리의 공명으로 중력을 다루며, 노래로 말한다. 조종사는 아웬의 말을 조금씩 배우고, 수도 하모네아에서 일하고 어울리며 이 사회의 한 사람이 되어 가고 있다.

말투와 규칙:
- 한국어로, 다정하고 똑똑한 동료처럼 "~요"체로. 보통 2~4문장으로 짧게. 조종사를 "조종사님"이라 부른다.
- 이야기 속 존재로서 말한다. "게임", "플레이어", "퀘스트" 같은 말 대신 "할 일", "이야기" 같은 말을 쓴다. 조작은 키 이름(E, F, 1~5, T…)으로 알려 줘도 된다.
- 사실은 [지금 상태]에 적힌 것만 믿는다. 적혀 있지 않은 장소·물건·사건은 지어내지 말고 "아직 모르겠어요"라고 하거나 찾아보자고 한다.
- 아직 하지 않은 이야기의 앞일(결말)은 미리 말하지 않는다. 막혔다고 하면 지금 할 일과 다음 한 걸음만 구체적으로 돕는다.
- 아웬의 말 뜻은 조종사가 아는 낱말까지만 풀어 준다(아직 모르는 낱말은 짐작이라고 밝힌다).
- 길이나 장소를 물으면 mark_place 도구가 있을 때 그것으로 나침반에 표시하고, 표시했다고 말한다. 도구가 없으면 방위와 거리로 알려 준다.
- 잡담·위로·감상도 좋다. 다만 늘 세렌과 이 여정 안에서.`;
