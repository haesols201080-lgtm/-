// 하모네아의 거대 구조물: 아웬 문명이 얼마나 앞서 있는지 한눈에 보이는 스카이라인.
//  · 구역(district) — 척추를 둘러싼 네 구역. 가운데에 1.5~2.3 km 의 큰 탑, 그 허리를 감싸는 하늘바퀴,
//    둘레에 위성 탑들. 탑은 세 가지: 울림탑(유리 첨탑) · 소리굽쇠탑(두 기둥과 아치) · 뜬층탑(떠 있는 원반 층).
//  · 하늘고리 「관」 — 척추를 감싸는 지름 3 km 의 공중 고리 구역.
//  · 빛다리 — 탑과 고리를 잇는 걸을 수 있는 다리.
//  · 별항구 — 궤도로 오르는 왕복선의 가속 고리탑.
// 구역은 원거리에서 단순 모델로 바뀝니다(THREE.LOD). 자리·크기는 아래 표만 고치면 됩니다.
import * as THREE from 'three';
import { heightAt } from './heightfield.js';
import { mulberry32 } from '../core/noise.js';
import { part, merge, xf, lathe } from './geo-utils.js';
import * as A from './arch.js';
import { litMaterial, glowMaterial } from './materials.js';
import { hologramMaterial } from './hologram.js';
import { PointLights } from './lights.js';
import { PLACE } from '../data/places.js';

const D = Math.PI / 180;
const PAL = A.PAL;
const lerpHex = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), Math.max(0, Math.min(1, t))).getHex();
const GLOWS = [PAL.teal, PAL.amber, PAL.rose, PAL.violet];
const GLASS = 0xb9c9d6; // 유리 외벽 바탕색
const FRAME = 0xf3eee6; // 진주빛 뼈대

// 고원 위 안쪽 탑 (하늘고리 「관」과 다리로 이어짐)
export const TOWERS = [
  { id: 't-in-1', a: 45, R: 1300, kind: 'spire', h: 760, r: 44, glow: PAL.teal },
  { id: 't-in-2', a: 165, R: 1300, kind: 'fork', h: 700, r: 46, glow: PAL.amber },
  { id: 't-in-3', a: 285, R: 1300, kind: 'spire', h: 820, r: 46, glow: PAL.violet },
];

// 구역: 중심, 큰 탑 종류·높이·반지름, 하늘바퀴 높이, 위성 탑 수
export const DISTRICTS = [
  { id: 'd-east', name: '새벽 구역', x: 3500, z: -1700, kind: 'spire', h: 2200, r: 125, wheelY: 0.42, sats: 8, glow: PAL.teal, seed: 1 },
  { id: 'd-sw', name: '물결 구역', x: -2800, z: 4200, kind: 'fork', h: 1650, r: 120, wheelY: 0.36, sats: 7, glow: PAL.amber, seed: 2 },
  { id: 'd-west', name: '포자 구역', x: -4300, z: -700, kind: 'stack', h: 1300, r: 150, wheelY: 0.3, sats: 7, glow: PAL.rose, seed: 3 },
  { id: 'd-north', name: '별바라기 구역', x: 1600, z: -4300, kind: 'spire', h: 1900, r: 110, wheelY: 0.5, sats: 6, glow: PAL.violet, seed: 4 },
];

export const CROWN_HALO = { id: 'halo-crown', name: '하늘고리 「관」', x: 0, z: 0, y: 950, R: 1500, w: 64, glow: PAL.teal, seed: 3 };

export class Megacity {
  constructor(world, structures, quality = {}) {
    this.world = world;
    this.structures = structures;
    this.scene = world.scene;
    this.group = new THREE.Group();
    this.group.name = 'megacity';
    this.scene.add(this.group);
    this.mat = litMaterial({ vertexColors: true, vertexEmit: true, windows: true, emissive: 0xffffff, emissiveIntensity: 1.5, emissiveNight: 0.8, rim: 0.5, rimColor: 0xe0e8ff, spec: 1.1, side: THREE.DoubleSide, tech: { scale: 5, glow: 0.45, metal: 0.4, mode: 0 } });
    this.lights = new PointLights(this.scene, 900, { minPx: 2.0, day: 0.3 });
    this.anims = [];
    this.docks = []; // 배가 내려앉는 착륙대 {x, y, z, ang}
    this.towers = [];
    this.halos = [];
    this.homes = []; // 발치 마을·하늘바퀴·하늘고리 위의 집 {x, z, y, r, h, halo} — 바깥 조작대(주민 부탁함)가 쓴다
    this.districts = [];
    this.markers = [];
    this.t = 0;
    this.satScale = quality.flora !== undefined && quality.flora < 0.5 ? 0.6 : 1;

    // 가운데: 안쪽 탑 셋 + 하늘고리 「관」
    {
      const hi = [], lo = [];
      const H = CROWN_HALO;
      const towers = TOWERS.map((T) => {
        const x = Math.cos(T.a * D) * T.R, z = Math.sin(T.a * D) * T.R;
        return this._tower({ ...T, x, z, linkY: [H.y] }, hi, lo);
      });
      const halo = this._halo(H, hi, lo);
      for (const T of towers) this._bridge(T, halo, hi, lo);
      this._addLOD(hi, lo, 0, 0, 5200);
    }
    // 구역들
    for (const Dd of DISTRICTS) this._district(Dd);
    // 별항구
    {
      const hi = [], lo = [];
      this._starport(hi, lo);
      if (this.starport) this._addLOD(hi, lo, this.starport.x, this.starport.z, 4500);
    }
  }

  _col(c) { return this.world.colliders.add(c); }

  /** 가까이용·멀리용 부품을 합쳐 LOD 로 */
  _addLOD(hi, lo, cx, cz, dist) {
    const lod = new THREE.LOD();
    const mk = (parts) => {
      const list = parts.map((p) => xf(p, { x: -cx, z: -cz }));
      const m = new THREE.Mesh(merge(list), this.mat);
      return m;
    };
    lod.addLevel(mk(hi), 0);
    lod.addLevel(mk(lo), dist);
    lod.position.set(cx, 0, cz);
    this.group.add(lod);
    return lod;
  }

