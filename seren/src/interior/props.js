// 가구·장비 모양 (v0.9): 아웬 문명의 실내 — 둥근 모서리의 진주빛 몸체, 빛나는 이음매, 공명으로 떠 있는 판, 결정 화면.
// 모양마다 「물건 칸」 자리(slots)도 정한다 — 진열대·선반·통의 물건은 재고만큼 그 칸에 놓인다(ops 가 채운다).
import * as THREE from 'three';
import { PAT } from './material.js';
import { SPINES, SHELF_LEVELS, SHELF_COLS } from './library.js';

const TAU = Math.PI * 2;
/** 가구의 로컬(정면 +z, 바닥 0) → 층 틀 좌표 */
class FX {
  constructor(gb, F) { this.gb = gb; this.F = F; this.a = (F.rot || 0) * Math.PI / 2; this.c = Math.cos(this.a); this.s = Math.sin(this.a); }
  pt(lx, lz) { return [this.F.x + lx * this.c + lz * this.s, this.F.z - lx * this.s + lz * this.c]; }
  box(lx, ly, lz, w, h, d, col, emit = 0, pat = 0, prm = 0, ry = 0) { const [x, z] = this.pt(lx, lz); this.gb.box(x, ly, z, w, h, d, this.a + ry, col, emit, pat, prm); }
  cyl(lx, ly, lz, r, h, col, emit = 0, pat = 0, prm = 0, seg = 12, r2 = null) { const [x, z] = this.pt(lx, lz); this.gb.cyl(x, ly, z, r, h, col, emit, pat, prm, seg, r2); }
  sph(lx, ly, lz, r, col, emit = 0, pat = 0) { const [x, z] = this.pt(lx, lz); this.gb.sphere(x, ly, z, r, col, emit, pat); }
  geo(g, lx, ly, lz, col, emit = 0, pat = 0, ry = 0, s = [1, 1, 1]) { const [x, z] = this.pt(lx, lz); this.gb.geo(g, x, ly, z, this.a + ry, col, emit, pat, 0, s[0], s[1], s[2]); }
}
const torusG = new THREE.TorusGeometry(1, 0.06, 4, 24).rotateX(Math.PI / 2);
const ringG = new THREE.TorusGeometry(1, 0.03, 3, 24);
const coneG = new THREE.ConeGeometry(1, 1, 8);
const octG = new THREE.OctahedronGeometry(1, 0);
const capsG = new THREE.CapsuleGeometry(0.5, 1, 4, 10).rotateZ(Math.PI / 2);

/**
 * 가구 하나를 그린다. st: 층의 빛깔 { wall, floor, brand, brand2, glow, warm, cool, soft, leaf, tint }
 * 반환: slots — 물건 칸 [{x, y, z(로컬), w, n(보이는 개수)}] (없으면 빈 배열)
 */
