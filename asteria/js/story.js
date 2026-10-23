// 아스테리아 1부 — 이야기 (대사, 장 진행, 편지, 수집물, 아이템)
'use strict';

const OSWIN_LOOK = { cloak: '#5a4a7a', body: '#e8e0cf', hair: '#d8d0c8', skin: '#f0d0b0' };
const MIRA_LOOK = { cloak: '#8a5ac8', hair: '#e86a3a', body: '#f0e8d8' };
const KASSIAN_LOOK = { cloak: '#a83a4a', hair: '#e8c060', body: '#f0e8d8', scarf: '#d8b040' };
const REN_LOOK = () => ({ cloak: G.f.coat ? '#2f7f7a' : '#3b6ea8', hair: '#3a2a20', body: '#f0e8d8', scarf: G.f.stone && !G.f.stoneSilent ? '#7ff0ff' : null });

const RUNES = {
  magnes: { name: '인력', glyph: '인', c: '#ff5ab0', desc: '금속을 끌어당겨 붙든다. 붙든 채로 움직이면 따라온다.\nQ: 붙들기 · 다시 Q: 놓기' },
  stasis: { name: '정체', glyph: '정', c: '#ffd27a', desc: '앞에 있는 것의 시간을 잠깐 붙든다. 붙든 적을 때리면 풀릴 때 한꺼번에 맞는다.\n시간이 멈춘 물건은 다시 풀어줄 수도 있다.' },
  cryo: { name: '결빙', glyph: '빙', c: '#9fe8ff', desc: '앞의 물을 얼려 발판을 만든다. 얼음은 세 개까지 남는다.\n얼음을 향해 다시 쓰면 녹는다. 얼음은 경사처럼 밟고 오를 수 있다.' },
  burst: { name: '파열', glyph: '파', c: '#7ff0ff', desc: '마력 구슬을 놓는다. 잠시 뒤 터져서 금 간 벽과 결정을 부순다.\n한 번 더 Q를 누르면 바로 터진다. 너무 가까이 있으면 렌도 다친다.' },
};
const WEAPONS = {
  stick: { name: '나뭇가지', dmg: 2, dur: 10, c: '#a87a4a' },
  emberBlade: { name: '불씨 단검', dmg: 3, dur: 18, c: '#ff8a3a', elem: 'fire' },
  frostSpear: { name: '서리 창', dmg: 4, dur: 22, c: '#bfe8ff', elem: 'frost', reach: 2.8 },
  wood: { name: '연습용 목검', dmg: 2, dur: 20, c: '#d8b080' },
  brass: { name: '놋쇠 단검', dmg: 3, dur: 22, c: '#d8b040' },
  runeSword: { name: '룬 장검', dmg: 5, dur: 26, c: '#7ff0ff', elem: 'shock' },
  pick: { name: '광부 곡괭이', dmg: 4, dur: 24, c: '#9a9aa8' },
  saltSpear: { name: '소금 창', dmg: 4, dur: 28, c: '#eef6ff', elem: 'frost', reach: 2.8 },
  leafblade: { name: '낙엽 검', dmg: 4, dur: 30, c: '#ffb35a', elem: 'wind' },
  ancient: { name: '고대 룬검', dmg: 7, dur: 40, c: '#c0b0ff', elem: 'fire' },
};
const ITEMS = {
  carrot: { name: '당근', heal: 2, ing: true },
  potato: { name: '감자', heal: 2, ing: true },
  herb: { name: '들허브', heal: 1, ing: true, desc: '지맥 근처에서 자라는 향긋한 풀' },
  berry: { name: '빛딸기', heal: 2, ing: true },
  apple: { name: '노을사과', heal: 2, ing: true },
  mushroom: { name: '기운버섯', heal: 2, stam: 20, ing: true, desc: '먹으면 숨이 덜 찬다' },
  pepper: { name: '불꽃고추', heal: 1, warm: 60, ing: true, desc: '요리에 넣으면 몸이 데워진다' },
  meat: { name: '마력 짐승 고기', heal: 4, ing: true },
  fish: { name: '생선', heal: 4, ing: true },
  salt: { name: '마르셀라 소금', heal: 0, ing: true, desc: '요리에 넣으면 회복량이 늘어난다' },
  dust: { name: '잔향 가루', heal: 0, ing: true, desc: '잔향이 흩어진 자리에 남는 반짝이는 가루' },
  bread: { name: '빵', heal: 6, ing: true },
  candy: { name: '온기 사탕', heal: 1, warm: 100, ing: true, desc: '미라의 특제. 맛은 묻지 말 것' },
  manabloom: { name: '마력꽃', heal: 1, mana: 40, ing: true, desc: '지맥 근처에 피는 꽃. 먹으면 마력이 찬다' },
  crystal: { name: '공명 결정', desc: '응축된 지맥 마력' },
  torch: { name: '횃불' },
};
const SHOPS = {
  tailor: { name: '재봉사 넬의 가게', list: [{ key: 'furcoat', label: '털 외투', price: 60, desc: '추위를 크게 덜어준다' }, { item: 'candy', price: 8 }, { item: 'herb', price: 3 }] },
  salt: { name: '마르셀라 염전 가게', list: [{ item: 'salt', price: 4 }, { item: 'pepper', price: 5 }] },
  fish: { name: '마르셀라 어시장', list: [{ item: 'fish', price: 6 }, { weapon: 'saltSpear', price: 45, desc: '소금 결정을 깎아 만든 창' }] },
  elm: { name: '엘름바텐 숲 상인', list: [{ item: 'mushroom', price: 4 }, { item: 'apple', price: 3 }, { key: 'furcoat', label: '털 외투', price: 70, desc: '추위를 크게 덜어준다' }] },
  grav: { name: '그레타의 대장간', list: [{ key: 'furcoat', label: '털 외투', price: 55, desc: '추위를 크게 덜어준다' }, { weapon: 'pick', price: 30 }, { item: 'pepper', price: 4 }] },
};

// ---------- 수집물 ----------
const JOURNAL = {
  manuscript: { title: '기록보관소 필사본', where: '1장 · 칼리도르 기록보관소', text: '칼리도르 지하 출토 석판 제7번\n\n…ET COR CALIDORIS NON DORMIT…\n\n번역: 그리고 칼리도르의 기관은 잠들지 않는다.\n\n(여백, 렌의 글씨) \'COR\'를 학원 사전대로 \'기관\'으로 옮김. 다른 비문에서는 \'심장\'으로 읽히기도 함. 확인 필요.', reread: '그리고 칼리도르의 심장은 잠들지 않는다.' },
  roster: { title: '평의회 원정 명단', where: '1장 · 대강당', text: '정비 원정대 명단\n\n1대: 카시안 벨 (2년 차) 외 4명 · 북부 경유\n2대: 렌 아르덴 (2년 차) · 단독 · 오스윈 헤일 추천\n3대: 마르타 쿤 (1년 차) 외 3명 · 남부 경유\n\n비고: 원정대원은 모두 2년 차 이하로 한다. 현장은 젊은 몸이 버틴다.', reread: '젊은 몸이 버틴다. 의자 위에서, 오래.' },
  fieldlog: { title: '렌의 현장 일지, 첫 장', where: '1장 · 원정 전날 밤', hand: true, text: '원정 첫날. 맑음.\n공명석이 가끔 뛴다. 내 맥보다 조금 느리게.\n\n(구석에 물방울 고래 스케치. 지느러미가 하나 더 그려져 있다)', reread: '그 돌은 처음부터 빈자리에 맞춰 뛰고 있었다.' },
  prayer: { title: '순례자의 기도문', where: '2장 · 성녀 마렌 성당', text: '성녀여, 당신이 깨어 계신 동안 우리는 따뜻합니다.\n부디 오래 깨어 계시고, 부디 편히 잠드소서.', reread: '마르셀라 사람들은 알고 있었다. 성당 아래에 사람이 있다는 걸.' },
  chronicle: { title: '마르셀라 연대기', where: '2장 · 마르셀라', text: '성녀께서 바다로부터 내려오신 해\n271년 전 · 230년 전 · 191년 전 · 152년 전 · 112년 전 · 71년 전 · 31년 전\n\n(렌의 메모) 정비판의 연도와 하나씩 겹친다. 정비할 때마다 축제를 열었다는 뜻일까.', reread: '정비할 때마다 내려온 것은 성녀가 아니었다. 새 사람이었다.' },
  ledger: { title: '촌장의 장부', where: '3장 · 엘름바텐', text: '가을 열엿새. 맑음. 특이 사항 없음.\n가을 열엿새. 맑음. 특이 사항 없음.\n가을 열엿새. 맑음. 특이 사항 없음.\n…\n\n(같은 날짜가 아흔한 번 적혀 있다)' },
  inscription: { title: '기관실 비문', where: '3장 · 시계탑 기관', text: 'ILLE TEMPUS NON TENET. ILLE TEMPUS SUSTINET.\n\n번역: 그는 시간을 붙들지 않는다. 그는 시간을 견딘다.\n\n(렌의 메모) \'그\'는 기관을 가리키는 대명사.', reread: '\'그\'는 문자 그대로 사람이었다.' },
  minerLetter: { title: '광부의 편지', where: '4장 · 그라벤호프 제3갱', text: '여보, 아래는 아직 버틸 만해.\n기관 근처에서 일하면 밤마다 누군가 노래하는 소리가 들려. 무섭진 않아. 자장가 같아.\n애들한테는 아빠가 노래 하나 배워 간다고 해 줘.', reread: '그 노래는 누구의 것일까.' },
  relayMap: { title: '중계선 배치도', where: '4장 · 용광로 기관실', text: '열두 기관과 각 기관이 데우는 도시 수. 맨 오른쪽에 \'교대 예정 연도\' 칸이 있다.\n\n프리마 · 서부 3개 도시 · 올해\n성녀 마렌 · 마르셀라 외 1 · 9년 뒤\n시계탑 · 엘름바텐 외 2 · 14년 뒤\n용광로 · 그라벤호프와 남부 4 · 22년 뒤\n\n(렌의 메모) 정비 주기로 보인다. 프리마는 올해?', reread: '교대 예정 연도. 다음 심장이 들어갈 해. 프리마는, 올해.' },
  labnote1: { title: '실험실 벽의 낙서', where: '봉인 실험실', text: '적응 훈련 7일째.\n마력 속에서 숨 쉬는 법을 배운다. 스승님은 잘하고 있다고 하신다.\n집에 가고 싶다는 말은 지웠다.', reread: '이곳은 수련실이 아니었다. 심장 후보가 적응하던 방이었다.' },
  labnote2: { title: '훈련 기록 조각', where: '봉인 실험실', text: '후보 3번: 맥박 공명 양호. 다음 단계로.\n후보 5번: 거부 반응. 귀가 조치.\n후보 7번: 울음. 조율석 재조정 후 안정.', reread: '후보. 원정대원은 모두 후보였다.' },
};
function journalText(k) {
  const j = JOURNAL[k];
  let t = j.text;
  if (G.f.translated && j.reread) t += '\n\n― 다시 읽으면 ―\n' + j.reread;
  return t;
}
function addJournal(k) {
  if (!G.journal.includes(k)) G.journal.push(k);
  sfx('pick'); toast('일지에 기록했다: ' + JOURNAL[k].title);
  const j = JOURNAL[k];
  runScript(async () => { await UI.paperShow(j.title, journalText(k), j.hand ? 'hand' : ''); });
}

