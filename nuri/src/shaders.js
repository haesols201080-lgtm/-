// Shared GLSL snippets + material patchers (triplanar PBR, wind sway, baked-AO vertex colors).
import * as THREE from 'three';

export const SHADER_TRI = /* glsl */`
vec3 triWeights(vec3 n){ vec3 w = pow(abs(n), vec3(4.0)); return w / (w.x + w.y + w.z); }
vec4 triSample(sampler2D t, vec3 p, vec3 w, float s){
  return texture2D(t, p.zy * s) * w.x + texture2D(t, p.xz * s) * w.y + texture2D(t, p.xy * s) * w.z;
}
// whiteout-blended triplanar normal mapping (world space result)
vec3 triNormal(sampler2D t, vec3 p, vec3 n, vec3 w, float s){
  vec3 tx = texture2D(t, p.zy * s).xyz * 2.0 - 1.0;
  vec3 ty = texture2D(t, p.xz * s).xyz * 2.0 - 1.0;
  vec3 tz = texture2D(t, p.xy * s).xyz * 2.0 - 1.0;
  tx = vec3(tx.xy + n.zy, abs(tx.z) * n.x);
  ty = vec3(ty.xy + n.xz, abs(ty.z) * n.y);
  tz = vec3(tz.xy + n.xy, abs(tz.z) * n.z);
  return normalize(tx.zyx * w.x + ty.xzy * w.y + tz.xyz * w.z);
}
`;

export const WIND = { time: { value: 0 }, strength: { value: 1 }, dir: { value: new THREE.Vector2(0.8, 0.6) } };

const WIND_GLSL = /* glsl */`
uniform float uWindTime, uWindStrength; uniform vec2 uWindDir;
vec3 windOffset(vec3 wp, float flex, float phase){
  float t = uWindTime;
  float gust = 0.6 + 0.4 * sin(t * 0.37 + wp.x * 0.05) * sin(t * 0.23 + wp.z * 0.04);
  float s1 = sin(t * 1.7 + wp.x * 0.6 + wp.z * 0.4 + phase);
  float s2 = sin(t * 3.9 + wp.x * 1.7 - wp.z * 1.3 + phase * 2.0) * 0.35;
  vec2 d = uWindDir * (s1 + s2) * gust * uWindStrength * flex;
  return vec3(d.x, -abs(d.x + d.y) * 0.15, d.y);
}
`;

// Vertex-color AO (baked in Blender) applied as ambient occlusion rather than albedo.
function aoPatch(sh, strength = 1) {
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <color_fragment>', '')
    .replace('#include <aomap_fragment>', `
      #ifdef USE_COLOR
        float vAO = mix(1.0, vColor.r, ${strength.toFixed(2)});
        reflectedLight.indirectDiffuse *= vAO;
        reflectedLight.indirectSpecular *= vAO;
        reflectedLight.directDiffuse *= mix(1.0, vAO, 0.4);
      #endif
      #include <aomap_fragment>`);
}

