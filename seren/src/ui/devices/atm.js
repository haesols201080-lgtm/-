// 셀프 금융 단말 (v24 「기기별 UI」 · 「색만 바꾼 은행 UI 금지」): 카드 목록이 아니라 기계 하나.
//  본체 테두리 · 파란 글자 화면 · 화면 양옆 소프트 키(화면의 줄과 나란히) · 숫자 자판(취소·정정·확인) · 시민 패를 대는 곳 · 영수증이 나오는 곳.
//  흐름: 패 대기 → 차림(입금·출금·잔액과 거래·끝) → 금액(자판) → 처리 → 영수증이 밀려 나온다 → 다시 차림.
//  키보드: 숫자 · 백스페이스(정정) · 엔터(확인) · 위아래(차림 고르기) · Esc(끝).
import { won } from '../../data/money.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const KIND = { deposit: '입금', withdraw: '출금', pay: '결제', care: '치료비', debt: '의료 부채', repay: '부채 상환' };

export function openATM(game, { org = '은행' } = {}) {
  const Bk = game.bank, B = () => game.state.bank;
  const el = document.createElement('div');
  el.className = 'atm';
  el.innerHTML = `
    <div class="atm-top"><b>${esc(org)}</b><span>셀프 금융 단말</span></div>
    <div class="atm-face">
      <div class="atm-keys l">${[0, 1, 2, 3].map((k) => `<button class="atm-sk" data-sk="l${k}" aria-label="왼쪽 키 ${k + 1}"></button>`).join('')}</div>
      <div class="atm-screen"><div class="atm-lines"></div></div>
      <div class="atm-keys r">${[0, 1, 2, 3].map((k) => `<button class="atm-sk" data-sk="r${k}" aria-label="오른쪽 키 ${k + 1}"></button>`).join('')}</div>
    </div>
    <div class="atm-low">
      <div class="atm-pad">${['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', ''].map((d) => (d ? `<button class="atm-k" data-d="${d}">${d}</button>` : '<i></i>')).join('')}</div>
      <div class="atm-fn"><button class="atm-k c" data-f="cancel">취소</button><button class="atm-k y" data-f="clear">정정</button><button class="atm-k g" data-f="ok">확인</button></div>
      <div class="atm-slots"><button class="atm-reader" data-f="card"><i></i><span>시민 패</span></button><div class="atm-rcpt"><div class="atm-paper"></div><span>영수증</span></div></div>
    </div>`;
  const lines = el.querySelector('.atm-lines'), paper = el.querySelector('.atm-paper');
  let st = 'idle', kind = null, amt = '', sel = 0, page = 0, busy = false;
  // 화면: 줄 8개 — 소프트 키는 2·4·6·8 번째 줄 높이에 맞춘다 (왼쪽 l0..l3, 오른쪽 r0..r3)
  const L = { l: [null, null, null, null], r: [null, null, null, null] };
  const draw = (title, rows, soft = {}) => {
    L.l = soft.l || [null, null, null, null]; L.r = soft.r || [null, null, null, null];
    const row = (k) => `<div class="atm-row"><span>${L.l[k] ? `◀ ${esc(L.l[k].t)}` : ''}</span><span>${L.r[k] ? `${esc(L.r[k].t)} ▶` : ''}</span></div>`;
    lines.innerHTML = `<div class="atm-title">${esc(title)}</div>${rows.map((r) => `<div class="atm-msg">${r}</div>`).join('')}<div class="atm-soft">${[0, 1, 2, 3].map(row).join('')}</div>`;
    el.querySelectorAll('.atm-sk').forEach((b) => { const [s, k] = [b.dataset.sk[0], +b.dataset.sk[1]]; b.classList.toggle('on', !!L[s][k]); });
  };
  const beep = (hi = 1) => game.audio && game.audio.blip && game.audio.blip({ hz: 880 * hi, to: 990 * hi, dur: 0.05, gain: 0.04, bus: 'ui' });
  const sum = () => `가방 ${won(game.state.inv.starseed || 0)} · 계좌 ${won(B().balance)}`;
  const menu = () => {
    st = 'menu'; kind = null; amt = '';
    draw('무엇을 할까요?', [esc(sum()), B().debt > 0 ? `의료 부채 ${esc(won(B().debt))} — 창구에서 갚아요` : '&nbsp;'], {
      l: [{ t: '입금', f: () => ask('deposit') }, { t: '출금', f: () => ask('withdraw') }, null, null],
      r: [{ t: '잔액·거래', f: () => hist(0) }, null, null, { t: '끝내기', f: () => layer.close() }],
    });
  };
  const ask = (k) => {
    st = 'amount'; kind = k; amt = '';
    const max = k === 'deposit' ? game.state.inv.starseed || 0 : B().balance;
    const quick = [10, 50, 200].filter((n) => n <= max);
    const showAmt = () => draw(`${KIND[k]} 금액`, [`${k === 'deposit' ? '가방의 돈' : '계좌'} ${esc(won(max))}`, `<b class="atm-amt">${amt ? esc(won(+amt)) : '— 울'}</b>`, '숫자를 누르고 확인'], {
      l: quick.map((n) => ({ t: won(n), f: () => { amt = String(n); showAmt(); } })).concat([null, null, null]).slice(0, 4),
      r: [{ t: '전부', f: () => { amt = String(Math.floor(max)); showAmt(); } }, null, null, { t: '돌아가기', f: menu }],
    });
    ask.show = showAmt; showAmt();
  };
  const run = () => {
    const n = Math.floor(+amt || 0);
    if (!n) { beep(0.6); return; }
    busy = true; st = 'busy';
    draw('처리 중', ['잠시 기다려 주세요…'], {});
    el.classList.add('working');
    setTimeout(() => {
      el.classList.remove('working'); busy = false;
      const done = kind === 'deposit' ? Bk.deposit(n) : Bk.withdraw(n);
      if (!done) { draw('할 수 없어요', [kind === 'deposit' ? '가방의 돈이 모자라요' : '계좌의 돈이 모자라요'], { r: [null, null, null, { t: '돌아가기', f: menu }] }); beep(0.5); return; }
      receipt(`${KIND[kind]} ${won(done)}`);
      draw('되었어요', [`${esc(KIND[kind])} ${esc(won(done))}`, esc(sum()), '영수증을 받아 가세요'], { r: [null, null, null, { t: '처음으로', f: menu }] });
      game.save && game.save();
    }, 900);
  };
  const hist = (p) => {
    st = 'hist'; page = p;
    const all = B().ledger.slice().reverse(), per = 3, rows = all.slice(p * per, p * per + per);
    draw(`잔액 · 최근 거래 ${p + 1}/${Math.max(1, Math.ceil(all.length / per))}`, [esc(sum())].concat(rows.length ? rows.map((e) => `${Math.floor(e.day) + 1}일 ${esc(KIND[e.kind] || e.kind)} ${esc(won(e.total ?? Math.abs(e.amt)))}${e.where ? ` · ${esc(e.where)}` : ''}`) : ['거래가 없어요']), {
      l: [p > 0 ? { t: '앞', f: () => hist(p - 1) } : null, null, null, null],
      r: [(p + 1) * per < all.length ? { t: '뒤', f: () => hist(p + 1) } : null, { t: '영수증', f: () => receipt(`잔액 · 계좌 ${won(B().balance)}`) }, null, { t: '돌아가기', f: menu }],
    });
  };
  const receipt = (text) => {
    paper.innerHTML = `<b>${esc(org)}</b><div>${esc(text)}</div><div>계좌 ${esc(won(B().balance))}</div><small>${Math.floor(game.world.clock.time) + 1}일째</small>`;
    paper.classList.remove('out'); void paper.offsetWidth; paper.classList.add('out');
    game.audio && game.audio.blip && game.audio.blip({ hz: 300, to: 260, dur: 0.4, gain: 0.03, bus: 'ui' });
  };
  const press = (sk) => { if (busy) return; const s = sk[0], k = +sk[1], it = L[s][k]; if (it) { beep(); it.f(); } };
  const digit = (d) => { if (st !== 'amount' || amt.length >= 6) return; beep(); amt = (amt + d).replace(/^0+/, ''); ask.show(); };
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.sk) press(b.dataset.sk);
    else if (b.dataset.d) digit(b.dataset.d);
    else if (b.dataset.f === 'card' && st === 'idle') { beep(1.2); el.classList.add('carded'); menu(); }
    else if (b.dataset.f === 'clear' && st === 'amount') { amt = amt.slice(0, -1); ask.show(); }
    else if (b.dataset.f === 'ok') { if (st === 'amount') run(); else if (st === 'idle') { el.classList.add('carded'); menu(); } }
    else if (b.dataset.f === 'cancel') { if (st === 'menu' || st === 'idle') layer.close(); else menu(); }
  });
  const onKey = (e) => {
    if (/^[0-9]$/.test(e.key)) digit(e.key);
    else if (e.key === 'Backspace' && st === 'amount') { amt = amt.slice(0, -1); ask.show(); }
    else if (e.key === 'Enter') { if (st === 'amount') run(); else if (st === 'idle') { el.classList.add('carded'); menu(); } else { const opts = [...L.l, ...L.r].filter(Boolean); if (opts[sel]) opts[sel].f(); } }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { const opts = [...L.l, ...L.r].filter(Boolean); sel = (sel + (e.key === 'ArrowDown' ? 1 : opts.length - 1)) % Math.max(1, opts.length); el.querySelectorAll('.atm-sk.on').forEach((b, i) => b.classList.toggle('sel', i === sel)); }
    else return;
    e.preventDefault();
  };
  window.addEventListener('keydown', onKey);
  draw('어서 오세요', ['시민 패를 아래 빛 고리에 대 주세요', '(누르거나 엔터)'], {});
  const layer = game.ui.mount(el, { cls: 'dev-atm', onClose: () => window.removeEventListener('keydown', onKey) });
  return layer;
}
