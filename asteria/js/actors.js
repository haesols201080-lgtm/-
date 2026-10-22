// 아스테리아 1부 — 등장하는 것들: 사람 뼈대와 동작, 잔향, 동물, 퍼즐 장치, 보스 (위치는 미터)
'use strict';

const ET = {};
function makeEnt(type, x, z, props = {}) {
  const e = Object.assign({ type, x, z, y: 0, yaw: 0, r: 0.45 }, props);
  if (props.exactM) { e.x = props.exactM[0]; e.z = props.exactM[1]; }
  if (!e.id) e.id = type + ':' + Math.round(e.x) + ',' + Math.round(e.z);
  const d = ET[type];
  if (d && d.init) d.init(e);
  return e;
}
const shown = e => !e.dead && (!e.show || e.show());
const pdist = e => Math.hypot(e.x - P.x, e.z - P.z);
const groundY = e => standHeight(e.x, e.z, (e.y || 0) + 1, 0.8);

// ======================================================================
// 사람 뼈대
// ======================================================================
function makeRig(look = {}, o = {}) {
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const ghost = o.ghost;
  const M_ = c => ghost || mat(c, { flat: false, rough: 0.75 });
  const skin = M_(look.skin || '#f3d3b5'), cloth = M_(look.body || '#e8e0cf'), cloak = M_(look.cloak || '#3b6ea8'), hair = M_(look.hair || '#4a3324'), dark = ghost || mat('#2a2230');
  const hips = new THREE.Group(); hips.position.y = 0.92; body.add(hips);
  const torso = new THREE.Group(); hips.add(torso);
  mesh(geo('cyl', 0.2, 0.26, 0.62, 10), cloth, 0, 0.3, 0, torso);
  mesh(geo('cyl', 0.27, 0.3, 0.2, 10), cloak, 0, 0.62, 0, torso);
  // 망토
  const cape = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.52, 1.05, 12, 1, true, Math.PI * 0.55, Math.PI * 0.9), ghost || mat(look.cloak || '#3b6ea8', { side: THREE.DoubleSide, flat: false }));
  cape.position.set(0, 0.16, -0.02); torso.add(cape);
  const head = new THREE.Group(); head.position.y = 0.92; torso.add(head);
  mesh(geo('sph', 0.21, 14, 10), skin, 0, 0, 0, head);
  const hr = mesh(geo('sph', 0.225, 14, 10), hair, 0, 0.05, -0.03, head); hr.scale.set(1, 0.9, 1.02);
  if (!look.mask) { mesh(geo('sph', 0.028, 6, 4), dark, -0.075, 0.0, 0.19, head); mesh(geo('sph', 0.028, 6, 4), dark, 0.075, 0.0, 0.19, head); }
  if (look.hat) { mesh(geo('cyl', 0.34, 0.34, 0.04, 14), M_(look.hat), 0, 0.17, 0, head); mesh(geo('cyl', 0.19, 0.21, 0.24, 12), M_(look.hat), 0, 0.3, 0, head); }
  if (look.scarf) mesh(geo('tor', 0.17, 0.06, 6, 14), M_(look.scarf), 0, -0.2, 0, head).rotation.x = Math.PI / 2;
  if (look.mask) {
    const mk = mesh(geo('sph', 0.215, 14, 10, 0), M_(look.mask), 0, 0, 0.035, head); mk.scale.set(1, 1.05, 0.9);
    mesh(geo('box', 0.08, 0.03, 0.02), dark, -0.08, 0.02, 0.21, head); mesh(geo('box', 0.08, 0.03, 0.02), dark, 0.08, 0.02, 0.21, head);
    if (look.crack) { const c = mesh(geo('box', 0.02, 0.26, 0.02), GLOW('#7ff0ff', 2.5), 0.03, 0.02, 0.215, head); c.rotation.z = 0.3; }
  }
  const limb = (x, y, len, w, m) => { const g = new THREE.Group(); g.position.set(x, y, 0); const s = mesh(geo('cyl', w, w * 0.85, len, 8), m, 0, -len / 2, 0, g); s.castShadow = true; return g; };
  const armL = limb(-0.3, 0.6, 0.62, 0.07, cloth), armR = limb(0.3, 0.6, 0.62, 0.07, cloth);
  torso.add(armL); torso.add(armR);
  mesh(geo('sph', 0.07, 8, 6), skin, 0, -0.64, 0, armL); mesh(geo('sph', 0.07, 8, 6), skin, 0, -0.64, 0, armR);
  const legL = limb(-0.12, 0, 0.9, 0.09, M_(look.legs || '#4a4058')), legR = limb(0.12, 0, 0.9, 0.09, M_(look.legs || '#4a4058'));
  hips.add(legL); hips.add(legR);
  mesh(geo('box', 0.14, 0.08, 0.26), dark, 0, -0.9, 0.05, legL); mesh(geo('box', 0.14, 0.08, 0.26), dark, 0, -0.9, 0.05, legR);
  let rod = null;
  if (o.rod) {
    rod = new THREE.Group(); rod.position.set(0, -0.62, 0.02); armR.add(rod);
    mesh(geo('cyl', 0.025, 0.03, 1.25, 6), mat('#7a5a3a'), 0, 0.15, 0, rod);
    mesh(geo('tor', 0.07, 0.02, 6, 12), mat('#c8a04a', { metal: 0.7, rough: 0.3 }), 0, 0.82, 0, rod);
    rod.tip = mesh(geo('oct', 0.07), GLOW('#9ff4ff', 2.6), 0, 0.84, 0, rod);
  }
  if (o.glider) {
    const gl = new THREE.Mesh(new THREE.ConeGeometry(1.2, 0.5, 4, 1, true), mat('#2f7f7a', { side: THREE.DoubleSide }));
    gl.scale.set(1.3, 1, 0.5); gl.rotation.y = Math.PI / 4; gl.position.y = 2.25; gl.visible = false; body.add(gl);
    root.glider = gl;
  }
  root.traverse(m => { if (m.isMesh && !ghost) { m.castShadow = true; } });
  Object.assign(root, { body, hips, torso, head, armL, armR, legL, legR, cape, rod, ph: Math.random() * 6 });
  root.scale.setScalar(look.scale || o.scale || 1);
  return root;
}
// 동작: idle walk run climb glide swim fall attack cast sit
function animRig(r, s, dt) {
  r.ph += dt * (s.mode === 'run' ? 11 : s.mode === 'walk' ? 7.5 : s.mode === 'climb' ? 5 : s.mode === 'swim' ? 4 : 2);
  const p = r.ph, A = (o, x, y, z) => { o.rotation.set(x, y || 0, z || 0); };
  let la = 0, ra = 0, ll = 0, rl = 0, lean = 0, bob = 0, az = 0.08, hy = 0.92;
  switch (s.mode) {
    case 'walk': la = Math.sin(p) * 0.6; ra = -la; ll = -Math.sin(p) * 0.65; rl = -ll; bob = Math.abs(Math.sin(p)) * 0.04; lean = 0.06; break;
    case 'run': la = Math.sin(p) * 1.1; ra = -la; ll = -Math.sin(p) * 1.0; rl = -ll; bob = Math.abs(Math.sin(p)) * 0.08; lean = 0.22; break;
    case 'climb': la = -2.6 + Math.sin(p) * 0.4; ra = -2.6 - Math.sin(p) * 0.4; ll = -0.5 + Math.sin(p) * 0.5; rl = -0.5 - Math.sin(p) * 0.5; lean = -0.1; break;
    case 'glide': la = -2.9; ra = -2.9; ll = 0.2; rl = 0.35; lean = 0.15; az = 0.25; break;
    case 'swim': la = Math.sin(p) * 1.4 - 1.2; ra = Math.sin(p + Math.PI) * 1.4 - 1.2; ll = Math.sin(p * 1.3) * 0.4; rl = -ll; lean = 1.1; hy = 0.55; break;
    case 'fall': la = -2.2; ra = -2.0; ll = 0.4; rl = -0.3; break;
    case 'sit': ll = -1.5; rl = -1.5; la = -0.3; ra = -0.3; hy = 0.5; break;
    case 'kneel': ll = -1.2; rl = 0.3; la = -0.3; ra = -0.6; hy = 0.62; lean = 0.25; break;
    default: la = Math.sin(p * 0.6) * 0.04; ra = -la; bob = Math.sin(p) * 0.01;
  }
  if (s.atk > 0) { const k = 1 - s.atk / 0.28; ra = -2.4 + k * 3.2; }
  if (s.cast > 0) { ra = -2.0 - Math.min(1, s.cast) * 0.6; }
  A(r.armL, la, 0, az); A(r.armR, ra, 0, -az);
  A(r.legL, ll); A(r.legR, rl);
  r.hips.position.y = hy + bob;
  r.torso.rotation.x = lean;
  r.cape.rotation.x = s.mode === 'run' || s.mode === 'glide' ? 0.35 + Math.sin(p * 2) * 0.05 : 0.05 + Math.sin(p * 0.5) * 0.02;
  if (r.glider) r.glider.visible = s.mode === 'glide';
}

// 잔향 재질 (반투명하게 빛나는 몸)
const _ghost = {};
function ghostMat(c) {
  if (_ghost[c]) return _ghost[c];
  return _ghost[c] = new THREE.MeshStandardMaterial({ color: COL(c), emissive: COL(c), emissiveIntensity: 0.9, transparent: true, opacity: 0.55, roughness: 0.4, depthWrite: false });
}
const TINT = { salt: '#e8f4ff', time: '#ffc880', mine: '#c89a70', frost: '#b8e8ff', ruin: '#c0b0ff' };

// ======================================================================
// 공통: 이동, 충돌, 피해
// ======================================================================
function canWalk(x, z, fromY, r = 0.4) {
  const m = G.map, g = m.ground(x, z);
  if (g - fromY > 0.7) return false;
  if (m.kind === 'terrain' && (m.flagAt(x, z) & FL.VOID)) return false;
  const w = m.waterAt(x, z);
  if (w !== null && w - g > 0.8) return false;
  for (const c of collidersNear(x, z, r + 1)) if (!c.mob && insideCol(c, x, z, r) && c.top > fromY + 0.7 && (c.bot ?? -99) < fromY + 1.7) return false;
  return true;
}
function moveEnt(e, dx, dz) {
  if (canWalk(e.x + dx, e.z, e.y, e.r)) e.x += dx;
  if (canWalk(e.x, e.z + dz, e.y, e.r)) e.z += dz;
  e.y = lerp(e.y, groundY(e), 0.4);
}
function faceTo(e, x, z, k = 0.2) { const a = Math.atan2(x - e.x, z - e.z); e.yaw += angDiff(e.yaw, a) * k; }
function spawn(type, x, z, props = {}) {
  props.id = props.id || type + ':' + Math.random().toString(36).slice(2);
  const e = makeEnt(type, x, z, props);
  if (props.y !== undefined) e.y = props.y; else e.y = groundY(e);
  G.map.ents.push(e); return e;
}

// ======================================================================
// 사람
// ======================================================================
ET.npc = {
  init(e) { e.hx = e.x; e.hz = e.z; e.wt = rand(2); e.vx = 0; e.vz = 0; e.r = 0.4 * ((e.look && e.look.scale) || 1); e.yaw = rand(6); },
  col: e => ({ x: e.x, z: e.z, r: e.r, top: e.y + 1.8, bot: e.y, mob: true, self: e }),
  update(e, dt) {
    e.y = groundY(e);
    if (e.wander && !G.lock) {
      e.wt -= dt;
      if (e.wt <= 0) { e.wt = rand(2, 5); if (Math.random() < 0.5) { e.vx = e.vz = 0; } else { const a = rand(6.28); e.vx = Math.sin(a) * 1.1; e.vz = Math.cos(a) * 1.1; } }
      const nx = e.x + e.vx * dt, nz = e.z + e.vz * dt;
      if (Math.hypot(nx - e.hx, nz - e.hz) < e.wander * (G.map.cs || WS) && canWalk(nx, nz, e.y)) { e.x = nx; e.z = nz; if (e.vx || e.vz) faceTo(e, e.x + e.vx, e.z + e.vz, 0.1); }
      else { e.vx = -e.vx; e.vz = -e.vz; }
    }
    if (pdist(e) < 4.5) faceTo(e, P.x, P.z, 0.12);
  },
  model: e => makeRig(e.look, {}),
  sync(e, o, dt) {
    animRig(o, { mode: e.sit ? 'sit' : (e.vx || e.vz) && e.wander ? 'walk' : 'idle' }, dt);
    if (pdist(e) < 7 && e.name) label(e.x, e.y + 2.25 * ((e.look && e.look.scale) || 1), e.z, e.name, e.shop ? '#ffe08a' : '#fff');
  },
  interact(e) { if (e.talk) TALK[e.talk](e); },
  prompt: e => e.talk ? (e.shop ? '말 걸기 · 상점' : '말 걸기') : null,
};
ET.ally = {
  init(e) { e.r = 0.4; e.cd = 0; e.mv = false; },
  update(e, dt) {
    e.cd -= dt;
    let tgt = null, best = 9;
    for (const o of G.map.ents) if (o.type === 'echo' && shown(o) && !o.watcher) { const d = Math.hypot(o.x - e.x, o.z - e.z); if (d < best) { best = d; tgt = o; } }
    const bx = P.x - Math.sin(P.yaw) * 1.8 + Math.cos(P.yaw) * 1.2, bz = P.z - Math.cos(P.yaw) * 1.8 - Math.sin(P.yaw) * 1.2;
    const gx = tgt ? tgt.x : bx, gz = tgt ? tgt.z : bz;
    const d = Math.hypot(gx - e.x, gz - e.z);
    e.mv = d > (tgt ? 1.4 : 0.8);
    if (e.mv) { const sp = d > 10 ? 9 : 5.5; moveEnt(e, (gx - e.x) / d * sp * dt, (gz - e.z) / d * sp * dt); faceTo(e, gx, gz, 0.2); }
    if (Math.hypot(e.x - P.x, e.z - P.z) > 18 || Math.abs(e.y - P.y) > 6) { e.x = P.x - Math.sin(P.yaw) * 1.5; e.z = P.z - Math.cos(P.yaw) * 1.5; e.y = P.y; FX.burst(e.x, e.y + 1, e.z, 10, 0xffd890, 2, 0.5, 0.25); }
    if (tgt && best < 1.9 && e.cd <= 0) { e.cd = 0.9; e.atk = 0.28; damageEnt(tgt, 2, e.x, e.z); sfx('swing'); }
    if (e.atk > 0) e.atk -= dt;
  },
  model: () => makeRig(KASSIAN_LOOK, {}),
  sync(e, o, dt) { animRig(o, { mode: e.mv ? 'run' : 'idle', atk: e.atk || 0 }, dt); },
};

