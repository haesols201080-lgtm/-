// People: skinned Rocketbox avatars with crossfaded clips, walking along
// paths or to targets, turning their heads, crowds that follow the hour,
// Thought Police patrols. The Two Minutes Hate gets its own procedural
// layer on top of the clips: fists shaking at the screen, bodies lunging,
// heads thrown forward (the novel: "a hideous ecstasy of fear and
// vindictiveness ... a grimacing, screaming lunatic").
import * as THREE from 'three';

const WALK_SPEED = 1.35;
const RUN_SPEED = 3.4;
const tmp = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();

let uid = 0;

class NPC {
  constructor(G, o) {
    this.G = G;
    this.id = o.id || 'npc' + (++uid);
    this.model = o.model;
    this.location = o.location;
    this.name = o.name || '';
    this.root = G.assets.instance(o.model);
    G.mats.apply(this.root, { cast: true, receive: true });
    this.root.traverse((m) => { if (m.isSkinnedMesh) m.frustumCulled = false; });
    this.pos = this.root.position;
    this.pos.set(o.x, 0, o.z);
    this.yaw = o.yaw ?? 0;
    this.root.rotation.y = this.yaw;
    this.mixer = new THREE.AnimationMixer(this.root);
    this.clips = {};
    for (const c of G.assets.animations(o.model)) this.clips[c.name] = c;
    this.actions = {};
    this.current = null;
    this.bones = {};
    this.root.traverse((b) => { if (b.isBone) this.bones[b.name] = b; });
    this.head = this.bones.head; this.neck = this.bones.neck; this.chest = this.bones.chest;
    this.arms = {
      L: [this.bones.Bip01_L_UpperArm, this.bones.Bip01_L_Forearm, this.bones.Bip01_L_Hand],
      R: [this.bones.Bip01_R_UpperArm, this.bones.Bip01_R_Forearm, this.bones.Bip01_R_Hand],
    };
    this.look = null;
    this.headYaw = 0; this.headPitch = 0;
    this.path = null; this.pathI = 0; this.loop = false;
    this.target = null; this.resolveWalk = null;
    this.speed = 0;
    this.speedMul = 0.92 + Math.random() * 0.16;
    this.run = false;
    this.hate = 0;              // 0..1 intensity of the Hate layer
    this.hatePhase = Math.random() * 10;
    this.idleVar = Math.random() * 100;
    this.setAnim(o.anim || 'idle', 0);
    this.mixer.update(Math.random() * 5);
    const loc = G.locations.get(o.location);
    (loc ? loc.root : G.scene).add(this.root);
    this.ground = loc && loc.ground ? loc.ground : () => 0;
    this.radius = 0.28;
    this.visible = true;
    this.frozen = false;
  }

  setAnim(name, fade = 0.35) {
    if (!this.clips[name]) name = name === 'run' ? 'walk' : 'idle';
    if (this.current === name) return;
    const a = this.actions[name] || (this.actions[name] = this.mixer.clipAction(this.clips[name]));
    a.reset().setEffectiveWeight(1).play();
    if (name === 'walk' || name === 'run') a.time = Math.random() * a.getClip().duration;
    const prev = this.current && this.actions[this.current];
    if (prev && fade > 0) a.crossFadeFrom(prev, fade, true);
    else if (prev) prev.stop();
    this.current = name;
  }

  face(x, z) { this.yaw = Math.atan2(x - this.pos.x, z - this.pos.z); }

  lookAt(v) { this.look = v; }

  walkTo(x, z, o = {}) {
    this.path = null;
    this.target = new THREE.Vector3(x, 0, z);
    this.run = !!o.run;
    return new Promise((res) => { this.resolveWalk = res; });
  }

  followPath(points, o = {}) {
    this.path = points; this.pathI = o.start ?? 0; this.loop = o.loop ?? true; this.run = !!o.run;
    this.target = points[this.pathI].clone();
    return new Promise((res) => { this.resolveWalk = res; });
  }

  stop() {
    this.target = null; this.path = null;
    if (this.resolveWalk) { const r = this.resolveWalk; this.resolveWalk = null; r(); }
  }

  say(text, sec = 3) { if (this.G.ui && this.G.ui.bubble) this.G.ui.bubble(this, text, sec); }

  remove() {
    if (this.root.parent) this.root.parent.remove(this.root);
    this.G.npcs.list.delete(this);
  }

