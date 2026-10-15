// 겹친 면(Z-fighting) · 바닥 검사 (헤드리스): 쓰임마다 건물에 들어가 층을 차례로 그리고, 그 층의 모든 삼각형(인스턴스 물건·책등 포함)에서
// 같은 평면(법선 같고 0.5 mm 안)에 같은 쪽을 보며 넓이가 겹치는 두 삼각형을 찾는다 — 색이 다르면 화면에서 깜빡인다.
//   node tools/zfight.mjs [쓰임들|all] [건물 수=1] [층 수=6]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ALL = ['market', 'cafe', 'factory', 'depot', 'office', 'lab', 'school', 'heal', 'plant', 'terminal', 'museum', 'library', 'hall', 'hotel', 'home', 'farm', 'admin', 'garden'];
const want = process.argv[2] && process.argv[2] !== 'all' ? process.argv[2].split(',') : ALL;
const NB = +(process.argv[3] || 1) || 1, NF = +(process.argv[4] || 6) || 6;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
const logs = [];
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto('file://' + join(root, 'index.html') + '?play=new&nowake=1&q=low&t=0.45');
await page.waitForFunction(() => window.SEREN && SEREN.game && SEREN.game.city && SEREN.game.city.recs && SEREN.game.city.recs.length > 0, null, { timeout: 300000, polling: 1000 });
await page.evaluate(() => {
  const g = SEREN.game; if (g.tips) g.tips.first = () => false; g.ui.moa = () => {};
  // 한 층 무리(group)의 삼각형 → 같은 평면에서 넓이가 겹치는 쌍
  // fy·cy: 이 층 바닥·천장 높이 (세계) — 바닥에 붙은 아래쪽 면(가구 밑면)·천장에 붙은 위쪽 면은 카메라가 볼 수 없다
  window.__zf = (group, fy = -1e9, cy = 1e9) => {
    group.updateMatrixWorld(true);
    const T = []; // [ax,ay,az,bx,by,bz,cx,cy,cz]
    const meta = []; // { name, col }
    const tf = (m, x, y, z) => [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
    const mul = (a, b) => { const o = new Array(16); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; o[i * 4 + j] = s; } return o; };
    let skipped = 0;
    group.traverse((o) => {
      if (!o.isMesh || !o.visible || !o.geometry || !o.geometry.attributes.position) return;
      const mat = Array.isArray(o.material) ? o.material[0] : o.material;
      if (mat && (mat.transparent || mat.depthWrite === false)) return; // 유리·빛 띠(깊이를 쓰지 않는 것)는 겹쳐 그려도 깜빡이지 않는다
      const g = o.geometry, P = g.attributes.position.array, I = g.index ? g.index.array : null, C = g.attributes.color ? g.attributes.color.array : null;
      const nT = (I ? I.length : P.length / 3) / 3;
      const mats = [];
      if (o.isInstancedMesh) {
        if (o.count * nT > 400000) { skipped += o.count; return; }
        for (let k = 0; k < o.count; k++) mats.push(mul(o.matrixWorld.elements, Array.from(o.instanceMatrix.array.slice(k * 16, k * 16 + 16))));
      } else mats.push(o.matrixWorld.elements);
      const name = `${o.name || ''}${o.isInstancedMesh ? '[i]' : ''}:${mat && mat.name ? mat.name : mat && mat.type}`;
      mats.forEach((m, mi) => {
        for (let t = 0; t < nT; t++) {
          const ia = I ? I[t * 3] : t * 3, ib = I ? I[t * 3 + 1] : t * 3 + 1, ic = I ? I[t * 3 + 2] : t * 3 + 2;
          const a = tf(m, P[ia * 3], P[ia * 3 + 1], P[ia * 3 + 2]), b = tf(m, P[ib * 3], P[ib * 3 + 1], P[ib * 3 + 2]), c = tf(m, P[ic * 3], P[ic * 3 + 1], P[ic * 3 + 2]);
          T.push([...a, ...b, ...c]);
          meta.push({ name, inst: o.isInstancedMesh ? mi : -1, col: C ? `${C[ia * 3].toFixed(2)},${C[ia * 3 + 1].toFixed(2)},${C[ia * 3 + 2].toFixed(2)}` : '' });
        }
      });
    });
    // 평면별 묶기
    const planes = new Map();
    for (let k = 0; k < T.length; k++) {
      const t = T[k];
      const ux = t[3] - t[0], uy = t[4] - t[1], uz = t[5] - t[2], vx = t[6] - t[0], vy = t[7] - t[1], vz = t[8] - t[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz);
      if (l < 1e-6) continue; // 넓이 없는 삼각형
      nx /= l; ny /= l; nz /= l;
      if (ny < -0.99 && Math.max(t[1], t[4], t[7]) <= fy + 0.02) continue;
      if (ny > 0.99 && Math.min(t[1], t[4], t[7]) >= cy - 0.02) continue;
      const d = nx * t[0] + ny * t[1] + nz * t[2];
      const key = `${Math.round(nx * 500)},${Math.round(ny * 500)},${Math.round(nz * 500)},${Math.round(d / 0.0005)}`;
      let L = planes.get(key);
      if (!L) planes.set(key, (L = { n: [nx, ny, nz], list: [] }));
      L.list.push(k);
    }
    // 2D 로 펴서 겹침 넓이 (볼록 다각형 자르기)
    const clip = (poly, a, b) => {
      const out = [];
      const side = (p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
      for (let i = 0; i < poly.length; i++) {
        const p = poly[i], q = poly[(i + 1) % poly.length], sp = side(p), sq = side(q);
        if (sp >= 0) out.push(p);
        if ((sp >= 0) !== (sq >= 0)) { const s = sp / (sp - sq); out.push([p[0] + (q[0] - p[0]) * s, p[1] + (q[1] - p[1]) * s]); }
      }
      return out;
    };
    const area = (p) => { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };
    const agg = new Map();
    let pairs = 0, nFound = 0;
    for (const [, L] of planes) {
      if (L.list.length < 2) continue;
      const [nx, ny, nz] = L.n, ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
      const drop = ax >= ay && ax >= az ? 0 : ay >= az ? 1 : 2; // 가장 큰 축을 버리고 나머지 둘로
      const to2 = (t, i) => (drop === 0 ? [t[i * 3 + 1], t[i * 3 + 2]] : drop === 1 ? [t[i * 3], t[i * 3 + 2]] : [t[i * 3], t[i * 3 + 1]]);
      const tri2 = new Map();
      const get = (k) => { let p = tri2.get(k); if (!p) { const t = T[k]; p = [to2(t, 0), to2(t, 1), to2(t, 2)]; if (area(p) < 0) p.reverse(); tri2.set(k, p); } return p; };
      // 칸(0.5 m) 해시
      const H = new Map(), box = new Map();
      for (const k of L.list) {
        const p = get(k);
        const x0 = Math.floor(Math.min(p[0][0], p[1][0], p[2][0]) / 0.5), x1 = Math.floor(Math.max(p[0][0], p[1][0], p[2][0]) / 0.5);
        const y0 = Math.floor(Math.min(p[0][1], p[1][1], p[2][1]) / 0.5), y1 = Math.floor(Math.max(p[0][1], p[1][1], p[2][1]) / 0.5);
        if ((x1 - x0 + 1) * (y1 - y0 + 1) > 4000) continue; // 아주 큰 면(바닥 한 장)은 칸이 너무 많다 — 그런 면은 작은 면 쪽에서 만난다
        box.set(k, [x0, y0]);
        for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) { const hk = x * 100003 + y; let a = H.get(hk); if (!a) H.set(hk, (a = { x, y, l: [] })); a.l.push(k); }
      }
      for (const [, cell] of H) {
        const A = cell.l;
        if (A.length < 2) continue;
        for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) {
          const a = A[i], b = A[j], ba = box.get(a), bb = box.get(b);
          if (Math.max(ba[0], bb[0]) !== cell.x || Math.max(ba[1], bb[1]) !== cell.y) continue; // 두 상자가 처음 만나는 칸에서 한 번만
          pairs++;
          let poly = get(a);
          const q = get(b);
          for (let e = 0; e < 3 && poly.length; e++) poly = clip(poly, q[e], q[(e + 1) % 3]);
          const ar = poly.length >= 3 ? area(poly) : 0;
          if (ar > 4e-4) {
            const ma = meta[a], mb = meta[b];
            if (ma.name === mb.name && ma.inst === mb.inst && ma.col === mb.col) continue; // 같은 것의 같은 색 면끼리(덧댄 상자)는 화면에서 같다
            const t = T[a], orient = Math.abs(L.n[1]) > 0.99 ? (L.n[1] > 0 ? '위' : '아래') : '옆';
            const key = `${orient}|${ma.name}|${ma.col}|${mb.name}|${mb.col}`;
            let f = agg.get(key);
            if (!f) agg.set(key, (f = { orient, a: ma.name, b: mb.name, ca: ma.col, cb: mb.col, n: 0, ar: 0, at: [Math.round(t[0] * 10) / 10, Math.round((t[1] - fy) * 100) / 100, Math.round(t[2] * 10) / 10], nrm: L.n.map((v) => Math.round(v * 100) / 100), ta: T[a], tb: T[b] }));
            f.n++; f.ar += ar; nFound++;
          }
        }
      }
    }
    // 틀 좌표(칸)와 가까운 가구 — 어느 것이 겹치는지 가리키게
    const ind = SEREN.game.interiors.cur && SEREN.game.interiors.cur.indoor, built = ind && [...ind.built.values()].find((q) => q.group === group);
    const where = (t) => { if (!ind) return null; const P = [0, 1, 2].map((q) => ind.grid(t[q * 3], t[q * 3 + 2]).map((v) => Math.round(v * 100) / 100).concat([Math.round((t[q * 3 + 1] - fy) * 100) / 100])); return P; };
    const near = (t) => { if (!built) return null; const [gx, gz] = ind.grid((t[0] + t[3] + t[6]) / 3, (t[2] + t[5] + t[8]) / 3); return built.fix.map((F) => [F.t, Math.round(Math.hypot(F.x - gx, F.z - gz) * 10) / 10]).sort((a, b) => a[1] - b[1]).slice(0, 2); };
    const found = [...agg.values()].sort((a, b) => b.ar - a.ar).map((f) => { const { ta, tb, ...rest } = f; return { ...rest, ar: Math.round(f.ar * 1000) / 1000, A: where(ta), B: where(tb), near: near(ta) }; });
    return { tris: T.length, planes: planes.size, pairs, skipped, found, nFound };
  };
});
const out = [];
let bad = 0, noFloor = 0;
for (const pid of want) {
  const list = await page.evaluate(({ pid, NB }) => {
    const g = SEREN.game, I = g.interiors, C = g.city, P = { x: -2200, z: 5250 };
    const L = C.recs.filter((r) => r.door && I.info(r).pid === pid).sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z));
    window.__list = L.slice(0, NB);
    return window.__list.length;
  }, { pid, NB });
  for (let b = 0; b < list; b++) {
    if (process.env.ZV) console.error(`${pid} 건물 ${b} 들어가기`);
    await page.evaluate((b) => { const g = SEREN.game, I = g.interiors, r = window.__list[b]; g.city.fixDoor(r); g.player.teleport(r.door.x + r.door.nx * 3, undefined, r.door.z + r.door.nz * 3); I.enter(r); }, b);
    try { await page.waitForFunction(() => SEREN.game.interiors.inPocket && !SEREN.game.interiors._busy, null, { timeout: 120000, polling: 300 }); } catch { console.log(JSON.stringify({ pid, err: '들어가기 시간 초과' })); continue; }
    const floors = await page.evaluate((NF) => { const B = SEREN.game.interiors.cur.B; const ok = B.floors.filter((F) => F.reach && !F.dead).map((F) => F.i); const step = Math.max(1, Math.ceil(ok.length / NF)); return ok.filter((_, k) => k % step === 0).slice(0, NF); }, NF);
    const res = { pid, name: await page.evaluate(() => SEREN.game.interiors.title(SEREN.game.interiors.cur.r)), floors: [] };
    for (const i of floors) {
      await page.evaluate((i) => { const I = SEREN.game.interiors, ind = I.cur.indoor; ind.setFloor(i); if (SEREN.game.ops) SEREN.game.ops.floorChanged(i); }, i);
      await page.waitForTimeout(400);
      const t1 = Date.now();
      const r = await page.evaluate((i) => {
        const g = SEREN.game, I = g.interiors, ind = I.cur.indoor, o = ind.built.get(i); if (!o) return null;
        const t0 = performance.now(); const B = I.cur.B, F = B.floors[i], fy = ind.yOf(i); const z = window.__zf(o.group, fy, fy + (F.ceil - F.y));
        // 바닥이 있는가: 바닥 높이의 위를 보는 면 · 그리고 오가는 방 가운데에 세워 1초 — 떨어지지 않는가
        let floorTris = 0; o.group.traverse((m) => { if (!m.isMesh || m.isInstancedMesh || !m.geometry.attributes.normal) return; const N = m.geometry.attributes.normal.array, P = m.geometry.attributes.position.array; for (let t = 0; t < N.length; t += 9) if (N[t + 1] > 0.99 && Math.abs(P[t + 1]) < 0.01) floorTris++; });
        const R = o.L.rooms.find((q) => q.circ && q.n) || o.L.rooms.find((q) => q.n > 6);
        let fell = null;
        if (R) {
          // 그 방의 실제 칸 가운데 (가운데가 방 밖일 수 있는 ㄱ자·중2층 띠 방도) — 가구가 없는 칸
          let best = -1, bd = 1e9;
          const occ = new Set(); for (const q of o.fix) { const ii = Math.floor(q.x - B.G.ox), jj = Math.floor(q.z - B.G.oz); occ.add(jj * B.G.gw + ii); }
          for (let c = 0; c < o.L.room.length; c++) if (o.L.room[c] === R.id + 1 && !o.L.void[c] && !occ.has(c)) { const d = Math.hypot(c % B.G.gw - R.cx, ((c / B.G.gw) | 0) - R.cz); if (d < bd) { bd = d; best = c; } }
          if (best >= 0) { const [x, zz] = ind.world(B.G.ox + (best % B.G.gw) + 0.5, B.G.oz + ((best / B.G.gw) | 0) + 0.5); I.placeAt(i, x, zz); for (let k = 0; k < 20; k++) g.updateSim(0.05); fell = Math.round((fy - g.player.pos.y) * 100) / 100; }
        }
        return { i, label: F.label, tris: z.tris, floorTris, fell, pairs: z.pairs, skipped: z.skipped, ms: Math.round(performance.now() - t0), n: z.nFound, kinds: z.found.length, ex: z.found.slice(0, 6) };
      }, i);
      if (r && (!r.floorTris || (r.fell != null && r.fell > 0.3))) { console.log(JSON.stringify({ pid, floor: r.label, err: '바닥이 없거나 떨어짐', floorTris: r.floorTris, fell: r.fell })); noFloor++; }
      if (process.env.ZV) console.error(`  ${pid} 층 ${i}: ${Date.now() - t1} ms`, r && r.tris);
      if (r) { res.floors.push(r); if (r.n) bad++; }
    }
    console.log(JSON.stringify(res));
    out.push(res);
    await page.evaluate(() => SEREN.game.interiors.exit());
    try { await page.waitForFunction(() => !SEREN.game.interiors.inPocket && !SEREN.game.interiors._busy, null, { timeout: 60000, polling: 300 }); } catch {}
  }
}
console.log(logs.length ? `기록:\n${[...new Set(logs)].slice(0, 10).join('\n')}` : '오류 없음');
console.log(bad ? `겹친 면이 있는 층 ${bad}` : '겹친 면 없음');
console.log(noFloor ? `바닥이 없거나 떨어지는 층 ${noFloor}` : '모든 층에 바닥이 있고 서 있다');
await browser.close();
process.exit(bad || noFloor ? 1 : 0);
