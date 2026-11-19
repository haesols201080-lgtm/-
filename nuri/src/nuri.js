// In-game Nuri: loads the Blender-built skinned robot, rebuilds its PBR materials, and drives the rig
// procedurally (foot-planting leg IK, arm swing, lean, look-at, squash), with an animated LED face,
// a spring antenna, verlet-simulated scarf tails and hover jets.
import * as THREE from 'three';
import { clamp, lerp, damp } from './util.js';
import { patchMaterial } from './shaders.js';

// ---------------------------------------------------------------- LED face display
export const EXPRESSIONS = {
  neutral: { open: 1, size: 1, arc: 0, slant: 0, low: 0, droop: 0, asym: 0, heart: 0, gy: 0, width: 1 },
  smile: { open: 1, size: 1, arc: 1, slant: 0, low: 0, droop: 0, asym: 0, heart: 0, gy: 0, width: 1.1 },
  excited: { open: 1, size: 1.22, arc: 0, slant: 0, low: 0.25, droop: 0, asym: 0, heart: 0, gy: 0.05, width: 1.05, sparkle: 1 },
  surprised: { open: 1, size: 1.3, arc: 0, slant: 0, low: 0, droop: 0, asym: 0, heart: 0, gy: 0.05, width: 0.92 },
  curious: { open: 1, size: 1.05, arc: 0, slant: 0, low: 0, droop: 0, asym: 0.35, heart: 0, gy: 0, width: 1 },
  focused: { open: 0.62, size: 0.95, arc: 0, slant: 0.38, low: 0.12, droop: 0, asym: 0, heart: 0, gy: 0, width: 1.08 },
  worried: { open: 0.85, size: 0.95, arc: 0, slant: -0.45, low: 0, droop: 0, asym: 0, heart: 0, gy: -0.04, width: 0.95 },
  sleepy: { open: 0.28, size: 0.95, arc: 0, slant: 0, low: 0, droop: 0.2, asym: 0, heart: 0, gy: -0.08, width: 1.1 },
  sad: { open: 0.78, size: 0.95, arc: 0, slant: -0.6, low: 0, droop: 0.1, asym: 0, heart: 0, gy: -0.1, width: 0.95 },
  joy: { open: 1, size: 1.15, arc: 1, slant: 0, low: 0, droop: 0, asym: 0, heart: 0, gy: 0.06, width: 1.2, sparkle: 1 },
  love: { open: 1, size: 1.1, arc: 0, slant: 0, low: 0, droop: 0, asym: 0, heart: 1, gy: 0, width: 1 },
  dizzy: { open: 0.9, size: 0.9, arc: 0, slant: 0, low: 0, droop: 0, asym: 0, heart: 0, gy: 0, width: 1, x: 1 },
};

