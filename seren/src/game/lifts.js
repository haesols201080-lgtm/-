// 승강기 칸 (v24 4단계 「일반 승객용 승강기 모델·기능 전면 점검」): 층 메뉴를 누르면 순간이동하던 것을 실제 흐름으로 —
//  승강장 부르기 단추(▲▼) → 칸이 서 있던 층에서 달려 온다(문 위 표시창의 층 숫자가 넘어간다) → 도착 종 · 문이 열린다 →
//  걸어 들어간다(칸 바닥·안감·천장 빛이 있는 실제 공간, interior/render.buildLift) → 안쪽 조작반에서 층 단추 → 문이 닫힌다 →
//  칸이 움직인다(안쪽 표시창 · 웅 소리) → 도착하면 짧게 가리고(ui.blink) 그 층의 같은 칸 같은 자리로 → 문이 열리고 걸어 나간다.
//  · 칸은 건물의 승강기 묶음(link)마다 하나: 높이(y)·속도·가는 층·부른 층들·문 열림(0..1). 지은 층의 문짝·문 막이·표시창·단추 불은
//    이 상태를 그대로 그린다(interior/building). 칸이 그 층에 없으면 문은 열리지 않고 문 막이가 승강로를 막는다.
//  · 아무도 부르지 않으면 가끔 다른 층으로 간다(건물의 다른 사람들이 쓰는 칸) — 처음 부르면 대개 조금 기다린다.
//  · 문틀에 사람이 서 있으면 문이 닫히지 않는다(다시 열린다).
//  · 주민도 같은 칸을 탄다: 할 일을 마친 위층 손님은 승강장 앞에 줄을 서서 부르고 기다렸다가 문이 열리면 칸 안으로 들어가고(문이 닫히면 떠났다),
//    칸이 이 층에 서면 가끔 탄 사람이 걸어 나와 방으로 간다. 타고 내리는 동안 문은 닫히지 않는다. 플레이어와 함께 탄 사람은 같이 옮겨 간다.
import { audio } from '../core/audio.js';
import { mulberry32, hashStr } from '../core/noise.js';
import { FUSE } from '../interior/catalog.js';
import { NOWALK } from '../interior/cells.js';
import { openLiftPanel, openLiftCall } from '../ui/devices/liftpanel.js';

const DOOR_T = 1.1; // 문이 다 열리거나 닫히는 데 (초)
const HOLD = 5; // 열린 채 기다리는 시간 (초)
const ACC = 1.6; // 칸 가속 (m/s²)

