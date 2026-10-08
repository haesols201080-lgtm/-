// 건물 안 (v0.9): 도시의 건물 문으로 들어가면 (로딩 화면을 거쳐) 바깥 세계와 떨어진 「실내 공간」으로 간다.
//  · 실내는 바깥 건물 속이 아니라 건물 바로 위 하늘 높이(POCKET_Y)에 따로 짓는다 — 가로 자리는 바깥 건물과 같은 x, z
//    (실내의 정문 = 바깥 문 그 자리), 높이는 층마다 실제 높이 차를 그대로 둔다. 들어가 있는 동안 바깥은 그리지 않고(engine.isolate),
//    땅·도시의 세부 단계는 문 앞 거리 기준(world.viewProxy), 하늘빛·고도 효과는 땅 높이 기준(engine.altOffset).
//  · 건물마다의 구조: interior/program(바깥 부피 → 층·쓰임·조직·빛깔) · core(계단·승강기) · layout(복도·방·문) ·
//    recipes/furnish(가구·장비) · render(모양·충돌체) · building(층 그리기·계단·승강기·문) · store(구조 저장)
//  · 건물이 하는 일(운영·일거리·물건)은 interior/ops, 실내의 사람은 interior/agents, 지도는 ui/imap.
//  · 착륙선 선실은 따로(cabin.js) — 같은 실내 공간 틀을 쓴다.
import * as THREE from 'three';
import { mulberry32 } from '../core/noise.js';
import { litMaterial } from '../world/materials.js';
import { audio } from '../core/audio.js';
import { buildCabin } from './cabin.js';
import { Indoor } from '../interior/building.js';
import { PlanStore } from '../interior/store.js';
import { facadeProfile } from '../interior/volume.js';
import { FUSE } from '../interior/catalog.js';
import { uidOf } from '../interior/ids.js';

const PREFIX = ['새벽', '물결', '은하', '고요', '바람', '윤슬', '별빛', '노을', '이슬', '하늘', '메아리', '푸른', '은빛', '첫눈', '꽃잎', '먼별'];
const PURPOSE = {
  home: { name: '주거탑', desc: '아웬 가족들이 사는 탑. 층마다 세대와 쉼터가 있다.', npc: 4 },
  hotel: { name: '쉼 호텔', desc: '먼 구역에서 온 이들이 묵어 가는 곳. 위층 객실에서 도시가 내려다보인다.', npc: 6 },
  lab: { name: '울림 연구동', desc: '물질의 노래를 듣고 설득하는 법을 연구한다.', npc: 3 },
  market: { name: '노래 시장', desc: '먹을 것·쓸 것을 고르고 계산대에서 울로 값을 치른다.', npc: 7 },
  school: { name: '노래 학교', desc: '아이들이 처음으로 자기 이름을 노래하는 곳.', npc: 6, small: true },
  heal: { name: '치유원', desc: '지친 울림을 고르게 다듬어 주는 곳. 접수·진료·검사·입원.', npc: 3 },
  garden: { name: '하늘 정원', desc: '건물 한가운데를 숲으로 채운 정원.', npc: 4 },
  farm: { name: '재배원', desc: '빛잎·열매·꽃꿀을 기르는 실내 농장. 거둔 것은 창고로 간다.', npc: 4 },
  hall: { name: '공연장', desc: '동네 합창단이 저녁마다 노래한다.', npc: 6 },
  admin: { name: '행정청', desc: '이웃의 일을 맡아 처리하는 곳. 민원 창구와 의회실.', npc: 5 },
  office: { name: '사무탑', desc: '도시의 일을 나누어 맡는 회사들이 층마다 있다.', npc: 5 },
  library: { name: '서고', desc: '결정에 담긴 옛 노래를 빌려 가는 곳.', npc: 3 },
  factory: { name: '빚음 공방', desc: '원료를 노래로 설득해 쓸 것을 빚는다. 원료 → 공정 → 완성품 → 물류.', npc: 5 },
  depot: { name: '물류 창고', desc: '도시 곳곳으로 갈 짐을 모으고 나누는 곳.', npc: 5 },
  terminal: { name: '교통 터미널', desc: '호버 차와 하늘배를 갈아타는 곳.', npc: 7 },
  cafe: { name: '찻집', desc: '김이 노래하는 차와 든든한 한 상을 짓는 곳.', npc: 6 },
  museum: { name: '박물관', desc: '아웬의 옛 물건과 노래를 모아 둔 곳.', npc: 5 },
  plant: { name: '공명 발전소', desc: '도시의 빛을 만드는 핵. 일꾼들이 출력을 맞춘다.', npc: 4 },
};
const BY_STYLE = {
  civic: ['hall', 'lab', 'garden', 'school', 'admin'],
  commerce: ['market', 'market', 'home', 'hall', 'hotel'],
  transit: ['market', 'lab', 'hall', 'hotel'],
  residential: ['home', 'home', 'school', 'garden', 'heal'],
  research: ['lab', 'lab', 'school', 'heal'],
  energy: ['lab', 'lab', 'hall'],
  bioindustry: ['garden', 'lab', 'market', 'heal'],
  capital: ['lab', 'home', 'market', 'heal', 'hall', 'garden', 'home', 'lab', 'admin'],
  highrise: ['home', 'lab', 'home', 'market', 'heal', 'hall', 'hotel'],
  garden: ['garden', 'school', 'home', 'garden'],
  suburb: ['home', 'home', 'school', 'market', 'garden'],
  village: ['home', 'home', 'school', 'market'],
  glass: ['lab', 'home', 'market', 'hall'],
  bloom: ['garden', 'home', 'heal', 'school'],
  canyon: ['home', 'market', 'lab', 'school'],
  sea: ['home', 'market', 'heal'],
  frost: ['home', 'lab', 'heal'],
};
/** 실내 공간의 바닥 높이 — 바깥 세계(산 2 km·거대 탑 2.3 km·구름)보다 높고 하늘닻(30 km)보다 낮은 빈 하늘 */
export const POCKET_Y = 8000;

export class Interiors {
  constructor(game) {
    this.game = game;
    this.city = game.city;
    this.cur = null;
    this.store = new PlanStore(game);
    // 선실·옛 시설이 쓰는 공용 재질
    this.mat = litMaterial({ vertexColors: true, vertexEmit: true, emissive: 0xffffff, emissiveIntensity: 1.3, emissiveNight: 0.45, rim: 0.15, spec: 0.8, side: THREE.DoubleSide, tech: { scale: 1.1, glow: 0.9, metal: 0.35, mode: 0 } });
    this.t = 0;
  }

