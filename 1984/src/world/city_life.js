// Everything that makes the streets feel lived in: litter and stains, puddles,
// weeds on the bomb sites, washing over the prole yards, crates and barrels,
// red banners on the Ministry and round the square, chimney smoke, pigeons,
// parked lorries, and people: commuters, proles on their doorsteps, a queue
// at the greengrocer's, children on the waste ground, the Thought Police.
import * as THREE from 'three';
import { decalAtlas, DECAL, plantAtlas, PLANT, washingAtlas, flagTexture, glowTexture } from './city_paint.js';
import { rng, tf, crossQuads, standingQuad } from './city_util.js';

const PI = Math.PI, H = PI / 2;

// An instanced mesh whose instances each show one cell of a texture atlas.
function atlasInstances(geo, mat, rects, matrices, extraShader) {
  const n = matrices.length;
  const g = geo.clone();
  const a = new Float32Array(n * 4);
  rects.forEach((r, i) => a.set(r, i * 4));
  g.setAttribute('aRect', new THREE.InstancedBufferAttribute(a, 4));
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aRect;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv = aRect.xy + vMapUv * aRect.zw;\n#endif');
    if (extraShader) extraShader(sh);
  };
  const im = new THREE.InstancedMesh(g, mat, n);
  matrices.forEach((m, i) => im.setMatrixAt(i, m));
  im.instanceMatrix.needsUpdate = true;
  im.computeBoundingSphere();
  return im;
}

const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(), E = new THREE.Euler();
const mat4 = (x, y, z, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0) => {
  E.set(rx, ry, 0, 'YXZ'); Q.setFromEuler(E); V.set(x, y, z); S.set(sx, sy, sz);
  return new THREE.Matrix4().compose(V, Q, S);
};

// sway the top of a cloth or plant with the wind
const swayShader = (amount, axis = 'x') => (sh) => {
  sh.uniforms.uTime = window.G ? window.G.mats.globals.uTime : { value: 0 };
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nuniform float uTime;')
    .replace('#include <begin_vertex>', `#include <begin_vertex>
      vec4 ipos = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      float k = ${axis === 'down' ? '1.0 - uv.y' : 'uv.y'};
      float s = sin(uTime * 1.7 + ipos.x * 0.37 + ipos.z * 0.21) * 0.6 + sin(uTime * 3.3 + ipos.x) * 0.25;
      transformed.z += s * ${amount.toFixed(3)} * k * k;
      transformed.x += s * ${(amount * 0.4).toFixed(3)} * k;`);
};

