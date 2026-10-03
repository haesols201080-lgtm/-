// 서고의 서가 (v0.9): 서가마다 실제 책이 꽂혀 있다 — 칸마다 책등(id)이 있고, 꺼내면 쪽마다 읽는다.
//  · 층의 서가를 자리 차례(방 → 앞뒤 → 좌우)로 늘어놓고 분류 차례로 꽂는다(도서관의 분류 번호처럼 이웃한 서가는 이웃한 분류).
//  · 서고가 여러 층이면 층마다 맡는 분류가 다르다. 학교의 배움터는 어린이·이야기·말과 글이 먼저.
//  · 목록의 책을 다 꽂고 남는 칸은 그 분류의 끝없는 책(books.moreOf: 관찰 일지·관측 기록·부엌 수첩·정비 일지·돌봄 일지·
//    고리 걷기·모임 기록·말 익힘책·연대 기록·이야기·시)으로, 기록 서고(archive)는 그 구역의 연대 기록(권마다 한 해)으로
//    채운다 — 같은 건물은 늘 같은 책이 같은 칸에.
//  · 빌린 책(state.lib.borrowed)·손에 든 책은 그 자리가 비어 보인다(ops._drawItems).
import { BOOKS, BOOK, SUBJECTS, bookById, moreOf, annalId } from '../data/books.js';
import { hashStr } from '../core/noise.js';

/** 칸 하나(서가 한 단의 절반)에 꽂힌 책 수 · 서가 단 수 · 단마다 칸 수 (props.js 의 책 서가 모양과 같은 수) */
export const SPINES = 12, SHELF_LEVELS = 5, SHELF_COLS = 2;
const SLOTS = SHELF_LEVELS * SHELF_COLS;
/** 서가 하나의 칸 수 (작은 서가는 한 줄) */
export const slotsOf = (F) => (F.t === 'bookcase' ? SHELF_LEVELS : SLOTS);
const ORDER = ['history', 'nature', 'sky', 'song', 'story', 'child', 'words', 'tech', 'life', 'heal', 'city', 'law'];
const SCHOOL = ['child', 'story', 'words', 'nature', 'sky', 'song', 'tech', 'history', 'life', 'heal', 'city', 'law'];
const bySubj = {};
for (const b of BOOKS) (bySubj[b.subject] = bySubj[b.subject] || []).push(b.id);

/** 서고 층들 (책이 있는 쓰임) */
export function libraryFloors(B) { return B.floors.filter((F) => F.use === 'library' && F.reach !== false && !F.dead).map((F) => F.i); }

/** 층의 서가를 자리 차례로 */
export function shelvesOf(fix) {
  return fix.filter((F) => F.t === 'bookshelf' || F.t === 'bookcase').sort((a, b) => (a.room - b.room) || (a.z - b.z) || (a.x - b.x));
}

/** 이 층이 맡는 분류: 서고 층이 여럿이면 차례로 나눠 맡고(남는 층은 다시 처음부터), 하나면 전부 — 짜임(plan) 없이 정해진다 */
export function floorSubjects(B, i) {
  const libs = libraryFloors(B);
  const N = Math.max(1, libs.length), rank = Math.max(0, libs.indexOf(i));
  const order = B.pid === 'school' ? SCHOOL : ORDER;
  const per = Math.max(1, Math.ceil(order.length / N)), at = (rank * per) % order.length;
  return { subs: N === 1 ? order : order.slice(at, at + per), rank, N };
}

/**
 * 한 층의 서가 채우기.
 * ctx: { uid, zone, B, i(층) }, fix: 층의 가구
 * 분류마다 같은 몫: 목록의 책을 모두 꽂고(칸이 넉넉하면 권마다 1~3부), 남는 칸은 그 분류의 끝없는 책(moreOf)으로 —
 * 그래서 서가는 늘 한 분류로 이어지고, 큰 서고도 같은 책만 되풀이하지 않는다.
 * 반환: Map(fid → { subject, spines: [[id × SPINES] × 칸(단 × 좌우)] })
 */
