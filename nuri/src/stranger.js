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
// palm, plus a jacket sleeve over the cuff. Frame of the result: fingers along +x, palm facing -y, wrist at the origin.
export function makeHand(tex = {}, gloveModel = null) {
  const nylon = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(0.045, 0.05, 0.07), roughness: 0.55, metalness: 0, sheen: 0.45, sheenRoughness: 0.45, sheenColor: new THREE.Color(0.22, 0.24, 0.3), side: THREE.DoubleSide });
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
  for (let t = 0; t < idx0.length; t += 3) if (map[idx0[t]] >= 0) I.push(map[idx0[t]], map[idx0[t + 1]], map[idx0[t + 2]]);
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
      p.setXYZ(i, v.x, v.y, v.z); nn.setXYZ(i, n.x, n.y, n.z);
    }
    p.needsUpdate = true; nn.needsUpdate = true; geo.computeBoundingSphere();
  };
  hand.setGrip(0);
  // the jacket sleeve over the cuff, going up out of frame
  const cuffR = Math.max(0.028, W * 0.27);
  const sleeve = new THREE.Mesh(tube(-0.6, 0.035, (t, a) => {
    const u = 1 - t;
    return cuffR + 0.006 + 0.02 * Math.min(1, u * 2.2) + 0.0045 * Math.sin(a * 3 + u * 9) * Math.min(1, u * 4) + 0.003 * Math.sin(a * 5 - u * 14) * Math.min(1, u * 3)
      + 0.0035 * Math.sin(a * 9) * Math.max(0, 1 - u * 6);
  }, 36, 30, 0.8), nylon);
  sleeve.castShadow = true; root.add(sleeve);
  hand.length = L;
  return hand;
}

// legs: hips at y = 0.95 (the jacket hem closes them off), knees at 0.52, boots on the ankles
export function makeLegs(bootsModel, tex = {}) {
  const denim = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.55, 0.62, 0.78), roughness: 1, ...texSet(tex.denim, [2, 3]), normalScale: new THREE.Vector2(1.2, 1.2) });
  const coat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(0.045, 0.05, 0.07), roughness: 0.55, sheen: 0.45, sheenRoughness: 0.45, sheenColor: new THREE.Color(0.22, 0.24, 0.3) });
  const root = new THREE.Group(); root.name = 'stranger_legs';
  const pelvis = new THREE.Group(); pelvis.position.y = 0.95; root.add(pelvis);
  // the jacket hem round the hips (the rest of the person is out of frame)
  const hem = new THREE.Mesh(tube(-0.12, 0.34, (t, a) => 0.2 + 0.03 * t + 0.006 * Math.sin(a * 4 + t * 6), 40, 14, 0.62), coat);
  hem.rotation.z = Math.PI / 2; hem.castShadow = true; hem.material.side = THREE.DoubleSide; pelvis.add(hem);
  const boots = {};
  if (bootsModel) bootsModel.scene.traverse((o) => { if (o.isMesh) boots[/_l$/.test(o.name) ? 'L' : 'R'] = o; });
  const legs = {};
  for (const [s, sz] of [['L', 0.105], ['R', -0.105]]) {
    const hip = new THREE.Group(); hip.position.set(0, 0, sz); pelvis.add(hip);
    // thigh: hip (0) down to the knee (-0.43)
    const thigh = new THREE.Mesh(tube(-0.44, 0.04, (t, a) => 0.056 + 0.034 * smooth(t) + 0.003 * Math.sin(a * 3 + t * 20) * (1 - t), 26, 16), denim);
    thigh.rotation.z = Math.PI / 2; thigh.castShadow = true; hip.add(thigh);
    const knee = new THREE.Group(); knee.position.y = -0.43; hip.add(knee);
    // shin: knee down into the boot shaft; the jeans bunch where they go into the boot
    const shin = new THREE.Mesh(tube(-0.32, 0.03, (t, a) => {
      const bunch = Math.exp(-(((t - 0.18) / 0.1) ** 2)) * 0.007 * Math.sin(a * 5 + t * 40);
      return 0.047 + 0.012 * t + bunch;
    }, 26, 18), denim);
    shin.rotation.z = Math.PI / 2; shin.castShadow = true; knee.add(shin);
    const ankle = new THREE.Group(); ankle.position.y = -0.49; knee.add(ankle);
    const b = boots[s];
    if (b) {
      const m = new THREE.Mesh(b.geometry.clone(), b.material);
      m.geometry.computeBoundingBox(); const bb = m.geometry.boundingBox, c = bb.getCenter(new THREE.Vector3());
      // the scan stands upright with its sole at the bottom: put the sole under the ankle, toe forward (+x)
      m.geometry.translate(-c.x, -bb.min.y, -c.z);
      const size = bb.getSize(new THREE.Vector3());
      if (size.z > size.x) m.geometry.rotateY(Math.PI / 2);       // long axis of the foot along +x
      m.position.y = -0.03; m.castShadow = true; m.receiveShadow = true; ankle.add(m);
    }
    legs[s] = { hip, knee, ankle };
  }
  const L = { root, pelvis, legs };
  // a step cycle: phase 0..1 per step pair; amount 0 = standing still
  L.setGait = (phase, amount = 1, crouch = 0) => {
    for (const [s, off] of [['L', 0], ['R', 0.5]]) {
      const p = (phase + off) % 1, a = p * Math.PI * 2, swing = p > 0.5;   // second half of the cycle: the foot swings forward
      const g = legs[s];
      g.hip.rotation.z = (Math.sin(a) * 0.38 * amount) + crouch * 1.25;
      g.knee.rotation.z = -(swing ? Math.sin((p - 0.5) * 2 * Math.PI) * 0.9 * amount : 0.06 * amount) - crouch * 2.1;
      g.ankle.rotation.z = -(g.hip.rotation.z + g.knee.rotation.z) * 0.25;         // a little give at the ankle; the shaft follows the shin
    }
    // the hips ride lowest when both feet are down; crouching drops them a long way
    pelvis.position.y = 0.95 - Math.abs(Math.sin(phase * Math.PI * 2)) * 0.02 * amount - crouch * 0.42;
  };
  L.setGait(0, 0);
  return L;
}