export class LiftCars {
  constructor(game, cur) {
    this.game = game;
    this.cur = cur;
    this.ind = cur.indoor;
    this.B = cur.B;
    this.cars = new Map();
    this.ff = 1; // 시험 도구가 시간을 빨리 감는 배율
    this.rnd = mulberry32(hashStr(String(cur.uid)) ^ 0x51f7);
    // 층 높이 목록 (표시창: 칸이 지나는 층의 이름)
    this.levels = this.B.floors.filter((F) => !F.mezz && String(F.label ?? '') !== '').map((F) => ({ i: F.i, y: this.ind.yOf(F.i), label: String(F.label) })).sort((a, b) => a.y - b.y);
    this._auto = null;
    this._lay = null;
    this._pn = 0;
    this._seen = new WeakSet(); // 이미 본 주민 (새로 들어온 손님 찾기)
    this._warm = 0; this._floorSeen = null;
    this._leave = (a) => this.exitPlan(a);
  }
  /** 그 묶음의 칸 (처음 부를 때 만든다: 아무 서는 층에 서 있다) */
  car(link) {
    if (this.cars.has(link)) return this.cars.get(link);
    const lk = this.B.links.find((k) => k.id === link);
    if (!lk) return null;
    const ind = this.ind;
    const stops = lk.floors.filter((i) => this.B.floors[i] && this.B.floors[i].reach && !this.B.floors[i].dead).sort((a, b) => ind.yOf(a) - ind.yOf(b));
    if (!stops.length) return null;
    const at = stops[Math.floor(this.rnd() * stops.length)];
    const span = ind.yOf(stops[stops.length - 1]) - ind.yOf(stops[0]);
    const car = {
      id: link, lk, stops, at, y: ind.yOf(at), v: 0, dir: 0, go: null,
      calls: new Set(), // 서야 할 층 (승강장 부름 · 안쪽 단추 · 다른 사람들)
      hall: new Map(), // 층 → Set('up'|'down') 승강장 단추 불
      lit: new Set(), // 안쪽 단추 불
      door: 0, want: 0, hold: 0,
      rider: false, idle: 6 + this.rnd() * 14, others: null,
      // 아주 높은 탑도 끝에서 끝까지 열 몇 초 · 화물 칸은 느리고 문도 천천히(넓고 무거운 문), 오래 열어 둔다(짐을 싣는 동안)
      vmax: lk.kind === 'cargo' ? Math.max(1.6, span / 16) : Math.max(2.5, span / 9),
      doorT: lk.kind === 'cargo' ? DOOR_T * 1.7 : DOOR_T, holdT: lk.kind === 'cargo' ? HOLD * 1.8 : HOLD,
      cargo: lk.kind === 'cargo',
    };
    this.cars.set(link, car);
    return car;
  }
  /** 칸이 멈춰 서 있나 */
  still(car) { return car.go == null && car.v === 0; }
  /** 층 i 에 지은 그 묶음의 승강기 (문이 있는) */
  liftOn(i, link) { const out = this.ind.built.get(i); return out ? out.lifts.find((q) => q.link === link && q.stops) || null : null; }
  /** 플레이어가 지금 층의 승강기 칸 안에 서 있나 → 그 승강기 */
  inCar() {
    const ind = this.ind, out = ind.built.get(ind.cur);
    if (!out) return null;
    const p = this.game.player.pos;
    if (Math.abs(p.y - ind.yOf(ind.cur)) > 1.6) return null;
    const [gx, gz] = ind.grid(p.x, p.z);
    for (const L of out.lifts) {
      if (!L.stops || !L.bb || !L.here) continue;
      const b = L.bb;
      if (gx > b.x0 && gx < b.x1 && gz > b.z0 && gz < b.z1) return L;
    }
    return null;
  }
  /** 문틀(문짝이 지나가는 곳)에 플레이어가 서 있나 — 그러면 문이 닫히지 않는다 */
  _inDoorway(L) {
    const ind = this.ind, p = this.game.player.pos;
    if (Math.abs(p.y - ind.yOf(ind.cur)) > 1.6) return false;
    const [gx, gz] = ind.grid(p.x, p.z);
    const [fx, fz] = L.front, rx = gx - L.x, rz = gz - L.z;
    const n = rx * fx + rz * fz, s = fz ? rx : rz;
    return Math.abs(n) < 0.55 && Math.abs(s) < L.W / 2 + 0.1;
  }
  _label(car) {
    let best = null, bd = 1e9;
    for (const q of this.levels) { const d = Math.abs(q.y - car.y); if (d < bd) { bd = d; best = q; } }
    return best ? best.label : '';
  }

