// 건물 하나의 짜임 (v0.9): 바깥 부피 → 층 쌓기 → 층마다 쓰임(섞어 쓰는 큰 건물은 낮은층·중간층·높은층·설비층·특별층) →
// 조직(가게 연쇄점·회사·병원…) → 빛깔과 무늬. 처음 들어갈 때 한 번 만들고 저장한다(같은 건물은 늘 같은 짜임).
//  · 층 높이는 쓰임으로 정하되(로비·매장·공장·공연장은 높게, 사무·주거는 한 모듈) 바깥 외벽의 층 띠(창 격자)에 맞춘다.
//  · 바깥보다 큰 실내는 없다: 층마다 바닥~천장의 모든 높이에서 바깥벽 안쪽인 칸만 쓴다.
//  · 위로 좁아지는 건물은 아래 부피의 지붕이 위층의 테라스가 된다(바깥에서 보이는 단 = 안에서 나갈 수 있는 단).
//  · 순서는 건물마다 다르지만 아무렇게나 섞지 않는다: 가게·공공은 아래, 사무·연구는 가운데, 주거·호텔은 위, 전망·식당은 꼭대기.
import { TALLEST, HEADROOM } from '../data/body.js';
import { volumeOf, gridOf, maskOf, sdfAt, FLH, BAY, CELL, cellX, cellZ } from './volume.js';
import { FUSE } from './catalog.js';
import { uidOf, seedOf, rngFor, pick, weighted, shuffle, GEN_VERSION } from './ids.js';
import { ORG_POOLS, BRAND_PALS, MOTIFS, SIGNS } from '../data/orgs.js';
import { SPEC } from '../world/city-arch.js';
import { planCore } from './core.js';
import { layoutFloor, narrowMain } from './layout.js';
import { hashStr } from '../core/noise.js';

export const SLAB = 0.35; // 바닥판 두께
const MIN_CELLS = 10; // 이보다 작은 층은 쓰지 않는다 (첨탑 끝)
/** 실내 천장의 가장 낮은 높이 (m): 서서 2 m 뛰어올라도(머리 1.75 m) 머리가 천장에 닿을 뿐 뚫지 않고, 가구 위에 서도 넉넉하게 —
 *  바깥 외벽의 층 띠가 낮은 건물(2.2~2.6 m)도 실내는 이만큼 (실내는 바깥 부피에 끌려가지 않는다 · v24) */
// 실내 천장의 가장 낮은 높이: 가장 큰 주민(아웬, 3.29 m) + 여유 — 사람 키(1.75 m)가 아니라 그 공간을 쓰는 가장 큰 몸이 기준 (v24 · 전에는 3.1 m 라 큰 주민의 머리가 천장을 뚫었다).
//  사람의 제자리 점프 꼭대기(머리 3.52 m)도 이 아래 — 점프해도 천장에 머리를 박지 않는다.
export const MIN_CEIL = Math.ceil((TALLEST + HEADROOM) * 10) / 10; // 3.7
/** 쓰임마다 1층 덮개의 가장 깊은 안쪽(바깥벽에서 칸 수)이 이만큼은 되어야 방이 찌그러지지 않는다:
 *  고리형(심 + 복도 + 양쪽 방) 8 · 넓은 홀 5 · 작은 집·정원 4 */
const NEED_DEPTH = { office: 8, lab: 8, admin: 8, hotel: 8, heal: 8, school: 8, market: 5, cafe: 5, hall: 5, factory: 5, depot: 5, museum: 5, library: 5, terminal: 5, plant: 5, garden: 4, farm: 4 };
/**
 * 실내 평면 배율 S (v24): 바깥 1층 덮개의 가장 깊은 안쪽이 쓰임에 필요한 깊이보다 얕으면 가로·세로를 넓혀 짓는다 (최대 3배).
 * 큰 건물은 1 (바깥 모양 그대로). 방을 바깥 크기에 맞추려 찌그러뜨리는 것보다 넉넉한 독립 공간을 먼저 (문서 원칙 10).
 */
export function interiorScale(r, pid) {
  if (typeof process !== 'undefined' && process.env && process.env.SEREN_S1) return 1; // 검사 도구: 배율 없이 견주기
  const V1 = volumeOf(r, 1), G1 = gridOf(V1);
  const m = maskOf(V1, G1, V1.floorY, V1.floorY + 2.7).m;
  const { gw, gh } = G1, n = gw * gh;
  const d = new Int16Array(n).fill(-1), q = [];
  for (let c = 0; c < n; c++) if (!m[c]) { d[c] = 0; q.push(c); }
  for (let h = 0; h < q.length; h++) {
    const c = q[h], i = c % gw, j = (c / gw) | 0;
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ii = i + a, jj = j + b;
      if (ii < 0 || jj < 0 || ii >= gw || jj >= gh) continue;
      const e = jj * gw + ii;
      if (d[e] < 0) { d[e] = d[c] + 1; q.push(e); }
    }
  }
  let dmax = 0;
  for (let c = 0; c < n; c++) if (m[c] && d[c] > dmax) dmax = d[c];
  const tall = (r.top - r.gy) > 24;
  const need = pid === 'home' ? (tall ? 7 : 4) : NEED_DEPTH[pid] ?? 6;
  if (dmax >= need) return 1;
  return Math.min(3, Math.ceil((need / Math.max(1, dmax)) * 4) / 4);
}


// ── 층 쌓기 ───────────────────────────────────────────────
/**
 * 바깥 외벽의 층 띠에 맞춰 층 자리(slot)를 쌓는다. 1층은 상가 띠(두 모듈) 높이, 그 위는 한 모듈씩.
 * 반환: [{ y(바닥), h(층 높이), ceil(천장), mod, ftype, mask, n }]
 */
