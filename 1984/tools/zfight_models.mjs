// Scans assets/models/*.glb for faces that z-fight (see zfight_core.js).
// node tools/zfight_models.mjs [name ...]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const require = createRequire(import.meta.url);
const { findCoplanar } = require('./zfight_core.cjs');

const root = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const dir = path.join(root, 'assets/models');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const names = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(dir).filter((f) => f.endsWith('.glb')).map((f) => f.slice(0, -4));

const mul = (m, p) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
for (const name of names) {
  if (name.startsWith('char_')) continue;   // skinned people: layered clothes are offset on purpose
  const doc = await io.read(path.join(dir, name + '.glb'));
  const tris = [];
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const M = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      if (!pos) continue;
      const idx = prim.getIndices();
      const mat = prim.getMaterial();
      const tag = node.getName() + ':' + (mat ? mat.getName() : '-');
      const n = idx ? idx.getCount() : pos.getCount();
      const v = (i) => mul(M, pos.getElement(idx ? idx.getScalar(i) : i, []));
      for (let i = 0; i + 2 < n; i += 3) tris.push({ a: v(i), b: v(i + 1), c: v(i + 2), tag, idx: tris.length });
    }
  }
  const res = findCoplanar(tris, { sameTag: false, tol: 0.003, minArea: 5e-4 });
  if (!res.length) continue;
  console.log(`${name} (${tris.length} tris)`);
  for (const r of res.slice(0, 8)) console.log(`   ${r.tagA}  ~  ${r.tagB}  gap ${(r.gap * 1000).toFixed(1)}mm  area ${r.area.toFixed(3)}m2  near ${r.at}`);
}
