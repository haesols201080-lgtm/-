// New York at night, as seen from a detached house in the outer boroughs: the neighbours' houses (clapboard and
// shingle scans, porches, gutters, a few rooms still lit behind their curtains), the street with its lamps, conifers
// (the forest's own trees), lawns, and far off across the water the towers of Manhattan - setbacks, crowns, aviation
// lights blinking on the masts - with their reflections in the water and the city's glow on the clouds.
import * as THREE from 'three';
import { mulberry32 } from './util.js';

// a tower facade: floors of small windows, a few lit in runs; no mipmaps, so far away they stay points of light
export function facadeTexture(seed, W = 256, H = 512, litK = 0.06) {
  const R = mulberry32(seed), c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'); g.fillStyle = '#05060a'; g.fillRect(0, 0, W, H);
  const occ = Math.min(0.85, litK * 4.5);
  for (let y = 4; y < H - 4; y += 9) {
    // an occupied floor is lit almost end to end (one tint per floor), the others show a window here and there
    const busy = R() < occ, office = R() < 0.6, pLit = busy ? 0.8 : litK * 0.4;
    let run = 0, warm = !office;
    for (let x = 3; x < W - 4; x += 6) {
      if (run <= 0 && R() < pLit) { run = busy ? 3 + R() * 10 | 0 : 1 + R() * 3 | 0; if (!busy) warm = R() < 0.7; }
      const lit = run-- > 0, v = 0.75 + R() * 0.25;
      g.fillStyle = lit ? (warm ? `rgb(${255 * v | 0},${190 * v | 0},${110 * v | 0})` : `rgb(${215 * v | 0},${228 * v | 0},${255 * v | 0})`) : `rgb(${6 + R() * 6 | 0},${7 + R() * 6 | 0},${11 + R() * 8 | 0})`;
      g.fillRect(x, y, 4, 6);
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.generateMipmaps = false; t.minFilter = THREE.LinearFilter;
  return t;
}

const glowTex = (() => {
  let t = null;
  return () => {
    if (t) return t;
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,230,180,1)'); gr.addColorStop(0.2, 'rgba(255,200,130,0.5)'); gr.addColorStop(1, 'rgba(255,170,90,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  };
})();
export function glow(size, color = 0xffc68a, opacity = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  s.scale.setScalar(size); return s;
}
const shadeTex = (() => {
  let t = null;
  return () => {
    if (t) return t;
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const img = g.createImageData(128, 128);
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
      const dx = Math.max(0, Math.abs(x - 63.5) - 40) / 24, dy = Math.max(0, Math.abs(y - 63.5) - 40) / 24, k = Math.max(0, 1 - Math.hypot(dx, dy));
      const i = (y * 128 + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = 255 * k * k;
    }
    g.putImageData(img, 0, 0); t = new THREE.CanvasTexture(c); return t;
  };
})();
// a lit room seen through a window: warm light falling off toward the edges, the folds of a curtain on one side
const roomTex = (() => {
  const cache = {};
  return (k) => {
    if (cache[k]) return cache[k];
    const c = document.createElement('canvas'); c.width = 64; c.height = 96; const g = c.getContext('2d');
    const warm = k !== 'blue';
    const gr = g.createRadialGradient(28, 40, 4, 32, 48, 60); gr.addColorStop(0, warm ? '#ffd9a0' : '#c8dcff'); gr.addColorStop(0.5, warm ? '#c98a4a' : '#6f88b8'); gr.addColorStop(1, '#2a1a10');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 96);
    g.fillStyle = warm ? 'rgba(120,70,40,0.75)' : 'rgba(40,50,80,0.7)'; for (let i = 0; i < 6; i++) g.fillRect(i * 3, 0, 2, 96);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 70, 64, 26);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; cache[k] = t; return t;
  };
})();

// world-scale UVs on a box (u along the face's width, v up); `rot` turns the texture a quarter (planks that run across)
function boxGeo(w, h, d, tile = 1, rot = false) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
    const i = f * 4 + k, u = uv.getX(i) * dims[f][0] / tile, v = uv.getY(i) * dims[f][1] / tile;
    if (rot) uv.setXY(i, v, u); else uv.setXY(i, u, v);
  }
  return g;
}
function scan(T, color, extra = {}) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0, ...extra });
  if (T) { for (const t of [T.map, T.normal, T.orm]) t.wrapS = t.wrapT = THREE.RepeatWrapping; Object.assign(m, { map: T.map, normalMap: T.normal, roughnessMap: T.orm }); }
  return m;
}

