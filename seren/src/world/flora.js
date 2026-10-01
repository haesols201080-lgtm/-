// 식생 배치: 세 층의 흩뿌리기(가까운 풀 / 중간 덤불·수정 / 먼 거대 식물).
// 모든 배치는 좌표 해시로 결정되어, 같은 자리에는 언제나 같은 풀이 납니다.
import * as THREE from 'three';
import { heightAt, regionWeights, RC } from './heightfield.js';
import { mulberry32, hash2 } from '../core/noise.js';
import { litMaterial } from './materials.js';
import * as F from './flora-geo.js';

const R = { spine: 0, meadow: 1, glass: 2, bloom: 3, canyon: 4, frost: 5, sea: 6 };
const _w = new Float32Array(RC);
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

/** 패치 안의 높이·지역·경사를 격자로 미리 재서 보간 */
class PatchSampler {
  constructor(x0, z0, size, n) {
    this.x0 = x0; this.z0 = z0; this.size = size; this.n = n;
    this.h = new Float32Array((n + 1) * (n + 1));
    this.w = new Float32Array((n + 1) * (n + 1) * RC);
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
      const k = j * (n + 1) + i;
      this.h[k] = heightAt(x0 + (i / n) * size, z0 + (j / n) * size, 2, _w);
      this.w.set(_w, k * RC);
    }
  }
  _ij(x, z) {
    const n = this.n;
    const fx = Math.min(n - 1e-4, Math.max(0, ((x - this.x0) / this.size) * n));
    const fz = Math.min(n - 1e-4, Math.max(0, ((z - this.z0) / this.size) * n));
    const i = Math.floor(fx), j = Math.floor(fz);
    return [i, j, fx - i, fz - j];
  }
  height(x, z) {
    const [i, j, u, v] = this._ij(x, z);
    const n1 = this.n + 1, H = this.h;
    const a = H[j * n1 + i], b = H[j * n1 + i + 1], c = H[(j + 1) * n1 + i], d = H[(j + 1) * n1 + i + 1];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  slope(x, z) {
    const [i, j] = this._ij(x, z);
    const n1 = this.n + 1, H = this.h, cell = this.size / this.n;
    const dx = H[j * n1 + i + 1] - H[j * n1 + i], dz = H[(j + 1) * n1 + i] - H[j * n1 + i];
    return Math.hypot(dx, dz) / cell;
  }
  weight(x, z, r) {
    const [i, j, u, v] = this._ij(x, z);
    const n1 = this.n + 1, W = this.w;
    const a = W[(j * n1 + i) * RC + r], b = W[(j * n1 + i + 1) * RC + r], c = W[((j + 1) * n1 + i) * RC + r], d = W[((j + 1) * n1 + i + 1) * RC + r];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
}

class ScatterLayer {
  // 패치 단위로 배치를 계산하고, 여러 패치를 묶은 "배치 셀" 단위로 InstancedMesh 를 만들어 그리기 호출을 줄인다
  constructor(world, opts) {
    this.world = world;
    this.scene = world.scene;
    this.patch = opts.patch;
    this.radius = opts.radius;
    this.batch = opts.batch ?? 4;
    this.kinds = opts.kinds; // [{geo, mat, height, width}]
    this.gen = opts.gen;
    this.samples = opts.samples ?? 8;
    this.patches = new Map();
    this.batches = new Map();
    this.dirty = new Set();
    this.group = new THREE.Group();
    this.group.name = opts.name || 'scatter';
    this.scene.add(this.group);
    this.total = 0;
  }

  _key(i, j) { return i * 65536 + j; }

  update(cam) {
    // 배치 셀마다 거리에 따라 단순한 모델로 바꿔 그린다
    for (const b of this.batches.values()) {
      for (const m of b.meshes) {
        const K = m.userData.kind;
        if (!K || !K.low) continue;
        const c = m.boundingSphere.center;
        const d = Math.hypot(c.x - cam.x, c.z - cam.z) - m.boundingSphere.radius * 0.6;
        const g = d > (K.lodDist || 1800) ? K.low : K.geo;
        if (m.geometry !== g) m.geometry = g;
      }
    }
    const P = this.patch, R = this.radius;
    const ci = Math.floor(cam.x / P), cj = Math.floor(cam.z / P);
    const n = Math.ceil(R / P) + 1;
    const want = [];
    for (let j = cj - n; j <= cj + n; j++) {
      for (let i = ci - n; i <= ci + n; i++) {
        const x = (i + 0.5) * P, z = (j + 0.5) * P;
        const d = Math.hypot(x - cam.x, z - cam.z);
        if (d > R + P * 0.71) continue;
        const k = this._key(i, j);
        const p = this.patches.get(k);
        if (p) p.seen = true;
        else want.push({ i, j, d, k });
      }
    }
    for (const [k, p] of this.patches) {
      const x = (p.i + 0.5) * P, z = (p.j + 0.5) * P;
      if (!p.seen && Math.hypot(x - cam.x, z - cam.z) > R * 1.15 + P) this._dispose(k, p);
      p.seen = false;
    }
    want.sort((a, b) => a.d - b.d);
    const t0 = performance.now();
    for (const w of want) {
      this._build(w.i, w.j, w.k);
      if (performance.now() - t0 > 3) break;
    }
    // 바뀐 배치 셀은 한 프레임에 몇 개씩 다시 만든다
    let rebuilt = 0;
    for (const b of this.dirty) {
      this._rebuildBatch(b);
      this.dirty.delete(b);
      if (++rebuilt >= 3) break;
    }
  }

  _batchKey(i, j) { return this._key(Math.floor(i / this.batch), Math.floor(j / this.batch)); }

  _build(i, j, k) {
    const P = this.patch;
    const x0 = i * P, z0 = j * P;
    const rng = mulberry32((hash2(i, j, this.patch) * 4294967296) >>> 0);
    const sampler = this.samples > 0 ? new PatchSampler(x0, z0, P, this.samples) : null;
    const list = [];
    this.gen({ x0, z0, size: P, rng, s: sampler, out: list, world: this.world });
    const p = { i, j, items: list, colliders: [], seen: true };
    for (const it of list) {
      if (it.col) for (const c of it.col) p.colliders.push(this.world.colliders.add(c));
    }
    this.patches.set(k, p);
    const bk = this._batchKey(i, j);
    let b = this.batches.get(bk);
    if (!b) { b = { key: bk, patches: new Set(), meshes: [] }; this.batches.set(bk, b); }
    b.patches.add(k);
    this.dirty.add(b);
  }

  _rebuildBatch(b) {
    for (const m of b.meshes) { this.group.remove(m); m.dispose(); this.total -= m.count; }
    b.meshes = [];
    if (!b.patches.size) { this.batches.delete(b.key); return; }
    const byKind = new Map();
    for (const pk of b.patches) {
      const p = this.patches.get(pk);
      if (!p) continue;
      for (const it of p.items) {
        let arr = byKind.get(it.k);
        if (!arr) { arr = []; byKind.set(it.k, arr); }
        arr.push(it);
      }
    }
    for (const [kind, arr] of byKind) {
      const K = this.kinds[kind];
      const mesh = new THREE.InstancedMesh(K.geo, K.mat, arr.length);
      mesh.userData.kind = K;
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9;
      const useColor = arr.some((a) => a.c !== undefined);
      for (let n = 0; n < arr.length; n++) {
        const a = arr[n];
        _p.set(a.x, a.y, a.z);
        _e.set(a.rx || 0, a.ry || 0, a.rz || 0);
        _q.setFromEuler(_e);
        const sy = a.sy ?? a.s;
        _s.set(a.sx ?? a.s, sy, a.sz ?? a.s);
        _m.compose(_p, _q, _s);
        mesh.setMatrixAt(n, _m);
        if (useColor) mesh.setColorAt(n, _c.set(a.c ?? 0xffffff));
        const ext = Math.max(a.sx ?? a.s, a.sz ?? a.s) * (K.width || 1);
        x0 = Math.min(x0, a.x - ext); x1 = Math.max(x1, a.x + ext);
        z0 = Math.min(z0, a.z - ext); z1 = Math.max(z1, a.z + ext);
        y0 = Math.min(y0, a.y); y1 = Math.max(y1, a.y + sy * (K.height || 1));
      }
      mesh.instanceMatrix.needsUpdate = true;
      const c = new THREE.Vector3((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
      mesh.boundingSphere = new THREE.Sphere(c, Math.hypot(x1 - x0, y1 - y0, z1 - z0) / 2 + 2);
      mesh.matrixAutoUpdate = false;
      this.group.add(mesh);
      b.meshes.push(mesh);
      this.total += arr.length;
    }
  }

  _dispose(k, p) {
    for (const c of p.colliders) this.world.colliders.remove(c);
    this.patches.delete(k);
    const b = this.batches.get(this._batchKey(p.i, p.j));
    if (b) { b.patches.delete(k); this.dirty.add(b); }
  }
}

// 가중치에 따라 지역 하나를 뽑는다 (경계에서는 두 지역의 식생이 자연스럽게 섞임)
function pickRegion(weight, rng) {
  const r = rng();
  let acc = 0;
  for (let i = 0; i < RC; i++) { acc += weight(i); if (r < acc) return i; }
  return RC - 1;
}

function variants(n, fn) { return Array.from({ length: n }, (_, i) => fn(i * 7919 + 13)); }

export class Flora {
  constructor(world, q) {
    this.world = world;
    this.q = q;
    const dens = q.flora;
    const blades = litMaterial({ vertexColors: true, vertexEmit: true, emissive: 0xffffff, emissiveIntensity: 1.1, emissiveNight: 1, wind: 0.22, windH: 1.4, side: THREE.DoubleSide, rim: 0.15, push: true });
    const plants = litMaterial({ vertexColors: true, vertexEmit: true, emissive: 0xffffff, emissiveIntensity: 1.3, emissiveNight: 1, wind: 0.08, windH: 1.6, side: THREE.DoubleSide, rim: 0.25 });
    const solid = litMaterial({ vertexColors: true, vertexEmit: true, emissive: 0xffffff, emissiveIntensity: 1.2, emissiveNight: 0.9, rim: 0.3 });
    const crystal = litMaterial({ vertexColors: true, vertexEmit: true, emissive: 0xffffff, emissiveIntensity: 1.1, emissiveNight: 0.7, rim: 0.9, rimColor: 0xffd8f0, spec: 1.2 });
    const giants = litMaterial({ vertexColors: true, vertexEmit: true, emissive: 0xffffff, emissiveIntensity: 1.25, emissiveNight: 1, rim: 0.35, rimColor: 0xb8a8ff, wind: 0.004, windH: 1 });
    this.materials = { blades, plants, solid, crystal, giants };

    // ── 1층: 가까운 풀 ───────────────────────────
    const reeds = variants(2, (s) => F.reedClump(s));
    const grass = variants(1, (s) => F.grassClump(s, 0x2f6a58, 0x8fcf9a, 0.5));
    const dry = variants(1, (s) => F.grassClump(s, 0x7a5a3a, 0xd8b878, 0.45));
    const frostGrass = variants(1, (s) => F.grassClump(s, 0x3a5a62, 0xb8d8d8, 0.35));
    const moss = variants(1, (s) => F.mossTuft(s));
    const pinkTuft = variants(1, (s) => F.grassClump(s, 0xa86a8a, 0xf8d0e0, 0.35));
    const K1 = [];
    const reg = (arr, mat) => arr.map((g) => K1.push({ geo: g, mat, height: 2 }) - 1);
    const kReeds = reg(reeds, blades), kGrass = reg(grass, blades), kDry = reg(dry, blades), kFrost = reg(frostGrass, blades), kMoss = reg(moss, blades), kPink = reg(pinkTuft, blades);
    const near = new ScatterLayer(world, {
      name: 'grass', patch: 16, radius: q.grassRadius, samples: 8, batch: 4, kinds: K1,
      gen: ({ x0, z0, size, rng, s, out }) => {
        const n = Math.floor(size * size * 0.42 * dens);
        for (let t = 0; t < n; t++) {
          const x = x0 + rng() * size, z = z0 + rng() * size;
          const h = s.height(x, z);
          if (h < 0.6) continue;
          const sl = s.slope(x, z);
          if (sl > 0.9) continue;
          const reg = pickRegion((i) => s.weight(x, z, i), rng);
          const pick = rng();
          let k = -1, sc = 1;
          if (h < 3.2) { if (pick < 0.15) { k = kGrass[0]; sc = 0.7; } }
          else if (reg === R.meadow) { if (pick < 0.95) { k = rng() < 0.75 ? kReeds[Math.floor(rng() * kReeds.length)] : kGrass[0]; sc = 0.8 + rng() * 0.5; } }
          else if (reg === R.bloom) { if (pick < 0.85) { k = kMoss[0]; sc = 0.8 + rng() * 0.6; } }
          else if (reg === R.glass) { if (pick < 0.2) { k = kPink[0]; sc = 0.6 + rng() * 0.5; } }
          else if (reg === R.canyon) { if (pick < 0.35) { k = kDry[0]; sc = 0.7 + rng() * 0.6; } }
          else if (reg === R.frost) { if (pick < 0.45 && h < 950) { k = kFrost[0]; sc = 0.6 + rng() * 0.5; } }
          else if (pick < 0.7) { k = kGrass[0]; sc = 0.7 + rng() * 0.5; }
          if (k < 0) continue;
          out.push({ k, x, y: h - 0.05, z, ry: rng() * 6.28, s: sc });
        }
      },
    });

    // ── 2층: 덤불·수정·바위 (가까운 중간 거리) ─────────────
    const K2 = [];
    const reg2 = (K, arr, mat, height = 2, width = 1) => arr.map((g) => K.push({ geo: g, mat, height, width }) - 1);
    const kBulbs = reg2(K2, variants(2, (s) => F.glowBulbs(s)), plants);
    const kFern = reg2(K2, variants(2, (s) => F.sailFern(s)), plants);
    const kCrys = reg2(K2, variants(2, (s) => F.crystalCluster(s)), crystal, 3);
    const kShroom = reg2(K2, variants(2, (s) => F.mushroomSmall(s)), plants, 3);
    const kBoulder = reg2(K2, variants(2, (s) => F.boulder(s)), solid, 1.5, 2);
    const kPinkBoulder = reg2(K2, variants(1, (s) => F.boulder(s, 0xe8b8c0, 0xb07888)), solid, 1.5, 2);
    const kRedBoulder = reg2(K2, variants(1, (s) => F.boulder(s, 0xd88858, 0x9a4a3a)), solid, 1.5, 2);
    const kIce = reg2(K2, variants(1, (s) => F.iceSpike(s)), crystal, 1.6);
    const kFan = reg2(K2, variants(1, (s) => F.seaFan(s)), plants, 1.4);
    const mid = new ScatterLayer(world, {
      name: 'mid', patch: 48, radius: 170 * q.farFlora, samples: 6, batch: 4, kinds: K2,
      gen: ({ x0, z0, size, rng, s, out }) => {
        const n = Math.floor(size * size * 0.009 * dens);
        for (let t = 0; t < n; t++) {
          const x = x0 + rng() * size, z = z0 + rng() * size;
          const h = s.height(x, z);
          const sl = s.slope(x, z);
          const reg = pickRegion((i) => s.weight(x, z, i), rng);
          const ry = rng() * 6.28;
          const push = (k, sc, extra) => out.push({ k, x, y: h - 0.1, z, ry, s: sc, ...extra });
          if (h < -1.5) {
            if (h > -6 && (reg === R.sea || reg === R.meadow) && rng() < 0.4) push(kFan[0], 0.8 + rng() * 0.8);
            continue;
          }
          if (sl > 1.1) { if (rng() < 0.25) push(reg === R.canyon ? kRedBoulder[0] : kBoulder[0], 0.8 + rng() * 2.2); continue; }
          if (h < 2.5) continue;
          const r2 = rng();
          switch (reg) {
            case R.meadow:
              if (r2 < 0.5) push(kBulbs[Math.floor(rng() * 2)], 0.8 + rng() * 0.7);
              else if (r2 < 0.85) push(kFern[Math.floor(rng() * 2)], 0.8 + rng() * 0.8);
              else push(kBoulder[Math.floor(rng() * 2)], 0.6 + rng() * 1.6);
              break;
            case R.bloom:
              if (r2 < 0.6) push(kShroom[Math.floor(rng() * 2)], 1 + rng() * 2.2);
              else if (r2 < 0.85) push(kBulbs[Math.floor(rng() * 2)], 1 + rng() * 0.8, { c: 0xc8b8ff });
              else push(kFern[0], 1 + rng(), { c: 0xb0a0ff });
              break;
            case R.glass:
              if (r2 < 0.55) push(kCrys[Math.floor(rng() * 2)], 0.8 + rng() * 2.6);
              else if (r2 < 0.75) push(kPinkBoulder[0], 0.8 + rng() * 2);
              break;
            case R.canyon:
              if (r2 < 0.4) push(kRedBoulder[0], 0.6 + rng() * 2.4);
              break;
            case R.frost:
              if (r2 < 0.4) push(kIce[0], 1 + rng() * 2.5);
              else if (r2 < 0.65) push(kBoulder[Math.floor(rng() * 2)], 0.8 + rng() * 2, { c: 0xdde8ff });
              break;
            default:
              if (r2 < 0.35) push(kBulbs[0], 0.8 + rng() * 0.6);
              else if (r2 < 0.5) push(kBoulder[Math.floor(rng() * 2)], 0.5 + rng() * 1.2);
          }
        }
      },
    });

    // ── 2.5층: 나무 (멀리까지) ─────────────
    const KT = [];
    const kLantern = reg2(KT, variants(3, (s) => F.lanternTree(s)), plants, 1.2);
    const kPine = reg2(KT, variants(2, (s) => F.frostPine(s)), plants, 1);
    const kWhip = reg2(KT, variants(2, (s) => F.whipTree(s)), plants, 1.2);
    const trees = new ScatterLayer(world, {
      name: 'trees', patch: 128, radius: 750 * q.farFlora, samples: 6, batch: 4, kinds: KT,
      gen: ({ x0, z0, size, rng, s, out }) => {
        const n = Math.floor(size * size * 0.0011 * dens);
        for (let t = 0; t < n; t++) {
          const x = x0 + rng() * size, z = z0 + rng() * size;
          const h = s.height(x, z);
          if (h < 0.8 || s.slope(x, z) > 0.8) continue;
          const reg = pickRegion((i) => s.weight(x, z, i), rng);
          const pick = rng();
          const ry = rng() * 6.28;
          if (h < 4) { if (rng() < 0.5 && (reg === R.sea || reg === R.meadow || reg === R.spine)) out.push({ k: kWhip[Math.floor(rng() * 2)], x, y: h - 0.2, z, ry, s: 6 + rng() * 7 }); continue; }
          if (reg === R.meadow && pick < 0.55) out.push({ k: kLantern[Math.floor(rng() * 3)], x, y: h - 0.2, z, ry, s: 7 + rng() * 9 });
          else if (reg === R.frost && h < 1000) out.push({ k: kPine[Math.floor(rng() * 2)], x, y: h - 0.3, z, ry, s: 7 + rng() * 10 });
          else if ((reg === R.sea || reg === R.spine) && pick < 0.25) out.push({ k: kWhip[0], x, y: h - 0.2, z, ry, s: 6 + rng() * 6 });
        }
      },
    });

    // ── 3층: 멀리서도 보이는 거대 식물·바위 ─────────────
    const K3 = [];
    const giantsGeo = variants(4, (s) => F.mushroomGiant(s));
    const kGiant = giantsGeo.map((g, i) => K3.push({ geo: g.geo, low: F.mushroomGiantLow(g), mat: giants, height: 1.2, width: 0.6, lodDist: 1400 }) - 1);
    const spires = variants(3, (s) => F.crystalSpire(s));
    const spireLow = F.crystalSpireLow();
    const kSpire = spires.map((g) => K3.push({ geo: g, low: spireLow, mat: crystal, height: 6.2, width: 1.5, lodDist: 1200 }) - 1);
    const hoodoos = variants(3, (s) => F.hoodoo(s));
    const kHoodoo = hoodoos.map((g) => K3.push({ geo: g.geo, mat: solid, height: 1.1, width: 0.3 }) - 1);
    const kBigPine = variants(2, (s) => F.frostPine(s + 99)).map((g) => K3.push({ geo: g, mat: plants, height: 1, width: 0.5 }) - 1);
    const kBigLantern = variants(2, (s) => F.lanternTree(s + 51)).map((g) => K3.push({ geo: g, mat: plants, height: 1.1, width: 0.6 }) - 1);
    const far = new ScatterLayer(world, {
      name: 'giants', patch: 512, radius: 7000 * q.farFlora, samples: 0, batch: 4, kinds: K3,
      gen: ({ x0, z0, size, rng, out }) => {
        const tries = 14;
        for (let t = 0; t < tries; t++) {
          const x = x0 + rng() * size, z = z0 + rng() * size;
          const h = heightAt(x, z, 1, _w);
          if (h < 1) continue;
          const reg = pickRegion((i) => _w[i], rng);
          const pick = rng();
          const ry = rng() * 6.28;
          if (reg === R.bloom && pick < 0.32) {
            const v = Math.floor(rng() * giantsGeo.length);
            const g = giantsGeo[v];
            const sc = 70 + rng() * 170;
            const top = g.top;
            const cs = Math.cos(ry), sn = Math.sin(ry);
            const tx = x + (top.x * cs + top.z * sn) * sc, tz = z + (-top.x * sn + top.z * cs) * sc;
            out.push({
              k: kGiant[v], x, y: h - 2, z, ry, s: sc,
              col: [
                { type: 'cyl', x, z, r: g.stalkR * sc * 1.6, y0: h - 5, y1: h + sc * 0.9, walk: false },
                { type: 'cyl', x: tx, z: tz, r: g.capR * sc, y0: h - 2 + top.y * sc - sc * 0.02, y1: h - 2 + (top.y + 0.125) * sc, dome: 0.09 * sc },
              ],
            });
          } else if (reg === R.glass && pick < 0.22) {
            const sc = 8 + rng() * 22;
            out.push({ k: kSpire[Math.floor(rng() * 3)], x, y: h - 3, z, ry, s: sc, rx: (rng() - 0.5) * 0.15, col: [{ type: 'cyl', x, z, r: 0.6 * sc, y0: h - 5, y1: h - 3 + 4.6 * sc }] });
          } else if (reg === R.canyon && pick < 0.35) {
            const v = Math.floor(rng() * 3);
            const sc = 25 + rng() * 55;
            out.push({ k: kHoodoo[v], x, y: h - 1, z, ry, s: sc, col: [{ type: 'cyl', x, z, r: 0.08 * sc, y0: h - 3, y1: h - 1 + hoodoos[v].height * sc }] });
          } else if (reg === R.frost && pick < 0.5 && h < 1000) {
            // 서리 숲: 큰 소나무 무리
            for (let k = 0; k < 6; k++) {
              const px = x + (rng() - 0.5) * 60, pz = z + (rng() - 0.5) * 60;
              const ph = heightAt(px, pz, 1);
              if (ph < 1 || ph > 1000) continue;
              out.push({ k: kBigPine[Math.floor(rng() * 2)], x: px, y: ph - 0.5, z: pz, ry: rng() * 6.28, s: 16 + rng() * 16 });
            }
          } else if (reg === R.meadow && pick < 0.12) {
            out.push({ k: kBigLantern[Math.floor(rng() * 2)], x, y: h - 0.5, z, ry, s: 24 + rng() * 18 });
          }
        }
      },
    });
    this.layers = [near, mid, trees, far];
    this.midLayer = mid;
    this.farLayer = far;
    this.crystalKinds = { mid: new Set(kCrys), far: new Set(kSpire), farH: 5, midH: 2 };
  }

  /** 근처의 수정 (공명 메아리용) */
  queryCrystals(x, z, r, max = 6) {
    const out = [];
    const scan = (layer, kinds, hMul) => {
      for (const p of layer.patches.values()) {
        const cx = (p.i + 0.5) * layer.patch, cz = (p.j + 0.5) * layer.patch;
        if (Math.hypot(cx - x, cz - z) > r + layer.patch) continue;
        for (const it of p.items) {
          if (!kinds.has(it.k)) continue;
          const d = Math.hypot(it.x - x, it.z - z);
          if (d < r && d > 2) out.push({ x: it.x, y: it.y + (it.sy ?? it.s) * hMul, z: it.z, d });
        }
      }
    };
    scan(this.farLayer, this.crystalKinds.far, this.crystalKinds.farH);
    scan(this.midLayer, this.crystalKinds.mid, this.crystalKinds.midH);
    out.sort((a, b) => a.d - b.d);
    return out.slice(0, max);
  }

  update(dt, ctx) {
    const cam = this.world.engine.camera.position;
    for (const l of this.layers) l.update(cam);
  }

  get count() { return this.layers.map((l) => l.total); }
}
