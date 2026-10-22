// 아스테리아 1부 — 장면 꾸미기: 블록 지도 위의 건물 외관, 문, 천장, 나무, 마법 장식
'use strict';

function buildBlockScene(m) {
  const g = new THREE.Group();
  m.anims = [];
  buildBlockMeshes(m, g);
  if (m.blds.length) for (const b of m.blds) facade(m, g, b);
  if (m.trees) plantTrees(m, g);
  if (m.ceil) ceiling(m, g);
  if (m.id === 'kalidor') kalidorExtras(m, g);
  return g;
}

// 학원 건물 외관
function facade(m, g, b) {
  const cs = m.cs, x0 = b.x * cs, z0 = b.y * cs, w = b.w * cs, d = b.h * cs, h = b.bh, cx = x0 + w / 2, cz = z0 + d / 2;
  const wall = mat(b.wall), trim = mat(0x8a7a6a), glass = GLOW(0xffd88a, 1.25), dark = mat(0x3a3448);
  // 처마돌림과 난간
  mesh(geo('box', w + 0.6, 0.5, d + 0.6), trim, cx, h - 0.25, cz, g);
  for (const [px, pz, pw, pd] of [[cx, z0 - 0.2, w + 0.6, 0.4], [cx, z0 + d + 0.2, w + 0.6, 0.4], [x0 - 0.2, cz, 0.4, d + 0.6], [x0 + w + 0.2, cz, 0.4, d + 0.6]]) mesh(geo('box', pw, 0.9, pd), wall, px, h + 0.45, pz, g);
  mesh(geo('box', w + 0.6, 0.6, d + 0.6), trim, cx, 0.3, cz, g);
  // 창문: 네 면
  const sideWin = (ax, az, bx, bz, nx, nz) => {
    const L_ = Math.hypot(bx - ax, bz - az), n = Math.floor(L_ / 3.2);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, x = lerp(ax, bx, t), z = lerp(az, bz, t);
      if (b.door && Math.hypot(x - b.door[0] * cs, z - b.door[1] * cs) < 2.4) continue;
      for (const y of h > 6.5 ? [2.6, h - 2.4] : [h * 0.5]) {
        const win = mesh(geo('box', 1.1, 1.6, 0.12), glass, x + nx * 0.02, y, z + nz * 0.02, g);
        win.rotation.y = Math.atan2(nx, nz);
        const fr = mesh(geo('box', 1.4, 0.18, 0.3), trim, x + nx * 0.1, y - 0.9, z + nz * 0.1, g); fr.rotation.y = win.rotation.y;
        const ar = mesh(geo('cyl', 0.55, 0.55, 0.14, 10, 1, false, 0, Math.PI), trim, x + nx * 0.05, y + 0.8, z + nz * 0.05, g); ar.rotation.set(Math.PI / 2, 0, -Math.atan2(nx, nz) + Math.PI / 2);
        win.userData.win = true;
      }
    }
  };
  sideWin(x0, z0 + d, x0 + w, z0 + d, 0, 1); sideWin(x0, z0, x0 + w, z0, 0, -1); sideWin(x0, z0, x0, z0 + d, -1, 0); sideWin(x0 + w, z0, x0 + w, z0 + d, 1, 0);
  // 문
  if (b.door) {
    const side = b.doorSide || 's';
    const dx = b.door[0] * cs, dz = b.door[1] * cs;
    const rot = side === 's' ? 0 : side === 'n' ? Math.PI : -Math.PI / 2;
    const dg = new THREE.Group(); dg.position.set(dx, 0, dz); dg.rotation.y = rot; g.add(dg);
    mesh(geo('box', 2.4, 3.2, 0.3), mat(0x5a3a28), 0, 1.6, 0.06, dg);
    mesh(geo('box', 3.2, 0.5, 0.6), trim, 0, 3.4, 0.2, dg);
    for (const sx of [-1.4, 1.4]) mesh(geo('box', 0.4, 3.6, 0.5), trim, sx, 1.8, 0.2, dg);
    mesh(geo('box', 3.6, 0.25, 1.4), trim, 0, 0.12, 0.8, dg);
    mesh(geo('sph', 0.09), mat(0xd8b25a, { metal: 0.7 }), 0.7, 1.5, 0.25, dg);
    const lamp = mesh(geo('sph', 0.2), GLOW(0xffd88a, 2.2), 1.8, 2.8, 0.5, dg);
    m.ents.push(makeEnt('deco', dx + Math.sin(rot) * 0 + (side === 'w' ? 0 : 1.8), dz + (side === 's' ? 0.6 : side === 'n' ? -0.6 : 1.8), { kind: 'lightonly', id: 'dl:' + b.name, light: { c: 0xffc070, k: 1.0, d: 8, h: 2.8 } }));
  }
  if (b.dome) {
    const dm = mesh(geo('sph', Math.min(w, d) * 0.36, 28, 14), mat(0x8aa8d8, { rough: 0.3, metal: 0.4, flat: false }), cx, h, cz, g); dm.scale.y = 0.75;
    mesh(geo('cyl', Math.min(w, d) * 0.37, Math.min(w, d) * 0.37, 1.2, 28), mat(b.wall), cx, h + 0.4, cz, g);
    const lan = mesh(geo('cyl', 0.8, 1, 2.4, 10), mat(b.wall), cx, h + Math.min(w, d) * 0.27 + 1, cz, g);
    const cr = mesh(geo('oct', 0.7), GLOW(0x7ff0ff, 2.6), cx, h + Math.min(w, d) * 0.27 + 3, cz, g);
    m.anims.push(t => { cr.rotation.y = t; cr.position.y = h + Math.min(w, d) * 0.27 + 3 + Math.sin(t * 1.3) * 0.25; });
  }
  if (b.spire) {
    mesh(geo('cyl', 1.6, 1.9, 8, 10), mat(b.wall), x0 + w - 3, h + 4, z0 + 3, g);
    mesh(geo('cone', 2.2, 5, 10), mat(b.roof), x0 + w - 3, h + 10.5, z0 + 3, g);
    const rings = [0, 1].map(i => mesh(geo('tor', 2.6 + i * 0.6, 0.06, 6, 32), GLOW(0xc8a0ff, 2), x0 + w - 3, h + 6 + i, z0 + 3, g));
    m.anims.push(t => rings.forEach((r, i) => { r.rotation.x = Math.PI / 2 + Math.sin(t * 0.7 + i) * 0.3; r.rotation.y = t * (i ? -0.5 : 0.4); }));
  }
  if (b.tower) {
    const [tx, tz] = [b.tower[0] * cs, b.tower[1] * cs];
    mesh(geo('box', 4.4, 9, 4.4), mat(b.wall), tx, h + 4.5, tz, g);
    mesh(geo('cone', 3.6, 5, 4), mat(b.roof), tx, h + 11.5, tz, g).rotation.y = Math.PI / 4;
    const face = mesh(geo('circle', 1.4, 24), GLOW(0xfff0c8, 1.4), tx, h + 6.5, tz + 2.22, g);
    const hand = mesh(new THREE.BoxGeometry(0.12, 1.1, 0.05).translate(0, 0.5, 0), mat(0x3a2a1a), tx, h + 6.5, tz + 2.26, g);
    m.anims.push(t => { hand.rotation.z = -(G.time / 60) / 12 * Math.PI * 2; });
  }
  if (b.chimney) {
    mesh(geo('box', 1.4, 3.4, 1.4), mat(0x8a6a5a), x0 + w - 3, h + 1.7, z0 + d - 3, g);
    m.anims.push(() => { if (Math.random() < 0.15) FX.spawn({ x: x0 + w - 3 + rand(-0.3, 0.3), y: h + 3.6, z: z0 + d - 3, vx: 0.6, vy: 1.2, life: 2.5, size: 0.9, c: 0xc8c4c0, add: false, a: 0.35, shrink: false, drag: 0.3 }); });
  }
  if (b.flat) {
    // 상가: 차양과 화분
    mesh(geo('box', w * 0.9, 0.12, 2), mat(b.roof), cx, 3.2, z0 + d + 0.9, g).rotation.x = 0.25;
    for (const sx of [-w * 0.3, w * 0.3]) mesh(geo('cyl', 0.5, 0.4, 0.6, 8), mat(0x9a5a3a), cx + sx, h + 1.2, cz, g);
  }
  g.children.forEach(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
}
function plantTrees(m, g) {
  const geos = makeTreeGeos(), cs = m.cs;
  const vc = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true });
  const im = new THREE.InstancedMesh(geos.oak, vc, m.trees.length);
  const mx = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
  m.trees.forEach(([tx, ty], k) => {
    const x = (tx + 0.5) * cs, z = (ty + 0.5) * cs, s = 0.9 + hash2(k, 7) * 0.4;
    q.setFromAxisAngle(V3(0, 1, 0), hash2(k, 3) * 6.28);
    mx.compose(V3(x, m.ground(x, z), z), q, V3(s, s, s)); im.setMatrixAt(k, mx);
    im.setColorAt(k, c.set([0x5fae4a, 0x4f9a42, 0x6ab84a][k % 3]));
    addStatic(m, { x, z, r: 0.45, top: 7 });
  });
  im.castShadow = true; im.receiveShadow = true;
  g.add(im);
}
function ceiling(m, g) {
  const W = m.W, D = m.D, h = m.ceil;
  const c = mesh(geo('plane', W, D), mat(m.style === 'wood' ? 0x4a3424 : m.style === 'ruin' ? 0x3a3448 : m.style === 'mine' ? 0x1a1418 : m.style === 'salt' ? 0xb8c4cc : 0x4a3a34, { side: THREE.DoubleSide }), W / 2, h, D / 2, g);
  c.rotation.x = Math.PI / 2; c.receiveShadow = true;
  const beam = mat(m.style === 'ruin' ? 0x5a5070 : 0x3a2418);
  for (let x = 4; x < W; x += 6) mesh(geo('box', 0.5, 0.6, D), beam, x, h - 0.3, D / 2, g);
}
function kalidorExtras(m, g) {
  // 성문
  const gx = 32 * m.cs, wm = mat(0xd8cbb0);
  for (const sx of [-5, 5]) { mesh(geo('cyl', 1.6, 1.9, 13, 10), wm, gx + sx, 6.5, 1, g); mesh(geo('cone', 2.2, 3, 10), mat(0x4a5a9a), gx + sx, 14.5, 1, g); }
  mesh(geo('box', 11, 2, 2.4), wm, gx, 10.5, 1, g);
  const crest = mesh(geo('oct', 0.8), GLOW(0x7ff0ff, 2.4), gx, 12.5, 1.6, g);
  m.anims.push(t => { crest.rotation.y = t; });

}
