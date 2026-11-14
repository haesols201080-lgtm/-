// Ambient population: people walk the sidewalks around the player, stop, check their phones, talk,
// and put umbrellas up when it rains. Agents are recycled around the camera; rendering is instanced + GPU skinned.
import * as THREE from 'three';
import { bakeAnimations, buildBody, VARIANTS, createHumanMaterial, makeHumanMesh, CLIP, clipRow } from './human.js';
import { injectNS } from '../render/cityMaterial.js';
import { RNG } from '../core/rng.js';

const TOPS = [[0.16, 0.17, 0.2], [0.22, 0.22, 0.24], [0.3, 0.27, 0.23], [0.18, 0.21, 0.26], [0.34, 0.33, 0.32], [0.13, 0.13, 0.14], [0.3, 0.2, 0.18], [0.21, 0.26, 0.23], [0.4, 0.38, 0.35], [0.24, 0.2, 0.26], [0.36, 0.32, 0.22], [0.18, 0.26, 0.3], [0.12, 0.12, 0.13], [0.26, 0.27, 0.29]];
const BOTS = [[0.12, 0.12, 0.14], [0.17, 0.18, 0.21], [0.22, 0.2, 0.19], [0.14, 0.16, 0.21], [0.25, 0.25, 0.27]];
const HAIR = [[0.07, 0.06, 0.06], [0.09, 0.07, 0.06], [0.07, 0.06, 0.06], [0.16, 0.11, 0.08], [0.3, 0.29, 0.28], [0.12, 0.1, 0.1], [0.34, 0.14, 0.2], [0.14, 0.26, 0.32]];
const DENSITY = { sump: 1.3, lumina: 1.4, hive: 1.1, oldq: 0.9, meridian: 0.8, verdant: 0.4, foundry: 0.3, port: 0.3, core: 1.2 };

function umbrellaGeometry() {
  const g = new THREE.BufferGeometry(); const pos = [], idx = []; const n = 10, R = 0.62;
  pos.push(0, 1.02, 0); for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; pos.push(Math.cos(a) * R, 0.84, Math.sin(a) * R); }
  for (let i = 0; i < n; i++) { const a = 1 + i, b = 1 + ((i + 1) % n); idx.push(0, b, a, 0, a, b); }
  const base = pos.length / 3; const sh = 0.012; const ring = (y) => { for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2; pos.push(Math.cos(a) * sh, y, Math.sin(a) * sh); } };
  ring(0); ring(1.0); for (let i = 0; i < 4; i++) { const a = base + i, b = base + ((i + 1) % 4); idx.push(a, b, b + 4, a, b + 4, a + 4); }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}

