// 저장되는 게임 상태. 새 항목을 추가하면 defaultState() 에도 넣고, 필요하면 migrate() 에 이전 버전 처리를 더하세요.
const KEY = 'seren.save.v1';
const SETTINGS_KEY = 'seren.settings.v1';
export const SAVE_VERSION = 1;

export function defaultState() {
  return {
    version: SAVE_VERSION,
    created: Date.now(),
    saved: 0,
    playTime: 0,
    player: { x: 606, y: null, z: 8606, yaw: 0 },
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
    pylons: {}, // 깨운 공명탑
    quests: { active: [], done: [], step: {}, data: {} },
    inv: { starseed: 0, shard: 0 },
    upgrades: { glide: 0, skim: 0, rise: 0 },
    harmony: {}, // 지역 → 0..100
    nameSong: null,
    requestsDone: 0,
    reveal: '', // 지도 안개 걷힘 (압축 문자열)
    stats: { distance: 0, glideDistance: 0, tones: 0, currentRides: 0, daysSeen: 0 },
    journal: [], // 모아의 기록
    waypoint: null,
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
