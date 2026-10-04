// 서고의 책 (v0.9): 실제로 꺼내 쪽마다 읽을 수 있는 책들.
//  · 손으로 쓴 책(AUTHORED) — 세렌의 역사·자연·노래·이야기·기술·살림·도시·법·몸·하늘
//  · 게임의 자료에서 엮은 책 — 아웬 말 낱말장(lexicon), 공장 공정 안내(goods.RECIPES·LINES), 진열 구역 안내(goods.CATS),
//    거리 안내(city.ZONES·places), 도감(story.CODEX), 지명 사전(places), 옛 기록(venues.ARCHIVES)
//  · 씨앗으로 지은 이야기·시집 — 같은 번호는 늘 같은 책
// 책 하나: { id, title, author, subject, pages: [쪽 글], word?(다 읽으면 배우는 말), learn?(낱말장: 그 권의 말 가운데 하나) }
import { WORDS } from './lexicon.js';
import { GOODS, RECIPES, LINES, CATS, SHELF_GOODS, MAKER } from './goods.js';
import { ZONES } from './city.js';
import { PLACES } from './places.js';
import { CODEX } from './story.js';
import { ARCHIVES } from './venues.js';
import { won } from './money.js';
import { BOOKS as OLD_BOOKS } from './facilities.js';
import { NPCS } from './story.js';
import { ZONE_NAMES } from './venues.js';
import { REGIONS } from '../world/regions.js';

/** 서가 분류 (서고의 서가마다 하나) */
export const SUBJECTS = {
  history: '역사·기록', nature: '세렌의 자연', song: '노래와 시', story: '이야기', child: '어린이',
  tech: '기술', life: '살림·요리', city: '도시와 길', words: '말과 글', sky: '별과 하늘', heal: '몸과 치유', law: '나눔과 일',
};

// ── 받침에 맞는 조사 ──
const hasFinal = (w) => { const ch = String(w).trim().slice(-1), c = ch.charCodeAt(0); if (ch >= '0' && ch <= '9') return '013678'.includes(ch); return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0; };
const finalL = (w) => { const ch = String(w).trim().slice(-1), c = ch.charCodeAt(0); if (ch >= '0' && ch <= '9') return '178'.includes(ch); return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 === 8; };
const J = (w, a, b) => `${w}${hasFinal(w) ? a : b}`;
export const josa = { 을: (w) => J(w, '을', '를'), 이: (w) => J(w, '이', '가'), 은: (w) => J(w, '은', '는'), 와: (w) => J(w, '과', '와'), 아: (w) => J(w, '아', '야'), 로: (w) => (hasFinal(w) && !finalL(w) ? `${w}으로` : `${w}로`) };

