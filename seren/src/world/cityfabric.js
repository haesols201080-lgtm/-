// 도시의 살: 계획된 블록마다 쓰임에 맞는 건물·마당·소품·주민 자리를 짓는다.
//  · 계획: world/cityplan.js — 구역을 「고리 거리 + 방사 대로 + 골목」 블록으로 나누고 쓰임(주거·상업·공공·산업·물류·에너지·
//    연구·교통·인공 환경·계획 녹지·광장·농지·주택가)을 배정한 뒤, 쓰임별 템플릿이 실제 미터로 배치한다.
//  · 바닥: 지형 셰이더(city-ground.js)가 같은 계획을 읽어 차도·보도·안뜰·마당·연못·이랑을 그린다 (지오메트리 없음).
//  · 그리기: 건물 모양마다 인스턴스 둘 — 가까운 것은 자세한 모델(카메라가 움직이면 다시 고름), 나머지는 단순 모델을
//    한꺼번에 올려 두고 셰이더가 거리로 잘라 낸다(USE_CUT). 소품은 종류마다 1회(가까운 것만).
//  · 충돌: 건물은 모양에 맞춘 겹 충돌체(탑의 층, 착륙대 원반, 지붕…), 소품은 플레이어 둘레에서만 켠다(흘려 넣기).
import * as THREE from 'three';
import { heightAt, setPads, setRuralBlocks } from './heightfield.js';
import { mulberry32 } from '../core/noise.js';
import { cityArchetypes, SPEC, PROPCOL, doorGeo, propArchetypes } from './city-arch.js';
import { buildPlan, layoutBlock, layoutCore, uvToWorld, locate } from './cityplan.js';
import { planUniforms, applyPlanUniforms } from './city-ground.js';
import { litMaterial } from './materials.js';
import { PointLights } from './lights.js';
import { glyphStripTexture } from './hologram.js';
import { CURVE_GLSL, ATMOS_PARS, NOISE_GLSL } from './shaders.js';
import { atmosUniforms } from './atmosphere.js';
import { PLACE, PLACES } from '../data/places.js';
import { NPCS, GLYPH_STONES, ECHOES } from '../data/story.js';
import { ZONES, STYLE_KINDS, TINTS, USE, hasStreet, isRural } from '../data/city.js';
import { OUTDOOR } from '../data/venues.js';

const TAU = Math.PI * 2;
/** 골목 모양 (city-ground.js 의 laneStyle 과 같은 규칙): 1 작업로 2 녹지 산책길 3 상가 거리 4 보조 도로 0 보통 골목 */
function laneStyleJS(tA, tB, mid) {
  const ind = (t) => (t >= 4 && t <= 6) || t === 8, green = (t) => t === 10 || t === 11;
  if (ind(tA) && ind(tB)) return 1;
  if (mid && !green(tA) && !green(tB)) return 4;
  if (green(tA) || green(tB) || tA === 3 || tB === 3) return 2;
  if (tA === 2 || tB === 2) return 3;
  return 0;
}
const SKIP_PLACE = new Set(['capital', 'district', 'none']);
const FLAT = new Set(['pad']);
const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);