export function stackSlots(r, V, G, prof, opt = {}) {
  const sy = Math.max(1, V.top - V.base);
  const band = (y) => Math.min(19, Math.max(0, Math.floor(((y - V.base) / sy) * 20)));
  const modAt = (y) => FLH[prof[band(y)]] || opt.defMod || 3.6;
  const L0 = V.base + 1.35; // 외벽 층 띠의 기준 = 1층 바닥 (materials.js facade 와 같다)
  const out = [];
  const cache = new Map();
  let y = V.floorY;
  const groundMods = opt.groundMods || 1;
  for (let guard = 0; guard < 200; guard++) {
    const m = modAt(y + 1);
    const minH = out.length === 0 ? m * groundMods - 0.4 : 2.9;
    let next = L0 + Math.ceil((y + minH - L0) / m - 1e-6) * m;
    if (next - y < 2.9) next += m;
    // 부피가 층 사이에서 시작하면(버섯 갓·후광·하늘 정원의 단) 그 부피 바닥에 층을 맞춘다:
    //  바로 위면 층을 조금 높이고, 층 가운데에서 큰 부피가 시작하면 이 층을 거기서 끝낸다
    let snapped = false;
    for (const C of V.cols) {
      const big = (C.t === 'c' ? Math.PI * C.r * C.r : 4 * C.hx * C.hz) > 40;
      if (!big) continue;
      if (C.y0 > next - 0.05 && C.y0 < next + 1.7 && C.y0 - y > 2.9) next = Math.max(next, C.y0 + 0.02);
      else if (C.y0 > y + 2.55 && C.y0 < next - 0.05) { next = C.y0 + 0.02; snapped = true; }
    }
    // 공중다리 바닥: 그 높이가 꼭 한 층의 바닥이 되게 (바로 위면 이 층을 늘리고, 층 가운데면 거기서 끊는다)
    for (const cy of opt.cuts || []) {
      if (cy > next - 0.05 && cy < next + 1.7 && cy - y > 2.9) next = cy;
      else if (cy > y + 2.55 && cy < next - 0.05) { next = cy; snapped = true; }
      else if (cy >= next + 1.7 && cy < next + 2.6) { // 다음 층이 너무 낮아지지 않게: 둘로 나누거나(둘 다 2.65 m 넘으면) 이 층을 높인다
        if ((cy - y) / 2 >= 2.65) { next = (y + cy) / 2; snapped = true; } else next = cy;
      }
    }
    let ceil = next - SLAB;
    if (y + 2.5 > V.top - 0.15) break;
    if (ceil > V.top - 0.15) ceil = V.top - 0.15; // 맨 위층: 지붕 아래까지
    if (ceil - y < (snapped ? 2.2 : 2.4)) break;
    // 둥근 지붕 아래 층: 천장이 지붕을 따라 둥글다 (머리 위 2.7 m 가 비는 칸까지 바닥)
    let vault = false;
    for (const C of V.cols) if (C.dome > 0 && C.y1 - C.dome < ceil && C.y1 > y && C.y0 < y + 0.5) vault = true;
    // 같은 부피 묶음·같은 둥근 지붕 높이면 덮개를 다시 쓴다 (탑의 가운데 층들)
    let key = '';
    for (let k = 0; k < V.cols.length; k++) {
      const C = V.cols[k];
      if (C.y1 <= y || C.y0 >= ceil) continue;
      key += k + (C.y0 > y || C.y1 < ceil ? `(${C.y0.toFixed(1)},${C.y1.toFixed(1)})` : '') + (C.dome && ceil > C.y1 - C.dome ? `d${ceil.toFixed(1)}` : '') + ',';
    }
    if (vault) key += `v${y.toFixed(2)}`;
    let mk = cache.get(key);
    if (!mk) { mk = maskOf(V, G, y, vault ? Math.min(ceil, y + 2.7) : ceil); cache.set(key, mk); }
    out.push({ y, h: next - y, ceil, mod: m, ftype: prof[band(y + 1)], mask: mk.m, n: mk.n, vault });
    y = next;
  }
  // 맨 위의 아주 작은 층(첨탑 끝)은 버린다. 가운데의 작은 층(버섯 집 줄기 같은)은 둔다 — 위에 큰 층이 있으니
  while (out.length > 1 && out[out.length - 1].n < MIN_CELLS) out.pop();
  return out;
}

// ── 크기 ─────────────────────────────────────────────────
function sizeClass(gfa, n) {
  if (gfa < 160) return 'tiny';
  if (gfa < 650) return 'small';
  if (gfa < 3200 || n <= 3) return 'medium';
  if (gfa < 16000) return 'large';
  return 'huge';
}

/** 겹치는 칸 수 */
function overlap(a, b) { let n = 0; for (let i = 0; i < a.length; i++) if (a[i] && b[i]) n++; return n; }

// ── 쓰임 짜기 ─────────────────────────────────────────────
/**
 * slots(지상 층 자리) → 층마다 쓰임. pid = 건물의 주된 쓰임(interiors.info).
 * 반환: { uses: [쓰임 id 또는 {use, merge}…], basements: [쓰임…], atrium, notes }
 */
