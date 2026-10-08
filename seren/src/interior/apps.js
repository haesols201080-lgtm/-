// 울림판 단말 (v0.9): 건물 안 단말·안내 빛판·자리 단말에서 여는 작은 「운영체제」.
//  · 홈: 이 건물의 조직·층 · 일자리(이 건물 + 둘레 건물의 실제 일자리 → 지원 → 면접 안내 → 면접 → 채용) · 내 일(맡은 일·교대·지원 현황)
//  · 안내: 층·방·시설·물건·사람 찾기 → 실제 길 안내(guide) · 살림: 이 가게/공장의 금고·재고·주문, 구역의 흐름
//  · 직무 앱(교대 중 내 자리에서): 장부 맞추기 · 글자 옮기기 · 배차 · 설계 · 흐름 분석 — 모두 실제 장부(econ)를 읽고, 배차는 실제로 짐을 보낸다.
//  · 연구소 분석 단말, 서고 찾기 단말, 물류 배차 단말, 회의 탁자.
//  면접은 건물의 채용 면접실(없으면 책임자실·사무실·안내대)에서 면접관과 — 단말 카드만으로 끝나지 않는다.
import { GOODS, DEMAND } from '../data/goods.js';
import { bookById } from '../data/books.js';
import { libraryIndex, locate, libState, subjectName, slotName } from './library.js';
import { WORDS, WORD } from '../data/lexicon.js';
import { glyphSVG } from '../game/language.js';
import { FUSE, ROOMS, FIX } from './catalog.js';
import { TYPES, roleOf, gname } from './ops-types.js';
import { searchBuilding, roomSpot } from './find.js';
import { uidOf } from './ids.js';
import { hashStr, mulberry32 } from '../core/noise.js';
import { audio } from '../core/audio.js';
import { won } from '../data/money.js';
import { josa } from '../core/josa.js';
import { deviceOf, SerenOS, osMail } from './os.js';

