// WebGL renderer with a filmic post chain: ambient occlusion, bloom, tone
// mapping, FXAA and a grading pass (desaturation, vignette, film grain,
// chromatic fringe, fades). Quality presets trade these off.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uSat: { value: 0.72 },
    uContrast: { value: 1.08 },
    uTint: { value: new THREE.Vector3(0.98, 1.0, 1.0) },
    uShadowTint: { value: new THREE.Vector3(0.92, 1.0, 0.98) },
    uVignette: { value: 0.42 },
    uGrain: { value: 0.055 },
    uCA: { value: 0.0018 },
    uFade: { value: 0 },          // 0 none .. 1 black
    uFadeColor: { value: new THREE.Vector3(0, 0, 0) },
    uAlarm: { value: 0 },         // suspicion pulse
    uWatched: { value: 0 },       // inside a telescreen's field of view
    uRes: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime, uSat, uContrast, uVignette, uGrain, uCA, uFade, uAlarm, uWatched;
    uniform vec3 uTint, uShadowTint, uFadeColor; uniform vec2 uRes;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec2 d = vUv - 0.5;
      float r2 = dot(d, d);
      float ca = uCA * (1.0 + uAlarm * 3.0) * r2 * 4.0;
      vec3 col;
      col.r = texture2D(tDiffuse, vUv + d * ca).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - d * ca).b;
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(l), col, uSat);
      col = mix(col * uShadowTint, col * uTint, smoothstep(0.0, 0.6, l));
      col = (col - 0.5) * uContrast + 0.5;
      // being watched: the edges of the frame go cold and tight
      float vig = uVignette + uWatched * 0.25 + uAlarm * 0.2;
      col *= 1.0 - vig * smoothstep(0.08, 0.55, r2 * 1.6);
      col = mix(col, col * vec3(1.15, 0.78, 0.74), uAlarm * smoothstep(0.1, 0.6, r2 * 2.0) * (0.6 + 0.4 * sin(uTime * 5.0)));
      float g = hash(vUv * uRes + fract(uTime * 13.7)) - 0.5;
      col += g * uGrain * (1.2 - l);
      col = mix(col, uFadeColor, uFade);
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }`,
};

export const QUALITY = {
  low: { ratio: 0.75, shadow: 1024, ao: false, bloom: false, aa: true },
  medium: { ratio: 1.0, shadow: 2048, ao: false, bloom: true, aa: true },
  high: { ratio: 1.25, shadow: 4096, ao: true, bloom: true, aa: true },
};

export class Renderer {
  constructor(container) {
    const r = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(r.domElement);
    this.gl = r;
    this.quality = 'medium';
    this.grade = new ShaderPass(GradeShader);
    this.u = this.grade.uniforms;
    this.composer = null;
    this.scene = null; this.camera = null;
  }

  setup(scene, camera, quality = this.quality) {
    this.scene = scene; this.camera = camera; this.quality = quality;
    const Q = QUALITY[quality];
    const r = this.gl;
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2) * Q.ratio);
    const w = window.innerWidth, h = window.innerHeight;
    r.setSize(w, h);
    const comp = new EffectComposer(r);
    comp.addPass(new RenderPass(scene, camera));
    this.gtao = null;
    if (Q.ao) {
      this.gtao = new GTAOPass(scene, camera, w, h);
      this.gtao.output = GTAOPass.OUTPUT.Default;
      this.gtao.blendIntensity = 0.85;
      this.gtao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.4, thickness: 1.5, scale: 1.0, samples: 12 });
      comp.addPass(this.gtao);
    }
    this.bloom = null;
    if (Q.bloom) {
      this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.12, 0.2, 0.92);
      comp.addPass(this.bloom);
    }
    comp.addPass(new OutputPass());
    if (Q.aa) {
      this.fxaa = new ShaderPass(FXAAShader);
      comp.addPass(this.fxaa);
    }
    comp.addPass(this.grade);
    this.composer = comp;
    this.resize();
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.gl.setSize(w, h);
    if (this.camera) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
    if (this.composer) this.composer.setSize(w, h);
    const pr = this.gl.getPixelRatio();
    if (this.fxaa) this.fxaa.material.uniforms.resolution.value.set(1 / (w * pr), 1 / (h * pr));
    this.u.uRes.value.set(w * pr, h * pr);
  }

  render(dt) {
    this.u.uTime.value += dt;
    this.composer.render(dt);
  }
}
