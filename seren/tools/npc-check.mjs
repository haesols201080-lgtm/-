// 주민 검사 (v24 「주민 안정성 · 행동 다양성 · 기억 대화」 중간 QA):
//  1) 하루 블록: 도시 구역·이슬터에서 보이는 주민의 하루를 훑어 — 혼자 일하는 어른 가운데 쉬는 시간·볼일이 있는 비율, 하루 동안의 상태 가짓수
//  2) 걷기 시뮬레이션 (citizens.update 를 직접 0.1 초씩): 갈 곳이 있는데 30 초 넘게 0.5 m 도 못 움직인 사람 = 0 · 막힘 풀기 횟수
//  3) 이웃끼리 인사 · 이웃 무리의 대화 (지나가며 듣는 말)
//  4) 기억 대화: 처음 → 같은 날 또 → 함께 놀이 뒤 후일담 → 며칠 뒤 「오랜만」 · 같은 말을 되풀이하지 않음
//  5) 저장 → 다시 불러오기 뒤 기억(만난 횟수·함께 한 일)이 그대로
//   node tools/npc-check.mjs
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await (await browser.newContext({ viewport: { width: 800, height: 450 } })).newPage();
const logs = [];
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
let fails = 0;
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++; };
const ev = (f, a) => page.evaluate(f, a);
await page.goto('file://' + (process.env.SEREN_HTML || join(root, 'index.html')) + '?play=new&nowake=1&q=low&t=0.45', { timeout: 400000 });
await page.waitForFunction(() => window.SEREN && SEREN.game && SEREN.game.mode === 'play' && SEREN.game.city && SEREN.game.city.recs.length, null, { timeout: 400000, polling: 1000 });
await ev(() => { const g = SEREN.game; if (g.tips) g.tips.first = () => false; g.ui.moa = () => {}; });

const SITES = [
  ['도시 구역', () => { const g = SEREN.game, C = g.city; let best = null; for (const Z of C.zones.slice(0, 12)) { const n = C.spotsNear(Z.cx + 60, Z.cz + 60, 120).length; if (!best || n > best.n) best = { n, x: Z.cx + 60, z: Z.cz + 60 }; } return [best.x, best.z]; }],
  ['이슬터', () => [-420, 7840]],
];

