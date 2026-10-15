// 공명 해류: 하늘에 흐르는 빛의 길. 닿으면 실려서 빠르게 날아갑니다.
// 아웬은 해류로 도시와 도시를 잇습니다. 공명탑을 깨우면 그 지역으로 가는 해류가 다시 흐릅니다.
import * as THREE from 'three';
import { heightAt } from './heightfield.js';
import { CURVE_GLSL, ATMOS_PARS, NOISE_GLSL } from './shaders.js';
import { atmosUniforms } from './atmosphere.js';

const vert = /* glsl */ `
${CURVE_GLSL}
varying vec2 vUv;
varying vec3 vWorld;
varying vec3 vN;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * vec4(curveWorld(wp.xyz), 1.0);
}`;

const frag = /* glsl */ `
${NOISE_GLSL}
${ATMOS_PARS}
uniform vec3 uColor;
uniform float uLen;
uniform float uFlow;
uniform float uOn;
uniform float uDir;
varying vec2 vUv;
varying vec3 vWorld;
varying vec3 vN;
void main() {
  vec3 V = normalize(cameraPosition - vWorld);
  float f = abs(dot(normalize(vN), V));
  float edge = pow(1.0 - f, 1.6);
  float along = vUv.x * uLen;
  float s1 = smoothstep(0.75, 1.0, fract(along / 34.0 - uTime * uFlow * uDir / 34.0 + vUv.y * 0.5));
  float s2 = smoothstep(0.9, 1.0, fract(along / 13.0 - uTime * uFlow * uDir * 1.4 / 13.0 + vUv.y * 2.0));
  float n = vnoise(vec2(along * 0.05 - uTime * uFlow * uDir * 0.05, vUv.y * 6.0));
  float a = (edge * 0.55 + s1 * 0.6 + s2 * 0.4) * (0.6 + 0.4 * n);
  float fade = smoothstep(0.0, 0.015, vUv.x) * smoothstep(1.0, 0.985, vUv.x);
  float fog = fogAmount(cameraPosition, vWorld);
  float near = smoothstep(3.0, 18.0, distance(cameraPosition, vWorld));
  a *= near;
  float night = 0.5 + uGlow * 0.35;
  gl_FragColor = vec4(uColor * a * fade * uOn * night * (1.0 - fog) * 1.1, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class Current {
  constructor(def, scene) {
    this.def = def;
    this.id = def.id;
    this.speed = def.speed ?? 80;
    this.enabled = def.enabled !== false;
    this.on = this.enabled ? 1 : 0;
    const pts = def.points.map(([x, a, z, abs]) => new THREE.Vector3(x, abs ? a : heightAt(x, z) + a, z));
    this.curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    this.length = this.curve.getLength();
    const segs = Math.max(20, Math.floor(this.length / 12));
    this.radius = def.radius ?? 2.4;
    const geo = new THREE.TubeGeometry(this.curve, segs, this.radius * 0.6, 8, false);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { ...atmosUniforms, uColor: { value: new THREE.Color(def.color ?? 0x7ff3e6) }, uLen: { value: this.length }, uFlow: { value: this.speed * 0.6 }, uOn: { value: this.on }, uDir: { value: 1 } },
      vertexShader: vert, fragmentShader: frag,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.renderOrder = 3;
    scene.add(this.mesh);
    // 근접 판정용 표본점
    this.samples = [];
    const n = Math.ceil(this.length / 6);
    for (let i = 0; i <= n; i++) this.samples.push(this.curve.getPointAt(i / n));
    this.box = new THREE.Box3().setFromPoints(this.samples).expandByScalar(10);
    this._p = new THREE.Vector3();
    this._t = new THREE.Vector3();
  }

  setEnabled(v) { this.enabled = v; }

  update(dt) {
    const target = this.enabled ? 1 : 0;
    this.on += (target - this.on) * Math.min(1, dt * 0.8);
    this.mat.uniforms.uOn.value = this.on;
    this.mesh.visible = this.on > 0.01;
  }

  /** 점에서 가장 가까운 표본 (u, 거리²) */
  nearest(p) {
    if (!this.box.containsPoint(p)) return null;
    let best = -1, bd = Infinity;
    for (let i = 0; i < this.samples.length; i++) {
      const s = this.samples[i];
      const d = (s.x - p.x) ** 2 + (s.y - p.y) ** 2 + (s.z - p.z) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return { u: best / (this.samples.length - 1), d2: bd };
  }

  /** 플레이어를 해류에 태움 */
  attach(player, u) {
    this.curve.getTangentAt(u, this._t);
    const v = player.vel;
    const dir = v.dot(this._t) >= -0.5 ? 1 : -1;
    player.currentState = { cur: this, u, dir, off: new THREE.Vector2(0, 0), speed: Math.max(25, v.length()) };
    this.mat.uniforms.uDir.value = dir;
    player.enterCurrent(this);
  }

  /** player._current 에서 호출: 한 프레임 이동 */
  carry(player, dt, wish, wishLen) {
    const s = player.currentState;
    s.speed += (this.speed - s.speed) * Math.min(1, dt * 1.5);
    s.u += (s.dir * s.speed * dt) / this.length;
    const done = s.u <= 0 || s.u >= 1;
    s.u = Math.max(0, Math.min(1, s.u));
    const p = this.curve.getPointAt(s.u, this._p);
    const t = this.curve.getTangentAt(s.u, this._t).multiplyScalar(s.dir);
    // 옆으로 살짝 조종 (관 안에서)
    const side = new THREE.Vector3(t.z, 0, -t.x).normalize();
    let turn = 0;
    if (wish && wishLen > 0.1) {
      const lat = wish.x * side.x + wish.z * side.z;
      s.off.x = Math.max(-1.6, Math.min(1.6, s.off.x + lat * dt * 4));
      turn = lat;
    } else s.off.x *= 1 - Math.min(1, dt * 1.5);
    s.off.y = Math.sin(performance.now() * 0.002) * 0.3;
    player.pos.set(p.x + side.x * s.off.x, p.y - 0.9 + s.off.y, p.z + side.z * s.off.x);
    player.vel.copy(t).multiplyScalar(s.speed);
    player.yaw = Math.atan2(t.x, t.z);
    player.pitch = Math.asin(Math.max(-1, Math.min(1, t.y)));
    return { done, exitVel: player.vel.clone().setY(Math.max(player.vel.y, 3)), turn };
  }
}

export class Currents {
  constructor(world, defs) {
    this.world = world;
    this.list = defs.map((d) => new Current(d, world.scene));
    this.byId = new Map(this.list.map((c) => [c.id, c]));
    this.cooldown = 0;
  }

  enable(id, v = true) {
    const c = this.byId.get(id);
    if (c) c.setEnabled(v);
  }

  update(dt, ctx) {
    for (const c of this.list) c.update(dt);
    const pl = ctx && ctx.player;
    if (!pl) return;
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (pl.state === 'current') { this.cooldown = 0.8; return; }
    if (this.cooldown > 0 || pl.state === 'lift') return;
    // 공중·활공·스키머 점프 중에 해류에 닿으면 탑승. 땅에서는 해류 끝의 고리 근처에서.
    const head = pl.pos.clone();
    head.y += 1;
    for (const c of this.list) {
      if (!c.enabled || c.on < 0.5) continue;
      const n = c.nearest(head);
      if (!n) continue;
      const reach = pl.state === 'ground' || pl.state === 'swim' ? c.radius + 1.0 : c.radius + 2.2;
      if (n.d2 < reach * reach) { c.attach(pl, n.u); this.cooldown = 1; return; }
    }
  }
}
