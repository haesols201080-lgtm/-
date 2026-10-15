// 짐수레 (v24 「화물 승강기: 화물 카트·상자·팔레트 등 실제 물류 오브젝트를 싣고 다른 층으로 옮길 수 있어야」)
//  · 화물 승강기가 있는 건물: 화물 승강기마다 수레 하나가 아래 정거장(1층이 서면 1층)의 승강기 문 옆에 서 있다 — 상자 몇 개를 실은 뜬수레.
//  · E 「짐수레 밀기」: 손잡이를 잡고 앞에 밀고 다닌다(ops.carry kind 'cart'). 수레는 제 충돌이 있어(player.cart) 벽·가구에 묻히지 않는다.
//  · 수레는 승객 승강기·계단으로 못 간다 — 승객 승강기 문 막이와 계단 문 막이가 서고(interior/building), 승객 승강기 부르기 판은
//    「화물 승강기로」라고 알려 준다. 화물 승강기 칸에는 수레째 들어가 다른 층으로 간다(칸은 탄 사람을 옮기고 수레는 그 손에).
//  · 이 건물 직원이면 「화물 옮기기」 과제: 수레의 짐은 구역 창고에서 실은 것, 화물 승강기가 서는 다른 층의 창고·짐판에 내리면 그 세입자의 재고로.
//    길 안내는 수레를 민 동안 화물 승강기로만 잇는다(guide.floorRoute).
//  · E 「짐수레 세우기」로 아무 데나(칸 안 말고) 세워 둔다. 건물을 나가면 수레는 제자리로, 못 내린 짐은 창고로 돌아간다.
import * as THREE from 'three';
import { GOODS } from '../data/goods.js';
import { litMaterial, glowMaterial } from '../world/materials.js';
import { audio } from '../core/audio.js';

export const CART = { d: 0.95, r: 0.4, w: 0.72, l: 0.95 }; // 몸 가운데에서 수레 가운데까지 · 충돌 반지름 · 폭 · 길이
const STORE_TAGS = ['stock', 'raw', 'finished', 'pallet', 'produce', 'fuel'];

let _mats = null;
const mats = () => _mats || (_mats = {
  deck: litMaterial({ color: 0xd9dde2, rim: 0.5, spec: 0.7, rimColor: 0xbffcff }),
  frame: litMaterial({ color: 0x5d6873, spec: 0.6 }),
  glow: glowMaterial({ color: 0x7ff3e6, intensity: 1.6 }),
});
const geos = {};
const geo = (k, f) => geos[k] || (geos[k] = f());

