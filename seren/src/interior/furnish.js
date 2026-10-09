// 가구·장비 놓기 (v0.9): 방의 종류마다 실제 시설의 배치 규칙으로 — 마트는 입구 쪽 계산대·바구니, 가운데 진열대 줄과 통로, 벽을 따라
// 서늘 진열대, 창고는 선반 줄, 교실은 칠판을 향한 책상 줄, 공장은 원료 → 기계 → 포장 → 검사 순서의 공정 줄…
//  · 0.5 m 칸의 자리 장부(occ): 0 빈 바닥 · 1 막힘(벽·방 밖·심) · 2 가구 · 3 비워 둘 곳(문 앞·승강기 앞·가구를 쓰는 사람이 서는 곳)
//  · 하나 놓을 때마다 검사: 자리가 방 안이고 비었나, 앞이 비었나, 그리고 문에서 이 방의 모든 가구 앞까지 걸어서 닿나.
//    막히면 그 자리는 버리고 다른 자리를 찾는다(물건을 지워서 맞추지 않고 놓는 규칙이 막지 않게).
//  · 결과: [{ id, t, x, z(틀 좌표 m, 가운데), rot(0..3: 정면 +z,+x,−z,−x), w, d, h, room, ax, az(쓰는 사람이 서는 곳), tag }]
import { FIX, ROOMS, flowRoom, PART_T } from './catalog.js';
import { rngFor, shuffle } from './ids.js';
import { sdfSpan, WALL } from './volume.js';

const S = 2; // 칸 하나를 2×2 로 (0.5 m)
const FR = [[0, 1], [1, 0], [0, -1], [-1, 0]]; // 정면 방향 (rot)

export class Occ {
  constructor(B, L) {
    this.B = B; this.L = L;
    this.gw = L.gw * S; this.gh = L.gh * S;
    this.o = new Uint8Array(this.gw * this.gh).fill(1);
    this.rm = new Int16Array(this.gw * this.gh); // 0.5 m 칸 → 방 번호+1
    this.ox = B.G.ox; this.oz = B.G.oz;
    for (let c = 0; c < L.room.length; c++) {
      const r = L.room[c];
      if (!r) continue;
      const R = L.rooms[r - 1];
      const solid = ['shaft', 'lift', 'cargo', 'stair'].includes(R.type) || L.void[c] === 3; // void 3 = 중2층 계단
      const i = c % L.gw, j = (c / L.gw) | 0;
      for (let b = 0; b < S; b++) for (let a = 0; a < S; a++) { const k = (j * S + b) * this.gw + i * S + a; this.o[k] = solid ? 1 : 0; this.rm[k] = r; }
    }
    // 중2층 계단 아래 끝 앞은 비워 둔다
    const M = L.mstair;
    if (M && !B.floors[L.i].mezz) {
      const cells = [];
      if (M.axis === 'x') { for (let k = M.n; k <= M.n + 1; k++) for (let j = M.J; j <= M.J + 3; j++) cells.push([M.run0 + M.sx * k, j]); }
      else for (let k = M.n + 1; k <= M.n + 2; k++) for (let i = M.i0 - 1; i <= M.i1 + 1; i++) cells.push([i, M.J + k]);
      for (const [i, j] of cells) {
        if (i < 0 || j < 0 || i >= L.gw || j >= L.gh) continue;
        for (let b = 0; b < S; b++) for (let a = 0; a < S; a++) { const q = (j * S + b) * this.gw + i * S + a; if (this.o[q] === 0) this.o[q] = 3; }
      }
    }
  }
  k(a, b) { return b * this.gw + a; }
  /** 틀 좌표 m → 0.5 m 칸 */
  sub(x, z) { return [Math.floor((x - this.ox) * S), Math.floor((z - this.oz) * S)]; }
  ctr(a, b) { return [this.ox + (a + 0.5) / S, this.oz + (b + 0.5) / S]; }
  /** 문·승강기·계단 앞을 비워 둔다: 문 너비만큼 양쪽 방으로 2.4 m (승강기·계단은 3 m), 정문·하역 문 안쪽은 3 m */
  keepDoors() {
    const L = this.L;
    const mark = (a, b) => { if (a < 0 || b < 0 || a >= this.gw || b >= this.gh) return; const k = this.k(a, b); if (this.o[k] === 0) this.o[k] = 3; };
    const zone = (c, dir, w, len, sides) => {
      const i = c % L.gw, j = (c / L.gw) | 0, [di, dj] = dir;
      const n = Math.round(len * S);
      const o0 = -Math.floor((w - 1) / 2), o1 = Math.ceil((w - 1) / 2);
      for (let o = o0; o <= o1; o++) for (let q = 0; q < S; q++) for (let t = 1; t <= n; t++) {
        if (di) {
          const ex = di > 0 ? (i + 1) * S : i * S, b = (j + o) * S + q;
          if (sides !== 'out') mark(di > 0 ? ex - t : ex + t - 1, b);
          if (sides === 'both') mark(di > 0 ? ex + t - 1 : ex - t, b);
        } else {
          const ez = dj > 0 ? (j + 1) * S : j * S, a = (i + o) * S + q;
          if (sides !== 'out') mark(a, dj > 0 ? ez - t : ez + t - 1);
          if (sides === 'both') mark(a, dj > 0 ? ez + t - 1 : ez - t);
        }
      }
    };
    // 작은 방(40 m² 아래)은 비워 둘 깊이를 반쯤으로 — 문 앞을 다 비우면 계산대 하나 놓을 자리도 없다 (걸어서 닿는지는 가구마다 따로 검사)
    const small = (c) => { const r = L.room[c]; const R = r ? L.rooms[r - 1] : null; return R && R.n < 40; };
    const roomAt = (c, dir) => { const i = c % L.gw + dir[0], j = ((c / L.gw) | 0) + dir[1]; return i >= 0 && j >= 0 && i < L.gw && j < L.gh ? j * L.gw + i : c; };
    for (const d of L.doors) { const sm = small(d.c) && (d.b < 0 || small(roomAt(d.c, d.dir))); zone(d.c, d.dir, Math.max(1, d.w), (['lift', 'cargo', 'stair'].includes(d.kind) ? 3 : 2.4) * (sm ? 0.5 : 1), d.b < 0 ? 'in' : 'both'); }
    for (const e of [L.ents.main, L.ents.dock]) if (e) zone(e.c, e.dir, (e.w || 2) + (small(e.c) ? 0 : 2), small(e.c) ? 1.5 : 3, 'in');
  }
}

