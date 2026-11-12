// Cinematic post pipeline: HDR scene → volumetric clouds → god rays / motion blur → bloom + anamorphic
// streaks → auto exposure, filmic tonemap, grade, CA, grain, vignette → FXAA.
import * as THREE from 'three';
import { U, NS_COMMON } from './env.js';
import { CLOUD_FRAG, createCloudNoise } from './clouds.js';

const VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

function fsTri() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
  return g;
}
const mk = (frag, uniforms, extra = {}) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false, ...extra });

export class PostFX {
  constructor(renderer, quality) {
    this.r = renderer; this.q = quality;
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(fsTri(), null); this.quad.frustumCulled = false;
    this.scene = new THREE.Scene(); this.scene.add(this.quad);
    this.prevVP = new THREE.Matrix4(); this.curVP = new THREE.Matrix4(); this.tmpM = new THREE.Matrix4();
    this.sunScreen = new THREE.Vector3();
    this.cloudNoise = createCloudNoise(quality.name === 'low' ? 32 : 48);
    this.exposureIdx = 0;
    this.cinematic = 0; // letterbox amount 0..1
    this.settings = { bloom: 1, grain: 1, ca: 1, vignette: 1, exposure: 1, saturation: 1 };
    this._build();
  }

  _rt(w, h, opts = {}) {
    return new THREE.WebGLRenderTarget(Math.max(1, w | 0), Math.max(1, h | 0), {
      type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      depthBuffer: false, stencilBuffer: false, generateMipmaps: false, ...opts,
    });
  }

