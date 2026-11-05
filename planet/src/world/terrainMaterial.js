// Terrain surface shader: a MeshStandardMaterial (so it gets PBR lighting and
// shadows) whose albedo/normal/roughness are replaced by a procedural layer
// stack: regolith, sand, basalt, strata cliffs, frost, wet ground, moss and
// grass. The living layers are driven by the global terraforming uniforms.
import * as THREE from 'three';
import { U } from '../core/shared.js';
import { TEX } from './texstore.js';

export const TERRAIN_GLSL_COMMON = /* glsl */`
uniform sampler2D tRock, tSoil, tSand, tMoss, tNoise;
uniform float uFrost, uWet, uMoss, uGrass, uLush, uWaterLevel, uTime, uSnowMelt;
uniform vec4 uGreen[8];
varying vec3 vTW;
varying vec3 vTN;
varying vec4 vS1;
varying vec4 vS2;
vec3 s2l(vec3 c) { return pow(c, vec3(2.2)); }
vec3 gAlb; float gRough; vec3 gN; float gAO;

vec3 strataColor(float y, float n) {
  float b = fract(y * 0.115 + n * 0.9);
  vec3 c0 = s2l(vec3(0.80, 0.62, 0.46));
  vec3 c1 = s2l(vec3(0.62, 0.33, 0.20));
  vec3 c2 = s2l(vec3(0.44, 0.24, 0.16));
  vec3 c3 = s2l(vec3(0.86, 0.72, 0.56));
  vec3 c = mix(c0, c1, smoothstep(0.15, 0.25, b));
  c = mix(c, c2, smoothstep(0.42, 0.5, b));
  c = mix(c, c3, smoothstep(0.62, 0.68, b));
  c = mix(c, c0, smoothstep(0.86, 0.95, b));
  return c;
}

void computeTerrain() {
  vec3 N = normalize(vTN);
  vec4 bio = vS1;
  float modv = vS2.w;
  float snowW = vS2.x, saltW = vS2.y, crysW = vS2.z;
  vec4 nzA = texture2D(tNoise, vTW.xz * 0.0019);
  vec4 nzB = texture2D(tNoise, vTW.xz * 0.011 + 0.3);
  vec4 nzC = texture2D(tNoise, vTW.xz * 0.045 + 0.7);
  float slope = 1.0 - N.y;
  float cliff = smoothstep(0.2, 0.38, slope + (nzB.g - 0.5) * 0.14);

  // ground layers (planar projection)
  vec4 soilA = texture2D(tSoil, vTW.xz * 0.21);
  vec4 soilB = texture2D(tSoil, vTW.xz * 0.043 + 0.5);
  vec4 sand = texture2D(tSand, vec2(vTW.x * 0.07 + vTW.z * 0.05, vTW.z * 0.08 - vTW.x * 0.03));
  vec4 mossT = texture2D(tMoss, vTW.xz * 0.19);
  // rock layer (triplanar)
  vec3 bw = pow(abs(N), vec3(5.0)); bw /= (bw.x + bw.y + bw.z);
  float rs = 0.075;
  vec4 rx = texture2D(tRock, vec2(vTW.z, vTW.y * 1.6) * rs);
  vec4 ry = texture2D(tRock, vTW.xz * rs);
  vec4 rz = texture2D(tRock, vec2(vTW.x, vTW.y * 1.6) * rs);
  vec4 rock = rx * bw.x + ry * bw.y + rz * bw.z;

  float macro = 0.8 + 0.4 * nzA.r * (0.7 + 0.3 * nzB.b);
  float soilDetail = mix(soilA.b, soilB.b, 0.35);

  // --- base albedo per biome
  vec3 regolith = mix(s2l(vec3(0.36, 0.22, 0.15)), s2l(vec3(0.64, 0.44, 0.32)), soilDetail * 0.8 + 0.1);
  regolith = mix(regolith, s2l(vec3(0.52, 0.40, 0.33)), smoothstep(0.35, 0.75, nzB.r) * 0.55);
  regolith = mix(regolith, s2l(vec3(0.60, 0.34, 0.20)), smoothstep(0.55, 0.9, nzA.g) * 0.5);
  vec3 sandC = mix(s2l(vec3(0.62, 0.43, 0.28)), s2l(vec3(0.85, 0.66, 0.47)), sand.b);
  vec3 basalt = mix(s2l(vec3(0.13, 0.11, 0.10)), s2l(vec3(0.33, 0.27, 0.25)), soilDetail);
  vec3 ground = regolith;
  float sandW = smoothstep(0.25, 0.75, bio.r + (nzB.b - 0.5) * 0.4);
  ground = mix(ground, sandC, sandW);
  ground = mix(ground, basalt, smoothstep(0.2, 0.7, bio.g));
  // salt crust with polygon cracks
  vec3 saltC = mix(s2l(vec3(0.72, 0.70, 0.66)), s2l(vec3(0.93, 0.92, 0.88)), smoothstep(0.1, 0.5, sand.b * 0.3 + soilB.a * 0.7));
  float saltCrack = smoothstep(0.08, 0.0, abs(texture2D(tRock, vTW.xz * 0.05).b - 0.5) - 0.02);
  saltC *= 1.0 - saltCrack * 0.35;
  ground = mix(ground, saltC, smoothstep(0.25, 0.7, saltW));
  // crystal plains: lavender-grey glassy grit
  vec3 crysC = mix(s2l(vec3(0.30, 0.27, 0.31)), s2l(vec3(0.56, 0.51, 0.56)), soilDetail);
  ground = mix(ground, crysC, smoothstep(0.25, 0.7, crysW));

  vec3 rockC = mix(s2l(vec3(0.36, 0.21, 0.14)), s2l(vec3(0.66, 0.45, 0.32)), rock.b);
  vec3 strataC = strataColor(vTW.y + rock.b * 1.5, nzB.r) * (0.75 + 0.45 * rock.b);
  rockC = mix(rockC, strataC, smoothstep(0.15, 0.6, bio.b));
  rockC = mix(rockC, basalt * 1.25, smoothstep(0.2, 0.7, bio.g));
  rockC = mix(rockC, s2l(vec3(0.45, 0.47, 0.52)) * (0.7 + 0.5 * rock.b), smoothstep(0.3, 0.8, snowW));
  rockC = mix(rockC, crysC * 1.1, smoothstep(0.3, 0.8, crysW) * 0.6);

  vec3 alb = mix(ground, rockC, cliff) * macro;
  float rough = mix(mix(0.93, 0.97, sandW), 0.82, cliff);
  float ao = mix(mix(soilA.a, 1.0, sandW), rock.a, cliff);

  // detail normal
  vec2 tGround = mix(soilA.rg, sand.rg, sandW) * 2.0 - 1.0;
  vec3 nGround = normalize(N + vec3(tGround.x, 0.0, tGround.y) * 0.55);
  vec2 tx = rx.rg * 2.0 - 1.0, ty = ry.rg * 2.0 - 1.0, tz = rz.rg * 2.0 - 1.0;
  vec3 nRock = normalize(N + (vec3(0.0, tx.y, tx.x) * bw.x + vec3(ty.x, 0.0, ty.y) * bw.y + vec3(tz.x, tz.y, 0.0) * bw.z) * 0.9);
  vec3 nrm = normalize(mix(nGround, nRock, cliff));

  // built / packed ground around structures
  float packed = smoothstep(0.05, 0.6, modv) * (1.0 - cliff * 0.6);
  vec3 packedC = mix(s2l(vec3(0.33, 0.24, 0.19)), s2l(vec3(0.48, 0.37, 0.30)), soilA.b);
  alb = mix(alb, packedC, packed * 0.85);
  nrm = normalize(mix(nrm, N, packed * 0.6));

  // frost in cold hollows and shaded north slopes
  float hollow = smoothstep(0.55, 0.85, bio.a) * (1.0 - smoothstep(-25.0, 60.0, vTW.y));
  float frostMask = smoothstep(0.55, 0.95, nzB.g * 0.45 + hollow * 0.4 - N.z * 0.12 + nzA.b * 0.25 + nzC.r * 0.1 - sandW * 0.4);
  float frost = uFrost * frostMask * (1.0 - cliff * 0.85) * 0.38;
  alb = mix(alb, s2l(vec3(0.72, 0.74, 0.78)) * (0.85 + 0.15 * soilA.b), frost * (0.6 + 0.4 * soilA.b));
  rough = mix(rough, 0.55, frost);

  // polar snow & glacier ice
  float snowCov = smoothstep(0.25, 0.65, snowW + (nzB.g - 0.5) * 0.3) * (1.0 - cliff * 0.75) * (1.0 - uSnowMelt * smoothstep(0.4, 0.95, 1.0 - snowW + nzA.r * 0.3));
  vec3 snowC = mix(s2l(vec3(0.78, 0.83, 0.9)), s2l(vec3(0.95, 0.97, 1.0)), soilB.b * 0.6 + 0.4 * nzC.r);
  alb = mix(alb, snowC, snowCov);
  rough = mix(rough, 0.45, snowCov);
  nrm = normalize(mix(nrm, N, snowCov * 0.7));

  // living layers
  float above = vTW.y - uWaterLevel;
  float flat_ = 1.0 - smoothstep(0.18, 0.34, slope);
  float fertile = clamp(bio.a * 0.6 + nzB.r * 0.3 + (mossT.b - 0.5) * 0.2 + nzA.g * 0.15, 0.0, 1.0);
  float localG = 0.0;
  for (int i = 0; i < 8; i++) { vec4 gp = uGreen[i]; if (gp.z > 0.0) localG = max(localG, gp.w * (1.0 - smoothstep(gp.z * 0.6, gp.z, length(vTW.xz - gp.xy)))); }
  float mThr = 1.0 - clamp(uMoss + localG * 0.8, 0.0, 1.0);
  float gThr = 1.0 - clamp(uGrass + localG * 0.55, 0.0, 1.0);
  fertile *= 1.0 - snowCov * 0.9 - smoothstep(0.4, 0.8, saltW) * 0.6;
  float mossCov = smoothstep(mThr, mThr + 0.12, fertile) * step(0.001, uMoss + localG) * flat_ * step(0.4, above) * (1.0 - packed);
  float grassCov = smoothstep(gThr, gThr + 0.14, fertile + nzC.g * 0.06) * step(0.001, uGrass + localG * 0.5) * flat_ * smoothstep(0.6, 2.5, above) * (1.0 - packed * 0.8);
  vec3 mossC = mix(s2l(vec3(0.17, 0.22, 0.08)), s2l(vec3(0.33, 0.39, 0.13)), mossT.b);
  vec3 grassC = mix(s2l(vec3(0.20, 0.33, 0.09)), s2l(vec3(0.46, 0.55, 0.16)), mossT.b * 0.7 + nzB.g * 0.3);
  grassC = mix(grassC, s2l(vec3(0.18, 0.40, 0.25)), smoothstep(0.55, 0.85, nzA.b) * 0.6);
  grassC = mix(grassC * vec3(1.1, 0.95, 0.7), grassC, uLush);
  // dry golden patches, darker hollows, bare soil openings
  grassC = mix(grassC, s2l(vec3(0.55, 0.5, 0.26)), smoothstep(0.58, 0.82, nzB.b) * 0.55 * (1.0 - uLush * 0.5));
  grassC *= 0.8 + 0.35 * nzC.r;
  grassCov *= 1.0 - 0.7 * smoothstep(0.66, 0.86, nzA.b + (soilA.b - 0.5) * 0.2);
  alb = mix(alb, mossC, mossCov * 0.9);
  alb = mix(alb, grassC, grassCov);
  vec2 tm = mossT.rg * 2.0 - 1.0;
  nrm = normalize(mix(nrm, normalize(N + vec3(tm.x, 0.0, tm.y) * 0.7), max(mossCov, grassCov)));
  rough = mix(rough, 0.88, max(mossCov, grassCov));
  ao = mix(ao, mossT.a, max(mossCov, grassCov));

  // wet shoreline + rain
  float shore = 1.0 - smoothstep(0.0, 2.2, above);
  float wet = max(shore * step(-280.0, uWaterLevel), uWet * (0.55 + 0.45 * nzC.g));
  wet *= (1.0 - frost);
  alb *= mix(1.0, 0.5, wet);
  rough = mix(rough, 0.3, wet);

  gAlb = alb; gRough = rough; gN = nrm; gAO = ao;
}
`;

