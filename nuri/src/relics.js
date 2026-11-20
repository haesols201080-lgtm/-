// Relics of the giants: small things people lost in the forest (photoscans at their real size), found by looking
// around — a faint glint now and then is the only hint. Inspecting one writes Nuri's field note on it into the
// survey journal. They stay where they are: some are climbable, the duck floats on the pond.
import * as THREE from 'three';
import { POND, LOGS, START } from './layout.js';

export const RELICS = [
  { id: 'pocket_watch', name: '멈춘 은빛 원반', desc: '뚜껑을 열면 바늘 두 개가 3시 12분에 멈춰 있다. 거인들은 시간을 주머니에 넣고 다녔던 모양이다. 다람쥐가 이걸 굳이 바위 꼭대기까지 끌고 올라왔다.' },
  { id: 'seadogs_compass', name: '한 방향만 보는 바늘', desc: '아무리 돌려도 바늘은 한쪽만 가리킨다. 고집이 센 기계다. 나와 달리 길을 잃지 않는다.' },
  { id: 'rubber_duck_toy', name: '물에 뜨는 노란 새', desc: '생물로 판단하고 11분간 관찰했다. 호흡 없음. 표정 변화 없음. 그런데도 이상하게 경계가 풀린다.' },
  { id: 'can_rusted', name: '녹슨 금속 원통', desc: '안은 비어 있다. 거인들은 음식을 금속 안에 가두어 보관했다. 지금은 달팽이 두 마리의 집이다.' },
  { id: 'garden_gloves_01', name: '거인의 손 허물', desc: '거인의 손 모양 그대로 남은 천 껍데기. 굴이 다섯 개 있다. 들어가 보았다. 생각보다 따뜻했다.' },
  { id: 'digital_wrist_watch', name: '꺼진 손목 장치', desc: '화면에 아무것도 나오지 않는다. 안에 든 전지가 내 예비 전지와 같은 규격이다. …빌리지는 않았다.' },
  { id: 'baseball_01', name: '붉은 실로 꿰맨 구체', desc: '바느질 자국 108개. 굴리거나 던지기 위한 물체로 추정. 토토는 거인들이 이걸 치고 달리는 놀이를 한다고 했다. 믿기 어렵다.' },
  { id: 'measuring_tape_01', name: '말려 있는 금속 혀', desc: '당기면 눈금이 새겨진 혀가 나온다. 재 보니 나는 35센티미터. 기록과 일치. 이 숲에서 정확한 건 이것뿐이다.' },
  { id: 'screwdriver', name: '손잡이 달린 쇠 이빨', desc: '끝이 십자 모양. 내 등 판의 나사와 정확히 맞는다. 연구소에서 쓰던 것과 같은 규격이다. 누군가 이 숲에 우리를 고치러 온 적이 있다.' },
  { id: 'Camera_01', name: '렌즈가 깨진 상자', desc: '토토와 같은 일을 하던 기계. 마지막으로 무엇을 찍었는지는 알 수 없다. 토토가 오래 들여다보았다.' },
];

