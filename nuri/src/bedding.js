// The stranger's bed made up: the mattress in its fitted sheet, two pillows in their cases, and the materials of the
// bedding (the duvet itself is cloth: src/quilt.js). Everything soft gives where he lies on it: the mattress sinks
// under his back and hips, the pillow under his head and neck, each to the shape of him (his skinned mesh as he lies)
// and easing off round it. The fabrics are scans (Poly Haven "Rough Linen" for the duvet cover, "Stretch Poplin" for
// the sheet and the cases, CC0) at their real size, with a cloth's sheen, and a second, larger crinkle over the weave
// so a sheet looks slept in.
import * as THREE from 'three';

// ---------------------------------------------------------------- materials
// a tileable crinkle: the creases a slept-in sheet has, drawn as strokes (short and long, curving a little, sharp
// at the fold and fading at the ends, more of them running one way than the other), softened, as normals
let CRINKLE = null;
function crinkleTexture() {
  if (CRINKLE) return CRINKLE;
  const N = 512, h = new Float32Array(N * N), t = new Float32Array(N * N);
  let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const at = (x, y) => (((Math.round(y) % N) + N) % N) * N + (((Math.round(x) % N) + N) % N);
  // (soft folds: a broad rounded valley each, shallow, mostly straight; the broad ones fewer)
  for (let s = 0; s < 170; s++) {
    let x = rnd() * N, y = rnd() * N, th = (rnd() < 0.55 ? (rnd() - 0.5) * 0.9 : rnd() * Math.PI);
    const w = 3 + rnd() ** 1.5 * 11, L = 30 + rnd() * 140 + w * 6, d = 0.5 + rnd() * 0.5, cv = (rnd() - 0.5) * 0.006;
    for (let q = 0; q < L; q += 1) {
      const env = Math.sin(Math.PI * q / L) ** 1.2, c = Math.cos(th), sn = Math.sin(th);
      for (let k = -w * 1.6; k <= w * 1.6; k += 0.6) {
        const a = Math.abs(k) / w, v = a < 1 ? -(0.5 + 0.5 * Math.cos(Math.PI * a)) : 0.18 * Math.sin(Math.PI * (a - 1) / 0.6);
        h[at(x - sn * k, y + c * k)] += d * env * v * 0.35 * Math.sqrt(w / 6);
      }
      x += c; y += sn; th += cv;
    }
  }
  for (let pass = 0; pass < 4; pass++) {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { let s = 0; for (let k = -1; k <= 1; k++) s += h[y * N + ((x + k + N) % N)]; t[y * N + x] = s / 3; }
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { let s = 0; for (let k = -1; k <= 1; k++) s += t[((y + k + N) % N) * N + x]; h[y * N + x] = s / 3; }
  }
  const data = new Uint8Array(N * N * 4), k = 0.55;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = (h[y * N + (x + 1) % N] - h[y * N + (x + N - 1) % N]) * k, dy = (h[((y + 1) % N) * N + x] - h[((y + N - 1) % N) * N + x]) * k, l = Math.hypot(dx, dy, 1);
    const o = (y * N + x) * 4; data[o] = (-dx / l * 0.5 + 0.5) * 255; data[o + 1] = (-dy / l * 0.5 + 0.5) * 255; data[o + 2] = (1 / l * 0.5 + 0.5) * 255; data[o + 3] = 255;
  }
  CRINKLE = new THREE.DataTexture(data, N, N, THREE.RGBAFormat); CRINKLE.wrapS = CRINKLE.wrapT = THREE.RepeatWrapping;
  CRINKLE.magFilter = THREE.LinearFilter; CRINKLE.minFilter = THREE.LinearMipmapLinearFilter; CRINKLE.generateMipmaps = true; CRINKLE.needsUpdate = true;
  return CRINKLE;
}

