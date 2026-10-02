// 도시의 주민: 블록마다 놓인 자리(장터·정원·놀이터·광장·작업장·정류장·관측대…)에서 하루 일과대로 실제로 일하고 쉬고 논다.
//  · 사람은 자리마다 정해져 있다(자리 id + 순번 → 이름·얼굴·나이·일과). 플레이어 둘레 자리의 사람만 살려 낸다.
//  · 일과: 그 시각이 일하는 시간이면 자리에서 일하고(장터지기는 손님을 맞고, 정원지기는 무릎 꿇고 꽃을 돌보고,
//    아이들은 뛰어놀고, 악사는 연주하고…), 앞뒤로는 집 문에서 걸어 나오고 들어간다. 시간 밖이면 집 안에 있다.
//  · 말 걸기(E): 이야기 · 함께 놀기(술래잡기·노래 주고받기·꽃 가꾸기·짐 나르기·장치 음 맞추기·함께 고요해지기) · 장터 거래 ·
//    선물 · 친해지면 집에 초대. 친한 정도는 저장된다.
//  · 사람은 단단하다: 플레이어가 지나갈 수 없고, 사람도 플레이어를 피해 걷는다.
import * as THREE from 'three';
import { Crowd } from '../world/crowd.js';
import { ROLES, INDOOR, CIT_LINES, SYL_A, SYL_B, GOODS } from '../data/citizens.js';
import { hashStr, mulberry32 } from '../core/noise.js';
import { audio } from '../core/audio.js';
import { heightAt } from '../world/heightfield.js';
import { glowMaterial } from '../world/materials.js';
import { bus } from '../core/events.js';

const TAU = Math.PI * 2;
const GLOWS = [0x7ff3e6, 0xffc46a, 0xff9fd0, 0xb9a6ff].map((h) => new THREE.Color(h));
const DAY = 1200;
const _v = new THREE.Vector3();

/** 하루 시각 t 가 [a, b] (b 가 1 을 넘으면 다음 날까지) 안인가 → 그 안에서의 위치 */
function inWin(t, a, b) {
  if (t >= a && t <= b) return t;
  if (b > 1 && t + 1 >= a && t + 1 <= b) return t + 1;
  return -1;
}

export class Citizens {
  constructor(game) {
    this.game = game;
    this.city = game.city;
    const f = game.engine.q.flora ?? 0.9;
    this.max = f < 0.5 ? 50 : f < 0.7 ? 90 : 130;
    this.R = f < 0.5 ? 90 : 125;
    this.crowd = new Crowd(game.engine.scene, this.max + 16);
    this.people = new Map(); // key → 사람 (가까이 있는 동안 기억)
    this.vis = []; // 이번 프레임에 그린 사람
    this.scanT = 0;
    this.sayT = 3;
    this.game.lines = this.game.lines || {};
    this.markers = [];
    this.activity = null; // 진행 중인 함께 하기
    this.indoor = []; // 실내 사람 (interiors 가 넣는다)
    this.markMat = glowMaterial({ color: 0x9ff6ff, intensity: 2.2 });
    bus.on('tone', (e) => this._onTone(e));
  }

  get S() {
    const s = this.game.state;
    if (!s.cit) s.cit = { f: {}, talked: {}, trinkets: 0 };
    return s.cit;
  }
  friend(key) { return this.S.f[key] || 0; }
  addFriend(p, n) {
    const v = Math.min(5, this.friend(p.key) + n);
    this.S.f[p.key] = v;
    p.fr = v;
    if (n > 0) this.game.ui.toast(`${p.name} · 친한 정도 ${'♥'.repeat(v)}${'♡'.repeat(5 - v)}`, { kind: 'item' });
  }

  // ── 사람 만들기 (자리 + 순번 → 늘 같은 사람) ─────────
  _person(spot, i, roleOverride) {
    const key = `${spot.id}#${i}`;
    let p = this.people.get(key);
    if (p) return p;
    const r = mulberry32(hashStr(key));
    const role = roleOverride || spot.type;
    const R = ROLES[role] || ROLES.stroll;
    const age = R.age || (r() < 0.14 ? 'elder' : r() < 0.2 && role !== 'carry' && role !== 'console' ? 'child' : 'adult');
    const hue = r();
    p = {
      key, spot, i, role, age, id: 'cit:' + key,
      name: SYL_A[Math.floor(r() * SYL_A.length)] + SYL_B[Math.floor(r() * SYL_B.length)],
      skin: new THREE.Color().setHSL(hue, 0.32, 0.8), deep: new THREE.Color().setHSL((hue + 0.1) % 1, 0.45, 0.5), glow: GLOWS[Math.floor(r() * 4)],
      scale: age === 'child' ? 0.58 + r() * 0.08 : age === 'elder' ? 0.9 + r() * 0.06 : 0.86 + r() * 0.2,
      jit: (r() - 0.5) * 0.03, jit2: (r() - 0.5) * 0.03, ph: r(), speed: age === 'child' ? 2.0 : age === 'elder' ? 1.0 : 1.35,
      pos: new THREE.Vector3(spot.x, spot.y, spot.z), yaw: spot.yaw || 0, walkPh: r() * TAU, placed: false,
      anim: { armL: 0, armR: 0, head: 0, kneel: 0, hold: 0, speak: 0 },
      seen: 0,
    };
    p.title = ROLES[role] ? ROLES[role].label : '';
    p.fr = this.friend(key);
    // 주민도 말할 때 몸이 빛난다 (game.say 가 fig.speak 를 부른다)
    p.fig = { speak: (d) => { p.anim.speakT = d; }, look: null, gesture: 0 };
    // 사는 집: 자리 가까이의 들어갈 수 있는 건물 문 하나
    const homes = this.city.recsNear(spot.x, spot.z, 110);
    if (homes.length) {
      const pref = homes.filter((h) => h.use === 'home');
      const pool = pref.length && r() < 0.75 ? pref : homes;
      p.home = pool[Math.floor(r() * pool.length)];
    }
    this.people.set(key, p);
    return p;
  }