// ── 손으로 쓴 책 ─────────────────────────────────────────────
const AUTHORED = [
  // 역사·기록
  { id: 'b-harmonea', subject: 'history', title: '하모네아 연대기', author: '기록관 세이', word: 'first', pages: [
    '첫 합창단이 고원에 모인 것은 우르가 서른 번 차고 기운 뒤였다. 그들은 사흘 밤낮을 노래했고, 사흘째 새벽에 땅이 둥글게 솟았다. 지금 척추가 선 자리가 그 둥근 땅의 한가운데다.',
    '처음의 하모네아는 탑 하나와 고리 길 하나였다. 아웬은 소리가 둥글게 퍼진다는 것을 알았기에, 집을 지을 때마다 그 둥근 메아리가 닿는 자리에 지었다. 고리는 그렇게 하나씩 늘어났다.',
    '척추가 하늘에 닿은 해를 아웬은 「높은 해」라고 부른다. 승강줄이 처음 하늘닻까지 오르던 날, 도시의 모든 탑이 한 음을 냈다. 그 음은 지금도 해마다 같은 날 다시 울린다.',
    '네 구역 — 새벽, 물결, 포자, 별바라기 — 은 큰 탑이 넷으로 갈라진 뒤에 생겼다. 구역마다 노래의 박자가 달라서, 오래 산 사람은 눈을 감고도 지금 어느 구역에 있는지 안다.',
    '오늘의 하모네아에는 사십만이 넘는 이웃이 산다. 그래도 아웬은 여전히 이렇게 인사한다. 「같은 고리에서 만나요.」',
  ] },
  { id: 'b-pylons', subject: 'history', title: '여섯 공명탑 순례기', author: '길잡이 모루', word: 'path', pages: [
    '공명탑은 세렌의 땅이 내는 울림을 모아 고르는 탑이다. 들판·황야·숲·협곡·첨봉·바다에 하나씩, 그리고 깊은목에 가장 큰 탑이 있다.',
    '들판의 공명탑은 빛갈대 들판 한가운데 선다. 바람이 불면 갈대가 탑의 음을 따라 흔들려, 들판 전체가 한 악기처럼 운다. 순례자는 여기서 「솟음」 음을 배운다.',
    '황야의 공명탑은 유리 황야의 노래수정들과 대화한다. 수정이 낮에 들은 소리를 밤에 돌려주면, 탑이 그 소리를 골라 다시 땅에 묻는다.',
    '숲의 공명탑 둘레에는 거대 빛버섯이 자란다. 포자해파리가 탑의 음을 따라 원을 그리며 떠다니는데, 그 원의 크기로 그해 비의 양을 점친다.',
    '협곡과 첨봉과 바다의 탑은 멀고 험하다. 그러나 순례를 마친 이는 누구나 같은 말을 한다. 「탑마다 노래가 달랐지만, 마지막엔 하나의 노래였다.」',
  ] },
  { id: 'b-tteodol', subject: 'history', title: '떠돌섬의 섬지기들', author: '섬지기 타르', pages: [
    '협곡 위에 떠 있는 섬들은 원래 땅의 일부였다. 깊은 울림이 바위의 무게를 덜어 주자, 섬들은 천천히 떠올라 협곡 바람을 따라 떠돌기 시작했다.',
    '섬지기는 섬들이 서로 부딪치지 않게 지키는 사람이다. 섬마다 고유한 낮은 음이 있어서, 섬지기는 그 음을 들으며 섬과 섬 사이의 거리를 잰다.',
    '섬 사이를 잇는 줄다리는 하루에 세 번 옮겨 단다. 바람이 바뀌면 섬의 자리도 바뀌기 때문이다. 떠돌섬 사람들에게 「집 주소」는 이름이 아니라 노래다.',
    '언젠가 큰 바람이 불어 섬 하나가 협곡 끝까지 밀려간 적이 있다. 섬지기들은 밤새 그 섬의 음을 함께 불러, 섬을 다시 제자리로 불러들였다.',
  ] },
  { id: 'b-old-records', subject: 'history', title: '기억 결정 보관소 이야기', author: '보관소 사람들', word: 'old', pages: [
    '유리 황야의 서쪽 끝에 기억 결정 보관소가 있다. 아주 옛날의 노래가 결정 속에 잠들어 있는 곳이다.',
    '결정은 소리를 기억한다. 결정을 손에 쥐고 가만히 있으면, 그 결정이 처음 들은 노래가 손바닥을 타고 올라온다.',
    '보관소의 일은 결정을 지키는 것만이 아니다. 해마다 결정에 새 노래를 한 소절씩 들려준다. 그래야 결정이 잠들지 않는다고 한다.',
    '보관소 문 위에는 이런 말이 새겨져 있다. 「잊는 것은 끝이 아니다. 노래를 멈추는 것이 끝이다.」',
  ] },
  // 세렌의 자연
  { id: 'b-meadow-day', subject: 'nature', title: '들판의 하루', author: '정원지기 이엘', word: 'grow', pages: [
    '새벽, 빛갈대 끝의 빛 씨앗이 하나둘 꺼진다. 밤새 모은 땅의 울림을 다 쓴 것이다. 그 자리에 이슬이 맺힌다.',
    '아침에는 톡톡이들이 나온다. 세 발로 통통 튀며 이슬을 마시고, 허리의 빛 구멍으로 서로 신호를 보낸다. 빛이 세 번 깜빡이면 「여기 물이 있어」라는 뜻이다.',
    '한낮에는 긴다리 무리가 들판을 건넌다. 그들은 천천히 걷지만 멈추지 않는다. 긴다리가 지나간 자리에는 땅이 고르게 다져져, 이듬해 갈대가 더 곧게 자란다.',
    '해 질 녘에는 포자해파리가 숲에서 날아와 들판 위를 떠다닌다. 빛나방이 「빛」 음을 따라 모여들면, 들판은 다시 밤의 빛을 켠다.',
    '정원지기의 일은 이 하루가 내일도 오도록 거드는 것이다. 들판은 우리가 돌보지 않아도 산다. 다만 우리가 돌보면, 들판도 우리를 돌본다.',
  ] },
  { id: 'b-skywhale', subject: 'nature', title: '하늘고래를 따라서', author: '하늘배 길잡이 노을', word: 'whale', pages: [
    '하늘고래는 몸속 기낭에 세렌의 울림을 담아 떠 있다. 가장 큰 고래는 몸길이가 이백 걸음의 열 배에 이른다.',
    '고래는 해류를 따라 세렌을 돈다. 봄에는 바다 위, 여름에는 첨봉 위, 가을에는 들판 위를 지난다. 고래가 지나가는 날 들판은 잠깐 그늘이 지고, 아이들은 모두 하늘을 본다.',
    '고래는 낮게 운다. 너무 낮아서 귀로는 들리지 않고 가슴으로 느껴진다. 하늘배 길잡이들은 그 떨림으로 고래가 어디 있는지 안다.',
    '고래의 노래에는 길이 담겨 있다고 한다. 옛 길잡이들은 고래의 노래를 따라 처음으로 바다를 건넜다.',
  ] },
  { id: 'b-bloom-walk', subject: 'nature', title: '균사 숲 산책', author: '갓마을의 정원사 루온', pages: [
    '거대 빛버섯은 수백 걸음 높이로 자란다. 갓이 단단해서, 갓마을 사람들은 그 위에 집을 짓고 산다.',
    '숲의 땅 밑에는 균사가 그물처럼 퍼져 있다. 한 버섯이 아프면 그물 전체가 그 소식을 나눠, 다른 버섯들이 양분을 보낸다.',
    '숲을 걸을 때는 큰 소리를 내지 않는다. 버섯은 소리로 서로 이야기하기 때문이다. 대신 작게 흥얼거리면, 버섯 갓의 빛이 조금 밝아진다.',
    '포자가 날리는 계절에는 숲 전체가 금빛 안개에 잠긴다. 그 안개 속에서 길을 잃지 않으려면 숲의 공명탑 음을 따라가면 된다.',
  ] },
  { id: 'b-crystal', subject: 'nature', title: '유리 황야의 노래수정', author: '윤슬의 수정 조율사 소엘', word: 'song', pages: [
    '유리 황야의 거대 수정들은 들은 소리를 저장했다가 되돌려 보낸다. 바람이 강한 날이면 황야 전체가 지난 계절의 노래로 가득하다.',
    '수정 조율사는 수정이 너무 많은 소리를 담지 않도록 덜어 준다. 소리를 너무 많이 담은 수정은 금이 가기 때문이다.',
    '조율사는 한 음을 오래 불러 수정의 결을 찾는다. 결이 맞으면 수정은 맑게 울리며 담은 소리를 조금씩 놓아준다.',
    '윤슬의 유리 탑들은 모두 이 수정에서 왔다. 그래서 윤슬의 집들은 밤마다 아주 작게, 지난날의 노래를 흥얼거린다.',
  ] },
  // 노래와 시
  { id: 'b-lullabies', subject: 'song', title: '이슬터 자장가 모음', author: '이슬터 사람들', word: 'sleep', pages: [
    '「갈대야 갈대야 빛을 끄렴 / 이슬이 내려와 네 잎에 앉게 / 오늘 들은 노래는 땅에 두고 / 내일 들을 노래만 꿈에 데려가렴」',
    '「우르가 지켜보는 밤이란다 / 큰 눈을 뜨고 너를 보고 있단다 / 무섭지 않아, 우르는 늘 / 같은 쪽을 보며 우리를 지켜왔으니」',
    '「톡톡이 세 번 깜빡이면 / 물이 있다는 뜻이래 / 아가가 세 번 숨을 쉬면 / 꿈이 왔다는 뜻이래」',
    '「노래를 멈추지 마, 아주 작게라도 / 네가 잠든 동안엔 엄마가 이어 부를게 / 엄마가 잠들면 탑이 이어 부르고 / 탑이 쉬면 들판이 이어 부를 거야」',
  ] },
  { id: 'b-worksongs', subject: 'song', title: '일의 노래들', author: '빚음 공방 합창단', word: 'work', pages: [
    '공방의 노래 — 「솟음 흐름 솟음 흐름, 가루가 반죽이 되고 / 빛 고요 빛 고요, 반죽이 빵이 되네」 박자가 둘이라 걸음이 맞는다.',
    '창고의 노래 — 「하나 받고 둘 넘겨, 셋 쌓고 넷 나눠」 짐을 나르는 손이 넷 박자에 맞춰 움직인다. 이 노래가 끊기면 누군가 짐을 놓친 것이다.',
    '발전소의 노래 — 「낮게 낮게 더 낮게, 결정이 깨지 않게 / 높게 높게 더 높게, 빛이 모자라지 않게」 출력이 오르내릴 때마다 음이 함께 오르내린다.',
    '밭의 노래 — 「물 주는 소리는 열림, 거두는 소리는 솟음」 재배원 사람들은 이 두 음만으로 하루를 산다.',
    '노래가 일을 쉽게 만들지는 않는다. 다만 혼자 하는 일을 함께 하는 일로 만든다. 그래서 아웬은 일하며 노래한다.',
  ] },
  // 이야기
  { id: 'b-colossus-child', subject: 'story', title: '거신의 등에서 자란 아이', author: '걸음마을의 이야기꾼', word: 'walk', pages: [
    '느린땅을 걷는 거신의 등에는 마을이 있다. 그 마을에서 태어난 아이 하린은 땅이 멈춰 있는 것을 한 번도 본 적이 없었다.',
    '하린에게 세상은 늘 조금씩 흔들리는 곳이었다. 거신이 한 걸음 내디딜 때마다 마을의 종이 한 번 울렸고, 하린은 그 종소리로 시간을 셌다.',
    '열두 살이 되던 해, 하린은 처음으로 거신에서 내려 땅을 밟았다. 땅은 너무나 조용했다. 하린은 무서워서 울었다.',
    '그때 땅 밑에서 아주 낮은 울림이 올라왔다. 거신의 걸음보다 훨씬 느린, 세렌 자체의 걸음이었다. 하린은 깨달았다. 땅도 걷고 있었다는 것을.',
    '그 뒤로 하린은 거신과 땅 사이를 오가는 길잡이가 되었다. 하린은 말한다. 「멈춘 것은 없어. 다만 걸음의 빠르기가 다를 뿐이야.」',
  ] },
  { id: 'b-mulnorae', subject: 'story', title: '물노래 사람들', author: '물결 가수 나린', word: 'water', pages: [
    '물노래는 바다 위에 지은 도시다. 집들은 물 위에 떠 있고, 길은 물결이다. 사람들은 물결의 노래로 길을 찾는다.',
    '물노래의 아이는 걷기보다 헤엄을 먼저 배운다. 그리고 헤엄보다 물결 듣기를 먼저 배운다. 물결이 높아질 때의 음을 아는 것이 이 도시에서 가장 중요한 지식이다.',
    '어느 해 큰 조석이 밀려왔다. 조석 기관이 멈췄고, 집들이 서로 부딪쳤다. 물결 가수들은 물가에 서서 밤새 가장 낮은 음을 불렀다.',
    '아침이 되자 물결은 가라앉아 있었다. 사람들은 그날을 「낮은 노래의 날」이라 부르며, 해마다 물가에 모여 가장 낮은 음을 함께 부른다.',
  ] },
  { id: 'b-last-repair', subject: 'story', title: '마지막 승강줄 수리공', author: '하늘닻의 고리지기 솔', word: 'up', pages: [
    '척추의 승강줄은 삼만 걸음 높이의 하늘닻까지 이어진다. 그 줄을 고치는 사람이 있다. 사람들은 그를 마지막 수리공이라 불렀다.',
    '그가 마지막인 까닭은, 그 일을 하겠다는 젊은이가 없었기 때문이다. 하늘닻은 공기가 거의 없고, 하늘이 검고, 세렌이 발아래 둥글게 보이는 곳이다.',
    '어느 날 한 아이가 수리공을 찾아왔다. 「줄이 노래하는 소리를 들었어요. 아주 높은 음이었어요.」 수리공은 놀랐다. 그 음은 줄이 아플 때 내는 소리였다.',
    '둘은 함께 줄을 타고 올라 아픈 자리를 찾았다. 아이는 귀가 밝았고, 수리공은 손이 익었다. 그날 이후 수리공은 더 이상 마지막이 아니었다.',
  ] },
  // 어린이
  { id: 'b-hopper-glow', subject: 'child', title: '톡톡이는 왜 빛날까?', author: '하모네아 배움의 집', word: 'light', pages: [
    '톡톡이 허리에는 작은 빛 구멍이 고리처럼 나 있어요. 그 구멍으로 빛이 나와요.',
    '톡톡이는 빛으로 말해요! 한 번 깜빡이면 「안녕」, 두 번은 「조심해」, 세 번은 「여기 물이 있어」래요.',
    '밤이 되면 톡톡이들이 모여서 다 같이 깜빡여요. 그러면 들판에 빛의 물결이 생겨요. 멀리서 보면 들판이 숨 쉬는 것 같아요.',
    '톡톡이를 만나면 손전등을 세 번 깜빡여 보세요. 혹시 대답해 줄지도 몰라요!',
  ] },
  { id: 'b-first-name', subject: 'child', title: '이름을 처음 노래한 날', author: '하모네아 배움의 집', word: 'name', pages: [
    '아웬의 아이는 다섯 살이 되면 처음으로 자기 이름을 노래해요. 이름은 글자가 아니라 노래예요.',
    '미르는 너무 떨려서 첫 음을 놓쳤어요. 교실이 조용해졌어요. 미르는 울고 싶었어요.',
    '그때 선생님이 미르의 첫 음을 대신 불러 주었어요. 친구들이 둘째 음을 불러 주었어요. 미르는 마지막 음을 불렀어요.',
    '그래서 미르의 이름 노래는 혼자 부른 노래가 아니라 모두가 함께 부른 노래가 되었어요. 미르는 그게 더 좋았어요.',
  ] },
  { id: 'b-little-keeper', subject: 'child', title: '작은 돌보미의 하루', author: '하모네아 배움의 집', word: 'keep', pages: [
    '돌보미는 정원과 거리를 돌보는 작은 떠다니는 기계예요. 아침이면 정원으로 날아가 꽃에 물을 줘요.',
    '점심에는 길에 떨어진 잎을 모아요. 잎은 버리지 않고 거름 창고로 가져가요. 거름은 다시 정원으로 돌아와요.',
    '오후에는 낯선 것을 찾아다녀요. 처음 보는 것을 보면 다가가서 가만히 들어요. 돌보미는 듣는 걸 제일 좋아해요.',
    '밤이 되면 돌보미는 충전탑에 붙어 쉬어요. 쉬는 동안에도 아주 작게 노래해요. 오늘 들은 소리를 잊지 않으려고요.',
  ] },
  // 기술
  { id: 'b-grow-tower', subject: 'tech', title: '탑을 기르는 법', author: '하늘 주조소의 장인 페온', word: 'build', pages: [
    '아웬의 탑은 쌓지 않고 기른다. 땅에 결정 씨앗을 심고 노래를 들려주면, 씨앗이 스스로 자라 탑이 된다.',
    '노래가 탑의 모양을 정한다. 솟음 음을 오래 들으면 높이 자라고, 열림 음을 들으면 넓게 퍼진다. 고리 모양의 탑은 같은 노래를 둥글게 돌아가며 부른 것이다.',
    '층은 노래의 박자로 생긴다. 박자마다 결정이 한 켜 굳어 바닥이 되고, 그 사이가 방이 된다. 그래서 탑의 창 띠는 노래의 박자와 같은 간격으로 난다.',
    '탑 가운데에는 늘 「심」이 자란다. 계단과 승강기가 지나는 관이다. 심이 먼저 자라야 층이 그 둘레에 붙는다. 심이 없는 탑은 무너진다.',
    '다 자란 탑도 노래를 들어야 한다. 사람이 살며 노래하는 탑은 해마다 단단해지고, 비어 있는 탑은 조금씩 흐려진다.',
  ] },
  { id: 'b-lightrail', subject: 'tech', title: '빛길 캡슐 안내서', author: '빛길 운행 공사', word: 'path', pages: [
    '빛길은 유리관 속을 캡슐이 달리는 길이다. 관 안의 공기를 소리로 밀어, 캡슐은 거의 마찰 없이 미끄러진다.',
    '캡슐에 오르면 자리에 앉아 가는 곳의 이름을 노래하면 된다. 이름을 모르면 역의 안내 빛판에서 고르면 된다.',
    '빛길 캡슐은 사람을 가장 빠르게 나르지만, 짐은 나르지 않는다. 짐은 물류 창고의 드론이 하늘 길로 나른다.',
    '빛길의 관은 투명하다. 밤에 캡슐이 지나가면 관을 따라 빛줄이 흐른다. 아이들은 그 빛줄을 「도시의 맥박」이라고 부른다.',
  ] },
  { id: 'b-power', subject: 'tech', title: '공명 발전의 원리', author: '공명 발전 공사', word: 'core', pages: [
    '발전소는 연료 결정을 태워 빛을 낸다. 「태운다」고 하지만 불을 붙이는 것은 아니다. 결정에 맞는 음을 들려주면 결정이 품은 울림을 빛으로 풀어 놓는다.',
    '연료 결정은 채굴장에서 온다. 하루에 쓰는 만큼만 태우고, 남은 결정은 창고에 둔다. 빛이 모자라면 공장이 멈추고, 공장이 멈추면 가게의 진열대가 빈다.',
    '발전소 일꾼은 출력을 맞춘다. 공장이 많이 도는 낮에는 출력을 올리고, 밤에는 내린다. 출력이 너무 높으면 결정이 깨지고, 너무 낮으면 도시가 어두워진다.',
    '그래서 발전소의 노래는 늘 오르내린다. 도시 전체가 그 노래에 맞춰 숨을 쉰다.',
  ] },
  { id: 'b-core-rules', subject: 'tech', title: '승강기와 계단의 규칙', author: '탑 설계 조합', pages: [
    '탑의 심에는 계단과 승강기와 설비 관이 지난다. 심은 모든 층에서 같은 자리에 있어야 한다. 그래야 계단이 층마다 이어지고, 승강기가 곧게 오르내린다.',
    '세 층이 넘는 탑에는 승강기를 둔다. 아주 높은 탑은 승강기를 둘로 나눈다. 낮은층 승강기와 높은층 승강기다. 높은층 승강기는 로비에서 곧장 위쪽 절반으로 간다.',
    '계단은 적어도 둘을 둔다. 하나가 막혀도 다른 하나로 내려갈 수 있어야 한다. 화물 승강기는 따로 두어, 짐과 사람이 부딪치지 않게 한다.',
    '승강기 앞에는 넉넉한 홀을 둔다. 승강기가 많은 탑일수록 기다리는 사람이 많으니, 홀도 그만큼 깊어야 한다.',
    '마지막 규칙: 심은 층을 둘로 가르지 않는다. 승강기에서 내린 사람이 그 층의 어느 방에든 걸어갈 수 있어야 한다.',
  ] },
  // 살림·요리
  { id: 'b-kitchen', subject: 'life', title: '노래하는 부엌', author: '한 상 식당의 요리사', word: 'eat', pages: [
    '노래빵은 구울 때 노래한다. 반죽 속의 공기가 데워지며 작은 소리를 낸다. 소리가 높아지면 다 구워진 것이다.',
    '울림차는 찻잎을 덖을 때 「흐름」 음을 들려준다. 그러면 찻잎이 말리며 향을 품는다. 김이 노래하는 차는 이렇게 만든다.',
    '별젤리는 꽃꿀과 빛열매로 만든다. 식힐 때 「고요」 음을 들려주면 별 모양으로 굳는다. 음이 흔들리면 모양도 흔들린다.',
    '좋은 요리사는 재료를 아낀다. 남은 빵은 도시락이 되고, 남은 열매는 즙이 된다. 버리는 것이 없어야 부엌이 노래한다.',
  ] },
  { id: 'b-home', subject: 'life', title: '집을 고르게 하는 법', author: '바람결 공동주택 조합', word: 'home', pages: [
    '집도 음이 어긋날 수 있다. 너무 오래 조용하면 집이 흐려지고, 너무 시끄러우면 집이 지친다.',
    '아침에는 창을 열고 한 음을 부른다. 집이 그 음을 기억하면, 하루 내내 그 음으로 돌아온다.',
    '잠 고치는 몸을 고르게 해 준다. 하루의 울림을 내려놓고 쉬면, 몸이 다음 날의 음을 준비한다.',
    '이웃과 벽을 나누는 집에서는 저녁 노래를 함께 부른다. 같은 고리의 이웃은 같은 메아리를 듣기 때문이다.',
  ] },
  // 도시와 길
  { id: 'b-rings', subject: 'city', title: '고리 거리 걷기', author: '하모네아 길 안내소', word: 'ring', pages: [
    '하모네아는 동심원이다. 가운데 척추에서 바깥으로 고리 거리가 퍼지고, 고리 사이를 곧은 길이 잇는다.',
    '길을 잃으면 척추를 보라. 척추는 어느 고리에서든 보인다. 척추가 왼쪽에 있으면 시계 방향으로, 오른쪽에 있으면 반대 방향으로 걷고 있는 것이다.',
    '건물마다 정문 옆에 울림판 단말이 있다. 손을 대면 그 건물의 층 안내가 뜬다. 큰 탑은 층마다 다른 회사와 가게가 있으니, 단말에게 먼저 묻는 것이 좋다.',
    '높은 탑끼리는 공중다리로 이어지기도 한다. 공중다리 층에서 내리면 땅에 내려가지 않고 옆 탑으로 건너갈 수 있다.',
  ] },
  // 나눔과 일
  { id: 'b-share-law', subject: 'law', title: '나눔의 법 풀이', author: '하모네아 의회', word: 'share', pages: [
    '세렌의 화폐는 「울」이다. 울은 새로 생기지 않는다. 가게에서 쓴 울은 회사 금고로 가고, 회사는 그 울로 일꾼에게 품삯을 준다.',
    '일꾼은 품삯의 일부를 세금으로 공공 몫에 돌려준다. 공공 몫은 학교·치유원·서고를 꾸리고, 이웃에게 고마움을 나눈다.',
    '물건도 저절로 생기지 않는다. 진열대의 빵은 공장이 가루로 구운 것이고, 가루는 재배원의 빛보리다. 공장은 발전소의 빛이 있어야 돈다.',
    '그래서 아웬은 말한다. 「쓴 울은 다시 이웃에게 돈다.」 울이 멈추면 품삯이 멈추고, 품삯이 멈추면 가게가 멈춘다.',
  ] },
  { id: 'b-jobs', subject: 'law', title: '일자리를 구하는 이에게', author: '하모네아 일자리 안내소', word: 'work', pages: [
    '일자리는 건물마다의 울림판 단말에서 찾는다. 「일자리」를 누르면 그 건물과 둘레 건물의 자리가 뜬다.',
    '지원하면 한 시간쯤 뒤 면접 안내가 온다. 면접은 그 회사의 채용 면접실에서 본다. 면접관은 세 가지를 묻는다. 일을 아는지, 셈을 하는지, 지친 동료에게 어떻게 하는지.',
    '채용되면 출근 단말에서 교대를 시작한다. 교대 중에는 과제가 주어지고, 바닥의 빛 길이 그 자리로 안내한다.',
    '퇴근할 때 일한 시간과 마친 과제만큼 품삯을 받는다. 품삯은 그 회사의 금고에서 나온다. 회사가 잘 돌아야 품삯도 넉넉하다.',
  ] },
  // 몸과 치유
  { id: 'b-heal', subject: 'heal', title: '어긋난 음을 고르는 법', author: '종합 치유원 치유사 모임', word: 'heal', pages: [
    '아픈 것은 음이 어긋난 것이다. 치유사는 몸의 울림을 듣고 어긋난 곳을 찾는다.',
    '울림 스캐너는 몸 전체의 음을 한 번에 듣는다. 어긋난 곳은 빛판 위에 붉게 떠오른다.',
    '가벼운 어긋남은 고른울림 약으로 고친다. 깊은 어긋남은 치료 고치에 누워 오래 고른 음을 듣는다.',
    '가장 좋은 치유는 어긋나기 전에 고르는 것이다. 잘 먹고, 잘 쉬고, 함께 노래하는 것. 치유사들은 늘 그렇게 말한다.',
  ] },
  // 별과 하늘
  { id: 'b-ur-night', subject: 'sky', title: '우르 아래의 밤', author: '별듣는 탑의 관측자 베이', word: 'ur', pages: [
    '세렌은 거대 가스행성 우르를 돈다. 세렌은 늘 같은 면을 우르에게 보인다. 그래서 하모네아의 하늘에는 우르가 늘 같은 자리에 떠 있다.',
    '우르는 차고 기운다. 우르가 가득 찬 밤에는 그림자가 둘 생긴다. 하나는 해의 그림자, 하나는 우르의 그림자다.',
    '별듣는 탑의 관측자는 별을 보지 않고 듣는다. 큰 귀와 별듣는 배열이 별빛의 아주 작은 떨림을 소리로 바꿔 들려준다.',
    '어느 밤 관측자들은 아주 먼 곳에서 오는 낯선 떨림을 들었다. 그것이 무엇이었는지는, 아직 아무도 모른다.',
  ] },
  { id: 'b-ring-letters', subject: 'sky', title: '궤도 고리에서 보낸 편지', author: '고리지기의 가족', word: 'ring', pages: [
    '「여기서는 세렌이 발아래 둥글게 보여. 바다와 들판과 협곡이 한눈에 들어와. 우리 집이 어디쯤인지 손가락으로 짚어 봤어.」',
    '「고리에는 낮과 밤이 하루에 여러 번 와. 처음엔 잠을 못 잤는데, 이제는 우르가 지는 것을 보며 잠들어.」',
    '「오늘 왕복선이 새 짐을 가져왔어. 네가 보낸 노래빵도 있더라. 조금 식었지만, 여기서 먹으니 집 냄새가 났어.」',
    '「다음 높은 해에는 승강줄을 타고 내려갈게. 그때는 같은 고리에서 만나자.」',
  ] },
  { id: 'b-tether', subject: 'sky', title: '승강줄을 탄 날', author: '하늘닻 왕복 일지', word: 'up', pages: [
    '승강차는 척추 아래 역에서 떠난다. 처음 일 분은 탑들 사이를 오르고, 다음 오 분은 구름을 뚫고, 그다음부터는 하늘이 검어진다.',
    '바깥이 검어지면 몸이 가벼워진다. 승강차 벽의 빛 띠가 지금 높이를 알려 준다. 띠가 끝까지 차면 하늘닻이다.',
    '하늘닻 갑판에서 내려다보면 세렌의 바다와 들판이 둥글게 휘어 있다. 처음 온 사람은 대개 말을 잃고, 고리지기는 그 사람이 다시 말할 때까지 기다려 준다.',
    '내려갈 때는 반대로 하늘이 천천히 파래진다. 고리지기들은 말한다. 「올라갈 때는 세렌을 보고, 내려올 때는 집을 본다.」',
  ] },
  { id: 'b-shuttle', subject: 'sky', title: '왕복선 시간표 읽는 법', author: '별항구 안내소', word: 'ship', pages: [
    '별항구의 왕복선은 하늘닻과 궤도 고리 사이를 오간다. 시간표는 「우르의 각」으로 적는다. 우르가 하늘의 어느 자리에 있을 때 떠나는지를 적은 것이다.',
    '공명탑이 하나씩 다시 노래할 때마다 하늘길이 하나씩 열렸다. 그래서 오래된 시간표에는 빈 줄이 많고, 새 시간표에는 줄이 빽빽하다.',
    '짐 왕복선과 사람 왕복선은 색이 다르다. 짐 왕복선은 금빛 띠, 사람 왕복선은 물빛 띠를 두른다. 밤하늘에서 두 빛이 엇갈리는 것을 보면 고리가 바쁜 날이다.',
    '왕복선을 놓쳤다고 서두를 것은 없다. 우르는 늘 같은 자리에 있고, 다음 배는 늘 온다.',
  ] },
  { id: 'b-starrain', subject: 'sky', title: '별비가 오는 밤', author: '이슬터 온실지기', word: 'star', pages: [
    '별비는 하늘에서 아주 작은 결정이 내리는 밤이다. 떨어진 결정은 땅에서 잠깐 빛나다가, 아침이 오면 「별씨」가 된다.',
    '별씨는 돈이 아니다. 아웬은 별씨를 온실에 맡겨 생명나무를 키우고, 장인은 별씨를 녹여 등불의 심을 만든다.',
    '별비가 오는 밤에는 아이들이 늦게까지 들판에 나가 있어도 아무도 나무라지 않는다. 별씨를 주우며 부르는 노래가 따로 있을 정도다.',
    '「하나는 온실에, 하나는 공방에, 하나는 내 주머니에.」 — 이슬터 아이들이 별씨를 나누는 말.',
  ] },
  { id: 'b-sleep', subject: 'heal', title: '잠의 울림', author: '종합 치유원 쉼 연구실', word: 'rest', pages: [
    '잠든 몸은 낮 동안 어긋난 음을 스스로 고른다. 그래서 치유사는 약보다 먼저 잠을 묻는다. 「어젯밤 몇 시간 잤나요?」',
    '쉼터의 잠 고치는 몸의 울림을 듣고 그 사람에게 맞는 낮은 음을 낸다. 고치 안에서 십 분을 쉬면 걸음이 가벼워진다.',
    '잠이 오지 않는 밤에는 「고요」 음을 아주 낮게 흥얼거린다. 아웬 아이들이 가장 먼저 배우는 자장가도 그 음으로 시작한다.',
    '일을 오래 한 날에는 반드시 쉬어야 한다. 지친 몸은 일을 느리게 하고, 느린 일은 이웃을 기다리게 한다.',
  ] },
  { id: 'b-food-heal', subject: 'heal', title: '먹는 것이 고르는 것', author: '한 상 식당과 치유원', word: 'eat', pages: [
    '빛보리 가루로 구운 노래빵은 걷는 힘을 주고, 구름젖은 뼈의 음을 단단하게 한다. 빛열매는 마음을 밝게 한다.',
    '아웬의 부엌에서는 끼니마다 세 빛깔을 올린다. 흙빛(곡식), 물빛(마실 것), 꽃빛(열매나 잎). 세 빛깔이 고르면 몸의 음도 고르다.',
    '약국의 고른울림 약은 몸이 아플 때 먹는다. 아프지 않을 때 먹으면 오히려 음이 들뜬다. 치유사가 일러 준 만큼만.',
    '무엇보다 함께 먹는 것이 좋다. 혼자 먹는 밥은 배를 채우고, 함께 먹는 밥은 마음을 채운다.',
  ] },
  { id: 'b-first-aid', subject: 'heal', title: '다친 이웃을 만났을 때', author: '하모네아 돌봄 모임', word: 'heal', pages: [
    '먼저 이름을 부른다. 대답하면 괜찮은지 묻고, 대답하지 않으면 곁에 있는 울림판 단말이나 가까운 사람에게 치유원을 부르게 한다.',
    '넘어진 이웃은 억지로 일으키지 않는다. 편히 눕히고, 낮은 「고요」 음으로 숨을 고르게 해 준다.',
    '종합 치유원의 응급실은 늘 열려 있다. 접수대에 이름을 말하면 분류 간호사가 먼저 살핀다. 급한 이부터 차례가 온다.',
    '돕고 나면 꼭 쉬어라. 돌보는 이도 지친다. 치유사들은 「돌보는 이의 물 한 잔」을 잊지 말라고 말한다.',
  ] },
  { id: 'b-council', subject: 'law', title: '고리 모임은 어떻게 정하는가', author: '하모네아 행정 창구', word: 'together', pages: [
    '하모네아의 일은 고리마다 모임에서 정한다. 모임은 한 달에 한 번, 고리의 광장에서 열린다.',
    '정할 일이 있으면 누구나 노래 한 소절로 말한다. 다른 이들은 같은 음으로 받으면 찬성, 다른 음으로 받으면 다른 생각이 있다는 뜻이다.',
    '모두의 음이 하나로 모일 때까지 이야기한다. 오래 걸리지만, 한번 정한 것은 좀처럼 바뀌지 않는다.',
    '정한 것은 행정 창구가 결정에 적어 둔다. 누구든 창구에서 「모임 기록」을 청해 읽을 수 있다.',
  ] },
  { id: 'b-citizen', subject: 'law', title: '집 노래 — 이웃이 되는 길', author: '하모네아 행정 창구', word: 'home', pages: [
    '세렌에 처음 온 이는 먼저 이웃이 된다. 이웃은 도시의 가게와 쉼터와 일터를 함께 쓴다.',
    '이웃이 자기 이름을 노래로 부르고, 마을이 그 노래를 받아 돌려주면 그 이는 시민이 된다. 이름 노래를 받은 이에게는 집이 하나 열린다.',
    '집은 사는 이의 것이다. 가구를 들이고 손님을 부르는 것은 마음대로지만, 공동주택의 복도와 옥상 정원은 모두의 것이다.',
    '시민이 된다고 달라지는 것은 많지 않다. 다만 「같은 고리에서 만나요」라는 인사를, 이제는 진짜로 할 수 있다.',
  ] },
  { id: 'b-bridges', subject: 'tech', title: '공중다리 짓기', author: '탑 설계 조합', word: 'path', pages: [
    '공중다리는 두 탑의 같은 높이를 잇는다. 다리를 놓기 전에 두 탑의 그 층 바닥을 한 높이로 맞추는 것이 첫 일이다.',
    '다리가 닿는 층에는 「공중다리 문」을 낸다. 문에서 승강기 홀까지는 늘 막힘 없는 통로가 있어야 한다. 다리를 건너온 이가 길을 잃으면 안 되기 때문이다.',
    '다리의 유리 통로는 바람에 아주 조금 흔들리도록 짓는다. 단단하기만 한 다리는 큰 바람에 부러진다.',
    '높은 탑 숲에서는 땅에 내려가지 않고도 여러 탑을 오갈 수 있다. 그래서 공중다리가 닿는 층에는 대개 가게나 쉼터가 있다.',
  ] },
  { id: 'b-depot', subject: 'tech', title: '물류 창고의 하루', author: '물류 센터 일꾼들', word: 'carry', pages: [
    '새벽이면 재배원과 채굴장의 짐이 창고로 들어온다. 짐 나누는 이가 짐판의 표를 읽고, 공장으로 갈 것과 가게로 갈 것을 나눈다.',
    '공장은 창고의 원료로 물건을 만들어 다시 창고로 보낸다. 창고는 가게의 진열대가 비기 전에 물건을 실어 보낸다.',
    '창고에 무엇이 얼마나 있는지는 늘 단말에 뜬다. 어떤 물건이 이틀 치보다 적어지면 공장이 그 물건을 먼저 만든다.',
    '짐 드론은 밤에도 쉬지 않는다. 그래서 하모네아의 밤하늘에는 늘 작은 빛들이 줄지어 날아간다.',
  ] },
];