export function stockFloor(ctx, fix) {
  const { uid, zone, B, i } = ctx;
  const { subs, rank } = floorSubjects(B, i);
  const shelves = shelvesOf(fix);
  const open = shelves.filter((F) => F.tag !== 'archive'), arch = shelves.filter((F) => F.tag === 'archive');
  const cap = open.reduce((a, F) => a + slotsOf(F) * SPINES, 0);
  const total = subs.reduce((a, s) => a + (bySubj[s] || []).length, 0);
  const seq = [];
  if (cap > 0) {
    const copies = Math.max(1, Math.min(3, 1 + Math.floor((cap / Math.max(1, total) - 1) / 4)));
    // 그 분류의 몇 번째 권부터: 건물마다 조금씩 다르게(도시의 서고마다 다른 책), 같은 분류를 다시 맡은 층은 더 뒤의 권부터
    const base = (hashStr(uid) % 20) * 30 + Math.floor(rank / ORDER.length) * 3000;
    subs.forEach((s, k) => {
      const L = bySubj[s] || [];
      const share = k === subs.length - 1 ? cap - seq.length : Math.floor(cap * (cap >= total ? 1 / subs.length : L.length / Math.max(1, total)));
      const part = [];
      for (const id of L) { if (part.length >= share) break; const c = 1 + (hashStr(`${uid}|${id}`) % copies); for (let q = 0; q < c && part.length < share; q++) part.push(id); }
      for (let n = 0; part.length < share; n++) part.push(moreOf(s, base + n, zone));
      seq.push(...part);
    });
  }
  const out = new Map();
  let k = 0;
  for (const F of open) {
    const spines = [], cnt = {};
    for (let s = 0; s < slotsOf(F); s++) {
      const row = [];
      for (let e = 0; e < SPINES; e++) { const id = seq[k++] || null; row.push(id); if (id) { const sb = subjectOfId(id); cnt[sb] = (cnt[sb] || 0) + 1; } }
      spines.push(row);
    }
    const top = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
    out.set(F.id, { subject: top ? top[0] : subs[0], spines });
  }
  // 기록 서고: 이 구역의 연대 기록, 권마다 한 해 (층마다 다른 권부터)
  let v = rank * 2000;
  for (const F of arch) {
    const spines = [];
    for (let s = 0; s < slotsOf(F); s++) { const row = []; for (let e = 0; e < SPINES; e++) row.push(annalId(zone, v++)); spines.push(row); }
    out.set(F.id, { subject: 'history', annal: true, spines });
  }
  return out;
}
/** 책 id 의 분류 (책을 짓지 않고) */
function subjectOfId(id) {
  const b = BOOK[id];
  if (b) return b.subject;
  if (id.startsWith('n-')) return 'history';
  if (id.startsWith('s-')) return 'song';
  if (id.startsWith('g-')) return id.split('-')[1];
  if (id.startsWith('t-')) return +id.slice(2) % 3 === 0 ? 'child' : 'story';
  return 'story';
}

export const subjectName = (s) => SUBJECTS[s] || s;
/** 칸 번호 → 「3단 왼쪽」 */
export const slotName = (si, F) => (F && F.t === 'bookcase' ? `${si + 1}단` : `${Math.floor(si / SHELF_COLS) + 1}단 ${SHELF_COLS === 2 ? (si % 2 ? '오른쪽' : '왼쪽') : ''}`.trim());

/**
 * 건물의 서고 색인 (찾기 단말·모아): 목록의 책 id → 그 책을 맡은 층, 층마다 분류.
 * 층의 짜임 없이 정해진다(floorSubjects) — 정확한 서가·칸은 locate 가 그 층 하나만 펴서 찾는다.
 */
export function libraryIndex(cur) {
  if (cur._libIdx) return cur._libIdx;
  const B = cur.B, at = new Map(), floors = [];
  for (const i of libraryFloors(B)) {
    const { subs } = floorSubjects(B, i);
    floors.push({ floor: i, subs });
    for (const s of subs) for (const id of bySubj[s] || []) if (!at.has(id)) at.set(id, i);
  }
  cur._libIdx = { at, floors };
  return cur._libIdx;
}
/** 책 id 가 꽂힌 자리 (그 층의 첫 자리) → { floor, F, si } 또는 null */
export function locate(cur, zone, id, floor) {
  const pl = cur.indoor.plan(floor);
  if (!pl) return null;
  for (const [fid, en] of stockFor(cur, zone, floor, pl.fix)) {
    const si = en.spines.findIndex((row) => row.includes(id));
    if (si >= 0) return { floor, F: pl.fix.find((f) => f.id === fid), si, subject: en.subject };
  }
  return null;
}
/** 한 층의 서가 (건물마다 기억) */
export function stockFor(cur, zone, i, fix) {
  const m = cur._libStock || (cur._libStock = new Map());
  if (!m.has(i)) m.set(i, stockFloor({ uid: cur.uid, zone, B: cur.B, i }, fix));
  return m.get(i);
}

// ── 읽기 상태 (state.lib) ──
export function libState(game) {
  const s = game.state;
  if (!s.lib) s.lib = { borrowed: [], read: {}, done: {} };
  if (!s.lib.done) s.lib.done = {};
  return s.lib;
}
/**
 * 쪽을 넘길 때: 읽은 쪽 기억, 끝 쪽에 닿으면 다 읽음 → 책의 말(word) 또는 낱말장의 모르는 말 하나를 배운다.
 * 반환: 이번에 처음 다 읽었으면 true
 */
export function readPage(game, id, page) {
  const S = libState(game), b = bookById(id);
  if (!b) return false;
  S.read[id] = Math.max(S.read[id] || 0, page + 1);
  if (page < b.pages.length - 1 || S.done[id]) return false;
  S.done[id] = game.world.clock.day + 1;
  const L = game.lang;
  let w = b.word && L && !L.known(b.word) ? b.word : null;
  if (!w && b.learn && L) w = b.learn.find((x) => !L.known(x)) || null;
  if (w && L) L.learn(w, 'teach');
  game.ui.toast(`다 읽었다 · 「${b.title}」 (읽은 책 ${Object.keys(S.done).length}권)`, { kind: 'item' });
  return true;
}

/** 서가 하나의 책 목록 (같은 책은 한 줄로) → [{ id, n, si(첫 칸), e }] */
export function shelfTitles(entry, gone = () => false) {
  const m = new Map();
  entry.spines.forEach((row, si) => row.forEach((id, e) => {
    if (!id || gone(si, e)) return;
    const x = m.get(id);
    if (x) x.n++; else m.set(id, { id, n: 1, si, e });
  }));
  return [...m.values()];
}
