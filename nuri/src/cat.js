// The stranger's cat (blender/build_cat.py: a brown tabby, sculpted and rigged, in shell fur). It sleeps curled on its
// bed by the kitchen radiator, breathing, an ear twitching now and then. Touch it, or make a racket near it, and it
// springs up - back arched, fur on end, side on to the robot - then bolts: across the kitchen, out into the hall,
// round through the living room, and up its cat tree, knocking aside anything small in the way; from the top it
// watches the robot. All the poses are made here on its skeleton (a rotation per bone about the cat's own axes:
// x across it, y up, z forward).
import * as THREE from 'three';
import { furredMesh } from './fur.js';

const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
const LEGS = ['L', 'R'];

export class Cat {
  constructor(scene, model, { tier, bed, path, perch, audio } = {}) {
    this.scene = scene; this.audio = audio;
    this.group = new THREE.Group(); scene.add(this.group);
    this.body = new THREE.Group(); this.group.add(this.body);           // (rolled onto its side when asleep)
    const src = model.scene; this.body.add(src);
    let skin = null; src.traverse((o) => { if (o.isSkinnedMesh) skin = o; });
    this.bones = {};
    src.traverse((o) => { if (o.isBone) this.bones[o.name] = o; });
    src.updateMatrixWorld(true);
    // rest frames: each bone's own rest rotation and its rotation in the cat's frame
    const inv = new THREE.Quaternion();
    this.rest = {};
    for (const [n, b] of Object.entries(this.bones)) {
      const W = b.getWorldQuaternion(new THREE.Quaternion());
      this.rest[n] = { q: b.quaternion.clone(), W, Wi: W.clone().invert(), p: b.position.clone() };
    }
    if (skin) {
      const shells = tier?.rich ? 18 : 12;
      this.fur = furredMesh(skin, { shells, length: 0.0135, density: 1500, rootDark: 0.55, clump: 0.12, sheen: 0.3 });
      skin.parent.add(this.fur); skin.visible = false;
      this.furLen = 0.0135;
    }
    // eyes: gold-green, slit pupils; lids over them while it sleeps
    const head = this.bones.head;
    if (head) {
      const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
      const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, '#d8c040'); gr.addColorStop(0.6, '#a8a83a'); gr.addColorStop(1, '#4a5a20');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64); g.fillStyle = '#050505'; g.beginPath(); g.ellipse(32, 32, 4, 22, 0, 0, Math.PI * 2); g.fill();
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
      const eyeM = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02 });
      const lidM = new THREE.MeshStandardMaterial({ color: 0x6a5a48, roughness: 0.9 });
      this.eyes = []; this.lids = [];
      head.updateMatrixWorld(true); const hInv = head.matrixWorld.clone().invert();
      for (const s of [1, -1]) {
        // (the sculpt's eye sockets, in the cat's frame: glTF of Blender (±0.021, -0.262, 0.258))
        const p = new THREE.Vector3(s * 0.021, 0.258, 0.257).applyMatrix4(src.matrixWorld).applyMatrix4(hInv);
        const e = new THREE.Mesh(new THREE.SphereGeometry(0.0088, 18, 12), eyeM); e.position.copy(p); e.rotation.y = s * 0.35; head.add(e); this.eyes.push(e);
        const l = new THREE.Mesh(new THREE.SphereGeometry(0.0096, 16, 10), lidM); l.position.copy(p); l.scale.set(1, 0.9, 0.75); head.add(l); this.lids.push(l);
      }
    }
    src.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.bed = bed; this.path = path || []; this.perch = perch;
    this.state = 'sleep'; this.t = 0; this.st = 0; this.seg = 0; this.segT = 0;
    this.group.position.copy(bed.pos); this.group.rotation.y = bed.yaw;
    this.pose = {}; this.blend = 0;
  }
  // a pose: { bone: [[axis, angle], ...] } in the cat's frame
  apply(P) {
    const D = new THREE.Quaternion(), r = new THREE.Quaternion();
    for (const [n, b] of Object.entries(this.bones)) {
      const R = this.rest[n]; if (!R) continue;
      D.identity();
      for (const [ax, a] of P[n] || []) { r.setFromAxisAngle(ax, a); D.premultiply(r); }
      b.quaternion.copy(R.q).multiply(R.Wi.clone().multiply(D).multiply(R.W));
    }
  }
  static mix(A, B, k) {
    const out = {};
    for (const n of new Set([...Object.keys(A), ...Object.keys(B)])) {
      const a = A[n] || [], b = B[n] || [];
      out[n] = [...a.map(([ax, v]) => [ax, v * (1 - k)]), ...b.map(([ax, v]) => [ax, v * k])];
    }
    return out;
  }
  sleepPose(t) {
    const br = Math.sin(t * Math.PI * 2 / 2.6) * 0.035, tw = Math.max(0, Math.sin(t * 0.9) - 0.96) * 12;
    const P = { pelvis: [[X, 0.55]], spine: [[X, 0.5]], chest: [[X, 0.42 + br]], neck: [[X, 0.55]], head: [[X, 0.5], [Z, 0.4]],
      earL: [[X, -0.25 + tw * 0.3]], earR: [[X, -0.25]] };
    for (const s of LEGS) {
      P['arm' + s] = [[X, 1.0]]; P['fore' + s] = [[X, -1.7]]; P['hand' + s] = [[X, 0.7]];
      P['thigh' + s] = [[X, -1.0]]; P['shin' + s] = [[X, 1.35]]; P['foot' + s] = [[X, -0.7]];
    }
    for (let i = 0; i < 5; i++) P['tail' + i] = [[X, -0.5 - (i === 4 ? Math.sin(t * 0.7) * 0.15 : 0)]];
    return P;
  }
  startlePose(k) {
    // the arched back, stiff legs on tiptoe, the tail straight up, the ears flat
    const P = { pelvis: [[X, -0.4 * k]], spine: [[X, 0.1 * k]], chest: [[X, 0.55 * k]], neck: [[X, 0.1 * k]], head: [[X, -0.35 * k], [Y, 0.5 * k]],
      earL: [[X, -1.0 * k]], earR: [[X, -1.0 * k]], tail0: [[X, 1.5 * k]] };
    for (let i = 1; i < 5; i++) P['tail' + i] = [[X, 0.08 * k]];
    return P;
  }
  runPose(p, k = 1) {
    // a bounding gallop: the back bunches and stretches, the forelegs reach as the hind legs drive
    const w = p * Math.PI * 2, s = Math.sin(w), c = Math.cos(w);
    const P = { pelvis: [[X, 0.16 * s * k]], spine: [[X, 0.09 * s * k]], chest: [[X, 0.14 * Math.sin(w + 0.4) * k]], neck: [[X, -0.25 * s * k]], head: [[X, -0.12 * s * k]],
      earL: [[X, -0.7 * k]], earR: [[X, -0.7 * k]], tail0: [[X, (0.35 + 0.15 * c) * k]] };
    for (let i = 1; i < 5; i++) P['tail' + i] = [[X, (-0.1 + 0.12 * Math.sin(w - i)) * k]];
    for (const [sd, ph] of [['L', 0], ['R', 0.25]]) {
      const f = w + ph, h = w + Math.PI + ph;
      P['arm' + sd] = [[X, -0.85 * Math.sin(f) * k]]; P['fore' + sd] = [[X, -0.9 * Math.max(0, Math.sin(f + 1.6)) * k]]; P['hand' + sd] = [[X, 0.5 * Math.max(0, Math.sin(f + 1.6)) * k]];
      P['thigh' + sd] = [[X, 0.8 * Math.sin(h) * k]]; P['shin' + sd] = [[X, 0.9 * Math.max(0, Math.sin(h + 1.6)) * k]]; P['foot' + sd] = [[X, -0.5 * Math.max(0, Math.sin(h + 1.6)) * k]];
    }
    return P;
  }
  leapPose(u) {
    // crouch, launch (stretched out), land (forelegs reaching)
    const crouch = Math.max(0, 1 - u / 0.2), air = Math.sin(Math.min(1, Math.max(0, (u - 0.15) / 0.75)) * Math.PI);
    const P = { pelvis: [[X, 0.3 * crouch - 0.25 * air]], chest: [[X, 0.2 * crouch - 0.1 * air]], neck: [[X, -0.3 * air]], earL: [[X, -0.6]], earR: [[X, -0.6]], tail0: [[X, 0.2]] };
    for (const s of LEGS) {
      P['arm' + s] = [[X, 0.6 * crouch - 1.1 * air]]; P['fore' + s] = [[X, -0.8 * crouch]];
      P['thigh' + s] = [[X, -0.9 * crouch + 0.9 * air]]; P['shin' + s] = [[X, 1.2 * crouch + 0.3 * air]]; P['foot' + s] = [[X, -0.6 * crouch + 0.4 * air]];
    }
    return P;
  }
  loafPose(t, look) {
    // lying with the paws tucked under, head up, watching
    const P = { head: [[Y, look], [X, -0.15]], neck: [[X, -0.2]], earL: [[X, -0.1 + Math.max(0, Math.sin(t * 1.3) - 0.9) * 4]], earR: [[X, -0.1]] };
    for (const s of LEGS) { P['arm' + s] = [[X, 1.3]]; P['fore' + s] = [[X, -2.3]]; P['hand' + s] = [[X, 1.0]]; P['thigh' + s] = [[X, -1.2]]; P['shin' + s] = [[X, 1.9]]; P['foot' + s] = [[X, -0.8]]; }
    for (let i = 0; i < 5; i++) P['tail' + i] = [[Y, i === 0 ? 0.9 : 0.35], [X, -0.15]];
    P.tail4 = [[Y, 0.35 + Math.sin(t * 3) * 0.3], [X, -0.1]];
    return P;
  }
  wake(from) {
    if (this.state !== 'sleep') return;
    this.state = 'startle'; this.st = 0;
    // side on to whatever woke it
    const away = this.group.position.clone().sub(from); away.y = 0;
    this.startYaw = Math.atan2(away.x, away.z) + Math.PI / 2;
    this.audio?.play('click', { pos: this.group.position, vol: 0.9, pitch: 0.5 });
  }
  update(dt, robot, G) {
    this.t += dt; this.st += dt;
    const pos = this.group.position, rp = robot?.pos;
    const near = rp ? Math.hypot(rp.x - pos.x, rp.z - pos.z) : 9;
    if (this.state === 'sleep') {
      this.body.rotation.set(0, 0, Math.PI / 2); this.body.position.set(0.19, 0.072, 0);
      this.apply(this.sleepPose(this.t));
      for (const l of this.lids) l.visible = true;
      if (rp && Math.abs(rp.y - pos.y) < 0.6 && (near < 0.5 || ((G?.noise || 0) > 1.0 && near < 2.5))) this.wake(rp);
      return;
    }
    for (const l of this.lids) l.visible = false;
    if (this.state === 'startle') {
      // up off its side in a fifth of a second, puffed up, holding the arch
      const k = Math.min(1, this.st / 0.2);
      this.body.rotation.set(0, 0, Math.PI / 2 * (1 - k)); this.body.position.set(0.19 * (1 - k), 0.072 * (1 - k) + 0.02 * k, 0);
      this.group.rotation.y = this.startYaw;
      this.apply(this.startlePose(k));
      if (this.fur) this.fur.userData.fur.uFurLen.value = this.furLen * (1 + 0.75 * k);
      if (this.st > 0.75) { this.state = 'flee'; this.seg = 0; this.segT = 0; this.phase = 0; }
      return;
    }
    if (this.fur) this.fur.userData.fur.uFurLen.value += (this.furLen * (this.state === 'flee' ? 1.4 : 1.0) - this.fur.userData.fur.uFurLen.value) * Math.min(1, dt * 1.5);
    this.body.rotation.set(0, 0, 0); this.body.position.set(0, 0, 0);
    if (this.state === 'flee') {
      const a = this.seg === 0 ? this.bed.pos : this.path[this.seg - 1], b = this.path[this.seg];
      if (!b) { this.state = 'perch'; return; }
      const d = Math.hypot(b.x - a.x, b.z - a.z), leap = b.leap;
      const speed = leap ? 1.6 : 2.6, dur = Math.max(0.25, d / speed);
      this.segT += dt; const u = Math.min(1, this.segT / dur);
      pos.lerpVectors(a, b, u);
      if (leap) pos.y = a.y + (b.y - a.y) * u + Math.sin(u * Math.PI) * (0.25 + Math.abs(b.y - a.y) * 0.4);
      const yaw = Math.atan2(b.x - a.x, b.z - a.z);
      let dy = yaw - this.group.rotation.y; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
      this.group.rotation.y += dy * Math.min(1, dt * 14);
      this.phase = (this.phase + dt * 4.2) % 1;
      if (leap) this.apply(this.leapPose(u));
      else {
        // the back bunches and stretches about its middle: the whole body pitches against it to stay level
        this.apply(this.runPose(this.phase)); pos.y += Math.max(0, Math.sin(this.phase * Math.PI * 2)) * 0.03;
        this.body.rotation.x = -0.2 * Math.sin(this.phase * Math.PI * 2); this.body.position.set(0, 0.0, 0);
      }
      if (Math.floor(this.phase * 2) !== this.lastStep) { this.lastStep = Math.floor(this.phase * 2); if (!leap) this.audio?.play('thud', { pos, vol: 0.25, pitch: 1.6 }); }
      // anything small in its way is bowled over
      if (rp && near < 0.32 && Math.abs(rp.y - pos.y) < 0.4 && !this.hitT) {
        this.hitT = 1.2; const dir = new THREE.Vector3(Math.sin(this.group.rotation.y), 0, Math.cos(this.group.rotation.y));
        robot.vel?.addScaledVector(dir, 3.2).add(new THREE.Vector3(0, 2.2, 0)); this.audio?.play('thud', { pos, vol: 0.9, pitch: 0.8 });
        if (G) G.camShake = 0.03;
      }
      if (u >= 1) { this.seg++; this.segT = 0; }
    }
    if (this.hitT) this.hitT = Math.max(0, this.hitT - dt);
    if (this.state === 'perch') {
      // on top of its tree: lying with its paws under it, watching the robot
      pos.copy(this.perch.pos);
      const want = rp ? Math.atan2(rp.x - pos.x, rp.z - pos.z) : this.perch.yaw;
      let dy = this.perch.yaw - this.group.rotation.y; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
      this.group.rotation.y += dy * Math.min(1, dt * 3);
      let look = want - this.group.rotation.y; while (look > Math.PI) look -= Math.PI * 2; while (look < -Math.PI) look += Math.PI * 2;
      this.body.position.y = -0.09;
      this.apply(this.loafPose(this.t, THREE.MathUtils.clamp(look, -1.1, 1.1)));
    }
  }
}
