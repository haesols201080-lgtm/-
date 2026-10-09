// 옷 검사 (v24 8장 중간 QA): 옷가게 → 옷걸이에서 들기(재고가 실제로 줄어듦) → 탈의 칸에서 입어 보기(아바타 실루엣·헐렁한 아웬 치수·앞에서 보기)
//  → 사기 → 칸 밖으로 나가면 벗음 → 재단사(치수 재기·수선·찾기) → 사지 않은 옷은 나갈 때 옷걸이로 → 우리 집 옷장에서 입기 → 저장 왕복
//   node tools/clothes-check.mjs [shots]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = process.argv.includes('shots');
mkdirSync(join(root, 'shots'), { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await (await browser.newContext({ viewport: { width: 900, height: 560 } })).newPage();
const logs = [];
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
let fails = 0;
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++; };
const ev = (f, a) => page.evaluate(f, a);
const shot = async (name) => { if (SHOTS) await page.screenshot({ path: join(root, 'shots', `${name}.png`), timeout: 120000 }); };
await page.goto('file://' + (process.env.SEREN_HTML || join(root, 'index.html')) + '?play=new&nowake=1&q=low&t=0.5', { timeout: 400000 });
await page.waitForFunction(() => window.SEREN && SEREN.game && SEREN.game.mode === 'play' && SEREN.game.city && SEREN.game.city.recs.length, null, { timeout: 400000, polling: 1000 });
await ev(() => { const g = SEREN.game; if (g.tips) g.tips.first = () => false; g.ui.moa = () => {}; g.state.inv.starseed = 200; });

const tag = (name) => ev((name) => { const t = [...document.querySelectorAll('.rv-tag')].find((x) => x.textContent.includes(name) && !x.classList.contains('gone')); if (!t) return `꼬리표 없음: ${name} — ${[...document.querySelectorAll('.rv-tag')].map((x) => x.textContent).join('|').slice(0, 200)}`; t.click(); return 'ok'; }, name);
const hook = (i) => ev((i) => { const b = document.querySelectorAll('.mv-h')[i]; if (!b) return '고리에 옷 없음'; b.click(); return 'ok'; }, i);
const slip = (pad, pick = null) => ev(async ({ pad, pick }) => {
  const b = [...document.querySelectorAll('.pd-pad')].find((x) => x.textContent.includes(pad));
  if (!b) return { ok: false, say: `종이 없음 ${pad}` };
  b.click(); await new Promise((r) => setTimeout(r, 200));
  if (!document.querySelector('.sheet')) return { ok: false, say: document.querySelector('.pd-say').textContent };
  if (pick) { const o = [...document.querySelectorAll('.sh-opt')].find((x) => x.textContent.includes(pick)); if (o) o.click(); await new Promise((r) => setTimeout(r, 100)); }
  document.querySelector('.sh-signbox').click(); await new Promise((r) => setTimeout(r, 700));
  const st = document.querySelector('.sh-stamp');
  return { ok: !!st && st.classList.contains('ok'), stamp: st && st.textContent, say: document.querySelector('.pd-say').textContent };
}, { pad, pick });
const noCard = () => ev(() => !document.querySelector('.svc-card'));
const press = (txt, nth = 0) => ev(({ txt, nth }) => { const bs = [...document.querySelectorAll('.svc-card .svc-b')].filter((x) => x.textContent.includes(txt)); const b = bs[nth]; if (!b) return `없음: ${txt} — ${[...document.querySelectorAll('.svc-card .svc-b')].map((x) => x.textContent).join(' | ').slice(0, 300)}`; if (b.disabled) return `막힘: ${txt}`; b.click(); return 'ok'; }, { txt, nth });
const outfit = () => ev(() => { const o = SEREN.game.avatar.outfit, P = SEREN.game.avatar.parts; return { n: o.meshes.length, torso: P.torso.visible, armUp: P.armUp[0].visible, sx: o.meshes.length ? +o.meshes[0].m.scale.x.toFixed(2) : 0 }; });
// 가구 앞에 서서 E 표적이 그 가구인지 보고 쓴다 (tag · 고를 조건)
const useFix = (tag, cond = null) => ev(async ({ tag, cond }) => {
  const g = SEREN.game, I = g.interiors, ind = I.cur.indoor;
  const test = cond ? new Function('F', 'g', `return (${cond})`) : () => true;
  const order = ind.B.floors.map((_, i) => i).sort((a, b) => (b === window.__cf) - (a === window.__cf)); // 옷 층부터 (백화점의 다른 층 계산대가 먼저 잡히지 않게)
  for (const i of order) {
    const pl = ind.plan(i), F = pl && (pl.fix || []).find((q) => q.tag === tag && test(q, g));
    if (!F) continue;
    const [x, z] = ind.world(F.ax, F.az), [fx, fz] = ind.world(F.x, F.z);
    I.placeAt(i, x, z, Math.atan2(fx - x, fz - z));
    await new Promise((r) => setTimeout(r, 1800));
    const t = g._findTarget();
    if (!t || t.kind !== 'op' || t.o.F !== F) return { ok: false, got: t ? `${t.kind} ${t.label}` : '없음', floor: i };
    g._interact(t);
    return { ok: true, label: t.label, floor: i, fid: F.id };
  }
  return { ok: false, got: `「${tag}」 없음` };
}, { tag, cond });

// 1) 옷가게 찾기 (가게 건물의 층 짜임에 clothes 층이 있는 가장 가까운 곳)
const store = await ev(() => {
  const g = SEREN.game, I = g.interiors, C = g.city, P = g.player.pos;
  const cands = C.recs.filter((r) => r.door && !r.custom && I.info(r).pid === 'market').sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z)).slice(0, 60);
  for (const r of cands) { const B = I.store.plan(r); const F = B && B.floors.find((q) => q.use === 'clothes'); if (F) { window.__store = r; window.__cf = F.i; return { name: I.title(r), floor: F.i, d: Math.round(Math.hypot(r.x - P.x, r.z - P.z)) }; } }
  return null;
});
ok(!!store, `옷가게: ${store ? `「${store.name}」 ${store.floor}번 층 · ${store.d} m` : '가까운 가게 60곳에 없음'}`);
if (!store) { await browser.close(); process.exit(1); }
await ev(() => { const g = SEREN.game, r = window.__store; g.city.fixDoor(r); g.player.teleport(r.door.x + r.door.nx * 3, undefined, r.door.z + r.door.nz * 3); g.interiors.enter(r); });
await page.waitForFunction(() => SEREN.game.interiors.inPocket && !SEREN.game.interiors._busy, null, { timeout: 180000, polling: 300 });

