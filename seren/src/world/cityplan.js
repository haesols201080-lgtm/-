// 도시 계획: 구역을 블록으로 나누고 블록마다 쓰임(토지 이용)을 정한 뒤, 쓰임에 맞는 배치(건물·마당·소품·주민 자리)를 짠다.
//  · 블록 = 고리 띠 하나(안쪽 거리 ~ 다음 거리) × 대로 사이 부채꼴을 골목으로 나눈 조각.
//    블록 좌표 u(고리를 따라, m) · v(안쪽 거리에서 바깥으로, m). 지형 셰이더(city-ground.js)가 같은 식으로 바닥을 그린다.
//  · 쓰임 배정은 「계획」: 가운데는 공공·광장, 대로변은 상업·교통·물류, 바깥은 산업·에너지·농지, 녹지는 띠로 이어진다.
//  · 템플릿은 실제 미터로 짠다 — 주거 블록은 둘레 건물 + 안뜰 정원·놀이터, 산업 블록은 공장 + 작업장 마당 …
import { ZONES, ZGEO, USE, MIX, STYLE_KINDS, hasStreet, bandStart } from '../data/city.js';
import { mulberry32 } from '../core/noise.js';

const TAU = Math.PI * 2;
const U = USE;

// ── 블록 만들기 ─────────────────────────────
/** 구역 하나의 블록들 (쓰임은 아직 없음) */
export function zoneBlocks(zi) {
  const G = ZGEO[zi];
  const SA = TAU / G.avenues;
  const rings = [];
  const blocks = [];
  let start = 64; // 계획 텍스처: 앞 64 칸은 고리 표
  for (let k = 0; k < G.nb; k++) {
    const band0 = G.r0 + k * G.ring, bs = bandStart(G, k);
    const R0 = band0 + bs, D = G.ring - bs, Rm = R0 + D / 2;
    const m = Math.max(1, Math.round((SA * Rm - 2 * G.avH) / G.blockLen));
    rings.push({ m, start, street: hasStreet(G, k) });
    for (let s = 0; s < G.avenues; s++) {
      for (let j = 0; j < m; j++) {
        const th0 = G.aOff + s * SA + (j * SA) / m, th1 = th0 + SA / m;
        const t0 = j === 0 ? G.avH : G.lane / 2, t1 = j === m - 1 ? G.avH : G.lane / 2;
        const B = { zi, G, k, s, j, m, idx: start + s * m + j, R0, D, Rm, th0, th1, t0, t1, type: 0, variant: 0, seed: 0, edgeAv: j === 0 ? -1 : j === m - 1 ? 1 : 0 };
        B.L = (th1 - th0) * Rm - t0 - t1;
        blocks.push(B);
      }
    }
    start += G.avenues * m;
  }
  return { rings, blocks, size: start };
}

/** 블록 좌표 → 세계 [x, z, 각] */
export function uvToWorld(B, u, v) {
  const r = B.R0 + v, a = B.th0 + (u + B.t0) / r;
  return [B.G.cx + Math.cos(a) * r, B.G.cz + Math.sin(a) * r, a];
}
/** v 에서의 블록 길이 */
export const blockLenAt = (B, v) => (B.th1 - B.th0) * (B.R0 + v) - B.t0 - B.t1;

/** 세계 → 그 자리의 종류(block | street | avenue | lane)와 블록·좌표 (구역 밖이면 null). plan: buildPlan 결과 */
export function locate(plan, x, z) {
  for (const P of plan.zones) {
    const G = P.G, dx = x - G.cx, dz = z - G.cz, r = Math.hypot(dx, dz);
    if (r < G.r0 - G.street || r > G.rOut + G.street) continue;
    const a = Math.atan2(dz, dx);
    const SA = TAU / G.avenues;
    const rel = (((a - G.aOff) % TAU) + TAU) % TAU;
    const s = Math.floor(rel / SA), fs = rel - s * SA;
    const dAv = Math.min(fs, SA - fs) * r;
    const k = Math.floor((r - G.r0) / G.ring);
    const base = { P, G, r, a, k, s, B: null, u: 0, v: 0 };
    if (dAv < G.avH) return { ...base, kind: 'avenue', d: dAv };
    if (r < G.r0) return null;
    if (k >= G.nb) return { ...base, kind: 'street', vb: r - G.rOut };
    const band0 = G.r0 + k * G.ring, bs = bandStart(G, k);
    if (r - band0 < bs) return { ...base, kind: hasStreet(G, k) ? 'street' : 'lane', vb: r - band0 };
    const ring = P.rings[k];
    const j = Math.min(ring.m - 1, Math.floor((fs / SA) * ring.m));
    const B = P.blocks[ring.start - 64 + s * ring.m + j];
    const u = (fs - (j * SA) / ring.m) * r - B.t0, v = r - B.R0;
    const Lr = (B.th1 - B.th0) * r - B.t0 - B.t1;
    if (u < 0 || u > Lr) return { ...base, kind: 'lane', B, u, v };
    return { ...base, kind: 'block', B, u, v, L: Lr };
  }
  return null;
}

// ── 쓰임 배정 ─────────────────────────────
const SCORE = {
  // t: 안쪽 0 ~ 바깥 1, av: 대로에 닿은 블록, belt: 녹지 띠 고리
  RES: (t, av) => 1 - Math.abs(t - 0.5) * 0.8 - av * 0.35,
  COM: (t, av) => 0.35 + av * 0.7 + (t < 0.6 ? 0.2 : 0),
  CIV: (t, av) => (1 - t) * 0.9 + av * 0.3,
  PLZ: (t, av) => (t < 0.3 ? 0.8 : 0.1) + av * 0.5,
  GRN: (t, av, belt) => 0.2 + belt * 1.2 - av * 0.2,
  IND: (t) => t * 1.0,
  LOG: (t, av) => t * 0.6 + av * 0.6,
  ENE: (t) => t * 1.1,
  RSC: (t) => 0.6 - Math.abs(t - 0.45) * 0.5,
  TRN: (t, av) => av * 0.9 + (t < 0.2 || t > 0.8 ? 0.4 : 0),
  ENV: (t) => 0.35 + t * 0.35,
  FARM: (t) => t * 1.3,
  VILLA: (t) => (1 - t) * 0.9,
};

