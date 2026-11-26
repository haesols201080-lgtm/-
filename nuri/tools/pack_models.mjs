// Packs every .glb in a production build (dist/models) for an artifact host that only serves standard web media types
// and stores text files at face value:
//   * images move out of the model into their own files next to it (JPEG bytes kept exactly; PNGs are left as .png
//     here and turned into .webp by tools/artifact_assets.py, which references them by the .webp name already)
//   * geometry is compressed with EXT_meshopt_compression and the binary buffer is embedded as a base64 data URI in
//     the glTF JSON. Float vertex data goes through meshopt's exponential filter, which decodes back to float32, so the
//     game sees the same attribute layout as before (positions keep 18 mantissa bits, about 1/100 mm on a tree);
//     indices, skins, animation and integer attributes are compressed losslessly.
// Usage: node tools/pack_models.mjs dist
import fs from 'node:fs';
import path from 'node:path';
import { MeshoptEncoder } from 'meshoptimizer';

await MeshoptEncoder.ready;
const D = process.argv[2];
const COMP = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };
const align = (n, a = 4) => Math.ceil(n / a) * a;

function readGLB(file) {
  const b = fs.readFileSync(file);
  if (b.readUInt32LE(0) !== 0x46546c67) throw new Error('not a GLB: ' + file);
  let off = 12, json = null, bin = Buffer.alloc(0);
  while (off < b.length) {
    const len = b.readUInt32LE(off), type = b.readUInt32LE(off + 4), chunk = b.subarray(off + 8, off + 8 + len);
    if (type === 0x4e4f534a) json = JSON.parse(chunk.toString('utf8')); else if (type === 0x004e4942) bin = chunk;
    off += 8 + len;
  }
  return { json, bin };
}

// how each accessor is used, so float vertex data can be filtered by meaning
function usage(json) {
  const u = new Map();
  const mark = (i, kind) => { if (i !== undefined && !u.has(i)) u.set(i, kind); };
  for (const m of json.meshes || []) for (const p of m.primitives) {
    if (p.indices !== undefined) mark(p.indices, (p.mode ?? 4) === 4 ? 'tri' : 'idx');
    for (const [k, a] of Object.entries(p.attributes)) mark(a, k);
    for (const t of p.targets || []) for (const [k, a] of Object.entries(t)) mark(a, 'target_' + k);
  }
  for (const s of json.skins || []) mark(s.inverseBindMatrices, 'ibm');
  for (const a of json.animations || []) for (const s of a.samplers) { mark(s.input, 'anim'); mark(s.output, 'anim'); }
  return u;
}

function expFilter(kind) {
  if (kind === 'POSITION') return [18, 'SharedComponent'];
  if (kind === 'NORMAL' || kind === 'TANGENT') return [16, 'SharedVector'];
  if (kind.startsWith('TEXCOORD')) return [18, 'SharedComponent'];
  if (kind === 'target_POSITION' || kind === 'target_NORMAL' || kind === 'target_TANGENT') return [16, 'Separate'];
  return null;   // weights, colours, custom attributes, matrices and animation stay exact
}

