// Street traffic near the player, simulated for real: right-hand directional lanes built from the street network,
// signalled junctions (two-phase cycles with amber and all-red), car following with the Intelligent Driver Model
// (cars keep their distance, queue at red lights, pull away on green, stop for people in the road), and turns into
// connecting streets at the end of each block. Far traffic stays on the GPU (fx/traffic.js hides its ground cars here).
import * as THREE from 'three';
import { Batch, Pen } from '../world/builder.js';
import { PROPS } from '../world/props.js';
import { U, NS_COMMON } from '../render/env.js';
import { RNG } from '../core/rng.js';

const CYCLE = 46; // s: A green 0-18, amber 18-21, all red 21-23, B green 23-41, amber 41-44, all red 44-46
// main roads get the longer green where a side street joins them
function signal(node, group, t) { const gA = node.gA || 18, gB = node.gB || 18, cyc = gA + gB + 10; const c = ((t + node.off) % cyc + cyc) % cyc; const g0 = group ? gA + 5 : 0, gl = group ? gB : gA; const d = c - g0; return d >= 0 && d < gl ? 0 : d >= gl && d < gl + 3 ? 1 : 2; } // 0 green 1 amber 2 red

function buildLanes(ctx) {
  const lanes = [];
  const add = (pts, off, speed, closed, src) => {
    const n = pts.length; if (n < 2) return; const P = [], H = [];
    for (let i = 0; i < n; i++) { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)]; let dx = b[0] - a[0], dz = b[1] - a[1]; if (closed) { const a2 = pts[(i - 1 + n) % n], b2 = pts[(i + 1) % n]; dx = b2[0] - a2[0]; dz = b2[1] - a2[1]; } const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; P.push([pts[i][0] - dz * off, pts[i][1] + dx * off]); H.push([dx, dz]); }
    if (closed) { P.push(P[0]); H.push(H[0]); }
    const cum = [0]; for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    if (cum[cum.length - 1] < 25) return; lanes.push({ P, H, cum, len: cum[cum.length - 1], speed, closed, src, stops: [], next: [], id: lanes.length });
  };
  (ctx.roads || []).forEach((r, k) => { const off = r.w * 0.2; add(r.pts, off, 15, r.closed, 'r' + k); add(r.pts.slice().reverse(), off, 15, r.closed, 'r' + k); });
  (ctx.streets || []).forEach((s, k) => { if (s.w < 7) return; const off = Math.min(s.w * 0.22, 2.6); add(s.pts, off, 10.5, false, 's' + k); add(s.pts.slice().reverse(), off, 10.5, false, 's' + k); });
  return lanes;
}
function at(L, s) { // position + heading at arc length s
  if (L.closed) s = ((s % L.len) + L.len) % L.len; else s = Math.max(0, Math.min(L.len, s));
  let lo = 0, hi = L.cum.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (L.cum[m] <= s) lo = m; else hi = m; }
  const t = (s - L.cum[lo]) / Math.max(1e-6, L.cum[hi] - L.cum[lo]); const a = L.P[lo], b = L.P[hi];
  const hx = b[0] - a[0], hz = b[1] - a[1], hl = Math.hypot(hx, hz) || 1; return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, hx / hl, hz / hl];
}

