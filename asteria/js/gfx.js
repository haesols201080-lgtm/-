// 아스테리아 1부 — 그래픽: 렌더러, 하늘, 빛, 후처리, 재질, 물, 풀, 입자, 마법 효과
'use strict';

const GFX = { pool: [], labels: [], t: 0 };
// 색은 sRGB로 적고, 계산은 선형 공간에서 한다
THREE.ColorManagement.legacyMode = false;
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const COL = c => new THREE.Color(c);

function initGfx() {
  const isTouch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  GFX.mobile = isTouch;
  GFX.low = /low/.test(location.search);
  const atmos = !!window.ATMOS;
  const canvas = document.getElementById('gl');
  // 대기 모듈이 있으면 렌더 타깃에 그리고 SMAA로 다듬으므로 기본 버퍼 안티에일리어싱은 꺼 둔다
  const r = new THREE.WebGLRenderer({ canvas, antialias: atmos ? GFX.low : !isTouch, powerPreference: 'high-performance', stencil: false });
  r.setPixelRatio(GFX.low ? 0.5 : Math.min(window.devicePixelRatio || 1, isTouch ? 1.25 : 1.6));
  r.shadowMap.enabled = !GFX.low;
  r.shadowMap.type = isTouch ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
  r.outputEncoding = THREE.sRGBEncoding;
  GFX.renderer = r;
  GFX.webgl2 = r.capabilities.isWebGL2;
  const scene = new THREE.Scene();
  GFX.scene = scene;
  GFX.camera = new THREE.PerspectiveCamera(58, 1, 0.1, 1400);
  scene.fog = new THREE.FogExp2(0xbfe3f5, 0.006);

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

  // 공용 텍스처
  GFX.noiseTex = makeNoiseTex();
  GFX.waterN = makeWaterNormal();
  GFX.glowTex = makeGlowTex();
  GFX.runeTex = makeRuneTex();
  GFX.fx = new FXSystem(scene);
  GFX.static = new THREE.Group(); scene.add(GFX.static);
  GFX.dyn = new THREE.Group(); scene.add(GFX.dyn);
  initGrass();

  // 하늘, 구름, 환경광, 그림자 단계, 후처리: 대기 모듈(js/atmos.js)이 맡는다. 없으면 예전 방식.
  if (atmos) ATMOS.init(); else legacySkyAndPost(r, scene, isTouch);
  window.addEventListener('resize', resizeGfx);
  resizeGfx();
}
// 대기 모듈이 없을 때의 예전 하늘과 후처리
function legacySkyAndPost(r, scene, isTouch) {
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
        gl_FragColor = vec4(c, 1.); }`,
  }));
  sky.renderOrder = -10; sky.frustumCulled = false;
  GFX.sky = sky; scene.add(sky);
  if (!isTouch && !GFX.low && GFX.webgl2 && THREE.EffectComposer) {
    const rt = new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType });
    const comp = new THREE.EffectComposer(r, rt);
    comp.addPass(new THREE.RenderPass(scene, GFX.camera));
    GFX.bloom = new THREE.UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.45, 0.92);
    comp.addPass(GFX.bloom);
    GFX.finalU = { tDiffuse: { value: null }, exposure: { value: 0.82 }, vig: { value: 0.55 }, sat: { value: 1.08 }, tint: { value: COL(0xffffff) } };
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
}
function resizeGfx() {
  const w = window.innerWidth, h = window.innerHeight;
  GFX.renderer.setSize(w, h, false);
  GFX.camera.aspect = w / h; GFX.camera.updateProjectionMatrix();
  if (GFX.composer) { GFX.composer.setSize(w, h); GFX.composer.setPixelRatio(GFX.renderer.getPixelRatio()); }
  const hud = document.getElementById('hud');
  if (typeof HUD === 'undefined') return;
  HUD.dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (hud) { hud.width = Math.round(w * HUD.dpr); hud.height = Math.round(h * HUD.dpr); }
  HUD.w = w; HUD.h = h;
}

// ---------- 텍스처 ----------
function canvasTex(size, draw, repeat) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); draw(g, size);
  const t = new THREE.CanvasTexture(c);
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 4;
  t.encoding = THREE.sRGBEncoding;
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
  t.encoding = THREE.LinearEncoding;
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
    fragmentShader: 'uniform vec3 c; uniform float a, t; varying vec2 vUv; void main(){ float e = 1.0 - abs(vUv.x - 0.5) * 2.0; float f = pow(1.0 - vUv.y, 2.2); float s = 0.75 + 0.25 * sin(vUv.y * 40.0 - t * 3.0); gl_FragColor = vec4(c * 1.6, e * e * e * f * a * s * 0.6); }',
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
// 포기(tuft) 하나 = 휜 잎 5~7장. 뿌리는 어둡고 끝은 밝고 마른 색이 섞인다. 바람 물결이 들판을 굴러가고(눕는 곳이 밝아진다),
// 해를 마주 보면 잎끝이 비친다. 꽃은 무리 지어 핀다. 카메라 가까이는 촘촘하게(땅을 가린다), 멀리는 성기고 넓게, 끝에서 작아져 사라진다.
// 재질은 MeshStandardMaterial을 고쳐 쓴다 (대기 모듈의 그림자·환경광·안개를 그대로 받는다).
function grassTuftGeo(blades, segs, flower) {
  const P = [], N = [], B = [], C = [], I = [];
  let seed = flower ? 77 : 13;
  const r = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const n = flower ? 3 : blades;
  for (let k = 0; k < n; k++) {
    const th = r() * Math.PI * 2, bd = Math.sqrt(r()) * (flower ? 0.06 : 0.13), bx = Math.cos(th) * bd, bz = Math.sin(th) * bd;
    const face = r() * Math.PI * 2, fx = Math.cos(face), fz = Math.sin(face);           // 잎 넓은 면의 가로 방향
    const la = face + Math.PI / 2 + (r() - 0.5) * 1.2, lx = Math.cos(la), lz = Math.sin(la); // 눕는 쪽
    const h = flower ? 0.75 + r() * 0.35 : 0.45 + r() * 0.55, lean = flower ? 0.05 + r() * 0.1 : 0.1 + r() * 0.32, w0 = flower ? 0.004 : 0.005 + r() * 0.004, rb = r();
    const i0 = P.length / 3;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs, cx = bx + lx * lean * h * t * t, cy = h * t * (1 - 0.12 * lean * t), cz = bz + lz * lean * h * t * t;
      const w = w0 * Math.pow(1 - t, 0.85) * (1 + 0.6 * Math.sin(t * 3.0) * (1 - t));
      // 법선: 위쪽 + 눕는 쪽 + 넓은 면 조금 (들판이 지형처럼 고르게 밝도록)
      let nx = -fz * 0.35 + lx * 0.25, ny = 0.75, nz = fx * 0.35 + lz * 0.25; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      if (i < segs) { for (const sg of [-1, 1]) { P.push(cx + fx * w * sg, cy, cz + fz * w * sg); N.push(nx, ny, nz); B.push(t, rb, 0); C.push(1, 1, 1); } }
      else { P.push(cx, cy, cz); N.push(nx, ny, nz); B.push(1, rb, 0); C.push(1, 1, 1); }
    }
    for (let i = 0; i < segs - 1; i++) { const a = i0 + i * 2; I.push(a, a + 1, a + 3, a, a + 3, a + 2); }
    const a = i0 + (segs - 1) * 2; I.push(a, a + 1, a + 2);
    if (flower) { // 꽃 머리: 꽃잎 부채 (gb.z = 1)
      const tx = bx + lx * lean * h, ty = h * (1 - 0.12 * lean), tz = bz + lz * lean * h, c0 = P.length / 3, pr = 0.035 + r() * 0.02;
      P.push(tx, ty + 0.01, tz); N.push(0, 1, 0); B.push(1, rb, 1); C.push(0.55, 0.45, 0.25);
      for (let j = 0; j <= 10; j++) { const an = j / 10 * Math.PI * 2, rr = pr * (j % 2 ? 0.55 : 1); P.push(tx + Math.cos(an) * rr, ty - rr * 0.15, tz + Math.sin(an) * rr); N.push(0, 1, 0); B.push(1, rb, 1); C.push(1, 1, 1); }
      for (let j = 0; j < 10; j++) I.push(c0, c0 + 1 + j, c0 + 2 + j);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  g.setAttribute('gb', new THREE.Float32BufferAttribute(B, 3));
  g.setIndex(I);
  return g;
}
function grassMat(flower) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.82, metalness: 0, envMapIntensity: 0.9 });
  m.customProgramCacheKey = () => 'grass' + (flower ? 'F' : '');
  m.onBeforeCompile = sh => {
    sh.uniforms.uT = GFX.timeU;
    const NOISE = `float gHash( vec2 p ) { vec3 q = fract( vec3( p.xyx ) * 0.1031 ); q += dot( q, q.yzx + 33.33 ); return fract( ( q.x + q.y ) * q.z ); }