/**
 * 계획 세우기. env: { excluded(x, z, r) → bool, water(x, z) → 땅 높이, structure(x, z, r) → 큰 구조물과 겹침 }
 */
export function buildPlan(env) {
  const zones = [];
  ZONES.forEach((Z, zi) => {
    const zb = zoneBlocks(zi);
    const P = { Z, G: ZGEO[zi], zi, ...zb };
    const rnd = mulberry32((P.G.cx * 31 + P.G.cz * 17 + 7) | 0);
    const belt = Math.max(1, Math.round(P.G.nb * 0.42));
    // 부채꼴마다 비율대로
    const bySec = new Map();
    for (const B of P.blocks) { if (!bySec.has(B.s)) bySec.set(B.s, []); bySec.get(B.s).push(B); }
    for (const [s, list] of bySec) {
      const mixName = Z.sectors ? Z.sectors[s % Z.sectors.length] : Z.mix;
      const mix = Object.entries(MIX[mixName]);
      const sum = mix.reduce((a, [, w]) => a + w, 0);
      const target = Object.fromEntries(mix.map(([k, w]) => [k, Math.max(1, Math.round((w / sum) * list.length))]));
      const pairs = [];
      for (const B of list) {
        const t = P.G.nb > 1 ? B.k / (P.G.nb - 1) : 0.5;
        const av = B.edgeAv !== 0 ? 1 : 0;
        const bt = B.k === belt || (P.G.nb > 8 && B.k === belt + 4) ? 1 : 0;
        for (const [k] of mix) pairs.push([B, k, SCORE[k](t, av, bt) + rnd() * 0.55]);
      }
      pairs.sort((a, b) => b[2] - a[2]);
      const used = {};
      for (const [B, k] of pairs) {
        if (B.type) continue;
        if ((used[k] || 0) >= target[k]) continue;
        B.type = U[k]; used[k] = (used[k] || 0) + 1;
      }
      // 남은 블록(반올림 차이)은 가장 비율이 큰 쓰임으로
      const main = mix.slice().sort((a, b) => b[1] - a[1])[0][0];
      for (const B of list) if (!B.type) B.type = U[main];
      // 광장이 이웃하지 않게
      for (const B of list) if (B.type === U.PLZ) for (const C of list) if (C !== B && C.type === U.PLZ && C.k === B.k && Math.abs(C.j - B.j) === 1) C.type = U.GRN;
    }
    // 땅 살피기: 물·절벽·큰 장소
    for (const B of P.blocks) {
      B.seed = rnd();
      B.variant = Math.floor(rnd() * 256);
      let wet = 0, mn = 1e9, mx = -1e9, n = 0;
      for (const fu of [0.15, 0.5, 0.85]) for (const fv of [0.15, 0.5, 0.85]) {
        const [x, z] = uvToWorld(B, B.L * fu, B.D * fv);
        const h = env.height(x, z);
        if (h < 1.2) wet++;
        mn = Math.min(mn, h); mx = Math.max(mx, h); n++;
      }
      B.wet = wet / n;
      B.slope = (mx - mn) / Math.max(B.D, 1);
      const [cx, cz] = uvToWorld(B, B.L / 2, B.D / 2);
      B.cx = cx; B.cz = cz;
      if (B.wet > 0.5 && !Z.water) { B.type = 0; continue; }
      if (B.wet > 0.5 && Z.water) { B.type = U.VILLA; B.stilt = true; continue; }
      if (B.slope > 0.55) { B.type = B.type === U.FARM || B.type === U.VILLA ? 0 : U.GRN; B.steep = true; continue; }
      // 다른(앞선) 구역 안이면 그 구역이 우선 — 이 블록은 비운다
      // (지형의 구역 단 둘레 둑 160~200 m 까지 — heightfield 의 땅 맞추기와 같은 범위: 비탈 위에 짓지 않게)
      for (const Q of zones) {
        const d = Math.hypot(cx - Q.G.cx, cz - Q.G.cz);
        const inner = Q.Z.mix === 'suburb' ? Q.G.r0 - Q.G.street - 40 : -1;
        if (d > inner && d < Q.G.rOut + Q.G.street + (Q.Z.grade === false ? 40 : 175) + Math.max(B.L, B.D) * 0.3) { B.type = 0; B.covered = true; break; }
      }
      if (B.type && env.bigPlace(cx, cz, Math.min(B.L, B.D) * 0.5)) B.type = Z.podium ? U.PLZ : U.GRN;
    }
    // 보조 랜드마크 자리: ZONES.marks [[모양, 부채꼴, 안쪽~바깥 0..1]…] → 가장 가까운 멀쩡한 블록을 광장으로 비우고 가운데에
    for (const [kind, s, t] of Z.marks || []) {
      const G = P.G, a = G.aOff + (s + 0.5) * ((Math.PI * 2) / G.avenues), rr = G.r0 + t * (G.rOut - G.r0);
      const x = G.cx + Math.cos(a) * rr, z = G.cz + Math.sin(a) * rr;
      const cand = P.blocks.filter((B) => B.type && !B.covered && !B.steep && B.wet < 0.1 && B.D > 66 && B.L > 90).sort((A, B) => Math.hypot(A.cx - x, A.cz - z) - Math.hypot(B.cx - x, B.cz - z));
      if (cand[0]) { cand[0].type = U.PLZ; cand[0].landmark = kind; cand[0].markAlt = cand.slice(1, 4); }
    }
    zones.push(P);
  });
  return { zones };
}

