// Material library. Blender exports named material slots; here each name
// becomes a PBR material with the baked texture sets. A small shader patch
// adds ground grime and rain wetness to every surface.
import * as THREE from 'three';
import { tex } from './assets.js';
import * as art from './art.js';

export const globals = {
  uWet: { value: 0 },        // 0 dry .. 1 soaked
  uNight: { value: 0 },      // lit windows
  uDayLum: { value: 1 },     // daylight reaching into rooms behind glass
  uTime: { value: 0 },
};

function patch(mat, opts = {}) {
  const grime = opts.grime ?? 1;
  const wetUp = opts.wet ?? 1;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uWet = globals.uWet;
    sh.uniforms.uGrime = { value: grime };
    sh.uniforms.uWetK = { value: wetUp };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNrm;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        {
          vec4 wp = vec4(transformed, 1.0);
          vec3 wn = objectNormal;
          #ifdef USE_INSTANCING
            wp = instanceMatrix * wp;
            wn = mat3(instanceMatrix) * wn;
          #endif
          #ifdef USE_SKINNING
            wn = vec3(0.0, 1.0, 0.0);
          #endif
          vWPos = (modelMatrix * wp).xyz;
          vWNrm = normalize(mat3(modelMatrix) * wn);
        }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWPos; varying vec3 vWNrm;
        uniform float uWet; uniform float uGrime; uniform float uWetK;
        float h3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
        float vn3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        // large-scale variation hides texture tiling; streaks of soot and
        // rain run down vertical walls
        float macro = vn3(vWPos * 0.045) * 0.6 + vn3(vWPos * 0.17) * 0.4;
        diffuseColor.rgb *= mix(0.78, 1.12, macro * uGrime + (1.0 - uGrime) * 0.6);
        float vert = 1.0 - abs(vWNrm.y);
        float streak = vn3(vec3(vWPos.x * 1.7 + vWPos.z * 1.7, vWPos.y * 0.08, vWPos.z * 0.3 - vWPos.x * 0.3));
        streak = smoothstep(0.55, 0.95, streak) * vert * uGrime;
        diffuseColor.rgb *= 1.0 - streak * 0.35;
        float gH = 1.0 - smoothstep(0.0, 2.2, vWPos.y);
        float gN = fract(sin(dot(floor(vWPos.xz * 0.7), vec2(12.9898, 78.233))) * 43758.5453);
        diffuseColor.rgb *= mix(1.0, 0.62 + 0.12 * gN, gH * uGrime);
        float up = clamp(vWNrm.y, 0.0, 1.0);
        float wetM = uWet * uWetK * mix(0.45, 1.0, up);
        diffuseColor.rgb *= mix(1.0, 0.68, wetM);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.28, wetM);
        #if defined(PUDDLES) && defined(USE_ROUGHNESSMAP)
          // puddles stored in the blue channel fill up as the ground gets wet
          float pud = smoothstep(0.15, 0.6, texture2D(roughnessMap, vRoughnessMapUv).b) * smoothstep(0.2, 0.9, uWet) * up;
          roughnessFactor = mix(roughnessFactor, 0.02, pud);
          diffuseColor.rgb *= mix(1.0, 0.35, pud);
        #endif`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        #if defined(PUDDLES) && defined(USE_ROUGHNESSMAP)
          normal = normalize(mix(normal, normalize(vNormal), smoothstep(0.15, 0.6, texture2D(roughnessMap, vRoughnessMapUv).b) * smoothstep(0.2, 0.9, uWet)));
        #endif`);
  };
  if (opts.puddles) mat.defines = { ...(mat.defines || {}), PUDDLES: '' };
  mat.customProgramCacheKey = () => `g${grime}w${wetUp}p${opts.puddles ? 1 : 0}`;
  return mat;
}