function buildNetwork(lanes) {
  // spatial hash of lane samples
  const CELL = 24, grid = new Map(); const key = (x, z) => Math.floor(x / CELL) * 100003 + Math.floor(z / CELL);
  lanes.forEach((L, li) => { for (let i = 0; i < L.P.length - 1; i++) { const k = key(L.P[i][0], L.P[i][1]); (grid.get(k) || grid.set(k, []).get(k)).push([li, i]); } });
  const near = (x, z, f) => { for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const g = grid.get((Math.floor(x / CELL) + a) * 100003 + Math.floor(z / CELL) + b); if (g) for (const e of g) f(e); } };
  // crossings → junction nodes with signals
  const nodes = []; const nodeAt = (x, z) => { for (const n of nodes) if (Math.abs(n.x - x) < 18 && Math.abs(n.z - z) < 18) return n; const n = { x, z, a0: null, off: Math.random() * CYCLE, id: nodes.length }; nodes.push(n); return n; };
  const nodeNear = (x, z) => nodes.find((n) => Math.abs(n.x - x) < 18 && Math.abs(n.z - z) < 18);
  const seen = new Set();
  lanes.forEach((L, li) => { for (let i = 0; i < L.P.length - 1; i++) { const p = L.P[i], q = L.P[i + 1];
    near(p[0], p[1], ([lj, j]) => { if (lj <= li || lanes[lj].src === L.src) return; const M = lanes[lj]; const r = M.P[j], u = M.P[j + 1]; if (!u) return;
      const d1x = q[0] - p[0], d1z = q[1] - p[1], d2x = u[0] - r[0], d2z = u[1] - r[1]; const den = d1x * d2z - d1z * d2x; if (Math.abs(den) < 1e-6) return;
      const t = ((r[0] - p[0]) * d2z - (r[1] - p[1]) * d2x) / den, w = ((r[0] - p[0]) * d1z - (r[1] - p[1]) * d1x) / den; if (t < 0 || t > 1 || w < 0 || w > 1) return;
      const k2 = li * 1e6 + lj * 1000 + ((i * 7 + j) % 997); if (seen.has(k2)) return; seen.add(k2);
      const x = p[0] + d1x * t, z = p[1] + d1z * t; const n = nodeAt(x, z); const sA = L.cum[i] + Math.hypot(d1x, d1z) * t, sB = M.cum[j] + Math.hypot(d2x, d2z) * w;
      for (const [LL, ss, hx, hz] of [[L, sA, d1x, d1z], [M, sB, d2x, d2z]]) { const ang = Math.atan2(hz, hx); if (n.a0 === null) n.a0 = ang; let dd = Math.abs(((ang - n.a0) % Math.PI + Math.PI) % Math.PI); dd = Math.min(dd, Math.PI - dd);
        const g = dd < Math.PI / 4 ? 0 : 1; const ex = LL.stops.find((q2) => q2.node === n); if (!ex) LL.stops.push({ node: n, group: g, s: ss - 7 }); else ex.s = Math.min(ex.s, ss - 7); } }); } });
  const grp = (n, hx, hz) => { const ang = Math.atan2(hz, hx); if (n.a0 === null) n.a0 = ang; let dd = Math.abs(((ang - n.a0) % Math.PI + Math.PI) % Math.PI); dd = Math.min(dd, Math.PI - dd); return dd < Math.PI / 4 ? 0 : 1; };
  const addStop = (L, n, s) => { if (s < 3) return; const g = grp(n, ...(at(L, s + 2).slice(2))); const ex = L.stops.find((q2) => q2.node === n); if (!ex) L.stops.push({ node: n, group: g, s }); else ex.s = Math.min(ex.s, s); };
  for (const L of lanes) { if (L.closed) continue; const e = L.P[L.P.length - 1]; const n = nodeAt(e[0], e[1]); (n.srcs || (n.srcs = new Set())).add(L.src); n.cnt = (n.cnt || 0) + 1; L.endNode = n; }
  for (const n of nodes) { if (!n.srcs) continue; // arterial lanes running past a side-street junction stop for it too
    near(n.x, n.z, ([lj, j]) => { const M = lanes[lj]; if (n.srcs.has(M.src)) return; const p = M.P[j]; if (Math.hypot(p[0] - n.x, p[1] - n.z) > 16) return; n.pass = true; addStop(M, n, M.cum[j] - 9); const st = M.stops.find((q) => q.node === n); if (st) n.major = st.group; }); }
  for (const L of lanes) if (L.endNode && (L.endNode.cnt >= 2 || L.endNode.pass)) addStop(L, L.endNode, L.len - 4);
  for (const n of nodes) { n.real = !!(n.srcs && n.srcs.size >= 2) || !!n.pass || (!n.srcs); if (n.major !== undefined) { if (n.major === 0) { n.gA = 30; n.gB = 11; } else { n.gA = 11; n.gB = 30; } } }
  for (const L of lanes) { L.stops = L.stops.filter((q) => q.s > 3 && q.node.real !== false); L.stops.sort((a, b) => a.s - b.s); }
  // connections at the end of open lanes: the closest point of every lane passing (or starting) within 22 m, roughly ahead;
  // a dead end turns round into its own street's other direction
  const SEG = new Map(); lanes.forEach((L, li) => { for (let i = 0; i < L.P.length - 1; i++) { const a = L.P[i], b2 = L.P[i + 1]; const n = Math.max(1, Math.ceil(Math.hypot(b2[0] - a[0], b2[1] - a[1]) / 12)); const ks = new Set(); for (let q = 0; q <= n; q++) { const x = a[0] + (b2[0] - a[0]) * q / n, z = a[1] + (b2[1] - a[1]) * q / n; ks.add(key(x, z)); } for (const k of ks) (SEG.get(k) || SEG.set(k, []).get(k)).push([li, i]); } });
  for (const L of lanes) { if (L.closed) continue; const e = L.P[L.P.length - 1], h = L.H[L.H.length - 1]; const best = new Map();
    for (let a2 = -1; a2 <= 1; a2++) for (let b3 = -1; b3 <= 1; b3++) { const g = SEG.get((Math.floor(e[0] / CELL) + a2) * 100003 + Math.floor(e[1] / CELL) + b3); if (!g) continue;
      for (const [lj, j] of g) { const M = lanes[lj]; if (M === L || M.src === L.src) continue; const p = M.P[j], q = M.P[j + 1]; const dx = q[0] - p[0], dz = q[1] - p[1]; const l2 = dx * dx + dz * dz || 1; const t = Math.max(0, Math.min(1, ((e[0] - p[0]) * dx + (e[1] - p[1]) * dz) / l2));
        const cx = p[0] + dx * t, cz = p[1] + dz * t; const d = Math.hypot(cx - e[0], cz - e[1]); if (d > 22) continue; const ll = Math.sqrt(l2); if ((dx * h[0] + dz * h[1]) / ll < -0.3) continue;
        const sj = M.cum[j] + ll * t + 4; if (!M.closed && sj > M.len - 15) continue; const ex = best.get(lj); if (!ex || d < ex.d) best.set(lj, { lane: M, s: sj, d }); } }
    L.next = [...best.values()];
    if (!L.next.length) { const rev = lanes.find((M) => M !== L && M.src === L.src && !M.closed && Math.hypot(M.P[0][0] - e[0], M.P[0][1] - e[1]) < 9); if (rev) L.next = [{ lane: rev, s: 2, d: 0, uturn: true }]; } }
  return nodes;
}