/** 가구 하나의 바닥 자리(0.5 m 칸 범위)와 앞자리 */
function footprint(occ, f, x, z, rot) {
  const odd = rot % 2 === 1;
  const W = odd ? f.d : f.w, D = odd ? f.w : f.d;
  const [a0, b0] = occ.sub(x - W / 2 + 0.01, z - D / 2 + 0.01);
  const [a1, b1] = occ.sub(x + W / 2 - 0.01, z + D / 2 - 0.01);
  return { a0, b0, a1, b1, W, D };
}

export class Furnisher {
  constructor(B, L, opts = {}) {
    this.B = B; this.L = L;
    this.occ = new Occ(B, L);
    this.occ.keepDoors();
    this.list = [];
    this._n = 0; // 가구 번호 (치운 가구가 있어도 겹치지 않게)
    this.rnd = rngFor(B.seed, `furn${L.i}`);
    // 오가는 길(복도·승강기 홀·로비·넓은 홀)은 층 전체가 한 덩어리로 이어져 있어야 한다 — 가구가 길을 끊지 않게
    this.flowR = new Uint8Array(L.rooms.length + 1);
    for (const R of L.rooms) if (flowRoom(R)) this.flowR[R.id + 1] = 1;
    this.opts = opts;
    this.stats = { tried: 0, placed: 0, blocked: 0 };
  }

  /** 방 R 의 문 쪽 0.5 m 칸들 (길찾기 시작점) */
  _doorSubs(R) {
    const L = this.L, occ = this.occ, out = [];
    for (const d of L.doors) {
      if (d.a !== R.id && d.b !== R.id) continue;
      const i = d.c % L.gw, j = (d.c / L.gw) | 0;
      const inA = d.a === R.id;
      const ci = inA ? i : i + d.dir[0], cj = inA ? j : j + d.dir[1];
      for (let q = 0; q < S * S; q++) out.push(occ.k(ci * S + (q % S), cj * S + ((q / S) | 0)));
    }
    if (!out.length && R.main) { // 정문이 있는 홀
      const e = L.ents.main;
      if (e) { const i = e.c % L.gw, j = (e.c / L.gw) | 0; for (let q = 0; q < S * S; q++) out.push(occ.k(i * S + (q % S), j * S + ((q / S) | 0))); }
    }
    return out;
  }

