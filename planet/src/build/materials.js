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
uniform float uNight, uDustAmt, uTime, uRime;
float gRime = 0.0; float gGrime = 0.0;
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

// hoar frost after a cold night: on up-facing surfaces first, a dusting on
// walls, matte and white; it sublimates as the morning warms (uRime)
const RIME_F = /* glsl */`
#ifdef RIME
  {
    vec3 rn = normalize(vON);
    float r1 = texture2D(tNoise, vOP.xz * 0.9 + 0.17).g;
    float r2 = texture2D(tNoise, vOP.xy * 0.8 + vOP.zy * 0.6 + 0.41).b;
    float r3 = texture2D(tNoise, vOP.xz * 3.1 + vOP.y * 2.3).a;
    float up = smoothstep(0.35, 0.9, rn.y);
    float rime = up * smoothstep(0.42, 0.7, r1 * 0.7 + r3 * 0.3 + uRime * 0.25) * 0.6;
    rime += (1.0 - abs(rn.y)) * 0.14 * smoothstep(0.62, 0.85, r2 * 0.7 + r3 * 0.3);
    gRime = clamp(rime * uRime, 0.0, 0.6);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.84, 0.87, 0.91) * (0.95 + 0.1 * r3), gRime);
  }
#endif
`;
// weathering shared by every opaque building surface: tone variation at
// three scales, Mars dust settled on up-facing surfaces in blotches, a
// splash band near the ground, runoff streaks down walls, and a little
// micro relief; dust is matte, so it also kills gloss and metalness
const GRIME_F = /* glsl */`
#ifdef GRIME
  {
    vec3 gn = normalize(vON);
    vec2 gq = vOP.xz + vOP.zy * 0.7;
    float m1 = texture2D(tNoise, vOP.xz * 0.045 + vOP.y * 0.03 + vData.z * 3.0).r;
    float m2 = texture2D(tNoise, vOP.xz * 0.23 + vOP.zy * 0.19 + 0.31).g;
    float m3 = texture2D(tNoise, gq * 1.9 + 0.77).b;
    float m4 = texture2D(tNoise, gq * 7.3 + 0.13).a;
    float ff = 1.0 - smoothstep(0.25, 1.0, length(fwidth(gq)) * 5.0);
    float upf = smoothstep(0.2, 0.85, gn.y);
    float settled = upf * smoothstep(0.3, 0.72, m1 * 0.55 + m2 * 0.45 + uDustAmt * 0.2);
    float splash = smoothstep(1.2, 0.0, vOP.y) * (0.45 + 0.55 * m2);
    float streak = smoothstep(0.58, 0.86, texture2D(tNoise, vec2((vOP.x + vOP.z) * 0.55, vOP.y * 0.045 + 0.5)).r) * (1.0 - abs(gn.y));
    diffuseColor.rgb *= 0.9 + 0.13 * m1 + (0.07 * (m3 - 0.5) + 0.05 * (m4 - 0.5)) * ff;
    vec3 dustCol = vec3(0.55, 0.37, 0.25) * (0.85 + 0.3 * m3);
    float dk = clamp(settled * 0.8 + splash * 0.42 + streak * 0.2, 0.0, 0.88) * uDustAmt / 0.6;
    diffuseColor.rgb = mix(diffuseColor.rgb, dustCol, dk);
    gGrime = clamp(dk * 1.2, 0.0, 1.0);
    gH += ((m4 - 0.5) * 0.0012 + (m3 - 0.5) * 0.0008) * ff + settled * m4 * 0.0015;
  }
#endif
`;
const NO_GRIME = new Set(['glass', 'window', 'emissive', 'blink', 'mirror', 'solar', 'plant', 'foil', 'water']);
const NO_RIME = new Set(['glass', 'window', 'emissive', 'blink', 'mirror', 'solar']);

const SHARED_UNIFORMS = () => ({ tPanel: { value: TEX.panel }, tNoise: U.tNoise, uNight: U.uNight, uDustAmt: { value: 0 }, uTime: U.uTime, uRime: U.uRime });
export const BUILD_U = { uDustAmt: { value: 0.6 } };