  /** 사람이 자리에서 머무는 점 (모둠은 둘레에 퍼진다) */
  _slot(p, T) {
    const s = p.spot, n = p.groupN || 1, i = p.i;
    switch (p.role) {
      case 'chat': { const a = (i / n) * TAU + s.yaw; return [s.x + Math.sin(a) * 1.1, s.z + Math.cos(a) * 1.1, a + Math.PI]; }
      case 'meditate': { const R = Math.max(2.5, (s.r || 5) * 0.6); const a = (i / n) * TAU; return [s.x + Math.sin(a) * R, s.z + Math.cos(a) * R, a + Math.PI]; }
      case 'listen': { const m = p.leader; const a = (m ? m.yaw : 0) + (i - (n - 1) / 2) * 0.55; const d = 3.2 + (i % 2) * 1.1; const lx = m ? m.spot.x : s.x, lz = m ? m.spot.z : s.z; return [lx + Math.sin(a) * d, lz + Math.cos(a) * d, a + Math.PI]; }
      case 'wait': return [s.x + (i - 0.5) * 1.3 * Math.cos(s.yaw), s.z - (i - 0.5) * 1.3 * Math.sin(s.yaw), s.yaw];
      case 'tend': {
        // 세 군데를 오가며 돌본다 (20초마다)
        const k = Math.floor(T / 20 + p.ph * 3) % 3, a = s.yaw + (k - 1) * 1.2 + i * 2.1, d = k === 1 ? 0.5 : 3.2;
        return [s.x + Math.sin(a) * d, s.z + Math.cos(a) * d, a + Math.PI];
      }
      case 'play': {
        const R = Math.max(3, (s.r || 6) * 0.75);
        const w = (0.35 + p.ph * 0.4) * (i % 2 ? 1 : -1);
        const a = p.ph * TAU + T * w, rr = R * (0.45 + 0.4 * Math.sin(T * 0.7 + i));
        const x = s.x + Math.sin(a) * rr, z = s.z + Math.cos(a) * rr;
        return [x, z, a + (w > 0 ? Math.PI / 2 : -Math.PI / 2)];
      }
      case 'stroll': {
        const L = s.loop || [{ x: s.x, z: s.z }, { x: s.x + 10, z: s.z }];
        let per = 0;
        for (let k = 0; k < L.length; k++) per += Math.hypot(L[(k + 1) % L.length].x - L[k].x, L[(k + 1) % L.length].z - L[k].z);
        let d = ((T * p.speed * 0.8 + p.ph * per + i * per * 0.5) % per + per) % per;
        for (let k = 0; k < L.length; k++) {
          const A = L[k], B = L[(k + 1) % L.length], l = Math.hypot(B.x - A.x, B.z - A.z);
          if (d <= l) { const f = d / l; return [A.x + (B.x - A.x) * f, A.z + (B.z - A.z) * f, Math.atan2(B.x - A.x, B.z - A.z)]; }
          d -= l;
        }
        return [L[0].x, L[0].z, 0];
      }
      case 'carry': case 'inspect': {
        if (!s.to) return [s.x, s.z, s.yaw];
        const l = Math.hypot(s.to.x - s.x, s.to.z - s.z) || 1, per = l * 2 + 8;
        const v = p.role === 'carry' ? 1.3 : 0.7;
        const d = ((T * v + p.ph * per) % per);
        let f, there;
        if (d < l) { f = d / l; there = true; } else if (d < l + 4) { f = 1; there = true; p._drop = true; } else if (d < 2 * l + 4) { f = 1 - (d - l - 4) / l; there = false; } else { f = 0; there = false; }
        p._loaded = p.role === 'carry' && there && d < l;
        const x = s.x + (s.to.x - s.x) * f, z = s.z + (s.to.z - s.z) * f;
        return [x, z, there ? Math.atan2(s.to.x - s.x, s.to.z - s.z) : Math.atan2(s.x - s.to.x, s.z - s.to.z)];
      }
      default: return [s.x, s.z, s.yaw];
    }
  }

  /** 지금 그 사람이 어디서 무엇을 하는가. null = 집(건물) 안 */
  _state(p, t, T) {
    if (p.flee || p.engaged) return { at: true };
    const R = ROLES[p.leader ? p.leader.role : p.role];
    const hours = R ? R.hours : [];
    const door = p.home ? p.home.door : null;
    const [sx, sz] = this._slot(p, T);
    const dist = door ? Math.hypot(door.x - sx, door.z - sz) : 0;
    const w = door ? Math.max(0.006, dist / p.speed / DAY) : 0;
    for (const [a0, b0] of hours) {
      const a = a0 + p.jit + (p.role === 'listen' ? 0.02 : 0), b = b0 + p.jit2 - (p.role === 'listen' ? 0.01 : 0);
      if (inWin(t, a, b) >= 0) return { at: true };
      if (!door) continue;
      const ti = inWin(t, a - w, a);
      if (ti >= 0) return { walk: true, from: door, to: { x: sx, z: sz }, f: (ti - (a - w)) / w };
      const to = inWin(t, b, b + w);
      if (to >= 0) return { walk: true, from: { x: sx, z: sz }, to: door, f: (to - b) / w, home: true };
    }
    return null;
  }

