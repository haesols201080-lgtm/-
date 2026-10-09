// 승강기 흐름 검사 (v24 4단계 「일반 승객용 승강기」): 메뉴로 순간이동하지 않고 사람이 타는 순서 그대로 되는가.
//  승강장에서 문이 닫혀 있고 막혀 있다 → 부르기 단추(▲) → 다른 층에 있던 칸이 달려온다(표시창 숫자가 넘어간다) → 딩 · 문이 열린다 →
//  걸어 들어간다(칸 바닥) → 조작반에서 층 단추 → 문이 닫히고 칸이 움직인다 → 도착: 그 층의 칸 안 같은 자리 · 문이 열린다 → 걸어 나간다.
//  문틀에 서 있으면 문이 닫히지 않는다 · 자동 타기(ride)로 되돌아오기. 장면: shots/lift-*.png
//   node tools/lift-flow.mjs
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await (await browser.newContext({ viewport: { width: 1000, height: 600 } })).newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => { if (m.type() === 'warning' && /셀 밖/.test(m.text())) errs.push(m.text()); });
await page.goto('file://' + (process.env.SEREN_HTML || join(root, 'index.html')) + '?play=new&nowake=1&q=low&t=0.45');
await page.waitForFunction(() => window.SEREN && SEREN.game && SEREN.game.city && SEREN.game.city.recs && SEREN.game.city.recs.length > 0 && SEREN.game.mode === 'play', null, { timeout: 400000, polling: 1000 });
let fails = 0;
const shot = async (p) => { try { await page.screenshot({ path: join(root, p), timeout: 150000 }); } catch (e) { console.log(`(사진 못 찍음: ${p})`); } };
const ok = (c, m) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) fails++; };

// 승강기가 셋 넘는 층에 서는 건물 하나
const name = await page.evaluate(() => {
  const g = SEREN.game, I = g.interiors, C = g.city;
  if (g.tips) g.tips.first = () => false;
  g.ui.moa = () => {};
  const P = g.player.pos;
  const L = C.recs.filter((r) => r.door && r.sy > 14).sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z));
  for (const r of L.slice(0, 80)) {
    const B = I.store.plan(r);
    if (!B || !B.links) continue;
    const lk = B.links.find((k) => k.kind === 'lift' && k.floors.length >= 3 && k.floors.includes(B.ground));
    if (lk) { window.__r = r; return I.title(r); }
  }
  return null;
});
ok(!!name, `승강기 건물: ${name}`);
if (!name) { await browser.close(); process.exit(1); }
await page.evaluate(() => { const g = SEREN.game, r = window.__r; g.city.fixDoor(r); g.player.teleport(r.door.x + r.door.nx * 3, undefined, r.door.z + r.door.nz * 3); g.interiors.enter(r); });
await page.waitForFunction(() => SEREN.game.interiors.inPocket && !SEREN.game.interiors._busy && SEREN.game.interiors.lifts, null, { timeout: 200000, polling: 300 });

