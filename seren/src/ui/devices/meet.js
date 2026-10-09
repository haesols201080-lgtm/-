// 사람과 마주하기 (v24 「기기별 UI」 — 주민·시설지기·실내 사람): 카드 없이 그 사람의 머리 위에 이름표(이름 · 하는 일 · 친한 정도),
//  어깨 둘레에 할 수 있는 몸짓이 반원으로 떠 있다(이야기 · 함께 하기 · 선물 · 길 묻기 · 헤어지기). 그 사람이 움직이면 따라간다.
//  숫자 키·E(첫째)로도 고른다. 장터 노점은 노점 천(진열대 앞면 'stall')으로 따로 연다.
import * as THREE from 'three';
import { esc, blip, mountDevice, digitOf, isUse } from './common.js';

const V = new THREE.Vector3();

/** openMeet(game, { anchor: Vector3 (머리 높이 기준점 · 매 프레임 읽음), head: 1.9, name, role, hearts, opts: [{ label, sub, off, on }], onClose }) */
export function openMeet(game, o) {
  const el = document.createElement('div');
  el.className = 'meet';
  const n = o.opts.length;
  el.innerHTML = `<div class="mt-tag"><b>${esc(o.name)}</b><span>${esc(o.role || '')}</span>${o.hearts != null ? `<em>${'♥'.repeat(o.hearts)}${'♡'.repeat(Math.max(0, 5 - o.hearts))}</em>` : ''}</div>
    ${o.opts.map((q, i) => `<button class="mt-o${q.off ? ' off' : ''}${i === 0 ? ' first' : ''}" data-i="${i}" style="--k:${i};--n:${n}"><em>${i + 1}</em><b>${esc(q.label)}</b>${q.sub ? `<small>${esc(q.sub)}</small>` : ''}</button>`).join('')}`;
  const tag = el.querySelector('.mt-tag'), btns = [...el.querySelectorAll('.mt-o')];
  const pick = (i) => { const q = o.opts[i]; if (!q) return; if (q.off) { blip(game, 'no'); return; } blip(game, 'click'); lay.close(); q.on && q.on(); };
  btns.forEach((b) => b.addEventListener('click', () => pick(+b.dataset.i)));
  let raf = 0;
  const place = () => {
    raf = requestAnimationFrame(place);
    const cam = game.engine.camera, W = innerWidth, H = innerHeight;
    V.copy(o.anchor); V.y += o.head ?? 1.9;
    V.project(cam);
    const behind = V.z > 1;
    let x = (V.x * 0.5 + 0.5) * W, y = (-V.y * 0.5 + 0.5) * H;
    if (behind) { x = W / 2; y = H * 0.35; }
    x = Math.max(120, Math.min(W - 120, x)); y = Math.max(70, Math.min(H * 0.6, y));
    tag.style.transform = `translate(${x}px, ${y - 30}px) translate(-50%, -100%)`;
    // 몸짓: 그 사람 둘레 아래쪽 반원 (화면이 좁으면 두 줄로)
    const R = Math.min(W * 0.36, 230), cy = Math.min(H - 70, y + 90);
    btns.forEach((b, i) => {
      const a = Math.PI * (0.08 + 0.84 * (n === 1 ? 0.5 : i / (n - 1)));
      const bx = Math.max(80, Math.min(W - 80, x - Math.cos(a) * R)), by = Math.min(H - 40, cy + Math.sin(a) * R * 0.42);
      b.style.transform = `translate(${bx}px, ${by}px) translate(-50%, -50%)`;
    });
  };
  place();
  const lay = mountDevice(game, el, {
    cls: 'dev-world dev-meet',
    onClose: () => { cancelAnimationFrame(raf); o.onClose && o.onClose(); },
    keys: (e) => { const d = digitOf(e); if (d >= 0 && d < n) { pick(d); return true; } if (isUse(e)) { pick(0); return true; } return false; },
  });
  lay.acts = o.opts.map((q, i) => ({ label: q.label, off: !!q.off, run: () => pick(i) }));
  return lay;
}

/**
 * 면접 (채용 면접실): 탁자 건너 면접관의 말풍선(질문)과 내 쪽 대답 말풍선들 — 카드 목록이 아니라 마주 앉은 대화.
 * 셋을 차례로 묻고, 끝나면 면접관이 결과를 말한다(악수 / 다음에). Q: [[질문, [대답…], 맞는 번호]]
 * openInterview(game, { org, who, Q, onAnswer(ok), onDone(score) → { ok, say } })
 */
export function openInterview(game, o) {
  const el = document.createElement('div');
  el.className = 'ivw';
  let k = 0, score = 0, lock = false;
  const draw = () => {
    const [q, opts] = o.Q[k];
    el.innerHTML = `<div class="iv-them"><div class="iv-face"><i></i></div><div class="iv-who"><b>${esc(o.who || '면접관')}</b><small>${esc(o.org)}</small></div><div class="iv-say">${esc(q)}</div></div>
      <div class="iv-table"><span class="iv-dots">${o.Q.map((_, j) => `<i class="${j < k ? 'd' : j === k ? 'c' : ''}"></i>`).join('')}</span></div>
      <div class="iv-me">${opts.map((t, j) => `<button class="iv-a" data-j="${j}"><em>${j + 1}</em>${esc(t)}</button>`).join('')}</div>`;
    el.querySelectorAll('.iv-a').forEach((b) => b.addEventListener('click', () => answer(+b.dataset.j)));
  };
  const answer = (j) => {
    if (lock) return;
    lock = true;
    const ok = j === o.Q[k][2];
    if (ok) score++;
    el.querySelector(`.iv-a[data-j="${j}"]`).classList.add('said');
    o.onAnswer && o.onAnswer(ok);
    setTimeout(() => {
      lock = false; k++;
      if (k < o.Q.length) { draw(); return; }
      const r = o.onDone(score);
      el.innerHTML = `<div class="iv-them"><div class="iv-face ${r.ok ? 'smile' : ''}"><i></i></div><div class="iv-who"><b>${esc(o.who || '면접관')}</b><small>${esc(o.org)}</small></div><div class="iv-say">${esc(r.say)}</div></div>
        <div class="iv-table"><span class="iv-res ${r.ok ? 'ok' : 'no'}">${r.ok ? '🤝 악수' : '다음에'} · ${score}/${o.Q.length}</span></div><div class="iv-me"><button class="iv-a" data-x>${r.ok ? '고맙습니다 (일어서기)' : '알겠어요 (일어서기)'}</button></div>`;
      el.querySelector('[data-x]').addEventListener('click', () => lay.close());
    }, 520);
  };
  draw();
  const lay = mountDevice(game, el, { cls: 'dev-ivw', keys: (e) => { const d = digitOf(e); if (d >= 0 && k < o.Q.length && d < o.Q[k][1].length) { answer(d); return true; } return false; } });
  Object.defineProperty(lay, 'acts', { get: () => (k < o.Q.length ? o.Q[k][1].map((t, j) => ({ label: t, off: false, run: () => answer(j), right: j === o.Q[k][2] })) : []) });
  return lay;
}
