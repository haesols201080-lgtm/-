// 방마다 가구·장비 놓는 법 (v0.9) — 실제 시설의 배치 규칙을 따른다.
//  마트: 입구 옆 계산대 줄·바구니, 입구 쪽 신선 진열섬, 가운데 진열대 줄(통로 2 m), 뒷벽 서늘 진열대, 옆벽 벽 진열대 · 창고: 선반 줄과 짐판
//  사무: 마주 보는 책상 묶음 줄, 벽엔 수납장·찍개 · 회의실: 탁자 + 칠판 · 교실: 칠판을 향한 학생 책상 줄 + 선생님 책상
//  공장: 원료 통 → 성형기 → 조립 팔 → 빛가마 → 포장기 (긴 축을 따라 한 줄) + 검사대·조종대 · 물류: 높은 선반 줄(뜬짐차 통로 2.6 m) + 분류 띠
//  병원: 접수·대기 의자 줄, 진료실(책상+침상), 검사실(스캐너), 입원실(침상 둘~넷) · 그 밖의 방도 모두 쓰임에 맞게.
import { Furnisher } from './furnish.js';
import { FIX } from './catalog.js';

/** 마트의 물건 구역 (진열대마다 붙는 이름 — ops 가 물건을 채운다) */
export const MART_CATS = ['fresh', 'bakery', 'pantry', 'drink', 'home', 'gift', 'craft', 'snack'];

const sideOf = (F, R) => { const b = F.box(R); return b; };

export function furnishFloor(B, L) {
  const Fu = new Furnisher(B, L);
  const R = L.rooms;
  const rnd = Fu.rnd;
  const style = B.zones[B.floors[L.i].zone] ? B.zones[B.floors[L.i].zone].style : {};
  const plants = (rm, n) => { const k = Math.max(0, Math.round(n * (style.plants ?? 0.6))); Fu.alongWalls(rm, 'plant', { n: k, keep: false }); };
  const order = R.filter((r) => r.n > 0).sort((a, b) => (PRIORITY[a.type] ?? 5) - (PRIORITY[b.type] ?? 5));
  for (const rm of order) {
    const f = RECIPE[rm.type];
    if (f) f(Fu, rm, { B, L, rnd, plants, style });
  }
  return { list: Fu.list, stats: Fu.stats, occ: Fu.occ };
}

const PRIORITY = { lobby: 0, sales: 0, production: 0, warehouse: 0, concourse: 0, corehall: 0, growhall: 0, dining: 1, auditorium: 1, stacks: 1, gallery: 1, counters: 1 };

