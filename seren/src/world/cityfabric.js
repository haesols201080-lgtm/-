// 도시의 살: 큰 구조물 사이를 수천 채의 건물·거리·가로등으로 채워 고등 문명의 「밀도」를 만든다.
//  · 배치: data/city.js 의 구역마다 「고리 거리 + 방사 대로」 격자를 깔고, 필지마다 양식에 맞는 건물을 세운다.
//    물·절벽·다른 구조물·빛길 관 밑·인물·글자돌 자리는 피하고, 다리·고리 밑에서는 높이를 낮춘다.
//  · 그리기: 건물 모양(10가지)마다 인스턴스 둘 — 가까운 것은 자세한 모델(카메라가 움직이면 다시 고름),
//    나머지는 단순 모델을 한꺼번에 올려 두고 셰이더가 거리로 잘라 낸다(USE_CUT). 모양마다 그리기 2회.
//  · 모든 건물은 충돌체(지붕을 밟을 수 있음). 밤에는 창마다 불이 켜지고, 거리에는 가로등, 높은 지붕에는 항공등.
import * as THREE from 'three';
import { heightAt } from './heightfield.js';
import { mulberry32, createNoise2D } from '../core/noise.js';
import { cityArchetypes, SIZE, doorGeo } from './city-arch.js';
import { litMaterial } from './materials.js';
import { PointLights } from './lights.js';
import { glyphStripTexture } from './hologram.js';
import { CURVE_GLSL, ATMOS_PARS, NOISE_GLSL } from './shaders.js';
import { atmosUniforms } from './atmosphere.js';
import { PLACE, PLACES } from '../data/places.js';
import { NPCS, GLYPH_STONES, ECHOES } from '../data/story.js';
import { ZONES, STYLES, TINTS } from '../data/city.js';

const ACC = [0x7ff3e6, 0xffc46a, 0xff9fd0, 0xb9a6ff];
const TAU = Math.PI * 2;
const SKIP_PLACE = new Set(['capital', 'district', 'none']);
const LOWKIND = new Set(['dome', 'cap', 'stilt', 'villa']);
// 들어갈 수 있는 건물 (쌍둥이 탑·기둥 집은 기단이 있을 때만)
const ENTER = new Set(['twist', 'blade', 'stack', 'spire', 'ovoid', 'arcology', 'slab', 'villa', 'dome', 'crystal', 'cap']);

// 땅에 닿은 평면 모양 (city-arch 의 모양과 같은 초타원: [k, 가로, 세로])
export const PLAN = { twist: [4, 1, 1], blade: [2.2, 1, 0.42], stack: [8, 1, 0.78], spire: [2, 1, 1], ovoid: [2, 0.62, 0.62], arcology: [6, 1, 1], slab: [10, 1, 1], villa: [10, 1, 0.7], dome: [2, 1.03, 1.03], crystal: [2, 0.88, 0.88], cap: [2, 0.3, 0.3] };
/** 건물 가운데에서 (nx, nz) 쪽으로 벽까지의 거리 (m) */
function planExt(r, nx, nz) {
  const [k, A, B] = PLAN[r.kind] || [2, 1, 1];
  const c = Math.cos(r.rot), s = Math.sin(r.rot);
  const lx = c * nx - s * nz, lz = s * nx + c * nz; // 건물 자기 좌표에서의 방향
  const th = Math.atan2(lz / r.sz, lx / r.sx);
  const ru = 1 / Math.pow(Math.pow(Math.abs(Math.cos(th)) / A, k) + Math.pow(Math.abs(Math.sin(th)) / B, k), 1 / k);
  return Math.hypot(ru * Math.cos(th) * r.sx, ru * Math.sin(th) * r.sz);
}

