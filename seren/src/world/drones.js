// 돌보미: 도시와 정원을 돌보는 작은 떠다니는 기계들.
// 평소에는 저마다 맡은 곳 둘레를 떠돌고, 가끔 주인공에게 다가와 살펴보고(호기심),
// 공명 음을 들으면 그 음의 색으로 빛나며 짧게 따라 노래합니다.
import * as THREE from 'three';
import { heightAt } from './heightfield.js';
import { mulberry32 } from '../core/noise.js';
import { part, merge, xf } from './geo-utils.js';
import * as A from './arch.js';
import { litMaterial } from './materials.js';
import { PointLights } from './lights.js';
import { PLACES } from '../data/places.js';
import { NOTE_COLORS } from '../core/audio.js';
import { bus } from '../core/events.js';

const PAL = A.PAL;

function droneGeo() {
  const parts = [];
  parts.push(part(new THREE.SphereGeometry(0.62, 12, 8), (x, y) => (y > 0.1 ? PAL.pearl : 0xd2cce0), 0));
  parts.push(part(xf(new THREE.TorusGeometry(0.95, 0.07, 4, 20), { rx: Math.PI / 2 }), 0xffffff, 1.8));
  parts.push(part(xf(new THREE.CircleGeometry(0.22, 10), { z: 0.6 }), 0x0a1a28, 0));
  parts.push(part(xf(new THREE.CircleGeometry(0.11, 8), { z: 0.62 }), 0xffffff, 2.2));
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + Math.PI / 2;
    parts.push(part(xf(new THREE.BoxGeometry(0.06, 0.5, 0.32), { x: Math.cos(a) * 0.55, y: -0.45, z: Math.sin(a) * 0.55, rz: Math.cos(a) * 0.5, rx: -Math.sin(a) * 0.5 }), PAL.gold, 0.3));
  }
  return merge(parts);
}