// 도구: 프레임 돌리기(가끔 쉬어 setTimeout·blink 가 돈다) · 걷기
await page.evaluate(() => {
  const g = SEREN.game, I = g.interiors;
  const DT = 1 / 30;
  let steer = null;
  const inp = g.input, poll = inp.poll.bind(inp);
  inp.poll = (dt) => { poll(dt); if (steer) { inp.move.x = 0; inp.move.y = steer.move; g.rig.yaw = steer.yaw; } };
  window.__run = async (frames, until) => {
    for (let f = 0; f < frames; f++) {
      g.update(DT);
      if (until && until()) return f;
      if (f % 15 === 14) await new Promise((r) => setTimeout(r, 30));
    }
    return -1;
  };
  window.__walk = async (x, z, secs = 8) => {
    const p = g.player.pos;
    for (let f = 0; f < secs / DT; f++) {
      const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
      if (d < 0.35) { steer = null; await window.__run(6); return true; }
      steer = { move: 1, yaw: Math.atan2(-dx, -dz) };
      g.update(DT);
      if (f % 15 === 14) await new Promise((r) => setTimeout(r, 30));
    }
    steer = null;
    return false;
  };
  I.lifts.ff = 4;
  g.mode = 'play';
  // 사진 구도: 'hall' 승강장에서 문을 본다 · 'car' 칸 안 뒷벽에서 문 쪽 · null 끄기
  window.__frame = (kind) => {
    if (!kind) { g.rig.override = null; return; }
    const ind = I.cur.indoor, L = I.lifts.liftOn(ind.cur, window.__car.id);
    if (!L) return;
    const [fx, fz] = L.front, y = ind.yOf(ind.cur), V = ind.V;
    const P = (gx, gz, h) => { const [x, z] = ind.world(gx, gz); return new (g.player.pos.constructor)(x, y + h, z); };
    if (kind === 'hall') {
      // 승강장 안에 드는 가장 먼 자리 (벽 너머·건물 밖으로 나가지 않게)
      const [ax, az] = ind.world(L.x + fx * 0.8, L.z + fz * 0.8);
      let pos = null;
      for (let d = 4.2; d >= 1.2 && !pos; d -= 0.3) for (const sd of [0.7, 0, -0.7]) {
        const gx = L.x + fx * d + (fz ? sd : 0), gz = L.z + fz * d + (fx ? sd : 0), [x, z] = ind.world(gx, gz);
        if (ind.inside(ind.cur, x, z) && ind.segClear(ind.cur, ax, az, x, z)) { pos = P(gx, gz, 1.9); break; }
      }
      g.rig.override = { pos: pos || P(L.x + fx * 1.2, L.z + fz * 1.2, 1.9), look: P(L.x, L.z, 1.7) };
    }
    else { const b = L.bb; g.rig.override = { pos: P(b.cx - fx * (b.x1 - b.x0) * 0.42, b.cz - fz * (b.z1 - b.z0) * 0.42, 2.0), look: P(L.x + fx * 2, L.z + fz * 2, 1.4) }; }
    void V;
  };
});

// 1) 승강장: 칸은 다른 층 · 문은 닫혀 있고 막혀 있다
const s1 = await page.evaluate(async () => {
  const g = SEREN.game, I = g.interiors, ind = I.cur.indoor, LC = I.lifts, B = I.cur.B;
  const here = ind.cur;
  // 승강기 홀 셀로 (정문 로비와 다른 셀일 수 있다)
  const PL = ind.plan(here).L, hall = PL.lifthall != null ? PL.rooms[PL.lifthall] : null;
  if (hall) { const [hx, hz] = ind.world(ind.G.ox + hall.cx + 0.5, ind.G.oz + hall.cz + 0.5); I.placeAt(here, hx, hz); }
  await window.__run(2);
  const out = ind.built.get(here);
  const L = out.lifts.find((q) => q.stops && !q.cargo && q.link != null && LC.car(q.link).stops.length >= 3);
  if (!L) return { err: '이 층에 승강기 문이 없다' };
  const car = LC.car(L.link);
  const top = car.stops[car.stops.length - 1];
  car.at = top; car.y = ind.yOf(top); car.go = null; car.v = 0; car.door = 0; car.want = 0; car.calls.clear(); car.idle = 999;
  window.__car = car; window.__L = () => LC.liftOn(ind.cur, car.id) || L;
  // 승강장 문 앞 1.3 m
  const [fx, fz] = L.front;
  const [x, z] = ind.world(L.x + fx * 0.75, L.z + fz * 0.75);
  g.player.teleport(x, ind.yOf(here) + 0.2, z, 0.3);
  const V = ind.V, wx = -(fx * V.ex[0] + fz * V.ez[0]), wz = -(fx * V.ex[1] + fz * V.ez[1]);
  g.player.yaw = Math.atan2(wx, wz); g.rig.yaw = g.player.yaw + Math.PI;
  await window.__run(4);
  const t = g._findTarget();
  // 닫힌 문으로 걸어 들어가 보기
  const [cx, cz] = ind.world(L.bb.cx, L.bb.cz);
  await window.__walk(cx, cz, 3);
  const [gx, gz] = ind.grid(g.player.pos.x, g.player.pos.z);
  const n = (gx - L.x) * fx + (gz - L.z) * fz; // 문 면에서 승강장 쪽(+) 거리
  const L1 = window.__L();
  // 사진: 승강장에서 2.6 m 물러서 문을 본다
  const [bx, bz] = ind.world(L.x + fx * 0.75, L.z + fz * 0.75);
  g.player.teleport(bx, ind.yOf(here) + 0.2, bz, 0.3);
  g.player.yaw = Math.atan2(wx, wz); g.rig.yaw = g.player.yaw + Math.PI; g.rig._init = false;
  await window.__run(6);
  return { here, label: B.floors[here].label, top: B.floors[top].label, tkind: t && t.kind, tlabel: t && t.label, col: !!L1.col, open: L1.open, n: +n.toFixed(2), disp: L1.disp && L1.disp.key };
});
if (s1.err) { ok(false, s1.err); await browser.close(); process.exit(1); }
ok(s1.tkind === 'ilift', `승강장 문 앞 표적: ${s1.tlabel}`);
ok(s1.col && s1.open === 0, '칸이 없는 동안 문은 닫혀 있고 문 막이가 있다');
ok(s1.n > 0.2, `닫힌 문을 지나 승강로로 들어가지 못한다 (문 면에서 ${s1.n} m)`);
ok(/\|false$/.test(s1.disp || '') && s1.disp.startsWith(s1.top), `문 위 표시창: 칸은 ${s1.top}층 (${s1.disp})`);
await page.evaluate(() => window.__frame('hall')); await page.waitForTimeout(2500);
await shot('shots/lift-1-hall.png');
await page.evaluate(() => window.__frame(null));

