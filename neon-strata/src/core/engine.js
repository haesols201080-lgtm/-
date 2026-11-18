// Renderer, camera, environment probe and frame orchestration.
import * as THREE from 'three';
import { U, env, createSky, createNoiseTexture } from '../render/env.js';
import { PostFX } from '../render/post.js';
import { bakeMaterials } from '../render/materials.js';
import { MATU } from '../render/cityMaterial.js';

export class Engine {
  constructor(canvas, quality) {
    this.q = quality; this.canvas = canvas;
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false, alpha: false, reversedDepthBuffer: true });
    if (!r.capabilities.isWebGL2) throw new Error('WebGL2 가 필요합니다');
    r.outputColorSpace = THREE.LinearSRGBColorSpace; // final pass does its own grading / gamma
    r.toneMapping = THREE.NoToneMapping;
    r.autoClear = false; r.info.autoReset = false;
    r.setClearColor(0x000000, 1);
    r.shadowMap.enabled = !!quality.shadows; r.shadowMap.type = THREE.PCFShadowMap;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.4, quality.far);
    this.camera.position.set(0, 30, 120);
    U.uNoiseTex.value = createNoiseTexture(256);
    this.sky = createSky(); this.scene.add(this.sky);
    // software GL (headless verification) is extremely slow with anisotropic array sampling
    const dbgInfo = r.getContext().getExtension('WEBGL_debug_renderer_info');
    this.software = /SwiftShader|llvmpipe|Software/i.test(dbgInfo ? r.getContext().getParameter(dbgInfo.UNMASKED_RENDERER_WEBGL) : '');
    const baked = bakeMaterials(r, quality.name === 'low' ? 256 : 512, this.software ? 1 : 8); MATU.uMatA.value = baked.A; MATU.uMatB.value = baked.B;

    // key light (sun / moon). Direction + colour are driven by env each frame.
    this.sun = new THREE.DirectionalLight(0xffffff, 1);
    this.scene.add(this.sun); this.scene.add(this.sun.target);
    if (quality.shadows) {
      const s = this.sun.shadow; this.sun.castShadow = true;
      const ms = quality.shadowMap || 2048; s.mapSize.set(ms, ms); s.camera.near = 10; s.camera.far = 3000; s.bias = -0.00025; s.normalBias = 0.35;
      const e = this.shadowExt = quality.shadowExt || 200; s.camera.left = -e; s.camera.right = e; s.camera.top = e; s.camera.bottom = -e;
    }

    this._size(); // sets pixel ratio before post targets are created
    this.post = new PostFX(r, quality);

    // environment probe → PMREM (image based lighting that follows the player)
    this.probeOn = !!quality.probe;
    const ps = quality.probeSize;
    this.cubeRT = new THREE.WebGLCubeRenderTarget(ps, { type: THREE.HalfFloatType, generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    this.cubeCam = new THREE.CubeCamera(2, 9000, this.cubeRT);
    this.cubeCam.layers.set(0);
    this.pmrem = new THREE.PMREMGenerator(r);
    this.pmremRT = null; this.probeFace = 0; this.probeTimer = 0; this.probeDirty = true;
    this.frame = 0; this.time = 0;
    this.onResize = () => { this._size(); this.post.resize(); };
    window.addEventListener('resize', this.onResize);
  }

  _size() {
    const q = this.q, w = window.innerWidth, h = window.innerHeight;
    let pr = Math.min(window.devicePixelRatio || 1, 2) * q.pixelRatio;
    if (q.pixelRatio >= 1) pr = Math.min(window.devicePixelRatio || 1, q.pixelRatio);
    const px = w * h * pr * pr;
    if (px > q.maxPixels) pr *= Math.sqrt(q.maxPixels / px);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  // full probe refresh (6 faces + prefilter) — used at load and after teleports
  refreshProbe() {
    const r = this.renderer;
    this.cubeCam.position.copy(this.camera.position);
    const sv = this.sky.visible;
    this.sky.position.copy(this.cubeCam.position); this.sky.updateMatrix();
    this.cubeCam.update(r, this.scene);
    this._prefilter();
    this.sky.visible = sv;
  }
  _prefilter() {
    const rt = this.pmrem.fromCubemap(this.cubeRT.texture, this.pmremRT);
    this.pmremRT = rt;
    this.scene.environment = rt.texture;
  }
  // amortised update: one cube face per call, prefilter once per cycle
  _stepProbe() {
    const r = this.renderer, cc = this.cubeCam;
    if (this.probeFace === 0) { cc.position.copy(this.camera.position); cc.updateMatrixWorld(true); }
    const cam = cc.children[this.probeFace];
    this.sky.position.copy(cc.position); this.sky.updateMatrix();
    const prevRT = r.getRenderTarget();
    r.setRenderTarget(this.cubeRT, this.probeFace); r.clear();
    r.render(this.scene, cam);
    r.setRenderTarget(prevRT);
    this.probeFace++;
    if (this.probeFace >= 6) { this.probeFace = 0; this._prefilter(); }
  }

  render(dt) {
    const cam = this.camera, r = this.renderer;
    this.frame++; this.time += dt;
    r.info.reset();
    // key light follows camera
    const sd = U.uSunDir.value, sc = U.uSunColor.value;
    this.sun.color.setRGB(sc.r, sc.g, sc.b); this.sun.intensity = 1;
    // the sun's shadow box follows the camera (a little ahead of it), snapped to whole shadow texels so the edges
    // do not crawl as you move; high above the city it opens up to cover the skyline
    const sh = !!this.q.shadows && sd.y > 0.04; this.sun.castShadow = sh;
    if (sh) { const s = this.sun.shadow, high = cam.position.y > 500; const e = high ? 1300 : this.shadowExt;
      if (s.camera.right !== e) { s.camera.left = -e; s.camera.right = e; s.camera.top = e; s.camera.bottom = -e; s.camera.far = high ? 6000 : 3000; s.camera.updateProjectionMatrix(); }
      const fw = this._fw || (this._fw = new THREE.Vector3()); cam.getWorldDirection(fw); fw.y = 0; if (fw.lengthSq() > 1e-6) fw.normalize();
      const c = this._sc || (this._sc = new THREE.Vector3()); c.copy(cam.position).addScaledVector(fw, high ? 0 : e * 0.45); c.y = high ? cam.position.y * 0.3 : 0;
      const up = Math.abs(sd.y) > 0.99 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0); const rgt = this._r || (this._r = new THREE.Vector3()); rgt.crossVectors(up, sd).normalize(); const u2 = this._u || (this._u = new THREE.Vector3()); u2.crossVectors(sd, rgt).normalize();
      const tx = (2 * e) / s.mapSize.x; const a = Math.round(c.dot(rgt) / tx) * tx - c.dot(rgt), b = Math.round(c.dot(u2) / tx) * tx - c.dot(u2); c.addScaledVector(rgt, a).addScaledVector(u2, b);
      this.sun.target.position.copy(c); this.sun.position.copy(c).addScaledVector(sd, 1500); }
    else { this.sun.target.position.copy(cam.position); this.sun.position.copy(cam.position).addScaledVector(sd, 1300); }

    if (this.probeOn && !this.probeHold) {
      const every = this.q.name === 'medium' ? 3 : 1;
      if (this.frame % every === 0) this._stepProbe();
    }
    this.sky.position.copy(cam.position); this.sky.updateMatrix();
    cam.updateMatrixWorld();
    this.post.render(this.scene, cam, dt);
  }
}