// ── 방 종류 → 놓는 법 ─────────────────────────────────────
const RECIPE = {
  // 공용
  lobby(F, R, c) {
    const e = F.entry();
    const b = F.box(R);
    // 안내대: 심(승강기 홀) 앞, 정문을 보고
    const L = c.L;
    const hall = L.lifthall != null ? L.rooms[L.lifthall] : null;
    const tx = hall ? c.B.G.ox + hall.cx + 0.5 : b.cx, tz = hall ? c.B.G.oz + hall.cz + 0.5 + 4 : b.cz;
    F.near(R, 'reception', tx, tz, 0, { R: 8, tag: 'reception' });
    if (e) { F.near(R, 'infokiosk', e[0] + 3, e[1] - 4, 0, { R: 4, tag: 'directory', anyRot: true }); F.near(R, 'terminal', e[0] - 3, e[1] - 4, 0, { R: 5, tag: 'terminal', anyRot: true }); }
    // 쉼터 묶음: 구름 의자 + 낮은 탁자
    for (let k = 0; k < Math.min(4, Math.floor(R.n / 120) + 1); k++) {
      const x = b.x0 + 3 + c.rnd() * (b.w - 6), z = b.z0 + 3 + c.rnd() * (b.d - 6);
      const t = F.near(R, 'lowtable', x, z, 0, { R: 3 });
      if (t) { F.near(R, 'armchair', t.x - 1.4, t.z, 1, { R: 1 }); F.near(R, 'armchair', t.x + 1.4, t.z, 3, { R: 1 }); }
    }
    if (R.n > 300) F.near(R, 'art', b.cx, b.cz + 2, 0, { R: 6 });
    F.alongWalls(R, 'water', { n: 1 });
    c.plants(R, 6);
    F.alongWalls(R, 'bench', { n: 2 });
  },
  vestibule(F, R, c) { F.alongWalls(R, 'infokiosk', { n: 1, tag: 'directory' }); c.plants(R, 2); },
  corridor(F, R, c) {
    if (R.gallery) return; // 중2층 통로는 비운다
    // 넓은 복도에만 화분·의자 (통로 1.2 m 는 남긴다)
    const spots = F.wallSpots(R).filter((s) => wideAt(F, R, s));
    let n = 0;
    for (const s of spots) { if (n >= Math.ceil(R.n / 40)) break; const t = c.rnd() < 0.6 ? 'plant' : 'bench'; const x = s.x - FR4[s.rot][0] * (0.5 - FIX[t].d / 2), z = s.z - FR4[s.rot][1] * (0.5 - FIX[t].d / 2); if (F.try(R, t, x, z, s.rot)) n++; }
  },
  lifthall(F, R, c) { F.alongWalls(R, 'infokiosk', { n: 1, tag: 'directory' }); if (R.n > 30) c.plants(R, 1); },
  mailroom(F, R) { F.alongWalls(R, 'mailbox', { n: 3, tag: 'mail' }); F.alongWalls(R, 'lockers', { n: 2, tag: 'parcel' }); },
  security(F, R) { F.rows(R, 'desk', { n: 2, tag: 'guard' }); F.alongWalls(R, 'terminal', { n: 1, tag: 'terminal' }); F.alongWalls(R, 'cabinet', { n: 1 }); },
  wc(F, R) { F.alongWalls(R, 'wcstall', { n: Math.max(1, Math.floor(R.n / 6)) }); F.alongWalls(R, 'sink', { n: 1 + (R.n > 20 ? 1 : 0) }); },
  storage(F, R) { F.alongWalls(R, 'stockrack', { n: Math.max(1, Math.floor(R.n / 8)), tag: 'store', avoidWindows: true }); F.alongWalls(R, 'cabinet', { n: 2 }); },
  kiosk(F, R, c) { F.alongWalls(R, 'wallshelf', { n: 2, tag: 'shelf', data: { cat: c.rnd() < 0.5 ? 'snack' : 'gift' } }); F.near(R, 'checkout', F.box(R).cx, F.box(R).cz, F.doorDir(R), { R: 3, tag: 'checkout', anyRot: true }); },
  lounge(F, R, c) {
    const b = F.box(R);
    F.alongWalls(R, 'sofa', { n: Math.max(1, Math.floor(R.n / 25)) });
    F.near(R, 'lowtable', b.cx, b.cz, 0, { R: 3 });
    F.alongWalls(R, 'vending', { n: 1, tag: 'vending', avoidWindows: true });
    F.alongWalls(R, 'water', { n: 1 });
    c.plants(R, 3);
  },
  // 사무
  open(F, R, c) {
    F.alongWalls(R, 'cabinet', { n: Math.floor(R.n / 40), avoidWindows: true });
    F.alongWalls(R, 'printer', { n: 1, tag: 'printer', avoidWindows: true });
    F.rows(R, 'desk', { face: 'pair', aisle: 0.1, gap: 0.1, margin: 1.4, tag: 'desk' });
    // 두 줄마다 통로를 넓게: 마주 보는 책상 묶음 사이 1.6 m (rows 의 aisle 이 줄 사이를 정한다)
    F.alongWalls(R, 'water', { n: 1 });
    c.plants(R, 3);
  },
  meeting(F, R) {
    const b = F.box(R);
    F.near(R, 'meettable', b.cx, b.cz, b.w >= b.d ? 0 : 1, { R: 2, tag: 'meeting' });
    F.alongWalls(R, 'board', { n: 1, tag: 'board', avoidWindows: true });
  },
  manager(F, R, c) { const b = F.box(R); F.near(R, 'desk', b.cx, b.cz, F.doorDir(R), { R: 3, tag: 'desk', anyRot: true }); F.alongWalls(R, 'cabinet', { n: 1, avoidWindows: true }); F.alongWalls(R, 'sofa', { n: 1 }); c.plants(R, 1); },
  pantry(F, R) { F.alongWalls(R, 'kcounter', { n: 1, tag: 'cook', avoidWindows: true }); F.alongWalls(R, 'vending', { n: 1, tag: 'vending' }); F.alongWalls(R, 'water', { n: 1 }); const b = F.box(R); F.near(R, 'table4', b.cx, b.cz, 0, { R: 2, tag: 'table' }); },
  server(F, R) { F.rows(R, 'rack', { aisle: 1.0, margin: 0.8, tag: 'rack' }); F.alongWalls(R, 'terminal', { n: 1, tag: 'terminal' }); },
  hr(F, R) { const b = F.box(R); F.near(R, 'meettable', b.cx, b.cz, 0, { R: 2, tag: 'interview' }); F.alongWalls(R, 'terminal', { n: 1, tag: 'terminal' }); },
  records(F, R) { F.rows(R, 'cabinet', { aisle: 1.2, margin: 0.8, rot: 0, tag: 'records' }); },
  office1(F, R, c) { F.rows(R, 'desk', { n: Math.max(1, Math.floor(R.n / 10)), aisle: 1.2, tag: 'desk' }); F.alongWalls(R, 'cabinet', { n: 1, avoidWindows: true }); F.alongWalls(R, 'terminal', { n: 1, tag: 'terminal' }); c.plants(R, 1); },
  // 연구
  labroom(F, R) {
    F.alongWalls(R, 'hood', { n: 1, tag: 'bench', avoidWindows: true });
    F.alongWalls(R, 'freezer', { n: 1, tag: 'samples', avoidWindows: true });
    F.rows(R, 'labbench', { aisle: 1.4, margin: 1.3, tag: 'bench' });
    F.alongWalls(R, 'analysis', { n: 1, tag: 'analysis' });
  },
  instrument(F, R) { const b = F.box(R); F.near(R, 'spectro', b.cx, b.cz, 0, { R: 3, tag: 'instrument', anyRot: true, data: { inst: 'spectro' } }); F.near(R, 'grower', b.cx + 2, b.cz, 0, { R: 4, tag: 'instrument', anyRot: true, data: { inst: 'grower' } }); F.alongWalls(R, 'analysis', { n: 1, tag: 'analysis' }); },
  coldroom(F, R) { F.alongWalls(R, 'freezer', { n: Math.max(1, Math.floor(R.n / 5)), tag: 'samples' }); },
  cleanroom(F, R) { const b = F.box(R); F.near(R, 'scanner', b.cx, b.cz, 0, { R: 3, tag: 'instrument', anyRot: true, data: { inst: 'scanner' } }); F.alongWalls(R, 'labbench', { n: 1, tag: 'bench' }); },
  analysis(F, R) { F.rows(R, 'analysis', { aisle: 1.2, margin: 1.0, tag: 'analysis' }); F.alongWalls(R, 'board', { n: 1 }); },
  // 마트·가게
  sales(F, R, c) {
    const b = F.box(R);
    const e = F.entry();
    const front = e ? e[1] : b.z1; // 정문 쪽 z
    const op = c.B.floors[c.L.i].use;
    // 1. 계산대 줄: 정문 옆 (정문을 등지고 매장 안을 보는 게 아니라 나가는 손님을 보도록 옆으로)
    const nCheck = Math.max(1, Math.min(6, Math.round(R.n / 160)));
    const ex = e ? e[0] : b.cx;
    const side = ex > b.cx ? -1 : 1;
    let placed = 0;
    for (let k = 0; k < 12 && placed < nCheck; k++) {
      const x = ex + side * (4 + k * 3.2), z = front - 4.5;
      if (F.try(R, 'checkout', Math.round(x * 2) / 2, z, 1, { tag: 'checkout' }) || F.try(R, 'checkout', Math.round(x * 2) / 2, z - 0.5, 1, { tag: 'checkout' })) placed++;
    }
    if (!placed) F.near(R, 'checkout', ex + side * 4, front - 5, 1, { R: 6, tag: 'checkout', anyRot: true });
    if (R.n > 250) for (let k = 0; k < 2; k++) F.near(R, 'selfcheck', ex - side * (4 + k * 1.6), front - 4, 0, { R: 3, tag: 'checkout' });
    F.near(R, 'baskets', ex - side * 2.2, front - 2.5, 0, { R: 3, tag: 'basket', anyRot: true });
    // 2. 벽: 뒷벽은 서늘 진열대, 옆벽은 벽 진열대
    const dep0 = c.B.floors[c.L.i].dep;
    // 뒷벽 서늘 진열대: 식품 매장이면 반찬·구름젖·얼음·마실 것을 차례로, 생활·도구·옷 매장이면 벽 진열대처럼
    const coldCats = dep0 && dep0 !== 'food' ? null : (c.rnd() < 0.5 ? ['chill', 'dairy', 'frozen', 'drink'] : ['dairy', 'drink', 'chill', 'frozen']);
    const n0 = F.list.length;
    F.alongWalls(R, 'chiller', { tag: 'shelf', data: { cat: coldCats ? coldCats[0] : 'home' }, prefer: (p, q) => p.z - q.z, n: Math.max(1, Math.round(b.w / 5)), avoidWindows: false, onlyBack: true });
    if (coldCats) F.list.slice(n0).filter((q) => q.room === R.id && q.t === 'chiller').forEach((q, k) => { q.cat = coldCats[k % coldCats.length]; });
    // 옆벽 진열대: 매장마다 다른 살림 구역을 차례로
    const WALL = { food: ['spice', 'home', 'kitchen', 'med'], living: ['home', 'kitchen', 'beauty', 'garden', 'med'], craft: ['craft', 'device', 'paper'], fashion: ['fashion', 'beauty', 'gift'] };
    const wallCats = WALL[dep0] || (op === 'dept' ? ['fashion', 'beauty', 'kitchen', 'device'] : ['home', 'kitchen', 'beauty', 'paper', 'garden', 'med']);
    const n1 = F.list.length;
    F.alongWalls(R, 'wallshelf', { tag: 'shelf', data: { cat: wallCats[0] }, n: Math.max(2, Math.round(R.n / 60)), notFront: true });
    F.list.slice(n1).filter((q) => q.room === R.id && q.t === 'wallshelf').forEach((q, k) => { q.cat = wallCats[k % wallCats.length]; });
    // 3. 입구 쪽 신선 진열섬
    if (!dep0 || dep0 === 'food') for (let k = 0; k < Math.min(3, Math.round(R.n / 150)); k++) F.near(R, 'produce', ex - side * (2 + k * 3), front - 8.5, 0, { R: 3, tag: 'shelf', data: { cat: 'fresh' } });
    // 4. 가운데 진열대 줄 (통로 2 m) — 구역마다 다른 물건
    const g = F.rows(R, 'gondola', { aisle: 2.0, gap: 0.0, margin: 1.6, axis: 'z', rot: 0, tag: 'shelf' });
    // 층마다 매장(대형점의 층별 매장: 식품관·생활·도구·옷과 선물)
    const dep = c.B.floors[c.L.i].dep;
    // 진열 구역 20가지 (data/goods CATS): 동네 마트는 먹을 것 위주 + 살림 조금, 큰 마트는 줄이 많아 거의 모든 구역, 대형점은 층마다 매장
    const DEP = { food: ['pantry', 'bakery', 'snack', 'drink', 'spice', 'chill', 'dairy', 'frozen'], living: ['home', 'kitchen', 'garden', 'beauty', 'paper', 'med', 'home'], craft: ['craft', 'device', 'toys', 'paper', 'kitchen'], fashion: ['fashion', 'beauty', 'gift', 'toys', 'fashion'] };
    const big = g.length >= 8;
    const order = DEP[dep] || (op === 'dept' ? ['fashion', 'home', 'gift', 'device', 'beauty', 'kitchen', 'toys', 'paper']
      : big ? ['pantry', 'bakery', 'snack', 'drink', 'spice', 'home', 'kitchen', 'paper', 'toys', 'med', 'beauty', 'garden', 'device', 'craft', 'fashion', 'gift']
        : ['pantry', 'bakery', 'snack', 'drink', 'spice', 'home', 'med']);
    for (const q of g) q.cat = order[(q.row || 0) % order.length];
    if (op === 'shops') for (const q of g) q.cat = ['gift', 'fashion', 'beauty', 'toys', 'craft', 'paper'][(q.row || 0) % 6];
  },
  stockroom(F, R) {
    F.alongWalls(R, 'stockrack', { tag: 'stock', avoidWindows: false });
    F.rows(R, 'pallet', { aisle: 1.6, margin: 1.4, tag: 'pallet', n: Math.max(1, Math.floor(R.n / 25)) });
    F.alongWalls(R, 'handcart', { n: 1, tag: 'cart' });
  },
  staffroom(F, R) {
    F.alongWalls(R, 'lockers', { n: 1, tag: 'locker' });
    F.alongWalls(R, 'timeclock', { n: 1, tag: 'clock' });
    const b = F.box(R);
    F.near(R, 'table4', b.cx, b.cz, 0, { R: 2, tag: 'table' });
    F.alongWalls(R, 'water', { n: 1 });
  },
  // 먹고 마시기
  dining(F, R, c) {
    const b = F.box(R);
    // 주문대: 주방(뒤쪽 일하는 방)과 맞닿은 쪽 벽 앞
    const kit = c.L.rooms.find((q) => q.type === 'kitchen' && q.n);
    const kx = kit ? c.B.G.ox + kit.cx + 0.5 : b.cx, kz = kit ? c.B.G.oz + kit.cz + 0.5 : b.z0;
    F.near(R, 'counter', kx, kz + 3.5, 0, { R: 6, tag: 'order', anyRot: true });
    if (c.B.floors[c.L.i].use === 'cafe' || c.rnd() < 0.5) F.near(R, 'display', kx + 3, kz + 3.5, 0, { R: 5, tag: 'shelf', data: { cat: 'bakery' } });
    F.rows(R, c.rnd() < 0.5 ? 'table4' : 'table2', { aisle: 1.6, gap: 1.6, margin: 1.6, tag: 'table' });
    c.plants(R, 4);
  },
  kitchen(F, R) {
    F.alongWalls(R, 'stove', { n: Math.max(1, Math.floor(R.n / 14)), tag: 'cook' });
    F.alongWalls(R, 'prep', { n: Math.max(1, Math.floor(R.n / 18)), tag: 'prep' });
    F.alongWalls(R, 'coldbox', { n: 1, tag: 'ingredients' });
    F.alongWalls(R, 'dishwash', { n: 1, tag: 'dishes' });
    F.alongWalls(R, 'teamachine', { n: 1, tag: 'cook' });
  },
  pantry2(F, R) { F.alongWalls(R, 'coldbox', { n: Math.max(1, Math.floor(R.n / 6)), tag: 'ingredients' }); F.alongWalls(R, 'stockrack', { n: 1, tag: 'stock' }); },
  // 진료
  waiting(F, R, c) { F.rows(R, 'seats', { aisle: 1.2, margin: 1.2, rot: 0, tag: 'wait', n: Math.max(1, Math.floor(R.n / 16)) }); F.alongWalls(R, 'numbers', { n: 1, tag: 'queue' }); F.alongWalls(R, 'water', { n: 1 }); c.plants(R, 2); },
  consult(F, R) { const b = F.box(R); F.near(R, 'examdesk', b.cx, b.cz, F.doorDir(R), { R: 2, tag: 'doctor', anyRot: true }); F.alongWalls(R, 'exambed', { n: 1, tag: 'bed' }); F.alongWalls(R, 'cabinet', { n: 1 }); },
  scan(F, R) { const b = F.box(R); F.near(R, 'scanner', b.cx, b.cz, 0, { R: 3, tag: 'scanner', anyRot: true }); F.alongWalls(R, 'console', { n: 1, tag: 'console' }); },
  treat(F, R) { const b = F.box(R); F.near(R, 'treatpod', b.cx, b.cz, 0, { R: 3, tag: 'treat', anyRot: true }); F.alongWalls(R, 'cabinet', { n: 1 }); F.alongWalls(R, 'medshelf', { n: 1, tag: 'stock' }); },
  wardroom(F, R) { F.alongWalls(R, 'bed', { n: Math.max(1, Math.min(4, Math.floor(R.n / 9))), tag: 'bed' }); F.alongWalls(R, 'armchair', { n: 1 }); },
  nurse(F, R) { const b = F.box(R); F.near(R, 'nursedesk', b.cx, b.cz, F.doorDir(R), { R: 3, tag: 'nurse', anyRot: true }); F.alongWalls(R, 'medshelf', { n: 1, tag: 'stock' }); },
  pharmacy(F, R) { const b = F.box(R); F.near(R, 'counter', b.cx, b.cz, F.doorDir(R), { R: 3, tag: 'pharmacy', anyRot: true }); F.alongWalls(R, 'medshelf', { n: Math.max(1, Math.floor(R.n / 8)), tag: 'stock' }); },
  // 학교
  classroom(F, R) {
    const board = F.alongWalls(R, 'board', { n: 1, tag: 'board', avoidWindows: true })[0];
    const rot = board ? board.rot : 0;
    // 작은 교실은 선생님 책상 없이 칠판 앞에 서서 (학생 자리가 먼저)
    const st = F.rows(R, 'sdesk', { rot: (rot + 2) % 4, axis: rot % 2 ? 'z' : 'x', aisle: 0.75, gap: 0.3, margin: R.n < 30 ? 0.9 : 1.2, tag: 'student' });
    if (board) F.near(R, 'tdesk', board.x + FR4[rot][0] * 1.4, board.z + FR4[rot][1] * 1.4, (rot + 2) % 4, { R: 1.5, tag: 'teacher' });
    if (!st.length) F.scatter && F.scatter(R, 'sdesk', { n: Math.max(2, Math.floor(R.n / 6)), tag: 'student' });
    F.alongWalls(R, 'cabinet', { n: 1, avoidWindows: true });
  },
  sciroom(F, R) { F.alongWalls(R, 'board', { n: 1, tag: 'board', avoidWindows: true }); F.alongWalls(R, 'hood', { n: 1, tag: 'bench', avoidWindows: true }); F.rows(R, 'labbench', { aisle: 1.4, margin: 1.4, tag: 'bench' }); },
  musicroom(F, R) { F.alongWalls(R, 'instrumentrack', { n: 3, tag: 'instrument' }); const b = F.box(R); for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; F.near(R, 'armchair', b.cx + Math.cos(a) * 2.6, b.cz + Math.sin(a) * 2.6, 0, { R: 1, tag: 'seat' }); } },
  teachers(F, R) { F.rows(R, 'desk', { face: 'pair', aisle: 0.1, margin: 1.4, tag: 'desk' }); F.alongWalls(R, 'cabinet', { n: 2, avoidWindows: true }); F.alongWalls(R, 'terminal', { n: 1, tag: 'terminal' }); },
  gym(F, R) {
    F.alongWalls(R, 'hoop', { n: 2, tag: 'hoop', prefer: (p, q) => Math.abs(q.rot % 2) - Math.abs(p.rot % 2) });
    F.alongWalls(R, 'bench', { n: 4 });
    const b = F.box(R);
    for (let k = 0; k < 4; k++) F.near(R, 'floatpad', b.cx + (k - 1.5) * 3, b.cz, 0, { R: 2, tag: 'exercise' });
  },
  canteen(F, R, c) { F.alongWalls(R, 'canteenline', { n: 1, tag: 'order', avoidWindows: true }); F.rows(R, 'table4', { aisle: 1.6, gap: 1.6, margin: 1.6, tag: 'table' }); },
  // 서고·박물관·공연
  stacks(F, R, c) {
    const b = F.box(R);
    F.near(R, 'reception', b.cx, b.z1 - 5, 0, { R: 6, tag: 'circulation' });
    F.near(R, 'catalog', b.cx - 3, b.z1 - 3, 0, { R: 4, tag: 'catalog', anyRot: true });
    F.rows(R, 'bookshelf', { aisle: 1.4, margin: 2.0, rot: 0, axis: 'x', tag: 'books' });
    F.alongWalls(R, 'readtable', { n: 3, tag: 'read' });
    c.plants(R, 2);
  },
  reading(F, R) { F.rows(R, 'readtable', { aisle: 1.6, margin: 1.5, tag: 'read' }); F.alongWalls(R, 'bookshelf', { n: 2, tag: 'books', avoidWindows: true }); },
  archive(F, R) { F.rows(R, 'bookshelf', { aisle: 1.0, margin: 0.8, tag: 'archive' }); },
  gallery(F, R, c) {
    const b = F.box(R);
    if (R.n > 90) F.near(R, 'bigexhibit', b.cx, b.cz, 0, { R: 4, tag: 'exhibit' });
    F.alongWalls(R, 'case', { n: Math.max(2, Math.floor(R.n / 30)), tag: 'exhibit' });
    F.rows(R, 'plinth', { aisle: 2.4, gap: 2.4, margin: 2.6, tag: 'exhibit', n: Math.max(1, Math.floor(R.n / 40)) });
    F.near(R, 'bench', b.cx, b.cz + 3, 0, { R: 4 });
  },
  conserve(F, R) { F.rows(R, 'restore', { aisle: 1.4, margin: 1.2, tag: 'restore', n: 3 }); F.alongWalls(R, 'cabinet', { n: 2 }); },
  giftshop(F, R) { F.alongWalls(R, 'wallshelf', { n: 2, tag: 'shelf', data: { cat: 'gift' } }); F.near(R, 'checkout', F.box(R).cx, F.box(R).cz, 0, { R: 3, tag: 'checkout', anyRot: true }); },
  auditorium(F, R, c) {
    const b = F.box(R);
    // 무대: 뒤쪽(−z) 벽 앞
    const st = F.near(R, 'stageplat', b.cx, b.z0 + FIX.stageplat.d / 2 + 0.6, 0, { R: 3, tag: 'stage', noReach: true });
    const z0 = st ? st.z + st.d / 2 + 2.5 : b.z0 + 4;
    for (let z = z0, row = 0; z < b.z1 - 3; z += 1.6, row++) for (let x = b.x0 + 2; x < b.x1 - 2; x += FIX.seatrow.w + 1.4) {
      const q = F.try(R, 'seatrow', Math.round((x + FIX.seatrow.w / 2) * 2) / 2, Math.round(z * 2) / 2, 2, { tag: 'seat', noReach: false });
      if (q) q.row = row;
    }
    F.alongWalls(R, 'lightrig', { n: 1, tag: 'lights', prefer: (p, q) => q.z - p.z });
  },
  stage(F, R) { const b = F.box(R); F.near(R, 'stageplat', b.cx, b.cz, 0, { R: 3, tag: 'stage', noReach: true }); },
  backstage(F, R) { F.alongWalls(R, 'cabinet', { n: 3 }); F.alongWalls(R, 'lockers', { n: 1, tag: 'locker' }); },
  foyer(F, R, c) { F.near(R, 'ticketbooth', F.box(R).cx + 4, F.box(R).cz, 0, { R: 5, tag: 'tickets', anyRot: true }); F.alongWalls(R, 'sofa', { n: 2 }); c.plants(R, 3); },
  rehearsal(F, R) { F.alongWalls(R, 'instrumentrack', { n: 2, tag: 'instrument' }); F.alongWalls(R, 'board', { n: 1 }); },
  // 행정
  counters(F, R, c) {
    const b = F.box(R);
    for (let k = 0; k < Math.min(6, Math.floor(b.w / 3)); k++) F.try(R, 'servicecounter', Math.round((b.x0 + 2 + k * 2.6) * 2) / 2, b.z0 + 1.5, 0, { tag: 'civic' });
    F.near(R, 'numbers', b.cx, b.z1 - 4, 0, { R: 4, tag: 'queue' });
    F.rows(R, 'seats', { aisle: 1.3, margin: 2.2, rot: 2, tag: 'wait', n: Math.max(2, Math.floor(R.n / 30)) });
    F.alongWalls(R, 'terminal', { n: 1, tag: 'terminal' });
    c.plants(R, 2);
  },
  council(F, R) { const b = F.box(R); F.near(R, 'counciltable', b.cx, b.cz, 0, { R: 3, tag: 'council' }); },
  // 주거·호텔
  living(F, R, c) {
    F.alongWalls(R, 'sofa', { n: 1 });
    const b = F.box(R);
    F.near(R, 'lowtable', b.cx, b.cz, 0, { R: 2 });
    F.alongWalls(R, 'shelfh', { n: 1, avoidWindows: true });
    if (!c.L.rooms.some((q) => q.type === 'kitchen1' && (q.unit === R.id || q.unit === R.unit || q.house) && q.n)) { F.alongWalls(R, 'kcounter', { n: 1, tag: 'cook' }); F.near(R, 'dtable', b.cx + 2, b.cz, 0, { R: 3, tag: 'eat' }); }
    if (R.n < 26 && c.L.rooms.every((q) => q.unit !== R.id || q.type !== 'bedroom')) F.alongWalls(R, 'bedpod1', { n: 1, tag: 'sleep' });
    c.plants(R, 1);
  },
  bedroom(F, R, c) { F.alongWalls(R, R.n > 12 ? 'bedpod' : 'bedpod1', { n: 1, tag: 'sleep' }); F.alongWalls(R, 'wardrobe', { n: 1, avoidWindows: true }); if (R.n > 14) F.alongWalls(R, 'desk', { n: 1, tag: 'desk' }); },
  kitchen1(F, R) { F.alongWalls(R, 'kcounter', { n: 1 + (R.n > 14 ? 1 : 0), tag: 'cook' }); const b = F.box(R); F.near(R, 'dtable', b.cx, b.cz, 0, { R: 2, tag: 'eat' }); },
  bath(F, R) { F.alongWalls(R, 'washpod', { n: 1 }); F.alongWalls(R, 'wc1', { n: 1 }); F.alongWalls(R, 'sink', { n: 1 }); },
  entry(F, R, c) { if (R.circ && R.n < 14) return; F.alongWalls(R, 'cabinet', { n: 1 }); c.plants(R, 1); },
  unit(F, R, c) { F.alongWalls(R, 'bedpod1', { n: 1, tag: 'sleep' }); F.alongWalls(R, 'kcounter', { n: 1, tag: 'cook' }); const b = F.box(R); F.near(R, 'dtable', b.cx, b.cz, 0, { R: 2, tag: 'eat' }); },
  balcony(F, R, c) { c.plants(R, 2); F.alongWalls(R, 'armchair', { n: R.n > 5 ? 1 : 0, keep: false }); },
  guestroom(F, R) { F.alongWalls(R, 'bedpod', { n: 1, tag: 'sleep' }); F.alongWalls(R, 'desk', { n: 1, tag: 'desk' }); F.alongWalls(R, 'wardrobe', { n: 1, avoidWindows: true }); F.alongWalls(R, 'armchair', { n: 1 }); },
  housekeeping(F, R) { F.alongWalls(R, 'hkcart', { n: 2, tag: 'cart' }); F.alongWalls(R, 'cabinet', { n: 2 }); F.alongWalls(R, 'washer', { n: 1, tag: 'laundry' }); },
  laundry(F, R) { F.alongWalls(R, 'washer', { n: Math.max(2, Math.floor(R.n / 5)), tag: 'laundry' }); F.alongWalls(R, 'prep', { n: 1 }); },
  // 생산·물류·발전·농장
  production(F, R, c) {
    const b = F.box(R);
    // 공정 줄: 긴 축을 따라 원료 → 성형 → 조립 → 가마 → 포장
    const along = b.w >= b.d ? 'x' : 'z';
    const seq = ['machine', 'assembler', 'kiln', 'packer'];
    const n = Math.max(2, Math.min(8, Math.floor((along === 'x' ? b.w : b.d) / 5)));
    const mid = along === 'x' ? b.cz : b.cx;
    const lines = R.n > 500 ? [mid - 4, mid + 4] : [mid];
    let line = 0;
    for (const m of lines) {
      for (let k = 0; k < n; k++) {
        const t = seq[Math.min(seq.length - 1, Math.floor((k / n) * seq.length))];
        const a = (along === 'x' ? b.x0 : b.z0) + 3 + (k + 0.5) * (((along === 'x' ? b.w : b.d) - 6) / n);
        const x = along === 'x' ? a : m, z = along === 'x' ? m : a;
        const q = F.near(R, t, Math.round(x * 2) / 2, Math.round(z * 2) / 2, along === 'x' ? 0 : 1, { R: 2, tag: 'machine', data: { line, step: k } });
        if (q) q.step = k;
      }
      line++;
    }
    F.alongWalls(R, 'toolrack', { n: 2, tag: 'tools', avoidWindows: true });
    F.alongWalls(R, 'qcbench', { n: 1, tag: 'qc' });
    F.alongWalls(R, 'console', { n: 1, tag: 'console' });
    F.alongWalls(R, 'forklift', { n: 1 });
  },
  rawstore(F, R) { F.alongWalls(R, 'bins', { tag: 'raw' }); F.rows(R, 'pallet', { aisle: 1.8, margin: 1.4, tag: 'raw', n: Math.max(1, Math.floor(R.n / 20)) }); },
  finished(F, R) { F.rows(R, 'bigrack', { aisle: 2.6, margin: 1.4, tag: 'finished' }); F.alongWalls(R, 'pallet', { n: 2, tag: 'finished' }); },
  control(F, R) { F.alongWalls(R, 'console', { n: Math.max(1, Math.floor(R.n / 10)), tag: 'console', onlyExt: false }); F.alongWalls(R, 'terminal', { n: 1, tag: 'terminal' }); },
  maint(F, R) { F.alongWalls(R, 'toolrack', { n: 2, tag: 'tools' }); F.rows(R, 'qcbench', { n: 1, aisle: 1.4, margin: 1.3, tag: 'repair' }); F.alongWalls(R, 'stockrack', { n: 1, tag: 'parts' }); },
  warehouse(F, R) {
    F.rows(R, 'bigrack', { aisle: 2.6, gap: 0.2, margin: 2.4, tag: 'stock' });
    F.alongWalls(R, 'pallet', { n: 4, tag: 'pallet' });
    F.alongWalls(R, 'forklift', { n: 1 });
    F.alongWalls(R, 'terminal', { n: 1, tag: 'terminal' });
  },
  sorting(F, R) { const b = F.box(R); F.rows(R, 'sorter', { n: 2, aisle: 2.4, margin: 1.6, axis: b.w >= b.d ? 'x' : 'z', rot: b.w >= b.d ? 1 : 0, tag: 'sort' }); F.alongWalls(R, 'pallet', { n: 3, tag: 'pallet' }); F.alongWalls(R, 'dronepad', { n: 1, tag: 'drone' }); },
  concourse(F, R, c) {
    const e = F.entry(), b = F.box(R);
    if (e) for (let k = 0; k < 3; k++) F.near(R, 'ticketm', e[0] + (k - 1) * 1.6, e[1] - 5, 0, { R: 2, tag: 'tickets' });
    F.alongWalls(R, 'departures', { n: 1, tag: 'departures', prefer: (p, q) => p.z - q.z });
    F.rows(R, 'bench', { aisle: 1.6, gap: 0.6, margin: 3, tag: 'wait', n: Math.max(2, Math.floor(R.n / 60)) });
    // 승강장으로 가는 문 앞에 타는 문
    const plat = c.L.rooms.find((q) => q.type === 'platform' && q.n);
    if (plat) F.near(R, 'gateline', c.B.G.ox + plat.cx + 0.5, c.B.G.oz + plat.j1 + 3, 0, { R: 6, tag: 'gate' });
    c.plants(R, 3);
  },
  platform(F, R) { F.alongWalls(R, 'bay', { n: Math.max(1, Math.floor(R.n / 40)), tag: 'board', onlyExt: true, keep: false }); F.alongWalls(R, 'bench', { n: 2 }); },
  ticket(F, R) { F.near(R, 'ticketbooth', F.box(R).cx, F.box(R).cz, 0, { R: 3, tag: 'tickets', anyRot: true }); },
  corehall(F, R) {
    const b = F.box(R);
    const core = F.near(R, 'core', b.cx, b.cz, 0, { R: 4, tag: 'core' });
    if (core) for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; F.near(R, 'coil', core.x + Math.cos(a) * 5.5, core.z + Math.sin(a) * 5.5, 0, { R: 1.5, tag: 'coil' }); }
    F.alongWalls(R, 'pump', { n: 2, tag: 'pump' });
    F.alongWalls(R, 'console', { n: 1, tag: 'console' });
  },
  coilroom(F, R) { F.rows(R, 'coil', { aisle: 1.6, gap: 1.2, margin: 1.6, tag: 'coil' }); },
  fuelstore(F, R) { F.alongWalls(R, 'fuelrack', { tag: 'fuel' }); F.alongWalls(R, 'handcart', { n: 1, tag: 'cart' }); },
  growhall(F, R, c) {
    const tall = c.B.floors[c.L.i].h > 6;
    F.rows(R, tall ? 'growbed' : 'growrack', { aisle: 1.4, gap: 0.6, margin: 1.4, tag: 'crop' });
    F.alongWalls(R, 'tank', { n: 1, tag: 'nutrient' });
  },
  packing(F, R) { F.rows(R, 'packtable', { aisle: 1.4, margin: 1.3, tag: 'pack', n: 2 }); F.alongWalls(R, 'crates', { tag: 'produce' }); F.alongWalls(R, 'pallet', { n: 1, tag: 'pallet' }); },
  nutrient(F, R) { F.rows(R, 'tank', { aisle: 1.2, gap: 1.0, margin: 1.2, tag: 'nutrient', n: 3 }); },
  gardenhall(F, R, c) { const b = F.box(R); if (R.n > 80) F.near(R, 'pooltub', b.cx, b.cz, 0, { R: 4 }); F.scatter(R, 'plant', Math.round(R.n / 18)); F.alongWalls(R, 'bench', { n: Math.max(2, Math.floor(R.n / 40)) }); F.alongWalls(R, 'growbed', { n: 2, tag: 'crop' }); },
  parkbay(F, R) { F.rows(R, 'hovercar', { aisle: 6.0, gap: 0.6, margin: 1.0, rot: 0, axis: 'x', tag: 'car' }); },
  mech(F, R) { F.rows(R, 'mechunit', { aisle: 1.4, margin: 1.0, tag: 'mech' }); },
  gymroom(F, R) { F.scatter(R, 'floatpad', Math.round(R.n / 12), { tag: 'exercise' }); F.alongWalls(R, 'bench', { n: 2 }); },
  pool(F, R) { const b = F.box(R); F.near(R, 'pooltub', b.cx, b.cz, 0, { R: 3 }); F.alongWalls(R, 'bench', { n: 3 }); },
  deck(F, R, c) { F.alongWalls(R, 'scope', { n: Math.max(2, Math.floor(R.n / 30)), tag: 'scope', onlyExt: true }); F.rows(R, 'bench', { n: 4, aisle: 2, margin: 3 }); },
  bar(F, R, c) { F.alongWalls(R, 'barcounter', { n: 1, tag: 'order', avoidWindows: true }); F.rows(R, 'table2', { aisle: 1.4, gap: 1.4, margin: 1.4, tag: 'table' }); },
  dock(F, R) { F.alongWalls(R, 'pallet', { n: 3, tag: 'pallet' }); },
};

const FR4 = [[0, 1], [1, 0], [0, -1], [-1, 0]];
/** 복도의 그 벽 앞이 넓은가 (가구를 두어도 1.2 m 이상 남는가) */
function wideAt(F, R, s) {
  const L = F.L;
  let w = 0;
  const [fx, fz] = FR4[s.rot];
  for (let k = 0; k < 4; k++) { const i = s.i + fx * k, j = s.j + fz * k; if (i < 0 || j < 0 || i >= L.gw || j >= L.gh || L.room[j * L.gw + i] !== R.id + 1) break; w++; }
  return w >= 3;
}
void sideOf;