export function createStreetTraffic(city, scene, quality, game) {
  const N = { low: 80, medium: 150, high: 210, ultra: 300 }[quality.name] || 180, R = 340;
  const t0 = performance.now(); const lanes = buildLanes(city.ctx); const nodes = buildNetwork(lanes);
  console.log(`[NS] street traffic: ${lanes.length} lanes, ${nodes.length} signalled junctions, ${(performance.now() - t0).toFixed(0)} ms`);
  const rng = new RNG(4242); const cars = [];
  // body: the hover-car model, instanced with per-car paint
  const b = new Batch(512); const pen = new Pen(b); pen.at(0, 0, 0, 0); PROPS.hovercar(pen);
  const mesh = new THREE.InstancedMesh(b.build(), city.mat, N); mesh.frustumCulled = false; mesh.count = 0; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(mesh);
  const col = new THREE.Color(); for (let i = 0; i < N; i++) mesh.setColorAt(i, col.setRGB(1, 1, 1));
  // head, tail and brake lights + signal heads: one additive point cloud
  const MAXP = N * 2 + 400; const lp = new Float32Array(MAXP * 3), lc = new Float32Array(MAXP * 4); const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.BufferAttribute(lp, 3).setUsage(THREE.DynamicDrawUsage)); lg.setAttribute('aCol', new THREE.BufferAttribute(lc, 4).setUsage(THREE.DynamicDrawUsage));
  const lmat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { ...U, uScale: { value: 600 } },
    vertexShader: `${NS_COMMON}\nattribute vec4 aCol; uniform float uScale; varying vec3 vC; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); float d = max(-mv.z, 1.0); float px = aCol.a * uScale / d; gl_PointSize = clamp(px, 1.5, 40.0); vC = aCol.rgb * min(1.0, px / 1.5) * exp(-nsFogOD(cameraPosition, position)); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: 'varying vec3 vC; void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; float a = max(0.0, 1.0 - r); gl_FragColor = vec4(vC * a * a, 0.0); }' });
  const lights = new THREE.Points(lg, lmat); lights.frustumCulled = false; lights.renderOrder = 42; scene.add(lights);
  // nearby cars are solid to the player
  const dynCols = []; for (let i = 0; i < 10; i++) { const c = { t: 0, cx: 0, cz: 0, hx: 1.0, hz: 2.3, cs: 1, sn: 0, y0: -100, y1: -99, tag: 7 }; dynCols.push(c); city.phys.dyn.push(c); }
  const PAINT = [[0.9, 0.9, 0.92], [0.18, 0.18, 0.2], [0.6, 0.62, 0.66], [0.55, 0.12, 0.1], [0.12, 0.2, 0.36], [0.85, 0.82, 0.74], [0.25, 0.32, 0.28], [0.95, 0.75, 0.2]];
  let local = [], localT = -1e9; const refresh = (p) => { local = lanes.filter((L) => L.P.some((q, i) => i % 3 === 0 && Math.abs(q[0] - p.x) < R && Math.abs(q[1] - p.z) < R)); };
  const spawn = (p, near) => {
    if (!local.length) return;
    for (let tries = 0; tries < 20; tries++) {
      const L = local[rng.i(0, local.length - 1)]; const s = rng.f(0, L.len); const [x, z] = at(L, s); const d = Math.hypot(x - p.x, z - p.z);
      if (d > R || d < (near ? 0 : 140)) continue; if (cars.some((c) => c.lane === L && Math.abs(c.s - s) < 14)) continue;
      const c = { lane: L, s, v: L.speed * rng.f(0.5, 0.9), v0: L.speed * rng.f(0.85, 1.15), paint: rng.pick(PAINT), rx: x, rz: z, ox: 0, oz: 0, yaw: 0, oyaw: 0, brake: 0, a: 0 }; const h = at(L, s); c.yaw = Math.atan2(h[2], h[3]); cars.push(c); return;
    }
  };
  let simT = 0, first = true;
  return {
    lanes, nodes, cars, R,
    update(dt, p) {
      dt = Math.min(dt, 0.1); simT += dt; if (simT - localT > 2 || first) { localT = simT; refresh(p); }
      while (cars.length < N) { const k = cars.length; spawn(p, first); if (cars.length === k) break; } first = false;
      // leaders per lane
      const by = new Map(); for (const c of cars) (by.get(c.lane) || by.set(c.lane, []).get(c.lane)).push(c); for (const a of by.values()) a.sort((x, y) => x.s - y.s);
      const pl = game.player; const pp = pl.mode === 'fly' ? pl.vpos : pl.pos; const onRoad = pp.y < 3.5;
      for (let i = cars.length - 1; i >= 0; i--) {
        const c = cars[i], L = c.lane;
        // obstacle ahead: next car, red/amber stop line, or the player standing in the lane
        let gap = 1e9, dv = 0; const arr = by.get(L); const k = arr.indexOf(c);
        if (k >= 0 && k < arr.length - 1) { const o = arr[k + 1]; gap = o.s - c.s - 5; dv = c.v - o.v; } else if (L.closed && arr.length > 1) { const o = arr[0]; gap = o.s + L.len - c.s - 5; dv = c.v - o.v; }
        for (const st of L.stops) { if (st.s < c.s - 0.5) continue; if (st.s - c.s > 80) break; const sg = signal(st.node, st.group, simT); const dist = st.s - c.s; if (sg === 2 || (sg === 1 && dist > c.v * c.v / 7 + 1)) { if (dist < gap) { gap = dist; dv = c.v; } } break; }
        if (onRoad) { const [x, z, hx, hz] = at(L, c.s); const rx = pp.x - x, rz = pp.z - z; const ahead = rx * hx + rz * hz, lat = Math.abs(-rx * hz + rz * hx); if (ahead > 0 && ahead < 30 && lat < 2.4 && ahead - 4 < gap) { gap = Math.max(0.1, ahead - 4); dv = c.v; } }
        if (!L.closed && c.s > L.len - 25) { if (!L.next.length) gap = Math.min(gap, L.len - c.s); else { if (!c.nx || c.nxL !== L) { c.nx = rng.pick(L.next); c.nxL = L; } const tgt = by.get(c.nx.lane); if (tgt && tgt.some((o) => o !== c && Math.abs(o.s - c.nx.s) < 7)) gap = Math.min(gap, L.len - 1 - c.s); } }
        const sStar = 2.5 + Math.max(0, c.v * 1.3 + (c.v * dv) / (2 * Math.sqrt(2.0 * 3.2)));
        const acc = 2.0 * (1 - Math.pow(c.v / c.v0, 4) - Math.pow(sStar / Math.max(0.1, gap), 2));
        c.a = Math.max(-8, acc); c.v = Math.max(0, c.v + c.a * dt); c.s += c.v * dt; c.brake += ((c.a < -0.6 || c.v < 0.3 ? 1 : 0) - c.brake) * Math.min(1, dt * 6);
        if (!L.closed && c.s >= L.len - 0.5) { // turn into a connecting street, or leave
          if (L.next.length) { const nx = c.nx && c.nxL === L ? c.nx : rng.pick(L.next); c.nx = null; const old = at(L, c.s); c.lane = nx.lane; c.s = nx.s; const nw = at(c.lane, c.s); c.ox += old[0] - nw[0]; c.oz += old[1] - nw[1]; const ny = Math.atan2(nw[2], nw[3]); let dy = Math.atan2(old[2], old[3]) - ny; dy -= Math.round(dy / 6.2832) * 6.2832; c.oyaw += dy; c.v *= 0.6; }
          else { cars.splice(i, 1); continue; }
        }
        const [x, z, hx, hz] = at(c.lane, c.s); const kk = Math.exp(-dt * 2.6); c.ox *= kk; c.oz *= kk; c.oyaw *= kk; c.rx = x + c.ox; c.rz = z + c.oz; c.yaw = Math.atan2(hx, hz) + c.oyaw;
        c.wait = c.v < 0.2 ? (c.wait || 0) + dt : 0; // nobody waits forever: a stuck car turns off out of the scene
        if (Math.hypot(c.rx - p.x, c.rz - p.z) > R + 80 || (c.wait > 50 && Math.hypot(c.rx - p.x, c.rz - p.z) > 60)) cars.splice(i, 1);
      }
      // draw
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), sc = new THREE.Vector3(1, 1, 1), ps = new THREE.Vector3(); let np = 0;
      const pt = (x, y, z, r, g, bl, s) => { if (np >= MAXP) return; lp[np * 3] = x; lp[np * 3 + 1] = y; lp[np * 3 + 2] = z; lc[np * 4] = r; lc[np * 4 + 1] = g; lc[np * 4 + 2] = bl; lc[np * 4 + 3] = s; np++; };
      const night = U.uNight.value;
      cars.forEach((c, i) => { const bob = Math.sin(simT * 1.7 + i) * 0.04; q.setFromAxisAngle(up, c.yaw); m.compose(ps.set(c.rx, 0.32 + bob, c.rz), q, sc); mesh.setMatrixAt(i, m); mesh.setColorAt(i, col.setRGB(c.paint[0], c.paint[1], c.paint[2]));
        const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw); const hl = 0.6 + 2.2 * night; pt(c.rx + fx * 2.35, 0.95, c.rz + fz * 2.35, hl, hl * 0.95, hl * 0.85, 0.9); const br = 0.5 + 2.5 * c.brake + 0.6 * night; pt(c.rx - fx * 2.4, 1.0, c.rz - fz * 2.4, br * 1.2, br * 0.08, br * 0.04, 0.7 + 0.5 * c.brake); });
      mesh.count = cars.length; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      // signal heads on the approaches near the player
      for (const L of lanes) { if (np >= MAXP - 2) break; for (const st of L.stops) { const [x, z, hx, hz] = at(L, st.s); if (Math.abs(x - p.x) > 220 || Math.abs(z - p.z) > 220) continue; const sg = signal(st.node, st.group, simT); const col3 = sg === 0 ? [0.1, 2.6, 0.9] : sg === 1 ? [2.6, 1.6, 0.1] : [2.8, 0.15, 0.08]; pt(x - hz * 3.2, 5.7, z + hx * 3.2, col3[0], col3[1], col3[2], 0.55); } }
      lg.setDrawRange(0, np); lg.attributes.position.needsUpdate = true; lg.attributes.aCol.needsUpdate = true;
      lmat.uniforms.uScale.value = game.engine.renderer.getDrawingBufferSize(new THREE.Vector2()).y / (2 * Math.tan((game.engine.camera.fov * Math.PI) / 360));
      // the ten nearest cars collide with the player
      const near = cars.map((c) => [Math.hypot(c.rx - pp.x, c.rz - pp.z), c]).sort((a, b2) => a[0] - b2[0]).slice(0, dynCols.length);
      dynCols.forEach((o, i) => { const e = near[i]; if (!e || e[0] > 30) { o.y0 = -100; o.y1 = -99; return; } const c = e[1]; o.cx = c.rx; o.cz = c.rz; o.cs = Math.cos(c.yaw); o.sn = Math.sin(c.yaw); o.y0 = 0; o.y1 = 1.5; });
    },
  };
}
