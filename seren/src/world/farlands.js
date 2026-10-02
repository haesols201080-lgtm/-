// 바다 건너 먼 땅의 큰 구조물.
//  · 현(깊은목)        — 균열 양쪽 절벽에 매달린 집들, 협곡을 가로지르는 2 km 빛다리, 바닥에서 위로 오르는 승강 기둥
//  · 세렌의 심장 기관  — 균열 바닥의 자이로 고리 셋과 박동하는 결정 심장, 벽을 타고 오르는 빛줄기
//  · 옛 거신의 뼈(느린땅) — 반쯤 묻힌 거대한 갈비뼈
//  · 큰 귀(흰 숨)       — 우르를 향해 기울어 선 지름 420 m 의 고리와 진동하는 막
//  · 빛의 폭포(천 폭포 고원) — 고원 절벽을 흘러내리는 빛의 장막들
//  · 하늘 주조소        — 고원 위 2.3 km 에 떠 있는 섬과 그 둘레를 도는 작은 섬들
import * as THREE from 'three';
import { heightAt } from './heightfield.js';
import { mulberry32 } from '../core/noise.js';
import { part, merge, xf, lathe, tube } from './geo-utils.js';
import * as A from './arch.js';
import { litMaterial, glowMaterial } from './materials.js';
import { CURVE_GLSL, ATMOS_PARS, NOISE_GLSL } from './shaders.js';
import { atmosUniforms } from './atmosphere.js';
import { PointLights } from './lights.js';
import { PLACE } from '../data/places.js';
import { UR_DIR } from './sky-clock.js';

const PAL = A.PAL;

