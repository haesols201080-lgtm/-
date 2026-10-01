// 절차적 모델링 도우미: 부품(색·발광 지정)을 하나의 지오메트리로 합칩니다.
import * as THREE from 'three';

const _c = new THREE.Color();

/** 지오메트리에 색과 발광 값을 입힌 부품 */
export function part(geo, color = 0xffffff, emit = 0) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  if (!g.attributes.normal) g.computeVertexNormals();
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  const em = new Float32Array(n);
  if (typeof color === 'function') {
    const p = g.attributes.position;
    for (let i = 0; i < n; i++) {
      const c = color(p.getX(i), p.getY(i), p.getZ(i));
      _c.set(c);
      col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b;
      em[i] = typeof emit === 'function' ? emit(p.getX(i), p.getY(i), p.getZ(i)) : emit;
    }
  } else {
    _c.set(color);
    for (let i = 0; i < n; i++) {
      col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b;
      em[i] = typeof emit === 'function' ? emit(g.attributes.position.getX(i), g.attributes.position.getY(i), g.attributes.position.getZ(i)) : emit;
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('emit', new THREE.BufferAttribute(em, 1));
  return g;
}

/** 부품들을 하나로 (모두 비인덱스, position/normal/color/emit) */
export function merge(parts) {
  let n = 0;
  for (const p of parts) n += p.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3), em = new Float32Array(n);
  let o = 0;
  for (const p of parts) {
    const c = p.attributes.position.count;
    pos.set(p.attributes.position.array, o * 3);
    nor.set(p.attributes.normal.array, o * 3);
    col.set(p.attributes.color.array, o * 3);
    em.set(p.attributes.emit.array, o);
    o += c;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('emit', new THREE.BufferAttribute(em, 1));
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return g;
}

/** 변환을 적용한 복제 */
export function xf(geo, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, s } = {}) {
  const g = geo.clone();
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(s ?? sx, s ?? sy, s ?? sz),
  );
  g.applyMatrix4(m);
  return g;
}

/** 회전체: [[r, y], ...] 윤곽 → LatheGeometry */
export function lathe(profile, segs = 12) {
  return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(0.0001, r), y)), segs);
}

/** 곡선을 따라가는 관 (반지름 함수 가능) */
export function tube(points, radius = 0.1, radial = 6, segs = 12, radiusFn = null) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => (p.isVector3 ? p : new THREE.Vector3(...p))));
  const geo = new THREE.TubeGeometry(curve, segs, radius, radial, false);
  if (radiusFn) {
    // 반지름을 길이 방향으로 변화
    const pos = geo.attributes.position;
    const frames = curve.computeFrenetFrames(segs, false);
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const c = curve.getPointAt(t);
      const k = radiusFn(t);
      for (let j = 0; j <= radial; j++) {
        const idx = i * (radial + 1) + j;
        pos.setXYZ(idx, c.x + (pos.getX(idx) - c.x) * k, c.y + (pos.getY(idx) - c.y) * k, c.z + (pos.getZ(idx) - c.z) * k);
      }
    }
    geo.computeVertexNormals();
  }
  return geo;
}

/** 정점을 노이즈로 흔들어 자연스럽게 */
export function jitter(geo, amount, seed = 1) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const p = g.attributes.position;
  const key = (x, y, z) => `${Math.round(x * 100)},${Math.round(y * 100)},${Math.round(z * 100)}`;
  const offs = new Map();
  let s = seed * 9301 + 49297;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280 - 0.5; };
  for (let i = 0; i < p.count; i++) {
    const k = key(p.getX(i), p.getY(i), p.getZ(i));
    let o = offs.get(k);
    if (!o) { o = [rnd() * amount, rnd() * amount, rnd() * amount]; offs.set(k, o); }
    p.setXYZ(i, p.getX(i) + o[0], p.getY(i) + o[1], p.getZ(i) + o[2]);
  }
  g.computeVertexNormals();
  return g;
}
