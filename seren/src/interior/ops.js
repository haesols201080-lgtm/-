// 건물이 일한다 (v0.9): 들어간 건물의 층마다 쓰임(마트·식당·공장·물류·사무·연구·학교·병원·발전·교통·박물관·서고·호텔·행정·농장·공연·집)에 맞게
// 재고·기계·밭·수업·진료… 가 실제로 돌아가고, 사람들(agents)과 플레이어가 같은 시설을 쓴다.
//  · 세입자(tenant): 건물의 쓰임 묶음(B.zones)마다 하나 — 조직·살림(econ node)·일자리를 가진다.
//  · 물건 칸(slot): 진열대·선반·짐판·밭의 칸마다 실제 재고 수만큼 물건이 놓인다(InstancedMesh). 집으면 줄고, 채우면 는다.
//  · 플레이어: 바구니(산 물건), 손에 든 짐(상자·쟁반·결정), 맡은 일(교대·과제), 일자리 지원·면접·채용.
//  · 쓰임마다의 규칙은 ops-types.js (시설 쓰기·사람 일과·일자리 과제), 울림판 단말 앱은 apps.js.
import * as THREE from 'three';
import { GOODS, RECIPES } from '../data/goods.js';
import { ITEMS } from '../data/venues.js';
import { FUSE, FIX } from './catalog.js';
import { Agents } from './agents.js';
import { TYPES, roleOf } from './ops-types.js';
import { Apps } from './apps.js';
import { findPath } from './nav.js';
import { audio } from '../core/audio.js';
import { won } from '../data/money.js';
import { bookColor } from '../data/books.js';

const BOOK_NEAR = 8; // 이 거리(m) 안의 서가는 책을 한 권씩 그린다
const SHAPE = { box: [0.2, 0.16, 0.16], round: [0.16, 0.16, 0.16], bottle: [0.1, 0.26, 0.1], jar: [0.14, 0.18, 0.14], crystal: [0.1, 0.24, 0.1], flat: [0.3, 0.05, 0.22], sack: [0.28, 0.24, 0.2], flower: [0.1, 0.3, 0.1] };

export class Ops {
  constructor(game) {
    this.game = game;
    this.cur = null;
    this.agents = null;
    this.apps = new Apps(game, this);
    this.basket = []; // [{ g, from: slotKey, price, uid }]
    this.carry = null; // { g, n, from, kind: 'box'|'tray'|'crate'|'fuel'… }
    this.task = null; // 지금 하는 과제 { title, steps, k, pay, role }
    this._hudT = 0;
    this.t = 0;
  }
  get econ() { return this.game.econ; }
  get guide() { return this.game.guide; }
  get S() {
    const s = this.game.state;
    if (!s.work) s.work = { jobs: [], apps: [], shift: null, done: 0, earned: 0, edu: {}, research: {}, hotel: null };
    return s.work;
  }
  /** 건물마다 바뀌는 상태 (재고가 아닌 것: 수업 진도·연구·객실·전시 …) */
  bstate(uid) { const s = this.game.state; if (!s.bld) s.bld = {}; return s.bld[uid] || (s.bld[uid] = {}); }