// ── 쓰임별 배치 템플릿 ─────────────────────────
// P: { bldg(B, kind, u, v, hw, hd, h, o), prop(B, kind, u, v, face, o), spot(B, type, u, v, face, o), rnd, pick(B, cat), towerH(B, f) }
// face: 'out'(바깥 거리 쪽) | 'in' | 'u+' | 'u-' | 숫자(바깥 기준 회전)
const T = {};

/** 주거: 안뜰을 둘러싼 고층 주거 탑들(안쪽·바깥쪽 거리를 따라) + 안뜰(정원·놀이터·의자·화단) */
T[U.RES] = (B, P) => {
  const { L, D } = B, r = P.rnd;
  if (D < 58) return T.smallRes(B, P);
  // 둘레 탑: 거리마다 2~4 채, 키를 조금씩 달리해 스카이라인이 출렁이게. 안뜰(v 20 ~ D-20)은 비운다
  let first = true;
  for (const [v, door] of [[12, -1], [D - 12, 1]]) {
    const n = Math.max(2, Math.min(4, Math.floor((L - 16) / 34)));
    for (let i = 0; i < n; i++) {
      const u = 8 + ((L - 16) * (i + 0.5)) / n;
      const big = B.peak && first;
      const w = big ? Math.min(14, (L - 16) / n / 2 - 2) : Math.min(11, (L - 16) / n / 2 - 3);
      const kind = big ? ['skygarden', 'terrace', 'triad', 'setback'][B.variant % 4] : P.pick(B, 'tower');
      P.bldg(B, kind, u, big ? 14 : v, w, big ? w : Math.min(w, 8), P.towerH(B, big ? 1 : 0.75 + r() * 0.5), { door, use: 'home' });
      first = false;
    }
  }
  // 안뜰: 놀이터 + 의자 + 정원수 줄 + 화단
  const cu = L / 2, cv = D / 2;
  P.prop(B, 'play', cu - 13, cv, 'out', { col: { r: 3.2, h: 2.4 } });
  P.spot(B, 'play', cu - 13, cv, 'out', { r: 7 });
  P.prop(B, 'pavilion', cu + 14, cv, 0, { s: 0.85, col: { r: 4.3, h: 0.3 } });
  P.spot(B, 'chat', cu + 14, cv, 0, { r: 3 });
  for (const sv of [-1, 1]) {
    for (let u = 30; u <= L - 30; u += 11) P.prop(B, 'tree', u, cv + sv * 10.5, 0, { s: 0.85 + r() * 0.3 });
    for (let u = 34; u <= L - 34; u += 18) { P.prop(B, 'bench', u, cv + sv * 7.5, sv > 0 ? 'in' : 'out'); P.spot(B, 'sit', u, cv + sv * 7.5, sv > 0 ? 'in' : 'out'); }
  }
  P.spot(B, 'tend', cu, cv - 13, 'in'); P.spot(B, 'tend', cu, cv + 13, 'out');
};
/** 작은 주거 블록 (지방 도시): 집 몇 채 + 가운데 마당 */
T.smallRes = (B, P) => {
  const { L, D } = B, r = P.rnd;
  const n = Math.max(2, Math.floor(L / 30));
  for (let i = 0; i < n; i++) {
    const u = (L * (i + 0.5)) / n, inner = i % 2 === 0;
    const hw = Math.min(11, L / n / 2 - 2), hd = Math.min(10, D * 0.3);
    const kind = P.pick(B, r() < 0.4 ? 'tower' : 'house');
    P.bldg(B, kind, u, inner ? hd + 3 : D - hd - 3, hw, hd, kind === 'villa' || kind === 'dome' || kind === 'stilt' ? 9 + r() * 7 : P.towerH(B, 0.5), { door: inner ? -1 : 1, use: 'home' });
  }
  P.prop(B, 'play', L / 2, D / 2, 'out', { col: { r: 3.2, h: 2.4 } });
  P.spot(B, 'play', L / 2, D / 2, 'out', { r: 6 });
  P.prop(B, 'bench', L / 2 + 8, D / 2, 'u-'); P.spot(B, 'sit', L / 2 + 8, D / 2, 'u-');
};

