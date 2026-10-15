// 세렌의 화폐 (v0.9): 단위 「울」 — 울림판에 새겨 세는 고마움의 셈. 이름을 바꾸려면 여기 한 곳만.
//  · 가방의 돈은 state.inv.starseed (옛 저장과 맞추려고 열쇠 이름은 그대로)
//  · 「별씨」는 이제 돈이 아니라 재료: 별비·생명나무에서 줍는 빛 씨앗 (state.inv.seedstar) — 온실에 심고, 장인이 장비를 손볼 때 녹인다
export const CUR = '울';
/** 12 → "12울", 3.5 → "3.5울" */
export function won(n) {
  const v = Math.round((+n || 0) * 100) / 100;
  return `${v.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}${CUR}`;
}
