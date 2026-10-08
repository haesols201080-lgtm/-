// 실내의 사람들 (v0.9): 건물에서 일하고·사고·묵고·배우는 주민이 지금 층에서 실제로 걸어 다니며 시설을 쓴다.
//  · 사람마다 「할 일 묶음(plan)」: [{go: 가구 또는 자리}, {act: 몸짓, t: 초}, {fx: 운영에 주는 영향}] 를 차례로.
//    마트 손님은 진열대 앞에서 물건을 집어 바구니에 담고(재고가 실제로 줄고), 계산대 줄에 서서 값을 치르고(돈이 가구 → 가게 금고) 나간다.
//    직원은 창고 선반에서 상자를 들고 와 진열대를 채운다(창고 → 진열대). 공장 일꾼은 원료를 기계에 넣고 완성품을 나른다…
//  · 같은 운영 규칙을 플레이어도 쓴다(ops) — 사람이 하는 일과 플레이어가 하는 일이 같은 장부를 바꾼다.
//  · 그리기는 주민 무리(citizens.crowd)와 같은 몸(자세·손에 든 것: 상자 5 · 바구니 8).
import * as THREE from 'three';
import { findPath, navGrid, snap } from './nav.js';
import { SYL_A, SYL_B } from '../data/citizens.js';
import { hashStr, mulberry32 } from '../core/noise.js';
import { AwenMotion } from '../world/crowd.js';

const GLOWS = [0x7ff3e6, 0xffc46a, 0xff9fd0, 0xb9a6ff].map((h) => new THREE.Color(h));
let _id = 0;
const SEATED = new Set(['sit', 'sitType', 'eat', 'study', 'lie']);

export class Agents {
  /** ind: Indoor, ops: 운영 */
  constructor(game, ind, ops) {
    this.game = game; this.ind = ind; this.ops = ops;
    this.list = [];
    this.nav = new Map(); // 층 → 걸음 칸
    this.t = 0;
  }
  navOf(i) {
    if (this.nav.has(i)) return this.nav.get(i);
    const pl = this.ind.plan(i);
    if (!pl || pl.L.closed) return null;
    const N = navGrid(this.ind.B, pl.L, pl.fix);
    this.nav.set(i, N);
    return N;
  }
  /** 사람 하나 (key 로 늘 같은 이름·얼굴) */
  spawn(spec) {
    const key = spec.key || `a${_id++}`;
    const q = mulberry32(hashStr(key));
    const hue = q();
    const age = spec.age || (q() < 0.12 ? 'elder' : q() < 0.1 ? 'child' : 'adult');
    const a = {
      key, id: 'ind:' + key, role: spec.role, title: spec.title || '', floor: spec.floor, plan: spec.plan || [], step: 0, wait: 0,
      name: SYL_A[Math.floor(q() * SYL_A.length)] + SYL_B[Math.floor(q() * SYL_B.length)],
      skin: new THREE.Color().setHSL(hue, 0.32, 0.8), deep: new THREE.Color().setHSL((hue + 0.1) % 1, 0.45, 0.5), glow: GLOWS[Math.floor(q() * 4)],
      scale: age === 'child' ? 0.6 : 0.86 + q() * 0.18, ph: q(), speed: 1.1 + q() * 0.4,
      pos: new THREE.Vector3(), yaw: 0, gx: spec.gx, gz: spec.gz, path: null, pk: 0, hold: 0, pose: null, mo: new AwenMotion(q()),
      anim: { armL: 0.1, armR: 0.1, head: 0, kneel: 0, hold: 0, speak: 0 }, carry: null, basket: null, data: spec.data || {}, done: false, indoorRole: true,
      next: spec.next, fr: 0,
    };
    a.fig = { speak: (d) => { a.anim.speakT = d; }, look: null, gesture: 0 };
    this._place(a);
    this.list.push(a);
    return a;
  }
  _place(a) {
    const [x, z] = this.ind.world(a.gx, a.gz);
    a.pos.set(x, this.ind.yOf(a.floor), z);
  }
  remove(a) { const k = this.list.indexOf(a); if (k >= 0) this.list.splice(k, 1); }
  clear() { this.list = []; }
  /** 지금 층 둘레의 사람 (문 열기·그리기) */
  near() { const cur = this.ind.cur; return this.list.filter((a) => a.floor === cur || Math.abs(a.floor - cur) <= 1); }

