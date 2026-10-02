// 쓰임이 있는 건물: 공방·서고·지도 방·쉼터·온실·음악당·소식탑·기상탑·선착장.
// 모든 시설은 「떠 있는 지붕의 열린 홀」 — 바깥에서 안이 보이고, 카메라가 벽에 막히지 않습니다.
// 종류마다 모양과 하는 일이 보이는 장치(불꽃 굴뚝, 자라는 식물, 소포를 나르는 일벌, 하늘로 쏘는 빛기둥…)가 있습니다.
// 기능(눌렀을 때 하는 일)은 game/services.js 에 있습니다.
import * as THREE from 'three';
import { heightAt } from './heightfield.js';
import { mulberry32 } from '../core/noise.js';
import { part, merge, xf, lathe } from './geo-utils.js';
import * as A from './arch.js';
import { litMaterial, glowMaterial } from './materials.js';
import { hologramMaterial } from './hologram.js';
import { skiffGeo, ferryGeo, boatMaterial } from './boats.js';
import { PointLights } from './lights.js';
import { PLACE } from '../data/places.js';
import { FACILITIES, FACILITY_TYPES } from '../data/facilities.js';
import { REGIONS } from './regions.js';

const PAL = A.PAL;
const RADIUS = { workshop: 13, library: 12, maproom: 12, rest: 10, greenhouse: 16, hall: 15, courier: 9, weather: 8, dock: 22 };

export class Facilities {
  constructor(world, structures) {
    this.world = world;
    this.structures = structures;
    this.scene = world.scene;
    this.mat = litMaterial({ vertexColors: true, vertexEmit: true, windows: true, emissive: 0xffffff, emissiveIntensity: 1.5, emissiveNight: 0.8, rim: 0.55, rimColor: 0xe8e0ff, spec: 0.8, side: THREE.DoubleSide, tech: { scale: 1.4, glow: 0.7, metal: 0.4, mode: 0 } });
    this.glass = litMaterial({ vertexColors: true, vertexEmit: true, emissive: 0xffffff, emissiveIntensity: 1.0, rim: 1.4, rimColor: 0xd8f8ff, spec: 1.6, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false });
    this.lights = new PointLights(this.scene, 400, { minPx: 1.6, day: 0.3 });
    this.list = [];
    this.byId = new Map();
    this.t = 0;
    for (const def of FACILITIES) {
      try { this._build(def); } catch (e) { console.warn('[facilities]', def.id, e); }
    }
  }

  _col(c) { return this.world.colliders.add(c); }

  // ── 자리 정하기 ─────────────────────────
  _origin(def) {
    let cx, cz;
    if (Array.isArray(def.at)) [cx, cz] = def.at;
    else { const p = PLACE[def.at]; [cx, cz] = p.pos; }
    let x = cx, z = cz;
    if (def.off) { x += def.off[0]; z += def.off[1]; }
    if (def.polar) { const a = (def.polar[0] * Math.PI) / 180; x = cx + Math.cos(a) * def.polar[1]; z = cz + Math.sin(a) * def.polar[1]; }
    if (def.toward) { const dx = def.toward[0] - cx, dz = def.toward[1] - cz, d = Math.hypot(dx, dz) || 1; x = cx + (dx / d) * def.dist; z = cz + (dz / d) * def.dist; }
    return { x, z, cx, cz };
  }

  /** 다른 구조물과 겹치는가 (바닥 높이에 가까운 넓은 광장은 괜찮다) */
  _blocked(x, z, R, floorY) {
    const list = this.world.colliders.near(x, z, R + 4);
    for (const c of list) {
      if (c.obj || c.sky) continue;
      if (c.y1 < floorY + 1.6 && c.walk) continue; // 낮은 바닥·광장
      if (c.y0 > floorY + 40) continue; // 높이 떠 있는 것
      let d;
      if (c.type === 'cyl') d = Math.hypot(x - c.x, z - c.z) - c.r;
      else { const dx = x - c.x, dz = z - c.z; const lx = Math.abs(dx * c.cos - dz * c.sin) - c.hx, lz = Math.abs(dx * c.sin + dz * c.cos) - c.hz; d = Math.hypot(Math.max(lx, 0), Math.max(lz, 0)); }
      if (d < R + 3) return true;
    }
    return false;
  }

