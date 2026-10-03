// 장소 빌더: places.js 의 각 장소를 3D 구조물 + 충돌체 + 애니메이션으로 만듭니다.
import * as THREE from 'three';
import { PLACES, LANDER_YAW } from '../data/places.js';
import { heightAt } from './heightfield.js';
import { mulberry32 } from '../core/noise.js';
import { part, merge, xf, lathe, tube, jitter } from './geo-utils.js';
import * as A from './arch.js';
import { litMaterial, glowMaterial } from './materials.js';
import { TOWERS } from './megacity.js';
import { buildDewfold } from './dewfold.js';
import { buildLander } from './lander.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export class Structures {
  constructor(world) {
    this.world = world;
    this.scene = world.scene;
    this.group = new THREE.Group();
    this.group.name = 'structures';
    this.scene.add(this.group);
    this.mats = A.archMaterials();
    this.anims = [];
    this.lifts = [];
    this.pylons = new Map();
    this.vistas = new Map();
    this.markers = []; // 나침반·지도 표시용 {id, x, y, z}
    this.resonators = []; // 공명에 메아리치는 것들 {x, y, z}
    this.tetherPulse = 0;
    this.t = 0;
    this.silenceSlot = 0;
    for (const p of PLACES) {
      const fn = this['_' + p.type];
      if (fn) fn.call(this, p);
    }
  }

  // ── 도우미 ──────────────────────────────
  _ground(x, z) { return heightAt(x, z); }

  _mesh(parts, mat = this.mats.pearl, parent = this.group) {
    if (!parts.length) return null;
    const m = new THREE.Mesh(merge(parts), mat);
    m.matrixAutoUpdate = false;
    m.updateMatrix();
    parent.add(m);
    return m;
  }

  _col(c) { return this.world.colliders.add(c); }

  _makeLift(x, z, y0, top, exit, r = 6) {
    const parts = A.liftBase({ r });
    this._mesh(parts.map((g) => xf(g, { x, y: y0, z })));
    // 빛기둥
    const h = top - y0;
    const col = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.6, r * 0.9, h, 24, 1, true), glowMaterial({ color: 0x7ff3e6, intensity: 0.4, fresnel: 1, side: THREE.DoubleSide }));
    col.position.set(x, y0 + h / 2, z);
    this.group.add(col);
    // 떠오르는 빛 알갱이
    const n = 60;
    const pos = new Float32Array(n * 3);
    const rnd = mulberry32(Math.floor(x * 7 + z));
    for (let i = 0; i < n; i++) { const a = rnd() * 6.28, d = rnd() * r * 0.8; pos[i * 3] = Math.cos(a) * d; pos[i * 3 + 1] = rnd() * h; pos[i * 3 + 2] = Math.sin(a) * d; }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xbffcff, size: 0.6, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    pts.position.set(x, y0, z);
    this.group.add(pts);
    this.anims.push((t, dt) => {
      const a = pg.attributes.position.array;
      for (let i = 0; i < n; i++) { a[i * 3 + 1] += dt * (12 + (i % 5) * 4); if (a[i * 3 + 1] > h) a[i * 3 + 1] = 0; }
      pg.attributes.position.needsUpdate = true;
    });
    const L = { x, z, y0, top, exit, r };
    this.lifts.push(L);
    return L;
  }

  // ── 척추 ────────────────────────────────
  _spine(p) {
    const H0 = this._ground(0, 0);
    this.spineBase = H0;
    const deckY = H0 + 1300;
    this.deckY = deckY;
    const parts = [];
    const ribs = 6;
    const gold = A.PAL.gold, pearl = A.PAL.pearl;
    for (let i = 0; i < ribs; i++) {
      const a = (i / ribs) * Math.PI * 2 + 0.26;
      // 꽃받침처럼 바깥으로 부풀었다가 위에서 모이는 갈비
      const prof = [[420, -10], [500, 160], [500, 420], [420, 700], [280, 980], [140, 1180], [62, 1290]];
      const pts = prof.map(([r, y]) => V(Math.cos(a) * r, H0 + y, Math.sin(a) * r));
      const g = tube(pts, 30, 12, 36, (t) => 1.9 - 1.25 * t + 0.6 * Math.max(0, 0.12 - t) * 8);
      const band = (y) => Math.abs((((y - H0) % 80) + 80) % 80 - 40) < 1.8;
      parts.push(part(g, (x, y) => (band(y) ? gold : pearl), (x, y) => (band(y) ? 1.3 : 0)));
      // 밑동 받침
      parts.push(part(xf(lathe([[95, 0], [80, 25], [62, 60], [56, 90]], 14), { x: Math.cos(a) * 425, y: H0 - 8, z: Math.sin(a) * 425 }), A.PAL.pearl2, 0));
      this._col({ type: 'cyl', x: Math.cos(a) * 425, z: Math.sin(a) * 425, r: 80, y0: H0 - 10, y1: H0 + 60, walk: true });
      this._col({ type: 'cyl', x: Math.cos(a) * 470, z: Math.sin(a) * 470, r: 55, y0: H0 + 60, y1: H0 + 520, walk: false });
    }
    // 전망대 (꼭대기 원반)
    parts.push(part(lathe([[0.0001, 3], [92, 3], [97, 7], [100, 2], [80, -22], [46, -55], [0.0001, -70]], 40).translate(0, deckY - 3, 0), (x, y) => (y > deckY + 1 ? gold : pearl), (x, y) => (y < deckY - 14 && y > deckY - 30 ? 1 : 0)));
    parts.push(part(xf(new THREE.TorusGeometry(90, 1, 6, 72), { y: deckY + 1.4, rx: Math.PI / 2 }), A.PAL.teal, 1.6));
    parts.push(part(xf(new THREE.RingGeometry(28, 32, 48), { y: deckY + 0.1, rx: -Math.PI / 2 }), A.PAL.teal, 1.2));
    this._col({ type: 'cyl', x: 0, z: 0, r: 94, y0: deckY - 40, y1: deckY });
    // 전망대에서 아래로 늘어진 바늘 (심장을 가리킴)
    const needle = lathe([[0.0001, -1040], [6, -980], [14, -760], [22, -420], [34, -160], [52, -60], [60, -30]], 16).translate(0, deckY, 0);
    parts.push(part(needle, (x, y) => (Math.abs((((y - H0) % 50) + 50) % 50 - 25) < 1.4 ? A.PAL.teal : pearl), (x, y) => (Math.abs((((y - H0) % 50) + 50) % 50 - 25) < 1.4 ? 1.4 : y < H0 + 300 ? 0.6 : 0)));
    // 광장
    parts.push(part(new THREE.CylinderGeometry(250, 254, 1.2, 72).translate(0, H0 + 0.1, 0), A.PAL.pearl2, 0));
    parts.push(part(new THREE.RingGeometry(170, 174, 72).rotateX(-Math.PI / 2).translate(0, H0 + 0.75, 0), gold, 0.6));
    parts.push(part(new THREE.CircleGeometry(100, 48).rotateX(-Math.PI / 2).translate(0, H0 + 0.8, 0), 0x2a7a8a, 0.35));
    this._col({ type: 'cyl', x: 0, z: 0, r: 252, y0: H0 - 5, y1: H0 + 0.7 });
    this._mesh(parts);

    // 승강줄 (구슬 마디가 있는 굵은 줄)
    const tetherH = this.world.tetherTop - deckY;
    const tetherMat = litMaterial({ color: 0xe8e4f0, rim: 0.8, rimColor: 0xd8f8ff, lines: 1 / 70, lineColor: 0x7ff3e6, emissive: 0x203038 });
    const tether = new THREE.Mesh(new THREE.CylinderGeometry(20, 34, tetherH, 20, 1, true).translate(0, deckY + tetherH / 2, 0), tetherMat);
    this.group.add(tether);
    this.tetherMat = tetherMat;
    this.resonators.push({ x: 0, y: H0 + 150, z: 0 });
    const beads = [];
    for (let y = deckY + 600; y < this.world.tetherTop; y += 1800 + beads.length * 300) {
      beads.push(part(xf(new THREE.TorusGeometry(48, 9, 8, 32), { y, rx: Math.PI / 2 }), pearl, 0));
      beads.push(part(xf(new THREE.TorusGeometry(48, 2.5, 4, 32), { y: y - 9, rx: Math.PI / 2 }), A.PAL.teal, 1.6));
    }
    this._mesh(beads);
    // 떠 있는 고리 둘
    const ring1 = new THREE.Mesh(merge(A.pylonRing(560, 3, A.PAL.teal, pearl, 0.025)), this.mats.pearl);
    ring1.rotation.x = Math.PI / 2;
    const ring1b = new THREE.Group();
    ring1b.position.set(0, H0 + 380, 0);
    ring1b.add(ring1);
    this.group.add(ring1b);
    const ring2 = new THREE.Mesh(merge(A.pylonRing(330, 5, A.PAL.amber, gold, 0.03)), this.mats.pearl);
    ring2.rotation.x = Math.PI / 2 + 0.16;
    const ring2b = new THREE.Group();
    ring2b.position.set(0, H0 + 860, 0);
    ring2b.add(ring2);
    this.group.add(ring2b);
    // 심장
    const heart = new THREE.Mesh(new THREE.IcosahedronGeometry(30, 3), litMaterial({ color: 0xf6e8ff, emissive: 0x7ff3e6, emissiveIntensity: 1.0, emissiveNight: 0.6, rim: 1.2, rimColor: 0xffffff, spec: 1.5 }));
    heart.position.set(0, H0 + 150, 0);
    this.group.add(heart);
    const heartRings = [];
    for (let i = 0; i < 3; i++) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(46 + i * 12, 1.2, 6, 64), glowMaterial({ color: [0x7ff3e6, 0xffc46a, 0xff9fd0][i], intensity: 1.8 }));
      r.position.copy(heart.position);
      this.group.add(r);
      heartRings.push(r);
    }
    // 바늘 끝과 심장을 잇는 빛줄기
    const arc = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 3, 70, 8, 1, true), glowMaterial({ color: 0xbffcff, intensity: 1.6, fresnel: 0.5, side: THREE.DoubleSide }));
    this.group.add(arc);
    // 승강차
    const cars = [];
    const carGeo = new THREE.CapsuleGeometry(16, 40, 4, 10);
    const carMat = litMaterial({ color: 0xf2eee8, emissive: 0xffc46a, emissiveIntensity: 0.25, rim: 0.8 });
    for (let i = 0; i < 4; i++) {
      const c = new THREE.Mesh(carGeo, carMat);
      const glow = new THREE.Mesh(new THREE.SphereGeometry(8, 8, 6), glowMaterial({ color: 0xffd08a, intensity: 3 }));
      glow.position.y = -26;
      c.add(glow);
      this.group.add(c);
      cars.push({ m: c, phase: i / 4, dir: i % 2 ? 1 : -1 });
    }
    this.anims.push((t) => {
      ring1b.rotation.y = t * 0.015;
      tetherMat.uniforms.uEmissive.value.setRGB(0.13 + this.tetherPulse * 1.2, 0.19 + this.tetherPulse * 1.6, 0.22 + this.tetherPulse * 1.8);
      ring2b.rotation.y = -t * 0.03;
      heart.rotation.y = t * 0.1;
      heart.position.y = H0 + 150 + Math.sin(t * 0.5) * 4;
      heartRings.forEach((r, i) => { r.rotation.set(t * (0.15 + i * 0.07), t * (0.1 - i * 0.05), i); r.position.y = heart.position.y; });
      const tipY = deckY - 1040;
      arc.position.set(0, (tipY + heart.position.y + 30) / 2, 0);
      arc.scale.y = Math.max(0.1, (tipY - heart.position.y - 30) / 70);
      arc.material.uniforms.uIntensity.value = 1.2 + Math.sin(t * 3.1) * 0.4 + Math.sin(t * 7.3) * 0.2;
      for (const c of cars) {
        const u = (t * 0.003 + c.phase) % 1;
        const k = c.dir > 0 ? u : 1 - u;
        c.m.position.set(c.dir > 0 ? 40 : -40, deckY + 80 + k * (14000 - deckY), 0);
      }
    });
    // 중앙 승강 기둥: 광장 → 전망대
    this._makeLift(0, 70, H0 + 0.7, deckY + 0.5, [0, -1], 6);
    this.markers.push({ id: 'spine', x: 0, y: deckY, z: 0 });
  }

  // ── 수도 하모네아 ─────────────────────────
  _capital(p) {
    const H0 = this.spineBase ?? this._ground(0, 0);
    const rnd = mulberry32(777);
    const parts = [];
    const glowCols = [A.PAL.teal, A.PAL.amber, A.PAL.rose, A.PAL.violet];
    // 울림탑(megacity.js) 자리는 비워 둔다
    const occupied = TOWERS.map((T) => [Math.cos((T.a * Math.PI) / 180) * T.R, Math.sin((T.a * Math.PI) / 180) * T.R, T.r * 3.7]);
    const free = (x, z, r) => occupied.every((o) => Math.hypot(o[0] - x, o[1] - z) > o[2] + r);
    const ribAngles = Array.from({ length: 6 }, (_, i) => (i / 6) * Math.PI * 2 + 0.26);
    const nearRib = (x, z) => ribAngles.some((a) => Math.hypot(x - Math.cos(a) * 450, z - Math.sin(a) * 450) < 120);
    // 안쪽 큰 첨탑
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + rnd() * 0.25;
      const R = 620 + rnd() * 300;
      const x = Math.cos(a) * R, z = Math.sin(a) * R;
      const h = 90 + rnd() * 160, r = 5 + rnd() * 4;
      if (!free(x, z, r * 2.2) || nearRib(x, z)) continue;
      occupied.push([x, z, r * 2]);
      const y = this._ground(x, z) - 1;
      A.place(parts, A.spireTower({ h, r, seed: i + 1, glow: glowCols[i % 4], pods: rnd() < 0.4 ? 2 : 1 }), { x, y, z });
      this._col({ type: 'cyl', x, z, r: r * 1.15, y0: y - 2, y1: y + h * 0.42 });
      this._col({ type: 'cyl', x, z, r: r * 1.5, y0: y + h * 0.42, y1: y + h * 0.6 });
    }
    // 집과 정원
    for (let i = 0; i < 70; i++) {
      const a = rnd() * Math.PI * 2;
      const R = 260 + rnd() * 1180;
      const x = Math.cos(a) * R, z = Math.sin(a) * R;
      const big = rnd() < 0.3;
      const r = big ? 7 + rnd() * 4 : 3.5 + rnd() * 3;
      if (!free(x, z, r + 6) || nearRib(x, z) || Math.hypot(x, z) < 265) continue;
      occupied.push([x, z, r + 2]);
      const y = this._ground(x, z) - 0.3;
      if (rnd() < 0.78) {
        A.place(parts, A.domeHouse({ r, h: r * (1.1 + rnd() * 0.4), seed: i + 40, glow: rnd() < 0.7 ? A.PAL.amber : A.PAL.teal }), { x, y, z });
        this._col({ type: 'cyl', x, z, r: r * 0.95, y0: y - 1, y1: y + r * 1.15, dome: r * 0.6 });
      } else {
        A.place(parts, A.gardenBed({ r: r + 1, seed: i }), { x, y, z });
        this._col({ type: 'cyl', x, z, r: r + 1, y0: y - 1, y1: y + 0.5 });
      }
    }
    // 바깥 작은 첨탑
    for (let i = 0; i < 26; i++) {
      const a = rnd() * Math.PI * 2;
      const R = 950 + rnd() * 520;
      const x = Math.cos(a) * R, z = Math.sin(a) * R;
      const h = 30 + rnd() * 60, r = 2.5 + rnd() * 2;
      if (!free(x, z, r * 2.5)) continue;
      occupied.push([x, z, r * 2]);
      const y = this._ground(x, z) - 1;
      A.place(parts, A.spireTower({ h, r, seed: 100 + i, glow: glowCols[(i + 1) % 4] }), { x, y, z });
      this._col({ type: 'cyl', x, z, r: r * 1.15, y0: y - 2, y1: y + h * 0.45 });
    }
    // 승강 기둥 도착점마다 아치
    for (const [x, z, ry] of [[0, 1520, 0], [1520, 0, Math.PI / 2], [-1520, 60, Math.PI / 2], [0, -1520, 0]]) {
      const y = this._ground(x, z) - 1;
      A.place(parts, A.archGate({ span: 34, h: 30 }), { x, y, z, ry });
    }
    this._mesh(parts);

    // 떠 있는 꽃잎 섬 (위에 집·정원)
    const petals = [];
    const pParts = [];
    for (let i = 0; i < 22; i++) {
      const a = rnd() * Math.PI * 2;
      const R = 420 + rnd() * 900;
      const x = Math.cos(a) * R, z = Math.sin(a) * R;
      const r = 12 + rnd() * 20;
      if (nearRib(x, z) || occupied.slice(0, TOWERS.length).some((o) => Math.hypot(o[0] - x, o[1] - z) < 150 + r)) continue;
      const y = H0 + 30 + rnd() * 170;
      petals.push({ x, y, z, r });
      A.place(pParts, A.petal({ r, depth: r * 0.45, glow: glowCols[i % 4] }), { x, y, z });
      this._col({ type: 'cyl', x, z, r: r * 0.97, y0: y - r * 0.3, y1: y + 0.02 });
      const k = Math.floor(rnd() * 3);
      for (let j = 0; j < k; j++) {
        const b = rnd() * Math.PI * 2, d = rnd() * r * 0.5;
        const hr = 3 + rnd() * 3;
        const hx = x + Math.cos(b) * d, hz = z + Math.sin(b) * d;
        A.place(pParts, A.domeHouse({ r: hr, h: hr * 1.2, seed: 300 + i * 3 + j }), { x: hx, y, z: hz });
        this._col({ type: 'cyl', x: hx, z: hz, r: hr * 0.95, y0: y, y1: y + hr * 1.2, dome: hr * 0.6 });
      }
      if (k === 0) A.place(pParts, A.gardenBed({ r: r * 0.4, seed: 50 + i }), { x, y, z });
    }
    // 디딤돌 나선: 땅에서 낮은 꽃잎으로
    for (let s = 0; s < 2; s++) {
      const cx = s ? 620 : -560, cz = s ? 520 : -640;
      const g = this._ground(cx, cz);
      for (let i = 0; i < 16; i++) {
        const a = i * 0.55 + s;
        const x = cx + Math.cos(a) * 26, z = cz + Math.sin(a) * 26;
        const y = g + 2.2 + i * 2.4;
        A.place(pParts, A.petal({ r: 3.4, depth: 1.6, glow: A.PAL.teal }), { x, y, z });
        this._col({ type: 'cyl', x, z, r: 3.3, y0: y - 1, y1: y + 0.02 });
      }
      const top = g + 2.2 + 16 * 2.4;
      A.place(pParts, A.petal({ r: 18, depth: 8 }), { x: cx, y: top, z: cz });
      A.place(pParts, A.gardenBed({ r: 7, seed: 9 + s }), { x: cx, y: top, z: cz });
      this._col({ type: 'cyl', x: cx, z: cz, r: 17.5, y0: top - 5, y1: top + 0.02 });
      petals.push({ x: cx, y: top, z: cz, r: 18 });
    }
    this._mesh(pParts);
    this.capitalPetals = petals;
  }

  // ── 승강 기둥 (고원 가장자리 → 고원 위) ─────────
  _lift(p) {
    const [x, z] = p.pos;
    const y0 = heightAt(x, z);
    const top = heightAt(p.top[0], p.top[1]) + 2;
    const L = this._makeLift(x, z, y0, top, p.exit, 7);
    L.topPos = p.top;
    this.markers.push({ id: p.id, x, y: y0, z });
  }

  // 착륙 지점: 탐사선 「라르크」의 착륙선(세 다리·내린 경사판) + 아웬이 밝혀 둔 빛 표지(착륙할 자리를 알려 준 기둥)
  _crash(p) {
    const [x, z] = p.pos;
    const y = this._ground(x, z);
    const ry = LANDER_YAW; // 해치와 경사판이 마중 나온 이엘 쪽을 본다
    this.lander = buildLander(this, p, ry); // 착륙선 「라르크 2」 (lander.js) — 안의 선실까지
    { const W = this.lander.W, [rx, rz] = W(0, 6.2); this.world.clearZones.push({ x, z, r: 7.2 }, { seg: [x, z, rx, rz], r: 2.2 }); } // 선실·경사판에 풀이 자라지 않게
    // 아웬의 빛 표지: 착륙할 자리를 밝혀 둔 진주빛 기둥과 떠도는 고리
    const bx = x + Math.sin(ry) * 12 + Math.cos(ry) * 8, bz = z + Math.cos(ry) * 12 - Math.sin(ry) * 8, by = this._ground(bx, bz);
    const bparts = [part(xf(new THREE.CylinderGeometry(0.35, 0.6, 5.5, 8), { x: bx, y: by + 2.75, z: bz }), 0xe8e2f0, 0)];
    bparts.push(part(xf(new THREE.CylinderGeometry(0.9, 1.1, 0.3, 8), { x: bx, y: by + 0.15, z: bz }), 0x8e8a9c, 0));
    this._mesh(bparts, this.mats.stone);
    this._col({ type: 'cyl', x: bx, z: bz, r: 0.7, y0: by - 1, y1: by + 5.6 });
    const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 1), glowMaterial({ color: 0x9ff6ff, intensity: 2.4 }));
    orb.position.set(bx, by + 6.3, bz);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.05, 4, 32), glowMaterial({ color: 0xffd27a, intensity: 2.0 }));
    halo.position.copy(orb.position);
    this.group.add(orb, halo);
    this.anims.push((t) => { orb.rotation.y = t * 0.6; halo.rotation.set(Math.PI / 2 + Math.sin(t * 0.7) * 0.4, t * 0.5, 0); orb.position.y = by + 6.3 + Math.sin(t * 1.2) * 0.15; });
    this.markers.push({ id: 'crash', x, y, z });
  }

  _smoke(x, y, z) {
    const n = 70;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3);
    const life = new Float32Array(n);
    for (let i = 0; i < n; i++) { life[i] = i / n; }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('life', new THREE.BufferAttribute(life, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(0x9a94a8) }, uScale: { value: innerHeight } },
      vertexShader: `attribute float life; varying float vL; uniform float uScale;
        void main(){ vL = life; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv;
        gl_PointSize = (2.0 + life * 26.0) * uScale / max(1.0, -mv.z) ; }`,
      fragmentShader: `uniform vec3 uColor; varying float vL;
        void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); if (d > 0.5) discard;
        float a = smoothstep(0.5, 0.0, d) * (1.0 - vL) * smoothstep(0.0, 0.08, vL) * 0.5;
        gl_FragColor = vec4(uColor * (0.7 + 0.3 * (1.0 - vL)), a); }`,
      transparent: true, depthWrite: false,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    this.group.add(pts);
    const rnd = mulberry32(9);
    const seeds = Array.from({ length: n }, () => [rnd() - 0.5, rnd() - 0.5, 0.7 + rnd() * 0.6]);
    this.anims.push((t, dt) => {
      for (let i = 0; i < n; i++) {
        life[i] += dt * 0.045 * seeds[i][2];
        if (life[i] > 1) life[i] -= 1;
        const L = life[i];
        pos[i * 3] = x + seeds[i][0] * (1 + L * 12) + L * L * 70;
        pos[i * 3 + 1] = y + L * 160;
        pos[i * 3 + 2] = z + seeds[i][1] * (1 + L * 12) - L * 30;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.life.needsUpdate = true;
    });
    return pts;
  }

  // ── 마을 이슬터 (dewfold.js) ───────────────────────────
  _village(p) {
    const { y0 } = buildDewfold(this, p);
    const [cx, cz] = p.pos;
    // 깨어난 우물: 빛 분수 + 상승 기류 (처음엔 꺼져 있음)
    const fount = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 6.5, 70, 20, 1, true).translate(0, 35, 0), glowMaterial({ color: 0x7ff3e6, intensity: 0.6, fresnel: 1, side: THREE.DoubleSide }));
    fount.position.set(cx, y0 + 0.95, cz);
    fount.visible = false;
    this.group.add(fount);
    this.well = { fount, x: cx, y: y0, z: cz, updraft: { x: cx, z: cz, r: 8, y0: y0, y1: y0 + 80, strength: 26, enabled: false } };
    this.world.updrafts.push(this.well.updraft);
  }

  /** 착륙선 선실의 쓸 것 (교신 단말·별지도·표본함·일지) */
  landerTarget(p) {
    const L = this.lander;
    if (!L) return null;
    let best = null, bd = 1e9;
    for (const st of L.stations) {
      if (Math.abs(p.y - st.y) > 1.6) continue;
      const d = Math.hypot(p.x - st.at[0], p.z - st.at[1]);
      if (d < st.r && d < bd) { bd = d; best = st; }
    }
    return best ? { kind: 'lander', o: best, label: best.label, short: best.short } : null;
  }

  /** 안테나: 궤도의 배 쪽을 겨누고, 모아가 말하면 빛난다 (comm 이 부른다) */
  aimAntenna(dir, pulse, t) {
    const L = this.lander;
    if (!L) return;
    const d = dir || { x: 0.3, y: 0.9, z: 0.2 };
    const tgt = L.head.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(d.x, d.y, d.z).multiplyScalar(50));
    L.head.lookAt(tgt);
    L.beacon.material.uniforms.uIntensity.value = 1.6 + pulse * 5 + Math.max(0, Math.sin(t * 2.4)) * 0.6;
    L.feed.material.uniforms.uIntensity.value = 1.5 + pulse * 6;
  }

  /** 인물이 그 장소로 갈 때 따라갈 길 (마을 둘레 도시를 건물 사이로 가로지르지 않게). 없으면 null */
  routeTo(placeId, from) {
    if (placeId !== 'dewfold' || !this.dewRoute) return null;
    const P = this.dewRoute, [wx, wz] = P[P.length - 1];
    const d = Math.hypot(from.x - wx, from.z - wz);
    if (d < 120) return null;
    // 아직 앞에 있는 길목만 (목적지에 지금보다 가까운 것)
    return P.filter((q) => Math.hypot(q[0] - wx, q[1] - wz) < d - 10);
  }

  /** 이슬터 우물이 깨어남 */
  wellAwake(instant = false) {
    const w = this.well;
    if (!w || w.awake) return;
    w.awake = true;
    w.fount.visible = true;
    w.updraft.enabled = true;
    w.k = instant ? 1 : 0;
    this.anims.push((t, dt) => {
      w.k = Math.min(1, w.k + dt / 3);
      w.fount.scale.set(1, Math.max(0.01, w.k), 1);
      w.fount.material.uniforms.uIntensity.value = 0.45 + Math.sin(t * 2) * 0.12;
    });
  }

  // ── 공명탑 ─────────────────────────────
  _pylon(p) {
    const [x, z] = p.pos;
    const y = this._ground(x, z);
    const S = p.great ? 2.4 : 1; // 큰 공명탑
    const h = 95;
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.scale.setScalar(S);
    this.group.add(g);
    const body = new THREE.Mesh(merge(A.pylonBody({ h })), this.mats.crystal);
    g.add(body);
    const rings = [];
    for (let i = 0; i < 3; i++) {
      const r = new THREE.Mesh(merge(A.pylonRing(11 - i * 2.2, i + 3, A.PAL.teal)), this.mats.stone);
      g.add(r);
      rings.push(r);
    }
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(4.5, 2), glowMaterial({ color: 0xbffcff, intensity: 2.5 }));
    core.position.y = h + 18;
    g.add(core);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 4, 2400, 12, 1, true).translate(0, 1200 + h + 10, 0), glowMaterial({ color: 0x7ff3e6, intensity: 0.55, fresnel: 0.6, side: THREE.DoubleSide }));
    g.add(beam);
    if (!p.mobile) {
      this._col({ type: 'cyl', x, z, r: 16 * S, y0: y - 3, y1: y + 2.5 * S });
      this._col({ type: 'cyl', x, z, r: 11.5 * S, y0: y + 2.5 * S, y1: y + 5 * S });
      this._col({ type: 'cyl', x, z, r: 4.2 * S, y0: y + 5 * S, y1: y + h * 0.85 * S, walk: false });
    }
    const slot = p.alive ? -1 : this.silenceSlot++;
    const P = {
      id: p.id, place: p, x, y, z, h: h * S, S, group: g, rings, core, beam, body, great: !!p.great, mobile: !!p.mobile,
      alive: !!p.alive, k: p.alive ? 1 : 0, slot, silenceR: p.great ? 3600 : 1400, silenceMax: p.great ? 0.65 : 1,
      updraft: { x, z, r: 26 * S, y0: y, y1: y + 260 * S, strength: 20, enabled: !!p.alive },
      well: { x, z, r: 120 * S, scale: 0.55 },
    };
    this.world.updrafts.push(P.updraft);
    if (P.alive) this.world.gravityWells.push(P.well);
    if (slot >= 0) this.world.atmos.setSilence(slot, x, z, P.silenceR, P.silenceMax);
    this.pylons.set(p.id, P);
    this._posePylon(P, 0);
    this.markers.push({ id: p.id, x, y: y + h, z });
  }

  _posePylon(P, t) {
    const k = P.k; // 0 = 침묵, 1 = 노래
    P.rings.forEach((r, i) => {
      const fallen = new THREE.Vector3(Math.cos(i * 2.1) * (16 + i * 3), 1 + i * 0.6, Math.sin(i * 2.1) * (16 + i * 3));
      const up = new THREE.Vector3(0, 30 + i * 22 + Math.sin(t * 0.6 + i) * 1.5, 0);
      r.position.lerpVectors(fallen, up, k);
      r.rotation.set(
        (1 - k) * (1.45 + i * 0.05) + k * (Math.PI / 2 + Math.sin(t * 0.3 + i) * 0.25),
        k * t * (0.2 + i * 0.12) * (i % 2 ? -1 : 1),
        (1 - k) * (0.3 * i),
      );
    });
    P.core.visible = k > 0.05;
    P.core.scale.setScalar(Math.max(0.01, k) * (1 + Math.sin(t * 2) * 0.06));
    P.beam.visible = k > 0.02;
    P.beam.scale.set(1, Math.max(0.001, k), 1);
  }

  /** 공명탑을 깨운다 (복원 연출 포함) */
  awakenPylon(id, instant = false) {
    const P = this.pylons.get(id);
    if (!P || P.alive) return;
    P.alive = true;
    P.updraft.enabled = true;
    this.world.gravityWells.push(P.well);
    P.waking = instant ? 0 : 1; // 깨어나는 중
    if (instant) { P.k = 1; if (P.slot >= 0) this.world.atmos.setSilence(P.slot, P.x, P.z, P.silenceR, 0); }
  }

  // ── 조망점 ─────────────────────────────
  _vista(p) {
    const [x, z] = p.pos;
    const y = this._ground(x, z);
    const parts = [];
    parts.push(part(new THREE.CylinderGeometry(3.2, 3.8, 0.8, 8).translate(0, 0.4, 0), A.PAL.stone, 0));
    parts.push(part(new THREE.CylinderGeometry(0.35, 0.5, 2.4, 6).translate(0, 2, 0), A.PAL.stoneDark, 0));
    parts.push(part(new THREE.OctahedronGeometry(0.5, 0).scale(1, 1.6, 1).translate(0, 3.8, 0), A.PAL.amber, 1.6));
    parts.push(part(new THREE.TorusGeometry(2.6, 0.08, 4, 24).rotateX(Math.PI / 2).translate(0, 0.85, 0), A.PAL.amber, 1.4));
    this._mesh(parts.map((g) => xf(g, { x, y: y - 0.2, z })), this.mats.stone);
    this._col({ type: 'cyl', x, z, r: 3.5, y0: y - 1, y1: y + 0.6 });
    this.vistas.set(p.id, { id: p.id, x, y: y + 0.6, z, place: p });
    this.markers.push({ id: p.id, x, y, z });
  }

  _arch(p) {
    const [x, z] = p.pos;
    const y = this._ground(x, z);
    this._mesh(A.archGate({ span: 70, h: 95, w: 4 }).map((g) => xf(g, { x, y: y - 2, z, ry: 0.5 })));
    for (const s of [-1, 1]) this._col({ type: 'cyl', x: x + Math.cos(-0.5) * 35 * s, z: z + Math.sin(-0.5) * 35 * s, r: 4, y0: y - 3, y1: y + 70, walk: false });
    this.markers.push({ id: p.id, x, y, z });
  }

  // ── 윤슬: 수정 메사 위의 도시 ─────────────────
  _glasscity(p) {
    const [cx, cz] = p.pos;
    const y0 = this._ground(cx, cz);
    const rnd = mulberry32(501);
    const crys = [], pearl = [];
    const towers = [];
    for (let i = 0; i < 26; i++) {
      const a = rnd() * Math.PI * 2, R = 20 + rnd() * 130;
      const x = cx + Math.cos(a) * R, z = cz + Math.sin(a) * R;
      const h = 25 + rnd() * 110 * (1 - R / 220), r = 2.5 + rnd() * 4;
      const y = this._ground(x, z) - 1;
      if (y < y0 - 25) continue;
      const tilt = (rnd() - 0.5) * 0.12;
      const col = [0xf4c8e2, 0xd8c8ff, 0xffd8ec, 0xc8e8ff][Math.floor(rnd() * 4)];
      const body = new THREE.CylinderGeometry(r * 0.8, r, h * 0.85, 6, 4).translate(0, h * 0.425, 0);
      crys.push(part(xf(body, { x, y, z, rz: tilt, ry: rnd() }), (px, py) => (Math.abs(((py - y) % 12) - 6) < 0.6 ? 0xffffff : col), (px, py) => (Math.abs(((py - y) % 12) - 6) < 0.6 ? 1.2 : 0.18)));
      crys.push(part(xf(new THREE.ConeGeometry(r * 0.8, h * 0.18, 6).translate(0, h * 0.94, 0), { x, y, z, rz: tilt }), 0xffffff, 0.7));
      this._col({ type: 'cyl', x, z, r: r * 1.05, y0: y - 2, y1: y + h * 0.85 });
      towers.push({ x, y: y + h * 0.9, z });
      if (i % 4 === 0) this.resonators.push({ x, y: y + h * 0.9, z });
    }
    // 진주 돔 집
    for (let i = 0; i < 12; i++) {
      const a = rnd() * Math.PI * 2, R = 40 + rnd() * 110;
      const x = cx + Math.cos(a) * R, z = cz + Math.sin(a) * R;
      const r = 3.5 + rnd() * 3;
      const y = this._ground(x, z) - 0.3;
      if (y < y0 - 10) continue;
      A.place(pearl, A.domeHouse({ r, h: r * 1.3, seed: 700 + i, glow: A.PAL.rose }), { x, y, z });
      this._col({ type: 'cyl', x, z, r: r * 0.95, y0: y - 1, y1: y + r * 1.3, dome: r * 0.7 });
    }
    this._mesh(crys, this.mats.crystal);
    this._mesh(pearl);
    // 떠 있는 프리즘 심장
    const heart = new THREE.Mesh(new THREE.OctahedronGeometry(16, 0), this.mats.crystal);
    heart.geometry = merge([part(new THREE.OctahedronGeometry(16, 0), 0xffd8f0, 0.5)]);
    heart.position.set(cx, y0 + 150, cz);
    this.group.add(heart);
    const shards = [];
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(merge([part(new THREE.OctahedronGeometry(4, 0).scale(0.6, 1.8, 0.6), 0xd8c8ff, 0.6)]), this.mats.crystal);
      this.group.add(m);
      shards.push(m);
    }
    this.anims.push((t) => {
      heart.rotation.set(t * 0.1, t * 0.17, 0);
      heart.position.y = y0 + 150 + Math.sin(t * 0.4) * 4;
      shards.forEach((m, i) => {
        const a = t * 0.2 + (i / 8) * Math.PI * 2;
        m.position.set(cx + Math.cos(a) * 34, heart.position.y + Math.sin(t * 0.7 + i) * 8, cz + Math.sin(a) * 34);
        m.rotation.set(t * 0.3 + i, t * 0.5, 0);
      });
    });
    this.resonators.push({ x: cx, y: y0 + 150, z: cz });
    this.world.updrafts.push({ x: cx, z: cz, r: 14, y0, y1: y0 + 170, strength: 22 });
    this.markers.push({ id: p.id, x: cx, y: y0, z: cz });
  }

  // ── 갓마을: 거대 버섯 위의 마을 ─────────────────
  _bloomcity(p) {
    const [cx, cz] = p.pos;
    const rnd = mulberry32(611);
    const caps = [];
    const parts = [];
    const defs = [[0, 0, 150], [120, 60, 110], [-110, 90, 125], [60, -130, 95], [-90, -110, 165], [190, -60, 80]];
    for (const [dx, dz, h] of defs) {
      const x = cx + dx, z = cz + dz, g = this._ground(x, z);
      const capR = h * 0.32;
      const stalk = tube([V(x, g - 3, z), V(x + 3, g + h * 0.4, z), V(x - 2, g + h * 0.8, z + 2), V(x, g + h, z)], h * 0.05, 10, 10, (t) => 1.5 - 0.6 * t + Math.max(0, 0.15 - t) * 6);
      parts.push(part(stalk, (px, py) => (Math.sin((py - g) * 0.5) > 0.93 ? 0x9ff6e0 : 0xcfc4e8), (px, py) => (Math.sin((py - g) * 0.5) > 0.93 ? 1.2 : 0)));
      const top = g + h;
      const cap = lathe([[0.001, 8], [capR * 0.4, 7.5], [capR * 0.8, 4.5], [capR, 0.5], [capR * 0.97, -0.5], [capR * 0.6, 0.2], [capR * 0.2, -1.5], [0.001, -1.8]], 28);
      parts.push(part(xf(cap, { x, y: top, z }), (px, py) => (py < top + 0.1 ? 0x4dfcd0 : 0x5a3aa8), (px, py) => (py < top + 0.1 ? 1.4 : 0)));
      this._col({ type: 'cyl', x, z, r: h * 0.07, y0: g - 5, y1: top - 2, walk: false });
      this._col({ type: 'cyl', x, z, r: capR * 0.95, y0: top - 2, y1: top + 8, dome: 7.5 });
      caps.push({ x, z, y: top + 7.6, r: capR });
      // 갓 위의 집
      const n = 1 + Math.floor(rnd() * 3);
      for (let i = 0; i < n; i++) {
        const a = rnd() * Math.PI * 2, d = rnd() * capR * 0.35;
        const hx = x + Math.cos(a) * d, hz = z + Math.sin(a) * d, hr = 3.5 + rnd() * 2;
        const hy = top + 8 - 7.5 * (d / capR) ** 2 - 0.5;
        A.place(parts, A.domeHouse({ r: hr, h: hr * 1.3, seed: 900 + i + dx, glow: A.PAL.teal }), { x: hx, y: hy, z: hz });
        this._col({ type: 'cyl', x: hx, z: hz, r: hr * 0.95, y0: hy - 1, y1: hy + hr * 1.3, dome: hr * 0.7 });
      }
    }
    // 갓과 갓을 잇는 다리
    for (let i = 1; i < caps.length; i++) {
      const a = caps[0], b = caps[i];
      const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
      const sx = a.x + (dx / d) * a.r * 0.6, sz = a.z + (dz / d) * a.r * 0.6, ex = b.x - (dx / d) * b.r * 0.6, ez = b.z - (dz / d) * b.r * 0.6;
      const len = Math.hypot(ex - sx, ez - sz);
      const ya = a.y - 7.5 * 0.36 + 0.2, yb = b.y - 7.5 * 0.36 + 0.2;
      const rot = Math.atan2(-(ez - sz), ex - sx);
      const mx = (sx + ex) / 2, mz = (sz + ez) / 2;
      const deck = new THREE.BoxGeometry(len, 0.4, 3);
      const pos = deck.attributes.position;
      for (let k = 0; k < pos.count; k++) { const t = (pos.getX(k) + len / 2) / len; pos.setY(k, pos.getY(k) + ya + (yb - ya) * t - Math.sin(t * Math.PI) * 3); }
      deck.computeVertexNormals();
      parts.push(part(xf(deck, { x: mx, z: mz, ry: rot }), 0x8a7a6a, 0));
      parts.push(part(xf(new THREE.BoxGeometry(len, 0.12, 0.12).translate(0, ya + 1.2, 1.5), { x: mx, z: mz, ry: rot }), 0x7dfde0, 1.2));
      this._col({ type: 'ramp', x: mx, z: mz, hx: len / 2, hz: 1.5, rot, y0: Math.min(ya, yb) - 4, y1: ya, y1b: yb });
    }
    this._mesh(parts, this.mats.pearl);
    // 땅에서 갓으로 오르는 승강 기둥
    const c0 = caps[0], c4 = caps[4];
    const gx = cx + 26, gz = cz + 40;
    this._makeLift(gx, gz, this._ground(gx, gz), c0.y - 2, [0, 0], 6).topPos = [c0.x + 10, c0.z + 8];
    const hx = c4.x + 30, hz = c4.z + 30;
    this._makeLift(hx, hz, this._ground(hx, hz), c4.y - 2, [0, 0], 6).topPos = [c4.x + 8, c4.z + 8];
    this.resonators.push({ x: cx, y: c0.y, z: cz });
    this.markers.push({ id: p.id, x: cx, y: c0.y, z: cz });
  }

  // ── 떠돌섬: 협곡 위로 떠오르는 섬들 ─────────────────
  _canyoncity(p) {
    const [cx, cz] = p.pos;
    const rnd = mulberry32(733);
    this.islands = [];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + rnd() * 0.4, R = 160 + rnd() * 380;
      const x = cx + Math.cos(a) * R, z = cz + Math.sin(a) * R;
      const r = 18 + rnd() * 26;
      const parts = A.floatingIsland({ r, seed: 40 + i });
      const k = Math.floor(rnd() * 3);
      for (let j = 0; j < k; j++) {
        const b = rnd() * Math.PI * 2, d = rnd() * r * 0.45, hr = 3 + rnd() * 2.5;
        A.place(parts, A.domeHouse({ r: hr, h: hr * 1.2, seed: 800 + i * 3 + j, glow: A.PAL.amber }), { x: Math.cos(b) * d, y: 0, z: Math.sin(b) * d });
      }
      if (k === 0) A.place(parts, A.gardenBed({ r: r * 0.3, seed: 20 + i, colors: [A.PAL.amber, A.PAL.rose] }), {});
      const obj = new THREE.Group();
      const mesh = new THREE.Mesh(merge(parts), this.mats.pearl);
      obj.add(mesh);
      const ground = this._ground(x, z);
      const upY = Math.max(ground, 200) + 90 + rnd() * 230;
      const downY = ground + 1.5;
      obj.position.set(x, downY, z);
      obj.rotation.set((rnd() - 0.5) * 0.25, rnd() * 6, (rnd() - 0.5) * 0.25);
      this.group.add(obj);
      const col = this._col({ type: 'cyl', x: 0, z: 0, r: r * 0.95, y0: -6, y1: 0.1, obj });
      this.islands.push({ obj, upY, downY, x, z, r, k: 0, tilt: [obj.rotation.x, obj.rotation.z], phase: rnd() * 6, col });
    }
    this.anims.push((t, dt) => {
      const P = this.pylons.get('canyon-pylon');
      const target = P && P.alive ? 1 : 0;
      for (const I of this.islands) {
        I.k += (target - I.k) * Math.min(1, dt * 0.08) + (target > I.k ? dt * 0.01 : 0);
        I.k = Math.min(1, Math.max(0, I.k));
        const e = I.k * I.k * (3 - 2 * I.k);
        I.obj.position.y = I.downY + (I.upY - I.downY) * e + Math.sin(t * 0.4 + I.phase) * 2 * e;
        I.obj.rotation.x = I.tilt[0] * (1 - e);
        I.obj.rotation.z = I.tilt[1] * (1 - e);
      }
    });
    // 섬지기의 받침 + 상승 기류 (깨어나면 섬으로 오를 수 있게)
    const y0 = this._ground(cx, cz);
    this._mesh(A.liftBase({ r: 8, glow: A.PAL.amber }).map((g) => xf(g, { x: cx, y: y0, z: cz })));
    this.canyonDraft = { x: cx, z: cz, r: 12, y0, y1: y0 + 420, strength: 24, enabled: false };
    this.world.updrafts.push(this.canyonDraft);
    this.anims.push(() => { const P = this.pylons.get('canyon-pylon'); this.canyonDraft.enabled = !!(P && P.alive); });
    this.markers.push({ id: p.id, x: cx, y: y0, z: cz });
  }

  // ── 별듣는 탑: 첨봉 꼭대기 관측소 ─────────────────
  _observatory(p) {
    const [cx, cz] = p.pos;
    const y = this._ground(cx, cz);
    const parts = [];
    parts.push(part(new THREE.CylinderGeometry(30, 34, 3, 24).translate(cx, y - 1, cz), A.PAL.stone, 0));
    A.place(parts, A.domeHouse({ r: 12, h: 14, seed: 77, glow: 0xa8c8ff }), { x: cx - 8, y: y + 0.5, z: cz - 6 });
    this._col({ type: 'cyl', x: cx, z: cz, r: 32, y0: y - 6, y1: y + 0.5 });
    this._col({ type: 'cyl', x: cx - 8, z: cz - 6, r: 11.5, y0: y, y1: y + 14, dome: 9 });
    // 별을 듣는 고리 안테나
    for (let i = 0; i < 3; i++) {
      const g = new THREE.TorusGeometry(10 - i * 2.5, 0.5, 6, 40);
      parts.push(part(xf(g, { x: cx + 14, y: y + 26 + i * 4, z: cz + 8, rx: 0.9 + i * 0.12, ry: -0.6 }), i === 1 ? A.PAL.gold : A.PAL.pearl, i === 1 ? 0.8 : 0));
    }
    parts.push(part(xf(new THREE.CylinderGeometry(0.8, 1.6, 26, 8), { x: cx + 14, y: y + 13, z: cz + 8 }), A.PAL.pearl, 0));
    A.place(parts, A.spireTower({ h: 60, r: 2.4, seed: 66, glow: 0xa8c8ff }), { x: cx + 18, y, z: cz - 14 });
    this._col({ type: 'cyl', x: cx + 18, z: cz - 14, r: 2.8, y0: y, y1: y + 30, walk: false });
    this._mesh(parts);
    this.resonators.push({ x: cx + 14, y: y + 30, z: cz + 8 });
    this.markers.push({ id: p.id, x: cx, y, z: cz });
  }

  // ── 물노래: 섬과 바다 아치의 도시 ──────────────────
  _seacity(p) {
    const [cx, cz] = p.pos;
    const rnd = mulberry32(919);
    const parts = [];
    // 바다 아치 (파도의 악기)
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + rnd() * 0.3, R = 260 + rnd() * 160;
      const x = cx + Math.cos(a) * R, z = cz + Math.sin(a) * R;
      const span = 60 + rnd() * 50, h = 50 + rnd() * 50;
      A.place(parts, A.archGate({ span, h, w: 5, glow: 0x7ff0ff }), { x, y: Math.min(this._ground(x, z), -2) - 4, z, ry: a + Math.PI / 2 });
      this.resonators.push({ x, y: h * 0.8, z });
    }
    // 섬 위의 탑과 집
    for (let i = 0; i < 9; i++) {
      const a = rnd() * Math.PI * 2, R = rnd() * 160;
      const x = cx + Math.cos(a) * R, z = cz + Math.sin(a) * R;
      const y = this._ground(x, z);
      if (y < 3) continue;
      if (i < 4) {
        const h = 40 + rnd() * 50, r = 3 + rnd() * 2;
        A.place(parts, A.spireTower({ h, r, seed: 950 + i, glow: 0x7ff0ff }), { x, y: y - 1, z });
        this._col({ type: 'cyl', x, z, r: r * 1.1, y0: y - 2, y1: y + h * 0.45 });
      } else {
        const r = 4 + rnd() * 3;
        A.place(parts, A.domeHouse({ r, h: r * 1.2, seed: 960 + i, glow: 0x7ff0ff }), { x, y: y - 0.3, z });
        this._col({ type: 'cyl', x, z, r: r * 0.95, y0: y - 1, y1: y + r * 1.2, dome: r * 0.7 });
      }
    }
    // 물 위의 꽃잎 발판 (썰매로 건널 수 있는 징검다리)
    for (let i = 0; i < 10; i++) {
      const a = rnd() * Math.PI * 2, R = 180 + rnd() * 200;
      const x = cx + Math.cos(a) * R, z = cz + Math.sin(a) * R;
      if (this._ground(x, z) > -1) continue;
      const r = 6 + rnd() * 6;
      A.place(parts, A.petal({ r, depth: 3, glow: 0x7ff0ff }), { x, y: 1.6, z });
      this._col({ type: 'cyl', x, z, r: r * 0.97, y0: -1, y1: 1.62 });
    }
    this._mesh(parts);
    this.markers.push({ id: p.id, x: cx, y: this._ground(cx, cz), z: cz });
  }

  update(dt, ctx) {
    this.t += dt;
    const t = this.t;
    for (const a of this.anims) a(t, dt);
    for (const P of this.pylons.values()) {
      if (P.waking) {
        P.k = Math.min(1, P.k + dt / 7);
        if (P.slot >= 0) this.world.atmos.setSilence(P.slot, P.x, P.z, P.silenceR, (1 - P.k) * P.silenceMax);
        if (P.k >= 1) P.waking = 0;
      }
      this._posePylon(P, t);
    }
    // 승강 기둥 진입
    const pl = ctx && ctx.player;
    if (pl && pl.state !== 'lift' && pl.state !== 'current') {
      for (const L of this.lifts) {
        const dx = pl.pos.x - L.x, dz = pl.pos.z - L.z;
        if (dx * dx + dz * dz < L.r * L.r && pl.pos.y < L.y0 + 6 && pl.pos.y > L.y0 - 2) { pl.enterLift(L); break; }
      }
    }
  }
}

