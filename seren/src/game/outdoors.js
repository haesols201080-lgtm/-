// 들어갈 수 없는 건물도 일한다 — 건물 발치의 조작대(빛 기둥)에서 플레이어가 그 건물의 일을 직접 한다. 관찰자가 아니다.
//  · 하늘배 승강탑: 하늘배를 불러 타고 도시 위를 날아 다른 승강탑·랜드마크로 (보이는 비행)
//  · 가지 항구: 들어오는 짐 드론을 맞는 가지로 보낸다 (드론이 그 가지로 날아가 앉는다)
//  · 코일 탑: 공명 충전 — 코일에서 빛줄기가 내려와 몸에 기운
//  · 도관·식힘 탑·탱크: 점검 — 가장 높은 압력부터 풀면 김이 뿜어진다
//  · 안테나: 먼 신호 듣기 — 노래를 해독하면 말을 배우고 둘레 지도가 밝혀진다
//  · 생장 나무: 열매 거두기 · 구역의 문: 도시 안내판과 길 찾기(나침반 표식)
//  · 주거 탑(쌍둥이·세 갈래·물 위 집): 주민 부탁함 — 필요한 물건을 가져다주면 고마움(별씨). 사무 탑은 일거리 게시판
//  · 보조 랜드마크: 승강판(꼭대기 → 뛰어내려 활공) + 랜드마크마다 하는 일 (하늘 나루 출항, 별귀 하늘 듣기, 코일 조율, 정원 열매, 생명나무 별씨)
// 조작대 자리는 cityfabric.consolePos / _consoles 가 정하고(블록이 깨어날 때 소품 'console'), 여기서는 쓰임과 움직임만.
import * as THREE from 'three';
import { glowMaterial } from '../world/materials.js';
import { audio } from '../core/audio.js';
import { WORD, WORDS } from '../data/lexicon.js';
import { glyphSVG } from './language.js';
import { ITEMS, WISHES, ZONE_NAMES, FIND } from '../data/venues.js';
import { LANDMARKS, SPEC } from '../world/city-arch.js';
import { mulberry32 } from '../core/noise.js';
import { heightAt } from '../world/heightfield.js';
import { SYL_A, SYL_B } from '../data/citizens.js';

const TAU = Math.PI * 2;
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const BRANCH_COL = [0xff9fd0, 0x7ff3e6, 0xffd27a, 0xb9a6ff];
const BRANCH_HEX = ['#ff9fd0', '#7ff3e6', '#ffd27a', '#b9a6ff'];
const BRANCH_NAME = ['분홍 가지', '청록 가지', '금빛 가지', '보랏빛 가지'];

// 승강판이 닿는 꼭대기 (랜드마크 자기 좌표, 미터) · Rs: 오르내리는 기둥 자리(구조물 밖) · over: 꼭대기 위로 다가가는 높이
const TOPS = {
  lm_coil: { y: 300.05, r: 12, Rs: 64, over: 5, name: '고리 전망판 (300 m)' },
  lm_ear: { y: 348.3, r: 0, Rs: 42, over: 4, name: '꼭대기 전망판 (348 m)' },
  lm_port: { pads: true, Rs: 72, over: 5, name: '가장 높은 나루판 (221 m)' },
  lm_garden: { y: 305.25, r: 0, Rs: 52, over: 5, axisZ: true, name: '꼭대기 정원 (305 m)' },
  lm_tree: { y: 210.05, r: 0, Rs: 92, over: 68, name: '나무 갓 꼭대기 (210 m)' },
};

export class Outdoors {
  constructor(game) {
    this.game = game;
    this.group = new THREE.Group();
    game.engine.scene.add(this.group);
    this.fx = []; // (dt, t) => 끝났으면 true
    this.t = 0;
    this.tops = []; // 올라가 있는 꼭대기 (내려가기)
    this._mkVehicles();
  }
  get V() { return this.game.venues; }
  get S() { return this.V.S; }
  _day() { return Math.floor(this.game.world.clock.time); }
  _doneToday(key) { return this.S.days['ext:' + key] === this._day(); }
  _markToday(key) { this.S.days['ext:' + key] = this._day(); }

  // ── 탈것 모델 ─────────────────────────────
  _mesh(geo, color, emit = 0) { return new THREE.Mesh(this.game.interiors._paint(geo, color, emit), this.game.interiors.mat); }
  _glow(geo, color, intensity = 1.4) { const m = new THREE.Mesh(geo, glowMaterial({ color, intensity })); m.frustumCulled = false; return m; }
  _mkVehicles() {
    // 승강판: 빛 원판 + 고리 + 아래로 드리운 빛
    const disc = new THREE.Group();
    disc.add(this._mesh(new THREE.CylinderGeometry(1.5, 1.25, 0.22, 24), 0xe8e2f0, 0.05));
    const ring = this._glow(new THREE.TorusGeometry(1.5, 0.05, 4, 32).rotateX(Math.PI / 2), 0x7ff3e6, 2.0);
    ring.position.y = 0.12;
    disc.add(ring);
    const cone = this._glow(new THREE.ConeGeometry(1.25, 3.2, 20, 1, true).translate(0, -1.7, 0).rotateX(Math.PI), 0x7ff3e6, 0.35);
    cone.material.depthWrite = false;
    disc.add(cone);
    disc.visible = false;
    disc.traverse((o) => { o.frustumCulled = false; });
    this.group.add(disc);
    this.disc = disc;
    // 하늘배: 진주빛 몸 + 어두운 유리 덮개 + 빛 고리
    const pod = new THREE.Group();
    pod.add(this._mesh(new THREE.OctahedronGeometry(1, 2).scale(1.25, 0.75, 2.9), 0xeee8f4));
    const glass = this._mesh(new THREE.OctahedronGeometry(1, 2).scale(0.95, 0.55, 1.5).translate(0, 0.45, 0.35), 0x2a3448, 0.25);
    pod.add(glass);
    const halo = this._glow(new THREE.TorusGeometry(1.9, 0.07, 4, 36).rotateX(Math.PI / 2), 0x7ff3e6, 2.2);
    halo.position.y = -0.1;
    pod.add(halo);
    for (const s of [-1, 1]) { const st = this._glow(new THREE.BoxGeometry(0.06, 0.06, 4.2), 0xffd27a, 2.2); st.position.set(s * 1.05, 0.05, 0); pod.add(st); }
    const under = this._glow(new THREE.CircleGeometry(1.1, 20).rotateX(Math.PI / 2), 0x9ff6ff, 1.2);
    under.position.y = -0.72;
    pod.add(under);
    pod.visible = false;
    pod.traverse((o) => { o.frustumCulled = false; });
    this.group.add(pod);
    this.pod = pod;
  }

  // ── 찾기 ─────────────────────────────
  target(p) {
    const city = this.game.city;
    if (!city || !city.consoleNear) return null;
    for (const T of this.tops) if (Math.hypot(p.x - T.x, p.z - T.z) < 3.4 && Math.abs(p.y - T.y) < 2.5) return { kind: 'outdoor', o: { down: T }, label: `승강판 · 아래로 내려가기 (${T.name})`, short: '내려가기' };
    let c = city.consoleNear(p.x, p.z, 2.7);
    if (!this.mega) this._megaInit();
    for (const m of this.mega) if (Math.hypot(m.x - p.x, m.z - p.z) < (c ? Math.hypot(c.x - p.x, c.z - p.z) : 2.7)) c = m;
    if (!c || Math.abs(p.y - c.y) > 2.4) return null;
    return { kind: 'outdoor', o: c, label: this._label(c), short: c.def.short };
  }
  _label(c) {
    const D = c.def, r = c.rec;
    if (D.fn === 'megalift') return `${D.name} · 승강판 (하늘정원${c.mega.grand ? '·하늘바퀴' : c.mega.id.startsWith('t-in') ? '·하늘고리 「관」' : ''})`;
    if (D.fn === 'tower') {
      if (r.use === 'office') return `${D.name} · 출입 단말 · 일거리 게시판`;
      const W = this._wish(c);
      return this._doneToday(c.key + ':wish') ? `${D.name} · 주민 부탁함 (오늘은 다 들어줬어요)` : `${D.name} · 주민 부탁함 · ${ITEMS[W.item].name} ${W.n}개`;
    }
    return D.label || D.name;
  }
  use(t) {
    const c = t.o;
    if (c.down) return this._liftDown(c.down);
    const fn = this['_' + c.def.fn];
    if (fn) fn.call(this, c);
  }

