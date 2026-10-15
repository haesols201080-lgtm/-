// 화물 승강기 짐수레 검사 (v24 「화물 카트·상자·팔레트를 싣고 다른 층으로 옮길 수 있어야」·「승객용과 사용 흐름을 구분」)
//  화물 승강기 옆에 짐 실은 수레가 서 있다(충돌체) → 밀기(과제 「화물 옮기기」·길 안내는 화물 승강기로) → 승객 승강기는 부를 수 없고 문 막이가 선다 ·
//  계단 문도 막힌다 → 화물 승강기를 수레째 타고 다른 층으로(자동 타기) → 그 층 창고에 짐 내리기(세입자 재고가 는다) → 세우기 → 건물을 나가면 치운다.
//  수레가 벽·칸 벽에 묻히지 않았는지 프레임마다 잰다. 장면: shots/cargo-*.png
//   node tools/cargo-flow.mjs
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

// 화물 승강기가 1층과 창고가 있는 다른 층에 서는 건물
const name = await page.evaluate(() => {
  const g = SEREN.game, I = g.interiors, C = g.city;
  if (g.tips) g.tips.first = () => false;
  g.ui.moa = () => {};
  const P = g.player.pos, TAGS = ['stock', 'raw', 'finished', 'pallet', 'produce', 'fuel'];
  const L = C.recs.filter((r) => r.door && r.sy > 9).sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z));
  for (const r of L.slice(0, 400)) {
    const B = I.store.plan(r);
    if (!B || !B.links) continue;
    const lk = B.links.find((k) => k.kind === 'cargo' && k.floors.includes(B.ground) && k.floors.some((j) => { if (j === B.ground) return false; const pl = I.store.floor(r, j); return pl && pl.fix.some((f) => TAGS.includes(f.tag)); }));
    if (lk) { window.__r = r; return `${I.title(r)} (${B.pid}, 화물 승강기 ${lk.floors.length}층)`; }
  }
  return null;
});
ok(!!name, `화물 승강기 건물: ${name}`);
if (!name) { await browser.close(); process.exit(1); }
await page.evaluate(() => { const g = SEREN.game, r = window.__r; g.city.fixDoor(r); g.player.teleport(r.door.x + r.door.nx * 3, undefined, r.door.z + r.door.nz * 3); g.interiors.enter(r); });
await page.waitForFunction(() => SEREN.game.interiors.inPocket && !SEREN.game.interiors._busy && SEREN.game.interiors.lifts, null, { timeout: 200000, polling: 300 });

await page.evaluate(() => {
  const g = SEREN.game, I = g.interiors;
  const DT = 1 / 30;
  g.mode = 'play';
  g.debugAccess = true; // 직원으로 (출입증)
  // 수레가 벽에 묻힌 깊이 (프레임마다 재서 가장 깊은 것)
  window.__dig = 0;
  const probe = () => {
    const pl = g.player, cp = pl.cartPoint && pl.cartPoint();
    if (!cp) return;
    const v = pl.pos.clone(); v.x = cp[0]; v.z = cp[1];
    const x0 = v.x, z0 = v.z;
    g.world.colliders.pushOut(v, 0.3, 1.0, 0.3);
    window.__dig = Math.max(window.__dig, Math.hypot(v.x - x0, v.z - z0));
  };
  window.__run = async (frames, until) => {
    for (let f = 0; f < frames; f++) {
      g.update(DT); probe();
      if (until && until()) return f;
      if (f % 15 === 14) await new Promise((r) => setTimeout(r, 30));
    }
    return -1;
  };
  I.lifts.ff = 4;
  // 사진 구도: 플레이어 뒤 위에서 수레 쪽
  window.__cam = (on) => {
    if (!on) { g.rig.override = null; return; }
    const p = g.player.pos, yaw = g.player.yaw, V3 = p.constructor;
    g.rig.override = { pos: new V3(p.x - Math.sin(yaw) * 2.4 + Math.cos(yaw) * 1.2, p.y + 2.3, p.z - Math.cos(yaw) * 2.4 - Math.sin(yaw) * 1.2), look: new V3(p.x + Math.sin(yaw) * 1.0, p.y + 0.5, p.z + Math.cos(yaw) * 1.0) };
  };
});

