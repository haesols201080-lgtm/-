// Asset loading: Poly Haven (CC0) scanned texture sets + scanned models processed in Blender, Blender-built conifers,
// the robot, and the forest_slope HDRI used for image-based lighting and the distant background.
import * as THREE from 'three';
import HOUSE_LM from './house_lm.json';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { patchMaterial, makeRockMaterial, leafLight, nearFade, barkMoss } from './shaders.js';

const BASE = './';
// the artifact build (tools/artifact_assets.py) ships PNG colour maps as WebP
const PNG = import.meta.env.PROD ? 'webp' : 'png';

// Some hosts' content-security policy blocks fetch() of data: and blob: URLs. GLTFLoader decodes embedded images
// through ImageBitmapLoader, which fetches a blob: URL; load those through an <img> element instead (allowed by img-src).
{
  const orig = THREE.ImageBitmapLoader.prototype.load;
  THREE.ImageBitmapLoader.prototype.load = function (url, onLoad, onProgress, onError) {
    if (typeof url !== 'string' || !(url.startsWith('blob:') || url.startsWith('data:'))) return orig.call(this, url, onLoad, onProgress, onError);
    const scope = this; scope.manager.itemStart(url);
    const img = new Image();
    img.onload = () => {
      createImageBitmap(img, Object.assign({}, scope.options || {}))
        .then((bmp) => { onLoad && onLoad(bmp); scope.manager.itemEnd(url); })
        .catch((e) => { onError && onError(e); scope.manager.itemError(url); scope.manager.itemEnd(url); });
    };
    img.onerror = (e) => { onError && onError(e); scope.manager.itemError(url); scope.manager.itemEnd(url); };
    img.src = url;
    return img;
  };
}

// Robust fetch for large static assets: at most 6 requests in flight, each retried with backoff,
// so one dropped connection on a slow or throttling host does not abort the whole load.
let inFlight = 0; const waiting = [];
async function slot() { if (inFlight < 6) { inFlight++; return; } await new Promise((r) => waiting.push(r)); inFlight++; }
function release() { inFlight--; const n = waiting.shift(); if (n) n(); }
export async function fetchRetry(url, tries = 5) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    await slot();
    try {
      const res = await fetch(url, { cache: i ? 'reload' : 'default' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      return blob;
    } catch (e) { lastErr = e; }
    finally { release(); }
    await new Promise((r) => setTimeout(r, 400 * 2 ** i));
  }
  throw new Error(`파일을 받지 못했어요 (${url.replace(/^\.\//, '')}): ${lastErr?.message || lastErr}`);
}