class FaceDisplay {
  constructor() {
    this.canvas = document.createElement('canvas'); this.canvas.width = 384; this.canvas.height = 240;
    this.g = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.flipY = false;
    this.cur = { ...EXPRESSIONS.neutral, sparkle: 0, x: 0 }; this.target = 'neutral';
    this.blink = 0; this.blinkT = 2 + Math.random() * 3; this.gazeX = 0; this.gazeY = 0; this.t = 0; this.acc = 1;
    const m = document.createElement('canvas'); m.width = m.height = 6;
    const mg = m.getContext('2d'); mg.fillStyle = '#000'; mg.fillRect(0, 0, 6, 6);
    mg.globalCompositeOperation = 'destination-out'; mg.beginPath(); mg.arc(3, 3, 2.4, 0, Math.PI * 2); mg.fill();
    this.dots = this.g.createPattern(m, 'repeat');
  }
  set(n) { if (EXPRESSIONS[n]) this.target = n; }
  update(dt) {
    this.t += dt; this.acc += dt;
    const T = EXPRESSIONS[this.target];
    let ch = false;
    for (const k of ['open', 'size', 'arc', 'slant', 'low', 'droop', 'asym', 'heart', 'gy', 'width', 'sparkle', 'x']) {
      const v = damp(this.cur[k] || 0, T[k] || 0, 12, dt);
      if (Math.abs(v - (this.cur[k] || 0)) > 1e-3) ch = true; this.cur[k] = v;
    }
    this.blinkT -= dt;
    if (this.blinkT <= 0) { this.blink = 1; this.blinkT = 2.2 + Math.random() * 3.5; if (Math.random() < 0.18) this.blinkT = 0.18; }
    if (this.blink > 0) { this.blink = Math.max(0, this.blink - dt * 7); ch = true; }
    if (Math.abs(this.gazeX - (this.pgx || 0)) + Math.abs(this.gazeY - (this.pgy || 0)) > 0.01) ch = true;
    if ((ch || this.cur.sparkle > 0.02) && this.acc > 1 / 30) { this.acc = 0; this.pgx = this.gazeX; this.pgy = this.gazeY; this.draw(); }
  }
  draw() {
    const g = this.g, W = this.canvas.width, H = this.canvas.height, c = this.cur;
    g.globalCompositeOperation = 'source-over'; g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    const bk = 1 - Math.sin(Math.min(1, this.blink) * Math.PI) * 0.95;
    const cx = W / 2 + this.gazeX * 30, cy = H * 0.5 - (this.gazeY + c.gy) * 46, sep = 72 * c.width;
    const col = '#46ecff'; g.shadowColor = '#2fd6ff'; g.shadowBlur = 16;
    for (const s of [-1, 1]) {
      const sz = c.size * (1 + s * c.asym * 0.25), rx = 30 * sz, ry = 40 * sz * c.open * bk;
      g.save(); g.translate(cx + s * sep, cy);
      if (c.heart > 0.5) {
        g.fillStyle = '#ff6fb1'; g.shadowColor = '#ff5fa0'; const k = 1.3 * sz * bk; g.scale(k, k);
        g.beginPath(); g.moveTo(0, 22); g.bezierCurveTo(-40, -2, -22, -36, 0, -14); g.bezierCurveTo(22, -36, 40, -2, 0, 22); g.fill();
      } else if (c.x > 0.5) {
        g.strokeStyle = col; g.lineWidth = 12; g.lineCap = 'round';
        g.beginPath(); g.moveTo(-20, -20); g.lineTo(20, 20); g.moveTo(20, -20); g.lineTo(-20, 20); g.stroke();
      } else if (c.arc > 0.5) {
        g.strokeStyle = col; g.lineWidth = 13 * sz; g.lineCap = 'round';
        g.beginPath(); g.arc(0, 14 * sz, 28 * sz, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
      } else {
        g.fillStyle = col; g.beginPath(); g.ellipse(0, 0, rx, Math.max(3, ry), 0, 0, Math.PI * 2); g.fill();
        g.globalCompositeOperation = 'destination-out';
        if (Math.abs(c.slant) > 0.01 || c.droop > 0.01) {
          g.save(); g.rotate(-s * c.slant * 0.55);
          g.fillRect(-90, -ry + (c.droop + Math.abs(c.slant) * 0.45) * ry * 2 - 180, 180, 180); g.restore();
        }
        if (c.low > 0.01) { g.beginPath(); g.ellipse(0, ry * (1.55 - c.low * 0.9), rx * 1.5, ry * 0.8, 0, 0, Math.PI * 2); g.fill(); }
        g.globalCompositeOperation = 'source-over';
        g.shadowBlur = 0; g.fillStyle = 'rgba(220,255,255,0.85)';
        if (ry > 12) { g.beginPath(); g.ellipse(-rx * 0.3, -ry * 0.35, rx * 0.22, ry * 0.18, 0, 0, Math.PI * 2); g.fill(); }
        g.shadowBlur = 16;
      }
      g.restore();
    }
    if (c.sparkle > 0.05) {
      g.fillStyle = `rgba(255,240,150,${c.sparkle})`;
      for (let i = 0; i < 3; i++) {
        const a = this.t * 2 + i * 2.1, x = W / 2 + Math.cos(a) * 150, y = 40 + i * 70 + Math.sin(a * 1.3) * 8, s = 7 + 3 * Math.sin(this.t * 6 + i);
        g.beginPath(); g.moveTo(x, y - s); g.lineTo(x + s * 0.35, y); g.lineTo(x, y + s); g.lineTo(x - s * 0.35, y); g.fill();
      }
    }
    g.shadowBlur = 0;
    g.globalCompositeOperation = 'destination-out'; g.globalAlpha = 0.5; g.fillStyle = this.dots; g.fillRect(0, 0, W, H);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    // faint scanlines
    g.fillStyle = 'rgba(0,0,0,0.18)'; for (let y = 0; y < H; y += 3) g.fillRect(0, y, W, 1);
    this.tex.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- materials
// Weathering shared by the robot's painted/metal parts: dust collects on the boots and lower legs (rest-pose height),
// plus fine grime mottling, so the robot sits in the same dirty, scanned world instead of looking freshly rendered.
export const DUST = { value: 0.6 };
export const WET = { value: 0 };
// ground the robot stands on: height + albedo tint of the surface (for contact occlusion and earth-coloured bounce)
export const GROUND = { y: { value: 0 }, tint: { value: new THREE.Color(1, 1, 1) } };
// set while three renders the screen-space refraction image for the water: the parts of the robot above the
// surface must not show up "under" the water (only its submerged body is refracted)
export const REFRACT = { pass: { value: 0 }, waterY: { value: -0.32 }, inWater: { value: 0 } };
const GROUND_TINT = { dirt: [1.16, 0.96, 0.8], leaves: [1.14, 1.0, 0.78], moss: [0.96, 1.1, 0.8], pebbles: [1.04, 1.0, 0.94], rock: [1.0, 1.0, 0.96] };
const WEATHER_GLSL = /* glsl */`
  varying vec3 vRest; varying vec3 vWPg; uniform float uDust, uWet, uGroundY; uniform vec3 uGroundTint; uniform float uRefrPass, uRefrWaterY, uInWater;
  float wh(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
  float wn(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(wh(i), wh(i + vec3(1,0,0)), f.x), mix(wh(i + vec3(0,1,0)), wh(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(wh(i + vec3(0,0,1)), wh(i + vec3(1,0,1)), f.x), mix(wh(i + vec3(0,1,1)), wh(i + vec3(1,1,1)), f.x), f.y), f.z); }`;
function weather(strength) {
  return (sh) => {
    sh.uniforms.uDust = DUST; sh.uniforms.uWet = WET; sh.uniforms.uGroundY = GROUND.y; sh.uniforms.uGroundTint = GROUND.tint;
    sh.uniforms.uRefrPass = REFRACT.pass; sh.uniforms.uRefrWaterY = REFRACT.waterY; sh.uniforms.uInWater = REFRACT.inWater;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vRest; varying vec3 vWPg;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRest = position;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWPg = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + WEATHER_GLSL)
      .replace('#include <map_fragment>', `#include <map_fragment>
        if (uRefrPass > 0.5 && vWPg.y > uRefrWaterY + 0.01) discard;
        float wnz = wn(vRest * 160.0) * 0.55 + wn(vRest * 38.0) * 0.45;
        float dust = (smoothstep(0.11, 0.012, vRest.y) * (0.35 + 0.65 * wnz) + smoothstep(0.24, 0.08, vRest.y) * 0.18 * wnz) * uDust * ${strength.toFixed(2)};
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.34, 0.29, 0.22) * (0.8 + 0.4 * wnz), clamp(dust, 0.0, 0.8));
        diffuseColor.rgb *= 0.9 + 0.1 * wn(vRest * 420.0);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.95, clamp(dust * 1.3, 0.0, 1.0));
        // wet: darker, glossy film (water beads dry from the top down)
        float wetK = uWet * smoothstep(0.45 - uWet * 0.45, 0.0, vRest.y - 0.02) * (0.75 + 0.25 * wn(vRest * 90.0));
        roughnessFactor = mix(roughnessFactor, 0.08, clamp(wetK, 0.0, 1.0));`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>')
      .replace('#include <aomap_fragment>', `#include <aomap_fragment>
        reflectedLight.directDiffuse *= 1.0 - 0.28 * clamp(wetK, 0.0, 1.0);
        reflectedLight.indirectDiffuse *= 1.0 - 0.28 * clamp(wetK, 0.0, 1.0);
        // the ground occludes the lower half of the sky near the feet and bounces earth-coloured light upward
        {
          vec3 nWg = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
          float gh = max(0.0, vWPg.y - uGroundY);
          float down = clamp(0.5 - 0.5 * nWg.y, 0.0, 1.0);
          float prox = exp(-gh / 0.045);
          float gAO = 1.0 - prox * (0.3 + 0.45 * down);
          reflectedLight.indirectDiffuse *= gAO * mix(vec3(1.0), uGroundTint, clamp(down * 1.2, 0.0, 1.0) * (0.6 + 0.4 * prox));
          reflectedLight.indirectSpecular *= mix(1.0, gAO, 0.8) * mix(vec3(1.0), uGroundTint, down * 0.7);
          reflectedLight.directDiffuse *= 1.0 - prox * down * 0.25;
        }`)
      .replace('#include <opaque_fragment>', `
        // under the surface: light is absorbed (green-blue, darker with depth) - the submerged body is not lit like air
        {
          float uw = uInWater * smoothstep(0.0, 0.12, uRefrWaterY - vWPg.y);
          outgoingLight *= mix(vec3(1.0), vec3(0.34, 0.5, 0.46), uw);
        }
        #include <opaque_fragment>`);
  };
}

const P = (o, w = 1) => patchMaterial(new THREE.MeshPhysicalMaterial({ envMapIntensity: 0.85, vertexColors: true, ...o }), { ao: 1, extraFrag: weather(w), key: 'nuri' + w });
// per material: [physical params, weathering strength]
const ROBOT_SPECS = {
  Nuri_PaintWhite: [{ color: 0xc9c4b9, roughness: 0.5, metalness: 0.04, clearcoat: 0.12, clearcoatRoughness: 0.35 }, 1],
  Nuri_PaintTeal: [{ color: 0x0d6f82, roughness: 0.46, metalness: 0.04, clearcoat: 0.15, clearcoatRoughness: 0.3 }, 1],
  Nuri_FrameGraphite: [{ color: 0x2c3036, roughness: 0.5, metalness: 1.0 }, 0.7],
  Nuri_Aluminium: [{ color: 0xb6b9bd, roughness: 0.32, metalness: 1.0 }, 0.6],
  Nuri_Rubber: [{ color: 0x17191c, roughness: 0.88, metalness: 0 }, 1.2],
  Nuri_LensGlass: [{ color: 0x050607, roughness: 0.03, metalness: 0, clearcoat: 1 }, 1],
  Nuri_Decal: [{ color: 0x3a3f45, roughness: 0.5 }, 1],
  Nuri_Scarf: [{ color: 0x24479a, roughness: 0.88, sheen: 1, sheenColor: new THREE.Color(0x7d98cc), sheenRoughness: 0.5, side: THREE.DoubleSide }, 1],
};
// Material for one robot mesh. When the GLB carries the textures baked in Blender (paint orange-peel, chipped edges,
// scratches, cavity grime, brushed metal, knit), they drive colour / roughness / metal / normal; otherwise flat values.
function robotMaterial(key, glbMat) {
  if (key === 'Nuri_Glow') return new THREE.MeshStandardMaterial({ color: 0x0a2a33, emissive: 0x4fe8ff, emissiveIntensity: 2.4, roughness: 0.3 });
  const [spec, w] = ROBOT_SPECS[key];
  const o = { ...spec };
  if (glbMat && glbMat.map) {
    // weathered off-white rather than studio white, so the shell sits in the forest's tonal range
    Object.assign(o, { map: glbMat.map, color: key === 'Nuri_PaintWhite' ? 0xe4dfd5 : 0xffffff, roughness: 1, metalness: 1 });
    if (glbMat.roughnessMap) o.roughnessMap = glbMat.roughnessMap;
    if (glbMat.metalnessMap) o.metalnessMap = glbMat.metalnessMap;
    if (glbMat.normalMap) { o.normalMap = glbMat.normalMap; o.normalScale = glbMat.normalScale.clone(); }
    for (const t of [o.map, o.roughnessMap, o.metalnessMap, o.normalMap]) if (t) t.anisotropy = 8;
  } else if (key === 'Nuri_Scarf') { o.normalMap = makeKnitNormal(); o.normalScale = new THREE.Vector2(0.9, 0.9); }
  return P(o, w);
}

function makeKnitNormal() {
  const s = 64, d = new Uint8Array(s * s * 4);
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    // ribbed knit: V-shaped stitches in columns
    const cx = (x % 8) - 4, row = (y + Math.abs(cx) * 1.2) % 8;
    const hx = Math.cos((cx / 4) * Math.PI) * 0.5, hy = Math.sin((row / 8) * Math.PI * 2) * 0.35;
    const n = new THREE.Vector3(-hx * 0.6, -hy * 0.6, 1).normalize();
    const o = (y * s + x) * 4; d[o] = (n.x * 0.5 + 0.5) * 255; d[o + 1] = (n.y * 0.5 + 0.5) * 255; d[o + 2] = (n.z * 0.5 + 0.5) * 255; d[o + 3] = 255;
  }
  const t = new THREE.DataTexture(d, s, s); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 6); t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.needsUpdate = true; return t;
}

// ---------------------------------------------------------------- the robot
const AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0), AZ = new THREE.Vector3(0, 0, 1);
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3();

