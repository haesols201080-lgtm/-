// 아웬 인물 관리: 이름 있는 인물(퀘스트), 거리의 아웬(배회·노래·혼잣말), 머리 위 「!」 표시.
import * as THREE from 'three';
import { AwenFigure } from '../world/awen.js';
import { NPCS, AMBIENT, AMBIENT_AFTER_NAME } from '../data/story.js';
import { PLACE } from '../data/places.js';
import { glowMaterial } from '../world/materials.js';
import { mulberry32 } from '../core/noise.js';

const AMBIENT_SPOTS = [
  { place: 'harmonea', n: 22, r: 1100, minR: 260 },
  { place: 'dewfold', n: 6, r: 80 },
  { place: 'yunseul', n: 6, r: 120 },
  { place: 'gatmaeul', n: 6, r: 160 },
  { place: 'tteodol', n: 5, r: 140 },
  { place: 'mulnorae', n: 5, r: 120 },
  { place: 'observatory', n: 2, r: 30 },
];

export class NPCs {
  constructor(game) {
    this.game = game;
    this.scene = game.engine.scene;
    this.list = [];
    this.byId = new Map();
    this.markMat = glowMaterial({ color: 0xffd27a, intensity: 2.6 });
    this.markGeo = new THREE.OctahedronGeometry(0.18, 0);
    this.markGeo.scale(1, 1.8, 1);
    for (const d of NPCS) this._spawnNamed(d);
    const rnd = mulberry32(31);
    let k = 0;
    for (const s of AMBIENT_SPOTS) {
      const p = PLACE[s.place];
      if (!p) continue;
      for (let i = 0; i < s.n; i++) {
        const a = rnd() * Math.PI * 2, d = (s.minR || 0) + rnd() * (s.r - (s.minR || 0));
        this._spawn({
          id: `amb-${k++}`, name: '아웬', ambient: true,
          x: p.pos[0] + Math.cos(a) * d, z: p.pos[1] + Math.sin(a) * d,
          hue: rnd(), glow: [0x7ff3e6, 0xffc46a, 0xff9fd0, 0xb9a6ff][Math.floor(rnd() * 4)], scale: 0.8 + rnd() * 0.35,
          home: { x: p.pos[0], z: p.pos[1], r: s.r, minR: s.minR || 0 },
        });
      }
    }
    this.ambCooldown = 4;
  }

  _spawnNamed(d) {
    const p = PLACE[d.place];
    const x = p.pos[0] + d.offset[0], z = p.pos[1] + d.offset[1];
    return this._spawn({ ...d, x, z, home: { x, z, r: 6 } });
  }

  _spawn(d) {
    // 거리의 아웬은 건물 안이 아니라 거리 위에서
    if (d.ambient && !d.indoor && this.game.city) { const s = this.game.city.snapStreet(d.x, d.z); if (s) { d.x = s.x; d.z = s.z; } }
    const fig = new AwenFigure({ hue: d.hue, glow: d.glow, scale: d.scale || 1 });
    // y 가 있으면 그 높이의 바닥에 (하늘닻·하늘 주조소처럼 높은 곳)
    const y = d.y !== undefined ? this.game.world.groundAt(d.x, d.z, d.y + 3) : this.game.world.groundAt(d.x, d.z, 1e5);
    fig.root.position.set(d.x, y, d.z);
    fig.yaw = Math.random() * 6.28;
    this.scene.add(fig.root);
    const mark = new THREE.Mesh(this.markGeo, this.markMat);
    mark.visible = false;
    this.scene.add(mark);
    const n = {
      ...d, fig, mark, pos: fig.root.position,
      target: null, wait: Math.random() * 4, speed: d.ambient ? 1.4 : 4.5,
      lastLine: -1,
    };
    this.list.push(n);
    this.byId.set(d.id, n);
    return n;
  }

  get(id) { return this.byId.get(id); }

  /** 인물 치우기 (건물 실내를 닫을 때) */
  remove(n) {
    this.scene.remove(n.fig.root);
    this.scene.remove(n.mark);
    const i = this.list.indexOf(n);
    if (i >= 0) this.list.splice(i, 1);
    this.byId.delete(n.id);
  }

  /** 장소로 이동 (퀘스트 동작) */
  goTo(id, x, z, opts = {}) {
    const n = this.get(id);
    if (!n) return;
    n.target = { x, z };
    n.home = { x, z, r: 6 };
    n.moved = true;
    if (opts.instant) { n.pos.set(x, this.game.world.groundAt(x, z), z); n.target = null; }
  }

