// 기기 화면 모음 (v24 「기기별 UI」): 게임을 한 번 불러와 기기마다 본보기 내용으로 띄우고 한 장씩 찍는다 → shots/ui-이름.png
//  node tools/ui-gallery.mjs [이름,이름…]   (이름 없으면 전부)
import { chromium } from 'playwright';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const only = process.argv[2] ? process.argv[2].split(',') : null;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto('file://' + join(root, 'index.html') + '?play=new&nowake=1&q=low&t=0.45', { timeout: 300000 });
await page.waitForFunction(() => window.SEREN && SEREN.ready && SEREN.ready(), null, { timeout: 400000, polling: 1000 });
await page.evaluate(() => { const g = SEREN.game; if (g.tips) g.tips.first = () => false; });

const G = {
  lift: `D.openLiftPanel(g, { title: '승강기', floors: [12,11,10,9,8,7,6,5,4,3,2,1].map((n) => ({ i: n, label: String(n), name: n > 8 ? '사무' : n > 2 ? '주거' : n === 2 ? '상가' : '로비', org: n > 8 ? '하늘결 회사' : '', here: n === 1 })), onPick: () => {} })`,
  flap: `D.openFlap(g, { title: '떠나는 편', sub: '교통 터미널 · 하늘배·빛길 환승', cols: ['시각','행선지','타는 곳','값','상태'], rows: [['10:42','물노래','1번','3울','타는 중'],['10:49','빛갈대 들판','2번','2울','곧 떠남'],['10:57','하늘고리','3번','5울','돈 모자람']].map((c, k) => ({ cells: c.slice(0, 4), status: c[4], off: k === 2, fare: c[3], on: () => {} })), foot: '가진 돈 4울' })`,
  console: `D.openConsole(g, { title: '빚음 기계', plate: '울림차 공정 · 빛 4 단위', tone: 'green', gauges: [{ label: '공정 진행', v: 64, max: 100, unit: '%' }, { label: '원료로 더 돌릴 수 있는 번', v: 3, max: 10, low: 1 }], lamps: [{ label: '도는 중', on: true }, { label: '쉼', on: false, col: '#ffd27a' }, { label: '멈춤', on: false, col: '#ff5a3a' }], screen: ['공정       울림차', '넣는 것     찻잎 2 (있음 14)', '나오는 것   울림차 3'], keys: [{ label: '원료 넣고 돌리기', col: 'green', on: () => {} }, { label: '정비', col: 'amber', off: true, why: '멈춘 기계만' }] })`,
  plaque: `D.openPlaque(g, { mat: 'brass', side: 'right', kicker: '전시 설명', title: '첫 소리굽쇠', era: '노래 이전의 시대', text: '아웬이 처음으로 같은 높이의 음을 둘 맞춘 굽쇠. 이 굽쇠의 울림이 첫 공명탑의 기준음이 되었다.', foot: '이 박물관에서 본 전시 3/8' })`,
  stone: `D.openPlaque(g, { mat: 'stone', side: 'left', kicker: '랜드마크', title: '별귀 탑', text: '별귀는 하늘과 먼 땅의 소리를 모은다. 귀를 기울이면 둘레 2.5 km 가 지도에 그려진다.', actions: [{ label: '하늘 듣기 ▸', on: () => {} }, { label: '승강판 오르기 ▸', on: () => {} }] })`,
  chalk: `D.openChalk(g, { title: '문제 1 / 3', corner: '노래 학교', lines: ['이 노래는 무슨 뜻일까요?', '점의 높이가 음의 높이예요.'], art: '', choices: [{ t: '함께' }, { t: '빛' }, { t: '멀리' }], extra: [{ t: '▶ 선생님, 한 번 더요' }] })`,
  shelf: `D.openShelf(g, { kind: 'mart', sign: '곡물·면', title: '빛열매 마트', items: [['빛보리 가루','2울',6,'#f0d890','bag'],['면 다발','3울',4,'#f4e8c8','box'],['구름젖','2울',0,'#f4f4ff','bottle'],['꽃꿀','4울',5,'#ffc86a','jar'],['바람과자','2울',8,'#e8b878','box'],['별젤리','3울',3,'#ff9fd0','round']].map(([name, price, n, col, shape]) => ({ name, price, n, cap: 8, col, shape })), onPick: () => true, foot: () => '바구니 2개 · 5울 — 계산대에서 값을 치러요' })`,
  stock: `D.openShelf(g, { kind: 'stock', sign: '물품 창고', title: '진열 담당은 비어 가는 진열대의 상자를 들어 채워요', readonly: true, items: [['빛보리',24],['찻잎',12],['꽃꿀',8],['구름젖',16],['빛열매',30]].map(([name, n]) => ({ name, n })) })`,
  menu: `D.openMenuBoard(g, { org: '바람결 찻집', line: '어서 오세요. 무엇으로 드릴까요?', cash: () => '가진 돈 12울', items: [['울림차','3울','찻잎'],['노래 한 상','6울','빵·열매·양념'],['열매즙','3울','열매'],['별젤리 그릇','3울','젤리']].map(([name, price, ins], i) => ({ name, price, ins, mins: '4초', off: i === 3, why: '재료가 떨어졌어요' })), onOrder: () => true })`,
  strip: `D.workStrip(g, { title: '계산대 · 물건 세기', desc: '빛 표시가 가운데 칸에 들어올 때 E', rounds: 5, kind: 'scan', onDone: () => {} })`,
  lab: `D.labBench(g, { round: 1, rounds: 3, mode: 'name', pool: [0, 2, 3], play: () => {}, answer: () => true })`,
  sorter: `D.sorter(g, { k: 2, n: 6, col: '#7ff3e6', glyph: '', cols: ['#ff9fd0','#7ff3e6','#ffd27a'], names: ['분홍 슈트','청록 슈트','금빛 슈트'], limit: 60000, pick: () => {} })`,
  reactor: `D.reactor(g, { kicker: '공명 발전소 · 조종대', title: '출력 맞추기', secs: 60, need: 7, onEnd: () => {} })`,
  score: `D.scoreStand(g, { phrase: [1, 3, 2, 4], pool: [0, 1, 2, 3, 4], replay: () => {}, done: () => {} })`,
  vending: `D.vending(g, { title: '나눔 기계 · 마실 것', items: [['열매즙','2울',3,'#ffb86a'],['울림차','2울',4,'#7fc88a'],['별젤리','3울',0,'#ff9fd0']].map(([name, price, n, col]) => ({ name, price, n, col })), buy: () => true })`,
  kitchen: `D.kitchen(g, { pantry: [{ name: '빵', n: 2, col: '#e8b878' }, { name: '빛열매', n: 3, col: '#ffb86a' }], recipes: [{ name: '노래 한 상', need: [{ name: '빵', n: 1, have: 2 }, { name: '빛열매', n: 1, have: 3 }], ok: true }, { name: '울림차', need: [{ name: '찻잎', n: 2, have: 0 }], ok: false }], cook: () => '노래 한 상' })`,
  chest: `D.chest(g, { title: '집에 맡겨 둔 것', bag: () => [{ id: 'fruit', name: '빛열매', n: 3, col: '#ffb86a' }, { id: 'flower', name: '울림꽃', n: 1, col: '#ff9fd0' }], box: () => [{ id: 'lantern', name: '손등불', n: 2, col: '#ffe2a0' }], put: () => {}, take: () => {} })`,
  workbench: `D.openWorkbench(g, { title: '공방 · 공명 용광로', note: '별씨를 녹여 장비에 새 노래를 새긴다', mats: [{ name: '별씨', n: 7 }, { name: '결정 조각', n: 2, col: '#9fd8ff' }], parts: [{ name: '날개', desc: '활공이 더 멀리', lv: 1, max: 3, icon: '⟁', cost: '별씨 5', on: () => {} }, { name: '썰매 공명', desc: '썰매 최고 속도 +12%', lv: 0, max: 3, icon: '⌒', cost: '별씨 3', off: true, why: '썰매를 고친 뒤에' }, { name: '울림 탐지기', desc: '나침반에 500 m 까지', lv: 0, max: 3, icon: '◎', cost: '별씨 3', on: () => {} }] })`,
  hearth: `D.openHearth(g, { title: '이슬터 쉼터', note: '화롯불 곁에서 쉬어 가요', now: 0.45, times: [['아침',0.27],['한낮',0.5],['저녁',0.74],['밤',0.92]].map(([label, frac]) => ({ label, frac })), rest: () => {}, stones: [{ name: '물노래 쉼터', sub: '바다 마을 · 4.2 km', on: () => {} }, { name: '하모네아 쉼터', sub: '수도 · 9.1 km', on: () => {} }] })`,
  beds: `D.openBeds(g, { title: '이슬터 온실', note: '별씨는 빛꽃으로 자라고 꽃은 별씨를 셋 맺는다', beds: [{ state: 'empty', label: '1번 밭', sub: '별씨 1개를 심는다', on: () => {} }, { state: 'grow', pct: 0.4, label: '2번 밭 · 40%', off: true, why: '14시간 뒤에 핀다' }, { state: 'ripe', label: '3번 밭 · 꽃이 활짝 피었다', sub: '거두기', on: () => {} }] })`,
  pin: `D.openPinBoard(g, { title: '오늘의 일거리', sub: '쪽지를 눌러 「맡기」', cards: [{ head: '문서 전하기', body: '하늘결 사무탑으로 · 640 m', pay: '4울', on: () => {} }, { head: '측량', body: '별귀 탑의 높이 재기 · 2.1 km', pay: '6울', on: () => {} }, { head: '안부 전하기', body: '아무 정원지기에게', pay: '2울', on: () => {} }] })`,
  route: `D.routeMap(g, { title: '울림 광장역', here: '울림 광장역', stops: ['고리 북역','별항구역','빛갈대역','물노래역','하늘닻역'].map((name) => ({ name, on: () => {} })) })`,
  starmap: `D.starMap(g, { title: '라르크 호 · 별지도', foot: '별을 누르면 모아의 쪽지', stars: [{ name: '세렌', sym: '◉', x: 0.42, y: 0.55, here: true, col: '#7ff3e6', note: '' }, { name: '우르', sym: '◌', x: 0.3, y: 0.42, big: true, ring: true, col: '#e8c890', note: '' }, { name: '잿빛 고리별', sym: '?', x: 0.78, y: 0.28, ring: true, mark: true, route: true, note: '' }, { name: '쌍둥이 얼음별', sym: '?', x: 0.86, y: 0.7, mark: true, route: true, note: '' }] })`,
  glyph: `g.ui.glyphCard('friend', true)`,
  echo: `g.ui.memory({ title: '첫 노래', text: '그날 탑들은 처음으로 서로의 음을 들었다.\\n아무도 지휘하지 않았는데, 모두 같은 높이에서 멈추었다.' })`,
  tip: `D.tipNote(g, { title: '가게에서 사기', intro: '진열대에서 물건을 집으면 바구니에 담겨요.', steps: ['진열대 앞에서 E', '물건의 값표를 눌러 집기', '계산대에서 결제판에 패 대기'], ok: '알겠어요 · 시작하기' })`,
  interview: `D.openInterview(g, { org: '하늘결 회사', who: '면접관', Q: [['「진열 담당」은 무슨 일을 하나요?', ['비어 가는 진열대를 창고 상자로 채운다', '공장의 기계를 정비한다', '아이들에게 노래를 가르친다'], 0]], onDone: () => ({ ok: true, say: '함께 일해요!' }) })`,
  paper: `D.openPaper(g, { surface: 'counter', org: '울림 민원 창구', who: '민원 담당', line: '번호표 받으셨죠? 필요한 서류를 골라 주세요.', pads: [{ label: '주민 등록 확인서', form: () => null }, { label: '일 허가 신청서', color: '#fff2dc', form: () => null }], form: { title: '일 허가 신청서', fields: [{ key: 'w', label: '하려는 일', type: 'show', value: '공장·발전소 일자리 지원' }, { key: 'f', label: '수수료', type: 'show', value: '1울' }], terms: ['허가증은 모든 구역의 공장·발전소 일자리 지원에 쓰인다'], sign: '신청 서명', submit: () => ({ ok: true }) } })`,
  books: `g.ui.bookShelf('서가 · 3층', '하늘과 별', '12가지 · 40권이 꽂혀 있어요', Array.from({ length: 14 }, (_, i) => ({ id: 'b' + i, title: ['우르의 고리','별비의 밤','세렌의 하늘길','고리 너머','낮의 별'][i % 5] + (i > 4 ? ' ' + i : ''), author: '하늘지기 레아', color: [0x5a7a9a, 0x8a4a3a, 0x3a6a4a, 0x7a5a9a][i % 4], n: 1 + (i % 3), pages: 6 + i, read: i % 4, done: i === 2 })), () => {}, '', { actions: [{ label: '서고지기에게 말 배우기', sub: '2울' }] })`,
  reader: `g.ui.reader({ title: '별비의 밤', author: '하늘지기 레아', color: 0x5a7a9a, pages: ['별비가 내리는 밤에는 아무도 잠들지 않는다.\\n탑들이 하늘을 향해 노래를 열고, 떨어지는 빛 알갱이는 들판마다 작은 씨앗이 된다.', '둘째 쪽'] }, { kicker: '하늘 · 3층 서가', actions: [{ label: '들고 가기', primary: true, onClick: () => {} }] })`,
  meet: `(() => { const p = g.player.pos.clone(); p.x += Math.sin(g.player.yaw) * 2.5; p.z += Math.cos(g.player.yaw) * 2.5; return D.openMeet(g, { anchor: p, name: '루미', role: '정원지기 · 꽃을 돌본다', hearts: 2, opts: [{ label: '이야기 나누기', sub: '아웬의 말로' }, { label: '꽃 가꾸기 돕기', sub: '싹 셋에 물 주기' }, { label: '울림꽃 선물하기', sub: '가진 것 1' }, { label: '인사하고 헤어지기' }] }); })()`,
};
const names = Object.keys(G).filter((k) => !only || only.includes(k));
for (const k of names) {
  const r = await page.evaluate((code) => { try { const g = SEREN.game, D = SEREN.devices; g.ui.closeCard(); eval(code); const L = g.ui._cardWrap; return { ok: !!L, cls: L ? L.className : '', acts: L && L.acts ? L.acts.length : 0 }; } catch (e) { return { ok: false, err: e.message }; } }, G[k]);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: join(root, 'shots', `ui-${k}.png`), timeout: 240000 });
  console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${k} ${r.cls || r.err || ''} · acts ${r.acts ?? '-'}`);
}
console.log(errs.length ? `페이지 오류 ${errs.length}: ${errs.slice(0, 3).join(' | ')}` : '페이지 오류 없음');
await browser.close();