function patch(mat, key, fragBody, { anim = null, slide = null, extraUniforms = {} } = {}) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, SHARED_UNIFORMS(), extraUniforms);
    sh.uniforms.uDustAmt = BUILD_U.uDustAmt;
    if (!NO_RIME.has(String(key).split(':')[0]) && !String(key).startsWith('asset')) { sh.defines = sh.defines || {}; sh.defines.RIME = 1; }
    if (!NO_GRIME.has(String(key).split(':')[0]) && !String(key).startsWith('asset')) { sh.defines = sh.defines || {}; sh.defines.GRIME = 1; }
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
      .replace('#include <map_fragment>', (mat.vertexColors ? '#ifdef USE_COLOR\n  diffuseColor.rgb *= vColor;\n#endif\n' : '') + (fragBody.map || '') + GRIME_F + RIME_F)
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, 0.0, max(gRime, gGrime * 0.8));')
      .replace('#include <color_fragment>', mat.vertexColors ? '' : '#include <color_fragment>')
      .replace('#include <roughnessmap_fragment>', (fragBody.rough || '#include <roughnessmap_fragment>') + '\nroughnessFactor = mix(mix(roughnessFactor, 0.93, gGrime), 0.85, gRime);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + (fragBody.emit || ''));
  };
  mat.customProgramCacheKey = () => key + (anim ? JSON.stringify(anim) : '') + (slide ? JSON.stringify(slide) : '');
  return mat;
}

const HULL_MAP = /* glsl */`
  // brushed aluminium cladding: silver base, fine brushed grain running along
  // each panel, per-panel reflectance and grain direction, crisp dark joints,
  // a breath of dust only at the very base
  gStagger = 0.0;
  vec3 pin = panelInfo(vOP, normalize(vON), vec2(1.8, 1.6));
  vec2 puv = panelUV(vOP, normalize(vON));
  float vert = step(0.5, fract(pin.y * 7.3));
  vec2 bu = mix(vec2(puv.x * 0.12, puv.y * 11.0), vec2(puv.x * 11.0, puv.y * 0.12), vert);
  float brush = texture2D(tNoise, bu + pin.y * 3.7).g;
  float brush2 = texture2D(tNoise, bu * 3.1 + pin.y * 1.3).a;
  vec3 baseC = diffuseColor.rgb * vec3(0.9, 0.93, 0.97);
  baseC *= 0.92 + 0.1 * pin.y + 0.06 * (brush - 0.5);
  vec4 nz = texture2D(tNoise, vOP.xz * 0.11 + vOP.y * 0.07 + vData.z);
  float low = smoothstep(0.7, 0.0, vOP.y) * (0.5 + 0.5 * nz.g);
  baseC = mix(baseC, baseC * vec3(0.8, 0.74, 0.68), low * 0.3);
  baseC *= 1.0 - pin.x * 0.55;
  gH = cladHeight(vOP, normalize(vON), vec2(1.8, 1.6), 0.004) + (brush2 - 0.5) * 0.0004 + 1e-6;
  diffuseColor.rgb = baseC;
  gR2 = clamp(0.2 + 0.1 * pin.y + 0.14 * brush2 + pin.x * 0.35 + low * 0.2, 0.0, 1.0);
`;