  // ── 열기·닫기 ─────────────────────────────────
  open(cur) {
    const g = this.game, B = cur.B, ind = cur.indoor;
    this.cur = cur;
    this.agents = new Agents(g, ind, this);
    ind.agents = this.agents;
    // 세입자: 쓰임 묶음마다
    this.tenants = B.zones.map((Z, k) => {
      const op = Z.op;
      const org = Z.org ? B.orgs.find((o) => o.id === Z.org) : null;
      const floors = B.floors.filter((F) => F.zone === k).map((F) => F.i);
      const area = floors.reduce((a, i) => a + B.floors[i].n, 0);
      const zone = cur.r.zone && g.econ.S.Z[cur.r.zone] ? cur.r.zone : g.econ.zoneOf(cur.r.x, cur.r.z);
      const uid = `${cur.uid}#${k}`;
      const T = { k, Z, op, org, floors, area, zone, uid, node: null, type: TYPES[op] || TYPES.generic };
      T.node = g.econ.node(uid, zone, op, Math.max(1, area / 40));
      T.node.staff = Math.max(1, Math.round(area / 120));
      g.econ.watch.add(uid);
      return T;
    });
    this.byFloor = (i) => this.tenants.find((T) => T.floors.includes(i)) || this.tenants[0];
    this._listener = (ev, i, out) => { if (ev === 'build') this._floorBuilt(i, out); else if (ev === 'dispose') this._floorGone(i, out); else if (ev === 'floor') this._floorEntered(i); };
    ind.listeners.push(this._listener);
    for (const [i, out] of ind.built) this._floorBuilt(i, out);
  }
  entered(cur) {
    this._floorEntered(cur.indoor.cur);
    this.apps.onEnter(cur);
    // 도감: 처음 보는 건물의 짜임
    const B = cur.B, sc = (id) => this.game.scan && setTimeout(() => this.game.scan(id), 2500);
    if (B.special) sc({ heal: 'c_hospital', office: 'c_hq', school: 'c_campus', market: 'c_mart', library: 'c_library' }[B.pid] || null);
    else if (B.orgs.length >= 3) sc('c_mixed');
    if (['factory', 'depot', 'farm'].includes(B.pid)) sc('c_chain');
  }
  floorChanged(i) { this._floorEntered(i); if (this.task) this._guideTo(); }
  close(cur) {
    const g = this.game;
    // 계산하지 않은 바구니는 진열대로 돌려놓는다
    if (this.basket.length) this.returnBasket(true);
    if (this.carry) this.dropCarry(true);
    for (const T of this.tenants || []) g.econ.watch.delete(T.uid);
    if (this.agents) this.agents.clear();
    this.agents = null;
    this.cur = null;
    this.tenants = null;
    this.task = null;
    this.apps.close();
    void cur;
  }