  update(dt) {
    const g = this.game;
    const pp = g.player.pos;
    const night = g.world.atmos.state.night > 0.6;
    for (const n of this.list) {
      const dx = n.pos.x - pp.x, dz = n.pos.z - pp.z;
      const d2 = dx * dx + dz * dz;
      const lim = n.ambient ? g.engine.q.npcDist || 320 : 650;
      // 걷는 거신의 등에 사는 이: 갑판 위 한 점을 따라간다
      if (n.walker && g.colossi && g.colossi.town) {
        g.colossi.deckPoint(g.colossi.town, n.walker[0], n.walker[1], n.pos);
        n.home = { x: n.pos.x, z: n.pos.z, r: 1 };
        n.target = null;
      }
      const near = d2 < lim * lim && Math.abs(n.pos.y - pp.y) < 3000;
      n.fig.root.visible = near;
      n.mark.visible = false;
      if (!near) continue;
      // 이동
      if (n.target) {
        const tx = n.target.x - n.pos.x, tz = n.target.z - n.pos.z;
        const d = Math.hypot(tx, tz);
        // 플레이어를 이끄는 중이면 너무 멀어지지 않게 기다림
        const lead = n.lead && d2 > 40 * 40;
        if (d < 1.5) { n.target = null; n.wait = 3 + Math.random() * 6; }
        else if (!lead) {
          const sp = Math.min(n.speed, d);
          n.pos.x += (tx / d) * sp * dt; n.pos.z += (tz / d) * sp * dt;
          n.fig.yaw = Math.atan2(tx, tz);
        }
      } else if (n.ambient || n.wander) {
        n.wait -= dt;
        if (n.wait <= 0) {
          const h = n.home;
          if (night && n.ambient) {
            // 밤에는 광장 둘레로 모여 노래
            const a = (parseInt(n.id.slice(4), 10) || 0) * 0.7;
            const rr = Math.min(h.r, 60) * 0.5 + (h.minR || 0);
            n.target = { x: h.x + Math.cos(a) * rr, z: h.z + Math.sin(a) * rr };
          } else {
            const st = !n.indoor && g.city && g.city.snapStreet(n.pos.x, n.pos.z);
            if (st) {
              // 도시에서는 지금 선 고리 거리를 따라 걷는다
              const a = Math.atan2(n.pos.z - st.zone.cz, n.pos.x - st.zone.cx) + (Math.random() - 0.5) * (90 / st.R);
              n.target = { x: st.zone.cx + Math.cos(a) * st.R, z: st.zone.cz + Math.sin(a) * st.R };
            } else {
              const a = Math.random() * 6.28, r = (h.minR || 0) + Math.random() * (h.r - (h.minR || 0));
              n.target = { x: h.x + Math.cos(a) * r, z: h.z + Math.sin(a) * r };
            }
          }
          n.wait = 2;
        }
      }
      if (!n.walker) {
        const gy = g.world.groundAt(n.pos.x, n.pos.z, n.pos.y + 3);
        n.pos.y += (gy - n.pos.y) * Math.min(1, dt * 6);
      }
      // 플레이어 바라보기
      n.fig.look = d2 < 14 * 14 && !n.target ? pp : null;
      if (night && n.ambient && !n.target) n.fig.gesture = 0.4 + Math.sin(g.time * 1.2 + n.pos.x) * 0.2;
      else n.fig.gesture = Math.max(0, n.fig.gesture - dt);
      n.fig.update(dt);
      // 할 말이 있으면 !
      if (!n.ambient && g.quests.hasTalk(n.id)) {
        n.mark.visible = true;
        n.mark.position.set(n.pos.x, n.pos.y + 4.4 * (n.scale || 1) + Math.sin(g.time * 3) * 0.15, n.pos.z);
        n.mark.rotation.y = g.time * 2;
      }
    }
    // 지나가는 아웬의 혼잣말
    this.ambCooldown -= dt;
    if (this.ambCooldown <= 0 && g.mode === 'play') {
      const n = this.nearest(pp, 11, (x) => x.ambient);
      if (n) {
        const pool = g.state.nameSong ? [...AMBIENT, ...AMBIENT_AFTER_NAME] : AMBIENT;
        let i = Math.floor(Math.random() * pool.length);
        if (i === n.lastLine) i = (i + 1) % pool.length;
        n.lastLine = i;
        const line = { id: `amb_${pool.indexOf(pool[i])}${pool === AMBIENT ? '' : 'n'}`, ...pool[i] };
        g.lines[line.id] = line;
        g.say(n, line, true);
        this.ambCooldown = 9 + Math.random() * 8;
      } else this.ambCooldown = 1.5;
    }
  }

  /** 인물은 단단하다: 플레이어를 밀어낸다 */
  pushPlayer(pos) {
    for (const n of this.list) {
      if (!n.fig.root.visible || n.walker) continue;
      const dx = pos.x - n.pos.x, dz = pos.z - n.pos.z;
      if (Math.abs(dx) > 2 || Math.abs(dz) > 2 || Math.abs(pos.y - n.pos.y) > 2.6) continue;
      const d = Math.hypot(dx, dz), R = 0.5 * (n.scale || 1) + 0.42;
      if (d < R && d > 1e-4) { pos.x = n.pos.x + (dx / d) * R; pos.z = n.pos.z + (dz / d) * R; }
    }
  }

  nearest(p, r, filter = () => true) {
    let best = null, bd = r * r;
    for (const n of this.list) {
      if (!n.fig.root.visible || !filter(n)) continue;
      const d2 = (n.pos.x - p.x) ** 2 + (n.pos.z - p.z) ** 2 + ((n.pos.y - p.y) * 0.5) ** 2;
      if (d2 < bd) { bd = d2; best = n; }
    }
    return best;
  }
}