  /** 방의 문마다 이 방 쪽 0.5 m 칸들 [[k…], …] */
  _doorGroups(R) {
    const L = this.L, occ = this.occ, out = [];
    for (const d of L.doors) {
      if (d.a !== R.id && d.b !== R.id) continue;
      const i = d.c % L.gw, j = (d.c / L.gw) | 0;
      const inA = d.a === R.id;
      const ci = inA ? i : i + d.dir[0], cj = inA ? j : j + d.dir[1];
      const w = Math.max(1, d.w), o0 = -Math.floor((w - 1) / 2);
      const g = [];
      for (let o = o0; o < o0 + w; o++) { const a = ci + (d.dir[1] ? o : 0), b = cj + (d.dir[0] ? o : 0); if (a < 0 || b < 0 || a >= L.gw || b >= L.gh) continue; for (let q = 0; q < S * S; q++) g.push(occ.k(a * S + (q % S), b * S + ((q / S) | 0))); }
      if (g.length) out.push(g);
    }
    return out;
  }
  /** 0.5 m 칸 (a, b) 를 왼쪽 아래로 하는 1 m 창이 pred 를 모두 만족하나 — 사람(반지름 0.35 m)은 1 m 너비면 지나간다 */
  _win(a, b, pred) {
    const occ = this.occ;
    if (a < 0 || b < 0 || a + 1 >= occ.gw || b + 1 >= occ.gh) return false;
    const k = occ.k(a, b);
    return pred(k) && pred(k + 1) && pred(k + occ.gw) && pred(k + occ.gw + 1);
  }
  /**
   * 방 안에서 걸어서 닿는가: 1 m 창이 비어 있는 곳으로만 (0.5 m 씩 옮겨 가며) — 첫 문에서 이 방의 다른 문 모두
   * (문끼리 이어져야 방을 지나갈 수 있다)와 닿아야 할 칸 목록(가구 앞자리)까지.
   */
  _reach(R, targets) {
    const occ = this.occ, rid = R.id + 1;
    // 오가는 공간(홀·복도·승강기 홀)은 서로 벽이 없다 — 그런 방은 이웃한 오가는 공간을 거쳐서도 이어진다 (조각난 홀·전시실)
    const fl = this.flowR[rid] === 1;
    const ok = fl ? (k) => (occ.rm[k] === rid || this.flowR[occ.rm[k]] === 1) && (occ.o[k] === 0 || occ.o[k] === 3) : (k) => occ.rm[k] === rid && (occ.o[k] === 0 || occ.o[k] === 3);
    const groups = this._doorGroups(R).map((g) => g.filter((k) => occ.rm[k] === rid)).filter((g) => g.length);
    const start = groups.length ? groups[0] : this._doorSubs(R).filter((k) => occ.rm[k] === rid);
    if (!start.length) return true; // 문이 없는 방(복도·홀의 일부)은 따지지 않는다 (오가는 길은 _keepsFlow 가 본다)
    const W = occ.gw;
    const seenW = new Uint8Array(occ.o.length), got = new Uint8Array(occ.o.length), q = [];
    const push = (a, b) => { if (a < 0 || b < 0 || a + 1 >= occ.gw || b + 1 >= occ.gh) return; const k = b * W + a; if (seenW[k] || !this._win(a, b, ok)) return; seenW[k] = 1; q.push(k); got[k] = got[k + 1] = got[k + W] = got[k + W + 1] = 1; };
    for (const k of start) { const a = k % W, b = (k / W) | 0; push(a, b); push(a - 1, b); push(a, b - 1); push(a - 1, b - 1); }
    if (!q.length) return false; // 첫 문 앞에 1 m 자리가 없다
    for (let h = 0; h < q.length; h++) { const k = q[h], a = k % W, b = (k / W) | 0; push(a + 1, b); push(a - 1, b); push(a, b + 1); push(a, b - 1); }
    for (const t of targets) if (t >= 0 && !got[t]) return false;
    for (const g of groups.slice(1)) if (!g.some((k) => got[k])) return false;
    return true;
  }