// 2) 부르기 단추 → 칸이 내려오고(표시창이 넘어간다) → 딩 · 문이 열린다
const s2 = await page.evaluate(async () => {
  const g = SEREN.game, I = g.interiors, LC = I.lifts, ind = I.cur.indoor, car = window.__car; let L = window.__L();
  const [fx, fz] = L.front;
  const [x, z] = ind.world(L.x + fx * 0.75, L.z + fz * 0.75);
  g.player.teleport(x, ind.yOf(ind.cur) + 0.2, z, 0.3);
  await window.__run(60, () => { const q = g._findTarget(); return !!q && q.kind === 'ilift' && !ind._xing; });
  await new Promise((r) => setTimeout(r, 300));
  L = window.__L();
  const t = g._findTarget();
  if (!t || t.kind !== 'ilift') {
    const p = g.player.pos, [gx, gz] = ind.grid(p.x, p.z), out = ind.built.get(ind.cur), it = I.target(p);
    return { err: `승강장 표적 없음 (${t && t.kind} ${t && t.label}) · 문에서 (${(gx - L.x).toFixed(2)}, ${(gz - L.z).toFixed(2)}) y${(p.y - ind.yOf(ind.cur)).toFixed(2)} · 실내 표적 ${it && it.kind} · 이 층 승강기 ${out ? out.lifts.filter((q) => q.stops).length : -1} · L 지음 ${!!out && out.lifts.includes(L)} · 셀 ${ind.cellKey} 건너는 중 ${!!ind._xing}` };
  }
  I.use(t);
  const lay = g.ui._cardWrap;
  const acts = lay && lay.acts ? lay.acts.map((a) => a.label) : [];
  const cls = lay ? lay.className : '';
  const dn = lay.acts.find((a) => /아래/.test(a.label)) || lay.acts[0];
  dn.run();
  await window.__run(1);
  L = window.__L();
  const lit = L.btn.down.material.color.getHex() === 0xffb648 || L.btn.up.material.color.getHex() === 0xffb648;
  const seen = new Set([L.disp.key.split('|')[0]]);
  let moved = false;
  const f = await window.__run(4000, () => { L = window.__L(); if (L.disp.key) seen.add(L.disp.key.split('|')[0]); if (car.v > 0) moved = true; return car.at === ind.cur && car.door >= 1; });
  await new Promise((r) => setTimeout(r, 800));
  return { acts, cls, lit, frames: f, seen: [...seen], moved, open: L.open, col: !!L.col, here: L.here, plateGone: !g.ui._cardWrap };
});
if (s2.err) { ok(false, s2.err); await browser.close(); process.exit(1); }
ok(s2.acts.length >= 1, `부르기 판: ${s2.acts.join(' / ')} (${s2.cls.includes('dev-liftc') ? '승강장 판' : s2.cls})`);
ok(s2.lit, '누른 단추에 불이 들어온다 (세계의 단추 판)');
ok(s2.moved && s2.frames > 0, `칸이 실제로 달려왔다 (${s2.frames} 프레임)`);
ok(s2.seen.length >= 3, `표시창이 층마다 넘어갔다: ${s2.seen.join('→')}`);
ok(s2.open === 1 && !s2.col && s2.here, '도착: 문이 다 열리고 문 막이가 걷혔다');
ok(s2.plateGone, '문이 열리자 부르기 판에서 물러섰다');
await page.evaluate(() => window.__frame('hall')); await page.waitForTimeout(2500);
await shot('shots/lift-2-open.png');
await page.evaluate(() => window.__frame(null));