function decideUses(pid, slots, ctx, rnd) {
  const N = slots.length;
  const areas = slots.map((s) => s.n);
  const gfa = areas.reduce((a, b) => a + b, 0);
  const size = sizeClass(gfa, N);
  const A0 = areas[0] || 1;
  const typ = areas.slice().sort((a, b) => a - b)[Math.floor(N / 2)] || A0;
  const dist = ctx.district || 'capital';
  const commerce = ['commerce', 'capital', 'highrise', 'transit', 'glass'].includes(dist);
  const uses = new Array(N).fill(null);
  const basements = [];
  const notes = { size, gfa, typ };
  let atrium = null;
  // 기단(podium): 아래층이 위층보다 훨씬 넓으면 그 층들은 상가·공공
  let podium = 0;
  for (let k = 0; k < N - 2; k++) if (areas[k] > typ * 1.45 && areas[k] > 260) podium = k + 1; else break;
  const top = N - 1;
  const fill = (from, to, u) => { for (let k = Math.max(0, from); k <= Math.min(top, to); k++) if (!uses[k]) uses[k] = u; };
  /** 설비층: 큰 건물은 대략 14층마다 한 층 (짜임의 경계 바로 위·아래는 피한다) */
  const techEvery = (from, to) => { if (N < 16) return; const step = 13 + Math.floor(rnd() * 4); for (let k = from + step; k < to - 2; k += step) uses[k] = 'tech'; };
  /** 큰 탑: 아래는 사무, 위는 주거·호텔 (순서는 건물마다) */
  const towerMix = (main, from) => {
    const span = top - from + 1;
    if (span < 8 || size === 'medium') { fill(from, top, main); return; }
    const opts = main === 'office'
      ? [['office', 'hotel'], ['office', 'residential'], ['office', 'research', 'residential'], ['office'], ['office', 'hotel', 'residential']]
      : main === 'residential' ? [['residential'], ['office', 'residential'], ['hotel', 'residential'], ['residential', 'hotel']]
        : [[main]];
    const seq = size === 'huge' ? pick(rnd, opts) : rnd() < 0.55 ? [main] : pick(rnd, opts.slice(0, 3));
    const n = seq.length;
    // 사이마다 하늘 쉼터(전환층)
    let k = from;
    for (let i = 0; i < n; i++) {
      const len = i === n - 1 ? top - k + 1 : Math.max(3, Math.round(span * (seq[i] === 'office' ? 0.5 : 0.35)));
      fill(k, k + len - 1, seq[i]);
      k += len;
      if (i < n - 1 && k <= top - 2) { uses[k] = 'amenity'; k++; }
    }
    techEvery(from, top);
  };
  const roofUse = () => {
    if (N >= 12 && slots[top].n >= 40) uses[top] = rnd() < 0.5 ? 'observation' : 'amenity';
  };
  const wantBase = (gfa > 1800 && N >= 4) || (gfa > 2500 && ['market', 'depot', 'factory', 'museum', 'library', 'heal', 'plant'].includes(pid));
  // ── 전문 건물: 한 기관이 건물 전체를 쓴다 (실제 시설처럼 층마다 그 기관의 다른 기능) ──
  const deps = new Array(N).fill(null);
  if (ctx.special && size !== 'tiny' && size !== 'small' && N >= 2) {
    let done = true;
    switch (pid) {
      case 'bank': { // 은행 (v24): 1층 영업장(창구·셀프 금융 단말·상담실·금고실·기록실·관리실) → 위층은 그 은행의 사무
        uses[0] = 'bank';
        fill(1, top, 'office');
        if (N >= 6) uses[top] = 'exec';
        if (gfa > 1800) basements.push('parking');
        notes.special = '은행';
        break;
      }
      case 'heal': { // 종합 치유원: 응급·접수 → 외래 진료 → 검사·영상 → (행정) → 병동 → 회복 정원
        uses[0] = 'care';
        const cl = Math.max(1, Math.round(N * 0.22));
        fill(1, cl, 'clinic');
        const d = cl + 1;
        if (d <= top) uses[d] = 'diag';
        if (N >= 8 && d + 1 < top) uses[d + 1] = 'office';
        fill(d + 1, top, 'ward');
        techEvery(d + 2, top);
        if (N >= 6) uses[top] = 'garden';
        basements.push('supply');
        if (gfa > 2500) basements.push('parking');
        notes.special = '종합 치유원';
        break;
      }
      case 'school': { // 학교 한 채 (높이에 상관없이 학교만): 체육관·강당 → 도서층 → 급식층 → 교실층(짝수층 과학실·홀수층 노래실) → 교무·행정층 → 교실층 → 강당
        if (N >= 16) techEvery(3, top); // 설비층 먼저 — 아래 학교 시설이 겹치면 그 층은 학교 시설로
        uses[0] = slots[0].h >= 6.5 || N <= 2 ? 'schoolhall' : 'school';
        if (N >= 3) uses[1] = 'library';
        if (N >= 7) uses[2] = 'canteen';
        if (N >= 10) { let f = Math.floor((3 + top) / 2); if (uses[f] === 'tech') f++; uses[f] = 'faculty'; }
        if (N >= 20) { let l = Math.floor(top * 0.78); if (uses[l] === 'tech') l--; uses[l] = 'library'; } // 큰 학교는 위쪽에도 배움터(도서·자습)
        if (N >= 6) uses[top] = 'schoolhall';
        fill(1, top, 'school');
        notes.special = '학교';
        break;
      }
      case 'office': { // 한 회사의 본사: 로비 → 사원 식당 → 사무 → 회의·교육층 → 사무 → 임원층
        uses[0] = 'lobby';
        if (N >= 4) uses[1] = 'food';
        if (N >= 8) uses[Math.floor((2 + top) / 2)] = 'confer';
        if (N >= 5) uses[top] = 'exec';
        fill(1, top, 'office');
        techEvery(2, top);
        if (wantBase) basements.push('parking');
        if (N > 24) basements.push('tech');
        if (N > 6 && rnd() < 0.5) atrium = { from: 0, to: 1 };
        notes.special = '본사';
        break;
      }
      case 'lab': { // 연구원 한 곳: 로비 → 연구층 → 회의·교육 → 연구층 → 연구 행정
        uses[0] = 'lobby';
        if (N >= 6) uses[Math.floor(N / 2)] = 'confer';
        if (N >= 4) uses[top] = 'office';
        fill(1, top, 'research');
        if (wantBase || N >= 4) basements.push('supply');
        notes.special = '연구원';
        break;
      }
      case 'market': { // 대형 마트 한 곳: 층마다 다른 매장(식품관 → 생활 → 도구 → 옷·선물), 꼭대기는 같은 회사의 식당가
        // 매장은 넷까지(식품관·생활·도구·옷과 선물) → 식당가 → (높으면) 상품 창고층 → 그 회사 본사 사무 → 임원층
        uses[0] = 'mart'; deps[0] = 'food';
        const D3 = ['living', 'craft', 'fashion'];
        const salesTop = Math.min(top - (N >= 3 ? 1 : 0), 3);
        for (let k = 1; k <= salesTop; k++) { uses[k] = 'mart'; deps[k] = D3[(k - 1) % 3]; }
        if (N >= 3) uses[salesTop + 1] = 'food';
        if (top > salesTop + 2) uses[salesTop + 2] = 'storage';
        if (top > salesTop + 3) { fill(salesTop + 3, top, 'office'); if (top - salesTop > 6) uses[top] = 'exec'; techEvery(salesTop + 3, top); }
        basements.push('parking');
        if (gfa > 4000) basements.push('parking');
        notes.special = '본점';
        break;
      }
      case 'depot': // 물류 센터: 큰 창고 홀 + 위 창고층들 + 꼭대기 사무
        uses[0] = 'storage'; fill(1, top - 1, 'storage'); uses[top] = N >= 3 ? 'office' : 'storage';
        notes.special = '물류 센터';
        break;
      case 'factory': // 공장 단지: 큰 생산동 + 위 조립층 + 꼭대기 사무
        uses[0] = 'factory'; fill(1, top - 1, 'factory'); uses[top] = N >= 3 ? 'office' : 'factory';
        basements.push('supply');
        notes.special = '공장 단지';
        break;
      case 'terminal': // 교통 거점: 대합실 + 같은 공사의 식당·상점 + 사무
        uses[0] = 'transit'; if (N >= 2) uses[1] = 'food'; if (N >= 3) uses[2] = 'shops'; fill(3, top, 'office');
        notes.special = '교통 거점';
        break;
      case 'farm': // 농업 단지: 직판장(마트) + 재배층들
        uses[0] = N >= 3 ? 'mart' : 'farm'; deps[0] = 'food'; fill(1, top, 'farm');
        notes.special = '농업 단지';
        break;
      case 'hotel': // 호텔 한 곳: 로비 → 호텔 식당 → 쉼터 → 객실 → 전망
        uses[0] = 'hotelfront'; if (N > 4) uses[1] = 'food'; if (N > 8) uses[2] = 'amenity';
        fill(1, top, 'hotel'); techEvery(3, top); if (N >= 12) uses[top] = 'observation';
        if (wantBase) basements.push('supply');
        notes.special = '호텔';
        break;
      default: done = false;
    }
    if (done) {
      tinyFloors(slots, uses);
      return { uses, basements, atrium, notes, podium, deps, special: notes.special };
    }
  }

  switch (pid) {
    case 'home': {
      if (size === 'tiny' || size === 'small' || ctx.custom) { fill(0, top, 'house'); break; }
      uses[0] = 'lobby';
      if (podium) fill(1, podium - 1, commerce ? 'shops' : 'amenity');
      if (N >= 6 && !podium && rnd() < 0.5) uses[1] = 'amenity';
      towerMix('residential', Math.max(1, podium));
      if (N >= 18) roofUse();
      if (wantBase) basements.push('parking');
      if (N > 30) basements.push('tech');
      if (size === 'large' || size === 'huge') atrium = rnd() < 0.3 ? { from: 0, to: 1 } : null;
      break;
    }
    case 'hotel': {
      if (N <= 2) { uses[0] = 'hotelfront'; fill(1, top, 'hotel'); break; }
      uses[0] = 'hotelfront';
      fill(1, Math.max(1, podium - 1), N > 6 ? 'food' : 'hotel');
      if (N > 8) uses[Math.max(2, podium)] = 'amenity';
      fill(2, top, 'hotel');
      techEvery(2, top);
      if (N >= 14) uses[top] = 'observation';
      if (wantBase) basements.push('supply');
      atrium = N > 4 && rnd() < 0.5 ? { from: 0, to: Math.min(3, N - 2) } : null;
      break;
    }
    case 'office': case 'lab': case 'admin': {
      const main = pid === 'office' ? 'office' : pid === 'lab' ? 'research' : 'admin';
      if (size === 'tiny' || size === 'small') { uses[0] = pid === 'admin' ? 'civic' : main; fill(1, top, main); break; }
      uses[0] = pid === 'admin' ? 'civic' : 'lobby';
      if (podium) fill(1, podium - 1, commerce ? (rnd() < 0.5 ? 'food' : 'shops') : pid === 'lab' ? 'research' : 'food');
      else if (N >= 6 && commerce && rnd() < 0.45) uses[1] = 'food';
      if (pid === 'office' && N > 8) towerMix('office', Math.max(1, podium) + (uses[1] ? 1 : 0));
      else {
        fill(1, top, main);
        if (pid === 'lab' && N >= 5) uses[top] = 'research';
        if (pid === 'admin' && N >= 3) uses[top] = 'hall'; // 의회실
      }
      if (pid !== 'admin') roofUse();
      if (wantBase) basements.push(pid === 'lab' ? 'supply' : 'parking');
      if (N > 24) basements.push('tech');
      if (N > 6 && rnd() < 0.4) atrium = { from: 0, to: 1 };
      break;
    }
    case 'market': {
      // 옷가게 (v24): 작은 가게 건물 셋 중 하나쯤은 옷가게, 중간 건물은 위층 상가 대신, 큰 백화점은 한 층을 옷 매장으로
      if (size === 'tiny' || size === 'small') { uses[0] = rnd() < 0.32 ? 'clothes' : 'mart'; fill(1, top, rnd() < 0.6 ? 'residential' : 'office'); if (N === 2 && slots[1].n < 60) uses[1] = 'house'; break; }
      if (size === 'medium') {
        uses[0] = 'mart';
        if (N >= 2) uses[1] = rnd() < 0.5 ? (rnd() < 0.5 ? 'clothes' : 'shops') : 'food';
        fill(2, top, rnd() < 0.5 ? 'office' : 'residential');
        if (wantBase) basements.push('supply');
        break;
      }
      // 큰 가게: 지하 식품관 + 층마다 백화점 칸 + 위 식당가·공연(영화) · 그 위는 사무/주거
      const retailTop = Math.min(top, Math.max(podium - 1, Math.min(5, N - 1)));
      basements.push('mart');
      uses[0] = 'dept';
      fill(1, retailTop - 1, 'dept');
      if (retailTop >= 3) uses[retailTop - 1] = 'clothes';
      if (retailTop >= 1) uses[retailTop] = 'food';
      if (top > retailTop + 2) { if (rnd() < 0.4) uses[retailTop + 1] = 'hall'; towerMix(rnd() < 0.5 ? 'office' : 'residential', retailTop + 1); }
      else fill(retailTop + 1, top, 'dept');
      basements.push('parking');
      atrium = { from: 0, to: Math.min(retailTop, 3) };
      break;
    }
    case 'cafe': {
      uses[0] = 'cafe';
      if (N >= 2) uses[1] = size === 'small' || size === 'tiny' ? (slots[1].n < 60 ? 'house' : 'cafe') : 'food';
      fill(2, top, rnd() < 0.6 ? 'residential' : 'office');
      break;
    }
    case 'school': {
      if (size === 'tiny' || size === 'small') { fill(0, top, 'school'); break; }
      uses[0] = slots[0].h >= 6.5 || N <= 2 ? 'schoolhall' : 'school';
      fill(1, top, 'school');
      if (N >= 3) uses[1] = 'library';
      break;
    }
    case 'heal': {
      // 생활권 병원(r.hospital): 작아도 입원실을 둔다 — 한 층이면 응급·입원(carew), 두 층 넘으면 위층이 병동
      if (ctx.hospital && (size === 'tiny' || size === 'small')) { uses[0] = N === 1 ? 'carew' : 'care'; fill(1, top, 'ward'); break; }
      if (size === 'tiny' || size === 'small') { uses[0] = 'care'; fill(1, top, 'clinic'); break; }
      uses[0] = 'care';
      const wardFrom = Math.max(2, Math.floor(N * 0.45));
      fill(1, wardFrom - 1, 'clinic');
      fill(wardFrom, top, 'ward');
      techEvery(1, top);
      if (N >= 8) uses[top] = 'garden'; // 회복 정원
      if (wantBase) basements.push('supply');
      break;
    }
    case 'bank': uses[0] = 'bank'; fill(1, top, 'office'); break; // 작은 은행 지점
    case 'library': uses[0] = 'library'; fill(1, top, 'library'); if (wantBase || N >= 3) basements.push('supply'); break;
    case 'museum': uses[0] = 'museum'; fill(1, top, 'museum'); if (wantBase || N >= 3) basements.push('supply'); break;
    case 'hall': uses[0] = 'hall'; fill(1, top, N > 3 ? 'office' : 'hall'); break;
    case 'factory': uses[0] = 'factory'; fill(1, top, 'office'); break;
    case 'depot': uses[0] = 'storage'; fill(1, top, 'office'); break;
    case 'terminal': uses[0] = 'transit'; fill(1, top, N > 3 ? 'office' : 'food'); break;
    case 'plant': uses[0] = 'plant'; fill(1, top, 'tech'); basements.push('supply'); break;
    case 'farm': uses[0] = N === 1 ? 'farm' : 'mart'; fill(1, top, 'farm'); if (N > 1 && slots[0].n > 300) uses[0] = 'farm'; break;
    case 'garden': uses[0] = 'garden'; fill(1, top, N > 4 ? 'office' : 'garden'); if (N >= 3) uses[top] = 'observation'; break;
    default: fill(0, top, 'office');
  }
  tinyFloors(slots, uses);
  return { uses, basements, atrium, notes, podium, deps, special: null };
}
/**
 * 아주 작은 층(버섯 집의 줄기, 둥근 지붕 아래 다락)은 현관·다락으로 — 단, 건물에 쓰임을 담을 큰 층이 따로 있을 때만.
 * 건물 전체가 작으면(작은 둥근 서고·가게) 1층이 본래 쓰임을 지킨다: 밖에서 「서고」인 건물이 안에서 남의 현관이 되지 않게.
 */
