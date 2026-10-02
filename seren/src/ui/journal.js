// 일지: 이야기 · 가방 · 단어 · 들은 말 · 메아리 · 도감 · 기록
import { QUESTS, ECHOES, CODEX, LINES } from '../data/story.js';
import { WORDS, WORD } from '../data/lexicon.js';
import { glyphSVG } from '../game/language.js';
import { NOTE_COLORS } from '../core/audio.js';
import { ITEMS, BUFFS, BAG_ORDER } from '../data/venues.js';

const TABS = [['quests', '이야기'], ['bag', '가방'], ['words', '단어'], ['heard', '들은 말'], ['echoes', '메아리'], ['codex', '도감'], ['log', '기록']];

export class Journal {
  constructor(game) { this.game = game; this.tab = 'quests'; }

  render(body) {
    const nav = document.createElement('div');
    nav.className = 'seg';
    nav.style.marginBottom = '14px';
    for (const [k, l] of TABS) {
      const b = document.createElement('button');
      b.textContent = l;
      b.className = k === this.tab ? 'on' : '';
      b.addEventListener('click', () => { this.tab = k; body.innerHTML = ''; this.render(body); });
      nav.appendChild(b);
    }
    body.appendChild(nav);
    const c = document.createElement('div');
    body.appendChild(c);
    this['_' + this.tab](c);
  }

  _quests(c) {
    const g = this.game, s = g.state.quests;
    let h = '<div class="section-title">진행 중</div>';
    if (!s.active.length) h += '<p style="color:var(--ink-dim)">지금은 따라갈 이야기가 없어요. 세렌을 자유롭게 돌아다녀 보세요.</p>';
    for (const id of s.active) {
      const q = QUESTS[id];
      const st = g.quests.step(id);
      h += `<div class="qitem"><div class="qt">${q.title}${q.kind === 'main' ? '' : ' <small style="color:var(--teal)">부탁</small>'}</div><div class="qs">${st ? st.text : ''}</div></div>`;
    }
    for (const r of g.requests ? g.requests.active : []) h += `<div class="qitem"><div class="qt">${r.title} <small style="color:var(--teal)">부탁</small></div><div class="qs">${r.text}</div></div>`;
    if (s.done.length) {
      h += '<div class="section-title">지나온 이야기</div>';
      for (const id of [...s.done].reverse()) h += `<div class="qitem done"><div class="qt">${QUESTS[id].title}</div></div>`;
    }
    c.innerHTML = h;
  }

  _words(c) {
    const g = this.game;
    const n = g.lang.knownCount;
    let h = `<p style="color:var(--ink-dim);margin-top:0">아는 단어 ${n} / ${WORDS.length} — 글자의 점 높이는 음의 높이예요. 단어를 누르면 소리를 들을 수 있어요.</p><div class="words">`;
    for (const w of WORDS) {
      const lv = g.lang.level(w.id);
      h += `<div class="word ${lv === 0 ? 'unknown' : lv === 1 ? 'guess' : ''}" data-w="${w.id}">${glyphSVG(w.id, 34)}<div class="w">${lv ? w.ko + (lv === 1 ? '?' : '') : '?'}</div></div>`;
    }
    c.innerHTML = h + '</div>';
    c.querySelectorAll('.word').forEach((el) => el.addEventListener('click', () => g.audio.sing(WORD[el.dataset.w].notes, { gain: 0.35 })));
  }

  _heard(c) {
    const g = this.game;
    const list = [...g.state.heard].reverse();
    let h = `<p style="color:var(--ink-dim);margin-top:0">아웬에게 들은 말 ${list.length}개. 단어를 알수록 예전 말의 뜻이 드러나요. 누르면 다시 들을 수 있어요.</p>`;
    for (const e of list) {
      const line = g.lines[e.id];
      if (!line) continue;
      const und = g.lang.isUnderstood(line);
      h += `<div class="heard ${und ? 'understood' : ''}" data-id="${e.id}"><div class="line">${g.lang.render(line)}</div><div class="meta">${und ? '이해함' : '아직 모르는 단어가 있어요'}</div></div>`;
    }
    c.innerHTML = h;
    c.querySelectorAll('.heard').forEach((el) => el.addEventListener('click', () => {
      const line = g.lines[el.dataset.id];
      if (line) g.audio.sing(g.lang.notesOf(line), { gain: 0.32 });
    }));
  }

  _echoes(c) {
    const g = this.game;
    const got = ECHOES.filter((e) => g.state.echoes[e.id]);
    let h = `<p style="color:var(--ink-dim);margin-top:0">찾은 메아리 ${got.length} / ${ECHOES.length}. 일렁이는 빛 앞에서 「열림」을 연주하면 옛 기억이 열려요.</p>`;
    for (const e of ECHOES) {
      if (g.state.echoes[e.id]) h += `<div class="qitem"><div class="qt">${e.title}</div><div class="qs" style="font-family:var(--serif);font-size:14px;line-height:1.8;color:var(--ink)">${e.text}</div></div>`;
      else h += `<div class="qitem done"><div class="qt">· · ·</div></div>`;
    }
    c.innerHTML = h;
  }

