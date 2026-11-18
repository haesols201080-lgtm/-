// Ambient population: people walk the sidewalks around the player, stop, check their phones, talk,
// and put umbrellas up when it rains. Agents are recycled around the camera; rendering is instanced + GPU skinned.
import * as THREE from 'three';
import { bakeAnimations, buildBody, VARIANTS, createHumanMaterial, createHumanDepthMaterial, makeHumanMesh, CLIP, clipRow } from './human.js';
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
    this.anim = bakeAnimations(); this.mat = createHumanMaterial(this.anim); this.depth = createHumanDepthMaterial(this.anim);
    const per = Math.ceil(this.max / VARIANTS.length) + 8;
    this.meshes = VARIANTS.map((v) => { const m = makeHumanMesh(buildBody(v.v), this.mat, per); m.receiveShadow = !!quality.shadows; if (quality.shadows) { m.castShadow = true; m.customDepthMaterial = this.depth; } scene.add(m); return m; });
    this.per = per; this.agents = [];
    const um = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.1, side: THREE.DoubleSide, transparent: true, opacity: 0.78 }); injectNS(um, { key: 'umb' });
    this.umb = new THREE.InstancedMesh(umbrellaGeometry(), um, this.max); this.umb.frustumCulled = false; this.umb.count = 0; this.umb.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(this.umb);
    // spatial index of walkways
    this.grid = new Map(); const cell = 160;
    city.ctx.walkways.forEach((w, i) => { let cx = 0, cz = 0; for (const p of w.pts) { cx += p[0]; cz += p[2]; } cx /= w.pts.length; cz /= w.pts.length; w.cx = cx; w.cz = cz; w.r = 0; for (const p of w.pts) w.r = Math.max(w.r, Math.hypot(p[0] - cx, p[2] - cz)); w.y = w.pts[0][1]; const k = Math.floor(cx / cell) * 1000 + Math.floor(cz / cell); (this.grid.get(k) || this.grid.set(k, []).get(k)).push(w); });
    // lingering spots registered by the world (pavement tables, shopfronts, groups): spatial index
    this.sgrid = new Map(); for (const s of city.ctx.spots || []) { const k = Math.floor(s.x / 80) * 1000 + Math.floor(s.z / 80); (this.sgrid.get(k) || this.sgrid.set(k, []).get(k)).push(s); } this.nStatic = 0;
    this.cell = cell; this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._p = new THREE.Vector3(); this._s = new THREE.Vector3(); this._up = new THREE.Vector3(0, 1, 0); this._c = new THREE.Color();
  }
  addSpots(list) { for (const s of list) { const k = Math.floor(s.x / 80) * 1000 + Math.floor(s.z / 80); (this.sgrid.get(k) || this.sgrid.set(k, []).get(k)).push(s); } }
  addWalkways(list) { const c = this.cell; for (const w of list) { let cx = 0, cz = 0; for (const p of w.pts) { cx += p[0]; cz += p[2]; } w.cx = cx / w.pts.length; w.cz = cz / w.pts.length; w.r = 0; for (const p of w.pts) w.r = Math.max(w.r, Math.hypot(p[0] - w.cx, p[2] - w.cz)); w.y = w.pts[0][1]; const k = Math.floor(w.cx / c) * 1000 + Math.floor(w.cz / c); (this.grid.get(k) || this.grid.set(k, []).get(k)).push(w); } }
  _near(x, y, z, R) {
    const out = []; const c = this.cell; const n = Math.ceil((R + 120) / c);
    for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) { const a = this.grid.get((Math.floor(x / c) + i) * 1000 + Math.floor(z / c) + j); if (a) for (const w of a) if (Math.abs(w.y - y) < (w.indoor ? 2.5 : 30) && Math.hypot(w.cx - x, w.cz - z) < R + (w.r ?? 60)) out.push(w); }
    return out;
  }
  _spawn(cam, near, initial) {
    const rng = this.rng; if (!near.length) return;
    const w = rng.pick(near); if (rng.next() > (DENSITY[w.district] ?? 0.8) / 1.4) return;
    if (w.indoor && this.agents.filter((g) => g.w === w).length >= (w.closed ? 7 : 4)) return; // a floor holds a handful of people, not a crowd
    const n = w.pts.length; const seg = rng.i(0, w.closed ? n - 1 : n - 2); const t = rng.next();
    const a = w.pts[seg], b = w.pts[(seg + 1) % n]; const x = a[0] + (b[0] - a[0]) * t, z = a[2] + (b[2] - a[2]) * t; const d = Math.hypot(x - cam.x, z - cam.z);
    if (d > 78 || (!initial && d < (w.indoor ? 4 : 22))) return;
    const variant = rng.i(0, VARIANTS.length - 1); if (this.agents.filter((g) => g.variant === variant).length >= this.per) return;
    const brisk = rng.chance(0.25);
    const lead = { w, seg, t, dir: rng.sign(), lat: rng.f(-1, 1) * (w.latMax ?? 1.1), variant, x, y: a[1], z, yaw: rng.f(0, 6.28), state: 0, timer: rng.f(6, 40), clip: brisk ? CLIP.brisk : CLIP.walk, clipB: CLIP.idle, blend: 0, phase: rng.next(), phaseB: rng.next(), sp: (brisk ? 1.25 : 1) * rng.f(0.85, 1.12), h: rng.f(0.93, 1.07),
      c0: rng.pick(TOPS), c1: rng.pick(BOTS), c2: rng.pick(HAIR), tone: rng.next(), umb: rng.chance(0.62), umbCol: rng.pick([[0.1, 0.1, 0.12], [0.1, 0.1, 0.12], [0.5, 0.52, 0.55], [0.6, 0.15, 0.2], [0.15, 0.4, 0.5]]), fade: 0 };
    this.agents.push(lead);
    // company: friends, couples, colleagues keep step side by side
    if (rng.chance(0.42)) { const n = rng.chance(0.25) ? 2 : 1; for (let k = 0; k < n && this.agents.length < this.max; k++) { const v2 = rng.i(0, VARIANTS.length - 1); if (this.agents.filter((g) => g.variant === v2).length >= this.per) break; this.agents.push({ ...lead, variant: v2, lat: Math.max(-(w.latMax ?? 1.1), Math.min(w.latMax ?? 1.1, lead.lat + (k + 1) * 0.62 * (lead.lat > 0 ? -1 : 1))), phase: rng.next(), phaseB: rng.next(), h: rng.f(0.93, 1.07), c0: rng.pick(TOPS), c1: rng.pick(BOTS), c2: rng.pick(HAIR), tone: rng.next(), timer: lead.timer, clip: lead.clip }); } }
  }
  // ---- crossings: each zebra joins the pavements on both sides of a street --------------------------------------
  _linkCrossings() {
    this._xl = true; this.xgrid = new Map(); const near = (x, z) => { let best = null, bd = 6;
      for (const w of this._near(x, 0.2, z, 160)) { if (w.indoor || !w.closed) continue; const P = w.pts, n = P.length;
        for (let i = 0; i < n; i++) { const a = P[i], b = P[(i + 1) % n]; const ex = b[0] - a[0], ez = b[2] - a[2]; const l2 = ex * ex + ez * ez || 1; let t = ((x - a[0]) * ex + (z - a[2]) * ez) / l2; t = Math.max(0, Math.min(1, t)); const px = a[0] + ex * t, pz = a[2] + ez * t; const d = Math.hypot(px - x, pz - z); if (d < bd) { bd = d; best = { w, x: px, z: pz, y: a[1] + (b[1] - a[1]) * t }; } } }
      return best; };
    for (const cr of this.city.ctx.crossings || []) { const A = near(cr.x - cr.dx * 0.8, cr.z - cr.dz * 0.8), B = near(cr.x + cr.dx * (cr.w + 0.8), cr.z + cr.dz * (cr.w + 0.8)); if (!A || !B || A.w === B.w) continue;
      cr.ends = [A, B]; for (let e = 0; e < 2; e++) { const q = cr.ends[e]; const k = Math.floor(q.x / 50) * 100003 + Math.floor(q.z / 50); (this.xgrid.get(k) || this.xgrid.set(k, []).get(k)).push({ cr, e }); } }
  }
  _crossAt(g) { const a = this.xgrid.get(Math.floor(g.x / 50) * 100003 + Math.floor(g.z / 50)); if (!a) return null; for (const it of a) { const q = it.cr.ends[it.e]; if (q.w === g.w && Math.abs(q.x - g.x) < 1.6 && Math.abs(q.z - g.z) < 1.6) return it; } return null; }
  _linger(cam, rain) {
    const rng = this.rng; const cx = Math.floor(cam.x / 80), cz = Math.floor(cam.z / 80);
    const a = this.sgrid.get((cx + rng.i(-1, 1)) * 1000 + cz + rng.i(-1, 1)); if (!a || !a.length) return;
    const s = rng.pick(a); if (s.used || Math.abs(s.y - cam.y) > (s.indoor ? 2.5 : 30) || Math.hypot(s.x - cam.x, s.z - cam.z) > 105) return;
    if (rain > 0.6 && s.sit && rng.chance(0.6)) return; // heavy rain empties the pavement tables
    const variant = rng.i(0, VARIANTS.length - 1); if (this.agents.filter((g) => g.variant === variant).length >= this.per) return;
    s.used = true; this.nStatic++;
    const clip = s.sit ? CLIP.sit : s.clip === 'talk' ? CLIP.talk : s.clip === 'phone' ? CLIP.phone : s.clip === 'idle' ? CLIP.idle : rng.pick([CLIP.idle, CLIP.phone, CLIP.talk]);
    this.agents.push({ spot: s, w: { pts: [[s.x, s.y, s.z]], indoor: false }, seg: 0, t: 0, dir: 1, lat: 0, variant, x: s.x, y: s.y, z: s.z, yaw: s.yaw, state: 2, timer: 1e9, clip, clipB: clip, blend: 0, phase: rng.next(), phaseB: rng.next(), sp: 1, h: rng.f(0.93, 1.07),
      c0: rng.pick(TOPS), c1: rng.pick(BOTS), c2: rng.pick(HAIR), tone: rng.next(), umb: false, umbCol: [0.1, 0.1, 0.12], fade: 0 });
  }
  // someone who is really there for the player: a customer waiting where the order has to be taken
  guest(x, y, z, yaw) { const rng = this.rng; const variant = rng.i(0, VARIANTS.length - 1); const g = { guest: true, w: { pts: [[x, y, z]], indoor: true }, seg: 0, t: 0, dir: 1, lat: 0, variant, x, y, z, yaw, state: 2, timer: 1e9, clip: CLIP.idle, clipB: CLIP.idle, blend: 0, phase: rng.next(), phaseB: rng.next(), sp: 1, h: rng.f(0.93, 1.07), c0: rng.pick(TOPS), c1: rng.pick(BOTS), c2: rng.pick(HAIR), tone: rng.next(), umb: false, umbCol: [0.1, 0.1, 0.12], fade: 0 }; this.agents.push(g); return g; }
  update(dt, cam, rain = 0, indoor = 0) {
    const A = this.agents; const dyMax = indoor > 0.5 ? 6 : 60; const stride = this.anim.stride;
    for (let i = 0; i < 4 && A.length < this.max && this.nStatic < this.max * 0.42; i++) this._linger(cam, rain);
    const near = this._near(cam.x, cam.y, cam.z, 70);
    for (let i = 0; i < 8 && A.length < this.max; i++) this._spawn(cam, near, this._init !== true);
    this._init = true;
    if (!this._xl && this.streets) this._linkCrossings(); this._peds = []; if (this.streets) { this.streets.peds.length = 0; }
    const counts = this.meshes.map(() => 0); let nu = 0; const rainy = rain > 0.25;
    for (let i = A.length - 1; i >= 0; i--) {
      const g = A[i]; const d = Math.hypot(g.x - cam.x, g.z - cam.z);
      if (g.dead) { A.splice(i, 1); continue; }
      if (!g.guest && (d > 108 || Math.abs(g.y - cam.y) > dyMax)) { if (g.spot) { g.spot.used = false; this.nStatic--; } A.splice(i, 1); continue; }
      const pts = g.w.pts, n = pts.length;
      if (g.state === 2) { g.phase += dt / (g.clip === CLIP.talk ? 5 : g.clip === CLIP.sit ? 9 : 7.5); }
      else if (g.state === 3 || g.state === 4) { // at the kerb waiting for the walk light / on the zebra
        const X = g.xing, cr = X.cr, A = cr.ends[X.e], B = cr.ends[1 - X.e]; const sx = -cr.dz * X.k, sz = cr.dx * X.k;
        const tx = (g.state === 3 ? A.x : B.x) + sx, tz = (g.state === 3 ? A.z : B.z) + sz; const ddx = tx - g.x, ddz = tz - g.z, dd = Math.hypot(ddx, ddz);
        if (g.state === 3) {
          if (dd > 0.05) { const st = Math.min(dd, 1.2 * dt); g.x += (ddx / dd) * st; g.z += (ddz / dd) * st; }
          const fx = (B.x - A.x), fz = (B.z - A.z); let dy = Math.atan2(fx, fz) - g.yaw; dy -= Math.round(dy / 6.2832) * 6.2832; g.yaw += dy * Math.min(1, dt * 4);
          g.blend = Math.min(1, g.blend + dt * 3.5); g.phaseB += dt / 7; g.timer += dt;
          if (this.streets && this.streets.walkOK(cr)) { X.go = (X.go ?? this.rng.f(0.3, 1.5)) - dt; if (X.go <= 0) { g.state = 4; X.go = null; } } else X.go = null;
          if (g.timer > 60) { g.state = 0; g.timer = this.rng.f(10, 30); g.xcd = 30; }
        } else {
          const base = g.clip === CLIP.brisk ? stride[CLIP.brisk] : stride[CLIP.walk]; const v = (base / 1.05) * g.sp * g.h * 1.08; g.phase += (dt / 1.05) * g.sp * 1.08; g.blend = Math.max(0, g.blend - dt * 3.5);
          if (dd > 0.25) { const st = Math.min(dd, v * dt); g.x += (ddx / dd) * st; g.z += (ddz / dd) * st; let dy = Math.atan2(ddx, ddz) - g.yaw; dy -= Math.round(dy / 6.2832) * 6.2832; g.yaw += dy * Math.min(1, dt * 6);
            const fromA = Math.hypot(g.x - A.x - sx, g.z - A.z - sz); g.y = fromA < 0.7 || dd < 0.7 ? A.y : 0.06; this._peds.push(g); }
          else { // step onto the far pavement and carry on along it
            const w2 = B.w, P = w2.pts, n = P.length; let bi = 0, bt = 0, bd = 1e9; for (let k = 0; k < n; k++) { const a = P[k], b = P[(k + 1) % n]; const ex = b[0] - a[0], ez = b[2] - a[2]; const l2 = ex * ex + ez * ez || 1; let t = ((g.x - a[0]) * ex + (g.z - a[2]) * ez) / l2; t = Math.max(0, Math.min(1, t)); const d = Math.hypot(a[0] + ex * t - g.x, a[2] + ez * t - g.z); if (d < bd) { bd = d; bi = k; bt = t; } }
            g.w = w2; g.seg = bi; g.t = bt; g.dir = this.rng.sign(); g.lat = Math.max(-(w2.latMax ?? 1.1), Math.min(w2.latMax ?? 1.1, g.lat)); g.y = B.y; g.state = 0; g.timer = this.rng.f(10, 40); g.xcd = 25; g.xing = null; }
        }
      }
      else if (g.state === 0) {
        g.xcd = (g.xcd || 0) - dt; g.xc = (g.xc || 0) - dt;
        if (this._xl && !g.guest && !g.w.indoor && g.xcd <= 0 && g.xc <= 0) { g.xc = 0.3; const it = this._crossAt(g); if (it) { if (this.rng.chance(0.5)) { g.state = 3; g.timer = 0; g.xing = { cr: it.cr, e: it.e, k: this.rng.f(-1.3, 1.3) }; g.clipB = this.rng.pick([CLIP.idle, CLIP.idle, CLIP.phone]); } else g.xcd = 6; } }
      }
      if (g.state === 0) {
        const a = pts[g.seg], b = pts[(g.seg + 1) % n]; const L = Math.hypot(b[0] - a[0], b[2] - a[2]) || 1;
        const base = g.clip === CLIP.brisk ? stride[CLIP.brisk] : stride[CLIP.walk]; const v = (base / 1.05) * g.sp * g.h; // cycle = 1.05 s
        g.t += (g.dir * v * dt) / L; g.phase += (dt / 1.05) * g.sp;
        if (g.t > 1 || g.t < 0) { if (g.w.closed) { g.seg = (g.seg + g.dir + n) % n; g.t = g.dir > 0 ? 0 : 1; } else { const ns = g.seg + g.dir; if (ns < 0 || ns > n - 2) { g.dir = -g.dir; g.t = Math.max(0, Math.min(1, g.t)); } else { g.seg = ns; g.t = g.dir > 0 ? 0 : 1; } } }
        const dx = (b[0] - a[0]) / L, dz = (b[2] - a[2]) / L; const tx = a[0] + (b[0] - a[0]) * g.t - dz * g.lat, tz = a[2] + (b[2] - a[2]) * g.t + dx * g.lat;
        g.x += (tx - g.x) * Math.min(1, dt * 6); g.z += (tz - g.z) * Math.min(1, dt * 6); g.y = a[1] + (b[1] - a[1]) * g.t;
        let want = Math.atan2(dx * g.dir, dz * g.dir); let dy = want - g.yaw; dy -= Math.round(dy / 6.2832) * 6.2832; g.yaw += dy * Math.min(1, dt * 5);
        g.blend = Math.max(0, g.blend - dt * 3.5);
        g.timer -= dt; if (g.timer <= 0) { g.state = 1; g.timer = this.rng.f(4, 16); g.clipB = this.rng.pick([CLIP.idle, CLIP.phone, CLIP.phone, CLIP.talk, CLIP.idle]); }
      } else if (g.state === 1) {
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
    if (this.streets) for (const g of this._peds) this.streets.peds.push(g);
    this.meshes.forEach((m, i) => { m.count = counts[i]; m.instanceMatrix.needsUpdate = true; for (const k of ['iAnim', 'iC0', 'iC1', 'iC2']) m.geometry.getAttribute(k).needsUpdate = true; });
    this.umb.count = nu; this.umb.instanceMatrix.needsUpdate = true; if (this.umb.instanceColor) this.umb.instanceColor.needsUpdate = true;
  }
}