// 3) 걸어 들어가기 → 조작반 → 층 단추 → 문이 닫히고 움직인다 → 도착 (같은 칸 같은 자리) → 문이 열린다
const s3 = await page.evaluate(async () => {
  const g = SEREN.game, I = g.interiors, LC = I.lifts, ind = I.cur.indoor, B = I.cur.B, car = window.__car; let L = window.__L();
  const from = ind.cur;
  const [cx, cz] = ind.world(L.bb.cx, L.bb.cz);
  // 문 앞 → 문 안쪽 → 칸 가운데 (문틀 기둥에 비스듬히 걸리지 않게 문을 똑바로 지난다)
  const [fx0, fz0] = L.front;
  const [ax, az] = ind.world(L.x + fx0 * 0.9, L.z + fz0 * 0.9), [bx, bz] = ind.world(L.x - fx0 * 0.6, L.z - fz0 * 0.6);
  await window.__walk(ax, az, 4);
  await window.__walk(bx, bz, 4);
  const walked = await window.__walk(cx, cz, 4);
  await window.__run(30, () => { const q = g._findTarget(); return !!q && q.kind === 'icar'; });
  L = window.__L();
  const inCar = LC.inCar() === L;
  const yIn = +(g.player.pos.y - ind.yOf(from)).toFixed(2);
  const t = g._findTarget();
  I.use(t);
  const lay = g.ui._cardWrap;
  const cls = lay ? lay.className : '';
  const to = car.stops.filter((i) => i !== from).sort((a, b) => Math.abs(b - from) - Math.abs(a - from))[0];
  const act = lay && lay.acts && lay.acts.find((a) => a.label.startsWith(String(B.floors[to].label) + ' '));
  if (!act) {
    const [gx, gz] = ind.grid(g.player.pos.x, g.player.pos.z);
    return { err: true, walked, inCar, yIn, tkind: t && t.kind, cls, acts: lay && lay.acts ? lay.acts.map((a) => a.label) : null, to: B.floors[to].label, rel: [+(gx - L.bb.cx).toFixed(2), +(gz - L.bb.cz).toFixed(2)], here: L.here, open: L.open, col: !!L.col };
  }
  act.run();
  const [gx0, gz0] = ind.grid(g.player.pos.x, g.player.pos.z);
  const rel0 = [gx0 - L.x, gz0 - L.z];
  let shut = false, moving = false, panelLive = new Set();
  const f = await window.__run(6000, () => {
    if (car.door === 0) shut = true;
    if (car.v > 0) moving = true;
    const d = document.querySelector('.lp-disp b'); if (d) panelLive.add(d.textContent);
    return ind.cur === to && car.at === to && car.door >= 1;
  });
  await new Promise((r) => setTimeout(r, 900));
  const L2 = LC.liftOn(to, car.id);
  const [gx1, gz1] = ind.grid(g.player.pos.x, g.player.pos.z);
  const rel1 = [gx1 - L2.x, gz1 - L2.z];
  return {
    walked, inCar, yIn, tkind: t && t.kind, cls, to: B.floors[to].label, from: B.floors[from].label, frames: f, shut, moving, panelLive: [...panelLive],
    cur: B.floors[ind.cur].label, inCar2: LC.inCar() === L2, drift: +Math.hypot(rel1[0] - rel0[0], rel1[1] - rel0[1]).toFixed(2), y2: +(g.player.pos.y - ind.yOf(ind.cur)).toFixed(2),
    open2: L2.open, panelGone: !g.ui._cardWrap, lit: [...car.lit],
  };
});
if (s3.err) { ok(false, `칸 안 조작반 못 엶: ${JSON.stringify(s3)}`); await browser.close(); process.exit(1); }
ok(s3.walked && s3.inCar, `걸어서 칸 안으로 (바닥 높이 ${s3.yIn} m)`);
ok(s3.tkind === 'icar' && s3.cls.includes('dev-lift'), '칸 안 표적 = 조작반');
ok(s3.shut && s3.moving, '층 단추 → 문이 닫히고 칸이 움직였다');
ok(s3.panelLive.length >= 3, `조작반 표시창이 넘어갔다: ${s3.panelLive.join('→')}`);
ok(s3.frames > 0 && s3.cur === s3.to, `${s3.from}층 → ${s3.to}층 도착`);
ok(s3.inCar2 && s3.drift < 0.3 && Math.abs(s3.y2) < 0.3, `도착 층의 같은 칸 같은 자리 (어긋남 ${s3.drift} m, 높이 ${s3.y2} m)`);
ok(s3.open2 === 1 && s3.panelGone && !s3.lit.length, '도착: 문이 열리고 조작반이 닫히고 단추 불이 꺼졌다');
await page.evaluate(() => window.__frame('car')); await page.waitForTimeout(2500);
await shot('shots/lift-3-arrive.png');
await page.evaluate(() => window.__frame(null));

