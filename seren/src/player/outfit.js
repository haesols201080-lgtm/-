// 입은 옷 (v24 8장): 옷은 몸 위에 얹는 장식이 아니라 실루엣을 바꾼다.
//  · 아바타는 관절(골반·척추·어깨·팔꿈치·엉덩이·무릎·발목·머리) 묶음이라, 옷 조각도 같은 관절에 붙여 걷기·앉기·일하기 동작을 그대로 따른다.
//  · 조각은 단면 윤곽을 돌린 회전체(Lathe) — 품·길이·단의 퍼짐이 옷마다 다르고, 덮는 몸 부분(탐사복 몸통·팔·다리·장화·장갑)은 숨긴다.
//  · 아웬 치수 기성복(fit 'awen', 수선 전)은 입어 보면 품 1.3 배·소매와 단 1.25 배로 헐렁하게 늘어진다 (피팅룸에서 보이는 그대로).
//  · 긴 외투 자락은 두 다리 각도의 평균을 따라 흔들리고, 다리가 벌어질수록 넓어진다 (update).
import * as THREE from 'three';
import { litMaterial, glowMaterial } from '../world/materials.js';
import { CLOTHES } from '../data/clothes.js';

const TAU = Math.PI * 2;
const _mats = new Map();
const mat = (c) => { if (!_mats.has(c)) _mats.set(c, litMaterial({ color: c, rim: 0.35, rimColor: 0xffffff, spec: 0.15, side: THREE.DoubleSide })); return _mats.get(c); };
const _glow = new Map();
const glow = (c) => { if (!_glow.has(c)) _glow.set(c, glowMaterial({ color: c, intensity: 1.3 })); return _glow.get(c); };
const lighten = (c, k) => new THREE.Color(c).lerp(new THREE.Color(0xffffff), k).getHex();
const darken = (c, k) => new THREE.Color(c).multiplyScalar(1 - k).getHex();

/** 회전체: pts = [[반지름, 높이]…] (위에서 아래로든 아래에서 위로든), 앞(+z)을 열어 둘 때 open = 열린 각 */
function lathe(pts, seg = 18, open = 0) {
  const v = pts.map(([r, y]) => new THREE.Vector2(Math.max(0.001, r), y));
  return new THREE.LatheGeometry(v, seg, open ? open / 2 : 0, open ? TAU - open : TAU);
}
/** 신발 옆모습(발끝 +z) → 폭 w 로 밀어 낸 모양 */
function footGeo(len, h, w, toe = 0.04) {
  const s = new THREE.Shape();
  s.moveTo(-len * 0.32, 0); s.lineTo(len * 0.62, 0);
  s.quadraticCurveTo(len * 0.7, 0, len * 0.7, h * 0.35);
  s.quadraticCurveTo(len * 0.66, h * 0.75, len * 0.3, h * 0.9 + toe);
  s.lineTo(-len * 0.2, h); s.quadraticCurveTo(-len * 0.34, h * 0.9, -len * 0.34, h * 0.4);
  s.lineTo(-len * 0.32, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2, curveSegments: 6 });
  g.translate(0, 0, -w / 2);
  g.rotateY(-Math.PI / 2); // 모양의 x(앞) → z
  return g;
}

