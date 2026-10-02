// 지방마다 하나씩, 아웬 기술이 드러나는 큰 시설.
//  · 기억 결정 보관소(윤슬) — 노래를 수정 격자에 새겨 두는 육각 결정탑, 빛이 결정 속을 오르내린다
//  · 포자 공방(갓마을)       — 살아 있는 재료를 기르는 유리 돔과 포자 굴뚝
//  · 중력 조선소(떠돌섬)     — 협곡 위 공중에 띄운 반쯤 지은 큰배와 중력 고리, 조립 일벌
//  · 별듣는 배열(첨봉)       — 하늘을 향한 다섯 개의 거대한 접시 귀
//  · 조석 기관(물노래)       — 바다에 반쯤 잠긴 세 고리
// 자리는 data/places.js 의 type: 'landmark' 항목입니다.
import * as THREE from 'three';
import { heightAt } from './heightfield.js';
import { mulberry32 } from '../core/noise.js';
import { part, merge, xf, lathe } from './geo-utils.js';
import * as A from './arch.js';
import { litMaterial, glowMaterial } from './materials.js';
import { CURVE_GLSL, ATMOS_PARS } from './shaders.js';
import { atmosUniforms } from './atmosphere.js';
import { PointLights } from './lights.js';
import { PLACE } from '../data/places.js';
import { linerGeo } from './traffic.js';

const PAL = A.PAL;

