// 렌더러·카메라·후처리. 하늘 장면을 먼저 그리고 깊이를 지운 뒤 세계 장면을 그립니다.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { Pass } from 'three/examples/jsm/postprocessing/Pass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { PRESETS } from './quality.js';

class SkyWorldPass extends Pass {
  constructor(engine) {
    super();
    this.engine = engine;
    this.needsSwap = false;
  }
  render(renderer, writeBuffer, readBuffer) {
    const e = this.engine;
    renderer.setRenderTarget(this.renderToScreen ? null : readBuffer);
    e._drawScenes(renderer);
  }
}

export class Engine {
  constructor(canvas, qualityName) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
      stencil: false,
    });
    const r = this.renderer;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.autoClear = false;
    r.setClearColor(0x000000, 1);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.6, 70000);
    this.sky = null; // Sky 인스턴스 (나중에 연결)
    this.resScale = 1;
    this._frameTimes = [];
    this.setQuality(qualityName);
    window.addEventListener('resize', () => this.resize());
  }

  setQuality(name) {
    this.qualityName = PRESETS[name] ? name : 'medium';
    this.q = PRESETS[this.qualityName];
    this._buildPipeline();
    this.resize();
  }

  _buildPipeline() {
    const r = this.renderer;
    if (this.composer) this.composer.dispose?.();
    this.composer = null;
    this.bloom = null;
    if (!this.q.bloom || new URLSearchParams(location.search).get('bloom') === '0') return;
    const size = r.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(Math.max(1, size.x), Math.max(1, size.y), {
      type: THREE.HalfFloatType,
      samples: this.q.msaa,
    });
    this.composer = new EffectComposer(r, rt);
    this.composer.addPass(new SkyWorldPass(this));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.42, 0.25, 1.1);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, this.q.dprCap) * this.resScale;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.composer) {
      this.composer.setPixelRatio(dpr);
      this.composer.setSize(w, h);
    }
  }

  _drawScenes(renderer) {
    renderer.clear(true, true, false);
    if (this.sky) renderer.render(this.sky.scene, this.sky.camera);
    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
  }

  render() {
    if (this.composer) this.composer.render();
    else {
      this.renderer.setRenderTarget(null);
      this._drawScenes(this.renderer);
    }
  }

  /** 프레임 시간을 보고 해상도를 동적으로 조절 */
  adapt(dt) {
    this._frameTimes.push(dt);
    if (this._frameTimes.length < 90) return;
    const sorted = [...this._frameTimes].sort((a, b) => a - b);
    const med = sorted[sorted.length >> 1];
    this._frameTimes.length = 0;
    let s = this.resScale;
    if (med > 1 / 40) s = Math.max(0.55, s - 0.1);
    else if (med < 1 / 57 && s < 1) s = Math.min(1, s + 0.05);
    if (s !== this.resScale) {
      this.resScale = s;
      this.resize();
    }
  }
}
