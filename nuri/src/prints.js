// Footprints & ground marks. Each print is a lit decal (instanced quad aligned to the ground) whose height map is
// the robot's actual boot sole: a rounded rubber outsole with a 3 x 6 grid of lugs. Prints differ by surface
// (deep in dirt/mud, faint in litter, wet on rock and wood after swimming), fade over time, and bend grass flat.
import * as THREE from 'three';

const MAX = 260;

function soleTextures(w = 96, h = 144) {
  // height field of the imprint (0 = undisturbed, 1 = deepest), mask (where the print is visible)
  const H = new Float32Array(w * h), A = new Float32Array(w * h);
  const rr = (x, y, cx, cy, hw, hh, r) => { // signed distance to a rounded rectangle
    const qx = Math.abs(x - cx) - hw + r, qy = Math.abs(y - cy) - hh + r;
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = (x + 0.5) / w, v = (y + 0.5) / h;
    // sole outline (toe slightly wider than heel)
    const taper = 0.36 + 0.06 * (1 - v);
    const sole = rr(u, v, 0.5, 0.5, taper, 0.44, 0.16);
    let hgt = 0;
    if (sole < 0) {
      hgt = 0.55 + 0.1 * Math.min(1, -sole * 12);              // flat sole press
      // lugs: 3 columns x 6 rows press deeper
      for (let i = 0; i < 3; i++) for (let j = 0; j < 6; j++) {
        const d = rr(u, v, 0.5 + (i - 1) * 0.25, 0.12 + j * 0.152, 0.095, 0.058, 0.03);
        if (d < 0.012) hgt = Math.max(hgt, 0.55 + 0.45 * Math.min(1, (0.012 - d) * 40));
      }
    }
    // pushed-up rim of displaced soil around the outline
    const rim = Math.exp(-((sole - 0.03) ** 2) / 0.0006) * 0.35;
    H[y * w + x] = hgt - rim;
    A[y * w + x] = sole < 0 ? 1 : Math.max(0, 1 - sole / 0.06) * 0.6;
  }
  // normal map from the height field (pressed = lower)
  const nrm = new Uint8Array(w * h * 4), mask = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const g = (xx, yy) => -H[Math.min(h - 1, Math.max(0, yy)) * w + Math.min(w - 1, Math.max(0, xx))];
    const dx = (g(x + 1, y) - g(x - 1, y)) * 2.2, dy = (g(x, y + 1) - g(x, y - 1)) * 2.2;
    const n = new THREE.Vector3(-dx, dy, 1).normalize(), o = (y * w + x) * 4;
    nrm[o] = (n.x * 0.5 + 0.5) * 255; nrm[o + 1] = (n.y * 0.5 + 0.5) * 255; nrm[o + 2] = (n.z * 0.5 + 0.5) * 255; nrm[o + 3] = 255;
    const k = y * w + x;
    mask[o] = Math.max(0, H[k]) * 255; mask[o + 1] = Math.min(1, A[k]) * 255; mask[o + 2] = Math.max(0, -H[k]) * 255 * 2; mask[o + 3] = 255;
  }
  const mk = (d) => { const t = new THREE.DataTexture(d, w, h); t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true; return t; };
  return { normal: mk(nrm), mask: mk(mask) };
}

function skidTextures(w = 64, h = 128) {
  const nrm = new Uint8Array(w * h * 4), mask = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = (x + 0.5) / w, v = (y + 0.5) / h;
    const across = Math.abs(u - 0.5) * 2, along = Math.min(v, 1 - v) * 2;
    const depth = Math.max(0, 1 - across ** 2) * Math.min(1, along * 4) * (0.6 + 0.4 * Math.sin(u * 40) ** 2);
    const o = (y * w + x) * 4;
    const dxn = -Math.sign(u - 0.5) * 0.5 * Math.min(1, along * 4);
    const n = new THREE.Vector3(dxn * (1 - across), 0, 1).normalize();
    nrm[o] = (n.x * 0.5 + 0.5) * 255; nrm[o + 1] = 128; nrm[o + 2] = (n.z * 0.5 + 0.5) * 255; nrm[o + 3] = 255;
    mask[o] = depth * 255; mask[o + 1] = Math.min(1, depth * 1.6) * 255; mask[o + 2] = 0; mask[o + 3] = 255;
  }
  const mk = (d) => { const t = new THREE.DataTexture(d, w, h); t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true; return t; };
  return { normal: mk(nrm), mask: mk(mask) };
}