/** 뜬수레 모양 (로컬 +z = 앞, 손잡이는 −z 쪽) — 상자는 load 에 따라 */
export function cartModel(load) {
  const M = mats(), g = new THREE.Group();
  const deck = new THREE.Mesh(geo('deck', () => new THREE.BoxGeometry(CART.w, 0.07, CART.l)), M.deck);
  deck.position.y = 0.26;
  const skirt = new THREE.Mesh(geo('skirt', () => new THREE.BoxGeometry(CART.w - 0.08, 0.1, CART.l - 0.08)), M.frame);
  skirt.position.y = 0.18;
  const under = new THREE.Mesh(geo('under', () => new THREE.BoxGeometry(CART.w - 0.16, 0.015, CART.l - 0.16)), M.glow); // 떠 있게 하는 빛 (바닥에 비친다)
  under.position.y = 0.12;
  g.add(deck, skirt, under);
  // 손잡이: 뒤쪽 두 기둥 + 가로대 (허리 높이)
  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(geo('post', () => new THREE.BoxGeometry(0.04, 0.72, 0.04)), M.frame);
    post.position.set(sx * (CART.w / 2 - 0.05), 0.62, -CART.l / 2 + 0.03);
    g.add(post);
  }
  const bar = new THREE.Mesh(geo('bar', () => new THREE.CylinderGeometry(0.025, 0.025, CART.w - 0.04, 8)), M.frame);
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, 0.97, -CART.l / 2 + 0.03);
  const grip = new THREE.Mesh(geo('grip', () => new THREE.BoxGeometry(CART.w * 0.5, 0.03, 0.05)), M.glow);
  grip.position.set(0, 0.955, -CART.l / 2 + 0.03);
  g.add(bar, grip);
  // 짐: 상자 (물건 색 띠) — 한 줄에 두 개, 두 층까지
  const crates = new THREE.Group();
  g.add(crates);
  g.userData.crates = crates;
  setLoad(g, load);
  g.traverse((o) => { o.userData.indoor = true; });
  return g;
}
/** 수레 위 상자를 짐에 맞게 (아래 2×2, 위 2 — 상자 하나가 물건 두 개) */
const SLOTS = [[-0.17, 0.43, -0.2], [0.17, 0.43, -0.2], [-0.17, 0.43, 0.22], [0.17, 0.43, 0.22], [-0.17, 0.7, 0.01], [0.17, 0.7, 0.01]];
const crateMat = {};
const cmat = (col) => crateMat[col] || (crateMat[col] = litMaterial({ color: col, spec: 0.3, emissive: col === 0xc8b48a ? 0 : 0x111111 }));
export function setLoad(g, load) {
  const C = g.userData.crates;
  while (C.children.length) C.remove(C.children[0]);
  const items = [];
  for (const it of load || []) for (let k = 0; k < Math.ceil(it.n / 2); k++) items.push(it.g);
  items.slice(0, SLOTS.length).forEach((gk, k) => {
    const col = (GOODS[gk] && GOODS[gk].color) ?? 0x9a8a6a;
    const [x, y, z] = SLOTS[k];
    const m = new THREE.Mesh(geo('crate', () => new THREE.BoxGeometry(0.3, 0.26, 0.38)), cmat(0xc8b48a));
    const band = new THREE.Mesh(geo('band', () => new THREE.BoxGeometry(0.31, 0.05, 0.39)), cmat(col));
    m.position.set(x, y, z); band.position.set(x, y + 0.05, z);
    m.userData.indoor = band.userData.indoor = true;
    C.add(m, band);
  });
}

export class Carts {
  constructor(ops) { this.ops = ops; this.game = ops.game; this.list = []; this.seeded = new Set(); this._tt = 0; }
  get ind() { return this.ops.cur && this.ops.cur.indoor; }
  /** 지금 수레를 밀고 있나 */
  pushing() { const c = this.ops.carry; return c && c.kind === 'cart' ? c.cart : null; }

  /** 이 층에 화물 승강기가 있으면 그 수레를 놓는다 (처음 그 층이 지어질 때) */
  _seed(i, out) {
    const ind = this.ind, B = this.ops.cur.B;
    for (const L of out.lifts || []) {
      if (!L.cargo || !L.stops || L.link == null || this.seeded.has(L.link)) continue;
      const lk = B.links.find((k) => k.id === L.link);
      const fl = lk ? lk.floors : L.stops;
      const home = fl.includes(B.ground) ? B.ground : fl.reduce((a, b) => (ind.yOf(a) <= ind.yOf(b) ? a : b), fl[0]);
      if (home !== i) continue;
      this.seeded.add(L.link);
      const [fx, fz] = L.front, sx = fz ? 1 : 0, sz = fx ? 1 : 0;
      const ag = this.ops.agents, pl = ind.plan(i);
      // 승강기 문 옆 빈 바닥: 걸을 수 있고, 가구 앞(쓰는 자리)·다른 문 앞·승강기 문 앞을 막지 않는 곳
      const clear = (x, z) => {
        if (pl && pl.fix.some((F) => Math.hypot(x - F.ax, z - F.az) < 1.3 || Math.hypot(x - F.x, z - F.z) < Math.max(F.w, F.d) / 2 + 0.7)) return false;
        if ((out.doors || []).some((d) => Math.hypot(x - d.x, z - d.z) < 1.6)) return false;
        for (const Q of out.lifts || []) { const rx = x - Q.x, rz = z - Q.z, n = rx * Q.front[0] + rz * Q.front[1], sd = Q.front[1] ? rx : rz; if (n > -0.2 && n < 2.2 && Math.abs(sd) < Q.W / 2 + 0.6) return false; }
        return true;
      };
      let gx = null, gz = null;
      for (const dn of [1.6, 2.4, 3.2, 1.0]) for (const ds of [1, -1]) for (const dw of [0.9, 1.6, 2.4]) {
        if (gx != null) break;
        const tx = L.x + fx * dn + sx * ds * (L.W / 2 + dw), tz = L.z + fz * dn + sz * ds * (L.W / 2 + dw);
        const [ax, az] = ag ? ag.freeNear(i, tx, tz) : [tx, tz];
        if (Math.hypot(ax - tx, az - tz) < 0.4 && clear(ax, az)) { gx = ax; gz = az; }
      }
      if (gx == null) continue; // 문 옆에 둘 곳이 없으면 이 승강기에는 수레를 두지 않는다 (쓰는 자리를 막느니)
      const [wx, wz] = ind.world(L.x + fx, L.z + fz), [cx, cz] = ind.world(gx, gz);
      const cart = { id: this.list.length, link: L.link, floor: i, gx, gz, yaw: Math.atan2(wx - cx, wz - cz), load: null, mesh: null, col: null };
      cart.home = { floor: i, gx, gz, yaw: cart.yaw };
      this.list.push(cart);
      this._loadFor(cart); // 다른 층 창고로 갈 상자를 싣고 서 있다 (건물을 나가면 창고로 돌아간다)
    }
  }