  _floor(x, z, R) {
    let mx = -1e9, mn = 1e9;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const h = heightAt(x + Math.cos(a) * R * 0.9, z + Math.sin(a) * R * 0.9);
      mx = Math.max(mx, h); mn = Math.min(mn, h);
    }
    const c = heightAt(x, z);
    mx = Math.max(mx, c); mn = Math.min(mn, c);
    return { top: Math.max(mx, 0.8) + 0.4, low: Math.min(mn, 0) - 2 };
  }

  _build(def) {
    const type = FACILITY_TYPES[def.type];
    const R = RADIUS[def.type];
    const o = this._origin(def);
    let x = o.x, z = o.z;
    let fl = def.y !== undefined ? { top: def.y, low: def.y - 6 } : this._floor(x, z, R);
    if (def.y === undefined) {
      // 겹치면 나선으로 밀어 본다
      for (let k = 0; k < 48 && this._blocked(x, z, R, fl.top); k++) {
        const a = k * 2.4, d = 14 + k * 7;
        x = o.x + Math.cos(a) * d; z = o.z + Math.sin(a) * d;
        fl = this._floor(x, z, R);
      }
    }
    const y = fl.top;
    // 정면은 마을 가운데를 본다
    let yaw = Math.atan2(o.cx - x, o.cz - z);
    if (!isFinite(yaw) || Math.hypot(o.cx - x, o.cz - z) < 1) yaw = 0;
    const F = {
      id: def.id, def, type: def.type, info: type, name: def.name || type.name, x, y, z, yaw, R,
      group: new THREE.Group(), anim: [], extra: {}, region: this.world.regionAt(x, z)?.id,
    };
    F.group.position.set(x, y, z);
    F.group.rotation.y = yaw;
    this.scene.add(F.group);
    const parts = [], glass = [];
    // 받침 (경사진 땅을 덮는 기단)
    const base = Math.max(0.6, y - fl.low);
    parts.push(part(new THREE.CylinderGeometry(R + 0.4, R + 1.4, base, 32).translate(0, -base / 2, 0), 0xd8d2e2, 0));
    parts.push(part(xf(new THREE.RingGeometry(R - 0.8, R - 0.2, 40), { y: 0.03, rx: -Math.PI / 2 }), type.color, 1.3));
    parts.push(part(xf(new THREE.CircleGeometry(R - 0.8, 40), { y: 0.02, rx: -Math.PI / 2 }), 0xe8e2ee, 0));
    this['_' + def.type](F, parts, glass);
    // 간판: 시설 이름 글자 홀로그램 + 상징
    const tex = nameTexture(`${type.icon}  ${F.name}`);
    const sh = 1.5, sw = (sh * tex.image.width) / tex.image.height;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), hologramMaterial({ color: type.color, color2: 0xffffff, intensity: 1.6, scroll: 0, repeat: [1, 1], seed: F.id.length * 7, tex }));
    sign.material.side = THREE.FrontSide;
    sign.position.set(0, F.signY ?? 7.6, R + 0.4);
    // 뒷면(안쪽에서 볼 때)도 글자가 바로 읽히게 한 장 더
    const back = new THREE.Mesh(sign.geometry, sign.material);
    back.rotation.y = Math.PI;
    sign.add(back);
    F.group.add(sign);
    F.sign = sign;
    const m = new THREE.Mesh(merge(parts), this.mat);
    F.group.add(m);
    F.main = m;
    if (glass.length) F.group.add(new THREE.Mesh(merge(glass), this.glass));
    // 바닥 충돌 (기단)
    if (def.type !== 'dock') this._col({ type: 'cyl', x, z, r: R + 0.4, y0: fl.low - 2, y1: y, sky: y > 20000 });
    // 시설지기 자리 (세계 좌표)
    const ka = F.keeperLocal || [0, -R * 0.5];
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    F.keeper = { x: x + ka[0] * cs + ka[1] * sn, z: z - ka[0] * sn + ka[1] * cs, y: y + (F.keeperY || 0), yaw };
    this.lights.add(x + (R + 0.4) * sn, y + (F.signY ?? 7.6) + 1.6, z + (R + 0.4) * cs, type.color, 6, 0, 0);
    this.list.push(F);
    this.byId.set(F.id, F);
    this.structures.markers.push({ id: F.id, x, y, z });
  }

  // 공용: 기둥과 떠 있는 지붕 고리
  _pillars(F, parts, n, H, r, skipFront = true) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.PI / n;
      if (skipFront && Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))) < 0.5) continue;
      const px = Math.cos(a) * r, pz = Math.sin(a) * r;
      parts.push(part(xf(lathe([[0.7, 0], [0.45, 0.6], [0.38, H - 0.6], [0.6, H]], 8), { x: px, z: pz }), (x, y) => (y > H - 0.8 || y < 0.7 ? PAL.gold : 0xf0ecf4), 0));
      parts.push(part(xf(new THREE.BoxGeometry(0.12, H - 1.6, 0.12), { x: px * 1.04, y: H / 2, z: pz * 1.04 }), F.info.color, 1.2));
      this._col({ type: 'cyl', x: F.x + px * Math.cos(F.yaw) + pz * Math.sin(F.yaw), z: F.z - px * Math.sin(F.yaw) + pz * Math.cos(F.yaw), r: 0.6, y0: F.y, y1: F.y + H, walk: false });
    }
    parts.push(part(xf(new THREE.TorusGeometry(r, 0.12, 4, 48), { y: H + 0.7, rx: Math.PI / 2 }), F.info.color, 1.8));
  }

  // 공용: 뒤쪽 탁자 (시설지기가 선다)
  _counter(F, parts, z = -F.R * 0.38, w = 6) {
    parts.push(part(xf(new THREE.CylinderGeometry(w / 2, w / 2, 1.1, 20, 1, false, Math.PI * 0.75, Math.PI * 0.5), { y: 0.55, z: z + w / 2 - 0.6, ry: Math.PI }), 0xe6e0ee, 0));
    parts.push(part(xf(new THREE.TorusGeometry(w / 2, 0.06, 3, 20, Math.PI * 0.5), { y: 1.12, z: z + w / 2 - 0.6, rx: Math.PI / 2, rz: Math.PI * 0.25 }), F.info.color, 1.8));
    F.keeperLocal = [0, z - 1.2];
  }

  // 공용: 지붕 위 상징 (빛나는 모양, 천천히 돈다)
  _emblem(F, geo, y) {
    const m = new THREE.Mesh(geo, glowMaterial({ color: F.info.color, intensity: 1.6 }));
    m.position.y = y;
    F.group.add(m);
    F.anim.push((t) => { m.rotation.y = t * 0.5; });
    return m;
  }

  // ── 공방: 낮은 돔 + 불꽃 굴뚝 + 공명 모루 ──
  _workshop(F, parts) {
    const R = F.R, H = 5.5;
    this._pillars(F, parts, 8, H, R - 1.2);
    parts.push(part(xf(lathe([[R + 0.6, 0], [R, 1.4], [R * 0.75, 3.6], [R * 0.35, 5], [0.0001, 5.4]], 32), { y: H + 1.4 }), (x, y) => (y > H + 6.4 ? PAL.gold : 0xeee6dc), (x, y) => (y < H + 1.6 ? 1.0 : 0), R / 3.4));
    // 굴뚝 (공명 용광로)
    parts.push(part(xf(lathe([[2.4, 0], [1.8, 6], [1.5, 16], [2.0, 18]], 12), { x: -R * 0.55, z: -R * 0.45, y: 0 }), (x, y) => (y > 16 ? PAL.amber : 0xd8ccc0), (x, y) => (y > 16.5 ? 2 : 0)));
    // 공명 모루와 연장
    parts.push(part(xf(new THREE.CylinderGeometry(1.2, 1.6, 1.2, 12), { y: 0.6 }), 0x8a7a6a, 0));
    parts.push(part(xf(new THREE.TorusGeometry(1.0, 0.12, 4, 20), { y: 1.25, rx: Math.PI / 2 }), PAL.amber, 2));
    for (let i = 0; i < 4; i++) parts.push(part(xf(new THREE.BoxGeometry(0.2, 2.4, 1.4), { x: R * 0.55 * Math.cos(i * 0.4 + 2.2), y: 1.2, z: -R * 0.55 * Math.sin(i * 0.4 + 2.2), ry: i * 0.4 }), 0xbfb2a4, 0));
    this._counter(F, parts);
    // 떠다니는 부품
    const pg = merge([0, 1, 2, 3].map((i) => part(xf(new THREE.OctahedronGeometry(0.28, 0), { x: Math.cos(i * 1.57) * 1.8, z: Math.sin(i * 1.57) * 1.8, y: (i % 2) * 0.4 }), i % 2 ? PAL.amber : 0xbffcff, 1.6)));
    const parts3 = new THREE.Mesh(pg, this.mat);
    parts3.position.y = 2.2;
    F.group.add(parts3);
    F.anim.push((t) => { parts3.rotation.y = t * 0.9; parts3.position.y = 2.2 + Math.sin(t * 2) * 0.15; });
    // 굴뚝 불꽃
    this._sparks(F, new THREE.Vector3(-R * 0.55, 18.5, -R * 0.45), PAL.amber);
    this._emblem(F, new THREE.TorusGeometry(1.4, 0.3, 6, 16), H + 8.8);
    F.signY = H + 0.3;
  }

  // ── 서고: 높은 북 모양 2층 + 결정 책장 + 떠 있는 글자 ──
  _library(F, parts) {
    const R = F.R, H = 6;
    this._pillars(F, parts, 10, H, R - 1);
    parts.push(part(xf(new THREE.CylinderGeometry(R - 0.6, R, 7, 36, 1, true), { y: H + 4.5 }), 0xd8d4ec, 0, R / 3.4));
    parts.push(part(xf(lathe([[R + 0.4, 0], [R * 0.9, 1.2], [R * 0.5, 2.8], [0.0001, 3.4]], 32), { y: H + 8 }), (x, y) => (y > H + 10.8 ? PAL.gold : 0xe8e4f0), 0));
    parts.push(part(xf(new THREE.TorusGeometry(R - 0.3, 0.2, 4, 48), { y: H + 1.0, rx: Math.PI / 2 }), F.info.color, 1.8));
    // 결정 책장 (안쪽 뒤편 호)
    const rnd = mulberry32(F.id.length * 31);
    for (let i = 0; i < 18; i++) {
      const a = Math.PI * 1.2 + (i / 17) * Math.PI * 0.6;
      const r = R - 2.2, h = 3.6 + rnd() * 1.4;
      parts.push(part(xf(new THREE.BoxGeometry(0.9, h, 0.3), { x: Math.cos(a) * r, y: h / 2 + 0.1, z: Math.sin(a) * r, ry: -a + Math.PI / 2 }), [0xb9a6ff, 0xd8c8ff, 0x9fd8ff][i % 3], 0.35 + rnd() * 0.5));
    }
    // 읽는 탁자
    parts.push(part(xf(new THREE.CylinderGeometry(0.5, 0.8, 1.1, 10), { y: 0.55, z: 1.5 }), 0xe6e0ee, 0));
    parts.push(part(xf(new THREE.BoxGeometry(1.6, 0.1, 1.0), { y: 1.15, z: 1.5, rx: -0.3 }), F.info.color, 1.2));
    this._counter(F, parts, -R * 0.3, 5);
    // 떠서 도는 글자 띠
    const holo = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 1.1, 32, 1, true), hologramMaterial({ color: F.info.color, color2: 0xffffff, intensity: 1.4, scroll: 0.04, repeat: [1, 1], seed: 77 }));
    holo.position.set(0, 2.8, 1.5);
    F.group.add(holo);
    // 지붕 둘레의 떠 있는 판 (책)
    const tg = merge(Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2; return part(xf(new THREE.BoxGeometry(1.4, 2.0, 0.15), { x: Math.cos(a) * (R + 2), z: Math.sin(a) * (R + 2), ry: -a }), 0xd8c8ff, 0.8); }));
    const tabs = new THREE.Mesh(tg, this.mat);
    tabs.position.y = H + 6;
    F.group.add(tabs);
    F.anim.push((t) => { tabs.rotation.y = t * 0.08; });
    F.signY = H - 0.4;
    this._emblem(F, new THREE.BoxGeometry(1.6, 2.2, 0.4), H + 13.5);
  }

  // ── 별지도 방: 유리 돔 + 세계의 축소 홀로그램 ──
  _maproom(F, parts, glass) {
    const R = F.R, H = 5;
    this._pillars(F, parts, 6, H, R - 1);
    // 유리 돔과 갈비
    glass.push(part(xf(new THREE.SphereGeometry(R, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), { y: H + 0.8, sy: 0.7 }), 0xbfe8ff, 0.05));
    for (let i = 0; i < 6; i++) parts.push(part(xf(new THREE.TorusGeometry(R, 0.15, 4, 24, Math.PI), { y: H + 0.8, ry: (i / 6) * Math.PI, sy: 0.7 }), PAL.gold, 0.4));
    // 지도 탁자
    parts.push(part(xf(new THREE.CylinderGeometry(3.6, 4.2, 1.0, 32), { y: 0.5 }), 0xe6e0ee, 0));
    parts.push(part(xf(new THREE.TorusGeometry(3.6, 0.08, 3, 40), { y: 1.02, rx: Math.PI / 2 }), F.info.color, 2));
    this._counter(F, parts, -R * 0.62, 5);
    // 축소 지형 (하늘닻에서는 세계 전체, 다른 곳은 둘레 14 km)
    const span = F.def.world ? 60000 : 14000;
    const N = 44;
    const g = new THREE.PlaneGeometry(6.4, 6.4, N, N);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    const col = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    const cx = F.def.world ? 0 : F.x, cz = F.def.world ? 0 : F.z;
    for (let i = 0; i < pos.count; i++) {
      const lx = pos.getX(i), lz = pos.getZ(i);
      const wx = cx + (lx / 3.2) * span, wz = cz + (lz / 3.2) * span;
      const h = heightAt(wx, wz, 0);
      const inCircle = Math.hypot(lx, lz) < 3.2;
      pos.setY(i, inCircle ? Math.max(0, h) * (F.def.world ? 0.00045 : 0.0011) : 0);
      if (!inCircle) c.setRGB(0, 0, 0);
      else if (h < 0) c.setRGB(0.05, 0.25, 0.45);
      else { const reg = REGIONS[this.world.regionAt(wx, wz) ? REGIONS.indexOf(this.world.regionAt(wx, wz)) : 0]; c.set(reg ? reg.pal.glow : 0x7ff3e6).multiplyScalar(0.35 + Math.min(1, h / 1500) * 0.6); }
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    const mapMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const mini = new THREE.Mesh(g, mapMat);
    mini.position.y = 1.15;
    F.group.add(mini);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.05, 3, 64), glowMaterial({ color: F.info.color, intensity: 1.6 }));
    ring.position.y = 1.8;
    F.group.add(ring);
    F.anim.push((t) => { ring.rotation.set(Math.PI / 2 + Math.sin(t * 0.5) * 0.2, t * 0.3, 0); });
    // 바깥: 나침반 돛대
    parts.push(part(xf(lathe([[0.5, 0], [0.3, 12], [0.0001, 14]], 8), { x: R * 0.8, z: -R * 0.5 }), 0xe8e4ee, (x, y) => (y > 13 ? 1.5 : 0)));
    F.signY = H - 0.4;
    this._emblem(F, new THREE.TorusGeometry(1.3, 0.12, 4, 24), H + 9.5);
  }

  // ── 쉼터: 따뜻한 양파 돔 + 잠자리 + 등불 ──
  _rest(F, parts) {
    const R = F.R, H = 4.2;
    this._pillars(F, parts, 6, H, R - 1);
    parts.push(part(xf(lathe([[R + 0.4, 0], [R * 1.02, 1.2], [R * 0.8, 3.6], [R * 0.4, 5.4], [0.6, 6.6], [0.0001, 7.4]], 28), { y: H + 1.2 }), (x, y) => (y > H + 7.4 ? PAL.gold : 0xf2e4d0), (x, y) => (y < H + 1.4 ? 1.2 : 0)));
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; parts.push(part(xf(new THREE.CircleGeometry(0.6, 12), { x: Math.cos(a) * R * 0.92, y: H + 3.0, z: Math.sin(a) * R * 0.92, ry: -a + Math.PI / 2 }), PAL.amber, 1.6)); }
    // 잠자리 셋
    for (let i = 0; i < 3; i++) {
      const a = Math.PI * 1.25 + i * 0.5;
      const px = Math.cos(a) * R * 0.55, pz = Math.sin(a) * R * 0.55;
      parts.push(part(xf(lathe([[0.0001, 0], [1.1, 0.1], [1.2, 0.6], [0.9, 0.9]], 14), { x: px, z: pz, sz: 2.0, ry: -a }), 0xe8dccc, 0));
      parts.push(part(xf(new THREE.BoxGeometry(1.8, 0.2, 3.6), { x: px, y: 0.6, z: pz, ry: -a + Math.PI / 2 }), 0xc8a0b8, 0.15));
    }
    // 화롯불
    parts.push(part(xf(new THREE.CylinderGeometry(0.9, 1.1, 0.5, 12), { y: 0.25, z: 1.0 }), 0x8a7a6a, 0));
    const fire = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), glowMaterial({ color: 0xffb060, intensity: 2.2 }));
    fire.position.set(0, 1.0, 1.0);
    F.group.add(fire);
    F.anim.push((t) => { const k = 1 + Math.sin(t * 7) * 0.08 + Math.sin(t * 13) * 0.05; fire.scale.set(k, k * 1.3, k); });
    this._counter(F, parts, -R * 0.42, 4);
    // 길가의 등불 기둥 (멀리서도 보이는 따뜻한 빛)
    parts.push(part(xf(lathe([[0.3, 0], [0.18, 6], [0.4, 6.2]], 6), { x: R + 2, z: R * 0.4 }), 0x6a5a50, 0));
    this.lights.add(F.x + (R + 2) * Math.cos(F.yaw) + R * 0.4 * Math.sin(F.yaw), F.y + 6.6, F.z - (R + 2) * Math.sin(F.yaw) + R * 0.4 * Math.cos(F.yaw), 0xffb060, 10, 0, 0);
    F.signY = H - 0.3;
    this._emblem(F, new THREE.TorusGeometry(1.0, 0.35, 6, 16, Math.PI * 1.4), H + 10.5);
  }

  // ── 온실: 유리 둥근 지붕 + 밭 셋 (심은 것이 자란다) ──
  _greenhouse(F, parts, glass) {
    const R = F.R, L = R * 1.7, W = R * 0.75;
    glass.push(part(xf(new THREE.CylinderGeometry(W, W, L, 24, 1, true, 0, Math.PI), { y: 0.2, rz: Math.PI / 2, ry: Math.PI / 2 }), 0xc8f0e0, 0.05));
    for (let i = 0; i <= 6; i++) parts.push(part(xf(new THREE.TorusGeometry(W, 0.14, 4, 20, Math.PI), { z: -L / 2 + (i / 6) * L }), PAL.gold, 0.3));
    parts.push(part(xf(new THREE.BoxGeometry(0.14, 0.14, L), { y: W }), PAL.gold, 0.3));
    // 밭 셋
    F.plots = [];
    for (let i = 0; i < 3; i++) {
      const pz = -L * 0.3 + i * L * 0.3;
      parts.push(part(xf(new THREE.BoxGeometry(W * 1.1, 0.6, L * 0.22), { y: 0.3, z: pz }), 0xd8d0e6, 0));
      parts.push(part(xf(new THREE.BoxGeometry(W * 1.0, 0.1, L * 0.2), { y: 0.62, z: pz }), 0x4a3d2e, 0));
      F.plots.push({ lx: 0, lz: pz });
    }
    // 자라는 것 (밭마다 빛나는 꽃 무리, 크기가 바뀐다)
    const fr = mulberry32(F.id.length * 13 + 5);
    const flower = merge(Array.from({ length: 18 }, (_, k) => {
      const x = (fr() - 0.5) * W * 0.9, z = (fr() - 0.5) * L * 0.17, h = 0.9 + fr() * 1.4, r = 0.3 + fr() * 0.22;
      const col = [0x6dfcd0, 0xffb8e8, 0xffd27a, 0xb9a6ff][k % 4];
      return [
        part(xf(new THREE.CylinderGeometry(0.05, 0.08, h, 4), { x, y: h / 2, z }), 0x2f6a58, 0),
        part(xf(new THREE.ConeGeometry(0.35, 0.5, 4), { x: x + 0.15, y: h * 0.45, z, rz: -0.9 }), 0x3f8a6a, 0.2),
        part(xf(new THREE.IcosahedronGeometry(r, 0), { x, y: h + r * 0.6, z, sy: 1.3 }), col, 2.0),
        part(xf(new THREE.TorusGeometry(r * 1.4, 0.04, 3, 10), { x, y: h + r * 0.4, z, rx: Math.PI / 2 }), col, 1.4),
      ];
    }).flat());
    F.plants = F.plots.map((pl) => {
      const m = new THREE.Mesh(flower, this.mat);
      m.position.set(pl.lx, 0.65, pl.lz);
      m.scale.setScalar(0.001);
      F.group.add(m);
      return m;
    });
    F.keeperLocal = [W + 1.6, L * 0.35];
    F.signY = W + 1.2;
    this._emblem(F, new THREE.OctahedronGeometry(0.9, 0), W + 3.6);
  }

  // ── 음악당: 조개껍데기 지붕 + 무대 + 계단 객석 ──
  _hall(F, parts) {
    const R = F.R;
    // 껍데기 (뒤쪽 반구를 기울여)
    parts.push(part(xf(new THREE.SphereGeometry(R * 0.9, 28, 14, Math.PI, Math.PI, 0, Math.PI / 2), { z: -R * 0.2, sy: 0.85 }), (x, y) => (y > R * 0.55 ? 0xe8c8dc : 0xdccbe2), (x, y, z) => (Math.abs(((y * 1.5) % 3) - 1.5) < 0.12 ? 1.2 : 0)));
    for (let i = 0; i < 5; i++) parts.push(part(xf(new THREE.TorusGeometry(R * (0.45 + i * 0.1), 0.12, 4, 32, Math.PI), { z: -R * 0.2 + 0.2, y: 0.1, sy: 0.85 }), F.info.color, 1.4));
    // 무대
    parts.push(part(xf(new THREE.CylinderGeometry(R * 0.55, R * 0.58, 0.8, 32, 1, false, Math.PI / 2, Math.PI), { y: 0.4, z: -R * 0.2 }), 0xe6e0ee, 0));
    // 객석 (앞쪽 반원 계단)
    for (let k = 0; k < 3; k++) {
      const rr = R * (0.72 + k * 0.1);
      parts.push(part(xf(new THREE.CylinderGeometry(rr + 0.8, rr + 0.8, 0.5 + k * 0.5, 32, 1, true, -Math.PI / 2, Math.PI), { y: (0.5 + k * 0.5) / 2 }), 0xd8d0e6, 0));
    }
    // 위로 퍼지는 소리 고리
    const rings = [0, 1, 2].map((i) => {
      const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 3, 40), glowMaterial({ color: F.info.color, intensity: 1.2 }));
      m.rotation.x = Math.PI / 2;
      F.group.add(m);
      return m;
    });
    F.extra = { choir: 0, phase: 0 };
    F.anim.push((t, dt) => {
      // 합창 중이면 고리가 빨라지고 밝아진다
      const c = F.extra.choir = Math.max(0, F.extra.choir - dt * 0.08);
      F.extra.phase += dt * (0.35 + c * 1.2);
      rings.forEach((m, i) => { const k = (F.extra.phase + i / 3) % 1; m.position.set(0, R * 0.8 + k * (8 + c * 14), -R * 0.2); m.scale.setScalar(2 + k * (8 + c * 10)); m.material.uniforms.uIntensity.value = (1 - k) * (1.4 + c * 2.5); });
    });
    F.keeperLocal = [0, -R * 0.35];
    F.keeperY = 0.8;
    F.signY = R * 0.85;
    F.choirLocal = [-R * 0.3, -R * 0.35];
  }

  // ── 소식탑: 소포 입구가 둘린 탑 + 날아가는 일벌 ──
  _courier(F, parts) {
    const R = F.R, H = 44;
    parts.push(part(lathe([[R * 0.6, 0], [R * 0.5, 4], [2.6, 10], [2.2, H - 6], [3.6, H - 3], [3.6, H], [1.8, H + 3], [0.0001, H + 6]], 16), (x, y) => (y > H - 3.5 && y < H + 0.2 ? 0xb9c9d6 : y > H + 2 ? PAL.gold : 0xeceaf2), (x, y) => (y > H + 5 ? 1.6 : 0), 3.6 / 3.4));
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; parts.push(part(xf(new THREE.BoxGeometry(1.0, 1.0, 0.3), { x: Math.cos(a) * 3.65, y: H - 1.5, z: Math.sin(a) * 3.65, ry: -a + Math.PI / 2 }), F.info.color, 1.8)); }
    // 아래 창구
    parts.push(part(xf(lathe([[R, 0], [R * 0.95, 0.4], [R * 0.6, 1.0], [0.0001, 1.2]], 24), { y: 4.2 }), 0xf2eef6, 0));
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.3; parts.push(part(xf(new THREE.CylinderGeometry(0.25, 0.25, 4.2, 6), { x: Math.cos(a) * (R - 1), y: 2.1, z: Math.sin(a) * (R - 1) }), PAL.gold, 0)); }
    parts.push(part(xf(new THREE.BoxGeometry(4, 1.1, 0.8), { y: 0.55, z: -R * 0.35 + 2.4 }), 0xe6e0ee, 0));
    F.keeperLocal = [0, -R * 0.35 + 0.8];
    this._col({ type: 'cyl', x: F.x, z: F.z, r: 2.8, y0: F.y + 6, y1: F.y + H, walk: false });
    // 소포 일벌
    F.parcels = Array.from({ length: 5 }, (_, i) => ({ t: i * 1.7, dir: Math.random() * Math.PI * 2, light: this.lights.add(0, -1e5, 0, i % 2 ? 0xffd27a : 0x9ff6ff, 3, 0, 0) }));
    F.signY = 5.6;
    F.topY = H;
  }

  // ── 기상탑: 가는 탑 + 하늘을 비추는 구슬 ──
  _weather(F, parts) {
    const R = F.R, H = 86;
    parts.push(part(lathe([[R * 0.7, 0], [R * 0.5, 3], [1.6, 12], [1.0, H - 8], [1.6, H - 4], [0.6, H]], 12), (x, y) => (y > H - 5 ? PAL.gold : 0xe8ecf6), 0));
    for (let y = 16; y < H - 10; y += 14) parts.push(part(xf(new THREE.TorusGeometry(1.4, 0.15, 3, 16), { y, rx: Math.PI / 2 }), F.info.color, 1.6));
    parts.push(part(xf(lathe([[R, 0], [R * 0.9, 0.5], [R * 0.5, 1.4], [0.0001, 1.6]], 20), { y: 4.0 }), 0xf2eef6, 0));
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 + 0.3; parts.push(part(xf(new THREE.CylinderGeometry(0.22, 0.22, 4.0, 6), { x: Math.cos(a) * (R - 0.8), y: 2.0, z: Math.sin(a) * (R - 0.8) }), PAL.gold, 0)); }
    parts.push(part(xf(new THREE.BoxGeometry(3, 1.1, 0.8), { y: 0.55, z: -R * 0.3 + 2.2 }), 0xe6e0ee, 0));
    F.keeperLocal = [0, -R * 0.3 + 0.8];
    this._col({ type: 'cyl', x: F.x, z: F.z, r: 1.8, y0: F.y + 5, y1: F.y + H, walk: false });
    // 하늘 구슬: 고른 하늘의 색
    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(5, 2), litMaterial({ color: 0xf2f6ff, emissive: F.info.color, emissiveIntensity: 0.8, emissiveNight: 0.5, rim: 1.6, rimColor: 0xffffff, spec: 2 }));
    orb.position.y = H + 8;
    F.group.add(orb);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(8, 0.2, 4, 48), glowMaterial({ color: F.info.color, intensity: 1.4 }));
    halo.position.y = H + 8;
    F.group.add(halo);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 4, 3000, 12, 1, true).translate(0, 1500, 0), glowMaterial({ color: 0xbfe0ff, intensity: 0, fresnel: 0.6, side: THREE.DoubleSide }));
    beam.position.y = H + 8;
    beam.visible = false;
    F.group.add(beam);
    F.extra = { orb, halo, beam, beamT: 0 };
    F.anim.push((t, dt) => {
      orb.position.y = H + 8 + Math.sin(t * 0.7) * 0.6;
      halo.rotation.set(Math.PI / 2 + Math.sin(t * 0.4) * 0.3, t * 0.3, 0);
      if (F.extra.beamT > 0) {
        F.extra.beamT -= dt;
        beam.visible = true;
        beam.material.uniforms.uIntensity.value = Math.min(1, F.extra.beamT) * 0.9;
      } else beam.visible = false;
    });
    F.signY = 5.4;
    F.topY = H + 8;
  }

  // ── 선착장: 기둥 위 착륙대 + 경사로 + 빌려 탈 수 있는 나룻배 ──
  _dock(F, parts) {
    const R = F.R, PH = 8;
    parts.push(part(xf(new THREE.CylinderGeometry(R, R * 0.92, 1.6, 40), { y: PH - 0.8 }), 0xe4dfec, 0));
    parts.push(part(xf(new THREE.RingGeometry(R * 0.55, R * 0.6, 40), { y: PH + 0.03, rx: -Math.PI / 2 }), F.info.color, 1.6));
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; parts.push(part(xf(new THREE.BoxGeometry(R * 0.3, 0.04, 0.5), { x: Math.cos(a) * R * 0.8, y: PH + 0.03, z: Math.sin(a) * R * 0.8, ry: -a }), F.info.color, 1.2)); }
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.3; parts.push(part(xf(lathe([[1.4, -30], [1.1, 0], [0.9, PH - 1.4]], 8), { x: Math.cos(a) * R * 0.7, z: Math.sin(a) * R * 0.7 }), 0xd8d2e2, 0)); }
    // 경사로 (앞쪽 땅으로)
    const rampL = 26;
    const ramp = part(new THREE.BoxGeometry(4, 0.6, rampL), 0xe4dfec, 0);
    const pa = ramp.attributes.position;
    for (let i = 0; i < pa.count; i++) pa.setY(i, pa.getY(i) + (pa.getZ(i) / rampL + 0.5) * -PH + PH);
    ramp.computeVertexNormals();
    parts.push(xf(ramp, { z: R + rampL / 2 - 1 }));
    // 창구와 시설지기
    parts.push(part(xf(new THREE.BoxGeometry(4, 1.1, 0.8), { y: PH + 0.55, z: -R * 0.55 }), 0xe6e0ee, 0));
    parts.push(part(xf(lathe([[2.6, 0], [2.2, 3], [0.0001, 4]], 12), { y: PH + 3.0, z: -R * 0.6 }), 0xf2eef6, 0));
    for (const s of [-1, 1]) parts.push(part(xf(new THREE.CylinderGeometry(0.15, 0.15, 3, 6), { x: s * 2, y: PH + 1.5, z: -R * 0.6 }), PAL.gold, 0));
    F.keeperLocal = [0, -R * 0.55 - 1.2];
    F.keeperY = PH;
    // 충돌: 착륙대 + 경사로
    const cs = Math.cos(F.yaw), sn = Math.sin(F.yaw);
    this._col({ type: 'cyl', x: F.x, z: F.z, r: R, y0: F.y + PH - 3, y1: F.y + PH });
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.3; const lx = Math.cos(a) * R * 0.7, lz = Math.sin(a) * R * 0.7; this._col({ type: 'cyl', x: F.x + lx * cs + lz * sn, z: F.z - lx * sn + lz * cs, r: 1.3, y0: F.y - 30, y1: F.y + PH - 3, walk: false }); }
    const rz = R + rampL / 2 - 1;
    this._col({ type: 'ramp', x: F.x + rz * sn, z: F.z + rz * cs, hx: rampL / 2, hz: 2, rot: F.yaw + Math.PI / 2, y0: F.y - 4, y1: F.y + PH, y1b: F.y + 0.3 });
    this._col({ type: 'cyl', x: F.x, z: F.z, r: R * 0.3, y0: F.y - 30, y1: F.y + 0.4 });
    // 빌려 탈 나룻배 (착륙대 위에 떠 있다)
    F.padLocal = [0, PH + 2.2, 0];
    F.padY = PH;
    const ferry = new THREE.Mesh(ferryGeo(), boatMaterial());
    ferry.position.set(0, PH + 2.2, 0);
    F.group.add(ferry);
    const skiff = new THREE.Mesh(skiffGeo(), boatMaterial());
    skiff.position.set(R * 0.62, PH + 0.9, R * 0.15);
    skiff.rotation.y = 0.5;
    F.group.add(skiff);
    F.ferry = ferry;
    F.skiffMesh = skiff;
    F.anim.push((t) => {
      ferry.position.y = PH + 2.2 + Math.sin(t * 0.8 + F.x) * 0.25;
      ferry.rotation.z = Math.sin(t * 0.6 + F.z) * 0.02;
      skiff.position.y = PH + 0.9 + Math.sin(t * 1.3) * 0.12;
    });
    F.signY = PH + 4.6;
    F.keeperRide = true;
    this.lights.add(F.x, F.y + PH + 0.5, F.z, F.info.color, 10, 1.0, 0);
  }

  _sparks(F, at, color) {
    const n = 30;
    const pos = new Float32Array(n * 3);
    const seeds = Array.from({ length: n }, () => [Math.random() - 0.5, Math.random() - 0.5, Math.random()]);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ color, size: 0.35, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    pts.position.copy(at);
    F.group.add(pts);
    F.anim.push((t, dt) => {
      for (let i = 0; i < n; i++) {
        seeds[i][2] += dt * 0.5;
        if (seeds[i][2] > 1) seeds[i][2] -= 1;
        const k = seeds[i][2];
        pos[i * 3] = seeds[i][0] * (0.5 + k * 3);
        pos[i * 3 + 1] = k * 9;
        pos[i * 3 + 2] = seeds[i][1] * (0.5 + k * 3);
      }
      g.attributes.position.needsUpdate = true;
    });
  }

  /** 시설의 지역 좌표 → 세계 좌표 */
  toWorld(F, lx, ly, lz, out = new THREE.Vector3()) {
    const cs = Math.cos(F.yaw), sn = Math.sin(F.yaw);
    return out.set(F.x + lx * cs + lz * sn, F.y + ly, F.z - lx * sn + lz * cs);
  }

  update(dt, ctx) {
    this.t += dt;
    const cam = ctx && ctx.game ? ctx.game.engine.camera.position : null;
    // 멀리 있는 시설은 숨긴다 (그리기 횟수) — 44곳 거리 계산뿐이라 매 프레임
    if (cam) {
      for (const F of this.list) {
        const d = Math.hypot(cam.x - F.x, cam.z - F.z, (cam.y - F.y) * 0.5);
        F.group.visible = d < 4500;
        F.near = d < 2500;
        // 1.4 km 밖에서는 합친 본체만 (움직이는 장치·유리·배는 가까이서만)
        const detail = d < 1400;
        if (detail !== F.detail) { F.detail = detail; for (const c of F.group.children) if (c !== F.main) c.visible = detail && !c.userData.away; }
        F.sign.visible = d < 900;
      }
    }
    for (const F of this.list) {
      if (!F.group.visible) continue;
      for (const f of F.anim) f(this.t, dt);
      if (F.parcels) this._parcels(F, dt);
    }
    this.lights.update();
  }

  _parcels(F, dt) {
    for (const p of F.parcels) {
      p.t += dt;
      const T = 9;
      if (p.t > T) { p.t -= T; p.dir = Math.random() * Math.PI * 2; }
      if (!F.near) { this.lights.set(p.light, 0, -1e5, 0); continue; }
      const k = p.t / T;
      const out = k < 0.5; // 앞 절반은 나가고, 뒤 절반은 돌아온다 (다른 방향에서)
      const kk = out ? k * 2 : (1 - k) * 2;
      const a = out ? p.dir : p.dir + 2.2;
      const r = kk * 900;
      const lx = Math.cos(a) * r, lz = Math.sin(a) * r;
      this.lights.set(p.light, F.x + lx, F.y + F.topY - 1.5 + kk * 120, F.z + lz);
    }
  }
}

const _nameTex = new Map();
/** 간판 글자 (흰 글자 → 홀로그램 재질이 색을 입힌다) */
function nameTexture(text) {
  if (_nameTex.has(text)) return _nameTex.get(text);
  const H = 128;
  const cv = document.createElement('canvas');
  const g = cv.getContext('2d');
  const font = `600 ${H * 0.5}px 'Noto Serif KR', 'Noto Sans KR', 'Apple SD Gothic Neo', 'Malgun Gothic', serif`;
  g.font = font;
  const w = Math.ceil(g.measureText(text).width + H * 0.8);
  cv.width = Math.min(2048, w);
  cv.height = H;
  g.font = font;
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, cv.width / 2, H * 0.52);
  g.globalAlpha = 0.5;
  g.fillRect(H * 0.3, H * 0.86, cv.width - H * 0.6, 2);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 4;
  tex.colorSpace = THREE.NoColorSpace;
  _nameTex.set(text, tex);
  return tex;
}
