// 저장되는 게임 상태. 새 항목을 추가하면 defaultState() 에도 넣고, 필요하면 migrate() 에 이전 버전 처리를 더하세요.
import { LANDING_START, LANDER_YAW } from '../data/places.js';
const KEY = 'seren.save.v1';
const SETTINGS_KEY = 'seren.settings.v1';
export const SEEN_KEY = 'seren.seenVersion'; // 업데이트 내역을 열어 본 판 (슬롯과 상관없는 전역)
export const SAVE_VERSION = 1;
// 이야기 판: 2 = 새 이야기(착륙 → 첫 접촉 → 이웃 → 이름 노래 → 듣는 탑들이 노래 → 온 하늘에 대답).
// 옛 이야기로 저장한 판은 불러올 때 지금까지 한 일(얻은 음·노래하게 한 탑·이름 노래·하늘닻)에 맞는 새 장(章)으로 옮긴다.
export const STORY_VERSION = 2;
const CHAIN = ['mq0', 'mq1', 'mq1b', 'mq2', 'mq2b', 'mq3', 'mq4', 'mq5', 'mq6', 'mq7', 'mq8'];
const GREAT = ['rift-pylon', 'plains-pylon', 'ice-pylon', 'falls-pylon'];
function remapStory(s) {
  const P = Object.keys(s.pylons || {}), g = P.filter((id) => GREAT.includes(id)).length, c = P.length - g;
  const t = s.tones || [], f = s.flags || {};
  let k;
  if (g >= 4) k = 'mq8';
  else if (g > 0 || f.anchorVisit) k = 'mq7';
  else if (c >= 5 && s.nameSong) k = 'mq6';
  else if (s.nameSong) k = 'mq5';
  else if (c >= 3) k = 'mq4';
  else if (t.includes(2)) k = f.helpedNeighbor ? 'mq3' : 'mq2b';
  else if (f.skimmer) k = 'mq2';
  else if (t.includes(1)) k = 'mq1b';
  else if (t.includes(0)) k = 'mq1';
  else k = 'mq0';
  const q = s.quests || {};
  const side = (q.done || []).filter((id) => !id.startsWith('mq'));
  const sideActive = (q.active || []).filter((id) => !id.startsWith('mq'));
  s.quests = { active: [k, ...sideActive], done: [...CHAIN.slice(0, CHAIN.indexOf(k)), ...side], step: { [k]: 0 }, data: { [k]: {} } };
  for (const id of sideActive) { s.quests.step[id] = (q.step || {})[id] || 0; s.quests.data[id] = (q.data || {})[id] || {}; }
  f.storyMigrated = k;
  s.flags = f;
}

export function defaultState() {
  return {
    version: SAVE_VERSION,
    storyVer: STORY_VERSION,
    created: Date.now(),
    saved: 0,
    playTime: 0,
    player: { x: LANDING_START[0], y: null, z: LANDING_START[1], yaw: LANDER_YAW },
    clock: 0.66,
    flags: {}, // 이야기 진행 플래그
    tones: [], // 얻은 공명 음 (0..4)
    vocab: {}, // 단어 id → 1(추정) | 2(확실)
    exposure: {}, // 단어 id → 들은 횟수
    heard: [], // [{line, t, place}]
    discovered: {}, // 장소 id → 시각
    vistas: {},
    glyphs: {}, // 글자돌 id → true
    echoes: {}, // 메아리 id → true
    codex: {}, // 도감 id → true
    pylons: {}, // 노래하게 한 공명탑 (듣던 탑이 대답한 것)
    quests: { active: [], done: [], step: {}, data: {} },
    inv: { starseed: 0, seedstar: 0, shard: 0, flower: 0, fruit: 0, trinket: 0, tea: 0, cookie: 0, meal: 0, lantern: 0, mapshard: 0, book: 0, parcel: 0 },
    venue: { exhibits: {}, archives: {}, museums: {}, buffs: {}, days: {}, job: null, earned: 0, spent: 0, worked: 0 }, // 건물의 일 (v0.7)
    // 건물 속 (v0.9): 일자리·지원·교대·과제·호텔 방 / 건물마다 바뀐 상태(연구 진척·내 집 칸·맡긴 물건…) / 도시 살림(구역 돈·재고·살아 있는 건물)
    work: { jobs: [], apps: [], shift: null, done: 0, earned: 0, edu: {}, research: {}, hotel: null },
    bld: {},
    lib: { borrowed: [], read: {}, done: {} }, // 서고: 빌린 책 [{ id, uid, floor, fid, si, e, title, day }] · 읽은 쪽 · 다 읽은 날
    econ: null,
    inside: null, // 저장할 때 건물 안이면 { rid, x, z, floor, uid } — 불러오면 그 건물 그 층으로
    rooms: {}, // 들어가 본 방: '구역:모양:번호' → { v: 들른 횟수, d: 처음 온 날 } (방마다 따로)
    home: null, // 하모네아가 내어 준 우리 집 (도시 건물 기록 id)
    homeAt: null, // 그 집의 자리 [x, z] (화질이 바뀌어 건물 번호가 달라져도 다시 찾게)
    cit: { f: {}, talked: {}, trinkets: 0 }, // 주민과 친한 정도 (자리 id#순번 → 0..5)
    upgrades: { glide: 0, skim: 0, rise: 0, detector: 0 },
    harmony: {}, // 지역 → 0..100
    nameSong: null,
    requestsDone: 0,
    reveal: '', // 지도 안개 걷힘 (압축 문자열)
    stats: { distance: 0, glideDistance: 0, tones: 0, currentRides: 0, daysSeen: 0 },
    journal: [], // 모아의 기록
    waypoint: null,
    // 쓰임이 있는 건물 (v0.3): 들른 시설, 읽은 책, 온실 밭(심은 시각), 날마다 한 번씩 하는 일, 빛깔, 고른 날씨
    facility: { visited: {}, books: {}, garden: {}, daily: {}, cosmetic: 0, weather: null },
  };
}