  // ── 누르기 ─────────────────────────────
  /** 승강장에서 부르기 (dir 'up'|'down') */
  call(car, floor, dir) {
    if (this.still(car) && car.at === floor) { this._openDoors(car); return 'here'; }
    car.calls.add(floor);
    if (!car.hall.has(floor)) car.hall.set(floor, new Set());
    car.hall.get(floor).add(dir);
    return 'called';
  }
  /** 칸 안 층 단추 */
  press(car, floor) {
    if (this.still(car) && car.at === floor) { this._openDoors(car); return 'here'; }
    car.calls.add(floor);
    car.lit.add(floor);
    if (car.want) car.hold = Math.min(car.hold, 0.8); // 단추를 누르면 문이 곧 닫힌다
    return 'go';
  }
  openDoors(car) { if (this.still(car)) this._openDoors(car); }
  shutDoors(car) { if (car.want) car.hold = 0; }
  _openDoors(car) {
    if (!car.want && car.door < 0.05 && car.at === this.ind.cur) audio.noise({ freq: car.cargo ? 220 : 380, q: 0.7, dur: car.doorT, gain: car.cargo ? 0.08 : 0.05, type: 'lowpass', attack: 0.2 });
    car.want = 1;
    car.hold = car.holdT;
  }
  /** 다음에 갈 층: 가던 쪽으로 가장 가까운 부름, 없으면 가장 가까운 부름 */
  _next(car) {
    if (!car.calls.size) return null;
    const ind = this.ind;
    const list = [...car.calls].map((i) => ({ i, d: ind.yOf(i) - car.y }));
    const ahead = car.dir ? list.filter((q) => Math.sign(q.d) === car.dir) : [];
    const pool = ahead.length ? ahead : list;
    pool.sort((a, b) => Math.abs(a.d) - Math.abs(b.d));
    return pool[0].i;
  }