  // ── 건물 정보 ─────────────────────────────
  info(r) {
    if (r.info) return r.info;
    const rnd = mulberry32(Math.floor(r.seed * 1e9));
    const tall = (r.top - r.gy) > 55;
    const farmKind = ['vfarm', 'greenhouse', 'biodome'].includes(r.kind);
    const civic = ['civic', 'capital'].includes(r.style);
    const byUse = {
      home: tall && ['commerce', 'capital', 'highrise', 'transit', 'glass'].includes(r.style) ? ['home', 'home', 'hotel'] : ['home'],
      office: civic ? ['office', 'office', 'lab', 'admin'] : ['office', 'office', 'lab'],
      market: ['market', 'market', 'cafe'], school: ['school'], heal: ['heal'], library: ['library'],
      hall: civic ? ['hall', 'museum', 'admin'] : ['hall', 'museum'], factory: ['factory'], depot: ['depot'], lab: ['lab'], terminal: ['terminal'],
      garden: farmKind ? ['farm', 'farm', 'garden'] : ['garden'], cafe: ['cafe'], museum: ['museum'], plant: ['plant'],
    };
    const list = byUse[r.use] || BY_STYLE[r.style] || BY_STYLE.capital;
    const pid = list[Math.floor(rnd() * list.length)];
    const P = PURPOSE[pid];
    const floors = Math.max(1, Math.floor((r.top - r.gy) / 3.6));
    r.info = { pid, P, name: r.name || (r.custom && pid === 'home' ? `${PREFIX[Math.floor(rnd() * PREFIX.length)]} 꽃잎 집` : `${PREFIX[Math.floor(rnd() * PREFIX.length)]} ${P.name}`), floors, people: r.custom ? (pid === 'home' ? 3 + Math.floor(rnd() * 4) : 6 + Math.floor(rnd() * 8)) : floors * (pid === 'home' ? 30 + Math.floor(rnd() * 40) : 8 + Math.floor(rnd() * 20)) };
    return r.info;
  }
  /** 모양의 외벽 띠 (창 격자 → 층 높이) */
  profile(kind) { const A = this.city && this.city.arch; return facadeProfile(kind, A && A[kind] && A[kind].hi); }
  /** 건물 짜임 (처음이면 만든다) */
  plan(r) { return this.store.plan(r); }
  /**
   * 건물의 대표 이름 = 그 건물을 운영하는 대표 조직의 이름 (문 앞 표지·공중다리 표지·건물 안 지도·단말이 모두 같은 이름).
   * 짜임이 아직 없으면 여기서 만든다(지연 생성 · 저장되니 한 건물에 한 번) — 문 앞에서는 임시 이름, 안에서는 조직 이름처럼 갈리지 않게.
   */
  title(r) {
    if (this.game.state.home === r.id) return '우리 집';
    const I = this.info(r);
    let B = null;
    try { B = r.door ? this.store.plan(r) : null; } catch { B = null; }
    if (B && B.mainOrg) { const o = B.orgs.find((q) => q.id === B.mainOrg); if (o && o.op !== 'home') return o.name; }
    return I.name;
  }

  // ── 열기·닫기 ─────────────────────────────
  open(r) {
    if (this.cur && this.cur.r === r) return;
    if (this.cur) this.close();
    const info = this.info(r);
    const ind = new Indoor(this, r, POCKET_Y);
    const B = ind.B;
    const cur = { r, info, indoor: ind, B, fy: POCKET_Y, cols: [], meshes: [], npcs: [], anims: [], key: uidOf(r), uid: uidOf(r), LH: 3 };
    this.cur = cur;
    // 정문 (실내 쪽): 1층 평면의 정문 칸
    const pl = ind.plan(B.ground);
    const e = pl && pl.L.ents.main;
    if (e) {
      const G = B.G, i = e.c % G.gw, j = (e.c / G.gw) | 0;
      const gx = G.ox + i + 0.5 + e.dir[0] * 0.5, gz = G.oz + j + 0.5 + e.dir[1] * 0.5;
      const [x, z] = ind.world(gx, gz);
      const nx = e.dir[0] * ind.V.ex[0] + e.dir[1] * ind.V.ez[0], nz = e.dir[0] * ind.V.ex[1] + e.dir[1] * ind.V.ez[1];
      cur.door = { x, z, nx, nz };
    } else cur.door = { x: r.door.x, z: r.door.z, nx: r.door.nx, nz: r.door.nz };
    // 처음 지을 셀: 정문 안쪽(플레이어가 설 자리)이 드는 공간
    ind.setFloor(B.ground, cur.door.x - cur.door.nx * 3.2, cur.door.z - cur.door.nz * 3.2);
    cur.LH = B.floors[B.ground].ic ?? B.floors[B.ground].ceil - B.floors[B.ground].y;
    if (this.game.ops) this.game.ops.open(cur);
  }

