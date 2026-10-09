// 주민의 하루와 기억 (v24 「주민 행동 다양성」 · 「맥락·기억 기반 생활 대화」):
//  · 하루 블록: 일 → (일하는 중간) 쉬는 시간 — 가까운 쉼 자리·이웃 자리로 → 다시 일 → (일 끝나고) 볼일 — 장터·쉼터 → 귀가.
//    모두 그 사람의 씨앗·날짜·실제 둘레 자리에서 정해진다 (같은 날 같은 사람은 늘 같게 — 저장/불러오기 뒤에도).
//  · 기억(state.cit.mem[주민 열쇠]): 만난 횟수 · 처음·마지막 만남(날·때·자리) · 함께 겪은 일(놀이·노래·짐…, 날짜) · 받은 선물 ·
//    최근에 한 말(되풀이 막기). 저장 슬롯에 남는다.
//  · 말: 아웬 말 단어(lexicon) + 한국어 뜻 — 기억(처음/오늘 또/오랜만/함께 한 일)과 그 사람의 일·때에 맞춘 조각을 고른다.
import { hashStr, mulberry32 } from '../core/noise.js';

const DAYF = 1; // 하루 = 1

/** 이 사람의 오늘: 쉬는 시간(일하는 창 안)·볼일(일 끝난 뒤) — 씨앗·날짜로 정한다 */
export function dayPlan(p, day, a, b) {
  const r = mulberry32(hashStr(`${p.key}|${day}|${a.toFixed(3)}`));
  const span = b - a;
  const out = { brk: null, errand: null };
  if (span > 0.12 && r() < 0.8) { const s = a + span * (0.38 + r() * 0.24); out.brk = { s, e: s + 0.018 + r() * 0.012 }; }
  if (r() < 0.6) out.errand = { dur: 0.02 + r() * 0.02 };
  out.pickB = r(); out.pickE = r();
  return out;
}

/** 가는 길 하나 (s→e 사이에 갔다 머물다 돌아오기): from 에서 to 로 걸어가 머문 뒤 다시 from 으로. 걷는 시간은 거리/속도 */
export function excursion(t, s, e, from, to, speed, DAY, back = true) {
  const d = Math.hypot(to.x - from.x, to.z - from.z);
  const w = Math.min((e - s) * 0.35, Math.max(0.002, d / speed / DAY));
  if (t < s + w) return { walk: true, from, to, f: (t - s) / w };
  if (back && t > e - w) return { walk: true, from: to, to: from, f: (t - (e - w)) / w };
  return { at: true, x: to.x, z: to.z, yaw: to.yaw ?? 0, act: to.act, sit: !!to.sit };
}

// ── 기억 ─────────────────────────────────────────────
export function memOf(S, key) {
  const M = S.mem || (S.mem = {});
  return M[key] || (M[key] = { n: 0, first: null, last: null, ev: [], gift: 0, rec: [] });
}
/** 함께 겪은 일 하나 (최근 8개) */
export function remember(S, key, kind, day) {
  const m = memOf(S, key);
  m.ev.push({ k: kind, day });
  if (m.ev.length > 8) m.ev.splice(0, m.ev.length - 8);
}

