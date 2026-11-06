// Opening sequence for a new game. A short mission briefing (why humanity
// is leaving Earth), then the expedition ship in orbit over Arke, the
// deorbit burn, entry belly-first through the thin atmosphere, the flip
// and landing burn over the real landing site, and the cargo elevator
// lowering the rover with the explorer aboard. Any key or the skip button
// ends it. Tone: mission log, not drama.
import * as THREE from 'three';
import { ShipRig, shipDescent, DESCENT_TIME, SHIP } from '../npc/craft.js';

const BRIEF = [
  ['2148', '지구 평균기온, 산업화 이전보다 3.9 °C 상승.'],
  ['', '해수면 1.2 m 상승. 저위도 곡창지대 붕괴. 연안 대도시 41곳 포기.'],
  ['', '국제 이주 기구, 지구 밖 거주지 확보 계획 「아르케」 승인.'],
  ['후보 행성 아르케', '중력 0.84 g · 기압 0.006 atm · 평균 −63 °C · 지하 얼음 매장 확인.'],
  ['임무', '선발 탐사대 착륙. 대기·물·생물권을 조성한 뒤 이주민을 받는다.'],
];
const T_BRIEF = 23, T_ORBIT = 33, T_ENTRY = 41, SPEED = 1.6;
const T_TOUCH = T_ENTRY + DESCENT_TIME / SPEED;            // ~62 s
const T_LIFT0 = T_TOUCH + 1.5, T_LIFT1 = T_LIFT0 + 8.5;   // elevator down
const T_DRIVE1 = T_LIFT1 + 5.5, T_END = T_DRIVE1 + 2.5;
const CAPTIONS = [
  [T_BRIEF + 0.5, 'T−02:14:08', '탐사선 아르케-1 · 궤도 고도 380 km'],
  [T_BRIEF + 4.5, 'T−02:13:40', '탈궤도 연소'],
  [T_ORBIT + 0.5, 'T−00:06:12', '대기권 진입 · 선체 표면 1,400 °C'],
  [T_ENTRY + 0.3, 'T−00:00:33', '고도 2,000 m · 강하 속도 90 m/s'],
  [T_ENTRY + 16 / SPEED, 'T−00:00:17', '엔진 3기 점화 · 자세 반전'],
  [T_ENTRY + 19.5 / SPEED, 'T−00:00:14', '착륙 연소'],
  [T_TOUCH, 'T+00:00:00', '접지 · 엔진 정지'],
  [T_LIFT0 + 1, 'T+00:04:30', '화물 승강기 하강 · 탐사 로버 하역'],
  [T_LIFT1 + 1.5, 'T+00:06:05', '선발 탐사 임무 개시'],
];
const ease = (k) => k * k * (3 - 2 * k);
const clamp01 = (x) => Math.max(0, Math.min(1, x));

// ------------------------------------------------------------------ space scene
const PLANET_V = /* glsl */`
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec3 vN; varying vec3 vW; varying vec3 vWN;
  void main() {
    vN = normalize(position);
    vWN = normalize(mat3(modelMatrix) * position);
    vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
    #include <logdepthbuf_vertex>
  }`;
const NOISE = /* glsl */`
  float h3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float n3(vec3 x) {
    vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 6; i++) { s += a * n3(p); p = p * 2.07 + 1.3; a *= 0.5; } return s; }`;
const PLANET_F = /* glsl */`
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform vec3 uSun;
  varying vec3 vN; varying vec3 vW; varying vec3 vWN;
  ${NOISE}
  void main() {
    #include <logdepthbuf_fragment>
    vec3 n = normalize(vN);
    float c = fbm(n * 3.2), d = fbm(n * 11.0 + 4.0), e = fbm(n * 38.0 + 9.0);
    vec3 rust = vec3(0.36, 0.12, 0.05), dark = vec3(0.12, 0.055, 0.035), dust = vec3(0.5, 0.26, 0.13);
    vec3 col = mix(rust, dark, smoothstep(0.45, 0.66, c));
    col = mix(col, dust, smoothstep(0.55, 0.8, d) * 0.6);
    col *= 0.82 + 0.36 * e;
    // basins and old craters as darker rings
    float cr = fbm(n * 7.0 + 2.0);
    col *= 1.0 - 0.25 * smoothstep(0.62, 0.7, cr) + 0.12 * smoothstep(0.7, 0.74, cr);
    // polar caps
    float cap = smoothstep(0.84, 0.9, abs(n.y) + (d - 0.5) * 0.08);
    col = mix(col, vec3(0.86, 0.85, 0.83), cap);
    float l = dot(normalize(vWN), uSun);
    float lit = smoothstep(-0.08, 0.35, l) * (0.35 + 0.65 * max(l, 0.0));
    gl_FragColor = vec4(col * lit * 1.35 + col * 0.004, 1.0);
  }`;