const TRANSLATION = [
  { word: 'COR', old: '기관', neu: '심장' },
  { word: 'TRADERE', old: '수리', neu: '교대' },
  { word: 'SEDES', old: '기관실', neu: '앉는 자리' },
  { word: 'CLAVIS', old: '조율석', neu: '빈자리의 열쇠' },
];
const STELES = [
  { an: 'COR CALIDA · COR VIGILANS · COR QUOD SPIRAT', ren: ['따뜻한 COR. 깨어 있는 COR. 숨 쉬는 COR.', '…숨 쉰다고? 기계한테 쓰는 말이 아니야. 몸에 쓰는 말이다.', 'COR는 기관이 아니야. 심장이다.'] },
  { an: 'QUISQUE COR SUUM TRADIT · NEMO SINE ALTERO SURGIT', ren: ['저마다 자기 심장을 넘겨준다. 누구도 다른 이 없이는 일어나지 못한다.', '학원이 \'수리\'라고 옮겨온 단어가 이거다. TRADERE.', '고치는 게 아니야. 넘겨주는 거다. 교대다.'] },
  { an: 'SEDES VACUA EXSPECTAT', ren: ['빈자리가 기다린다.', '기관실이라고 배웠던 단어. 그런데 여기서는 사람이 앉는 자리라는 뜻으로만 쓰였다.'] },
  { an: 'CLAVIS PULSU ACCORDATA · VIAM APERIT', ren: ['맥박에 맞춰 조율한 열쇠가 길을 연다.', '맥박에 맞춘… 열쇠.', '(목에 건 공명석이 뛴다. 렌의 맥박과 거의 같은 빠르기로)'] },
];

// ---------- 지역 대사 한 줄 ----------
function engLine(k) {
  if (k === 'marcella') return G.f.plaqueSeen ? '마르셀라 성당의 정비판에서 선생님 이름을 봤어요. \'승인: 오스윈 헤일\', 31년 전이요. 같이 적힌 이소벨 크레인은 누구예요?' : '마르셀라 사람들은 기관을 성녀 마렌이라고 불러요. 바다가 돌아오니까 축제까지 열어줬어요.';
  if (k === 'elm') return G.f.elm === 'full' ? '엘름바텐에서는 조율기를 끝까지 돌렸어요. 숲에 석 달 치 비가 한꺼번에 내렸고, 헤다 할머니가 그날 밤 잠든 채 돌아가셨어요.' : '엘름바텐에서는 조율기를 끝까지 돌리지 않았어요. 헤다 할머니가 아직 정원에 계셔서요. 기록에는 \'미완\'으로 남겠죠.';
  if (k === 'grav') {
    if (G.f.grav === 'pump') return '그라벤호프에서는 마력을 펌프로 보냈어요. 광부 마흔 명이 다 올라왔어요. 남쪽이 추워진다는 건 알아요.';
    if (G.f.grav === 'south') return '그라벤호프에서는 학원 규격대로 남쪽으로 보냈어요. 아래 갱도의 물은… 빠지지 않았어요.';
    return `그라벤호프에서는 수문을 직접 열었어요. ${G.f.rescued}명이 올라왔어요. 다는 못 구했어요.`;
  }
  return '';
}
function letterFor(n) {
  const last = G.f.engOrder ? G.f.engOrder[n - 1] : null;
  if (n === 1) return [
    { title: '오스윈의 편지 · 첫 번째', from: '오스윈 헤일', body: '렌에게.\n\n첫 기관을 고쳤다는 소식, 평의회보다 내가 먼저 들었단다. 공명석이 그쪽 하늘을 한 번 크게 울렸거든. (농담이다. 전갈이 먼저 왔다.)\n\n연구실 차는 네 몫까지 끓여 두고 있다. 식으면 내가 마신다. 벌써 세 잔째다.\n\n현장 일지에 스케치를 너무 많이 그리지는 마라. 기록관이 또 종이 값을 따질 테니.\n\n기관들한테 인사 전해다오. 그 녀석들은 생각보다 외로움을 많이 탄다.\n\n― 오스윈' },
    { title: '렌의 답장 · 첫 번째', from: '렌 아르덴', body: `선생님께.\n\n${engLine(last)}\n\n공명석은 기관 가까이 가니까 정말 빨리 뛰었어요. 제 맥보다는 여전히 조금 느리게요.\n\n차는 세 잔 다 드세요. 돌아가면 제가 새로 끓일게요.\n\n― 렌\n\n추신. 기관한테 인사는 전했어요. 대답은 없었지만요.` },
  ];
  if (n === 2) return [
    { title: '오스윈의 편지 · 두 번째', from: '오스윈 헤일', body: `렌에게.\n\n편지 잘 받았다. 네 글씨가 점점 현장 사람 글씨가 되어 가는구나.\n\n학원은 조금 추워졌다. 대강당 돔에 아직 눈 자국이 남아 있어. 핍이 그 눈을 긁어모아 눈사람을 만들다가 율에게 혼났단다.\n\n${G.f.plaqueSeen ? '네가 물은 것은 돌아오면 이야기하자. 편지로 하기엔 긴 이야기다.\n\n' : ''}공명석은 아직도 네 맥보다 느리게 뛰느냐? 그렇다면 잘 맞춰둔 것이다.\n\n카시안 군을 만났다니 다행이다. 둘 다 무리하지 마라.\n\n― 오스윈` },
    { title: '렌의 답장 · 두 번째', from: '렌 아르덴', body: `선생님께.\n\n${engLine(last)}\n\n그리고 회색 가면을 봤어요. 학원에서 떨림의 원인이라고 하던 사람이요. 기관실 출구에서 저를 기다리고 있었어요.\n그 사람이 이 돌이 누구 맥박으로 뛰는지 생각해 봤냐고 물었어요.\n…무슨 뜻일까요?\n\n― 렌` },
  ];
  return [
    { title: '오스윈의 편지 · 세 번째', from: '오스윈 헤일', body: '렌에게.\n\n평의회의 소집 명령이 이 편지와 함께 갈 것이다. 모든 원정대는 알테라 고원의 프리마로 모인다.\n\n네가 일곱 살 때 처음 학원 문을 지나던 날을 기억하니? 네가 내 손을 너무 꽉 잡아서, 나는 한동안 펜을 못 쥐었단다.\n\n공명석을 꼭 차고 가거라. 길을 잃지 않게.\n\n― 오스윈' },
    { title: '렌의 답장 · 세 번째 (보내지 않음)', from: '렌 아르덴', body: `선생님께.\n\n세 기관을 다 고쳤어요. ${engLine(last)}\n\n선생님은 이소벨 크레인에 대해서도, 회색 가면에 대해서도 대답하지 않으셨어요.\n괜찮아요. 프리마에서 뵙고 여쭤볼게요.\n\n― 렌\n\n(이 편지는 보내지 않았다)` },
  ];
}

// ---------- 공용 진행 ----------
function setObj(t) { G.obj = t; }
function engineCount() { return ['eng_marcella', 'eng_elm', 'eng_grav'].filter(k => G.f[k]).length; }
function engineFixed(k) {
  G.f.engOrder = (G.f.engOrder || []).concat(k);
  const n = engineCount();
  G.f.q = (G.f.q || []).concat(['after_' + k, 'letter' + n]);
  if (n === 1) G.f.q.push('kassian');
  if (n === 2) G.f.maskBeat = G.map.id;
  if (n === 3) G.f.q.push('summons');
  sfx('chime'); G.fadeWhite = true;
  saveGame();
}
function remainingObj() {
  const left = [];
  if (!G.f.eng_marcella) left.push('마르셀라');
  if (!G.f.eng_elm) left.push('엘름바텐');
  if (!G.f.eng_grav) left.push('그라벤호프');
  return left.length ? `공명석을 따라 비틀린 기관 고치기 · 남은 곳: ${left.join(', ')}` : '';
}
async function flash() { G.fadeWhite = true; G.fadeTo = 1; await wait(0.5); G.fadeTo = 0; await wait(0.6); G.fadeWhite = false; }
async function letterPair(n) {
  const [a, b] = letterFor(n);
  sfx('chime'); toast('종이새가 편지를 물고 날아왔다');
  await wait(0.6);
  G.letters.push(a); await UI.paperShow(a.title, a.body, 'hand');
  G.letters.push(b); await UI.paperShow(b.title, b.body, 'hand');
}

// ---------- 룬 배우기 (1장 실험실) ----------
function learnRune(k, ped) {
  runScript(async () => {
    G.runes[k] = true; G.rune = k;
    sfx('chime'); FX.burst(ped.x, ped.y + 1.7, ped.z, 50, COL(RUNES[k].c).getHex(), 6, 1, 0.25); G.flash = { c: COL(RUNES[k].c).getHex(), k: 4, t: 0.4, x: ped.x, y: ped.y + 2, z: ped.z };
    await UI.paperShow(`${RUNES[k].name} 룬`, RUNES[k].desc + `\n\n선택: 숫자 ${Object.keys(RUNES).indexOf(k) + 1} 또는 R · 사용: Q`);
    if (G.map.id === 'under') {
      if (k === 'magnes') await say('렌', '문이 닫혔다! 저 철 상자를 누름판에 올려야 열리나 보다.');
      if (k === 'stasis') await say('렌', '칼날이 돌기 시작했어. 정체 룬으로 잠깐 멈추면 지나갈 수 있겠다.');
      if (k === 'cryo') { for (let y = 6; y <= 8; y++) for (let x = 29; x <= 38; x++) setCell(G.map, x, y, T.DEEP); G.shake = 0.4; sfx('rumble'); await say('렌', '바닥에서 물이 솟았다! 얼음 발판을 만들어 건너자.'); }
      if (k === 'burst') { for (let x = 42; x <= 51; x++) setCell(G.map, x, 8, T.CRACK); G.shake = 0.5; sfx('break'); await say('렌', '천장이 무너졌어! 금 간 돌은 파열 룬으로 부술 수 있다.'); }
      const n = Object.keys(G.runes).length;
      if (n === 4) { toast('룬 네 개를 모두 얻었다 · 기관실 앞방의 봉인이 열린다'); setObj('메아리 식당 아래의 기관실 앞방으로'); }
      else setObj(`봉인 실험실에서 룬 얻기 (${n} / 4)`);
    }
  });
}

