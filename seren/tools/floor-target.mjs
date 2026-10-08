// 층 섞임 검사 (헤드리스): 작은 건물(바닥이 좁고 층이 여럿)부터 들어가, 층마다 걸을 수 있는 모든 칸에 서서 (그리고 뛰어오른 높이에서)
//   E 표적이 「지금 선 층」의 것인가를 본다 — 위·아래 층의 가구·사람·승강기·안내지기가 잡히면 「다른 층 표적」
//   node tools/floor-target.mjs [건물 수=16]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const NB = +(process.argv[2] || 16) || 16;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await (await browser.newContext({ viewport: { width: 800, height: 450 } })).newPage();
const logs = [];
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto('file://' + (process.env.SEREN_HTML || join(root, 'index.html')) + '?play=new&nowake=1&q=low&t=0.45');
await page.waitForFunction(() => window.SEREN && SEREN.game && SEREN.game.city && SEREN.game.city.recs && SEREN.game.city.recs.length > 0 && SEREN.game.mode === 'play', null, { timeout: 300000, polling: 1000 });
// 작은 건물: 바닥 넓이가 작고 높이가 두 층 넘는 것, 쓰임이 고르게
const n = await page.evaluate((NB) => {
  const g = SEREN.game, I = g.interiors, C = g.city;
  if (g.tips) g.tips.first = () => false;
  const P = { x: -2200, z: 5250 };
  const L = C.recs.filter((r) => r.door && r.sy > 6.5 && Math.hypot(r.x - P.x, r.z - P.z) < 3000).map((r) => ({ r, a: r.sx * r.sz, pid: I.info(r).pid })).sort((a, b) => a.a - b.a);
  const per = new Map(), pick = [];
  for (const q of L) { const k = per.get(q.pid) || 0; if (k >= 2) continue; per.set(q.pid, k + 1); pick.push(q.r); if (pick.length >= NB) break; }
  window.__list = pick;
  return pick.length;
}, NB);
let bad = 0, cellsN = 0, tgtN = 0;
for (let b = 0; b < n; b++) {
  await page.evaluate((b) => { const g = SEREN.game, r = window.__list[b]; g.city.fixDoor(r); g.player.teleport(r.door.x + r.door.nx * 3, undefined, r.door.z + r.door.nz * 3); g.interiors.enter(r); }, b);
  try { await page.waitForFunction(() => SEREN.game.interiors.inPocket && !SEREN.game.interiors._busy, null, { timeout: 120000, polling: 300 }); } catch { console.log('들어가기 시간 초과'); continue; }
  const r = await page.evaluate(() => {
    const g = SEREN.game, I = g.interiors, ind = I.cur.indoor, B = I.cur.B, G = B.G;
    try { g.ui.closeCard(); } catch {}
    g.mode = 'play';
    const floors = B.floors.filter((F) => F.reach && !F.dead).map((F) => F.i);
    const res = { name: I.title(I.cur.r), pid: I.info(I.cur.r).pid, floors: floors.length, h: floors.map((i) => (B.floors[i].ceil - B.floors[i].y).toFixed(1)).join('/'), cells: 0, targets: 0, bad: [], kinds: {} };
    const whose = (t, i, py) => {
      // 표적이 어느 층 것인가 (모르면 null)
      const out = ind.built.get(i);
      if (t.kind === 'op') { if (t.o && t.o.F) { for (const [j, o] of ind.built) if (o.fix && o.fix.includes(t.o.F)) return j; } return null; }
      if (t.kind === 'citizen') { const p = t.o; if (p.floor != null) return p.floor; return Math.abs(p.pos.y - py) < 1.6 ? i : 'y' + (p.pos.y - ind.yOf(i)).toFixed(1); }
      if (t.kind === 'npc' || t.kind === 'lobby') return Math.abs(t.o.pos.y - py) < 1.6 ? i : 'y' + (t.o.pos.y - ind.yOf(i)).toFixed(1);
      if (t.kind === 'facility') return t.o.npc && Math.abs(t.o.npc.pos.y - py) < 1.6 ? i : 'fac';
      if (t.kind === 'ilift') return out.lifts.includes(t.o) ? i : 'lift?';
      return i;
    };
    for (const i of floors) {
      ind.setFloor(i); if (g.ops) g.ops.floorChanged(i);
      const out = ind.built.get(i);
      if (!out) continue;
      for (let c = 0; c < out.L.room.length; c++) {
        const cx = G.ox + (c % G.gw) + 0.5, cz = G.oz + ((c / G.gw) | 0) + 0.5;
        const [x, z] = ind.world(cx, cz);
        if (!ind.inside(i, x, z)) continue;
        for (const jump of [0, 1]) { // 서 있을 때 · 제자리에서 실제로 뛰었을 때 (가장 높은 곳)
          g.player.teleport(x, ind.yOf(i) + 0.3, z, 0.1);
          if (Math.abs(g.player.pos.y - ind.yOf(i)) > 0.5) break; // 가구 위 등
          if (jump) {
            const pl = g.player, NOIN = { move: { x: 0, y: 0 }, look: { x: 0, y: 0 }, pressed: () => false, down: new Set(), held: () => false };
            pl.vel.y = 8.2; pl.setState('air');
            let top = pl.pos.y;
            for (let k = 0; k < 60 && pl.vel.y > -0.5; k++) { pl.update(1 / 60, null, g.rig); top = Math.max(top, pl.pos.y); if (pl.vel.y <= 0) break; }
            res.jumpTop = Math.max(res.jumpTop || 0, top - ind.yOf(i));
          }
          ind.update(0.016);
          if (g.citizens) g.citizens.update(0.016);
          res.cells++;
          const lift = jump;
          const t = g._findTarget();
          if (ind.cur !== i) { res.bad.push(`${B.floors[i].label}층 칸${c}${lift ? '(점프)' : ''}: 층 판정 ${B.floors[ind.cur].label}층`); ind.setFloor(i); continue; }
          if (!t) continue;
          res.targets++;
          res.kinds[t.kind] = (res.kinds[t.kind] || 0) + 1;
          const w = whose(t, i, g.player.pos.y);
          if (w !== i && w !== null) res.bad.push(`${B.floors[i].label}층 칸${c}${lift ? '(점프)' : ''}: 「${String(t.label).slice(0, 30)}」(${t.kind}) → ${typeof w === 'number' ? B.floors[w].label + '층 것' : w}`);
        }
      }
    }
    res.bad = [...new Set(res.bad.map((s) => s.replace(/칸\d+/, '칸')))].slice(0, 8).concat(res.bad.length ? [`(모두 ${res.bad.length})`] : []);
    return res;
  });
  cellsN += r.cells; tgtN += r.targets;
  if (r.bad.length) bad += +((r.bad[r.bad.length - 1].match(/\d+/) || [0])[0]);
  console.log(JSON.stringify(r));
  await page.evaluate(() => SEREN.game.interiors.exit());
  try { await page.waitForFunction(() => !SEREN.game.interiors.inPocket && !SEREN.game.interiors._busy, null, { timeout: 60000, polling: 300 }); } catch {}
}
console.log(logs.length ? `기록:\n${[...new Set(logs)].slice(0, 6).join('\n')}` : '페이지 오류 없음');
console.log(`선 자리 ${cellsN} · 표적 ${tgtN} · 다른 층 표적·층 판정 틀림 ${bad}`);
await browser.close();
process.exit(bad ? 1 : 0);