const ATMO_F = /* glsl */`
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform vec3 uSun; uniform vec3 uCam;
  varying vec3 vN; varying vec3 vW; varying vec3 vWN;
  void main() {
    #include <logdepthbuf_fragment>
    vec3 n = normalize(vWN), v = normalize(uCam - vW);
    float rim = pow(1.0 - abs(dot(n, v)), 4.0);
    float lit = smoothstep(-0.25, 0.4, dot(n, uSun));
    gl_FragColor = vec4(vec3(1.0, 0.6, 0.38) * rim * lit * 1.1, rim * lit);
  }`;

function buildSpace(engine) {
  const scene = new THREE.Scene();
  const ev = document.createElement('canvas'); ev.width = 256; ev.height = 128;
  const ex = ev.getContext('2d'), eg = ex.createLinearGradient(0, 0, 0, 128);
  eg.addColorStop(0, '#000000'); eg.addColorStop(0.48, '#05070a'); eg.addColorStop(0.53, '#3a2214'); eg.addColorStop(0.7, '#6e3c20'); eg.addColorStop(1, '#4a2614');
  ex.fillStyle = eg; ex.fillRect(0, 0, 256, 128);
  const sg2 = ex.createRadialGradient(40, 34, 0, 40, 34, 18); sg2.addColorStop(0, 'rgba(255,250,240,1)'); sg2.addColorStop(1, 'rgba(255,240,220,0)');
  ex.fillStyle = sg2; ex.fillRect(0, 0, 256, 128);
  const et = new THREE.CanvasTexture(ev); et.mapping = THREE.EquirectangularReflectionMapping; et.colorSpace = THREE.SRGBColorSpace;
  const pm = new THREE.PMREMGenerator(engine.renderer);
  scene.environment = pm.fromEquirectangular(et).texture;
  pm.dispose(); et.dispose();
  const PR = 3000;
  const sun = new THREE.Vector3(0.75, 0.45, -0.5).normalize();
  const planet = new THREE.Mesh(new THREE.SphereGeometry(PR, 160, 120), new THREE.ShaderMaterial({ uniforms: { uSun: { value: sun } }, vertexShader: PLANET_V, fragmentShader: PLANET_F }));
  const atmoU = { uSun: { value: sun }, uCam: { value: new THREE.Vector3() } };
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(PR * 1.018, 160, 120), new THREE.ShaderMaterial({ uniforms: atmoU, vertexShader: PLANET_V, fragmentShader: ATMO_F, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  // stars on a sphere that follows the camera
  const N = 5000, sp = new Float32Array(N * 3), sc = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u);
    sp.set([r * Math.cos(a) * 20000, u * 20000, r * Math.sin(a) * 20000], i * 3);
    const b = Math.pow(Math.random(), 3) * 2.2 + 0.15, t = Math.random();
    sc.set([b * (0.85 + 0.15 * t), b * 0.9, b * (1.05 - 0.2 * t)], i * 3);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  sg.setAttribute('color', new THREE.Float32BufferAttribute(sc, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, depthWrite: false }));
  stars.frustumCulled = false;
  // the sun: bright disc with a soft halo
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const cx = cv.getContext('2d'), gr = cx.createRadialGradient(64, 64, 2, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.08, 'rgba(255,250,235,1)'); gr.addColorStop(0.25, 'rgba(255,220,170,0.25)'); gr.addColorStop(1, 'rgba(255,200,150,0)');
  cx.fillStyle = gr; cx.fillRect(0, 0, 128, 128);
  const sunS = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), color: new THREE.Color(6, 5.6, 5), blending: THREE.AdditiveBlending, depthWrite: false }));
  sunS.scale.setScalar(2600);
  const light = new THREE.DirectionalLight(0xfff2e0, 4.2); light.position.copy(sun);
  const amb = new THREE.HemisphereLight(0x405060, 0x3a2216, 0.25);
  // poles on the z axis, so the orbit (in the xy plane) crosses the equator
  planet.rotation.x = Math.PI / 2;
  scene.add(planet, atmo, stars, sunS, light, amb);
  const rig = new ShipRig(scene);
  rig.group.visible = true;
  // in vacuum the exhaust is a faint core, no plume or shock diamonds
  for (const e of rig.flames.children) e.children.forEach((m, i) => { if (i > 0) m.visible = false; });
  // plasma sheath for the entry: hot glow wrapped round the windward side
  const plasma = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 24), new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uK: { value: 0 } },
    vertexShader: `#include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec3 vP; varying vec3 vNv; varying vec3 vV;
      void main() { vP = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz; vNv = normalize(normalMatrix * normal); gl_Position = projectionMatrix * mv;
      #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `#include <common>
      #include <logdepthbuf_pars_fragment>
      uniform float uT, uK; varying vec3 vP; varying vec3 vNv; varying vec3 vV;
      ${NOISE}
      void main() {
        #include <logdepthbuf_fragment>
        float rim = pow(1.0 - abs(dot(normalize(vNv), normalize(vV))), 3.0);
        float wind = smoothstep(0.1, -0.85, vP.z);
        float fl = fbm(vP * 3.0 + vec3(0.0, uT * 6.0, uT * 2.0));
        vec3 c = mix(vec3(1.0, 0.32, 0.16), vec3(1.0, 0.7, 0.5), fl) * (0.08 + rim * 1.5) * wind * (0.5 + 0.9 * fl);
        gl_FragColor = vec4(c * uK * 1.6, 1.0);
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  plasma.scale.set(6.4, 29, 5.6); plasma.position.set(0, 24, -2.6);
  rig.body.add(plasma);
  return { scene, planet, atmo, atmoU, stars, sunS, sun, rig, plasma, PR };
}