// ---------- 파이프 (4장) ----------
function updatePipes() {
  const m = G.map; const at = {};
  for (const e of m.ents) if (e.type === 'pipe') { e.flow = false; at[e.gx + ',' + e.gy] = e; }
  const start = at['47,6'];
  if (!start) return;
  const has = (e, dx, dy) => pipeDirs(e).some(([a, b]) => a === dx && b === dy);
  if (!has(start, -1, 0)) return;
  const q = [start]; start.flow = true;
  while (q.length) {
    const e = q.shift();
    for (const [dx, dy] of pipeDirs(e)) {
      const n = at[(e.gx + dx) + ',' + (e.gy + dy)];
      if (n && !n.flow && has(n, -dx, -dy)) { n.flow = true; q.push(n); }
    }
  }
}
function valveOutlet() {
  const v = G.map.ents.find(e => e.id === 'valve');
  if (!v || !v.flow) return null;
  const d = pipeDirs(v);
  if (d.some(([a, b]) => a === 0 && b === 1)) return 'pump';
  if (d.some(([a, b]) => a === 0 && b === -1)) return 'south';
  return null;
}
function floodgateOpen(e) {
  if (e.opened) return true;
  if (!G.f.gravIgnited) { toast('기관이 멈춰 있어서 수문이 꿈쩍도 하지 않는다'); sfx('deny'); return true; }
  if (G.f.grav === 'pump') { toast('물은 이미 빠졌다'); return true; }
  if (G.f.manualDone || !G.f.manualStart) { toast(G.f.manualDone ? '이미 늦었다. 아래 갱도는 물에 잠겼다' : '수문이 움찔했다. 동력이 들어와 있다'); return true; }
  e.opened = true; e.solid = false; markDone(e.id);
  G.f.rescued = (G.f.rescued || 0) + 8;
  sfx('open'); G.shake = 0.3;
  FX.burst(e.x, e.y + 1, e.z + 0.6, 50, 0x6fb6dd, 5, 1, 0.3, { add: false, grav: 9 });
  toast(`수문이 열렸다 · 아래 갱도의 물이 빠진다 (${G.f.rescued}명)`);
  if (G.map.ents.filter(o => o.type === 'floodgate' && o.opened).length >= 5) TALK.manualEnd();
  return true;
}

// ---------- 사슬 (5장) ----------
function chainCut(e) {
  sfx('chain'); G.shake = 0.3;
  FX.burst(e.x, e.y + 1.3, e.z, 40, 0x7ff0ff, 6, 0.9, 0.25);
  G.f.chainsLeft--;
  G.map.dim = (6 - G.f.chainsLeft) * 0.1;
  toast(`고원의 불빛이 하나 꺼졌다 (${G.f.chainsLeft} / 6)`);
  if (G.f.chainsLeft <= 0) runScript(TALK.release);
}
function readStele(e) {
  runScript(async () => {
    const s = STELES[e.idx];
    const first = !e.read;
    if (first) { e.read = true; G.f.steles = (G.f.steles || 0) + 1; G.f.transl = true; sfx('rune'); FX.burst(e.x, e.y + 2, e.z, 30, 0xc0b0ff, 4, 0.8, 0.2); }
    await UI.paperShow('프리마의 비문', s.an, 'stone');
    for (const l of s.ren) await say('렌', l);
    if (first && G.f.steles >= 4) {
      G.f.translated = true;
      await say('렌', '지금까지 모은 기록들… 전부 다시 읽어야 해.');
      const lines = G.journal.filter(k => JOURNAL[k].reread).map(k => `「${JOURNAL[k].title}」\n${JOURNAL[k].reread}`);
      if (lines.length) await UI.paperShow('다시 읽은 기록', lines.join('\n\n'), 'hand');
      await say('렌', '…가장 깊은 방의 봉인이 풀렸다.');
      setObj('프리마의 가장 깊은 방으로');
    } else if (first) setObj(`프리마의 비문 읽기 (${G.f.steles} / 4)`);
  });
}