// ── 자료에서 엮는 책 ─────────────────────────────────────────
const NOTE_NAME = ['솟음', '열림', '흐름', '빛', '고요'];
const noteStr = (n) => n.map((x) => `${NOTE_NAME[x % 5]}${x >= 5 ? '(높은)' : ''}`).join('·');
const gn = (k) => (GOODS[k] ? GOODS[k].name : k);
const LINE_NAME = { food: '빵·과자', drink: '마실 것', meal: '반찬·도시락', dairy: '구름젖', snackline: '주전부리·얼음', textile: '직물·옷', crystal: '결정 공예', tech: '장치', home: '살림', pharma: '약·몸단장', paper: '종이·책', garden: '원예' };

function wordBooks() {
  const out = [];
  const per = 12;
  for (let k = 0; k * per < WORDS.length; k++) {
    const ws = WORDS.slice(k * per, (k + 1) * per);
    const pages = [`아웬의 말은 노래다. 낱말마다 고유한 음의 모양이 있고, 글자는 그 음을 점의 높이로 적은 악보다. 이 권에는 「${ws[0].ko}」부터 「${ws[ws.length - 1].ko}」까지 ${ws.length}낱말이 실려 있다.`];
    for (let i = 0; i < ws.length; i += 3) pages.push(ws.slice(i, i + 3).map((w) => `「${w.ko}」 — ${noteStr(w.notes)}. ${w.notes.length === 1 ? '한 음으로 부르는 짧은 말.' : w.notes[0] < w.notes[w.notes.length - 1] ? '올라가며 부른다.' : w.notes[0] > w.notes[w.notes.length - 1] ? '내려가며 부른다.' : '처음과 끝이 같은 음.'}`).join('\n'));
    pages.push('다 읽은 낱말은 입으로 불러 보자. 아웬은 낱말을 눈으로 외우지 않고 목으로 외운다.');
    out.push({ id: `w-${k + 1}`, subject: 'words', title: `아웬 말 낱말장 ${k + 1}권`, author: '하모네아 배움의 집', pages, learn: ws.map((w) => w.id) });
  }
  return out;
}
function lineBooks() {
  return Object.entries(LINES).map(([line, recs]) => ({
    id: `l-${line}`, subject: 'life', title: `${LINE_NAME[line] || line} 공장의 공정`, author: '공장 단지 조합',
    pages: [`이 책은 ${LINE_NAME[line] || line} 공장이 돌리는 공정 ${recs.length}가지를 적는다. 공장은 원료와 발전소의 빛이 있어야 돌고, 만든 것은 물류 창고를 거쳐 가게로 간다.`,
      ...recs.map((rk) => { const R = RECIPES[rk]; const ins = Object.entries(R.in).map(([k, v]) => `${gn(k)} ${v}`).join(', '), outs = Object.entries(R.out).map(([k, v]) => `${gn(k)} ${v}`).join(', '); const o = Object.keys(R.out)[0]; return `「${R.name}」\n넣는 것: ${ins}\n나오는 것: ${outs}\n빛 ${R.energy} · ${R.hours}시간\n${GOODS[o] && GOODS[o].desc ? GOODS[o].desc : ''}`; })],
  }));
}
function categoryBooks() {
  return Object.entries(CATS).map(([cat, name]) => ({
    id: `c-${cat}`, subject: 'life', title: `진열 구역 안내 — ${name}`, author: '도시 가게 조합',
    pages: [`가게의 「${name}」 진열대에는 이런 것이 놓인다. 값은 가게에서 치르는 울이고, 모든 물건은 공장·농장·채굴장에서 실제로 만들어져 물류 창고를 거쳐 온다.`,
      ...(SHELF_GOODS[cat] || []).map((k) => { const G = GOODS[k]; if (!G) return ''; const rk = MAKER[k]; const how = rk ? `${RECIPES[rk].name} — ${Object.entries(RECIPES[rk].in).map(([i, v]) => `${gn(i)} ${v}`).join(', ')}` : G.src === 'farm' ? '재배원에서 거둔다' : G.src === 'mine' ? '채굴장에서 캔다' : ''; return `「${G.name}」 · ${won(G.price)}\n${G.desc || ''}\n만드는 법: ${how}`; }).filter(Boolean)],
  }));
}
function zoneBooks() {
  const STYLE = { capital: '수도의 큰 탑들', commerce: '가게 거리', highrise: '높은 탑 숲', transit: '교통 거점', glass: '유리 탑', suburb: '고원 아래 동네', village: '낮은 마을', bloom: '버섯 갓 위의 마을', canyon: '협곡 벼랑 마을', sea: '물 위의 마을', frost: '얼음 고원 마을' };
  return ZONES.map((Z) => {
    const P = PLACES.find((p) => p.id === Z.at) || {};
    const name = P.name || Z.id;
    const [h0, h1] = Z.h || [10, 40];
    return { id: `z-${Z.id}`, subject: 'city', title: `${name} 거리 안내 (${Z.id})`, author: '길 안내소', pages: [
      `${name}의 거리는 ${STYLE[Z.style] || '여러 탑'}으로 이루어져 있다. 거리는 고리 ${Math.round((Z.r1 - Z.r0) / (Z.ring || 80))}겹으로 퍼지고, 곧은길 ${Z.avenues || 4}가닥이 가운데로 모인다.`,
      `건물의 높이는 낮은 것이 ${h0}걸음, 높은 것이 ${h1}걸음쯤이다. ${Z.tall > 0.5 ? '높은 탑이 많아 공중다리로 이어진 곳이 있다.' : Z.tall > 0 ? '높은 탑은 몇 곳에 모여 있다.' : '높은 탑은 거의 없다.'}`,
      `${Z.mix === 'suburb' ? '집과 정원, 작은 가게와 재배원이 섞인 동네다.' : Z.mix === 'village' ? '마을 사람들이 서로 이름을 아는 작은 동네다.' : '가게와 회사, 집과 공공 건물이 고리마다 섞여 있다.'} ${P.desc || ''}`,
      '처음 온 사람은 건물 정문 옆의 울림판 단말과 거리의 안내 빛판을 쓰면 된다. 길을 잃으면 가장 높은 탑을 향해 걸으면 가운데 광장이 나온다.',
    ] };
  });
}
function codexBooks() {
  const by = {};
  for (const [id, c] of Object.entries(CODEX)) (by[c.cat] = by[c.cat] || []).push(c);
  const SUB = { 생물: 'nature', 식물: 'nature', 광물: 'nature', 천체: 'sky', 기술: 'tech', 도시: 'city' };
  const out = [];
  for (const [cat, list] of Object.entries(by)) {
    for (let k = 0; k * 6 < list.length; k++) {
      const part = list.slice(k * 6, (k + 1) * 6);
      out.push({ id: `x-${cat}-${k}`, subject: SUB[cat] || 'history', title: `세렌 도감 — ${cat}${list.length > 6 ? ` ${k + 1}` : ''}`, author: '하모네아 서고', pages: [`이 도감에는 ${cat} ${part.length}가지가 실려 있다.`, ...part.map((c) => `「${c.name}」\n${c.text}`)] });
    }
  }
  return out;
}
function placeBooks() {
  const list = PLACES.filter((p) => p.name && (p.desc || ['pylon', 'landmark', 'vista', 'village', 'capital', 'district', 'glasscity', 'bloomcity', 'canyoncity', 'seacity', 'riftcity', 'observatory'].includes(p.type)));
  const TYPE = { pylon: '공명탑', landmark: '이름난 곳', vista: '전망 언덕', village: '마을', capital: '수도', district: '구역', glasscity: '유리 도시', bloomcity: '버섯 도시', canyoncity: '협곡 도시', seacity: '바다 도시', riftcity: '깊은목 도시', observatory: '관측탑', arch: '옛 터', lift: '승강 기둥', starport: '별항구', crash: '낯선 자리' };
  const out = [];
  for (let k = 0; k * 8 < list.length; k++) {
    const part = list.slice(k * 8, (k + 1) * 8);
    out.push({ id: `p-${k}`, subject: 'history', title: `세렌 지명 사전 ${k + 1}권`, author: '길잡이 조합', pages: [`가나다 차례가 아니라 길잡이들이 처음 이름 붙인 차례로 적었다. 이 권에는 ${part.length}곳이 있다.`, ...part.map((p) => `「${p.name}」 — ${TYPE[p.type] || '곳'}\n${p.desc || `${p.region === 'spine' ? '척추 고원' : p.region === 'meadow' ? '빛갈대 들판' : p.region === 'glass' ? '유리 황야' : p.region === 'bloom' ? '균사 숲' : p.region === 'canyon' ? '붉은 협곡' : p.region === 'frost' ? '얼음 첨봉' : p.region === 'sea' ? '노래 바다' : '먼 땅'}에 있다.`}`)] });
  }
  return out;
}
function archiveBook() {
  return [{ id: 'a-records', subject: 'history', title: '옛 기록 결정 모음', author: '하모네아 서고', word: 'old', pages: ARCHIVES.map((A) => `「${A.title}」\n${A.text}`) }];
}