  // ── 매 프레임 ─────────────────────────────
  update(dt0) {
    const dt = Math.min(1, dt0 * this.ff);
    const ind = this.ind;
    // 이 층에 문이 있는 칸들은 처음 본 순간부터 움직인다 (표시창이 살아 있게)
    const outHere = ind.built.get(ind.cur);
    if (outHere) for (const L of outHere.lifts) if (L.stops && L.link != null) this.car(L.link);
    if (ind.agents && ind.agents.leaveBy !== this._leave) ind.agents.leaveBy = this._leave;
    for (const car of this.cars.values()) this._step(car, dt);
    this._arrivals(dt);
    this._auto && this._autoStep();
    // 지은 층들에 그리기
    for (const out of ind.built.values()) {
      for (const L of out.lifts) {
        if (L.link == null) continue;
        const car = this.cars.get(L.link);
        if (!car) continue;
        L.car = car;
        const still = this.still(car);
        L.here = car.rider ? out.i === ind.cur : still && car.at === out.i;
        L.open = still && car.at === out.i ? car.door : 0;
        if (L.disp) this._draw(L, car, out.i);
        if (L.btn) {
          const h = car.hall.get(out.i);
          const top = car.stops[car.stops.length - 1], bot = car.stops[0];
          L.btn.up.visible = out.i !== top; L.btn.down.visible = out.i !== bot;
          L.btn.up.material.color.setHex(h && h.has('up') ? 0xffb648 : 0x5a6068);
          L.btn.down.material.color.setHex(h && h.has('down') ? 0xffb648 : 0x5a6068);
        }
      }
    }
  }
  _step(car, dt) {
    const ind = this.ind;
    const Lhere = this.liftOn(ind.cur, car.id);
    // 타고 내리는 주민이 문을 지나는 중이면 문을 닫지 않는다 (매 프레임 주민에게서 센다 — 중간에 사라진 사람 때문에 멈추지 않게)
    const boarding = !!ind.agents && ind.agents.list.some((a) => a.car === car && a.lifting && !a.done && a.floor === car.at);
    // 탄 사람: 칸이 이 층에 멈춰 있는 동안 칸 안에 서 있으면 (움직이는 동안은 내릴 수 없다)
    if (this.still(car) && car.at === ind.cur) car.rider = !!(Lhere && Lhere.here && this.inCar() === Lhere);
    // 문
    if (car.want) {
      car.door = Math.min(1, car.door + dt / car.doorT);
      if (car.door >= 1) {
        car.hold -= dt;
        const block = car.at === ind.cur && Lhere && this._inDoorway(Lhere);
        if (car.hold <= 0 && !block && !boarding) car.want = 0;
      }
    } else if (car.door > 0) {
      if ((car.at === ind.cur && Lhere && this._inDoorway(Lhere)) || boarding) { car.want = 1; car.hold = 1.5; } // 문틀에 사람 — 다시 연다
      else car.door = Math.max(0, car.door - dt / car.doorT);
    }
    if (car.door > 0 || car.want) return;
    // 움직이기
    if (car.go == null) {
      car.go = this._next(car);
      if (car.go == null) {
        // 아무도 안 부르면: 가끔 다른 사람들이 쓴다
        if (!car.rider) { car.idle -= dt; if (car.idle <= 0 && car.stops.length > 1) { car.idle = 18 + this.rnd() * 30; const o = car.stops.filter((i) => i !== car.at); car.others = o[Math.floor(this.rnd() * o.length)]; car.calls.add(car.others); } }
        car.dir = 0;
        return;
      }
      if (car.go === car.at && Math.abs(ind.yOf(car.go) - car.y) < 0.01) { this._arrive(car); return; }
      if (car.rider) audio.noise({ freq: 110, q: 0.5, dur: Math.min(14, 1.5 + Math.abs(ind.yOf(car.go) - car.y) / car.vmax), gain: 0.07, type: 'lowpass', attack: 0.6 });
    }
    const ty = ind.yOf(car.go), d = ty - car.y, ad = Math.abs(d);
    car.dir = Math.sign(d) || car.dir;
    car.v = Math.min(car.vmax, car.v + ACC * dt, Math.sqrt(2 * ACC * ad) + 0.05);
    const step = Math.min(ad, car.v * dt);
    car.y += Math.sign(d) * step;
    if (ad - step < 0.005) { car.y = ty; car.v = 0; car.at = car.go; car.go = null; this._arrive(car); }
  }
  _arrive(car) {
    const ind = this.ind, f = car.at;
    car.calls.delete(f); car.lit.delete(f); car.hall.delete(f);
    if (car.rider && f !== ind.cur) {
      // 탄 채로 다른 층에 닿았다: 짧게 가리고 그 층의 같은 칸 같은 자리로 (그 사이 문은 닫혀 있다)
      this._carry(car, f);
      return;
    }
    if (f === ind.cur) {
      audio.blip({ hz: 1320, to: 1318, dur: 0.4, gain: 0.05, bus: 'sfx' });
      // 다른 사람들이 부른 칸이면 대개 누가 타고 있다 (부른 사람이 플레이어여도 가끔)
      if (this.rnd() < (car.others === f ? 0.65 : 0.25)) this._passengers(car, f);
    }
    if (car.others === f) car.others = null;
    this._openDoors(car);
  }
  _carry(car, to) {
    const g = this.game, ind = this.ind, from = ind.cur;
    const L0 = this.liftOn(from, car.id);
    if (!L0) { car.rider = false; this._openDoors(car); return; }
    const p = g.player.pos;
    const [gx, gz] = ind.grid(p.x, p.z);
    const rx = gx - L0.x, rz = gz - L0.z, dy = Math.max(0, p.y - ind.yOf(from));
    this._carrying = true;
    const mid = () => {
      const [hx, hz] = ind.world(L0.x + L0.front[0] * 0.5, L0.z + L0.front[1] * 0.5); // 문 바로 앞 칸의 셀
      ind.setFloor(to, hx, hz);
      const L1 = this.liftOn(to, car.id) || L0;
      L1.here = true; L1.car = car;
      const [x, z] = ind.world(L1.x + rx, L1.z + rz);
      g.player.teleport(x, ind.yOf(to) + dy + 0.02, z, 0.3);
      // 함께 탄 주민도 같은 칸 같은 자리로 — 문이 열리면 걸어 나간다
      if (ind.agents) for (const a of ind.agents.list) if (a.car === car && a.inCar && a.floor === from) {
        a.floor = to; a.gx += L1.x - L0.x; a.gz += L1.z - L0.z;
        a.plan = this._alight(car, L1, to); a.step = 0; a.path = null; a.wait = 0; a.leaving = true;
      }
      g.rig.floorLock = ind.yOf(to);
      g.rig._init = false;
      if (g.ops) g.ops.floorChanged(to);
    };
    const done = () => {
      this._carrying = false;
      audio.blip({ hz: 1320, to: 1318, dur: 0.4, gain: 0.05, bus: 'sfx' });
      this._openDoors(car);
      const F = this.B.floors[to];
      g.ui.toast(`${F.label}층 · ${FUSE[F.use] ? FUSE[F.use].name : ''}`, { kind: 'muted' });
    };
    if (g.ui && g.ui.blink) g.ui.blink(mid, done); else { mid(); done(); }
  }
  _draw(L, car, i) {
    const lab = this._label(car);
    const arrow = car.go != null ? (car.dir > 0 ? '▲' : '▼') : '';
    const lit = this.still(car) && car.at === i && car.door > 0;
    const key = `${lab}|${arrow}|${lit}`;
    if (L.disp.key === key) return;
    L.disp.key = key;
    const c = L.disp.cx, W = 128, H = 48;
    c.fillStyle = '#0c0a06'; c.fillRect(0, 0, W, H);
    c.strokeStyle = lit ? '#ffd27a' : '#3a3f4a'; c.lineWidth = 3; c.strokeRect(1.5, 1.5, W - 3, H - 3);
    c.fillStyle = '#ffb648';
    c.font = "bold 30px ui-monospace, Menlo, monospace";
    c.textBaseline = 'middle';
    c.textAlign = 'left'; if (arrow) c.fillText(arrow, 10, H / 2 + 1);
    c.textAlign = 'right'; c.fillText(lab, W - 12, H / 2 + 1, 84);
    L.disp.tex.needsUpdate = true;
  }