// 흘러내리는/흘러오르는 빛 (uSpeed < 0 이면 아래로)
function flowMaterial(color, speed = -0.5, density = 10, cols = 24) {
  return new THREE.ShaderMaterial({
    uniforms: { ...atmosUniforms, uColor: { value: new THREE.Color(color) }, uSpeed: { value: speed }, uDens: { value: density }, uCols: { value: cols }, uI: { value: 1 } },
    vertexShader: `${CURVE_GLSL}
      varying vec2 vUv; varying vec3 vWorld;
      void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position,1.0); vWorld = wp.xyz; gl_Position = projectionMatrix * viewMatrix * vec4(curveWorld(wp.xyz),1.0); }`,
    fragmentShader: `${NOISE_GLSL}
      ${ATMOS_PARS}
      uniform vec3 uColor; uniform float uSpeed; uniform float uDens; uniform float uCols; uniform float uI;
      varying vec2 vUv; varying vec3 vWorld;
      void main(){
        float col = floor(vUv.x * uCols);
        float h = hash12(vec2(col, 3.0));
        float f = fract(vUv.y * uDens * (0.7 + h * 0.6) + uTime * uSpeed * (0.6 + h * 0.8) + h * 10.0);
        float streak = smoothstep(0.0, 0.25, f) * smoothstep(1.0, 0.45, f);
        float edge = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
        float body = 0.35 + 0.65 * streak;
        float mist = smoothstep(0.25, 0.0, vUv.y);
        float fog = fogAmount(cameraPosition, vWorld);
        vec3 c = uColor * body * edge * (0.7 + 0.7 * clamp(uGlow, 0.0, 1.0)) * uI + vec3(0.8, 0.95, 1.0) * mist * 0.5 * edge;
        gl_FragColor = vec4(c * (1.0 - fog), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
}

// 큰 귀의 진동하는 막: 동심원 물결
function membraneMaterial(color) {
  return new THREE.ShaderMaterial({
    uniforms: { ...atmosUniforms, uColor: { value: new THREE.Color(color) }, uI: { value: 0.5 } },
    vertexShader: `${CURVE_GLSL}
      varying vec2 vUv; varying vec3 vWorld;
      void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position,1.0); vWorld = wp.xyz; gl_Position = projectionMatrix * viewMatrix * vec4(curveWorld(wp.xyz),1.0); }`,
    fragmentShader: `${NOISE_GLSL}
      ${ATMOS_PARS}
      uniform vec3 uColor; uniform float uI;
      varying vec2 vUv; varying vec3 vWorld;
      void main(){
        vec2 c = vUv - 0.5;
        float r = length(c) * 2.0;
        float w = 0.5 + 0.5 * sin(r * 40.0 - uTime * 1.6) * sin(atan(c.y, c.x) * 3.0 + uTime * 0.2 + r * 6.0);
        float rim = smoothstep(0.75, 1.0, r);
        float a = (w * 0.5 + rim * 0.8) * smoothstep(1.0, 0.97, r);
        float fog = fogAmount(cameraPosition, vWorld);
        gl_FragColor = vec4(uColor * a * uI * (0.6 + 0.6 * clamp(uGlow, 0.0, 1.0)) * (1.0 - fog), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
}

export class Farlands {
  constructor(world, structures) {
    this.world = world;
    this.structures = structures;
    this.scene = world.scene;
    this.group = new THREE.Group();
    this.group.name = 'farlands';
    this.scene.add(this.group);
    this.mat = litMaterial({ vertexColors: true, vertexEmit: true, windows: true, emissive: 0xffffff, emissiveIntensity: 1.5, emissiveNight: 0.8, rim: 0.6, spec: 0.9, side: THREE.DoubleSide });
    this.lights = new PointLights(this.scene, 700, { minPx: 1.8, day: 0.3 });
    this.anims = [];
    this.movers = []; // 움직이는 발판 {obj, col}
    this.t = 0;
    const B = { hyeon: this._riftCity, 'rift-core': this._riftCore, bones: this._bones, 'great-ear': this._greatEar, 'sky-forge': this._skyForge };
    for (const [id, fn] of Object.entries(B)) if (PLACE[id]) fn.call(this, PLACE[id]);
    this._lightFalls();
  }

  _col(c) { return this.world.colliders.add(c); }
  _add(parts, mat = this.mat) { if (!parts.length) return null; const m = new THREE.Mesh(merge(parts), mat); m.matrixAutoUpdate = false; this.group.add(m); return m; }

  // 균열 바닥의 가운데 x (그 z 에서 가장 낮은 곳)
  _riftCenter(z, guess) {
    let best = 1e9, bx = guess;
    for (let x = guess - 1600; x <= guess + 1600; x += 25) { const h = heightAt(x, z); if (h < best) { best = h; bx = x; } }
    return { x: bx, h: best };
  }
  // 그 높이에서 벽면의 x (side = -1 서쪽, +1 동쪽)
  _wallX(z, y, side, cx) {
    let x = cx;
    for (let i = 0; i < 300; i++) { x += side * 10; if (heightAt(x, z) > y) return x; }
    return x;
  }

  // ── 현: 매달린 도시 ─────────────────────
  _riftCity(P) {
    const [gx, z0] = P.pos;
    const rnd = mulberry32(4040);
    const parts = [];
    const glows = [PAL.rose, PAL.violet, PAL.teal, PAL.amber];
    for (let z = z0 - 750; z <= z0 + 750; z += 150) {
      const c = this._riftCenter(z, gx);
      for (const y of [200, 330, 460, 590, 720, 850]) {
        for (const side of [-1, 1]) {
          if (rnd() > 0.5) continue;
          const wx = this._wallX(z, y, side, c.x);
          const r = 10 + rnd() * 10;
          const px = wx - side * r * 0.85, pz = z + (rnd() - 0.5) * 40;
          A.place(parts, A.petal({ r, depth: r * 0.5, glow: glows[Math.floor(rnd() * 4)] }), { x: px, y, z: pz });
          // 벽에 박힌 받침
          parts.push(part(xf(new THREE.BoxGeometry(r * 1.1, 2.4, 3), { x: px + side * r * 0.75, y: y - r * 0.25, z: pz, rz: side * 0.5 }), 0xd8d0e6, 0));
          const k = Math.floor(rnd() * 3);
          for (let j = 0; j < k; j++) {
            const hr = 3 + rnd() * 3, b = rnd() * Math.PI * 2, d = rnd() * r * 0.45;
            const hx = px + Math.cos(b) * d, hz = pz + Math.sin(b) * d;
            A.place(parts, A.domeHouse({ r: hr, h: hr * 1.25, seed: Math.floor(y + z + j), glow: glows[(j + 1) % 4] }), { x: hx, y, z: hz });
            this._col({ type: 'cyl', x: hx, z: hz, r: hr * 0.95, y0: y, y1: y + hr * 1.2, dome: hr * 0.6 });
          }
          if (k === 0 && rnd() < 0.5) A.place(parts, A.spireTower({ h: 20 + rnd() * 30, r: 2.4, seed: Math.floor(y * z), glow: glows[k] }), { x: px, y, z: pz });
          this._col({ type: 'cyl', x: px, z: pz, r: r * 0.96, y0: y - r * 0.3, y1: y + 0.02 });
          this.lights.add(px - side * r, y - 2, pz, glows[Math.floor(rnd() * 4)], 5, 0, 0);
        }
      }
    }
    // 절벽에 새긴 큰 집채(파사드): 벽에 반쯤 박힌 유리 석판들
    for (let z = z0 - 820; z <= z0 + 820; z += 120) {
      const c = this._riftCenter(z, gx);
      for (const side of [-1, 1]) {
        if (rnd() < 0.3) continue;
        const H = 120 + rnd() * 260, W = 40 + rnd() * 60, Dp = 26;
        const yc = 160 + rnd() * (760 - H * 0.5);
        const wx = this._wallX(z, yc, side, c.x);
        const fx = wx - side * (Dp / 2 - 8);
        const glow = glows[Math.floor(rnd() * 4)];
        const slab = [
          part(new THREE.BoxGeometry(Dp, H, W), (px, py, pz) => (Math.abs(pz) > W / 2 - 3 || Math.abs(py) > H / 2 - 3 ? 0xe8e2ee : 0xa8b4c8), 0, -3.4),
          part(xf(new THREE.BoxGeometry(1, H - 6, 1.2), { x: -side * (Dp / 2 + 0.5), z: W / 2 - 3 }), glow, 1.6),
          part(xf(new THREE.BoxGeometry(1, H - 6, 1.2), { x: -side * (Dp / 2 + 0.5), z: -W / 2 + 3 }), glow, 1.6),
          part(xf(new THREE.BoxGeometry(Dp + 6, 3, W + 6), { y: H / 2 + 1.5 }), PAL.gold, 0.6),
        ];
        // 층마다 내민 발코니
        for (let yy = -H / 2 + 30; yy < H / 2 - 10; yy += 46) slab.push(part(xf(new THREE.BoxGeometry(10, 1.2, W * 0.8), { x: -side * (Dp / 2 + 5), y: yy }), 0xe8e2ee, 0), part(xf(new THREE.BoxGeometry(0.3, 0.3, W * 0.8), { x: -side * (Dp / 2 + 10), y: yy + 1.2 }), 0xbffcff, 1.6));
        for (const q of slab) parts.push(xf(q, { x: fx, y: yc, z }));
        this._col({ type: 'box', x: fx, z, hx: Dp / 2, hz: W / 2, rot: 0, y0: yc - H / 2, y1: yc + H / 2 + 3 });
        this.lights.add(fx - side * (Dp / 2 + 2), yc + H / 2 + 4, z, 0xff5a4a, 8, 0.5, rnd());
      }
    }
    this._add(parts);
    // 협곡을 가로지르는 빛다리 (2 km)
    for (const [bz, by] of [[z0 - 420, 900], [z0 + 380, 960]]) {
      const c = this._riftCenter(bz, gx);
      const x0 = this._wallX(bz, by, -1, c.x) - 30, x1 = this._wallX(bz, by, 1, c.x) + 30;
      const L = x1 - x0;
      const bp = [part(new THREE.BoxGeometry(L, 2, 9, Math.round(L / 40)), 0xe8e2f0, 0)];
      for (const s of [-1, 1]) {
        bp.push(part(xf(new THREE.BoxGeometry(L, 0.3, 0.3), { y: 1.6, z: s * 4.2 }), 0xbffcff, 1.8));
        bp.push(part(xf(new THREE.BoxGeometry(L, 0.6, 0.8), { y: -1.2, z: s * 4 }), PAL.rose, 1.4));
      }
      // 현처럼 늘어진 줄 (아래로 휜 빛줄)
      const pts = [];
      for (let i = 0; i <= 20; i++) { const t = i / 20; pts.push(new THREE.Vector3(-L / 2 + L * t, -4 - Math.sin(Math.PI * t) * 120, 0)); }
      bp.push(part(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.8, 4), PAL.rose, 1.6));
      for (let i = 1; i < 20; i += 2) { const t = i / 20; const y = -4 - Math.sin(Math.PI * t) * 120; bp.push(part(xf(new THREE.BoxGeometry(0.3, -y, 0.3), { x: -L / 2 + L * t, y: y / 2 }), 0xbffcff, 1.2)); }
      this._add(bp.map((p) => xf(p, { x: (x0 + x1) / 2, y: by, z: bz })));
      this._col({ type: 'box', x: (x0 + x1) / 2, z: bz, hx: L / 2, hz: 4.5, rot: 0, y0: by - 3, y1: by + 1 });
      for (let i = 0; i <= 24; i++) this.lights.add(x0 + (L * i) / 24, by + 2, bz, PAL.rose, 4, 0, 0);
    }
    // 바닥 ↔ 가장자리 승강 기둥
    for (const [lz, side] of [[z0 - 120, -1], [z0 + 160, 1]]) {
      const c = this._riftCenter(lz, gx);
      const lx = this._wallX(lz, 120, side, c.x) - side * 70;
      const rimX = this._wallX(lz, 960, side, c.x) + side * 120;
      const top = heightAt(rimX, lz) + 2;
      const L = this.structures._makeLift(lx, lz, heightAt(lx, lz), top, [side, 0], 8);
      L.topPos = [rimX, lz];
    }
    // 균열 속 상승 기류
    for (const dz of [-500, 0, 500]) {
      const c = this._riftCenter(z0 + dz, gx);
      this.world.updrafts.push({ x: c.x, z: z0 + dz, r: 70, y0: c.h, y1: 1150, strength: 24 });
    }
    this.structures.resonators.push({ x: gx, y: 600, z: z0 });
  }

  // ── 세렌의 심장 기관 ───────────────────
  _riftCore(P) {
    const [gx, z] = P.pos;
    const c = this._riftCenter(z, gx);
    const x = c.x, g = c.h;
    const parts = [];
    parts.push(part(new THREE.CylinderGeometry(170, 180, 8, 64).translate(0, -2, 0), 0x6a5a78, 0));
    for (const rr of [80, 130, 165]) parts.push(part(xf(new THREE.RingGeometry(rr - 1.5, rr + 1.5, 64), { y: 2.1, rx: -Math.PI / 2 }), PAL.rose, 1.6));
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      parts.push(part(xf(lathe([[10, 0], [7, 40], [4, 90]], 8), { x: Math.cos(a) * 150, z: Math.sin(a) * 150 }), 0xd8d0e6, 0));
      parts.push(part(xf(new THREE.OctahedronGeometry(6, 0), { x: Math.cos(a) * 150, y: 96, z: Math.sin(a) * 150, sy: 1.8 }), PAL.rose, 2));
      this._col({ type: 'cyl', x: x + Math.cos(a) * 150, z: z + Math.sin(a) * 150, r: 9, y0: g - 2, y1: g + 90, walk: false });
    }
    this._add(parts.map((p) => xf(p, { x, y: g, z })));
    this._col({ type: 'cyl', x, z, r: 175, y0: g - 8, y1: g + 2 });
    // 자이로 고리 셋
    const Y = g + 260;
    const rings = [[230, 9, 0xe4dcef], [175, 7, 0xd8d0e6], [120, 6, 0xeae4f4]].map(([r, t, col], i) => {
      const geo = merge([part(new THREE.TorusGeometry(r, t, 10, 96), col, 0), part(new THREE.TorusGeometry(r - t - 1, 1.2, 4, 96), [PAL.rose, PAL.teal, PAL.amber][i], 2)]);
      const m = new THREE.Mesh(geo, this.mat);
      m.position.set(x, Y, z);
      this.group.add(m);
      return m;
    });
    const heart = new THREE.Mesh(new THREE.IcosahedronGeometry(46, 2), litMaterial({ color: 0xffe8f6, emissive: PAL.rose, emissiveIntensity: 1.6, emissiveNight: 0.4, rim: 1.6, rimColor: 0xffffff, spec: 2 }));
    heart.position.set(x, Y, z);
    const halo = new THREE.Mesh(new THREE.IcosahedronGeometry(70, 2), glowMaterial({ color: PAL.rose, intensity: 0.5, fresnel: 1 }));
    halo.position.copy(heart.position);
    this.group.add(heart, halo);
    this.anims.push((t) => {
      rings[0].rotation.set(t * 0.11, 0, t * 0.05);
      rings[1].rotation.set(Math.PI / 2, t * 0.17, 0);
      rings[2].rotation.set(t * 0.23, t * 0.13, Math.PI / 3);
      const beat = Math.pow(Math.max(0, Math.sin(t * 2.2)), 8);
      heart.scale.setScalar(1 + beat * 0.08);
      halo.scale.setScalar(1 + beat * 0.25);
      halo.material.uniforms.uIntensity.value = 0.35 + beat * 0.8;
    });
    // 벽을 타고 오르는 빛줄기
    for (const side of [-1, 1]) {
      for (let k = 0; k < 5; k++) {
        const zz = z - 260 + k * 130;
        const cc = this._riftCenter(zz, x);
        const pts = [];
        for (let y = cc.h + 2; y < 1000; y += 45) pts.push(new THREE.Vector3(this._wallX(zz, y, side, cc.x) - side * 3, y, zz));
        if (pts.length < 3) continue;
        const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 2, 2.2, 4), flowMaterial(PAL.rose, 0.6, 30, 4));
        this.group.add(m);
      }
    }
    this.world.updrafts.push({ x, z, r: 110, y0: g, y1: 1200, strength: 28 });
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; this.lights.add(x + Math.cos(a) * 240, Y, z + Math.sin(a) * 240, PAL.rose, 10, 0, 0); }
    this.core = { x, y: Y, z, heart };
    this.structures.resonators.push({ x, y: Y, z });
  }

  // ── 옛 거신의 뼈 ──────────────────────
  _bones(P) {
    const [cx, cz] = P.pos;
    const parts = [];
    const bone = 0xe8dcc4;
    const yaw = 0.4;
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    const at = (u, v) => ({ x: cx + cs * u - sn * v, z: cz + sn * u + cs * v });
    for (let i = 0; i < 13; i++) {
      const u = -420 + i * 64;
      const k = Math.sin(Math.PI * (i + 1) / 14);
      const H = 60 + 170 * k, W = 70 + 120 * k;
      const pts = [];
      for (let j = 0; j <= 8; j++) {
        const t = j / 8;
        const a = Math.PI * t;
        const v = -Math.cos(a) * W;
        const p = at(u + Math.sin(a * 2) * 6, v);
        pts.push(new THREE.Vector3(p.x, heightAt(p.x, p.z) - 8 + Math.sin(a) * H * (t < 0.5 ? 1 : 0.85), p.z));
      }
      parts.push(part(tube(pts, 5 + 5 * k, 7, 30, (t) => 1.1 - 0.5 * Math.sin(Math.PI * t)), bone, 0));
      // 뼈 속에 남은 빛 (옛 공명)
      parts.push(part(xf(new THREE.OctahedronGeometry(2.4 + 2 * k, 0), { x: pts[4].x, y: pts[4].y - 6, z: pts[4].z }), PAL.amber, 1.4));
    }
    // 등뼈
    const spine = [];
    for (let i = 0; i <= 14; i++) { const p = at(-460 + i * 66, 0); const k = Math.sin(Math.PI * i / 14); spine.push(new THREE.Vector3(p.x, heightAt(p.x, p.z) + 40 + 190 * k, p.z)); }
    parts.push(part(tube(spine, 12, 8, 60), bone, 0));
    // 머리뼈
    const hp = at(560, 0);
    parts.push(part(xf(lathe([[0.0001, 0], [70, 10], [95, 60], [80, 130], [40, 175], [0.0001, 185]], 18), { x: hp.x, y: heightAt(hp.x, hp.z) - 30, z: hp.z, rz: 0.5, ry: yaw }), bone, 0));
    this._col({ type: 'cyl', x: hp.x, z: hp.z, r: 85, y0: heightAt(hp.x, hp.z) - 30, y1: heightAt(hp.x, hp.z) + 120, dome: 80 });
    this._add(parts);
    this.structures.resonators.push({ x: cx, y: heightAt(cx, cz) + 120, z: cz });
  }

  // ── 큰 귀 ──────────────────────────────
  _greatEar(P) {
    const [cx, cz] = P.pos;
    const g = heightAt(cx, cz);
    const R = 210;
    const parts = [];
    parts.push(part(new THREE.CylinderGeometry(170, 190, 22, 48).translate(0, -9, 0), 0xcfe0ea, 0));
    for (const rr of [120, 160]) parts.push(part(xf(new THREE.RingGeometry(rr - 1.5, rr + 1.5, 64), { y: 2.1, rx: -Math.PI / 2 }), 0x9fd8ff, 1.6));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      A.place(parts, A.domeHouse({ r: 8, h: 10, seed: 700 + i, glow: 0x9fd8ff }), { x: Math.cos(a) * 130, y: 2, z: Math.sin(a) * 130 });
      this._col({ type: 'cyl', x: cx + Math.cos(a) * 130, z: cz + Math.sin(a) * 130, r: 7.6, y0: g, y1: g + 12, dome: 5 });
    }
    this._add(parts.map((p) => xf(p, { x: cx, y: g, z: cz })));
    this._col({ type: 'cyl', x: cx, z: cz, r: 185, y0: g - 20, y1: g + 2 });
    // 우르를 향한 고리
    const ear = new THREE.Group();
    const el = Math.asin(UR_DIR.y);
    ear.position.set(cx, g + R * Math.cos(el) + 30, cz);
    ear.lookAt(cx + UR_DIR.x * 1000, ear.position.y + UR_DIR.y * 1000, cz + UR_DIR.z * 1000);
    this.group.add(ear);
    const eg = [part(new THREE.TorusGeometry(R, 16, 12, 128), (x, y) => (y > R * 0.8 ? 0xeaf6ff : 0xc8dce8), 0)];
    eg.push(part(new THREE.TorusGeometry(R - 18, 2, 4, 128), 0x9fd8ff, 2));
    for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; eg.push(part(xf(new THREE.BoxGeometry(14, 30, 30), { x: Math.cos(a) * R, y: Math.sin(a) * R, rz: a }), PAL.gold, 0.4)); }
    // 안쪽 고리들 (나팔처럼)
    for (const [r, zz] of [[150, -60], [100, -110], [56, -150]]) eg.push(part(xf(new THREE.TorusGeometry(r, 5, 8, 96), { z: zz }), 0xdcecf6, 0), part(xf(new THREE.TorusGeometry(r - 6, 1, 4, 96), { z: zz }), 0x9fd8ff, 1.6));
    ear.add(new THREE.Mesh(merge(eg), this.mat));
    const mem = new THREE.Mesh(new THREE.CircleGeometry(R - 20, 96), membraneMaterial(0x9fd8ff));
    ear.add(mem);
    // 받침 팔
    for (const s of [-1, 1]) {
      const p0 = new THREE.Vector3(cx + s * 140 * Math.cos(0.2), g, cz + s * 140 * Math.sin(0.2));
      const p1 = new THREE.Vector3(s * R, 0, 0).applyMatrix4(ear.matrixWorld.clone().compose(ear.position, ear.quaternion, new THREE.Vector3(1, 1, 1)));
      const m = new THREE.Mesh(merge([part(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([p0, p0.clone().lerp(p1, 0.5).add(new THREE.Vector3(0, 40, 0)), p1]), 20, 9, 8), 0xd8e4ee, 0)]), this.mat);
      this.group.add(m);
    }
    this.anims.push((t) => { mem.material.uniforms.uI.value = 0.35 + 0.15 * Math.sin(t * 0.7); });
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; const p = new THREE.Vector3(Math.cos(a) * (R + 20), Math.sin(a) * (R + 20), 0); ear.updateMatrixWorld(); p.applyMatrix4(ear.matrixWorld); this.lights.add(p.x, p.y, p.z, 0x9fd8ff, 10, 0, 0); }
    this.ear = { x: cx, y: ear.position.y, z: cz, mem };
    this.structures.resonators.push({ x: cx, y: ear.position.y, z: cz });
  }

  // ── 빛의 폭포 ─────────────────────────
  _lightFalls() {
    const reg = { x: -42000, z: 6000 };
    const found = [];
    for (let a = 0; a < Math.PI * 2; a += 0.025) {
      const ca = Math.cos(a), sa = Math.sin(a);
      for (let r = 4000; r < 17000; r += 80) {
        const x = reg.x + ca * r, z = reg.z + sa * r;
        const h = heightAt(x, z, 1);
        if (h < 1150) break;
        const h2 = heightAt(x + ca * 500, z + sa * 500, 1);
        if (h2 < 500) { found.push({ a, r, x, z, h }); break; }
      }
    }
    const chosen = [];
    for (const f of found) if (chosen.every((c) => Math.abs(Math.atan2(Math.sin(c.a - f.a), Math.cos(c.a - f.a))) > 0.32)) chosen.push(f);
    const rnd = mulberry32(1000);
    for (const f of chosen.slice(0, 16)) {
      const ca = Math.cos(f.a), sa = Math.sin(f.a);
      // 바닥(바다나 아래 땅)까지
      let r2 = f.r;
      for (; r2 < f.r + 3000; r2 += 40) if (heightAt(reg.x + ca * r2, reg.z + sa * r2, 1) < 8) break;
      const bx = reg.x + ca * r2, bz = reg.z + sa * r2;
      const by = Math.max(0, heightAt(bx, bz, 1)) + 2;
      const W = 110 + rnd() * 180;
      // 위 → 아래로 늘어진 장막 (절벽에서 조금 띄워)
      const top = new THREE.Vector3(f.x - ca * 10, f.h + 4, f.z - sa * 10);
      const bot = new THREE.Vector3(bx + ca * 60, by, bz + sa * 60);
      const n = 24;
      const g = new THREE.PlaneGeometry(W, 1, 1, n);
      const pos = g.attributes.position;
      const sideX = -sa, sideZ = ca;
      for (let i = 0; i < pos.count; i++) {
        const u = pos.getX(i) / W; // -0.5..0.5
        const v = pos.getY(i) + 0.5; // 0(아래)..1(위)
        // 절벽을 따라 약간 휘어 떨어진다
        const t = 1 - v;
        const px = top.x + (bot.x - top.x) * t + sideX * u * W * (1 + t * 0.4);
        const pz = top.z + (bot.z - top.z) * t + sideZ * u * W * (1 + t * 0.4);
        const py = top.y + (bot.y - top.y) * Math.pow(t, 0.8) + Math.sin(t * Math.PI) * 30;
        const ground = heightAt(px, pz, 1);
        pos.setXYZ(i, px, Math.max(py, ground + 6), pz);
      }
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, flowMaterial(0x7fe8ff, 0.5, 14, 32));
      m.frustumCulled = false;
      this.group.add(m);
      // 물안개
      this.lights.add(bot.x, by + 40, bot.z, 0xd8fbff, 80, 0, 0);
      this.lights.add(top.x, top.y + 10, top.z, 0x7fe8ff, 18, 0, 0);
    }
    this.fallsCount = Math.min(16, chosen.length);
  }

  // ── 하늘 주조소 ───────────────────────
  _skyForge(P) {
    const [cx, cz] = P.pos;
    const Y = 2350;
    const rnd = mulberry32(2350);
    const parts = [];
    // 섬: 위는 평평, 아래는 뾰족 (빛나는 맥)
    parts.push(part(lathe([[0.0001, -300], [40, -260], [110, -160], [170, -60], [205, -14], [210, 0], [0.0001, 0]], 40), (x, y) => (y > -6 ? 0x6a8a7a : [0x5a6a80, 0x7a8aa0, 0x4e5a70][Math.floor(-y / 30) % 3]), (x, y) => (Math.abs(((-y) % 60) - 30) < 2 ? 1.2 : 0)));
    parts.push(part(xf(new THREE.RingGeometry(0.0001, 206, 40), { y: 0.3, rx: -Math.PI / 2 }), 0x5f9a7a, 0));
    // 용광로 돔 + 탑 + 작업대
    parts.push(part(xf(lathe([[52, 0], [50, 18], [40, 38], [22, 52], [0.0001, 56]], 32), {}), (x, y) => (y > 50 ? PAL.gold : 0xe8e2ec), (x, y) => (y < 8 ? 1.4 : 0), 52 / 3.4));
    parts.push(part(xf(new THREE.CylinderGeometry(14, 18, 4, 24), { y: 58 }), 0xffa040, 2.2));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.4, d = 120 + rnd() * 50;
      A.place(parts, A.spireTower({ h: 60 + rnd() * 80, r: 5 + rnd() * 3, seed: 2350 + i, glow: i % 2 ? PAL.amber : 0x7fe8ff, pods: 2 }), { x: Math.cos(a) * d, y: 0, z: Math.sin(a) * d });
      this._col({ type: 'cyl', x: cx + Math.cos(a) * d, z: cz + Math.sin(a) * d, r: 7, y0: Y - 2, y1: Y + 50 });
    }
    // 크레인 팔
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 1.1;
      parts.push(part(xf(new THREE.BoxGeometry(160, 4, 4), { x: Math.cos(a) * 150, y: 80, z: Math.sin(a) * 150, ry: -a }), 0xe4dfec, 0, -3.4));
      parts.push(part(xf(new THREE.BoxGeometry(6, 80, 6), { x: Math.cos(a) * 80, y: 40, z: Math.sin(a) * 80 }), 0xe4dfec, 0, -3.4));
    }
    this._add(parts.map((p) => xf(p, { x: cx, y: Y, z: cz })));
    this._col({ type: 'cyl', x: cx, z: cz, r: 206, y0: Y - 40, y1: Y + 0.3 });
    this._col({ type: 'cyl', x: cx, z: cz, r: 50, y0: Y, y1: Y + 56, dome: 30 });
    // 둘레를 도는 큰 고리
    const ring = new THREE.Mesh(merge([part(new THREE.TorusGeometry(330, 4, 8, 160), 0xe8e2ec, 0), part(new THREE.TorusGeometry(324, 1.2, 4, 160), 0x7fe8ff, 2)]), this.mat);
    ring.position.set(cx, Y - 30, cz);
    ring.rotation.x = Math.PI / 2;
    this.group.add(ring);
    // 둘레를 도는 작은 섬 셋 (내려앉을 수 있다)
    const sats = [];
    for (let i = 0; i < 3; i++) {
      const r = 55 + i * 12;
      const sp = [part(lathe([[0.0001, -110], [30, -80], [r * 0.85, -20], [r, 0], [0.0001, 0]], 20), (x, y) => (y > -4 ? 0x6a8a7a : 0x5a6a80), (x, y) => (Math.abs(((-y) % 40) - 20) < 1.5 ? 1.2 : 0)), part(xf(new THREE.RingGeometry(0.0001, r - 1, 20), { y: 0.2, rx: -Math.PI / 2 }), 0x5f9a7a, 0)];
      A.place(sp, A.domeHouse({ r: 10, h: 12, seed: 300 + i, glow: PAL.amber }), {});
      const obj = new THREE.Object3D();
      const m = new THREE.Mesh(merge(sp), this.mat);
      obj.add(m);
      this.group.add(obj);
      const col = this._col({ type: 'cyl', x: 0, z: 0, r: r - 2, y0: -30, y1: 0.2, obj });
      this._col({ type: 'cyl', x: 0, z: 0, r: 9.5, y0: 0, y1: 11, dome: 6, obj });
      sats.push({ obj, ph: (i / 3) * Math.PI * 2, R: 480 + i * 70, dy: -40 + i * 60, sp: 0.03 - i * 0.006 });
    }
    // 아래 고원으로 내리는 빛줄기 + 오르는 기류
    const beams = [];
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + 0.7;
      const bx = cx + Math.cos(a) * 90, bz = cz + Math.sin(a) * 90;
      const gy = heightAt(bx, bz);
      const h = Y - 200 - gy;
      const b = new THREE.Mesh(new THREE.CylinderGeometry(6, 12, h, 12, 1, true), glowMaterial({ color: 0x7fe8ff, intensity: 0.5, fresnel: 0.7, side: THREE.DoubleSide }));
      b.position.set(bx, gy + h / 2, bz);
      this.group.add(b);
      beams.push(b);
      if (k === 0) this.world.updrafts.push({ x: bx, z: bz, r: 45, y0: gy, y1: Y + 30, strength: 30 });
    }
    this.anims.push((t) => {
      ring.rotation.z = t * 0.03;
      beams.forEach((b, i) => { b.material.uniforms.uIntensity.value = 0.35 + 0.25 * Math.sin(t * 1.3 + i); });
      for (const s of sats) {
        const a = s.ph + t * s.sp;
        s.obj.position.set(cx + Math.cos(a) * s.R, Y + s.dy + Math.sin(t * 0.3 + s.ph) * 6, cz + Math.sin(a) * s.R);
        s.obj.rotation.y = -a;
      }
    });
    for (const s of sats) this.movers.push(s);
    for (let i = 0; i < 20; i++) { const a = (i / 20) * Math.PI * 2; this.lights.add(cx + Math.cos(a) * 330, Y - 30, cz + Math.sin(a) * 330, 0x7fe8ff, 10, 0, 0); }
    this.lights.add(cx, Y + 64, cz, 0xffa040, 30, 0, 0);
    this.forge = { x: cx, y: Y, z: cz };
    this.structures.resonators.push({ x: cx, y: Y + 30, z: cz });
  }

  update(dt) {
    this.t += dt;
    for (const f of this.anims) f(this.t, dt);
    this.lights.update();
  }
}