export function defaultSettings() {
  return {
    quality: null,
    vol: { master: 0.9, music: 0.6, sfx: 0.85, ambience: 0.7, voice: 0.85 },
    sensitivity: 1,
    invertY: false,
    view: 'third', // 시점: 'third' 3인칭 · 'first' 1인칭 (V · 터치 「시점」)
    hints: true,
    subtitlesSpeed: 1,
    moaClaude: true, // 아티팩트에서 모아가 Claude 로 대답 (끄면 기본 모드)
  };
}

// ── 저장 슬롯 (v24 · 문서 P1 「단일 세이브 1개 구조를 폐기하고 여러 독립 저장 슬롯」) ──────────────
//  슬롯마다 따로 된 열쇠 둘: 'seren.slot.<id>'(게임 상태 전체 — 세계·주민 기억·살림·퀘스트·가방·자리·시각·실내 상태)과
//  'seren.slotmeta.<id>'(목록에 보일 요약: 이름·저장 시각·놀이 시간·자리·목표·저장 판·작은 그림). 목록은 요약만 읽어
//  한 슬롯이 깨져도(읽기 실패·옛 판) 그 슬롯만 「불러올 수 없음」으로 보이고 다른 슬롯은 그대로다.
//  같은 열쇠의 쓰기는 한 번에 일어나므로 저장 도중 탭이 닫혀도 다른 슬롯은 건드리지 않는다. 활성 슬롯 id 는 'seren.slots.v1'.
//  설정·업데이트 내역을 본 판은 슬롯과 상관없는 전역 열쇠(SETTINGS_KEY·SEEN_KEY).
const SLOT = 'seren.slot.', META = 'seren.slotmeta.', SLOTS_KEY = 'seren.slots.v1';
export const MAX_SLOTS = 8;
const ls = () => { try { return globalThis.localStorage || null; } catch { return null; } };
function readJSON(k) { const L = ls(); if (!L) return null; const raw = L.getItem(k); return raw ? JSON.parse(raw) : null; }
function slotIds() {
  const L = ls(), ids = [];
  if (!L) return ids;
  for (let i = 0; i < L.length; i++) { const k = L.key(i); if (k && k.startsWith(META)) ids.push(k.slice(META.length)); else if (k && k.startsWith(SLOT) && !ids.includes(k.slice(SLOT.length))) ids.push(k.slice(SLOT.length)); }
  return [...new Set(ids)];
}
/** 옛 단일 저장(seren.save.v1)이 있고 슬롯이 하나도 없으면 첫 슬롯으로 옮긴다 (옛 열쇠는 지운다 — 같은 진행이 두 군데 있지 않게) */
function adoptLegacy() {
  const L = ls();
  if (!L) return;
  try {
    const raw = L.getItem(KEY);
    if (!raw || slotIds().length) return;
    const s = JSON.parse(raw);
    const id = newSlotId();
    L.setItem(SLOT + id, raw);
    L.setItem(META + id, JSON.stringify({ id, name: '여정 1', created: s.created || Date.now(), saved: s.saved || Date.now(), playTime: s.playTime || 0, ver: s.version || 1, place: '', objective: '' }));
    L.setItem(SLOTS_KEY, JSON.stringify({ active: id }));
    L.removeItem(KEY);
  } catch (e) { console.warn('[save] 옛 저장 옮기기 실패', e); }
}
function newSlotId() { return Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36); }

