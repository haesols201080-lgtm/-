// 들어간 건물 하나의 실내 (v0.9): 층을 필요한 만큼만 그린다(지금 층과 위·아래 층) — 계단으로 걸어 올라가면 그 층이 지금 층이 되고
// 그 위아래가 새로 그려진다. 승강기는 층을 골라 타고, 테라스·옥상 문은 바깥의 실제 단·지붕으로 나간다.
//  · 실내 높이: POCKET_Y + (그 층 바닥 − 1층 바닥). 가로 자리는 바깥 건물과 같은 x, z (문도 바깥 문과 같은 자리).
//  · 카메라: 지금 층 바닥~천장 사이, 벽(칸막이)을 넘지 않게(격자 칸 사이의 벽 모서리로 판정).
import * as THREE from 'three';
import { buildFloor, floorMaterials } from './render.js';
import { FUSE, ROOMS } from './catalog.js';
import { toWorld, toGrid } from './volume.js';

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
  }
  get G() { return this.B.G; }
  F(i) { return this.B.floors[i]; }
  /** 그 층 바닥의 실내 높이 */
  yOf(i) { return this.P0 + (this.B.floors[i].y - this.B.volume.floorY); }
  /** 층 평면 (만들거나 꺼내기) */
  plan(i) { return this.store.floor(this.r, i); }
  /** 플레이어 높이 → 층 번호 */
  floorAtY(y) {
    let best = this.cur, by = -Infinity;
    for (const F of this.B.floors) {
      if (!F.reach || F.dead) continue;
      const fy = this.yOf(F.i);
      if (fy <= y + 0.6 && fy > by) {
        // 중2층은 그 칸 위에 있을 때만
        if (F.mezz) { const p = this.game.player.pos; const c = this.cellAt(p.x, p.z); if (c < 0 || !F.mask[c]) continue; }
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

  // ── 층 그리기 ─────────────────────────────────
  _mats(F) {
    const k = F.zone;
    if (!this.mats.has(k)) this.mats.set(k, floorMaterials((this.B.zones[k] || {}).style || {}));
    return this.mats.get(k);
  }
  build(i) {
    if (this.built.has(i)) return this.built.get(i);
    const F = this.B.floors[i];
    if (!F || !F.reach || F.dead) return null;
    const pl = this.plan(i);
    if (!pl || pl.L.closed) return null;
    const above = this.B.floors.find((q) => q.i > i && q.reach && !q.dead && !q.mezz);
    const ctx = { B: this.B, F, L: pl.L, fix: pl.fix, r: this.r, V: this.V, y0: this.yOf(i), next: above || null, mats: this._mats(F) };
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
    // 승강기 문 (두 짝)
    for (const L of out.lifts) {
      if (!L.stops) continue;
      const W = L.cargo ? 1.6 : 1.1;
      const mk = () => { const m = new THREE.Mesh(new THREE.BoxGeometry(L.front[1] ? W / 2 : 0.05, 2.35, L.front[0] ? W / 2 : 0.05), new THREE.MeshBasicMaterial({ color: 0xc8ccd4 })); m.frustumCulled = false; out.group.add(m); return m; };
      L.leaves = [mk(), mk()];
      L.W = W;
      L.open = 0; L.want = 0;
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
    g.engine.scene.remove(out.group);
    out.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.map) o.material.map.dispose(); if (o.material && o.material.isMeshBasicMaterial) o.material.dispose(); });
    if (out.winMat) out.winMat.dispose();
    this.built.delete(i);
  }
  /** 지금 층을 i 로: 위·아래 층까지 그리고 나머지는 치운다 */
  setFloor(i) {
    this.cur = i;
    const want = new Set([i]);
    const reach = this.B.floors.filter((F) => F.reach && !F.dead).map((F) => F.i);
    const k = reach.indexOf(i);
    if (k > 0) want.add(reach[k - 1]);
    if (k >= 0 && k < reach.length - 1) want.add(reach[k + 1]);
    // 중2층이 있는 큰 홀: 홀과 중2층은 늘 같이
    for (const F of this.B.floors) if (F.mezz && (want.has(F.i) || want.has(F.i - 1))) { want.add(F.i); want.add(F.i - 1); }
    for (const j of [...this.built.keys()]) if (!want.has(j)) this.dispose(j);
    for (const j of want) this.build(j);
    for (const f of this.listeners) f('floor', i);
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
    const hall = L.lifthall != null ? L.rooms[L.lifthall] : null;
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
    // 계단으로 다른 층에 올라섰나
    const fi = this.floorAtY(p.y);
    if (fi !== this.cur) this.setFloor(fi);
    // 문: 사람이 다가가면 열린다 (플레이어 + 실내 사람)
    const people = [[p.x, p.y, p.z]];
    if (this.agents) for (const a of this.agents.near()) people.push([a.pos.x, a.pos.y, a.pos.z]);
    for (const out of this.built.values()) {
      for (const d of out.doors) {
        const [wx, wz] = this.world(d.x, d.z);
        let want = 0;
        for (const q of people) if (Math.abs(q[1] - out.y0 - 1) < 2.5 && Math.hypot(q[0] - wx, q[2] - wz) < 2.0) { want = 1; break; }
        d.open += (want - d.open) * Math.min(1, dt * 6);
        d.mesh.position.set(d.x + d.slide[0] * d.open * d.w * 0.95, 0, d.z + d.slide[1] * d.open * d.w * 0.95);
      }
      for (const L of out.lifts) {
        if (!L.leaves) continue;
        L.open += (L.want - L.open) * Math.min(1, dt * 4);
        const [fx, fz] = L.front, sx = fz ? 1 : 0, sz = fx ? 1 : 0;
        const off = (L.W / 4) + L.open * (L.W / 2 - 0.05);
        L.leaves[0].position.set(L.x + fx * 0.05 - sx * off, 1.2, L.z + fz * 0.05 - sz * off);
        L.leaves[1].position.set(L.x + fx * 0.05 + sx * off, 1.2, L.z + fz * 0.05 + sz * off);
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
    return !['lift', 'cargo', 'shaft'].includes(R.type);
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
  ceilY(i = this.cur) { const F = this.B.floors[i]; return this.yOf(i) + (F.ceil - F.y); }
}