  update(dt, camPos) {
    const G = this.G;
    const here = G.state.location === this.location;
    const d = here ? Math.hypot(camPos.x - this.pos.x, camPos.z - this.pos.z) : 1e9;
    this.root.visible = here && d < 140 && this.visible;
    if (!this.root.visible) {
      // walkers keep walking off screen so crowds do not freeze in place
      if (this.target && here) this.move(dt * 1, false);
      return;
    }
    if (this.target) this.move(dt, true);
    else if (this.current === 'walk' || this.current === 'run') this.setAnim('idle');
    // turn smoothly toward the heading
    let dy = this.yaw - this.root.rotation.y;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.root.rotation.y += dy * Math.min(1, dt * 6);
    this.pos.y = this.ground(this.pos.x, this.pos.z);
    // skip animation work far away
    if (d < 60 || this.hate > 0) this.mixer.update(dt * (this.current === 'walk' ? this.speedMul : 1));
    else this.mixer.update(dt);
    if (d < 45 && (this.current === 'idle' || this.current === 'talk' || this.current === 'look')) this.idleLayer();
    this.root.updateMatrixWorld(true);
    this.headLook(dt);
    if (this.hate > 0.01) this.hateLayer(dt);
  }

  move(dt, animate) {
    const t = this.target;
    tmp.set(t.x - this.pos.x, 0, t.z - this.pos.z);
    const dist = tmp.length();
    const sp = (this.run ? RUN_SPEED : WALK_SPEED) * this.speedMul;
    if (dist < 0.35) {
      if (this.path) {
        this.pathI++;
        if (this.pathI >= this.path.length) {
          if (this.loop) this.pathI = 0;
          else { this.stop(); return; }
        }
        this.target = this.path[this.pathI].clone();
        // spread people across the pavement
        this.target.x += (Math.random() - 0.5) * 1.6; this.target.z += (Math.random() - 0.5) * 1.6;
        return;
      }
      this.target = null;
      if (this.resolveWalk) { const r = this.resolveWalk; this.resolveWalk = null; r(); }
      return;
    }
    if (animate) this.setAnim(this.run ? 'run' : 'walk');
    this.yaw = Math.atan2(tmp.x, tmp.z);
    const step = Math.min(dist, sp * dt);
    this.pos.x += tmp.x / dist * step;
    this.pos.z += tmp.z / dist * step;
    // keep out of walls and of the player
    const p = { x: this.pos.x, z: this.pos.z };
    this.G.col.resolve(p, this.radius, 0, 1.7);
    const pl = this.G.player.pos;
    const px = p.x - pl.x, pz = p.z - pl.z, pd = Math.hypot(px, pz);
    if (pd < 0.6 && pd > 1e-4) { p.x = pl.x + px / pd * 0.6; p.z = pl.z + pz / pd * 0.6; }
    this.pos.x = p.x; this.pos.z = p.z;
  }

  idleLayer() {
    const t = this.G.time + this.idleVar;
    const talk = this.current === 'talk' ? 1 : 0;
    const b = this.bones;
    const add = (bone, x, y, z) => { if (!bone) return; tmpE.set(x, y, z); tmpQ.setFromEuler(tmpE); bone.quaternion.multiply(tmpQ); };
    add(this.chest, Math.sin(t * 1.7) * 0.02, Math.sin(t * 0.31) * 0.07, Math.sin(t * 0.23) * 0.02);
    add(b.hips || b.Bip01_Pelvis, 0, Math.sin(t * 0.21) * 0.04, Math.sin(t * 0.19 + 1) * 0.035);
    const [lu, lf] = this.arms.L, [ru, rf] = this.arms.R;
    add(lu, Math.sin(t * 0.7) * 0.04, 0, Math.sin(t * 0.5) * 0.03);
    add(ru, Math.sin(t * 0.6 + 2) * 0.04, 0, Math.sin(t * 0.45 + 1) * 0.03);
    if (talk) {
      add(rf, 0, 0, -0.25 - Math.max(0, Math.sin(t * 2.3)) * 0.45);
      add(ru, -0.15 - Math.max(0, Math.sin(t * 2.3 + 0.4)) * 0.25, 0, 0);
      add(lf, 0, 0, Math.max(0, Math.sin(t * 1.7 + 1.3)) * 0.3);
    }
  }

  headLook(dt) {
    if (!this.head) return;
    let ty = 0, tp = 0;
    const G = this.G;
    const target = this.look === 'player' ? G.camera.position : this.look;
    if (target) {
      this.head.getWorldPosition(tmp);
      const dx = target.x - tmp.x, dy = target.y - tmp.y, dz = target.z - tmp.z;
      const yawTo = Math.atan2(dx, dz);
      ty = Math.atan2(Math.sin(yawTo - this.root.rotation.y), Math.cos(yawTo - this.root.rotation.y));
      ty = Math.max(-1.1, Math.min(1.1, ty));
      tp = Math.max(-0.5, Math.min(0.5, Math.atan2(dy, Math.hypot(dx, dz))));
    }
    this.headYaw += (ty - this.headYaw) * Math.min(1, dt * 5);
    this.headPitch += (tp - this.headPitch) * Math.min(1, dt * 5);
    if (Math.abs(this.headYaw) < 0.01 && Math.abs(this.headPitch) < 0.01) return;
    // rotate the head in world space about the vertical, then pitch
    this.addWorldRotation(this.neck, new THREE.Vector3(0, 1, 0), this.headYaw * 0.4);
    this.addWorldRotation(this.head, new THREE.Vector3(0, 1, 0), this.headYaw * 0.6);
    const right = new THREE.Vector3(Math.cos(this.root.rotation.y + this.headYaw), 0, -Math.sin(this.root.rotation.y + this.headYaw));
    this.addWorldRotation(this.head, right, -this.headPitch);
  }