  // ═══ 쓰임 ═══════════════════════════════════════════════

  // 하늘배 승강탑: 행선지를 골라 하늘배를 불러 탄다
  _taxi(c) {
    const g = this.game, city = g.city;
    const here = c.rec;
    const dests = [];
    for (const r of city.outRecs) {
      if (r === here || !(r.kind === 'padtower' || r.kind.startsWith('lm_'))) continue;
      const d = Math.hypot(r.x - here.x, r.z - here.z);
      if (d < 500 || d > 9000) continue;
      dests.push({ r, d });
    }
    dests.sort((a, b) => a.d - b.d);
    // 가까운 승강탑 넷 + 랜드마크 (구역마다)
    const pick = dests.filter((q) => q.r.kind === 'padtower').slice(0, 4).concat(dests.filter((q) => q.r.kind.startsWith('lm_')).slice(0, 4));
    if (!pick.length) { g.ui.serviceCard('하늘배 승강탑', '행선지', '지금은 이 둘레에 다른 승강장이 없어요.', []); return; }
    const inv = this.V.inv;
    g.ui.serviceCard('하늘배 승강탑', '어디로 날아갈까요?', `가진 별씨 ${inv.starseed || 0} · 하늘배가 내려와 태우고 도시 위로 날아가요 (뛰기·E 로 빨리 가기)`, pick.map(({ r, d }) => {
      const price = 1 + Math.round(d / 1800);
      const nm = r.kind.startsWith('lm_') ? r.out.name : `${ZONE_NAMES[r.zone] || ''} 승강탑`;
      return { label: `${nm} · 별씨 ${price}`, sub: `${(d / 1000).toFixed(1)} km`, disabled: (inv.starseed || 0) < price,
        onClick: () => { const to = city.consolePos(r); if (!to) { g.ui.toast('그 승강장은 지금 닫혀 있어요', { kind: 'muted' }); return; } if (!this.V._pay(price)) return; this.V._learn('go'); this._fly(c, to, nm, 1); } };
    }));
  }

