// Material library. Blender exports named material slots; here each name
// becomes a PBR material with the baked texture sets. A small shader patch
// adds ground grime and rain wetness to every surface.
import * as THREE from 'three';
import { tex } from './assets.js';
import * as art from './art.js';

export const globals = {
  uWet: { value: 0 },        // 0 dry .. 1 soaked
  uNight: { value: 0 },      // lit windows
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
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNrm;\nuniform float uWet;\nuniform float uGrime;\nuniform float uWetK;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        float gH = 1.0 - smoothstep(0.0, 2.2, vWPos.y);
        float gN = fract(sin(dot(floor(vWPos.xz * 0.7), vec2(12.9898, 78.233))) * 43758.5453);
        diffuseColor.rgb *= mix(1.0, 0.62 + 0.12 * gN, gH * uGrime);
        float up = clamp(vWNrm.y, 0.0, 1.0);
        float wetM = uWet * uWetK * mix(0.45, 1.0, up);
        diffuseColor.rgb *= mix(1.0, 0.68, wetM);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.28, wetM);`);
  };
  mat.customProgramCacheKey = () => `g${grime}w${wetUp}`;
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
  std('glass', { color: 0x1a1f24, roughness: 0.06, metalness: 1, envMapIntensity: 1.1 }, { grime: 0, wet: 0 });
  const lit = std('glass_lit', { color: 0x1a1f24, roughness: 0.08, metalness: 1, emissive: 0xffb05a, emissiveIntensity: 0 }, { grime: 0, wet: 0 });
  lit.userData.nightEmissive = 1.6;
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
