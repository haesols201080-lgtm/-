// 렌더러·카메라·후처리. 하늘 장면을 먼저 그리고 깊이를 지운 뒤 세계 장면을 그립니다.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { Pass } from 'three/examples/jsm/postprocessing/Pass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { PRESETS } from './quality.js';

// 모든 재질의 최종 색을 안전하게: 무한대·NaN 이 블룸에 들어가면 화면 전체가 검게 번진다
if (!THREE.ShaderChunk.tonemapping_fragment.includes('SAFE_OUT')) {
  THREE.ShaderChunk.tonemapping_fragment = `// SAFE_OUT
gl_FragColor.rgb = clamp(gl_FragColor.rgb, 0.0, 48.0);
if (!(gl_FragColor.r == gl_FragColor.r && gl_FragColor.g == gl_FragColor.g && gl_FragColor.b == gl_FragColor.b)) gl_FragColor.rgb = vec3(0.0);
` + THREE.ShaderChunk.tonemapping_fragment;
}

/** 후처리 셰이더의 텍스처 읽기 바로 뒤에 NaN·무한대 → 0, 밝기 상한 (clamp 의 min/max 는 대부분의 GPU 에서 NaN 이 아닌 쪽을 돌려준다) */
function sanitize(mat, anchor, v) {
  if (!mat || !mat.fragmentShader.includes(anchor)) { console.warn('[engine] 후처리 안전장치를 끼울 자리를 못 찾음', anchor); return; }
  mat.fragmentShader = mat.fragmentShader.replace(anchor, `${anchor}
if ( !( abs( ${v}.r ) < 1e4 && abs( ${v}.g ) < 1e4 && abs( ${v}.b ) < 1e4 ) || ${v}.r != ${v}.r || ${v}.g != ${v}.g || ${v}.b != ${v}.b ) ${v}.rgb = vec3( 0.0 );
${v}.rgb = clamp( ${v}.rgb, 0.0, 64.0 );`);
  mat.needsUpdate = true;
}

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
    r.info.autoReset = false;
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
    // 블룸 입력도 안전하게: 재질 하나가 낸 NaN·무한대(모바일 GPU 의 pow(음수)·반정밀도 넘침) 한 점이 흐림을 타고
    // 화면 한가운데를 통째로 검은 판으로 덮던 문제 (v24 인트로 넘기기 — 판 뒤 가장자리로 세계가 보임)
    sanitize(this.bloom.materialHighPassFilter, 'vec4 texel = texture2D( tDiffuse, vUv );', 'texel');
    this.composer.addPass(this.bloom);
    const out = new OutputPass();
    sanitize(out.material, 'gl_FragColor = texture2D( tDiffuse, vUv );', 'gl_FragColor');
    this.composer.addPass(out);
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
    if (this.space) { this.space.draw(renderer); return; } // 오프닝의 우주 장면 (세계 대신)
    if (this.sky) renderer.render(this.sky.scene, this.sky.camera);
    renderer.clearDepth();
    const cam = this.camera;
    const alt = cam.position.y - (this.altOffset || 0); // 실내 공간(하늘 높이의 닫힌 방)은 땅 높이로 친다
    if (alt > 2500) {
      // 높은 곳: 먼 곳(수백 km)과 가까운 곳을 깊이 범위를 나눠 두 번 그린다 (깊이 정밀도)
      const n = cam.near, f = cam.far;
      const split = Math.min(900, 120 + alt * 0.01);
      cam.near = split;
      cam.far = 70000 + Math.sqrt(2 * 1600000 * alt) * 1.2;
      cam.updateProjectionMatrix();
      renderer.render(this.scene, cam);
      renderer.clearDepth();
      cam.near = n;
      cam.far = split * 1.05;
      cam.updateProjectionMatrix();
      renderer.render(this.scene, cam);
      cam.far = f;
      cam.updateProjectionMatrix();
    } else renderer.render(this.scene, cam);
  }

  /** 실내 공간: keep(o) 가 아닌 장면의 것들을 잠시 숨긴다 (바깥 세계를 그리지 않는다) */
  isolate(keep) {
    this.unisolate();
    this._hidden = [];
    for (const o of this.scene.children) if (o.visible && !keep(o)) { o.visible = false; this._hidden.push(o); }
  }
  unisolate() {
    if (!this._hidden) return;
    for (const o of this._hidden) o.visible = true;
    this._hidden = null;
  }

  render() {
    this.renderer.info.reset();
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
