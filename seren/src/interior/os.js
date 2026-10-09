// 기기별 UI와 울림 OS (v24 「범용 만능 UI 폐기」 · 「컴퓨터는 하나의 실제 OS로 구현」).
//  · 기기마다 쓰는 자리·목적에 맞는 화면 문법: 안내 빛판(층 안내·찾기만, 큰 글씨) · 공용 단말(건물·일자리 공고·내 지원 — 손으로 누르는 큰 칸)
//    · 산업 제어판(배차·분석 — 계기판) · 회의 탁자 · 찾기 단말(서고) · 컴퓨터(울림 OS).
//  · 울림 OS: 잠금/로그인(계정) → 바탕(앱 아이콘) → 창(열기·내리기·닫기·작업 줄에서 바꾸기) · 알림 · 로그아웃.
//    앱: 메일 · 파일(폴더) · 일정 · 찾기 · 설정 + 계정·조직 권한에 따라 내 일 · 일자리 · 업무 · 장부 · 건물 안내.
//    개인 PC(내 자리) = 내 계정의 파일·메일·설정 · 공용 PC(서고·학교·관청 단말) = 손님 계정으로 제한된 앱만 · 남의 자리 = 그 주민의 계정이라 잠김.
//  · 데이터는 모두 저장 슬롯(state.os: 메일·설정, 나머지는 실제 상태 — 지원서·일·은행 원장·빌린 책)에서 온다.
import { hashStr, mulberry32 } from '../core/noise.js';
import { won } from '../data/money.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hh = (t) => { const m = Math.round((t % 1) * 24 * 60); return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`; };
const SYL = ['아', '이', '세', '라', '누', '모', '하', '린', '솔', '온', '미', '루', '엘', '나', '야', '오', '레', '우', '빈', '도'];
/** 자리 주인의 이름 (자리마다 늘 같은 아웬 이름) */
export function deskOwner(id) { const r = mulberry32(hashStr(String(id))); return SYL[Math.floor(r() * SYL.length)] + SYL[Math.floor(r() * SYL.length)]; }

/** 공용 PC 를 두는 쓰임 (서고·학교·관청) — 그 밖의 「울림판 단말」은 공용 단말(키오스크) */
const PUBLIC_PC = new Set(['library', 'school', 'admin']);
const WALLS = [['물결', '#123a4a', '#0a1a2c'], ['노을', '#4a2438', '#1c0e1e'], ['숲', '#1d3d2c', '#0b1a14'], ['밤하늘', '#1a1d4a', '#07081c']];

/**
 * 기기 고르기: (앱 이름, 맥락) → { kind, title, sub, tabs }
 *  kind: board 안내 빛판 · kiosk 공용 단말 · catalog 서고 찾기 단말 · console 산업 제어판 · table 회의 탁자 · computer 울림 OS
 */
export function deviceOf(name, ctx = {}, cur = null) {
  const tag = ctx.F && ctx.F.tag;
  const use = cur && cur.B ? (cur.B.pid || cur.B.use) : '';
  if (name === 'work' || tag === 'desk') return { kind: 'computer', pc: 'desk', title: '울림 OS', sub: '자리 컴퓨터' };
  if (tag === 'terminal' && PUBLIC_PC.has(use) && (name === 'home' || name === 'jobs' || name === 'mine')) return { kind: 'computer', pc: 'public', title: '울림 OS', sub: '공용 컴퓨터' };
  if (name === 'directory' || name === 'floor' || tag === 'directory' || tag === 'reception') return { kind: 'board', title: tag === 'reception' ? '안내대' : '안내 빛판', sub: '층 안내 · 찾기', tabs: [] };
  if (name === 'catalog') return { kind: 'catalog', title: '서고 찾기 단말', sub: '책 찾기', tabs: [] };
  if (name === 'dispatch' || name === 'analysis') return { kind: 'console', title: name === 'dispatch' ? '배차 제어판' : '분석 제어판', sub: name === 'dispatch' ? '짐 흐름' : '측정 자료', tabs: [] };
  if (name === 'meeting') return { kind: 'table', title: '회의 탁자', sub: '함께 보는 화면', tabs: [] };
  return { kind: 'kiosk', title: '공용 단말', sub: '건물 · 일자리 공고 · 내 지원', tabs: [['home', '건물'], ['jobs', '일자리 공고'], ['mine', '내 지원']] };
}

