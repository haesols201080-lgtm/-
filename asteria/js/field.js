// 아스테리아 1부 — 땅: 대륙 지형(높이 격자)과 실내(블록 격자), 물, 충돌체
'use strict';

// 정점 플래그
const FL = { LEY: 1, ROAD: 2, NOGRASS: 4, NOCLIMB: 8, VOID: 16, BAND: 32, TOWN: 64 };

// ======================================================================
// 대륙 지형
// ======================================================================
class TerrainField {
  constructor(id, W, D, res) {
    this.kind = 'terrain'; this.id = id; this.W = W; this.D = D; this.res = res;
    this.nx = Math.round(W / res); this.nz = Math.round(D / res);
    const N = (this.nx + 1) * (this.nz + 1);
    this.h = new Float32Array(N); this.col = new Float32Array(N * 3); this.fl = new Uint8Array(N); this.reg = new Uint8Array(N);
    this.ents = []; this.statics = []; this.hash = new Map(); this.world = true; this.outdoor = true;
  }
  vi(ix, iz) { return iz * (this.nx + 1) + ix; }
  ground(x, z) {
    const r = this.res;
    let gx = x / r, gz = z / r;
    gx = clamp(gx, 0, this.nx - 0.001); gz = clamp(gz, 0, this.nz - 0.001);
    const ix = gx | 0, iz = gz | 0, fx = gx - ix, fz = gz - iz;
    const w = this.nx + 1, i = iz * w + ix, h = this.h;
    return lerp(lerp(h[i], h[i + 1], fx), lerp(h[i + w], h[i + w + 1], fx), fz);
  }
  flagAt(x, z) { const ix = clamp(Math.round(x / this.res), 0, this.nx), iz = clamp(Math.round(z / this.res), 0, this.nz); return this.fl[this.vi(ix, iz)]; }
  regionAt(x, z) { const ix = clamp(Math.round(x / this.res), 0, this.nx), iz = clamp(Math.round(z / this.res), 0, this.nz); return this.reg[this.vi(ix, iz)]; }
  waterAt(x, z) {
    const f = this.flagAt(x, z);
    if (f & FL.VOID) return null;
    if (f & FL.BAND) return G.f.eng_marcella ? Math.max(0, tideLevel()) : 0;
    return 0;
  }
  current() { return null; }
  climbable(x, z) { return !(this.flagAt(x, z) & FL.NOCLIMB); }
  grassAt(x, z) {
    if (x < 2 || z < 2 || x > this.W - 2 || z > this.D - 2) return null;
    const ix = Math.round(x / this.res), iz = Math.round(z / this.res), i = this.vi(ix, iz);
    const f = this.fl[i];
    if (f & (FL.ROAD | FL.NOGRASS | FL.VOID | FL.BAND | FL.LEY | FL.TOWN)) return null;
    const y = this.ground(x, z);
    if (y < 0.35) return null;
    const r = this.reg[i];
    const c = this.col;
    if (r === 0 || r === 6) {
      if (r === 6 && G.f.westDark) return { y, r: 0.55, g: 0.6, b: 0.55, d: 0.35 };
      return { y, r: c[i * 3] * 1.15, g: c[i * 3 + 1] * 1.2, b: c[i * 3 + 2] * 1.05, d: 0.85, flower: 0.025 };
    }
    if (r === 3 && G.f.elm !== 'full') return { y, r: 0.85, g: 0.55, b: 0.22, d: 0.28, k: 0.8 };
    return null;
  }
}

// ======================================================================
// 실내 (블록 격자). 칸 하나 = cs 미터
// ======================================================================
const CF = { NOCLIMB: 1, WATER: 2, CURRENT: 4, FLOOD: 8, CRACK: 16, GRASS: 32, ROOF: 64 };
class BlockField {
  constructor(id, cw, cd, cs = 2) {
    this.kind = 'blocks'; this.id = id; this.cw = cw; this.cd = cd; this.cs = cs; this.W = cw * cs; this.D = cd * cs;
    this.ch = new Float32Array(cw * cd); this.ct = new Uint8Array(cw * cd); this.cf = new Uint8Array(cw * cd); this.cw_ = new Float32Array(cw * cd).fill(-99);
    this.ents = []; this.statics = []; this.hash = new Map(); this.rooms = [];
  }
  ci(x, z) { const cx = Math.floor(x / this.cs), cz = Math.floor(z / this.cs); if (cx < 0 || cz < 0 || cx >= this.cw || cz >= this.cd) return -1; return cz * this.cw + cx; }
  ground(x, z) { const i = this.ci(x, z); return i < 0 ? 40 : this.ch[i]; }
  waterAt(x, z) {
    const i = this.ci(x, z); if (i < 0) return null;
    const f = this.cf[i];
    if (f & CF.FLOOD) return this.flood ? this.floodHi : this.floodLo;
    if (f & CF.WATER) return this.cw_[i];
    return null;
  }
  current(x, z) { const i = this.ci(x, z); return i >= 0 && (this.cf[i] & CF.CURRENT) && this.flood; }
  climbable(x, z) { const i = this.ci(x, z); return i >= 0 && !(this.cf[i] & CF.NOCLIMB); }
  grassAt(x, z) {
    const i = this.ci(x, z); if (i < 0 || !(this.cf[i] & CF.GRASS)) return null;
    return { y: this.ch[i], r: 0.42, g: 0.78, b: 0.36, d: 0.9, flower: 0.04 };
  }
}