// Standard material with baked-AO vertex colors and optional wind sway.
export function patchMaterial(mat, { ao = true, wind = null, extraFrag = null, key = '' } = {}) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    if (ao) aoPatch(sh, typeof ao === 'number' ? ao : 1);
    if (wind) {
      sh.uniforms.uWindTime = WIND.time; sh.uniforms.uWindStrength = WIND.strength; sh.uniforms.uWindDir = WIND.dir;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\n' + WIND_GLSL)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          {
            vec4 wp0 = vec4(transformed, 1.0);
            #ifdef USE_INSTANCING
              wp0 = instanceMatrix * wp0;
            #endif
            wp0 = modelMatrix * wp0;
            ${wind}
          }`);
    }
    if (extraFrag) extraFrag(sh);
  };
  mat.customProgramCacheKey = () => `p${ao}${wind ? wind.length : 0}${extraFrag ? 1 : 0}${key}${mat.uuid.slice(0, extraFrag && !key ? 8 : 0)}`;
  return mat;
}

// Triplanar rock material (world-space projection; moss creeps over upward faces).
export function makeRockMaterial(T, { moss = 0.55, scale = 0.45 } = {}) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, vertexColors: true, envMapIntensity: 0.7 });
  const u = {
    tRA: { value: T.rock.map }, tRN: { value: T.rock.normal }, tRO: { value: T.rock.orm },
    tMA: { value: T.moss.map }, tMN: { value: T.moss.normal }, tMO: { value: T.moss.orm },
    uMoss: { value: moss }, uScale: { value: scale },
  };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos; varying vec3 vWNrm;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        { vec4 wp = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            wp = instanceMatrix * wp;
          #endif
          wp = modelMatrix * wp; vWPos = wp.xyz;
          vec3 on = objectNormal;
          #ifdef USE_INSTANCING
            on = mat3(instanceMatrix) * on;
          #endif
          vWNrm = normalize(mat3(modelMatrix) * on); }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D tRA, tRN, tRO, tMA, tMN, tMO; uniform float uMoss, uScale;
        varying vec3 vWPos; varying vec3 vWNrm;
        ${SHADER_TRI}
        vec3 RA; vec3 RO; vec3 RW; float mossK;`)
      .replace('#include <map_fragment>', `
        vec3 wn0 = normalize(vWNrm);
        RW = triWeights(wn0);
        RA = triSample(tRA, vWPos, RW, uScale).rgb;
        RO = triSample(tRO, vWPos, RW, uScale).rgb;
        vec3 mA = triSample(tMA, vWPos, RW, 0.33).rgb;
        vec3 mO = triSample(tMO, vWPos, RW, 0.33).rgb;
        float mn = triSample(tMO, vWPos * 0.21, RW, 0.33).b;
        mossK = smoothstep(0.35, 0.8, wn0.y + (mn - 0.5) * 0.7) * uMoss;
        mossK = clamp(mossK + mO.b * 0.4 * step(0.05, mossK), 0.0, 1.0);
        diffuseColor = vec4(mix(RA, mA, mossK), opacity);
        RO = mix(RO, mO, mossK);`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = RO.g;')
      .replace('#include <normal_fragment_maps>', `{
          vec3 wn = normalize(vWNrm);
          vec3 nr = triNormal(tRN, vWPos, wn, RW, uScale);
          vec3 nm = triNormal(tMN, vWPos, wn, RW, 0.33);
          vec3 nW = normalize(mix(nr, nm, mossK));
          normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);
        }`)
      .replace('#include <color_fragment>', '')
      .replace('#include <aomap_fragment>', `
        float vAO = vColor.r * mix(1.0, RO.r, 0.8);
        reflectedLight.indirectDiffuse *= vAO; reflectedLight.indirectSpecular *= vAO;
        reflectedLight.directDiffuse *= mix(1.0, vColor.r, 0.45);`);
  };
  mat.customProgramCacheKey = () => 'rockTri';
  return mat;
}

// Thin-leaf translucency for scanned plants and grass: sunlight shining through leaves seen against the sun, and some
// ambient light from the far side (leaves are never black from behind). Uses the scene lighting model when present.
export function leafLight(sh, k = 1) {
  nearFade(sh);
  sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `
    {
      #ifdef LIT_SKY
        vec3 wpL = litWorldPos(); float svL = skyVisibility(wpL);
        float back = pow(clamp(dot(normalize(wpL - cameraPosition), uSunDirW), 0.0, 1.0), 3.0);
      #else
        float svL = 1.0; float back = 0.0;
      #endif
      outgoingLight += reflectedLight.indirectDiffuse * ${(0.3 * k).toFixed(3)}
                     + diffuseColor.rgb * vec3(1.0, 1.0, 0.62) * back * ${(0.55 * k).toFixed(3)} * mix(0.15, 1.0, svL);
    }
    #include <opaque_fragment>`);
}

// Foliage right in front of the lens dissolves (screen-door dither) instead of filling the view with giant leaves.
export function nearFade(sh, r0 = 0.12, r1 = 0.5) {
  sh.fragmentShader = sh.fragmentShader.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
    {
      float ign = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
      if (length(vViewPosition) < mix(${r0.toFixed(2)}, ${r1.toFixed(2)}, ign)) discard;
    }`);
}