  // ── 구역 ─────────────────────────────────
  _district(Dd) {
    const rnd = mulberry32(Dd.seed * 7919);
    const hi = [], lo = [];
    const { x: cx, z: cz } = Dd;
    const wheelAbs = heightAt(cx, cz) + Dd.h * Dd.wheelY;
    const wheel = { id: Dd.id + '-wheel', name: Dd.name + ' 하늘바퀴', x: cx, z: cz, y: wheelAbs, R: Dd.r * 1.1 + 170, w: 46, glow: Dd.glow, seed: Dd.seed * 13 };
    const grand = this._tower({ id: Dd.id + '-grand', x: cx, z: cz, kind: Dd.kind, h: Dd.h, r: Dd.r, glow: Dd.glow, grand: true, linkY: [wheelAbs] }, hi, lo);
    const halo = this._halo(wheel, hi, lo, { spokes: grand });
    // 위성 탑
    const placed = [[cx, cz, wheel.R + 40]];
    const n = Math.max(3, Math.round(Dd.sats * this.satScale));
    const kinds = ['spire', 'spire', 'fork', 'stack'];
    let tries = 0;
    const sats = [];
    while (sats.length < n && tries++ < 200) {
      const a = rnd() * Math.PI * 2;
      const R = wheel.R + 120 + rnd() * 520;
      const x = cx + Math.cos(a) * R, z = cz + Math.sin(a) * R;
      const r = 30 + rnd() * 42;
      if (placed.some(([px, pz, pr]) => Math.hypot(px - x, pz - z) < pr + r * 2.6 + 40)) continue;
      const h = 380 + rnd() * 720 * (1 - (R - wheel.R) / 900);
      const kind = kinds[Math.floor(rnd() * kinds.length)];
      const near = Math.abs(R - wheel.R) < 360;
      const T = this._tower({ id: `${Dd.id}-s${sats.length}`, x, z, kind, h, r, glow: GLOWS[Math.floor(rnd() * 4)], linkY: near && h > wheelAbs - heightAt(x, z) + 60 ? [wheelAbs] : [] }, hi, lo);
      placed.push([x, z, r * 2.6]);
      sats.push(T);
      if (T.linkY.length) this._bridge(T, halo, hi, lo);
    }
    // 낮은 건물들 (발치 동네)
    for (let i = 0; i < 26; i++) {
      const a = rnd() * Math.PI * 2, R = 120 + rnd() * 800;
      const x = cx + Math.cos(a) * R, z = cz + Math.sin(a) * R;
      const r = 6 + rnd() * 10;
      if (placed.some(([px, pz, pr]) => Math.hypot(px - x, pz - z) < pr + r + 10)) continue;
      placed.push([x, z, r]);
      const y = heightAt(x, z) - 0.5;
      if (rnd() < 0.6) {
        // 집: 옛 돔 집 대신 도시의 새 집(문·실내) — cityfabric._extraHouses 가 짓는다. 그때까지 자리 지킴 충돌체
        const hr = Math.min(r, 9);
        const col = this._col({ type: 'cyl', x, z, r: hr * 1.05, y0: y - 1, y1: y + hr * 1.2 });
        (this.world.houseQueue || (this.world.houseQueue = [])).push({ x, z, r: hr, fa: Math.atan2(cz - z, cx - x), group: 'foot-' + Dd.id, col });
        continue;
      }
      A.place(hi, A.spireTower({ h: 40 + rnd() * 80, r: r * 0.45, seed: i + Dd.seed * 200, glow: GLOWS[(i + 1) % 4] }), { x, y, z });
      this._col({ type: 'cyl', x, z, r: r * 0.95, y0: y - 1, y1: y + r * 1.1, dome: r * 0.6 });
      this.homes.push({ x, z, y: y + 0.5, r: r * 0.95, h: r * 1.2 });
    }
    this._addLOD(hi, lo, cx, cz, 4200);
    this.districts.push({ ...Dd, grand, halo, sats });
    this.markers.push({ id: Dd.id, x: cx, y: grand.top, z: cz });
  }

  // ── 탑 ─────────────────────────────────
  _tower(T, hi, lo) {
    const { x, z, h, r } = T;
    const g0 = heightAt(x, z);
    const rnd = mulberry32(Math.floor(Math.abs(x) * 3 + Math.abs(z) * 7 + h));
    // 큰 탑·안쪽 탑만 움직이는 관과 홀로그램을 따로 그린다 (나머지는 합친 모델에 굳혀 그리기 횟수를 줄임)
    const rec = { ...T, g0, top: g0 + h, tiers: [], linkY: T.linkY || [], showcase: !!T.grand || T.id.startsWith('t-in') };
    if (T.kind === 'fork') this._fork(rec, hi, lo, rnd);
    else if (T.kind === 'stack') this._stack(rec, hi, lo, rnd);
    else this._spire(rec, hi, lo, rnd);
    // 발치 광장
    const pr = (T.kind === 'stack' ? r * 0.9 : r) * 1.9;
    hi.push(xf(part(new THREE.CylinderGeometry(pr, pr * 1.04, 2, 36), 0xcfc8d8, 0), { x, y: g0 - 0.6, z }));
    hi.push(xf(part(new THREE.RingGeometry(pr * 0.86, pr * 0.9, 36), T.glow, 1.2), { x, y: g0 + 0.45, z, rx: -Math.PI / 2 }));
    this._col({ type: 'cyl', x, z, r: pr, y0: g0 - 5, y1: g0 + 0.4 });
    // 홀로그램 띠 (글자가 흘러간다)
    if (T.kind !== 'stack' && rec.showcase) {
      const hy = g0 + h * (T.grand ? 0.66 : 0.6);
      const hr = (rec.radAt ? rec.radAt(hy - g0) : r) * 1.35 + (T.kind === 'fork' ? r : 0);
      const holo = new THREE.Mesh(new THREE.CylinderGeometry(hr, hr, T.grand ? 60 : 30, 48, 1, true), hologramMaterial({ color: T.glow, color2: 0xffffff, intensity: 1.1, scroll: 0.008 * (rnd() < 0.5 ? 1 : -1), repeat: [T.grand ? 6 : 3, 1], seed: Math.floor(h) }));
      holo.position.set(x, hy, z);
      this.group.add(holo);
    }
    // 표지등
    this.lights.add(x, rec.top + (T.kind === 'fork' ? r * 1.1 : 6), z, 0xff5a4a, T.grand ? 30 : 16, 0.55, rnd());
    for (const tr of rec.tiers) for (let k = 0; k < 4; k++) {
      const b = (k / 4) * Math.PI * 2 + 0.4;
      this.lights.add(x + Math.cos(b) * tr.TR, tr.y + 1.5, z + Math.sin(b) * tr.TR, k % 2 ? 0xffd08a : 0xbffcff, 6, 0, 0);
    }
    this.towers.push(rec);
    this.structures.resonators.push({ x, y: g0 + h * 0.5, z });
    return rec;
  }