  /** 오가는 길의 0.5 m 칸인가 (가구·막힘이 아닌) */
  _net(k) { const o = this.occ.o[k]; return this.flowR[this.occ.rm[k]] === 1 && (o === 0 || o === 3); }
  /** 오가는 길(1 m 창)이 몇 덩어리인가 — 범위(a0..a1, b0..b1)를 주면 그 안에서 창마다 덩어리 번호 */
  _flowLabels(a0, a1, b0, b1) {
    const occ = this.occ, W = occ.gw;
    const fw = (a, b) => a >= a0 && a <= a1 && b >= b0 && b <= b1 && this._win(a, b, (k) => this._net(k));
    const lab = new Map();
    let id = 0;
    for (let b = b0; b <= b1; b++) for (let a = a0; a <= a1; a++) {
      const k0 = b * W + a;
      if (lab.has(k0) || !fw(a, b)) continue;
      id++;
      const q = [k0]; lab.set(k0, id);
      for (let h = 0; h < q.length; h++) { const k = q[h], x = k % W, y = (k / W) | 0; for (const [dx, dy] of FR) { const nx = x + dx, ny = y + dy, nk = ny * W + nx; if (!lab.has(nk) && fw(nx, ny)) { lab.set(nk, id); q.push(nk); } } }
    }
    return { lab, n: id };
  }
  /** 이 칸들(가구 자리)을 막아도 오가는 길이 끊기지 않나 — 둘레 창(가까운 범위의 가장자리)들의 이어짐이 그대로면 그대로, 아니면 층 전체 덩어리 수 */
  _keepsFlow(cells, prev) {
    const occ = this.occ, W = occ.gw;
    let a0 = 1e9, a1 = -1, b0 = 1e9, b1 = -1;
    for (const k of cells) { const a = k % W, b = (k / W) | 0; a0 = Math.min(a0, a); a1 = Math.max(a1, a); b0 = Math.min(b0, b); b1 = Math.max(b1, b); }
    const M = 5, x0 = Math.max(0, a0 - M), x1 = Math.min(occ.gw - 2, a1 + M), y0 = Math.max(0, b0 - M), y1 = Math.min(occ.gh - 2, b1 + M);
    const now = cells.map((k) => occ.o[k]);
    const after = this._flowLabels(x0, x1, y0, y1);
    cells.forEach((k, n) => { occ.o[k] = prev[n]; });
    const before = this._flowLabels(x0, x1, y0, y1);
    cells.forEach((k, n) => { occ.o[k] = now[n]; });
    // 가장자리 창: 전에 같은 덩어리였으면 뒤에도 같은 덩어리
    const map = new Map(), edgeB = new Set(), edgeA = new Set();
    let split = false;
    for (let y = y0; y <= y1 && !split; y++) for (let x = x0; x <= x1; x++) {
      if (x !== x0 && x !== x1 && y !== y0 && y !== y1) continue;
      const k = y * W + x, lb = before.lab.get(k), la = after.lab.get(k);
      if (lb) edgeB.add(lb);
      if (la) edgeA.add(la);
      if (!lb || !la) continue;
      if (!map.has(lb)) map.set(lb, la); else if (map.get(lb) !== la) { split = true; break; }
    }
    // 범위 안에 갇힌 덩어리: 전에는 가장자리(바깥)로 이어졌는데 이제는 아니면 (작은 승강기 홀이 진열대에 막히는 것처럼)
    if (!split) for (const [k, la] of after.lab) { if (edgeA.has(la)) continue; const lb = before.lab.get(k); if (lb && edgeB.has(lb)) { split = true; break; } }
    if (!split) return true;
    // 가까이에서 돌아갈 길이 없으면: 층 전체의 덩어리 수가 늘었나
    const nA = this._flowLabels(0, occ.gw - 2, 0, occ.gh - 2).n;
    cells.forEach((k, n) => { occ.o[k] = prev[n]; });
    const nB = this._flowLabels(0, occ.gw - 2, 0, occ.gh - 2).n;
    cells.forEach((k, n) => { occ.o[k] = now[n]; });
    return nA <= nB;
  }

  /**
   * 놓아 보기. 반환: 놓은 가구 또는 null.
   * o: { tag, wallOK(벽 앞 칸 허용), keep(앞을 비워 둠, 기본 true), noReach(길 검사 생략), data }
   */
  try(R, t, x, z, rot, o = {}) {
    const f = FIX[t];
    if (!f) return null;
    this.stats.tried++;
    const occ = this.occ, rid = R.id + 1;
    const fp = footprint(occ, f, x, z, rot);
    const cells = [];
    for (let b = fp.b0; b <= fp.b1; b++) for (let a = fp.a0; a <= fp.a1; a++) {
      if (a < 0 || b < 0 || a >= occ.gw || b >= occ.gh) return null;
      const k = occ.k(a, b);
      if (occ.rm[k] !== rid || occ.o[k] !== 0) return null;
      cells.push(k);
    }
    // 앞자리: 정면 쪽 front m (사람이 서서 쓰는 곳) — 방 안이고 가구가 없어야
    const [fx, fz] = FR[rot];
    const front = [];
    const fd = f.front ?? 0.8;
    const fw = rot % 2 ? fp.D : fp.W;
    if (fd > 0) {
      const steps = Math.max(1, Math.round(fd * S));
      for (let s = 1; s <= steps; s++) for (let u = 0; u < Math.round(fw * S); u++) {
        let a, b;
        if (fz) { a = fp.a0 + u; b = fz > 0 ? fp.b1 + s : fp.b0 - s; } else { b = fp.b0 + u; a = fx > 0 ? fp.a1 + s : fp.a0 - s; }
        if (a < 0 || b < 0 || a >= occ.gw || b >= occ.gh) return null;
        const k = occ.k(a, b);
        if (occ.rm[k] !== rid || occ.o[k] === 1 || occ.o[k] === 2) return null;
        front.push(k);
      }
    }
    // 뒤(back): 계산대·안내대처럼 뒤에 일하는 사람이 서는 것
    const back = [];
    if (f.back) {
      for (let s = 1; s <= Math.round(f.back * S); s++) for (let u = 0; u < Math.round(fw * S); u++) {
        let a, b;
        if (fz) { a = fp.a0 + u; b = fz > 0 ? fp.b0 - s : fp.b1 + s; } else { b = fp.b0 + u; a = fx > 0 ? fp.a0 - s : fp.a1 + s; }
        if (a < 0 || b < 0 || a >= occ.gw || b >= occ.gh) return null;
        const k = occ.k(a, b);
        if (occ.rm[k] !== rid || occ.o[k] === 1 || occ.o[k] === 2) return null;
        back.push(k);
      }
    }
    // 시험으로 놓아 보고, 문에서 모든 가구 앞까지 닿는지
    const prev = cells.map((k) => occ.o[k]);
    for (const k of cells) occ.o[k] = f.walk ? 0 : 2;
    if (!f.walk && this.flowR[rid] && !this._keepsFlow(cells, prev)) {
      cells.forEach((k, n) => { occ.o[k] = prev[n]; });
      this.stats.blocked++;
      return null;
    }
    const acc = front.length ? front[Math.floor(front.length / 2)] : -1;
    const mine = this.list.filter((q) => q.room === R.id && q.accK >= 0).map((q) => q.accK);
    if (!o.noReach && !this._reach(R, [...mine, acc, ...(back.length ? [back[Math.floor(back.length / 2)]] : [])])) {
      cells.forEach((k, n) => { occ.o[k] = prev[n]; });
      this.stats.blocked++;
      return null;
    }
    if (o.keep !== false) for (const k of front) if (occ.o[k] === 0) occ.o[k] = 3;
    for (const k of back) if (occ.o[k] === 0) occ.o[k] = 3;
    let ax = x, az = z;
    if (acc >= 0) { const [cx, cz] = occ.ctr(acc % occ.gw, (acc / occ.gw) | 0); ax = cx; az = cz; }
    let bx = null, bz = null;
    if (back.length) { const bk = back[Math.floor(back.length / 2)]; [bx, bz] = occ.ctr(bk % occ.gw, (bk / occ.gw) | 0); }
    const F = { id: `${this.L.i}:${this._n++}`, t, x, z, rot, w: f.w, d: f.d, h: f.h, room: R.id, ax, az, bx, bz, accK: acc, tag: o.tag || null, ...(o.keep === false ? { nokeep: true } : {}), ...(o.data || {}) };
    this.list.push(F);
    this.stats.placed++;
    return F;
  }