  // ── 주민도 같은 칸을 탄다 ─────────────────────────────
  /** 할 일을 마친 손님(지금 층)이 승강기로 떠나는 차례: 승강장 앞 줄 → 부르기 → 기다리기 → 문이 열리면 칸 안으로 → 문이 닫히면 떠났다 */
  exitPlan(a) {
    const ind = this.ind, B = this.B;
    if (a.floor !== ind.cur) return null;
    const out = ind.built.get(a.floor);
    if (!out) return null;
    const Ls = out.lifts.filter((L) => L.stops && L.link != null && !L.cargo && L.bb);
    if (!Ls.length) return null;
    if (a.floor === B.ground && this.rnd() < 0.8) return null; // 1층 손님은 대개 정문으로
    const L = Ls.sort((p, q) => Math.hypot(p.x - a.gx, p.z - a.gz) - Math.hypot(q.x - a.gx, q.z - a.gz))[0];
    const car = this.car(L.link);
    if (!car || car.stops.length < 2 || !car.stops.includes(a.floor)) return null;
    const others = car.stops.filter((i) => i !== a.floor);
    const dest = others[Math.floor(this.rnd() * others.length)];
    const [fx, fz] = L.front, sx = fz ? 1 : 0, sz = fx ? 1 : 0;
    // 문 바로 앞 칸 (승강장이 한 칸 깊이뿐인 층도 있다 — 더 멀면 다른 방이다), 옆으로 흩어져 선다
    const side = (this.rnd() - 0.5) * 1.6, back = 0.6 + this.rnd() * 0.3;
    const spot = this.ind.agents.freeNear(a.floor, L.x + fx * back + sx * side, L.z + fz * back + sz * side);
    const open = () => this.still(car) && car.at === a.floor && car.door >= 0.95;
    return [
      { go: spot },
      { face: Math.atan2(-fx, -fz), act: 'wait', t: 0.6, fx: () => this.call(car, a.floor, ind.yOf(dest) > ind.yOf(a.floor) ? 'up' : 'down') },
      { until: open },
      { fx: (b) => this._board(b, car, L) },
      { fx: (b) => { b.lifting = false; b.inCar = true; car.calls.add(dest); } },
      // 문이 닫히고 칸이 떠나면 끝 (플레이어가 같이 탔으면 함께 옮겨 간다 — _carry)
      { until: (b) => (car.door < 0.15 || !this.still(car)) && !(car.rider && b.floor === ind.cur) },
    ];
  }
  /** 칸 안으로 걸어 들어가기 (문 앞 → 칸 안 빈자리) */
  _board(b, car, L) {
    const [fx, fz] = L.front, bb = L.bb;
    const gx = bb.cx + (this.rnd() - 0.5) * (bb.x1 - bb.x0 - 0.9), gz = bb.cz + (this.rnd() - 0.5) * (bb.z1 - bb.z0 - 0.9);
    b.lifting = true;
    b.car = car;
    b.path = [[b.gx, b.gz], [L.x + fx * 0.5, L.z + fz * 0.5], [L.x - fx * 0.5, L.z - fz * 0.5], [gx, gz]];
    b.pk = 1;
  }
  /** 칸에서 내리기: 문이 열리면 걸어 나와 dest(없으면 그 층의 다른 셀 방, null 이면 문 앞에서 끝)로 */
  _alight(car, L, floor, dest) {
    const [fx, fz] = L.front, sx = fz ? 1 : 0, sz = fx ? 1 : 0;
    const out1 = [L.x + fx * 0.8 + sx * (this.rnd() - 0.5) * 0.6, L.z + fz * 0.8 + sz * (this.rnd() - 0.5) * 0.6];
    if (dest === undefined) dest = this._roomSpot(floor);
    return [
      { until: () => this.still(car) && car.at === floor && car.door >= 0.95 },
      { fx: (b) => { b.lifting = true; b.path = [[b.gx, b.gz], [L.x - fx * 0.5, L.z - fz * 0.5], [L.x + fx * 0.6, L.z + fz * 0.6], out1]; b.pk = 1; } },
      { fx: (b) => { b.lifting = false; b.inCar = false; b.car = null; } },
      ...(dest ? [{ go: dest }] : [{ act: 'look', t: 3 }]),
    ];
  }
  /** 그 층에서 내린 사람이 갈 방 (승강장과 다른 셀이면 문을 넘어 사라진다) */
  _roomSpot(floor) {
    const ind = this.ind, pl = ind.plan(floor), ag = ind.agents;
    if (!pl || !ag) return null;
    const L = pl.L, here = ind.cellKey;
    const ok = (R) => R.n >= 4 && !NOWALK.has(R.type) && R.type !== 'stair';
    const pool = L.rooms.filter((R) => ok(R) && ind.keyOf(floor, R.id) && ind.keyOf(floor, R.id) !== here);
    const list = pool.length ? pool : L.rooms.filter(ok);
    if (!list.length) return null;
    const R = list[Math.floor(this.rnd() * list.length)];
    return ag.freeNear(floor, ind.G.ox + R.cx + 0.5, ind.G.oz + R.cz + 0.5);
  }
  /**
   * 위층에 새로 온 손님(운영이 승강기 홀에 내놓는 사람)은 허공에서 나타나지 않고 칸을 타고 온다:
   *  칸 안으로 옮기고(칸이 이 층에 없거나 문이 닫혀 보이지 않는 동안만) 칸을 이 층으로 부른 뒤, 문이 열리면 내려서 원래 할 일을 이어 간다.
   *  층에 막 들어선 3 초 동안 채워진 사람들(이미 그 층에서 지내던 모습)은 그대로 둔다.
   */
  _arrivals(dt) {
    const ind = this.ind, ag = ind.agents;
    if (!ag) return;
    if (this._floorSeen !== ind.cur) { this._floorSeen = ind.cur; this._warm = 0; }
    this._warm += dt;
    const fresh = ag.list.filter((a) => !this._seen.has(a));
    if (!fresh.length) return;
    for (const a of fresh) this._seen.add(a);
    if (this._warm < 3 || ind.cur === this.B.ground) return;
    const pl = ind.plan(ind.cur), out = ind.built.get(ind.cur);
    const hall = pl && pl.L.lifthall;
    if (hall == null || !out) return;
    const G = ind.G;
    for (const a of fresh) {
      if (a.staff || a.keep || a.leaving || a.inCar || a.floor !== ind.cur) continue;
      const ci = Math.floor(a.gx - G.ox), cj = Math.floor(a.gz - G.oz);
      if (ci < 0 || cj < 0 || ci >= G.gw || cj >= G.gh || pl.L.room[cj * G.gw + ci] - 1 !== hall) continue;
      const Ls = out.lifts.filter((L) => L.stops && L.link != null && !L.cargo && L.bb);
      if (!Ls.length) return;
      const L = Ls.sort((p, q) => Math.hypot(p.x - a.gx, p.z - a.gz) - Math.hypot(q.x - a.gx, q.z - a.gz))[0];
      const car = this.car(L.link);
      if (!car || car.rider || (this.still(car) && car.at === ind.cur && car.door > 0)) continue;
      const start = [a.gx, a.gz], bb = L.bb;
      a.gx = bb.cx + (this.rnd() - 0.5) * (bb.x1 - bb.x0 - 0.9); a.gz = bb.cz + (this.rnd() - 0.5) * (bb.z1 - bb.z0 - 0.9);
      ag._place(a);
      a.path = null; a.wait = 0;
      a.plan = [...this._alight(car, L, ind.cur, start), ...a.plan.slice(a.step)]; a.step = 0;
      a.inCar = true; a.car = car;
      if (this.still(car) && car.at === ind.cur) this._openDoors(car); else car.calls.add(ind.cur);
    }
  }
  /** 칸이 이 층에 서면 탄 사람 몇 (문이 열리면 걸어 나온다) */
  _passengers(car, floor) {
    const L = this.liftOn(floor, car.id), ag = this.ind.agents;
    if (!L || !L.bb || !ag) return;
    const n = 1 + (this.rnd() < 0.35 ? 1 : 0);
    for (let k = 0; k < n; k++) {
      const bb = L.bb;
      const gx = bb.cx + (this.rnd() - 0.5) * (bb.x1 - bb.x0 - 0.9), gz = bb.cz + (this.rnd() - 0.5) * (bb.z1 - bb.z0 - 0.9);
      const a = ag.spawn({ key: `${this.cur.uid}:lift:${car.id}:${++this._pn}`, role: 'visitor', floor, gx, gz, plan: this._alight(car, L, floor) });
      a.leaving = true; a.inCar = true; a.car = car;
    }
  }

