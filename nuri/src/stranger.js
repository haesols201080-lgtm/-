// The stranger, as much of them as a 35 cm robot sees: a gloved hand with its jacket sleeve, and two legs in jeans and
// muddy rubber boots (the scanned pair). The hand closes round the robot (setGrip); the legs walk in on hip/knee/ankle
// pivots (setGait).
// Units are metres; a grown-up is about five robots tall.
import * as THREE from 'three';

const smooth = (t) => t * t * (3 - 2 * t);

function texSet(T, rep = [1, 1]) {
  if (!T) return {};
  for (const t of [T.map, T.normal, T.orm]) if (t) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return { map: T.map, normalMap: T.normal, roughnessMap: T.orm, aoMap: T.orm };
}

// a tube along +x from x0 to x1 with radius r(t, angle) and its own UVs (u round, v along)
function tube(x0, x1, rfn, nr = 24, nl = 20, ellip = 1) {
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= nl; j++) {
    const t = j / nl, x = x0 + (x1 - x0) * t;
    for (let i = 0; i <= nr; i++) {
      const a = i / nr * Math.PI * 2, r = rfn(t, a);
      pos.push(x, Math.sin(a) * r * ellip, Math.cos(a) * r); uv.push(i / nr, t);
    }
  }
  for (let j = 0; j < nl; j++) for (let i = 0; i < nr; i++) {
    const a = j * (nr + 1) + i, b = a + nr + 1;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

// The gloved hand is the scanned pair of garden gloves (Poly Haven, CC0) - the top glove of the pair, split off by
// connectivity - with a bend deformer that curls its fingers about the knuckle line and folds the thumb under the
// palm. Frame of the result: fingers along +x, palm facing -y, wrist at the origin (the sleeve comes with the body).
export function makeHand(tex = {}, gloveModel = null) {
  const root = new THREE.Group(); root.name = 'stranger_hand';
  let src = null;
  gloveModel?.scene.updateMatrixWorld(true);
  gloveModel?.scene.traverse((o) => { if (o.isMesh && !src) src = o; });
  const hand = { root, grip: 0 };
  if (!src) { hand.setGrip = () => {}; return hand; }
  const g0 = src.geometry.clone().applyMatrix4(src.matrixWorld);
  const pos0 = g0.attributes.position, nrm0 = g0.attributes.normal, uv0 = g0.attributes.uv, idx0 = g0.index.array;
  // connected components (union-find over triangles); keep the glove lying on top
  const par = new Int32Array(pos0.count).map((_, i) => i);
  const find = (i) => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; };
  for (let t = 0; t < idx0.length; t += 3) { const a = find(idx0[t]), b = find(idx0[t + 1]), c = find(idx0[t + 2]); par[b] = a; par[find(c)] = a; }
  // vertices split at UV seams share positions: join those too
  const key = new Map();
  for (let i = 0; i < pos0.count; i++) { const k = `${pos0.getX(i).toFixed(5)},${pos0.getY(i).toFixed(5)},${pos0.getZ(i).toFixed(5)}`; if (key.has(k)) par[find(i)] = find(key.get(k)); else key.set(k, i); }
  const comp = new Map();
  for (let i = 0; i < pos0.count; i++) { const r = find(i); const c = comp.get(r) || { n: 0, y: 0 }; c.n++; c.y += pos0.getY(i); comp.set(r, c); }
  // the two gloves are the two big pieces; small pieces are their labels and cuff hems: keep the upper glove and
  // the small pieces lying higher than it (its own label)
  const big = [...comp.entries()].filter(([, c]) => c.n > 1000).sort((a, b) => b[1].y / b[1].n - a[1].y / a[1].n);
  const topY = big[0][1].y / big[0][1].n;
  const keep = new Set([big[0][0], ...[...comp.entries()].filter(([, c]) => c.n <= 1000 && c.y / c.n > topY).map(([r]) => r)]);
  const map = new Int32Array(pos0.count).fill(-1), P = [], N = [], U = [], I = [];
  for (let i = 0; i < pos0.count; i++) if (keep.has(find(i))) { map[i] = P.length / 3; P.push(pos0.getX(i), pos0.getY(i), pos0.getZ(i)); N.push(nrm0.getX(i), nrm0.getY(i), nrm0.getZ(i)); if (uv0) U.push(uv0.getX(i), uv0.getY(i)); }
  // (written mirrored: the scan is a left glove and this is the right hand, so the winding turns over too)
  for (let t = 0; t < idx0.length; t += 3) if (map[idx0[t]] >= 0) I.push(map[idx0[t]], map[idx0[t + 2]], map[idx0[t + 1]]);
  // the glove lies with its cuff toward -z and fingers toward +z, thumb toward +x, back of the hand up
  let mn = new THREE.Vector3(1e9, 1e9, 1e9), mx = mn.clone().negate();
  for (let i = 0; i < P.length; i += 3) { mn.min(new THREE.Vector3(P[i], P[i + 1], P[i + 2])); mx.max(new THREE.Vector3(P[i], P[i + 1], P[i + 2])); }
  const cx = (mn.x + mx.x) / 2, cy = (mn.y + mx.y) / 2, L = mx.z - mn.z;
  // re-centre: wrist (cuff opening) at the origin, fingers along +x, palm down, thumb toward +z
  const base = new Float32Array(P.length), baseN = new Float32Array(N.length);
  for (let i = 0; i < P.length; i += 3) {
    base[i] = P[i + 2] - mn.z; base[i + 1] = P[i + 1] - cy; base[i + 2] = P[i] - cx;
    baseN[i] = N[i + 2]; baseN[i + 1] = N[i + 1]; baseN[i + 2] = N[i];
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(base.slice(), 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(baseN.slice(), 3));
  if (U.length) geo.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  geo.setIndex(I);
  const mesh = new THREE.Mesh(geo, src.material); mesh.castShadow = true; mesh.receiveShadow = true;
  // the scan is a glove lying flat: give it a hand inside (a little fuller top to bottom)
  mesh.scale.set(1, 1.35, 1); root.add(mesh);
  const W = mx.x - mn.x, knuckle = L * 0.5, thumbX = W * 0.18;
  const v = new THREE.Vector3(), n = new THREE.Vector3(), q = new THREE.Quaternion(), ax = new THREE.Vector3(0, 0, 1);
  hand.setGrip = (gr) => {
    hand.grip = gr;
    const p = geo.attributes.position, nn = geo.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      v.set(base[i * 3], base[i * 3 + 1], base[i * 3 + 2]); n.set(baseN[i * 3], baseN[i * 3 + 1], baseN[i * 3 + 2]);
      const thumb = v.z > thumbX && v.x < knuckle * 1.25;
      if (thumb) {
        // the thumb folds in under the palm about an axis along the hand
        const k = THREE.MathUtils.clamp((v.z - thumbX) / (W * 0.32), 0, 1);
        q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), gr * 1.25 * k);
        v.sub(new THREE.Vector3(0, 0, thumbX)).applyQuaternion(q).add(new THREE.Vector3(0, 0, thumbX)); n.applyQuaternion(q);
      } else if (v.x > knuckle) {
        // fingers curl toward the palm as one arc of constant curvature from the knuckles to the tips
        const th = gr * 2.3;
        if (th > 1e-4) {
          const R = (L - knuckle) / th, phi = (v.x - knuckle) / R, y0 = v.y;
          v.x = knuckle + (R + y0) * Math.sin(phi); v.y = -R + (R + y0) * Math.cos(phi);
          q.setFromAxisAngle(ax, -phi); n.applyQuaternion(q);
        }
      }
      p.setXYZ(i, v.x, v.y, -v.z); nn.setXYZ(i, n.x, n.y, -n.z);
    }
    p.needsUpdate = true; nn.needsUpdate = true; geo.computeBoundingSphere();
  };
  hand.setGrip(0);
  hand.mesh = mesh; hand.cuffR = Math.max(0.028, W * 0.27); hand.length = L;
  // a second glove, as it is at a given grip, for the other hand (unmirrored: the left)
  hand.cloneGlove = (gr) => {
    const g = hand.grip; hand.setGrip(gr); const cg = geo.clone(); hand.setGrip(g);
    const p = cg.attributes.position, nn = cg.attributes.normal, ix = cg.index.array;
    for (let i = 0; i < p.count; i++) { p.setZ(i, -p.getZ(i)); nn.setZ(i, -nn.getZ(i)); }
    for (let t = 0; t < ix.length; t += 3) { const b = ix[t + 1]; ix[t + 1] = ix[t + 2]; ix[t + 2] = b; }
    const m = new THREE.Mesh(cg, src.material); m.scale.set(1, 1.35, 1); m.castShadow = m.receiveShadow = true; return m;
  };
  return hand;
}