  /** 가구 하나 치우기: 자리 장부를 처음부터 다시 쓴다 (문 앞 + 남은 가구의 자리·앞자리·뒷자리) */
  remove(F) {
    const k = this.list.indexOf(F);
    if (k < 0) return false;
    this.list.splice(k, 1);
    const occ = new Occ(this.B, this.L);
    occ.keepDoors();
    this.occ = occ;
    for (const q of this.list) {
      const f = FIX[q.t];
      if (!f) continue;
      const fp = footprint(occ, f, q.x - (q.ndx || 0), q.z - (q.ndz || 0), q.rot);
      for (let b = fp.b0; b <= fp.b1; b++) for (let a = fp.a0; a <= fp.a1; a++) if (a >= 0 && b >= 0 && a < occ.gw && b < occ.gh && !f.walk) occ.o[occ.k(a, b)] = 2;
      const [fx, fz] = FR[q.rot], fw = q.rot % 2 ? fp.D : fp.W;
      const mark = (a, b) => { if (a >= 0 && b >= 0 && a < occ.gw && b < occ.gh && occ.o[occ.k(a, b)] === 0) occ.o[occ.k(a, b)] = 3; };
      if ((f.front ?? 0.8) > 0 && !q.nokeep) for (let st = 1; st <= Math.max(1, Math.round((f.front ?? 0.8) * S)); st++) for (let u = 0; u < Math.round(fw * S); u++) { if (fz) mark(fp.a0 + u, fz > 0 ? fp.b1 + st : fp.b0 - st); else mark(fx > 0 ? fp.a1 + st : fp.a0 - st, fp.b0 + u); }
      if (f.back) for (let st = 1; st <= Math.round(f.back * S); st++) for (let u = 0; u < Math.round(fw * S); u++) { if (fz) mark(fp.a0 + u, fz > 0 ? fp.b0 - st : fp.b1 + st); else mark(fx > 0 ? fp.a0 - st : fp.a1 + st, fp.b0 + u); }
    }
    return true;
  }

