// 한국어 조사 검사 (v24 「한국어 조사·문장 표기 자연화」): 받침/무받침 · ㄹ 받침(로) · 숫자 · 단위 · 영문 · 머리글자 · 괄호/따옴표,
// 그리고 소스 전체에 「을(를)」 같은 후보 병기가 남아 있지 않은지 (화면에 나갈 문자열).
//   node tools/josa-check.mjs
import { josa, josaOf, fixJosa } from '../src/core/josa.js';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

let fails = 0;
const ok = (c, m) => { if (!c) { console.log(`✗ ${m}`); fails++; } };
const T = [
  ['사과', '을', '사과를'], ['책', '을', '책을'], ['물결 국숫집', '이', '물결 국숫집이'], ['아웬', '은', '아웬은'], ['모아', '와', '모아와'], ['솔', '과', '솔과'],
  ['길', '로', '길로'], ['숲', '로', '숲으로'], ['바다', '로', '바다로'], ['하모네아', '로', '하모네아로'], ['서고', '이에요', '서고예요'], ['방', '이에요', '방이에요'],
  ['3', '을', '3을'], ['2', '을', '2를'], ['1', '로', '1로'], ['6', '로', '6으로'], ['10', '이', '10이'], ['100', '은', '100은'], ['1000', '을', '1000을'], ['20000', '와', '20000과'], ['0', '이', '0이'], ['3.5', '를', '3.5를'],
  ['12 m', '을', '12 m를'], ['5km', '로', '5km로'], ['40%', '가', '40%가'],
  ['TV', '를', 'TV를'], ['LED', '이', 'LED가'], ['URL', '을', 'URL을'], ['AI', '와', 'AI와'], ['ROM', '이', 'ROM이'], ['SNS', '를', 'SNS를'],
  ['Seren', '은', 'Seren은'], ['Moa', '와', 'Moa와'], ['Lark', '은', 'Lark은'], ['Harmonea', '를', 'Harmonea를'], ['Hall', '로', 'Hall로'],
  ['「물결 국숫집」', '을', '「물결 국숫집」을'], ['「솔」', '이', '「솔」이'], ['(2층)', '을', '(2층)을'], ['울림 공장.', '은', '울림 공장.은'],
  ['우리 집', '으로', '우리 집으로'], ['일터', '으로', '일터로'],
];
for (const [w, p, want] of T) { const got = josa(w, p); ok(got === want, `${w} + ${p} → ${got} (바란 것 ${want})`); }
ok(fixJosa('「서고」을(를) 찾았다') === '「서고」를 찾았다', `fixJosa 1: ${fixJosa('「서고」을(를) 찾았다')}`);
ok(fixJosa('솔이(가) 웃었다 · 숲(으)로 갔다') === '솔이 웃었다 · 숲으로 갔다', `fixJosa 2: ${fixJosa('솔이(가) 웃었다 · 숲(으)로 갔다')}`);
// 소스에 남은 후보 병기
const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const bad = [];
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (p.endsWith('.js') && !p.endsWith('josa.js')) readFileSync(p, 'utf8').split('\n').forEach((l, i) => { if (/(을\(를\)|를\(을\)|이\(가\)|가\(이\)|은\(는\)|는\(은\)|와\(과\)|과\(와\)|\(으\)로|아\(야\))/.test(l) || /\$\{[^{}]+\}」(?:을|를|이|가|은|는|와|과|으로|로)(?=[ ,.!?)·`]|$)/.test(l)) bad.push(`${p.slice(root.length + 1)}:${i + 1}`); }); } };
walk(root);
ok(!bad.length, `후보 병기가 남은 곳 ${bad.length}: ${bad.slice(0, 12).join(', ')}`);
console.log(`조사 ${T.length}개 · 소스 검사 · ${fails ? `실패 ${fails}` : '모두 통과'}`);
process.exit(fails ? 1 : 0);