  addWorldRotation(bone, axis, angle) {
    if (!bone || !bone.parent) return;
    bone.parent.getWorldQuaternion(tmpQ);
    const local = axis.clone().applyQuaternion(tmpQ.clone().invert());
    bone.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(local, angle));
    bone.updateMatrixWorld(true);
  }

  // The Hate: on top of the angry idle, an arm swings up into a shaking
  // fist, the body lunges at the screen, the head juts forward.
  hateLayer(dt) {
    this.hatePhase += dt * (5 + this.hate * 4);
    const k = this.hate;
    const ph = this.hatePhase;
    const f = this.root.rotation.y;
    const fwd = new THREE.Vector3(Math.sin(f), 0, Math.cos(f));
    const right = new THREE.Vector3(Math.cos(f), 0, -Math.sin(f));
    const lunge = Math.max(0, Math.sin(ph * 0.5)) * 0.35 * k;
    this.addWorldRotation(this.chest, right, lunge);
    this.addWorldRotation(this.head, right, 0.25 * k + Math.sin(ph * 2.1) * 0.08 * k);
    const pump = 0.5 + 0.5 * Math.sin(ph * 1.7);
    for (const [side, sgn] of [['R', 1], ['L', -1]]) {
      const [up, fore] = this.arms[side];
      if (!up) continue;
      const raise = side === 'R' ? k : k * (0.4 + 0.6 * Math.max(0, Math.sin(ph * 0.35 + 1.3)));
      // swing the upper arm forward and up toward the screen
      this.addWorldRotation(up, right, -(1.9 + 0.35 * pump) * raise);
      this.addWorldRotation(up, fwd, sgn * 0.25 * raise);
      this.addWorldRotation(fore, right, -(0.6 + 0.6 * pump) * raise);
    }
  }
}

export function setupNPCs(G) {
  const list = new Set();
  const crowds = [];
  const npcs = {
    list,
    spawn(o) {
      try {
        const n = new NPC(G, o);
        list.add(n);
        return n;
      } catch (e) { console.warn('[npc] spawn failed', o.model, e.message); return null; }
    },
    get(id) { for (const n of list) if (n.id === id) return n; return null; },
    removeAll(location) { for (const n of [...list]) if (!location || n.location === location) n.remove(); },
    // Ambient walkers along G.world.paths; density 0..1 shows a share of them.
    crowd(location, o) {
      const models = o.models || ['char_party_man', 'char_party_man_b', 'char_party_woman', 'char_syme', 'char_parsons', 'char_winston'];
      const out = [];
      const paths = (o.paths || []).map((p) => (Array.isArray(p) ? p : G.world && G.world.paths[p])).filter(Boolean);
      for (let i = 0; i < (o.count || 20); i++) {
        const path = paths[i % paths.length];
        if (!path) break;
        const start = Math.floor(Math.random() * path.length);
        const p0 = path[start];
        const n = npcs.spawn({ model: models[i % models.length], location, x: p0.x + (Math.random() - 0.5) * 2, z: p0.z + (Math.random() - 0.5) * 2, anim: 'walk' });
        if (!n) continue;
        // half walk the path backwards so people pass each other
        const pts = i % 2 ? [...path].reverse() : path;
        n.followPath(pts, { start: i % 2 ? pts.length - 1 - start : start, loop: true });
        n.crowd = true;
        out.push(n);
      }
      const c = { location, list: out, density: 1 };
      crowds.push(c);
      return c;
    },
    setCrowdDensity(location, d) {
      for (const c of crowds) {
        if (c.location !== location) continue;
        c.density = d;
        c.list.forEach((n, i) => { n.visible = i / c.list.length < d; });
      }
    },
    patrol(o) {
      const s0 = Math.min(o.path.length - 1, o.start || 0);
      const n = npcs.spawn({ model: o.model || 'char_thought_police', location: o.location, x: o.path[s0].x + (o.dx || 0), z: o.path[s0].z + (o.dz || 0), id: o.id, anim: 'walk' });
      if (!n) return null;
      n.followPath(o.path, { loop: true, start: s0 });
      n.patrol = true;
      n.viewCone = { fov: 110, range: 22 };
      n.investigate = (pos) => {
        n.saved = n.saved || { path: o.path };
        return n.walkTo(pos.x, pos.z).then(() => n.followPath(o.path, { loop: true }));
      };
      return n;
    },
    // set the Hate intensity for every NPC in a location
    setHate(location, k) { for (const n of list) if (n.location === location) n.hate = k; },
  };
  G.npcs = npcs;
  G.onUpdate((dt) => {
    const cam = G.camera.position;
    for (const n of list) n.update(dt, cam);
  });
  return npcs;
}