class DecalSet {
  constructor(scene, tex, size) {
    const geo = new THREE.PlaneGeometry(size[0], size[1]); geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, depthWrite: false, normalMap: tex.normal, normalScale: new THREE.Vector2(1.6, 1.6),
      roughness: 0.9, metalness: 0, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    const u = { tMask: { value: tex.mask } };
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.tMask = u.tMask;
      // per-instance colour encodes: r = strength (fades to 0), g = wetness, b = surface (0 litter .. 1 soft dirt/mud)
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D tMask;')
        .replace('#include <color_fragment>', `
          vec4 mk = texture2D(tMask, vNormalMapUv);
          float strength = vColor.r, wet = vColor.g, soft = vColor.b;
          float press = mk.r, area = mk.g, rim = mk.b;
          vec3 soil = mix(vec3(0.16, 0.115, 0.075), vec3(0.11, 0.075, 0.05), soft);
          vec3 rimCol = vec3(0.3, 0.24, 0.17);
          diffuseColor.rgb = mix(soil * (1.0 - 0.35 * press * soft), rimCol, clamp(rim, 0.0, 1.0) * soft);
          diffuseColor.rgb *= mix(1.0, 0.62, wet);
          diffuseColor.a = clamp(area * (0.35 + 0.65 * soft) + wet * area * 0.6, 0.0, 1.0) * strength;`)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.12, wet);')
        .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = normalize(mix(nonPerturbedNormal, normal, clamp(soft + 0.25, 0.0, 1.0) * strength));');
    };
    mat.customProgramCacheKey = () => 'decal';
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX); this.mesh.count = 0; this.mesh.receiveShadow = true; this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    // colour attribute exists from the start so the shader compiles with USE_INSTANCING_COLOR
    this.mesh.setColorAt(0, new THREE.Color(0, 0, 0));
    scene.add(this.mesh);
    this.items = []; this.next = 0;
  }
  add(pos, normal, yaw, strength, wet, soft, scaleX = 1, scaleY = 1) {
    const it = { pos: pos.clone(), normal: normal.clone(), yaw, s0: strength, wet0: wet, soft, t: 0, sx: scaleX, sy: scaleY };
    if (this.items.length < MAX) this.items.push(it); else { this.items[this.next] = it; this.next = (this.next + 1) % MAX; }
  }
  update(dt) {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), q2 = new THREE.Quaternion(), s = new THREE.Vector3(), c = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);
    let n = 0;
    for (const it of this.items) {
      it.t += dt;
      const life = it.soft > 0.5 ? 120 : 45;          // deep prints in soft ground last longer
      const k = it.s0 * Math.max(0, 1 - it.t / life);
      const wet = it.wet0 * Math.max(0, 1 - it.t / 25); // wet prints dry within ~25 s
      if (k <= 0.01 && wet <= 0.01) continue;
      q.setFromUnitVectors(up, it.normal); q2.setFromAxisAngle(up, it.yaw); q.multiply(q2);
      s.set(it.sx, 1, it.sy);
      m.compose(it.pos, q, s); this.mesh.setMatrixAt(n, m);
      c.setRGB(Math.max(k, wet * 0.9), wet, it.soft); this.mesh.setColorAt(n, c);
      n++;
    }
    this.mesh.count = n; this.mesh.instanceMatrix.needsUpdate = true; if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

export class Prints {
  constructor(scene, world, marks) {
    this.world = world; this.T = world.terrain; this.marks = marks;
    this.soleTex = soleTextures(); this.skidTex = skidTextures();
    this.feet = new DecalSet(scene, this.soleTex, [0.064, 0.098]);
    this.skids = new DecalSet(scene, this.skidTex, [0.07, 0.14]);
    this.recent = []; // recent print positions for grass trampling
    this.trample = Array.from({ length: 24 }, () => new THREE.Vector4(0, -99, 0, 0));
    this.lastSkid = new THREE.Vector3(1e9, 0, 0);
  }
  // surface softness: how deep a print goes (1 soft dirt/mud, ~0.35 litter/needles, 0.15 pebbles, 0 hard)
  softness(x, z, collider) {
    if (collider && collider.userData?.kind && collider.userData.kind !== 'terrain') return 0;
    const s = this.T.surfaceAt(x, z);
    return s === 'dirt' ? 1 : s === 'moss' ? 0.85 : s === 'leaves' ? 0.35 : s === 'pebbles' ? 0.2 : 0;
  }
  groundNormal(x, z, collider) {
    return this.T.normalAt(x, z);
  }
  step(footPos, yaw, wet, collider, weight = 1) {
    const soft = this.softness(footPos.x, footPos.z, collider);
    const onT = !(collider && collider.userData?.kind && collider.userData.kind !== 'terrain');
    if (!onT && wet < 0.08) return;
    if (this.T.isWater(footPos.x, footPos.z) && footPos.y < this.T.waterY) return;
    const onTerrain = !(collider && collider.userData?.kind && collider.userData.kind !== 'terrain');
    const p = new THREE.Vector3(footPos.x, onTerrain ? this.T.heightAt(footPos.x, footPos.z) : footPos.y + 0.003, footPos.z);
    if (onTerrain && this.marks) this.marks.stamp(p.x, p.z, yaw, 0.064, 0.098, this.soleTex.mask, Math.min(1, 0.75 * weight), Math.min(1, wet * 1.2));
    else this.feet.add(p, this.groundNormal(p.x, p.z, collider), yaw, 0, Math.min(1, wet * 1.2), 0);
    this.addTrample(p, 0.7);
  }
  // continuous skid marks while rolling / sliding / pushing a crate
  skid(pos, dir, collider, wet = 0, width = 1) {
    if (pos.distanceToSquared(this.lastSkid) < 0.05 * 0.05) return;
    this.lastSkid.copy(pos);
    const soft = this.softness(pos.x, pos.z, collider);
    if (collider && collider.userData?.kind && collider.userData.kind !== 'terrain') return;
    const p = new THREE.Vector3(pos.x, this.T.heightAt(pos.x, pos.z), pos.z);
    if (this.marks) this.marks.stamp(p.x, p.z, Math.atan2(dir.x, dir.z), 0.07 * width, 0.14, this.skidTex.mask, 0.7, wet, 0.5);
    else this.skids.add(p, this.T.normalAt(p.x, p.z), Math.atan2(dir.x, dir.z), 0.5 + soft * 0.5, wet, soft, width, 1);
    this.addTrample(p, 0.5);
  }
  addTrample(p, k) {
    this.recent.unshift({ p: p.clone(), t: 0, k });
    if (this.recent.length > this.trample.length) this.recent.length = this.trample.length;
  }
  update(dt) {
    this.feet.update(dt); this.skids.update(dt);
    this.recent.forEach((r, i) => { r.t += dt; this.trample[i].set(r.p.x, r.p.y, r.p.z, r.k * Math.max(0, 1 - r.t / 90)); });
    for (let i = this.recent.length; i < this.trample.length; i++) this.trample[i].set(0, -99, 0, 0);
  }
}