// ---------------------------------------------------------------------------------------------------------------
// The body: jeans, a hooded parka, two arms. Each part is a skin of rings laid every frame along a curve through its
// joints (rounded at the inner joints, so a knee or an elbow bends without a seam); a profile gives each ring its
// shape (fullness, creases, seams, the parka's zip and pockets).
const _v = new THREE.Vector3(), _w = new THREE.Vector3();
class Skin {
  constructor(mat, { rings = 40, seg = 28, tile = 0.25, profile, open = true }) {
    this.rings = rings; this.seg = seg; this.profile = profile; this.tile = tile;
    const n = rings * (seg + 1), g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
    const idx = [];
    for (let j = 0; j < rings - 1; j++) for (let i = 0; i < seg; i++) { const a = j * (seg + 1) + i, b = a + seg + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, mat); this.mesh.castShadow = true; this.mesh.receiveShadow = true; this.mesh.frustumCulled = false;
    this.path = []; for (let i = 0; i < 72; i++) this.path.push(new THREE.Vector3());
    this.cum = new Float32Array(72);
  }
  // joints: points (in the parent's frame); side: a lateral hint; corner radius rc at each inner joint
  lay(joints, side, { rc = 0.06, flip = false, ctx = {} } = {}) {
    // the centre line: straight runs and quadratic corners, resampled
    const pts = [joints[0].clone()];
    for (let k = 1; k < joints.length - 1; k++) {
      const a = joints[k - 1], b = joints[k], c = joints[k + 1];
      const u = _v.subVectors(b, a), lu = u.length(), w = _w.subVectors(c, b), lw = w.length(); u.divideScalar(lu || 1); w.divideScalar(lw || 1);
      const r = Math.min(rc, lu * 0.45, lw * 0.45), p0 = b.clone().addScaledVector(u, -r), p2 = b.clone().addScaledVector(w, r);
      for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(new THREE.Vector3().copy(p0).multiplyScalar((1 - t) ** 2).addScaledVector(b, 2 * t * (1 - t)).addScaledVector(p2, t * t)); }
    }
    pts.push(joints[joints.length - 1].clone());
    const P = this.path, C = this.cum, M = P.length; let tot = 0; const seglen = [0];
    for (let i = 1; i < pts.length; i++) { tot += pts[i].distanceTo(pts[i - 1]); seglen.push(tot); }
    for (let i = 0; i < M; i++) {
      const d = tot * i / (M - 1); let k = 1; while (k < pts.length - 1 && seglen[k] < d) k++;
      const t = (d - seglen[k - 1]) / Math.max(1e-6, seglen[k] - seglen[k - 1]); P[i].lerpVectors(pts[k - 1], pts[k], Math.min(1, Math.max(0, t))); C[i] = d;
    }
    this.len = tot;
    const pos = this.mesh.geometry.attributes.position, uv = this.mesh.geometry.attributes.uv, S = this.seg;
    const T = new THREE.Vector3(), Z = new THREE.Vector3(), N = new THREE.Vector3(), c = new THREE.Vector3();
    for (let j = 0; j < this.rings; j++) {
      const s = j / (this.rings - 1), f = s * (M - 1), i0 = Math.min(M - 2, Math.floor(f)), ft = f - i0;
      c.lerpVectors(P[i0], P[i0 + 1], ft);
      T.subVectors(P[Math.min(M - 1, i0 + 2)], P[Math.max(0, i0 - 1)]).normalize();
      Z.copy(side).addScaledVector(T, -side.dot(T)).normalize();
      if (flip) N.crossVectors(T, Z); else N.crossVectors(Z, T);
      const d = s * tot, pr = this.profile(d, tot, ctx);
      let circ = 0;
      for (let i = 0; i <= S; i++) {
        const a = (i / S) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a), e = pr.p || 2;
        let x = pr.rx * Math.sign(ca) * Math.abs(ca) ** (2 / e), z = pr.rz * Math.sign(sa) * Math.abs(sa) ** (2 / e);
        const bump = pr.bump ? pr.bump(a, d) : 0;
        x += ca * bump; z += sa * bump;
        pos.setXYZ(j * (S + 1) + i, c.x + N.x * x + Z.x * z, c.y + N.y * x + Z.y * z, c.z + N.z * x + Z.z * z);
        if (i === 1) circ = Math.hypot(x - pr.rx, z) * S;
        uv.setXY(j * (S + 1) + i, (i / S) * (pr.rx + pr.rz) * Math.PI / this.tile, d / this.tile);
      }
    }
    pos.needsUpdate = true; uv.needsUpdate = true;
    const g = this.mesh.geometry; g.computeVertexNormals();
    // the ring's seam: the first and last column share their normals
    const nr = g.attributes.normal;
    for (let j = 0; j < this.rings; j++) { const a = j * (S + 1), b = a + S; _v.set(nr.getX(a) + nr.getX(b), nr.getY(a) + nr.getY(b), nr.getZ(a) + nr.getZ(b)).normalize(); nr.setXYZ(a, _v.x, _v.y, _v.z); nr.setXYZ(b, _v.x, _v.y, _v.z); }
    nr.needsUpdate = true;
  }
}
const bell = (x, w) => Math.exp(-((x / w) ** 2));
const lerp = (a, b, t) => a + (b - a) * t;
// a radius that runs through (d, value) keys, smoothly
const keys = (K) => (d) => { if (d <= K[0][0]) return K[0][1]; for (let i = 1; i < K.length; i++) if (d <= K[i][0]) { const t = (d - K[i - 1][0]) / (K[i][0] - K[i - 1][0]); return lerp(K[i - 1][1], K[i][1], smooth(t)); } return K[K.length - 1][1]; };
const angd = (a, b) => { let x = (a - b) % (Math.PI * 2); if (x > Math.PI) x -= Math.PI * 2; if (x < -Math.PI) x += Math.PI * 2; return x; };

