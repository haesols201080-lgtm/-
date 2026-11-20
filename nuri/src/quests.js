// Quest chain + objective guidance: an ordered list of goals (each completes whenever its condition holds, so
// they can be done out of order), a tracker panel, a world-space objective marker that clamps to the screen
// edge with distance, completion banners, and shard milestone rewards.
import * as THREE from 'three';
import { LOG } from './story.js';

const nearestShard = (g, p) => {
  let best = null, bd = Infinity;
  for (const s of g.shards) if (!s.got) { const d = s.mesh.position.distanceToSquared(p); if (d < bd) { bd = d; best = s.mesh.position; } }
  return best;
};

export const QUESTS = [
  { id: 'first', title: '착륙 지점', text: () => '근처의 동력 결정 회수', prog: (g) => [Math.min(3, g.save.shards.length), 3],
    done: (g) => g.save.shards.length >= 3, target: (g, p) => nearestShard(g, p), reward: '근거리 결정 탐지 (미니맵)' },
  { id: 'toto', title: '약한 식별 신호', text: () => '거목 뿌리 부근에서 토토 찾기',
    done: (g) => g.save.companions.includes('toto'), target: (g) => g.companions[0]?.pos },
  { id: 'gate', title: '녹슨 철문', text: () => '압력판에 무게를 올려 문 열기',
    done: (g) => g.save.gateOpen, target: (g) => { const c = g.gateCrate?.body.translation(); return c && Math.hypot(c.x - g.plate.pos.x, c.z - g.plate.pos.z) > 0.5 ? new THREE.Vector3(c.x, c.y, c.z) : g.plate.pos; } },
  { id: 'booster', title: '미확인 추진 장치', text: () => '그루터기 위의 장치 회수',
    done: (g) => g.save.booster, target: (g) => g.booster?.mesh.position || g.world.stumps[0] && new THREE.Vector3(g.world.stumps[0].x, g.world.stumps[0].top, g.world.stumps[0].z),
    reward: '2단 점프 · 호버링' },
  { id: 'bori', title: '어두운 동굴', text: () => '바위산 아래 동굴에서 보리 찾기',
    done: (g) => g.save.companions.includes('bori'), target: (g) => g.caveCenter },
  { id: 'cell', title: '정지된 승강기', text: (g) => (g.player.carry === g.cell ? '승강기 소켓에 동력 셀 연결' : '속 빈 통나무에서 동력 셀 찾기'),
    done: (g) => g.save.liftPowered, target: (g) => (g.player.carry === g.cell || !g.cell ? g.lift?.socketPos : g.cell.mesh.position) },
  { id: 'mina', title: '전망 바위의 비콘', text: () => '승강기로 올라가 미나와 합류',
    done: (g) => g.save.companions.includes('mina'), target: (g) => g.summit },
  { id: 'charge', title: '미나의 연료', text: () => '동력 결정 회수', prog: (g) => [Math.min(CHARGE, g.save.shards.length), CHARGE],
    done: (g) => g.save.shards.length >= CHARGE && g.save.companions.includes('mina'), target: (g, p) => (g.save.shards.length >= CHARGE - 6 ? nearestShard(g, p) : null) },
  { id: 'garden', title: '울타리 너머', text: () => '울타리 틈으로 들어가기',
    done: (g) => g.save.regions.includes('garden'), target: (g) => g.fenceGap },
];
export const CHARGE = 30;

// shard milestones: every few shards something new
export const MILESTONES = [
  { n: 3, id: 'scan', title: '결정 탐지기', desc: '미니맵에 가까운 동력 결정이 표시돼요.' },
  { n: 12, id: 'dash', title: '에어 대시', desc: '공중에서 숙이기 버튼을 누르면 앞으로 돌진해요.' },
  { n: 25, id: 'magnet', title: '결정 자석', desc: '동력 결정을 더 멀리서 끌어당겨요.' },
  { n: 40, id: 'wide', title: '넓은 탐지기', desc: '미니맵 탐지 범위가 두 배로 넓어져요.' },
];