// a fabric: the scan's colour, weave normals, roughness and occlusion at its real size (UVs in metres), a sheen at
// grazing light, and the crinkle over it (every `crinkle` metres, `crease` strong)
export function fabric(set, { tile, color = 0xffffff, sheen = 1, sheenColor = 0xffffff, sheenRoughness = 0.55, normal = 1, crinkle = 0.55, crease = 0.35, vertexColors = false } = {}) {
  const c = (t) => { if (!t) return null; const x = t.clone(); x.wrapS = x.wrapT = THREE.RepeatWrapping; x.repeat.set(1 / tile, 1 / tile); x.anisotropy = 8; x.needsUpdate = true; return x; };
  const m = new THREE.MeshPhysicalMaterial({
    color, map: c(set?.map), normalMap: c(set?.normal), roughnessMap: c(set?.orm), aoMap: c(set?.orm), aoMapIntensity: 0.6,
    roughness: 1, metalness: 0, sheen, sheenColor: new THREE.Color(sheenColor), sheenRoughness, envMapIntensity: 0.45, vertexColors,
  });
  m.normalScale.setScalar(normal);
  const cr = crinkleTexture(), scale = tile / crinkle;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.crinkleMap = { value: cr }; sh.uniforms.crinkleK = { value: new THREE.Vector2(scale, crease) };
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_maps>', THREE.ShaderChunk.normal_fragment_maps.replace(
      'normal = normalize( tbn * mapN );',
      'vec3 crN = texture2D( crinkleMap, vNormalMapUv * crinkleK.x ).xyz * 2.0 - 1.0; mapN = normalize( vec3( mapN.xy + crN.xy * crinkleK.y, mapN.z ) );\n\tnormal = normalize( tbn * mapN );'))
      .replace('#include <normalmap_pars_fragment>', '#include <normalmap_pars_fragment>\nuniform sampler2D crinkleMap; uniform vec2 crinkleK;');
  };
  m.customProgramCacheKey = () => 'fabric-crinkle';
  return m;
}

// ---------------------------------------------------------------- where he presses
// the underside of him (head, hair, body, clothes), as he lies: the lowest point per centimetre cell
export function undersideOf(man, { x0, x1, z0, z1, C = 0.01 }) {
  const nx = Math.ceil((x1 - x0) / C) + 1, nz = Math.ceil((z1 - z0) / C) + 1, H = new Float32Array(nx * nz).fill(1e9), v = new THREE.Vector3();
  man.root.updateMatrixWorld(true);
  man.root.traverse((o) => {
    if (!o.isSkinnedMesh || !o.visible || /eyes|lashes|brows|teeth|tongue/.test(o.name)) return;
    for (let i = 0; i < o.geometry.attributes.position.count; i++) {
      o.getVertexPosition(i, v); v.applyMatrix4(o.matrixWorld);
      const ix = Math.round((v.x - x0) / C), iz = Math.round((v.z - z0) / C);
      if (ix < 0 || iz < 0 || ix >= nx || iz >= nz) continue;
      const c = iz * nx + ix; if (v.y < H[c]) H[c] = v.y;
    }
  });
  // (a cell the vertices missed: the lowest of its neighbours)
  const T = H.slice();
  for (let z = 1; z < nz - 1; z++) for (let x = 1; x < nx - 1; x++) { const c = z * nx + x; if (H[c] < 1e8) continue; let m = 1e9; for (const d of [-1, 1, -nx, nx]) m = Math.min(m, H[c + d]); T[c] = m; }
  return { x0, z0, C, nx, nz, H: T, at(x, z) { const ix = Math.round((x - x0) / C), iz = Math.round((z - z0) / C); return ix < 0 || iz < 0 || ix >= nx || iz >= nz ? 1e9 : T[iz * nx + ix]; } };
}

// press the surface down where he lies on it: each listed vertex (a grid of rows x cols, top surface) is kept a hair
// below him, and the dent eases off round him (blurred over `soft` metres)
function press(pos, rows, cols, idx, field, { gap = 0.003, soft = 0.04, floor = -1e9, step = 0.02 }) {
  const n = rows * cols, d = new Float32Array(n), v = new THREE.Vector3();
  for (let k = 0; k < n; k++) { v.fromBufferAttribute(pos, idx[k]); d[k] = Math.max(0, v.y - (field.at(v.x, v.z) - gap)); }
  // blur (separable, a few passes of a 5-tap kernel scaled to the grid's step) and keep the deeper of the two
  const r = Math.max(1, Math.round(soft / step)), t = new Float32Array(n), b = d.slice();
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) { let s = 0, w = 0; for (let q = -r; q <= r; q++) { const jj = j + q; if (jj < 0 || jj >= cols) continue; const ww = 1 - Math.abs(q) / (r + 1); s += b[i * cols + jj] * ww; w += ww; } t[i * cols + j] = s / w; }
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) { let s = 0, w = 0; for (let q = -r; q <= r; q++) { const ii = i + q; if (ii < 0 || ii >= rows) continue; const ww = 1 - Math.abs(q) / (r + 1); s += t[ii * cols + j] * ww; w += ww; } b[i * cols + j] = s / w; }
  }
  for (let k = 0; k < n; k++) { const dd = Math.max(d[k], b[k] * 1.25); if (dd <= 0) continue; const i = idx[k]; pos.setY(i, Math.max(floor, pos.getY(i) - dd)); }
}

