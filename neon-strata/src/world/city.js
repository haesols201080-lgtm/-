// City orchestration: runs all generators, builds chunk meshes, manages distance based visibility.
import * as THREE from 'three';
import { CityContext, CHUNK } from './context.js';
import { Batch } from './builder.js';
import { M } from './builder.js';
import { ST, createCityMaterial, createGlowMaterial, NS_OPTS } from '../render/cityMaterial.js';
import { buildLightGrid } from '../render/lightgrid.js';
import { LightField } from '../render/lightfield.js';
import { SignAtlas } from '../render/signs.js';
import { Physics } from '../game/physics.js';
import { createSparks } from '../render/sparks.js';
import { instanceProps } from './props.js';
import { buildRoads } from './roads.js';
import { R_SPRAWL, COAST_X } from './layout.js';

const tick = () => new Promise((r) => setTimeout(r, 0));

export async function buildCity(engine, { seed = 2049, quality, onProgress = () => {}, generators = [] }) {
  const t0 = performance.now();
  const phys = new Physics();
  const lf = new LightField(quality.name === 'low' ? 1024 : 2048);
  onProgress('간판 인쇄', 0.03);
  const atlas = await SignAtlas.create(quality.name === 'low' || quality.name === 'medium' ? 2048 : 4096, seed);
  const ctx = new CityContext({ seed, quality, physics: phys, lightField: lf, atlas });
  const signU = { value: atlas.texture };
  NS_OPTS.localLights = !!quality.localLights;
  const mat = createCityMaterial(quality, signU);
  const groundMat = createCityMaterial(quality, signU);
  groundMat.polygonOffset = true; groundMat.polygonOffsetFactor = 2; groundMat.polygonOffsetUnits = 6;
  const glowMat = createGlowMaterial({});
  glowMat.uniforms.uSignAtlas = signU;

  const steps = [['간선 도로망 부설', () => buildRoads(ctx)], ...generators];
  for (let i = 0; i < steps.length; i++) {
    onProgress(steps[i][0], 0.05 + 0.8 * (i / steps.length));
    await tick();
    const t = performance.now();
    steps[i][1](ctx);
    console.log(`[NS] gen ${steps[i][0]}: ${(performance.now() - t).toFixed(0)}ms`);
  }
  onProgress('지오메트리 업로드', 0.88); await tick();

  const group = new THREE.Group(); group.name = 'city';
  const chunks = [];
  let verts = 0, tris = 0;
  const add = (batch, m, order = 0) => { if (batch.empty) return null; verts += batch.n; tris += batch.ni / 3; const mesh = new THREE.Mesh(batch.build(), m); mesh.matrixAutoUpdate = false; mesh.renderOrder = order; group.add(mesh); return mesh; };
  // ground: one merged slab of chunk quads inside the playable radius
  const nC = Math.ceil((R_SPRAWL + 600) / CHUNK);
  const gb = new Batch(4096); gb.use(M(ST.ROAD, { cellW: 0 }));
  for (let cx = -nC; cx < nC; cx++) for (let cz = -nC; cz < nC; cz++) {
    const x0 = cx * CHUNK, z0 = cz * CHUNK;
    if (Math.hypot(x0 + CHUNK / 2, z0 + CHUNK / 2) > R_SPRAWL + 700) continue;
    if (x0 + CHUNK < COAST_X - 60) continue;
    const xa = Math.max(x0, COAST_X - 60);
    const i0 = gb.vert(xa, 0, z0 + CHUNK, 0, 1, 0, 0, 0), i1 = gb.vert(x0 + CHUNK, 0, z0 + CHUNK, 0, 1, 0, 1, 0), i2 = gb.vert(x0 + CHUNK, 0, z0, 0, 1, 0, 1, 1), i3 = gb.vert(xa, 0, z0, 0, 1, 0, 0, 1);
    gb.quadI(i0, i1, i2, i3);
  }
  const ground = add(gb, groundMat, -5); ground.frustumCulled = false;
  for (const c of ctx.chunks.values()) {
    const rec = { x: c.x, z: c.z, ground: null, main: add(c.main, mat), detail: add(c.detail, mat), glow: null };
    if (!c.glow.empty) { rec.glow = new THREE.Mesh(c.glow.build(), glowMat); rec.glow.matrixAutoUpdate = false; rec.glow.renderOrder = 50; group.add(rec.glow); }
    chunks.push(rec);
  }
  const bigs = [];
  for (const [name, b] of ctx.named) {
    const rec = { name, main: add(b.main, mat), glow: null };
    if (rec.main && name === 'spire') { rec.main.castShadow = true; rec.main.receiveShadow = true; }
    if (!b.glow.empty) { rec.glow = new THREE.Mesh(b.glow.build(), glowMat); rec.glow.matrixAutoUpdate = false; rec.glow.renderOrder = 50; group.add(rec.glow); }
    bigs.push(rec);
  }
  // aviation obstruction lights: every tall structure carries red lamps on its top corners (and every ~150 m up a supertall)
  { const seen = new Set();
    for (const f of ctx.footprints) {
      const top = f[6]; if (top < 110 || top - f[5] < 50) continue;
      const key = Math.round(f[0] / 6) * 100003 + Math.round(f[1] / 6) * 31 + Math.round(top / 8); if (seen.has(key)) continue; seen.add(key);
      const c = Math.cos(f[4]), s = Math.sin(f[4]); const hx = f[2] * 0.92, hz = f[3] * 0.92;
      const put = (lx, lz, y, sz) => ctx.sparks.push(f[0] + lx * c + lz * s, y, f[1] - lx * s + lz * c, 2.6, 0.07, 0.03, sz);
      put(hx, hz, top + 1.5, 3.2); put(-hx, -hz, top + 1.5, 3.2);
      if (top > 260) { put(hx, -hz, top + 1.5, 3.2); put(-hx, hz, top + 1.5, 3.2); for (let y = top - 150; y > 120; y -= 150) { put(hx, hz, y, 2.6); put(-hx, -hz, y, 2.6); } }
    } }
  const sparks = createSparks(ctx.sparks); group.add(sparks);
  const props = instanceProps(ctx, mat, group);
  onProgress('라이트 필드 베이크', 0.94); await tick();
  lf.bake(engine.renderer);
  const lg = quality.localLights ? buildLightGrid(ctx.lights, quality.localLights) : null;
  if (lg) console.log(`[NS] light grid: ${lg.raw} emitters → ${lg.alive}/${lg.lights} lights, ${lg.shrunk} shrunk, ${lg.dropped} dropped, ${lg.slots} slots, max ${lg.maxPerCell}/cell`);
  engine.scene.add(group);
  console.log(`[NS] city built in ${((performance.now() - t0) / 1000).toFixed(1)}s — ${chunks.length} chunks, ${(verts / 1e6).toFixed(2)}M verts, ${(tris / 1e6).toFixed(2)}M tris, ${lf.count} lights, ${phys.c.length} colliders, ${ctx.stats.buildings} buildings, ${props.total} props, ${ctx.blocks ? ctx.blocks.length : 0} blocks`);

  // audit: count building footprints that intersect (SAT on yaw-oriented boxes with overlapping height ranges)
  const audit = () => {
    const F = ctx.footprints; const cell = 120; const grid = new Map(); let bad = 0; const samples = [];
    const ax = (f) => { const c = Math.cos(f[4]), s = Math.sin(f[4]); return [[c, -s], [s, c]]; };
    const sep = (a, b) => { const A = ax(a), B = ax(b); const dx = b[0] - a[0], dz = b[1] - a[1]; for (const [n, h] of [[A[0], null], [A[1], null], [B[0], null], [B[1], null]]) { const pa = a[2] * Math.abs(A[0][0] * n[0] + A[0][1] * n[1]) + a[3] * Math.abs(A[1][0] * n[0] + A[1][1] * n[1]); const pb = b[2] * Math.abs(B[0][0] * n[0] + B[0][1] * n[1]) + b[3] * Math.abs(B[1][0] * n[0] + B[1][1] * n[1]); if (Math.abs(dx * n[0] + dz * n[1]) > pa + pb - 0.05) return true; } return false; };
    F.forEach((f, i) => { const r = Math.hypot(f[2], f[3]); for (let gx = Math.floor((f[0] - r) / cell); gx <= Math.floor((f[0] + r) / cell); gx++) for (let gz = Math.floor((f[1] - r) / cell); gz <= Math.floor((f[1] + r) / cell); gz++) { const k = gx * 10007 + gz; let a = grid.get(k); if (!a) { a = []; grid.set(k, a); } a.push(i); } });
    const seen = new Set();
    for (const arr of grid.values()) for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) { const a = F[arr[i]], b = F[arr[j]]; const key = arr[i] * 100000 + arr[j]; if (seen.has(key)) continue; seen.add(key); if (a[6] <= b[5] + 0.05 || b[6] <= a[5] + 0.05) continue; if (!sep(a, b)) { bad++; if (samples.length < 6) samples.push([a[0].toFixed(0), a[1].toFixed(0), a[7], b[7]]); } }
    return { footprints: F.length, overlaps: bad, samples };
  };
  const city = {
    audit,
    ctx, phys, lf, atlas, group, chunks, bigs, sparks, props, mat, groundMat, glowMat, pois: ctx.pois, lanes: ctx.lanes, stats: { verts, tris },
    update(cam) {
      sparks.material.uniforms.uScale.value = engine.renderer.getDrawingBufferSize(new THREE.Vector2()).y / (2 * Math.tan((engine.camera.fov * Math.PI) / 360));
      const dd = quality.detailDist, fd = quality.farChunkDist;
      for (let i = 0; i < chunks.length; i++) {
        const c = chunks[i]; const d = Math.hypot(c.x - cam.x, c.z - cam.z) - CHUNK * 0.7;
        const hd = Math.max(d, (cam.y - 250) * 0.9);
        if (c.main) c.main.visible = d < fd;
        if (c.ground) c.ground.visible = d < fd;
        if (c.detail) c.detail.visible = hd < dd;
        if (c.glow) c.glow.visible = hd < dd * 1.6;
      }
      const pd = dd * 0.75;
      for (let i = 0; i < props.cells.length; i++) { const c = props.cells[i]; c.mesh.visible = Math.hypot(c.x - cam.x, c.y - cam.y, c.z - cam.z) - c.r < pd; }
    },
  };
  return city;
}
