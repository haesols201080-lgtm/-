// Moss layer. The look comes from a 12 cm tile of moss modelled stem by stem in Blender (haircap stems with star-shaped
// leaf whorls, feather-moss fronds underneath, spore capsules) and rendered top-down into albedo, height and normal
// maps (blender/build_moss.py). In game the moss grows as a stack of shells over the real surfaces it lives on
// (crowns of boulders and logs, stump tops, damp stream banks): every shell keeps only the texels whose modelled
// height reaches it, so stems, star tips and cushion edges have true depth. Coverage per vertex comes from how much
// the surface faces up, a large-scale damp/shade field and ambient occlusion; where coverage is thin the moss
// height-blends away — only the tallest tufts of the modelled moss survive — instead of ending on a noise outline.
import * as THREE from 'three';

let MAT = null;
export function mossMaterial(tex, shells) {
  if (MAT) return MAT;
  const U = { tMoss: { value: tex.map }, tMossN: { value: tex.normal }, uShells: { value: shells }, uLen: { value: 0.024 }, uTile: { value: 0.12 } };
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82, metalness: 0, envMapIntensity: 0.55 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
        attribute float mossW; attribute float mossAO;
        uniform float uShells, uLen;
        varying float vMW; varying float vMAO; varying float vMH; varying vec3 vMP; varying vec3 vMN;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float mh = float(gl_InstanceID) / uShells;
        // shells lift off along the normal; the base layer sits a hair above the surface it covers
        transformed += objectNormal * (0.0015 + uLen * mossW * mh);
        vMW = mossW; vMAO = mossAO; vMH = mh; vMP = position; vMN = objectNormal;`)
      .replace('#include <project_vertex>', `vec4 mvPosition = vec4(transformed, 1.0);
        mvPosition = modelViewMatrix * mvPosition; gl_Position = projectionMatrix * mvPosition;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        uniform sampler2D tMoss, tMossN; uniform float uTile;
        varying float vMW; varying float vMAO; varying float vMH; varying vec3 vMP; varying vec3 vMN;
        vec4 mossA; vec3 mossNrm; float mossT;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec3 n = normalize(vMN), an = abs(n);
          // biplanar: the top projection on crowns, the dominant side projection on flanks
          float wt = smoothstep(0.35, 0.75, an.y);
          vec2 uvT = vMP.xz / uTile, uvS = (an.x > an.z ? vMP.zy : vMP.xy) / uTile;
          vec4 aT = texture2D(tMoss, uvT), aS = texture2D(tMoss, uvS);
          mossA = mix(aS, aT, wt);
          vec3 nT = texture2D(tMossN, uvT).xyz * 2.0 - 1.0;
          mossNrm = nT;
          float H = mossA.a;
          // height blend against coverage: thin coverage leaves only the tallest tufts standing
          float He = H - (1.0 - vMW) * 1.05;
          if (vMH < 0.001) { if (He < 0.03) discard; }
          else if (He < vMH) discard;
          // depth inside the cushion darkens (light can't reach the stem bases), tips catch light
          float depth = clamp(vMH / max(H, 0.05), 0.0, 1.0);
          mossT = depth;
          // forest-shade moss: deep olive greens, a yellower cast only on the very tips
          vec3 c = mossA.rgb;
          float l = dot(c, vec3(0.299, 0.587, 0.114));
          c = mix(vec3(l), c, 0.78) * vec3(0.82, 0.95, 0.72);
          diffuseColor.rgb = c * 0.95 * mix(0.38, 1.0, depth * depth) * mix(0.65, 1.0, vMAO);
        }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          // tilt the surface normal by the modelled moss normal (strongest on the upper shells)
          vec3 nW = normalize(vMN);
          vec3 tx = normalize(cross(vec3(0.0, 0.0, 1.0), nW) + vec3(1e-4, 0.0, 0.0));
          vec3 tz = cross(nW, tx);
          vec3 pn = normalize(nW + (tx * mossNrm.x - tz * mossNrm.y) * (0.6 + 0.6 * mossT));
          normal = normalize((viewMatrix * vec4(pn, 0.0)).xyz);
        }`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        // thin leaves let light through: a little wrapped, back-lit glow on the tips
        reflectedLight.indirectDiffuse += diffuseColor.rgb * 0.18 * mossT;`);
  };
  m.customProgramCacheKey = () => 'mossShells1';
  m.userData.U = U;
  MAT = m;
  return m;
}