// a conifer from the forest (its light version), bark and needles as in chapter 1
export function treeAt(A, key, x, y, z, s = 1, rot = 0) {
  const src = A.models['t_' + key]; if (!src) return null;
  const g = new THREE.Group();
  src.scene.traverse((o) => { if (o.isMesh) { const m = new THREE.Mesh(o.geometry, o.name.includes('bark') ? A.mats.hBark : A.mats.hTwig); m.castShadow = true; m.receiveShadow = true; g.add(m); } });
  g.position.set(x, y, z); g.rotation.y = rot; g.scale.setScalar(s); return g;
}

// one detached house, front toward +z of its own frame: foundation, clapboard, corner boards, gable roof with an
// overhang, gutters and a downspout, windows with frames, sills and (some) lit rooms, a porch with a lamp, a chimney
export function makeHouse(R, A, { w = 8, d = 10, h = 5.8, tint = 0xffffff, porchLight = true, shrubs = true } = {}) {
  const g = new THREE.Group(), T = A?.tex || {};
  const siding = scan(T.siding, tint, { envMapIntensity: 0.3 }), trim = new THREE.MeshStandardMaterial({ color: 0xece9e2, roughness: 0.55 });
  const roofM = scan(T.roof, [0x9a948c, 0x7a7672, 0x8f7868, 0x6f7580][R() * 4 | 0], { envMapIntensity: 0.2 }), conc = new THREE.MeshStandardMaterial({ color: 0x7d7a74, roughness: 0.95 });
  const brick = scan(T.brick, 0xb08070);
  const add = (geo, mat, x, y, z, ry = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = m.receiveShadow = true; g.add(m); return m; };
  const fh = 0.6;
  add(boxGeo(w + 0.1, fh, d + 0.1, 1), conc, 0, fh / 2, 0);
  add(boxGeo(w, h, d, 1.4, true), siding, 0, fh + h / 2, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(new THREE.BoxGeometry(0.12, h, 0.12), trim, sx * (w / 2 + 0.01), fh + h / 2, sz * (d / 2 + 0.01));
  // gable roof: two shingled slabs with an overhang, fascia boards, the gable ends in clapboard, gutters
  const rh = w * 0.36, ov = 0.45, top = fh + h, half = w / 2 + ov, slope = Math.atan2(rh, w / 2), L = half / Math.cos(slope);
  for (const s of [-1, 1]) {
    const slab = add(boxGeo(L, 0.12, d + ov * 2, 1.3), roofM, s * (half / 2 - ov * 0.0), top + (w / 2 - half / 2) * Math.tan(slope) + 0.04, 0); slab.rotation.z = -s * slope;
    add(new THREE.BoxGeometry(0.04, 0.18, d + ov * 2), trim, s * (half - 0.02), top - ov * Math.tan(slope) - 0.06, 0);
    const gut = add(new THREE.CylinderGeometry(0.06, 0.06, d + ov * 2, 8, 1, true), trim, s * (half + 0.03), top - ov * Math.tan(slope) - 0.08, 0); gut.rotation.x = Math.PI / 2;
  }
  const gable = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, rh)]);
  for (const s of [-1, 1]) {
    const gm = add(new THREE.ShapeGeometry(gable), siding, 0, top, s * (d / 2 + 0.005)); if (s < 0) gm.rotation.y = Math.PI;
    const uv = gm.geometry.attributes.uv, p = gm.geometry.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getY(i) / 1.4, p.getX(i) / 1.4);
  }
  add(new THREE.CylinderGeometry(0.045, 0.045, h, 8), trim, w / 2 + 0.06, fh + h / 2, d / 2 - 0.15);
  add(boxGeo(0.75, 2.4, 0.75, 0.9), brick, w * 0.22, top + rh * 0.55, -d * 0.12);
  // windows: recessed glass, a frame and a sill; about a third have a lit room behind the curtains
  const win = (x, y, z, ry) => {
    const f = new THREE.Group(); f.position.set(x, y, z); f.rotation.y = ry; g.add(f);
    const r = R(), lit = r < 0.3;
    const room = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 1.32), lit ? new THREE.MeshBasicMaterial({ map: roomTex(r < 0.05 ? 'blue' : 'warm'), color: new THREE.Color(0.85, 0.85, 0.85) }) : new THREE.MeshStandardMaterial({ color: 0x07080b, roughness: 1 }));
    room.position.z = 0.012; f.add(room);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 1.32), new THREE.MeshPhysicalMaterial({ color: 0x9fb0c0, roughness: 0.05, metalness: 0, transparent: true, opacity: lit ? 0.12 : 0.55, envMapIntensity: 1.4 })); glass.position.z = 0.022; f.add(glass);
    for (const [fx, fy, fw, fhh] of [[-0.5, 0, 0.09, 1.5], [0.5, 0, 0.09, 1.5], [0, 0.72, 1.09, 0.09], [0, 0, 1.0, 0.05]]) { const t = new THREE.Mesh(new THREE.BoxGeometry(fw, fhh, 0.08), trim); t.position.set(fx, fy, 0.04); f.add(t); }
    const sill = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.16), trim); sill.position.set(0, -0.72, 0.08); f.add(sill);
    if (lit) { const gl = glow(1.8, 0xffbe7a, 0.12); gl.position.z = 0.4; f.add(gl); }
  };
  for (const [wy, xs] of [[fh + 1.5, [-w * 0.3, w * 0.3]], [fh + h - 1.3, [-w * 0.3, 0, w * 0.3]]]) for (const x of xs) win(x, wy, d / 2 + 0.005, 0);
  for (const [wy, zs] of [[fh + 1.5, [-d * 0.25, d * 0.15]], [fh + h - 1.3, [-d * 0.25, d * 0.15]]]) for (const z of zs) { win(w / 2 + 0.005, wy, z, Math.PI / 2); win(-w / 2 - 0.005, wy, z, -Math.PI / 2); }
  // porch: a deck on the foundation, steps, two posts, a little roof, the door, the lamp
  const pw = 3.2, pd = 1.8;
  add(boxGeo(pw, fh, pd, 1), conc, 0, fh / 2, d / 2 + pd / 2);
  for (let i = 0; i < 3; i++) add(boxGeo(1.6, fh / 3, 0.3, 1), conc, 0, fh / 6 + i * fh / 3, d / 2 + pd + 0.45 - i * 0.3);
  for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.14, 2.5, 0.14), trim, sx * (pw / 2 - 0.1), fh + 1.25, d / 2 + pd - 0.1);
  add(boxGeo(pw + 0.3, 0.12, pd + 0.2, 1.3), roofM, 0, fh + 2.55, d / 2 + pd / 2 + 0.05).rotation.x = 0.12;
  const door = add(new THREE.BoxGeometry(0.95, 2.1, 0.06), new THREE.MeshStandardMaterial({ color: [0x3b2a20, 0x24324a, 0x6a2420, 0x2f3b2c][R() * 4 | 0], roughness: 0.5 }), 0, fh + 1.05, d / 2 + 0.03);
  door.castShadow = false;
  if (porchLight) {
    const lamp = add(new THREE.BoxGeometry(0.16, 0.26, 0.12), new THREE.MeshBasicMaterial({ color: 0xffd9a0 }), 0.75, fh + 2.0, d / 2 + 0.08); lamp.castShadow = false;
    const gl = glow(1.8, 0xffc07a, 0.9); gl.position.set(0.75, fh + 2.0, d / 2 + 0.25); g.add(gl);
    // its light on the siding and the porch floor
    const wash = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), new THREE.MeshBasicMaterial({ map: glowTex(), color: 0xff9a50, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending }));
    wash.position.set(0.75, fh + 1.7, d / 2 + 0.03); g.add(wash);
  }
  // the house sits in its own shade on the lawn (soft contact shadow), evergreen shrubs along the front
  const cs = new THREE.Mesh(new THREE.PlaneGeometry(w + 3, d + 4.5), new THREE.MeshBasicMaterial({ map: shadeTex(), color: 0x000000, transparent: true, opacity: 0.55, depthWrite: false }));
  cs.rotation.x = -Math.PI / 2; cs.position.set(0, 0.012, 0.6); g.add(cs);
  if (shrubs && A) for (let i = 0; i < 4; i++) {
    const sx = (i < 2 ? -1 : 1) * (pw / 2 + 0.6 + (i % 2) * (w / 2 - pw / 2 - 0.8));
    const t = treeAt(A, R() < 0.5 ? 'fir_14' : 'fir_4', sx, 0, d / 2 + 0.55 + R() * 0.2, 0.1 + R() * 0.06, R() * 6.28); if (t) g.add(t);
  }
  return g;
}