  _build() {
    const q = this.q;
    const size = this.r.getDrawingBufferSize(new THREE.Vector2());
    const w = size.x, h = size.y; this.w = w; this.h = h;
    const depthTex = new THREE.DepthTexture(w, h); depthTex.type = THREE.UnsignedIntType; depthTex.format = THREE.DepthFormat;
    depthTex.minFilter = depthTex.magFilter = THREE.NearestFilter;
    this.sceneRT = this._rt(w, h, { depthBuffer: true, depthTexture: depthTex, samples: q.msaa || 0 });
    this.cloudRT = this._rt(w * q.cloudScale, h * q.cloudScale);
    this.godRT = this._rt(w / 4, h / 4);
    this.aoRT = this._rt(w / 2, h / 2, { type: THREE.UnsignedByteType }); this.aoBlurRT = this._rt(w / 2, h / 2, { type: THREE.UnsignedByteType });
    this.hdrRT = this._rt(w, h);
    this.ldrRT = this._rt(w, h, { type: THREE.UnsignedByteType });
    this.mips = [];
    let mw = w >> 1, mh = h >> 1;
    for (let i = 0; i < q.bloomMips && mw > 4 && mh > 4; i++) { this.mips.push({ down: this._rt(mw, mh), up: this._rt(mw, mh) }); mw >>= 1; mh >>= 1; }
    this.streakA = this._rt(w >> 3, h >> 2); this.streakB = this._rt(w >> 3, h >> 2);
    this.expRT = [this._rt(1, 1, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter }), this._rt(1, 1, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter })];

    const res = new THREE.Vector2(w, h);
    this.mCloud = mk(CLOUD_FRAG.replace('NS_CLOUD_STEPS', String(q.cloudSteps)), {
      ...U, tDepth: { value: depthTex }, uCloudNoise: { value: this.cloudNoise }, uInvProj: { value: new THREE.Matrix4() }, uInvView: { value: new THREE.Matrix4() },
      uCamPos: { value: new THREE.Vector3() }, uRes: { value: res },
    });

    this.mGod = mk(/* glsl */ `
      precision highp float;
      uniform sampler2D tDepth; uniform sampler2D tCloud; uniform vec3 uSunScreen; uniform float uAspect; varying vec2 vUv;
      float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
      void main(){
        if (uSunScreen.z <= 0.0) { gl_FragColor = vec4(0.0); return; }
        vec2 d = (uSunScreen.xy - vUv);
        float dist = length(d * vec2(uAspect, 1.0));
        const int N = 28;
        vec2 stp = d / float(N) * 0.96;
        vec2 uv = vUv + stp * ign(gl_FragCoord.xy);
        float acc = 0.0; float wgt = 1.0; float tot = 0.0;
        for (int i = 0; i < N; i++) {
          float sky = step(0.99999, texture2D(tDepth, uv).r) * texture2D(tCloud, uv).a;
          vec2 q = (uv - uSunScreen.xy) * vec2(uAspect, 1.0);
          float near = exp(-dot(q, q) * 9.0);
          acc += sky * near * wgt; tot += wgt; wgt *= 0.965; uv += stp;
        }
        float g = acc / tot;
        gl_FragColor = vec4(vec3(g * exp(-dist * 1.1)), 1.0);
      }`, { tDepth: { value: depthTex }, tCloud: { value: this.cloudRT.texture }, uSunScreen: { value: this.sunScreen }, uAspect: { value: w / h } });


    this.mAO = mk(/* glsl */ `
      precision highp float;
      uniform sampler2D tDepth; uniform mat4 uProj; uniform mat4 uInvProj; uniform vec2 uRes; uniform float uRadius; varying vec2 vUv;
      vec3 vpos(vec2 uv){ float d = texture2D(tDepth, uv).r; vec4 p = uInvProj * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); return p.xyz / p.w; }
      float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
      void main(){
        float d0 = texture2D(tDepth, vUv).r;
        if (d0 >= 0.99999) { gl_FragColor = vec4(1.0); return; }
        vec3 p = vpos(vUv);
        vec2 t = 1.0 / uRes;
        // normal from the closest depth neighbours (avoids edge artefacts)
        vec3 pr = vpos(vUv + vec2(t.x, 0.0)), pl = vpos(vUv - vec2(t.x, 0.0)), pu = vpos(vUv + vec2(0.0, t.y)), pd = vpos(vUv - vec2(0.0, t.y));
        vec3 dx = abs(pr.z - p.z) < abs(p.z - pl.z) ? pr - p : p - pl;
        vec3 dy = abs(pu.z - p.z) < abs(p.z - pd.z) ? pu - p : p - pd;
        vec3 n = normalize(cross(dx, dy));
        float viewZ = -p.z;
        float rad = uRadius * (1.0 + viewZ * 0.012);
        float rpx = rad * uProj[1][1] * 0.5 / viewZ; // radius in uv units (vertical)
        rpx = clamp(rpx, 0.004, 0.12);
        float ang = ign(gl_FragCoord.xy) * 6.2832; float occ = 0.0;
        const int N = 10;
        for (int i = 0; i < N; i++) {
          float f = (float(i) + 0.5) / float(N);
          float a = ang + f * 6.2832 * 2.4;
          vec2 o = vec2(cos(a), sin(a)) * rpx * sqrt(f); o.x *= uRes.y / uRes.x;
          vec3 s = vpos(vUv + o);
          vec3 v = s - p; float dd = dot(v, v);
          float vn = dot(v, n);
          float fall = max(0.0, 1.0 - dd / (rad * rad));
          occ += max(0.0, vn - 0.02 * viewZ * 0.05 - 0.03) / (sqrt(dd) + 0.02) * fall;
        }
        float ao = clamp(1.0 - occ / float(N) * 2.6, 0.0, 1.0);
        gl_FragColor = vec4(ao, viewZ / 2000.0, 0.0, 1.0);
      }`, { tDepth: { value: depthTex }, uProj: { value: new THREE.Matrix4() }, uInvProj: { value: new THREE.Matrix4() }, uRes: { value: new THREE.Vector2(w / 2, h / 2) }, uRadius: { value: 2.2 } });
    this.mAOBlur = mk(/* glsl */ `
      precision highp float; uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
      void main(){
        vec2 c = texture2D(tSrc, vUv).rg; float sum = 0.0, wsum = 0.0;
        for (int y = -2; y <= 1; y++) for (int x = -2; x <= 1; x++) {
          vec2 s = texture2D(tSrc, vUv + (vec2(float(x), float(y)) + 0.5) * uTexel).rg;
          float w = 1.0 / (1.0 + abs(s.g - c.g) * 900.0);
          sum += s.r * w; wsum += w;
        }
        gl_FragColor = vec4(sum / wsum, c.g, 0.0, 1.0);
      }`, { tSrc: { value: this.aoRT.texture }, uTexel: { value: new THREE.Vector2(2 / w, 2 / h) } });

    this.mCombine = mk(/* glsl */ `
      precision highp float;
      uniform sampler2D tScene; uniform sampler2D tDepth; uniform sampler2D tCloud; uniform sampler2D tGod; uniform sampler2D tAO; uniform float uAO;
      uniform mat4 uInvVP; uniform mat4 uPrevVP; uniform float uBlur; uniform vec3 uGodColor; uniform vec2 uTexel; uniform vec2 uCloudTexel;
      varying vec2 vUv;
      float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
      void main(){
        vec3 col;
        #ifdef NS_MOTION_BLUR
          float depth = texture2D(tDepth, vUv).r;
          vec4 ndc = vec4(vUv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
          vec4 wp = uInvVP * ndc; wp /= wp.w;
          vec4 pp = uPrevVP * wp; vec2 puv = pp.xy / pp.w * 0.5 + 0.5;
          vec2 vel = (vUv - puv) * uBlur;
          float vl = length(vel); if (vl > 0.035) vel *= 0.035 / vl;
          if (pp.w <= 0.0) vel = vec2(0.0);
          col = vec3(0.0); float j = ign(gl_FragCoord.xy) - 0.5;
          for (int i = 0; i < 8; i++) col += texture2D(tScene, vUv + vel * ((float(i) + j) / 8.0 - 0.5)).rgb;
          col *= 0.125;
        #else
          col = texture2D(tScene, vUv).rgb;
        #endif
        #ifdef NS_SSAO
          vec2 aov = texture2D(tAO, vUv).rg;
          float aoK = uAO * exp(-aov.g * 2000.0 / 420.0);
          float lum = max(col.r, max(col.g, col.b));
          float ao = mix(1.0, aov.r, aoK * (1.0 - smoothstep(0.6, 2.5, lum)));
          col *= ao * mix(1.0, ao, 0.5);
        #endif
        // soft 5-tap cloud upsample
        vec4 c = texture2D(tCloud, vUv) * 0.4;
        c += texture2D(tCloud, vUv + uCloudTexel * vec2(0.7, 0.7)) * 0.15; c += texture2D(tCloud, vUv + uCloudTexel * vec2(-0.7, 0.7)) * 0.15;
        c += texture2D(tCloud, vUv + uCloudTexel * vec2(0.7, -0.7)) * 0.15; c += texture2D(tCloud, vUv + uCloudTexel * vec2(-0.7, -0.7)) * 0.15;
        col = col * c.a + c.rgb;
        #ifdef NS_GODRAYS
          col += uGodColor * texture2D(tGod, vUv).r;
        #endif
        gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
      }`, {
      tScene: { value: this.sceneRT.texture }, tDepth: { value: depthTex }, tCloud: { value: this.cloudRT.texture }, tGod: { value: this.godRT.texture }, tAO: { value: this.aoBlurRT.texture }, uAO: { value: 1 },
      uInvVP: { value: new THREE.Matrix4() }, uPrevVP: { value: new THREE.Matrix4() }, uBlur: { value: 0.6 }, uGodColor: { value: new THREE.Color() },
      uTexel: { value: new THREE.Vector2(1 / w, 1 / h) }, uCloudTexel: { value: new THREE.Vector2(1 / this.cloudRT.width, 1 / this.cloudRT.height) },
    }, { defines: { ...(q.motionBlur ? { NS_MOTION_BLUR: 1 } : {}), ...(q.godrays ? { NS_GODRAYS: 1 } : {}), ...(q.ssao ? { NS_SSAO: 1 } : {}) } });

    this.mDown = mk(/* glsl */ `
      precision highp float; uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uFirst; varying vec2 vUv;
      float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
      void main(){
        vec2 t = uTexel;
        vec3 a = texture2D(tSrc, vUv + t * vec2(-2.0, 2.0)).rgb, b = texture2D(tSrc, vUv + t * vec2(0.0, 2.0)).rgb, c = texture2D(tSrc, vUv + t * vec2(2.0, 2.0)).rgb;
        vec3 d = texture2D(tSrc, vUv + t * vec2(-2.0, 0.0)).rgb, e = texture2D(tSrc, vUv).rgb, f = texture2D(tSrc, vUv + t * vec2(2.0, 0.0)).rgb;
        vec3 g = texture2D(tSrc, vUv + t * vec2(-2.0, -2.0)).rgb, h = texture2D(tSrc, vUv + t * vec2(0.0, -2.0)).rgb, i = texture2D(tSrc, vUv + t * vec2(2.0, -2.0)).rgb;
        vec3 j = texture2D(tSrc, vUv + t * vec2(-1.0, 1.0)).rgb, k = texture2D(tSrc, vUv + t * vec2(1.0, 1.0)).rgb;
        vec3 l = texture2D(tSrc, vUv + t * vec2(-1.0, -1.0)).rgb, m = texture2D(tSrc, vUv + t * vec2(1.0, -1.0)).rgb;
        vec3 col;
        if (uFirst > 0.5) { // Karis average to kill fireflies
          vec3 g0 = (a + b + d + e) * 0.25, g1 = (b + c + e + f) * 0.25, g2 = (d + e + g + h) * 0.25, g3 = (e + f + h + i) * 0.25, g4 = (j + k + l + m) * 0.25;
          float w0 = 1.0 / (1.0 + luma(g0)), w1 = 1.0 / (1.0 + luma(g1)), w2 = 1.0 / (1.0 + luma(g2)), w3 = 1.0 / (1.0 + luma(g3)), w4 = 1.0 / (1.0 + luma(g4));
          col = (g0 * w0 * 0.125 + g1 * w1 * 0.125 + g2 * w2 * 0.125 + g3 * w3 * 0.125 + g4 * w4 * 0.5) / (w0 * 0.125 + w1 * 0.125 + w2 * 0.125 + w3 * 0.125 + w4 * 0.5);
          col = min(col, vec3(60.0));
        } else {
          col = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
        }
        gl_FragColor = vec4(col, 1.0);
      }`, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uFirst: { value: 0 } });

    this.mUp = mk(/* glsl */ `
      precision highp float; uniform sampler2D tSrc; uniform sampler2D tBase; uniform vec2 uTexel; uniform float uRadius; varying vec2 vUv;
      void main(){
        vec2 t = uTexel * uRadius;
        vec3 s = texture2D(tSrc, vUv).rgb * 4.0;
        s += (texture2D(tSrc, vUv + vec2(t.x, 0.0)).rgb + texture2D(tSrc, vUv - vec2(t.x, 0.0)).rgb + texture2D(tSrc, vUv + vec2(0.0, t.y)).rgb + texture2D(tSrc, vUv - vec2(0.0, t.y)).rgb) * 2.0;
        s += texture2D(tSrc, vUv + t).rgb + texture2D(tSrc, vUv - t).rgb + texture2D(tSrc, vUv + vec2(t.x, -t.y)).rgb + texture2D(tSrc, vUv + vec2(-t.x, t.y)).rgb;
        gl_FragColor = vec4(texture2D(tBase, vUv).rgb + s / 16.0, 1.0);
      }`, { tSrc: { value: null }, tBase: { value: null }, uTexel: { value: new THREE.Vector2() }, uRadius: { value: 1.2 } });

    this.mStreak = mk(/* glsl */ `
      precision highp float; uniform sampler2D tSrc; uniform vec2 uDir; uniform float uThresh; varying vec2 vUv;
      void main(){
        vec3 s = vec3(0.0); float tw = 0.0;
        for (int i = -12; i <= 12; i++) {
          float w = exp(-float(i * i) / 60.0);
          vec3 c = texture2D(tSrc, vUv + uDir * float(i)).rgb;
          if (uThresh > 0.0) { float l = max(c.r, max(c.g, c.b)); c *= smoothstep(uThresh, uThresh * 3.0, l); }
          s += c * w; tw += w;
        }
        gl_FragColor = vec4(s / tw, 1.0);
      }`, { tSrc: { value: null }, uDir: { value: new THREE.Vector2() }, uThresh: { value: 0 } });

    this.mExposure = mk(/* glsl */ `
      precision highp float; uniform sampler2D tSrc; uniform sampler2D tPrev; uniform float uRate; uniform float uBias; varying vec2 vUv;
      void main(){
        float l = 0.0;
        for (int y = 0; y < 4; y++) for (int x = 0; x < 6; x++) {
          vec2 uv = (vec2(float(x), float(y)) + 0.5) / vec2(6.0, 4.0);
          vec3 c = texture2D(tSrc, uv).rgb;
          float w = 1.0 - 0.5 * length(uv - 0.5);
          l += log(max(dot(c, vec3(0.2126, 0.7152, 0.0722)), 1e-4)) * w / 19.4;
        }
        float avg = exp(l);
        float target = clamp(0.105 / (avg + 0.02), 0.25, 2.8) * uBias;
        float prev = texture2D(tPrev, vec2(0.5)).r;
        if (!(prev > 0.0)) prev = target;
        gl_FragColor = vec4(vec3(mix(prev, target, uRate)), 1.0);
      }`, { tSrc: { value: null }, tPrev: { value: null }, uRate: { value: 0.05 }, uBias: { value: 1 } });

    this.mFinal = mk(/* glsl */ `
      precision highp float;
      uniform sampler2D tHdr; uniform sampler2D tBloom; uniform sampler2D tStreak; uniform sampler2D tExp;
      uniform float uTime; uniform vec2 uRes; uniform float uBloom; uniform float uGrain; uniform float uCA; uniform float uVig;
      uniform float uExposure; uniform float uSat; uniform float uLetter; uniform float uFade; uniform vec3 uTint; uniform float uDamage; uniform float uSpeedFx;
      varying vec2 vUv;
      vec3 aces(vec3 v){
        v = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777) * v;
        vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; v = a / b;
        return clamp(mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602) * v, 0.0, 1.0);
      }
      float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
      vec3 fetch(vec2 uv){
        vec3 c = texture2D(tHdr, uv).rgb;
        vec3 b = texture2D(tBloom, uv).rgb;
        vec3 s = texture2D(tStreak, uv).rgb;
        return mix(c, b, 0.055 * uBloom) + b * 0.035 * uBloom + s * vec3(0.35, 0.55, 1.0) * 0.07 * uBloom;
      }
      void main(){
        vec2 uv = vUv; vec2 cc = uv - 0.5;
        float r2 = dot(cc, cc);
        // subtle barrel distortion + speed warp
        uv = 0.5 + cc * (1.0 + r2 * (0.035 + uSpeedFx * 0.05)) / (1.0 + 0.25 * (0.035 + uSpeedFx * 0.05));
        vec2 dir = cc * (0.0022 + uSpeedFx * 0.006) * uCA * (0.3 + r2 * 3.0);
        vec3 col;
        col.r = fetch(uv + dir).r; col.g = fetch(uv).g; col.b = fetch(uv - dir).b;
        float ex = texture2D(tExp, vec2(0.5)).r * uExposure;
        col *= ex;
        // filmic
        col = aces(col * 1.15);
        // grade: split-tone (teal shadows / amber highlights), gentle S-curve, saturation
        float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
        col += (vec3(-0.012, 0.006, 0.020) * (1.0 - smoothstep(0.0, 0.45, l)) + vec3(0.020, 0.008, -0.016) * smoothstep(0.35, 1.0, l));
        col = mix(vec3(l), col, 1.06 * uSat);
        col = mix(col, col * col * (3.0 - 2.0 * col), 0.22);
        col *= uTint;
        // vignette
        float vig = 1.0 - uVig * smoothstep(0.18, 0.95, r2 * 1.9);
        col *= vig;
        col = mix(col, vec3(0.5, 0.02, 0.01) * (l + 0.15), uDamage * smoothstep(0.05, 0.5, r2));
        // gamma
        col = pow(max(col, 0.0), vec3(1.0 / 2.2));
        // grain (luma weighted) + dither
        float g = hash(gl_FragCoord.xy + fract(uTime * 7.31) * 913.7) - 0.5;
        col += g * (0.035 * uGrain) * (1.0 - 0.6 * l) + (hash(gl_FragCoord.xy * 1.7) - 0.5) / 255.0;
        // letterbox + fade
        float bar = step(abs(vUv.y - 0.5), 0.5 - 0.12 * uLetter);
        col *= bar * uFade;
        gl_FragColor = vec4(col, dot(col, vec3(0.299, 0.587, 0.114)));
      }`, {
      tHdr: { value: this.hdrRT.texture }, tBloom: { value: null }, tStreak: { value: this.streakB.texture }, tExp: { value: null },
      uTime: U.uTime, uRes: { value: res }, uBloom: { value: 1 }, uGrain: { value: 1 }, uCA: { value: 1 }, uVig: { value: 0.52 },
      uExposure: { value: 1 }, uSat: { value: 1 }, uLetter: { value: 0 }, uFade: { value: 1 }, uTint: { value: new THREE.Color(1, 1, 1) }, uDamage: { value: 0 }, uSpeedFx: { value: 0 },
    });

    this.mFxaa = mk(/* glsl */ `
      precision highp float; uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
      void main(){
        vec3 rgbM = texture2D(tSrc, vUv).rgb;
        float lM = texture2D(tSrc, vUv).a;
        float lNW = texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).a, lNE = texture2D(tSrc, vUv + uTexel * vec2(1.0, -1.0)).a;
        float lSW = texture2D(tSrc, vUv + uTexel * vec2(-1.0, 1.0)).a, lSE = texture2D(tSrc, vUv + uTexel * vec2(1.0, 1.0)).a;
        float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE))), lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
        vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), ((lNW + lSW) - (lNE + lSE)));
        float dirReduce = max((lNW + lNE + lSW + lSE) * 0.03125, 0.0078125);
        float rcp = 1.0 / (min(abs(dir.x), abs(dir.y)) + dirReduce);
        dir = clamp(dir * rcp, vec2(-8.0), vec2(8.0)) * uTexel;
        vec4 a = 0.5 * (texture2D(tSrc, vUv + dir * (1.0 / 3.0 - 0.5)) + texture2D(tSrc, vUv + dir * (2.0 / 3.0 - 0.5)));
        vec4 b = a * 0.5 + 0.25 * (texture2D(tSrc, vUv + dir * -0.5) + texture2D(tSrc, vUv + dir * 0.5));
        gl_FragColor = vec4((b.a < lMin || b.a > lMax) ? a.rgb : b.rgb, 1.0);
      }`, { tSrc: { value: this.ldrRT.texture }, uTexel: { value: new THREE.Vector2(1 / w, 1 / h) } });
  }

  resize() {
    for (const rt of [this.sceneRT, this.cloudRT, this.godRT, this.aoRT, this.aoBlurRT, this.hdrRT, this.ldrRT, this.streakA, this.streakB, ...this.expRT]) rt.dispose();
    for (const m of this.mips) { m.down.dispose(); m.up.dispose(); }
    for (const m of [this.mCloud, this.mGod, this.mAO, this.mAOBlur, this.mCombine, this.mDown, this.mUp, this.mStreak, this.mExposure, this.mFinal, this.mFxaa]) m.dispose();
    this._build();
  }

  _pass(mat, target) {
    this.quad.material = mat;
    this.r.setRenderTarget(target || null);
    this.r.render(this.scene, this.cam);
  }

  render(scene, camera, dt) {
    const r = this.r, q = this.q;
    // 1. scene
    r.setRenderTarget(this.sceneRT);
    r.clear();
    r.render(scene, camera);

    // matrices
    this.curVP.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    const cu = this.mCloud.uniforms;
    cu.uInvProj.value.copy(camera.projectionMatrixInverse); cu.uInvView.value.copy(camera.matrixWorld); cu.uCamPos.value.copy(camera.position);
    // 2. clouds
    this._pass(this.mCloud, this.cloudRT);
    // 3. god rays
    if (q.godrays) {
      const sd = U.uSunDir.value;
      this.sunScreen.set(camera.position.x + sd.x * 1e5, camera.position.y + sd.y * 1e5, camera.position.z + sd.z * 1e5).applyMatrix4(this.curVP);
      const front = this.tmpV || (this.tmpV = new THREE.Vector3());
      camera.getWorldDirection(front);
      const facing = front.dot(sd);
      this.sunScreen.set(this.sunScreen.x * 0.5 + 0.5, this.sunScreen.y * 0.5 + 0.5, facing > 0.05 ? 1 : 0);
      this._pass(this.mGod, this.godRT);
      const sc = U.uSunColor.value;
      this.mCombine.uniforms.uGodColor.value.setRGB(sc.r, sc.g, sc.b).multiplyScalar(0.55 * Math.min(1, Math.max(0, (facing - 0.05) * 3)));
    }
    if (q.ssao) {
      this.mAO.uniforms.uProj.value.copy(camera.projectionMatrix); this.mAO.uniforms.uInvProj.value.copy(camera.projectionMatrixInverse);
      this._pass(this.mAO, this.aoRT); this._pass(this.mAOBlur, this.aoBlurRT);
    }
    // 4. combine (+ motion blur)
    const mc = this.mCombine.uniforms;
    mc.uInvVP.value.copy(this.curVP).invert(); mc.uPrevVP.value.copy(this.prevVP);
    mc.uBlur.value = dt > 0 ? Math.min(1, (1 / 60) / dt) * 0.55 : 0;
    this._pass(this.mCombine, this.hdrRT);
    this.prevVP.copy(this.curVP);
    // 5. bloom
    let src = this.hdrRT;
    for (let i = 0; i < this.mips.length; i++) {
      const m = this.mips[i];
      this.mDown.uniforms.tSrc.value = src.texture; this.mDown.uniforms.uTexel.value.set(1 / src.width, 1 / src.height); this.mDown.uniforms.uFirst.value = i === 0 ? 1 : 0;
      this._pass(this.mDown, m.down); src = m.down;
    }
    let up = this.mips[this.mips.length - 1].down;
    for (let i = this.mips.length - 2; i >= 0; i--) {
      const m = this.mips[i];
      this.mUp.uniforms.tSrc.value = up.texture; this.mUp.uniforms.tBase.value = m.down.texture; this.mUp.uniforms.uTexel.value.set(1 / up.width, 1 / up.height);
      this._pass(this.mUp, m.up); up = m.up;
    }
    // anamorphic streak from mip 1
    const sm = this.mips[Math.min(1, this.mips.length - 1)].down;
    this.mStreak.uniforms.tSrc.value = sm.texture; this.mStreak.uniforms.uDir.value.set(1.6 / this.streakA.width, 0); this.mStreak.uniforms.uThresh.value = 1.4;
    this._pass(this.mStreak, this.streakA);
    this.mStreak.uniforms.tSrc.value = this.streakA.texture; this.mStreak.uniforms.uDir.value.set(4.5 / this.streakA.width, 0); this.mStreak.uniforms.uThresh.value = 0;
    this._pass(this.mStreak, this.streakB);
    // 6. auto exposure (1x1 ping-pong)
    const prev = this.expRT[this.exposureIdx], next = this.expRT[1 - this.exposureIdx];
    const eu = this.mExposure.uniforms;
    eu.tSrc.value = this.mips[this.mips.length - 1].down.texture; eu.tPrev.value = prev.texture;
    eu.uRate.value = dt > 0 ? 1 - Math.exp(-dt * 1.6) : 1; eu.uBias.value = this.exposureBias || 1;
    this._pass(this.mExposure, next); this.exposureIdx = 1 - this.exposureIdx;
    // 7. final + fxaa
    const fu = this.mFinal.uniforms;
    fu.tBloom.value = up.texture; fu.tExp.value = next.texture; fu.tStreak.value = this.streakB.texture;
    fu.uBloom.value = this.settings.bloom; fu.uGrain.value = this.settings.grain; fu.uCA.value = this.settings.ca; fu.uExposure.value = this.settings.exposure; fu.uSat.value = this.settings.saturation;
    fu.uLetter.value = this.cinematic;
    this._pass(this.mFinal, this.ldrRT);
    this._pass(this.mFxaa, null);
  }
}
