// 은행 건물 실제 흐름 (v24 9단계 「은행 QA: 실제 건물에서 입금 → 출금 → 병원 결제 → 부채 → 일부/전부 상환」):
//  가까운 은행 건물에 들어가 → 셀프 금융 단말 앞에 서서 E 표적 확인 → 카드 단추를 눌러 입금·출금 → 최근 거래 →
//  창구(금액 입력) 입금 → 돈 없이 쓰러짐(의료 부채) → 다시 은행 → 부채 일부 갚기(금액 입력) → 모두 갚기 → 부채 내역 → 저장 왕복
//   node tools/bank-flow.mjs
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await (await browser.newContext({ viewport: { width: 900, height: 560 } })).newPage();
const logs = [];
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
let fails = 0;
const SHOTS = process.argv.includes('shots');
const shot = async (n) => { if (SHOTS) await page.screenshot({ path: join(root, 'shots', `${n}.png`), timeout: 240000 }); };
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++; };
const ev = (f, a) => page.evaluate(f, a);
await page.goto('file://' + (process.env.SEREN_HTML || join(root, 'index.html')) + '?play=new&nowake=1&q=low&t=0.5', { timeout: 400000 });
await page.waitForFunction(() => window.SEREN && SEREN.game && SEREN.game.mode === 'play' && SEREN.game.city && SEREN.game.city.recs.length, null, { timeout: 400000, polling: 1000 });
await ev(() => { const g = SEREN.game; if (g.tips) g.tips.first = () => false; g.ui.moa = () => {}; });

const state = () => ev(() => { const g = SEREN.game, B = g.state.bank; return { cash: g.state.inv.starseed || 0, bal: B.balance, debt: B.debt, n: B.ledger.length, last: B.ledger.at(-1) && { kind: B.ledger.at(-1).kind, total: B.ledger.at(-1).total, where: B.ledger.at(-1).where } }; });
// 기기 조작 (DOM 클릭 — 플레이어가 누르는 것과 같은 길): 셀프 금융 단말의 키 · 창구 종이(묶음에서 집기 → 손글씨 → 서명)
const atm = (sel) => ev((sel) => { const b = document.querySelector(`.atm ${sel}`); if (!b) return `없음 ${sel}`; b.click(); return 'ok'; }, sel);
const atmSoft = (txt) => ev((txt) => { const rows = [...document.querySelectorAll('.atm-row')]; for (let k = 0; k < rows.length; k++) { const [l, r] = rows[k].children; if (l.textContent.includes(txt)) { document.querySelector(`.atm-sk[data-sk="l${k}"]`).click(); return 'ok'; } if (r.textContent.includes(txt)) { document.querySelector(`.atm-sk[data-sk="r${k}"]`).click(); return 'ok'; } } return `없음 ${txt} — ${document.querySelector('.atm-lines') && document.querySelector('.atm-lines').textContent}`; }, txt);
const atmType = async (n) => { for (const d of String(n)) await atm(`[data-d="${d}"]`); await atm('[data-f="ok"]'); await page.waitForTimeout(1600); };
const screen = () => ev(() => { const c = document.querySelector('.atm-lines'); return c ? c.textContent.replace(/\s+/g, ' ') : ''; });
const slip = (pad, amount = null, pick = null) => ev(async ({ pad, amount, pick }) => {
  const b = [...document.querySelectorAll('.pd-pad')].find((x) => x.textContent.includes(pad));
  if (!b) return `종이 없음: ${pad} — ${[...document.querySelectorAll('.pd-pad')].map((x) => x.textContent).join('|')}`;
  b.click();
  await new Promise((r) => setTimeout(r, 200));
  if (!document.querySelector('.sheet')) return `종이가 안 놓임 (${document.querySelector('.pd-say') && document.querySelector('.pd-say').textContent})`;
  if (pick != null) { const o = [...document.querySelectorAll('.sh-opt')].find((x) => x.textContent.includes(pick)); if (o) o.click(); await new Promise((r) => setTimeout(r, 100)); }
  if (amount != null) { const inp = document.querySelector('.sheet input.sh-hand'); inp.value = String(amount); inp.dispatchEvent(new Event('input')); }
  const text = document.querySelector('.sheet').textContent.replace(/\s+/g, ' ');
  document.querySelector('.sh-signbox').click();
  await new Promise((r) => setTimeout(r, 700));
  const st = document.querySelector('.sh-stamp');
  return { ok: !!st && st.classList.contains('ok'), stamp: st && st.textContent, say: document.querySelector('.pd-say').textContent, text };
}, { pad, amount, pick });
const closeDev = () => ev(() => SEREN.game.ui.closeCard());

