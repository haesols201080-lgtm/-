// 은행·치료비 규칙 검사 (v24 「체력 0: 쓰러짐 → 병원 이송 → 치료비·의료 부채」의 돈 부분, 브라우저 없이):
//  현금만 · 예금만 · 현금+예금 · 유동 자산 0 의 네 경우, 같은 사건 두 번 청구 막기, 부분/전액 상환, 슬롯 둘의 장부 분리
//   node tools/bank-check.mjs
import { Bank } from '../src/game/bank.js';
import { BAL } from '../src/data/balance.js';
import { defaultState } from '../src/game/state.js';

let fails = 0;
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++; };
const mk = (cash, bal) => { const s = defaultState(); s.inv.starseed = cash; s.bank.balance = bal; const g = { state: s, world: { clock: { day: 3, time: 0.5 } }, ui: { updateWallet() {} } }; return { g, b: new Bank(g) }; };
const near = (a, b) => Math.abs(a - b) < 1e-6;

for (const [cash, bal, label] of [[100, 0, '현금만'], [0, 80, '예금만'], [30, 50, '현금+예금'], [0, 0, '유동 자산 0']]) {
  const { g, b } = mk(cash, bal);
  const L = cash + bal;
  const r = b.careFee('물결 치유원', 'down:1');
  if (L > 0) {
    ok(near(r.paid, L * BAL.CARE_SHARE) && near(b.liquid(), L * (1 - BAL.CARE_SHARE)) && g.state.bank.debt === 0, `${label}: 유동 자산 ${L} → 치료비 ${r.paid}, 남은 ${b.liquid()} (가방 ${g.state.inv.starseed} · 계좌 ${g.state.bank.balance})`);
    if (cash > 0 && bal > 0) ok(near(g.state.inv.starseed, Math.max(0, cash - L * BAL.CARE_SHARE)), `${label}: 가방에서 먼저 빠짐`);
  } else ok(r.paid === 0 && g.state.bank.debt === BAL.CARE_MIN_FEE, `${label}: 최소 응급 치료비 ${BAL.CARE_MIN_FEE} 가 의료 부채로`);
  const again = b.careFee('물결 치유원', 'down:1');
  ok(again.dup && (L > 0 ? near(b.liquid(), L * (1 - BAL.CARE_SHARE)) : g.state.bank.debt === BAL.CARE_MIN_FEE), `${label}: 같은 사건 두 번 청구 안 함`);
  const e = g.state.bank.ledger.at(-1);
  ok(e && e.where === '물결 치유원' && e.key === 'down:1' && e.day === 3.5, `${label}: 원장에 병원·시각·금액 (${e && e.memo})`);
}
// 부채 쌓기 → 부분 상환 → 전액 상환
{
  const { g, b } = mk(0, 0);
  b.careFee('가', 'd1'); b.careFee('나', 'd2');
  ok(g.state.bank.debt === BAL.CARE_MIN_FEE * 2 && g.state.bank.ledger.filter((e) => e.kind === 'debt').length === 2, `부채가 합산되고 발생마다 원장에 (${g.state.bank.debt})`);
  g.state.inv.starseed = 30;
  const p1 = b.repay(25);
  ok(p1 === 25 && g.state.bank.debt === BAL.CARE_MIN_FEE * 2 - 25 && g.state.inv.starseed === 5, `부분 상환 25 → 부채 ${g.state.bank.debt}, 가방 ${g.state.inv.starseed}`);
  g.state.bank.balance = 200;
  const p2 = b.repay(1e9);
  ok(g.state.bank.debt === 0 && near(p2, BAL.CARE_MIN_FEE * 2 - 25), `전액 상환 ${p2} → 부채 0 (계좌 ${g.state.bank.balance})`);
}
// 입출금 · 결제
{
  const { g, b } = mk(50, 0);
  b.deposit(30); ok(g.state.inv.starseed === 20 && g.state.bank.balance === 30, '예금 30');
  b.withdraw(10); ok(g.state.inv.starseed === 30 && g.state.bank.balance === 20, '출금 10');
  ok(b.pay(40, '가게', '빵') && g.state.inv.starseed === 0 && g.state.bank.balance === 10, '결제 40: 가방 30 + 계좌 10 (자동 결제)');
  ok(!b.pay(11) && g.state.bank.balance === 10, '모자라면 아무것도 빼지 않음');
}
// 슬롯 둘: 장부가 섞이지 않음 (상태 객체가 따로)
{
  const A = mk(100, 0), B = mk(0, 0);
  A.b.careFee('가', 'x'); B.b.careFee('나', 'x');
  ok(A.g.state.bank.debt === 0 && B.g.state.bank.debt === BAL.CARE_MIN_FEE && A.g.state.bank.ledger.length === 1 && B.g.state.bank.ledger.length === 1, '슬롯 A·B 장부 분리 (같은 사건 열쇠라도 슬롯마다 따로)');
  const json = JSON.parse(JSON.stringify(A.g.state));
  ok(json.bank.ledger[0].key === 'x' && json.bank.balance === A.g.state.bank.balance, '저장 꼴(JSON)로 그대로 남음');
}
console.log(fails ? `실패 ${fails}` : '모두 통과');
process.exit(fails ? 1 : 0);
