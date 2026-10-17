// The Party's flags, each fixed to something as in the novel: flagstaffs on
// the roofs of its buildings and round Victory Square, long banners hung
// from the parapets of its offices and blocks of flats, and strings of
// streamers on wires slung across the Party's streets. One wind blows
// through all of them.
import * as THREE from 'three';
import { flagTexture } from './city_paint.js';
import { baysFor } from './town/styles.js';
import { Frame } from './town/kit.js';

const WIND = 0.9;   // the direction the cloth streams to (yaw)

// cloth that waves: displaced along its normal, more the further from the
// edge it hangs by (uv.x for flags, 1 - uv.y for banners and pennants)
function clothMaterial(G, map, mode) {
  const m = new THREE.MeshStandardMaterial({ map, side: THREE.DoubleSide, roughness: 0.85, color: 0xffffff });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = G.mats.globals.uTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          vec4 ip = vec4(0.0, 0.0, 0.0, 1.0);
          #ifdef USE_INSTANCING
            ip = instanceMatrix * ip;
          #endif
          float k = ${mode === 'flag' ? 'uv.x' : '1.0 - uv.y'};
          float ph = uTime * ${mode === 'flag' ? '3.1' : '1.3'} + ip.x * 0.31 + ip.z * 0.17;
          transformed.z += (sin(ph - uv.x * 6.0) * 0.16 + sin(ph * 1.7 - uv.y * 4.0) * 0.06) * k * ${mode === 'flag' ? '1.0' : '0.5'};
          ${mode === 'flag' ? 'transformed.y -= k * k * 0.12;' : ''}
        }`);
  };
  m.customProgramCacheKey = () => 'cloth' + mode;
  return m;
}

export function addPropaganda(G, root, town, plan, o) {
  const { r, partyAt, avenues, map } = o;
  const tex = flagTexture(G);
  const flagMat = clothMaterial(G, tex, 'flag');
  const bannerMat = clothMaterial(G, tex, 'banner');
  const poleMat = G.mats.get('iron_black');
  const flags = [], poles = [], banners = [];
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3();
  const mat = (x, y, z, ry, sx = 1, sy = 1, sz = 1) => M.compose(P.set(x, y, z), Q.setFromEuler(new THREE.Euler(0, ry, 0)), S.set(sx, sy, sz)).clone();

  const flagstaff = (x, y, z, h, size) => {
    poles.push(mat(x, y + h / 2, z, 0, 1, h, 1));
    flags.push(mat(x, y + h - size * 0.33, z, WIND, size, size * 0.66, 1));
  };
  // on the roofs of the Party's offices, flats and depots
  for (const j of town.jobs) {
    if (j.kind !== 'house' || !partyAt(j.F.ox, j.F.oz)) continue;
    const st = j.style;
    const official = st.type === 'office' || st.type === 'interwar' || st.type === 'tenement' || j.special;
    if (!official || r() > 0.55) continue;
    const p = j.F.p(j.w / 2, 0, -1.2);
    flagstaff(p[0], (j.top || 14) + 0.1, p[2], 6.5, 2.8);
    // and a long banner down the front from the parapet
    if (r() < 0.6 && j.w > 9) {
      const bays = baysFor(st, j.w);
      const k = Math.floor(r() * bays);
      const bx = (j.w * (k + 0.5)) / bays;
      const q = j.F.p(bx, 0, 0.18);
      const len = Math.min(11, (j.top || 14) * 0.6);
      banners.push(mat(q[0], (j.top || 14) - 0.4, q[2], j.F.rot, 2.2, len, 1));
    }
  }
  // Victory Square: a ring of tall masts along the terrace and the roadsides
  for (const [x, z] of [[-60, -58], [-30, -66], [0, -72], [30, -80], [-50, 12], [-20, 15], [20, 12], [44, 0]]) {
    poles.push(mat(x, 0.12 + 0.6, z, 0, 3.0, 1.2, 3.0));   // a granite foot (scaled pole)
    flagstaff(x, 0.12, z, 14, 4.2);
  }
  // the Ministry of Truth: flags along its first terrace
  if (o.minitrue) {
    const { x: mx, z: mz, s } = o.minitrue;
    for (let i = -3; i <= 3; i++) flagstaff(mx + i * 22 * s, 11 * s, mz + (85 - 5.6) * s, 7, 3.2);
  }

  // streamers on wires across the Party's thoroughfares
  const pennants = [], wires = [];
  for (const s of plan.streets) {
    if (!avenues.has(s.name)) continue;
    const half = s.w / 2 + (Array.isArray(s.pave) ? s.pave[0] : s.pave || 2) + 0.15;
    let acc = 20;
    for (let i = 0; i < s.line.length - 1; i++) {
      const [ax, az] = s.line[i], [bx, bz] = s.line[i + 1];
      const L = Math.hypot(bx - ax, bz - az);
      const ux = (bx - ax) / (L || 1), uz = (bz - az) / (L || 1);
      for (let t = acc; t < L; t += 46) {
        const cx = ax + ux * t, cz = az + uz * t;
        const A = [cx - uz * half, cz + ux * half], B = [cx + uz * half, cz - ux * half];
        // both ends must meet a building
        const onBlock = (p, dx, dz) => map.typeAt(p[0] + dx * 0.8, p[1] + dz * 0.8) === 6;
        if (!onBlock(A, -uz, ux) || !onBlock(B, uz, -ux)) continue;
        const y = 7.2;
        wires.push(A[0], y, A[1], B[0], y, B[1]);
        const n = Math.floor((half * 2) / 0.9);
        const rot = Math.atan2(ux, uz);
        for (let k = 1; k < n; k++) {
          const f = k / n;
          const sag = Math.sin(f * Math.PI) * 0.45;
          pennants.push(mat(A[0] + (B[0] - A[0]) * f, y - sag, A[1] + (B[1] - A[1]) * f, rot, 0.42, 0.6, 1));
        }
      }
      acc = (acc - L) % 46; if (acc < 0) acc += 46;
    }
  }

  const inst = (geo, material, list, name, cast = true) => {
    if (!list.length) return null;
    const im = new THREE.InstancedMesh(geo, material, list.length);
    list.forEach((m, i) => im.setMatrixAt(i, m));
    im.computeBoundingSphere();
    im.castShadow = cast; im.receiveShadow = true;
    im.name = name;
    root.add(im);
    return im;
  };
  // geometry: flags hang by their left edge, banners by their top edge
  const flagGeo = new THREE.PlaneGeometry(1, 1, 14, 6); flagGeo.translate(0.5, 0, 0);
  const bannerGeo = new THREE.PlaneGeometry(1, 1, 4, 16); bannerGeo.translate(0, -0.5, 0);
  const poleGeo = new THREE.CylinderGeometry(0.05, 0.07, 1, 8);
  const penGeo = new THREE.BufferGeometry();
  penGeo.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0, -1, 0], 3));
  penGeo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 0.5, 0], 2));
  penGeo.computeVertexNormals();
  const penMat = clothMaterial(G, null, 'banner');
  penMat.color.set(0x8e1a12);
  inst(flagGeo, flagMat, flags, 'flags');
  inst(bannerGeo, bannerMat, banners, 'banners');
  inst(poleGeo, poleMat, poles, 'flagstaffs');
  inst(penGeo, penMat, pennants, 'streamers', false);
  if (wires.length) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(wires, 3));
    root.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x1a1a1a })));
  }
  return { flags: flags.length, banners: banners.length, pennants: pennants.length };
}

export { Frame };
