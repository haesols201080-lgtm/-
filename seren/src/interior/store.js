// 건물 구조 저장 (v0.9): 처음 들어갈 때 만든 기본 구조(층·쓰임·방·복도·계단·승강기·가구·장비·빛깔)를 건물 uid 로 저장한다.
//  · 같은 건물은 늘 같은 구조 — 씨앗으로 다시 만들어도 같지만, 생성기 판이 바뀌어도 이미 본 건물은 그대로 남도록 저장해 둔다.
//  · 바뀌는 상태(재고·기계·밭·사람이 옮긴 것·플레이어가 남긴 것)는 게임 저장(state.bld)에 따로 — 이것은 구조만.
//  · 칸 덮개는 RLE 문자열로 줄인다. 저장 공간이 모자라면 오래 안 간 건물부터 지운다(우리 집·일터는 지우지 않는다).
import { makeBuilding } from './program.js';
import { layoutFloor } from './layout.js';
import { furnishFloor } from './recipes.js';
import { volumeOf } from './volume.js';
import { GEN_VERSION, uidOf } from './ids.js';

const KEY = 'seren.bld.v1';
const MAX_CHARS = 1_600_000;

// ── RLE ──
export function rle(arr) {
  let out = '', prev = arr[0], n = 0;
  for (let k = 0; k <= arr.length; k++) {
    const v = k < arr.length ? arr[k] : NaN;
    if (v === prev) { n++; continue; }
    out += `${prev.toString(36)}.${n.toString(36)},`;
    prev = v; n = 1;
  }
  return out;
}
export function unrle(s, n, Type = Uint8Array) {
  const a = new Type(n);
  let o = 0;
  for (const part of s.split(',')) {
    if (!part) continue;
    const [v, c] = part.split('.');
    const val = parseInt(v, 36), cnt = parseInt(c, 36);
    a.fill(val, o, o + cnt);
    o += cnt;
  }
  return a;
}

// ── 건물 짜임 ↔ 저장 꼴 ──
function packB(B) {
  const N = B.G.gw * B.G.gh;
  return {
    v: B.v, uid: B.uid, seed: B.seed, kind: B.kind, use: B.use, pid: B.pid, size: B.size, gfa: B.gfa, G: B.G, theta: B.theta, ground: B.ground,
    zones: B.zones, orgs: B.orgs, mainOrg: B.mainOrg, roof: B.roof, atrium: B.atrium, podium: B.podium, door: B.door, module: B.module, bay: B.bay, volume: B.volume,
    core: B.core, links: B.links, atriumCells: B.atriumCells ? rle(Uint8Array.from({ length: N }, (_, c) => (B.atriumCells.includes(c) ? 1 : 0))) : null,
    floors: B.floors.map((F) => ({ ...F, mask: rle(F.mask), terrace: F.terrace ? { ...F.terrace, mask: rle(F.terrace.mask) } : null })),
  };
}
function unpackB(P, r) {
  const N = P.G.gw * P.G.gh;
  const B = { ...P };
  B.V = volumeOf(r);
  B.floors = P.floors.map((F) => ({ ...F, mask: unrle(F.mask, N), terrace: F.terrace ? { ...F.terrace, mask: unrle(F.terrace.mask, N) } : null }));
  if (P.atriumCells) { const m = unrle(P.atriumCells, N); B.atriumCells = []; for (let c = 0; c < N; c++) if (m[c]) B.atriumCells.push(c); }
  return B;
}
function packL(L, fix) {
  return {
    i: L.i, use: L.use, gw: L.gw, gh: L.gh, room: rle(L.room), void: rle(L.void), ents: L.ents, lifthall: L.lifthall, boh: L.boh, galleries: L.galleries, mezzWalk: L.mezzWalk, org: L.org, closed: L.closed,
    rooms: L.rooms, doors: L.doors,
    fix: fix.map((q) => { const o = { ...q }; delete o.accK; return o; }),
  };
}
function unpackL(P) {
  const n = P.gw * P.gh;
  return { L: { ...P, room: unrle(P.room, n, Int16Array), void: unrle(P.void, n) }, fix: P.fix };
}

export class PlanStore {
  constructor(game) {
    this.game = game;
    this.mem = new Map(); // uid → { B, floors: Map(i → {L, fix}) }
    this.disk = {};
    try { const raw = localStorage.getItem(KEY); if (raw) this.disk = JSON.parse(raw) || {}; } catch { this.disk = {}; }
    this._dirty = false;
  }
  ctx() {
    const g = this.game;
    return { profile: (k) => g.interiors.profile(k), pid: (r) => g.interiors.info(r).pid };
  }
  /** 건물 짜임 (만들거나 꺼내거나) */
  plan(r) {
    const uid = uidOf(r);
    let e = this.mem.get(uid);
    if (e) return e.B;
    const d = this.disk[uid];
    let B = null;
    if (d && d.B) { try { B = unpackB(d.B, r); } catch (err) { console.warn('[bld] 저장된 구조를 못 읽음', uid, err); B = null; } }
    if (!B) {
      B = makeBuilding(r, this.ctx());
      if (!B) return null;
      this.disk[uid] = { B: packB(B), F: {}, t: Date.now(), gen: GEN_VERSION };
      this._dirty = true;
    }
    e = { B, floors: new Map() };
    this.mem.set(uid, e);
    if (this.disk[uid]) this.disk[uid].t = Date.now();
    return B;
  }
  /** 층 평면 + 가구 (처음 필요할 때 만들고 저장) */
  floor(r, i) {
    const uid = uidOf(r);
    const B = this.plan(r);
    if (!B) return null;
    const e = this.mem.get(uid);
    if (e.floors.has(i)) return e.floors.get(i);
    const d = this.disk[uid];
    let out = null;
    if (d && d.F && d.F[i]) { try { out = unpackL(d.F[i]); } catch { out = null; } }
    if (!out) {
      const F = B.floors[i];
      const L = layoutFloor(B, F, { door: B.door });
      const fx = L.closed ? { list: [] } : furnishFloor(B, L);
      out = { L, fix: fx.list };
      if (d) { d.F = d.F || {}; d.F[i] = packL(L, fx.list); this._dirty = true; }
    }
    e.floors.set(i, out);
    return out;
  }
  /** 저장 (가끔): 크면 오래된 건물부터 지운다 */
  flush() {
    if (!this._dirty) return;
    this._dirty = false;
    const s = this.game.state;
    const keep = new Set();
    if (s.home != null && this.game.city && this.game.city.recs[s.home]) keep.add(uidOf(this.game.city.recs[s.home]));
    for (const j of (s.work && s.work.jobs) || []) keep.add(j.uid);
    let str = JSON.stringify(this.disk);
    if (str.length > MAX_CHARS) {
      const ids = Object.keys(this.disk).filter((u) => !keep.has(u)).sort((a, b) => (this.disk[a].t || 0) - (this.disk[b].t || 0));
      while (str.length > MAX_CHARS * 0.8 && ids.length) { delete this.disk[ids.shift()]; str = JSON.stringify(this.disk); }
    }
    try { localStorage.setItem(KEY, str); } catch (e) { console.warn('[bld] 구조 저장 실패', e); }
  }
}
