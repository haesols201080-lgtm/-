// 은행·치료비 (v24): 저장 슬롯마다 따로 있는 돈의 장부. 상태는 state.bank 와 가방의 돈 state.inv.starseed 뿐 — 이 파일은 규칙만.
//  · 유동 자산 = 가방의 돈 + 입출금 계좌 (치료비는 이것의 BAL.CARE_SHARE — 예금해 두어 피할 수 없게)
//  · 의료 부채는 따로 쌓고, 발생·상환은 모두 원장에 남긴다 (어느 병원에서 언제 얼마)
//  · 같은 사건이 두 번 기록되지 않게 사건 열쇠(key)를 받는다 — 저장/불러오기 뒤 같은 쓰러짐이 다시 청구되지 않는다
import { BAL } from '../data/balance.js';

const r2 = (n) => Math.round((+n || 0) * 100) / 100;

export class Bank {
  constructor(game) { this.game = game; }
  get B() { const s = this.game.state; return s.bank || (s.bank = { balance: 0, debt: 0, ledger: [], seq: 0 }); }
  get cash() { return r2(this.game.state.inv.starseed || 0); }
  set cash(v) { this.game.state.inv.starseed = r2(Math.max(0, v)); if (this.game.ui && this.game.ui.updateWallet) this.game.ui.updateWallet(this.game.state.inv.starseed); }
  /** 바로 쓸 수 있는 돈 (가방 + 입출금 계좌) */
  liquid() { return r2(this.cash + this.B.balance); }

  _day() { const c = this.game.world && this.game.world.clock; return c ? +(c.day + (c.time % 1)).toFixed(2) : 0; }
  /** 원장 한 줄: kind = deposit|withdraw|care|debt|repay|pay … · amt 는 계좌 기준(+ 들어옴, − 나감) */
  _log(kind, amt, extra = {}) {
    const B = this.B;
    if (extra.key && B.ledger.some((e) => e.key === extra.key)) return false;
    B.seq = (B.seq || 0) + 1;
    B.ledger.push({ n: B.seq, t: Date.now(), day: this._day(), kind, amt: r2(amt), bal: r2(B.balance), debt: r2(B.debt), cash: this.cash, ...extra });
    if (B.ledger.length > BAL.LEDGER_MAX) B.ledger.splice(0, B.ledger.length - BAL.LEDGER_MAX);
    return true;
  }

  deposit(n) {
    n = r2(Math.min(n, this.cash));
    if (n <= 0) return 0;
    this.cash -= n; this.B.balance = r2(this.B.balance + n);
    this._log('deposit', n, { memo: '가방 → 계좌' });
    return n;
  }
  withdraw(n) {
    n = r2(Math.min(n, this.B.balance));
    if (n <= 0) return 0;
    this.B.balance = r2(this.B.balance - n); this.cash += n;
    this._log('withdraw', -n, { memo: '계좌 → 가방' });
    return n;
  }
  /** 값 치르기: 가방 먼저, 모자라면 계좌에서 (자동 결제). 모자라면 아무것도 빼지 않고 false */
  pay(n, where = '', memo = '', key = null) {
    n = r2(n);
    if (n <= 0) return true;
    if (this.liquid() + 1e-9 < n) return false;
    if (key && this.B.ledger.some((e) => e.key === key)) return true;
    const fromCash = Math.min(this.cash, n), fromBank = r2(n - fromCash);
    this.cash -= fromCash; this.B.balance = r2(this.B.balance - fromBank);
    this._log('pay', -fromBank, { where, memo, total: n, fromCash: r2(fromCash), fromBank, key });
    return true;
  }
  /**
   * 치료비 (쓰러져 이송될 때 한 번): 유동 자산이 있으면 정확히 BAL.CARE_SHARE 만큼 (가방 → 계좌 순),
   * 없으면 BAL.CARE_MIN_FEE 전액이 의료 부채. key 로 같은 사건의 두 번 청구를 막는다. → { paid, debt, fee }
   */
  careFee(where, key) {
    if (key && this.B.ledger.some((e) => e.key === key)) return { paid: 0, debt: 0, fee: 0, dup: true };
    const L = this.liquid();
    if (L > 0) {
      const fee = r2(L * BAL.CARE_SHARE);
      const fromCash = Math.min(this.cash, fee), fromBank = r2(fee - fromCash);
      this.cash -= fromCash; this.B.balance = r2(this.B.balance - fromBank);
      this._log('care', -fromBank, { where, memo: `치료비 (유동 자산 ${r2(L)}의 ${Math.round(BAL.CARE_SHARE * 100)}%)`, total: fee, fromCash: r2(fromCash), fromBank, key });
      return { paid: fee, debt: 0, fee };
    }
    const fee = BAL.CARE_MIN_FEE;
    this.B.debt = r2(this.B.debt + fee);
    this._log('debt', 0, { where, memo: `최소 응급 치료비 ${fee} → 의료 부채`, total: fee, key });
    return { paid: 0, debt: fee, fee };
  }
  /** 의료 부채 갚기 (가방 → 계좌 순). 갚은 만큼 */
  repay(n) {
    n = r2(Math.min(n, this.B.debt, this.liquid()));
    if (n <= 0) return 0;
    const fromCash = Math.min(this.cash, n), fromBank = r2(n - fromCash);
    this.cash -= fromCash; this.B.balance = r2(this.B.balance - fromBank);
    this.B.debt = r2(this.B.debt - n);
    this._log('repay', -fromBank, { memo: `의료 부채 상환 ${n}`, total: n, fromCash: r2(fromCash), fromBank });
    return n;
  }
}
