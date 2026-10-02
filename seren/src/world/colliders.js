// 구조물 충돌: 지형(높이 함수) 위에 원기둥·상자·경사로를 얹은 2.5D 충돌 세계.
// 모든 충돌체는 "윗면을 밟을 수 있고 옆면은 막히는" 기둥 형태입니다.
//   cyl  : {x, z, r, y0, y1, dome?}   (dome: 가장자리가 가운데보다 dome 만큼 낮은 둥근 윗면)
//   box  : {x, z, hx, hz, rot, y0, y1}          (rot = three.js 의 rotation.y 와 같은 값)
//   ramp : box + {y1b} — 로컬 x 축을 따라 윗면 높이가 y1 → y1b 로 변함
// 움직이는 충돌체는 obj(Object3D)를 붙이면 매 프레임 그 변환을 따라갑니다.
import { heightAt } from './heightfield.js';

const CELL = 64;

export class Colliders {
  constructor() {
    this.grid = new Map();
    this.dynamic = [];
    this.all = [];
    this._seen = 0;
  }

  _key(i, j) { return i * 100003 + j; }

  _bounds(c) {
    const r = c.type === 'cyl' ? c.r : Math.hypot(c.hx, c.hz);
    return [c.x - r, c.z - r, c.x + r, c.z + r];
  }

  add(c) {
    c.type = c.type || 'cyl';
    c.walk = c.walk !== false;
    c.solid = c.solid !== false;
    c._mark = 0;
    if (c.type !== 'cyl') { c.cos = Math.cos(c.rot || 0); c.sin = Math.sin(c.rot || 0); }
    this.all.push(c);
    if (c.obj) { this.dynamic.push(c); this._initDynamic(c); return c; }
    const [x0, z0, x1, z1] = this._bounds(c);
    for (let i = Math.floor(x0 / CELL); i <= Math.floor(x1 / CELL); i++) {
      for (let j = Math.floor(z0 / CELL); j <= Math.floor(z1 / CELL); j++) {
        const k = this._key(i, j);
        let arr = this.grid.get(k);
        if (!arr) { arr = []; this.grid.set(k, arr); }
        arr.push(c);
      }
    }
    return c;
  }

  remove(c) {
    const i = this.all.indexOf(c);
    if (i >= 0) this.all.splice(i, 1);
    const d = this.dynamic.indexOf(c);
    if (d >= 0) { this.dynamic.splice(d, 1); return; }
    for (const arr of this.grid.values()) {
      const k = arr.indexOf(c);
      if (k >= 0) arr.splice(k, 1);
    }
  }

  _initDynamic(c) {
    // 로컬 좌표 저장 (obj 기준)
    c.local = { x: c.x, z: c.z, y0: c.y0, y1: c.y1, rot: c.rot || 0, y1b: c.y1b };
    this.updateDynamic(c);
  }

  updateDynamic(c) {
    const o = c.obj;
    o.updateMatrixWorld();
    const e = o.matrixWorld.elements;
    const L = c.local;
    c.px = c.x; c.pz = c.z; c.py = c.y1;
    c.x = e[0] * L.x + e[8] * L.z + e[12];
    c.z = e[2] * L.x + e[10] * L.z + e[14];
    const oy = e[13];
    c.y0 = L.y0 + oy; c.y1 = L.y1 + oy;
    if (L.y1b !== undefined) c.y1b = L.y1b + oy;
    const yaw = Math.atan2(e[8], e[0]); // three.js rotation.y 와 같은 부호
    c.rotWorld = (L.rot || 0) + yaw;
    c.cos = Math.cos(c.rotWorld); c.sin = Math.sin(c.rotWorld);
    c.yaw = yaw;
    if (c.px === undefined) { c.px = c.x; c.pz = c.z; c.py = c.y1; }
    c.dyaw = c.pyaw === undefined ? 0 : yaw - c.pyaw;
    c.pyaw = yaw;
  }

  update() {
    for (const c of this.dynamic) this.updateDynamic(c);
  }

  /** (x,z) 근처의 충돌체 목록 */
  near(x, z, r = 2, out = []) {
    out.length = 0;
    this._seen++;
    const s = this._seen;
    for (let i = Math.floor((x - r) / CELL); i <= Math.floor((x + r) / CELL); i++) {
      for (let j = Math.floor((z - r) / CELL); j <= Math.floor((z + r) / CELL); j++) {
        const arr = this.grid.get(this._key(i, j));
        if (!arr) continue;
        for (const c of arr) if (c._mark !== s) { c._mark = s; out.push(c); }
      }
    }
    for (const c of this.dynamic) out.push(c);
    return out;
  }

