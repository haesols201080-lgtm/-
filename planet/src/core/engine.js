// Renderer + post pipeline:
//   scene (HDR, MSAA, depth) -> atmosphere composite (height fog / aerial
//   perspective using the sky model, cloud shadows, underwater) -> bloom ->
//   output (ACES tone map, grading, vignette, damage tint).
import * as THREE from 'three';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { U, WORLD } from './shared.js';
import { SKY_GLSL } from '../world/sky.js';
import { TEX } from '../world/texstore.js';

// Planet curvature: every vertex drops by d^2 * CURV with horizontal distance d
// from the camera, so the horizon falls away like on a real (small) planet.
// Shadow depth passes stay flat so casters line up with receivers.
THREE.ShaderChunk.project_vertex = /* glsl */`
vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
  mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
  mvPosition = instanceMatrix * mvPosition;
#endif
#if defined( DEPTH_PACKING ) || defined( NO_CURVE )
  mvPosition = modelViewMatrix * mvPosition;
#else
  vec4 pcW = modelMatrix * mvPosition;
  vec2 pcD = pcW.xz - cameraPosition.xz;
  pcW.y -= dot(pcD, pcD) * ${WORLD.CURV.toExponential(6)};
  mvPosition = viewMatrix * pcW;
#endif
gl_Position = projectionMatrix * mvPosition;
`;
export const CURVE_GLSL = /* glsl */`
vec3 planetCurve(vec3 w) { vec2 d = w.xz - cameraPosition.xz; w.y -= dot(d, d) * ${WORLD.CURV.toExponential(6)}; return w; }
`;

const FS_VERT = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

export const QUALITY = {
  low: { pr: 0.75, msaa: 0, shadow: 1024, bloom: false, ao: false, view: 0.7, flora: 0.45 },
  medium: { pr: 1.0, msaa: 2, shadow: 2048, bloom: true, ao: true, view: 0.85, flora: 0.7 },
  high: { pr: 1.5, msaa: 4, shadow: 2048, bloom: true, ao: true, view: 1.0, flora: 1.0 },
  ultra: { pr: 2.0, msaa: 4, shadow: 4096, bloom: true, ao: true, view: 1.0, flora: 1.25 },
};