// 쓰임마다 층이 이만큼은 되어야 그 쓰임의 핵심 가구(recipes.ESSENTIAL: 서고의 안내대·서가 셋·찾기 단말, 공장의 기계, 창고의 큰 선반,
// 재배실의 재배 선반 둘, 매장의 계산대·진열대 둘 …)가 놓이고 사람이 지나간다 — 작은 탑의 심(나선 계단 + 작은 승강기, 약 8칸)을 빼고 약 30 m².
// 가늘어지는 첨탑 끝의 층처럼 이보다 작으면 그 층은 설비층(맨 위면 전망층)으로.
const FLOOR_MIN = { clothes: 30, library: 40, farm: 40, factory: 40, storage: 40, hall: 40, schoolhall: 40, museum: 36, school: 36, mart: 36, shops: 36, dept: 36, food: 36, cafe: 36, canteen: 36, care: 36, civic: 36, transit: 36, plant: 36 };
function tinyFloors(slots, uses) {
  const N = slots.length;
  const big = Math.max(0, ...slots.map((s) => s.n));
  for (let k = 0; k < N; k++) {
    if (uses[k] === 'house') continue;
    if (slots[k].n >= Math.max(k === 0 ? 40 : 24, FLOOR_MIN[uses[k]] || 0)) continue;
    if (k === 0 && big < 60) continue;
    uses[k] = k === 0 ? 'stem' : k === N - 1 && slots[k].n >= 24 ? 'observation' : 'tech';
  }
}

// ── 조직 ───────────────────────────────────────────────────
function orgFor(op, r, seed, k) {
  const P = ORG_POOLS[op] || ORG_POOLS.office;
  const rz = rngFor(hashStr(`${r.zone}|${op}`), 'chain'); // 구역의 연쇄점은 구역마다 정해진 몇
  const rb = rngFor(seed, `org${k}`);
  let name;
  if (P.chain) {
    const local = shuffle(rz, P.chain).slice(0, Math.max(2, Math.ceil(P.chain.length * 0.6)));
    name = pick(rb, local) + pick(rb, P.suffix || ['']);
  } else name = pick(rb, P.pre) + pick(rb, P.post);
  const h = hashStr(name);
  return { id: `${op}:${name}`, op, name, pal: BRAND_PALS[h % BRAND_PALS.length], motif: MOTIFS[(h >> 4) % MOTIFS.length], sign: SIGNS[(h >> 8) % SIGNS.length] };
}

