// 손으로 하는 작업대들 (v24 「기기별 UI」) — 범용 카드 대신 그 일의 앞면:
//  · labBench: 연구동 실험대 — 시료 유리병(눌러서 울림 듣기)과 아는 음의 소리굽쇠(눌러서 비교), 답은 소리굽쇠를 병에 대거나 「같다/다르다」 도장.
//  · sorter: 물류 창고 분류대 — 벨트 위로 짐이 오고(빛 띠 색), 색 칸 세 개의 슈트 중 하나를 당긴다. 늦으면 짐이 벨트 끝으로 떨어진다.
//  · reactor: 발전소·코일 탑 조종대 — 큰 가로 계기(가운데 녹색 띠)와 두 손잡이(▲▼). 바늘이 물결치고 손잡이로 띠 안에 붙잡는다.
//  · scoreStand: 공연장 객석의 악보대 — 합창단이 부른 네 음이 오선 위 점으로, 아는 음의 울림판을 차례로 쳐서 따라 부른다.
import { esc, blip, mountDevice, digitOf, isUse } from './common.js';

const TONE_NAMES = ['솟음', '열림', '흐름', '빛', '고요'];
const TONE_COL = ['#ff9f6a', '#ffd27a', '#7ff3e6', '#9fb8ff', '#d8a8ff'];

/** 실험대: { round, rounds, mode: 'same'|'name', pool, play(which), answer(v) → ok } */
export function labBench(game, o) {
  const el = document.createElement('div');
  el.className = 'lab';
  const draw = () => {
    el.innerHTML = `<div class="lb-note"><b>실험 ${o.round}/${o.rounds}</b> · ${o.mode === 'same' ? '두 시료가 같은 음으로 울릴까?' : '이 시료는 어떤 음으로 울릴까? 소리굽쇠를 대어 맞는 것을 찾는다'}</div>
      <div class="lb-top"><div class="lb-rack">${o.mode === 'same' ? '<button class="lb-vial" data-v="0"><i></i><b>시료 가</b></button><button class="lb-vial" data-v="1"><i></i><b>시료 나</b></button>' : '<button class="lb-vial big" data-v="0"><i></i><b>시료</b></button>'}</div>
      ${o.mode === 'same' ? '<div class="lb-stamps"><button class="lb-st" data-a="same">같다</button><button class="lb-st" data-a="diff">다르다</button></div>' : `<div class="lb-forks">${o.pool.map((i) => `<button class="lb-fork" data-f="${i}" style="--c:${TONE_COL[i]}"><i></i><b>${TONE_NAMES[i]}</b><small>${i + 1}번 굽쇠 · 치면 울림</small></button>`).join('')}</div>`}</div>
      <div class="lb-log"></div><button class="lb-leave">실험대에서 물러서기 (Esc)</button>`;
    el.querySelectorAll('.lb-vial').forEach((b) => b.addEventListener('click', () => { b.classList.remove('ring'); void b.offsetWidth; b.classList.add('ring'); o.play(+b.dataset.v); }));
    el.querySelectorAll('.lb-st').forEach((b) => b.addEventListener('click', () => answer(b.dataset.a === 'same', b)));
    el.querySelectorAll('.lb-fork').forEach((b) => {
      // 한 번 누르면 굽쇠를 친다(울림 듣기), 울리는 굽쇠를 다시 누르면 시료에 댄다(답)
      b.addEventListener('click', () => { const i = +b.dataset.f; if (b.classList.contains('hum')) answer(i, b); else { el.querySelectorAll('.lb-fork').forEach((q) => q.classList.remove('hum')); b.classList.add('hum'); if (game.audio && game.audio.tone) game.audio.tone(i, { gain: 0.35 }); log('굽쇠가 울린다 — 다시 누르면 시료에 댄다'); } });
    });
    el.querySelector('.lb-leave').addEventListener('click', () => lay.close());
  };
  const log = (t) => { const L = el.querySelector('.lb-log'); if (L) L.textContent = t; };
  let busy = false;
  const answer = (v, b) => { if (busy) return; busy = true; b.classList.add('used'); const ok = o.answer(v); el.classList.add(ok ? 'good' : 'bad'); log(ok ? '시료가 그 음으로 정렬된다 — 빛이 고르게 선다' : '시료가 어긋나게 떤다…'); blip(game, ok ? 'ok' : 'no'); };
  draw();
  const lay = mountDevice(game, el, { cls: 'dev-lab', keys: (e) => { const d = digitOf(e); if (o.mode === 'name' && d >= 0 && o.pool.includes(d)) { el.querySelector(`[data-f="${d}"]`).click(); return true; } return false; } });
  lay.next = (n) => { Object.assign(o, n); busy = false; el.classList.remove('good', 'bad'); draw(); };
  Object.defineProperty(lay, 'acts', { get: () => (o.mode === 'same' ? [{ label: '같다', run: () => el.querySelector('[data-a="same"]').click() }, { label: '다르다', run: () => el.querySelector('[data-a="diff"]').click() }] : o.pool.map((i) => ({ label: TONE_NAMES[i], run: () => { const b = el.querySelector(`[data-f="${i}"]`); b.click(); b.click(); } }))).map((a) => ({ off: false, ...a })) });
  return lay;
}

