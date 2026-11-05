// Building material library. Every material reads per-instance iData
// (x = powered/lit, y = activity for animation, z = random seed) and adds
// procedural surface detail in object space so detail stays attached to the
// building: panel seams, per-panel tint, grime at the base, dust on roofs.
import * as THREE from 'three';
import { U } from '../core/shared.js';
import { TEX } from '../world/texstore.js';

const HEAD_V = /* glsl */`
attribute vec3 iData;
attribute vec3 aPan;
varying vec3 vOP; varying vec3 vON; varying vec3 vWP2; varying vec3 vData; varying vec3 vPan;
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
  vOP = transformed; vON = objectNormal; vPan = aPan;
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
varying vec3 vOP; varying vec3 vON; varying vec3 vWP2; varying vec3 vData; varying vec3 vPan;
uniform sampler2D tPanel, tNoise;
uniform float uNight, uDustAmt, uTime;
float hash1(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec3 gN2; float gR2; float gH = 0.0; float gBumpK = 1.0; float gStagger = 0.5;
`;

// object-space panel pattern -> (seam mask, panel hash, uv)
const PANEL_FN = /* glsl */`
vec2 panelUV(vec3 p, vec3 n) {
  if (vPan.z > 0.5) return vPan.xy;
  vec3 a = abs(n);
  return a.x > a.y && a.x > a.z ? p.zy : (a.y > a.z ? p.xz : p.xy);
}
vec3 panelInfo(vec3 p, vec3 n, vec2 size) {
  vec2 uv = panelUV(p, n);
  float row = floor(uv.y / size.y);
  uv.x += row * size.x * gStagger;
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

// relief detail: panel grooves, corner rivets and occasional recessed hatches
const BUMP_FN = /* glsl */`
// architectural cladding: only the recessed joints
float cladHeight(vec3 p, vec3 n, vec2 size, float depth) {
  vec2 uv = panelUV(p, n);
  uv.x += floor(uv.y / size.y) * size.x * gStagger;
  vec2 d = size * 0.5 - abs(fract(uv / size) - 0.5) * size;
  float fade = 1.0 - smoothstep(0.5, 1.4, length(fwidth(uv)) * 40.0);
  return smoothstep(0.004, 0.02, min(d.x, d.y)) * depth * fade;
}
float panelHeight(vec3 p, vec3 n, vec2 size, float depth) {
  vec2 uv = panelUV(p, n);
  float row = floor(uv.y / size.y);
  uv.x += row * size.x * 0.5;
  vec2 q = uv / size;
  vec2 f = abs(fract(q) - 0.5) * size;
  vec2 d = size * 0.5 - f;
  float edge = min(d.x, d.y);
  float h = smoothstep(0.003, 0.028, edge) * depth;
  vec2 c = size * 0.5 - vec2(0.075);
  h += (1.0 - smoothstep(0.011, 0.02, length(f - c))) * depth * 0.55;
  float hs = hash1(floor(q) + 3.7 + floor(vData.z * 13.0));
  if (hs > 0.7) { float e2 = min(d.x - size.x * 0.16, d.y - size.y * 0.18); h -= smoothstep(-0.008, 0.008, e2) * depth * 0.8; }
  float fade = 1.0 - smoothstep(0.5, 1.4, length(fwidth(uv)) * 40.0);
  return h * fade;
}
vec3 bumpN(vec3 n, vec3 pos, float h, float k) {
  vec3 dpx = dFdx(pos), dpy = dFdy(pos);
  float dhx = dFdx(h), dhy = dFdy(h);
  vec3 r1 = cross(dpy, n), r2 = cross(n, dpx);
  float det = dot(dpx, r1);
  vec3 grad = sign(det) * (dhx * r1 + dhy * r2);
  return normalize(abs(det) * n - grad * k);
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
      .replace('#include <common>', '#include <common>\n' + HEAD_V + (fragBody.vhead || ''))
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n' + BODY_N)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + BODY_V + (fragBody.vbody || ''));
    // objectNormal is defined before begin_vertex (beginnormal_vertex), so ANIM can rotate it.
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + HEAD_F + (fragBody.fhead || '') + PANEL_FN + BUMP_FN)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nif (gH != 0.0) normal = bumpN(normal, -vViewPosition, gH, gBumpK);')
      .replace('#include <map_fragment>', (mat.vertexColors ? '#ifdef USE_COLOR\n  diffuseColor.rgb *= vColor;\n#endif\n' : '') + (fragBody.map || ''))
      .replace('#include <color_fragment>', mat.vertexColors ? '' : '#include <color_fragment>')
      .replace('#include <roughnessmap_fragment>', fragBody.rough || '#include <roughnessmap_fragment>')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + (fragBody.emit || ''));
  };
  mat.customProgramCacheKey = () => key + (anim ? JSON.stringify(anim) : '') + (slide ? JSON.stringify(slide) : '');
  return mat;
}