/** 상업: 상가 기단 + 그 위 사무 탑 + 대로 쪽 상가 광장(키오스크·홀로 기둥) */
T[U.COM] = (B, P) => {
  const { L, D } = B, r = P.rnd;
  const pl = B.edgeAv ? 26 : 18; // 광장 길이
  const atStart = B.edgeAv <= 0; // 광장을 대로(또는 골목) 쪽 끝에
  const u0 = atStart ? pl : 4, u1 = atStart ? L - 4 : L - pl;
  const pod = B.G && P.podium(B);
  if (B.peak) {
    // 높은 군집의 한가운데: 넓은 발의 초고층 하나 + 양옆의 낮은 탑
    const tw = Math.min(26, (u1 - u0) * 0.3, D * 0.36);
    const kind = ['crown', 'setback', 'skygarden', 'cantilever'][B.variant % 4];
    P.bldg(B, kind, (u0 + u1) / 2, D / 2, tw, tw * (kind === 'crown' ? 0.85 : 1), P.towerH(B), { door: -1, use: 'office' });
    for (const fu of [0.12, 0.88]) { const u = u0 + (u1 - u0) * fu; const w = Math.min(10, (u1 - u0) * 0.1); P.bldg(B, P.pick(B, 'office'), u, D / 2, w, w, P.towerH(B, 0.35), { door: fu < 0.5 ? 'u-' : 'u+', use: 'office' }); }
    if (pod) P.bldg(B, 'podium', (u0 + u1) / 2, D / 2, (u1 - u0) / 2, D / 2 - 4, pod, { door: -1, use: 'market', podium: true });
  }
  const nT = B.peak ? 0 : Math.max(1, Math.min(3, Math.floor((u1 - u0) / 38)));
  for (let i = 0; i < nT; i++) {
    const u = u0 + ((u1 - u0) * (i + 0.5)) / nT, tw = Math.min(15, (u1 - u0) / nT / 2 - 3);
    const kind = P.pick(B, 'office');
    const dims = kind === 'blade' || kind === 'slab' || kind === 'twin' || kind === 'setback' || kind === 'crown' ? [tw, Math.min(D * 0.32, tw * 0.8)] : [Math.min(tw, D * 0.3), Math.min(tw, D * 0.3)];
    P.bldg(B, kind, u, D / 2, dims[0], dims[1], P.towerH(B), { door: i % 2 ? 1 : -1, use: 'office' });
  }
  if (pod && !B.peak) P.bldg(B, 'podium', (u0 + u1) / 2, D / 2, (u1 - u0) / 2, D / 2 - 4, pod, { door: -1, use: 'market', podium: true });
  // 상가 광장
  const pc = atStart ? pl / 2 : L - pl / 2;
  P.prop(B, 'kiosk', pc, D * 0.3, 'u+', { col: { r: 2.4, h: 3.2 } }); P.spot(B, 'sell', pc, D * 0.3 - 2.6, 'in');
  P.prop(B, 'kiosk', pc, D * 0.7, 'u-', { col: { r: 2.4, h: 3.2 } }); P.spot(B, 'sell', pc, D * 0.7 + 2.6, 'out');
  P.prop(B, 'pillar', pc, D * 0.5, 0, { s: 1.4, col: { r: 0.7, h: 6 } });
  P.spot(B, 'music', pc + (atStart ? 4 : -4), D * 0.5, atStart ? 'u-' : 'u+', { r: 4 });
  for (const v of [D * 0.15, D * 0.85]) { P.prop(B, 'tree', pc, v, 0); }
  for (const v of [D * 0.42, D * 0.58]) { P.prop(B, 'bench', pc + (atStart ? -6 : 6), v, atStart ? 'u+' : 'u-'); P.spot(B, 'sit', pc + (atStart ? -6 : 6), v, atStart ? 'u+' : 'u-'); }
  void r;
};

/** 공공: 큰 공공 건물(회관·학교·치유원·서고) + 앞마당 광장(분수·빛 기둥·나무) */
T[U.CIV] = (B, P) => {
  const { L, D } = B, r = P.rnd;
  const kinds = ['hall', 'school', 'observatory', 'hall', 'gate'];
  const kind = kinds[B.variant % kinds.length];
  const purpose = kind === 'school' ? 'school' : kind === 'observatory' ? (B.variant % 2 ? 'heal' : 'library') : 'hall';
  const hw = Math.min(30, L * 0.32), hd = Math.min(19, D * 0.27);
  const bv = D - 4 - hd;
  P.bldg(B, kind, L / 2, bv, hw, hd, kind === 'observatory' ? Math.max(24, hw * 1.0) : kind === 'gate' ? 34 + r() * 22 : 16 + r() * 10, { door: -1, use: purpose });
  // 앞마당 (안쪽 거리 쪽)
  const fv = (bv - hd) / 2;
  if (fv > 8) {
    P.prop(B, B.variant % 3 ? 'fountain' : 'monument', L / 2, fv, 'in', { s: 1, col: { r: 5.4, h: 0.8 } });
    P.spot(B, 'music', L / 2 + 9, fv, 'u-', { r: 5 });
    for (let u = L / 2 - hw; u <= L / 2 + hw + 0.1; u += hw / 2) P.prop(B, 'mast', u, Math.max(3, fv - 9), 0, { col: { r: 0.3, h: 9 } });
    for (const su of [-1, 1]) { P.prop(B, 'bench', L / 2 + su * 11, fv + 4, 'in'); P.spot(B, 'sit', L / 2 + su * 11, fv + 4, 'in'); }
    P.spot(B, 'meditate', L / 2, fv, 0, { r: 7 });
  }
  // 옆 정원
  for (const su of [-1, 1]) {
    const u = su < 0 ? (L / 2 - hw) / 2 : L - (L / 2 - hw) / 2;
    if (L / 2 - hw > 10) for (let v = 8; v < D - 6; v += 9) P.prop(B, 'tree', u, v, 0, { s: 0.9 + r() * 0.25 });
  }
};

/** 산업: 제조동 둘 + 탱크 + 굴뚝 + 작업장 마당(짐 상자·관 다리·짐차) */
T[U.IND] = (B, P) => {
  const { L, D } = B, r = P.rnd;
  const hw = Math.min(L * 0.2, 26), hd = Math.min(D * 0.18, 13);
  P.bldg(B, 'fabricator', L * 0.27, hd + 5, hw, hd, 14 + r() * 8, { door: 1, use: 'factory' });
  P.bldg(B, 'fabricator', L * 0.73, hd + 5, hw, hd, 14 + r() * 8, { door: 1, use: 'factory' });
  P.bldg(B, 'tanks', L * 0.2, D - 14, 10, 10, 16 + r() * 8, { use: 'none' });
  if (P.mix === 'bioindustry' || P.mix === 'suburb') P.bldg(B, 'treeform', L * 0.84, D - 15, Math.min(14, D * 0.2), Math.min(14, D * 0.2), 34 + r() * 26, { use: 'none' });
  else P.bldg(B, r() < 0.5 ? 'cooler' : 'conduit', L * 0.85, D - 13, r() < 0.5 ? 9 : 5, r() < 0.5 ? 9 : 5, 26 + r() * 14, { use: 'none' });
  // 마당
  for (let u = L * 0.38; u < L * 0.72; u += 9) { P.prop(B, 'crates', u, D * 0.62, 'u+', { s: 0.9 + r() * 0.3, col: { r: 1.9, h: 2.6 } }); }
  P.prop(B, 'piperack', L / 2, hd + 5, 'u+', { s: Math.max(1, (L * 0.46 - 2 * hw) / 10), col: { r: 0.6, h: 7, walk: false } });
  for (const u of [L * 0.42, L * 0.58]) { P.prop(B, 'cargo', u, D - 8, 'u+'); }
  P.spot(B, 'carry', L * 0.27, 2 * hd + 7, 'out', { to: [L * 0.45, D * 0.62] });
  P.spot(B, 'carry', L * 0.73, 2 * hd + 7, 'out', { to: [L * 0.6, D * 0.62] });
  P.spot(B, 'console', L * 0.5, D * 0.5, 'out');
};

