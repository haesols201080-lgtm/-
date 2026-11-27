// The stranger (blender/build_person.py, animated by blender/animate_person.py): a grown man built from MakeHuman's
// CC0 body, skin, hair and clothes, rigged, with his clips. One model carries both outfits: 'out' (the field jacket,
// jeans and rubber boots he wears in the forest) and 'bed' (the T-shirt he sleeps in). He blinks; asleep, his eyes are
// shut. Positions of the clips are in his own frame (he faces his local +z, the ground or mattress at y = 0).
import * as THREE from 'three';

// (no cards on his face: his brows are painted into his skin, and he has no lash cards; an older model's are left
// hidden)
const OUTFIT = {
  out: /body_out|eyes|teeth|tongue|hair|outfit|boot/,
  bed: /body_bed|eyes|teeth|tongue|hair|sleepwear/,
};

export class Person {
  constructor(gltf, outfit = 'out') {
    this.root = gltf.scene; this.morphs = []; this.outfit = outfit;
    this.root.traverse((o) => {
      if (!o.isMesh) return;
      o.visible = OUTFIT[outfit].test(o.name); o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
      const m = o.material;
      // hair, brows and lashes are cards with their strands in the alpha: blended, double sided, a light cut-off
      if (/hair/.test(m.name)) { m.transparent = true; m.alphaTest = 0.08; m.depthWrite = true; m.side = THREE.DoubleSide; o.renderOrder = 2; }
      // the cornea: clear, so only its reflections show, added over the eye (the catchlights; nothing darkened)
      if (/cornea/.test(m.name)) { m.transparent = true; m.opacity = 1; m.alphaTest = 0; m.color.setRGB(0, 0, 0); m.roughness = 0.04; m.metalness = 0; m.blending = THREE.AdditiveBlending; m.depthWrite = false; m.envMapIntensity = 1.3; o.castShadow = false; o.renderOrder = 3; }
      // the eyeball: moist, not a mirror (the cornea gives the shine)
      if (m.name === 'eye') { m.roughness = 0.3; if ('clearcoat' in m) m.clearcoat = 0; o.castShadow = false; }
      if (o.morphTargetDictionary) this.morphs.push(o);
    });
    this.mixer = new THREE.AnimationMixer(this.root);
    this.clips = Object.fromEntries(gltf.animations.map((a) => [a.name, a]));
    this.actions = {}; this.current = null;
    this.blinkT = 2 + Math.random() * 3; this.blink = 0; this.eyesShut = 0;
  }
  bone(name) { return this.root.getObjectByName(name); }
  setMorph(name, v) { for (const o of this.morphs) { const i = o.morphTargetDictionary[name]; if (i !== undefined) o.morphTargetInfluences[i] = v; } }
  action(name) {
    if (!this.actions[name]) { const a = this.mixer.clipAction(this.clips[name]); this.actions[name] = a; }
    return this.actions[name];
  }
  // play a clip (crossfading from the one before); once-clips hold their last frame
  play(name, { loop = false, fade = 0.4, onDone } = {}) {
    const a = this.action(name); if (this.current === a) return a;
    a.reset(); a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity); a.clampWhenFinished = !loop; a.enabled = true; a.setEffectiveWeight(1);
    if (this.current && fade > 0) a.crossFadeFrom(this.current, fade, false); else if (this.current) this.current.stop();
    a.play(); this.current = a; this.onDone = onDone || null; this.doneName = name;
    return a;
  }
  // a cutscene drives the clip's time itself
  at(name, t) { const a = this.action(name); if (this.current !== a) { if (this.current) this.current.stop(); a.reset(); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; a.play(); this.current = a; } this.mixer.setTime(t); }
  update(dt, { eyesShut = 0, mixer = true } = {}) {
    if (mixer && this.current && dt > 0) {
      this.mixer.update(dt);
      if (this.onDone && !this.current.isRunning() && this.current.loop === THREE.LoopOnce) { const f = this.onDone; this.onDone = null; f(); }
    }
    // blinking (every few seconds, quick); eyes shut while asleep
    this.blinkT -= dt;
    if (this.blinkT <= 0) { this.blink = 1; this.blinkT = 2.5 + Math.random() * 4; }
    this.blink = Math.max(0, this.blink - dt * 7);
    this.eyesShut += (eyesShut - this.eyesShut) * Math.min(1, dt * 4);
    const b = Math.max(this.eyesShut, Math.sin(Math.min(1, this.blink) * Math.PI));
    this.setMorph('blink_L', b); this.setMorph('blink_R', b);
  }
}