export class CityFabric {
  constructor(world, q = {}, { transit, facilities, currents } = {}) {
    this.world = world;
    world.city = this;
    this.scene = world.scene;
    const f = q.flora ?? 0.9;
    this.density = f < 0.5 ? 0.5 : f < 0.7 ? 0.78 : 1;
    this.nearR = f < 0.5 ? 480 : f < 0.7 ? 760 : f < 1 ? 1050 : 1450;
    this.farR = f < 0.5 ? 4200 : f < 0.7 ? 7000 : f < 1 ? 10000 : 13000;
    this.cut = { uCutCenter: { value: new THREE.Vector3(0, -1e6, 0) }, uNearCut: { value: this.nearR }, uFarCut: { value: this.farR } };
    this.arch = cityArchetypes();
    this.list = Object.fromEntries(Object.keys(this.arch).map((k) => [k, []])); // 모양 → [x, y, z, sx, sy, sz, rot, r, g, b]
    this.zones = [];
    this.lamps = new PointLights(this.scene, 6000, { minPx: 1.3, day: 0.0 });
    this.beacons = new PointLights(this.scene, 900, { minPx: 1.6, day: 0.25 });
    this._excl = [];
    this.holo = []; // [x, y, z, 너비, 높이, 방향, 색]
    this.recs = []; // 들어갈 수 있는 건물 기록 (문·실내를 만들 때 씀)
    this.recGrid = new Map();
    this.hidden = new Map(); // 모양 → 숨길 인스턴스 번호들 (들어간 건물은 문이 뚫린 따로 모델로)
    this._exclusions(transit, facilities, currents);
    const t0 = performance.now();
    for (const Z of ZONES) { try { this._zone(Z); } catch (e) { console.warn('[city]', Z.id, e); } }
    this._meshes();
    this._holograms();
    this.count = Object.values(this.list).reduce((s, l) => s + l.length / 10, 0);
    this.buildMs = performance.now() - t0;
    this._last = new THREE.Vector3(0, -1e6, 0);
  }