// 1) 가까운 은행에 들어가기
const enterBank = async () => {
  const name = await ev(() => {
    const g = SEREN.game, I = g.interiors, C = g.city, P = g.player.pos;
    const banks = [...I.bankSet()].filter((r) => r.door);
    const r = banks.sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z))[0];
    C.fixDoor(r); g.player.teleport(r.door.x + r.door.nx * 3, undefined, r.door.z + r.door.nz * 3); I.enter(r); window.__bank = r;
    return I.title(r);
  });
  await page.waitForFunction(() => SEREN.game.interiors.inPocket && !SEREN.game.interiors._busy && SEREN.game.interiors.cur.r === window.__bank, null, { timeout: 180000, polling: 300 });
  return name;
};
// 가구 앞에 서서 E 표적이 그 가구인지 보고 쓴다
const useFix = (tag) => ev(async (tag) => {
  const g = SEREN.game, I = g.interiors, ind = I.cur.indoor, B = ind.B;
  for (let i = 0; i < B.floors.length; i++) {
    const pl = ind.plan(i), F = pl && (pl.fix || []).find((q) => q.tag === tag);
    if (!F) continue;
    const [x, z] = ind.world(F.ax, F.az);
    I.placeAt(i, x, z, null);
    await new Promise((r) => setTimeout(r, 1500)); await new Promise((r) => { let k = 0; const f = () => (++k >= 4 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }); // 느린 화면에서도 자물쇠 셈(0.25 초)이 돌도록 몇 프레임
    const t = g._findTarget();
    if (!t || t.kind !== 'op' || t.o.F !== F) return { ok: false, got: t ? `${t.kind} ${t.label}` : '없음', floor: i };
    g._interact(t);
    return { ok: true, label: t.label, floor: i };
  }
  return { ok: false, got: `「${tag}」 가구가 없음` };
}, tag);

const bankName = await enterBank();
const fl = await ev(() => { const ind = SEREN.game.interiors.cur.indoor; return ind.B.floors.map((F, i) => `${i}:${F.use}`).join(' '); });
ok(!!bankName, `은행 「${bankName}」 들어감 · 층 ${fl}`);
await ev(() => { const g = SEREN.game, B = g.state.bank; g.state.inv.starseed = 300; B.balance = 0; B.debt = 0; });

// 2) 셀프 금융 단말: 입금 50 → 출금 10 → 최근 거래
let u = await useFix('atm');
ok(u.ok, `셀프 금융 단말 앞 E 표적: ${u.ok ? u.label : u.got}`);
let s0 = await state();
await atm('.atm-reader');
let p = await atmSoft('입금');
await atmType(50);
await shot('bank-atm');
let s1 = await state();
ok(p === 'ok' && s1.cash === s0.cash - 50 && s1.bal === s0.bal + 50 && s1.last.kind === 'deposit', `단말 입금 50 (패 대기 → 소프트 키 → 자판 → 확인): 가방 ${s0.cash} → ${s1.cash} · 계좌 ${s0.bal} → ${s1.bal} ${p === 'ok' ? '' : p}`);
const rc = await ev(() => { const r = document.querySelector('.atm-paper'); return r && r.classList.contains('out') ? r.textContent : ''; });
ok(/입금/.test(rc), `영수증이 나옴: ${rc}`);
await atmSoft('처음으로');
p = await atmSoft('출금');
await atmType(10);
let s2 = await state();
ok(p === 'ok' && s2.cash === s1.cash + 10 && s2.bal === s1.bal - 10 && s2.last.kind === 'withdraw', `단말 출금 10: 가방 ${s2.cash} · 계좌 ${s2.bal} ${p === 'ok' ? '' : p}`);
await atmSoft('처음으로');
p = await atmSoft('잔액');
let txt = await screen();
ok(p === 'ok' && /입금/.test(txt) && /출금/.test(txt), `잔액·거래 화면: ${txt.slice(0, 110)}…`);
const noCard = await ev(() => !document.querySelector('.svc-card'));
ok(noCard, '공용 카드(둥근 단추 목록)를 쓰지 않음');
await closeDev();

// 3) 창구: 입금표에 70 을 적고 서명 → 도장
u = await useFix('teller');
ok(u.ok, `은행 창구 앞 E 표적: ${u.ok ? u.label : u.got}`);
s0 = await state();
let sl = await slip('입금표', 70);
await shot('bank-teller');
s1 = await state();
ok(sl.ok && s1.cash === s0.cash - 70 && s1.bal === s0.bal + 70, `창구 입금표 70 · 서명 → 도장 「${sl.stamp}」: 가방 ${s1.cash} · 계좌 ${s1.bal} · 「${sl.say}」`);
await closeDev();

// 4) 가진 돈 0 으로 쓰러짐 → 의료 부채
await ev(() => { const g = SEREN.game, B = g.state.bank; window.__keep = { cash: g.state.inv.starseed, bal: B.balance }; g.state.inv.starseed = 0; B.balance = 0; g.health.hurt(g.state.health.hp + 5, '시험'); });
await page.waitForFunction(() => { const g = SEREN.game; return !g.state.health.down && g.mode === 'play' && !g.interiors._busy && g.interiors.inPocket; }, null, { timeout: 240000, polling: 300 });
const h = await ev(() => { const g = SEREN.game, B = g.state.bank; return { where: g.interiors.title(g.interiors.cur.r), debt: B.debt, last: B.ledger.at(-1) }; });
ok(h.debt === 40 && h.last.kind === 'debt', `돈 없이 쓰러짐 → 「${h.where}」에서 깨어남 · 의료 부채 ${h.debt}`);
await ev(() => { const g = SEREN.game, B = g.state.bank; g.state.inv.starseed = window.__keep.cash; B.balance = window.__keep.bal; }); // 맡긴 돈은 그대로 있던 것으로 (시험만 0 으로 만들었다)
await ev(() => SEREN.game.interiors.exit());
await page.waitForFunction(() => !SEREN.game.interiors.inPocket && !SEREN.game.interiors._busy, null, { timeout: 120000, polling: 300 });

// 5) 다시 은행 → 부채 일부 갚기(15) → 모두 갚기 → 부채 내역
await enterBank();
u = await useFix('teller');
ok(u.ok, `다시 창구: ${u.ok ? u.label : u.got}`);
s0 = await state();
sl = await slip('부채 상환표', 15);
s1 = await state();
ok(sl.ok && Math.abs(s1.debt - (s0.debt - 15)) < 0.01 && s1.cash === s0.cash - 15 && s1.last.kind === 'repay', `부채 상환표 15: 부채 ${s0.debt} → ${s1.debt} · 가방 ${s0.cash} → ${s1.cash} (가방 먼저) · 「${sl.say}」`);
await page.waitForTimeout(1600);
sl = await slip('부채 상환표', 999);
s2 = await state();
ok(sl.ok && s2.debt === 0 && Math.abs((s1.cash + s1.bal) - (s2.cash + s2.bal) - s1.debt) < 0.01, `부채 모두 갚기 (넘치게 적어도 남은 만큼만): 부채 ${s2.debt} · 유동 자산 ${s1.cash + s1.bal} → ${s2.cash + s2.bal} · 도장 「${sl.stamp}」`);
await page.waitForTimeout(1600);
sl = await slip('거래 내역 조회표');
ok(/발생/.test(sl.text) && /상환/.test(sl.text) && sl.text.includes(h.where), `거래 내역 조회표: 발생·상환·병원 이름 「${h.where}」`);
await closeDev();

// 5b) 직원 전용 문 (금고실·직원 방): 일하지 않는 이는 막힘 · 문 앞 인증 안내 · 일하는 이는 통과 · 금고실은 교대 중에만
const lockStep = (fn) => ev(async (fn) => {
  const g = SEREN.game, I = g.interiors, ind = I.cur.indoor, C = g.world.colliders;
  const find = () => { for (const [i, out] of ind.built) for (const lk of out.locks || []) if (!window.__lkType || lk.R.type === window.__lkType) return { i, out, lk }; return null; };
  let f = find();
  if (!f) { // 지금 층에 없으면 은행의 다른 층에서
    for (let i = 0; i < ind.B.floors.length && !f; i++) { const pl = ind.plan(i); if (!pl || !pl.L.rooms.some((R) => R.type === (window.__lkType || 'vault'))) continue; I.placeAt(i, ...ind.world(ind.B.G.ox + pl.L.rooms[pl.L.lifthall ?? 0].cx + 0.5, ind.B.G.oz + pl.L.rooms[pl.L.lifthall ?? 0].cz + 0.5), null); await new Promise((r) => setTimeout(r, 2500)); f = find(); }
  }
  if (!f) return { none: true };
  const { i, out, lk } = f, L = out.L, dd = lk.d.door, sgn = L.rooms[dd.a] === lk.R ? 1 : -1; // 공용 쪽 = 직원 방 반대편
  const [dx, dz] = ind.world(lk.d.x, lk.d.z), [ox, oz] = ind.world(lk.d.x + dd.dir[0] * sgn * 1.0, lk.d.z + dd.dir[1] * sgn * 1.0);
  if (ind.cur !== i) I.placeAt(i, ox, oz, null);
  g.player.teleport(ox, ind.yOf(i) + 0.3, oz, 0.1);
  await new Promise((r) => setTimeout(r, 1500)); await new Promise((r) => { let k = 0; const f = () => (++k >= 4 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }); // 느린 화면에서도 자물쇠 셈(0.25 초)이 돌도록 몇 프레임
  const shut1 = lk.shut, t = g._findTarget();
  let toast = '';
  if (t && t.kind === 'lock') { const o = g.ui.toast; g.ui.toast = (m) => { toast = m; }; g._interact(t); g.ui.toast = o; }
  // 문틀 한가운데에 몸을 두면 밀려 나오는가 (막이 있으면 공용 쪽으로)
  const q = g.player.pos.clone(); q.x = dx; q.z = dz; q.y = ind.yOf(i) + 0.05;
  C.pushOut(q, 0.38, 1.75, 0.2);
  const pushed = Math.hypot(q.x - dx, q.z - dz), side = (q.x - dx) * (ox - dx) + (q.z - dz) * (oz - dz) > 0;
  const r = { room: lk.R.name, type: lk.R.type, shut1, target: t ? t.kind : null, toast, pushed: +pushed.toFixed(2), side };
  window.__lk = lk;
  return r;
}, fn);
await ev(() => { window.__lkType = 'vault'; const g = SEREN.game; g.ops.S.jobs = g.ops.S.jobs.filter((j) => j.uid !== g.ops.cur.uid); g.ops.S.shift = null; });
let L1 = await lockStep();
if (L1.none) { await ev(() => { window.__lkType = null; }); L1 = await lockStep(); }
ok(!L1.none && L1.shut1 && L1.target === 'lock' && /출입증/.test(L1.toast) && L1.pushed > 0.3 && L1.side, `직원 문 「${L1.room}」(${L1.type}): 일하지 않으면 잠김 ${L1.shut1} · 문 앞 표적 ${L1.target} · 안내 「${L1.toast}」 · 문틀 안에서 공용 쪽으로 밀림 ${L1.pushed} m`);
const L2 = await ev(async () => {
  const g = SEREN.game, ops = g.ops, lk = window.__lk;
  ops.S.jobs.push({ uid: ops.cur.uid, k: 'test', role: 'teller', title: '창구 담당', org: '시험', bname: '시험', hours: [0, 0.99], wage: 1 });
  await new Promise((r) => setTimeout(r, 1500)); await new Promise((r) => { let k = 0; const f = () => (++k >= 4 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }); // 느린 화면에서도 자물쇠 셈(0.25 초)이 돌도록 몇 프레임
  const a = lk.shut;
  ops.S.shift = { uid: ops.cur.uid, k: 'test', t: g.world.clock.time };
  await new Promise((r) => setTimeout(r, 1500)); await new Promise((r) => { let k = 0; const f = () => (++k >= 4 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }); // 느린 화면에서도 자물쇠 셈(0.25 초)이 돌도록 몇 프레임
  const b = lk.shut;
  ops.S.jobs = ops.S.jobs.filter((j) => j.k !== 'test'); ops.S.shift = null;
  await new Promise((r) => setTimeout(r, 1500)); await new Promise((r) => { let k = 0; const f = () => (++k >= 4 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }); // 느린 화면에서도 자물쇠 셈(0.25 초)이 돌도록 몇 프레임
  return { type: lk.R.type, employed: a, shift: b, after: lk.shut, col: !!lk.col };
});
ok(L2.type === 'vault' ? (L2.employed && !L2.shift && L2.after) : (!L2.employed && !L2.shift && L2.after), `출입증: ${L2.type === 'vault' ? `금고실 — 직원이어도 교대 밖이면 잠김 ${L2.employed} · 교대 중 열림 ${!L2.shift}` : `직원이면 열림 ${!L2.employed}`} · 일을 그만두면 다시 잠김 ${L2.after}`);

// 6) 상담 · 금고(직원만) · 저장 왕복
u = await useFix('consult');
txt = u.ok ? await ev(() => document.querySelector('.pd-say') ? document.querySelector('.pd-say').textContent : '') : '';
ok(u.ok && /부채가 없네요/.test(txt), `상담 책상: ${u.ok ? txt.slice(0, 60) : u.got}`);
await closeDev();
const r6 = await ev(async () => {
  const g = SEREN.game, id = g.slot, B = g.state.bank;
  const snap = JSON.stringify({ b: B.balance, d: B.debt, n: B.ledger.length, c: g.state.inv.starseed });
  g.save(true); g.continueGame(id);
  await new Promise((r) => setTimeout(r, 2500));
  const B2 = g.state.bank;
  return { same: JSON.stringify({ b: B2.balance, d: B2.debt, n: B2.ledger.length, c: g.state.inv.starseed }) === snap, snap };
});
ok(r6.same, `저장 → 불러오기: 계좌·부채·장부·가방 그대로 ${r6.snap}`);

console.log(logs.length ? `기록:\n${[...new Set(logs)].slice(0, 8).join('\n')}` : '페이지 오류 없음');
console.log(fails ? `실패 ${fails}` : '모두 통과');
await browser.close();
process.exit(fails ? 1 : 0);