  // ── 화면 (기기) ─────────────────────────────
  /** 승강장 부르기 판 */
  openCall(L) {
    const g = this.game, ind = this.ind, car = this.car(L.link);
    if (!car) return null;
    // 화물 승강기는 직원 구역 — 부르기 판의 출입증 읽개에 직원 출입증을 대야 부를 수 있다 (관계자 구역과 같은 규칙)
    if (L.cargo && g.ops) {
      const pl = ind.plan(ind.cur), R = pl && pl.L.rooms[L.room];
      if (R && !g.ops.canEnter(R, ind.cur)) { audio.blip({ hz: 320, to: 220, dur: 0.16, gain: 0.06, bus: 'ui' }); g.ui.toast(`출입증 읽개가 붉게 깜빡인다 · ${g.ops.lockInfo(R)}`, { kind: 'muted' }); return null; }
    }
    const here = ind.cur, F = this.B.floors[here];
    const up = car.stops.some((i) => ind.yOf(i) > ind.yOf(here) + 0.1), down = car.stops.some((i) => ind.yOf(i) < ind.yOf(here) - 0.1);
    const title = L.cargo ? '화물 승강기' : car.lk.bank === 'high' ? '높은층 급행' : car.lk.bank === 'low' ? '낮은층 승강기' : '승강기';
    const lay = openLiftCall(g, {
      title, floor: `${F.label}층 승강장`, up, down,
      range: `${this.B.floors[car.stops[0]].label} ~ ${this.B.floors[car.stops[car.stops.length - 1]].label}층`,
      live: () => { const h = car.hall.get(here); return { label: this._label(car), dir: car.go != null ? car.dir : 0, up: !!(h && h.has('up')), down: !!(h && h.has('down')), open: this.still(car) && car.at === here && car.door > 0.5 }; },
      onCall: (dir) => this.call(car, here, dir),
    });
    return lay;
  }
  /** 칸 안 조작반 */
  openPanel(L) {
    const g = this.game, ind = this.ind, car = this.car(L.link);
    if (!car) return null;
    const B = this.B;
    const floors = car.stops.slice().reverse().map((i) => {
      const F = B.floors[i], Z = B.zones[F.zone];
      const org = Z && Z.org ? B.orgs.find((o) => o.id === Z.org) : null;
      return { i, label: String(F.label), name: FUSE[F.use] ? FUSE[F.use].name : F.use, org: org ? org.name : F.below ? '지하' : '' };
    });
    const title = L.cargo ? '화물 승강기' : car.lk.bank === 'high' ? '높은층 급행' : car.lk.bank === 'low' ? '낮은층' : '승강기';
    // 정원·속도는 칸 크기와 건물 높이로 (작은 집 승강기 · 큰 탑 급행 · 화물이 다르다)
    const b = L.bb, area = (b.x1 - b.x0) * (b.z1 - b.z0);
    const plaque = L.cargo ? `화물 · 최대 ${Math.round(area / 5)}톤 · 짐수레째 · 초속 ${car.vmax.toFixed(1)} m` : `정원 ${Math.max(4, Math.round(area * 1.4))} · 공명 부양 · 초속 ${car.vmax.toFixed(1)} m`;
    this._lay = openLiftPanel(g, {
      title, cargo: !!L.cargo, plaque, floors,
      live: () => ({ label: this._label(car), dir: car.go != null ? car.dir : 0, at: this.still(car) ? car.at : null, lit: car.lit, open: car.door > 0.5, moving: !this.still(car) || this._carrying }),
      onPick: (i) => this.press(car, i),
      onOpen: () => this.openDoors(car),
      onShut: () => this.shutDoors(car),
      onClose: () => { this._lay = null; },
    });
    return this._lay;
  }