  /** 하늘배 비행: 조작대 → (내려온 배를 타고) 순항 높이 → 도착지 조작대 옆 */
  _fly(from, to, name, scale = 1) {
    const g = this.game;
    const A = this._pad(from), B = this._pad(to);
    const route = this._route(A, B);
    const cruise = Math.max(this._cruise(route, A, B), from.rec.top + 20, to.rec.top + 20);
    const dir = V3(B.x - A.x, 0, B.z - A.z).normalize();
    // 제 탑보다 높이 곧게 올라 순항(하모네아의 거대 탑·척추는 옆으로 돌아서), 도착지 위에서 곧게 내려온다
    const upA = Math.min(cruise - 10, Math.max(A.y + 14, from.rec.top + 12)), upB = Math.min(cruise - 10, Math.max(B.y + 14, to.rec.top + 12));
    const d0 = V3(route[1][0] - A.x, 0, route[1][1] - A.z).normalize(), d1 = V3(B.x - route[route.length - 2][0], 0, B.z - route[route.length - 2][1]).normalize();
    const pts = [V3(A.x, A.y + 1.0, A.z), V3(A.x, A.y + 8, A.z), V3(A.x, upA, A.z), V3(A.x + d0.x * 60, cruise, A.z + d0.z * 60)];
    for (const [x, z] of route.slice(1, -1)) pts.push(V3(x, cruise, z));
    pts.push(V3(B.x - d1.x * 60, cruise, B.z - d1.z * 60), V3(B.x, upB, B.z), V3(B.x, B.y + 8, B.z), V3(B.x, B.y + 1.0, B.z));
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const L = curve.getLength();
    const dur = Math.max(10, L / 110);
    const pod = this.pod;
    pod.scale.setScalar(scale);
    const P = V3(0, 0, 0), T = V3(0, 0, 1), cam = { pos: V3(0, 0, 0), look: V3(0, 0, 0) };
    let t = -1.6; // 앞의 1.6초: 하늘배가 내려온다
    const ride = {
      done: false, cam, showAvatar: true,
      step: (dt, player) => {
        t += dt;
        if (t < 0) {
          // 위에서 내려와 플레이어 옆에 선다
          const k = 1 - (-t / 1.6);
          const e = 1 - Math.pow(1 - k, 3);
          pod.position.set(A.x, A.y + 1.0 + (1 - e) * 40, A.z);
          pod.rotation.set(0, Math.atan2(dir.x, dir.z), 0);
          pod.visible = true;
          player.pos.set(A.x - dir.x * 2.0, A.y, A.z - dir.z * 2.0);
          player.vel.set(0, 0, 0);
          player.yaw = Math.atan2(dir.x, dir.z);
          cam.pos.set(A.x - dir.x * 14 + dir.z * 6, A.y + 6, A.z - dir.z * 14 - dir.x * 6);
          cam.look.set(A.x, A.y + 2.5 + (1 - e) * 20, A.z);
          return ride;
        }
        ride.showAvatar = false;
        const k = Math.min(1, t / dur);
        const u = k * k * (3 - 2 * k);
        curve.getPointAt(u, P);
        curve.getTangentAt(Math.min(0.999, Math.max(0.001, u)), T);
        pod.position.copy(P);
        const hx = T.x, hz = T.z;
        if (Math.hypot(hx, hz) > 0.05) pod.rotation.set(-Math.asin(Math.max(-1, Math.min(1, T.y))) * 0.5, Math.atan2(hx, hz), 0);
        player.pos.set(P.x, P.y - 0.6, P.z);
        player.vel.set(0, 0, 0);
        player.yaw = pod.rotation.y;
        // 뒤 위에서 따라가는 카메라 (여정 방향 기준: 오르내릴 때도 흔들리지 않게)
        cam.pos.set(P.x - dir.x * 17 * scale, P.y + 6.5 * scale, P.z - dir.z * 17 * scale);
        cam.look.set(P.x + dir.x * 24, P.y - 1, P.z + dir.z * 24);
        if (k >= 1) {
          ride.done = true;
          pod.visible = false;
          player.pos.set(B.x - dir.x * 2.0, B.y + 0.1, B.z - dir.z * 2.0);
          player.vel.set(0, 0, 0);
          g.rig.override = null;
          g.ui.regionTitle(name, '하늘배에서 내렸다', false);
          g.save();
        }
        return ride;
      },
      skip: () => { if (t > 0) t = Math.max(t, dur - 2.5); },
    };
    g.player.enterRide(ride);
    audio.noise({ freq: 380, q: 0.6, dur: 2.5, gain: 0.45, type: 'bandpass', sweep: 1300, attack: 0.5 });
    audio.chime('soft');
  }
  /** 하늘배가 내려앉는 자리: 조작대 쪽으로 건물(받침·나루판 포함) 바깥, 비어 있는 곳 */
  _pad(c) {
    const r = c.rec, city = this.game.city;
    let ext = 0;
    for (const q of r.cols) if (q.y0 < r.base + 120) ext = Math.max(ext, Math.hypot(q.x - r.x, q.z - r.z) + (q.type === 'cyl' ? q.r : Math.hypot(q.hx, q.hz)));
    for (let d = ext + 4; d < ext + 40; d += 3) {
      const x = r.x + c.nx * d, z = r.z + c.nz * d;
      if (city._free(x, z, 2.6) && this._clear(x, z, heightAt(x, z) + 0.5, heightAt(x, z) + 60, 3)) return V3(x, Math.max(heightAt(x, z), 0) + 0.05, z);
    }
    return V3(c.x + c.nx * 2.4, c.y, c.z + c.nz * 2.4);
  }
  /** 수직 기둥이 비었나 (건물·구조물 충돌체) */
  _clear(x, z, y0, y1, rad = 2.5) {
    for (const c of this.game.world.colliders.near(x, z, rad + 2)) {
      if (c.sky || c.stream || c.obj) continue;
      if (c.y1 < y0 || c.y0 > y1) continue;
      let d;
      if (c.type === 'cyl') d = Math.hypot(x - c.x, z - c.z) - c.r;
      else if (c.type === 'box') { const dx = x - c.x, dz = z - c.z; const lx = Math.abs(dx * c.cos - dz * c.sin) - c.hx, lz = Math.abs(dx * c.sin + dz * c.cos) - c.hz; d = Math.hypot(Math.max(lx, 0), Math.max(lz, 0)); }
      else continue;
      if (d < rad) return false;
    }
    return true;
  }
  /** 하늘 길 (평면): 하모네아의 거대 탑·별항구·척추는 옆으로 돌아간다 → [[x, z]…] */
  _route(A, B) {
    const M = this.game.megacity, obst = [{ x: 0, z: 0, r: 600 }];
    if (M) {
      for (const T of M.towers) obst.push({ x: T.x, z: T.z, r: T.r * 2.4 + 70 });
      if (M.starport) obst.push({ x: M.starport.x, z: M.starport.z, r: 190 });
    }
    const pts = [[A.x, A.z], [B.x, B.z]];
    for (let it = 0; it < 8; it++) {
      let hit = false;
      for (let i = 0; i < pts.length - 1 && !hit; i++) {
        const [ax, az] = pts[i], [bx, bz] = pts[i + 1], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
        for (const o of obst) {
          const t = L2 > 1 ? Math.max(0, Math.min(1, ((o.x - ax) * dx + (o.z - az) * dz) / L2)) : 0;
          const px = ax + dx * t, pz = az + dz * t;
          if (Math.hypot(o.x - px, o.z - pz) >= o.r || t < 0.02 || t > 0.98) continue;
          // 출발·도착지가 그 안이면 (탑 발치의 승강장) 돌지 않는다
          if (Math.hypot(o.x - ax, o.z - az) < o.r || Math.hypot(o.x - bx, o.z - bz) < o.r) continue;
          let nx = px - o.x, nz = pz - o.z;
          if (Math.hypot(nx, nz) < 1) { nx = -dz; nz = dx; }
          const k = (o.r + 40) / Math.hypot(nx, nz);
          pts.splice(i + 1, 0, [o.x + nx * k, o.z + nz * k]);
          hit = true;
          break;
        }
      }
      if (!hit) break;
    }
    return pts;
  }
  /** 순항 높이: 길 아래 땅과 도시의 높은 탑들을 넘고, 하늘바퀴·하늘고리 갑판과는 높이를 비킨다 */
  _cruise(route, A, B) {
    const g = this.game;
    let top = Math.max(A.y, B.y) + 70;
    const tall = [];
    for (const z of g.city.zones) for (const t of z.tall) tall.push(t);
    const samples = [];
    for (let i = 0; i < route.length - 1; i++) {
      const [ax, az] = route[i], [bx, bz] = route[i + 1], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 60));
      for (let k = 0; k <= n; k++) samples.push([ax + (bx - ax) * (k / n), az + (bz - az) * (k / n)]);
    }
    for (const [x, z] of samples) {
      top = Math.max(top, heightAt(x, z) + 90);
      for (const t of tall) if (Math.abs(t[0] - x) < 90 && Math.abs(t[1] - z) < 90 && Math.hypot(t[0] - x, t[1] - z) < 70 + t[4]) top = Math.max(top, t[3] + 40);
    }
    top = Math.min(top, 1400);
    const M = g.megacity, need = top;
    if (M) for (const H of M.halos) {
      const cross = samples.some(([x, z]) => { const d = Math.hypot(x - H.x, z - H.z); return d > H.Ri - 40 && d < H.Ro + 40; });
      if (cross && Math.abs(top - H.y) < 50) top = need <= H.y - 50 ? H.y - 50 : H.y + 50;
    }
    return top;
  }

  // 가지 항구: 짐 드론 관제 — 드론의 빛 띠 색에 맞는 가지로 보낸다
  _drones(c) {
    const g = this.game, r = c.rec;
    const S = SPEC.branchport;
    const cs = Math.cos(r.rot), sn = Math.sin(r.rot);
    // 가지 끝 받침 (SPEC 충돌체의 납작한 원통들)
    // 충돌체 ['c', x, z, r, y0, y1]: 얇은 원통 = 가지 끝 받침
    const pads = S.cols.filter((q) => q[0] === 'c' && q[5] - q[4] < 0.05).map((q) => {
      const px = q[1] * r.sx, pz = q[2] * r.sz;
      return V3(r.x + px * cs + pz * sn, r.base + q[5] * r.sy + 0.6, r.z - px * sn + pz * cs);
    }).slice(0, 4);
    if (pads.length < 2) { g.ui.toast('가지 항구가 쉬는 중이에요', { kind: 'muted' }); return; }
    // 가지마다 빛 고리 (어느 가지가 무슨 색인지)
    const marks = pads.map((p, i) => { const m = this._glow(new THREE.TorusGeometry(2.2, 0.12, 4, 28).rotateX(Math.PI / 2), BRANCH_COL[i], 2.2); m.position.copy(p); this.group.add(m); return m; });
    const clean = () => marks.forEach((m) => { this.group.remove(m); m.geometry.dispose(); m.material.dispose(); });
    this.V._learn('carry');
    let k = 0, right = 0;
    const N = 4;
    const next = () => {
      if (k >= N) { clean(); this.V._wage(1 + right, `짐 드론 관제 ${right}/${N}`); audio.sing && audio.sing([1, 3, 2, 4], { gain: 0.22 }); return; }
      k++;
      const want = Math.floor(Math.random() * pads.length);
      // 드론: 위에서 내려와 항구 앞에 떠 있다
      const drone = this._drone(BRANCH_COL[want]);
      const hold = V3(c.x + c.nx * 10, r.base + r.sy * 0.55, c.z + c.nz * 10);
      const from = V3(hold.x + c.nx * 60, hold.y + 80, hold.z + c.nz * 60);
      // st.to: 고른 가지 (null 이면 아직 떠 있다) · 맞으면 가지에 앉았다 사라지고, 틀리거나 그만두면 하늘로 돌아간다
      const st = { to: null, ok: false, ph: 0, leg: 0 };
      this.fx.push((dt) => {
        st.ph += dt;
        if (!st.to) { const e = Math.min(1, st.ph / 1.6); drone.position.lerpVectors(from, hold, 1 - Math.pow(1 - e, 3)); drone.position.y += Math.sin(this.t * 3) * 0.15; return false; }
        const e = Math.min(1, st.ph / 2.0), s3 = e * e * (3 - 2 * e);
        if (st.leg === 0) drone.position.lerpVectors(hold, st.to, s3);
        else if (st.leg === 1) { drone.position.copy(st.to); drone.scale.setScalar(st.ok ? 1 - e * 0.9 : 1); }
        else drone.position.lerpVectors(st.to, from, s3);
        if (e >= 1) {
          if (st.leg === 2 || (st.leg === 1 && st.ok)) { this.group.remove(drone); return true; }
          st.leg = st.ok ? 1 : st.leg + 1; st.ph = 0;
          if (!st.ok && st.leg === 1) st.leg = 2;
        }
        return false;
      });
      g.ui.serviceCard(`가지 항구 · 드론 ${k}/${N}`, '이 드론은 어느 가지로?', '드론의 빛 띠 색과 같은 가지로 보내요. 가지 끝마다 같은 색 고리가 떠 있어요.', pads.map((p, i) => ({
        label: BRANCH_NAME[i], sub: `높이 ${Math.round(p.y - r.base)} m`,
        onClick: () => {
          const ok = i === want;
          if (ok) right++;
          st.to = pads[i].clone(); st.ok = ok; st.ph = 0; st.leg = 0;
          g.ui.toast(ok ? '맞는 가지! 드론이 내려앉는다' : '다른 가지였어요 · 드론이 돌아간다', { kind: ok ? 'item' : 'muted' });
          setTimeout(next, 900);
        },
      })), `<div class="mini-parcel" style="--c:${BRANCH_HEX[want]}"><div class="box">✈</div></div>`,
      // 고르지 않고 닫으면 (Esc·바깥 누르기): 드론은 돌아가고 관제도 끝
      { onClose: () => setTimeout(() => { if (!st.to) { st.to = hold.clone(); st.ok = false; st.leg = 2; st.ph = 0; clean(); } }, 0) });
      document.querySelectorAll('.svc-b').forEach((b, i) => { b.style.borderColor = BRANCH_HEX[i]; b.style.boxShadow = `inset 4px 0 0 ${BRANCH_HEX[i]}`; });
    };
    next();
  }
  _drone(color) {
    const d = new THREE.Group();
    d.add(this._mesh(new THREE.OctahedronGeometry(1, 1).scale(1.1, 0.5, 1.4), 0xe6e0ee));
    const band = this._glow(new THREE.TorusGeometry(1.3, 0.12, 4, 24).rotateX(Math.PI / 2), color, 2.4);
    d.add(band);
    for (const [x, z] of [[1.4, 1.4], [-1.4, 1.4], [1.4, -1.4], [-1.4, -1.4]]) { const r = this._glow(new THREE.TorusGeometry(0.55, 0.04, 3, 16).rotateX(Math.PI / 2), 0x9ff6ff, 1.6); r.position.set(x, 0.2, z); d.add(r); }
    d.traverse((o) => { o.frustumCulled = false; });
    this.group.add(d);
    return d;
  }

  // 코일 탑: 공명 충전 — 코일에서 빛줄기가 몸으로 (하루 한 번, 코일마다)
  _charge(c) {
    const g = this.game, r = c.rec;
    if (this._doneToday(c.key + ':charge')) { g.ui.toast('이 코일은 오늘 이미 충전해 줬어요. 다른 코일 탑을 찾아봐요', { kind: 'muted' }); return; }
    this._markToday(c.key + ':charge');
    const pl = g.player.pos;
    const arcs = [];
    for (let a = 0; a < 3; a++) {
      const segs = [];
      for (let i = 0; i < 9; i++) { const m = this._glow(new THREE.CylinderGeometry(0.07, 0.07, 1, 4).translate(0, 0.5, 0), a % 2 ? 0xbffcff : 0xffd27a, 2.6); this.group.add(m); segs.push(m); }
      arcs.push(segs);
    }
    const src = (a) => { const ang = r.rot + a * 2.1 + this.t * 0.7; return V3(r.x + Math.cos(ang) * r.sx * 0.86, r.base + r.sy * (0.55 + a * 0.12), r.z + Math.sin(ang) * r.sx * 0.7); };
    const P0 = V3(0, 0, 0), P1 = V3(0, 0, 0), up = V3(0, 1, 0), tmp = V3(0, 0, 0);
    let life = 2.6, jt = 0;
    audio.noise({ freq: 900, q: 2, dur: 2.6, gain: 0.35, type: 'bandpass', sweep: 2600, attack: 0.1 });
    this.fx.push((dt) => {
      life -= dt; jt -= dt;
      if (life <= 0) { arcs.flat().forEach((m) => { this.group.remove(m); m.geometry.dispose(); m.material.dispose(); }); return true; }
      if (jt <= 0) {
        jt = 0.07;
        arcs.forEach((segs, a) => {
          const A = src(a), B = V3(pl.x, pl.y + 1.1, pl.z);
          let prev = A.clone();
          segs.forEach((m, i) => {
            const k = (i + 1) / segs.length;
            const P = A.clone().lerp(B, k);
            if (i < segs.length - 1) P.add(V3((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3).multiplyScalar(Math.sin(k * Math.PI)));
            P0.copy(prev); P1.copy(P);
            const L = P0.distanceTo(P1);
            m.position.copy(P0);
            m.quaternion.setFromUnitVectors(up, tmp.copy(P1).sub(P0).normalize());
            m.scale.set(1, L, 1);
            prev = P;
          });
        });
      }
      return false;
    });
    setTimeout(() => {
      this.V.buff('charged');
      this.V._learn('core');
      g.particles.emit({ pos: V3(pl.x, pl.y + 1, pl.z), count: 40, spread: 3, up: 3, life: 1.2, size: [0.2, 0.6], color: 0xbffcff, alpha: 1, add: true, drag: 1.6 });
      g.ui.toast('공명 충전 · 몸에 코일의 울림이 차오른다 (5분: 달리기·활공 ↑)', { kind: 'item' });
    }, 2600);
  }

  // 도관·식힘 탑·탱크: 점검 — 가장 높은 압력부터 풀기 (세 번). 풀 때마다 김이 뿜어진다
  _maint(c) {
    const g = this.game, r = c.rec;
    if (this._doneToday(c.key + ':maint')) { g.ui.toast('오늘 점검은 끝났어요. 압력이 고르게 유지되고 있어요', { kind: 'muted' }); return; }
    const p = [0, 1, 2].map(() => 0.35 + Math.random() * 0.6);
    const names = ['첫째 관', '둘째 관', '셋째 관'];
    let left = 3, right = 0;
    const bar = (v) => `<span class="gauge"><i style="width:${Math.round(v * 100)}%;background:${v > 0.8 ? '#ff8a7a' : v > 0.55 ? '#ffd27a' : '#7ff3e6'}"></i></span>`;
    const draw = (wrap) => wrap.querySelectorAll('.svc-b').forEach((b, i) => { b.querySelector('small').innerHTML = `압력 ${Math.round(p[i] * 100)} ${bar(p[i])}`; });
    const wrap = g.ui.serviceCard(`${c.def.name} · 점검`, '압력 고르기', '가장 높은 압력의 관부터 풀어 주세요 (세 번). 잘못 풀면 다른 관의 압력이 오른다.', names.map((nm, i) => ({
      label: nm, sub: ' ', stay: true,
      onClick: () => {
        const hi = p.indexOf(Math.max(...p));
        const ok = i === hi;
        if (ok) right++;
        p[i] = 0.15 + Math.random() * 0.1;
        p.forEach((v, k) => { if (k !== i) p[k] = Math.min(1, v + (ok ? 0.06 : 0.16)); });
        left--;
        g.particles.emit({ pos: V3(r.x, r.base + r.sy * (0.6 + i * 0.15), r.z), count: 36, spread: 2.5, up: 7, life: 2.2, size: [1.2, 5], color: 0xf4f0ff, alpha: 0.55, drag: 0.8, gravity: -0.6 });
        audio.noise({ freq: 2400, q: 0.8, dur: 0.9, gain: 0.3, type: 'highpass', attack: 0.02 });
        if (!ok) g.ui.toast('다른 관이 더 높았어요', { kind: 'muted' });
        draw(wrap);
        if (left <= 0) { wrap.close(); this._markToday(c.key + ':maint'); this.V._wage(1 + right, `점검 ${right}/3`); this.V._learn('work'); }
      },
    })));
    draw(wrap);
  }

  // 안테나: 먼 신호 듣기 — 노래를 해독 (하루 한 번, 안테나마다)
  _signal(c) {
    const g = this.game, r = c.rec, L = g.lang;
    if (this._doneToday(c.key + ':signal')) { g.ui.toast('오늘 신호는 다 들었어요', { kind: 'muted' }); return; }
    const un = WORDS.filter((w) => !L.known(w.id));
    const w = (un.length ? un : WORDS)[Math.floor(Math.random() * (un.length || WORDS.length))];
    const opts = [w, ...WORDS.filter((x) => x.id !== w.id).sort(() => Math.random() - 0.5).slice(0, 2)].sort(() => Math.random() - 0.5);
    const play = () => audio.sing && audio.sing(w.notes, { gain: 0.3, step: 0.38 });
    play();
    this._pulse(V3(r.x, r.base + r.sy * 0.98, r.z), 0x7ff3e6, 60, 2.2);
    g.ui.serviceCard(`${c.def.name} · 먼 신호`, '이 신호는 무슨 말일까요?', '먼 도시에서 노래로 보낸 신호가 들어왔어요. 글자와 노래를 보고 뜻을 골라요.', [
      { label: '▶ 다시 듣기', stay: true, onClick: play },
      ...opts.map((o) => ({ label: o.ko, onClick: () => {
        this._markToday(c.key + ':signal');
        if (o.id === w.id) {
          L.learn(w.id, 'teach');
          g.mapData.reveal(r.x, r.z, 1500);
          this._pulse(V3(r.x, r.base + r.sy, r.z), 0xffd27a, 1500, 4);
          this.V._wage(2, `신호 해독 · 「${w.ko}」 · 둘레 1.5 km 지도가 밝혀졌다`);
        } else g.ui.toast(`「${w.ko}」였어요 · 내일 또 들어 봐요`, { kind: 'muted' });
      } })),
    ], `<div class="mini-glyph big">${glyphSVG(w.id, 96)}</div>`);
  }

  // 생장 나무: 열매 거두기 (하루 한 번)
  _harvest(c) {
    const g = this.game, r = c.rec;
    if (this._doneToday(c.key + ':harvest')) { g.ui.toast('오늘 열매는 다 거뒀어요. 꼬투리가 다시 차오르는 중', { kind: 'muted' }); return; }
    this._markToday(c.key + ':harvest');
    this._orbs(V3(r.x, r.base + r.sy * 0.8, r.z), 8, 0xffd27a);
    this.V._add('fruit', 2);
    if (Math.random() < 0.4) this.V._add('flower', 1);
    this.V._learn('grow');
  }

  // 구역의 문: 도시 안내판 · 길 찾기
  _guide(c) {
    const g = this.game, r = c.rec, city = g.city, I = g.interiors;
    const zr = city.recs.filter((q) => q.zone === r.zone);
    const cnt = {};
    for (const q of zr) { const pid = I.info(q).pid; cnt[pid] = (cnt[pid] || 0) + 1; }
    const outs = city.outRecs.filter((q) => q.zone === r.zone).length;
    const stat = FIND.filter(([pid]) => cnt[pid]).map(([pid, nm]) => `${nm} ${cnt[pid]}`).join(' · ');
    const zone = city.zones.find((z) => z.id === r.zone);
    const items = FIND.filter(([pid]) => cnt[pid]).map(([pid, nm]) => ({ label: `${nm} 찾기`, sub: '가장 가까운 곳에 나침반 표식', onClick: () => this._find(pid, nm) }));
    g.ui.serviceCard(`${ZONE_NAMES[r.zone] || r.zone} · 도시 안내판`, '어디를 찾나요?', `들어갈 수 있는 건물 ${zr.length}채 · 바깥 조작대가 있는 건물 ${outs}채${zone ? ` · 모든 건물 ${zone.buildings}채` : ''}<br><small>${stat}</small>`, items);
  }
  _find(pid, nm) {
    const g = this.game, p = g.player.pos, I = g.interiors;
    let best = null, bd = 1e9;
    for (const R of [600, 1500, 3500]) {
      for (const q of g.city.recsNear(p.x, p.z, R)) { if (I.info(q).pid !== pid) continue; const d = Math.hypot(q.door.x - p.x, q.door.z - p.z); if (d < bd) { bd = d; best = q; } }
      if (best) break;
    }
    if (!best) { g.ui.toast(`가까이에 ${nm}이(가) 없어요`, { kind: 'muted' }); return; }
    g.state.waypoint = { x: best.door.x, z: best.door.z };
    g.updateWaypoint();
    audio.chime('soft');
    g.ui.toast(`표식 · ${I.info(best).name}`, { kind: 'place', sub: `${Math.round(bd)} m · 나침반의 흰 점을 따라가세요` });
  }

  // 탑: 사무 → 일거리 게시판 / 집 → 주민 부탁함
  _tower(c) {
    const g = this.game, r = c.rec;
    if (r.use === 'office') return this.V.jobBoard(r);
    const W = this._wish(c), I = ITEMS[W.item], have = this.V.inv[W.item] || 0;
    if (this._doneToday(c.key + ':wish')) { g.ui.serviceCard(`${c.def.name} · 주민 부탁함`, '오늘은 다 들어줬어요', `${W.who}: 「고마워요, 덕분에 살았어요.」 내일 또 들러 주세요.`, []); return; }
    g.ui.serviceCard(`${c.def.name} · 주민 부탁함`, `${W.floor}층 ${W.who}의 부탁`, `「${W.why}」<br>필요한 것: <b>${I.icon} ${I.name} ${W.n}개</b> (가진 것 ${have}) · 구하는 곳: ${W.where}`, [
      { label: `${I.name} ${W.n}개 건네기 · 고마움 별씨 ${W.reward}`, sub: have >= W.n ? '부탁함에 넣으면 드론이 위층으로 올려 준다' : `${W.n - have}개가 모자라요`, primary: true, disabled: have < W.n,
        onClick: () => {
          this.V.inv[W.item] -= W.n;
          this._markToday(c.key + ':wish');
          // 작은 드론이 짐을 그 층까지 올린다
          const d = this._drone(0xffd27a);
          d.scale.setScalar(0.45);
          const A = V3(c.x, c.y + 1.4, c.z), B = V3(r.x + c.nx * (planR(r) + 1.5), r.base + Math.min(r.sy * 0.9, 3.4 * W.floor), r.z + c.nz * (planR(r) + 1.5));
          let ph = 0;
          this.fx.push((dt) => { ph += dt; const e = Math.min(1, ph / 3.2); d.position.lerpVectors(A, B, e * e * (3 - 2 * e)); if (e >= 1) { this.group.remove(d); return true; } return false; });
          this.V._learn('share');
          this.V.inv.starseed = (this.V.inv.starseed || 0) + W.reward; this.V.S.earned += W.reward;
          g.ui.toast(`${W.who}: 「정말 고마워요!」 · 별씨 +${W.reward}`, { kind: 'item' });
          if (Math.random() < 0.25) setTimeout(() => this.V._add('trinket', 1), 900);
        } },
    ]);
  }
  _wish(c) {
    const rnd = mulberry32((this._day() * 7919 + c.rec.idx * 104729 + c.rec.kind.length * 31) | 0);
    const W = WISHES[Math.floor(rnd() * WISHES.length)];
    const who = SYL_A[Math.floor(rnd() * SYL_A.length)] + SYL_B[Math.floor(rnd() * SYL_B.length)];
    const floors = Math.max(2, Math.floor((c.rec.top - c.rec.gy) / 3.6));
    return { ...W, who, floor: 2 + Math.floor(rnd() * (floors - 1)) };
  }

  // 보조 랜드마크: 하는 일 + 승강판
  _mark(c) {
    const g = this.game, k = c.rec.kind, T = this._top(c);
    const lift = T ? [{ label: `승강판 · ${T.name}`, sub: '빛 원판을 타고 꼭대기로 (내려올 땐 뛰어내려 활공해도 돼요)', onClick: () => this._liftUp(c, T) }] : [];
    if (k === 'lm_port') {
      g.ui.serviceCard('하늘 나루', '출항과 승강판', '큰 하늘배가 구역과 구역 사이를 오간다. 도시 위로 날아 다른 구역의 랜드마크로 갈 수 있어요.', [
        { label: '출항 · 행선지 고르기', sub: '다른 구역의 랜드마크·승강탑으로', primary: true, onClick: () => this._portList(c) },
        ...lift,
      ]);
    } else if (k === 'lm_ear') {
      const done = this._doneToday(c.key + ':ear');
      g.ui.serviceCard('별귀 탑', '하늘 듣기와 승강판', '별귀는 하늘과 먼 땅의 소리를 모은다. 귀를 기울이면 둘레가 지도에 그려진다.', [
        { label: done ? '오늘은 이미 들었어요' : '하늘 듣기', sub: '둘레 2.5 km 지도가 밝혀지고, 하늘의 일정을 알려 준다', primary: true, disabled: done, onClick: () => this._ear(c) },
        ...lift,
      ]);
    } else if (k === 'lm_coil') {
      g.ui.serviceCard('울림 코일 탑', '코일 조율과 승강판', '구역 전체에 울림을 나눠 주는 코일. 출력이 흔들리면 사람이 붙잡아 준다.', [
        { label: '코일 조율 · 일하기', sub: '바늘을 띠 안에 붙잡으면 별씨 5 + 구역에 울림 물결', primary: true, onClick: () => this.V.powerWork({ kicker: '울림 코일 탑 · 조율대', title: '코일 조율', pay: 5, onWin: () => this._surge(c) }) },
        ...lift,
      ]);
    } else if (k === 'lm_garden') {
      const done = this._doneToday(c.key + ':garden');
      g.ui.serviceCard('매달린 정원', '열매와 승강판', '층층이 매달린 정원. 꼭대기 정원지기가 그날의 열매를 내려 준다.', [
        { label: done ? '오늘 열매는 받았어요' : '정원 열매 받기', sub: '빛열매 3 + 울림꽃 1 (하루 한 번)', primary: true, disabled: done, onClick: () => { this._markToday(c.key + ':garden'); this._orbs(V3(c.rec.x, c.rec.base + 120, c.rec.z), 10, 0x8fe0a0); this.V._add('fruit', 3); this.V._add('flower', 1); this.V._learn('grow'); } },
        ...lift,
      ]);
    } else if (k === 'lm_tree') {
      const done = this._doneToday(c.key + ':seed');
      g.ui.serviceCard('생명나무', '별씨와 승강판', '세렌의 돈인 별씨는 이 나무의 씨앗이다. 쓰인 별씨는 언젠가 들에 뿌려져 다시 나무가 된다.', [
        { label: done ? '오늘 별씨는 거뒀어요' : '별씨 거두기', sub: '별씨 3 (하루 한 번)', primary: true, disabled: done, onClick: () => { this._markToday(c.key + ':seed'); this._orbs(V3(c.rec.x, c.rec.base + 190, c.rec.z), 12, 0xffe2a0); this.V._wage(3, '생명나무의 별씨'); this.V._learn('share'); } },
        ...lift,
      ]);
    }
  }
  _portList(c) {
    const g = this.game, city = g.city, here = c.rec, inv = this.V.inv;
    const by = new Map();
    for (const r of city.outRecs) {
      if (r === here || r.zone === here.zone || !(r.kind.startsWith('lm_') || r.kind === 'padtower')) continue;
      const d = Math.hypot(r.x - here.x, r.z - here.z);
      const cur = by.get(r.zone);
      if (!cur || (r.kind.startsWith('lm_') && !cur.r.kind.startsWith('lm_')) || (r.kind.startsWith('lm_') === cur.r.kind.startsWith('lm_') && d < cur.d)) by.set(r.zone, { r, d });
    }
    const list = [...by.values()].sort((a, b) => a.d - b.d).slice(0, 7);
    if (!list.length) { g.ui.serviceCard('하늘 나루', '행선지', '지금은 떠나는 배가 없어요.', []); return; }
    g.ui.serviceCard('하늘 나루 · 출항', '어느 구역으로?', `가진 별씨 ${inv.starseed || 0} · 큰 하늘배를 타고 도시 위를 건너요 (뛰기·E 로 빨리 가기)`, list.map(({ r, d }) => {
      const price = 2 + Math.round(d / 3000);
      const nm = `${ZONE_NAMES[r.zone] || r.zone} · ${r.kind.startsWith('lm_') ? r.out.name : '승강탑'}`;
      return { label: `${nm} · 별씨 ${price}`, sub: `${(d / 1000).toFixed(1)} km`, disabled: (inv.starseed || 0) < price,
        onClick: () => { const to = city.consolePos(r); if (!to) return; if (!this.V._pay(price)) return; this.V._learn('go'); this._fly(c, to, nm, 2.2); } };
    }));
  }
  _ear(c) {
    const g = this.game, r = c.rec;
    this._markToday(c.key + ':ear');
    g.mapData.reveal(r.x, r.z, 2500);
    this._pulse(V3(r.x, r.base + 372, r.z), 0x7ff3e6, 2500, 5);
    this.V._learn('star');
    const ev = g.events && g.events.forecast ? g.events.forecast() : null;
    g.ui.serviceCard('별귀 탑', '하늘이 들려준 것', `둘레 2.5 km 가 지도에 그려졌다.${ev ? `<br>${ev}` : ''}`, []);
  }
  /** 코일 조율 성공: 구역에 울림 물결 + 코일 꼭대기가 한동안 환하게 */
  _surge(c) {
    const r = c.rec;
    this._pulse(V3(r.x, r.base + 180, r.z), 0xffd27a, 1800, 6);
    const flare = this._glow(new THREE.SphereGeometry(9, 16, 12), 0xfff0d0, 2.4);
    flare.position.set(r.x, r.base + 352, r.z);
    this.group.add(flare);
    let life = 90;
    this.fx.push((dt) => { life -= dt; flare.scale.setScalar(1 + 0.25 * Math.sin(this.t * 4)); flare.material.uniforms.uIntensity.value = 1.2 + 1.4 * Math.min(1, life / 10); if (life <= 0) { this.group.remove(flare); flare.geometry.dispose(); flare.material.dispose(); return true; } return false; });
    this.game.ui.toast('코일이 고르게 울린다 · 구역에 울림 물결이 퍼진다', { kind: 'item' });
  }

  // ── 하모네아의 거대 탑 (구역 큰 탑·위성 탑·안쪽 탑): 발치 조작대 → 하늘정원 층 · 하늘바퀴 · 하늘고리 「관」 ──
  _megaInit() {
    this.mega = [];
    const g = this.game, M = g.megacity, city = g.city;
    if (!M || !M.towers || !city || !city.parch || !city.propMat) return;
    const mats = [];
    for (const T of M.towers) {
      if (!T.tiers || !T.tiers.length) continue;
      const pr = (T.kind === 'stack' ? T.r * 0.9 : T.r) * 1.9;
      // 안쪽 탑은 하늘고리 쪽(바깥), 나머지는 척추 쪽 광장 끝에
      const a0 = T.id.startsWith('t-in') ? Math.atan2(T.z, T.x) : Math.atan2(-T.z, -T.x);
      let c = null;
      for (const da of [0, 0.5, -0.5, 1.0, -1.0, 1.6, -1.6, 2.4, -2.4, 3.14]) {
        const a = a0 + da, nx = Math.cos(a), nz = Math.sin(a);
        const x = T.x + nx * (pr + 2.2), z = T.z + nz * (pr + 2.2);
        const h = heightAt(x, z);
        if (h < 0.8 || Math.abs(h - T.g0) > 6 || !this._clear(x, z, h + 0.3, h + 3, 1.2)) continue;
        c = { x, z, y: h + 0.02, nx, nz, yaw: Math.atan2(nx, nz), mega: T, key: 'mega:' + T.id, def: { fn: 'megalift', name: T.grand ? '구역 큰 탑' : T.id.startsWith('t-in') ? '안쪽 탑' : '위성 탑', short: '승강판' } };
        break;
      }
      if (!c) continue;
      this.mega.push(c);
      g.world.colliders.add({ type: 'cyl', x: c.x, z: c.z, r: 0.42, y0: c.y - 0.3, y1: c.y + 1.5, city: true });
      mats.push(new THREE.Matrix4().compose(V3(c.x, c.y, c.z), new THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), c.yaw), V3(1, 1, 1)));
    }
    // 발치 마을·하늘바퀴·하늘고리 위의 집: 주민 부탁함 (갑판 위 집은 고리를 따라 옆에)
    (M.homes || []).forEach((H, k) => {
      // 갑판 위 집은 고리를 따라(접선) 양옆, 땅 위 집은 척추 쪽부터 돌아가며
      const dirs = H.halo ? [[-Math.sin(H.a), Math.cos(H.a)], [Math.sin(H.a), -Math.cos(H.a)]]
        : [0, 0.8, -0.8, 1.6, -1.6, 2.4, -2.4, Math.PI].map((da) => { const a = Math.atan2(-H.z, -H.x) + da; return [Math.cos(a), Math.sin(a)]; });
      for (const [nx, nz] of dirs) {
        const x = H.x + nx * (H.r + 1.7), z = H.z + nz * (H.r + 1.7);
        const y = H.halo ? H.y + 0.02 : heightAt(x, z) + 0.02;
        if (!H.halo && (y < 0.8 || Math.abs(y - H.y) > 3)) continue;
        if (!this._clear(x, z, y + 0.3, y + 3, 1.0)) continue;
        const rec = { kind: 'mhome', idx: k, use: 'home', x: H.x, z: H.z, gy: H.y, base: H.y, top: H.y + H.h, sx: H.r, sz: H.r, sy: H.h, rot: 0, zone: 'megacity' };
        const c = { x, z, y, nx, nz, yaw: Math.atan2(nx, nz), rec, key: 'mhome:' + k, def: { fn: 'tower', name: H.halo === 'halo-crown' ? '하늘고리 집' : H.halo ? '하늘바퀴 집' : '발치 마을 집', short: '부탁함' } };
        this.mega.push(c);
        g.world.colliders.add({ type: 'cyl', x, z, r: 0.42, y0: y - 0.3, y1: y + 1.5, city: true, sky: y > 300 });
        mats.push(new THREE.Matrix4().compose(V3(x, y, z), new THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), c.yaw), V3(1, 1, 1)));
        break;
      }
    });
    if (mats.length) {
      const m = new THREE.InstancedMesh(city.parch.console, city.propMat, mats.length);
      mats.forEach((M4, i) => m.setMatrixAt(i, M4));
      m.frustumCulled = false;
      this.group.add(m);
    }
  }
  _megalift(c) {
    const g = this.game, T = c.mega, M = g.megacity;
    const items = [];
    const tier = this._megaTop(c, 'tier');
    if (tier) items.push({ label: `승강판 · ${tier.name}`, sub: '탑 허리의 하늘정원 (뛰어내려 활공해도 돼요)', primary: true, onClick: () => this._liftUp(c, tier) });
    const halo = T.grand ? this._megaTop(c, 'wheel') : T.id.startsWith('t-in') ? this._megaTop(c, 'crown') : null;
    if (halo) items.push({ label: `승강판 · ${halo.name}`, sub: T.grand ? '탑을 두른 하늘바퀴 — 그 위에도 집과 정원이 있다' : '척추를 감싼 지름 3 km 의 공중 고리 구역', onClick: () => this._liftUp(c, halo) });
    if (!items.length) { g.ui.toast('승강판이 정비 중이에요', { kind: 'muted' }); return; }
    g.ui.serviceCard(`하모네아 · ${c.def.name}`, '어디로 오를까요?', `높이 ${Math.round(T.h)} m 의 탑. 빛 원판이 바깥으로 돌아 올라간다 (뛰기·E 로 빨리 가기).`, items);
    void M;
  }
  /** 거대 탑의 갈 곳: 'tier' 가장 높은 하늘정원 층 · 'wheel' 구역 하늘바퀴 · 'crown' 하늘고리 「관」 */
  _megaTop(c, kind) {
    const T = c.mega, M = this.game.megacity;
    const a = Math.atan2(c.z - T.z, c.x - T.x);
    const TRmax = Math.max(...T.tiers.map((t) => t.TR));
    if (kind === 'tier') {
      // 가장 높은(서 있을 자리가 있는) 하늘정원 층: 탑 몸통에서 조금 떨어진 빈 자리 (층의 충돌체 반지름 TR 안)
      for (const tr of T.tiers.slice().sort((p, q) => q.y - p.y)) {
        for (const da of [0, 0.25, -0.25, 0.5, -0.5]) {
          const b = a + da;
          for (let rs = tr.ra + 1; rs < tr.TR - 2.5; rs += 1.5) {
            const x = T.x + Math.cos(b) * rs, z = T.z + Math.sin(b) * rs;
            if (!this._clear(x, z, tr.y + 0.6, tr.y + 2.6, 0.9)) continue;
            return { x, y: tr.y + 0.35, z, ax: Math.cos(b), az: Math.sin(b), Rs: TRmax + 30, hy: tr.y + 6, name: `하늘정원 층 (${Math.round(tr.ty)} m)`, cx: T.x, cz: T.z, mark: c };
          }
        }
      }
      return null;
    }
    const H = kind === 'crown' ? M.halos.find((h) => h.id === 'halo-crown') : M.halos.find((h) => h.id === T.id.replace('-grand', '') + '-wheel');
    if (!H) return null;
    // 갑판 위 빈 자리 (집·첨탑을 피해)
    const base = kind === 'crown' ? Math.atan2(T.z - H.z, T.x - H.x) : a;
    for (const da of [0, 0.03, -0.03, 0.06, -0.06, 0.1, -0.1, 0.15, -0.15]) {
      const b = base + da * (kind === 'crown' ? 1 : 3);
      const x = H.x + Math.cos(b) * H.R, z = H.z + Math.sin(b) * H.R;
      if (!this._clear(x, z, H.y + 0.5, H.y + 4, 3.5)) continue;
      const ax = x - T.x, az = z - T.z, d = Math.hypot(ax, az);
      const Rs = kind === 'crown' ? Math.min(TRmax + 30, d - H.w / 2 - 25) : H.Ro + 30;
      return { x, y: H.y + 0.05, z, ax: ax / d, az: az / d, Rs, hy: H.y + 6, name: kind === 'crown' ? '하늘고리 「관」 갑판' : `하늘바퀴 갑판 (${Math.round(H.y - T.g0)} m)`, cx: T.x, cz: T.z, mark: c };
    }
    return null;
  }

  // ── 승강판 ─────────────────────────────
  /** 그 랜드마크의 꼭대기 자리와 오르는 길 */
  _top(c) {
    const r = c.rec, D = TOPS[r.kind];
    if (!D) return null;
    const cs = Math.cos(r.rot), sn = Math.sin(r.rot);
    const W = (lx, lz) => [r.x + lx * cs + lz * sn, r.z - lx * sn + lz * cs];
    const th = Math.atan2(c.z - r.z, c.x - r.x); // 조작대 쪽
    let tx, tz, ty, ax, az;
    if (D.pads) {
      const pads = LANDMARKS.lm_port.pads.slice(4, 6);
      let best = null, bd = 9;
      for (const [px, py, pz] of pads) { const [wx, wz] = W(px, pz); const a = Math.atan2(wz - r.z, wx - r.x); const d = Math.abs(angDiff(a, th)); if (d < bd) { bd = d; best = [wx, py, wz, a]; } }
      [tx, ty, tz] = best; ax = Math.cos(best[3]); az = Math.sin(best[3]);
    } else if (D.axisZ) {
      let best = null, bd = 9;
      for (const s of [-1, 1]) { const [wx, wz] = W(0, s); const a = Math.atan2(wz - r.z, wx - r.x); const d = Math.abs(angDiff(a, th)); if (d < bd) { bd = d; best = a; } }
      ax = Math.cos(best); az = Math.sin(best); tx = r.x; tz = r.z; ty = D.y;
    } else {
      let a = th;
      if (r.kind === 'lm_coil') {
        // 코일 관(셋)을 피한 방향으로
        for (let k = 0; k < 3; k++) { const la = (k / 3) * TAU + 0.3; const [wx, wz] = W(Math.cos(la), Math.sin(la)); const ta = Math.atan2(wz - r.z, wx - r.x); if (Math.abs(angDiff(a, ta)) < 0.25) a = ta + 0.5 * Math.sign(angDiff(a, ta) || 1); }
      }
      ax = Math.cos(a); az = Math.sin(a); tx = r.x + ax * D.r; tz = r.z + az * D.r; ty = D.y;
    }
    return { x: tx, y: r.base + ty, z: tz, ax, az, Rs: D.Rs, hy: r.base + ty + D.over, name: D.name, cx: r.x, cz: r.z, mark: c, pads: !!D.pads, axis: !!D.axisZ };
  }
  _liftPath(c, T) {
    const y0 = c.y, sx = c.x + c.nx * 1.8, sz = c.z + c.nz * 1.8;
    // 오르는 기둥: 구조물 밖(Rs)에서, 막혀 있으면 조금 옆·바깥으로
    let Rx = T.cx + T.ax * T.Rs, Rz = T.cz + T.az * T.Rs, lo = y0 + 9;
    const free = T.pads || T.axis ? [0] : [0, 0.3, -0.3, 0.6, -0.6, 0.9, -0.9];
    search: for (const dR of [0, 10, 22, -8]) for (const da of free) {
      const a = Math.atan2(T.az, T.ax) + da, R = T.Rs + dR;
      const x = T.cx + Math.cos(a) * R, z = T.cz + Math.sin(a) * R;
      if (this._clear(x, z, y0 + 6, T.hy + 3, 2.4)) { Rx = x; Rz = z; break search; }
    }
    // 낮은 길(조작대 → 기둥)이 막혔으면 더 높이
    for (const h of [9, 16, 26, 40]) {
      let ok = true;
      for (let k = 0.1; k <= 1; k += 0.1) if (!this._clear(sx + (Rx - sx) * k, sz + (Rz - sz) * k, y0 + h - 1.5, y0 + h + 3, 1.6)) { ok = false; break; }
      lo = y0 + h;
      if (ok) break;
    }
    return [V3(sx, y0 + 0.15, sz), V3(sx, lo, sz), V3(Rx, lo, Rz), V3(Rx, T.hy, Rz), V3(T.x, T.hy, T.z), V3(T.x, T.y + 0.15, T.z)];
  }
  _liftUp(c, T) {
    this._lift(this._liftPath(c, T), T, () => {
      if (!this.tops.includes(T)) this.tops.push(T);
      this.game.ui.regionTitle(T.mark.def.name, `${T.name} · 뛰어내려 활공하거나, 승강판으로 내려가요`, false);
      this.V._learn('up');
    });
  }
  _liftDown(T) {
    this._lift(this._liftPath(T.mark, T).reverse(), T, () => { this.tops = this.tops.filter((q) => q !== T); });
  }
  /** 마디마다 천천히 섰다 가는 승강판 (오르내림은 빠르게) */
  _lift(pts, T, onArrive) {
    const g = this.game, disc = this.disc;
    const segs = [];
    let total = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], L = a.distanceTo(b);
      if (L < 0.05) continue;
      const vert = Math.abs(b.y - a.y) > L * 0.7;
      const dur = Math.max(1.2, vert ? L / Math.max(26, L / 14) : L / Math.max(12, L / 9)); // 아주 높은 탑도 14초 안에
      segs.push({ a, b, dur, t0: total });
      total += dur;
    }
    const P = V3(0, 0, 0), cam = { pos: V3(0, 0, 0), look: V3(0, 0, 0) };
    const side = V3(-T.az, 0, T.ax);
    let t = 0;
    const ride = {
      done: false, cam, showAvatar: true,
      step: (dt, player) => {
        t += dt;
        const k = Math.min(total, t);
        let S = segs[segs.length - 1];
        for (const s of segs) if (k <= s.t0 + s.dur) { S = s; break; }
        const e = Math.min(1, (k - S.t0) / S.dur);
        P.lerpVectors(S.a, S.b, e * e * (3 - 2 * e));
        disc.visible = true;
        disc.position.set(P.x, P.y - 0.13, P.z);
        disc.rotation.y = this.t * 0.4;
        player.pos.copy(P);
        player.vel.set(0, 0, 0);
        // 랜드마크 바깥에서 비스듬히: 도시가 발아래로 멀어진다
        const sw = Math.sin(this.t * 0.18) * 8;
        cam.pos.set(P.x + T.ax * 24 + side.x * sw, P.y + 7, P.z + T.az * 24 + side.z * sw);
        cam.look.set(P.x, P.y + 1.4, P.z);
        if (t >= total) {
          ride.done = true;
          disc.visible = false;
          const end = pts[pts.length - 1];
          player.pos.set(end.x, end.y + 0.05, end.z);
          g.rig.override = null;
          onArrive && onArrive();
        }
        return ride;
      },
      skip: () => { t = Math.max(t, total - 1.0); },
    };
    g.player.enterRide(ride);
    audio.noise({ freq: 200, q: 0.6, dur: 3, gain: 0.5, type: 'lowpass', attack: 0.6 });
    audio.chime('soft');
  }

  // ── 보이는 효과 ─────────────────────────────
  /** 넓어지는 빛 고리 */
  _pulse(pos, color, R, dur) {
    const m = this._glow(new THREE.TorusGeometry(1, 0.012, 4, 96).rotateX(Math.PI / 2), color, 2.0);
    m.position.copy(pos);
    this.group.add(m);
    let ph = 0;
    this.fx.push((dt) => {
      ph += dt;
      const k = ph / dur;
      if (k >= 1) { this.group.remove(m); m.geometry.dispose(); m.material.dispose(); return true; }
      const s = 6 + (R - 6) * (1 - Math.pow(1 - k, 2));
      m.scale.set(s, Math.max(1, s * 0.05), s);
      m.material.uniforms.uIntensity.value = 2.2 * (1 - k);
      return false;
    });
  }
  /** 빛 알갱이가 건물에서 플레이어에게로 */
  _orbs(from, n, color) {
    const pl = this.game.player.pos;
    for (let i = 0; i < n; i++) {
      const m = this._glow(new THREE.IcosahedronGeometry(0.22, 0), color, 2.4);
      const A = from.clone().add(V3((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 8));
      const mid = A.clone().lerp(V3(pl.x, pl.y + 1, pl.z), 0.5).add(V3(0, 6 + Math.random() * 6, 0));
      m.position.copy(A);
      this.group.add(m);
      let ph = -i * 0.08;
      this.fx.push((dt) => {
        ph += dt;
        const k = Math.max(0, Math.min(1, ph / 1.2));
        const B = V3(pl.x, pl.y + 1.1, pl.z);
        const q = 1 - k;
        m.position.set(q * q * A.x + 2 * q * k * mid.x + k * k * B.x, q * q * A.y + 2 * q * k * mid.y + k * k * B.y, q * q * A.z + 2 * q * k * mid.z + k * k * B.z);
        if (k >= 1) { this.group.remove(m); m.geometry.dispose(); m.material.dispose(); return true; }
        return false;
      });
    }
    audio.sing && audio.sing([4, 2, 3], { gain: 0.18, step: 0.18 });
  }

  /** 일하는 모습: 둘레의 설비가 가끔 김을 뿜고, 코일이 번쩍이고, 안테나가 신호를 보내고, 생장 나무가 홀씨를 날린다 */
  _ambient(dt) {
    const g = this.game, city = g.city;
    if (!city || !city.blocksNear || this.game.interiors.cur) return;
    if ((this._ambT = (this._ambT || 0) - dt) > 0) return;
    this._ambT = 0.7;
    const p = g.player.pos;
    if (!this._near || (this._nearT = (this._nearT || 0) - 0.7) < 0) {
      this._nearT = 3;
      this._near = [];
      for (const B of city.blocksNear(p.x, p.z, 260)) if (B.act && B.ext) for (const c of B.ext) if (c.def.fn !== 'tower' && c.def.fn !== 'guide' && c.def.fn !== 'taxi') this._near.push(c);
    }
    const c = this._near[Math.floor(Math.random() * this._near.length)];
    if (!c) return;
    const r = c.rec, top = V3(r.x, r.base + r.sy, r.z);
    if (c.def.fn === 'maint') g.particles.emit({ pos: top, count: 14, spread: 1.4, up: 5, life: 2.6, size: [2, 7], color: 0xf4f0ff, alpha: 0.32, drag: 0.6, gravity: -0.4 });
    else if (c.def.fn === 'charge') this._pulse(V3(r.x, r.base + r.sy * (0.3 + Math.random() * 0.55), r.z), 0xbffcff, r.sx * 1.5, 0.7);
    else if (c.def.fn === 'signal') this._pulse(top, 0x7ff3e6, 45, 1.6);
    else if (c.def.fn === 'harvest') g.particles.emit({ pos: V3(r.x, r.base + r.sy * 0.75, r.z), count: 12, spread: r.sx * 0.3, up: 1.5, life: 4, size: [0.3, 0.8], color: Math.random() < 0.5 ? 0xffd27a : 0x9fffc8, alpha: 0.9, add: true, drag: 0.4, gravity: -0.15 });
    else if (c.def.fn === 'drones') this._pulse(V3(r.x, r.base + r.sy * 0.58, r.z), 0xffd27a, r.sx * 1.2, 1.0);
    else if (r.kind === 'lm_coil') this._pulse(V3(r.x, r.base + 60 + Math.random() * 240, r.z), 0xffd27a, 70, 1.2);
    else if (r.kind === 'lm_ear') this._pulse(V3(r.x, r.base + 372, r.z), 0x7ff3e6, 120, 2.2);
  }

  update(dt) {
    this.t += dt;
    this._ambient(dt);
    for (let i = this.fx.length - 1; i >= 0; i--) if (this.fx[i](dt, this.t)) this.fx.splice(i, 1);
    // 꼭대기에서 멀어지면(뛰어내림) 내려가기 표시를 지운다
    if (this.tops.length) {
      const p = this.game.player.pos;
      this.tops = this.tops.filter((T) => Math.hypot(p.x - T.x, p.z - T.z) < 120 && p.y > T.y - 40);
    }
  }
}

/** 건물 평면의 대략 반지름 (미터) */
function planR(r) { return Math.max(r.sx, r.sz) * 0.9; }
void WORD;
