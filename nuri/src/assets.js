// Asset loading: Blender-baked PBR texture sets, GLB models, the CC0 forest HDRI, and material setup.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import { patchMaterial, makeRockMaterial } from './shaders.js';

const BASE = './';

export class Assets {
  constructor(renderer, tier, onProgress) {
    this.renderer = renderer; this.tier = tier; this.onProgress = onProgress || (() => {});
    this.tex = {}; this.models = {}; this.mats = {};
    this.total = 0; this.done = 0;
    this.maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  }
  step(label) { this.done++; this.onProgress(this.done / Math.max(1, this.total), label); }

  suffix(size) { return size >= 2048 ? '' : '_1024'; }

  async loadImage(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('missing ' + url);
    const blob = await res.blob();
    return await createImageBitmap(blob, { imageOrientation: 'flipY' });
  }

  async texture(url, srgb, repeat = true) {
    const bmp = await this.loadImage(url);
    const t = new THREE.Texture(bmp);
    t.flipY = false; // already flipped by createImageBitmap
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
    t.anisotropy = this.maxAniso; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
    t.needsUpdate = true;
    return t;
  }

  async set(name, { alpha = false, size = this.tier.texSize, fixed = false } = {}) {
    const suf = fixed ? '' : this.suffix(size);
    const ext = alpha ? 'png' : 'jpg';
    const [map, normal, orm] = await Promise.all([
      this.texture(`${BASE}tex/${name}${suf}_albedo.${ext}`, true),
      this.texture(`${BASE}tex/${name}${suf}_normal.${ext}`, false),
      this.texture(`${BASE}tex/${name}${suf}_orm.jpg`, false),
    ]);
    this.step(name);
    return { map, normal, orm };
  }

  // decode several images of identical size into a single DataArrayTexture (1 sampler per channel set on mobile)
  async arrayTexture(urls, srgb) {
    const bmps = await Promise.all(urls.map((u) => this.loadImage(u)));
    const w = bmps[0].width, h = bmps[0].height;
    const data = new Uint8Array(w * h * 4 * bmps.length);
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d', { willReadFrequently: true });
    bmps.forEach((b, i) => {
      g.clearRect(0, 0, w, h); g.drawImage(b, 0, 0, w, h);
      data.set(g.getImageData(0, 0, w, h).data, i * w * h * 4);
      b.close?.();
    });
    const t = new THREE.DataArrayTexture(data, w, h, bmps.length);
    t.format = THREE.RGBAFormat; t.type = THREE.UnsignedByteType;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
    t.anisotropy = this.maxAniso;
    t.needsUpdate = true;
    return t;
  }

  async gltf(name) {
    const loader = this.gltfLoader || (this.gltfLoader = new GLTFLoader());
    const g = await loader.loadAsync(`${BASE}models/${name}.glb`);
    this.models[name] = g; this.step(name);
    return g;
  }

  async loadAll() {
    const T = this.tex, tier = this.tier;
    const layers = ['forest_floor', 'dirt_path', 'riverbed', 'moss'];
    const suf = this.suffix(tier.texSize);
    const models = ['nuri', 'rock_0', 'rock_1', 'rock_2', 'rock_3', 'rock_4', 'outcrop', 'log_bridge', 'log_hollow', 'log_small',
      'stump_0', 'stump_1', 'stump_2', 'stump_3', 'mushroom_0', 'mushroom_1', 'mushroom_2'];
    for (let i = 0; i < 6; i++) models.push(`tree_${i}`, `tree_${i}_lod1`);
    this.total = 6 + 3 + models.length + 1;
    // terrain arrays
    const [alb, nrm, orm] = await Promise.all([
      this.arrayTexture(layers.map((l) => `${BASE}tex/${l}${suf}_albedo.jpg`), true),
      this.arrayTexture(layers.map((l) => `${BASE}tex/${l}${suf}_normal.jpg`), false),
      this.arrayTexture(layers.map((l) => `${BASE}tex/${l}${suf}_orm.jpg`), false),
    ]);
    T.terrainAlb = alb; T.terrainNrm = nrm; T.terrainOrm = orm; this.step('terrain'); this.step(''); this.step('');
    const [rock, moss, bark, leaves, fern, floor] = await Promise.all([
      this.set('rock'), this.set('moss'), this.set('bark'), this.set('leaf_atlas', { alpha: true }),
      this.set('fern', { alpha: true, fixed: true }), this.set('forest_floor'),
    ]);
    Object.assign(T, { rock, moss, bark, leaves, fern, floor });
    T.water = makeWaterNormal();
    // HDRI (Poly Haven "forest", CC0, via @pmndrs/assets) for image-based lighting
    const exr = await new EXRLoader().setDataType(THREE.HalfFloatType).loadAsync(`${BASE}hdri/forest.exr`);
    exr.mapping = THREE.EquirectangularReflectionMapping;
    const pm = new THREE.PMREMGenerator(this.renderer);
    T.envMap = pm.fromEquirectangular(exr).texture; exr.dispose(); pm.dispose();
    this.step('hdri');
    await Promise.all(models.map((m) => this.gltf(m)));
    this.buildMaterials();
  }