  /** 하늘정원 층 (가운데 반지름 ra, 바깥 TR) */
  _tier(rec, ty, ra, TR, hi, rnd, dock = true) {
    const { x, z, g0 } = rec;
    const parts = [];
    parts.push(part(lathe([[ra * 0.95, -12], [TR * 0.9, -9], [TR, -3], [TR * 1.01, 0], [TR * 0.99, 0.3]], 40).translate(0, ty, 0), (px, py) => (py > ty - 1.5 ? PAL.gold : 0xeeeaf4), (px, py) => (py > ty - 3.5 && py < ty - 2 ? 1.3 : 0)));
    parts.push(part(xf(new THREE.RingGeometry(ra * 0.98, TR * 0.99, 40, 1), { y: ty + 0.32, rx: -Math.PI / 2 }), 0x3f8f76, 0));
    parts.push(part(xf(new THREE.RingGeometry(TR * 0.62, TR * 0.64, 40, 1), { y: ty + 0.36, rx: -Math.PI / 2 }), rec.glow, 1.0));
    parts.push(part(xf(new THREE.TorusGeometry(TR * 0.985, 0.2, 3, 56), { y: ty + 1.2, rx: Math.PI / 2 }), 0xbffcff, 1.4));
    const nt = Math.floor(TR / 8);
    for (let i = 0; i < nt; i++) {
      const b = (i / nt) * Math.PI * 2 + rnd() * 0.2;
      const d = ra + (TR - ra) * (0.5 + rnd() * 0.3);
      const th = 4 + rnd() * 6;
      parts.push(part(xf(new THREE.CylinderGeometry(0.3, 0.45, th, 4), { x: Math.cos(b) * d, y: ty + th / 2, z: Math.sin(b) * d }), 0x6a5a7a, 0));
      parts.push(part(xf(new THREE.IcosahedronGeometry(1.8 + rnd() * 1.6, 0), { x: Math.cos(b) * d, y: ty + th + 1, z: Math.sin(b) * d }), rnd() < 0.5 ? 0x5fb59a : 0x7fa8d8, rnd() < 0.3 ? 0.5 : 0));
    }
    rec.tiers.push({ ty, y: g0 + ty, TR, ra });
    this._col({ type: 'cyl', x, z, r: TR, y0: g0 + ty - 12, y1: g0 + ty + 0.3 });
    if (dock && rnd() < 0.6) {
      const b = rnd() * Math.PI * 2;
      const dx = Math.cos(b) * (TR + 13), dz = Math.sin(b) * (TR + 13);
      parts.push(part(xf(new THREE.CylinderGeometry(14, 12, 2.2, 20), { x: dx, y: ty - 0.8, z: dz }), 0xe8e4ee, 0));
      parts.push(part(xf(new THREE.RingGeometry(9.5, 11, 20), { x: dx, y: ty + 0.36, z: dz, rx: -Math.PI / 2 }), PAL.amber, 1.6));
      parts.push(part(xf(new THREE.BoxGeometry(16, 1.2, 5), { x: Math.cos(b) * (TR + 2), y: ty - 0.3, z: Math.sin(b) * (TR + 2), ry: -b }), 0xe8e4ee, 0));
      this._col({ type: 'cyl', x: x + dx, z: z + dz, r: 14, y0: g0 + ty - 3, y1: g0 + ty + 0.3 });
      this.docks.push({ x: x + dx, y: g0 + ty + 0.4, z: z + dz, ang: b });
    }
    for (const p of parts) hi.push(xf(p, { x, y: g0, z }));
  }

  /** 울림탑: 진주빛 뼈대에 싸인 유리 첨탑 */
  _spire(rec, hi, lo, rnd) {
    const { x, z, g0, h, r } = rec;
    const radAt = (y) => {
      const t = y / h;
      const flare = 1 + 1.1 * Math.exp(-t * 20);
      const waist = 1 - 0.12 * Math.sin(Math.PI * Math.min(1, t / 0.86));
      const taper = t < 0.8 ? 1 : Math.max(0.05, 1 - ((t - 0.8) / 0.2) * 0.95);
      return r * flare * waist * taper;
    };
    rec.radAt = radAt;
    const mk = (rows, segs, detail) => {
      const parts = [];
      const prof = [[r * 2.3, -30]];
      for (let i = 0; i <= rows; i++) { const y = (i / rows) * h * 0.8; prof.push([radAt(y), y]); }
      parts.push(part(lathe(prof, segs), (px, py) => lerpHex(GLASS, 0xd8d4ea, py / h), 0, r / 3.4));
      const cp = [];
      for (let i = 0; i <= 8; i++) { const y = h * (0.8 + (i / 8) * 0.2); cp.push([radAt(y), y]); }
      cp.push([0.0001, h * 1.04]);
      parts.push(part(lathe(cp, segs), (px, py) => (py > h * 0.96 ? PAL.gold : FRAME), (px, py) => (py > h * 0.99 ? 1.3 : 0)));
      // 진주빛 외골격 날개
      const nf = rec.grand ? 6 : 4;
      for (let k = 0; k < nf; k++) {
        const a = (k / nf) * Math.PI * 2 + 0.3;
        const fpts = [];
        for (let i = 0; i <= (detail ? 14 : 6); i++) { const y = (i / (detail ? 14 : 6)) * h * 0.92; fpts.push(new THREE.Vector3(Math.cos(a) * (radAt(y) + r * 0.06), y, Math.sin(a) * (radAt(y) + r * 0.06))); }
        const curve = new THREE.CatmullRomCurve3(fpts);
        parts.push(part(new THREE.TubeGeometry(curve, detail ? 40 : 12, r * 0.09, 4, false), (px, py) => lerpHex(FRAME, PAL.gold, py / h), 0));
        if (detail) parts.push(part(new THREE.TubeGeometry(curve, 40, r * 0.035, 3, false).translate(Math.cos(a) * r * 0.06, 0, Math.sin(a) * r * 0.06), rec.glow, 1.5));
      }
      // 금빛 띠
      const bandStep = rec.grand ? 160 : 110;
      for (let y = bandStep; y < h * 0.8; y += bandStep) parts.push(part(xf(new THREE.TorusGeometry(radAt(y) * 1.012, rec.grand ? 3 : 1.8, 4, segs), { y, rx: Math.PI / 2 }), PAL.gold, 0.9));
      return parts;
    };
    for (const p of mk(rec.grand ? 52 : 30, rec.grand ? 48 : 32, true)) hi.push(xf(p, { x, y: g0, z }));
    for (const p of mk(10, 14, false)) lo.push(xf(p, { x, y: g0, z }));
    // 하늘정원 층
    const ys = new Set((rec.grand ? [0.2, 0.62, 0.74] : [0.3, 0.55]).map((t) => Math.round(t * h)));
    for (const ay of rec.linkY) ys.add(Math.round(ay - g0));
    for (const ty of [...ys].sort((a, b) => a - b)) {
      if (ty < 50 || ty > h * 0.8 || rec.tiers.some((o) => Math.abs(o.ty - ty) < 50)) continue;
      const ra = radAt(ty);
      const TR = ra * (rec.grand ? 1.55 : 1.9) + 14;
      this._tier(rec, ty, ra, TR, hi, rnd);
      lo.push(xf(part(new THREE.CylinderGeometry(TR, ra, 12, 14), PAL.gold, 0.5), { x, y: g0 + ty - 6, z }));
    }
    // 관
    this._crown(rec, Math.floor(rnd() * 3), hi, lo);
    this._col({ type: 'cyl', x, z, r: radAt(h * 0.03) * 1.02, y0: g0 - 5, y1: g0 + h * 0.8, walk: false });
    this._col({ type: 'cyl', x, z, r: radAt(h * 0.85), y0: g0 + h * 0.8, y1: g0 + h * 0.9 });
  }

