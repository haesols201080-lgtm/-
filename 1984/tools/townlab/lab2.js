// Town look-dev 2: a small generated district from a test plan.
import * as THREE from 'three';
import { createGame } from '../../src/game/game.js';
import { loadAll } from '../../src/core/assets.js';
import { buildLibrary } from '../../src/core/materials.js';
import { buildPlan } from '../../src/world/town/streets.js';
import { buildTown } from '../../src/world/town/index.js';
import { GroundMap } from '../../src/world/city_ground.js';
import { rng } from '../../src/world/city_util.js';

(async () => {
const G = createGame(document.getElementById('game'));
window.G = G;
await loadAll();
buildLibrary();
const root = new THREE.Group();
const t0 = performance.now();
const plan = buildPlan({
  bounds: [-160, -160, 160, 160],
  streets: [
    { id: 'high', pts: [[-170, 20], [-80, 10], [0, 18], [80, 4], [170, -10]], w: 9, pave: 3, kind: 'main', district: 'slum' },
    { id: 'a', pts: [[-60, 170], [-50, 80], [-40, 14]], w: 6, pave: 2, kind: 'street', district: 'slum' },
    { id: 'b', pts: [[20, 16], [30, -60], [26, -170]], w: 6.5, pave: 2.2, kind: 'street', district: 'bloomsbury' },
    { id: 'c', pts: [[-170, -70], [-60, -80], [28, -70]], w: 7, pave: 2.5, kind: 'street', district: 'bloomsbury' },
    { id: 'd', pts: [[60, 170], [70, 90], [55, 8]], w: 5, pave: 1.6, kind: 'lane', district: 'slum' },
    { id: 'e', pts: [[-50, 90], [70, 95]], w: 5, pave: 1.5, kind: 'lane', district: 'slum' },
    { id: 'f', pts: [[30, -110], [170, -100]], w: 7, pave: 2.4, kind: 'street', district: 'inner' },
  ],
  squares: [],
});
plan.districtAt = () => 'slum';
const map = new GroundMap(-160, -160, 160, 160, 0.5);
const town = buildTown(G, root, plan, map, { r: rng(3), roadKind: (x, z) => (z > 30 ? 'setts' : 'asphalt') });
for (const [cx, cz, hx, hz, rot] of town.colliders) G.col.add(cx, cz, hx, hz, rot);
console.log('town', town.tris, 'tris', town.meshes.length, 'meshes', (performance.now() - t0).toFixed(0), 'ms', plan.blocks.length, 'blocks');
G.addLocation({ id: 'city', root, exterior: true, ground: (x, z) => map.height(x, z), spawns: { a: { x: 0, z: 18, yaw: 0 } } });
G.enter('city', 'a');
const q = new URLSearchParams(location.search);
G.renderer.setup(G.scene, G.camera, q.get('q') || 'medium');
G.start();
window.ready = true;
})();