// ---------------------------------------------------------------- the mattress
// a slab with rounded edges (the band of each edge's round given to the faces either side, evenly in angle), its
// sides bowed out a little; the fitted sheet is its surface
function roundedSlab(W, Hh, L, r, step = 0.025, nr = 5) {
  const coords = (len) => {
    const out = [], mid = len - 2 * r, nm = Math.max(1, Math.round(mid / step));
    for (let i = nr; i >= 1; i--) out.push(-len / 2 + r - r * Math.tan(Math.PI / 4 * i / nr));
    for (let i = 0; i <= nm; i++) out.push(-len / 2 + r + mid * i / nm);
    for (let i = 1; i <= nr; i++) out.push(len / 2 - r + r * Math.tan(Math.PI / 4 * i / nr));
    return out;
  };
  const X = coords(W), Y = coords(Hh), Z = coords(L), pos = [], nrm = [], uv = [], idx = [], faces = [];
  const h = [W / 2, Hh / 2, L / 2];
  const face = (axis, sign, A, B, ia, ib) => {
    const base = pos.length / 3, rows = A.length, cols = B.length, top = axis === 1 && sign > 0;
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
      const P = [0, 0, 0]; P[axis] = sign * h[axis]; P[ia] = A[i]; P[ib] = B[j];
      const q = P.map((p, k) => Math.max(-(h[k] - r), Math.min(h[k] - r, p))), dv = P.map((p, k) => p - q[k]), dl = Math.hypot(...dv) || 1;
      const n = dv.map((x) => x / dl), p = q.map((x, k) => x + n[k] * r);
      pos.push(...p); nrm.push(...n);
      // (UVs in metres: the top by x and z; the sides along their length and up)
      uv.push(axis === 1 ? p[0] : axis === 0 ? p[2] : p[0], axis === 1 ? p[2] : p[1]);
    }
    for (let i = 0; i < rows - 1; i++) for (let j = 0; j < cols - 1; j++) {
      const a = base + i * cols + j, b = a + 1, c = a + cols, d = c + 1;
      // (wound to face out: the face's in-plane axes and its sign decide)
      const flip = (sign > 0) !== ((ia + 1) % 3 === ib);
      if (flip) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
    }
    faces.push({ base, rows, cols, axis, sign, top });
  };
  face(1, 1, Z, X, 2, 0); face(1, -1, Z, X, 2, 0);
  face(0, 1, Y, Z, 1, 2); face(0, -1, Y, Z, 1, 2);
  face(2, 1, X, Y, 0, 1); face(2, -1, X, Y, 0, 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  g.userData.faces = faces; g.userData.h = h; g.userData.r = r;
  return g;
}

export function makeMattress({ bx, bz, W, L, top, depth = 0.21, under, material }) {
  const r = 0.055, g = roundedSlab(W, depth, L, r), P = g.attributes.position, h = g.userData.h;
  // the sides bowed out (most at mid-height, none at the corners)
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i), up = Math.sin(Math.PI * (y + h[1]) / (2 * h[1]));
    const ex = Math.min(1, (h[0] - Math.abs(x)) / 0.25), ez = Math.min(1, (h[2] - Math.abs(z)) / 0.25);
    if (Math.abs(x) > h[0] - r * 0.5) P.setX(i, x + Math.sign(x) * 0.012 * up * ez);
    if (Math.abs(z) > h[2] - r * 0.5) P.setZ(i, z + Math.sign(z) * 0.012 * up * ex);
  }
  g.translate(bx, top - depth / 2, bz);
  // where he lies, it gives
  if (under) {
    const f = g.userData.faces.find((F) => F.top), idx = Array.from({ length: f.rows * f.cols }, (_, k) => f.base + k);
    press(P, f.rows, f.cols, idx, under, { gap: 0.002, soft: 0.07, step: 0.025 });
  }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, material); m.castShadow = m.receiveShadow = true; m.name = 'mattress';
  return m;
}