export class Quests {
  constructor(gameplay, ui, audio, camera) {
    Object.assign(this, { g: gameplay, ui, audio, camera });
    this.cur = null; this.shownId = null; this.doneSet = new Set(); this.v = new THREE.Vector3();
    this.el = document.getElementById('qmarker'); this.elD = document.getElementById('qmarker-d');
    this.ready = false;
  }
  // called once progress is known (new game or loaded save): already-finished quests don't announce themselves
  init() {
    for (const q of QUESTS) if (q.done(this.g)) this.doneSet.add(q.id);
    this.ready = true; this.refresh(true);
  }
  active() { return QUESTS.find((q) => !this.doneSet.has(q.id)) || null; }
  refresh(silent) {
    const q = this.active();
    if (!q) { this.ui.setQuest(null); return; }
    const pr = q.prog?.(this.g);
    const isNew = !silent && q.id !== this.shownId;
    const progKey = q.id + ':' + (pr ? pr[0] : '');
    if (isNew || (this.progKey && progKey !== this.progKey)) this.peekT = 7;     // show the panel when something changed
    this.progKey = progKey;
    this.ui.setQuest({ title: q.title, text: q.text(this.g), prog: pr, step: QUESTS.indexOf(q) + 1, total: QUESTS.length }, isNew);
    // Nuri thinks out loud as each new goal begins (after the completion banner has had its moment)
    if (isNew && LOG[q.id]) setTimeout(() => { if (!this.ui.dlg) this.ui.bubble('누리', LOG[q.id]); }, 2600);
    this.shownId = q.id;
  }
  update(dt, playerPos, playing) {
    if (!this.ready) return;
    const g = this.g;
    let changed = false;
    for (const q of QUESTS) if (!this.doneSet.has(q.id) && q.done(g)) {
      this.doneSet.add(q.id); changed = true;
      this.ui.questDone(q.title, q.reward);
      this.audio.play('quest');
      if (q.id === 'charge' && !g.save.charged) { g.save.charged = true; g.persist(); setTimeout(() => this.onCharged?.(), 3200); }
    }
    // text/progress can change without completion (carrying the cell, shard count)
    this.tick = (this.tick || 0) + dt;
    if (changed || this.tick > 0.5) { this.tick = 0; this.refresh(!changed && this.shownId !== null); }
    // the panel stays out of the way: it shows when the goal changes, when the robot stands still or the map is open
    this.peekT = Math.max(0, (this.peekT || 0) - dt);
    const visible = this.peekT > 0 || g.player.idleT > 5 || this.mapOpen?.();
    if (visible !== this.visible) { this.visible = visible; document.getElementById('quest').classList.toggle('tucked', !visible); }
    // objective marker
    const q = this.active();
    const tgt = (playing && this.override?.()) || (playing && q ? q.target(g, playerPos) : null);
    this.target = tgt || null;
    if (!tgt || !this.el) { this.el?.classList.add('hidden'); return; }
    const d = Math.hypot(tgt.x - playerPos.x, (tgt.y ?? playerPos.y) - playerPos.y, tgt.z - playerPos.z);
    // a light touch: the marker only when guidance is on and the panel is showing, the target is far, or a trial runs
    if (d < 1.2 || this.guide === false || (!visible && d < 14 && !this.override?.())) { this.el.classList.add('hidden'); return; }
    this.el.classList.remove('hidden');
    const v = this.v.set(tgt.x, (tgt.y ?? playerPos.y) + 0.35, tgt.z).project(this.camera);
    const W = innerWidth, H = innerHeight, behind = v.z > 1;
    let x = (v.x * 0.5 + 0.5) * W, y = (-v.y * 0.5 + 0.5) * H;
    if (behind) { x = W - x; y = H - y; }
    const m = 46, off = behind || x < m || x > W - m || y < m + 40 || y > H - m;
    if (off) {
      // push the marker onto the screen border along the direction from the screen centre
      const cx = W / 2, cy = H / 2; let dx = x - cx, dy = y - cy;
      if (behind && Math.abs(dy) < 1) dy = H;
      const k = Math.min((W / 2 - m) / Math.max(1e-3, Math.abs(dx)), (H / 2 - m - 20) / Math.max(1e-3, Math.abs(dy)));
      x = cx + dx * k; y = cy + dy * k;
      this.el.style.setProperty('--rot', Math.atan2(dy, dx) + Math.PI / 2 + 'rad');
    }
    this.el.classList.toggle('edge', off);
    this.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    this.elD.textContent = d < 10 ? d.toFixed(1) + 'm' : Math.round(d) + 'm';
  }
}
