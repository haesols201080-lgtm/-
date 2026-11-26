// New York at night, as seen from a detached house in the outer boroughs: the neighbours' houses (lap siding, gable
// roofs, porch lights, a few windows still lit), the street with its lamps, bare trees, and far off across the water
// the towers of Manhattan with a stepped art-deco spire. The sky glows orange low down with the city's light.
import * as THREE from 'three';
import { mulberry32 } from './util.js';

// a tower facade: floors of small windows, lit ones in runs (somebody's flat), cold screens here and there
export function facadeTexture(seed, W = 256, H = 512) {
  const R = mulberry32(seed), c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'); g.fillStyle = '#06070a'; g.fillRect(0, 0, W, H);
  for (let y = 4; y < H - 4; y += 9) {
    let run = 0, warm = true;
    for (let x = 3; x < W - 4; x += 6) {
      if (run <= 0 && R() < 0.06) { run = 1 + R() * 5 | 0; warm = R() < 0.75; }
      const lit = run-- > 0;
      g.fillStyle = lit ? (warm ? `rgb(${235 + R() * 20 | 0},${175 + R() * 50 | 0},${95 + R() * 50 | 0})` : `rgb(${150 + R() * 40 | 0},${185 + R() * 40 | 0},255)`) : `rgb(${5 + R() * 6 | 0},${6 + R() * 6 | 0},${10 + R() * 8 | 0})`;
      g.fillRect(x, y, 4, 6);
    }
  }
  // no mipmaps: far away the lit windows stay separate points of light instead of averaging into a brown glow
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.generateMipmaps = false; t.minFilter = THREE.LinearFilter;
  return t;
}

function sidingTexture(color) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128; const g = c.getContext('2d');
  g.fillStyle = color; g.fillRect(0, 0, 64, 128);
  for (let y = 0; y < 128; y += 8) { g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(0, y + 6, 64, 2); g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(0, y, 64, 1); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

const glowTex = (() => {
  let t = null;
  return () => {
    if (t) return t;
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,220,160,1)'); gr.addColorStop(0.25, 'rgba(255,190,110,0.45)'); gr.addColorStop(1, 'rgba(255,170,90,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  };
})();
export function glow(size, color = 0xffc68a, opacity = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(size); return s;
}

// one detached house: body, gable roof, chimney, windows (some lit), a porch light by the door
export function makeHouse(R, w, d, h, color, facing) {
  const g = new THREE.Group();
  const sid = sidingTexture(color); sid.repeat.set(w / 2, h / 4);
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ map: sid, roughness: 0.85 }));
  body.position.y = h / 2; g.add(body);
  const roofM = new THREE.MeshStandardMaterial({ color: 0x2a2624, roughness: 0.9 });
  const rh = w * 0.38, shape = new THREE.Shape([new THREE.Vector2(-w / 2 - 0.3, 0), new THREE.Vector2(w / 2 + 0.3, 0), new THREE.Vector2(0, rh)]);
  const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: d + 0.6, bevelEnabled: false }), roofM);
  roof.position.set(0, h, -d / 2 - 0.3); g.add(roof);
  const ch = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2.2, 0.7), new THREE.MeshStandardMaterial({ color: 0x5a3328, roughness: 0.9 }));
  ch.position.set(w * 0.25, h + rh * 0.6, d * 0.15); g.add(ch);
  // windows on the side facing the viewer (+z of the house)
  const lit = new THREE.MeshBasicMaterial({ color: 0xffc27a }), litC = new THREE.MeshBasicMaterial({ color: 0x9ab6ff }), dark = new THREE.MeshStandardMaterial({ color: 0x0c0f14, roughness: 0.15, metalness: 0.5 });
  for (const fy of [1.4, 4.2]) for (const fx of [-w * 0.3, 0, w * 0.3]) {
    if (fy < 2 && fx === 0) continue;
    const r = R(), m = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.4), r < 0.22 ? lit : r < 0.27 ? litC : dark);
    m.position.set(fx, fy, d / 2 + 0.02); g.add(m);
    const fr = new THREE.Mesh(new THREE.PlaneGeometry(1.16, 1.56), new THREE.MeshStandardMaterial({ color: 0xe8e4da, roughness: 0.6 })); fr.position.set(fx, fy, d / 2 + 0.01); g.add(fr);
  }
  // front door and its porch light
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 2.1), new THREE.MeshStandardMaterial({ color: [0x3b2a20, 0x24324a, 0x5a1f1c][R() * 3 | 0], roughness: 0.6 }));
  door.position.set(0, 1.05, d / 2 + 0.02); g.add(door);
  if (R() < 0.75) { const gl = glow(1.6, 0xffc07a, 0.9); gl.position.set(0.7, 2.3, d / 2 + 0.25); g.add(gl); }
  g.rotation.y = facing;
  return g;
}