// 기억에 따른 말 조각 [단어들, 뜻] — 단어는 lexicon 에 있는 것만
const GREET = {
  first: [[['first', 'see', 'you'], '처음 보네요. 나는 {name}.'], [['you', 'far', 'star', '?'], '먼 별에서 온 분이죠? 나는 {name}이에요.']],
  today: [[['again', 'see', 'you'], '또 만났네요.'], [['you', 'here', 'again'], '여기 또 왔네요.'], [['again', 'you', 'joy'], '오늘만 몇 번째예요? 반가워요.'],
    [['you', 'walk', 'far', '?'], '오늘 많이 걸어 다니네요?'], [['again', 'share', 'story'], '또 이야기하러 왔어요? 좋아요.']],
  todayElse: [[['again', 'see', 'you', 'here'], '아까 {place}에서 봤는데, 여기서도 보네요.'], [['you', 'walk', 'far', 'here'], '{place}에서 여기까지 왔어요?']],
  long: [[['long', 'time', 'see', 'you'], '오랜만이에요. {days}일 만이네요.'], [['you', 'return', 'joy'], '돌아왔군요. 반가워요.'],
    [['long', 'where', 'go', '?'], '한동안 안 보이던데, 어디 다녀왔어요?']],
  usual: [[['you', 'see', 'good'], '안녕하세요.'], [['day', 'good', '?'], '오늘 어때요?'], [['you', 'again', 'good'], '어제 봤죠? 또 보니 좋네요.'],
    [['day', 'work', 'you', '?'], '오늘은 뭐 하며 지내요?']],
};
const SHARED = {
  tag: [['together', 'play', 'joy'], '같이 술래잡기한 거 재밌었어요.'],
  kid: [['together', 'play', 'joy'], '아이들이 또 같이 놀재요.'],
  song: [['together', 'sing', 'good'], '함께 노래 주고받은 거, 아직 귀에 남아 있어요.'],
  tune: [['song', 'make', 'thanks'], '장치 음 맞춰 준 거 고마웠어요. 지금도 잘 울려요.'],
  garden: [['flower', 'grow', 'thanks'], '같이 물 준 싹이 자라고 있어요.'],
  carry: [['thanks', 'carry', 'together'], '짐 날라 준 거 정말 고마웠어요.'],
  meditate: [['together', 'still', 'good'], '함께 고요해진 뒤로 마음이 가벼워요.'],
  meal: [['together', 'eat', 'home'], '같이 먹은 저녁, 식구들이 또 오래요.'],
  gift: [['gift', 'thanks', 'heart'], '준 선물, 잘 두고 있어요.'],
};
const LIFE = { // 하는 일·때에 따른 생활 말 (기능과 상관없는 것도)
  morning: [[['day', 'rise', 'work'], '해가 떴으니 일하러 가요.']],
  evening: [[['work', 'tired', 'rest'], '오늘 일은 끝. 좀 쉬어야겠어요.'], [['home', 'eat', 'night'], '집에 가서 저녁 먹을 거예요.']],
  break: [[['rest', 'small', 'time'], '잠깐 쉬는 중이에요.'], [['tired', 'rest', 'here'], '여기 앉아 조금 쉬어요.']],
  errand: [[['eat', 'find', 'near'], '저녁거리 사러 왔어요.'], [['flower', 'give', 'friend'], '이웃에게 줄 꽃을 고르는 중이에요.']],
};

/** 기억을 보고 인사 한 줄 + (함께 한 일이 있으면) 후일담 한 줄. place: 지금 자리 이름 */
export function memoryLines(p, m, { day, time, place }) {
  const out = [];
  const fill = (s) => s.replace('{name}', p.name).replace('{place}', m.last ? m.last.place || '저기' : '').replace('{days}', m.last ? Math.max(1, Math.floor(day - m.last.day)) : '');
  const r = mulberry32(hashStr(`${p.key}|${day}|${m.n}`));
  let pool, kind;
  if (!m.n) { pool = GREET.first; kind = 'first'; }
  else if (m.last && Math.floor(m.last.day) === Math.floor(day)) { pool = m.last.place && place && m.last.place !== place ? GREET.todayElse : GREET.today; kind = 'today'; }
  else if (m.last && day - m.last.day >= 3) { pool = GREET.long; kind = 'long'; }
  else { pool = GREET.usual; kind = 'usual'; }
  const pickNew = (arr, tag) => { const cand = arr.map((x, i) => [x, `${tag}${i}`]).filter(([, id]) => !m.rec.includes(id)); const c = cand.length ? cand : arr.map((x, i) => [x, `${tag}${i}`]); return c[Math.floor(r() * c.length)]; };
  const [g0, gid] = pickNew(pool, kind);
  out.push({ id: `mem_${kind}_${gid}`, words: g0[0], ko: fill(g0[1]), tag: gid });
  // 후일담: 최근 3일 안에 함께 한 일 (이미 말한 것은 빼고)
  const ev = [...m.ev].reverse().find((e) => day - e.day <= 3 && SHARED[e.k] && !m.rec.includes(`ev:${e.k}:${Math.floor(e.day)}`));
  if (ev) { const S = SHARED[ev.k]; out.push({ id: `mem_ev_${ev.k}`, words: S[0], ko: S[1], tag: `ev:${ev.k}:${Math.floor(ev.day)}` }); }
  return out;
}
/** 그 사람의 지금 하루 블록에 맞는 생활 말 (없으면 null) */
export function lifeLine(p, st, time) {
  const t = time % DAYF;
  const key = st && st.act === 'break' ? 'break' : st && st.act === 'errand' ? 'errand' : t > 0.22 && t < 0.34 ? 'morning' : t > 0.72 && t < 0.86 ? 'evening' : null;
  if (!key) return null;
  const arr = LIFE[key], k = Math.floor(Math.random() * arr.length);
  return { id: `life_${key}_${k}`, words: arr[k][0], ko: arr[k][1] };
}