// glTF JSON whose buffer is a base64 data URI -> in-memory GLB (decoded here, so no fetch of the data: URI is needed)
function base64ToBytes(b64) {
  const bin = atob(b64), out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function jsonToGLB(json) {
  let bin = new Uint8Array(0);
  const b = json.buffers && json.buffers[0];
  if (b && typeof b.uri === 'string' && b.uri.startsWith('data:')) { bin = base64ToBytes(b.uri.slice(b.uri.indexOf(',') + 1)); delete b.uri; }
  const enc = new TextEncoder();
  let js = enc.encode(JSON.stringify(json));
  const jsPad = (4 - (js.length % 4)) % 4, binPad = (4 - (bin.length % 4)) % 4;
  const total = 12 + 8 + js.length + jsPad + (bin.length ? 8 + bin.length + binPad : 0);
  const out = new Uint8Array(total), dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546c67, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true);
  dv.setUint32(12, js.length + jsPad, true); dv.setUint32(16, 0x4e4f534a, true);
  out.set(js, 20); out.fill(0x20, 20 + js.length, 20 + js.length + jsPad);
  if (bin.length) {
    const o = 20 + js.length + jsPad;
    dv.setUint32(o, bin.length + binPad, true); dv.setUint32(o + 4, 0x004e4942, true); out.set(bin, o + 8);
  }
  return out.buffer;
}
export const TERRAIN_LAYERS = ['ph_floor', 'ph_path', 'ph_riverbed', 'ph_mud'];
export const TERRAIN_SCALES = [1 / 1.5, 1 / 1.67, 1 / 2.9, 1 / 1.3]; // metres covered by each scanned set
export const PROP_TEX = ['rock_face_03', 'mossy_rock', 'weathered_planks', 'wood_planks_grey', 'rusty_metal_04', 'green_metal_rust', 'metal_plate', 'rusty_metal_02'];
export const PH_MODELS = [ 'rock_09', 'stone_01', 'rock_face_01', 'rock_face_02',
  'tree_stump_01', 'tree_stump_02', 'dead_tree_trunk', 'dead_tree_trunk_02', 'root_cluster_02', 'single_root', 'fern_02',
  'shrub_03', 'shrub_04', 'nettle_plant', 'dandelion_01', 'weed_plant_02', 'dry_branches_medium_01', 'periwinkle_plant',
  'bark_debris_01', 'namaqualand_stones_01', 'root_cluster_01',
  // understory: grasses, wildflowers, wood sorrel, low shrubs, young conifers
  'grass_medium_01', 'grass_medium_02', 'celandine_01', 'shrub_01', 'shrub_02', 'shrub_sorrel_01', 'flower_heliophila',
  'flower_empodium', 'flower_stinkkruid', 'leipoldtia_schultzei', 'flower_ursinia', 'pine_sapling_small', 'fir_sapling'];
export const DEBRIS = ['pinecone_0', 'pinecone_1', 'pinecone_2', 'mush_amanita', 'mush_bolete', 'mush_cluster', 'mush_bracket'];
export const TREES = ['pine_0', 'pine_1', 'pine_2', 'pine_3', 'fir_4', 'fir_5', 'pine_11', 'pine_12', 'pine_13', 'fir_14', 'fir_15'];
export const SAPLINGS = []; // (the Blender saplings read as stacked card tiers; scanned saplings are used instead)
export const SNAGS = ['snag_9', 'snag_10'];
// chapter 2: the stranger's flat (Poly Haven scans, processed by blender/process_house_models.py)
export const HOUSE_MODELS = ['house_arch', 'wicker_basket_02', 'cat'];   // (the modelled house carries its own furniture)
// outside the house and along the road: chapter 1's conifers (their light versions) and two scanned grasses
export const HOUSE_TREES = ['pine_0', 'pine_2', 'fir_4', 'fir_14'];
export const PROPS = ['crate', 'fence_picket', 'fence_rail', 'gate_pillar', 'gate_leaf', 'plate_sf_base', 'plate_sf_top', 'lift_deck', 'lift_head', 'lift_counter', 'ibeam', 'socket', 'cell', 'shard', 'booster', 'ball'];

export class Assets {
  constructor(renderer, tier, onProgress) {
    this.renderer = renderer; this.tier = tier; this.onProgress = onProgress || (() => {});
    this.tex = {}; this.models = {}; this.mats = {};
    this.total = 1; this.done = 0;
    this.maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  }
  step(label) { this.done++; this.onProgress(Math.min(1, this.done / Math.max(1, this.total)), label); }
  suffix(size) { return size >= 2048 ? '' : '_1024'; }