// Interior mapping: every pane of glass looks into a fake room (back wall,
// side walls, floor, ceiling, sometimes curtains) ray-traced in the
// fragment shader, so blocks of flats have depth instead of mirror windows.
// Rooms are cells of a world-aligned grid along the facade; at night a
// share of them are lit warm. The glass itself reflects the sky by Fresnel.
function patchGlass(mat, litShare) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = globals.uNight;
    sh.uniforms.uDayLum = globals.uDayLum;
    sh.uniforms.uLitShare = { value: litShare };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNrm;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        {
          vec4 wp = vec4(transformed, 1.0);
          vec3 wn = objectNormal;
          #ifdef USE_INSTANCING
            wp = instanceMatrix * wp; wn = mat3(instanceMatrix) * wn;
          #endif
          vWPos = (modelMatrix * wp).xyz;
          vWNrm = normalize(mat3(modelMatrix) * wn);
        }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWPos; varying vec3 vWNrm;
        uniform float uNight, uDayLum, uLitShare;
        float ih(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
        vec3 interiorColor(vec3 wpos, vec3 nrm, vec3 cam){
          vec3 n = normalize(vec3(nrm.x, 0.0, nrm.z));
          vec3 t = normalize(cross(vec3(0.0, 1.0, 0.0), n));
          vec3 dir = normalize(wpos - cam);
          float du = dot(dir, t), dv = dir.y, dw = -dot(dir, n);
          if (dw < 0.02) dw = 0.02;
          vec2 cell = vec2(3.0, 3.0);
          float D = 3.6;
          float u = dot(wpos, t), v = wpos.y + 0.05;
          float u0 = floor(u / cell.x) * cell.x, v0 = floor(v / cell.y) * cell.y;
          float tu = du > 0.0 ? (u0 + cell.x - u) / du : (u0 - u) / min(du, -1e-4);
          float tv = dv > 0.0 ? (v0 + cell.y - v) / dv : (v0 - v) / min(dv, -1e-4);
          float tw = D / dw;
          float th = min(tu, min(tv, tw));
          vec3 id = vec3(u0, v0, dot(wpos, n) * 0.0 + floor(dot(wpos, vec3(0.37, 0.0, 0.61))));
          float r1 = ih(id), r2 = ih(id + 7.1), r3 = ih(id + 3.3);
          vec3 wall = mix(vec3(0.42, 0.38, 0.30), vec3(0.30, 0.33, 0.30), r1) * mix(0.6, 1.0, r2);
          vec3 col;
          float depth = th * dw;              // how far behind the glass the hit is
          if (th == tw) {
            float hu = u + du * th - u0, hv = v + dv * th - v0;
            col = wall * 0.75;
            // a door or a cupboard on the back wall
            if (r3 > 0.5 && abs(hu - cell.x * (0.25 + 0.5 * r1)) < 0.45 && hv < 2.1) col = vec3(0.16, 0.11, 0.07);
          } else if (th == tv) {
            col = dv > 0.0 ? vec3(0.55, 0.53, 0.48) : vec3(0.15, 0.10, 0.07);
          } else {
            col = wall * 0.9;
          }
          // furniture silhouette low in the room
          float fy = v + dv * min(th, D * 0.7 / dw) - v0;
          if (r2 > 0.4 && fy < 0.9 && depth > 1.2) col *= 0.45;
          // light: lit rooms at night glow warm with falloff from a ceiling bulb
          float lit = step(1.0 - uLitShare, ih(id + 11.0));
          float fall = 1.0 / (1.0 + depth * 0.35);
          vec3 night = col * lit * vec3(1.0, 0.72, 0.42) * 1.6 * fall;
          vec3 day = col * uDayLum * 0.22 * (0.6 + 0.4 * fall);
          vec3 c = mix(day, night, uNight) + day * 0.3 * uNight;
          // curtains or blackout paper across part of the pane
          float hu2 = u - u0;
          float curtain = step(0.55, r3) * (step(hu2, cell.x * (0.15 + 0.25 * r2)) + step(cell.x * (0.85 - 0.25 * r1), hu2));
          vec3 cc = mix(vec3(0.30, 0.26, 0.20), vec3(0.20, 0.22, 0.24), r1);
          c = mix(c, cc * mix(uDayLum * 0.35, 1.2 * lit, uNight), clamp(curtain, 0.0, 1.0) * 0.9);
          return c;
        }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += interiorColor(vWPos, vWNrm, cameraPosition);`);
  };
  mat.customProgramCacheKey = () => 'glass' + litShare;
  return mat;
}

function texSet(name, extra = {}) {
  return {
    map: tex(name + '_c'), normalMap: tex(name + '_n'),
    roughnessMap: tex(name + '_r'), aoMap: null, metalnessMap: extra.metal ? tex(name + '_r') : null,
  };
}

const lib = new Map();

function std(name, params, opts) {
  const m = new THREE.MeshStandardMaterial(params);
  m.name = name;
  patch(m, opts);
  lib.set(name, m);
  return m;
}

export function buildLibrary() {
  const T = texSet;
  std('concrete_white', { ...T('concrete_white'), color: 0xffffff, roughness: 1, normalScale: new THREE.Vector2(0.8, 0.8) });
  std('concrete_grey', { ...T('concrete_grey'), color: 0xffffff, roughness: 1 });
  std('concrete_dark', { ...T('concrete_grey'), color: 0x8e8c88, roughness: 1 });
  std('stone_dirty', { ...T('concrete_grey'), color: 0xd2c6ac, roughness: 1 });
  std('stone_statue', { ...T('concrete_grey'), color: 0xb9b5ac, roughness: 1 }, { grime: 0 });
  std('brick', { ...T('brick'), color: 0xffffff, roughness: 1 });
  std('plaster', { ...T('plaster'), color: 0xffffff, roughness: 1 });
  std('slate', { ...T('slate'), color: 0xffffff, roughness: 1 }, { grime: 0, wet: 1.2 });
  std('corrugated', { ...T('metal', { metal: true }), color: 0x8d8478, roughness: 1, metalness: 1 }, { grime: 0 });
  std('wood', { ...T('wood'), color: 0xffffff, roughness: 1 });
  std('wood_dark', { ...T('wood'), color: 0x6c5a4c, roughness: 1 });
  std('board', { ...T('board'), color: 0xffffff, roughness: 1 });
  std('cardboard', { ...T('board'), color: 0xd8b783, roughness: 1 });
  std('metal', { ...T('metal', { metal: true }), color: 0xffffff, roughness: 1, metalness: 1 });
  std('metal_dark', { ...T('metal', { metal: true }), color: 0x404244, roughness: 1, metalness: 1 });
  std('rust', { ...T('metal'), color: 0x8a4a2a, roughness: 0.9, metalness: 0.2 });
  std('iron_black', { color: 0x0c0c0d, roughness: 0.55, metalness: 0.7 }, { grime: 0 });
  std('brass', { color: 0xa88a48, roughness: 0.35, metalness: 1 }, { grime: 0 });
  std('rubber', { color: 0x0b0b0b, roughness: 0.9 }, { grime: 0 });
  std('screen_frame', { color: 0x2e3133, roughness: 0.35, metalness: 0.9 }, { grime: 0 });
  std('tile_white', { ...T('tile_white'), color: 0xffffff, roughness: 1 }, { grime: 0.3 });
  std('rubble', { ...T('rubble'), color: 0xffffff, roughness: 1 }, { grime: 0 });
  // ground surfaces; meshes using them need world-space UVs (u = x / tile)
  std('asphalt', { ...T('asphalt'), color: 0xffffff, roughness: 1 }, { grime: 0, puddles: true });
  std('paving', { ...T('paving'), color: 0xffffff, roughness: 1 }, { grime: 0, puddles: true });
  std('cobble', { ...T('cobble'), color: 0xffffff, roughness: 1 }, { grime: 0, puddles: true });
  std('dirt', { ...T('dirt'), color: 0xffffff, roughness: 1 }, { grime: 0, puddles: false });
  std('grass', { ...T('grass'), color: 0xffffff, roughness: 1 }, { grime: 0, puddles: false });
  std('sandbag', { ...T('fabric'), color: 0x8e7f62, roughness: 1 }, { grime: 0.3 });
  std('canvas', { ...T('fabric'), color: 0x5a5a44, roughness: 1 }, { grime: 0 });
  std('bark', { ...T('bark'), color: 0xffffff, roughness: 1 }, { grime: 0 });
  std('bark_moss', { ...T('bark_moss'), color: 0xffffff, roughness: 1 }, { grime: 0 });
  std('mattress', { ...T('fabric'), color: 0x9e9682, roughness: 1 }, { grime: 0 });
  std('fabric_grey', { ...T('fabric'), color: 0x55544f, roughness: 1 }, { grime: 0 });
  std('fabric_red', { ...T('fabric'), color: 0x6c1612, roughness: 1 }, { grime: 0 });
  std('paper', { color: 0xd9d0b4, roughness: 0.95 }, { grime: 0 });
  std('coral', { color: 0xd8584e, roughness: 0.5 }, { grime: 0 });
  std('diary_cover', { color: 0x5a1410, roughness: 0.55 }, { grime: 0 });
  std('lamp_bulb', { color: 0xffe2b0, emissive: 0xffc070, emissiveIntensity: 0.0, roughness: 0.3 }, { grime: 0 });
  // glass reflects the sky like a dulled mirror; some windows light up at night
  for (const [name, share] of [['glass', 0.12], ['glass_lit', 0.85]]) {
    // emissive stays black: the shader adds the fake room on top of it
    const g = new THREE.MeshStandardMaterial({ name, color: 0x000000, roughness: 0.04, metalness: 0.0,
      emissive: 0x000000, envMapIntensity: 3.2 });
    patchGlass(g, share);
    lib.set(name, g);
  }
  const pw = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.02, transmission: 1, thickness: 0.08, ior: 1.5 });
  pw.name = 'paperweight_glass'; lib.set(pw.name, pw);
  lib.set('lens', new THREE.MeshStandardMaterial({ color: 0x9ab0b0, roughness: 0.05, metalness: 0.5, transparent: true, opacity: 0.35 }));
  // foliage cards
  for (const n of ['leaves', 'leaves_elm']) {
    const m = new THREE.MeshStandardMaterial({
      map: tex(n), normalMap: tex(n + '_n'), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.85,
      color: 0xffffff,
    });
    m.name = n;
    lib.set(n, m);
  }
  // people
  const fab = tex('fabric_n');
  const cloth = (name, color, rough = 0.95) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: rough, normalMap: fab, normalScale: new THREE.Vector2(0.6, 0.6) });
    if (fab) { m.normalMap = fab.clone(); m.normalMap.repeat.set(12, 12); m.normalMap.needsUpdate = true; }
    m.name = name; lib.set(name, m); return m;
  };
  cloth('overalls_blue', 0x2a3a52);
  cloth('overalls_black', 0x111214, 0.8);
  cloth('uniform_black', 0x0b0b0d, 0.65);
  cloth('sash_red', 0x9c1010);
  cloth('prole_jacket', 0x4a3a2c);
  cloth('prole_trousers', 0x3a3936);
  cloth('prole_dress', 0x5a4038);
  cloth('apron', 0x9c968a);
  lib.set('skin', new THREE.MeshStandardMaterial({ name: 'skin', color: 0xc4917a, roughness: 0.62 }));
  for (const [n, c] of [['hair_dark', 0x14100c], ['hair_fair', 0x7a6040], ['hair_grey', 0x7c7a76]]) {
    lib.set(n, new THREE.MeshStandardMaterial({ name: n, color: c, roughness: 0.75 }));
  }
  lib.set('shoe', new THREE.MeshStandardMaterial({ name: 'shoe', color: 0x0e0c0a, roughness: 0.45 }));
  lib.set('eye', new THREE.MeshStandardMaterial({ name: 'eye', color: 0x050505, roughness: 0.1 }));
  // printed and broadcast surfaces
  const poster = (name, t) => std(name, { map: t, roughness: 0.92, color: 0xffffff }, { grime: 0.4 });
  poster('poster_bb', art.posterBB());
  poster('poster_ingsoc', art.posterIngsoc());
  const sp = art.posterSpiral(); sp.wrapS = THREE.RepeatWrapping; sp.repeat.set(1 / 4, 1);
  poster('poster_spiral', sp);
  poster('slogans', art.slogans());
  poster('engraving', art.engraving());
  poster('sign', art.sign('MINISTRY'));
  const ts = new THREE.MeshStandardMaterial({ name: 'telescreen_screen', color: 0x000000, emissive: 0xffffff,
    emissiveMap: art.telescreen.texture, emissiveIntensity: 1.25, roughness: 0.25, metalness: 0.2 });
  lib.set('telescreen_screen', ts);
}

export function get(name) { return lib.get(name); }

// Swap Blender's placeholder materials for the library ones.
export function apply(root, opts = {}) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    const swap = (m) => {
      const key = m.name.replace(/\.\d+$/, '');
      if (opts.override && opts.override[key]) return opts.override[key];
      return lib.get(key) || m;
    };
    o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
    o.castShadow = opts.cast ?? true;
    o.receiveShadow = opts.receive ?? true;
  });
  return root;
}

export function signMaterial(text, opts) {
  return std('sign_' + text, { map: art.sign(text, opts), roughness: 0.85 }, { grime: 0.3 });
}