export class SerenOS {
  constructor(apps) { this.apps = apps; this.wins = []; this.active = -1; this.user = null; }
  get game() { return this.apps.game; }
  get st() { const s = this.game.state; return s.os || (s.os = { mail: [], prefs: {}, seq: 0 }); }

  /** 이 컴퓨터를 켠다 (apps.open 에서): 어떤 계정이 들어갈 수 있는지 정하고 잠금 화면 */
  boot(ctx, dev, wrap) {
    const ops = this.apps.ops, job = ops.myJobHere(), T = ctx.T;
    const mine = dev.pc === 'desk' && job && T && job.k === T.k;
    this.pc = { kind: dev.pc, mine, owner: dev.pc === 'desk' && !mine ? deskOwner(ctx.F ? ctx.F.id ?? `${ctx.F.x},${ctx.F.z}` : 'desk') : null, org: T && T.org ? T.org.name : this.game.interiors.title(this.apps.cur.r), member: !!job, job, want: ctx.app ? 'work' : null };
    this.wrap = wrap; this.wins = []; this.active = -1; this.user = null;
    this._frame();
    // 내 자리: 이미 내 계정 → 바로 바탕으로 (일하러 왔으면 업무 창)
    if (this.pc.mine) { this.login('me'); if (this.pc.want || this.apps.S.shift) this.openApp('work'); }
    else this.lock();
  }
  _frame() {
    const p = this.prefs();
    const W = WALLS[p.wall || 0];
    this.wrap.querySelector('.term-screen').innerHTML = `<div class="os2" style="--os:${this._col()};--w1:${W[1]};--w2:${W[2]}">
      <div class="os2-top"><b>울림 OS</b><span class="os2-who"></span><span class="os2-clock">${hh(this.game.world.clock.time)}</span><button class="os2-x" data-off title="끄기">끄기</button></div>
      <div class="os2-screen"><div class="os2-desk"></div><div class="os2-win hidden"><div class="os2-wt"><b></b><span><button data-min title="내리기">–</button><button data-close title="닫기">×</button></span></div><div class="os-body"></div></div></div>
      <div class="os2-bar"></div></div>`;
    const W2 = this.wrap;
    W2.querySelector('[data-off]').addEventListener('click', (e) => { e.stopPropagation(); this.apps.close(); });
    W2.querySelector('[data-min]').addEventListener('click', (e) => { e.stopPropagation(); this.active = -1; this._draw(); });
    W2.querySelector('[data-close]').addEventListener('click', (e) => { e.stopPropagation(); this.wins.splice(this.active, 1); this.active = -1; this._draw(); });
  }
  _col() { const st = (this.apps.T && this.apps.T.Z && this.apps.T.Z.style) || {}; return '#' + ((st.glow ?? 0x7ff3e6) >>> 0).toString(16).padStart(6, '0'); }
  prefs(acct = this.user || 'me') { const P = this.st.prefs; return P[acct] || (P[acct] = { wall: 0, notify: true }); }

  // ── 잠금 · 로그인 ──
  lock() {
    this.user = null; this.wins = []; this.active = -1;
    const pc = this.pc, desk = this.wrap.querySelector('.os2-desk');
    this.wrap.querySelector('.os2-win').classList.add('hidden');
    this.wrap.querySelector('.os2-who').textContent = '잠김';
    this.wrap.querySelector('.os2-bar').innerHTML = '';
    let h = `<div class="os2-lock"><div class="os2-lt">${esc(pc.org)}</div><div class="os2-lc">${hh(this.game.world.clock.time)}</div>`;
    if (pc.kind === 'public') h += `<p>공용 컴퓨터예요. 손님으로 들어가면 찾기·건물 안내·일자리 공고를 쓸 수 있어요. 개인 파일·메일은 내 자리 컴퓨터에서.</p><button class="btn primary" data-acct="guest">손님으로 들어가기</button>`;
    else if (pc.owner) h += `<div class="os2-av">${esc(pc.owner.slice(0, 1))}</div><p><b>${esc(pc.owner)}</b> 님의 자리 컴퓨터 — 잠겨 있어요.<br>이 자리의 주인만 들어갈 수 있어요. 내 일은 내 자리에서, 공용 기능은 공용 단말에서.</p>`;
    else h += `<p>이 자리는 아직 내 자리가 아니에요. 이 조직에 채용되면 내 계정으로 들어갈 수 있어요.</p>`;
    desk.innerHTML = h + '</div>';
    desk.querySelector('[data-acct]')?.addEventListener('click', (e) => { e.stopPropagation(); this.login(e.currentTarget.dataset.acct); });
  }
  login(acct) {
    this.user = acct;
    this.game.audio.blip && this.game.audio.blip({ hz: 520, to: 1040, dur: 0.2, gain: 0.05, bus: 'ui' });
    const p = this.prefs(), W = WALLS[p.wall || 0], el = this.wrap.querySelector('.os2');
    el.style.setProperty('--w1', W[1]); el.style.setProperty('--w2', W[2]);
    this._draw();
  }
  logout() { this.game.audio.blip && this.game.audio.blip({ hz: 880, to: 440, dur: 0.18, gain: 0.04, bus: 'ui' }); this.lock(); }