const HULL_MAP = /* glsl */`
  // painted composite / aluminium cladding: realistic albedo, crisp joints,
  // per-panel tone and gloss, soft dust where it settles
  gStagger = 0.0;
  vec3 pin = panelInfo(vOP, normalize(vON), vec2(1.8, 1.6));
  vec3 baseC = diffuseColor.rgb * 0.8;
  baseC *= 0.975 + 0.04 * pin.y;
  vec4 nz = texture2D(tNoise, vOP.xz * 0.11 + vOP.y * 0.07 + vData.z);
  float streak = texture2D(tNoise, vec2(vOP.x * 0.9 + vOP.z * 0.9, vOP.y * 0.06) + vData.z).g;
  float grime = smoothstep(1.2, -0.2, vOP.y) * 0.45 + smoothstep(0.62, 0.92, streak) * 0.12 + smoothstep(0.68, 0.95, nz.b) * 0.06;
  float top = smoothstep(0.6, 0.95, normalize(vON).y);
  baseC = mix(baseC, baseC * vec3(0.8, 0.74, 0.68), clamp(grime, 0.0, 1.0) * 0.55);
  baseC = mix(baseC, vec3(0.42, 0.3, 0.22), top * uDustAmt * smoothstep(0.4, 0.75, nz.r) * 0.35);
  float lowDust = smoothstep(1.4, 0.0, vOP.y) * (0.45 + 0.4 * nz.g);
  baseC = mix(baseC, vec3(0.4, 0.28, 0.2), clamp(lowDust * (0.18 + uDustAmt * 0.2), 0.0, 0.35));
  baseC *= 1.0 - pin.x * 0.28;
  gH = cladHeight(vOP, normalize(vON), vec2(1.8, 1.6), 0.005) + 1e-6;
  diffuseColor.rgb = baseC;
  gR2 = clamp(0.34 + 0.1 * pin.y + grime * 0.25 + top * uDustAmt * 0.3 + lowDust * 0.12 + pin.x * 0.3, 0.0, 1.0);
`;