/** 분류대: { k, n, col (짐의 빛 띠), glyph (html), cols: [색], names: [칸 이름], limit(ms), pick(i, late) } */
export function sorter(game, o) {
  const el = document.createElement('div');
  el.className = 'sortr';
  el.innerHTML = `<div class="so-head"><b>분류대 · 짐 ${o.k}/${o.n}</b><span>빛 띠의 색과 같은 슈트의 손잡이를 당긴다</span></div>
    <div class="so-belt"><div class="so-box" style="--c:${o.col}"><div class="so-glyph">${o.glyph || ''}</div><i class="so-band"></i></div></div>
    <div class="so-chutes">${o.cols.map((c, i) => `<button class="so-ch" data-i="${i}" style="--c:${c}"><i></i><b>${esc(o.names[i])}</b><em>${i + 1}</em></button>`).join('')}</div><div class="so-timer"><i></i></div>`;
  const box = el.querySelector('.so-box'), timer = el.querySelector('.so-timer i');
  const t0 = performance.now();
  let done = false;
  const pick = (i) => { if (done) return; done = true; const late = performance.now() - t0 > o.limit; el.querySelector(`[data-i="${i}"]`).classList.add('pull'); box.classList.add(`to${i}`); blip(game, 'press'); setTimeout(() => { lay.close(); o.pick(i, late); }, 420); };
  el.querySelectorAll('.so-ch').forEach((b) => b.addEventListener('click', () => pick(+b.dataset.i)));
  const tick = () => { if (done || !el.isConnected) return; const f = Math.min(1, (performance.now() - t0) / o.limit); timer.style.width = `${(1 - f) * 100}%`; box.style.left = `${8 + f * 64}%`; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  const lay = mountDevice(game, el, { cls: 'dev-sort', keys: (e) => { const d = digitOf(e); if (d >= 0 && d < o.cols.length) { pick(d); return true; } return false; } });
  lay.acts = o.names.map((nm, i) => ({ label: nm, off: false, run: () => pick(i) }));
  return lay;
}

/** 출력 조종대: { kicker, title, secs, need, onEnd(inBand) } — 바늘을 가운데 띠 안에 붙잡아 둔다 */
export function reactor(game, o) {
  const el = document.createElement('div');
  el.className = 'reac';
  const secs = o.secs || 12, need = o.need || 7;
  el.innerHTML = `<div class="rc-plate"><b>${esc(o.kicker || '공명 발전소 · 조종대')}</b><span>${esc(o.title || '출력 맞추기')}</span></div>
    <div class="rc-meter"><div class="rc-scale"></div><div class="rc-band"></div><div class="rc-needle"></div></div>
    <div class="rc-row"><button class="rc-lever" data-d="-1"><i></i><b>▼ 낮추기</b><small>S · ↓</small></button><div class="rc-read"><div>띠 안 <b class="rc-in">0.0</b>초 / ${need}초</div><div>남은 시간 <b class="rc-left">${secs}</b>초</div></div><button class="rc-lever" data-d="1"><i></i><b>▲ 높이기</b><small>W · ↑</small></button></div>`;
  const needle = el.querySelector('.rc-needle'), inEl = el.querySelector('.rc-in'), leftEl = el.querySelector('.rc-left');
  let x = 0.5, v = 0, inBand = 0, T = 0, done = false;
  const t0 = performance.now(), ph1 = Math.random() * 6.28, ph2 = Math.random() * 6.28;
  const push = (d) => { v += d * 0.32; const b = el.querySelector(`[data-d="${d}"]`); b.classList.remove('pull'); void b.offsetWidth; b.classList.add('pull'); };
  el.querySelectorAll('[data-d]').forEach((b) => b.addEventListener('click', () => push(+b.dataset.d)));
  const tick = (now) => {
    if (done || !el.isConnected) return;
    const T1 = Math.min(secs, (now - t0) / 1000); // 벽시계로 (화면이 느려도 12초는 12초) · 물리는 1/60초씩
    while (T1 - T > 1e-4) {
      const dt = Math.min(1 / 60, T1 - T); T += dt;
      const surge = 0.34 * Math.sin(T * 0.75 + ph1) + 0.22 * Math.sin(T * 1.8 + ph2);
      v += (surge + (Math.random() - 0.5) * 0.8) * dt; v *= Math.exp(-0.9 * dt); x += v * dt;
      if (x < 0 || x > 1) { x = Math.max(0, Math.min(1, x)); v *= -0.3; }
      if (x > 0.42 && x < 0.58) inBand += dt;
    }
    needle.style.left = `${x * 100}%`;
    el.classList.toggle('inband', x > 0.42 && x < 0.58);
    inEl.textContent = inBand.toFixed(1); leftEl.textContent = Math.max(0, Math.ceil(secs - T));
    if (T1 >= secs) { done = true; lay.close(); o.onEnd(inBand); return; }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  const lay = mountDevice(game, el, { cls: 'dev-reactor', keys: (e) => { if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') { push(1); return true; } if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') { push(-1); return true; } return false; } });
  return lay;
}

/** 악보대: { phrase: [음] | null(듣기만), pool: [아는 음], replay(), done(ok) } */
export function scoreStand(game, o) {
  const el = document.createElement('div');
  el.className = 'score';
  const staff = (ns, cls) => `<div class="sc-staff ${cls}">${[0, 1, 2, 3, 4].map((k) => `<i class="sc-l" style="--k:${k}"></i>`).join('')}${ns.map((n, k) => `<b class="sc-n" style="--k:${k};--h:${n};--c:${TONE_COL[n]}"></b>`).join('')}</div>`;
  const listen = !o.phrase;
  el.innerHTML = `<div class="sc-stand"><div class="sc-sheet"><small>합창단이 부른 노래</small>${staff(o.phrase || o.listen || [], 'heard')}<small>${listen ? '함께 부르려면 공명 음을 둘 이상 알아야 해요 — 지금은 듣기만' : '따라 부른 음'}</small>${listen ? '' : staff([], 'mine')}</div></div>
    <div class="sc-bells">${listen ? '' : o.pool.map((i) => `<button class="sc-bell" data-t="${i}" style="--c:${TONE_COL[i]}"><i></i><b>${TONE_NAMES[i]}</b><em>${i + 1}</em></button>`).join('')}<button class="sc-again">▶ 한 번 더 듣기</button><button class="sc-leave">객석으로 (Esc)</button></div>`;
  const mine = el.querySelector('.sc-staff.mine');
  const inp = [];
  const press = (i) => {
    if (listen || inp.length >= o.phrase.length || !o.pool.includes(i)) return;
    if (game.audio && game.audio.tone) game.audio.tone(i, { gain: 0.4 });
    inp.push(i);
    mine.insertAdjacentHTML('beforeend', `<b class="sc-n" style="--k:${inp.length - 1};--h:${i};--c:${TONE_COL[i]}"></b>`);
    if (inp.length === o.phrase.length) { const ok = inp.every((n, k) => n === o.phrase[k]); el.classList.add(ok ? 'good' : 'bad'); setTimeout(() => { lay.close(); o.done(ok); }, 700); }
  };
  el.querySelectorAll('.sc-bell').forEach((b) => b.addEventListener('click', () => press(+b.dataset.t)));
  el.querySelector('.sc-again').addEventListener('click', () => o.replay());
  el.querySelector('.sc-leave').addEventListener('click', () => lay.close());
  const lay = mountDevice(game, el, { cls: 'dev-score', keys: (e) => { const d = digitOf(e); if (d >= 0 && d < 5) { press(d); return true; } if (isUse(e)) { o.replay(); return true; } return false; } });
  lay.acts = listen ? [] : o.pool.map((i) => ({ label: TONE_NAMES[i], off: false, run: () => press(i) }));
  return lay;
}
