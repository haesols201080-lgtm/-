// 퀘스트 창 (v24 「퀘스트 시스템: 메인/사이드 유형 도입 + 전용 퀘스트 창」 · 「목표 방향과 안내 흐름에서 빠져나오는 방법」):
//  위쪽 탭 메인 / 사이드 / 지난 일 → 목록(이름 · 짧은 설명 · 지금 목표 · 관련 대상 · 상태) → 고르면 세부 단계(마친 ✓ · 지금 ▶ · 남은 수)
//  추적: 고른 퀘스트 「추적」 · 「추적 끄기」(목표 칸·표식 없음 — 정상 상태) · 「자동」(메인 먼저). 사이드는 「보류」/「이어 가기」.
//  오늘의 부탁(requests)도 사이드 탭에서 추적할 수 있다. 데이터는 story.js QUESTS(유형·설명·시작 조건) + 저장 슬롯의 state.quests.
import { QUESTS } from '../data/story.js';
import { questType } from '../game/quests.js';

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const ST = { active: '진행 중', held: '보류', done: '마침', failed: '놓침' };

export class QuestLog {
  constructor(game) { this.game = game; this.tab = 'main'; this.sel = null; }

  render(body) {
    const g = this.game, Q = g.quests, s = g.state.quests;
    const all = Object.keys(QUESTS).filter((id) => Q.status(id));
    const lists = {
      main: all.filter((id) => questType(QUESTS[id]) === 'main' && Q.status(id) === 'active'),
      side: all.filter((id) => questType(QUESTS[id]) === 'side' && (Q.status(id) === 'active' || Q.status(id) === 'held')),
      past: all.filter((id) => Q.status(id) === 'done' || Q.status(id) === 'failed').sort((a, b) => ((s.log[b] || {}).end || 0) - ((s.log[a] || {}).end || 0)),
    };
    const reqs = (g.requests && g.requests.active) || [];
    const tracked = Q.tracked(), mode = s.tracked === 'none' ? 'none' : s.tracked === 'req' ? 'req' : s.tracked ? 'pick' : 'auto';
    if (!this.sel || !all.includes(this.sel)) this.sel = (lists[this.tab] || [])[0] || null;
    const el = document.createElement('div');
    el.className = 'qlog';
    const trackLine = mode === 'none' ? '추적 꺼짐 — 목표 칸과 나침반 표식이 없어요.'
      : mode === 'req' ? `추적 중 · 부탁 「${esc(reqs[0] ? reqs[0].title : '')}」`
        : tracked ? `추적 중 · ${esc(QUESTS[tracked].title)}${mode === 'auto' ? ' (자동 — 메인 먼저)' : ''}` : '추적할 퀘스트가 없어요.';
    el.innerHTML = `
      <div class="ql-top">
        <div class="seg ql-tabs">
          <button data-tab="main" class="${this.tab === 'main' ? 'on' : ''}">메인 퀘스트 <b>${lists.main.length}</b></button>
          <button data-tab="side" class="${this.tab === 'side' ? 'on' : ''}">사이드 퀘스트 <b>${lists.side.length + reqs.length}</b></button>
          <button data-tab="past" class="${this.tab === 'past' ? 'on' : ''}">지난 일 <b>${lists.past.length}</b></button>
        </div>
        <div class="ql-track"><span>${trackLine}</span>
          ${mode !== 'none' ? '<button class="btn" data-off>추적 끄기</button>' : ''}${mode !== 'auto' ? '<button class="btn" data-auto>자동 추적</button>' : ''}</div>
        <p class="ql-help">퀘스트를 골라 「추적」하면 그 목표만 화면 위 목표 칸·나침반·지도에 보여요. 「추적 끄기」를 누르면 안내가 모두 사라지고, 언제든 여기서 다시 고를 수 있어요. (J · 목표 칸 누르기)</p>
      </div>
      <div class="ql-body"><div class="ql-list"></div><div class="ql-detail"></div></div>`;
    const listEl = el.querySelector('.ql-list'), detEl = el.querySelector('.ql-detail');
    const ids = lists[this.tab] || [];
    if (this.tab === 'side' && reqs.length) {
      for (const r of reqs) {
        const on = mode === 'req';
        const it = document.createElement('div');
        it.className = 'ql-item req' + (on ? ' tracked' : '');
        it.innerHTML = `<div class="qt">${esc(r.title)} <small class="ql-chip side">오늘의 부탁</small>${on ? ' <small class="ql-chip on">추적 중</small>' : ''}</div><div class="qs">${esc(r.text)}</div>
          <div class="ql-act">${on ? '<button class="btn" data-untrack>추적 끄기</button>' : '<button class="btn primary" data-treq>추적</button>'}</div>`;
        it.querySelector('[data-treq]')?.addEventListener('click', () => { Q.track('req'); this._redraw(body); });
        it.querySelector('[data-untrack]')?.addEventListener('click', () => { Q.untrack(); this._redraw(body); });
        listEl.appendChild(it);
      }
    }
    if (!ids.length && !(this.tab === 'side' && reqs.length)) listEl.innerHTML += `<p class="ql-empty">${this.tab === 'main' ? '지금 따라가는 메인 퀘스트가 없어요.' : this.tab === 'side' ? '아직 열린 사이드 퀘스트가 없어요. 세렌을 돌아다니고 이웃과 이야기하면 새 일이 생겨요.' : '아직 마친 퀘스트가 없어요.'}</p>`;
    for (const id of ids) {
      const q = QUESTS[id], st = Q.status(id), step = Q.step(id);
      const it = document.createElement('div');
      it.className = 'ql-item' + (id === this.sel ? ' sel' : '') + (id === tracked && mode !== 'req' ? ' tracked' : '');
      it.innerHTML = `<div class="qt">${esc(q.title)} <small class="ql-chip ${questType(q)}">${questType(q) === 'main' ? '메인' : '사이드'}</small>${id === tracked && mode !== 'req' ? ' <small class="ql-chip on">추적 중</small>' : ''}${st !== 'active' ? ` <small class="ql-chip st-${st}">${ST[st]}</small>` : ''}</div>
        <div class="qs">${esc(st === 'active' || st === 'held' ? (step ? step.text : '') : q.desc)}</div>
        ${Q.related(id) && (st === 'active' || st === 'held') ? `<div class="qr">관련: ${esc(Q.related(id))}</div>` : ''}`;
      it.addEventListener('click', () => { this.sel = id; this._redraw(body); });
      listEl.appendChild(it);
    }
    if (this.sel && ids.includes(this.sel)) detEl.appendChild(this._detail(this.sel, body, tracked, mode));
    else detEl.innerHTML = '<p class="ql-empty">왼쪽에서 퀘스트를 고르면 세부 단계가 보여요.</p>';
    el.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { this.tab = b.dataset.tab; this.sel = null; this._redraw(body); }));
    el.querySelector('[data-off]')?.addEventListener('click', () => { Q.untrack(); this._redraw(body); });
    el.querySelector('[data-auto]')?.addEventListener('click', () => { Q.track(null); this._redraw(body); });
    body.appendChild(el);
  }

  _detail(id, body, tracked, mode) {
    const g = this.game, Q = g.quests, q = QUESTS[id], st = Q.status(id), s = g.state.quests;
    const cur = s.step[id] ?? 0, log = s.log[id] || {};
    const d = document.createElement('div');
    d.className = 'ql-det';
    let steps = '';
    q.steps.forEach((x, k) => {
      if (st === 'done' || k < cur) steps += `<li class="done"><i>✓</i>${esc(x.text)}</li>`;
      else if (k === cur && (st === 'active' || st === 'held')) steps += `<li class="now"><i>▶</i>${esc(x.text)}</li>`;
    });
    const left = st === 'active' || st === 'held' ? q.steps.length - cur - 1 : 0;
    if (left > 0) steps += `<li class="left"><i>·</i>남은 단계 ${left}개</li>`;
    const isT = id === tracked && mode !== 'req';
    const next = q.next && QUESTS[q.next] ? QUESTS[q.next].title : '';
    d.innerHTML = `<div class="ql-dt">${esc(q.title)} <small class="ql-chip ${questType(q)}">${questType(q) === 'main' ? '메인' : '사이드'}</small> <small class="ql-chip st-${st}">${ST[st]}</small></div>
      <p class="ql-desc">${esc(q.desc || '')}</p>
      ${Q.related(id) && (st === 'active' || st === 'held') ? `<div class="qr">관련 인물·장소: ${esc(Q.related(id))}</div>` : ''}
      <ol class="ql-steps">${steps}</ol>
      <div class="ql-meta">${q.reward && q.reward.starseed ? `보상 ${q.reward.starseed}울` : ''}${next ? `${q.reward ? ' · ' : ''}다음: ${st === 'done' ? esc(next) : '이어지는 이야기'}` : ''}${log.start != null ? ` · ${Math.floor(log.start) + 1}일째 시작` : ''}${log.end != null ? ` · ${Math.floor(log.end) + 1}일째 ${st === 'failed' ? '놓침' : '마침'}` : ''}${log.why ? ` (${esc(log.why)})` : ''}</div>
      <div class="ql-act">
        ${st === 'active' ? (isT ? '<button class="btn" data-untrack>추적 끄기</button>' : '<button class="btn primary" data-track>추적</button>') : ''}
        ${st === 'active' && questType(q) === 'side' ? '<button class="btn" data-hold>보류</button>' : ''}
        ${st === 'held' ? '<button class="btn primary" data-resume>이어 가기</button>' : ''}
      </div>`;
    d.querySelector('[data-track]')?.addEventListener('click', () => { Q.track(id); this._redraw(body); });
    d.querySelector('[data-untrack]')?.addEventListener('click', () => { Q.untrack(); this._redraw(body); });
    d.querySelector('[data-hold]')?.addEventListener('click', () => { Q.hold(id); this._redraw(body); });
    d.querySelector('[data-resume]')?.addEventListener('click', () => { Q.resume(id); this._redraw(body); });
    return d;
  }

  _redraw(body) { body.innerHTML = ''; this.render(body); this.game.save(); }
}