// the skyline, built at its real size 1.4-2.2 km away and drawn at a fifth of that (same size on screen, inside the
// far plane): towers with setbacks and crowns, a stepped art-deco spire, aviation lights; its reflection in the water
export function buildSkyline(R, { k = 0.2, dir = 0, span = 1.25, waterNear = 350 } = {}) {
  const root = new THREE.Group(); root.scale.setScalar(k);
  const city = new THREE.Group(); root.add(city);
  const facades = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => facadeTexture(700 + i, 256, 512, [0.02, 0.05, 0.08, 0.12, 0.03, 0.16, 0.06, 0.1][i - 1]));
  const blink = [];
  const block = (x, y, z, w, h, dd, f, inten = 1.7) => {
    const tex = facades[f % 8].clone(); tex.needsUpdate = true; tex.repeat.set(w / 16, h / 22);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, dd), new THREE.MeshStandardMaterial({ color: 0x0b0d12, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: inten, roughness: 0.7, fog: false }));
    m.position.set(x, y + h / 2, z); city.add(m); return m;
  };
  const tower = (x, z, w, h, f) => {
    // one to three setbacks, sometimes a pyramid crown, often a mast with a red light
    let y = -8, ww = w;
    const tiers = R() < 0.45 ? 1 : R() < 0.7 ? 2 : 3;
    for (let t = 0; t < tiers; t++) {
      const hh = t === tiers - 1 ? (h - (y + 8)) : (h - (y + 8)) * (0.55 + R() * 0.2);
      if (hh < 6) break;
      block(x, y, z, ww, hh, ww * (0.7 + R() * 0.3), f + t); y += hh; ww *= 0.72;
    }
    if (R() < 0.18) { const cr = new THREE.Mesh(new THREE.ConeGeometry(ww * 0.7, ww * 1.2, 4), new THREE.MeshStandardMaterial({ color: 0x0b0d12, emissive: [0x9fb4ff, 0xffd59a, 0xe8f0ff][R() * 3 | 0], emissiveIntensity: 0.16, fog: false })); cr.position.set(x, y + ww * 0.6, z); cr.rotation.y = Math.PI / 4; city.add(cr); y += ww * 1.2; }
    if (R() < 0.55) { const ah = 25 + R() * 30; const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.2, ah, 6), new THREE.MeshStandardMaterial({ color: 0x15161a, fog: false })); ant.position.set(x, y + ah / 2, z); city.add(ant);
      const red = glow(16, 0xff2a1a, 1); red.position.set(x, y + ah, z); city.add(red); blink.push({ s: red, ph: R() * 6.28, f: 0.8 + R() * 0.6 }); }
  };
  for (let i = 0; i < 96; i++) {
    const a = dir - span / 2 + (i / 96) * span + (R() - 0.5) * 0.02, dist = 1400 + R() * 700;
    tower(Math.sin(a) * dist, Math.cos(a) * dist, 26 + R() * 40, 60 + Math.pow(R(), 1.7) * 300, i);
  }
  // the spire: three setbacks and a lit mast
  { const a = dir - 0.05, x = Math.sin(a) * 1650, z = Math.cos(a) * 1650;
    block(x, -8, z, 70, 260, 50, 1); block(x, 252, z, 48, 70, 36, 2); block(x, 322, z, 30, 50, 24, 3);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(6, 12, 30, 8), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xd8e0ff, emissiveIntensity: 0.6, fog: false })); top.position.set(x, 387, z); city.add(top);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 4, 60, 8), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xd8e0ff, emissiveIntensity: 0.4, fog: false })); mast.position.set(x, 432, z); city.add(mast);
    const red = glow(30, 0xff3a2a, 1); red.position.set(x, 466, z); city.add(red); blink.push({ s: red, ph: 0, f: 1 }); }
  // the city's glow low over the towers
  const haze = new THREE.Mesh(new THREE.PlaneGeometry(9000, 600), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec2 vU; void main(){ float a = pow(1.0 - vU.y, 2.4) * 0.3 * smoothstep(0.0, 0.25, vU.x) * smoothstep(1.0, 0.75, vU.x); gl_FragColor = vec4(vec3(1.0, 0.62, 0.36) * a, 1.0); }' }));
  haze.position.set(Math.sin(dir) * 2250, 250, Math.cos(dir) * 2250); haze.rotation.y = dir + Math.PI; root.add(haze);
  // the water, and the city reflected in it (a mirrored, dimmed copy under a dark, slightly shiny surface)
  const refl = city.clone(); refl.scale.y = -1; refl.position.y = -18;
  refl.traverse((o) => { if (o.material?.emissiveIntensity) { o.material = o.material.clone(); o.material.emissiveIntensity *= 0.45; } if (o.isSprite) { o.material = o.material.clone(); o.material.opacity = 0.4; } });
  root.add(refl);
  const wd = 1750 - waterNear, wc = waterNear + wd / 2;
  const water = new THREE.Mesh(new THREE.PlaneGeometry(9000, wd), new THREE.MeshPhysicalMaterial({ color: 0x03050a, roughness: 0.25, metalness: 0.3, transparent: true, opacity: 0.72, envMapIntensity: 0.6, fog: false }));
  water.rotation.x = -Math.PI / 2; water.rotation.z = -dir; water.position.set(Math.sin(dir) * wc, -9, Math.cos(dir) * wc); root.add(water);
  root.userData.update = (t) => { for (const b of blink) b.s.material.opacity = Math.sin(t * b.f * 3.2 + b.ph) > 0.3 ? 1 : 0.08; };
  return root;
}

