// 승강기 전수 점검 (v24 「문만 있고 실제 카가 없거나, 문 뒤가 빈 공간·단순 평면, 승강로와 카가 이어지지 않거나, 층 바닥과 카 바닥이 어긋나는 상태를 허용하지 않는다」)
//  가까운 건물 N 채에 들어가 1층(과 화물 승강기는 그 정거장)의 승강기마다: 문짝 두 짝 · 문 위 표시창 · 부르기 단추 · 칸 안 조작반 ·
//  칸이 그 층에 서면 칸 바닥이 층 바닥과 같은 높이(걸을 수 있는 충돌체) · 천장 높이 · 칸 넓이(승객/화물) · 문 앞이 걸을 수 있는 승강장 · 칸이 승강기 방 안에.
//   node tools/lift-audit.mjs [건물 수=16]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const N = +(process.argv[2] || 16);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await (await browser.newContext({ viewport: { width: 480, height: 270 } })).newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto('file://' + (process.env.SEREN_HTML || join(root, 'index.html')) + '?play=new&nowake=1&q=low&t=0.45');
await page.waitForFunction(() => window.SEREN && SEREN.game && SEREN.game.city && SEREN.game.city.recs && SEREN.game.city.recs.length > 0 && SEREN.game.mode === 'play', null, { timeout: 400000, polling: 1000 });

const list = await page.evaluate((N) => {
  const g = SEREN.game, I = g.interiors, C = g.city, P = g.player.pos;
  if (g.tips) g.tips.first = () => false;
  g.ui.moa = () => {};
  const recs = C.recs.filter((r) => r.door && r.sy > 9).sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z));
  const out = [];
  let cargo = 0;
  for (const r of recs.slice(0, 600)) {
    const B = I.store.plan(r);
    if (!B || !B.links) continue;
    const lifts = B.links.filter((k) => (k.kind === 'lift' || k.kind === 'cargo') && k.floors.includes(B.ground));
    if (!lifts.length) continue;
    const hasCargo = lifts.some((k) => k.kind === 'cargo');
    // 화물 승강기 있는 건물을 절반쯤 섞는다
    if (!hasCargo && out.length - cargo >= Math.ceil(N / 2)) continue;
    if (hasCargo) cargo++;
    out.push(C.recs.indexOf(r));
    if (out.length >= N) break;
  }
  window.__recs = out;
  return out.length;
}, N);
console.log(`건물 ${list}채`);

