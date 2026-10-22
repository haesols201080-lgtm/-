// 아스테리아 1부 — 그래픽: 렌더러, 하늘, 빛, 후처리, 재질, 물, 풀, 입자, 마법 효과
'use strict';

const GFX = { pool: [], labels: [], t: 0 };
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const COL = c => new THREE.Color(c);

function initGfx() {
  const isTouch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  GFX.mobile = isTouch;
  const canvas = document.getElementById('gl');
  const r = new THREE.WebGLRenderer({ canvas, antialias: !isTouch, powerPreference: 'high-performance' });
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, isTouch ? 1.25 : 1.6));
  r.shadowMap.enabled = true;
  r.shadowMap.type = isTouch ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
  r.outputEncoding = THREE.sRGBEncoding;
  GFX.renderer = r;
  GFX.webgl2 = r.capabilities.isWebGL2;
  const scene = new THREE.Scene();
  GFX.scene = scene;
  GFX.camera = new THREE.PerspectiveCamera(58, 1, 0.1, 1400);
  scene.fog = new THREE.FogExp2(0xbfe3f5, 0.006);

  // 하늘
  GFX.skyU = {
    top: { value: COL(0x3a7bd5) }, horizon: { value: COL(0xbfe3f5) }, bottom: { value: COL(0x6a7a8a) },
    sunDir: { value: V3(0.3, 0.8, 0.2).normalize() }, sunCol: { value: COL(0xfff2d0) }, stars: { value: 0 }, aurora: { value: 0 }, t: { value: 0 },
  };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), new THREE.ShaderMaterial({
    uniforms: GFX.skyU, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.); gl_Position = p.xyww; }',
    fragmentShader: `uniform vec3 top, horizon, bottom, sunDir, sunCol; uniform float stars, aurora, t; varying vec3 vDir;
      float h3(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719)))*43758.5453); }
      void main(){ vec3 d = normalize(vDir); float h = d.y;
        vec3 c = mix(horizon, top, smoothstep(0.0, 0.55, h)); c = mix(c, bottom, smoothstep(0.0, -0.25, h));
        float s = max(dot(d, sunDir), 0.); c += sunCol * (pow(s, 900.) * 12. + pow(s, 10.) * 0.35);
        vec3 p = floor(d * 380.); float n = h3(p);
        c += vec3(step(0.9982, n)) * stars * smoothstep(0.02, 0.25, h) * (0.6 + 0.4 * sin(t * 2.5 + n * 60.));
        if (aurora > 0.0) { float w = sin(d.x * 5. + t * 0.25 + sin(d.z * 3. + t * 0.2) * 2.) * 0.5 + 0.5; float band = smoothstep(0.12, 0.3, h) * smoothstep(0.75, 0.35, h);
          c += mix(vec3(0.1, 1.0, 0.6), vec3(0.6, 0.3, 1.0), w) * w * band * aurora * (0.6 + 0.4 * sin(d.z * 14. + t)); }
        gl_FragColor = vec4(c, 1.); }`,
  }));
  sky.renderOrder = -10; sky.frustumCulled = false;
  GFX.sky = sky; scene.add(sky);

  // 빛
  GFX.hemi = new THREE.HemisphereLight(0xcfe8ff, 0x5a6a3a, 0.75); scene.add(GFX.hemi);
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.2);
  sun.castShadow = true;
  const S = isTouch ? 1024 : 2048;
  sun.shadow.mapSize.set(S, S);
  const sc = sun.shadow.camera; sc.left = -36; sc.right = 36; sc.top = 36; sc.bottom = -36; sc.near = 1; sc.far = 220;
  sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.04;
  scene.add(sun); scene.add(sun.target);
  GFX.sun = sun;
  GFX.amb = new THREE.AmbientLight(0x404060, 0); scene.add(GFX.amb);
  for (let i = 0; i < 8; i++) { const p = new THREE.PointLight(0xffc880, 0, 14, 2); scene.add(p); GFX.pool.push(p); }
  GFX.rodLight = new THREE.PointLight(0x9ff4ff, 0, 9, 2); scene.add(GFX.rodLight);

  // 후처리 (데스크톱): HDR → 번짐 → 톤 매핑
  if (!isTouch && GFX.webgl2 && THREE.EffectComposer) {
    const rt = new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType });
    const comp = new THREE.EffectComposer(r, rt);
    comp.addPass(new THREE.RenderPass(scene, GFX.camera));
    GFX.bloom = new THREE.UnrealBloomPass(new THREE.Vector2(256, 256), 0.85, 0.55, 0.82);
    comp.addPass(GFX.bloom);
    GFX.finalU = { tDiffuse: { value: null }, exposure: { value: 1.0 }, vig: { value: 0.55 }, sat: { value: 1.08 }, tint: { value: COL(0xffffff) } };
    const fin = new THREE.ShaderPass(new THREE.ShaderMaterial({
      uniforms: GFX.finalU,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
      fragmentShader: `uniform sampler2D tDiffuse; uniform float exposure, vig, sat; uniform vec3 tint; varying vec2 vUv;
        vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0., 1.); }
        void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb * exposure; c = aces(c);
          float l = dot(c, vec3(0.299,0.587,0.114)); c = mix(vec3(l), c, sat) * tint;
          vec2 q = vUv - 0.5; c *= 1.0 - vig * dot(q, q) * 1.5;
          gl_FragColor = vec4(pow(max(c, 0.), vec3(1.0/2.2)), 1.); }`,
    }));
    fin.renderToScreen = true;
    comp.addPass(fin);
    GFX.composer = comp;
    r.toneMapping = THREE.NoToneMapping;
  } else {
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.0;
  }

  // 공용 텍스처
  GFX.noiseTex = makeNoiseTex();
  GFX.waterN = makeWaterNormal();
  GFX.glowTex = makeGlowTex();
  GFX.runeTex = makeRuneTex();
  GFX.fx = new FXSystem(scene);
  GFX.static = new THREE.Group(); scene.add(GFX.static);
  GFX.dyn = new THREE.Group(); scene.add(GFX.dyn);
  initGrass();
  window.addEventListener('resize', resizeGfx);
  resizeGfx();
}
function resizeGfx() {
  const w = window.innerWidth, h = window.innerHeight;
  GFX.renderer.setSize(w, h, false);
  GFX.camera.aspect = w / h; GFX.camera.updateProjectionMatrix();
  if (GFX.composer) { GFX.composer.setSize(w, h); GFX.composer.setPixelRatio(GFX.renderer.getPixelRatio()); }
  const hud = document.getElementById('hud');
  HUD.dpr = Math.min(window.devicePixelRatio || 1, 2);
  hud.width = Math.round(w * HUD.dpr); hud.height = Math.round(h * HUD.dpr);
  HUD.w = w; HUD.h = h;
}

