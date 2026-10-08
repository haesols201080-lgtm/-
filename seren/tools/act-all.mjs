// 모든 상호작용 시험 (헤드리스): 쓰임마다 건물에 들어가 모든 층의 모든 가구·장치에서 E(상호작용)를 실제로 실행한다.
//   · 오류가 나는가 (handler.use / label 함수)
//   · 아무 반응이 없는가 — 카드·알림·책·모아 자막·짐·바구니·층 이동·과제 시작·모드 변화가 하나도 없으면 「무반응」
//   · 승강기 판(층 고르기)·계단·옥상·테라스·공중다리 문의 표적도 잡히는가
//   node tools/act-all.mjs [쓰임들|all] [건물 수=1]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ALL = ['market', 'cafe', 'factory', 'depot', 'office', 'lab', 'school', 'heal', 'plant', 'terminal', 'museum', 'library', 'hall', 'hotel', 'home', 'farm', 'admin', 'garden'];
const want = process.argv[2] && process.argv[2] !== 'all' ? process.argv[2].split(',') : ALL;
const NB = +(process.argv[3] || 1) || 1;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await (await browser.newContext({ viewport: { width: 800, height: 450 } })).newPage();
const logs = [];
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto('file://' + join(root, 'index.html') + '?play=new&nowake=1&q=low&t=0.45');
await page.waitForFunction(() => window.SEREN && SEREN.game && SEREN.game.city && SEREN.game.city.recs && SEREN.game.city.recs.length > 0, null, { timeout: 300000, polling: 1000 });
await page.evaluate(() => {
  const g = SEREN.game;
  if (g.tips) g.tips.first = () => false;
  g.econ.transfer(`z:${g.city.zones[0].id}:hh`, 'player', 200, '시험 용돈');
  // 반응 세기: 화면에 무언가를 띄우는 길을 모두 감싼다
  window.__hit = 0;
  const wrap = (o, k) => { const f = o[k]; if (typeof f !== 'function') return; o[k] = function (...a) { window.__hit++; return f.apply(this, a); }; };
  for (const k of ['toast', 'moa', '_card', 'serviceCard', 'infoCard', 'bookShelf', 'reader', 'regionTitle']) wrap(g.ui, k);
  for (const k of ['_load', 'liftPanel', 'ride', 'outTo', 'exit']) wrap(g.interiors, k);
  if (g.avatar) { wrap(g.avatar, 'act'); wrap(g.avatar, 'setHeld'); }
});
let errN = 0, silentN = 0, testedN = 0;
for (const pid of want) {
  const n = await page.evaluate(({ pid, NB }) => {
    const g = SEREN.game, I = g.interiors, C = g.city, P = { x: -2200, z: 5250 };
    const L = C.recs.filter((r) => r.door && I.info(r).pid === pid).sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z));
    window.__list = L.slice(0, NB);
    return window.__list.length;
  }, { pid, NB });
  for (let b = 0; b < n; b++) {
    await page.evaluate((b) => { const g = SEREN.game, I = g.interiors, r = window.__list[b]; g.city.fixDoor(r); g.player.teleport(r.door.x + r.door.nx * 3, undefined, r.door.z + r.door.nz * 3); I.enter(r); }, b);
    try { await page.waitForFunction(() => SEREN.game.interiors.inPocket && !SEREN.game.interiors._busy, null, { timeout: 120000, polling: 300 }); } catch { console.log(JSON.stringify({ pid, err: '들어가기 시간 초과' })); errN++; continue; }
    const floors = await page.evaluate(() => SEREN.game.interiors.cur.B.floors.filter((F) => F.reach && !F.dead).map((F) => F.i));
    const res = { pid, name: await page.evaluate(() => SEREN.game.interiors.title(SEREN.game.interiors.cur.r)), floors: floors.length, tested: 0, kinds: 0, errors: [], silent: [], lifts: 0 };
    const seen = new Set();
    for (const i of floors) {
      const r = await page.evaluate(({ i, seen }) => {
        const g = SEREN.game, I = g.interiors, ind = I.cur.indoor, o = g.ops, B = I.cur.B;
        if (ind.cur !== i) { ind.setFloor(i); if (o) o.floorChanged(i); }
        const out = ind.built.get(i);
        const rr = { tested: 0, errors: [], silent: [], keys: [], lifts: 0 };
        if (!out || !out.T) return rr;
        const fl = B.floors[i];
        for (const F of out.fix) {
          const key = `${fl.use}|${F.t}|${F.tag || ''}`;
          if (seen.includes(key)) continue;
          let h = null;
          try { h = out.T.type.act && out.T.type.act(o, out.T, F, out); } catch (e) { rr.errors.push(`${fl.label}층 ${F.t}/${F.tag} act: ${e.message}`); rr.keys.push(key); continue; }
          if (!h) continue;
          rr.keys.push(key);
          rr.tested++;
          // 그 가구 앞에 선다 (자리에 따라 다른 반응을 보는 것도 있다)
          const [x, z] = ind.world(F.ax, F.az); g.player.teleport(x, ind.yOf(i) + 0.3, z, 0.1);
          let lab = '';
          try { lab = typeof h.label === 'function' ? h.label() : h.label; } catch (e) { rr.errors.push(`${fl.label}층 ${F.t}/${F.tag} label: ${e.message}`); }
          const before = { hit: window.__hit, mode: g.mode, carry: o.carry, basket: o.basket.length, task: o.task, cur: ind.cur, inPocket: I.inPocket };
          try { h.use(); } catch (e) { rr.errors.push(`${fl.label}층 ${F.t}/${F.tag} 「${lab}」 use: ${e.message} @ ${(e.stack || '').split('\n')[1] || ''}`); }
          const moved = window.__hit !== before.hit || g.mode !== before.mode || o.carry !== before.carry || o.basket.length !== before.basket || o.task !== before.task || ind.cur !== before.cur || I.inPocket !== before.inPocket;
          if (!moved) rr.silent.push(`${fl.label}층 ${F.t}/${F.tag} 「${lab}」`);
          // 되돌리기: 카드 닫기 · 짐 내려놓기 · 과제 그만
          try { g.ui.closeCard(); } catch {}
          if (g.mode !== 'play' && g.mode !== 'title') g.mode = 'play';
          if (o.carry) { o.carry = null; if (g.avatar && g.avatar.setHeld) g.avatar.setHeld(null); }
          if (o.task) o.task = null;
          if (!I.inPocket || I._busy) break;
          if (ind.cur !== i) { ind.setFloor(i); }
        }
        // 승강기: 이 층의 승강기 판이 층 목록을 띄우는가
        for (const L of out.lifts || []) {
          if (!L.stops) continue;
          const before = window.__hit;
          try { I.liftPanel(L); } catch (e) { rr.errors.push(`${fl.label}층 승강기 판: ${e.message}`); }
          if (window.__hit === before) rr.silent.push(`${fl.label}층 승강기 판`);
          try { g.ui.closeCard(); } catch {}
          g.mode = 'play';
          rr.lifts++;
          break;
        }
        return rr;
      }, { i, seen: [...seen] });
      for (const k of r.keys) seen.add(k);
      res.tested += r.tested; res.errors.push(...r.errors); res.silent.push(...r.silent); res.lifts += r.lifts;
      const still = await page.evaluate(() => SEREN.game.interiors.inPocket && !SEREN.game.interiors._busy);
      if (!still) { await page.waitForFunction(() => !SEREN.game.interiors._busy, null, { timeout: 60000, polling: 300 }).catch(() => {}); const back = await page.evaluate(() => SEREN.game.interiors.inPocket); if (!back) { res.errors.push('상호작용 뒤 건물 밖으로 나감 (시험 중단)'); break; } }
    }
    res.kinds = seen.size;
    testedN += res.tested; errN += res.errors.length; silentN += res.silent.length;
    console.log(JSON.stringify(res));
    await page.evaluate(() => SEREN.game.interiors.exit());
    try { await page.waitForFunction(() => !SEREN.game.interiors.inPocket && !SEREN.game.interiors._busy, null, { timeout: 60000, polling: 300 }); } catch {}
  }
}
console.log(logs.length ? `기록:\n${[...new Set(logs)].slice(0, 10).join('\n')}` : '페이지 오류 없음');
console.log(`시험한 상호작용 ${testedN} · 오류 ${errN} · 무반응 ${silentN}`);
await browser.close();
process.exit(errN || silentN ? 1 : 0);