  /** 수레를 민다 */
  take(cart) {
    const ops = this.ops, g = this.game, ind = this.ind;
    if (ops.carry || ops.basket.length) { g.ui.toast('손에 든 것을 먼저 내려놓아요', { kind: 'muted' }); return; }
    const job = ops.myJobHere() || g.debugAccess;
    if (!cart.load && job && !ops.task) this._loadFor(cart);
    ops.takeCarry({ kind: 'cart', cart, label: this._label(cart), back: (c) => this._home(c.cart) });
    this._hideParked(cart);
    g.player.cart = CART;
    g.player.carrySlow = 0.7;
    audio.noise && audio.noise({ freq: 260, q: 0.8, dur: 0.4, gain: 0.05, type: 'lowpass' });
    if (cart.load && cart.dest != null && job && !ops.task) {
      const dest = cart.dest, fid = cart.fid, T = ops.byFloor(dest), F = ind.cur != null ? this.ops.cur.B.floors[dest] : null;
      ops.startTask({
        title: '화물 옮기기', uid: ops.cur.uid,
        steps: [{ label: `${F ? F.label : dest}층 ${cart.room || '창고'}에 짐 내리기 (화물 승강기로)`, short: '내리기', at: (o) => (o.i === dest ? (o.fix || []).find((f) => f.id === fid) || null : null), do: () => { this._deliver(cart, T); return true; } }],
      });
    } else if (!job) g.ui.toast('짐수레를 잡았다 · 화물 승강기는 직원 출입증이 있어야 불러요', { kind: 'muted' });
    else if (!cart.load) g.ui.toast('빈 짐수레 · 화물 승강기로 다른 층에 옮길 수 있어요', {});
  }
  /** 구역 창고에서 다른 층 창고로 갈 짐을 싣는다 */
  _loadFor(cart) {
    const ops = this.ops, ind = this.ind, B = ops.cur.B, econ = this.game.econ;
    const lk = B.links.find((k) => k.id === cart.link);
    let best = null;
    for (const j of (lk ? lk.floors : [])) {
      if (j === cart.floor) continue;
      const pl = ind.plan(j);
      if (!pl || pl.L.closed) continue;
      const F = pl.fix.find((f) => STORE_TAGS.includes(f.tag));
      if (F && (!best || Math.abs(j - cart.floor) < Math.abs(best.j - cart.floor))) best = { j, F, R: pl.L.rooms[F.room] };
    }
    if (!best) return;
    const T = ops.byFloor(best.j), Z = econ.S.Z[T.zone];
    if (!Z) return;
    const want = Object.keys(T.node.stock || {}).filter((k) => GOODS[k]);
    const pool = Object.entries(Z.depot || {}).filter(([k, v]) => GOODS[k] && v >= 1).sort((a, b) => (want.includes(b[0]) - want.includes(a[0])) || b[1] - a[1]).slice(0, 3);
    const load = [];
    for (const [k] of pool) { const n = econ.take(T.zone, 'depot', k, 2 + Math.floor(Math.random() * 3)); if (n > 0) load.push({ g: k, n }); }
    if (!load.length) return;
    cart.load = load; cart.dest = best.j; cart.fid = best.F.id; cart.room = best.R && best.R.name; cart.zone = T.zone;
  }
  _label(cart) {
    const n = (cart.load || []).reduce((a, it) => a + it.n, 0);
    return n ? `짐수레 (상자 ${n})` : '빈 짐수레';
  }
  /** 다른 층 창고에 짐을 내린다 → 그 세입자 재고 */
  _deliver(cart, T) {
    const ops = this.ops, g = this.game;
    const n = (cart.load || []).reduce((a, it) => a + it.n, 0);
    for (const it of cart.load || []) T.node.stock[it.g] = (T.node.stock[it.g] || 0) + it.n;
    cart.load = null; cart.dest = null;
    if (ops.carry && ops.carry.cart === cart) ops.carry.label = this._label(cart);
    ops.taskDone(T);
    const out = this.ind.built.get(this.ind.cur);
    if (out) out.itemsDirty = true;
    g.avatar && g.avatar.act && g.avatar.act('stock', 1.4);
    audio.blip && audio.blip({ hz: 520, to: 700, dur: 0.12, gain: 0.06 });
    g.ui.toast(`상자 ${n}개를 내렸다 · ${T.org ? T.org.name : '이 층'} 재고로`, { kind: 'item' });
  }
  /** 수레 세우기 (몸 앞 그 자리에) */
  park() {
    const ops = this.ops, g = this.game, ind = this.ind, cart = this.pushing();
    if (!cart) return;
    if (this.game.interiors.lifts && this.game.interiors.lifts.inCar()) { g.ui.toast('칸 안에는 세워 두지 못해요 — 내려서 세워요', { kind: 'muted' }); return; }
    const p = g.player.pos, yaw = g.player.yaw;
    const [gx, gz] = ind.grid(p.x + Math.sin(yaw) * CART.d, p.z + Math.cos(yaw) * CART.d);
    Object.assign(cart, { floor: ind.cur, gx, gz, yaw });
    ops.dropCarry(false);
    this._released();
    audio.noise && audio.noise({ freq: 200, q: 0.8, dur: 0.3, gain: 0.05, type: 'lowpass' });
  }
  /** 제자리로 (건물을 나갈 때·과제를 그만둘 때) — 못 내린 짐은 창고로 */
  _home(cart) {
    if (cart.load && cart.zone) for (const it of cart.load) this.game.econ.give(cart.zone, 'depot', it.g, it.n);
    cart.load = null; cart.dest = null;
    Object.assign(cart, cart.home);
    this._released();
  }
  _released() { const pl = this.game.player; pl.cart = null; pl.carrySlow = 1; }
  _hideParked(cart) { if (cart.mesh) cart.mesh.visible = false; if (cart.col) { this.game.world.colliders.remove(cart.col); cart.col = null; } }