// 4) 문틀에 서 있으면 문이 닫히지 않는다 → 걸어 나간다 (셀 밖 사고 없음)
const s4 = await page.evaluate(async () => {
  const g = SEREN.game, I = g.interiors, LC = I.lifts, ind = I.cur.indoor, car = window.__car;
  const L = LC.liftOn(ind.cur, car.id);
  const [fx, fz] = L.front;
  const [dx, dz] = ind.world(L.x + fx * 0.05, L.z + fz * 0.05);
  await window.__walk(dx, dz, 4);
  car.hold = 0;
  await window.__run(240);
  const held = car.want === 1 && L.open > 0.85;
  const [pgx, pgz] = ind.grid(g.player.pos.x, g.player.pos.z);
  const dbg = { n: +((pgx - L.x) * fx + (pgz - L.z) * fz).toFixed(2), s: +(fz ? pgx - L.x : pgz - L.z).toFixed(2), W: L.W, want: car.want, door: +car.door.toFixed(2), hold: +car.hold.toFixed(2), at: car.at, cur: ind.cur, open: L.open, still: LC.still(car), calls: [...car.calls] };
  const [hx, hz] = ind.world(L.x + fx * 0.85, L.z + fz * 0.85);
  const out = await window.__walk(hx, hz, 6);
  await window.__run(Math.ceil(3 / (1 / 30) / LC.ff) + 60);
  const esc = (g.state.debug && g.state.debug.escapes || []).length;
  return { held, dbg, out, key: ind.cellKey, hallKey: ind.keyAt(ind.cur, g.player.pos.x, g.player.pos.z), closed: L.open === 0 && !!L.col, esc };
});
ok(s4.held, `문틀에 서 있는 동안 문이 닫히지 않는다 ${s4.held ? '' : JSON.stringify(s4.dbg)}`);
ok(s4.out && s4.key === s4.hallKey, `걸어 나와 승강장 셀 (${s4.key})`);
ok(s4.closed, '내린 뒤 문이 닫히고 문 막이가 다시 선다');
ok(s4.esc === 0, `셀 밖 사고 ${s4.esc}번`);

