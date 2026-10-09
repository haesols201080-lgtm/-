// 들어간 건물 하나의 실내 (v0.9): 층을 필요한 만큼만 그린다(지금 층과 위·아래 층) — 계단으로 걸어 올라가면 그 층이 지금 층이 되고
// 그 위아래가 새로 그려진다. 승강기는 층을 골라 타고, 테라스·옥상 문은 바깥의 실제 단·지붕으로 나간다.
//  · 실내 높이: POCKET_Y + (그 층 바닥 − 1층 바닥). 가로 자리는 바깥 건물과 같은 x, z (문도 바깥 문과 같은 자리).
//  · 카메라: 지금 층 바닥~천장 사이, 벽(칸막이)을 넘지 않게(격자 칸 사이의 벽 모서리로 판정).
import * as THREE from 'three';
import { buildFloor, floorMaterials, colBox } from './render.js';
import { FUSE, ROOMS } from './catalog.js';
import { toWorld, toGrid, toWorldExt, toGridExt } from './volume.js';
import { floorGroups, parseKey, NOWALK } from './cells.js';

export class Indoor {
  constructor(I, r, POCKET_Y) {
    this.I = I; this.game = I.game; this.r = r; this.P0 = POCKET_Y;
    this.store = I.store;
    this.B = this.store.plan(r);
    this.V = this.B.V;
    this.built = new Map();
    this.cur = this.B.ground;
    this.t = 0;
    this.listeners = [];
    this.mats = new Map(); // 묶음(zone)마다 재질
    // 셀 (v24): 지금 짓고 있는 공간 — 열쇠 'F층:뿌리방' | 'S심부품'(계단실) | 'A'(아트리움), 층마다 지은 방 묶음
    this.cellKey = null;
    this.parts = new Map();
    this._grp = new Map();
    this._jn = new Map();
  }
  get G() { return this.B.G; }
  F(i) { return this.B.floors[i]; }
  /** 그 층 바닥의 실내 높이 */
  yOf(i) { const F = this.B.floors[i]; return this.P0 + (F.iy ?? F.y - this.B.volume.floorY); }
  /** 층 평면 (만들거나 꺼내기) */
  plan(i) { return this.store.floor(this.r, i); }
  /** 플레이어 높이 → 층 번호 */
  floorAtY(y) {
    let best = this.cur, by = -Infinity;
    const p = this.game.player.pos, c = this.cellAt(p.x, p.z);
    for (const F of this.B.floors) {
      if (!F.reach || F.dead) continue;
      const fy = this.yOf(F.i);
      if (fy <= y + 0.6 && fy > by) {
        // 그 층 바닥이 발밑에 있을 때만 (중2층·위층이 더 좁은 작은 건물: 위층 바닥이 없는 칸에서 뛰어도 위층이 되지 않게) — 지금 층은 늘 후보
        if (F.i !== this.cur && (c < 0 || !F.mask[c])) continue;
        by = fy; best = F.i;
      }
    }
    return best;
  }
  /** 세계 (x, z) → 칸 번호 (−1 = 밖) */
  cellAt(x, z) {
    const [gx, gz] = toGrid(this.r, this.V, x, z);
    const i = Math.floor(gx - this.G.ox), j = Math.floor(gz - this.G.oz);
    if (i < 0 || j < 0 || i >= this.G.gw || j >= this.G.gh) return -1;
    return j * this.G.gw + i;
  }
  /** 틀 좌표 → 세계 */
  world(gx, gz) { return toWorld(this.r, this.V, gx, gz); }
  grid(x, z) { return toGrid(this.r, this.V, x, z); }
  /** 실내 틀 좌표 ↔ 바깥 세계의 실제 건물 자리 (실내 배율 S 를 걷어 낸 것 — 테라스·옥상·공중다리) */
  worldExt(gx, gz) { return toWorldExt(this.r, this.V, gx, gz); }
  gridExt(x, z) { return toGridExt(this.r, this.V, x, z); }