// 안내판, 수배 전단
ET.sign = {
  init(e) { e.r = 0.4; },
  col: e => ({ x: e.x, z: e.z, r: 0.4, top: e.y + 1.6 }),
  model() { const g = new THREE.Group(); mesh(geo('box', 0.14, 1.4, 0.14), mat('#7a5636'), 0, 0.7, 0, g); mesh(geo('box', 1.2, 0.7, 0.1), mat('#c79a62'), 0, 1.35, 0, g); shadowAll(g); return g; },
  interact(e) { runScript(async () => { for (const t of [].concat(e.text)) await say(e.title || '안내판', t); }); },
  prompt: () => '읽기',
};
ET.poster = Object.assign({}, ET.sign, {
  model() { const g = new THREE.Group(); mesh(geo('box', 0.14, 1.8, 0.14), mat('#5a4a3a'), 0, 0.9, 0, g); mesh(geo('box', 1.0, 1.3, 0.05), mat('#efe2c4'), 0, 1.5, 0.08, g); mesh(geo('box', 0.8, 0.16, 0.06), mat('#9a2b2b'), 0, 1.95, 0.09, g); return g; },
  interact(e) { TALK[e.talk](e); },
});

ET.chest = {
  init(e) { e.r = 0.6; e.open = isDone(e.id); },
  col: e => ({ x: e.x, z: e.z, hw: 0.6, hd: 0.45, top: e.y + 0.8, stand: true }),
  model(e) {
    const g = new THREE.Group();
    mesh(geo('box', 1.2, 0.6, 0.85), mat('#8f5f34'), 0, 0.3, 0, g);
    const lid = new THREE.Group(); lid.position.set(0, 0.6, -0.42); g.add(lid);
    mesh(geo('box', 1.22, 0.24, 0.87), mat('#9a6a3a'), 0, 0.12, 0.42, lid);
    for (const x of [-0.45, 0.45]) mesh(geo('box', 0.08, 0.64, 0.9), mat('#d8b25a', { metal: 0.6, rough: 0.4 }), x, 0.32, 0, g);
    mesh(geo('box', 0.16, 0.2, 0.06), mat('#d8b25a', { metal: 0.7 }), 0, 0.55, 0.45, g);
    g.lid = lid; shadowAll(g); return g;
  },
  sync(e, o, dt) {
    o.lid.rotation.x = lerp(o.lid.rotation.x, e.open ? -1.9 : 0, 0.15);
    if (!e.open && Math.random() < 0.08) FX.spawn({ x: e.x + rand(-0.5, 0.5), y: e.y + 0.8, z: e.z + rand(-0.4, 0.4), vy: 0.6, life: 0.9, size: 0.12, c: 0xfff3b0 });
  },
  interact(e) {
    if (e.open) return;
    e.open = true; markDone(e.id); sfx('open');
    FX.burst(e.x, e.y + 0.9, e.z, 20, 0xffe7a0, 3, 0.8, 0.2);
    if (e.weapon) giveWeapon(e.weapon);
    if (e.item) give(e.item, e.n || 1);
    if (e.coins) addCoins(e.coins);
    if (e.onOpen) e.onOpen(e);
  },
  prompt: e => e.open ? null : '열기',
};

ET.collect = {
  init(e) { e.taken = isDone(e.id); },
  model() { const g = new THREE.Group(); const p = mesh(geo('box', 0.42, 0.56, 0.02), mat('#f6ecd2', { flat: false }), 0, 0, 0, g); const h = mesh(geo('sph', 0.5, 10, 8), ADD('#fff3b0', 1.2, 0.18), 0, 0, 0, g); g.paper = p; return g; },
  sync(e, o, dt) { if (e.taken) { o.visible = false; return; } o.position.y = e.y + 1.1 + Math.sin(GFX.t * 2 + e.x) * 0.12; o.paper.rotation.y += dt * 1.2; if (Math.random() < 0.06) FX.spawn({ x: e.x, y: o.position.y, z: e.z, vy: 0.5, life: 1, size: 0.1, c: 0xfff3b0 }); },
  interact(e) { if (e.taken) return; e.taken = true; markDone(e.id); addJournal(e.key); },
  prompt: e => e.taken ? null : '살펴보기',
};

ET.forage = {
  init(e) { e.cd = 0; },
  update(e, dt) { if (e.cd > 0) e.cd -= dt; },
  model(e) {
    const g = new THREE.Group(), k = e.item;
    g.fruits = [];
    if (k === 'berry' || k === 'apple') {
      for (const [x, y, z, s] of [[0, 0.45, 0, 0.55], [0.35, 0.35, 0.1, 0.4], [-0.3, 0.35, -0.1, 0.42]]) mesh(geo('ico', s, 1), mat('#3f8a46'), x, y, z, g);
      for (let i = 0; i < 5; i++) g.fruits.push(mesh(geo('sph', k === 'berry' ? 0.07 : 0.1, 8, 6), GLOW(k === 'berry' ? '#ff5a7a' : '#ff9a3a', 1.1), Math.cos(i * 1.3) * 0.45, 0.4 + (i % 3) * 0.15, Math.sin(i * 1.3) * 0.45, g));
    } else if (k === 'mushroom') {
      for (let i = 0; i < 3; i++) { const x = (i - 1) * 0.22; mesh(geo('cyl', 0.04, 0.05, 0.2), mat('#efe6d4'), x, 0.1, 0, g); g.fruits.push(mesh(geo('sph', 0.12, 10, 6), GLOW('#c6f06a', 1.6), x, 0.22, 0, g)); }
    } else if (k === 'pepper') {
      mesh(geo('ico', 0.35, 1), mat('#5a8a3a'), 0, 0.3, 0, g);
      for (let i = 0; i < 3; i++) g.fruits.push(mesh(geo('cone', 0.06, 0.24, 6), GLOW('#ff4a2a', 1.4), Math.cos(i * 2) * 0.3, 0.32, Math.sin(i * 2) * 0.3, g));
    } else if (k === 'manabloom') {
      mesh(geo('cyl', 0.02, 0.03, 0.6), mat('#3e8a4a'), 0, 0.3, 0, g);
      for (let i = 0; i < 6; i++) { const p = mesh(geo('sph', 0.09, 6, 4), GLOW('#9ff4ff', 2.2), Math.cos(i) * 0.12, 0.62, Math.sin(i) * 0.12, g); p.scale.set(1, 0.4, 1.6); p.rotation.y = i; g.fruits.push(p); }
    } else if (k === 'pantry') {
      mesh(geo('box', 1.2, 1.0, 0.9), mat('#a5774a'), 0, 0.5, 0, g);
      g.fruits.push(mesh(geo('sph', 0.15), mat('#ff8a3a'), -0.2, 1.05, 0, g)); g.fruits.push(mesh(geo('sph', 0.14), mat('#e6c870'), 0.2, 1.05, 0.1, g));
    } else {
      for (let i = 0; i < 6; i++) { const b = mesh(geo('cone', 0.04, 0.5, 4), mat('#3e8a4a'), Math.cos(i) * 0.12, 0.25, Math.sin(i) * 0.12, g); b.rotation.set(Math.sin(i) * 0.4, 0, Math.cos(i) * 0.4); }
      g.fruits.push(mesh(geo('sph', 0.06), GLOW('#bff7ff', 2), 0, 0.52, 0, g));
    }
    shadowAll(g); return g;
  },
  sync(e, o) { for (const f of o.fruits) f.visible = e.cd <= 0; if (e.item === 'manabloom' && e.cd <= 0 && Math.random() < 0.05) FX.spawn({ x: e.x, y: e.y + 0.7, z: e.z, vy: 0.8, life: 1.2, size: 0.12, c: 0x9ff4ff }); },
  interact(e) {
    if (e.cd > 0) { toast('아직 다시 자라지 않았다'); return; }
    if (e.give) { for (const [k, c] of e.give) give(k, c); } else give(e.item, e.n || 1);
    e.cd = e.regrow || 120;
    FX.burst(e.x, e.y + 0.5, e.z, 10, e.item === 'manabloom' ? 0x9ff4ff : 0xbff7a0, 2, 0.5, 0.15);
  },
  prompt: e => e.cd > 0 ? null : (e.item === 'pantry' ? '재료 꺼내기' : '채집'),
};

// 문, 계단, 입구 (닿으면 이동)
ET.warp = {
  init(e) { e.cool = 0; e.rad = e.rad || 1.4; },
  update(e, dt) {
    if (e.cool > 0) { e.cool -= dt; return; }
    if (G.lock || G.mapCool > 0) return;
    if (Math.hypot(e.x - P.x, e.z - P.z) < e.rad && Math.abs(P.y - e.y) < 3) {
      if (e.cond && !e.cond()) {
        e.cool = 2.5;
        if (e.locked) runScript(async () => { await say('렌', typeof e.locked === 'function' ? e.locked() : e.locked); });
        const dx = P.x - e.x, dz = P.z - e.z, l = Math.hypot(dx, dz) || 1; P.x = e.x + dx / l * (e.rad + 0.8); P.z = e.z + dz / l * (e.rad + 0.8);
        return;
      }
      goMap(e.to, e.tx, e.ty);
    }
  },
  model(e) {
    const g = new THREE.Group();
    if (e.look === 'stairs') { mesh(geo('box', 2.2, 0.05, 2.2), mat('#140e18'), 0, 0.03, 0, g); for (let i = 0; i < 4; i++) mesh(geo('box', 2, 0.2, 0.4), mat('#8a7a6a'), 0, -0.2 - i * 0.25, -0.8 + i * 0.45, g); }
    else if (e.look === 'cave') { mesh(geo('box', 3.2, 3.4, 0.4), mat('#0a080c'), 0, 1.7, -0.6, g); }
    else if (e.look === 'arch') {
      for (const x of [-1.6, 1.6]) mesh(geo('box', 0.6, 4, 0.6), mat('#d9cfb8'), x, 2, 0, g);
      mesh(geo('box', 3.8, 0.6, 0.6), mat('#d9cfb8'), 0, 4.2, 0, g);
      g.portal = mesh(geo('plane', 2.6, 3.8), ADD('#9ff4ff', 1.2, 0.35), 0, 1.95, 0, g); g.portal.material.side = THREE.DoubleSide;
    } else if (e.look === 'door') { mesh(geo('box', 2, 3, 0.3), mat('#6b4630'), 0, 1.5, -0.3, g); mesh(geo('sph', 0.08), mat('#d8b25a', { metal: 0.7 }), 0.6, 1.5, -0.1, g); }
    else if (e.look === 'lab' && G.map.kind === 'blocks') { const d = runeDisc('#7ff0ff', 2.4, 1.6); d.position.y = 0.04; g.add(d); g.disc = d; }
    return g;
  },
  sync(e, o, dt) {
    if (o.portal) o.portal.material.opacity = 0.25 + Math.sin(GFX.t * 2) * 0.1;
    if (o.disc) o.disc.rotation.z += dt * 0.5;
    if (e.label && pdist(e) < 14) label(e.x, e.y + 3.2, e.z, e.label, '#bff');
  },
};

// 모닥불과 화덕
ET.fire = {
  init(e) { e.r = 0.6; e.light = { c: 0xffa050, k: 1.8, d: 12, h: 0.8 }; },
  col: e => ({ x: e.x, z: e.z, r: 0.55, top: e.y + 0.5 }),
  model(e) {
    const g = new THREE.Group();
    if (e.look === 'hearth') { mesh(geo('box', 2.2, 1.6, 1.4), mat('#7a5a50'), 0, 0.8, -0.3, g); mesh(geo('box', 1.4, 0.9, 0.3), mat('#1a1010'), 0, 0.6, 0.42, g); }
    for (let i = 0; i < 4; i++) { const l = mesh(geo('cyl', 0.07, 0.08, 0.8, 6), mat('#6b4a2e'), 0, 0.12, 0, g); l.rotation.z = Math.PI / 2; l.rotation.y = i * Math.PI / 4; }
    for (let i = 0; i < 8; i++) mesh(geo('dod', 0.13), mat('#7a7a7a'), Math.cos(i * 0.8) * 0.5, 0.08, Math.sin(i * 0.8) * 0.5, g);
    g.f1 = mesh(geo('cone', 0.28, 0.8, 7), GLOW('#ff7a2a', 2.4), 0, 0.5, 0, g);
    g.f2 = mesh(geo('cone', 0.16, 0.5, 7), GLOW('#ffd25a', 3), 0, 0.45, 0, g);
    return g;
  },
  sync(e, o) {
    const f = 1 + Math.sin(GFX.t * 13 + e.x) * 0.12 + Math.sin(GFX.t * 7.3) * 0.08;
    o.f1.scale.set(1, f, 1); o.f2.scale.set(1, f * 1.1, 1);
    if (Math.random() < 0.25) FX.spawn({ x: e.x + rand(-0.2, 0.2), y: e.y + 0.7, z: e.z + rand(-0.2, 0.2), vx: rand(-0.3, 0.3), vy: rand(1, 2.2), vz: rand(-0.3, 0.3), life: 0.9, size: 0.08, c: 0xffa040, drag: 0.5 });
  },
  interact(e) { openCook(e); },
  prompt: () => '요리하기',
};

