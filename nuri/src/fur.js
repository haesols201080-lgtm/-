// Shell fur: the creature's skin mesh is drawn as instance 0, then N slightly inflated copies (shells) on which
// individual hairs are cut out: each hair is a jittered disc in a metre-scaled UV grid that thins toward its tip and
// ends at a random length; hairs are combed back and sag under gravity, darker at the roots (self-shadowing of the
// coat), lighter at the tips. Fur length / body zone per vertex come from the model (TEXCOORD_1).
import * as THREE from 'three';

export function furredMesh(srcMesh, { shells = 16, length = 0.007, density = 1100, comb = new THREE.Vector3(0, -0.35, -1), sheen = 0.25 } = {}) {
  const geo = srcMesh.geometry.clone();
  geo.setAttribute('furData', geo.getAttribute('uv1') || new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2).fill(1), 2));
  const U = { uFurLen: { value: length }, uShells: { value: shells }, uDensity: { value: density }, uComb: { value: comb.clone().normalize() },
    uTail: { value: 0 }, uTime: { value: 0 } };
  const mat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, sheen, sheenRoughness: 0.6,
    sheenColor: new THREE.Color(0.55, 0.38, 0.24), envMapIntensity: 0.6 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
        attribute vec2 furData; uniform float uFurLen, uShells, uTail, uTime; uniform vec3 uComb;
        varying float vFurH; varying vec2 vFurUv; varying float vZone; varying float vFurL;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          float h = float(gl_InstanceID) / uShells;
          float L = uFurLen * furData.x;
          // tail sways from its base
          float tw = step(0.6, furData.y) * step(furData.y, 0.9) * max(0.0, position.y - 0.05);
          transformed.x += uTail * tw * 0.9 + sin(uTime * 1.7 + position.y * 9.0) * tw * 0.04;
          transformed += normal * L * h + uComb * L * h * h * 0.55;
          vFurH = h; vFurUv = uv; vZone = furData.y; vFurL = furData.x;
        }`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        uniform float uDensity, uShells; varying float vFurH; varying vec2 vFurUv; varying float vZone; varying float vFurL;
        float fh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          // long-haired zones (tail, ear tufts) grow in coarser locks
          float dens = uDensity * mix(1.0, 0.55, smoothstep(1.5, 4.0, vFurL));
          vec2 cell = vFurUv * dens, id = floor(cell), f = fract(cell) - 0.5;
          vec2 jit = vec2(fh(id + 3.1), fh(id + 7.7)) - 0.5;
          float len = 0.55 + 0.45 * fh(id + 1.3);
          float far = smoothstep(0.6, 3.0, length(vViewPosition));
          if (vFurH > 0.0) {
            if (vFurH > len) discard;
            float rad = mix(0.5, 0.12, vFurH / len) * (1.0 + far * 0.9);
            if (length(f - jit * 0.5) > rad) discard;
          }
          // coat self-shadowing: dark undercoat, light tips; per-hair tone variation
          float tone = (0.88 + 0.24 * fh(id + 9.4));
          diffuseColor.rgb *= mix(0.3, 1.12, pow(vFurH, 0.7)) * tone;
        }`);
  };
  mat.customProgramCacheKey = () => 'shellFur';
  const im = new THREE.InstancedMesh(geo, mat, shells + 1);
  const I = new THREE.Matrix4();
  for (let i = 0; i <= shells; i++) im.setMatrixAt(i, I);
  im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false;
  im.userData.fur = U;
  return im;
}
