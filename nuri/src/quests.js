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
  { id: 'first', title: '첫걸음', text: () => '반짝이는 빛 조각 3개 모으기', prog: (g) => [Math.min(3, g.save.shards.length), 3],
    done: (g) => g.save.shards.length >= 3, target: (g, p) => nearestShard(g, p), reward: '미니맵에 주변 빛 조각이 표시돼요' },
  { id: 'toto', title: '뿌리 언덕의 목소리', text: () => '큰 나무 뿌리 사이에서 토토 찾기',
    done: (g) => g.save.companions.includes('toto'), target: (g) => g.companions[0]?.pos },
  { id: 'gate', title: '녹슨 울타리 문', text: () => '나무 상자를 밀어 발판 위에 올리기',
    done: (g) => g.save.gateOpen, target: (g) => { const c = g.gateCrate?.body.translation(); return c && Math.hypot(c.x - g.plate.pos.x, c.z - g.plate.pos.z) > 0.5 ? new THREE.Vector3(c.x, c.y, c.z) : g.plate.pos; } },
  { id: 'booster', title: '그루터기의 선물', text: () => '상자를 딛고 그루터기 위의 부스터 얻기',
    done: (g) => g.save.booster, target: (g) => g.booster?.mesh.position || g.world.stumps[0] && new THREE.Vector3(g.world.stumps[0].x, g.world.stumps[0].top, g.world.stumps[0].z),
    reward: '2단 점프 · 호버링' },
  { id: 'bori', title: '반딧불 동굴', text: () => '폭포 바위 아래 동굴에서 보리 찾기',
    done: (g) => g.save.companions.includes('bori'), target: (g) => g.caveCenter },
  { id: 'cell', title: '멈춘 리프트', text: (g) => (g.player.carry === g.cell ? '리프트 소켓에 동력 셀 꽂기' : '속 빈 통나무 안에서 동력 셀 찾기'),
    done: (g) => g.save.liftPowered, target: (g) => (g.player.carry === g.cell || !g.cell ? g.lift?.socketPos : g.cell.mesh.position) },
  { id: 'mina', title: '전망 바위', text: () => '리프트를 타고 올라가 미나 만나기',
    done: (g) => g.save.companions.includes('mina'), target: (g) => g.summit },
  { id: 'all', title: '숲의 빛', text: () => '숲의 빛 조각 모두 모으기', prog: (g) => [g.save.shards.length, g.totalShards],
    done: (g) => g.save.shards.length >= g.totalShards, target: (g, p) => (g.save.shards.length >= 30 ? nearestShard(g, p) : null) },
];

// shard milestones: every few shards something new
export const MILESTONES = [
  { n: 3, id: 'scan', title: '빛 탐지기', desc: '미니맵에 가까운 빛 조각이 보여요.' },
  { n: 12, id: 'dash', title: '에어 대시', desc: '공중에서 숙이기 버튼을 누르면 앞으로 돌진해요.' },
  { n: 25, id: 'magnet', title: '빛 자석', desc: '빛 조각을 더 멀리서 끌어당겨요.' },
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
      if (q.id === 'all' && !g.save.ended) { g.save.ended = true; g.persist(); setTimeout(() => this.onEnding?.(), 3500); }
    }
    // text/progress can change without completion (carrying the cell, shard count)
    this.tick = (this.tick || 0) + dt;
    if (changed || this.tick > 0.5) { this.tick = 0; this.refresh(!changed && this.shownId !== null); }
    // objective marker
    const q = this.active();
    const tgt = (playing && this.override?.()) || (playing && q ? q.target(g, playerPos) : null);
    this.target = tgt || null;
    if (!tgt || !this.el) { this.el?.classList.add('hidden'); return; }
    const d = Math.hypot(tgt.x - playerPos.x, (tgt.y ?? playerPos.y) - playerPos.y, tgt.z - playerPos.z);
    if (d < 1.2) { this.el.classList.add('hidden'); return; }
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
