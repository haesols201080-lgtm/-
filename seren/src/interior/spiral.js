// 나선 계단의 모양 (v24): render(디딤판·충돌체) · core(작은 나선 계단을 쓸 수 있는 층 높이) · 검사기가 같은 식을 쓴다.
//  계단 로컬: Z = 정면(문 쪽), 앞 한 줄 칸(edgeLz 앞)은 층마다 계단참. 디딤판은 계단참 띠를 비켜 돌아
//  앞 띠 한쪽 끝(−lx)에서 떠나 반대쪽 끝(+lx)에 닿는다.
//  · 한 바퀴: 3×3 칸 이상이면 7 m 넘는 층도 오른다(디딤판은 가파르지만 0.21 m 씩).
//  · 두 바퀴: 층이 높으면 덜 가파르게 — 다만 둘째 바퀴로 넘어가며 앞 띠(아래층 계단참) 위를 한 번 지나므로,
//    그 디딤판 밑으로 아래 계단참에 선 사람의 머리 공간, 위로 위층 계단참 바닥판까지의 머리 공간이 모두 남을 때만.
//    (전에는 「4 m 넘으면 두 바퀴」 — 4.2 m 층에서 그 디딤판이 계단참 1.3~2.9 m 높이를 지나 계단실에 들어서지도, 오르지도 못했다)
//  · 2×2 칸(작은 줄기 속)은 몸(지름 0.7 m)이 기둥과 벽 사이 0.72 m 고리를 겨우 지나 한 바퀴가 짧다 — 3.4 m 아래 층만.
const SLAB = 0.35; // program.SLAB 과 같게 (위층 계단참 바닥판 두께)
const THICK = 0.35; // 디딤판 충돌체 두께 (render 와 같게)
const HEAD = 1.95; // 머리 공간 (몸 키 1.75 + 여유)
export const SPIRAL_RISE = 0.21;
/** 작은 나선 계단(2×2 칸)으로 이을 수 있는 가장 높은 층 사이 높이 */
export const SPIRAL2_MAXH = 3.4;

/** 나선 계단 모양: 칸 수(along = 정면 방향, across = 옆), 층 사이 높이 h */
export function spiralPlan(along, across, h) {
  const R = Math.min(along, across) / 2 - 0.08, mr = (R + 0.2) / 2, edgeLz = along / 2 - 1;
  const th = Math.acos(Math.max(-1, Math.min(1, edgeLz / mr))) + 0.14; // 떠나는 각 (앞에서)
  const n = Math.max(10, Math.ceil(h / SPIRAL_RISE));
  const mk = (turns) => { const span = Math.PI * 2 * turns - 2 * th; return { R, mr, edgeLz, th, turns, span, n, da: span / n }; };
  const two = mk(2);
  return h > 3.6 && twoTurnsFit(two, h) ? two : mk(1);
}

function twoTurnsFit(P, h) {
  const { R, mr, edgeLz, th, n, da, span } = P;
  // 위아래 바퀴 사이 (같은 각의 디딤판끼리)
  if ((h * Math.PI * 2) / span - THICK < HEAD) return false;
  // 둘째 바퀴로 넘어가며 앞 띠 위를 지나는 디딤판 (π..3π)
  for (let k = 1; k <= n; k++) {
    const phi = th + (k - 0.5) * da, y = (k / n) * h;
    if (phi < Math.PI || phi > Math.PI * 3) continue;
    const w = mr * da * 1.25;
    const lz = Math.max(R * Math.cos(phi), 0.2 * Math.cos(phi)) + (w / 2) * Math.abs(Math.sin(phi));
    if (lz <= edgeLz - 0.35) continue; // 계단참에 선 몸과 겹치지 않는다
    if (y - THICK < HEAD || y > h - SLAB - HEAD) return false;
  }
  return true;
}
