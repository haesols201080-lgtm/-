// Shell fur: the creature's skin mesh is drawn as instance 0, then N slightly inflated copies (shells) on which
// individual hairs are cut out of a metre-scaled strand grid. Hairs follow a per-vertex comb direction (groomed in
// Blender: back to tail, legs downward, tail to its tip), droop with their length, gather toward clump centres
// at the tips, vary in length per clump, include sparse long guard hairs, and carry agouti banding (dark root,
// light band, darker tip). Fur length / zone per vertex come from TEXCOORD_1, comb from TEXCOORD_2/3.
import * as THREE from 'three';

export function furredMesh(srcMesh, { shells = 16, length = 0.006, density = 1100, sheen = 0.25, rootDark = 0.3, clump = 0.22 } = {}) {
  const geo = srcMesh.geometry.clone();
  const n = geo.attributes.position.count;
  const zero2 = () => new THREE.BufferAttribute(new Float32Array(n * 2), 2);
  geo.setAttribute('furData', geo.getAttribute('uv1') || zero2());
  geo.setAttribute('furCombXY', geo.getAttribute('uv2') || zero2());
  geo.setAttribute('furCombZ', geo.getAttribute('uv3') || zero2());
  const U = { uFurLen: { value: length }, uShells: { value: shells }, uDensity: { value: density }, uTail: { value: 0 }, uTime: { value: 0 }, uRootDark: { value: rootDark }, uClump: { value: clump } };
  const mat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.82, metalness: 0, sheen, sheenRoughness: 0.55,
    sheenColor: new THREE.Color(0.55, 0.38, 0.24), envMapIntensity: 0.6 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
        attribute vec2 furData; attribute vec2 furCombXY; attribute vec2 furCombZ;
        uniform float uFurLen, uShells, uTail, uTime;
        varying float vFurH; varying vec2 vFurUv; varying float vZone; varying float vFurL;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          float h = float(gl_InstanceID) / uShells;
          float L = uFurLen * furData.x;
          float zone = furData.y * 8.0;
          // the tail sways from its base
          float tw = step(2.5, zone) * step(zone, 3.5) * max(0.0, position.y - 0.05);
          transformed.x += uTail * tw * 0.9 + sin(uTime * 1.7 + position.y * 9.0) * tw * 0.04;
          vec3 comb = vec3(furCombXY, furCombZ.x);
          comb = length(comb) > 0.01 ? normalize(comb) : vec3(0.0, -1.0, 0.0);
          // hairs leave the skin along the normal, then lie down along the comb and droop: longer hair lies flatter
          float lie = mix(0.55, 1.25, clamp(furData.x / 3.0, 0.0, 1.0));
          transformed += normal * L * h + (comb * 0.8 + vec3(0.0, -0.35, 0.0)) * L * h * h * lie;
          vFurH = h; vFurUv = uv; vZone = zone; vFurL = furData.x;
        }`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        uniform float uDensity, uShells, uRootDark, uClump; varying float vFurH; varying vec2 vFurUv; varying float vZone; varying float vFurL;
        float fh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          if (vFurH > 0.0 && vFurL < 0.02) discard;                                // bare: claws, nose pad
          float dens = uDensity * mix(1.0, 0.6, smoothstep(1.5, 4.0, vFurL));      // long hair grows in coarser locks
          vec2 cell = vFurUv * dens, id = floor(cell), f = fract(cell) - 0.5;
          vec2 cid = floor(id / 3.0); float cr = fh(cid + 4.2);
          vec2 toClump = (cid * 3.0 + 1.5) - (id + 0.5);
          bool guard = fh(id + 5.5) > 0.9;
          float len = guard ? 1.0 : (0.42 + 0.33 * fh(id + 1.3)) * (0.78 + 0.35 * cr);
          float far = smoothstep(0.6, 3.0, length(vViewPosition));
          if (vFurH > 0.0) {
            if (vFurH > len) discard;
            vec2 c = (vec2(fh(id + 3.1), fh(id + 7.7)) - 0.5) * 0.5 + toClump * vFurH * uClump;
            float rad = mix(guard ? 0.34 : 0.5, 0.1, vFurH / len) * (1.0 + far * 0.9);
            if (length(f - c) > rad) discard;
          }
          // coat self-shadowing and agouti banding (not on the white belly hair)
          float hh = vFurH / max(len, 1e-3);
          float band = mix(1.0, 1.0 + 0.32 * smoothstep(0.35, 0.6, hh) * (1.0 - smoothstep(0.75, 0.95, hh)) - (guard ? 0.35 * smoothstep(0.7, 1.0, hh) : 0.0),
                           step(vZone, 0.5) + step(1.5, vZone) * step(vZone, 3.5));
          float tone = (0.86 + 0.26 * fh(id + 9.4)) * (0.9 + 0.2 * cr);
          diffuseColor.rgb *= mix(uRootDark, 1.1, pow(vFurH, 0.7)) * tone * band;
        }`);
  };
  mat.customProgramCacheKey = () => 'shellFur2';
  const im = new THREE.InstancedMesh(geo, mat, shells + 1);
  const I = new THREE.Matrix4();
  for (let i = 0; i <= shells; i++) im.setMatrixAt(i, I);
  im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false;
  im.userData.fur = U;
  return im;
}