// ---------- 충돌체 ----------
function addStatic(m, c) {
  m.statics.push(c);
  const S = 8;
  const x0 = c.r ? c.x - c.r : c.x0, x1 = c.r ? c.x + c.r : c.x1, z0 = c.r ? c.z - c.r : c.z0, z1 = c.r ? c.z + c.r : c.z1;
  for (let gx = Math.floor(x0 / S); gx <= Math.floor(x1 / S); gx++) for (let gz = Math.floor(z0 / S); gz <= Math.floor(z1 / S); gz++) {
    const k = gx * 10007 + gz; let a = m.hash.get(k); if (!a) m.hash.set(k, a = []); a.push(c);
  }
  return c;
}
function collidersNear(x, z, r) {
  const m = G.map, S = 8, out = [];
  for (let gx = Math.floor((x - r) / S); gx <= Math.floor((x + r) / S); gx++) for (let gz = Math.floor((z - r) / S); gz <= Math.floor((z + r) / S); gz++) {
    const a = m.hash.get(gx * 10007 + gz); if (a) for (const c of a) if (!c.off && !out.includes(c)) out.push(c);
  }
  for (const c of G.dynCols) if (Math.abs(c.x - x) < r + (c.r || c.hw || 2) + 1 && Math.abs(c.z - z) < r + (c.r || c.hd || 2) + 1) out.push(c);
  return out;
}
// 충돌체를 상자 꼴로 통일해서 다룬다
function colBox(c) {
  if (c.r !== undefined) return null;
  if (c.hw !== undefined) return { x0: c.x - c.hw, x1: c.x + c.hw, z0: c.z - c.hd, z1: c.z + c.hd };
  return c;
}
function insideCol(c, x, z, pad = 0) {
  if (c.r !== undefined) return Math.hypot(x - c.x, z - c.z) < c.r + pad;
  const b = colBox(c);
  return x > b.x0 - pad && x < b.x1 + pad && z > b.z0 - pad && z < b.z1 + pad;
}
// 서 있을 수 있는 가장 높은 면 (땅, 상자 위, 얼음 기둥 위, 낙엽 위)
function standHeight(x, z, y, step = 0.6) {
  let g = G.map.ground(x, z);
  for (const c of collidersNear(x, z, 0.5)) {
    if (!c.stand) continue;
    if (insideCol(c, x, z, 0.15) && c.top <= y + step && c.top > g) g = c.top;
  }
  return g;
}
// 원(플레이어)을 충돌체 밖으로 밀어낸다
function pushOut(o, r, h) {
  for (const c of collidersNear(o.x, o.z, r + 1)) {
    if (c.self === o) continue;
    const bot = c.bot ?? -99;
    if (c.top <= o.y + 0.55 || bot > o.y + h) continue;
    if (c.r !== undefined) {
      const dx = o.x - c.x, dz = o.z - c.z, d = Math.hypot(dx, dz), m = c.r + r;
      if (d < m && d > 0.0001) { o.x = c.x + dx / d * m; o.z = c.z + dz / d * m; o.hitCol = c; }
    } else {
      const b = colBox(c);
      const cx = clamp(o.x, b.x0, b.x1), cz = clamp(o.z, b.z0, b.z1);
      const dx = o.x - cx, dz = o.z - cz, d = Math.hypot(dx, dz);
      if (d < r) {
        if (d > 0.0001) { o.x = cx + dx / d * r; o.z = cz + dz / d * r; }
        else { // 안에 들어가 버렸으면 가장 가까운 면으로
          const l = o.x - b.x0, rr = b.x1 - o.x, t = o.z - b.z0, bb = b.z1 - o.z, mn = Math.min(l, rr, t, bb);
          if (mn === l) o.x = b.x0 - r; else if (mn === rr) o.x = b.x1 + r; else if (mn === t) o.z = b.z0 - r; else o.z = b.z1 + r;
        }
        o.hitCol = c;
      }
    }
  }
}