  buildMaterials() {
    const T = this.tex, M = this.mats;
    M.bark = patchMaterial(new THREE.MeshStandardMaterial({ map: T.bark.map, normalMap: T.bark.normal, roughnessMap: T.bark.orm, aoMap: T.bark.orm,
      vertexColors: true, roughness: 1, metalness: 0, normalScale: new THREE.Vector2(1.4, 1.4), envMapIntensity: 0.5 }), { ao: 1 });
    M.wood = patchMaterial(new THREE.MeshStandardMaterial({ map: T.bark.map, color: 0xc9a07a, normalMap: T.bark.normal, roughness: 0.85,
      vertexColors: true, metalness: 0, envMapIntensity: 0.4 }), { ao: 1 });
    M.leaves = patchMaterial(new THREE.MeshStandardMaterial({ map: T.leaves.map, normalMap: T.leaves.normal, alphaTest: 0.42, side: THREE.DoubleSide,
      roughness: 0.75, metalness: 0, envMapIntensity: 0.45, emissive: new THREE.Color(0x0b1404), emissiveIntensity: 1 }), {
      ao: false, wind: 'transformed += windOffset(wp0.xyz, 0.06 * smoothstep(3.0, 12.0, wp0.y), wp0.x * 0.3);' });
    M.fern = patchMaterial(new THREE.MeshStandardMaterial({ map: T.fern.map, normalMap: T.fern.normal, alphaTest: 0.45, side: THREE.DoubleSide,
      roughness: 0.7, metalness: 0, envMapIntensity: 0.5, emissive: new THREE.Color(0x081004), emissiveIntensity: 1 }), {
      ao: false, wind: 'transformed += windOffset(wp0.xyz, 0.04 * uv.y, wp0.z);' });
    M.rock = makeRockMaterial(T, { moss: 0.6 });
    M.rockOutcrop = makeRockMaterial(T, { moss: 0.5, scale: 0.3 });
    M.mushCap = patchMaterial(new THREE.MeshPhysicalMaterial({ color: 0xa8592c, roughness: 0.45, clearcoat: 0.3, sheen: 0.4, vertexColors: false }), { ao: false });
    M.mushStem = new THREE.MeshStandardMaterial({ color: 0xe8dcc2, roughness: 0.7 });
  }
}

// tileable water ripple normal map (sum of integer-frequency waves => seamless)
function makeWaterNormal(size = 256) {
  const h = new Float32Array(size * size);
  const waves = [];
  let s = 7;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let k = 0; k < 24; k++) {
    const fx = Math.round((r() - 0.5) * 16), fy = Math.round((r() - 0.5) * 16);
    if (!fx && !fy) continue;
    waves.push([fx, fy, r() * 6.28, 1 / Math.hypot(fx, fy) ** 1.2]);
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let v = 0;
    for (const [fx, fy, ph, a] of waves) v += a * Math.sin((fx * x + fy * y) / size * Math.PI * 2 + ph);
    h[y * size + x] = v;
  }
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const gx = h[y * size + ((x + 1) % size)] - h[y * size + ((x - 1 + size) % size)];
    const gy = h[((y + 1) % size) * size + x] - h[((y - 1 + size) % size) * size + x];
    const n = new THREE.Vector3(-gx * 2.2, -gy * 2.2, 1).normalize();
    const o = (y * size + x) * 4;
    data[o] = (n.x * 0.5 + 0.5) * 255; data[o + 1] = (n.y * 0.5 + 0.5) * 255; data[o + 2] = (n.z * 0.5 + 0.5) * 255; data[o + 3] = 255;
  }
  const t = new THREE.DataTexture(data, size, size);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.needsUpdate = true;
  return t;
}