export class Crowd {
  constructor(city, quality, scene) {
    this.city = city; this.max = quality.crowd; this.rng = new RNG(31337);
    this.anim = bakeAnimations(); this.mat = createHumanMaterial(this.anim);
    const per = Math.ceil(this.max / VARIANTS.length) + 8;
    this.meshes = VARIANTS.map((v) => { const m = makeHumanMesh(buildBody(v.v), this.mat, per); scene.add(m); return m; });
    this.per = per; this.agents = [];
    const um = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.1, side: THREE.DoubleSide, transparent: true, opacity: 0.78 }); injectNS(um, { key: 'umb' });
    this.umb = new THREE.InstancedMesh(umbrellaGeometry(), um, this.max); this.umb.frustumCulled = false; this.umb.count = 0; this.umb.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(this.umb);
    // spatial index of walkways
    this.grid = new Map(); const cell = 160;
    city.ctx.walkways.forEach((w, i) => { let cx = 0, cz = 0; for (const p of w.pts) { cx += p[0]; cz += p[2]; } cx /= w.pts.length; cz /= w.pts.length; w.cx = cx; w.cz = cz; w.y = w.pts[0][1]; const k = Math.floor(cx / cell) * 1000 + Math.floor(cz / cell); (this.grid.get(k) || this.grid.set(k, []).get(k)).push(w); });
    // lingering spots registered by the world (pavement tables, shopfronts, groups): spatial index
    this.sgrid = new Map(); for (const s of city.ctx.spots || []) { const k = Math.floor(s.x / 80) * 1000 + Math.floor(s.z / 80); (this.sgrid.get(k) || this.sgrid.set(k, []).get(k)).push(s); } this.nStatic = 0;
    this.cell = cell; this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._p = new THREE.Vector3(); this._s = new THREE.Vector3(); this._up = new THREE.Vector3(0, 1, 0); this._c = new THREE.Color();
  }
  _near(x, y, z, R) {
    const out = []; const c = this.cell; const n = Math.ceil(R / c);
    for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) { const a = this.grid.get((Math.floor(x / c) + i) * 1000 + Math.floor(z / c) + j); if (a) for (const w of a) if (Math.abs(w.y - y) < 30 && Math.hypot(w.cx - x, w.cz - z) < R + 60) out.push(w); }
    return out;
  }
  _spawn(cam, near, initial) {
    const rng = this.rng; if (!near.length) return;
    const w = rng.pick(near); if (rng.next() > (DENSITY[w.district] ?? 0.8) / 1.4) return;
    const n = w.pts.length; const seg = rng.i(0, w.closed ? n - 1 : n - 2); const t = rng.next();
    const a = w.pts[seg], b = w.pts[(seg + 1) % n]; const x = a[0] + (b[0] - a[0]) * t, z = a[2] + (b[2] - a[2]) * t; const d = Math.hypot(x - cam.x, z - cam.z);
    if (d > 78 || (!initial && d < 22)) return;
    const variant = rng.i(0, VARIANTS.length - 1); if (this.agents.filter((g) => g.variant === variant).length >= this.per) return;
    const brisk = rng.chance(0.25);
    this.agents.push({ w, seg, t, dir: rng.sign(), lat: rng.f(-1.1, 1.1), variant, x, y: a[1], z, yaw: rng.f(0, 6.28), state: 0, timer: rng.f(6, 40), clip: brisk ? CLIP.brisk : CLIP.walk, clipB: CLIP.idle, blend: 0, phase: rng.next(), phaseB: rng.next(), sp: (brisk ? 1.25 : 1) * rng.f(0.85, 1.12), h: rng.f(0.93, 1.07),
      c0: rng.pick(TOPS), c1: rng.pick(BOTS), c2: rng.pick(HAIR), tone: rng.next(), umb: rng.chance(0.62), umbCol: rng.pick([[0.1, 0.1, 0.12], [0.1, 0.1, 0.12], [0.5, 0.52, 0.55], [0.6, 0.15, 0.2], [0.15, 0.4, 0.5]]), fade: 0 });
  }
  _linger(cam, rain) {
    const rng = this.rng; const cx = Math.floor(cam.x / 80), cz = Math.floor(cam.z / 80);
    const a = this.sgrid.get((cx + rng.i(-1, 1)) * 1000 + cz + rng.i(-1, 1)); if (!a || !a.length) return;
    const s = rng.pick(a); if (s.used || Math.abs(s.y - cam.y) > 30 || Math.hypot(s.x - cam.x, s.z - cam.z) > 105) return;
    if (rain > 0.6 && s.sit && rng.chance(0.6)) return; // heavy rain empties the pavement tables
    const variant = rng.i(0, VARIANTS.length - 1); if (this.agents.filter((g) => g.variant === variant).length >= this.per) return;
    s.used = true; this.nStatic++;
    const clip = s.sit ? CLIP.sit : s.clip === 'talk' ? CLIP.talk : s.clip === 'phone' ? CLIP.phone : s.clip === 'idle' ? CLIP.idle : rng.pick([CLIP.idle, CLIP.phone, CLIP.talk]);
    this.agents.push({ spot: s, w: { pts: [[s.x, s.y, s.z]], indoor: false }, seg: 0, t: 0, dir: 1, lat: 0, variant, x: s.x, y: s.y, z: s.z, yaw: s.yaw, state: 2, timer: 1e9, clip, clipB: clip, blend: 0, phase: rng.next(), phaseB: rng.next(), sp: 1, h: rng.f(0.93, 1.07),
      c0: rng.pick(TOPS), c1: rng.pick(BOTS), c2: rng.pick(HAIR), tone: rng.next(), umb: false, umbCol: [0.1, 0.1, 0.12], fade: 0 });
  }
  update(dt, cam, rain = 0) {
    const A = this.agents; const stride = this.anim.stride;
    for (let i = 0; i < 4 && A.length < this.max && this.nStatic < this.max * 0.42; i++) this._linger(cam, rain);
    const near = this._near(cam.x, cam.y, cam.z, 70);
    for (let i = 0; i < 8 && A.length < this.max; i++) this._spawn(cam, near, this._init !== true);
    this._init = true;
    const counts = this.meshes.map(() => 0); let nu = 0; const rainy = rain > 0.25;
    for (let i = A.length - 1; i >= 0; i--) {
      const g = A[i]; const d = Math.hypot(g.x - cam.x, g.z - cam.z);
      if (d > 108 || Math.abs(g.y - cam.y) > 60) { if (g.spot) { g.spot.used = false; this.nStatic--; } A.splice(i, 1); continue; }
      const pts = g.w.pts, n = pts.length;
      if (g.state === 2) { g.phase += dt / (g.clip === CLIP.talk ? 5 : g.clip === CLIP.sit ? 9 : 7.5); }
      else if (g.state === 0) {
        const a = pts[g.seg], b = pts[(g.seg + 1) % n]; const L = Math.hypot(b[0] - a[0], b[2] - a[2]) || 1;
        const base = g.clip === CLIP.brisk ? stride[CLIP.brisk] : stride[CLIP.walk]; const v = (base / 1.05) * g.sp * g.h; // cycle = 1.05 s
        g.t += (g.dir * v * dt) / L; g.phase += (dt / 1.05) * g.sp;
        if (g.t > 1 || g.t < 0) { if (g.w.closed) { g.seg = (g.seg + g.dir + n) % n; g.t = g.dir > 0 ? 0 : 1; } else { const ns = g.seg + g.dir; if (ns < 0 || ns > n - 2) { g.dir = -g.dir; g.t = Math.max(0, Math.min(1, g.t)); } else { g.seg = ns; g.t = g.dir > 0 ? 0 : 1; } } }
        const dx = (b[0] - a[0]) / L, dz = (b[2] - a[2]) / L; const tx = a[0] + (b[0] - a[0]) * g.t - dz * g.lat, tz = a[2] + (b[2] - a[2]) * g.t + dx * g.lat;
        g.x += (tx - g.x) * Math.min(1, dt * 6); g.z += (tz - g.z) * Math.min(1, dt * 6); g.y = a[1] + (b[1] - a[1]) * g.t;
        let want = Math.atan2(dx * g.dir, dz * g.dir); let dy = want - g.yaw; dy -= Math.round(dy / 6.2832) * 6.2832; g.yaw += dy * Math.min(1, dt * 5);
        g.blend = Math.max(0, g.blend - dt * 3.5);
        g.timer -= dt; if (g.timer <= 0) { g.state = 1; g.timer = this.rng.f(4, 16); g.clipB = this.rng.pick([CLIP.idle, CLIP.phone, CLIP.phone, CLIP.talk, CLIP.idle]); }
      } else {
        g.blend = Math.min(1, g.blend + dt * 3.5); g.phaseB += dt / (g.clipB === CLIP.talk ? 5 : 7);
        g.timer -= dt; if (g.timer <= 0) { g.state = 0; g.timer = this.rng.f(10, 50); }
      }
      // keep clear of the player
      if (g.state !== 2 && d < 0.9 && d > 1e-3) { g.x += ((g.x - cam.x) / d) * (0.9 - d); g.z += ((g.z - cam.z) / d) * (0.9 - d); }
      g.fade = Math.min(1, g.fade + dt * 2);
      const m = this.meshes[g.variant]; const k = counts[g.variant]++;
      this._q.setFromAxisAngle(this._up, g.yaw); this._s.set(g.h, g.h * g.fade, g.h); this._m.compose(this._p.set(g.x, g.y, g.z), this._q, this._s); m.setMatrixAt(k, this._m);
      const holdU = rainy && g.umb && !g.w.indoor;
      const ia = m.geometry.getAttribute('iAnim'); ia.setXYZW(k, clipRow(holdU && g.clip === CLIP.walk ? CLIP.walkU : g.clip, g.phase), 0, clipRow(g.clipB, g.phaseB), g.blend);
      m.geometry.getAttribute('iC0').setXYZ(k, g.c0[0], g.c0[1], g.c0[2]); m.geometry.getAttribute('iC1').setXYZ(k, g.c1[0], g.c1[1], g.c1[2]); m.geometry.getAttribute('iC2').setXYZW(k, g.c2[0], g.c2[1], g.c2[2], g.tone);
      if (holdU && nu < this.max) { const cs = Math.cos(g.yaw), sn = Math.sin(g.yaw); const ox = -0.2, oz = 0.24; this._s.set(g.h, g.h, g.h); this._m.compose(this._p.set(g.x + ox * cs + oz * sn, g.y + 1.2 * g.h, g.z - ox * sn + oz * cs), this._q, this._s); this.umb.setMatrixAt(nu, this._m); this.umb.setColorAt(nu, this._c.setRGB(g.umbCol[0], g.umbCol[1], g.umbCol[2])); nu++; }
    }
    this.meshes.forEach((m, i) => { m.count = counts[i]; m.instanceMatrix.needsUpdate = true; for (const k of ['iAnim', 'iC0', 'iC1', 'iC2']) m.geometry.getAttribute(k).needsUpdate = true; });
    this.umb.count = nu; this.umb.instanceMatrix.needsUpdate = true; if (this.umb.instanceColor) this.umb.instanceColor.needsUpdate = true;
  }
}