  /** 틀 좌표 (gx, gz) 로 걸어간다 (같은 층) */
  _route(a, gx, gz) {
    const N = this.navOf(a.floor);
    if (!N) return false;
    const p = findPath(N, a.gx, a.gz, gx, gz, 30000);
    if (!p) return false;
    a.path = p; a.pk = 1; a.dest = [gx, gz];
    return true;
  }
  /**
   * 갈 자리를 이미 다른 사람이 쓰거나 가는 중이면 (같은 진열대·같은 줄·같은 전시) 바로 옆의 걸을 수 있는 빈 칸으로 —
   * 두 사람이 한 점에 겹쳐 서지 않게. 반환 [x, z, 옮겼나]
   */
  _spot(a, x, z) {
    const taken = (px, pz) => this.list.some((b) => b !== a && !b.done && b.floor === a.floor && Math.hypot((b.dest ? b.dest[0] : b.gx) - px, (b.dest ? b.dest[1] : b.gz) - pz) < 0.55);
    if (!taken(x, z)) return [x, z, false];
    const N = this.navOf(a.floor);
    if (!N) return [x, z, false];
    for (const r of [0.6, 0.95]) for (let k = 0; k < 8; k++) {
      const t = (k / 8) * Math.PI * 2 + (a.ph * 6.28) % 0.8, x2 = x + Math.cos(t) * r, z2 = z + Math.sin(t) * r;
      const c = snap(N, x2, z2, 0);
      if (c && !taken(x2, z2)) return [x2, z2, true];
    }
    return [x, z, false];
  }
  /**
   * 처음 채운 층: 사람들이 이미 한동안 그 건물에서 지낸 모습으로 시작한다 (v24 「건물 입장 시 한 지점 뭉침」) —
   * 손님·관람객은 정문 안쪽에서 차례로 들어오도록 짜여 있어서, 그대로 두면 들어서는 순간 모두 입구 한 자리에 겹쳐 있다가 흩어졌다.
   * 걷기·할 일(재고·값 치르기 같은 운영 효과 포함)만 secs 초 동안 빠르게 돌린다 — 그리기·몸짓·플레이어 비키기는 하지 않는다.
   */
  prewarm(floor, secs = 60, dt = 0.25) {
    const L = this.list.filter((a) => a.floor === floor);
    for (let t = 0; t < secs; t += dt) for (const a of L) if (!a.done) this._walk(a, dt);
    for (const a of L) {
      if (a.done) { this.remove(a); continue; }
      this._place(a);
      a.yaw = a.faceYaw ?? a.wantYaw ?? a.yaw;
    }
  }
  /** 한 사람의 걸음·할 일 하나 (update 와 prewarm 이 같이 쓴다). 반환: 움직인 속도 */
  _walk(a, dt) {
    if (a.path && a.pk < a.path.length) {
      const [tx, tz] = a.path[a.pk];
      const dx = tx - a.gx, dz = tz - a.gz, d = Math.hypot(dx, dz);
      const sp = a.speed * (a.carry ? 0.85 : 1);
      let moving = 0;
      if (d < 0.08) a.pk++;
      else {
        const k = Math.min(1, (sp * dt) / d);
        a.gx += dx * k; a.gz += dz * k; moving = sp;
        a.wantYaw = Math.atan2(dx, dz) + this.ind.B.theta;
      }
      if (a.pk >= a.path.length) a.path = null;
      return moving;
    }
    if (a.wait > 0) a.wait -= dt;
    else this._next(a);
    return 0;
  }