// 4b) 주민도 같은 칸: 할 일을 마친 손님이 승강장에 줄을 서서 부르고 → 문이 열리면 타고 → 문이 닫히면 떠난다 · 새 손님은 칸을 타고 온다
const s4b = await page.evaluate(async () => {
  const g = SEREN.game, I = g.interiors, LC = I.lifts, ind = I.cur.indoor, car = window.__car, ag = ind.agents;
  if (!ag) return { skip: true };
  const L = LC.liftOn(ind.cur, car.id);
  await window.__run(200, () => car.door === 0 && !car.want);
  // 칸을 다른 층으로 보내 둔다 (손님이 불러야 온다)
  const other = car.stops.find((i) => i !== ind.cur);
  car.at = other; car.y = ind.yOf(other); car.go = null; car.v = 0; car.door = 0; car.want = 0; car.calls.clear(); car.idle = 999;
  const [fx, fz] = L.front;
  const spot = ag.freeNear(ind.cur, L.x + fx * 0.9, L.z + fz * 0.9);
  const a = ag.spawn({ key: 'test:npc', role: 'visitor', floor: ind.cur, gx: spot[0], gz: spot[1], plan: [{ act: 'look', t: 0.5 }] });
  LC._seen.add(a);
  let called = false, waited = false, boarded = false, vis = false;
  const f = await window.__run(6000, () => {
    if (car.calls.has(ind.cur)) called = true;
    if (called && !boarded && !a.path && Math.hypot(a.gx - L.x, a.gz - L.z) < 3.4) waited = true;
    if (a.inCar) { boarded = true; if (ag.visible().includes(a)) vis = true; }
    return !ag.list.includes(a);
  });
  // 새 손님: 승강기 홀에 나타나는 대신 칸을 타고 온다
  await window.__run(200, () => car.door === 0 && !car.want && car.go == null);
  const PL = ind.plan(ind.cur).L, hall = PL.lifthall != null ? PL.rooms[PL.lifthall] : null;
  let arr = null;
  if (hall) {
    const st = ag.freeNear(ind.cur, ind.G.ox + hall.cx + 0.5, ind.G.oz + hall.cz + 0.5);
    const b = ag.spawn({ key: 'test:arr', role: 'visitor', floor: ind.cur, gx: st[0], gz: st[1], plan: [{ act: 'look', t: 60 }] });
    await window.__run(3);
    const conv = !!b.inCar;
    const f2 = await window.__run(6000, () => !b.inCar && !b.path);
    arr = { conv, f2, d: +Math.hypot(b.gx - st[0], b.gz - st[1]).toFixed(2), hiddenWhileAway: true };
  }
  return { called, waited, boarded, vis, f, gone: !ag.list.includes(a), arr };
});
if (s4b.skip) ok(false, '주민 없음 — 주민 승강기 검사 못 함');
else {
  ok(s4b.called && s4b.waited, '손님이 승강장 앞에 서서 칸을 불렀다');
  ok(s4b.boarded && s4b.vis, '문이 열리자 칸 안으로 걸어 들어갔다 (칸 안에서도 보인다)');
  ok(s4b.gone && s4b.f > 0, `문이 닫히자 칸과 함께 떠났다 (${s4b.f} 프레임)`);
  ok(!s4b.arr || (s4b.arr.conv && s4b.arr.f2 > 0 && s4b.arr.d < 0.6), `새 손님이 칸을 타고 와서 걸어 나왔다 ${s4b.arr ? `(${s4b.arr.f2} 프레임, 원래 자리까지 ${s4b.arr.d} m)` : '(승강기 홀 없음)'}`);
}

// 5) 자동 타기 (사람 순서 그대로) 로 처음 층으로
const s5 = await page.evaluate(async () => {
  const g = SEREN.game, I = g.interiors, ind = I.cur.indoor, B = I.cur.B, car = window.__car;
  const L = I.lifts.liftOn(ind.cur, car.id);
  const p = I.ride(L, B.ground);
  let done = null;
  p.then((v) => { done = v; });
  await window.__run(9000, () => done != null);
  await new Promise((r) => setTimeout(r, 300));
  return { done, cur: B.floors[ind.cur].label, ground: B.floors[B.ground].label, inCar: !!I.lifts.inCar() };
});
ok(s5.done === true && s5.cur === s5.ground && s5.inCar, `자동 타기: ${s5.cur}층 (칸 안)`);
await shot('shots/lift-4-inside.png');

ok(!errs.length, `페이지 오류 ${errs.length}${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
console.log(fails ? `실패 ${fails}` : '모두 통과');
await browser.close();
process.exit(fails ? 1 : 0);
