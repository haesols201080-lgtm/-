// Compresses assets/models/*.glb into assets/models_opt/*.glb with welded
// vertices, quantized attributes and EXT_meshopt_compression. three.js
// decodes them with MeshoptDecoder (no extra files needed).
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, dedup, prune, meshopt, resample } from '@gltf-transform/functions';
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
// Skinned people: only bone rotations matter on screen (plus the hips'
// translation for the walk bob); face bones and scale keys are dropped.
function pruneAnimation(doc) {
  const root = doc.getRoot();
  const face = new Set();
  const head = root.listNodes().find((n) => n.getName() === 'head');
  if (head) head.traverse((n) => { if (n !== head) face.add(n); });
  for (const anim of root.listAnimations()) {
    for (const ch of anim.listChannels()) {
      const node = ch.getTargetNode();
      const p = ch.getTargetPath();
      const name = node ? node.getName() : '';
      if (!node || face.has(node) || p === 'scale' || (p === 'translation' && name !== 'hips')) {
        const s = ch.getSampler();
        ch.dispose();
        if (s && s.listParents().length <= 1) s.dispose();
      }
    }
  }
}

// The game's textures keep three's default flipY = true (v up, as in Blender);
// the Blender exporter writes glTF's v down, so turn it back.
function flipV(doc) {
  const seen = new Set();
  for (const mesh of doc.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) {
    const uv = p.getAttribute('TEXCOORD_0');
    if (!uv || seen.has(uv)) continue;
    seen.add(uv);
    const e = [];
    for (let i = 0; i < uv.getCount(); i++) { uv.getElement(i, e); uv.setElement(i, [e[0], 1 - e[1]]); }
  }
}

let a = 0, b = 0;
const only = process.argv.slice(2);
for (const f of fs.readdirSync(src).sort()) {
  if (!f.endsWith('.glb')) continue;
  if (only.length && !only.includes(f.replace('.glb', ''))) continue;
  const doc = await io.read(path.join(src, f));
  if (f.startsWith('char_')) pruneAnimation(doc);
  else flipV(doc);
  // keepAttributes: the Blender materials carry no images (the game supplies
  // its textures by material name), so a plain prune() would drop TEXCOORD_0
  // and every model would show one texel of its texture
  await doc.transform(dedup(), weld(), resample({ tolerance: 2e-4 }), prune({ keepAttributes: true }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  const outPath = path.join(dst, f);
  await io.write(outPath, doc);
  const s0 = fs.statSync(path.join(src, f)).size, s1 = fs.statSync(outPath).size;
  a += s0; b += s1;
}
console.log(`models: ${(a / 1048576).toFixed(1)} MB -> ${(b / 1048576).toFixed(1)} MB`);