  // ── 층이 그려질 때: 물건 칸·과정 ─────────────────
  _floorBuilt(i, out) {
    const T = this.byFloor(i);
    out.T = T;
    // 쓰임마다 처음 채우기 (재고·기계·밭…)
    const ty = T.type;
    if (ty.setup) ty.setup(this, T, out);
    // 물건 칸 그리기
    let cap = 0;
    for (const sl of out.slots.values()) for (const s of sl) cap += Math.min(40, s.n * (s.stack || 1));
    if (cap > 0) {
      // 실내에는 장면 빛이 없다 (실내 재질이 스스로 빛을 셈) → 면마다 밝기를 굳힌 꼭짓점 색 × 물건 색
      const geo = new THREE.BoxGeometry(1, 1, 1);
      const nrm = geo.attributes.normal, shade = new Float32Array(nrm.count * 3);
      for (let k = 0; k < nrm.count; k++) { const ny = nrm.getY(k), nx = nrm.getX(k); const v = ny > 0.5 ? 1.0 : ny < -0.5 ? 0.55 : nx !== 0 ? 0.78 : 0.86; shade[k * 3] = shade[k * 3 + 1] = shade[k * 3 + 2] = v; }
      geo.setAttribute('color', new THREE.BufferAttribute(shade, 3));
      const mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true }), Math.min(12000, cap));
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(mesh.count * 3), 3);
      mesh.frustumCulled = false;
      mesh.userData.indoor = true;
      mesh.userData.cap = mesh.count; // 그릴 수 있는 최대 수 (count 는 매번 실제 그린 수로 줄어든다)
      out.group.add(mesh);
      out.items = mesh;
      out.itemsDirty = true;
    }
  }
  _floorGone(i, out) { if (out.items) { out.items.geometry.dispose(); out.items.material.dispose(); } }
  _floorEntered(i) {
    if (!this.cur) return;
    const T = this.byFloor(i);
    // 이 층의 사람들 (없으면 새로)
    if (this.agents && !this.agents.list.some((a) => a.floor === i)) {
      const out = this.cur.indoor.built.get(i);
      if (out && T.type.people) T.type.people(this, T, out, i);
    }
    // 면접관: 면접이 기다리면 면접 자리에 (이 층이면)
    const ap = this.S.apps.find((a) => a.status === 'interview' && a.uid === this.cur.uid);
    const iv = ap && this.apps.ivSpot();
    if (iv && iv.floor === i && this.agents && !this.agents.list.some((a) => a.role === 'interviewer')) {
      const pl = this.cur.indoor.plan(i), F = pl.fix.find((f) => f.id === iv.fid);
      if (F) { const bx = F.bx ?? F.x, bz = F.bz ?? F.z; const a = this.agents.spawn({ key: `${this.cur.uid}:iv`, role: 'interviewer', title: '면접관', floor: i, gx: bx, gz: bz, plan: [{ face: Math.atan2(F.ax - bx, F.az - bz), act: F.tag === 'desk' || F.tag === 'interview' || F.tag === 'meeting' ? 'sitType' : 'wait', t: 30 }], next: () => [{ face: Math.atan2(F.ax - bx, F.az - bz), act: 'wait', t: 20 }] }); a.staff = true; a.keep = true; }
    }
    // 사람이 없는 층의 사람은 정리 (멀리 간 층)
    if (this.agents) for (const a of this.agents.list.slice()) if (Math.abs(a.floor - i) > 1 && !a.keep) this.agents.remove(a);
  }

  /** 칸 열쇠 → 그 칸의 물건 상태 (node.shelf) */
  slotState(T, key) { return T.node.shelf[key]; }
  /**
   * 시설 하나의 지금 상태 — 지도(imap)·안내가 쓰는 같은 살림 자료(node)에서.
   * 반환: { text, warn('empty'|'broken'|'dry'|null) } 또는 null (상태가 없는 가구)
   */
  fixState(i, F) {
    const T = this.byFloor ? this.byFloor(i) : null;
    const n = T && T.node;
    if (!n || !F) return null;
    const gn = (k) => (GOODS[k] || ITEMS[k] || {}).name || k;
    const pre = `${F.id}/`;
    // 진열 칸: 물건마다 남은 수 / 칸 크기
    const sk = Object.keys(n.shelf).filter((k) => k.startsWith(pre));
    if (sk.length) {
      const m = new Map();
      for (const k of sk) { const st = n.shelf[k]; const e = m.get(st.g) || { n: 0, cap: 0 }; e.n += st.n; e.cap += st.cap; m.set(st.g, e); }
      const parts = [...m].map(([g, e]) => `${gn(g)} ${e.n}/${e.cap}`);
      const empty = [...m.values()].some((e) => e.n <= 0);
      return { text: `진열 ${parts.slice(0, 3).join(' · ')}${parts.length > 3 ? ' …' : ''}${empty ? ' — 빈 칸 (창고에서 채울 차례)' : ''}`, warn: empty ? 'empty' : null };
    }
    // 기계: 공정 · 돌아감/멈춤/고장
    const mc = n.mach && n.mach[F.id];
    if (mc) {
      const name = (RECIPES[mc.rec] || {}).name || '공정';
      return { text: mc.broken ? `${name} — 고장, 정비가 필요해요` : mc.run ? `${name} — 도는 중 ${Math.round((mc.prog || 0) * 100)}% · 지금까지 ${mc.made || 0}` : `${name} — 멈춤 (원료·차례 기다림) · 지금까지 ${mc.made || 0}`, warn: mc.broken ? 'broken' : null };
    }
    // 밭: 자람 · 물
    const ck = Object.keys(n.crop || {}).filter((k) => k.startsWith(pre));
    if (ck.length) {
      const cs = ck.map((k) => n.crop[k]);
      const st = cs.reduce((a, c) => a + c.stage, 0) / cs.length, w = cs.reduce((a, c) => a + c.water, 0) / cs.length;
      return { text: `${gn(cs[0].g)} 자람 ${Math.round(st * 100)}% · 물 ${Math.round(w * 100)}%${st >= 1 ? ' — 거둘 때' : w < 0.2 ? ' — 목말라요' : ''}`, warn: w < 0.2 ? 'dry' : null };
    }
    // 원료 통·완성품 선반
    const bn = (n.bins || []).filter((b) => b.key.startsWith(pre));
    if (bn.length) return { text: bn.filter((b) => b.g).map((b) => `${gn(b.g)} ${Math.floor(b.n)}`).join(' · ') || '비어 있음', warn: bn.every((b) => !b.n) ? 'empty' : null };
    return null;
  }
  /** 물건 칸 다시 그리기 */
  _drawItems(out) {
    const m = out.items;
    if (!m) return;
    const T = out.T, n = T.node, cap = m.userData.cap ?? m.count;
    const mat = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), pos = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color();
    let k = 0;
    // 서가의 책등: 칸마다 실제 책(out.books) — 빌려 갔거나 손에 든 책의 자리는 비어 있다.
    // 서가가 아주 많은 층(수만 권)은 가까운 서가(BOOK_NEAR m 안)만 책 한 권씩, 먼 서가는 칸마다 책 덩어리 하나로 (플레이어가 움직이면 다시)
    const gone = out.books ? this.booksGone(out.i) : null;
    let pgx = 1e9, pgz = 1e9;
    if (out.books && this.cur && this.cur.indoor.cur === out.i) [pgx, pgz] = this.cur.indoor.grid(this.game.player.pos.x, this.game.player.pos.z);
    out._bookAt = [pgx, pgz];
    for (const [fid, slots] of out.slots) {
      const bk = out.books && out.books.get(fid);
      slots.forEach((s, si) => {
        if (bk) {
          const row = bk.spines[si] || [], per = row.length || 1, span = Math.max(0.2, s.w), F = s.fix;
          const cs = Math.cos(F.rot * Math.PI / 2), sn = Math.sin(F.rot * Math.PI / 2);
          q.setFromAxisAngle(up, (s.rot || 0) * Math.PI / 2);
          if (Math.hypot(F.x - pgx, F.z - pgz) > BOOK_NEAR) {
            if (k >= cap || !row[0]) return;
            pos.set(F.x + s.x * cs + s.z * sn, s.y + 0.14, F.z - s.x * sn + s.z * cs);
            sc.set(span * 0.97, 0.28, Math.min(0.32, s.d * 0.7));
            mat.compose(pos, q, sc);
            m.setMatrixAt(k, mat);
            col.set(bookColor(row[(si * 5) % per] || row[0])).multiplyScalar(0.8);
            m.setColorAt(k, col);
            k++;
            return;
          }
          row.forEach((id, e) => {
            if (!id || k >= cap || gone.has(`${fid}/${si}/${e}`)) return;
            let hh = 0;
            for (let c = 0; c < id.length; c++) hh = (hh * 33 + id.charCodeAt(c)) >>> 0;
            const w = (span / per) * (0.7 + (hh % 3) * 0.08), h = 0.22 + ((hh >> 3) % 9) * 0.012, d = Math.min(0.32, s.d * 0.7);
            const lx = s.x + ((e + 0.5) / per - 0.5) * span, lz = s.z;
            pos.set(F.x + lx * cs + lz * sn, s.y + h / 2, F.z - lx * sn + lz * cs);
            sc.set(w, h, d);
            mat.compose(pos, q, sc);
            m.setMatrixAt(k, mat);
            col.set(bookColor(id)).multiplyScalar(0.82 + ((hh >> 6) % 5) * 0.07);
            m.setColorAt(k, col);
            k++;
          });
          return;
        }
        const st = n.shelf[`${fid}/${si}`] || (n.bins && n.bins.find((b) => b.key === `${fid}/${si}`));
        if (!st || !st.g || st.n <= 0) return;
        const G = GOODS[st.g] || ITEMS[st.g] || {};
        const [w, h, d] = SHAPE[G.shape] || SHAPE.box;
        const per = Math.max(1, s.n);
        const shown = Math.min(st.n, per * (s.stack || 1), 40);
        const a = (s.rot || 0) * Math.PI / 2;
        q.setFromAxisAngle(up, a);
        const along = s.along === 'z';
        const span = Math.max(0.2, s.w);
        for (let e = 0; e < shown && k < cap; e++) {
          const layer = Math.floor(e / per), idx = e % per;
          const off = per > 1 ? ((idx / (per - 1)) - 0.5) * (span - w) : 0;
          const lx = s.x + (along ? 0 : off), lz = s.z + (along ? off : 0);
          // 고정물 로컬 → 틀 좌표 (fix 의 회전)
          const F = s.fix, cs = Math.cos(F.rot * Math.PI / 2), sn = Math.sin(F.rot * Math.PI / 2);
          pos.set(F.x + lx * cs + lz * sn, s.y + h / 2 + layer * (h + 0.02), F.z - lx * sn + lz * cs);
          sc.set(w, h, d);
          mat.compose(pos, q, sc);
          m.setMatrixAt(k, mat);
          col.set(G.color ?? 0xcccccc);
          m.setColorAt(k, col);
          k++;
        }
      });
    }
    m.count = k;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    out.itemsDirty = false;
  }
  /** 이 건물 이 층에서 자리가 빈 책 (빌린 책 + 손에 든 책) → Set('fid/칸/자리') */
  booksGone(i) {
    const out = new Set(), uid = this.cur && this.cur.uid;
    const L = this.game.state.lib;
    for (const b of (L && L.borrowed) || []) if (b.uid === uid && b.floor === i) out.add(`${b.fid}/${b.si}/${b.e}`);
    const c = this.carry;
    if (c && c.book && c.book.uid === uid && c.book.floor === i) out.add(`${c.book.fid}/${c.book.si}/${c.book.e}`);
    return out;
  }
  dirty(i) { const out = this.cur && this.cur.indoor.built.get(i ?? this.cur.indoor.cur); if (out) out.itemsDirty = true; }
  dirtyAll() { if (this.cur) for (const out of this.cur.indoor.built.values()) out.itemsDirty = true; }

  // ── 상호작용 ─────────────────────────────────
  /** 지금 층에서 플레이어 앞의 시설 */
  target(p) {
    const cur = this.cur;
    if (!cur || !this.game.interiors.inPocket) return null;
    const ind = cur.indoor, i = ind.cur, out = ind.built.get(i);
    if (!out || !out.T) return null;
    if (Math.abs(p.y - ind.yOf(i)) > 2.4) return null;
    const [gx, gz] = ind.grid(p.x, p.z);
    let best = null, bd = 1e9;
    for (const F of out.fix) {
      const iv = this.apps.ivPending(F, i);
      const h = iv ? { label: `면접 보기 · ${iv.title} (${iv.org})`, short: '면접', use: () => this.apps.interview(this.tenants.find((q) => q.k === iv.k)), r: 2.2 } : out.T.type.act && out.T.type.act(this, out.T, F, out);
      if (!h) continue;
      // 쓰는 자리(앞) 또는 가운데에서 가까우면
      const d = Math.min(Math.hypot(gx - F.ax, gz - F.az), Math.hypot(gx - F.x, gz - F.z) - Math.max(F.w, F.d) / 2 - 0.4, F.bx != null ? Math.hypot(gx - F.bx, gz - F.bz) : 1e9);
      if (d < (h.r || 1.3) && d < bd) { bd = d; best = { F, h }; }
    }
    // 하고 있는 과제의 다음 자리는 늘 먼저
    if (this.task) { const tk = this.taskTarget(gx, gz, out); if (tk) return tk; }
    if (!best) return null;
    const lab = typeof best.h.label === 'function' ? best.h.label() : best.h.label;
    return { kind: 'op', o: best, label: lab, short: best.h.short || '쓰기' };
  }
  use(t) {
    if (t.task) return this.taskStep(t);
    const h = t.o.h;
    if (h && h.use) h.use();
  }

  // ── 바구니·손에 든 것 ───────────────────────────
  /** 진열대 칸에서 하나 집기 (바구니로) */
  pick(T, key, out) {
    const st = T.node.shelf[key];
    if (!st || st.n <= 0) { this.game.ui.toast('그 칸은 비어 있어요', { kind: 'muted' }); return false; }
    if (this.carry) { this.game.ui.toast('손에 든 짐을 먼저 내려놓아요', { kind: 'muted' }); return false; }
    if (this.basket.length >= 16) { this.game.ui.toast('바구니가 가득 찼어요 — 계산대로 가요', { kind: 'muted' }); return false; }
    st.n--;
    this.basket.push({ g: st.g, from: key, price: this.econ.price(st.g), uid: T.uid, floor: out.i });
    out.itemsDirty = true;
    this.game.avatar && this.game.avatar.act && this.game.avatar.act('reach', 0.8);
    audio.blip && audio.blip({ hz: 700, to: 900, dur: 0.08, gain: 0.05 });
    this._basketVis();
    return true;
  }
  basketTotal() { return this.basket.reduce((a, b) => a + b.price, 0); }
  /** 바구니를 진열대로 되돌린다 */
  returnBasket(quiet = false) {
    if (!this.cur) { this.basket = []; this._basketVis(); return; }
    for (const b of this.basket) {
      const T = this.tenants.find((q) => q.uid === b.uid) || this.tenants[0];
      const st = T.node.shelf[b.from];
      if (st && st.g === b.g) st.n++; else T.node.stock[b.g] = (T.node.stock[b.g] || 0) + 1;
    }
    this.basket = [];
    this.dirtyAll();
    this._basketVis();
    if (!quiet) this.game.ui.toast('바구니의 물건을 제자리에 돌려놓았다', {});
  }
  /** 계산: 바구니 → 가방, 돈(울) → 그 가게 금고 */
  checkout(T, staffed = true) {
    const g = this.game;
    if (!this.basket.length) { g.ui.toast('바구니가 비어 있어요. 진열대에서 물건을 집어 와요', { kind: 'muted' }); return; }
    const total = Math.round(this.basketTotal() * 100) / 100;
    const have = g.state.inv.starseed || 0;
    const rows = {};
    for (const b of this.basket) rows[b.g] = (rows[b.g] || 0) + 1;
    const list = Object.entries(rows).map(([k, n]) => `<div class="svc-row"><b>${(GOODS[k] || ITEMS[k] || {}).name || k}</b> × ${n} · ${Math.round(n * this.econ.price(k) * 100) / 100}</div>`).join('');
    const wrap = g.ui.serviceCard(staffed ? '계산대' : '셀프 계산대', `모두 ${won(total)}`, `가진 돈 ${won(have)}. ${staffed ? '계산원이 물건을 하나씩 빛판에 대고 셉니다.' : '물건을 하나씩 빛판에 대어 세어요.'}`, [
      { label: `값 치르기 · ${won(total)}`, primary: true, disabled: have < total, onClick: () => this._pay(T, staffed) },
      { label: '몇 개 내려놓기', sub: '돈이 모자라면 비싼 것부터 진열대로 돌려놓는다', disabled: have >= total, onClick: () => { this._dropExpensive(have); this.checkout(T, staffed); } },
      { label: '그만두기', sub: '바구니는 그대로 들고 있는다' },
    ], `<div class="svc-list">${list}</div>`);
    void wrap;
  }
  _dropExpensive(budget) {
    this.basket.sort((a, b) => a.price - b.price);
    const back = [];
    while (this.basket.length && this.basketTotal() > budget) back.push(this.basket.pop());
    const keep = this.basket;
    this.basket = back;
    this.returnBasket(true);
    this.basket = keep;
    this._basketVis();
  }
  _pay(T, staffed) {
    const g = this.game, total = this.basketTotal();
    const paid = this.econ.transfer('player', `n:${T.uid}`, total, `계산 · ${T.org ? T.org.name : '가게'}`);
    if (paid < total - 1e-6) { g.ui.toast('돈이 모자라요', { kind: 'muted' }); return; }
    T.node.sales += paid;
    // 하나씩 세는 동안 (계산원 몸짓 · 삑 소리)
    const items = this.basket.slice();
    this.basket = [];
    this._basketVis();
    items.forEach((b, k) => setTimeout(() => audio.blip && audio.blip({ hz: 1200, to: 1400, dur: 0.05, gain: 0.05 }), k * 140));
    for (const b of items) this.game.state.inv[b.g] = (this.game.state.inv[b.g] || 0) + 1;
    g.ui.toast(`${items.length}개를 샀다 · −${won(Math.round(total * 100) / 100)} (남은 ${won(g.state.inv.starseed)})`, { kind: 'item' });
    if (staffed) this.say(T, 'thanks');
    if (this.game.lang) { const L = this.game.lang; if (!L.known('share')) L.learn('share', 'teach'); }
    this.game.setFlag && this.game.setFlag('boughtIndoor');
    this.game.scan && this.game.scan('c_starseed');
  }
  /** 손에 짐을 든다 (상자·쟁반·짐판·결정…) — 몸이 짐을 드는 자세가 된다 */
  takeCarry(c) {
    if (this.carry) { this.game.ui.toast('이미 짐을 들고 있어요', { kind: 'muted' }); return false; }
    if (this.basket.length) { this.game.ui.toast('바구니를 내려놓고(계산하거나 돌려놓고) 짐을 들어요', { kind: 'muted' }); return false; }
    this.carry = c;
    this._carryVis();
    audio.blip && audio.blip({ hz: 300, to: 220, dur: 0.12, gain: 0.06 });
    return true;
  }
  /** 짐 내려놓기 (그 자리 시설에 넣거나, 아무 데나 두면 원래 자리로) */
  dropCarry(back = false) {
    const c = this.carry;
    if (!c) return null;
    this.carry = null;
    this._carryVis();
    if (back && c.back) c.back(c);
    return c;
  }
  _basketVis() { const av = this.game.avatar; if (av && av.setHeld) av.setHeld(this.basket.length ? { kind: 'basket', n: this.basket.length } : this.carry ? { kind: this.carry.kind || 'box', color: this.carry.color ?? (GOODS[this.carry.g] || {}).color } : null); }
  _carryVis() { this._basketVis(); this.game.player.carrySlow = this.carry ? 0.78 : 1; }

  // ── 과제 (일) ───────────────────────────────────
  /** 과제 시작: steps = [{ at: 가구 찾기 함수(out) → F, label, do(F) → bool(끝났나) }] */
  startTask(task) {
    this.task = { ...task, k: 0, t0: this.game.world.clock.time };
    this.game.ui.toast(`할 일 · ${task.title}`, {});
    this._guideTo();
  }
  cancelTask() { if (this.carry) this.dropCarry(true); this.task = null; this.guide && this.guide.clear(); }
  taskTarget(gx, gz, out) {
    const tk = this.task, st = tk.steps[tk.k];
    if (!st || (tk.floor != null && tk.floor !== out.i)) return null;
    const F = st.at(out);
    if (!F) return null;
    const d = Math.min(Math.hypot(gx - F.ax, gz - F.az), Math.hypot(gx - F.x, gz - F.z) - Math.max(F.w, F.d) / 2 - 0.4);
    if (d > 1.5) return null;
    return { kind: 'op', task: true, o: { F, st }, label: `${tk.title} · ${st.label}`, short: st.short || '하기' };
  }
  taskStep(t) {
    const tk = this.task;
    if (!tk) return;
    const st = tk.steps[tk.k];
    const fin = () => {
      tk.k++;
      if (tk.k >= tk.steps.length) {
        this.task = null;
        this.guide && this.guide.clear();
        if (tk.done) tk.done();
        this.S.done++;
        if (tk.next) setTimeout(() => { const n = tk.next(); if (n) this.startTask(n); }, 400);
      } else this._guideTo();
    };
    const r = st.do(t.o.F, fin);
    if (r === true) fin();
  }
  _guideTo() {
    const tk = this.task;
    if (!tk || !this.cur || !this.guide) return;
    const ind = this.cur.indoor, st = tk.steps[tk.k];
    if (!st) return;
    // 지금 층부터 가까운 층 순서로: 그 단계의 자리(가구)가 있는 층으로 안내 (다른 층이면 계단·승강기부터)
    const order = [ind.cur, ...this.cur.B.floors.filter((F) => F.reach && !F.dead && F.i !== ind.cur).map((F) => F.i).sort((a, b) => Math.abs(a - ind.cur) - Math.abs(b - ind.cur))].slice(0, 30);
    for (const i of order) {
      let out = ind.built.get(i);
      if (!out) { const pl = ind.plan(i); if (!pl || pl.L.closed) continue; out = { i, fix: pl.fix, L: pl.L, slots: new Map(), T: this.byFloor(i) }; }
      let F = null;
      try { F = st.at(out); } catch { F = null; }
      if (!F) continue;
      tk.floor = i;
      this.guide.to({ floor: i, gx: F.ax, gz: F.az, label: st.label });
      return;
    }
  }

  // ── 교대 (일자리) ───────────────────────────────
  /** 이 건물에서 맡은 일자리 */
  myJobHere() { if (!this.cur) return null; return this.S.jobs.find((j) => j.uid === this.cur.uid) || null; }
  clockIn(job) {
    const g = this.game, S = this.S;
    if (g.tips && g.tips.first('shift', () => this.clockIn(job))) return;
    if (S.shift) { g.ui.toast('이미 일하는 중이에요', { kind: 'muted' }); return; }
    const t = g.world.clock.time % 1;
    const [a, b] = job.hours;
    if (t < a - 0.03 || t > b) { g.ui.toast(`교대 시간이 아니에요 (${hh(a)} ~ ${hh(b)})`, { kind: 'muted' }); return; }
    S.shift = { uid: job.uid, k: job.k, role: job.role, start: g.world.clock.time, tasks: 0 };
    g.ui.toast(`출근 · ${job.title} (${job.org})`, { kind: 'item' });
    const T = this.tenants.find((q) => q.k === job.k) || this.tenants[0];
    const role = roleOf(T.op, job.role);
    if (role && role.next) { const tk = role.next(this, T); if (tk) this.startTask(tk); }
  }
  clockOut() {
    const g = this.game, S = this.S, sh = S.shift;
    if (!sh) return;
    const job = S.jobs.find((j) => j.uid === sh.uid && j.k === sh.k);
    const hours = Math.max(0, (g.world.clock.time - sh.start) * 24);
    const T = this.tenants && this.tenants.find((q) => q.k === sh.k);
    const due = Math.round((hours * (job ? job.wage : 1) + sh.tasks * 0.5) * 100) / 100;
    const from = T ? `n:${T.uid}` : `z:${this.econ.zoneOf(g.player.pos.x, g.player.pos.z)}:firms`;
    const paid = this.econ.transfer(from, 'player', due, `품삯 · ${job ? job.title : ''}`);
    S.shift = null;
    S.earned += paid;
    if (job) { job.worked = (job.worked || 0) + hours; job.rating = Math.min(5, (job.rating || 3) + (sh.tasks >= 3 ? 0.2 : 0)); }
    this.cancelTask();
    g.ui.toast(`퇴근 · ${hours.toFixed(1)}시간 · 과제 ${sh.tasks} · +${won(paid)}${paid < due ? ` (금고에 ${Math.round((due - paid) * 10) / 10} 모자람)` : ''}`, { kind: 'item' });
    if (g.venues) { g.venues.S.worked++; g.venues.S.earned += paid; }
    g.setFlag && g.setFlag('helpedNeighbor');
  }
  /** 과제 하나 마칠 때 (교대 중이면 셈) */
  taskDone(T) { if (this.S.shift) this.S.shift.tasks++; void T; }

  /** 그 가게·건물 사람이 한마디 */
  say(T, kind) {
    if (!this.agents) return;
    const p = this.game.player.pos;
    let best = null, bd = 1e9;
    for (const a of this.agents.visible()) { const d = Math.hypot(a.pos.x - p.x, a.pos.z - p.z); if (d < bd && a.staff) { bd = d; best = a; } }
    if (best && bd < 12 && this.game.citizens) { best.anim.speakT = 1.4; this.game.citizens._line && this.game.citizens._line(best, kind); }
  }

  // ── 매 프레임 ─────────────────────────────────
  update(dt) {
    this.t += dt;
    this.apps.tick(dt);
    const cur = this.cur;
    if (!cur) { this._hud(dt); return; }
    if (this.agents && this.game.interiors.inPocket) this.agents.update(dt);
    for (const out of cur.indoor.built.values()) {
      if (out.T && out.T.type.tick) out.T.type.tick(this, out.T, out, dt);
      // 서가가 있는 층: 3 m 넘게 움직이면 가까운 서가의 책등을 다시
      if (out.books && out.i === cur.indoor.cur && out._bookAt) { const [gx, gz] = cur.indoor.grid(this.game.player.pos.x, this.game.player.pos.z); if (Math.hypot(gx - out._bookAt[0], gz - out._bookAt[1]) > 3) out.itemsDirty = true; }
      if (out.itemsDirty) this._drawItems(out);
    }
    // 교대가 끝날 시각이면 알림
    const sh = this.S.shift;
    if (sh) {
      const job = this.S.jobs.find((j) => j.uid === sh.uid && j.k === sh.k);
      const t = this.game.world.clock.time % 1;
      if (job && t > job.hours[1] && !sh.warned) { sh.warned = true; this.game.ui.toast('교대 시간이 끝났어요 — 출근 단말에서 퇴근', {}); }
    }
    this._hud(dt);
  }
  /** 화면 구석: 바구니·짐·과제·교대 */
  _hud(dt) {
    this._hudT -= dt;
    if (this._hudT > 0) return;
    this._hudT = 0.5;
    const ui = this.game.ui;
    if (!ui.root) return;
    if (!this.hudEl) { this.hudEl = document.createElement('div'); this.hudEl.className = 'ops-hud'; ui.root.appendChild(this.hudEl); }
    const parts = [];
    if (this.basket.length) parts.push(`<span class="b">바구니 ${this.basket.length}개 · ${won(Math.round(this.basketTotal() * 100) / 100)}</span>`);
    if (this.carry) parts.push(`<span class="c">손에 든 것 · ${(GOODS[this.carry.g] || ITEMS[this.carry.g] || {}).name || this.carry.label || '짐'}${this.carry.n > 1 ? ` ×${this.carry.n}` : ''}</span>`);
    if (this.task) { const st = this.task.steps[this.task.k]; parts.push(`<span class="t">할 일 · ${this.task.title}${st ? ` — ${st.label}` : ''}</span>`); }
    const gd = this.game.guide;
    if (gd && gd.goal && gd.text) parts.push(`<span class="g">안내 · ${gd.text}</span>`);
    const sh = this.S.shift;
    if (sh) { const job = this.S.jobs.find((j) => j.uid === sh.uid && j.k === sh.k); parts.push(`<span class="s">일하는 중 · ${job ? job.title : ''} · 과제 ${sh.tasks}</span>`); }
    const html = parts.join('');
    if (html !== this._hh) { this.hudEl.innerHTML = html; this._hh = html; }
  }
}

export const hh = (t) => { const m = Math.round((t % 1) * 24 * 60); return `${Math.floor(m / 60)}시${m % 60 ? ` ${m % 60}분` : ''}`; };
export { findPath, FUSE, FIX };
