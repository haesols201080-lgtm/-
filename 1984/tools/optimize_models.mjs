// Compresses assets/models/*.glb into assets/models_opt/*.glb with welded
// vertices, quantized attributes and EXT_meshopt_compression. three.js
// decodes them with MeshoptDecoder (no extra files needed).
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, dedup, prune, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';

const root = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const src = path.join(root, 'assets/models');
const dst = path.join(root, 'assets/models_opt');
fs.mkdirSync(dst, { recursive: true });
await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder,
});
let a = 0, b = 0;
const only = process.argv.slice(2);
for (const f of fs.readdirSync(src).sort()) {
  if (!f.endsWith('.glb')) continue;
  if (only.length && !only.includes(f.replace('.glb', ''))) continue;
  const doc = await io.read(path.join(src, f));
  await doc.transform(dedup(), weld(), prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  const outPath = path.join(dst, f);
  await io.write(outPath, doc);
  const s0 = fs.statSync(path.join(src, f)).size, s1 = fs.statSync(outPath).size;
  a += s0; b += s1;
}
console.log(`models: ${(a / 1048576).toFixed(1)} MB -> ${(b / 1048576).toFixed(1)} MB`);