  close() {
    this._dbgPlan = null;
    const cur = this.cur;
    if (!cur) return;
    const g = this.game, C = g.world.colliders;
    if (this.inPocket) this._pocket(false);
    if (g.ops && cur.indoor) g.ops.close(cur);
    if (cur.indoor) cur.indoor.close();
    for (const c of cur.cols) C.remove(c);
    for (const n of cur.npcs) g.npcs.remove(n);
    if (g.citizens) g.citizens.clearIndoor();
    if (g.venues) g.venues.clear();
    this.guest = null;
    if (cur.group) {
      g.engine.scene.remove(cur.group);
      const keep = new Set([this.mat]);
      cur.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material && !keep.has(o.material) && o.material.dispose) o.material.dispose(); });
    }
    this.store.flush();
    this.cur = null;
  }

  /** 실내에 들어가 있는 동안: 바깥 세계는 그리지 않고, 세부 단계와 하늘빛은 문 앞 거리 높이 기준 */
  _pocket(on) {
    const g = this.game, cur = this.cur;
    this.inPocket = on;
    g.player.indoor = on;
    g.rig.floorLock = on && cur ? (cur.indoor ? cur.indoor.yOf(cur.indoor.cur) : cur.fy) : null;
    if (on && cur) {
      const r = cur.r;
      g.engine.altOffset = POCKET_Y - r.floorY;
      g.world.viewProxy = new THREE.Vector3(r.door.x + r.door.nx * 4, r.floorY + 1.6, r.door.z + r.door.nz * 4);
      g.engine.isolate((o) => o.userData.indoor || o.isLight);
    } else {
      g.engine.altOffset = 0;
      g.world.viewProxy = null;
      g.engine.unisolate();
    }
  }

  // ── 행동 ─────────────────────────────────
  /** 로딩 화면: 어두워지는 동안 일을 하고, 한 박자 쉬었다 밝아진다 */
  _load(fn, title, sub, after) {
    const g = this.game;
    if (this._busy) return;
    this._busy = true;
    g.setMode('cinematic');
    g.ui.loading(true, title, sub);
    g.ui.fade(true, true);
    audio.noise({ freq: 700, q: 0.6, dur: 1.6, gain: 0.3, type: 'bandpass', sweep: 2400, attack: 0.4 });
    setTimeout(() => {
      try { fn(); } catch (e) { console.error('[interiors]', e); }
      setTimeout(() => {
        g.ui.fade(false, true); g.ui.loading(false); g.setMode('play'); this._busy = false;
        if (after) after();
      }, 650);
    }, 650);
  }

  _placeIn(cur) {
    const g = this.game, p = g.player, d = cur.door;
    const k = cur.cabin ? 1.3 : 3.2; // 건물: 정문 안쪽 3.2 m (카메라가 문 쪽 벽에 눌리지 않게)
    p.teleport(d.x - d.nx * k, (cur.indoor ? cur.indoor.yOf(cur.B.ground) : cur.fy) + 0.3, d.z - d.nz * k, 0.1);
    p.yaw = Math.atan2(-d.nx, -d.nz);
    g.rig.yaw = p.yaw + Math.PI;
    g.rig.pitch = -0.12;
    g.rig._init = false;
  }

  /** 실내의 한 자리로 옮기기 (층 i, 세계 x, z, 바라볼 방향 yaw(세계)) */
  placeAt(i, x, z, yaw) {
    const g = this.game, ind = this.cur && this.cur.indoor;
    if (!ind) return;
    ind.setFloor(i, x, z);
    // 그 자리가 이 층의 걸을 수 있는 칸이 아니면 (구조가 바뀌었거나 가구 속) 승강기 홀로
    if (!ind.inside(i, x, z)) {
      const pl = ind.plan(i), L = pl && pl.L;
      const R = L && (L.lifthall != null && L.rooms[L.lifthall].n ? L.rooms[L.lifthall] : L.rooms.find((q) => q.circ && q.n) || L.rooms.find((q) => q.n && !['lift', 'cargo', 'shaft', 'stair'].includes(q.type)));
      if (R) { [x, z] = ind.world(ind.B.G.ox + R.cx + 0.5, ind.B.G.oz + R.cz + 0.5); ind.setFloor(i, x, z); }
    }
    g.player.teleport(x, ind.yOf(i) + 0.3, z, 0.1);
    if (yaw != null) { g.player.yaw = yaw; g.rig.yaw = yaw + Math.PI; }
    g.rig._init = false;
    g.rig.floorLock = ind.yOf(i);
  }

  /** 착륙선 선실로 (해치에서): 건물처럼 바깥과 떨어진 실내 공간 — game/cabin.js */
  enterCabin(L) {
    const g = this.game;
    if (this._busy || !L) return;
    const [hx, hz] = L.W(0, 2.6);
    const sn = Math.sin(L.ry), cs = Math.cos(L.ry);
    const r = { x: L.X, z: L.Z, door: { x: hx, z: hz, nx: sn, nz: cs }, floorY: L.Y + 1.15, zone: 'lander', kind: 'lander', idx: 0, seed: 0.5, base: L.Y, sy: 4.3, top: L.Y + 4.4, sx: 3, sz: 3, gy: L.Y, cabin: true };
    r.info = { pid: 'cabin', P: { name: '착륙선 선실', desc: '라르크 2 의 선실' }, name: '착륙선 「라르크 2」', floors: 1, people: 1 };
    this._load(() => {
      if (this.cur) this.close();
      const fy = POCKET_Y;
      const cab = buildCabin(this, g, { x: L.X, z: L.Z, fy });
      this.cur = { r, info: r.info, plan: cab.plan, LH: cab.LH, fy, door: cab.door, cols: cab.cols, meshes: [], npcs: [], anims: cab.anims, deck: null, cabin: cab, group: cab.group, layout: { name: '선실' }, pal: {}, key: 'lander' };
      this._placeIn(this.cur);
      this._pocket(true);
    }, '착륙선 「라르크 2」', '선실 · 모아와 이어진 교신 단말', () => {
      g.ui.regionTitle('착륙선 선실', '라르크 2 · 조종석 · 교신 단말 · 별지도', false);
      if (!g.state.flags.cabinSeen) { g.state.flags.cabinSeen = true; setTimeout(() => g.ui.moa('어서 와요. 선실 단말에선 제 목소리가 제일 깨끗해요. 별지도도 한번 봐 줘요 — 라르크 호가 지나온 길이에요.'), 1500); }
    });
  }

  /** 바깥 문에서 들어가기 (또는 테라스·옥상 문: o = { floor, at: [x,z] }) */
  enter(r, o = {}) {
    const g = this.game;
    if (this._busy || (this.inPocket && this.cur && this.cur.r === r)) return;
    const I = this.info(r);
    const mine = g.state.home === r.id;
    const key = uidOf(r);
    const rooms = g.state.rooms || (g.state.rooms = {});
    const rm = rooms[key] || (rooms[key] = { v: 0, d: g.world.clock.day });
    rm.v++;
    const title = mine ? '우리 집' : this.title(r), sub = mine ? '하모네아가 내어 준 집' : I.P.desc;
    this._load(() => {
      this.open(r);
      const cur = this.cur;
      const Fo = o.floor != null ? cur.B.floors[o.floor] : null;
      if (Fo && Fo.reach && !Fo.dead && o.at) this.placeAt(o.floor, o.at[0], o.at[1], o.yaw);
      else this._placeIn(cur);
      this._pocket(true);
      if (g.ops) g.ops.entered(cur);
    }, title, sub, () => {
      const cur = this.cur;
      if (!cur || !cur.B) return;
      const B = cur.B;
      const above = B.floors.filter((F) => !F.below && !F.mezz).length, below = B.floors.filter((F) => F.below).length;
      const uses = [...new Set(B.zones.map((Z) => FUSE[Z.use] && FUSE[Z.use].name).filter(Boolean))].slice(0, 4).join('·');
      const kind = B.special ? `${B.special} 건물 (한 기관이 전체를 쓴다)` : B.orgs.length > 2 ? `복합 건물 · 조직 ${B.orgs.length}` : uses;
      g.ui.regionTitle(mine ? '우리 집' : this.title(r), `지상 ${above}층${below ? ` · 지하 ${below}층` : ''} · ${kind}${B.special || B.orgs.length > 2 ? ` · ${uses}` : ''} · ${rm.v === 1 ? '처음 와 본 곳' : `${rm.v}번째 들름`}`, false);
      if (mine && !g.state.flags.homeVisit) { g.state.flags.moaIndoor = true; g.setFlag('homeVisit'); setTimeout(() => g.ui.moa('…여기가 우리 집이에요. 이웃들이 벌써 문패에 우리 이름 노래를 새겨 놨어요. 지친 날엔 여기서 쉬어요.'), 1600); }
      if (!g.state.flags.moaIndoor) { g.state.flags.moaIndoor = true; setTimeout(() => g.ui.moa('안으로 들어왔어요! 층마다 안내판이 있고, 지도(M)를 열면 이 건물의 층 지도가 나와요. 나갈 때는 들어온 문 앞에서 E.'), 1600); }
      if (g.tips) g.tips.show('indoor');
    });
  }

  exit(to = null) {
    const cur = this.cur, g = this.game, p = g.player;
    if (!cur || this._busy) return;
    const r = cur.r;
    this._load(() => {
      this.close();
      if (to) {
        p.teleport(to.x, to.y + 0.3, to.z);
        if (to.yaw != null) p.yaw = to.yaw;
      } else {
        p.teleport(r.door.x + r.door.nx * 7, r.floorY + 1.5, r.door.z + r.door.nz * 7);
        p.yaw = Math.atan2(r.door.nx, r.door.nz);
      }
      g.rig.yaw = p.yaw + Math.PI;
      g.rig.pitch = -0.12;
      g.rig._init = false;
    }, to ? to.title || '바깥으로' : '밖으로', this.title(r));
  }

  // ── 승강기 ─────────────────────────────────
  /** 승강기 문 앞에서: 이 승강기가 서는 층을 골라 탄다 */
  liftPanel(lift) {
    const g = this.game, cur = this.cur, ind = cur.indoor, B = cur.B;
    const lk = B.links.find((k) => k.id === lift.link);
    if (!lk) return;
    const here = ind.cur;
    const items = lk.floors.slice().sort((a, b) => b - a).map((i) => {
      const F = B.floors[i];
      const Z = B.zones[F.zone];
      const org = Z && Z.org ? B.orgs.find((o) => o.id === Z.org) : null;
      return { label: `${F.label}층 · ${FUSE[F.use] ? FUSE[F.use].name : F.use}${i === here ? ' (여기)' : ''}`, sub: org ? org.name : F.below ? '지하' : ' ', disabled: i === here, onClick: () => this.ride(lift, i) };
    });
    g.ui.serviceCard(lift.cargo ? '화물 승강기' : lk.bank === 'high' ? '승강기 · 높은층 급행' : lk.bank === 'low' ? '승강기 · 낮은층' : '승강기', '몇 층으로 갈까요?', lift.cargo ? '짐과 함께 타는 넓은 칸. 일하는 사람이 쓴다.' : '공명 부양 칸이 조용히 오르내린다.', items);
  }
  ride(lift, to) {
    const g = this.game, cur = this.cur, ind = cur.indoor, B = cur.B;
    const from = ind.cur;
    const F = B.floors[to];
    audio.blip && audio.blip({ hz: 520, to: 780, dur: 0.25, gain: 0.08 });
    const dist = Math.abs(F.y - B.floors[from].y);
    this._load(() => {
      ind.setFloor(to);
      const out = ind.built.get(to);
      const L = out && out.lifts.find((q) => q.link === lift.link);
      const f = L ? L.front : lift.front;
      const lx = (L ? L.x : lift.x) + f[0] * 1.4, lz = (L ? L.z : lift.z) + f[1] * 1.4;
      const [x, z] = ind.world(lx, lz);
      const wx = f[0] * ind.V.ex[0] + f[1] * ind.V.ez[0], wz = f[0] * ind.V.ex[1] + f[1] * ind.V.ez[1];
      this.placeAt(to, x, z, Math.atan2(wx, wz));
      if (L) { L.open = 1; L.want = 1; setTimeout(() => { L.want = 0; }, 3000); }
      if (g.ops) g.ops.floorChanged(to);
    }, `${F.label}층`, `${FUSE[F.use] ? FUSE[F.use].name : ''} · ${Math.round(dist)} m ${to > from ? '올라감' : '내려감'}`);
  }

  /** 테라스·옥상으로 나가기: 바깥의 실제 단·지붕 위로 */
  outTo(kind, F, at, yaw) {
    const cur = this.cur, ind = cur.indoor, B = cur.B, r = cur.r;
    const [x, z] = ind.worldExt(at[0], at[1]); // 바깥의 실제 단·지붕·다리 자리 (실내 배율을 걷어 낸)
    const y = kind === 'roof' ? B.roof.y : kind === 'bridge' ? F.y : F.terrace.y;
    const name = kind === 'roof' ? '옥상' : kind === 'bridge' ? '공중다리' : '테라스';
    // 공중다리는 양쪽 끝이 모두 문이라(bridgeAt) 따로 기억하지 않는다
    this.outside = kind === 'bridge' ? null : { r, floor: F.i, at: [x, z], kind, y };
    this.exit({ x, y: y + 0.1, z, yaw, title: name });
    setTimeout(() => this.game.ui.toast(kind === 'bridge' ? '공중다리로 나왔다 · 유리 통로 끝의 문 앞에서 E — 건너편 탑이나 다시 이 탑으로' : `${name}로 나왔다 · 다시 들어갈 때는 나온 문 앞에서 E`, {}), 1500);
    if (kind === 'roof' && this.game.setFlag) this.game.setFlag('liftTop');
    if (kind === 'bridge') { if (this.game.setFlag) this.game.setFlag('skyBridge'); if (this.game.scan) this.game.scan('c_bridge'); }
  }

  /** 공중다리 끝에서 들어갈 층과 자리 (그 탑의 짜임에서: 다리 높이 층의 공중다리 문 안쪽) */
  bridgeEntry(r, bi) {
    const B = this.store.plan(r);
    if (!B) return null;
    const F = B.floors.find((q) => q.bridges && q.bridges.some((b) => b.bi === bi));
    if (!F || !F.reach || F.dead) return null;
    const pl = this.store.floor(r, F.i);
    const e = pl && pl.L.ents.bridge && pl.L.ents.bridge.find((q) => q.bi === bi);
    if (!e) return null;
    const G = B.G, V = B.V;
    const gx = G.ox + (e.c % G.gw) + 0.5 - e.dir[0] * 0.9, gz = G.oz + ((e.c / G.gw) | 0) + 0.5 - e.dir[1] * 0.9;
    const at = [r.x + gx * V.ex[0] + gz * V.ez[0], r.z + gx * V.ex[1] + gz * V.ez[1]];
    // 들어서면 탑 안쪽(문 반대쪽)을 본다
    const wx = -(e.dir[0] * V.ex[0] + e.dir[1] * V.ez[0]), wz = -(e.dir[0] * V.ex[1] + e.dir[1] * V.ez[1]);
    return { floor: F.i, at, yaw: Math.atan2(wx, wz), label: F.label };
  }

  // ── 상호작용 ───────────────────────────────
  target(p) {
    const cur = this.cur;
    if (cur && this.inPocket && cur.cabin) {
      if (Math.hypot(p.x - cur.door.x, p.z - cur.door.z) < 1.9) return { kind: 'exit', label: '해치 · 밖으로 나가기', short: '나가기' };
      let best = null, bd = 1e9;
      for (const st of cur.cabin.stations) { const d = Math.hypot(p.x - st.at[0], p.z - st.at[1]); if (d < st.r && d < bd) { bd = d; best = st; } }
      return best ? { kind: 'lander', o: best, label: best.label, short: best.short } : null;
    }
    if (cur && this.inPocket && cur.indoor) {
      const ind = cur.indoor, B = cur.B;
      const i = ind.cur;
      const fy = ind.yOf(i);
      const out = ind.built.get(i);
      if (!out) return null;
      // 옥상 문 (계단 꼭대기)
      for (const S of out.stairs) if (S.roofDoor) {
        const [x, z] = ind.world(S.roofDoor[0], S.roofDoor[1]);
        if (Math.hypot(p.x - x, p.z - z) < 1.6 && p.y > fy + S.roofY - 1.5) return { kind: 'roofdoor', o: { S, F: B.floors[i] }, label: '옥상 문 · 지붕 위로 나가기', short: '옥상' };
      }
      if (Math.abs(p.y - fy) > 2.6) return null;
      if (i === B.ground && Math.hypot(p.x - cur.door.x, p.z - cur.door.z) < 2.6) return { kind: 'exit', label: '정문 · 밖으로 나가기', short: '나가기' };
      // 승강기 문과 공중다리 문이 둘 다 가까우면 더 가까운 쪽 (다리 문 바로 옆에 승강기 홀이 있는 층)
      let near = null, nd = 1e9;
      for (const L of out.lifts) {
        if (!L.stops) continue;
        const [x, z] = ind.world(L.x + L.front[0] * 0.8, L.z + L.front[1] * 0.8);
        const d = Math.hypot(p.x - x, p.z - z);
        if (d < 1.7 && d < nd) { nd = d; near = { kind: 'ilift', o: L, label: `${L.cargo ? '화물 승강기' : '승강기'} · 층 고르기`, short: '승강기' }; }
      }
      const inCellC = (c) => !out.cellRooms || out.cellRooms.has(out.roomX[c] - 1); // 그 문이 지금 셀의 방에 있나
      for (const e of out.L.ents.bridge || []) {
        if (!inCellC(e.c)) continue;
        const G = B.G, ti = e.c % G.gw, tj = (e.c / G.gw) | 0;
        const [x, z] = ind.world(G.ox + ti + 0.5 + e.dir[0] * 0.4, G.oz + tj + 0.5 + e.dir[1] * 0.4);
        const d = Math.hypot(p.x - x, p.z - z);
        if (d < 2.0 && d < nd) {
          const BL = this.city.bridgeList && this.city.bridgeList[e.bi];
          const other = BL ? (BL.a === cur.r ? BL.b : BL.a) : null;
          nd = d;
          near = { kind: 'bridge', o: { F: B.floors[i], at: [G.ox + ti + 0.5 + e.dir[0] * 2.4, G.oz + tj + 0.5 + e.dir[1] * 2.4], dir: e.dir, BL }, label: `공중다리 · ${other ? `건너편 「${this.title(other)}」` : '건너편 탑'}으로`, short: '공중다리' };
        }
      }
      if (near) return near;
      const T = out.L.ents.terrace;
      if (T && inCellC(T.c)) {
        const G = B.G, ti = T.c % G.gw, tj = (T.c / G.gw) | 0;
        const [x, z] = ind.world(G.ox + ti + 0.5 + T.dir[0] * 0.5, G.oz + tj + 0.5 + T.dir[1] * 0.5);
        if (Math.hypot(p.x - x, p.z - z) < 1.8) return { kind: 'terrace', o: { F: B.floors[i], at: [G.ox + ti + 0.5 + T.dir[0] * 1.6, G.oz + tj + 0.5 + T.dir[1] * 1.6] }, label: '테라스 문 · 바깥 단으로 나가기', short: '테라스' };
      }
      return null;
    }
    // 바깥: 테라스·옥상에서 다시 들어가는 문
    const o = this.outside;
    if (o && Math.hypot(p.x - o.at[0], p.z - o.at[1]) < 2.4 && Math.abs(p.y - o.y) < 3) return { kind: 'reenter', o, label: `${o.kind === 'roof' ? '옥상' : '테라스'} 문 · 안으로 들어가기`, short: '들어가기' };
    // 공중다리 끝: 닿은 탑의 공중다리 문
    const bd = this.city.bridgeAt && this.city.bridgeAt(p.x, p.y, p.z);
    if (bd) {
      const BL = bd.B, r = bd.end;
      if (Math.abs(bd.along) > BL.half - this._faceIn(r, BL) - 3.2) {
        const e = this.bridgeEntry(r, this.city.bridgeList.indexOf(BL));
        if (e) return { kind: 'bridgein', o: { r, e }, label: `공중다리 문 · 「${this.title(r)}」 ${e.label}층으로 들어가기`, short: '들어가기' };
      }
    }
    const d = this.city.nearestDoor(p.x, p.z, 3.4);
    if (d && Math.abs(p.y - d.floorY) < 3) return { kind: 'door', o: d, dist: Math.hypot(p.x - d.door.x, p.z - d.door.z), label: `${this.title(d)} · 들어가기`, short: '들어가기' };
    return null;
  }
  /** game._interact 가 부르는 실내 행동 */
  use(t) {
    if (t.kind === 'ilift') return this.liftPanel(t.o);
    if (t.kind === 'roofdoor') return this.outTo('roof', t.o.F, t.o.S.roofDoor);
    if (t.kind === 'terrace') return this.outTo('terrace', t.o.F, t.o.at);
    if (t.kind === 'bridge') {
      const { BL, F } = t.o, r = this.cur.r;
      if (BL) {
        // 다리 가운데 줄 위, 이 탑 바깥벽에서 1.6 m — 건너편을 보고 선다
        const sx = r === BL.a ? -1 : 1, along = sx * Math.max(0, BL.half - this._faceIn(r, BL) - 1.6);
        const x = BL.mx + BL.ux * along, z = BL.mz + BL.uz * along;
        const [gx, gz] = this.cur.indoor.gridExt(x, z);
        return this.outTo('bridge', F, [gx, gz], Math.atan2(-sx * BL.ux, -sx * BL.uz));
      }
      const V = this.cur.indoor.V, [dx, dz] = t.o.dir;
      return this.outTo('bridge', F, t.o.at, Math.atan2(dx * V.ex[0] + dz * V.ez[0], dx * V.ex[1] + dz * V.ez[1]));
    }
    if (t.kind === 'bridgein') { const { r, e } = t.o; return this.enter(r, { floor: e.floor, at: e.at, yaw: e.yaw }); }
    if (t.kind === 'reenter') { const o = t.o; this.outside = null; return this.enter(o.r, { floor: o.floor, at: this._reentryPoint(o) }); }
    return null;
  }
  /** 다리 끝이 탑 속으로 들어간 깊이 (다리 가운데에서 끝까지 half 중 탑 바깥벽 안쪽 몫) — 처음 한 번 재 둔다 */
  _faceIn(r, BL) {
    const key = r === BL.a ? 'inA' : 'inB';
    if (BL[key] != null) return BL[key];
    const sx = r === BL.a ? -1 : 1;
    const inCol = (c, x, z) => {
      if (c.type === 'cyl') return Math.hypot(x - c.x, z - c.z) < c.r;
      const dx = x - c.x, dz = z - c.z, cs = Math.cos(c.rot || 0), sn = Math.sin(c.rot || 0);
      return Math.abs(dx * cs - dz * sn) < c.hx && Math.abs(dx * sn + dz * cs) < c.hz;
    };
    // 다리 끝 쪽으로 걸어가며 탑 충돌체(다리 높이 +1 m) 안에 처음 드는 곳
    let d = 0;
    for (let t = 0; t <= BL.half; t += 0.25) {
      const x = BL.mx + BL.ux * sx * t, z = BL.mz + BL.uz * sx * t;
      if (r.cols && r.cols.some((c) => c.y0 <= BL.y + 1 && c.y1 >= BL.y + 1 && inCol(c, x, z))) { d = BL.half - t; break; }
    }
    BL[key] = d;
    return d;
  }
  _reentryPoint(o) {
    const B = this.store.plan(o.r);
    const pl = this.store.floor(o.r, o.floor);
    const G = B.G, V = B.V;
    const toW = (gx, gz) => [o.r.x + gx * V.ex[0] + gz * V.ez[0], o.r.z + gx * V.ex[1] + gz * V.ez[1]];
    if (o.kind === 'terrace' && pl.L.ents.terrace) { const T = pl.L.ents.terrace; return toW(G.ox + (T.c % G.gw) + 0.5 - T.dir[0] * 0.8, G.oz + ((T.c / G.gw) | 0) + 0.5 - T.dir[1] * 0.8); }
    // 옥상: 계단참
    const hall = pl.L.lifthall != null ? pl.L.rooms[pl.L.lifthall] : null;
    if (hall) return toW(G.ox + hall.cx + 0.5, G.oz + hall.cz + 0.5);
    return o.at;
  }

  // ── 매 프레임 ─────────────────────────────
  update(dt) {
    if (this._dbgPlan != null && this.cur && this.cur.indoor) for (const [j, o] of this.cur.indoor.built) { if (o.ceilMesh) o.ceilMesh.visible = false; o.group.visible = j === this._dbgPlan; }
    const g = this.game, p = g.player.pos;
    this.t += dt;
    const cur = this.cur;
    if (this.outside && !cur) { const o = this.outside; if (Math.hypot(p.x - o.at[0], p.z - o.at[1]) > 400 || Math.abs(p.y - o.y) > 200) this.outside = null; }
    if (!cur) return;
    for (const f of cur.anims) f(this.t);
    if (this.inPocket && cur.indoor) {
      const ind = cur.indoor;
      ind.update(dt);
      // 계단실에서는 카메라가 층에 묶이지 않는다 (오르내리는 동안 따라 오르내림)
      g.rig.floorLock = ind.stairCell ? null : ind.yOf(ind.cur);
      const fy = ind.yOf(ind.cur);
      this._safety(dt, ind, p, fy);
      if (p.y < fy - 5 || p.y < POCKET_Y - 60) this._rescue();
      return;
    }
    if (this.inPocket && cur.cabin) {
      if (p.y < cur.fy - 4) this._placeIn(cur);
      return;
    }
    if (!this._busy) this.close();
  }
  /**
   * 최후 안전장치 (v24 · 문서 P0 「벽 관통 및 공허 추락」): 땅에 선 채 지금 셀의 걸을 수 있는 칸에 있으면 0.4 초마다 「안전한 자리」로 기억하고,
   * 셀 밖(벽 속·바깥 공허)에 0.35 초 넘게 있거나 바닥 아래로 떨어지면 그 자리로 되돌린다. 일어난 자리는 기록해 원인을 계속 고친다
   * (state.debug.escapes — 근본 버그를 숨기는 대체책이 아니라 마지막 그물).
   */
  _safety(dt, ind, p, fy) {
    const g = this.game, pl = g.player;
    const ok = ind.inside(ind.cur, p.x, p.z) || ind.stairCell || this._nearPortal(ind, p);
    if (ok && pl.state === 'ground' && Math.abs(p.y - fy) < 2.2) {
      this._safeT = (this._safeT || 0) + dt;
      if (this._safeT > 0.4) { this._safeT = 0; this._safe = { x: p.x, y: p.y, z: p.z, floor: ind.cur, key: ind.cellKey }; }
    }
    this._outT = ok && p.y > fy - 1.5 ? 0 : (this._outT || 0) + dt;
    if (this._outT > 0.35 && !this._busy) {
      this._outT = 0;
      const s = this._safe;
      const st = g.state.debug || (g.state.debug = {});
      (st.escapes || (st.escapes = [])).push({ uid: this.cur.uid, floor: ind.cur, key: ind.cellKey, x: +p.x.toFixed(2), y: +(p.y - fy).toFixed(2), z: +p.z.toFixed(2), t: Date.now() });
      if (st.escapes.length > 40) st.escapes.splice(0, st.escapes.length - 40);
      console.warn('[interiors] 셀 밖으로 나감 — 안전한 자리로', this.cur.uid, ind.cellKey, p.x.toFixed(1), (p.y - fy).toFixed(2), p.z.toFixed(1));
      if (s && s.floor != null) { if (s.key && s.key !== ind.cellKey) { ind.cur = s.floor; ind.setCell(s.key); } pl.teleport(s.x, s.y, s.z, 0.1); }
      else this._rescue();
    }
  }
  /** 문턱 바로 앞(문 너머 어두운 깊이 쪽) — 넘어가는 중이면 셀 밖이어도 괜찮다 */
  _nearPortal(ind, p) {
    const out = ind.built.get(ind.cur);
    if (!out || !out.portals) return false;
    const [gx, gz] = ind.grid(p.x, p.z);
    return out.portals.some((q) => Math.abs((gx - q.x) * q.nx + (gz - q.z) * q.nz) < 2.0 && Math.abs((gx - q.x) * q.nz - (gz - q.z) * q.nx) < q.w / 2 + 0.3);
  }
  _rescue() {
    const cur = this.cur, ind = cur.indoor;
    const pl = ind.plan(ind.cur);
    const hall = pl && pl.L.lifthall != null ? pl.L.rooms[pl.L.lifthall] : null;
    if (hall) { const [x, z] = ind.world(ind.G.ox + hall.cx + 0.5, ind.G.oz + hall.cz + 0.5); this.placeAt(ind.cur, x, z); }
    else this._placeIn(cur);
  }

  /** 실내에서는 카메라가 지금 층의 벽·바닥·천장 안에 머문다 (칸막이를 넘어 옆방을 들여다보지 않게) */
  clampCamera(cam, target) {
    const cur = this.cur;
    if (!cur || !this.inPocket) return;
    if (cam.near !== 0.15) { cam.near = 0.15; cam.updateProjectionMatrix(); }
    if (cur.cabin) return this._clampCabin(cam, target);
    const ind = cur.indoor, i = ind.cur, out = ind.built.get(i);
    let fy = ind.yOf(i), bot = fy + 0.3, flat = ind.ceilY(i) - 0.3;
    if (ind.stairCell && ind.parts.size) {
      // 계단실: 지은 층들의 맨 아래 바닥 ~ 맨 위 천장 사이 (계단을 오르내리는 동안 층 천장에 눌리지 않게)
      const fl = [...ind.parts.keys()];
      bot = Math.min(...fl.map((j) => ind.yOf(j))) + 0.3;
      flat = Math.max(...fl.map((j) => ind.ceilY(j))) - 0.3;
      fy = bot - 0.3;
    }
    const pad = 0.4; // 카메라와 벽면 사이 (가까운 면 0.15 m 가 벽을 자르지 않게)
    const topAt = (x, z) => { if (!out || !out.ceilAt || ind.stairCell) return flat; const [gx, gz] = ind.grid(x, z); return Math.min(flat, fy + out.ceilAt(gx, gz) - 0.3); };
    // 카메라가 설 수 있는 자리: 방 칸 안 · 바깥벽 면에서 pad 넘게 안쪽(그리는 벽 면 = 같은 거리장) · 사방 pad 안에 칸막이가 없고 · 바닥과 그 자리 천장 사이
    const okPt = (x, y, z) => {
      if (y <= bot || y >= topAt(x, z) || !ind.inside(i, x, z)) return false;
      if (out && out.sdAt) { const [gx, gz] = ind.grid(x, z); if (out.sdAt(gx, gz) > -pad) return false; }
      return ind.segClear(i, x, z, x + pad, z) && ind.segClear(i, x, z, x - pad, z) && ind.segClear(i, x, z, x, z + pad) && ind.segClear(i, x, z, x, z - pad);
    };
    // 플레이어에서 카메라까지 칸막이를 건너지 않는가
    const path = (x, z) => ind.segClear(i, target.x, target.z, x, z);
    const p0 = cam.position;
    if (okPt(p0.x, p0.y, p0.z) && path(p0.x, p0.z)) return;
    // 카메라 팔을 따라 바깥에서 안쪽으로: 설 수 있고 길이 트인 가장 먼 자리 (플레이어가 벽에 붙어 머리 둘레가 「안 되는 자리」여도 그 너머는 찾는다)
    const a = target.clone(), b = p0.clone();
    a.y = Math.min(topAt(a.x, a.z) - 0.05, Math.max(bot + 0.05, a.y));
    let pos = null;
    for (let k = 24; k >= 1; k--) { const q = a.clone().lerp(b, k / 24); if (okPt(q.x, q.y, q.z) && path(q.x, q.z)) { pos = q; break; } }
    if (!pos) {
      // 팔 위 어디도 안 되면: 머리 위에서 조금 뒤로, 내려다본다 (벽 속·벽 너머로는 가지 않는다)
      const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1;
      for (const back of [0.6, 0.3, 0]) {
        const q = a.clone(); q.x += (dx / l) * back; q.z += (dz / l) * back; q.y = Math.min(topAt(q.x, q.z) - 0.05, a.y + 1.1);
        if (q.y > bot && ind.inside(i, q.x, q.z) && path(q.x, q.z)) { pos = q; break; }
      }
      if (!pos) pos = a.clone();
    }
    // 벽을 등져 카메라가 너무 가까워지면, 뒤로 물러나는 대신 위로 올라 내려다본다 (머리·목도리에 가리지 않게)
    const near = Math.hypot(pos.x - target.x, pos.z - target.z);
    if (near < 2.6) pos.y = Math.min(topAt(pos.x, pos.z) - 0.05, Math.max(pos.y, target.y + (2.6 - near) * 1.1));
    cam.position.copy(pos);
    cam.lookAt(target);
  }
  _clampCabin(cam, target) {
    const cur = this.cur;
    const top = cur.fy + cur.LH - 0.45, bot = cur.fy + 0.35;
    const inside = (x, z) => { const pts = cur.plan; let k = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, zi] = pts[i], [xj, zj] = pts[j]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) k = !k; } return k; };
    const ok = (x, y, z) => y < top && y > bot && inside(x, z);
    if (ok(cam.position.x, cam.position.y, cam.position.z)) return;
    const a = target.clone(), b = cam.position.clone();
    let lo = 0, hi = 1;
    for (let k = 0; k < 12; k++) { const m = (lo + hi) / 2; const q = a.clone().lerp(b, m); if (ok(q.x, q.y, q.z)) lo = m; else hi = m; }
    cam.position.copy(a.lerp(b, lo));
    cam.lookAt(target);
  }

  /** 저장할 자리: 실내면 바깥 문 앞 (실내 자리는 state.inside 에 따로) */
  safeSpot() {
    const cur = this.cur;
    if (!cur) return null;
    const r = cur.r;
    return { x: r.door.x + r.door.nx * 3, z: r.door.z + r.door.nz * 3 };
  }

  // 선실·옛 시설이 쓰는 도구
  _paint(geo, color, emit) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
    const n = g.attributes.position.count;
    const c = new THREE.Color(color), cols = new Float32Array(n * 3), em = new Float32Array(n).fill(emit);
    for (let i = 0; i < n; i++) { cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    g.setAttribute('emit', new THREE.BufferAttribute(em, 1));
    g.computeVertexNormals();
    return g;
  }
  _merge(list) {
    let n = 0;
    for (const g of list) n += g.attributes.position.count;
    const P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 3), E = new Float32Array(n);
    let o = 0;
    for (const g of list) { const c = g.attributes.position.count; P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); C.set(g.attributes.color.array, o * 3); E.set(g.attributes.emit.array, o); o += c; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); g.setAttribute('color', new THREE.BufferAttribute(C, 3)); g.setAttribute('emit', new THREE.BufferAttribute(E, 1));
    return g;
  }
  _box(P, C, E, x, y, z, w, h, d, ry, color, emit) {
    const geo = new THREE.BoxGeometry(w, h, d).rotateY(ry).translate(x, y + h / 2, z).toNonIndexed();
    const pos = geo.attributes.position.array;
    const col = new THREE.Color(color);
    for (let i = 0; i < pos.length; i += 3) { P.push(pos[i], pos[i + 1], pos[i + 2]); C.push(col.r, col.g, col.b); E.push(emit); }
  }
  /** 점검용 보기: 'plan' 위에서 내려다본 층(천장 숨김) · 'room' 방 하나를 모서리에서 · 'off' 되돌리기 */
  debugView(kind = 'plan', arg = null) {
    const g = this.game, cur = this.cur;
    if (!cur || !cur.indoor) return null;
    const ind = cur.indoor, i = arg && arg.floor != null ? arg.floor : ind.cur;
    if (arg && arg.floor != null && arg.floor !== ind.cur) ind.setFloor(arg.floor);
    this._dbgPlan = kind === 'plan' ? i : null; // 새로 그려지는 층도 (update 에서) 천장·다른 층을 감춘다
    for (const out of ind.built.values()) if (out.ceilMesh) out.ceilMesh.visible = kind !== 'plan';
    if (kind === 'off') { g.rig.override = null; for (const o of ind.built.values()) o.group.visible = true; return null; }
    const out = ind.built.get(i), B = cur.B, G = B.G;
    if (!out) return null;
    const y0 = ind.yOf(i);
    if (kind === 'plan') {
      // 위에서 (다른 층은 숨김)
      for (const [j, o] of ind.built) o.group.visible = j === i;
      let i0 = 1e9, i1 = -1e9, j0 = 1e9, j1 = -1e9;
      const F = B.floors[i];
      for (let c = 0; c < F.mask.length; c++) if (F.mask[c]) { const a = c % G.gw, b = (c / G.gw) | 0; i0 = Math.min(i0, a); i1 = Math.max(i1, a); j0 = Math.min(j0, b); j1 = Math.max(j1, b); }
      const cx = G.ox + (i0 + i1 + 1) / 2, cz = G.oz + (j0 + j1 + 1) / 2, span = Math.max(i1 - i0, j1 - j0) + 4;
      const [x, z] = ind.world(cx, cz);
      const h = span / (2 * Math.tan((g.engine.camera.fov * Math.PI) / 360)) + 2;
      const [x2, z2] = ind.world(cx, cz - 0.01);
      g.rig.override = { pos: new THREE.Vector3(x2, y0 + h, z2), look: new THREE.Vector3(x, y0, z) };
      return { span, h };
    }
    for (const o of ind.built.values()) o.group.visible = true;
    const R = arg && arg.room != null ? out.L.rooms[arg.room] : out.L.rooms.find((q) => q.main) || out.L.rooms.find((q) => q.n > 20);
    if (!R) return null;
    const ax = G.ox + R.i0 + 0.8, az = G.oz + R.j1 + 0.2, bx = G.ox + R.cx + 0.5, bz = G.oz + R.cz + 0.5;
    const [px, pz] = ind.world(ax, az), [lx, lz] = ind.world(bx, bz);
    g.rig.override = { pos: new THREE.Vector3(px, y0 + Math.min(2.4, (B.floors[i].ic ?? B.floors[i].ceil - B.floors[i].y) - 0.4), pz), look: new THREE.Vector3(lx, y0 + 0.8, lz) };
    return R.name;
  }

  // 옛 이름 (게임 쪽에서 아직 부를 수 있다)
  up() {}
  down() {}
  talk() {}
}