  // ── 층 그리기 ─────────────────────────────────
  _mats(F) {
    const k = F.zone;
    if (!this.mats.has(k)) this.mats.set(k, floorMaterials((this.B.zones[k] || {}).style || {}));
    return this.mats.get(k);
  }
  build(i, rooms = null) {
    if (this.built.has(i)) return this.built.get(i);
    const F = this.B.floors[i];
    if (!F || !F.reach || F.dead) return null;
    const pl = this.plan(i);
    if (!pl || pl.L.closed) return null;
    const above = this.B.floors.find((q) => q.i > i && q.reach && !q.dead && !q.mezz);
    const ctx = { B: this.B, F, L: pl.L, fix: pl.fix, r: this.r, V: this.V, y0: this.yOf(i), next: above || null, mats: this._mats(F), rooms };
    const out = buildFloor(ctx);
    out.i = i; out.L = pl.L; out.fix = pl.fix; out.y0 = ctx.y0;
    const g = this.game, C = g.world.colliders;
    out.group.position.set(this.r.x, ctx.y0, this.r.z);
    out.group.rotation.y = this.B.theta;
    out.group.userData.indoor = true;
    out.group.traverse((o) => { o.userData.indoor = true; });
    // 미닫이 문
    out.doorMeshes = [];
    for (const d of out.doors) {
      const m = new THREE.Mesh(d.geo.build(), ctx.mats.solid);
      m.position.set(d.x, 0, d.z);
      m.frustumCulled = false;
      out.group.add(m);
      d.mesh = m; d.open = 0;
      out.doorMeshes.push(m);
    }
    // 직원 전용 문 (v24 「관계자 전용·보안 구역」): 한쪽만 직원 방(acc 'staff')인 문 — 출입 권한이 없으면 플레이어에게는 열리지 않고
    // 문틀에 막이 선다(주민은 그대로 드나든다 — 따라 들어가 비집고 지나갈 수 없다). 그 방 안에 있으면 언제나 나갈 수 있다.
    out.locks = [];
    for (const d of out.doors) {
      const A = pl.L.rooms[d.door.a], Bq = d.door.b >= 0 ? pl.L.rooms[d.door.b] : null;
      const sa = !!(A && ROOMS[A.type] && ROOMS[A.type].acc === 'staff'), sb = !!(Bq && ROOMS[Bq.type] && ROOMS[Bq.type].acc === 'staff');
      if (sa === sb) continue;
      const dv = d.slide[1] === 1;
      const spec = Object.assign(colBox({ r: this.r, V: this.V, y0: ctx.y0 }, d.x, d.z, dv ? 0.09 : d.w / 2 + 0.02, dv ? d.w / 2 + 0.02 : 0.09, 0, -0.2, 3.6, false), { wall: true });
      const lk = { d, R: sa ? A : Bq, spec, col: null };
      d.lock = lk;
      out.locks.push(lk);
    }
    // 승강기 (v24 4단계): 문 두 짝(문틀 높이 그대로) · 문 막이(닫혀 있는 동안 승강로로 못 들어가게) · 문 위 표시창(승강장 쪽과 칸 안쪽 —
    //  칸이 지금 몇 층에 있고 어느 쪽으로 가는지) · 부르기 단추(▲▼, 누르면 불이 들어온다). 열리고 닫히는 것은 game/lifts 의 칸이 정한다.
    for (const L of out.lifts) {
      if (!L.stops) continue;
      const W = L.cargo ? 2.1 : 1.1;
      const [fx, fz] = L.front, sx = fz ? 1 : 0, sz = fx ? 1 : 0;
      const h = L.head - 0.02;
      const mk = () => { const m = new THREE.Mesh(new THREE.BoxGeometry(fz ? W / 2 : 0.05, h, fx ? W / 2 : 0.05), new THREE.MeshBasicMaterial({ color: L.cargo ? 0x9aa0a8 : 0xc8ccd4 })); m.position.y = h / 2; m.frustumCulled = false; out.group.add(m); return m; };
      L.leaves = [mk(), mk()];
      L.W = W;
      L.open = 0; L.want = 0;
      L.spec = Object.assign(colBox({ r: this.r, V: this.V, y0: ctx.y0 }, L.x + fx * 0.05, L.z + fz * 0.05, fz ? W / 2 + 0.05 : 0.1, fx ? W / 2 + 0.05 : 0.1, 0, -0.2, L.head, false), { wall: true });
      L.col = C.add(L.spec);
      // 표시창: 작은 글자 판 하나를 두 면(승강장 · 칸 안)에
      if (typeof document !== 'undefined') {
        const cv = document.createElement('canvas');
        cv.width = 128; cv.height = 48;
        const tex = new THREE.CanvasTexture(cv);
        tex.colorSpace = THREE.SRGBColorSpace;
        const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
        const y = Math.min(L.head + 0.22, L.ceil - 0.16);
        const ry = Math.atan2(fx, fz);
        for (const sg of [1, -1]) {
          const m = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.2), sg > 0 ? mat : mat.clone());
          if (sg < 0) m.material.map = tex;
          m.position.set(L.x + fx * 0.1 * sg, y, L.z + fz * 0.1 * sg);
          m.rotation.y = sg > 0 ? ry : ry + Math.PI;
          m.frustumCulled = false; m.renderOrder = 3;
          out.group.add(m);
        }
        L.disp = { cv, cx: cv.getContext('2d'), tex, key: '' };
      }
      // 부르기 단추: 승강장 쪽 문 오른편 벽의 작은 판 (위·아래 단추)
      const bx = L.x + fx * 0.09 + sx * (W / 2 + 0.3) * (L.side || 1), bz = L.z + fz * 0.09 + sz * (W / 2 + 0.3) * (L.side || 1);
      const plate = new THREE.Mesh(new THREE.BoxGeometry(fz ? 0.16 : 0.03, 0.34, fx ? 0.16 : 0.03), new THREE.MeshBasicMaterial({ color: 0xb8bec7 }));
      plate.position.set(bx, 1.15, bz); out.group.add(plate);
      L.btn = {};
      for (const [k, dy] of [['up', 0.07], ['down', -0.07]]) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(fz ? 0.06 : 0.02, 0.06, fx ? 0.06 : 0.02), new THREE.MeshBasicMaterial({ color: 0x5a6068 }));
        m.position.set(bx + fx * 0.02, 1.15 + dy, bz + fz * 0.02); out.group.add(m);
        L.btn[k] = m;
      }
    }
    this._signs(out);
    g.engine.scene.add(out.group);
    out.added = out.cols.map((c) => C.add(c));
    this.built.set(i, out);
    for (const f of this.listeners) f('build', i, out);
    return out;
  }
  dispose(i) {
    const out = this.built.get(i);
    if (!out) return;
    for (const f of this.listeners) f('dispose', i, out);
    const g = this.game, C = g.world.colliders;
    for (const c of out.added) C.remove(c);
    for (const lk of out.locks || []) if (lk.col) { C.remove(lk.col); lk.col = null; }
    for (const L of out.lifts || []) if (L.col) { C.remove(L.col); L.col = null; }
    g.engine.scene.remove(out.group);
    out.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.map) o.material.map.dispose(); if (o.material && o.material.isMeshBasicMaterial && !o.material.userData.keep) o.material.dispose(); });
    if (out.winMat) out.winMat.dispose();
    this.built.delete(i);
  }
  // ── 셀 (v24 · 방·구역 단위 독립 공간) ───────────────
  /** 그 층의 방 무리 뿌리 (cells.floorGroups) */
  groups(i) {
    if (!this._grp.has(i)) { const pl = this.plan(i); this._grp.set(i, pl && !pl.L.closed ? floorGroups(pl.L) : null); }
    return this._grp.get(i);
  }
  /** 층을 꿰는 셀에 드는 무리 뿌리: 아트리움(뚫린 곳 둘레) · 중2층 통로(아래 홀) */
  _joins(i) {
    if (this._jn.has(i)) return this._jn.get(i);
    const m = new Map();
    this._jn.set(i, m);
    const B = this.B, F = B.floors[i], pl = this.plan(i), root = this.groups(i);
    if (!pl || !root) return m;
    const L = pl.L, { gw, gh } = this.G;
    const A = B.atrium;
    if (A && B.atriumCells && !F.mezz) {
      const i0 = B.ground + A.from, i1 = B.ground + A.to;
      if (i >= i0 && i <= i1) for (const c of B.atriumCells) {
        if (i === i0) { const r = L.room[c] - 1; if (r >= 0 && root[r] >= 0) m.set(root[r], 'A'); continue; }
        if (L.void[c] !== 1) continue;
        const ci = c % gw, cj = (c / gw) | 0;
        for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ii = ci + a, jj = cj + b;
          if (ii < 0 || jj < 0 || ii >= gw || jj >= gh) continue;
          const r = L.room[jj * gw + ii] - 1;
          if (r >= 0 && root[r] >= 0) m.set(root[r], 'A');
        }
      }
    }
    if (F.mezz && L.mezzWalk != null && root[L.mezzWalk] >= 0) {
      const hp = this.plan(i - 1), hr = this.groups(i - 1);
      if (hp && hr) {
        const H = hp.L.rooms.find((q) => q.main) || hp.L.rooms.filter((q) => q.n && !NOWALK.has(q.type) && q.type !== 'stair').sort((a, b) => b.n - a.n)[0];
        if (H && hr[H.id] >= 0) m.set(root[L.mezzWalk], this._joins(i - 1).get(hr[H.id]) || `F${i - 1}:${hr[H.id]}`);
      }
    }
    return m;
  }
  /** 층 i 의 방 r 이 드는 셀 열쇠 (걸어 들어갈 수 없는 방은 null) */
  keyOf(i, r) {
    const pl = this.plan(i);
    const R = pl && pl.L.rooms[r];
    if (!R) return null;
    if (R.type === 'stair') return R.part != null ? `S${R.part}` : null;
    if (NOWALK.has(R.type)) return null;
    const root = this.groups(i);
    if (!root || root[r] < 0) return null;
    return this._joins(i).get(root[r]) || `F${i}:${root[r]}`;
  }
  /** 층 i 의 세계 (x, z) 자리의 방 번호 (지은 층이면 벽 앞 자투리까지 그 방) */
  roomAt(i, x, z) {
    const c = this.cellAt(x, z);
    if (c < 0) return -1;
    const out = this.built.get(i);
    if (out && out.roomX) return out.roomX[c] - 1;
    const pl = this.plan(i);
    return pl ? pl.L.room[c] - 1 : -1;
  }
  keyAt(i, x, z) { const r = this.roomAt(i, x, z); return r >= 0 ? this.keyOf(i, r) : null; }
  /** 층 i 에 걸을 수 있는 방이 있는 셀 열쇠들 (계단실 S 제외 — 검사 도구·지도가 쓴다) */
  cellsOn(i) {
    const pl = this.plan(i), out = new Set();
    if (!pl || pl.L.closed) return [];
    for (let r = 0; r < pl.L.rooms.length; r++) { if (!pl.L.rooms[r].n) continue; const k = this.keyOf(i, r); if (k && k[0] !== 'S') out.add(k); }
    return [...out];
  }
  /** 셀 열쇠 → 층마다 지을 방 묶음 (계단실은 지금 층 둘레 ±2 층만) */
  partsOf(key) {
    const P = parseKey(key), out = new Map(), B = this.B;
    if (!P) return out;
    const add = (i, r) => { let st = out.get(i); if (!st) out.set(i, (st = new Set())); st.add(r); };
    const fl = (i) => B.floors[i] && B.floors[i].reach && !B.floors[i].dead;
    const groupRooms = (i, want) => {
      const root = this.groups(i);
      if (!root) return;
      const jn = this._joins(i);
      for (let r = 0; r < root.length; r++) { if (root[r] < 0) continue; if ((jn.get(root[r]) || `F${i}:${root[r]}`) === want) add(i, r); }
    };
    if (P.kind === 'F') {
      if (!fl(P.floor)) return out;
      groupRooms(P.floor, key);
      const up = B.floors[P.floor + 1];
      if (up && up.mezz && fl(P.floor + 1)) groupRooms(P.floor + 1, key);
    } else if (P.kind === 'A' && B.atrium) {
      for (let i = B.ground + B.atrium.from; i <= B.ground + B.atrium.to; i++) if (fl(i)) groupRooms(i, 'A');
    } else if (P.kind === 'S') {
      const lk = B.links.find((k) => k.part === P.part && k.kind !== 'roof');
      const list = lk ? lk.floors.filter(fl).sort((a, b) => a - b) : [];
      let k0 = list.indexOf(this.cur);
      if (k0 < 0) { let bd = 1e9; list.forEach((i, k) => { const d = Math.abs(i - this.cur); if (d < bd) { bd = d; k0 = k; } }); }
      for (let k = Math.max(0, k0 - 2); k <= Math.min(list.length - 1, k0 + 2); k++) {
        const i = list[k], pl = this.plan(i);
        const R = pl && pl.L.rooms.find((q) => q.type === 'stair' && q.part === P.part);
        if (R) add(i, R.id);
      }
    }
    return out;
  }
  /** 셀 하나만 짓는다: 그 셀의 방들(층마다) — 나머지는 치운다 */
  setCell(key) {
    const parts = this.partsOf(key);
    if (!parts.size) return false;
    const same = (a, b) => a && b && a.size === b.size && [...a].every((x) => b.has(x));
    for (const [j, out] of [...this.built]) if (!same(parts.get(j), out.cellRooms)) this.dispose(j);
    for (const [j, rooms] of parts) if (!this.built.has(j)) this.build(j, rooms);
    const prev = this.cellKey;
    this.cellKey = key;
    this.parts = parts;
    if (prev !== key) for (const f of this.listeners) f('cell', key);
    return true;
  }
  /** 지금 셀에 드는 자리인가 (층 i, 틀 좌표) */
  inCellGrid(i, gx, gz) {
    const st = this.parts.get(i);
    if (!st) return false;
    const G = this.G, ci = Math.floor(gx - G.ox), cj = Math.floor(gz - G.oz);
    if (ci < 0 || cj < 0 || ci >= G.gw || cj >= G.gh) return false;
    const out = this.built.get(i);
    const r = out && out.roomX ? out.roomX[cj * G.gw + ci] - 1 : -1;
    return r >= 0 && st.has(r);
  }
  /** (층 i, 틀 좌표) 가 그 층에 와 있는 승강기 칸 안인가 (칸 안의 사람도 보이게) */
  inCarGrid(i, gx, gz) {
    const out = this.built.get(i);
    if (!out) return false;
    for (const L of out.lifts) if (L.here && L.bb && gx > L.bb.x0 && gx < L.bb.x1 && gz > L.bb.z0 && gz < L.bb.z1) return true;
    return false;
  }
  get stairCell() { return !!this.cellKey && this.cellKey[0] === 'S'; }
  /** 층 i 에서 처음 설 셀: (x, z) 가 그 층의 걸을 수 있는 방이면 그 방의 셀, 아니면 승강기 홀 · 정문 홀 · 가장 큰 오가는 공간 */
  homeKey(i, x, z) {
    if (x != null) { const k = this.keyAt(i, x, z); if (k) return k; }
    const pl = this.plan(i);
    if (!pl || pl.L.closed) return null;
    const L = pl.L;
    if (L.lifthall != null && L.rooms[L.lifthall].n) { const k = this.keyOf(i, L.lifthall); if (k) return k; }
    if (L.ents.main) { const r = L.room[L.ents.main.c] - 1; if (r >= 0) { const k = this.keyOf(i, r); if (k) return k; } }
    const R = L.rooms.filter((q) => q.n && (q.circ || q.main) && !NOWALK.has(q.type) && q.type !== 'stair').sort((a, b) => b.n - a.n)[0] || L.rooms.filter((q) => q.n && !NOWALK.has(q.type) && q.type !== 'stair').sort((a, b) => b.n - a.n)[0];
    return R ? this.keyOf(i, R.id) : null;
  }
  /** 지금 층을 i 로: 그 층에서 (x, z)(없으면 플레이어 자리)가 드는 셀(없으면 승강기 홀·정문 홀)만 짓는다 */
  setFloor(i, x, z) {
    this.cur = i;
    const p = this.game.player.pos;
    const key = this.homeKey(i, x ?? p.x, z ?? p.z);
    if (key) this.setCell(key);
    for (const f of this.listeners) f('floor', i);
  }
  /** 문턱을 넘어 옆 셀로: 짧게 가리고(ui.blink) 그 사이에 옆 셀을 짓는다 — 같은 좌표라 순간이동 없이 둘레만 바뀐다 */
  _cross(key) {
    this._xing = true;
    const go = () => { try { this.setCell(key); } catch (e) { console.error('[cells]', e); } };
    const done = () => { this._xing = false; };
    const ui = this.game.ui;
    if (ui && ui.blink) ui.blink(go, done); else { go(); done(); }
  }
  close() {
    for (const j of [...this.built.keys()]) this.dispose(j);
    for (const m of this.mats.values()) { m.solid.dispose(); m.glass.dispose(); }
    this.mats.clear();
  }

  /** 문 위 이름판·승강기 홀의 층 안내 (층마다 글자 판 하나) */
  _signs(out) {
    if (typeof document === 'undefined') return;
    const F = this.B.floors[out.i], L = out.L;
    const list = out.signs.slice(0, 46);
    // 승강기 홀: 층 번호와 쓰임 (큰 판)
    const hall = L.lifthall != null && (!out.cellRooms || out.cellRooms.has(L.lifthall)) ? L.rooms[L.lifthall] : null;
    const W = 512, H = 64, cols = 2, rows = 24;
    const cv = document.createElement('canvas');
    cv.width = W * cols; cv.height = H * rows;
    const cx = cv.getContext('2d');
    const st = (this.B.zones[F.zone] || {}).style || {};
    const hex = (v) => '#' + (v ?? 0x7ff3e6).toString(16).padStart(6, '0');
    const draw = (k, text, sub, big, staff) => {
      const x = (k % cols) * W, y = Math.floor(k / cols) * H;
      cx.fillStyle = staff ? 'rgba(40,30,20,0.92)' : 'rgba(16,20,32,0.9)';
      cx.fillRect(x + 2, y + 2, W - 4, H - 4);
      cx.fillStyle = staff ? '#ffc46a' : hex(st.glow);
      cx.fillRect(x + 2, y + 2, 8, H - 4);
      cx.fillStyle = '#f3efe6';
      cx.font = `bold ${big ? 40 : 30}px 'Noto Sans KR', sans-serif`;
      cx.textBaseline = 'middle';
      cx.fillText(text, x + 22, y + H / 2 - (sub ? 8 : 0), W - 40);
      if (sub) { cx.font = `20px 'Noto Sans KR', sans-serif`; cx.fillStyle = staff ? '#ffd8a0' : hex(st.glow); cx.fillText(sub, x + 22, y + H / 2 + 18, W - 40); }
    };
    const quads = [];
    list.forEach((s, k) => { draw(k, s.text, s.sub, false, s.staff); quads.push({ ...s, k, w: 1.3, h: 0.17 }); });
    if (hall) {
      const k = list.length;
      draw(k, `${F.label}층 · ${FUSE[F.use] ? FUSE[F.use].name : ''}`, this.I.title(this.r), true, false);
      // 승강기 홀 벽: 홀의 가운데에서 승강기를 등진 쪽 (심 정면 방향)
      const core = this.B.core;
      const hx = this.G.ox + hall.cx + 0.5, hz = this.G.oz + hall.cz + 0.5;
      quads.push({ k, x: hx - core.front[0] * 0.2, z: hz - core.front[1] * 0.2, y: 2.75, ry: Math.atan2(core.front[0], core.front[1]), w: 2.4, h: 0.3 });
    }
    if (!quads.length) return;
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const P = [], U = [];
    for (const q of quads) {
      const u0 = (q.k % cols) / cols, u1 = u0 + 1 / cols, v1 = 1 - Math.floor(q.k / cols) / rows, v0 = v1 - 1 / rows;
      const cs = Math.cos(q.ry), sn = Math.sin(q.ry);
      const ax = -q.w / 2 * cs, az = q.w / 2 * sn;
      const p = (sx, sy) => [q.x + ax * sx, q.y + sy * q.h / 2, q.z + az * sx];
      const a = p(-1, -1), b = p(1, -1), c = p(1, 1), d = p(-1, 1);
      P.push(...a, ...b, ...c, ...a, ...c, ...d);
      U.push(u1, v0, u0, v0, u0, v1, u1, v0, u0, v1, u1, v1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide }));
    m.frustumCulled = false;
    m.renderOrder = 3;
    out.group.add(m);
  }

  // ── 매 프레임 ─────────────────────────────────
  update(dt) {
    this.t += dt;
    const g = this.game, p = g.player.pos;
    // 계단으로 다른 층에 올라섰나: 계단실 안이면 같은 셀을 둘레 층으로 옮겨 짓고, 아니면 그 층에서 선 셀
    const fi = this.floorAtY(p.y);
    if (fi !== this.cur) {
      this.cur = fi;
      if (this.stairCell) this.setCell(this.cellKey);
      else { const k = this.keyAt(fi, p.x, p.z); if (k) this.setCell(k); }
      for (const f of this.listeners) f('floor', fi);
    }
    // 문턱을 넘어 옆 셀(옆 방·복도·계단실)로
    if (!this._xing) {
      const k = this.keyAt(this.cur, p.x, p.z);
      if (k && k !== this.cellKey && this.parts.has(this.cur)) this._cross(k);
    }
    // 문: 사람이 다가가면 열린다 (플레이어 + 실내 사람)
    const people = [[p.x, p.y, p.z]];
    if (this.agents) for (const a of this.agents.near()) people.push([a.pos.x, a.pos.y, a.pos.z]);
    const ops = g.ops, C = g.world.colliders;
    const lockTick = (this._lkT = (this._lkT || 0) - dt) < 0;
    if (lockTick) this._lkT = 0.25;
    for (const out of this.built.values()) {
      // 잠긴 문: 지금 층에서, 플레이어가 그 직원 방 밖에 있고 출입 권한이 없으면 막는다 (0.25 초마다 다시 본다)
      if (lockTick && out.locks && out.locks.length) {
        const c = this.cellAt(p.x, p.z), here = out.i === this.cur && c >= 0 && out.roomX[c] ? out.L.rooms[out.roomX[c] - 1] : null;
        for (const lk of out.locks) {
          const shut = out.i === this.cur && here !== lk.R && !!ops && !ops.canEnter(lk.R, out.i);
          lk.shut = shut;
          if (shut && !lk.col) lk.col = C.add(lk.spec);
          else if (!shut && lk.col) { C.remove(lk.col); lk.col = null; }
        }
      }
      for (const d of out.doors) {
        const [wx, wz] = this.world(d.x, d.z);
        let want = 0;
        for (let k = d.lock && d.lock.shut ? 1 : 0; k < people.length; k++) { const q = people[k]; if (Math.abs(q[1] - out.y0 - 1) < 2.5 && Math.hypot(q[0] - wx, q[2] - wz) < 2.0) { want = 1; break; } } // 잠긴 문은 플레이어(0 번)에게 열리지 않는다
        d.open += (want - d.open) * Math.min(1, dt * 6);
        d.mesh.position.set(d.x + d.slide[0] * d.open * d.w * 0.95, 0, d.z + d.slide[1] * d.open * d.w * 0.95);
      }
      for (const L of out.lifts) {
        if (!L.leaves) continue;
        // 칸(game/lifts)이 L.open 을 정한다 — 칸이 없는 곳(검사 도구)만 L.want 를 따라간다
        if (!L.car) L.open += (L.want - L.open) * Math.min(1, dt * 4);
        const [fx, fz] = L.front, sx = fz ? 1 : 0, sz = fx ? 1 : 0;
        const e = L.open * L.open * (3 - 2 * L.open);
        const off = (L.W / 4) + e * (L.W / 2 - 0.05);
        const y = L.leaves[0].position.y;
        L.leaves[0].position.set(L.x + fx * 0.05 - sx * off, y, L.z + fz * 0.05 - sz * off);
        L.leaves[1].position.set(L.x + fx * 0.05 + sx * off, y, L.z + fz * 0.05 + sz * off);
        // 문 막이: 거의 다 열렸을 때만 걷힌다 (닫히는 문틈으로 비집고 들어가지 못하게)
        const shut = L.open < 0.85;
        if (shut && !L.col) L.col = C.add(L.spec);
        else if (!shut && L.col) { C.remove(L.col); L.col = null; }
      }
    }
  }

  // ── 카메라·자리 판정 ──────────────────────────
  /** (x, z) 가 i 층의 걸을 수 있는 칸인가 */
  inside(i, x, z) {
    const out = this.built.get(i);
    if (!out) return false;
    const c = this.cellAt(x, z);
    if (c < 0) return false;
    const R = out.roomX[c] ? out.L.rooms[out.roomX[c] - 1] : null;
    if (!R || out.L.void[c] === 1) return false;
    if (R.type === 'lift' || R.type === 'cargo') { const L = out.lifts.find((q) => q.room === R.id); return !!(L && L.here); } // 칸이 이 층에 있으면 칸 안도 걸을 수 있는 곳
    if (R.type === 'shaft') return false;
    if (out.cellRooms && !out.cellRooms.has(R.id)) return false; // 지금 셀 밖 (문 너머 옆 방)
    // 바깥벽 안쪽인가 (벽 앞 자투리 칸은 칸 가운데가 벽 밖일 수 있다 — 거기 세우면 바닥 없는 곳에 선다)
    if (out.sdAt) { const [gx, gz] = this.grid(x, z); if (out.sdAt(gx, gz) > -0.05) return false; }
    return true;
  }
  /** 두 점 사이에 벽이 없나 (칸 모서리를 건너는 곳마다) */
  segClear(i, ax, az, bx, bz) {
    const out = this.built.get(i);
    if (!out) return true;
    const [x0, z0] = this.grid(ax, az), [x1, z1] = this.grid(bx, bz);
    const G = this.G;
    let ci = Math.floor(x0 - G.ox), cj = Math.floor(z0 - G.oz);
    const ti = Math.floor(x1 - G.ox), tj = Math.floor(z1 - G.oz);
    const dx = x1 - x0, dz = z1 - z0;
    const si = Math.sign(dx), sj = Math.sign(dz);
    let tMaxX = dx !== 0 ? ((si > 0 ? ci + 1 : ci) + G.ox - x0) / dx : Infinity, tMaxZ = dz !== 0 ? ((sj > 0 ? cj + 1 : cj) + G.oz - z0) / dz : Infinity;
    const tdx = dx !== 0 ? Math.abs(1 / dx) : Infinity, tdz = dz !== 0 ? Math.abs(1 / dz) : Infinity;
    for (let guard = 0; guard < 400 && (ci !== ti || cj !== tj); guard++) {
      let key;
      if (tMaxX < tMaxZ) { key = `v${si > 0 ? ci + 1 : ci},${cj}`; ci += si; tMaxX += tdx; }
      else { key = `h${ci},${sj > 0 ? cj + 1 : cj}`; cj += sj; tMaxZ += tdz; }
      if (out.walls.has(key)) return false;
      if (ci < 0 || cj < 0 || ci >= G.gw || cj >= G.gh) return false;
      const c = cj * G.gw + ci;
      if (!out.roomX[c] || out.L.void[c] === 1) return false;
    }
    return true;
  }
  /** 지금 층의 천장 (실내 높이) */
  ceilY(i = this.cur) { const F = this.B.floors[i]; return this.yOf(i) + (F.ic ?? F.ceil - F.y); }
}
