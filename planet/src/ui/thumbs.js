// Renders building models to small images for the build menu and hotbar.
import * as THREE from 'three';
import { getModel } from '../build/models.js';
import { assetMaterial } from '../build/materials.js';

export class Thumbs {
  constructor(game) {
    this.game = game;
    this.cache = new Map();
    this.size = 192;
    this.rt = null;
    this.scene = new THREE.Scene();
    const key = new THREE.DirectionalLight(0xfff4e6, 3.2);
    key.position.set(-6, 10, -8);
    const fill = new THREE.DirectionalLight(0x9fc4ff, 1.2);
    fill.position.set(8, 4, 6);
    this.scene.add(key, fill, new THREE.AmbientLight(0x606870, 1.4));
    this.cam = new THREE.PerspectiveCamera(30, 1.25, 0.1, 2000);
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.size * 1.25; this.canvas.height = this.size;
  }

  get(key) {
    if (key === 'house') key = 'house:0';
    if (this.cache.has(key)) return this.cache.get(key);
    let url = '';
    try { url = this.render(key); } catch (e) { console.warn('thumb', key, e); }
    this.cache.set(key, url);
    return url;
  }

  render(key) {
    const g = this.game;
    const r = g.engine.renderer;
    const W = Math.round(this.size * 1.25), H = this.size;
    if (!this.rt) this.rt = new THREE.WebGLRenderTarget(W, H, { samples: 4, type: THREE.UnsignedByteType, colorSpace: THREE.SRGBColorSpace });
    const model = getModel(key);
    const grp = new THREE.Group();
    const box = new THREE.Box3();
    for (const p of model.parts) {
      if (p.key === 'beam') continue;
      const m = new THREE.Mesh(p.geo, p.material ? assetMaterial(p.material) : (g.buildings.mats[p.key] || g.buildings.mats.hull));
      grp.add(m);
      p.geo.computeBoundingBox();
      box.union(p.geo.boundingBox);
    }
    box.min.y = Math.max(box.min.y, key === 'algae' ? -1.4 : -0.3);
    if (key === 'elevator') box.max.y = 30;
    this.scene.add(grp);
    this.scene.environment = g.engine.scene.environment;
    const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
    const rad = Math.max(s.x, s.z) * 0.62 + s.y * 0.45;
    const dir = new THREE.Vector3(-0.85, 0.62, -1).normalize();
    this.cam.position.copy(c).addScaledVector(dir, rad / Math.tan(THREE.MathUtils.degToRad(15)) * 0.62);
    this.cam.lookAt(c);
    this.cam.updateMatrixWorld();
    const prevTM = r.toneMapping;
    const prevClip = r.clippingPlanes;
    r.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, 1, 0), key === 'algae' ? 1.4 : 0.3)];
    r.setRenderTarget(this.rt);
    r.setClearColor(0x000000, 0);
    r.clear();
    r.render(this.scene, this.cam);
    const px = new Uint8Array(W * H * 4);
    r.readRenderTargetPixels(this.rt, 0, 0, W, H, px);
    r.setRenderTarget(null);
    r.toneMapping = prevTM;
    r.clippingPlanes = prevClip;
    this.scene.remove(grp);
    const ctx = this.canvas.getContext('2d');
    const img = ctx.createImageData(W, H);
    for (let y = 0; y < H; y++) {
      const src = (H - 1 - y) * W * 4;
      for (let x = 0; x < W * 4; x += 4) {
        // simple filmic-ish curve on the linear render
        for (let k = 0; k < 3; k++) {
          const v = px[src + x + k] / 255;
          img.data[y * W * 4 + x + k] = Math.min(255, Math.pow(v / (v + 0.18) * 1.18, 0.9) * 255);
        }
        img.data[y * W * 4 + x + 3] = px[src + x + 3];
      }
    }
    ctx.putImageData(img, 0, 0);
    return this.canvas.toDataURL('image/png');
  }
}