/** 슬롯 목록 (최근 저장 순): [{ id, name, saved, playTime, place, objective, ver, thumb, broken }] */
export function listSlots() {
  adoptLegacy();
  const out = [];
  for (const id of slotIds()) {
    let m = null;
    try { m = readJSON(META + id); } catch { m = null; }
    const hasData = !!(ls() && ls().getItem(SLOT + id));
    if (!m) out.push({ id, name: '이름 없는 여정', saved: 0, playTime: 0, broken: !hasData ? '저장 내용이 없어요' : '요약을 읽지 못했어요 — 불러오기는 시도할 수 있어요' });
    else out.push({ ...m, id, broken: hasData ? null : '저장 내용이 없어요' });
  }
  return out.sort((a, b) => (b.saved || 0) - (a.saved || 0));
}
export function activeSlot() { try { return (readJSON(SLOTS_KEY) || {}).active || null; } catch { return null; } }
export function setActiveSlot(id) { try { ls() && ls().setItem(SLOTS_KEY, JSON.stringify({ active: id })); } catch { /* 무시 */ } }
/** 새 슬롯 (빈 상태 — 첫 저장 때 내용이 생긴다). 꽉 찼으면 null */
export function createSlot(name) {
  if (listSlots().length >= MAX_SLOTS) return null;
  const id = newSlotId();
  const n = name && name.trim() ? name.trim().slice(0, 24) : `여정 ${listSlots().length + 1}`;
  try { ls().setItem(META + id, JSON.stringify({ id, name: n, created: Date.now(), saved: 0, playTime: 0, ver: SAVE_VERSION, place: '', objective: '' })); } catch (e) { console.warn('[save] 슬롯 만들기 실패', e); return null; }
  return id;
}
export function renameSlot(id, name) {
  try { const m = readJSON(META + id) || { id }; m.name = (name || '').trim().slice(0, 24) || m.name; ls().setItem(META + id, JSON.stringify(m)); return true; } catch { return false; }
}
export function deleteSlot(id) {
  try { ls().removeItem(SLOT + id); ls().removeItem(META + id); if (activeSlot() === id) ls().removeItem(SLOTS_KEY); } catch { /* 무시 */ }
}
/** 슬롯 비우기 (덮어써 새로 시작) — 이름은 남긴다 */
export function clearSlot(id) {
  try { ls().removeItem(SLOT + id); const m = readJSON(META + id) || { id, name: '여정' }; ls().setItem(META + id, JSON.stringify({ ...m, saved: 0, playTime: 0, place: '', objective: '', thumb: null, created: Date.now(), ver: SAVE_VERSION })); } catch { /* 무시 */ }
}

export function hasSave() { return listSlots().some((m) => !m.broken || /요약/.test(m.broken)); }

/** 슬롯 불러오기 (그 슬롯의 판에 맞춰 옮긴다). 실패하면 null — 다른 슬롯에는 영향 없음 */
export function loadState(id = activeSlot()) {
  if (!id) { const first = listSlots().find((m) => !m.broken); id = first && first.id; }
  if (!id) return null;
  try {
    const raw = ls().getItem(SLOT + id);
    if (!raw) return null;
    const s = migrate(JSON.parse(raw));
    setActiveSlot(id);
    return s;
  } catch (e) {
    console.warn('[save] 슬롯 불러오기 실패', id, e);
    return null;
  }
}

/** 지금 슬롯에만 저장 (meta: 목록 요약 — 자리·목표·작은 그림) */
export function saveState(s, id = activeSlot(), meta = {}) {
  if (!id) return false;
  try {
    s.saved = Date.now();
    ls().setItem(SLOT + id, JSON.stringify(s)); // 내용 먼저 (요약이 내용보다 앞서지 않게)
    const m = readJSON(META + id) || { id, name: '여정', created: s.created || Date.now() };
    const next = { ...m, id, saved: s.saved, playTime: s.playTime || 0, ver: s.version || SAVE_VERSION, ...meta };
    if (meta.thumb === undefined) next.thumb = m.thumb || null;
    ls().setItem(META + id, JSON.stringify(next));
    return true;
  } catch (e) {
    console.warn('[save] 저장 실패', e);
    return false;
  }
}
/** 요약만 고치기 (작은 그림을 다음 프레임에 붙일 때) */
export function patchSlotMeta(id, patch) {
  try { const m = readJSON(META + id); if (!m) return; ls().setItem(META + id, JSON.stringify({ ...m, ...patch })); } catch (e) { console.warn('[save] 요약 저장 실패', e); }
}

/** 옛 호출: 지금 슬롯을 지운다 */
export function deleteSave() { const id = activeSlot(); if (id) deleteSlot(id); }

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return { ...defaultSettings(), ...(raw ? JSON.parse(raw) : {}) };
  } catch { return defaultSettings(); }
}

export function saveSettings(s) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* 무시 */ }
}

function migrate(s) {
  const d = defaultState();
  if ((s.storyVer || 1) < STORY_VERSION) { remapStory(s); s.storyVer = STORY_VERSION; }
  // 빠진 항목은 기본값으로 채움 (얕은 병합 + 한 단계 객체)
  for (const k of Object.keys(d)) {
    if (s[k] === undefined) s[k] = d[k];
    else if (d[k] && typeof d[k] === 'object' && !Array.isArray(d[k]) && s[k] && typeof s[k] === 'object') {
      for (const kk of Object.keys(d[k])) if (s[k][kk] === undefined) s[k][kk] = d[k][kk];
    }
  }
  s.version = SAVE_VERSION;
  return s;
}