export class Drones {
  constructor(world, game) {
    this.world = world;
    this.game = game;
    this.scene = world.scene;
    this.list = [];
    this.t = 0;
    const anchors = [];
    for (const p of PLACES) {
      if (['capital'].includes(p.type)) for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; anchors.push({ x: Math.cos(a) * 900, z: Math.sin(a) * 900, r: 260, n: 4 }); }
      else if (['village', 'glasscity', 'bloomcity', 'canyoncity', 'seacity', 'observatory', 'starport', 'district', 'landmark'].includes(p.type)) anchors.push({ x: p.pos[0], z: p.pos[1], r: Math.min(260, (p.radius || 120) * 0.8), n: p.type === 'village' ? 5 : 6 });
    }
    const total = anchors.reduce((s, a) => s + a.n, 0);
    const mat = litMaterial({ vertexColors: true, vertexEmit: true, emissive: 0xffffff, emissiveIntensity: 1.4, emissiveNight: 0.5, rim: 0.9, rimColor: 0xe0f8ff, spec: 1.4 });
    this.mesh = new THREE.InstancedMesh(droneGeo(), mat, total);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(total * 3).fill(1), 3);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
    this.lights = new PointLights(this.scene, total, { minPx: 1.4, day: 0.25 });
    const rnd = mulberry32(99);
    for (const a of anchors) for (let i = 0; i < a.n; i++) {
      const d = {
        a, idx: this.list.length, ph: rnd() * 100, sp: 0.04 + rnd() * 0.05, alt: 4 + rnd() * 18,
        pos: new THREE.Vector3(a.x, heightAt(a.x, a.z) + 10, a.z), vel: new THREE.Vector3(), tgt: new THREE.Vector3(),
        yaw: 0, excite: 0, color: new THREE.Color(0xffffff), curious: 0, scale: rnd() < 0.2 ? 1.8 : 1,
      };
      d.light = this.lights.add(d.pos.x, d.pos.y, d.pos.z, 0xbffcff, 2.5 * d.scale, 0, 0);
      this.list.push(d);
    }
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._s = new THREE.Vector3();
    bus.on('tone', (e) => this._onTone(e));
  }

  _onTone(e) {
    for (const d of this.list) {
      if (d.pos.distanceToSquared(e.pos) > 90 * 90) continue;
      d.excite = 3.5;
      d.color.set(NOTE_COLORS[e.n] || 0xffffff);
      d.toneN = e.n;
      d.answerT = 0.4 + Math.random() * 1.2;
    }
  }

  update(dt, ctx) {
    this.t += dt;
    const g = this.game;
    const cam = g.engine.camera.position;
    const pl = g.player.pos;
    const m = this._m, q = this._q, e = this._e, S = this._s;
    let answered = 0;
    for (const d of this.list) {
      const far = d.pos.distanceToSquared(cam) > 2500 * 2500;
      if (far && (this.t * 10 + d.idx) % 30 > 1) continue;
      const t = this.t * d.sp + d.ph;
      const a = d.a;
      // 목표: 맡은 곳 둘레를 떠돌기, 가끔 주인공에게 다가가기
      const nearPl = Math.hypot(pl.x - a.x, pl.z - a.z) < a.r + 80;
      if (nearPl && d.curious <= 0 && Math.random() < dt * 0.01) d.curious = 8 + Math.random() * 8;
      d.curious = Math.max(0, d.curious - dt);
      if (d.curious > 0 || d.excite > 0) {
        const ang = this.t * 0.6 + d.idx;
        const r = d.excite > 0 ? 4 + d.idx % 3 : 7;
        d.tgt.set(pl.x + Math.cos(ang) * r, pl.y + (d.excite > 0 ? 3.5 + Math.sin(this.t * 3 + d.idx) : 2.6), pl.z + Math.sin(ang) * r);
      } else {
        const x = a.x + Math.sin(t * 1.3) * a.r * 0.8 + Math.sin(t * 3.1 + 2) * a.r * 0.2;
        const z = a.z + Math.cos(t * 1.1) * a.r * 0.8 + Math.cos(t * 2.7 + 1) * a.r * 0.2;
        d.tgt.set(x, Math.max(heightAt(x, z), 0) + d.alt + Math.sin(t * 5) * 2, z);
      }
      // 부드러운 추적
      const k = Math.min(1, dt * (d.curious > 0 || d.excite > 0 ? 1.5 : 0.6));
      d.vel.x += ((d.tgt.x - d.pos.x) * 0.8 - d.vel.x) * k;
      d.vel.y += ((d.tgt.y - d.pos.y) * 0.8 - d.vel.y) * k;
      d.vel.z += ((d.tgt.z - d.pos.z) * 0.8 - d.vel.z) * k;
      const sp = d.vel.length();
      if (sp > 18) d.vel.multiplyScalar(18 / sp);
      d.pos.addScaledVector(d.vel, far ? dt * 30 : dt);
      const gh = Math.max(heightAt(d.pos.x, d.pos.z), 0) + 1.2;
      if (d.pos.y < gh) d.pos.y = gh;
      // 얼굴: 주인공을 보거나 움직이는 방향
      const look = d.curious > 0 || d.excite > 0 ? Math.atan2(pl.x - d.pos.x, pl.z - d.pos.z) : Math.atan2(d.vel.x, d.vel.z);
      let dy = Math.atan2(Math.sin(look - d.yaw), Math.cos(look - d.yaw));
      d.yaw += dy * Math.min(1, dt * 3);
      e.set(Math.max(-0.4, Math.min(0.4, d.vel.z * 0.03)), d.yaw, -Math.max(-0.4, Math.min(0.4, d.vel.x * 0.03)));
      q.setFromEuler(e);
      const s = d.scale * (1 + (d.excite > 0 ? 0.15 * Math.sin(this.t * 12) : 0));
      S.setScalar(s);
      m.compose(d.pos, q, S);
      this.mesh.setMatrixAt(d.idx, m);
      // 색: 흥분하면 음의 색
      if (d.excite > 0) {
        d.excite -= dt;
        this.mesh.setColorAt(d.idx, d.color);
        this.lights.color(d.idx, d.color.getHex(), 1.6);
        if (d.answerT !== undefined) {
          d.answerT -= dt;
          if (d.answerT <= 0 && answered < 2) {
            answered++;
            g.audio.tone(d.toneN, { pos: d.pos, gain: 0.12, octave: 1, maxDist: 120 });
            d.answerT = undefined;
          }
        }
        if (d.excite <= 0) { this.mesh.setColorAt(d.idx, _white); this.lights.color(d.idx, 0xbffcff); }
      }
      this.lights.set(d.idx, d.pos.x, d.pos.y - 0.2, d.pos.z);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.lights.update();
  }
}

const _white = new THREE.Color(1, 1, 1);