// 2) 옷걸이: 결 옷 걸이에서 범용 한 벌 · 아웬 치수 한 벌 들기
let u = await useFix('rack', "(() => { const ops = g.ops, out = g.interiors.cur.indoor.built.get(g.interiors.cur.indoor.cur); const T = ops.byFloor(window.__cf); return T.node && T.node.shelf[`${F.id}/0`] && T.node.shelf[`${F.id}/0`].g === 'garment' && T.node.shelf[`${F.id}/0`].n > 2; })()");
if (!u.ok) u = await useFix('rack');
ok(u.ok, `옷걸이 앞 E 표적: ${u.ok ? u.label : u.got}`);
const s0 = await ev(() => { const g = SEREN.game, T = g.ops.byFloor(window.__cf); return Object.entries(T.node.shelf).filter(([k]) => k.startsWith(`${g._findTarget() && g._findTarget().o.F.id}/`)).reduce((a, [, v]) => a + v.n, 0); });
await shot('clothes-rack');
let p1 = await tag('여밈 반소매');
if (p1 !== 'ok') p1 = await tag('일꾼 윗옷');
const p2 = await tag('결 짠 긴소매');
const s1 = await ev(() => { const g = SEREN.game, T = g.ops.byFloor(window.__cf), t = g._findTarget(); return { left: Object.entries(T.node.shelf).filter(([k]) => t && k.startsWith(`${t.o.F.id}/`)).reduce((a, [, v]) => a + v.n, 0), held: g.ops.tryOn.map((o) => `${o.item}:${o.fit}`) }; });
ok(p1 === 'ok' && p2 === 'ok' && s1.held.length === 2 && s1.left === s0 - 2 && await noCard(), `옷걸이 꼬리표에서 두 벌 들기 (공용 카드 없음): ${s1.held.join(', ')} · 걸린 옷 ${s0} → ${s1.left} ${p1 === 'ok' ? '' : p1} ${p2 === 'ok' ? '' : p2}`);
await ev(() => SEREN.game.ui.closeCard());

