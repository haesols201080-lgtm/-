// Arterial road network (boulevards + ring roads), sidewalks, street lighting, maglev viaduct.
import { ST } from '../render/cityMaterial.js';
import { M } from './builder.js';
import { RINGS, BOULEVARD_W, boulevardPath, ringPath, R_CORE, COAST_X, DISTRICTS, ringRadius } from './layout.js';
import { lampPost, emis, dark, conc, NEON, MAT_POLE } from './kit.js';
import { TAU } from '../core/rng.js';

const SIDEWALK = 5.5;

function distToPolyline(x, z, pts, closed) {
  let best = 1e9; const n = pts.length;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    const dx = b[0] - a[0], dz = b[1] - a[1]; const l2 = dx * dx + dz * dz;
    let t = l2 > 0 ? ((x - a[0]) * dx + (z - a[1]) * dz) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const d = Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t); if (d < best) best = d;
  }
  return best;
}
// per-point frames (tangent + right normal)
function frames(pts, closed) {
  const n = pts.length, out = [];
  for (let i = 0; i < n; i++) {
    const a = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)], b = pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0], tz = b[1] - a[1]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    out.push([tx, tz, -tz, tx]); // tangent, right normal (points to +z when heading +x)
  }
  return out;
}
// emit a strip between two offset curves; offsets measured along the right normal
export function ribbon(ctx, pts, fr, closed, offA, yA, offB, yB, mat, o = {}) {
  const n = pts.length; let s = 0; const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const j = (i + 1) % n; const p = pts[i], q = pts[j], f = fr[i], g = fr[j];
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const mx = (p[0] + q[0]) / 2, mz = (p[1] + q[1]) / 2;
    if (o.skip && o.skip(mx + f[2] * (offA + offB) / 2, mz + f[3] * (offA + offB) / 2, i)) { s += len; continue; }
    const c = ctx._chunk(mx, mz); const b = o.detail ? c.detail : c.main; b.use(mat);
    const ax = p[0] + f[2] * offA, az = p[1] + f[3] * offA, bx = q[0] + g[2] * offA, bz = q[1] + g[3] * offA;
    const cx = q[0] + g[2] * offB, cz = q[1] + g[3] * offB, dx = p[0] + f[2] * offB, dz = p[1] + f[3] * offB;
    // face normal
    const e1x = bx - ax, e1y = 0, e1z = bz - az, e2x = dx - ax, e2y = yB - yA, e2z = dz - az;
    let nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    let flip = false;
    if (o.up) flip = ny < 0; else if (o.down) flip = ny > 0; else if (o.out) { flip = (nx * f[2] + nz * f[3]) * o.out < 0; }
    if (flip) { nx = -nx; ny = -ny; nz = -nz; }
    const uA = o.uA ?? 0, uB = o.uB ?? Math.abs(offB - offA);
    const i0 = b.vert(ax, yA, az, nx, ny, nz, uA, s, 1), i1 = b.vert(bx, yA, bz, nx, ny, nz, uA, s + len, 1);
    const i2 = b.vert(cx, yB, cz, nx, ny, nz, uB, s + len, 1), i3 = b.vert(dx, yB, dz, nx, ny, nz, uB, s, 1);
    flip ? b.quadI(i0, i3, i2, i1) : b.quadI(i0, i1, i2, i3);
    s += len;
  }
}

