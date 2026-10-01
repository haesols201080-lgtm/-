// 쿼드트리 LOD 지형. 카메라 가까이는 촘촘하게, 멀리는 성기게 — 수십 km 앞까지 실제 지형을 그립니다.
import * as THREE from 'three';
import workerSrc from 'worker:./terrain-worker.js';
import { buildChunk, buildChunkIndex } from './terrain-mesher.js';
import { NOISE_GLSL, ATMOS_PARS, CURVE_GLSL } from './shaders.js';
import { atmosUniforms } from './atmosphere.js';

const ROOT = 65536;
const RES = 32;
const RES_LOW = 16; // 먼 청크(2 km 이상)는 성기게

const vert = /* glsl */ `
${CURVE_GLSL}
attribute vec3 glow;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vColor;
varying vec3 vGlow;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vNormal = normal;
  vColor = color;
  vGlow = glow;
  gl_Position = projectionMatrix * viewMatrix * vec4(curveWorld(wp.xyz), 1.0);
}`;

const frag = /* glsl */ `
${NOISE_GLSL}
${ATMOS_PARS}
varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vColor;
varying vec3 vGlow;
uniform vec3 uWaterDeep;
uniform vec3 uWaterShallow;

void main() {
  vec3 N = normalize(vNormal);
  vec2 xz = vWorld.xz;
  float dist = distance(vWorld, cameraPosition);
  float macro = vnoise(xz * 0.0021);
  float meso = vnoise(xz * 0.031);
  float near = smoothstep(160.0, 25.0, dist);
  float micro = (vnoise(xz * 0.45) - 0.5) * near + (vnoise(xz * 2.1) - 0.5) * smoothstep(30.0, 5.0, dist) * 0.6;
  vec3 alb = vColor * (0.8 + 0.28 * macro + 0.14 * meso + 0.22 * micro);
  float ao = mix(0.7, 1.0, N.y);

  // 물속: 깊이에 따라 빛이 흡수된다
  float depth = -vWorld.y;
  if (depth > 0.0) {
    float caust = pow(abs(sin(vnoise(xz * 0.25 + uTime * 0.12) * 9.0)), 6.0) * smoothstep(10.0, 0.0, depth);
    alb += caust * 0.2 * max(uSunDir.y, 0.0);
    float k = 1.0 - exp(-depth * 0.09);
    alb = mix(alb, uWaterShallow * 0.5, smoothstep(0.0, 3.0, depth) * 0.5);
    alb = mix(alb, uWaterDeep * 0.4, k);
  }

  vec3 col = shadeLit(alb, N, ao);

  // 물가의 거품
  float wave = sin(uTime * 0.9 + dot(xz, vec2(0.08, 0.05))) * 0.35;
  float foam = smoothstep(0.7, 0.0, abs(vWorld.y - wave * 0.6 - 0.15)) * (0.5 + 0.5 * vnoise(xz * 0.6 + uTime * 0.3));
  col += vec3(0.85, 0.95, 1.0) * foam * 0.35 * (uAmbTop + uSunColor * 0.3) * near;

  // 생물발광: 땅속을 흐르는 공명의 결
  if (dot(vGlow, vec3(1.0)) > 0.001) {
    vec2 q = xz * 0.028;
    float vein = abs(vnoise(q + vec2(uTime * 0.006, 0.0)) - 0.5);
    float line = smoothstep(0.035, 0.0, vein);
    float spots = smoothstep(0.86, 0.95, vnoise(xz * 0.22));
    float pulse = 0.55 + 0.45 * sin(dot(xz, vec2(0.012, 0.017)) - uTime * 1.3);
    float detail = (line * 0.8 + spots * 0.9) * pulse;
    float pat = mix(0.12, detail, smoothstep(900.0, 200.0, dist));
    col += vGlow * pat * uGlow * 1.6;
  }

  col = applySilence(col, silenceAt(xz));
  col = applyFog(col, vWorld);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function createTerrainMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...atmosUniforms,
      uWaterDeep: { value: new THREE.Color(0x0a3550) },
      uWaterShallow: { value: new THREE.Color(0x2fb5b0) },
    },
    vertexShader: vert,
    fragmentShader: frag,
    vertexColors: true,
  });
}

class Node {
  constructor(level, x0, z0, size) {
    this.level = level; this.x0 = x0; this.z0 = z0; this.size = size;
    this.key = `${level}:${x0}:${z0}`;
    this.mesh = null;
    this.pending = false;
    this.minH = 0; this.maxH = 0;
    this.lastUsed = 0;
  }
  get ready() { return this.mesh !== null; }
}

export class Terrain {
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.material = createTerrainMaterial();
    this.index = new THREE.BufferAttribute(buildChunkIndex(RES), 1);
    this.indexLow = new THREE.BufferAttribute(buildChunkIndex(RES_LOW), 1);
    this.lodFactor = opts.lodFactor ?? 2.0;
    this.minSize = 64;
    this.nodes = new Map();
    this.root = this._node(0, -ROOT / 2, -ROOT / 2, ROOT);
    this.queue = [];
    this.inflight = 0;
    this.frame = 0;
    this.group = new THREE.Group();
    this.group.name = 'terrain';
    scene.add(this.group);
    this.visibleCount = 0;
    this._cam = new THREE.Vector3();
    this._kids = [null, null, null, null];
    this._initWorkers(opts.workers ?? Math.min(3, Math.max(1, (navigator.hardwareConcurrency || 4) - 1)));
  }

  _initWorkers(count) {
    this.workers = [];
    this.callbacks = new Map();
    this.nextId = 1;
    try {
      const url = URL.createObjectURL(new Blob([workerSrc], { type: 'text/javascript' }));
      for (let i = 0; i < count; i++) {
        const w = new Worker(url);
        w.onmessage = (e) => this._onResult(e.data);
        w.onerror = () => this._workerFailed();
        w.busy = 0;
        this.workers.push(w);
      }
    } catch (err) {
      console.warn('[terrain] 워커를 만들 수 없어 메인 스레드에서 생성합니다', err);
      this.workers = [];
    }
  }

  /** 워커가 막힌 환경(엄격한 보안 정책 등): 메인 스레드로 전환하고 대기 중이던 작업을 다시 넣는다 */
  _workerFailed() {
    if (!this.workers.length) return;
    console.warn('[terrain] 워커 오류 — 메인 스레드에서 지형을 만듭니다');
    for (const w of this.workers) w.terminate();
    this.workers = [];
    for (const n of this.callbacks.values()) { n.pending = false; }
    this.callbacks.clear();
    this.inflight = 0;
  }

  _node(level, x0, z0, size) {
    const key = `${level}:${x0}:${z0}`;
    let n = this.nodes.get(key);
    if (!n) { n = new Node(level, x0, z0, size); this.nodes.set(key, n); }
    return n;
  }

  _children(n) {
    const h = n.size / 2;
    const c = this._kids;
    c[0] = this._node(n.level + 1, n.x0, n.z0, h);
    c[1] = this._node(n.level + 1, n.x0 + h, n.z0, h);
    c[2] = this._node(n.level + 1, n.x0, n.z0 + h, h);
    c[3] = this._node(n.level + 1, n.x0 + h, n.z0 + h, h);
    return [c[0], c[1], c[2], c[3]];
  }

  _distTo(n, p) {
    const dx = Math.max(n.x0 - p.x, 0, p.x - (n.x0 + n.size));
    const dz = Math.max(n.z0 - p.z, 0, p.z - (n.z0 + n.size));
    const top = n.ready ? n.maxH : 0, bot = n.ready ? n.minH : 0;
    const dy = Math.max(bot - p.y, 0, p.y - top);
    return Math.sqrt(dx * dx + dz * dz + dy * dy);
  }

  _wantSplit(n, p) {
    return n.size > this.minSize && this._distTo(n, p) < n.size * this.lodFactor;
  }

  _request(n, p) {
    if (n.ready || n.pending) return;
    n.pending = true;
    n.prio = this._distTo(n, p) / n.size;
    this.queue.push(n);
  }

  _detailFor(size) { return size <= 128 ? 2 : size <= 1024 ? 1 : 0; }
  _resFor(size) { return size >= 2048 ? RES_LOW : RES; }

  _onResult(d) {
    const n = this.callbacks.get(d.id);
    this.callbacks.delete(d.id);
    for (const w of this.workers) if (w.jobs && w.jobs.has(d.id)) { w.jobs.delete(d.id); w.busy--; }
    this.inflight--;
    this._stall = 0;
    if (!n || !n.pending) return;
    this._makeMesh(n, d);
  }

  _makeMesh(n, d) {
    n.pending = false;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(d.pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(d.nor, 3));
    g.setAttribute('color', new THREE.BufferAttribute(d.col, 3));
    g.setAttribute('glow', new THREE.BufferAttribute(d.glw, 3));
    g.setIndex(this._resFor(n.size) === RES ? this.index : this.indexLow);
    const hs = n.size / 2;
    const cy = (d.minH + d.maxH) / 2;
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(hs, cy, hs), Math.sqrt(hs * hs * 2 + ((d.maxH - d.minH) / 2 + 20) ** 2));
    const m = new THREE.Mesh(g, this.material);
    m.position.set(n.x0, 0, n.z0);
    m.matrixAutoUpdate = false;
    m.updateMatrix();
    m.visible = false;
    n.mesh = m;
    n.minH = d.minH; n.maxH = d.maxH;
    this.group.add(m);
  }

  _dispatch(budgetMs) {
    if (!this.queue.length) return;
    this.queue.sort((a, b) => a.prio - b.prio);
    if (this.workers.length) {
      const maxInflight = this.workers.length * 3;
      while (this.queue.length && this.inflight < maxInflight) {
        const n = this.queue.shift();
        if (!n.pending) continue;
        let w = this.workers[0];
        for (const x of this.workers) if (x.busy < w.busy) w = x;
        const id = this.nextId++;
        this.callbacks.set(id, n);
        w.jobs = w.jobs || new Set();
        w.jobs.add(id);
        w.busy++;
        this.inflight++;
        w.postMessage({ id, x0: n.x0, z0: n.z0, size: n.size, res: this._resFor(n.size), detail: this._detailFor(n.size) });
      }
    } else {
      const t0 = performance.now();
      while (this.queue.length && performance.now() - t0 < budgetMs) {
        const n = this.queue.shift();
        if (!n.pending) continue;
        this._makeMesh(n, buildChunk(n.x0, n.z0, n.size, this._resFor(n.size), this._detailFor(n.size)));
      }
    }
  }

  update(camPos, budgetMs = 6) {
    this.frame++;
    if (this.workers.length && this.inflight > 0) {
      this._stall = (this._stall || 0) + 1;
      if (this._stall > 600) this._workerFailed(); // 10초 넘게 응답이 없으면
    } else this._stall = 0;
    const p = this._cam.copy(camPos);
    for (const m of this.group.children) m.visible = false;
    this.visibleCount = 0;
    this._visit(this.root, p);
    this._dispatch(budgetMs);
    if (this.frame % 120 === 0) this._evict();
  }

  _visit(n, p) {
    n.lastUsed = this.frame;
    if (this._wantSplit(n, p)) {
      const ch = this._children(n);
      let all = true;
      for (const c of ch) {
        c.lastUsed = this.frame;
        if (!c.ready) { all = false; this._request(c, p); }
      }
      if (all || !n.ready) {
        if (all) { for (const c of ch) this._visit(c, p); return; }
      }
    }
    if (n.ready) {
      // 깊은 바다 밑 지형은 멀리서는 물에 가려 보이지 않으므로 그리지 않는다
      const deep = n.maxH < -18 && this._distTo(n, p) > 2200;
      n.mesh.visible = !deep;
      if (!deep) this.visibleCount++;
    } else this._request(n, p);
  }

  _evict() {
    for (const [key, n] of this.nodes) {
      if (n.level === 0) continue;
      if (this.frame - n.lastUsed > 600) {
        if (n.mesh) {
          this.group.remove(n.mesh);
          n.mesh.geometry.dispose();
          n.mesh = null;
        }
        n.pending = false;
        this.nodes.delete(key);
      }
    }
  }

  /** 현재 필요한 청크가 모두 준비되었는가 (로딩 화면용) */
  get settled() { return this.queue.length === 0 && this.inflight === 0; }
}