  // ── 매 프레임 ─────────────────────────────
  update(dt) {
    const g = this.game;
    if (!g.city || g.mode === 'title') return;
    const pp = g.player.pos;
    const t = g.world.clock.time - Math.floor(g.world.clock.time);
    const T = g.time;
    // 둘레의 자리 → 사람 (0.5초마다)
    this.scanT -= dt;
    if (this.scanT <= 0 || !this.near) {
      this.scanT = 0.5;
      const spots = g.city.spotsNear(pp.x, pp.z, this.R + 20).filter((s) => Math.abs(s.y - pp.y) < 60);
      spots.sort((a, b) => Math.hypot(a.x - pp.x, a.z - pp.z) - Math.hypot(b.x - pp.x, b.z - pp.z));
      const list = [];
      for (const s of spots) {
        const R = ROLES[s.type];
        if (!R || !R.hours.length) continue;
        const r = mulberry32(hashStr(s.id + 'n'));
        const n = R.n[0] + Math.floor(r() * (R.n[1] - R.n[0] + 1));
        let leader = null;
        for (let i = 0; i < n; i++) { const p = this._person(s, i); p.groupN = n; list.push(p); if (!i) leader = p; }
        if (R.listeners && leader) {
          const m = R.listeners[0] + Math.floor(r() * (R.listeners[1] - R.listeners[0] + 1));
          for (let i = 0; i < m; i++) { const q = this._person(s, 10 + i, 'listen'); q.leader = leader; q.groupN = m; q.i = i; list.push(q); }
        }
        if (list.length > this.max * 2) break;
      }
      this.near = list;
      // 오래 안 본 사람은 잊는다 (친한 정도는 저장에 남는다)
      if (this.people.size > 1500) for (const [k, p] of this.people) if (!list.includes(p) && !p.engaged) this.people.delete(k);
    }
    // 각 사람의 자리·자세
    this.crowd.begin();
    this.vis.length = 0;
    for (const p of this.near) {
      if (this.vis.length >= this.max) break;
      const st = this._state(p, t, T);
      if (!st) { p.placed = false; continue; }
      let tx, tz, tyaw;
      if (st.walk) {
        tx = st.from.x + (st.to.x - st.from.x) * st.f; tz = st.from.z + (st.to.z - st.from.z) * st.f;
        tyaw = Math.atan2(st.to.x - st.from.x, st.to.z - st.from.z);
      } else if (p.flee) {
        tx = p.pos.x; tz = p.pos.z; tyaw = p.yaw;
      } else if (p.engaged) {
        tx = p.pos.x; tz = p.pos.z; tyaw = Math.atan2(pp.x - p.pos.x, pp.z - p.pos.z);
      } else { [tx, tz, tyaw] = this._slot(p, T); }
      if (!p.placed) { p.pos.set(tx, heightAt(tx, tz), tz); p.yaw = tyaw; p.placed = true; }
      // 걷기: 목표를 향해 (따라잡을 땐 조금 빨리)
      const dx = tx - p.pos.x, dz = tz - p.pos.z, d = Math.hypot(dx, dz);
      let moving = 0;
      if (p.flee) moving = this._flee(p, dt);
      else if (d > 0.05) {
        if (d > 25) { p.pos.x = tx; p.pos.z = tz; }
        else {
          const sp = Math.min(d / dt, p.speed * (d > 3 ? 2 : 1.15));
          p.pos.x += (dx / d) * sp * dt; p.pos.z += (dz / d) * sp * dt;
          moving = sp;
        }
      }
      // 걸을 때는 건물 벽·나무·가로등을 뚫지 않고 미끄러지듯 돌아간다 (플레이어와 같은 밀어내기)
      if (moving > 0.3) g.world.colliders.pushOut(p.pos, 0.3 * p.scale + 0.12, 1.8 * p.scale, 0.6);
      // 플레이어를 비켜 간다
      const ox = p.pos.x - pp.x, oz = p.pos.z - pp.z, od = Math.hypot(ox, oz);
      const minD = 0.55 * p.scale + 0.45;
      if (od < minD && od > 1e-3 && Math.abs(p.pos.y - pp.y) < 2.5) { p.pos.x = pp.x + (ox / od) * minD; p.pos.z = pp.z + (oz / od) * minD; }
      const gy = g.world.groundAt(p.pos.x, p.pos.z, p.pos.y + 2.5);
      p.pos.y += (gy - p.pos.y) * Math.min(1, dt * 8);
      const wantYaw = moving > 0.3 ? Math.atan2(p.flee ? p._fx : dx, p.flee ? p._fz : dz) : tyaw;
      const dyaw = Math.atan2(Math.sin(wantYaw - p.yaw), Math.cos(wantYaw - p.yaw));
      p.yaw += dyaw * Math.min(1, dt * 5);
      this._pose(p, moving, T, dt, st);
      if (Math.hypot(p.pos.x - pp.x, p.pos.z - pp.z) > this.R + 10) continue;
      this.vis.push(p);
      const a = p.anim;
      this.crowd.push({ x: p.pos.x, y: p.pos.y, z: p.pos.z, yaw: p.yaw, s: p.scale, phase: p.ph, speak: a.speak, kneel: a.kneel, armL: a.armL, armR: a.armR, head: a.head, hold: a.hold, skin: p.skin, deep: p.deep, glow: p.glow });
    }
    // 실내 사람
    for (const p of this.indoor) {
      this._indoorPose(p, T, dt);
      this.vis.push(p);
      const a = p.anim;
      this.crowd.push({ x: p.pos.x, y: p.pos.y, z: p.pos.z, yaw: p.yaw, s: p.scale, phase: p.ph, speak: a.speak, kneel: a.kneel, armL: a.armL, armR: a.armR, head: a.head, hold: a.hold, skin: p.skin, deep: p.deep, glow: p.glow });
    }
    this.crowd.end();
    this._music(dt, pp);
    this._ambientTalk(dt, pp);
    if (this.activity) this.activity.update(dt);
  }

  /** 하는 일에 맞는 몸짓 */
  _pose(p, moving, T, dt, st) {
    const a = p.anim;
    a.speakT = Math.max(0, (a.speakT || 0) - dt);
    a.speak = a.speakT > 0 ? 1 : 0;
    let armL = 0, armR = 0, head = 0, kneel = 0, hold = 0;
    if (moving > 0.3) {
      p.walkPh += moving * dt * 2.6;
      const sw = Math.sin(p.walkPh) * (p.flee ? 0.7 : 0.35);
      armL = 0.1 + sw; armR = 0.1 - sw;
      if (p.role === 'carry' && p._loaded) { armL = armR = 0.9; hold = 5; }
      if (p.role === 'play' || p.flee) { armL = 0.9 + sw * 0.5; armR = 0.9 - sw * 0.5; }
    } else if (p.engaged) {
      armL = 0.15 + (a.speak ? 0.5 + Math.sin(T * 5) * 0.2 : 0); armR = 0.15;
    } else if (p.caught) {
      armL = armR = 2.6 + Math.sin(T * 8) * 0.2;
    } else if (!st || !st.walk) {
      const ph = T + p.ph * 10;
      switch (p.role) {
        case 'sell': { const g2 = Math.max(0, Math.sin(ph * 0.9)); armR = 0.2 + g2 * 1.1; armL = 0.25; head = -0.05; if (g2 > 0.9 && Math.random() < dt * 0.4) a.speakT = 1.2; break; }
        case 'tend': kneel = 0.9; armL = 0.9 + Math.sin(ph * 2) * 0.15; armR = 0.8 + Math.cos(ph * 2.3) * 0.15; head = 0.35; hold = Math.sin(ph * 0.3) > 0.2 ? 7 : 0; break;
        case 'music': armL = 1.15 + Math.sin(ph * 6) * 0.12; armR = 1.15 + Math.sin(ph * 6 + 1.6) * 0.12; hold = 6; head = -0.1; a.speak = 0.4; break;
        case 'listen': armL = armR = 0.1 + Math.max(0, Math.sin(ph * 2)) * 0.25; head = -0.08; break;
        case 'chat': { const turn = Math.floor(ph / 3 + p.i) % (p.groupN || 2) === 0; armR = turn ? 0.5 + Math.sin(ph * 4) * 0.3 : 0.1; armL = 0.1; a.speak = Math.max(a.speak, turn ? 0.6 : 0); break; }
        case 'sit': kneel = 0.48; armL = armR = 0.35; head = 0.12; break;
        case 'meditate': armL = armR = 1.0 + Math.sin(T * 0.6) * 0.9; head = -0.3; a.speak = 0.25; break;
        case 'console': armL = 0.95 + Math.sin(ph * 9) * 0.05; armR = 0.95 + Math.cos(ph * 8) * 0.05; head = 0.2; break;
        case 'observe': head = -0.7; armR = Math.sin(ph * 0.5) > 0.6 ? 2.0 : 0.1; break;
        case 'wait': armL = armR = 0.05; head = 0.05; break;
        case 'carry': if (p._drop) { armL = armR = 0.6; } break;
        default: break;
      }
    }
    p._drop = false;
    a.armL += (armL - a.armL) * Math.min(1, dt * 8);
    a.armR += (armR - a.armR) * Math.min(1, dt * 8);
    a.head += (head - a.head) * Math.min(1, dt * 5);
    a.kneel += (kneel - a.kneel) * Math.min(1, dt * 4);
    a.hold = hold;
  }