let before = 0, after = 0;
for (const file of fs.globSync(`${D}/models/**/*.glb`)) {
  const { json, bin } = readGLB(file);
  const dir = path.dirname(file), base = path.basename(file, '.glb');
  before += fs.statSync(file).size;

  // 1. images out to files
  const dropViews = new Set();
  (json.images || []).forEach((im, i) => {
    if (im.bufferView === undefined) return;
    const bv = json.bufferViews[im.bufferView], bytes = bin.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength);
    const png = im.mimeType === 'image/png';
    const name = `${base}_${i}`;
    fs.writeFileSync(path.join(dir, `${name}.${png ? 'png' : 'jpg'}`), bytes);
    dropViews.add(im.bufferView);
    delete im.bufferView;
    im.uri = `${name}.${png ? 'webp' : 'jpg'}`; im.mimeType = png ? 'image/webp' : 'image/jpeg';
  });

  // 2. which bufferViews can be meshopt-compressed: one accessor at offset 0 covering the view
  const u = usage(json);
  const viewAcc = new Map();
  (json.accessors || []).forEach((a, i) => {
    if (a.bufferView === undefined) return;
    if (!viewAcc.has(a.bufferView)) viewAcc.set(a.bufferView, []);
    viewAcc.get(a.bufferView).push(i);
  });

  const parts = [], fallback = { len: 0 };
  let out = 0;
  const push = (buf) => { const o = out; parts.push(buf); const pad = align(buf.length) - buf.length; if (pad) parts.push(Buffer.alloc(pad)); out += align(buf.length); return o; };
  json.bufferViews.forEach((bv, vi) => {
    if (dropViews.has(vi)) return;
    const src = bin.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength);
    const accs = viewAcc.get(vi) || [];
    const a = accs.length === 1 ? json.accessors[accs[0]] : null;
    let mode = null, stride = 0, count = 0, filter = 'NONE', data = null;
    if (a && !(a.byteOffset > 0) && !a.sparse) {
      const kind = u.get(accs[0]) || '';
      const elem = COMP[a.componentType] * NC[a.type];
      stride = bv.byteStride || elem; count = a.count;
      if (kind === 'tri' && (stride === 2 || stride === 4) && count % 3 === 0 && count * stride === bv.byteLength) mode = 'TRIANGLES';
      else if ((kind === 'tri' || kind === 'idx') && (stride === 2 || stride === 4) && count * stride === bv.byteLength) mode = 'INDICES';
      else if (kind !== 'tri' && kind !== 'idx' && stride % 4 === 0 && stride <= 256 && count * stride === bv.byteLength) {
        mode = 'ATTRIBUTES';
        const f = a.componentType === 5126 && !a.normalized ? expFilter(kind) : null;
        if (f) { data = MeshoptEncoder.encodeFilterExp(new Uint8Array(src), count, stride, f[0], f[1]); filter = 'EXPONENTIAL'; }
      }
    }
    if (!mode) {   // left as is
      bv.byteOffset = push(Buffer.from(src)); bv.buffer = 0;
      return;
    }
    const enc = MeshoptEncoder.encodeGltfBuffer(data || new Uint8Array(src), count, stride, mode);
    const ext = { buffer: 0, byteOffset: push(Buffer.from(enc)), byteLength: enc.length, byteStride: stride, count, mode };
    if (filter !== 'NONE') ext.filter = filter;
    bv.buffer = 1; bv.byteOffset = fallback.len; fallback.len = align(fallback.len + bv.byteLength, 16);
    bv.extensions = { ...(bv.extensions || {}), EXT_meshopt_compression: ext };
  });
  // drop the image views and renumber
  const remap = new Map(); const views = [];
  json.bufferViews.forEach((bv, i) => { if (!dropViews.has(i)) { remap.set(i, views.length); views.push(bv); } });
  json.bufferViews = views;
  for (const a of json.accessors || []) if (a.bufferView !== undefined) a.bufferView = remap.get(a.bufferView);
  for (const im of json.images || []) if (im.bufferView !== undefined) im.bufferView = remap.get(im.bufferView);

  const packed = Buffer.concat(parts);
  json.buffers = [{ byteLength: packed.length, uri: 'data:application/octet-stream;base64,' + packed.toString('base64') }];
  if (fallback.len) {
    json.buffers.push({ byteLength: fallback.len, extensions: { EXT_meshopt_compression: { fallback: true } } });
    for (const k of ['extensionsUsed', 'extensionsRequired']) json[k] = [...new Set([...(json[k] || []), 'EXT_meshopt_compression'])];
  }
  const outFile = path.join(dir, base + '.json');
  fs.writeFileSync(outFile, JSON.stringify(json));
  fs.rmSync(file);
  after += fs.statSync(outFile).size;
  console.log(path.relative(D, outFile), (bin.length / 1e6).toFixed(2), '->', (packed.length / 1e6).toFixed(2), 'MB geometry',
    (json.images || []).length ? `+ ${json.images.length} images` : '');
}
console.log(`models: ${(before / 1e6).toFixed(1)} MB of GLB -> ${(after / 1e6).toFixed(1)} MB of glTF JSON (images now separate files)`);
