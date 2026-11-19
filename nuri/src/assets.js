// Asset loading: Poly Haven (CC0) scanned texture sets + scanned models processed in Blender, Blender-built conifers,
// the robot, and the forest_slope HDRI used for image-based lighting and the distant background.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { patchMaterial, makeRockMaterial } from './shaders.js';

const BASE = './';
export const TERRAIN_LAYERS = ['ph_floor', 'ph_path', 'ph_riverbed', 'ph_mud'];
export const TERRAIN_SCALES = [1 / 1.5, 1 / 3.15, 1 / 2.9, 1 / 1.3]; // metres covered by each scanned set
export const PH_MODELS = ['rock_moss_set_01', 'rock_moss_set_02', 'boulder_01', 'rock_07', 'rock_09', 'stone_01', 'rock_face_01', 'rock_face_02',
  'tree_stump_01', 'tree_stump_02', 'dead_tree_trunk', 'dead_tree_trunk_02', 'pine_roots', 'root_cluster_02', 'single_root', 'fern_02', 'moss_01',
  'shrub_03', 'shrub_04', 'nettle_plant', 'dandelion_01', 'weed_plant_02', 'dry_branches_medium_01', 'periwinkle_plant'];
export const TREES = ['pine_0', 'pine_1', 'pine_2', 'pine_3', 'fir_4', 'fir_5'];
export const SAPLINGS = ['sapling_6', 'sapling_7', 'sapling_8'];

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
    const res = await fetch(url);
    if (!res.ok) throw new Error('missing ' + url);
    // keep the image's top row at v=0 (glTF convention) so atlases line up with glTF/Blender UVs
    return await createImageBitmap(await res.blob(), { imageOrientation: 'none' });
  }
  async texture(url, srgb) {
    const t = new THREE.Texture(await this.loadImage(url));
    t.flipY = false; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = this.maxAniso;
    t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.needsUpdate = true;
    return t;
  }
  async set(name, { alpha = false, size = this.tier.texSize } = {}) {
    const suf = this.suffix(size);
    const [map, normal, orm] = await Promise.all([
      this.texture(`${BASE}tex/${name}${suf}_albedo.${alpha ? 'png' : 'jpg'}`, true),
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
  async gltf(path, key) {
    const loader = this.gltfLoader || (this.gltfLoader = new GLTFLoader());
    const g = await loader.loadAsync(`${BASE}models/${path}.glb`);
    this.models[key || path] = g; this.step(key || path);
    return g;
  }

  async loadAll() {
    const T = this.tex, tier = this.tier, suf = this.suffix(tier.texSize);
    const modelJobs = [['nuri'], ['outcrop'], ['log_hollow'],
      ...PH_MODELS.map((m) => [`ph/${m}`, m]), ...TREES.flatMap((t) => [[`trees/${t}`, t], [`trees/${t}_lod1`, t + '_lod1']]), ...SAPLINGS.map((t) => [`trees/${t}`, t])];
    this.total = 3 + 6 + 1 + modelJobs.length;
    const [alb, nrm, orm] = await Promise.all([
      this.arrayTexture(TERRAIN_LAYERS.map((l) => `${BASE}tex/${l}${suf}_albedo.jpg`), true),
      this.arrayTexture(TERRAIN_LAYERS.map((l) => `${BASE}tex/${l}${suf}_normal.jpg`), false),
      this.arrayTexture(TERRAIN_LAYERS.map((l) => `${BASE}tex/${l}${suf}_orm.jpg`), false),
    ]);
    T.terrainAlb = alb; T.terrainNrm = nrm; T.terrainOrm = orm; this.step('지면'); this.step(''); this.step('');
    const [rock, moss, bark, twig, grass, lichen] = await Promise.all([
      this.set('ph_rock'), this.set('ph_mossrock'), this.set('ph_bark'), this.set('ph_twig', { alpha: true, size: Math.min(2048, tier.texSize) }),
      this.set('ph_grass', { alpha: true, size: 1024 }), this.set('ph_lichen'),
    ]);
    Object.assign(T, { rock, moss, bark, twig, grass, lichen });
    T.water = makeWaterNormal();
    // HDRI: Poly Haven "forest_slope" (CC0)
    const hdr = await new HDRLoader().setDataType(THREE.HalfFloatType).loadAsync(`${BASE}hdri/forest_slope_${tier.texSize >= 2048 ? '2k' : '1k'}.hdr`);
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    T.hdr = hdr;
    const pm = new THREE.PMREMGenerator(this.renderer);
    T.envMap = pm.fromEquirectangular(hdr).texture; pm.dispose();
    this.step('하늘');
    // load models with limited parallelism (mobile memory)
    const queue = modelJobs.slice();
    const worker = async () => { while (queue.length) { const [p, k] = queue.shift(); await this.gltf(p, k); } };
    await Promise.all([worker(), worker(), worker(), worker()]);
    this.buildMaterials();
  }

  buildMaterials() {
    const T = this.tex, M = this.mats;
    M.bark = patchMaterial(new THREE.MeshStandardMaterial({ map: T.bark.map, normalMap: T.bark.normal, roughnessMap: T.bark.orm, aoMap: T.bark.orm,
      vertexColors: true, roughness: 1, metalness: 0, normalScale: new THREE.Vector2(1.3, 1.3), envMapIntensity: 0.7 }), { ao: 1 });
    // LOD1 trees and saplings carry no baked-AO vertex colors
    M.barkPlain = new THREE.MeshStandardMaterial({ map: T.bark.map, normalMap: T.bark.normal, roughnessMap: T.bark.orm, aoMap: T.bark.orm,
      roughness: 1, metalness: 0, normalScale: new THREE.Vector2(1.3, 1.3), envMapIntensity: 0.7 });
    M.twig = patchMaterial(new THREE.MeshStandardMaterial({ map: T.twig.map, normalMap: T.twig.normal, alphaTest: 0.38, side: THREE.DoubleSide,
      roughness: 0.82, metalness: 0, envMapIntensity: 0.55 }), {
      ao: false,
      wind: 'transformed += windOffset(wp0.xyz, 0.05 * smoothstep(0.5, 14.0, wp0.y) + 0.012, wp0.x * 0.3 + wp0.z * 0.2);',
      extraFrag: (sh) => {
        // foliage translucency: light passing through needles when back-lit, plus a soft canopy self-shadow tint
        sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `
          vec3 vd = normalize(vViewPosition);
          float back = pow(clamp(dot(vd, normalize((viewMatrix * vec4(0.58, 0.64, 0.51, 0.0)).xyz)), 0.0, 1.0), 4.0);
          outgoingLight += diffuseColor.rgb * vec3(0.55, 0.65, 0.25) * back * 0.9;
          #include <opaque_fragment>`);
      } });
    M.grass = patchMaterial(new THREE.MeshStandardMaterial({ map: T.grass.map, normalMap: T.grass.normal, alphaTest: 0.42, side: THREE.DoubleSide,
      roughness: 0.75, metalness: 0, envMapIntensity: 0.5 }), {
      ao: false,
      wind: `float flex = uv.y;
             transformed += windOffset(wp0.xyz, 0.03 * flex, wp0.x * 2.1 + wp0.z * 1.3);
             vec3 toP = wp0.xyz - uPlayer; float pd = length(toP.xz);
             float push = smoothstep(0.35, 0.05, pd) * flex;
             transformed.xz += normalize(toP.xz + 1e-4) * push * 0.1; transformed.y -= push * 0.05;` });
    M.rock = makeRockMaterial({ rock: T.rock, moss: T.moss }, { moss: 0.55, scale: 1 / 2.7 });
    M.rockOutcrop = makeRockMaterial({ rock: T.rock, moss: T.moss }, { moss: 0.65, scale: 1 / 2.7 });
    // tune scanned GLB materials for the scene lighting
    for (const g of Object.values(this.models)) {
      g.scene.traverse((o) => {
        if (!o.isMesh || !o.material || o.material.userData.tuned) return;
        const m = o.material; m.userData.tuned = true;
        m.envMapIntensity = 0.8;
        if (m.alphaTest > 0 || m.transparent) { m.transparent = false; m.alphaTest = 0.45; m.side = THREE.DoubleSide; }
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
