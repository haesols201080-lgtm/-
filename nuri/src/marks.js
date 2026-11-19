// Ground marks painted into the terrain itself: a world-space render target in a window that follows the player.
// Footprints (the robot's real boot sole), skids and drag marks are stamped into it; the terrain shader reads it to
// press the ground (normal), darken and wet it, so marks are lit and shaded exactly like the scanned ground.
import * as THREE from 'three';

export class GroundMarks {
  constructor(renderer, { N = 2048, size = 12 } = {}) {
    this.renderer = renderer; this.N = N; this.size = size; this.texel = size / N;
    const opt = { type: THREE.UnsignedByteType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, generateMipmaps: false };
    this.rt = [new THREE.WebGLRenderTarget(N, N, opt), new THREE.WebGLRenderTarget(N, N, opt)]; this.cur = 0;
    this.origin = new THREE.Vector2(-size / 2, -size / 2);
    const prev = renderer.getRenderTarget();
    for (const r of this.rt) { renderer.setRenderTarget(r); renderer.setClearColor(0x000000, 0); renderer.clear(); }
    renderer.setRenderTarget(prev);
    this.cam = new THREE.OrthographicCamera(0, 1, 1, 0, -1, 1);
    // scroll pass (copies the field when the window moves, with a very slow fade)
    this.scrollMat = new THREE.ShaderMaterial({
      uniforms: { tPrev: { value: null }, uShift: { value: new THREE.Vector2() }, uFade: { value: 1 }, uDry: { value: 1 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy * 2.0 - 1.0, 0.0, 1.0); }',
      fragmentShader: `uniform sampler2D tPrev; uniform vec2 uShift; uniform float uFade, uDry; varying vec2 vUv;
        void main(){ vec2 uv = vUv + uShift; vec4 c = (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) ? vec4(0.0) : texture2D(tPrev, uv);
          gl_FragColor = c * vec4(uFade, uDry, uFade, uFade); }`,
      depthTest: false, depthWrite: false,
    });
    const quadGeo = new THREE.PlaneGeometry(1, 1); quadGeo.translate(0.5, 0.5, 0);
    this.scrollQuad = new THREE.Mesh(quadGeo, this.scrollMat); this.scrollScene = new THREE.Scene(); this.scrollScene.add(this.scrollQuad);
    // stamp pass: oriented quads drawn with MAX blending
    this.stampScene = new THREE.Scene();
    this.stampMats = {};
    this.queue = [];
    this.uniforms = { tMarks: { value: this.rt[0].texture }, uMarkOrigin: { value: this.origin.clone() }, uMarkSize: { value: size }, uMarkTexel: { value: 1 / N } };
    this.fadeAcc = 0;
  }
  stampMaterial(tex) {
    if (this.stampMats[tex.uuid]) return this.stampMats[tex.uuid];
    const m = new THREE.ShaderMaterial({
      uniforms: { tMask: { value: tex }, uK: { value: new THREE.Vector4() } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      // mask texture: r = press depth, g = area, b = rim; uK = (strength, wet, rimK, 0)
      fragmentShader: `uniform sampler2D tMask; uniform vec4 uK; varying vec2 vUv;
        void main(){ vec4 m = texture2D(tMask, vUv); gl_FragColor = vec4(m.r * uK.x, m.g * uK.y, m.b * uK.z, m.g * uK.x); }`,
      transparent: true, depthTest: false, depthWrite: false,
      blending: THREE.CustomBlending, blendEquation: THREE.MaxEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    });
    this.stampMats[tex.uuid] = m; return m;
  }
  // world position, yaw, size in metres, mask texture, strength 0..1, wetness 0..1
  stamp(x, z, yaw, w, h, tex, strength, wet, rim = 1) { this.queue.push({ x, z, yaw, w, h, tex, strength, wet, rim }); }

  update(dt, center) {
    const r = this.renderer, prevRT = r.getRenderTarget(), prevAuto = r.autoClear;
    r.autoClear = false;
    // the window snaps to a coarse grid (re-copied only every ~half metre of travel, not every frame)
    const t = this.texel * 64, half = this.size / 2;
    const ox = Math.round((center.x - half) / t) * t, oz = Math.round((center.z - half) / t) * t;
    let sx = (ox - this.origin.x) / this.size, sz = (oz - this.origin.y) / this.size;
    this.fadeAcc += dt;
    const moved = sx !== 0 || sz !== 0;
    if (moved || this.fadeAcc > 3) {
      // pressed ground stays for minutes; the wet darkening of a print dries within about a minute
      const fade = Math.pow(0.998, this.fadeAcc), dry = Math.pow(0.97, this.fadeAcc); this.fadeAcc = 0;
      const far = Math.abs(sx) > 0.9 || Math.abs(sz) > 0.9; // teleport: start clean
      this.scrollMat.uniforms.tPrev.value = this.rt[this.cur].texture;
      this.scrollMat.uniforms.uShift.value.set(sx, sz);
      this.scrollMat.uniforms.uFade.value = far ? 0 : fade; this.scrollMat.uniforms.uDry.value = far ? 0 : dry;
      const next = 1 - this.cur; r.setRenderTarget(this.rt[next]); r.setClearColor(0x000000, 0); r.clear(); r.render(this.scrollScene, this.cam); this.cur = next;
      this.origin.set(ox, oz);
    }
    if (this.queue.length) {
      // stamps in window-local [0,1] coordinates (x -> u, z -> v)
      while (this.stampScene.children.length) this.stampScene.remove(this.stampScene.children[0]);
      for (const q of this.queue) {
        const m = this.stampMaterial(q.tex).clone(); m.uniforms.tMask.value = q.tex; m.uniforms.uK.value.set(q.strength, q.wet, q.rim, 0);
        const mesh = new THREE.Mesh(this._quad || (this._quad = new THREE.PlaneGeometry(1, 1)), m);
        mesh.position.set((q.x - this.origin.x) / this.size, (q.z - this.origin.y) / this.size, 0);
        mesh.scale.set(q.w / this.size, q.h / this.size, 1);
        // sole "forward" is texture -v; world forward (sin yaw, cos yaw) maps to (u, v)
        mesh.rotation.z = -q.yaw + Math.PI;
        this.stampScene.add(mesh);
      }
      r.setRenderTarget(this.rt[this.cur]); r.render(this.stampScene, this.cam);
      for (const c of this.stampScene.children) c.material.dispose();
      this.queue.length = 0;
    }
    r.setRenderTarget(prevRT); r.autoClear = prevAuto;
    this.uniforms.tMarks.value = this.rt[this.cur].texture;
    this.uniforms.uMarkOrigin.value.copy(this.origin);
  }
}
