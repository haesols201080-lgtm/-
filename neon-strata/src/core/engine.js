// Renderer, camera, environment probe and frame orchestration.
import * as THREE from 'three';
import { U, env, createSky, createNoiseTexture } from '../render/env.js';
import { PostFX } from '../render/post.js';

export class Engine {
  constructor(canvas, quality) {
    this.q = quality; this.canvas = canvas;
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false, alpha: false });
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

    // key light (sun / moon). Direction + colour are driven by env each frame.
    this.sun = new THREE.DirectionalLight(0xffffff, 1);
    this.scene.add(this.sun); this.scene.add(this.sun.target);
    if (quality.shadows) {
      const s = this.sun.shadow; this.sun.castShadow = true;
      s.mapSize.set(2048, 2048); s.camera.near = 10; s.camera.far = 2600; s.bias = -0.0006; s.normalBias = 0.6;
      const e = 260; s.camera.left = -e; s.camera.right = e; s.camera.top = e; s.camera.bottom = -e;
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
    this.sun.target.position.copy(cam.position);
    this.sun.position.copy(cam.position).addScaledVector(sd, 1300);
    this.sun.castShadow = !!this.q.shadows && cam.position.y > 700 && sd.y > 0.08;

    if (this.probeOn && !this.probeHold) {
      const every = this.q.name === 'medium' ? 3 : 1;
      if (this.frame % every === 0) this._stepProbe();
    }
    this.sky.position.copy(cam.position); this.sky.updateMatrix();
    cam.updateMatrixWorld();
    this.post.render(this.scene, cam, dt);
  }
}
