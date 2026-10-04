// 저장되는 게임 상태. 새 항목을 추가하면 defaultState() 에도 넣고, 필요하면 migrate() 에 이전 버전 처리를 더하세요.
import { LANDING_START, LANDER_YAW } from '../data/places.js';
const KEY = 'seren.save.v1';
const SETTINGS_KEY = 'seren.settings.v1';
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
    hints: true,
    subtitlesSpeed: 1,
    moaClaude: true, // 아티팩트에서 모아가 Claude 로 대답 (끄면 기본 모드)
  };
}

export function hasSave() {
  try { return !!localStorage.getItem(KEY); } catch { return false; }
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return migrate(JSON.parse(raw));
  } catch (e) {
    console.warn('[save] 불러오기 실패', e);
    return null;
  }
}

export function saveState(s) {
  try {
    s.saved = Date.now();
    localStorage.setItem(KEY, JSON.stringify(s));
    return true;
  } catch (e) {
    console.warn('[save] 저장 실패', e);
    return false;
  }
}

export function deleteSave() {
  try { localStorage.removeItem(KEY); } catch { /* 무시 */ }
}

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