let lifts = 0, bad = 0;
const kinds = {};
for (let k = 0; k < list; k++) {
  await page.evaluate((k) => { const g = SEREN.game, r = g.city.recs[window.__recs[k]]; if (g.interiors.inPocket) g.interiors.exit(); g.city.fixDoor(r); g.player.teleport(r.door.x + r.door.nx * 3, undefined, r.door.z + r.door.nz * 3); window.__entering = r; }, k);
  await page.waitForFunction(() => !SEREN.game.interiors.inPocket && !SEREN.game.interiors._busy, null, { timeout: 120000, polling: 300 }).catch(() => {});
  await page.evaluate(() => SEREN.game.interiors.enter(window.__entering));
  const okEnter = await page.waitForFunction(() => SEREN.game.interiors.inPocket && !SEREN.game.interiors._busy && SEREN.game.interiors.lifts, null, { timeout: 200000, polling: 300 }).then(() => true).catch(() => false);
  if (!okEnter) { console.log(`#${k} 못 들어감`); bad++; continue; }
  const res = await page.evaluate(async () => {
    const g = SEREN.game, I = g.interiors, ind = I.cur.indoor, B = I.cur.B, LC = I.lifts, C = g.world.colliders;
    const name = `${I.title(I.cur.r)} (${B.pid})`;
    // 승강기는 지금 셀에 닿은 것만 짓는다 — 승강기 홀 셀로 (정문 셀이 홀과 다른 건물)
    const hk = ind.homeKey(ind.cur);
    if (hk && hk !== ind.cellKey) { ind.setCell(hk); for (let f = 0; f < 4; f++) g.update(1 / 30); }
    const out0 = ind.built.get(ind.cur);
    const rep = [];
    // 짜임에는 1층에 서는 승강기가 있는데 지은 층에 승강기 문이 없으면 문제
    const want = B.links.filter((k) => (k.kind === 'lift' || k.kind === 'cargo') && k.floors.includes(ind.cur));
    const have = new Set(out0.lifts.filter((q) => q.stops && q.link != null).map((q) => q.link));
    for (const k of want) if (!have.has(k.id)) rep.push({ cargo: k.kind === 'cargo', err: `짜임의 승강기 ${k.id}(${k.kind}) 가 이 층에 없음 · 지은 승강기 ${out0.lifts.length} · 층 ${ind.cur}/${B.ground} · 셀 ${ind.cellKey}` });
    for (const L0 of out0.lifts.filter((q) => q.stops && q.link != null)) {
      // 승강장 셀이 지어지게 문 앞에 서서
      const [fx, fz] = L0.front;
      I.placeAt(ind.cur, ...ind.world(L0.x + fx * 1.2, L0.z + fz * 1.2));
      for (let f = 0; f < 6; f++) g.update(1 / 30);
      const car = LC.car(L0.link);
      if (!car) { rep.push({ cargo: L0.cargo, err: '칸 없음' }); continue; }
      // 칸을 이 층에 세우고 문을 연다
      car.at = ind.cur; car.y = ind.yOf(ind.cur); car.go = null; car.v = 0; car.door = 1; car.want = 1; car.hold = 999; car.calls.clear();
      for (let f = 0; f < 4; f++) g.update(1 / 30);
      const L = LC.liftOn(ind.cur, car.id);
      if (!L) { rep.push({ cargo: L0.cargo, err: '칸이 이 층에 안 보임' }); continue; }
      const y0 = ind.yOf(ind.cur), bb = L.bb;
      const [cx, cz] = ind.world(bb.cx, bb.cz);
      const gr = C.ground(cx, cz, y0 + 0.5, 0.6, 0.15, {});
      const floorDy = gr && gr.h != null ? +(gr.h - y0).toFixed(3) : null;
      const W = +(bb.x1 - bb.x0).toFixed(2), D = +(bb.z1 - bb.z0).toFixed(2);
      const [hx, hz] = ind.world(L.x + fx * 0.75, L.z + fz * 0.75);
      const hallKey = ind.keyAt(ind.cur, hx, hz);
      const N2 = g.ops && g.ops.agents ? g.ops.agents.navOf(ind.cur) : null;
      let hallWalk = null;
      if (N2) { const ix = Math.floor((L.x + fx * 0.75 - N2.ox) * 2), iz = Math.floor((L.z + fz * 0.75 - N2.oz) * 2); hallWalk = ix >= 0 && iz >= 0 && ix < N2.gw && iz < N2.gh ? !!N2.ok[iz * N2.gw + ix] : false; }
      const pl = ind.plan(ind.cur), R = pl.L.rooms[L.room];
      const G = B.G;
      let inRoom = true;
      for (const [gx, gz] of [[bb.x0 + 0.05, bb.z0 + 0.05], [bb.x1 - 0.05, bb.z0 + 0.05], [bb.x0 + 0.05, bb.z1 - 0.05], [bb.x1 - 0.05, bb.z1 - 0.05]]) {
        const ci = Math.floor(gx - G.ox), cj = Math.floor(gz - G.oz), c = cj * G.gw + ci;
        if (!(R && pl.L.room[c] === L.room + 1)) inRoom = false;
      }
      const r = {
        cargo: !!L.cargo, leaves: (L.leaves || []).length, disp: !!L.disp, btn: !!L.btn && Object.keys(L.btn).length, panel: !!(L.part != null),
        floorDy, ceil: +((L.top ?? L.ceil ?? 0) - 0).toFixed(2), W, D, hallKey: !!hallKey, hallWalk, inRoom,
        open: L.open, col: !!L.col,
      };
      const minA = L.cargo ? 2.0 : 1.0;
      r.ok = r.leaves === 2 && r.disp && r.btn > 0 && floorDy != null && Math.abs(floorDy) < 0.06 && W >= minA && D >= minA && r.hallKey && r.hallWalk !== false && r.inRoom;
      rep.push(r);
      car.hold = 0;
    }
    return { name, rep };
  });
  for (const r of res.rep) {
    lifts++;
    const kind = r.cargo ? '화물' : '승객';
    kinds[kind] = (kinds[kind] || 0) + 1;
    if (!r.ok) { bad++; console.log(`FAIL ${res.name} ${kind} ${JSON.stringify(r)}`); }
  }
  console.log(`#${k} ${res.name}: 승강기 ${res.rep.length} (${res.rep.map((r) => `${r.cargo ? '화물' : '승객'} ${r.W}×${r.D}${r.ok ? '' : ' ✗'}`).join(', ')})`);
}
console.log(`승강기 ${lifts}대 (${Object.entries(kinds).map(([k, v]) => `${k} ${v}`).join(' · ')}) · 문제 ${bad}`);
if (errs.length) console.log('페이지 오류', errs.slice(0, 5).join(' | '));
await browser.close();
process.exit(bad || errs.length ? 1 : 0);