// 관측탑 (꼭대기에 오르면 지도가 밝혀진다)
ET.tower = {
  init(e) { e.lit = isDone(e.id); },
  update(e) {
    const t = TOWERS.find(t => t.id === e.id);
    if (t && t.crystal) t.crystal.material = e.lit ? GLOW('#7ff0ff', 2.6) : GLOW('#ff8f5a', 2.4);
    if (t && t.crystal) t.crystal.rotation.y = GFX.t;
    if (!e.lit && !G.lock && P.mode === 'ground' && Math.hypot(P.x - e.x, P.z - (e.z - 3.2)) < 4 && P.y > groundY(e) + TOWER_H - 1) runScript(() => TALK.towerTop(e));
  },
  model: () => new THREE.Group(),
};

// 장식들
ET.deco = {
  init(e) { if (e.kind === 'lamp') e.light = { c: e.c === '#c0b0ff' ? 0xc0b0ff : 0xffd890, k: 1.2, d: 10, h: 2.4 }; if (e.kind === 'cityLight') e.light = { c: 0xffd27a, k: 2.4, d: 30, h: 6 }; },
  col(e) {
    const k = e.kind;
    if (k === 'table') return { x: e.x, z: e.z, hw: 1.1, hd: 0.6, top: e.y + 0.85, stand: true };
    if (k === 'bed') return { x: e.x, z: e.z, hw: 0.6, hd: 1.1, top: e.y + 0.6, stand: true };
    if (k === 'barrel') return { x: e.x, z: e.z, r: 0.45, top: e.y + 1, stand: true };
    if (k === 'statue') return { x: e.x, z: e.z, r: 0.9, top: e.y + 3.4, climb: true, stand: true };
    if (k === 'stall') return { x: e.x, z: e.z, hw: 1.3, hd: 0.7, top: e.y + 2.4 };
    if (k === 'tent') return { x: e.x, z: e.z, r: 1.6, top: e.y + 2.2 };
    if (k === 'lamp') return { x: e.x, z: e.z, r: 0.18, top: e.y + 2.6 };
    if (k === 'source') return { x: e.x, z: e.z, hw: 0.9, hd: 0.9, top: e.y + 1.4 };
    return null;
  },
  model(e) {
    const g = new THREE.Group(), k = e.kind;
    if (k === 'table') { mesh(geo('box', 2, 0.12, 1.1), mat('#9a6a42'), 0, 0.82, 0, g); for (const [x, z] of [[-0.85, -0.4], [0.85, -0.4], [-0.85, 0.4], [0.85, 0.4]]) mesh(geo('box', 0.1, 0.8, 0.1), mat('#7a4a2a'), x, 0.4, z, g); if (e.bread) mesh(geo('sph', 0.2, 8, 6), mat('#d9a055'), -0.3, 0.95, 0, g).scale.set(1.4, 0.7, 1); if (e.cups) { mesh(geo('cyl', 0.07, 0.06, 0.14), mat('#eeeeee'), 0.4, 0.95, 0.1, g); mesh(geo('cyl', 0.07, 0.06, 0.14), mat('#eeeeee'), 0.2, 0.95, -0.2, g); } }
    else if (k === 'bed') { mesh(geo('box', 1.1, 0.4, 2), mat('#7a5a42'), 0, 0.2, 0, g); mesh(geo('box', 1, 0.2, 1.4), mat(e.c || '#4a7ab8'), 0, 0.5, 0.25, g); mesh(geo('box', 0.8, 0.18, 0.4), mat('#f2efe8'), 0, 0.5, -0.7, g); }
    else if (k === 'barrel') { mesh(geo('cyl', 0.42, 0.42, 1, 10), mat('#8a5a34'), 0, 0.5, 0, g); for (const y of [0.25, 0.75]) mesh(geo('cyl', 0.44, 0.44, 0.06, 10), mat('#5a3a20', { metal: 0.4 }), 0, y, 0, g); }
    else if (k === 'lamp') { mesh(geo('cyl', 0.06, 0.08, 2.6, 6), mat('#3a3040', { metal: 0.5 }), 0, 1.3, 0, g); g.bulb = mesh(geo('sph', 0.22, 10, 8), GLOW(e.c || '#ffe7a0', 2.2), 0, 2.7, 0, g); mesh(geo('cone', 0.32, 0.3, 6), mat('#3a3040'), 0, 3.0, 0, g); }
    else if (k === 'flowerbed') { mesh(geo('cyl', 1, 1.1, 0.3, 12), mat('#7a5a3a'), 0, 0.15, 0, g); for (let i = 0; i < 10; i++) mesh(geo('sph', 0.1, 6, 4), mat(['#ff7ab0', '#ffd45a', '#ffffff', '#b090ff'][i % 4]), Math.cos(i) * 0.6, 0.4, Math.sin(i * 1.7) * 0.6, g); }
    else if (k === 'statue') { mesh(geo('box', 1.6, 1, 1.6), mat('#bcb4a6'), 0, 0.5, 0, g); const r = makeRig({ cloak: '#c8c0b4', body: '#d4ccc0', skin: '#d4ccc0', hair: '#bcb4a6' }); r.position.y = 1; r.scale.setScalar(1.3); animRig(r, { mode: 'idle' }, 0); r.armR.rotation.x = -2.6; g.add(r); }
    else if (k === 'stall') { mesh(geo('box', 2.6, 1, 1.2), mat('#9a6a42'), 0, 0.5, 0, g); for (const x of [-1.2, 1.2]) mesh(geo('box', 0.1, 2.4, 0.1), mat('#7a4a2a'), x, 1.2, 0.5, g); const aw = mesh(geo('box', 3, 0.1, 1.6), mat(e.c || '#e85a5a'), 0, 2.4, 0.2, g); aw.rotation.x = 0.2; }
    else if (k === 'tent') { const t = mesh(geo('cone', 1.8, 2.4, 4), mat(e.c || '#c8a46a', { side: THREE.DoubleSide }), 0, 1.2, 0, g); t.rotation.y = Math.PI / 4; }
    else if (k === 'window') { const w = mesh(geo('plane', 1.6, 1.6), GLOW('#9fd0ff', 1.1), 0, 2.4, 0.6, g); }
    else if (k === 'bench') { mesh(geo('box', 1.8, 0.1, 0.5), mat('#8a6a42'), 0, 0.5, 0, g); for (const x of [-0.7, 0.7]) mesh(geo('box', 0.1, 0.5, 0.4), mat('#5a4a32'), x, 0.25, 0, g); }
    else if (k === 'cityLight') { g.bulb = mesh(geo('sph', 0.8, 12, 10), GLOW('#ffd27a', 2.6), 0, 6, 0, g); mesh(geo('cyl', 0.1, 0.12, 6, 6), mat('#5a4a3a'), 0, 3, 0, g); }
    else if (k === 'boat') { const b = mesh(geo('box', 1.4, 0.5, 4), mat('#7a4a2a'), 0, 0.2, 0, g); const s = mesh(geo('cone', 1, 3, 3), mat('#eeeeee', { side: THREE.DoubleSide }), 0, 2, 0, g); s.scale.z = 0.1; }
    else if (k === 'festival') { g.lights = []; for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; g.lights.push(mesh(geo('sph', 0.16, 8, 6), GLOW(['#ff7ab0', '#ffd45a', '#7ff0ff', '#a0ff8a', '#ff9a5a'][i % 5], 2.6), Math.cos(a) * 9, 4 + Math.sin(i * 1.7) * 0.4, Math.sin(a) * 9, g)); } mesh(geo('cyl', 0.12, 0.14, 6, 6), mat('#7a5a3a'), 0, 3, 0, g); }
    else if (k === 'grave') { mesh(geo('box', 0.8, 1.1, 0.25), mat('#b8b4ac'), 0, 0.55, 0, g); mesh(geo('cyl', 0.5, 0.6, 0.12, 10), mat('#7a5a3a'), 0, 0.06, 0.6, g); }
    else if (k === 'source') { mesh(geo('box', 1.8, 1.4, 1.8), mat('#5a4a4a'), 0, 0.7, 0, g); g.bulb = mesh(geo('sph', 0.4), GLOW('#ff9a3a', 2.6), 0, 1.0, 0.8, g); }
    else if (k === 'runefloor') { const d = runeDisc('#7ff0ff', 8, 0.9); d.position.y = 0.03; g.add(d); g.disc = d; }
    else if (k === 'skydome') {
      // 대강당 천장: 매일 바뀌는 별자리
      const dm = mesh(geo('sph', 13, 32, 16), new THREE.MeshBasicMaterial({ color: 0x141a3a, side: THREE.BackSide }), 0, 5.5, 0, g); dm.scale.y = 0.4;
      const pts = new THREE.BufferGeometry(), P_ = [];
      for (let i = 0; i < 260; i++) { const a = rand(6.28), r = rand(2, 12.5); P_.push(Math.cos(a) * r, 5.5 + Math.sqrt(Math.max(0, 1 - (r / 13) ** 2)) * 13 * 0.4 - 0.2, Math.sin(a) * r); }
      pts.setAttribute('position', new THREE.Float32BufferAttribute(P_, 3));
      g.stars = new THREE.Points(pts, new THREE.PointsMaterial({ color: 0xcfe8ff, size: 0.14, transparent: true, opacity: 0.9 })); g.add(g.stars);
      for (let i = 0; i < 3; i++) { const r = mesh(geo('tor', 4 + i * 2.5, 0.03, 4, 48), GLOW('#c8a0ff', 1.4), 0, 8.2 - i * 0.4, 0, g); r.rotation.x = Math.PI / 2; }
    }
    else if (k === 'orrery') {
      mesh(geo('cyl', 0.35, 0.45, 0.3, 10), mat('#b88a3a', { metal: 0.7, rough: 0.3 }), 0, 0.95, 0, g);
      g.orr = new THREE.Group(); g.orr.position.y = 1.6; g.add(g.orr);
      mesh(geo('sph', 0.16), GLOW('#ffd27a', 2.6), 0, 0, 0, g.orr);
      for (let i = 0; i < 4; i++) { const ring = new THREE.Group(); ring.rotation.set(rand(-0.4, 0.4), 0, rand(-0.4, 0.4)); g.orr.add(ring); mesh(geo('tor', 0.3 + i * 0.16, 0.008, 4, 32), mat('#d8b25a', { metal: 0.8 }), 0, 0, 0, ring).rotation.x = Math.PI / 2; const pl = mesh(geo('sph', 0.04 + i * 0.01), GLOW(['#7ff0ff', '#ff9a5a', '#c8a0ff', '#a0ff8a'][i], 2), 0.3 + i * 0.16, 0, 0, ring); ring.userData.sp = 1.6 / (i + 1); }
      mesh(geo('box', 1.2, 0.8, 0.8), mat('#7a5a3a'), 0, 0.4, 0, g);
    }
    shadowAll(g); return g;
  },
  sync(e, o, dt) {
    if (o.bulb && e.kind === 'lamp') o.bulb.visible = !G.lampOff;
    if (o.bulb && e.kind === 'cityLight') o.bulb.visible = !G.f[e.flagOff];
    if (o.lights) o.lights.forEach((l, i) => l.position.y = 4 + Math.sin(GFX.t * 2 + i) * 0.3);
    if (o.disc) o.disc.rotation.z += dt * 0.15;
    if (o.stars) o.stars.rotation.y += dt * 0.02;
    if (o.orr) o.orr.children.forEach((r, i) => { if (r.userData.sp) r.rotation.y += dt * r.userData.sp; });
  },
};
// 하늘해파리 (마력 생물)
ET.jelly = {
  init(e) { e.hx = e.x; e.hz = e.z; e.ph = rand(6); e.fly = true; },
  update(e, dt) { e.ph += dt * 0.2; e.x = e.hx + Math.cos(e.ph) * 8; e.z = e.hz + Math.sin(e.ph * 1.3) * 6; e.y = G.map.ground(e.x, e.z) + 7 + Math.sin(e.ph * 3) * 1.5; },
  model() {
    const g = new THREE.Group();
    const d = mesh(geo('sph', 1, 14, 8, 0), new THREE.MeshStandardMaterial({ color: 0x9ff4ff, emissive: 0x5ac8e8, emissiveIntensity: 1.2, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide }), 0, 0, 0, g);
    d.scale.set(1, 0.6, 1);
    g.ten = [];
    for (let i = 0; i < 6; i++) g.ten.push(mesh(geo('cyl', 0.03, 0.01, 2.4, 4), ADD('#c0f8ff', 1.4, 0.5), Math.cos(i) * 0.5, -1.3, Math.sin(i) * 0.5, g));
    return g;
  },
  sync(e, o) { o.ten.forEach((t, i) => t.rotation.z = Math.sin(GFX.t * 2 + i) * 0.25); o.scale.setScalar(1 + Math.sin(GFX.t * 2 + e.ph) * 0.06); },
};