export class Relics {
  constructor({ ctx, gameplay, world, player, ui, audio, fx }) {
    Object.assign(this, { ctx, gameplay, world, player, ui, audio, fx });
    this.scene = ctx.scene; this.items = [];
    gameplay.save.relics = gameplay.save.relics || [];
    const gp = gameplay, T = world.terrain;
    const g = (x, z) => gp.groundY(x, z);
    const L3 = world.logs[3], L0 = LOGS[0];
    // where people dropped things (and where animals carried them)
    const spots = {
      pocket_watch: gp.stash ? { p: gp.stash.clone().add(new THREE.Vector3(0.05, 0.005, -0.06)), rx: -Math.PI / 2 } : null,
      seadogs_compass: { p: new THREE.Vector3(-17.4, 0, -23.9) },
      rubber_duck_toy: { p: new THREE.Vector3(POND.x - 1.6, T.waterY, POND.z + 0.9), float: true },
      can_rusted: { p: new THREE.Vector3(L0[0] + 0.55, 0, L0[1] - 0.2), rz: Math.PI / 2 },
      garden_gloves_01: { p: new THREE.Vector3(-1.6, 0, -35.6) },
      digital_wrist_watch: gp.caveCenter ? { p: gp.caveCenter.clone().add(new THREE.Vector3(0.35, 0, 0.2)), drop: true } : null,
      baseball_01: { p: new THREE.Vector3(START.x + 3.4, 0, START.z - 2.6) },
      measuring_tape_01: gp.lift ? { p: gp.lift.mesh.position.clone().add(new THREE.Vector3(0.7, 0, 0.6)), drop: true } : null,
      screwdriver: { p: new THREE.Vector3(-12.2, 0, -12.6), rz: 1.45 },
      Camera_01: L3 ? { p: new THREE.Vector3((L3.x1 + L3.x2) / 2 + 0.3, L3.y + L3.r + 0.02, (L3.z1 + L3.z2) / 2), onLog: true } : null,
    };
    for (const R of RELICS) {
      const sp = spots[R.id], src = ctx.assets.models['relic_' + R.id];
      if (!sp || !src) continue;
      const grp = new THREE.Group(); grp.add(src.scene.clone(true));
      grp.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      grp.rotation.set(sp.rx || 0, Math.random() * 6.28, sp.rz || 0);
      grp.updateMatrixWorld(true);
      const bb = new THREE.Box3().setFromObject(grp);
      const p = sp.p.clone();
      const ground = sp.float ? T.waterY - (bb.max.y - bb.min.y) * 0.35 : sp.onLog ? p.y : (sp.drop || p.y === 0 ? g(p.x, p.z) : p.y);
      grp.position.set(p.x, ground - bb.min.y - 0.004, p.z);
      this.scene.add(grp); grp.updateMatrixWorld(true);
      // solid enough to bump into or climb onto (the duck floats free)
      if (!sp.float) grp.traverse((o) => { if (o.isMesh) world.hull(o.geometry, o.matrixWorld, { kind: 'rock', surface: 'metal' }); });
      const wb = new THREE.Box3().setFromObject(grp), c = wb.getCenter(new THREE.Vector3());
      const it = { R, grp, c, top: wb.max.y, float: !!sp.float, y0: grp.position.y, glintT: Math.random() * 4 };
      this.items.push(it);
      gp.interactables.push({ pos: c, r: Math.max(0.42, (wb.max.x - wb.min.x) * 0.7), label: () => (this.found(R.id) ? `${R.name} 다시 살펴보기` : '조사하기'), act: () => this.inspect(it) });
    }
  }
  found(id) { return this.gameplay.save.relics.includes(id); }
  inspect(it) {
    const first = !this.found(it.R.id);
    if (first) { this.gameplay.save.relics.push(it.R.id); this.gameplay.persist(); this.audio.play('discover'); this.fx.burst(it.c, 0xffe7a8, 14); }
    this.player.playAction('inspect', 1.6); this.player.emit('inspect');
    this.onInspect?.(it, first);
    this.ui.relic(it.R.name, it.R.desc, first ? `거인의 유물 ${this.gameplay.save.relics.length} / ${this.items.length}` : '탐사 일지에 기록됨');
  }
  update(dt, time) {
    const P = this.player.pos;
    for (const it of this.items) {
      if (it.float) { it.grp.position.y = it.y0 + Math.sin(time * 1.3 + 1) * 0.006; it.grp.rotation.z = Math.sin(time * 0.9) * 0.05; }
      // the only hint: an occasional glint on things not yet looked at, when the robot is within ~12 m
      if (this.found(it.R.id)) continue;
      it.glintT -= dt;
      if (it.glintT < 0) {
        it.glintT = 2.5 + Math.random() * 3;
        if ((it.c.x - P.x) ** 2 + (it.c.z - P.z) ** 2 < 144) this.fx.spawn({ x: it.c.x, y: it.top + 0.01, z: it.c.z, vx: 0, vy: 0.02, vz: 0, g: 0, drag: 0, max: 0.5, s0: 0.03, s1: 0.0, c: [1, 0.95, 0.8], a: 0.9, add: true });
      }
    }
  }
}
