// City orchestration: runs all generators, builds chunk meshes, manages distance based visibility.
import * as THREE from 'three';
import { CityContext, CHUNK } from './context.js';
import { Batch } from './builder.js';
import { M } from './builder.js';
import { ST, createCityMaterial, createGlowMaterial } from '../render/cityMaterial.js';
import { LightField } from '../render/lightfield.js';
import { SignAtlas } from '../render/signs.js';
import { Physics } from '../game/physics.js';
import { createSparks } from '../render/sparks.js';
import { buildRoads } from './roads.js';
import { R_SPRAWL, COAST_X } from './layout.js';

const tick = () => new Promise((r) => setTimeout(r, 0));

export async function buildCity(engine, { seed = 2049, quality, onProgress = () => {}, generators = [] }) {
  const t0 = performance.now();
  const phys = new Physics();
  const lf = new LightField(quality.name === 'low' ? 1024 : 2048);
  const atlas = new SignAtlas(quality.name === 'low' ? 1024 : 2048, seed);
  const ctx = new CityContext({ seed, quality, physics: phys, lightField: lf, atlas });
  const signU = { value: atlas.texture };
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
    if (!b.glow.empty) { rec.glow = new THREE.Mesh(b.glow.build(), glowMat); rec.glow.matrixAutoUpdate = false; rec.glow.renderOrder = 50; group.add(rec.glow); }
    bigs.push(rec);
  }
  const sparks = createSparks(ctx.sparks); group.add(sparks);
  onProgress('라이트 필드 베이크', 0.94); await tick();
  lf.bake(engine.renderer);
  engine.scene.add(group);
  console.log(`[NS] city built in ${((performance.now() - t0) / 1000).toFixed(1)}s — ${chunks.length} chunks, ${(verts / 1e6).toFixed(2)}M verts, ${(tris / 1e6).toFixed(2)}M tris, ${lf.count} lights, ${phys.c.length} colliders, ${ctx.stats.buildings} buildings`);

  const city = {
    ctx, phys, lf, atlas, group, chunks, bigs, sparks, mat, groundMat, glowMat, pois: ctx.pois, lanes: ctx.lanes, stats: { verts, tris },
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
    },
  };
  return city;
}
