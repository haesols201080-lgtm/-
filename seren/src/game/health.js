// 체력·회복·쓰러짐 (v24 「체력·회복 시스템 + 병원」 · 「체력 0: 쓰러짐 → 병원 이송 → 치료비·의료 부채」).
//  · 체력은 저장 슬롯의 state.health { hp, max, down, hurtAt } — 불러오기·층·건물·승강기를 오가도 그대로.
//  · 다치는 것: 세게 떨어짐(착지 속도 30 m/s 넘게 — 탐사복이 그 아래는 흡수), 썰매로 세게 부딪힘, 그 밖의 위험(hurt 로 부른다).
//  · 회복: 쉬지 않고 가만히 있어도 절반까지는 천천히 · 쉬기(시간 보내기) · 먹을 것·약 · 치유원 진료(접수 → 진료 → 치료 → 다 찬다).
//  · 0 이 되면 쓰러짐: 입력을 멈추고 가린 뒤, 쓰러진 자리(실내면 그 건물의 바깥 자리)에서 가장 가까운 「입원실과 침상이 있는」
//    치유원으로 옮겨 침상 옆에서 깨어난다. 치료비는 game/bank.js(유동 자산의 50% · 없으면 최소 응급 치료비가 의료 부채).
//    한 사건 열쇠(down.key)로 치료비·이송이 두 번 일어나지 않게 하고, 가방·퀘스트·관계·발견은 그대로 둔다.
import { audio } from '../core/audio.js';
import { uidOf } from '../interior/ids.js';
import { osMail } from '../interior/os.js';
import { won } from '../data/money.js';

const FALL_SAFE = 30; // m/s — 이보다 느린 착지는 탐사복이 흡수
const REGEN_TO = 0.5; // 가만히 있어도 최대의 이 비율까지는 저절로
const BED_KINDS = ['wardroom'];

export class Health {
  constructor(game) { this.game = game; this._hosp = new Map(); this._flash = 0; }
  get H() { const s = this.game.state; return s.health || (s.health = { hp: 100, max: 100, down: null, hurtAt: 0 }); }
  get hp() { return this.H.hp; }

  /** 다침 (amount 만큼, 까닭은 알림에) */
  hurt(amount, cause = '') {
    const H = this.H, g = this.game;
    if (H.down || amount <= 0 || g.mode === 'title' || g.mode === 'intro') return;
    H.hp = Math.max(0, Math.round((H.hp - amount) * 10) / 10);
    H.hurtAt = g.state.playTime || 0;
    this._flash = Math.min(1, 0.35 + amount / 40);
    g.rig && g.rig.shake && g.rig.shake(Math.min(0.5, 0.12 + amount / 80));
    audio.noise && audio.noise({ freq: 120, dur: 0.35, gain: Math.min(0.45, 0.15 + amount / 120), type: 'lowpass' });
    if (g.ui && g.ui.health) g.ui.health(H.hp, H.max, true);
    if (H.hp <= 0) this.collapse(cause);
    else if (H.hp < H.max * 0.3 && !this._warned) { this._warned = true; g.ui.toast('몸이 많이 상했어요', { kind: 'muted', sub: '쉬거나 먹고, 치유원(접수 → 진료 → 치료)에서 회복해요' }); }
  }
  heal(amount, why = '') {
    const H = this.H;
    if (H.down) return 0;
    const before = H.hp;
    H.hp = Math.min(H.max, Math.round((H.hp + amount) * 10) / 10);
    if (H.hp >= H.max * 0.3) this._warned = false;
    if (this.game.ui && this.game.ui.health) this.game.ui.health(H.hp, H.max, H.hp < H.max);
    if (why && H.hp > before) this.game.ui.toast(`체력 +${Math.round(H.hp - before)} · ${why}`, { kind: 'item' });
    return H.hp - before;
  }
  full(why = '') { return this.heal(this.H.max, why); }

  /** 매 프레임: 플레이어 사건(착지·부딪힘)으로 다치고, 가만히 있으면 절반까지 천천히 */
  update(dt) {
    const g = this.game, p = g.player, H = this.H;
    if (g.mode !== 'play' || H.down) { this._fade(dt); return; }
    for (const e of p.events) {
      if ((e === 'land' || e === 'hardland') && p.impact > FALL_SAFE && p.state !== 'ride') this.hurt((p.impact - FALL_SAFE) * 2.4, '세게 떨어짐');
      if (e === 'bump' && p.skimSpeed > 18) this.hurt((p.skimSpeed - 18) * 1.1, '썰매로 부딪힘');
    }
    const since = (g.state.playTime || 0) - (H.hurtAt || 0);
    if (since > 15 && H.hp < H.max * REGEN_TO) { H.hp = Math.min(H.max * REGEN_TO, H.hp + dt * 0.6); if (g.ui.health) g.ui.health(H.hp, H.max, false); }
    this._fade(dt);
  }
  _fade(dt) { if (this._flash > 0) { this._flash = Math.max(0, this._flash - dt * 1.4); if (this.game.ui.hurtFlash) this.game.ui.hurtFlash(this._flash); } }