// coverage field shared by all surfaces: damp, shaded hollows carry more moss, in large irregular colonies
function hash(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi, u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function mossField(x, y, z) {
  const wx = x + 1.7 * vnoise(x * 0.4 + 3.1, z * 0.4), wz = z + 1.7 * vnoise(x * 0.4, z * 0.4 + 7.3);    // domain warp
  return 0.55 * vnoise(wx * 0.9, wz * 0.9 + y * 0.6) + 0.3 * vnoise(wx * 2.6 + 11, wz * 2.6 + y) + 0.15 * vnoise(wx * 7 + 5, wz * 7);
}
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// build the moss geometry for one surface (any mesh/geometry + world matrix); returns arrays to merge into a chunk
// kind: 'rock' | 'log' | 'stump' | 'ground'
export function mossFromSurface(geo, matrix, kind, damp = 0.5, minW = 0.12) {
  const pos = geo.attributes.position, nrm = geo.attributes.normal, col = geo.attributes.color;
  const idx = geo.index ? geo.index.array : null;
  const nm = new THREE.Matrix3().getNormalMatrix(matrix);
  const P = [], N = [], W = [], A = [];
  const cnt = pos.count, wp = new Float32Array(cnt * 3), wn = new Float32Array(cnt * 3), ww = new Float32Array(cnt), wa = new Float32Array(cnt);
  const v = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < cnt; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(matrix); n.fromBufferAttribute(nrm, i).applyMatrix3(nm).normalize();
    wp[i * 3] = v.x; wp[i * 3 + 1] = v.y; wp[i * 3 + 2] = v.z; wn[i * 3] = n.x; wn[i * 3 + 1] = n.y; wn[i * 3 + 2] = n.z;
    const f = mossField(v.x, v.y, v.z), ao = col ? (col.getX(i) + col.getY(i) + col.getZ(i)) / 3 : 1;
    let w;
    // moss runs over the crown and down the shaded (north) flank in irregular colonies, thinning into single tufts
    if (kind === 'rock') w = sstep(-0.15, 0.55, n.y + 0.45 * Math.max(0, -n.z)) * sstep(0.32, 0.72, f + damp * 0.22) * (0.55 + 0.45 * sstep(0.2, 0.8, n.y));
    else if (kind === 'log') w = sstep(-0.05, 0.6, n.y) * sstep(0.28, 0.58, f + damp * 0.25);
    else if (kind === 'stump') w = sstep(0.2, 0.8, n.y) * sstep(0.3, 0.6, f + 0.2);
    else w = sstep(0.42, 0.7, f * 0.6 + damp * 0.6);
    ww[i] = w * (0.75 + 0.25 * ao); wa[i] = ao;
  }
  const tri = (a, b, c) => {
    if (Math.max(ww[a], ww[b], ww[c]) < minW) return;
    for (const k of [a, b, c]) { P.push(wp[k * 3], wp[k * 3 + 1], wp[k * 3 + 2]); N.push(wn[k * 3], wn[k * 3 + 1], wn[k * 3 + 2]); W.push(ww[k]); A.push(wa[k]); }
  };
  if (idx) for (let i = 0; i < idx.length; i += 3) tri(idx[i], idx[i + 1], idx[i + 2]);
  else for (let i = 0; i < cnt; i += 3) tri(i, i + 1, i + 2);
  return { P, N, W, A };
}

// a terrain-conforming grid where the ground is damp enough for a moss carpet
export function mossGround(terrain, x0, z0, x1, z1, step, dampAt) {
  const P = [], N = [], W = [], A = [];
  const nx = Math.ceil((x1 - x0) / step), nz = Math.ceil((z1 - z0) / step);
  const gw = new Float32Array((nx + 1) * (nz + 1)), gy = new Float32Array((nx + 1) * (nz + 1));
  let any = false;
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const x = x0 + i * step, z = z0 + j * step, d = dampAt(x, z);
    const w = d <= 0 ? 0 : sstep(0.42, 0.68, mossField(x, 0, z) * 0.55 + d * 0.65);
    gw[j * (nx + 1) + i] = w; gy[j * (nx + 1) + i] = terrain.heightAt(x, z); if (w > 0.06) any = true;
  }
  if (!any) return null;
  const nrmAt = (x, z) => { const e = 0.08, hx = terrain.heightAt(x + e, z) - terrain.heightAt(x - e, z), hz = terrain.heightAt(x, z + e) - terrain.heightAt(x, z - e); const l = Math.hypot(hx, 2 * e, hz); return [-hx / l, 2 * e / l, -hz / l]; };
  const push = (i, j) => { const k = j * (nx + 1) + i, x = x0 + i * step, z = z0 + j * step, nn = nrmAt(x, z); P.push(x, gy[k], z); N.push(...nn); W.push(gw[k]); A.push(1); };
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * (nx + 1) + i, w = Math.max(gw[k], gw[k + 1], gw[k + nx + 1], gw[k + nx + 2]);
    if (w < 0.06) continue;
    push(i, j); push(i, j + 1); push(i + 1, j); push(i + 1, j); push(i, j + 1); push(i + 1, j + 1);
  }
  return P.length ? { P, N, W, A } : null;
}