  // ── 자리 찾기 도구 ─────────────────────────────────────
  /** 방의 칸들 (1 m 칸) */
  cells(R) { const L = this.L, out = []; for (let c = 0; c < L.room.length; c++) if (L.room[c] === R.id + 1) out.push(c); return out; }
  /** 방의 경계 상자 (m) */
  box(R) {
    const L = this.L, G = this.B.G;
    return { x0: G.ox + R.i0, x1: G.ox + R.i1 + 1, z0: G.oz + R.j0, z1: G.oz + R.j1 + 1, cx: G.ox + R.cx + 0.5, cz: G.oz + R.cz + 0.5, w: R.i1 - R.i0 + 1, d: R.j1 - R.j0 + 1, L };
  }
  /** 벽 앞 자리들: 방 칸 가운데 이웃이 방 밖(벽)인 칸 → [{x, z, rot(벽을 등지고 방을 봄), ext(바깥벽인가)}] */
  wallSpots(R) {
    const L = this.L, G = this.B.G, out = [];
    const doorEdge = new Set(L.doors.map((d) => `${d.c}:${d.dir[0]}:${d.dir[1]}`));
    for (const c of this.cells(R)) {
      const i = c % L.gw, j = (c / L.gw) | 0;
      for (let k = 0; k < 4; k++) {
        const [di, dj] = FR[k];
        const ni = i - di, nj = j - dj; // 등 쪽 이웃 (정면의 반대)
        const e = ni >= 0 && nj >= 0 && ni < L.gw && nj < L.gh ? nj * L.gw + ni : -1;
        if (e >= 0 && L.room[e] === R.id + 1) continue;
        if (e >= 0 && L.void[e]) continue; // 뚫린 곳 가장자리는 난간
        if (doorEdge.has(`${c}:${-di}:${-dj}`) || (e >= 0 && doorEdge.has(`${e}:${di}:${dj}`))) continue;
        out.push({ i, j, x: G.ox + i + 0.5, z: G.oz + j + 0.5, rot: k, ext: e < 0 || !L.room[e] });
      }
    }
    return out;
  }
  /** 칸 c 와 이웃 칸 e 사이에 그려지는 칸막이가 c 쪽으로 들어온 두께 (render.partitions 와 같은 규칙: 오가는 공간끼리·설비 관 둘레는 없고, 유리는 받침 반) */
  _wallIn(c, e) {
    const L = this.L;
    if (e < 0 || !L.room[c] || !L.room[e] || L.room[c] === L.room[e]) return 0;
    const A = L.rooms[L.room[c] - 1], Bq = L.rooms[L.room[e] - 1];
    if (A.type === 'shaft' || Bq.type === 'shaft' || (flowRoom(A) && flowRoom(Bq))) return 0;
    return (ROOMS[A.type] && ROOMS[A.type].glass) || (ROOMS[Bq.type] && ROOMS[Bq.type].glass) ? 0.05 : PART_T / 2;
  }
  /**
   * 칸막이·바깥벽에 닿은 가구를 벽 속에서 밀어내기 (놓기가 다 끝난 뒤 한 번).
   * 자리 장부(0.5 m 칸)는 칸 경계까지를 방으로 재지만, 칸막이는 칸 경계 가운데에 0.14 m 두께로 서서 반이 이 방에 들어온다 —
   * 경계에 등·옆을 댄 가구는 칸막이 속에 7 cm 파고들고, 얇은 부분(선반 기둥)의 면이 칸막이 면과 같은 면이 되어 깜빡였다.
   * 밀어낸 자리가 다른 가구와 겹치면 그 가구는 그대로 둔다. 쓰는 자리(ax·az)는 앞자리 칸 그대로.
   */
  nudgeWalls() {
    const L = this.L, G = this.B.G, gw = L.gw, gh = L.gh, V = this.B.V, Fl = this.B.floors[L.i];
    // 칸 좌표 (칸 경계 = 정수): 틀 좌표에서 G.ox·G.oz 를 뺀 것 (격자 칸 수가 홀수면 틀의 칸 경계는 .5 에 있다)
    const cell = (i, j) => (i >= 0 && j >= 0 && i < gw && j < gh ? j * gw + i : -1);
    const rect = (q) => { const f = FIX[q.t], odd = q.rot % 2 === 1, W = odd ? f.d : f.w, D = odd ? f.w : f.d; return [q.x - G.ox - W / 2, q.z - G.oz - D / 2, q.x - G.ox + W / 2, q.z - G.oz + D / 2]; };
    let moved = 0, stuck = 0;
    const stuckList = [];
    for (const q of this.list) {
      const f = FIX[q.t];
      if (!f || f.walk) continue;
      const [x0, z0, x1, z1] = rect(q);
      // 한 옆(at, 바깥 쪽 sgn)이 칸 경계 X 에서 gap 만큼 떨어져 있을 때, 그 경계를 따라 [lo, hi] 칸들의 칸막이 두께 → 밀어낼 거리
      const side = (lo, hi, at, axis, sgn) => {
        const X = sgn < 0 ? Math.floor(at + 0.011) : Math.ceil(at - 0.011);
        const gap = sgn < 0 ? at - X : X - at;
        let need = 0;
        for (let u = Math.floor(lo + 0.01); u < hi - 0.01; u++) {
          const a = sgn < 0 ? X : X - 1, b = sgn < 0 ? X - 1 : X; // 안쪽 칸 · 바깥쪽 칸 (그 축의 칸 번호)
          const inC = axis === 'x' ? cell(a, u) : cell(u, a), outC = axis === 'x' ? cell(b, u) : cell(u, b);
          if (inC >= 0) need = Math.max(need, this._wallIn(inC, outC));
        }
        return need > gap + 0.002 ? need - gap + 0.005 : 0;
      };
      // 바깥벽: 바닥 칸은 칸 가운데가 안쪽 벽면보다 0.2 m 안이면 들어가니, 칸 경계에 댄 가구는 바깥벽 속으로 0.3 m 까지 들어갈 수 있다 —
      // 옆마다 세 점에서 안쪽 벽면까지의 거리(부피 거리장 + 벽 두께)를 재어, 벽면 밖으로 나간 만큼 더 민다
      const yA = Fl.y + 0.05, yB = Fl.y + Math.max(0.1, Math.min(f.h, Fl.ceil - Fl.y) - 0.05);
      // (지하층·중2층의 바깥 가장자리는 덮개 칸 경계 그대로라 바깥벽 속으로 들어가지 않는다)
      //  (벽 속에 든 점이라도 벽이 그 옆 쪽에 있을 때만 — 등이 벽에 든 가구의 옆면 끝점은 등 쪽 벽 속이지 옆 벽이 아니다: 거리장의 기울기로 가린다)
      const sd = (x, z) => sdfSpan(V, G.ox + x, G.oz + z, yA, yB) + WALL;
      const ext = Fl.below || Fl.mezz ? () => 0 : (ax, az, bx, bz, nx, nz) => {
        let m = -1;
        for (const k of [0.02, 0.5, 0.98]) {
          const x = ax + (bx - ax) * k, z = az + (bz - az) * k, d = sd(x, z);
          if (d <= -0.005) continue;
          const gx = sd(x + 0.05, z) - sd(x - 0.05, z), gz = sd(x, z + 0.05) - sd(x, z - 0.05), gl = Math.hypot(gx, gz) || 1;
          if ((gx * nx + gz * nz) / gl > 0.5) m = Math.max(m, d);
        }
        return m > -0.005 ? m + 0.01 : 0;
      };
      const l = Math.max(side(z0, z1, x0, 'x', -1), ext(x0, z0, x0, z1, -1, 0)), r = Math.max(side(z0, z1, x1, 'x', 1), ext(x1, z0, x1, z1, 1, 0));
      const b = Math.max(side(x0, x1, z0, 'z', -1), ext(x0, z0, x1, z0, 0, -1)), t = Math.max(side(x0, x1, z1, 'z', 1), ext(x0, z1, x1, z1, 0, 1));
      let dx = 0, dz = 0;
      if (l && !r) dx = l; else if (r && !l) dx = -r;
      if (b && !t) dz = b; else if (t && !b) dz = -t;
      if ((l && r) || (b && t)) { stuck++; stuckList.push(q); (this.stats.stuckWhy || (this.stats.stuckWhy = {}))['both:' + q.t] = ((this.stats.stuckWhy || {})['both:' + q.t] || 0) + 1; } // 양쪽이 다 벽인 좁은 틈 (밀 곳이 없다)
      if (!dx && !dz) continue;
      // 밀어낸 자리가 다른 가구(실제 크기)와 겹치지 않을 때만
      const n = [x0 + dx, z0 + dz, x1 + dx, z1 + dz];
      const hit = this.list.some((p) => { if (p === q || FIX[p.t].walk || p.room !== q.room) return false; const m = rect(p); return n[0] < m[2] - 0.001 && n[2] > m[0] + 0.001 && n[1] < m[3] - 0.001 && n[3] > m[1] + 0.001; });
      if (hit) { stuck++; stuckList.push(q); const w = this.stats.stuckWhy || (this.stats.stuckWhy = {}); w['hit:' + q.t] = (w['hit:' + q.t] || 0) + 1; continue; }
      q.x += dx; q.z += dz;
      q.ndx = dx; q.ndz = dz; // 걸음 칸(nav)·자리 장부는 밀기 전 자리(칸 경계)로 잰다 — 밀어낸 몇 cm 로 앞 칸이 막히지 않게
      moved++;
    }
    // 벽 속에서 밀어낼 곳이 없는 가구(v24 「벽뚫」): 쓰임의 일이 일어나는 자리(표시 tag 가 붙은 가구 — 진열대·계산대·책상·잠자리…)가 아니면 치운다.
    //  표시 가구는 남긴다 (그 방의 일이 사라지지 않게 — 남은 수는 wallStuck 으로 센다)
    let removed = 0;
    for (const q of new Set(stuckList)) if (!q.tag && this.remove(q)) { removed++; stuck--; }
    this.stats.nudged = moved;
    this.stats.wallStuck = stuck;
    this.stats.wallRemoved = removed;
    return moved;
  }
  /** 벽을 따라 줄지어 (등을 벽에): 바깥벽(창) 쪽을 피할지(tall) · 간격 gap m · 최대 n */
  alongWalls(R, t, o = {}) {
    const f = FIX[t], placed = [];
    let spots = this.wallSpots(R);
    if (o.avoidWindows && ROOMS[R.type] && ROOMS[R.type].win) spots = spots.filter((s) => !s.ext);
    if (o.onlyExt) spots = spots.filter((s) => s.ext);
    if (o.onlyBack) spots = spots.filter((s) => s.rot === 0);
    if (o.notFront) spots = spots.filter((s) => s.rot !== 2); // 정문 쪽(앞) 벽은 비운다
    if (o.prefer) spots.sort(o.prefer); else spots = shuffle(this.rnd, spots);
    const n = o.n ?? 99;
    for (const s of spots) {
      if (placed.length >= n) break;
      const [fx, fz] = FR[s.rot];
      // 등을 벽에 붙인다: 칸 가운데에서 등 쪽으로 (0.5 − 깊이/2)
      const off = 0.5 - f.d / 2;
      const x = s.x - fx * off, z = s.z - fz * off;
      // 벽을 따라 칸 사이에도 맞도록 반 칸 밀어 본다 (가구 너비가 짝수 칸이면)
      for (const sh of [0, 0.5, -0.5]) {
        const px = x + (fz ? sh : 0), pz = z + (fx ? sh : 0);
        const F = this.try(R, t, px, pz, s.rot, o);
        if (F) { placed.push(F); break; }
      }
    }
    return placed;
  }
  /** 방 가운데 줄: 긴 축을 따라 줄, 줄 사이 통로 aisle m. face: 'pair'(마주 봄)·'same'·'axis' */
  rows(R, t, o = {}) {
    const f = FIX[t], bx = this.box(R), placed = [];
    const along = o.axis ?? (bx.w >= bx.d ? 'x' : 'z'); // 줄이 뻗는 방향
    const aisle = o.aisle ?? 1.6, gap = o.gap ?? 0.2, margin = o.margin ?? 1.2;
    const rotA = o.rot ?? (along === 'x' ? 0 : 1); // 정면
    const fw = rotA % 2 ? f.d : f.w, fdp = rotA % 2 ? f.w : f.d; // 바닥에서의 가로·세로 (x·z)
    const lenAxis = along === 'x' ? fw : fdp, depAxis = along === 'x' ? fdp : fw;
    const pitch = depAxis + aisle;
    const a0 = (along === 'x' ? bx.x0 : bx.z0) + margin + lenAxis / 2, a1 = (along === 'x' ? bx.x1 : bx.z1) - margin - lenAxis / 2;
    const b0 = (along === 'x' ? bx.z0 : bx.x0) + margin + depAxis / 2, b1 = (along === 'x' ? bx.z1 : bx.x1) - margin - depAxis / 2;
    let row = 0;
    for (let b = b0; b <= b1 + 1e-6; b += pitch, row++) {
      for (let a = a0; a <= a1 + 1e-6; a += lenAxis + gap) {
        const x = along === 'x' ? a : b, z = along === 'x' ? b : a;
        let rot = rotA;
        if (o.face === 'pair' && row % 2) rot = (rotA + 2) % 4;
        const F = this.try(R, t, Math.round(x * 2) / 2, Math.round(z * 2) / 2, rot, o);
        if (F) { F.row = row; placed.push(F); if (o.n && placed.length >= o.n) return placed; }
      }
    }
    return placed;
  }
  /** 한 점 가까이 (나선으로 둘레를 찾는다) */
  near(R, t, x, z, rot, o = {}) {
    for (let r = 0; r <= (o.R ?? 6); r += 0.5) {
      const n = Math.max(1, Math.round(r * 6));
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        const px = Math.round((x + Math.cos(a) * r) * 2) / 2, pz = Math.round((z + Math.sin(a) * r) * 2) / 2;
        for (const rr of o.anyRot ? [rot, (rot + 1) % 4, (rot + 2) % 4, (rot + 3) % 4] : [rot]) {
          const F = this.try(R, t, px, pz, rr, o);
          if (F) return F;
        }
      }
    }
    return null;
  }
  /** 빈 곳 아무 데나 n 개 (장식) */
  scatter(R, t, n, o = {}) {
    const bx = this.box(R), out = [];
    for (let k = 0; k < n * 8 && out.length < n; k++) {
      const x = Math.round((bx.x0 + 1 + this.rnd() * (bx.x1 - bx.x0 - 2)) * 2) / 2, z = Math.round((bx.z0 + 1 + this.rnd() * (bx.z1 - bx.z0 - 2)) * 2) / 2;
      const F = this.try(R, t, x, z, Math.floor(this.rnd() * 4), o);
      if (F) out.push(F);
    }
    return out;
  }
  /** 방에서 정문(또는 방의 문) 쪽 방향 (0..3) */
  doorDir(R) {
    const L = this.L;
    const d = L.doors.find((q) => q.a === R.id || q.b === R.id);
    if (!d) return L.ents.main ? 0 : 0;
    const s = d.a === R.id ? 1 : -1;
    const dx = d.dir[0] * s, dz = d.dir[1] * s;
    return dz > 0 ? 0 : dx > 0 ? 1 : dz < 0 ? 2 : 3;
  }
  /** 정문 칸의 틀 좌표 */
  entry() { const e = this.L.ents.main; if (!e) return null; const G = this.B.G, L = this.L; return [G.ox + (e.c % L.gw) + 0.5, G.oz + ((e.c / L.gw) | 0) + 0.5, e.dir]; }
}