// ------------------------------------------------------------------ intro
export class Intro {
  constructor(game, onDone) {
    this.game = game; this.onDone = onDone; this.t = 0; this.done = false;
  }

  start() {
    const g = this.game, E = g.engine;
    this.space = buildSpace(E);
    this.fov = E.camera.fov;
    this.exp = g.expedition;
    this.site = this.exp.site; this.rot = this.exp.b.rot;
    this.from = this.rot + Math.PI * 0.62;
    g.hideTool = true;
    g.rover.cinematic = true;
    // overlay
    const el = this.el = document.createElement('div');
    el.id = 'intro';
    el.innerHTML = `<div class="lb top"></div><div class="lb bot"></div>
      <div class="brief"><div class="b-k"></div><div class="b-t"></div></div>
      <div class="cap"><span class="c-k"></span><span class="c-t"></span></div>
      <div class="fade"></div>
      <button class="skip">건너뛰기 <kbd>Space</kbd></button>`;
    document.getElementById('ui').appendChild(el);
    this.$ = (s) => el.querySelector(s);
    this.$('.skip').onclick = () => this.finish();
    this.onKey = (e) => { if (['Space', 'Escape', 'Enter'].includes(e.code)) { e.preventDefault(); this.finish(); } };
    window.addEventListener('keydown', this.onKey);
    this.briefI = -1; this.capI = -1;
    g.cinematic = this;
  }

  setBrief(i) {
    if (i === this.briefI) return;
    this.briefI = i;
    const b = this.$('.brief');
    b.classList.remove('on');
    if (i < 0 || i >= BRIEF.length) return;
    setTimeout(() => { if (this.briefI !== i || this.done) return; this.$('.b-k').textContent = BRIEF[i][0]; this.$('.b-t').textContent = BRIEF[i][1]; b.classList.add('on'); }, 260);
  }

  setCaption(i) {
    if (i === this.capI) return;
    this.capI = i;
    const c = this.$('.cap');
    c.classList.remove('on');
    if (i < 0) return;
    setTimeout(() => { if (this.capI !== i || this.done) return; this.$('.c-k').textContent = CAPTIONS[i][1]; this.$('.c-t').textContent = CAPTIONS[i][2]; c.classList.add('on'); }, 200);
  }

