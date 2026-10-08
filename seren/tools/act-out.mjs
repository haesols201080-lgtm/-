// 바깥 상호작용 시험 (헤드리스): 건물 밖에서 E 로 쓰는 것을 종류마다 몇 개씩 실제로 찾아가 누른다.
//   도시 바깥 조작대(쓰임별) · 시설 지기 · 이름 있는 사람 · 거리 주민 · 동물 · 빛길 역 · 글자돌·메아리·조망점·공명탑 · 착륙선 · 승강판
//   · 그 자리에 서면 표적이 잡히는가 (다른 표적에 가려 못 쓰는 것도 센다)
//   · 눌렀을 때 오류가 나는가 · 아무 반응이 없는가 (카드·알림·대화·모아 자막·모드·탈것·층 이동이 하나도 없으면 「무반응」)
//   node tools/act-out.mjs [종류마다 개수=3]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PER = +(process.argv[2] || 3) || 3;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await (await browser.newContext({ viewport: { width: 800, height: 450 } })).newPage();
const logs = [];
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error' && !/ERR_CERT|Failed to load resource/.test(m.text())) logs.push(`[console] ${m.text().slice(0, 200)}`); });
await page.goto('file://' + (process.env.SEREN_HTML || join(root, 'index.html')) + '?play=new&nowake=1&q=low&t=0.45');
await page.waitForFunction(() => window.SEREN && SEREN.game && SEREN.game.city && SEREN.game.city.recs && SEREN.game.city.recs.length > 0 && SEREN.game.mode === 'play', null, { timeout: 300000, polling: 1000 });
// 후보 모으기 (자리 + 기대하는 표적 종류)
const cands = await page.evaluate((PER) => {
  const g = SEREN.game, C = g.city;
  if (g.tips) g.tips.first = () => false;
  g.econ.transfer(`z:${C.zones[0].id}:hh`, 'player', 200, '시험 용돈');
  window.__hit = 0;
  const wrap = (o, k) => { const f = o && o[k]; if (typeof f !== 'function') return; o[k] = function (...a) { window.__hit++; return f.apply(this, a); }; };
  for (const k of ['toast', 'moa', 'say', 'regionTitle', 'flash', 'puzzle', '_card', 'glyphCard', 'memory', 'infoCard', 'serviceCard', 'bookShelf', 'reader', 'openMenu', 'compose', 'confirm', 'caption']) wrap(g.ui, k);
  wrap(g.dialogue, 'start'); wrap(g.dialogue, 'startCustom');
  for (const k of ['enter', 'enterCabin', '_load']) wrap(g.interiors, k);
  wrap(g, 'rideElevator'); wrap(g, 'scan'); wrap(g, 'stationCard');
  if (g.moaAI) wrap(g.moaAI, 'open');
  const out = [], P = { x: -2200, z: 5250 };
  const take = (kind, list, f) => { list.sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z)); for (const o of list.slice(0, PER)) out.push({ kind, ...f(o) }); };
  // 바깥 조작대: 블록을 깨워 쓰임(fn·use)마다
  const byFn = new Map();
  for (const r of C.recs) {
    if (!r.out) continue;
    const c = C.consolePos(r);
    if (!c) continue;
    const k = `${c.def.fn}${c.def.fn === 'tower' ? ':' + r.use : ''}`;
    if (!byFn.has(k)) byFn.set(k, []);
    byFn.get(k).push({ x: c.x, y: c.y, z: c.z, rec: C.recs.indexOf(r) });
  }
  for (const [k, L] of byFn) take(`조작대 ${k}`, L, (c) => ({ ...c, want: 'outdoor' }));
  // 시설 지기
  const byFac = new Map();
  for (const F of g.facilities.list) { if (!F.npc) continue; if (!byFac.has(F.type)) byFac.set(F.type, []); byFac.get(F.type).push({ x: F.npc.pos.x, y: F.npc.pos.y, z: F.npc.pos.z, id: F.id }); }
  for (const [k, L] of byFac) take(`시설 ${k}`, L, (o) => ({ x: o.x, y: o.y, z: o.z, want: 'facility|lobby' }));
  // 이름 있는 사람 (모두)
  for (const n of g.npcs.list) if (!n.ambient && !n.service) out.push({ kind: `사람 ${n.name}`, x: n.pos.x, y: n.pos.y, z: n.pos.z, want: 'npc', npc: n.id });
  // 빛길 역
  take('빛길 역', g.transit.stations.map((S) => ({ x: S.x, y: S.platY, z: S.z })), (o) => ({ ...o, want: 'station' }));
  // 발견물
  const D = g.discovery;
  take('글자돌', D.glyphs.map((s) => ({ x: s.x, y: s.y, z: s.z })), (o) => ({ ...o, want: 'glyph' }));
  take('메아리', D.echoes.filter((e) => !e.eclipseOnly).map((e) => ({ x: e.x, y: e.y, z: e.z })), (o) => ({ ...o, want: 'echo' }));
  take('조망점', [...g.structures.vistas.values()].map((v) => ({ x: v.x, y: v.y, z: v.z })), (o) => ({ ...o, want: 'vista' }));
  take('공명탑', [...g.structures.pylons.values()].filter((p) => !p.alive).map((p) => ({ x: p.x, y: p.y + 5, z: p.z })), (o) => ({ ...o, want: 'pylon' }));
  // 착륙선 문
  const L = g.structures.lander;
  if (L && L.hatch) out.push({ kind: '착륙선 문', x: L.hatch.at[0], y: L.hatch.y, z: L.hatch.at[1], want: 'lander' });
  // 하늘정원 승강판 (거대 구조물)
  if (!g.outdoors.mega) g.outdoors._megaInit();
  take('승강판', (g.outdoors.mega || []).map((m) => ({ x: m.x, y: m.y, z: m.z })), (o) => ({ ...o, want: 'outdoor' }));
  // 동물: 종마다
  const bySp = new Map();
  for (const a of g.fauna.agents || []) { if (a.sp === 'bird') continue; if (!bySp.has(a.sp)) bySp.set(a.sp, []); bySp.get(a.sp).push(a); }
  for (const [k, Ls] of bySp) take(`동물 ${k}`, Ls.map((a) => ({ x: a.x, y: a.y, z: a.z, idx: g.fauna.agents.indexOf(a), sp: a.sp })), (o) => ({ ...o, want: 'fauna' }));
  return out;
}, PER);
console.log(`후보 ${cands.length}`);
let errN = 0, silentN = 0, missN = 0, okN = 0;
const rows = [];
for (const cnd of cands) {
  const r = await page.evaluate(async (cnd) => {
    const g = SEREN.game, I = g.interiors;
    const reset = () => {
      try { g.ui.closeCard(); } catch {}
      try { if (g.dialogue.active) g.dialogue.end(); } catch {}
      g.mode = 'play'; g.rig.override = null; g.director.seq = null;
    };
    reset();
    // 조작대: 그 블록을 깨워 (소품에 밀린) 실제 자리를 쓴다
    if (cnd.rec != null) {
      const r = g.city.recs[cnd.rec];
      for (const B of g.city.blocksNear(cnd.x, cnd.z, 30)) g.city._activate(B);
      const c = (r.B.ext || []).find((q) => q.rec === r);
      if (c) { cnd.x = c.x; cnd.y = c.y; cnd.z = c.z; }
    }
    // 그 자리 옆에 선다 — 둘레 여덟 방향 중 설 수 있는 첫 자리 (사람·동물은 조금 떨어져)
    const far = /^(사람|시설|동물)/.test(cnd.kind) ? 1.6 : 1.0;
    let ok = false;
    for (let k = 0; k < 9 && !ok; k++) {
      const a = (k / 8) * Math.PI * 2, rr = k === 8 ? 0 : far;
      const x = cnd.x + Math.cos(a) * rr, z = cnd.z + Math.sin(a) * rr;
      g.player.teleport(x, cnd.y + 0.2, z, 2.5);
      for (let s = 0; s < 3; s++) g.updateSim(1 / 30);
      if (cnd.idx != null) { const A = g.fauna.agents.find((q) => q.sp === cnd.sp) || g.fauna.agents[cnd.idx]; if (A) { A.x = g.player.pos.x + 1.2; A.z = g.player.pos.z; A.y = g.player.pos.y; A.state = 'idle'; } }
      g.fauna.update && g.fauna.update(1 / 30);
      const t = g._findTarget();
      if (t && cnd.want.split('|').includes(t.kind) && (cnd.npc == null || t.o.id === cnd.npc)) ok = t;
    }
    const t0 = ok || g._findTarget();
    const res = { kind: cnd.kind, got: t0 ? t0.kind : null, label: t0 ? String(t0.label || '').slice(0, 50) : '', err: null, silent: false, miss: !ok };
    if (!ok) { res.near = `${g.player.pos.x.toFixed(1)},${(g.player.pos.y - cnd.y).toFixed(2)},${g.player.pos.z.toFixed(1)}`; return res; }
    const before = { hit: window.__hit, mode: g.mode, state: g.player.state, pocket: I.inPocket, busy: I._busy, ovr: g.rig.override, seq: g.director.seq };
    try { g._interact(ok); } catch (e) { res.err = `${e.message} @ ${(e.stack || '').split('\n')[1] || ''}`; }
    await new Promise((f) => setTimeout(f, 50));
    res.silent = !res.err && window.__hit === before.hit && g.mode === before.mode && g.player.state === before.state && I.inPocket === before.pocket && I._busy === before.busy && g.rig.override === before.ovr && g.director.seq === before.seq;
    // 되돌리기: 건물·선실에 들어갔으면 나온다
    reset();
    if (g.player.ride) { try { g.player.ride = null; g.player.setState('ground'); } catch {} }
    return res;
  }, cnd);
  // 들어간 경우 나오기
  await page.evaluate(() => { const I = SEREN.game.interiors; if (I.inPocket || I._busy) setTimeout(() => I.exit(), 0); });
  await page.waitForFunction(() => !SEREN.game.interiors._busy && !SEREN.game.interiors.inPocket, null, { timeout: 60000, polling: 300 }).catch(() => {});
  rows.push(r);
  if (r.err) errN++; else if (r.miss) missN++; else if (r.silent) silentN++; else okN++;
  if (r.err || r.miss || r.silent) console.log(JSON.stringify(r));
}
const byKind = {};
for (const r of rows) { const k = r.kind.replace(/^사람 .*/, '사람'); byKind[k] = byKind[k] || { n: 0, ok: 0 }; byKind[k].n++; if (!r.err && !r.miss && !r.silent) byKind[k].ok++; }
console.log(Object.entries(byKind).map(([k, v]) => `${k} ${v.ok}/${v.n}`).join(' · '));
console.log(logs.length ? `기록:\n${[...new Set(logs)].slice(0, 10).join('\n')}` : '페이지 오류 없음');
console.log(`시험 ${rows.length} · 됨 ${okN} · 표적 못 잡음 ${missN} · 오류 ${errN} · 무반응 ${silentN}`);
await browser.close();
process.exit(errN || silentN || missN ? 1 : 0);
