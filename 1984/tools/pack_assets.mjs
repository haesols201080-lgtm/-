// Packs assets/models/*.glb and assets/textures/* into assets.js so the game
// also runs straight from the file system (file://), where fetch() is blocked.
import fs from 'node:fs';
import path from 'node:path';
const root = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const out = { m: {}, t: {} };
const mdir = path.join(root, 'assets/models');
for (const f of fs.readdirSync(mdir).sort()) {
  if (f.endsWith('.glb')) out.m[f.slice(0, -4)] = fs.readFileSync(path.join(mdir, f)).toString('base64');
}
const tdir = path.join(root, 'assets/textures');
for (const f of fs.readdirSync(tdir).sort()) {
  const ext = path.extname(f).slice(1);
  const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
  out.t[f.replace(/\.(jpg|png)$/, '')] = `data:${mime};base64,` + fs.readFileSync(path.join(tdir, f)).toString('base64');
}
fs.writeFileSync(path.join(root, 'assets.js'), 'window.__ASSETS__=' + JSON.stringify(out) + ';\n');
const mb = fs.statSync(path.join(root, 'assets.js')).size / 1048576;
console.log(`assets.js: ${Object.keys(out.m).length} models, ${Object.keys(out.t).length} textures, ${mb.toFixed(1)} MB`);