export function makeTerrainMaterial() {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0, side: THREE.DoubleSide });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      tRock: { value: TEX.rock }, tSoil: { value: TEX.soil }, tSand: { value: TEX.sand }, tMoss: { value: TEX.moss },
      tNoise: U.tNoise, uFrost: U.uFrost, uWet: U.uWet, uMoss: U.uMoss, uGrass: U.uGrass, uSnowMelt: U.uSnowMelt,
      uLush: U.uLush, uWaterLevel: U.uWaterLevel, uTime: U.uTime, uGreen: U.uGreen,
    });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTW;\nvarying vec3 vTN;\nattribute vec4 aS1;\nattribute vec4 aS2;\nvarying vec4 vS1;\nvarying vec4 vS2;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvTW = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvTN = normalize(mat3(modelMatrix) * objectNormal);\nvS1 = aS1; vS2 = aS2;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + TERRAIN_GLSL_COMMON)
      .replace('#include <map_fragment>', 'computeTerrain();\ndiffuseColor.rgb = gAlb;')
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = gRough;')
      .replace('#include <normal_fragment_maps>', 'normal = normalize((viewMatrix * vec4(gN, 0.0)).xyz) * faceDirection;')
      .replace('#include <aomap_fragment>', 'float ambientOcclusion = mix(1.0, gAO, 0.75);\nreflectedLight.indirectDiffuse *= ambientOcclusion;\nreflectedLight.indirectSpecular *= ambientOcclusion;');
  };
  mat.customProgramCacheKey = () => 'terrain-v2';
  return mat;
}