float gNoise( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f ); return mix( mix( gHash( i ), gHash( i + vec2( 1.0, 0.0 ) ), f.x ), mix( gHash( i + vec2( 0.0, 1.0 ) ), gHash( i + vec2( 1.0, 1.0 ) ), f.x ), f.y ); }
`;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
uniform float uT;
attribute vec3 gb;
varying vec3 vGb;
varying vec2 vGw;
` + NOISE).replace('#include <begin_vertex>', `#include <begin_vertex>
{
	vec3 gIp = ( modelMatrix * vec4( instanceMatrix[ 3 ].xyz, 1.0 ) ).xyz;
	mat3 gM = mat3( instanceMatrix );
	float gH = length( gM[ 1 ] ), t = gb.x;
	vec2 wd = vec2( 0.8, 0.6 );
	float ph = dot( gIp.xz, wd );
	// 큰 물결 (바람 쪽으로 굴러간다) + 돌풍 얼룩 + 잎 떨림
	float wave = 0.5 + 0.5 * sin( ph * 0.23 - uT * 1.8 + 2.0 * sin( dot( gIp.xz, vec2( -0.6, 0.8 ) ) * 0.045 ) );
	float gust = gNoise( gIp.xz * 0.05 - wd * uT * 0.9 );
	float w = clamp( wave * 0.55 + gust * 0.65 - 0.1, 0.0, 1.0 );
	float fl = sin( uT * 4.3 + gb.y * 37.0 + gIp.x * 1.7 + gIp.z * 1.3 ) * 0.07;
	float bend = ( 0.1 + 0.5 * w + fl ) * t * t;
	vec3 wo = vec3( wd.x, 0.0, wd.y ) * bend * gH * 0.85;
	wo.y = - bend * bend * gH * 0.5;
	transformed += vec3( dot( gM[ 0 ], wo ) / dot( gM[ 0 ], gM[ 0 ] ), dot( gM[ 1 ], wo ) / dot( gM[ 1 ], gM[ 1 ] ), dot( gM[ 2 ], wo ) / dot( gM[ 2 ], gM[ 2 ] ) );
	vGb = vec3( t, gb.y, gb.z ); vGw = vec2( w, gNoise( gIp.xz * 0.07 + 3.1 ) * 0.7 + gNoise( gIp.xz * 0.6 ) * 0.3 );
}`);
    // 잎 색: 뿌리 어둡게 → 몸통(땅 색) → 끝은 밝고 마른 색. 꽃은 머리만 물든다
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vGb;\nvarying vec2 vGw;\n')
      .replace('#include <color_fragment>', flower ? `#include <color_fragment>
	diffuseColor.rgb = vGb.z > 0.5 ? diffuseColor.rgb * ( 0.85 + 0.3 * vGb.y ) : vec3( 0.075, 0.11, 0.035 ) * ( 0.5 + 0.7 * vGb.x );` : `#include <color_fragment>
	{
		vec3 gBase = diffuseColor.rgb, gDry = vec3( 0.39, 0.31, 0.1 );
		float dk = smoothstep( 0.45, 0.85, vGw.y ) * 0.6 + vGb.y * 0.2;
		vec3 gTip = mix( gBase * vec3( 1.4, 1.38, 1.15 ), gDry, dk * 0.75 );
		vec3 gc = mix( gBase * 0.3, gBase * ( 0.9 + 0.25 * vGb.y ), smoothstep( 0.0, 0.5, vGb.x ) );
		gc = mix( gc, gTip, smoothstep( 0.45, 1.0, vGb.x ) );
		gc *= 1.0 + vGw.x * 0.22 * vGb.x;
		diffuseColor.rgb = gc;
	}`)
      .replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('normal = normal * faceDirection;', ''));
    // 해(방향광 0)의 그림자 먹은 빛을 잡아 잎끝 투과에 쓴다
    let L = THREE.ShaderChunk.lights_fragment_begin;
    const ka = L.indexOf('NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )'), key = 'RE_Direct( directLight, geometry, material, reflectedLight );', kb = ka < 0 ? -1 : L.indexOf(key, ka);
    if (kb >= 0) L = L.slice(0, kb + key.length) + '\n\t\t#if ( UNROLLED_LOOP_INDEX == 0 )\n\t\tgSunC = directLight.color; gSunL = directLight.direction;\n\t\t#endif\n' + L.slice(kb + key.length);
    sh.fragmentShader = sh.fragmentShader.replace('#include <lights_fragment_begin>', 'vec3 gSunC = vec3( 0.0 ); vec3 gSunL = vec3( 0.0, 1.0, 0.0 );\n' + L + `
	{ float fb = saturate( - dot( geometry.viewDir, gSunL ) );
	  reflectedLight.directDiffuse += gSunC * BRDF_Lambert( material.diffuseColor ) * ( pow( fb, 5.0 ) * 1.8 + fb * fb * 0.3 ) * smoothstep( 0.3, 1.0, vGb.x ) * vec3( 1.0, 0.95, 0.55 ); }`);
  };
  return m;
}
function initGrass() {
  const mob = GFX.mobile, low = GFX.low;
  const N = mob ? 4200 : low ? 6000 : 13000, NF = mob ? 500 : low ? 900 : 2600;
  const mk = (geo, mat, n) => {
    const im = new THREE.InstancedMesh(geo, mat, n);
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3).fill(1), 3).setUsage(THREE.DynamicDrawUsage);
    im.frustumCulled = false; im.receiveShadow = true; im.count = 0;
    GFX.scene.add(im);
    return im;
  };
  const im = mk(grassTuftGeo(mob ? 7 : 11, mob ? 2 : 3, false), grassMat(false), N);
  const fl = mk(grassTuftGeo(3, mob ? 3 : 4, true), grassMat(true), NF);
  GFX.grass = { im, N, fl, NF, cx: 1e9, cz: 1e9, on: false };
}
const _gm = new THREE.Matrix4(), _gq = new THREE.Quaternion(), _gs = new THREE.Vector3(), _gp = new THREE.Vector3(), _gc = new THREE.Color(), _gy = new THREE.Vector3(0, 1, 0);
// 차분한 들꽃 색 (sRGB): 흰 데이지, 버터컵, 라일락, 분홍, 수레국화, 크림, 끈끈이대나물
const GRASS_FLOWERS = [0xe8e2d0, 0xd9c25a, 0xa48cb8, 0xc98e9c, 0x7088b8, 0xe6d6a2, 0xb8687a].map(h => new THREE.Color(h));
function updateGrass(px, pz, force) {
  const gr = GFX.grass, m = G.map;
  if (!m || !m.grassAt) { if (gr.on) { gr.im.count = 0; gr.fl.count = 0; gr.on = false; } return; }
  if (!force && Math.hypot(px - gr.cx, pz - gr.cz) < 3) return;
  gr.cx = px; gr.cz = pz; gr.on = true;
  // 가까운 고리는 촘촘한 격자, 바깥 고리는 성긴 격자 (포기를 넓혀 덮는다)
  const mob = GFX.mobile, low = GFX.low;
  const rings = mob ? [[0, 7, 0.32, 1], [7, 15, 0.6, 1.5]] : low ? [[0, 8, 0.3, 1], [8, 18, 0.56, 1.5]] : [[0, 10, 0.25, 1], [10, 24, 0.46, 1.5]];
  const Rmax = rings[1][1];
  let i = 0, f = 0;
  const A = gr.im.instanceMatrix.array, AC = gr.im.instanceColor.array, B = gr.fl.instanceMatrix.array, BC = gr.fl.instanceColor.array;
  for (let ri = 0; ri < 2; ri++) {
    const [r0, r1, step, wk] = rings[ri], salt = ri * 7;
    const n0x = Math.floor((px - r1) / step), n0z = Math.floor((pz - r1) / step), n = Math.ceil(2 * r1 / step) + 1;
    for (let a = 0; a < n && i < gr.N; a++) for (let b = 0; b < n && i < gr.N; b++) {
      const cx = n0x + a, cz = n0z + b;
      const x = (cx + hash2(cx, cz, 1 + salt)) * step, z = (cz + hash2(cx, cz, 2 + salt)) * step;
      const dx = x - px, dz = z - pz, d2 = dx * dx + dz * dz;
      if (d2 >= r1 * r1 || d2 < r0 * r0) continue;
      const s = m.grassAt(x, z);
      if (!s) continue;
      const h = hash2(cx, cz, 3 + salt);
      if (h > s.d) continue;
      const d = Math.sqrt(d2);
      // 키: 대개 0.1~0.35 m, 들판의 몇 무리만 ~0.5 m. 풀 밀도가 낮은 곳(길·마당 가장자리)은 잔디처럼 짧다. 끝 고리에서 작아져 사라진다
      const hn = noise2(x * 0.13, z * 0.13, 41) * 0.75 + noise2(x * 0.6, z * 0.6, 43) * 0.25, wild = smooth(0.66, 0.86, noise2(x * 0.05, z * 0.05, 45));
      const ht = (0.1 + 0.25 * hn * hn * (3 - 2 * hn) + wild * 0.16) * (0.82 + hash2(cx, cz, 5 + salt) * 0.36) * (s.k || 1) * (0.5 + 0.5 * smooth(0.45, 0.85, s.d)) * smooth(Rmax, Rmax * 0.72, d);
      if (ht < 0.03) continue;
      const wd = (0.95 + hash2(cx, cz, 6 + salt) * 0.5) * wk;
      _gq.setFromAxisAngle(_gy, hash2(cx, cz, 4 + salt) * 6.283);
      _gm.compose(_gp.set(x, s.y - 0.02, z), _gq, _gs.set(wd, ht, wd));
      _gm.toArray(A, i * 16);
      // 색: 땅 색 그대로 (선형), 포기마다 밝기 ±10%, 넓은 얼룩으로 올리브↔노란 기운
      const v = 0.9 + hash2(cx, cz, 8 + salt) * 0.2, yl = noise2(x * 0.045, z * 0.045, 47) - 0.5;
      AC[i * 3] = s.r * v * (1 + yl * 0.25); AC[i * 3 + 1] = s.g * v; AC[i * 3 + 2] = s.b * v * (1 - yl * 0.3);
      i++;
      // 꽃: 무리 지어서 (낮은 주파수 노이즈가 높은 곳만), 무리마다 한 색
      if (s.flower && f < gr.NF && d < Rmax * 0.8) {
        const fk = smooth(0.6, 0.82, noise2(x * 0.085 + 17, z * 0.085, 49));
        if (fk > 0 && hash2(cx, cz, 9 + salt) < s.flower * 16 * fk * (ri ? 1.6 : 1)) {
          const fh = Math.max(ht * 1.15, 0.2) * (0.95 + hash2(cx, cz, 10 + salt) * 0.35);
          _gm.compose(_gp.set(x + (hash2(cx, cz, 11) - 0.5) * step, s.y - 0.02, z + (hash2(cx, cz, 12) - 0.5) * step), _gq, _gs.set(wk * 1.1, fh, wk * 1.1));
          _gm.toArray(B, f * 16);
          const c = GRASS_FLOWERS[Math.floor(noise2(x * 0.03, z * 0.03, 53) * 9 + hash2(cx, cz, 13) * 0.6) % GRASS_FLOWERS.length];
          BC[f * 3] = c.r; BC[f * 3 + 1] = c.g; BC[f * 3 + 2] = c.b;
          f++;
        }
      }
    }
  }
  for (const [im, n] of [[gr.im, i], [gr.fl, f]]) {
    im.count = n;
    im.instanceMatrix.needsUpdate = true; im.instanceMatrix.updateRange.count = n * 16;
    im.instanceColor.needsUpdate = true; im.instanceColor.updateRange.count = n * 3;
  }
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
      s.m.uniforms.scale.value = (typeof HUD !== 'undefined' ? HUD.h : GFX.renderer.domElement.clientHeight) * 0.9;
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
  day: { top: 0x2f6cc8, hor: 0xa8d0ea, sun: 0xfff0d8 },
  dusk: { top: 0x3a4a8a, hor: 0xf3a66c, sun: 0xffb070 },
  night: { top: 0x070a1c, hor: 0x1c2446, sun: 0x8090c0 },
};
const _c1 = new THREE.Color(), _c2 = new THREE.Color();
function updateSky(o) {
  // 대기 모듈이 있으면 시간·실내 정보를 프리셋 보간으로 옮긴다
  if (window.ATMOS && ATMOS.ready) return ATMOS.legacy(o);
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
  GFX.scene.fog.density = o.fog ?? 0.0028;
  U.sunCol.value.set(sunUp ? (dusk > 0.4 ? SKY.dusk.sun : SKY.day.sun) : SKY.night.sun);
  U.stars.value = n; U.aurora.value = (o.aurora || 0) * n;
  GFX.sun.color.copy(U.sunCol.value);
  GFX.sun.intensity = sunUp ? lerp(1.55, 0.9, dusk) * (o.sunK ?? 1) : 0.28;
  GFX.hemi.color.set(n > 0.5 ? 0x5a6aa8 : 0xcfe8ff); GFX.hemi.groundColor.set(n > 0.5 ? 0x202838 : 0x5a6a3a);
  GFX.hemi.intensity = lerp(0.55, 0.28, n);
  GFX.amb.intensity = n * 0.12;
}

// ---------- 대기 모듈 불러오기 ----------
// index.html을 고치지 않아도 되도록, 문서를 읽는 중이면 gfx.js 바로 뒤에 대기 모듈과 그 의존 파일을 끼워 넣는다.
// (window.ATMOS_MANUAL = true 이면 페이지가 직접 넣는다고 보고 건너뛴다)
(function autoloadAtmos() {
  if (window.ATMOS || window.ATMOS_MANUAL) return;
  const me = document.currentScript;
  if (!me || !me.src || document.readyState !== 'loading') return;
  const base = new URL('..', me.src).href;
  const files = [];
  if (!THREE.EXRLoader) files.push('vendor/atmos-fflate.js', 'vendor/atmos-exrloader.js');
  if (!THREE.RoomEnvironment) files.push('vendor/atmos-roomenv.js');
  if (!THREE.SMAAPass) files.push('vendor/atmos-smaa-shader.js', 'vendor/atmos-smaa-pass.js');
  files.push('js/atmos.js');
  for (const f of files) document.write('<script src="' + base + f + '"><\/script>');
})();