// ======================================================================
// 퍼즐 장치
// ======================================================================
ET.crate = {
  init(e) { e.metal = true; e.r = 0.7; e.hx = e.x; e.hz = e.z; e.vy = 0; },
  col: e => ({ x: e.x, z: e.z, hw: 0.72, hd: 0.72, top: e.y + 1.4, bot: e.y, stand: true, self: e }),
  update(e, dt) {
    const held = P.holding === e;
    if (held) {
      const tx = P.x + P.hold.x, tz = P.z + P.hold.z, ty = P.y + P.hold.y;
      const k = Math.min(1, dt * 9);
      const nx = lerp(e.x, tx, k), nz = lerp(e.z, tz, k);
      const g = G.map.ground(nx, nz);
      if (g < e.y + 0.6 || e.y > g) { e.x = nx; e.z = nz; }
      e.y = Math.max(lerp(e.y, ty, k), G.map.ground(e.x, e.z));
      e.vy = 0;
      if (Math.random() < 0.4) FX.spawn({ x: e.x + rand(-0.7, 0.7), y: e.y + rand(0, 1.4), z: e.z + rand(-0.7, 0.7), vy: 0.4, life: 0.5, size: 0.12, c: 0xff5ab0 });
    } else {
      const g = standHeight(e.x, e.z, e.y + 0.3, 0.3);
      if (e.y > g + 0.01) { e.vy -= 20 * dt; e.y = Math.max(g, e.y + e.vy * dt); }
      else { e.y = g; e.vy = 0; }
      const w = G.map.waterAt(e.x, e.z);
      if ((G.map.kind === 'terrain' && (G.map.flagAt(e.x, e.z) & FL.VOID) && e.y < -5) || (w !== null && w > e.y + 1.2)) { FX.burst(e.x, e.y + 0.7, e.z, 14, 0xaaaaaa, 3, 0.5, 0.2); e.x = e.hx; e.z = e.hz; e.y = G.map.ground(e.x, e.z) + 2; toast('상자가 떨어져서 처음 자리로 돌아왔다'); }
    }
  },
  model(e) {
    const g = new THREE.Group();
    if (e.look === 'cart') { mesh(geo('box', 1.4, 0.9, 1.9), mat('#6c6a70', { metal: 0.6, rough: 0.5 }), 0, 0.75, 0, g); for (const [x, z] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) mesh(geo('cyl', 0.25, 0.25, 0.12, 10), mat('#2a2830'), x, 0.25, z, g).rotation.z = Math.PI / 2; mesh(geo('box', 1.2, 0.3, 1.6), mat('#5a4a40'), 0, 1.25, 0, g); }
    else if (e.look === 'conduit') { mesh(geo('box', 1.3, 1.3, 1.3), mat('#b88a3a', { metal: 0.7, rough: 0.35 }), 0, 0.65, 0, g); mesh(geo('sph', 0.36), GLOW('#7ff0ff', 2.4), 0, 0.65, 0.5, g); mesh(geo('sph', 0.36), GLOW('#7ff0ff', 2.4), 0, 0.65, -0.5, g); }
    else { mesh(geo('box', 1.4, 1.4, 1.4), mat('#7a7e88', { metal: 0.7, rough: 0.45 }), 0, 0.7, 0, g); for (const r of [0.78, -0.78]) { const b = mesh(geo('box', 1.9, 0.12, 0.06), mat('#4a4e58', { metal: 0.8 }), 0, 0.7, 0.72, g); b.rotation.z = r; const b2 = b.clone(); b2.position.z = -0.72; g.add(b2); } }
    g.hl = mesh(geo('box', 1.6, 1.6, 1.6), ADD('#ff5ab0', 1.2, 0.25), 0, 0.7, 0, g); g.hl.visible = false;
    shadowAll(g); g.hl.castShadow = false; return g;
  },
  sync(e, o) { o.hl.visible = P.holding === e || (G.rune === 'magnes' && G.runes.magnes && P.aimMetal === e); o.hl.material.opacity = P.holding === e ? 0.3 : 0.12; },
};
ET.plate = {
  init(e) { e.on = false; },
  update(e) {
    let on = !e.crateOnly && Math.hypot(P.x - e.x, P.z - e.z) < 1 && Math.abs(P.y - e.y) < 0.6;
    for (const o of G.map.ents) if (o.type === 'crate' && Math.hypot(o.x - e.x, o.z - e.z) < 1.1 && o.y < e.y + 0.6 && P.holding !== o && (!e.need || o.look === e.need)) on = true;
    if (on && !e.on) { sfx('blip'); FX.burst(e.x, e.y + 0.2, e.z, 16, 0x8fe3a0, 2, 0.5, 0.18); if (e.onPress) e.onPress(e); }
    e.on = on;
  },
  model(e) { const g = new THREE.Group(); mesh(geo('box', 1.9, 0.12, 1.9), mat('#5a5a6a'), 0, 0.06, 0, g); g.top = mesh(geo('box', 1.5, 0.12, 1.5), mat(e.need === 'conduit' ? '#c8a050' : '#9a9aae'), 0, 0.16, 0, g); g.glow = mesh(geo('box', 1.52, 0.02, 1.52), GLOW('#8fe3a0', 2), 0, 0.23, 0, g); return g; },
  sync(e, o) { o.top.position.y = e.on ? 0.1 : 0.16; o.glow.visible = e.on; },
};
ET.gate = {
  init(e) { e.hw = e.hw || 2; e.openK = 0; e.isOpen = false; },
  col: e => e.openK > 0.6 ? null : ({ x: e.x, z: e.z, hw: e.hw, hd: 0.5, top: e.y + 6 }),
  update(e, dt) {
    const open = e.open || (e.cond && e.cond());
    if (open && !e.isOpen) { e.isOpen = true; sfx('open'); FX.burst(e.x, e.y + 2, e.z, 26, e.look === 'seal' ? 0x7ff0ff : 0xaaaaaa, 4, 0.7, 0.25); if (e.onOpen) e.onOpen(e); }
    if (!open && e.isOpen && e.cond) { e.isOpen = false; sfx('blip'); }
    e.openK = clamp(e.openK + (e.isOpen ? dt : -dt) * 1.4, 0, 1);
  },
  model(e) {
    const g = new THREE.Group(), w = e.hw * 2;
    if (e.look === 'seal') {
      mesh(geo('box', w, 6, 0.5), mat('#4a4a6a', { rough: 0.6 }), 0, 3, 0, g);
      const d = runeDisc('#7ff0ff', 3.2, 1.8); d.rotation.x = 0; d.position.set(0, 3, 0.27); g.add(d); g.disc = d;
      if (e.sockets) { g.sock = e.sockets.map((s, i) => mesh(geo('sph', 0.16), mat('#222'), -0.9 + i * 0.6, 1.0, 0.3, g)); }
    } else {
      for (let x = -w / 2 + 0.25; x < w / 2; x += 0.5) mesh(geo('box', 0.12, 6, 0.12), mat('#7a7e88', { metal: 0.7 }), x, 3, 0, g);
      for (const y of [1.2, 3, 4.8]) mesh(geo('box', w, 0.14, 0.14), mat('#5a5e68', { metal: 0.7 }), 0, y, 0, g);
    }
    shadowAll(g); return g;
  },
  sync(e, o, dt) {
    o.position.y = e.y - e.openK * 6.2;
    o.visible = e.openK < 0.99;
    if (o.disc) o.disc.rotation.z += dt * 0.4;
    if (o.sock) o.sock.forEach((s, i) => s.material = G.runes[e.sockets[i]] ? GLOW(RUNES[e.sockets[i]].c, 2.4) : mat('#222'));
  },
};
ET.spinner = {
  init(e) { e.a = 0; e.frozen = 0; e.stasis = true; e.len = e.len || 3; },
  update(e, dt) {
    if (e.cond && !e.cond()) return;
    if (e.frozen > 0) { e.frozen -= dt; return; }
    e.a += dt * (e.speed || 2.4);
    if (Math.abs(P.y - e.y) > 1.6) return;
    for (let k = 0; k < 2; k++) {
      const a = e.a + k * Math.PI;
      for (let s = 0.4; s <= e.len; s += 0.4) {
        if (Math.hypot(e.x + Math.cos(a) * s - P.x, e.z + Math.sin(a) * s - P.z) < 0.55) { hurtPlayer(2, e.x, e.z); return; }
      }
    }
  },
  model(e) {
    const g = new THREE.Group();
    mesh(geo('cyl', 0.35, 0.45, 1.2, 10), mat('#5a5060', { metal: 0.5 }), 0, 0.6, 0, g);
    const rot = new THREE.Group(); rot.position.y = 0.9; g.add(rot);
    for (const s of [1, -1]) { const b = mesh(geo('box', e.len, 0.08, 0.32), mat('#d8d0e0', { metal: 0.8, rough: 0.2 }), s * e.len / 2, 0, 0, rot); }
    g.rot = rot; g.ice = mesh(geo('sph', e.len + 0.3, 14, 8), ADD('#ffd27a', 1.2, 0.12), 0, 0.9, 0, g); g.ice.scale.y = 0.25;
    shadowAll(g); g.ice.castShadow = false; return g;
  },
  sync(e, o) { o.rot.rotation.y = -e.a; o.ice.visible = e.frozen > 0; },
  onStasis(e) { e.frozen = 6; return true; },
};
ET.pedestal = {
  init(e) { e.r = 0.6; },
  col: e => ({ x: e.x, z: e.z, r: 0.6, top: e.y + 1.1 }),
  model(e) { const g = new THREE.Group(); mesh(geo('cyl', 0.5, 0.65, 1.1, 8), mat('#8a8aa0'), 0, 0.55, 0, g); g.orb = mesh(geo('ico', 0.32, 1), GLOW(RUNES[e.rune].c, 2.4), 0, 1.7, 0, g); g.ring = runeDisc(RUNES[e.rune].c, 2.2, 1.4); g.ring.position.y = 1.12; g.add(g.ring); shadowAll(g); return g; },
  sync(e, o, dt) { const has = G.runes[e.rune]; o.orb.visible = !has; o.ring.visible = !has; o.orb.position.y = 1.7 + Math.sin(GFX.t * 2) * 0.12; o.orb.rotation.y += dt; o.ring.rotation.z += dt; if (!has && Math.random() < 0.2) FX.spawn({ x: e.x, y: e.y + 1.7, z: e.z, vx: rand(-1, 1), vy: rand(0, 1), vz: rand(-1, 1), life: 0.6, size: 0.12, c: COL(RUNES[e.rune].c).getHex() }); },
  interact(e) { if (!G.runes[e.rune]) learnRune(e.rune, e); },
  prompt: e => G.runes[e.rune] ? null : '룬 받기',
};
ET.lever = {
  init(e) { e.state = 0; e.cd = 0; e.r = 0.4; },
  col: e => ({ x: e.x, z: e.z, r: 0.4, top: e.y + 1 }),
  update(e, dt) { if (e.cd > 0) e.cd -= dt; },
  model(e) {
    const g = new THREE.Group();
    mesh(geo('box', 0.9, 0.5, 0.7), mat(e.look === 'arm' ? '#b88a3a' : '#6a6a7a', { metal: 0.5 }), 0, 0.25, 0, g);
    const h = new THREE.Group(); h.position.y = 0.5; g.add(h);
    mesh(geo('cyl', 0.05, 0.05, 1, 6), mat('#d8d0c0'), 0, 0.5, 0, h);
    mesh(geo('sph', 0.12), GLOW(e.c || '#e85a5a', 1.8), 0, 1.0, 0, h);
    g.h = h; shadowAll(g); return g;
  },
  sync(e, o) { o.h.rotation.x = lerp(o.h.rotation.x, e.state % 2 ? 0.7 : -0.7, 0.2); if (e.label && pdist(e) < 6) label(e.x, e.y + 1.8, e.z, e.label, '#ffe08a'); },
  interact(e) { if (e.cd > 0) return; e.cd = 0.6; e.state++; sfx('blip'); if (e.onUse) e.onUse(e); },
  prompt: e => e.verb || '당기기',
};
ET.pylon = {
  init(e) { e.on = isDone(e.id); e.r = 0.7; },
  col: e => ({ x: e.x, z: e.z, r: 0.7, top: e.y + 4 }),
  model() { const g = new THREE.Group(); mesh(geo('cyl', 0.5, 0.7, 3.6, 8), mat('#7a6a50'), 0, 1.8, 0, g); for (const y of [0.2, 3.5]) mesh(geo('cyl', 0.8, 0.8, 0.3, 8), mat('#b88a3a', { metal: 0.6 }), 0, y, 0, g); g.cr = mesh(geo('oct', 0.45), mat('#3a4a5a'), 0, 4.3, 0, g); shadowAll(g); return g; },
  sync(e, o, dt) { o.cr.material = e.on ? GLOW('#7ff0ff', 2.6) : mat('#3a4a5a'); o.cr.rotation.y += dt * (e.on ? 1.5 : 0.2); e.light = e.on ? { c: 0x7ff0ff, k: 1.6, d: 12, h: 4 } : null; },
  interact(e) {
    if (e.on) return;
    if (e.cond && !e.cond()) { runScript(async () => { await say('렌', e.hint); }); return; }
    e.on = true; markDone(e.id); sfx('chime'); FX.burst(e.x, e.y + 4.3, e.z, 40, 0x7ff0ff, 6, 1, 0.3);
    if (e.onOn) e.onOn(e);
  },
  prompt: e => e.on ? null : '중계탑 켜기',
};
ET.crust = {
  init(e) { e.burstable = true; e.w = e.w || 2; if (isDone(e.id)) e.dead = true; },
  col: e => ({ x: e.x, z: e.z, hw: 0.6, hd: e.w / 2, top: e.y + 3 }),
  model(e) { const g = new THREE.Group(); for (let i = 0; i < 9; i++) { const c = mesh(geo('cone', rand(0.3, 0.6), rand(1.4, 3), 5), mat('#f4f8fb', { rough: 0.2 }), rand(-0.4, 0.4), 0, (i / 8 - 0.5) * e.w, g); c.position.y = c.geometry.parameters.height / 2; c.rotation.set(rand(-0.3, 0.3), rand(6), rand(-0.3, 0.3)); } shadowAll(g); return g; },
  onBurst(e) { e.dead = true; markDone(e.id); sfx('break'); FX.burst(e.x, e.y + 1.4, e.z, 40, 0xffffff, 6, 0.9, 0.25, { add: false, grav: 9 }); },
};
// 시간이 멈춘 낙엽 발판
ET.leaf = {
  init(e) { e.frozen = e.fixed ? 1e9 : 0; e.ox = e.x; e.oz = e.z; e.ph = rand(6); e.stasis = true; e.fly = true; e.y = e.hy || 2; },
  col: e => e.frozen > 0 ? { x: e.x, z: e.z, hw: 1.3, hd: 1.3, top: e.y + 0.15, bot: e.y - 0.3, stand: true } : null,
  update(e, dt) { e.y = e.hy; if (e.frozen > 0) return; e.ph += dt * (e.speed || 0.9); e.z = e.oz + (e.dz || 0) * Math.sin(e.ph); e.x = e.ox + (e.dx || 0) * Math.sin(e.ph); },
  model() { const g = new THREE.Group(); const l = mesh(geo('sph', 1.4, 12, 6), mat('#d8782a', { flat: false, side: THREE.DoubleSide }), 0, 0, 0, g); l.scale.set(1, 0.08, 0.75); mesh(geo('box', 2.6, 0.06, 0.08), mat('#8a4a1a'), 0, 0.08, 0, g); g.ice = mesh(geo('sph', 1.6, 12, 6), ADD('#ffd27a', 1.1, 0.14), 0, 0, 0, g); g.ice.scale.y = 0.3; shadowAll(g); g.ice.castShadow = false; return g; },
  sync(e, o) { o.ice.visible = e.frozen > 0 && !e.fixed; o.rotation.z = e.frozen > 0 ? 0 : Math.sin(GFX.t * 2 + e.ph) * 0.15; },
  onStasis(e) { if (e.fixed) { toast('이 잎은 이미 시간 속에 단단히 붙들려 있다'); return false; } e.frozen = e.frozen > 0 ? 0 : 1e9; return true; },
};
ET.curtain = {
  init(e) { e.stasis = true; e.w = e.w || 6; if (isDone(e.id)) e.dead = true; },
  col: e => ({ x: e.x, z: e.z, hw: e.w / 2, hd: 0.8, top: e.y + 6 }),
  model(e) { const g = new THREE.Group(); const n = Math.round(e.w * 14); const im = new THREE.InstancedMesh(geo('box', 0.04, 0.32, 0.04), GLOW('#bfe6ff', 1.8), n); const mx = new THREE.Matrix4(); for (let i = 0; i < n; i++) { mx.makeTranslation(rand(-e.w / 2, e.w / 2), rand(0.2, 6), rand(-0.6, 0.6)); im.setMatrixAt(i, mx); } g.add(im); return g; },
  onStasis(e) {
    e.dead = true; markDone(e.id); sfx('freeze');
    for (let i = 0; i < 160; i++) FX.spawn({ x: e.x + rand(-e.w / 2, e.w / 2), y: e.y + rand(0.5, 6), z: e.z + rand(-0.6, 0.6), vy: -rand(8, 14), life: 0.6, size: 0.1, c: 0xbfe6ff, drag: 0, add: false });
    toast('붙잡혀 있던 빗방울이 한꺼번에 떨어졌다');
    return true;
  },
};
ET.pipe = {
  init(e) { e.rot = e.rot || 0; e.flow = false; },
  col: e => ({ x: e.x, z: e.z, hw: 0.95, hd: 0.95, top: e.y + 0.5, stand: true }),
  model(e) { const g = new THREE.Group(); mesh(geo('box', 1.9, 0.4, 1.9), mat('#4a3a3a'), 0, 0.2, 0, g); g.arms = new THREE.Group(); g.arms.position.y = 0.55; g.add(g.arms); g.hub = mesh(geo('sph', 0.3), mat('#6a5a5a'), 0, 0.55, 0, g); if (e.valve) mesh(geo('tor', 0.5, 0.06, 6, 16), mat('#ffd27a', { metal: 0.6 }), 0, 1.0, 0, g).rotation.x = Math.PI / 2; g.key = ''; return g; },
  sync(e, o) {
    const k = e.rot + (e.flow ? 'f' : '');
    if (o.key !== k) {
      o.key = k; o.arms.clear();
      for (const [dx, dy] of pipeDirs(e)) { const a = mesh(geo('cyl', 0.2, 0.2, 0.95, 8), e.flow ? GLOW('#ff9a3a', 2.2) : mat('#8a7a6a', { metal: 0.6 }), dx * 0.48, 0, dy * 0.48, o.arms); a.rotation.set(dy ? Math.PI / 2 : 0, 0, dx ? Math.PI / 2 : 0); }
      o.hub.material = e.flow ? GLOW('#ffd25a', 2.4) : mat('#6a5a5a');
    }
  },
  interact(e) { if (e.locked) { toast('기관이 켜진 뒤에는 돌릴 수 없다'); return; } e.rot = (e.rot + 1) % 4; sfx('blip'); updatePipes(); },
  prompt: e => e.valve ? '밸브 돌리기' : '관 돌리기',
};
function pipeDirs(e) {
  const base = { I: [[0, -1], [0, 1]], L: [[0, -1], [1, 0]], T: [[0, -1], [1, 0], [0, 1]] }[e.shape];
  return base.map(([dx, dy]) => { let x = dx, y = dy; for (let i = 0; i < e.rot; i++) { const t = x; x = -y; y = t; } return [x, y]; });
}
ET.floodgate = {
  init(e) { e.metal = e.kind === 'iron'; e.burstable = e.kind === 'jam'; e.fixedMetal = true; e.opened = isDone(e.id); },
  col: e => e.opened ? null : ({ x: e.x, z: e.z, hw: 1.0, hd: 0.4, top: e.y + 3 }),
  model(e) { const g = new THREE.Group(); const c = e.kind === 'iron' ? '#5a5e68' : '#6a5040'; mesh(geo('box', 2, 3, 0.4), mat(c, { metal: e.kind === 'iron' ? 0.7 : 0 }), 0, 1.5, 0, g); for (let x = -0.75; x <= 0.75; x += 0.5) mesh(geo('box', 0.14, 3, 0.5), mat(e.kind === 'iron' ? '#8a8e98' : '#8a6a50'), x, 1.5, 0, g); shadowAll(g); return g; },
  sync(e, o) { o.position.y = e.y + (e.opened ? 2.8 : 0); if (pdist(e) < 6 && !e.opened) label(e.x, e.y + 3.6, e.z, e.kind === 'iron' ? '철 수문' : '걸린 수문', '#bff'); },
  onMagnes(e) { return floodgateOpen(e); },
  onBurst(e) { floodgateOpen(e); },
};
ET.chain = {
  init(e) { e.hp = 1; e.hittable = true; e.r = 0.5; },
  col: e => ({ x: e.x, z: e.z, r: 0.5, top: e.y + 1.4 }),
  model(e) {
    const g = new THREE.Group();
    mesh(geo('box', 0.9, 1.2, 0.9), mat('#5a5a7a'), 0, 0.6, 0, g);
    mesh(geo('sph', 0.25), GLOW('#7ff0ff', 2.4), 0, 1.3, 0, g);
    const dx = e.cx - e.x, dz = e.cz - e.z, l = Math.hypot(dx, dz);
    const c = mesh(geo('cyl', 0.06, 0.06, l, 6), GLOW('#7ff0ff', 2.0), dx / 2, 1.4, dz / 2, g);
    c.rotation.z = Math.PI / 2; c.rotation.y = -Math.atan2(dz, dx);
    return g;
  },
  onHit(e) { if (!G.f.chainsOpen) { toast('지금은 끊을 수 없다'); return false; } e.dead = true; chainCut(e); return true; },
};
ET.stele = {
  init(e) { e.read = false; },
  col: e => ({ x: e.x, z: e.z, hw: 0.8, hd: 0.35, top: e.y + 3.2 }),
  model() { const g = new THREE.Group(); mesh(geo('box', 1.5, 3.2, 0.5), mat('#bcb6a8'), 0, 1.6, 0, g); g.lines = []; for (let i = 0; i < 6; i++) g.lines.push(mesh(geo('box', 1 - (i % 2) * 0.3, 0.07, 0.04), mat('#6a6458'), 0, 2.6 - i * 0.32, 0.27, g)); shadowAll(g); return g; },
  sync(e, o) { for (const l of o.lines) l.material = e.read ? GLOW('#c0b0ff', 2.4) : mat('#6a6458'); },
  interact(e) { readStele(e); },
  prompt: e => e.read ? '다시 읽기' : '공명봉으로 읽기',
};
ET.plaque = {
  col: e => ({ x: e.x, z: e.z, r: 0.5, top: e.y + 1.6 }),
  model() { const g = new THREE.Group(); mesh(geo('box', 0.14, 1.2, 0.14), mat('#6a4a1a'), 0, 0.6, 0, g); const p = mesh(geo('box', 1.4, 1, 0.08), mat('#b88a3a', { metal: 0.7, rough: 0.35 }), 0, 1.3, 0, g); p.rotation.x = -0.3; shadowAll(g); return g; },
  interact(e) { TALK[e.talk](e); },
  prompt: () => '읽기',
};
// 기관 심장부
ET.core = {
  init(e) { e.r = 1.6; },
  col: e => ({ x: e.x, z: e.z, r: 1.6, top: e.y + 3 }),
  model(e) {
    const g = new THREE.Group();
    if (e.look === 'furnace') { mesh(geo('cyl', 2.2, 2.6, 4, 10), mat('#5a4a4a', { metal: 0.4 }), 0, 2, 0, g); mesh(geo('cone', 2.2, 2, 10), mat('#4a3a3a'), 0, 5, 0, g); g.core = mesh(geo('sph', 0.9, 14, 10), GLOW(e.c, 2.6), 0, 2, 2.1, g); }
    else { mesh(geo('cyl', 1.6, 2, 0.8, 10), mat('#8a6a3a', { metal: 0.6, rough: 0.4 }), 0, 0.4, 0, g); g.core = mesh(geo('ico', 0.9, 1), GLOW(e.c, 2.6), 0, 2.2, 0, g); }
    g.rings = [0, 1, 2].map(i => { const r = mesh(geo('tor', 1.6 + i * 0.4, 0.06, 6, 32), GLOW(e.c, 1.8), 0, 2.2, 0, g); return r; });
    shadowAll(g); return g;
  },
  sync(e, o, dt) {
    const fixed = G.f[e.flag];
    const pulse = fixed ? Math.sin(GFX.t * 2) * 0.5 + 0.5 : (Math.sin(GFX.t * 9) > 0.3 ? 1 : 0.2);
    o.core.material = GLOW(fixed ? e.c : '#ff6a5a', 1.6 + pulse * 1.4);
    o.rings.forEach((r, i) => { r.rotation.x = GFX.t * (fixed ? 0.4 : 2.2) * (i % 2 ? 1 : -1) + i; r.rotation.y = GFX.t * 0.3 * i; r.visible = e.look !== 'furnace'; });
    e.light = { c: fixed ? COL(e.c).getHex() : 0xff6a5a, k: 1.5 + pulse, d: 16, h: 2.2 };
  },
  interact(e) { TALK[e.talk](e); },
  prompt: e => G.f[e.flag] ? null : (e.verb || '기관 살피기'),
};
ET.chair = {
  col: e => ({ x: e.x, z: e.z, r: 1.4, top: e.y + 3.5 }),
  model(e) {
    const g = new THREE.Group();
    mesh(geo('box', 2.4, 0.8, 2), mat('#9a7a3a', { metal: 0.5, rough: 0.4 }), 0, 0.4, 0, g);
    mesh(geo('box', 2.4, 3.4, 0.4), mat('#9a7a3a', { metal: 0.5, rough: 0.4 }), 0, 1.7, -0.9, g);
    for (let i = 0; i < 5; i++) mesh(geo('box', 0.06, 2.6, 0.05), GLOW('#7ff0ff', 2), -0.9 + i * 0.45, 1.9, -0.68, g);
    const mage = makeRig({ cloak: '#5a5a6a', body: '#bcb6a8', skin: '#d8c8b8', hair: '#eeeeee' });
    mage.position.set(0, 0.3, -0.2); animRig(mage, { mode: 'sit' }, 0); g.add(mage); g.mage = mage;
    g.slot = mesh(geo('cyl', 0.25, 0.25, 0.1, 10), mat('#3a3a4a'), 1.5, 1.0, 0.3, g); g.slot.rotation.x = Math.PI / 2;
    const d = runeDisc('#7ff0ff', 8, 1.2); d.position.y = 0.05; g.add(d); g.disc = d;
    shadowAll(g); return g;
  },
  sync(e, o, dt) { o.mage.visible = !G.f.mageGone; o.slot.material = G.f.slotOpen ? GLOW('#7ff0ff', 2.6) : mat('#3a3a4a'); o.disc.rotation.z += dt * 0.2; o.disc.visible = !G.f.mageGone; e.light = G.f.mageGone ? null : { c: 0x7ff0ff, k: 1.4, d: 16, h: 2 }; },
  interact(e) { TALK.chair(e); },
  prompt: () => null,
};
ET.fountain = {
  col: e => ({ x: e.x, z: e.z, r: 2.7, top: e.y + 1.0, stand: true }),
  model() {
    const g = new THREE.Group();
    mesh(geo('cyl', 2.8, 3, 0.9, 20), mat('#cfc6b4'), 0, 0.45, 0, g);
    g.water = mesh(geo('cyl', 2.5, 2.5, 0.1, 20), waterMat({ color: 0x5ab0e0 }), 0, 0.82, 0, g);
    mesh(geo('cyl', 0.35, 0.5, 2.6, 10), mat('#cfc6b4'), 0, 1.3, 0, g);
    mesh(geo('cyl', 1, 0.8, 0.3, 14), mat('#cfc6b4'), 0, 2.6, 0, g);
    g.ice = new THREE.Group(); g.add(g.ice);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const arc = mesh(geo('tor', 1.2, 0.09, 6, 16, Math.PI), mat('#e6f8ff', { rough: 0.1, opacity: 0.85 }), Math.cos(a) * 1.2, 2.7, Math.sin(a) * 1.2, g.ice); arc.rotation.y = -a; }
    mesh(geo('cyl', 0.12, 0.12, 2.4, 6), mat('#e6f8ff', { rough: 0.1, opacity: 0.85 }), 0, 3.9, 0, g.ice);
    g.rainbow = new THREE.Group(); g.add(g.rainbow);
    ['#ff5a5a', '#ffb35a', '#ffee5a', '#7aef7a', '#5ab0ff', '#9a7aff'].forEach((c, i) => mesh(geo('tor', 14 - i * 0.5, 0.22, 6, 48, Math.PI), ADD(c, 1.4, 0.4), 0, 0, -6, g.rainbow));
    shadowAll(g); return g;
  },
  sync(e, o) {
    const frozen = G.f.tremor && !G.f.ch1engine;
    o.ice.visible = frozen; o.water.material.color.set(frozen ? 0xdff4ff : 0x5ab0e0);
    if (!frozen && Math.random() < 0.7) for (let k = 0; k < 2; k++) { const a = rand(6.28); FX.spawn({ x: e.x, y: e.y + 2.8, z: e.z, vx: Math.cos(a) * 1.4, vy: rand(3, 4.5), vz: Math.sin(a) * 1.4, life: 0.9, size: 0.12, c: 0xc8f0ff, grav: 9, drag: 0.2, add: false }); }
    o.rainbow.visible = G.rainbow > 0; o.rainbow.children.forEach(r => r.material.opacity = clamp(G.rainbow, 0, 1) * 0.4);
  },
};
ET.whale = {
  init(e) { e.ph = 0; e.cx = e.x; e.cz = e.z; e.fly = true; },
  update(e, dt) { e.ph += dt * 0.15; e.x = e.cx + Math.cos(e.ph) * 14; e.z = e.cz + Math.sin(e.ph) * 9; e.y = 11 + Math.sin(e.ph * 2) * 1.2; e.yaw = Math.atan2(-Math.sin(e.ph) * 14, Math.cos(e.ph) * 9); },
  model() {
    const g = new THREE.Group();
    const wm = new THREE.MeshStandardMaterial({ color: 0x8fd4ff, emissive: 0x3a90c8, emissiveIntensity: 0.6, transparent: true, opacity: 0.5, roughness: 0.1, depthWrite: false });
    const b = mesh(geo('sph', 1, 20, 12), wm, 0, 0, 0, g); b.scale.set(1.6, 1.4, 4);
    const tail = mesh(geo('cone', 1.6, 2, 4), wm, 0, 0, -4.6, g); tail.rotation.x = -Math.PI / 2; tail.scale.set(1.6, 1, 0.2);
    for (const s of [-1, 1]) { const f = mesh(geo('sph', 1, 8, 6), wm, s * 1.7, -0.6, 0.8, g); f.scale.set(1, 0.1, 0.5); }
    g.tail = tail;
    return g;
  },
  sync(e, o) {
    o.visible = !(G.f.tremor && !G.f.ch1engine);
    o.tail.rotation.y = Math.sin(GFX.t * 2) * 0.3;
    if (o.visible && Math.random() < 0.3) FX.spawn({ x: e.x + rand(-1, 1), y: e.y + rand(-1, 1), z: e.z + rand(-1, 1), vy: -0.3, life: 1.5, size: 0.25, c: 0xd8f4ff, add: false, a: 0.6 });
  },
};
ET.book = {
  init(e) { e.ph = rand(6); e.cx = e.x; e.cz = e.z; e.rad = e.rad || 4; e.fly = true; },
  update(e, dt) {
    if (e.caught) return;
    e.ph += dt * (e.flee ? 1.4 : 0.7);
    if (e.flee && Math.hypot(P.x - e.x, P.z - e.z) < 3.5 && Math.abs(P.y - e.hy) < 3) { e.cx += (e.x - P.x) * dt * 1.4; e.cz += (e.z - P.z) * dt * 1.4; }
    if (e.flee) { e.cx = clamp(e.cx, e.minx, e.maxx); e.cz = clamp(e.cz, e.miny, e.maxy); }
    e.x = e.cx + Math.cos(e.ph) * e.rad; e.z = e.cz + Math.sin(e.ph * 1.3) * e.rad * 0.6;
    e.y = e.hy + Math.sin(e.ph * 2) * 0.3;
    e.yaw = e.ph + Math.PI / 2;
  },
  model(e) { const g = new THREE.Group(); g.l = mesh(geo('box', 0.5, 0.04, 0.7), mat(e.c || '#a83a3a'), -0.25, 0, 0, g); g.r = mesh(geo('box', 0.5, 0.04, 0.7), mat(e.c || '#a83a3a'), 0.25, 0, 0, g); mesh(geo('box', 0.04, 0.1, 0.7), mat('#f6ecd2'), 0, 0.03, 0, g); return g; },
  sync(e, o) { o.visible = !e.caught; const f = Math.sin(GFX.t * 10 + e.ph) * 0.6; o.l.rotation.z = f; o.r.rotation.z = -f; o.l.position.y = Math.sin(f) * 0.12; o.r.position.y = Math.sin(f) * 0.12; if (e.flee && pdist(e) < 8) label(e.x, e.y + 0.8, e.z, '도망친 책', '#ffe08a'); },
  interact(e) { if (e.flee && !e.caught) { e.caught = true; TALK.bookCaught(e); } },
  prompt: e => e.flee && !e.caught ? '붙잡기' : null,
};
ET.orb = {
  init(e) { e.ph = rand(6); e.cx = e.x; e.cz = e.z; e.fly = true; },
  update(e, dt) { if (e.got) return; e.ph += dt; e.x = e.cx + Math.sin(e.ph * 0.7) * 0.8; e.z = e.cz + Math.cos(e.ph * 0.5) * 0.6; e.y = e.hy + Math.sin(e.ph * 2) * 0.2; },
  model() { const g = new THREE.Group(); mesh(geo('ico', 0.28, 1), GLOW('#c8a0ff', 2.2), 0, 0, 0, g); mesh(geo('sph', 0.55, 10, 8), ADD('#c8a0ff', 1, 0.2), 0, 0, 0, g); return g; },
  sync(e, o) { o.visible = !e.got; if (Math.random() < 0.15) FX.spawn({ x: e.x, y: e.y, z: e.z, vx: rand(-0.4, 0.4), vy: rand(-0.4, 0.4), vz: rand(-0.4, 0.4), life: 0.7, size: 0.1, c: 0xc8a0ff }); },
  interact(e) { if (!e.got) { e.got = true; sfx('pick'); FX.burst(e.x, e.y, e.z, 20, 0xc8a0ff, 3, 0.7, 0.2); TALK.orbGot(e); } },
  prompt: e => e.got ? null : '부유석 잡기',
};
ET.trigger = {
  update(e) {
    if (e.fired || G.lock) return;
    if (Math.abs(P.x - e.x) < (e.w || 2) / 2 + 0.3 && Math.abs(P.z - e.z) < (e.h || 2) / 2 + 0.3) {
      if (e.cond && !e.cond()) return;
      if (e.once !== false) e.fired = true;
      e.onEnter(e);
    }
  },
};
ET.ringface = {
  col: e => ({ x: e.x, z: e.z, r: 0.5, top: e.y + 2 }),
  model(e) { const g = new THREE.Group(); mesh(geo('box', 0.2, 2, 0.2), mat('#6a4a2a'), 0, 1, 0, g); mesh(geo('cyl', 0.9, 0.9, 0.12, 24), mat('#d8c8a0'), 0, 2.4, 0, g).rotation.x = Math.PI / 2; g.hand = mesh(geo('box', 0.1, 0.7, 0.06), mat('#7a3a2a'), 0, 2.4, 0.1, g); g.hand.geometry = new THREE.BoxGeometry(0.1, 0.7, 0.06).translate(0, 0.32, 0); return g; },
  sync(e, o) { o.hand.rotation.z = lerp(o.hand.rotation.z, -G.rings[e.ring] * Math.PI / 2, 0.15); if (pdist(e) < 8) label(e.x, e.y + 3.5, e.z, '고리 ' + (e.ring + 1), '#ffe08a'); },
};

