// 집 구하기 (v24 7장 「부동산 — 게임 월드에 실제 존재하는 공간의 방문·임대·구매」):
//  · 매물 = 그 둘레에 실제로 있는 살림집 건물(city.recs, use 'home') — 이름·거리·층·크기에서 주마다 내는 집세와 사는 값을 정한다.
//  · 보러 가기: 나침반 표식으로 그 건물 문까지 (들어가서 둘러볼 수 있다) · 세 들기: 보증금(집세 두 주) + 첫 주 집세 → 우리 집
//  · 사기: 한 번에 → 집세 없음 · 이야기로 받은 집(시민이 되며 받은 집)은 집세가 없다
//  · 집세는 이레마다 은행 장부로 (가방 → 계좌 순, bank.pay) — 못 내면 독촉 메일, 두 번 밀리면 계약이 끝나고 받은 집으로 돌아간다
//  · 상태 state.estate = { kind: 'gift'|'rent'|'own', uid, rent, next(날), late, deposit } — 저장 슬롯마다 따로
import { uidOf } from '../interior/ids.js';
import { osMail } from '../interior/os.js';
import { josa } from '../core/josa.js';
import { won } from '../data/money.js';
import { hashStr, mulberry32 } from '../core/noise.js';

const WEEK = 7;
const r2 = (n) => Math.round(n * 100) / 100;

export class Estate {
  constructor(game) { this.game = game; this._t = 0; }
  get E() { const s = this.game.state; return s.estate || (s.estate = { kind: s.home != null ? 'gift' : null, uid: null, rent: 0, next: 0, late: 0, deposit: 0 }); }
  /** 매물 (x, z 둘레 R m 안의 살림집 · 날마다 몇 곳씩 바뀐다) */
  listings(x, z, R = 1600, n = 6) {
    const g = this.game, C = g.city, I = g.interiors;
    if (!C) return [];
    const day = Math.floor(g.world.clock.time);
    const near = C.recs.filter((r) => r.door && r.use === 'home' && r.id !== g.state.home && Math.hypot(r.x - x, r.z - z) < R);
    const rnd = mulberry32(hashStr(`estate|${Math.round(x)}|${Math.round(z)}|${day}`));
    near.sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z));
    const pool = near.slice(0, 40), out = [];
    while (pool.length && out.length < n) out.push(pool.splice(Math.floor(rnd() * Math.min(pool.length, 12)), 1)[0]);
    return out.map((r) => this.quote(r, x, z));
  }
  /** 한 집의 값: 크기(바닥 넓이 × 층)·높이·거리에서 */
  quote(r, x = r.x, z = r.z) {
    const I = this.game.interiors, info = I.info(r);
    const area = (r.sx || 6) * (r.sz || 6) * 4, floors = info.floors || 1;
    const house = !!r.custom || floors <= 2;
    const rent = r2(Math.max(5, Math.min(40, (house ? 6 : 4) + Math.sqrt(area) * 0.18 + Math.min(floors, 20) * 0.25)));
    return { r, uid: uidOf(r), name: I.title(r), d: Math.round(Math.hypot(r.x - x, r.z - z)), house, floors, rent, price: Math.round(rent * 40), deposit: r2(rent * 2) };
  }
  /** 세 들기 · 사기: 돈은 은행 장부(가방 → 계좌)로 */
  take(q, kind) {
    const g = this.game, E = this.E, B = g.bank;
    const cost = kind === 'own' ? q.price : r2(q.deposit + q.rent);
    if (!B.pay(cost, q.name, kind === 'own' ? '집 사기' : '보증금·첫 주 집세')) { g.ui.toast(`돈이 모자라요 (${won(cost)} — 가방과 계좌를 합쳐서)`, { kind: 'muted' }); return false; }
    // 전에 세 들던 집의 보증금은 돌려받는다 · 이야기로 받은 집은 기억해 둔다(세 계약이 끝나면 그리로)
    if (E.kind === 'rent' && E.deposit > 0) B.cash = B.cash + E.deposit;
    if ((E.kind == null || E.kind === 'gift') && g.state.home != null) E.giftHome = g.state.home;
    const now = g.world.clock.time;
    Object.assign(E, { kind, uid: q.uid, rent: kind === 'rent' ? q.rent : 0, next: now + WEEK, late: 0, deposit: kind === 'rent' ? q.deposit : 0, name: q.name });
    g.state.home = q.r.id; g.state.homeAt = [q.r.x, q.r.z];
    osMail(g, { from: '집 구하기 사무소', subj: kind === 'own' ? `「${q.name}」 집 문서` : `「${q.name}」 세 계약`, body: kind === 'own' ? `${josa(q.name, '을')} 샀어요. 이제 집세가 없어요. 옷장에서 옷을 갈아입고, 집 꾸미기로 물건을 놓을 수 있어요.` : `${josa(q.name, '을')} 빌렸어요. 집세는 이레마다 ${won(q.rent)} — 가방과 계좌에서 저절로 나가요. 보증금 ${won(q.deposit)}는 이사할 때 돌려받아요.`, key: `estate:${q.uid}:${Math.floor(now)}` });
    g.ui.toast(kind === 'own' ? `「${q.name}」이 우리 집이 됐다` : `「${q.name}」에 세 들었다 · 이레마다 ${won(q.rent)}`, { kind: 'item' });
    g.ui.refreshObjective && g.ui.refreshObjective();
    g.save();
    return true;
  }
  /** 매일 확인: 집세 낼 날이 지났으면 */
  update(dt) {
    if ((this._t -= dt) > 0) return;
    this._t = 2;
    const g = this.game, E = this.E;
    if (g.mode === 'title' || E.kind !== 'rent' || !E.rent) return;
    const now = g.world.clock.time;
    if (now < E.next) return;
    const key = `rent:${E.uid}:${Math.floor(E.next)}`;
    if (g.bank.pay(E.rent, E.name || '우리 집', '집세', key)) {
      E.next += WEEK; E.late = 0;
      osMail(g, { from: '집 구하기 사무소', subj: '집세 영수증', body: `${won(E.rent)}를 냈어요. 다음 집세는 이레 뒤.`, key });
    } else {
      E.late = (E.late || 0) + 1; E.next += WEEK;
      if (E.late >= 2) {
        osMail(g, { from: '집 구하기 사무소', subj: '세 계약이 끝났어요', body: `집세가 두 번 밀려 「${E.name}」 계약이 끝났어요. 보증금으로 밀린 집세를 셈했어요.`, key: `${key}:end` });
        g.state.home = E.giftHome ?? null;
        if (g.state.home != null && g.city && g.city.recs[g.state.home]) { const r = g.city.recs[g.state.home]; g.state.homeAt = [r.x, r.z]; }
        Object.assign(E, { kind: E.giftHome != null ? 'gift' : null, uid: null, rent: 0, deposit: 0, late: 0 });
        g.ui.toast('집세가 밀려 세 계약이 끝났다', { kind: 'muted' });
      } else osMail(g, { from: '집 구하기 사무소', subj: '집세 독촉', body: `가진 돈이 모자라 집세 ${won(E.rent)}를 내지 못했어요. 이레 뒤에도 못 내면 계약이 끝나요.`, key: `${key}:late` });
      g.save();
    }
  }
}