  async loadImage(url) {
    const blob = await fetchRetry(url);
    // keep the image's top row at v=0 (glTF convention) so atlases line up with glTF/Blender UVs
    return await createImageBitmap(blob, { imageOrientation: 'none' });
  }
  async texture(url, srgb) {
    const t = new THREE.Texture(await this.loadImage(url));
    t.flipY = false; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = this.maxAniso;
    t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.needsUpdate = true;
    return t;
  }
  // props are exported without images: their scanned texture sets are shared here by material name
  async propTextures() {
    const used = new Map();
    for (const [k, g] of Object.entries(this.models)) if (k.startsWith('prop_')) g.scene.traverse((o) => {
      if (!o.isMesh) return; for (const m of [o.material].flat()) { const id = (m.name || '').split('.')[0]; if (PROP_TEX.includes(id)) { if (!used.has(id)) used.set(id, []); used.get(id).push(m); } } });
    await Promise.all([...used].map(async ([id, mats]) => {
      const t = await this.set('pr_' + id, { size: 2048 });
      for (const m of mats) { m.map = t.map; m.normalMap = t.normal; m.roughnessMap = m.metalnessMap = t.orm; m.roughness = 1; m.metalness = 1; m.color.set(0xffffff); m.needsUpdate = true; }
    }));
  }
  async set(name, { alpha = false, size = this.tier.texSize } = {}) {
    const suf = this.suffix(size);
    const [map, normal, orm] = await Promise.all([
      this.texture(`${BASE}tex/${name}${suf}_albedo.${alpha ? PNG : 'jpg'}`, true),
      this.texture(`${BASE}tex/${name}${suf}_normal.jpg`, false),
      this.texture(`${BASE}tex/${name}${suf}_orm.jpg`, false),
    ]);
    this.step(name);
    return { map, normal, orm };
  }
  async arrayTexture(urls, srgb) {
    const bmps = await Promise.all(urls.map((u) => this.loadImage(u)));
    const w = bmps[0].width, h = bmps[0].height;
    const data = new Uint8Array(w * h * 4 * bmps.length);
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d', { willReadFrequently: true });
    bmps.forEach((b, i) => { g.clearRect(0, 0, w, h); g.drawImage(b, 0, 0, w, h); data.set(g.getImageData(0, 0, w, h).data, i * w * h * 4); b.close?.(); });
    const t = new THREE.DataArrayTexture(data, w, h, bmps.length);
    t.format = THREE.RGBAFormat; t.type = THREE.UnsignedByteType; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
    t.anisotropy = this.maxAniso; t.needsUpdate = true;
    return t;
  }
  // HDR stored as two PNGs (RGBE mantissas + exponent), decoded to a half-float equirect texture
  async loadRGBEPair(base) {
    const [rgb, ex] = await Promise.all([this.loadImage(base + '_rgb.png'), this.loadImage(base + '_e.png')]);
    const w = rgb.width, h = rgb.height;
    const px = (bmp) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(bmp, 0, 0); return g.getImageData(0, 0, w, h).data; };
    const a = px(rgb), e = px(ex);
    const out = new Uint16Array(w * h * 4), toH = THREE.DataUtils.toHalfFloat;
    for (let i = 0; i < w * h; i++) {
      const E = e[i * 4], f = E ? Math.pow(2, E - 136) : 0;
      out[i * 4] = toH((a[i * 4] + 0.5) * f); out[i * 4 + 1] = toH((a[i * 4 + 1] + 0.5) * f); out[i * 4 + 2] = toH((a[i * 4 + 2] + 0.5) * f); out[i * 4 + 3] = toH(1);
    }
    const t = new THREE.DataTexture(out, w, h, THREE.RGBAFormat, THREE.HalfFloatType);
    t.flipY = true; t.colorSpace = THREE.LinearSRGBColorSpace; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
    t.needsUpdate = true;
    return t;
  }

  async gltf(path, key) {
    const loader = this.gltfLoader || (this.gltfLoader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder));
    // production builds ship glTF JSON (.json) because the artifact host doesn't serve .glb: meshopt-compressed
    // geometry in a base64 buffer, and the images as their own files next to it (tools/pack_models.mjs)
    let g;
    if (import.meta.env.PROD) {
      const json = JSON.parse(await (await fetchRetry(`${BASE}models/${path}.json`)).text());
      const dir = `${BASE}models/${path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : ''}`;
      const urls = await Promise.all((json.images || []).map(async (im) => {
        if (!im.uri || im.uri.startsWith('data:')) return null;
        im.uri = URL.createObjectURL(await fetchRetry(dir + im.uri));
        return im.uri;
      }));
      try { g = await loader.parseAsync(jsonToGLB(json), ''); }
      finally { for (const u of urls) if (u) URL.revokeObjectURL(u); }
    } else g = await loader.loadAsync(`${BASE}models/${path}.glb`);
    this.models[key || path] = g; this.step(key || path);
    return g;
  }

  async loadAll() {
    const T = this.tex, tier = this.tier, suf = this.suffix(tier.texSize);
    const modelJobs = [['nuri'], ['outcrop'], ['log_hollow'],
      ...PH_MODELS.map((m) => [`ph/${m}`, m]), ...DEBRIS.map((m) => [`debris/${m}`, m]), ...TREES.flatMap((t) => [[`trees/${t}`, t], [`trees/${t}_lod1`, t + '_lod1']]), ...SAPLINGS.map((t) => [`trees/${t}`, t]), ...SNAGS.flatMap((t) => [[`trees/${t}`, t], [`trees/${t}_lod1`, t + '_lod1']]), ...['boulder_01', 'rock_moss_set_01', 'rock_moss_set_02', 'rock_07', 'rock_09'].map((k) => [`rocks2/${k}`, 'rk_' + k]), ['creatures/squirrel', 'squirrel'], ['creatures/robin', 'robin'], ...PROPS.map((m) => [`props/${m}`, 'prop_' + m]), ...['toto', 'bori', 'mina'].map((m) => [`companions/${m}`, 'comp_' + m]),
      ...['pocket_watch', 'seadogs_compass', 'rubber_duck_toy', 'can_rusted', 'garden_gloves_01', 'digital_wrist_watch', 'baseball_01', 'measuring_tape_01', 'screwdriver', 'Camera_01'].map((m) => [`relics/${m}`, 'relic_' + m])];
    this.total = 3 + 6 + 1 + modelJobs.length + 8;
    const [alb, nrm, orm] = await Promise.all([
      this.arrayTexture(TERRAIN_LAYERS.map((l) => `${BASE}tex/${l}${suf}_albedo.jpg`), true),
      this.arrayTexture(TERRAIN_LAYERS.map((l) => `${BASE}tex/${l}${suf}_normal.jpg`), false),
      this.arrayTexture(TERRAIN_LAYERS.map((l) => `${BASE}tex/${l}${suf}_orm.jpg`), false),
    ]);
    T.terrainAlb = alb; T.terrainNrm = nrm; T.terrainOrm = orm; this.step('지면'); this.step(''); this.step('');
    const [rock, moss, bark, twig, grass] = await Promise.all([
      this.set('ph_rock'), this.set('ph_mossrock'), this.set('ph_bark'), this.set('ph_twig', { alpha: true, size: 2048 }),
      this.set('ph_grass', { alpha: true, size: 1024 }),
    ]);
    const lichen = null;
    Object.assign(T, { rock, moss, bark, twig, grass, lichen });
    // moss tile modelled in Blender (blender/build_moss.py): albedo + height in alpha, and its normal map
    const [mossMap, mossNrm] = await Promise.all([this.texture(`${BASE}tex/moss_tile_albedo.${PNG}`, true), this.texture(`${BASE}tex/moss_tile_normal.${PNG}`, false)]);
    T.mossTile = { map: mossMap, normal: mossNrm };
    T.water = makeWaterNormal();
    // HDRI: Poly Haven "forest_slope" (CC0)
    const hname = `${BASE}hdri/forest_slope_${tier.texSize >= 2048 ? '2k' : '1k'}`;
    const hdr = import.meta.env.PROD ? await this.loadRGBEPair(hname) : await new HDRLoader().setDataType(THREE.HalfFloatType).loadAsync(`${hname}.hdr`);
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    T.hdr = hdr;
    const pm = new THREE.PMREMGenerator(this.renderer);
    T.envMap = pm.fromEquirectangular(hdr).texture; pm.dispose();
    this.step('하늘');
    // load models with limited parallelism (mobile memory)
    const queue = modelJobs.slice();
    const worker = async () => { while (queue.length) { const [p, k] = queue.shift(); await this.gltf(p, k); } };
    await Promise.all([worker(), worker(), worker(), worker()]);
    await this.propTextures();
    this.buildMaterials();
  }

  // chapter 2 (the stranger's flat in the city): only the robot, the flat's scanned furniture and fabrics, and a night
  // city HDRI (Poly Haven "rooftop_night", CC0) for the view and the reflections
  async loadHouse() {
    const T = this.tex, tier = this.tier;
    this.total = HOUSE_MODELS.length + HOUSE_TREES.length + 2 + 1 + 13 + 2 + 10;
    const [floor, wall, tile, linen, rug, seat, denim, brick, roof, siding, lawn, asphalt, pavement, bark, twig] = await Promise.all([
      this.set('hs_floor'), this.set('hs_wall'), this.set('hs_tile', { size: 1024 }), this.set('hs_linen', { size: 1024 }),
      this.set('hs_rug', { size: 1024 }), this.set('hs_seat', { size: 1024 }), this.set('hs_denim', { size: 1024 }), this.set('hs_brick', { size: 1024 }),
      this.set('hs_roof', { size: 1024 }), this.set('hs_siding', { size: 1024 }), this.set('hs_lawn', { size: 1024 }),
      this.set('hs_asphalt', { size: 1024 }), this.set('hs_pavement', { size: 1024 }),
      this.set('ph_bark', { size: 1024 }), this.set('ph_twig', { alpha: true, size: 2048 }),
    ]);
    Object.assign(T, { floor, wall, tile, linen, rug, seat, denim, brick, roof, siding, lawn, asphalt, pavement, bark, twig });
    // the modelled house's own scanned sets (painted plaster, worn oak, linoleum, marble, subway tile, stained oak,
    // veneer, jacquard, carpet, stucco), and all of them by their names for its materials (src/house_mats.json)
    const more = ['hs_paint', 'hs_oak', 'hs_lino', 'hs_marble', 'hs_subway', 'hs_stain', 'hs_veneer', 'hs_jacquard', 'hs_carpet', 'hs_stucco'];
    const got = await Promise.all(more.map((n) => this.set(n, { size: 1024 })));
    T.sets = { hs_floor: floor, hs_wall: wall, hs_tile: tile, hs_linen: linen, hs_rug: rug, hs_seat: seat, hs_denim: denim, hs_brick: brick, hs_roof: roof,
      hs_siding: siding, hs_lawn: lawn, hs_asphalt: asphalt, hs_pavement: pavement };
    more.forEach((n, i) => { T.sets[n] = got[i]; });
    // the house's baked night light (blender/build_house.py --bake; tools/lightmap_pack.py), when one is shipped
    // (src/house_lm.json says so: none is, for now, so nothing is asked of the server)
    const lm = async (n) => { if (!HOUSE_LM.baked) return null; try { const t = await this.texture(`${BASE}tex/${n}.webp`, true); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.channel = 1; return t; } catch (e) { return null; } };
    [T.lmInt, T.lmExt] = await Promise.all([lm('lm_int'), lm('lm_ext')]);
    // skies: the night city (Poly Haven "rooftop_night") for the house, and the forest's daylight sky for the start of the drive
    const hdri = async (name) => {
      const h = import.meta.env.PROD ? await this.loadRGBEPair(`${BASE}hdri/${name}`) : await new HDRLoader().setDataType(THREE.HalfFloatType).loadAsync(`${BASE}hdri/${name}.hdr`);
      h.mapping = THREE.EquirectangularReflectionMapping; return h;
    };
    const [hdr, day] = await Promise.all([hdri(`rooftop_night_${tier.texSize >= 2048 ? '2k' : '1k'}`), hdri('forest_slope_1k')]);
    T.hdr = hdr; T.hdrDay = day;
    const pm = new THREE.PMREMGenerator(this.renderer); T.envMap = pm.fromEquirectangular(hdr).texture; T.envDay = pm.fromEquirectangular(day).texture; pm.dispose();
    this.step('도시의 밤');
    const queue = [['nuri'], ...HOUSE_MODELS.map((m) => [`house/${m}`, 'h_' + m]), ...HOUSE_TREES.map((t) => [`trees/${t}_lod1`, 't_' + t]),
      ['ph/grass_medium_01', 'g_grass_01'], ['ph/grass_medium_02', 'g_grass_02']];
    const worker = async () => { while (queue.length) { const [p, k] = queue.shift(); await this.gltf(p, k); } };
    await Promise.all([worker(), worker(), worker(), worker()]);
    for (const [k, g] of Object.entries(this.models)) if (k.startsWith('h_') || k.startsWith('g_')) g.scene.traverse((o) => {
      if (!o.isMesh) return; o.castShadow = true; o.receiveShadow = true;
      for (const m of [o.material].flat()) {
        if (/glass/i.test(m.name)) { m.transparent = true; m.opacity = 0.22; m.depthWrite = false; m.roughness = 0.05; m.alphaTest = 0; o.castShadow = false; }
        else if (/flame/i.test(m.name)) o.visible = false;                        // (the candles are not lit tonight)
        else if (m.alphaTest > 0 || m.transparent) { m.transparent = false; m.alphaTest = 0.45; m.side = THREE.DoubleSide; }
        m.envMapIntensity = 0.9;
      }
    });
    // conifers: the scanned bark and the fir needle atlas (the same as in the forest, without the forest's shader tricks)
    const M = this.mats;
    M.hBark = new THREE.MeshStandardMaterial({ map: bark.map, normalMap: bark.normal, roughnessMap: bark.orm, vertexColors: true, color: new THREE.Color(1.15, 1.15, 1.15), roughness: 1, metalness: 0 });
    M.hTwig = new THREE.MeshStandardMaterial({ map: twig.map, normalMap: twig.normal, alphaTest: 0.4, side: THREE.DoubleSide, color: new THREE.Color(0.5, 0.58, 0.42), roughness: 0.85, metalness: 0, envMapIntensity: 0.5 });
  }

  buildMaterials() {
    const T = this.tex, M = this.mats;
    // tree bark: vertex colour = bark tint by position on the tree (dark grey-brown plates low on pines, thin orange
    // bark higher up, grey dead branches) x partial baked AO; the colour boost lets the tint warm the scan up
    M.bark = barkMoss(new THREE.MeshStandardMaterial({ map: T.bark.map, normalMap: T.bark.normal, roughnessMap: T.bark.orm, aoMap: T.bark.orm,
      vertexColors: true, color: new THREE.Color(1.25, 1.25, 1.25), roughness: 1, metalness: 0, normalScale: new THREE.Vector2(1.6, 1.6), envMapIntensity: 0.7 }), T.moss);
    M.barkLog = new THREE.MeshStandardMaterial({ map: T.bark.map, normalMap: T.bark.normal, roughnessMap: T.bark.orm, aoMap: T.bark.orm,
      vertexColors: true, roughness: 1, metalness: 0, normalScale: new THREE.Vector2(1.3, 1.3), envMapIntensity: 0.7 });
    M.barkPlain = barkMoss(new THREE.MeshStandardMaterial({ map: T.bark.map, normalMap: T.bark.normal, roughnessMap: T.bark.orm, aoMap: T.bark.orm,
      vertexColors: true, color: new THREE.Color(1.25, 1.25, 1.25), roughness: 1, metalness: 0, normalScale: new THREE.Vector2(1.6, 1.6), envMapIntensity: 0.7 }), T.moss);
    M.barkSnag = new THREE.MeshStandardMaterial({ map: T.bark.map, normalMap: T.bark.normal, roughnessMap: T.bark.orm, aoMap: T.bark.orm,
      vertexColors: true, color: new THREE.Color(1.15, 1.1, 1.05), roughness: 1, metalness: 0, normalScale: new THREE.Vector2(1.5, 1.5), envMapIntensity: 0.7 });
    M.barkSnagPlain = new THREE.MeshStandardMaterial({ map: T.bark.map, normalMap: T.bark.normal, vertexColors: true, color: new THREE.Color(1.15, 1.1, 1.05), roughness: 1, metalness: 0 });
    M.twig = patchMaterial(new THREE.MeshStandardMaterial({ map: T.twig.map, normalMap: T.twig.normal, alphaTest: 0.38, side: THREE.DoubleSide,
      roughness: 0.82, metalness: 0, envMapIntensity: 0.55 }), {
      ao: false,
      wind: 'transformed += windOffset(wp0.xyz, 0.05 * smoothstep(0.5, 14.0, wp0.y) + 0.012, wp0.x * 0.3 + wp0.z * 0.2);',
      extraFrag: (sh) => {
        nearFade(sh);
        sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>',
          THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', '/* foliage keeps crown-shaped normals on both sides */'));
        // needles: sunlight through the sprays when looking toward the sun, sky light from behind
        leafLight(sh, 1.5);
      } });
    M.grass = patchMaterial(new THREE.MeshStandardMaterial({ map: T.grass.map, normalMap: T.grass.normal, alphaTest: 0.42, side: THREE.DoubleSide,
      color: new THREE.Color(0.82, 0.92, 0.66), roughness: 0.9, metalness: 0, envMapIntensity: 0.25 }), {
      ao: false,
      wind: `float flex = uv.y;
             transformed += windOffset(wp0.xyz, 0.03 * flex, wp0.x * 2.1 + wp0.z * 1.3);
             vec3 toP = wp0.xyz - uPlayer; float pd = length(toP.xz);
             float push = smoothstep(0.35, 0.05, pd) * flex;
             transformed.xz += normalize(toP.xz + 1e-4) * push * 0.1; transformed.y -= push * 0.05;` });
    M.rock = makeRockMaterial({ rock: T.rock, moss: T.moss }, { moss: 0.55, scale: 1 / 2.7 });
    M.rockOutcrop = makeRockMaterial({ rock: T.rock, moss: T.moss }, { moss: 0.28, scale: 1 / 2.7 });   // living moss is the shell layer on top
    // tune scanned GLB materials for the scene lighting
    for (const g of Object.values(this.models)) {
      g.scene.traverse((o) => {
        if (!o.isMesh || !o.material || o.material.userData.tuned) return;
        const m = o.material; m.userData.tuned = true;
        m.envMapIntensity = 0.8;
        if (m.alphaTest > 0 || m.transparent) {
          m.transparent = false; m.alphaTest = 0.45; m.side = THREE.DoubleSide;
          // leaves are matte: no glossy sky sheen that turns blades and fronds whitish
          m.envMapIntensity = 0.35; m.roughness = Math.max(m.roughness, 0.85);
        }
      });
    }
  }
}