  /** 쓰러짐 → 가림 → 가장 가까운 회복 가능 병원 → 침상 옆에서 깨어남 (한 번만) */
  collapse(cause = '') {
    const g = this.game, H = this.H;
    if (H.down) return;
    const at = this.worldPos();
    H.down = { t: Date.now(), x: at.x, z: at.z, cause, key: `down:${g.slot || 'x'}:${Math.round((g.state.playTime || 0) * 10)}` };
    H.hp = 0;
    g.setMode('cinematic');
    g.player.vel && g.player.vel.set(0, 0, 0);
    audio.noise && audio.noise({ freq: 90, dur: 1.4, gain: 0.4, type: 'lowpass', sweep: 40 });
    g.avatar && g.avatar.act && g.avatar.act('lie', 3);
    g.ui.toast('쓰러졌어요', { kind: 'muted', sub: '가까운 치유원으로 옮겨져요' });
    const go = () => this._transport().catch((e) => { console.error('[health]', e); this._wake(null); });
    if (g.ui.coverThen) g.ui.coverThen(go); else setTimeout(go, 800);
  }
  /** 쓰러진 자리의 세계 좌표: 실내면 그 건물의 바깥 자리 */
  worldPos() {
    const g = this.game, I = g.interiors, p = g.player.pos;
    if (I && I.inPocket && I.cur && I.cur.r) return { x: I.cur.r.x, z: I.cur.r.z, inside: uidOf(I.cur.r) };
    return { x: p.x, z: p.z, inside: null };
  }

