// 카메라 검사 (헤드리스): 실제로 걸어 다니며 카메라를 돌린다 — 실내 여러 층의 벽 앞·구석·복도, 바깥 건물 벽 옆.
//   매 프레임 화면에 그려지는 면(앞·뒷면 모두)으로 잰다 (카메라 코드가 쓰는 충돌체와 따로):
//   · 사이 벽: 플레이어 머리에서 카메라까지 사이에 그려진 면이 있다 (벽 너머를 비춘다 · 플레이어를 못 잡는다)
//   · 가까운 면: 카메라의 가까운 면(near plane) 네 모서리·가운데까지 사이에 면이 있다 (벽이 잘려 뚫려 보인다)
//   · 실내만: 카메라가 방 칸 밖(벽 너머) · 천장 위·바닥 아래
//   node tools/cam-check.mjs [쓰임들|all] [출발 자리 수=8]      (SEREN_HTML=다른 빌드)
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ALL = ['market', 'office', 'school', 'heal', 'hotel', 'home', 'library', 'factory', 'museum', 'cafe'];
const want = process.argv[2] && process.argv[2] !== 'all' ? process.argv[2].split(',') : ALL;
const NP = +(process.argv[3] || 8) || 8;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await (await browser.newContext({ viewport: { width: 800, height: 450 } })).newPage();
const logs = [];
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto('file://' + (process.env.SEREN_HTML || join(root, 'index.html')) + '?play=new&nowake=1&q=low&t=0.45');
await page.waitForFunction(() => window.SEREN && SEREN.game && SEREN.game.city && SEREN.game.city.recs && SEREN.game.city.recs.length > 0 && SEREN.game.mode === 'play', null, { timeout: 300000, polling: 1000 });
await page.evaluate((DBG) => {
  const g = SEREN.game, T = SEREN.THREE;
  if (g.tips) g.tips.first = () => false;
  g.ui.moa = () => {};
  g.ui.blink = (mid, done) => { mid(); if (done) done(); }; // 셀 넘기: 가림 막 없이 바로 (한 프레임 안에서 옆 셀을 짓는다)
  window.__dbg = DBG;
  const ray = new T.Raycaster();
  const KEYS = ['n', 'path', 'near', 'beyond', 'ceil'];
  // 잴 물체: 보이는 면만 (플레이어 몸·사람·입자·하늘은 빼고) — 앞·뒷면을 모두 맞힌다 (실내 벽은 안쪽 면만 그리므로 바깥에서는 뚫려 보인다)
  const skip = (o) => {
    for (let q = o; q; q = q.parent) {
      if (!q.visible) return true;
      if (q === g.avatar.root) return true;
      const n = q.name || '';
      if (/sky|cloud|particle|crowd|citizen|npc|people|agent|resident|moa|fauna|creature|drone|traffic|stream|vessel|halo|holo|light|glow|beam|mist|water/i.test(n)) return true;
    }
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!m || m.visible === false || (m.transparent && m.opacity < 0.35) || m.colorWrite === false || m.depthWrite === false && m.transparent) return true;
    return false;
  };
  let objs = null, sides = null;
  window.__camBegin = (indoor) => {
    objs = [];
    const src = indoor ? [...g.interiors.cur.indoor.built.values()].map((o) => o.group) : [g.engine.scene];
    for (const s of src) s.traverse((o) => { if ((o.isMesh || o.isInstancedMesh) && !o.isPoints && !o.isLine && !o.isSprite && !skip(o)) objs.push(o); });
    sides = new Map();
    for (const o of objs) for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (!sides.has(m)) { sides.set(m, m.side); m.side = T.DoubleSide; }
  };
  window.__camEnd = () => { if (sides) for (const [m, s] of sides) m.side = s; sides = null; objs = null; };
  const first = (o, d, far) => {
    ray.set(o, d); ray.near = 0; ray.far = far;
    const h = ray.intersectObjects(objs, false);
    return h.length ? h[0] : null;
  };
  const tmp = new T.Vector3(), dir = new T.Vector3(), c4 = new T.Vector3();
  // 지금 프레임 검사
  window.__camTest = (res, indoor, tag) => {
    const cam = g.engine.camera, p = cam.position, t = g.rig.smoothTarget;
    cam.updateMatrixWorld(true);
    const bad = [];
    // 사이 벽: 머리(0.3 m 비켜) → 카메라
    dir.subVectors(p, t); const d = dir.length(); dir.normalize();
    const desc = (h) => {
      const o = h.object, m = Array.isArray(o.material) ? o.material[0] : o.material, gb = o.geometry;
      if (!gb.boundingBox) gb.computeBoundingBox();
      const sz = gb.boundingBox.getSize(new T.Vector3());
      const fy = indoor ? g.interiors.cur.indoor.yOf(g.interiors.cur.indoor.cur) : 0;
      return `${o.name || o.parent && o.parent.name || '?'}|${o.isInstancedMesh ? 'inst' : 'mesh'}|${gb.type}|${sz.x.toFixed(1)}x${sz.y.toFixed(1)}x${sz.z.toFixed(1)}|y${(h.point.y - fy).toFixed(2)}|d${h.distance.toFixed(2)}|n${h.face ? h.face.normal.toArray().map((v) => v.toFixed(1)).join(',') : ''}|c${m && m.color ? m.color.getHexString() : ''}`;
    };
    if (d > 0.4) { tmp.copy(t).addScaledVector(dir, 0.3); const h = first(tmp, dir, d - 0.35); if (h) bad.push(['path', window.__dbg ? desc(h) : h.object.name || '?']); }
    // 가까운 면 네 모서리 + 가운데
    const nr = cam.near, hh = nr * Math.tan((cam.fov * Math.PI) / 360), hw = hh * cam.aspect;
    for (const [sx, sy] of [[0, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      c4.set(sx * hw, sy * hh, -nr).applyMatrix4(cam.matrixWorld);
      dir.subVectors(c4, p); const L = dir.length(); dir.normalize();
      const h = first(p, dir, L + 0.01);
      if (h) { bad.push(['near', window.__dbg ? desc(h) : h.object.name || '?']); break; }
    }
    if (indoor) {
      const I = g.interiors, ind = I.cur.indoor, i = ind.cur;
      if (!ind.inside(i, p.x, p.z)) { const out = ind.built.get(i), c = ind.cellAt(p.x, p.z), c2 = ind.cellAt(t.x, t.z); const R = c >= 0 && out.roomX[c] ? out.L.rooms[out.roomX[c] - 1] : null, R2 = c2 >= 0 && out.roomX[c2] ? out.L.rooms[out.roomX[c2] - 1] : null; bad.push(['beyond', window.__dbg ? `cam:${R ? R.type : c < 0 ? 'off' : 'none'} void${out.L.void[c]} tgt:${R2 ? R2.type : 'none'} pl:${ind.inside(i, g.player.pos.x, g.player.pos.z)} y${(p.y - ind.yOf(i)).toFixed(2)} cur${i}` : '']); }
      if (p.y > ind.ceilY(i) - 0.05 || p.y < ind.yOf(i) + 0.05) bad.push(['ceil', '']);
    }
    res.n++;
    for (const [k, w] of bad) { res[k]++; res.what[w] = (res.what[w] || 0) + 1; }
    if (bad.length && res.ex.length < 6) res.ex.push(`${tag} ${bad.map((b) => b[0]).join('+')} arm=${d.toFixed(2)} near=${cam.near.toFixed(2)}`);
  };
  window.__camRes = () => { const r = { ex: [], what: {} }; for (const k of KEYS) r[k] = 0; return r; };
  // 걷기: 앞으로 걸으며 (때때로 멈춤) 카메라를 좌우로 돌리고 위아래로 흔든다 — 게임의 한 프레임(g.update)을 그대로 돌린다
  const ready = () => { try { g.ui.closeCard(); } catch {} g.mode = 'play'; g.rig.override = null; };
  window.__walk = (res, indoor, secs, seed, tag) => {
    ready();
    const inp = g.input, poll = inp.poll.bind(inp);
    let f = 0, s = seed * 9301 + 49297;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    let lx = (rnd() - 0.5) * 0.12, ly = 0, mv = 1;
    inp.poll = (dt) => {
      poll(dt);
      if (f % 45 === 0) { lx = (rnd() - 0.5) * 0.14; mv = rnd() < 0.8 ? 1 : 0; }
      ly = Math.sin(f * 0.05 + seed) * 0.018;
      inp.move.x = 0; inp.move.y = mv; inp.look.x += lx; inp.look.y += ly; inp.lookActive = 0;
    };
    try {
      for (f = 0; f < secs * 30; f++) {
        if (g.mode !== 'play') ready();
        g.update(1 / 30);
        if (indoor && (!g.interiors.inPocket || g.interiors._busy)) break;
        if (f > 6) window.__camTest(res, indoor, `${tag} f${f}`);
      }
    } finally { inp.poll = poll; }
  };
  // 제자리에서 한 바퀴 (yaw 16 × pitch 3)
  window.__spin = (res, indoor, tag) => {
    const NOIN = { look: { x: 0, y: 0 }, wheel: 0, lookActive: 99, lastDevice: 'mouse', move: { x: 0, y: 0 } };
    const rig = g.rig, cam = g.engine.camera;
    ready();
    rig._init = false; rig.armLen = null;
    for (const pitch of [-0.6, -0.2, 0.3]) for (let k = 0; k < 16; k++) {
      rig.yaw = (k / 16) * Math.PI * 2; rig.pitch = pitch;
      for (let s = 0; s < 8; s++) { rig.update(1 / 30, NOIN, g.player); g.interiors.clampCamera(cam, rig.smoothTarget); }
      window.__camTest(res, indoor, `${tag} 돌기 yaw${k} p${pitch}`);
    }
  };
}, !!process.env.CAMDBG);
const tot = { n: 0, path: 0, near: 0, beyond: 0, ceil: 0 };
const what = {};
const add = (r) => { for (const k of Object.keys(tot)) tot[k] += r[k] || 0; for (const [k, v] of Object.entries(r.what || {})) what[k] = (what[k] || 0) + v; };
for (const pid of want) {
  const ok = await page.evaluate((pid) => {
    const g = SEREN.game, I = g.interiors, C = g.city, P = { x: -2200, z: 5250 };
    const r = C.recs.filter((q) => q.door && I.info(q).pid === pid).sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z))[0];
    if (!r) return false;
    window.__rec = r;
    C.fixDoor(r); g.player.teleport(r.door.x + r.door.nx * 3, undefined, r.door.z + r.door.nz * 3); I.enter(r); return true;
  }, pid);
  if (!ok) continue;
  try { await page.waitForFunction(() => SEREN.game.interiors.inPocket && !SEREN.game.interiors._busy, null, { timeout: 120000, polling: 300 }); } catch { console.log(JSON.stringify({ pid, err: '들어가기 시간 초과' })); continue; }
  // 실내: 층마다 (최대 3층) 벽에 붙은 칸에서 출발해 걷기 + 제자리 돌기
  const floors = await page.evaluate(() => { const B = SEREN.game.interiors.cur.B; const f = B.floors.filter((F) => F.reach && !F.dead).map((F) => F.i); return [...new Set([f[0], f[Math.floor(f.length / 2)], f[f.length - 1]])]; });
  const r = { pid, name: await page.evaluate(() => SEREN.game.interiors.title(SEREN.game.interiors.cur.r)), n: 0, path: 0, near: 0, beyond: 0, ceil: 0, ex: [], what: {}, starts: 0, skipped: 0 };
  for (const fi of floors) {
    const rr = await page.evaluate(({ fi, NP }) => {
      const g = SEREN.game, I = g.interiors, ind = I.cur.indoor;
      if (ind.cur !== fi) { ind.setFloor(fi); if (g.ops) g.ops.floorChanged(fi); g.rig.floorLock = ind.yOf(fi); }
      const G = ind.G, res = window.__camRes();
      res.starts = 0; res.skipped = 0;
      // 출발 자리: 그 층의 셀(방·구역 독립 공간)마다, 걸을 수 있는 칸 중 옆 칸이 다른 방·벽인 칸 (벽 앞·문 옆·구석)
      const cells = [];
      for (const key of ind.cellsOn(fi)) {
        ind.cur = fi;
        if (!ind.setCell(key)) continue;
        const out = ind.built.get(fi);
        if (!out) continue;
        const mine = [];
        for (let c = 0; c < out.L.room.length; c++) {
          const i = c % G.gw, j = (c / G.gw) | 0;
          const [x, z] = ind.world(G.ox + i + 0.5, G.oz + j + 0.5);
          if (!ind.inside(fi, x, z)) continue;
          const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => { const [x2, z2] = ind.world(G.ox + i + a + 0.5, G.oz + j + b + 0.5); return !ind.segClear(fi, x, z, x2, z2); });
          if (edge) mine.push(c);
        }
        for (let k = 0; k < Math.min(mine.length, 3); k++) cells.push({ key, c: mine[Math.floor(((k + 0.5) * mine.length) / Math.min(mine.length, 3))] });
      }
      window.__camBegin(true);
      try {
        for (let k = 0; k < NP * 3 && cells.length; k++) {
          const { key, c } = cells[Math.floor(((k + 0.5) * cells.length) / (NP * 3)) % cells.length];
          ind.cur = fi;
          ind.setCell(key);
          const out = ind.built.get(fi), L = out.L;
          const i = c % G.gw, j = (c / G.gw) | 0;
          const [x, z] = ind.world(G.ox + i + 0.5, G.oz + j + 0.5);
          g.player.teleport(x, ind.yOf(fi) + 0.3, z, 0.1);
          g.updateSim(1 / 30);
          const p = g.player.pos;
          if (!ind.inside(fi, p.x, p.z) || Math.abs(p.y - ind.yOf(fi)) > 0.4) { res.skipped++; continue; }
          res.starts++;
          const tag = `${fi}층 ${L.rooms[(out.roomX[c] || L.room[c]) - 1].type}`;
          window.__spin(res, true, tag);
          g.rig._init = false;
          window.__walk(res, true, 6, k + fi * 31, tag);
          if (!I.inPocket || I._busy) break;
          if (ind.cur !== fi) { ind.setFloor(fi); g.rig.floorLock = ind.yOf(fi); }
        }
      } finally { window.__camEnd(); }
      return res;
    }, { fi, NP });
    for (const k of ['n', 'path', 'near', 'beyond', 'ceil', 'starts', 'skipped']) r[k] += rr[k];
    for (const [k, v] of Object.entries(rr.what)) r.what[k] = (r.what[k] || 0) + v;
    r.ex.push(...rr.ex.slice(0, 3));
    if (!(await page.evaluate(() => SEREN.game.interiors.inPocket))) break;
  }
  r.ex = r.ex.slice(0, 6);
  console.log(JSON.stringify(r));
  add(r);
  // 바깥: 그 건물 벽을 따라 몇 자리 — 벽에 붙어 서서 돌기 + 걷기
  await page.evaluate(() => SEREN.game.interiors.exit());
  try { await page.waitForFunction(() => !SEREN.game.interiors.inPocket && !SEREN.game.interiors._busy, null, { timeout: 60000, polling: 300 }); } catch {}
  const o = await page.evaluate((NP) => {
    const g = SEREN.game, r = window.__rec, res = window.__camRes();
    res.starts = 0; res.skipped = 0;
    g.rig.floorLock = null;
    const nx = r.door.nx, nz = r.door.nz, tx = -nz, tz = nx;
    window.__camBegin(false);
    try {
      for (let k = 0; k < Math.max(3, Math.ceil(NP / 2)); k++) {
        const along = [-3, 3, -6, 6, -1.5, 1.5][k % 6], off = 0.45 + (k % 3) * 0.3;
        const x = r.door.x + nx * off + tx * along, z = r.door.z + nz * off + tz * along;
        g.player.teleport(x, undefined, z);
        for (let s = 0; s < 4; s++) g.updateSim(1 / 30);
        const p = g.player.pos;
        if (Math.hypot(p.x - x, p.z - z) > 1.2 || p.y - g.player.groundH > 0.5) { res.skipped++; continue; }
        res.starts++;
        window.__spin(res, false, `바깥 ${along}`);
        g.rig._init = false;
        window.__walk(res, false, 5, k + 7, `바깥 ${along}`);
      }
    } finally { window.__camEnd(); }
    return res;
  }, NP);
  console.log(JSON.stringify({ pid, outside: true, ...o, ex: o.ex.slice(0, 4) }));
  add(o);
}
console.log(logs.length ? `기록:\n${[...new Set(logs)].slice(0, 6).join('\n')}` : '페이지 오류 없음');
console.log('맞은 물체:', JSON.stringify(Object.entries(what).sort((a, b) => b[1] - a[1]).slice(0, process.env.CAMDBG ? 60 : 12)));
console.log(`카메라 프레임 ${tot.n} · 사이에 벽 ${tot.path} · 가까운 면이 벽을 자름 ${tot.near} · 벽 너머(방 밖) ${tot.beyond} · 천장·바닥 밖 ${tot.ceil}`);
await browser.close();
process.exit(tot.path + tot.near + tot.beyond + tot.ceil ? 1 : 0);