/** 건물 가운데에서 (nx, nz) 쪽으로 벽까지의 거리 (m) */
export function planExt(r, nx, nz) {
  const [k, A, B] = (SPEC[r.kind] && SPEC[r.kind].plan) || [2, 1, 1];
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
    this.propR = f < 0.5 ? 260 : f < 0.7 ? 420 : f < 1 ? 600 : 800;
    this.cut = { uCutCenter: { value: new THREE.Vector3(0, -1e6, 0) }, uNearCut: { value: this.nearR }, uFarCut: { value: this.farR } };
    this.arch = cityArchetypes();
    this.list = Object.fromEntries(Object.keys(this.arch).map((k) => [k, []])); // 모양 → [x, y, z, sx, sy, sz, rot, r, g, b]
    this.parch = propArchetypes();
    this.plist = Object.fromEntries(Object.keys(this.parch).map((k) => [k, []])); // 소품 → [x, y, z, 배율, 방향, x배율]
    this.pkind = Object.keys(this.parch);
    this.zones = [];
    this.lamps = new PointLights(this.scene, 12000, { minPx: 1.3, day: 0.0 });
    this.beacons = new PointLights(this.scene, 900, { minPx: 1.6, day: 0.25 });
    this._excl = [];
    this.holo = []; // [x, y, z, 너비, 높이, 방향, 색]
    this.recs = []; // 들어갈 수 있는 건물 기록 (문·실내·주민이 쓴다)
    this.recGrid = new Map();
    this.outRecs = []; // 들어갈 수 없지만 바깥 조작대로 쓰는 건물 (OUTDOOR)
    this.hidden = new Map(); // 모양 → 숨길 인스턴스 번호들 (들어간 건물은 문이 뚫린 따로 모델로)
    this.bgrid = new Map(); // 160 m 칸 → 블록 (소품·주민 자리를 가까운 블록부터 깨운다)
    this.colOn = new Set(); // 소품 충돌체가 켜진 블록
    this.activeN = 0;
    this.uses = {};
    this._exclusions(transit, facilities, currents);
    const t0 = performance.now();
    // 계획 → 배치
    this.plan = buildPlan({
      height: (x, z) => heightAt(x, z),
      bigPlace: (x, z, r) => this._bigExcl(x, z, r),
    });
    this.timing = { plan: performance.now() - t0, layout: 0, street: 0 };
    // 시골 구역: 바닥을 까는 블록(논밭·녹지·빈 땅이 아닌 것)은 지형을 길 높이에 맞춘 매끈한 면으로 — 건물을 놓기 전에
    const rural = {};
    for (const P of this.plan.zones) {
      if (!isRural(P.Z)) continue;
      const a = new Uint8Array(P.size);
      for (const B of P.blocks) a[B.idx] = B.type && B.type !== USE.GRN && B.type !== USE.FARM ? 1 : 0;
      rural[P.zi] = a;
    }
    setRuralBlocks(rural);
    if (world.terrain && world.terrain.setRuralBlocks) world.terrain.setRuralBlocks(rural);
    this.SPEC = SPEC; // (검사 도구가 모양 평면을 본다)
    this.pads = []; // 시골 집터 [x, z, 반폭x, 반폭z, 방향, 높이] — 다 지은 뒤 지형(메인·워커)에 넘긴다
    for (const P of this.plan.zones) { try { this._zone(P); } catch (e) { console.warn('[city]', P.Z.id, e); } }
    this._extraHouses();
    this.padData = new Float32Array(this.pads);
    setPads(this.padData);
    if (world.terrain && world.terrain.setPads) world.terrain.setPads(this.padData);
    const t1 = performance.now();
    this._meshes();
    this._propMeshes();
    this._holograms();
    this.timing.meshes = performance.now() - t1;
    this.count = Object.values(this.list).reduce((s, l) => s + l.length / 10, 0);
    // 보조 랜드마크 목록 (지도·안내용)
    const MARK = { lm_coil: ['울림 코일 탑', '#ffc46a'], lm_ear: ['별귀 탑', '#7ff3e6'], lm_port: ['하늘 나루', '#9fd8ff'], lm_garden: ['매달린 정원', '#8fe0a0'], lm_tree: ['생명나무', '#ff9fd0'] };
    this.marks = [];
    for (const [k, [name, color]] of Object.entries(MARK)) { const L = this.list[k]; if (L && L.length) this.marks.push({ kind: k, name, color, x: L[0], y: L[1], z: L[2], rot: L[6] }); }
    this.rawProps = this.plan.zones.reduce((s, P) => s + P.blocks.reduce((a, B) => a + (B.raw ? B.raw.length : 0), 0), 0);
    this.buildMs = performance.now() - t0;
    this._last = new THREE.Vector3(0, -1e6, 0);
    // 지형 셰이더에 계획을 넘긴다 (블록 바닥)
    this.planU = planUniforms(this.plan);
    if (world.terrain && world.terrain.material) applyPlanUniforms(world.terrain.material, this.planU);
  }

  // ── 피해야 할 곳 ─────────────────────────
  _exclusions(transit, facilities, currents) {
    const E = this._excl;
    if (facilities) for (const F of facilities.list) E.push([F.x, F.z, F.R + (F.type === 'dock' ? 48 : 24)]);
    for (const p of PLACES) {
      if (SKIP_PLACE.has(p.type)) continue;
      const r = Math.max(p.flat ? p.flat.r + 20 : 0, p.radius ? Math.min(p.radius, 400) + 20 : 45);
      E.push([p.pos[0], p.pos[1], r, true]);
    }
    const res = (at, off = [0, 0]) => { if (Array.isArray(at)) return [at[0] + off[0], at[1] + off[1]]; const p = PLACE[at]; return p ? [p.pos[0] + off[0], p.pos[1] + off[1]] : null; };
    for (const n of NPCS) { const p = res(n.place, n.offset); if (p) E.push([p[0], p[1], 22]); }
    for (const g of GLYPH_STONES) { const p = res(g.at, g.off); if (p) E.push([p[0], p[1], 16]); }
    for (const e of ECHOES) { const p = res(e.at, e.off); if (p) E.push([p[0], p[1], 16]); }
    // 빛길 역은 통째로 비우고, 관·낮은 해류 밑은 「높이만」 막는다 (거리·낮은 건물은 그 밑으로 이어진다)
    if (transit) for (const S of transit.stations) E.push([S.x, S.z, 46]);
    if (transit) for (const [x, z] of transit.supportPts || []) E.push([x, z, 7]); // 관 받침 기둥 둘레
    this._corr = new Map(); // 40 m 칸 → [ax, az, bx, bz, 바닥 높이, 반폭]
    const seg = (A, B, under, w) => {
      const m = w + 30, x0 = Math.min(A.x, B.x) - m, x1 = Math.max(A.x, B.x) + m, z0 = Math.min(A.z, B.z) - m, z1 = Math.max(A.z, B.z) + m;
      const S = [A.x, A.z, B.x, B.z, Math.min(A.y, B.y) - under, w];
      for (let i = Math.floor(x0 / 40); i <= Math.floor(x1 / 40); i++) for (let j = Math.floor(z0 / 40); j <= Math.floor(z1 / 40); j++) {
        const k = i * 100003 + j;
        if (!this._corr.has(k)) this._corr.set(k, []);
        this._corr.get(k).push(S);
      }
    };
    const walk = (pts, under, w) => { for (let k = 1; k < pts.length; k++) seg(pts[k - 1], pts[k], under, w); };
    if (transit) { walk(transit.ring.pts, 10, 9); for (const L of transit.lines) walk(L.path.pts, 10, 9); }
    if (currents) for (const c of currents.list) {
      const low = (c.samples || []).filter((p) => p.y - Math.max(0, heightAt(p.x, p.z)) < 380);
      for (let k = 1; k < low.length; k++) if (low[k].distanceTo(low[k - 1]) < 200) seg(low[k - 1], low[k], 34, 30);
    }
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

  _excluded(x, z, R, core = false) {
    const arr = this._exGrid.get(Math.floor(x / 200) * 100003 + Math.floor(z / 200));
    // 중심 광장 칸은 큰 장소(하모네아 자체) 원은 건너뛴다 — 인물·글자돌·시설 같은 작은 원과 구조물 충돌체(_clearAll)만 피한다
    if (arr) for (const e of arr) { if (core && e[3] && e[2] > 60) continue; if (Math.hypot(x - e[0], z - e[1]) < e[2] + R) return true; }
    return false;
  }
  /** 큰 장소(반지름 60 m 넘는) 한가운데인가 — 블록 전체를 광장·녹지로 */
  _bigExcl(x, z, R) {
    const arr = this._exGrid.get(Math.floor(x / 200) * 100003 + Math.floor(z / 200));
    if (arr) for (const e of arr) if (e[3] && e[2] > 60 && Math.hypot(x - e[0], z - e[1]) < e[2] - R * 0.3) return true;
    return false;
  }

  /** 빛길 관·낮은 해류 밑: 반지름 R 의 무엇이 닿지 않아야 할 높이 (없으면 Infinity) */
  _under(x, z, R) {
    const arr = this._corr.get(Math.floor(x / 40) * 100003 + Math.floor(z / 40));
    let cap = Infinity;
    if (!arr) return cap;
    for (const S of arr) {
      if (S[4] >= cap) continue;
      const dx = S[2] - S[0], dz = S[3] - S[1], L2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - S[0]) * dx + (z - S[1]) * dz) / L2));
      if (Math.hypot(x - S[0] - dx * t, z - S[1] - dz * t) < S[5] + R) cap = S[4];
    }
    return cap;
  }

  /** 도시 밖 구조물과 겹치는가 → 겹치면 -1, 아니면 지을 수 있는 최고 높이 */
  _room(x, z, R, gy) {
    let top = 1e9;
    for (const c of this.world.colliders.near(x, z, R + 6)) {
      if (c.obj || c.sky || c.city) continue;
      let d;
      if (c.type === 'cyl') d = Math.hypot(x - c.x, z - c.z) - c.r;
      else { const dx = x - c.x, dz = z - c.z; const lx = Math.abs(dx * c.cos - dz * c.sin) - c.hx, lz = Math.abs(dx * c.sin + dz * c.cos) - c.hz; d = Math.hypot(Math.max(lx, 0), Math.max(lz, 0)); }
      if (d > R + 3) continue;
      if (c.y0 > gy + 24) { top = Math.min(top, c.y0 - 8); continue; } // 다리·고리·관 밑: 낮게
      return -1;
    }
    return top;
  }

  // ── 구역 하나 ─────────────────────────────
  _zone(P) {
    const Z = P.Z, G = P.G;
    const streets = [];
    for (let k = 0; k <= G.nb; k++) if (hasStreet(G, k)) streets.push(G.r0 + k * G.ring + G.street / 2);
    const avA = Array.from({ length: G.avenues }, (_, i) => (i / G.avenues) * TAU + G.aOff);
    const zone = { ...Z, P, G, cx: G.cx, cz: G.cz, r0: G.r0, rOut: G.rOut, streets, streetEvery: 1, avA, buildings: 0, tall: [], blocks: P.blocks, rural: isRural(Z) };
    const tl = performance.now();
    const tints = (TINTS[Z.tint] || TINTS.pearl).map((h) => new THREE.Color(h));
    const kinds = STYLE_KINDS[Z.style] || STYLE_KINDS.capital;
    const pickFrom = (tab, r) => { const e = Object.entries(tab); let t = r() * e.reduce((s, [, w]) => s + w, 0); for (const [k, w] of e) if ((t -= w) <= 0) return k; return e[0][0]; };
    const peaks = this._peaks(P);
    for (const B of P.blocks) {
      B.zone = zone;
      B.act = 0;
      if (!B.covered && B.wet < 0.5) this._gridBlock(B);
      if (!B.type) continue;
      const rnd = mulberry32(Math.floor(B.seed * 4294967296) ^ (B.idx * 2654435761));
      B.spots = [];
      B.recs = [];
      const inner = Math.exp(-(B.R0 - G.r0) / ((G.rOut - G.r0) * 0.45));
      B.raw = [];
      const api = {
        rnd,
        mix: Z.sectors ? Z.sectors[B.s % Z.sectors.length] : Z.mix,
        sparse: Z.mix === 'suburb',
        pick: (Bk, cat) => pickFrom(kinds[cat] || kinds.tower, rnd),
        towerH: (Bk, f = 1) => this._height(P, B, peaks, inner, rnd) * f,
        podium: () => (Z.podium ? Z.podium[0] + rnd() * (Z.podium[1] - Z.podium[0]) : 0),
        bldg: (Bk, kind, u, v, hw, hd, h, o = {}) => this._bldg(zone, B, kind, u, v, hw, hd, h, o, tints[Math.floor(rnd() * tints.length)], rnd),
        prop: (Bk, kind, u, v, face, o = {}) => { B.raw.push(0, kind, u, v, face, o); },
        spot: (Bk, type, u, v, face, o = {}) => { B.raw.push(1, type, u, v, face, o); },
      };
      layoutBlock(B, api);
      this.uses[B.type] = (this.uses[B.type] || 0) + 1;
    }
    if (Z.core === 'plaza') this._core(P, zone, tints, peaks);
    this.timing.layout += performance.now() - tl;
    const ts = performance.now();
    this._bridges(zone, mulberry32((G.cx * 7 + G.cz * 3) | 0));
    this._lampPoints(zone);
    this.timing.street += performance.now() - ts;
    this.zones.push(zone);
  }

  /**
   * 중심 광장(core: 'plaza'): 지형 셰이더의 동심 판석 광장과 같은 칸(34 m 고리 띠 × 대로 사이 부채꼴)을 가짜 블록으로 만들어,
   * 칸마다 나무 화단·물의 정원(분수)·작은 시설(정자·기념탑·노점)·정류장·작은 건물(카페·회관)을 놓는다.
   * 블록과 똑같이 다가갈 때 깨어나고(소품·주민 자리·충돌체), 거대 구조물·장소와 겹치는 것은 놓지 않는다.
   */
  _core(P, zone, tints, peaks) {
    const G = P.G, SA = TAU / G.avenues, STEP = 34;
    const NK = Math.floor((G.r0 - G.street) / STEP);
    P.core = [];
    for (let kr = 1; kr < NK; kr++) for (let s = 0; s < G.avenues; s++) {
      const R0 = kr * STEP + 3.6, D = STEP - 3.6, th0 = G.aOff + s * SA, th1 = th0 + SA;
      const B = { zi: P.zi, G, k: -1 - kr, s, j: 0, m: 1, idx: 50000 + kr * 64 + s, R0, D, Rm: R0 + D / 2, th0, th1, t0: 4.75, t1: 4.75, type: 11, variant: (kr * 31 + s * 7) & 255, seed: ((kr * 977 + s * 131) % 1000) / 1000, core: true, kr, zone, act: 0 };
      B.L = (th1 - th0) * B.Rm - B.t0 - B.t1;
      B.cx = G.cx + Math.cos((th0 + th1) / 2) * B.Rm; B.cz = G.cz + Math.sin((th0 + th1) / 2) * B.Rm;
      this._gridBlock(B);
      B.spots = []; B.recs = []; B.raw = [];
      const rnd = mulberry32(B.idx * 2654435761 + P.zi * 97);
      layoutCore(B, {
        rnd, mix: 'civic', sparse: false, pick: () => 'dome', towerH: () => 12, podium: () => 0,
        bldg: (Bk, kind, u, v, hw, hd, h, o = {}) => this._bldg(zone, B, kind, u, v, hw, hd, h, o, tints[Math.floor(rnd() * tints.length)], rnd),
        prop: (Bk, kind, u, v, face, o = {}) => { B.raw.push(0, kind, u, v, face, o); },
        spot: (Bk, type, u, v, face, o = {}) => { B.raw.push(1, type, u, v, face, o); },
      }, NK);
      P.core.push(B);
    }
    void peaks;
  }

  /**
   * 높이 계층: 구역마다 「높은 군집」(peaks) 몇 곳을 두고, 군집에서 멀어질수록 묶음(부채꼴 쓰임)의 기본 높이대로 내려간다.
   * 저층 밀집(공장·연구 캠퍼스·주거 둘레동) → 중층(주거 탑·상가) → 고층 군집 → 군집 한가운데 초고층 하나 → 거대 랜드마크(megacity).
   * ZONES.peaks: [[부채꼴, 안쪽~바깥 0..1, 반지름 m, 세기]…] — 없으면 상업·교통 부채꼴 안쪽에 하나.
   */
  _peaks(P) {
    const Z = P.Z, G = P.G, SA = TAU / G.avenues;
    let list = Z.peaks;
    if (!list) {
      if (Z.mix === 'suburb' || Z.mix === 'village') return [];
      const secs = Z.sectors || [];
      const s = Math.max(0, secs.findIndex((m) => m === 'commerce' || m === 'transit'));
      list = [[s, 0.12, (G.rOut - G.r0) * 0.45, 0.85]];
    }
    return list.map(([s, t, R, k]) => {
      const a = G.aOff + (s + 0.5) * SA, r = G.r0 + t * (G.rOut - G.r0);
      const x = G.cx + Math.cos(a) * r, z = G.cz + Math.sin(a) * r;
      let best = null, bd = 1e9;
      // 초고층은 상업(먼저)·주거·교통 블록에만
      for (const B of P.blocks) { if (!B.type || B.covered || B.peak) continue; const pen = B.type === 2 ? 0 : B.type === 1 ? 60 : B.type === 8 ? 90 : 1e9; const d = Math.hypot(B.cx - x, B.cz - z) + pen; if (d < bd) { bd = d; best = B; } }
      if (best) best.peak = k;
      return { x, z, R, k };
    });
  }
  _height(P, B, peaks, inner, rnd) {
    const Z = P.Z;
    const mixName = Z.sectors ? Z.sectors[B.s % Z.sectors.length] : Z.mix;
    const HB = { commerce: [70, 140], civic: [50, 100], transit: [45, 95], residential: [50, 115], research: [32, 70], energy: [28, 60], bioindustry: [28, 60], suburb: [8, 16], town: [10, 28], village: [6, 14] }[mixName] || [12, 30];
    const lim = (v) => Math.min(v, Z.h[1]);
    let c = 0;
    for (const q of peaks) { const d = Math.hypot(B.cx - q.x, B.cz - q.z) / q.R; c = Math.max(c, q.k * Math.exp(-d * d * 2.2)); }
    c = Math.max(c, Z.tall * inner * 0.35);
    const base = lim(HB[0] + (HB[1] - HB[0]) * Math.pow(rnd(), 1.3));
    const high = Z.h[0] + (Z.h[1] - Z.h[0]) * (0.3 + 0.7 * Math.pow(rnd(), 0.8));
    const w = Math.max(0, Math.min(1, (c - 0.18) / 0.62));
    let h = base + (Math.max(high, base) - base) * w * w * (3 - 2 * w);
    // 군집 한가운데 블록: 초고층 하나 (첫 번째 탑에만)
    if (B.peak && !B.superDone) { B.superDone = true; h = Z.h[1] * (1.25 + 0.4 * B.peak * rnd()); }
    else if (c < 0.2 && rnd() < 0.05) h *= 1.7; // 낮은 동네의 드문 중층 탑
    return h;
  }

  /** 블록 좌표의 방향(바깥 기준) → 세계 방향(yaw = atan2(dx, dz)) */
  _yaw(a, face) {
    const Y0 = Math.atan2(Math.cos(a), Math.sin(a)); // 바깥(반지름 방향)
    if (face === 'out' || face === undefined) return Y0;
    if (face === 'in') return Y0 + Math.PI;
    if (face === 'u+') return Y0 - Math.PI / 2;
    if (face === 'u-') return Y0 + Math.PI / 2;
    return Y0 - face; // 숫자: 바깥 기준으로 돌린 각
  }
  /** 블록 평면의 각 φ (u 축에서 v 축 쪽으로) → 세계 yaw */
  _yawUV(a, phi) {
    const du = Math.cos(phi), dv = Math.sin(phi);
    const wx = -Math.sin(a) * du + Math.cos(a) * dv, wz = Math.cos(a) * du + Math.sin(a) * dv;
    return Math.atan2(wx, wz);
  }

  /** 건물 하나: 템플릿의 미터 크기 → 인스턴스 + 겹 충돌체 + 문 */
  _bldg(zone, B, kind, u, v, hw, hd, h, o, tint, rnd) {
    if (!SPEC[kind] || !this.list[kind]) return null;
    const [x, z, a] = uvToWorld(B, u, v);
    return this._bldgAt(zone, B, kind, x, z, a, hw, hd, h, o, tint, rnd);
  }

  /** 세계 좌표에 건물 하나 (a = 문 쪽 기준 각도: door 1 이면 (cos a, sin a) 쪽에 문) */
  _bldgAt(zone, B, kind, x, z, a, hw, hd, h, o, tint, rnd) {
    const S = SPEC[kind];
    if (!S || !this.list[kind]) return null;
    const R = Math.max(hw, hd);
    if (this._excluded(x, z, R * 0.85, B.core || B.extra)) return null;
    // 땅: 가운데와 네 귀퉁이
    const rot = -a + Math.PI / 2 + (o.rot || 0);
    const c = Math.cos(rot), s = Math.sin(rot);
    const hc = heightAt(x, z);
    let mn = hc, mx = hc;
    for (const [lx, lz] of [[hw, hd], [-hw, hd], [hw, -hd], [-hw, -hd]]) { const h2 = heightAt(x + lx * c + lz * s, z - lx * s + lz * c); mn = Math.min(mn, h2); mx = Math.max(mx, h2); }
    const wet = mn < 1.2;
    if (wet && !(kind === 'stilt' || B.stilt)) return null;
    // 벼랑에 걸치지 않게 (땅을 고른 도시에서는 늘 0 — 협곡 도시·시골에서 건물 한쪽이 흙에 묻히던 것)
    if (mx - mn > Math.min(Math.min(hw, hd) * 0.5 + 3.5, 6)) return null;
    // 시골: 땅은 자연 그대로, 건물 자리만 집터로 고른다(가운데와 네 귀퉁이 높이의 평균 — 길가 집은 길 높이 쪽으로)
    const pad = zone.rural && !wet && kind !== 'stilt' && !S.fixed;
    let padH = hc;
    if (pad) {
      if (mx - mn > Math.min(hw, hd) * 0.35 + 2.5) return null;
      let sum = hc, n = 1;
      for (const [lx, lz] of [[hw, hd], [-hw, hd], [hw, -hd], [-hw, -hd]]) { sum += heightAt(x + lx * c + lz * s, z - lx * s + lz * c); n++; }
      padH = sum / n;
      mn = mx = padH;
    }
    const gy = pad ? padH : Math.max(hc, 0);
    const under = this._under(x, z, R + 2);
    if (under - gy < 14) return null;
    const room = Math.min(this._room(x, z, R, gy), under);
    if (room < 0) return null;
    let base = (wet ? Math.min(mn, 0) : mn) - 1.2;
    let sy = h + (gy - base);
    // 물 위 집: 깊이와 상관없이 제 키(마루가 물·땅 위 1.2 m), 다리는 물속으로 — 깊은 물에서 늘어나 집이 물에 잠기지 않게
    if (kind === 'stilt') { sy = h; base = Math.max(mx, 0) + 1.2 - 0.53 * sy; } // 마루는 가장 높은 땅·물 위 1.2 m
    let sx, sz;
    if (S.fixed) {
      // 실제 미터로 지은 하나뿐인 건물(보조 랜드마크): 배율 1, 자리가 모자라면 짓지 않는다
      if (base + S.fixed + 10 > room) return null;
      sx = sy = sz = 1;
    } else {
      if (base + sy > room) sy = room - base;
      if (sy < 5) return null;
      if (S.round) sx = sz = Math.min(hw, hd);
      else { sx = hw; sz = hd; }
    }
    this.list[kind].push(x, base, z, sx, sy, sz, rot, tint.r, tint.g, tint.b);
    const idx = this.list[kind].length / 10 - 1;
    if (pad) { const [, A, Bp] = S.plan || [2, 1, 1]; this.pads.push(x, z, A * sx + 1.5, Bp * sz + 1.5, rot, padH); }
    // 겹 충돌체
    const cols = [];
    let top = base;
    for (const p of S.cols) {
      const px = p[1] * sx, pz = p[2] * sz;
      const wx = x + px * c + pz * s, wz = z - px * s + pz * c;
      if (p[0] === 'c') {
        const col = this.world.colliders.add({ type: 'cyl', x: wx, z: wz, r: p[3] * Math.min(sx, sz), y0: base + p[4] * sy, y1: base + p[5] * sy, dome: p[6] ? p[6] * sy : undefined, city: true });
        cols.push(col); top = Math.max(top, col.y1);
      } else {
        const col = this.world.colliders.add({ type: 'box', x: wx, z: wz, hx: p[3] * sx, hz: p[4] * sz, rot: rot + (p[7] || 0), y0: base + p[5] * sy, y1: base + p[6] * sy, city: true });
        cols.push(col); top = Math.max(top, col.y1);
      }
    }
    const rec = { kind, idx, x, z, a, base, gy, mx, sx, sy, sz, rot, cols, top, zone: zone.id, B, use: o.use || 'home', style: zone.style, seed: rnd(), podiumKind: !!o.podium, pad };
    B.recs.push(rec);
    if (OUTDOOR[kind] && !S.enter) { rec.out = OUTDOOR[kind]; this.outRecs.push(rec); }
    zone.buildings++;
    if (S.enter && o.use !== 'none' && o.door !== undefined) this._addRec(rec, a, o.door);
    if (sy > 110 && rnd() < 0.7) this.beacons.add(x, base + sy + 2, z, rnd() < 0.5 ? 0xff5a4a : 0xfff0e0, 5, 1.2, rnd());
    if (sy > 100) zone.tall.push([x, z, base, top, Math.min(sx, sz)]);
    // 홀로그램 간판: 높은 사무 탑 몇에 거리 쪽으로
    if (sy > 80 && (o.use === 'office' || o.use === 'market') && rnd() < 0.25) {
      const out = rnd() < 0.5 ? 1 : -1;
      const hx = x + Math.cos(a) * out * (sz * 1.05 + 2), hz = z + Math.sin(a) * out * (sz * 1.05 + 2);
      this.holo.push([hx, base + sy * (0.35 + rnd() * 0.35), hz, sx * (0.8 + rnd() * 0.5), sx * (0.4 + rnd() * 0.3), Math.atan2(Math.cos(a) * out, Math.sin(a) * out), Math.floor(rnd() * 4)]);
    }
    return rec;
  }

  /**
   * 옛 돔 집 자리 → 새 집: structures·megacity 가 땅 위 집 자리를 world.houseQueue 에 남겨 두면(자리 지킴 충돌체와 함께)
   * 여기서 도시의 집 모양(빌라·돔·거품 집)으로 짓는다 — 문·실내·주민이 있는, 들어갈 수 있는 집. 자리가 안 맞으면 짓지 않는다.
   */
  _extraHouses() {
    const Q = this.world.houseQueue || [];
    if (!Q.length) return;
    const zone = { id: 'old-town', style: 'suburb', rural: true, buildings: 0, tall: [] };
    const tints = (TINTS.pearl || ['#ffffff']).map((h) => new THREE.Color(h));
    const groups = new Map();
    let built = 0;
    for (const q of Q) {
      this.world.colliders.remove(q.col);
      const gk = q.group || 'x';
      if (!groups.has(gk)) groups.set(gk, { recs: [], spots: [], raw: [], idx: 60000 + groups.size, extra: true, act: 1, zone });
      const B = groups.get(gk);
      const rnd = mulberry32(Math.floor((q.x * 73856093) ^ (q.z * 19349663)) >>> 0);
      const k = rnd();
      const kind = q.r < 4.2 ? (k < 0.7 ? 'villa' : 'bubbles') : k < 0.62 ? 'villa' : k < 0.85 ? 'dome' : 'bubbles';
      let hw, hd, h;
      if (kind === 'villa') { hw = q.r * 1.25; hd = q.r * 1.2; h = 7.5 + rnd() * 3; }
      else if (kind === 'dome') { hw = hd = q.r * 1.1; h = q.r * 1.15 + 2; }
      else { hw = hd = q.r * 1.45; h = 9 + rnd() * 3; }
      const use = q.use || (rnd() < 0.82 ? 'home' : rnd() < 0.5 ? 'cafe' : 'market');
      const rec = this._bldgAt(zone, B, kind, q.x, q.z, q.fa ?? rnd() * TAU, hw, hd, h, { door: 1, use }, tints[Math.floor(rnd() * tints.length)], rnd);
      if (rec) built++;
    }
    this.extraBuilt = built;
  }

  /** 입구 자리 정하기 + 찾기용 칸에 넣기. door: -1 안쪽 거리 쪽, 1 바깥, 'u+' / 'u-' 블록 끝 쪽 */
  _addRec(r, a, door) {
    // 정한 쪽이 피할 곳(장소·인물·역…)에 막히면 다른 쪽에 문을 낸다 — 모든 건물이 쓰임을 갖게
    const sides = [door, typeof door === 'number' ? -door : door === 'u+' ? 'u-' : 'u+', 1, -1, 'u+', 'u-'];
    let nx, nz, ok = false;
    for (const sd of sides) {
      if (sd === 'u+') { nx = -Math.sin(a); nz = Math.cos(a); }
      else if (sd === 'u-') { nx = Math.sin(a); nz = -Math.cos(a); }
      else { nx = Math.cos(a) * sd; nz = Math.sin(a) * sd; }
      const ext = planExt(r, nx, nz);
      r.ext = ext;
      r.door = { x: r.x + nx * (ext + 0.25), z: r.z + nz * (ext + 0.25), nx, nz, yaw: Math.atan2(nx, nz) };
      if (!this._excluded(r.door.x, r.door.z, 3)) { ok = true; break; }
    }
    r.floorY = r.pad ? r.gy + 0.15 : Math.max(r.gy, r.mx, heightAt(r.door.x, r.door.z)) + 0.15; // 집터 위 건물은 집터 높이
    if (!ok) return;
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
      for (const r of arr.slice()) {
        if (!r.doorFixed && Math.hypot(r.x - x, r.z - z) < 60) this.fixDoor(r);
        const d = Math.hypot(r.door.x - x, r.door.z - z);
        if (d < bd) { bd = d; best = r; }
      }
    }
    return best;
  }

  /**
   * 문 자리 바로 잡기: 실제 건물 모델에 광선을 쏘아 바깥벽 바로 앞에 붙인다(떠 있거나 벽에 묻히지 않게).
   *  · 상가 기단 위의 탑은 기단 바깥벽에 문을 낸다(탑 발치는 기단 속이라 닿을 수 없다)
   *  · 다른 건물·구조물에 막힌 쪽, 문 앞에 설 수 없는 쪽, 이웃 문과 겹치는 쪽은 건너뛰고 다른 벽으로
   *  · 문 바닥 = 문 앞 땅 높이. 처음 쓸 때 한 번만 (r.doorFixed) — 가까운 것부터 뒤에서 조금씩 미리 한다
   */
  fixDoor(r) {
    if (r.doorFixed || !r.door || !this.sets) return r;
    r.doorFixed = true;
    this._fixedN = (this._fixedN || 0) + 1;
    const B = r.B, C = this.world.colliders;
    const ray = this._ray || (this._ray = new THREE.Raycaster());
    const pool = this._rayMesh || (this._rayMesh = {});
    const setOf = this._setOf || (this._setOf = new Map(this.sets.map((S) => [S.kind, S])));
    const near = B.recs.filter((q) => this.arch[q.kind] && setOf.has(q.kind));
    let far = 10;
    for (const q of near) far = Math.max(far, Math.hypot(q.x - r.x, q.z - r.z) + Math.hypot(q.sx, q.sz) * 1.3 + 4);
    const O = new THREE.Vector3(), D = new THREE.Vector3();
    const hitNearest = () => {
      let best = null;
      for (const q of near) {
        const m = pool[q.kind] || (pool[q.kind] = new THREE.Mesh(this.arch[q.kind].hi, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })));
        m.matrixAutoUpdate = false;
        m.matrixWorld.fromArray(setOf.get(q.kind).mats, q.idx * 16);
        const h = ray.intersectObject(m, false)[0];
        if (h && (!best || h.distance < best.d)) best = { d: h.distance, q };
      }
      return best;
    };
    // 미터로 붙는 장식(1층 차양·차양 기둥·난간): 셰이더가 옮기는 자리 그대로 따로 만들어 본다
    const ancM = new Map();
    const ancOf = (q) => { if (!ancM.has(q)) ancM.set(q, this._ancMesh(q, setOf)); return ancM.get(q); };
    const hitAnc = () => {
      let best = null;
      for (const q of near) {
        const m = ancOf(q);
        if (!m) continue;
        const h = ray.intersectObject(m, false)[0];
        if (h && (!best || h.distance < best.d)) best = { d: h.distance, q };
      }
      return best;
    };
    const done = () => { for (const m of ancM.values()) if (m) m.geometry.dispose(); };
    const onPodium = (q) => {
      if (!q.podiumKind || r.podiumKind) return false;
      const c = Math.cos(q.rot), s = Math.sin(q.rot), dx = r.x - q.x, dz = r.z - q.z;
      return Math.abs(c * dx - s * dz) < q.sx && Math.abs(s * dx + c * dz) < q.sz;
    };
    const n0 = [r.door.nx, r.door.nz];
    const cands = [n0, [-n0[0], -n0[1]], [-n0[1], n0[0]], [n0[1], -n0[0]]];
    const p = new THREE.Vector3();
    // 한 쪽 벽에 문 자리 찾기. strict: 문 너비와 양옆 여유(±3 m)가 고른 벽이어야 — 기둥·지느러미·모서리에 걸치거나 붙지 않게 옆으로 밀어 본다
    const tryPlace = (nx, nz, strict) => {
      const tx = -nz, tz = nx;
      const e0 = planExt(r, nx, nz);
      const ge = Math.max(heightAt(r.x + nx * (e0 + 2), r.z + nz * (e0 + 2)), 0);
      for (const sl of strict ? [0, -1.6, 1.6, -3.2, 3.2, -4.8, 4.8, -6.4, 6.4] : [0]) {
        const ox = r.x + tx * sl, oz = r.z + tz * sl;
        const cast = (lat, dy) => {
          O.set(ox + tx * lat + nx * far, ge + dy, oz + tz * lat + nz * far); D.set(-nx, 0, -nz);
          ray.set(O, D); ray.far = far + 2;
          return hitNearest();
        };
        let best = null;
        for (const dy of [0.5, 1.6, 2.8, 4.2]) { const h = cast(0, dy); if (h && (!best || h.d < best.d)) best = h; }
        if (!best || (best.q !== r && !onPodium(best.q))) continue;
        if (strict) {
          let flat = true;
          for (const lat of [-1.95, 1.95, -2.5, 2.5, -3.05, 3.05]) for (const dy of [1.0, 3.2]) {
            const h = cast(lat, dy);
            // 옆이 더 튀어나왔으면(기둥) 문틀과 겹치고, 훨씬 멀면(모서리 밖) 문이 허공에 걸린다
            if (!h || h.q !== best.q || h.d < best.d - 0.12 || h.d > best.d + 1.1) { flat = false; break; }
          }
          // 1층 차양의 기둥이 문 앞·옆(±2.4 m)에 서 있으면 기둥 사이로 옮긴다
          if (flat) for (let lat = -2.4; lat <= 2.41 && flat; lat += 0.6) {
            O.set(ox + tx * lat + nx * far, ge + 1.5, oz + tz * lat + nz * far); D.set(-nx, 0, -nz);
            ray.set(O, D); ray.far = best.d + 0.05;
            if (hitAnc()) flat = false;
          }
          if (!flat) continue;
        }
        const wd = far - best.d;
        const dx = ox + nx * (wd + 0.17), dz = oz + nz * (wd + 0.17);
        if (this._excluded(dx, dz, 3)) continue;
        // 이웃 문(같은 기단을 쓰는 탑·기단 자신)과 겹치지 않게
        if (B.recs.some((q) => q !== r && q.doorFixed && q.door && Math.hypot(q.door.x - dx, q.door.z - dz) < 6)) continue;
        const fy = Math.max(heightAt(dx + nx * 1.3, dz + nz * 1.3), 0) + 0.15;
        // 문 앞에 설 수 있나 (건물·구조물 충돌체에 밀리지 않나)
        p.set(dx + nx * 1.6, fy, dz + nz * 1.6);
        const px = p.x, pz = p.z;
        C.pushOut(p, 0.45, 1.8, 0.6);
        if (Math.hypot(p.x - px, p.z - pz) > 0.25) continue;
        // 문 앞 위가 건물의 처마·1층 차양에 덮였나 (그러면 문에 차양을 따로 달지 않는다)
        O.set(dx + nx * 1.0, fy + 1.0, dz + nz * 1.0); D.set(0, 1, 0);
        ray.set(O, D); ray.far = 8;
        const cover = hitNearest() || hitAnc();
        return { dx, dz, fy, covered: !!cover, under: cover ? cover.d + 1.0 : 99 };
      }
      return null;
    };
    for (const strict of [true, false]) for (const [nx, nz] of cands) {
      const got = tryPlace(nx, nz, strict);
      if (!got) continue;
      const { dx, dz, fy, covered, under } = got;
      const k0 = Math.floor(r.door.x / 80) * 100003 + Math.floor(r.door.z / 80);
      // 차양 밑이 문보다 낮으면 문을 그 높이에 맞춰 낮춘다 (문틀 꼭대기 4.25 m)
      const hs = covered && under < 4.45 ? Math.max(0.62, (under - 0.08) / 4.25) : 1;
      r.door = { x: dx, z: dz, nx, nz, yaw: Math.atan2(nx, nz), covered, hs };
      r.ext = Math.hypot(dx - r.x, dz - r.z);
      r.floorY = fy;
      done();
      const k1 = Math.floor(dx / 80) * 100003 + Math.floor(dz / 80);
      if (k1 !== k0) {
        const a = this.recGrid.get(k0);
        if (a) { const i = a.indexOf(r); if (i >= 0) a.splice(i, 1); }
        if (!this.recGrid.has(k1)) this.recGrid.set(k1, []);
        this.recGrid.get(k1).push(r);
      }
      return r;
    }
    done();
    return r; // 맞는 벽이 없으면 처음 자리 그대로
  }

  /** 건물 하나의 미터 고정 장식(anc)만 셰이더와 같은 방식으로 옮겨 놓은 메시 (광선 검사용, 쓰고 나면 버린다) */
  _ancMesh(q, setOf) {
    const C = this._ancC || (this._ancC = new Map());
    if (!C.has(q.kind)) {
      const g = this.arch[q.kind] && this.arch[q.kind].hi;
      let out = null;
      if (g && g.attributes.anc) {
        const P = g.attributes.position, A = g.attributes.anc, I = g.index;
        const n = I ? I.count : P.count, pos = [], anc = [];
        for (let t = 0; t + 2 < n; t += 3) {
          const ids = [0, 1, 2].map((k) => (I ? I.getX(t + k) : t + k));
          if (!ids.every((i) => A.getX(i) > 0.5)) continue;
          for (const i of ids) { pos.push(P.getX(i), P.getY(i), P.getZ(i)); anc.push(A.getY(i), A.getZ(i)); }
        }
        if (pos.length) out = { pos: new Float32Array(pos), anc: new Float32Array(anc) };
      }
      C.set(q.kind, out);
    }
    const a = C.get(q.kind);
    if (!a || !setOf.has(q.kind)) return null;
    const n = a.pos.length / 3, p = new Float32Array(a.pos.length);
    for (let i = 0; i < n; i++) {
      let x = a.pos[i * 3], y = a.pos[i * 3 + 1], z = a.pos[i * 3 + 2];
      y += a.anc[i * 2] / q.sy;
      const az = a.anc[i * 2 + 1];
      if (Math.abs(az) > 1e-4 && x * x + z * z > 1e-8) { const wx = x * q.sx, wz = z * q.sz, L = Math.hypot(wx, wz); x += (wx / L / q.sx) * az; z += (wz / L / q.sz) * az; }
      p[i * 3] = x; p[i * 3 + 1] = y; p[i * 3 + 2] = z;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const m = new THREE.Mesh(geo, this._ancMat || (this._ancMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })));
    m.matrixAutoUpdate = false;
    m.matrixWorld.fromArray(setOf.get(q.kind).mats, q.idx * 16);
    return m;
  }
  /** 블록의 문 앞(문에서 바깥으로 3.4 m)과 겹치나 — 소품·조작대가 문을 막지 않게 */
  _doorBlocked(B, x, z, rr) {
    for (const q of B.recs) {
      if (!q.door || !q.doorFixed) continue;
      const { x: dx, z: dz, nx, nz } = q.door;
      const t = Math.max(0, Math.min(3.4, (x - dx) * nx + (z - dz) * nz));
      if (Math.hypot(x - (dx + nx * t), z - (dz + nz * t)) < rr + 1.5) return true;
    }
    return false;
  }
  /** 반지름 R 안의 들어갈 수 있는 건물들 */
  recsNear(x, z, R) {
    const out = [];
    const n = Math.ceil(R / 80);
    const i0 = Math.floor(x / 80), j0 = Math.floor(z / 80);
    for (let i = i0 - n; i <= i0 + n; i++) for (let j = j0 - n; j <= j0 + n; j++) {
      const arr = this.recGrid.get(i * 100003 + j);
      if (arr) for (const r of arr) if (Math.hypot(r.x - x, r.z - z) < R) out.push(r);
    }
    return out;
  }

  /** 들어간 건물: 여럿이 함께 그리는 모델에서 빼고, 문이 뚫린 모델을 따로 세운다 */
  openShell(r) {
    const doorP = new THREE.Vector3(r.door.x, r.floorY, r.door.z), doorN = new THREE.Vector3(r.door.nx, 0, r.door.nz);
    if (!this.hidden.has(r.kind)) this.hidden.set(r.kind, new Set());
    this.hidden.get(r.kind).add(r.idx);
    const S = this.sets.find((s) => s.kind === r.kind);
    const mat = litMaterial({ ...this.common, doorCut: true });
    mat.uniforms.uDoorP.value.copy(doorP);
    mat.uniforms.uDoorN.value.copy(doorN);
    mat.uniforms.uDoorS.value.set(1.55, 3.95);
    const m = new THREE.Mesh(this.arch[r.kind].hi, mat);
    m.matrixAutoUpdate = false;
    m.matrix.fromArray(S.mats, r.idx * 16);
    m.frustumCulled = false;
    this.scene.add(m);
    r.shells = [m];
    r.open = true;
    this._repartition(this._last.y > -1e5 ? this._last : new THREE.Vector3(r.x, r.gy, r.z));
  }

  closeShell(r) {
    for (const m of r.shells || []) { this.scene.remove(m); m.material.dispose(); }
    r.shells = null;
    this.hidden.get(r.kind)?.delete(r.idx);
    r.open = false;
    this._repartition(this._last);
  }

  // ── 소품·주민 자리: 블록마다 가까이 올 때 깨운다 ─────────────
  _gridBlock(B) {
    const [x, z] = uvToWorld(B, B.L / 2, B.D / 2);
    B.wx = x; B.wz = z;
    B.rad = Math.hypot(B.L, B.D) / 2 + B.zone.street;
    for (let i = Math.floor((x - B.rad) / 160); i <= Math.floor((x + B.rad) / 160); i++) for (let j = Math.floor((z - B.rad) / 160); j <= Math.floor((z + B.rad) / 160); j++) {
      const k = i * 100003 + j;
      if (!this.bgrid.has(k)) this.bgrid.set(k, []);
      this.bgrid.get(k).push(B);
    }
  }
  /** 반지름 R 안의 블록 */
  blocksNear(x, z, R) {
    const out = [], seen = new Set();
    for (let i = Math.floor((x - R) / 160); i <= Math.floor((x + R) / 160); i++) for (let j = Math.floor((z - R) / 160); j <= Math.floor((z + R) / 160); j++) {
      const arr = this.bgrid.get(i * 100003 + j);
      if (arr) for (const B of arr) if (!seen.has(B) && Math.hypot(B.wx - x, B.wz - z) < R + B.rad) { seen.add(B); out.push(B); }
    }
    return out;
  }

  /** 비어 있는가 (피할 곳·도시 밖 구조물·건물과 겹치지 않음) */
  _free(x, z, r) {
    if (this._excluded(x, z, r)) return false;
    let gy = null;
    for (const c of this.world.colliders.near(x, z, r + 2)) {
      if (c.obj || c.sky || c.stream) continue;
      if (gy === null) gy = heightAt(x, z);
      if (c.y0 > gy + 8 || c.y1 < gy - 1) continue;
      let d;
      if (c.type === 'cyl') d = Math.hypot(x - c.x, z - c.z) - c.r;
      else { const dx = x - c.x, dz = z - c.z; const lx = Math.abs(dx * c.cos - dz * c.sin) - c.hx, lz = Math.abs(dx * c.sin + dz * c.cos) - c.hz; d = Math.hypot(Math.max(lx, 0), Math.max(lz, 0)); }
      if (d < r) return false;
    }
    return true;
  }

  /** 블록 깨우기: 템플릿이 적어 둔 소품·자리 + 둘레 거리의 소품을 실제 자리에 놓는다 */
  _activate(B) {
    if (B.act) return;
    B.act = 1;
    this.activeN++;
    this._propsDirty = true;
    B.props = [];
    B.spots = [];
    for (const r of B.recs) if (r.door) this.fixDoor(r);
    const raw = B.raw || [];
    for (let i = 0; i < raw.length; i += 6) {
      if (raw[i] === 0) this._propUV(B, raw[i + 1], raw[i + 2], raw[i + 3], raw[i + 4], raw[i + 5]);
      else this._spot(B, raw[i + 1], raw[i + 2], raw[i + 3], raw[i + 4], raw[i + 5]);
    }
    this._consoles(B);
    this._blockStreet(B);
  }

  /** 들어갈 수 없는 건물 발치의 바깥 조작대 (game/outdoors.js 가 쓴다) */
  _consoles(B) {
    B.ext = [];
    for (const r of B.recs) {
      if (!r.out) continue;
      const c = this.consolePos(r);
      if (!c) continue;
      // 템플릿 소품(노점·나무…)과 겹치면 옆으로 조금
      let { x, z } = c;
      const hit = (px, pz) => B.props.some((q) => Math.hypot(q.x - px, q.z - pz) < 1.4 + (q.s || 1)) || this._doorBlocked(B, px, pz, 0.6);
      if (hit(x, z)) {
        const tx = Math.cos(c.yaw), tz = -Math.sin(c.yaw);
        for (const k of [2.5, -2.5, 5, -5]) if (!hit(c.x + tx * k, c.z + tz * k)) { x = c.x + tx * k; z = c.z + tz * k; break; }
      }
      c.x = x; c.z = z;
      this._prop(B, 'console', x, z, c.yaw, { y: c.y });
      B.ext.push(c);
    }
  }
  /** 조작대 자리 (블록을 깨우지 않아도 같은 자리 — 하늘배 도착지로도 쓴다). 가까운 길 쪽 → 빈 곳 */
  consolePos(r) {
    if (r._con !== undefined) return r._con;
    const B = r.B, G = B.G;
    const a = Math.atan2(r.z - G.cz, r.x - G.cx), rr = Math.hypot(r.x - G.cx, r.z - G.cz);
    let th = a;
    while (th < B.th0 - Math.PI) th += TAU;
    while (th > B.th0 + Math.PI) th -= TAU;
    const out = [Math.cos(a), Math.sin(a)], tan = [-Math.sin(a), Math.cos(a)];
    const cand = [
      [rr - B.R0, -out[0], -out[1]], [B.R0 + B.D - rr, out[0], out[1]],
      [(th - B.th0) * rr - B.t0, -tan[0], -tan[1]], [(B.th1 - th) * rr - B.t1, tan[0], tan[1]],
    ].sort((p, q) => p[0] - q[0]);
    for (let k = 0; k < 8; k++) { const t = (k / 8) * TAU + 0.2; cand.push([1e9, Math.cos(t), Math.sin(t)]); }
    r._con = null;
    const mk = (x, z, y, nx, nz) => ({ x, z, y, yaw: Math.atan2(nx, nz), nx, nz, rec: r, def: r.out, key: `${r.kind}:${r.idx}` });
    // 물 위 집: 기둥 위 마루(높이 0.48~0.53)의 가장자리에
    if (r.kind === 'stilt') {
      const [, nx, nz] = cand[0];
      const R = Math.min(r.sx, r.sz) * 0.87;
      r._con = mk(r.x + nx * R, r.z + nz * R, r.base + r.sy * 0.53 + 0.02, nx, nz);
      return r._con;
    }
    // 가까운 길 쪽부터, 건물 가장자리 바로 앞 → (기단·이웃 건물에 막히면) 조금 더 바깥
    for (const add of [1.7, 4, 7, 11, 16, 22]) {
      for (const [, nx, nz] of cand) {
        const ext = planExt(r, nx, nz);
        const x = r.x + nx * (ext + add), z = r.z + nz * (ext + add);
        const h = heightAt(x, z);
        if (h < 0.8 || Math.abs(h - r.gy) > 3.5) continue;
        if (!this._free(x, z, 0.9)) continue;
        r._con = mk(x, z, h + 0.02, nx, nz);
        return r._con;
      }
    }
    return r._con;
  }
  /** 가장 가까운 바깥 조작대 (깨어 있는 블록에서) */
  consoleNear(x, z, R = 2.6) {
    let best = null, bd = R;
    for (const B of this.blocksNear(x, z, R + 4)) {
      if (!B.act || !B.ext) continue;
      for (const c of B.ext) { const d = Math.hypot(c.x - x, c.z - z); if (d < bd) { bd = d; best = c; } }
    }
    return best;
  }

  /** 중심 광장 칸: 고리 산책로를 따라 가로등 */
  _coreLamps(B) {
    for (let u = 9; u < B.L - 4; u += 22) {
      const [x, z, a] = uvToWorld(B, u, 0.6);
      if (!this._excluded(x, z, 0.6, true) && this._clearAll(x, z, 0.6)) this._prop(B, 'lamp', x, z, this._yaw(a, 'in'));
    }
  }
  /** 도시 밖 구조물(거대 구조물의 발·장소 건물)과도 겹치지 않는가 */
  _clearAll(x, z, r) {
    const h = heightAt(x, z);
    for (const c of this.world.colliders.near(x, z, r + 3)) {
      if (c.sky || c.stream || c.obj) continue;
      if (c.y0 > h + 6 || c.y1 < h - 1) continue;
      let d;
      if (c.type === 'cyl') d = Math.hypot(x - c.x, z - c.z) - c.r;
      else if (c.type === 'box') { const dx = x - c.x, dz = z - c.z; const lx = Math.abs(dx * c.cos - dz * c.sin) - c.hx, lz = Math.abs(dx * c.sin + dz * c.cos) - c.hz; d = Math.hypot(Math.max(lx, 0), Math.max(lz, 0)); }
      else continue;
      if (d < r) return false;
    }
    return true;
  }

  /** 소품 하나 (세계 좌표) → 블록의 소품 목록 */
  _prop(B, kind, x, z, yaw = 0, { s = 1, y, sx = 1 } = {}) {
    // 나무는 자리마다 세 종류 중 하나 (양식에 따라 비율이 다르다: 유리 도시는 결정 깃, 버섯 숲 도시는 빛갓)
    if (kind === 'tree') {
      const st = B.zone && B.zone.style, h = (Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1, q = h < 0 ? h + 1 : h;
      const w = st === 'glass' || st === 'frost' ? [0.2, 0.25] : st === 'bloom' ? [0.2, 0.75] : [0.4, 0.72];
      kind = q < w[0] ? 'tree' : q < w[1] ? 'treeB' : 'treeC';
    }
    const gy = y ?? Math.max(heightAt(x, z), 0) + 0.02;
    const ki = this.pkind.indexOf(kind);
    const m = new THREE.Matrix4().compose(_p.set(x, gy, z), _q.setFromAxisAngle(_up, yaw), _s.set(s * sx, FLAT.has(kind) ? 1 : s, s));
    B.props.push({ ki, x, y: gy, z, s, yaw, sx, m: m.elements });
    return gy;
  }

  /** 블록 좌표로 소품 하나. face: 'out'|'in'|'u+'|'u-'|숫자, o.rel 이면 숫자 face 를 블록 평면의 각으로 */
  _propUV(B, kind, u, v, face, o) {
    if (!this.parch[kind]) return null;
    const [x, z, a] = uvToWorld(B, u, v);
    const h = heightAt(x, z);
    if (h < 0.8 && !B.stilt) return null;
    if (this._excluded(x, z, 1.5, B.core)) return null;
    // 건물과 겹치면 놓지 않는다 (소품끼리는 템플릿이 피한다)
    const rr = o.col ? o.col.r * (o.s || 1) : 0.5;
    if (B.core && !this._clearAll(x, z, rr + 0.5)) return null;
    if (this._doorBlocked(B, x, z, rr)) return null;
    for (const c of this.world.colliders.near(x, z, rr + 2)) {
      if (!c.city || c.stream) continue;
      if (c.y0 > h + 6) continue;
      let d;
      if (c.type === 'cyl') d = Math.hypot(x - c.x, z - c.z) - c.r;
      else { const dx = x - c.x, dz = z - c.z; const lx = Math.abs(dx * c.cos - dz * c.sin) - c.hx, lz = Math.abs(dx * c.sin + dz * c.cos) - c.hz; d = Math.hypot(Math.max(lx, 0), Math.max(lz, 0)); }
      if (d < rr * 0.8) return null;
    }
    const yaw = typeof face === 'number' && o.rel ? this._yawUV(a, face) : this._yaw(a, face);
    return this._prop(B, kind, x, z, yaw, { s: o.s || 1, sx: o.sx || 1, y: Math.max(h, 0) + 0.02 });
  }

  /** 주민이 머무는 자리 */
  _spot(B, type, u, v, face, o = {}) {
    const [x, z, a] = uvToWorld(B, u, v);
    const h = heightAt(x, z);
    if (h < 0.8) return null;
    if (this._excluded(x, z, 1, B.core)) return null;
    if (B.core && !this._clearAll(x, z, 1.2 + (o.r || 0))) return null;
    const yaw = typeof face === 'number' && o.rel ? this._yawUV(a, face) : this._yaw(a, face);
    const sp = { type, x, z, y: Math.max(h, 0), yaw, B, r: o.r || 0, dawn: !!o.dawn, id: `${B.zi}:${B.idx}:${B.spots.length}` };
    if (o.to) { const [tx, tz] = uvToWorld(B, o.to[0], o.to[1]); sp.to = { x: tx, z: tz }; }
    if (o.loop) sp.loop = o.loop.map(([lu, lv]) => { const [lx, lz] = uvToWorld(B, lu, lv); return { x: lx, z: lz }; });
    B.spots.push(sp);
    return sp;
  }
  _spotXY(B, type, x, z, yaw) {
    const h = heightAt(x, z);
    if (h < 0.8) return null;
    const sp = { type, x, z, y: h, yaw, B, r: 0, id: `${B.zi}:${B.idx}:${B.spots.length}` };
    B.spots.push(sp);
    return sp;
  }
  /** 반지름 R 안의 주민 자리 (블록을 깨운다) */
  spotsNear(x, z, R, type) {
    const out = [];
    for (const B of this.blocksNear(x, z, R)) {
      this._activate(B);
      for (const s of B.spots) if ((!type || s.type === type) && Math.hypot(s.x - x, s.z - z) < R) out.push(s);
    }
    return out;
  }

  /** 블록 둘레의 거리 소품: 안쪽·바깥쪽 거리의 보도(가로수·가로등·의자·정거장·키오스크…), 골목 화단, 대로 가운데 화단, 교차로 */
  _blockStreet(B) {
    if (B.core) return this._coreLamps(B);
    const zone = B.zone, G = zone.G;
    const rnd = mulberry32(B.idx * 7919 + B.zi * 104729 + 13);
    const city = zone.id.startsWith('cap') || zone.id.startsWith('dist');
    const sub = zone.mix === 'suburb';
    const pd = (city ? 1 : zone.id.startsWith('town') ? 0.6 : 0.4) * (this.density < 0.6 ? 0.6 : 1);
    const fernish = zone.style === 'glass' || zone.style === 'bloom';
    const rw = G.street * 0.55, sw = Math.min(4.6, G.street * 0.225 - 0.4);
    const band0 = B.R0 - (B.k < G.nb && hasStreet(G, B.k) ? G.street : G.lane);
    const lamp = (x, z, yaw, s = 1) => { if (this._free(x, z, 0.5)) this._prop(B, 'lamp', x, z, yaw, { s }); };
    const step = city ? 18 : sub ? 64 : 26;
    // 거리 쪽 두 가장자리: [이 블록 쪽 보도 반지름(연석 쪽), (건물 쪽), 차도 쪽을 향하는 부호]
    const edges = [];
    if (hasStreet(G, B.k)) { const c = band0 + G.street / 2; edges.push([c + rw / 2 + 1.25, c + rw / 2 + 0.25 + sw - 0.9, -1]); }
    if (hasStreet(G, B.k + 1)) { const c = band0 + G.ring + G.street / 2; edges.push([c - rw / 2 - 1.25, c - rw / 2 - 0.25 - sw + 0.9, 1]); }
    let idx = B.idx * 3;
    for (const [Rc, Rb, sd] of edges) {
      const L = (B.th1 - B.th0) * Rc - B.t0 - B.t1;
      for (let u = step * 0.5; u < L; u += step) {
        idx++;
        const [xc, zc, a] = uvToWorld(B, u, Rc - B.R0), [xb, zb] = uvToWorld(B, u, Rb - B.R0);
        if (heightAt(xc, zc) < 0.8) continue;
        const nx = Math.cos(a) * sd, nz = Math.sin(a) * sd; // 차도 쪽
        const face = Math.atan2(nx, nz);
        if (idx % 3 === 1) { if (rnd() < 0.4 + pd * 0.6) lamp(xc, zc, face); }
        else if (sub) { if (rnd() < 0.5 && this._free(xc, zc, 0.9)) this._prop(B, 'tree', xc, zc, rnd() * TAU, { s: 0.8 + rnd() * 0.4 }); continue; }
        else if (rnd() < pd && this._free(xc, zc, 0.9)) this._prop(B, fernish && rnd() < 0.5 ? 'fern' : 'tree', xc, zc, rnd() * TAU, { s: 0.8 + rnd() * 0.4 });
        if (rnd() > pd || B.type === USE.FARM || !B.type) continue;
        if (idx % 23 === 11 && this._free(xb, zb, 2.4)) { this._prop(B, 'shelter', xb, zb, face + Math.PI); this._spotXY(B, 'wait', xb - nx * 0.8, zb - nz * 0.8, face); }
        else if (idx % 13 === 6 && (B.type === USE.COM || B.type === USE.PLZ || B.type === USE.RES) && this._free(xb, zb, 2.6)) { this._prop(B, 'kiosk', xb, zb, face); this._spotXY(B, 'sell', xb - nx * 2.6, zb - nz * 2.6, face); }
        else if (idx % 11 === 5 && this._free(xb, zb, 0.8)) this._prop(B, 'pillar', xb, zb, 0);
        else if (idx % 5 === 0 && this._free(xb, zb, 1.2)) { this._prop(B, 'bench', xb, zb, face + Math.PI); this._spotXY(B, 'sit', xb, zb, face); }
        else if (idx % 7 === 3 && this._free(xb, zb, 1.0)) this._prop(B, 'planter', xb, zb, 0);
        else if (idx % 9 === 2 && this._free(xb, zb, 0.3)) this._prop(B, 'bollard', xb, zb, 0);
      }
    }
    // 골목 (다음 블록과의 사이): 지형 셰이더의 골목 모양(laneStyle)과 같은 규칙으로 — 보통 골목은 가운데 나무 줄,
    // 작업로·보조 도로는 가장자리 등만, 녹지 산책길은 양쪽 이끼 띠의 나무, 상가 거리는 가운데 울림 등대
    if (B.j < B.m - 1 && !(sub && B.type !== USE.VILLA && B.type !== USE.COM && B.type !== USE.CIV)) {
      const N = zone.P.blocks[B.idx - 64 + 1];
      const jb = B.j + 1;
      const mid = B.m > 2.5 && Math.abs(jb - Math.floor(B.m * 0.5)) < 0.5 && (B.s + B.k) % 3 > 0.5 && B.k > 1.5;
      const st = laneStyleJS(B.type, N ? N.type : B.type, mid);
      const lc = B.L + B.t1, hw = G.lane / 2;
      for (let v = 6; v < B.D - 4; v += city ? 9 : 14) {
        const step = Math.round(v / 9);
        let off = 0, kind = null;
        if (st === 0) { kind = step % 3 === 0 ? 'lamp' : rnd() < 0.85 * pd + 0.15 ? 'tree' : null; }
        else if (st === 1 || st === 4) { if (step % 2 === 0) { kind = 'lamp'; off = (step % 4 === 0 ? 1 : -1) * (hw - 0.7); } }
        else if (st === 2) { kind = step % 3 === 0 ? 'lamp' : 'tree'; off = (step % 2 ? 1 : -1) * Math.min(hw - 1, 3.4); }
        else if (st === 3) { kind = step % 2 === 0 ? 'beacon' : step % 4 === 1 ? 'bench' : null; off = kind === 'bench' ? (hw - 1.2) * (step % 8 === 1 ? 1 : -1) : 0; }
        if (!kind) continue;
        const [x, z, a] = uvToWorld(B, lc + off, v);
        if (heightAt(x, z) < 0.8 || !this._free(x, z, kind === 'bench' ? 1.2 : 0.8)) continue;
        if (kind === 'lamp') lamp(x, z, rnd() * TAU, 0.75);
        else if (kind === 'bench') { const f = this._yaw(a, off > 0 ? 'u-' : 'u+'); this._prop(B, 'bench', x, z, f); this._spotXY(B, 'sit', x, z, f); }
        else this._prop(B, kind, x, z, kind === 'tree' ? rnd() * TAU : 0, kind === 'tree' ? { s: 0.7 + rnd() * 0.3 } : {});
      }
    }
    // 작은 대로(홀수 번째) 가운데 꽃 띠: 울림 등대 줄 (큰 대로 가운데는 전차 빛 궤도)
    if (city && B.j === 0 && B.s % 2 === 1) {
      for (let v = 10; v < B.D - 6; v += 30) {
        const [x, z] = uvToWorld(B, -B.t0, v);
        if (heightAt(x, z) > 0.8 && this._free(x, z, 0.6)) this._prop(B, 'beacon', x, z, 0);
      }
    }
    // 대로 (부채꼴의 첫 블록이 맡는다): 가운데 화단의 나무 + 양쪽 보도 가로등, 교차로의 분수·조형물
    if (B.j === 0) {
      const av = B.th0, ca = Math.cos(av), sa = Math.sin(av), tx = -sa, tz = ca, cx = G.cx, cz = G.cz;
      for (let r = B.R0 + 4; r < B.R0 + B.D - 2; r += 12) {
        const x = cx + ca * r, z = cz + sa * r;
        if (heightAt(x, z) < 0.8) continue;
        if (rnd() < pd) this._prop(B, 'tree', x, z, rnd() * TAU, { s: 0.7 + rnd() * 0.3 });
        if (Math.round(r / 12) % 3 === 0) for (const sd of [1, -1]) { const o = G.street * 0.35 + 1.2; lamp(x + tx * o * sd, z + tz * o * sd, Math.atan2(-tx * sd, -tz * sd)); }
      }
      if (hasStreet(G, B.k) && B.k % 2 === 0) {
        const R = band0 + G.street / 2, x = cx + ca * R, z = cz + sa * R;
        if (heightAt(x, z) > 0.8 && this._free(x, z, 5.5)) {
          if ((B.k / 2 + B.s) % 2) this._prop(B, 'fountain', x, z, rnd() * TAU, { s: G.street < 20 ? 0.6 : 0.85 });
          else this._prop(B, 'sculpt', x, z, rnd() * TAU, { s: G.street < 20 ? 0.7 : 1 });
        }
      }
    }
  }

  /** 밤의 가로등 불빛 점: 소품과 상관없이 모든 거리에 미리 (멀리서도 도시가 반짝이게) */
  _lampPoints(zone) {
    const G = zone.G, city = zone.id.startsWith('cap') || zone.id.startsWith('dist'), sub = zone.mix === 'suburb';
    const step = city ? 54 : sub ? 192 : 78;
    const rw = G.street * 0.55;
    for (const R of zone.streets) for (const sd of [1, -1]) {
      const Rr = R + sd * (rw / 2 + 1.25 - 1.3), n = Math.ceil((TAU * Rr) / step);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + sd * 0.07;
        const rel = (((a - G.aOff) % TAU) + TAU) % TAU, SA = TAU / G.avenues, fs = rel % SA;
        if (Math.min(fs, SA - fs) * Rr < G.avH + 3) continue;
        const x = G.cx + Math.cos(a) * Rr, z = G.cz + Math.sin(a) * Rr, h = heightAt(x, z);
        if (h < 0.8) continue;
        this.lamps.add(x, h + 6.0, z, 0xffe2b8, 3.2, 0, 0);
      }
    }
  }

  /** 소품 인스턴스: 종류마다 하나, 가까운 블록의 소품을 채워 넣는다 */
  _propMeshes() {
    this.propMat = litMaterial({ vertexColors: true, vertexEmit: true, emissive: 0xffffff, emissiveIntensity: 1.4, emissiveNight: 0.85, rim: 0.2, rimColor: 0xd8e8ff, spec: 0.35, side: THREE.DoubleSide });
    const CAP = { tree: 3000, treeB: 2500, treeC: 2500, lamp: 3000, bench: 2500, crates: 2500, collector: 2000, transformer: 1500, console: 600 };
    this.psets = this.pkind.map((kind) => {
      const cap = Math.round((CAP[kind] || 1200) * (this.density < 0.6 ? 0.6 : 1));
      const mesh = new THREE.InstancedMesh(this.parch[kind], this.propMat, cap);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.count = 0;
      mesh.frustumCulled = false;
      this.scene.add(mesh);
      return { kind, mesh, cap };
    });
  }
  _fillProps(cam) {
    const R = this.propR, R2 = R * R;
    const counts = new Array(this.psets.length).fill(0);
    for (const B of this.blocksNear(cam.x, cam.z, R)) {
      if (!B.act) continue;
      for (const p of B.props) {
        const dx = p.x - cam.x, dy = p.y - cam.y, dz = p.z - cam.z;
        if (dx * dx + dy * dy * 0.25 + dz * dz >= R2) continue;
        const S = this.psets[p.ki];
        const k = counts[p.ki];
        if (k >= S.cap) continue;
        S.mesh.instanceMatrix.array.set(p.m, k * 16);
        counts[p.ki] = k + 1;
      }
    }
    this.psets.forEach((S, i) => {
      S.mesh.count = counts[i];
      if (counts[i]) { S.mesh.instanceMatrix.clearUpdateRanges(); S.mesh.instanceMatrix.addUpdateRange(0, counts[i] * 16); S.mesh.instanceMatrix.needsUpdate = true; }
    });
    this._propsDirty = false;
  }

  /** 소품 충돌: 플레이어 둘레 블록만 충돌 세계에 넣는다 */
  _propCols(px, pz) {
    const want = new Set(this.blocksNear(px, pz, 150));
    const C = this.world.colliders;
    for (const B of this.colOn) if (!want.has(B) && Math.hypot(B.wx - px, B.wz - pz) > 230 + B.rad) { for (const c of B.pcols) C.remove(c); B.pcols = null; this.colOn.delete(B); }
    for (const B of want) {
      if (this.colOn.has(B)) continue;
      this._activate(B);
      B.pcols = [];
      for (const p of B.props) {
        const kind = this.pkind[p.ki], spec = PROPCOL[kind];
        if (!spec) continue;
        const c = Math.cos(p.yaw), sn = Math.sin(p.yaw), s = p.s;
        for (const q of spec) {
          const lx = q[1] * s * p.sx, lz = q[2] * s;
          const wx = p.x + lx * c + lz * sn, wz = p.z - lx * sn + lz * c;
          const col = q[0] === 'c' ? { type: 'cyl', x: wx, z: wz, r: q[3] * s, y0: p.y + q[4] * s - 0.3, y1: p.y + q[5] * s, dome: q[6] ? q[6] * s : undefined, city: true, stream: true }
            : { type: 'box', x: wx, z: wz, hx: q[3] * s * p.sx, hz: q[4] * s, rot: p.yaw, y0: p.y + q[5] * s - 0.3, y1: p.y + q[6] * s, city: true, stream: true };
          B.pcols.push(C.add(col));
        }
      }
      this.colOn.add(B);
    }
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
      if (this._excluded(mx, mz, 4) || this._under(mx, mz, half) < y + 8) continue;
      this.list.bridge.push(mx, y, mz, half, 5.5, 3.2, rot, 1, 1, 1);
      this.world.colliders.add({ type: 'box', x: mx, z: mz, hx: half, hz: 3.2, rot, y0: y, y1: y + 5.5, city: true, walk: true });
      used.add(i); used.add(best);
      if (rnd() < 0.4) this.lamps.add(mx, y - 0.5, mz, 0x9ff6ff, 4, 0, 0);
    }
  }

  // ── 인스턴스 메시 ─────────────────────────
  _meshes() {
    const common = { vertexColors: true, vertexEmit: true, facade: true, emissive: 0xffffff, emissiveIntensity: 1.5, emissiveNight: 0.8, rim: 0.18, rimColor: 0xd0d8f0, spec: 0.25, side: THREE.DoubleSide, winGlow: 0.7,
      tech: this.density < 0.6 ? undefined : { scale: 2.8, glow: 0.55, metal: 0.26, mode: 0 } };
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
    // 처마·아케이드 밑의 문 (차양 없이)
    this.doorsC = new THREE.InstancedMesh(doorGeo({ canopy: false }), this.matHi, this.doorCap);
    this.doorsC.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.doorsC.count = 0;
    this.doorsC.frustumCulled = false;
    this.scene.add(this.doorsC);
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
    if (this.psets) this._fillProps(cam);
    if (this.doors) this._fillDoors(cam);
  }

  /** 문 인스턴스: 자리를 잡은 문(doorFixed)만 그린다 — 어림 자리의 문이 벽 앞에 떠 있지 않게 */
  _fillDoors(cam) {
    const DR2 = Math.min(this.nearR, 700) ** 2;
    const m4 = this._dm || (this._dm = new THREE.Matrix4()), q = this._dq || (this._dq = new THREE.Quaternion()), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
    const sc = this._dsc || (this._dsc = new THREE.Vector3());
    let k = 0, kc = 0;
    for (const r of this.recs) {
      if (k >= this.doorCap || kc >= this.doorCap) break;
      const dx = r.door.x - cam.x, dy = r.floorY - cam.y, dz = r.door.z - cam.z;
      if (!r.doorFixed || dx * dx + dy * dy + dz * dz >= DR2 || r.open) continue;
      q.setFromAxisAngle(up, r.door.yaw);
      m4.compose(p.set(r.door.x, r.floorY, r.door.z), q, r.door.hs && r.door.hs !== 1 ? sc.set(1, r.door.hs, 1) : one);
      if (r.door.covered) this.doorsC.setMatrixAt(kc++, m4); else this.doors.setMatrixAt(k++, m4);
    }
    this.doors.count = k;
    this.doors.instanceMatrix.needsUpdate = true;
    this.doorsC.count = kc;
    this.doorsC.instanceMatrix.needsUpdate = true;
  }

  /** 아웬이 걷는 길: 구역 안이면 가장 가까운 고리 거리의 보도 위로 */
  snapStreet(x, z) {
    for (const Z of this.zones) {
      const dx = x - Z.cx, dz = z - Z.cz, r = Math.hypot(dx, dz);
      if (r < Z.r0 - Z.street || r > Z.rOut + Z.street) continue;
      let best = Z.streets[0];
      for (const R of Z.streets) if (Math.abs(R - r) < Math.abs(best - r)) best = R;
      const side = r >= best ? 1 : -1;
      const Rw = best + side * (Z.street * 0.275 + 2.4);
      const a = Math.atan2(dz, dx);
      return { x: Z.cx + Math.cos(a) * Rw, z: Z.cz + Math.sin(a) * Rw, zone: Z, R: Rw };
    }
    return null;
  }

  /** (x, z) 의 발 높이 y 에 단단한 것(건물·소품)이 있나 — 주민이 길을 고를 때 */
  solidAt(x, z, y) {
    for (const c of this.world.colliders.near(x, z, 0.5)) {
      if (c.obj || c.sky || !c.solid) continue;
      if (c.y0 > y + 1.8 || c.y1 < y + 0.4) continue;
      if (c.type === 'cyl') { if (Math.hypot(x - c.x, z - c.z) < c.r + 0.3) return true; }
      else { const dx = x - c.x, dz = z - c.z; if (Math.abs(dx * c.cos - dz * c.sin) < c.hx + 0.3 && Math.abs(dx * c.sin + dz * c.cos) < c.hz + 0.3) return true; }
    }
    return false;
  }

  /** 계획 위치 (블록·거리 …) */
  where(x, z) { return locate(this.plan, x, z); }

  /** 식물이 자라면 안 되는 곳: 계획된 구역 안 (자연 그대로 둔 블록은 빼고) */
  noFlora(x, z) {
    const L = locate(this.plan, x, z);
    if (!L) return this._inCore(x, z);
    if (L.kind === 'block') return L.B.type !== 0 && !L.B.natural;
    if (L.kind === 'lane' && L.B) return L.B.type !== 0 && !L.B.natural;
    return true;
  }
  /** 중심 광장(core: 'plaza') 안인가 — 지형 셰이더가 판석으로 덮는 곳 */
  _inCore(x, z) {
    for (const P of this.plan.zones) {
      if (P.Z.core !== 'plaza') continue;
      const G = P.G, r = Math.hypot(x - G.cx, z - G.cz);
      if (r < G.r0 - G.street) return true;
    }
    return false;
  }
  /** 거대 식물이 자라지 않는 도시 둘레 */
  urban(x, z) {
    for (const Z of this.zones) {
      const dx = x - Z.cx, dz = z - Z.cz, r2 = dx * dx + dz * dz, lo = Math.max(0, Z.r0 - 200), hi = Z.rOut + 150;
      if (r2 > lo * lo && r2 < hi * hi) return true;
    }
    return false;
  }
  blocks(x, z) { return this.noFlora(x, z); }

  update(dt, ctx) {
    const cam = ctx && ctx.game ? ctx.game.engine.camera.position : null;
    if (!cam) return;
    const L = this._last;
    const moved = (cam.x - L.x) ** 2 + (cam.z - L.z) ** 2 + (cam.y - L.y) ** 2;
    if (moved > 45 * 45) this._repartition(cam);
    // 가까운 블록부터 깨운다 (한 프레임에 몇 ms 만). 순간이동처럼 크게 움직이면 바로 둘레 250 m 를 깨운다
    const t0 = performance.now();
    let budget = 4;
    const lc = this._actAt || (this._actAt = new THREE.Vector3(1e9, 0, 1e9));
    if (Math.hypot(cam.x - lc.x, cam.z - lc.z) > 300) { budget = 120; this._actT = -1; }
    lc.copy(cam);
    if (!this._actList || (this._actT = (this._actT || 0) - dt) < 0) {
      this._actT = 0.4;
      this._actList = this.blocksNear(cam.x, cam.z, this.propR + 60).filter((B) => !B.act).sort((a, b) => Math.hypot(a.wx - cam.x, a.wz - cam.z) - Math.hypot(b.wx - cam.x, b.wz - cam.z));
    }
    let woke = 0;
    while (this._actList.length && performance.now() - t0 < budget) { const B = this._actList.shift(); if (!B.act) { this._activate(B); woke++; } }
    if (woke) this._propsDirty = true;
    if (this._propsDirty && (this._fillT = (this._fillT || 0) - dt) < 0) { this._fillT = 0.25; this._fillProps(this._last.y > -1e5 ? this._last : cam); }
    const pp = ctx.player ? ctx.player.pos : cam;
    if ((this._colT = (this._colT || 0) - dt) < 0) { this._colT = 0.3; this._propCols(pp.x, pp.z); }
    // 문 자리 미리 잡기 (가까운 것부터, 한 프레임 1 ms 안팎)
    {
      const t1 = performance.now();
      if ((this._doorNearT = (this._doorNearT || 0) - dt) < 0) { this._doorNearT = 1; this._doorNear = this.recsNear(cam.x, cam.z, 420).filter((r) => !r.doorFixed); }
      const n0 = this._fixedN || 0;
      while (this._doorNear && this._doorNear.length && performance.now() - t1 < 1.2) this.fixDoor(this._doorNear.pop());
      this._doorI = this._doorI || 0;
      while (this._doorI < this.recs.length && performance.now() - t1 < 1.2) this.fixDoor(this.recs[this._doorI++]);
      // 새로 자리 잡은 문이 있으면 곧 다시 그린다 (카메라가 45 m 움직이기를 기다리지 않고)
      if ((this._fixedN || 0) !== n0) this._doorsDirty = true;
      if (this._doorsDirty && (this._doorFillT = (this._doorFillT || 0) - dt) < 0) { this._doorFillT = 0.3; this._doorsDirty = false; this._fillDoors(cam); }
    }
    this.lamps.update();
    this.beacons.update();
  }
}