function oldBooks() {
  // 옛 서고(시설)의 책 — 같은 글을 서가에서도 읽는다
  return OLD_BOOKS.map((B) => {
    const ss = B.text.split(/(?<=[.다])\s+/);
    const half = Math.ceil(ss.length / 2);
    return { id: `o-${B.id}`, subject: 'history', title: B.title, author: '옛 서고의 결정', word: B.word, pages: ss.length > 2 ? [ss.slice(0, half).join(' '), ss.slice(half).join(' ')] : [B.text] };
  });
}
function peopleBooks() {
  const pn = (id) => (PLACES.find((p) => p.id === id) || {}).name;
  const per = 5, out = [];
  for (let k = 0; k * per < NPCS.length; k++) {
    const part = NPCS.slice(k * per, (k + 1) * per);
    out.push({ id: `m-${k}`, subject: 'history', title: `세렌의 이웃들 ${k + 1}권`, author: '하모네아 서고 인물 모음', pages: [
      '이 권에는 길에서 만나면 인사를 나눌 만한 이웃들이 실려 있다. 모두 저마다의 자리에서 세렌을 지키고 가꾸는 이들이다.',
      ...part.map((N) => { const at = pn(N.place); return `「${N.name}」 — ${N.title}\n${at ? `${at}에서 지낸다. ` : ''}${N.walker ? '걷는 거신의 등에 사는 이들과 함께 땅을 건넌다. ' : ''}${N.y && N.y > 10000 ? '하늘 높은 곳에서 일한다. 만나려면 승강줄을 타야 한다. ' : ''}${N.scale && N.scale < 0.9 ? '아직 어린 이웃이다. 어른들보다 먼저 낯선 이에게 말을 건다. ' : ''}${N.scale && N.scale > 1.1 ? '키가 커서 멀리서도 알아볼 수 있다. ' : ''}만나면 이름 노래로 인사하자.`; }),
    ] });
  }
  return out;
}
function regionBooks() {
  return REGIONS.map((R) => {
    const near = PLACES.filter((p) => p.name && p.region === R.id).slice(0, 8).map((p) => p.name);
    return { id: `r-${R.id}`, subject: R.far ? 'history' : 'nature', title: `${R.name} 지리지`, author: '길잡이 조합', pages: [
      R.desc,
      `${josa.은(R.name)} ${R.far ? '바다 건너 먼 땅이다. 하늘배나 큰 해류를 타야 닿는다.' : '하모네아에서 빛길 캡슐이나 하늘배로 닿는다.'} 길잡이들은 이곳을 줄여 「${R.short}」${hasFinal(R.short) ? '이라' : '라'} 부른다.`,
      near.length ? `이곳의 이름난 자리: ${near.join(' · ')}.` : '이곳에는 아직 이름 붙은 자리가 많지 않다. 처음 가는 이가 이름을 붙여도 좋다.',
      '이 지리지는 길잡이들이 걸어 다니며 적은 것이다. 틀린 곳을 찾으면 길 안내소에 알려 주자.',
    ] };
  });
}