export class Outfit {
  constructor(av) {
    this.av = av;
    this.meshes = [];
    this.skirt = null; this.cape = null;
    this.worn = {};
  }
  /** worn: { slot: { item, color, fit } } — 그 자리에서 다시 입힌다 */
  dress(worn = {}) {
    const av = this.av;
    for (const { m, parent } of this.meshes) { parent.remove(m); m.geometry.dispose(); }
    this.meshes = []; this.skirt = null; this.cape = null;
    this.worn = worn;
    const P = av.parts;
    // 먼저 탐사복을 모두 보이게 → 입은 옷이 덮는 부분만 숨긴다
    const all = [P.torso, P.belt, P.chest, P.chestLight, P.pelvis, ...P.armUp, ...P.armLo, ...P.pad, ...P.glove, ...P.thigh, ...P.shin, ...P.kneePad, ...P.boot, ...P.sole];
    for (const m of all) if (m) m.visible = true;
    const hide = (...ms) => { for (const m of ms.flat()) if (m) m.visible = false; };
    for (const slot of Object.keys(worn)) {
      const o = worn[slot];
      if (!o) continue;
      const C = CLOTHES[o.item];
      if (!C) continue;
      const big = o.fit === 'awen'; // 수선 전 아웬 치수: 헐렁하고 길다
      if (C.slot === 'gloves') this.gloves(C.shape, o.color ?? C.colors[0], big); // 장갑 모양 이름(work)이 윗옷과 겹쳐 따로
      else this._build(C.shape, o.color ?? C.colors[0], big, hide);
    }
  }
  _add(parent, geo, material, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z); m.scale.set(sx, sy, sz);
    m.castShadow = false;
    parent.add(m);
    this.meshes.push({ m, parent });
    return m;
  }
  _build(shape, col, big, hide) {
    const av = this.av, P = av.parts;
    const W = big ? 1.3 : 1, L = big ? 1.25 : 1; // 품 · 길이 배율
    const M = mat(col), M2 = mat(darken(col, 0.25)), M3 = mat(lighten(col, 0.35));
    const arms = [av.armL, av.armR], legs = [av.legL, av.legR];
    const sleeve = (len, r0, r1, cuff = 0) => {
      // 윗팔(어깨 관절)·아랫팔(팔꿈치 관절) 소매 — len: 0 짧은 소매 · 1 긴 소매
      for (const A of arms) {
        this._add(A.sh, lathe([[r0 * W, 0.03], [r0 * 1.04 * W, -0.08], [r1 * W, len ? -0.33 : -0.15 * L]], 14), M);
        if (len) {
          this._add(A.el, lathe([[r1 * W, 0.02], [r1 * 0.96 * W, -0.15], [(r1 + cuff) * W, -0.27 * L]], 14), M);
          if (cuff) this._add(A.el, lathe([[(r1 + cuff) * W, -0.25 * L], [(r1 + cuff + 0.008) * W, -0.28 * L]], 14), M2);
        }
      }
      hide(P.pad, len ? [P.armUp, P.armLo] : []);
    };
    switch (shape) {
      // ── 윗옷 ──
      case 'tunic': {
        this._add(av.spine, lathe([[0.075, 0.6], [0.13, 0.575], [0.205, 0.5], [0.23, 0.4], [0.215, 0.22], [0.21, 0.06], [0.215, -0.05 * L]], 20), M, 0, 0, 0, 1.07 * W, 1, 0.86 * W);
        this._add(av.spine, lathe([[0.2, 0.36], [0.203, 0.3]], 20), M3, 0, 0.15, 0.002, 1.1 * W, 1, 0.9 * W); // 여밈 띠
        sleeve(0, 0.078, 0.07);
        hide(P.torso, P.chest, P.chestLight, P.belt);
        break;
      }
      case 'weave': {
        this._add(av.spine, lathe([[0.08, 0.6], [0.15, 0.57], [0.235, 0.47], [0.245, 0.3], [0.24, 0.1], [0.27, -0.06 * L], [0.29, -0.1 * L]], 22), M, 0, 0, 0, 1.06 * W, 1, 0.86 * W);
        this._add(av.spine, lathe([[0.288, -0.09 * L], [0.292, -0.1 * L]], 22), glow(lighten(col, 0.5)), 0, 0, 0, 1.06 * W, 1, 0.86 * W); // 단의 빛실
        sleeve(1, 0.085, 0.078, 0.035);
        hide(P.torso, P.chest, P.chestLight, P.belt);
        break;
      }
      case 'work': {
        this._add(av.spine, lathe([[0.078, 0.6], [0.14, 0.575], [0.215, 0.49], [0.232, 0.36], [0.222, 0.15], [0.22, -0.04 * L]], 20), M, 0, 0, 0, 1.07 * W, 1, 0.86 * W);
        const pocket = this._add(av.spine, lathe([[0.001, 0.0], [0.05, 0.005], [0.05, 0.07], [0.001, 0.075]], 4), M2, 0.08, 0.34, 0.165, 1, 1, 0.25); pocket.rotation.y = Math.PI / 4;
        sleeve(1, 0.08, 0.072, 0.0);
        for (const A of arms) this._add(A.el, lathe([[0.075 * W, -0.22], [0.08 * W, -0.25], [0.075 * W, -0.27]], 12), M2); // 소매 조임 띠
        hide(P.torso, P.chest, P.chestLight);
        break;
      }
      // ── 겉옷 ──
      case 'coat': {
        this._add(av.spine, lathe([[0.1, 0.66], [0.11, 0.6], [0.17, 0.58], [0.265, 0.5], [0.27, 0.36], [0.255, 0.15], [0.25, 0.0]], 22), M, 0, 0, 0, 1.08 * W, 1, 0.9 * W);
        this._add(av.spine, lathe([[0.1, 0.6], [0.125, 0.7]], 16, 0.9), M2, 0, 0, 0, 1.08 * W, 1, 0.9 * W); // 선 깃 (앞은 열림)
        // 자락: 골반에 붙어 두 다리 평균을 따른다
        this.skirt = this._add(av.hips, lathe([[0.235, 0.06], [0.25, -0.1], [0.28, -0.35 * L], [0.31, -0.6 * L]], 22), M, 0, 0, 0, 1.06 * W, 1, 0.98 * W);
        this._add(av.hips, lathe([[0.309, -0.58 * L], [0.312, -0.6 * L]], 22), M2, 0, 0, 0, 1.06 * W, 1, 0.98 * W).userData.skirtTrim = true;
        sleeve(1, 0.095, 0.088, 0.02);
        hide(P.torso, P.chest, P.chestLight, P.belt, P.pelvis);
        break;
      }
      case 'cape': {
        this.cape = this._add(av.spine, lathe([[0.13, 0.6], [0.24, 0.52], [0.3, 0.3], [0.34, 0.05 * L], [0.36, -0.12 * L]], 18, Math.PI * 1.15), M, 0, 0, -0.01, 1.05 * W, 1, 1.0 * W);
        this.cape.rotation.y = Math.PI; // 열린 쪽을 앞으로 → 등만 덮는다
        this._add(av.spine, lathe([[0.12, 0.62], [0.135, 0.57]], 18), M3, 0, 0, 0, 1.05, 1, 0.92); // 어깨 고리
        break;
      }
      case 'vest': {
        this._add(av.spine, lathe([[0.12, 0.58], [0.2, 0.53], [0.26, 0.44], [0.262, 0.25], [0.255, 0.06], [0.25, 0.0]], 20), M, 0, 0, 0, 1.08 * W, 1, 0.92 * W);
        for (const y of [0.16, 0.32]) this._add(av.spine, lathe([[0.263, y], [0.265, y + 0.035]], 20), glow(0xfff4c8), 0, 0, 0, 1.08 * W, 1, 0.92 * W);
        hide(P.chest, P.chestLight);
        break;
      }
      // ── 아래옷 ──
      case 'wide':
      case 'slim': {
        const wide = shape === 'wide';
        this._add(av.hips, lathe([[0.17, 0.1], [0.195, 0.0], [0.19, -0.1]], 20), M, 0, 0, 0, 1.12 * W, 0.85, 0.9 * W); // 허리·엉덩이
        for (const Lg of legs) {
          this._add(Lg.hip, lathe(wide ? [[0.098, 0.02], [0.105, -0.2], [0.112, -0.46]] : [[0.09, 0.02], [0.088, -0.2], [0.08, -0.46]], 14), M, 0, 0, 0, W, 1, W);
          this._add(Lg.knee, lathe(wide ? [[0.108, 0.02], [0.125, -0.2], [0.15, -0.4 * L]] : [[0.078, 0.02], [0.073, -0.2], [0.068, -0.37 * L]], 14), M, 0, 0, 0, W, 1, W);
          if (wide) this._add(Lg.knee, lathe([[0.149, -0.385 * L], [0.152, -0.4 * L]], 14), M2, 0, 0, 0, W, 1, W);
        }
        hide(P.pelvis, P.thigh, P.shin, P.kneePad, P.belt);
        break;
      }
      // ── 신 ──
      case 'tall':
      case 'light': {
        const tall = shape === 'tall';
        for (const Lg of legs) {
          const f = this._add(Lg.ankle, footGeo(0.26 * (big ? 1.15 : 1), tall ? 0.11 : 0.085, 0.13 * W), M, 0, -0.085, 0.045);
          f.userData.shoe = true;
          this._add(Lg.ankle, footGeo(0.265 * (big ? 1.15 : 1), 0.02, 0.135 * W), M2, 0, -0.09, 0.045); // 바닥
          if (tall) this._add(Lg.knee, lathe([[0.082 * W, -0.2], [0.085 * W, -0.32], [0.08 * W, -0.42]], 14), M);
          else this._add(Lg.ankle, lathe([[0.062, 0.03], [0.07, -0.02]], 12), M3); // 발목 끈
        }
        hide(P.boot, P.sole);
        break;
      }
      // ── 머리 ──
      case 'brim': {
        this._add(av.head, lathe([[0.001, 0.25], [0.12, 0.24], [0.16, 0.17], [0.172, 0.08]], 20), M);
        this._add(av.head, lathe([[0.17, 0.085], [0.25, 0.07], [0.32, 0.045]], 24), M);
        this._add(av.head, lathe([[0.171, 0.1], [0.173, 0.13]], 20), M3);
        break;
      }
      case 'hood': {
        this._add(av.head, lathe([[0.001, 0.2], [0.12, 0.185], [0.185, 0.08], [0.19, -0.06], [0.16, -0.14], [0.17, -0.2]], 20, 1.7), M, 0, 0, -0.005);
        this._add(av.neck, lathe([[0.13, 0.04], [0.16, -0.04], [0.2, -0.1]], 20), M, 0, 0, 0, 1.05, 1, 0.9); // 목 감싸기
        break;
      }
      case 'hard': {
        this._add(av.head, lathe([[0.001, 0.215], [0.11, 0.2], [0.17, 0.13], [0.18, 0.06]], 20), M);
        this._add(av.head, lathe([[0.18, 0.065], [0.21, 0.05], [0.215, 0.04]], 22), M2);
        this._add(av.head, lathe([[0.176, 0.12], [0.178, 0.15]], 20), glow(0xfff4c8));
        break;
      }
    }
  }
  /** 장갑만 따로 (윗옷 work 와 모양 이름이 겹친다) */
  gloves(shape, col, big) {
    const av = this.av, P = av.parts, M = mat(col), M2 = mat(darken(col, 0.25));
    const work = shape === 'work', W = big ? 1.3 : 1;
    for (const A of [av.armL, av.armR]) {
      this._add(A.el, lathe(work ? [[0.001, -0.42], [0.05, -0.41], [0.072, -0.36], [0.07, -0.3], [0.078, -0.25]] : [[0.001, -0.44 * (big ? 1.08 : 1)], [0.045, -0.42], [0.06, -0.35], [0.058, -0.29]], 14), M, 0, 0, 0, W, 1, W * 0.85);
      if (work) this._add(A.el, lathe([[0.08, -0.25], [0.088, -0.22]], 14), M2);
    }
    for (const m of P.glove) m.visible = false;
  }
  /** 매 프레임: 외투 자락·망토 흔들림 */
  update(dt, speed = 0) {
    const av = this.av;
    if (this.skirt) {
      const a = av.legL.hip.rotation.x, b = av.legR.hip.rotation.x;
      const mean = (a + b) / 2, spread = Math.abs(a - b);
      for (const { m, parent } of this.meshes) if (parent === av.hips && (m === this.skirt || m.userData.skirtTrim)) {
        m.rotation.x = mean * 0.6;
        m.scale.z = (this.worn.outer && this.worn.outer.fit === 'awen' ? 1.27 : 0.98) * (1 + spread * 0.45);
      }
    }
    if (this.cape) {
      this._sw = (this._sw || 0) + dt * (2 + speed * 0.8);
      this.cape.rotation.x = -Math.min(0.5, speed * 0.05) - Math.sin(this._sw) * 0.03 * (0.5 + Math.min(1, speed * 0.2));
    }
  }
}

/** 상태의 입은 옷(소유 id) → 그리기용 { slot: { item, color, fit } } */
export function wornLook(W, extra = null) {
  const out = {};
  if (W) for (const [slot, id] of Object.entries(W.worn || {})) { const o = (W.own || []).find((q) => q.id === id); if (o) out[slot] = o; }
  if (extra) for (const [slot, o] of Object.entries(extra)) out[slot] = o; // 피팅룸에서 입어 보는 옷
  return out;
}