const HOUR = 1 / 24;
const hh = (t) => { const m = Math.round((t % 1) * 24 * 60); return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`; };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const shuffle = (a, r = Math.random) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
/** 일자리를 내는 쓰임 (지원 자격) */
const REQ = {
  factory: { permit: true }, plant: { permit: true },
  office: {}, admin: {}, lab: { words: 6 }, school: { words: 8 }, clinic: {}, mart: {}, food: {}, depot: {}, terminal: {}, museum: { words: 5 }, library: { words: 4 }, hall: {}, hotel: {}, farm: {},
};
const ROLE_REQ = { translator: { words: 12 }, designer: { done: 3 }, analyst: { done: 3 }, mechanic: { done: 2 } };
/** 면접 질문: 아웬의 일터 문화 */
const CULTURE = [
  ['함께 일하던 이가 지쳐 보이면?', ['잠깐 함께 고요히 노래하고 일을 나눈다', '못 본 척 내 일만 한다', '책임자에게 바로 알린다'], 0],
  ['일을 잘못했다는 걸 알았을 때?', ['바로 말하고 함께 고친다', '아무도 모르게 둔다', '다른 이의 탓으로 돌린다'], 0],
  ['울(세렌의 돈)은 무엇을 세는 셈일까요?', ['고마움', '힘', '나이'], 0],
  ['일하는 소리(일의 노래)는 왜 부를까요?', ['박자를 맞춰 서로의 일을 듣기 위해', '시끄럽게 하려고', '쉬는 시간을 알리려고'], 0],
];

export class Apps {
  constructor(game, ops) {
    this.game = game; this.ops = ops;
    this.wrap = null;
    this.view = null;
    this._t = 0;
    this.os = new SerenOS(this);
  }
  get S() { return this.ops.S; }
  get cur() { return this.ops.cur; }
  toast(s, kind) { this.game.ui.toast(s, kind ? { kind } : {}); }

  // ── 창 ─────────────────────────────────────
  /**
   * 기기 열기 (v24: 기기마다 다른 화면 문법 — os.js deviceOf). name: home|jobs|directory|mine|econ|work|meeting|dispatch|analysis|catalog, ctx: { T, F, app }
   *  · 안내 빛판/안내대: 층 안내·찾기만 · 공용 단말: 건물·일자리 공고·내 지원 · 제어판·회의 탁자·찾기 단말: 그 일 하나 · 컴퓨터: 울림 OS
   */
  open(name = 'home', ctx = {}) {
    if (!this.cur) return;
    if (this.game.tips && this.game.tips.first('osterm', () => this.open(name, ctx))) return;
    this.game.scan && this.game.scan('c_terminal');
    if (name === 'econ') this.game.scan && this.game.scan('c_starseed');
    this.ctx = ctx;
    const T = ctx.T || this.ops.byFloor(this.cur.indoor.cur);
    this.T = T;
    const dev = (this.dev = deviceOf(name, ctx, this.cur));
    const org = T && T.org ? T.org.name : this.game.interiors.title(this.cur.r);
    const st = (T && T.Z && T.Z.style) || {};
    const col = '#' + ((st.glow ?? 0x7ff3e6) >>> 0).toString(16).padStart(6, '0');
    if (dev.kind === 'computer') {
      const wrap = this.game.ui._card('<div></div>', () => { if (this.wrap === wrap) this.wrap = null; }, { keys: false });
      wrap.querySelector('.card').classList.add('svc-card', 'os-card', 'dev-computer');
      this.wrap = wrap;
      this.os.boot(ctx, dev, wrap);
      audio.blip && audio.blip({ hz: 660, to: 990, dur: 0.14, gain: 0.05, bus: 'ui' });
      return;
    }
    const tabs = dev.tabs || [];
    const html = `<div class="os dev dev-${dev.kind}" style="--os:${col}"><div class="os-head"><b>${esc(dev.title)}</b><span>${esc(org)} · ${hh(this.game.world.clock.time)}</span></div>
      ${tabs.length > 1 ? `<div class="os-nav">${tabs.map(([k, l]) => `<button class="os-tab" data-tab="${k}">${l}</button>`).join('')}</div>` : ''}<div class="os-body"></div></div>`;
    const wrap = this.game.ui._card(html, () => { if (this.wrap === wrap) this.wrap = null; }, { keys: false });
    wrap.querySelector('.card').classList.add('svc-card', 'os-card', `dev-${dev.kind}`);
    wrap.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); this.show(b.dataset.tab); }));
    this.wrap = wrap;
    this.show(dev.kind === 'kiosk' && !tabs.some((t) => t[0] === name) ? 'home' : name, ctx);
    audio.blip && audio.blip({ hz: 880, to: 1320, dur: 0.12, gain: 0.05, bus: 'ui' });
  }
  close() { if (this.wrap) { this.wrap.close(); this.wrap = null; } }
  /** 몸통 그리기: rows = [{ head } | { label, sub, act, disabled, primary } | { html }] */
  _render(title, intro, rows) {
    if (!this.wrap) return;
    const body = this.wrap.querySelector('.os-body');
    this.wrap.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === this.view));
    this._acts = [];
    const h = rows.map((r) => {
      if (r.head) return `<div class="svc-h">${esc(r.head)}</div>`;
      if (r.html) return r.html;
      const k = this._acts.push(r.act || null) - 1;
      return `<button class="btn svc-b${r.primary ? ' primary' : ''}" data-a="${k}" ${r.disabled || !r.act ? 'disabled' : ''}><b>${r.label}</b>${r.sub ? `<small>${r.sub}</small>` : ''}</button>`;
    }).join('');
    body.innerHTML = `${title ? `<h3>${title}</h3>` : ''}${intro ? `<p class="muted">${intro}</p>` : ''}<div class="svc">${h}</div>`;
    body.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); const f = this._acts[+b.dataset.a]; if (f) f(b); }));
    const inp = body.querySelector('input');
    if (inp) inp.focus();
  }
  show(name, ctx = this.ctx || {}) {
    this.view = name;
    if (this.dev && this.dev.kind === 'computer' && this.os[`v_${name}`]) { this.os[`v_${name}`](ctx); return; }
    const f = this[`_v_${name}`];
    if (f) f.call(this, ctx);
    else this._v_home(ctx);
  }

  // ── 홈 ─────────────────────────────────────
  _v_home() {
    const cur = this.cur, B = cur.B;
    const rows = [{ head: '이 건물' }];
    const seen = new Set();
    for (const Z of B.zones) {
      const fl = B.floors.filter((F) => B.zones[F.zone] === Z && F.reach);
      if (!fl.length) continue;
      const org = Z.org ? B.orgs.find((o) => o.id === Z.org) : null;
      const key = `${Z.use}|${org ? org.id : ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const a = fl[0].label, b = fl[fl.length - 1].label;
      rows.push({ label: `${a === b ? a : `${a}~${b}`}층 · ${FUSE[Z.use] ? FUSE[Z.use].name : Z.use}`, sub: org ? `${org.name}${org.chain ? ' (체인)' : ''}` : '', act: () => { this.game.guide && this.game.guide.to(this._floorGoal(fl[0].i)); this.close(); } });
    }
    const S = this.S;
    const iv = S.apps.filter((a) => a.status === 'interview');
    rows.push({ head: '알림' });
    if (iv.length) for (const a of iv) rows.push({ label: `면접 안내 · ${esc(a.title)}`, sub: `${esc(a.bname)} · ${a.uid === cur.uid ? '이 건물' : '다른 건물'} — 길 안내`, primary: true, act: () => this._goInterview(a) });
    const sh = S.shift;
    if (sh) { const j = S.jobs.find((x) => x.uid === sh.uid && x.k === sh.k); rows.push({ label: `일하는 중 · ${j ? j.title : ''}`, sub: `과제 ${sh.tasks} · ${hh(sh.start)} 출근`, act: () => this.show('mine') }); }
    if (!iv.length && !sh) rows.push({ label: '새 알림 없음', sub: '일자리 앱에서 지원하면 면접 안내가 여기 와요' });
    this._render(this.game.interiors.title(cur.r), `${B.floors.filter((F) => F.reach && !F.below).length}층 건물 · 이 단말로 건물 안내, 일자리 지원, 맡은 일을 볼 수 있어요.`, rows);
  }
  _floorGoal(i) {
    const cur = this.cur, pl = cur.indoor.plan(i);
    const L = pl.L;
    const R = L.lifthall != null ? L.rooms[L.lifthall] : L.rooms.find((q) => q.main) || L.rooms.find((q) => q.circ && q.n) || L.rooms.find((q) => q.n);
    const [gx, gz] = roomSpot(cur.B, R);
    return { floor: i, gx, gz, label: `${cur.B.floors[i].label}층 ${R.name || ''}` };
  }

  // ── 일자리 ──────────────────────────────────
  /** 한 건물(짜임 B)의 일자리 */
  postingsOf(r, B) {
    const out = [];
    const uid = uidOf(r);
    const name = this.game.interiors.title(r);
    B.zones.forEach((Z, k) => {
      const ty = TYPES[Z.op];
      if (!ty || !ty.roles) return;
      const org = Z.org ? B.orgs.find((o) => o.id === Z.org) : null;
      // 같은 조직이 여러 묶음이면 첫 묶음만
      if (org && B.zones.findIndex((q) => q.org === Z.org) !== k) return;
      for (const [role, R] of Object.entries(ty.roles)) {
        // 오늘 이 자리를 구하나 (날마다·건물마다 다르게)
        const day = Math.floor(this.game.world.clock.time);
        if (mulberry32(hashStr(`${uid}|${k}|${role}|${day}`))() < 0.25) continue;
        out.push({ uid, k, role, op: Z.op, title: R.title, wage: R.wage, hours: R.hours, desc: R.desc, org: org ? org.name : name, bname: name, x: r.door ? r.door.x : r.x, z: r.door ? r.door.z : r.z, rid: r.id });
      }
    });
    return out;
  }
  /** 자격 */
  reqOf(p) {
    const g = this.game, S = this.S;
    const q = { ...(REQ[p.op] || {}), ...(ROLE_REQ[p.role] || {}) };
    const words = g.lang ? WORDS.filter((w) => g.lang.known(w.id)).length : 0;
    const miss = [];
    if (q.permit && !g.state.flags.workPermit) miss.push('일 허가증 (행정청 민원 창구)');
    if (q.words && words < q.words) miss.push(`아는 말 ${q.words}개 (지금 ${words})`);
    if (q.done && S.done < q.done) miss.push(`마친 과제 ${q.done}개 (지금 ${S.done})`);
    if (S.jobs.length >= 3) miss.push('맡은 일은 셋까지');
    return miss;
  }
  _v_jobs() {
    const cur = this.cur, g = this.game, S = this.S;
    const here = this.postingsOf(cur.r, cur.B);
    // 둘레 건물 (들어갈 수 있는, 일자리가 있는 쓰임)
    const near = [];
    const C = g.city;
    if (C) {
      const P = { x: cur.r.x, z: cur.r.z };
      const cand = C.recs.filter((r) => r.door && r !== cur.r && Math.abs(r.x - P.x) < 700 && Math.abs(r.z - P.z) < 700).map((r) => [r, Math.hypot(r.x - P.x, r.z - P.z)]).sort((a, b) => a[1] - b[1]);
      let n = 0;
      for (const [r, d] of cand) {
        if (n >= 6) break;
        const pid = g.interiors.info(r).pid;
        if (pid === 'home' || pid === 'garden') continue;
        const B = g.interiors.store.plan(r);
        if (!B) continue;
        const ps = this.postingsOf(r, B);
        if (!ps.length) continue;
        n++;
        for (const p of ps.slice(0, 3)) near.push({ ...p, d });
      }
    }
    const row = (p) => {
      const has = S.jobs.find((j) => j.uid === p.uid && j.k === p.k && j.role === p.role);
      const ap = S.apps.find((a) => a.uid === p.uid && a.k === p.k && a.role === p.role && a.status !== 'done');
      const miss = this.reqOf(p);
      const st = has ? '맡고 있음' : ap ? (ap.status === 'applied' ? '지원함 · 면접 안내를 기다리는 중' : ap.status === 'interview' ? '면접 안내 받음' : ap.status === 'rejected' ? `다음 기회에 (${ap.retry ? `${Math.max(0, Math.ceil((ap.retry - g.world.clock.time) * 24))}시간 뒤 다시` : ''})` : '') : '';
      return { label: `${esc(p.title)} · ${esc(p.org)}`, sub: `${esc(p.desc)} · 시간당 ${won(p.wage)} · ${hh(p.hours[0])}~${hh(p.hours[1])}${p.d ? ` · ${Math.round(p.d)} m` : ''}${st ? ` · <b>${st}</b>` : miss.length ? ` · 필요: ${miss.join(', ')}` : ''}`, disabled: !!has || (ap && ap.status !== 'rejected') || (ap && ap.retry > g.world.clock.time) || miss.length > 0, act: () => this.apply(p) };
    };
    const rows = [{ head: `이 건물 (${here.length})` }, ...here.map(row)];
    if (!here.length) rows.push({ label: '오늘은 이 건물에서 사람을 구하지 않아요', sub: '내일 다시 보거나 둘레 건물을 보세요' });
    rows.push({ head: '둘레 건물' }, ...near.map(row));
    this._render('일자리', '지원하면 한 시간쯤 뒤 면접 안내가 와요. 면접은 그 건물의 채용 면접실에서 면접관과. 붙으면 그 건물 출근 단말에서 출근·퇴근하고, 품삯은 그 회사 금고에서 나와요.', rows);
  }
  apply(p) {
    const g = this.game, S = this.S;
    const old = S.apps.find((a) => a.uid === p.uid && a.k === p.k && a.role === p.role);
    if (old) S.apps.splice(S.apps.indexOf(old), 1);
    S.apps.push({ uid: p.uid, k: p.k, role: p.role, op: p.op, title: p.title, org: p.org, bname: p.bname, x: p.x, z: p.z, rid: p.rid, wage: p.wage, hours: p.hours, status: 'applied', t: g.world.clock.time });
    this.toast(`지원했다 · ${p.title} (${p.org}) — 면접 안내를 기다려요`, 'item');
    osMail(g, { from: `${p.org} 채용 담당`, subj: `지원 받음 · ${p.title}`, body: `${p.title} 자리에 지원해 주셔서 고마워요.\n한 시간쯤 뒤 면접 안내를 보낼게요.\n일하는 곳: ${p.bname}\n시간: ${hh(p.hours[0])}~${hh(p.hours[1])} · 시간당 ${p.wage}`, key: `apply:${p.uid}:${p.k}:${p.role}:${Math.floor(g.world.clock.time)}` });
    audio.blip && audio.blip({ hz: 660, to: 990, dur: 0.15, gain: 0.05 });
    this.show('jobs');
  }
  /** 지원 → 면접 안내 (시간이 지나면) */
  tick(dt) {
    this._t += dt;
    if (this._t < 2) return;
    this._t = 0;
    const g = this.game, now = g.world.clock.time;
    for (const a of this.S.apps) {
      if (a.status === 'applied' && now - a.t > HOUR) {
        a.status = 'interview';
        a.t = now;
        g.ui.toast(`면접 안내 · ${a.title} (${a.org}) — ${a.bname}의 채용 면접실로. 공용 단말 「건물」에서 길 안내`, { kind: 'item' });
        osMail(g, { from: `${a.org} 채용 담당`, subj: `면접 안내 · ${a.title}`, body: `${a.bname}의 채용 면접실로 와 주세요.\n이틀 안에 오지 않으면 기회가 지나가요.\n면접관이 일터 문화에 대해 세 가지를 물어요.`, key: `iv:${a.uid}:${a.k}:${a.role}:${Math.floor(now)}` });
        audio.blip && audio.blip({ hz: 520, to: 1040, dur: 0.25, gain: 0.06 });
      }
      if (a.status === 'interview' && now - a.t > 2) { a.status = 'rejected'; a.retry = now; } // 이틀 넘게 안 가면 기회가 지나간다
    }
  }
  onEnter(cur) {
    const a = this.S.apps.find((x) => x.status === 'interview' && x.uid === cur.uid);
    if (a) setTimeout(() => { if (this.cur === cur) { this.toast(`면접 보러 왔어요 · ${a.title} — 채용 면접실로 안내할게요`, 'item'); this._goInterview(a); } }, 1500);
  }
  /** 이 건물의 면접 자리 (채용 면접실 → 책임자실 → 사무실 → 안내대) */
  ivSpot(cur = this.cur) {
    const b = this.ops.bstate(cur.uid);
    if (b.iv && b.iv.gen === cur.B.seed) return b.iv;
    const ind = cur.indoor, B = cur.B;
    const order = [(F) => F.tag === 'interview', (F, L) => F.tag === 'desk' && L.rooms[F.room] && L.rooms[F.room].type === 'manager', (F, L) => F.tag === 'meeting', (F) => F.tag === 'reception', (F) => F.tag === 'clock', (F) => ['checkout', 'order', 'console', 'circulation', 'civic', 'doctor', 'tickets', 'desk', 'teacher', 'nurse'].includes(F.tag)]; // 작은 건물은 계산대·대출대·창구·진료 책상 앞에서
    const floors = B.floors.filter((F) => F.reach && !F.dead).map((F) => F.i).sort((a, b) => Math.abs(a - B.ground) - Math.abs(b - B.ground));
    for (const test of order) {
      for (const i of floors.slice(0, 12)) {
        const pl = ind.plan(i);
        if (!pl) continue;
        const F = pl.fix.find((f) => test(f, pl.L));
        if (F) { b.iv = { gen: B.seed, floor: i, fid: F.id, gx: F.ax, gz: F.az, room: (pl.L.rooms[F.room] || {}).name || '' }; return b.iv; }
      }
    }
    return null;
  }
  _goInterview(a) {
    const g = this.game, cur = this.cur;
    this.close();
    if (cur && a.uid === cur.uid) {
      const iv = this.ivSpot();
      if (iv && g.guide) g.guide.to({ floor: iv.floor, gx: iv.gx, gz: iv.gz, label: `면접 · ${iv.room}` });
    } else if (g.guide) g.guide.to({ world: { x: a.x, z: a.z }, label: `면접 · ${a.bname}` });
  }
  /** 지금 이 가구가 면접 자리이고 면접이 기다리는가 */
  ivPending(F, i) {
    const cur = this.cur;
    if (!cur) return null;
    const a = this.S.apps.find((x) => x.status === 'interview' && x.uid === cur.uid);
    if (!a) return null;
    const iv = this.ivSpot();
    return iv && iv.floor === i && iv.fid === F.id ? a : null;
  }
  /** 면접: 면접관과 세 가지 이야기 */
  interview(T) {
    const g = this.game, cur = this.cur;
    const a = this.S.apps.find((x) => x.status === 'interview' && x.uid === cur.uid && (!T || x.k === T.k)) || this.S.apps.find((x) => x.status === 'interview' && x.uid === cur.uid);
    if (!a) { this.toast('면접 예정이 없어요 — 단말의 「일자리」에서 지원해요', 'muted'); return; }
    const R = roleOf(a.op, a.role) || { desc: a.title };
    // 질문 1: 하는 일 (다른 일자리의 설명 둘과 섞어서)
    const others = [];
    for (const [op, ty] of Object.entries(TYPES)) if (ty.roles) for (const [rid, q] of Object.entries(ty.roles)) if (rid !== a.role && op !== a.op && q.desc) others.push(q.desc);
    const rnd = mulberry32(hashStr(`${a.uid}|${a.role}|${Math.floor(g.world.clock.time)}`));
    const q1 = [`${josa(`「${a.title}」`, '은')} 무슨 일을 하나요?`, shuffle([R.desc, ...shuffle(others, rnd).slice(0, 2)], rnd), null];
    q1[2] = q1[1].indexOf(R.desc);
    // 질문 2: 일의 셈 (시간·품삯)
    const h = Math.round((a.hours[1] - a.hours[0]) * 24);
    const pay = Math.round(h * a.wage * 10) / 10;
    const q2 = [`하루 ${h}시간, 시간당 ${won(a.wage)}이면 하루 품삯은?`, shuffle([`${pay}`, `${Math.round((pay + a.wage * 2) * 10) / 10}`, `${Math.round(Math.max(1, pay - a.wage * 3) * 10) / 10}`], rnd), null];
    q2[2] = q2[1].indexOf(`${pay}`);
    // 질문 3: 일터 문화
    const c = CULTURE[Math.floor(rnd() * CULTURE.length)];
    const q3 = [c[0], shuffle(c[1].slice(), rnd), null];
    q3[2] = q3[1].indexOf(c[1][c[2]]);
    const Q = [q1, q2, q3];
    let k = 0, score = 0;
    const ask = () => {
      const [q, opts, ans] = Q[k];
      g.ui.serviceCard(`채용 면접 · ${a.org}`, `${k + 1} / 3`, `면접관: 「${q}」`, opts.map((o, j) => ({ label: o, onClick: () => { if (j === ans) score++; k++; audio.blip && audio.blip({ hz: j === ans ? 880 : 330, to: j === ans ? 1100 : 300, dur: 0.1, gain: 0.05 }); if (k < 3) setTimeout(ask, 120); else setTimeout(done, 150); } })));
      this.ops.say(T || this.ops.byFloor(cur.indoor.cur), 'chat');
    };
    const done = () => {
      if (score >= 2) {
        a.status = 'done';
        const job = { uid: a.uid, k: a.k, role: a.role, op: a.op, title: a.title, org: a.org, bname: a.bname, wage: a.wage, hours: a.hours, x: a.x, z: a.z, rid: a.rid, since: g.world.clock.time, worked: 0, rating: 3 };
        this.S.jobs.push(job);
        g.ui.serviceCard(`채용 면접 · ${a.org}`, '함께 일해요!', `${score}/3 · ${josa(`「${a.title}」`, '로')} 일하게 됐어요. ${hh(a.hours[0])}~${hh(a.hours[1])} 사이에 이 건물의 출근 단말에서 출근하면 할 일이 나와요. 품삯은 퇴근할 때 일한 시간과 마친 과제만큼 회사 금고에서.`, [{ label: '출근 단말로 길 안내', primary: true, onClick: () => this._guideClock(job) }, { label: '알겠어요' }]);
        g.setFlag && g.setFlag('hiredIndoor');
        osMail(g, { from: `${a.org} 사람 담당`, subj: `함께 일해요 · ${a.title}`, body: `${a.title} 자리로 함께하게 되어 기뻐요.\n일하는 곳: ${a.bname}\n시간: 날마다 ${hh(a.hours[0])}~${hh(a.hours[1])} · 시간당 ${a.wage}\n이 건물의 출근 단말에서 출근하면 내 자리 컴퓨터에 내 계정이 열려요.`, key: `hire:${a.uid}:${a.k}:${a.role}` });
        g.scan && g.scan('c_job');
        if (g.lang && WORD.work && !g.lang.known('work')) g.lang.learn('work', 'teach');
      } else {
        a.status = 'rejected';
        a.retry = g.world.clock.time + 1;
        osMail(g, { from: `${a.org} 채용 담당`, subj: `면접 결과 · ${a.title}`, body: `이번에는 함께하지 못하게 됐어요.\n내일 다시 지원해 주세요 — 일자리 앱이나 공용 단말에서.`, key: `rej:${a.uid}:${a.k}:${a.role}:${Math.floor(g.world.clock.time)}` });
        g.ui.serviceCard(`채용 면접 · ${a.org}`, '이번에는…', `${score}/3 · 면접관: 「조금 더 이 일을 알아보고 오면 좋겠어요. 내일 다시 지원해 주세요.」 (일자리 앱)`, [{ label: '알겠어요' }]);
      }
    };
    ask();
  }
  _guideClock(job) {
    const cur = this.cur, g = this.game;
    if (!cur || cur.uid !== job.uid) { g.guide && g.guide.to({ world: { x: job.x, z: job.z }, label: job.bname }); return; }
    const T = this.ops.tenants.find((t) => t.k === job.k) || this.ops.tenants[0];
    for (const i of T.floors) { const pl = cur.indoor.plan(i); const F = pl && pl.fix.find((f) => f.tag === 'clock'); if (F) { g.guide.to({ floor: i, gx: F.ax, gz: F.az, label: '출근 단말' }); return; } }
    const r = searchBuilding(g, '내 일터', { limit: 1 })[0];
    if (r) g.guide.to(r);
  }

  // ── 내 일 ──────────────────────────────────
  _v_mine() {
    const g = this.game, S = this.S, cur = this.cur;
    const rows = [{ head: `맡은 일 (${S.jobs.length})` }];
    for (const j of S.jobs) {
      const here = cur && j.uid === cur.uid;
      rows.push({ label: `${esc(j.title)} · ${esc(j.org)}`, sub: `${esc(j.bname)}${here ? ' (이 건물)' : ''} · ${hh(j.hours[0])}~${hh(j.hours[1])} · 시간당 ${j.wage} · 일한 시간 ${(j.worked || 0).toFixed(1)} · 평판 ${'★'.repeat(Math.round(j.rating || 3))}`, act: () => { this.close(); this._guideClock(j); } });
      rows.push({ label: '그만두기', sub: '이 일을 내려놓는다', act: (b) => { if (b.dataset.sure) { S.jobs.splice(S.jobs.indexOf(j), 1); if (S.shift && S.shift.uid === j.uid && S.shift.k === j.k) this.ops.clockOut(); this.toast(`${j.title} 일을 그만두었다`, 'muted'); this.show('mine'); } else { b.dataset.sure = 1; b.querySelector('b').textContent = '정말 그만둘까요? 한 번 더 누르면 그만둬요'; } } });
    }
    if (!S.jobs.length) rows.push({ label: '아직 맡은 일이 없어요', sub: '「일자리」 앱에서 지원해요', act: () => this.show('jobs') });
    rows.push({ head: '지원 현황' });
    const ap = S.apps.filter((a) => a.status !== 'done');
    for (const a of ap) rows.push({ label: `${esc(a.title)} · ${esc(a.org)}`, sub: a.status === 'applied' ? '면접 안내를 기다리는 중' : a.status === 'interview' ? '면접 안내 받음 — 눌러서 길 안내' : '이번엔 안 됐어요 (다시 지원 가능)', act: a.status === 'interview' ? () => this._goInterview(a) : null });
    if (!ap.length) rows.push({ label: '진행 중인 지원 없음' });
    rows.push({ head: '지금까지' });
    rows.push({ label: `마친 과제 ${S.done} · 번 ${won(Math.round(S.earned * 10) / 10)}`, sub: g.econ ? `받은 것 ${Math.round(g.econ.S.P.earned)} · 쓴 것 ${Math.round(g.econ.S.P.spent)}` : '' });
    for (const l of (g.econ ? g.econ.S.log : []).slice(-6).reverse()) rows.push({ label: `${l[1] > 0 ? '+' : ''}${Math.round(l[1] * 100) / 100} · ${esc(l[2])}`, sub: `${hh(l[0])}` });
    this._render('내 일', S.shift ? '교대 중이에요. 퇴근은 출근 단말에서.' : '', rows);
  }

  // ── 살림 (이 가게·공장의 장부, 구역의 흐름) ─────────────
  _v_econ() {
    const g = this.game, E = g.econ, T = this.T;
    g.scan && g.scan('c_starseed');
    const rows = [];
    if (T && T.node) {
      const n = T.node;
      const stock = Object.entries(n.stock).filter(([, v]) => v > 0.5).sort((a, b) => b[1] - a[1]);
      const shelf = Object.values(n.shelf || {});
      rows.push({ head: `${T.org ? T.org.name : '이 건물'} 장부` });
      rows.push({ html: `<div class="svc-stat"><span>금고 <b>${Math.round(n.cash)}</b></span><span>판 값 <b>${Math.round(n.sales)}</b></span><span>사 온 값 <b>${Math.round(n.bought)}</b></span><span>일꾼 <b>${n.staff || 0}</b></span></div>` });
      if (shelf.length) rows.push({ label: `진열 ${shelf.reduce((a, s) => a + s.n, 0)} / ${shelf.reduce((a, s) => a + s.cap, 0)}칸`, sub: '손님이 집으면 줄고, 직원이 창고에서 채운다' });
      if (stock.length) rows.push({ label: `창고 · ${stock.slice(0, 6).map(([k, v]) => `${gname(k)} ${Math.floor(v)}`).join(' · ')}`, sub: '물류 창고에서 들어온 것' });
      if (n.orders.length) rows.push({ label: `오는 중 · ${n.orders.map((o) => `${gname(o.g)} ${o.n}`).join(' · ')}`, sub: `물류 창고 → 하역장 (${n.orders.map((o) => hh(o.at)).join(', ')} 도착)` });
      if (n.dock && n.dock.length) rows.push({ label: `하역장에 도착 · ${n.dock.map((o) => `${gname(o.g)} ${o.n}`).join(' · ')}`, sub: '하역 담당이 창고로 옮긴다' });
    }
    const zid = T ? T.zone : null, z = zid && E.S.Z[zid];
    if (z) {
      rows.push({ head: `구역 살림 · ${zid}` });
      rows.push({ html: `<div class="svc-stat"><span>주민 <b>${z.pop}</b></span><span>가구 <b>${Math.round(z.hh)}</b></span><span>회사 <b>${Math.round(z.firms)}</b></span><span>공공 <b>${Math.round(z.commons)}</b></span><span>빛 <b>${Math.round(z.energy)}</b></span></div>` });
      rows.push({ label: `이번 시간 · 만든 것 ${Math.round(z.made)} · 판 것 ${Math.round(z.sold)} · 품삯 ${Math.round(z.wages)}`, sub: '농장·채굴 → 공장 → 물류 → 가게 → 주민 (돈은 가구 ↔ 회사 ↔ 공공으로만 돈다)' });
      const low = Object.entries(DEMAND).map(([k, d]) => [k, (z.retail[k] || 0) / Math.max(1, d * z.pop)]).sort((a, b) => a[1] - b[1]).slice(0, 4);
      rows.push({ label: `가게에 모자란 것 · ${low.map(([k]) => gname(k)).join(' · ')}`, sub: `물류 창고 · ${['grain', 'ore', 'fuel', 'flour', 'shard'].map((k) => `${gname(k)} ${Math.floor(z.depot[k] || 0)}`).join(' · ')}` });
    }
    this._render('살림', '이 도시의 돈(울)과 물건은 저절로 생기지 않아요 — 모두 이 장부에서 옮겨 다녀요.', rows);
  }

  // ── 안내 (찾기·층) ─────────────────────────────
  _v_directory(ctx = {}) {
    const cur = this.cur, B = cur.B, g = this.game;
    const q = ctx.q || '';
    const res = q ? searchBuilding(g, q, { limit: 10 }) : [];
    const quick = ['가까운 승강기', '계단', '출구', '화장실', '계산대', '내 일터', '면접', '식당'];
    const rows = [{ html: `<div class="os-search"><input type="text" placeholder="찾기: 방·물건·시설·사람 (예: 빵, 회의실, 승강기)" value="${esc(q)}"><button class="btn" data-go>찾기</button></div><div class="os-quick">${quick.map((s) => `<button class="btn os-q" data-q="${s}">${s}</button>`).join('')}</div>` }];
    if (q) {
      rows.push({ head: res.length ? `「${esc(q)}」 ${res.length}곳` : `「${esc(q)}」 — 못 찾았어요` });
      for (const r of res) rows.push({ label: esc(r.label), sub: `${esc(r.sub || '')}${r.floor !== cur.indoor.cur ? '' : ' · 이 층'}`, primary: res.indexOf(r) === 0, act: () => { g.guide.to(r); this.close(); } });
    }
    rows.push({ head: '층 안내' });
    for (const F of B.floors.slice().reverse()) {
      if (!F.reach || F.dead) continue;
      const Z = B.zones[F.zone], org = Z && Z.org ? B.orgs.find((o) => o.id === Z.org) : null;
      rows.push({ label: `${F.label}층 · ${FUSE[F.use] ? FUSE[F.use].name : F.use}${F.i === cur.indoor.cur ? ' (지금)' : ''}`, sub: org ? org.name : '', act: () => this._v_floor(F.i) });
    }
    this._render('안내', '찾으면 바닥에 빛 길이 깔리고 나침반이 가리켜요. 다른 층이면 계단·승강기부터.', rows);
    const body = this.wrap.querySelector('.os-body'), inp = body.querySelector('input');
    const go = () => this._v_directory({ q: inp.value.trim() });
    body.querySelector('[data-go]').addEventListener('click', (e) => { e.stopPropagation(); go(); });
    inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') go(); });
    body.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); this._v_directory({ q: b.dataset.q }); }));
  }
  _v_floor(i) {
    const cur = this.cur, B = cur.B, g = this.game;
    const pl = cur.indoor.plan(i);
    const rows = [];
    const F = B.floors[i];
    const rooms = pl.L.rooms.filter((R) => R.n && !R.sealed && !R.circ && !['lift', 'cargo', 'shaft', 'stair'].includes(R.type));
    const by = new Map();
    for (const R of rooms) { const k = R.name || ROOMS[R.type].name; if (!by.has(k)) by.set(k, []); by.get(k).push(R); }
    for (const [k, list] of by) {
      const R = list[0], acc = ROOMS[R.type] ? ROOMS[R.type].acc : 'public';
      rows.push({ label: `${esc(k)}${list.length > 1 ? ` ×${list.length}` : ''}`, sub: `${acc === 'staff' ? '직원' : acc === 'private' ? '사는 이·묵는 이' : '누구나'} · ${list.reduce((a, q) => a + q.n, 0)} m²`, act: () => { g.guide.toRoom(i, R.id, `${F.label}층 ${k}`); this.close(); } });
    }
    rows.push({ label: '← 층 목록', act: () => this._v_directory({}) });
    this.view = 'directory';
    this._render(`${F.label}층 · ${FUSE[F.use] ? FUSE[F.use].name : F.use}`, `방 ${rooms.length}개 · 바닥 ${F.n} m²`, rows);
  }

  // ── 직무 앱 (교대 중) ──────────────────────────
  _v_work(ctx = {}) {
    const job = this.ops.myJobHere(), S = this.S;
    if (!job || !S.shift) { this._render('업무', '교대 중일 때만 업무 앱이 열려요. 출근 단말에서 출근해요.', [{ label: '내 일 보기', act: () => this.show('mine') }]); return; }
    const R = roleOf(job.op, job.role) || {};
    const app = ctx.app || R.app || 'ledger';
    const f = this[`_w_${app}`];
    if (f) f.call(this, job);
    else this._w_ledger(job);
  }
  _done(msg, good = true) {
    const T = this.T;
    if (good) { this.ops.taskDone(T); this.toast(msg, 'item'); audio.blip && audio.blip({ hz: 990, to: 1320, dur: 0.14, gain: 0.05 }); }
    else { this.toast(msg, 'muted'); audio.blip && audio.blip({ hz: 300, to: 240, dur: 0.14, gain: 0.05 }); }
  }
  /** 장부 맞추기: 이 회사의 실제 장부(금고·판 값·사 온 값·품삯)에서 줄 하나가 어긋난다 */
  _w_ledger(job) {
    const n = this.T.node, rnd = Math.random;
    const base = [['판 값', Math.round(n.sales)], ['사 온 값', Math.round(n.bought)], ['품삯', Math.round((n.staff || 1) * 6)], ['금고', Math.round(n.cash)], ['주문', n.orders.length * 3 + 4]];
    const rows = base.map(([k, v]) => { const a = Math.max(1, Math.round(v * (0.3 + rnd() * 0.4))); return { k, a, b: v - a, c: v }; });
    const bad = Math.floor(rnd() * rows.length);
    rows[bad].c += [3, -4, 7, -2][Math.floor(rnd() * 4)];
    this._render('업무 · 장부 맞추기', `${job.org} 장부. 줄마다 「앞 + 뒤 = 합」이어야 해요. 어긋난 줄을 고르세요.`, rows.map((r, k) => ({ label: `${r.k} · ${r.a} + ${r.b} = ${r.c}`, act: () => { if (k === bad) this._done('어긋난 줄을 찾았다 · 장부가 맞는다'); else this._done('이 줄은 맞아요 — 다시 보세요', false); this._w_ledger(job); } })).concat([{ label: '그만 (업무 끝내기)', act: () => this.close() }]));
  }
  /** 글자 옮기기: 아웬 글자 문서를 한국어로 */
  _w_glyph(job) {
    const g = this.game;
    const known = WORDS.filter((w) => g.lang && g.lang.known(w.id));
    const pool = known.length >= 3 ? known : WORDS.slice(0, 12);
    const w = pool[Math.floor(Math.random() * pool.length)];
    const opts = shuffle([w, ...shuffle(WORDS.filter((x) => x.id !== w.id)).slice(0, 2)]);
    this._render('업무 · 글자 옮기기', `문서의 글자: <span class="os-glyph">${glyphSVG(w.id, 64)}</span> — 점의 높이가 음의 높이예요. 무슨 뜻일까요?`, opts.map((o) => ({ label: o.ko, act: () => { if (o.id === w.id) { this._done(`옮겼다 · 「${w.ko}」`); if (g.lang && !g.lang.known(w.id)) g.lang.learn(w.id, 'guess'); } else this._done(`「${w.ko}」였어요`, false); this._w_glyph(job); } })).concat([{ label: '그만', act: () => this.close() }]));
  }
  /** 배차: 구역 가게 재고가 가장 모자란 것에 짐 드론 (실제로 창고 → 가게) */
  _w_dispatch(job) {
    const g = this.game, E = g.econ, zid = this.T.zone, z = E.S.Z[zid];
    if (!z) return;
    const list = Object.entries(DEMAND).map(([k, d]) => ({ k, ratio: (z.retail[k] || 0) / Math.max(1, d * z.pop), depot: Math.floor(z.depot[k] || 0) })).sort(() => Math.random() - 0.5).slice(0, 5);
    const worst = list.filter((e) => e.depot > 0).sort((a, b) => a.ratio - b.ratio)[0];
    this._render('업무 · 배차', `구역 ${zid} 가게들의 재고(수요 대비)와 물류 창고 재고. 가장 모자란 물건에 짐 드론을 보내요.`, list.map((e) => ({ label: `${gname(e.k)} · 가게 ${Math.round(e.ratio * 100)}%`, sub: `물류 창고 ${e.depot}`, disabled: e.depot <= 0, act: () => {
      const v = E.take(zid, 'depot', e.k, Math.min(40, Math.max(5, Math.round(DEMAND[e.k] * z.pop * 0.3))));
      E.give(zid, 'retail', e.k, v);
      if (worst && e.k === worst.k) this._done(`드론 출발 · ${gname(e.k)} ${v}개 → 가게들`);
      else this._done(`${gname(e.k)} ${v}개를 보냈지만, 더 급한 게 있었어요`, false);
      this._w_dispatch(job);
    } })).concat([{ label: '그만', act: () => this.close() }]));
  }
  /** 설계: 공명기 도면 — 아래부터 차례로 */
  _w_design(job) {
    const parts = [['받침 고리', '맨 아래'], ['결정 심', '받침 위'], ['공명 코일', '결정을 감싼다'], ['빛판 덮개', '맨 위']];
    const st = this._ds || (this._ds = { k: 0, order: shuffle(parts.map((p, i) => i)) });
    this._render('업무 · 빛판 설계', `공명기 도면: 아래에서 위로 차례대로 놓아요. (${st.k}/4 놓음)`, st.order.map((i) => ({ label: parts[i][0], sub: parts[i][1], disabled: i < st.k, act: () => { if (i === st.k) { st.k++; audio.blip && audio.blip({ hz: 600 + st.k * 120, to: 700 + st.k * 120, dur: 0.08, gain: 0.05 }); if (st.k >= 4) { this._ds = null; this._done('도면 완성 · 공명기 한 벌'); } } else { st.k = 0; this.toast('순서가 어긋나 처음부터', 'muted'); } this._w_design(job); } })).concat([{ label: '그만', act: () => { this._ds = null; this.close(); } }]));
  }
  /** 흐름 분석: 구역의 시간별 흐름에서 튀는 값 */
  _w_chart(job) {
    const z = this.game.econ.S.Z[this.T.zone];
    const base = Math.max(5, Math.round(z ? z.sold : 20));
    const vals = Array.from({ length: 8 }, () => Math.round(base * (0.8 + Math.random() * 0.4)));
    const odd = Math.floor(Math.random() * 8);
    vals[odd] = Math.round(base * (Math.random() < 0.5 ? 2.2 : 0.25));
    const mx = Math.max(...vals);
    const bars = vals.map((v, k) => `<button class="os-bar" data-bar="${k}" style="height:${Math.round((v / mx) * 90) + 6}px" title="${v}"></button>`).join('');
    this._render('업무 · 흐름 분석', '구역의 시간마다 판 양. 하나가 어긋나 있어요 — 그 막대를 눌러요.', [{ html: `<div class="os-chart">${bars}</div>` }, { label: '그만', act: () => this.close() }]);
    this.wrap.querySelectorAll('[data-bar]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); if (+b.dataset.bar === odd) this._done('어긋난 시간을 찾았다 · 보고서에 적었다'); else this._done('흐름 안이에요', false); this._w_chart(job); }));
  }
  /** 회의: 동료들의 의견 가운데 장부와 맞는 것 */
  _v_meeting() {
    const T = this.T, n = T.node;
    const low = Object.entries(n.stock).filter(([, v]) => v < 3).map(([k]) => k)[0];
    const right = low ? `${josa(gname(low), '이')} 떨어져 가니 물류 창고에 먼저 주문하자` : '지금은 재고가 넉넉하니 일의 노래를 맞추자';
    const opts = shuffle([right, '오늘은 문을 일찍 닫자', '값을 두 배로 올리자']);
    this.view = 'work';
    this._render('회의', `동료 셋이 의견을 냈어요. 장부(${low ? `${gname(low)} 재고 ${Math.floor(n.stock[low] || 0)}` : '재고 넉넉'})와 맞는 의견에 목소리를 보태요.`, opts.map((o) => ({ label: o, act: () => { if (o === right) this._done('회의가 한 음으로 모였다'); else this._done('다들 고개를 갸웃한다', false); this.close(); } })));
  }
  /** 물류 배차 단말 (창고): 구역 흐름 보기 + (교대 중이면) 배차 */
  _v_dispatch() {
    const job = this.ops.myJobHere(), S = this.S;
    if (job && S.shift) { this._w_dispatch(job); return; }
    const g = this.game, E = g.econ, zid = this.T.zone, z = E.S.Z[zid];
    const rows = [{ head: '구역 물류 창고' }];
    for (const [k, v] of Object.entries(z ? z.depot : {}).sort((a, b) => b[1] - a[1]).slice(0, 8)) rows.push({ label: `${gname(k)} ${Math.floor(v)}`, sub: `가게 ${Math.floor(z.retail[k] || 0)}` });
    rows.push({ head: '가게로 가는 중' });
    const ord = Object.values(E.S.N).filter((n) => n.zone === zid).flatMap((n) => n.orders.map((o) => ({ ...o, uid: n.uid }))).slice(0, 8);
    for (const o of ord) rows.push({ label: `${gname(o.g)} ${o.n}`, sub: `${hh(o.at)} 도착` });
    if (!ord.length) rows.push({ label: '지금은 없음' });
    this._render('배차 단말', '구역의 짐 흐름. 배차는 이 창고 일꾼(교대 중)만.', rows);
  }
  /** 연구소 분석: 측정 자료에서 공명 봉우리 찾기 */
  _v_analysis() {
    const ops = this.ops, L = TYPES.lab.st(ops);
    if (L.data <= 0) { this._render('분석 단말', '측정 자료가 없어요. 시료 냉장고 → 실험대(손질) → 장비(측정) 순서로 자료를 만들어요.', Object.entries(L.p).map(([k, v]) => ({ label: `${k} · ${v}%` }))); return; }
    const n = 14, peak = 2 + Math.floor(Math.random() * (n - 4));
    const vals = Array.from({ length: n }, (_, k) => Math.max(4, Math.round(20 + Math.random() * 18 + (k === peak ? 70 : 0) - Math.abs(k - peak) * 2)));
    const mx = Math.max(...vals);
    const bars = vals.map((v, k) => `<button class="os-bar" data-bar="${k}" style="height:${Math.round((v / mx) * 90) + 6}px"></button>`).join('');
    this._render('분석 단말', `측정 자료 ${L.data} · 물질이 가장 크게 울리는 음(봉우리)을 눌러요.`, [{ html: `<div class="os-chart">${bars}</div>` }]);
    this.wrap.querySelectorAll('[data-bar]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); const k = +b.dataset.bar; TYPES.lab.analyzed(ops, this.T, Math.abs(k - peak) <= 0); this._v_analysis(); }));
  }
  /** 서고 찾기 단말: 기록 → 그 칸이 있는 서가로 길 안내 */
  _v_catalog(ctx = {}) {
    const ops = this.ops, cur = this.cur, g = this.game;
    const q = (ctx.q || '').trim(), sub = ctx.sub || null;
    const T = ctx.T || ops.byFloor(cur.indoor.cur);
    const idx = libraryIndex(cur), S = libState(g);
    const books = [...idx.at.keys()].map((id) => bookById(id)).filter(Boolean);
    const cnt = {};
    for (const b of books) cnt[b.subject] = (cnt[b.subject] || 0) + 1;
    let list = books;
    if (q) list = books.filter((b) => b.title.includes(q) || b.author.includes(q) || subjectName(b.subject).includes(q));
    else if (sub) list = books.filter((b) => b.subject === sub);
    const shown = list.slice(0, 80);
    const fl = (i) => cur.B.floors[i].label;
    const plan = idx.floors.length > 4 ? `서고 ${idx.floors.length}개 층, 층마다 맡은 분류가 달라요 (${fl(idx.floors[0].floor)}층 ${idx.floors[0].subs.map(subjectName).join('·')} …)` : idx.floors.map((x) => `${fl(x.floor)}층 ${x.subs.map(subjectName).join('·')}`).join(' / ');
    this._render('찾기 단말', `이 서고의 목록 ${books.length}가지 — ${plan}. 서가마다 목록의 책 다음에는 그 분류의 일지·기록·이야기가 이어져요. 고르면 그 책이 꽂힌 서가로 길을 알려 줘요.`, [
      { html: `<div class="os-search"><input type="text" placeholder="제목·지은이·분류" value="${esc(q)}"><button class="btn" data-go>찾기</button></div>` },
      { html: `<div class="book-tabs">${Object.keys(cnt).map((k) => `<button class="btn${k === sub && !q ? ' on' : ''}" data-sub="${k}">${subjectName(k)} ${cnt[k]}</button>`).join('')}</div>` },
      ...(list.length ? [] : [{ head: '찾는 책이 이 서고 목록에 없어요' }]),
      ...shown.map((b) => { const i = idx.at.get(b.id), out = S.borrowed.find((x) => x.id === b.id && x.uid === cur.uid); return { label: `${S.done[b.id] ? '✓ ' : ''}${esc(b.title)}`, sub: `${esc(b.author)} · ${subjectName(b.subject)} · ${fl(i)}층${out ? ' · 내가 빌린 책' : ''}`, act: () => { const w = locate(cur, T.zone, b.id, i); if (!w || !w.F) { g.ui.toast('지금은 서가에 꽂혀 있지 않아요', { kind: 'muted' }); return; } g.guide.to({ floor: w.floor, gx: w.F.ax, gz: w.F.az, label: `「${b.title}」 — ${subjectName(w.subject)} 서가 ${slotName(w.si, w.F)}` }); this.close(); } }; }),
      ...(list.length > shown.length ? [{ head: `… ${list.length - shown.length}가지 더 — 분류를 고르거나 더 좁혀 찾아요` }] : []),
    ]);
    const body = this.wrap.querySelector('.os-body'), inp = body.querySelector('input');
    const go = () => this._v_catalog({ ...ctx, q: inp.value.trim(), sub: null });
    body.querySelector('[data-go]').addEventListener('click', (e) => { e.stopPropagation(); go(); });
    inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') go(); });
    body.querySelectorAll('[data-sub]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); this._v_catalog({ ...ctx, q: '', sub: b.dataset.sub }); }));
  }
}
export { FIX };