  update(dt) {
    this.t += dt;
    const g = this.game, ind = this.ind;
    const T = this.t;
    for (const a of this.list.slice()) {
      if (a.done) { this.remove(a); continue; }
      // 걷기
      const moving = this._walk(a, dt);
      // 플레이어를 비켜 간다 (같은 층)
      const [wx, wz] = ind.world(a.gx, a.gz);
      const pp = g.player.pos;
      a.pos.set(wx, ind.yOf(a.floor), wz);
      if (Math.abs(pp.y - a.pos.y) < 2 && Math.hypot(pp.x - wx, pp.z - wz) < 0.7 && moving) { a.gx -= Math.sin(a.wantYaw - ind.B.theta) * 0.02; }
      const want = a.faceYaw != null && !moving ? a.faceYaw : a.wantYaw ?? a.yaw;
      const dyaw = Math.atan2(Math.sin(want - a.yaw), Math.cos(want - a.yaw));
      a.yaw += dyaw * Math.min(1, dt * 6);
      a.moving = moving;
      this._pose(a, T, dt);
    }
  }
  /** 다음 할 일 */
  _next(a) {
    if (a.step >= a.plan.length) {
      if (a.next) { const p = a.next(a); if (p && p.length) { a.plan = p; a.step = 0; return; } }
      a.done = true;
      return;
    }
    const s = a.plan[a.step++];
    a.faceYaw = null;
    if (s.go) {
      const [x0, z0] = typeof s.go === 'function' ? s.go(a) : s.go;
      const [x, z, moved] = this._spot(a, x0, z0);
      a.offSeat = moved; // 자리를 남이 쓰면 옆에 서서 기다린다 (허공에 앉지 않게)
      if (!this._route(a, x, z)) { a.wait = 0.5; }
      return;
    }
    if (s.face != null) a.faceYaw = s.face + this.ind.B.theta;
    if (s.act) { a.pose = a.offSeat && SEATED.has(s.act) ? 'wait' : s.act; a.wait = s.t ?? 2; }
    if (s.fx) { try { s.fx(a); } catch (e) { console.warn('[agents]', e); } }
    if (s.wait) a.wait = s.wait;
    if (s.until) { a.step--; a.wait = 0.5; if (s.until(a)) a.step++; }
  }
  /** 몸짓: 하는 일에 맞게 (crowd 셰이더의 관절 값) */
  _pose(a, T, dt) {
    const an = a.anim, ph = T + a.ph * 10;
    let armL = 0.1, armR = 0.1, head = 0, kneel = 0, hold = 0;
    if (a.carry) { armL = armR = 0.9; hold = 5; }
    else if (a.basket) { armR = 0.25; hold = 8; }
    if (!a.moving) switch (a.pose) {
      case 'reach': armR = 1.6 + Math.sin(ph * 3) * 0.2; head = -0.2; break;
      case 'stock': armL = armR = 1.2 + Math.sin(ph * 2.4) * 0.3; hold = 5; break;
      case 'scan': armR = 0.9 + Math.sin(ph * 6) * 0.25; armL = 0.5; head = 0.3; break;
      case 'type': armL = 0.95 + Math.sin(ph * 9) * 0.05; armR = 0.95 + Math.cos(ph * 8) * 0.05; head = 0.15; break;
      case 'sit': kneel = 0.48; armL = armR = 0.3; break;
      case 'sitType': kneel = 0.48; armL = armR = 0.85 + Math.sin(ph * 9) * 0.05; head = 0.15; break;
      case 'eat': kneel = 0.48; armR = 0.6 + Math.max(0, Math.sin(ph * 1.3)) * 0.8; break;
      case 'operate': armL = 0.8 + Math.sin(ph * 2) * 0.2; armR = 1.1 + Math.cos(ph * 2.3) * 0.2; head = 0.2; break;
      case 'teach': armR = 0.4 + Math.max(0, Math.sin(ph * 1.5)) * 1.4; an.speak = Math.sin(ph * 1.5) > 0.3 ? 0.7 : 0; break;
      case 'study': kneel = 0.48; armL = armR = 0.35 + (Math.sin(ph * 0.8 + a.ph * 6) > 0.95 ? 2.0 : 0); head = 0.1; break;
      case 'lie': kneel = 1; head = 0.6; break;
      case 'talk': armR = 0.4 + Math.sin(ph * 3) * 0.3; an.speak = 0.6; break;
      case 'cook': armL = 0.9 + Math.sin(ph * 4) * 0.2; armR = 0.8 + Math.cos(ph * 3.4) * 0.25; head = 0.3; break;
      case 'tend': kneel = 0.8; armL = 0.9; armR = 0.85 + Math.sin(ph * 2) * 0.2; head = 0.35; hold = 7; break;
      case 'look': head = -0.15 + Math.sin(ph * 0.4) * 0.1; break;
      case 'sing': armL = armR = 0.7 + Math.sin(ph * 2) * 0.5; an.speak = 0.7; break;
      case 'wait': armL = armR = 0.25; break;
      default: break;
    }
    const k = Math.min(1, dt * 8);
    an.armL += (armL - an.armL) * k; an.armR += (armR - an.armR) * k; an.head += (head - an.head) * Math.min(1, dt * 5); an.kneel += (kneel - an.kneel) * Math.min(1, dt * 4);
    an.hold = hold;
    an.speakT = Math.max(0, (an.speakT || 0) - dt);
    if (an.speakT > 0) an.speak = 1;
  }
  /** 무리 그리기 (citizens.update 가 vis 로 그린다) — 지금 층 사람만 */
  visible() {
    // 지금 셀(이 방·구역)에 있는 사람만 — 다른 방의 사람은 문 너머에서 보이지 않는다 (그 방은 짓지 않았다)
    const ind = this.ind;
    return this.list.filter((a) => ind.parts.has(a.floor) ? ind.inCellGrid(a.floor, a.gx, a.gz) : false);
  }
  /** 둘레의 걸을 수 있는 칸 하나 (틀 좌표) */
  freeNear(i, gx, gz) { const N = this.navOf(i); if (!N) return [gx, gz]; const s = snap(N, gx, gz, 8); return s ? [N.ox + (s[0] + 0.5) / 2, N.oz + (s[1] + 0.5) / 2] : [gx, gz]; }
}