export class Nuri {
  constructor(gltf) {
    this.root = new THREE.Group(); this.root.name = 'NuriRoot';
    const model = gltf.scene; this.model = model;
    this.root.add(model);
    this.face = new FaceDisplay();
    const matCache = {};
    this.mats = matCache;
    model.traverse((o) => {
      if (o.isMesh) {
        const n = o.name;
        if (n.includes('Screen')) {
          // the exported screen's triangles wind inward (back faces toward the viewer): flip them so the LED face shows
          const ix = o.geometry.index;
          if (ix && !o.geometry.userData.flipped) { for (let i = 0; i < ix.count; i += 3) { const t = ix.getX(i + 1); ix.setX(i + 1, ix.getX(i + 2)); ix.setX(i + 2, t); } ix.needsUpdate = true; o.geometry.userData.flipped = true; }
          o.material = new THREE.MeshPhysicalMaterial({ color: 0x010203, roughness: 0.06, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03,
            emissive: 0xffffff, emissiveMap: this.face.tex, emissiveIntensity: 2.4 });
        } else {
          const key = [...Object.keys(ROBOT_SPECS), 'Nuri_Glow'].find((k) => n.startsWith(k));
          if (key) o.material = matCache[key] || (matCache[key] = robotMaterial(key, o.material));
        }
        o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
        // three renders the water's refraction image into a mip-mapped target: flag that pass for the robot shader
        o.onBeforeRender = (r) => { const rt = r.getRenderTarget(); REFRACT.pass.value = rt && rt.texture.generateMipmaps && rt.texture.minFilter === THREE.LinearMipmapLinearFilter ? 1 : 0; };
      }
    });
    // bones
    this.b = {};
    model.traverse((o) => { if (o.isBone || o.type === 'Object3D' || o.isObject3D) this.b[o.name] = o; });
    // GLTFLoader strips '.' from node names ("foot.L" -> "footL"); add dotted aliases
    for (const [n, o] of Object.entries({ ...this.b })) {
      let m;
      if ((m = n.match(/^scarf(\d)(\d)$/))) this.b[`scarf${m[1]}.${m[2]}`] = o;
      else if ((m = n.match(/^(upperArm|forearm|hand|thigh|shin|foot)([LR])$/))) this.b[`${m[1]}.${m[2]}`] = o;
    }
    this.model.updateMatrixWorld(true);
    this.rest = {};
    const invRoot = new THREE.Quaternion().copy(this.model.getWorldQuaternion(new THREE.Quaternion())).invert();
    for (const [name, o] of Object.entries(this.b)) {
      if (!o.isBone) continue;
      const W0 = o.getWorldQuaternion(new THREE.Quaternion()).premultiply(invRoot);
      this.rest[name] = { q0: o.quaternion.clone(), W0, W0i: W0.clone().invert(), p0: o.position.clone() };
    }
    this.legLen = { thigh: 0.032, shin: 0.034, ankle: 0.038 };
    this.hipY = 0.104;
    // hover jets under each boot
    this.jets = [];
    const jm = new THREE.MeshBasicMaterial({ color: 0x8cefff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    for (const side of ['L', 'R']) {
      const g = new THREE.ConeGeometry(0.016, 0.075, 16, 1, true); g.translate(0, -0.0375, 0); g.rotateX(Math.PI);
      const jet = new THREE.Mesh(g, jm); jet.rotation.x = Math.PI; jet.renderOrder = 6; jet.visible = false;
      this.jetHolder = this.jetHolder || {};
      const holder = new THREE.Group(); holder.position.set(side === 'L' ? 0.036 : -0.036, -0.03, 0.01);
      holder.add(jet); this.b[`foot.${side}`].add(holder);
      this.jets.push(jet);
    }
    this.jetMat = jm;
    // state
    this.phase = 0; this.t = 0; this.breathe = 0; this.P = {};
    this.lookYaw = 0; this.lookPitch = 0; this.idleLook = { yaw: 0, pitch: 0, t: 0 };
    this.squash = 1; this.jetPower = 0; this.climbPhase = 0;
    this.ant = { ang: new THREE.Vector2(), vel: new THREE.Vector2(), prev: new THREE.Vector3(), pv: new THREE.Vector3(), init: false };
    this.scarf = [0, 1].map((k) => ({ bones: [0, 1, 2, 3, 4].map((i) => this.b[`scarf${k}.${i}`]), pts: [], old: [], len: [] }));
    this.scarfInit = false;
  }

  setExpression(n) { this.face.set(n); }

  // apply a rotation expressed in the character rest frame (carried by the parent)
  // ground under the robot: contact occlusion height + surface colour for the bounce light
  setGround(y, surface, onTerrain) {
    GROUND.y.value = y;
    const t = (onTerrain && GROUND_TINT[surface]) || GROUND_TINT.rock;
    GROUND.tint.value.lerp(new THREE.Color(t[0], t[1], t[2]), 0.1);
  }
  rot(name, x = 0, y = 0, z = 0) {
    const r = this.rest[name]; if (!r) return;
    _e.set(x, y, z, 'YXZ'); _q.setFromEuler(_e);
    _q2.copy(r.W0i).multiply(_q).multiply(r.W0);
    this.b[name].quaternion.copy(r.q0).multiply(_q2);
  }

  solveLeg(side, ty, tz, pitch) {
    const l1 = this.legLen.thigh, l2 = this.legLen.shin;
    const d = clamp(Math.hypot(ty, tz), 0.01, l1 + l2 - 1e-4);
    const a = Math.atan2(tz, -ty);
    const kneeBend = Math.PI - Math.acos(clamp((l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2), -1, 1));
    const hipOff = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
    const thighX = -(a + hipOff);
    this.rot(`thigh.${side}`, thighX, 0, 0);
    this.rot(`shin.${side}`, kneeBend, 0, 0);
    this.rot(`foot.${side}`, -(thighX + kneeBend) + (pitch || 0), 0, 0);
  }

  update(dt, p, env) {
    this.t += dt; this.face.update(dt);
    const st = p.state, speed = p.speed || 0, run = clamp(speed / 2.3, 0, 1);
    const stride = lerp(0.055, 0.105, run);
    if (p.grounded && ['move', 'push', 'crawl', 'carry'].includes(st)) this.phase += (speed * dt) / (2 * stride);
    const ph = this.phase * Math.PI * 2;
    this.breathe += dt * (st === 'idle' ? 2.2 : 3.5);
    const br = Math.sin(this.breathe);
    // targets (character frame). L = +x side.
    let hipsY = this.hipY - 0.004, spineX = 0, spineY = 0, spineZ = 0, roll = 0, headX = 0, headY = 0, headZ = 0, squashT = 1, jets = 0;
    const arm = { L: { x: 0, z: 0.14, e: -0.25 }, R: { x: 0, z: -0.14, e: -0.25 } };
    const leg = { L: { y: -0.064, z: 0, p: 0 }, R: { y: -0.064, z: 0, p: 0 } };
    if (st === 'idle' || st === 'inspect' || st === 'wave' || st === 'sleep') {
      hipsY = this.hipY - 0.006 + br * 0.0012; spineX = 0.02 + br * 0.01;
      const sh = Math.sin(this.t * 0.7) * 0.003; roll = Math.sin(this.t * 0.7) * 0.02;
      leg.L.y = -0.062 + Math.max(0, sh); leg.R.y = -0.062 + Math.max(0, -sh); leg.L.z = 0.004; leg.R.z = -0.002;
      arm.L.z = 0.14 + br * 0.02; arm.R.z = -0.14 - br * 0.02;
      const tap = Math.max(0, Math.sin(this.t * 9)) * (Math.sin(this.t * 0.37) > 0.92 ? 1 : 0); leg.R.p = -tap * 0.35;
      if (st === 'inspect') { spineX = 0.3; hipsY -= 0.008; arm.L.x = -0.7; arm.R.x = -0.5; arm.L.e = -1.0; headZ = 0.25; }
      if (st === 'wave') { arm.R.x = -0.3; arm.R.z = -2.6; arm.R.e = -0.6 + Math.sin(this.t * 14) * 0.5; headZ = -0.15; }
      if (st === 'sleep') { spineX = 0.35; headX = 0.35; hipsY -= 0.012; arm.L.z = 0.05; arm.R.z = -0.05; }
    } else if (['move', 'carry', 'push', 'crawl'].includes(st)) {
      const s = Math.sin(ph), c = Math.cos(ph), lift = lerp(0.014, 0.028, run);
      for (const [k, off] of [['L', 0], ['R', Math.PI]]) {
        const q = (((ph + off) / (Math.PI * 2)) % 1 + 1) % 1;
        let z, y;
        if (q < 0.5) { z = lerp(stride * 0.5, -stride * 0.5, q / 0.5); y = 0; }
        else { const t = (q - 0.5) / 0.5, e = 0.5 - 0.5 * Math.cos(t * Math.PI); z = lerp(-stride * 0.5, stride * 0.5, e); y = Math.sin(t * Math.PI) * lift; }
        leg[k].z = z; leg[k].y = -0.064 + y + (st === 'crawl' ? 0.016 : 0) + run * 0.004;
        leg[k].p = q >= 0.5 ? Math.sin((q - 0.5) * 2 * Math.PI) * 0.4 : -0.1 * (q / 0.5);
      }
      hipsY = this.hipY - 0.004 - lerp(0.002, 0.01, run) + Math.abs(c) * lerp(0.003, 0.008, run);
      spineX = lerp(0.05, 0.24, run) + (p.accelLean || 0); spineY = s * lerp(0.06, 0.12, run);
      roll = -c * lerp(0.03, 0.05, run) + (p.turnLean || 0);
      arm.L.x = s * lerp(0.5, 1.1, run); arm.R.x = -s * lerp(0.5, 1.1, run);
      arm.L.e = arm.R.e = -lerp(0.3, 1.1, run); arm.L.z = 0.16; arm.R.z = -0.16;
      headX = -spineX * 0.6;
      if (st === 'crawl') { hipsY = 0.082; spineX = 0.55; headX = -0.4; arm.L.x = -1.2 + s * 0.4; arm.R.x = -1.2 - s * 0.4; }
      if (st === 'push') { spineX = p.pulling ? -0.15 : 0.42; hipsY -= 0.006; arm.L.x = arm.R.x = -1.45; arm.L.e = arm.R.e = -0.4; arm.L.z = 0.25; arm.R.z = -0.25; headX = -0.25; }
    } else if (['jump', 'fall', 'hover', 'djump'].includes(st)) {
      const up = clamp((p.vy || 0) / 4, -1, 1);
      spineX = -0.05 * up + 0.08;
      leg.L.y = -0.058 + (up > 0 ? 0.01 : 0); leg.R.y = -0.05; leg.L.z = 0.012 * up; leg.R.z = -0.012 - 0.01 * up; leg.R.p = 0.4;
      arm.L.z = lerp(0.4, 1.2, (up + 1) / 2); arm.R.z = -arm.L.z; arm.L.x = arm.R.x = -0.3; arm.L.e = arm.R.e = -0.5;
      squashT = 1 + clamp((p.vy || 0) * 0.03, -0.06, 0.08);
      if (st === 'djump') { arm.L.z = 1.6; arm.R.z = -1.6; jets = 1; }
      if (st === 'hover') {
        jets = 0.9 + Math.sin(this.t * 40) * 0.1;
        leg.L.y = leg.R.y = -0.064; leg.L.z = leg.R.z = 0; leg.L.p = leg.R.p = 0.3;
        arm.L.z = 0.8 + Math.sin(this.t * 9) * 0.08; arm.R.z = -arm.L.z; spineX = 0.1; squashT = 1;
      }
      headX = -0.1 * up;
    } else if (st === 'roll') {
      hipsY = 0.08; spineX = 0.9; headX = 0.4;
      leg.L.y = leg.R.y = -0.03; leg.L.z = leg.R.z = 0.03; arm.L.x = arm.R.x = -1.2; arm.L.e = arm.R.e = -1.6;
    } else if (st === 'slide') {
      hipsY = 0.07; spineX = -0.55; headX = 0.35; leg.L.y = -0.03; leg.L.z = 0.06; leg.R.y = -0.04; leg.R.z = 0.05;
      arm.L.z = 0.9; arm.R.z = -0.9; arm.L.x = arm.R.x = 0.4;
    } else if (st === 'land') {
      const k = p.landK || 0;
      hipsY = this.hipY - 0.004 - 0.018 * k; spineX = 0.25 * k;
      leg.L.y = leg.R.y = -0.064 + 0.018 * k; leg.L.z = 0.01; leg.R.z = -0.01; arm.L.z = 0.4 * k + 0.14; arm.R.z = -arm.L.z; squashT = 1 - 0.12 * k;
    } else if (st === 'swim') {
      const s = Math.sin(this.t * 6), c = Math.cos(this.t * 6);
      spineX = 0.9 * clamp(speed / 1.2, 0.3, 1); headX = -spineX * 0.85;
      arm.L.x = -1.8 + s * 1.2; arm.R.x = -1.8 - s * 1.2; arm.L.z = 0.5; arm.R.z = -0.5;
      leg.L.y = -0.06 + 0.01 * s; leg.R.y = -0.06 - 0.01 * s; leg.L.z = leg.R.z = -0.02; leg.L.p = 0.4 + c * 0.3; leg.R.p = 0.4 - c * 0.3;
    } else if (st === 'climb') {
      this.climbPhase += (p.climbSpeed || 0) * dt * 7; const s = Math.sin(this.climbPhase);
      arm.L.x = -2.5 + s * 0.4; arm.R.x = -2.5 - s * 0.4; arm.L.e = arm.R.e = -0.5; arm.L.z = 0.15; arm.R.z = -0.15;
      leg.L.y = -0.052 + 0.014 * Math.max(0, -s); leg.R.y = -0.052 + 0.014 * Math.max(0, s); leg.L.z = leg.R.z = 0.02; headX = -0.2;
    } else if (st === 'hang' || st === 'climbup') {
      const t = st === 'climbup' ? (p.climbT || 0) : 0;
      arm.L.x = arm.R.x = lerp(-2.9, -0.6, t); arm.L.e = arm.R.e = lerp(-0.2, -1.4, t); arm.L.z = 0.18; arm.R.z = -0.18;
      spineX = lerp(0.05, 0.6, t);
      leg.L.y = -0.064 + Math.sin(this.t * 3) * 0.004; leg.R.y = -0.064 - Math.sin(this.t * 3) * 0.004; leg.L.p = leg.R.p = 0.4;
      if (t > 0) { leg.R.y = lerp(-0.064, -0.035, t); leg.R.z = lerp(0, 0.04, t); }
      headX = -0.25;
    } else if (st === 'throw' || st === 'kick' || st === 'press') {
      const t = p.actT || 0;
      if (st === 'throw') {
        const back = t < 0.3;
        arm.R.x = back ? lerp(-1.6, -2.9, t / 0.3) : lerp(-2.9, -0.6, (t - 0.3) / 0.7); arm.L.x = -0.8; arm.R.e = -0.5;
        spineY = back ? 0.35 : -0.3; spineX = back ? -0.1 : 0.25;
      } else if (st === 'kick') {
        const k = Math.sin(t * Math.PI);
        leg.R.z = -0.03 + k * 0.07; leg.R.y = -0.058 + k * 0.016; leg.R.p = -k * 0.6; arm.L.x = -k * 0.6; arm.R.x = k * 0.6; spineX = -0.1 * k;
      } else { const k = Math.sin(t * Math.PI); arm.R.x = -1.4 * k - 0.2; arm.R.e = -0.2; spineX = 0.2 * k; }
    }
    if (p.carrying && st !== 'throw') { arm.L.x = arm.R.x = -2.7; arm.L.e = arm.R.e = -0.35; arm.L.z = 0.3; arm.R.z = -0.3; }

    // look at
    let ly = 0, lp = 0;
    if (p.lookDir) { ly = clamp(p.lookDir.yaw, -1.1, 1.1); lp = clamp(p.lookDir.pitch, -0.5, 0.45); }
    else if (st === 'idle') {
      const il = this.idleLook; il.t -= dt;
      if (il.t <= 0) { il.t = 1.5 + Math.random() * 3; il.yaw = (Math.random() - 0.5) * 1.4; il.pitch = (Math.random() - 0.3) * 0.4; if (Math.random() < 0.3) il.yaw = il.pitch = 0; }
      ly = il.yaw; lp = il.pitch;
    }
    this.lookYaw = damp(this.lookYaw, ly, 6, dt); this.lookPitch = damp(this.lookPitch, lp, 6, dt);
    this.face.gazeX = damp(this.face.gazeX, clamp(-this.lookYaw * 0.5, -0.6, 0.6), 10, dt);
    this.face.gazeY = damp(this.face.gazeY, clamp(this.lookPitch * 0.6, -0.4, 0.4), 10, dt);

    // smooth + apply
    const P = this.P;
    const sm = (k, v, l = 18) => (P[k] = P[k] === undefined ? v : damp(P[k], v, l, dt));
    const rollT = st === 'roll' ? (p.rollT || 0) * Math.PI * 2 : 0;
    this.b.hips.position.y = this.rest.hips.p0.y + (sm('hy', hipsY) - this.hipY) + (p.groundDrop || 0);
    this.rot('root', st === 'roll' ? rollT : sm('rx', 0, 20), 0, sm('roll', roll, 10));
    this.rot('spine', sm('sx', spineX, 14), sm('sy', spineY, 14), sm('sz', spineZ, 14));
    this.rot('neck', 0, this.lookYaw * 0.15, 0);
    this.rot('head', sm('hx', headX + this.lookPitch, 12), sm('hyw', headY + this.lookYaw * 0.85 - P.sy * 0.6, 12), sm('hz', headZ + (this.face.target === 'curious' ? 0.28 : 0) + (p.headTilt || 0), 8));
    for (const k of ['L', 'R']) {
      const a = arm[k];
      this.rot(`upperArm.${k}`, sm('ax' + k, a.x), 0, sm('az' + k, a.z));
      this.rot(`forearm.${k}`, sm('ex' + k, a.e), 0, 0);
      this.rot(`hand.${k}`, 0, 0, 0);
      const l = leg[k];
      this.solveLeg(k, sm('ly' + k, l.y + (p.footOffset ? p.footOffset[k] : 0), 30), sm('lz' + k, l.z, 30), sm('lp' + k, l.p, 20));
    }
    this.squash = damp(this.squash, squashT, 16, dt);
    this.model.scale.set(1 / Math.sqrt(this.squash), this.squash, 1 / Math.sqrt(this.squash));
    this.jetPower = damp(this.jetPower, jets, 14, dt);
    this.jetMat.opacity = this.jetPower * 0.85;
    for (const j of this.jets) { j.visible = this.jetPower > 0.02; j.scale.set(1, 0.6 + this.jetPower * (0.6 + Math.random() * 0.3), 1); }
    this.mats.Nuri_Glow.emissiveIntensity = 2.2 + Math.sin(this.t * 2.4) * 0.4 + this.jetPower * 2;
    this.root.updateMatrixWorld(true);
    this.updateAntenna(dt);
    this.updateScarf(dt, env);
  }

  updateAntenna(dt) {
    const a = this.ant, b0 = this.b.antenna0;
    b0.getWorldPosition(_v);
    if (!a.init) { a.prev.copy(_v); a.pv.set(0, 0, 0); a.init = true; }
    const vel = _v2.copy(_v).sub(a.prev).divideScalar(Math.max(dt, 1e-4));
    const acc = vel.clone().sub(a.pv).divideScalar(Math.max(dt, 1e-4));
    a.prev.copy(_v); a.pv.copy(vel);
    this.b.head.getWorldQuaternion(_q).invert(); acc.applyQuaternion(_q);
    const fx = clamp(-acc.z * 0.012, -6, 6), fz = clamp(acc.x * 0.012, -6, 6);
    a.vel.x += (fx - a.ang.x * 260 - a.vel.x * 9) * dt; a.vel.y += (fz - a.ang.y * 260 - a.vel.y * 9) * dt;
    a.ang.x = clamp(a.ang.x + a.vel.x * dt, -0.9, 0.9); a.ang.y = clamp(a.ang.y + a.vel.y * dt, -0.9, 0.9);
    this.rot('antenna0', a.ang.x * 0.5, 0, a.ang.y * 0.5);
    this.rot('antenna1', a.ang.x * 0.9, 0, a.ang.y * 0.9);
  }

  updateScarf(dt, env) {
    const sdt = Math.min(dt, 1 / 30);
    const gravity = -9.8 * 0.5 * sdt * sdt;
    const wind = env && env.wind ? env.wind : _v.set(0, 0, 0);
    const head = this.b.head.getWorldPosition(new THREE.Vector3());
    const chest = this.b.spine.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.05, 0));
    const back = new THREE.Vector3(0, 0, -1).transformDirection(this.root.matrixWorld);
    const bodies = [{ c: head.add(new THREE.Vector3(0, 0.07, 0)), r: 0.105 }, { c: chest, r: 0.07 }];
    for (const s of this.scarf) {
      const N = s.bones.length;
      if (!this.scarfInit) {
        for (let i = 0; i < N; i++) { const p = s.bones[i].getWorldPosition(new THREE.Vector3()); s.pts[i] = p; s.old[i] = p.clone(); }
        const lastDir = s.pts[N - 1].clone().sub(s.pts[N - 2]);
        s.pts[N] = s.pts[N - 1].clone().add(lastDir); s.old[N] = s.pts[N].clone();
        for (let i = 0; i < N; i++) s.len[i] = s.pts[i + 1].distanceTo(s.pts[i]);
      }
      s.bones[0].getWorldPosition(s.pts[0]); s.old[0].copy(s.pts[0]);
      for (let i = 1; i <= N; i++) {
        const p = s.pts[i], o = s.old[i];
        const vx = (p.x - o.x) * 0.94, vy = (p.y - o.y) * 0.94, vz = (p.z - o.z) * 0.94;
        o.copy(p); p.x += vx + wind.x * sdt * sdt * 0.4; p.y += vy + gravity; p.z += vz + wind.z * sdt * sdt * 0.4;
      }
      for (let it = 0; it < 4; it++) {
        for (let i = 1; i <= N; i++) {
          const a = s.pts[i - 1], b = s.pts[i];
          _v2.subVectors(b, a); const d = _v2.length() || 1e-6; const k = (d - s.len[i - 1]) / d;
          if (i === 1) b.addScaledVector(_v2, -k); else { a.addScaledVector(_v2, k * 0.5); b.addScaledVector(_v2, -k * 0.5); }
        }
        for (let i = 1; i <= N; i++) {
          const p = s.pts[i];
          for (const bd of bodies) { _v2.subVectors(p, bd.c); const d = _v2.length(); if (d < bd.r) p.addScaledVector(_v2, (bd.r - d) / (d || 1e-6)); }
          _v2.subVectors(p, s.pts[0]); const f = -_v2.dot(back); if (f > -0.004) p.addScaledVector(back, f + 0.004);
        }
      }
      // orient bones along the simulated chain
      for (let i = 0; i < N; i++) {
        const bone = bones_update(s.bones[i]);
        const cur = new THREE.Vector3(0, 1, 0).applyQuaternion(bone.getWorldQuaternion(_q));
        const want = _v2.subVectors(s.pts[i + 1], s.pts[i]).normalize();
        const rq = new THREE.Quaternion().setFromUnitVectors(cur, want);
        const wq = _q.clone().premultiply(rq);
        const pq = bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
        bone.quaternion.copy(pq.multiply(wq));
        bone.updateMatrixWorld(true);
      }
    }
    this.scarfInit = true;
  }
}

function bones_update(b) { b.updateMatrixWorld(true); return b; }
