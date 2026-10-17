// Town look-dev: a test street of generated buildings, without gameplay.
import * as THREE from 'three';
import { createGame } from '../../src/game/game.js';
import { loadAll } from '../../src/core/assets.js';
import { buildLibrary } from '../../src/core/materials.js';
import { Kit, Frame } from '../../src/world/town/kit.js';
import { house } from '../../src/world/town/house.js';
import { resolve } from '../../src/world/town/styles.js';
import { townMaterials } from '../../src/world/town/mats.js';
import { signAtlas, SHOPS, PUBS } from '../../src/world/town/signs.js';
import { rng } from '../../src/world/city_util.js';

(async () => {
const G = createGame(document.getElementById('game'));
window.G = G;
await loadAll();
buildLibrary();
const root = new THREE.Group();
const K = new Kit();
const r = rng(5);
const atlas = signAtlas();
// street: carriageway z 0..10 (centre z = 5), pavements 2.5 m each side
const ROW = [
  ['georgian', 5], ['shop', 2], ['pub', 1], ['cottage', 7], ['victorian', 4], ['office', 1], ['shell', 0], ['stucco', 4], ['tenement', 1], ['warehouse', 1], ['interwar', 1],
];
function row(F0, sideSeed) {
  const rr = rng(sideSeed);
  let x = 0;
  for (const [type, n] of ROW) {
    if (type === 'shell') { x += 9; continue; }
    const st = resolve(type, rr, { decay: type === 'cottage' ? 0.7 : 0.35 });
    const w = st.w[0] + rr() * (st.w[1] - st.w[0]);
    const d = st.d[0] + rr() * (st.d[1] - st.d[0]);
    for (let i = 0; i < n; i++) {
      const F = F0.sub(x, 0, 0);
      if (type === 'shop') st.sign = atlas.rect(SHOPS[Math.floor(rr() * SHOPS.length)]);
      if (type === 'pub') st.sign = atlas.rect(PUBS[Math.floor(rr() * PUBS.length)]);
      st.doorPaint = [[0.16, 0.2, 0.17], [0.12, 0.12, 0.12], [0.3, 0.12, 0.1], [0.2, 0.22, 0.3]][Math.floor(rr() * 4)];
      const first = i === 0, last = i === n - 1;
      house(K, { F, w, d, left: first ? 'open' : 'party', right: last ? 'open' : 'party', stackR: last, leftBombed: first && rr() < 0.5, leftShore: first, rightShore: last }, st, rr);
      x += w;
    }
    x += 0.0;
  }
  return x;
}
// north side faces south (+z): frame at z = -2.5, rot 0
const len = row(new Frame(-60, 0.12, -2.5, 0), 11);
// south side faces north: frame at the far end so local x still runs left to right
row(new Frame(-60 + len, 0.12, 12.5, Math.PI), 12);
const mats = townMaterials(G);
K.build(root, mats);
console.log('town tris', K.tris);
// ground: asphalt road, raised paving
const plane = (mat, x0, z0, x1, z1, y, tile) => {
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0); g.rotateX(-Math.PI / 2); g.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
  const uv = g.attributes.uv, p = g.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / tile, -p.getZ(i) / tile);
  const m = new THREE.Mesh(g, G.mats.get(mat)); m.receiveShadow = true; root.add(m);
};
plane('asphalt', -80, -2.5, 260, 12.5, 0, 6);
plane('paving', -80, -40, 260, -2.5 + 2.5, 0.12, 3);
plane('paving', -80, 10, 260, 40, 0.12, 3);
G.addLocation({ id: 'city', root, exterior: true, spawns: { a: { x: 0, z: 6, yaw: 0 } } });
G.enter('city', 'a');
const q = new URLSearchParams(location.search);
G.renderer.setup(G.scene, G.camera, q.get('q') || 'medium');
G.start();
window.ready = true;
})();