// ── 빛깔·무늬 ───────────────────────────────────────────────
// 쓰임마다 어울리는 빛깔 묶음: [벽, 바닥, 따뜻, 서늘, 부드러운, 잎]
const FAMILY = {
  home: [[0xf2e8dc, 0x9a8270, 0xffc890, 0x9fd8e8, 0xf6dce4, 0x8fcf9a], [0xece6f0, 0x8a7f96, 0xffd2a0, 0xa8d8ff, 0xe8d8f6, 0x9fd8a8], [0xf4ece0, 0xa88c6c, 0xffb880, 0x9ee8d8, 0xffe0cc, 0xa8e08a]],
  office: [[0xeef0f2, 0x6f7480, 0xffe0b0, 0xa8d8ff, 0xe6ecf4, 0x9fd8a8], [0xf2f0ea, 0x7d7a86, 0xffd8a8, 0x9ff6ff, 0xeee8f0, 0x8fcf9a], [0xe8ecee, 0x5c6470, 0xffe6c0, 0xb8e0ff, 0xdfe8f0, 0xa0e0b0]],
  lab: [[0xf4f8fa, 0xb8c4cc, 0xfff0d8, 0x9ff6ff, 0xe8f4ff, 0x9fe8c0], [0xeef4f8, 0xa0b0bc, 0xffe8c8, 0xa8e8ff, 0xe0f0fa, 0x90e0b8]],
  clinic: [[0xf6f8f6, 0xc0ccc8, 0xfff2e0, 0xa8f0e8, 0xe8f6f2, 0xa8e8b8], [0xf4f6fa, 0xb0bccc, 0xfff0e0, 0xb0e0ff, 0xe8eef8, 0xa0e0c0]],
  mart: [[0xf4f2ee, 0xb8b2a8, 0xffd8a0, 0xa8e8ff, 0xf6eee6, 0x9fe08a], [0xf2f4f0, 0xa8aca4, 0xffe0a8, 0x9ff6ff, 0xeef4e8, 0xb0e890]],
  food: [[0xf2e6d8, 0x8c6c54, 0xffb870, 0xa8d8e8, 0xffe4cc, 0x9fd88a], [0xf0e2dc, 0x7c5c50, 0xffa878, 0xb8d8e0, 0xffdcd0, 0xa8d890]],
  school: [[0xf6f0e2, 0xb09a7c, 0xffc878, 0x8fd8ff, 0xffe8d0, 0x9fe88a], [0xf2f2e6, 0xa8a080, 0xffd070, 0xa0e0ff, 0xf0f0d8, 0xb0e880]],
  museum: [[0xe8e2d8, 0x4c4652, 0xe9c27c, 0x9fb8d8, 0xe0d8e8, 0x8fbf9a], [0xdedad4, 0x3e3a44, 0xf0c890, 0xa8c0e0, 0xd8d0e0, 0x88b898]],
  library: [[0xf0e6d6, 0x7c624c, 0xffd090, 0xa8c8e0, 0xf4e4d0, 0x98c890], [0xece2d4, 0x6c5848, 0xffc888, 0xb0c8e0, 0xf0e0d0, 0x90c088]],
  hall: [[0xe8dce4, 0x5a3a52, 0xffb0c8, 0xb0a8ff, 0xf0d8e8, 0x98c8a0], [0xe4dcec, 0x46385a, 0xffc0a0, 0xa8b0ff, 0xe8d8f0, 0x90c0a0]],
  admin: [[0xeeece6, 0x6c7080, 0xe9c27c, 0xa8c8f0, 0xe6e8ee, 0x98c8a0], [0xecebe8, 0x5c6274, 0xf0d090, 0xa0c0f0, 0xe4e6ec, 0x90c098]],
  hotel: [[0xf2e8e0, 0x6c5058, 0xffc8a0, 0xa8c8e8, 0xf6e0e8, 0x98c898], [0xece4ec, 0x584868, 0xffd0b0, 0xb0c0f0, 0xf0e0f0, 0x98c8a0]],
  factory: [[0xd8dce0, 0x5a6068, 0xffc46a, 0x8fd8ff, 0xdfe2e6, 0x9fd08a], [0xd4d8dc, 0x50585e, 0xffb050, 0x9fe8ff, 0xd8dce0, 0x98c880]],
  depot: [[0xdcdcd8, 0x60645e, 0xffc060, 0x9fd8ff, 0xe0e0dc, 0x9fd08a]],
  terminal: [[0xeef0f4, 0x7a8090, 0xffd890, 0x9ff6ff, 0xe6ecf6, 0x9fd8a8], [0xf0eeea, 0x6c7078, 0xffe0a0, 0xa8e8ff, 0xeeeae6, 0xa0d8a0]],
  farm: [[0xe8f0e2, 0x6c7a5c, 0xffd890, 0xa8e8d8, 0xeef6e0, 0x7fd06a], [0xe2ece0, 0x5c6e58, 0xffe0a0, 0x9fe8e0, 0xe8f2e0, 0x6fc85a]],
  garden: [[0xeef4e8, 0x6a7c60, 0xffd8a0, 0xa8e8e0, 0xf0f6e8, 0x7fd06a]],
  plant: [[0xd0d6dc, 0x4a5058, 0xffb860, 0x9ff6ff, 0xd8dce2, 0x9fd08a]],
  tech: [[0xd8dce0, 0x5a6068, 0xffc46a, 0x9fd8ff, 0xdfe2e6, 0x9fd08a]],
};
const DISTRICT_TINT = {
  capital: 0xe9c27c, commerce: 0xffb36b, transit: 0x8fc4ff, residential: 0xffc890, research: 0x9ff6ff, energy: 0xffc46a,
  bioindustry: 0xb4f07a, highrise: 0xc8d8ff, garden: 0x9fe08a, suburb: 0xffd0a0, village: 0xffd8a8, glass: 0xbff8ff,
  bloom: 0xff9fd0, canyon: 0xff9f7a, sea: 0x8ff0e0, frost: 0xd8f0ff,
};
const OP_FAMILY = { lobby: 'office', mart: 'mart', clothes: 'mart', bank: 'office', food: 'food', office: 'office', lab: 'lab', clinic: 'clinic', school: 'school', library: 'library', museum: 'museum', hall: 'hall', admin: 'admin', home: 'home', hotel: 'hotel', factory: 'factory', depot: 'depot', terminal: 'terminal', farm: 'farm', garden: 'garden', plant: 'plant', tech: 'tech', parking: 'tech', amenity: 'hotel', observation: 'hotel', mezz: 'office' };

function styleFor(op, r, seed, org, k) {
  const rnd = rngFor(seed, `style${k}`);
  const fam = FAMILY[OP_FAMILY[op] || 'office'] || FAMILY.office;
  const f = fam[Math.floor(rnd() * fam.length)];
  return {
    wall: f[0], floor: f[1], warm: f[2], cool: f[3], soft: f[4], leaf: f[5],
    brand: org ? org.pal[0] : f[2], brand2: org ? org.pal[1] : f[0], glow: org ? org.pal[2] : f[3],
    tint: DISTRICT_TINT[r.style] || 0xe9c27c,
    floorPat: Math.floor(rnd() * 4), wallPat: Math.floor(rnd() * 4), ceilPat: Math.floor(rnd() * 3),
    furn: pick(rnd, ['round', 'facet', 'organic']),
    plants: 0.2 + rnd() * 0.8,
    light: pick(rnd, ['warm', 'neutral', 'cool', 'warm']),
    motif: org ? org.motif : pick(rnd, MOTIFS), sign: org ? org.sign : pick(rnd, SIGNS),
  };
}