  update(dt, cam) {
    if (this.done) return;
    this.t += dt;
    const t = this.t, g = this.game, E = g.engine, S = this.space;
    // story cards over the stars, then captions
    this.setBrief(t < T_BRIEF ? Math.min(BRIEF.length - 1, Math.floor(t / (T_BRIEF / BRIEF.length))) : -1);
    let ci = -1; for (let i = 0; i < CAPTIONS.length; i++) if (t >= CAPTIONS[i][0]) ci = i;
    this.setCaption(ci);
    // fades at the cuts
    const cut = (a, w = 0.6) => 1 - clamp01(Math.abs(t - a) / w);
    this.$('.fade').style.opacity = Math.max(cut(T_ORBIT, 0.5), cut(T_ENTRY, 0.7), t > T_END - 1.2 ? (t - (T_END - 1.2)) / 1.2 : 0, t < 0.8 ? 1 - t / 0.8 : 0).toFixed(3);
    if (t < T_ENTRY) this.spaceShot(t, cam, S); else this.worldShot(t, cam);
    if (t >= T_END) this.finish();
  }

  spaceShot(t, cam, S) {
    const E = this.game.engine;
    E.spaceScene = S.scene;
    cam.fov = 38; cam.updateProjectionMatrix();
    const PR = S.PR;
    if (t < T_BRIEF) {
      // briefing: the planet small and far, the sun rising past its limb
      const k = t / T_BRIEF;
      cam.position.set(-9000 + k * 1200, 2600 - k * 600, 12500 - k * 2500);
      cam.lookAt(0, 0, 0);
      S.rig.group.visible = false;
    } else if (t < T_ORBIT) {
      // orbit: the ship belly-down over the day side, deorbit burn
      const k = (t - T_BRIEF) / (T_ORBIT - T_BRIEF), a = 0.25 + k * 0.03;
      const p = new THREE.Vector3(Math.sin(a), Math.cos(a), 0).multiplyScalar(PR + 330);
      S.rig.group.visible = true;
      const burn = t > T_BRIEF + 4.5 && t < T_BRIEF + 8.5 ? 1 : 0;
      S.rig.pose({ x: p.x, y: p.y - 20, z: p.z }, Math.PI / 2, 0, { pitch: -Math.PI / 2 + 0.05, thr: burn, engines: 3, vac: true }, t);
      S.rig.group.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -a));
      const ca = 2.2 + k * 0.7;
      const off = new THREE.Vector3(Math.cos(ca) * 95, 22 + k * 10, Math.sin(ca) * 95).applyAxisAngle(new THREE.Vector3(0, 0, 1), -a);
      cam.position.copy(p).add(off);
      cam.up.set(Math.sin(a), Math.cos(a), 0);
      cam.lookAt(p.clone().add(new THREE.Vector3(0, -12, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), -a)));
    } else {
      // entry: belly-first into the upper atmosphere wrapped in plasma
      const k = (t - T_ORBIT) / (T_ENTRY - T_ORBIT), a = 0.32 + k * 0.05, h = 210 - k * 150;
      const p = new THREE.Vector3(Math.sin(a), Math.cos(a), 0).multiplyScalar(PR + h);
      S.rig.pose({ x: p.x, y: p.y - 20, z: p.z }, Math.PI / 2, 0, { pitch: -1.42 }, t);
      S.rig.group.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -a - 0.35));
      S.plasma.material.uniforms.uK.value = Math.min(1, k * 2.5);
      S.plasma.material.uniforms.uT.value = t;
      const shake = new THREE.Vector3(Math.sin(t * 37), Math.sin(t * 29), Math.sin(t * 43)).multiplyScalar(0.35 * k);
      const off = new THREE.Vector3(-62, 30, 58).applyAxisAngle(new THREE.Vector3(0, 0, 1), -a);
      cam.position.copy(p).add(off).add(shake);
      cam.up.set(Math.sin(a), Math.cos(a), 0);
      cam.lookAt(p);
    }
    S.stars.position.copy(cam.position);
    S.sunS.position.copy(cam.position).addScaledVector(S.sun, 18000);
    S.atmoU.uCam.value.copy(cam.position);
  }

  worldShot(t, cam) {
    const g = this.game, E = g.engine, rig = this.exp.rig, site = this.site, rot = this.rot, T = g.terrain;
    if (E.spaceScene) { E.spaceScene = null; cam.up.set(0, 1, 0); cam.fov = 50; cam.updateProjectionMatrix(); this.space.rig.group.visible = false; }
    const W = (lx, lz) => ShipRig.toWorld(site, rot, lx, lz);
    if (t < T_TOUCH) {
      const ts = (t - T_ENTRY) * SPEED, p = shipDescent(ts);
      rig.pose(site, rot, this.from, p, ts, 0);
      if (!this.lit && p.thr > 0) { this.lit = true; g.audio && g.audio.play('shuttle'); }
      const sp = rig.group.position;
      if (ts < 13) {
        // chase the falling ship, high above the plain
        const d = new THREE.Vector3(Math.sin(this.from), 0, Math.cos(this.from));
        const side = new THREE.Vector3(d.z, 0, -d.x);
        cam.position.copy(sp).addScaledVector(d, 70).addScaledVector(side, 55).add(new THREE.Vector3(0, 18, 0));
        if (cam.fov !== 50) { cam.fov = 50; cam.updateProjectionMatrix(); }
        cam.lookAt(sp);
      } else if (ts < 21) {
        // from the ground, long lens: the flip against the sky
        const [x, z] = W(-150, 210);
        cam.position.set(x, T.height(x, z) + 2.2, z);
        cam.fov = 16; cam.updateProjectionMatrix();
        cam.lookAt(sp.x, sp.y - 4, sp.z);
      } else {
        // landing burn and touchdown, low and close
        const [x, z] = W(-70, 95);
        cam.position.set(x, T.height(x, z) + 1.8, z);
        cam.fov = 14 + 28 * ease(clamp01((ts - 21) / 11)); cam.updateProjectionMatrix();
        cam.lookAt(sp.x, Math.max(site.y + 14, sp.y - 6), sp.z);
      }
      g.rover.group.visible = false;
    } else {
      // unload: elevator down with the rover aboard, then it drives off
      if (cam.fov !== 50) { cam.fov = 50; cam.updateProjectionMatrix(); }
      const elev = ease(clamp01((t - T_LIFT0) / (T_LIFT1 - T_LIFT0)));
      rig.pose(site, rot, this.from, { elev }, t, 0);
      const R = g.rover;
      R.group.visible = true;
      const path = this.exp.roverPath();
      if (t < T_LIFT1 + 0.6) {
        const [x, z] = W(0, SHIP.R + SHIP.lift);
        R.pos.set(x, site.y + rig.platY + 0.22, z);
        R.yaw = Math.atan2(-Math.cos(rot), Math.sin(rot));
        R.group.position.copy(R.pos);
        R.group.rotation.set(0, R.yaw, 0, 'YXZ');
      } else {
        const k = ease(clamp01((t - T_LIFT1 - 0.6) / (T_DRIVE1 - T_LIFT1 - 0.6)));
        const p = path.getPointAt(k), d = path.getTangentAt(Math.min(0.999, k));
        R.pos.set(p.x, Math.max(T.height(p.x, p.z), g.colliders.groundAt(p.x, p.z, 1.2, site.y + 1)), p.z);
        R.yaw = Math.atan2(-d.x, -d.z);
        R.speed = 4;
        R.updateMesh(1 / 60);
      }
      const [cx, cz] = W(16, 30);
      const tgt = new THREE.Vector3().lerpVectors(new THREE.Vector3(...[W(0, 7)[0], site.y + Math.max(2, rig.platY + 2), W(0, 7)[1]]), R.pos.clone().add(new THREE.Vector3(0, 1.5, 0)), clamp01((t - T_LIFT1) / 3));
      cam.position.set(cx, Math.max(T.height(cx, cz) + 2, site.y + 3 + Math.max(0, rig.platY * 0.35)), cz);
      cam.lookAt(tgt);
    }
  }

  finish() {
    if (this.done) return;
    this.done = true;
    const g = this.game, E = g.engine, cam = E.camera;
    E.spaceScene = null;
    cam.up.set(0, 1, 0); cam.fov = this.fov; cam.updateProjectionMatrix();
    window.removeEventListener('keydown', this.onKey);
    this.el.remove();
    if (this.space) {
      for (const k of ['planet', 'atmo', 'stars', 'plasma']) { this.space[k].geometry.dispose(); this.space[k].material.dispose(); }
      this.space = null;
    }
    // the world as the game starts: ship landed, elevator down, rover parked
    this.exp.rig.pose(this.site, this.rot, 0, { elev: 1 });
    this.exp.parkRover();
    g.rover.cinematic = false;
    g.rover.group.visible = true;
    g.hideTool = false;
    g.cinematic = null;
    this.onDone && this.onDone();
  }
}