  // 점이 충돌체의 수평 단면 안에 있는지 + 그 지점의 윗면 높이
  _topAt(c, x, z, pad) {
    if (c.type === 'cyl') {
      const dx = x - c.x, dz = z - c.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > (c.r + pad) * (c.r + pad)) return null;
      return c.dome ? c.y1 - c.dome * Math.min(1, d2 / (c.r * c.r)) : c.y1;
    }
    const dx = x - c.x, dz = z - c.z;
    const lx = dx * c.cos - dz * c.sin;
    const lz = dx * c.sin + dz * c.cos;
    if (Math.abs(lx) > c.hx + pad || Math.abs(lz) > c.hz + pad) return null;
    if (c.type === 'ramp') {
      const t = Math.min(1, Math.max(0, (lx + c.hx) / (2 * c.hx)));
      return c.y1 + (c.y1b - c.y1) * t;
    }
    return c.y1;
  }

  /**
   * 발 아래 지면: 지형과, y + step 이하에 윗면이 있는 충돌체 중 가장 높은 것
   * 반환: { h, c } (c = 밟고 있는 충돌체 또는 null)
   */
  ground(x, z, y, step = 0.6, pad = 0.2, out = { h: 0, c: null }) {
    let h = heightAt(x, z);
    let hit = null;
    const list = this.near(x, z, pad + 1, _list);
    for (const c of list) {
      if (!c.walk) continue;
      // 하늘 높이 있는 것(하늘닻 등)은 그 근처에서 찾을 때만 — "맨 위 땅"을 찾는 질의(y=1e5)에서는 빼기
      if (c.sky && Math.abs(y - c.y1) > 2000) continue;
      const top = this._topAt(c, x, z, pad);
      if (top === null) continue;
      if (top <= y + step && top > h) { h = top; hit = c; }
    }
    out.h = h; out.c = hit;
    return out;
  }

  /** 머리 위 천장 (y 위로 가장 낮은 충돌체 바닥) */
  ceiling(x, z, y, height) {
    let best = Infinity;
    const list = this.near(x, z, 1, _list);
    for (const c of list) {
      if (!c.solid) continue;
      if (this._topAt(c, x, z, 0) === null) continue;
      if (c.y0 >= y + 0.2 && c.y0 < best) best = c.y0;
    }
    return best;
  }

  /** 수평으로 겹친 충돌체 밖으로 밀어냄. pos 를 직접 수정하고 밀린 방향 법선을 반환 */
  pushOut(pos, radius, height, step = 0.6) {
    const list = this.near(pos.x, pos.z, radius + 2, _list);
    let hitN = null;
    for (const c of list) {
      if (!c.solid) continue;
      if (pos.y + height < c.y0 || pos.y + step >= this._maxTop(c)) continue;
      if (c.type === 'cyl') {
        const dx = pos.x - c.x, dz = pos.z - c.z;
        const d = Math.hypot(dx, dz);
        const min = c.r + radius;
        if (d < min) {
          // 윗면이 발 높이 근처면 넘어간다 (경사로·계단)
          if (c.walk && c.y1 <= pos.y + step) continue;
          const nx = d > 1e-4 ? dx / d : 1, nz = d > 1e-4 ? dz / d : 0;
          pos.x = c.x + nx * min; pos.z = c.z + nz * min;
          hitN = { x: nx, z: nz };
        }
      } else {
        const dx = pos.x - c.x, dz = pos.z - c.z;
        let lx = dx * c.cos - dz * c.sin;
        let lz = dx * c.sin + dz * c.cos;
        const ex = c.hx + radius, ez = c.hz + radius;
        if (Math.abs(lx) < ex && Math.abs(lz) < ez) {
          const top = this._topAt(c, pos.x, pos.z, radius);
          if (c.walk && top !== null && top <= pos.y + step) continue;
          const px = ex - Math.abs(lx), pz = ez - Math.abs(lz);
          let nlx = 0, nlz = 0;
          if (px < pz) { nlx = Math.sign(lx) || 1; lx = nlx * ex; } else { nlz = Math.sign(lz) || 1; lz = nlz * ez; }
          pos.x = c.x + lx * c.cos + lz * c.sin;
          pos.z = c.z - lx * c.sin + lz * c.cos;
          hitN = { x: nlx * c.cos + nlz * c.sin, z: -nlx * c.sin + nlz * c.cos };
        }
      }
    }
    return hitN;
  }

  _maxTop(c) { return c.type === 'ramp' ? Math.max(c.y1, c.y1b) : c.y1; }
}

const _list = [];