  /** 회복 가능 병원인가: 생성된 짜임에 입원실과 침상(bed)이 있는 치유원 — 결과는 건물마다 기억 */
  wardOf(r) {
    const I = this.game.interiors, key = uidOf(r);
    if (this._hosp.has(key)) return this._hosp.get(key);
    let res = null;
    try {
      const B = I.store.plan(r);
      for (const F of (B && B.floors) || []) {
        if (!F.reach || F.dead || (F.use !== 'ward' && F.use !== 'carew')) continue;
        const pl = I.store.floor(r, F.i);
        if (!pl || !pl.L) continue;
        for (const R of pl.L.rooms) {
          if (!BED_KINDS.includes(R.type) || !R.n) continue;
          const beds = (pl.fix || []).filter((q) => q.room === R.id && q.tag === 'bed');
          if (beds.length) { res = { r, floor: F.i, room: R, beds, label: F.label }; break; }
        }
        if (res) break;
      }
    } catch (e) { console.warn('[health] 병원 짜임을 못 읽음', e); res = null; }
    this._hosp.set(key, res);
    return res;
  }
  /** 쓰러진 자리에서 가장 가까운 회복 가능 병원 (세계의 모든 치유원 기록에서 — 지금 열린 건물만이 아니라) */
  nearestHospital(x, z, max = 40) {
    const g = this.game, I = g.interiors, C = g.city;
    if (!C || !C.recs) return null;
    const list = C.recs.filter((r) => r.door && I.info(r).pid === 'heal').sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z));
    const skipped = [];
    for (const r of list.slice(0, max)) {
      const w = this.wardOf(r);
      if (w) return { ...w, skipped, d: Math.hypot(r.x - x, r.z - z) };
      skipped.push(I.title(r));
    }
    return null;
  }

  async _transport() {
    const g = this.game, I = g.interiors, H = this.H, D = H.down;
    const hosp = this.nearestHospital(D.x, D.z);
    if (!hosp) { this._wake(null); return; }
    const r = hosp.r;
    g.city.fixDoor && g.city.fixDoor(r);
    // 침상 옆 자리 (틀 좌표 → 세계)
    const spot = this._bedSpot(hosp);
    const name = I.title(r);
    const fee = g.bank ? g.bank.careFee(name, D.key) : { paid: 0, debt: 0, fee: 0 };
    D.where = name; D.fee = fee;
    const place = () => {
      I.placeAt(hosp.floor, spot.x, spot.z, spot.yaw);
      this._wake({ name, fee, hosp, key: D.key });
    };
    if (I.inPocket && I.cur && I.cur.r === r) { place(); this._safeSpot(); return; }
    g.setMode('play');
    I.enter(r, { floor: hosp.floor, at: [spot.x, spot.z], yaw: spot.yaw }); // 다른 건물 안이었으면 enter → open 이 그 건물을 닫는다
    // 들어간 뒤 (로딩이 끝나면) 깨어남
    const t0 = performance.now();
    await new Promise((res) => { const w = () => { if ((I.inPocket && !I._busy && I.cur && I.cur.r === r) || performance.now() - t0 > 20000) res(); else setTimeout(w, 100); }; w(); });
    if (I.cur && I.cur.r === r) { I.placeAt(hosp.floor, spot.x, spot.z, spot.yaw); this._safeSpot(); }
    this._wake({ name, fee, hosp, key: D.key });
  }
  /** 침상 옆 걸을 수 있는 칸 (침상 앞 → 옆) — 세계 좌표와 침상을 바라보는 방향 */
  _bedSpot(hosp) {
    // 가구 자리(q.x, q.z)는 틀 좌표, 방 칸 번호는 (틀 − G.ox/oz) 격자
    const I = this.game.interiors, B = I.store.plan(hosp.r), pl = I.store.floor(hosp.r, hosp.floor), L = pl.L, G = B.G;
    const toW = (gx, gz) => [hosp.r.x + gx * B.V.ex[0] + gz * B.V.ez[0], hosp.r.z + gx * B.V.ex[1] + gz * B.V.ez[1]];
    for (const q of hosp.beds) {
      const a = (q.rot || 0) * Math.PI / 2, fx = Math.sin(a), fz = Math.cos(a);
      const W = q.w || 2, Dd = q.d || 1; // 로컬 크기 (앞 = 로컬 +z → 틀에서 (sin a, cos a))
      // 가구의 쓰는 자리(ax, az — 놓을 때 비워 둔 앞자리)부터, 그다음 앞·옆
      const cand = [q.ax != null ? [q.ax - q.x, q.az - q.z] : null, [fx * (Dd / 2 + 0.75), fz * (Dd / 2 + 0.75)], [fz * (W / 2 + 0.7), -fx * (W / 2 + 0.7)], [-fz * (W / 2 + 0.7), fx * (W / 2 + 0.7)]].filter(Boolean);
      for (const [ox, oz] of cand) {
        const gx = q.x + ox, gz = q.z + oz, ci = Math.floor(gx - G.ox), cj = Math.floor(gz - G.oz);
        if (ci < 0 || cj < 0 || ci >= G.gw || cj >= G.gh || L.room[cj * G.gw + ci] !== hosp.room.id + 1) continue;
        const [x, z] = toW(gx, gz), [bx, bz] = toW(q.x, q.z);
        return { x, z, yaw: Math.atan2(bx - x, bz - z), bed: q };
      }
    }
    const [x, z] = toW(G.ox + hosp.room.cx + 0.5, G.oz + hosp.room.cz + 0.5);
    return { x, z, yaw: 0, bed: null };
  }
  /** 깨어난 자리가 가구·벽에 겹치면 밀어내고, 걸을 수 없는 칸이면 방 가운데로 */
  _safeSpot() {
    const g = this.game, p = g.player.pos, ind = g.interiors.cur && g.interiors.cur.indoor;
    const x0 = p.x, z0 = p.z;
    g.world.colliders.pushOut(p, 0.38, 1.75, 0.2);
    if (ind && !ind.inside(ind.cur, p.x, p.z)) { p.x = x0; p.z = z0; }
  }
  _wake(info) {
    const g = this.game, H = this.H;
    H.hp = H.max;
    H.hurtAt = g.state.playTime || 0;
    H.last = info ? { where: info.name, day: g.world.clock.day, fee: info.fee } : null;
    H.down = null; // 마지막에 — 깨어나기 전에는 다시 쓰러지지 않는다
    this._warned = false;
    if (g.mode === 'cinematic' && !g.interiors._busy) g.setMode('play');
    g.ui.fade && g.ui.fade(false, true);
    if (g.ui.health) g.ui.health(H.hp, H.max, false);
    if (!info) { g.ui.toast('정신이 들었어요', { sub: '가까운 치유원을 찾지 못해 그 자리에서 쉬었어요' }); g.save(true); return; }
    const f = info.fee;
    const money = f.paid ? `치료비 ${won(f.paid)} (가방 → 계좌 순)` : f.debt ? `가진 돈이 없어 최소 응급 치료비 ${won(f.debt)}이 의료 부채가 됐어요` : '';
    g.ui.toast(`${info.name}에서 깨어났어요`, { kind: 'quest', sub: `${info.hosp.label}층 입원실 · 체력이 다 찼어요${money ? ' · ' + money : ''}` });
    osMail(g, { from: `${info.name} 원무과`, subj: f.debt ? '의료 부채 안내' : '치료비 영수증', body: `${g.world.clock.day + 1}일째 쓰러져 실려 온 뒤 치료를 마쳤어요.\n${f.paid ? `치료비: ${won(f.paid)} (쓰러진 순간 유동 자산의 절반)` : `최소 응급 치료비 ${won(f.debt)}이 의료 부채로 생겼어요.\n은행에서 언제든 나눠 갚을 수 있어요.`}\n가방의 물건·하던 일은 그대로예요.`, key: `mail:${info.key}` });
    g.save(true);
  }
}