export function makeBuildingMaterials() {
  const M = {};
  M.hull = patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.1 }), 'hull', {
    map: HULL_MAP, rough: 'float roughnessFactor = gR2;',
  });
  // trapezoidal ribbed metal cladding (industrial sheds, roofs)
  M.rib = patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.35 }), 'rib', {
    map: /* glsl */`
      gStagger = 0.0;
      vec2 ruv = panelUV(vOP, normalize(vON));
      float rp = fract(ruv.x / 0.32);
      float fadeR = 1.0 - smoothstep(0.3, 0.9, fwidth(ruv.x / 0.32) * 2.0);
      gH = (smoothstep(0.0, 0.1, rp) - smoothstep(0.38, 0.48, rp)) * 0.03 * fadeR + 1e-6;
      vec4 nz = texture2D(tNoise, vOP.xz * 0.09 + vOP.y * 0.05 + vData.z);
      float streak = texture2D(tNoise, vec2(ruv.x * 0.3, vOP.y * 0.05) + vData.z).g;
      vec3 c = diffuseColor.rgb * 0.8 * (0.95 + 0.08 * nz.r);
      float grime = smoothstep(1.4, -0.1, vOP.y) * 0.4 + smoothstep(0.6, 0.9, streak) * 0.15;
      c = mix(c, c * vec3(0.78, 0.72, 0.66), clamp(grime, 0.0, 1.0) * 0.5);
      float top = smoothstep(0.6, 0.95, normalize(vON).y);
      c = mix(c, vec3(0.42, 0.3, 0.22), top * uDustAmt * smoothstep(0.35, 0.75, nz.b) * 0.35);
      diffuseColor.rgb = c;
      gR2 = clamp(0.42 + grime * 0.25 + top * 0.15, 0.0, 1.0);`,
    rough: 'float roughnessFactor = gR2;',
  });
  M.metal = patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.75 }), 'metal', {
    map: /* glsl */`
      vec4 bn = texture2D(tPanel, vec2(vOP.x + vOP.z, vOP.y * 0.4) * 0.6);
      float grime = smoothstep(1.0, -0.2, vOP.y) * 0.4;
      diffuseColor.rgb *= (0.85 + 0.3 * bn.b) * (1.0 - grime * 0.5);
      gH = panelHeight(vOP, normalize(vON), vec2(1.1, 0.7), 0.008) + bn.b * 0.004 + 1e-6;
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
      gH = panelHeight(vOP, normalize(vON), vec2(2.0, 2.0), 0.016) + nz.a * 0.006 + 1e-6;
      diffuseColor.rgb = c;`,
  });
  // Glazing: dark reflective glass (env reflections + fresnel come from the
  // standard model) over fake rooms ray-cast in object space (interior
  // mapping): floor, ceiling with a light panel, walls with furniture,
  // some windows with blinds. Rooms are 3.6 x 3.2 x 3.6 m, aligned to floors.
  M.glass = patch(new THREE.MeshStandardMaterial({ color: 0x060708, roughness: 0.05, metalness: 0.0, envMapIntensity: 1.0 }), 'glass', {
    vhead: 'varying vec3 vCamL;',
    vbody: /* glsl */`
#ifdef USE_INSTANCING
      vCamL = (inverse(modelMatrix * instanceMatrix) * vec4(cameraPosition, 1.0)).xyz;
#else
      vCamL = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;
#endif`,
    fhead: 'varying vec3 vCamL;',
    map: 'diffuseColor.rgb = vec3(0.012, 0.014, 0.016);',
    emit: /* glsl */`
      {
        vec3 rd = normalize(vOP - vCamL);
        vec3 cs = vec3(3.6, 3.2, 3.6);
        vec3 d = rd / cs;
        d = sign(d) * max(abs(d), vec3(1e-4));
        vec3 ro = vOP / cs;
        vec3 id = floor(ro + d * 0.03);
        vec3 f = ro - id;
        vec3 tt = (step(vec3(0.0), d) - f) / d;
        float t = min(tt.x, min(tt.y, tt.z));
        vec3 h = clamp(f + d * t, 0.0, 1.0);
        float seed = floor(vData.z * 40.0);
        float rh = hash1(id.xz * 1.7 + id.y * 9.1 + seed);
        float rh2 = hash1(id.xz * 3.1 + id.y * 2.3 + 5.0 + seed);
        vec3 wallC = rh < 0.3 ? vec3(0.6, 0.55, 0.48) : rh < 0.55 ? vec3(0.52, 0.54, 0.55) : rh < 0.8 ? vec3(0.64, 0.6, 0.52) : vec3(0.4, 0.46, 0.5);
        vec3 c; float isCeil = 0.0; float edge;
        if (t == tt.y) {
          if (d.y < 0.0) c = (rh2 < 0.5 ? vec3(0.3, 0.2, 0.13) : vec3(0.24, 0.24, 0.25)) * (0.85 + 0.15 * hash1(floor(h.xz * vec2(9.0, 2.0)) + rh));
          else { c = vec3(0.7); isCeil = 1.0; }
          edge = min(min(h.x, 1.0 - h.x), min(h.z, 1.0 - h.z));
        } else {
          c = wallC;
          float u = t == tt.x ? h.z : h.x;
          edge = min(min(u, 1.0 - u), min(h.y, 1.0 - h.y) * 1.6);
          if (h.y < 0.27 && fract(u * 1.7 + rh2) < 0.5 && rh2 > 0.2) c = mix(vec3(0.1, 0.09, 0.085), vec3(0.32, 0.22, 0.17), rh2);
          else if (h.y > 0.45 && h.y < 0.66 && abs(fract(u * 1.3 + rh) - 0.5) < 0.1) c *= 0.5 + 0.6 * vec3(rh, rh2, 1.0 - rh);
        }
        float ao = 0.55 + 0.45 * smoothstep(0.0, 0.18, edge);
        float lit = step(0.35, rh) * vData.x;
        float lamp = isCeil * (1.0 - smoothstep(0.1, 0.13, max(abs(h.x - 0.5), abs(h.z - 0.5) * 0.5)));
        float day = 1.0 - uNight;
        vec3 warm = mix(vec3(1.0, 0.78, 0.55), vec3(0.85, 0.92, 1.0), step(0.85, rh2));
        vec3 rad = c * ao * (day * 0.2 + uNight * lit * warm * 0.8) + lamp * (day * 0.25 + uNight * lit * 3.0) * warm;
        // blinds on some windows, drawn down from the head
        vec3 pid = floor(vOP / cs + vec3(0.0, 0.0, 0.0));
        float rb = hash1(pid.xz * 5.3 + pid.y * 1.9 + seed + 11.0);
        float fy = fract(vOP.y / cs.y);
        float bl = step(0.55, rb) * step(mix(0.82, 0.45, hash1(pid.xz + pid.y + 3.0)), fy);
        vec3 blind = vec3(0.62, 0.6, 0.55) * (0.85 + 0.15 * step(0.5, fract(vOP.y * 22.0))) * (day * 0.45 + uNight * lit * 0.7);
        rad = mix(rad, blind, bl);
        float cosv = abs(dot(normalize(vON), rd));
        float F = 0.04 + 0.96 * pow(1.0 - cosv, 5.0);
        totalEmissiveRadiance += rad * vec3(0.8, 0.85, 0.86) * (1.0 - F);
      }`,
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
      diffuseColor.rgb *= (0.95 + 0.06 * pin.y) * (1.0 - pin.x * 0.25);
      gH = panelHeight(vOP, normalize(vON), vec2(1.2, 1.2), 0.008) + 1e-6;`,
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
        float a = 0.07 + fr * 0.4 + scan * 0.04;
        gl_FragColor = vec4(uColor * (0.45 + fr * 1.1 + scan * 0.15), a);
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  });
  return mat;
}