// merge pieces into chunked instanced shell meshes
export function buildMossMeshes(scene, pieces, tex, shells, chunk = 12) {
  const mat = mossMaterial(tex, shells);
  const chunks = new Map();
  for (const pc of pieces) {
    if (!pc) continue;
    for (let t = 0; t < pc.W.length; t += 3) {
      const cx = (pc.P[t * 3] + pc.P[t * 3 + 3] + pc.P[t * 3 + 6]) / 3, cz = (pc.P[t * 3 + 2] + pc.P[t * 3 + 5] + pc.P[t * 3 + 8]) / 3;
      const key = Math.floor(cx / chunk) + ',' + Math.floor(cz / chunk);
      if (!chunks.has(key)) chunks.set(key, { P: [], N: [], W: [], A: [] });
      const C = chunks.get(key);
      for (let k = 0; k < 3; k++) {
        const q = t + k; C.P.push(pc.P[q * 3], pc.P[q * 3 + 1], pc.P[q * 3 + 2]); C.N.push(pc.N[q * 3], pc.N[q * 3 + 1], pc.N[q * 3 + 2]); C.W.push(pc.W[q]); C.A.push(pc.A[q]);
      }
    }
  }
  const out = [];
  for (const C of chunks.values()) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(C.P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(C.N, 3));
    g.setAttribute('mossW', new THREE.Float32BufferAttribute(C.W, 1)); g.setAttribute('mossAO', new THREE.Float32BufferAttribute(C.A, 1));
    g.computeBoundingSphere();
    const im = new THREE.InstancedMesh(g, mat, shells + 1);
    const I = new THREE.Matrix4(); for (let i = 0; i <= shells; i++) im.setMatrixAt(i, I);
    im.receiveShadow = true; im.castShadow = false;
    // instances share the base bounds (+ moss height): let three cull whole chunks by their sphere
    im.boundingSphere = g.boundingSphere.clone(); im.boundingSphere.radius += 0.05;
    scene.add(im);
    out.push({ m: im, c: g.boundingSphere.center.clone(), full: shells + 1, tris: C.W.length / 3 });
  }
  return out;
}

// moss at the foot of a tree: the stem base and the surface roots, thickest on the shaded north side and on the
// upper faces of the roots, thinning out up the trunk. The roots are bent onto the ground in the bark shader
// (conformToGround); `lift` is its CPU twin so the moss lies exactly on the rendered roots.
export function mossFromTree(geo, M, localM, groundY, lift, minW = 0.12) {
  const pos = geo.attributes.position, nrm = geo.attributes.normal, idx = geo.index ? geo.index.array : null;
  const full = new THREE.Matrix4().multiplyMatrices(M, localM), nm = new THREE.Matrix3().getNormalMatrix(full);
  const cnt = pos.count, keep = new Uint8Array(cnt), wp = new Float32Array(cnt * 3), wn = new Float32Array(cnt * 3), ww = new Float32Array(cnt);
  const v = new THREE.Vector3(), l = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < cnt; i++) {
    l.fromBufferAttribute(pos, i).applyMatrix4(localM);
    if (l.y > 0.95) continue;
    keep[i] = 1;
    v.copy(l).applyMatrix4(M);
    v.y += lift(l.y, Math.hypot(l.x, l.z), v.x, v.z);
    n.fromBufferAttribute(nrm, i).applyMatrix3(nm).normalize();
    wp[i * 3] = v.x; wp[i * 3 + 1] = v.y; wp[i * 3 + 2] = v.z; wn[i * 3] = n.x; wn[i * 3 + 1] = n.y; wn[i * 3 + 2] = n.z;
    const hk = sstep(0.85, 0.1, v.y - groundY(v.x, v.z));
    const side = sstep(-0.4, 0.6, -n.z) * 0.85 + sstep(0.15, 0.7, n.y) * 0.45;
    ww[i] = Math.min(1, side) * hk * sstep(0.28, 0.6, mossField(v.x, v.y, v.z) + 0.12);
  }
  const P = [], N = [], W = [], A = [];
  const tri = (a, b, c) => {
    if (!keep[a] || !keep[b] || !keep[c] || Math.max(ww[a], ww[b], ww[c]) < minW) return;
    for (const k of [a, b, c]) { P.push(wp[k * 3], wp[k * 3 + 1], wp[k * 3 + 2]); N.push(wn[k * 3], wn[k * 3 + 1], wn[k * 3 + 2]); W.push(ww[k]); A.push(0.85); }
  };
  if (idx) for (let i = 0; i < idx.length; i += 3) tri(idx[i], idx[i + 1], idx[i + 2]);
  else for (let i = 0; i < cnt; i += 3) tri(i, i + 1, i + 2);
  return P.length ? { P, N, W, A } : null;
}