// legs: hips at y = 0.95, knees at 0.52, boots on the ankles; the parka down over the hips; arms; the hood up
export function makeLegs(bootsModel, tex = {}, hand = null, headModel = null) {
  const denim = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.5, 0.57, 0.72), roughness: 1, ...texSet(tex.denim, [1, 1]), normalScale: new THREE.Vector2(1.1, 1.1), side: THREE.DoubleSide });
  const parkaT = tex.linen ? texSet(tex.linen, [1, 1]) : {};
  const parka = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(0.055, 0.065, 0.05), roughness: 0.75, normalMap: parkaT.normalMap, roughnessMap: parkaT.roughnessMap, normalScale: new THREE.Vector2(0.6, 0.6),
    sheen: 0.15, sheenRoughness: 0.6, sheenColor: new THREE.Color(0.12, 0.13, 0.11), side: THREE.DoubleSide });
  const root = new THREE.Group(); root.name = 'stranger';
  const pelvis = new THREE.Group(); pelvis.position.y = 0.95; root.add(pelvis);
  const boots = {};
  if (bootsModel) bootsModel.scene.traverse((o) => { if (o.isMesh) boots[/_l$/.test(o.name) ? 'L' : 'R'] = o; });
  const legs = {};
  // the jeans: full at the seat, straight down the leg, bunched where they are tucked into the boots; a crease
  // behind the knee when it bends; the side seams
  const legR = keys([[0, 0.088], [0.12, 0.084], [0.3, 0.074], [0.5, 0.06], [0.62, 0.058], [0.72, 0.061], [0.86, 0.056], [1.0, 0.05]]);
  const legProfile = (d, tot, ctx) => {
    const e = tot - d, sh = ctx.shaft || 0.06;
    // inside the shaft the jeans fill it; just above the rim they bunch and flare over it; then the leg's own line
    const inS = THREE.MathUtils.smoothstep(e, ctx.rim - 0.01, ctx.rim + 0.03), over = Math.exp(-(((e - ctx.rim - 0.045) / 0.035) ** 2));
    const r = lerp(sh - 0.004, legR(d), inS) + over * 0.009, sideA = ctx.outer;
    return { rx: r * 1.07, rz: r, p: 2.1, bump: (a, dd) => {
      let b = 0.0016 * bell(angd(a, sideA), 0.05) + 0.0012 * bell(angd(a, sideA + Math.PI), 0.05);                   // seams
      b += 0.0042 * ctx.bend * bell(dd - 0.53, 0.05) * Math.max(0, -Math.cos(a)) * Math.sin(dd * 140 + a);            // knee creases
      b += 0.006 * Math.exp(-((((tot - dd) - ctx.rim - 0.05) / 0.05) ** 2)) * Math.abs(Math.sin(a * 3 + dd * 70 + ctx.ph));     // stacked over the boot
      b += 0.0022 * Math.sin(a * 2 + dd * 23 + ctx.ph) * bell(dd - 0.25, 0.2);                                         // loose folds
      return b; } };
  };
  // the seat of the jeans under the parka
  const seat = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), denim); seat.scale.set(0.15, 0.13, 0.18); seat.position.y = -0.02; pelvis.add(seat);
  for (const [s, sz] of [['L', 0.1], ['R', -0.1]]) {
    const hip = new THREE.Group(); hip.position.set(0, 0, sz); pelvis.add(hip);
    const knee = new THREE.Group(); knee.position.y = -0.43; hip.add(knee);
    const ankle = new THREE.Group(); ankle.position.y = -0.43; knee.add(ankle);
    const b = boots[s];
    let boot = null;
    if (b) {
      const m = new THREE.Mesh(b.geometry.clone(), b.material);
      m.geometry.computeBoundingBox(); const bb = m.geometry.boundingBox, c = bb.getCenter(new THREE.Vector3());
      m.geometry.translate(-c.x, -bb.min.y, -c.z);
      const size = bb.getSize(new THREE.Vector3());
      if (size.z > size.x) m.geometry.rotateY(Math.PI / 2);
      m.position.y = -0.09; m.castShadow = true; m.receiveShadow = true; ankle.add(m);
      // the shaft: its centre and opening at the top, and the height where the foot turns into the shaft
      const p = m.geometry.attributes.position, H = size.y; let cx = 0, cz = 0, n = 0;
      for (let i = 0; i < p.count; i++) if (p.getY(i) > H * 0.9) { cx += p.getX(i); cz += p.getZ(i); n++; }
      cx /= n || 1; cz /= n || 1; let R = 0;
      for (let i = 0; i < p.count; i++) if (p.getY(i) > H * 0.9) R = Math.max(R, Math.hypot(p.getX(i) - cx, p.getZ(i) - cz));
      // the shaft centred on the shin's axis; the bend about the ankle (9 cm up)
      m.geometry.translate(-cx, 0, -cz);
      boot = { m, base: p.array.slice(), H, cx: 0, cz: 0, R: R * 0.92, pivot: 0.09 };
    }
    const skin = new Skin(denim, { rings: 44, seg: 26, tile: 0.22, profile: legProfile }); root.add(skin.mesh);
    legs[s] = { hip, knee, ankle, skin, boot, out: sz > 0 ? Math.PI / 2 : -Math.PI / 2, ph: sz * 31 };
  }
  // the parka: hip length, a little flared at the hem, the drawcord at the waist, the zip down the front, two pockets
  const torR = keys([[0, 0.235], [0.17, 0.222], [0.3, 0.205], [0.34, 0.2], [0.52, 0.226], [0.6, 0.222], [0.66, 0.19], [0.72, 0.09], [0.76, 0.07]]);
  const torD = keys([[0, 0.168], [0.17, 0.156], [0.32, 0.142], [0.52, 0.142], [0.6, 0.135], [0.66, 0.12], [0.72, 0.075], [0.76, 0.065]]);
  const torso = new Skin(parka, { rings: 48, seg: 40, tile: 0.18, profile: (d, tot, ctx) => ({ rx: torD(d), rz: torR(d), p: 2.6, bump: (a, dd) => {
    let b = -0.004 * bell(a, 0.025) * (dd < 0.68 ? 1 : 0) + 0.003 * (bell(a - 0.07, 0.03) + bell(a + 0.07, 0.03)) * (dd < 0.68 ? 1 : 0);          // zip and placket
    b += 0.006 * bell(dd - 0.012, 0.01);                                                                                                          // rolled hem
    b -= 0.008 * bell(dd - 0.33, 0.018);                                                                                                          // drawcord
    for (const pa of [0.95, -0.95]) b += 0.005 * bell(angd(a, pa), 0.32) * (bell(dd - 0.2, 0.012) + 0.5 * bell(dd - 0.13, 0.05));               // pocket flaps
    b += 0.003 * Math.sin(a * 5 + dd * 19) * bell(dd - 0.45, 0.2) + 0.004 * ctx.stoop * Math.max(0, Math.cos(a)) * Math.sin(dd * 60) * bell(dd - 0.34, 0.08);   // folds, bunching when bent
    return b; } }) });
  root.add(torso.mesh);
  // sleeves: full at the shoulder, an elastic cuff over the glove
  const armR = keys([[0, 0.07], [0.08, 0.066], [0.3, 0.058], [0.5, 0.054], [0.56, 0.05], [0.6, 0.046], [0.64, 0.046]]);
  const armProfile = (d, tot, ctx) => { const r = armR(d * 0.64 / tot); return { rx: r, rz: r * 0.95, p: 2, bump: (a, dd) => {
    const u = dd / tot;
    return 0.004 * Math.sin(a * 3 + u * 26 + ctx.ph) * bell(u - 0.5, 0.25) + 0.005 * ctx.bend * bell(u - 0.47, 0.05) * Math.sin(u * 160) * Math.max(0, Math.cos(a))
      + 0.003 * bell(u - 0.93, 0.02); } }; };
  const arms = { L: { skin: new Skin(parka, { rings: 36, seg: 22, tile: 0.18, profile: armProfile }), side: -1, ph: 2 }, R: { skin: new Skin(parka, { rings: 36, seg: 22, tile: 0.18, profile: armProfile }), side: 1, ph: 5 } };
  for (const a of Object.values(arms)) root.add(a.skin.mesh);
  // the left glove hangs at the side; the right hand is the one that reaches (given by makeHand)
  const leftGlove = hand?.cloneGlove ? hand.cloneGlove(0.32) : null; if (leftGlove) root.add(leftGlove);
  // the hood, up: the face lost in its shadow
  const head = new THREE.Group(); root.add(head);
  const hoodG = (() => {
    const NU = 44, NV = 22, pos = [], idx = [], th0 = 0.95;
    for (let j = 0; j <= NV; j++) {
      const v = j / NV, th = th0 + v * (Math.PI - th0);
      for (let i = 0; i <= NU; i++) {
        const u = (i / NU) * Math.PI * 2, top = Math.max(0, Math.sin(u)), low = Math.max(0, -Math.sin(u));
        // the rim rolls outward a little; the seam ridge runs over the top to the back; it hangs fuller below
        let r = 0.13 + 0.012 * top ** 6 * Math.sin(v * Math.PI) + 0.008 * Math.sin(u * 5 + v * 9) * v + 0.006 * (1 - v) ** 6 + 0.02 * low * v;
        const x = Math.cos(th) * r * 1.06, y = Math.sin(th) * Math.sin(u) * r * 1.18 - low * v * 0.03, z = Math.sin(th) * Math.cos(u) * r * 0.97;
        pos.push(x + (1 - v) ** 4 * 0.012, y, z);
      }
    }
    for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) { const a = j * (NU + 1) + i, b = a + NU + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
  })();
  const hood = new THREE.Mesh(hoodG, parka); hood.castShadow = true; head.add(hood);
  const inner = new THREE.Mesh(hoodG, new THREE.MeshStandardMaterial({ color: 0x0b0a09, roughness: 1, side: THREE.BackSide })); inner.scale.setScalar(0.97); head.add(inner);
  // the face, in the hood's shadow: a scanned head (Lee Perry-Smith by Infinite-Realities, CC BY 3.0)
  let headMesh = null;
  headModel?.scene.traverse((o) => { if (o.isMesh && !headMesh) headMesh = o; });
  if (headMesh) {
    const f = new THREE.Mesh(headMesh.geometry, headMesh.material); f.castShadow = true; f.receiveShadow = true;
    f.material.roughness = 0.55; f.scale.setScalar(1.0); f.rotation.y = Math.PI / 2; f.position.set(0.012, -0.15, 0); head.add(f);
  } else {
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 14), new THREE.MeshStandardMaterial({ color: 0x1c130f, roughness: 0.75 })); face.scale.set(0.9, 1.15, 0.85); face.position.set(-0.005, -0.015, 0); head.add(face);
  }
  const L = { root, pelvis, legs, stoop: 0, look: 0, hand: null };
  const m4 = new THREE.Matrix4(), inv = new THREE.Matrix4(), q = new THREE.Quaternion(), X = new THREE.Vector3(), Y = new THREE.Vector3(), Zv = new THREE.Vector3();
  const local = (o, x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z).applyMatrix4(o.matrixWorld).applyMatrix4(inv);
  let gait = { phase: 0, amount: 0, crouch: 0 };
  // two-bone arm: shoulder S, wrist W, upper a, forearm b, the elbow toward `pole`
  const ik = (S, W, a, b, pole) => {
    const dv = new THREE.Vector3().subVectors(W, S), d0 = dv.length(), dir = dv.clone().divideScalar(d0 || 1);
    const st = Math.max(1, d0 / (a + b - 0.002)), aa = a * st, bb = b * st, d = Math.min(d0, aa + bb - 0.001);
    const ca = THREE.MathUtils.clamp((aa * aa + d * d - bb * bb) / (2 * aa * d), -1, 1), sa = Math.sqrt(1 - ca * ca);
    const pp = pole.clone().addScaledVector(dir, -pole.dot(dir)).normalize();
    return S.clone().addScaledVector(dir, aa * ca).addScaledVector(pp, aa * sa);
  };
  // the hanging right hand's place (world), for when it is not holding anything
  L.restPose = (pos, quat) => { pos.copy(L.restW); quat.copy(L.restQ); };
  L.restW = new THREE.Vector3(); L.restQ = new THREE.Quaternion();
  L.update = () => {
    const { phase, amount, crouch } = gait, sw = Math.sin(phase * Math.PI * 2) * amount;
    root.updateMatrixWorld(true); inv.copy(root.matrixWorld).invert();
    // legs
    for (const g of Object.values(legs)) {
      const H = local(g.hip), K = local(g.knee), A = local(g.ankle), top = H.clone().add(H.clone().sub(K).normalize().multiplyScalar(0.08));
      const B0 = g.boot, rim = B0 ? B0.H - 0.09 - 0.12 : 0.18, end = A.clone().add(K.clone().sub(A).normalize().multiplyScalar(0.12));
      g.skin.lay([top, H, K, end], new THREE.Vector3(0, 0, 1), { rc: 0.12, ctx: { bend: Math.min(1, -g.knee.rotation.z), outer: g.out, ph: g.ph, shaft: B0 ? B0.R : 0.06, rim } });
      // the rubber shaft bends with the shin above the ankle; the foot stays flat on the ground
      if (B0) {
        const th = -g.ankle.rotation.z, p = B0.m.geometry.attributes.position, b0 = B0.base, c = Math.cos(th), sn = Math.sin(th);
        if (Math.abs(th - (B0.th || 0)) > 1e-4) {
          B0.th = th;
          for (let i = 0; i < p.count; i++) {
            const x = b0[i * 3], y = b0[i * 3 + 1], w = THREE.MathUtils.smoothstep(y, B0.pivot * 0.6, B0.pivot * 1.8), a = th * w, ca = Math.cos(a), sa = Math.sin(a);
            const dx = x - B0.cx, dy = y - B0.pivot;
            p.setXY(i, B0.cx + dx * ca - dy * sa, B0.pivot + dx * sa + dy * ca);
          }
          p.needsUpdate = true; B0.m.geometry.computeVertexNormals();
        }
      }
    }
    // torso: hem to waist rides on the pelvis; above the waist it leans forward by `stoop`
    const P0 = local(pelvis, 0, -0.17, 0), P1 = local(pelvis, 0.0, 0.15, 0);
    const st = L.stoop, up = new THREE.Vector3(Math.sin(st), Math.cos(st), 0);
    const P2 = P1.clone().addScaledVector(up, 0.3), P3 = P1.clone().addScaledVector(up, 0.46);
    torso.lay([P0, P1, P2, P3], new THREE.Vector3(0, 0, 1), { rc: 0.14, flip: true, ctx: { stoop: st } });
    // head in the hood: on the neck, bowed a little further than the back, looking down at the robot
    const hb = st + 0.25 + L.look;
    head.position.copy(P1).addScaledVector(up, 0.52).add(new THREE.Vector3(Math.sin(hb) * 0.06, 0.0, 0));
    head.rotation.set(0, 0, -hb * 0.8);
    // shoulders
    const fwd = new THREE.Vector3(Math.cos(st), -Math.sin(st), 0);
    for (const [k, a] of Object.entries(arms)) {
      const S = P1.clone().addScaledVector(up, 0.27).add(new THREE.Vector3(0, 0, a.side * 0.2)).addScaledVector(fwd, -0.01);
      let W, hx, bend;
      const holding = k === 'R' && L.hand && L.hand.visible && L.reaching;
      if (holding) {
        W = local(L.hand); hx = new THREE.Vector3(1, 0, 0).applyQuaternion(L.hand.getWorldQuaternion(q)).applyQuaternion(new THREE.Quaternion().setFromRotationMatrix(inv)).normalize();
      } else {
        // hanging: the elbow a little bent, swinging against the legs
        const swing = (k === 'L' ? 1 : -1) * sw * 0.32;
        W = S.clone().add(new THREE.Vector3(Math.sin(swing) * 0.52 + 0.08 + st * 0.25, -Math.cos(swing) * 0.52, a.side * 0.12));
        hx = new THREE.Vector3().subVectors(W, S).normalize().add(new THREE.Vector3(0.15, 0, 0)).normalize();
      }
      const E = ik(S, W, 0.31, 0.27, new THREE.Vector3(-0.6, -0.5, a.side * 0.6));
      bend = Math.min(1, Math.acos(THREE.MathUtils.clamp(E.clone().sub(S).normalize().dot(W.clone().sub(E).normalize()), -1, 1)) / 1.6);
      const W2 = W.clone().addScaledVector(hx, 0.035), S0 = S.clone().add(new THREE.Vector3(0, 0.02, -a.side * 0.05));
      const bn = new THREE.Vector3().crossVectors(E.clone().sub(S), W.clone().sub(E));
      a.skin.lay([S0, S, E, W, W2], bn.lengthSq() > 1e-4 ? bn.normalize() : new THREE.Vector3(0, 0, 1), { rc: 0.07, ctx: { bend, ph: a.ph } });
      // gloves: the hanging hand's orientation (fingers down the forearm, palm in, thumb forward)
      const F = W.clone().sub(E).normalize();
      X.copy(F); Y.set(0, 0, a.side).addScaledVector(X, -X.dot(new THREE.Vector3(0, 0, a.side))).normalize(); Zv.crossVectors(X, Y);
      const qq = new THREE.Quaternion().setFromRotationMatrix(m4.makeBasis(X, Y, Zv));
      if (k === 'L' && leftGlove) { leftGlove.position.copy(W); leftGlove.quaternion.copy(qq); }
      if (k === 'R') {
        // the right hand's resting place in world space
        L.restW.copy(W).applyMatrix4(root.matrixWorld);
        L.restQ.copy(root.getWorldQuaternion(new THREE.Quaternion())).multiply(qq);
      }
    }
  };
  // a step cycle: phase 0..1 per step pair; amount 0 = standing still
  L.setGait = (phase, amount = 1, crouch = 0) => {
    gait = { phase, amount, crouch };
    for (const [s, off] of [['L', 0], ['R', 0.5]]) {
      const p = (phase + off) % 1, a = p * Math.PI * 2, swing = p > 0.5;
      const g = legs[s];
      g.hip.rotation.z = (Math.sin(a) * 0.38 * amount) + crouch * 1.25;
      g.knee.rotation.z = -(swing ? Math.sin((p - 0.5) * 2 * Math.PI) * 0.9 * amount : 0.06 * amount) - crouch * 2.1;
      g.ankle.rotation.z = -(g.hip.rotation.z + g.knee.rotation.z) * (0.25 + 0.75 * Math.min(1, crouch / 0.1));
    }
    // the hips as high as the planted leg reaches (thigh and shin 43 cm, the ankle 9 cm up): the feet stay on the ground
    let reach = 0;
    for (const g of Object.values(legs)) reach = Math.max(reach, 0.43 * Math.cos(g.hip.rotation.z) + 0.43 * Math.cos(g.hip.rotation.z + g.knee.rotation.z) + 0.09);
    pelvis.position.y = Math.min(0.95, reach) - Math.abs(Math.sin(phase * Math.PI * 2)) * 0.012 * amount;
    pelvis.position.x = -crouch * 0.18 - L.stoop * 0.06;      // the seat goes back to keep the balance
    L.update();
  };
  L.setGait(0, 0);
  return L;
}