// ── 테라스·지붕 ───────────────────────────────────────────
/**
 * 위층 F 의 바닥 높이 둘레에서, 아래 부피의 평평한 지붕(바깥에서 보이는 단)이 F 바닥과 거의 같은 높이면 그 칸들이 F 의 테라스.
 * 반환: { mask, y(지붕 높이), n } 또는 null
 */
function terraceOf(V, G, F, prevMask) {
  const m = new Uint8Array(G.gw * G.gh);
  let n = 0, ySum = 0;
  for (let j = 0; j < G.gh; j++) for (let i = 0; i < G.gw; i++) {
    const c = j * G.gw + i;
    if (F.mask[c]) continue;
    const x = cellX(G, i), z = cellZ(G, j);
    // 그 칸 위로 솟은 부피의 평평한 윗면
    let topY = -1e9;
    for (const C of V.cols) {
      if (C.dome) continue;
      if (C.y1 < F.y - 1.6 || C.y1 > F.y + 0.6) continue;
      const d = C.t === 'c' ? Math.hypot(x - C.x, z - C.z) - C.r : (() => { const dx = x - C.x, dz = z - C.z; const lx = dx * C.cs - dz * C.sn, lz = dx * C.sn + dz * C.cs; return Math.max(Math.abs(lx) - C.hx, Math.abs(lz) - C.hz); })();
      if (d < -0.6) topY = Math.max(topY, C.y1);
    }
    if (topY < -1e8) continue;
    // 그 높이 위가 비어 있어야 (다른 부피 속이 아니어야)
    if (sdfAt(V, x, z, topY + 1.2) < 0.2) continue;
    m[c] = 1; n++; ySum += topY;
  }
  if (n < 6) return null;
  // 층과 이어진 테라스 칸만 (층 칸 옆에서 퍼져 나간 덩어리)
  const keep = new Uint8Array(m.length), q = [];
  for (let c = 0; c < m.length; c++) {
    if (!m[c]) continue;
    const i = c % G.gw, j = (c / G.gw) | 0;
    if ((i > 0 && F.mask[c - 1]) || (i < G.gw - 1 && F.mask[c + 1]) || (j > 0 && F.mask[c - G.gw]) || (j < G.gh - 1 && F.mask[c + G.gw])) { keep[c] = 1; q.push(c); }
  }
  while (q.length) {
    const c = q.pop(), i = c % G.gw;
    for (const d of [i > 0 ? -1 : 0, i < G.gw - 1 ? 1 : 0, -G.gw, G.gw]) { const e = c + d; if (d && e >= 0 && e < m.length && m[e] && !keep[e]) { keep[e] = 1; q.push(e); } }
  }
  let kn = 0;
  for (let c = 0; c < keep.length; c++) if (keep[c]) kn++;
  if (kn < 6) return null;
  void prevMask;
  return { mask: keep, y: ySum / n, n: kn };
}

/** 맨 위층 위의 평평한 지붕 (나갈 수 있는 옥상) */
function roofOf(V, G, F) {
  let n = 0, yS = 0, flat = true;
  for (let j = 0; j < G.gh; j++) for (let i = 0; i < G.gw; i++) {
    if (!F.mask[j * G.gw + i]) continue;
    const x = cellX(G, i), z = cellZ(G, j);
    let topY = -1e9, dome = false;
    for (const C of V.cols) {
      const d = C.t === 'c' ? Math.hypot(x - C.x, z - C.z) - C.r : (() => { const dx = x - C.x, dz = z - C.z; const lx = dx * C.cs - dz * C.sn, lz = dx * C.sn + dz * C.cs; return Math.max(Math.abs(lx) - C.hx, Math.abs(lz) - C.hz); })();
      if (d < 0 && C.y1 > topY && C.y0 < F.ceil + 1) { topY = C.y1; dome = C.dome > 0; }
    }
    if (dome) flat = false;
    if (topY > F.ceil - 0.2 && topY < F.ceil + 4.5) { n++; yS += topY; }
  }
  if (!flat || n < Math.max(12, F.n * 0.5)) return null;
  return { y: yS / n, n };
}

// ── 건물 짜임 만들기 ─────────────────────────────────────────
/**
 * r: 건물 기록, ctx: { profile(kind) → 20칸 외벽 종류, pid(r) → 주된 쓰임, district }
 * 반환: 건물 짜임 B (저장 가능한 순수 자료 — 덮개는 Uint8Array)
 */
export function makeBuilding(r, ctx) {
  const pid = ctx.pid(r);
  let S = interiorScale(r, pid);
  let B = buildAt(r, ctx, S);
  // v24 최소 방 크기: 층의 본실·세대 첫 방이 그 쓰임의 최소(정사각형 한 변·넓이)에 못 미치면 실내를 넓혀 다시 짓는다 —
  // 바깥 크기에 맞추려 방을 찌그러뜨리는 것보다 넉넉한 실내가 먼저 (큰 방의 상한은 없다). 쓰임 묶음마다 가장 좁은 층과 첫 층을 본다.
  const probeOff = typeof process !== 'undefined' && process.env && process.env.SEREN_S1;
  // 심도 같다: 층이 높아 작은 나선 계단(2×2)을 못 쓰는데 큰 심이 안 들어가면(B.coreTight) 넓혀 다시
  for (let guard = 0; B && !probeOff && guard < 5 && S < 3 && (B.coreTight || narrowFloors(B) > 0); guard++) {
    S = Math.min(3, S + (S < 1.5 ? 0.25 : 0.5));
    B = buildAt(r, ctx, S);
  }
  return B;
}

/** 본실이 최소에 못 미치는 층 수 (쓰임 묶음마다 첫 층·가장 좁은 층만 짜 본다) */
function narrowFloors(B) {
  let bad = 0;
  for (const Z of B.zones) {
    const fl = B.floors.filter((F) => F.i >= Z.from && F.i <= Z.to && F.reach && !F.dead);
    if (!fl.length) continue;
    const probe = new Set([fl[0], fl.reduce((a, b) => (b.n < a.n ? b : a))]);
    for (const F of probe) if (narrowMain(layoutFloor(B, F, { door: B.door }))) bad++;
  }
  return bad;
}