  /** 악사가 가까우면 실제로 노래가 들린다 */
  _music(dt, pp) {
    this._mT = (this._mT || 0) - dt;
    if (this._mT > 0) return;
    const m = this.vis.find((p) => p.role === 'music' && Math.hypot(p.pos.x - pp.x, p.pos.z - pp.z) < 30 && !this.game.resonance.puzzle);
    if (!m) { this._mT = 1; return; }
    const r = mulberry32(hashStr(m.key) + Math.floor(this.game.time / 6));
    const scale = [0, 2, 4, 5, 7, 9];
    const n = scale[Math.floor(r() * scale.length)] % 5;
    audio.tone(n, { gain: 0.16, pos: { x: m.pos.x, y: m.pos.y + 2, z: m.pos.z }, maxDist: 40, wet: 0.5 });
    this._mT = 0.45 + r() * 0.5;
  }

  /** 가까이 지나가면 혼잣말·인사 */
  _ambientTalk(dt, pp) {
    this.sayT -= dt;
    if (this.sayT > 0 || this.game.mode !== 'play') return;
    const p = this.nearest(pp, 7);
    if (!p || p.flee) { this.sayT = 1.5; return; }
    this.game.say(p, this._line(p), true);
    this.sayT = 8 + Math.random() * 7;
  }

  /** 그 사람이 할 말 하나 */
  _line(p, kind) {
    const t = this.game.world.clock.time % 1;
    let pool = kind ? CIT_LINES[kind] : CIT_LINES[p.role] || CIT_LINES.chat;
    if (!kind && p.fr >= 2 && Math.random() < 0.4) { pool = CIT_LINES.friend; kind = 'friend'; }
    else if (!kind && Math.random() < 0.15) { pool = t > 0.22 && t < 0.4 ? CIT_LINES.morning : t > 0.78 || t < 0.2 ? CIT_LINES.night : pool; }
    const i = Math.floor(Math.random() * pool.length);
    const L = pool[i];
    const id = `cit_${kind || p.role}_${CIT_LINES[kind || p.role] === pool ? i : hashStr(L.ko) % 997}`;
    const line = { id, ...L };
    this.game.lines[id] = line;
    return line;
  }