for (const [label, where] of SITES) {
  const at = await ev(where);
  await ev(([x, z]) => { const g = SEREN.game; g.player.teleport(x, undefined, z); g.world.clock.time = Math.floor(g.world.clock.time) + 0.45; g.citizens.near = null; }, at);
  await page.waitForFunction(() => SEREN.game.citizens.vis.length > 4, null, { timeout: 120000, polling: 500 }).catch(() => {});
  // 1) 하루 블록
  const r1 = await ev(() => {
    const g = SEREN.game, Ci = g.citizens, T = g.time;
    const P = Ci.near.slice(0, 60);
    let solo = 0, brk = 0, errand = 0, kinds = new Set(), multi = 0;
    for (const p of P) {
      const seen = new Set();
      for (let t = 0; t < 1; t += 0.002) {
        const st = Ci._state(p, t, T);
        const k = !st ? 'home' : st.walk ? 'walk' : st.act ? st.act : 'work';
        seen.add(k); kinds.add(k);
      }
      if (p._plan) { solo++; if (seen.has('break')) brk++; if (seen.has('errand')) errand++; }
      if (seen.size >= 3) multi++;
    }
    return { n: P.length, solo, brk, errand, kinds: [...kinds], multi };
  });
  ok(r1.n > 0 && r1.multi / r1.n > 0.6, `${label}: 주민 ${r1.n} · 하루에 세 가지 넘는 상태 ${r1.multi} · 상태 ${r1.kinds.join('/')}`);
  ok(r1.solo === 0 || (r1.brk + r1.errand) / r1.solo > 0.4, `${label}: 혼자 일하는 어른 ${r1.solo} 가운데 쉬는 시간 ${r1.brk} · 볼일 ${r1.errand}`);

  // 2) 걷기 시뮬레이션: 하루 중 0.30 → 0.40 (120 초 × … 를 0.1 초씩) — 출근·쉬는 시간이 섞인 때
  const r2 = await ev(() => {
    const g = SEREN.game, Ci = g.citizens, C = g.world.clock;
    const s0 = { ...Ci.stats };
    C.time = Math.floor(C.time) + 0.30;
    const track = new Map();
    let frozen = 0, worst = 0, maxVis = 0, moved = 0;
    const DT = 0.1, N = 1800; // 180 초 (하루의 0.15)
    for (let k = 0; k < N; k++) {
      g.time += DT; C.time += DT / 1200;
      Ci.update(DT);
      maxVis = Math.max(maxVis, Ci.vis.length);
      if (k % 10) continue;
      const t = C.time - Math.floor(C.time);
      for (const p of Ci.vis) {
        if (p.flee || p.engaged) continue;
        const st = Ci._state(p, t, g.time);
        let tx, tz;
        if (!st) continue;
        if (st.walk) { tx = st.from.x + (st.to.x - st.from.x) * st.f; tz = st.from.z + (st.to.z - st.from.z) * st.f; }
        else if (st.x != null) { tx = st.x; tz = st.z; } else [tx, tz] = Ci._slot(p, g.time);
        const far = Math.hypot(tx - p.pos.x, tz - p.pos.z) > 2;
        let r = track.get(p.key);
        if (!r) { r = { x: p.pos.x, z: p.pos.z, since: g.time, x0: p.pos.x, z0: p.pos.z }; track.set(p.key, r); }
        if (!far || Math.hypot(p.pos.x - r.x, p.pos.z - r.z) > 0.5) { r.x = p.pos.x; r.z = p.pos.z; r.since = g.time; }
        else if (!(p._hold && g.time < p._hold)) { const d = g.time - r.since; if (d > worst) worst = d; if (d > 30 && !r.bad) { r.bad = true; frozen++; } }
      }
    }
    for (const [, r] of track) if (Math.hypot(r.x - r.x0, r.z - r.z0) > 2) moved++;
    const s = {}; for (const k in Ci.stats) s[k] = Ci.stats[k] - s0[k];
    return { people: track.size, frozen, worst: Math.round(worst), moved, maxVis, s };
  });
  ok(r2.people > 0 && r2.frozen === 0, `${label}: 3분 시뮬레이션 — 본 사람 ${r2.people} · 움직인 사람 ${r2.moved} · 갈 곳 두고 30초 넘게 멈춘 사람 ${r2.frozen} (가장 길게 ${r2.worst}초) · 막힘 ${r2.s.stuck} · 비켜 돌기 ${r2.s.detours} · 옮김 ${r2.s.snaps} · 쉬었다 다시 ${r2.s.holds}`);
  ok(r2.moved / Math.max(1, r2.people) > 0.15, `${label}: 3분 동안 2 m 넘게 움직인 사람 ${(100 * r2.moved / Math.max(1, r2.people)).toFixed(0)}%`);

  // 3) 인사 · 이웃 무리의 대화
  const r3 = await ev(() => {
    const g = SEREN.game, Ci = g.citizens, C = g.world.clock, pp = g.player.pos;
    const s0 = { ...Ci.stats };
    C.time = Math.floor(C.time) + 0.5;
    for (let k = 0; k < 900; k++) { g.time += 0.1; C.time += 0.1 / 1200; Ci.update(0.1); }
    // 이웃 무리 곁에 서서 듣기
    const chat = Ci.vis.find((q) => q.role === 'chat');
    let heard = 0;
    if (chat) {
      pp.x = chat.pos.x + 3; pp.z = chat.pos.z + 3;
      const say = g.say; g.say = (...a) => { heard++; return say.apply(g, a); };
      for (let k = 0; k < 40; k++) { Ci.sayT = 0; Ci._ambientTalk(0.1, pp); }
      g.say = say;
    }
    return { greet: Ci.stats.greet - s0.greet, npcTalk: Ci.stats.npcTalk - s0.npcTalk, chat: !!chat, heard };
  });
  ok(!r3.chat || r3.npcTalk > 0, `${label}: 이웃끼리 인사 ${r3.greet} · 이웃 무리 대화 ${r3.npcTalk}${r3.chat ? '' : ' (둘레에 이웃 무리 없음)'} · 들린 말 ${r3.heard}`);
}

