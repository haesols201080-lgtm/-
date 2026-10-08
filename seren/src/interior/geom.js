// 실내 모양 쌓개 (v0.9): 위치·법선·색·빛·무늬를 한 버퍼에 모아 층마다 그리기 몇 번으로.
import * as THREE from 'three';

const _c = new THREE.Color();
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
const _n = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _cc = new THREE.Vector3();

export class GB {
  constructor() { this.P = []; this.N = []; this.C = []; this.E = []; this.T = []; }
  get count() { return this.P.length / 3; }
  _v(x, y, z, nx, ny, nz, col, emit, pat, prm) {
    this.P.push(x, y, z); this.N.push(nx, ny, nz); this.C.push(col.r, col.g, col.b); this.E.push(emit); this.T.push(pat, prm);
  }
  /** 삼각형 (법선은 감는 순서에서) */
  tri(a, b, c, color, emit = 0, pat = 0, prm = 0) {
    _c.set(color);
    _a.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); _b.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
    _n.crossVectors(_a, _b).normalize();
    for (const v of [a, b, c]) this._v(v[0], v[1], v[2], _n.x, _n.y, _n.z, _c, emit, pat, prm);
  }
  quad(a, b, c, d, color, emit = 0, pat = 0, prm = 0) { this.tri(a, b, c, color, emit, pat, prm); this.tri(a, c, d, color, emit, pat, prm); }
  /** 꼭짓점마다 색이 다른 사각형 (빛 없는 어둠의 깊이 따위 — 색 띠) */
  quadc(a, b, c, d, ca, cb, cc, cd) {
    _a.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); _b.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
    _n.crossVectors(_a, _b).normalize();
    const nx = _n.x, ny = _n.y, nz = _n.z;
    const put = (v, col) => { _c.set(col); this._v(v[0], v[1], v[2], nx, ny, nz, _c, 0, 0, 0); };
    put(a, ca); put(b, cb); put(c, cc); put(a, ca); put(c, cc); put(d, cd);
  }
  /** 바닥(위를 보는) 사각형 */
  floorRect(x0, z0, x1, z1, y, color, emit = 0, pat = 0, prm = 0) { this.quad([x0, y, z0], [x0, y, z1], [x1, y, z1], [x1, y, z0], color, emit, pat, prm); }
  /** 천장(아래를 보는) 사각형 */
  ceilRect(x0, z0, x1, z1, y, color, emit = 0, pat = 0, prm = 0) { this.quad([x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], color, emit, pat, prm); }
  /** 세로 벽 띠 (x0,z0)→(x1,z1), y0..y1, 법선은 왼쪽(진행 방향의 왼쪽) — two: 양면 */
  wall(x0, z0, x1, z1, y0, y1, color, emit = 0, pat = 0, prm = 0, two = false) {
    this.quad([x0, y0, z0], [x1, y0, z1], [x1, y1, z1], [x0, y1, z0], color, emit, pat, prm);
    if (two) this.quad([x1, y0, z1], [x0, y0, z0], [x0, y1, z0], [x1, y1, z1], color, emit, pat, prm);
  }
  /** three 지오메트리를 옮겨서 넣기 (색·빛·무늬 하나) */
  geo(g, x, y, z, ry = 0, color = 0xffffff, emit = 0, pat = 0, prm = 0, sx = 1, sy = 1, sz = 1) {
    const src = g.index ? g.toNonIndexed() : g;
    if (!src.attributes.normal) src.computeVertexNormals();
    _q.setFromAxisAngle(_up, ry); _s.set(sx, sy, sz); _p.set(x, y, z);
    _m.compose(_p, _q, _s);
    const nm = new THREE.Matrix3().getNormalMatrix(_m);
    const P = src.attributes.position.array, Nn = src.attributes.normal.array;
    _c.set(color);
    for (let i = 0; i < P.length; i += 3) {
      _cc.set(P[i], P[i + 1], P[i + 2]).applyMatrix4(_m);
      _n.set(Nn[i], Nn[i + 1], Nn[i + 2]).applyMatrix3(nm).normalize();
      this._v(_cc.x, _cc.y, _cc.z, _n.x, _n.y, _n.z, _c, emit, pat, prm);
    }
    if (src !== g) src.dispose();
  }
  /** 상자 (가운데 x,z, 바닥 y, 크기 w,h,d, 회전 ry) */
  box(x, y, z, w, h, d, ry, color, emit = 0, pat = 0, prm = 0) { this.geo(_boxG, x, y + h / 2, z, ry, color, emit, pat, prm, w, h, d); }
  /** 원기둥 (가운데 x,z, 바닥 y) */
  cyl(x, y, z, r, h, color, emit = 0, pat = 0, prm = 0, seg = 12, r2 = null) {
    const k = `${seg}:${r2 == null ? 1 : (r2 / r).toFixed(2)}`;
    let g = _cylG.get(k);
    if (!g) { g = new THREE.CylinderGeometry(r2 == null ? 1 : r2 / r, 1, 1, seg, 1).toNonIndexed(); g.computeVertexNormals(); _cylG.set(k, g); }
    this.geo(g, x, y + h / 2, z, 0, color, emit, pat, prm, r, h, r);
  }
  sphere(x, y, z, r, color, emit = 0, pat = 0, prm = 0) { this.geo(_sphG, x, y, z, 0, color, emit, pat, prm, r, r, r); }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.C, 3));
    g.setAttribute('emit', new THREE.Float32BufferAttribute(this.E, 1));
    g.setAttribute('pat', new THREE.Float32BufferAttribute(this.T, 2));
    g.computeBoundingSphere();
    return g;
  }
}
const _boxG = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
_boxG.computeVertexNormals();
const _sphG = new THREE.IcosahedronGeometry(1, 1).toNonIndexed();
_sphG.computeVertexNormals();
const _cylG = new Map();