function buildAt(r, ctx, S) {
  const uid = uidOf(r), seed = seedOf(r);
  const rnd = rngFor(seed, 'program');
  const pid = ctx.pid(r);
  const V = volumeOf(r, S), G = gridOf(V);
  const prof = ctx.profile(r.kind) || new Array(20).fill(1);
  // 1층 높이: 로비·가게·공공 홀은 두 모듈(바깥의 상가 띠), 학교 교실·작은 집은 한 모듈
  const groundMods = pid === 'school' || (pid === 'home' && V.top - V.base < 24) || (pid === 'cafe' && V.top - V.base < 14) || V.top - V.base < 11 ? 1 : 2;
  const cuts = (r.bridges || []).map((b) => b.y);
  const slots = stackSlots(r, V, G, prof, { defMod: pid === 'home' ? 3.3 : 3.6, groundMods, cuts });
  if (!slots.length) return null;
  // 전문 건물인가 (한 기관이 건물 전체): 쓰임마다 비율이 다르다 — 큰 병원·학교·박물관은 대개 전문, 사무·마트는 섞인 건물이 많다
  const SPECIAL_P = { bank: 1, heal: 0.7, school: 0.75, lab: 0.5, office: 0.3, market: 0.35, depot: 0.6, factory: 0.55, terminal: 0.5, farm: 0.6, hotel: 0.55 };
  // 학교는 늘 학교만 쓰는 건물 (섞인 건물에 학교를 넣지 않는다 — 높은 탑이어도 층마다 학교의 다른 시설)
  const special = !r.custom && (pid === 'school' || rngFor(seed, 'special')() < (SPECIAL_P[pid] || 0));
  const D = decideUses(pid, slots, { district: r.style, custom: !!r.custom, special, hospital: !!r.hospital }, rnd);
  // 공중다리가 닿는 층: 건너온 사람을 받는 공용층(하늘 쉼터)으로 — 이미 누구나 드나드는 층이면 그대로
  const bridgeSlot = new Set();
  for (const cy of cuts) {
    const k = slots.findIndex((s) => Math.abs(s.y - cy) < 0.05);
    if (k <= 0) continue;
    bridgeSlot.add(k);
    if (!(FUSE[D.uses[k]] && FUSE[D.uses[k]].pub && FUSE[D.uses[k]].plan === 'open')) { D.uses[k] = 'amenity'; D.deps[k] = null; }
  }
  // 층 합치기: 높은 한 공간(공장·창고·대합실·발전동·낮은 공연장·온실 농장)은 위 자리들을 하나로 — 천장은 그 칸의 바깥 지붕 안쪽
  // (둥근 지붕 아래면 칸마다 높이가 다른 둥근 천장 = vault) + 뒤쪽 벽을 따라 중2층(관제·사무·대기)
  const low = !!(SPEC[r.kind] && SPEC[r.kind].low);
  const floors = [];
  for (let k = 0; k < slots.length; k++) {
    const s = slots[k], use = D.uses[k] || 'office';
    let h = s.h, ceil = s.ceil, mask = s.mask, n = s.n, kk = k, vault = false;
    const bigHall = k === 0 && s.n >= 60 && (['factory', 'storage', 'transit', 'plant'].includes(use) || (low && ['hall', 'farm', 'garden', 'schoolhall'].includes(use)));
    if (bigHall && slots.length > 1) {
      kk = low ? slots.length - 1 : Math.min(slots.length - 1, k + 2);
      for (let t = k + 1; t <= kk; t++) if (D.uses[t] !== use && !['factory', 'storage', 'transit', 'plant', 'hall', 'farm', 'garden', 'schoolhall', 'office', 'tech', 'stem'].includes(D.uses[t])) { kk = t - 1; break; }
      ceil = slots[kk].ceil; h = slots[kk].y + slots[kk].h - s.y;
      const mk = maskOf(V, G, s.y, s.y + 2.7); // 머리 위 2.7 m 가 비면 쓸 수 있는 바닥 (둥근 천장의 가장자리까지)
      mask = mk.m; n = mk.n; vault = true;
    } else if ((use === 'hall' || use === 'schoolhall') && k > 0 && kk + 1 < slots.length && D.uses[kk + 1] !== 'tech' && !bridgeSlot.has(kk + 1)) {
      // 건물 가운데의 공연장(영화관·의회실): 두 층 높이
      const t = slots[kk + 1];
      const m2 = new Uint8Array(mask.length);
      let n2 = 0;
      for (let c = 0; c < mask.length; c++) if (mask[c] && t.mask[c]) { m2[c] = 1; n2++; }
      if (n2 >= n * 0.7) { mask = m2; n = n2; h += t.h; ceil = t.ceil; kk++; }
    }
    floors.push({ y: s.y, h, ceil, mod: s.mod, ftype: s.ftype, mask, n, use, vault: vault || s.vault, dep: D.deps[k] || null });
    // 중2층: 밑을 지나는 주민과 중2층 위의 주민 모두 머리 공간이 남을 때만 (밑: 중2층 바닥판 아래 MIN_CEIL, 위: 중2층 바닥에서 천장까지 MIN_CEIL)
    if (bigHall && ceil - s.y >= 2 * MIN_CEIL + SLAB) {
      const my = s.y + Math.max(MIN_CEIL + SLAB, Math.min(ceil - s.y - MIN_CEIL, Math.max(3.6, Math.min(4.6, (ceil - s.y) * 0.45))));
      const head = maskOf(V, G, my, my + 2.7).m;
      const mm = new Uint8Array(mask.length);
      let mn = 0;
      for (let i = 0; i < G.gw; i++) {
        let j0 = -1;
        for (let j = 0; j < G.gh; j++) if (mask[j * G.gw + i]) { j0 = j; break; }
        if (j0 < 0) continue;
        for (let j = j0; j < j0 + 6 && j < G.gh; j++) { const c = j * G.gw + i; if (mask[c] && head[c]) { mm[c] = 1; mn++; } }
      }
      if (mn >= 24) floors.push({ y: my, h: ceil - my + SLAB, ceil, mod: s.mod, ftype: s.ftype, mask: mm, n: mn, use: 'mezz', mezz: true, vault: true });
    }
    k = kk;
  }
  // 지하: 1층 발자국 그대로(기초), 창 없음
  const base0 = floors[0];
  const bmask = new Uint8Array(base0.mask.length);
  let bn = 0;
  for (let j = 1; j < G.gh - 1; j++) for (let i = 1; i < G.gw - 1; i++) {
    const c = j * G.gw + i;
    if (base0.mask[c] && base0.mask[c - 1] && base0.mask[c + 1] && base0.mask[c - G.gw] && base0.mask[c + G.gw]) { bmask[c] = 1; bn++; }
  }
  const basements = [];
  if (bn >= 60) D.basements.forEach((u, i) => basements.push({ y: V.floorY - 4.2 * (i + 1), h: 4.2, ceil: V.floorY - 4.2 * i - SLAB, mod: 4.2, ftype: 0, mask: bmask, n: bn, use: u, below: true }));
  const all = [...basements.reverse(), ...floors];
  // 층 번호: 지하 B1.. · 지상 1..
  let gi = all.indexOf(base0), lv = 0;
  all.forEach((F, i) => {
    F.i = i;
    if (i < gi) F.label = `B${gi - i}`;
    else if (F.mezz) F.label = `${lv}.5`;
    else { lv++; F.label = `${lv}`; }
  });
  // 실내 높이 (v24): 바깥 층 띠와 따로 — 천장은 MIN_CEIL 이상, 층과 층 사이는 (실내 천장 + 바닥판) 이상.
  //   iy = 1층 바닥에서 이 층 바닥까지의 실내 높이(지하는 음수), ic = 이 층 바닥에서 천장까지. 중2층은 홀 바닥에서 바깥과 같은 높이 차.
  //   바깥과 맞닿는 것(테라스·옥상·공중다리 바닥 높이)은 그대로 F.y·F.ceil 을 쓴다.
  for (const F of all) F.ic = Math.max(F.ceil - F.y, MIN_CEIL);
  {
    let iy = 0, prevF = all[gi];
    all[gi].iy = 0;
    for (let i = gi + 1; i < all.length; i++) {
      const F = all[i];
      if (F.mezz) { F.iy = all[i - 1].iy + (F.y - all[i - 1].y); continue; }
      iy += Math.max(F.y - prevF.y, prevF.ic + SLAB);
      F.iy = iy;
      prevF = F;
    }
    iy = 0;
    for (let i = gi - 1; i >= 0; i--) { const F = all[i]; iy -= Math.max(all[i + 1].y - F.y, F.ic + SLAB); F.iy = iy; }
  }
  // 테라스(아래 부피의 지붕) · 옥상
  for (let i = gi + 1; i < all.length; i++) {
    const F = all[i];
    if (F.mezz) continue;
    const T = terraceOf(V, G, F, all[i - 1].mask);
    if (T) F.terrace = T;
  }
  const topF = all[all.length - 1];
  const roof = topF && !topF.mezz ? roofOf(V, G, topF) : null;
  // 공중다리 문: 다리 높이의 층에 (틀 좌표의 방향 = 건너편 탑 쪽)
  (r.bridges || []).forEach((b, k) => {
    const F = all.find((q) => !q.mezz && !q.below && Math.abs(q.y - b.y) < 0.05);
    if (!F) return;
    const gx = b.ux * V.ex[0] + b.uz * V.ex[1], gz = b.ux * V.ez[0] + b.uz * V.ez[1], l = Math.hypot(gx, gz) || 1;
    (F.bridges || (F.bridges = [])).push({ k, bi: b.bi, dir: [gx / l, gz / l] });
  });
  // 외벽 창: 발코니 띠면 집마다 발코니
  for (const F of all) F.balcony = F.ftype === 5 && ['residential', 'hotel', 'house'].includes(F.use);
  // 조직: 같은 쓰임이 이어진 층 묶음마다 (사무층은 층마다 회사가 다를 수 있다)
  const orgs = [];
  const zones = [];
  let prev = null;
  // 전문 건물: 모든 묶음이 한 조직 (병원의 식당·행정도 그 병원, 본사의 식당·회의층도 그 회사)
  const mainOpOrg = { bank: 'bank', home: 'home', hotel: 'hotel', office: 'office', lab: 'lab', admin: 'admin', market: 'mart', cafe: 'food', school: 'school', heal: 'clinic', library: 'library', museum: 'museum', hall: 'hall', factory: 'factory', depot: 'depot', terminal: 'terminal', plant: 'plant', farm: 'farm', garden: 'garden' }[pid] || 'office';
  let soleOrg = null;
  if (D.special) {
    soleOrg = orgFor(mainOpOrg, r, seed, 0);
    if (D.special === '본점') soleOrg.name = soleOrg.name.replace(/ (동네점|큰점)$/, '');
    const suf = { 본사: ' 본사', 본점: ' 본점', '물류 센터': ' 센터', '공장 단지': '', '교통 거점': '', '농업 단지': ' 단지' }[D.special];
    if (suf && !soleOrg.name.endsWith(suf.trim())) { soleOrg.name += suf; soleOrg.id = `${soleOrg.op}:${soleOrg.name}`; }
    soleOrg.special = D.special;
    orgs.push(soleOrg);
  }
  for (const F of all) {
    const op = FUSE[F.use] ? FUSE[F.use].op : 'office';
    const orgOp = F.use === 'dept' ? 'dept' : F.use === 'shops' ? 'shops' : op;
    const sameZone = prev && prev.use === F.use && (soleOrg || !(F.use === 'office' && rnd() < 0.45));
    if (!sameZone) {
      const needOrg = !['lobby', 'tech', 'parking', 'mezz', 'amenity', 'observation', 'stem'].includes(op) || F.use === 'stem';
      let org = null;
      if (needOrg) {
        // 큰 건물의 같은 업종은 한 조직(주거조합·호텔·병원), 사무층은 회사마다
        const reuse = soleOrg || (op !== 'office' && orgs.find((o) => o.op === orgOp));
        org = reuse || orgFor(orgOp, r, seed, orgs.length);
        if (!reuse) orgs.push(org);
      }
      zones.push({ use: F.use, op, from: F.i, to: F.i, org: org ? org.id : null });
    } else zones[zones.length - 1].to = F.i;
    F.zone = zones.length - 1;
    F.org = zones[zones.length - 1].org;
    prev = F;
  }
  // 건물 전체의 대표 조직(간판·이름): 주된 쓰임의 조직
  const mainOp = { home: 'home', hotel: 'hotel', office: 'office', lab: 'lab', admin: 'admin', market: 'mart', cafe: 'food', school: 'school', heal: 'clinic', library: 'library', museum: 'museum', hall: 'hall', factory: 'factory', depot: 'depot', terminal: 'terminal', plant: 'plant', farm: 'farm', garden: 'garden' }[pid] || 'office';
  const mainOrg = soleOrg || orgs.find((o) => o.op === mainOp || (mainOp === 'mart' && (o.op === 'dept' || o.op === 'shops'))) || orgs[0] || null;
  // 빛깔: 묶음마다 (조직 상표 + 쓰임 빛깔 + 구역 색조)
  for (const Z of zones) { const org = orgs.find((o) => o.id === Z.org); Z.style = styleFor(Z.op, r, seed, org, zones.indexOf(Z)); }
  const dg = r.door ? [((r.door.x - r.x) * V.ex[0] + (r.door.z - r.z) * V.ex[1]) * V.S, ((r.door.x - r.x) * V.ez[0] + (r.door.z - r.z) * V.ez[1]) * V.S] : [0, V.R];
  const B = {
    V, v: GEN_VERSION, uid, seed, kind: r.kind, use: r.use, pid, size: D.notes.size, gfa: D.notes.gfa, special: D.special || null,
    G, theta: V.theta, floors: all, ground: gi, zones, orgs, mainOrg: mainOrg ? mainOrg.id : null,
    roof, atrium: D.atrium, podium: D.podium, door: { gx: dg[0], gz: dg[1] },
    module: base0.mod, bay: BAY[base0.ftype] || 2.2,
    volume: { base: V.base, top: V.top, floorY: V.floorY },
  };
  planCore(B);
  if (B.atrium) atriumOf(B);
  return B;
}