// ======================================================================
// 잔향 (적)
// ======================================================================
const ECHO = {
  beast: { hp: 4, sp: 5.4, dmg: 2, sight: 14, range: 1.7, size: 1 },
  human: { hp: 6, sp: 3.6, dmg: 2, sight: 12, range: 1.9, size: 1 },
  big: { hp: 16, sp: 2.8, dmg: 4, sight: 15, range: 2.8, size: 1.7 },
  wisp: { hp: 3, sp: 4, dmg: 1, sight: 17, range: 10, size: 0.8, ranged: true },
};
ET.echo = {
  init(e) {
    const k = ECHO[e.kind || 'human'];
    e.k = k; e.hp = e.maxhp = Math.round(k.hp * (e.hpMul || 1)); e.state = 'idle'; e.t = 0; e.cd = 0; e.frozen = 0; e.stasis = true;
    e.hittable = true; e.burstable = true; e.hx = e.x; e.hz = e.z; e.r = 0.45 * k.size; e.yaw = rand(6);
    if (isDone(e.id) && e.unique) e.dead = true;
  },
  update(e, dt) {
    if (e.burn > 0) { e.burn -= dt; e.burnT = (e.burnT || 0) - dt; if (e.burnT <= 0) { e.burnT = 0.6; damageEnt(e, 1, e.x, e.z, true); } if (Math.random() < 0.4) FX.spawn({ x: e.x, y: e.y + 1, z: e.z, vy: 2, life: 0.5, size: 0.2, c: 0xff7a2a }); }
    if (e.frozen > 0) { e.frozen -= dt; if (e.frozen <= 0 && e.stored) { const s = e.stored; e.stored = 0; damageEnt(e, s, P.x, P.z, false, 2); } return; }
    if (e.chill > 0) { e.chill -= dt; dt *= 0.45; }
    if (e.kb) { moveEnt(e, e.kb.x * dt, e.kb.z * dt); e.kb.t -= dt; if (e.kb.t <= 0) e.kb = null; return; }
    if (e.stun > 0) { e.stun -= dt; return; }
    e.y = lerp(e.y, groundY(e), 0.3);
    const d = Math.hypot(e.x - P.x, e.z - P.z);
    e.t += dt; e.cd -= dt;
    const k = e.k;
    if (G.lock && e.state !== 'idle') return;
    if (e.watcher) { updateWatcher(e, dt, d); return; }
    switch (e.state) {
      case 'idle': if (d < k.sight && Math.abs(P.y - e.y) < 6 && !G.lock) { e.state = 'notice'; e.t = 0; } break;
      case 'notice': faceTo(e, P.x, P.z, 0.3); if (e.t > 0.5) { e.state = 'chase'; e.t = 0; } break;
      case 'chase': {
        const dx = P.x - e.x, dz = P.z - e.z, l = Math.hypot(dx, dz) || 1;
        faceTo(e, P.x, P.z, 0.25);
        if (k.ranged) {
          if (d < 5) moveEnt(e, -dx / l * k.sp * 0.6 * dt, -dz / l * k.sp * 0.6 * dt);
          else if (d > 9) moveEnt(e, dx / l * k.sp * dt, dz / l * k.sp * dt);
          if (e.cd <= 0) { e.cd = 2.2; spawn('proj', e.x, e.z, { y: e.y + 1.3, vx: dx / l * 9, vy: (P.y - e.y) * 0.5, vz: dz / l * 9, dmg: k.dmg, c: e.tint ? TINT[e.tint] : '#a0e8ff' }); sfx('zap'); }
        } else if (d > k.range) moveEnt(e, dx / l * k.sp * dt, dz / l * k.sp * dt);
        else if (e.cd <= 0) { e.state = 'windup'; e.t = 0; }
        if (d > 26 || Math.hypot(e.x - e.hx, e.z - e.hz) > 34) e.state = 'return';
        break;
      }
      case 'windup':
        if (e.t > 0.45) {
          e.state = 'chase'; e.cd = 1.0; e.atk = 0.28;
          const hx = e.x + Math.sin(e.yaw) * k.range * 0.6, hz = e.z + Math.cos(e.yaw) * k.range * 0.6;
          if (Math.hypot(hx - P.x, hz - P.z) < 1.2 * k.size + 0.4 && Math.abs(P.y - e.y) < 1.8) hurtPlayer(k.dmg, e.x, e.z);
          sfx('swing');
        }
        break;
      case 'return': {
        const dx = e.hx - e.x, dz = e.hz - e.z, l = Math.hypot(dx, dz);
        if (l < 0.8) { e.state = 'idle'; break; }
        moveEnt(e, dx / l * k.sp * 0.7 * dt, dz / l * k.sp * 0.7 * dt); faceTo(e, e.hx, e.hz, 0.2);
        if (d < k.sight * 0.6) e.state = 'chase';
        break;
      }
    }
    if (e.atk > 0) e.atk -= dt;
  },
  model(e) {
    const c = e.tint ? TINT[e.tint] : (e.kind === 'wisp' ? '#a0e8ff' : e.kind === 'big' ? '#8070e0' : '#a898ff');
    const gm = ghostMat(c);
    const g = new THREE.Group();
    if ((e.kind || 'human') === 'beast') {
      const b = mesh(geo('sph', 0.55, 12, 8), gm, 0, 0.75, 0, g); b.scale.set(0.8, 0.7, 1.3);
      mesh(geo('sph', 0.32, 10, 8), gm, 0, 0.95, 0.75, g);
      g.legs = [[-0.3, 0.45], [0.3, 0.45], [-0.3, -0.45], [0.3, -0.45]].map(([x, z]) => mesh(geo('cyl', 0.08, 0.06, 0.6, 6), gm, x, 0.3, z, g));
      mesh(geo('sph', 0.05), GLOW('#ffffff', 2), -0.12, 1.02, 1.02, g); mesh(geo('sph', 0.05), GLOW('#ffffff', 2), 0.12, 1.02, 1.02, g);
    } else if (e.kind === 'wisp') {
      mesh(geo('sph', 0.45, 12, 10), gm, 0, 1.6, 0, g);
      const tail = mesh(geo('cone', 0.4, 1.2, 8), gm, 0, 0.9, 0, g); tail.rotation.x = Math.PI;
      mesh(geo('sph', 0.06), GLOW('#ffffff', 2), -0.13, 1.65, 0.38, g); mesh(geo('sph', 0.06), GLOW('#ffffff', 2), 0.13, 1.65, 0.38, g);
    } else {
      const r = makeRig({}, { ghost: gm }); g.add(r); g.rig = r;
      mesh(geo('sph', 0.04), GLOW('#ffffff', 2.5), -0.075, 1.62 + 0.92 - 0.92, 0.2, r.head).position.set(-0.075, 0, 0.2);
      mesh(geo('sph', 0.04), GLOW('#ffffff', 2.5), 0.075, 0, 0.2, r.head);
      if (e.act === 'bread') { g.prop = mesh(geo('box', 0.04, 0.04, 0.4), GLOW('#ffffff', 1.5), 0, -0.68, 0.2, r.armR); }
      if (e.act === 'dig' || e.kind === 'big') { g.prop = mesh(geo('box', 0.06, 0.9, 0.06), gm, 0, -0.6, 0.3, r.armR); }
      if (e.act === 'hunt') { g.prop = mesh(geo('tor', 0.45, 0.03, 4, 12, Math.PI), gm, 0, -0.6, 0.1, r.armL); }
    }
    g.scale.setScalar(e.k.size);
    g.ice = mesh(geo('sph', 1, 12, 8), ADD('#ffd27a', 1.2, 0.18), 0, 1, 0, g); g.ice.visible = false;
    return g;
  },
  sync(e, o, dt) {
    const fl = Math.random() < 0.05;
    o.position.x += fl ? rand(-0.12, 0.12) : 0;
    o.ice.visible = e.frozen > 0;
    if (o.rig) {
      let mode = 'idle';
      if (e.state === 'chase' || e.state === 'return') mode = e.kind === 'big' ? 'walk' : 'run';
      animRig(o.rig, { mode, atk: e.atk || 0 }, e.frozen > 0 ? 0 : dt);
      if (e.state === 'idle') {
        if (e.act === 'bread') o.rig.armR.rotation.x = -1.2 + Math.sin(GFX.t * 5) * 0.4;
        else if (e.act === 'window') o.rig.head.rotation.x = -0.4;
        else if (e.act === 'pray') { o.rig.armL.rotation.set(-1.4, 0, -0.5); o.rig.armR.rotation.set(-1.4, 0, 0.5); }
        else if (e.act === 'dig') o.rig.armR.rotation.x = -2 + Math.abs(Math.sin(GFX.t * 3)) * 1.6;
        else if (e.act === 'sweep') o.rig.armR.rotation.x = -0.6 + Math.sin(GFX.t * 3) * 0.5;
      }
      if (e.watcher && e.nod) o.rig.head.rotation.x = Math.sin(clamp((1.6 - (e.fade || 0)) * 4, 0, Math.PI)) * 0.5;
    } else if (o.children[0] && e.kind === 'beast') {
      const run = e.state === 'chase' && e.frozen <= 0;
      o.children.forEach((c, i) => { if (i >= 2 && i < 6) c.rotation.x = run ? Math.sin(GFX.t * 14 + i * 1.6) * 0.7 : 0; });
    } else if (e.kind === 'wisp') o.position.y += Math.sin(GFX.t * 3 + e.hx) * 0.2;
    const op = (e.fade ? e.fade / 1.6 : 1) * (0.45 + Math.sin(GFX.t * 6 + e.hx) * 0.08) * (fl ? 0.4 : 1);
    o.traverse(m => { if (m.isMesh && m.material.isMeshStandardMaterial && m.material.transparent && m !== o.ice) { if (!m.userData.own) { m.material = m.material.clone(); m.userData.own = true; } m.material.opacity = op; } });
    if (e.state === 'notice') label(e.x, e.y + 2.6 * e.k.size, e.z, '!', '#ffe08a', { big: true });
    if (e.hp < e.maxhp && e.state !== 'idle') label(e.x, e.y + 2.3 * e.k.size, e.z, '', '#c8a0ff', { bar: e.hp / e.maxhp });
    if (e.frozen > 0 && e.stored) label(e.x, e.y + 2.8, e.z, '×' + e.stored, '#ffd27a');
    if (Math.random() < 0.08) FX.spawn({ x: e.x + rand(-0.4, 0.4), y: e.y + rand(0.3, 2), z: e.z + rand(-0.4, 0.4), vy: 0.5, life: 0.8, size: 0.12, c: COL(e.tint ? TINT[e.tint] : '#a898ff').getHex() });
  },
  onStasis(e) { e.frozen = 6; e.stored = 0; return true; },
};
function updateWatcher(e, dt, d) {
  // 1장: 공격하지 않는 잔향. 렌의 얼굴을 오래 본다.
  if (e.fade) { e.fade -= dt; if (e.fade <= 0) { e.dead = true; markDone(e.id); } return; }
  if (d < 8) {
    faceTo(e, P.x, P.z, 0.08);
    e.stare = (e.stare || 0) + dt;
    if (e.stare > 4.5 && !e.nod) { e.nod = 1; e.fade = 1.6; G.f.watcherNod = true; }
  }
}
// 야생 마력 동물
ET.beast = {
  init(e) { e.hp = 3; e.hittable = true; e.burstable = true; e.stasis = true; e.frozen = 0; e.r = 0.5; e.vx = 0; e.vz = 0; e.t = 0; e.hx = e.x; e.hz = e.z; },
  update(e, dt) {
    if (e.frozen > 0) { e.frozen -= dt; return; }
    e.t -= dt;
    const d = pdist(e);
    if (d < 7) { const l = d || 1; e.vx = (e.x - P.x) / l * 6; e.vz = (e.z - P.z) / l * 6; e.t = 1; }
    else if (e.t <= 0) { e.t = rand(1, 3); const a = rand(6.28), m = Math.random() < 0.5 ? 0 : 1.2; e.vx = Math.sin(a) * m; e.vz = Math.cos(a) * m; if (Math.hypot(e.x - e.hx, e.z - e.hz) > 20) { e.vx = (e.hx - e.x) * 0.1; e.vz = (e.hz - e.z) * 0.1; } }
    moveEnt(e, e.vx * dt, e.vz * dt);
    if (e.vx || e.vz) faceTo(e, e.x + e.vx, e.z + e.vz, 0.2);
  },
  model(e) {
    const g = new THREE.Group();
    if (e.kind === 'deer') {
      const b = mesh(geo('sph', 0.5, 12, 8), mat('#b07a4a', { flat: false }), 0, 1.1, 0, g); b.scale.set(0.7, 0.7, 1.3);
      mesh(geo('cyl', 0.12, 0.16, 0.7, 8), mat('#b07a4a'), 0, 1.5, 0.55, g).rotation.x = -0.5;
      mesh(geo('sph', 0.2, 10, 8), mat('#b07a4a'), 0, 1.85, 0.75, g);
      for (const s of [-1, 1]) { const a = mesh(geo('cyl', 0.02, 0.04, 0.7, 5), GLOW('#9ff4ff', 2.2), s * 0.15, 2.25, 0.7, g); a.rotation.z = -s * 0.5; }
      g.legs = [[-0.2, 0.4], [0.2, 0.4], [-0.2, -0.4], [0.2, -0.4]].map(([x, z]) => mesh(geo('cyl', 0.05, 0.04, 0.9, 6), mat('#8a5a3a'), x, 0.45, z, g));
    } else {
      const b = mesh(geo('sph', 0.55, 12, 8), mat('#7a6a8a', { flat: false }), 0, 0.7, 0, g); b.scale.set(0.85, 0.75, 1.25);
      mesh(geo('sph', 0.32, 10, 8), mat('#8a7a9a'), 0, 0.75, 0.7, g);
      mesh(geo('cone', 0.06, 0.25, 5), mat('#f4ecd8'), -0.15, 0.62, 0.98, g).rotation.x = Math.PI / 2;
      mesh(geo('cone', 0.06, 0.25, 5), mat('#f4ecd8'), 0.15, 0.62, 0.98, g).rotation.x = Math.PI / 2;
      for (let i = 0; i < 4; i++) mesh(geo('oct', 0.14), GLOW('#7ff0ff', 2.2), 0, 1.15, -0.4 + i * 0.25, g);
      g.legs = [[-0.28, 0.4], [0.28, 0.4], [-0.28, -0.4], [0.28, -0.4]].map(([x, z]) => mesh(geo('cyl', 0.09, 0.07, 0.45, 6), mat('#5a4a6a'), x, 0.22, z, g));
    }
    shadowAll(g); return g;
  },
  sync(e, o) { const run = (e.vx || e.vz) && e.frozen <= 0; o.legs.forEach((l, i) => l.rotation.x = run ? Math.sin(GFX.t * 16 + i * 1.6) * 0.8 : 0); },
  onStasis(e) { e.frozen = 6; return true; },
};
// 투사체
ET.proj = {
  init(e) { e.life = e.life || 4; e.fly = true; },
  update(e, dt) {
    if (e.owner && e.owner.speedMul !== undefined) dt *= e.owner.speedMul;
    e.x += e.vx * dt; e.y += (e.vy || 0) * dt; e.z += e.vz * dt; e.life -= dt;
    if (e.life <= 0 || G.map.ground(e.x, e.z) > e.y) { e.dead = true; FX.burst(e.x, e.y, e.z, 8, COL(e.c).getHex(), 2, 0.3, 0.15); return; }
    if (Math.hypot(e.x - P.x, e.z - P.z) < 0.6 && Math.abs(e.y - (P.y + 1)) < 1) { hurtPlayer(e.dmg || 1, e.x - e.vx, e.z - e.vz); e.dead = true; }
    if (Math.random() < 0.6) FX.spawn({ x: e.x, y: e.y, z: e.z, life: 0.3, size: 0.18, c: COL(e.c).getHex() });
  },
  model(e) {
    const g = new THREE.Group();
    if (e.arrow) { const a = mesh(geo('cyl', 0.03, 0.03, 1, 5), GLOW(e.c, 2), 0, 0, 0, g); a.rotation.x = Math.PI / 2; }
    else mesh(geo('sph', 0.2, 10, 8), GLOW(e.c, 2.4), 0, 0, 0, g);
    return g;
  },
  sync(e, o) { o.rotation.y = Math.atan2(e.vx, e.vz); },
};
// 공격 예고 (땅 위의 원)
ET.warn = {
  init(e) { e.t = 0; e.fly = true; e.y = groundY(e) + 0.06; },
  update(e, dt) {
    e.t += dt;
    if (e.t >= e.delay && !e.fired) {
      e.fired = true;
      if (Math.hypot(e.x - P.x, e.z - P.z) < e.rad + 0.3 && P.y < e.y + 1.5) hurtPlayer(e.dmg, e.x, e.z, { push: e.push });
      FX.burst(e.x, e.y + 0.4, e.z, 24, COL(e.c).getHex(), 5, 0.6, 0.25);
      if (e.onFire) e.onFire(e);
    }
    if (e.t > e.delay + 0.3) e.dead = true;
  },
  model(e) { const g = new THREE.Group(); g.base = mesh(geo('circle', 1, 32), ADD(e.c, 1, 0.18), 0, 0, 0, g); g.base.rotation.x = -Math.PI / 2; g.base.scale.setScalar(e.rad); g.fill = mesh(geo('ring', 0.9, 1, 32), ADD(e.c, 1.6, 0.6), 0, 0.02, 0, g); g.fill.rotation.x = -Math.PI / 2; return g; },
  sync(e, o) { const p = clamp(e.t / e.delay, 0, 1); o.fill.scale.setScalar(Math.max(0.01, e.rad * p)); o.base.material.opacity = e.fired ? 0.5 : 0.18; },
};
// 퍼지는 고리 (뛰어넘거나 틈으로 빠져나간다)
ET.ring = {
  init(e) { e.rr = 0.5; e.gap = rand(6.28); e.fly = true; e.y = groundY(e) + 0.1; },
  update(e, dt) {
    e.rr += dt * (e.sp || 6);
    if (e.rr > (e.max || 18)) { e.dead = true; return; }
    const d = Math.hypot(e.x - P.x, e.z - P.z);
    if (Math.abs(d - e.rr) < 0.5 && P.y < e.y + 0.7) {
      const a = Math.atan2(P.z - e.z, P.x - e.x);
      const diff = Math.abs(((a - e.gap + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (diff > 0.45) hurtPlayer(e.dmg || 2, e.x, e.z);
    }
  },
  model(e) { const g = new THREE.Group(); g.r = mesh(new THREE.TorusGeometry(1, 0.12, 6, 64, Math.PI * 2 - 0.9), GLOW(e.c || '#ffffff', 2), 0, 0.3, 0, g); g.r.rotation.x = Math.PI / 2; g.r.rotation.z = e.gap + 0.45; return g; },
  sync(e, o) { o.r.scale.set(e.rr, e.rr, 1); },
};
// 파열 룬 구슬
ET.bomb = {
  init(e) { e.t = 0; e.fuse = 3; e.vy = 0; },
  update(e, dt) { e.t += dt; const g = standHeight(e.x, e.z, e.y + 0.3); if (e.y > g) { e.vy -= 18 * dt; e.y = Math.max(g, e.y + e.vy * dt); } if (e.t >= e.fuse) explode(e); },
  model() { const g = new THREE.Group(); g.core = mesh(geo('sph', 0.45, 16, 12), mat('#3a5aa8', { metal: 0.3, rough: 0.2, emis: '#3a8aff', emisI: 1.5 }), 0, 0.45, 0, g); mesh(geo('sph', 0.28, 10, 8), GLOW('#7ff0ff', 2.6), 0, 0.45, 0, g); g.zone = mesh(geo('ring', 3.3, 3.5, 48), ADD('#7ff0ff', 1.4, 0.35), 0, 0.05, 0, g); g.zone.rotation.x = -Math.PI / 2; return g; },
  sync(e, o) { o.core.scale.setScalar(e.t > e.fuse - 1 && Math.sin(e.t * 30) > 0 ? 1.15 : 1); },
};
// 얼음 기둥은 magic.js에서

// ======================================================================
// 보스
// ======================================================================
function bossBase(e, name, hp) {
  Object.assign(e, { boss: true, name, hp, maxhp: hp, hittable: true, burstable: true, r: 1.4, t: 0, cd: 2.5, hx: e.x, hz: e.z, k: { size: 2 } });
}
ET.boss_salt = {
  init(e) { bossBase(e, '소금의 수호자', 34); e.pat = 0; },
  col: e => ({ x: e.x, z: e.z, r: 2.2, top: e.y + 5 }),
  update(e, dt) {
    e.y = groundY(e);
    if (!e.awake) { if (pdist(e) < 13) { e.awake = true; G.boss = e; TALK.bossIntro(e); } return; }
    if (e.stun > 0) { e.stun -= dt; return; }
    e.cd -= dt; if (e.cd > 0) return;
    const p = e.pat++ % 4;
    if (p === 0 || p === 2) { for (let i = 0; i < 3; i++) setTimeoutG(() => { if (!e.dead) spawn('warn', P.x, P.z, { rad: 1.8, delay: 0.85, dmg: 2, c: '#ffffff' }); }, i * 0.5); e.cd = 2.6; }
    else if (p === 1) { spawn('ring', e.x, e.z, { sp: 6.5, max: 20, c: '#f4fbff', dmg: 2 }); setTimeoutG(() => { if (!e.dead) spawn('ring', e.x, e.z, { sp: 6.5, max: 20, c: '#f4fbff', dmg: 2 }); }, 1.1); e.cd = 3.4; }
    else { e.clasp = 1.6; spawn('warn', e.x, e.z, { rad: 7.5, delay: 1.6, dmg: 4, c: '#fff6d8', onFire: () => { e.stun = 3.2; e.clasp = 0; G.shake = 0.6; sfx('boom'); } }); e.cd = 5; }
  },
  model() {
    const g = new THREE.Group(), gm = ghostMat('#eaf4ff');
    const r = makeRig({}, { ghost: gm }); r.scale.setScalar(2.8); g.add(r); g.rig = r;
    const skirt = mesh(geo('cone', 2.6, 2.2, 16), gm, 0, 1.1, 0, g);
    return g;
  },
  sync(e, o, dt) {
    animRig(o.rig, { mode: 'kneel' }, dt);
    const cl = e.clasp > 0 || e.stun > 0;
    o.rig.armL.rotation.set(cl ? -2.6 : -0.8, 0, cl ? -0.6 : 0.4); o.rig.armR.rotation.set(cl ? -2.6 : -0.8, 0, cl ? 0.6 : -0.4);
    faceTo(e, P.x, P.z, 0.05);
    if (e.stun > 0) label(e.x, e.y + 7, e.z, '기도가 끝났다', '#ffd27a');
    if (Math.random() < 0.3) FX.spawn({ x: e.x + rand(-2, 2), y: e.y + rand(0, 5), z: e.z + rand(-2, 2), vy: -0.5, life: 1.2, size: 0.2, c: 0xffffff, add: false });
  },
  dmgMul: e => e.stun > 0 ? 2 : 1,
};
ET.boss_hunter = {
  init(e) { bossBase(e, '시간에 갇힌 사냥꾼', 30); e.speedMul = 1.6; e.slowT = 0; e.ang = 0; e.cx = e.cx ?? e.x; e.cz = e.cz ?? e.z; },
  col: e => ({ x: e.x, z: e.z, r: 1.2, top: e.y + 4 }),
  update(e, dt) {
    e.y = groundY(e);
    if (!e.awake) { if (pdist(e) < 13) { e.awake = true; G.boss = e; TALK.bossIntro(e); } return; }
    if (e.slowT > 0) { e.slowT -= dt; e.speedMul = 0.35; if (e.slowT <= 0) toast('사냥꾼의 시간이 다시 빨라진다'); } else e.speedMul = 1.6;
    const sdt = dt * e.speedMul;
    e.cd -= sdt; e.ang += sdt * 0.5;
    e.x = lerp(e.x, e.cx + Math.cos(e.ang) * 7, 0.05); e.z = lerp(e.z, e.cz + Math.sin(e.ang) * 4, 0.05);
    faceTo(e, P.x, P.z, 0.3);
    if (e.cd <= 0) {
      e.cd = 1.4;
      const dx = P.x - e.x, dz = P.z - e.z, n = e.hp < e.maxhp / 2 ? 3 : 1;
      for (let i = 0; i < n; i++) { const a = Math.atan2(dz, dx) + (i - (n - 1) / 2) * 0.22; spawn('proj', e.x, e.z, { y: e.y + 2.2, vx: Math.cos(a) * 15, vy: (P.y + 1 - e.y - 2.2) * 0.6, vz: Math.sin(a) * 15, dmg: 2, c: '#ffc880', arrow: true, owner: e }); }
      sfx('swing');
    }
  },
  model() { const g = new THREE.Group(); const r = makeRig({ cloak: '#c8782a', body: '#ffc880', skin: '#ffd8a0', hair: '#a85a2a' }, { ghost: ghostMat('#ffc880') }); r.scale.setScalar(2); g.add(r); g.rig = r; mesh(geo('tor', 0.9, 0.05, 4, 16, Math.PI), GLOW('#ffe0a0', 2), 0, -0.6, 0.2, r.armL).rotation.y = Math.PI / 2; g.ice = mesh(geo('sph', 3, 12, 8), ADD('#ffd27a', 1.2, 0.12), 0, 2, 0, g); return g; },
  sync(e, o, dt) { animRig(o.rig, { mode: 'walk' }, dt * e.speedMul); o.rig.armL.rotation.x = -1.6; o.ice.visible = e.slowT > 0; },
  dmgMul: e => e.slowT > 0 ? 1 : 0.25,
};
ET.boss_mine = {
  init(e) { bossBase(e, '갱도의 잔향', 38); e.split = false; e.light = { c: 0xffb35a, k: 1.6, d: 14, h: 3 }; },
  col: e => ({ x: e.x, z: e.z, r: 1.8, top: e.y + 4 }),
  update(e, dt) {
    e.y = groundY(e);
    if (!e.awake) { if (pdist(e) < 12) { e.awake = true; G.boss = e; TALK.bossIntro(e); } return; }
    e.cd -= dt;
    const dx = P.x - e.x, dz = P.z - e.z, l = Math.hypot(dx, dz) || 1;
    faceTo(e, P.x, P.z, 0.1);
    if (l > 3.6) moveEnt(e, dx / l * 2.4 * dt, dz / l * 2.4 * dt);
    if (!e.split && e.hp < e.maxhp / 2) { e.split = true; toast('엉켜 있던 형체 몇이 떨어져 나왔다'); for (let i = 0; i < 3; i++) spawn('echo', e.x + rand(-3, 3), e.z + rand(-3, 3), { kind: 'human', tint: 'mine', act: 'dig' }); }
    if (e.cd <= 0) {
      if (Math.random() < 0.55) { spawn('warn', e.x + dx / l * 3, e.z + dz / l * 3, { rad: 3, delay: 0.7, dmg: 3, c: '#ffb35a' }); e.cd = 1.8; }
      else { for (let i = 0; i < 3; i++) spawn('warn', P.x + rand(-4, 4), P.z + rand(-4, 4), { rad: 1.6, delay: 1.1, dmg: 2, c: '#ff7a2a' }); e.cd = 2.4; }
    }
  },
  model() {
    const g = new THREE.Group(), gm = ghostMat('#c89a70');
    g.rigs = [];
    for (let i = 0; i < 6; i++) { const r = makeRig({}, { ghost: gm }); const a = i / 6 * Math.PI * 2; r.position.set(Math.cos(a) * 1, 0, Math.sin(a) * 0.8); r.rotation.y = a; r.scale.setScalar(1.3); g.add(r); g.rigs.push(r); }
    g.lamp = mesh(geo('sph', 0.3), GLOW('#ffd27a', 2.6), 0, 3, 0, g);
    return g;
  },
  sync(e, o, dt) { o.rigs.forEach((r, i) => { animRig(r, { mode: 'walk' }, dt); r.position.y = Math.sin(GFX.t * 2 + i) * 0.2; }); o.lamp.position.set(Math.sin(GFX.t * 2) * 1.5, 3 + Math.sin(GFX.t * 3) * 0.3, Math.cos(GFX.t * 2) * 1.5); },
};
ET.boss_mask = {
  init(e) { bossBase(e, '회색 가면', 40); e.r = 0.5; e.dash = 0; },
  update(e, dt) {
    e.y = groundY(e);
    if (!e.awake) return;
    e.cd -= dt;
    const dx = P.x - e.x, dz = P.z - e.z, l = Math.hypot(dx, dz) || 1;
    if (e.dash > 0) { e.dash -= dt; moveEnt(e, e.dvx * dt, e.dvz * dt); if (l < 1.2 && !e.hitOnce) { e.hitOnce = true; hurtPlayer(1, e.x, e.z, { push: 16, noKill: true }); } if (Math.random() < 0.6) FX.spawn({ x: e.x, y: e.y + 1, z: e.z, life: 0.4, size: 0.4, c: 0xc0b0ff }); return; }
    faceTo(e, P.x, P.z, 0.2);
    if (l > 6) moveEnt(e, dx / l * 4.4 * dt, dz / l * 4.4 * dt);
    else if (l < 3.5) moveEnt(e, -dx / l * 3 * dt, -dz / l * 3 * dt);
    if (e.cd <= 0) {
      if (Math.random() < 0.5) { e.dash = 0.45; e.dvx = dx / l * 20; e.dvz = dz / l * 20; e.hitOnce = false; e.cd = 1.6; sfx('swing'); }
      else { spawn('warn', e.x, e.z, { rad: 5, delay: 0.9, dmg: 1, c: '#c0b0ff', push: 18 }); e.cd = 2.2; }
    }
  },
  model() { const g = new THREE.Group(); const r = makeRig({ cloak: '#5a5a62', body: '#7a7a82', skin: '#cfc8c0', hair: '#3a3a40', mask: '#9a9aa2' }); r.scale.setScalar(1.15); g.add(r); g.rig = r; return g; },
  sync(e, o, dt) {
    animRig(o.rig, { mode: e.dash > 0 ? 'run' : 'walk' }, dt);
    if (e.hp < e.maxhp * 0.5 && !o.cracked) { o.cracked = true; const c = mesh(geo('box', 0.02, 0.26, 0.02), GLOW('#7ff0ff', 2.5), 0.03, 0.02, 0.215, o.rig.head); c.rotation.z = 0.3; }
  },
};
