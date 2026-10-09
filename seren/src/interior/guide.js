// 실내 길 안내 (v0.9): 목적지(층·자리)까지 실제 걸음 칸(nav)과 실제 이음(계단·승강기·중2층 계단)으로 길을 찾아
// 지금 층 바닥에 빛 점선을 깔고, 나침반과 화면 구석에 「어디로·몇 m·몇 층」을 띄운다.
//  · 층이 다르면: 층 사이 길(Dijkstra — 승강기는 몇 층이든 한 번, 계단은 한 층씩)로 고른 첫 이음의 문 앞까지 → 그 층에 닿으면 다시.
//  · 건물 밖 목적지(다른 건물의 면접·일터)는 바깥 표식(state.waypoint)으로 넘긴다.
import * as THREE from 'three';
import { findPath, snap } from './nav.js';
import { partSpot, mezzSpot, LINKNAME } from './find.js';
import { glowMaterial } from '../world/materials.js';
import { josa } from '../core/josa.js';

const DOT = 0.9; // 점 사이 m

export class Guide {
  constructor(game) {
    this.game = game;
    this.goal = null;
    this.t = 0;
    this.leg = null; // { floor, pts(세계 x,z), next: { kind, label, floor } }
    this.mesh = null;
    this.beacon = null;
    this.text = '';
  }
  get cur() { const c = this.game.interiors.cur; return c && c.indoor ? c : null; }

  /** 목적지: { floor, gx, gz, label } (틀 좌표) — 또는 { world: {x, z}, label } (바깥) */
  to(goal) {
    if (goal.world) {
      const g = this.game;
      g.state.waypoint = { x: goal.world.x, z: goal.world.z };
      g.updateWaypoint();
      g.ui.toast(`표식 · ${goal.label || ''} — 나침반의 흰 표식`, {});
      this.goal = null;
      this._clearMesh();
      return;
    }
    this.goal = { ...goal };
    this.leg = null;
    this._arrived = false;
    if (this.cur) { this.t = 0; this._recalc(); } else this.t = 1e9;
  }
  /** 방으로 */
  toRoom(floor, roomId, label) {
    const cur = this.cur;
    if (!cur) return;
    const pl = cur.indoor.plan(floor);
    const R = pl && pl.L.rooms[roomId];
    if (!R) return;
    this.to({ floor, gx: cur.B.G.ox + R.cx + 0.5, gz: cur.B.G.oz + R.cz + 0.5, label: label || R.name });
  }
  clear() { this.goal = null; this.leg = null; this.text = ''; this._clearMesh(); }
  _clearMesh() {
    if (this.mesh) { this.mesh.parent && this.mesh.parent.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh = null; }
    if (this.beacon) this.beacon.visible = false;
  }

  /** 층 사이 길: 지금 층 a → 목표 층 b. 반환: [{ link, from, to }] (차례) */
  floorRoute(a, b) {
    const B = this.cur.B;
    if (a === b) return [];
    const dist = new Map([[a, 0]]), prev = new Map(), Q = [a];
    const edges = (i) => {
      const E = [];
      for (const lk of B.links) {
        if (!lk.floors.includes(i) || lk.kind === 'roof') continue;
        const fl = lk.floors.slice().sort((x, y) => x - y);
        if (lk.kind === 'lift' || lk.kind === 'cargo') { for (const j of fl) if (j !== i) E.push([j, 25 + 2 * Math.abs(j - i) + (lk.kind === 'cargo' ? 10 : 0), lk]); }
        else { const k = fl.indexOf(i); if (k > 0) E.push([fl[k - 1], 14, lk]); if (k < fl.length - 1) E.push([fl[k + 1], 14, lk]); }
      }
      return E;
    };
    while (Q.length) {
      Q.sort((x, y) => dist.get(x) - dist.get(y));
      const i = Q.shift();
      if (i === b) break;
      for (const [j, c, lk] of edges(i)) {
        const d = dist.get(i) + c;
        if (d < (dist.get(j) ?? Infinity)) { dist.set(j, d); prev.set(j, { i, lk }); if (!Q.includes(j)) Q.push(j); }
      }
    }
    if (!prev.has(b)) return null;
    const out = [];
    for (let j = b; j !== a;) { const p = prev.get(j); out.unshift({ link: p.lk, from: p.i, to: j }); j = p.i; }
    // 같은 계단을 여러 층 이어 오르면 한 번으로 묶는다
    const merged = [];
    for (const s of out) { const m = merged[merged.length - 1]; if (m && m.link === s.link) m.to = s.to; else merged.push({ ...s }); }
    return merged;
  }
  /** 이음의 이 층 문 앞 (틀 좌표) */
  linkSpot(lk, floor) {
    const cur = this.cur, B = cur.B;
    if (lk.kind === 'open') { const lo = cur.indoor.plan(lk.floors[0]); return lo ? mezzSpot(B, lo.L, floor !== lk.floors[0]) : null; }
    const part = B.core && B.core.parts[lk.part];
    return part ? partSpot(B, part) : null;
  }