/** 물류: 긴 창고 + 짐 상자 마당(줄지은 상자·하역 칸) + 분류탑 + 드론 착륙판 */
T[U.LOG] = (B, P) => {
  const { L, D } = B, r = P.rnd;
  const hd = Math.min(D * 0.2, 14);
  P.bldg(B, 'warehouse', L / 2, hd + 4, L * 0.42, hd, 13 + r() * 6, { door: 1, use: 'depot' });
  const v0 = 2 * hd + 12;
  const cu1 = Math.min(L - 30, 100);
  for (let v = v0; v < D - 6; v += 9) for (let u = 8; u < cu1; u += 7.5) if (r() < 0.7) P.prop(B, 'crates', u, v, 'u+', { s: 0.8 + r() * 0.5, col: { r: 1.9, h: 2.6 } });
  P.bldg(B, 'padtower', L - 10, D - 10, 7, 7, 30 + r() * 20, { use: 'none' });
  P.prop(B, 'pad', L - 24, D - 9, 0); P.prop(B, 'pad', L - 24, D - 22, 0);
  for (let i = 0; i < 3; i++) P.spot(B, 'carry', 12 + i * (L - 30) / 3, 2 * hd + 6, 'out', { to: [16 + i * (L - 30) / 3, v0 + 4] });
  P.spot(B, 'console', L - 18, D - 16, 'u-');
};

/** 에너지: 반응로 + 냉각탑 둘 + 변전 마당 + 울림 집광판 줄 */
T[U.ENE] = (B, P) => {
  const { L, D } = B, r = P.rnd;
  const rr = Math.min(17, D * 0.28, L * 0.18);
  if (B.variant % 3 === 0) P.bldg(B, 'coiltower', L * 0.36, D / 2, rr * 1.1, rr * 1.1, 60 + r() * 50, { use: 'none' });
  else P.bldg(B, 'reactor', L * 0.36, D / 2, rr, rr, rr * 1.3, { use: 'plant' });
  const cr = Math.min(11, D * 0.17);
  P.bldg(B, 'cooler', L * 0.68, D * 0.28, cr, cr, 30 + r() * 14, { use: 'none' });
  P.bldg(B, 'cooler', L * 0.68, D * 0.72, cr, cr, 30 + r() * 14, { use: 'none' });
  for (let u = 6; u < Math.min(L * 0.16, 24); u += 7) for (let v = 8; v < D - 8; v += 8) P.prop(B, 'transformer', u, v, 'u+', { col: { r: 1.4, h: 3.2 } });
  for (let v = 7; v < D - 6; v += 8) for (let u = Math.max(L * 0.84, L - 26); u < L - 4; u += 6) P.prop(B, 'collector', u, v, 'in', { col: { r: 1.2, h: 2.2 } });
  P.bldg(B, 'conduit', L * 0.52, 7, 4, 4, 40 + r() * 20, { use: 'none' });
  P.spot(B, 'console', L * 0.36, D / 2 - rr - 4, 'out');
  P.spot(B, 'console', L * 0.12, D / 2, 'u+');
  P.spot(B, 'inspect', L * 0.84, D * 0.3, 'u+', { to: [L * 0.84, D * 0.7] });
};

/** 연구: 연구동 넷이 둘러싼 안뜰(교차 길·관측 기구·의자) */
T[U.RSC] = (B, P) => {
  const { L, D } = B, r = P.rnd;
  const rr = Math.min(13, D * 0.2, L * 0.16);
  const pos = [[0.2, 0.28], [0.8, 0.28], [0.2, 0.74], [0.8, 0.74]];
  pos.forEach(([fu, fv], i) => P.bldg(B, P.pick(B, 'lab'), L * fu, D * fv, rr, rr, i === 1 ? P.towerH(B, 0.6) : 18 + r() * 22, { door: fv < 0.5 ? -1 : 1, use: 'lab' }));
  P.prop(B, 'dish', L / 2, D / 2, 'out', { col: { r: 2.2, h: 3 } });
  P.spot(B, 'observe', L / 2 + 4, D / 2, 'out');
  for (const [du, dv] of [[-12, -7], [12, 7], [-12, 7], [12, -7]]) { P.prop(B, 'bench', L / 2 + du, D / 2 + dv, du < 0 ? 'u+' : 'u-'); P.spot(B, 'sit', L / 2 + du, D / 2 + dv, du < 0 ? 'u+' : 'u-'); }
  for (const fu of [0.38, 0.62]) for (const fv of [0.2, 0.8]) P.prop(B, 'tree', L * fu, D * fv, 0);
  P.spot(B, 'chat', L * 0.5, D * 0.3, 0, { r: 2.5 });
  P.spot(B, 'console', L * 0.2, D * 0.28 + rr + 3, 'in');
};