// 1) 화물 승강기 옆의 짐수레
const s1 = await page.evaluate(async () => {
  const g = SEREN.game, I = g.interiors, ind = I.cur.indoor, B = I.cur.B, ops = g.ops;
  if (ind.cur !== B.ground) return { err: `1층이 아님 (${ind.cur})` };
  const out = ind.built.get(ind.cur), Lc = out.lifts.find((q) => q.cargo && q.stops);
  if (!Lc) return { err: '이 층에 화물 승강기 문이 없음' };
  const [fx, fz] = Lc.front;
  I.placeAt(ind.cur, ...ind.world(Lc.x + fx * 1.6, Lc.z + fz * 1.6));
  await window.__run(20);
  const cart = ops.carts.list[0];
  if (!cart) return { err: '수레가 없음' };
  const [cx, cz] = ind.world(cart.gx, cart.gz);
  // 수레 뒤(손잡이 쪽)에 선다
  const bx = cart.gx - Math.sin(cart.yaw) * 0, bz = cart.gz;
  void bx; void bz;
  const hx = cx - Math.sin(cart.yaw) * 1.3, hz = cz - Math.cos(cart.yaw) * 1.3;
  I.placeAt(ind.cur, hx, hz);
  g.player.yaw = cart.yaw;
  await window.__run(6);
  const t = ops.target(g.player.pos);
  return { vis: !!(cart.mesh && cart.mesh.visible), col: !!cart.col, label: t && t.label, short: t && t.short, floor: B.floors[cart.floor].label, cx, cz };
});
if (s1.err) { ok(false, s1.err); await browser.close(); process.exit(1); }
ok(s1.vis && s1.col, `${s1.floor}층 화물 승강기 옆에 짐수레 (보임·충돌체)`);
ok(/밀기/.test(s1.label || ''), `수레 앞 표적: ${s1.label}`);
await page.evaluate(() => window.__cam(true));
await page.evaluate(() => window.__run(4));
await shot('shots/cargo-1-parked.png');

// 2) 밀기 → 과제 · 길 안내 · 승객 승강기와 계단은 막힌다
const s2 = await page.evaluate(async () => {
  const g = SEREN.game, I = g.interiors, ind = I.cur.indoor, ops = g.ops;
  const t = ops.target(g.player.pos);
  if (t) ops.use(t);
  await window.__run(20);
  const cart = ops.carts.list[0], out = ind.built.get(ind.cur);
  const Lp = out.lifts.find((q) => q.stops && !q.cargo);
  const call = Lp ? I.liftCall(Lp) : 'none';
  const st = ops.task && ops.task.steps[0];
  return {
    pushing: !!(ops.carry && ops.carry.kind === 'cart'), slow: g.player.carrySlow, task: ops.task && ops.task.title, step: st && st.label,
    load: (cart.load || []).map((it) => `${it.g}×${it.n}`).join(','), dest: cart.dest, next: g.guide && g.guide.leg && g.guide.leg.next ? g.guide.leg.next.kind : null,
    call: call === null ? 'refused' : call === 'none' ? 'none' : 'opened', pbar: Lp ? !!Lp.col : null, bars: (out.cartBars || []).length, barsUp: (out.cartBars || []).filter((b) => b.col).length,
    vis: !!(cart.mesh && cart.mesh.visible), parkedCol: !!cart.col,
  };
});
ok(s2.pushing && s2.vis && !s2.parkedCol && s2.slow < 0.8, `수레를 민다 (앞에 보이고, 서 있던 충돌체는 걷힘 · 걸음 ${s2.slow})`);
ok(s2.task === '화물 옮기기' && s2.load && s2.dest != null, `과제: ${s2.step} · 짐 ${s2.load}`);
ok(s2.next === 'cargo', `길 안내는 화물 승강기로 (${s2.next})`);
ok(s2.call !== 'opened' && s2.pbar !== false, `승객 승강기: 부르기 거절·문 막이 (${s2.call}, 막이 ${s2.pbar})`);
ok(s2.bars === 0 || s2.barsUp === s2.bars, `계단 문 막이 ${s2.barsUp}/${s2.bars}`);
if (s2.call === 'opened') await page.evaluate(() => SEREN.game.ui.closeCard && SEREN.game.ui.closeCard());

