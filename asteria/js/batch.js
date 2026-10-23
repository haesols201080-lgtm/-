// 아스테리아 1부 — 형상 묶음 (Batch)
// 건축 키트, 소품, 식물이 함께 쓰는 바탕. 형상을 재질 이름별 통에 모아 두었다가 통마다 메쉬 하나로 합친다.
// 단위는 미터, +y 위. uv는 "미터" 단위로 적는다 (재질 쪽에서 텍스처 한 장이 몇 미터인지 정한다).
// 색(color) 속성은 정점마다 곱하는 값이다 (밝기·색 흔들기, 창 하나하나의 불빛 세기 등).
'use strict';

// 재질 이름 → 텍스처가 없을 때 쓰는 기본색 (sRGB). 재질 모듈(TEX)이 있으면 TEX.lib(이름)이 우선이다.
const MAT_FALLBACK = {
  stone: 0xc9a97e, stoneOld: 0xe3dccb, stoneEarly: 0xa89274, stoneTrim: 0xd2b88f, stoneDark: 0x7a6e60,
  slate: 0x3e4656, copper: 0x5e9c8c, lead: 0x5a5f66, brass: 0xc9a45c, gold: 0xd8b25a, iron: 0x2e2f33,
  oak: 0x4a3020, oakPanel: 0x5a3a22, timber: 0x5a4632, plaster: 0xe8dfc8,
  glassDark: 0x1e2430, glassLit: 0xffb866, glassStained: 0x5a4a8a,
  cobble: 0x8a8070, flagstone: 0x9a8e7c, gravel: 0x9a9080, dirt: 0x8a7354, grass: 0x6f7f42, moss: 0x5e6b34, rock: 0x7e786e, snow: 0xeef2f6,
  carpet: 0x6b2a22, velvet: 0x2a2f5e, parchment: 0xe9dcc0, leather: 0x5a3a28, bookSpines: 0x6b4a3a, rope: 0x9a8058,
  bark: 0x4a3a2c, leaf: 0x5a7034, leafAutumn: 0xb8652a, flower: 0xd8c060, water: 0x2a4a5a, glow: 0xffd88a, mana: 0x7ff0ff,
};
const _batchFallbackMats = new Map();
// 모듈이 직접 만든 특수 재질 (이름 → 재질 또는 재질을 만드는 함수). TEX보다 먼저 본다. 예: PROPS의 불꽃·책 아틀라스.
// 재질의 userData.noShadow면 그림자를 드리우지 않고, userData.glow면 그림자를 받지도 않는다.
const BATCH_MATS = {};
function batchMat(key) {
  const reg = BATCH_MATS[key]; if (reg) return reg.isMaterial ? reg : (BATCH_MATS[key] = reg(key));
  if (window.TEX && TEX.lib) { const m = TEX.lib(key); if (m) return m; }
  let m = _batchFallbackMats.get(key);
  if (!m) {
    const c = MAT_FALLBACK[key] ?? 0xff00ff;
    const glow = key === 'glassLit' || key === 'glow' || key === 'mana';
    m = glow ? new THREE.MeshBasicMaterial({ color: c, vertexColors: true, toneMapped: false })
      : new THREE.MeshStandardMaterial({ color: c, vertexColors: true, roughness: key === 'brass' || key === 'gold' ? 0.35 : key === 'glassDark' ? 0.12 : 0.85, metalness: key === 'brass' || key === 'gold' || key === 'iron' ? 0.9 : 0 });
    _batchFallbackMats.set(key, m);
  }
  return m;
}

// 변환 행렬: 위치, y축 회전, 크기
const _bm = new THREE.Matrix4(), _bq = new THREE.Quaternion(), _bv = new THREE.Vector3(), _bs = new THREE.Vector3(), _by = new THREE.Vector3(0, 1, 0);
function M4(x = 0, y = 0, z = 0, ry = 0, sx = 1, sy = sx, sz = sx) {
  return new THREE.Matrix4().compose(_bv.set(x, y, z), _bq.setFromAxisAngle(_by, ry), _bs.set(sx, sy, sz));
}
// 회전을 오일러로 주는 판
function M4e(x, y, z, rx, ry, rz, sx = 1, sy = sx, sz = sx) {
  return new THREE.Matrix4().compose(_bv.set(x, y, z), _bq.setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), _bs.set(sx, sy, sz));
}

