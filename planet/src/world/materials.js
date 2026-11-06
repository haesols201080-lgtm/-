// Material factory. All world materials are MeshStandardMaterial patched via
// onBeforeCompile so they share global uniforms (terraform state, time) and
// get procedural detail (triplanar rock, panel seams, grime) without UVs.
import * as THREE from 'three';
import { U } from '../core/shared.js';
import { TEX } from './texstore.js';

const VERT_WORLD = /* glsl */`
#ifdef USE_INSTANCING
  vec4 mW = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
  vec3 nW = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);
#else
  vec4 mW = modelMatrix * vec4(transformed, 1.0);
  vec3 nW = normalize(mat3(modelMatrix) * objectNormal);
#endif
  vWP = mW.xyz; vWN = nW; vOP = position; vON = objectNormal;
`;

function baseHeader(extra = '') {
  return /* glsl */`
varying vec3 vWP; varying vec3 vWN; varying vec3 vOP; varying vec3 vON;
${extra}
`;
}

// Natural rock: triplanar texture, per-instance tint, dust/moss on top faces.
export function makeRockMaterial({ emissive = 0x000000 } = {}) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0.0, emissive });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { tRock: { value: TEX.rock }, tNoise: U.tNoise, uLichen: U.uLichen, uMoss: U.uMoss, uFrost: U.uFrost, uWet: U.uWet, uWaterLevel: U.uWaterLevel });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + baseHeader('attribute vec3 iTint; varying vec3 vTint;'))
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n' + VERT_WORLD + '\n#ifdef USE_INSTANCING\nvTint = iTint;\n#else\nvTint = vec3(0.5,0.4,0.33);\n#endif');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + baseHeader('uniform sampler2D tRock, tNoise; uniform float uLichen, uMoss, uFrost, uWet, uWaterLevel; varying vec3 vTint; vec3 gN; float gR;'))
      .replace('#include <map_fragment>', /* glsl */`
        vec3 N0 = normalize(vWN);
        vec3 bw = pow(abs(N0), vec3(4.0)); bw /= (bw.x + bw.y + bw.z);
        float sc = 0.22;
        vec4 rx = texture2D(tRock, vWP.zy * sc), ry = texture2D(tRock, vWP.xz * sc), rz = texture2D(tRock, vWP.xy * sc);
        vec4 rk = rx * bw.x + ry * bw.y + rz * bw.z;
        vec4 nz = texture2D(tNoise, vWP.xz * 0.05 + vWP.y * 0.02);
        vec3 alb = pow(vTint, vec3(2.2)) * (0.55 + 0.75 * rk.b) * (0.85 + 0.3 * nz.r);
        vec2 tx = rx.rg * 2.0 - 1.0, ty = ry.rg * 2.0 - 1.0, tz = rz.rg * 2.0 - 1.0;
        gN = normalize(N0 + (vec3(0.0, tx.y, tx.x) * bw.x + vec3(ty.x, 0.0, ty.y) * bw.y + vec3(tz.x, tz.y, 0.0) * bw.z) * 1.1);
        float top = smoothstep(0.55, 0.9, gN.y + (nz.g - 0.5) * 0.4);
        vec3 dust = vec3(0.17, 0.08, 0.045) * (0.8 + 0.4 * nz.b);
        alb = mix(alb, dust, top * 0.4);
        // crustose lichen: crisp round rosettes, pale sage and orange, on
        // faces that catch light and damp (not under overhangs)
        if (uLichen > 0.001) {
          // crustose lichen: irregular lobed colonies of varied size, clustered
          // in patches of the rock (domain-warped cells), muted sage / ochre
          float ls = 0.42;
          vec4 wx = texture2D(tNoise, vWP.zy * 2.2 + 0.3), wy = texture2D(tNoise, vWP.xz * 2.2 + 0.7), wz = texture2D(tNoise, vWP.xy * 2.2 + 0.1);
          vec4 w = wx * bw.x + wy * bw.y + wz * bw.z;
          vec2 wp = (w.ra - 0.5) * 0.05;               // lobed edges: warp of about a third of a colony
          vec4 lx = texture2D(tNoise, vWP.zy * ls + wp + 0.13), ly = texture2D(tNoise, vWP.xz * ls + wp + 0.57), lzz = texture2D(tNoise, vWP.xy * ls + wp + 0.91);
          vec4 lz = lx * bw.x + ly * bw.y + lzz * bw.z;
          vec4 lc = texture2D(tNoise, vWP.xz * 0.11 + vWP.y * 0.07 + 0.5);
          float face = smoothstep(-0.3, 0.3, gN.y);
          float cluster = smoothstep(0.36, 0.62, lc.g * 0.8 + uLichen * 0.3);
          float size = (0.14 + 0.14 * w.g) * (0.45 + 0.55 * uLichen) * cluster;
          float ros = smoothstep(0.86 - size, 0.88 - size, lz.b + (w.a - 0.5) * 0.12) * face;
          vec3 sage = vec3(0.16, 0.18, 0.13), ochre = vec3(0.28, 0.14, 0.05), grey = vec3(0.24, 0.24, 0.22);
          vec3 lic = mix(sage, mix(ochre, grey, step(0.5, lc.b)), smoothstep(0.5, 0.6, lc.r)) * (0.8 + 0.35 * w.b);
          alb = mix(alb, lic, ros * 0.8);
        }
        alb = mix(alb, vec3(0.5, 0.53, 0.58), top * uFrost * smoothstep(0.65, 0.85, nz.r) * 0.4);
        float wet = uWet * (0.5 + 0.5 * top) + (1.0 - smoothstep(0.0, 1.5, vWP.y - uWaterLevel)) * 0.8;
        alb *= mix(1.0, 0.55, clamp(wet, 0.0, 1.0));
        gR = mix(mix(0.92, 0.78, rk.b), 0.32, clamp(wet, 0.0, 1.0));
        diffuseColor.rgb = alb * mix(0.55, 1.0, rk.a);
      `)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = gR;')
      .replace('#include <normal_fragment_maps>', 'normal = normalize((viewMatrix * vec4(gN, 0.0)).xyz);');
  };
  mat.customProgramCacheKey = () => 'rock-v5-' + emissive;
  return mat;
}

// Glowing crystal: fresnel rim + inner glow, per-instance tint.
export function makeCrystalMaterial() {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.12, metalness: 0.1, transparent: false });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uTime: U.uTime, uNight: U.uNight });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + baseHeader('attribute vec3 iTint; varying vec3 vTint;'))
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n' + VERT_WORLD + '\n#ifdef USE_INSTANCING\nvTint = iTint;\n#else\nvTint = vec3(0.3,0.9,1.0);\n#endif');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + baseHeader('uniform float uTime, uNight; varying vec3 vTint;'))
      .replace('#include <map_fragment>', 'diffuseColor.rgb = vTint * 0.25;')
      .replace('#include <emissivemap_fragment>', /* glsl */`
        vec3 V = normalize(cameraPosition - vWP);
        float fr = pow(1.0 - abs(dot(normalize(vWN), V)), 2.5);
        float pulse = 0.75 + 0.25 * sin(uTime * 1.3 + vWP.x * 0.3 + vWP.z * 0.2);
        float core = smoothstep(0.0, 1.0, fract(vOP.y * 0.8 + 0.2));
        totalEmissiveRadiance = vTint * (0.5 + fr * 2.5 + core * 0.3) * pulse * (0.7 + 1.6 * uNight);
      `);
  };
  mat.customProgramCacheKey = () => 'crystal-v1';
  return mat;
}

export { VERT_WORLD, baseHeader };