/** 교통: 터미널 + 착륙대 탑 + 정류장 지붕 + 줄지은 호버 차 */
T[U.TRN] = (B, P) => {
  const { L, D } = B, r = P.rnd;
  const hw = Math.min(L * 0.3, 34), hd = Math.min(D * 0.22, 16);
  P.bldg(B, 'hangar', L * 0.42, hd + 5, hw, hd, 16 + r() * 8, { door: 1, use: 'terminal' });
  if (B.variant % 2) P.bldg(B, 'branchport', L * 0.86, D * 0.36, Math.min(16, D * 0.24), Math.min(16, D * 0.24), 60 + r() * 50, { use: 'none' });
  else P.bldg(B, 'padtower', L * 0.88, D * 0.3, 8, 8, 40 + r() * 30, { use: 'none' });
  for (let u = 10; u < L * 0.75; u += 16) P.prop(B, 'platform', u, D - 7, 'out', { col: { r: 0.4, h: 3.2 } });
  for (let u = 8; u < L * 0.75; u += 6) P.prop(B, 'pod', u, D * 0.66, 'in');
  for (let u = 12; u < L * 0.75; u += 16) P.spot(B, 'wait', u, D - 9, 'out');
  P.spot(B, 'console', L * 0.42, 2 * hd + 7, 'out');
  P.spot(B, 'console', L * 0.88, D * 0.3 + 11, 'out');
};

/** 인공 환경: 생태 돔 또는 수직 농장 + 온실 줄 */
T[U.ENV] = (B, P) => {
  const { L, D } = B, r = P.rnd;
  if (B.variant % 2 === 0) {
    const rr = Math.min(28, D * 0.4, L * 0.34);
    P.bldg(B, 'biodome', L / 2, D / 2, rr, rr, rr * 0.9, { door: -1, use: 'garden' });
    for (const su of [-1, 1]) P.prop(B, 'tree', L / 2 + su * (rr + 8), D / 2, 0, { s: 1.1 });
    P.spot(B, 'tend', L / 2 + rr + 5, D * 0.3, 'u-'); P.spot(B, 'tend', L / 2 - rr - 5, D * 0.7, 'u+');
  } else {
    P.bldg(B, 'vfarm', L * 0.18, D / 2, Math.min(12, D * 0.18), Math.min(12, D * 0.18), P.towerH(B, 0.45), { door: -1, use: 'garden' });
    const n = Math.max(2, Math.floor((D - 10) / 16));
    for (let i = 0; i < n; i++) {
      const v = 8 + (i + 0.5) * ((D - 16) / n);
      P.bldg(B, 'greenhouse', L * 0.62, v, L * 0.3, Math.min(6, (D - 16) / n / 2 - 1.5), 7, { door: 'u-', use: 'garden' });
      P.spot(B, 'tend', L * 0.3, v, 'u+', { to: [L * 0.94, v] });
    }
  }
  void r;
};

/** 계획 녹지: 둘레 산책길 + 대각선 길 + 가운데 연못(분수) + 정자 + 나무 줄 + 꽃밭 */
T[U.GRN] = (B, P) => {
  const { L, D } = B, r = P.rnd;
  const cu = L / 2, cv = D / 2, pr = Math.min(L, D) * 0.2;
  if (P.sparse) {
    // 교외의 녹지: 자연 숲·풀밭을 그대로 살린 보존 공원 (길·연못·정자만 놓는다)
    B.natural = true;
    P.prop(B, 'pavilion', cu, cv, 0, { s: 1, col: { r: 5.1, h: 0.3 } });
    P.spot(B, 'stroll', 7, 7, 'u+', { loop: [[7, 7], [L - 7, 7], [L - 7, D - 7], [7, D - 7]] });
    P.spot(B, 'sit', cu + 7, cv, 'u-');
    return;
  }
  if (!B.steep) {
    P.prop(B, 'fountain', cu, cv, 0, { s: Math.min(1.2, pr / 7), col: { r: 5.4, h: 0.8 } }); // 연못 가운데 분수
    P.prop(B, 'pavilion', cu + pr + 12, cv, 0, { s: 1, col: { r: 5.1, h: 0.3 } });
    P.spot(B, 'music', cu + pr + 12, cv, 'u-', { r: 5 });
  }
  // 둘레 길을 따라 나무 줄 (길 안쪽)
  for (let u = 8; u <= L - 8; u += 12) for (const v of [7, D - 7]) P.prop(B, 'tree', u, v, 0, { s: 0.9 + r() * 0.35 });
  for (let v = 19; v <= D - 19; v += 12) for (const u of [7, L - 7]) P.prop(B, 'tree', u, v, 0, { s: 0.9 + r() * 0.35 });
  // 연못 둘레 의자
  for (let i = 0; i < 6; i++) {
    const t = (i / 6) * TAU + 0.3, u = cu + Math.cos(t) * (pr + 6), v = cv + Math.sin(t) * (pr + 6) * 0.8;
    if (Math.abs(u - (cu + pr + 12)) < 7 && Math.abs(v - cv) < 7) continue;
    P.prop(B, 'bench', u, v, Math.atan2(Math.sin(t), Math.cos(t)) + Math.PI, { rel: true });
    P.spot(B, 'sit', u, v, Math.atan2(Math.sin(t), Math.cos(t)) + Math.PI, { rel: true });
  }
  P.spot(B, 'play', cu - pr - 14, cv, 0, { r: 8 });
  P.spot(B, 'tend', cu, cv - pr - 4, 'in'); P.spot(B, 'tend', cu, cv + pr + 4, 'out');
  P.spot(B, 'stroll', 7, 7, 'u+', { loop: [[7, 7], [L - 7, 7], [L - 7, D - 7], [7, D - 7]] });
  P.spot(B, 'meditate', cu - pr - 14, cv, 0, { r: 6, dawn: true });
};

