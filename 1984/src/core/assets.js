// Loads the Blender-made GLB models and baked textures, either from the
// bundled assets.js (works from file://) or from the assets/ folder.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const texLoader = new THREE.TextureLoader();
const models = new Map();
const textures = new Map();

function b64ToBuffer(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

export const MODEL_NAMES = [
  'victory_mansions', 'party_block_a', 'party_block_b', 'party_block_c', 'inner_block', 'prole_terrace',
  'prole_terrace_b', 'prole_ruin', 'shop', 'pub', 'minitrue', 'pyramid_far', 'fence_wire', 'guard_tower',
  'mg_nest', 'monument', 'church', 'station', 'community_centre', 'cafe', 'telescreen_wall', 'telescreen_pole',
  'lamp_post', 'bench', 'bin', 'poster', 'sandbags', 'rubble_pile', 'truck', 'van', 'helicopter', 'train', 'bed',
  'bed_old', 'table', 'gateleg', 'chair', 'armchair', 'cubicle', 'canteen_table', 'diary', 'paperweight',
  'engraving', 'gin', 'oil_stove', 'shelf', 'cage', 'rack', 'cell_bench', 'chess', 'bulb', 'sink', 'cupboard',
  'briefcase', 'tin', 'chair_row', 'chestnut', 'elm', 'hazel', 'dead_tree', 'gate', 'hedge',
  'char_party_man', 'char_party_man_b', 'char_party_woman', 'char_winston', 'char_julia', 'char_obrien',
  'char_syme', 'char_parsons', 'char_thought_police', 'char_prole_man', 'char_prole_woman', 'char_charrington',
  'char_child', 'char_guard',
];

const TEX_SETS = ['concrete_white', 'concrete_grey', 'brick', 'plaster', 'slate', 'asphalt', 'paving', 'cobble',
  'wood', 'board', 'wallpaper', 'tile_white', 'metal', 'grass', 'dirt', 'rubble', 'bark', 'bark_moss', 'fabric'];
const TEX_SINGLE = ['leaves', 'leaves_n', 'leaves_elm', 'leaves_elm_n', 'grass_blade'];

export async function loadAll(onProgress) {
  const packed = window.__ASSETS__;
  const texNames = [];
  for (const s of TEX_SETS) texNames.push(s + '_c', s + '_n', s + '_r');
  texNames.push(...TEX_SINGLE);
  const total = texNames.length + MODEL_NAMES.length;
  let done = 0;
  const tick = () => onProgress && onProgress(++done / total);

  await Promise.all(texNames.map(async (n) => {
    const src = packed ? packed.t[n] : `assets/textures/${n}.${n.startsWith('leaves') && !n.endsWith('_n') || n === 'grass_blade' ? 'png' : 'jpg'}`;
    if (!src) { tick(); return; }
    const t = await texLoader.loadAsync(src);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    textures.set(n, t);
    tick();
  }));

  // parse sequentially in small batches so the loading bar moves
  for (const n of MODEL_NAMES) {
    let gltf;
    if (packed && packed.m[n]) {
      gltf = await loader.parseAsync(b64ToBuffer(packed.m[n]), '');
    } else {
      gltf = await loader.loadAsync(`assets/models_opt/${n}.glb`);
    }
    models.set(n, gltf);
    tick();
  }
}

export function tex(name) { return textures.get(name); }

export function gltf(name) { return models.get(name); }

// Plain clone shares geometry and materials; skinned models need SkeletonUtils.
export function instance(name) {
  const g = models.get(name);
  if (!g) throw new Error('missing model ' + name);
  return name.startsWith('char_') ? SkeletonUtils.clone(g.scene) : g.scene.clone(true);
}

export function animations(name) { return models.get(name).animations; }