// ---------------------------------------------------------------- a pillow
// a case stuffed full: its outline drawn in between the corners, fullest in the middle and thin to the seam, the
// underside flat on the mattress, creases running in from the corners, a little lumpy; the seam a crisp line
export function makePillow({ c, ry = 0, W = 0.66, D = 0.44, T = 0.19, seed = 1, under, material }) {
  const nu = 60, nv = 42, f = (t) => Math.max(0, 1 - Math.abs(t) ** 2.4) ** 0.55, Ht = T * 0.62, Hb = T * 0.38;
  let s0 = seed * 9301; const rnd = () => ((s0 = (s0 * 16807) % 2147483647) / 2147483647);
  const lumps = Array.from({ length: 6 }, () => [rnd() * 2 - 1, rnd() * 2 - 1, 0.25 + rnd() * 0.3, (rnd() - 0.5) * 0.12]);
  const creases = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (let k = 0; k < 2; k++) creases.push([sx, sz, Math.atan2(-sz * D, -sx * W) + (k ? 0.22 : -0.2) + (rnd() - 0.5) * 0.15, 0.1 + rnd() * 0.1]);
  const pos = [], uv = [], idx = [];
  const shell = (top) => {
    const base = pos.length / 3;
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const u = Math.sin((i / nu * 2 - 1) * Math.PI / 2), v = Math.sin((j / nv * 2 - 1) * Math.PI / 2);
      const x = u * W / 2 * (1 - 0.05 * (1 - v * v)), z = v * D / 2 * (1 - 0.08 * (1 - u * u)), ff = f(u) * f(v);
      let y;
      if (top) {
        y = Ht * ff;
        for (const [lu, lv, lr, la] of lumps) y += Ht * la * ff * Math.exp(-((u - lu) ** 2 + (v - lv) ** 2) / (lr * lr));
        // creases from the corners
        for (const [sx, sz, ang, len] of creases) {
          const cx = sx * W / 2, cz = sz * D / 2, dx = x - cx, dz = z - cz, along = dx * Math.cos(ang) + dz * Math.sin(ang), across = -dx * Math.sin(ang) + dz * Math.cos(ang);
          if (along > 0 && along < len) y -= 0.006 * Math.exp(-((across / 0.01) ** 2)) * Math.sin(Math.PI * along / len) * (1 - ff * 0.6);
        }
      } else y = -Hb * Math.min(1, ff ** 0.35 * 1.12);                   // (the underside: flat where it rests)
      pos.push(x, y, z); uv.push(0, 0);
    }
    // (UVs by length along the surface, so the weave keeps its size down the pillow's sides)
    const P = (i, j) => (base + j * (nu + 1) + i) * 3;
    for (let j = 0; j <= nv; j++) { let a = 0; for (let i = 0; i <= nu; i++) { if (i) a += Math.hypot(pos[P(i, j)] - pos[P(i - 1, j)], pos[P(i, j) + 1] - pos[P(i - 1, j) + 1], pos[P(i, j) + 2] - pos[P(i - 1, j) + 2]); uv[(base + j * (nu + 1) + i) * 2] = a + (top ? 0 : 0.37); } }
    for (let i = 0; i <= nu; i++) { let a = 0; for (let j = 0; j <= nv; j++) { if (j) a += Math.hypot(pos[P(i, j)] - pos[P(i, j - 1)], pos[P(i, j) + 1] - pos[P(i, j - 1) + 1], pos[P(i, j) + 2] - pos[P(i, j - 1) + 2]); uv[(base + j * (nu + 1) + i) * 2 + 1] = a; } }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const a = base + j * (nu + 1) + i, b = a + 1, cc = a + nu + 1, d = cc + 1;
      if (top) idx.push(a, cc, b, b, cc, d); else idx.push(a, b, cc, b, d, cc);
    }
    return base;
  };
  const tb = shell(true); shell(false);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  g.rotateY(ry); g.translate(c[0], c[1] + Hb, c[2]);
  if (under) {
    const P = g.attributes.position, idt = Array.from({ length: (nu + 1) * (nv + 1) }, (_, k) => tb + k);
    press(P, nv + 1, nu + 1, idt, under, { gap: 0.004, soft: 0.05, step: 0.011, floor: c[1] + Hb * 0.4 });
  }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, material); m.castShadow = m.receiveShadow = true; m.name = 'pillow';
  m.userData.top = c[1] + Hb + Ht; m.userData.collider = { c: [c[0], c[1] + T * 0.45, c[2]], h: [W / 2, T * 0.45, D / 2], r: 0.07, ry };
  return m;
}