export function addCityLife(G, ctx, root) {
  const { map, spots } = ctx;
  const r = rng(1949);
  const ground = (x, z) => map.height(x, z);

  // ---- litter: newspapers, packets, fag ends, cabbage leaves, oil and damp
  {
    const atlas = decalAtlas();
    const mat = new THREE.MeshStandardMaterial({ map: atlas.tex, alphaTest: 0.35, roughness: 0.9, transparent: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
    const geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-H);
    const rects = [], mats = [];
    const kinds = [
      [DECAL.newspaper, 0.6, 9], [DECAL.crumpled, 0.25, 10], [DECAL.scrap, 0.3, 12], [DECAL.packet, 0.12, 8], [DECAL.butts, 0.4, 10],
      [DECAL.leaves, 0.7, 8], [DECAL.cabbage, 0.35, 4], [DECAL.glass, 0.4, 3], [DECAL.oil, 1.6, 6], [DECAL.damp, 2.2, 8],
      [DECAL.soot, 1.4, 4], [DECAL.tar, 1.2, 5], [DECAL.rag, 0.45, 3], [DECAL.coupon, 0.15, 4],
    ];
    const total = kinds.reduce((s, k) => s + k[2], 0);
    const pickKind = () => { let u = r() * total; for (const k of kinds) { u -= k[2]; if (u <= 0) return k; } return kinds[0]; };
    // more rubbish where people are and in the prole quarter
    const areas = [
      [-16, -8, -8.5, 258, 700], [8.5, -8, 16, 258, 700],          // avenue pavements and gutters
      [-55, -100, 55, -10, 700],                                   // the square
      [-200, 47, 60, 73, 400], [-200, 188, 20, 214, 250],          // Mansions and Station roads
      [-185, -111, -55, -87, 200],                                 // Love Lane
      [55, -12, 335, 312, 2600],                                   // the prole quarter
    ];
    for (const [x0, z0, x1, z1, n] of areas) {
      for (let i = 0; i < n; i++) {
        const x = x0 + r() * (x1 - x0), z = z0 + r() * (z1 - z0);
        const [kind, size] = pickKind();
        const s = size * (0.7 + r() * 0.7);
        rects.push(atlas.rect(kind));
        mats.push(mat4(x, ground(x, z) + 0.012 + r() * 0.004, z, r() * 6.28, s, 1, s));
      }
    }
    // the manholes and gratings in the carriageways
    for (let z = -6; z < 258; z += 19) {
      rects.push(atlas.rect(DECAL.manhole)); mats.push(mat4(r() < 0.5 ? -4 : 4, 0.012, z, 0, 0.9, 1, 0.9));
      rects.push(atlas.rect(DECAL.grate)); mats.push(mat4(8.2, 0.012, z + 7, 0, 0.5, 1, 0.9));
      rects.push(atlas.rect(DECAL.grate)); mats.push(mat4(-8.2, 0.012, z + 11, PI, 0.5, 1, 0.9));
    }
    const im = atlasInstances(geo, mat, rects, mats);
    im.receiveShadow = true;
    im.name = 'litter';
    root.add(im);
  }

  // ---- puddles: London never quite dries
  {
    const geo = new THREE.CircleGeometry(1, 20); geo.rotateX(-H);
    const mat = new THREE.MeshStandardMaterial({ color: 0x0b0c0d, roughness: 0.03, metalness: 0.0, envMapIntensity: 1.8,
      transparent: true, opacity: 0.88, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6, depthWrite: false });
    const mats = [];
    const spots2 = [[-9, -6, 9, 258, 90], [-55, -100, 55, -10, 50], [55, -12, 335, 312, 260], [-200, 47, 60, 73, 40]];
    for (const [x0, z0, x1, z1, n] of spots2) {
      for (let i = 0; i < n; i++) {
        const x = x0 + r() * (x1 - x0), z = z0 + r() * (z1 - z0);
        mats.push(mat4(x, ground(x, z) + 0.008, z, r() * 6.28, 0.6 + r() * 2.2, 1, 0.4 + r() * 1.2));
      }
    }
    const im = new THREE.InstancedMesh(geo, mat, mats.length);
    mats.forEach((m, i) => im.setMatrixAt(i, m));
    im.computeBoundingSphere();
    im.renderOrder = 2;
    im.name = 'puddles';
    root.add(im);
    G.onUpdate(() => { mat.opacity = 0.55 + G.mats.globals.uWet.value * 0.4; });
  }

  // ---- weeds: rosebay willow-herb straggling over the rubble
  {
    const atlas = plantAtlas();
    const mat = new THREE.MeshStandardMaterial({ map: atlas.tex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85 });
    const geo = crossQuads(1, 1);
    const rects = [], mats = [];
    const addClump = (x, z, big = 1) => {
      const k = r();
      const kind = k < 0.35 ? PLANT.herb : k < 0.5 ? PLANT.herb_young : k < 0.62 ? PLANT.stalks : k < 0.74 ? PLANT.nettle : k < 0.88 ? PLANT.grass : k < 0.94 ? PLANT.buddleia : k < 0.97 ? PLANT.thistle : PLANT.dandelion;
      const h = (kind === PLANT.herb || kind === PLANT.buddleia ? 1.3 : kind === PLANT.grass ? 0.5 : 0.8) * (0.6 + r() * 0.7) * big;
      rects.push(atlas.rect(kind));
      mats.push(mat4(x, ground(x, z) - 0.02, z, r() * 6.28, h * 0.55, h, h * 0.55));
    };
    for (const b of spots.bombsites) {
      const c = b.f.w((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2);
      const rx = Math.abs(b.x1 - b.x0) / 2, rz = Math.abs(b.z1 - b.z0) / 2;
      for (let i = 0; i < 40; i++) addClump(c.x + (r() - 0.5) * rx * 2, c.z + (r() - 0.5) * rz * 2, 1.1);
    }
    for (const y of spots.yards) {
      for (let i = 0; i < 6; i++) { const p = y.f.w(y.x0 + r() * (y.x1 - y.x0), y.z0 + r() * (y.z1 - y.z0)); addClump(p.x, p.z, 0.8); }
    }
    // the bomb site on the avenue and the waste ground opposite
    for (let i = 0; i < 160; i++) addClump(-24 + (r() - 0.5) * 16, 126 + (r() - 0.5) * 16, 1.2);
    for (let i = 0; i < 120; i++) addClump(25 + (r() - 0.5) * 16, 125 + (r() - 0.5) * 24, 1.0);
    // grass in the cracks at the foot of walls
    for (const g of spots.gables) for (let i = 0; i < 4; i++) addClump(g.x + (r() - 0.5) * 3, g.z + (r() - 0.5) * 3, 0.5);
    const im = atlasInstances(geo, mat, rects, mats, swayShader(0.08));
    im.castShadow = true; im.receiveShadow = true;
    im.name = 'weeds';
    root.add(im);
  }

  // ---- washing hung across the prole yards
  {
    const atlas = washingAtlas();
    const mat = new THREE.MeshStandardMaterial({ map: atlas.tex, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.95 });
    const geo = new THREE.PlaneGeometry(1, 1); geo.translate(0, -0.5, 0);
    const rects = [], mats = [];
    const lines = [];
    for (const y of spots.yards) {
      if (r() < 0.45 || y.ruin) continue;
      const z = (y.z0 + y.z1) / 2;
      const a = y.f.w(y.x0 + 1, z), b = y.f.w(y.x1 - 1, z);
      const hgt = 2.4;
      lines.push([a, b, hgt]);
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      const n = Math.floor(len / 0.9);
      const rot = Math.atan2(-(b.z - a.z), b.x - a.x);
      for (let i = 0; i < n; i++) {
        if (r() < 0.3) continue;
        const t = (i + 0.5) / n;
        const x = a.x + (b.x - a.x) * t, zz = a.z + (b.z - a.z) * t;
        const w = 0.5 + r() * 0.35;
        rects.push(atlas.rect(Math.floor(r() * 8)));
        const sag = Math.sin(t * PI) * 0.18;
        mats.push(mat4(x, ground(x, zz) + hgt - sag, zz, rot, w, w * atlas.aspect, 1));
      }
    }
    if (mats.length) {
      const im = atlasInstances(geo, mat, rects, mats, swayShader(0.18, 'down'));
      im.castShadow = true;
      im.name = 'washing';
      root.add(im);
      // the lines and their posts
      const lineMat = new THREE.LineBasicMaterial({ color: 0x2a2620 });
      const pts = [];
      for (const [a, b, h] of lines) { pts.push(a.x, ground(a.x, a.z) + h, a.z, b.x, ground(b.x, b.z) + h, b.z); }
      const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      root.add(new THREE.LineSegments(lg, lineMat));
    }
  }

  // ---- crates, barrels and dustbins by the prole doors
  {
    const wood = G.mats.get('wood'), rust = G.mats.get('rust'), metal = G.mats.get('metal');
    const crate = new THREE.BoxGeometry(0.6, 0.45, 0.45);
    const barrel = new THREE.CylinderGeometry(0.3, 0.3, 0.88, 14);
    const dustbin = new THREE.CylinderGeometry(0.28, 0.26, 0.75, 14);
    const cm = [], bm = [], dm = [];
    for (const d of spots.doorsteps) {
      if (r() < 0.55) continue;
      const side = r() < 0.5 ? -1 : 1;
      const p = tf(d.x, d.z, d.rot, side * (1.1 + r() * 0.6), 0.7 + r() * 0.5);
      const k = r();
      if (k < 0.45) { cm.push(mat4(p.x, ground(p.x, p.z) + 0.225, p.z, r() * PI)); if (r() < 0.4) cm.push(mat4(p.x, ground(p.x, p.z) + 0.675, p.z, r() * PI, 0.9, 0.9, 0.9)); }
      else if (k < 0.7) bm.push(mat4(p.x, ground(p.x, p.z) + 0.44, p.z, r() * PI));
      else dm.push(mat4(p.x, ground(p.x, p.z) + 0.375, p.z, r() * PI));
    }
    for (const [geo, mt, list] of [[crate, wood, cm], [barrel, rust, bm], [dustbin, metal, dm]]) {
      if (!list.length) continue;
      const im = new THREE.InstancedMesh(geo, mt, list.length);
      list.forEach((m, i) => im.setMatrixAt(i, m));
      im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere();
      root.add(im);
    }
  }

  // ---- banners: long red Ingsoc cloths on the Ministry and the square
  {
    const tex = flagTexture(G);
    const mat = new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.85 });
    const geo = new THREE.PlaneGeometry(1, 1); geo.translate(0, -0.5, 0);
    const mats = [];
    // Ministry of Truth: down the front terraces
    for (const x of [-60, -36, 36, 60]) mats.push(mat4(x, 30, -114.3, 0, 7, 24, 1));
    // round Victory Square, on the blocks that face it
    for (const z of [-80, -64, -48, -32]) mats.push(mat4(-62.6, 22, z, H, 4, 13, 1));
    for (const x of [-48, -28, 28, 48]) mats.push(mat4(x, 18, -4.6, PI, 4, 11, 1));
    for (const z of [-30, -12]) mats.push(mat4(62.6, 16, z, -H, 3.6, 10, 1));
    // the avenue
    for (const z of [40, 110, 170]) { mats.push(mat4(-16.6, 20, z, H, 3, 10, 1)); mats.push(mat4(16.6, 20, z + 30, -H, 3, 10, 1)); }
    const im = atlasInstances(geo, mat, mats.map(() => [0, 0, 1, 1]), mats, swayShader(0.25, 'down'));
    im.castShadow = true; im.receiveShadow = true;
    im.name = 'banners';
    root.add(im);
  }

  // ---- chimney smoke over the prole quarter
  {
    const tex = glowTexture('rgba(150,148,142,1)', 64, 1.6);
    const sources = [];
    for (const y of spots.yards) { if (r() < 0.4) continue; const p = y.f.w(y.x0 + r() * (y.x1 - y.x0), -4); sources.push(new THREE.Vector3(p.x, 11.5, p.z)); }
    const N = sources.length * 6;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3), seed = new Float32Array(N);
    for (let i = 0; i < N; i++) { const s = sources[i % sources.length]; pos.set([s.x, s.y, s.z], i * 3); seed[i] = r(); }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: true,
      uniforms: { uTime: G.mats.globals.uTime, uTex: { value: tex }, uLight: { value: new THREE.Color(0.6, 0.6, 0.6) }, fogColor: { value: new THREE.Color() }, fogDensity: { value: 0 } },
      vertexShader: `attribute float aSeed; uniform float uTime; varying float vA;
        #include <fog_pars_vertex>
        void main(){
          float t = fract(uTime * 0.05 + aSeed);
          vec3 p = position + vec3(t * 6.0 + sin(aSeed * 40.0 + uTime) * 0.6, t * 9.0, t * 2.0);
          vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          gl_PointSize = (2.0 + t * 7.0) * 300.0 / max(0.5, -mvPosition.z);
          vA = (1.0 - t) * smoothstep(0.0, 0.1, t) * 0.35;
          #include <fog_vertex>
        }`,
      fragmentShader: `uniform sampler2D uTex; uniform vec3 uLight; varying float vA;
        #include <fog_pars_fragment>
        void main(){ vec4 c = texture2D(uTex, gl_PointCoord); gl_FragColor = vec4(uLight, c.a * vA);
          #include <fog_fragment>
        }`,
    });
    mat.uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, mat.uniforms]);
    mat.uniforms.uTime = G.mats.globals.uTime;
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    pts.name = 'smoke';
    root.add(pts);
    G.onUpdate(() => { const d = G.atmos.day ?? 1; mat.uniforms.uLight.value.setRGB(0.25 + d * 0.4, 0.25 + d * 0.4, 0.26 + d * 0.4); });
  }

  // ---- pigeons on the square, scattering when you come near
  {
    const N = 70;
    const geo = new THREE.SphereGeometry(0.12, 8, 6); geo.scale(1, 0.75, 1.5);
    const mat = new THREE.MeshStandardMaterial({ color: 0x55585e, roughness: 0.8 });
    const im = new THREE.InstancedMesh(geo, mat, N);
    im.castShadow = true;
    const birds = [];
    for (let i = 0; i < N; i++) {
      const flock = i % 3;
      const c = [[-12, -30], [14, -70], [0, -100]][flock];
      birds.push({ home: new THREE.Vector3(c[0] + (r() - 0.5) * 8, 0.1, c[1] + (r() - 0.5) * 8), p: new THREE.Vector3(), fly: 0, t: r() * 10, a: r() * 6.28 });
    }
    birds.forEach((b) => b.p.copy(b.home));
    im.frustumCulled = false;
    root.add(im);
    G.onUpdate((dt) => {
      if (G.state.location !== 'city') return;
      const pl = G.player.pos;
      for (let i = 0; i < N; i++) {
        const b = birds[i];
        b.t += dt;
        const d = Math.hypot(pl.x - b.p.x, pl.z - b.p.z);
        if (d < 4 && b.fly <= 0) b.fly = 6 + r() * 4;
        if (b.fly > 0) {
          b.fly -= dt;
          b.a += dt * 1.2;
          b.p.set(b.home.x + Math.cos(b.a) * 14, 6 + Math.sin(b.t * 2) * 2 + b.fly, b.home.z + Math.sin(b.a) * 14);
          if (b.fly <= 0) b.p.copy(b.home);
        } else {
          b.p.x += Math.sin(b.t * 0.7 + i) * dt * 0.15; b.p.z += Math.cos(b.t * 0.5 + i) * dt * 0.15;
        }
        const peck = b.fly > 0 ? 0 : Math.max(0, Math.sin(b.t * 6 + i)) * 0.3;
        im.setMatrixAt(i, mat4(b.p.x, b.p.y + 0.1, b.p.z, b.a + b.t * 0.2, 1, 1, 1, peck));
      }
      im.instanceMatrix.needsUpdate = true;
    });
  }

  // ---- people
  if (G.npcs) addPeople(G, ctx, r);
}