export function makeBuildingMaterials() {
  const M = {};
  M.hull = patch(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.28, metalness: 0.82, envMapIntensity: 1.35 }), 'hull', {
    map: HULL_MAP, rough: 'float roughnessFactor = gR2;',
  });
  // painted composite / beta-cloth module skin: matte white panels with fine
  // seams, slight panel-to-panel tone, scuffs and dust low down
  M.shell = patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.0, envMapIntensity: 0.85 }), 'shell', {
    map: /* glsl */`
      gStagger = 0.0;
      vec3 pin = panelInfo(vOP, normalize(vON), vec2(1.2, 1.0));
      vec4 nz = texture2D(tNoise, vOP.xz * 0.19 + vOP.y * 0.11 + vData.z);
      vec4 nz2 = texture2D(tNoise, vOP.xz * 0.9 + vOP.zy * 0.7);
      vec3 c = diffuseColor.rgb * 0.86 * (0.95 + 0.06 * pin.y + 0.03 * (nz.r - 0.5));
      c *= 1.0 - pin.x * 0.38;
      float low = smoothstep(1.0, 0.0, vOP.y) * (0.5 + 0.5 * nz.g);
      c = mix(c, c * vec3(0.8, 0.72, 0.64), low * 0.35);
      float scuff = smoothstep(0.78, 0.92, nz2.b) * 0.12;
      c *= 1.0 - scuff;
      float up = smoothstep(0.55, 0.95, normalize(vON).y);
      c = mix(c, vec3(0.62, 0.46, 0.34), up * uDustAmt * 0.3 * smoothstep(0.35, 0.7, nz.a));
      gH = cladHeight(vOP, normalize(vON), vec2(1.2, 1.0), 0.003) + 1e-6;
      diffuseColor.rgb = c;
      gR2 = clamp(0.55 + 0.1 * pin.y + scuff + low * 0.2, 0.0, 1.0);`,
    rough: 'float roughnessFactor = gR2;',
  });
  // trapezoidal ribbed metal cladding (industrial sheds, roofs)
  // standing-seam metal cladding: wide smooth pans with thin raised seams,
  // metallic and glossy (sheds, roofs)
  M.rib = patch(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.8, envMapIntensity: 1.35 }), 'rib', {
    map: /* glsl */`
      gStagger = 0.0;
      vec2 ruv = panelUV(vOP, normalize(vON));
      float sp = abs(fract(ruv.x / 0.6) - 0.5) * 0.6;
      float fadeR = 1.0 - smoothstep(0.3, 0.9, fwidth(ruv.x / 0.6) * 3.0);
      gH = smoothstep(0.27, 0.295, sp) * 0.012 * fadeR + 1e-6;
      vec4 nz = texture2D(tNoise, vOP.xz * 0.09 + vOP.y * 0.05 + vData.z);
      vec3 c = diffuseColor.rgb * 0.85 * (0.97 + 0.05 * nz.r);
      float low = smoothstep(0.9, 0.0, vOP.y);
      c = mix(c, c * vec3(0.85, 0.8, 0.75), low * 0.3);
      diffuseColor.rgb = c;
      gR2 = clamp(0.26 + 0.06 * nz.g + low * 0.15, 0.0, 1.0);`,
    rough: 'float roughnessFactor = gR2;',
  });
  M.metal = patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.75 }), 'metal', {
    map: /* glsl */`
      vec4 bn = texture2D(tPanel, vec2(vOP.x + vOP.z, vOP.y * 0.4) * 0.6);
      float grime = smoothstep(0.6, -0.4, vOP.y) * 0.3;
      diffuseColor.rgb *= (0.92 + 0.12 * bn.b) * (1.0 - grime * 0.4);
      gH = panelHeight(vOP, normalize(vON), vec2(1.1, 0.7), 0.006) + bn.b * 0.002 + 1e-6;
      gR2 = 0.22 + bn.b * 0.14 + grime * 0.25;`,
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
        vec3 p0 = vOP / cs + d * 0.03;               // start just inside the room
        vec3 id = floor(p0);
        vec3 f = p0 - id;
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
        vec3 rad = c * ao * (day * 0.32 + uNight * lit * warm * 0.8) + lamp * (day * 0.25 + uNight * lit * 3.0) * warm;
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
  // gold Kapton multi-layer insulation on avionics boxes and tanks:
  // crinkled foil, mirror-bright where it faces you, dark in the creases
  M.foil = patch(new THREE.MeshStandardMaterial({ vertexColors: true, color: 0xffffff, metalness: 1.0, roughness: 0.28, envMapIntensity: 1.6 }), 'foil', {
    map: /* glsl */`
      vec4 n1 = texture2D(tNoise, vOP.xy * 1.7 + vOP.z * 1.3 + vData.z);
      vec4 n2 = texture2D(tNoise, vOP.zy * 4.1 + vOP.x * 0.7);
      float cr = n1.g * 0.6 + n2.a * 0.4;
      diffuseColor.rgb *= 0.75 + 0.45 * cr;
      gH = cr * 0.02 + 1e-6;
      gR2 = 0.18 + 0.3 * (1.0 - cr);`,
    rough: 'float roughnessFactor = gR2;',
  });
  // stainless steel like the ships: ring welds every 1.8 m, faint vertical
  // panel seams, heat tint along the welds, streaks in the brushing, red dust
  // low down
  M.steel = patch(new THREE.MeshPhysicalMaterial({ vertexColors: true, color: 0xffffff, metalness: 0.95, roughness: 0.3, envMapIntensity: 1.45 }), 'steel', {
    map: /* glsl */`
      float ring = vOP.y / 1.8;
      float seamY = 1.0 - smoothstep(0.0, 0.02, abs(fract(ring) - 0.5) - 0.48);
      float pv = (vOP.x * 0.83 + vOP.z * 0.56) / 2.3;
      float seamX = 1.0 - smoothstep(0.0, 0.015, abs(fract(pv) - 0.5) - 0.485);
      float fade = 1.0 - smoothstep(0.25, 0.8, length(fwidth(vec2(ring, pv))) * 3.0);
      vec4 nz = texture2D(tNoise, vec2(vOP.x * 0.4 + vOP.z * 0.4, vOP.y * 2.2) + vData.z);
      float panel = hash1(vec2(floor(ring), floor(pv)) + vData.z * 5.0);
      vec3 c = diffuseColor.rgb * (0.9 + 0.1 * panel) * (0.95 + 0.08 * nz.g);
      float heat = smoothstep(0.42, 0.5, abs(fract(ring) - 0.5)) * fade;
      c = mix(c, c * vec3(0.92, 0.86, 0.74), heat * 0.6);
      c *= 1.0 - max(seamY, seamX * 0.5) * 0.4 * fade;
      float low = smoothstep(1.4, 0.0, vOP.y) * (0.5 + 0.5 * nz.r);
      c = mix(c, c * vec3(0.75, 0.6, 0.48), low * 0.45);
      diffuseColor.rgb = c;
      gH = -seamY * 0.004 * fade + 1e-6;
      gR2 = clamp(0.22 + 0.12 * panel + 0.1 * nz.b + low * 0.3, 0.0, 1.0);`,
    rough: 'float roughnessFactor = gR2;',
  });
  // heat-shield tiles like the ships' belly: black hexagons with pale gaps
  M.tiles = patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0.05 }), 'tiles', {
    map: /* glsl */`
      vec2 tp = vec2(vOP.x * 0.8 + vOP.z * 0.6, vOP.y) / 0.62;
      vec2 hr = vec2(1.0, 1.7320508), hh = hr * 0.5;
      vec2 ha = mod(tp, hr) - hh, hb = mod(tp - hh, hr) - hh;
      vec2 gv = dot(ha, ha) < dot(hb, hb) ? ha : hb;
      vec2 id = tp - gv, ag = abs(gv);
      float hd = max(dot(ag, vec2(0.5, 0.8660254)), ag.x);
      float gap = smoothstep(0.455, 0.49, hd) * (1.0 - smoothstep(0.3, 1.0, fwidth(tp.x) * 2.0));
      float rnd = hash1(id);
      vec3 tc = vec3(0.055, 0.056, 0.06) * (0.85 + 0.3 * rnd);
      tc = mix(tc, vec3(0.62, 0.6, 0.57), step(0.996, rnd));
      diffuseColor.rgb = mix(tc, vec3(0.32, 0.32, 0.33), gap);
      gH = (1.0 - gap) * 0.004 + 1e-6;`,
  });
  // mirror curtain wall (NEOM-style): reflective glass, a faint grid of
  // spandrel lines and per-floor tint variation; at night some floors glow
  M.mirror = patch(new THREE.MeshPhysicalMaterial({ vertexColors: true, color: 0x86a8c6, roughness: 0.05, metalness: 0.88, envMapIntensity: 1.5, clearcoat: 0.6, clearcoatRoughness: 0.05 }), 'mirror', {
    map: /* glsl */`
      float fy = vOP.y / 3.6;
      float hz = abs(vOP.x) + abs(vOP.z);
      float fx = (vOP.x + vOP.z * 1.37) / 1.5;
      float lineY = 1.0 - smoothstep(0.0, 0.035, abs(fract(fy) - 0.06));
      float lineX = 1.0 - smoothstep(0.0, 0.05, abs(fract(fx) - 0.5) - 0.47);
      float fade = 1.0 - smoothstep(0.3, 0.9, length(fwidth(vec2(fy, fx))) * 2.0);
      float tint = hash1(vec2(floor(fy), floor(fx)) + vData.z * 9.0);
      diffuseColor.rgb *= (0.9 + 0.12 * tint) * (1.0 - 0.45 * max(lineY, lineX * 0.6) * fade);
      gR2 = 0.05 + 0.06 * tint + lineY * 0.2;`,
    rough: 'float roughnessFactor = gR2;',
    emit: /* glsl */`
      {
        float fy2 = vOP.y / 3.6, fx2 = (vOP.x + vOP.z * 1.37) / 1.5;
        float r = hash1(vec2(floor(fy2), floor(fx2 * 0.5)) + vData.z * 3.0);
        float win = step(0.12, fract(fy2)) * step(fract(fy2), 0.92);
        totalEmissiveRadiance += vec3(1.0, 0.82, 0.6) * step(0.45, r) * win * uNight * vData.x * 0.55;
        // a sky gradient caught in the glass, strongest at grazing angles, so the
        // towers read as glass even when the real sky is dull
        vec3 Vv = normalize(vViewPosition);
        vec3 Rw = inverseTransformDirection(reflect(-Vv, normal), viewMatrix);
        float fres = pow(1.0 - clamp(dot(normal, Vv), 0.0, 1.0), 3.0);
        vec3 skyR = mix(vec3(0.78, 0.84, 0.9), vec3(0.16, 0.3, 0.55), smoothstep(-0.05, 0.6, Rw.y));
        skyR = mix(vec3(0.22, 0.17, 0.14), skyR, smoothstep(-0.25, 0.0, Rw.y));
        totalEmissiveRadiance += skyR * (0.12 + 0.5 * fres) * (1.0 - uNight * 0.85);
      }`,
  });
  // multi-layer insulation: white beta-cloth blanket, quilted in pillowed
  // cells with darker stitch lines, cloth sheen varying cell to cell, red dust
  // settling on the lower curve
  M.mli = patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.0 }), 'mli', {
    map: /* glsl */`
      vec3 nn = normalize(vON);
      vec2 uv = abs(nn.y) > 0.92 ? vOP.xz : vec2(vOP.x + vOP.z * 0.0, atan(vOP.y, vOP.z) * 2.0);
      if (abs(nn.x) > 0.6) uv = vOP.zy;
      vec2 cell = vec2(0.62, 0.55);
      vec2 q = uv / cell, f = fract(q) - 0.5;
      float fw = length(fwidth(q));
      float fade = 1.0 - smoothstep(0.25, 0.7, fw);
      float stitch = max(smoothstep(0.455, 0.5, abs(f.x)), smoothstep(0.455, 0.5, abs(f.y))) * fade;
      float hc = hash1(floor(q) + vData.z * 7.0);
      vec4 nz = texture2D(tNoise, vOP.xz * 0.09 + vOP.y * 0.13 + vData.z);
      vec3 c = diffuseColor.rgb * (0.9 + 0.08 * hc) * (1.0 - stitch * 0.22);
      float low = smoothstep(0.1, -0.7, nn.y) * 0.5 + smoothstep(1.6, 0.0, vOP.y) * 0.4;
      c = mix(c, c * vec3(0.78, 0.62, 0.5), clamp(low * (0.4 + 0.6 * nz.g), 0.0, 1.0) * 0.55);
      diffuseColor.rgb = c;
      gH = (0.5 - dot(f, f) * 2.0) * 0.014 * fade + 1e-6;
      gR2 = 0.62 + 0.18 * hc + stitch * 0.1;`,
    rough: 'float roughnessFactor = gR2;',
  });
  // sintered regolith, printed in layers: fine horizontal beads a few cm
  // apart, slight wander between passes, warm iron-oxide colour, dust on top
  M.regolith = patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0.0 }), 'regolith', {
    map: /* glsl */`
      vec4 nz = texture2D(tNoise, vOP.xz * 0.17 + vOP.y * 0.05 + vData.z);
      vec4 nz2 = texture2D(tNoise, vOP.xz * 0.6 + vOP.y * 0.4);
      float layer = vOP.y / 0.045 + (nz.r - 0.5) * 0.6;
      float bead = abs(fract(layer) - 0.5) * 2.0;
      float fade = 1.0 - smoothstep(0.4, 1.2, fwidth(layer));
      vec3 c = diffuseColor.rgb * (0.86 + 0.16 * nz.g + 0.08 * nz2.a);
      c *= 1.0 - 0.12 * (1.0 - bead) * fade;
      float up = smoothstep(0.5, 0.95, normalize(vON).y);
      c = mix(c, c * vec3(1.08, 0.98, 0.9), up * 0.5);
      diffuseColor.rgb = c;
      gH = bead * 0.006 * fade + nz2.a * 0.004 + 1e-6;
      gR2 = 0.88 + 0.08 * nz.b;`,
    rough: 'float roughnessFactor = gR2;',
  });
  // Masonry for the towns built after the air is breathable. Both work in
  // object space on the face's own axes (panelUV), fade to the average colour
  // when the pattern is too fine to resolve, and carry their joints as bump.
  // brick: modular US brick in running bond (203 x 57 mm + 10 mm joints),
  // per-brick tone, a few flashed headers, recessed light mortar
  M.brick = patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0.0 }), 'brick', {
    map: /* glsl */`
      vec2 buv = panelUV(vOP, normalize(vON));
      vec2 bm = vec2(0.213, 0.067);
      float brow = floor(buv.y / bm.y);
      vec2 bq = vec2(buv.x / bm.x + mod(brow, 2.0) * 0.5, buv.y / bm.y);
      vec2 bf = fract(bq), bid = floor(bq), bfw = fwidth(bq);
      float bjx = 1.0 - smoothstep(0.047, 0.047 + bfw.x * 1.5, bf.x);
      float bjy = 1.0 - smoothstep(0.15, 0.15 + bfw.y * 1.5, bf.y);
      float bj = max(bjx, bjy);
      float bfar = smoothstep(0.22, 0.55, max(bfw.x, bfw.y));
      float bh = hash1(bid + floor(vData.z * 31.0));
      vec3 bc = diffuseColor.rgb * (0.8 + 0.34 * bh);
      bc = mix(bc, bc * vec3(0.62, 0.6, 0.66), step(0.93, bh));
      vec3 mortar = vec3(0.66, 0.63, 0.58);
      vec4 bnz = texture2D(tNoise, vOP.xz * 0.13 + vOP.y * 0.09 + vData.z);
      vec3 c = mix(mix(bc, mortar, bj * 0.92), diffuseColor.rgb * 0.95 + mortar * 0.05, bfar);
      c *= 0.9 + 0.14 * bnz.g;
      float blow = smoothstep(0.8, 0.0, vOP.y) * (0.5 + 0.5 * bnz.r);
      c = mix(c, c * vec3(0.8, 0.76, 0.72), blow * 0.35);
      diffuseColor.rgb = c;
      gH = (1.0 - bj) * 0.005 * (1.0 - bfar) + 1e-6;
      gR2 = 0.82 + 0.12 * bh;`,
    rough: 'float roughnessFactor = gR2;',
  });
  // stone: coursed limestone ashlar (1.2 x 0.45 m blocks, thin joints),
  // gentle block-to-block tone and soft weathering streaks
  M.stone = patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.0 }), 'stone', {
    map: /* glsl */`
      vec2 suv = panelUV(vOP, normalize(vON));
      vec2 sm = vec2(1.2, 0.45);
      float srow = floor(suv.y / sm.y);
      vec2 sq = vec2(suv.x / sm.x + mod(srow, 2.0) * 0.5, suv.y / sm.y);
      vec2 sf = fract(sq), sid = floor(sq), sfw = fwidth(sq);
      float sjx = 1.0 - smoothstep(0.006, 0.006 + sfw.x * 1.5, min(sf.x, 1.0 - sf.x));
      float sjy = 1.0 - smoothstep(0.016, 0.016 + sfw.y * 1.5, min(sf.y, 1.0 - sf.y));
      float sj = max(sjx, sjy);
      float sfar = smoothstep(0.08, 0.25, max(sfw.x, sfw.y));
      float sh = hash1(sid + floor(vData.z * 13.0));
      vec4 snz = texture2D(tNoise, vOP.xz * 0.3 + vOP.y * 0.21);
      vec4 snz2 = texture2D(tNoise, vec2(suv.x * 0.35, suv.y * 0.04));
      vec3 c = diffuseColor.rgb * (0.93 + 0.1 * sh + 0.06 * snz.a);
      c *= 1.0 - sj * 0.28 * (1.0 - sfar);
      float streak = smoothstep(0.6, 0.9, snz2.g) * (1.0 - abs(normalize(vON).y));
      c *= 1.0 - streak * 0.12;
      diffuseColor.rgb = c;
      gH = (1.0 - sj) * 0.004 * (1.0 - sfar) + snz.a * 0.002 + 1e-6;
      gR2 = 0.78 + 0.1 * snz.b;`,
    rough: 'float roughnessFactor = gR2;',
  });
  // light shafts from floodlights, seen in dusty night air: additive cones,
  // brightest at the lamp and fading along the beam and toward the edges;
  // only when the building is powered and it is dark (uHaze from the dust)
  M.beam = new THREE.ShaderMaterial({
    uniforms: { uNight: U.uNight, uHaze: { value: 0.6 } },
    vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: '#include <common>\n#include <logdepthbuf_pars_vertex>\n' + /* glsl */`
      attribute vec3 iData;
      varying float vPow, vAlong; varying vec3 vN, vV, vCol;
      void main() {
        mat4 im = mat4(1.0);
        vPow = 1.0;
#ifdef USE_INSTANCING
        im = instanceMatrix; vPow = iData.x;
#endif
        vec4 mv = modelViewMatrix * im * vec4(position, 1.0);
        vN = normalize(mat3(modelViewMatrix) * mat3(im) * normal);
        vV = -mv.xyz; vAlong = uv.y;
#ifdef USE_COLOR
        vCol = color;
#else
        vCol = vec3(1.0);
#endif
        gl_Position = projectionMatrix * mv;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: '#include <common>\n#include <logdepthbuf_pars_fragment>\n' + /* glsl */`
      uniform float uNight, uHaze;
      varying float vPow, vAlong; varying vec3 vN, vV, vCol;
      void main() {
        #include <logdepthbuf_fragment>
        float edge = abs(dot(normalize(vN), normalize(vV)));
        float a = pow(clamp(vAlong, 0.0, 1.0), 2.2) * pow(edge, 2.6) * smoothstep(0.2, 0.7, uNight) * vPow * 0.11 * uHaze;
        gl_FragColor = vec4(vCol, a);
      }`,
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

// Materials for real hardware models (assets.js): their own texture with the
// AO it was baked with, plus the same Mars weathering as everything else:
// dust settled on up-facing surfaces, a dirty band at the base, slight
// sun-fade on the paint. Instancing data, ANIM and SLIDE work as for the rest.
const ASSET_MAP = /* glsl */`
  #include <map_fragment>
  vec4 nzA = texture2D(tNoise, vOP.xz * 0.13 + vOP.y * 0.04 + vData.z);
  vec4 nzB = texture2D(tNoise, vOP.xz * 0.9 + vOP.zy * 0.35);
  float upA = clamp(normalize(vON).y, 0.0, 1.0);
  float lowA = smoothstep(1.6, 0.0, vOP.y) * (0.45 + 0.55 * nzA.g);
  float dustA = clamp((upA * upA * 0.42 * (0.45 + 0.9 * nzA.r) + lowA * 0.55) * (0.75 + 0.5 * nzB.b) * uDustAmt / 0.6, 0.0, 0.85);
  vec3 paintA = diffuseColor.rgb * vec3(0.95, 0.93, 0.9) * (0.94 + 0.08 * nzB.g);
  diffuseColor.rgb = mix(paintA, vec3(0.6, 0.43, 0.31) * (0.82 + 0.3 * nzA.b), dustA);
  gR2 = clamp(roughness + dustA * 0.35, 0.0, 1.0);
`;
const assetCache = new Map();
export function assetMaterial(src, anim = null) {
  const k = src.uuid + (anim ? JSON.stringify(anim) : '');
  if (assetCache.has(k)) return assetCache.get(k);
  const m = patch(src.clone(), 'asset:' + src.name, { map: ASSET_MAP, rough: 'float roughnessFactor = gR2;' }, anim && anim.slide ? { slide: anim.slide } : { anim });
  m.envMapIntensity = 0.9;
  assetCache.set(k, m);
  return m;
}