/** 광장: 무늬 포장 + 가운데 기념탑과 물 + 빛 기둥 고리 + 장터 노점 두 줄 + 의자 */
T[U.PLZ] = (B, P) => {
  const { L, D } = B, r = P.rnd;
  const cu = L / 2, cv = D / 2, R = Math.min(L, D) * 0.36;
  P.prop(B, 'monument', cu, cv, 'in', { col: { r: 2.4, h: 14 } });
  for (let i = 0; i < 10; i++) { const t = (i / 10) * TAU; P.prop(B, 'mast', cu + Math.cos(t) * R, cv + Math.sin(t) * R * 0.85, 0, { col: { r: 0.3, h: 9 } }); }
  // 노점: 광장 양쪽에 호를 따라
  for (const su of [-1, 1]) for (let i = -2; i <= 2; i++) {
    const t = i * 0.32 + (su < 0 ? Math.PI : 0), u = cu + Math.cos(t) * R * 0.66, v = cv + Math.sin(t) * R * 0.6;
    const face = Math.atan2(Math.sin(t), Math.cos(t)) + Math.PI;
    P.prop(B, 'stall', u, v, face, { rel: true, col: { r: 1.6, h: 2.6 } });
    if ((i + su) % 2 === 0) P.spot(B, 'sell', u + Math.cos(t) * 1.8, v + Math.sin(t) * 1.8, face, { rel: true });
  }
  for (const su of [-1, 1]) for (const sv of [-1, 1]) { P.prop(B, 'tree', cu + su * (R + 7), cv + sv * (R * 0.6), 0); P.prop(B, 'bench', cu + su * (R + 2), cv + sv * (R * 0.4), su < 0 ? 'u+' : 'u-'); P.spot(B, 'sit', cu + su * (R + 2), cv + sv * (R * 0.4), su < 0 ? 'u+' : 'u-'); }
  P.spot(B, 'music', cu, cv - 9, 'in', { r: 5 });
  P.spot(B, 'stroll', cu - R * 0.4, cv, 0, { loop: [[cu - R * 0.4, cv - R * 0.3], [cu + R * 0.4, cv - R * 0.3], [cu + R * 0.4, cv + R * 0.3], [cu - R * 0.4, cv + R * 0.3]] });
  P.spot(B, 'meditate', cu, cv + 10, 0, { r: 6, dawn: true });
  void r;
};

/** 농지: 이랑(셰이더) + 온실 줄 + 저장 탑 + 농가 + 과수 줄 */
T[U.FARM] = (B, P) => {
  const { L, D } = B, r = P.rnd;
  const kind = B.variant % 3;
  if (kind === 0) {
    const n = Math.max(2, Math.floor((D - 20) / 18));
    for (let i = 0; i < n; i++) P.bldg(B, 'greenhouse', L * 0.5, 12 + (i + 0.5) * ((D - 24) / n), L * 0.36, Math.min(6.5, (D - 24) / n / 2 - 2), 7, { door: 'u-', use: 'garden' });
  } else if (kind === 1) {
    for (let u = L * 0.45; u < L - 12; u += 12) for (let v = 12; v < D - 34; v += 11) P.prop(B, 'tree', u, v, 0, { s: 0.7 + r() * 0.2 });
  }
  P.bldg(B, 'tanks', L - 14, D - 14, 9, 9, 14 + r() * 6, { use: 'none' });
  P.bldg(B, 'villa', 16, D - 16, 11, 9, 9 + r() * 4, { door: 1, use: 'home' });
  P.spot(B, 'tend', L * 0.3, D * 0.4, 'u+', { to: [L * 0.7, D * 0.4] });
  P.spot(B, 'tend', L * 0.4, D * 0.65, 'u-', { to: [L * 0.8, D * 0.65] });
};

/** 주택가: 거리 쪽으로 늘어선 필지 (집 + 마당 + 가끔 작은 못) + 가운데 공유 길 */
T[U.VILLA] = (B, P) => {
  const { L, D } = B, r = P.rnd;
  const lotW = (P.sparse ? 40 : 26) + (B.variant % 4) * 2;
  const n = Math.max(1, Math.floor(L / lotW));
  const w = L / n;
  const depth = Math.min(D * 0.42, 34);
  for (const side of [-1, 1]) for (let i = 0; i < n; i++) {
    const u = w * (i + 0.5);
    const hw = Math.min(10, w / 2 - 3), hd = Math.min(8, depth / 2 - 3);
    const v = side < 0 ? hd + 5 : D - hd - 5;
    const kind = B.stilt ? 'stilt' : P.pick(B, 'house');
    P.bldg(B, kind, u, v, hw, hd, kind === 'stilt' ? 9 + r() * 6 : 8 + r() * 6, { door: side, use: 'home' });
    if (r() < 0.6) { P.prop(B, 'tree', u + w * 0.3, side < 0 ? depth - 3 : D - depth + 3, 0, { s: 0.8 + r() * 0.3 }); }
    if (r() < 0.35) P.spot(B, 'tend', u - w * 0.25, side < 0 ? depth - 5 : D - depth + 5, side < 0 ? 'in' : 'out');
  }
  P.prop(B, 'play', L / 2, D / 2, 'out', { col: { r: 3.2, h: 2.4 } });
  P.spot(B, 'play', L / 2, D / 2, 'out', { r: 6 });
  P.spot(B, 'stroll', 6, D / 2, 'u+', { loop: [[6, D / 2], [L - 6, D / 2]] });
};

/** 블록 하나 배치 */
export function layoutBlock(B, P) {
  if (B.landmark) return T.landmark(B, P);
  const f = T[B.type];
  if (f) f(B, P);
}

/**
 * 중심 광장의 한 칸 (34 m 고리 띠 × 대로 사이 부채꼴). city-ground.js 의 중심 광장과 같은 칸 나눔:
 *  칸마다 고리 가운데 줄(rc)에 nS 개 자리 — 자리 종류 ty = (kr·7 + slot·3 + 부채꼴) % 4
 *  0·3 나무 화단(둘레 의자) · 1 물의 정원(분수 + 둘레 앉는 자리) · 2 작은 시설(정자 / 기념탑·악사 / 노점 둘)
 *  가장 바깥 띠: 부채꼴마다 대로 쪽 끝에 정류장(승강장·꼬투리 차·기다리는 이), 가운데에 작은 건물(카페 또는 회관)
 */