  _codex(c) {
    const g = this.game;
    let h = '<div class="codex">';
    for (const [id, e] of Object.entries(CODEX)) {
      const k = g.state.codex[id];
      h += `<div class="c ${k ? '' : 'locked'}"><h4>${k ? e.name : '???'} <small style="color:var(--ink-faint);font-size:11px">${e.cat}</small></h4><p>${k ? e.text : '아직 가까이서 보지 못했어요.'}</p></div>`;
    }
    c.innerHTML = h + '</div>';
  }

  /** 가방: 가진 물건과 쓰기 (먹기·지도 결정·기록 읽기), 몸의 기운, 맡은 일 */
  _bag(c) {
    const g = this.game, inv = g.state.inv, V = g.state.venue || {};
    let h = '<div class="section-title">가진 것</div><div class="bag">';
    let any = false;
    for (const id of BAG_ORDER) {
      const n = inv[id] || 0;
      if (!n && id !== 'starseed') continue;
      any = true;
      const I = ITEMS[id];
      const can = I.use === 'eat' || I.use === 'map' || I.use === 'read';
      h += `<div class="bag-item"><span class="ic">${I.icon}</span><div class="tx"><b>${I.name} <small>× ${n}</small></b><small>${I.tag} · ${I.desc}</small></div>${can && n ? `<button class="btn" data-use="${id}">${I.use === 'eat' ? '먹기' : I.use === 'read' ? '읽기' : '쓰기'}</button>` : ''}</div>`;
    }
    h += '</div>';
    if (!any) h += '<p class="muted">아직 아무것도 없어요.</p>';
    const bs = Object.entries(V.buffs || {});
    if (bs.length) h += `<div class="section-title">몸의 기운</div>${bs.map(([id, t]) => `<p>${BUFFS[id].name} · ${Math.floor(t / 60)}분 ${Math.floor(t % 60)}초 남음</p>`).join('')}`;
    if (V.job) h += `<div class="section-title">맡은 일</div><p>${V.job.label} · 별씨 ${V.job.reward}</p>`;
    h += `<div class="section-title">도시에서</div><p>일해서 번 별씨 ${V.earned || 0} · 쓴 별씨 ${V.spent || 0} · 본 전시 ${Object.keys(V.exhibits || {}).length} · 읽은 기록 ${Object.keys(V.archives || {}).length}</p>`;
    h += '<p class="muted">별씨는 공방(생산 줄)·창고(짐 나누기·배달)·발전소(출력 맞추기)·사무탑(일거리), 그리고 바깥 조작대(설비 점검·짐 드론 관제·코일 조율·주민 부탁함)에서 벌고, 가게·찻집·터미널·하늘배에서 써요.</p>';
    c.innerHTML = h;
    c.querySelectorAll('[data-use]').forEach((b) => b.addEventListener('click', () => { g.venues.useItem(b.dataset.use); const body = c.parentElement; body.innerHTML = ''; this.render(body); }));
  }

  _log(c) {
    const g = this.game, s = g.state;
    const hrs = Math.floor(s.playTime / 3600), mins = Math.floor((s.playTime % 3600) / 60);
    const km = (s.stats.distance / 1000).toFixed(1);
    const stats = [
      ['여정 시간', `${hrs ? hrs + '시간 ' : ''}${mins}분`],
      ['걸어온 거리', `${km} km`],
      ['활공한 거리', `${(s.stats.glideDistance / 1000).toFixed(1)} km`],
      ['세렌의 날', `${g.world.clock.day + 1}일째`],
      ['연주한 음', s.stats.tones],
      ['해류 탑승', s.stats.currentRides],
      ['깨운 탑', `${Object.keys(s.pylons).length} / 5`],
      ['찾은 장소', Object.keys(s.discovered).length],
      ['별씨', s.inv.starseed],
      ['아는 단어', g.lang.knownCount],
      ['다음 일식까지', `${g.world.clock.daysToEclipse().toFixed(1)}일`],
    ];
    let h = '<div class="stats">' + stats.map(([l, v]) => `<div class="stat"><div class="v">${v}</div><div class="l">${l}</div></div>`).join('') + '</div>';
    if (s.nameSong) {
      h += `<div class="section-title">나의 노래</div><div class="seg" id="ns">${s.nameSong.map((n) => `<span style="display:inline-block;width:18px;height:18px;border-radius:50%;background:#${NOTE_COLORS[n].toString(16).padStart(6, '0')};margin-right:6px"></span>`).join('')}</div>`;
    }
    h += '<div class="section-title">모아의 기록</div>';
    for (const j of [...s.journal].slice(-30).reverse()) h += `<div class="heard"><div class="line" style="font-size:14px">${j}</div></div>`;
    c.innerHTML = h;
    const ns = c.querySelector('#ns');
    if (ns) ns.addEventListener('click', () => s.nameSong.forEach((n, i) => g.audio.tone(n, { delay: i * 0.5, gain: 0.4 })));
  }
}

export { LINES };