// ---------- 텍스처 ----------
function canvasTex(size, draw, repeat) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); draw(g, size);
  const t = new THREE.CanvasTexture(c);
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 4;
  return t;
}
function makeNoiseTex() {
  return canvasTex(256, (g, S) => {
    const img = g.createImageData(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const n = fbm(x / 16, y / 16, 3) * 0.6 + noise2(x / 3, y / 3, 9) * 0.4;
      const v = 200 + n * 55;
      const i = (y * S + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, true);
}
function makeWaterNormal() {
  const t = canvasTex(256, (g, S) => {
    const img = g.createImageData(S, S);
    const H = (x, y) => noise2(x / 18, y / 18, 2) * 0.6 + noise2(x / 7, y / 7, 5) * 0.4;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const dx = H((x + 1) % S, y) - H((x - 1 + S) % S, y), dy = H(x, (y + 1) % S) - H(x, (y - 1 + S) % S);
      const i = (y * S + x) * 4;
      img.data[i] = 128 + dx * 300; img.data[i + 1] = 128 + dy * 300; img.data[i + 2] = 255; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, true);
  return t;
}
function makeGlowTex() {
  return canvasTex(64, (g, S) => {
    const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
  });
}
// 룬 고리: 공명봉 마법을 쓸 때 발밑에 뜬다
function makeRuneTex() {
  return canvasTex(512, (g, S) => {
    const c = S / 2;
    g.strokeStyle = '#fff'; g.fillStyle = '#fff';
    g.lineWidth = 6; g.beginPath(); g.arc(c, c, c - 8, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 2; g.beginPath(); g.arc(c, c, c - 22, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 3; g.beginPath(); g.arc(c, c, c * 0.56, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 1.5; g.beginPath(); g.arc(c, c, c * 0.5, 0, Math.PI * 2); g.stroke();
    g.font = 'bold 26px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const words = 'COR · CALIDA · VIGILANS · TRADERE · SEDES · CLAVIS · ASTERIA · '.split('');
    for (let i = 0; i < words.length; i++) {
      const a = i / words.length * Math.PI * 2;
      g.save(); g.translate(c + Math.cos(a) * (c - 52), c + Math.sin(a) * (c - 52)); g.rotate(a + Math.PI / 2); g.fillText(words[i], 0, 0); g.restore();
    }
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2, b = a + Math.PI * 2 / 3;
      g.lineWidth = 2; g.beginPath(); g.moveTo(c + Math.cos(a) * c * 0.5, c + Math.sin(a) * c * 0.5); g.lineTo(c + Math.cos(b) * c * 0.5, c + Math.sin(b) * c * 0.5); g.stroke();
    }
    for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2, r0 = c - 22, r1 = c - (i % 4 ? 30 : 40); g.beginPath(); g.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0); g.lineTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1); g.stroke(); }
    g.beginPath(); g.arc(c, c, 14, 0, Math.PI * 2); g.fill();
  });
}

// ---------- 재질과 도형 ----------
const _mats = {}, _geos = {};
function mat(color, o = {}) {
  const k = color + JSON.stringify(o);
  if (_mats[k]) return _mats[k];
  let m;
  if (o.glow) {
    m = new THREE.MeshBasicMaterial({ color: COL(color).multiplyScalar(o.glow), transparent: !!o.opacity || !!o.add, opacity: o.opacity ?? 1, blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: !o.add, fog: !o.noFog, side: o.side || THREE.FrontSide });
  } else {
    m = new THREE.MeshStandardMaterial({ color: COL(color), roughness: o.rough ?? 0.85, metalness: o.metal ?? 0, flatShading: o.flat ?? true, transparent: !!o.opacity, opacity: o.opacity ?? 1, side: o.side || THREE.FrontSide, emissive: o.emis ? COL(o.emis) : COL(0), emissiveIntensity: o.emisI ?? 1 });
  }
  _mats[k] = m;
  return m;
}
function geo(kind, ...a) {
  const k = kind + a.join(',');
  if (_geos[k]) return _geos[k];
  let g;
  switch (kind) {
    case 'box': g = new THREE.BoxGeometry(a[0], a[1], a[2]); break;
    case 'cyl': g = new THREE.CylinderGeometry(a[0], a[1], a[2], a[3] || 8); break;
    case 'sph': g = new THREE.SphereGeometry(a[0], a[1] || 10, a[2] || 8); break;
    case 'ico': g = new THREE.IcosahedronGeometry(a[0], a[1] || 0); break;
    case 'dod': g = new THREE.DodecahedronGeometry(a[0], 0); break;
    case 'cone': g = new THREE.ConeGeometry(a[0], a[1], a[2] || 8); break;
    case 'tor': g = new THREE.TorusGeometry(a[0], a[1], a[2] || 8, a[3] || 24, a[4] || Math.PI * 2); break;
    case 'plane': g = new THREE.PlaneGeometry(a[0], a[1]); break;
    case 'ring': g = new THREE.RingGeometry(a[0], a[1], a[2] || 32, 1, a[3] || 0, a[4] || Math.PI * 2); break;
    case 'oct': g = new THREE.OctahedronGeometry(a[0], 0); break;
    case 'circle': g = new THREE.CircleGeometry(a[0], a[1] || 24); break;
  }
  _geos[k] = g;
  return g;
}
function mesh(g, m, x = 0, y = 0, z = 0, parent) {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  if (parent) parent.add(o);
  return o;
}
// 자주 쓰는 마법 재질
const GLOW = (c, k = 2, o = {}) => mat(c, Object.assign({ glow: k }, o));
const ADD = (c, k = 1.5, op = 0.8) => mat(c, { glow: k, add: true, opacity: op });
function runeDisc(color, size, k = 2.2) {
  const m = new THREE.MeshBasicMaterial({ map: GFX.runeTex, color: COL(color).multiplyScalar(k), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const o = new THREE.Mesh(geo('plane', size, size), m);
  o.rotation.x = -Math.PI / 2;
  return o;
}
function beamMat(color) {
  return new THREE.ShaderMaterial({
    uniforms: { c: { value: COL(color) }, a: { value: 0.5 }, t: { value: 0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: 'uniform vec3 c; uniform float a, t; varying vec2 vUv; void main(){ float e = 1.0 - abs(vUv.x - 0.5) * 2.0; float f = pow(1.0 - vUv.y, 1.6); float s = 0.75 + 0.25 * sin(vUv.y * 40.0 - t * 3.0); gl_FragColor = vec4(c * 2.2, e * e * f * a * s); }',
  });
}

// ---------- 물 ----------
function waterMat(o = {}) {
  const m = new THREE.MeshStandardMaterial({ color: COL(o.color || 0x2b7fb8), roughness: 0.12, metalness: 0.05, transparent: true, opacity: o.opacity ?? 0.82, normalMap: GFX.waterN, normalScale: new THREE.Vector2(0.5, 0.5), depthWrite: false });
  m.userData.flow = o.flow || 0;
  m.onBeforeCompile = sh => {
    sh.uniforms.uT = GFX.timeU;
    sh.vertexShader = 'uniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vec4 wp0 = modelMatrix * vec4(position, 1.0); transformed.z += sin(wp0.x * 0.35 + uT * 1.3) * 0.06 + cos(wp0.z * 0.29 + uT * 1.1) * 0.06;');
  };
  return m;
}
GFX.timeU = { value: 0 };

// ---------- 풀 (플레이어 주변에만 자란다) ----------
function initGrass() {
  const N = GFX.mobile ? 4500 : 16000;
  const g = new THREE.BufferGeometry();
  const P = [-0.05, 0, 0, 0.05, 0, 0, -0.03, 0.28, 0, 0.03, 0.28, 0, 0, 0.55, 0];
  const C = [0.45, 0.45, 0.45, 0.45, 0.45, 0.45, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 1.15, 1.15, 1.15];
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  g.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4]);
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  m.onBeforeCompile = sh => {
    sh.uniforms.uT = GFX.timeU;
    sh.vertexShader = 'uniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec4 ip = instanceMatrix * vec4(0.,0.,0.,1.);
      float k = position.y * position.y * 3.0;
      transformed.x += (sin(uT * 1.8 + ip.x * 0.4 + ip.z * 0.25) * 0.5 + sin(uT * 3.1 + ip.z * 0.9) * 0.18) * k * 0.6;
      transformed.z += cos(uT * 1.5 + ip.x * 0.3) * k * 0.25;`);
  };
  const im = new THREE.InstancedMesh(g, m, N);
  im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  im.frustumCulled = false;
  im.receiveShadow = true;
  GFX.grass = { im, N, cx: 1e9, cz: 1e9, on: false };
  const c = new THREE.Color(1, 1, 1);
  for (let i = 0; i < N; i++) im.setColorAt(i, c);
  GFX.scene.add(im);
}
const _gm = new THREE.Matrix4(), _gq = new THREE.Quaternion(), _gs = new THREE.Vector3(), _gp = new THREE.Vector3(), _gc = new THREE.Color(), _gy = new THREE.Vector3(0, 1, 0);
function updateGrass(px, pz, force) {
  const gr = GFX.grass, m = G.map;
  if (!m || !m.grassAt) { if (gr.on) { gr.im.count = 0; gr.on = false; } return; }
  if (!force && Math.hypot(px - gr.cx, pz - gr.cz) < 3.5) return;
  gr.cx = px; gr.cz = pz; gr.on = true;
  const R = GFX.mobile ? 18 : 30, step = GFX.mobile ? 0.5 : 0.44;
  const n0x = Math.floor((px - R) / step), n0z = Math.floor((pz - R) / step), n = Math.ceil(2 * R / step);
  let i = 0;
  for (let a = 0; a < n && i < gr.N; a++) for (let b = 0; b < n && i < gr.N; b++) {
    const cx = n0x + a, cz = n0z + b;
    const x = (cx + hash2(cx, cz, 1)) * step, z = (cz + hash2(cx, cz, 2)) * step;
    const dx = x - px, dz = z - pz;
    if (dx * dx + dz * dz > R * R) continue;
    const s = m.grassAt(x, z);
    if (!s) continue;
    const h = hash2(cx, cz, 3);
    if (h > s.d) continue;
    _gp.set(x, s.y, z);
    _gq.setFromAxisAngle(_gy, hash2(cx, cz, 4) * 6.28);
    const sc = (0.6 + hash2(cx, cz, 5) * 0.9) * (s.k || 1);
    _gs.set(sc, sc * (0.8 + h * 0.6), sc);
    _gm.compose(_gp, _gq, _gs);
    gr.im.setMatrixAt(i, _gm);
    _gc.setRGB(s.r, s.g, s.b);
    if (s.flower && hash2(cx, cz, 6) < s.flower) _gc.setHex(pick([0xff8ab8, 0xffe070, 0xffffff, 0xb090ff]));
    gr.im.setColorAt(i, _gc);
    i++;
  }
  gr.im.count = i;
  gr.im.instanceMatrix.needsUpdate = true;
  if (gr.im.instanceColor) gr.im.instanceColor.needsUpdate = true;
}

// ---------- 입자 (빛나는 것과 보통 것) ----------
class FXSystem {
  constructor(scene) {
    this.sys = [this.make(scene, 3500, true), this.make(scene, 2500, false)];
  }
  make(scene, N, add) {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), sz = new Float32Array(N), al = new Float32Array(N);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('size', new THREE.BufferAttribute(sz, 1));
    g.setAttribute('alpha', new THREE.BufferAttribute(al, 1));
    const m = new THREE.ShaderMaterial({
      uniforms: { map: { value: GFX.glowTex }, scale: { value: 400 } },
      transparent: true, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, vertexColors: true,
      vertexShader: 'attribute float size; attribute float alpha; varying vec3 vC; varying float vA; uniform float scale; void main(){ vC = color; vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }',
      fragmentShader: `uniform sampler2D map; varying vec3 vC; varying float vA; void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC * ${add ? '2.0' : '1.0'}, t.a * vA); }`,
    });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 5;
    scene.add(pts);
    return { N, g, pos, col, sz, al, p: [], m };
  }
  spawn(o) {
    const s = this.sys[o.add === false ? 1 : 0];
    if (s.p.length >= s.N) s.p.shift();
    const c = COL(o.c ?? 0xffffff);
    s.p.push({ x: o.x, y: o.y, z: o.z, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0, life: o.life || 0.8, max: o.life || 0.8, size: o.size || 0.3, r: c.r, g: c.g, b: c.b, grav: o.grav || 0, drag: o.drag ?? 1.5, shrink: o.shrink ?? true, a: o.a ?? 1 });
  }
  burst(x, y, z, n, c, sp = 4, life = 0.7, size = 0.3, o = {}) {
    for (let i = 0; i < n; i++) {
      const u = rand(-1, 1), th = rand(Math.PI * 2), s = rand(0.3, 1) * sp, r = Math.sqrt(1 - u * u);
      this.spawn(Object.assign({ x, y, z, vx: Math.cos(th) * r * s, vy: u * s * (o.up ?? 1) + (o.lift || 0), vz: Math.sin(th) * r * s, life: life * rand(0.6, 1.2), size: size * rand(0.6, 1.3), c }, o));
    }
  }
  update(dt) {
    for (const s of this.sys) {
      let j = 0;
      for (let i = 0; i < s.p.length; i++) {
        const p = s.p[i];
        p.life -= dt;
        if (p.life <= 0) continue;
        const d = Math.exp(-p.drag * dt);
        p.vx *= d; p.vz *= d; p.vy = p.vy * d - p.grav * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        s.p[j++] = p;
        const k = j - 1, f = p.life / p.max;
        s.pos[k * 3] = p.x; s.pos[k * 3 + 1] = p.y; s.pos[k * 3 + 2] = p.z;
        s.col[k * 3] = p.r; s.col[k * 3 + 1] = p.g; s.col[k * 3 + 2] = p.b;
        s.sz[k] = p.shrink ? p.size * (0.3 + 0.7 * f) : p.size;
        s.al[k] = Math.min(1, f * 2.5) * p.a;
      }
      s.p.length = j;
      s.g.setDrawRange(0, j);
      for (const a of ['position', 'color', 'size', 'alpha']) s.g.attributes[a].needsUpdate = true;
      s.m.uniforms.scale.value = HUD.h * 0.9;
    }
  }
  clear() { for (const s of this.sys) s.p.length = 0; }
}
const FX = { burst: (...a) => GFX.fx.burst(...a), spawn: o => GFX.fx.spawn(o) };

// 화면 좌표로 바꾸기 (이름표, 상호작용 표시)
const _pv = new THREE.Vector3();
function project(x, y, z) {
  _pv.set(x, y, z).project(GFX.camera);
  return { x: (_pv.x * 0.5 + 0.5) * HUD.w, y: (-_pv.y * 0.5 + 0.5) * HUD.h, on: _pv.z < 1 && _pv.z > -1 && Math.abs(_pv.x) < 1.2 && Math.abs(_pv.y) < 1.2 };
}
function label(x, y, z, text, col, o) { GFX.labels.push({ x, y, z, text, col: col || '#fff', o: o || {} }); }

// ---------- 하늘과 시간 ----------
const SKY = {
  day: { top: 0x3a7bd5, hor: 0xbfe3f5, sun: 0xfff0d8 },
  dusk: { top: 0x3a4a8a, hor: 0xf3a66c, sun: 0xffb070 },
  night: { top: 0x070a1c, hor: 0x1c2446, sun: 0x8090c0 },
};
const _c1 = new THREE.Color(), _c2 = new THREE.Color();
function updateSky(o) {
  const U = GFX.skyU;
  if (o.indoor) {
    U.top.value.set(o.bg); U.horizon.value.set(o.bg); U.bottom.value.set(o.bg); U.stars.value = 0; U.aurora.value = 0;
    GFX.scene.fog.color.set(o.bg); GFX.scene.fog.density = o.fog;
    GFX.sun.intensity = o.sun ?? 0.25; GFX.sun.color.set(0xd8e0ff);
    GFX.hemi.intensity = o.hemi ?? 0.35; GFX.hemi.color.set(o.hemiC || 0x8090c0); GFX.hemi.groundColor.set(0x302830);
    GFX.amb.intensity = o.amb ?? 0.15;
    U.sunDir.value.set(0.3, 0.9, 0.2).normalize();
    return;
  }
  const h = o.hour;
  const a = (h - 6) / 12 * Math.PI;                     // 6시 동쪽, 18시 서쪽
  const sy = Math.sin(a), sx = Math.cos(a);
  const sunUp = sy > -0.05;
  const dir = sunUp ? V3(sx, Math.max(sy, 0.05), 0.35).normalize() : V3(-sx, Math.max(-sy, 0.2), -0.3).normalize();
  U.sunDir.value.copy(dir);
  const n = o.night;                       // 0 낮 ~ 1 밤
  const dusk = clamp(1 - Math.abs(sy) * 4, 0, 1) * (1 - n * 0.5);
  _c1.set(SKY.day.top).lerp(_c2.set(SKY.dusk.top), dusk).lerp(_c2.set(SKY.night.top), n);
  U.top.value.copy(_c1);
  _c1.set(SKY.day.hor).lerp(_c2.set(SKY.dusk.hor), dusk).lerp(_c2.set(SKY.night.hor), n);
  if (o.haze) _c1.lerp(_c2.set(o.haze), o.hazeK || 0.5);
  U.horizon.value.copy(_c1);
  U.bottom.value.copy(_c1).multiplyScalar(0.6);
  GFX.scene.fog.color.copy(_c1);
  GFX.scene.fog.density = o.fog ?? 0.0045;
  U.sunCol.value.set(sunUp ? (dusk > 0.4 ? SKY.dusk.sun : SKY.day.sun) : SKY.night.sun);
  U.stars.value = n; U.aurora.value = (o.aurora || 0) * n;
  GFX.sun.color.copy(U.sunCol.value);
  GFX.sun.intensity = sunUp ? lerp(2.4, 1.2, dusk) * (o.sunK ?? 1) : 0.35;
  GFX.hemi.color.set(n > 0.5 ? 0x5a6aa8 : 0xcfe8ff); GFX.hemi.groundColor.set(n > 0.5 ? 0x202838 : 0x5a6a3a);
  GFX.hemi.intensity = lerp(0.8, 0.35, n);
  GFX.amb.intensity = n * 0.12;
}
