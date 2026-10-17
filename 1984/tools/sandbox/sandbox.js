// Look-dev sandbox: core renderer, sky and materials on a few buildings,
// without the gameplay modules. Bundled to tools/sandbox/out.js.
import * as THREE from 'three';
import { createGame } from '../../src/game/game.js';
import { loadAll } from '../../src/core/assets.js';
import { buildLibrary } from '../../src/core/materials.js';

(async () => {
const G = createGame(document.getElementById('game'));
window.G = G;
await loadAll();
buildLibrary();
const root = new THREE.Group();
const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), G.mats.get('concrete_grey'));
const tex = G.assets.tex('asphalt_c');
const asphalt = new THREE.MeshStandardMaterial({ map: G.assets.tex('asphalt_c'), normalMap: G.assets.tex('asphalt_n'), roughnessMap: G.assets.tex('asphalt_r') });
const uv = new THREE.PlaneGeometry(400, 400); uv.rotateX(-Math.PI / 2);
const a = uv.attributes.uv; const p = uv.attributes.position;
for (let i = 0; i < a.count; i++) a.setXY(i, p.getX(i) / 3, p.getZ(i) / 3);
const g = new THREE.Mesh(uv, G.mats.get('asphalt')); g.receiveShadow = true; root.add(g);
function put(name, x, z, ry = 0) { const o = G.assets.instance(name); G.mats.apply(o); o.position.set(x, 0, z); o.rotation.y = ry; root.add(o); return o; }
put('victory_mansions', -25, 0, Math.PI / 2);
put('party_block_a', 23, 0, -Math.PI / 2);
put('prole_terrace', 0, -45, 0);
put('prole_ruin', 30, -45, 0);
put('lamp_post', -12, 10, Math.PI / 2);
put('telescreen_pole', 12, 20, -Math.PI / 2);
put('monument', 0, -140, 0);
put('minitrue', 0, -380, 0);
for (let i = 0; i < 6; i++) { const c = put(['char_party_man', 'char_party_woman', 'char_julia', 'char_thought_police', 'char_prole_man', 'char_obrien'][i], -3 + i * 1.2, 4, 0); const mx = new THREE.AnimationMixer(c); const clip = G.assets.animations(['char_party_man', 'char_party_woman', 'char_julia', 'char_thought_police', 'char_prole_man', 'char_obrien'][i]).find((k) => k.name === (i % 2 ? 'idle' : 'walk')); mx.clipAction(clip).play(); mx.update(0.3 * i); G.onUpdate((dt) => mx.update(dt)); }
G.addLocation({ id: 'city', root, exterior: true, spawns: { a: { x: 0, z: 12, yaw: 0 } } });
G.enter('city', 'a');
const q = new URLSearchParams(location.search);
G.renderer.setup(G.scene, G.camera, q.get('q') || 'medium');
G.start();
window.ready = true;
})();