  // ── 찾기·부딪힘 ───────────────────────────
  nearest(pos, R = 3.2) {
    let best = null, bd = R;
    for (const p of this.vis) {
      if (Math.abs(p.pos.y - pos.y) > 3) continue;
      const d = Math.hypot(p.pos.x - pos.x, p.pos.z - pos.z);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
  /** 사람은 단단하다: 플레이어를 밀어낸다 */
  pushPlayer(pos) {
    for (const p of this.vis) {
      if (Math.abs(p.pos.y - pos.y) > 2.2) continue;
      const dx = pos.x - p.pos.x, dz = pos.z - p.pos.z, d = Math.hypot(dx, dz);
      const R = 0.5 * p.scale + 0.42;
      if (d >= R) continue;
      // 정확히 겹치면 그 사람이 보는 쪽 옆으로
      const ux = d > 1e-4 ? dx / d : Math.sin(p.yaw || 0), uz = d > 1e-4 ? dz / d : Math.cos(p.yaw || 0);
      pos.x = p.pos.x + ux * R; pos.z = p.pos.z + uz * R;
    }
  }
  target(pos) {
    const p = this.nearest(pos, 3.2);
    if (!p || p.flee) return null;
    const R = ROLES[p.role] || INDOOR[p.role];
    return { kind: 'citizen', o: p, label: `${p.name} · ${R ? R.label : '주민'}${p.fr ? ' ' + '♥'.repeat(p.fr) : ''}`, short: '말 걸기' };
  }

  // ── 만나기 ─────────────────────────────
  open(p) {
    const g = this.game, R = ROLES[p.role] || INDOOR[p.role] || {};
    p.engaged = true;
    g.focusOn(p);
    const inv = g.state.inv;
    const items = [{ label: '이야기 나누기', sub: '아웬의 말로 이야기한다', primary: true, onClick: () => this.talk(p) }];
    const play = this._playOption(p);
    if (play) items.push(play);
    if (p.role === 'sell' || p.role === 'shop') items.push({ label: '장터 물건 보기', sub: '별씨로 나눈다', onClick: () => this.tradeCard(p) });
    if ((inv.flower || 0) > 0) items.push({ label: '울림꽃 선물하기', sub: `가진 것 ${inv.flower}`, onClick: () => this.gift(p, 'flower') });
    if ((inv.fruit || 0) > 0) items.push({ label: '빛열매 나눠 먹기', sub: `가진 것 ${inv.fruit}`, onClick: () => this.gift(p, 'fruit') });
    if (p.fr >= 3 && p.home && p.home.door) items.push({ label: '집에 놀러 가기', sub: `${p.name}의 집 · 함께 저녁을`, onClick: () => this.visitHome(p) });
    items.push({ label: '인사하고 헤어지기', onClick: () => this.release(p) });
    const hearts = '♥'.repeat(p.fr) + '♡'.repeat(5 - p.fr);
    const age = p.age === 'child' ? '아이' : p.age === 'elder' ? '어르신' : '';
    g.ui.serviceCard(`${R.label || '주민'}${age ? ' · ' + age : ''}`, p.name, `${R.verb || ''}`, items, `<div class="svc-stat"><span>친한 정도 <b>${hearts}</b></span></div>`);
    const off = bus.on ? null : null;
    void off;
    this._watchRelease(p);
  }
  _watchRelease(p) {
    // 카드를 닫고 멀어지면 다시 일하러
    clearInterval(this._relT);
    this._relT = setInterval(() => {
      const g = this.game;
      if (this.activity && this.activity.people && this.activity.people.includes(p)) return;
      if (g.mode === 'card' || g.mode === 'dialogue') return;
      if (Math.hypot(g.player.pos.x - p.pos.x, g.player.pos.z - p.pos.z) > 4) { this.release(p); clearInterval(this._relT); }
    }, 500);
  }
  release(p) { p.engaged = false; p.fig.look = null; }

  _playOption(p) {
    const R = ROLES[p.role] || INDOOR[p.role];
    if (!R || !R.play || this.activity) return null;
    const o = {
      tag: { label: '술래잡기', sub: '아이들을 모두 잡아 보세요 (45초)', fn: () => this.startTag(p) },
      song: { label: '노래 주고받기', sub: '악사의 가락을 따라 연주한다', fn: () => this.startSong(p) },
      garden: { label: '꽃 가꾸기 돕기', sub: '싹 셋에 물 주기 (E 또는 「흐름」 음)', fn: () => this.startGarden(p) },
      carry: { label: '짐 나르기 돕기', sub: '상자를 들어 내려놓을 자리까지 (60초)', fn: () => this.startCarry(p) },
      tune: { label: '장치 음 맞추기', sub: '기계가 내는 가락을 맞춘다', fn: () => this.startTune(p) },
      meditate: { label: '함께 고요해지기', sub: '「고요」 음을 연주한다 (5)', fn: () => this.startMeditate(p) },
      meal: { label: '함께 먹기', sub: '식탁에 앉아 저녁을 나눈다 (조금 쉰다)', fn: () => this.meal(p) },
      kidplay: { label: '같이 놀기', sub: '아이들과 빙글빙글', fn: () => this.kidPlay(p) },
      lesson: { label: '수업 듣기', sub: '선생님에게 새 말을 배운다 (하루 한 번)', fn: () => this.lesson(p) },
      heal: { label: '울림 고르기', sub: '치유사가 마음의 울림을 고른다', fn: () => this.heal(p) },
      trade: null,
    }[R.play];
    return o ? { label: o.label, sub: o.sub, onClick: o.fn } : null;
  }

  talk(p) {
    const g = this.game;
    const day = Math.floor(g.world.clock.time);
    const first = this.S.talked[p.key] !== day;
    const lines = [this._line(p)];
    if (first && p.fr >= 1) lines.push(this._line(p, p.fr >= 3 ? 'friend' : undefined));
    g.dialogue.startCustom(lines.map((l) => ({ lineObj: l })), p, () => {
      if (first) { this.S.talked[p.key] = day; this.addFriend(p, 1); }
      this.release(p);
    });
  }

  gift(p, what) {
    const g = this.game;
    if (!(g.state.inv[what] > 0)) return;
    g.state.inv[what]--;
    g.particles.emit({ pos: _v.set(p.pos.x, p.pos.y + 2.2 * p.scale, p.pos.z), count: 24, spread: 2, up: 2, life: 1.2, size: [0.2, 0.6], color: what === 'flower' ? 0xff9fd0 : 0xffc46a, alpha: 1, add: true, drag: 1.5 });
    audio.chime('soft');
    g.dialogue.startCustom([{ lineObj: this._line(p, 'gift') }], p, () => { this.addFriend(p, what === 'flower' ? 2 : 1); if (what === 'fruit') g.lang.learn('eat', 'guess'); this.release(p); });
  }

  tradeCard(p) {
    const g = this.game, inv = g.state.inv;
    const items = GOODS.map((G) => ({
      label: `${G.name} · 별씨 ${G.price}`, sub: `${G.desc} (가진 것 ${inv[G.id] || 0})`, disabled: (inv.starseed || 0) < G.price, stay: true,
      onClick: () => {
        if ((inv.starseed || 0) < G.price) return;
        inv.starseed -= G.price;
        inv[G.id] = (inv[G.id] || 0) + 1;
        if (G.id === 'trinket') this.S.trinkets = (this.S.trinkets || 0) + 1;
        audio.chime('item');
        g.ui.toast(`${G.name} +1 (별씨 ${inv.starseed})`, { kind: 'item' });
        g.say(p, this._line(p, 'thanks'), true);
        this.tradeCard(p);
      },
    }));
    items.push({ label: '돌아가기', onClick: () => this.release(p) });
    g.ui.serviceCard('장터', `${p.name}의 노점`, `별씨 ${inv.starseed || 0}`, items);
  }

  // ── 함께 하기 ─────────────────────────────
  _reward(people, { seeds = 0, words = [], friend = 1, flower = 0 } = {}) {
    const g = this.game;
    for (const q of people) this.addFriend(q, friend);
    if (seeds) g.giveItem('starseed', seeds);
    if (flower) { g.state.inv.flower = (g.state.inv.flower || 0) + flower; g.ui.toast(`울림꽃 +${flower}`, { kind: 'item' }); }
    for (const [w, how] of words) g.lang.learn(w, how);
    audio.chime('quest');
    g.save();
  }
  _end() {
    const A = this.activity;
    if (!A) return;
    for (const m of A.marks || []) { this.game.engine.scene.remove(m); }
    for (const q of A.people || []) { q.flee = false; q.caught = false; q.engaged = false; }
    this.game.ui.say(null, null);
    this.activity = null;
  }
  _mark(x, y, z, color = 0x9ff6ff) {
    const grp = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.06, 4, 24), glowMaterial({ color, intensity: 2.2 }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.15;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.3, 6, 6, 1, true), glowMaterial({ color, intensity: 0.8, side: THREE.DoubleSide }));
    beam.position.y = 3;
    grp.add(ring, beam);
    grp.position.set(x, y, z);
    this.game.engine.scene.add(grp);
    return grp;
  }

  /** 술래잡기: 그 놀이터의 아이들이 도망친다. 가까이 가면 잡힌다 */
  startTag(p) {
    const g = this.game;
    const kids = this.vis.filter((q) => q.spot === p.spot && q.role === 'play');
    if (!kids.length) return;
    this.release(p);
    const s = p.spot, R = Math.max(10, (s.r || 6) + 7);
    for (const k of kids) { k.flee = true; k.caught = false; k._fx = 0; k._fz = 1; }
    let left = 45;
    const A = this.activity = {
      people: kids,
      update: (dt) => {
        left -= dt;
        const pp = g.player.pos;
        for (const k of kids) {
          if (!k.caught && Math.hypot(k.pos.x - pp.x, k.pos.z - pp.z) < 1.7) {
            k.caught = true; k.flee = false; k.engaged = true;
            audio.tone(3, { gain: 0.4, pos: k.pos });
            g.particles.emit({ pos: _v.set(k.pos.x, k.pos.y + 1.4, k.pos.z), count: 20, spread: 2, up: 2, life: 1, size: [0.2, 0.5], color: 0xffd27a, alpha: 1, add: true, drag: 1.5 });
          }
        }
        const n = kids.filter((k) => !k.caught).length;
        g.ui.say('술래잡기', `<b>남은 아이 ${n}</b> · ${Math.ceil(left)}초`);
        if (!n) {
          this._end();
          g.dialogue.startCustom([{ lineObj: this._line(kids[0], 'tagWin') }], kids[0], () => {});
          this._reward(kids, { seeds: 1, words: [['catch', 'teach'], ['play', 'teach']] });
        } else if (left <= 0) {
          this._end();
          g.dialogue.startCustom([{ lineObj: this._line(kids[0], 'tagLose') }], kids[0], () => {});
          this._reward(kids.filter((k) => k.caught), { friend: 1, words: [['play', 'guess']] });
        }
      },
      R, s,
    };
    void A;
    g.ui.toast('술래잡기! 아이들을 모두 잡아요', { kind: 'quest' });
    audio.chime('soft');
  }
  /** 도망치는 아이: 플레이어 반대쪽으로, 놀이터 둘레 안에서 */
  _flee(k, dt) {
    const g = this.game, pp = g.player.pos, A = this.activity;
    const s = A ? A.s : k.spot, R = A ? A.R : 12;
    let fx = k.pos.x - pp.x, fz = k.pos.z - pp.z;
    const d = Math.hypot(fx, fz) || 1;
    fx /= d; fz /= d;
    // 둘레 밖으로 나가려 하면 옆으로 돈다
    const cx = k.pos.x - s.x, cz = k.pos.z - s.z, cd = Math.hypot(cx, cz);
    if (cd > R * 0.8) { const tx = -cz / cd, tz = cx / cd; const sg = tx * fx + tz * fz > 0 ? 1 : -1; fx = fx * 0.3 + tx * sg - (cx / cd) * 0.6; fz = fz * 0.3 + tz * sg - (cz / cd) * 0.6; const l = Math.hypot(fx, fz) || 1; fx /= l; fz /= l; }
    const sp = d < 9 ? 5.6 : 2.2;
    const nx = k.pos.x + fx * sp * dt, nz = k.pos.z + fz * sp * dt;
    if (!this.city.solidAt || !this.city.solidAt(nx, nz, k.pos.y)) { k.pos.x = nx; k.pos.z = nz; }
    k._fx = fx; k._fz = fz;
    return sp;
  }