// 위로 흐르는 빛줄기 (결정 속 데이터, 포자 기둥)
function flowMaterial(color, speed = 0.4, density = 14) {
  return new THREE.ShaderMaterial({
    uniforms: { ...atmosUniforms, uColor: { value: new THREE.Color(color) }, uSpeed: { value: speed }, uDens: { value: density } },
    vertexShader: `${CURVE_GLSL}
      varying vec2 vUv; varying vec3 vWorld;
      void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position,1.0); vWorld = wp.xyz; gl_Position = projectionMatrix * viewMatrix * vec4(curveWorld(wp.xyz),1.0); }`,
    fragmentShader: `${ATMOS_PARS}
      uniform vec3 uColor; uniform float uSpeed; uniform float uDens;
      varying vec2 vUv; varying vec3 vWorld;
      float h(float n){ return fract(sin(n) * 43758.5453); }
      void main(){
        float col = floor(vUv.x * 24.0);
        float sp = uSpeed * (0.6 + h(col) * 0.8);
        float f = fract(vUv.y * uDens - uTime * sp + h(col * 1.7) * 10.0);
        float dash = smoothstep(0.0, 0.08, f) * smoothstep(0.35, 0.1, f) * step(0.35, h(col * 3.1));
        float fog = fogAmount(cameraPosition, vWorld);
        vec3 c = uColor * (dash * 1.6 + 0.08) * (0.6 + 0.6 * clamp(uGlow, 0.0, 1.0)) * (1.0 - fog);
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
}

export class Landmarks {
  constructor(world, structures) {
    this.world = world;
    this.structures = structures;
    this.scene = world.scene;
    this.group = new THREE.Group();
    this.group.name = 'landmarks';
    this.scene.add(this.group);
    this.mat = litMaterial({ vertexColors: true, vertexEmit: true, windows: true, emissive: 0xffffff, emissiveIntensity: 1.5, emissiveNight: 0.8, rim: 0.6, spec: 1.0, side: THREE.DoubleSide });
    this.crystal = litMaterial({ vertexColors: true, vertexEmit: true, emissive: 0xffffff, emissiveIntensity: 1.3, emissiveNight: 0.6, rim: 1.2, rimColor: 0xffe0f4, spec: 1.6, transparent: true, opacity: 0.78, side: THREE.DoubleSide });
    this.lights = new PointLights(this.scene, 300, { minPx: 1.8, day: 0.35 });
    this.anims = [];
    this.t = 0;
    const B = { archive: this._archive, foundry: this._foundry, shipyard: this._shipyard, array: this._array, tidal: this._tidal };
    for (const [id, fn] of Object.entries(B)) if (PLACE[id]) fn.call(this, PLACE[id]);
  }

  _col(c) { return this.world.colliders.add(c); }
  _add(parts, mat = this.mat) { const m = new THREE.Mesh(merge(parts), mat); m.matrixAutoUpdate = false; this.group.add(m); return m; }

  // ── 기억 결정 보관소 ─────────────────────
  _archive(P) {
    const [x, z] = P.pos;
    const g = heightAt(x, z);
    const H = 270;
    const parts = [], cparts = [];
    parts.push(part(xf(new THREE.CylinderGeometry(58, 64, 4, 6), { y: -1 }), 0xe8dcea, 0));
    parts.push(part(xf(new THREE.RingGeometry(46, 48, 6), { y: 1.05, rx: -Math.PI / 2 }), PAL.rose, 1.4));
    cparts.push(part(xf(lathe([[30, 0], [26, H * 0.6], [20, H * 0.9], [0.0001, H]], 6), {}), (px, py) => (py > H * 0.88 ? 0xffffff : PAL.crystal), (px, py) => 0.15 + 0.35 * Math.max(0, Math.sin(py * 0.05))));
    // 둘레의 작은 결정
    const rnd = mulberry32(17);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + rnd() * 0.2, d = 42 + rnd() * 10, h = 30 + rnd() * 50;
      cparts.push(part(xf(lathe([[6, 0], [5, h * 0.8], [0.0001, h]], 6), { x: Math.cos(a) * d, z: Math.sin(a) * d, rz: (rnd() - 0.5) * 0.3 }), PAL.crystal, 0.3));
      this._col({ type: 'cyl', x: x + Math.cos(a) * d, z: z + Math.sin(a) * d, r: 6, y0: g - 2, y1: g + h * 0.8 });
    }
    // 떠 있는 고리 셋
    for (let i = 0; i < 3; i++) parts.push(part(xf(new THREE.TorusGeometry(44 - i * 6, 1.2, 6, 6), { y: H * (0.35 + i * 0.18), rx: Math.PI / 2 }), PAL.gold, 0.8));
    this._add(parts.map((p) => xf(p, { x, y: g, z })));
    this._add(cparts.map((p) => xf(p, { x, y: g, z })), this.crystal);
    const flow = new THREE.Mesh(new THREE.CylinderGeometry(16, 22, H * 0.86, 24, 1, true), flowMaterial(PAL.rose, 0.35, 18));
    flow.position.set(x, g + H * 0.43, z);
    this.group.add(flow);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(50, 0.9, 4, 64), glowMaterial({ color: PAL.rose, intensity: 1.6 }));
    halo.position.set(x, g + H + 20, z);
    this.group.add(halo);
    this.anims.push((t) => { halo.rotation.set(Math.PI / 2 + Math.sin(t * 0.2) * 0.2, 0, t * 0.15); });
    this._col({ type: 'cyl', x, z, r: 30, y0: g - 2, y1: g + H * 0.9, walk: false });
    this._col({ type: 'cyl', x, z, r: 62, y0: g - 4, y1: g + 1 });
    this.lights.add(x, g + H + 4, z, 0xff5a4a, 16, 0.5, 0);
    this.structures.resonators.push({ x, y: g + 40, z });
  }

  // ── 포자 공방 ───────────────────────────
  _foundry(P) {
    const [x, z] = P.pos;
    const g = heightAt(x, z);
    const domes = [[0, 0, 44], [70, 30, 30], [-60, 40, 26], [10, -70, 24]];
    const parts = [], glass = [];
    for (const [dx, dz, r] of domes) {
      const y = heightAt(x + dx, z + dz) - g;
      parts.push(part(xf(new THREE.CylinderGeometry(r + 3, r + 4, 3, 32), { x: dx, y: y - 0.5, z: dz }), 0xd8d0e6, 0));
      parts.push(part(xf(new THREE.TorusGeometry(r, 0.8, 6, 40), { x: dx, y: y + 1, z: dz, rx: Math.PI / 2 }), PAL.gold, 0.6));
      glass.push(part(xf(new THREE.SphereGeometry(r, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), { x: dx, y: y + 1, z: dz }), 0xbfe8ff, 0.05));
      // 갈비뼈
      for (let k = 0; k < 8; k++) parts.push(part(xf(new THREE.TorusGeometry(r, 0.4, 4, 20, Math.PI), { x: dx, y: y + 1, z: dz, ry: (k / 8) * Math.PI }), 0xf2eef6, 0));
      // 안에서 자라는 빛 덩어리
      const rnd = mulberry32(Math.floor(r * 7));
      for (let k = 0; k < Math.round(r / 4); k++) {
        const a = rnd() * Math.PI * 2, d = rnd() * r * 0.7, s = 2 + rnd() * r * 0.12;
        parts.push(part(xf(new THREE.IcosahedronGeometry(s, 1), { x: dx + Math.cos(a) * d, y: y + s + 1, z: dz + Math.sin(a) * d, sy: 1.4 }), [0x6dfcd0, 0xb9a6ff, 0xffb8e8][k % 3], 1.3));
      }
      this._col({ type: 'cyl', x: x + dx, z: z + dz, r, y0: g + y - 2, y1: g + y + r, dome: r * 0.9 });
    }
    // 돔을 잇는 관
    for (const [i, j] of [[0, 1], [0, 2], [0, 3]]) {
      const a = domes[i], b = domes[j];
      const pts = [new THREE.Vector3(a[0], 8, a[1]), new THREE.Vector3((a[0] + b[0]) / 2, 12, (a[1] + b[1]) / 2), new THREE.Vector3(b[0], 8, b[1])];
      parts.push(part(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 3, 8), 0xe8e2f0, 0));
    }
    // 포자 굴뚝
    parts.push(part(xf(lathe([[14, 0], [10, 30], [7, 90], [9, 110], [6, 120]], 16), { x: -20, z: -30 }), (px, py) => (py > 100 ? 0x6dfcd0 : 0xe8e2f0), (px, py) => (py > 100 ? 1.2 : 0)));
    this._col({ type: 'cyl', x: x - 20, z: z - 30, r: 12, y0: g - 2, y1: g + 115, walk: false });
    this._add(parts.map((p) => xf(p, { x, y: g, z })));
    const gm = litMaterial({ vertexColors: true, vertexEmit: true, rim: 1.4, rimColor: 0xd8f8ff, spec: 1.6, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false });
    this._add(glass.map((p) => xf(p, { x, y: g, z })), gm);
    // 포자 (떠오르는 빛 알갱이)
    const n = 120;
    const pos = new Float32Array(n * 3);
    const rnd = mulberry32(3);
    for (let i = 0; i < n; i++) { pos[i * 3] = (rnd() - 0.5) * 20; pos[i * 3 + 1] = rnd() * 400; pos[i * 3 + 2] = (rnd() - 0.5) * 20; }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0x9ffce0, size: 1.6, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    pts.position.set(x - 20, g + 120, z - 30);
    this.group.add(pts);
    this.anims.push((t, dt) => {
      const a = pg.attributes.position.array;
      for (let i = 0; i < n; i++) {
        a[i * 3 + 1] += dt * (6 + (i % 7));
        a[i * 3] += Math.sin(t * 0.5 + i) * dt * 2 + dt * 3;
        if (a[i * 3 + 1] > 400) { a[i * 3 + 1] = 0; a[i * 3] = (Math.random() - 0.5) * 16; a[i * 3 + 2] = (Math.random() - 0.5) * 16; }
      }
      pg.attributes.position.needsUpdate = true;
    });
    this.structures.resonators.push({ x, y: g + 20, z });
  }

  // ── 중력 조선소 ─────────────────────────
  _shipyard(P) {
    const [x, z] = P.pos;
    const Y = 360;
    const yaw = 0.5;
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    const L = 320;
    // 다 지은 배 (조용히 떠 있다)
    const hull = new THREE.Mesh(linerGeo(), litMaterial({ vertexColors: true, vertexEmit: true, emissive: 0xffffff, emissiveIntensity: 1.2, emissiveNight: 0.6, rim: 0.7, spec: 1.2 }));
    hull.position.set(x - sn * 130, Y + 10, z - cs * 130);
    hull.rotation.y = yaw;
    this.group.add(hull);
    // 짓는 중인 배: 갈비뼈 + 용골 + 일부 판
    const parts = [];
    for (let i = 0; i <= 18; i++) {
      const t = i / 18;
      const zz = -L / 2 + t * L;
      const r = 27 * Math.sin(Math.PI * (0.08 + 0.84 * t)) + 4;
      parts.push(part(xf(new THREE.TorusGeometry(r, 0.9, 4, 28), { z: zz, sx: 1.35, sy: 0.55 }), 0xe0dae8, i % 3 === 0 ? 0.0 : 0));
      if (i % 3 === 0) parts.push(part(xf(new THREE.TorusGeometry(r + 1.2, 0.3, 4, 28), { z: zz, sx: 1.35, sy: 0.55 }), PAL.amber, 1.6));
    }
    parts.push(part(xf(new THREE.BoxGeometry(3, 3, L), { y: -15 }), 0xd8d2e2, 0));
    parts.push(part(xf(new THREE.BoxGeometry(2, 2, L), { y: 15 }), 0xd8d2e2, 0));
    for (let k = 0; k < 5; k++) parts.push(part(xf(new THREE.BoxGeometry(70, 1.6, 26), { z: -L / 2 + 40 + k * 26, y: 14.5 }), PAL.pearl, 0));
    const ship = new THREE.Mesh(merge(parts), this.mat);
    ship.position.set(x + sn * 130, Y, z + cs * 130);
    ship.rotation.y = yaw;
    this.group.add(ship);
    // 중력 고리: 두 배를 감싸는 큰 고리들 (천천히 돈다)
    const rings = [];
    for (const [ox, oz] of [[-sn * 130, -cs * 130], [sn * 130, cs * 130]]) {
      for (let k = 0; k < 3; k++) {
        const r = new THREE.Mesh(new THREE.TorusGeometry(58, 1.8, 6, 64), glowMaterial({ color: PAL.amber, intensity: 1.2 }));
        r.position.set(x + ox + sn * (k - 1) * 100, Y + 5, z + oz + cs * (k - 1) * 100);
        r.rotation.y = yaw;
        this.group.add(r);
        rings.push(r);
      }
    }
    this.anims.push((t) => { rings.forEach((r, i) => { r.rotation.z = t * 0.2 + i; r.material.uniforms.uIntensity.value = 0.9 + 0.4 * Math.sin(t * 1.5 + i); }); });
    // 비계 탑 (협곡 가장자리에서)
    const tp = [];
    const rnd = mulberry32(31);
    for (let k = 0; k < 6; k++) {
      const side = k % 2 ? 1 : -1;
      const along = (Math.floor(k / 2) - 1) * 120;
      const tx = x + cs * side * 120 + sn * along, tz = z - sn * side * 120 + cs * along;
      const g = heightAt(tx, tz);
      const h = Y + 40 - g;
      if (h < 20) continue;
      tp.push(part(xf(new THREE.BoxGeometry(8, h, 8), { x: tx, y: g + h / 2, z: tz }), 0xe4dfec, 0, -3.4));
      tp.push(part(xf(new THREE.BoxGeometry(60, 3, 4), { x: tx - cs * side * 30, y: Y + 30, z: tz + sn * side * 30, ry: yaw }), 0xe4dfec, 0));
      tp.push(part(xf(new THREE.BoxGeometry(8.4, 1, 8.4), { x: tx, y: Y + 40, z: tz }), PAL.amber, 1.4));
      this._col({ type: 'cyl', x: tx, z: tz, r: 6, y0: g - 2, y1: Y + 40 });
      this.lights.add(tx, Y + 42, tz, 0xff5a4a, 12, 0.6, rnd());
    }
    this._add(tp);
    // 조립 일벌 (배 둘레를 맴도는 작은 빛)
    for (let i = 0; i < 40; i++) {
      const id = this.lights.add(0, -1e5, 0, i % 3 ? 0xffe0a0 : 0xbffcff, 3, i % 4 === 0 ? 2.5 : 0, Math.random());
      const ph = Math.random() * 6.28, r = 30 + Math.random() * 30, zz = (Math.random() - 0.5) * L * 0.9, sp = 0.3 + Math.random() * 0.5;
      this.anims.push((t) => {
        const a = ph + t * sp;
        const lx = Math.cos(a) * r * 1.3, ly = Math.sin(a) * r * 0.6, lz = zz + Math.sin(t * 0.2 + ph) * 20;
        this.lights.set(id, ship.position.x + lx * cs + lz * sn, ship.position.y + ly, ship.position.z - lx * sn + lz * cs);
      });
    }
    // 다 지은 배 위에는 내려앉을 수 있다
    this._col({ type: 'box', x: hull.position.x, z: hull.position.z, hx: 16, hz: L * 0.31, rot: yaw, y0: Y - 2, y1: Y + 10 + 14.8 });
    this.anims.push((t) => { hull.position.y = Y + 10 + Math.sin(t * 0.4) * 1.5; });
  }

  // ── 별듣는 배열 ─────────────────────────
  _array(P) {
    const [x, z] = P.pos;
    const rnd = mulberry32(77);
    const dishes = [];
    for (let i = 0; i < 5; i++) {
      const a = -1.1 + (i / 4) * 2.2;
      const dx = Math.sin(a) * 230, dz = -Math.cos(a) * 230 + 140;
      const gx = x + dx, gz = z + dz;
      const g = heightAt(gx, gz);
      const parts = [];
      parts.push(part(lathe([[14, 0], [10, 6], [6, 30], [5, 46]], 12), 0xe8e4ee, 0));
      parts.push(part(xf(new THREE.TorusGeometry(6, 0.6, 4, 16), { y: 30, rx: Math.PI / 2 }), PAL.teal, 1.2));
      const dish = new THREE.Group();
      const dp = [];
      const prof = [];
      for (let k = 0; k <= 10; k++) { const r = (k / 10) * 44; prof.push([r, (r * r) / (4 * 40)]); }
      dp.push(part(lathe(prof, 32), (px, py, pz) => (Math.hypot(px, pz) > 42 ? PAL.gold : 0xf2eef6), 0));
      for (let k = 0; k < 3; k++) {
        const b = (k / 3) * Math.PI * 2;
        const pts = [new THREE.Vector3(Math.cos(b) * 40, 10, Math.sin(b) * 40), new THREE.Vector3(0, 38, 0)];
        dp.push(part(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 4, 0.6, 4), 0xe8e4ee, 0));
      }
      dp.push(part(xf(new THREE.OctahedronGeometry(3, 0), { y: 39, sy: 1.6 }), PAL.teal, 2.0));
      const dm = new THREE.Mesh(merge(dp), this.mat);
      dish.add(dm);
      dish.position.set(gx, g + 46, gz);
      dish.rotation.set(-0.5 - rnd() * 0.3, a * 0.6, 0, 'YXZ');
      this.group.add(dish);
      this._add(parts.map((p) => xf(p, { x: gx, y: g, z: gz })));
      this._col({ type: 'cyl', x: gx, z: gz, r: 10, y0: g - 2, y1: g + 46, walk: false });
      dishes.push({ dish, base: dish.rotation.x, ph: rnd() * 6 });
      this.lights.add(gx, g + 90, gz, PAL.teal, 6, 0.2, rnd());
    }
    // 천천히 하늘을 훑는다
    this.anims.push((t) => { for (const d of dishes) d.dish.rotation.x = d.base + Math.sin(t * 0.05 + d.ph) * 0.15; });
    // 가운데 수신 탑
    const g = heightAt(x, z + 60);
    this._add(A.spireTower({ h: 90, r: 6, seed: 404, glow: PAL.teal, pods: 2 }).map((p) => xf(p, { x, y: g - 1, z: z + 60 })), this.structures.mats.pearl);
    this._col({ type: 'cyl', x, z: z + 60, r: 7, y0: g - 2, y1: g + 40 });
  }

  // ── 조석 기관 ───────────────────────────
  _tidal(P) {
    const [x, z] = P.pos;
    const yaw = 0.7;
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    const rings = [];
    for (let k = -1; k <= 1; k++) {
      const rx = x + sn * k * 190, rz = z + cs * k * 190;
      const g = new THREE.Group();
      g.position.set(rx, 20, rz);
      g.rotation.y = yaw + Math.PI / 2;
      const parts = [part(new THREE.TorusGeometry(95, 7, 10, 72), (px, py) => (py > 0 ? 0xf0ecf4 : 0xc8d0dc), 0), part(new THREE.TorusGeometry(86, 1.4, 4, 72), PAL.teal, 1.8)];
      for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; parts.push(part(xf(new THREE.BoxGeometry(6, 18, 18), { x: Math.cos(a) * 95, y: Math.sin(a) * 95, rz: a }), PAL.gold, 0.4)); }
      const m = new THREE.Mesh(merge(parts), this.mat);
      g.add(m);
      this.group.add(g);
      const core = new THREE.Mesh(new THREE.CircleGeometry(84, 48), glowMaterial({ color: 0x7ff0ff, intensity: 0.25, side: THREE.DoubleSide }));
      g.add(core);
      rings.push({ m, core, k });
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; if (Math.sin(a) * 95 + 20 > 2) this.lights.add(rx + Math.cos(a) * 95 * Math.cos(yaw + Math.PI / 2), 20 + Math.sin(a) * 95, rz - Math.cos(a) * 95 * Math.sin(yaw + Math.PI / 2), PAL.teal, 8, 0, 0); }
    }
    this.anims.push((t) => { for (const r of rings) { r.m.rotation.z = t * 0.05 * (r.k % 2 ? -1 : 1); r.core.material.uniforms.uIntensity.value = 0.18 + 0.12 * Math.sin(t * 0.8 + r.k * 2); } });
    // 가운데 관제 섬
    const parts = [];
    parts.push(part(new THREE.CylinderGeometry(40, 46, 30, 32).translate(0, 0, 0), 0xe4dfec, 0, 12));
    parts.push(part(xf(new THREE.CylinderGeometry(42, 42, 1, 32), { y: 15.5 }), 0x3f8f76, 0));
    A.place(parts, A.domeHouse({ r: 14, h: 16, seed: 9, glow: PAL.teal }), { y: 16 });
    this._add(parts.map((p) => xf(p, { x: x - cs * 160, y: 0, z: z + sn * 160 })));
    this._col({ type: 'cyl', x: x - cs * 160, z: z + sn * 160, r: 44, y0: -20, y1: 16 });
    this._col({ type: 'cyl', x: x - cs * 160, z: z + sn * 160, r: 13, y0: 15, y1: 31, dome: 9 });
  }

  update(dt) {
    this.t += dt;
    for (const f of this.anims) f(this.t, dt);
    this.lights.update();
  }
}
