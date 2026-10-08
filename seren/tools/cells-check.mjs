// 셀(방·구역 독립 공간 · v24) 검사 — 실제 이동 물리로 걸어서 (헤드리스):
//  · 문(셀 경계)마다: 문 앞 1.2 m 에서 문 너머 1.3 m 까지 걷는다 → 옆 셀로 바뀌는가 · 떨어지지 않는가 · 끼이지 않는가 →
//    되돌아 걸으면 처음 셀인가. 그 층의 모든 셀을 차례로 (넘어간 셀에서 다시 그 셀의 문들).
//  · 계단: 계단 문으로 계단실 셀에 들어가 계단을 걸어 위층 계단참까지 → 층이 바뀌는가 · 떨어지지 않는가 → 위층 계단 문으로 나간다.
//  · 안전장치 기록(state.debug.escapes)은 늘지 않아야 한다 (늘면 그 자리가 실패).
//   node tools/cells-check.mjs [쓰임들|all] [건물 수=1] [층 수=3]     (SEREN_HTML=다른 빌드)
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ALL = ['home', 'office', 'market', 'cafe', 'school', 'heal', 'hotel', 'library', 'museum', 'hall', 'factory', 'depot', 'lab', 'terminal', 'admin', 'garden', 'farm', 'plant'];
const want = process.argv[2] && process.argv[2] !== 'all' ? process.argv[2].split(',') : ALL;
const NB = +(process.argv[3] || 1) || 1;
const NF = +(process.argv[4] || 3) || 3;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
const logs = [];
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message} ${(e.stack || '').split('\n').slice(1, 3).join(' ')}`));
await page.goto('file://' + (process.env.SEREN_HTML || join(root, 'index.html')) + '?play=new&nowake=1&q=low&t=0.45');
await page.waitForFunction(() => window.SEREN && SEREN.game && SEREN.game.city && SEREN.game.city.recs && SEREN.game.city.recs.length > 0 && SEREN.game.mode === 'play', null, { timeout: 300000, polling: 1000 });
await page.evaluate(() => {
  const g = SEREN.game;
  if (g.tips) g.tips.first = () => false;
  g.ui.moa = () => {};
  g.ui.blink = (mid, done) => { mid(); if (done) done(); }; // 시험: 가림 막 없이 바로 (셀 바꾸기 논리만 본다)
  const DT = 1 / 60;
  let steer = null;
  const inp = g.input, poll = inp.poll.bind(inp);
  inp.poll = (dt) => { poll(dt); if (steer) { inp.move.x = 0; inp.move.y = steer.move; g.rig.yaw = steer.yaw; } };
  const frame = () => { g.updateSim(DT); g.interiors.update(DT); };
  /** (x, z) 까지 걷기 (세계): 닿으면 true */
  window.__walkTo = (x, z, secs = 3, tol = 0.25) => {
    const p = g.player.pos;
    for (let f = 0; f < secs / DT; f++) {
      const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
      if (d < tol) { steer = null; for (let k = 0; k < 6; k++) frame(); return true; }
      steer = { move: d < 0.6 ? 0.5 : 1, yaw: Math.atan2(-dx, -dz) };
      frame();
    }
    steer = null;
    return false;
  };
  window.__settle = (n = 20) => { steer = null; for (let k = 0; k < n; k++) frame(); };
  window.__esc = () => ((g.state.debug && g.state.debug.escapes) || []).length;
});
let fails = 0, doorsN = 0, stairsN = 0;
const ex = [];
for (const pid of want) {
  const n = await page.evaluate(({ pid, NB }) => {
    const g = SEREN.game, I = g.interiors, C = g.city, P = { x: -2200, z: 5250 };
    window.__list = C.recs.filter((r) => r.door && I.info(r).pid === pid).sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z)).slice(0, NB);
    return window.__list.length;
  }, { pid, NB });
  for (let b = 0; b < n; b++) {
    await page.evaluate((b) => { const g = SEREN.game, r = window.__list[b]; g.city.fixDoor(r); g.player.teleport(r.door.x + r.door.nx * 3, undefined, r.door.z + r.door.nz * 3); g.interiors.enter(r); }, b);
    try { await page.waitForFunction(() => SEREN.game.interiors.inPocket && !SEREN.game.interiors._busy, null, { timeout: 120000, polling: 300 }); } catch { console.log(JSON.stringify({ pid, err: '들어가기 시간 초과' })); fails++; continue; }
    const r = await page.evaluate((NF) => {
      const g = SEREN.game, I = g.interiors, ind = I.cur.indoor, B = I.cur.B, G = B.G;
      try { g.ui.closeCard(); } catch {} g.mode = 'play';
      const res = { name: I.title(I.cur.r), S: B.V.S, doors: 0, stairs: 0, fails: [], cells: 0 };
      const fl = B.floors.filter((F) => F.reach && !F.dead && !F.mezz).map((F) => F.i);
      const pick = [B.ground, ...fl.filter((i) => i !== B.ground)].slice(0, NF);
      const esc0 = window.__esc();
      const fail = (s) => { res.fails.push(s); };
      for (const i of pick) {
        const F = B.floors[i];
        // 그 층 승강기 홀(없으면 큰 공간)에서
        ind.setFloor(i);
        const st0 = ind.homeKey(i);
        if (!st0) { fail(`${F.label}층: 설 셀 없음`); continue; }
        const seen = new Set([st0]), queue = [st0];
        for (let guard = 0; queue.length && guard < 60; guard++) {
          const key = queue.shift();
          ind.cur = i;
          if (!ind.setCell(key)) { fail(`${F.label}층 ${key}: 짓기 실패`); continue; }
          res.cells++;
          const out = ind.built.get(i);
          if (!out) { if (key[0] !== 'S') fail(`${F.label}층 ${key}: 그 층 없음`); continue; }
          for (const q of out.portals || []) {
            if (key[0] === 'S') continue; // 계단실 문은 계단 시험에서
            // 문 너머: 옆 방 안으로 0.9 m (옆 방이 좁으면 맞은편 벽에서 0.45 m 앞까지 — 1 m 복도로 열리는 문)
            const farR = ind.roomAt(i, ...ind.world(q.x + q.nx * 0.3, q.z + q.nz * 0.3));
            let depth = 0.3;
            for (let sd = 0.35; sd <= 1.6; sd += 0.05) { if (ind.roomAt(i, ...ind.world(q.x + q.nx * sd, q.z + q.nz * sd)) !== farR) break; depth = sd; }
            const tgt = Math.max(0.45, Math.min(0.9, depth - 0.4));
            const [ax, az] = ind.world(q.x - q.nx * 1.2, q.z - q.nz * 1.2), [bx, bz] = ind.world(q.x + q.nx * tgt, q.z + q.nz * tgt);
            const past = () => { const [gx, gz] = ind.grid(g.player.pos.x, g.player.pos.z); return (gx - q.x) * q.nx + (gz - q.z) * q.nz; }; // 문 줄을 지나 들어간 깊이
            // 출발: 문 앞 (이 셀 안이어야 — 가구에 막혔으면 문 앞 0.6 m)
            ind.cur = i; ind.setCell(key);
            let [sx, sz] = [ax, az];
            if (!ind.inside(i, sx, sz)) [sx, sz] = ind.world(q.x - q.nx * 0.6, q.z - q.nz * 0.6);
            g.player.teleport(sx, ind.yOf(i) + 0.3, sz, 0.1);
            window.__settle(6);
            if (ind.cellKey !== key) { fail(`${F.label}층 ${key}: 문 앞에 서니 ${ind.cellKey}`); continue; }
            const fy = ind.yOf(i);
            const want = ind.keyAt(i, bx, bz);
            if (!want || want === key) continue; // 같은 셀 안의 문 (다른 길로 이어진 방) — 셀 경계가 아니다
            res.doors++;
            const ok1 = window.__walkTo(bx, bz, 4);
            const p = g.player.pos;
            if (p.y < fy - 0.6) { fail(`${F.label}층 ${key}→${want}: 문턱 너머에서 떨어짐 (${(p.y - fy).toFixed(1)} m)`); continue; }
            if (ind.cellKey !== want) { fail(`${F.label}층 ${key}→${want}: ${ok1 ? '' : '(못 닿음) '}셀이 ${ind.cellKey}`); continue; }
            if (!ok1 && past() < 0.4) { fail(`${F.label}층 ${key}→${want}: 문 너머까지 못 감 (끼임 · 문 줄에서 ${past().toFixed(2)} m · 옆 방 깊이 ${depth.toFixed(2)})`); }
            if (want && want[0] !== 'S' && !seen.has(want)) { seen.add(want); queue.push(want); }
            const ok2 = window.__walkTo(sx, sz, 4);
            if (g.player.pos.y < fy - 0.6) { fail(`${F.label}층 ${want}→${key}: 되돌아오다 떨어짐`); continue; }
            if (ind.cellKey !== key) fail(`${F.label}층 ${want}→${key}: ${ok2 ? '' : '(못 닿음) '}되돌아와도 ${ind.cellKey}`);
          }
        }
        // 계단: 이 층에서 위로 가는 계단마다 (되돌이·나선)
        ind.setFloor(i);
        for (const lk of B.links.filter((k) => (k.kind === 'stair' || k.kind === 'spiral') && k.floors.includes(i) && k.floors.some((f) => f > i))) {
          const up = lk.floors.filter((f) => f > i).sort((a, b) => a - b)[0];
          const part = B.core.parts[lk.part];
          ind.cur = i;
          if (!ind.setCell(`S${lk.part}`)) { fail(`${F.label}층 계단${lk.part}: 계단실을 못 지음`); continue; }
          const out = ind.built.get(i);
          const info = out && out.stairs.find((s) => s.part === part);
          if (!info) { fail(`${F.label}층 계단${lk.part}: 계단 정보 없음`); continue; }
          res.stairs++;
          // 계단 로컬 (render.buildStair 와 같은 틀)
          let i0 = 1e9, i1 = -1e9, j0 = 1e9, j1 = -1e9;
          for (const [a, bb] of part.cells) { i0 = Math.min(i0, a); i1 = Math.max(i1, a); j0 = Math.min(j0, bb); j1 = Math.max(j1, bb); }
          const [fx, fz] = part.door.dir;
          const along = Math.abs(fx) > 0 ? i1 - i0 + 1 : j1 - j0 + 1, across = Math.abs(fx) > 0 ? j1 - j0 + 1 : i1 - i0 + 1;
          const LX = [fz, -fx], LZ = [fx, fz];
          const Pw = (lx, lz) => ind.world(info.cx + LX[0] * lx + LZ[0] * lz, info.cz + LX[1] * lx + LZ[1] * lz);
          const zF = along / 2, zB = -along / 2, LAND = 1.4, xL = -across / 2 + 0.08, xR = across / 2 - 0.08;
          const route = [];
          if (part.kind === 'spiral') {
            const R = Math.min(along, across) / 2 - 0.08, mr = (R + 0.2) / 2, edgeLz = zF - 1;
            const th = Math.acos(Math.max(-1, Math.min(1, edgeLz / mr))) + 0.14;
            const turns = info.turns || 1, K = 16 * turns;
            route.push(Pw(0, (zF + edgeLz) / 2));
            for (let k = 0; k <= K; k++) { const ph = th + ((Math.PI * 2 * turns - 2 * th) * k) / K; route.push(Pw(-mr * Math.sin(ph), mr * Math.cos(ph))); }
            route.push(Pw(0, (zF + edgeLz) / 2));
          } else {
            const loops = info.h > 4.6 ? 2 : 1;
            route.push(Pw(0, zF - LAND / 2));
            for (let k = 0; k < loops; k++) {
              route.push(Pw(xL / 2, zF - LAND - 0.15), Pw(xL / 2, zB + LAND + 0.1), Pw(xL / 2, zB + LAND / 2), Pw(xR / 2, zB + LAND / 2), Pw(xR / 2, zB + LAND + 0.1), Pw(xR / 2, zF - LAND - 0.15), Pw(0, zF - LAND / 2));
            }
          }
          g.player.teleport(route[0][0], ind.yOf(i) + 0.3, route[0][1], 0.1);
          window.__settle(8);
          let ok = true, lowest = 1e9;
          for (const [x, z] of route.slice(1)) {
            const hit = window.__walkTo(x, z, 4, 0.3);
            lowest = Math.min(lowest, g.player.pos.y - ind.yOf(i));
            if (!hit) { ok = false; break; }
          }
          const dy = g.player.pos.y - ind.yOf(up);
          if (lowest < -0.6) fail(`${F.label}층 계단${lk.part}(${part.kind}): 오르다 떨어짐 (${lowest.toFixed(1)} m)`);
          else if (!ok || Math.abs(dy) > 0.5 || ind.cur !== up) fail(`${F.label}층 계단${lk.part}(${part.kind}): 위층(${B.floors[up].label})에 못 닿음 — 층 ${B.floors[ind.cur].label} · 높이차 ${dy.toFixed(2)}${ok ? '' : ' · 끼임'}`);
          else {
            // 위층 계단 문으로 나가기: 앞 계단참 → 문 너머 1.3 m
            const [ox, oz] = Pw(0, zF + 1.3);
            const want = ind.keyAt(up, ox, oz);
            window.__walkTo(ox, oz, 4);
            if (ind.cellKey !== want) fail(`${B.floors[up].label}층 계단 문: 나가도 ${ind.cellKey} (기대 ${want})`);
          }
        }
      }
      const esc = window.__esc() - esc0;
      if (esc) fail(`안전장치가 ${esc}번 되돌림: ${JSON.stringify(g.state.debug.escapes.slice(-3))}`);
      return res;
    }, NF);
    doorsN += r.doors; stairsN += r.stairs; fails += r.fails.length;
    for (const f of r.fails.slice(0, 4)) if (ex.length < 40) ex.push(`${pid} ${r.name}: ${f}`);
    console.log(JSON.stringify({ pid, name: r.name, S: r.S, cells: r.cells, doors: r.doors, stairs: r.stairs, fails: r.fails.length, ex: r.fails.slice(0, 3) }));
    await page.evaluate(() => SEREN.game.interiors.exit());
    try { await page.waitForFunction(() => !SEREN.game.interiors.inPocket && !SEREN.game.interiors._busy, null, { timeout: 60000, polling: 300 }); } catch {}
  }
}
console.log(logs.length ? `기록:\n${[...new Set(logs)].slice(0, 8).join('\n')}` : '페이지 오류 없음');
console.log(`문 ${doorsN} · 계단 ${stairsN} · 실패 ${fails}`);
if (ex.length) console.log(ex.join('\n'));
await browser.close();
process.exit(fails ? 1 : 0);
