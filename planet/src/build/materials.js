// Building material library. Every material reads per-instance iData
// (x = powered/lit, y = activity for animation, z = random seed) and adds
// procedural surface detail in object space so detail stays attached to the
// building: panel seams, per-panel tint, grime at the base, dust on roofs.
import * as THREE from 'three';
import { U } from '../core/shared.js';
import { TEX } from '../world/texstore.js';

const HEAD_V = /* glsl */`
attribute vec3 iData;
varying vec3 vOP; varying vec3 vON; varying vec3 vWP2; varying vec3 vData;
#ifdef ANIM
uniform vec3 uPivot; uniform vec3 uAxis; uniform float uSpeed; uniform float uTime;
vec3 rotAxis(vec3 p, vec3 a, float ang) { float c = cos(ang), s = sin(ang); return p * c + cross(a, p) * s + a * dot(a, p) * (1.0 - c); }
#endif
#ifdef SLIDE
uniform vec3 uSlide;
attribute float iDoor;
#endif
`;

const BODY_V = /* glsl */`
#ifdef USE_INSTANCING
  vData = iData;
#else
  vData = vec3(1.0, 1.0, 0.3);
#endif
#ifdef ANIM
  float ang = uTime * uSpeed * vData.y + vData.z * 6.28;
  transformed = rotAxis(transformed - uPivot, normalize(uAxis), ang) + uPivot;
#endif
#ifdef SLIDE
  #ifdef USE_INSTANCING
  transformed += uSlide * iDoor;
  #endif
#endif
  vOP = transformed; vON = objectNormal;
`;

const BODY_N = /* glsl */`
#ifdef ANIM
  #ifdef USE_INSTANCING
  float angN = uTime * uSpeed * iData.y + iData.z * 6.28;
  #else
  float angN = uTime * uSpeed + 0.3 * 6.28;
  #endif
  objectNormal = rotAxis(objectNormal, normalize(uAxis), angN);
#endif
`;

const HEAD_F = /* glsl */`
varying vec3 vOP; varying vec3 vON; varying vec3 vWP2; varying vec3 vData;
uniform sampler2D tPanel, tNoise;
uniform float uNight, uDustAmt, uTime;
float hash1(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec3 gN2; float gR2;
`;

// object-space panel pattern -> (seam mask, panel hash, uv)
const PANEL_FN = /* glsl */`
vec3 panelInfo(vec3 p, vec3 n, vec2 size) {
  vec3 a = abs(n);
  vec2 uv = a.x > a.y && a.x > a.z ? p.zy : (a.y > a.z ? p.xz : p.xy);
  float row = floor(uv.y / size.y);
  uv.x += row * size.x * 0.5;
  vec2 q = uv / size;
  vec2 f = abs(fract(q) - 0.5) * size;
  vec2 d = size * 0.5 - f;
  float w = 0.014;
  vec2 fw = fwidth(uv) * 0.8;
  float sx = 1.0 - smoothstep(w, w + fw.x, d.x);
  float sy = 1.0 - smoothstep(w, w + fw.y, d.y);
  float seamM = max(sx, sy) * (1.0 - smoothstep(0.6, 1.2, length(fw) * 30.0));
  return vec3(seamM, hash1(floor(q) + vData.z * 17.0), uv.y);
}
`;

const SHARED_UNIFORMS = () => ({ tPanel: { value: TEX.panel }, tNoise: U.tNoise, uNight: U.uNight, uDustAmt: { value: 0 }, uTime: U.uTime });
export const BUILD_U = { uDustAmt: { value: 0.6 } };

function patch(mat, key, fragBody, { anim = null, slide = null, extraUniforms = {} } = {}) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, SHARED_UNIFORMS(), extraUniforms);
    sh.uniforms.uDustAmt = BUILD_U.uDustAmt;
    if (anim) {
      sh.defines = sh.defines || {};
      sh.defines.ANIM = 1;
      sh.uniforms.uPivot = { value: new THREE.Vector3(...anim.pivot) };
      sh.uniforms.uAxis = { value: new THREE.Vector3(...anim.axis) };
      sh.uniforms.uSpeed = { value: anim.speed };
    }
    if (slide) {
      sh.defines = sh.defines || {};
      sh.defines.SLIDE = 1;
      sh.uniforms.uSlide = { value: new THREE.Vector3(...slide) };
    }
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + HEAD_V)
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n' + BODY_N)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + BODY_V);
    // objectNormal is defined before begin_vertex (beginnormal_vertex), so ANIM can rotate it.
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + HEAD_F + PANEL_FN)
      .replace('#include <map_fragment>', fragBody.map || '')
      .replace('#include <roughnessmap_fragment>', fragBody.rough || '#include <roughnessmap_fragment>')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + (fragBody.emit || ''));
  };
  mat.customProgramCacheKey = () => key + (anim ? JSON.stringify(anim) : '') + (slide ? JSON.stringify(slide) : '');
  return mat;
}

