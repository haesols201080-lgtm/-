// Prints nodes, materials, animations and the bounding box of GLB models.
//   node tools/inspect_glb.mjs victory_mansions telescreen_wall
import fs from 'node:fs';
import path from 'node:path';
const root = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const names = process.argv.slice(2);
const list = names.length ? names : fs.readdirSync(path.join(root, 'assets/models')).map((f) => f.replace('.glb', ''));
for (const n of list) {
  const b = fs.readFileSync(path.join(root, 'assets/models', n + '.glb'));
  const len = b.readUInt32LE(12);
  const j = JSON.parse(b.slice(20, 20 + len).toString());
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  const nodeInfo = (j.nodes || []).map((nd) => {
    let s = nd.name || '?';
    if (nd.translation) s += ` t=[${nd.translation.map((v) => v.toFixed(2))}]`;
    if (nd.scale) s += ` s=[${nd.scale.map((v) => v.toFixed(2))}]`;
    if (nd.mesh != null) {
      const m = j.meshes[nd.mesh];
      for (const p of m.primitives) {
        const a = j.accessors[p.attributes.POSITION];
        const t = nd.translation || [0, 0, 0];
        const sc = nd.scale || [1, 1, 1];
        for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], a.min[k] * sc[k] + t[k]); mx[k] = Math.max(mx[k], a.max[k] * sc[k] + t[k]); }
      }
      s += ` mesh(${m.primitives.length} prims)`;
    }
    return s;
  });
  console.log(`\n== ${n}  bounds x[${mn[0].toFixed(2)}, ${mx[0].toFixed(2)}] y[${mn[1].toFixed(2)}, ${mx[1].toFixed(2)}] z[${mn[2].toFixed(2)}, ${mx[2].toFixed(2)}]`);
  console.log('  nodes:', nodeInfo.join(' | '));
  console.log('  materials:', (j.materials || []).map((m) => m.name).join(', '));
  if (j.animations) console.log('  animations:', j.animations.map((a) => a.name).join(', '));
}