// 상자 투영 uv (미터): 면의 방향에 따라 두 축을 고른다. 세로면은 v가 높이를 따라가서 돌 줄눈이 수평이 된다.
function boxUV(g, ox = 0, oy = 0, oz = 0) {
  const p = g.attributes.position, n = g.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + ox, y = p.getY(i) + oy, z = p.getZ(i) + oz;
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    if (ay >= ax && ay >= az) { uv[i * 2] = x; uv[i * 2 + 1] = z; }
    else if (ax >= az) { uv[i * 2] = z * Math.sign(n.getX(i) || 1); uv[i * 2 + 1] = y; }
    else { uv[i * 2] = -x * Math.sign(n.getZ(i) || 1); uv[i * 2 + 1] = y; }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

class Batch {
  constructor(o = {}) {
    this.buckets = new Map();   // 재질 이름 → [{pos, nor, uv, col}]
    this.colliders = [];        // field.js addStatic 형식 ({x,z,r,top,bot} / {x0,x1,z0,z1,top,bot} / {x,z,hw,hd,rot,top,bot})
    this.lights = [];           // {x,y,z,c,k,d,flicker}
    this.anims = [];            // t => void (만든 쪽이 매 프레임 부른다)
    this.marks = [];            // 쓰는 쪽에 알릴 표시 ({kind:'window', x,y,z, nx,nz, w,h, lit} 등)
    this.extra = [];            // 합치지 않고 그대로 붙일 Object3D (움직이는 것, 특수 재질)
    this.shadow = o.shadow !== false;
    this.uvWorld = o.uvWorld !== false; // uv가 없는 형상은 월드 좌표 상자 투영으로 uv를 만든다
  }
  // 형상 하나를 통에 넣는다. g는 BufferGeometry(인덱스 있어도 됨), mx는 Matrix4(없으면 그대로).
  // o.color: [r,g,b] 또는 THREE.Color 또는 16진수 — 정점색 곱. o.uvScale: uv 배율. o.worldUV: true면 변환 뒤 월드 좌표로 uv를 다시 만든다.
  add(key, g, mx, o = {}) {
    let geom = g.index ? g.toNonIndexed() : g.clone();
    if (mx) geom.applyMatrix4(mx);
    if (!geom.attributes.normal) geom.computeVertexNormals();
    if (o.worldUV || (!geom.attributes.uv && this.uvWorld)) boxUV(geom);
    const n = geom.attributes.position.count;
    let uv = geom.attributes.uv ? geom.attributes.uv.array : new Float32Array(n * 2);
    if (o.uvScale && o.uvScale !== 1) { uv = uv.slice(); for (let i = 0; i < uv.length; i++) uv[i] *= o.uvScale; }
    let col;
    if (geom.attributes.color && !o.color) col = geom.attributes.color.array;
    else {
      let r = 1, gg = 1, b = 1;
      if (o.color !== undefined) {
        if (Array.isArray(o.color)) [r, gg, b] = o.color;
        else { const c = o.color.isColor ? o.color : new THREE.Color(o.color); r = c.r; gg = c.g; b = c.b; }
      }
      col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { col[i * 3] = r; col[i * 3 + 1] = gg; col[i * 3 + 2] = b; }
    }
    let list = this.buckets.get(key);
    if (!list) this.buckets.set(key, list = []);
    list.push({ pos: geom.attributes.position.array, nor: geom.attributes.normal.array, uv, col });
    geom.dispose();
    return this;
  }
  col(c) { this.colliders.push(c); return c; }
  light(l) { this.lights.push(l); return l; }
  mark(m) { this.marks.push(m); return m; }
  // 다른 묶음을 통째로 합친다
  merge(other) {
    for (const [k, list] of other.buckets) { let l = this.buckets.get(k); if (!l) this.buckets.set(k, l = []); l.push(...list); }
    this.colliders.push(...other.colliders); this.lights.push(...other.lights); this.anims.push(...other.anims); this.marks.push(...other.marks); this.extra.push(...other.extra);
    return this;
  }
  count() { let t = 0; for (const list of this.buckets.values()) for (const p of list) t += p.pos.length / 9; return t; }
  // 통마다 메쉬 하나. matFn(이름) → 재질 (기본: batchMat)
  build(matFn = batchMat) {
    const group = new THREE.Group();
    for (const [key, list] of this.buckets) {
      let n = 0; for (const p of list) n += p.pos.length / 3;
      if (!n) continue;
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = new Float32Array(n * 3);
      let o3 = 0, o2 = 0;
      for (const p of list) { pos.set(p.pos, o3); nor.set(p.nor, o3); col.set(p.col, o3); uv.set(p.uv, o2); o3 += p.pos.length; o2 += p.uv.length; }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      g.setAttribute('uv2', g.attributes.uv);
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      g.computeBoundingSphere(); g.computeBoundingBox();
      const mt = matFn(key), ud = mt.userData || {};
      const m = new THREE.Mesh(g, mt);
      m.name = key;
      const glow = key === 'glassLit' || key === 'glow' || key === 'mana' || !!ud.glow;
      m.castShadow = this.shadow && !glow && key !== 'glassDark' && key !== 'water' && !ud.noShadow;
      m.receiveShadow = !glow;
      group.add(m);
    }
    for (const e of this.extra) group.add(e);
    group.userData.batch = { colliders: this.colliders, lights: this.lights, anims: this.anims, marks: this.marks };
    return group;
  }
}