const HULL_MAP = /* glsl */`
  vec3 pin = panelInfo(vOP, normalize(vON), vec2(1.6, 1.0));
  vec3 baseC = diffuseColor.rgb * (0.93 + 0.1 * pin.y);
  vec4 nz = texture2D(tNoise, vOP.xz * 0.11 + vOP.y * 0.07 + vData.z);
  float streak = texture2D(tNoise, vec2(vOP.x * 0.9 + vOP.z * 0.9, vOP.y * 0.08) + vData.z).g;
  float grime = smoothstep(1.3, -0.2, vOP.y) * 0.5 + smoothstep(0.55, 0.85, streak) * 0.18 + smoothstep(0.6, 0.9, nz.b) * 0.12;
  float top = smoothstep(0.6, 0.95, normalize(vON).y);
  vec3 dirtC = vec3(0.28, 0.19, 0.13);
  baseC = mix(baseC, baseC * dirtC * 2.2, clamp(grime, 0.0, 1.0) * 0.55);
  baseC = mix(baseC, vec3(0.42, 0.28, 0.19), top * uDustAmt * smoothstep(0.35, 0.7, nz.r) * 0.6);
  baseC *= 1.0 - pin.x * 0.45;
  diffuseColor.rgb = baseC;
  gR2 = clamp(0.48 + grime * 0.3 + pin.x * 0.2 + top * uDustAmt * 0.2, 0.0, 1.0);
`;

export function makeBuildingMaterials() {
  const M = {};
  M.hull = patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.1 }), 'hull', {
    map: HULL_MAP, rough: 'float roughnessFactor = gR2;',
  });
  M.metal = patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.75 }), 'metal', {
    map: /* glsl */`
      vec4 bn = texture2D(tPanel, vec2(vOP.x + vOP.z, vOP.y * 0.4) * 0.6);
      float grime = smoothstep(1.0, -0.2, vOP.y) * 0.4;
      diffuseColor.rgb *= (0.85 + 0.3 * bn.b) * (1.0 - grime * 0.5);
      gR2 = 0.32 + bn.b * 0.25 + grime * 0.3;`,
    rough: 'float roughnessFactor = gR2;',
  });
  M.concrete = patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0.0 }), 'concrete', {
    map: /* glsl */`
      vec3 pin = panelInfo(vOP, normalize(vON), vec2(2.0, 2.0));
      vec4 nz = texture2D(tNoise, vOP.xz * 0.21 + vOP.y * 0.13);
      vec4 nz2 = texture2D(tNoise, vOP.xz * 0.04 + 0.3);
      vec3 c = diffuseColor.rgb * (0.86 + 0.18 * nz.a + 0.08 * pin.y) * (1.0 - smoothstep(0.55, 0.85, nz2.b) * 0.25);
      c *= 1.0 - pin.x * 0.35;
      float top = smoothstep(0.6, 0.95, normalize(vON).y);
      c = mix(c, vec3(0.4, 0.27, 0.18), top * uDustAmt * smoothstep(0.4, 0.75, nz2.r) * 0.5);
      diffuseColor.rgb = c;`,
  });
  M.glass = patch(new THREE.MeshStandardMaterial({ color: 0x0b1418, roughness: 0.05, metalness: 0.0, envMapIntensity: 1.4 }), 'glass', {
    map: '',
    emit: /* glsl */`
      vec3 cell = floor(vOP * vec3(1.1, 0.45, 1.1));
      float h = hash1(cell.xz + cell.y * 7.3 + vData.z * 11.0);
      float on = step(0.28, h) * vData.x;
      vec3 warm = mix(vec3(1.0, 0.72, 0.42), vec3(0.75, 0.9, 1.0), step(0.85, h));
      totalEmissiveRadiance += warm * on * (0.08 + 1.5 * uNight) * (0.6 + 0.5 * h);`,
  });
  M.window = new THREE.MeshStandardMaterial({ color: 0x8fb8c8, roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.22, depthWrite: false, envMapIntensity: 1.5, side: THREE.DoubleSide });
  M.window.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 iData;');
  };
  M.emissive = patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0, color: 0x000000 }), 'emissive', {
    map: 'vec3 ec = vColor;',
    emit: /* glsl */`
      float flick = 0.92 + 0.08 * sin(uTime * 3.0 + vData.z * 40.0);
      totalEmissiveRadiance += ec * vData.x * (0.6 + 2.6 * uNight) * flick * 2.0;`,
  });
  M.blink = patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0, color: 0x000000 }), 'blink', {
    map: 'vec3 ec = vColor;',
    emit: /* glsl */`
      float b = step(0.82, fract(uTime * 0.7 + vData.z * 3.0));
      totalEmissiveRadiance += ec * (0.4 + b * 8.0);`,
  });
  M.solar = patch(new THREE.MeshStandardMaterial({ color: 0x0a1a3a, roughness: 0.18, metalness: 0.6, envMapIntensity: 1.3 }), 'solar', {
    map: /* glsl */`
      vec2 g = vOP.xz / 0.32;
      vec2 f = abs(fract(g) - 0.5);
      float line = 1.0 - smoothstep(0.44, 0.47, max(f.x, f.y));
      diffuseColor.rgb = mix(vec3(0.75, 0.78, 0.82), vec3(0.02, 0.06, 0.16), line);
      float bus = 1.0 - smoothstep(0.015, 0.03, abs(fract(vOP.x / 0.32 + 0.5) - 0.5) * 0.32);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.6, 0.62, 0.66), bus * 0.4 * line);`,
  });
  M.interior = patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.0 }), 'interior', {
    map: /* glsl */`
      vec3 pin = panelInfo(vOP, normalize(vON), vec2(1.2, 1.2));
      diffuseColor.rgb *= (0.95 + 0.06 * pin.y) * (1.0 - pin.x * 0.25);`,
  });
  M.plant = patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.0 }), 'plant', {
    map: /* glsl */`
      float n = texture2D(tNoise, vOP.xz * 0.6 + vOP.y).g;
      diffuseColor.rgb *= 0.75 + 0.5 * n;`,
    emit: 'totalEmissiveRadiance += diffuseColor.rgb * 0.15 * vData.x;',
  });
  M.water = new THREE.MeshStandardMaterial({ color: 0x1b5e6e, roughness: 0.05, metalness: 0.2, envMapIntensity: 1.2 });
  M.water.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 iData;'); };
  return M;
}