export function drawFixture(gb, F, st) {
  const f = new FX(gb, F);
  const W = F.w, D = F.d, H = F.h;
  const P = st.wall, B = st.brand, G = st.glow, GOLD = st.tint ?? 0xe9c27c;
  const dark = 0x3a3e4c, steel = 0xa8b2c0, pearl = 0xf1ece4;
  const slots = [];
  const shelfSlots = (levels, y0, dy, depth, zc = 0, perRow = 4, cols = 1) => {
    for (let l = 0; l < levels; l++) for (let c = 0; c < cols; c++) slots.push({ x: cols > 1 ? (c - (cols - 1) / 2) * (W / cols) : 0, y: y0 + l * dy, z: zc, w: W / cols - 0.15, d: depth, n: perRow });
  };
  switch (F.t) {
    // ── 공용 ──
    case 'plant': {
      f.cyl(0, 0, 0, 0.42, 0.55, GOLD, 0, PAT.metal, 0, 10, 0.34);
      f.cyl(0, 0.55, 0, 0.36, 0.02, 0x5fd8d0, 0.8);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * TAU, h = 0.9 + (k % 3) * 0.35;
        const [x, z] = f.pt(Math.cos(a) * 0.12, Math.sin(a) * 0.12);
        gb.geo(octG, x, 0.55 + h * 0.5, z, a, [0x8ff0ff, 0xc8a8ff, st.leaf ?? 0x8fcf9a][k % 3], 0.5, PAT.crystal, 0, 0.08, h * 0.5, 0.05);
      }
      f.sph(0.1, 1.9, 0, 0.09, 0xbffcff, 2);
      break;
    }
    case 'art': {
      f.cyl(0, 0, 0, 0.5, 0.4, P, 0, PAT.stone);
      f.geo(new THREE.TorusKnotGeometry(0.42, 0.1, 48, 6), 0, 1.6, 0, G, 1.4, PAT.crystal);
      break;
    }
    case 'bench': f.box(0, 0.36, 0, W, 0.1, D, P, 0, PAT.fabric); f.box(-W / 2 + 0.2, 0, 0, 0.12, 0.36, D * 0.8, steel); f.box(W / 2 - 0.2, 0, 0, 0.12, 0.36, D * 0.8, steel); f.box(0, 0.37, D / 2 - 0.02, W, 0.02, 0.04, G, 1.4); break;
    case 'sofa': f.box(0, 0.2, 0, W, 0.25, D, B, 0, PAT.fabric); f.box(0, 0.2, -D / 2 + 0.15, W, 0.6, 0.3, B, 0, PAT.fabric); f.box(-W / 2 + 0.1, 0.2, 0, 0.2, 0.35, D, B, 0, PAT.fabric); f.box(W / 2 - 0.1, 0.2, 0, 0.2, 0.35, D, B, 0, PAT.fabric); f.box(0, 0, 0, W - 0.2, 0.2, D - 0.2, dark); break;
    case 'lowtable': f.box(0, 0.38, 0, W, 0.06, D, pearl, 0, PAT.stone); f.cyl(0, 0, 0, 0.18, 0.38, GOLD); break;
    case 'armchair': f.cyl(0, 0.12, 0, 0.42, 0.3, B, 0, PAT.fabric, 0, 14); f.box(0, 0.2, -0.3, 0.8, 0.6, 0.2, B, 0, PAT.fabric); f.cyl(0, 0, 0, 0.2, 0.12, steel); break;
    case 'infokiosk': case 'terminal': case 'catalog': {
      f.cyl(0, 0, 0, 0.28, 0.08, dark);
      f.box(0, 0.08, 0, 0.14, H - 0.7, 0.1, steel, 0, PAT.metal);
      f.box(0, H - 0.75, 0.02, W * 0.9, 0.62, 0.06, 0x101820, 0);
      f.box(0, H - 0.72, 0.06, W * 0.8, 0.54, 0.01, F.t === 'infokiosk' ? G : B, 1.3, PAT.screen);
      break;
    }
    case 'vending': {
      f.box(0, 0, 0, W, H, D, B, 0, PAT.metal);
      f.box(0, 0.6, D / 2 + 0.005, W * 0.75, 1.1, 0.01, 0x101820);
      shelfSlots(3, 0.68, 0.34, 0.3, D / 2 - 0.25, 3);
      f.box(W * 0.38, 1.1, D / 2 + 0.01, 0.12, 0.3, 0.01, G, 1.5);
      break;
    }
    case 'water': f.cyl(0, 0, 0, 0.22, 1.0, pearl, 0, 0, 0, 10); f.cyl(0, 1.0, 0, 0.18, 0.28, 0x8fd8ff, 0.6, PAT.crystal, 0, 10); f.box(0, 0.8, 0.2, 0.12, 0.05, 0.1, G, 1.4); break;
    case 'reception': case 'counter': case 'barcounter': case 'nursedesk': case 'ticketbooth': case 'servicecounter': case 'canteenline': {
      f.box(0, 0, 0, W, H - 0.05, D, F.t === 'nursedesk' ? 0xe8f4f2 : P, 0, PAT.panel);
      f.box(0, H - 0.05, 0.05, W + 0.08, 0.06, D + 0.18, GOLD, 0, PAT.stone);
      f.box(0, H * 0.45, D / 2 + 0.01, W - 0.1, 0.05, 0.01, B, 1.6);
      if (F.t === 'canteenline') for (let k = 0; k < 4; k++) f.box((k - 1.5) * (W / 4), H - 0.02, 0, W / 4 - 0.2, 0.08, D * 0.6, 0xc8c2d2, 0.1, PAT.metal);
      if (F.t === 'ticketbooth' || F.t === 'servicecounter') { f.box(0, H, -D / 2 + 0.05, W, 1.1, 0.04, 0xbfefff, 0.15, PAT.glassfrost); f.box(0, H + 1.15, -D / 2 + 0.05, W, 0.25, 0.08, B, 1.2, PAT.screen); }
      if (F.t === 'counter' || F.t === 'barcounter') { shelfSlots(1, H + 0.02, 0, 0.3, 0.1, 3); }
      break;
    }
    case 'mailbox': for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) f.box((i - 2.5) * (W / 6), 0.1 + j * 0.42, 0, W / 6 - 0.03, 0.38, D, j % 2 ? GOLD : steel, 0, PAT.metal); f.box(0, 1.8, D / 2, W, 0.04, 0.02, G, 1.3); break;
    case 'lockers': for (let i = 0; i < 4; i++) { f.box((i - 1.5) * (W / 4), 0, 0, W / 4 - 0.03, H, D, i % 2 ? B : steel, 0, PAT.metal); f.box((i - 1.5) * (W / 4), H * 0.55, D / 2 + 0.01, 0.06, 0.06, 0.01, G, 2); } break;
    case 'timeclock': f.box(0, 1.1, 0, W, 0.4, D, dark); f.box(0, 1.15, D / 2 + 0.01, W * 0.8, 0.3, 0.01, G, 1.4, PAT.screen); break;
    case 'wcstall': f.box(-W / 2 + 0.03, 0, 0, 0.06, H, D, P, 0, PAT.panel); f.box(W / 2 - 0.03, 0, 0, 0.06, H, D, P, 0, PAT.panel); f.box(0, 0.15, -D / 2 + 0.25, 0.45, 0.4, 0.5, pearl); f.box(0, 0, D / 2 - 0.03, W - 0.1, H - 0.2, 0.05, st.cool ?? 0xa8d8ff, 0.05, PAT.panel); break;
    case 'sink': f.box(0, 0.75, 0, W, 0.15, D, pearl, 0, PAT.stone); f.box(0, 0, -D / 2 + 0.1, W, 0.75, 0.2, P); f.box(0, 1.2, -D / 2 + 0.02, W, 0.7, 0.02, 0xd8f0ff, 0.3); break;
    case 'cabinet': case 'shelfh': case 'wardrobe': f.box(0, 0, 0, W, H, D, F.t === 'wardrobe' ? st.soft ?? P : P, 0, PAT.panel); f.box(0, H - 0.05, D / 2 + 0.01, W - 0.1, 0.03, 0.01, GOLD, 0.6); if (F.t === 'shelfh') shelfSlots(3, 0.4, 0.5, 0.3, 0.05, 4); break;
    // ── 사무 ──
    case 'desk': case 'tdesk': case 'examdesk': case 'analysis': {
      f.box(0, H - 0.04, 0, W, 0.04, D, F.t === 'examdesk' ? 0xf0f6f6 : pearl, 0, PAT.stone);
      f.box(-W / 2 + 0.08, 0, 0, 0.06, H - 0.04, D - 0.1, steel); f.box(W / 2 - 0.08, 0, 0, 0.06, H - 0.04, D - 0.1, steel);
      // 떠 있는 빛 화면 (뒤쪽)
      f.box(0, H + 0.1, -D / 2 + 0.12, W * 0.55, 0.42, 0.02, 0x101820);
      f.box(0, H + 0.12, -D / 2 + 0.14, W * 0.5, 0.36, 0.005, F.t === 'analysis' ? 0x9ff6ff : B, 1.2, PAT.screen);
      // 의자 (앞)
      f.cyl(0, 0, D / 2 + 0.42, 0.22, 0.46, dark, 0, 0, 0, 10); f.box(0, 0.46, D / 2 + 0.68, 0.46, 0.5, 0.08, B, 0, PAT.fabric);
      break;
    }
    case 'meettable': case 'readtable': case 'dtable': case 'counciltable': {
      const round = F.t === 'counciltable';
      if (round) { f.cyl(0, H - 0.05, 0, W / 2, 0.05, pearl, 0, PAT.stone, 0, 32); f.cyl(0, 0, 0, 0.4, H - 0.05, GOLD); f.geo(torusG, 0, H + 0.01, 0, G, 1.5, 0, 0, [W / 2 - 0.3, 1, W / 2 - 0.3]); }
      else { f.box(0, H - 0.05, 0, W, 0.05, D, pearl, 0, PAT.stone); f.box(0, 0, 0, 0.3, H - 0.05, D * 0.5, steel); f.box(0, H + 0.005, 0, W - 0.3, 0.005, 0.04, G, 1.4); }
      const n = round ? 10 : F.t === 'dtable' ? 4 : 6;
      for (let k = 0; k < n; k++) {
        let lx, lz;
        if (round) { const a = (k / n) * TAU; lx = Math.cos(a) * (W / 2 + 0.45); lz = Math.sin(a) * (W / 2 + 0.45); }
        else { const side = k % 2 ? 1 : -1, idx = Math.floor(k / 2), m = Math.ceil(n / 2); lx = (idx - (m - 1) / 2) * (W / m); lz = side * (D / 2 + 0.38); }
        f.cyl(lx, 0, lz, 0.2, 0.46, B, 0, PAT.fabric, 0, 8);
      }
      break;
    }
    case 'board': f.box(0, 0.8, 0, W, 1.3, D * 0.5, 0x162028); f.box(0, 0.85, D * 0.25 + 0.005, W - 0.1, 1.2, 0.005, G, 0.6, PAT.screen); break;
    case 'printer': f.box(0, 0, 0, W, 0.9, D, P); f.box(0, 0.9, 0, W * 0.9, 0.2, D * 0.8, steel, 0, PAT.metal); f.box(0, 1.0, D / 2, 0.3, 0.04, 0.01, G, 1.5); break;
    case 'rack': f.box(0, 0, 0, W, H, D, dark, 0, PAT.metal); for (let k = 0; k < 8; k++) f.box(0, 0.2 + k * 0.24, D / 2 + 0.005, W * 0.8, 0.02, 0.005, k % 3 ? G : 0xffd27a, 1.6); break;
    // ── 마트 ──
    case 'gondola': {
      // 양면 진열대: 가운데 판 + 선반 다섯 층 (양쪽), 머리에 구역 표시
      f.box(0, 0, 0, 0.1, H, D, P, 0, PAT.panel);
      f.box(0, 0, 0, W, 0.14, D, dark);
      for (let l = 0; l < 4; l++) for (const sd of [-1, 1]) f.box(sd * W * 0.27, 0.32 + l * 0.38, 0, W * 0.44, 0.03, D, pearl, 0, PAT.metal);
      f.box(0, H, 0, W * 0.3, 0.22, D * 0.6, B, 0.9, PAT.screen);
      // 칸: 양면 × 4층 × 앞뒤로 두 칸 (rot 0 이면 길이 방향이 z)
      for (const sd of [-1, 1]) for (let l = 0; l < 4; l++) for (const zz of [-D / 4, D / 4]) slots.push({ x: sd * W * 0.27, y: 0.34 + l * 0.38, z: zz, w: D / 2 - 0.1, d: W * 0.38, n: 4, along: 'z' });
      break;
    }
    case 'wallshelf': case 'medshelf': case 'bookshelf': case 'fuelrack': {
      f.box(0, 0, -D / 2 + 0.04, W, H, 0.08, P, 0, PAT.panel);
      const lv = F.t === 'bookshelf' ? SHELF_LEVELS : 4;
      for (let l = 0; l < lv; l++) f.box(0, 0.25 + l * ((H - 0.4) / lv), 0, W, 0.03, D, F.t === 'bookshelf' ? 0x8a6a4a : pearl, 0, PAT.metal);
      f.box(-W / 2 + 0.02, 0, 0, 0.04, H, D, steel); f.box(W / 2 - 0.02, 0, 0, 0.04, H, D, steel);
      f.box(0, H - 0.08, D / 2, W, 0.08, 0.02, F.t === 'medshelf' ? 0x8ff0c0 : B, 1.2);
      shelfSlots(lv, 0.27, (H - 0.4) / lv, D - 0.1, 0.02, F.t === 'bookshelf' ? SPINES : 5, F.t === 'bookshelf' ? SHELF_COLS : 2);
      break;
    }
    case 'chiller': case 'coldbox': case 'freezer': {
      f.box(0, 0, 0, W, H, D, 0xe4ecf2, 0, PAT.metal);
      f.box(0, 0.2, D / 2 - 0.01, W - 0.1, H - 0.4, 0.02, 0x9fdcf0, 0.25, PAT.glassfrost);
      f.box(0, H - 0.12, D / 2 + 0.01, W, 0.06, 0.01, 0x9ff6ff, 1.6);
      for (let l = 0; l < 4; l++) f.box(0, 0.35 + l * 0.4, 0, W - 0.15, 0.02, D - 0.2, steel);
      shelfSlots(4, 0.37, 0.4, D - 0.3, 0, 4, 2);
      break;
    }
    case 'produce': case 'display': {
      f.box(0, 0, 0, W, 0.6, D, F.t === 'display' ? P : 0x8a6a4a, 0, F.t === 'display' ? PAT.panel : PAT.wood);
      f.box(0, 0.6, 0, W, 0.06, D, pearl, 0, PAT.stone);
      if (F.t === 'display') f.box(0, 0.66, 0, W - 0.05, 0.5, D - 0.05, 0xbff0ff, 0.05, PAT.glassfrost);
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) slots.push({ x: (i - 0.5) * (W / 2), y: 0.68, z: (j - 0.5) * (D / 2), w: W / 2 - 0.15, d: D / 2 - 0.1, n: 6 });
      break;
    }
    case 'checkout': case 'selfcheck': {
      if (F.t === 'checkout') {
        f.box(0, 0, 0, W, 0.85, D, P, 0, PAT.panel);
        f.box(-W * 0.18, 0.85, 0, W * 0.6, 0.05, D, dark); // 실어 나르는 띠
        f.box(-W * 0.18, 0.9, 0, W * 0.58, 0.005, D - 0.1, 0x30343c, 0.1, PAT.metal);
        f.box(W * 0.3, 0.85, 0, 0.5, 0.35, 0.4, steel); // 셈 단말
        f.box(W * 0.3, 1.25, 0, 0.45, 0.3, 0.02, B, 1.3, PAT.screen);
        f.cyl(W * 0.44, 0, -D / 2 - 0.1, 0.05, 1.9, steel); f.box(W * 0.44, 1.9, -D / 2 - 0.1, 0.5, 0.3, 0.06, B, 1.5, PAT.screen);
      } else {
        f.box(0, 0, 0, W, 0.9, D, P, 0, PAT.panel);
        f.box(0, 0.9, 0.05, W * 0.8, 0.4, 0.04, 0x101820); f.box(0, 0.95, 0.08, W * 0.7, 0.3, 0.005, B, 1.4, PAT.screen);
      }
      break;
    }
    case 'baskets': for (let k = 0; k < 5; k++) f.box(0, k * 0.14, 0, W * 0.9, 0.12, D * 0.8, B, 0.15, PAT.fabric); break;
    case 'gate': f.box(0, 0, 0, W, H, D, steel); f.box(0, H * 0.7, 0, W + 0.02, 0.05, D, G, 1.4); break;
    case 'stockrack': case 'bigrack': case 'bins': {
      const lv = F.t === 'bigrack' ? 4 : F.t === 'bins' ? 2 : 3;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) f.box(sx * (W / 2 - 0.04), 0, sz * (D / 2 - 0.04), 0.06, H, 0.06, F.t === 'bigrack' ? 0xffb050 : steel, 0, PAT.metal);
      for (let l = 0; l < lv; l++) f.box(0, 0.12 + l * (H / lv), 0, W, 0.05, D, F.t === 'bins' ? B : 0x8a8e98, 0, PAT.metal);
      shelfSlots(lv, 0.18, H / lv, D - 0.15, 0, F.t === 'bins' ? 2 : 3, 2);
      break;
    }
    case 'pallet': case 'crates': f.box(0, 0, 0, W, 0.14, D, 0x8a6a4a, 0, PAT.wood); slots.push({ x: 0, y: 0.15, z: 0, w: W - 0.1, d: D - 0.1, n: 6, stack: 3 }); break;
    case 'handcart': case 'hkcart': f.box(0, 0.25, 0, W, 0.06, D, steel, 0, PAT.metal); f.box(0, 0.25, -D / 2 + 0.03, W, 0.8, 0.04, steel); f.cyl(0, 0.05, 0, 0.3, 0.06, G, 1.2, 0, 0, 16); slots.push({ x: 0, y: 0.32, z: 0.1, w: W - 0.15, d: D - 0.3, n: 3, stack: 2 }); break;
    case 'docklevel': f.box(0, 0, 0, W, 0.2, D * 3, dark); f.box(0, 0, -D / 2, W + 0.4, H, 0.1, 0x5a6068, 0, PAT.rib); f.box(0, H - 0.25, -D / 2 + 0.06, W, 0.1, 0.02, 0xffc46a, 1.5); break;
    // ── 먹고 마시기 ──
    case 'teamachine': f.box(0, 0.9, 0, W, 0.06, D, pearl); f.box(0, 0, 0, W, 0.9, D, P, 0, PAT.panel); f.cyl(-W * 0.2, 0.96, 0, 0.18, 0.5, steel, 0, PAT.metal); f.cyl(W * 0.2, 0.96, 0, 0.14, 0.42, GOLD, 0, PAT.metal); f.sph(-W * 0.2, 1.5, 0, 0.08, 0xffc46a, 2); break;
    case 'stove': case 'prep': case 'kcounter': case 'dishwash': case 'packtable': case 'qcbench': case 'restore': {
      f.box(0, 0, 0, W, H - 0.04, D, F.t === 'kcounter' ? (st.warm ?? P) : P, 0, PAT.panel);
      f.box(0, H - 0.04, 0, W + 0.04, 0.04, D + 0.04, F.t === 'stove' || F.t === 'qcbench' ? steel : pearl, 0, PAT.stone);
      if (F.t === 'stove') for (let k = 0; k < 2; k++) f.geo(torusG, (k - 0.5) * W * 0.5, H + 0.01, 0, 0xff9f6a, 2.2, 0, 0, [0.2, 1, 0.2]);
      if (F.t === 'kcounter') { f.geo(torusG, W * 0.3, H + 0.01, 0, 0xff9f6a, 1.6, 0, 0, [0.15, 1, 0.15]); f.box(-W * 0.25, H, 0, 0.4, 0.04, D * 0.6, 0x9fdcf0, 0.2); }
      if (F.t === 'dishwash') f.box(0, H - 0.25, 0, W * 0.6, 0.22, D * 0.6, 0x9fdcf0, 0.3, PAT.glassfrost);
      if (F.t === 'packtable' || F.t === 'qcbench' || F.t === 'restore') slots.push({ x: 0, y: H, z: 0, w: W - 0.3, d: D - 0.2, n: 4 });
      if (F.t === 'qcbench' || F.t === 'restore') { f.cyl(W * 0.35, H, -D * 0.3, 0.05, 0.6, steel); f.box(W * 0.35, H + 0.6, -D * 0.2, 0.3, 0.06, 0.3, 0xfff4e0, 2); }
      break;
    }
    case 'table2': case 'table4': {
      f.cyl(0, H - 0.04, 0, W / 2, 0.04, pearl, 0, PAT.stone, 0, 20); f.cyl(0, 0, 0, 0.1, H - 0.04, GOLD, 0, 0, 0, 8, 0.1);
      f.geo(ringG, 0, H + 0.005, 0, G, 1.2, 0, 0, [W / 2 - 0.1, W / 2 - 0.1, W / 2 - 0.1]);
      const n = F.t === 'table2' ? 2 : 4;
      for (let k = 0; k < n; k++) { const a = (k / n) * TAU + 0.4; f.cyl(Math.cos(a) * (W / 2 + 0.38), 0, Math.sin(a) * (W / 2 + 0.38), 0.2, 0.46, B, 0, PAT.fabric, 0, 8); }
      slots.push({ x: 0, y: H, z: 0, w: 0.4, d: 0.4, n: 2 });
      break;
    }
    // ── 연구 ──
    case 'labbench': case 'hood': {
      f.box(0, 0, 0, W, 0.9, D, 0xe8eef2, 0, PAT.panel); f.box(0, 0.9, 0, W + 0.04, 0.05, D + 0.04, dark, 0, PAT.stone);
      if (F.t === 'hood') { f.box(0, 0.95, -D / 2 + 0.05, W, H - 0.95, 0.06, 0xe8eef2); f.box(0, H - 0.2, 0, W, 0.2, D, 0xe8eef2); f.box(0, 1.1, D / 2 - 0.05, W - 0.1, 0.9, 0.02, 0xbfefff, 0.15, PAT.glassfrost); }
      else { f.box(0, 1.5, 0, W - 0.2, 0.04, 0.3, steel); for (let k = 0; k < 3; k++) f.cyl((k - 1) * W * 0.3, 0.95, 0, 0.07, 0.22, [0x7ff3e6, 0xff9fd0, 0xffd27a][k], 1.2, PAT.crystal, 0, 8); }
      slots.push({ x: 0, y: 0.95, z: 0.1, w: W * 0.5, d: D * 0.4, n: 3 });
      break;
    }
    case 'spectro': f.box(0, 0, 0, W, 0.9, D, steel, 0, PAT.metal); f.cyl(0, 0.9, 0, 0.45, 0.5, 0xe8eef2, 0, PAT.metal, 0, 16); f.geo(ringG, 0, 1.45, 0, G, 2, 0, 0, [0.5, 0.5, 0.5]); f.box(0, 0.5, D / 2 + 0.01, W * 0.6, 0.3, 0.01, G, 1.2, PAT.screen); break;
    case 'grower': f.cyl(0, 0, 0, W / 2, 0.4, dark, 0, 0, 0, 16); f.cyl(0, 0.4, 0, W / 2 - 0.1, H - 0.6, 0xbfefff, 0.15, PAT.glassfrost, 0, 16); f.geo(octG, 0, 1.1, 0, 0xc8a8ff, 1.6, PAT.crystal, 0, [0.22, 0.4, 0.22]); f.cyl(0, H - 0.2, 0, W / 2, 0.2, dark, 0, 0, 0, 16); break;
    case 'scanner': f.box(0, 0, 0, W * 0.9, 0.7, 0.8, pearl, 0, PAT.panel); f.geo(new THREE.TorusGeometry(0.85, 0.22, 8, 32), 0, 1.0, 0, 0xe8f0f6, 0, PAT.metal); f.geo(new THREE.TorusGeometry(0.62, 0.03, 4, 32), 0, 1.0, 0.2, G, 2); break;
    case 'treatpod': f.box(0, 0, 0, W, 0.5, D, pearl); f.geo(capsG, 0, 0.95, 0, 0xd8f4ff, 0.3, PAT.glassfrost, 0, [W * 0.9, D * 0.75, D * 0.75]); f.geo(ringG, 0, 0.95, 0, G, 1.6, 0, Math.PI / 2, [0.75, 0.75, 0.75]); break;
    case 'exambed': case 'bed': f.box(0, 0, 0, W, 0.45, D, steel, 0, PAT.metal); f.box(0, 0.45, 0, W - 0.05, 0.2, D - 0.05, 0xf2f6f8, 0, PAT.fabric); f.box(-W / 2 + 0.25, 0.65, 0, 0.4, 0.1, D * 0.7, 0xffffff, 0, PAT.fabric); if (F.t === 'bed') { f.box(-W / 2 - 0.02, 0.4, 0, 0.04, 0.9, D, st.cool ?? steel); f.box(-W / 2, 1.2, 0, 0.02, 0.3, 0.5, G, 1, PAT.screen); } break;
    case 'seats': for (let k = 0; k < 4; k++) { f.box((k - 1.5) * (W / 4), 0.4, 0, W / 4 - 0.08, 0.06, D, B, 0, PAT.fabric); f.box((k - 1.5) * (W / 4), 0.46, -D / 2 + 0.05, W / 4 - 0.08, 0.45, 0.06, B, 0, PAT.fabric); } f.box(0, 0, 0, W - 0.2, 0.4, 0.1, steel); break;
    case 'numbers': f.cyl(0, 0, 0, 0.2, 1.1, steel); f.box(0, 1.1, 0, 0.45, 0.35, 0.12, dark); f.box(0, 1.15, 0.07, 0.38, 0.22, 0.005, 0xffd27a, 1.8, PAT.screen); break;
    // ── 학교·공연 ──
    case 'sdesk': f.box(0, H - 0.03, 0, W, 0.03, D, 0xd8b890, 0, PAT.wood); f.box(-W / 2 + 0.06, 0, 0, 0.05, H - 0.03, D - 0.1, steel); f.box(W / 2 - 0.06, 0, 0, 0.05, H - 0.03, D - 0.1, steel); f.cyl(-W * 0.22, 0, D / 2 + 0.35, 0.17, 0.42, B, 0, PAT.fabric, 0, 8); f.cyl(W * 0.22, 0, D / 2 + 0.35, 0.17, 0.42, B, 0, PAT.fabric, 0, 8); break;
    case 'instrumentrack': f.box(0, 0, 0, W, 0.8, D, 0x8a6a4a, 0, PAT.wood); for (let k = 0; k < 4; k++) f.geo(new THREE.TorusGeometry(0.22, 0.03, 4, 16), (k - 1.5) * (W / 4), 1.05, 0, [G, GOLD, 0xff9fd0, 0x9fb8ff][k], 1.2); break;
    case 'hoop': f.box(0, 0, -0.1, 0.12, 2.6, 0.12, steel); f.box(0, 2.4, 0.05, 1.0, 0.7, 0.05, P); f.geo(new THREE.TorusGeometry(0.25, 0.025, 4, 18).rotateX(Math.PI / 2), 0, 2.55, 0.35, 0xff9f6a, 1.4); break;
    case 'floatpad': f.cyl(0, 0, 0, W / 2, 0.08, dark, 0, 0, 0, 18); f.geo(torusG, 0, 0.1, 0, G, 2, 0, 0, [W / 2 - 0.1, 1, W / 2 - 0.1]); f.cyl(0, 0.3, 0, W / 2 - 0.2, 0.06, B, 0.3, 0, 0, 18); break;
    case 'seatrow': for (let k = 0; k < 8; k++) { f.box((k - 3.5) * (W / 8), 0.42, 0.05, W / 8 - 0.06, 0.08, 0.55, B, 0, PAT.fabric); f.box((k - 3.5) * (W / 8), 0.5, -0.32, W / 8 - 0.06, 0.55, 0.08, B, 0, PAT.fabric); } f.box(0, 0, -0.1, W, 0.42, 0.12, dark); break;
    case 'stageplat': f.box(0, 0, 0, W, H, D, 0x6a4a3a, 0, PAT.wood); f.box(0, H, D / 2 - 0.02, W, 0.02, 0.04, GOLD, 1.6); for (let k = 0; k < 3; k++) f.geo(coneG, (k - 1) * W * 0.3, 5.5, -D * 0.2, [0xff9fd0, G, 0xffd27a][k], 0.35, 0, Math.PI, [0.8, 2.5, 0.8]); break;
    case 'lightrig': case 'console': {
      f.box(0, 0, 0, W, 0.8, D, dark, 0, PAT.panel);
      f.box(0, 0.8, 0, W, 0.3, D * 0.9, 0x2a2e38, 0, 0, 0, 0);
      f.box(0, 0.92, D * 0.1, W * 0.9, 0.01, D * 0.6, G, 1.2, PAT.screen);
      f.box(0, 1.15, -D / 2 + 0.1, W * 0.9, 0.5, 0.03, 0x101820); f.box(0, 1.18, -D / 2 + 0.12, W * 0.85, 0.44, 0.005, B, 1.2, PAT.screen);
      break;
    }
    // ── 전시 ──
    case 'plinth': case 'bigexhibit': {
      f.cyl(0, 0, 0, W / 2, F.t === 'plinth' ? 1.0 : 0.4, P, 0, PAT.stone, 0, 16);
      f.geo(torusG, 0, F.t === 'plinth' ? 1.0 : 0.4, 0, GOLD, 1.4, 0, 0, [W / 2, 1, W / 2]);
      slots.push({ x: 0, y: F.t === 'plinth' ? 1.4 : 1.6, z: 0, w: 0.5, d: 0.5, n: 1, exhibit: true });
      break;
    }
    case 'case': f.box(0, 0, 0, W, 0.8, D, P, 0, PAT.panel); f.box(0, 0.8, 0, W, 0.8, D, 0xbfefff, 0.06, PAT.glassfrost); f.box(0, 1.6, 0, W, 0.06, D, GOLD); slots.push({ x: 0, y: 0.9, z: 0, w: W * 0.6, d: D * 0.5, n: 1, exhibit: true }); break;
    // ── 주거·호텔 ──
    case 'bedpod': case 'bedpod1': {
      f.box(0, 0, 0, W, 0.35, D, st.soft ?? P, 0, PAT.panel);
      f.box(0, 0.35, 0, W - 0.1, 0.18, D - 0.1, 0xf6f2ec, 0, PAT.fabric);
      f.box(-W / 2 + 0.25, 0.53, 0, 0.35, 0.12, D * 0.6, 0xffffff, 0, PAT.fabric);
      // 잠 고치: 반쯤 덮는 빛 껍질
      f.geo(new THREE.CylinderGeometry(1, 1, 1, 16, 1, true, 0, Math.PI), -W * 0.1, 0.45, 0, st.cool ?? 0xa8d8ff, 0.12, PAT.glassfrost, Math.PI / 2, [D * 0.55, W * 0.8, 0.9]);
      f.box(-W / 2 + 0.02, 0.6, 0, 0.02, 0.04, D * 0.8, G, 1.4);
      break;
    }
    case 'washpod': f.cyl(0, 0, 0, Math.min(W, D) / 2, 0.1, pearl, 0, PAT.stone, 0, 16); f.cyl(0, 0.1, 0, Math.min(W, D) / 2 - 0.05, H - 0.2, 0xbfefff, 0.08, PAT.glassfrost, 0, 16); f.cyl(0, H - 0.1, 0, 0.25, 0.08, steel); break;
    case 'wc1': f.box(0, 0, -0.1, 0.45, 0.42, 0.55, pearl); f.box(0, 0.2, -D / 2 + 0.06, 0.45, 0.6, 0.12, pearl); break;
    case 'washer': f.box(0, 0, 0, W, H, D, pearl, 0, PAT.panel); f.geo(new THREE.TorusGeometry(0.28, 0.04, 6, 20), 0, H * 0.55, D / 2 + 0.01, G, 1.2); f.cyl(0, H * 0.55 - 0.25, D / 2 - 0.05, 0.25, 0.5, 0x9fdcf0, 0.2, PAT.glassfrost); break;
    // ── 생산·물류 ──
    case 'machine': case 'assembler': case 'kiln': case 'packer': {
      const c = F.t === 'kiln' ? 0x8a6a5a : steel;
      if (F.t === 'kiln') { f.cyl(0, 0, 0, W / 2, H * 0.8, c, 0, PAT.metal, 0, 16, W * 0.38); f.cyl(0, H * 0.8, 0, 0.4, 0.4, dark); f.geo(torusG, 0, H * 0.45, 0, 0xff7a3a, 2.4, 0, 0, [W / 2 + 0.02, 2, W / 2 + 0.02]); }
      else {
        f.box(0, 0, 0, W, 0.9, D, dark, 0, PAT.panel);
        f.box(0, 0.9, 0, W * 0.8, H - 1.2, D * 0.7, c, 0, PAT.metal);
        f.box(0, H - 0.3, 0, W * 0.9, 0.3, D * 0.8, B, 0, PAT.metal);
        if (F.t === 'assembler') for (let k = 0; k < 2; k++) f.box((k - 0.5) * W * 0.5, 1.2, D / 2, 0.15, 0.15, 0.8, 0xffb050, 0.4);
        f.box(W / 2 - 0.2, 1.2, D / 2 + 0.01, 0.3, 0.3, 0.01, G, 1.6, PAT.screen);
        f.geo(ringG, 0, H * 0.6, D / 2 + 0.02, F.t === 'packer' ? 0xffd27a : G, 1.8, 0, 0, [0.3, 0.3, 0.3]);
      }
      slots.push({ x: 0, y: F.t === 'kiln' ? H * 0.82 : 0.92, z: D / 2 - 0.2, w: 0.6, d: 0.4, n: 2 });
      break;
    }
    case 'conveyor': case 'sorter': f.box(0, 0, 0, W, 0.75, D, dark); f.box(0, 0.75, 0, W * 0.9, 0.06, D, 0x2a2e36, 0, PAT.rib); f.box(-W / 2, 0.8, 0, 0.04, 0.04, D, F.t === 'sorter' ? 0xffd27a : G, 1.6); f.box(W / 2, 0.8, 0, 0.04, 0.04, D, F.t === 'sorter' ? 0xffd27a : G, 1.6); break;
    case 'toolrack': f.box(0, 0.3, -D / 2 + 0.04, W, H - 0.3, 0.06, 0x5a6068, 0, PAT.rib); for (let k = 0; k < 6; k++) f.box((k - 2.5) * (W / 6), 0.9 + (k % 3) * 0.35, -0.05, 0.08, 0.4, 0.08, [0xffb050, steel, G][k % 3], k % 3 === 2 ? 1 : 0); break;
    case 'forklift': f.box(0, 0.3, 0.2, W, 0.9, D * 0.6, 0xffb050, 0, PAT.metal); f.box(0, 0, 0.2, W - 0.1, 0.3, D * 0.6, dark); f.box(0, 0.4, -D / 2 + 0.3, W * 0.8, 0.06, 0.8, steel); f.box(0, 0.4, -D / 2 + 0.7, W * 0.9, 1.6, 0.08, steel); f.geo(torusG, 0, 0.05, 0.2, G, 1.6, 0, 0, [0.5, 1, 0.8]); break;
    case 'dronepad': f.cyl(0, 0, 0, W / 2, 0.08, dark, 0, 0, 0, 24); f.geo(torusG, 0, 0.1, 0, 0xffd27a, 2, 0, 0, [W / 2 - 0.15, 1, W / 2 - 0.15]); break;
    // ── 교통 ──
    case 'gateline': for (let k = 0; k < 4; k++) { f.box((k - 1.5) * (W / 4), 0, 0, 0.18, H, D, P, 0, PAT.panel); f.box((k - 1.5) * (W / 4), H, 0, 0.18, 0.04, D, G, 1.6); } break;
    case 'ticketm': f.box(0, 0, 0, W, H, D, B, 0, PAT.metal); f.box(0, 1.0, D / 2 + 0.005, W * 0.7, 0.45, 0.01, 0x101820); f.box(0, 1.03, D / 2 + 0.01, W * 0.62, 0.38, 0.005, G, 1.4, PAT.screen); break;
    case 'departures': f.box(0, 1.0, 0, W, 1.2, D, 0x101820); f.box(0, 1.05, D / 2 + 0.005, W - 0.15, 1.1, 0.005, 0xffd27a, 1.3, PAT.screen); break;
    case 'bay': f.box(0, 0, 0, W, H, D, 0x5a6068, 0, PAT.stone); f.box(0, H, D / 2 - 0.15, W, 0.01, 0.1, 0xffd27a, 1.8); break;
    // ── 발전·농장 ──
    case 'core': f.cyl(0, 0, 0, W / 2, 0.6, dark, 0, 0, 0, 24); f.sph(0, 2.8, 0, 1.3, 0xffd9a0, 1.8); for (let k = 0; k < 3; k++) f.geo(new THREE.TorusGeometry(1.8 + k * 0.35, 0.06, 4, 32), 0, 2.8, 0, [0xffc46a, G, 0xff9fd0][k], 1.6, 0, k * 1.1); f.cyl(0, 4.8, 0, 0.6, 0.7, steel); break;
    case 'coil': f.cyl(0, 0, 0, W / 2, 0.3, dark, 0, 0, 0, 16); f.cyl(0, 0.3, 0, W * 0.3, H - 0.5, 0xb87333, 0, PAT.rib, 0, 16); for (let k = 0; k < 4; k++) f.geo(torusG, 0, 0.6 + k * 0.7, 0, G, 1.4, 0, 0, [W * 0.36, 1, W * 0.36]); break;
    case 'pump': f.box(0, 0, 0, W, 0.4, D, dark); f.cyl(-W * 0.2, 0.4, 0, 0.5, 1.0, steel, 0, PAT.metal, 0, 14); f.cyl(W * 0.3, 0.4, 0, 0.25, 1.3, 0x9fdcf0, 0.3, 0, 0, 10); break;
    case 'tank': case 'nutrient': f.cyl(0, 0, 0, W / 2, H, 0xd8e4e0, 0, PAT.metal, 0, 18); f.cyl(0, 0.3, 0, W / 2 + 0.01, H * 0.6, 0x7fe0a0, 0.25, PAT.glassfrost, 0, 18); break;
    case 'growrack': case 'growbed': {
      const lv = F.t === 'growrack' ? 3 : 1;
      for (let l = 0; l < lv; l++) {
        const y = F.t === 'growrack' ? 0.3 + l * 0.8 : 0.0;
        f.box(0, y, 0, W, F.t === 'growrack' ? 0.08 : 0.6, D, 0x6a5a48, 0, PAT.wood);
        f.box(0, y + (F.t === 'growrack' ? 0.08 : 0.6), 0, W - 0.1, 0.02, D - 0.1, 0x3a2a1a);
        if (F.t === 'growrack') f.box(0, y + 0.72, 0, W * 0.8, 0.03, D, 0xc06aff, 1.6);
        slots.push({ x: 0, y: y + (F.t === 'growrack' ? 0.1 : 0.62), z: 0, w: W - 0.2, d: D - 0.2, n: 8, crop: true });
      }
      break;
    }
    case 'hovercar': f.geo(capsG, 0, 0.75, 0, B, 0, PAT.metal, Math.PI / 2, [D * 0.7, 1.0, W * 0.9]); f.geo(capsG, 0, 1.05, -0.2, 0x101820, 0.1, 0, Math.PI / 2, [D * 0.4, 0.7, W * 0.7]); f.geo(torusG, 0, 0.25, 0, G, 1.4, 0, 0, [W * 0.4, 1, D * 0.4]); break;
    case 'mechunit': f.box(0, 0, 0, W, H, D, 0x8a929e, 0, PAT.rib); f.box(0, H * 0.7, D / 2 + 0.01, 0.3, 0.2, 0.01, G, 1.6); f.cyl(W * 0.3, H, 0, 0.18, 0.8, steel); break;
    case 'pooltub': f.box(0, 0, 0, W, H, D, 0xe8eef2, 0, PAT.wtile); f.box(0, H - 0.08, 0, W - 0.4, 0.02, D - 0.4, 0x5fc8e8, 0.45); break;
    case 'scope': f.cyl(0, 0, 0, 0.25, 1.0, steel); f.geo(capsG, 0, 1.25, 0, GOLD, 0, PAT.metal, 0, [0.9, 0.3, 0.3]); f.box(0, 1.25, 0.45, 0.1, 0.1, 0.01, G, 2); break;
    default: f.box(0, 0, 0, W, H, D, P, 0, PAT.panel);
  }
  return slots;
}