  /** 노래 주고받기: 악사가 부른 가락을 따라 연주 */
  startSong(p) {
    const g = this.game;
    const tones = g.state.tones.length ? g.state.tones : [0];
    const r = mulberry32(hashStr(p.key) + Math.floor(g.time));
    const len = 3 + Math.min(3, p.fr);
    const melody = Array.from({ length: len }, () => tones[Math.floor(r() * tones.length)]);
    p.engaged = true;
    this.activity = { people: [p], update: () => { if (!g.resonance.puzzle) { /* 취소·끝 */ } } };
    g.resonance.startSong({ x: p.pos.x, y: p.pos.y, z: p.pos.z, id: p.key }, melody, () => {
      this._end();
      g.dialogue.startCustom([{ lineObj: this._line(p, 'music') }], p, () => {});
      this._reward([p], { friend: 1, words: [['song', 'teach'], ['good', 'guess']] });
      // 둘레의 듣는 이들이 기뻐한다
      for (const q of this.vis) if (q.leader === p) { q.anim.speakT = 1.5; }
    }, `${p.name}의 노래를 들으세요…`);
    const chk = setInterval(() => { if (!g.resonance.puzzle) { clearInterval(chk); if (this.activity && this.activity.people[0] === p) this._end(); } }, 600);
  }
  /** 장치 음 맞추기 (기술자·관측자) */
  startTune(p) {
    const g = this.game;
    const tones = g.state.tones.length ? g.state.tones : [0];
    const r = mulberry32(hashStr(p.key) + 7 + Math.floor(g.time));
    const melody = Array.from({ length: 4 }, () => tones[Math.floor(r() * tones.length)]);
    p.engaged = true;
    this.activity = { people: [p], update: () => {} };
    g.resonance.startSong({ x: p.pos.x, y: p.pos.y, z: p.pos.z, id: p.key }, melody, () => {
      this._end();
      g.dialogue.startCustom([{ lineObj: this._line(p, 'thanks') }], p, () => {});
      this._reward([p], { seeds: 1, words: [['make', 'guess'], ['work', 'teach']] });
    }, '장치가 내는 가락을 들으세요…');
    const chk = setInterval(() => { if (!g.resonance.puzzle) { clearInterval(chk); if (this.activity && this.activity.people[0] === p) this._end(); } }, 600);
  }