  /** 이 층의 서 있는 수레 앞: 밀기 · 밀고 있으면: 세우기 */
  target(i, gx, gz) {
    const pc = this.pushing();
    if (pc) return { kind: 'op', o: { F: { id: -1, x: gx, z: gz }, h: { use: () => this.park() } }, label: `${this._label(pc)} · 여기 세우기`, short: '세우기' };
    let best = null, bd = 1.5;
    for (const c of this.list) {
      if (c.floor !== i || !c.mesh || !c.mesh.visible) continue;
      const d = Math.hypot(gx - c.gx, gz - c.gz) - 0.45;
      if (d < bd) { bd = d; best = c; }
    }
    if (!best) return null;
    const c = best, dest = c.load && c.dest != null ? ` → ${this.ops.cur.B.floors[c.dest].label}층` : '';
    return { kind: 'op', o: { F: { id: -1, x: c.gx, z: c.gz }, h: { use: () => this.take(c) } }, label: `${this._label(c)}${dest} · 밀기`, short: '밀기', d: bd };
  }

  update(dt) {
    const ind = this.ind, g = this.game;
    if (!ind) return;
    const out = ind.built.get(ind.cur);
    if (out) this._seed(ind.cur, out);
    const pc = this.pushing();
    const C = g.world.colliders, scene = g.engine.scene;
    for (const c of this.list) {
      if (c === pc) continue;
      if (c.floor !== ind.cur) { this._hideParked(c); continue; }
      const [x, z] = ind.world(c.gx, c.gz);
      const inCell = ind.keyAt(c.floor, x, z) === ind.cellKey || ind.keyAt(c.floor, x, z) == null;
      if (!inCell) { this._hideParked(c); continue; }
      if (!c.mesh) { c.mesh = cartModel(c.load); scene.add(c.mesh); c._shown = c.load; }
      if (c._shown !== c.load) { setLoad(c.mesh, c.load); c._shown = c.load; }
      const y = ind.yOf(c.floor);
      c.mesh.position.set(x, y, z); c.mesh.rotation.set(0, c.yaw, 0); c.mesh.visible = true;
      if (!c.col) c.col = C.add({ type: 'box', x, z, hx: CART.w / 2, hz: CART.l / 2, rot: c.yaw, y0: y - 0.2, y1: y + 1.0, walk: false, city: true, sky: true, stream: true });
    }
    // 밀고 있는 수레: 몸 앞에 (손잡이가 손에)
    if (pc) {
      if (!pc.mesh) { pc.mesh = cartModel(pc.load); scene.add(pc.mesh); pc._shown = pc.load; }
      if (pc._shown !== pc.load) { setLoad(pc.mesh, pc.load); pc._shown = pc.load; }
      const p = g.player.pos, yaw = g.player.yaw;
      pc.mesh.visible = g.interiors.inPocket;
      pc.mesh.position.set(p.x + Math.sin(yaw) * CART.d, p.y, p.z + Math.cos(yaw) * CART.d);
      pc.mesh.rotation.set(0, yaw, 0);
      // 계단·승객 승강기 앞에서 한 번 알려 준다 (문 막이가 수레를 막는다)
      if ((this._tt -= dt) < 0 && out) {
        const [gx, gz] = ind.grid(p.x + Math.sin(yaw) * CART.d, p.z + Math.cos(yaw) * CART.d);
        const nearBar = (out.cartBars || []).some((b) => b.col && Math.hypot(gx - b.d.x, gz - b.d.z) < 1.1);
        const nearLift = (out.lifts || []).some((L) => L.stops && !L.cargo && Math.hypot(gx - L.x, gz - L.z) < 1.2);
        if (nearBar || nearLift) { this._tt = 5; g.ui.toast(nearBar ? '짐수레는 계단으로 못 가요 — 화물 승강기로' : '승객 승강기에는 짐수레를 싣지 않아요 — 화물 승강기로', { kind: 'muted' }); }
      }
    }
  }
  /** 건물을 나갈 때: 그린 것·충돌체를 치운다 (짐은 ops.close 의 dropCarry → _home 이 돌려놓는다) */
  clear() {
    for (const c of this.list) {
      if (c.load && c.zone && !(this.ops.carry && this.ops.carry.cart === c)) { for (const it of c.load) this.game.econ.give(c.zone, 'depot', it.g, it.n); c.load = null; }
      this._hideParked(c);
      if (c.mesh) { c.mesh.parent && c.mesh.parent.remove(c.mesh); c.mesh = null; }
    }
    this.list = []; this.seeded.clear();
    this._released();
  }
}
