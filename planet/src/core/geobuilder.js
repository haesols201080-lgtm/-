// Small modelling kit: accumulate transformed primitives into one
// non-indexed BufferGeometry with vertex colours and custom attributes.
import * as THREE from 'three';

const _m = new THREE.Matrix4();
const _n = new THREE.Matrix3();
const _v = new THREE.Vector3();
const _c = new THREE.Color();

export class GeoBuilder {
  constructor(attrNames = []) {
    this.pos = [];
    this.nor = [];
    this.col = [];
    this.attrNames = attrNames;
    this.attrs = Object.fromEntries(attrNames.map((n) => [n, []]));
  }

  // opts: matrix | {pos, rot(Euler), scale}, color (hex/Color/fn(x,y,z,nx,ny,nz)->[r,g,b]), attrs {name: value|fn}
  add(geo, opts = {}) {
    let g = geo.index ? geo.toNonIndexed() : geo;
    if (!g.attributes.normal) { g = g === geo ? g.clone() : g; g.computeVertexNormals(); }
    const m = opts.matrix || _m.compose(
      opts.pos || new THREE.Vector3(),
      new THREE.Quaternion().setFromEuler(opts.rot || new THREE.Euler()),
      opts.scale instanceof THREE.Vector3 ? opts.scale : new THREE.Vector3(opts.scale || 1, opts.scale || 1, opts.scale || 1),
    );
    _n.getNormalMatrix(m);
    const P = g.attributes.position, N = g.attributes.normal;
    const C = g.attributes.color;
    const col = opts.color;
    let fixed = null;
    if (Array.isArray(col)) { _c.setRGB(col[0], col[1], col[2], THREE.SRGBColorSpace); fixed = [_c.r, _c.g, _c.b]; }
    else if (col !== undefined && typeof col !== 'function') { _c.set(col); fixed = [_c.r, _c.g, _c.b]; }
    const nv = new THREE.Vector3();
    for (let i = 0; i < P.count; i++) {
      _v.fromBufferAttribute(P, i);
      const lx = _v.x, ly = _v.y, lz = _v.z;
      _v.applyMatrix4(m);
      nv.fromBufferAttribute(N, i).applyMatrix3(_n).normalize();
      this.pos.push(_v.x, _v.y, _v.z);
      this.nor.push(nv.x, nv.y, nv.z);
      if (typeof col === 'function') { const c = col(lx, ly, lz, nv.x, nv.y, nv.z, _v.x, _v.y, _v.z); this.col.push(c[0], c[1], c[2]); }
      else if (fixed) this.col.push(fixed[0], fixed[1], fixed[2]);
      else if (C) this.col.push(C.getX(i), C.getY(i), C.getZ(i));
      else this.col.push(1, 1, 1);
      for (const name of this.attrNames) {
        const a = opts.attrs && opts.attrs[name];
        this.attrs[name].push(typeof a === 'function' ? a(lx, ly, lz, _v.x, _v.y, _v.z) : (a || 0));
      }
    }
    return this;
  }

  get empty() { return this.pos.length === 0; }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    for (const name of this.attrNames) g.setAttribute(name, new THREE.Float32BufferAttribute(this.attrs[name], 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

// Helpers for common shapes
export function box(w, h, d) { return new THREE.BoxGeometry(w, h, d); }
export function cyl(rt, rb, h, seg = 16, open = false) { return new THREE.CylinderGeometry(rt, rb, h, seg, 1, open); }

// Tapered tube along a curve (radius function of t)
export function taperTube(curve, segs, radial, rFn) {
  const frames = curve.computeFrenetFrames(segs, false);
  const pos = [], nor = [], idx = [];
  const p = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    curve.getPointAt(t, p);
    const N = frames.normals[i], B = frames.binormals[i];
    const r = rFn(t);
    for (let j = 0; j <= radial; j++) {
      const a = j / radial * Math.PI * 2;
      const nx = Math.cos(a) * N.x + Math.sin(a) * B.x;
      const ny = Math.cos(a) * N.y + Math.sin(a) * B.y;
      const nz = Math.cos(a) * N.z + Math.sin(a) * B.z;
      pos.push(p.x + nx * r, p.y + ny * r, p.z + nz * r);
      nor.push(nx, ny, nz);
    }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) {
    const a = i * (radial + 1) + j, b = a + radial + 1;
    idx.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}