  /** 꽃 가꾸기: 둘레의 싹 셋에 물 주기 (E, 또는 「흐름」 음) */
  startGarden(p) {
    const g = this.game;
    p.engaged = false;
    const marks = [], beds = [];
    const r = mulberry32(hashStr(p.key) + Math.floor(g.time));
    for (let k = 0; k < 12 && beds.length < 3; k++) {
      const a = r() * TAU, d = 3 + r() * 6;
      const x = p.spot.x + Math.sin(a) * d, z = p.spot.z + Math.cos(a) * d;
      if (this.city.solidAt && this.city.solidAt(x, z, p.spot.y)) continue;
      const y = g.world.groundAt(x, z, p.spot.y + 3);
      const m = this._mark(x, y, z, 0x7fdc9a);
      const sprout = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.7, 5), glowMaterial({ color: 0x7fdc9a, intensity: 1.2 }));
      sprout.position.y = 0.35;
      m.add(sprout);
      marks.push(m); beds.push({ x, y, z, m, sprout, done: false });
    }
    let left = 90;
    this.activity = {
      people: [p], marks, beds, kind: 'garden',
      update: (dt) => {
        left -= dt;
        const n = beds.filter((b) => !b.done).length;
        for (const b of beds) if (b.done && b.sprout.scale.x < 3) b.sprout.scale.multiplyScalar(1 + dt * 2);
        g.ui.say('꽃 가꾸기', `<b>물 줄 싹 ${n}</b> · E 또는 「흐름」(3)`);
        if (!n) { this._end(); g.dialogue.startCustom([{ lineObj: this._line(p, 'tend') }], p, () => {}); this._reward([p], { flower: 1, words: [['water', 'teach'], ['flower', 'teach'], ['grow', 'guess']] }); }
        else if (left <= 0) this._end();
      },
    };
    g.ui.toast('싹 셋에 물을 주세요', { kind: 'quest' });
  }
  _water(b) {
    const g = this.game;
    b.done = true;
    b.sprout.material = glowMaterial({ color: 0xff9fd0, intensity: 1.8 });
    g.particles.emit({ pos: _v.set(b.x, b.y + 1, b.z), count: 26, spread: 1.6, up: 2.5, life: 1.2, size: [0.2, 0.5], color: 0x9ff6ff, alpha: 1, add: true, drag: 1.5 });
    audio.tone(2, { gain: 0.35, pos: b });
  }
  _onTone(e) {
    const A = this.activity;
    if (!A) return;
    const pp = this.game.player.pos;
    if (A.kind === 'garden' && e.n === 2) for (const b of A.beds) if (!b.done && Math.hypot(b.x - pp.x, b.z - pp.z) < 6) this._water(b);
    if (A.kind === 'meditate' && e.n === 4) A.ok = true;
  }

  /** 짐 나르기: 상자를 들고 표시된 자리로 */
  startCarry(p) {
    const g = this.game;
    const s = p.spot;
    const to = s.to || { x: s.x + 15, z: s.z };
    const ty = g.world.groundAt(to.x, to.z, s.y + 3);
    const pick = this._mark(s.x, s.y, s.z, 0xffc46a);
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.8), glowMaterial({ color: 0xc89060, intensity: 0.5 }));
    crate.position.y = 0.6;
    pick.add(crate);
    let left = 60, held = false, drop = null;
    this.activity = {
      people: [p], marks: [pick], kind: 'carry',
      get held() { return held; },
      pickUp: () => { held = true; pick.remove(crate); g.engine.scene.add(crate); drop = this._mark(to.x, ty, to.z, 0x7ff3e6); this.activity.marks.push(drop); audio.chime('soft'); },
      dropOff: () => { g.engine.scene.remove(crate); this._end(); g.dialogue.startCustom([{ lineObj: this._line(p, 'thanks') }], p, () => {}); this._reward([p], { seeds: 1, words: [['work', 'teach'], ['give', 'guess']] }); },
      pickPos: s, dropPos: { x: to.x, y: ty, z: to.z },
      update: (dt) => {
        left -= dt;
        if (held) { const pp = g.player.pos; crate.position.set(pp.x, pp.y + 2.6, pp.z); crate.rotation.y = g.player.yaw; }
        g.ui.say('짐 나르기', held ? `<b>내려놓을 자리로</b> · ${Math.ceil(left)}초` : `<b>상자를 드세요 (E)</b> · ${Math.ceil(left)}초`);
        if (left <= 0) { g.engine.scene.remove(crate); this._end(); g.ui.toast('시간이 지났어요', { kind: 'muted' }); }
      },
    };
  }

  /** 함께 고요해지기: 20초 안에 「고요」 */
  startMeditate(p) {
    const g = this.game;
    let left = 20;
    p.engaged = false;
    const group = this.vis.filter((q) => q.spot === p.spot);
    this.activity = {
      people: [], kind: 'meditate', ok: false,
      update: (dt) => {
        left -= dt;
        g.ui.say('함께 고요해지기', `<b>「고요」 음을 연주하세요 (5)</b> · ${Math.ceil(left)}초`);
        if (this.activity.ok) {
          this._end();
          g.particles.emit({ pos: _v.set(p.spot.x, p.spot.y + 2, p.spot.z), count: 40, spread: 3, up: 1, life: 2, size: [0.3, 0.9], color: 0xb9a6ff, alpha: 0.9, add: true, drag: 1 });
          g.dialogue.startCustom([{ lineObj: this._line(p, 'meditate') }], p, () => {});
          this._reward(group, { words: [['still', 'teach'], ['rest', 'teach'], ['together', 'guess']] });
        } else if (left <= 0) this._end();
      },
    };
  }

  /** 상호작용 표시 (game._findTarget 이 부른다): 진행 중인 함께 하기의 대상 */
  activityTarget(pos) {
    const A = this.activity;
    if (!A) return null;
    if (A.kind === 'garden') { for (const b of A.beds) if (!b.done && Math.hypot(b.x - pos.x, b.z - pos.z) < 2.4) return { kind: 'cit-act', o: b, label: '싹에 물 주기', short: '물 주기' }; }
    if (A.kind === 'carry') {
      if (!A.held && Math.hypot(A.pickPos.x - pos.x, A.pickPos.z - pos.z) < 2.6) return { kind: 'cit-act', o: 'pick', label: '상자 들기', short: '들기' };
      if (A.held && Math.hypot(A.dropPos.x - pos.x, A.dropPos.z - pos.z) < 3) return { kind: 'cit-act', o: 'drop', label: '상자 내려놓기', short: '내려놓기' };
    }
    return null;
  }
  activityInteract(t) {
    const A = this.activity;
    if (!A) return;
    if (A.kind === 'garden') this._water(t.o);
    if (A.kind === 'carry') { if (t.o === 'pick') A.pickUp(); else A.dropOff(); }
  }

  /** 집에서 함께 먹기: 식구 모두와 친해지고, 잠깐 쉰다 */
  meal(p) {
    const g = this.game;
    const fam = this.indoor.filter((q) => q.A && (q.A.act === 'cook' || q.A.act === 'eat' || q.A.act === 'kidplay'));
    for (const q of fam) q.anim.speakT = 2;
    g.dialogue.startCustom([{ lineObj: this._line(p, 'cook') }, { s: 'moa', t: '빛열매 수프예요. 따뜻해요… 이 집 사람들이 노래하듯 웃어요.' }], p, () => {
      this._reward(fam.length ? fam : [p], { words: [['eat', 'teach'], ['home', 'guess'], ['together', 'guess']] });
      if (g.rest) g.rest(((g.world.clock.time % 1) + 0.06) % 1);
      this.release(p);
    });
  }
  /** 아이들과 빙글빙글 */
  kidPlay(p) {
    const kids = this.indoor.filter((q) => q.A && q.A.act === 'kidplay');
    this.kidT = 6;
    for (const q of kids) q.anim.speakT = 3;
    this.game.say(p, this._line(p, 'kidplay'), true);
    this._reward(kids.length ? kids : [p], { words: [['play', 'teach'], ['run', 'guess']] });
    this.release(p);
  }
  /** 학교에서 새 말 배우기 (하루 한 번) */
  lesson(p) {
    const g = this.game;
    const day = Math.floor(g.world.clock.time);
    const k = `lesson:${p.key.split('#')[0]}`;
    if (this.S.talked[k] === day) { g.ui.toast('오늘 수업은 끝났어요. 내일 다시 와요', { kind: 'muted' }); this.release(p); return; }
    const pool = ['play', 'work', 'eat', 'flower', 'water', 'good', 'learn', 'grow', 'run', 'gift', 'rest', 'catch', 'tired', 'make', 'build'];
    const w = pool.find((id) => !g.lang.known(id)) || 'learn';
    g.dialogue.startCustom([{ lineObj: this._line(p, 'teach') }, { s: 'moa', t: '선생님이 새 말을 노래로 가르쳐 줬어요. 따라 불러 봐요.' }], p, () => {
      this.S.talked[k] = day;
      g.lang.learn(w, 'teach');
      this._reward([p], { words: [['learn', 'teach']] });
      this.release(p);
    });
  }
  /** 치유원: 마음의 울림 고르기 */
  heal(p) {
    const g = this.game;
    g.particles.emit({ pos: _v.set(g.player.pos.x, g.player.pos.y + 1.6, g.player.pos.z), count: 40, spread: 1.6, up: 1.5, life: 2, size: [0.3, 0.8], color: 0xb9f6e6, alpha: 0.9, add: true, drag: 1 });
    audio.tone(4, { gain: 0.4 });
    g.dialogue.startCustom([{ lineObj: this._line(p, 'heal') }], p, () => { g.ui.toast('마음의 울림이 고르게 가라앉았다', { kind: 'item' }); this._reward([p], { words: [['heart', 'guess'], ['rest', 'teach']] }); this.release(p); });
  }

  /** 친한 이의 집에 놀러 가기: 그 집 안에 가족이 모여 있다 */
  visitHome(p) {
    const g = this.game;
    this.release(p);
    const r = p.home;
    if (!r || !g.interiors) return;
    g.interiors.guest = p;
    g.interiors.enter(r);
  }

  // ── 실내 사람 (interiors 가 자리를 정해 준다) ─────────
  /** 집·일터 안의 사람들. anchors: [{ x, z, y, yaw, act }] */
  setIndoor(r, anchors, info) {
    this.indoor = [];
    const t = this.game.world.clock.time % 1;
    const rr = mulberry32(Math.floor(r.seed * 1e9));
    anchors.forEach((A, i) => {
      const key = `in:${r.zone}:${r.kind}:${r.idx}#${i}`;
      const q = mulberry32(hashStr(key));
      const hue = q();
      const age = A.age || (A.act === 'kidplay' || A.act === 'student' ? 'child' : q() < 0.15 ? 'elder' : 'adult');
      const p = {
        key, id: 'cit:' + key, role: A.act, indoorRole: true, age, A,
        name: SYL_A[Math.floor(q() * SYL_A.length)] + SYL_B[Math.floor(q() * SYL_B.length)],
        skin: new THREE.Color().setHSL(hue, 0.32, 0.8), deep: new THREE.Color().setHSL((hue + 0.1) % 1, 0.45, 0.5), glow: GLOWS[Math.floor(q() * 4)],
        scale: age === 'child' ? 0.58 + q() * 0.08 : 0.86 + q() * 0.18, ph: q(), speed: 1.2,
        pos: new THREE.Vector3(A.x, A.y, A.z), yaw: A.yaw, walkPh: 0, anim: { armL: 0, armR: 0, head: 0, kneel: 0, hold: 0, speak: 0 },
        title: (INDOOR[A.act] || {}).label || '', fr: 0,
      };
      p.fr = this.friend(key);
      p.fig = { speak: (d) => { p.anim.speakT = d; }, look: null, gesture: 0 };
      this.indoor.push(p);
    });
    // 놀러 온 집이면 그 친구도 안에
    const guest = this.game.interiors && this.game.interiors.guest;
    if (guest && guest.home === r && anchors.length) {
      const A = anchors[0];
      guest.indoorVisit = true;
      void A;
    }
    void rr; void t; void info;
  }
  clearIndoor() { this.indoor = []; }

  _indoorPose(p, T, dt) {
    const A = p.A, a = p.anim;
    if (this.kidT > 0) this.kidT -= dt / Math.max(1, this.indoor.length);
    a.speakT = Math.max(0, (a.speakT || 0) - dt);
    a.speak = a.speakT > 0 ? 1 : 0;
    const ph = T + p.ph * 10;
    let armL = 0.1, armR = 0.1, head = 0, kneel = 0, hold = 0, x = A.x, z = A.z, yaw = A.yaw;
    switch (A.act) {
      case 'cook': armL = 0.9 + Math.sin(ph * 4) * 0.2; armR = 0.8 + Math.cos(ph * 3.4) * 0.25; head = 0.3; break;
      case 'eat': kneel = 0.48; armR = 0.6 + Math.max(0, Math.sin(ph * 1.3)) * 0.8; head = 0.1; if (Math.sin(ph * 0.7) > 0.95) a.speak = 0.6; break;
      case 'kidplay': { const pp = this.game.player.pos, around = this.kidT > 0; const r = around ? 1.8 : A.r || 2; const cx = around ? pp.x : A.x, cz = around ? pp.z : A.z; const ang = ph * (around ? 2.2 : 0.9 + p.ph) * (p.ph > 0.5 ? 1 : -1); x = cx + Math.sin(ang) * r; z = cz + Math.cos(ang) * r; yaw = ang + (p.ph > 0.5 ? Math.PI / 2 : -Math.PI / 2); armL = armR = 1 + Math.sin(ph * 8) * 0.3; break; }
      case 'read': kneel = 0.48; armL = armR = 0.75; head = 0.45; break;
      case 'sleep': kneel = 1; armL = armR = 0.05; head = 0.6; break;
      case 'clerk': case 'research': armL = 0.95 + Math.sin(ph * 9) * 0.05; armR = 0.95 + Math.cos(ph * 8) * 0.05; head = 0.15; break;
      case 'teach': armR = 0.4 + Math.max(0, Math.sin(ph * 1.5)) * 1.4; a.speak = Math.max(a.speak, Math.sin(ph * 1.5) > 0.3 ? 0.7 : 0); break;
      case 'student': kneel = 0.48; armL = armR = 0.3 + (Math.sin(ph * 0.8 + p.ph * 6) > 0.92 ? 2.2 : 0); head = -0.1; break;
      case 'heal': armL = armR = 1.2 + Math.sin(ph * 1.2) * 0.3; a.speak = 0.4; break;
      case 'patient': kneel = 0.9; head = 0.4; break;
      case 'shop': { const g2 = Math.max(0, Math.sin(ph * 0.9)); armR = 0.2 + g2 * 1.1; break; }
      case 'sing': armL = armR = 0.7 + Math.sin(ph * 2) * 0.5; a.speak = 0.7; head = -0.15; break;
      case 'garden': kneel = 0.9; armL = 0.9; armR = 0.85; head = 0.35; hold = 7; break;
      case 'work': armL = armR = 0.9; hold = Math.sin(ph * 0.4) > 0 ? 5 : 0; break;
      default: break;
    }
    if (p.engaged) { yaw = Math.atan2(this.game.player.pos.x - p.pos.x, this.game.player.pos.z - p.pos.z); }
    p.pos.x += (x - p.pos.x) * Math.min(1, dt * 6); p.pos.z += (z - p.pos.z) * Math.min(1, dt * 6);
    const dyaw = Math.atan2(Math.sin(yaw - p.yaw), Math.cos(yaw - p.yaw));
    p.yaw += dyaw * Math.min(1, dt * 5);
    a.armL += (armL - a.armL) * Math.min(1, dt * 8);
    a.armR += (armR - a.armR) * Math.min(1, dt * 8);
    a.head += (head - a.head) * Math.min(1, dt * 5);
    a.kneel += (kneel - a.kneel) * Math.min(1, dt * 4);
    a.hold = hold;
  }
}