// a night sky with low cloud, lit orange from below by the city
export function nightSky(radius = 380) {
  return new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 24), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec3 vP;
      float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
      float fbm(vec2 p){ float a = 0.0, w = 0.5; for (int i = 0; i < 5; i++) { a += w * n2(p); p *= 2.03; w *= 0.5; } return a; }
      void main(){ vec3 d = normalize(vP); float h = d.y;
        vec3 top = vec3(0.01, 0.014, 0.03), mid = vec3(0.04, 0.045, 0.08), low = vec3(0.3, 0.19, 0.12);
        float city = 0.55 + 0.45 * smoothstep(-0.3, 1.0, d.z);
        vec3 c = mix(mid, top, smoothstep(0.05, 0.7, h)); c = mix(c, low, smoothstep(0.16, -0.02, h) * city);
        vec2 uv = d.xz / max(0.08, h + 0.12) * 0.9;
        float cl = smoothstep(0.48, 0.8, fbm(uv * 1.3 + 3.0)) * smoothstep(0.02, 0.18, h) * smoothstep(0.85, 0.3, h);
        c = mix(c, vec3(0.24, 0.16, 0.11) * (0.5 + city * 0.8), cl * 0.75);
        gl_FragColor = vec4(c, 1.0); }` }));
}

export function buildNeighborhood(scene, A, { seed = 7 } = {}) {
  const R = mulberry32(seed), root = new THREE.Group(); scene.add(root);
  const sky = nightSky(); sky.renderOrder = -10; root.add(sky);
  const T = A.tex;
  // lawns everywhere, the street in front (north) with its kerbs and pavements
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), scan(T.lawn, 0x6f7f5c, { envMapIntensity: 0.2 })); lawn.rotation.x = -Math.PI / 2; lawn.position.y = -0.62; lawn.receiveShadow = true;
  { const uv = lawn.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 100, uv.getY(i) * 100); }
  root.add(lawn);
  const asphalt = scan(T.asphalt, 0x8a8886, { envMapIntensity: 0.5 }), walk = scan(T.pavement, 0xb0aca4, { envMapIntensity: 0.3 }), kerbM = new THREE.MeshStandardMaterial({ color: 0x6c6964, roughness: 0.9 });
  const street = new THREE.Mesh(boxGeo(200, 0.02, 9, 4.5), asphalt); street.position.set(0, -0.61, -17); street.receiveShadow = true; root.add(street);
  for (const z of [-11.8, -22.2]) {
    const s = new THREE.Mesh(boxGeo(200, 0.15, 2.2, 1.6), walk); s.position.set(0, -0.6, z); s.receiveShadow = true; root.add(s);
    const k = new THREE.Mesh(new THREE.BoxGeometry(200, 0.17, 0.16), kerbM); k.position.set(0, -0.6, z + (z > -17 ? -1.15 : 1.15)); k.receiveShadow = true; root.add(k);
  }
  // wooden utility poles along the far kerb, the wires sagging between them (the outer boroughs)
  const woodM = new THREE.MeshStandardMaterial({ color: 0x3e3127, roughness: 0.95 }), wireM = new THREE.MeshBasicMaterial({ color: 0x050505 });
  const poles = [];
  for (let x = -48; x <= 48; x += 32) {
    const pz = -23.6, ph = 10.5;
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, ph, 10), woodM); p.position.set(x, -0.6 + ph / 2, pz); p.castShadow = true; root.add(p);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 2.2), woodM); arm.position.set(x, ph - 1.6, pz); root.add(arm);
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.8, 12), new THREE.MeshStandardMaterial({ color: 0x55595c, roughness: 0.6, metalness: 0.5 })); tr.position.set(x + 0.4, ph - 3.2, pz); root.add(tr);
    poles.push([x, ph - 1.55, pz]);
  }
  for (let i = 0; i < poles.length - 1; i++) for (const dz of [-0.9, 0, 0.9]) {
    const [x0, y0, z0] = poles[i], x1 = poles[i + 1][0], pts = [];
    for (let k = 0; k <= 16; k++) { const u = k / 16; pts.push(new THREE.Vector3(x0 + (x1 - x0) * u, y0 - 0.9 * 4 * u * (1 - u), z0 + dz)); }
    root.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.012, 4), wireM));
  }
  // the neighbours: across the street, beside us, behind the backyard (with a gap: the view south goes to Manhattan)
  const tints = [0xffffff, 0xd6e2ec, 0xf1e3c6, 0xdcc9b4, 0xe8e6de, 0xc9d3c0, 0xb9c4cf];
  const place = (x, z, ry, near) => { const hs = makeHouse(R, A, { w: 7 + R() * 2.5, d: 9 + R() * 2, h: 5.6 + R() * 1.0, tint: tints[R() * tints.length | 0], porchLight: R() < 0.8 || near }); hs.position.set(x, -0.6, z); hs.rotation.y = ry; root.add(hs); return hs; };
  for (let x = -40; x <= 40; x += 11 + R() * 2) place(x, -30, 0);
  place(-15.5, 0.5, Math.PI / 2, true); place(15.5, 0.5, -Math.PI / 2, true);
  for (let x = -44; x <= 44; x += 11 + R() * 2) if (Math.abs(x) > 17) place(x, 31, Math.PI);
  // street lamps along the near kerb (cobra heads), their pools of light on the road
  const pole = new THREE.MeshStandardMaterial({ color: 0x3a3c3e, roughness: 0.5, metalness: 0.7 });
  for (let x = -36; x <= 36; x += 18) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 7.4, 10), pole); p.position.set(x, 3.1, -12.6); root.add(p);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 8), pole); arm.rotation.x = Math.PI / 2; arm.position.set(x, 6.7, -13.3); root.add(arm);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.7), pole); head.position.set(x, 6.7, -14.1); root.add(head);
    const lens = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.6), new THREE.MeshBasicMaterial({ color: 0xffc98a })); lens.rotation.x = Math.PI / 2; lens.position.set(x, 6.63, -14.1); root.add(lens);
    const gl = glow(4.5, 0xffb870, 0.8); gl.position.set(x, 6.5, -14.1); root.add(gl);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(11, 11), new THREE.MeshBasicMaterial({ map: glowTex(), color: 0xff9a50, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending })); pool.rotation.x = -Math.PI / 2; pool.position.set(x, -0.58, -15.2); root.add(pool);
  }
  // conifers in the yards and along the street (the forest's own trees)
  const keys = ['pine_0', 'pine_2', 'fir_4', 'fir_14'];
  const spots = [[-9.6, -9.8], [-24, -10.2], [22, -9.9], [-30, 16], [-20, 22], [24, 18], [32, 22], [-7.5, 12.5], [-36, -36], [30, -37], [16, -38]];
  for (const [x, z] of spots) { const t = treeAt(A, keys[R() * 4 | 0], x, -0.62, z, 0.75 + R() * 0.4, R() * 6.28); if (t) root.add(t); }
  // the neighbours' backyard fences (weathered boards)
  const fenceM = new THREE.MeshStandardMaterial({ color: 0x5e5244, roughness: 0.95 });
  for (const [x0, x1, z] of [[-20, -3.2, 18.6], [3.2, 20, 18.6]]) { const f = new THREE.Mesh(boxGeo(x1 - x0, 1.7, 0.04, 1), fenceM); f.position.set((x0 + x1) / 2, 0.25, z); f.castShadow = f.receiveShadow = true; root.add(f); }
  const sky2 = buildSkyline(R, { k: 0.2, dir: 0 }); root.add(sky2);
  root.userData.update = (t) => sky2.userData.update(t);
  return root;
}