/** 아트리움: 1층 로비의 정문과 심 사이 위로 몇 층이 뚫린 곳 (그 층들 모두의 바닥 안, 심·바깥벽에서 떨어져) */
function atriumOf(B) {
  const { gw, gh } = B.G, A = B.atrium, core = B.core;
  const F0 = B.floors[B.ground];
  const span = B.floors.filter((F) => F.i > B.ground + A.from && F.i <= B.ground + A.to && !F.mezz);
  if (!span.length || !core) { B.atrium = null; return; }
  const cx = core.i0 + core.w / 2 + core.front[0] * (core.w / 2 + 6), cz = core.j0 + core.d / 2 + core.front[1] * (core.d / 2 + 6);
  const rad = Math.max(3, Math.min(9, Math.sqrt((F0.n * 0.1) / Math.PI)));
  const cells = [];
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    const c = j * gw + i;
    if (Math.hypot(i + 0.5 - cx, j + 0.5 - cz) > rad) continue;
    if (!F0.mask[c] || span.some((F) => !F.mask[c])) continue;
    if (i >= core.i0 - 3 && i < core.i0 + core.w + 3 && j >= core.j0 - 3 && j < core.j0 + core.d + 3) continue;
    // 바깥벽에서 4칸 (위층 방·복도가 둘레에 남게)
    let edge = false;
    for (let dj = -4; dj <= 4 && !edge; dj++) for (let di = -4; di <= 4; di++) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= gw || b >= gh || !span[0].mask[b * gw + a]) { edge = true; break; } }
    if (!edge) cells.push(c);
  }
  if (cells.length < 12) { B.atrium = null; return; }
  B.atriumCells = cells;
}

/** 쓰임별 이름 (안내판·지도) */
export function floorName(F) { return FUSE[F.use] ? FUSE[F.use].name : F.use; }
export { CELL };
