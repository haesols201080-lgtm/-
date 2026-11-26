// The ride to the city, seen from inside the picnic basket on the back seat of the stranger's car: through the gap the
// stranger left under the lid, the side window, and the world going past it - the forest road in the late
// afternoon, the highway at dusk, the bridge into New York with Manhattan across the water, then the quiet street of
// detached houses where the stranger lives, the street lights sweeping through the car.
// The car stands still; the scenery streams past it (x is forward, y up, z toward the window on the left).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mulberry32, smoothstep } from './util.js';
import { facadeTexture, makeHouse } from './nyc.js';

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
  // sky: a dome whose colours run from the late-afternoon gold to the city night
  const skyU = { uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms: skyU,
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 uTop, uHor; varying vec3 vP; void main(){ float h = clamp(normalize(vP).y, -0.1, 1.0); vec3 c = mix(uHor, uTop, pow(max(h, 0.0), 0.55)); gl_FragColor = vec4(c, 1.0); }' }));
  scene.add(sky);
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
  const trunkM = new THREE.MeshStandardMaterial({ color: 0x2c2118, roughness: 1 }), crownM = new THREE.MeshStandardMaterial({ color: 0x1c2a17, roughness: 1 });
  const trunkG = new THREE.CylinderGeometry(0.18, 0.28, 9, 6), crownG = new THREE.ConeGeometry(2.4, 9, 7);
  const addItem = (obj, x, z, phase, span) => { obj.position.x = x; obj.position.z = z; obj.userData.phase = phase; obj.userData.span = span; world.add(obj); items.push(obj); };
  // forest by the road (phase 0)
  for (let i = 0; i < 46; i++) {
    const g = new THREE.Group(); const z = 4.5 + rnd() * 26, s = 0.7 + rnd() * 0.7;
    const tr = new THREE.Mesh(trunkG, trunkM); tr.position.y = 4.5 * s - 1; tr.scale.setScalar(s); g.add(tr);
    const cr = new THREE.Mesh(crownG, crownM); cr.position.y = 8 * s; cr.scale.setScalar(s); g.add(cr);
    tr.castShadow = cr.castShadow = true;
    addItem(g, -60 + i * 3.1 + rnd() * 2, z, 0, 150);
  }
  // highway: lamp posts and a guard rail (phase 1)
  const poleM = new THREE.MeshStandardMaterial({ color: 0x55585c, roughness: 0.5, metalness: 0.7 });
  const headM = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffc27a, emissiveIntensity: 3 });
  for (let i = 0; i < 6; i++) {
    const g = new THREE.Group(); const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 8, 8), poleM); p.position.y = 3; g.add(p);
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.25), headM); h.position.set(0, 7, -0.9); g.add(h);
    addItem(g, -60 + i * 25, 3.2, 1, 150);
  }
  const rail = new THREE.Mesh(new THREE.BoxGeometry(400, 0.3, 0.08), poleM); rail.position.set(0, -0.3, 2.6); rail.userData.phase = 1; world.add(rail); items.push(rail);
  // the bridge into New York (phase 2): suspension cables sweeping past, the deck rail, and across the water the
  // Manhattan skyline (far, so it slides by slowly), a green sign over the road
  const steelM = new THREE.MeshStandardMaterial({ color: 0x7c8590, roughness: 0.4, metalness: 0.8 });
  for (let i = 0; i < 26; i++) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 30, 6), steelM); c.position.y = 13; c.rotation.z = 0.05;
    const g = new THREE.Group(); g.add(c); addItem(g, -60 + i * 6, 3.0, 2, 156);
  }
  const deckRail = new THREE.Mesh(new THREE.BoxGeometry(400, 0.12, 0.12), steelM); deckRail.position.set(0, 0.9, 2.7); deckRail.userData.phase = 2; deckRail.userData.fixed = true; world.add(deckRail); items.push(deckRail);
  for (let i = 0; i < 2; i++) {   // the stone towers of the bridge
    const g = new THREE.Group(), tw = new THREE.Mesh(new THREE.BoxGeometry(7, 80, 9), new THREE.MeshStandardMaterial({ color: 0x8a7f72, roughness: 0.9 })); tw.position.y = 38; g.add(tw);
    addItem(g, -20 + i * 150, 6.5, 2, 300);
  }
  const skyline = new THREE.Group(); skyline.userData.phase = 2; skyline.userData.slow = true; world.add(skyline); items.push(skyline);
  const facades = [1, 2, 3, 4].map((k) => facadeTexture(40 + k));
  for (let i = 0; i < 70; i++) {
    const h = 40 + Math.pow(rnd(), 1.7) * 260, w = 20 + rnd() * 30;
    const tex = facades[i % 4].clone(); tex.needsUpdate = true; tex.repeat.set(w / 16, h / 22);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), new THREE.MeshStandardMaterial({ color: 0x0b0d12, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 1.8, roughness: 0.6 }));
    m.position.set(-500 + i * 15 + rnd() * 8, h / 2 - 20, 380 + rnd() * 180); skyline.add(m);
  }
  { const m = new THREE.Mesh(new THREE.BoxGeometry(40, 360, 40), new THREE.MeshStandardMaterial({ color: 0x0a0b0e, emissive: 0xffffff, emissiveMap: facades[1], emissiveIntensity: 1.2 })); m.position.set(40, 160, 600); skyline.add(m);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 4, 60, 8), new THREE.MeshBasicMaterial({ color: 0xcfd8ff })); mast.position.set(40, 370, 600); skyline.add(mast); }
  const water = new THREE.Mesh(new THREE.PlaneGeometry(2000, 900), new THREE.MeshStandardMaterial({ color: 0x05070c, roughness: 0.1, metalness: 0.7 })); water.rotation.x = -Math.PI / 2; water.position.set(0, -25, 450); water.userData.phase = 2; water.userData.fixed = true; world.add(water); items.push(water);
  { // the road sign
    const c = document.createElement('canvas'); c.width = 256; c.height = 96; const g = c.getContext('2d');
    g.fillStyle = '#0d6b3a'; g.fillRect(0, 0, 256, 96); g.strokeStyle = '#fff'; g.lineWidth = 4; g.strokeRect(6, 6, 244, 84);
    g.fillStyle = '#fff'; g.font = 'bold 30px Arial, sans-serif'; g.textAlign = 'center'; g.fillText('NEW YORK', 128, 44); g.font = 'bold 20px Arial, sans-serif'; g.fillText('Manhattan  ↑', 128, 76);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const sg = new THREE.Group(), pl = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.9), new THREE.MeshBasicMaterial({ map: t })); pl.position.set(0, 5.4, 0); pl.rotation.y = Math.PI; sg.add(pl);
    addItem(sg, 30, 6.5, 2, 400);
  }
  // the quiet street at the end (phase 3): detached houses, trees, street lamps
  const R2 = mulberry32(77), colors = ['#d9d5cc', '#b9c7cf', '#d8c7a6', '#c9b6a4', '#e3e0d6'];
  for (let i = 0; i < 9; i++) { const hs = makeHouse(R2, 7 + R2() * 2, 9, 5.8, colors[i % 5], Math.PI); addItem(hs, -60 + i * 14, 14 + R2() * 2, 3, 126); }
  const lampPosts = [];
  for (let i = 0; i < 6; i++) { const g = new THREE.Group(); const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 7, 8), poleM); p.position.y = 2.5; g.add(p); const h = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.22), headM); h.position.set(0, 6, -0.8); g.add(h); addItem(g, -60 + i * 22, 3.4, 3, 132); lampPosts.push(g); }
  for (let i = 0; i < 10; i++) { const g = new THREE.Group(); const tr = new THREE.Mesh(trunkG, trunkM); tr.position.y = 3; tr.scale.setScalar(0.7); g.add(tr); const cr = new THREE.Mesh(new THREE.IcosahedronGeometry(2.6, 1), crownM); cr.position.y = 7; g.add(cr); addItem(g, -60 + i * 13 + 6, 6 + rnd() * 2, 3, 130); }
  for (const o of items) o.visible = false;
  // ---- timeline
  const DUR = 34, SPEED = [22, 26, 18, 8];
  const ride = { scene, camera, t: 0, done: false, DUR };
  const top0 = new THREE.Color(0x5d7fae), hor0 = new THREE.Color(0xffb36b), top1 = new THREE.Color(0x29304f), hor1 = new THREE.Color(0xd66a4b), top2 = new THREE.Color(0x05070d), hor2 = new THREE.Color(0x2a2236);
  const eye = new THREE.Vector3(0.0, 0.83, 0.02), look = new THREE.Vector3(0.05, 1.02, 0.74);
  ride.update = (dt) => {
    ride.t += dt; const t = ride.t;
    const ph = t < 12 ? 0 : t < 21 ? 1 : t < 28.5 ? 2 : 3;
    const sp = SPEED[ph];
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
    camera.position.copy(eye).add(new THREE.Vector3(0, bump, 0));
    camera.lookAt(look.x + Math.sin(t * 0.3) * 0.03, look.y + bump * 0.5, look.z);
    car.position.y = bump * 0.6;
    if (t > DUR) ride.done = true;
    return ph;
  };
  ride.resize = () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); };
  return ride;
}