  // ── 시험·자동화 ─────────────────────────────
  /**
   * 그 승강기로 to 층까지 (사람이 하는 순서 그대로): 부르고 → 문이 열리면 칸 가운데로 들어서고 → 층 단추 → 도착해 문이 열릴 때까지.
   * 끝나면 true (못 가면 false) 로 풀리는 약속.
   */
  ride(L, to) {
    const car = this.car(L.link);
    if (!car || !car.stops.includes(to)) return Promise.resolve(false);
    if (to === this.ind.cur && !car.rider) return Promise.resolve(true);
    if (this._auto) this._auto.res(false);
    return new Promise((res) => { this._auto = { car, to, res, step: car.rider ? 'press' : 'call', t0: performance.now() }; });
  }
  _autoStep() {
    const A = this._auto, car = A.car, ind = this.ind, g = this.game;
    const end = (ok) => { this._auto = null; A.res(ok); };
    if (performance.now() - A.t0 > 240000) return end(false);
    if (A.step === 'call') {
      if (!A.called) { A.called = true; this.call(car, ind.cur, ind.yOf(A.to) > ind.yOf(ind.cur) ? 'up' : 'down'); }
      if (this.still(car) && car.at === ind.cur && car.door >= 1) {
        const L = this.liftOn(ind.cur, car.id);
        if (!L) return end(false);
        // 문이 다 열렸다: 칸 가운데로 걸어 들어선 자리 (문을 바라본다)
        const [x, z] = ind.world(L.bb.cx, L.bb.cz);
        g.player.teleport(x, ind.yOf(ind.cur) + 0.05, z, 0.3);
        const [fx, fz] = L.front, V = ind.V;
        const wx = fx * V.ex[0] + fz * V.ez[0], wz = fx * V.ex[1] + fz * V.ez[1];
        g.player.yaw = Math.atan2(wx, wz); g.rig.yaw = g.player.yaw + Math.PI;
        A.step = 'board';
      }
      return;
    }
    if (A.step === 'board') { if (this.still(car) && car.rider) A.step = 'press'; return; }
    if (A.step === 'press') { this.press(car, A.to); A.step = 'ride'; return; }
    if (A.step === 'ride' && !this._carrying && this.still(car) && car.at === A.to && ind.cur === A.to && car.door >= 1) end(true);
  }
}