// 3) 탈의 칸: 입어 보기 → 실루엣이 바뀌고 앞에서 본다 · 아웬 치수는 헐렁 · 사기 · 칸을 나가면 벗음
u = await useFix('fitting');
ok(u.ok, `탈의 칸 앞 E 표적: ${u.ok ? u.label : u.got}`);
const o0 = await outfit();
let p = await hook(0);
await page.waitForTimeout(600);
const o1 = await outfit();
const cam = await ev(() => { const g = SEREN.game, o = g.rig.override, p = g.player.pos; if (!o) return 9; const fx = Math.sin(g.player.yaw), fz = Math.cos(g.player.yaw), vx = o.pos.x - p.x, vz = o.pos.z - p.z, d = Math.hypot(vx, vz) || 1; return +(Math.acos(Math.max(-1, Math.min(1, (vx * fx + vz * fz) / d)))).toFixed(2); }); // 카메라가 내 앞(바라보는 쪽)에 있는가
ok(p === 'ok' && o0.n === 0 && o1.n > 0 && !o1.torso && cam < 0.3, `거울 앞에서 고리의 옷 입기: 옷 조각 ${o0.n} → ${o1.n} · 탐사복 몸통 숨김 ${!o1.torso} · 카메라가 앞으로 (각도 차 ${cam}) · 품 ${o1.sx}`);
await shot('clothes-try-univ');
p = await hook(1); // 같은 부위라 바꿔 입음
await page.waitForTimeout(600);
const o2 = await outfit();
ok(p === 'ok' && o2.sx >= 1.3, `아웬 치수 입어 보기: 품 ${o2.sx} 배 (헐렁하고 길다)`);
await shot('clothes-try-awen');
await ev(() => SEREN.game.ui.closeCard()); // 탈의 칸에서 나오면 벗는다
await page.waitForTimeout(800);
const o3 = await outfit();
ok(o3.n === 0 && o3.torso, `탈의 칸에서 나오면 벗음: 옷 조각 ${o3.n} · 탐사복 ${o3.torso}`);
// 계산대: 손님 쪽 화면 · 결제판
u = await useFix('checkout');
ok(u.ok, `계산대 앞 E 표적: ${u.ok ? u.label : u.got}`);
const cash0 = await ev(() => SEREN.game.state.inv.starseed);
await page.waitForTimeout(700);
await shot('clothes-pos');
p = await ev(() => { const b = document.querySelector('.pos-pad'); if (!b) return '결제판 없음'; b.click(); return 'ok'; });
await page.waitForTimeout(400);
const b1 = await ev(() => { const g = SEREN.game; return { own: g.state.wardrobe.own.map((o) => `${o.item}:${o.fit}`), cash: g.state.inv.starseed, held: g.ops.tryOn.length }; });
ok(p === 'ok' && b1.own.length === 2 && b1.held === 0 && b1.cash < cash0, `결제판에 패를 대 두 벌 사기: 가진 옷 ${b1.own.join(', ')} · 돈 ${cash0} → ${b1.cash}`);
await page.waitForTimeout(1300);

// 4) 재단사: 치수 재기 → 아웬 치수 옷 수선 → 시간이 지나 찾기
u = await useFix('tailor');
ok(u.ok, `재단사 앞 E 표적: ${u.ok ? u.label : u.got}`);
let sl = await slip('치수 기록지');
const sa = await slip('수선 주문서');
const t1 = await ev(() => { const W = SEREN.game.state.wardrobe; return { measured: W.measured, orders: W.orders.length, away: W.own.filter((o) => o.atTailor).length }; });
ok(sl.ok && sa.ok && t1.measured && t1.orders === 1 && t1.away === 1, `재단대 종이: 치수 기록지 도장 「${sl.stamp}」 · 수선 주문서 도장 「${sa.stamp}」 · 맡긴 옷 ${t1.away} · 「${sa.say}」`);
await shot('clothes-tailor');
await ev(() => { SEREN.game.world.clock.time += 0.12; SEREN.game.ui.closeCard(); });
u = await useFix('tailor');
sl = await slip('찾는 표');
const t2 = await ev(() => { const W = SEREN.game.state.wardrobe; return { fits: W.own.map((o) => o.fit), orders: W.orders.length }; });
ok(sl.ok && t2.orders === 0 && !t2.fits.includes('awen'), `찾는 표: 옷 치수 ${t2.fits.join(', ')} · 「${sl.say}」`);
await ev(() => SEREN.game.ui.closeCard());

