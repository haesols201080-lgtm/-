// 한국어 조사 (v24 「한국어 조사·문장 표기 자연화」): 앞말의 받침을 보고 을/를 · 이/가 · 은/는 · 과/와 · 으로/로 · 아/야 · 이라/라 · 이에요/예요 · 이랑/랑 중 하나를 고른다.
//  UI·퀘스트·대사·안내·책 모두 이 함수 하나를 거친다 — 「을(를)」 같은 후보 병기를 화면에 남기지 않는다.
//  받침 판단: 한글 음절은 그대로, 숫자는 읽는 소리(10 십 · 100 백 · 1000 천 · 10000 만 · 끝자리 일/삼/육/칠/팔 …),
//  단위(m·km·%·°)는 읽는 말(미터·킬로미터·퍼센트·도), 영문은 끝소리(머리글자는 글자 이름: L 엘 · M 엠 · N 엔 · R 알),
//  닫는 괄호·따옴표·마침표는 건너뛰고 그 앞 글자로. 판단할 수 없으면 받침 없는 꼴(를·가·는·와·로)로 — 문장을 바꿔 피하는 편이 낫다.

const SKIP = ' \t\n)]}」』"\'’”…·.,!?~';
const DIGIT = [21, 8, 0, 16, 0, 0, 1, 8, 8, 0]; // 영(ㅇ) 일(ㄹ) 이 삼(ㅁ) 사 오 육(ㄱ) 칠(ㄹ) 팔(ㄹ) 구 — 종성 번호 (ㄹ = 8)
const LETTER = { l: 8, m: 16, n: 4, r: 8 }; // 머리글자로 읽을 때 받침이 있는 글자 (엘·엠·엔·알)

/** 앞말의 끝소리 종성 번호: 0 = 받침 없음, 8 = ㄹ, 그 밖 = 받침 있음 */
export function finalOf(word) {
  let s = String(word ?? '');
  let i = s.length - 1;
  while (i >= 0 && SKIP.includes(s[i])) i--;
  if (i < 0) return 0;
  s = s.slice(0, i + 1);
  const ch = s[i], c = ch.charCodeAt(0);
  if (c >= 0xac00 && c <= 0xd7a3) return (c - 0xac00) % 28;
  // 단위 (숫자 뒤): 미터·킬로미터·퍼센트·도 — 모두 받침 없음
  if (/\d\s*(k?m|%|°|cm|kg)$/i.test(s)) return 0;
  if (ch >= '0' && ch <= '9') {
    const m = s.match(/(\d+)$/)[1];
    if (/^0+$/.test(m)) return 21; // 영
    const z = m.length - m.replace(/0+$/, '').length;
    if (z >= 4) return 4; // 만
    if (z === 3) return 4; // 천
    if (z === 2) return 1; // 백
    if (z === 1) return 17; // 십
    return DIGIT[+ch];
  }
  if (/[a-z]/i.test(ch)) {
    const w = s.match(/([a-z]+)$/i)[1];
    if (w.length <= 4 && w === w.toUpperCase()) return LETTER[ch.toLowerCase()] || 0; // 머리글자 (TV, LED, AI …)
    const lw = w.toLowerCase();
    if (/ng$|m$|n$/.test(lw)) return 4;
    if (/l$|le$/.test(lw)) return 8;
    if (/[^aeiou](ck|k|p|t|b)$/.test(lw) || /(ck|ook|ok|ip|ap|op|ut|at|it|ot)$/.test(lw)) return 1;
    return 0;
  }
  return 0;
}
export const hasFinal = (w) => finalOf(w) !== 0;

const PAIRS = {
  을: ['을', '를'], 를: ['을', '를'], 이: ['이', '가'], 가: ['이', '가'], 은: ['은', '는'], 는: ['은', '는'],
  과: ['과', '와'], 와: ['과', '와'], 아: ['아', '야'], 야: ['아', '야'], 이라: ['이라', '라'], 라: ['이라', '라'],
  이에요: ['이에요', '예요'], 예요: ['이에요', '예요'], 이랑: ['이랑', '랑'], 랑: ['이랑', '랑'], 이나: ['이나', '나'], 나: ['이나', '나'],
  이며: ['이며', '며'], 이고: ['이고', '고'], 이야: ['이야', '야'], 이다: ['이다', '다'],
};

/** 조사만: josaOf('사과', '을') → '를' · josaOf('길', '로') → '로' (ㄹ 받침) · josaOf('숲', '로') → '으로' */
export function josaOf(word, p) {
  const f = finalOf(word);
  if (p === '로' || p === '으로') return f !== 0 && f !== 8 ? '으로' : '로';
  const pr = PAIRS[p];
  if (!pr) return p;
  return f !== 0 ? pr[0] : pr[1];
}
/** 말 + 조사: josa('물결 국숫집', '을') → '물결 국숫집을' */
export function josa(word, p) { return `${word}${josaOf(word, p)}`; }

/** 「을(를)」 같은 후보 병기를 앞말에 맞는 한 꼴로 바꾼다 (옛 문장을 고치는 안전망 — 새 문장은 josa() 로 쓴다) */
export function fixJosa(text) {
  return String(text).replace(/([^\s(]+?)(을\(를\)|를\(을\)|이\(가\)|가\(이\)|은\(는\)|는\(은\)|와\(과\)|과\(와\)|\(으\)로|으\(로\)|아\(야\))/g, (_, w, m) => {
    const p = m.includes('로') ? '로' : m.replace(/[()]/g, '').slice(0, 1);
    return w + josaOf(w, p);
  });
}