export function buildNeighborhood(scene, { seed = 7 } = {}) {
  const R = mulberry32(seed), root = new THREE.Group(); scene.add(root);
  // sky: deep blue overhead, the orange of a city's lights low down
  const sky = new THREE.Mesh(new THREE.SphereGeometry(380, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec3 vP; void main(){ vec3 d = normalize(vP); float h = d.y;
      vec3 top = vec3(0.012, 0.018, 0.04), mid = vec3(0.05, 0.06, 0.11), low = vec3(0.32, 0.2, 0.13);
      vec3 c = mix(mid, top, smoothstep(0.05, 0.6, h)); c = mix(c, low, smoothstep(0.12, -0.02, h) * (0.6 + 0.4 * smoothstep(0.2, 1.0, -d.z)));
      gl_FragColor = vec4(c, 1.0); }` }));
  sky.renderOrder = -10; root.add(sky);
  // the ground: lawns and the street in front (north), backyards behind (south)
  const grassM = new THREE.MeshStandardMaterial({ color: 0x1a2416, roughness: 1 }), asphalt = new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.6, metalness: 0.1 }), walk = new THREE.MeshStandardMaterial({ color: 0x3a3a3c, roughness: 0.9 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), grassM); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.62; root.add(ground);
  const street = new THREE.Mesh(new THREE.PlaneGeometry(400, 9), asphalt); street.rotation.x = -Math.PI / 2; street.position.set(0, -0.6, -17); root.add(street);
  for (const z of [-11.5, -22.5]) { const s = new THREE.Mesh(new THREE.PlaneGeometry(400, 2), walk); s.rotation.x = -Math.PI / 2; s.position.set(0, -0.59, z); root.add(s); }
  // the neighbours: across the street (facing south, toward us), beside us, and behind the backyard fence
  const colors = ['#d9d5cc', '#b9c7cf', '#d8c7a6', '#c9b6a4', '#e3e0d6', '#a8b5a0'];
  const place = (x, z, facing) => { const w = 7 + R() * 3, d = 9 + R() * 2, h = 5.6 + R() * 1.2; const hs = makeHouse(R, w, d, h, colors[R() * colors.length | 0], facing); hs.position.set(x, -0.6, z); root.add(hs); };
  for (let x = -40; x <= 40; x += 11 + R() * 2) place(x, -29, 0);
  for (const x of [-13, 13]) place(x, 0, x < 0 ? Math.PI / 2 : -Math.PI / 2);
  // (behind the backyard the houses leave a gap: the view south over the fence goes all the way to Manhattan)
  for (let x = -44; x <= 44; x += 11 + R() * 2) if (Math.abs(x) > 17) place(x, 30, Math.PI);
  // street lamps along the near kerb, with their pools of light
  const pole = new THREE.MeshStandardMaterial({ color: 0x2c2e30, roughness: 0.5, metalness: 0.7 });
  for (let x = -36; x <= 36; x += 18) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 7, 8), pole); p.position.set(x, 2.9, -12.3); root.add(p);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.15, 0.3), new THREE.MeshBasicMaterial({ color: 0xffd39a })); head.position.set(x, 6.4, -12.9); root.add(head);
    const gl = glow(5, 0xffc27a, 0.85); gl.position.set(x, 6.3, -12.9); root.add(gl);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(4, 24), new THREE.MeshBasicMaterial({ color: 0xffa860, transparent: true, opacity: 0.12, depthWrite: false })); pool.rotation.x = -Math.PI / 2; pool.position.set(x, -0.58, -13.5); root.add(pool);
  }
  // bare street trees and backyard trees (dark against the glow)
  const trunk = new THREE.MeshStandardMaterial({ color: 0x1a1512, roughness: 1 }), crown = new THREE.MeshStandardMaterial({ color: 0x10160e, roughness: 1 });
  for (let i = 0; i < 26; i++) {
    const t = new THREE.Group(), h = 6 + R() * 6; const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.3, h, 6), trunk); tr.position.y = h / 2; t.add(tr);
    const cr = new THREE.Mesh(new THREE.IcosahedronGeometry(2.5 + R() * 2, 1), crown); cr.position.y = h + 1; cr.scale.y = 1.2; t.add(cr);
    const side = R() < 0.5;
    t.position.set(-45 + R() * 90, -0.6, side ? -10.5 - R() * 1 : 16 + R() * 6); if (Math.abs(t.position.x) < 8 && !side) continue; root.add(t);
  }
  // Manhattan, far across the water to the south: towers with lit windows and a stepped art-deco spire. (Built at
  // full size 1.4-2 km away, then drawn at a fifth of that around the house: the same size on screen, inside the far
  // plane and with depth precision to spare.)
  const sky2 = new THREE.Group(); sky2.scale.setScalar(0.2); root.add(sky2);
  const facades = [1, 2, 3, 4, 5].map((k) => facadeTexture(700 + k));
  const towerAt = (x, z, w, h, d, k) => {
    const tex = facades[k % 5].clone(); tex.needsUpdate = true; tex.repeat.set(w / 16, h / 22);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: 0x0b0d12, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 1.8, roughness: 0.7, fog: false }));
    m.position.set(x, h / 2 - 8, z); sky2.add(m); return m;
  };
  for (let i = 0; i < 90; i++) {
    const a = -0.55 + (i / 90) * 1.25 + (R() - 0.5) * 0.02, dist = 1400 + R() * 700;
    const h = 60 + Math.pow(R(), 1.8) * 300, w = 30 + R() * 45;
    towerAt(Math.sin(a) * dist, Math.cos(a) * dist, w, h, w * (0.7 + R() * 0.5), i);
  }
  // the spire: three setbacks and a mast with a red light
  { const x = Math.sin(-0.05) * 1650, z = Math.cos(-0.05) * 1650;
    towerAt(x, z, 70, 260, 50, 1); towerAt(x, z, 48, 330, 36, 2); towerAt(x, z, 30, 380, 24, 3);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(2, 6, 70, 8), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xd8e0ff, emissiveIntensity: 0.4, fog: false })); mast.position.set(x, 380 - 8 + 35, z); sky2.add(mast);
    const red = glow(30, 0xff3a2a, 1); red.position.set(x, 380 - 8 + 72, z); sky2.add(red); }
  // the water between: a dark band that catches the lights
  const water = new THREE.Mesh(new THREE.PlaneGeometry(6000, 900), new THREE.MeshStandardMaterial({ color: 0x05070c, roughness: 0.12, metalness: 0.6 })); water.rotation.x = -Math.PI / 2; water.position.set(0, -9, 1100); sky2.add(water);
  return root;
}
