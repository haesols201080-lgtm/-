// 개발용: 지역별 높은 곳·평평한 곳 찾기
import { heightAt, regionWeights, RC } from '../src/world/heightfield.js';
import { REGIONS } from '../src/world/regions.js';
const w = new Float32Array(RC);
const step = 150;
const res = REGIONS.map(() => ({ high: [], flat: [] }));
for (let z = -22000; z <= 22000; z += step) for (let x = -22000; x <= 22000; x += step) {
  const h = heightAt(x, z, 1, w);
  let b = 0; for (let k = 1; k < RC; k++) if (w[k] > w[b]) b = k;
  if (w[b] < 0.75) continue;
  const e = 40;
  const sl = Math.hypot(heightAt(x + e, z, 1) - heightAt(x - e, z, 1), heightAt(x, z + e, 1) - heightAt(x, z - e, 1)) / (2 * e);
  res[b].high.push([h, x, z]);
  if (h > 5 && sl < 0.04) res[b].flat.push([h, x, z, sl]);
}
for (let i = 0; i < RC; i++) {
  const r = res[i];
  r.high.sort((a, b) => b[0] - a[0]);
  console.log(`== ${REGIONS[i].id} (${r.high.length} pts) max:`, r.high.slice(0, 5).map((v) => v.map((n) => Math.round(n)).join('/')).join('  '));
  // 지역 중심 가까운 평지
  const c = REGIONS[i].center;
  r.flat.sort((a, b) => Math.hypot(a[1] - c[0], a[2] - c[1]) - Math.hypot(b[1] - c[0], b[2] - c[1]));
  console.log('   flat near center:', r.flat.slice(0, 6).map((v) => v.slice(0, 3).map((n) => Math.round(n)).join('/')).join('  '));
}