function addPeople(G, ctx, r) {
  const { spots } = ctx;
  const P = (x, z, model, anim, yaw, o = {}) => {
    const n = G.npcs.spawn({ model, location: 'city', x, z, yaw, anim, ...o });
    if (n) { n.ambient = true; n.root.rotation.y = yaw; }
    return n;
  };
  const party = ['char_party_man', 'char_party_man_b', 'char_party_woman', 'char_syme', 'char_parsons', 'char_winston'];
  const proles = ['char_prole_man', 'char_prole_woman', 'char_charrington', 'char_prole_woman', 'char_prole_man'];
  // walkers on the pavements: the commute
  const w = G.world;
  G.ambientCrowd = G.npcs.crowd('city', { paths: ['avenue_w', 'avenue_e', 'square_loop', 'commute', 'mansions_road', 'station_road'], count: 54, models: party });
  G.ambientProles = G.npcs.crowd('city', { paths: ['prole_a', 'prole_b'], count: 22, models: proles });
  // proles chatting on their doorsteps, women gossiping in pairs
  let n = 0;
  for (const d of spots.doorsteps) {
    if (r() < 0.78 || n > 34) continue;
    n++;
    const out = d.rot;
    const a = tf(d.x, d.z, d.rot, 0, 1.1), b = tf(d.x, d.z, d.rot, 0.9, 1.6);
    const p1 = P(a.x, a.z, proles[n % proles.length], r() < 0.5 ? 'talk' : 'idle', out + 0.9);
    const p2 = P(b.x, b.z, proles[(n + 1) % proles.length], 'idle', out - 2.2);
    if (p1 && p2) { p1.lookAt(p2.root.position.clone().setY(1.6)); p2.lookAt(p1.root.position.clone().setY(1.6)); }
  }
  // the queue at the greengrocer's
  for (let i = 0; i < 9; i++) P(236 - 4 + i * 0.75, 153.2 + (i % 2) * 0.15, proles[i % proles.length], 'idle', -H);
  // outside the pub
  for (let i = 0; i < 4; i++) P(95 - 3 + i * 1.1, 39 + (i % 2) * 0.7, 'char_prole_man', i % 2 ? 'talk' : 'idle', PI * (i % 2));
  // children on the waste ground
  for (let i = 0; i < 5; i++) P(25 + (r() - 0.5) * 8, 125 + (r() - 0.5) * 10, 'char_child', r() < 0.5 ? 'run' : 'idle', r() * 6.28);
  // Party members at the monument, reading the spiral poster
  for (let i = 0; i < 10; i++) { const a = i / 10 * 6.28; P(Math.sin(a) * 9.5, -55 + Math.cos(a) * 9.5, party[i % party.length], i % 3 ? 'idle' : 'look', a + PI); }
  // a cluster at the Ministry doors, guards at the Ministry of Love
  for (let i = 0; i < 6; i++) P(-6 + i * 2.2, -108 + (i % 2), party[i % party.length], 'idle', PI);
  for (const [x, z] of [[-182, -95], [-182, -103], [-190, -99]]) P(x, z, 'char_guard', 'idle', H);
  // the Thought Police on their rounds
  G.npcs.patrol({ id: 'tp1', location: 'city', path: w.paths.square_loop });
  G.npcs.patrol({ id: 'tp2', location: 'city', path: w.paths.avenue_e });
  G.npcs.patrol({ id: 'tp3', location: 'city', path: w.paths.lovelane, model: 'char_guard' });
  G.npcs.patrol({ id: 'tp4', location: 'city', path: w.paths.prole_a });
}
