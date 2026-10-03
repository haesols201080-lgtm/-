// 3인칭 카메라: 마우스/터치로 돌리고, 움직이면 천천히 뒤로 돌아오며, 속도에 따라 시야각이 넓어집니다.
import * as THREE from 'three';

const DIST = { ground: 6.2, air: 7, glide: 9.5, skim: 8.5, swim: 6, current: 11, lift: 9, fly: 10.5 };

export class CameraRig {
  constructor(camera, world) {
    this.camera = camera;
    this.world = world;
    this.yaw = 0; // 0 = 북쪽(−Z)을 바라봄
    this.pitch = -0.22;
    this.dist = 6.2;
    this.zoom = 1;
    this.target = new THREE.Vector3();
    this.smoothTarget = new THREE.Vector3();
    this.shakeT = 0;
    this.shakeAmp = 0;
    this.fovBase = 62;
    this.autoFollow = true;
    this.override = null; // 연출용: {pos, look, fov}
    this._v = new THREE.Vector3();
    this._init = false;
  }

  shake(a) { this.shakeAmp = Math.max(this.shakeAmp, a); }

  update(dt, input, player) {
    const cam = this.camera;
    // 입력
    this.yaw -= input.look.x;
    this.pitch -= input.look.y;
    this.pitch = Math.max(-1.35, Math.min(0.75, this.pitch));
    if (input.wheel) this.zoom = Math.max(0.55, Math.min(2.2, this.zoom + input.wheel * 0.08));

    // 이동 중이면 등 뒤로 서서히 돌아옴 (특히 터치에서 편함)
    const s = player.state;
    const moving = player.hspeed > 2;
    const idleLook = input.lookActive > (input.lastDevice === 'touch' ? 0.9 : 2.2);
    if (this.autoFollow && moving && idleLook && s !== 'swim') {
      const behind = player.yaw + Math.PI;
      let d = Math.atan2(Math.sin(behind - this.yaw), Math.cos(behind - this.yaw));
      const rate = s === 'glide' || s === 'skim' || s === 'current' || s === 'fly' ? 2.2 : 0.8;
      this.yaw += d * Math.min(1, dt * rate * Math.min(1, player.hspeed / 8));
      if (s === 'ground' || s === 'skim') this.pitch += (-0.2 - this.pitch) * Math.min(1, dt * 0.5);
    }

    // 목표 지점
    const tgtY = s === 'glide' || s === 'current' ? 0.9 : s === 'swim' ? 0.7 : 1.55;
    this.target.set(player.pos.x, player.pos.y + tgtY, player.pos.z);
    // 실내: 점프해도 카메라는 거의 따라 오르지 않는다 (천장 쪽으로 치솟지 않게)
    if (this.floorLock != null) this.target.y = this.floorLock + tgtY + Math.max(0, player.pos.y - this.floorLock) * 0.25;
    if (!this._init) { this.smoothTarget.copy(this.target); this._init = true; }
    const k = s === 'ground' ? 18 : 12;
    this.smoothTarget.x += (this.target.x - this.smoothTarget.x) * Math.min(1, dt * k);
    this.smoothTarget.z += (this.target.z - this.smoothTarget.z) * Math.min(1, dt * k);
    this.smoothTarget.y += (this.target.y - this.smoothTarget.y) * Math.min(1, dt * (s === 'ground' ? 10 : 8));
    // 큰 순간이동은 그대로
    if (this.smoothTarget.distanceToSquared(this.target) > 400) this.smoothTarget.copy(this.target);

    const want = (DIST[s] || 7) * this.zoom + Math.min(4, player.hspeed * 0.05);
    this.dist += (want - this.dist) * Math.min(1, dt * 2.5);

    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const dir = this._v.set(Math.sin(this.yaw) * cp, -sp, Math.cos(this.yaw) * cp); // 대상 → 카메라 반대
    // 카메라 위치 = 대상 - 시선방향 * 거리
    let dist = this.dist;
    // 지형 충돌: 카메라 팔을 따라 몇 점을 보며 땅 밑으로 들어가지 않게
    const H = this.world.heightAt;
    for (let i = 1; i <= 4; i++) {
      const t = (i / 4) * dist;
      const x = this.smoothTarget.x + dir.x * t, z = this.smoothTarget.z + dir.z * t;
      const y = this.smoothTarget.y + dir.y * t;
      const gh = Math.max(H(x, z), 0) + 0.5;
      if (y < gh) {
        // 위로 들어 올림
        const lift = gh - y;
        dir.y += lift / t;
      }
    }
    dir.normalize();
    // 구조물 충돌: 카메라 팔이 건물·벽·바위에 막히면 그 앞까지 당긴다 (바로) — 막힘이 풀리면 천천히 돌아간다
    const C = this.world.colliders;
    if (C && C.cast) {
      const st = this.smoothTarget;
      const hit = C.cast(st.x, st.y, st.z, dir.x, dir.y, dir.z, dist, 0.42);
      const want2 = Math.max(0.9, hit - 0.15);
      if (want2 < this.armLen || this.armLen == null) this.armLen = want2;
      else this.armLen = Math.min(want2, this.armLen + dt * Math.max(2.5, (want2 - this.armLen) * 3));
      dist = Math.min(dist, this.armLen);
      this.blocked = this.armLen < this.dist - 0.3;
    }
    cam.position.set(this.smoothTarget.x + dir.x * dist, this.smoothTarget.y + dir.y * dist, this.smoothTarget.z + dir.z * dist);
    // 벽에 바짝 붙어 팔이 아주 짧아지면 머리 위로 조금 올려 내려다본다 (등만 화면을 가리지 않게)
    if (C && C.cast && this.armLen < 1.8 && (s === 'ground' || s === 'air')) {
      const lift = (1.8 - this.armLen) * 0.75;
      const room = C.cast(cam.position.x, cam.position.y, cam.position.z, 0, 1, 0, lift + 0.4, 0.3);
      cam.position.y += Math.max(0, Math.min(lift, room - 0.4));
    }
    const gh = Math.max(H(cam.position.x, cam.position.z), 0) + 0.45;
    if (cam.position.y < gh) cam.position.y = gh;

    // 흔들림
    if (this.shakeAmp > 0.001) {
      this.shakeT += dt * 40;
      const a = this.shakeAmp;
      cam.position.x += Math.sin(this.shakeT * 1.3) * a;
      cam.position.y += Math.sin(this.shakeT * 1.7 + 1) * a;
      this.shakeAmp *= Math.exp(-dt * 6);
    }

    cam.lookAt(this.smoothTarget);
    // 속도감: 시야각
    const fv = this.fovBase + Math.min(20, Math.max(0, player.hspeed - 8) * 0.42);
    cam.fov += (fv - cam.fov) * Math.min(1, dt * 3);
    cam.near = s === 'glide' || s === 'current' || player.pos.y - player.groundH > 60 ? 1.2 : this.blocked ? 0.2 : 0.6; // 벽 가까이 당겨졌으면 가까운 면을 줄여 벽 속이 보이지 않게
    cam.updateProjectionMatrix();

    if (this.override) this._applyOverride(dt);
  }

  _applyOverride() {
    const o = this.override;
    this.camera.position.copy(o.pos);
    this.camera.lookAt(o.look);
    if (o.fov) { this.camera.fov = o.fov; this.camera.updateProjectionMatrix(); }
  }

  /** 시선 방향의 pitch (활공 조종용): 아래를 보면 음수 */
  get viewPitch() { return this.pitch; }
}