// Animated variants are created on demand and cached.
const animCache = new Map();
export function animMaterial(M, key, anim) {
  const k = key + JSON.stringify(anim);
  if (animCache.has(k)) return animCache.get(k);
  const base = M[key];
  const m = base.clone();
  m.onBeforeCompile = base.onBeforeCompile;
  // rebuild the patch with ANIM defines
  const orig = base.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    orig(sh, r);
    sh.defines = sh.defines || {};
    if (anim.slide) {
      sh.defines.SLIDE = 1;
      sh.uniforms.uSlide = { value: new THREE.Vector3(...anim.slide) };
    } else {
      sh.defines.ANIM = 1;
      sh.uniforms.uPivot = { value: new THREE.Vector3(...anim.pivot) };
      sh.uniforms.uAxis = { value: new THREE.Vector3(...anim.axis) };
      sh.uniforms.uSpeed = { value: anim.speed };
    }
  };
  m.customProgramCacheKey = () => k;
  animCache.set(k, m);
  return m;
}

// Hologram material for placement previews (Satisfactory-style: blue valid / red invalid)
export function makeHologramMaterial() {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(0.3, 0.75, 1.0) }, uTime: U.uTime },
    vertexShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec3 vN; varying vec3 vW; varying vec3 vL;
      void main() {
        vL = position;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        vN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * w;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform vec3 uColor; uniform float uTime;
      varying vec3 vN; varying vec3 vW; varying vec3 vL;
      void main() {
        #include <logdepthbuf_fragment>
        vec3 V = normalize(cameraPosition - vW);
        float fr = pow(1.0 - abs(dot(normalize(vN), V)), 2.0);
        float scan = 0.5 + 0.5 * sin(vW.y * 9.0 - uTime * 5.0);
        float a = 0.16 + fr * 0.55 + scan * 0.07;
        gl_FragColor = vec4(uColor * (1.2 + fr * 1.8 + scan * 0.3), a);
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  });
  return mat;
}