// 3b) 이슬터의 거리 아웬: 모두 이름이 있고 · 말을 걸 수 있고(대화가 바로 끝나지 않음) · 1분 동안 움직인다
const r7 = await ev(() => {
  const g = SEREN.game, N = g.npcs, pp = g.player.pos;
  g.player.teleport(-420, undefined, 7840);
  g.world.clock.time = Math.floor(g.world.clock.time) + 0.45;
  const A = N.list.filter((n) => n.ambient && n.place === 'dewfold');
  const start = A.map((n) => [n.pos.x, n.pos.z]), s0 = N.stats.stuck;
  for (let k = 0; k < 600; k++) { g.time += 0.1; N.update(0.1); }
  const moved = A.filter((n, i) => Math.hypot(n.pos.x - start[i][0], n.pos.z - start[i][1]) > 1).length;
  let talkable = 0, talked = 0;
  const miss = [];
  for (const n of A) {
    pp.set(n.pos.x + 1, n.pos.y, n.pos.z);
    const t = g._findTarget();
    if (t && t.o === n) talkable++; else miss.push(`${n.name}→${t ? t.kind + ':' + (t.o && t.o.name) : '없음'}`);
    g.talkTo(n);
    const a = g.dialogue.active;
    if (a && a.convo.length >= 2) talked++;
    g.dialogue.end();
  }
  return { n: A.length, named: A.filter((n) => n.name && n.name !== '아웬').length, moved, talkable, talked, miss: miss.join(' '), stuck: N.stats.stuck - s0 };
});
ok(r7.n > 0 && r7.named === r7.n && r7.talked === r7.n && r7.talkable === r7.n, `이슬터 거리 아웬 ${r7.n}: 이름 ${r7.named} · 말 걸기 표시 ${r7.talkable}${r7.miss ? ` (${r7.miss})` : ''} · 대화 ${r7.talked}`);
ok(r7.moved >= Math.ceil(r7.n * 0.5), `이슬터 거리 아웬: 1분 동안 움직인 사람 ${r7.moved}/${r7.n} · 막혀서 다른 곳으로 ${r7.stuck}`);

// 4) 기억 대화
const talkOnce = (key) => ev(async (key) => {
  const g = SEREN.game, Ci = g.citizens;
  const p = Ci.vis.find((q) => q.key === key) || Ci.people.get(key);
  Ci.talk(p);
  const a = g.dialogue.active;
  const ko = a ? a.convo.map((e) => e.lineObj && e.lineObj.ko).filter(Boolean) : [];
  g.dialogue.end();
  const m = g.state.cit.mem[key];
  return { ko, n: m.n, rec: [...m.rec] };
}, key);
const who = await ev(() => {
  const g = SEREN.game, Ci = g.citizens;
  g.world.clock.time = Math.floor(g.world.clock.time) + 0.45;
  for (let k = 0; k < 20; k++) { g.time += 0.1; Ci.update(0.1); }
  const p = Ci.vis.find((q) => !q.leader && q.age !== 'child' && !q.indoorRole) || Ci.vis[0];
  g.player.pos.x = p.pos.x + 1.5; g.player.pos.z = p.pos.z;
  delete g.state.cit.mem[p.key];
  return { key: p.key, name: p.name };
});
const t1 = await talkOnce(who.key);
ok(t1.n === 1 && /처음|먼 별/.test(t1.ko[0]), `처음 만남: 「${t1.ko.join(' / ')}」`);
const t2 = await talkOnce(who.key);
ok(t2.n === 2 && /또|아까/.test(t2.ko[0]) && t2.ko[0] !== t1.ko[0], `같은 날 또: 「${t2.ko.join(' / ')}」`);
await ev((key) => { const g = SEREN.game, Ci = g.citizens, p = Ci.people.get(key); Ci._reward([p], { kind: 'tag', friend: 1 }); }, who.key);
const t3 = await talkOnce(who.key);
ok(t3.ko.some((s) => /술래잡기/.test(s)), `함께 논 뒤: 「${t3.ko.join(' / ')}」`);
const t3b = await talkOnce(who.key);
ok(!t3b.ko.some((s) => /술래잡기/.test(s)) && t3b.ko[0] !== t3.ko[0], `후일담은 한 번만 · 인사는 바뀜: 「${t3b.ko.join(' / ')}」`);
await ev(() => { SEREN.game.world.clock.time += 4; });
const t4 = await talkOnce(who.key);
ok(/오랜만|돌아왔/.test(t4.ko[0]), `나흘 뒤: 「${t4.ko.join(' / ')}」`);

