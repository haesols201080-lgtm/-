// Splits the models too big for a static host's per-file limit (Cloudflare Pages: 25 MiB) into 20 MiB parts, byte
// for byte (nothing re-encoded: the game joins them back into the same file, src/assets.js), and records which
// models are split in src/split_models.json. The original .glb is removed from public/ (its parts replace it).
// usage: node tools/split_models.mjs [path/to/model.glb ...]   (default: every .glb over 24 MiB in public/models)
// Run it again after a model is rebuilt: copy the new .glb into public/models/... first.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const MODELS = path.join(ROOT, 'public', 'models');
const PART = 20 * 1024 * 1024, LIMIT = 24 * 1024 * 1024;
const MANIFEST = path.join(ROOT, 'src', 'split_models.json');

const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const args = process.argv.slice(2).map((p) => path.resolve(p));
const files = args.length ? args : walk(MODELS).filter((f) => f.endsWith('.glb') && fs.statSync(f).size > LIMIT);
const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : {};

for (const f of files) {
  const key = path.relative(MODELS, f).replace(/\\/g, '/').replace(/\.glb$/, '');
  const buf = fs.readFileSync(f), n = Math.ceil(buf.length / PART);
  // (old parts of this model, if it had more before)
  for (const old of fs.readdirSync(path.dirname(f))) if (old.startsWith(path.basename(f) + '.part')) fs.unlinkSync(path.join(path.dirname(f), old));
  for (let i = 0; i < n; i++) fs.writeFileSync(`${f}.part${i}`, buf.subarray(i * PART, Math.min(buf.length, (i + 1) * PART)));
  fs.unlinkSync(f);
  manifest[key] = { parts: n, bytes: buf.length };
  console.log(`${key}: ${(buf.length / 1048576).toFixed(1)} MiB in ${n} parts`);
}
fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