function makeWaterNormal(size = 256) {
  const h = new Float32Array(size * size), waves = [];
  let s = 7; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let k = 0; k < 24; k++) {
    const fx = Math.round((r() - 0.5) * 16), fy = Math.round((r() - 0.5) * 16);
    if (!fx && !fy) continue; waves.push([fx, fy, r() * 6.28, 1 / Math.hypot(fx, fy) ** 1.2]);
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let v = 0; for (const [fx, fy, ph, a] of waves) v += a * Math.sin((fx * x + fy * y) / size * Math.PI * 2 + ph); h[y * size + x] = v;
  }
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const gx = h[y * size + ((x + 1) % size)] - h[y * size + ((x - 1 + size) % size)];
    const gy = h[((y + 1) % size) * size + x] - h[((y - 1 + size) % size) * size + x];
    const n = new THREE.Vector3(-gx * 2.2, -gy * 2.2, 1).normalize(), o = (y * size + x) * 4;
    data[o] = (n.x * 0.5 + 0.5) * 255; data[o + 1] = (n.y * 0.5 + 0.5) * 255; data[o + 2] = (n.z * 0.5 + 0.5) * 255; data[o + 3] = 255;
  }
  const t = new THREE.DataTexture(data, size, size);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.needsUpdate = true;
  return t;
}