  /** 계정·조직 권한에 따른 앱 */
  appList() {
    const pc = this.pc, me = this.user === 'me', g = this.game;
    const L = [];
    if (me) L.push(['mail', '메일', '✉'], ['files', '파일', '▤'], ['cal', '일정', '◷']);
    L.push(['search', '찾기', '⌕']);
    if (me) L.push(['mine', '내 일', '◈']);
    L.push(['jobs', this.user === 'guest' ? '일자리 공고' : '일자리', '✦'], ['directory', '건물 안내', '▦']);
    if (me && pc.mine) L.push(['work', '업무', '⚙'], ['econ', '장부', '◫']);
    if (me) L.push(['settings', '설정', '☼']);
    void g;
    return L;
  }
  unread() { return this.st.mail.filter((m) => !m.read).length; }

  _draw() {
    const W = this.wrap;
    W.querySelector('.os2-who').textContent = this.user === 'guest' ? '손님' : `나 · ${this.pc.org}`;
    W.querySelector('.os2-clock').textContent = hh(this.game.world.clock.time);
    const desk = W.querySelector('.os2-desk'), win = W.querySelector('.os2-win');
    const apps = this.appList();
    desk.innerHTML = `<div class="os2-icons">${apps.map(([k, l, ic]) => `<button class="os2-ic" data-app="${k}"><i>${ic}</i><span>${l}${k === 'mail' && this.unread() ? ` <em>${this.unread()}</em>` : ''}</span></button>`).join('')}</div>`;
    desk.querySelectorAll('[data-app]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); this.openApp(b.dataset.app); }));
    const bar = W.querySelector('.os2-bar');
    const notes = this.notices();
    bar.innerHTML = `<button class="os2-start${this.active < 0 ? ' on' : ''}" data-home title="바탕">◎</button>${this.wins.map((w, k) => `<button class="os2-tb${k === this.active ? ' on' : ''}" data-w="${k}">${esc(w.title)}</button>`).join('')}<span class="sp"></span>${this.user === 'me' ? `<button class="os2-bell" data-bell>알림 ${notes.length}</button>` : ''}<button class="os2-out" data-out>로그아웃</button>`;
    bar.querySelector('[data-home]').addEventListener('click', (e) => { e.stopPropagation(); this.active = -1; this._draw(); });
    bar.querySelectorAll('[data-w]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); this.active = +b.dataset.w; this._draw(); }));
    bar.querySelector('[data-out]').addEventListener('click', (e) => { e.stopPropagation(); this.logout(); });
    bar.querySelector('[data-bell]')?.addEventListener('click', (e) => { e.stopPropagation(); this.openApp('notices'); });
    if (this.active < 0) { win.classList.add('hidden'); desk.classList.remove('hidden'); return; }
    const w = this.wins[this.active];
    desk.classList.add('hidden'); win.classList.remove('hidden');
    win.querySelector('.os2-wt b').textContent = w.title;
    this.apps.show(w.app);
  }
  openApp(app) {
    if (!this.user) return;
    const t = (this.appList().find((a) => a[0] === app) || [app, app === 'notices' ? '알림' : app])[1];
    let k = this.wins.findIndex((w) => w.app === app);
    if (k < 0) { this.wins.push({ app, title: t }); k = this.wins.length - 1; }
    this.active = k;
    this._draw();
  }

  // ── 알림 (읽지 않은 메일 + 오늘 일정) ──
  notices() {
    const out = [];
    for (const m of this.st.mail) if (!m.read) out.push({ kind: 'mail', label: `새 메일 · ${m.subj}`, sub: m.from, m });
    for (const e of this.calendar()) if (e.soon) out.push({ kind: 'cal', label: e.label, sub: e.sub });
    return out;
  }
  /** 일정: 일의 교대 시간 · 면접 · 책 돌려줄 날 · 의료 부채 (모두 실제 상태에서) */
  calendar() {
    const g = this.game, S = this.apps.S, now = g.world.clock.time, day = g.world.clock.day, out = [];
    for (const j of S.jobs) { const t = now % 1; const on = t >= j.hours[0] && t <= j.hours[1]; out.push({ when: j.hours[0], label: `${on ? '지금 교대 시간' : '교대'} · ${j.title}`, sub: `${j.bname} · 날마다 ${hh(j.hours[0])}~${hh(j.hours[1])}`, soon: on && !(S.shift && S.shift.uid === j.uid) }); }
    for (const a of S.apps) if (a.status === 'interview') out.push({ when: a.t, label: `면접 · ${a.title}`, sub: `${a.bname} 채용 면접실 · ${Math.max(0, Math.ceil(2 - (now - a.t)))}일 안에`, soon: true });
    const lib = g.state.lib;
    for (const b of (lib && lib.borrowed) || []) { const left = b.day + 7 - day; out.push({ when: b.day + 7, label: `책 돌려주기 · 「${b.title}」`, sub: left >= 0 ? `${left}일 남음 · 아무 서고 대출대` : `${-left}일 지남`, soon: left <= 1 }); }
    const B = g.state.bank;
    if (B && B.debt > 0) out.push({ when: 99, label: `의료 부채 ${won(B.debt)}`, sub: '은행 창구·단말에서 갚을 수 있어요', soon: false });
    return out;
  }

  // ── 앱 몸통 (apps._render 로 지금 창의 .os-body 에 그린다) ──
  v_mail(ctx = {}) {
    const A = this.apps, M = this.st.mail;
    if (ctx.open != null) {
      const m = M.find((x) => x.n === ctx.open);
      if (m) { m.read = true; A._render(esc(m.subj), `${esc(m.from)} · ${Math.floor(m.day) + 1}일째 ${hh(m.day)}`, [{ html: `<div class="os2-doc">${m.body.split('\n').map((l) => `<p>${esc(l)}</p>`).join('')}</div>` }, { label: '← 받은 편지함', act: () => this.v_mail({}) }]); return; }
    }
    const rows = [{ head: `받은 편지함 (${M.length})` }];
    for (const m of [...M].reverse().slice(0, 40)) rows.push({ label: `${m.read ? '' : '● '}${esc(m.subj)}`, sub: `${esc(m.from)} · ${Math.floor(m.day) + 1}일째`, act: () => this.v_mail({ open: m.n }) });
    if (!M.length) rows.push({ label: '아직 받은 메일이 없어요', sub: '일자리에 지원하거나 채용되면 회사에서 메일이 와요' });
    A._render('메일', '', rows);
  }
  v_files(ctx = {}) {
    const A = this.apps, g = this.game, S = A.S;
    const folders = {
      '지원서': S.apps.map((a) => ({ name: `${a.title} · ${a.org}`, meta: { applied: '지원함', interview: '면접 안내', rejected: '불합격', done: '채용됨' }[a.status] || a.status, body: `지원한 일: ${a.title}\n조직: ${a.org} (${a.bname})\n품삯: 시간당 ${a.wage}\n시간: ${hh(a.hours[0])}~${hh(a.hours[1])}\n상태: ${{ applied: '면접 안내를 기다리는 중', interview: '면접 안내 받음', rejected: '이번에는 함께하지 못함', done: '채용됨' }[a.status] || a.status}` })),
      '근무 기록': S.jobs.map((j) => ({ name: `${j.title} · ${j.org}`, meta: `${(j.worked || 0).toFixed(1)}시간`, body: `${j.org} — ${j.title}\n일한 시간: ${(j.worked || 0).toFixed(1)}시간\n평가: ${'★'.repeat(j.rating || 3)}\n시간당 품삯: ${j.wage}` })),
      '영수증': ((g.state.bank && g.state.bank.ledger) || []).slice(-20).reverse().map((e) => ({ name: `${e.memo || e.kind}`, meta: `${Math.floor(e.day) + 1}일째`, body: `${e.where ? `${e.where}\n` : ''}${e.memo || e.kind}\n금액: ${won(e.total ?? Math.abs(e.amt))}\n계좌 잔액: ${won(e.bal)} · 의료 부채: ${won(e.debt)}` })),
      '빌린 책': (((g.state.lib && g.state.lib.borrowed) || [])).map((b) => ({ name: `「${b.title}」`, meta: `${b.day + 1}일째 빌림`, body: `「${b.title}」\n빌린 날: ${b.day + 1}일째\n돌려줄 날: ${b.day + 8}일째까지 (아무 서고 대출대)` })),
    };
    if (ctx.folder && ctx.file != null) {
      const f = folders[ctx.folder][ctx.file];
      A._render(esc(f.name), `${esc(ctx.folder)} · ${esc(f.meta)}`, [{ html: `<div class="os2-doc">${f.body.split('\n').map((l) => `<p>${esc(l)}</p>`).join('')}</div>` }, { label: `← ${esc(ctx.folder)}`, act: () => this.v_files({ folder: ctx.folder }) }]);
      return;
    }
    if (ctx.folder) {
      const list = folders[ctx.folder] || [];
      const rows = list.map((f, k) => ({ label: esc(f.name), sub: esc(f.meta), act: () => this.v_files({ folder: ctx.folder, file: k }) }));
      if (!list.length) rows.push({ label: '빈 폴더' });
      rows.push({ label: '← 모든 폴더', act: () => this.v_files({}) });
      A._render(`파일 · ${esc(ctx.folder)}`, '', rows);
      return;
    }
    A._render('파일', '내 계정의 폴더 — 모두 실제 기록에서 만들어져요.', Object.entries(folders).map(([k, v]) => ({ label: `▤ ${k}`, sub: `${v.length}개`, act: () => this.v_files({ folder: k }) })));
  }
  v_cal() {
    const A = this.apps, list = this.calendar();
    const rows = list.length ? list.map((e) => ({ label: `${e.soon ? '● ' : ''}${esc(e.label)}`, sub: esc(e.sub) })) : [{ label: '잡힌 일정이 없어요' }];
    A._render('일정', `${this.game.world.clock.day + 1}일째 · ${hh(this.game.world.clock.time)}`, rows);
  }
  v_notices() {
    const A = this.apps, list = this.notices();
    const rows = list.map((n) => ({ label: esc(n.label), sub: esc(n.sub), act: n.m ? () => { this.openApp('mail'); this.v_mail({ open: n.m.n }); } : null }));
    if (!list.length) rows.push({ label: '새 알림이 없어요' });
    if (!this.prefs().notify) rows.unshift({ label: '알림 끔', sub: '설정에서 켤 수 있어요' });
    A._render('알림', '', rows);
  }
  v_search(ctx = {}) { this.apps._v_directory(ctx); }
  v_settings() {
    const A = this.apps, p = this.prefs();
    const rows = [{ head: '바탕 색' }];
    WALLS.forEach(([n], k) => rows.push({ label: `${k === (p.wall || 0) ? '● ' : ''}${n}`, act: () => { p.wall = k; const el = this.wrap.querySelector('.os2'); el.style.setProperty('--w1', WALLS[k][1]); el.style.setProperty('--w2', WALLS[k][2]); this.v_settings(); } }));
    rows.push({ head: '알림' }, { label: p.notify ? '알림 켬 · 눌러서 끄기' : '알림 끔 · 눌러서 켜기', act: () => { p.notify = !p.notify; this.v_settings(); } });
    rows.push({ head: '계정' }, { label: '로그아웃', act: () => this.logout() });
    A._render('설정', '이 계정의 설정은 저장 슬롯에 남아요 (다른 컴퓨터에서 들어가도 같아요).', rows);
  }
}

/** 메일 보내기 (회사·은행·병원 → 내 계정의 받은 편지함) — 같은 key 는 한 번만 */
export function osMail(game, { from, subj, body, key = null }) {
  const s = game.state, st = s.os || (s.os = { mail: [], prefs: {}, seq: 0 });
  if (key && st.mail.some((m) => m.key === key)) return;
  const c = game.world && game.world.clock;
  st.seq = (st.seq || 0) + 1;
  st.mail.push({ n: st.seq, day: c ? c.day + (c.time % 1) : 0, from, subj, body, read: false, key });
  if (st.mail.length > 120) st.mail.splice(0, st.mail.length - 120);
  const p = (st.prefs.me || { notify: true });
  if (p.notify !== false && game.ui) game.ui.toast(`새 메일 · ${subj}`, { sub: `${from} — 자리 컴퓨터의 메일에서` });
}