  /** 소리굽쇠탑: 두 기둥이 위에서 아치로 이어지고, 그 사이에 빛 구슬이 뜬다 */
  _fork(rec, hi, lo, rnd) {
    const { x, z, g0, h, r } = rec;
    const yaw = rnd() * Math.PI;
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    const rs = r * 0.55, gap = r * 0.95;
    const sh = h * 0.82;
    const radAt = (y) => rs * (1 + 0.9 * Math.exp(-(y / h) * 18)) * (1 - 0.1 * Math.sin(Math.PI * Math.min(1, y / sh)));
    rec.radAt = () => rs;
    const mk = (rows, segs, detail) => {
      const parts = [];
      for (const s of [-1, 1]) {
        const prof = [[rs * 2.0, -30]];
        for (let i = 0; i <= rows; i++) { const y = (i / rows) * sh; prof.push([radAt(y), y]); }
        prof.push([radAt(sh) * 0.7, sh + rs * 0.3], [0.0001, sh + rs * 0.45]);
        parts.push(part(xf(lathe(prof, segs), { x: s * gap }), (px, py) => (py > sh ? FRAME : lerpHex(GLASS, 0xd8d4ea, py / h)), 0, rs / 3.4));
        // 가장자리 빛줄
        parts.push(part(xf(new THREE.BoxGeometry(rs * 0.12, sh, rs * 0.12), { x: s * (gap + radAt(sh * 0.5) * 1.02), y: sh / 2 }), rec.glow, detail ? 1.3 : 0.9));
      }
      // 아치
      const arch = new THREE.TorusGeometry(gap, rs * 0.62, detail ? 10 : 6, detail ? 28 : 12, Math.PI);
      parts.push(part(xf(arch, { y: sh }), (px, py) => lerpHex(FRAME, PAL.gold, (py - sh) / gap), 0, detail ? rs / 3.4 : 0));
      parts.push(part(xf(new THREE.TorusGeometry(gap, rs * 0.12, 4, detail ? 28 : 12, Math.PI), { y: sh, z: rs * 0.62 }), rec.glow, 1.4));
      parts.push(part(xf(new THREE.TorusGeometry(gap, rs * 0.12, 4, detail ? 28 : 12, Math.PI), { y: sh, z: -rs * 0.62 }), rec.glow, 1.4));
      // 두 기둥을 잇는 다리층 (창문)
      const nb = rec.grand ? 5 : 3;
      for (let i = 1; i <= nb; i++) {
        const y = (i / (nb + 1)) * sh * 0.9;
        parts.push(part(xf(new THREE.BoxGeometry(gap * 2, rs * 0.5, rs * 0.9), { y }), (px, py, pz) => (Math.abs(py - y) < rs * 0.2 ? GLASS : FRAME), 0, -3.4));
      }
      return parts;
    };
    const place = (arr, parts) => { for (const p of parts) arr.push(xf(p, { x, y: g0, z, ry: yaw })); };
    place(hi, mk(rec.grand ? 36 : 22, rec.grand ? 32 : 24, true));
    place(lo, mk(8, 12, false));
    // 빛 구슬
    const orbY = g0 + sh + gap * 0.15;
    if (!rec.showcase) {
      const q = xf(part(new THREE.IcosahedronGeometry(gap * 0.3, 1), rec.glow, 1.8), { x, y: orbY, z });
      hi.push(q); lo.push(q);
    } else {
    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(gap * 0.42, 2), glowMaterial({ color: rec.glow, intensity: 1.2 }));
    orb.position.set(x, orbY, z);
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(gap * 0.26, 2), litMaterial({ color: 0xffffff, emissive: rec.glow, emissiveIntensity: 1.6, emissiveNight: 0.4, rim: 1.5, rimColor: 0xffffff }));
    core.position.copy(orb.position);
    this.group.add(orb, core);
    this.anims.push((t) => {
      const k = 1 + Math.sin(t * 1.3 + x) * 0.06;
      orb.scale.setScalar(k);
      orb.material.uniforms.uIntensity.value = 0.8 + Math.sin(t * 2.6 + z) * 0.25;
    });
    }
    rec.top = g0 + sh + gap;
    // 다리층 = 하늘정원 대신 / 이어지는 층이 필요하면 원형 층을 하나 둘레에
    for (const ay of rec.linkY) {
      const ty = Math.round(ay - g0);
      if (ty < 50 || ty > sh) continue;
      const TR = gap + rs * 2.2;
      this._tier(rec, ty, gap * 0.5, TR, hi, rnd, false);
      lo.push(xf(part(new THREE.CylinderGeometry(TR, TR * 0.8, 12, 14), PAL.gold, 0.5), { x, y: g0 + ty - 6, z }));
    }
    for (const s of [-1, 1]) {
      const px = x + cs * s * gap, pz = z - sn * s * gap;
      this._col({ type: 'cyl', x: px, z: pz, r: radAt(sh * 0.03) * 1.02, y0: g0 - 5, y1: g0 + sh, walk: false });
    }
  }

  /** 뜬층탑: 빛기둥을 따라 떠 있는 원반 층들 */
  _stack(rec, hi, lo, rnd) {
    const { x, z, g0, h, r } = rec;
    const n = Math.max(4, Math.round(h / (rec.grand ? 110 : 90)));
    const levels = [];
    let y = h * 0.12;
    for (let i = 0; i < n && y < h; i++) {
      const t = i / (n - 1);
      const Rd = r * (1.25 - 0.75 * t) * (0.85 + rnd() * 0.3);
      const th = 10 + Rd * 0.14;
      levels.push({ y, Rd, th });
      y += th + 24 + rnd() * 40;
    }
    rec.radAt = () => r * 0.3;
    const mk = (segs, detail) => {
      const parts = [];
      // 빛기둥
      parts.push(part(new THREE.CylinderGeometry(r * 0.1, r * 0.16, h * 1.08, detail ? 12 : 6, 1, true).translate(0, h * 0.54, 0), 0xbffcff, 1.5));
      parts.push(part(lathe([[r * 0.9, -20], [r * 0.6, 0], [r * 0.35, h * 0.08], [r * 0.16, h * 0.12]], segs), FRAME, 0));
      for (const L of levels) {
        const { Rd, th } = L;
        parts.push(part(lathe([[r * 0.18, -th * 0.6], [Rd * 0.7, -th * 0.55], [Rd, -th * 0.1], [Rd * 0.98, th * 0.42], [Rd * 0.9, th * 0.5], [r * 0.18, th * 0.5]], segs).translate(0, L.y, 0), (px, py) => (py < L.y - th * 0.3 ? 0xd2cce0 : GLASS), (px, py) => (py < L.y - th * 0.52 ? 0.0 : 0), Rd / 3.4));
        parts.push(part(xf(new THREE.TorusGeometry(Rd * 0.72, Math.max(0.6, th * 0.06), 4, segs), { y: L.y - th * 0.58, rx: Math.PI / 2 }), rec.glow, 1.6));
        parts.push(part(xf(new THREE.RingGeometry(r * 0.2, Rd * 0.88, segs, 1), { y: L.y + th * 0.5 + 0.05, rx: -Math.PI / 2 }), 0x3f8f76, 0));
        if (detail) {
          const nb = Math.floor(Rd / 14);
          for (let k = 0; k < nb; k++) {
            const b = rnd() * Math.PI * 2, d = r * 0.3 + rnd() * (Rd * 0.75 - r * 0.3);
            const hr = 3 + rnd() * 4;
            A.place(parts, rnd() < 0.7 ? A.domeHouse({ r: hr, h: hr * 1.2, seed: k + Math.floor(L.y), glow: GLOWS[k % 4] }) : A.gardenBed({ r: hr, seed: k }), { x: Math.cos(b) * d, y: L.y + th * 0.5, z: Math.sin(b) * d });
          }
        }
      }
      return parts;
    };
    for (const p of mk(rec.grand ? 44 : 30, true)) hi.push(xf(p, { x, y: g0, z }));
    for (const p of mk(12, false)) lo.push(xf(p, { x, y: g0, z }));
    for (const L of levels) {
      this._col({ type: 'cyl', x, z, r: L.Rd * 0.9, y0: g0 + L.y - L.th * 0.6, y1: g0 + L.y + L.th * 0.5 });
      rec.tiers.push({ ty: L.y + L.th * 0.5, y: g0 + L.y + L.th * 0.5, TR: L.Rd * 0.9, ra: r * 0.2 });
      for (let k = 0; k < 6; k++) { const b = (k / 6) * Math.PI * 2; this.lights.add(x + Math.cos(b) * L.Rd, g0 + L.y, z + Math.sin(b) * L.Rd, rec.glow, 5, 0, 0); }
    }
    rec.top = g0 + h * 1.08;
    // 이어지는 층이 필요하면 가장 가까운 원반 높이를 그 높이로 쓴다 (다리는 _bridge 가 처리)
  }

  _crown(rec, kind, hi, lo) {
    const { x, z, g0, h, r } = rec;
    if (!rec.showcase) {
      // 굳힌 관: 움직이지 않는 부품으로
      const parts = [];
      if (kind === 0) parts.push(part(xf(new THREE.TorusGeometry(r * 1.4, r * 0.035 + 0.6, 4, 40), { y: h * 0.9, rx: Math.PI / 2 + 0.1 }), rec.glow, 1.6));
      else if (kind === 1) parts.push(part(xf(new THREE.TorusGeometry(r * 1.3, r * 0.08, 5, 32), { y: h * 0.96 + r * 1.1 }), PAL.gold, 0.2), part(xf(new THREE.TorusGeometry(r * 1.16, r * 0.025, 3, 32), { y: h * 0.96 + r * 1.1 }), rec.glow, 1.8));
      else {
        parts.push(part(xf(new THREE.IcosahedronGeometry(r * 0.6, 2), { y: h * 1.04 + r * 1.2 }), 0xf6eeff, 0.7));
        for (let i = 0; i < 2; i++) parts.push(part(xf(new THREE.TorusGeometry(r * (0.85 + i * 0.25), r * 0.012 + 0.4, 3, 32), { y: h * 1.04 + r * 1.2, rx: 0.6 + i, rz: i }), rec.glow, 1.4));
        rec.top = g0 + h * 1.04 + r * 1.8;
      }
      for (const p of parts) { const q = xf(p, { x, y: g0, z }); hi.push(q); lo.push(q); }
      return;
    }
    const crown = new THREE.Group();
    crown.position.set(x, g0, z);
    this.group.add(crown);
    if (kind === 0) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 1.4, r * 0.035 + 0.6, 6, 64), glowMaterial({ color: rec.glow, intensity: 1.6 }));
      ring.position.y = h * 0.9;
      crown.add(ring);
      this.anims.push((t) => { ring.rotation.set(Math.PI / 2 + Math.sin(t * 0.3 + x) * 0.12, 0, t * 0.2); });
    } else if (kind === 1) {
      const g = merge([part(new THREE.TorusGeometry(r * 1.3, r * 0.08, 6, 48), PAL.gold, 0.2), part(new THREE.TorusGeometry(r * 1.16, r * 0.025, 4, 48), rec.glow, 1.8)]);
      const ring = new THREE.Mesh(g, this.mat);
      ring.position.y = h * 0.96 + r * 1.1;
      crown.add(ring);
      this.anims.push((t) => { ring.rotation.y = t * 0.1 + x; });
    } else {
      const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(r * 0.6, 3), litMaterial({ color: 0xf6eeff, emissive: rec.glow, emissiveIntensity: 0.7, emissiveNight: 0.7, rim: 1.4, rimColor: 0xffffff, spec: 1.5 }));
      orb.position.y = h * 1.04 + r * 1.2;
      crown.add(orb);
      const rings = [0, 1, 2].map((i) => {
        const m = new THREE.Mesh(new THREE.TorusGeometry(r * (0.85 + i * 0.2), r * 0.012 + 0.4, 4, 48), glowMaterial({ color: rec.glow, intensity: 1.3 }));
        m.position.y = orb.position.y;
        crown.add(m);
        return m;
      });
      this.anims.push((t) => {
        orb.position.y = h * 1.04 + r * 1.2 + Math.sin(t * 0.6 + x) * 3;
        rings.forEach((m, i) => { m.position.y = orb.position.y; m.rotation.set(t * (0.2 + i * 0.1), t * (0.13 - i * 0.05), i); });
      });
      rec.top = g0 + h * 1.04 + r * 1.8;
    }
  }

  // ── 하늘고리 ─────────────────────────────
  _halo(H, hi, lo, { spokes = null } = {}) {
    const { x: cx, z: cz, y, R, w } = H;
    const rnd = mulberry32(H.seed * 101);
    const segs = Math.min(256, Math.max(64, Math.round(R / 7)));
    const Ri = R - w / 2, Ro = R + w / 2;
    const mk = (segs, detail) => {
      const parts = [];
      parts.push(part(xf(new THREE.RingGeometry(Ri, Ro, segs, 1), { rx: -Math.PI / 2 }), 0xe6e0ee, 0));
      for (const rr of [R - w * 0.28, R + w * 0.28]) parts.push(part(xf(new THREE.RingGeometry(rr - 0.6, rr + 0.6, segs, 1), { y: 0.06, rx: -Math.PI / 2 }), H.glow, 1.2));
      parts.push(part(new THREE.CylinderGeometry(Ri, Ri, 8, segs, 1, true).translate(0, -3, 0), 0xf0ecf4, 0, detail ? -3.4 : 0));
      parts.push(part(new THREE.CylinderGeometry(Ro, Ro, 8, segs, 1, true).translate(0, -3, 0), 0xf0ecf4, 0, detail ? -3.4 : 0));
      if (detail) for (const rr of [Ri, Ro]) parts.push(part(xf(new THREE.TorusGeometry(rr, 0.7, 4, segs), { y: 1.1, rx: Math.PI / 2 }), PAL.gold, 0.8));
      parts.push(part(lathe([[Ri, -7], [R - w * 0.15, -7 - w * 0.4], [R, -7 - w * 0.48], [R + w * 0.15, -7 - w * 0.4], [Ro, -7]], segs), (px, py) => (py < -7 - w * 0.44 ? H.glow : 0xd8d2e6), (px, py) => (py < -7 - w * 0.44 ? 1.6 : 0)));
      return parts;
    };
    const P = (arr, parts) => { for (const p of parts) arr.push(xf(p, { x: cx, y, z: cz })); };
    P(hi, mk(segs, true));
    P(lo, mk(Math.max(32, segs >> 2), false));
    const parts = [];
    const ne = Math.round(segs / 8);
    for (let i = 0; i < ne; i++) {
      const a = (i / ne) * Math.PI * 2;
      parts.push(part(xf(new THREE.ConeGeometry(w * 0.08, w * 0.7, 6), { x: Math.cos(a) * R, y: -7 - w * 0.48 - w * 0.3, z: Math.sin(a) * R, rx: Math.PI }), H.glow, 1.5));
    }
    // 위의 집·첨탑·정원
    const slots = Math.round((2 * Math.PI * R) / 46);
    for (let i = 0; i < slots; i++) {
      const a = (i / slots) * Math.PI * 2 + rnd() * 0.04;
      const off = (rnd() - 0.5) * w * 0.35;
      const px = Math.cos(a) * (R + off), pz = Math.sin(a) * (R + off);
      if (spokes && i % Math.max(1, Math.round(slots / 4)) === 0) continue;
      const k = rnd();
      if (k < 0.32) {
        const sh = 30 + rnd() * 70, sr = 3 + rnd() * 2.5;
        A.place(parts, A.spireTower({ h: sh, r: sr, seed: H.seed * 50 + i, glow: GLOWS[i % 4] }), { x: px, y: 0, z: pz });
        this._col({ type: 'cyl', x: cx + px, z: cz + pz, r: sr * 1.2, y0: y - 1, y1: y + sh * 0.42 });
        this.homes.push({ x: cx + px, z: cz + pz, y, r: sr * 1.2, h: sh, halo: H.id, a, R });
      } else if (k < 0.72) {
        const hr = 5 + rnd() * 5;
        rnd(); // (옛 돔 집의 난수 자리)
        // 하늘고리 갑판 위의 새 집 (들어갈 수 있다) — cityfabric._extraHouses 가 짓는다
        const col = this._col({ type: 'cyl', x: cx + px, z: cz + pz, r: hr * 1.05, y0: y + 0.1, y1: y + hr * 1.2 });
        (this.world.houseQueue || (this.world.houseQueue = [])).push({ x: cx + px, z: cz + pz, r: hr, fa: Math.atan2(-pz, -px), group: 'halo-' + H.id, col, deck: y });
      } else if (k < 0.9) {
        A.place(parts, A.gardenBed({ r: 5 + rnd() * 3, seed: i }), { x: px, y: 0, z: pz });
      }
    }
    P(hi, parts);
    // 바큇살 다리 (가운데 탑과 이어짐)
    if (spokes) {
      const T = spokes;
      const tier = T.tiers.reduce((b, o) => (!b || Math.abs(o.y - y) < Math.abs(b.y - y) ? o : b), null);
      if (tier) for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + 0.2;
        this._span(cx + Math.cos(a) * (tier.TR - 2), cz + Math.sin(a) * (tier.TR - 2), tier.y, cx + Math.cos(a) * (Ri + 2), cz + Math.sin(a) * (Ri + 2), y, hi, lo);
      }
    }
    // 바깥 고리 (천천히 돈다)
    const fil = new THREE.Group();
    fil.position.set(cx, y - 3, cz);
    const fg = [part(new THREE.TorusGeometry(Ro + 16, 1.0, 4, segs), 0xf2ecf8, 0)];
    const nodes = Math.round(segs / 6);
    for (let i = 0; i < nodes; i++) {
      const a = (i / nodes) * Math.PI * 2;
      fg.push(part(xf(new THREE.OctahedronGeometry(3.2, 0), { x: Math.cos(a) * (Ro + 16), y: Math.sin(a) * (Ro + 16), sz: 2.2 }), H.glow, 1.7));
    }
    const filM = new THREE.Mesh(merge(fg), this.mat);
    filM.rotation.x = Math.PI / 2;
    fil.add(filM);
    this.group.add(fil);
    const spd = (rnd() < 0.5 ? 1 : -1) * (6 / R);
    this.anims.push((t) => { filM.rotation.z = t * spd; });
    // 갑판 충돌: 고리를 따라 늘어선 원기둥들
    const nc = Math.ceil((2 * Math.PI * R) / (w * 0.42));
    for (let i = 0; i < nc; i++) {
      const a = (i / nc) * Math.PI * 2;
      this._col({ type: 'cyl', x: cx + Math.cos(a) * R, z: cz + Math.sin(a) * R, r: w / 2, y0: y - 8, y1: y });
    }
    const nl = Math.min(48, Math.round(segs / 4));
    for (let i = 0; i < nl; i++) {
      const a = (i / nl) * Math.PI * 2;
      this.lights.add(cx + Math.cos(a) * (Ro + 16), y - 3, cz + Math.sin(a) * (Ro + 16), H.glow, 7, 0, 0);
      if (i % 3 === 0) this.lights.add(cx + Math.cos(a) * R, y - 7 - w * 0.5, cz + Math.sin(a) * R, 0xbffcff, 9, 0, 0);
    }
    for (let i = 0; i < Math.max(2, Math.round(R / 300)); i++) {
      const a = rnd() * Math.PI * 2;
      const bx = cx + Math.cos(a) * (R + w * 0.42), bz = cz + Math.sin(a) * (R + w * 0.42);
      const g = new THREE.PlaneGeometry(46, 11);
      g.rotateZ(Math.PI / 2);
      const m = new THREE.Mesh(g, hologramMaterial({ color: H.glow, color2: 0xffffff, intensity: 1.2, scroll: -0.02, repeat: [1.2, 1], seed: H.seed + i }));
      m.position.set(bx, y + 26, bz);
      m.rotation.y = -a;
      this.group.add(m);
    }
    const rec = { ...H, Ri, Ro };
    this.halos.push(rec);
    return rec;
  }

  // ── 빛다리 ─────────────────────────────
  _bridge(T, H, hi, lo) {
    if (!T || !H || !T.tiers.length) return;
    const tier = T.tiers.reduce((b, o) => (Math.abs(o.y - H.y) < Math.abs(b.y - H.y) ? o : b), T.tiers[0]);
    const dx = H.x - T.x, dz = H.z - T.z;
    const d = Math.hypot(dx, dz);
    const ux = dx / d, uz = dz / d;
    const inside = d < H.R;
    const s0 = tier.TR - 2;
    const s1 = inside ? d - H.Ri + 2 : d - H.Ro + 2;
    if (s1 - s0 < 4) return;
    this._span(T.x + ux * s0, T.z + uz * s0, tier.y, T.x + ux * s1, T.z + uz * s1, H.y, hi, lo);
  }

  /** (x0,z0,y0) → (x1,z1,y1) 걸을 수 있는 다리 */
  _span(x0, z0, y0, x1, z1, y1, hi, lo) {
    const dx = x1 - x0, dz = z1 - z0;
    const L = Math.hypot(dx, dz);
    if (L < 4) return;
    const ux = dx / L, uz = dz / L;
    const rot = Math.atan2(-uz, ux);
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, my = (y0 + y1) / 2;
    const slope = (y0 - y1) / L;
    const mk = (detail) => {
      const parts = [part(new THREE.BoxGeometry(L, 1.6, 7, Math.max(1, Math.round(L / 40))), 0xeae6f0, 0)];
      if (detail) for (const s of [-1, 1]) {
        parts.push(part(xf(new THREE.BoxGeometry(L, 0.25, 0.25), { y: 1.3, z: s * 3.3 }), 0xbffcff, 1.6));
        parts.push(part(xf(new THREE.BoxGeometry(L, 0.3, 0.6), { y: 0.82, z: s * 3.2 }), PAL.teal, 0.9));
      }
      parts.push(part(xf(new THREE.BoxGeometry(L, 0.4, 2), { y: -0.95 }), PAL.teal, 1.5));
      return parts.map((p) => {
        const pa = p.attributes.position;
        for (let i = 0; i < pa.count; i++) pa.setY(i, pa.getY(i) - pa.getX(i) * slope);
        p.computeVertexNormals();
        return xf(p, { x: mx, y: my - 0.8, z: mz, ry: rot });
      });
    };
    hi.push(...mk(true));
    lo.push(...mk(false));
    if (Math.abs(y0 - y1) < 0.5) this._col({ type: 'box', x: mx, z: mz, hx: L / 2, hz: 3.5, rot, y0: my - 2.4, y1: my });
    else this._col({ type: 'ramp', x: mx, z: mz, hx: L / 2, hz: 3.5, rot, y0: Math.min(y0, y1) - 2.4, y1: y0, y1b: y1 });
    const n = Math.max(1, Math.round(L / 50));
    for (let i = 0; i <= n; i++) {
      const s = i / n;
      for (const side of [-1, 1]) this.lights.add(x0 + dx * s - uz * side * 3.3, y0 + (y1 - y0) * s + 0.6, z0 + dz * s + ux * side * 3.3, 0xbffcff, 3, 0, 0);
    }
  }

  // ── 별항구: 왕복선 가속 고리탑 ───────────────
  _starport(hi, lo) {
    const P = PLACE.starport;
    if (!P) return;
    const [cx, cz] = P.pos;
    const g0 = heightAt(cx, cz);
    const parts = [];
    parts.push(part(new THREE.CylinderGeometry(150, 156, 4, 72).translate(0, -1.6, 0), 0xdcd6e4, 0));
    for (const rr of [44, 92, 140]) parts.push(part(xf(new THREE.RingGeometry(rr - 1.2, rr + 1.2, 72), { y: 0.45, rx: -Math.PI / 2 }), rr === 44 ? PAL.amber : PAL.teal, 1.4));
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      parts.push(part(xf(new THREE.BoxGeometry(46, 0.2, 1.2), { x: Math.cos(a) * 116, y: 0.46, z: Math.sin(a) * 116, ry: -a }), PAL.teal, 0.9));
    }
    // 가속 고리탑: 위로 갈수록 좁아지는 고리들의 원뿔 + 안쪽으로 기운 세 기둥
    const RH = 820;
    const rAt = (y) => 62 - (y / RH) * 40;
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + 0.5;
      const b0 = new THREE.Vector3(Math.cos(a) * (rAt(0) + 10), 0, Math.sin(a) * (rAt(0) + 10));
      const b1 = new THREE.Vector3(Math.cos(a) * (rAt(RH) + 4), RH, Math.sin(a) * (rAt(RH) + 4));
      const pts = [b0, b0.clone().lerp(b1, 0.33), b0.clone().lerp(b1, 0.66), b1];
      parts.push(part(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 6, 8, false), (px, py) => lerpHex(0xf2eef6, PAL.gold, py / RH), 0));
      parts.push(part(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => p.clone().multiply(new THREE.Vector3(0.93, 1, 0.93)))), 16, 1.4, 4, false), PAL.teal, 1.5));
      parts.push(part(xf(new THREE.ConeGeometry(4, 40, 8), { x: b1.x, y: RH + 20, z: b1.z }), PAL.gold, 1.2));
      this._col({ type: 'cyl', x: cx + b0.x, z: cz + b0.z, r: 9, y0: g0 - 2, y1: g0 + 120, walk: false });
    }
    // 가운데 유리 관 (왕복선이 지나는 길)
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(rAt(RH) * 0.62, rAt(0) * 0.62, RH, 32, 1, true), glowMaterial({ color: 0x8fe8ff, intensity: 0.32, fresnel: 1, side: THREE.DoubleSide }));
    tube.position.set(cx, g0 + RH / 2, cz);
    this.group.add(tube);
    this.launchTube = tube;
    // 받침 고리 (발사대)
    parts.push(part(xf(new THREE.TorusGeometry(rAt(0) + 10, 5, 8, 64), { y: 3, rx: Math.PI / 2 }), PAL.gold, 0.3));
    const ringYs = [];
    for (let y = 50; y <= RH; y += 46) ringYs.push(y);
    const rg = merge([part(new THREE.TorusGeometry(1, 0.075, 6, 56), 0xf0ecf6, 0), part(new THREE.TorusGeometry(0.9, 0.02, 4, 56), 0xffffff, 1.0)]);
    rg.rotateX(Math.PI / 2);
    const ringMat = litMaterial({ vertexColors: true, vertexEmit: true, emissive: 0xffffff, emissiveIntensity: 1.4, emissiveNight: 0.6, rim: 0.6 });
    this.launchRings = new THREE.InstancedMesh(rg, ringMat, ringYs.length);
    const glowRing = new THREE.InstancedMesh(new THREE.TorusGeometry(0.92, 0.05, 4, 56).rotateX(Math.PI / 2), glowMaterial({ color: 0x9ff6ff, intensity: 1.0 }), ringYs.length);
    const m4 = new THREE.Matrix4();
    ringYs.forEach((y, i) => {
      const r = rAt(y);
      m4.makeScale(r, r, r).setPosition(cx, g0 + y, cz);
      this.launchRings.setMatrixAt(i, m4);
      glowRing.setMatrixAt(i, m4);
      glowRing.setColorAt(i, new THREE.Color(0.25, 0.25, 0.25));
    });
    this.launchRings.frustumCulled = false;
    glowRing.frustumCulled = false;
    this.group.add(this.launchRings, glowRing);
    this.launchGlow = glowRing;
    this.launchRingYs = ringYs.map((y) => g0 + y);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const hx = Math.cos(a) * 210, hz = Math.sin(a) * 210;
      const hy = heightAt(cx + hx, cz + hz) - g0;
      parts.push(part(xf(lathe([[42, -4], [42, 0], [41, 12], [33, 26], [18, 34], [0.0001, 36]], 24), { x: hx, y: hy - 0.5, z: hz }), (px, py) => (py > hy + 33 ? PAL.gold : 0xeee8f2), 0, 12));
      parts.push(part(xf(new THREE.CircleGeometry(12, 16, 0, Math.PI), { x: hx - Math.cos(a) * 41.5, y: hy, z: hz - Math.sin(a) * 41.5, ry: Math.PI / 2 - a, sy: 1.4 }), PAL.amber, 1.4));
      this._col({ type: 'cyl', x: cx + hx, z: cz + hz, r: 41, y0: g0 + hy - 2, y1: g0 + hy + 34, dome: 22 });
    }
    A.place(parts, A.spireTower({ h: 120, r: 7, seed: 909, glow: PAL.amber, pods: 2 }), { x: -120, y: 0, z: 150 });
    this._col({ type: 'cyl', x: cx - 120, z: cz + 150, r: 8, y0: g0 - 2, y1: g0 + 50 });
    this._col({ type: 'cyl', x: cx, z: cz, r: 150, y0: g0 - 5, y1: g0 + 0.45 });
    for (const p of parts) { const q = xf(p, { x: cx, y: g0, z: cz }); hi.push(q); lo.push(q); }
    for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2 + 0.5; this.lights.add(cx + Math.cos(a) * (rAt(RH) + 4), g0 + RH + 42, cz + Math.sin(a) * (rAt(RH) + 4), 0xff5a4a, 16, 0.5, k * 0.33); }
    for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; this.lights.add(cx + Math.cos(a) * 150, g0 + 1, cz + Math.sin(a) * 150, i % 2 ? PAL.amber : 0xbffcff, 4, 1.2, i / 24); }
    this.starport = { x: cx, y: g0, z: cz, top: g0 + RH };
    this.launchPulse = -1;
    this.markers.push({ id: 'starport', x: cx, y: g0, z: cz });
  }

  /** 발사: 고리가 아래에서 위로 차례로 빛난다 */
  pulseLaunch() { this.launchPulse = 0; }

  update(dt) {
    this.t += dt;
    for (const f of this.anims) f(this.t, dt);
    if (this.launchGlow) {
      const c = this._c || (this._c = new THREE.Color());
      const n = this.launchRingYs.length;
      if (this.launchPulse >= 0) this.launchPulse += dt;
      for (let i = 0; i < n; i++) {
        let k = 0.45 + 0.25 * Math.sin(this.t * 2 - i * 0.6);
        if (this.launchPulse >= 0) {
          const d = this.launchPulse * 9 - i;
          if (d > 0) k += 2.6 * Math.exp(-d * 0.45);
        }
        c.setRGB(k, k, k);
        this.launchGlow.setColorAt(i, c);
      }
      this.launchGlow.instanceColor.needsUpdate = true;
      if (this.launchTube) this.launchTube.material.uniforms.uIntensity.value = 0.32 + (this.launchPulse >= 0 ? 1.6 * Math.exp(-this.launchPulse * 0.6) : 0);
      if (this.launchPulse > 6) this.launchPulse = -1;
    }
    this.lights.update();
  }
}