export function buildRoads(ctx) {
  const roads = [];
  for (let k = 0; k < 8; k++) roads.push({ pts: boulevardPath(k), closed: false, w: BOULEVARD_W, y: 0.06, kind: 'boulevard', k });
  for (let j = 0; j < RINGS.length; j++) roads.push({ pts: ringPath(j, j === 0 ? 120 : j === 1 ? 260 : 380), closed: true, w: RINGS[j].w, y: 0.1, kind: 'ring', j });
  // trim boulevards at the coast
  for (const r of roads) if (r.kind === 'boulevard') r.pts = r.pts.filter((p) => p[0] > COAST_X + 60);
  ctx.roads = roads;

  const paveM = M(ST.PAVE, { color: [0.42, 0.42, 0.44] });
  const curbM = conc(0.5);
  for (const r of roads) {
    const fr = frames(r.pts, r.closed); r.fr = fr;
    const others = roads.filter((o) => o !== r);
    const onOther = (x, z, pad = 0) => { for (const o of others) if (distToPolyline(x, z, o.pts, o.closed) < o.w / 2 + pad) return true; return false; };
    const roadM = M(ST.ROAD, { cellW: r.w });
    ribbon(ctx, r.pts, fr, r.closed, r.w / 2, r.y, -r.w / 2, r.y, roadM, { up: true, uA: 0, uB: r.w });
    for (const s of [1, -1]) {
      const a = s * r.w / 2, b = s * (r.w / 2 + SIDEWALK);
      const skip = (x, z) => onOther(x, z, SIDEWALK * 0.6);
      ribbon(ctx, r.pts, fr, r.closed, a, 0.22, b, 0.22, paveM, { up: true, skip });
      ribbon(ctx, r.pts, fr, r.closed, a, r.y, a, 0.22, curbM, { out: -s, skip });
      // colliders + lamps
      const n = r.pts.length; let acc = 0;
      for (let i = 0; i < (r.closed ? n : n - 1); i++) {
        const p = r.pts[i], q = r.pts[(i + 1) % n]; const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
        const f = fr[i]; const mx = (p[0] + q[0]) / 2 + f[2] * (a + b) / 2, mz = (p[1] + q[1]) / 2 + f[3] * (a + b) / 2;
        if (!skip(mx, mz)) ctx.phys.addBox(mx, mz, len / 2 + 0.3, SIDEWALK / 2, -Math.atan2(q[1] - p[1], q[0] - p[0]), 0, 0.22);
        acc += len;
        if (acc > 44) {
          acc = 0; const lx = p[0] + f[2] * s * (r.w / 2 + 1.2), lz = p[1] + f[3] * s * (r.w / 2 + 1.2);
          if (!onOther(lx, lz, 8)) {
            const yaw = Math.atan2(-f[2] * s, -f[3] * s);
            lampPost(ctx, lx, lz, yaw, { y: 0.22, h: 10.5, arm: 3.4, color: r.kind === 'ring' ? NEON.ice : NEON.sodium, radius: 26, power: 0.8, cone: 0.42 });
          }
        }
      }
    }
    // occupancy + traffic lanes + walkways
    const n = r.pts.length;
    for (let i = 0; i < (r.closed ? n : n - 1); i++) { const p = r.pts[i], q = r.pts[(i + 1) % n]; ctx.occ.markLine(p[0], p[1], q[0], q[1], r.w / 2 + SIDEWALK + 2, 1); }
    ctx.lanes.push({ pts: r.pts.map((p, i) => [p[0] + fr[i][2] * r.w * 0.22, 1.1, p[1] + fr[i][3] * r.w * 0.22]), closed: r.closed, kind: 'ground', speed: 22, dir: 1 });
    ctx.lanes.push({ pts: r.pts.map((p, i) => [p[0] - fr[i][2] * r.w * 0.22, 1.1, p[1] - fr[i][3] * r.w * 0.22]).reverse(), closed: r.closed, kind: 'ground', speed: 22, dir: 1 });
    for (const s of [1, -1]) ctx.walkways.push({ pts: r.pts.map((p, i) => [p[0] + fr[i][2] * s * (r.w / 2 + SIDEWALK * 0.5), 0.22, p[1] + fr[i][3] * s * (r.w / 2 + SIDEWALK * 0.5)]), closed: r.closed });
  }
  buildMaglev(ctx);
}