// ---------- 카메라 가림 ----------
function camClip(tx, ty, tz, cx, cy, cz) {
  const m = G.map; let k = 1;
  for (let i = 1; i <= 24; i++) {
    const f = i / 24, x = lerp(tx, cx, f), y = lerp(ty, cy, f), z = lerp(tz, cz, f);
    if (m.ground(x, z) + 0.35 > y) { k = Math.max(0.12, (i - 1.5) / 24); break; }
  }
  return k;
}

// ======================================================================
// 지형 메쉬
// ======================================================================
function terrainMaterial() {
  return new THREE.MeshStandardMaterial({ vertexColors: true, map: GFX.noiseTex, roughness: 0.93, metalness: 0 });
}
function buildTerrainMeshes(m, group) {
  const CH = 32, w = m.nx + 1, r = m.res;
  const matl = terrainMaterial();
  for (let cz = 0; cz < m.nz; cz += CH) for (let cx = 0; cx < m.nx; cx += CH) {
    const nx = Math.min(CH, m.nx - cx), nz = Math.min(CH, m.nz - cz);
    const pos = new Float32Array((nx + 1) * (nz + 1) * 3), nor = new Float32Array(pos.length), col = new Float32Array(pos.length), uv = new Float32Array((nx + 1) * (nz + 1) * 2);
    let k = 0;
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
      const ix = cx + i, iz = cz + j, vi = iz * w + ix;
      pos[k * 3] = ix * r; pos[k * 3 + 1] = m.h[vi]; pos[k * 3 + 2] = iz * r;
      const hl = m.h[iz * w + Math.max(0, ix - 1)], hr = m.h[iz * w + Math.min(m.nx, ix + 1)];
      const hd = m.h[Math.max(0, iz - 1) * w + ix], hu = m.h[Math.min(m.nz, iz + 1) * w + ix];
      const n = V3(hl - hr, 2 * r, hd - hu).normalize();
      nor[k * 3] = n.x; nor[k * 3 + 1] = n.y; nor[k * 3 + 2] = n.z;
      col[k * 3] = m.col[vi * 3]; col[k * 3 + 1] = m.col[vi * 3 + 1]; col[k * 3 + 2] = m.col[vi * 3 + 2];
      uv[k * 2] = ix * r * 0.12; uv[k * 2 + 1] = iz * r * 0.12;
      k++;
    }
    const idx = [];
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeBoundingSphere();
    const me = new THREE.Mesh(g, matl);
    me.receiveShadow = true; me.castShadow = true;
    group.add(me);
  }
  // 바다·강·호수 (사라지는 협곡은 빼고)
  const wg = [], R = 4;
  for (let z = 0; z < m.D; z += R) for (let x = 0; x < m.W; x += R) {
    let low = false, voidc = false, band = false;
    for (const [ox, oz] of [[0, 0], [R, 0], [0, R], [R, R], [R / 2, R / 2]]) {
      const f = m.flagAt(x + ox, z + oz);
      if (f & FL.VOID) voidc = true; if (f & FL.BAND) band = true;
      if (m.ground(x + ox, z + oz) < 0.25) low = true;
    }
    if (low && !voidc && !band) wg.push(x, z);
  }
  group.add(quadsMesh(wg, R, 0, waterMat()));
  // 마르셀라 해안 띠 (기관을 고치면 바다가 돌아온다)
  const bg = [];
  for (let z = 0; z < m.D; z += R) for (let x = 0; x < m.W; x += R) if (m.flagAt(x + R / 2, z + R / 2) & FL.BAND) bg.push(x, z);
  const tide = quadsMesh(bg, R, 0, waterMat({ color: 0x3a9ac8, opacity: 0.78 }));
  tide.visible = false; m.tideMesh = tide; group.add(tide);
}
function quadsMesh(list, R, y, material) {
  const pos = [], idx = [], uv = [];
  for (let i = 0; i < list.length; i += 2) {
    const x = list[i], z = list[i + 1], b = pos.length / 3;
    pos.push(x, y, z, x + R, y, z, x, y, z + R, x + R, y, z + R);
    uv.push(x * 0.05, z * 0.05, (x + R) * 0.05, z * 0.05, x * 0.05, (z + R) * 0.05, (x + R) * 0.05, (z + R) * 0.05);
    idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere();
  const me = new THREE.Mesh(g, material);
  me.renderOrder = 2;
  return me;
}

// ======================================================================
// 실내 블록 메쉬
// ======================================================================
function buildBlockMeshes(m, group) {
  const pos = [], col = [], nor = [], uv = [], idx = [];
  const trim = [];
  const cs = m.cs;
  const push = (verts, n, c, uvs) => {
    const b = pos.length / 3;
    for (let i = 0; i < 4; i++) { pos.push(...verts[i]); nor.push(...n); col.push(c.r, c.g, c.b); uv.push(...uvs[i]); }
    idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
  };
  const cc = new THREE.Color(), cs2 = new THREE.Color();
  const H = (cx, cz) => (cx < 0 || cz < 0 || cx >= m.cw || cz >= m.cd) ? -50 : m.ch[cz * m.cw + cx];
  for (let cz = 0; cz < m.cd; cz++) for (let cx = 0; cx < m.cw; cx++) {
    const i = cz * m.cw + cx, h = m.ch[i], t = m.ct[i];
    if (m.cf[i] & CF.ROOF && m.hideInner) continue;
    blockColor(m, t, cx, cz, h, cc);
    const x0 = cx * cs, z0 = cz * cs, x1 = x0 + cs, z1 = z0 + cs;
    push([[x0, h, z0], [x1, h, z0], [x0, h, z1], [x1, h, z1]], [0, 1, 0], cc, [[x0 * 0.25, z0 * 0.25], [x1 * 0.25, z0 * 0.25], [x0 * 0.25, z1 * 0.25], [x1 * 0.25, z1 * 0.25]]);
    // 옆면
    cs2.copy(cc).multiplyScalar(0.72);
    const sides = [[cx - 1, cz, [-1, 0, 0]], [cx + 1, cz, [1, 0, 0]], [cx, cz - 1, [0, 0, -1]], [cx, cz + 1, [0, 0, 1]]];
    for (const [nx, nz, n] of sides) {
      const hn = Math.max(H(nx, nz), -6);
      if (hn >= h - 0.001) continue;
      let v;
      if (n[0] === -1) v = [[x0, h, z1], [x0, h, z0], [x0, hn, z1], [x0, hn, z0]];
      else if (n[0] === 1) v = [[x1, h, z0], [x1, h, z1], [x1, hn, z0], [x1, hn, z1]];
      else if (n[2] === -1) v = [[x0, h, z0], [x1, h, z0], [x0, hn, z0], [x1, hn, z0]];
      else v = [[x1, h, z1], [x0, h, z1], [x1, hn, z1], [x0, hn, z1]];
      const u0 = (n[0] ? z0 : x0) * 0.25, u1 = (n[0] ? z1 : x1) * 0.25;
      push(v, n, cs2, [[u0, h * 0.25], [u1, h * 0.25], [u0, hn * 0.25], [u1, hn * 0.25]]);
      if (m.trim && h - hn > 2.5 && (m.cf[i] & CF.NOCLIMB)) trim.push([v, n, hn]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeBoundingSphere();
  const me = new THREE.Mesh(g, terrainMaterial());
  me.receiveShadow = true; me.castShadow = true;
  group.add(me);
  // 벽에 새긴 빛나는 룬 띠
  if (trim.length) {
    const tp = [], ti = [];
    for (const [v, n, hn] of trim) {
      const y0 = hn + 1.0, y1 = hn + 1.16, b = tp.length / 3, o = 0.02;
      const a = v[0], c = v[1];
      tp.push(a[0] + n[0] * o, y1, a[2] + n[2] * o, c[0] + n[0] * o, y1, c[2] + n[2] * o, a[0] + n[0] * o, y0, a[2] + n[2] * o, c[0] + n[0] * o, y0, c[2] + n[2] * o);
      ti.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
    }
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3)); tg.setIndex(ti);
    const tm = new THREE.Mesh(tg, GLOW(m.trim, 1.6, { side: THREE.DoubleSide }));
    group.add(tm);
  }
  // 물
  const fixedW = [], floodW = [];
  for (let cz = 0; cz < m.cd; cz++) for (let cx = 0; cx < m.cw; cx++) {
    const i = cz * m.cw + cx;
    if (m.cf[i] & CF.FLOOD) floodW.push(cx * cs, cz * cs, i);
    else if (m.cf[i] & CF.WATER) fixedW.push(cx * cs, cz * cs, i);
  }
  if (fixedW.length) {
    const lst = []; let lv = 0;
    for (let k = 0; k < fixedW.length; k += 3) { lst.push(fixedW[k], fixedW[k + 1]); lv = m.cw_[fixedW[k + 2]]; }
    const wm = quadsMesh(lst, cs, 0, waterMat({ color: m.waterC || 0x3a8ac8 }));
    wm.position.y = lv; group.add(wm);
  }
  if (floodW.length) {
    const cur = [], still = [];
    for (let k = 0; k < floodW.length; k += 3) ((m.cf[floodW[k + 2]] & CF.CURRENT) ? cur : still).push(floodW[k], floodW[k + 1]);
    m.floodMeshes = [];
    if (cur.length) { const a = quadsMesh(cur, cs, 0, waterMat({ color: 0x5ab0d8, flow: 1 })); group.add(a); m.floodMeshes.push(a); }
    if (still.length) { const b = quadsMesh(still, cs, 0, waterMat({ color: 0x3a8ac8 })); group.add(b); m.floodMeshes.push(b); }
  }
  // 지붕 (안에 들어가면 사라진다)
  for (const rm of m.rooms) {
    const w = (rm.x1 - rm.x0) * cs, d = (rm.z1 - rm.z0) * cs;
    const roof = new THREE.Group();
    const base = mesh(geo('box', w + 1.2, 0.5, d + 1.2), mat(rm.roof || 0xa85a4a), rm.x0 * cs + w / 2, rm.h + 0.25, rm.z0 * cs + d / 2, roof);
    const ridge = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.62, rm.peak || 3, 4), mat(rm.roof || 0xa85a4a));
    ridge.rotation.y = Math.PI / 4; ridge.scale.set(w / Math.max(w, d), 1, d / Math.max(w, d));
    ridge.position.set(rm.x0 * cs + w / 2, rm.h + 0.5 + (rm.peak || 3) / 2, rm.z0 * cs + d / 2); roof.add(ridge);
    ridge.castShadow = true; base.castShadow = true;
    if (rm.dome) { ridge.visible = false; const dm = mesh(geo('sph', Math.min(w, d) * 0.48, 20, 10), mat(0x8aa8d8, { rough: 0.4, metal: 0.3 }), rm.x0 * cs + w / 2, rm.h + 0.5, rm.z0 * cs + d / 2, roof); dm.scale.y = 0.6; dm.castShadow = true; }
    rm.mesh = roof; group.add(roof);
  }
}
// 실내 블록 색
function blockColor(m, t, cx, cz, h, out) {
  const st = m.style, n = hash2(cx, cz, 7) * 0.08 - 0.04;
  let c;
  switch (t) {
    case T.WALL: c = st === 'salt' ? 0xdfe4ea : st === 'wood' ? 0x7a5a42 : st === 'mine' ? 0x4a4048 : st === 'ruin' ? 0xb8b2c8 : st === 'lab' ? 0x5a6f8a : st === 'town' ? 0xd8c8a8 : 0x6c6278; break;
    case T.FLOOR: c = st === 'salt' ? 0xc8d4dc : st === 'wood' ? 0xb08050 : st === 'ruin' ? 0xd0cce0 : st === 'lab' ? 0x8a9ab4 : st === 'mine' ? 0x6b5e55 : st === 'town' ? 0xc9b48e : 0x8a8098; break;
    case T.CARPET: c = 0xa03e52; break;
    case T.PLAZA: c = (cx + cz) % 2 ? 0xe8dcc4 : 0xdcd0b6; break;
    case T.PATH: c = 0xd9c28f; break;
    case T.GRASS: c = hash2(cx, cz) < 0.5 ? 0x6fb860 : 0x66b058; break;
    case T.SHELF: c = 0x8a5a3a; break;
    case T.ROOF: c = 0xc4665a; break;
    case T.IVY: c = 0x5f8f4a; break;
    case T.FENCE: c = 0x8b6b4a; break;
    case T.CRACK: c = 0x8a6a5a; break;
    case T.DARK: c = 0x3a3236; break;
    case T.MINE: c = 0x6b5e55; break;
    case T.HIGH: c = st === 'salt' ? 0xe8eef4 : 0xb8b0c8; break;
    case T.PILLAR: c = 0xcfc6b8; break;
    case T.STAIRS: c = 0xbba57f; break;
    case T.FLOOD: case T.POOL: c = st === 'salt' ? 0xa8b8c4 : 0x7a8a98; break;
    case T.DEEP: c = 0x3a5a7a; break;
    default: c = 0x9a9aa0;
  }
  out.set(c);
  out.r += n; out.g += n; out.b += n;
}