// ======================================================================
// 대사와 사건
// ======================================================================
const TALK = {
  enter: {},
  // ---------------- 1장 ----------------
  async opening() {
    G.f.hideHud = true; G.noSave = true;
    G.fade = 1; G.fadeTo = 0;
    cineSpot('open1');
    await caption('아스테리아. 마력의 지맥이 땅 밑을 혈관처럼 흐르는 대륙.', 3.6);
    cineSpot('open2');
    await caption('맑은 봄날 아침, 학원 도시 칼리도르.', 3);
    cineSpot('open3');
    await caption('책들이 새떼처럼 서고 사이를 날아다니고,', 3);
    cineSpot('open4');
    await caption('견습생이 실수로 띄운 물방울 고래가 광장 위를 헤엄친다.', 3.6);
    G.fadeTo = 1; await wait(0.6);
    cineOff();
    await showLoading('기숙사', '');
    enterMap('dorm', 4, 5); CAM.yaw = Math.PI * 0.85;
    hideLoading(); G.fadeTo = 0;
    await wait(0.8);
    await say('렌', '…으음. 몇 시지?');
    await say('렌', '큰일이다! 늦잠이야! 필사본을 오늘 아침까지 기록보관소에 내야 하는데!');
    G.f.hideHud = false; G.noSave = false;
    setObj('필사본을 기록보관소의 베르타에게 전하기 · 기숙사를 나가 북쪽으로');
    toast(UI.touch ? '왼쪽 원으로 움직이고, 오른쪽을 끌어 카메라를 돌린다' : '이동 WASD · 카메라 마우스 · 점프 Space · 말 걸기 E · 메뉴 Tab');
    saveGame();
  },
  berta(e) {
    runScript(async () => {
      if (!G.f.delivered) {
        await say('기록관 베르타', '렌! 또 늦었구나. 비문 필사본은?');
        await say('렌', '여기요! 지하 석판 제7번이요. 밤새 옮겼어요.');
        await say('기록관 베르타', '어디 보자… \'COR\'를 \'기관\'으로 옮겼네. 학원 사전대로구나.');
        await say('렌', '여백에 메모를 좀 해뒀어요. 다른 비문에서는 \'심장\'으로 읽히기도 해서요.');
        await say('기록관 베르타', '꼼꼼해서 좋다. 네 사본은 저 책상에 올려 뒀으니 챙겨 가렴.');
        await say('기록관 베르타', '그리고 미라가 아까부터 너를 찾더라. 아, 『부유 마법 입문』이 또 도망쳤단다. 서쪽 상가 지붕 위로 날아가는 걸 봤어.');
        await say('기록관 베르타', '제목값을 하는 책이지. 잡아 오면 사례하마.');
        G.f.delivered = true; G.f.miraTask = true; G.f.bookTask = true;
        setObj('미라 돕기 · 지붕 위로 도망친 책 붙잡기');
        toast('서가와 담쟁이는 오를 수 있다. 오르는 동안 스태미나가 닳는다');
        return;
      }
      if (G.f.bookDone && !G.f.bookPaid) { G.f.bookPaid = true; await say('기록관 베르타', '돌아왔구나, 녀석. 고맙다, 렌. 약속한 사례다.'); addCoins(15); return; }
      if (G.f.council && !G.f.giftBerta) {
        G.f.giftBerta = true; G.f.map = true;
        await say('기록관 베르타', '원정이라니. 2년 차가 벌써 현장이라… 오스윈이 많이 믿는 모양이다.');
        await say('기록관 베르타', '이걸 가져가렴. 기록보관소에서 제일 정확한 대륙 지도다. 관측탑에 오르면 그 주변이 저절로 그려지지.');
        toast('대륙 지도를 받았다 · M으로 연다'); sfx('pick');
        return;
      }
      if (G.f.tremor && !G.f.ch1engine) { await say('기록관 베르타', '서가가 통째로 떨렸어. 오래 살았지만 이런 건 처음이구나.'); return; }
      if (G.f.ch1done) { await say('기록관 베르타', '네 필사본, 평의회에서 칭찬이 자자하더구나. 몸조심하렴.'); return; }
      await say('기록관 베르타', '오늘 오후엔 기관 점검이 있다더구나. 오스윈 교수가 바쁘겠지.');
    });
  },
  mira(e) {
    runScript(async () => {
      if (!G.f.delivered) { await say('미라', '렌! 기록관한테 먼저 다녀와. 아니면 베르타가 또 잔소리할걸.'); return; }
      if (!G.f.miraDone) {
        const n = ['orb1', 'orb2', 'orb3'].filter(id => G.map.ents.find(o => o.id === id && o.got)).length;
        if (n < 3) {
          if (!G.f.miraTalked) {
            G.f.miraTalked = true;
            await say('미라', '렌! 내 부유석 실험이 대성공했어. 너무 성공해서 세 개가 날아가 버렸지만.');
            await say('미라', '하나는 이 마당 구석에, 하나는 동쪽 상가 지붕 위에, 하나는 성문 쪽에 떠 있어. 잡아다 줄래?');
            await say('미라', '지붕은 담쟁이를 타고 오르면 돼. 급하면 달리고. Shift 말이야!');
          } else await say('미라', `부유석 ${n} / 3. 남은 건 ${['마당 구석', '동쪽 상가 지붕', '성문 쪽'].filter((_, i) => !G.map.ents.find(o => o.id === 'orb' + (i + 1) && o.got)).join(', ')}이야.`);
          return;
        }
        G.f.miraDone = true;
        await say('미라', '세 개 다! 고마워, 렌. 보답으로 이거. 아침에 딴 빛딸기야.');
        give('berry', 3);
        await say('미라', '근데 이상하지? 오늘 아침부터 지맥이 이상하게 뛰었어. 꼭 맥박처럼. 부유석이 그래서 날아간 것 같아.');
        checkTremor();
        return;
      }
      if (G.f.council && !G.f.giftMira) {
        G.f.giftMira = true;
        await say('미라', '원정대라니! 부럽다. 아니, 안 부러워. 북쪽은 엄청 춥대.');
        await say('미라', '내 특제 온기 사탕이야. 먹으면 한동안 몸이 데워져. 맛은… 묻지 마.');
        give('candy', 3);
        return;
      }
      if (G.f.tremor && !G.f.ch1engine) { await say('미라', '부유석이 다 바닥에 떨어졌어. 지맥이 숨을 참는 것 같아.'); return; }
      await say('미라', G.f.ch1done ? '편지 써! 오스윈 교수님한테만 쓰지 말고.' : '다음 실험은 떠다니는 의자야. 앉으면 하늘을 날 수 있지. 아마도.');
    });
  },
  orbGot(e) {
    const n = ['orb1', 'orb2', 'orb3'].filter(id => G.map.ents.find(o => o.id === id && o.got)).length;
    toast(`부유석 ${n} / 3`);
    if (n === 3) toast('미라에게 돌아가자');
  },
  bookCaught(e) {
    runScript(async () => {
      sfx('pick');
      await say('렌', '잡았다! 『부유 마법 입문』… 정말 제목값을 하네.');
      G.f.bookDone = true;
      toast('책을 붙잡았다 · 베르타에게 돌려주자');
      checkTremor();
    });
  },
  pip(e) {
    runScript(async () => {
      if (!G.f.tremor) { await say('핍', '렌 형! 고래 봤어? 내가 띄운 거야. 원래는 물방울 하나였는데…'); await say('핍', '…아무한테도 말하지 마.'); return; }
      if (!G.f.soup) {
        const dish = Object.keys(G.inv).find(k => k.startsWith('dish|') && G.inv[k] > 0);
        if (dish) {
          take(dish, 1);
          G.f.soup = true;
          await say('렌', '자, 핍. 따뜻할 때 먹어.');
          await say('핍', '…따뜻해. 고마워, 형.');
          await wait(0.4);
          await TALK.oswinOrder();
          return;
        }
        await say('핍', '(덜덜) 렌 형… 고래가 사라졌어. 너무 추워…');
        await say('렌', '기다려. 금방 따뜻한 걸 끓여 올게.');
        return;
      }
      if (G.f.council && !G.f.giftPip) {
        G.f.giftPip = true;
        await say('핍', '형, 이거. 내가 구운 빵이야. 반은 탔어.');
        give('bread', 2);
        return;
      }
      await say('핍', G.f.ch1engine ? '무지개 봤어? 고래보다 더 컸어!' : '형, 기관이 아픈 거야?');
    });
  },
  toma(e) {
    runScript(async () => {
      if (G.f.council && !G.f.giftToma) {
        G.f.giftToma = true;
        await say('요리장 토마', '원정 도시락이다. 매콤한 고추 스튜! 추울 때 먹어라. 한 그릇이면 한참 버틴다.');
        G.inv['dish|매콤한 고추 스튜|8|150|0'] = (G.inv['dish|매콤한 고추 스튜|8|150|0'] || 0) + 2;
        toast('매콤한 고추 스튜 +2'); sfx('pick');
        return;
      }
      if (G.f.tremor && !G.f.soup) { await say('요리장 토마', '찬장에서 재료를 꺼내서 화로에 넣어. 세 개까지 넣고 끓이면 뭐든 된다니까. 애들 좀 데워 줘!'); return; }
      await say('요리장 토마', '배고프면 찬장에서 꺼내 먹어. 화로는 아무나 써도 돼.');
    });
  },
  oswin(e) {
    runScript(async () => {
      if (G.f.council && !G.f.coat) { await TALK.nightBefore(); return; }
      if (G.f.coat && !G.f.slept) { await say('오스윈', '내일 아침이면 떠나는구나. 푹 자거라. 기숙사 네 침대에서.'); return; }
      if (G.f.ch1done) { await say('오스윈', '렌? 원정 중 아니었니? 편지로 다 듣고 있다. 몸조심하거라. 차는… 식었구나.'); return; }
      await say('오스윈', '렌! 차 한 잔 하겠니? 아, 심부름 중이구나. 다녀오렴. 차는 식어도 맛있단다.');
      await say('오스윈', '오후에 기관 점검이 있다. 저 아래 녀석이 요즘 좀 예민하거든.');
    });
  },
  student(e) {
    const l = G.f.tremor && !G.f.ch1engine ? '분수가 솟은 채로 얼었어! 무섭다기보다… 신기하다.' : G.f.council ? '원정대라며? 내 이름도 명단에 있었으면 좋겠다.' : '대강당 천장 봤어? 별자리가 매일 바뀌어.';
    runScript(async () => { await say('견습생 율', l); });
  },
  student2(e) {
    const l = G.f.tremor && !G.f.ch1engine ? '대강당 돔 안에 눈이 와! 지붕 안쪽에서!' : G.f.ch1engine && !G.f.coat ? '무지개 봤어? 분수가 다시 솟구쳤어!' : '마법 폭죽을 또 터뜨렸어. 이번엔 일부러는 아니었어.';
    runScript(async () => { await say('견습생 도린', l); });
  },
  student3(e) {
    const l = G.f.tremor && !G.f.ch1engine ? '등불이 한 번 깜빡였지? 꼭 숨을 들이쉬는 것 같았어.' : '오스윈 교수님 연구실엔 늘 차 냄새가 나. 기관한테 말 거시는 것도 봤어.';
    runScript(async () => { await say('학생 세라', l); });
  },
  aldric(e) {
    runScript(async () => {
      if (G.f.ch1engine && !G.f.council) { await TALK.council(); return; }
      if (G.f.council) { await say('의장 알드릭', '학원의 이름으로 부탁하네. 이번 겨울에 아무도 얼어 죽지 않도록.'); return; }
      if (G.f.tremor) { await say('의장 알드릭', '평의회를 소집하는 중이네. 오스윈을 찾나? 지하 일은 자네에게 맡겼다고 하더군.'); return; }
      await say('의장 알드릭', '연구원 렌 아르덴이군. 오스윈이 자네 얘기를 자주 하지. 번역이 깔끔하다고.');
    });
  },
  councilor(e) { runScript(async () => { await say('평의원 소냐', G.f.council ? '원정대 명단은 저기 책상 위에 있다. 다들 젊지. 현장이란 그런 곳이니까.' : '떨림 이후로 서류가 세 배가 됐어. 기관 정비 기록은 마기스터 이상만 볼 수 있다네.'); }); },
  tailor(e) {
    runScript(async () => {
      await say('재봉사 넬', '원정 가는 연구원이지? 북쪽은 털 외투 없이는 못 버텨. 둘러봐.');
      UI.openShop('tailor');
    });
  },
  gatekeeper(e) {
    runScript(async () => {
      if (G.f.grav === 'pump') { await say('성문지기', '외곽 마을들이 춥다고 아우성이야. 남쪽 중계선이 늦게 복구된다나.'); return; }
      await say('성문지기', '몸조심하게, 연구원. 성문 밖은 잔향이 돌아다니니까. 관측탑에 오르면 길이 보일 거야.');
    });
  },
  sleep() {
    runScript(async () => {
      const i = await choose('침대에 누울까?', ['잔다', '아직']);
      if (i) { P.z += 2.5; return; }
      G.fadeTo = 1; await wait(0.8);
      G.time = 7 * 60; G.f.slept = true; G.f.ch1ready = true;
      await caption('원정 첫날 아침.', 2);
      G.fadeTo = 0;
      if (!G.journal.includes('fieldlog')) addJournal('fieldlog');
      setObj('성문을 나가 관측탑에 오르기');
    });
  },
  async tremor() {
    G.f.tremorStarted = true;
    G.time = 15 * 60;
    await wait(0.6);
    // 등불이 맥박처럼 한 번
    G.lampOff = true; sfx('beat'); await wait(0.18); G.lampOff = false; await wait(0.22);
    G.lampOff = true; sfx('beat2'); await wait(0.14); G.lampOff = false;
    await wait(0.6);
    sfx('rumble'); G.shake = 1.4;
    await wait(1.4);
    G.f.tremor = true;
    FX.burst(P.x, P.y + 1, P.z, 30, 0xffffff, 4, 1, 0.2);
    await say('렌', '…방금 등불이 숨을 쉰 것 같았는데.');
    await say('렌', '발밑 깊은 곳에서 울렸어. 기관 쪽이다.');
    if (G.map.id === 'kalidor') { cineSpot('frozen'); await wait(1.2); }
    await caption('광장 분수가 솟은 모양 그대로 얼어붙었다.', 2.6);
    if (G.map.id === 'kalidor') { cineSpot('hallRoof'); await wait(1.0); }
    await caption('대강당 지붕 위로, 봄인데 눈이 내린다.', 2.4);
    cineOff();
    await say('견습생 도린', '눈이다! 대강당 안에 눈이 와!');
    await say('견습생 율', '분수 좀 봐. 저거 만져도 돼?');
    await say('렌', '다들 무서워하기보다 어리둥절한 얼굴이네. …핍은 어디 있지?');
    setObj('떨고 있는 핍에게 따뜻한 수프 끓여주기 · 부엌 찬장과 화로');
    toast('기온이 떨어졌다 · 오른쪽 위 온도계를 보자');
  },
  async oswinOrder() {
    const os = spawn('npc', P.x + 3, P.z + 1.5, { name: '오스윈', talk: 'oswin', look: OSWIN_LOOK, id: 'oswinTmp' });
    await say('오스윈', '렌! 다친 데는 없니? 핍도 괜찮고? …좋아, 다행이다.');
    await say('오스윈', '기관이 떨렸다. 학원 지하의 작은 기관 말이다. 이 도시를 데우는 녀석이지.');
    await say('오스윈', '나는 평의회에 먼저 다녀와야 한다. 그동안 지하 회랑에 내려가서 상태를 살펴 주겠니?');
    await say('오스윈', '봉인 실험실 네 곳에 룬이 있다. 네 공명봉에 반응할 거다. 중계탑 세 개를 다시 켜면 기관실 문이 열린다.');
    await say('오스윈', '기관실에는 혼자 들어가지 마라. 문이 열리면 나를 기다리렴.');
    await say('렌', '네! 연구실 계단으로 내려갈게요.');
    os.dead = true; FX.burst(os.x, os.y + 1, os.z, 20, 0xc8b8ff, 3, 0.6, 0.2);
    G.f.toUnder = true; G.f.oswinInLab = false;
    setObj('오스윈 연구실의 계단으로 지하 회랑에 내려가기');
  },
  async engineRoom() {
    G.f.engineScene = true;
    const os = spawn('npc', 56, 76, { name: '오스윈', talk: 'oswin', look: OSWIN_LOOK, id: 'oswinUG' });
    await say('오스윈', '렌! 중계탑을 전부 켰구나. 혼자서 해낸 거냐? …대단하다.');
    await say('오스윈', '여기서부터는 내가 들어가마. 기관실 안은 마력이 진해서 연구원은 오래 못 버틴다.');
    await say('오스윈', '기다리렴. 금방 나올 테니.');
    for (let i = 0; i < 40; i++) { os.z += 0.3; os.x = lerp(os.x, 56, 0.1); os.yaw = 0; os.vx = 0; os.vz = 1; os.wander = 1; await wait(0.03); }
    os.dead = true; sfx('open');
    G.fadeTo = 0.6; await wait(1.2);
    await caption('렌은 문 앞에서 기다린다.', 2.2);
    await say('문 너머의 오스윈', '조금만 더 버텨주게. 곧 보낼 테니.', { cls: 'far' });
    await caption('기계에게 하는 말투가 아니다.', 2.2);
    G.fadeTo = 0; await wait(0.6);
    const os2 = spawn('npc', 56, 88, { name: '오스윈', talk: 'oswin', look: OSWIN_LOOK, id: 'oswinUG2' });
    const i = await choose('', ['누구랑 이야기하셨어요?', '(아무것도 묻지 않는다)']);
    if (i === 0) await say('오스윈', '(웃으며) 기관하고. 늙으면 대답 없는 것들에게 말이 많아져.');
    else await say('오스윈', '기다려 줘서 고맙다. 이제 괜찮을 거다.');
    os2.dead = true;
    G.fadeWhite = true; G.fadeTo = 1; await wait(0.8);
    G.f.ch1engine = true; G.f.oswinInLab = false;
    enterMap('kalidor', 'court');
    G.rainbow = 1.6;
    cineSpot('rainbow');
    G.fadeTo = 0; await wait(1.0); G.fadeWhite = false;
    sfx('chime');
    await caption('온기가 돌아온다. 얼었던 분수가 다시 솟구치고, 광장에 무지개가 걸린다.', 3.6);
    cineOff();
    await say('핍', '렌 형! 무지개야! 고래보다 커!');
    setObj('대강당의 평의회로');
  },
  async council() {
    G.f.council = true;
    if (G.map.id === 'hall') cineShot(20, 6, 24, 19, 2, 8);
    await say('의장 알드릭', '떨림은 칼리도르만의 일이 아니었네. 대륙 곳곳의 기관이 꺼지거나 비틀렸다는 전갈이 왔어.');
    await say('의장 알드릭', '마르셀라, 엘름바텐, 그라벤호프. 비틀린 기관 셋을 고치지 못하면 이번 겨울을 넘기지 못하는 도시가 생긴다.');
    await say('의장 알드릭', '평의회는 정비 원정을 결정한다.');
    await say('오스윈', '렌도 보내주십시오. 고대어 비문을 이 아이만큼 읽는 연구원은 학원에 없습니다.');
    await say('의장 알드릭', '2년 차를? …좋네. 현장은 젊은 몸이 버티지.');
    await say('렌', '제가… 원정대예요?');
    await say('오스윈', '쓸모 있는 사람이 되고 싶다고 했잖니. 이번이 그 기회다.');
    cineOff();
    setObj('친구들에게 인사하고, 밤에 오스윈 연구실로');
    toast('친구들이 배웅 선물을 챙겨 두었다');
    G.f.oswinInLab = true;
  },
  async nightBefore() {
    G.time = 21 * 60;
    G.fadeTo = 1; await wait(0.5); G.fadeTo = 0;
    await caption('원정 전날 밤.', 1.8);
    await say('오스윈', '들어오렴. 차가 식기 전에.');
    await say('오스윈', '이건 내가 젊을 때 입던 관측대원 외투다. 높은 데서 뛰어내리면 바람을 탄다. 아직 쓸 만할 거다.');
    G.f.coat = true; sfx('pick'); toast('활공 외투를 받았다 · 높은 곳에서 F');
    await say('오스윈', '그리고 이걸.');
    await caption('오스윈이 렌의 목에 펜던트를 걸어준다.', 2.4);
    await say('오스윈', '네 맥박에 맞춰 조율해뒀다. 기관 가까이 가면 같이 울릴 거야. 길을 잃으면 그 소리를 따라가라.');
    G.f.stone = true; sfx('beat');
    await say('렌', '…따뜻해요.');
    await say('오스윈', '기관들한테 인사 전해다오.');
    setObj('기숙사 침대에서 자기');
  },
  async towerTop(e) {
    e.lit = true; markDone(e.id);
    revealFog(e.x, e.z, e.rad);
    sfx('chime');
    if (!G.f.map) G.f.map = true;
    if (e.id === 'tw0' && !G.f.ch1done) {
      await say('렌', '높다…! 대륙이 전부 보여.');
      const top = P.y + 3;
      for (const [pl, cap] of [[PLACES.cathedral, '서쪽 해안, 마르셀라.'], [PLACES.clock, '동쪽 숲, 엘름바텐.'], [PLACES.mine, '북쪽 산, 그라벤호프.']]) {
        const dx = pl[0] - P.x, dz = pl[1] - P.z, l = Math.hypot(dx, dz);
        cineShot(P.x - dx / l * 6, top + 2, P.z - dz / l * 6, P.x + dx / l * 60, top + 18, P.z + dz / l * 60);
        await wait(0.4); await caption(cap, 2.2);
      }
      cineOff(); await wait(0.6);
      await say('렌', '지평선 너머 기관들이 빛기둥처럼 솟아 있다. 몇 개는… 흐릿하게 깜빡이고 있어.');
      toast('지도가 밝혀졌다 · M');
      // 마지막 10초
      G.fadeTo = 1; await wait(0.5);
      G.f.hideHud = true; G.showPendant = true; G.fadeTo = 0.15;
      await caption('학원 창가. 오스윈의 손에 오래된 펜던트가 하나 있다.', 3.2);
      await caption('닳은 표면에 머리글자 \'I\'만 남아 있다.', 2.6);
      G.fadeTo = 1; await wait(0.4);
      G.showPendant = false; G.f.hideHud = false; G.fadeTo = 0;
      G.f.ch1done = true;
      setObj(remainingObj() + ' · 순서는 자유');
      toast('활공: 탑 위에서 F · 공명석이 가까운 기관 쪽으로 울린다');
      saveGame();
      return;
    }
    const t = TOWERS.find(t => t.id === e.id);
    await caption(t ? t.name + ' · 주변 지도가 밝혀졌다' : '지도가 밝혀졌다', 2);
    saveGame();
  },

  // ---------------- 공용 사건 ----------------
  region(r) {
    const k = 'reg' + r;
    if (G.f[k] || !G.f.ch1done) return;
    G.f[k] = true;
    const L = {
      2: ['바다가 저 멀리 물러나 있다. 땅이 전부 하얀 소금이야.', '한낮엔 반사광 때문에 앞이 안 보이겠어. 소금 폭풍도 조심해야지.'],
      3: ['낙엽이… 떨어지다 말고 공중에 멈춰 있다. 빗방울까지.', '숲 전체가 같은 오후에 붙들려 있는 것 같아.'],
      4: ['춥다…! 털 외투나 매콤한 음식이 필요하겠다.'],
      5: ['구름 위다. 숨이 하얗게 얼어붙어.', '끊어진 다리들… 활공으로 건너야겠어.'],
      6: ['서부 평원. 고원 아래인데도 따뜻한 바람이 분다.'],
    }[r];
    if (L) runScript(async () => { for (const l of L) await say('렌', l); });
  },
  tick(dt) {
    if (G.mode !== 'play') return;
    // 2번째 기관: 기관실 출구의 회색 가면
    if (G.f.maskBeat && G.map.id === G.f.maskBeat && !G.lock) {
      const ex = G.map.ents.find(e => e.type === 'warp' && e.to === 'world');
      if (ex && dist(ex.x, ex.z, P.x, P.z) < 14) { G.f.maskBeat = null; runScript(TALK.maskBeat); }
    }
    // 수동 배수 제한 시간
    if (G.f.manualStart && !G.f.manualDone && G.t > G.f.manualEnd) TALK.manualEnd();
    // 카시안 수다
    if (G.f.kassJoined && !G.f.maskDown && G.map.world && !G.lock) {
      G.bantT = (G.bantT || 25) - dt;
      if (G.bantT <= 0) { G.bantT = 38; TALK.banter(); }
    }
  },
  async maskBeat() {
    const ex = G.map.ents.find(e => e.type === 'warp' && e.to === 'world');
    const mk = spawn('npc', ex.x, ex.z - 5, { name: '회색 가면', look: { cloak: '#5a5a62', body: '#7a7a82', skin: '#cfc8c0', hair: '#3a3a40', mask: '#9a9aa2' }, id: 'maskTmp' });
    FX.burst(mk.x, mk.y + 1, mk.z, 40, 0xc0b0ff, 4, 0.8, 0.25); sfx('rune');
    await say('회색 가면', '…또 하나를 재웠구나.');
    await say('렌', '누구세요? 학원에서 말하던… 떨림의 원인?');
    await say('회색 가면', '학원이 나를 그렇게 부르더냐.');
    await say('회색 가면', '그 돌. 목에 건 것. 그게 누구 맥박에 맞춰 뛰는지 생각해 본 적 있느냐.');
    await say('렌', '제 맥박이요. 선생님이 맞춰 주셨어요.');
    await say('회색 가면', '…그렇다면 조금 느리게 뛰겠지. 아직은.');
    mk.dead = true; FX.burst(mk.x, mk.y + 1, mk.z, 60, 0xc0b0ff, 6, 1, 0.3); sfx('boom');
    await say('렌', '…사라졌다.');
  },
  enter: {
    async world() {
      if (!G.f.outside && G.f.ch1ready) {
        G.f.outside = true;
        await say('렌', '성문 밖이다…! 저 앞 관측탑에 올라가 보자.');
        setObj('칼리도르 관측탑에 오르기');
      }
      // 기관을 고치고 나온 뒤의 사건들
      while (G.f.q && G.f.q.length) {
        const k = G.f.q.shift();
        if (TALK.queue[k]) await TALK.queue[k]();
      }
      if (G.f.kassJoined && !G.f.maskDown && !G.map.ents.find(e => e.type === 'ally')) spawn('ally', P.x - 1.5, P.z, { id: 'kassAlly' });
    },
    async under() {
      if (!G.f.underTip) { G.f.underTip = true; await say('렌', '지하 회랑은 처음이다. 공기가 차가워.'); toast(UI.touch ? '공격 버튼으로 휘두른다' : '공격: Space · 상자를 열어 무기부터 챙기자'); setObj('봉인 실험실에서 룬 얻기 (0 / 4)'); }
    },
    async cathedral() {
      if (!G.f.catTip) { G.f.catTip = true; await say('렌', '성당 자체가 기관이다… 저 종루의 거대한 팔이 바닷물을 움직이는 구조야.'); await say('렌', '봉인 두 개를 풀어야 심부로 들어갈 수 있겠어.'); setObj('성당의 봉인 두 개 풀기 · 종루의 팔로 수위 조절'); }
    },
    async clock() {
      if (!G.f.clkTip) { G.f.clkTip = true; await say('렌', '톱니 고리들이 겹쳐 돈다. 고리마다 시간이 다른 빠르기로 흐르고 있어.'); setObj('고리의 바늘을 맞춰 시계탑 꼭대기로'); }
    },
    async mine() {
      if (!G.f.mineTip) { G.f.mineTip = true; await say('렌', '어둡고 춥다… 횃불부터 찾자.'); setObj('갱도를 지나 용광로 기관실로'); }
    },
    async prima() {
      if (G.f.kassJoined && !G.f.maskDown) {
        const al = spawn('ally', P.x + 1.5, P.z, { id: 'kassAlly2' });
        const mk = G.map.ents.find(e => e.type === 'boss_mask');
        await say('회색 가면', '돌아가라.');
        await say('카시안', '학원이 말하던 떨림의 원인이야! 렌, 조심해!');
        await say('회색 가면', '그 문 너머에는 네가 바라는 자리가 없다. 돌아가라, 연구원.');
        mk.awake = true; G.boss = mk;
        setObj('회색 가면을 물리치기');
      }
    },
  },
  queue: {
    async after_marcella() {
      await say('렌', '바다가… 돌아온다!');
      await caption('해안선이 천천히 돌아온다. 마르셀라는 축제를 연다.', 3);
      await say('대사제 오렐리아', '성녀께서 다시 잠드셨습니다. 이번에도 오래 주무시겠지요.');
      await say('렌', '…잠드셨다고요?');
      await say('대사제 오렐리아', '(미소 지으며) 감사합니다, 연구원님. 염전과 어시장도 다시 열 겁니다.');
      setObj(remainingObj());
    },
    async after_elm() {
      if (G.f.elm === 'full') {
        G.time = 17 * 60;
        await caption('숲에 석 달 치 비가 한 번에 쏟아지고, 낙엽이 일제히 떨어진다.', 3.4);
        G.rain = 6;
        await wait(1.2);
        G.f.heddaGone = true;
        await caption('그날 밤, 헤다는 잠든 채 숨을 거두었다.', 3);
      } else {
        await caption('기관이 조금 안정되었다. 숲은 여전히 같은 오후에 머물러 있다.', 3);
      }
      setObj(remainingObj());
    },
    async after_grav() {
      if (G.f.grav === 'pump') {
        await say('감독관 하르트만', '…마흔 명을 살렸군요.');
        await say('감독관 하르트만', '남쪽에서 이번 겨울에 몇 명이 죽을지는 세어보셨습니까.');
        await UI.paperShow('학원 평의회 공식 경고', '연구원 렌 아르덴.\n\n그라벤호프 기관의 마력을 규격 외 경로로 보내 남쪽 중계선 복구를 늦춘 일을 경고한다.\n칼리도르 외곽 마을에서 피해가 보고되었다.\n\n― 학원 평의회');
      } else if (G.f.grav === 'south') {
        await say('감독관 하르트만', '옳은 일을 했소. 아무도 고맙다고 하지 않겠지만.');
        await caption('그라벤호프 주민들이 렌에게서 등을 돌린다.', 2.6);
      } else {
        await say('감독관 하르트만', `수문을 직접 열었다고? 규격에 없는 일이오. …${G.f.rescued}명이라.`);
        await say('감독관 하르트만', '남쪽 중계선도 제때 돌아왔소. 할 말이 없군.');
      }
      setObj(remainingObj());
    },
    async letter1() { await letterPair(1); },
    async letter2() { await letterPair(2); },
    async letter3() { await letterPair(3); },
    async kassian() {
      const k = spawn('npc', P.x + 3, P.z + 1.5, { name: '카시안', look: KASSIAN_LOOK, id: 'kassMeet' });
      await say('카시안', '렌! 렌 아르덴! 대륙 한복판에서 다 보네.');
      await say('카시안', '내 원정대는 저 아래 갈림길에서 쉬는 중이야. 너도 기관 하나 고쳤다며? 역시.');
      await say('카시안', '나? 우리 집안 이름을 다시 세우려면 이 정도는 해야지. 벨 가문의 셋째 아들이 대륙을 데웠다. 멋지잖아?');
      await say('카시안', '아, 이거 봐. 나도 공명석 받았어. 교수님들이 원정대원한테 하나씩 주시더라. 근데 내 건 요즘 좀 느리게 뛰어.');
      await say('렌', '내 것도 그래. 내 맥보다 조금 느리게.');
      await say('카시안', '그치? 둘이 똑같으니 고장은 아니겠지. 자, 불꽃고추. 북쪽 가면 필요할 거야. 얼어 죽지 마!');
      give('pepper', 2);
      for (let i = 0; i < 40; i++) { k.x += 0.35; k.yaw = Math.PI / 2; k.vx = 1; k.wander = 1; await wait(0.03); }
      k.dead = true;
    },
    async summons() {
      G.f.summons = true;
      await UI.paperShow('학원 평의회 소집 명령', '모든 정비 원정대는 즉시 알테라 고원의 프리마로 모일 것.\n\n프리마는 대륙에서 가장 오래된 기관이다. 북서쪽, 구름 위로 솟은 고대 도시 폐허 한가운데 있다.\n\n― 학원 평의회');
      setObj('알테라 고원의 프리마로 · 고원 남동쪽 아래 야영지에서 출발');
    },
  },
  banter() {
    const lines = [];
    if (!G.f.b1) lines.push(['b1', G.f.engOrder && G.f.engOrder[0] === 'marcella' ? '마르셀라에선 축제를 열어줬다며? 나는 가는 데마다 감독관한테 혼만 났는데.' : '네가 처음 고친 기관 얘기, 학원까지 소문났더라.']);
    if (!G.f.b2) lines.push(['b2', G.f.elm === 'full' ? '엘름바텐 할머니 얘기 들었어. …네 잘못 아니야.' : '엘름바텐 숲에 잔향이 늘었다던데. 그 할머니, 아직 정원에 계셔?']);
    if (!G.f.b3) lines.push(['b3', G.f.grav === 'pump' ? '그라벤호프 광부들을 구했다며. 경고장 받았지? 나도 받아 봤어. 액자에 걸어놨지.' : G.f.grav === 'south' ? '그라벤호프에서 규격대로 했다고? …잘했어. 아마도.' : '수문을 직접 열었다고? 너 그런 데서 고집 세더라.']);
    if (!G.f.b4) lines.push(['b4', '공명석이 점점 빨리 뛰어. 내 것도. 프리마가 가까워서겠지?']);
    if (!G.f.b5) lines.push(['b5', '이번 일 끝나면 학원에 자리가 생길 거야. 너도, 나도.']);
    if (!lines.length) return;
    const [k, l] = lines[0];
    G.f[k] = true;
    toast('카시안: ' + l);
  },
  kassianCamp(e) {
    runScript(async () => {
      await say('카시안', '렌! 왔구나.');
      await say('카시안', '…내 대원들은 오는 길에 다 흩어졌어. 둘은 다쳐서 돌아갔고, 나머지는 눈보라에 길을 잃었지. 나 혼자 남았어.');
      await say('카시안', '같이 가자. 고원은 혼자 오르기엔 너무 추워.');
      await say('렌', '응. 같이 가자.');
      G.f.kassJoined = true;
      spawn('ally', e.x, e.z, { id: 'kassAlly' });
      toast('카시안이 함께 간다');
      setObj('카시안과 함께 고원에 올라 프리마로 · 끊어진 다리는 활공으로');
      if (!G.f.furcoat && G.warmT <= 0) await say('카시안', '털 외투 없어? 그럼 매콤한 거라도 먹고 올라가. 고원은 정말 추워.');
    });
  },
  primaGate() {
    G.f.primaGate = true;
    runScript(async () => {
      await say('카시안', '저게 프리마… 대륙에서 가장 오래된 기관.');
      await say('카시안', '다른 원정대는 아직인가 봐. 우리가 일등이야.');
    });
  },

  // ---------------- 2장 마르셀라 ----------------
  priest(e) {
    runScript(async () => {
      if (G.f.eng_marcella) { await say('대사제 오렐리아', '바다가 돌아오는 걸 보셨지요? 성녀께서는 늘 그렇게 우리를 지키십니다.'); return; }
      await say('대사제 오렐리아', '학원의 연구원이시군요. 먼 길 오셨습니다. 성녀 마렌께서 석 달째 뒤척이고 계십니다.');
      await say('대사제 오렐리아', '성당 안에 들어가셔도 좋습니다. 다만 한 가지만 부탁드리겠습니다.');
      await say('대사제 오렐리아', '성녀의 잠자리는 들여다보지 말아주세요.');
      await say('렌', '잠자리요?');
      await say('대사제 오렐리아', '성당 가장 깊은 곳 말입니다. 그곳은… 성녀께서 주무시는 곳이니까요.');
    });
  },
  fisher(e) { runScript(async () => { await say('어부 노엘', G.f.eng_marcella ? '바다가 돌아왔어! 내일은 고기 잡으러 나간다. 시장에도 들러!' : '배가 소금밭에 처박혀 있어. 바다가 백 걸음은 물러났지. 성녀께서 화나셨나.'); }); },
  saltshop(e) { runScript(async () => { if (!G.f.eng_marcella) { await say('염전 상인', '가게는 닫았어요. 염전이 몽땅 굳어 버려서요.'); return; } await say('염전 상인', '소금이 다시 나요! 요리에 넣으면 훨씬 든든해져요.'); UI.openShop('salt'); }); },
  fishshop(e) { runScript(async () => { if (!G.f.eng_marcella) { await say('생선 장수', '바다가 없는데 생선이 있겠어요?'); return; } await say('생선 장수', '오늘 아침에 잡은 거예요. 싱싱하죠!'); UI.openShop('fish'); }); },
  pilgrim(e) { runScript(async () => { if (G.f.eng_marcella) { await say('순례자 안나', '성녀께서 다시 잠드셨대요. 다행이에요. …정말로요.'); return; } await say('순례자 안나', '소금 언덕을 사흘 걸어 넘어왔어요. 성녀께 기도하러요.'); await say('순례자 안나', '우리 할머니도, 할머니의 할머니도 이 길을 걸었대요. 성녀께서 깨어 계시는 동안 고맙다고, 잠드실 때 편히 주무시라고.'); }); },
  pilgrim2(e) { runScript(async () => { await say('순례자', '한낮엔 소금밭이 눈부셔서 앞이 안 보여요. 소금 폭풍이 불면 숨이 차고요. 쉬어 가세요.'); }); },
  plaqueMarcella(e) {
    runScript(async () => {
      await UI.paperShow('놋쇠 정비판', '정비: 아델라 무어 · 승인: 시몬 아르크 (271년 전)\n정비: 레오 반스 · 승인: 에다 브론 (230년 전)\n정비: 미샤 톨 · 승인: 하인 로웰 (191년 전)\n정비: 유디트 셀 · 승인: 카렐 몬 (152년 전)\n정비: 오토 프리스 · 승인: 마그다 헤일 (112년 전)\n정비: 니나 베르크 · 승인: 알브레히트 손 (71년 전)\n정비: 이소벨 크레인 · 승인: 오스윈 헤일 (31년 전)');
      if (!G.f.plaqueSeen) {
        G.f.plaqueSeen = true;
        await say('렌', '오스윈 선생님 이름이다! 31년 전이면 선생님이 젊으셨을 때네.');
        await say('렌', '다른 이름들은… 학원 명부에서 본 적이 없는데. 너무 오래돼서 그런가.');
      }
    });
  },
  coreMarcella(e) {
    runScript(async () => {
      if (!G.f.bossSalt) { await say('렌', '기관 심부가 소금 결정에 뒤덮여 있다.'); return; }
      await say('렌', '비틀린 마력 회로가… 여기, 그리고 여기. 룬을 다시 이으면 된다.');
      const i = await choose('', ['기관을 고친다', '조금 더 둘러본다']);
      if (i) return;
      await flash();
      G.f.eng_marcella = true; G.f.marcellaT = G.playT;
      engineFixed('marcella');
      await say('렌', '맥박이… 고르게 돌아왔다. 기관이 잠잠해졌어.');
      setObj('성당 밖으로');
    });
  },

  // ---------------- 3장 엘름바텐 ----------------
  chief(e) {
    runScript(async () => {
      if (G.f.elm === 'full') { await say('촌장 브람', '어머니는 편히 가셨소. 비가 그치고 나서야 울 수 있었소.'); await say('촌장 브람', '…그래도 아이들이 자라겠지요. 고맙소, 연구원.'); return; }
      if (G.f.elm === 'stable') { await say('촌장 브람', '어머니는 오늘도 정원에 계시오. 숲에 잔향이 늘어서 걱정이지만… 그건 우리가 견딜 일이오.'); return; }
      await say('촌장 브람', '석 달째 같은 가을 오후요. 아무도 늙지 않고 배고프지도 않소. 좋은 일 같지요?');
      await say('촌장 브람', '아이들이 자라지 않는다는 것만 빼면.');
      await say('촌장 브람', '어머니를 만나보시오. 정원에 계시오. 떨림이 오던 날 임종을 앞두고 계셨는데, 지금은 저렇게 정원을 가꾸시지.');
      await say('촌장 브람', '시계탑으로 가는 길은 북쪽이오. 공중에 멈춘 빗줄기가 길을 막고 있을 거요.');
    });
  },
  hedda(e) {
    runScript(async () => {
      if (G.f.elm === 'stable') { await say('헤다', '오늘도 같은 오후네요. 차 한 잔 더 할래요?'); return; }
      if (G.f.tunerSeen) { await say('헤다', '차가 식는 걸 본 지 오래됐어요. 그것도 그립더군요.'); return; }
      await say('헤다', '어서 와요, 학원 분. 차 한 잔 해요.');
      await say('헤다', '석 달 동안 같은 차를 끓였는데 찻잎이 줄지를 않아요. (웃음) 덕분에 손님 대접은 실컷 하네요.');
    });
  },
  teo(e) { runScript(async () => { await say('마을 아이 테오', G.f.elm === 'full' ? '눈이다! 겨울이 왔어! …할머니는 하늘로 가셨대.' : G.f.elm === 'stable' ? '생일은 언제 와? 나 아직도 일곱 살이야.' : '나 석 달째 일곱 살이야. 생일이 안 와.'); }); },
  elmshop(e) { runScript(async () => { await say('숲 상인', '겨울이 와서 장사가 다시 돼요. 버섯이 제철이라오.'); UI.openShop('elm'); }); },
  hunter(e) {
    runScript(async () => {
      if (G.f.huntDone) { await say('사냥꾼 오드', '그 외투, 잘 어울리오.'); return; }
      const n = G.inv.meat || 0;
      if (n >= 3) {
        take('meat', 3); G.f.huntDone = true;
        await say('사냥꾼 오드', '세 덩이 다! 약속대로요. 내가 입던 털 외투요. 북쪽 가면 쓸모 있을 거요.');
        if (!G.f.furcoat) { G.f.furcoat = true; toast('털 외투를 얻었다'); sfx('pick'); } else addCoins(60);
        return;
      }
      await say('사냥꾼 오드', '사냥감이 돌아왔소. 석 달 만에! 사슴 고기 세 덩이를 가져다주면 사례하리다.');
      await say('사냥꾼 오드', `지금 가진 건 ${n}덩이요.`);
    });
  },
  coreElm(e) {
    runScript(async () => {
      if (!G.f.bossHunter) { await say('렌', '조율기 앞을 무언가 지키고 있다.'); return; }
      G.f.tunerSeen = true;
      await say('렌', '시간 조율기다. 끝까지 돌리면 기관이 완전히 고쳐진다.');
      await say('렌', '그런데… 붙잡혀 있던 석 달이 한꺼번에 흘러간다.');
      await say('렌', '헤다 할머니에게 그 석 달은 남아 있지 않다.');
      const i = await choose('조율기를 어떻게 할까?', ['끝까지 돌린다', '안정시키기만 한다', '(아직 정하지 않는다)']);
      if (i === 2) { await say('렌', '…조금만 더 생각하자.'); return; }
      await flash();
      G.f.eng_elm = true; G.f.elm = i === 0 ? 'full' : 'stable';
      engineFixed('elm');
      if (i === 0) await say('렌', '조율기가 끝까지 돌았다. 톱니 고리들이 한 박자로 맞물린다.');
      else await say('렌', '기관의 떨림만 잡았다. 시간은… 그대로 붙들려 있다.');
      setObj('시계탑 밖으로');
    });
  },

  // ---------------- 4장 그라벤호프 ----------------
  overseer(e) {
    runScript(async () => {
      if (G.f.eng_grav) {
        if (G.f.grav === 'pump') await say('감독관 하르트만', '남쪽 중계선은 언젠가 복구될 거요. 그때까지 버티는 사람들이 있겠지.');
        else if (G.f.grav === 'south') await say('감독관 하르트만', '규격은 사람을 살리려고 있는 거요. 숫자가 큰 쪽을.');
        else await say('감독관 하르트만', `${G.f.rescued}명. …나쁘지 않군. 규격집에 한 줄 추가해야겠소.`);
        return;
      }
      await say('감독관 하르트만', '학원 연구원? 마침 잘 왔소. 기관을 학원 규격대로 되돌려 주시오.');
      await say('감독관 하르트만', '그 기관이 지맥 중계선으로 남쪽 도시들에 열을 보내오. 그들이 이번 겨울을 넘기려면 그 열이 필요하오.');
      await say('렌', '아래 갱도에 광부 마흔 명이 갇혔다고 들었어요.');
      await say('감독관 하르트만', '알고 있소. 나도 그 마흔 명 이름을 다 아오. 그래도 남쪽엔 수천 명이 있소.');
    });
  },
  elsa(e) {
    runScript(async () => {
      if (!G.f.eng_grav) { await say('광부 가족 엘사', '남편이 아래에 있어요. 마흔 명이 다… 감독관은 기관이 먼저래요.'); await say('광부 가족 엘사', '갱 안쪽에 배수 수문이 있대요. 남편이 늘 말했어요. 기관에 불만 들어오면 손으로도 열 수 있다고.'); return; }
      if (G.f.grav === 'pump') { await say('광부 가족 엘사', '돌아왔어요! 다 돌아왔어요! 고마워요, 정말 고마워요.'); return; }
      if (G.f.grav === 'south') { await say('광부 가족 엘사', '…말 걸지 마세요.'); return; }
      if (G.f.rescued >= 24) await say('광부 가족 엘사', '남편이 돌아왔어요. 다 구하진 못했지만… 당신이 직접 수문을 열었다고 들었어요.');
      else await say('광부 가족 엘사', '몇 명은 돌아왔어요. 남편은… (고개를 젓는다) 그래도 고마워요.');
    });
  },
  family(e) { runScript(async () => { await say('광부 가족', '승강장 앞에서 사흘째 기다리고 있어요. 아래 물이 빠지기만 하면…'); }); },
  gravshop(e) {
    runScript(async () => {
      if (G.f.grav === 'south') { await say('대장장이 그레타', '문 닫았어. 학원 사람한테 팔 물건 없어.'); return; }
      await say('대장장이 그레타', G.f.eng_grav ? '불이 다시 들어왔어. 뭐든 골라.' : '추워 죽겠지? 털 외투 있어. 비싸게 안 받아.');
      UI.openShop('grav');
    });
  },
  miner(e) { runScript(async () => { await say('구조된 광부 요나스', '물이 빠지는 소리를 들었소. 살았다고 생각했지. 고맙소, 연구원.'); }); },
  coreGrav(e) {
    runScript(async () => {
      await say('렌', '산을 파고 들어간 거대한 용광로 기관이다.');
      await say('렌', '…안쪽 깊은 곳에서 노랫소리 같은 게 들린 것 같은데. 기분 탓이겠지.');
      if (!G.f.eng_grav) await say('렌', '관을 이어서 밸브까지 마력을 흘리고, 점화하면 다시 켜진다.');
    });
  },
  ignite(e) {
    runScript(async () => {
      if (G.f.eng_grav) { await say('렌', '기관은 이미 타오르고 있다.'); return; }
      updatePipes();
      const out = valveOutlet();
      if (!G.map.ents.find(o => o.id === 'valve').flow) { await say('렌', '마력이 밸브까지 흐르지 않는다. 관부터 이어야 해.'); return; }
      if (!out) { await say('렌', '밸브가 어느 쪽도 가리키지 않는다. 위는 남쪽 중계선, 아래는 배수 펌프다.'); return; }
      const i = await choose(`마력을 ${out === 'pump' ? '배수 펌프' : '남쪽 중계선'}으로 보낸다. 점화할까?`, ['점화한다', '잠깐']);
      if (i) return;
      for (const p of G.map.ents) if (p.type === 'pipe') p.locked = true;
      G.f.gravIgnited = true; G.f.eng_grav = true; G.f.grav = out;
      sfx('boom'); G.shake = 0.8;
      await flash();
      if (out === 'pump') { G.f.rescued = 40; await say('렌', '펌프가 돈다! 아래 갱도의 물이 빠진다…!'); }
      else { G.f.rescued = 0; G.f.manualUntil = G.t + 150; await say('렌', '남쪽 중계선이 다시 빛난다. 남쪽 도시들이 따뜻해질 거야.'); await say('렌', '아래 갱도는…'); }
      engineFixed('grav');
      setObj('갱 밖으로');
    });
  },
  manualStart() {
    G.f.manualStart = true; G.f.manualEnd = G.t + 70;
    runScript(async () => {
      await say('렌', '수문에 동력이 들어왔다! 지금이라면 손으로 열 수 있어.');
      toast('물이 다시 차오른다 · 서둘러야 한다');
    });
  },
  manualEnd() {
    if (G.f.manualDone) return;
    G.f.manualDone = true;
    if (G.f.rescued > 0) G.f.grav = 'manual';
    runScript(async () => { await say('렌', G.f.rescued >= 40 ? '수문 다섯 개를 다 열었다…!' : `수위가 다시 높아졌다. 열린 수문으로 ${G.f.rescued}명이 올라올 수 있을 거야.`); });
  },

  // ---------------- 보스 ----------------
  bossIntro(e) {
    const L = { boss_salt: '무릎 꿇고 기도하던 거대한 잔향이 고개를 든다.', boss_hunter: '활시위를 당긴 채 굳어 있던 사냥꾼이 움직인다. 너무 빨라서 칼이 닿지 않는다. 시간 고리를 당기자.', boss_mine: '곡괭이와 등불을 든 형체들이 한 덩어리로 엉켜 일어선다.' }[e.type];
    if (L) toast(L);
    if (e.type === 'boss_hunter' && !G.f.hunterTip) { G.f.hunterTip = true; toast('네 귀퉁이의 시간 고리 레버를 당기면 사냥꾼이 느려진다'); }
  },
  bossDown(e) {
    if (e.type === 'boss_salt') { G.f.bossSalt = true; runScript(async () => { await caption('수호자가 두 손을 모은 채 흩어졌다.', 2.4); setObj('기관 심부를 살피기'); }); }
    if (e.type === 'boss_hunter') { G.f.bossHunter = true; runScript(async () => { await caption('사냥꾼의 활시위가 마침내 풀렸다.', 2.4); setObj('시간 조율기를 살피기'); }); }
    if (e.type === 'boss_mine') { G.f.mineBoss = true; runScript(async () => { await caption('엉켜 있던 형체들이 하나씩 풀려 흩어졌다.', 2.4); setObj('용광로 기관실로 · 관을 이어 밸브까지'); updatePipes(); }); }
    if (e.type === 'boss_mask') runScript(TALK.maskFall);
  },
  async maskFall() {
    G.f.maskDown = true;
    await caption('가면에 금이 간다. 그 아래, 기관의 룬과 같은 문양이 피부에 새겨진 얼굴이 보인다.', 3.4);
    await say('회색 가면', '…들어가면, 네가 나올 수 있을지 그 안의 누가 나올 수 있을지 정해진다.');
    await say('렌', '그게 무슨…');
    await say('카시안', '내가 이 사람을 지킬게. 먼저 가, 렌. 금방 따라갈게.');
    for (const a of G.map.ents) if (a.type === 'ally') a.dead = true;
    setObj('프리마의 비문 읽기 (0 / 4)');
  },
  maskDown(e) { runScript(async () => { await say('회색 가면', '(거친 숨만 내쉰다)'); }); },
  kassianGuard(e) { runScript(async () => { await say('카시안', '걱정 마. 이 사람 아무 데도 못 가. 너는 안을 봐.'); }); },

  // ---------------- 5장 ----------------
  async chamber() {
    G.f.chamber = true;
    cineShot(40, 5.2, 24, 40, 2.4, 8);
    await caption('가장 깊은 방은 예배당처럼 생겼다. 가운데에 놋쇠와 룬으로 된 의자가 있다.', 3.4);
    await caption('의자에는 아주 늙은 사람이 기관과 하나로 엮여 앉아 있다. 프리마의 첫 마법사다.', 3.6);
    await say('첫 마법사', '…드디어 교대가 왔구나.');
    G.heartSync = 0;
    for (let i = 0; i < 40; i++) { G.heartSync = i / 40; await wait(0.08); }
    G.heartSync = 1;
    await caption('렌의 공명석이 처음으로 렌의 맥박과 같은 빠르기로 뛴다.', 3);
    G.f.slotOpen = true; sfx('open');
    await caption('의자 옆의 빈 홈이 열린다. 공명석이 꼭 맞을 모양이다.', 3);
    await caption('그리고 공명석에서 목소리가 들린다.', 2.2);
    await say('공명석 너머의 오스윈', '미안하다, 렌. 네가 아니면 서쪽 세 도시가 이번 겨울을 넘기지 못한다.', { cls: 'far' });
    await say('렌', '선생님…?');
    await caption('대답은 없다.', 1.8);
    cineOff();
    const i = await choose('', ['앉는다', '앉지 않는다']);
    if (i === 0) await TALK.sit();
    else {
      G.f.sat = false;
      await caption('렌은 공명석을 쥔 채 물러선다.', 2.6);
    }
    G.heartSync = undefined;
    await say('첫 마법사', '…그렇구나. 교대는 오지 않는구나.');
    await say('첫 마법사', '그렇다면 하나만 부탁하마. 놓아다오.');
    G.f.chainsOpen = true; G.f.chainsLeft = 6;
    setObj('의자에 엮인 룬 사슬을 하나씩 끊기');
    toast('사슬을 공격해서 끊는다');
  },
  sit() {
    return new Promise(res => {
      G.f.holdSit = 0;
      const mem = [
        '일곱 살. 오스윈의 손을 잡고 학원 문을 처음 지나던 날.',
        '물방울 고래가 광장 위를 헤엄치던 아침.',
        '핍에게 끓여준 수프의 김.',
        G.f.engOrder && G.f.engOrder.includes('marcella') ? '마르셀라의 축제 불빛.' : '소금밭의 하얀 반사광.',
        G.f.elm === 'full' ? '숲에 한꺼번에 쏟아지던 석 달 치 비.' : '헤다 할머니가 내온 식지 않는 차.',
        G.f.grav === 'pump' ? '승강장 앞에서 울던 엘사.' : G.f.grav === 'manual' ? '차오르는 물과 열리는 수문.' : '등을 돌린 그라벤호프 사람들.',
        '…맥박이 느려진다.',
      ];
      let shownN = 0;
      toast(UI.touch ? '상호작용 버튼을 누르고 있는다' : 'E를 누르고 있는다');
      UI.sitHold = dt => {
        if (Input.key('act') || Input.key('attack')) G.f.holdSit += dt / 12;
        G.fadeWhite = true; G.fade = G.fadeTo = clamp(G.f.holdSit * 1.05, 0, 0.97);
        const k = Math.floor(G.f.holdSit * mem.length * 1.05);
        if (k > shownN && shownN < mem.length) { UI.caption(mem[shownN], 1.6); shownN++; }
        if (G.f.holdSit >= 0.92) {
          UI.sitHold = null; G.f.holdSit = undefined;
          runScript(async () => {
            await say('카시안', '렌! 렌, 정신 차려!', { cls: 'far' });
            G.fadeTo = 0; await wait(0.8); G.fadeWhite = false;
            await caption('끝나기 직전, 카시안이 렌을 의자에서 끌어냈다.', 2.8);
            const k = spawn('npc', P.x + 1.4, P.z, { name: '카시안', look: KASSIAN_LOOK, id: 'kassIn' });
            await say('카시안', '…들었어. 전부. 공명석 소리도, 교수님 목소리도.');
            await say('카시안', '내 공명석도 같은 소리를 내. 이게 무슨 뜻인지… 나중에 이야기하자. 지금은 아니야.');
            G.f.sat = true;
            k.dead = true;
            res();
          });
        }
      };
    });
  },
  chair(e) { runScript(async () => { await say('첫 마법사', G.f.chainsOpen ? '놓아다오. 사슬을 끊어다오.' : '…'); }); },
  async release() {
    G.f.chainsOpen = false;
    await wait(0.6);
    await say('첫 마법사', '고맙다.');
    await say('첫 마법사', '…따뜻했다. 아주 오랫동안.');
    G.f.mageGone = true;
    FX.burst(40, 3, 9, 120, 0x7ff0ff, 6, 2, 0.3, { lift: 2 });
    await wait(1);
    G.f.primaStop = true;
    await caption('프리마가 멈춘다.', 2.6);
    G.fadeTo = 1; await wait(1);
    await showLoading('알테라 고원', '');
    const [rx, rz] = M_(38, 40.5);
    enterMap('world', rx, rz, true);
    hideLoading();
    G.f.stoneSilent = true;
    G.time = 18 * 60 + 30;
    const ry = G.map.ground(rx, rz);
    cineShot(rx + 4, ry + 10, rz - 6, PLACES.brig[0], ry - 10, PLACES.brig[1]);
    G.fadeTo = 0; await wait(1.2);
    await caption('렌이 고원 밖으로 나오자, 서쪽 하늘 아래 세 도시의 불빛이 보인다.', 3.2);
    for (const k of ['seilen', 'brig', 'orta']) { cineShot(rx + 4, ry + 10, rz - 6, PLACES[k][0], ry - 14, PLACES[k][1]); await wait(1.4); G.f['dark_' + k] = true; sfx('beat2'); await wait(0.9); }
    G.f.westDark = true;
    await caption('불빛이 차례로 꺼졌다. 서부의 온도가 영구히 떨어진다.', 3.2);
    cineOff();
    G.fadeTo = 1; await wait(0.5);
    await showLoading('리벤', '고원 아래 첫 마을');
    enterMap('world', PLACES.riven[0] - 4, PLACES.riven[1] - 12, true);
    retintWorld(G.map);
    hideLoading(); G.fadeTo = 0;
    setObj('고원 아래 첫 마을, 리벤으로');
    saveGame();
  },
  poster(e) {
    runScript(async () => {
      await UI.paperShow('수배', '기관 파괴자\n\n렌 아르덴\n학원 2년 차 연구원\n\n프리마를 멈춰 서부 세 도시의 불을 끈 자.\n본 자는 학원 평의회에 알릴 것.');
      if (G.f.posterRead) return;
      await caption('공명석은 이제 아무 소리도 내지 않는다. 오스윈의 목소리도 다시 들리지 않는다.', 3.4);
      G.f.posterRead = true;
      const h = G.map.ents.find(o => o.id === 'helper');
      const who = G.f.rescued >= 8 ? { name: '광부 요나스', look: { cloak: '#6a5a4a', hair: '#3a2a1a', hat: '#d8b030' } }
        : G.f.elm === 'stable' ? { name: '촌장 브람', look: { cloak: '#7a5a3a', hair: '#8a7a6a' } }
          : { name: '순례자 안나', look: { cloak: '#d8d0c0', hair: '#5a4a3a', hat: '#c8b898' } };
      if (h) { h.name = who.name; h.look = who.look; h.x = P.x + 2.5; h.z = P.z + 1.5; h.obj && GFX.dyn.remove(h.obj); h.obj = null; }
      await caption('그런데 그 전단을 떼어 구겨버리는 사람이 있다.', 2.6);
      e.dead = true; sfx('break');
      await say(who.name, '당신 덕에 우리 동네는 따뜻했어요.');
      await say(who.name, '이번엔 우리 차례예요.');
      give('bread', 1);
      await caption('따뜻한 빵과, 숨을 곳.', 2.2);
      await TALK.finale();
    });
  },
  helper(e) { runScript(async () => { await say(e.name, '이쪽이에요. 아무도 모르는 길이 있어요.'); }); },
  async finale() {
    await wait(0.6);
    await UI.paperShow('렌의 현장 일지, 마지막 줄', '공명석이 멈췄다. 처음으로 내 맥만 들린다.', 'hand');
    G.f.part1Done = true;
    saveGame();
    G.fadeTo = 1; await wait(1.2);
    showEnding();
  },
  riven(e) { runScript(async () => { await say('리벤 주민', '저 위가 알테라 고원이에요. 구름 위에 고대 도시가 있대요. 우리는 올라가 본 적이 없어요.'); }); },
  westTown(e) {
    runScript(async () => {
      if (G.f.westDark) { await say(e.town + ' 주민', '…불이 꺼졌어요. 고원에서 내려오던 바람이 차가워졌어요. 이번 겨울을 어떻게 나죠?'); return; }
      await say(e.town + ' 주민', '이 동네는 겨울에도 따뜻해요. 고원에서 따뜻한 바람이 내려오거든요. 할머니 때부터 쭉 그랬대요.');
    });
  },

  // ---------------- 성장 ----------------
  async crystalUpgrade() {
    sfx('chime');
    await say('렌', '공명 결정 네 개가 하나로 녹아든다…');
    const i = await choose('무엇을 단단하게 할까?', ['하트 하나 늘리기', '스태미나 늘리기', '마력 늘리기']);
    if (i === 0) { P.maxhp += 4; P.hp = P.maxhp; toast('하트가 늘었다'); }
    else if (i === 1) { P.maxst += 20; P.st = P.maxst; toast('스태미나가 늘었다'); }
    else { G.maxMana += 25; G.mana = G.maxMana; toast('마력이 늘었다'); }
  },
  onCook(r) { if (G.f.tremor && !G.f.soup) toast('핍에게 가져다주자'); },
};
function checkTremor() {
  if (G.f.delivered && G.f.miraDone && G.f.bookDone && !G.f.tremorStarted) {
    G.f.tremorStarted = true;
    setTimeoutG(() => runScript(TALK.tremor), 3);
  }
}
// 평의회는 대강당에 들어가면 바로
function showEnding() {
  const el = $('ending');
  const elm = G.f.elm === 'full' ? '완전 수리 · 헤다는 떠났다' : '미완 · 헤다는 정원에 있다';
  const grav = { pump: '펌프 · 광부 40명 구조 · 학원의 경고', south: '학원 규격 · 남쪽이 따뜻해졌다 · 그라벤호프가 등을 돌렸다', manual: `직접 배수 · 광부 ${G.f.rescued}명 구조 · 남쪽 중계선 복구` }[G.f.grav] || '';
  const mins = Math.round(G.playT / 60);
  $('endBody').innerHTML = `
    <div class="erow"><b>마르셀라</b><span>바다가 돌아왔다 · 성녀는 다시 잠들었다</span></div>
    <div class="erow"><b>엘름바텐</b><span>${elm}</span></div>
    <div class="erow"><b>그라벤호프</b><span>${grav}</span></div>
    <div class="erow"><b>프리마</b><span>멈췄다 · 서부 세 도시의 불이 꺼졌다</span></div>
    <div class="erow"><b>카시안</b><span>${G.f.sat ? '진실을 렌과 함께 들었다' : '진실을 아직 모른다 · 나중에 학원의 말로 듣게 된다'}</span></div>
    <div class="erow"><b>수집한 기록</b><span>${G.journal.length} / ${Object.keys(JOURNAL).length}</span></div>
    <div class="erow"><b>플레이 시간</b><span>${mins}분</span></div>`;
  el.hidden = false;
  $('btnEndCont').onclick = () => { el.hidden = true; G.fadeTo = 0; setObj('2부에서 계속 · 원하는 만큼 대륙을 둘러보자'); };
  $('btnEndTitle').onclick = () => { location.reload(); };
};

// 시네마틱 카메라
function cineShot(x, y, z, lx, ly, lz) { G.cineKeep = { x, y, z, lx, ly, lz }; }
function cineOff() { G.cineKeep = null; G.cine = null; CAM.init = false; }