// 5) 저장 → 불러오기
const r5 = await ev(async (key) => {
  const g = SEREN.game, id = g.slot;
  const m0 = JSON.stringify(g.state.cit.mem[key]);
  g.save(true);
  g.continueGame(id);
  await new Promise((r) => setTimeout(r, 2500));
  const m = g.state.cit.mem[key];
  return { same: JSON.stringify(m) === m0, n: m && m.n, ev: m && m.ev.map((e) => e.k).join(',') };
}, who.key);
ok(r5.same && r5.n === 5, `저장 → 불러오기: ${who.name}의 기억 그대로 (만남 ${r5.n} · 함께 한 일 ${r5.ev})`);
const t6 = await ev(() => new Promise((r) => setTimeout(r, 4000)).then(() => 0));
void t6;
const t7 = await page.waitForFunction((key) => { const Ci = SEREN.game.citizens; return SEREN.game.mode === 'play' && (Ci.people.get(key) || Ci.vis.find((q) => q.key === key)); }, who.key, { timeout: 120000, polling: 500 }).then(() => talkOnce(who.key)).catch(() => null);
ok(t7 && t7.n === 6 && !/처음/.test(t7.ko[0]), `불러온 뒤 다시 말 걸기: 「${t7 ? t7.ko.join(' / ') : '사람을 찾지 못함'}」`);

// 6) 건물에 들어서면 사람들이 이미 지내던 자리에 (입구 한 점에 겹쳐 나타나 흩어지지 않음 — v24 P1)
for (const pid of ['museum', 'market', 'hotel', 'terminal', 'bank']) {
  const ok0 = await ev((pid) => {
    const g = SEREN.game, I = g.interiors, C = g.city, P = g.player.pos;
    const r = C.recs.filter((q) => q.door && !q.custom && I.info(q).pid === pid).sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z))[0];
    if (!r) return false;
    g.world.clock.time = Math.floor(g.world.clock.time) + 0.5;
    C.fixDoor(r); g.player.teleport(r.door.x + r.door.nx * 3, undefined, r.door.z + r.door.nz * 3); I.enter(r);
    return true;
  }, pid);
  if (!ok0) { console.log(`  (${pid}: 건물 없음)`); continue; }
  await page.waitForFunction(() => SEREN.game.interiors.inPocket && !SEREN.game.interiors._busy, null, { timeout: 180000, polling: 300 });
  await page.waitForTimeout(800);
  const r6 = await ev(() => {
    const g = SEREN.game, I = g.interiors, ind = I.cur.indoor, ops = I.ops || g.ops, A = (ops && ops.agents) || ind.agents;
    const L = A ? A.list.filter((a) => a.floor === ind.cur) : [];
    const pl = ind.plan(ind.cur), B = ind.B, G = B.G, e = pl.L.ents.main;
    let ex = null, ez = null;
    if (e) { const i = e.c % G.gw, j = (e.c / G.gw) | 0; ex = G.ox + i + 0.5; ez = G.oz + j + 0.5; }
    let pairs = 0, atDoor = 0;
    for (let i = 0; i < L.length; i++) {
      if (ex != null && Math.hypot(L[i].gx - ex, L[i].gz - ez) < 2.5 && !L[i].staff) atDoor++;
      for (let j = i + 1; j < L.length; j++) if (Math.hypot(L[i].gx - L[j].gx, L[i].gz - L[j].gz) < 0.4) pairs++;
    }
    return { name: I.title(I.cur.r), n: L.length, staff: L.filter((a) => a.staff).length, pairs, atDoor, ground: ind.cur === B.ground };
  });
  ok(r6.pairs <= 1 && r6.atDoor <= 2, `${pid} 「${r6.name}」: 이 층 사람 ${r6.n} (일하는 이 ${r6.staff}) · 0.4 m 안에 겹친 쌍 ${r6.pairs} · 정문 2.5 m 안 손님 ${r6.atDoor}`);
  await ev(() => SEREN.game.interiors.exit());
  await page.waitForFunction(() => !SEREN.game.interiors.inPocket && !SEREN.game.interiors._busy, null, { timeout: 120000, polling: 300 });
}

console.log(logs.length ? `기록:\n${[...new Set(logs)].slice(0, 8).join('\n')}` : '페이지 오류 없음');
console.log(fails ? `실패 ${fails}` : '모두 통과');
await browser.close();
process.exit(fails ? 1 : 0);
