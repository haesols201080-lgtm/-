// 건물마다 하나뿐인 이름표와 씨앗 (v0.9)
//  · uid: 구역 + 모양 + 자리(반 m 단위) — 건물 목록의 순서가 바뀌어도(화질·새 건물) 같은 건물은 같은 uid.
//  · seed: 세계 씨앗 + uid + 쓰임 → 늘 같은 32비트 수. 같은 건물은 언제 들어가도 같은 기본 구조가 된다.
import { hashStr, mulberry32 } from '../core/noise.js';

export const WORLD_SEED = 'seren-harmonea-1';
/** 실내 생성기 판 — 판이 바뀌어도 저장된 구조는 그대로 쓴다(이미 본 건물은 바뀌지 않는다) */
export const GEN_VERSION = 5;

export function uidOf(r) {
  if (r.uid) return r.uid;
  const zx = Math.round(r.x * 2), zz = Math.round(r.z * 2);
  r.uid = `${r.zone || 'x'}/${r.kind}/${zx}/${zz}`;
  return r.uid;
}

export function seedOf(r) {
  if (r.useSeed != null) return r.useSeed;
  r.useSeed = hashStr(`${WORLD_SEED}|${uidOf(r)}|${r.use || ''}`) >>> 0;
  return r.useSeed;
}

/** 이름이 붙은 작은 난수열: 같은 건물·같은 이름이면 늘 같은 수열 */
export function rngFor(seed, name) {
  return mulberry32((hashStr(name) ^ seed) >>> 0);
}

/** 고르기 도구 */
export const pick = (rnd, arr) => arr[Math.floor(rnd() * arr.length) % arr.length];
export function weighted(rnd, list) {
  // list: [[값, 무게], ...]
  let t = 0;
  for (const [, w] of list) t += w;
  let x = rnd() * t;
  for (const [v, w] of list) { x -= w; if (x <= 0) return v; }
  return list[list.length - 1][0];
}
export function shuffle(rnd, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