// 3) 화물 승강기를 수레째 타고 창고 층으로
const s3 = await page.evaluate(async () => {
  const g = SEREN.game, I = g.interiors, ind = I.cur.indoor, B = I.cur.B, ops = g.ops;
  const cart = ops.carts.list[0], out = ind.built.get(ind.cur), Lc = out.lifts.find((q) => q.cargo && q.stops && q.link === cart.link);
  const p = I.ride(Lc, cart.dest);
  let done = null, inCarF = 0;
  p.then((v) => { done = v; });
  await window.__run(12000, () => { if (I.lifts.inCar()) inCarF++; return done != null; });
  await window.__run(10);
  return { done, cur: ind.cur, dest: cart.dest, label: B.floors[ind.cur].label, inCarF, pushing: !!(ops.carry && ops.carry.cart === cart), cartObj: !!g.player.cart, vis: !!(cart.mesh && cart.mesh.visible) };
});
ok(s3.done === true && s3.cur === s3.dest, `화물 승강기로 ${s3.label}층 도착 (칸 안 ${s3.inCarF} 프레임)`);
ok(s3.pushing && s3.cartObj && s3.vis, '수레째 왔다 (손에서 놓지 않음)');
await page.evaluate(() => window.__cam(true));
await page.evaluate(() => window.__run(4));
await shot('shots/cargo-2-car.png');

// 4) 창고에 짐 내리기 → 세입자 재고 · 세우기
const s4 = await page.evaluate(async () => {
  const g = SEREN.game, I = g.interiors, ind = I.cur.indoor, ops = g.ops;
  window.__cam(false);
  const cart = ops.carts.list[0];
  const pl = ind.plan(ind.cur), F = pl.fix.find((f) => f.id === cart.fid);
  if (!F) return { err: '창고 가구 없음' };
  const T = ops.byFloor(ind.cur), before = { ...T.node.stock }, load = cart.load.map((it) => ({ ...it }));
  I.placeAt(ind.cur, ...ind.world(F.ax, F.az));
  await window.__run(10);
  const t = ops.target(g.player.pos);
  const lab = t && t.label;
  if (t && t.task) ops.use(t);
  await window.__run(10);
  const grew = load.every((it) => (T.node.stock[it.g] || 0) >= (before[it.g] || 0) + it.n);
  const after = { task: !!ops.task, empty: !cart.load };
  ops.carts.park();
  await window.__run(10);
  return { lab, grew, ...after, parked: !ops.carry && cart.floor === ind.cur && !!cart.col && !!(cart.mesh && cart.mesh.visible), free: !g.player.cart && g.player.carrySlow === 1 };
});
if (s4.err) ok(false, s4.err);
else {
  ok(/내리기/.test(s4.lab || ''), `창고 앞 표적: ${s4.lab}`);
  ok(s4.grew && s4.empty && !s4.task, '짐을 내렸다 · 그 층 세입자 재고가 늘고 과제가 끝났다');
  ok(s4.parked && s4.free, '수레를 세워 두었다 (충돌체 · 몸이 가벼워짐)');
}
const dig = await page.evaluate(() => window.__dig);
ok(dig < 0.12, `수레가 벽·칸 벽에 묻힌 깊이 최대 ${dig.toFixed(3)} m`);

// 5) 건물을 나가면 수레는 치운다
const s5 = await page.evaluate(async () => {
  const g = SEREN.game, I = g.interiors, ops = g.ops;
  const meshes = ops.carts.list.map((c) => c.mesh);
  I.exit();
  await window.__run(30);
  return { gone: meshes.every((m) => !m || !m.parent), n: ops.carts.list.length, cart: !!g.player.cart };
});
ok(s5.gone && s5.n === 0 && !s5.cart, '건물을 나오니 수레를 치웠다');

ok(!errs.length, `페이지 오류 ${errs.length}${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
console.log(fails ? `실패 ${fails}` : '모두 통과');
await browser.close();
process.exit(fails ? 1 : 0);