// ── 씨앗으로 짓는 이야기·시 ───────────────────────────────────
function rng(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const pickR = (r, a) => a[Math.floor(r() * a.length)];
const SYL_A = ['라', '세', '이', '루', '미', '아', '하', '노', '린', '솔', '유', '키', '테', '벨', '오', '나', '레', '시', '마', '로', '휘', '단', '에', '파', '소', '가', '도', '비'];
const SYL_B = ['온', '린', '엘', '아', '루', '하', '미', '나', '솔', '윤', '라', '세', '오', '빈', '란', '울', '결', '담', '별', '은', '휘', '닐', '연', '로'];
const CREATURE = ['톡톡이', '긴다리', '빛나방', '노래새', '등짐소', '유리게', '포자해파리', '하늘고래'];
const PLACE = ['빛갈대 들판', '이슬터 우물가', '유리 황야', '균사 숲', '떠돌섬', '물노래 물가', '하모네아 고리 거리', '척추 전망대', '별듣는 탑', '바람언덕'];
const THING = ['작은 결정 방울', '할머니의 노래 결정', '빛붓', '바람연', '이름 노래를 적은 공책', '등불', '노래 구슬', '씨앗 봉지'];
const SONG = ['솟음', '열림', '흐름', '빛', '고요'];
const MACHINE = ['빛 승강기', '공명 코일', '짐 드론', '빛길 캡슐', '등불 기계', '물 펌프', '바람 풍차', '정원 돌보미'];
const FOOD = Object.values(GOODS).filter((G) => G.eat && G.cat !== 'med').map((G) => G.name);
const ROLE = ['정원지기', '수정 조율사', '하늘배 길잡이', '섬지기', '물결 가수', '공방 장인', '치유사', '관측자', '사서', '발전소 일꾼'];

function tale(k) {
  const r = rng(1000 + k);
  const hero = pickR(r, SYL_A) + pickR(r, SYL_B), friend = pickR(r, CREATURE), place = pickR(r, PLACE), place2 = pickR(r, PLACE.filter((p) => p !== place)), thing = pickR(r, THING), song = pickR(r, SONG), role = pickR(r, ROLE);
  const frame = k % 8;
  const machine = pickR(r, MACHINE), food = pickR(r, FOOD);
  let title, pages;
  if (frame === 0) {
    title = `${josa.와(hero)} ${friend}`;
    pages = [
      `${josa.은(hero)} ${place}에서 ${josa.을(thing)} 잃어버렸다. 해가 지기 전에 찾아야 했다.`,
      `그때 ${josa.이(friend)} 다가왔다. ${josa.은(friend)} 말을 하지 못했지만, ${hero}의 발치를 맴돌며 어딘가를 가리켰다.`,
      `둘은 함께 걸었다. ${hero}${hasFinal(hero) ? '이' : '가'} 「${song}」 음을 부르자, 멀리서 아주 작은 대답이 들렸다. ${thing}${hasFinal(thing) ? '이' : '가'} 그 음을 기억하고 있었던 것이다.`,
      `${josa.을(thing)} 되찾은 ${josa.은(hero)} 그날부터 ${friend}에게 저녁마다 「${song}」 음을 불러 주었다. 잃어버린 것은 노래로 찾는다 — 이슬터 사람들이 하는 말이다.`,
    ];
  } else if (frame === 1) {
    title = `${josa.로(place2)} 간 ${hero}`;
    pages = [
      `${josa.은(hero)} 늘 ${place}에서만 살았다. 어느 날 하늘배 길잡이가 ${place2} 이야기를 들려주었다.`,
      `${josa.은(hero)} 짐을 쌌다. ${josa.을(thing)} 챙기고, 빛길 캡슐을 타고, 마지막에는 하늘배를 탔다. 창밖으로 ${josa.이(friend)} 날고 있었다.`,
      `${place2}에서 ${josa.은(hero)} ${josa.을(role)} 만났다. ${josa.은(role)} ${hero}에게 그곳의 노래를 가르쳐 주었다. 처음 듣는 박자였지만, 끝음은 ${place}의 노래와 같았다.`,
      `돌아오는 길에 ${josa.은(hero)} 깨달았다. 노래는 곳마다 달라도 끝음은 하나였다. 그래서 어디를 가도 집으로 돌아오는 길을 잃지 않는다.`,
    ];
  } else if (frame === 2) {
    title = `${hero}의 첫 품삯`;
    pages = [
      `${hero}의 이웃 할머니는 ${josa.을(thing)} 갖고 싶어 했다. ${josa.은(hero)} 할머니께 그것을 선물하고 싶었지만 울이 없었다.`,
      `${josa.은(hero)} 울림판 단말에서 일자리를 찾았다. ${role}의 일을 돕는 자리였다. 면접에서 면접관이 물었다. 「지친 동료에게 어떻게 하겠어요?」 ${josa.은(hero)} 대답했다. 「같이 노래할게요.」`,
      `한 주 동안 ${josa.은(hero)} 열심히 일했다. 퇴근할 때마다 그 회사 금고에서 품삯이 들어왔다. 가게에서 ${josa.을(thing)} 사고, 남은 울로는 할머니가 좋아하는 꿀결 케이크도 샀다.`,
      `할머니는 선물을 받고 웃었다. 「이 울은 네 일에서 왔고, 네 일은 이웃에게서 왔고, 이제 다시 이웃에게 돌아왔구나.」 쓴 울은 다시 이웃에게 돈다.`,
    ];
  } else if (frame === 4) {
    title = `${josa.와(hero)} 멈춘 ${machine}`;
    pages = [
      `아침에 ${place}의 ${josa.이(machine)} 멈췄다. 어른들은 모두 일터에 가 있었고, 남은 것은 ${josa.와(hero)} ${friend}뿐이었다.`,
      `${josa.은(hero)} ${machine}에 귀를 댔다. 안에서 아주 작은 소리가 났다. 한 음이 다른 음보다 조금 낮았다.`,
      `${josa.은(hero)} 「${song}」 음을 그 낮은 음에 맞춰 길게 불렀다. 처음엔 아무 일도 없었다. ${josa.이(friend)} 함께 울자, ${josa.이(machine)} 덜컹 하더니 다시 돌기 시작했다.`,
      `저녁에 돌아온 ${josa.은(role)} 이야기를 듣고 웃었다. 「기계는 고치는 게 아니라 다시 맞추는 거란다. 너는 벌써 그걸 알았구나.」`,
    ];
  } else if (frame === 5) {
    title = `${hero}의 이름 노래`;
    pages = [
      `${josa.은(hero)} 먼 곳에서 ${place}로 이사 왔다. 이웃들은 친절했지만, 아직 아무도 ${hero}의 이름 노래를 몰랐다.`,
      `이름 노래는 스스로 지어야 한다. ${josa.은(hero)} 며칠 동안 ${place}의 소리를 들었다. ${friend}의 울음, 바람, 그리고 저녁마다 들리는 「${song}」 음.`,
      `고리 모임 날, ${josa.은(hero)} 광장 가운데 서서 그 소리들을 이어 불렀다. 목소리가 떨렸다. 노래가 끝나자 아무 소리도 나지 않았다.`,
      `그때 맨 앞의 ${josa.이(role)} 같은 노래를 그대로 불러 돌려주었다. 이어서 모두가 불렀다. 그날부터 ${place}에는 ${hero}의 집이 하나 생겼다.`,
    ];
  } else if (frame === 6) {
    title = `${josa.와(hero)} 길 잃은 ${friend}`;
    pages = [
      `${place}의 골목에서 ${josa.은(hero)} 작은 ${josa.을(friend)} 보았다. 무리에서 떨어진 것 같았다. ${josa.은(friend)} 겁에 질려 몸을 웅크리고 있었다.`,
      `${josa.은(hero)} 울림판 단말에서 ${friend} 무리가 지금 어디 있는지 찾아보았다. 무리는 ${place2} 쪽으로 가고 있었다. 꽤 먼 길이었다.`,
      `둘은 함께 걸었다. ${josa.은(hero)} ${food} 한 조각을 나눠 주었고, ${josa.은(friend)} 밤이 되자 몸에서 빛을 내어 길을 비췄다.`,
      `새벽에 ${place2}에 닿았을 때, 무리가 한꺼번에 빛을 깜빡였다. ${josa.은(friend)} 돌아보지 않고 달려갔다. ${josa.은(hero)} 그래도 좋았다. 돌아갈 곳이 있다는 것은 좋은 일이니까.`,
    ];
  } else if (frame === 7) {
    title = `${hero}네 가게`;
    pages = [
      `${hero}네 가족은 ${place}에서 작은 가게를 한다. 가장 잘 팔리는 것은 ${food}이다. 아침이면 진열대가 가득 차고, 저녁이면 텅 빈다.`,
      `어느 날 창고에서 ${josa.이(food)} 오지 않았다. 공장이 하루 멈췄기 때문이다. 단골들이 빈 진열대를 보고 고개를 갸웃했다.`,
      `${josa.은(hero)} 빈 칸에 쪽지를 붙였다. 「오늘은 없어요. 대신 이웃집 ${role} 아저씨가 만든 것을 드셔 보세요.」 그날 가게는 이웃의 물건으로 채워졌다.`,
      `다음 날 ${josa.이(food)} 다시 왔다. 단골들은 웃으며 말했다. 「없는 날도 나쁘지 않았어.」 가게는 물건을 파는 곳이지만, 이웃을 잇는 곳이기도 하다.`,
    ];
  } else {
    title = `${place}에서 ${josa.이(hero)} 들은 밤`;
    pages = [
      `${place}에 밤이 왔다. 우르가 크게 떠올랐고, ${josa.이(friend)} 하나둘 빛을 켰다.`,
      `${josa.은(hero)} 잠이 오지 않았다. 창가에 앉아 ${friend}의 빛을 세었다. 하나, 둘, 셋… 세다 보니 빛이 ${song} 음에 맞춰 깜빡이고 있었다.`,
      `${josa.은(hero)} 작게 ${song} 음을 불렀다. 그러자 빛이 조금 더 밝아졌다. 밤이 대답하고 있었다.`,
      `그날 밤 ${josa.은(hero)} 처음으로 알았다. 밤은 조용한 것이 아니라, 아주 작게 노래하는 것이라는 것을.`,
    ];
  }
  return { id: `t-${k}`, subject: k % 3 === 0 ? 'child' : 'story', title, author: `${pickR(r, SYL_A)}${pickR(r, SYL_B)} 지음`, pages };
}
function poems(k) {
  const r = rng(5000 + k);
  const NOUN = ['갈대', '이슬', '우르', '고리 거리', '척추', '하늘배', '노래수정', '빛버섯', '물결', '공명탑', '별비', '생명나무', '바람', '승강줄', '등불나무'];
  const VERB = ['운다', '빛난다', '기다린다', '돌아온다', '흔들린다', '잠든다', '깨어난다', '부른다', '듣는다', '떠오른다'];
  const ADV = ['아주 작게', '천천히', '오래', '둥글게', '높이', '낮게', '함께', '다시'];
  const poem = () => {
    const a = pickR(r, NOUN), b = pickR(r, NOUN.filter((x) => x !== a)), c = pickR(r, NOUN.filter((x) => x !== a && x !== b)), s = pickR(r, SONG);
    return [`${josa.이(a)} ${pickR(r, ADV)} ${pickR(r, VERB)}`, `${b}의 그림자가 ${josa.을(c)} 덮을 때`, `나는 「${s}」 한 음을 쥐고`, `${pickR(r, ['너에게로 간다', '집으로 간다', '아침을 기다린다', '이름을 부른다', '고리를 한 바퀴 돈다'])}`].join('\n');
  };
  const theme = pickR(r, ['들판', '도시', '밤', '바다', '하늘', '일터', '집', '길']);
  return { id: `s-${k}`, subject: 'song', title: `${theme}의 노래 ${k + 1}`, author: `${pickR(r, SYL_A)}${pickR(r, SYL_B)}의 시`, pages: [poem(), poem(), poem(), poem()] };
}

// ── 구역 연대 기록 (서고의 기록 결정 — 권마다 한 해) ──
const SEASON = ['싹 철', '빛 철', '열매 철', '서리 철'];
const ORG_SUF = ['공방', '상회', '식당', '찻집', '재배원', '배움터', '쉼터', '치유소'];
const TOPIC = ['새 공중다리를 놓기로', '광장 분수를 고치기로', '배움의 집을 한 층 늘리기로', '재배원 둘레에 꽃길을 내기로', '밤에도 빛길 캡슐을 돌리기로', '옥상마다 작은 정원을 두기로', '고리 둘레에 쉼터를 하나 더 짓기로'];
function annal(zone, k) {
  const zn = ZONE_NAMES[zone] || zone;
  let h = 7;
  for (let i = 0; i < zone.length; i++) h = (h * 31 + zone.charCodeAt(i)) >>> 0;
  const r = rng(90000 + (h % 50000) + k * 7);
  const Y = 280 + k;
  const nm = () => pickR(r, SYL_A) + pickR(r, SYL_B);
  const goods = Object.values(GOODS).filter((G) => G.price), recs = Object.values(RECIPES);
  const places = PLACES.filter((p) => p.name).map((p) => p.name);
  const kinds = [0, 1, 2, 3, 4, 5, 6, 7, 8, 0, 1, 3, 6, 8];
  for (let i = kinds.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [kinds[i], kinds[j]] = [kinds[j], kinds[i]]; }
  let kq = 0;
  const ev = () => {
    const t = kinds[kq++ % kinds.length];
    if (t === 0) { const o = `${nm()} ${pickR(r, ORG_SUF)}`; return `고리 ${1 + Math.floor(r() * 6)}에 「${o}」${hasFinal(o) ? '이' : '가'} 문을 열었다. 첫날 이웃 ${20 + Math.floor(r() * 80)}명이 다녀갔다.`; }
    if (t === 1) { const G = pickR(r, goods), a = G.price, b = Math.round((a * (1.1 + r() * 0.4)) * 10) / 10; return `${G.name} 값이 ${won(a)}에서 ${won(b)}까지 올랐다가 열흘 만에 돌아왔다. ${pickR(r, ['거둠이 늦었기 때문이다.', '공장 줄 하나가 쉬었기 때문이다.', '축제로 찾는 이가 많았기 때문이다.'])}`; }
    if (t === 2) return `별비가 내렸다. 이튿날 온실에 별씨 ${30 + Math.floor(r() * 200)}알이 맡겨졌다.`;
    if (t === 3) { const c = pickR(r, CREATURE); return `${c} 무리가 ${pickR(r, places)} 쪽으로 지나갔다. 아이들이 ${40 + Math.floor(r() * 300)}까지 세다 잠들었다.`; }
    if (t === 4) return `고리 모임이 열려 ${pickR(r, TOPIC)} 정했다. 모두의 음이 모이기까지 ${2 + Math.floor(r() * 5)}시간이 걸렸다.`;
    if (t === 5) { const a = nm(); return `${josa.이(a)} 이름 노래를 불렀다. 거리가 받아 돌려주었고, ${josa.은(a)} 그날 시민이 되었다.`; }
    if (t === 6) { const R = pickR(r, recs); return `공장 단지가 새 공정 「${R.name}」${hasFinal(R.name) ? '을' : '를'} 들였다. 첫 달에 ${Object.keys(R.out).map((o) => gn(o)).join('·')} ${100 + Math.floor(r() * 900)}개를 만들었다.`; }
    if (t === 7) return pickR(r, ['큰 바람이 불어 하늘배가 하루 쉬었다. 빛길 캡슐은 그대로 돌았다.', '우르가 해를 가렸다. 온 거리가 「고요」 음을 함께 불렀다.', '첫서리가 내렸다. 재배원들이 밤새 빛 덮개를 씌웠다.', '사흘 내내 비가 왔다. 물노래 가수들이 빗소리에 맞춰 노래했다.']);
    return `${pickR(r, ['발전소', '물류 창고', '치유원', '배움의 집', '서고'])}에서 일할 이웃 ${3 + Math.floor(r() * 20)}명을 새로 뽑았다. 지원한 이는 그 세 배였다.`;
  };
  const pages = SEASON.map((S, q) => {
    const n = 2 + Math.floor(r() * 2), when = Array.from({ length: n }, () => (q * 3 + Math.floor(r() * 3)) * 30 + Math.floor(r() * 30)).sort((a, b) => a - b);
    return `${S}\n${when.map((w) => `· ${Math.floor(w / 30) + 1}달 ${(w % 30) + 1}날 — ${ev()}`).join('\n')}`;
  });
  return { id: `n-${zone}-${k}`, subject: 'history', title: `${zn} 연대 기록 — 높은 해 ${Y}년`, author: `${zn} 기록관`, pages, annal: true };
}

// ── 분류마다 권 수가 끝없는 책 (큰 서고의 나머지 서가) ──────────────
// 같은 (분류, 번호)는 늘 같은 책. 모두 게임 자료(물건·공정·생물·장소·구역·말)에서 짓는다.
const ZONE_IDS = Object.keys(ZONE_NAMES);
const NEAR_PLACES = PLACES.filter((p) => p.name && !['rift', 'plains', 'icesea', 'falls'].includes(p.region) && ['village', 'vista', 'pylon', 'crash', 'arch', 'observatory', 'glasscity', 'bloomcity', 'canyoncity', 'seacity', 'landmark'].includes(p.type)).map((p) => p.name);
const WEATHER = ['맑음', '흐림', '바람', '비', '안개', '별비', '서리'];
const date = (r, q) => { const w = (q * 3 + Math.floor(r() * 3)) * 30 + Math.floor(r() * 30); return [w, `${Math.floor(w / 30) + 1}달 ${(w % 30) + 1}날`]; };
/** 한 해의 날짜 붙은 기록 n줄을 쪽 pages 개로 (날짜 차례) */
const dated = (r, n, line, pages = 3) => { const L = Array.from({ length: n * pages }, (_, q) => date(r, Math.floor((q * 4) / (n * pages)))).sort((a, b) => a[0] - b[0]).map(([, d]) => `${d} — ${line()}`); return Array.from({ length: pages }, (_, k) => L.slice(k * n, (k + 1) * n).join('\n')); };
function observe(n) {
  const r = rng(30000 + n), who = pickR(r, SYL_A) + pickR(r, SYL_B), place = pickR(r, NEAR_PLACES);
  const beasts = Object.values(CODEX).filter((c) => c.cat === '생물').map((c) => c.name), plants = Object.values(CODEX).filter((c) => c.cat === '식물').map((c) => c.name);
  const DO = ['무리 지어 지나갔다', '물가에서 쉬고 있었다', '새끼를 데리고 나왔다', '빛을 깜빡이며 서로를 불렀다', '바람을 따라 높이 올랐다', '꽃가루를 몸에 묻히고 다녔다', '「고요」 음에 맞춰 움직였다', '낯선 이를 피하지 않았다'];
  const GROW = ['새순을 냈다', '밤새 빛을 냈다', '포자를 날렸다', '바람에 맞춰 울었다', '첫 열매를 맺었다', '잎을 접고 쉬었다'];
  const line = () => { const pl = plants.length && r() < 0.35, c = pickR(r, pl ? plants : beasts), k = 2 + Math.floor(r() * 30); return `${pickR(r, WEATHER)}. ${c} ${k}${pl ? '그루' : '마리'}가 ${pickR(r, pl ? GROW : DO)}. ${pickR(r, ['지난번보다 많다.', '처음 보는 무늬가 있었다.', '아이들이 함께 셌다.', '소리를 결정에 담아 두었다.', '해 질 녘까지 지켜보았다.'])}`; };
  return { id: `g-nature-${n}`, subject: 'nature', title: `${place} 관찰 일지 ${n + 1}권`, author: `관찰자 ${who}`, pages: [`${place}에서 본 것들을 날마다 적는다. 이름을 모르는 것은 그림으로 남겼다.`, ...dated(r, 3, line)] };
}
function skylog(n) {
  const r = rng(31000 + n), who = pickR(r, SYL_A) + pickR(r, SYL_B);
  const PH = ['가득 찬', '반쯤 찬', '가는', '기우는', '차오르는'];
  const EV = () => pickR(r, [`별비 ${3 + Math.floor(r() * 90)}줄기가 북쪽 하늘을 그었다.`, `왕복선 ${1 + Math.floor(r() * 9)}척이 하늘닻과 고리 사이를 오갔다.`, `고리의 그림자가 들판을 ${2 + Math.floor(r() * 5)}시간 덮었다.`, '먼 곳의 낯선 떨림은 들리지 않았다.', `큰 귀가 먼 별의 떨림을 ${1 + Math.floor(r() * 4)}번 들었다. 음은 「${pickR(r, SONG)}」에 가까웠다.`, '구름이 짙어 아무것도 보지 못했다. 대신 오래 들었다.', `하늘배의 빛 ${10 + Math.floor(r() * 60)}개가 남쪽으로 흘러갔다.`]);
  return { id: `g-sky-${n}`, subject: 'sky', title: `별듣는 탑 관측 기록 ${n + 1}권`, author: `관측자 ${who}`, pages: [`관측은 해가 진 뒤 시작해 우르가 기울 때 끝난다. 별은 보기보다 듣는다.`, ...dated(r, 3, () => `우르는 ${pickR(r, PH)} 모양. ${EV()}`)] };
}
function kitchen(n) {
  const r = rng(32000 + n), who = pickR(r, SYL_A) + pickR(r, SYL_B);
  const dishes = Object.keys(GOODS).filter((k) => GOODS[k].eat && MAKER[k] && GOODS[k].cat !== 'med');
  const page = () => { const k = pickR(r, dishes), R = RECIPES[MAKER[k]]; const ins = Object.entries(R.in).map(([i, v]) => `${gn(i)} ${v}`).join(', '); return `「${GOODS[k].name}」\n재료: ${ins}\n${pickR(r, ['재료를 고르게 섞고 낮은 「고요」 음으로 오래 익힌다.', '센 불에 짧게, 노래 한 소절 동안만.', '반죽을 쉬게 한 뒤 둥글게 빚는다.', '차게 두었다가 먹기 직전에 꺼낸다.'])} ${pickR(r, ['아이들은 조금 달게.', '손님이 오면 두 배로.', '남으면 이웃에게.', '공장에서 만든 것과 맛을 견주어 보자.', `가게에서 사면 ${won(GOODS[k].price)}.`])}`; };
  return { id: `g-life-${n}`, subject: 'life', title: `${who}의 부엌 수첩 ${n + 1}권`, author: `${who}`, pages: [`우리 집 부엌에서 자주 하는 것들. 재료는 모두 가게에서 구할 수 있다.`, page(), page(), page(), page()] };
}
function maint(n) {
  const r = rng(33000 + n), line = pickR(r, Object.keys(LINES)), recs = LINES[line].map((k) => RECIPES[k]).filter(Boolean);
  const ev = () => { const R = pickR(r, recs); return pickR(r, [`「${R.name}」 기계가 ${1 + Math.floor(r() * 5)}시간 멈췄다. 코일 음이 어긋나 있었다. 다시 맞추고 돌렸다.`, `「${R.name}」 ${50 + Math.floor(r() * 400)}번 돌림. ${Object.keys(R.out).map(gn).join('·')} 창고로.`, `원료가 모자라 「${R.name}」${hasFinal(R.name) ? '을' : '를'} 쉬었다. ${josa.을(Object.keys(R.in).map(gn).join('·'))} 창고에 청했다.`, `발전소 빛이 약해 줄 전체를 반만 돌렸다.`, `새 일꾼 ${1 + Math.floor(r() * 4)}명이 「${R.name}」${hasFinal(R.name) ? '을' : '를'} 배웠다.`]); };
  return { id: `g-tech-${n}`, subject: 'tech', title: `${LINE_NAME[line] || line} 공장 정비 일지 ${n + 1}권`, author: '공장 단지 정비조', pages: [`이 일지에는 ${LINE_NAME[line] || line} 줄의 기계 ${recs.length}가지가 멈추고 다시 돈 날을 적는다.`, ...dated(r, 3, ev)] };
}
function care(n) {
  const r = rng(34000 + n);
  const WHY = ['가벼운 어지럼', '잠 못 듦', '목소리 갈라짐', '발목 삠', '울림 들뜸', '오래 일한 피로', '높은 곳 멀미', '열'];
  const DO = ['고른울림 약을 주고 쉬게 했다', '잠 고치에서 이십 분 쉬게 했다', '울림 스캐너로 살핀 뒤 집으로 보냈다', '치료 고치에서 하룻밤 지냈다', '물을 마시게 하고 「고요」 음을 함께 불렀다', '붕대를 감고 사흘 쉬라고 일렀다'];
  return { id: `g-heal-${n}`, subject: 'heal', title: `치유원 돌봄 일지 ${n + 1}권`, author: '종합 치유원 간호 모임', pages: ['이름은 적지 않는다. 어디가 어긋났고 무엇을 했는지만.', ...dated(r, 3, () => `${josa.로(pickR(r, WHY))} 온 이웃 ${1 + Math.floor(r() * 12)}명. ${pickR(r, DO)}.`)] };
}
function streets(n) {
  const r = rng(35000 + n), z = ZONE_IDS[n % ZONE_IDS.length], zn = ZONE_NAMES[z], ring = 1 + Math.floor(n / ZONE_IDS.length) % 9;
  const ORG = () => `${pickR(r, SYL_A)}${pickR(r, SYL_B)} ${pickR(r, ORG_SUF)}`;
  return { id: `g-city-${n}`, subject: 'city', title: `${zn} 고리 ${ring} 걷기 (${Math.floor(n / ZONE_IDS.length / 9) + 1}판)`, author: '길 안내소', pages: [
    `${zn}의 ${josa.은(`고리 ${ring}`)} 한 바퀴 걷는 데 ${20 + Math.floor(r() * 50)}분쯤 걸린다. 곧은길과 만나는 네거리마다 안내 빛판이 있다.`,
    `이 고리에서 들를 만한 곳: ${[ORG(), ORG(), ORG()].map((o) => `「${o}」`).join(', ')}. ${pickR(r, ['가게 거리는 해 질 녘이 가장 붐빈다.', '골목 안쪽 찻집은 아는 이만 안다.', '광장 분수에서는 저녁마다 노래가 들린다.'])}`,
    `${pickR(r, ['빛길 역은 고리 북쪽에 있다.', '호버 차 정류장은 고리마다 넷.', '공중다리로 이어진 탑이 몇 채 있다 — 승강기 홀에서 다리 문으로.'])} ${pickR(r, ['길을 잃으면 가장 높은 탑을 향해 걸으면 된다.', '건물 정문 옆 울림판 단말에서 건물 안 지도도 볼 수 있다.'])}`,
    `${pickR(r, ['쉼터', '공원', '재배원', '배움터'])} ${1 + Math.floor(r() * 4)}곳, 치유소 ${Math.floor(r() * 3)}곳, 서고 ${Math.floor(r() * 2) + 1}곳. 고리 ${ring}의 사람들은 「같은 고리에서 만나요」라고 인사한다.`,
  ] };
}
function minutes(n) {
  const r = rng(36000 + n), z = ZONE_IDS[n % ZONE_IDS.length], zn = ZONE_NAMES[z];
  const meet = () => { const t = pickR(r, TOPIC), yes = 30 + Math.floor(r() * 70); return `${t} 할지 이야기했다. 처음에는 같은 음으로 받은 이가 ${yes}명 가운데 ${Math.floor(yes * (0.4 + r() * 0.5))}명. ${pickR(r, ['한 번 더 이야기한 뒤 모두의 음이 모였다.', '다음 모임까지 더 듣기로 했다.', '작게 먼저 해 보고 다시 모이기로 했다.'])}`; };
  return { id: `g-law-${n}`, subject: 'law', title: `${zn} 고리 모임 기록 ${Math.floor(n / ZONE_IDS.length) + 1}권`, author: `${zn} 행정 창구`, pages: ['모임 기록은 누구나 창구에서 청해 읽을 수 있다.', ...dated(r, 2, meet)] };
}
function drills(n) {
  const r = rng(37000 + n);
  const ws = Array.from({ length: 9 }, () => pickR(r, WORDS));
  return { id: `g-words-${n}`, subject: 'words', title: `아웬 말 익힘책 ${n + 1}권`, author: '하모네아 배움의 집', learn: ws.map((w) => w.id), pages: [
    '낱말을 소리 내어 부르고, 두 낱말을 이어 불러 보자. 아웬 말은 이어 부를 때 끝음과 첫음이 만나 새 뜻이 된다.',
    ...[0, 3, 6].map((k) => ws.slice(k, k + 3).map((w) => `「${w.ko}」 — ${noteStr(w.notes)}`).join('\n') + `\n이어 부르기: 「${ws[k].ko}」+「${ws[k + 1].ko}」`),
  ] };
}
const GEN_BY = { nature: observe, sky: skylog, life: kitchen, tech: maint, heal: care, city: streets, law: minutes, words: drills };
/**
 * 분류 subject 의 목록 너머 n번째 책 id (서가를 채울 때). history 는 구역들의 연대 기록, song 은 시, story·child 는 이야기.
 */
export function moreOf(subject, n, zone) {
  if (subject === 'history') return annalId(ZONE_IDS[n % ZONE_IDS.length], Math.floor(n / ZONE_IDS.length));
  if (subject === 'song') return `s-${POEMS + n}`;
  if (subject === 'child') return `t-${TALES + n * 3 + (3 - (TALES % 3)) % 3}`;
  if (subject === 'story') { const k = TALES + n + Math.floor(n / 2) + 1; return `t-${k % 3 === 0 ? k + 1 : k}`; }
  return `g-${subject}-${n}`;
}

// ── 모으기 ──
const TALES = 64, POEMS = 32;
export const BOOKS = [
  ...AUTHORED, ...wordBooks(), ...lineBooks(), ...categoryBooks(), ...zoneBooks(), ...codexBooks(), ...placeBooks(), ...archiveBook(),
  ...oldBooks(), ...peopleBooks(), ...regionBooks(),
  ...Array.from({ length: TALES }, (_, k) => tale(k)), ...Array.from({ length: POEMS }, (_, k) => poems(k)),
];
export const BOOK = Object.fromEntries(BOOKS.map((b) => [b.id, b]));
/** 분류마다 책 id 목록 */
export const BY_SUBJECT = (() => { const m = {}; for (const b of BOOKS) (m[b.subject] = m[b.subject] || []).push(b.id); return m; })();
/**
 * 책 찾기 — 목록의 책 + 씨앗으로 짓는 책(목록 너머의 이야기 t-·시 s-, 구역 연대 기록 n-구역-권).
 * 큰 서고는 목록을 다 꽂고도 남는 칸을 이 책들로 채운다 (같은 id 는 늘 같은 책).
 */
const _made = new Map();
export function bookById(id) {
  if (BOOK[id]) return BOOK[id];
  if (_made.has(id)) return _made.get(id);
  let b = null, m;
  if ((m = /^t-(\d+)$/.exec(id))) b = tale(+m[1]);
  else if ((m = /^s-(\d+)$/.exec(id))) b = poems(+m[1]);
  else if ((m = /^n-(.+)-(\d+)$/.exec(id))) b = annal(m[1], +m[2]);
  else if ((m = /^g-(\w+)-(\d+)$/.exec(id)) && GEN_BY[m[1]]) b = GEN_BY[m[1]](+m[2]);
  if (b) { if (_made.size > 4000) _made.clear(); _made.set(id, b); }
  return b;
}
/** 구역 연대 기록 k권 id */
export const annalId = (zone, k) => `n-${zone}-${k}`;
/** 책등 빛깔 (책마다 고정) */
export function bookColor(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const P = [0x8a4a3a, 0x3a5a8a, 0x4a7a5a, 0x8a7a3a, 0x6a3a7a, 0x2a6a7a, 0x9a5a2a, 0x5a5a6a, 0x7a2a3a, 0x3a7a8a, 0xc8a870, 0x6a8a3a];
  return P[h % P.length];
}