  _nav(i) {
    const ops = this.game.ops;
    if (ops && ops.agents) return ops.agents.navOf(i);
    return null;
  }
  /** 길 다시 찾기 */
  _recalc() {
    const cur = this.cur, goal = this.goal;
    if (!cur || !goal) return;
    const ind = cur.indoor, B = cur.B, p = this.game.player.pos;
    const here = ind.cur;
    const [px, pz] = ind.grid(p.x, p.z);
    let tx = goal.gx, tz = goal.gz, next = null;
    if (goal.floor !== here) {
      const fr = this.floorRoute(here, goal.floor);
      if (!fr || !fr.length) { this.leg = null; this.text = `${goal.label} — ${B.floors[goal.floor].label}층 (가는 길을 못 찾았어요)`; return; }
      const s = fr[0];
      const sp = this.linkSpot(s.link, here);
      if (!sp) { this.leg = null; return; }
      [tx, tz] = sp;
      next = { kind: s.link.kind, label: LINKNAME[s.link.kind] || '계단', floor: s.to, hops: fr.length };
    }
    const N = this._nav(here);
    let pts = null;
    if (N) pts = findPath(N, px, pz, tx, tz, 40000);
    if (!pts) pts = [[px, pz], [tx, tz]];
    this.leg = { floor: here, cell: ind.cellKey, pts, next, tx, tz };
    let len = 0;
    for (let k = 1; k < pts.length; k++) len += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
    const F = B.floors[goal.floor];
    this.text = next
      ? `${goal.label} · ${F.label}층 — ${josa(next.label, '로')} ${Math.round(len)} m${next.kind === 'lift' || next.kind === 'cargo' ? ` → ${B.floors[next.floor].label}층` : ` → ${next.floor > here ? '위' : '아래'}로 ${Math.abs(next.floor - here)}층`}`
      : `${goal.label} — ${Math.round(len)} m`;
    this.len = len;
    this._draw(ind, here, pts);
  }
  _draw(ind, i, pts) {
    this._clearMesh();
    // 점선: 길을 따라 DOT m 마다 작은 빛 마름모
    const P = [];
    const y = ind.yOf(i) + 0.05;
    let carry = 0.5;
    for (let k = 1; k < pts.length; k++) {
      const [ax, az] = pts[k - 1], [bx, bz] = pts[k];
      const L = Math.hypot(bx - ax, bz - az);
      if (L < 1e-3) continue;
      const ux = (bx - ax) / L, uz = (bz - az) / L;
      for (let t = carry; t < L; t += DOT) {
        const gx = ax + ux * t, gz = az + uz * t;
        if (ind.parts && ind.parts.size && !ind.inCellGrid(i, gx, gz)) { carry = t + DOT - L; continue; } // 지금 셀 밖(문 너머)은 그리지 않는다
        const [wx, wz] = ind.world(gx, gz);
        const [fx, fz] = ind.world(gx + ux * 0.22, gz + uz * 0.22), [sx, sz] = ind.world(gx - uz * 0.14, gz + ux * 0.14), [rx, rz] = ind.world(gx + uz * 0.14, gz - ux * 0.14), [kx, kz] = ind.world(gx - ux * 0.12, gz - uz * 0.12);
        // 화살촉 (두 삼각형)
        P.push(fx, y, fz, sx, y, sz, kx, y, kz, fx, y, fz, kx, y, kz, rx, y, rz);
        void wx; void wz;
        carry = t + DOT - L;
      }
      if (carry < 0) carry = 0;
    }
    if (!P.length) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    if (!this.mat) this.mat = glowMaterial({ color: 0x9ff6ff, intensity: 1.6, fresnel: 0, side: THREE.DoubleSide });
    const m = new THREE.Mesh(geo, this.mat);
    m.frustumCulled = false;
    m.renderOrder = 4;
    m.userData.indoor = true;
    this.game.engine.scene.add(m);
    this.mesh = m;
    // 목적지(또는 이음 문 앞)의 빛 기둥
    if (!this.beacon) {
      this.beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, 2.4, 12, 1, true).translate(0, 1.2, 0), glowMaterial({ color: 0x9ff6ff, intensity: 0.8, fresnel: 0.6, side: THREE.DoubleSide }));
      this.beacon.frustumCulled = false;
      this.beacon.userData.indoor = true;
      this.game.engine.scene.add(this.beacon);
    }
    // 빛 기둥: 목적지가 지금 셀 안이면 거기, 아니면 길이 지금 셀을 떠나는 문턱(다음 공간으로 가는 문)에
    let [bx, bz] = pts[pts.length - 1];
    if (ind.parts && ind.parts.size && !ind.inCellGrid(i, bx, bz)) {
      for (let k = pts.length - 1; k > 0; k--) if (ind.inCellGrid(i, pts[k - 1][0], pts[k - 1][1]) && !ind.inCellGrid(i, pts[k][0], pts[k][1])) { [bx, bz] = pts[k - 1]; break; }
    }
    const [wx, wz] = ind.world(bx, bz);
    this.beacon.position.set(wx, ind.yOf(i), wz);
    this.beacon.visible = true;
  }

  update(dt) {
    const cur = this.cur;
    if (!this.goal) return;
    if (!cur) { this.clear(); return; }
    this.t += dt;
    const ind = cur.indoor, p = this.game.player.pos;
    if (this.leg && (this.leg.floor !== ind.cur || this.leg.cell !== ind.cellKey)) this.t = 1e9; // 층이나 공간(셀)이 바뀌었다
    if (this.t > 1.2) {
      // 길에서 벗어났거나 시간이 지나면 다시
      this.t = 0;
      this._recalc();
    }
    if (this.beacon && this.beacon.visible) this.beacon.rotation.y += dt;
    // 도착
    if (this.goal.floor === ind.cur) {
      const [gx, gz] = ind.grid(p.x, p.z);
      if (Math.hypot(gx - this.goal.gx, gz - this.goal.gz) < 1.7) {
        this.game.ui.toast(`도착 · ${this.goal.label}`, { kind: 'muted' });
        this.clear();
      }
    }
  }
  /** 나침반 표식 */
  compassMarkers(bearing) {
    const cur = this.cur;
    if (!cur || !this.leg) return [];
    const ind = cur.indoor, pts = this.leg.pts;
    // 길에서 3 m 앞 점 쪽
    const p = this.game.player.pos;
    const [gx, gz] = ind.grid(p.x, p.z);
    let best = pts[pts.length - 1];
    for (let k = 1; k < pts.length; k++) if (Math.hypot(pts[k][0] - gx, pts[k][1] - gz) > 2.5) { best = pts[k]; break; }
    const [wx, wz] = ind.world(best[0], best[1]);
    return [{ bearing: bearing(wx, wz), cls: 'w', label: this.leg.next ? this.leg.next.label : `${Math.round(this.len || 0)}m` }];
  }
}
export { snap };
