// The duvet on the stranger's bed, as cloth (src/clothsim.js, simulated in src/cloth.worker.js): it falls over him
// and the mattress at the start and lies as it settles; then it moves as he does: his chest lifts it as he breathes,
// it rides up over his arm and slides off it when he reaches for the lamp, it drops back when he lies still; the
// robot can push into it. Drawn as a quilt: the simulated sheet thickened into a top, an underside and a rim.
import * as THREE from 'three';
import { ClothSim, BodyField, prepBoxes } from './clothsim.js';
import ClothWorker from './cloth.worker.js?worker&inline';

const ARM = /^(upperarm|lowerarm|hand|thumb|index|middle|ring|pinky)/, SKIP = /^(head|neck|eye)/;

export class Quilt {
  // man: src/person.js's Person, posed and placed; layout: { x0, x1, z0, z1, y, nx, nz } (the sheet, flat, before it
  // falls); boxes: [{ c, h, ry, r }] (what it lies on); floor: y; field: { x0, x1, z0, z1 } (where he may be)
  constructor({ parent, material, man, layout, boxes, floor, field, thick = 0.026, settle = 3.2, worker = true, cloth = {} }) {
    this.man = man; this.thick = thick; this.ready = false; this.busy = false; this.acc = 0;
    man.root.updateMatrixWorld(true);
    // his trunk and legs: half the vertices of his body and his clothes (not his head, neck or arms), in bind space
    const body = man.root.getObjectByName('stranger_body_bed') || man.morphs[0];
    this.skel = body.skeleton; const bones = this.skel.bones, P = [], SI = [], SW = [], v = new THREE.Vector3();
    const armVerts = { l: { upperarm: [], lowerarm: [], hand: [] }, r: { upperarm: [], lowerarm: [], hand: [] } };
    man.root.traverse((o) => {
      if (!o.isSkinnedMesh || !o.visible || o.skeleton !== this.skel || /eyes|lashes|brows|teeth|tongue|hair/.test(o.name)) return;
      const g = o.geometry, pos = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
      for (let i = 0; i < pos.count; i++) {
        let best = 0, bw = 0; for (let k = 0; k < 4; k++) if (sw.getComponent(i, k) > bw) { bw = sw.getComponent(i, k); best = si.getComponent(i, k); }
        const bn = bones[best].name;
        if (SKIP.test(bn)) continue;
        if (ARM.test(bn)) {
          // (the arms are capsules: their vertices, as he lies now, size them)
          if (i % 3) continue;
          const side = bn.endsWith('_l') ? 'l' : 'r', part = /^upperarm/.test(bn) ? 'upperarm' : /^lowerarm/.test(bn) ? 'lowerarm' : 'hand';
          o.getVertexPosition(i, v); v.applyMatrix4(o.matrixWorld); armVerts[side][part].push(v.clone());
          continue;
        }
        if (i % 2) continue;
        v.fromBufferAttribute(pos, i).applyMatrix4(o.bindMatrix); P.push(v.x, v.y, v.z);
        for (let k = 0; k < 4; k++) { SI.push(si.getComponent(i, k)); SW.push(sw.getComponent(i, k)); }
      }
    });
    this.bm = new Float32Array(bones.length * 16); this.tmpM = new THREE.Matrix4();
    // the arm capsules: shoulder-elbow, elbow-wrist, wrist-fingertips; each as thick as most of its vertices are
    const B = (n) => man.bone(n), seg = [];
    for (const s of ['l', 'r']) {
      seg.push({ a: B('upperarm_' + s), b: B('lowerarm_' + s), verts: armVerts[s].upperarm });
      seg.push({ a: B('lowerarm_' + s), b: B('hand_' + s), verts: armVerts[s].lowerarm });
      seg.push({ a: B('hand_' + s), b: B('middle_01_' + s), ext: 1.9, verts: armVerts[s].hand });
    }
    const A = new THREE.Vector3(), Bv = new THREE.Vector3(), Q = new THREE.Vector3(), L = new THREE.Line3();
    for (const S of seg) {
      this.ends(S, A, Bv); L.set(A, Bv);
      const d = S.verts.map((p) => L.closestPointToPoint(p, true, Q).distanceTo(p)).sort((a, b) => a - b);
      S.r = d.length ? d[Math.floor(d.length * 0.7)] : 0.04; S.r = S.ext ? Math.min(0.04, Math.max(0.028, S.r)) : Math.min(0.07, Math.max(0.038, S.r)); delete S.verts;
    }
    this.seg = seg; this.caps = new Float32Array(seg.length * 7); this.spheres = new Float32Array(8);
    // the mesh: the sheet's top, its underside and a rim round its edge (normals from the faces: the rim rounds it)
    const { nx, nz } = layout, N = nx * nz;
    this.nx = nx; this.nz = nz; this.N = N;
    const loop = [];
    for (let i = 0; i < nx - 1; i++) loop.push(i);
    for (let k = 0; k < nz - 1; k++) loop.push(k * nx + nx - 1);
    for (let i = nx - 1; i > 0; i--) loop.push((nz - 1) * nx + i);
    for (let k = nz - 1; k > 0; k--) loop.push(k * nx);
    // (the rim has its own vertices, three rows of them round the loop: the top's edge, bowed out, the underside's edge)
    const Lp = loop.length, V = N * 2 + Lp * 3; this.loop = loop;
    const geo = new THREE.BufferGeometry(), pos = new Float32Array(V * 3), uv = new Float32Array(V * 2), idx = [];
    for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) {
      const c = k * nx + i, u = layout.x0 + (layout.x1 - layout.x0) * i / (nx - 1), w = layout.z0 + (layout.z1 - layout.z0) * k / (nz - 1);
      uv[c * 2] = u; uv[c * 2 + 1] = w; uv[(N + c) * 2] = u; uv[(N + c) * 2 + 1] = w;
    }
    for (let k = 0; k < nz - 1; k++) for (let i = 0; i < nx - 1; i++) {
      const a = k * nx + i, b = a + 1, c = a + nx, d = c + 1;
      idx.push(a, c, b, b, c, d, N + a, N + b, N + c, N + b, N + d, N + c);
    }
    let run = 0;
    for (let j = 0; j < Lp; j++) {
      const a = loop[j], b = loop[(j + 1) % Lp];
      for (let r = 0; r < 3; r++) { uv[(N * 2 + j * 3 + r) * 2] = run; uv[(N * 2 + j * 3 + r) * 2 + 1] = r * thick; }
      run += Math.hypot(uv[b * 2] - uv[a * 2], uv[b * 2 + 1] - uv[a * 2 + 1]);
      const j2 = (j + 1) % Lp, A = N * 2 + j * 3, B = N * 2 + j2 * 3;
      for (let r = 0; r < 2; r++) idx.push(A + r, B + r, A + r + 1, B + r, B + r + 1, A + r + 1);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setIndex(idx);
    // (the creases shaded: a vertex lying below its neighbours is darker; the underside a little darker still)
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(V * 3).fill(1), 3).setUsage(THREE.DynamicDrawUsage));
    this.mesh = new THREE.Mesh(geo, material); this.mesh.castShadow = this.mesh.receiveShadow = true; this.mesh.frustumCulled = false;
    this.mesh.visible = false; parent.add(this.mesh);
    // the simulation
    const init = {
      type: 'init', cloth: { ...layout, thick, ...cloth }, boxes, floor, settle,
      field: { ...field, C: 0.025, p0: Float32Array.from(P), si: Uint16Array.from(SI), sw: Float32Array.from(SW) },
      bones: this.boneMatrices(), caps: this.capsules(), spheres: this.spheres,
    };
    const got = (m) => { this.state = m; this.busy = false; if (m.type === 'ready') this.ready = true; };
    if (worker) {
      try { this.worker = new ClothWorker(); this.worker.onmessage = (e) => got(e.data); this.worker.onerror = () => this.local(init, got); this.worker.postMessage(init); this.busy = true; }
      catch (e) { this.local(init, got); }
    } else this.local(init, got);
  }
  // (no workers: the same simulation here, a little coarser in time)
  local(init, got) {
    try { this.worker?.terminate(); } catch (e) { /* */ }
    this.worker = null;
    const sim = new ClothSim({ ...init.cloth, h0: 1 / 360 }); sim.boxes = prepBoxes(init.boxes); sim.floor = init.floor;
    const field = new BodyField(init.field); field.update(init.bones); sim.field = field; sim.caps = init.caps; sim.spheres = init.spheres;
    sim.settle(init.settle);
    this.sim = sim; this.field = field;
    got({ type: 'ready', pos: sim.x, nrm: sim.normals() });
  }
  ends(S, a, b) {
    S.a.getWorldPosition(a); S.b.getWorldPosition(b);
    if (S.ext) b.sub(a).multiplyScalar(S.ext).add(a);
  }
  boneMatrices() {
    const bones = this.skel.bones, inv = this.skel.boneInverses, M = this.tmpM;
    for (let k = 0; k < bones.length; k++) { M.multiplyMatrices(bones[k].matrixWorld, inv[k]); M.toArray(this.bm, k * 16); }
    return this.bm.slice();
  }
  capsules() {
    const a = new THREE.Vector3(), b = new THREE.Vector3();
    this.seg.forEach((S, k) => { this.ends(S, a, b); this.caps.set([a.x, a.y, a.z, b.x, b.y, b.z, S.r], k * 7); });
    return this.caps.slice();
  }
  // each frame: take the latest result into the mesh, and ask for the next step (one in flight at a time)
  update(dt, { robot = null, active = true } = {}) {
    if (this.state) { this.apply(this.state); this.state = null; }
    if (!this.ready || !active) return;
    this.acc = Math.min(1 / 20, this.acc + dt);
    if (this.busy) return;
    if (robot) this.spheres.set([robot.x, robot.y + 0.1, robot.z, 0.12, robot.x, robot.y + 0.25, robot.z, 0.1]);
    const msg = { type: 'step', dt: this.acc, bones: this.boneMatrices(), caps: this.capsules(), spheres: this.spheres.slice() };
    this.acc = 0;
    if (this.worker) { this.busy = true; this.worker.postMessage(msg); }
    else if (this.sim) {
      this.field.update(msg.bones); this.sim.caps = msg.caps; this.sim.spheres = msg.spheres; this.sim.step(msg.dt);
      this.state = { type: 'state', pos: this.sim.x, nrm: this.sim.normals() };
    }
  }
  apply({ pos: X, nrm: Nr }) {
    const g = this.mesh.geometry, P = g.attributes.position.array, N = this.N, t = this.thick;
    for (let i = 0; i < N * 3; i += 3) {
      for (let c = 0; c < 3; c++) { P[i + c] = X[i + c] + Nr[i + c] * t; P[N * 3 + i + c] = X[i + c] - Nr[i + c] * t; }
    }
    // the rim: from the top's edge out round the bow to the underside's edge (out: the normal across the loop)
    const loop = this.loop, Lp = loop.length, R = N * 2 * 3;
    for (let j = 0; j < Lp; j++) {
      const c = loop[j] * 3, pv = loop[(j + Lp - 1) % Lp] * 3, nv = loop[(j + 1) % Lp] * 3;
      const tx = X[nv] - X[pv], ty = X[nv + 1] - X[pv + 1], tz = X[nv + 2] - X[pv + 2], nx_ = Nr[c], ny_ = Nr[c + 1], nz_ = Nr[c + 2];
      let ox = ny_ * tz - nz_ * ty, oy = nz_ * tx - nx_ * tz, oz = nx_ * ty - ny_ * tx; const ol = Math.hypot(ox, oy, oz) || 1; ox /= ol; oy /= ol; oz /= ol;
      const o = R + j * 9;
      for (let q = 0; q < 3; q++) {
        P[o + q] = X[c + q] + Nr[c + q] * t * 0.92;
        P[o + 3 + q] = X[c + q] + [ox, oy, oz][q] * t * 0.75;
        P[o + 6 + q] = X[c + q] - Nr[c + q] * t * 0.92;
      }
    }
    const col = g.attributes.color.array, nx = this.nx, nz = this.nz;
    for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) {
      const c = (k * nx + i) * 3, a = (k * nx + Math.max(0, i - 1)) * 3, b = (k * nx + Math.min(nx - 1, i + 1)) * 3, d = (Math.max(0, k - 1) * nx + i) * 3, e = (Math.min(nz - 1, k + 1) * nx + i) * 3;
      let cv = 0; for (let q = 0; q < 3; q++) cv += ((X[a + q] + X[b + q] + X[d + q] + X[e + q]) / 4 - X[c + q]) * Nr[c + q];
      const ao = Math.min(1, Math.max(0.55, 1 - cv * 38));
      col[c] = col[c + 1] = col[c + 2] = ao; col[N * 3 + c] = col[N * 3 + c + 1] = col[N * 3 + c + 2] = ao * 0.8;
    }
    g.attributes.color.needsUpdate = true;
    g.attributes.position.needsUpdate = true; g.computeVertexNormals(); g.computeBoundingSphere();
    this.mesh.visible = true;
  }
  dispose() { try { this.worker?.terminate(); } catch (e) { /* */ } }
}