// elevated maglev loop above the middle ring road, with a station in every district
function buildMaglev(ctx) {
  const j = 1, n = 300, H = 46;
  const pts = []; for (let i = 0; i < n; i++) { const th = (i / n) * TAU; const r = ringRadius(j, th); pts.push([Math.cos(th) * r, Math.sin(th) * r]); }
  const fr = frames(pts, true);
  const deckM = conc(0.42), sideM = dark(0.16), railM = emis(NEON.cyan, 7, 0, false);
  ribbon(ctx, pts, fr, true, 4.2, H, -4.2, H, deckM, { up: true });
  ribbon(ctx, pts, fr, true, -4.2, H - 2.2, 4.2, H - 2.2, sideM, { down: true });
  for (const s of [1, -1]) {
    ribbon(ctx, pts, fr, true, s * 4.2, H - 2.2, s * 4.2, H + 0.9, sideM, { out: s });
    ribbon(ctx, pts, fr, true, s * 4.3, H - 1.0, s * 4.3, H - 0.7, railM, { out: s, detail: true });
    ribbon(ctx, pts, fr, true, s * 1.4, H + 0.02, s * 1.9, H + 0.02, dark(0.3), { up: true, detail: true });
  }
  // pylons
  for (let i = 0; i < n; i += 4) {
    const p = pts[i], f = fr[i]; const yaw = Math.atan2(f[0], f[1]);
    ctx.penAt(p[0], 0, p[1], yaw); const pen = ctx.main();
    pen.use(conc(0.38));
    pen.loft([{ y: 0, pts: [[-1.6, 2.4], [1.6, 2.4], [1.6, -2.4], [-1.6, -2.4]] }, { y: H - 7, pts: [[-1.1, 1.6], [1.1, 1.6], [1.1, -1.6], [-1.1, -1.6]] }, { y: H - 2.2, pts: [[-4.2, 2.2], [4.2, 2.2], [4.2, -2.2], [-4.2, -2.2]] }], { cap: false, aoB: 0.55 });
    ctx.phys.addBox(p[0], p[1], 1.6, 2.4, yaw, 0, H - 4);
    if (i % 12 === 0) ctx.light(p[0], p[1], 30, NEON.cyan, 0.35);
  }
  // collider ring pieces for the deck (so vehicles don't pass through)
  for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; const len = Math.hypot(q[0] - p[0], q[1] - p[1]); ctx.phys.addBox((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, len / 2 + 0.5, 4.3, -Math.atan2(q[1] - p[1], q[0] - p[0]), H - 2.2, H); }
  ctx.maglev = { pts: pts.map((p) => [p[0], H + 0.4, p[1]]), H, stations: [] };
  // stations
  for (const d of DISTRICTS) {
    const th = (d.ang * Math.PI) / 180; const idx = Math.round(((th / TAU) * n + n) % n) % n;
    const p = pts[idx], f = fr[idx]; const yaw = Math.atan2(f[0], f[1]);
    ctx.penAt(p[0], 0, p[1], yaw); let pen = ctx.main();
    const L = 96, W = 22;
    pen.box(0, 0, W, L, H - 2.6, H, { wall: sideM, roof: M(ST.TILE, { color: [0.5, 0.5, 0.52] }), bottom: sideM });
    ctx.solid(0, 0, W, L, H - 2.6, H);
    // canopy
    pen.box(0, 0, W + 4, L - 6, H + 8.5, H + 9.2, { wall: dark(0.2), roof: dark(0.2), bottom: emis(NEON.ice, 2.5) });
    for (let k = -3; k <= 3; k++) for (const sx of [-1, 1]) { pen.use(MAT_POLE); pen.tube(sx * (W / 2 - 1), H, k * 14, sx * (W / 2 - 1), H + 8.5, k * 14, 0.3, 6); }
    // lift towers down to the street
    for (const sx of [-1, 1]) {
      const tx = sx * (W / 2 + 5.5);
      pen.box(tx, 0, 7, 9, 0, H + 6, { wall: M(ST.WIN_CURTAIN, { color: [0.3, 0.42, 0.48], seed: idx & 255, A: 0.9, B: 2, cellW: 2.4, floorH: 4 }), roof: dark(0.2), aoB: 0.6 });
      ctx.solid(tx, 0, 7, 9, 0, H + 6);
      pen.use(emis(d.tint, 9)); pen.box(tx, 4.6, 5, 0.2, 5.2, 5.6, {});
    }
    ctx.detail();
    const rect = d.corp && ctx.atlas.corp[d.corp] ? ctx.atlas.corp[d.corp].word : ctx.atlas.h[0];
    for (const sz of [-1, 1]) ctx.pen.sign(0, H + 6.2, sz * (L / 2 - 4), sz > 0 ? 0 : Math.PI, 16, 4, rect, { intensity: 6, double: true, seed: idx });
    ctx.main();
    ctx.light(p[0], p[1], 70, d.tint, 1.2);
    ctx.maglev.stations.push({ id: d.id, idx, x: p[0], y: H, z: p[1], yaw });
    ctx.poi({ type: 'station', id: 'st-' + d.id, district: d.id, name: d.name + ' 역', x: pen.wx(-(W / 2 + 5.5), 6.5), y: 0.25, z: pen.wz(-(W / 2 + 5.5), 6.5), tx: pen.wx(0, 0), ty: H + 0.1, tz: pen.wz(0, 0) });
    ctx.occ.markRect(p[0], p[1], W / 2 + 12, L / 2 + 4, yaw, 2);
  }
}