export class Engine {
  constructor(container) {
    this.container = container;
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: false, logarithmicDepthBuffer: true });
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(r.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(72, 1, 0.12, 30000);
    this.qualityName = 'high';
    this.quality = QUALITY.high;
    this.exposure = 1.0;
    this.hurt = 0;
    this.underwater = 0;
    this.waterTint = new THREE.Color(0.02, 0.12, 0.14);

    const fsGeo = new THREE.BufferGeometry();
    fsGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    fsGeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
    this.fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.compUniforms = {
      tColor: { value: null }, tDepth: { value: null },
      uProjInv: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() },
      uCamPos2: { value: new THREE.Vector3() },
      uFogDensity: { value: 0.0006 }, uFogFalloff: { value: 0.004 },
      uUnderwater: { value: 0 }, uWaterTint: { value: this.waterTint },
      uWaterLevelC: U.uWaterLevel, uFar: { value: 30000 }, tWaterN: { value: null }, uTimeC: U.uTime, uNightC: U.uNight,
      uAO: { value: 1 }, uRes: { value: new THREE.Vector2(1, 1) }, uProjY: { value: 1 },
    };
    this.compMat = new THREE.ShaderMaterial({
      uniforms: this.compUniforms,
      vertexShader: FS_VERT,
      fragmentShader: SKY_GLSL + /* glsl */`
        uniform sampler2D tColor, tDepth, tWaterN;
        uniform mat4 uProjInv, uCamWorld;
        uniform vec3 uCamPos2;
        uniform float uFogDensity, uFogFalloff, uUnderwater, uWaterLevelC, uFar, uTimeC, uNightC, uAO, uProjY;
        uniform vec2 uRes;
        uniform vec3 uWaterTint;
        varying vec2 vUv;
        vec3 viewPosAt(vec2 uv) {
          float z = texture2D(tDepth, uv).x;
          vec4 f = uProjInv * vec4(uv * 2.0 - 1.0, 1.0, 1.0);
          vec3 d = normalize(f.xyz / f.w);
          float vz = exp2(z * log2(uFar + 1.0)) - 1.0;
          return d * (vz / max(-d.z, 1e-4));
        }
        // screen-space ambient occlusion (hemisphere test on reconstructed positions)
        float ssao(vec3 P, float vz) {
          vec3 n = normalize(cross(dFdx(P), dFdy(P)));
          if (dot(n, -P) < 0.0) n = -n;
          float R = 0.85;
          float rpx = clamp(R * uProjY * uRes.y * 0.5 / max(vz, 0.1), 3.0, 48.0);
          float ign = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
          float occ = 0.0;
          for (int i = 0; i < 10; i++) {
            float fi = float(i);
            float a = (fi + ign) * 2.39996;
            float r = sqrt((fi + 0.5) / 10.0) * rpx;
            vec2 o = vec2(cos(a), sin(a)) * r / uRes;
            vec3 S = viewPosAt(vUv + o);
            vec3 v = S - P;
            float dl = length(v);
            float fall = 1.0 - smoothstep(R * 0.5, R * 1.6, dl);
            occ += max(0.0, dot(n, v) / max(dl, 1e-3) - 0.12) * fall;
          }
          return clamp(1.0 - occ / 10.0 * 1.6, 0.0, 1.0);
        }
        const float CURV = ${WORLD.CURV.toExponential(6)};
        float cloudShadow(vec3 wp) {
          if (uCloudCover <= 0.001) return 1.0;
          float t = (1400.0 - wp.y) / max(uSunDir.y, 0.12);
          vec2 p = wp.xz + uSunDir.xz * t;
          vec2 w = vec2(uCloudTime * 6.0, uCloudTime * 2.0);
          float n = texture2D(tNoise, (p + w) * 0.00016).r * 0.6 + texture2D(tNoise, (p + w * 1.6) * 0.0006).g * 0.3 + texture2D(tNoise, (p + w * 2.2) * 0.0022).a * 0.12;
          float cov = mix(0.82, 0.38, uCloudCover);
          float d = smoothstep(cov, cov + 0.22, n);
          return 1.0 - d * 0.5 * smoothstep(0.0, 0.2, uSunDir.y);
        }
        // ray vs curved water surface y = L - CURV * |dxz|^2
        float waterHit(vec3 ro, vec3 rd, float L) {
          float a = CURV * dot(rd.xz, rd.xz);
          float b = rd.y;
          float c = ro.y - L;
          if (c < 0.0) return -1.0;
          float disc = b * b - 4.0 * a * c;
          if (disc < 0.0) return -1.0;
          float q = -b + sqrt(disc);
          if (q <= 1e-6) return -1.0;
          return 2.0 * c / q;
        }
        void main() {
          vec3 col = texture2D(tColor, vUv).rgb;
          float z = texture2D(tDepth, vUv).x;
          vec4 fp = uProjInv * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
          vec3 vdir = normalize(fp.xyz / fp.w);
          bool isSky = z >= 0.999999;
          float vz = isSky ? 1e7 : exp2(z * log2(uFar + 1.0)) - 1.0;
          float dist = vz / max(-vdir.z, 1e-4);
          vec3 rd = normalize(mat3(uCamWorld) * vdir);
          vec3 ro = uCamPos2;
          vec3 wp = ro + rd * dist;

          if (!isSky) {
            col *= cloudShadow(wp);
            if (uAO > 0.0 && vz < 250.0) {
              vec3 Pv = vdir * (vz / max(-vdir.z, 1e-4));
              float ao = ssao(Pv, vz);
              col *= mix(1.0, ao, uAO * (1.0 - smoothstep(120.0, 250.0, vz)));
            }
          }

          // --- water surface (liquid oceans/lakes)
          float L = uWaterLevelC;
          bool below = ro.y < L;
          float tw = below ? -1.0 : waterHit(ro, rd, L);
          if (tw > 0.0 && tw < dist) {
            vec3 hp = ro + rd * tw;
            float thick = dist - tw;
            float day = smoothstep(-0.12, 0.12, uSunDir.y);
            float calm = mix(1.0, 0.3, smoothstep(40.0, 900.0, tw));
            vec2 n1 = texture2D(tWaterN, hp.xz * 0.045 + vec2(uTimeC * 0.012, uTimeC * 0.007)).rg * 2.0 - 1.0;
            vec2 n2 = texture2D(tWaterN, hp.xz * 0.12 + vec2(-uTimeC * 0.018, uTimeC * 0.021)).rg * 2.0 - 1.0;
            vec2 n3 = texture2D(tWaterN, hp.xz * 0.008 + vec2(uTimeC * 0.004, -uTimeC * 0.003)).rg * 2.0 - 1.0;
            vec3 N = normalize(vec3((n1.x + n2.x * 0.6 + n3.x * 1.3) * 0.2 * calm, 1.0, (n1.y + n2.y * 0.6 + n3.y * 1.3) * 0.2 * calm));
            vec3 V = -rd;
            float fres = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
            vec3 R = reflect(rd, N); R.y = abs(R.y) + 0.01;
            vec3 refl = skyColor(normalize(R), hp);
            vec3 absorb = exp(-thick * vec3(0.38, 0.075, 0.055));
            vec3 scatter = uWaterTint * (0.25 + 0.75 * day) * (uSunColor * 0.7 + 0.3);
            vec3 refr = col * absorb + scatter * (1.0 - absorb);
            vec3 Hh = normalize(uSunDir + V);
            float spec = pow(max(dot(N, Hh), 0.0), 700.0) * 22.0 + pow(max(dot(N, Hh), 0.0), 60.0) * 0.2;
            vec3 wc = mix(refr, refl, fres) + uSunColor * spec * day;
            float foamN = texture2D(tNoise, hp.xz * 0.09 + vec2(uTimeC * 0.01, 0.0)).b;
            float foam = (1.0 - smoothstep(0.0, 1.4, thick)) * smoothstep(0.35, 0.75, foamN + 0.25 * sin(uTimeC * 1.3 + thick * 5.0));
            wc = mix(wc, vec3(0.85, 0.9, 0.92) * (0.15 + 0.85 * day), foam * 0.75);
            col = wc;
            dist = tw;
            wp = hp;
            isSky = false;
          }
          if (!isSky) {
            float k = rd.y * uFogFalloff;
            float path = abs(k) < 1e-5 ? dist : (1.0 - exp(-dist * k)) / k;
            float od = uFogDensity * exp(-uFogFalloff * max(ro.y, -200.0)) * path;
            od += dist * 0.000025;
            vec3 fd = normalize(vec3(rd.x, max(rd.y + uDip, 0.0) * 0.35 + 0.02 - uDip, rd.z));
            vec3 fogCol = skyBase(fd);
            col = mix(fogCol, col, exp(-od));
          }
          if (below) {
            float dd = isSky ? 80.0 : dist;
            if (rd.y > 0.0) { float ts = (L - ro.y) / rd.y; if (ts < dd) dd = ts + (dd - ts) * 0.2; }
            float depthBelow = max(L - ro.y, 0.0);
            vec3 tint = uWaterTint * (0.3 + 0.7 * exp(-depthBelow * 0.04)) * (0.12 + 0.88 * smoothstep(-0.1, 0.2, uSunDir.y));
            col = mix(tint, col * vec3(0.5, 0.85, 0.9), exp(-dd * 0.06));
          }
          gl_FragColor = vec4(col, 1.0);
        }`,
      depthTest: false, depthWrite: false,
    });
    this.compQuad = new THREE.Mesh(fsGeo, this.compMat);
    this.compQuad.frustumCulled = false;
    this.compScene = new THREE.Scene();
    this.compScene.add(this.compQuad);

    this.outUniforms = {
      tColor: { value: null }, uHurt: { value: 0 }, uTime: U.uTime, uVignette: { value: 0.35 },
      uSat: { value: 1.08 }, uExposure: { value: 1.0 },
    };
    this.outMat = new THREE.ShaderMaterial({
      uniforms: this.outUniforms,
      vertexShader: FS_VERT,
      fragmentShader: /* glsl */`
        uniform sampler2D tColor;
        uniform float uHurt, uTime, uVignette, uSat, uExposure;
        varying vec2 vUv;
        void main() {
          vec3 c = texture2D(tColor, vUv).rgb * uExposure;
          float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
          c = mix(vec3(l), c, uSat);
          vec2 q = vUv - 0.5;
          float v = 1.0 - dot(q, q) * uVignette * 2.2;
          c *= v;
          float pulse = 0.6 + 0.4 * sin(uTime * 6.0);
          c = mix(c, c * vec3(1.4, 0.35, 0.3) + vec3(0.06, 0.0, 0.0), uHurt * smoothstep(0.15, 0.7, length(q)) * pulse);
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          gl_FragColor.rgb += (fract(sin(dot(vUv * 1000.0 + uTime, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
        }`,
      depthTest: false, depthWrite: false,
    });
    this.outQuad = new THREE.Mesh(fsGeo, this.outMat);
    this.outQuad.frustumCulled = false;
    this.outScene = new THREE.Scene();
    this.outScene.add(this.outQuad);

    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.32, 0.55, 0.92);
    this.onResize = this.onResize.bind(this);
    window.addEventListener('resize', this.onResize);
    this.applyQuality('high');
  }

  attachSky(sky) {
    this.sky = sky;
    // share the sky uniforms with the composite shader so fog matches the sky
    for (const k of Object.keys(sky.uniforms)) this.compUniforms[k] = sky.uniforms[k];
    this.compMat.needsUpdate = true;
  }

  applyQuality(name) {
    this.qualityName = name;
    this.quality = QUALITY[name] || QUALITY.high;
    this.onResize();
    if (this.sky) this.sky.setShadowSize(this.quality.shadow);
  }

  makeTargets(w, h) {
    if (this.sceneRT) { this.sceneRT.dispose(); this.postRT.dispose(); }
    const q = this.quality;
    this.sceneRT = new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType, samples: q.msaa,
      depthTexture: new THREE.DepthTexture(w, h, THREE.FloatType),
    });
    this.sceneRT.depthTexture.minFilter = this.sceneRT.depthTexture.magFilter = THREE.NearestFilter;
    this.postRT = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType });
    this.compUniforms.tColor.value = this.sceneRT.texture;
    this.compUniforms.tDepth.value = this.sceneRT.depthTexture;
    this.outUniforms.tColor.value = this.postRT.texture;
    this.bloom.setSize(Math.max(1, w >> 1), Math.max(1, h >> 1));
  }

  onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;
    this.pixelRatio = this.quality.pr < 1 ? this.quality.pr : Math.min(dpr, this.quality.pr);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.makeTargets(Math.floor(w * this.pixelRatio), Math.floor(h * this.pixelRatio));
  }

  render() {
    const r = this.renderer, cam = this.camera;
    cam.updateMatrixWorld();
    r.setRenderTarget(this.sceneRT);
    r.render(this.scene, cam);
    this.sceneInfo = { calls: r.info.render.calls, tris: r.info.render.triangles };
    const cu = this.compUniforms;
    cu.uProjInv.value.copy(cam.projectionMatrixInverse);
    cu.uCamWorld.value.copy(cam.matrixWorld);
    cu.uCamPos2.value.copy(cam.position);
    if (this.sky) {
      cu.uFogDensity.value = this.sky.fog.density;
      cu.uFogFalloff.value = this.sky.fog.falloff;
    }
    cu.uUnderwater.value = this.underwater;
    cu.uFar.value = cam.far;
    cu.uAO.value = this.quality.ao ? 1 : 0;
    cu.uRes.value.set(this.sceneRT.width, this.sceneRT.height);
    cu.uProjY.value = cam.projectionMatrix.elements[5];
    if (!cu.tWaterN.value) cu.tWaterN.value = TEX.water;
    r.setRenderTarget(this.postRT);
    r.render(this.compScene, this.fsCam);
    if (this.overlay) {
      // first-person tool: drawn after fog/water so it never clips into walls
      r.autoClear = false;
      r.clearDepth();
      r.render(this.overlay, cam);
      r.autoClear = true;
    }
    if (this.quality.bloom) this.bloom.render(r, null, this.postRT, 0, false);
    this.outUniforms.uHurt.value = this.hurt;
    this.outUniforms.uExposure.value = this.exposure;
    r.setRenderTarget(null);
    r.render(this.outScene, this.fsCam);
  }
}