  // ── 피해야 할 곳 ─────────────────────────
  _exclusions(transit, facilities, currents) {
    const E = this._excl;
    if (facilities) for (const F of facilities.list) E.push([F.x, F.z, F.R + (F.type === 'dock' ? 48 : 24)]);
    for (const p of PLACES) {
      if (SKIP_PLACE.has(p.type)) continue;
      const r = Math.max(p.flat ? p.flat.r + 20 : 0, p.radius ? Math.min(p.radius, 400) + 20 : 45);
      E.push([p.pos[0], p.pos[1], r]);
    }
    const res = (at, off = [0, 0]) => { if (Array.isArray(at)) return [at[0] + off[0], at[1] + off[1]]; const p = PLACE[at]; return p ? [p.pos[0] + off[0], p.pos[1] + off[1]] : null; };
    for (const n of NPCS) { const p = res(n.place, n.offset); if (p) E.push([p[0], p[1], 22]); }
    for (const g of GLYPH_STONES) { const p = res(g.at, g.off); if (p) E.push([p[0], p[1], 16]); }
    for (const e of ECHOES) { const p = res(e.at, e.off); if (p) E.push([p[0], p[1], 16]); }
    // 빛길 관 아래 (40 m 칸)
    this._tube = new Set();
    const mark = (x, z) => { const i = Math.floor(x / 40), j = Math.floor(z / 40); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) this._tube.add((i + a) * 100003 + (j + b)); };
    const walk = (pts) => { for (let k = 1; k < pts.length; k++) { const A = pts[k - 1], B = pts[k]; const n = Math.ceil(A.distanceTo(B) / 20); for (let s = 0; s <= n; s++) mark(A.x + (B.x - A.x) * (s / n), A.z + (B.z - A.z) * (s / n)); } };
    if (transit) { walk(transit.ring.pts); for (const L of transit.lines) walk(L.path.pts); }
    // 낮게 흐르는 해류 아래도 비운다
    if (currents) for (const c of currents.list) {
      const low = (c.samples || []).filter((p) => p.y - Math.max(0, heightAt(p.x, p.z)) < 380);
      for (let k = 1; k < low.length; k++) if (low[k].distanceTo(low[k - 1]) < 200) walk([low[k - 1], low[k]]);
    }
    // 칸으로 나눠 빠르게 찾기
    this._exGrid = new Map();
    for (const e of E) {
      const r = e[2];
      for (let i = Math.floor((e[0] - r) / 200); i <= Math.floor((e[0] + r) / 200); i++) for (let j = Math.floor((e[1] - r) / 200); j <= Math.floor((e[1] + r) / 200); j++) {
        const k = i * 100003 + j;
        if (!this._exGrid.has(k)) this._exGrid.set(k, []);
        this._exGrid.get(k).push(e);
      }
    }
  }

  _excluded(x, z, R) {
    if (this._tube.has(Math.floor(x / 40) * 100003 + Math.floor(z / 40))) return true;
    const arr = this._exGrid.get(Math.floor(x / 200) * 100003 + Math.floor(z / 200));
    if (arr) for (const e of arr) if (Math.hypot(x - e[0], z - e[1]) < e[2] + R) return true;
    return false;
  }

  /** 다른 구조물과 겹치는가 → 겹치면 -1, 아니면 지을 수 있는 최고 높이 */
  _room(x, z, R, gy, ignoreCity = false) {
    let top = 1e9;
    for (const c of this.world.colliders.near(x, z, R + 6)) {
      if (c.obj || c.sky || (ignoreCity && c.city)) continue;
      let d;
      if (c.type === 'cyl') d = Math.hypot(x - c.x, z - c.z) - c.r;
      else { const dx = x - c.x, dz = z - c.z; const lx = Math.abs(dx * c.cos - dz * c.sin) - c.hx, lz = Math.abs(dx * c.sin + dz * c.cos) - c.hz; d = Math.hypot(Math.max(lx, 0), Math.max(lz, 0)); }
      if (d > R + (c.city ? 0.5 : 3)) continue;
      if (c.y0 > gy + 24) { top = Math.min(top, c.y0 - 8); continue; } // 다리·고리·관 밑: 낮게
      return -1;
    }
    return top;
  }

  // ── 구역 하나 깔기 ─────────────────────────
  _zone(Z) {
    const [cx, cz] = Array.isArray(Z.at) ? Z.at : PLACE[Z.at].pos;
    const rnd = mulberry32((cx * 13 + cz * 7) | 0);
    const noise = Z.clump ? createNoise2D((cx | 0) ^ 0x5bd1) : null;
    const style = Object.entries(STYLES[Z.style]);
    const wsum = style.reduce((s, [, w]) => s + w, 0);
    const pick = () => { let r = rnd() * wsum; for (const [k, w] of style) { if ((r -= w) <= 0) return k; } return style[0][0]; };
    const tints = (TINTS[Z.tint] || TINTS.pearl).map((h) => new THREE.Color(h));
    const avA = Array.from({ length: Z.avenues }, (_, i) => (i / Z.avenues) * TAU + (cx % 7) * 0.1);
    const zone = { ...Z, cx, cz, streets: [], avA, buildings: 0, roadMesh: null, tall: [] };
    const nb = Math.floor((Z.r1 - Z.r0) / Z.ring);
    const bw = Z.ring - Z.street;
    const avW = Z.street * 0.8 + 6;
    for (let k = 0; k < nb; k++) {
      const band0 = Z.r0 + k * Z.ring;
      zone.streets.push(band0 + Z.street / 2);
      for (let row = 0; row < Z.rows; row++) {
        const R = band0 + Z.street + (bw / Z.rows) * (row + 0.5);
        const rrMax = Math.min(Z.foot[1], (bw / Z.rows) * 0.46, Z.lot * 0.46);
        const n = Math.floor((TAU * R) / Z.lot);
        const a0 = rnd() * TAU;
        for (let i = 0; i < n; i++) {
          if (rnd() > Z.fill * this.density) continue;
          const a = a0 + (i / n) * TAU + (rnd() - 0.5) * 0.15 * (Z.lot / R);
          const rr = Math.max(Z.foot[0], rrMax * (0.7 + rnd() * 0.3));
          // 대로 자리
          let onAv = false;
          for (const av of avA) { const da = Math.abs(Math.atan2(Math.sin(a - av), Math.cos(a - av))); if (da * R < avW + rr) { onAv = true; break; } }
          if (onAv) continue;
          const x = cx + Math.cos(a) * R, z = cz + Math.sin(a) * R;
          if (noise && noise(x / Z.clump, z / Z.clump) < -0.15) continue;
          if (this._excluded(x, z, rr + 4)) continue;
          // 땅: 가운데와 네 귀퉁이
          const hc = heightAt(x, z);
          let mn = hc, mx = hc;
          for (let s = 0; s < 4; s++) { const sa = a + s * 1.5708; const h = heightAt(x + Math.cos(sa) * rr, z + Math.sin(sa) * rr); mn = Math.min(mn, h); mx = Math.max(mx, h); }
          const wet = mn < 1.2;
          let kind = pick();
          if (wet) { if (!Z.water || mn < -10) continue; kind = 'stilt'; }
          if (mx - mn > rr * 0.9 + 3) continue; // 벼랑
          const gy = Math.max(hc, 0);
          const room = this._room(x, z, rr, gy);
          if (room < 0) continue;
          // 높이: 안쪽일수록(tall) 높고, 가끔 우뚝
          const inner = Math.exp(-(R - Z.r0) / ((Z.r1 - Z.r0) * 0.45));
          let h = Z.h[0] + (Z.h[1] - Z.h[0]) * Math.pow(rnd(), 1.7) * (1 - Z.tall + Z.tall * inner);
          if (rnd() < 0.05) h *= 1.5;
          const [sx, sy0, sz0, colR, roofK, hzK = 0.95] = SIZE[kind](rr, h, rnd);
          const base = (wet ? Math.min(mn, 0) : mn) - 1.5;
          let sy = sy0 + (gy - base);
          if (base + sy > room) sy = room - base;
          if (sy < 6) continue;
          const sz = sz0 || sx;
          // 길쭉한 건물은 거리를 따라 눕히고, 둥근 건물은 아무 쪽으로
          const rot = -a + (sz0 || hzK < 0.9 ? Math.PI / 2 : rnd() * TAU);
          const tc = tints[Math.floor(rnd() * tints.length)];
          this.list[kind].push(x, base, z, sx, sy, sz, rot, tc.r, tc.g, tc.b);
          // 충돌: 원통 또는 상자. 지붕은 밟을 수 있다
          const top = base + sy * roofK;
          const col = colR ? this.world.colliders.add({ type: 'cyl', x, z, r: sx * colR, y0: base, y1: top, dome: kind === 'dome' ? sy * 0.55 : undefined, city: true })
            : this.world.colliders.add({ type: 'box', x, z, hx: sx * 0.95, hz: sz * hzK, rot, y0: base, y1: top, city: true });
          const rec = { mx, kind, idx: this.list[kind].length / 10 - 1, x, z, a, base, gy, sx, sy, sz, rot, colR, hzK, roofK, top, col, podium: null, zone: Z.id, style: Z.style, seed: rnd(), doorSign: Z.rows === 2 && row === 1 ? 1 : -1 };
          // 기단: 고층 구역에서는 탑 밑을 낮은 블록이 이어 준다
          if (Z.podium && !LOWKIND.has(kind) && sy > 30) {
            const hl = (Z.lot / 2) * 0.98, hd = (bw / Z.rows / 2) * 0.96; // 반 길이·반 폭 (이웃 블록과 맞닿게)
            if (this._room(x, z, Math.hypot(hl, hd) * 0.8, gy, true) > 0) {
              const ph = Z.podium[0] + rnd() * (Z.podium[1] - Z.podium[0]);
              const prot = -a + Math.PI / 2;
              const ptop = gy + ph;
              const ty = 0.8 + rnd() * 0.2;
              this.list.podium.push(x, base, z, hl, ptop - base, hd, prot, tc.r * ty, tc.g * ty, tc.b * ty);
              const pcol = this.world.colliders.add({ type: 'box', x, z, hx: hl, hz: hd, rot: prot, y0: base, y1: ptop, city: true });
              rec.podium = { idx: this.list.podium.length / 10 - 1, hl, hd, rot: prot, top: ptop, col: pcol };
            }
          }
          if (ENTER.has(kind) || rec.podium) this._addRec(rec);
          if (sy > 110 && rnd() < 0.7) this.beacons.add(x, base + sy + 2, z, rnd() < 0.5 ? 0xff5a4a : 0xfff0e0, 5, 1.2, rnd());
          zone.buildings++;
          if (sy > 100) zone.tall.push([x, z, base, base + sy * roofK, sx * (colR || hzK)]);
          // 홀로그램 간판: 높은 탑 몇에 거리 쪽으로
          if (sy > 80 && rnd() < (Z.holo ?? 0.12)) {
            const out = rnd() < 0.5 ? 1 : -1;
            const hx = x + Math.cos(a) * out * (sx * 1.05 + 2), hz = z + Math.sin(a) * out * (sx * 1.05 + 2);
            const hy = base + sy * (0.35 + rnd() * 0.35);
            this.holo.push([hx, hy, hz, sx * (1.0 + rnd() * 0.6), sx * (0.5 + rnd() * 0.4), Math.atan2(Math.cos(a) * out, Math.sin(a) * out), Math.floor(rnd() * 4)]);
          }
        }
      }
    }
    zone.streets.push(Z.r0 + nb * Z.ring + Z.street / 2);
    zone.rOut = Z.r0 + nb * Z.ring;
    this._bridges(zone, rnd);
    this._roads(zone);
    this.zones.push(zone);
  }

  /** 입구 자리 정하기 + 찾기용 칸에 넣기 */
  _addRec(r) {
    const nx = Math.cos(r.a) * r.doorSign, nz = Math.sin(r.a) * r.doorSign;
    const ext = r.podium ? r.podium.hd : planExt(r, nx, nz);
    r.ext = ext;
    r.door = { x: r.x + nx * (ext + 0.25), z: r.z + nz * (ext + 0.25), nx, nz, yaw: Math.atan2(nx, nz) };
    r.floorY = Math.max(r.gy, r.mx, heightAt(r.door.x, r.door.z)) + 0.15;
    if (this._excluded(r.door.x, r.door.z, 3)) return;
    r.id = this.recs.length;
    this.recs.push(r);
    const k = Math.floor(r.door.x / 80) * 100003 + Math.floor(r.door.z / 80);
    if (!this.recGrid.has(k)) this.recGrid.set(k, []);
    this.recGrid.get(k).push(r);
  }

  /** 가장 가까운 입구 (반지름 R 안) */
  nearestDoor(x, z, R = 3) {
    let best = null, bd = R;
    const i0 = Math.floor(x / 80), j0 = Math.floor(z / 80);
    for (let i = i0 - 1; i <= i0 + 1; i++) for (let j = j0 - 1; j <= j0 + 1; j++) {
      const arr = this.recGrid.get(i * 100003 + j);
      if (!arr) continue;
      for (const r of arr) { const d = Math.hypot(r.door.x - x, r.door.z - z); if (d < bd) { bd = d; best = r; } }
    }
    return best;
  }

  /** 들어간 건물: 여럿이 함께 그리는 모델에서 빼고, 문이 뚫린 모델을 따로 세운다 */
  openShell(r) {
    const doorP = new THREE.Vector3(r.door.x, r.floorY, r.door.z), doorN = new THREE.Vector3(r.door.nx, 0, r.door.nz);
    const mk = (kind, idx) => {
      if (!this.hidden.has(kind)) this.hidden.set(kind, new Set());
      this.hidden.get(kind).add(idx);
      const S = this.sets.find((s) => s.kind === kind);
      const mat = litMaterial({ ...this.common, doorCut: true });
      mat.uniforms.uDoorP.value.copy(doorP);
      mat.uniforms.uDoorN.value.copy(doorN);
      mat.uniforms.uDoorS.value.set(1.55, 3.95);
      const m = new THREE.Mesh(this.arch[kind].hi, mat);
      m.matrixAutoUpdate = false;
      m.matrix.fromArray(S.mats, idx * 16);
      m.frustumCulled = false;
      this.scene.add(m);
      return m;
    };
    r.shells = [mk(r.kind, r.idx)];
    if (r.podium) r.shells.push(mk('podium', r.podium.idx));
    r.open = true;
    this._repartition(this._last.y > -1e5 ? this._last : new THREE.Vector3(r.x, r.gy, r.z));
  }

  closeShell(r) {
    for (const m of r.shells || []) { this.scene.remove(m); m.material.dispose(); }
    r.shells = null;
    this.hidden.get(r.kind)?.delete(r.idx);
    if (r.podium) this.hidden.get('podium')?.delete(r.podium.idx);
    r.open = false;
    this._repartition(this._last);
  }

  // ── 공중다리: 가까운 높은 탑끼리 (걸어서 건널 수 있다) ──
  _bridges(zone, rnd) {
    const T = zone.tall;
    const used = new Set();
    for (let i = 0; i < T.length; i++) {
      if (used.has(i) || rnd() > 0.55) continue;
      const [x1, z1, b1, t1, r1] = T[i];
      let best = -1, bd = 1e9;
      for (let j = 0; j < T.length; j++) {
        if (j === i || used.has(j)) continue;
        const d = Math.hypot(T[j][0] - x1, T[j][1] - z1);
        if (d > 40 && d < 120 && d < bd) { bd = d; best = j; }
      }
      if (best < 0) continue;
      const [x2, z2, b2, t2, r2] = T[best];
      const span = bd - (r1 + r2) * 0.55;
      if (span < 12) continue;
      const y = Math.max(b1, b2) + (Math.min(t1, t2) - Math.max(b1, b2)) * (0.4 + rnd() * 0.35);
      const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2, rot = -Math.atan2(z2 - z1, x2 - x1);
      const half = bd / 2 - Math.min(r1, r2) * 0.3;
      // 다리 아래로 높은 차선이 지나갈 수 있게, 그리고 다른 구조물과 겹치지 않게
      if (this._excluded(mx, mz, 4)) continue;
      this.list.bridge.push(mx, y, mz, half, 5.5, 3.2, rot, 1, 1, 1);
      this.world.colliders.add({ type: 'box', x: mx, z: mz, hx: half, hz: 3.2, rot, y0: y, y1: y + 5.5, city: true, walk: true });
      used.add(i); used.add(best);
      if (rnd() < 0.4) this.lamps.add(mx, y - 0.5, mz, 0x9ff6ff, 4, 0, 0);
    }
  }

  // ── 거리: 땅을 따라 깐 포장 띠 + 가운데 빛줄 + 가로등 ──
  _roads(zone) {
    const P = [], C = [], E = [], I = [];
    const col = new THREE.Color(0x8e8a9c), line = new THREE.Color(ACC[zone.id.length % 4]);
    let vi = 0;
    const strip = (pts, w, lamps) => {
      // pts: [[x, z], …] 를 따라 폭 w 띠. 물·벼랑·피할 곳은 끊는다
      let prev = null;
      for (let i = 0; i < pts.length; i++) {
        const [x, z] = pts[i];
        const h = heightAt(x, z);
        const ok = h > 0.8 && !this._excluded(x, z, 2);
        if (ok && prev && Math.abs(h - prev.h) < 9) {
          const dx = x - prev.x, dz = z - prev.z, L = Math.hypot(dx, dz) || 1;
          const nx = -dz / L, nz = dx / L;
          const quad = (o0, o1, y, c, e) => {
            P.push(prev.x + nx * o0, prev.h + y, prev.z + nz * o0, prev.x + nx * o1, prev.h + y, prev.z + nz * o1, x + nx * o1, h + y, z + nz * o1, x + nx * o0, h + y, z + nz * o0);
            for (let k = 0; k < 4; k++) { C.push(c.r, c.g, c.b); E.push(e); }
            I.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
            vi += 4;
          };
          quad(-w / 2, w / 2, 0.35, col, 0.0);
          quad(-0.3, 0.3, 0.42, line, 1.2);
          if (lamps && (i % 3 === 0)) this.lamps.add(x + nx * (w / 2 + 1), h + 6, z + nz * (w / 2 + 1), 0xffd6a0, 3, 0, 0);
        }
        prev = ok ? { x, z, h } : null;
      }
    };
    const { cx, cz } = zone;
    if (zone.streetEvery) {
      zone.streets.forEach((R, k) => {
        if (k % zone.streetEvery) return;
        const n = Math.ceil((TAU * R) / 22);
        strip(Array.from({ length: n + 1 }, (_, i) => [cx + Math.cos((i / n) * TAU) * R, cz + Math.sin((i / n) * TAU) * R]), zone.street * 0.55, true);
      });
    }
    for (const a of zone.avA) {
      const n = Math.ceil((zone.rOut - zone.r0) / 22);
      strip(Array.from({ length: n + 1 }, (_, i) => { const r = zone.r0 - zone.street + ((zone.rOut - zone.r0 + zone.street) * i) / n; return [cx + Math.cos(a) * r, cz + Math.sin(a) * r]; }), zone.street * 0.7, true);
    }
    if (!P.length) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
    g.setAttribute('emit', new THREE.Float32BufferAttribute(E, 1));
    g.setIndex(I);
    g.computeVertexNormals();
    if (!this.roadMat) {
      this.roadMat = litMaterial({ vertexColors: true, vertexEmit: true, emissive: 0xffffff, emissiveIntensity: 1.2, emissiveNight: 0.9, rim: 0.1, side: THREE.DoubleSide });
      this.roadMat.polygonOffset = true;
      this.roadMat.polygonOffsetFactor = -2;
      this.roadMat.polygonOffsetUnits = -6;
    }
    const m = new THREE.Mesh(g, this.roadMat);
    m.renderOrder = 1;
    this.scene.add(m);
    zone.roadMesh = m;
  }

  // ── 인스턴스 메시 ─────────────────────────
  _meshes() {
    const common = { vertexColors: true, vertexEmit: true, facade: true, emissive: 0xffffff, emissiveIntensity: 1.5, emissiveNight: 0.8, rim: 0.3, rimColor: 0xe0e8ff, spec: 0.5, side: THREE.DoubleSide, winGlow: 0.7,
      tech: this.density < 0.6 ? undefined : { scale: 2.8, glow: 0.55, metal: 0.4, mode: 0 } };
    this.common = common;
    this.matHi = litMaterial(common);
    this.matLo = litMaterial({ ...common, cut: this.cut });
    this.sets = [];
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    for (const [kind, L] of Object.entries(this.list)) {
      const n = L.length / 10;
      if (!n) continue;
      const mats = new Float32Array(n * 16), cols = new Float32Array(n * 3), pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const o = i * 10;
        p.set(L[o], L[o + 1], L[o + 2]);
        q.setFromAxisAngle(up, L[o + 6]);
        s.set(L[o + 3], L[o + 4], L[o + 5]);
        m4.compose(p, q, s);
        m4.toArray(mats, i * 16);
        cols[i * 3] = L[o + 7]; cols[i * 3 + 1] = L[o + 8]; cols[i * 3 + 2] = L[o + 9];
        pos[i * 3] = L[o]; pos[i * 3 + 1] = L[o + 1]; pos[i * 3 + 2] = L[o + 2];
      }
      const lo = new THREE.InstancedMesh(this.arch[kind].lo, this.matLo, n);
      lo.instanceMatrix.array.set(mats);
      lo.instanceColor = new THREE.InstancedBufferAttribute(cols.slice(), 3);
      lo.frustumCulled = false;
      this.scene.add(lo);
      const cap = Math.min(n, 5000);
      const hi = new THREE.InstancedMesh(this.arch[kind].hi, this.matHi, cap);
      hi.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      hi.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3).setUsage(THREE.DynamicDrawUsage);
      hi.count = 0;
      hi.frustumCulled = false;
      this.scene.add(hi);
      this.sets.push({ kind, n, mats, cols, pos, lo, hi, cap });
    }
    // 입구: 가까운 것만 (문 모양 하나, 그리기 1회)
    this.doorCap = 2500;
    this.doors = new THREE.InstancedMesh(doorGeo(), this.matHi, this.doorCap);
    this.doors.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.doors.count = 0;
    this.doors.frustumCulled = false;
    this.scene.add(this.doors);
  }

  /** 홀로그램 간판: 아웬 글자가 흐르는 빛 판 (인스턴스 1회 그리기) */
  _holograms() {
    const n = this.holo.length;
    if (!n) return;
    const cols = [0x7ff3e6, 0xff9fd0, 0xffc46a, 0xb9a6ff].map((h) => new THREE.Color(h));
    const mat = new THREE.ShaderMaterial({
      uniforms: { ...atmosUniforms, uTex: { value: glyphStripTexture(11, 32) } },
      vertexShader: `${CURVE_GLSL}
        varying vec2 vUv; varying vec3 vWorld; varying vec3 vCol; varying float vSeed;
        void main() {
          vUv = uv;
          vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
          vWorld = wp.xyz;
          vCol = instanceColor;
          vSeed = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5);
          gl_Position = projectionMatrix * viewMatrix * vec4(curveWorld(wp.xyz), 1.0);
        }`,
      fragmentShader: `${NOISE_GLSL}${ATMOS_PARS}
        uniform sampler2D uTex;
        varying vec2 vUv; varying vec3 vWorld; varying vec3 vCol; varying float vSeed;
        void main() {
          vec2 uv = vec2(vUv.x * 0.6 + uTime * (0.02 + vSeed * 0.04) + vSeed * 7.0, vUv.y);
          float g = texture2D(uTex, uv).r;
          float edge = step(vUv.x, 0.015) + step(0.985, vUv.x) + step(vUv.y, 0.03) + step(0.97, vUv.y);
          float scan = 0.7 + 0.3 * sin(vWorld.y * 2.5 - uTime * 5.0);
          float flick = 0.85 + 0.15 * step(0.93, vnoise(vec2(uTime * 6.0, vSeed * 40.0)));
          vec3 c = vCol * (g * 1.3 * scan + 0.08 + min(edge, 1.0) * 0.8) * flick * (0.45 + 0.9 * clamp(uGlow, 0.0, 1.0));
          c *= 1.0 - fogAmount(cameraPosition, vWorld);
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const im = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), mat, n);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    this.holo.forEach(([x, y, z, w, h, yaw, ci], i) => {
      q.setFromAxisAngle(up, yaw);
      m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(w, h, 1));
      im.setMatrixAt(i, m4);
      im.setColorAt(i, cols[ci]);
    });
    im.frustumCulled = false;
    this.scene.add(im);
    this.holoMesh = im;
  }

  /** 카메라가 움직이면 가까운 건물을 자세한 모델로 다시 고른다 */
  _repartition(cam) {
    this._last.copy(cam);
    this.cut.uCutCenter.value.copy(cam);
    const R2 = this.nearR * this.nearR;
    for (const S of this.sets) {
      const hm = S.hi.instanceMatrix.array, hc = S.hi.instanceColor.array;
      const hide = this.hidden.get(S.kind);
      let k = 0;
      for (let i = 0; i < S.n && k < S.cap; i++) {
        const dx = S.pos[i * 3] - cam.x, dy = S.pos[i * 3 + 1] - cam.y, dz = S.pos[i * 3 + 2] - cam.z;
        if (dx * dx + dy * dy + dz * dz >= R2) continue;
        if (hide && hide.has(i)) continue;
        hm.set(S.mats.subarray(i * 16, i * 16 + 16), k * 16);
        hc[k * 3] = S.cols[i * 3]; hc[k * 3 + 1] = S.cols[i * 3 + 1]; hc[k * 3 + 2] = S.cols[i * 3 + 2];
        k++;
      }
      S.hi.count = k;
      if (k) {
        S.hi.instanceMatrix.clearUpdateRanges(); S.hi.instanceMatrix.addUpdateRange(0, k * 16); S.hi.instanceMatrix.needsUpdate = true;
        S.hi.instanceColor.clearUpdateRanges(); S.hi.instanceColor.addUpdateRange(0, k * 3); S.hi.instanceColor.needsUpdate = true;
      }
    }
    // 가까운 입구
    if (this.doors) {
      const DR2 = Math.min(this.nearR, 700) ** 2;
      const m4 = this._dm || (this._dm = new THREE.Matrix4()), q = this._dq || (this._dq = new THREE.Quaternion()), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
      let k = 0;
      for (const r of this.recs) {
        if (k >= this.doorCap) break;
        const dx = r.door.x - cam.x, dy = r.floorY - cam.y, dz = r.door.z - cam.z;
        if (dx * dx + dy * dy + dz * dz >= DR2 || r.open) continue;
        q.setFromAxisAngle(up, r.door.yaw);
        m4.compose(p.set(r.door.x, r.floorY, r.door.z), q, one);
        this.doors.setMatrixAt(k++, m4);
      }
      this.doors.count = k;
      this.doors.instanceMatrix.needsUpdate = true;
    }
  }

  /** 아웬이 걷는 길: 구역 안이면 가장 가까운 고리 거리 위로 */
  snapStreet(x, z) {
    for (const Z of this.zones) {
      const dx = x - Z.cx, dz = z - Z.cz, r = Math.hypot(dx, dz);
      if (r < Z.r0 - Z.street || r > Z.rOut + Z.street) continue;
      let best = Z.streets[0];
      for (const R of Z.streets) if (Math.abs(R - r) < Math.abs(best - r)) best = R;
      const a = Math.atan2(dz, dx);
      return { x: Z.cx + Math.cos(a) * best, z: Z.cz + Math.sin(a) * best, zone: Z, R: best };
    }
    return null;
  }

  /** 그려진 거리 위인가 (풀·덤불을 거리에서 치운다) */
  isStreet(x, z) {
    for (const Z of this.zones) {
      if (!Z.roadMesh) continue;
      const dx = x - Z.cx, dz = z - Z.cz, r2 = dx * dx + dz * dz;
      const lo = Z.r0 - Z.street, hi = Z.rOut + Z.street;
      if (r2 < lo * lo || r2 > hi * hi) continue;
      const r = Math.sqrt(r2);
      if (Z.streetEvery) {
        const k = Math.round((r - Z.r0 - Z.street / 2) / Z.ring);
        if (k >= 0 && k % Z.streetEvery === 0 && Math.abs(r - (Z.r0 + k * Z.ring + Z.street / 2)) < Z.street * 0.3 + 1.5) return true;
      }
      const a = Math.atan2(dz, dx);
      for (const av of Z.avA) if (Math.abs(Math.atan2(Math.sin(a - av), Math.cos(a - av))) * r < Z.street * 0.35 + 1.5) return true;
    }
    return false;
  }

  /** 건물이 선 자리인가 */
  isBuilt(x, z) {
    for (const c of this.world.colliders.near(x, z, 1)) {
      if (!c.city) continue;
      if (c.type === 'cyl') { if (Math.hypot(x - c.x, z - c.z) < c.r + 1) return true; }
      else { const dx = x - c.x, dz = z - c.z; if (Math.abs(dx * c.cos - dz * c.sin) < c.hx + 1 && Math.abs(dx * c.sin + dz * c.cos) < c.hz + 1) return true; }
    }
    return false;
  }

  /** 도시 구역 안인가 (거대 식물은 도시 안에 자라지 않는다) */
  urban(x, z) {
    for (const Z of this.zones) {
      const dx = x - Z.cx, dz = z - Z.cz, r2 = dx * dx + dz * dz, lo = Math.max(0, Z.r0 - 200), hi = Z.rOut + 150;
      if (r2 > lo * lo && r2 < hi * hi) return true;
    }
    return false;
  }

  /** 식물이 자라면 안 되는 곳 */
  blocks(x, z) { return this.isStreet(x, z) || this.isBuilt(x, z); }

  update(dt, ctx) {
    const cam = ctx && ctx.game ? ctx.game.engine.camera.position : null;
    if (!cam) return;
    const L = this._last;
    const moved = (cam.x - L.x) ** 2 + (cam.z - L.z) ** 2 + (cam.y - L.y) ** 2;
    if (moved > 45 * 45) this._repartition(cam);
    for (const Z of this.zones) if (Z.roadMesh) Z.roadMesh.visible = Math.hypot(cam.x - Z.cx, cam.z - Z.cz) < Z.r1 + 4000 && cam.y < 9000;
    this.lamps.update();
    this.beacons.update();
  }
}
