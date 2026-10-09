// 건물 속 운영 시험 (헤드리스, 한 번 불러와서 여러 건물): 쓰임마다 건물에 들어가 시설·사람·일자리·살림을 확인한다.
//   node tools/ops-flow.mjs [쓰임들(쉼표)] [shots]
//   · 건물마다: 층·세입자·사람(역할)·시설 수(E 로 쓸 수 있는 것)·시설 앞에서 표적이 잡히는가·몇 초 돌려 오류가 없나
//   · 쓰임마다 짧은 흐름(일자리 맡기 → 출근 → 과제 한 단계 …)과 돈(울) 합 보존(econ.total)
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ALL = ['market', 'cafe', 'factory', 'depot', 'office', 'lab', 'school', 'heal', 'plant', 'terminal', 'museum', 'library', 'hall', 'hotel', 'home', 'farm', 'admin', 'garden'];
const want = (process.argv[2] && process.argv[2] !== 'all' ? process.argv[2].split(',') : ALL);
const shots = process.argv.includes('shots');
mkdirSync(join(root, 'shots'), { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await (await browser.newContext({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 })).newPage();
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${(e.stack || '').split('\n').slice(0, 5).join('\n')}`));
const t0 = Date.now();
await page.goto('file://' + join(root, 'index.html') + '?play=new&nowake=1&q=low&t=0.45');
try { await page.waitForFunction(() => window.SEREN && window.SEREN.ready && window.SEREN.ready(), null, { timeout: 240000, polling: 1000 }); } catch { console.log('ready 시간 초과 (계속)'); }
await page.waitForFunction(() => window.SEREN && SEREN.game && SEREN.game.city && SEREN.game.city.recs && SEREN.game.city.recs.length > 0, null, { timeout: 120000, polling: 1000 });
console.log(`불러오기 ${Math.round((Date.now() - t0) / 1000)} s`);
await page.evaluate(() => { const g = SEREN.game; if (g.settings) g.settings.hints = false; if (g.tips) g.tips.first = () => false; g.ui.moa = () => {}; g.world.clock.time = Math.floor(g.world.clock.time) + 0.45; window.__T0 = g.econ.total(); g.econ.transfer(`z:${g.city.zones[0].id}:hh`, 'player', 60, '시험 용돈'); });
const report = [];
for (const pid of want) {
  const found = await page.evaluate((pid) => {
    const g = SEREN.game, I = g.interiors, C = g.city;
    const P = { x: -2200, z: 5250 };
    const list = C.recs.filter((r) => r.door && I.info(r).pid === pid).sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z));
    const r = list[0];
    if (!r) return null;
    C.fixDoor(r);
    g.player.teleport(r.door.x + r.door.nx * 3, undefined, r.door.z + r.door.nz * 3);
    window.__r = r;
    I.enter(r);
    return { kind: r.kind, h: Math.round(r.top - r.gy), n: list.length };
  }, pid);
  if (!found) { report.push({ pid, err: '건물 없음' }); console.log(JSON.stringify({ pid, err: '건물 없음' })); continue; }
  try { await page.waitForFunction(() => SEREN.game.interiors.inPocket && !SEREN.game.interiors._busy, null, { timeout: 90000, polling: 300 }); } catch { report.push({ pid, err: '들어가기 시간 초과' }); console.log(JSON.stringify({ pid, err: '들어가기 시간 초과', found })); continue; }
  await page.waitForTimeout(1500);
  const info = await page.evaluate((pid) => {
    const g = SEREN.game, I = g.interiors, cur = I.cur, B = cur.B, ind = cur.indoor, o = g.ops;
    const out = ind.built.get(ind.cur);
    const res = { pid, name: I.title(cur.r), floors: B.floors.map((F) => `${F.label}:${F.use}${F.reach ? '' : 'x'}`).join(' '), tenants: o.tenants.map((T) => `${T.op}${T.org ? '·' + T.org.name : ''}[${T.floors.length}]`).join(' | ') };
    // 층마다 시설 (E 로 쓸 수 있는 것) — 지금·위아래 층
    const acts = {}, fails = [];
    let tested = 0, hit = 0;
    for (const [i, ob] of ind.built) {
      if (!ob.T) continue;
      for (const F of ob.fix) {
        let h = null;
        try { h = ob.T.type.act && ob.T.type.act(o, ob.T, F, ob); } catch (e) { fails.push(`${F.tag}:${e.message}`); }
        if (h) acts[F.tag] = (acts[F.tag] || 0) + 1;
      }
    }
    // 지금 층: 쓸 수 있는 시설 몇 개 앞에 서 보기 (표적이 잡히나)
    const cand = out.fix.filter((F) => { try { return out.T.type.act && out.T.type.act(o, out.T, F, out); } catch { return false; } });
    const seen = new Set();
    for (const F of cand) {
      if (seen.has(F.tag) || tested >= 10) continue;
      seen.add(F.tag);
      tested++;
      const [x, z] = ind.world(F.ax, F.az);
      g.player.teleport(x, ind.yOf(ind.cur) + 0.15, z, 0.1);
      const t = o.target(g.player.pos);
      if (t) hit++; else fails.push(`표적 없음:${F.tag}@${F.ax.toFixed(1)},${F.az.toFixed(1)}`);
    }
    // 지도가 보여 줄 지금 상태 (진열 남은 수·기계·밭) — 같은 살림 자료
    const live = [];
    for (const [i, ob] of ind.built) for (const F of ob.fix) { const st = o.fixState(i, F); if (st) live.push(st); }
    res.live = `${live.length}${live[0] ? ` 예: ${live[0].text.slice(0, 48)}` : ''}${live.some((x) => x.warn) ? ` · 경고 ${live.filter((x) => x.warn).length}` : ''}`;
    res.acts = Object.entries(acts).map(([k, v]) => `${k}${v}`).join(' ');
    res.target = `${hit}/${tested}`;
    res.fails = fails.slice(0, 6);
    res.agents = Object.entries(o.agents.list.reduce((m, a) => { m[a.title] = (m[a.title] || 0) + 1; return m; }, {})).map(([k, v]) => `${k}${v}`).join(' ');
    // 일자리: 이 건물의 일자리를 맡아 출근 → 첫 과제
    const ps = o.apps.postingsOf(cur.r, B);
    res.jobs = ps.map((p) => p.title).join('·');
    if (ps.length) {
      const p = ps[0];
      o.S.jobs = [{ ...p, since: g.world.clock.time, worked: 0, rating: 3 }];
      o.S.shift = null;
      const h0 = p.hours[0];
      g.world.clock.time = Math.floor(g.world.clock.time) + Math.min(p.hours[1] - 0.02, Math.max(h0 + 0.02, 0.45));
      // 출근 단말이 있는 층으로
      const T = o.tenants.find((q) => q.k === p.k);
      res.jobTenantFloors = T.floors.join(',');
      try { o.clockIn(o.S.jobs[0]); } catch (e) { res.clockErr = e.message; }
      res.shift = !!o.S.shift;
      res.task = o.task ? `${o.task.title} → ${o.task.steps.map((s) => s.label).join(' / ')}` : '(과제 없음)';
      res.guide = g.guide.goal ? g.guide.text : '';
    }
    return res;
  }, pid);
  // 마트: 진열 구역(건물 모든 층) · 진열대 몇 곳에서 실제로 집어 → 계산대에서 값 치르기 → 가방에 보이나
  if (pid === 'market') {
    info.shop = await page.evaluate(() => {
      const g = SEREN.game, I = g.interiors, ind = I.cur.indoor, o = g.ops, B = I.cur.B;
      const cats = new Set();
      for (const F of B.floors) { if (!F.reach || F.dead) continue; const pl = ind.plan(F.i); if (pl) for (const q of pl.fix) if (q.tag === 'shelf' && q.cat) cats.add(q.cat); }
      const out = ind.built.get(ind.cur);
      const T = out.T;
      const inv0 = { ...g.state.inv }, money0 = g.state.inv.starseed || 0;
      const picked = [];
      const shelves = out.fix.filter((F) => F.tag === 'shelf');
      const seenCat = new Set();
      for (const F of shelves) {
        if (picked.length >= 5) break;
        if (seenCat.has(F.cat)) continue;
        // 진열대 앞면(기기)의 acts 로 물건 하나 집기
        try { const h = T.type.act(o, T, F, out); if (h) h.use(); } catch (e) { picked.push('오류 ' + e.message); }
        const L = g.ui._cardWrap, it = L && L.acts && L.acts.find((x) => !x.off);
        if (it) { it.run(); picked.push(`${F.cat}:${it.label}`); seenCat.add(F.cat); }
        g.ui.closeCard();
      }
      const basket = o.basket.length;
      const co = out.fix.find((F) => F.tag === 'checkout');
      let paid = false;
      if (co) {
        // 계산대 결제판에 패 대기 (기기 acts)
        try { o.checkout(T, true); } catch (e) { paid = 'err ' + e.message; }
        const L = g.ui._cardWrap, pay = L && L.acts && L.acts.find((x) => x.label.includes('결제'));
        if (pay) { pay.run(); paid = o.basket.length === 0; }
      }
      g.ui.closeCard();
      const gained = Object.keys(g.state.inv).filter((k) => k !== 'starseed' && (g.state.inv[k] || 0) > (inv0[k] || 0));
      const div = document.createElement('div');
      g.ui.journal._bag(div);
      const html = div.innerHTML;
      const inBag = gained.filter((k) => { const n = (window.__itemName || ((x) => x))(k); return html.includes(n); });
      return { cats: [...cats].length, catList: [...cats].join(','), picked, basket, paid, spent: Math.round((money0 - (g.state.inv.starseed || 0)) * 100) / 100, gained, bagHas: gained.map((k) => html.includes(`data-use="${k}"`) || html.includes(k)).filter(Boolean).length, bagItems: (html.match(/class="bag-item"/g) || []).length, inBag: inBag.length };
    });
  }
  // 서고(서고 건물·학교의 배움터): 서가의 실제 책 → 펼쳐 끝까지 읽기(말 배움) → 들고 가기(책등이 빈다) → 대출대에서 빌리기 → 가방에서 읽기
  //   → 대출대에서 돌려주기(책등이 돌아온다) · 찾기 단말에서 제목으로 찾아 길 안내 · 모아에게 책 제목으로 묻기
  if (pid === 'library' || pid === 'school') {
    info.books = await page.evaluate(() => {
      const g = SEREN.game, I = g.interiors, cur = I.cur, ind = cur.indoor, o = g.ops, B = cur.B;
      const libs = B.floors.filter((F) => F.use === 'library' && F.reach && !F.dead).map((F) => F.i);
      if (!libs.length) return { err: '서고 층 없음' };
      const i = libs[0];
      const out0 = ind.built.get(i) || null;
      I.placeAt(i, g.player.pos.x, g.player.pos.z);
      const out = ind.built.get(i), T = out.T;
      const res = { floor: B.floors[i].label, shelves: [...out.books.values()].length, archive: [...out.books.values()].filter((e) => e.annal).length, prebuilt: !!out0 };
      const spines = () => { o._drawItems(out); return out.items ? out.items.count : 0; };
      // 손으로 쓴 책(b-)이 꽂힌 서가부터 (목록의 책이라 찾기 단말·모아로도 찾힌다)
      const sh = out.fix.find((F) => F.tag === 'books' && out.books.get(F.id) && out.books.get(F.id).spines.some((r) => r.some((id) => id && id.startsWith('b-')))) || out.fix.find((F) => F.tag === 'books' && out.books.get(F.id));
      if (!sh) return { ...res, err: '책 서가 없음' };
      // 그 서가 앞에 서서 (가까운 서가는 책 한 권씩)
      const [sx, sz] = ind.world(sh.ax, sh.az);
      g.player.teleport(sx, ind.yOf(i) + 0.15, sz, 0.1);
      const n0 = spines();
      const t = o.target(g.player.pos);
      res.target = t && t.label;
      // 서가 카드: 꽂힌 책 목록 (앞에 선 그 서가 — 등을 맞댄 서가가 같이 가까워도)
      let shelf = null;
      const ob = g.ui.bookShelf.bind(g.ui);
      g.ui.bookShelf = (k, title, body, books, onPick) => { shelf = { title, n: books.length, books, onPick }; return null; };
      T.type.act(o, T, sh, out).use();
      g.ui.bookShelf = ob;
      if (!shelf) return { ...res, err: '서가 카드 없음' };
      res.shelf = `${shelf.title} · ${shelf.n}가지 · 예: ${shelf.books.slice(0, 3).map((b) => b.title).join(' / ')}`;
      // 한 권 펼쳐 끝 쪽까지 넘기기 (읽은 쪽 · 다 읽음 · 배운 말)
      const pick = shelf.books.find((b) => b.id.startsWith('b-')) || shelf.books.find((b) => b.pages >= 3 && !/^[gn]-/.test(b.id)) || shelf.books[0];
      const words0 = g.lang.knownCount;
      shelf.onPick(pick.id);
      const card = document.querySelector('.openbook');
      const pageText = card && card.querySelector('.ob-page').textContent;
      res.reader = !!card && pageText && pageText.length > 10;
      for (let k = 0; k < 12; k++) card.querySelector('[data-next]').click();
      res.pageNo = card.querySelector('.ob-no').textContent;
      res.done = !!(g.state.lib.done[pick.id]);
      res.wordsLearned = g.lang.knownCount - words0;
      // 들고 가기 → 그 책등이 빈다
      const takeBtn = [...card.querySelectorAll('[data-a]')].find((b) => b.textContent.includes('들고'));
      takeBtn.click();
      res.carry = o.carry && o.carry.label;
      const n1 = spines();
      res.spinesTaken = n0 - n1;
      // 대출대에서 빌리기
      const desk = out.fix.find((F) => F.tag === 'circulation');
      if (desk) {
        const h = T.type.act(o, T, desk, out);
        res.deskLabel = h && h.label;
        h.use();
        res.borrowed = g.state.lib.borrowed.map((b) => b.title).join(', ');
        res.carryAfter = !!o.carry;
        res.spinesWhileBorrowed = n0 - spines();
        // 가방(일지)에서 빌린 책 읽기
        const div = document.createElement('div');
        g.ui.journal._bag(div);
        res.bagBook = div.innerHTML.includes(pick.title) && !!div.querySelector('[data-read]');
        // 돌려주기 → 책등이 돌아온다
        // 대출대 반납 카드에 서명 (종이 기기 acts — 고르는 칸은 첫 책)
        h.use();
        const L = g.ui._cardWrap, sign = L && L.acts && L.acts.find((x) => x.label === '서명');
        if (sign) sign.run();
        g.ui.closeCard();
        res.returned = g.state.lib.borrowed.length === 0;
        res.spinesAfterReturn = n0 - spines();
      } else res.deskLabel = '(대출대 없음)';
      // 찾기 단말: 제목으로 찾아 그 서가로 길 안내
      const cat = out.fix.find((F) => F.tag === 'catalog');
      if (cat) {
        o.apps.open('catalog', { T, F: cat });
        o.apps._v_catalog({ T, F: cat, q: pick.title.slice(0, 4) });
        const rows = [...o.apps.wrap.querySelectorAll('.os-body [data-a]')];
        res.catalog = `${rows.length}건: ${rows.slice(0, 2).map((b) => b.querySelector('b').textContent).join(' / ')}`;
        if (rows[0]) rows[0].click();
        res.catalogGuide = g.guide.text;
        g.guide.clear();
        o.apps.close && o.apps.close();
      }
      // 모아: 책 제목으로 묻기 (건물 안 찾기)
      try { res.moaBook = g.moaAI.local(`${pick.title} 어디 있어`).slice(0, 100); res.moaShelf = g.moaAI.local('책 찾는 단말 어디야').slice(0, 80); } catch (e) { res.moaBook = '오류 ' + e.message; }
      g.ui.closeCard();
      res.spinesDrawn = out.items ? out.items.count : 0;
      return res;
    });
  }
  // 모아에게 건물 안 길 묻기 + 안내 길
  const moa = await page.evaluate(() => {
    const g = SEREN.game, M = g.moaAI;
    const out = {};
    for (const q of ['가까운 엘리베이터', '출구', '계산대', '화장실']) { try { out[q] = M.local(q).slice(0, 90); } catch (e) { out[q] = '오류 ' + e.message; } }
    out.guide = g.guide.text;
    g.guide.clear();
    return out;
  });
  if (process.argv.includes('map')) {
    await page.evaluate(() => { SEREN.game.ui.closeCard(); SEREN.game.ui.openMenu('map', true); });
    await page.waitForTimeout(1800);
    await page.screenshot({ path: join(root, 'shots', `ops-${pid}-map.png`), timeout: 240000 });
    await page.evaluate(() => SEREN.game.ui.closeMenu());
  }
  info.moa = moa;
  // 몇 초 돌리기
  await page.waitForTimeout(3500);
  const after = await page.evaluate(() => {
    const g = SEREN.game, o = g.ops;
    const res = { guide: g.guide.text, legs: g.guide.leg ? g.guide.leg.pts.length : 0 };
    // 과제 한 단계: 그 자리로 옮겨 E
    if (o.task) {
      const ind = g.interiors.cur.indoor;
      const st = o.task.steps[o.task.k];
      let out = ind.built.get(ind.cur);
      let F = st && out && st.at(out);
      // 과제 자리가 다른 층이면 그 일터의 층들에서 찾아 그 층으로 (안내선도 그 층으로 이끈다)
      if (st && !F) { const T = o.tenants.find((q) => q.k === (o.S.shift || {}).k) || o.tenants[0]; for (const i of T.floors) { g.interiors.placeAt(i, g.player.pos.x, g.player.pos.z); out = ind.built.get(i); F = out && st.at(out); if (F) { res.stepFloor = g.interiors.cur.B.floors[i].label; break; } } }
      if (F) {
        const [x, z] = ind.world(F.ax, F.az);
        g.player.teleport(x, ind.yOf(ind.cur) + 0.15, z, 0.1);
        const t = o.target(g.player.pos);
        res.step = t ? t.label : '과제 표적 없음';
        try { if (t) o.use(t); } catch (e) { res.stepErr = e.message; }
        g.ui.closeCard();
        res.after = o.task ? `${o.task.k}/${o.task.steps.length}` : '과제 끝';
        res.carry = o.carry ? o.carry.kind : null;
      } else res.step = `과제 자리 없음 (${st ? st.label : '-'})`;
    }
    try { o.clockOut(); } catch (e) { res.outErr = e.message; }
    g.ui.closeCard();
    res.total = Math.round((g.econ.total() - window.__T0) * 100) / 100;
    res.agentsNow = o.agents ? o.agents.list.length : 0;
    return res;
  });
  if (shots) {
    await page.evaluate(() => { const g = SEREN.game, ind = g.interiors.cur.indoor, out = ind.built.get(ind.cur); const R = out.L.rooms.find((q) => q.main) || out.L.rooms.find((q) => q.n > 30); if (R) { const [x, z] = ind.world(g.interiors.cur.B.G.ox + R.cx + 0.5, g.interiors.cur.B.G.oz + R.cz + 0.5); g.player.teleport(x, ind.yOf(ind.cur) + 0.2, z, 0.1); } g.ui.closeCard(); });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: join(root, 'shots', `ops-${pid}.png`), timeout: 240000 });
  }
  await page.evaluate(() => { SEREN.game.ui.closeCard(); SEREN.game.interiors.exit(); });
  await page.waitForFunction(() => !SEREN.game.interiors.inPocket && !SEREN.game.interiors._busy, null, { timeout: 60000, polling: 300 }).catch(() => {});
  const row = { ...info, ...after, kind: found.kind, h: found.h };
  report.push(row);
  console.log(JSON.stringify(row, null, 0));
}
// 저장 → 불러오기: 건물 안 자리로 다시
const sv = await page.evaluate(async () => {
  const g = SEREN.game, I = g.interiors;
  const r = window.__r;
  I.enter(r);
  await new Promise((res) => { const t = setInterval(() => { if (I.inPocket && !I._busy) { clearInterval(t); res(); } }, 300); });
  const B = I.cur.B, top = B.floors.filter((F) => F.reach && !F.dead && !F.below).pop();
  I.placeAt(top.i, g.player.pos.x, g.player.pos.z, 0);
  await new Promise((res) => setTimeout(res, 800));
  // 승강기 타기: 이 층의 승강기로 1층까지
  let lift = null;
  const settle = () => new Promise((res) => { let k = 0; const t = setInterval(() => { if ((!I._busy && k > 3) || ++k > 60) { clearInterval(t); res(); } }, 250); });
  { const ind = I.cur.indoor, out = ind.built.get(ind.cur), L = out && out.lifts.find((q) => q.stops); if (L) { const ground = I.cur.B.ground; const from = ind.cur; I.lifts.ff = 20; const ok1 = await I.ride(L, ground); await settle(); lift = { from, to: ind.cur, y: Math.round(g.player.pos.y - 8000), ok1 }; const L2 = ind.built.get(ind.cur).lifts.find((q) => q.stops && q.part === L.part) || ind.built.get(ind.cur).lifts.find((q) => q.stops); lift.ok2 = await I.ride(L2, from); await settle(); I.lifts.ff = 1; lift.back = ind.cur; lift.yBack = Math.round(g.player.pos.y - 8000); } }
  g.save(true);
  const before = { floor: I.cur.indoor.cur, inside: g.state.inside, lift };
  I.exit();
  await new Promise((res) => { const t = setInterval(() => { if (!I.inPocket && !I._busy) { clearInterval(t); res(); } }, 300); });
  g.continueGame();
  await new Promise((res) => setTimeout(res, 1200));
  await new Promise((res) => { let k = 0; const t = setInterval(() => { if ((I.inPocket && !I._busy) || ++k > 120) { clearInterval(t); res(); } }, 300); });
  return { lift: before.lift, before: before.floor, saved: !!before.inside, after: I.inPocket && I.cur && I.cur.indoor ? I.cur.indoor.cur : null };
});
console.log('저장·불러오기', JSON.stringify(sv));
const fin = await page.evaluate(() => ({ total: Math.round((SEREN.game.econ.total() - window.__T0) * 100) / 100, seed: SEREN.game.state.inv.starseed, work: SEREN.game.state.work.done }));
console.log('끝', JSON.stringify(fin), `${Math.round((Date.now() - t0) / 1000)} s`);
for (const l of [...new Set(logs)].slice(0, 30)) console.log(l);
await browser.close();
