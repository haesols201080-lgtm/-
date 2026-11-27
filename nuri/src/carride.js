// The ride to the city, seen from inside the picnic basket on the back seat of the stranger's car: through the gap the
// stranger left under the lid, the side window, and the world going past it - the forest road in the late
// afternoon, the highway at dusk, the bridge into New York with Manhattan across the water, then the quiet street of
// detached houses where the stranger lives, the street lights sweeping through the car.
// The car stands still; the scenery streams past it (x is forward, y up, z toward the window on the left).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mulberry32, smoothstep } from './util.js';
import { makeHouse, buildSkyline, treeAt } from './nyc.js';

const rnd = mulberry32(2602);

function fabric(T, color, rep = 1) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0 });
  if (T) { m.map = T.map; m.normalMap = T.normal; m.roughnessMap = T.orm; m.normalScale = new THREE.Vector2(0.8, 0.8); }
  m.userData.rep = rep;
  return m;
}
const box = (w, h, d, r, mat, x, y, z) => { const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m; };

export function makeCarRide(renderer, A) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.02, 900);
  // sky: the forest's own daylight sky (a photographed HDRI) as the car leaves; over it a dome that fades in with the
  // dusk, its colours running from gold to the city night, with low clouds lit first by the sunset, then by the city
  scene.background = A.tex.hdrDay || null; scene.backgroundIntensity = 0.85; scene.backgroundRotation.y = 1.2;
  const skyU = { uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uCloud: { value: new THREE.Color() }, uA: { value: 0 }, uT: { value: 0 } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(880, 48, 24), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, transparent: true, fog: false, uniforms: skyU,
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 uTop, uHor, uCloud; uniform float uA, uT; varying vec3 vP;
      float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
      float fbm(vec2 p){ float a = 0.0, w = 0.5; for (int i = 0; i < 5; i++) { a += w * n2(p); p *= 2.03; w *= 0.5; } return a; }
      void main(){ vec3 d = normalize(vP); float h = clamp(d.y, -0.1, 1.0);
        vec3 c = mix(uHor, uTop, pow(max(h, 0.0), 0.55));
        vec2 uv = d.xz / max(0.07, h + 0.1) * 0.8 + vec2(uT * 0.004, 0.0);
        float cl = smoothstep(0.46, 0.8, fbm(uv * 1.3 + 7.0)) * smoothstep(0.0, 0.16, h) * smoothstep(0.9, 0.35, h);
        c = mix(c, uCloud * (0.75 + 0.5 * fbm(uv * 4.0)), cl * 0.85);
        gl_FragColor = vec4(c, uA); }` }));
  sky.renderOrder = -1; scene.add(sky);
  scene.environment = A.tex.envMap; scene.environmentIntensity = 0.25;
  const sun = new THREE.DirectionalLight(0xffb070, 3); sun.position.set(2, 2.2, 6); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -2, right: 2, top: 2, bottom: -2, near: 0.5, far: 20 }); sun.shadow.bias = -0.0005;
  scene.add(sun, sun.target);
  const amb = new THREE.HemisphereLight(0x9fb2d0, 0x2a2420, 0.5); scene.add(amb);
  const lamp = new THREE.PointLight(0xffc27a, 0, 4, 1.6); scene.add(lamp);          // a passing street light
  // ---- the car's back seat
  const car = new THREE.Group(); scene.add(car);
  const seatM = fabric(A.tex.seat, new THREE.Color(0.34, 0.34, 0.36)), plastic = new THREE.MeshStandardMaterial({ color: 0x1b1c1e, roughness: 0.75 });
  const lining = fabric(A.tex.seat, new THREE.Color(0.62, 0.6, 0.57));
  car.add(box(0.56, 0.16, 1.36, 0.06, seatM, 0, 0.36, 0));                                  // cushion
  const back = box(0.15, 0.62, 1.36, 0.06, seatM, -0.3, 0.72, 0); back.rotation.z = 0.2; car.add(back);
  for (const z of [-0.38, 0.38]) { const hr = box(0.1, 0.18, 0.26, 0.04, seatM, -0.38, 1.12, z); hr.rotation.z = 0.2; car.add(hr); }
  // door panel and window on the left (+z)
  car.add(box(1.4, 0.5, 0.06, 0.02, plastic, 0, 0.55, 0.74));
  car.add(box(1.2, 0.12, 0.08, 0.02, fabric(A.tex.seat, new THREE.Color(0.25, 0.25, 0.27)), 0, 0.64, 0.7));   // arm rest
  car.add(box(0.12, 0.6, 0.08, 0.03, plastic, 0.6, 1.08, 0.72));                            // B pillar
  car.add(box(0.28, 0.6, 0.08, 0.03, plastic, -0.62, 1.08, 0.72));                          // C pillar
  car.add(box(1.5, 0.05, 1.6, 0.02, lining, 0, 1.36, 0));                                    // roof lining
  car.add(box(1.4, 0.08, 0.1, 0.02, plastic, 0, 0.84, 0.74));                                // window sill
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.5), new THREE.MeshPhysicalMaterial({ color: 0xbfd0d8, transparent: true, opacity: 0.12, roughness: 0.02, metalness: 0, envMapIntensity: 1.5 }));
  glass.position.set(0, 1.1, 0.735); glass.rotation.y = Math.PI; car.add(glass);
  // the right side and the front seats (seen in the dark beyond the basket rim)
  car.add(box(1.4, 1.0, 0.06, 0.02, plastic, 0, 0.8, -0.74));
  for (const z of [-0.38, 0.38]) { car.add(box(0.2, 0.75, 0.55, 0.08, seatM, 0.62, 0.78, z)); car.add(box(0.12, 0.2, 0.28, 0.05, seatM, 0.6, 1.25, z)); }
  // the basket on the seat, its lid ajar; the robot's view is from just under the rim
  const basket = new THREE.Group(); basket.position.set(0.02, 0.44, -0.1); car.add(basket);
  if (A.models.h_wicker_basket_02) {
    const src = A.models.h_wicker_basket_02.scene.clone(true); let lid = null;
    src.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (/lid/.test(o.name)) lid = o; } });
    src.scale.setScalar(2.1); basket.add(src);
    // hinged on the far side, so the gap the stranger left opens toward the window
    if (lid) { lid.removeFromParent(); const hinge = new THREE.Group(); hinge.position.set(0, 0.42, -0.222); basket.add(hinge); const s2 = new THREE.Group(); s2.scale.setScalar(2.1); s2.add(lid); lid.position.set(0, 0, 0.106); lid.quaternion.identity(); hinge.add(s2); hinge.rotation.x = -0.34; }
  }
  // ---- the world outside (streams past along -x)
  const world = new THREE.Group(); scene.add(world);
  const items = [];
  const addItem = (obj, x, z, phase, span) => { obj.position.x = x; obj.position.z = z; obj.userData.phase = phase; obj.userData.span = span; world.add(obj); items.push(obj); };
  const keys = ['pine_0', 'pine_2', 'fir_4', 'fir_14'];
  // the roadside trees stand against the low sun: needles and bark mostly in their own shade
  const carTwig = A.mats.hTwig.clone(); carTwig.color.setRGB(0.26, 0.3, 0.22); carTwig.envMapIntensity = 0.35;
  const carBark = A.mats.hBark.clone(); carBark.color.setRGB(0.6, 0.58, 0.55);
  const shade = (g) => { g?.traverse((o) => { if (o.isMesh) { o.material = o.material === A.mats.hBark ? carBark : carTwig; o.castShadow = false; } }); return g; };
  // forest by the road (phase 0): the forest's own pines and firs, near ones flicking by, far ones sliding
  for (let i = 0; i < 46; i++) {
    const z = 4.5 + rnd() * 26, k = keys[rnd() * 4 | 0], s = (k.startsWith('pine') ? 0.55 : 0.9) + rnd() * 0.4;
    const g = shade(treeAt(A, k, 0, -1.2, 0, s, rnd() * 6.28)); if (g) addItem(g, -60 + i * 3.1 + rnd() * 2, z, 0, 150);
  }
  // highway: lamp posts and a guard rail (phase 1), the woods thinning out behind
  const poleM = new THREE.MeshStandardMaterial({ color: 0x55585c, roughness: 0.5, metalness: 0.7 });
  const headM = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffc27a, emissiveIntensity: 3 });
  for (let i = 0; i < 6; i++) {
    const g = new THREE.Group(); const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 8, 8), poleM); p.position.y = 3; g.add(p);
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.25), headM); h.position.set(0, 7, -0.9); g.add(h);
    addItem(g, -60 + i * 25, 3.2, 1, 150);
  }
  for (let i = 0; i < 16; i++) { const g = shade(treeAt(A, keys[2 + (rnd() * 2 | 0)], 0, -1.5, 0, 0.8 + rnd() * 0.5, rnd() * 6.28)); if (g) addItem(g, -60 + i * 9.4 + rnd() * 4, 16 + rnd() * 20, 1, 150); }
  const rail = new THREE.Mesh(new THREE.BoxGeometry(400, 0.3, 0.08), poleM); rail.position.set(0, -0.3, 2.6); rail.userData.phase = 1; world.add(rail); items.push(rail);
  // the bridge into New York (phase 2): suspension cables sweeping past, the deck rail, and across the water the
  // Manhattan skyline (far, so it slides by slowly) with its reflections, a green sign over the road
  const steelM = new THREE.MeshStandardMaterial({ color: 0x7c8590, roughness: 0.4, metalness: 0.8 });
  for (let i = 0; i < 26; i++) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 30, 6), steelM); c.position.y = 13; c.rotation.z = 0.05;
    const g = new THREE.Group(); g.add(c); addItem(g, -60 + i * 6, 3.0, 2, 156);
  }
  const deckRail = new THREE.Mesh(new THREE.BoxGeometry(400, 0.12, 0.12), steelM); deckRail.position.set(0, 0.9, 2.7); deckRail.userData.phase = 2; deckRail.userData.fixed = true; world.add(deckRail); items.push(deckRail);
  const stoneM = new THREE.MeshStandardMaterial({ color: 0x8a7f72, roughness: 0.9 });
  if (A.tex.brick) { stoneM.map = A.tex.brick.map; stoneM.normalMap = A.tex.brick.normal; stoneM.color.set(0xb0a090); }
  for (let i = 0; i < 2; i++) {   // the stone towers of the bridge, with their gothic arches
    const g = new THREE.Group();
    for (const dz of [-3.2, 3.2]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(7, 80, 2.6), stoneM); leg.position.set(0, 38, dz); g.add(leg); }
    const cap = new THREE.Mesh(new THREE.BoxGeometry(7.6, 14, 9.4), stoneM); cap.position.y = 72; g.add(cap);
    addItem(g, -20 + i * 150, 6.5, 2, 300);
  }
  const skyline = buildSkyline(mulberry32(911), { k: 0.28, dir: 0, waterNear: 0 }); skyline.position.y = -22; skyline.userData.phase = 2; skyline.userData.slow = true; skyline.position.x = 40; world.add(skyline); items.push(skyline);
  { // the road sign
    const c = document.createElement('canvas'); c.width = 256; c.height = 96; const g = c.getContext('2d');
    g.fillStyle = '#0d6b3a'; g.fillRect(0, 0, 256, 96); g.strokeStyle = '#fff'; g.lineWidth = 4; g.strokeRect(6, 6, 244, 84);
    g.fillStyle = '#fff'; g.font = 'bold 30px Arial, sans-serif'; g.textAlign = 'center'; g.fillText('NEW YORK', 128, 44); g.font = 'bold 20px Arial, sans-serif'; g.fillText('Manhattan  ↑', 128, 76);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const sg = new THREE.Group(), pl = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.9), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.25 })); pl.position.set(0, 5.4, 0); pl.rotation.y = Math.PI; sg.add(pl);
    for (const dx of [-2.2, 2.2]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 6.4, 8), poleM); post.position.set(dx, 2.8, 0.1); sg.add(post); }
    addItem(sg, 30, 6.5, 2, 400);
  }
  // the quiet street at the end (phase 3): detached houses with their porches and lit windows, firs, street lamps
  const R2 = mulberry32(77), tints = [0xffffff, 0xd6e2ec, 0xf1e3c6, 0xdcc9b4, 0xe8e6de];
  for (let i = 0; i < 9; i++) { const hs = makeHouse(R2, A, { w: 7 + R2() * 2, d: 9, h: 5.6 + R2() * 0.6, tint: tints[i % 5] }); hs.rotation.y = Math.PI; hs.position.y = -0.9; addItem(hs, -60 + i * 14, 14 + R2() * 2, 3, 126); }
  const lampPosts = [];
  for (let i = 0; i < 6; i++) { const g = new THREE.Group(); const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 7, 8), poleM); p.position.y = 2.5; g.add(p); const h = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.22), headM); h.position.set(0, 6, -0.8); g.add(h); addItem(g, -60 + i * 22, 3.4, 3, 132); lampPosts.push(g); }
  for (let i = 0; i < 10; i++) { const g = treeAt(A, keys[2 + (i % 2)], 0, -0.9, 0, 0.55 + rnd() * 0.25, rnd() * 6.28); if (g) addItem(g, -60 + i * 13 + 6, 7 + rnd() * 2, 3, 130); }
  for (const o of items) o.visible = false;
  // ---- timeline
  const DUR = 34, SPEED = [22, 26, 18, 8];
  const ride = { scene, camera, t: 0, done: false, DUR };
  const cl0 = new THREE.Color(0xf2c9a0), cl1 = new THREE.Color(0xc0605a), cl2 = new THREE.Color(0x3d2a20);
  const top0 = new THREE.Color(0x5d7fae), hor0 = new THREE.Color(0xffb36b), top1 = new THREE.Color(0x29304f), hor1 = new THREE.Color(0xd66a4b), top2 = new THREE.Color(0x05070d), hor2 = new THREE.Color(0x2a2236);
  const eye = new THREE.Vector3(0.0, 0.83, 0.02), look = new THREE.Vector3(0.05, 1.02, 0.74);
  ride.update = (dt) => {
    ride.t += dt; const t = ride.t;
    const ph = t < 12 ? 0 : t < 21 ? 1 : t < 28.5 ? 2 : 3;
    const sp = SPEED[ph]; ride.speed = sp; ride.ph = ph;
    for (const o of items) {
      const on = o.userData.phase === ph; o.visible = on;
      if (!on) continue;
      if (o === rail || o.userData.fixed) continue;
      o.position.x -= sp * dt * (o.userData.slow ? 0.02 : 1);
      if (o.userData.slow) continue;
      if (o.position.x < -70) o.position.x += o.userData.span;
    }
    // sky and light through the day's end
    const k1 = smoothstep(9, 15, t), k2 = smoothstep(19, 25, t);
    skyU.uTop.value.copy(top0).lerp(top1, k1).lerp(top2, k2); skyU.uHor.value.copy(hor0).lerp(hor1, k1).lerp(hor2, k2);
    skyU.uCloud.value.copy(cl0).lerp(cl1, k1).lerp(cl2, k2); skyU.uA.value = smoothstep(7, 13, t); skyU.uT.value = t;
    scene.backgroundIntensity = 0.85 * (1 - smoothstep(7, 12, t));
    const env = t < 12 ? (A.tex.envDay || A.tex.envMap) : A.tex.envMap; if (scene.environment !== env) scene.environment = env;
    if (ph === 2) skyline.userData.update(t);
    // the low sun flickers through the roadside trees; at dusk it sinks; in the city it is gone
    let flick = 1;
    if (ph === 0) { let occ = 0; for (const o of items) if (o.userData.phase === 0 && Math.abs(o.position.x - 0.5) < 1.6 && o.position.z < 9) occ = Math.max(occ, 1 - Math.abs(o.position.x - 0.5) / 1.6); flick = 1 - occ * 0.85; }
    sun.intensity = (3.2 * (1 - k1) + 1.2 * k1 * (1 - k2)) * flick; sun.color.setRGB(1, 0.62 - 0.15 * k1, 0.36 - 0.12 * k1);
    amb.intensity = 0.5 - 0.3 * k2; scene.environmentIntensity = 0.25 - 0.12 * k2;
    // passing street lights wash through the car from front to back
    let li = 0;
    if (ph === 1 || ph === 3) for (const o of items) if (o.visible && (o.userData.phase === 1 || lampPosts.includes(o)) && o.children.length === 2) {
      const dx = o.position.x; if (Math.abs(dx) < 6) li = Math.max(li, 1 - Math.abs(dx) / 6);
      if (Math.abs(dx) < 6) lamp.position.set(dx * 0.4, 2.2, 1.4);
    }
    lamp.intensity = li * li * (ph === 3 ? 2.2 : 1.4);
    // the road under the wheels: a fine shiver, now and then a joint in the asphalt
    const bump = Math.sin(t * 31) * 0.0012 + Math.sin(t * 17.3) * 0.001 + (Math.sin(t * 1.7) > 0.995 ? 0.006 : 0);
    // on the bridge Seven rises to peek over the rim of the basket: the water, and the city across it
    const peek = smoothstep(21.6, 23.2, t) * (1 - smoothstep(28.0, 29.6, t));
    camera.position.set(eye.x, eye.y + 0.15 * peek + bump, eye.z + 0.1 * peek);
    camera.lookAt(look.x + Math.sin(t * 0.3) * 0.03, look.y - 0.03 * peek + bump * 0.5, look.z);
    car.position.y = bump * 0.6;
    if (t > DUR) ride.done = true;
    return ph;
  };
  ride.resize = () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); };
  return ride;
}
