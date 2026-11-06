// Global uniforms shared by every patched material (same objects, so a write
// here updates all shaders at once), plus world constants.
import * as THREE from 'three';

export const WORLD = {
  SIZE: 16384,         // metres, square planet map centred on the origin
  HALF: 8192,
  RES: 2,              // metres between level-0 height samples
  WATER_FINAL: 0,      // sea level once terraforming fills the basins
  WATER_DRY: -400,     // below the deepest basin floor
  GRAVITY: 8.2,
  SEED: 4207,
  CURV: 1 / (2 * 60000),
};

export const U = {
  uTime: { value: 0 },
  uSunDir: { value: new THREE.Vector3(0.4, 0.7, 0.3).normalize() },
  uSunColor: { value: new THREE.Color(1, 0.95, 0.85) },
  uWB: { value: new THREE.Vector3(1, 1, 1) },   // camera white balance gains
  uNight: { value: 0 },          // 0 day .. 1 deep night
  uFrost: { value: 1 },          // terraform: frost cover on cold ground
  uWet: { value: 0 },            // rain wetness
  uMoss: { value: 0 },           // moss coverage 0..1
  uMicrobe: { value: 0 },        // microbial mats on wet shores 0..1
  uAlgae: { value: 0 },          // algae in lakes 0..1
  uLichen: { value: 0 },         // lichen rosettes on rock 0..1
  uGrass: { value: 0 },          // grass coverage 0..1
  uLush: { value: 0 },           // late-stage colour saturation
  uWaterLevel: { value: WORLD.WATER_DRY },
  uIce: { value: 1 },            // 1 = frozen surface, 0 = liquid
  uWind: { value: 0.3 },
  uWorldSize: { value: WORLD.SIZE },
  uGrowth: { value: new THREE.Vector4(0, 0, 0, 0) }, // flora growth per layer
  uGrowth2: { value: new THREE.Vector4(0, 0, 0, 0) },
  uGreen: { value: Array.from({ length: 8 }, () => new THREE.Vector4(0, 0, 0, 0)) }, // local greening (x, z, radius, strength)
  uSnowMelt: { value: 0 },
  uCloudCover: { value: 0 },
  uCloudTime: { value: 0 },
  tNoise: { value: null },
  tBiome: { value: null },
  tMod: { value: null },
  tHeight: { value: null },
};

export const srgb = (hex) => new THREE.Color(hex); // THREE.Color(hex) is already converted to linear working space
