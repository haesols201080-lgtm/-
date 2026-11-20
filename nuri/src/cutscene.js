// In-engine cutscenes: letterbox bars, the HUD and touch controls tucked away, a camera that runs through shots
// (dolly / crane / orbit moves between eased keyframes, aimed at actors that may be moving), cuts driven by
// dialogue lines, a skip button. While a cutscene runs the orbit camera and the player's controls are suspended.
import * as THREE from 'three';

const ease = (t) => t * t * (3 - 2 * t);
const v3 = (a) => (a.isVector3 ? a.clone() : new THREE.Vector3(a[0], a[1], a[2]));

export class Director {
  constructor({ camera, ui }) {
    this.cam = camera; this.ui = ui;
    this.active = null; this.shot = null;
    this.bars = document.getElementById('letterbox'); this.skipBtn = document.getElementById('cs-skip');
    const skip = (e) => { e.preventDefault(); e.stopPropagation(); this.skip(); };
    this.skipBtn.addEventListener('click', skip); this.skipBtn.addEventListener('touchstart', skip, { passive: false });
    this.look = new THREE.Vector3();
  }
  // shots: [{ dur, from, to, lookFrom, lookTo, fov, hold }] — positions are Vector3/arrays or functions returning them
  // (evaluated when the shot starts). A shot with dur: Infinity waits until next() is called (dialogue-driven).
  play(shots, { onDone, onSkip } = {}) {
    if (this.active) this.finish(true);
    this.active = { shots, i: -1, onDone, onSkip, fov0: this.cam.fov };
    document.body.classList.add('cutscene');
    this.bars.classList.add('on');
    this.next();
  }
  resolve(x) { return v3(typeof x === 'function' ? x() : x); }
  next() {
    const A = this.active; if (!A) return;
    A.i++;
    if (A.i >= A.shots.length) { this.finish(false); return; }
    const s = A.shots[A.i];
    s.onStart?.();
    this.shot = { s, t: 0, from: this.resolve(s.from), to: this.resolve(s.to ?? s.from), lf: this.resolve(s.lookFrom), lt: this.resolve(s.lookTo ?? s.lookFrom) };
  }
  // jump straight to a given shot list entry (dialogue cuts)
  cut(shot) { const A = this.active; if (!A) return; A.shots.splice(A.i + 1, 0, shot); this.next(); }
  skip() { if (!this.active) return; const A = this.active; this.finish(true); A.onSkip?.(); }
  finish(skipped) {
    const A = this.active; if (!A) return;
    this.active = null; this.shot = null;
    document.body.classList.remove('cutscene'); this.bars.classList.remove('on');
    this.cam.fov = A.fov0; this.cam.updateProjectionMatrix();
    if (!skipped) A.onDone?.(); else A.onDone?.(true);
  }
  update(dt) {
    const S = this.shot; if (!S) return false;
    S.t += dt;
    const s = S.s, k = s.dur === Infinity ? Math.min(1, S.t / (s.ease || 4)) : Math.min(1, S.t / s.dur), e = ease(k);
    // follow moving targets: re-resolve the look point every frame when given as a function
    const lf = typeof s.lookFrom === 'function' && s.track ? this.resolve(s.lookFrom) : S.lf;
    const lt = typeof (s.lookTo ?? s.lookFrom) === 'function' && s.track ? this.resolve(s.lookTo ?? s.lookFrom) : S.lt;
    if (s.orbit) {
      // circle a centre point: from/to give start/end angle via their offsets
      const c = lt, a0 = Math.atan2(S.from.z - c.z, S.from.x - c.x), a1 = a0 + s.orbit, r = Math.hypot(S.from.x - c.x, S.from.z - c.z);
      const a = a0 + (a1 - a0) * e;
      this.cam.position.set(c.x + Math.cos(a) * r, S.from.y + (S.to.y - S.from.y) * e, c.z + Math.sin(a) * r);
    } else this.cam.position.lerpVectors(S.from, S.to, e);
    this.look.lerpVectors(lf, lt, e);
    this.cam.lookAt(this.look);
    if (s.fov) { this.cam.fov = this.cam.fov + (s.fov - this.cam.fov) * Math.min(1, dt * 3); this.cam.updateProjectionMatrix(); }
    if (s.dur !== Infinity && S.t >= s.dur) this.next();
    return true;
  }
}