export function layoutCore(B, P, NK) {
  const G = B.G, kr = B.kr, r = P.rnd;
  const rc = (kr + 0.5) * 34 + 1.8, v = rc - B.R0;
  const nC = Math.max(6, Math.floor((Math.PI * 2 * rc) / 30));
  const nS = Math.max(2, Math.floor(nC / Math.max(G.avenues, 4)));
  const SA = (Math.PI * 2) / G.avenues;
  const outer = kr === NK - 1;
  for (let slot = 0; slot < nS; slot++) {
    const u = ((slot + 0.5) / nS) * SA * rc - B.t0;
    if (u < 6 || u > B.L - 6) continue;
    const ty = (kr * 7 + slot * 3 + B.s) % 4;
    if (outer && slot === Math.floor(nS / 2)) {
      const cafe = (B.s + kr) % 2 === 0;
      P.bldg(B, cafe ? 'dome' : 'hall', u, v, cafe ? 9 : 11, cafe ? 9 : 9, cafe ? 9 : 12, { door: -1, use: cafe ? 'market' : 'hall' });
      continue;
    }
    if (ty === 0 || ty === 3) {
      P.prop(B, 'tree', u, v, 0, { s: 1.15 + r() * 0.3 });
      for (const [du, dv, f] of [[0, -7, 'in'], [0, 7, 'out']]) { P.prop(B, 'bench', u + du, v + dv, f); if (r() < 0.6) P.spot(B, 'sit', u + du, v + dv, f); }
    } else if (ty === 1) {
      P.prop(B, 'fountain', u, v, 0, { s: 0.8, col: { r: 4.4, h: 0.8 } });
      P.spot(B, 'chat', u, v + 9.5, 'out', { r: 2.4 });
      for (const su of [-1, 1]) { P.prop(B, 'bench', u + su * 9.5, v, su < 0 ? 'u+' : 'u-'); P.spot(B, 'sit', u + su * 9.5, v, su < 0 ? 'u+' : 'u-'); }
    } else {
      const f = (slot + kr + B.s) % 3;
      if (f === 0) { P.prop(B, 'pavilion', u, v, 0, { col: { r: 5, h: 0.3 } }); P.spot(B, 'meditate', u, v, 0, { r: 3.5 }); }
      else if (f === 1) { P.prop(B, 'monument', u, v, 'in', { col: { r: 2.6, h: 9 } }); P.spot(B, 'music', u + 6, v, 'u-', { r: 5 }); }
      else { P.prop(B, 'stall', u - 4, v, 'u+', { col: { r: 1.8, h: 2.6 } }); P.spot(B, 'sell', u - 4, v - 2.4, 'in'); P.prop(B, 'stall', u + 4, v, 'u-', { col: { r: 1.8, h: 2.6 } }); P.spot(B, 'sell', u + 4, v + 2.4, 'out'); P.prop(B, 'planter', u, v + 6, 0, { col: { r: 0.9, h: 0.75 } }); }
    }
  }
  // 바깥 띠의 정류장: 대로 산책길 옆 (호버 차·꼬투리 차를 기다린다)
  if (outer && B.s % 2 === 0) {
    for (let i = 0; i < 3; i++) P.prop(B, 'pod', 5 + i * 5, B.D - 6, 'in');
    P.prop(B, 'shelter', 9, 6, 'out', { col: { r: 1.8, h: 3 } });
    P.spot(B, 'wait', 9, 8.5, 'out');
    P.prop(B, 'platform', 18, B.D - 3, 'out', { col: { r: 0.4, h: 3.2 } });
  }
  // 산책하는 이 (칸 가운데)
  if (r() < 0.5) P.spot(B, 'stroll', B.L / 2, v + 12, 'u+');
}

/** 보조 랜드마크 블록: 가운데 랜드마크 + 둘레 광장(의자·나무·노점·악사·관광객) */
const FOOT = { lm_coil: [36, 36], lm_ear: [31, 31], lm_port: [30, 30], lm_garden: [40, 13], lm_tree: [33, 33] };
T.landmark = (B, P) => {
  const { L, D } = B, r = P.rnd;
  const [hw, hd] = FOOT[B.landmark] || [30, 30];
  P.bldg(B, B.landmark, L / 2, D / 2, hw, hd, 0, { use: 'none' });
  const ring = Math.max(hw, hd) + 6;
  for (const su of [-1, 1]) {
    const u = L / 2 + su * (ring + 6);
    if (u < 6 || u > L - 6) continue;
    P.prop(B, 'stall', u, D * 0.3, su < 0 ? 'u+' : 'u-', { col: { r: 1.8, h: 2.6 } }); P.spot(B, 'sell', u, D * 0.3 - 2.4, 'in');
    P.prop(B, 'kiosk', u, D * 0.72, su < 0 ? 'u+' : 'u-', { col: { r: 2.4, h: 3.2 } });
    for (let v = 8; v < D - 6; v += 10) P.prop(B, 'tree', u + su * 7, v, 0, { s: 0.9 + r() * 0.3 });
    P.prop(B, 'bench', u, D / 2, su < 0 ? 'u+' : 'u-'); P.spot(B, 'sit', u, D / 2, su < 0 ? 'u+' : 'u-');
  }
  P.spot(B, 'music', L / 2 - ring, D / 2 + 4, 'u+', { r: 5 });
  P.spot(B, 'stroll', L / 2 + ring, D / 2 - 6, 'u-');
  P.spot(B, 'chat', L / 2, Math.min(D - 5, D / 2 + ring), 'out', { r: 2.6 });
  P.spot(B, 'observe', L / 2, Math.max(5, D / 2 - ring), 'in');
};
