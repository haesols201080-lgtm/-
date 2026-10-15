// The Golden Country: a railway halt, a road, the gate with the top bar
// missing, a field path, a lane, the dead tree with moss on it, a wood with
// a clearing misty with bluebells, and the old rabbit-bitten pasture with
// elms swaying beyond the hedge. A rolling heightfield at x = 3000.
import * as THREE from 'three';

const OX = 3000;

function hash(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), fx = x - xi, fz = z - zi;
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}
export function terrainHeight(x, z) {
  const lx = x - OX;
  let h = vnoise(lx * 0.012, z * 0.012) * 7 + vnoise(lx * 0.04, z * 0.04) * 1.6 + vnoise(lx * 0.15, z * 0.15) * 0.25;
  // the railway cutting and the halt are level
  const rail = Math.exp(-((lx + 140) ** 2) / 900);
  h = h * (1 - rail) + 2 * rail;
  // the stream runs along a shallow valley
  const sz = z - (60 + Math.sin(lx * 0.02) * 20);
  h -= 2.5 * Math.exp(-(sz * sz) / 120);
  return h;
}

export function setupCountryside(G) {
  const root = new THREE.Group();
  root.name = 'country';
  const SIZE = 600, SEG = 160;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + OX, z = pos.getZ(i);
    pos.setY(i, terrainHeight(x, z));
    uv.setXY(i, x / 4, -z / 4);
  }
  geo.computeVertexNormals();
  const T = (n) => G.assets.tex(n);
  // grass and dirt blended by slope and noise in the shader
  const mat = new THREE.MeshStandardMaterial({ map: T('grass_c'), normalMap: T('grass_n'), roughnessMap: T('grass_r'), roughness: 1, color: 0xd8dcc0 });
  const dirt = T('dirt_c');
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uDirt = { value: dirt };
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uDirt;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        float n1 = texture2D(uDirt, vMapUv * 0.07).g;
        vec4 d = texture2D(uDirt, vMapUv * 1.3);
        float m = smoothstep(0.42, 0.62, n1);
        diffuseColor.rgb = mix(diffuseColor.rgb, d.rgb * 0.9, m * 0.75);`);
  };
  const ground = new THREE.Mesh(geo, mat);
  ground.position.x = OX;
  ground.receiveShadow = true;
  root.add(ground);
  const H = (x, z) => terrainHeight(x, z);

  // grass blades: instanced crossed cards with a wind sway
  const bladeTex = T('grass_blade');
  const gmat = new THREE.MeshStandardMaterial({ map: bladeTex, alphaTest: 0.5, side: THREE.DoubleSide, color: 0xc8d0a0, roughness: 0.9 });
  const gu = { uTime: G.mats.globals.uTime };
  gmat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = gu.uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec4 ip = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float sway = sin(uTime * 1.8 + ip.x * 0.3 + ip.z * 0.2) * 0.12 + sin(uTime * 3.1 + ip.x) * 0.04;
        transformed.x += sway * position.y; transformed.z += sway * 0.5 * position.y;`);
  };
  const bg = new THREE.PlaneGeometry(0.5, 0.6); bg.translate(0, 0.3, 0);
  const bg2 = bg.clone(); bg2.rotateY(Math.PI / 2);
  const bladeGeo = mergeTwo(bg, bg2);
  const NG = 26000;
  const grass = new THREE.InstancedMesh(bladeGeo, gmat, NG);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < NG; i++) {
    const x = OX - 200 + Math.random() * 400, z = -170 + Math.random() * 340;
    P.set(x, H(x, z), z); Q.setFromAxisAngle(Y, Math.random() * 6.28); const s = 0.6 + Math.random() * 0.9; S.set(s, s * (0.7 + Math.random() * 0.8), s);
    grass.setMatrixAt(i, M.compose(P, Q, S));
  }
  grass.receiveShadow = true;
  root.add(grass);

  // bluebells under the trees of the wood
  const bell = new THREE.MeshStandardMaterial({ color: 0x4a5ac8, roughness: 0.6, emissive: 0x101840 });
  const NB = 5000;
  const bells = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 5, 4), bell, NB);
  const wood = { x: OX + 20, z: -40, r: 55 };
  for (let i = 0; i < NB; i++) {
    const a = Math.random() * 6.28, d = Math.sqrt(Math.random()) * wood.r;
    const x = wood.x + Math.cos(a) * d, z = wood.z + Math.sin(a) * d;
    P.set(x, H(x, z) + 0.22 + Math.random() * 0.12, z); S.set(1, 1.6, 1);
    bells.setMatrixAt(i, M.compose(P, Q.identity(), S));
  }
  root.add(bells);

  const place = (name, x, z, rot = 0, scale = 1) => {
    let o; try { o = G.assets.instance(name); } catch (e) { return null; }
    G.mats.apply(o, { cast: true, receive: true });
    o.position.set(x, H(x, z) - 0.1, z); o.rotation.y = rot; o.scale.setScalar(scale);
    root.add(o);
    return o;
  };
  // the wood: elms and chestnuts and hazels round the clearing
  for (let i = 0; i < 70; i++) {
    const a = Math.random() * 6.28, d = 18 + Math.random() * (wood.r + 10);
    const x = wood.x + Math.cos(a) * d, z = wood.z + Math.sin(a) * d;
    place(i % 3 ? 'elm' : 'chestnut', x, z, Math.random() * 6, 0.8 + Math.random() * 0.4);
    G.col.add(x, z, 0.5, 0.5, 0, { tag: 'tree' });
  }
  for (let i = 0; i < 40; i++) {
    const a = Math.random() * 6.28, d = 10 + Math.random() * 20;
    place('hazel', wood.x + Math.cos(a) * d, wood.z + Math.sin(a) * d, Math.random() * 6, 0.9 + Math.random() * 0.5);
  }
  // the Golden Country: a hedge of elms across the pasture
  for (let i = 0; i < 18; i++) place('elm', OX + 90 + i * 9, 30 + Math.sin(i) * 4, Math.random() * 6, 1.1 + Math.random() * 0.3);
  for (let i = 0; i < 14; i++) place('hedge', OX + 90 + i * 9, 26, 0.1 * i);
  // the route Julia gave: halt, road left, gate without top bar, field path, dead tree
  place('train', OX - 140, -10, 0);
  place('gate', OX - 100, 20, Math.PI / 2);
  place('dead_tree', OX - 40, 0, 0.6, 1.2);
  // the stream with willows (elms stand in)
  const water = new THREE.Mesh(new THREE.PlaneGeometry(600, 10, 60, 1), new THREE.MeshStandardMaterial({ color: 0x2a3a34, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.85 }));
  water.rotation.x = -Math.PI / 2;
  const wp = water.geometry.attributes.position;
  for (let i = 0; i < wp.count; i++) { const x = wp.getX(i) + OX; wp.setY(i, wp.getY(i) - (60 + Math.sin((x - OX) * 0.02) * 20) * 0 ); }
  water.position.set(OX, 0.5, 60);
  root.add(water);

  const points = {
    halt: new THREE.Vector3(OX - 140, H(OX - 140, 0), 0),
    gate: new THREE.Vector3(OX - 100, H(OX - 100, 20), 20),
    dead_tree: new THREE.Vector3(OX - 40, H(OX - 40, 0), 0),
    clearing: new THREE.Vector3(wood.x, H(wood.x, wood.z), wood.z),
    golden: new THREE.Vector3(OX + 120, H(OX + 120, 10), 10),
  };
  G.addLocation({
    id: 'country', root, exterior: true, ground: H, zone: () => 'country',
    spawns: {
      halt: { x: points.halt.x + 4, z: 4, yaw: -Math.PI / 2 },
      clearing: { x: wood.x - 4, z: wood.z + 2, yaw: Math.PI / 2 },
      golden: { x: OX + 110, z: 0, yaw: -Math.PI / 2 },
    },
  });
  G.country = { points, ground: H };
  return G.country;
}

function mergeTwo(a, b) {
  const g = new THREE.BufferGeometry();
  for (const k of ['position', 'normal', 'uv']) {
    const A = a.attributes[k].array, B = b.attributes[k].array;
    const arr = new Float32Array(A.length + B.length); arr.set(A); arr.set(B, A.length);
    g.setAttribute(k, new THREE.BufferAttribute(arr, a.attributes[k].itemSize));
  }
  const ia = a.index.array, ib = b.index.array, off = a.attributes.position.count;
  g.setIndex([...ia, ...[...ib].map((i) => i + off)]);
  return g;
}
