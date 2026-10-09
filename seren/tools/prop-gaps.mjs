// 거리 소품 틈 검사 (v24 P0 「캐릭터 구조물 끼임」 — 참고 이미지 2): 블록을 깨워 놓인 소품의 몸 높이 충돌 모양끼리,
// 그리고 소품과 건물·구조물 사이에 사람이 못 지나갈 틈(0 < 틈 < 0.85 m)이나 겹침이 있는지 센다.
//   node tools/prop-gaps.mjs [블록 수=400]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const NB = +(process.argv[2] || 400);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await (await browser.newContext({ viewport: { width: 480, height: 270 } })).newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto('file://' + (process.env.SEREN_HTML || join(root, 'index.html')) + '?play=new&nowake=1&q=low');
await page.waitForFunction(() => window.SEREN && SEREN.game && SEREN.game.city && SEREN.game.city.recs && SEREN.game.mode === 'play', null, { timeout: 300000, polling: 1000 });
const r = await page.evaluate((NB) => {
  const C = SEREN.game.city, G = C.propGeom, W = SEREN.game.world.colliders;
  if (!G) return { err: 'city.propGeom 없음' };
  // 블록 고르기: 도시 블록 전체에서 고르게
  const all = [];
  for (const z of C.zones || []) for (const B of z.blocks || []) all.push(B);
  const step = Math.max(1, Math.floor(all.length / NB));
  const blocks = all.filter((_, k) => k % step === 0).slice(0, NB);
  let props = 0, pairs = 0, narrow = 0, overlap = 0, bNarrow = 0, bOverlap = 0;
  const ex = [];
  for (const B of blocks) {
    C._activate(B);
    const shp = B.props.map((p) => G.propShapes(C.pkind[p.ki], p.x, p.z, p.yaw, p.s, p.sx));
    props += B.props.length;
    for (let a = 0; a < shp.length; a++) for (let b = a + 1; b < shp.length; b++) {
      let m = 1e9;
      for (const A of shp[a]) for (const Bs of shp[b]) if (Math.hypot(A.x - Bs.x, A.z - Bs.z) < A.R + Bs.R + 1) m = Math.min(m, G.shapeGap(A, Bs));
      if (m > 5) continue;
      pairs++;
      if (m <= 0.0) { overlap++; if (ex.length < 12) ex.push(`겹침 ${C.pkind[B.props[a].ki]}↔${C.pkind[B.props[b].ki]} ${m.toFixed(2)} @${B.props[a].x.toFixed(0)},${B.props[a].z.toFixed(0)}`); }
      else if (m < G.gap) { narrow++; if (ex.length < 12) ex.push(`틈 ${C.pkind[B.props[a].ki]}↔${C.pkind[B.props[b].ki]} ${m.toFixed(2)} m @${B.props[a].x.toFixed(0)},${B.props[a].z.toFixed(0)}`); }
    }
    // 소품 ↔ 건물·구조물 (조작대는 건물 발치에 붙여 두는 자리라 뺀다)
    for (let a = 0; a < shp.length; a++) {
      const kind = C.pkind[B.props[a].ki];
      if (kind === 'console') continue;
      const p = B.props[a];
      for (const c of W.near(p.x, p.z, 8)) {
        if (!c.city || c.stream || c.y0 > p.y + 2 || c.y1 < p.y - 0.5) continue;
        const w = c.type === 'cyl' ? { c: 1, x: c.x, z: c.z, r: c.r } : c.type === 'box' ? { c: 0, x: c.x, z: c.z, hx: c.hx, hz: c.hz, cs: c.cos, sn: c.sin } : null;
        if (!w) continue;
        let m = 1e9;
        for (const A of shp[a]) m = Math.min(m, G.shapeGap(A, w));
        if (m <= 0) { bOverlap++; if (ex.length < 16) ex.push(`건물 겹침 ${kind} ${m.toFixed(2)} @${p.x.toFixed(0)},${p.z.toFixed(0)}`); }
        else if (m < G.gap) { bNarrow++; if (ex.length < 16) ex.push(`건물 틈 ${kind} ${m.toFixed(2)} m @${p.x.toFixed(0)},${p.z.toFixed(0)}`); }
      }
    }
  }
  return { blocks: blocks.length, props, pairs, narrow, overlap, bNarrow, bOverlap, ex };
}, NB);
console.log(JSON.stringify(r, null, 1));
const fails = r.err ? [r.err] : [];
if (!r.err && (r.narrow || r.overlap || r.bNarrow || r.bOverlap)) fails.push(`좁은 틈 ${r.narrow} · 겹침 ${r.overlap} · 건물과 좁은 틈 ${r.bNarrow} · 건물과 겹침 ${r.bOverlap}`);
console.log(errs.length ? `페이지 오류:\n${errs.join('\n')}` : '페이지 오류 없음');
console.log(fails.length ? `실패\n${fails.join('\n')}` : '통과');
await browser.close();
process.exit(fails.length || errs.length ? 1 : 0);
