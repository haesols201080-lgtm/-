// 몸 크기 (v24 · 문서 P0 「천장·지붕·층고 안전 여유」): 천장·문·중2층 높이, 사람들의 충돌 높이가 모두 이 값에서 나온다.
//  아웬(주민)은 키가 크다 — 몸 모델(crowd.awenGeo) 배율 1 에서 머리 위 더듬띠 끝까지 3.1 m, 어른은 배율 0.86~1.06.
//  사람(조종사)은 1.75 m, 제자리 점프 꼭대기는 머리가 3.5 m 남짓까지 오른다.
export const AWEN_H = 3.1; // 배율 1 의 키 (crowd.awenGeo 의 꼭짓점 최고 높이)
export const AWEN_SCALE_MAX = 1.06; // 가장 큰 어른 배율 (citizens · interior agents)
export const PLAYER_H = 1.75;
export const HEADROOM = 0.35; // 가장 큰 몸 위로 남길 여유
/** 가장 큰 주민이 머리를 숙이지 않고 지나갈 높이 */
export const TALLEST = AWEN_H * AWEN_SCALE_MAX; // ≈ 3.29 m