// 5) 사지 않고 든 옷은 나갈 때 옷걸이로
const r5 = await ev(async () => {
  const g = SEREN.game, T = g.ops.byFloor(window.__cf);
  const key = Object.keys(T.node.shelf).find((k) => T.node.shelf[k].n > 0 && T.node.shelf[k].g === 'garment');
  const n0 = T.node.shelf[key].n;
  T.node.shelf[key].n--; g.ops.tryOn.push({ item: 'top-tunic', color: 0xe8e2d4, fit: 'univ', price: 7, key, uid: g.ops.cur.uid });
  g.interiors.exit();
  await new Promise((r) => { const w = () => (!g.interiors.inPocket && !g.interiors._busy ? r() : setTimeout(w, 200)); w(); });
  return { back: T.node.shelf[key].n === n0, held: g.ops.tryOn.length };
});
ok(r5.back && r5.held === 0, `사지 않은 옷: 나갈 때 옷걸이로 돌아감 ${r5.back}`);

// 6) 우리 집 옷장에서 입기 (이슬터 꽃잎 집을 우리 집으로)
const home = await ev(() => {
  const g = SEREN.game, C = g.city, I = g.interiors;
  const r = C.recs.find((q) => q.custom && q.zone === 'dewfold' && I.info(q).pid === 'home');
  if (!r) return null;
  g.state.home = r.id; window.__home = r;
  g.player.teleport(r.door.x + r.door.nx * 3, undefined, r.door.z + r.door.nz * 3); I.enter(r);
  return I.title(r);
});
ok(!!home, `우리 집: ${home}`);
await page.waitForFunction(() => SEREN.game.interiors.inPocket && !SEREN.game.interiors._busy, null, { timeout: 180000, polling: 300 });
u = await useFix('', "F.t === 'wardrobe'");
if (!u.ok) u = await ev(async () => { const g = SEREN.game, I = g.interiors, ind = I.cur.indoor; for (let i = 0; i < ind.B.floors.length; i++) { const pl = ind.plan(i), F = pl && pl.fix.find((q) => q.t === 'wardrobe'); if (!F) continue; const [x, z] = ind.world(F.ax, F.az), [fx, fz] = ind.world(F.x, F.z); I.placeAt(i, x, z, Math.atan2(fx - x, fz - z)); await new Promise((r) => setTimeout(r, 1800)); const t = g._findTarget(); if (t && t.kind === 'op' && t.o.F === F) { g._interact(t); return { ok: true, label: t.label }; } return { ok: false, got: t ? `${t.kind} ${t.label}` : '없음' }; } return { ok: false, got: '옷장 없음' }; });
ok(u.ok, `옷장 앞 E 표적: ${u.ok ? u.label : u.got}`);
p = await ev(() => { const b = [...document.querySelectorAll('.wv-slot')].find((x) => x.textContent.includes('윗옷')); if (!b) return '옷장 문 없음'; b.click(); return 'ok'; });
const pw = await ev(() => { const b = [...document.querySelectorAll('.wv-hang')].find((x) => x.textContent.includes('결 짠 긴소매')); if (!b) return '옷걸이 없음'; b.click(); return 'ok'; });
await page.waitForTimeout(500);
const w1 = await ev(() => { const g = SEREN.game, W = g.state.wardrobe; return { worn: Object.keys(W.worn), n: g.avatar.outfit.meshes.length, sx: g.avatar.outfit.meshes[0] && +g.avatar.outfit.meshes[0].m.scale.x.toFixed(2) }; });
ok(p === 'ok' && pw === 'ok' && w1.worn.includes('top') && w1.n > 0 && w1.sx < 1.2 && await noCard(), `옷장 문(왼문 부위 → 오른문 옷걸이)에서 입기: 부위 ${w1.worn.join(',')} · 조각 ${w1.n} · 품 ${w1.sx} (수선해서 맞음)`);
await page.waitForFunction(() => !document.querySelector('.fade-msg.show') && !document.querySelector('.fade.on'), null, { timeout: 60000 }).catch(() => {}); // 들어가는 화면이 걷힌 뒤
await shot('clothes-wardrobe');

// 7) 저장 → 불러오기: 입은 옷 그대로 · 아바타도 입고 있음
const r7 = await ev(async () => {
  const g = SEREN.game, id = g.slot, W0 = JSON.stringify(g.state.wardrobe);
  g.save(true); g.continueGame(id);
  await new Promise((r) => setTimeout(r, 3000));
  return { same: JSON.stringify(g.state.wardrobe) === W0, n: g.avatar.outfit.meshes.length };
});
ok(r7.same && r7.n > 0, `저장 → 불러오기: 옷장 그대로 ${r7.same} · 아바타 옷 조각 ${r7.n}`);

console.log(logs.length ? `기록:\n${[...new Set(logs)].slice(0, 8).join('\n')}` : '페이지 오류 없음');
console.log(fails ? `실패 ${fails}` : '모두 통과');
await browser.close();
process.exit(fails ? 1 : 0);
